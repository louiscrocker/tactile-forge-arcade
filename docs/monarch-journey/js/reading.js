/* ============================================================
   reading.js — Read to Play
   ============================================================
   Ported from Frog Pond (READING_DESIGN.md there is the pattern).
   When the reading mode is "I read to play", reading is how the
   game is played:

   ACTION CARDS  The action button (Space, Enter, GO!, a tap) no
                 longer acts by itself.  It opens a card of words
                 at the child's level; tapping the word that fits
                 the moment ("eat" on a leaf, "hang" at a glowing
                 spot, "drink" at a flower, "dive" when a bird
                 chases) makes the monarch do it, and unlocks that
                 action for a few seconds so play stays fluid.
                 Crawling, steering and flapping stay free.
   READ TO GROW  Each molt, the J and the butterfly coming out wait
                 for a leveled page to be read and its task done:
                 match a picture (A), build the sentence (B, C),
                 answer yes/no (C+), fill the gap (D, E).  The big
                 journey buttons (fly south, winter, fly north,
                 the next generation) are gated the same way.
   MISSIONS      "Go up to the top."  The sentence is shown, not
                 spoken; going there proves it was understood.
   HELP          Any word can be tapped to hear it.  Help comes by
                 itself after a delay if the grown-up allows it.
                 Two wrong taps and the answer glows and is read.
                 Help is recorded; nothing is ever lost.
   TRACKING      Every word: right (unaided), wrong, helped.  The
                 level can adjust itself.  My Words shows mastery;
                 the grown-up corner gets a reading report and the
                 running records from the microphone.
   ============================================================ */
'use strict';

const Reading = (function () {
  const $ = (id) => (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  const hasDom = () => !!$('readCard');
  const KEY = 'monarch.reading';
  let Gm = null, cb = {};
  let data = { words: {}, recent: [], stars: 0, pages: 0, missions: 0, cards: 0, levelUps: 0 };
  let card = null, page = null, mission = null, missionCool = 20, missionClock = 0, lastMission = null;
  const unlocked = {}, auto = { graze: 0, hide: 0, dive: 0 };
  let pendingGate = null, helpTimer = null, hintSayTimer = null, focus = 0;
  let listen = null;          /* { kind: 'page'|'card', ... } while the microphone is on */
  const storyQueue = [];      /* story pages waiting for a quiet moment */

  const load = () => { try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); if (!data.words || typeof data.words !== 'object') data.words = {}; if (!Array.isArray(data.recent)) data.recent = []; } catch (e) { /* fine */ } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* fine */ } };

  function on() { return !!Gm && Gm.settings.readMode === 'play'; }
  function level() { const L = Gm && Gm.settings.readLevel; return READ_LEVELS.includes(L) ? L : 'B'; }
  function info() { return LEVEL_INFO[level()]; }
  function autoHelp() { return Gm.settings.readHelp !== 'ask'; }
  function micOn() { return !!Gm.settings.readMic && Listener.supported(); }
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z']/g, '');
  const say = (t, o = {}) => typeof Voice !== 'undefined' && Voice.say(t, Object.assign({ interrupt: true, force: true }, o));
  const sfx = (k) => { if (typeof AudioFX === 'undefined') return; const f = { good: 'molt', bump: 'bump', tile: 'click', done: 'fanfare' }[k]; if (AudioFX[f]) AudioFX[f](); };

  /* ---------- word statistics & the adaptive level ---------- */
  function mark(word, kind) {
    const w = norm(word); if (!w) return;
    const s = data.words[w] || (data.words[w] = { r: 0, w: 0, h: 0, last: 0 });
    s[kind === 'right' ? 'r' : kind === 'wrong' ? 'w' : 'h']++; s.last = Date.now();
    if (kind === 'right') Bus.emit('readWord', w, Object.values(data.words).filter(x => x.r > 0).length);
  }
  function markText(text, kind) { for (const w of tokenize(text)) mark(w, kind); }
  function result(ok) {
    data.recent.push(ok ? 1 : 0); if (data.recent.length > 30) data.recent.shift();
    if (Gm.settings.readAuto && data.recent.length >= 20) {
      const acc = data.recent.reduce((a, b) => a + b, 0) / data.recent.length, i = READ_LEVELS.indexOf(level());
      if (acc >= .9 && i < READ_LEVELS.length - 1) setLevel(READ_LEVELS[i + 1], 'up');
      else if (acc < .55 && i > 0) setLevel(READ_LEVELS[i - 1], 'down');
    }
    save();
  }
  function setLevel(L, why) {
    Gm.settings.readLevel = L; data.recent = []; if (why === 'up') data.levelUps++;
    cb.saveSettings && cb.saveSettings(); save();
    if (why) { Bus.emit('readLevel', L, why); if (typeof UI !== 'undefined') UI.hint(why === 'up' ? `You moved up to level ${L}! Great reading!` : `Level ${L} for now. You can do it!`); }
    if (typeof UI !== 'undefined') UI.refreshToggles();
  }
  function accuracy() { return data.recent.length ? data.recent.reduce((a, b) => a + b, 0) / data.recent.length : null; }
  function mastery(s) { if (s.r >= 3 && s.r > s.w + s.h) return 'known'; if (s.w + s.h >= 3 && s.r < s.w + s.h) return 'tricky'; return 'learning'; }

  /* ---------- pictures for words (rebus) and choices ----------
     Everything is drawn with the game's own sprites, into a canvas
     `px` CSS pixels square; the drawing space is 100 × 100, centred. */
  function drawPic(key, ctx) {
    const v = Gm ? Gm.variantDef() : VARIANTS.male;
    const S = Sprites;
    switch (key) {
      case 'egg': S.drawEgg(ctx, { s: 5 }); break;
      case 'caterpillar': ctx.rotate(-.3); S.drawCaterpillar(ctx, { s: 1, instar: 5 }); break;
      case 'skin': ctx.rotate(-.3); S.drawCaterpillar(ctx, { s: .95, instar: 4, pale: .6 }); break;
      case 'jhang':
        ctx.fillStyle = '#7fbf5c'; ctx.beginPath(); ctx.ellipse(0, -40, 34, 8, 0, 0, TAU); ctx.fill();
        ctx.translate(4, -34); ctx.rotate(Math.PI / 2); ctx.translate(30, 0);
        S.drawCaterpillar(ctx, { s: .9, instar: 5, curl: 2.3 }); break;
      case 'chrysalis': ctx.translate(0, -36); S.drawChrysalis(ctx, { s: 1.35, prog: .3, variant: v }); break;
      case 'monarch': ctx.rotate(-Math.PI / 2); S.drawMonarch(ctx, { s: .92, variant: v, open: 1, flap: 1 }); break;
      case 'wings': ctx.rotate(-Math.PI / 2); S.drawMonarch(ctx, { s: 1, variant: v, open: 1, flap: 1, fresh: 0 }); break;
      case 'tag': ctx.rotate(-Math.PI / 2); S.drawMonarch(ctx, { s: .92, variant: v, open: 1, flap: 1, tag: true }); break;
      case 'leaf': {
        ctx.rotate(-.5);
        const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, '#9fd46e'); g.addColorStop(1, '#5a9a3a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.quadraticCurveTo(0, -30, 44, 0); ctx.quadraticCurveTo(0, 30, -44, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(40, 0); ctx.stroke();
        break;
      }
      case 'milkweed': ctx.translate(0, 46); S.drawMiniMilkweed(ctx, 5, 88, 0, (Gm && Gm.plant && Gm.plant.type) || MILKWEEDS.swamp); break;
      case 'flower': S.drawUmbel(ctx, { size: 32, hue: .37 }, 0, 4, 0, false, (Gm && Gm.plant && Gm.plant.type) || MILKWEEDS.swamp); break;
      case 'pod': S.drawPod(ctx, { side: 1, size: 70, ang: -.5, burst: 0, seeds: 4 }, -36, 16, 0); break;
      case 'seed': {
        /* a flat brown seed under its silky parachute (the game's floss is white, which vanishes on a white card) */
        ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 11; i++) { const a = -Math.PI / 2 + (i - 5) * .2; ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(Math.cos(a) * 20, 18 + Math.sin(a) * 30, Math.cos(a) * 36, 14 + Math.sin(a) * 50); ctx.stroke(); }
        ctx.fillStyle = '#7a5226'; ctx.beginPath(); ctx.ellipse(0, 26, 12, 8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      }
      case 'tree': S.drawTree(ctx, { kind: 'oak', h: 86, seed: 11, roost: .4 }, 0, 46, 0); break;
      case 'fir': S.drawTree(ctx, { kind: 'fir', h: 90, seed: 5, roost: .7 }, 0, 46, 0); break;
      case 'bird': S.drawBird(ctx, { s: 2.1, kind: 'oriole', phase: 1 }); break;
      case 'wasp': S.drawWasp(ctx, { s: 2.6, phase: 0 }); break;
      case 'ant': S.drawAnt(ctx, { s: 3, walk: 0, bite: 0 }); break;
      case 'aphid': S.drawAphid(ctx, { s: 7, walk: 0 }); break;
      case 'mantis': ctx.translate(0, 20); S.drawMantis(ctx, { s: 2.4 }); break;
      case 'net': ctx.translate(-22, 46); S.drawVolunteer(ctx, { s: .52, swing: .3 }); break;
      case 'map': {
        /* a folded paper map: the route south, dotted, ending at a fir */
        ctx.fillStyle = '#f4ead0'; ctx.strokeStyle = '#b8a070'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-44, -34); ctx.lineTo(-15, -40); ctx.lineTo(15, -34); ctx.lineTo(44, -40); ctx.lineTo(44, 36); ctx.lineTo(15, 42); ctx.lineTo(-15, 36); ctx.lineTo(-44, 42); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(140,190,110,.55)'; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.quadraticCurveTo(0, -40, 40, -30); ctx.lineTo(38, 0); ctx.quadraticCurveTo(10, 10, 0, 34); ctx.quadraticCurveTo(-20, 20, -40, 30); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e0641a'; ctx.lineWidth = 3.5; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(18, -26); ctx.quadraticCurveTo(-12, -4, 0, 24); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#2f6a3a'; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-8, 32); ctx.lineTo(8, 32); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.translate(20, -26); ctx.rotate(-Math.PI / 2 + .6); S.drawMonarch(ctx, { s: .32, variant: v, open: 1, flap: 1 }); ctx.restore();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(12, -8, 22, 0, TAU); ctx.fill(); break;
      case 'rain': {
        ctx.fillStyle = '#8a98aa'; for (const [x, y, r] of [[-18, -10, 16], [4, -16, 20], [22, -8, 14], [0, -2, 18]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#5a9ad8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const x of [-22, -8, 6, 20]) { ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x - 5, 32); ctx.stroke(); }
        break;
      }
      case 'water': { const g = ctx.createLinearGradient(0, -20, 0, 26); g.addColorStop(0, '#9fe0ef'); g.addColorStop(1, '#2a6fb8'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4, 42, 22, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, -2); ctx.quadraticCurveTo(-13, -8, 0, -2); ctx.quadraticCurveTo(13, 4, 26, -2); ctx.stroke(); break; }
    }
  }
  function picture(key, px) {
    const c = document.createElement('canvas'); c.width = c.height = px * 2;
    const ctx = c.getContext('2d'); ctx.scale(2 * px / 100, 2 * px / 100); ctx.translate(50, 50);
    ctx.save(); try { drawPic(key, ctx); } catch (e) { /* a missing sprite never breaks reading */ } ctx.restore();
    c.style.width = c.style.height = px + 'px'; return c;
  }

  /* render a line of text as tappable words (with rebus pictures at A and B) */
  function renderWords(el, text, opts = {}) {
    for (const tok of String(text).split(/\s+/)) {
      if (!tok) continue;
      const w = norm(tok);
      const span = document.createElement('span'); span.className = 'rw'; span.textContent = tok; span.dataset.w = w;
      span.addEventListener('click', (e) => { e.stopPropagation(); say(w === 'j' ? 'J' : w, { rate: .75 }); mark(w, 'help'); if (opts.onHelp) opts.onHelp(w); span.classList.add('helped'); });
      el.appendChild(span);
      if (info().rebus && PIC_NOUNS[w] && opts.rebus !== false) { const pic = picture(PIC_NOUNS[w], 30); pic.classList.add('rebus'); el.appendChild(pic); }
      el.appendChild(document.createTextNode(' '));
    }
  }

  /* ---------- what the monarch could do right now ---------- */
  function larvaDanger(p) {
    const G = Gm;
    if (G.wasp && G.wasp.enabled && G.wasp.state !== 'idle' && (G.night || 0) <= .5) return 'wasp';
    const m = G.mantis;
    if (m && m.enabled && m.cooldown <= 0 && dist(m.x, m.y, p.x, p.y) < 120) return 'mantis';
    return null;
  }
  function birdDanger(p) { const b = Gm.bird; return !!b && b.enabled && (b.state === 'warning' || b.state === 'chase') && b.target === p; }
  function stormNear(p) { const R = Gm.route; return !!R && (R.inStorm(p.x) || (!!R.storm && R.storm.warned && Math.abs(R.storm.x - p.x) < 2600)); }
  function context(p) {
    const G = Gm;
    switch (p.state) {
      case 'egg': return 'chew';
      case 'larva':
        if (larvaDanger(p)) return 'hide';
        if (p.readyFlag) return p.hangSpot ? 'hang' : null;
        return p.onLeaf() ? 'eat' : null;
      case 'jhang': case 'chrysalis': return 'wiggle';
      case 'adult':
        if (p.podNear) return 'pop';
        if (p.eggSpotNear) return 'lay';
        if (p.flowerNear && !p.readyFlag) return 'drink';
        if (p.summer && p.readyFlag && p.variant.key !== 'female' && p.mateNear) return 'mate';
        return 'fly';
      case 'flying':
        if (p.podNear) return 'pop';
        if (p.summer && p.readyFlag && p.variant.key !== 'female' && p.mateNear) return 'mate';
        if (p.flowerNear && !p.readyFlag) return 'drink';
        return p.landSpot ? 'land' : null;
      case 'sipping': return 'fly';
      case 'migrating': case 'winterFly': {
        const L = p.landing;
        if (L) {
          if (L.type === 'nectar') return 'drink';
          if (L.type === 'fir') return 'sleep';
          if (L.type === 'tree') return stormNear(p) ? 'shelter' : ((G.night || 0) > .3 || G.tod > .7) ? 'sleep' : 'rest';
          if (!birdDanger(p)) return 'rest';
        }
        return birdDanger(p) ? 'dive' : null;
      }
      case 'nectaring': return 'south';
      case 'roosting': {
        const R = G.route, storm = R && (R.inStorm(p.x) || (R.storm && Math.abs(R.storm.x - p.x) < 2200));
        return p.timer > 1.2 && p.waitDays === 0 && (G.night || 0) <= .5 && !storm ? (p.winter ? 'fly' : 'south') : null;
      }
      case 'resting': return p.timer >= p.restT ? (p.winter ? 'fly' : 'south') : null;
      case 'arrived': return p.timer > 6 ? 'fly' : null;
    }
    return null;
  }
  function picFor(verb, p) {
    if (verb === 'hide') return larvaDanger(p) === 'mantis' ? 'mantis' : 'wasp';
    if (verb === 'sleep') return p.landing && p.landing.type === 'fir' ? 'fir' : 'tree';
    return { chew: 'egg', eat: 'leaf', hang: 'jhang', wiggle: 'chrysalis', fly: 'monarch', drink: 'flower', land: 'milkweed', pop: 'pod', lay: 'egg', mate: 'monarch', dive: 'bird', shelter: 'rain', rest: 'wings', south: 'map' }[verb] || 'monarch';
  }

  /* ---------- action cards ---------- */
  function choicesFor(verb) {
    const L = level(), n = info().choices, correct = ACTION_TEXT[verb][L];
    const pool = [...new Set(Object.keys(ACTION_TEXT).map(k => ACTION_TEXT[k][L]))].filter(t => t !== correct);
    /* prefer words the child finds tricky as distractors, so they keep meeting them */
    pool.sort((a, b) => ((data.words[norm(b)] || {}).h || 0) - ((data.words[norm(a)] || {}).h || 0) + (Math.random() - .5) * 2);
    const out = [correct, ...pool.slice(0, n - 1)];
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
    return { correct, choices: out };
  }
  function openCard(p, verb, onOk) {
    const { correct, choices } = choicesFor(verb);
    card = { p, verb, correct, choices, onOk, tries: 0, helped: false };
    data.cards++;
    if (!hasDom()) return card;
    const el = $('readCard'); el.hidden = false;
    $('rcPrompt').textContent = CARD_PROMPT[level()];
    const pic = $('rcPic'); pic.innerHTML = '';
    pic.appendChild(picture(picFor(verb, p), 72));
    const box = $('rcChoices'); box.innerHTML = '';
    const long = choices.some(t => t.length > 12);           // one size for every choice on a card
    choices.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'rc-word' + (long ? ' long' : '');
      b.innerHTML = `<small>${i + 1}</small>`; const s = document.createElement('span'); s.textContent = t; b.appendChild(s);
      b.addEventListener('click', () => chooseCard(i));
      box.appendChild(b);
    });
    focus = 0; refocus();
    say(CARD_PROMPT[level()]);
    $('rcMic').hidden = !micOn();
    if (micOn()) listenCard();
    clearTimeout(helpTimer);
    if (autoHelp()) helpTimer = setTimeout(() => cardHelp(), info().help * 1000);
    return card;
  }
  function refocus() { if (!hasDom()) return; [...$('rcChoices').children].forEach((b, i) => b.classList.toggle('focus', i === focus)); }
  /* read every choice aloud, one at a time: the child can then pick by listening */
  function cardHelp() {
    if (!card || !hasDom()) return;
    card.helped = true;
    const btns = [...$('rcChoices').children];
    let i = 0;
    const next = () => { if (!card || i >= btns.length) { btns.forEach(b => b.classList.remove('saying')); return; } btns.forEach((b, k) => b.classList.toggle('saying', k === i)); const spoke = say(card.choices[i], { rate: .8, onend: () => { i++; setTimeout(next, 250); } }); if (!spoke) { i++; setTimeout(next, 900); } };
    next();
  }
  function chooseCard(i) {
    if (!card) return;
    const c = card, pick = c.choices[i];
    if (pick === undefined) return false;
    if (pick === c.correct) {
      const clean = c.tries === 0 && !c.helped;
      markText(c.correct, clean ? 'right' : 'help');
      result(clean);
      closeCard();
      if (Gm.particles && c.p) { Gm.particles.sparkle(c.p.x, c.p.y - 20, 14, '#fff3b0', 18); Gm.particles.text(c.p.x, c.p.y - 40, pick.length < 14 ? pick : '✓', '#fff3b0', 16); }
      if (clean) sfx('good');
      Bus.emit('readCard', c.verb, clean);
      c.onOk && c.onOk();
      return true;
    }
    c.tries++; markText(c.correct, 'wrong');
    if (hasDom()) { const b = $('rcChoices').children[i]; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    sfx('bump');
    if (c.tries >= 2) {
      c.helped = true;
      if (hasDom()) [...$('rcChoices').children].forEach((b, k) => b.classList.toggle('glow', c.choices[k] === c.correct));
      say(c.correct, { rate: .8 });
    } else say('Try again.');
    return false;
  }
  function closeCard() { card = null; clearTimeout(helpTimer); stopListening(); if (hasDom()) $('readCard').hidden = true; }

  /* the monarch does what was read, and the action stays unlocked for a little while */
  function grant(p, verb) {
    unlocked[verb] = Gm.time + info().window;
    switch (verb) {
      case 'eat': auto.graze = 2.6; p.input.actionPressed = true; break;
      case 'hide': auto.hide = 3; break;
      case 'dive': auto.dive = 3; break;
      default: p.input.actionPressed = true;
    }
  }

  /* called every frame after input is gathered (player 1 only) */
  function intercept(p) {
    if (!on() || !p || p.id !== 1 || card || page) return;
    const t = Gm.time;
    if (p.input.actionPressed) {
      const verb = context(p);
      if (verb && !(unlocked[verb] > t)) { p.input.actionPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
    /* the egg only opens by reading, not by wriggling the arrows */
    if (p.state === 'egg' && !(unlocked.chew > t)) { p.input.x = p.input.y = 0; }
    /* holding the button only bites once "eat" has been read */
    if (p.state === 'larva' && !(unlocked.eat > t)) p.input.action = false;
    if (auto.graze > 0 && p.state === 'larva') p.input.action = true;
    if (auto.hide > 0 && p.state === 'larva') { p.input.y = 1; p.input.x = 0; p.route = null; }
    if (auto.dive > 0 && (p.state === 'migrating' || p.state === 'winterFly')) { p.input.y = 1; p.input.x = 1; }
  }

  /* ---------- pages (read to grow, and story pages) ---------- */
  function lines(key) { return READ_CHAPTERS[key][level()]; }
  function gate(p, key, cont) {
    pendingGate = { key, cont, p };
    showPage(key, { gate: true, onDone: () => { const g = pendingGate; pendingGate = null; if (g) g.cont(); } });
  }
  /* a story page at the next quiet moment (no card, page or cinematic) */
  function story(key) { if (on() && READ_CHAPTERS[key] && !storyQueue.includes(key)) storyQueue.push(key); }
  function showPage(key, opts = {}) {
    const ch = READ_CHAPTERS[key]; if (!ch) return;
    page = { key, opts, helped: false, tasks: opts.gate ? info().tasks.slice() : [], step: -1, firstTry: true };
    if (!hasDom()) return;
    const L = level();
    $('rpLevel').textContent = LEVEL_INFO[L].name;
    $('rpTitle').textContent = ch.title || '';
    const pic = $('rpPic'); pic.innerHTML = ''; pic.appendChild(picture(ch.pic, 120));
    const box = $('rpText'); box.innerHTML = '';
    for (const line of lines(key)) { const p = document.createElement('p'); p.className = 'rp-line'; renderWords(p, line, { onHelp: () => { page.helped = true; } }); box.appendChild(p); }
    $('rpTask').innerHTML = ''; $('rpTask').hidden = true; $('rpText').classList.remove('put-away');
    $('rpNext').textContent = opts.gate ? 'I read it! ➜' : 'I read it! ✓';
    $('rpNext').hidden = false; $('rpHelp').hidden = false; $('rpHelp').classList.remove('pulse');
    $('rpMic').hidden = !SR() || micOn();
    $('rpMic').textContent = '🎤 I will read it out loud';
    $('rpMic').classList.remove('listening');
    $('rpMsg').textContent = '';
    $('rpMicRow').hidden = true;
    $('readPage').hidden = false;
    if (micOn()) setTimeout(() => { if (page && page.key === key && page.step === -1) listenPage(); }, 200);
    say(L === 'A' || L === 'B' ? 'Read the page. Tap a word if you need help.' : 'Read the page. Tap any word for help.');
    clearTimeout(helpTimer);
    if (autoHelp()) helpTimer = setTimeout(() => { if (page) $('rpHelp').classList.add('pulse'); }, info().help * 1000);
  }
  /* read the whole page aloud with each word lighting up */
  function pageHelp() {
    if (!page || !hasDom()) return;
    page.helped = true; $('rpHelp').classList.remove('pulse');
    const spans = [...$('rpText').querySelectorAll('.rw')];
    const text = spans.map(s => s.textContent).join(' ');
    const starts = []; let pos = 0; for (const s of spans) { starts.push(pos); pos += s.textContent.length + 1; }
    const light = (i) => spans.forEach((s, k) => s.classList.toggle('now', k === i));
    let boundary = false;
    say(text, { rate: .82, onboundary: (ci) => { boundary = true; let i = 0; while (i + 1 < starts.length && starts[i + 1] <= ci) i++; light(i); }, onend: () => light(-1) });
    const t0 = performance.now();
    const tick = () => { if (!page || boundary) return; const i = Math.floor((performance.now() - t0) / 520); if (i >= spans.length) { light(-1); return; } light(i); requestAnimationFrame(tick); };
    setTimeout(() => { if (!boundary) requestAnimationFrame(tick); }, 700);
    for (const s of spans) mark(s.dataset.w, 'help');
  }
  function pageNext() {
    if (!page) return;
    if (page.step === -1) {
      if (listen && listen.kind === 'page') finishListening();
      /* the child says they read it: count the words (as read, or as helped) */
      else for (const l of lines(page.key)) markText(l, page.helped ? 'help' : 'right');
      data.pages++; Bus.emit('readPage', page.key, data.pages);
      if (hasDom()) { $('rpMicRow').hidden = true; $('rpMic').hidden = true; }
    }
    page.step++;
    if (page.step >= page.tasks.length) return finishPage();
    runTask(page.tasks[page.step]);
  }
  function finishPage() {
    stopListening();
    const pg = page; page = null; clearTimeout(helpTimer);
    if (hasDom()) $('readPage').hidden = true;
    data.stars++; save();
    if (pg.opts.gate) { sfx('done'); say(level() <= 'B' ? 'Yes! You did it!' : 'Great reading! Now watch what happens.'); }
    if (pg.opts.onDone) pg.opts.onDone();
  }

  /* ---------- tasks ---------- */
  function taskSentence() {
    const max = info().buildMax, ls = lines(page.key).filter(l => tokenize(l).length <= max && tokenize(l).length >= 2);
    return (ls.length ? ls : lines(page.key)).slice().sort((a, b) => tokenize(b).length - tokenize(a).length)[0];
  }
  function taskDone(ok) {
    result(ok && page.firstTry);
    page.firstTry = true;
    setTimeout(pageNext, 650);
  }
  function taskWrong(el, word) { page.firstTry = false; if (word) mark(word, 'wrong'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } sfx('bump'); }
  const SAME_PIC = { caterpillar: ['jhang', 'skin'], jhang: ['caterpillar'], monarch: ['wings', 'tag'], tree: ['fir'], fir: ['tree'] };
  function runTask(kind) {
    const box = $('rpTask'); box.innerHTML = ''; box.hidden = false;
    $('rpNext').hidden = true; $('rpHelp').hidden = true; $('rpMic').hidden = true;
    const head = document.createElement('div'); head.className = 'rt-head'; box.appendChild(head);
    const L = level(), key = page.key, ch = READ_CHAPTERS[key];
    /* from C up, the page is put away during the task: the child works from reading, not copying */
    $('rpText').classList.toggle('put-away', L !== 'A' && L !== 'B');
    if (kind === 'match') {
      head.textContent = '🖼️ Which picture goes with the words?'; say('Which picture goes with the words?');
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, taskSentence(), { rebus: false }); box.appendChild(s);
      const pool = ['egg', 'caterpillar', 'chrysalis', 'monarch', 'milkweed', 'fir', 'sun', 'map', 'bird', 'pod'].filter(k => k !== ch.pic && !(SAME_PIC[ch.pic] || []).includes(k));
      const opts = [ch.pic, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const row = document.createElement('div'); row.className = 'rt-pics'; box.appendChild(row);
      for (const k of opts) { const b = document.createElement('button'); b.className = 'rt-pic'; b.appendChild(picture(k, 96)); b.addEventListener('click', () => { if (k === ch.pic) { b.classList.add('right'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
    } else if (kind === 'build') {
      head.textContent = '🧩 Put the words in order.'; say('Put the words in order.');
      const target = taskSentence(), toks = target.split(/\s+/);
      if (L === 'A' || L === 'B') { const m = document.createElement('p'); m.className = 'rt-model'; m.textContent = target; box.appendChild(m); }
      const slots = document.createElement('div'); slots.className = 'rt-slots'; box.appendChild(slots);
      const slotEls = toks.map(() => { const s = document.createElement('span'); s.className = 'rt-slot'; slots.appendChild(s); return s; });
      let shuffled = toks.map((t, i) => ({ t, i }));
      for (let n = 0; n < 5; n++) { shuffled.sort(() => Math.random() - .5); if (shuffled.some((x, k) => x.i !== k) || toks.length < 2) break; }
      const tiles = document.createElement('div'); tiles.className = 'rt-tiles'; box.appendChild(tiles);
      let next = 0;
      if (L !== 'A' && L !== 'B' && toks.length > 3) { slotEls[0].textContent = toks[0]; slotEls[0].classList.add('filled'); next = 1; shuffled = shuffled.filter(x => x.i !== 0); }
      for (const x of shuffled) {
        const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = x.t;
        b.addEventListener('click', () => {
          if (norm(x.t) === norm(toks[next])) { slotEls[next].textContent = toks[next]; slotEls[next].classList.add('filled'); b.disabled = true; b.classList.add('used'); next++; sfx('tile'); if (next >= toks.length) { markText(target, page.firstTry ? 'right' : 'help'); taskDone(true); } }
          else taskWrong(b, toks[next]);
        });
        tiles.appendChild(b);
      }
    } else if (kind === 'yesno') {
      head.textContent = '❓ Read the question. Yes or no?'; say('Read the question. Tap yes or no.');
      const qs = (ch.yesno || []).filter(q => offLevel(q[0], L).length === 0);
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Can a monarch fly?', true];
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, q, { onHelp: () => { page.firstTry = false; } }); box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-yesno'; box.appendChild(row);
      for (const v of [true, false]) { const b = document.createElement('button'); b.className = 'rt-yn ' + (v ? 'yes' : 'no'); b.textContent = v ? 'yes' : 'no'; b.addEventListener('click', () => { if (v === a) { b.classList.add('right'); markText(q, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
    } else if (kind === 'fill') {
      head.textContent = '✏️ Which word goes in the gap?'; say('Which word goes in the gap?');
      const sent = taskSentence(), toks = sent.split(/\s+/);
      let bi = toks.findIndex(t => PIC_NOUNS[norm(t)] && norm(t).length > 1);
      if (bi < 0) bi = toks.findIndex(t => norm(t).length > 3); if (bi < 0) bi = toks.length - 1;
      const answer = norm(toks[bi]);
      const pool = PIC_NOUNS[answer] ? Object.keys(PIC_NOUNS).filter(w => PIC_NOUNS[w] !== PIC_NOUNS[answer] && w.length > 2 && w !== 'texas' && w !== 'mexico') : ['fly', 'eat', 'hang', 'drink', 'hide', 'sleep', 'grow', 'sit', 'run', 'play', 'warm', 'cold', 'little', 'big', 'wiggle'].filter(w => w !== answer);
      const opts = [answer, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const s = document.createElement('p'); s.className = 'rt-sentence';
      toks.forEach((t, i) => { if (i === bi) { const g = document.createElement('span'); g.className = 'rt-gap'; g.textContent = '____'; s.appendChild(g); const punct = t.replace(/[a-z']/gi, ''); if (punct) s.appendChild(document.createTextNode(punct)); s.appendChild(document.createTextNode(' ')); } else renderWords(s, t, { rebus: false, onHelp: () => { page.firstTry = false; } }); });
      box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-tiles'; box.appendChild(row);
      for (const w of opts) { const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = w; b.addEventListener('click', () => { if (w === answer) { s.querySelector('.rt-gap').textContent = toks[bi].replace(/[^a-z']/gi, ''); s.querySelector('.rt-gap').classList.add('filled'); markText(sent, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b, answer); }); row.appendChild(b); }
    }
  }

  /* ---------- the microphone stays on while a panel is up ---------- */
  function SR() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  function stopListening() { if (!listen) return null; const l = listen; listen = null; clearInterval(l.stallTimer); const r = Listener.stop(); return Object.assign(r, { l }); }
  function micError(code) {
    const msg = { network: 'The microphone needs the internet. Read it, then tap "I read it!".', 'not-allowed': 'The microphone is switched off. A grown-up can allow it in the browser.', 'service-not-allowed': 'The microphone is switched off. A grown-up can allow it in the browser.', 'audio-capture': 'No microphone was found.', unsupported: 'This browser cannot listen. Try Chrome.', 'too-many-restarts': 'I stopped listening. Tap "I read it!" when you are done.' }[code] || 'I could not hear. Tap "I read it!" when you are done.';
    if (hasDom()) { if (listen && listen.kind === 'page') $('rpMsg').textContent = msg; if (listen && listen.kind === 'card') $('rcMic').textContent = '🎤 ' + msg; }
    if (listen) listen.failed = code;
  }
  function listenPage() {
    if (!page || !hasDom()) return;
    stopListening();
    const spans = [...$('rpText').querySelectorAll('.rw')], expected = spans.map(s => s.dataset.w);
    listen = { kind: 'page', key: page.key, spans, expected, got: new Set(), next: 0, lastProgress: performance.now(), helpedIdx: new Set(), t0: performance.now(), prompted: -1 };
    const L = listen;
    $('rpMicRow').hidden = false; $('rpMic').hidden = !SR() || micOn(); $('rpMic').textContent = '🎤 Listening…'; $('rpMic').classList.add('listening');
    $('rpMsg').textContent = '';
    const paint = () => {
      spans.forEach((s, i) => { s.classList.toggle('heard', L.got.has(i)); s.classList.toggle('next', i === L.next && L.next < spans.length); });
      $('rpHeard').textContent = `I heard ${L.got.size} of ${spans.length} words`;
      if (L.got.size >= spans.length && !L.allDone) { L.allDone = true; $('rpMsg').textContent = '⭐ I heard every word! Tap "I read it!"'; $('rpNext').classList.add('pulse'); sfx('good'); }
    };
    paint();
    Listener.start({
      expected, record: Gm.settings.readSave !== false,
      onHeard: (heard) => {
        const got = align(expected, heard);
        let moved = false;
        for (const i of got) if (!L.got.has(i)) { L.got.add(i); moved = true; }
        const nx = L.got.size ? Math.max(...L.got) + 1 : 0;
        if (moved) { L.lastProgress = performance.now(); spans.forEach(s => s.classList.remove('stuck')); }
        L.next = Math.max(L.next, nx);
        paint();
      },
      onLevel: (v) => { $('rpMeter').style.width = (8 + v * 92) + '%'; },
      onError: micError
    });
    /* stuck on a word for a while: light it up, and read it if help comes by itself */
    L.stallTimer = setInterval(() => {
      if (listen !== L || L.next >= spans.length || L.failed) return;
      const waited = (performance.now() - L.lastProgress) / 1000;
      if (waited > info().help * .7 && L.prompted !== L.next) {
        L.prompted = L.next; const s = spans[L.next]; s.classList.add('stuck');
        if (autoHelp()) { say(s.dataset.w, { rate: .75 }); mark(s.dataset.w, 'help'); L.helpedIdx.add(L.next); page.helped = true; }
      }
    }, 500);
  }
  /* "I read it!" was tapped while listening: keep a running record */
  function finishListening() {
    const r = stopListening(); if (!r) return;
    const L = r.l, total = L.spans.length, helped = new Set([...L.helpedIdx, ...L.spans.map((s, i) => s.classList.contains('helped') ? i : -1).filter(i => i >= 0)]);
    L.spans.forEach((s, i) => { if (L.got.has(i) && !helped.has(i)) mark(s.dataset.w, 'right'); else if (helped.has(i)) mark(s.dataset.w, 'help'); });
    const heardN = L.got.size, secs = Math.max(1, (performance.now() - L.t0) / 1000);
    const acc = heardN / total;
    const rec = { when: Date.now(), key: L.key, level: level(), total, heard: heardN, helped: helped.size, acc: +acc.toFixed(2), wpm: Math.round(heardN / (secs / 60)), secs: Math.round(secs), mic: !L.failed, missed: L.spans.filter((s, i) => !L.got.has(i)).map(s => s.dataset.w).slice(0, 12) };
    if (!L.failed) result(acc >= .8 && helped.size === 0);
    if (!L.failed && acc >= .75) Bus.emit('readAloud', L.key);
    data.records = (data.records || []).concat(rec).slice(-40);
    save();
    if (Gm.settings.readSave !== false) r.blob.then((b) => { if (!b) return; const k = 'take:' + rec.when; Takes.put(k, b); rec.take = k; const old = (data.records || []).filter(x => x.take); if (old.length > 20) { Takes.del(old[0].take); delete old[0].take; } save(); });
    if (hasDom()) { $('rpMic').classList.remove('listening'); $('rpNext').classList.remove('pulse'); }
  }
  function listenCard() {
    if (!card || !hasDom()) return;
    stopListening();
    const c = card, words = c.choices.map(t => tokenize(t));
    listen = { kind: 'card', used: 0 };
    const L = listen;
    $('rcMic').textContent = c.choices.length && words.every(w => w.length === 1) ? '🎤 Say the word!' : '🎤 Read your choice out loud!';
    Listener.start({
      expected: [...new Set(words.flat())],
      onHeard: (heard) => {
        if (listen !== L || card !== c) return;
        const fresh = heard.slice(L.used); if (!fresh.length) return;
        let best = -1, bestScore = 0;
        words.forEach((cw, i) => { const sc = align(cw, fresh).length / cw.length; if (sc > bestScore) { bestScore = sc; best = i; } });
        if (best >= 0 && bestScore >= (words[best].length === 1 ? 1 : .7)) { L.used = heard.length; chooseCard(best); }
      },
      onError: micError
    });
  }
  function micRead() { if (!page || (listen && listen.kind === 'page')) return; listenPage(); }

  /* ---------- missions ---------- */
  function topY() { const P = Gm.plant; return P && P.flowers.length ? Math.min(...P.flowers.map(f => f.y)) : (P ? P.bounds.top + 200 : -800); }
  function who(p) {
    const G = Gm, out = new Set();
    if (G.mode === 'milkweed') {
      if (p.state === 'larva' && !p.readyFlag) out.add('larva');
      if (p.stage === 7 && (p.state === 'adult' || p.state === 'flying') && !p.readyFlag) out.add('plant');
      if (p.state === 'flying') out.add('flying');
      if (p.stage === 7 && (p.state === 'adult' || p.state === 'flying') && G.plant.pods.some(pd => !pd.burst)) out.add('pods');
    } else if (G.mode === 'route' && p.state === 'migrating' && G.route) {
      const R = G.route, dusk = R.diff.night && (G.tod > .7 || (G.night || 0) > .2);
      if (dusk) out.add('dusk');
      else {
        out.add('route');
        if (p.energy < .85 && R.nectar.some(n => n.x > p.x && n.x < p.x + 3500 && n.nectar > .3)) out.add('nectar');
        if (R.thermals.some(t => t.x > p.x && t.x < p.x + 3000)) out.add('thermal');
      }
    }
    return out;
  }
  function eligible(p) {
    const G = Gm, can = who(p), L = READ_LEVELS.indexOf(level());
    return MISSIONS.filter(m => {
      if (m.key === lastMission || !can.has(m.who) || !m[level()]) return false;
      if (m.min && READ_LEVELS.indexOf(m.min) > L) return false;
      if (m.key === 'ants' && !(G.ants && G.ants.enabled && G.ants.list.length)) return false;
      if (m.key === 'bugs' && !(G.aphids && G.aphids.list.length)) return false;
      if (m.key === 'up' && p.y < topY() + 300) return false;
      if (m.key === 'down' && p.y > -300) return false;
      if (m.key === 'top' && p.y < topY() + 100) return false;
      if (m.key === 'high' && p.y < -550) return false;
      if (m.key === 'low' && p.y > -250) return false;
      if (m.key === 'flock' && !(G.route && G.route.flock.length >= 4)) return false;
      return true;
    });
  }
  function baseFor(m, p) {
    switch (m.key) {
      case 'eat3': return p.total;
      case 'drink': case 'nectar': return p.stats.sips;
      case 'pod': return Gm.plant ? Gm.plant.pods.filter(pd => pd.burst).length : 0;
      case 'thermal': return p.stats.thermals;
      case 'leaf': { const lf = p.onLeaf && p.state === 'larva' ? p.onLeaf() : null; return lf ? lf.id : -1; }
    }
    return 0;
  }
  function checkMission(m, p, base = mission ? mission.base : 0) {
    const G = Gm, P = G.plant, near = (x, y, r) => dist(p.x, p.y, x, y) < r;
    switch (m.key) {
      case 'leaf': { const lf = p.state === 'larva' ? p.onLeaf() : null; return !!lf && !lf.skeleton && lf.id !== base && p.t > (lf.petiole || 0) + .1; }
      case 'eat3': return p.total >= base + 3;
      case 'down': return p.state === 'larva' && p.y > -170;
      case 'up': return (p.state === 'larva' || p.state === 'adult') && p.y < topY() + 170;
      case 'ants': return !!G.ants && G.ants.list.some(a => near(a.x, a.y, 110));
      case 'bugs': return !!G.aphids && G.aphids.list.some(a => near(a.x, a.y, 100));
      case 'still': { const lf = p.state === 'larva' ? p.onLeaf() : null; return !!lf && p.t > .3 && !p.moving && !p.route; }
      case 'drink': case 'nectar': return p.stats.sips > base;
      case 'pod': return !!P && P.pods.filter(pd => pd.burst).length > base;
      case 'top': return p.state === 'flying' && p.y < topY() - 60;
      case 'land': return p.state === 'adult' && !!p.onLeaf();
      case 'high': return p.onRoute() && p.y < -650;
      case 'low': return p.state === 'migrating' && p.y > -150;
      case 'thermal': return p.stats.thermals > base;
      case 'flock': return !!G.route && G.route.flock.filter(f => near(f.x, f.y, 190)).length >= 2;
      case 'tree': return p.state === 'roosting';
    }
    return false;
  }
  function startMission(p, forced) {
    const list = forced ? MISSIONS.filter(m => m.key === forced) : eligible(p); if (!list.length) return;
    const m = list[(Math.random() * list.length) | 0];
    mission = { m, t: 0, helped: false, mode: Gm.mode, base: baseFor(m, p) };
    lastMission = m.key;
    if (!hasDom()) return mission;
    const box = $('mcText'); box.innerHTML = ''; renderWords(box, m[level()] || m.E, { onHelp: () => { mission.helped = true; } });
    $('missionCard').hidden = false; $('missionCard').classList.remove('done');
    sfx('tile');
    clearTimeout(hintSayTimer);
    if (autoHelp()) hintSayTimer = setTimeout(() => { if (mission && mission.m === m) missionHelp(); }, info().help * 1000 * 1.5);
    return mission;
  }
  function missionHelp() { if (!mission) return; mission.helped = true; const t = mission.m[level()] || mission.m.E; say(t, { rate: .85 }); markText(t, 'help'); }
  function endMission(cool) { mission = null; missionCool = cool; clearTimeout(hintSayTimer); if (hasDom()) $('missionCard').hidden = true; }
  function finishMission() {
    const ms = mission; mission = null; missionCool = 30; clearTimeout(hintSayTimer);
    const text = ms.m[level()] || ms.m.E;
    markText(text, ms.helped ? 'help' : 'right'); result(!ms.helped);
    data.missions++; data.stars++; save();
    Bus.emit('missionDone', ms.m.key, data.missions);
    const p = Gm.players[0];
    if (p && Gm.particles) { Gm.particles.sparkle(p.x, p.y - 20, 26, '#ffe27a', 30); Gm.particles.text(p.x, p.y - 50, '⭐', '#ffe27a', 26); }
    sfx('good');
    say(ms.helped ? 'You did it!' : 'You read it and you did it!');
    if (hasDom()) { $('missionCard').classList.add('done'); setTimeout(() => { if (!mission) $('missionCard').hidden = true; }, 1600); }
  }

  /* ---------- per frame (not while a panel is up) ---------- */
  const FREE = ['larva', 'adult', 'flying', 'migrating'];
  function update(dt) {
    if (!Gm) return;
    for (const k in auto) auto[k] = Math.max(0, auto[k] - dt);
    const show = on() && Gm.started;
    if (!show) { if (mission) endMission(20); storyQueue.length = 0; return; }
    const quiet = !card && !page && !(typeof Cinematic !== 'undefined' && Cinematic.active);
    if (storyQueue.length && quiet) { showPage(storyQueue.shift()); return; }
    const p = Gm.players[0]; if (!p) return;
    if (!mission) { missionCool -= dt; if (missionCool <= 0 && quiet && FREE.includes(p.state)) startMission(p); return; }
    if (mission.mode !== Gm.mode) { endMission(10); return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) { missionClock = .4; if (checkMission(mission.m, p)) finishMission(); else if (mission.t > 150) endMission(10); }
  }

  /* ---------- keys while a card or page is open ---------- */
  function keydown(e) {
    if (!card && !page) return false;
    const k = e.key;
    if (card) {
      if (/^[1-4]$/.test(k)) { chooseCard(+k - 1); e.preventDefault(); return true; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { focus = (focus + card.choices.length - 1) % card.choices.length; refocus(); e.preventDefault(); return true; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { focus = (focus + 1) % card.choices.length; refocus(); e.preventDefault(); return true; }
      if ((k === ' ' || k === 'Enter') && !e.repeat) { chooseCard(focus); e.preventDefault(); return true; }
      if (k === 'h' || k === 'H' || k === '?') { cardHelp(); return true; }
      if (k === 'Escape') { closeCard(); return true; }
      if (k === ' ' || k === 'Enter') e.preventDefault();
      return true;
    }
    if (page) { if ((k === ' ' || k === 'Enter') && page.step === -1 && !e.repeat) pageNext(); if (k === ' ' || k === 'Enter' || k.startsWith('Arrow')) e.preventDefault(); return true; }
    return false;
  }

  /* ---------- hints at the child's level ---------- */
  function hintText(key) { if (!on()) return null; const h = READ_HINTS[key]; return h ? h[level()] : null; }

  /* ---------- My Words ---------- */
  function openWords() {
    if (!hasDom()) return;
    const grid = $('wordsGrid'); grid.innerHTML = '';
    const list = Object.entries(data.words).sort((a, b) => (b[1].r - a[1].r) || a[0].localeCompare(b[0]));
    let known = 0;
    for (const [w, s] of list) {
      const m = mastery(s); if (m === 'known') known++;
      const b = document.createElement('button'); b.className = 'wcard ' + m; b.textContent = w === 'i' ? 'I' : w === 'j' ? 'J' : w;
      b.title = `read ${s.r} · helped ${s.h} · missed ${s.w}`;
      b.addEventListener('click', () => say(w === 'j' ? 'J' : w, { rate: .8 }));
      grid.appendChild(b);
    }
    if (!list.length) grid.innerHTML = '<p class="tiny">No words yet. Pick "I read to play" in settings and start reading!</p>';
    $('wordsCount').textContent = `${known} known · ${list.length} met`;
    $('myWords').hidden = false;
  }
  function report() {
    const list = Object.entries(data.words);
    const known = list.filter(([, s]) => mastery(s) === 'known').map(([w]) => w);
    const tricky = list.filter(([, s]) => mastery(s) === 'tricky').sort((a, b) => (b[1].w + b[1].h) - (a[1].w + a[1].h)).map(([w]) => w);
    const acc = accuracy(), L = level(), i = READ_LEVELS.indexOf(L);
    const suggest = acc === null || data.recent.length < 10 ? `Keep playing at ${L}; not enough reading yet to suggest a change.` : acc >= .9 ? `Reading ${Math.round(acc * 100)}% without help: ready to try ${READ_LEVELS[Math.min(4, i + 1)]}.` : acc < .6 ? `Reading ${Math.round(acc * 100)}% without help: ${i > 0 ? 'try ' + READ_LEVELS[i - 1] + ' for a while' : 'stay at A and use help freely'}.` : `Reading ${Math.round(acc * 100)}% without help: ${L} is a good fit.`;
    return { level: L, mode: Gm.settings.readMode, accuracy: acc, known, tricky, pages: data.pages, missions: data.missions, cards: data.cards, stars: data.stars, suggest, met: list.length };
  }
  /* the grown-up corner: the reading report and the running records */
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function openGrownup() {
    if (!hasDom()) return;
    const r = report();
    $('readReport').innerHTML = `<div><b>Mode:</b> ${r.mode === 'play' ? 'I read to play' : 'Read to me'} · <b>Level:</b> ${r.level}${Gm.settings.readAuto ? ' (auto)' : ''}</div>
      <div><b>Without help, lately:</b> ${r.accuracy === null ? 'not enough reading yet' : Math.round(r.accuracy * 100) + '%'} · <b>Pages:</b> ${r.pages} · <b>Missions:</b> ${r.missions} · <b>Word cards:</b> ${r.cards}</div>
      <div><b>Suggestion:</b> ${esc(r.suggest)}</div>
      <div><b>Words known (${r.known.length} of ${r.met}):</b></div><div class="words">${r.known.slice(0, 60).map(w => `<span>${esc(w)}</span>`).join('') || '—'}</div>
      <div><b>Tricky words to practise:</b></div><div class="words">${r.tricky.slice(0, 30).map(w => `<span>${esc(w)}</span>`).join('') || '—'}</div>`;
    const recs = (data.records || []).slice().reverse();
    const box = $('readRecords'); box.innerHTML = '';
    if (!recs.length) box.innerHTML = '<p class="tiny">Switch on "Microphone on while I read" in settings. Each page read out loud will be listed here with how many words were heard, how fast, and what needed help.</p>';
    for (const x of recs) {
      const row = document.createElement('div'); row.className = 'rrow';
      const d = new Date(x.when), title = (READ_CHAPTERS[x.key] && READ_CHAPTERS[x.key].title) || x.key;
      row.innerHTML = `<span class="rdate">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><b>${esc(title)}</b><span>Level ${esc(x.level)}</span><span class="${x.acc >= .9 ? 'good' : x.acc >= .75 ? 'ok' : 'low'}">${x.mic ? Math.round(x.acc * 100) + '% heard' : 'mic off'}</span><span>${x.mic ? x.wpm + ' words/min' : ''}</span><span>${x.helped ? x.helped + ' helped' : 'no help'}</span><span class="missed">${x.missed && x.missed.length && x.mic ? 'not heard: ' + x.missed.map(esc).join(', ') : ''}</span>`;
      if (x.take) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = '▶ Listen'; b.addEventListener('click', () => Takes.play(x.take)); row.appendChild(b); }
      box.appendChild(row);
    }
    $('grownup').hidden = false;
  }
  /* every picture the reading uses, for checking the art (debug: ?readpics=1) */
  function openPictures() {
    if (!hasDom()) return;
    const grid = $('wordsGrid'); grid.innerHTML = '';
    const keys = [...new Set(Object.values(PIC_NOUNS))];
    for (const k of keys) { const d = document.createElement('div'); d.className = 'wpic'; d.appendChild(picture(k, 90)); const s = document.createElement('span'); s.textContent = k; d.appendChild(s); grid.appendChild(d); }
    $('wordsCount').textContent = keys.length + ' pictures';
    $('myWords').hidden = false;
  }

  /* ---------- wiring ---------- */
  function init(game, callbacks = {}) {
    Gm = game; cb = callbacks; load();
    /* the growth steps wait for a page to be read */
    if (typeof Monarch !== 'undefined' && !Monarch.prototype._readWrapped) {
      Monarch.prototype._readWrapped = true;
      const wrap = (name, chapter) => {
        const orig = Monarch.prototype[name];
        Monarch.prototype[name] = function (...a) {
          if (!on() || this.id !== 1) return orig.apply(this, a);
          if (this._gateWait) return;
          const key = typeof chapter === 'function' ? chapter(this) : chapter;
          this._gateWait = key;
          gate(this, key, () => { this._gateWait = null; orig.apply(this, a); });
        };
      };
      wrap('startMolt', (p) => 'instar' + (p.stage + 1));
      wrap('beginJ', 'hang');
      wrap('eclose', 'butterfly');
    }
    if (!hasDom()) return;
    $('rpNext').addEventListener('click', pageNext);
    $('rpHelp').addEventListener('click', pageHelp);
    $('rpMic').addEventListener('click', micRead);
    $('rcHelp').addEventListener('click', cardHelp);
    $('rcBack').addEventListener('click', () => { if (card) closeCard(); });
    $('mcHelp').addEventListener('click', missionHelp);
    $('wordsClose').addEventListener('click', () => { $('myWords').hidden = true; });
    $('grownupClose').addEventListener('click', () => { $('grownup').hidden = true; });
  }
  /* test hooks (smoke.js) */
  function _solveGate() { if (page) { const pg = page; page = null; data.pages++; if (pg.opts.onDone) pg.opts.onDone(); return true; } if (pendingGate) { const g = pendingGate; pendingGate = null; g.cont(); return true; } return false; }

  return { init, on, level, setLevel, context, intercept, update, gate, story, showPage, chooseCard, keydown, hintText, openWords, openGrownup, openPictures, report, accuracy,
    listening: () => !!listen, records: () => (data.records || []).slice(), _listen: () => listen,
    cardOpen: () => !!card, pageOpen: () => !!page, busy: () => !!card || !!page, stats: () => data, choicesFor, eligible, checkMission, startMission, mission: () => mission,
    _missionNow: () => { missionCool = 0; }, _solveGate, _card: () => card, _page: () => page };
})();
