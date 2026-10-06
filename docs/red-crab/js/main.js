/* ============================================================
   main.js — the game loop, input, the story's director, glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'red', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('redcrab.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('redcrab.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .17, day: 1, generation: 1, moon: .75, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form, sex: settings.sex,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 240;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;
  /* the director's clocks */
  let fishAt = 0, whaleDone = false, birdAt = 0, robberAt = null, migrateAt = null, rivalAt = null, femaleAt = null, lastNight = null, mantaAt = 0;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.world = new World(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  /* the mother at the sea's edge, before dawn, with her eggs */
  function makeMum() {
    const Wd = G.world, S = Wd.ground, w = crabUnits(9.6);
    const x = clamp(Wd.waterEdge() + 6, 10, 90);
    Wd.mum = { x, y: S.walkTop(x, 6) - w * .42, w, feet: w * .42, form: G.form, eggs: 1, shake: 0, ph: 0, leaving: false };
  }
  function newGame(newSeed) {
    G.form = settings.form; G.sex = settings.sex;
    G.fast = false;
    makeWorld(newSeed);
    G.tod = .17; G.moon = .75; G.year = 0;
    makeMum();
    G.players = [new Crab(G, G.form, G.sex)];
    fishAt = G.time + 30; whaleDone = false; birdAt = G.time + 25; robberAt = null; migrateAt = null; rivalAt = null; femaleAt = null; lastNight = null; mantaAt = G.time + 90;
    for (const k in once) delete once[k];
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 5;
    UI.buildWheel();
  }

  function resize() { W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1); Render.resize(W, H, DPR); G.cam.resize(W, H); }
  addEventListener('resize', resize);

  /* ---------- input (only while the game runs; never while typing) ---------- */
  const keys = {};
  const inputState = { padX: 0, padY: 0 };
  const typing = (e) => { const t = e.target; if (!t || !t.tagName) return false; if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true; return t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type); };
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (G.started && Reading.keydown(e)) return;
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    keys[K] = true;
    if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!G.started) { if (k === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { start(false); e.preventDefault(); } return; }
    if (UI.anyModalOpen()) {
      if (K === 'y' && Microscope.isOpen()) Microscope.close();
      if ((k === '?' || k === '/') && !document.getElementById('help').hidden) document.getElementById('help').hidden = true;
      if (k === 'Escape') UI.closeModals();
      return;
    }
    const p1 = G.player;
    if (k === ' ' || k === 'Enter') { p1.input.actionPressed = true; e.preventDefault(); }
    if (K === 'e') p1.input.eggPressed = true;
    if (K === 'l') toggle('labels');
    if (K === 'm') toggle('sound');
    if (K === 'v') toggle('voice');
    if (K === 'p') photo();
    if (K === 'y') { if (Microscope.isOpen()) Microscope.close(); else Microscope.open(G); }
    if (K === 'b') UI.openStickers();
    if (K === 'j') UI.openJournal();
    if (K === 'f') toggle('fast');
    if (K === 'g') toggle('science');
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') UI.closeModals();
  });
  addEventListener('keyup', (e) => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = false; });
  const releaseAll = () => { for (const k in keys) keys[k] = false; inputState.padX = inputState.padY = 0; document.querySelectorAll('.dpad button.down').forEach(b => b.classList.remove('down')); };
  addEventListener('blur', releaseAll);
  document.querySelectorAll('#drawer input[type=range], #drawer select').forEach(el => el.addEventListener('change', () => el.blur()));

  function readInput() {
    const pads = Gamepads.poll(), p1 = G.player;
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1;
    if (keys.ArrowRight || keys.d) x += 1;
    if (keys.ArrowUp || keys.w) y -= 1;
    if (keys.ArrowDown || keys.s) y += 1;
    x += inputState.padX; y += inputState.padY;
    const g1 = pads[0];
    if (g1) { x += g1.x; y += g1.y; if (g1.actionPressed) p1.input.actionPressed = true; if (g1.eggPressed) p1.input.eggPressed = true; if (g1.photoPressed) photo(); if (g1.scopePressed) Microscope.open(G); }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    if (x || y) p1.target = null;
    p1.input.x = x; p1.input.y = y;
    Reading.intercept(p1);
  }

  /* touch pad */
  const pad = document.getElementById('pad');
  pad.querySelectorAll('.dpad button').forEach(b => {
    const dir = b.dataset.dir;
    const set = (on) => {
      b.classList.toggle('down', on);
      if (dir === 'left') inputState.padX = on ? -1 : (inputState.padX < 0 ? 0 : inputState.padX);
      if (dir === 'right') inputState.padX = on ? 1 : (inputState.padX > 0 ? 0 : inputState.padX);
      if (dir === 'up') inputState.padY = on ? -1 : (inputState.padY < 0 ? 0 : inputState.padY);
      if (dir === 'down') inputState.padY = on ? 1 : (inputState.padY > 0 ? 0 : inputState.padY);
    };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
    b.addEventListener('pointerup', () => set(false));
    b.addEventListener('pointercancel', () => set(false));
    b.addEventListener('lostpointercapture', () => set(false));
  });
  document.getElementById('btnAction').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.actionPressed = true; });
  document.getElementById('btnDash').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.eggPressed = true; });

  /* tap the sea or the ground to go there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* in a pushing contest or while shaking the eggs, a tap is the button */
    if (p.mode === 'shove' || p.mode === 'release' || p.stage === 'egg') { p.input.actionPressed = true; return; }
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    p.goTo(wx, wy);
  });
  canvas.addEventListener('wheel', (e) => { G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .9 : 1.1), .4, 2.5); e.preventDefault(); }, { passive: false });

  /* ---------- toggles ---------- */
  function toggle(key) {
    switch (key) {
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'voice': settings.voice = !settings.voice; Voice.setEnabled(settings.voice); if (settings.voice) Voice.say('Reading aloud is on.', { force: true }); break;
      case 'fast': G.fast = !G.fast; if (G.fast) UI.hint(settings.reading === 'simple' ? '⏩ Fast!' : '⏩ Time-lapse. Press F again for normal speed.'); break;
      default: if (key in settings) settings[key] = !settings[key];
    }
    saveSettings(); UI.refreshToggles(); AudioFX.click();
  }
  function photo() {
    if (!G.started) return;
    Journal.photo(() => Render.snapshot(G));
    document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 300);
    AudioFX.shutter && AudioFX.shutter();
    UI.hint(settings.reading === 'simple' ? '📷 Snap! Saved to your journal.' : '📷 Snap! Saved to your journal and downloaded.');
  }

  /* ---------- UI wiring ---------- */
  const nextCrabNote = () => UI.hint(settings.reading === 'simple' ? `Your next crab will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This crab stays as it is.`);
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; if (G.world.mum) G.world.mum.form = k; UI.buildWheel(); } else nextCrabNote(); UI.refreshForms(); },
    onSex: (s) => { settings.sex = s; saveSettings(); if (!G.started) { G.sex = s; G.player.sex = s; } else nextCrabNote(); UI.buildForms(document.getElementById('formPick')); UI.buildForms(document.getElementById('formPickDrawer')); UI.refreshForms(); },
    onDiff: (d) => { settings.difficulty = d; saveSettings(); },
    onReading: (r) => { settings.reading = r; saveSettings(); },
    onReadMode: (m) => { settings.readMode = m; if (m === 'play') settings.reading = 'simple'; saveSettings(); },
    onReadLevel: (L) => { if (L === 'auto') settings.readAuto = !settings.readAuto; else { settings.readLevel = L; settings.readMode = 'play'; } saveSettings(); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); },
    onQuality: (q) => { settings.quality = q; saveSettings(); Render.setQuality(q === 'low' ? 'low' : 'high'); },
    onToggle: toggle,
    onTod: (v) => { G.tod = v; },
    onNewGame: () => { UI.resetFacts(); G.generation = 1; G.day = 1; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); Bus.emit('started', G.player); UI.refreshToggles(); },
    onNextGeneration: () => { UI.resetFacts(); G.generation++; Stickers.setGeneration(G.generation); G.day = 1; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); Bus.emit('started', G.player); UI.refreshToggles(); },
    onPhoto: photo,
    canNextGen: () => !!(G.player && G.player.flags.genDone)
  });
  Stickers.init(UI.onSticker);
  Journal.init(G);
  Voice.init(); Grownups.guardOutboundLinks(); Voice.setEnabled(settings.voice);
  Reading.init(G, { saveSettings });

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Crab(G, G.form, G.sex); G.players = [b]; b.restore(po); });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Stickers.setGeneration(G.generation); UI.buildWheel(); afterRestore(); }
      G.cam.x = G.player.x; G.cam.y = G.player.y;
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else { Voice.say('Welcome back!', { force: true }); UI.hint(resumeHint()); }
  }
  /* put back the things a save does not hold: the egg's mother, the crowds, the partners on the terrace */
  function afterRestore() {
    const p = G.player, Wd = G.world;
    if (p.stage === 'egg') makeMum();
    if (p.stage === 'crab' && p.instar === 1 && !p.flags.forest) Wd.startBabies();
    if (p.flags.migrating && !p.flags.dipped) Wd.startMarch(p);
    if (p.flags.dipped && p.sex === 'girl' && !p.flags.met) Wd.makeMaleBurrows();
    if (p.instar >= 4 && !p.flags.migrating) migrateAt = G.time + 25;
    if (p.flags.dipped && p.sex === 'boy' && p.flags.burrowDug && !p.flags.met) { if (p.flags.king) femaleAt = G.time + 4; else rivalAt = G.time + 4; }
    if (p.flags.king && !p.flags.kingSeen) { p.flags.kingSeen = true; later(1500, () => Bus.emit('king', P())); }
    /* the visitors that already came do not come straight back */
    if (p.stage === 'zoea' && p.zinstar >= 3) whaleDone = true;
    if (p.flags.met && !p.flags.genDone) later(2500, () => { if (p.sex === 'boy') eggsAtSea(); });
    if (p.mode === 'harden' && p.instar < 4) Wd.season = 'dry';
  }
  function resumeHint() {
    const p = G.player;
    if (p.stage === 'egg') return 'egg';
    if (p.stage === 'zoea') return 'swim';
    if (p.stage === 'megalopa') return 'megalopa';
    if (p.mode === 'harden') return 'soft';
    if (p.mode === 'brood') return 'brood';
    if (p.flags.broodDone && !p.flags.released) return 'moonready';
    if (p.flags.migrating && !p.flags.dipped) return 'sea';
    if (p.instar === 1 && !p.flags.forest) return 'march';
    if (p.full) return 'full';
    if (p.instar >= 4 && !p.flags.migrating) return 'adult';
    return 'forest';
  }

  /* ---------- events → hints, facts, cinematics ---------- */
  const P = () => G.player;
  const once = {};
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* timers that outlive a New Game must not act on the new one */
  const later = (ms, fn) => { const W0 = G.world; setTimeout(() => { if (G.world === W0) fn(); }, ms); };
  const fact = (k, ms = 0) => ms ? later(ms, () => Bus.emit('fact', k)) : Bus.emit('fact', k);
  Bus.on('started', () => { UI.hint('egg'); fact('egg', 1800); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a red crab egg. Your mum is at the edge of the sea.' : 'You are one of a hundred thousand red crab eggs. Your mother is standing at the edge of the sea, before dawn.', { force: true }); });
  Bus.on('eggReady', () => { UI.hint('hatch'); const m = G.world.mum; if (m) m.shake = 1; });
  Bus.on('hatched', (p) => {
    AudioFX.hatch(); UI.hint('swim'); fact('hatch');
    const m = G.world.mum; if (m) { m.shake = 0; m.eggs = .4; later(4000, () => { if (G.world.mum) G.world.mum.leaving = true; }); }
    Cinematic.play({ follow: P, zoom: 7, duration: 3, slow: .5, title: 'Splash! A zoea!' });
    fact('zoea', 9000); fact('plankton', 30000);
  });
  Bus.on('ate', (p) => { if (p.stats.plankton === 6) fact('diatom'); if (p.stats.plankton === 3) UI.hint('bigger'); });
  Bus.on('copepodJump', () => { if (first('copepod')) UI.hint('copepod'); });
  Bus.on('ateCopepod', () => fact('copepod'));
  Bus.on('glow', () => { if (first('glow')) fact('glow'); });
  Bus.on('dash', () => { if (first('dashed')) UI.hint('swim'); });
  Bus.on('tight', () => { UI.hint('tight'); AudioFX.bump(); });
  Bus.on('molting', (p) => { AudioFX.molt(); Cinematic.play({ follow: P, zoom: p.stage === 'crab' ? 3.6 : 7, duration: MOLT_T + .4, slow: .6, title: 'Moulting!' }); });
  Bus.on('molted', (p, i) => { UI.hint('bigger'); fact('seamoult'); G.particles.sparkle(p.x, p.y, 16, '#fff3c0', 8); if (i === 2) later(12000, () => { if (P().stage === 'zoea') UI.hint('flick'); }); });
  Bus.on('missed', () => UI.hint('missed'));
  Bus.on('fishSchool', () => { UI.hint('fish'); fact('fish'); });
  Bus.on('whaleShark', (w) => { UI.hint('whale'); fact('whaleshark'); Cinematic.play({ follow: () => ({ x: (w.x + P().x) / 2, y: (w.y + P().y) / 2 }), zoom: .7, duration: 6, slow: .7, title: 'A whale shark!' }); });
  Bus.on('manta', () => fact('manta'));
  Bus.on('megalopa', (p) => { AudioFX.fanfare(); UI.hint('megalopa'); fact('megalopa'); Cinematic.play({ follow: P, zoom: 6, duration: 3, slow: .5, title: 'A megalopa!' }); fact('smell', 20000); later(6000, () => { if (P().stage === 'megalopa' && P().mode === 'swim') UI.hint('jelly'); }); });
  Bus.on('ride', () => { UI.hint('riding'); fact('jelly'); });
  Bus.on('hopOff', () => { if (P().stage === 'megalopa') UI.hint('megalopa'); });
  Bus.on('surf', () => UI.hint('surf'));
  Bus.on('ashore', (p) => {
    AudioFX.magic(); UI.hint('march'); fact('ashore');
    G.tod = Math.max(G.tod, .3) < .7 ? G.tod : .3;
    Cinematic.play({ follow: P, zoom: 6, duration: 4, slow: .5, title: 'A tiny crab!' });
    fact('carpet', 7000); fact('sideways', 40000); later(14000, () => { if (P().stage === 'crab') UI.hint('friend'); });
  });
  Bus.on('cliff', () => { UI.hint('climb'); fact('cliff'); });
  Bus.on('friends', () => UI.hint('friend'));
  Bus.on('drying', () => { UI.hint('dry'); fact('gills'); });
  Bus.on('shaded', () => { if (first('shadeHint') || P().water < .3) UI.hint('shade'); });
  Bus.on('tooDry', () => { G.particles.puff(P().x, P().y, '#fff', 6); });
  Bus.on('rested', () => { if (G.tod > .25 && G.tod < .78) G.tod = .8; UI.hint('rested'); });
  Bus.on('birdSwoop', () => { UI.hint('bird'); fact('bird'); });
  Bus.on('birdPass', (b) => { const p = P(); if (p.stage !== 'crab') return; if (Math.abs(b.target.x - p.x) > 120) return; if (p.shade !== 'shelter' && p.shade !== 'burrow' && p.mode === 'walk') p.knock(-1); else Bus.emit('birdMissed'); });
  Bus.on('forest', (p) => {
    AudioFX.fanfare(); UI.hint('forest'); fact('island'); fact('forest', 25000);
    Stickers.lifeDone(G.form, G.sex);
    Cinematic.play({ follow: P, zoom: 2.4, duration: 4, slow: .6, title: 'The rainforest!' });
  });
  Bus.on('firstFood', () => UI.hint('forest'));
  Bus.on('digStart', () => { UI.hint('dig'); fact('burrow'); });
  Bus.on('deepEnough', (p) => { if (p.moultReady()) UI.hint('moult'); });
  Bus.on('fullCrab', (p) => {
    UI.hint('full'); fact('dryseason');
    const Wd = G.world; Wd.season = 'dry'; if (Wd.weather.state === 'rain') Wd.setRain(false, 120);
  });
  Bus.on('sealed', () => AudioFX.thud());
  Bus.on('crabMolted', (p, i) => {
    UI.hint('soft'); fact('crabmoult'); if (i === 3) fact('years', 9000);
    G.particles.sparkle(p.x, p.y, 20, '#fff3c0', p.w);
    later(2500, () => { if (P().mode === 'harden') UI.hint('dryseason'); });
  });
  Bus.on('hardened', (p) => {
    const Wd = G.world;
    Wd.season = 'wet'; G.year++; G.day += 30;
    Wd.setRain(true, 30);
    if (p.instar >= 4) { UI.hint('adult'); fact('colour'); fact('eyes', 15000); fact('tenlegs', 30000); migrateAt = G.time + 40; }
    else UI.hint('wetseason');
  });
  Bus.on('unplug', () => { if (P().mode === 'burrow') UI.hint('out'); });
  Bus.on('robber', () => { const p = P(); if (p.stage === 'crab') { UI.hint('robber'); fact('robber'); } });
  Bus.on('robberGone', () => { const p = P(); if (p.flags.robberSafe) { Bus.emit('robberHid'); } UI.hint('safe'); });
  Bus.on('migrate', (p) => {
    p.flags.migrating = true; p.flags.marchStart = p.x;
    G.world.startMarch(p);
    UI.hint('rain'); fact('rain'); fact('migration', 12000);
    AudioFX.fanfare();
    Cinematic.play({ follow: () => ({ x: P().x - 200, y: P().y - 60 }), zoom: 1.1, duration: 5, slow: .7, title: 'The great migration!' });
  });
  Bus.on('bridge', () => fact('bridge'));
  Bus.on('antsMet', () => fact('ants'));
  Bus.on('dipped', (p) => {
    fact('dip'); AudioFX.splash();
    if (p.sex === 'boy') { UI.hint('burrowsite'); fact('males', 9000); }
    else { G.world.makeMaleBurrows(); UI.hint('findmale'); fact('males', 9000); }
  });
  Bus.on('siteDug', () => { rivalAt = G.time + 5; UI.hint('deeper'); });
  Bus.on('rivalArrived', (n) => { if (P().flags.met) return; UI.hint('rival'); AudioFX.clack(); });
  Bus.on('shove', () => UI.hint('shove'));
  Bus.on('shoveWon', (p) => { UI.hint('won'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 20, 50); if (!p.flags.king) rivalAt = G.time + 8; });
  Bus.on('shoveLost', () => { UI.hint('lost'); rivalAt = G.time + 22; });
  Bus.on('king', () => { UI.hint('king'); AudioFX.fanfare(); femaleAt = G.time + 6; Cinematic.play({ follow: P, zoom: 2.6, duration: 3.5, slow: .5, title: 'King of the terrace!' }); });
  Bus.on('femaleArrived', () => { UI.hint('female'); fact('female'); });
  Bus.on('met', (p, o) => {
    const Wd = G.world;
    if (p.sex === 'boy') {
      /* she goes down into his burrow to keep her eggs safe; his job is done */
      o.x = p.burrow ? p.burrow.x : o.x; o.mode = 'enter'; o.eggs = .3;
      UI.hint('home');
      later(5000, eggsAtSea);
    } else {
      /* he leaves her his burrow and walks home; she goes down to brood */
      o.mode = 'walk'; o.goal = o.x + 900; o.role = 'gone-home'; o.leave();
      p.startBrood(o.door);
      UI.hint('brood'); fact('female');
    }
  });
  Bus.on('broodDone', () => { G.moon = .75; G.tod = .13; UI.hint('moonready'); fact('moon'); });
  Bus.on('release', () => UI.hint('release'));
  Bus.on('shake', (p, n) => { if (n === 1) fact('egg'); });
  Bus.on('eggsReleased', () => generationDone());
  /* a boy's ending: twelve days later, at the turn of the tide, she lets her eggs go */
  function eggsAtSea() {
    const p = P(); if (p.flags.genDone || p.flags.eggsAtSea) return;
    p.flags.eggsAtSea = true;
    const Wd = G.world;
    G.moon = .75; G.tod = .13; G.day += 12;
    makeMum(); const m = Wd.mum; m.form = pick(FORM_KEYS.slice(0, 2)); m.shake = 1;
    UI.hint('eggs'); fact('moon');
    Cinematic.play({ follow: () => ({ x: m.x - 20, y: m.y }), zoom: 3.4, duration: 6, slow: .8, title: 'Twelve days later…' });
    let n = 0; const burst = () => { if (G.world !== Wd || n >= 6) return; n++; Wd.eggBurst(m.x - 6, m.y + m.feet * .5, 70); AudioFX.splash(); m.eggs = Math.max(0, 1 - n / 6); later(900, burst); };
    later(1200, burst);
    later(7200, () => P().milestone('eggs', () => { Wd.mum.shake = 0; Wd.mum.leaving = true; generationDone(); }));
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    UI.hint('eggs'); fact('lifecycle');
    Bus.emit('generationDone'); UI.refreshToggles();
    const open = () => { if (Reading.busy() || Cinematic.active) later(800, open); else UI.choice(); };
    later(2500, open);
  }

  /* ---------- debug jumps (?stage=…) ---------- */
  function toZoea(z, frac = .4) { const p = G.player, th = [0, ...G.diff().zoea]; p.hatch(); p.zinstar = z; p.food = th[z - 1] + (th[z] - th[z - 1]) * frac; p.x = -1500 - z * 300; p.y = 150; G.world.mum = null; for (let k = 1; k < z; k++) p.flags['zm' + k] = p.flags['ztight' + k] = true; }
  function toMega(x = -1600) { toZoea(3, 1); const p = G.player; p.flags.zm3 = true; p.stage = 'megalopa'; p.x = x; p.y = 90; G.world.drift = 1; }
  function toCrab(instar, x, frac = .4) {
    toMega(-20); const p = G.player, D = G.diff(), th = [0, ...D.crab];
    p.becomeCrab(); p.instar = instar; p.cfood = instar < 4 ? th[instar - 1] + (th[instar] - th[instar - 1]) * frac : D.crab[2] * (1 + (BONUS - 1) * frac);
    p.cm = crabCM(p.instar, p.cfood, D.crab); p.pale = 0;
    p.x = x; p.y = G.world.ground.walkTop(x, Math.max(4, p.w * .4)) - p.feet;
    if (x > WORLD.cliffR) { p.flags.forest = p.flags.forestGate = true; G.world.babies.length = 0; }
    p.flags.onCliff = x > WORLD.cliffL;
    G.tod = .4;
    Cinematic.stop();
  }
  function digHome(p, depth) {
    const S = G.world.ground, gx = p.x, g = S.surfaceAt(gx);
    for (let d = 0; d <= depth; d += 3) S.blob(gx + d * .25, g + d, Math.max(10, p.w * .6), Math.max(10, p.w * .55), MAT.AIR, (m) => S.diggable(m) || m === MAT.ROOT);
    S.flushTop(); p.burrow = { x: gx, y: g }; p.mode = 'burrow'; p.x = gx + depth * .25; p.y = g + depth; p.ang = Math.PI / 2;
  }
  function toMigrating(x) { toCrab(4, x, .6); const p = G.player; p.flags.migrating = true; p.flags.marchStart = 3900; G.world.startMarch(p); G.tod = .62; }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world;
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'rain') { wx.rain = 1; wx.cloud = 1; } }
    if (st) {
      const p = G.player;
      if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; }
      else if (/^zoea[123]$/.test(st)) toZoea(+st[4], +(params.get('frac') || .5));
      else if (st === 'whale') { toZoea(3, .5); whaleDone = true; Wd.startWhale(p); Wd.whale.x = p.x - 520; }
      else if (st === 'fish') { toZoea(2, .5); Wd.startSchool(p); Wd.school.x = p.x - 180; }
      else if (st === 'megalopa') toMega();
      else if (st === 'ride') { toMega(-1400); Wd.updateSea(0, p); const j = Wd.makeJelly(p.x + 10, p.y + 34); Wd.jellies.push(j); p.act(); }
      else if (st === 'surf') { toMega(-120); p.y = 30; }
      else if (st === 'ashore') { toCrab(1, 22, 0); Wd.startBabies(); }
      else if (st === 'cliff') { toCrab(1, 712, 0); Wd.startBabies(); for (const b of Wd.babies) b.x += 640; }
      else if (st === 'forest') toCrab(1, 1300, .5);
      else if (st === 'young') toCrab(2, 1700, .5);
      else if (st === 'full') { toCrab(2, 1700, 1); p.full = true; G.world.season = 'dry'; }
      else if (st === 'burrow') { toCrab(2, 1700, 1); p.full = true; digHome(p, p.w * 1.6); }
      else if (st === 'harden') { toCrab(3, 1700, 0); digHome(p, p.w * 1.6); p.mode = 'harden'; p.hardT = 2; p.pale = .7; G.world.season = 'dry'; }
      else if (st === 'robber') { toCrab(3, 2900, .5); Wd.startRobber(p.x); Wd.robber.x = p.x + 120; }
      else if (st === 'adult') toCrab(4, 3900, .5);
      else if (st === 'rain') { toCrab(4, 3900, .6); Wd.setRain(true, 60); Bus.emit('migrate', p); }
      else if (st === 'march') toMigrating(3300);
      else if (st === 'bridge') toMigrating(WORLD.bridgeL + 140);
      else if (st === 'cliffdown') toMigrating(860);
      else if (st === 'shore') { toMigrating(60); }
      else if (st === 'terrace' || st === 'rival' || st === 'shove' || st === 'king' || st === 'female') {
        toMigrating(380); p.flags.dipped = true; p.sex = 'boy'; G.sex = 'boy';
        digHome(p, p.w * 1.3); p.flags.siteBurrow = p.flags.burrowDug = true; p.surface();
        p.x = p.burrow.x + p.w * .6; p.y = Wd.ground.walkTop(p.x, 6) - p.feet;
        if (st === 'rival' || st === 'shove') { const r = Wd.sendRival(p); r.x = r.goal; r.mode = 'stand'; r.face = -1; if (st === 'shove') { p.startShove(r); p.wr.p = +(params.get('wp') || .3); p.wr.ring = 1.4; } }
        if (st === 'king' || st === 'female') { p.stats.wins = G.diff().wins; p.flags.king = p.flags.kingSeen = true; if (st === 'female') { const f = Wd.sendFemale(p); f.x = f.goal; f.mode = 'stand'; f.face = -1; } }
      }
      else if (st === 'host') { toMigrating(160); p.sex = 'girl'; G.sex = 'girl'; p.flags.dipped = true; Wd.makeMaleBurrows(); }
      else if (st === 'brood') { toMigrating(160); p.sex = 'girl'; G.sex = 'girl'; p.flags.dipped = true; Wd.makeMaleBurrows(); const h = Wd.hosts()[0]; h.leave(); p.flags.met = true; p.startBrood(h.door); p.broodT = +(params.get('bt') || 6); }
      else if (st === 'release') { toMigrating(40); p.sex = 'girl'; G.sex = 'girl'; p.flags.dipped = p.flags.met = p.flags.broodDone = true; p.eggs = 1; G.tod = .14; G.moon = .75; p.x = G.world.waterEdge() + 4; p.y = Wd.ground.walkTop(p.x, 6) - p.feet; p.startRelease(); }
      else if (st === 'eggs') { toMigrating(380); p.flags.dipped = true; p.flags.met = true; G.tod = .14; later(200, eggsAtSea); }
    }
    if (params.has('water')) G.player.water = +params.get('water');
    if (params.has('food')) G.player.food = +params.get('food');
  }

  /* the gamepad on the title and in the panels */
  function padMenus(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (!G.started) { if (g.actionPressed || g.startPressed) start(false); return; }
    const choice = document.getElementById('choice');
    if (!choice.hidden) { if (g.actionPressed) document.getElementById('btnNextGen').click(); else if (g.eggPressed || g.startPressed) document.getElementById('btnKeep').click(); return; }
    if (g.eggPressed || g.startPressed || g.scopePressed) UI.closeModals();
  }

  /* ---------- the director: visitors, seasons, the rain, rivals, partners ---------- */
  function director(dt) {
    const p = G.player, Wd = G.world, D = G.diff(), vis = settings.visitors;
    /* the egg's mother walks back up the shore once the eggs are in the sea */
    const m = Wd.mum;
    if (m) { if (m.leaving) { m.x += 26 * dt; m.y = Wd.ground.walkTop(m.x, 6) - m.feet; if (m.x > 300) Wd.mum = null; } else if (m.shake) m.ph += dt * 3; }
    const night = nightAmount(G.tod) > .5;
    if (p.swimming) {
      /* day and night: the plankton move up and down */
      if (lastNight !== null && night !== lastNight && p.stage === 'zoea') { UI.hint(night ? 'night' : 'day'); fact('updown'); }
      lastNight = night;
      if (p.stage === 'zoea' && vis && D.fish && p.zinstar >= 2 && !Wd.school && G.time > fishAt && p.molting <= 0) { Wd.startSchool(p); fishAt = G.time + 80 + Math.random() * 50; }
      if (p.stage === 'zoea' && vis && p.zinstar === 3 && !whaleDone && p.food > D.zoea[1] + (D.zoea[2] - D.zoea[1]) * .3 && p.molting <= 0) { whaleDone = true; Wd.startWhale(p); }
      if (vis && night && G.time > mantaAt && !Wd.manta) { mantaAt = G.time + 160; Wd.startManta(p); }
      if (p.stage === 'megalopa' && p.mode === 'swim' && Wd.jellies.some(j => Math.hypot(j.x - p.x, j.y - p.y) < 160) && first('jellyNear')) UI.hint('jelly');
      return;
    }
    if (p.stage !== 'crab') return;
    if (p.mode === 'walk' && p.flags.forest && !once.eatHintShown && p.context() === 'eat') { once.eatHintShown = true; UI.hint('eat'); }
    /* seabirds swoop at small crabs out in the sun */
    if (vis && p.instar <= 2 && !night && p.mode === 'walk' && p.shade === 'sun' && G.time > birdAt) { if (Wd.swoop(p)) birdAt = G.time + 45 + Math.random() * 40; }
    /* the robber crab comes by while you are a young crab in the forest */
    if (vis && D.robber && p.instar >= 2 && p.instar <= 3 && !Wd.robber.done && Wd.robber.state === 'away') {
      if (robberAt === null) robberAt = G.time + 50 + Math.random() * 50;
      if (G.time > robberAt && p.mode === 'walk' && p.x > 1100) Wd.startRobber(p.x);
    }
    if (Wd.robber.state === 'sniff' && p.underground && p.depth > p.w * .6) p.flags.robberSafe = true;
    /* the first rains: the migration begins */
    if (p.instar >= 4 && !p.flags.migrating && migrateAt !== null && G.time > migrateAt && p.mode === 'walk') {
      migrateAt = null;
      Wd.setRain(true, 70);
      later(2500, () => { if (!P().flags.migrating) Bus.emit('migrate', P()); });
    }
    if (p.flags.migrating && !p.flags.dipped) {
      if (p.x < WORLD.bridgeR + 220 && p.x > WORLD.bridgeL && first('bridgeHint')) UI.hint('bridge');
      if (p.x < WORLD.terraceR && first('dipHint')) UI.hint('dip');
      /* the march goes with the rain: crabs move when it is damp */
      if (Wd.weather.state === 'clear' && Math.random() < dt * .02) Wd.setRain(true, 40);
    }
    /* boys: rivals come for the burrow, then a female */
    if (p.sex === 'boy' && p.flags.dipped && p.flags.burrowDug && !p.flags.met) {
      if (rivalAt !== null && G.time > rivalAt && !Wd.rival() && !p.flags.king && p.mode !== 'shove') { rivalAt = null; Wd.sendRival(p); }
      if (femaleAt !== null && G.time > femaleAt && !Wd.female() && p.flags.king) { femaleAt = null; Wd.sendFemale(p); }
    }
  }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0, saveWarned = false;
  function simulate(dt) {
    const p = G.player;
    /* at sea the days go by twice as fast: the larvae spend about a month out there */
    if (settings.clock) { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (p.swimming ? 2 : 1)) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    director(dt);
    if (p.stage === 'crab' && p.instar === 1 && G.world.babies.some(b => Math.abs(b.x - p.x) < 30) && first('metBabies')) Bus.emit('friends');
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.stage === 'egg') { const m = G.world.mum; cam.follow(m ? m.x - 10 : p.x, m ? m.y - 4 : p.y, 5 * uz); }
    else if (p.stage === 'zoea') cam.follow(p.x + p.face * 10, p.y, (7.2 - p.zinstar * .4) * uz);
    else if (p.stage === 'megalopa') cam.follow(p.x + p.face * 20, p.y, (p.mode === 'ride' ? 3.6 : 5) * uz);
    else if (p.mode === 'shove' && p.wr) cam.follow(p.wr.mid, p.y - p.w * .3, clamp(90 / (p.w + 20), 1.2, 4) * uz);
    else if (p.mode === 'release') cam.follow(p.x - 20, p.y, 3.2 * uz);
    else {
      const z = clamp(110 / (p.w + 14), 1.25, 6) * (p.underground ? 1.2 : 1);
      cam.follow(p.x + p.face * p.w * .8, p.y - p.w * (p.underground ? 0 : .9), z * uz);
    }
    cam.update(rawDt, G.world.bounds);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = clamp((now - last) / 1000, 0, .05);
    last = now;
    if (document.hidden) return;
    Cinematic.update(rawDt);
    const dt = rawDt * Cinematic.timeScale * (settings.slowmo ? .8 : 1);
    const modal = UI.anyModalOpen(), p = G.player;
    if (G.started && !modal) readInput(); else p.input.x = p.input.y = 0;
    if (G.started && modal && Reading.busy()) Reading.gamepad(Gamepads.poll());
    else if (modal || !G.started) padMenus(Gamepads.poll());
    if (G.started && !modal) {
      /* time-lapse (F), and a fast-forward while the crab just waits: the dry season, brooding, resting */
      const waiting = (p.stage === 'egg' && !p.flags.eggReady) || ['harden', 'brood', 'rest'].includes(p.mode);
      G.warp = p.mode === 'shove' || p.mode === 'release' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, (x) => G.world.ground.walkTop(x, 4));
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} i${p.instar} z${p.zinstar} food=${p.food.toFixed(0)}/${p.cfood.toFixed(0)} w=${p.water.toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, edge = Wd.waterEdge();
    AudioFX.update(dt, { night: G.night, under: p.swimming && p.y > Wd.seaLevel() + 3, inside: p.underground, rain: Wd.weather.rain, wind: Wd.weather.gust, surf: clamp(1 - Math.abs(G.cam.x - edge) / 600, 0, 1), swash: Wd.swash(), forest: smoothstep(800, 1100, G.cam.x) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: red crabs marching along a beach at dawn ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const marchers = Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), s: .16 + Math.random() * .12, sp: .02 + Math.random() * .015, ph: Math.random() * TAU, row: Math.random(), form: Math.random() < .88 ? 'red' : Math.random() < .7 ? 'orange' : 'purple' }));
  marchers.sort((a, b) => a.row - b.row);
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a1c4a'); g.addColorStop(.45, '#ff9a6a'); g.addColorStop(.62, '#ffd8a0'); g.addColorStop(.63, '#4a90c0'); g.addColorStop(1, '#1a4a7a');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    /* the last quarter moon, and the sun coming up */
    tctx.globalAlpha = .9; Render.drawMoonDisc(tctx, W * .82, H * .16, 26, .75); tctx.globalAlpha = 1;
    const sg = tctx.createRadialGradient(W * .3, H * .62, 4, W * .3, H * .62, 200); sg.addColorStop(0, 'rgba(255,240,200,1)'); sg.addColorStop(.15, 'rgba(255,200,140,.6)'); sg.addColorStop(1, 'rgba(255,160,100,0)');
    tctx.fillStyle = sg; tctx.fillRect(0, 0, W, H * .63);
    /* the sea with its glitter */
    tctx.fillStyle = 'rgba(255,230,190,.5)';
    for (let k = 0; k < 50; k++) { const x = W * .3 + Math.sin(k * 7.3) * W * .18 + Math.sin(tt + k) * 6, y = H * .64 + (k % 10) * H * .012; tctx.fillRect(x, y, 14 + (k % 4) * 6, 1.5); }
    /* the island: cliffs and the rainforest on top */
    tctx.fillStyle = '#26402e';
    tctx.beginPath(); tctx.moveTo(W * .55, H * .64); tctx.lineTo(W * .62, H * .5); tctx.lineTo(W * .7, H * .48); tctx.lineTo(W * .74, H * .4); tctx.lineTo(W, H * .38); tctx.lineTo(W, H * .64); tctx.closePath(); tctx.fill();
    tctx.fillStyle = '#1a3022';
    for (let k = 0; k < 12; k++) { const x = W * (.66 + k * .03), r = 22 + (k * 13 % 18); tctx.beginPath(); tctx.arc(x, H * .4 - r * .4 - (k % 3) * 6, r, 0, TAU); tctx.fill(); }
    /* the beach, and the waves washing up */
    const bg = tctx.createLinearGradient(0, H * .74, 0, H); bg.addColorStop(0, '#e8c898'); bg.addColorStop(1, '#b08860');
    tctx.fillStyle = bg; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, H * .8); tctx.quadraticCurveTo(W * .5, H * .72, W, H * .76); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    const sw = (Math.sin(tt * 1.1) + 1) / 2;
    tctx.fillStyle = 'rgba(255,255,255,.7)'; tctx.beginPath(); tctx.moveTo(0, H * .8); for (let x = 0; x <= W * .45; x += 10) tctx.lineTo(x, H * (.79 - sw * .02) + Math.sin(x * .05 + tt * 2) * 3); tctx.lineTo(W * .45, H * .77); tctx.lineTo(0, H * .78); tctx.fill();
    /* red crabs marching across the sand */
    for (const c of marchers) {
      c.x -= c.sp * dt; c.ph += dt * 9; if (c.x < -.1) c.x = 1.1;
      const x = c.x * W, y = H * (.82 + c.row * .14), s = c.s * Math.min(1.4, W / 1000) * (.8 + c.row * .5);
      tctx.save(); tctx.translate(x, y); Sprites.drawCrab(tctx, { s, form: c.form, walk: c.ph, moving: true, sex: c.row > .5 ? 'boy' : 'girl', seed: 3 }); tctx.restore();
    }
  }

  /* ---------- save on leave, install offline ---------- */
  addEventListener('visibilitychange', () => {
    if (document.hidden) { SaveGame.write(G); releaseAll(); AudioFX.pause(true); Voice.stop(); }
    else { AudioFX.pause(false); last = performance.now(); }
  });
  addEventListener('beforeunload', () => SaveGame.write(G));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });

  /* ---------- go ---------- */
  Render.init(canvas);
  resize();
  Render.setQuality(settings.quality === 'low' ? 'low' : 'high');
  if (params.has('form') && FORMS[params.get('form')]) settings.form = params.get('form');
  if (params.has('sex') && SEXES[params.get('sex')]) settings.sex = params.get('sex');
  if (params.has('diff') && DIFFICULTY[params.get('diff')]) settings.difficulty = params.get('diff');
  newGame(seed);
  if (params.has('labels')) settings.labels = true;
  if (params.has('pad')) settings.pad = true;
  if (['simple', 'normal'].includes(params.get('read'))) settings.reading = params.get('read');
  if (['auto', 'high', 'low'].includes(params.get('quality'))) settings.quality = params.get('quality');
  if (params.has('readlevel') && READ_LEVELS.includes(params.get('readlevel').toUpperCase())) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  if (params.has('science')) settings.science = true;
  applyDebug();
  if (params.has('tod')) G.tod = +params.get('tod');
  if (params.has('moon')) G.moon = +params.get('moon');
  if (params.has('zoom')) G.userZoom = +params.get('zoom');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); if (params.has('stage')) setTimeout(() => UI.hint(resumeHint()), 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'zoea' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'boy');
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'drawer') document.getElementById('drawer').hidden = false;
      else if (o === 'choice') document.getElementById('choice').hidden = false;
    }, 60);
  }
  /* ?clean=1: no panels or pop-ups, for screenshots (the Arcade card) */
  if (params.has('clean')) { const st = document.createElement('style'); st.textContent = '.hud,.hint,.fact,.toast,.mission-card,.pad{visibility:hidden!important}'; document.head.appendChild(st); }
  if (params.has('mission')) Reading._missionNow();
  if (params.has('readpage')) setTimeout(() => { Reading._solveGate(); Reading.showPage(params.get('readpage'), { gate: params.has('gate') }); }, 80);
  if (params.has('readcard')) setTimeout(() => { Reading._solveGate(); G.player.input.actionPressed = true; Reading.intercept(G.player); }, 120);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); nx && nx.click(); }, 400);
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'crab', 'go', 'up', 'little', 'big', 'dig', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.shake = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
