/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'girl', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('widow.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('widow.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, yard: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .36, day: 1, generation: 1, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.yard = new Yard(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  function newGame(newSeed) {
    G.form = settings.form;
    G.fast = false;
    makeWorld(newSeed);
    G.players = [new Spider(G, G.form)];
    G.tod = .36; G.day = 1; G.time = 0;
    Story.bind(G); Story.reset();
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 3;
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
    if (K === 'c') UI.openCards();
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
  document.getElementById('btnFly').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.eggPressed = true; });

  /* tap a place to walk there; in the little games a tap is the action */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    if (['sac', 'wrap', 'pluck', 'spin', 'curl'].includes(p.mode)) { p.input.actionPressed = true; if (p.mode === 'curl') p.input.x = 1; return; }
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
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; UI.buildWheel(); } else UI.hint(settings.reading === 'simple' ? 'Your next spider will be a ' + FORMS[k].short.toLowerCase() + '!' : `Your next generation will be a ${FORMS[k].name}. This spider stays as it is.`); UI.refreshForms(); },
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
  Cards.init(UI.onCard);
  Stickers.init(UI.onSticker);
  Journal.init(G);
  Voice.init(); Grownups.guardOutboundLinks(); Voice.setEnabled(settings.voice);
  Reading.init(G, { saveSettings });

  function start(resume) {
    if (G.started) return;
    leaveTitle();
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Spider(G, G.form); b.restore(po); G.players = [b]; });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Story.bind(G); Story.reset(); Stickers.setGeneration(G.generation); UI.buildWheel(); Story.afterRestore(); }
    }
    G.cam.x = G.player.x; G.cam.y = G.player.y;
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else {
      Voice.say('Welcome back!', { force: true }); const p = G.player, fl = p.flags;
      UI.hint(p.stage === 'sac' ? 'sac' : !fl.landed ? (p.mode === 'balloon' ? 'balloon' : 'climb') : !fl.settled ? 'landed' : G.yard.guide() ? 'build1' : p.male && p.stage === 'adult' ? (fl.leave ? 'walkaway' : 'gofind') : fl.guard && !fl.hatchedOut ? 'guard' : fl.spinNow && !fl.sac ? 'spinsac' : 'wait');
    }
  }

  /* ---------- the director's hooks ---------- */
  const P = () => G.player;
  Story.init(G, {
    hint: (k) => UI.hint(k),
    fact: (k) => Bus.emit('fact', k),
    cine: (o) => Cinematic.play(o),
    done: () => { const open = () => { if (Reading.busy() || Cinematic.active) setTimeout(open, 800); else UI.choice(); }; setTimeout(open, 3000); UI.refreshToggles(); }
  });
  /* a few words as you start */
  Bus.on('started', () => { if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a tiny spider, in a silk egg sac.' : 'You are a black widow spiderling, in a silk egg sac under the porch roof. Climb, sail away on the wind, and build a web of your own.'); });
  let humClock = 0;
  Bus.on('pulse', (kind) => { if (G.started && G.time > humClock) { humClock = G.time + (kind === 'bug' ? .18 : .5); AudioFX.hum(kind); } });
  Bus.on('peopleSay', (t) => { if (!Reading.on()) Voice.say(t, { interrupt: false }); });

  /* ---------- debug jumps (?stage=…) ---------- */
  function dbgHome(key, instar) {
    const p = G.player, Y = G.yard, N = Y.net, h = Y.site(key) || Y.site('pots');
    p.stage = 'ling'; p.mode = 'walk'; p.flags.sacReady = p.flags.hatching = p.flags.landed = p.flags.settled = true; p.flags.home = h.key; Y.home = h;
    for (const [a, b] of h.guide) { N.addThread(a[0], a[1], b[0], b[1], { force: true }); p.stats.threads++; }
    const low = Y.own()[1]; for (const u of [.35, .65]) { const q = low.at(low.len * u); if (N.addThread(q.x, q.y, q.x, 0)) { p.stats.threads++; p.stats.gum++; } }
    for (const t of Y.own()) t.born = 1;
    p.instar = clamp(instar, 0, p.last); p.stage = p.instar >= p.last ? 'adult' : p.instar ? 'young' : 'ling';
    for (let k = 0; k < p.instar; k++) p.flags['tight' + k] = p.flags['molt' + k] = true;
    const q = N.locate(h.retreat[0], h.retreat[1]); p.setOn(q.line, q.s); G.tod = .92; Story.once.gum = Story.once.webup = Story.once.silkgo = Story.once.hang = true;
  }
  function applyDebug() {
    /* the debug jumps skip Read to Play's gates (they call the life-cycle steps directly) */
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'); if (!st) return;
    const p = G.player, Y = G.yard, N = Y.net, site = params.get('site') || 'pots', inst = params.has('instar') ? +params.get('instar') : null;
    const onThread = (u = .5) => { const T = Y.own()[0]; p.setOn(T, T.len * u); return T; };
    if (st === 'hatch') { p.sacT = 5; p.flags.sacReady = true; p.crack = .6; return; }
    if (st === 'climb' || st === 'roof' || st === 'balloon') {
      p.flags.sacReady = p.flags.hatching = true; p.hatch();
      if (st !== 'climb') { const L = N.objects.find(o => o.key === 'porch'); p.setOn(L, L.nearest(WORLD.launchX, WORLD.launchY).s); }
      if (st === 'balloon') { p.launch(); p.bal.t = 2; p.x = +(params.get('x') || 700); p.y = -360; }
      return;
    }
    if (st === 'land') { p.flags.sacReady = p.flags.hatching = true; p.stage = 'ling'; p.mode = 'walk'; const h = Y.site(site); p.setOn(N.ground, h.x - WORLD.left + 120); p.flags.landed = true; Bus.emit('landed', p); return; }
    dbgHome(site, inst !== null ? inst : { den: 0, young: 2, dark: 4, prey: 1, wrap: 2, molt: 1, tight: 1, leaf: 2, hang: 2, curl: 2 }[st] !== undefined ? { den: 0, young: 2, dark: 4, prey: 1, wrap: 2, molt: 1, tight: 1, leaf: 2, hang: 2, curl: 2 }[st] : p.last);
    if (st === 'den') { for (const t of Y.own().slice()) N.removeThreads(q => q === t); p.stats.threads = p.stats.gum = 0; Bus.emit('settled', p); return; }
    if (st === 'prey' || st === 'wrap' || st === 'leaf') {
      const b = Y.spawnPrey(st === 'leaf' ? 'leaf' : params.get('kind') || 'moth', { near: true }); b.x = b.tx; b.y = b.ty; b.state = 'stuck'; b.struggle = 999;
      if (st !== 'prey') p.setOn(b.T, b.s + 18); else if (params.has('onweb')) onThread(+params.get('onweb') || .7);
      if (st === 'wrap') { b.flings = 9; b.state = 'held'; p.mode = 'wrap'; p.wrap = { b, n: 2, need: 6, t: 0, flash: 0 }; b.wraps = .33; }
    }
    if (st === 'tight' || st === 'molt') { p.food = p.need; onThread(.4); if (st === 'molt') { p.tight = 1; p.startMolt(); p.molting = +(params.get('mt') || 1.3); } }
    if (st === 'hang') { onThread(.5); p.tryDrop(); p.rope.L = 34; p.rope.th = .4; }
    if (st === 'curl') { p.setOn(N.ground, Y.home.x - WORLD.left); p.curl(false); }
    if (st === 'show') { onThread(.5); p.mode = 'show'; p.showT = -99; }
    if (['dauber', 'lizard', 'bird', 'mantis', 'broom'].includes(st)) { onThread(.5); const v = Y.startVisitor(st); if (st !== 'broom') { v.x = p.x + v.side * (v.fly ? 46 : 70); v.y = v.fly ? p.y - 34 : 0; v.state = 'look'; v.patience = 999; } else v.x = v.x1 + 60; }
    if (st === 'people') { onThread(.5); const Q = Y.startPeople(); Q.x = Q.wx; Q.state = 'look'; Q.t = +(params.get('pt') || 0); }
    if (st === 'suitor') { const m = Y.sendSuitor(); m.state = 'pluck'; m.s = 24 * (m.up > 0 ? 1 : -1) + (m.up > 0 ? 0 : m.T.len); const q = m.T.at(m.s); m.x = q.x; m.y = q.y; }
    if (st === 'spin') { p.flags.met = p.flags.spinNow = true; p.mode = 'spin'; p.sp = { n: +(params.get('n') || 5), need: 12, want: 1, t: 0 }; }
    if (st === 'guard' || st === 'babies') { p.flags.met = p.flags.sac = p.flags.guard = true; Y.sac = { x: Y.home.retreat[0] + (Y.home.retreat[0] < Y.home.x ? 12 : -12), y: Y.home.retreat[1] + 16, t: 0 }; if (st === 'babies') { Y.startBabies(Y.sac.x, Y.sac.y); for (const b of Y.babies) b.t = 6; } }
    if (st === 'her' || st === 'pluck' || st === 'journey') {
      p.flags.noHunt = true; const k = (Y.sites.indexOf(Y.home) + 2) % 4; p.flags.herSite = Y.sites[k].key; Y.makeHer(p.flags.herSite);
      if (st !== 'journey') { const g = N.threads.find(t => t.hers && t.gum); p.setOn(g, g.a.line === N.ground ? 26 : g.len - 26); }
      if (st === 'pluck') { p.mode = 'pluck'; p.pl = { t: .75, good: 1, bad: 0, flash: 0 }; p.flags.pluckStep = 1; }
    }
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
    G.time += dt;
    G.yard.update(dt);
    p.update(dt);
    Story.update(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, m = p.mode, Y = G.yard;
    const fit = (z) => Math.min(z, Math.max(1.1, W / 250), Math.max(1.1, H / 190)) * G.userZoom;
    if (!G.started) { const z = clamp(W / 560, 1.5, 3), wide = W > 1100; cam.follow(1128 + (wide ? W * .3 / z : 0), wide ? -214 : -160, z); }
    else if (cine) cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (p.stage === 'sac') cam.follow(p.x - 20, p.y + 20, fit(3.2));
    else if (m === 'balloon') { const z = Math.min(1.1, H / 640) * G.userZoom; cam.follow(p.x - 110, -272, z); }
    else if (m === 'hang') cam.follow(p.x, p.y + 20, fit(clamp(3.3 - p.r * .15, 1.7, 2.9)));
    else {
      /* at home the camera leans toward the web, so a hum is on the screen */
      const h = Y.home, z = clamp(3.3 - p.r * .15, 1.7, 2.9), hgt = h ? -h.retreat[1] : 0, near = h && p.flags.settled && Math.abs(p.x - h.x) < 260 && !(p.male && p.stage === 'adult');
      /* the top bar and the sticker toast cover the top 200 px or so: at home, frame the web below them, so the den is never hidden */
      const top = near ? Math.min(200, H * .3) : 0, zz = fit(near ? Math.min(z, 2.3, W / (h.x1 - h.x0 + 170), (H - top) / (hgt + 120)) : z);
      cam.follow(near ? lerp(p.x, h.x, .5) : p.x + p.face * (m === 'walk' && p.onGround() ? 30 : 0), (near ? lerp(p.y, -hgt / 2, .6) : p.y) - 8 - top / (2 * zz), zz);
    }
    cam.update(rawDt, Y.bounds);
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
      /* time-lapse (F); the little games of timing always run at their own speed */
      const timed = ['wrap', 'pluck', 'spin', 'balloon', 'hang', 'molt'].includes(p.mode) || G.yard.people;
      G.warp = timed ? 1 : G.fast ? 3 : p.stage === 'sac' && !p.flags.sacReady ? 2 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.yard.update(rawDt); }
    G.particles.update(dt, () => 0);
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} night ${G.day} tod ${G.tod.toFixed(2)} ${p.stage}/${p.mode} i${p.instar} food=${p.food}/${p.need} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    AudioFX.update(dt, G.night, false, 0, G.yard.weather.gust, false);
    drawTitle(rawDt);
  }

  /* ---------- the title: the porch at night: your mother in her web under the roof, the egg sac, moths at the
     light.  The real scene, copied into the title's canvas in either look. ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let titleScene = false;
  function setTitleScene() { G.tod = .95; titleScene = true; }
  function leaveTitle() { if (!titleScene) return; titleScene = false; G.tod = .36; G.time = 0; }
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof GFX !== 'undefined' && GFX.active()) tctx.drawImage(GFX.canvas(), 0, 0, tc.width, tc.height);
    else tctx.drawImage(canvas, 0, 0, tc.width, tc.height);
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
  if (params.has('diff') && DIFFICULTY[params.get('diff')]) settings.difficulty = params.get('diff');
  newGame(seed);
  if (!params.has('notitle') && !params.has('stage')) setTitleScene();
  if (params.has('labels')) settings.labels = true;
  if (params.has('pad')) settings.pad = true;
  if (['simple', 'normal'].includes(params.get('read'))) settings.reading = params.get('read');
  if (['auto', 'high', 'low'].includes(params.get('quality'))) settings.quality = params.get('quality');
  if (params.has('readlevel') && READ_LEVELS.includes(params.get('readlevel').toUpperCase())) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  if (params.has('science')) settings.science = true;
  applyDebug();
  if (params.has('tod')) G.tod = +params.get('tod');
  if (params.has('gen')) G.generation = +params.get('gen');
  if (params.has('zoom')) G.userZoom = +params.get('zoom');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); const p = G.player; if (params.has('stage')) setTimeout(() => UI.hint(p.mode === 'wrap' ? 'wrap' : p.mode === 'pluck' ? 'pluck' : p.mode === 'spin' ? 'spin' : p.mode === 'balloon' ? 'balloon' : p.mode === 'hang' ? 'hang' : 'wait'), 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'young1' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'female');
      else if (o === 'cards') { for (const k of Cards.list()) Cards.give(k); UI.closeToast && UI.closeToast(); UI.openCards(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'spider', 'go', 'up', 'little', 'big', 'web', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.silk = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
