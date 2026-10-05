/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'hercules', difficulty: 'normal', coati: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('hercules.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('hercules.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, forest: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .82, day: 1, generation: 1, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 300;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8, rivalClock = 25, coatiAt = null, femaleSent = false, dayHint = 0;

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
    G.tod = .84; rivalClock = 25; coatiAt = null; femaleSent = false;
    for (const k in once) delete once[k];
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
    /* in a wrestle, a tap is a push */
    if (p.mode === 'wrestle') { p.input.actionPressed = true; return; }
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
    onNewGame: () => { UI.resetFacts(); G.generation = 1; G.day = 1; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); Bus.emit('started', G.player); UI.refreshToggles(); },
    onNextGeneration: () => { UI.resetFacts(); G.generation++; Stickers.setGeneration(G.generation); G.day = 1; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); Bus.emit('started', G.player); UI.refreshToggles(); },
    onPhoto: photo,
    canNextGen: () => !!(G.player && G.player.flags.genDone)
  });
  Stickers.init(UI.onSticker);
  Journal.init(G);
  Voice.init();
  Grownups.guardOutboundLinks();
  Voice.setEnabled(settings.voice);
  Reading.init(G, { saveSettings });

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Beetle(G, G.form); b.restore(po); G.players = [b]; });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Stickers.setGeneration(G.generation); UI.buildWheel(); femaleSent = !!G.player.flags.champion; }
      G.cam.x = G.player.x; G.cam.y = G.player.y;
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else {
      Voice.say('Welcome back!', { force: true }); const p = G.player;
      UI.hint(p.stage === 'egg' ? 'egg' : p.stage === 'grub' ? (p.full ? (p.chamberReady() ? 'build' : 'dig') : 'eat') : p.stage === 'chamber' ? 'building' : p.stage === 'pupa' ? 'pupa' : p.mode === 'tunnel' ? (p.hardT < HARDEN_T ? 'harden' : 'digup') : 'night');
      /* she met him but the eggs were not laid before the game closed: lay them now */
      if (p.flags.met && !p.flags.genDone) setTimeout(() => layEggs(null), 2500);
    }
  }

  /* ---------- events → hints, facts, cinematics ---------- */
  const P = () => G.player;
  const once = {};
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  Bus.on('started', () => { UI.hint('egg'); setTimeout(() => Bus.emit('fact', 'egg'), 1800); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a Hercules beetle egg, in a rotting log.' : 'You are a Hercules beetle egg, laid in a rotting log in the rainforest.', { force: true }); });
  Bus.on('eggReady', () => UI.hint('hatch'));
  Bus.on('hatched', () => { AudioFX.hatch(); UI.hint('eat'); Bus.emit('fact', 'grub'); Cinematic.play({ follow: P, zoom: 4.2, duration: 2.6, slow: .5, title: 'Out of the egg!' }); });
  Bus.on('chewed', (p, res) => { if (first('chewed')) setTimeout(() => Bus.emit('fact', 'wood'), 2500); if (p.stats.eaten > 160 && first('years')) Bus.emit('fact', 'years'); if (p.stats.eaten > 400 && first('recycler')) Bus.emit('fact', 'recycler'); });
  Bus.on('ateFungus', () => { UI.hint('fungus'); Bus.emit('fact', 'fungus'); });
  Bus.on('tight', () => { UI.hint('tight'); Bus.emit('fact', 'molt'); AudioFX.bump(); });
  Bus.on('molting', () => { AudioFX.molt(); Cinematic.play({ follow: P, zoom: 3.6, duration: MOLT_T + .4, slow: .6, title: 'Moulting!' }); });
  Bus.on('molted', (p, i) => { UI.hint('bigger'); Bus.emit('fact', i === 2 ? 'instar' : 'horndepends'); G.particles.sparkle(p.x, p.y, 24, '#fff3c0', 30); if (i === 2) setTimeout(() => Bus.emit('fact', 'spiracles'), 20000); });
  Bus.on('fullGrown', () => { UI.hint('dig'); Bus.emit('fact', 'chamber'); AudioFX.fanfare(); });
  Bus.on('deepEnough', () => UI.hint('build'));
  Bus.on('chamberStart', () => UI.hint('building'));
  Bus.on('pupated', () => { AudioFX.magic(); UI.hint('pupa'); Bus.emit('fact', 'pupa'); Cinematic.play({ follow: P, zoom: 3, duration: 3.5, slow: .5, title: 'The pupa' }); });
  Bus.on('emerged', (p) => { AudioFX.fanfare(); UI.hint('harden'); Bus.emit('fact', 'soft'); Cinematic.play({ follow: P, zoom: 2.8, duration: 3.5, slow: .5, title: `A ${(p.lengthMM / 10).toFixed(1)} cm Hercules beetle!` }); setTimeout(() => Bus.emit('fact', 'lifecycle'), 4000); });
  Bus.on('hardened', () => { UI.hint('digup'); Bus.emit('fact', 'horns'); });
  Bus.on('surfaced', (p) => {
    if (G.tod > .3 && G.tod < .78) G.tod = .8;              /* beetles come out at night */
    p.flags.surfaced = true;
    UI.hint('night'); Bus.emit('fact', 'night'); Stickers.formDone(G.form);
    Cinematic.play({ follow: P, zoom: 1.6, duration: 3.5, slow: .6, title: 'Night in the rainforest' });
    setTimeout(() => { UI.hint('fruit'); Bus.emit('fact', 'rainforest'); }, 6000);
  });
  Bus.on('firstFruit', () => { Bus.emit('fact', 'fruit'); setTimeout(() => UI.hint('fly'), 2500); });
  Bus.on('ate', (p) => { if (p.stats.fruits === 3) Bus.emit('fact', 'scarab'); });
  Bus.on('firstFlight', () => { Bus.emit('fact', 'fly'); setTimeout(() => Bus.emit('fact', 'elytra'), 6000); });
  Bus.on('firstLift', () => { Bus.emit('fact', 'strong'); });
  Bus.on('climbed', () => { if (first('climb')) UI.hint('climb'); });
  Bus.on('rivalLanded', () => { UI.hint('rival'); Bus.emit('rivalSeen', P()); AudioFX.huff(); });
  Bus.on('wrestle', () => { UI.hint('wrestle'); });
  Bus.on('wrestleWon', () => Bus.emit('fact', 'wrestle'));
  Bus.on('wrestleWon', (p) => { UI.hint('won'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 30, 60); rivalClock = 18; });
  Bus.on('wrestleLost', () => { UI.hint('lost'); Bus.emit('fact', 'huff'); rivalClock = 14; });
  Bus.on('champion', (p) => { UI.hint('champion'); Bus.emit('fact', 'longest'); AudioFX.fanfare(); Cinematic.play({ follow: P, zoom: 2.2, duration: 3.5, slow: .5, title: 'Champion of the forest!' }); });
  Bus.on('femaleLanded', (f) => { if (f.laying) layEggs(f); else { UI.hint('female'); Bus.emit('fact', 'female'); } });
  Bus.on('met', (p, f) => {
    /* she flies to the log; when she lands there she lays her eggs, and the life cycle starts again */
    f.laying = true; f.goal = { x: WORLD.nestX + 120, y: G.forest.wood.walkTop(WORLD.nestX + 120) }; f.mode = 'fly'; f.vy = -120;
  });
  /* timers that outlive a New Game must not act on the new one */
  const later = (ms, fn) => { const F0 = G.forest; setTimeout(() => { if (G.forest === F0) fn(); }, ms); };
  function layEggs(f) {
    const p = P(); if (p.flags.genDone || p.flags.laying) return;
    p.flags.laying = true;
    if (f) Cinematic.play({ follow: () => f, zoom: 1.8, duration: 4.5, slow: .7, title: 'Eggs for a new generation' });
    later(f ? 4600 : 200, () => P().milestone('eggs', () => {
      const q = P(); q.flags.genDone = true; q.flags.laying = false;
      UI.hint('eggs'); G.particles.sparkle(WORLD.nestX + 120, f ? f.y : G.forest.wood.walkTop(WORLD.nestX + 120), 30, '#fff3c0', 40);
      Bus.emit('generationDone'); UI.refreshToggles();
      if (f) later(4000, () => { if (!f.gone) f.flyAway(); });
    }));
  }
  Bus.on('generationDone', () => { Bus.emit('fact', 'lifecycle'); const open = () => { if (Reading.busy() || Cinematic.active) setTimeout(open, 800); else UI.choice(); }; setTimeout(open, 1500); });
  Bus.on('coati', () => { if (P().stage === 'grub') { UI.hint('coati'); Bus.emit('fact', 'coati'); } });
  Bus.on('coatiDig', () => { const p = P(); if (p.stage === 'grub' && Math.abs(p.x - (G.forest.coati.x - 30)) < 140) G.cam.shake = .25; });
  Bus.on('coatiGone', () => { if (P().stage === 'grub') UI.hint('safe'); });
  Bus.on('wetWings', () => { UI.hint('rain'); Bus.emit('fact', 'colour'); });
  Bus.on('weather', (w) => { if (w === 'rain' && P().stage === 'adult' && P().mode !== 'tunnel') UI.hint('rain'); });
  Bus.on('metGrub', () => UI.hint('friend'));
  Bus.on('overTrees', () => { G.particles.sparkle(P().x, P().y, 30, '#fff3b0', 50); });

  /* ---------- debug jumps (?stage=…) ---------- */
  function carveHome(p) { const S = G.forest.wood; S.blob(p.x, p.y, 22, 16, MAT.AIR, (m) => m === MAT.ROT || m === MAT.PUNK || m === MAT.FRASS); S.flushTop(); }
  function debugGrub(instar, frac = .4) {
    const p = G.player, D = G.diff(), th = [0, D.molt2, D.molt3, D.full];
    p.stage = 'grub'; p.mode = 'tunnel'; p.instar = instar; p.food = th[instar - 1] + (th[instar] - th[instar - 1]) * frac;
    p.flags.eggReady = p.flags.hatching = true;
    for (let k = 1; k < instar; k++) p.flags['molt' + k] = p.flags['tight' + k] = true;
    const S = G.forest.wood;
    /* a winding tunnel already eaten from the egg chamber */
    let x = p.x, y = p.y, a = 0;
    for (let k = 0; k < 40 + instar * 30; k++) { a += Math.sin(k * .3) * .25; x += Math.cos(a) * 5; y += Math.sin(a) * 2.2; if (!S.inLog(x, y) || S.survey(x, y, p.r + 2).bark) break; S.chew(x, y, p.r + 1, 99, 1); p.x = x; p.y = y; p.trail.unshift({ x, y }); }
    p.trail.length = Math.min(p.trail.length, 90); p.ang = a;
    p.stats.eaten = Math.round(p.food * .7); p.stats.tunnel = 400 * instar;
  }
  function debugFull() {
    debugGrub(3, 1); const p = G.player, S = G.forest.wood; p.food = G.diff().full; p.full = true;
    const x = WORLD.logR + 40; let y = S.logAxis(x);
    p.x = x; p.y = S.groundAt(x) + 70;
    S.blob(p.x, p.y, 16, 12, MAT.AIR, (m) => m !== MAT.ROCK);
    p.trail = []; for (let k = 0; k < 20; k++) p.trail.push({ x: p.x, y: p.y - k * 2 });
    p.ang = Math.PI / 2;
  }
  function debugPupa(t) { debugFull(); const p = G.player; p.stage = 'chamber'; p.room = { x: p.x, y: p.y }; p.build = G.diff().chamber - 1; p.press(); p.pupaT = t || 4; }
  function debugAdult(surface) {
    debugPupa(PUPA_T); const p = G.player; p.emerge();
    p.lengthMM = +params.get('mm') || 158;
    if (surface) { p.hardT = 99; p.pale = 0; p.flags.hard = true; p.x = WORLD.logR + 140; p.surface(); p.flags.surfaced = true; p.stats.fruits = 1; G.tod = .9; }
  }
  function applyDebug() {
    /* the debug jumps skip Read to Play's gates (they call the life-cycle steps directly) */
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), F = G.forest;
    if (params.has('weather')) { const s = params.get('weather'), wx = F.weather; wx.state = s; wx.timer = 40; if (s === 'rain') { wx.rain = 1; wx.cloud = 1; F.humid = .95; } }
    if (st) {
      const p = G.player;
      if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; }
      else if (/^grub[123]$/.test(st)) { debugGrub(+st[4], +(params.get('frac') || .5)); carveHome(p); }
      else if (st === 'full') debugFull();
      else if (st === 'chamber') { debugFull(); p.stage = 'chamber'; p.room = { x: p.x, y: p.y }; p.build = 2; p.W.chamber(p.x, p.y, 20, 14, .9); }
      else if (st === 'pupa') debugPupa(+(params.get('pt') || 6));
      else if (st === 'adult') debugAdult(false);
      else if (['surface', 'rival', 'wrestle', 'champ', 'female', 'tree', 'branch', 'fly'].includes(st)) {
        debugAdult(true);
        if (st === 'rival' || st === 'wrestle') { const r = F.sendRival(p); r.x = p.x + 90; r.y = p.y; r.mode = 'ground'; r.face = -1; r.goal = { x: r.x, y: r.y }; if (st === 'wrestle') { p.startWrestle(r); p.wr.p = +(params.get('wp') || .3); p.wr.ring = 1.4; } }
        if (st === 'champ' || st === 'female') { p.stats.wins = 3; p.flags.champion = true; femaleSent = st === 'female'; if (st === 'female') { const f = F.sendFemale(p); f.x = p.x + 80; f.mode = 'ground'; f.face = -1; f.goal = { x: f.x, y: 0 }; } }
        if (st === 'tree' || st === 'branch') { const T = F.trees[0]; p.mode = 'climb'; p.perch = st === 'tree' ? { path: T.trunk, s: 300, dir: 1 } : { path: T.paths[2], s: 120, dir: 1 }; p.placeOnPerch(0); }
        if (st === 'fly') { p.takeOff(); p.y = -700; p.x = 700; p.vy = 0; }
      }
    }
    if (params.has('wet')) { G.player.wet = +params.get('wet'); F.humid = G.player.wet > .5 ? .9 : .2; }
    if (params.has('coati')) { const c = F.coati; F.startCoati(G.player.x); c.x = c.target + 10; }
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

  /* ---------- the world's own clock: coati visits, rivals, the female ---------- */
  function director(dt) {
    const p = G.player, F = G.forest, D = G.diff();
    /* the coati visits once, while you are a bigger grub */
    if (p.stage === 'grub' && p.instar >= 2 && settings.coati && D.coati && !F.coati.done && F.coati.state === 'away') {
      if (coatiAt === null) coatiAt = G.time + 40 + Math.random() * 60;
      if (G.time > coatiAt && p.molting <= 0) F.startCoati(p.x);
    }
    if (F.coati.state === 'sniff' && p.stage === 'grub') {
      const deep = p.y - F.wood.topAt(p.x);
      if (deep > 60 || Math.abs(p.x - (F.coati.x - 30)) > 160) p.flags.coatiSafe = true;
      else { p.flags.coatiSafe = false; if (F.coati.t > 2 && Math.random() < dt * .5) UI.hint('coati'); }
    }
    if (p.stage !== 'adult' || p.mode === 'tunnel') return;
    /* rivals come at night once you have eaten, until the female arrives */
    const night = nightAmount(G.tod);
    rivalClock -= dt;
    if (rivalClock <= 0 && night > .4 && p.stats.fruits >= 1 && !F.rival() && !F.female() && (!p.flags.champion || p.flags.met) && p.mode !== 'wrestle') { rivalClock = 30; F.sendRival(p); }
    /* the champion is found by a female */
    if (p.flags.champion && !p.flags.met && !femaleSent && p.mode !== 'wrestle' && !Cinematic.active) { femaleSent = true; later(7000, () => F.sendFemale(G.player)); }
    /* daytime: beetles rest */
    dayHint -= dt;
    if (night < .2 && dayHint <= 0) { dayHint = 60; UI.hint('day'); }
  }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0, saveWarned = false;
  function simulate(dt) {
    const p = G.player;
    /* a grown beetle rests through the day: daytime passes four times faster above ground */
    const restDay = p.stage === 'adult' && p.mode !== 'tunnel' && nightAmount(G.tod) < .3 && p.mode !== 'wrestle';
    if (settings.clock) { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (restDay ? 4 : 1)) % 1; if (G.tod < prev) G.day++; }
    G.time += dt;
    G.forest.update(dt, G.tod);
    p.update(dt);
    director(dt);
    for (const g of G.forest.grubs) if (p.stage === 'grub' && Math.hypot(g.x - p.x, g.y - p.y) < 30 + p.r + g.r && first('metGrub')) Bus.emit('metGrub', p);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (p.stage === 'egg') cam.follow(p.x, p.y - 40, 2.2 * G.userZoom);
    else if (p.stage === 'grub' || p.stage === 'chamber') cam.follow(p.x, p.y, clamp(2.6 - p.r * .06, 1.6, 2.4) * G.userZoom);
    else if (p.stage === 'pupa') cam.follow(p.x, p.y, 2.6 * G.userZoom);
    else if (p.mode === 'tunnel') cam.follow(p.x, p.y, 2.2 * G.userZoom);
    else if (p.mode === 'wrestle' && p.wr) cam.follow(p.wr.mid, p.y - 30, 2.8 * G.userZoom);
    else if (p.mode === 'fly' || p.mode === 'fall' || p.mode === 'tossed') cam.follow(p.x + p.vx * .4, p.y + p.vy * .2, clamp(1.15 - Math.max(0, -p.y - 400) / 3000, .7, 1.15) * G.userZoom);
    else if (p.mode === 'climb') cam.follow(p.x, p.y - 30, 1.6 * G.userZoom);
    else cam.follow(p.x + p.face * 40, p.y - 50, 2.0 * G.userZoom);
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
      G.warp = p.mode === 'wrestle' ? 1 : G.fast ? 4 : waiting ? 2 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.forest.update(rawDt * .3, G.tod); }
    G.particles.update(dt, (x) => G.forest.wood.walkTop(x, 6));
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} food=${p.food.toFixed(0)} r=${p.r.toFixed(1)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    AudioFX.update(dt, G.night, p.underground, G.forest.weather.rain, G.forest.weather.gust, p.mode === 'fly' || p.mode === 'tossed' || G.forest.npcs.some(n => n.mode === 'fly' && Math.abs(n.x - p.x) < 600), p.mode === 'fly' ? -p.vy / 300 : 0);
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: a giant beetle walking through the night forest ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const flies = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * .8, ph: Math.random() * TAU }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#060a1c'); g.addColorStop(.6, '#12304a'); g.addColorStop(1, '#0a1a12');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    const mg = tctx.createRadialGradient(W * .78, H * .2, 10, W * .78, H * .2, 220); mg.addColorStop(0, 'rgba(230,240,255,.9)'); mg.addColorStop(.18, 'rgba(180,200,255,.25)'); mg.addColorStop(1, 'rgba(150,170,255,0)');
    tctx.fillStyle = mg; tctx.fillRect(0, 0, W, H);
    tctx.fillStyle = '#fbf8e8'; tctx.beginPath(); tctx.arc(W * .78, H * .2, 34, 0, TAU); tctx.fill();
    /* silhouettes */
    for (const [yb, col, n] of [[.62, '#16343a', 9], [.72, '#0e2620', 7], [.84, '#081812', 6]]) {
      tctx.fillStyle = col;
      for (let k = 0; k < n; k++) { const x = (k + .5) / n * W + Math.sin(k * 3.7) * 40, r = 60 + (k * 37 % 50); tctx.fillRect(x - 6, H * yb - r, 12, H); for (let j = 0; j < 5; j++) { tctx.beginPath(); tctx.arc(x + Math.cos(j * 1.3) * r * .55, H * yb - r + Math.sin(j * 1.3) * r * .3, r * .55, 0, TAU); tctx.fill(); } }
      tctx.fillRect(0, H * yb, W, H);
    }
    /* fireflies */
    for (const f of flies) { const b = Math.max(0, Math.sin(tt * 1.6 + f.ph)); if (b < .2) continue; tctx.fillStyle = `rgba(200,255,140,${b * .8})`; tctx.beginPath(); tctx.arc(f.x * W + Math.sin(tt * .4 + f.ph) * 20, f.y * H + Math.cos(tt * .3 + f.ph) * 14, 2.4, 0, TAU); tctx.fill(); }
    /* the beetle */
    const bx = ((tt * 26) % (W + 600)) - 300, by = H * .9;
    tctx.save(); tctx.translate(bx, by); Sprites.drawBeetle(tctx, { s: Math.min(1.2, W / 1200), form: settings.form, wet: .3 + .3 * Math.sin(tt * .2), walk: tt * 7, moving: true, lengthMM: 165, seed: 3 }); tctx.restore();
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
  if (params.has('labels')) settings.labels = true;
  if (params.has('pad')) settings.pad = true;
  if (['simple', 'normal'].includes(params.get('read'))) settings.reading = params.get('read');
  if (['auto', 'high', 'low'].includes(params.get('quality'))) settings.quality = params.get('quality');
  if (params.has('readlevel') && READ_LEVELS.includes(params.get('readlevel').toUpperCase())) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  if (params.has('science')) settings.science = true;
  applyDebug();
  if (params.has('tod')) G.tod = +params.get('tod');
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
