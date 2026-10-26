/* ============================================================
   reading.js — Read to Play (here: Read to Build)
   ============================================================
   When the reading mode is "I read to play", reading is how the
   castle is built (the pattern is Frog Pond's READING_DESIGN.md,
   as in the whole Tactile Forge family):

   BUILD CARDS   Placing a tile or a piece of furniture opens a card
                 of words at the child's level; tapping the word
                 that names it ("stone", "a bed", "put a throne
                 here") places it, and unlocks that thing for a few
                 seconds of free building.
   READ TO GROW  Four big moments wait for a leveled page to be read
                 and its task done: the first horse, the first feast,
                 the first joust and the dragon.
   STORY PAGES   The first stone, the first room, naming a room, the
                 moat, the drawbridge, a tall tower, the knights,
                 night, snow, rain, the carriage, market day, the
                 fireworks, the swans and the garden each open a
                 leveled page once, no gate.
   MISSIONS      "Put a bed in a room."  The sentence is shown, not
                 spoken; doing it proves it was read.
   HELP          Any word can be tapped to hear it.  Help comes by
                 itself after a delay if the grown-up allows it.
                 Two wrong taps and the answer glows and is read.
   TRACKING      Every word: right (unaided), wrong, helped.  The
                 level can adjust itself.  My Words shows mastery
                 and a report for grown-ups.
   ============================================================ */
'use strict';

const Reading = (function () {
  const $ = (id) => (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  const hasDom = () => !!$('readCard');
  const KEY = 'castle.reading';
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
  function picture(key, px) { const c = Sprites.icon(key, px); c.style.width = c.style.height = px + 'px'; return c; }

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

  /* ---------- build cards ---------- */
  const ALL_WORDS = () => { const s = new Set(); for (const k of ITEM_KEYS) s.add(ITEMS[k].word); for (const k of BUILD_TOOLS) { const t = TILE_BY_KEY[k]; if (t !== undefined) s.add(TILE_INFO[t].word); } return [...s]; };
  function choicesFor(word) {
    const L = level(), n = info().choices, correct = buildText(word, L);
    const pool = ALL_WORDS().filter(w => w !== word).map(w => buildText(w, L)).filter(t => t !== correct);
    pool.sort((a, b) => ((data.words[norm(b.split(' ').pop())] || {}).h || 0) - ((data.words[norm(a.split(' ').pop())] || {}).h || 0) + (Math.random() - .5) * 2);
    const out = [correct, ...pool.slice(0, n - 1)];
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
    return { correct, choices: out };
  }
  function openCard(key, word, pic, onOk) {
    const { correct, choices } = choicesFor(word);
    card = { key, word, correct, choices, onOk, tries: 0, helped: false, openedAt: performance.now() };
    data.cards++;
    if (!hasDom()) return card;
    $('readCard').hidden = false;
    $('rcPrompt').textContent = CARD_PROMPT[level()];
    const p = $('rcPic'); p.innerHTML = ''; p.appendChild(picture(pic, 64));
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
    const c = card, pickT = c.choices[i];
    if (pickT === c.correct) {
      const clean = c.tries === 0 && !c.helped;
      markText(c.correct, clean ? 'right' : 'help');
      result(clean);
      closeCard();
      AudioFX.sticker && clean && AudioFX.sticker();
      Bus.emit('readCard', c.key, clean);
      c.onOk && c.onOk();
      return true;
    }
    c.tries++; markText(c.correct, 'wrong');
    if (hasDom()) { const b = $('rcChoices').children[i]; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    AudioFX.bump && AudioFX.bump();
    if (c.tries >= 2) { c.helped = true; if (hasDom()) [...$('rcChoices').children].forEach((b, k) => b.classList.toggle('glow', c.choices[k] === c.correct)); say(c.correct, { rate: .8 }); }
    else say('Try again.');
    return false;
  }
  function closeCard() { card = null; clearTimeout(helpTimer); if (hasDom()) $('readCard').hidden = true; }
  /* the builder wants to place something: with Read to Build on, a card comes first (once per thing per window).
     Returns true when the card took over (the caller does nothing now; fn runs when the word is read). */
  function gateBuild(key, word, pic, fn) {
    if (!on() || card || page) return false;
    if (unlocked[key] > Gm.time) return false;
    openCard(key, word, pic, () => { unlocked[key] = Gm.time + info().window; fn(); });
    return true;
  }

  /* ---------- pages (read to grow, and story pages) ---------- */
  function lines(key) { return READ_CHAPTERS[key][level()]; }
  function gate(p, key, cont) {
    if (page) {
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
    if (page.step === -1) { for (const l of lines(page.key)) markText(l, page.helped ? 'help' : 'right'); data.pages++; Bus.emit('readPage', page.key, data.pages); }
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
  const BUILDING = ['stone', 'tower', 'room', 'cone', 'door', 'arch', 'gate', 'stair', 'battlement', 'roof', 'drawbridge', 'bridge', 'moat'];
  const FOLK = ['knight', 'horse', 'princess', 'prince', 'crown', 'dragon', 'cook', 'jester', 'carriage', 'joust', 'feast', 'market'];
  const ANIMALS = ['dog', 'cat', 'swan', 'pigeon', 'owl', 'mouse', 'horse'];
  const SKY = ['sun', 'moon', 'night', 'snow', 'rain', 'fireworks'];
  const VERBS = ['dig', 'build', 'put', 'make', 'sleep', 'eat', 'read', 'ride', 'look', 'tap', 'big', 'tall', 'little', 'cold', 'wet', 'dark', 'red', 'blue', 'green', 'white', 'gold'];
  function runTask(kind) {
    page.answered = false; taskFocus = -1;
    const box = $('rpTask'); box.innerHTML = ''; box.hidden = false;
    $('rpNext').hidden = true; $('rpHelp').hidden = true; $('rpMic').hidden = true;
    const head = document.createElement('div'); head.className = 'rt-head'; box.appendChild(head);
    const L = level(), ch = READ_CHAPTERS[page.key];
    $('rpText').classList.toggle('put-away', L !== 'A' && L !== 'B');
    if (kind === 'match') {
      head.textContent = '🖼️ Which picture goes with the words?'; say('Which picture goes with the words?');
      const same = (a, b) => a === b || [BUILDING, FOLK, ANIMALS, SKY].some(g => g.includes(a) && g.includes(b));
      const naming = lines(page.key).find(l => tokenize(l).some(w => PIC_NOUNS[w] && same(PIC_NOUNS[w], ch.pic)));
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, naming || taskSentence(), { rebus: false }); box.appendChild(s);
      const pool = ['stone', 'tower', 'horse', 'knight', 'moat', 'dragon', 'swan', 'sun', 'moon', 'door', 'throne', 'canopybed', 'appletree'].filter(k => !same(k, ch.pic));
      const opts = [ch.pic, ...pool.sort(() => Math.random() - .5).slice(0, 2)].sort(() => Math.random() - .5);
      const row = document.createElement('div'); row.className = 'rt-pics'; box.appendChild(row);
      box.dataset.answer = ch.pic;
      for (const k of opts) { const b = document.createElement('button'); b.className = 'rt-pic'; b.dataset.pic = k; b.appendChild(picture(k, 90)); b.addEventListener('click', () => { if (k === ch.pic) { b.classList.add('right'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
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
      box.dataset.next = toks[next];
      for (const x of shuffled) {
        const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = x.t;
        b.addEventListener('click', () => {
          if (norm(x.t) === norm(toks[next])) { slotEls[next].textContent = toks[next]; slotEls[next].classList.add('filled'); b.disabled = true; b.classList.add('used'); next++; box.dataset.next = toks[next] || ''; AudioFX.pop && AudioFX.pop(1 + next * .1); if (next >= toks.length) { markText(target, page.firstTry ? 'right' : 'help'); taskDone(true); } }
          else taskWrong(b, toks[next]);
        });
        tiles.appendChild(b);
      }
    } else if (kind === 'yesno') {
      head.textContent = '❓ Read the question. Yes or no?'; say('Read the question. Tap yes or no.');
      const qs = (ch.yesno || []).filter(q => offLevel(q[0], L).length === 0);
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Is this my castle?', true];
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, q, { onHelp: () => { page.firstTry = false; } }); box.appendChild(s);
      const row = document.createElement('div'); row.className = 'rt-yesno'; box.appendChild(row); box.dataset.answer = String(a);
      for (const v of [true, false]) { const b = document.createElement('button'); b.className = 'rt-yn ' + (v ? 'yes' : 'no'); b.dataset.v = String(v); b.textContent = v ? 'yes' : 'no'; b.addEventListener('click', () => { if (v === a) { b.classList.add('right'); markText(q, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b); }); row.appendChild(b); }
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
      const row = document.createElement('div'); row.className = 'rt-tiles'; box.appendChild(row); box.dataset.answer = answer;
      for (const w of opts) { const b = document.createElement('button'); b.className = 'rt-tile'; b.textContent = w; b.addEventListener('click', () => { if (w === answer) { const gap = s.querySelector('.rt-gap'); gap.textContent = toks[bi].replace(/[^a-z']/gi, ''); gap.classList.add('filled'); markText(sent, page.firstTry ? 'right' : 'help'); taskDone(true); } else taskWrong(b, answer); }); row.appendChild(b); }
    }
  }

  /* ---------- reading aloud into the microphone ---------- */
  function SR() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  async function micRead() {
    const R = SR(); if (!R || !page) return;
    const pg = page;
    if (!(await Grownups.confirmMicrophone())) return;
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
  const summary = () => Gm.castle.summary(Gm.world);
  function baseFor(m) { const S = summary(), st = Gm.castle.stats; return { stones: st.stones, doors: S.doors, windows: S.windows, tallest: S.tallest, water: S.water, items: st.items, beds: S.items.bed + S.items.canopybed, tables: S.items.longtable + S.items.table + S.items.kitchentable + S.items.desk, flags: S.items.flag, brushed: st.brushed, named: S.named, garden: S.garden, photos: st.photos, stairs: S.stairs }; }
  function checkMission(m, ms = mission) {
    const b = ms.base, S = summary(), st = Gm.castle.stats;
    switch (m.key) {
      case 'stones': return st.stones >= b.stones + 5;
      case 'door': return S.doors > b.doors;
      case 'window': return S.windows > b.windows;
      case 'tower': return S.tallest >= b.tallest + 2;
      case 'moat': return S.water >= b.water + 3;
      case 'item': return st.items > b.items;
      case 'bed': return S.items.bed + S.items.canopybed > b.beds;
      case 'table': return S.items.longtable + S.items.table + S.items.kitchentable + S.items.desk > b.tables;
      case 'flag': return S.items.flag > b.flags;
      case 'brush': return st.brushed > b.brushed;
      case 'name': return S.named > b.named;
      case 'garden': return S.garden > b.garden;
      case 'photo': return st.photos > b.photos;
      case 'stairs': return S.stairs > b.stairs;
    }
    return false;
  }
  function eligible() {
    const L = level(), S = summary();
    return MISSIONS.filter(m => {
      if (m.key === lastMission) return false;
      if (m.from && READ_LEVELS.indexOf(L) < READ_LEVELS.indexOf(m.from)) return false;
      if ((m.key === 'bed' || m.key === 'table' || m.key === 'item' || m.key === 'name') && S.rooms < 1) return false;
      if (m.key === 'brush' && S.horses < 1) return false;
      if (m.key === 'flag' && S.stones < 1) return false;
      return true;
    });
  }
  function startMission() {
    const list = eligible(); if (!list.length) { missionCool = 8; return; }
    const m = list[(Math.random() * list.length) | 0];
    mission = { m, t: 0, helped: false, base: baseFor(m) };
    lastMission = m.key;
    if (!hasDom()) return;
    const box = $('mcText'); box.innerHTML = ''; renderWords(box, m[level()], { onHelp: () => { mission.helped = true; } });
    $('missionCard').hidden = false; $('missionCard').classList.remove('done');
    placeMission();
    AudioFX.click && AudioFX.click();
    clearTimeout(hintSayTimer);
    if (autoHelp()) hintSayTimer = setTimeout(() => { if (mission && mission.m === m) missionHelp(); }, info().help * 1000 * 1.5);
  }
  function placeMission() { const hud = $('hud'); if (hud && hasDom()) $('missionCard').style.top = Math.round(hud.getBoundingClientRect().bottom + 10) + 'px'; }
  function missionHelp() { if (!mission) return; mission.helped = true; say(mission.m[level()], { rate: .85 }); markText(mission.m[level()], 'help'); }
  function finishMission() {
    const ms = mission; mission = null; missionCool = 30;
    const text = ms.m[level()];
    markText(text, ms.helped ? 'help' : 'right'); result(!ms.helped);
    data.missions++; data.stars++; save();
    Bus.emit('missionDone', ms.m.key, data.missions);
    if (Gm.particles && Gm.cam) { const [wx, wy] = [Gm.cam.x, Gm.cam.y - 60]; Gm.particles.sparkle(wx, wy, 26, '#ffe27a', 60); Gm.particles.text(wx, wy - 30, '⭐', '#ffe27a', 26); }
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
    if (storyQueue.length && !card && !page && !Cinematic.active) { showPage(storyQueue.shift()); return; }
    if (!mission) { missionCool -= dt; if (missionCool <= 0 && !card && !page && !Cinematic.active) startMission(); return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) { missionClock = .4; if (checkMission(mission.m)) finishMission(); else if (mission.t > 240) dropMission(10); }
  }
  function queueStory(key) {
    if (!on() || !READ_CHAPTERS[key] || READ_CHAPTERS[key].gate || storyShown.has(key)) return;
    storyShown.add(key); storyQueue.push(key);
    data.shown = [...storyShown]; save();
  }
  function onStart() { storyShown.clear(); data.shown = []; save(); queueStory('start'); }

  /* ---------- keys and gamepad while a card or page is open ---------- */
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
    if (!list.length) grid.innerHTML = '<p class="tiny">No words yet. Switch on "I read to play" and start building!</p>';
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
    /* the big moments wait for a page to be read */
    if (typeof Castle !== 'undefined' && !Castle.prototype._readWrapped) {
      Castle.prototype._readWrapped = true;
      const orig = Castle.prototype.milestone;
      Castle.prototype.milestone = function (key, fn) {
        if (!on() || !READ_CHAPTERS[key] || !READ_CHAPTERS[key].gate || this.flags['m_' + key]) return orig.call(this, key, fn);
        this.flags['m_' + key] = true;
        gate(this, key, fn);
      };
    }
    for (const ev in STORY_TRIGGERS) Bus.on(ev, () => queueStory(STORY_TRIGGERS[ev]));
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
  function reset() {
    if (mission) dropMission(20);
    if (card) closeCard();
    if (page) { page = null; clearTimeout(helpTimer); if (hasDom()) $('readPage').hidden = true; }
    pendingGate = null; storyQueue.length = 0;
    for (const k in unlocked) delete unlocked[k];
  }

  return { init, reset, on, level, setLevel, gateBuild, update, gate, showPage, chooseCard, keydown, gamepad, hintText, openWords, report, accuracy, onStart, queueStory, picture,
    cardOpen: () => !!card, pageOpen: () => !!page, busy: () => !!card || !!page, stats: () => data, choicesFor, _solveGate, _card: () => card, _page: () => page,
    _missionNow: () => { missionCool = 0; }, mission: () => mission, checkMission,
    _startMission: (key) => { const m = MISSIONS.find(x => x.key === key); mission = { m, t: 0, helped: false, base: baseFor(m) }; missionClock = 0; return mission; } };
})();
