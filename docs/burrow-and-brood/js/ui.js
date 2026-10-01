/* ============================================================
   ui.js — HUD, colony wheel, jobs panel, fact cards, title,
            settings, sticker book, journal, graph, narration
   ============================================================ */
'use strict';

const UI = (function () {
  const $ = (id) => document.getElementById(id);
  let G, cb;
  let factQueue = [], factOpen = false, factsSeen = new Set(), factKey = null;
  let lastHUD = '', lastP2 = '', lastJobs = '';
  let hintKey = '', hintText = '';
  let stageIconKey = '';
  let wheelEls = [];
  let toastTimer = 0, toastQueue = [];
  let graphClock = 0;

  const simple = () => G.settings.reading === 'simple';
  const T = (key) => { const h = HINTS[key]; if (!h) return key; return Array.isArray(h) ? h[simple() ? 1 : 0] : h; };

  function init(game, callbacks) {
    G = game; cb = callbacks;
    buildWheel();
    buildSpecies($('speciesPick')); buildSpecies($('speciesPickDrawer'));
    buildJobs();

    $('btnStart').addEventListener('click', () => cb.onStart(false));
    $('btnContinue').addEventListener('click', () => cb.onStart(true));
    for (const grp of ['diffPickTitle', 'diffPick']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.diff)));
    for (const grp of ['readPick', 'readPickDrawer']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReading(b.dataset.read); AudioFX.click(); refreshToggles(); }));
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadMode(b.dataset.rm); AudioFX.click(); refreshToggles(); Voice.say(b.dataset.rm === 'play' ? 'I read to play. Pick your level.' : 'Read to me.', { interrupt: true }); }));
      const box = $('readLevel' + sfx);
      for (const L of [...READ_LEVELS, 'auto']) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.rl = L; b.textContent = L === 'auto' ? '⚙ Auto' : L; b.title = L === 'auto' ? 'Move up or down by itself' : LEVEL_INFO[L].about; b.addEventListener('click', () => { cb.onReadLevel(L); AudioFX.click(); refreshToggles(); }); box.appendChild(b); }
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadHelp(b.dataset.rh); AudioFX.click(); refreshToggles(); }));
    $('btnMyWords').addEventListener('click', () => { show('drawer', false); Reading.openWords(); });

    $('btnHelp').addEventListener('click', () => { show('help', true); AudioFX.click(); });
    $('helpClose').addEventListener('click', () => show('help', false));
    $('btnMenu').addEventListener('click', () => { show('drawer', $('drawer').hidden); AudioFX.click(); });
    $('drawerClose').addEventListener('click', () => show('drawer', false));
    for (const [id, key] of [['btnLabels', 'labels'], ['tgLabels', 'labels'], ['tgSoundChip', 'sound'], ['btnVoice', 'voice'], ['tgVoice', 'voice'], ['tgVoiceTitle', 'voice'], ['tgEnemy', 'enemy'], ['tgSlow', 'slowmo'], ['tgPad', 'pad'], ['tgClock', 'clock'], ['tgScience', 'science'], ['tgP2', 'p2'], ['tgGpSwap', 'gpP2'], ['btnColony', 'colony'], ['tgColony', 'colony'], ['btnFast', 'fast'], ['btnZoom', 'overview']])
      $(id).addEventListener('click', () => cb.onToggle(key));
    $('selQuality').addEventListener('change', (e) => cb.onQuality(e.target.value));
    $('sTod').addEventListener('input', (e) => cb.onTod(e.target.value / 100));
    $('btnNextSeason').addEventListener('click', () => { cb.onNextSeason(); AudioFX.click(); });
    $('btnNewGame').addEventListener('click', () => { show('drawer', false); cb.onNewGame(); });
    $('btnPhoto').addEventListener('click', () => cb.onPhoto());
    $('btnScope').addEventListener('click', () => { Microscope.open(G); AudioFX.click(); });
    $('btnBook').addEventListener('click', () => openStickers());
    $('btnStickersDrawer').addEventListener('click', () => { show('drawer', false); openStickers(); });
    $('stickerClose').addEventListener('click', () => show('stickerBook', false));
    $('btnJournal').addEventListener('click', () => openJournal());
    $('btnJournalDrawer').addEventListener('click', () => { show('drawer', false); openJournal(); });
    $('journalClose').addEventListener('click', () => show('journal', false));
    $('journalPrint').addEventListener('click', () => window.print());
    $('journalClear').addEventListener('click', () => { if (confirm('Clear the whole journal?')) Journal.clear(); });
    $('scienceClose').addEventListener('click', () => cb.onToggle('science'));
    $('colonyClose').addEventListener('click', () => cb.onToggle('colony'));

    $('factClose').addEventListener('click', closeFact);
    $('factOk').addEventListener('click', () => { if (factKey) Bus.emit('factRead', factKey); closeFact(); });
    $('factSay').addEventListener('click', () => { Voice.say(`${$('factTitle').textContent}. ${$('factBody').textContent}`, { interrupt: true, force: true }); });
    $('hintSay').addEventListener('click', () => Voice.say(hintText, { interrupt: true, force: true }));
    $('btnNewKingdom').addEventListener('click', () => { show('choice', false); cb.onNextGeneration(); });
    $('btnKeep').addEventListener('click', () => { show('choice', false); });

    Bus.on('fact', queueFact);
    Bus.on('hint', (k) => hint(k));
    Bus.on('season', (s) => { if (s !== 'winter' && s !== 'spring') hint(s); queueFact(s); });
    Bus.on('cinematic', (title) => { if (title) Voice.say(title, { interrupt: false }); });
    Microscope.init();
    refreshToggles();
  }
  function show(id, on) { $(id).hidden = !on; }

  function buildWheel() {
    const ol = $('wheel'); ol.innerHTML = '';
    wheelEls = COLONY_STAGES.map((st) => {
      const li = document.createElement('li');
      li.appendChild(Sprites.icon(st.key, G.speciesDef(), 40));
      const s = document.createElement('span'); s.textContent = st.short; li.appendChild(s);
      li.title = st.name;
      li.addEventListener('click', () => Microscope.open(G, st.key === 'queen' ? 'queen' : 'worker'));
      ol.appendChild(li);
      return li;
    });
  }
  function buildSpecies(grid) {
    grid.innerHTML = '';
    for (const key of Object.keys(SPECIES)) {
      const sp = SPECIES[key], b = document.createElement('button');
      b.dataset.species = key;
      b.appendChild(Sprites.icon('worker', sp, 54));
      const t = document.createElement('span'); t.textContent = sp.short; b.appendChild(t);
      b.addEventListener('click', () => { cb.onSpecies(key); AudioFX.click(); Voice.say(`${sp.short}. ${simple() ? sp.simple : sp.power}`, { interrupt: true }); });
      grid.appendChild(b);
    }
  }
  function refreshSpecies() {
    document.querySelectorAll('.species-grid button').forEach(b => b.classList.toggle('on', b.dataset.species === G.settings.species));
    const sp = G.speciesDef();
    $('speciesBlurb').innerHTML = '';
    const bb = document.createElement('b'); bb.textContent = sp.name; const ii = document.createElement('i'); ii.textContent = ` (${sp.latin}) `;
    $('speciesBlurb').append(bb, ii, document.createTextNode('— ' + (simple() ? sp.simple : sp.blurb)), document.createElement('br'));
    const pw = document.createElement('span'); pw.className = 'power'; pw.textContent = '✦ ' + sp.power; $('speciesBlurb').append(pw);
    $('speciesPower').textContent = '✦ ' + sp.power;
    buildWheel(); buildJobs();
    stageIconKey = ''; lastHUD = ''; lastJobs = '';      /* rebuilt rows must be filled in again */
  }
  function setDiff(d) {
    cb.onDiff(d);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === d));
    AudioFX.click();
  }
  function refreshToggles() {
    const s = G.settings;
    const on = (id, v) => $(id).classList.toggle('on', !!v);
    on('btnLabels', s.labels); on('tgLabels', s.labels); on('tgSoundChip', s.sound);
    on('btnVoice', s.voice); on('tgVoice', s.voice); on('tgVoiceTitle', s.voice);
    $('btnVoice').textContent = s.voice ? '🔊' : '🔇';
    on('tgEnemy', s.enemy); on('tgSlow', s.slowmo); on('tgPad', s.pad); on('tgClock', s.clock);
    $('tgClock').textContent = s.clock ? 'Clock running' : 'Clock paused';
    on('tgScience', s.science); $('science').hidden = !s.science;
    on('btnColony', s.colony); on('tgColony', s.colony); $('colonyPanel').hidden = !s.colony; document.body.classList.toggle('colony-on', !!s.colony);
    on('btnFast', G.fast); on('btnZoom', G.overview);
    on('tgP2', s.p2); on('tgGpSwap', s.gpP2);
    $('p2card').hidden = !s.p2;
    $('selQuality').value = s.quality;
    $('pad').hidden = !s.pad;
    document.body.classList.toggle('pad-on', s.pad);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === s.difficulty));
    document.querySelectorAll('#readPick button, #readPickDrawer button').forEach(b => b.classList.toggle('on', b.dataset.read === s.reading));
    document.body.classList.toggle('simple', s.reading === 'simple');
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rm === (s.readMode || 'listen')));
      $('readLevel' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rl === 'auto' ? !!s.readAuto : b.dataset.rl === (s.readLevel || 'B')));
      $('readLevel' + sfx).hidden = s.readMode !== 'play';
      $('readAbout' + sfx).textContent = s.readMode === 'play' ? `${LEVEL_INFO[s.readLevel || 'B'].name}: ${LEVEL_INFO[s.readLevel || 'B'].about}${s.readAuto ? ' The level moves up or down by itself.' : ''}` : 'Everything is read aloud. Pick "I read to play" to make reading how the game is played.';
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rh === (s.readHelp || 'auto')));
    document.body.classList.toggle('read-play', s.readMode === 'play');
    refreshSpecies();
  }

  /* ---------- the jobs panel: who does what ---------- */
  function buildJobs() {
    const box = $('jobRows'); if (!box) return;
    box.innerHTML = '';
    for (const k of JOB_KEYS) {
      const j = JOBS[k], row = document.createElement('button');
      row.className = 'job'; row.dataset.job = k;
      row.innerHTML = `<span class="je"></span><span class="jn"></span><span class="jbar"><i></i></span><b class="jc">0</b>`;
      row.querySelector('.je').textContent = j.emoji;
      row.querySelector('.jn').textContent = simple() ? j.simple : j.name;
      row.querySelector('i').style.background = j.col;
      row.title = j.blurb;
      row.addEventListener('click', () => { cb.onBoost(k); Voice.say(`${j.say} More ants will do this for a while.`, { interrupt: true }); });
      box.appendChild(row);
    }
  }
  function updateJobs() {
    const C = G.colony;
    if (C.phase !== 'growing') { $('jobNote').textContent = simple() ? 'The queen is alone. No workers yet!' : 'The queen is raising her first brood alone. No workers yet.'; return; }
    const jc = C.jobCounts(), total = Math.max(1, C.agents.length);
    const sig = JOB_KEYS.map(k => jc.seen[k]).join('|') + '|' + Math.round(C.food) + '|' + Math.round(C.honey) + '|' + C.pop;
    if (sig === lastJobs) return;
    lastJobs = sig;
    for (const row of $('jobRows').children) {
      const k = row.dataset.job;
      row.querySelector('i').style.width = (jc.seen[k] / total * 100).toFixed(0) + '%';
      row.querySelector('.jc').textContent = fmtInt(jc.all[k]);
      row.classList.toggle('boost', C.boost[k] > G.time);
    }
    const room = 1 - C.pop / C.capacity();
    const need = C.hungry > 2 && C.food < C.rep() * 3 ? (simple() ? 'The babies are hungry: we need food!' : 'Hungry larvae and an empty food room: more foragers!') :
      room < .15 ? (simple() ? 'The nest is full: we need diggers!' : 'The nest is nearly full: the diggers are busy.') :
      G.world.ladybug.onPlant ? (simple() ? 'A ladybug larva! Guards, go!' : 'A ladybug larva is on the aphids: guards are going.') :
      C.honey < C.pop * .1 && C.pop > 6 ? (simple() ? 'Low on honeydew: farmers, go!' : 'Honeydew is low: more farmers.') :
      (simple() ? 'Tap a job to ask more ants to do it.' : 'Everything is fine. Tap a job to ask more ants to do it.');
    $('jobNote').textContent = need;
    $('needFood').style.width = clamp(C.food / (C.rep() * 12), 0, 1) * 100 + '%';
    $('needHoney').style.width = clamp(C.honey / Math.max(6, C.pop * .6), 0, 1) * 100 + '%';
    $('needRoom').style.width = clamp(room, 0, 1) * 100 + '%';
  }

  /* ---------- HUD ---------- */
  const ACT_LABEL = { eggs: 'LAY', feed: 'FEED', feedq: 'FEED', milk: 'SIP', take: 'TAKE', drop: 'DROP', bite: 'BITE' };
  function describe(p) {
    const C = G.colony, W = G.world;
    let k = 'You are', name, prog = 0, ptxt = '';
    if (p.caste === 'queen') {
      name = simple() ? 'The queen' : 'A new queen';
      if (p.mode === 'fly') { ptxt = 'Flying…'; }
      else if (!C.royal) { const d = W.soil.depthAt(p.x, p.y); prog = clamp(d / 90, 0, 1); ptxt = d > 80 ? 'Deep enough! Lay eggs' : 'Dig a room'; }
      else {
        const all = C.brood.length || 1, grown = C.brood.reduce((n, b) => n + (b.kind === 'egg' ? b.age / BROOD.eggT * .33 : b.kind === 'larva' ? .33 + b.fed / BROOD.larvaNeed * .33 : .66 + b.age / BROOD.pupaT * .34), 0);
        prog = grown / all;
        ptxt = C.hungry ? `${C.hungry} hungry ${C.hungry > 1 ? 'babies' : 'baby'}!` : 'Raising the brood…';
      }
    } else {
      const job = p.carry === 'soil' || p.carry === 'sand' || p.digging ? 'digger' : p.mode === 'plant' || p.crop > 0 ? 'farmer' : p.carry && ['seed', 'crumb', 'bug', 'leaf'].includes(p.carry) || p.carryFood ? 'forager' : p.carry ? 'nurse' : null;
      name = job ? (simple() ? JOBS[job].simple : `Worker · ${JOBS[job].name.toLowerCase()}`) : (simple() ? 'A worker ant' : 'Worker ant');
      const next = COLONY_STAGES[C.stage + 1];
      if (next) { const prev = COLONY_STAGES[C.stage].at; prog = clamp((C.pop - prev) / (next.at - prev), 0, 1); ptxt = `${fmtInt(C.ants())} ants · next ${next.short}`; }
      else { prog = 1; ptxt = `${fmtInt(C.ants())} ants · a kingdom!`; }
      if (C.winter) ptxt = 'Winter rest… zzz';
    }
    return { name, prog, ptxt, k };
  }
  function update() {
    const p = G.players[0], C = G.colony, W = G.world;
    const d = describe(p);
    const wx = W.weather;
    const sky = wx.snow > .5 ? '❄️' : wx.rain > .4 ? '🌧️' : wx.rainbow > .3 ? '🌈' : wx.cloud > .5 ? '☁️' : (G.night > .5 ? '🌙' : '☀️');
    const broodN = C.brood.reduce((n, b) => n + b.rep, 0);
    const sig = `${d.name}|${Math.round(d.prog * 100)}|${d.ptxt}|${C.ants()}|${Math.round(C.food)}|${Math.round(C.honey)}|${broodN}|${G.day}|${W.season}|${sky}|${W.year}|${C.stage}`;
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageK').textContent = d.k; $('stageName').textContent = d.name;
      $('progBar').style.width = (d.prog * 100).toFixed(1) + '%'; $('progText').textContent = d.ptxt;
      $('roAnts').textContent = fmtInt(C.ants());
      $('roFood').textContent = C.food < 1 ? '0' : fmtInt(C.food);
      $('roHoney').textContent = C.honey < 1 ? '0' : fmtInt(C.honey);
      $('roBrood').textContent = fmtInt(broodN);
      $('roDay').textContent = `Day ${G.day}`;
      $('seasonBadge').textContent = SEASON_INFO[W.season].name + (W.year > 1 ? ` · Y${W.year}` : '');
      $('seasonRo').className = 'ro season ' + W.season;
      $('weatherBadge').textContent = sky;
      wheelEls.forEach((li, i) => { li.classList.toggle('done', i < C.stage); li.classList.toggle('now', i === C.stage); });
    }
    const ik = `${p.caste}|${p.wings > .5}|${G.settings.species}`;
    if (ik !== stageIconKey) {
      stageIconKey = ik;
      const c = $('stageIcon'), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(Sprites.icon(p.caste === 'queen' ? (p.wings > .5 ? 'alate' : 'queen') : 'worker', G.speciesDef(), 56), 0, 0, 112, 112);
    }
    /* the touch buttons say what they will do */
    const act = $('btnAction'), v = p.context ? p.context() : null;
    let label = v ? ACT_LABEL[v] : (p.caste === 'queen' && !C.royal ? 'DIG ⬇' : 'GO!');
    if (Reading.on()) label = '📖 GO!';
    if (act.textContent !== label) act.textContent = label;
    $('btnCall').hidden = !(p.caste === 'worker' && C.phase === 'growing');
    /* player 2 */
    if (G.players[1]) {
      const q = G.players[1], d2 = describe(q);
      const s2 = `${d2.name}|${d2.ptxt}`;
      if (s2 !== lastP2) { lastP2 = s2; $('p2Name').textContent = d2.name; $('p2Text').textContent = d2.ptxt; }
      $('p2Keys').textContent = G.settings.gpP2 && Gamepads.connected ? '🎮' : 'IJKL + U';
    } else if (G.settings.p2) { $('p2Name').textContent = 'Waiting…'; $('p2Text').textContent = 'Joins with the first workers'; }
    $('gpNote').textContent = Gamepads.connected ? `${Gamepads.connected} gamepad${Gamepads.connected > 1 ? 's' : ''} connected.` : 'No gamepad connected. Plug one in and press a button.';
    if (G.settings.colony) updateJobs();
    graphClock -= 1 / 60;
    if (G.settings.science && graphClock <= 0) { graphClock = .5; Journal.drawGraph($('scienceCanvas')); }
    if (toastTimer > 0) { toastTimer -= 1 / 60; if (toastTimer <= 0) { $('stickerToast').hidden = true; if (toastQueue.length) showSticker(toastQueue.shift()); } }
  }

  /* ---------- hints ---------- */
  let readHintTimer = null;
  function hint(keyOrText, flash = true) {
    const rt = Reading.hintText(keyOrText);
    if (rt) {
      if (rt === hintKey) return;
      hintKey = rt; hintText = rt;
      const h = $('hint'); $('hintText').textContent = rt;
      if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
      clearTimeout(readHintTimer);
      if (G.settings.readHelp !== 'ask') readHintTimer = setTimeout(() => { if (hintText === rt) Voice.say(rt, { interrupt: false }); }, LEVEL_INFO[Reading.level()].help * 1000);
      return;
    }
    const txt = T(keyOrText);
    if (txt === hintKey) return;
    hintKey = txt; hintText = txt;
    const h = $('hint'); $('hintText').textContent = txt;
    if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
    Voice.say(txt, { interrupt: true });
  }

  /* ---------- facts ---------- */
  function queueFact(key) {
    if (!FACTS[key] || factsSeen.has(key)) return;
    factsSeen.add(key); factQueue.push(key);
    if (!factOpen) nextFact();
  }
  function nextFact() {
    const key = factQueue.shift();
    if (!key) { factOpen = false; return; }
    factOpen = true; factKey = key;
    const f = FACTS[key];
    $('factTitle').textContent = f.title;
    $('factBody').textContent = simple() ? f.simple : f.body;
    const more = $('factMore'); more.hidden = !f.more; if (f.more) more.href = f.more;
    const el = $('fact'); el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(nextFact._t);
    nextFact._t = setTimeout(closeFact, 30000);
    if (!Reading.on()) setTimeout(() => Voice.say(`${f.title}. ${simple() ? f.simple : f.body}`), 900);
  }
  function closeFact() { $('fact').hidden = true; clearTimeout(nextFact._t); setTimeout(nextFact, 600); }
  function resetFacts() { factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- stickers ---------- */
  function showSticker(st) {
    const t = $('stickerToast'), c = $('stickerToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    $('stickerToastName').textContent = simple() ? st.simple : st.name;
    t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    toastTimer = 4.5;
    AudioFX.sticker && AudioFX.sticker();
    Voice.say(`New sticker! ${simple() ? st.simple : st.name}`);
  }
  function onSticker(st) { if (toastTimer > 0) toastQueue.push(st); else showSticker(st); }
  function openStickers() {
    AudioFX.click();
    const grid = $('stickerGrid'); grid.innerHTML = '';
    let n = 0;
    for (const st of Stickers.all()) {
      const has = Stickers.has(st.key); if (has) n++;
      const b = document.createElement('button');
      b.className = 'sticker' + (has ? '' : ' locked');
      const src = Stickers.image(st, 72, !has), img = document.createElement('canvas');
      img.width = src.width; img.height = src.height; img.getContext('2d').drawImage(src, 0, 0);
      img.style.width = img.style.height = '72px';
      b.appendChild(img);
      const s = document.createElement('span'); s.textContent = simple() ? st.simple : st.name; b.appendChild(s);
      b.addEventListener('click', () => Voice.say(has ? `${st.name}. ${st.simple}` : `Still locked: ${st.name}.`, { interrupt: true, force: true }));
      grid.appendChild(b);
    }
    $('stickerCount').textContent = `${n} / ${Stickers.all().length}`;
    show('stickerBook', true);
  }
  function openJournal() { AudioFX.click(); Journal.renderBook(); show('journal', true); }
  function hideTitle() { $('title').classList.add('out'); }
  function showTitle(hasSave) { $('title').classList.remove('out'); $('btnContinue').hidden = !hasSave; }
  function choice() { show('choice', true); Voice.say(simple() ? 'The new queens flew away! Be a new queen, or keep playing?' : 'The princesses have flown! Start a new kingdom as one of them, or keep playing here?', { interrupt: true }); }
  function anyModalOpen() { return ['help', 'stickerBook', 'journal', 'microscope', 'choice', 'readCard', 'readPage', 'myWords'].some(id => !$(id).hidden); }
  /* Escape never closes a word card or a page: those are how the game goes on */
  function closeModals() { ['help', 'stickerBook', 'journal', 'microscope', 'myWords', 'drawer', 'choice'].forEach(id => show(id, false)); }

  return { init, update, hint, refreshToggles, refreshSpecies, hideTitle, showTitle, choice, resetFacts, queueFact, onSticker, openStickers, openJournal, anyModalOpen, closeModals, isFactOpen: () => factOpen, T };
})();
