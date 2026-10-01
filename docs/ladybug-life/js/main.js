/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings ---------- */
  const DEFAULTS = {
    species: 'sevenspot', difficulty: 'normal', ants: true, bird: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true, p2: false, gpP2: false,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  let settings;
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('ladybug.settings') || '{}')); } catch (e) { settings = Object.assign({}, DEFAULTS); }
  const saveSettings = () => { try { localStorage.setItem('ladybug.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, garden: null, cam: new Camera(), players: [], bird: null,
    particles: new Particles(), exuviae: [], eggClusters: [],
    time: 0, tod: .36, day: 1, generation: 1, started: false, userZoom: 1, night: 0, lastCluster: null,
    speciesDef() { return SPECIES[settings.species] || SPECIES.sevenspot; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 320;

  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1;
  let saveClock = 8;

  function makeGarden(newSeed, layout) {
    if (newSeed !== undefined) seed = newSeed;
    G.garden = new Garden(G, seed, layout);
    G.exuviae = []; G.eggClusters = [];
    G.particles = new Particles();
    G.bird = new Bird(G);
    for (const p of G.garden.plants) { p.npcs = new WildLarvae(p, G); }
    applyDifficulty();
  }

  function newGarden(newSeed) {
    makeGarden(newSeed);
    G.players = [];
    startLife(pickEggSpot(), 1);
    ensurePlayers();
    G.cam.x = G.player.x; G.cam.y = G.player.y - 40; G.cam.zoom = G.player.cameraZoom();
  }

  function pickEggSpot(plant) {
    const P = plant || G.garden.main;
    let spots = P.leafSpots.filter(ls => P.segs[ls.seg].depth >= 1 && ls.y > -700 && ls.t > .25 && ls.t < .85);
    if (!spots.length) spots = P.leafSpots.filter(ls => ls.t > .2 && ls.t < .9);
    if (!spots.length) spots = P.leafSpots;
    return pick(spots);
  }

  /* A fresh bug starting as an egg at the given leaf spot. */
  function startLife(spot, id = 1, speciesKey) {
    const b = new Bug(G, speciesKey || settings.species, id);
    b.placeEgg(spot);
    G.players[id - 1] = b;
    if (id === 1) { UI.hint('egg'); hintTimer = 0; }
    return b;
  }

  function ensurePlayers() {
    if (settings.p2 && G.players.length < 2) {
      const p1 = G.players[0];
      const spot = p1.eggSpot || pickEggSpot(p1.plant);
      const other = Object.keys(SPECIES).filter(k => k !== settings.species);
      startLife(spot, 2, pick(other));
    } else if (!settings.p2 && G.players.length > 1) {
      G.players.length = 1;
    }
  }

  function applyDifficulty() {
    const d = DIFFICULTY[settings.difficulty];
    for (const p of G.garden.plants) {
      p.ants.enabled = settings.ants && d.ants;
      p.ants.setCount(settings.difficulty === 'hard' ? 4 : 2, d.antSpeed);
      if (p.npcs && p.npcs.setCount) p.npcs.setCount(settings.difficulty === 'easy' ? 1 : settings.difficulty === 'hard' ? 3 : 2);
    }
    if (G.bird) G.bird.enabled = settings.bird && d.bird;
  }

  /* ---------- resize ---------- */
  function resize() {
    W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
    Render.resize(W, H, DPR);
    G.cam.resize(W, H);
  }
  addEventListener('resize', resize);

  /* ---------- input ---------- */
  const keys = {};
  const inputState = { padX: 0, padY: 0, padAction: false };
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (G.started && Reading.keydown(e)) return;
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    keys[K] = true;
    if (!G.started) { if (k === ' ' || k === 'Enter') { start(!!SaveGame.exists() && !params.has('notitle')); e.preventDefault(); } return; }
    const p1 = G.players[0], p2 = G.players[1];
    if (k === ' ' || k === 'Enter') { p1.input.actionPressed = true; e.preventDefault(); }
    if (K === 'e') p1.input.eggPressed = true;
    if (p2) { if (K === 'u') p2.input.actionPressed = true; if (K === 'o') p2.input.eggPressed = true; }
    if (K === 'l') toggle('labels');
    if (K === 'm') toggle('sound');
    if (K === 'v') toggle('voice');
    if (K === 'p') photo();
    if (K === 'y') { if (Microscope.isOpen()) Microscope.close(); else Microscope.open(G); }
    if (K === 'b') UI.openStickers();
    if (K === 'j') UI.openJournal();
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') UI.closeModals();
    if (k.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function readInput() {
    const pads = Gamepads.poll();
    const padFor = (id) => {
      if (!pads.length) return null;
      if (pads.length === 1) return (settings.gpP2 && G.players[1]) ? (id === 2 ? pads[0] : null) : (id === 1 ? pads[0] : null);
      return id === 1 ? (settings.gpP2 ? pads[1] : pads[0]) : (settings.gpP2 ? pads[0] : pads[1]);
    };
    /* player 1: arrows / WASD / touch pad / gamepad */
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
    p1.input.action = !!(keys[' '] || inputState.padAction || (g1 && g1.action));
    /* player 2: IJKL / gamepad */
    const p2 = G.players[1];
    if (p2) {
      let x2 = 0, y2 = 0;
      if (keys.j) x2 -= 1; if (keys.l) x2 += 1; if (keys.i) y2 -= 1; if (keys.k) y2 += 1;
      const g2 = padFor(2);
      if (g2) { x2 += g2.x; y2 += g2.y; if (g2.actionPressed) p2.input.actionPressed = true; if (g2.eggPressed) p2.input.eggPressed = true; }
      m = Math.hypot(x2, y2); if (m > 1) { x2 /= m; y2 /= m; }
      p2.input.x = x2; p2.input.y = y2;
      p2.input.action = !!(keys.u || (g2 && g2.action));
    }
    /* in Read to Play the action button opens a word card instead */
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
  document.getElementById('btnAction').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started) G.player.input.actionPressed = true; inputState.padAction = true; });
  document.getElementById('btnAction').addEventListener('pointerup', () => { inputState.padAction = false; });
  document.getElementById('btnEgg').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started) G.player.input.eggPressed = true; });

  /* click / tap the plant to walk there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    const held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    const p = G.player;
    if (p.state === 'egg' || p.state === 'pupa' || p.state === 'flying') { p.input.actionPressed = true; return; }
    const n = p.plant.nearest(wx, wy, 90 / Math.sqrt(G.cam.zoom));
    if (n) p.goTo(n.seg, n.t, n.plant);
  });
  canvas.addEventListener('wheel', (e) => {
    G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .9 : 1.1), .5, 2.2);
    e.preventDefault();
  }, { passive: false });

  /* ---------- toggles ---------- */
  function toggle(key) {
    switch (key) {
      case 'labels': settings.labels = !settings.labels; break;
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'voice': settings.voice = !settings.voice; Voice.setEnabled(settings.voice); if (settings.voice) Voice.say('Reading aloud is on.', { force: true }); break;
      case 'ants': settings.ants = !settings.ants; applyDifficulty(); break;
      case 'bird': settings.bird = !settings.bird; applyDifficulty(); break;
      case 'slowmo': settings.slowmo = !settings.slowmo; break;
      case 'pad': settings.pad = !settings.pad; break;
      case 'clock': settings.clock = !settings.clock; break;
      case 'science': settings.science = !settings.science; break;
      case 'p2': settings.p2 = !settings.p2; ensurePlayers(); UI.hint(settings.p2 ? 'Player 2 joined! IJKL to move, U for action, O for eggs.' : 'Player 2 left the garden.'); break;
      case 'gpP2': settings.gpP2 = !settings.gpP2; break;
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
    onSpecies: (k) => {
      settings.species = k; saveSettings();
      if (G.player && G.player.stage < 6) G.player.species = SPECIES[k];
      UI.refreshSpecies();
    },
    onDiff: (d) => { settings.difficulty = d; saveSettings(); applyDifficulty(); },
    onReading: (r) => { settings.reading = r; saveSettings(); },
    onReadMode: (m) => { settings.readMode = m; if (m === 'play') settings.reading = 'simple'; saveSettings(); },
    onReadLevel: (L) => { if (L === 'auto') settings.readAuto = !settings.readAuto; else { settings.readLevel = L; settings.readMode = 'play'; } saveSettings(); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); },
    onQuality: (q) => { settings.quality = q; saveSettings(); Render.setQuality(q === 'low' ? 'low' : 'high'); },
    onToggle: toggle,
    onTod: (v) => { G.tod = v; },
    onNextSeason: () => {
      const g = G.garden;
      const cur = Math.floor((g.dayOfYear - 1) / DAYS_PER_SEASON);
      if (cur >= 3) { g.toSpring(); for (const p of G.players) if (p.state === 'hibernating') p.wake(); }
      else { g.dayOfYear = (cur + 1) * DAYS_PER_SEASON + 1; g.updateSeason(); }
      G.day++;
    },
    onNewGarden: () => { UI.resetFacts(); G.generation = 1; G.day = 1; G.tod = .36; newGarden((Math.random() * 1e9) | 0); UI.hint('egg'); SaveGame.write(G); Reading.onStart(); },
    onRestart: () => { UI.resetFacts(); G.generation = 1; G.players = []; startLife(pickEggSpot(), 1); ensurePlayers(); Reading.onStart(); },
    onHatchNext: () => {
      const c = G.lastCluster;
      G.generation++;
      Stickers.setGeneration(G.generation);
      const keep = G.players.slice();
      G.players = [];
      startLife(c ? { seg: c.seg, t: c.t, x: c.x, y: c.y, plant: c.plant } : pickEggSpot(), 1);
      if (c) { const i = G.eggClusters.indexOf(c); if (i >= 0) G.eggClusters.splice(i, 1); }
      if (keep[1]) G.players[1] = keep[1];      // player 2 keeps living
      UI.hint('egg');
      Reading.onStart();
    },
    onKeep: () => { UI.hint('adult'); },
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
      const ok = o && SaveGame.read(G, o, (s, layout) => makeGarden(s, layout), (players) => {
        G.players = [];
        players.forEach((po, i) => { const b = new Bug(G, po.species, i + 1); b.restore(po); G.players[i] = b; });
        if (!G.players.length) startLife(pickEggSpot(), 1);
      });
      if (!ok) newGarden(seed);
      G.cam.x = G.player.x; G.cam.y = G.player.y - 40; G.cam.zoom = G.player.cameraZoom();
      UI.hint(G.player.state === 'egg' ? 'egg' : G.player.state === 'flying' ? 'flying' : G.player.stage === 6 ? 'adult' : 'crawl');
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (Reading.on()) { if (!resume) Reading.onStart(); }
    else Voice.say(resume ? 'Welcome back to your garden!' : (settings.reading === 'simple' ? 'You are an egg. Tap space lots of times to hatch!' : 'You are an egg on a leaf. Press space again and again to wriggle out.'), { force: true });
    if (!resume) { UI.hint('egg'); setTimeout(() => Bus.emit('fact', 'plants'), 40000); }
    ensurePlayers();
  }

  /* ---------- events → hints ---------- */
  let hintTimer = 0;
  const p1only = (fn) => (p) => { if (!p || p.id === 1) fn(p); };
  Bus.on('hatched', p1only(() => { UI.hint('crawl'); hintTimer = 0; }));
  Bus.on('moltStart', p1only(() => UI.hint('molt')));
  Bus.on('molted', p1only(() => UI.hint(G.player.stage === 4 ? 'biggest' : 'crawl')));
  Bus.on('readyPupa', p1only(() => UI.hint('readyPupa')));
  Bus.on('pupated', p1only(() => UI.hint('pupa')));
  Bus.on('eclosed', p1only(() => UI.hint('fresh')));
  Bus.on('wingsDry', p1only(() => UI.hint(G.garden.season === 'winter' ? 'winter' : 'adult')));
  Bus.on('takeoff', p1only(() => UI.hint(G.garden.season === 'winter' ? 'winter' : 'flying')));
  Bus.on('landed', p1only((p) => UI.hint(p.readyFlag ? 'readyEggs' : (p.plant.aphids.count() < 6 ? 'otherPlant' : 'adult'))));
  Bus.on('readyEggs', p1only(() => UI.hint('readyEggs')));
  /* the choice waits for the eggs page (Read to Play) and any cinematic to finish */
  const openChoice = () => { if (Reading.busy() || Cinematic.active) setTimeout(openChoice, 800); else UI.choice(); };
  Bus.on('eggsLaid', (c, p) => { if (p.id !== 1) return; G.lastCluster = c; setTimeout(openChoice, 3200); });
  Bus.on('eat', (p) => { if (p.id === 1 && p.state === 'larva' && p.eaten === 3 && p.stage === 1) UI.hint('branch'); });
  Bus.on('hibernate', p1only(() => UI.hint('hibernating')));
  Bus.on('wake', p1only(() => UI.hint('spring')));
  Bus.on('gust', () => { if (chance(.5)) Bus.emit('fact', 'gust'); });
  Bus.on('landed', (p) => { if (p.plant.type.key === 'milkweed') Bus.emit('fact', 'milkweed'); });
  Bus.on('birdScare', p1only(() => UI.hint('birdScare')));
  Bus.on('season', (s) => { AudioFX.season(s === 'spring' || s === 'summer'); if (s === 'winter') { for (const p of G.players) if (p.stage === 6) UI.hint('winter'); } });
  Bus.on('eat', (p) => { if (p.plant.aphids.honeydew.length > 3) Bus.emit('fact', 'honeydew'); });
  Bus.on('eat', (p, kind) => { if (kind === 'scale') Bus.emit('fact', 'scale'); });

  /* ---------- debug jumps (?stage=L3 etc.) ---------- */
  function applyDebug() {
    if (params.has('season')) { const g = G.garden; const idx = SEASONS.indexOf(params.get('season')); if (idx >= 0) { g.dayOfYear = idx * DAYS_PER_SEASON + 1 + (+params.get('sday') || 0); g.updateSeason(); g.seasonChanged = false; g.weather.snow = g.season === 'winter' ? 1 : 0; } }
    if (params.has('weather')) { const w = params.get('weather'); const wx = G.garden.weather; wx.state = w; wx.timer = 30; if (w === 'rain') { wx.rain = 1; wx.cloud = 1; } if (w === 'clearing') { wx.rainbow = 1; wx.cloud = .3; } }
    if (params.has('bird')) { G.bird.timer = 1; }
    const st = params.get('stage');
    if (!st) return;
    const p = G.player;
    const idx = STAGES.findIndex(s => s.key === st);
    if (st === 'flying') { p.stage = 6; p.state = 'flying'; p.fresh = 0; p.x = p.plant.ox; p.y = -700; p.vx = 60; p.vy = 0; p.open = 1; p.flownOnce = true; }
    else if (st === 'pupa') { p.stage = 4; p.state = 'larva'; p.readyFlag = true; p.pupaSpot = p.eggSpot; p.pupate(); Cinematic.stop(); }
    else if (st === 'adult') { p.stage = 6; p.state = 'adult'; p.fresh = +(params.get('fresh') || 0); p.spotMoment = true; p.flownOnce = true; }
    else if (st === 'hibernating') { p.stage = 6; p.hibernate(); Cinematic.stop(); }
    else if (idx > 0) { p.stage = idx; p.state = 'larva'; }
    if (params.has('eaten')) p.eaten = +params.get('eaten');
    if (params.has('total')) p.total = +params.get('total');
    if (params.has('p2') && G.players[1]) { const q = G.players[1]; q.stage = p.stage; q.state = p.state; q.fresh = p.fresh; q.x = p.x + 120; q.y = p.y; }
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  let frames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = clamp((now - last) / 1000, 0, .05);
    last = now;
    if (document.hidden) return;

    Cinematic.update(rawDt);
    const dt = rawDt * Cinematic.timeScale;
    const players = G.players;
    const modal = UI.anyModalOpen();

    if (G.started && !modal) readInput();
    else for (const p of players) { p.input.x = p.input.y = 0; }
    if (G.started && modal && Reading.busy()) Reading.gamepad(Gamepads.poll());

    /* ----- the calendar ----- */
    const g = G.garden;
    const hibernating = players.length && players.every(p => p.state === 'hibernating');
    if (settings.clock && !modal) {
      const pupating = players.some(p => p.state === 'pupa' || p.state === 'eclosing');
      const rate = hibernating ? 60 : pupating ? 16 : 1;
      const prevTod = G.tod;
      G.tod = (G.tod + dt / DAY_LENGTH * rate) % 1;
      if (G.tod < prevTod) {
        G.day++;
        const mayAdvance = players.every(p => p.stage === 6 || p.state === 'hibernating');
        g.endDay(mayAdvance);
        if (hibernating && g.season === 'spring') { for (const p of players) if (p.state === 'hibernating') p.wake(); G.tod = .3; }
      }
      if (Render.nightAmount(G.tod) > .8 && !nightFactDone) { nightFactDone = true; Bus.emit('fact', 'night'); }
      document.getElementById('sTod').value = Math.round(G.tod * 100);
    }
    G.time += dt;
    g.update(dt, G.tod);

    /* autumn: leaves let go */
    if (g.season === 'autumn' && chance(dt * 1.5)) {
      const P = pick(g.plants), bare = g.bareness();
      const cands = P.leaves.filter(l => l.fall < bare && l.fall > bare - .08);
      if (cands.length) { const lf = pick(cands); const p = P.posOn(lf.seg, lf.t); G.particles.fallingLeaf(lf, p.x + Math.cos(lf.ang) * lf.size * .5, p.y + Math.sin(lf.ang) * lf.size * .5, { key: 'autumn', tint: '#e0a030', amount: .8 }); }
    }

    if (G.started && !modal) {
      const diff = DIFFICULTY[settings.difficulty];
      const env = { raining: g.weather.raining, birth: SEASON_INFO[g.season].birth * (g.weather.raining ? .5 : 1), cold: g.season === 'winter' };
      for (const p of players) p.update(dt);
      for (const P of g.plants) {
        P.aphids.update(dt, players, diff, env);
        P.ants.update(dt, players);
        P.npcs.update(dt, env);
      }
      G.bird.update(dt, players, G.tod, g.season);
      for (const c of G.eggClusters) if (c.fresh) { c.fresh -= dt / 90; if (c.fresh <= 0) { c.fresh = 0; c.hatched = 1; } }
      hintTimer += dt;
      const p = G.player;
      if (p.state === 'larva' && hintTimer > 18 && p.stage === 1 && p.eaten < 2) { UI.hint('branch'); hintTimer = -1e9; }
      Journal.update(dt);
      Reading.update(dt);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; SaveGame.write(G); }
    }
    G.particles.update(dt);

    /* ----- camera ----- */
    const cine = Cinematic.camera();
    if (cine) G.cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (players.length > 1) {
      const a = players[0], b = players[1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const span = Math.max(Math.abs(a.x - b.x) + 300, (Math.abs(a.y - b.y) + 260) * (W / H));
      const z = clamp(Math.min(W / span, a.cameraZoom()), .35, 2);
      G.cam.follow(mx, my - 20, z * G.userZoom);
    } else {
      const p = G.player;
      const look = p.state === 'flying' ? 0 : 30 / Math.max(.5, G.cam.zoom);
      G.cam.follow(p.x + (p.state === 'flying' ? p.vx * .15 : 0), p.y - look, p.cameraZoom() * G.userZoom);
    }
    G.cam.update(rawDt, g.bounds);

    Render.frame(G, dt);
    if (params.has('debug')) { frames++; document.title = `t=${G.time.toFixed(2)} tod=${G.tod.toFixed(3)} day=${G.day} ${g.season} frames=${frames} state=${G.player.state} fps=${Render.getFps().toFixed(0)}`; }
    if (G.started) UI.update();
    AudioFX.update(dt, Render.nightAmount(G.tod), players.some(p => p.state === 'flying'), .5 + .5 * Math.sin(G.time * .3) + g.weather.gust, g.weather.rain);
    drawTitle(rawDt);
  }
  let nightFactDone = false;

  /* ---------- title backdrop ---------- */
  const tc = document.getElementById('titleCanvas');
  const tctx = tc.getContext('2d');
  const titleBugs = [];
  for (let i = 0; i < 7; i++) titleBugs.push({ x: Math.random(), y: Math.random(), a: rnd(TAU), sp: rnd(.02, .05), s: rnd(.9, 1.6), key: pick(Object.keys(SPECIES)), ph: rnd(TAU) });
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    tctx.save();
    tctx.globalAlpha = .55;
    for (let i = 0; i < 5; i++) {
      const x = (i / 5) * W + Math.sin(G.time * .3 + i) * 20, y = H * .8 + Math.cos(G.time * .4 + i) * 10;
      tctx.save(); tctx.translate(x, y); tctx.rotate(-1.2 + i * .15);
      const lf = { variant: i % 4, size: 260, curl: .1, ang: 0, phase: i, petiole: 30, shape: ['ovate', 'lance', 'heart'][i % 3], fall: 1 };
      Sprites.drawLeaf(tctx, lf, 0, 0, G.time, false);
      tctx.restore();
    }
    tctx.restore();
    for (const b of titleBugs) {
      b.a += Math.sin(G.time * .7 + b.ph) * dt * .8;
      b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt;
      if (b.x < -.1) b.x = 1.1; if (b.x > 1.1) b.x = -.1; if (b.y < -.1) b.y = 1.1; if (b.y > 1.1) b.y = -.1;
      tctx.save();
      tctx.translate(b.x * W, b.y * H);
      tctx.rotate(b.a);
      tctx.globalAlpha = .9;
      Sprites.drawAdult(tctx, { s: b.s, species: SPECIES[b.key], open: 1, wingPhase: G.time * 50 + b.ph, walk: 0 });
      tctx.restore();
    }
  }

  /* ---------- save on leave, install offline ---------- */
  addEventListener('visibilitychange', () => { if (document.hidden) SaveGame.write(G); });
  addEventListener('beforeunload', () => SaveGame.write(G));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline install is optional */ });
  }

  /* ---------- go ---------- */
  Render.init(canvas);
  resize();
  Render.setQuality(settings.quality === 'low' ? 'low' : 'high');
  newGarden(seed);
  if (params.has('tod')) { G.tod = +params.get('tod'); }
  if (params.has('labels')) { settings.labels = true; }
  if (params.has('pad')) { settings.pad = true; }
  if (params.has('p2')) { settings.p2 = true; ensurePlayers(); }
  if (params.has('read')) { settings.reading = params.get('read'); }
  if (params.has('zoom')) { G.userZoom = +params.get('zoom'); G.cam.zoom = G.cam.tzoom = G.player.cameraZoom() * G.userZoom; }
  if (params.has('quality')) { settings.quality = params.get('quality'); }
  if (params.has('readlevel')) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  applyDebug();
  if (params.has('stage')) { G.cam.x = G.player.x; G.cam.y = G.player.y - 40; if (!params.has('zoom')) G.cam.zoom = G.player.cameraZoom(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { start(false); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'L2' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'larva');
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'science') { settings.science = true; UI.refreshToggles(); }
      else if (o === 'drawer') document.getElementById('drawer').hidden = false;
      else if (o === 'choice') document.getElementById('choice').hidden = false;
    }, 50);
  }
  /* Read to Play debug: ?readlevel=B&readpage=pupa&gate=1&readtask=1 · &readcard=1 · &mission=1 · &mywords=1 */
  if (params.has('mission')) Reading._missionNow();
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'aphid', 'go', 'up', 'little', 'big', 'eat', 'fly', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.freeze = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  if (params.has('readpage')) setTimeout(() => { Reading._solveGate(); Reading.showPage(params.get('readpage'), { gate: params.has('gate') }); }, 80);
  if (params.has('readcard')) setTimeout(() => { Reading._solveGate(); G.player.input.actionPressed = true; Reading.intercept(G.player); }, 120);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); nx && nx.click(); }, 400);
  requestAnimationFrame(loop);
})();
