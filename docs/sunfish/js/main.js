/* ============================================================
   main.js — the game loop, input, glue (the story lives in story.js)
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'normal', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('sunfish.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('sunfish.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

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
    G.players = [new Sunfish(G, G.form, G.sex)];
    Story.reset();
    Story.makeMum();
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 6;
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
    if (K === 'o' && typeof GFX !== 'undefined' && GFX.canvas()) UI.hint(GFX.toggle() ? 'Painted look on' : 'Classic look');
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

  /* tap the sea to swim there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* while letting the eggs go, or as an egg, a tap is the button */
    if (p.mode === 'release' || p.stage === 'egg') { p.input.actionPressed = true; return; }
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next sunfish will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This sunfish stays as it is.`);
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; if (G.world.mum) G.world.mum.form = k; UI.buildWheel(); } else nextNote(); UI.refreshForms(); },
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

  /* the director: shared with smoke.js; it only ever talks to the page through these hooks */
  function openChoice() { const open = () => { if (Reading.busy() || Cinematic.active) setTimeout(open, 800); else UI.choice(); }; setTimeout(open, 2500); UI.refreshToggles(); }
  Story.init(G, { hint: (k) => UI.hint(k), fact: (k) => Bus.emit('fact', k), cine: (o) => Cinematic.play(o), done: openChoice, lifeDone: (f, s) => Stickers.lifeDone(f, s) });
  Bus.on('mola', () => Stickers.lifeDone(G.form, G.sex));
  Bus.on('started', () => { if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a tiny sunfish egg in the warm sea.' : 'You are one of millions of tiny sunfish eggs, drifting in the warm open ocean.', { force: true }); });

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Sunfish(G, G.form, G.sex); G.players = [b]; b.restore(po); });
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
    if (p.stage === 'egg') return 'egg';
    if (p.stage === 'larva') return p.zinstar > 1 ? 'star' : 'swim';
    if (p.stage === 'juvenile') return 'friends';
    if (p.flags.met) return p.sex === 'boy' ? 'cloud' : 'release';
    if (p.flags.arrived) return p.sex === 'boy' ? 'findgirl' : 'findboy';
    if (p.flags.journey) return 'journey';
    if (p.itch > .6) return p.flags.cleaned && p.size >= 3 ? 'breach' : 'itchy';
    if (p.warm < .35) return 'cold';
    return 'mola';
  }

  /* ---------- debug jumps (?stage=…) ---------- */
  function toLarva(z, frac = .5) { const p = G.player, th = [0, ...G.diff().larva]; p.hatch(); p.zinstar = z; p.food = th[z - 1] + (th[z] - th[z - 1]) * frac; p.x = WORLD.eggX + 300 + z * 200; p.y = 70; G.world.mum = null; G.world.babies.length = 0; Cinematic.stop(); }
  function toJuv(j = 1, frac = .3) { toLarva(3, 1); const p = G.player, th = [0, ...G.diff().juv]; p.stage = 'juvenile'; p.jsize = j; p.food = th[j - 1] + (th[j] - th[j - 1]) * frac; p.x = -2600; p.y = 80; G.world.makeSchool(p); Cinematic.stop(); }
  function toMola(size = 1, x = -600, y = 120, frac = .3) {
    toJuv(2, 1); const p = G.player, Wd = G.world, th = [0, ...G.diff().grow];
    p.stage = 'mola'; p.size = size; p.food = th[size - 1] + (th[size] - th[size - 1]) * frac; p.x = x; p.y = y; p.warm = 1; p.itch = .1; p.mode = 'swim';
    if (size >= 2) p.flags.basked = true; if (size >= 3) p.flags.cleaned = true;
    Wd.juvs = []; Wd.schoolC = null; G.tod = .45; Cinematic.stop();
  }
  function applyDebug() { const rm = settings.readMode; settings.readMode = 'listen'; try { applyDebugInner(); } finally { settings.readMode = rm; } }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world, frac = +(params.get('frac') || .5);
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'storm') { wx.storm = 1; wx.cloud = 1; } }
    if (!st) return;
    const p = G.player, near = (k, dx, dy) => { const f = Wd.spawnFood(k, p.x + p.face * dx, p.y + dy); f.u = .5; return f; };
    if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; }
    else if (/^larva[123]$/.test(st)) toLarva(+st[5], frac);
    else if (st === 'star') toLarva(2, frac);
    else if (st === 'anchovy') { toLarva(2, .5); Wd.startSchool(p); Wd.school.x = p.x - Wd.school.dir * 140; }
    else if (st === 'comb') { toLarva(2, .5); const j = Wd.makeComb(p.x + 20, p.y - 4); j.r = 14; Wd.combs.push(j); }
    else if (st === 'gull') { toLarva(1, .5); p.y = 12; Wd.dip(p); }
    else if (st === 'juvenile' || st === 'school') toJuv(st === 'school' ? 2 : 1, frac);
    else if (st === 'dorado' || st === 'tuna') { toJuv(2, .4); Wd.startVisitor(st, p); Wd.visitors[0].x = p.x - Wd.visitors[0].dir * 160; }
    else if (st === 'mola') toMola(1, -600, 90, frac);
    else if (st === 'dive' || st === 'eat') { toMola(1, -500, 460, .4); p.face = 1; G.tod = .5; for (let k = 0; k < 4; k++) near(pick(['moon', 'nettle', 'salp', 'comb']), 70 + k * 60, (k - 1.5) * 40); if (st === 'eat') { Wd.food.length = 0; near('moon', p.len * .55, 0); } }
    else if (st === 'cold') { toMola(2, -500, 640, .4); p.warm = .2; }
    else if (st === 'bask' || st === 'gulls') { toMola(2, -300, 30, .4); p.warm = .5; p.startBask(); p.roll = 1; p.y = Wd.seaLevel() + p.len * .1; if (st === 'gulls') { Wd.landGull(p); Wd.gull.state = 'peck'; Wd.gull.t = 0; } }
    else if (st === 'itchy') { toMola(2, 1200, 120, .6); p.itch = .8; }
    else if (st === 'station' || st === 'clean') { toMola(2, WORLD.stationX - 140, Wd.station.floor - 100, .6); p.itch = .8; if (st === 'clean') { p.x = WORLD.stationX; p.startClean(); p.cleanT = 2; } }
    else if (['sealion', 'orca', 'shark', 'turtle'].includes(st)) { toMola(2, st === 'sealion' ? 1600 : -800, st === 'sealion' ? 90 : 200, .4); Wd.startVisitor(st, p); const v = Wd.visitors[0]; v.x = p.x - v.dir * (st === 'orca' ? 420 : 260); v.y = p.y + (st === 'orca' ? -30 : 0); }
    else if (st === 'boat') { toMola(2, -400, 40, .4); Wd.startBoat(p); Wd.boat.x = p.x - Wd.boat.dir * 260; }
    else if (st === 'net') { toMola(2, -400, 60, .4); Wd.startNet(p); Wd.net.x = p.x + 40; Wd.net.state = 'haul'; Wd.net.t = 1.5; Wd.net.holding = true; p.netted(Wd.net); }
    else if (st === 'giant') toMola(3, -400, 200, frac);
    else if (st === 'breach') { toMola(3, -400, 20, .6); p.flags.cleaned = true; p.startBreach(); p.y = Wd.seaLevel() - 30; p.vy = -60; }
    else if (st === 'journey') { toMola(3, -1200, 120, 1); p.flags.breached = true; Story.startJourney(); }
    else if (st === 'warmsea' || st === 'meet' || st === 'release' || st === 'larvae') {
      toMola(3, WORLD.warmR - 500, 130, 1); p.flags.breached = p.flags.ready = true; Story.startJourney(); Cinematic.stop(); p.flags.arrived = true;
      const m = Wd.mates.find(o => o.heart); m.x = m.hx = p.x - p.face * p.len * 1.3; m.y = m.hy = p.y;
      if (st !== 'warmsea' && st !== 'meet') { m.met = m.with = true; p.flags.met = true; }
      if (st === 'release') { p.sex = G.sex = 'girl'; p.startRelease(); G.tod = .5; }
      if (st === 'larvae') { p.sex = G.sex = 'boy'; p.flags.clouded = true; Story.later(.2, Story.boyEnding); }
    }
    if (params.has('warm')) p.warm = +params.get('warm');
    if (params.has('itch')) p.itch = +params.get('itch');
    if (params.has('food')) p.food = +params.get('food');
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
    /* as a baby the days go by faster: the little ones spend weeks out there */
    if (settings.clock && p.mode !== 'release') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (p.stage === 'larva' || p.stage === 'juvenile' ? 2 : 1)) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    Story.update(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.stage === 'egg') cam.follow(p.x + 30, p.y + 10, 4 * uz);
    else if (p.mode === 'bask') cam.follow(p.x, p.y - p.len * .2, clamp(220 / (p.len + 20), 1.2, 6) * uz);
    else if (p.mode === 'release' || p.mode === 'net') cam.follow(p.x, p.y - 20, clamp(120 / (p.len + 20), .9, 6) * uz);
    else { const z = p.stage === 'mola' ? clamp(170 / (p.len + 20), 1.1, 8) : clamp(150 / (p.len + 8), 4, 11); cam.follow(p.x + p.face * p.len * .3 + p.vx * .3, p.y + p.vy * .2, z * uz); }
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
      /* time-lapse (F), and a fast-forward while the egg just waits */
      const waiting = p.stage === 'egg' && !p.flags.eggReady;
      G.warp = p.mode === 'release' ? 1 : waiting || G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, () => 1e9);
    camera(rawDt);
    /* behind the title, with the painted look: the warm sea by day, the mother sunfish beside the card */
    if (!G.started && typeof GFX !== 'undefined' && GFX.active()) {
      const c0 = { x: G.cam.x, y: G.cam.y, zoom: G.cam.zoom }, tod0 = G.tod, n0 = G.night;
      Object.assign(G.cam, { x: WORLD.eggX + 140 + .3 * W / 1.5, y: 70, zoom: 1.5 }); G.tod = .45;
      Render.frame(G, dt);
      Object.assign(G.cam, c0); G.tod = tod0; G.night = n0;
    } else Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} z${p.zinstar} j${p.jsize} s${p.size} food=${p.food.toFixed(0)} warm=${p.warm.toFixed(2)} itch=${p.itch.toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, lvl = Wd.seaLevel();
    AudioFX.update(dt, { night: G.night, surface: clamp(1 - (G.cam.y - lvl) / 260, 0, 1), inside: false, storm: Wd.weather.storm, wind: Wd.weather.gust, swash: Wd.swash(), boat: Wd.boat.state !== 'away' ? clamp(1 - Math.abs(Wd.boat.x - G.cam.x) / 700, 0, 1) : 0, deep: clamp((G.cam.y - 300) / 400, 0, 1) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop (classic look): sunfish in a sunny sea, one basking with a gull ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const swimmers = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: .3 + Math.random() * .55, s: .5 + Math.random() * .7, sp: .01 + Math.random() * .012, ph: Math.random() * TAU, form: FORM_KEYS[i % FORM_KEYS.length], dir: i % 2 ? -1 : 1 }));
  swimmers.sort((a, b) => a.s - b.s);
  const tJellies = Array.from({ length: 14 }, () => ({ x: Math.random(), y: .35 + Math.random() * .6, r: 8 + Math.random() * 10, ph: Math.random() * TAU }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    if (typeof GFX !== 'undefined' && GFX.active()) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.drawImage(GFX.canvas(), 0, 0, tc.width, tc.height); return; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = tctx.createLinearGradient(0, 0, 0, H * .14); sky.addColorStop(0, '#5ab4ea'); sky.addColorStop(1, '#c8ecf4'); tctx.fillStyle = sky; tctx.fillRect(0, 0, W, H * .14);
    const g = tctx.createLinearGradient(0, H * .14, 0, H); g.addColorStop(0, '#3aa8dc'); g.addColorStop(.35, '#1a72b8'); g.addColorStop(.8, '#0a3a74'); g.addColorStop(1, '#041a3a');
    tctx.fillStyle = g; tctx.fillRect(0, H * .14, W, H * .86);
    tctx.fillStyle = 'rgba(255,255,255,.55)'; tctx.beginPath(); tctx.moveTo(0, H * .14); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, H * .14 + Math.sin(x * .02 + tt * 1.5) * 3); tctx.lineTo(W, H * .14 + 6); tctx.lineTo(0, H * .14 + 6); tctx.fill();
    tctx.save(); tctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) { const bx = (k / 9 + Math.sin(tt * .1 + k) * .02) * W; const lg = tctx.createLinearGradient(0, H * .14, 0, H * .9); lg.addColorStop(0, 'rgba(210,245,255,.18)'); lg.addColorStop(1, 'rgba(210,245,255,0)'); tctx.fillStyle = lg; tctx.beginPath(); tctx.moveTo(bx, H * .14); tctx.lineTo(bx + 40, H * .14); tctx.lineTo(bx + 200, H * .9); tctx.lineTo(bx + 110, H * .9); tctx.closePath(); tctx.fill(); }
    tctx.restore();
    for (const j of tJellies) { j.y -= dt * .004; if (j.y < .2) j.y = 1; tctx.save(); tctx.translate(j.x * W + Math.sin(tt * .3 + j.ph) * 10, j.y * H); tctx.globalAlpha = .7; Sprites.drawMoonJelly(tctx, j.r, tt, j.ph); tctx.restore(); }
    /* a sunfish basking at the top with a gull on it */
    const bx = W * .82, by = H * .14 + 6, bs = Math.min(1.3, W / 1000);
    tctx.save(); tctx.translate(bx, by); Sprites.drawSunfish(tctx, { s: bs, form: 'normal', stage: 'mola', flap: Math.sin(tt) * .3, roll: 1, spots: .2, seed: 3 }); tctx.restore();
    tctx.save(); tctx.translate(bx - 6 * bs, by - 4); Sprites.drawGullStand(tctx, { s: bs * .8, ph: tt * 2 }); tctx.restore();
    for (const f of swimmers) {
      f.x += f.sp * f.dir * dt; f.ph += dt * 2.4; if (f.x < -.2) f.x = 1.2; if (f.x > 1.2) f.x = -.2;
      tctx.save(); tctx.translate(f.x * W, f.y * H + Math.sin(tt * .5 + f.ph) * 8); tctx.scale(f.dir, 1);
      Sprites.drawSunfish(tctx, { s: f.s * Math.min(1.4, W / 900), form: f.form, stage: 'mola', flap: f.ph, seed: 5 }); tctx.restore();
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
  if (params.has('season') && SEASON_INFO[params.get('season')]) G.world.season = params.get('season');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); if (params.has('stage')) setTimeout(() => UI.hint(resumeHint()), 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'larva' }); UI.openJournal(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'sunfish', 'go', 'up', 'little', 'big', 'dive', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.flap = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
