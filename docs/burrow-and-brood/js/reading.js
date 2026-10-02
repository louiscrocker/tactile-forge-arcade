/* ============================================================
   reading.js — Read to Play
   ============================================================
   When the reading mode is "I read to play", reading is how the
   game is played (the pattern is Frog Pond's READING_DESIGN.md,
   ported from Ladybug Life):

   ACTION CARDS  The action button (Space, GO!, gamepad A) and the
                 help button (E, 📣, gamepad B) no longer act by
                 themselves.  They open a card of words at the
                 child's level; tapping the word that fits the
                 moment ("feed" by a hungry larva, "sip" by an
                 aphid, "bite" when the ladybug larva is near,
                 "help" to call sisters) makes the ant do it, and
                 unlocks that action for a few seconds.
   READ TO GROW  The colony's big steps wait for a leveled page to
                 be read and its task done: the first eggs, the
                 first larvae, the first cocoon, the first worker,
                 ten ants, a hundred, a thousand, the kingdom.
                 Tasks: match a picture (A), build the sentence
                 (B, C), answer yes/no (C+), fill the blank (D, E).
   STORY PAGES   The flight, digging in, honeydew, the ladybug
                 larva, rain, carrying together, winter and spring
                 each open a leveled page once, no gate.
   MISSIONS      "Go down to the deepest room."  The sentence is
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
  const KEY = 'antkingdom.reading';
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
    ctx.save(); ctx.scale(s, s);
    switch (key) {
      case 'wings': ctx.translate(-4, 6); Sprites.drawAnt(ctx, { s: 1.6, sp: Gm.speciesDef(), caste: 'alate', walk: 1 }); break;
      case 'leaf': ctx.rotate(-.5); Sprites.drawLeaf(ctx, { variant: 1, size: 74, curl: .1, ang: 0, phase: 0, petiole: 10, shape: 'heart', fall: 1 }, -44, 0, 0, false); break;
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
      case 'hill': {
        ctx.fillStyle = '#8a5e3a'; ctx.beginPath(); ctx.moveTo(-46, 30); ctx.quadraticCurveTo(0, -60, 46, 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,190,.25)'; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(-34 + (i * 37) % 68, 26 - (i * 23) % 44, 2, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(0, -12, 6, 4, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'dirt': ctx.fillStyle = '#6a4428'; ctx.beginPath(); ctx.ellipse(0, 12, 40, 22, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a6040'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-26 + i * 7, 6 + (i % 3) * 6, 6, 0, TAU); ctx.fill(); } break;
      case 'tunnel': case 'room': {
        ctx.fillStyle = '#8a6040'; ctx.fillRect(-46, -40, 92, 80);
        ctx.fillStyle = '#2a1a10';
        if (key === 'room') { ctx.beginPath(); ctx.ellipse(0, 4, 36, 18, 0, 0, TAU); ctx.fill(); ctx.fillRect(-5, -40, 10, 30); Sprites.drawEggs(ctx, { s: 2.2, count: 5 }); }
        else { ctx.lineWidth = 14; ctx.strokeStyle = '#2a1a10'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.quadraticCurveTo(0, 30, 40, -10); ctx.stroke(); }
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(12, -8, 22, 0, TAU); ctx.fill(); break;
      case 'rain': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x - 5, 32); ctx.stroke(); } break;
      case 'snow': ctx.strokeStyle = '#6fb8e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.moveTo(-8, -20); ctx.lineTo(0, -12); ctx.lineTo(8, -20); ctx.moveTo(-8, 20); ctx.lineTo(0, 12); ctx.lineTo(8, 20); ctx.stroke(); ctx.restore(); } break;
    }
    ctx.restore();
  }
  /* most pictures are the HUD icons; a few are drawn here */
  const ICON_PIC = { queen: 'queen', alate: 'alate', worker: 'worker', ants: 'ten', egg: 'egg', larva: 'larva', pupa: 'pupa', aphid: 'aphid', ladybug: 'ladybug', ladylarva: 'ladylarva', seed: 'seed', crumb: 'crumb', bug: 'bug', honeydew: 'honeydew', worm: 'worm' };
  function picture(key, px) {
    let c;
    if (ICON_PIC[key]) c = Sprites.icon(ICON_PIC[key], Gm ? Gm.speciesDef() : SPECIES.garden, px);
    else { c = document.createElement('canvas'); c.width = c.height = px * 2; const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); drawCustom(key, ctx, px / 100); }
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
      /* "a ladybug larva" gets the ladybug larva, not an ant baby */
      if (info().rebus && PIC_NOUNS[w] && opts.rebus !== false && !(w === 'ladybug' && /^larva/.test(norm(String(text).split(/\s+/)[String(text).split(/\s+/).indexOf(tok) + 1] || '')))) { const key = PIC_NOUNS[w] === 'larva' && before === 'ladybug' ? 'ladylarva' : PIC_NOUNS[w]; const pic = picture(key, 30); pic.classList.add('rebus'); el.appendChild(pic); }
      el.appendChild(document.createTextNode(' '));
    }
  }

  /* ---------- what the ant could do right now ---------- */
  function context(p, which) {
    if (!p || p.mode === 'fly') return null;
    if (which === 'help') return p.caste === 'worker' && Gm.colony.phase === 'growing' && !(p.callCool > 0) ? 'help' : null;
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
    if (verb === 'help') p.input.eggPressed = true;
    else p.input.actionPressed = true;
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
      const verb = context(p, 'help');
      if (verb && !(unlocked[verb] > t)) { p.input.eggPressed = false; openCard(p, verb, () => grant(p, verb)); }
    }
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
  const ANTISH = ['worker', 'ants', 'queen', 'alate', 'wings'];
  const LADYISH = ['ladybug', 'ladylarva'];
  const HOMEISH = ['room', 'tunnel', 'hill', 'dirt'];
  const VERBS = ['dig', 'fly', 'eat', 'sleep', 'hide', 'grow', 'bite', 'sip', 'feed', 'run', 'sit', 'play', 'warm', 'cold', 'little', 'big', 'white', 'wet', 'dry', 'soft', 'deep', 'sweet'];
  function runTask(kind) {
    const box = $('rpTask'); box.innerHTML = ''; box.hidden = false;
    $('rpNext').hidden = true; $('rpHelp').hidden = true; $('rpMic').hidden = true;
    const head = document.createElement('div'); head.className = 'rt-head'; box.appendChild(head);
    const L = level(), ch = READ_CHAPTERS[page.key];
    /* from C up, the page is put away during the task: the child works from reading, not copying */
    $('rpText').classList.toggle('put-away', L !== 'A' && L !== 'B');
    if (kind === 'match') {
      head.textContent = '🖼️ Which picture goes with the words?'; say('Which picture goes with the words?');
      const same = (a, b) => a === b || (ANTISH.includes(a) && ANTISH.includes(b)) || (LADYISH.includes(a) && LADYISH.includes(b)) || (HOMEISH.includes(a) && HOMEISH.includes(b));
      /* the line that names what the picture shows ("I am a pupa!"), so the match is fair */
      const naming = lines(page.key).find(l => tokenize(l).some(w => PIC_NOUNS[w] && same(PIC_NOUNS[w], ch.pic)));
      const s = document.createElement('p'); s.className = 'rt-sentence'; renderWords(s, naming || taskSentence(), { rebus: false }); box.appendChild(s);
      const pool = ['egg', 'larva', 'pupa', 'worker', 'aphid', 'ladylarva', 'seed', 'sun', 'snow', 'hill'].filter(k => !same(k, ch.pic));
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
      const [q, a] = qs.length ? qs[(Math.random() * qs.length) | 0] : ['Can an ant dig?', true];
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
    const p = page;
    if (!(await Grownups.confirmMicrophone())) return;   /* a grown-up says no: the mic stays off */
    if (page !== p) return;
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
  const C = () => Gm.colony;
  function fitsWho(m, p) {
    const col = C();
    switch (m.who) {
      case 'queen': return p.caste === 'queen' && col.phase === 'founding' && !col.royal;
      case 'worker': return p.caste === 'worker';
      case 'nest': return p.caste === 'worker' && p.underground;
      case 'outside': return p.caste === 'worker' && !p.underground && p.mode !== 'plant';
      case 'plant': return p.caste === 'worker' && (p.mode === 'plant' || !p.underground);
    }
    return true;
  }
  function eligible(p) {
    const W = Gm.world, col = C(), L = level();
    return MISSIONS.filter(m => {
      if (m.key === lastMission) return false;
      if (m.from && READ_LEVELS.indexOf(L) < READ_LEVELS.indexOf(m.from)) return false;
      if (!fitsWho(m, p)) return false;
      if (W.season === 'winter' && ['outside', 'seed', 'top', 'aphid2', 'larva'].includes(m.key)) return false;
      if (m.key === 'aphid2' && !W.plants.some(P => P.herd.count() >= 3)) return false;
      if (m.key === 'larva' && !W.ladybug.onPlant) return false;
      if (m.key === 'queen' && !col.queen) return false;
      if (m.key === 'nursery' && !col.brood.length) return false;
      if (m.key === 'deep' && !col.rooms.some(r => r.open >= .7 && r.y > 200)) return false;
      if (m.key === 'feed' && !col.brood.some(b => col.hungryLarva(b))) return false;
      if (m.key === 'hill' && !Gm.diff().pellets) return false;
      if (m.key === 'seed' && !W.foods.list.length) return false;
      /* nothing that is already done the moment it appears */
      if (checkMission(m, p, { base: baseFor(m, p) })) return false;
      return true;
    });
  }
  function baseFor(m, p) { const s = p.stats; return m.key === 'aphid2' ? s.milked : m.key === 'seed' ? s.food : m.key === 'dig' ? s.dug : m.key === 'hill' ? (s.spoil || 0) : m.key === 'feed' ? s.fed : m.key === 'larva' ? s.bites : 0; }
  function checkMission(m, p, ms = mission) {
    const col = C(), W = Gm.world, S = W.soil, s = p.stats;
    switch (m.key) {
      case 'qdig': return S.depthAt(p.x, p.y) > 70;
      case 'outside': return !p.underground && p.mode === 'ground' && p.y < S.ground0(p.x) - 2;
      case 'seed': return s.food > ms.base;
      case 'top': return p.mode === 'plant' && p.y < p.plant.bounds.top + 260;
      case 'aphid2': return s.milked >= ms.base + 2;
      case 'deep': { const deepest = col.rooms.filter(r => r.open >= .7).reduce((d, r) => Math.max(d, r.y), 0); return p.underground && deepest > 200 && p.y > deepest - 40; }
      case 'queen': return !!col.queen && dist(p.x, p.y, col.queen.x, col.queen.y) < 70;
      case 'nursery': { const r = col.roomAt(p.x, p.y, 12); return !!r && (r.kind === 'nursery' || (r.kind === 'royal' && col.nurseries()[0] === r)); }
      case 'dig': return s.dug >= ms.base + 25;
      case 'hill': return (s.spoil || 0) > ms.base;
      case 'feed': return s.fed > ms.base;
      case 'larva': return !!ms.hit;
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
    if (storyQueue.length && !card && !page && !Cinematic.active) { showPage(storyQueue.shift()); return; }
    const p = Gm.players[0];
    if (!p || p.mode === 'fly' || p.busy > 0 || C().winter) { if (mission && C().winter) dropMission(10); return; }
    if (!mission) { missionCool -= dt; if (missionCool <= 0 && !card && !page && !Cinematic.active) startMission(p); return; }
    mission.t += dt; missionClock -= dt;
    if (missionClock <= 0) {
      missionClock = .4;
      const m = mission.m;
      /* a mission for a different part of life (a larva's mission after it flies off) quietly ends */
      const fits = m.who === 'queen' ? p.caste === 'queen' && !C().royal : m.who === 'nest' || m.who === 'outside' || m.who === 'plant' || m.who === 'worker' ? p.caste === 'worker' : true;
      if (checkMission(m, p)) finishMission();
      else if (!fits || mission.t > 150) dropMission(10);
    }
  }
  function queueStory(key) {
    if (!on() || !READ_CHAPTERS[key] || READ_CHAPTERS[key].gate || storyShown.has(key)) return;
    storyShown.add(key); storyQueue.push(key);
    data.shown = [...storyShown]; save();
  }
  /* the game started (or a new kingdom began): the flight page comes first */
  function onStart() { storyShown.clear(); data.shown = []; save(); const p = Gm.players[0]; if (p && p.caste === 'queen' && Gm.colony.phase === 'founding') queueStory('flight'); }

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
    storyShown.clear(); for (const k of Array.isArray(data.shown) ? data.shown : []) if (READ_CHAPTERS[k]) storyShown.add(k);
    for (const k in unlocked) delete unlocked[k];
    /* the colony's big steps wait for a page to be read */
    if (typeof Colony !== 'undefined' && !Colony.prototype._readWrapped) {
      Colony.prototype._readWrapped = true;
      const orig = Colony.prototype.milestone;
      Colony.prototype.milestone = function (key, fn) {
        if (!on() || !READ_CHAPTERS[key] || !READ_CHAPTERS[key].gate) return orig.call(this, key, fn);
        gate(Gm.players[0], key, fn);
      };
    }
    for (const ev in STORY_TRIGGERS) Bus.on(ev, (...a) => { const p = a.find(x => x && x.isPlayer); if (!p || p.id === 1) queueStory(STORY_TRIGGERS[ev]); });
    Bus.on('act', (p, verb) => { if (p.id === 1 && verb === 'milk') queueStory('honeydew'); });
    Bus.on('weather', (w) => { if (w === 'rain' && Gm.colony && Gm.colony.phase === 'growing') queueStory('rain'); });
    /* "chase the larva" counts when YOU bit it (sisters helping is fine) */
    Bus.on('enemyShooed', () => { if (mission && mission.m.key === 'larva' && Gm.players[0] && Gm.players[0].stats.bites > mission.base) mission.hit = true; });
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
