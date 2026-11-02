/* ============================================================
   main.js — the game loop, input, the story's director, glue
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
    const raw = JSON.parse(localStorage.getItem('starfish.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('starfish.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .9, day: 1, generation: 1, moon: .5, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
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
  /* a spring day at high tide: the mother stands tall on the mussel bed and lets her eggs go */
  function newGame(newSeed) {
    G.form = settings.form; G.sex = settings.sex;
    G.fast = false;
    makeWorld(newSeed);
    G.tod = .5; G.moon = .5; G.year = 0;
    G.players = [new Starfish(G, G.form, G.sex)];
    Story.reset(); Story.makeMum();
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

  /* tap the sea or the floor to go there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* while letting the eggs go, or as an egg, a tap is the button */
    if (p.mode === 'arch' || p.stage === 'egg') { p.input.actionPressed = true; return; }
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next sea star will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This sea star stays as it is.`);
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

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Starfish(G, G.form, G.sex); G.players = [b]; b.restore(po); });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Stickers.setGeneration(G.generation); UI.buildWheel(); Story.reset(); Story.afterRestore(); }
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
    if (p.stage === 'larva') return 'swim';
    if (p.stage === 'postlarva') return 'postlarva';
    if (p.mode === 'rest') return 'resting';
    if (p.flags.spring) return p.flags.met ? (p.sex === 'girl' ? 'arch' : 'cloud') : (p.sex === 'boy' ? 'findgirl' : 'findboy');
    if (p.flags.storm) return 'winter';
    if (p.full) return 'full';
    if (p.instar === 1) return 'juvenile';
    if (p.instar >= 4) return 'adult';
    return 'young';
  }

  /* ---------- the story's hooks, and the events only the browser needs ---------- */
  const P = () => G.player;
  const later = (ms, fn) => { const W0 = G.world; setTimeout(() => { if (G.world === W0) fn(); }, ms); };
  Story.init(G, {
    hint: (k) => UI.hint(k),
    fact: (k) => Bus.emit('fact', k),
    cine: (o) => Cinematic.play(o),
    done: () => { UI.refreshToggles(); const open = () => { if (Reading.busy() || Cinematic.active) later(800, open); else UI.choice(); }; later(2500, open); }
  });
  Bus.on('started', () => { if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a sea star egg, drifting in the sea.' : 'You are one of millions of sea star eggs, drifting out on a spring evening tide.', { force: true }); });
  Bus.on('settled', () => Stickers.lifeDone(G.form, G.sex));

  /* ---------- debug jumps (?stage=…) ---------- */
  function toLarva(z, frac = .4) { const p = G.player, th = [0, ...G.diff().larva]; p.hatch(); p.zinstar = z; p.food = th[z - 1] + (th[z] - th[z - 1]) * frac; p.x = -600 - z * 300; p.y = G.world.seaLevel() + 80; G.world.mum = null; G.world.babies.length = 0; Cinematic.stop(); for (let k = 1; k < z; k++) p.flags['zm' + k] = true; }
  function toPost(x = -1700, y) { toLarva(3, 1); const p = G.player; p.flags.zm3 = true; p.stage = 'postlarva'; p.x = x; p.y = y === undefined ? G.world.seaLevel() + 100 : y; G.world.drift = 1; }
  function toStar(instar, x, frac = .4) {
    const Wd = G.world, S = Wd.ground;
    toPost(x, 100); const p = G.player, D = G.diff(), th = [0, ...D.grow];
    const sh = Wd.nearestFreePink(x) || Wd.nearestShelter(x, 'pink');
    p.settle(sh); p.instar = instar; p.cfood = instar < 4 ? th[instar - 1] + (th[instar] - th[instar - 1]) * frac : D.grow[2] * (1 + (BONUS - 1) * frac);
    p.cm = starCM(p.instar, p.cfood, D.grow);
    p.x = x; p.y = S.topAt(p.x);
    Cinematic.stop();
  }
  /* the tide: 'high' (tod .52, midday), 'low' (tod .27, the morning low), 'mid' (rising) */
  function setTide(k) { G.tod = k === 'high' ? .52 : k === 'low' ? .27 : .4; }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world;
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'storm') { wx.storm = 1; wx.cloud = 1; } }
    if (st) {
      const p = G.player;
      if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; }
      else if (/^larva[123]$/.test(st)) toLarva(+st[5], +(params.get('frac') || .5));
      else if (st === 'whale') { toLarva(3, .5); Story.once.whale = true; Wd.startWhale(p); Wd.whale.x = p.x - 520; }
      else if (st === 'herring') { toLarva(2, .5); Wd.startSchool(p); Wd.school.x = p.x - 180; }
      else if (st === 'jelly') { toLarva(2, .5); const j = Wd.makeJelly(p.x + 30, p.y - 4); j.r = 16; Wd.jellies.push(j); }
      else if (st === 'gull') { toLarva(1, .5); p.y = Wd.seaLevel() + 14; G.tod = .45; Wd.dip(p); }
      else if (st === 'postlarva') toPost();
      else if (st === 'search') { const sh = Wd.shelters.find(s => s.kind === 'pink' && !s.taken); toPost(sh.x - 40, sh.y - 20); G.tod = .52; }
      else if (st === 'settle' || st === 'juvenile') { toStar(1, WORLD.homeX, .3); }
      else if (st === 'rest') { toStar(1, WORLD.homeX, 1); p.full = true; p.startRest(); p.resting = 4; }
      else if (st === 'young' || st === 'tidein') { toStar(2, 1850, .4); setTide('high'); }
      else if (st === 'tideout' || st === 'dry') { toStar(2, 2250, .4); setTide('low'); if (st === 'dry') p.wet = .25; }
      else if (st === 'curl') { toStar(2, 2250, .4); setTide('low'); p.wet = 0; p.mode = 'curl'; }
      else if (st === 'pool') { toStar(2, Wd.pools[4].x, .4); setTide('low'); }
      else if (st === 'wave') { toStar(2, 1800, .4); setTide('mid'); Wd.startWave(1); Wd.wave.x = p.x - 200; }
      else if (st === 'mussel') { toStar(3, 2000, .4); setTide('high'); const it = Wd.foodNear(p.x, p.y, 80, (o) => o.kind === 'mussel'); if (it) { p.x = it.x - 10; p.y = Wd.ground.topAt(p.x); p.act(); } }
      else if (st === 'gulllow' || st === 'otter' || st === 'crab' || st === 'sunflower') {
        const k = st === 'gulllow' ? 'gull' : st;
        toStar(2, k === 'gull' ? 2300 : k === 'sunflower' ? 700 : 1500, .5); setTide(k === 'gull' ? 'low' : 'high'); G.tod = k === 'gull' ? .28 : .52;
        Wd.startHunter(k, p); const h = Wd.hunters[0]; if (k !== 'gull') h.x = p.x + 160 * (h.x > p.x ? 1 : -1);
      }
      else if (st === 'kid' || st === 'lifted') { toStar(2, Wd.pools[5].x, .5); setTide('low'); Wd.startKid(p); if (st === 'lifted') { Wd.kid.x = p.x + 46; Wd.kid.state = 'lift'; Wd.kid.t = 1; Wd.kid.hand = 1.8; p.lifted(Wd.kid); } else Wd.kid.x = p.x + 120; }
      else if (st === 'adult') { toStar(4, 2100, .3); setTide('high'); }
      else if (st === 'keystone') { toStar(4, 2100, .3); setTide('high'); for (let k = 0; k < 8; k++) { const it = Wd.foodNear(p.x, p.y, 200, (o) => o.kind === 'mussel'); if (it) Wd.eatItem(it); } Story.keystone(); Wd.growLife(5); Cinematic.stop(); }
      else if (st === 'scientist') { toStar(4, 2300, .3); setTide('low'); Wd.startSci(p); Wd.sci.x = p.x + p.w * .7 + 30; Wd.sci.state = 'wait'; }
      else if (st === 'winter' || st === 'armtip') { toStar(4, 1900, .4); setTide('mid'); Story.startWinter(); Cinematic.stop(); if (st === 'armtip') { p.armShort = .9; p.flags.armTipDone = true; } }
      else if (st === 'spring' || st === 'meet') { toStar(4, 2150, .5); p.sex = params.get('sex') === 'girl' ? 'girl' : 'boy'; p.flags.storm = true; Story.startSpring(); Cinematic.stop(); if (st === 'meet') { const m = Wd.mates()[0]; p.x = m.x - m.w * .6 - p.w * .4; p.y = Wd.ground.topAt(p.x); } }
      else if (st === 'arch' || st === 'release') { toStar(4, 2150, .5); p.flags.storm = true; Story.startSpring(); Cinematic.stop(); p.flags.met = true; const m = Wd.mates()[0]; m.met = true; if (p.sex === 'boy') for (const n of Wd.mates()) n.spawning = true; p.startRelease(); }
      else if (st === 'larvae') { toStar(4, 2150, .5); p.sex = 'boy'; p.flags.storm = true; Story.startSpring(); Cinematic.stop(); p.flags.met = true; p.flags.released = true; Story.boyEnding(); }
    }
    if (params.has('wet')) G.player.wet = +params.get('wet');
    if (params.has('food')) G.player.food = +params.get('food');
    if (params.has('tide')) setTide(params.get('tide'));
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
    /* in the plankton the days go by twice as fast: the larvae spend weeks out there */
    if (settings.clock && p.mode !== 'arch') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (p.swimming ? 2 : 1)) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    Story.update(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.stage === 'egg') cam.follow(p.x, p.y - 6, 4.2 * uz);
    else if (p.stage === 'larva') cam.follow(p.x + p.face * 10, p.y, (7.2 - p.zinstar * .4) * uz);
    else if (p.stage === 'postlarva') cam.follow(p.x + p.face * 20, p.y, 4.4 * uz);
    else if (p.mode === 'arch') cam.follow(p.x, p.y - 30, 2.4 * uz);
    else if (p.mode === 'lifted') cam.follow(p.x + 10, p.y, 2.6 * uz);
    else {
      /* a little way ahead, and up a bit so the tide line shows */
      const z = clamp(150 / (p.w + 16), 1.25, 6);
      cam.follow(p.x + p.face * p.w * .6, p.y - p.w * .5 - 20 / z, z * uz);
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
      /* time-lapse (F), and a fast-forward while the star just waits: resting, curled up for a wave */
      const waiting = (p.stage === 'egg' && !p.flags.eggReady) || p.mode === 'rest' || p.mode === 'curl';
      G.warp = p.mode === 'arch' || p.mode === 'lifted' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, (x) => G.world.ground.topAt(x));
    camera(rawDt);
    /* behind the title, with the painted look: the mussel bed at a sunny high tide */
    if (!G.started && typeof GFX !== 'undefined' && GFX.active()) {
      const c0 = { x: G.cam.x, y: G.cam.y, zoom: G.cam.zoom }, tod0 = G.tod, n0 = G.night;
      Object.assign(G.cam, { x: 2050 + .3 * W / 1.6, y: 10, zoom: 1.6 }); G.tod = .52;
      Render.frame(G, dt);
      Object.assign(G.cam, c0); G.tod = tod0; G.night = n0;
    } else Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} i${p.instar} z${p.zinstar} food=${p.food.toFixed(0)}/${p.cfood.toFixed(0)} wet=${p.wet.toFixed(2)} grip=${p.grip.toFixed(2)} sea=${G.world.seaLevel().toFixed(0)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, lvl = Wd.seaLevel();
    AudioFX.update(dt, { night: G.night, surface: clamp(1 - (G.cam.y - lvl) / 260, 0, 1), inside: false, storm: Wd.weather.storm, wind: Wd.weather.gust, swash: Wd.swash(), boat: 0, deep: clamp((G.cam.y - lvl - 200) / 300, 0, 1) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop (classic look): sea stars on the rocks of a tide pool, under a summer sky ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const tStars = FORM_KEYS.concat(['normal', 'normal']).map((f, i) => ({ x: (i + .5) / 7 + (Math.random() - .5) * .05, row: Math.random(), s: .6 + Math.random() * .5, form: f, ph: Math.random() * TAU, rot: Math.random() }));
  const tBits = Array.from({ length: 30 }, () => ({ x: Math.random(), y: .5 + Math.random() * .3, ph: Math.random() * TAU }));
  const tRocks = Array.from({ length: 16 }, () => ({ x: Math.random(), r: 30 + Math.random() * 50, row: Math.random() }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    if (typeof GFX !== 'undefined' && GFX.active()) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.drawImage(GFX.canvas(), 0, 0, tc.width, tc.height); return; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    /* the sky and the sea far off, then a tide pool seen from just above its edge */
    const sky = tctx.createLinearGradient(0, 0, 0, H * .3); sky.addColorStop(0, '#7cc4ec'); sky.addColorStop(1, '#d8eef4');
    tctx.fillStyle = sky; tctx.fillRect(0, 0, W, H * .3);
    tctx.fillStyle = '#3a6a5a'; tctx.beginPath(); tctx.moveTo(W * .62, H * .3); tctx.lineTo(W * .66, H * .17); tctx.lineTo(W * .7, H * .15); tctx.lineTo(W * .73, H * .22); tctx.lineTo(W * .75, H * .3); tctx.fill();
    tctx.fillStyle = '#2a6888'; tctx.fillRect(0, H * .29, W, H * .05);
    tctx.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 6; k++) { const x = ((k / 6 + tt * .02) % 1) * W; tctx.fillRect(x, H * .3 + Math.sin(tt + k) * 2, 40, 2); }
    const pool = tctx.createLinearGradient(0, H * .34, 0, H); pool.addColorStop(0, '#2c8a94'); pool.addColorStop(.5, '#1c6a74'); pool.addColorStop(1, '#0e3a44');
    tctx.fillStyle = pool; tctx.fillRect(0, H * .34, W, H * .66);
    tctx.save(); tctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 14; k++) { const x = (k / 14) * W + Math.sin(tt * .5 + k) * 20, y = H * (.4 + (k % 5) * .1); tctx.strokeStyle = 'rgba(180,255,240,.08)'; tctx.lineWidth = 3; tctx.beginPath(); tctx.ellipse(x, y, 60, 14, Math.sin(k) * .3, 0, TAU); tctx.stroke(); }
    tctx.restore();
    for (const r of tRocks) { const x = r.x * W, y = H * (.62 + r.row * .38), rad = r.r * Math.min(1.4, W / 1100); const g = tctx.createRadialGradient(x - rad * .3, y - rad * .4, 3, x, y, rad * 1.2); g.addColorStop(0, '#6a6a68'); g.addColorStop(1, '#2a2a2c'); tctx.fillStyle = g; tctx.beginPath(); tctx.ellipse(x, y, rad, rad * .7, 0, 0, TAU); tctx.fill(); tctx.fillStyle = 'rgba(230,120,150,.35)'; tctx.beginPath(); tctx.ellipse(x - rad * .2, y - rad * .3, rad * .4, rad * .2, 0, 0, TAU); tctx.fill(); }
    for (const b of tBits) { b.y -= dt * .01; if (b.y < .36) b.y = .9; tctx.fillStyle = `rgba(220,255,250,${.3 + .3 * Math.sin(tt * 3 + b.ph)})`; tctx.beginPath(); tctx.arc((b.x + Math.sin(tt * .4 + b.ph) * .01) * W, b.y * H, 1.8, 0, TAU); tctx.fill(); }
    for (const s of tStars) {
      const x = s.x * W, y = H * (.66 + s.row * .3), sc = s.s * Math.min(1.5, W / 900) * (.8 + s.row * .5);
      tctx.save(); tctx.translate(x, y);
      Sprites.drawStar(tctx, { w: 70 * sc, form: s.form, ph: tt + s.ph, rot: s.rot + Math.sin(tt * .2 + s.ph) * .05, walk: tt * .5 + s.ph, moving: true, face: true });
      tctx.restore();
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'star', 'go', 'up', 'little', 'big', 'sea', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.pool = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
