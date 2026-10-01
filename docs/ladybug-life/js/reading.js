/* ============================================================
   reading.js — Read to Play
   ============================================================
   When the reading mode is "I read to play", reading is how the
   game is played (the pattern is Frog Pond's READING_DESIGN.md):

   ACTION CARDS  The action button (Space, GO!, gamepad A, E for
                 eggs) no longer acts by itself.  It opens a card
                 of words at the child's level; tapping the word
                 that fits the moment ("go" in the egg, "eat" while
                 chewing, "stick" at a glowing leaf, "fly", "land",
                 "freeze" when the bird comes) makes the ladybug do
                 it, and unlocks that action for a few seconds so
                 play stays fluid.
   READ TO GROW  Each molt, pupating and coming out as a ladybug
                 waits for a leveled page to be read and its task
                 done: match a picture (A), build the sentence
                 (B, C), answer yes/no (C+), fill the blank (D, E).
   STORY PAGES   First flight, the bird, the ants, eggs, winter and
                 spring each open a leveled page once, no gate.
   MISSIONS      "Crawl up to the top."  The sentence is shown, not
                 spoken; going there proves it was understood.
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
  const KEY = 'ladybug.reading';
  let Gm = null, cb = {};
  let data = { words: {}, recent: [], stars: 0, pages: 0, missions: 0, cards: 0, levelUps: 0 };
  let card = null, page = null, mission = null, missionCool = 20, missionClock = 0, lastMission = null;
  const unlocked = {}, auto = { hide: 0 };
  let pendingGate = null, helpTimer = null, hintSayTimer = null, focus = 0, rec = null;
  const storyQueue = [], storyShown = new Set();

  const load = () => { try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* fine */ } };
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

  /* ---------- pictures for words (rebus), cards and tasks ---------- */
  function drawCustom(key, ctx, s) {
    const sp = Gm ? Gm.speciesDef() : SPECIES.sevenspot;
    ctx.save(); ctx.scale(s, s);
    switch (key) {
      case 'aphid': case 'aphid:green': case 'aphid:pink': case 'aphid:black': case 'aphid:yellow': ctx.rotate(-.5); Sprites.drawAphid(ctx, { s: 3.6, variant: key.split(':')[1] || 'green' }); break;
      case 'ant': ctx.rotate(-.5); Sprites.drawAnt(ctx, { s: 2.1, walk: 1 }); break;
      case 'bird': ctx.rotate(-.35); Sprites.drawBird(ctx, { s: .8, phase: 1.2, col: '#2a3440' }); break;
      case 'wings': ctx.rotate(-Math.PI / 2); Sprites.drawAdult(ctx, { s: .5, species: sp, open: 1, wingPhase: 1 }); break;
      case 'spots': ctx.rotate(-Math.PI / 2); Sprites.drawAdult(ctx, { s: .78, species: sp }); break;
      case 'skin': ctx.rotate(-.5); Sprites.drawLarva(ctx, { s: .95, instar: 2, pale: .72, walk: 1.2, chew: .2 }); break;
      case 'leaf': ctx.rotate(-.5); Sprites.drawLeaf(ctx, { variant: 1, size: 74, curl: .1, ang: 0, phase: 0, petiole: 10, shape: 'ovate', fall: 1 }, -44, 0, 0, false); break;
      case 'flower': Sprites.drawFlower(ctx, { size: 32, hue: .2, kind: 'rose', ang: 0, phase: 0 }, -26, 0, 0); break;
      case 'plant':
        ctx.strokeStyle = '#4f8a33'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo(-6, 0, 2, -38); ctx.stroke();
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.quadraticCurveTo(14, -2, 22, -16); ctx.stroke();
        ctx.fillStyle = '#69a84a';
        for (const [x, y, a] of [[-16, 18, -.5], [16, 24, .5], [-14, -14, -.7], [24, -20, .4], [2, -40, -1.5]]) { ctx.beginPath(); ctx.ellipse(x, y, 13, 6, a, 0, TAU); ctx.fill(); }
        break;
      case 'grass':
        ctx.strokeStyle = '#5fa040'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 30); ctx.quadraticCurveTo(i * 8 + 4, 0, i * 8 + (i % 2 ? 10 : -8), -26 + Math.abs(i) * 4); ctx.stroke(); }
        break;
      case 'wall': {
        ctx.fillStyle = '#8f8674'; ctx.fillRect(-40, -30, 80, 60);
        ctx.strokeStyle = '#5f5848'; ctx.lineWidth = 2.5;
        for (const y of [-10, 10]) { ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(40, y); ctx.stroke(); }
        for (const [x, y0, y1] of [[-14, -30, -10], [18, -30, -10], [-26, -10, 10], [6, -10, 10], [-8, 10, 30], [24, 10, 30]]) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
        ctx.fillStyle = '#1e1a14'; ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(4, -8); ctx.lineTo(-2, 6); ctx.lineTo(6, 30); ctx.lineTo(-4, 30); ctx.lineTo(-8, 6); ctx.lineTo(-2, -8); ctx.closePath(); ctx.fill();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(12, -8, 22, 0, TAU); ctx.fill(); break;
      case 'rain': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x - 5, 32); ctx.stroke(); } break;
      case 'snow': ctx.strokeStyle = '#6fb8e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.moveTo(-8, -20); ctx.lineTo(0, -12); ctx.lineTo(8, -20); ctx.moveTo(-8, 20); ctx.lineTo(0, 12); ctx.lineTo(8, 20); ctx.stroke(); ctx.restore(); } break;
    }
    ctx.restore();
  }
  const ICON_PIC = { egg: 'egg', larva: 'L3', L1: 'L1', L2: 'L2', L3: 'L3', L4: 'L4', pupa: 'pupa', adult: 'adult' };
  function picture(key, px) {
    let c;
    if (ICON_PIC[key]) c = Sprites.icon(ICON_PIC[key], Gm.speciesDef(), px);
    else { c = document.createElement('canvas'); c.width = c.height = px * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); drawCustom(key, ctx, px / 100); }
    c.style.width = c.style.height = px + 'px';
    return c;
  }

  /* render a line of text as tappable words (with rebus pictures at A and B) */
  const APHID_COLOURS = ['green', 'pink', 'black', 'yellow'];
  function renderWords(el, text, opts = {}) {
    let prev = '';
    for (const tok of String(text).split(/\s+/)) {
      if (!tok) continue;
      const w = norm(tok), before = prev; prev = w;
      const span = document.createElement('span'); span.className = 'rw'; span.textContent = tok; span.dataset.w = w;
      span.addEventListener('click', (e) => { e.stopPropagation(); say(w, { rate: .75 }); mark(w, 'help'); if (opts.onHelp) opts.onHelp(w); span.classList.add('helped'); });
      el.appendChild(span);
      /* "a pink aphid" gets a pink aphid */
      if (info().rebus && PIC_NOUNS[w] && opts.rebus !== false) { const key = PIC_NOUNS[w] === 'aphid' && APHID_COLOURS.includes(before) ? 'aphid:' + before : PIC_NOUNS[w]; const pic = picture(key, 30); pic.classList.add('rebus'); el.appendChild(pic); }
      el.appendChild(document.createTextNode(' '));
    }
  }

  /* ---------- what the ladybug could do right now ---------- */
  function danger(p) { const b = Gm.bird; return !!b && b.state === 'warning' && p.onBranch(); }
  function context(p, which) {
    if (which === 'eggs') return p.state === 'adult' && p.readyFlag && p.pupaSpot ? 'eggs' : null;
    switch (p.state) {
      case 'egg': return 'go';
      case 'pupa': return 'twitch';
      case 'larva': case 'adult':
        if (danger(p)) return 'hide';
        if (p.prey) return 'eat';
        if (p.state === 'larva') return p.readyFlag && p.pupaSpot ? 'pupate' : null;
        return p.fresh < .3 ? 'fly' : null;
      case 'flying':
        if (p.crackNear) return 'sleep';
        return p.landSpot ? 'land' : null;
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
  function closeCard() { card = null; clearTimeout(helpTimer); if (hasDom()) $('readCard').hidden = true; }

  /* the ladybug does what was read, and the action stays unlocked for a little while */
  function grant(p, verb) {
    unlocked[verb] = Gm.time + info().window;
    switch (verb) {
      case 'hide': auto.hide = 3; break;
      case 'eggs': p.input.eggPressed = true; break;
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
    if (p.input.eggPressed) {
      const verb = context(p, 'eggs');
      if (verb && !(unlocked[verb] > t)) { p.input.eggPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
    /* "freeze" was read: hold still for the child until the bird has gone by */
    if (auto.hide > 0) { p.input.y = 1; p.input.x = 0; p.route = null; }
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
  const LARVAL = ['skin', 'larva', 'L1', 'L2', 'L3', 'L4'];
  const LADYBUG = ['adult', 'wings', 'spots'];
  const VERBS = ['crawl', 'fly', 'eat', 'sleep', 'hide', 'grow', 'land', 'stick', 'freeze', 'wiggle', 'kick', 'sit', 'play', 'warm', 'cold', 'little', 'big', 'yellow', 'red', 'black', 'hard', 'soft'];
  function runTask(kind) {
    const box = $('rpTask'); box.innerHTML = ''; box.hidden = false;
    $('rpNext').hidden = true; $('rpHelp').hidden = true; $('rpMic').hidden = true;
    const head = document.createElement('div'); head.className = 'rt-head'; box.appendChild(head);
    const L = level(), ch = READ_CHAPTERS[page.key];
    /* from C up, the page is put away during the task: the child works from reading, not copying */
    $('rpText').classList.toggle('put-away', L !== 'A' && L !== 'B');
    if (kind === 'match') {
      head.textContent = '🖼️ Which picture goes with the words?'; say('Which picture goes with the words?');
      const same = (a, b) => a === b || (LARVAL.includes(a) && LARVAL.includes(b)) || (LADYBUG.includes(a) && LADYBUG.includes(b));
      /* the line that names what the picture shows ("I am a pupa!"), so the match is fair */
      const naming = lines(page.key).find(l => tokenize(l).some(w => PIC_NOUNS[w] && same(PIC_NOUNS[w], ch.pic)));
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, naming || taskSentence(), { rebus: false }); box.appendChild(s);
      const pool = ['egg', 'L3', 'pupa', 'adult', 'aphid', 'ant', 'bird', 'sun', 'snow'].filter(k => !same(k, ch.pic));
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
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Can a ladybug fly?', true];
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
  function micRead() {
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
  const onPlant = (p) => p.state === 'larva' || p.state === 'adult';
  function eligible(p) {
    const G = Gm, P = p.plant, L = level();
    return MISSIONS.filter(m => {
      if (m.key === lastMission) return false;
      if (m.from && READ_LEVELS.indexOf(L) < READ_LEVELS.indexOf(m.from)) return false;
      if (m.who === 'branch' && !onPlant(p)) return false;
      if (m.who === 'eater' && !(onPlant(p) && !p.readyFlag && P.aphids.count() >= 3)) return false;
      if (m.who === 'flyer' && !(p.stage === 6 && p.fresh < .3 && (p.state === 'adult' || p.state === 'flying') && !p.readyFlag && G.garden.season !== 'winter')) return false;
      if (m.who === 'flying' && p.state !== 'flying') return false;
      if (m.color && !P.aphids.list.some(a => a.variant === m.color && !a.hidden)) return false;
      if (m.key === 'flower' && !(['spring', 'summer'].includes(G.garden.season) && P.flowers.some(f => f.kind !== 'bud' && f.kind !== 'pod'))) return false;
      if (m.key === 'ant' && !(P.ants.enabled && P.ants.list.length)) return false;
      if (m.key === 'larva' && !(P.npcs && P.npcs.list.length)) return false;
      /* nothing that is already done the moment it appears */
      if (checkMission(m, p, { base: baseFor(m, p) })) return false;
      return true;
    });
  }
  function baseFor(m, p) { return m.key === 'eat3' ? p.total : m.key === 'plant' ? p.plant.id : 0; }
  function checkMission(m, p, ms = mission) {
    const P = p.plant, near = (x, y, r) => dist(p.x, p.y, x, y) < r;
    switch (m.key) {
      case 'top': return onPlant(p) && p.y < P.bounds.top + 330;
      case 'bottom': return onPlant(p) && p.y > -140;
      case 'flower': return onPlant(p) && P.flowers.some(f => f.kind !== 'bud' && f.kind !== 'pod' && near(f.x, f.y, 80));
      case 'eat3': return p.total >= ms.base + 3;
      case 'ant': return onPlant(p) && P.ants.list.some(a => near(a.x, a.y, 90));
      case 'larva': return onPlant(p) && P.npcs.list.some(w => near(w.x, w.y, 90));
      case 'plant': return p.state === 'adult' && p.plant.id !== ms.base;
      case 'high': return p.state === 'flying' && p.y < -1450;
    }
    if (m.color) return !!ms.hit;
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
    if (storyQueue.length && !card && !page && !Cinematic.active) { showPage(storyQueue.shift()); return; }
    const p = Gm.players[0];
    if (!p || ['egg', 'molting', 'pupa', 'eclosing', 'laying', 'hibernating'].includes(p.state)) return;
    if (!mission) { missionCool -= dt; if (missionCool <= 0 && !card && !page && !Cinematic.active) startMission(p); return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) {
      missionClock = .4;
      const m = mission.m;
      /* a mission for a different part of life (a larva's mission after it flies off) quietly ends */
      const fits = m.who === 'flying' ? p.state === 'flying' : m.who === 'flyer' ? p.stage === 6 : m.who === 'eater' ? !p.readyFlag : true;
      if (checkMission(m, p)) finishMission();
      else if (!fits || mission.t > 150) dropMission(10);
    }
  }
  function queueStory(key) {
    if (!on() || !READ_CHAPTERS[key] || READ_CHAPTERS[key].gate || storyShown.has(key)) return;
    storyShown.add(key); storyQueue.push(key);
  }
  /* the game started (or a new life began): the egg page comes first */
  function onStart() { storyShown.clear(); if (Gm.players[0] && Gm.players[0].state === 'egg') queueStory('egg'); }

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
    if (page) { if ((k === ' ' || k === 'Enter') && page.step === -1) { pageNext(); e.preventDefault(); } return true; }
    return false;
  }
  const padPrev = {};
  function gamepad(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (card) {
      const dir = g.x > .5 ? 1 : g.x < -.5 ? -1 : 0;
      if (dir && dir !== padPrev.dir) { focus = (focus + dir + card.choices.length) % card.choices.length; refocus(); }
      padPrev.dir = dir;
      if (g.actionPressed) chooseCard(focus);
    } else if (page && page.step === -1 && g.actionPressed) pageNext();
  }

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
      <div><b>Tricky words to practise:</b></div><div class="words">${r.tricky.slice(0, 30).map(w => `<span>${w}</span>`).join('') || '—'}</div>`;
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
    for (const k in unlocked) delete unlocked[k];
    /* the five growth steps wait for a page to be read */
    if (typeof Bug !== 'undefined' && !Bug.prototype._readWrapped) {
      Bug.prototype._readWrapped = true;
      const wrap = (name, chapter) => {
        const orig = Bug.prototype[name];
        Bug.prototype[name] = function (...a) {
          if (!on() || this.id !== 1) return orig.apply(this, a);
          if (this._gateWait) return;
          const key = typeof chapter === 'function' ? chapter(this) : chapter;
          this._gateWait = key;
          gate(this, key, () => { this._gateWait = null; orig.apply(this, a); });
        };
      };
      wrap('startMolt', (p) => ['', '', 'skin', 'grow', 'big'][p.stage + 1] || 'big');
      wrap('pupate', 'pupa');
      wrap('eclose', 'ladybug');
    }
    for (const ev in STORY_TRIGGERS) Bus.on(ev, (...a) => { const p = a.find(x => x && x.id !== undefined && x.stage !== undefined); if (!p || p.id === 1) queueStory(STORY_TRIGGERS[ev]); });
    Bus.on('eat', (p, kind, prey) => { if (mission && p.id === 1 && kind === 'aphid' && prey && prey.variant === mission.m.color) mission.hit = true; });
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

  return { init, on, level, setLevel, context, intercept, update, gate, showPage, chooseCard, keydown, gamepad, hintText, openWords, report, accuracy, onStart, queueStory, picture,
    cardOpen: () => !!card, pageOpen: () => !!page, busy: () => !!card || !!page, stats: () => data, choicesFor, _solveGate, _card: () => card, _page: () => page,
    _missionNow: () => { missionCool = 0; }, mission: () => mission,
    _startMission: (key, p) => { const m = MISSIONS.find(x => x.key === key); mission = { m, t: 0, helped: false, base: baseFor(m, p) }; missionClock = 0; return mission; } };
})();
