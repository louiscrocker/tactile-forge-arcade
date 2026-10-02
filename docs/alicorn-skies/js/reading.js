/* ============================================================
   reading.js — Read to Play (ported from Frog Pond, see README)
   ============================================================
   When the reading mode is "Read to play", reading is how the
   game is played:

   ACTION CARDS  MAGIC, FLY (taking off), DASH and diving no
                 longer act by themselves.  They open a card of
                 words at the child's level; tapping the word that
                 fits the moment ("wake up" by a sleepy flower,
                 "talk" by a friend with a "!", "fly" on the ground)
                 makes the alicorn do it, and the action stays
                 unlocked for a few seconds (longer while it keeps
                 being used) so play stays fluid.
   READ TO GROW  After each quest, the next quest waits for a
                 leveled page to be read and its task done: match a
                 picture (A), build the sentence (B, C), answer
                 yes/no (C+), fill the gap (D, E).  The foal's two
                 growth steps wait for a page too.
   MISSIONS      "Fly to the castle."  The sentence is shown, not
                 spoken; going there proves it was understood.
   HELP          Any word can be tapped to hear it.  Help comes by
                 itself after a delay if the grown-up allows it.
                 Two wrong taps and the answer glows and is read.
                 Help is recorded; nothing is ever lost.
   TRACKING      Every word: right (unaided), wrong, helped.  The
                 level can adjust itself.  My Words shows mastery;
                 the settings drawer has a reading report.
   ============================================================ */
'use strict';

const Reading = (function () {
  const $ = (id) => (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  const hasDom = () => !!$('readCard');
  const KEY = 'alicorn.reading';
  let Gm = null, cb = {};
  let data = { words: {}, recent: [], stars: 0, pages: 0, missions: 0, cards: 0, levelUps: 0, aloud: 0 };
  let card = null, page = null, mission = null, missionCool = 25, missionClock = 0, lastMission = null, cardCool = 0;
  const unlocked = {}, auto = { fly: 0, dive: 0 };
  const queue = [];
  let helpTimer = null, hintSayTimer = null, focus = 0, rec = null, passNext = false;
  const counts = { jump: 0, sit: 0, flower: 0 };

  const load = () => { try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* fine */ } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* fine */ } };

  function on() { return !!Gm && Gm.settings.readMode === 'play'; }
  function level() { const L = Gm && Gm.settings.readLevel; return READ_LEVELS.includes(L) ? L : 'B'; }
  function info() { return LEVEL_INFO[level()]; }
  function autoHelp() { return Gm.settings.readHelp !== 'ask'; }
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z']/g, '');
  const say = (t, o = {}) => { if (typeof Voice !== 'undefined') Voice.say(t, Object.assign({ interrupt: true, force: true, speaker: 'narrator' }, o)); };
  const fx = (name, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[name]) AudioFX[name](...a); };
  /* {me} and {foal} become the alicorn's and the foal's names */
  function fill(text) {
    const me = Gm && Gm.player ? Gm.player.look.name : 'me', foal = Gm && Gm.foal && Gm.foal.name ? Gm.foal.name : 'my foal';
    return String(text).replace(/\{me\}/g, me).replace(/\{foal\}/g, foal);
  }

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

  /* ---------- pictures for words (rebus) and choices ---------- */
  function drawCustom(key, ctx) {
    switch (key) {
      case 'horn': { const g = ctx.createLinearGradient(-10, 30, 10, -40); g.addColorStop(0, '#f5c542'); g.addColorStop(1, '#fff6c8'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, 34); ctx.lineTo(0, -42); ctx.lineTo(14, 34); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(200,140,40,.8)'; ctx.lineWidth = 2.5; for (let i = 0; i < 4; i++) { const y = 26 - i * 16, w = 12 - i * 2.6; ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y - 7); ctx.stroke(); } break; }
      case 'castle': ctx.translate(0, 38); ctx.scale(.15, .15); Sprites.drawCastle(ctx, { x: 0, y: 0 }, 0, 0); break;
      case 'tree': { const t = (Gm.world.trees || []).find(t => t.kind !== 'pine' && !t.back) || Gm.world.trees[0]; if (t) { ctx.translate(0, 44); const s = .42 / (t.s || 1); ctx.scale(s, s); Sprites.drawTree(ctx, t, 0, 0, 'summer'); } break; }
      case 'fish': ctx.scale(3.2, 3.2); Sprites.drawSwimFish(ctx, '#ff9a3c', 0); break;
      case 'bird': ctx.scale(3, 3); Sprites.drawBird(ctx, { s: 1, flap: 0, col: '#8fd0ff' }); break;
      case 'bow': Sprites.bow(ctx, 0, 0, 30, '#ff6fae'); break;
      case 'pearl': { const g = ctx.createRadialGradient(-8, -8, 3, 0, 0, 26); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d4f0'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); break; }
      case 'mountain': ctx.fillStyle = '#9a8cc0'; ctx.beginPath(); ctx.moveTo(-44, 34); ctx.lineTo(-6, -36); ctx.lineTo(40, 34); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-17, -16); ctx.lineTo(-6, -36); ctx.lineTo(6, -14); ctx.lineTo(-2, -18); ctx.lineTo(-9, -12); ctx.closePath(); ctx.fill(); ctx.lineWidth = 5; RAINBOW.slice(0, 5).forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(10, 30, 50 - i * 5, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke(); }); break;
      case 'ice': ctx.fillStyle = '#dff2fb'; ctx.fillRect(-38, -12, 76, 26); ctx.strokeStyle = '#8ab8d0'; ctx.lineWidth = 2; ctx.strokeRect(-38, -12, 76, 26); ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-8, 2); ctx.lineTo(4, -4); ctx.lineTo(18, 14); ctx.stroke(); break;
    }
  }
  const CUSTOM = new Set(['horn', 'castle', 'tree', 'fish', 'bird', 'bow', 'pearl', 'mountain', 'ice']);
  const ICON_ALIAS = { wings: 'flight' };
  function picture(key, px) {
    if (typeof document === 'undefined') return null;
    if (CUSTOM.has(key)) {
      const c = document.createElement('canvas'); c.width = c.height = px * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); ctx.scale(px / 100, px / 100);
      try { drawCustom(key, ctx); } catch (e) { /* a picture is never worth a crash */ }
      c.style.width = c.style.height = px + 'px'; return c;
    }
    const kind = ICON_ALIAS[key] || key;
    const look = key === 'foal' && Gm.foal && Gm.foal.look ? Gm.foal.look : Gm.player ? Gm.player.look : DEFAULT_LOOK;
    return Sprites.iconEl(kind, look, px);
  }
  function picFor(tok) { const raw = String(tok).replace(/[^A-Za-z']/g, ''); return NAME_PICS[raw] || PIC_NOUNS[norm(raw)] || null; }

  /* render a line of text as tappable words (with rebus pictures at A and B) */
  function renderWords(el, text, opts = {}) {
    for (const tok of fill(text).split(/\s+/)) {
      if (!tok) continue;
      const w = norm(tok);
      const span = document.createElement('span'); span.className = 'rw'; span.textContent = tok; span.dataset.w = w;
      span.addEventListener('click', (e) => { e.stopPropagation(); say(w, { rate: .75 }); mark(w, 'help'); if (opts.onHelp) opts.onHelp(w); span.classList.add('helped'); });
      el.appendChild(span);
      const pk = picFor(tok);
      if (info().rebus && pk && opts.rebus !== false) { const pic = picture(pk, 38); if (pic) { pic.classList.add('rebus'); el.appendChild(pic); } }
      el.appendChild(document.createTextNode(' '));
    }
  }

  /* ---------- what the alicorn could do right now ---------- */
  /* which magic the horn would do here: mirrors Alicorn.update and World.magicTargetDist */
  function magicVerb(p) {
    const G = Gm, W = G.world;
    const f = G.friends.nearest(p.x, p.y - 20, 170);
    const fd = f ? dist(f.x, f.y - 20, p.x, p.y - 20) : Infinity;
    const hx = p.x + p.dir * 48, hy = p.y - 74;
    const md = W.magicTargetDist(hx, hy);
    const canTalk = p.state === 'ground' || p.state === 'swim';
    if (f && (canTalk || f.state === 'following') && Quests.bubble(f.key)) return 'talk';
    if (G.foal && G.foal.adopted && canTalk && G.foal.near(p, 150) && md > 120) return 'hug';
    if (f && canTalk && fd < md) return 'talk';
    const range = (G.settings.difficulty === 'easy' ? 240 : 175) + 60;
    let best = 'magic', bd = range;
    const consider = (d, verb) => { if (d < bd) { bd = d; best = verb; } };
    for (const o of W.flowers) if (o.sleepy) consider(dist(o.x, o.y - 10, hx, hy), 'wake');
    for (const o of W.crystals) if (!o.litTarget) consider(dist(o.x, o.y - 20, hx, hy), 'glow');
    for (const o of W.fallen) if (o.state === 'down') consider(dist(o.x, o.y, hx, hy), 'lift');
    for (const o of W.stormClouds) if (!o.happy) consider(dist(o.x, o.y, hx, hy) - o.r, 'cheer');
    for (const o of W.shells) if (o.state === 'closed') consider(dist(o.x, o.y, hx, hy), 'open');
    for (const o of W.apples) if (o.state === 'hang') consider(dist(o.x, o.y, hx, hy) + 40, 'apples');
    if (G.foal && G.foal.state === 'lost' && dist(G.foal.x, G.foal.y - 30, hx, hy) < range) best = 'hug';
    return best;
  }
  function context(p, which) {
    if (which === 'fly') return p.state === 'ground' ? 'fly' : null;
    if (which === 'dash') return 'dash';
    if (which === 'dive') return 'dive';
    return magicVerb(p);
  }
  /* reading waits while something else is already in charge */
  function busyElsewhere(p) {
    return (p && p.talking) || !!Dialog.active || !!Cinematic.active || (typeof Race !== 'undefined' && Race.active());
  }

  /* ---------- action cards ---------- */
  function choicesFor(verb) {
    const L = level(), n = info().choices, correct = ACTION_TEXT[verb][L];
    const pool = [...new Set(Object.keys(ACTION_TEXT).map(k => ACTION_TEXT[k][L]))].filter(t => t !== correct && norm(t) !== norm(correct));
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
    $('readCard').hidden = false;
    $('rcPrompt').textContent = CARD_PROMPT[level()];
    const pic = $('rcPic'); pic.innerHTML = '';
    let pk = ACTION_PIC[verb];
    if (verb === 'talk') { const f = Gm.friends.nearest(p.x, p.y - 20, 170); if (f) pk = f.key === 'puff' ? 'lamb' : f.def.kind; }
    const el = picture(pk, 64); if (el) pic.appendChild(el);
    const box = $('rcChoices'); box.innerHTML = '';
    choices.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'rc-word' + (t.length > 12 ? ' long' : '');
      b.innerHTML = `<small>${i + 1}</small>`; const s = document.createElement('span'); s.textContent = t; b.appendChild(s);
      b.addEventListener('click', () => chooseCard(i));
      box.appendChild(b);
    });
    focus = 0; refocus();
    say(CARD_PROMPT[level()]);
    clearTimeout(helpTimer);
    if (autoHelp()) helpTimer = setTimeout(() => cardHelp(), info().help * 1000);
    return card;
  }
  function refocus() { if (!hasDom()) return; [...$('rcChoices').children].forEach((b, i) => b.classList.toggle('focus', i === focus)); }
  /* how long a few words take to say (the voice here has no "finished" callback) */
  const sayMs = (t, rate = .8) => 500 + tokenize(t).length * 420 / rate;
  /* read every choice aloud, one at a time: the child can then pick by listening */
  function cardHelp() {
    if (!card || !hasDom()) return;
    const c = card; c.helped = true;
    const btns = [...$('rcChoices').children];
    let i = 0;
    const next = () => {
      if (card !== c || i >= btns.length) { btns.forEach(b => b.classList.remove('saying')); return; }
      btns.forEach((b, k) => b.classList.toggle('saying', k === i));
      say(c.choices[i], { rate: .8 });
      setTimeout(next, sayMs(c.choices[i]) + 250); i++;
    };
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
      if (Gm.particles && c.p) { Gm.particles.sparkle(c.p.x, c.p.y - 40, 14, '#fff3b0', 18); Gm.particles.text(c.p.x, c.p.y - 80, pick.length < 14 ? pick : '✓', '#fff3b0', 16); }
      if (clean) fx('sticker');
      Bus.emit('readCard', c.verb, clean);
      c.onOk && c.onOk();
      return true;
    }
    c.tries++; markText(c.correct, 'wrong');
    if (hasDom()) { const b = $('rcChoices').children[i]; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    fx('cloudBump');
    if (c.tries >= 2) {
      c.helped = true;
      if (hasDom()) [...$('rcChoices').children].forEach((b, k) => b.classList.toggle('glow', c.choices[k] === c.correct));
      say(c.correct, { rate: .8 });
    } else say('Try again.');
    return false;
  }
  function closeCard() { card = null; cardCool = .6; clearTimeout(helpTimer); if (hasDom()) $('readCard').hidden = true; }

  /* the alicorn does what was read, and the action stays unlocked for a little while */
  function grant(p, verb) {
    unlocked[verb] = Gm.time + info().window;
    passNext = true;
    switch (verb) {
      case 'fly': auto.fly = .9; p.input.flyPressed = true; break;
      case 'dash': p.input.dashPressed = true; break;
      case 'dive': auto.dive = .6; break;
      default: p.input.magicPressed = true;
    }
  }

  /* called every frame after input is gathered (player 1 only) */
  function intercept(p) {
    if (!on() || !p || p.id !== 1 || card || page) return;
    const t = Gm.time, inp = p.input, W = Gm.world;
    /* flying keeps "fly" unlocked; so does using an action again */
    if (p.state === 'air' && unlocked.fly > t - 1) unlocked.fly = Math.max(unlocked.fly, t + info().window);
    if (auto.fly > 0) { inp.fly = true; }
    if (auto.dive > 0) { inp.y = 1; inp.x = 0; }
    if (passNext) { passNext = false; return; }
    if (busyElsewhere(p)) return;
    const ask = (verb) => { if (cardCool > 0) return; openCard(p, verb, () => grant(p, verb)); };
    if (inp.magicPressed && p.magicCd <= 0) {
      const verb = context(p, 'magic');
      if (!(unlocked[verb] > t)) { inp.magicPressed = false; ask(verb); return; }
      unlocked[verb] = t + info().window;
    }
    if (p.state === 'ground') {
      if (inp.flyPressed && !(unlocked.fly > t)) { inp.flyPressed = false; inp.fly = false; ask('fly'); return; }
      /* holding FLY on the ground only takes off once "fly" has been read */
      if (!(unlocked.fly > t)) inp.fly = false;
      const onWater = p.surface && p.surface.kind === 'water';
      if (onWater && inp.y > .6 && W.canDive(p.x) && !(unlocked.dive > t)) { inp.y = 0; ask('dive'); return; }
    }
    if (inp.dashPressed && p.dashT <= 0 && p.sparkle >= .25) {
      if (!(unlocked.dash > t)) { inp.dashPressed = false; ask('dash'); return; }
      unlocked.dash = t + info().window;
    }
  }
  /* the touch buttons show a book while an action waits for reading */
  function locked(which) {
    if (!on() || !Gm.player) return false;
    const p = Gm.player, t = Gm.time;
    if (which === 'fly') return p.state === 'ground' && !(unlocked.fly > t);
    if (which === 'dash') return !(unlocked.dash > t);
    if (which === 'magic') return !Dialog.active && !(unlocked[magicVerb(p)] > t);
    return false;
  }

  /* ---------- pages (read to go on, and story pages) ---------- */
  function lines(key) { return READ_CHAPTERS[key][level()].map(fill); }
  /* pages wait politely until nothing else is on screen */
  function enqueue(key, opts = {}) {
    if (!READ_CHAPTERS[key]) { opts.onDone && opts.onDone(); return; }
    if (queue.some(q => q.key === key)) return;
    queue.push({ key, opts });
  }
  function gate(key, cont) { enqueue(key, { gate: true, onDone: cont }); }
  function canShowNow() {
    if (card || page || !Gm.started) return false;
    if (busyElsewhere(Gm.player)) return false;
    if (typeof UI !== 'undefined' && UI.anyModalOpen()) return false;
    return true;
  }
  function showPage(key, opts = {}) {
    const ch = READ_CHAPTERS[key]; if (!ch) return;
    page = { key, opts, helped: false, tasks: opts.gate ? info().tasks.slice() : [], step: -1, firstTry: true };
    if (!hasDom()) return;
    const L = level();
    $('rpLevel').textContent = LEVEL_INFO[L].name;
    $('rpTitle').textContent = ch.title || '';
    const pic = $('rpPic'); pic.innerHTML = ''; const el = picture(ch.pic, 110); if (el) pic.appendChild(el);
    const box = $('rpText'); box.innerHTML = '';
    for (const line of lines(key)) { const p = document.createElement('p'); p.className = 'rp-line'; renderWords(p, line, { onHelp: () => { page.helped = true; } }); box.appendChild(p); }
    $('rpTask').innerHTML = ''; $('rpTask').hidden = true; box.classList.remove('put-away');
    $('rpNext').textContent = opts.gate ? 'I read it! ➜' : 'I read it! ✓';
    $('rpNext').hidden = false; $('rpHelp').hidden = false; $('rpHelp').classList.remove('pulse');
    $('rpMic').hidden = !SR(); $('rpMic').classList.remove('listening');
    $('rpMsg').textContent = '';
    $('readPage').hidden = false;
    say(L === 'A' || L === 'B' ? 'Read the page. Tap a word if you need help.' : 'Read the page. Tap any word for help.');
    clearTimeout(helpTimer);
    if (autoHelp()) helpTimer = setTimeout(() => { if (page && page.key === key && hasDom()) $('rpHelp').classList.add('pulse'); }, info().help * 1000);
  }
  /* read the whole page aloud with each word lighting up in turn */
  function pageHelp() {
    if (!page || !hasDom()) return;
    page.helped = true; $('rpHelp').classList.remove('pulse');
    const spans = [...$('rpText').querySelectorAll('.rw')];
    const text = spans.map(s => s.textContent).join(' ');
    const light = (i) => spans.forEach((s, k) => s.classList.toggle('now', k === i));
    say(text, { rate: .82 });
    const pg = page, per = 470, t0 = performance.now();
    const tick = () => { if (page !== pg) return; const i = Math.floor((performance.now() - t0 - 350) / per); if (i >= spans.length) { light(-1); return; } light(i); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (const s of spans) mark(s.dataset.w, 'help');
  }
  function pageNext() {
    if (!page) return;
    if (page.step === -1) {
      stopMic();
      /* the child says they read it: count the words (as read, or as helped) */
      if (!page.aloud) for (const l of lines(page.key)) markText(l, page.helped ? 'help' : 'right');
      data.pages++; Bus.emit('readPage', page.key, data.pages);
      if (hasDom()) $('rpMic').hidden = true;
    }
    page.step++;
    if (page.step >= page.tasks.length) return finishPage();
    runTask(page.tasks[page.step]);
  }
  function finishPage() {
    stopMic();
    const pg = page; page = null; clearTimeout(helpTimer);
    if (hasDom()) $('readPage').hidden = true;
    data.stars++; save();
    if (pg.opts.gate) { fx('quest'); say(level() <= 'B' ? 'Yes! You did it!' : 'Great reading!'); }
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
  function taskWrong(el, word) { page.firstTry = false; if (word) mark(word, 'wrong'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } fx('cloudBump'); }
  const MATCH_POOL = ['alicorn', 'bunny', 'owl', 'fox', 'foal', 'star', 'flower', 'crystal', 'dragon', 'mermaid', 'rainbow', 'cloud', 'castle', 'moon', 'apple', 'snowman'];
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
      const pool = MATCH_POOL.filter(k => k !== ch.pic && !(ch.pic === 'foal' && k === 'alicorn') && !(ch.pic === 'alicorn' && k === 'foal'));
      const opts = [ch.pic, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const row = document.createElement('div'); row.className = 'rt-pics'; box.appendChild(row);
      for (const k of opts) { const b = document.createElement('button'); b.className = 'rt-pic'; const el = picture(k, 90); if (el) b.appendChild(el); b.addEventListener('click', () => { if (k === ch.pic) { b.classList.add('right'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
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
          if (norm(x.t) === norm(toks[next])) { slotEls[next].textContent = toks[next]; slotEls[next].classList.add('filled'); b.disabled = true; b.classList.add('used'); next++; fx('star', next); if (next >= toks.length) { markText(target, page.firstTry ? 'right' : 'help'); taskDone(true); } }
          else taskWrong(b, toks[next]);
        });
        tiles.appendChild(b);
      }
    } else if (kind === 'yesno') {
      head.textContent = '❓ Read the question. Yes or no?'; say('Read the question. Tap yes or no.');
      const qs = (ch.yesno || []).filter(q => offLevel(q[0], L).length === 0);
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Can an alicorn fly?', true];
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, q, { onHelp: () => { page.firstTry = false; } }); box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-yesno'; box.appendChild(row);
      for (const v of [true, false]) { const b = document.createElement('button'); b.className = 'rt-yn ' + (v ? 'yes' : 'no'); b.textContent = v ? 'yes' : 'no'; b.addEventListener('click', () => { if (v === a) { b.classList.add('right'); markText(q, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
    } else if (kind === 'fill') {
      head.textContent = '✏️ Which word goes in the gap?'; say('Which word goes in the gap?');
      const sent = taskSentence(), toks = sent.split(/\s+/);
      let bi = toks.findIndex(t => PIC_NOUNS[norm(t)] && t === t.toLowerCase());
      if (bi < 0) bi = toks.findIndex(t => norm(t).length > 3); if (bi < 0) bi = toks.length - 1;
      const answer = norm(toks[bi]);
      const pool = PIC_NOUNS[answer] ? [...new Set(Object.keys(PIC_NOUNS).filter(w => PIC_NOUNS[w] !== PIC_NOUNS[answer] && w.length > 2 && w === w.toLowerCase() && !/s$/.test(w)))] : ['fly', 'swim', 'hop', 'sing', 'sleep', 'hide', 'dive', 'grow', 'sit', 'jump', 'play', 'warm', 'cold', 'little', 'big', 'glow', 'dash'].filter(w => w !== answer);
      const opts = [answer, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const s = document.createElement('p'); s.className = 'rt-sentence';
      toks.forEach((t, i) => { if (i === bi) { const g = document.createElement('span'); g.className = 'rt-gap'; g.textContent = '____'; s.appendChild(g); const punct = t.replace(/[a-z']/gi, ''); if (punct) s.appendChild(document.createTextNode(punct)); s.appendChild(document.createTextNode(' ')); } else renderWords(s, t, { rebus: false, onHelp: () => { page.firstTry = false; } }); });
      box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-tiles'; box.appendChild(row);
      for (const w of opts) { const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = w; b.addEventListener('click', () => { if (w === answer) { s.querySelector('.rt-gap').textContent = toks[bi].replace(/[^a-z']/gi, ''); s.querySelector('.rt-gap').classList.add('filled'); markText(sent, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b, answer); }); row.appendChild(b); }
    }
  }

  /* ---------- reading aloud into the microphone (Chrome, online) ---------- */
  function SR() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  function stopMic() { if (rec) { try { rec.abort(); } catch (e) { /* fine */ } rec = null; } if (hasDom()) $('rpMic').classList.remove('listening'); }
  async function micRead() {
    const R = SR(); if (!R || !page || !hasDom()) return;
    /* a grown-up says yes first: in Chrome and Edge the audio goes to an online speech service */
    const pg = page;
    if (!(await Grownups.confirmMicrophone()) || page !== pg) return;
    const spans = [...$('rpText').querySelectorAll('.rw')], want = spans.map(s => s.dataset.w);
    const heard = new Set();
    stopMic();
    rec = new R(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
    $('rpMic').classList.add('listening'); $('rpMsg').textContent = '🎤 Listening… read the page out loud.';
    if (typeof Voice !== 'undefined' && Voice.stop) Voice.stop();
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) for (const w of tokenize(e.results[i][0].transcript)) heard.add(w);
      spans.forEach(s => { if (heard.has(s.dataset.w)) s.classList.add('heard'); });
      const got = want.filter(w => heard.has(w)).length / want.length;
      if (got >= .75 && page === pg && !pg.aloud) {
        pg.aloud = true; stopMic();
        $('rpMsg').textContent = '⭐ I heard you read it!'; $('rpNext').classList.add('pulse');
        for (const w of want) mark(w, heard.has(w) ? 'right' : 'help');
        data.aloud = (data.aloud || 0) + 1; result(true);
        Bus.emit('readAloud', pg.key); fx('sticker');
      }
    };
    rec.onerror = (e) => { if (!hasDom()) return; $('rpMsg').textContent = e.error === 'network' ? 'The microphone needs the internet. Tap "I read it!" instead.' : (e.error === 'not-allowed' || e.error === 'service-not-allowed') ? 'The microphone is switched off. A grown-up can allow it in the browser.' : e.error === 'aborted' ? '' : 'I could not hear. Try again?'; };
    rec.onend = () => { if (hasDom()) $('rpMic').classList.remove('listening'); };
    try { rec.start(); const r = rec; setTimeout(() => { try { r.stop(); } catch (e) { /* fine */ } }, 15000); } catch (e) { $('rpMsg').textContent = 'The microphone did not start.'; }
  }

  /* ---------- missions ---------- */
  function eligible(p) {
    const G = Gm, W = G.world;
    return MISSIONS.filter(m => {
      if (!m[level()] || m.key === lastMission) return false;
      if (m.need === 'foal' && !(G.foal && G.foal.adopted)) return false;
      if (m.key === 'lake' && W.season === 'winter') return false;
      if (m.key === 'cloud' && p.y > -300 && !Quests.isDone('fly')) return false;
      if (m.key === 'bramble' && G.friends.get('bramble').hidden) return false;
      if (p.state === 'swim' && m.key !== 'hop') return false;
      return true;
    });
  }
  function missionGoal(key) { return key === 'stars' ? ({ A: 1, B: 2 }[level()] || 3) : key === 'hop' ? 3 : 1; }
  function checkMission(m, p) {
    const G = Gm, W = G.world, near = (x, y, r) => dist(p.x, p.y, x, y) < r;
    const s = p.surface && p.surface.kind;
    switch (m.key) {
      case 'castle': return near(W.castle.x, W.castle.y - 120, 380);
      case 'cloud': return p.state === 'ground' && s === 'cloud';
      case 'lake': return p.state === 'ground' && s === 'water';
      case 'butterfly': return G.butterflies.list.some(b => near(b.x, b.y, 110));
      case 'stars': return p.stats.stars >= mission.base + missionGoal('stars');
      case 'tree': return W.trees.some(t => !t.back && Math.abs(t.x - p.x) < 110 && p.y > t.y - 420 && p.y < t.y + 30);
      case 'hop': return counts.jump >= mission.base + 3;
      case 'sit': return counts.sit > mission.base;
      case 'arch': return near(W.raceArch.x, W.raceArch.y - 60, 220);
      case 'flower': return counts.flower > mission.base;
      case 'bramble': { const b = G.friends.get('bramble'); return near(b.x, b.y, 190); }
      case 'stable': return near(W.stable.x, W.stable.y, 260);
      case 'apple': return G.apples > mission.base;
    }
    return false;
  }
  function startMission(p) {
    /* never a mission that is already done where she stands */
    const baseOf = (m) => ({ stars: p.stats.stars, hop: counts.jump, sit: counts.sit, flower: counts.flower, apple: Gm.apples }[m.key] || 0);
    const list = eligible(p).filter(m => { mission = { m, base: baseOf(m) }; const done = checkMission(m, p); mission = null; return !done; });
    if (!list.length) return;
    const m = list[(Math.random() * list.length) | 0];
    mission = { m, t: 0, helped: false, base: baseOf(m) };
    lastMission = m.key;
    if (!hasDom()) return;
    const box = $('mcText'); box.innerHTML = ''; renderWords(box, m[level()], { onHelp: () => { if (mission) mission.helped = true; } });
    $('missionCard').hidden = false; $('missionCard').classList.remove('done');
    fx('pop');
    clearTimeout(hintSayTimer);
    if (autoHelp()) hintSayTimer = setTimeout(() => { if (mission && mission.m === m) missionHelp(); }, info().help * 1000 * 1.5);
  }
  function missionHelp() { if (!mission) return; mission.helped = true; say(mission.m[level()], { rate: .85 }); markText(mission.m[level()], 'help'); }
  function finishMission() {
    const ms = mission; mission = null; missionCool = 30;
    const text = ms.m[level()];
    markText(text, ms.helped ? 'help' : 'right'); result(!ms.helped);
    data.missions++; data.stars++; save();
    Gm.stars += 1;
    Bus.emit('missionDone', ms.m.key, data.missions);
    const p = Gm.players[0];
    Gm.particles.sparkle(p.x, p.y - 40, 26, '#ffe27a', 30); Gm.particles.text(p.x, p.y - 90, '⭐', '#ffe27a', 26);
    fx('sticker');
    say(ms.helped ? 'You did it!' : 'You read it and you did it!');
    if (hasDom()) { $('missionCard').classList.add('done'); setTimeout(() => { if (!mission) $('missionCard').hidden = true; }, 1600); }
  }
  function dropMission() { mission = null; if (hasDom()) $('missionCard').hidden = true; }

  /* ---------- per frame ---------- */
  function update(dt) {
    if (!Gm) return;
    for (const k in auto) auto[k] = Math.max(0, auto[k] - dt);
    cardCool = Math.max(0, cardCool - dt);
    if (!on() || !Gm.started) {
      if (hasDom() && !$('missionCard').hidden) $('missionCard').hidden = true; mission = null;
      /* switching reading off lets waiting pages go (nothing is ever lost) */
      while (queue.length) { const q = queue.shift(); if (q.opts.onDone) q.opts.onDone(); }
      if (card) closeCard();
      if (page) { const pg = page; page = null; stopMic(); if (hasDom()) $('readPage').hidden = true; if (pg.opts.onDone) pg.opts.onDone(); }
      return;
    }
    if (queue.length && canShowNow()) { const q = queue.shift(); showPage(q.key, q.opts); return; }
    const p = Gm.players[0]; if (!p) return;
    if (typeof UI !== 'undefined' && UI.anyModalOpen()) return;
    if (!mission) { if (!busyElsewhere(p)) missionCool -= dt; if (missionCool <= 0 && !card && !page) { missionCool = 8; startMission(p); } return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) { missionClock = .4; if (checkMission(mission.m, p)) finishMission(); else if (mission.t > 150) { dropMission(); missionCool = 10; } }
  }

  /* ---------- keys and gamepad while a card or page is open ---------- */
  function keydown(e) {
    if (!card && !page) return false;
    const k = e.key;
    if (card) {
      if (/^[1-4]$/.test(k)) { chooseCard(+k - 1); e.preventDefault(); return true; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { focus = (focus + card.choices.length - 1) % card.choices.length; refocus(); e.preventDefault(); return true; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { focus = (focus + 1) % card.choices.length; refocus(); e.preventDefault(); return true; }
      if (k === ' ' || k === 'Enter') { chooseCard(focus); e.preventDefault(); return true; }
      if (k === 'h' || k === 'H' || k === '?') { cardHelp(); return true; }
      if (k === 'Escape') { closeCard(); return true; }
      return true;
    }
    if (page) { if ((k === ' ' || k === 'Enter') && page.step === -1) { pageNext(); e.preventDefault(); } if (k === 'h' || k === 'H' || k === '?') pageHelp(); return true; }
    return false;
  }
  const padPrev = {};
  function gamepad(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (card) {
      const dir = g.x > .5 ? 1 : g.x < -.5 ? -1 : 0;
      if (dir && dir !== padPrev.dir) { focus = (focus + dir + card.choices.length) % card.choices.length; refocus(); }
      padPrev.dir = dir;
      if (g.flyPressed) chooseCard(focus);
      else if (g.magicPressed) cardHelp();
    } else if (page && page.step === -1) {
      if (g.flyPressed) pageNext(); else if (g.magicPressed) pageHelp();
    }
  }

  /* ---------- hints and the quest card at the child's level ---------- */
  function hintText(key) { if (!on()) return null; const h = READ_HINTS[key]; return h ? fill(h[level()]) : null; }
  function questText() {
    if (!on()) return null;
    if (typeof Race !== 'undefined' && Race.active()) return null;
    if (typeof Games !== 'undefined' && Games.card()) return null;
    const L = level(), q = Quests.current(), st = Quests.status();
    if (!q || st === 'free') return fill(FREE_READ[L]);
    const t = Quests.target(), who = String((t && t.label) || (FRIENDS[q.giver] || {}).name || '').replace(/^Professor /, '');
    if (st === 'offered') return QUEST_OFFER[L].replace('{who}', who);
    if (st === 'done') return L <= 'B' ? 'Read the page!' : 'Now read the page!';
    const ph = Quests.phase(), steps = QUEST_READ[q.key];
    if (!ph || !steps) return null;
    const s = steps[Math.min(Quests.state.phase, steps.length - 1)];
    return s ? fill(s[L]).replace('{who}', who) : null;
  }
  function helpDelay() { return info().help; }

  /* ---------- My Words ---------- */
  function openWords() {
    if (!hasDom()) return;
    const grid = $('wordsGrid'); grid.innerHTML = '';
    const list = Object.entries(data.words).sort((a, b) => (b[1].r - a[1].r) || a[0].localeCompare(b[0]));
    let known = 0;
    for (const [w, s] of list) {
      const m = mastery(s); if (m === 'known') known++;
      const b = document.createElement('button'); b.className = 'wcard ' + m; b.textContent = w === 'i' ? 'I' : w;
      b.title = `read ${s.r} · helped ${s.h} · missed ${s.w}`;
      b.addEventListener('click', () => say(w, { rate: .8 }));
      grid.appendChild(b);
    }
    if (!list.length) grid.innerHTML = '<p class="tiny">No words yet. Switch on Read to play and start reading!</p>';
    $('wordsCount').textContent = `${known} known · ${list.length} met`;
    $('myWords').hidden = false;
  }
  function report() {
    const list = Object.entries(data.words);
    const known = list.filter(([, s]) => mastery(s) === 'known').map(([w]) => w);
    const tricky = list.filter(([, s]) => mastery(s) === 'tricky').sort((a, b) => (b[1].w + b[1].h) - (a[1].w + a[1].h)).map(([w]) => w);
    const acc = accuracy(), L = level(), i = READ_LEVELS.indexOf(L);
    const suggest = acc === null || data.recent.length < 10 ? `Keep playing at ${L}; not enough reading yet to suggest a change.` : acc >= .9 ? `Reading ${Math.round(acc * 100)}% without help: ready to try ${READ_LEVELS[Math.min(4, i + 1)]}.` : acc < .6 ? `Reading ${Math.round(acc * 100)}% without help: ${i > 0 ? 'try ' + READ_LEVELS[i - 1] + ' for a while' : 'stay at A and use help freely'}.` : `Reading ${Math.round(acc * 100)}% without help: ${L} is a good fit.`;
    return { level: L, mode: Gm.settings.readMode, accuracy: acc, known, tricky, pages: data.pages, missions: data.missions, cards: data.cards, stars: data.stars, aloud: data.aloud || 0, suggest, met: list.length };
  }
  function renderReport() {
    const el = $('readReport'); if (!el) return;
    const r = report();
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.innerHTML = `<div class="rr-row"><b>${esc(LEVEL_INFO[r.level].name)}</b> · ${r.accuracy === null ? 'no answers yet' : Math.round(r.accuracy * 100) + '% without help (last ' + data.recent.length + ')'}</div>` +
      `<div class="rr-row">${r.known.length} words known · ${r.met} met · ${r.pages} pages · ${r.missions} missions · ${r.cards} word cards${r.aloud ? ' · ' + r.aloud + ' read aloud' : ''}</div>` +
      (r.tricky.length ? `<div class="rr-row">Tricky: <i>${esc(r.tricky.slice(0, 12).join(', '))}</i></div>` : '') +
      `<div class="rr-row rr-suggest">${esc(r.suggest)}</div>`;
  }

  /* ---------- wiring ---------- */
  function init(game, callbacks = {}) {
    Gm = game; cb = callbacks; load();
    /* after each quest, the next one waits for its page to be read */
    Quests.setGate((q, go) => { if (!on() || !READ_CHAPTERS[q.key]) return go(); gate(q.key, go); });
    /* the foal's two growth steps wait for a page too */
    if (typeof Foal !== 'undefined' && !Foal.prototype._readWrapped) {
      Foal.prototype._readWrapped = true;
      const orig = Foal.prototype.addCare;
      Foal.prototype.addCare = function (n) {
        const grows = this.stage < 2 && this.care + n >= FOAL_GROW[this.stage + 1];
        if (!on() || !grows) return orig.call(this, n);
        this.care += n;
        if (this._gateWait) return;
        const key = this.stage === 0 ? 'foalYoung' : 'foalGrown';
        this._gateWait = key;
        gate(key, () => { this._gateWait = null; orig.call(this, 0); });
      };
    }
    Bus.on('jump', (p) => { if (p && p.id === 1) counts.jump++; });
    Bus.on('takeoff', (p) => { if (p && p.id === 1) counts.jump++; });
    Bus.on('sit', (p) => { if (p && p.id === 1) counts.sit++; });
    Bus.on('flowerMagic', () => counts.flower++); Bus.on('flowerBloomed', () => counts.flower++);
    Bus.on('season', (s) => { if (on() && (s === 'winter' || s === 'spring')) enqueue(s); });
    if (!hasDom()) return;
    $('rpNext').addEventListener('click', pageNext);
    $('rpHelp').addEventListener('click', pageHelp);
    $('rpMic').addEventListener('click', micRead);
    $('rcHelp').addEventListener('click', cardHelp);
    $('rcBack').addEventListener('click', () => { if (card) closeCard(); });
    $('mcHelp').addEventListener('click', missionHelp);
    $('mcClose').addEventListener('click', () => { dropMission(); missionCool = 45; });
    $('wordsClose').addEventListener('click', () => { $('myWords').hidden = true; });
  }
  /* a new story in Read to play starts with a page */
  function storyStart() { if (on()) enqueue('start'); }
  /* test hooks (smoke.js) */
  function _solveGate() {
    if (page && page.opts.onDone) { const pg = page; page = null; pg.opts.onDone(); return true; }
    const q = queue.shift(); if (q) { if (q.opts.onDone) q.opts.onDone(); return true; }
    return false;
  }
  function _card() { return card; }

  return { init, on, level, setLevel, context, intercept, locked, update, gate, enqueue, showPage, chooseCard, keydown, gamepad, hintText, questText, helpDelay,
    openWords, report, renderReport, accuracy, markText, storyStart, renderWords, picture,
    cardOpen: () => !!card, pageOpen: () => !!page, busy: () => !!card || !!page, waiting: () => queue.length, stats: () => data,
    choicesFor, _solveGate, _card, _open: (verb) => openCard(Gm.player, verb, () => grant(Gm.player, verb)), _next: () => pageNext(), _missionNow: () => { missionCool = 0; }, mission: () => mission };
})();
