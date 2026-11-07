/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('stag.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('stag.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, forest: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .5, day: 1, generation: 1, started: false, userZoom: 1, night: 0, fast: false, warp: 1, year: 1, yt: .02, yearsAll: 1, evening: 0, frostSlow: false,
    form: settings.form,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
    let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.forest = new Forest(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  function newGame(newSeed) {
    G.form = settings.form;
    G.fast = false;
    makeWorld(newSeed);
    G.players = [new Beetle(G, G.form)];
    G.tod = .5; G.year = 1; G.yt = .02; G.evening = 0; G.frostSlow = false;
    Story.bind(G); Story.reset();
    /* a later generation hatches in softer wood, by the logs someone left for it */
    if (G.generation > 1) { G.forest.wood.age(3); G.forest.wood.year = 1; G.forest.pile = 6; }
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
    if (K === 'n' && Story.canSkip()) Story.skipYear();
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

  /* tap the wood, the ground or a tree to go there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* in the ring, or biting, or on your back, a tap is the action; green in the ring, a tap hooks */
    if (p.mode === 'ring') { if (p.ring && p.ring.signal() === 'green') p.input.eggPressed = true; else p.input.actionPressed = true; return; }
    if (p.mode === 'bite' || p.mode === 'flipped') { p.input.actionPressed = true; return; }
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
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; UI.buildWheel(); } else UI.hint(settings.reading === 'simple' ? 'Your next beetle will be ' + FORMS[k].short + '!' : `Your next generation will be a ${FORMS[k].name}. This beetle stays as it is.`); UI.refreshForms(); },
    onDiff: (d) => { settings.difficulty = d; saveSettings(); },
    onReading: (r) => { settings.reading = r; saveSettings(); },
    onReadMode: (m) => { settings.readMode = m; if (m === 'play') settings.reading = 'simple'; saveSettings(); },
    onReadLevel: (L) => { if (L === 'auto') settings.readAuto = !settings.readAuto; else { settings.readLevel = L; settings.readMode = 'play'; } saveSettings(); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); },
    onQuality: (q) => { settings.quality = q; saveSettings(); Render.setQuality(q === 'low' ? 'low' : 'high'); },
    onToggle: toggle,
    onTod: (v) => { G.tod = v; },
    onNewGame: () => { UI.resetFacts(); G.generation = 1; G.yearsAll = 1; G.day = 1; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); Bus.emit('started', G.player); UI.refreshToggles(); },
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
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Beetle(G, G.form); b.restore(po); G.players = [b]; });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; G.yearsAll = 1; newGame(seed); resume = false; }
      else { Story.bind(G); Story.reset(); Stickers.setGeneration(G.generation); UI.buildWheel(); Story.afterRestore(); }
    } else leaveTitle();
    G.cam.x = G.player.x; G.cam.y = G.player.y;
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else {
      Voice.say('Welcome back!', { force: true }); const p = G.player;
      UI.hint(p.stage === 'egg' ? 'egg' : p.stage === 'grub' ? (p.full ? (p.chamberReady() ? 'build' : 'cocoonready') : 'eat') : p.stage === 'chamber' ? 'building' : p.stage === 'pupa' ? 'pupa' : p.mode === 'tunnel' ? (p.flags.digDown ? 'digdown' : 'digup') : 'flyagain');
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
  Bus.on('started', () => { if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a stag beetle egg, deep by the old stump.' : 'You are a stag beetle egg, deep beside an old oak stump. You have up to seven years down here, and one summer in the air.'); });

  /* ---------- debug jumps (?stage=…) ---------- */
  function carveHome(p) { const S = G.forest.wood; S.blob(p.x, p.y, 22, 16, MAT.AIR, (m) => m === MAT.ROT || m === MAT.PUNK || m === MAT.FRASS || m === MAT.HEART); S.flushTop(); }
  function debugGrub(instar, frac = .4) {
    const p = G.player, D = G.diff(), th = [0, D.molt2, D.molt3, D.full];
    p.stage = 'grub'; p.mode = 'tunnel'; p.instar = instar; p.food = th[instar - 1] + (th[instar] - th[instar - 1]) * frac;
    p.flags.eggReady = p.flags.hatching = true;
    for (let k = 1; k < instar; k++) p.flags['molt' + k] = p.flags['tight' + k] = true;
    const S = G.forest.wood;
    let x = p.x, y = p.y, a = 0;
    for (let k = 0; k < 40 + instar * 30; k++) { a += Math.sin(k * .3) * .25; x += Math.cos(a) * 5; y += Math.sin(a) * 2.2; if (Math.abs(x - WORLD.stumpX) > 240) break; S.blob(x, y, p.r + 1, p.r, MAT.AIR, (m) => m !== MAT.ROCK); p.x = x; p.y = y; p.trail.unshift({ x, y }); }
    p.trail.length = Math.min(p.trail.length, 90); p.ang = a;
    p.stats.eaten = Math.round(p.food * .7); p.stats.tunnel = 400 * instar;
  }
  function setYear(y, yt) { const F = G.forest; for (let k = 2; k <= y; k++) F.wood.age(k); G.year = y; G.yearsAll = y; G.yt = yt; for (let k = 1; k < y; k++) G.player.flags['yq' + k] = G.player.flags['yd' + k] = true; }
  function debugFull() {
    debugGrub(3, 1); const p = G.player, S = G.forest.wood; p.food = G.diff().full; p.full = true; setYear(Math.max(G.year, 4), .6);
    p.x = WORLD.stumpX + 330; p.y = S.groundAt(p.x) + 110;
    S.blob(p.x, p.y, 18, 14, MAT.AIR, (m) => m !== MAT.ROCK);
    p.trail = []; for (let k = 0; k < 20; k++) p.trail.push({ x: p.x, y: p.y - k * 2 });
    p.ang = Math.PI / 2;
  }
  function debugPupa(t) { debugFull(); const p = G.player; p.stage = 'chamber'; p.room = { x: p.x, y: p.y }; p.build = G.diff().chamber - 1; p.press(); p.pupaT = t || 4; }
  function debugAdult(surface) {
    debugPupa(PUPA_T); const p = G.player; p.emerge();
    p.lengthMM = +params.get('mm') || (p.male ? 68 : 44); G.yt = .22;
    if (surface) { p.hardT = 99; p.pale = 0; p.flags.hard = true; p.x = WORLD.stumpX + 220; p.surface(); }
  }
  function applyDebug() {
    /* the debug jumps skip Read to Play's gates (they call the life-cycle steps directly) */
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), F = G.forest, y = +params.get('year') || 0;
    if (y) setYear(y, +(params.get('yt') || .3));
    if (!st) return;
    const p = G.player, eve = +params.get('eve') || 1;
    if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; }
    else if (/^grub[123]$/.test(st)) { debugGrub(+st[4], +(params.get('frac') || .5)); carveHome(p); }
    else if (st === 'full') debugFull();
    else if (st === 'chamber') { debugFull(); p.stage = 'chamber'; p.room = { x: p.x, y: p.y }; p.build = 2; p.W.chamber(p.x, p.y, 20, 14, .9); }
    else if (st === 'pupa') debugPupa(+(params.get('pt') || 6));
    else if (st === 'adult') debugAdult(false);
    else if (['dusk', 'fly', 'oak', 'ring', 'pair', 'sneak', 'kid', 'female', 'bite', 'flipped', 'pile', 'dig', 'lay'].includes(st)) {
      debugAdult(true);
      if (eve > 1 || st === 'kid') { Story.startEvening(st === 'kid' ? 2 : eve); }
      const land = () => { p.mode = 'climb'; p.perch = { path: F.ringPath, s: 110, dir: 1 }; p.placeOnPerch(); p.flags.sapDone = true; };
      const perchR = (r) => { r.mode = 'perch'; r.x = 0; r.update(0); };
      if (st === 'fly') { p.startWarmup(); p.wingUp = 1; p.updateWarmup(0); p.y = -190; p.x = +(params.get('x') || 300); p.vy = 0; p.vx = 80; }
      if (st === 'oak') { land(); p.flags.sapDone = false; p.perch.s = 120; p.placeOnPerch(); }
      if (st === 'ring' || st === 'pair' || st === 'sneak') { land(); const rv = F.sendRival(Story.rivalNow(), F.ringPath.len * .58); perchR(rv); if (st !== 'ring') { const b = F.sendRival(RIVALS[3], F.ringPath.len * .58); perchR(b); F.lockPair(rv, b); } if (st === 'ring') p.startRing(rv); if (st === 'sneak') p.startSneak(); }
      if (st === 'female') { land(); p.flags.champion = true; perchR(F.sendFemale(F.ringPath, F.ringPath.len - 44)); }
      if (st === 'bite') { land(); p.flags.sapDone = false; p.perch.s = F.sap.s; p.placeOnPerch(); p.startBite(); }
      if (st === 'flipped') p.flipOver();
      if (st === 'pile' || st === 'dig' || st === 'lay') { F.pile = 5; F.kid.done = true; p.x = WORLD.pileX + 90; p.y = F.wood.walkTop(p.x, 10) - p.feet; if (st !== 'pile') { p.startDig(); if (st === 'lay') { p.x = WORLD.pileX; p.y = 110; F.wood.blob(p.x, p.y, 16, 14, MAT.AIR, (m) => m !== MAT.ROCK); } } }
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
    G.forest.update(dt, G.tod);
    p.update(dt);
    Story.update(dt);
    for (const g of G.forest.grubs) if (p.stage === 'grub' && Math.hypot(g.x - p.x, g.y - p.y) < 30 + p.r + g.r && !p.flags.metGrub) { p.flags.metGrub = true; Bus.emit('metGrub', p); }
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, m = p.mode;
    if (!G.started) { const q = G.forest.ringPath.at_(G.forest.ringPath.len * .58), z = clamp(W / 760, 1.3, 2.6), wide = W > 1100; cam.follow(q.x + (wide ? (W * .5 - W * .165) / z : 0), q.y - (wide ? 30 : 120), z); }
    else if (cine) cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (p.stage === 'egg') cam.follow(p.x, p.y - 40, 2.2 * G.userZoom);
    else if (p.stage === 'grub' || p.stage === 'chamber') cam.follow(p.x, p.y - 20, clamp(2.5 - p.r * .05, 1.5, 2.3) * G.userZoom);
    else if (p.stage === 'pupa') cam.follow(p.x, p.y - 20, 2.6 * G.userZoom);
    else if (m === 'tunnel') cam.follow(p.x, p.y - 20, 2.2 * G.userZoom);
    else if (m === 'ring' && p.ring) { const R = p.ring.rival, span = p.ringGap * 2 + (p.size + R.scale) * 92, z = clamp(Math.min(W * .94, H * 1.5) / span, 1.8, 4.6) * G.userZoom; cam.follow((p.x + R.x) / 2, (p.y + R.y) / 2 - H * .02 / z, z); }
    else if (m === 'sneak') cam.follow(p.x - 60, p.y - 50, 2.2 * G.userZoom);
    else if (m === 'bite') cam.follow(p.x, p.y - 20, 2.8 * G.userZoom);
    else if (m === 'fly' || m === 'fall' || m === 'tossed' || m === 'warmup') cam.follow(p.x + p.vx * .55, Math.min(p.y + p.vy * .2, -60), 1.45 * G.userZoom);
    else if (m === 'climb') cam.follow(p.x, p.y - 30, 2 * G.userZoom);
    else if (m === 'lifted') cam.follow(p.x, p.y - 30, 1.9 * G.userZoom);
    else cam.follow(p.x + p.face * 40, p.y - 40, 2.2 * G.userZoom);
    cam.update(rawDt, G.forest.bounds);
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
      /* time-lapse (F), and a gentle fast-forward while the egg and the pupa just wait */
      const waiting = (p.stage === 'egg' && !p.flags.eggReady) || p.stage === 'pupa' || (p.mode === 'tunnel' && p.stage === 'adult' && p.hardT < HARDEN_T);
      const timed = p.mode === 'ring' || p.mode === 'sneak' || p.mode === 'bite';
      G.warp = timed ? 1 : G.fast ? 4 : waiting ? 2 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.forest.update(rawDt, G.tod); }
    G.particles.update(dt, (x) => G.forest.wood.walkTop(x, 6));
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} y${G.year}.${G.yt.toFixed(2)} e${G.evening} ${p.stage}/${p.mode} food=${p.food.toFixed(0)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    AudioFX.update(dt, G.night, p.underground && G.started, G.forest.weather.rain, G.forest.weather.gust, G.started && (p.mode === 'fly' || p.mode === 'warmup' || p.mode === 'tossed'));
    drawTitle(rawDt);
  }

  /* ---------- the title: two great stags locked on the Antler Branch at dusk, the real scene with the real
     painted art, copied into the title's canvas (the game starts underground, so nothing here carries over) ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  function setTitleScene() {
    const F = G.forest, a = F.sendRival(RIVALS[4], F.ringPath.len * .42), b = F.sendRival(RIVALS[3], F.ringPath.len * .42);
    for (const n of [a, b]) { n.mode = 'perch'; n.x = 0; n.update(0); }
    F.lockPair(a, b); G.tod = .755; titleScene = true;
  }
  let titleScene = false;
  function leaveTitle() { if (!titleScene) return; titleScene = false; G.forest.npcs = []; G.forest.rivalsSent = 0; G.tod = .5; G.time = 0; }
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
  if (params.has('gen')) { G.generation = +params.get('gen'); G.yearsAll = +params.get('gen') * 8; }
  if (params.has('zoom')) G.userZoom = +params.get('zoom');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); const p = G.player; if (params.has('stage')) setTimeout(() => UI.hint(p.stage === 'grub' ? (p.full ? 'dig' : 'eat') : p.stage === 'chamber' ? 'building' : p.stage === 'pupa' ? 'pupa' : p.mode === 'tunnel' ? 'harden' : p.mode === 'wrestle' ? 'wrestle' : 'night'), 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'grub2' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'male');
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'grub', 'go', 'up', 'little', 'big', 'dig', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.lift = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
