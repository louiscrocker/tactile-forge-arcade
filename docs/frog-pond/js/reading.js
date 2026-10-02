/* ============================================================
   reading.js — Read to Play
   ============================================================
   When the reading mode is "Read to play", reading is how the
   game is played:

   ACTION CARDS  The action button (Space, GO!, gamepad A, E for
                 sing) no longer acts by itself.  It opens a card
                 of words at the child's level; tapping the word
                 that fits the moment ("eat" by the fuzz, "up" when
                 air runs low, "snap" when a bug glows) makes the
                 frog do it, and unlocks that action for a few
                 seconds so play stays fluid.
   READ TO GROW  Each metamorphosis (legs, front legs, froglet,
                 frog) waits for a leveled page to be read and its
                 task done: match a picture (A), build the sentence
                 (B, C), answer yes/no (C+), fill the blank (D, E).
   MISSIONS      "Go to the log."  The sentence is shown, not
                 spoken; going there proves it was understood.
   HELP          Any word can be tapped to hear it.  Help comes by
                 itself after a delay if the grown-up allows it.
                 Two wrong taps and the answer glows and is read.
                 Help is recorded; nothing is ever lost.
   TRACKING      Every word: right (unaided), wrong, helped.  The
                 level can adjust itself.  My Words shows mastery;
                 the grown-up corner gets a reading report.
   ============================================================ */
'use strict';

const Reading = (function () {
  const $ = (id) => (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  const hasDom = () => !!$('readCard');
  let Gm = null, cb = {};
  let data = { words: {}, recent: [], stars: 0, pages: 0, missions: 0, cards: 0, levelUps: 0 };
  let card = null, page = null, mission = null, missionCool = 20, missionClock = 0, lastMission = null;
  const unlocked = {}, auto = { graze: 0, up: 0, hide: 0 };
  let pendingGate = null, helpTimer = null, hintSayTimer = null, focus = 0, rec = null;
  let listen = null;          /* { kind: 'page'|'card', ... } while the microphone is on */

  const load = () => { try { data = Object.assign(data, JSON.parse(localStorage.getItem(pkey('reading')) || '{}')); } catch (e) { /* fine */ } };
  const save = () => { try { localStorage.setItem(pkey('reading'), JSON.stringify(data)); } catch (e) { /* fine */ } };

  function on() { return !!Gm && Gm.settings.readMode === 'play'; }
  function level() { const L = Gm && Gm.settings.readLevel; return READ_LEVELS.includes(L) ? L : 'B'; }
  function info() { return LEVEL_INFO[level()]; }
  function autoHelp() { return Gm.settings.readHelp !== 'ask'; }
  function micOn() { return !!Gm.settings.readMic && Listener.supported(); }
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z']/g, '');
  const say = (t, o = {}) => Voice.say(t, Object.assign({ interrupt: true, force: true }, o));

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
  function drawCustom(key, ctx, s) {
    ctx.save(); ctx.scale(s, s);
    switch (key) {
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(12, -8, 22, 0, TAU); ctx.fill(); break;
      case 'mud': ctx.fillStyle = '#5a3f22'; ctx.beginPath(); ctx.ellipse(0, 8, 38, 16, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3e2a14'; for (const [x, y, r] of [[-14, 6, 5], [10, 12, 6], [18, 2, 4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } break;
      case 'water': case 'pond': { const g = ctx.createLinearGradient(0, -20, 0, 26); g.addColorStop(0, '#9fe0ef'); g.addColorStop(1, '#2a7f8f'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4, 38, 22, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, -2); ctx.quadraticCurveTo(-13, -8, 0, -2); ctx.quadraticCurveTo(13, 4, 26, -2); ctx.stroke(); break; }
      case 'ice': ctx.fillStyle = '#dff2fb'; ctx.fillRect(-36, -14, 72, 26); ctx.strokeStyle = '#8ab8d0'; ctx.lineWidth = 2; ctx.strokeRect(-36, -14, 72, 26); ctx.beginPath(); ctx.moveTo(-20, -14); ctx.lineTo(-8, 0); ctx.lineTo(4, -6); ctx.lineTo(18, 12); ctx.stroke(); break;
      case 'rock': Sprites.drawRock(ctx, { rx: 30, ry: 18, k: .5, tilt: 0 }); break;
      case 'weed': ctx.translate(0, 30); Sprites.drawWeed(ctx, { kind: 'elodea', h: 60, ph: 0, sway: 0, tint: .5 }, 0, 'summer'); break;
    }
    ctx.restore();
  }
  const GUIDE_PIC = { fish: 'minnow', log: 'log', snail: 'snail', turtle: 'turtle', snake: 'snake', bird: 'heron' };
  const ICON_PIC = { frog: 'frog', egg: 'egg', tadpole: 'tadpole', legs: 'legs', tail: 'tail', froglet: 'froglet', fly: 'fly', bug: 'nymph', dragonfly: 'dragonfly', pad: 'pad', fuzz: 'algae' };
  function picture(key, px) {
    if (GUIDE_PIC[key] && typeof FieldGuide !== 'undefined') return FieldGuide.picture(GUIDE_PIC[key], px, false);
    if (ICON_PIC[key]) { const c = Sprites.iconEl(ICON_PIC[key], Gm.speciesDef(), px); c.style.width = c.style.height = px + 'px'; return c; }
    const c = document.createElement('canvas'); c.width = c.height = px * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); drawCustom(key, ctx, px / 100);
    c.style.width = c.style.height = px + 'px'; return c;
  }

  /* render a line of text as tappable words (with rebus pictures at A and B) */
  function renderWords(el, text, opts = {}) {
    for (const tok of String(text).split(/\s+/)) {
      if (!tok) continue;
      const w = norm(tok);
      const span = document.createElement('span'); span.className = 'rw'; span.textContent = tok; span.dataset.w = w;
      span.addEventListener('click', (e) => { e.stopPropagation(); say(w, { rate: .75 }); mark(w, 'help'); if (opts.onHelp) opts.onHelp(w); span.classList.add('helped'); });
      el.appendChild(span);
      if (info().rebus && PIC_NOUNS[w] && opts.rebus !== false) { const pic = picture(PIC_NOUNS[w], 30); pic.classList.add('rebus'); el.appendChild(pic); }
      el.appendChild(document.createTextNode(' '));
    }
  }

  /* ---------- what the frog could do right now ---------- */
  function danger(p) {
    const G = Gm, H = G.hazards;
    if (G.heron && G.heron.state === 'warning' && G.heron.reach(p)) return true;
    if (H && H.snake.state === 'coil' && H.snakeReach(p)) return true;
    if (H && H.raccoon.state === 'pat' && H.raccoon.warned && H.raccoonReach(p)) return true;
    if (H && H.fish.state === 'hunt' && H.fish.target === p) return true;
    return false;
  }
  function context(p, which) {
    if (which === 'sing') { if (p.stage !== 5 || p.state !== 'frog') return null; return p.readyFlag && p.spawnNear ? 'eggs' : 'sing'; }
    if (p.state === 'egg') return 'go';
    if (p.state === 'tadpole') {
      if (Gm.nymphs.list.some(n => (n.state === 'twitch' || n.state === 'lunge') && n.target === p)) return 'swim';
      if (danger(p)) return 'hide';
      if (p.stage === 3 && p.air < .6) return 'up';
      if (p.grazing) return 'eat';
      return 'swim';
    }
    if (p.state === 'froglet' || p.state === 'frog') {
      if (danger(p)) return 'hide';
      if (p.target) return 'snap';
      if (p.mudNear || p.litterNear) return 'sleep';
      if (p.mode === 'perch' || p.mode === 'cling') return 'hop';
      return 'swim';
    }
    return null;
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
    const picKey = { go: 'egg', eat: 'fuzz', swim: 'tadpole', up: 'sun', hide: 'bird', snap: 'fly', hop: 'pad', sleep: 'mud', sing: 'moon', eggs: 'egg' }[verb];
    pic.appendChild(picture(picKey, 64));
    const box = $('rcChoices'); box.innerHTML = '';
    choices.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'rc-word' + (t.length > 12 ? ' long' : '');
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
    const next = () => { if (!card || i >= btns.length) { btns.forEach(b => b.classList.remove('saying')); return; } btns.forEach((b, k) => b.classList.toggle('saying', k === i)); say(card.choices[i], { rate: .8, onend: () => { i++; setTimeout(next, 250); } }); if (!Voice.supported) { i++; setTimeout(next, 900); } };
    next();
  }
  function chooseCard(i) {
    if (!card) return;
    const c = card, pick = c.choices[i];
    if (pick === c.correct) {
      const clean = c.tries === 0 && !c.helped;
      markText(c.correct, clean ? 'right' : 'help');
      result(clean);
      closeCard();
      if (Gm.particles && c.p) { Gm.particles.sparkle(c.p.x, c.p.y - 20, 14, '#fff3b0', 18); Gm.particles.text(c.p.x, c.p.y - 40, pick.length < 14 ? pick : '✓', '#fff3b0', 16); }
      AudioFX.sticker && clean && AudioFX.sticker();
      Bus.emit('readCard', c.verb, clean);
      c.onOk && c.onOk();
      return true;
    }
    c.tries++; markText(c.correct, 'wrong');
    if (hasDom()) { const b = $('rcChoices').children[i]; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    AudioFX.bump && AudioFX.bump();
    if (c.tries >= 2) {
      c.helped = true;
      if (hasDom()) [...$('rcChoices').children].forEach((b, k) => b.classList.toggle('glow', c.choices[k] === c.correct));
      say(c.correct, { rate: .8 });
    } else say('Try again.');
    return false;
  }
  function closeCard() { card = null; clearTimeout(helpTimer); stopListening(); if (hasDom()) $('readCard').hidden = true; }

  /* the frog does what was read, and the action stays unlocked for a little while */
  function grant(p, verb) {
    unlocked[verb] = Gm.time + info().window;
    switch (verb) {
      case 'eat': auto.graze = 2.6; break;
      case 'up': auto.up = 2.6; break;
      case 'hide': auto.hide = 3; break;
      case 'sing': case 'eggs': p.input.singPressed = true; break;
      default: p.input.actionPressed = true;
    }
  }

  /* called every frame after input is gathered (player 1 only) */
  function intercept(p) {
    if (!on() || p.id !== 1 || card || page) return;
    const t = Gm.time;
    if (p.input.actionPressed) {
      const verb = context(p, 'action');
      if (verb && !(unlocked[verb] > t)) { p.input.actionPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
    if (p.input.singPressed) {
      const verb = context(p, 'sing');
      if (verb && !(unlocked[verb] > t)) { p.input.singPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
    /* holding the button only grazes once "eat" has been read */
    if (!(unlocked.eat > t)) p.input.action = false;
    if (auto.graze > 0) p.input.action = true;
    if (auto.up > 0) { p.input.y = -1; p.input.x *= .3; p.goal = null; }
    if (auto.hide > 0) { p.input.y = 1; p.input.x = 0; p.goal = null; }
  }

  /* ---------- pages (read to grow, and story pages) ---------- */
  function lines(key) { return READ_CHAPTERS[key][level()]; }
  function gate(p, key, cont) {
    pendingGate = { key, cont, p };
    showPage(key, { gate: true, onDone: () => { const g = pendingGate; pendingGate = null; if (g) g.cont(); } });
  }
  function showPage(key, opts = {}) {
    const ch = READ_CHAPTERS[key]; if (!ch) return;
    page = { key, opts, helped: false, tasks: opts.gate ? info().tasks.slice() : [], step: -1, firstTry: true };
    if (!hasDom()) return;
    const L = level();
    $('rpLevel').textContent = LEVEL_INFO[L].name;
    $('rpTitle').textContent = Story.chapters.find(c => c.key === key)?.title || '';
    const pic = $('rpPic'); pic.innerHTML = ''; pic.appendChild(picture(ch.pic, 110));
    const box = $('rpText'); box.innerHTML = '';
    for (const line of lines(key)) { const p = document.createElement('p'); p.className = 'rp-line'; renderWords(p, line, { onHelp: () => { page.helped = true; } }); box.appendChild(p); }
    $('rpTask').innerHTML = ''; $('rpTask').hidden = true; $('rpText').classList.remove('put-away');
    $('rpNext').textContent = opts.gate ? 'I read it! ➜' : 'I read it! ✓';
    $('rpNext').hidden = false; $('rpHelp').hidden = false;
    $('rpMic').hidden = !SR() || micOn();
    $('rpMic').textContent = '🎤 I will read it out loud';
    $('rpMsg').textContent = '';
    $('rpMicRow').hidden = true;
    $('readPage').hidden = false;
    if (micOn()) setTimeout(() => { if (page && page.key === key && page.step === -1) listenPage(); }, 200);
    say(L === 'A' || L === 'B' ? 'Read the page. Tap a word if you need help.' : 'Read the page. Tap any word for help.');
    clearTimeout(helpTimer);
    if (autoHelp()) helpTimer = setTimeout(() => $('rpHelp').classList.add('pulse'), info().help * 1000);
  }
  /* read the whole page aloud with each word lighting up */
  function pageHelp() {
    if (!page || !hasDom()) return;
    page.helped = true; $('rpHelp').classList.remove('pulse');
    const spans = [...$('rpText').querySelectorAll('.rw')];
    const text = spans.map(s => s.textContent).join(' ');
    let idx = -1; const starts = []; let pos = 0; for (const s of spans) { starts.push(pos); pos += s.textContent.length + 1; }
    const light = (i) => spans.forEach((s, k) => s.classList.toggle('now', k === i));
    let boundary = false;
    say(text, { rate: .82, onboundary: (ci) => { boundary = true; let i = 0; while (i + 1 < starts.length && starts[i + 1] <= ci) i++; light(i); }, onend: () => light(-1), key: 'story:' + page.key });
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
    if (pg.opts.gate) { AudioFX.fanfare && AudioFX.fanfare(); say(level() <= 'B' ? 'Yes! You did it!' : 'Great reading! Now watch me grow.'); }
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
  function taskWrong(el, word) { page.firstTry = false; if (word) mark(word, 'wrong'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } AudioFX.bump && AudioFX.bump(); }
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
      const pool = ['egg', 'tadpole', 'legs', 'froglet', 'frog', 'bug', 'ice', 'sun'].filter(k => k !== ch.pic && !(ch.pic === 'frog' && k === 'froglet') && !(ch.pic === 'froglet' && k === 'frog'));
      const opts = [ch.pic, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const row = document.createElement('div'); row.className = 'rt-pics'; box.appendChild(row);
      for (const k of opts) { const b = document.createElement('button'); b.className = 'rt-pic'; b.appendChild(picture(k, 90)); b.addEventListener('click', () => { if (k === ch.pic) { b.classList.add('right'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
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
          if (norm(x.t) === norm(toks[next])) { slotEls[next].textContent = toks[next]; slotEls[next].classList.add('filled'); b.disabled = true; b.classList.add('used'); next++; AudioFX.bubble && AudioFX.bubble(1 + next * .1, .06); if (next >= toks.length) { markText(target, page.firstTry ? 'right' : 'help'); taskDone(true); } }
          else taskWrong(b, toks[next]);
        });
        tiles.appendChild(b);
      }
    } else if (kind === 'yesno') {
      head.textContent = '❓ Read the question. Yes or no?'; say('Read the question. Tap yes or no.');
      const qs = (ch.yesno || []).filter(q => offLevel(q[0], L).length === 0);
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Can a frog swim?', true];
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, q, { onHelp: () => { page.firstTry = false; } }); box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-yesno'; box.appendChild(row);
      for (const v of [true, false]) { const b = document.createElement('button'); b.className = 'rt-yn ' + (v ? 'yes' : 'no'); b.textContent = v ? 'yes' : 'no'; b.addEventListener('click', () => { if (v === a) { b.classList.add('right'); markText(q, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
    } else if (kind === 'fill') {
      head.textContent = '✏️ Which word goes in the gap?'; say('Which word goes in the gap?');
      const sent = taskSentence(), toks = sent.split(/\s+/);
      let bi = toks.findIndex(t => PIC_NOUNS[norm(t)]);
      if (bi < 0) bi = toks.findIndex(t => norm(t).length > 3); if (bi < 0) bi = toks.length - 1;
      const answer = norm(toks[bi]);
      const pool = PIC_NOUNS[answer] ? Object.keys(PIC_NOUNS).filter(w => PIC_NOUNS[w] !== PIC_NOUNS[answer] && w.length > 2) : ['swim', 'hop', 'sing', 'sleep', 'kick', 'hide', 'dive', 'snap', 'grow', 'sit', 'jump', 'play', 'warm', 'cold', 'little', 'big'].filter(w => w !== answer);
      const opts = [answer, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const s = document.createElement('p'); s.className = 'rt-sentence';
      toks.forEach((t, i) => { if (i === bi) { const g = document.createElement('span'); g.className = 'rt-gap'; g.textContent = '____'; s.appendChild(g); const punct = t.replace(/[a-z']/gi, ''); if (punct) s.appendChild(document.createTextNode(punct)); s.appendChild(document.createTextNode(' ')); } else renderWords(s, t, { rebus: false, onHelp: () => { page.firstTry = false; } }); });
      box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-tiles'; box.appendChild(row);
      for (const w of opts) { const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = w; b.addEventListener('click', () => { if (w === answer) { s.querySelector('.rt-gap').textContent = toks[bi].replace(/[^a-z']/gi, ''); s.querySelector('.rt-gap').classList.add('filled'); markText(sent, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b, answer); }); row.appendChild(b); }
    }
  }

  /* ---------- reading aloud into the microphone ---------- */
  function SR() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  /* ---------- the microphone stays on while a panel is up ---------- */
  function stopListening() { if (!listen) return null; const l = listen; listen = null; clearInterval(l.stallTimer); const r = Listener.stop(); return Object.assign(r, { l }); }
  function micError(code) {
    const msg = { network: 'The microphone needs the internet. Read it, then tap "I read it!".', 'not-allowed': 'The microphone is switched off. A grown-up can allow it in the browser.', 'service-not-allowed': 'The microphone is switched off. A grown-up can allow it in the browser.', 'audio-capture': 'No microphone was found.', unsupported: 'This browser cannot listen. Try Chrome.', 'too-many-restarts': 'I stopped listening. Tap "I read it!" when you are done.' }[code] || 'I could not hear. Tap "I read it!" when you are done.';
    if (hasDom()) { if (listen && listen.kind === 'page') $('rpMsg').textContent = msg; if (listen && listen.kind === 'card') $('rcMic').textContent = '🎤 ' + msg; }
    if (listen) listen.failed = code;
  }
  /* a grown-up says yes before the microphone turns on (asked once per visit);
     no: the microphone setting goes back off */
  async function micAllowed() {
    if (await Grownups.confirmMicrophone()) return true;
    if (Gm.settings.readMic) { Gm.settings.readMic = false; cb.saveSettings && cb.saveSettings(); if (typeof UI !== 'undefined') UI.refreshToggles(); }
    return false;
  }
  async function listenPage() {
    if (!page || !hasDom()) return;
    const pg = page;
    stopListening();
    if (!(await micAllowed())) { if (page === pg) $('rpMic').hidden = !SR() || micOn(); return; }
    if (page !== pg) return;
    stopListening();
    const spans = [...$('rpText').querySelectorAll('.rw')], expected = spans.map(s => s.dataset.w);
    listen = { kind: 'page', key: page.key, spans, expected, got: new Set(), next: 0, lastProgress: performance.now(), helpedIdx: new Set(), t0: performance.now(), prompted: -1 };
    const L = listen;
    $('rpMicRow').hidden = false; $('rpMic').hidden = !SR() || micOn(); $('rpMic').textContent = '🎤 Listening…'; $('rpMic').classList.add('listening');
    $('rpMsg').textContent = '';
    const paint = () => {
      spans.forEach((s, i) => { s.classList.toggle('heard', L.got.has(i)); s.classList.toggle('next', i === L.next && L.next < spans.length); });
      $('rpHeard').textContent = `I heard ${L.got.size} of ${spans.length} words`;
      if (L.got.size >= spans.length && !L.allDone) { L.allDone = true; $('rpMsg').textContent = '⭐ I heard every word! Tap "I read it!"'; $('rpNext').classList.add('pulse'); AudioFX.sticker && AudioFX.sticker(); }
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
  async function listenCard() {
    if (!card || !hasDom()) return;
    const c0 = card;
    stopListening();
    if (!(await micAllowed())) { if (card === c0) $('rcMic').hidden = !micOn(); return; }
    if (card !== c0) return;
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
  function micRead() {
    if (!page) return;
    if (listen && listen.kind === 'page') return;
    listenPage();
  }
  function micReadOld() {
    const R = SR(); if (!R || !page) return;
    const spans = [...$('rpText').querySelectorAll('.rw')], want = spans.map(s => s.dataset.w);
    const heard = new Set();
    try { rec && rec.abort(); } catch (e) { /* fine */ }
    rec = new R(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
    $('rpMic').classList.add('listening'); $('rpMsg').textContent = '🎤 Listening… read the page out loud.';
    Voice.stop();
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) for (const w of tokenize(e.results[i][0].transcript)) heard.add(w);
      spans.forEach(s => { if (heard.has(s.dataset.w)) s.classList.add('heard'); });
      const got = want.filter(w => heard.has(w)).length / want.length;
      if (got >= .75) { try { rec.stop(); } catch (er) { /* fine */ } $('rpMsg').textContent = '⭐ I heard you read it!'; for (const w of want) if (heard.has(w)) mark(w, 'right'); Bus.emit('readAloud', page.key); AudioFX.sticker && AudioFX.sticker(); }
    };
    rec.onerror = (e) => { $('rpMsg').textContent = e.error === 'network' ? 'The microphone needs the internet. Tap "I read it!" instead.' : e.error === 'not-allowed' ? 'The microphone is switched off for this page.' : 'I could not hear. Try again?'; };
    rec.onend = () => { $('rpMic').classList.remove('listening'); };
    try { rec.start(); setTimeout(() => { try { rec.stop(); } catch (e) { /* fine */ } }, 12000); } catch (e) { $('rpMsg').textContent = 'The microphone did not start.'; }
  }

  /* ---------- missions ---------- */
  function eligible(p) {
    const G = Gm, pond = G.pond, inWater = p.inWater() || p.isTadpole();
    return MISSIONS.filter(m => {
      if (m.key === lastMission) return false;
      if (m.who === 'water' && !inWater) return false;
      if (m.who === 'tadpole' && !(p.isTadpole() && p.stage < 3)) return false;
      if (m.who === 'frog' && !p.isFrogLike()) return false;
      if (m.who === 'night' && !(p.stage === 5 && G.night > .5)) return false;
      if (m.key === 'turtle' && !(G.neighbours && G.neighbours.turtle.state === 'bask')) return false;
      if (m.key === 'pad' && !pond.pads.some(q => pond.padSize(q) > 30)) return false;
      if (m.key === 'snail' && !G.snails.list.length) return false;
      if ((m.key === 'rock') && !pond.rocks.some(r => !r.pebble)) return false;
      if (m.key === 'log' && !p.isFrogLike() && !inWater) return false;
      return true;
    });
  }
  function checkMission(m, p) {
    const G = Gm, pond = G.pond, near = (x, y, r) => dist(p.x, p.y, x, y) < r;
    switch (m.key) {
      case 'log': return near(pond.log.x, pond.log.y, pond.log.len / 2 + 60);
      case 'up': return (p.inWater() || p.isTadpole()) && p.y < pond.surfaceAt(p.x) + 16;
      case 'mud': return p.y > pond.bedY(p.x) - 45;
      case 'fish': return G.minnows.list.some(f => near(f.x, f.y, 110));
      case 'snail': return G.snails.list.some(s => near(s.x, pond.bedY(s.x), 100));
      case 'rock': return pond.rocks.some(r => !r.pebble && near(r.x, r.y - r.ry, r.rx + 60));
      case 'eat3': return p.total >= mission.base + 3;
      case 'pad': return p.mode === 'perch' && p.perch && p.perch.kind === 'pad';
      case 'bug2': return p.stats.snaps >= mission.base + 2;
      case 'turtle': return G.neighbours.turtle.state !== 'gone' && near(G.neighbours.turtle.x, G.neighbours.turtle.y, 190);
      case 'sing': return p.stats.sang > mission.base;
    }
    return false;
  }
  function startMission(p) {
    const list = eligible(p); if (!list.length) return;
    const m = list[(Math.random() * list.length) | 0];
    mission = { m, t: 0, helped: false, base: m.key === 'eat3' ? p.total : m.key === 'bug2' ? p.stats.snaps : m.key === 'sing' ? p.stats.sang : 0 };
    lastMission = m.key;
    if (!hasDom()) return;
    const box = $('mcText'); box.innerHTML = ''; renderWords(box, m[level()], { onHelp: () => { mission.helped = true; } });
    $('missionCard').hidden = false; $('missionCard').classList.remove('done');
    AudioFX.bubble && AudioFX.bubble(1.3, .06);
    clearTimeout(hintSayTimer);
    if (autoHelp()) hintSayTimer = setTimeout(() => { if (mission && mission.m === m) missionHelp(); }, info().help * 1000 * 1.5);
  }
  function missionHelp() { if (!mission) return; mission.helped = true; say(mission.m[level()], { rate: .85 }); markText(mission.m[level()], 'help'); }
  function finishMission() {
    const ms = mission; mission = null; missionCool = 30;
    const text = ms.m[level()];
    markText(text, ms.helped ? 'help' : 'right'); result(!ms.helped);
    data.missions++; data.stars++; save();
    Bus.emit('missionDone', ms.m.key, data.missions);
    const p = Gm.players[0];
    Gm.particles.sparkle(p.x, p.y - 20, 26, '#ffe27a', 30); Gm.particles.text(p.x, p.y - 50, '⭐', '#ffe27a', 26);
    AudioFX.sticker && AudioFX.sticker();
    say(ms.helped ? 'You did it!' : 'You read it and you did it!');
    if (hasDom()) { $('missionCard').classList.add('done'); setTimeout(() => { if (!mission) $('missionCard').hidden = true; }, 1600); }
  }

  /* ---------- per frame ---------- */
  function update(dt) {
    if (!Gm) return;
    for (const k of ['graze', 'up', 'hide']) auto[k] = Math.max(0, auto[k] - dt);
    const show = on() && Gm.started;
    if (!show) { if (hasDom() && !$('missionCard').hidden) $('missionCard').hidden = true; mission = null; return; }
    const p = Gm.players[0]; if (!p || p.state === 'egg' || p.state === 'hibernating' || p.state === 'morphing') return;
    if (!mission) { missionCool -= dt; if (missionCool <= 0 && !card && !page && !Cinematic.active) startMission(p); return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) { missionClock = .4; if (checkMission(mission.m, p)) finishMission(); else if (mission.t > 150) { mission = null; missionCool = 10; if (hasDom()) $('missionCard').hidden = true; } }
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
      return true;
    }
    if (page) { if ((k === ' ' || k === 'Enter') && page.step === -1) { pageNext(); e.preventDefault(); } return true; }
    return false;
  }
  let padPrev = {};
  function gamepad(pads) {
    const g = pads && pads[0]; if (!g || !card) return;
    const dir = g.x > .5 ? 1 : g.x < -.5 ? -1 : 0;
    if (dir && dir !== padPrev.dir) { focus = (focus + dir + card.choices.length) % card.choices.length; refocus(); }
    padPrev.dir = dir;
    if (g.actionPressed) chooseCard(focus);
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
    return { level: L, mode: Gm.settings.readMode, accuracy: acc, known, tricky, pages: data.pages, missions: data.missions, cards: data.cards, stars: data.stars, suggest, met: list.length };
  }

  /* ---------- wiring ---------- */
  function init(game, callbacks = {}) {
    Gm = game; cb = callbacks; load();
    /* the four growth steps wait for a page to be read */
    if (typeof Frog !== 'undefined' && !Frog.prototype._readWrapped) {
      Frog.prototype._readWrapped = true;
      const wrap = (name, chapter) => {
        const orig = Frog.prototype[name];
        Frog.prototype[name] = function (...a) {
          if (!on() || this.id !== 1) return orig.apply(this, a);
          if (this._gateWait) return;
          const key = typeof chapter === 'function' ? chapter(this) : chapter;
          this._gateWait = key;
          gate(this, key, () => { this._gateWait = null; orig.apply(this, a); });
        };
      };
      wrap('advance', (p) => p.stage === 1 ? 'legs' : 'air');
      wrap('becomeFroglet', 'out');
      wrap('becomeFrog', 'song');
    }
    if (!hasDom()) return;
    $('rpNext').addEventListener('click', pageNext);
    $('rpHelp').addEventListener('click', pageHelp);
    $('rpMic').addEventListener('click', micRead);
    $('rcHelp').addEventListener('click', cardHelp);
    $('rcBack').addEventListener('click', () => { if (card) { closeCard(); } });
    $('mcHelp').addEventListener('click', missionHelp);
    $('wordsClose').addEventListener('click', () => { $('myWords').hidden = true; });
    for (const L of READ_LEVELS) { /* level chips are built by UI */ }
  }
  /* test hooks (smoke.js) */
  function _solveGate() { if (page && page.opts.onDone) { const pg = page; page = null; pg.opts.onDone(); return true; } if (pendingGate) { const g = pendingGate; pendingGate = null; g.cont(); return true; } return false; }
  function _card() { return card; }

  return { init, on, level, setLevel, context, intercept, update, gate, showPage, chooseCard, keydown, gamepad, hintText, openWords, report, accuracy,
    listening: () => !!listen, records: () => (data.records || []).slice(), playTake: (k) => Takes.play(k), _listen: () => listen,
    cardOpen: () => !!card, _missionNow: () => { missionCool = 0; }, pageOpen: () => !!page, busy: () => !!card || !!page, stats: () => data, choicesFor, _solveGate, _card, mission: () => mission };
})();
