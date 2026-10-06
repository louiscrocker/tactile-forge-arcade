/* ============================================================
   reading.js — Read to Play
   ============================================================
   When the reading mode is "I read to play", reading is how the
   game is played (the pattern is Frog Pond's READING_DESIGN.md,
   ported from Burrow & Brood):

   ACTION CARDS  The action button (Space, GO!, gamepad A) no longer
                 acts by itself (E, the dash and claws-up button, is
                 always free).  It opens a card of words at the
                 child's level; tapping the word that fits ("eat" by
                 a leaf, "ride" by a jellyfish, "dip" at the sea,
                 "push" by a rival, "hi" to another crab, "shut" to
                 close the burrow and moult, "shake" to let the eggs
                 go) makes the crab do it, and unlocks that action
                 for a few seconds.  Once a pushing contest or the
                 egg shaking starts, the buttons are free: they are
                 games of timing.
   READ TO GROW  The big steps of the life cycle wait for a leveled
                 page to be read and its task done: hatching, the
                 first moult at sea, becoming a megalopa, coming
                 ashore, reaching the forest, the last moult into
                 an adult, and the eggs going into the sea.
   STORY PAGES   The egg, growing at sea, glowing plankton, fish,
                 the whale shark, the jellyfish, the cliff, drying
                 out, the burrow, a crab moult, the robber crab,
                 the first rain, the crab bridge, the dip, the
                 rival, the king and the brooding mother each open
                 a leveled page once, no gate.
   MISSIONS      "Swim to the reef."  The sentence is
                 shown, not spoken; going there proves it was read.
   HELP          Any word can be tapped to hear it.  Help comes by
                 itself after a delay if the grown-up allows it.
                 Two wrong taps and the answer glows and is read.
                 Help is recorded; nothing is ever lost.
   TRACKING      Every word: right (unaided), wrong, helped.  The
                 level can adjust itself.  My Words shows mastery
                 and a report for grown-ups.
   ============================================================ */
'use strict';

const Reading = (function () {
  const $ = (id) => (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  const hasDom = () => !!$('readCard');
  const KEY = 'redcrab.reading';
  let Gm = null, cb = {};
  let data = { words: {}, recent: [], stars: 0, pages: 0, missions: 0, cards: 0, levelUps: 0 };
  let card = null, page = null, mission = null, missionCool = 20, missionClock = 0, lastMission = null;
  const unlocked = {}, auto = { hide: 0 };
  let pendingGate = null, helpTimer = null, hintSayTimer = null, focus = 0, rec = null;
  const storyQueue = [], storyShown = new Set();

  const load = () => {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!o || typeof o !== 'object') return;
      if (o.words && typeof o.words === 'object') for (const w in o.words) { const s = o.words[w]; if (/^[a-z']{1,20}$/.test(w) && s && [s.r, s.w, s.h].every(Number.isFinite)) data.words[w] = { r: s.r, w: s.w, h: s.h, last: +s.last || 0 }; }
      if (Array.isArray(o.recent)) data.recent = o.recent.filter(v => v === 0 || v === 1).slice(-30);
      for (const k of ['stars', 'pages', 'missions', 'cards', 'levelUps']) if (Number.isFinite(o[k])) data[k] = o[k];
      if (Array.isArray(o.shown)) data.shown = o.shown.filter(k => typeof k === 'string');
    } catch (e) { /* fine */ }
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* fine */ } };

  function on() { return !!Gm && Gm.settings.readMode === 'play'; }
  function level() { const L = Gm && Gm.settings.readLevel; return READ_LEVELS.includes(L) ? L : 'B'; }
  function info() { return LEVEL_INFO[level()]; }
  function autoHelp() { return Gm.settings.readHelp !== 'ask'; }
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

  /* ---------- pictures for words (rebus), cards and tasks: all are sprite icons ---------- */
  function picture(key, px) {
    const c = Sprites.icon(key, px, Gm ? Gm.form : 'red');
    c.style.width = c.style.height = px + 'px';
    return c;
  }

  /* render a line of text as tappable words (with rebus pictures at A and B) */
  function renderWords(el, text, opts = {}) {
    let prev = '';
    for (const tok of String(text).split(/\s+/)) {
      if (!tok) continue;
      const w = norm(tok), before = prev; prev = w;
      const span = document.createElement('span'); span.className = 'rw'; span.textContent = tok; span.dataset.w = w;
      span.addEventListener('click', (e) => { e.stopPropagation(); say(w, { rate: .75 }); mark(w, 'help'); if (opts.onHelp) opts.onHelp(w); span.classList.add('helped'); });
      el.appendChild(span);
      if (info().rebus && PIC_NOUNS[w] && opts.rebus !== false) { const pic = picture(PIC_NOUNS[w], 30); pic.classList.add('rebus'); el.appendChild(pic); }
      el.appendChild(document.createTextNode(' '));
    }
  }

  /* ---------- what the crab could do right now ---------- */
  const timing = (p) => p.mode === 'shove' || p.mode === 'release';
  function context(p, which) {
    if (!p || timing(p)) return null;
    if (which === 'help') return null;          /* E (dash, claws up) is always free */
    return p.context();
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
    card = { p, verb, correct, choices, onOk, tries: 0, helped: false, openedAt: performance.now() };
    data.cards++;
    if (!hasDom()) return card;
    $('readCard').hidden = false;
    $('rcPrompt').textContent = CARD_PROMPT[level()];
    const pic = $('rcPic'); pic.innerHTML = ''; pic.appendChild(picture(ACTION_PIC[verb], 64));
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
  /* read every choice aloud, one at a time: the child can then pick by listening */
  function cardHelp() {
    if (!card || !hasDom()) return;
    card.helped = true;
    const btns = [...$('rcChoices').children];
    let i = 0;
    const next = () => { if (!card || i >= btns.length) { btns.forEach(b => b.classList.remove('saying')); return; } btns.forEach((b, k) => b.classList.toggle('saying', k === i)); say(card.choices[i], { rate: .8, onend: () => { i++; setTimeout(next, 250); } }); if (!Voice.supported || !Voice.on) { i++; setTimeout(next, 900); } };
    next();
  }
  function chooseCard(i) {
    if (!card || !(i >= 0 && i < card.choices.length)) return false;
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
  function closeCard() { card = null; clearTimeout(helpTimer); if (hasDom()) $('readCard').hidden = true; }

  /* the crab does what was read, and the action stays unlocked for a little while */
  function grant(p, verb) {
    unlocked[verb] = Gm.time + info().window;
    p.input.actionPressed = true;
  }

  /* called every frame after input is gathered (player 1 only) */
  function intercept(p) {
    if (!on() || p.id !== 1 || card || page || timing(p)) return;
    const t = Gm.time;
    if (p.input.actionPressed) {
      const verb = context(p, 'action');
      if (verb && !(unlocked[verb] > t)) { p.input.actionPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
    if (p.input.eggPressed) {
      const verb = context(p, 'help');
      if (verb && !(unlocked[verb] > t)) { p.input.eggPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
  }

  /* ---------- pages (read to grow, and story pages) ---------- */
  function lines(key) { return READ_CHAPTERS[key][level()]; }
  function gate(p, key, cont) {
    if (page) {
      /* a story page is open: it waits, the life-cycle page comes first; two gates at once: try again shortly */
      if (page.opts.gate) { setTimeout(() => gate(p, key, cont), 1000); return; }
      storyQueue.unshift(page.key); page = null; clearTimeout(helpTimer);
    }
    pendingGate = { key, cont, p };
    showPage(key, { gate: true, onDone: () => { const g = pendingGate; pendingGate = null; if (g) g.cont(); } });
  }
  function showPage(key, opts = {}) {
    const ch = READ_CHAPTERS[key]; if (!ch) return;
    page = { key, opts, helped: false, tasks: opts.gate ? info().tasks.slice() : [], step: -1, firstTry: true, openedAt: performance.now() };
    if (!hasDom()) return;
    const L = level();
    $('rpLevel').textContent = LEVEL_INFO[L].name;
    $('rpTitle').textContent = ch.title || '';
    const pic = $('rpPic'); pic.innerHTML = ''; pic.appendChild(picture(ch.pic, 110));
    const box = $('rpText'); box.innerHTML = '';
    for (const line of lines(key)) { const p = document.createElement('p'); p.className = 'rp-line'; renderWords(p, line, { onHelp: () => { page.helped = true; } }); box.appendChild(p); }
    $('rpTask').innerHTML = ''; $('rpTask').hidden = true; $('rpText').classList.remove('put-away');
    $('rpNext').textContent = opts.gate ? 'I read it! ➜' : 'I read it! ✓';
    $('rpNext').hidden = false; $('rpHelp').hidden = false; $('rpHelp').classList.remove('pulse');
    $('rpMic').hidden = !SR();
    $('rpMsg').textContent = '';
    $('readPage').hidden = false;
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
    const starts = []; let pos = 0; for (const s of spans) { starts.push(pos); pos += s.textContent.length + 1; }
    const light = (i) => spans.forEach((s, k) => s.classList.toggle('now', k === i));
    let boundary = false;
    say(text, { rate: .82, onboundary: (ci) => { boundary = true; let i = 0; while (i + 1 < starts.length && starts[i + 1] <= ci) i++; light(i); }, onend: () => light(-1) });
    /* voices without word boundaries: step through the words on a clock */
    const t0 = performance.now();
    const tick = () => { if (!page || boundary) return; const i = Math.floor((performance.now() - t0) / 520); if (i >= spans.length) { light(-1); return; } light(i); requestAnimationFrame(tick); };
    setTimeout(() => { if (!boundary) requestAnimationFrame(tick); }, 700);
    for (const s of spans) mark(s.dataset.w, 'help');
  }
  function pageNext() {
    if (!page) return;
    if (page.step === -1) {
      /* the child says they read it: count the words (as read, or as helped) */
      for (const l of lines(page.key)) markText(l, page.helped ? 'help' : 'right');
      data.pages++; Bus.emit('readPage', page.key, data.pages);
    }
    page.step++;
    if (page.step >= page.tasks.length) return finishPage();
    runTask(page.tasks[page.step]);
  }
  function finishPage() {
    const pg = page; page = null; clearTimeout(helpTimer);
    try { rec && rec.abort(); } catch (e) { /* fine */ }
    if (hasDom()) $('readPage').hidden = true;
    data.stars++; save();
    if (pg.opts.gate) { AudioFX.fanfare && AudioFX.fanfare(); say(level() <= 'B' ? 'Yes! You did it!' : 'Great reading! Now watch what happens.'); }
    if (pg.opts.onDone) pg.opts.onDone();
  }

  /* ---------- tasks ---------- */
  function taskSentence() {
    const max = info().buildMax, ls = lines(page.key).filter(l => tokenize(l).length <= max && tokenize(l).length >= 2);
    return (ls.length ? ls : lines(page.key)).slice().sort((a, b) => tokenize(b).length - tokenize(a).length)[0];
  }
  function taskDone(ok) {
    if (!page || page.answered) return;
    page.answered = true;
    document.querySelectorAll('#rpTask button').forEach(b => { b.disabled = true; });
    result(ok && page.firstTry);
    page.firstTry = true;
    setTimeout(pageNext, 650);
  }
  function taskWrong(el, word) { if (!page || page.answered) return; page.firstTry = false; if (word) mark(word, 'wrong'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } AudioFX.bump && AudioFX.bump(); }
  const CRABBY = ['crab', 'baby', 'young', 'adult', 'rival', 'female', 'king', 'claw', 'march', 'robber', 'shell', 'boy', 'girl'];
  const LARVAL = ['egg', 'eggs', 'zoea', 'megalopa'];
  const SEAISH = ['sea', 'water', 'reef', 'fish', 'whaleshark', 'jelly', 'plankton', 'copepod', 'turtle', 'manta'];
  const LANDISH = ['forest', 'tree', 'leaf', 'flower', 'fruit', 'seedling', 'burrow', 'cliff', 'rock', 'bridge'];
  const VERBS = ['dig', 'swim', 'eat', 'sleep', 'hide', 'grow', 'push', 'run', 'sit', 'play', 'warm', 'cold', 'little', 'big', 'wet', 'dry', 'soft', 'deep', 'hot', 'red', 'blue', 'green'];
  function runTask(kind) {
    page.answered = false; taskFocus = -1;
    const box = $('rpTask'); box.innerHTML = ''; box.hidden = false;
    $('rpNext').hidden = true; $('rpHelp').hidden = true; $('rpMic').hidden = true;
    const head = document.createElement('div'); head.className = 'rt-head'; box.appendChild(head);
    const L = level(), ch = READ_CHAPTERS[page.key];
    /* from C up, the page is put away during the task: the child works from reading, not copying */
    $('rpText').classList.toggle('put-away', L !== 'A' && L !== 'B');
    if (kind === 'match') {
      head.textContent = '🖼️ Which picture goes with the words?'; say('Which picture goes with the words?');
      const same = (a, b) => a === b || [CRABBY, LARVAL, SEAISH, LANDISH].some(g => g.includes(a) && g.includes(b));
      /* the line that names what the picture shows ("I am a pupa!"), so the match is fair */
      const naming = lines(page.key).find(l => tokenize(l).some(w => PIC_NOUNS[w] && same(PIC_NOUNS[w], ch.pic)));
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, naming || taskSentence(), { rebus: false }); box.appendChild(s);
      const pool = ['eggs', 'zoea', 'crab', 'jelly', 'whaleshark', 'leaf', 'cliff', 'moon', 'rain', 'bridge', 'burrow', 'sun'].filter(k => !same(k, ch.pic));
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
          if (norm(x.t) === norm(toks[next])) { slotEls[next].textContent = toks[next]; slotEls[next].classList.add('filled'); b.disabled = true; b.classList.add('used'); next++; AudioFX.pop && AudioFX.pop(1 + next * .1); if (next >= toks.length) { markText(target, page.firstTry ? 'right' : 'help'); taskDone(true); } }
          else taskWrong(b, toks[next]);
        });
        tiles.appendChild(b);
      }
    } else if (kind === 'yesno') {
      head.textContent = '❓ Read the question. Yes or no?'; say('Read the question. Tap yes or no.');
      const qs = (ch.yesno || []).filter(q => offLevel(q[0], L).length === 0);
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Can a crab eat?', true];
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, q, { onHelp: () => { page.firstTry = false; } }); box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-yesno'; box.appendChild(row);
      for (const v of [true, false]) { const b = document.createElement('button'); b.className = 'rt-yn ' + (v ? 'yes' : 'no'); b.textContent = v ? 'yes' : 'no'; b.addEventListener('click', () => { if (v === a) { b.classList.add('right'); markText(q, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
    } else if (kind === 'fill') {
      head.textContent = '✏️ Which word goes in the gap?'; say('Which word goes in the gap?');
      const sent = taskSentence(), toks = sent.split(/\s+/);
      let bi = toks.findIndex(t => PIC_NOUNS[norm(t)]);
      if (bi < 0) bi = toks.findIndex(t => norm(t).length > 3); if (bi < 0) bi = toks.length - 1;
      const answer = norm(toks[bi]);
      const pool = PIC_NOUNS[answer] ? Object.keys(PIC_NOUNS).filter(w => PIC_NOUNS[w] !== PIC_NOUNS[answer] && w.length > 2) : VERBS.filter(w => w !== answer);
      const opts = [answer, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const s = document.createElement('p'); s.className = 'rt-sentence';
      toks.forEach((t, i) => { if (i === bi) { const g = document.createElement('span'); g.className = 'rt-gap'; g.textContent = '____'; s.appendChild(g); const punct = t.replace(/[a-z']/gi, ''); if (punct) s.appendChild(document.createTextNode(punct)); s.appendChild(document.createTextNode(' ')); } else renderWords(s, t, { rebus: false, onHelp: () => { page.firstTry = false; } }); });
      box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-tiles'; box.appendChild(row);
      for (const w of opts) { const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = w; b.addEventListener('click', () => { if (w === answer) { const gap = s.querySelector('.rt-gap'); gap.textContent = toks[bi].replace(/[^a-z']/gi, ''); gap.classList.add('filled'); markText(sent, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b, answer); }); row.appendChild(b); }
    }
  }

  /* ---------- reading aloud into the microphone ---------- */
  function SR() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  async function micRead() {
    const R = SR(); if (!R || !page) return;
    const pg = page;
    if (!(await Grownups.confirmMicrophone())) return;   /* a grown-up says no: the mic stays off */
    if (page !== pg) return;
    const spans = [...$('rpText').querySelectorAll('.rw')], want = spans.map(s => s.dataset.w);
    const heard = new Set();
    try { rec && rec.abort(); } catch (e) { /* fine */ }
    rec = new R(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
    $('rpMic').classList.add('listening'); $('rpMsg').textContent = '🎤 Listening… read the page out loud.';
    Voice.stop();
    let heardDone = false;
    rec.onresult = (e) => {
      if (!page || heardDone) return;
      for (let i = 0; i < e.results.length; i++) for (const w of tokenize(e.results[i][0].transcript)) heard.add(w);
      spans.forEach(s => { if (heard.has(s.dataset.w)) s.classList.add('heard'); });
      const got = want.filter(w => heard.has(w)).length / want.length;
      if (got >= .75) { heardDone = true; try { rec.stop(); } catch (er) { /* fine */ } $('rpMsg').textContent = '⭐ I heard you read it!'; for (const w of want) if (heard.has(w)) mark(w, 'right'); Bus.emit('readAloud', page.key); AudioFX.sticker && AudioFX.sticker(); }
    };
    rec.onerror = (e) => { $('rpMsg').textContent = e.error === 'network' ? 'The microphone needs the internet. Tap "I read it!" instead.' : e.error === 'not-allowed' ? 'The microphone is switched off for this page.' : 'I could not hear. Try again?'; };
    rec.onend = () => { $('rpMic').classList.remove('listening'); };
    try { rec.start(); setTimeout(() => { try { rec.stop(); } catch (e) { /* fine */ } }, 12000); } catch (e) { $('rpMsg').textContent = 'The microphone did not start.'; }
  }

  /* ---------- missions ---------- */
  const Wo = () => Gm.world;
  function fitsWho(m, p) {
    const walking = p.stage === 'crab' && p.mode === 'walk' && p.busy <= 0;
    switch (m.who) {
      case 'zoea': return p.stage === 'zoea' && p.mode === 'swim';
      case 'swim': return p.swimming && p.mode === 'swim';
      case 'mega': return p.stage === 'megalopa' && p.mode === 'swim' && p.x < -800;
      case 'baby': return walking && p.instar === 1 && !p.flags.forest;
      case 'forest': return walking && !!p.flags.forest && !p.flags.migrating && !p.full;
      case 'march': return walking && !!p.flags.migrating && !p.flags.dipped;
      case 'rival': return walking && !!Wo().rival() && Wo().rival().mode === 'stand';
    }
    return true;
  }
  function eligible(p) {
    const L = level();
    return MISSIONS.filter(m => {
      if (m.key === lastMission) return false;
      if (m.from && READ_LEVELS.indexOf(L) < READ_LEVELS.indexOf(m.from)) return false;
      if (!fitsWho(m, p)) return false;
      if (m.key === 'jelly' && !Wo().jellies.some(j => Math.abs(j.x - p.x) < 600)) return false;
      if (m.key === 'deep' && p.x > WORLD.reefDrop) return false;      /* over the reef the sea is too shallow to dive deep */
      if (m.key === 'copepod' && !Wo().plankton.some(q => q.kind === 'copepod')) return false;
      if (m.key === 'shade' && p.shade === 'shelter') return false;
      if (m.key === 'bridge' && (p.flags.bridge || p.x < WORLD.bridgeR)) return false;
      if (checkMission(m, p, { base: baseFor(m, p) })) return false;
      return true;
    });
  }
  function baseFor(m, p) { const s = p.stats; return m.key === 'plankton' ? s.plankton : m.key === 'copepod' ? s.copepods : m.key === 'leaf' ? s.leaves : m.key === 'flower' ? s.flowers : m.key === 'fruit' ? s.fruits : m.key === 'dig' ? s.dug : m.key === 'rival' ? s.wins + s.losses : 0; }
  function checkMission(m, p, ms = mission) {
    const W = Wo(), s = p.stats;
    switch (m.key) {
      case 'plankton': return s.plankton >= ms.base + 10;
      case 'deep': return p.swimming && p.y > 270;
      case 'top': return p.swimming && p.y < W.seaLevel() + 10;
      case 'copepod': return s.copepods > ms.base;
      case 'jelly': return p.mode === 'ride';
      case 'reef': return p.x > -700;
      case 'shade': return p.shade === 'shelter';
      case 'cliff': return p.y < -300;
      case 'leaf': return s.leaves > ms.base;
      case 'flower': return s.flowers > ms.base;
      case 'fruit': return s.fruits > ms.base;
      case 'dig': return s.dug >= ms.base + 20;
      case 'bridge': return !!p.flags.bridge;
      case 'sea': return p.x < 100;
      case 'rival': return s.wins + s.losses > ms.base;
    }
    return false;
  }
  function startMission(p) {
    const list = eligible(p); if (!list.length) { missionCool = 8; return; }
    const m = list[(Math.random() * list.length) | 0];
    mission = { m, t: 0, helped: false, base: baseFor(m, p) };
    lastMission = m.key;
    if (!hasDom()) return;
    const box = $('mcText'); box.innerHTML = ''; renderWords(box, m[level()], { onHelp: () => { mission.helped = true; } });
    $('missionCard').hidden = false; $('missionCard').classList.remove('done');
    placeMission();
    AudioFX.click && AudioFX.click();
    clearTimeout(hintSayTimer);
    if (autoHelp()) hintSayTimer = setTimeout(() => { if (mission && mission.m === m) missionHelp(); }, info().help * 1000 * 1.5);
  }
  /* the HUD wraps to two rows on narrow screens: sit just below it */
  function placeMission() { const hud = $('hud'); if (hud && hasDom()) $('missionCard').style.top = Math.round(hud.getBoundingClientRect().bottom + 10) + 'px'; }
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
  function dropMission(cool) { mission = null; missionCool = cool; if (hasDom()) $('missionCard').hidden = true; }

  /* ---------- per frame (runs only while no panel is open) ---------- */
  function update(dt) {
    if (!Gm) return;
    auto.hide = Math.max(0, auto.hide - dt);
    const show = on() && Gm.started;
    if (!show) { if (mission) dropMission(10); storyQueue.length = 0; return; }
    /* a story page waits for the moment to be over, then opens */
    const p = Gm.players[0];
    if (!p || timing(p) || p.mode === 'tossed' || p.tumble > 0 || p.molting > 0 || p.busy > 0 || p.mode === 'moult') return;
    if (storyQueue.length && !card && !page && !Cinematic.active) { showPage(storyQueue.shift()); return; }
    if (p.stage === 'egg' || ['harden', 'brood', 'rest'].includes(p.mode)) { if (mission) dropMission(10); return; }
    if (!mission) { missionCool -= dt; if (missionCool <= 0 && !card && !page && !Cinematic.active) startMission(p); return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) {
      missionClock = .4;
      const m = mission.m;
      /* a mission for a different part of life (a zoea's mission after it moults) quietly ends */
      const fits = m.who === 'zoea' ? p.stage === 'zoea' : m.who === 'swim' || m.who === 'mega' ? p.swimming : m.who === 'baby' ? p.stage === 'crab' && !p.flags.forest : m.who === 'march' ? !!p.flags.migrating : p.stage === 'crab';
      if (checkMission(m, p)) finishMission();
      else if (!fits || mission.t > 150) dropMission(10);
    }
  }
  function queueStory(key) {
    if (!on() || !READ_CHAPTERS[key] || READ_CHAPTERS[key].gate || storyShown.has(key)) return;
    storyShown.add(key); storyQueue.push(key);
    data.shown = [...storyShown]; save();
  }
  /* the game started (or a new generation began): the egg page comes first */
  function onStart() { storyShown.clear(); data.shown = []; save(); const p = Gm.players[0]; if (p && p.stage === 'egg') queueStory('egg'); }

  /* ---------- keys and gamepad while a card or page is open ---------- */
  /* a held or mashed key (the game is played by mashing Space) never answers a card or skips a page */
  const settled = (o) => performance.now() - o.openedAt > 700;
  function keydown(e) {
    if (!card && !page) return false;
    const k = e.key;
    if (e.repeat) { e.preventDefault(); return true; }
    if (card) {
      if (/^[1-4]$/.test(k)) { if (+k - 1 < card.choices.length && settled(card)) chooseCard(+k - 1); e.preventDefault(); return true; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { focus = (focus + card.choices.length - 1) % card.choices.length; refocus(); e.preventDefault(); return true; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { focus = (focus + 1) % card.choices.length; refocus(); e.preventDefault(); return true; }
      if (k === ' ' || k === 'Enter') { if (settled(card)) chooseCard(focus); e.preventDefault(); return true; }
      if (k === 'h' || k === 'H' || k === '?') { cardHelp(); return true; }
      if (k === 'Escape') { closeCard(); return true; }
      return true;
    }
    if (page) { if ((k === ' ' || k === 'Enter') && page.step === -1 && settled(page)) pageNext(); if (k === ' ') e.preventDefault(); return true; }
    return false;
  }
  const padPrev = {};
  function gamepad(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (card) {
      const dir = g.x > .5 ? 1 : g.x < -.5 ? -1 : 0;
      if (dir && dir !== padPrev.dir) { focus = (focus + dir + card.choices.length) % card.choices.length; refocus(); }
      padPrev.dir = dir;
      if (g.actionPressed && settled(card)) chooseCard(focus);
      if (g.eggPressed) closeCard();
    } else if (page && page.step === -1) { if (g.actionPressed && settled(page)) pageNext(); }
    else if (page && hasDom()) {
      /* a task: the stick moves between its buttons, A presses one */
      const btns = [...$('rpTask').querySelectorAll('button:not([disabled])')];
      if (!btns.length) return;
      const dir = g.x > .5 || g.y > .5 ? 1 : g.x < -.5 || g.y < -.5 ? -1 : 0;
      if (dir && dir !== padPrev.dir) { taskFocus = (taskFocus + dir + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('focus', i === taskFocus)); }
      padPrev.dir = dir;
      if (g.actionPressed && btns[taskFocus]) btns[taskFocus].click();
    }
  }
  let taskFocus = -1;

  /* ---------- hints at the child's level ---------- */
  function hintText(key) { if (!on()) return null; const h = READ_HINTS[key]; return h ? h[level()] : null; }

  /* ---------- My Words and the grown-up report ---------- */
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
    if (!list.length) grid.innerHTML = '<p class="tiny">No words yet. Switch on "I read to play" and start reading!</p>';
    $('wordsCount').textContent = `${known} known · ${list.length} met`;
    const r = report();
    $('readReport').innerHTML = `<div><b>Mode:</b> ${r.mode === 'play' ? 'I read to play' : 'Read to me'} · <b>Level:</b> ${r.level}${Gm.settings.readAuto ? ' (auto)' : ''}</div>
      <div><b>Without help, lately:</b> ${r.accuracy === null ? 'not enough reading yet' : Math.round(r.accuracy * 100) + '%'} · <b>Pages:</b> ${r.pages} · <b>Missions:</b> ${r.missions} · <b>Word cards:</b> ${r.cards}</div>
      <div><b>Suggestion:</b> ${r.suggest}</div>
      <div><b>Tricky words to practise:</b></div><div class="words" id="trickyWords"></div>`;
    const tw = $('trickyWords'); for (const w of r.tricky.slice(0, 30)) { const s = document.createElement('span'); s.textContent = w; tw.appendChild(s); } if (!r.tricky.length) tw.textContent = '—';
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
    storyShown.clear(); for (const k of Array.isArray(data.shown) ? data.shown : []) if (READ_CHAPTERS[k]) storyShown.add(k);
    for (const k in unlocked) delete unlocked[k];
    /* the life cycle's big steps wait for a page to be read */
    if (typeof Crab !== 'undefined' && !Crab.prototype._readWrapped) {
      Crab.prototype._readWrapped = true;
      const orig = Crab.prototype.milestone;
      Crab.prototype.milestone = function (key, fn) {
        if (!on() || !READ_CHAPTERS[key] || !READ_CHAPTERS[key].gate) return orig.call(this, key, fn);
        this.flags['m_' + key] = true;
        gate(this, key, fn);
      };
    }
    for (const ev in STORY_TRIGGERS) Bus.on(ev, (...a) => { const p = a.find(x => x && x.isPlayer); if (!p || p.id === 1) queueStory(STORY_TRIGGERS[ev]); });
    if (!hasDom()) return;
    $('rpNext').addEventListener('click', pageNext);
    $('rpHelp').addEventListener('click', pageHelp);
    $('rpMic').addEventListener('click', micRead);
    $('rcHelp').addEventListener('click', cardHelp);
    $('rcBack').addEventListener('click', () => { if (card) closeCard(); });
    $('mcHelp').addEventListener('click', missionHelp);
    $('wordsClose').addEventListener('click', () => { $('myWords').hidden = true; });
    addEventListener('resize', placeMission);
  }
  /* test hooks (smoke.js): finish whatever page is open, as if it was read */
  function _solveGate() {
    if (page) { const pg = page; page = null; if (hasDom()) $('readPage').hidden = true; if (pg.opts.onDone) pg.opts.onDone(); return true; }
    if (pendingGate) { const g = pendingGate; pendingGate = null; g.cont(); return true; }
    return false;
  }

  /* a new game: nothing from the old one stays on screen or waits to happen */
  function reset() {
    if (mission) dropMission(20);
    if (card) closeCard();
    if (page) { page = null; clearTimeout(helpTimer); if (hasDom()) $('readPage').hidden = true; }
    pendingGate = null; storyQueue.length = 0;
    for (const k in unlocked) delete unlocked[k];
  }

  return { init, reset, on, level, setLevel, context, intercept, update, gate, showPage, chooseCard, keydown, gamepad, hintText, openWords, report, accuracy, onStart, queueStory, picture,
    cardOpen: () => !!card, pageOpen: () => !!page, busy: () => !!card || !!page, stats: () => data, choicesFor, _solveGate, _card: () => card, _page: () => page,
    _missionNow: () => { missionCool = 0; }, mission: () => mission,
    _startMission: (key, p) => { const m = MISSIONS.find(x => x.key === key); mission = { m, t: 0, helped: false, base: baseFor(m, p) }; missionClock = 0; return mission; } };
})();
