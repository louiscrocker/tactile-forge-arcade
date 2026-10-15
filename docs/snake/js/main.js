/* ============================================================
   main.js — the game loop, input, debug jumps, the title, glue
   ============================================================
   The story's director lives in story.js (shared with smoke.js);
   this file wires it to the screen: hints, facts, cinematics and
   the "a new litter!" choice.
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'eastern', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('snake.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('snake.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .45, day: 1, generation: 1, moon: .5, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form, sex: settings.sex,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 240;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.world = new World(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  function newGame(newSeed) {
    G.form = settings.form; G.sex = settings.sex;
    G.fast = false;
    makeWorld(newSeed);
    G.tod = .45; G.moon = .5; G.year = 0;
    G.world.makeLitter(WORLD.birthX, G.form);
    G.players = [new Snake(G, G.form, G.sex)];
    Story.reset();
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 4;
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
    if (K === 'o' && typeof GFX !== 'undefined' && GFX.canvas()) UI.hint(GFX.toggle() ? 'New look (WebGL) on' : 'New look off (classic)');
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

  /* tap the ground to slither there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* in the bag, during the birth or in the race, a tap is the button */
    if (p.mode === 'birth' || p.stage === 'sac') { p.input.actionPressed = true; return; }
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    if (Math.abs(wx - p.x) < p.thick * 3 && Math.abs(wy - p.y) < p.thick * 4) { p.input.actionPressed = true; return; }
    if (p.mode === 'hide') p.unhide();
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next snake will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This snake stays as it is.`);
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; for (const n of G.world.npcs) n.form = k; if (G.world.mum) G.world.mum.form = k; UI.buildWheel(); } else nextNote(); UI.refreshForms(); },
    onSex: (s) => { settings.sex = s; saveSettings(); if (!G.started) { G.sex = s; G.player.sex = s; } else nextNote(); UI.buildForms(document.getElementById('formPick')); UI.buildForms(document.getElementById('formPickDrawer')); UI.refreshForms(); },
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
  const openChoice = () => { if (Reading.busy() || Cinematic.active) setTimeout(openChoice, 800); else { UI.choice(); UI.refreshToggles(); } };
  Story.init(G, { hint: (k) => UI.hint(k), fact: (k) => Bus.emit('fact', k), cine: (o) => Cinematic.play(o), done: openChoice });

  /* sounds and little touches that only the browser needs */
  Bus.on('ateSnack', () => AudioFX.munch());
  Bus.on('dash', () => AudioFX.dash());
  Bus.on('frogPlop', () => AudioFX.plop());
  Bus.on('swimStart', () => AudioFX.splash());
  Bus.on('sacBroke', () => AudioFX.pop(1.3));
  Bus.on('hid', () => AudioFX.thud());
  Bus.on('generationDone', () => Stickers.check(true));
  Bus.on('born', (p) => Stickers.lifeDone(G.form, G.sex));

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Snake(G, G.form, G.sex); G.players = [b]; b.restore(po); });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Story.reset(); Stickers.setGeneration(G.generation); UI.buildWheel(); Story.afterRestore(); }
      G.cam.x = G.player.x; G.cam.y = G.player.y;
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else { Voice.say('Welcome back!', { force: true }); UI.hint(resumeHint()); }
  }
  function resumeHint() {
    const p = G.player;
    if (p.stage === 'sac') return 'newborn';
    if (p.mode === 'winter') return 'winter';
    if (p.underground) return p.flags.wintered ? 'spring' : 'deeper';
    if (p.shed === 'blue') return 'blue';
    if (p.shed === 'clear') return 'clear';
    if (p.flags.autumnNow && !p.flags.wintered) return 'autumn';
    if (p.flags.ready) return 'ready';
    if (p.flags.carrying) return 'carry';
    if (p.flags.gathering && !p.flags.met) return p.sex === 'boy' ? 'gather' : 'girlout';
    if (p.instar >= 4) return 'adult';
    return 'tongue';
  }

  /* ---------- debug jumps (?stage=…) ---------- */
  function toSnake(instar, x, frac = .4) {
    const p = G.player, Wd = G.world, D = G.diff(), th = [0, ...D.food];
    if (p.stage === 'sac') p.breakOut();
    Wd.mum = null; Wd.npcs.length = 0; Cinematic.stop();
    p.instar = instar; p.cfood = instar < 4 ? th[instar - 1] + (th[instar] - th[instar - 1]) * frac : D.food[2] * (1 + (BONUS - 1) * frac);
    p.cm = snakeCM(p.instar, p.cfood, D.food, p.sex); p.stats.sheds = instar - 1;
    if (instar >= 2) p.stats.winters = instar >= 4 ? 1 : instar >= 3 ? 1 : 0;
    place(x);
    p.warm = .6; p.flags.shedGate = instar >= 2; p.flags.denGate = p.flags.springGate = instar >= 3;
    return p;
  }
  function place(x, coil) {
    const p = G.player, Wd = G.world;
    p.mode = 'crawl'; p.x = x; p.y = Wd.topAt(x) - p.thick * .5;
    if (coil) p.coilHere(); else { Trail.reset(p.trail, p.x, p.y, p.face, p.len, (xx) => Wd.topAt(xx), p.thick * .5); p.coiled = false; }
  }
  function nearCover(kind, x) { return G.world.covers.filter(c => c.kind === kind).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]; }
  function seeSnacks(p) { for (let k = 0; k < 4; k++) { const x = p.x + 60 + k * 90; if (!G.world.land.inPond(x)) G.world.snacks.push({ x, y: G.world.land.walkY(x), val: 5, seen: true, t: 1, glint: k }); } }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world, L = Wd.land;
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'rain') { wx.rain = 1; wx.cloud = .9; } if (s === 'snow') { wx.snow = 1; wx.cloud = .7; } }
    if (!st) return;
    const p = G.player;
    if (st === 'wiggle') { p.sacT = 5; p.flags.sacReady = true; p.crack = .5; }
    else if (st === 'born') { p.breakOut(); Cinematic.stop(); for (const n of Wd.npcs) { n.sacT = Math.min(n.sacT, .2); } }
    else if (st === 'tongue' || st === 'snack') { p.breakOut(); Cinematic.stop(); seeSnacks(p); p.tongueT = .5; p.scentT = 2; if (st === 'snack') { p.x = Wd.snacks[Wd.snacks.length - 4].x - 14; place(p.x); } }
    else if (st === 'bask') { const c = nearCover('rock', 340); toSnake(2, c.x, .5); place(c.x, true); G.tod = .5; p.warm = .5; }
    else if (st === 'cold') { toSnake(2, 600, .3); G.tod = .86; p.warm = .1; }
    else if (st === 'hot') { toSnake(3, 600, .3); G.tod = .55; p.warm = .97; }
    else if (st === 'hide') { toSnake(2, 520, .4); p.hideUnder(nearCover('board', 540)); }
    else if (st === 'hawk' || st === 'hawkdive') { toSnake(2, 160, .4); G.tod = .5; const h = Wd.startHawk(p); if (st === 'hawkdive') { h.t = 6.6; h.state = 'dive'; h.t = .7; h.sx = p.x - 200; h.sy = -380; h.tx = p.x; h.ty = p.y - 10; } }
    else if (st === 'raccoon' || st === 'musk') { toSnake(2, 400, .4); G.tod = .92; const r = Wd.startRaccoon(p); r.x = p.x - r.dir * 80; if (st === 'musk') { r.state = 'sniff'; r.t = 3; r.checked = true; r.musked = true; } }
    else if (st === 'pond' || st === 'swim') { toSnake(2, 1700, .4); p.face = 1; place(1700); }
    else if (st === 'frog') { toSnake(2, WORLD.pondL - 40, .4); }
    else if (st === 'heron') { toSnake(2, 1650, .4); const h = Wd.startHeron(p); h.state = 'stand'; h.t = 0; h.x = h.gx; h.y = Math.min(L.surfaceAt(h.gx), WORLD.waterY + 30); }
    else if (st === 'blue') { toSnake(1, 520, 1); p.full = true; p.shed = 'blue'; p.blueT = 3; p.hideUnder(nearCover('board', 540)); }
    else if (st === 'blueout') { toSnake(1, 600, 1); p.full = true; p.shed = 'blue'; p.blueT = 3; }
    else if (st === 'clear') { const c = nearCover('rock', 340); toSnake(1, c.x - c.w / 2 - 30, 1); p.full = true; p.shed = 'clear'; p.face = 1; place(p.x); }
    else if (st === 'peel') { toSnake(1, 300, 1); p.full = true; p.shed = 'clear'; p.startPeel(); p.peel = +(params.get('peel') || .45); }
    else if (st === 'shed') { toSnake(2, 420, .1); Wd.exuviae.push({ x: p.x - 70, y: Wd.topAt(p.x - 70), len: p.len * 1.08, thick: p.thick, form: p.form, face: 1, seed: 3, looked: false, t: 0 }); p.fresh = 1; }
    else if (st === 'autumn') { toSnake(2, 300, .3); Wd.setSeason('autumn'); p.flags.autumnNow = true; Wd.startAutumn(p); p.scentT = 3; G.tod = .55; }
    else if (st === 'denmouth') { toSnake(2, L.mouth.x + 60, .3); Wd.setSeason('autumn'); p.flags.autumnNow = true; Wd.startAutumn(p); p.face = -1; place(p.x); G.tod = .5; }
    else if (st === 'den') { toSnake(2, L.mouth.x, .3); Wd.setSeason('autumn'); p.flags.autumnNow = true; p.flags.denGate = true; p.enterDen(); p.s = L.pathLen * +(params.get('s') || .55); for (let k = 0; k < 40; k++) { p.input.y = 1; p.updateDen(.02); } p.input.y = 0; Wd.denCrowd = 5; }
    else if (st === 'winter') { toSnake(2, L.mouth.x, .3); p.flags.autumnNow = true; p.flags.denGate = true; p.enterDen(); p.s = L.pathLen; p.startWinter(); Wd.setSeason('winter'); Cinematic.stop(); G.tod = .5; }
    else if (st === 'spring') { toSnake(3, L.mouth.x + 40, .1); Wd.setSeason('spring'); Wd.springCrowd(); place(p.x, true); G.tod = .45; }
    else if (st === 'board' || st === 'measured') { toSnake(2, 300, .4); G.tod = .5; const s = Wd.startScientist(p); s.x = s.gx + 50; s.state = 'lay'; s.t = 1.5; if (st === 'measured') { Wd.update(.1, G.tod, p); p.hideUnder(s.board); s.state = 'back'; s.x = s.gx + 50; Wd.update(.05, G.tod, p); } }
    else if (st === 'young') toSnake(3, 700, .4);
    else if (st === 'adult') { toSnake(4, 700, .4); G.tod = .5; }
    else if (st === 'gather' || st === 'race' || st === 'girlout') {
      p.sex = G.sex = st === 'girlout' ? 'girl' : (params.get('sex') || 'boy'); toSnake(4, L.mouth.x + 70, .5); p.stats.winters = 2; p.flags.springOut = true; Wd.setSeason('spring'); Wd.springCrowd(6); G.tod = .45;
      if (st === 'girlout') { Wd.makeBoys(p); p.flags.gathering = true; }
      else { p.flags.gathering = true; if (st === 'race') { const g = Wd.sendGirl(p); for (let k = 0; k < 60; k++) { Wd.update(1 / 30, G.tod, p); Wd.updateRace(1 / 30, p); } p.scentT = 2; } }
    }
    else if (st === 'carry') { p.sex = G.sex = 'girl'; toSnake(4, 500, .6); p.flags.met = p.flags.carrying = true; p.broodT = BROOD_T * .4; p.eggs = .4; G.tod = .5; place(p.x, true); }
    else if (st === 'ready' || st === 'birth') { p.sex = G.sex = 'girl'; toSnake(4, 40, .6); p.flags.met = p.flags.carrying = p.flags.ready = true; p.eggs = 1; G.tod = .45; if (st === 'birth') { p.hideUnder(nearCover('log', 70)); p.startBirth(); p.birth.good = 1; Wd.babyBurst(p.x, 4, p.form); } }
    else if (st === 'litter') { toSnake(4, 600, .6); p.flags.met = true; setTimeout(() => Story.litterLater(), 50); }
    else if (st === 'fireflies') { toSnake(2, 200, .3); G.tod = .95; }
    if (params.has('warm')) p.warm = +params.get('warm');
    if (params.has('food')) p.cfood = +params.get('food');
  }

  /* the gamepad on the title and in the panels */
  function padMenus(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (!G.started) { if (g.actionPressed || g.startPressed) start(false); return; }
    const choice = document.getElementById('choice');
    if (!choice.hidden) { if (g.actionPressed) document.getElementById('btnNextGen').click(); else if (g.eggPressed || g.startPressed) document.getElementById('btnKeep').click(); return; }
    if (g.eggPressed || g.startPressed || g.scopePressed) UI.closeModals();
  }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0, saveWarned = false;
  function simulate(dt) {
    const p = G.player;
    if (settings.clock && p.mode !== 'birth') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    Story.update(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    const upright = H > W * 1.15;
    if (cine) cam.follow(cine.x, cine.y + (upright ? H * .1 / (cine.zoom * uz) : 0), cine.zoom * uz);
    else if (p.stage === 'sac') cam.follow(p.x, p.y - H * .14 / (4 * uz), 4 * uz);
    else if (p.mode === 'winter') { const C = G.world.land.chamber; cam.follow(C.x + 60, C.y - 140, 1.5 * uz); }
    else if (p.mode === 'birth') cam.follow(p.x, p.y - 20, 2.8 * uz);
    else if (p.mode === 'measured') cam.follow(p.x, p.y - 10, 2.6 * uz);
    else {
      const z = clamp(360 / (p.len + 20), 1.6, 4.5) * (p.underground ? 1.1 : 1);
      /* a phone held upright: the snake sits in the upper middle, clear of the fact card and the touch pad */
      const lift = upright ? -.1 : p.underground ? 0 : .24;
      cam.follow(p.x + p.face * p.len * .3, p.y - H * lift / (z * uz), z * uz);
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
      /* time-lapse (F), and a fast-forward while the snake just waits: winter, a cold rest, resting with blue eyes */
      const waiting = (p.stage === 'sac' && !p.flags.sacReady) || ['winter', 'chill', 'measured'].includes(p.mode) || (p.shed === 'blue' && p.mode === 'hide');
      G.warp = p.mode === 'birth' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, (x) => G.world.topAt(x));
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug') || params.has('debughud')) document.title = `m=${modal ? 1 : 0} st=${G.started ? 1 : 0} ts=${Cinematic.timeScale.toFixed(2)} w=${G.warp} fps=${Render.getFps().toFixed(0)} npc=${G.world.npcs.length} t=${G.time.toFixed(1)} ${p.stage}/${p.mode} i${p.instar} food=${p.cfood.toFixed(0)} belly=${p.belly.toFixed(1)} warm=${p.warm.toFixed(2)} shed=${p.shed} p=${p.x.toFixed(0)},${p.y.toFixed(0)} npc=${G.world.npcs.length} fps=${Render.getFps().toFixed(0)}${typeof GFX !== 'undefined' && GFX.active() ? ` gl=${GFX.stats().ms.toFixed(1)}ms up=${GFX.stats().upload.toFixed(1)}ms` : ''}`;
    if (G.started) UI.update(rawDt);
    if (params.has('debughud')) document.getElementById('hintText').textContent = document.title;
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world;
    AudioFX.update(dt, { night: G.night, season: Wd.season, inside: p.underground, rain: Wd.weather.rain, wind: Wd.weather.gust, pond: clamp(1 - Math.abs(G.cam.x - (WORLD.pondL + WORLD.pondR) / 2) / 700, 0, 1), moving: p.moving && p.mode === 'crawl' });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: garter snakes basking on warm rocks in a summer meadow ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const tFlowers = Array.from({ length: 60 }, () => ({ x: Math.random(), h: 20 + Math.random() * 40, col: pick(['#f2d043', '#ffffff', '#c86ad8', '#f08a3a', '#7ab0f0']), ph: Math.random() * TAU }));
  const tFlies = Array.from({ length: 6 }, () => ({ x: Math.random(), y: .3 + Math.random() * .3, ph: Math.random() * TAU, col: pick(['#f0a020', '#ffffff', '#f2d043']), vx: (Math.random() < .5 ? -1 : 1) * (.01 + Math.random() * .01) }));
  const tRocks = [{ x: .16, w: .2, h: .08 }, { x: .7, w: .24, h: .1 }, { x: .45, w: .12, h: .05 }];
  const tSnakes = [
    { rock: 0, form: 'eastern', len: 150, coil: true, face: 1 }, { rock: 1, form: 'redsided', len: 170, coil: true, face: -1, dx: -.05 }, { rock: 1, form: 'eastern', len: 120, coil: true, face: 1, dx: .06 },
    { crawl: true, form: 'black', len: 160, x: .3, face: 1, sp: .025 }, { crawl: true, form: 'blue', len: 110, x: .9, face: -1, sp: .03, row: .04 }
  ];
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5aa8e0'); g.addColorStop(.55, '#cfe8f4'); g.addColorStop(.56, '#8ab868'); g.addColorStop(1, '#4a7a30');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    /* the sun */
    const sg = tctx.createRadialGradient(W * .82, H * .14, 10, W * .82, H * .14, 200); sg.addColorStop(0, 'rgba(255,250,220,.95)'); sg.addColorStop(.15, 'rgba(255,230,160,.5)'); sg.addColorStop(1, 'rgba(255,220,140,0)');
    tctx.fillStyle = sg; tctx.fillRect(0, 0, W, H); tctx.fillStyle = '#fffbe6'; tctx.beginPath(); tctx.arc(W * .82, H * .14, 30, 0, TAU); tctx.fill();
    /* far hills and trees */
    tctx.fillStyle = '#8aa0b8'; tctx.beginPath(); tctx.moveTo(0, H * .56); for (let x = 0; x <= W; x += 20) tctx.lineTo(x, H * (.46 + .05 * Math.sin(x * .006 + 1) + .03 * Math.sin(x * .017))); tctx.lineTo(W, H * .56); tctx.fill();
    tctx.fillStyle = '#5a8a4a'; tctx.beginPath(); tctx.moveTo(0, H * .58); for (let x = 0; x <= W; x += 14) tctx.lineTo(x, H * (.52 + .02 * Math.sin(x * .02) - .03 * Math.abs(Math.sin(x * .05)))); tctx.lineTo(W, H * .58); tctx.fill();
    const gy = (u) => H * (.8 + .03 * Math.sin(u * 5));
    tctx.fillStyle = '#6aa04a'; tctx.beginPath(); tctx.moveTo(0, H); for (let x = 0; x <= W; x += 10) tctx.lineTo(x, gy(x / W)); tctx.lineTo(W, H); tctx.fill();
    const k = Math.min(1.6, W / 900);
    /* flowers */
    for (const f of tFlowers) { const x = f.x * W, y = gy(f.x), sx = Math.sin(tt * 1.2 + f.ph) * 3; tctx.strokeStyle = '#4a8a2a'; tctx.lineWidth = 2; tctx.beginPath(); tctx.moveTo(x, y + 4); tctx.quadraticCurveTo(x, y - f.h * k * .5, x + sx, y - f.h * k); tctx.stroke(); tctx.fillStyle = f.col; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; tctx.beginPath(); tctx.arc(x + sx + Math.cos(a) * 4, y - f.h * k + Math.sin(a) * 4, 3.4, 0, TAU); tctx.fill(); } }
    /* warm flat rocks with snakes basking on them */
    for (const r of tRocks) { const x = r.x * W, y = gy(r.x) + 6, w = r.w * W * .5, h = r.h * H; const rg = tctx.createLinearGradient(0, y - h, 0, y); rg.addColorStop(0, '#d8d0bc'); rg.addColorStop(1, '#8a8270'); tctx.fillStyle = rg; tctx.beginPath(); tctx.ellipse(x, y, w, h, 0, Math.PI, TAU); tctx.fill(); }
    for (const s of tSnakes) {
      if (s.coil) {
        const r = tRocks[s.rock], x = (r.x + (s.dx || 0)) * W, y = gy(r.x) + 6 - r.h * H * .85, len = s.len * k * 1.5, th = len * .085;
        if (!s.P || s.k !== W + 'x' + H) { s.P = Trail.coil(len, th, x, y, s.face, 1.7); s.k = W + 'x' + H; s.tongueT = 0; }
        s.tongueT = Math.max(0, (s.tongueT || 0) - dt * 2); if (Math.random() < dt * .4) s.tongueT = 1;
        Sprites.drawSnake(tctx, s.P, { thick: th, form: s.form, tongue: s.tongueT > 0 ? 1 - s.tongueT : 0, shadow: false });
      } else {
        const len = s.len * k * 1.5, th = len * .085;
        s.x += s.sp * s.face * dt; if (s.x > 1.2) s.x = -.2; if (s.x < -.2) s.x = 1.2;
        const y = gy(s.x) + (s.row || 0) * H - th * .2;
        if (!s.tr || s.k !== W + 'x' + H) { s.tr = []; s.d = 0; s.k = W + 'x' + H; Trail.reset(s.tr, s.x * W, y, s.face, len, (xx) => gy(xx / W) + (s.row || 0) * H - th * .2, 0); }
        s.d += s.sp * W * dt;
        if (Math.abs(s.tr[0].x - s.x * W) > 200) { Trail.reset(s.tr, s.x * W, y, s.face, len, (xx) => gy(xx / W) + (s.row || 0) * H - th * .2, 0); }
        Trail.push(s.tr, s.x * W, y, len, 3, Trail.wave(s.d, len) * 1.6);
        s.tongueT = Math.max(0, (s.tongueT || 0) - dt * 2); if (Math.random() < dt * .5) s.tongueT = 1;
        Sprites.drawSnake(tctx, Trail.sample(s.tr, len, 40), { thick: th, form: s.form, tongue: s.tongueT > 0 ? 1 - s.tongueT : 0, headUp: .15 });
      }
    }
    /* grass in front, and butterflies */
    tctx.strokeStyle = '#5a9a3a'; tctx.lineWidth = 2;
    for (let x = 0; x < W; x += 7) { const y = H * .985, h = 14 + 10 * Math.sin(x * .3); tctx.beginPath(); tctx.moveTo(x, H); tctx.quadraticCurveTo(x, y - h * .5, x + Math.sin(tt + x * .05) * 3, y - h); tctx.stroke(); }
    for (const b of tFlies) { b.x += b.vx * dt; if (b.x > 1.1) b.x = -.1; if (b.x < -.1) b.x = 1.1; const bf = { x: b.x * W, y: H * b.y + Math.sin(tt * 2 + b.ph) * 20, ph: b.ph, col: b.col }; tctx.save(); tctx.translate(bf.x, bf.y); tctx.scale(2, 2); tctx.translate(-bf.x, -bf.y); Sprites.drawButterfly(tctx, bf, tt); tctx.restore(); }
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
  if (params.has('season') && SEASON_INFO[params.get('season')]) G.world.setSeason(params.get('season'));
  applyDebug();
  if (params.has('tod')) G.tod = +params.get('tod');
  if (params.has('moon')) G.moon = +params.get('moon');
  if (params.has('zoom')) G.userZoom = +params.get('zoom');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  /* ?resume=1: press "Continue" (tests the saved game) */
  if (params.has('resume') && SaveGame.exists()) { document.getElementById('title').style.transition = 'none'; start(true); }
  else if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); if (params.has('stage')) setTimeout(() => { Cinematic.stop(); UI.hint(resumeHint()); }, 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'shed' }); UI.openJournal(); }
      else if (o === 'scope') { Microscope.open(G, params.get('subject') || 'boy'); if (params.has('cut')) document.getElementById('scopeCut').click(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'snake', 'go', 'up', 'little', 'big', 'hide', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.flick = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  /* ?sim=<seconds>: run the game forward before the first frame (headless screenshots draw only a few frames) */
  if (params.has('sim')) setTimeout(() => { const n = Math.min(3600, Math.round(+params.get('sim') * 30)); for (let k = 0; k < n; k++) { Cinematic.update(1 / 30); simulate(1 / 30 * Cinematic.timeScale); G.particles.update(1 / 30, (x) => G.world.topAt(x)); } camera(1); G.cam.snap(); if (params.has('savenow')) SaveGame.write(G); }, 120);
  requestAnimationFrame(loop);
})();
