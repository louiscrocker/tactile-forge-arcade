/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    species: 'garden', difficulty: 'normal', enemy: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true, p2: false, gpP2: false,
    quality: 'auto', science: false, colony: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { species: Object.keys(SPECIES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  let settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('antkingdom.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('antkingdom.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, colony: null, cam: new Camera(), players: [],
    particles: new Particles(),
    time: 0, tod: .35, day: 1, generation: 1, started: false, userZoom: 1, night: 0, fast: false, overview: false, warp: 1,
    species: settings.species,
    speciesDef() { return SPECIES[this.species] || SPECIES[settings.species] || SPECIES.garden; },
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    colonyPhase() { return this.colony ? this.colony.phase : 'founding'; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 300;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.world = new World(G, seed);
    G.colony = new Colony(G, G.world);
    G.particles = new Particles();
    applyDifficulty();
  }
  function newGame(newSeed) {
    G.species = settings.species;
    G.fast = false; G.overview = false;
    makeWorld(newSeed);
    const q = new Ant(G, 1, 'queen');
    q.startFlight(WORLD.queenX);
    G.players = [q];
    G.cam.x = WORLD.queenX - 300; G.cam.y = -300; G.cam.zoom = 1.1;
  }
  function applyDifficulty() {
    const d = G.diff();
    if (G.world) { G.world.ladybug.enabled = settings.enemy && d.enemy; if (!G.world.ladybug.enabled && G.world.ladybug.state === 'away') G.world.ladybug.timer = 1e9; else if (G.world.ladybug.timer > 1e8) G.world.ladybug.timer = 60; }
  }
  /* the first worker walks out of her cocoon: that is you now, and the queen stays home */
  function becomeWorker(b) {
    const q = G.players[0], C = G.colony;
    C.makeQueen(q.caste === 'queen' ? q.x : b.x, q.caste === 'queen' ? q.y : b.y);
    const w = new Ant(G, 1, 'worker');
    w.x = b.x; w.y = b.y - 8; w.ang = 0;
    G.players[0] = w;
    C.food += 6;
    ensureP2();
    Cinematic.play({ follow: () => G.players[0], zoom: 2.6, duration: 3.4, slow: .5, title: 'The first worker' });
    setTimeout(() => { UI.hint('worker'); Bus.emit('fact', 'nanitics'); }, 3500);
  }
  function ensureP2() {
    if (settings.p2 && G.players.length < 2 && G.colony.phase === 'growing') {
      const p1 = G.players[0], q = new Ant(G, 2, 'worker');
      q.x = p1.x + 14; q.y = p1.y; q.callow = 0;
      G.players[1] = q;
    } else if (!settings.p2 && G.players.length > 1) {
      const q = G.players[1];
      if (q.carryFood) { const f = q.carryFood, i = f.carriers.indexOf(q); if (i >= 0) f.carriers.splice(i, 1); q.carryFood = null; }
      if (q.carryBrood) { q.carryBrood.carried = null; q.carryBrood.x = q.x; q.carryBrood.y = q.y; q.carryBrood = null; }
      G.players.length = 1;
    }
  }

  /* ---------- resize ---------- */
  function resize() {
    W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
    Render.resize(W, H, DPR); G.cam.resize(W, H);
  }
  addEventListener('resize', resize);

  /* ---------- input (only while the game runs; never while typing) ---------- */
  const keys = {};
  const inputState = { padX: 0, padY: 0, padAction: false };
  const typing = (e) => { const t = e.target; if (!t || !t.tagName) return false; if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true; return t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type); };
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (G.started && Reading.keydown(e)) return;
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    keys[K] = true;
    if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
    /* holding a key moves you; it never repeats an action, and browser shortcuts stay the browser's */
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!G.started) { if (k === 'Enter') { start(!!SaveGame.exists() && !params.has('notitle')); e.preventDefault(); } return; }
    if (UI.anyModalOpen() && k !== 'Escape') return;
    const p1 = G.players[0], p2 = G.players[1];
    if (k === ' ' || k === 'Enter') { p1.input.actionPressed = true; e.preventDefault(); }
    if (K === 'e') p1.input.eggPressed = true;
    if (p2) { if (K === 'u') p2.input.actionPressed = true; if (K === 'o') p2.input.eggPressed = true; }
    if (K === 'l' && !p2) toggle('labels');
    if (K === 'm') toggle('sound');
    if (K === 'v') toggle('voice');
    if (K === 'p') photo();
    if (K === 'y') { if (Microscope.isOpen()) Microscope.close(); else Microscope.open(G); }
    if (K === 'b') UI.openStickers();
    if (K === 'j' && !p2) UI.openJournal();
    if (K === 'c') toggle('colony');
    if (K === 'z') toggle('overview');
    if (K === 'f') toggle('fast');
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') UI.closeModals();
  });
  addEventListener('keyup', (e) => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = false; });
  const releaseAll = () => { for (const k in keys) keys[k] = false; inputState.padX = inputState.padY = 0; inputState.padAction = false; document.querySelectorAll('.dpad button.down').forEach(b => b.classList.remove('down')); };
  addEventListener('blur', releaseAll);
  /* sliders and menus give the keyboard back as soon as they are used */
  document.querySelectorAll('#drawer input[type=range], #drawer select').forEach(el => el.addEventListener('change', () => el.blur()));

  function readInput() {
    const pads = Gamepads.poll();
    const padFor = (id) => {
      if (!pads.length) return null;
      if (pads.length === 1) return (settings.gpP2 && G.players[1]) ? (id === 2 ? pads[0] : null) : (id === 1 ? pads[0] : null);
      return id === 1 ? (settings.gpP2 ? pads[1] : pads[0]) : (settings.gpP2 ? pads[0] : pads[1]);
    };
    const p1 = G.players[0];
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1;
    if (keys.ArrowRight || keys.d) x += 1;
    if (keys.ArrowUp || keys.w) y -= 1;
    if (keys.ArrowDown || keys.s) y += 1;
    x += inputState.padX; y += inputState.padY;
    const g1 = padFor(1);
    if (g1) { x += g1.x; y += g1.y; if (g1.actionPressed) p1.input.actionPressed = true; if (g1.eggPressed) p1.input.eggPressed = true; if (g1.photoPressed) photo(); if (g1.scopePressed) Microscope.open(G); }
    let m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    p1.input.x = x; p1.input.y = y;
    const p2 = G.players[1];
    if (p2) {
      let x2 = 0, y2 = 0;
      if (keys.j) x2 -= 1; if (keys.l && !keys.Control) x2 += 1; if (keys.i) y2 -= 1; if (keys.k) y2 += 1;
      const g2 = padFor(2);
      if (g2) { x2 += g2.x; y2 += g2.y; if (g2.actionPressed) p2.input.actionPressed = true; if (g2.eggPressed) p2.input.eggPressed = true; }
      m = Math.hypot(x2, y2); if (m > 1) { x2 /= m; y2 /= m; }
      p2.input.x = x2; p2.input.y = y2;
    }
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
  document.getElementById('btnCall').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.eggPressed = true; });

  /* tap the tunnels, the soil or a plant to go there (and dig toward it) */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    const p = G.player;
    if (p.mode === 'fly') return;
    if (G.overview) { toggle('overview'); return; }
    p.goTo(wx, wy);
  });
  canvas.addEventListener('wheel', (e) => { G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .9 : 1.1), .35, 2.4); e.preventDefault(); }, { passive: false });

  /* ---------- toggles ---------- */
  function toggle(key) {
    switch (key) {
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'voice': settings.voice = !settings.voice; Voice.setEnabled(settings.voice); if (settings.voice) Voice.say('Reading aloud is on.', { force: true }); break;
      case 'enemy': settings.enemy = !settings.enemy; applyDifficulty(); break;
      case 'p2': settings.p2 = !settings.p2; ensureP2(); UI.hint(settings.p2 ? (G.colony.phase === 'growing' ? 'Player 2 joined! IJKL to move, U for action, O for help.' : 'Player 2 will join when the first workers hatch.') : 'Player 2 left.'); break;
      case 'fast': G.fast = !G.fast; if (G.fast) UI.hint(settings.reading === 'simple' ? '⏩ Fast! Watch the colony grow.' : '⏩ Time-lapse: watch the colony grow. Press F again for normal speed.'); break;
      case 'overview': G.overview = !G.overview; break;
      default: if (key in settings) settings[key] = !settings[key];
    }
    saveSettings();
    UI.refreshToggles();
    AudioFX.click();
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
    onSpecies: (k) => { settings.species = k; saveSettings(); if (!G.started) { G.species = k; UI.refreshSpecies(); } else UI.hint(settings.reading === 'simple' ? 'Your next kingdom will be ' + SPECIES[k].short + 's!' : `The next new kingdom will be ${SPECIES[k].name}s. This one stays as it is.`); UI.refreshSpecies(); },
    onDiff: (d) => { settings.difficulty = d; saveSettings(); applyDifficulty(); },
    onReading: (r) => { settings.reading = r; saveSettings(); },
    onReadMode: (m) => { settings.readMode = m; if (m === 'play') settings.reading = 'simple'; saveSettings(); },
    onReadLevel: (L) => { if (L === 'auto') settings.readAuto = !settings.readAuto; else { settings.readLevel = L; settings.readMode = 'play'; } saveSettings(); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); },
    onQuality: (q) => { settings.quality = q; saveSettings(); Render.setQuality(q === 'low' ? 'low' : 'high'); },
    onToggle: toggle,
    onBoost: (job) => { if (G.colony.phase === 'growing') { G.colony.boostJob(job); AudioFX.chirp && AudioFX.chirp(); } },
    onTod: (v) => { G.tod = v; },
    onNextSeason: () => { const w = G.world; const cur = Math.floor((w.dayOfYear - 1) / DAYS_PER_SEASON); w.dayOfYear = ((cur + 1) % 4) * DAYS_PER_SEASON + 1; if (cur === 3) w.year++; w.updateSeason(); G.day++; },
    onNewGame: () => { UI.resetFacts(); G.generation = 1; G.day = 1; G.tod = .35; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); UI.hint('dig'); UI.refreshToggles(); },
    onNextGeneration: () => { UI.resetFacts(); G.generation++; Stickers.setGeneration(G.generation); G.day = 1; G.tod = .35; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); UI.refreshToggles(); },
    onPhoto: photo
  });
  Stickers.init(UI.onSticker);
  Journal.init(G);
  Voice.init();
  Voice.setEnabled(settings.voice);
  Reading.init(G, { saveSettings });

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (players) => {
        G.players = [];
        players.forEach((po, i) => { const a = new Ant(G, i + 1, po.caste === 'queen' ? 'queen' : 'worker'); a.restore(po); G.players[i] = a; });
        if (!G.players.length) { const q = new Ant(G, 1, 'queen'); q.place(WORLD.queenX, G.world.soil.surfaceAt(WORLD.queenX) - 12); G.players = [q]; }
      });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; G.tod = .35; newGame(seed); resume = false; }
      else Stickers.setGeneration(G.generation);
      G.cam.x = G.player.x; G.cam.y = G.player.y; G.cam.zoom = 1.5;
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (Reading.on()) { if (!resume) Reading.onStart(); }
    else Voice.say(resume ? 'Welcome back to your kingdom!' : (settings.reading === 'simple' ? 'You are a queen ant. Watch her land!' : 'You are a young queen on her wedding flight. Watch her land, then dig.'), { force: true });
    if (!resume) { setTimeout(() => Bus.emit('fact', 'flight'), 1500); }
    else UI.hint(G.player.caste === 'queen' ? (G.colony.royal ? 'tend' : 'dig') : 'forage');
    ensureP2();
  }

  /* ---------- events → hints, facts, cinematics ---------- */
  const p1only = (fn) => (p, ...rest) => { if (!p || !p.isPlayer || p.id === 1) fn(p, ...rest); };
  Bus.on('landed', p1only((p) => { if (p.caste !== 'queen') return; UI.hint('dig'); setTimeout(() => Bus.emit('fact', 'wings'), 1500); Cinematic.play({ follow: () => G.players[0], zoom: 2.8, duration: 2.6, slow: .5, title: 'Off come the wings' }); }));
  Bus.on('wentDown', p1only((p) => { if (p.caste === 'queen' && !G.colony.royal) { UI.hint('deeper'); Bus.emit('fact', 'founding'); } }));
  Bus.on('founded', () => { AudioFX.eggs && AudioFX.eggs(); });
  Bus.on('eggsLaid', () => { UI.hint('tend'); Bus.emit('fact', 'eggs'); Cinematic.play({ follow: () => G.players[0], zoom: 3, duration: 3, slow: .5, title: 'The first eggs' }); });
  Bus.on('milestone', (k) => {
    const say = { larvae: ['feedLarva', 'larvae', 'The eggs hatch'], cocoon: ['cocoon', 'cocoon', 'The first cocoon'], ten: ['forage', 'jobs', 'Ten ants!'], hundred: [null, 'honeydew', 'One hundred ants!'], thousand: [null, 'mound', 'One thousand ants!'], kingdom: ['kingdom', 'kingdom', 'An ant kingdom!'] }[k];
    if (!say) return;
    if (say[0]) UI.hint(say[0]);
    if (say[1]) Bus.emit('fact', say[1]);
    if (['ten', 'hundred', 'thousand', 'kingdom'].includes(k)) { AudioFX.fanfare(); G.particles.confetti(G.player.x, G.player.y - 40, 70); }
  });
  Bus.on('firstWorker', (b) => { AudioFX.fanfare(); becomeWorker(b); });
  Bus.on('hatched', (b) => { AudioFX.hatch && AudioFX.hatch(); });
  Bus.on('fullOfDirt', p1only(() => { UI.hint('dirt'); Bus.emit('fact', 'digging'); }));
  Bus.on('spoil', p1only((p) => { if (p.isPlayer) Bus.emit('fact', 'mound'); }));
  Bus.on('pickup', p1only((p) => { if (p.isPlayer) { UI.hint('carryHome'); Bus.emit('fact', 'strong'); } }));
  Bus.on('stored', (kind, k, who) => { if (who === 'player') UI.hint(G.world.plants.some(P => P.herd.count()) ? 'aphids' : 'forage'); });
  Bus.on('act', p1only((p, verb) => { if (verb === 'milk') { Bus.emit('fact', 'honeydew'); if (p.crop >= 3) { UI.hint('cropFull'); Bus.emit('fact', 'crop'); } } }));
  Bus.on('bigGrab', p1only((p, f) => { if (f.carriers.length < f.need) UI.hint('bigFood'); Bus.emit('fact', 'teamwork'); }));
  Bus.on('help', () => { UI.hint('help'); Bus.emit('fact', 'pheromones'); });
  Bus.on('callAlone', () => UI.hint(settings.reading === 'simple' ? '📣 No sisters yet! Raise the babies first.' : '📣 Nobody to call yet: the first workers are still growing.'));
  Bus.on('enemy', () => { UI.hint('enemy'); Bus.emit('fact', 'ladybug'); });
  Bus.on('enemyShooed', () => { UI.hint('shooed'); AudioFX.sticker && AudioFX.sticker(); });
  Bus.on('ladybugVisit', () => { if (G.colony.phase === 'growing') UI.hint(settings.reading === 'simple' ? '🐞 A ladybug came to lay eggs!' : '🐞 A ladybug is laying eggs by the aphids. Soon a hungry larva will hatch.'); });
  Bus.on('weather', (w) => { if (w === 'rain') { UI.hint('rain'); } });
  Bus.on('broodWet', () => Bus.emit('fact', 'rain'));
  Bus.on('stone', p1only(() => UI.hint(settings.reading === 'simple' ? '🪨 A stone! Dig around it.' : '🪨 That is a stone: ants cannot dig it. Go around.')));
  Bus.on('dug', p1only((p) => { const m = G.world.soil.matAt(p.x + p.faceX * 20, p.y + p.faceY * 20); if (m === MAT.SAND) Bus.emit('fact', 'sand'); if (m === MAT.CLAY) Bus.emit('fact', 'clay'); }));
  Bus.on('colonyWinter', () => { UI.hint('winter'); Bus.emit('fact', 'winter'); AudioFX.season(false); });
  Bus.on('colonySpring', () => { UI.hint('spring'); Bus.emit('fact', 'spring'); AudioFX.season(true); });
  Bus.on('roomDug', (r) => { if (r.kind === 'nursery') Bus.emit('fact', 'warmth'); });
  Bus.on('stage', (st) => { if (st >= 4) Bus.emit('fact', 'count'); });
  Bus.on('flight', () => { Cinematic.play({ x: G.colony.entrance.x, y: G.colony.entrance.y - 120, zoom: 1.4, duration: 6, slow: .6, title: 'Flying ant day!' }); UI.hint('kingdom'); });
  Bus.on('flightDone', () => { const open = () => { if (Reading.busy() || Cinematic.active) setTimeout(open, 800); else UI.choice(); }; setTimeout(open, 1500); });
  Bus.on('founded', () => { if (settings.species === 'leafcutter') Bus.emit('fact', 'leafcutter'); if (settings.species === 'harvester') Bus.emit('fact', 'seeds'); });
  Bus.on('season', (s) => AudioFX.season(s === 'spring' || s === 'summer'));

  /* ---------- debug jumps: ?stage=founded|larvae|worker|ten|hundred|thousand|kingdom ---------- */
  function carveNest(nRooms) {
    const C = G.colony, S = G.world.soil;
    let rooms = 0;
    for (const p of C.plan) {
      if (p.room !== null && !C.rooms.find(r => r.id === p.room)) continue;
      if (p.room !== null) { const idx = C.rooms.findIndex(r => r.id === p.room); if (idx > nRooms) break; }
      S.dig(p.x, p.y, p.r, 99, 1); p.done = true;
    }
    C.checkPlan(); for (const r of C.rooms) if (r.planned) { const o = S.openness(r.x, r.y, r.rx * .8, r.ry * .7); r.open = o; }
    while (C.planAt < C.plan.length && C.plan[C.planAt].done) C.planAt++;
    return rooms;
  }
  function debugFound() {
    const C = G.colony, S = G.world.soil, q = G.players[0];
    q.mode = 'ground'; q.wings = 0;
    const x = WORLD.queenX, gy = S.ground0(x);
    for (let y = gy - 6; y < gy + 120; y += 4) S.dig(x, y, 13, 99, 1);
    C.entryX = x; q.x = x; q.y = gy + 118; q.underground = true;
    C.found(q);
    S.update(0); S.rebuildWalk(0, 0, S.cols - 1, S.rows - 1);
    q.x = C.royal.x + C.royal.rx * .45; q.y = C.royal.y + C.royal.ry - 12;
  }
  function debugGrow(n) {
    debugFound();
    const C = G.colony, S = G.world.soil, R = C.royal;
    C.done = { eggs: true, larvae: true, cocoon: true, worker: true };
    C.phase = 'growing';
    const rooms = n >= 5000 ? 14 : n >= 1000 ? 9 : n >= 100 ? 5 : n >= 10 ? 2 : 1;
    carveNest(rooms);
    S.rebuildWalk(0, 0, S.cols - 1, S.rows - 1); S.version++;
    C.pop = n; C.food = n * 1.5 + 10; C.honey = n * .6 + 5;
    C.stage = COLONY_STAGES.filter(s => n >= s.at).length - 1;
    for (const st of COLONY_STAGES) if (n >= st.at) C.done[st.key] = true;
    C.makeQueen(R.x - 10, R.y + R.ry - 12);
    const vis = Math.min(n - 1, C.visCap());
    const open = C.rooms.filter(r => r.open >= .6);
    for (let i = 0; i < vis; i++) { const r = pick(open), s = C.floorSpot(r, []); const a = C.spawnAgent(s.x, s.y - 8, JOB_KEYS[i % 5]); a.callow = 0; a.age = 100; }
    const nur = C.nurseries();
    for (let i = 0; i < Math.min(18, 3 + n / 20); i++) { const r = pick(nur), kind = ['egg', 'larva', 'pupa'][i % 3], b = C.addBrood(kind, r, C.rep(), C.floorSpot(r, C.brood)); b.fed = kind === 'larva' ? i % 3 : 0; b.age = kind === 'pupa' ? 5 : 3; }
    if (C.entrance) S.addMound(C.entrance.x + 60, Math.min(900, 40 + n / 5));
    for (let i = 0; i < 400; i++) S.update(1 / 30);
    const w = new Ant(G, 1, 'worker'); w.callow = 0;
    const spot = C.floorSpot(pick(nur), []); w.x = spot.x; w.y = spot.y - 9;
    G.players = [w];
    Bus.emit('stage', C.stage, C);
  }
  function applyDebug() {
    const w = G.world;
    if (params.has('season')) { const idx = SEASONS.indexOf(params.get('season')); if (idx >= 0) { w.dayOfYear = idx * DAYS_PER_SEASON + 1 + (+params.get('sday') || 0); w.updateSeason(); w.seasonChanged = false; w.weather.snow = w.season === 'winter' ? 1 : 0; } }
    if (params.has('weather')) { const s = params.get('weather'), wx = w.weather; wx.state = s; wx.timer = 30; if (s === 'rain') { wx.rain = 1; wx.cloud = 1; } if (s === 'clearing') { wx.rainbow = 1; wx.cloud = .3; } }
    const st = params.get('stage');
    if (st) {
      const q = G.players[0];
      if (st === 'queen') { q.mode = 'ground'; q.wings = 0; q.x = WORLD.queenX; q.y = w.soil.surfaceAt(q.x) - 12; }
      else if (st === 'founded' || st === 'larvae' || st === 'cocoon') {
        debugFound();
        const C = G.colony; C.done.eggs = true;
        for (let k = 0; k < 5; k++) { const b = C.addBrood('egg', C.royal, 1, C.floorSpot(C.royal, C.brood)); if (st !== 'founded') { b.kind = k < 3 || st === 'larvae' ? 'larva' : 'pupa'; b.fed = st === 'cocoon' ? 3 : k % 2; } }
        if (st !== 'founded') C.done.larvae = true;
        if (st === 'cocoon') C.done.cocoon = true;
      }
      else { const n = { worker: 4, ten: 12, hundred: 130, thousand: 1200, kingdom: 5200 }[st] || +st || 4; debugGrow(n); if (st === 'worker') { G.colony.done.ten = false; G.colony.stage = 1; } }
    }
    const p = G.players[0];
    if (params.get('at') === 'surface' && p.caste === 'worker') { p.x = G.colony.entrance ? G.colony.entrance.x + 140 : 0; p.y = w.soil.surfaceAt(p.x) - 10; }
    if (params.get('at') === 'plant') { p.mountPlant(w.plants[0], 1); p.w.seg = w.plants[0].herd.list[0] ? w.plants[0].herd.list[0].seg : 3; p.w.t = .5; p.updatePlant(0, 0, 0); }
    if (params.has('carry')) p.carry = params.get('carry');
    if (params.has('crop')) p.crop = +params.get('crop');
    if (params.has('enemy')) { const lb = w.ladybug; lb.start(0); lb.state = 'eggs'; lb.timer = .01; }
    if (params.has('flood')) { const e = G.colony.entrance || { x: WORLD.queenX }; for (let k = 0; k < 500; k++) w.soil.addWater(e.x + rnd(-10, 10), w.soil.ground0(e.x) - 20 - rnd(0, 60)); }
    if (params.has('big')) { const x = p.x + 60; w.foods.add('bug', x, w.soil.surfaceAt(x) - 15, false); }
    if (params.has('fast')) G.fast = true;
    if (params.has('overview')) G.overview = true;
    if (params.has('showhi')) G.showHi = params.get('showhi').split(',').map(Number);
  }

  /* the gamepad on the title and in the panels: A starts / chooses, B or Start closes */
  function padMenus(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (!G.started) { if (g.actionPressed || g.startPressed) start(!!SaveGame.exists()); return; }
    const choice = document.getElementById('choice');
    if (!choice.hidden) { if (g.actionPressed) document.getElementById('btnNewKingdom').click(); else if (g.eggPressed || g.startPressed) document.getElementById('btnKeep').click(); return; }
    if (g.eggPressed || g.startPressed || g.scopePressed) UI.closeModals();
  }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0, saveWarned = false;
  function simulate(dt, rawDt) {
    const w = G.world, C = G.colony, players = G.players;
    /* the calendar: nights pass quickly while the colony sleeps through winter */
    if (settings.clock) {
      const prevTod = G.tod, rate = C.winter ? 30 : 1;
      G.tod = (G.tod + dt / DAY_LENGTH * rate) % 1;
      if (G.tod < prevTod) { G.day++; w.endDay(); }
    }
    G.time += dt;
    w.update(dt, G.tod);
    for (const p of players) p.update(dt);
    C.update(dt);
    Journal.update(dt);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = clamp((now - last) / 1000, 0, .05);
    last = now;
    if (document.hidden) return;
    Cinematic.update(rawDt);
    const dt = rawDt * Cinematic.timeScale;
    const modal = UI.anyModalOpen();
    const players = G.players;
    if (G.started && !modal) readInput();
    else for (const p of players) { p.input.x = p.input.y = 0; }
    if (G.started && modal && Reading.busy()) Reading.gamepad(Gamepads.poll());
    else if (modal || !G.started) padMenus(Gamepads.poll());

    if (G.started && !modal) {
      /* time-lapse (F), and a gentle fast-forward while the founding queen just waits */
      const C = G.colony, p = G.player;
      const waiting = C.phase === 'founding' && C.royal && !C.hungry && C.brood.length && p.input.x === 0 && p.input.y === 0;
      G.warp = G.fast ? 4 : waiting ? 3 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt, rawDt);
      Reading.update(dt);
      /* stickers that watch numbers */
      if (frames % 30 === 0 && p.caste === 'worker') {
        Stickers.note('deepest', p.stats.deepest); Stickers.note('highest', p.stats.highest || 0);
        const wm = G.world.worm; if (dist(wm.x, wm.y, p.x, p.y) < 60) Bus.emit('worm');
        if (C.phase === 'growing' && C.hungry > 3 && C.food < C.rep() * 2 && chance(.02)) UI.hint('hungry');
        if (C.crowded && chance(.02)) UI.hint('room');
      }
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The kingdom could not be saved: storage is full.' : '💾 The kingdom could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    }
    G.particles.update(dt, (x) => G.world.soil.surfaceAt(x));

    /* ----- camera ----- */
    const p = G.player, S = G.world.soil;
    const cine = Cinematic.camera();
    if (G.overview) {
      const C = G.colony, deepest = Math.max(500, ...C.rooms.filter(r => r.open >= .6).map(r => r.y + 120));
      const cx = C.entrance ? C.entrance.x : p.x;
      G.cam.follow(cx, deepest / 2 - 150, clamp(Math.min(W / 1500, H / (deepest + 500)), W / (WORLD.right - WORLD.left) + .01, 1));
    } else if (cine) G.cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (players.length > 1) {
      const a = players[0], b = players[1];
      const span = Math.max(Math.abs(a.x - b.x) + 300, (Math.abs(a.y - b.y) + 260) * (W / H));
      G.cam.follow((a.x + b.x) / 2, (a.y + b.y) / 2, clamp(W / span, .35, 1.6) * G.userZoom);
    } else {
      const z = p.mode === 'fly' ? 1 : p.mode === 'plant' ? 2.1 : p.underground ? 1.75 : 1.7;
      G.cam.follow(p.x + (p.mode === 'fly' ? 120 : 0), p.y - (p.underground ? 0 : 40), z * G.userZoom);
    }
    G.cam.update(rawDt, G.world.bounds);

    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${G.colony.phase} pop=${G.colony.pop} food=${G.colony.food.toFixed(1)} agents=${G.colony.agents.length} p=${p.x.toFixed(0)},${p.y.toFixed(0)} mode=${p.mode} ${p.caste} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update();
    const depth = S.depthAt(p.x, p.y);
    AudioFX.update(dt, G.night, p.underground, depth, G.world.weather.rain, .5 + .5 * Math.sin(G.time * .3) + G.world.weather.gust, p.mode === 'fly' || !!G.colony.flight, S.waterCount > 20);
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: ants marching over a soil cross-section ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  const marchers = [];
  for (let i = 0; i < 14; i++) marchers.push({ x: Math.random(), lane: i % 3, sp: rnd(.03, .06), carry: pick([null, null, 'seed', 'soil', 'leaf', 'crumb']), ph: rnd(TAU), key: pick(Object.keys(SPECIES)) });
  let tt = 0;
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    /* soil bands */
    const g = tctx.createLinearGradient(0, H * .62, 0, H);
    g.addColorStop(0, '#7a5234'); g.addColorStop(.3, '#5e3e26'); g.addColorStop(.6, '#c9a46a'); g.addColorStop(.75, '#8a5a3a'); g.addColorStop(1, '#6a3a2a');
    tctx.fillStyle = g; tctx.fillRect(0, H * .62, W, H * .38);
    tctx.strokeStyle = '#4f9a3a'; tctx.lineWidth = 3; tctx.lineCap = 'round';
    for (let x = 0; x < W; x += 7) { const h = 10 + ((x * 37) % 23); tctx.beginPath(); tctx.moveTo(x, H * .62 + 2); tctx.lineTo(x + Math.sin(tt + x) * 3, H * .62 - h); tctx.stroke(); }
    /* a tunnel with ants in it */
    tctx.fillStyle = '#2a1a0f';
    tctx.beginPath(); tctx.moveTo(0, H * .8); for (let x = 0; x <= W; x += 20) tctx.lineTo(x, H * .8 + Math.sin(x * .01) * 12); for (let x = W; x >= 0; x -= 20) tctx.lineTo(x, H * .8 + 40 + Math.sin(x * .01) * 12); tctx.fill();
    for (const m of marchers) {
      m.x += m.sp * dt; if (m.x > 1.1) m.x = -.1;
      const x = m.x * W, y = m.lane === 0 ? H * .62 - 10 : m.lane === 1 ? H * .8 + 30 + Math.sin(x * .01) * 12 : H * .62 - 10;
      if (m.lane === 2) continue;
      tctx.save(); tctx.translate(x, y); tctx.scale(1.6, 1.6);
      Sprites.drawAnt(tctx, { s: 1, sp: SPECIES[m.key], walk: tt * 9 + m.ph, carry: m.carry });
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
  if (params.has('species') && SPECIES[params.get('species')]) settings.species = params.get('species');
  if (params.has('diff') && DIFFICULTY[params.get('diff')]) settings.difficulty = params.get('diff');
  newGame(seed);
  if (params.has('tod')) G.tod = +params.get('tod');
  if (params.has('labels')) settings.labels = true;
  if (params.has('pad')) settings.pad = true;
  if (['simple', 'normal'].includes(params.get('read'))) settings.reading = params.get('read');
  if (['auto', 'high', 'low'].includes(params.get('quality'))) settings.quality = params.get('quality');
  if (params.has('readlevel') && READ_LEVELS.includes(params.get('readlevel').toUpperCase())) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  if (params.has('colony')) settings.colony = true;
  if (params.has('science')) settings.science = true;
  applyDebug();
  if (params.has('p2')) { settings.p2 = true; ensureP2(); }
  if (params.has('zoom')) G.userZoom = +params.get('zoom');
  if (params.has('stage') || params.has('at')) { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = (p.mode === 'plant' ? 2.1 : p.underground ? 1.75 : 1.7) * G.userZoom; if (G.overview) G.cam.zoom = .5; }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); }
  if (params.has('stage') && params.get('stage') !== 'queen') { const p = G.player; if (p.caste === 'queen') UI.hint(G.colony.brood.some(b => G.colony.hungryLarva(b)) ? 'feedLarva' : 'tend'); else UI.hint('forage'); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'queen' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'worker');
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'drawer') document.getElementById('drawer').hidden = false;
      else if (o === 'choice') document.getElementById('choice').hidden = false;
    }, 60);
  }
  if (params.has('mission')) Reading._missionNow();
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'ant', 'go', 'up', 'little', 'big', 'dig', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.sip = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  if (params.has('readpage')) setTimeout(() => { Reading._solveGate(); Reading.showPage(params.get('readpage'), { gate: params.has('gate') }); }, 80);
  if (params.has('readcard')) setTimeout(() => { Reading._solveGate(); G.player.input.actionPressed = true; Reading.intercept(G.player); }, 120);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); nx && nx.click(); }, 400);
  requestAnimationFrame(loop);
})();
