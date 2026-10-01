/* ============================================================
   ui.js — HUD, life-cycle wheel, fact cards, title, settings,
            sticker book, journal, science panel, narration
   ============================================================ */
'use strict';

const UI = (function () {
  const $ = (id) => document.getElementById(id);
  let G, cb;
  let factQueue = [], factOpen = false, factsSeen = new Set(), factKey = null;
  let lastHUD = '', lastP2 = '';
  let hintKey = '', hintText = '';
  let stageIconKey = '', p2IconKey = '';
  const WHEEL = ['egg', 'tadpole', 'legs', 'tail', 'froglet', 'frog'];
  const WHEEL_NAMES = ['Egg', 'Tadpole', 'Legs', 'Tail', 'Froglet', 'Frog'];
  const SCOPE_FOR = { egg: 'egg', tadpole: 'tadpole', legs: 'tadpole', tail: 'tadpole', froglet: 'froglet', frog: 'frog' };
  let wheelEls = [];
  let toastTimer = 0, toastQueue = [];
  let scienceClock = 0;

  const simple = () => G.settings.reading === 'simple';
  const T = (key) => { const h = HINTS[key]; if (!h) return key; return Array.isArray(h) ? h[simple() ? 1 : 0] : h; };

  function init(game, callbacks) {
    G = game; cb = callbacks;
    buildWheel();
    buildSpecies($('speciesPick'));
    buildSpecies($('speciesPickDrawer'));

    $('btnStart').addEventListener('click', () => cb.onStart(false));
    $('btnContinue').addEventListener('click', () => cb.onStart(true));
    for (const grp of ['diffPickTitle', 'diffPick']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.diff)));
    for (const grp of ['readPick', 'readPickDrawer']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReading(b.dataset.read); AudioFX.click(); refreshToggles(); }));

    $('btnHelp').addEventListener('click', () => { show('help', true); AudioFX.click(); });
    $('helpClose').addEventListener('click', () => show('help', false));
    $('btnMenu').addEventListener('click', () => { show('drawer', $('drawer').hidden); AudioFX.click(); });
    $('drawerClose').addEventListener('click', () => show('drawer', false));
    $('btnLabels').addEventListener('click', () => cb.onToggle('labels'));
    $('tgLabels').addEventListener('click', () => cb.onToggle('labels'));
    $('tgSoundChip').addEventListener('click', () => cb.onToggle('sound'));
    $('btnVoice').addEventListener('click', () => cb.onToggle('voice'));
    $('tgVoice').addEventListener('click', () => cb.onToggle('voice'));
    $('tgVoiceTitle').addEventListener('click', () => cb.onToggle('voice'));
    $('tgNymphs').addEventListener('click', () => cb.onToggle('nymphs'));
    $('tgHeron').addEventListener('click', () => cb.onToggle('heron'));
    $('tgHazards').addEventListener('click', () => cb.onToggle('hazards'));
    $('tgAnyTravel').addEventListener('click', () => cb.onToggle('anytravel'));
    $('tgStories').addEventListener('click', () => cb.onToggle('stories'));
    $('tgRhythm').addEventListener('click', () => cb.onToggle('rhythm'));
    $('tgTilt').addEventListener('click', () => cb.onToggle('tilt'));
    $('tgEasyFont').addEventListener('click', () => cb.onToggle('easyfont'));
    $('tgKeeperAny').addEventListener('click', () => cb.onToggle('keeperAny'));
    $('btnGuide').addEventListener('click', () => FieldGuide.open());
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadMode(b.dataset.rm); AudioFX.click(); refreshToggles(); Voice.say(b.dataset.rm === 'play' ? 'I read to play. Pick your level.' : 'Read to me.', { interrupt: true }); }));
      const box = $('readLevel' + sfx);
      for (const L of [...READ_LEVELS, 'auto']) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.rl = L; b.textContent = L === 'auto' ? '⚙ Auto' : L; b.title = L === 'auto' ? 'Move up or down by itself' : LEVEL_INFO[L].about; b.addEventListener('click', () => { cb.onReadLevel(L); AudioFX.click(); refreshToggles(); }); box.appendChild(b); }
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadHelp(b.dataset.rh); refreshToggles(); }));
    $('btnMyWords').addEventListener('click', () => { show('drawer', false); Reading.openWords(); });
    $('tgReadMic').addEventListener('click', () => cb.onToggle('readMic'));
    $('tgReadMicTitle').addEventListener('click', () => cb.onToggle('readMic'));
    $('tgReadSave').addEventListener('click', () => cb.onToggle('readSave'));
    $('btnStory').addEventListener('click', () => { AudioFX.click(); Story.openBook(); });
    $('storyBookClose').addEventListener('click', () => show('storyBook', false));
    $('btnGuideDrawer').addEventListener('click', () => { show('drawer', false); FieldGuide.open(); });
    $('btnSafari').addEventListener('click', () => { show('drawer', false); Safari.open(G); });
    $('safariClose').addEventListener('click', () => show('safari', false));
    $('btnRecorder').addEventListener('click', () => { show('drawer', false); Recorder.open(); });
    $('btnKeeper').addEventListener('click', () => { show('drawer', false); Keeper.toggle(!Keeper.active()); });
    $('btnGrownup').addEventListener('click', () => { show('drawer', false); Grownups.open(); });
    $('tgSlow').addEventListener('click', () => cb.onToggle('slowmo'));
    $('tgPad').addEventListener('click', () => cb.onToggle('pad'));
    $('tgClock').addEventListener('click', () => cb.onToggle('clock'));
    $('tgScience').addEventListener('click', () => cb.onToggle('science'));
    $('tgP2').addEventListener('click', () => cb.onToggle('p2'));
    $('tgGpSwap').addEventListener('click', () => cb.onToggle('gpP2'));
    $('selQuality').addEventListener('change', (e) => cb.onQuality(e.target.value));
    $('sTod').addEventListener('input', (e) => cb.onTod(e.target.value / 100));
    $('btnNextSeason').addEventListener('click', () => { cb.onNextSeason(); AudioFX.click(); });
    $('btnNewPond').addEventListener('click', () => { show('drawer', false); cb.onNewPond(); });
    $('btnRestart').addEventListener('click', () => { show('drawer', false); cb.onRestart(); });

    $('btnPhoto').addEventListener('click', () => cb.onPhoto());
    $('btnScope').addEventListener('click', () => { Microscope.open(G, SCOPE_FOR[WHEEL[G.player.stage]]); AudioFX.click(); });
    $('btnBook').addEventListener('click', () => openStickers());
    $('btnStickersDrawer').addEventListener('click', () => { show('drawer', false); openStickers(); });
    $('stickerClose').addEventListener('click', () => show('stickerBook', false));
    $('btnJournal').addEventListener('click', () => openJournal());
    $('btnJournalDrawer').addEventListener('click', () => { show('drawer', false); openJournal(); });
    $('journalClose').addEventListener('click', () => show('journal', false));
    $('journalPrint').addEventListener('click', () => window.print());
    $('journalClear').addEventListener('click', () => { if (confirm('Clear the whole journal?')) { Journal.clear(); } });
    $('scienceClose').addEventListener('click', () => cb.onToggle('science'));

    $('factClose').addEventListener('click', closeFact);
    $('factOk').addEventListener('click', () => { if (factKey) Bus.emit('factRead', factKey); closeFact(); });
    $('factSay').addEventListener('click', () => { Voice.say(`${$('factTitle').textContent}. ${$('factBody').textContent}`, { interrupt: true, force: true, key: factKey ? 'fact:' + factKey : null }); });
    $('hintSay').addEventListener('click', () => Voice.say(hintText, { interrupt: true, force: true }));

    $('btnHatchNext').addEventListener('click', () => { show('choice', false); cb.onHatchNext(); });
    $('btnKeep').addEventListener('click', () => { show('choice', false); cb.onKeep(); });

    Bus.on('fact', queueFact);
    Bus.on('hint', (k) => hint(k));
    Bus.on('cinematic', (title) => { if (title) Voice.say(title, { interrupt: false }); });
    Microscope.init();
    refreshToggles();
  }

  function show(id, on) { $(id).hidden = !on; }

  function buildWheel() {
    const ol = $('wheel');
    ol.innerHTML = '';
    wheelEls = WHEEL.map((k, i) => {
      const li = document.createElement('li');
      li.appendChild(Sprites.iconEl(k, G.speciesDef(), 40));
      const s = document.createElement('span'); s.textContent = WHEEL_NAMES[i];
      li.appendChild(s);
      li.title = STAGES[i].name;
      li.addEventListener('click', () => { Microscope.open(G, SCOPE_FOR[k]); });
      ol.appendChild(li);
      return li;
    });
  }

  function buildSpecies(grid) {
    grid.innerHTML = '';
    for (const key of Object.keys(SPECIES)) {
      const sp = SPECIES[key];
      const b = document.createElement('button');
      b.dataset.species = key;
      b.appendChild(Sprites.iconEl('frog', sp, 54));
      const t = document.createElement('span'); t.textContent = sp.short;
      b.appendChild(t);
      b.addEventListener('click', () => { cb.onSpecies(key); AudioFX.click(); Voice.say(`${sp.short}. ${simple() ? sp.simple : sp.power}`, { interrupt: true }); AudioFX.ribbit && AudioFX.ribbit(sp.call, .8); });
      grid.appendChild(b);
    }
  }

  function refreshSpecies() {
    document.querySelectorAll('.species-grid button').forEach(b => b.classList.toggle('on', b.dataset.species === G.settings.species));
    const sp = G.speciesDef();
    $('speciesBlurb').innerHTML = `<b>${sp.name}</b> <i>(${sp.latin})</i> — ${simple() ? sp.simple : sp.blurb}<br><span class="power">✦ ${sp.power}</span>`;
    $('speciesPower').textContent = '✦ ' + sp.power;
    buildWheel();
    stageIconKey = '';
  }

  function setDiff(d) {
    cb.onDiff(d);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === d));
    AudioFX.click();
  }

  function refreshToggles() {
    const s = G.settings;
    $('btnLabels').classList.toggle('on', s.labels);
    $('tgLabels').classList.toggle('on', s.labels);
    $('tgSoundChip').classList.toggle('on', s.sound);
    $('btnVoice').classList.toggle('on', s.voice);
    $('tgVoice').classList.toggle('on', s.voice);
    $('tgVoiceTitle').classList.toggle('on', s.voice);
    $('btnVoice').textContent = s.voice ? '🔊' : '🔇';
    $('tgNymphs').classList.toggle('on', s.nymphs);
    $('tgHeron').classList.toggle('on', s.heron);
    $('tgHazards').classList.toggle('on', s.hazards);
    $('tgAnyTravel').classList.toggle('on', s.anytravel);
    $('tgStories').classList.toggle('on', s.stories !== false);
    $('tgRhythm').classList.toggle('on', s.rhythm !== false);
    $('tgTilt').classList.toggle('on', !!s.tilt);
    $('tgEasyFont').classList.toggle('on', !!s.easyfont);
    $('tgKeeperAny').classList.toggle('on', !!s.keeperAny);
    document.body.classList.toggle('easyfont', !!s.easyfont);
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rm === (s.readMode || 'listen')));
      $('readLevel' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rl === 'auto' ? !!s.readAuto : b.dataset.rl === (s.readLevel || 'B')));
      $('readLevel' + sfx).hidden = s.readMode !== 'play';
      $('readAbout' + sfx).textContent = s.readMode === 'play' ? `${LEVEL_INFO[s.readLevel || 'B'].name}: ${LEVEL_INFO[s.readLevel || 'B'].about}${s.readAuto ? ' The level moves up or down by itself.' : ''}` : 'Everything is read aloud. Pick "I read to play" to make reading how the game is played.';
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rh === (s.readHelp || 'auto')));
    document.body.classList.toggle('read-play', s.readMode === 'play');
    $('tgReadMic').classList.toggle('on', !!s.readMic); $('tgReadMicTitle').classList.toggle('on', !!s.readMic);
    $('tgReadMic').textContent = s.readMic ? '🎤 Microphone on while I read' : '🎤 Microphone off';
    $('tgReadSave').classList.toggle('on', s.readSave !== false);
    $('readMicTitleRow').hidden = s.readMode !== 'play';
    $('tgSlow').classList.toggle('on', s.slowmo);
    $('tgPad').classList.toggle('on', s.pad);
    $('tgClock').classList.toggle('on', s.clock);
    $('tgClock').textContent = s.clock ? 'Clock running' : 'Clock paused';
    $('tgScience').classList.toggle('on', s.science);
    $('science').hidden = !s.science;
    $('tgP2').classList.toggle('on', s.p2);
    $('tgGpSwap').classList.toggle('on', s.gpP2);
    $('p2card').hidden = !s.p2;
    $('selQuality').value = s.quality;
    $('pad').hidden = !s.pad;
    document.body.classList.toggle('pad-on', s.pad);
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === s.difficulty));
    document.querySelectorAll('#readPick button, #readPickDrawer button').forEach(b => b.classList.toggle('on', b.dataset.read === s.reading));
    document.body.classList.toggle('simple', s.reading === 'simple');
    refreshSpecies();
  }

  /* ---------- HUD ---------- */
  function describe(p) {
    const st = STAGES[p.stage];
    let name = st.name, prog = 0, ptxt = '', k = 'You are a';
    switch (p.state) {
      case 'egg': name = 'Egg'; prog = p.hatchProg; ptxt = 'Wriggle out!'; k = 'You are an'; break;
      case 'tadpole': case 'morphing':
        if (p.stage === 3) { prog = p.tailProgress(); ptxt = p.air < .35 ? 'Swim UP for air!' : 'Breathe at the top…'; }
        else { prog = p.progress(); ptxt = `${p.eaten} / ${p.need()} algae bites`; }
        if (p.state === 'morphing') ptxt = 'Changing…';
        if (p.stage === 1) k = 'You are a'; if (p.stage === 2) name = 'Tadpole with legs'; if (p.stage === 3) name = 'Tail shrinking';
        break;
      case 'froglet': name = 'Froglet'; prog = p.progress(); ptxt = `${p.eaten} / ${p.need()} bugs to grow`; break;
      case 'frog': case 'laying':
        name = p.species.short; prog = p.progress();
        ptxt = p.readyFlag ? 'READY to lay eggs!' : `${p.eaten} / ${p.need()} bugs to lay eggs`;
        if (p.state === 'laying') ptxt = 'Laying eggs…';
        break;
      case 'hibernating': name = p.hibKind === 'litter' ? 'Frozen solid' : 'Sleeping in the mud'; prog = 1; ptxt = 'Zzz… until spring'; break;
    }
    if (simple()) name = { 'Tadpole': 'Baby tadpole', 'Tadpole with legs': 'Tadpole with legs', 'Tail shrinking': 'Almost a frog', 'Froglet': 'Little frog', 'Sleeping in the mud': 'Sleeping', 'Frozen solid': 'Frozen' }[name] || name;
    return { name, prog, ptxt, k };
  }

  function update() {
    const p = G.players[0];
    const d = describe(p);
    const g = G.pond;
    const wx = g.weather;
    const sky = wx.ice > .5 ? '🧊' : wx.snow > .5 ? '❄️' : wx.rain > .4 ? '🌧️' : wx.rainbow > .3 ? '🌈' : wx.cloud > .5 ? '☁️' : (G.night > .5 ? '🌙' : '☀️');
    const bugs = G.bugs.count() + G.wrigglers.count();
    const sig = `${d.name}|${Math.round(d.prog * 100)}|${d.ptxt}|${p.total}|${bugs}|${G.day}|${G.generation}|${d.k}|${g.season}|${sky}|${g.year}`;
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageK').textContent = d.k;
      $('stageName').textContent = d.name;
      $('progBar').style.width = (d.prog * 100).toFixed(1) + '%';
      $('progText').textContent = d.ptxt;
      $('roTotal').textContent = p.total;
      $('roBugs').textContent = bugs;
      $('roDay').textContent = `Day ${G.day}`;
      $('roGen').textContent = G.generation;
      $('seasonBadge').textContent = SEASON_INFO[g.season].name + (g.year > 1 ? ` · Y${g.year}` : '');
      $('seasonRo').className = 'ro season ' + g.season;
      $('weatherBadge').textContent = sky;
      const idx = p.stage;
      wheelEls.forEach((li, i) => { li.classList.toggle('done', i < idx); li.classList.toggle('now', i === idx); });
    }
    const ik = `${p.stage}|${p.species.key}`;
    if (ik !== stageIconKey) {
      stageIconKey = ik;
      const c = $('stageIcon'), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(Sprites.icon(WHEEL[p.stage], p.species, 56), 0, 0, 112, 112);
    }
    const singBtn = $('btnSing');
    const showSing = p.stage === 5 && p.state === 'frog';
    if (singBtn.hidden === showSing) singBtn.hidden = !showSing;
    const singLabel = p.readyFlag && p.spawnNear ? 'Eggs' : 'Sing';
    if (singBtn.textContent !== singLabel) singBtn.textContent = singLabel;
    const act = $('btnAction');
    let label = 'GO!';
    switch (p.state) {
      case 'egg': label = 'WRIGGLE'; break;
      case 'tadpole': label = p.grazing ? 'EAT' : 'ZOOM'; break;
      case 'morphing': case 'laying': label = '…'; break;
      case 'froglet': case 'frog': label = p.target ? 'SNAP' : p.mudNear || p.litterNear ? 'SLEEP' : p.mode === 'water' ? 'KICK' : 'JUMP'; break;
      case 'hibernating': label = 'zzz'; break;
    }
    if (typeof Reading !== 'undefined' && Reading.on() && label !== '…' && label !== 'zzz') label = '📖';
    if (act.textContent !== label) act.textContent = label;

    /* player 2 */
    if (G.players[1]) {
      const q = G.players[1], d2 = describe(q);
      const s2 = `${d2.name}|${Math.round(d2.prog * 100)}|${d2.ptxt}`;
      if (s2 !== lastP2) { lastP2 = s2; $('p2Name').textContent = d2.name; $('p2Prog').style.width = (d2.prog * 100).toFixed(1) + '%'; $('p2Text').textContent = d2.ptxt; }
      const k2 = `${q.stage}|${q.species.key}`;
      if (k2 !== p2IconKey) { p2IconKey = k2; const c = $('p2Icon'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(Sprites.icon(WHEEL[q.stage], q.species, 44), 0, 0, 88, 88); }
      $('p2Keys').textContent = G.settings.gpP2 && Gamepads.connected ? '🎮' : 'IJKL + U';
    }
    $('gpNote').textContent = Gamepads.connected ? `${Gamepads.connected} gamepad${Gamepads.connected > 1 ? 's' : ''} connected.` : 'No gamepad connected. Plug one in and press a button.';

    if (G.settings.science) { scienceClock -= 1 / 60; if (scienceClock <= 0) { scienceClock = .5; Journal.drawGraph($('scienceCanvas')); } }
    if (toastTimer > 0) { toastTimer -= 1 / 60; if (toastTimer <= 0) { $('stickerToast').hidden = true; if (toastQueue.length) showSticker(toastQueue.shift()); } }
  }

  /* ---------- hints ---------- */
  let readHintTimer = null;
  function hint(keyOrText, flash = true) {
    /* in Read to Play, key moments show a leveled sentence to read; it is only spoken as help */
    const rt = typeof Reading !== 'undefined' && Reading.hintText(keyOrText);
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
    const h = $('hint');
    $('hintText').textContent = txt;
    if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
    Voice.say(txt, { interrupt: true, key: HINTS[keyOrText] ? 'hint:' + keyOrText : null });
  }

  /* ---------- facts ---------- */
  function queueFact(key) {
    if (!FACTS[key] || factsSeen.has(key)) return;
    factsSeen.add(key);
    factQueue.push(key);
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
    const el = $('fact');
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(nextFact._t);
    nextFact._t = setTimeout(closeFact, 30000);
    setTimeout(() => Voice.say(`${f.title}. ${simple() ? f.simple : f.body}`, { key: 'fact:' + key }), 900);
  }
  function closeFact() {
    $('fact').hidden = true;
    clearTimeout(nextFact._t);
    setTimeout(nextFact, 600);
  }
  function resetFacts() { factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- stickers ---------- */
  function showSticker(st) {
    const t = $('stickerToast');
    const c = $('stickerToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    $('stickerToastName').textContent = simple() ? st.simple : st.name;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    toastTimer = 4.5;
    AudioFX.sticker && AudioFX.sticker();
    Voice.say(`New sticker! ${simple() ? st.simple : st.name}`);
  }
  function onSticker(st) { if (toastTimer > 0) toastQueue.push(st); else showSticker(st); }

  function openStickers() {
    AudioFX.click();
    const grid = $('stickerGrid');
    grid.innerHTML = '';
    let n = 0;
    for (const st of Stickers.all()) {
      const has = Stickers.has(st.key); if (has) n++;
      const b = document.createElement('button');
      b.className = 'sticker' + (has ? '' : ' locked');
      const img = Stickers.image(st, 72, !has);
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
  function choice() { show('choice', true); Voice.say(simple() ? 'You laid eggs! Hatch the babies, or keep hopping?' : 'You laid your eggs! Hatch the next generation, or keep hopping around?', { interrupt: true }); }
  const MODALS = ['help', 'stickerBook', 'journal', 'microscope', 'choice', 'guide', 'story', 'storyBook', 'recorder', 'safari', 'grownup', 'readCard', 'readPage', 'myWords'];
  function anyModalOpen() { return MODALS.some(id => $(id) && !$(id).hidden); }
  function closeModals() { MODALS.filter(id => id !== 'choice' && id !== 'readPage' && id !== 'readCard').concat(['drawer']).forEach(id => $(id) && show(id, false)); Microscope.close(); Story.close(); }

  return { init, update, hint, refreshToggles, refreshSpecies, hideTitle, showTitle, choice, resetFacts, queueFact, onSticker, openStickers, openJournal, anyModalOpen, closeModals, isFactOpen: () => factOpen, T };
})();
