/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings ---------- */
  const DEFAULTS = {
    species: 'green', difficulty: 'normal', nymphs: true, heron: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true, p2: false, gpP2: false,
    quality: 'auto', science: false, hazards: true, anytravel: false, readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto', readMic: false, readSave: true, stories: true, rhythm: true, tilt: false, easyfont: false, keeperAny: false
  };
  let settings;
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(pkey('settings')) || '{}')); } catch (e) { settings = Object.assign({}, DEFAULTS); }
  const saveSettings = () => { try { localStorage.setItem(pkey('settings'), JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, pond: null, cam: new Camera(), players: [], heron: null, chorus: null,
    algae: null, wrigglers: null, bugs: null, nymphs: null, minnows: null, snails: null,
    particles: new Particles(), eggMasses: [],
    time: 0, tod: .36, day: 1, generation: 1, started: false, userZoom: 1, night: 0, lastMass: null,
    speciesDef() { return SPECIES[settings.species] || SPECIES.green; },
    get player() { return this.players[0]; }
  };
  window.G = G;

  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1;
  let saveClock = 8;
  let underwaterAmt = 0;

  function makePond(newSeed, place = 'home') {
    if (newSeed !== undefined) seed = newSeed;
    G.eggStore = {};
    Places.build(G, seed, place);
    G.lastMass = null;
    applyDifficulty();
  }

  function newPond(newSeed, place) {
    makePond(newSeed, place);
    G.players = [];
    startLife(pickEggSpot(), 1);
    ensurePlayers();
    snapCamera();
  }
  function snapCamera() { G.cam.x = G.cam.tx = G.player.x; G.cam.y = G.cam.ty = G.player.y; G.cam.zoom = G.cam.tzoom = G.player.cameraZoom() * G.userZoom; }

  function pickEggSpot() {
    const s = pick(G.pond.spawnSpots);
    return { x: s.x + rnd(-10, 10), y: s.y };
  }

  /* A fresh frog starting as an egg at the given spot. */
  function startLife(spot, id = 1, speciesKey) {
    const f = new Frog(G, speciesKey || settings.species, id);
    f.placeEgg(spot);
    G.players[id - 1] = f;
    if (id === 1) { UI.hint('egg'); hintTimer = 0; }
    return f;
  }

  function ensurePlayers() {
    if (settings.p2 && G.players.length < 2) {
      const p1 = G.players[0];
      const spot = p1.eggSpot ? { x: p1.eggSpot.x + 14, y: p1.eggSpot.y } : pickEggSpot();
      const other = Object.keys(SPECIES).filter(k => k !== settings.species);
      startLife(spot, 2, pick(other));
    } else if (!settings.p2 && G.players.length > 1) {
      G.players.length = 1;
    }
  }

  function applyDifficulty() {
    const d = DIFFICULTY[settings.difficulty];
    if (G.nymphs) { G.nymphs.enabled = settings.nymphs && d.nymphs; G.nymphs.setCount(settings.difficulty === 'hard' ? 3 : 2); }
    if (G.heron) G.heron.enabled = settings.heron && d.heron;
    if (G.hazards) G.hazards.enabled = settings.hazards && d.hazards;
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
    if (k === ' ' || k === 'Enter') { if (!e.repeat) p1.input.actionPressed = true; e.preventDefault(); }
    if (K === 'e' && !e.repeat) p1.input.singPressed = true;
    if (p2) { if (K === 'u' && !e.repeat) p2.input.actionPressed = true; if (K === 'o' && !e.repeat) p2.input.singPressed = true; }
    if (K === 'l') toggle('labels');
    if (K === 'm') toggle('sound');
    if (K === 'v') toggle('voice');
    if (K === 'p') photo();
    if (K === 'y') { if (Microscope.isOpen()) Microscope.close(); else Microscope.open(G); }
    if (K === 'b') UI.openStickers();
    if (K === 'g') FieldGuide.open();
    if (K === 't') Story.openBook();
    if (K === 'j') UI.openJournal();
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') UI.closeModals();
    if (k.startsWith('Arrow')) e.preventDefault();
    if (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown || keys.a || keys.d || keys.w || keys.s) p1.goal = null;
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
    const p1 = G.players[0];
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1;
    if (keys.ArrowRight || keys.d) x += 1;
    if (keys.ArrowUp || keys.w) y -= 1;
    if (keys.ArrowDown || keys.s) y += 1;
    x += inputState.padX; y += inputState.padY;
    if (settings.tilt) { x += Tilt.x; y += Tilt.y; }
    const g1 = padFor(1);
    if (g1) { x += g1.x; y += g1.y; if (g1.actionPressed) p1.input.actionPressed = true; if (g1.singPressed) p1.input.singPressed = true; if (g1.photoPressed) photo(); if (g1.scopePressed) Microscope.open(G); }
    /* tap-to-swim goal */
    if (p1.goal && Math.hypot(x, y) < .1) {
      const gl = p1.goal, dx = gl.x - p1.x, dy = gl.y - p1.y, d = Math.hypot(dx, dy);
      if (d < 14 || !(p1.inWater() || p1.isTadpole())) p1.goal = null;
      else { x = dx / d; y = dy / d; }
    }
    let m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    p1.input.x = x; p1.input.y = y;
    p1.input.action = !!(keys[' '] || inputState.padAction || (g1 && g1.action));
    const p2 = G.players[1];
    if (p2) {
      let x2 = 0, y2 = 0;
      if (keys.j) x2 -= 1; if (keys.l) x2 += 1; if (keys.i) y2 -= 1; if (keys.k) y2 += 1;
      const g2 = padFor(2);
      if (g2) { x2 += g2.x; y2 += g2.y; if (g2.actionPressed) p2.input.actionPressed = true; if (g2.singPressed) p2.input.singPressed = true; }
      m = Math.hypot(x2, y2); if (m > 1) { x2 /= m; y2 /= m; }
      p2.input.x = x2; p2.input.y = y2;
      p2.input.action = !!(keys.u || (g2 && g2.action));
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
      if (on && G.player) G.player.goal = null;
    };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
    b.addEventListener('pointerup', () => set(false));
    b.addEventListener('pointercancel', () => set(false));
    b.addEventListener('lostpointercapture', () => set(false));
  });
  document.getElementById('btnAction').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started) G.player.input.actionPressed = true; inputState.padAction = true; });
  document.getElementById('btnAction').addEventListener('pointerup', () => { inputState.padAction = false; });
  document.getElementById('btnAction').addEventListener('pointercancel', () => { inputState.padAction = false; });
  document.getElementById('btnSing').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started) G.player.input.singPressed = true; });

  /* tap the water to swim there; tap while perched to hop that way */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    const held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    if (Keeper.tap(wx, wy)) return;
    const p = G.player;
    if (p.state === 'egg' || p.state === 'hibernating') { p.input.actionPressed = true; return; }
    if (p.isTadpole() || (p.isFrogLike() && p.mode === 'water')) { p.goal = { x: wx, y: Math.max(wy, G.pond.surfaceAt(wx) + 8) }; return; }
    if (p.isFrogLike() && p.mode === 'perch') { if (p.target) { p.input.actionPressed = true; return; } p.input.x = sign(wx - p.x); p.tapHop = 2; }
  });
  canvas.addEventListener('wheel', (e) => {
    G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .9 : 1.1), .35, 2.2);
    if (G.userZoom < .6) Bus.emit('fact', 'pond');
    e.preventDefault();
  }, { passive: false });

  /* ---------- toggles ---------- */
  function toggle(key) {
    switch (key) {
      case 'labels': settings.labels = !settings.labels; break;
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'voice': settings.voice = !settings.voice; Voice.setEnabled(settings.voice); if (settings.voice) Voice.say('Reading aloud is on.', { force: true }); break;
      case 'nymphs': settings.nymphs = !settings.nymphs; applyDifficulty(); break;
      case 'heron': settings.heron = !settings.heron; applyDifficulty(); break;
      case 'hazards': settings.hazards = !settings.hazards; applyDifficulty(); break;
      case 'anytravel': settings.anytravel = !settings.anytravel; break;
      case 'stories': settings.stories = !(settings.stories !== false); break;
      case 'rhythm': settings.rhythm = !(settings.rhythm !== false); if (!settings.rhythm) Rhythm.stop(); break;
      case 'easyfont': settings.easyfont = !settings.easyfont; break;
      case 'keeperAny': settings.keeperAny = !settings.keeperAny; break;
      case 'readMic':
        if (!settings.readMic) { micOn(); AudioFX.click(); return; }   /* turning it on asks a grown-up first */
        settings.readMic = false; break;
      case 'readSave': settings.readSave = !(settings.readSave !== false); break;
      case 'tilt': settings.tilt = !settings.tilt; if (settings.tilt) Tilt.enable(); else Tilt.disable(); break;
      case 'slowmo': settings.slowmo = !settings.slowmo; break;
      case 'pad': settings.pad = !settings.pad; break;
      case 'clock': settings.clock = !settings.clock; break;
      case 'science': settings.science = !settings.science; break;
      case 'p2': settings.p2 = !settings.p2; ensurePlayers(); UI.hint(settings.p2 ? 'Player 2 joined! IJKL to move, U for action, O to sing.' : 'Player 2 left the pond.'); break;
      case 'gpP2': settings.gpP2 = !settings.gpP2; break;
    }
    saveSettings();
    UI.refreshToggles();
    AudioFX.click();
  }
  /* in Chrome and Edge the microphone's audio goes to an online speech service */
  async function micOn() {
    if (!(await Grownups.confirmMicrophone())) { UI.refreshToggles(); return; }
    settings.readMic = true; if (!Listener.supported()) UI.hint('This browser cannot listen. Try Chrome.');
    saveSettings();
    UI.refreshToggles();
  }

  function photo() {
    if (!G.started) return;
    const found = Safari.evaluate(G);
    const thumb = Journal.photo(() => Render.snapshot(G));
    const best = Safari.file(found, thumb);
    if (best) { const ch = SAFARI.find(c => c.key === best.key); setTimeout(() => UI.hint(`📷 Safari: ${settings.reading === 'simple' ? ch.simple : ch.name}! ${'★'.repeat(best.stars)}`), 900); }
    document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 300);
    AudioFX.shutter && AudioFX.shutter();
    UI.hint(settings.reading === 'simple' ? '📷 Snap! Saved to your journal.' : '📷 Snap! Saved to your journal and downloaded.');
  }

  /* ---------- UI wiring ---------- */
  UI.init(G, {
    onStart: start,
    onSpecies: (k) => {
      settings.species = k; saveSettings();
      if (G.player && G.player.stage < 5) G.player.species = SPECIES[k];
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
      const g = G.pond;
      const cur = Math.floor((g.dayOfYear - 1) / DAYS_PER_SEASON);
      if (cur >= 3) { g.toSpring(); for (const p of G.players) if (p.state === 'hibernating') p.wake(); }
      else { g.dayOfYear = (cur + 1) * DAYS_PER_SEASON + 1; g.updateSeason(); }
      G.day++;
    },
    onNewPond: () => { UI.resetFacts(); G.generation = 1; G.day = 1; G.tod = .36; newPond((Math.random() * 1e9) | 0); UI.hint('egg'); SaveGame.write(G); },
    onRestart: () => { UI.resetFacts(); G.generation = 1; G.players = []; startLife(pickEggSpot(), 1); ensurePlayers(); },
    onHatchNext: () => {
      const m = G.lastMass;
      G.generation++;
      Stickers.setGeneration(G.generation);
      const keep = G.players.slice();
      G.players = [];
      startLife(m ? { x: m.x, y: m.y } : pickEggSpot(), 1);
      if (m) { const i = G.eggMasses.indexOf(m); if (i >= 0) G.eggMasses.splice(i, 1); G.lastMass = null; }
      if (keep[1]) G.players[1] = keep[1];
      UI.hint('egg');
    },
    onKeep: () => { UI.hint('frog'); },
    onPhoto: photo
  });
  Stickers.init(UI.onSticker);
  Journal.init(G);
  FieldGuide.init(G);
  Story.init(G);
  Rhythm.init(G);
  Keeper.init(G);
  GrownupCorner.init(G);
  Grownups.guardOutboundLinks();   /* "See the real thing ↗" and other websites ask a grown-up first */
  Reading.init(G, { saveSettings });
  Recorder.init(G);
  buildProfiles();
  Voice.init();
  Voice.setEnabled(settings.voice);

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s, pl) => makePond(s, pl), (players) => {
        G.players = [];
        players.forEach((po, i) => { const f = new Frog(G, po.species, i + 1); f.restore(po); G.players[i] = f; });
        if (!G.players.length) startLife(pickEggSpot(), 1);
      });
      if (!ok) newPond(seed);
      snapCamera();
      const p = G.player;
      UI.hint(p.state === 'egg' ? 'egg' : p.stage === 3 ? 'breathe' : p.isTadpole() ? 'swim' : p.stage === 4 ? 'froglet' : p.state === 'hibernating' ? 'hibernating' : 'frog');
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    Voice.say(resume ? 'Welcome back to your pond!' : (settings.reading === 'simple' ? 'You are an egg in the jelly. Tap space lots of times to hatch!' : 'You are an egg in a jelly mass in the shallows. Press space again and again to wriggle out.'), { force: true });
    if (!resume && G.player.state === 'egg') setTimeout(() => Story.open('egg'), 1200);
    if (!resume) { if (G.player.state === 'egg') UI.hint('egg'); setTimeout(() => Bus.emit('fact', 'pond'), 60000); }
    ensurePlayers();
  }

  /* ---------- events → hints and facts ---------- */
  let hintTimer = 0, nymphHintAt = -1e9, nightHinted = false, herons = 0;
  const p1only = (fn) => (p) => { if (!p || p.id === 1) fn(p); };
  Bus.on('hatched', p1only(() => { UI.hint('swim'); hintTimer = 0; }));
  Bus.on('eat', (p, kind) => { if (p.id !== 1) return; if (kind === 'algae' && p.total === 1) Bus.emit('fact', 'algae'); if (kind === 'wriggler' && p.stats.wrigglers === 1) Bus.emit('fact', 'wriggler'); if (p.isTadpole() && p.total === 3) UI.hint('algae'); });
  Bus.on('legs', p1only(() => { UI.hint('legs'); setTimeout(() => UI.hint('wriggler'), 12000); }));
  Bus.on('arms', p1only(() => UI.hint('breathe')));
  Bus.on('needAir', p1only(() => UI.hint('breathe')));
  Bus.on('froglet', p1only(() => UI.hint('froglet')));
  Bus.on('climbedOut', p1only(() => UI.hint('hop')));
  Bus.on('landedPad', p1only((p) => { if (p.stats.pads.size === 1) UI.hint('hop'); }));
  Bus.on('frog', p1only(() => { UI.hint('frog'); setTimeout(() => Bus.emit('fact', 'skin'), 35000); }));
  Bus.on('readyEggs', p1only(() => UI.hint('readyEggs')));
  Bus.on('layingStart', p1only(() => UI.hint('laying')));
  Bus.on('eggsLaid', (m, p) => { if (p.id !== 1) return; G.lastMass = m; setTimeout(() => UI.choice(), 3400); });
  Bus.on('heronWarning', () => { UI.hint(G.player.species.special === 'cling' && G.player.stage >= 4 && chance(.5) ? 'cling' : 'heron'); if (++herons === 1) setTimeout(() => Bus.emit('fact', 'heron'), 6000); });
  Bus.on('heronScare', p1only(() => UI.hint('heronScared')));
  Bus.on('heronSafe', p1only((p) => UI.hint({ deep: 'deep', statue: 'The heron never saw you. Statue!', pad: 'Safe under the lily pad!', reeds: 'Safe in the reeds! It could not see you.', cling: 'Safe! It could not reach you up there.' }[p.safeReason()])));
  Bus.on('nymphWarn', (p) => { if (p.id !== 1) return; if (G.time - nymphHintAt > 20) { nymphHintAt = G.time; UI.hint('burst'); } if (!nymphWarned) { nymphWarned = true; setTimeout(() => Bus.emit('fact', 'nymph'), 5000); } });
  let nymphWarned = false;
  Bus.on('nymphHit', p1only(() => UI.hint('nymphScared')));
  Bus.on('nymphMiss', (p) => { if (p && p.id === 1 && p.burst > .2 && !Cinematic.active) Cinematic.play({ follow: () => ({ x: p.x, y: p.y }), zoom: 2.3, duration: 1.1, slow: .3, title: '' }); });
  Bus.on('heronLanded', (h) => { const p = G.player; if (p && Math.abs(p.x - h.x) < 1500 && !Cinematic.active) Cinematic.play({ x: h.x - h.dir * 120, y: h.y - 30, zoom: .85, duration: 2.4, slow: .6, title: 'A heron' }); });
  Bus.on('burst', p1only((p) => { if (p.stats.bursts === 3) Bus.emit('fact', 'burst'); }));
  Bus.on('snap', p1only((p) => { if (p.stats.snaps === 1) setTimeout(() => UI.hint('hop'), 2500); }));
  Bus.on('sing', p1only((p) => { if (p.stats.sang === 1) Bus.emit('fact', 'sing'); }));
  Bus.on('chorusAnswer', (n) => { if (n === 1) Bus.emit('fact', 'chorus'); });
  Bus.on('hibernate', p1only(() => UI.hint('hibernating')));
  Bus.on('wake', p1only(() => UI.hint('spring')));
  Bus.on('season', (s) => {
    AudioFX.season(SEASON_INFO[s].warm);
    Bus.emit('fact', s);
    if (s === 'winter') { const p = G.player; UI.hint(p.stage === 5 ? (p.species.special === 'freeze' ? 'winterWood' : 'winter') : 'winter'); }
    else if (s === 'spring') UI.hint('spring');
    else if (s === 'autumn') UI.hint('autumnHint');
    else UI.hint(SEASON_INFO[s].name + '! ' + SEASON_INFO[s].blurb);
  });
  Bus.on('weather', (w) => { if (w === 'rain') { UI.hint('rain'); Bus.emit('fact', 'rain'); } });
  Bus.on('iceBreak', () => { AudioFX.iceCrack && AudioFX.iceCrack(); for (let i = 0; i < 20; i++) G.particles.sparkle(rnd(-G.pond.W, G.pond.W), -4, 2, '#dff6ff', 10); });
  /* ---------- phase 4: events, rhythm, safari, keeper, stories ---------- */
  Bus.on('mayflyHatch', () => { Bus.emit('fact', 'mayfly'); UI.hint(settings.reading === 'simple' ? 'The mayflies are hatching! Snap them!' : 'The mayflies are hatching! A feast for every frog.'); const p = G.player; if (!Cinematic.active) Cinematic.play({ x: p.x, y: -60, zoom: .8, duration: 3, slow: .5, title: 'The mayfly hatch' }); });
  Bus.on('bigNight', () => { Bus.emit('fact', 'bignight'); UI.hint(settings.reading === 'simple' ? 'The big night! Frogs came from everywhere!' : 'The big night: frogs are arriving from all over to sing.'); if (!Cinematic.active) Cinematic.play({ x: G.cam.x, y: -40, zoom: .7, duration: 3, slow: .6, title: 'The big night' }); });
  Bus.on('firstFrost', () => { Bus.emit('fact', 'frost'); UI.hint(settings.reading === 'simple' ? 'Frost! Everything sparkles.' : 'First frost. Winter is on its way.'); });
  Bus.on('ladybugVisit', () => setTimeout(() => { UI.hint(settings.reading === 'simple' ? 'A ladybug flew in from the garden!' : 'A ladybug has flown over from the garden. Frogs will not eat it.'); Bus.emit('fact', 'ladybug'); }, 4000));
  Bus.on('rhythmStart', () => UI.hint(settings.reading === 'simple' ? 'Sing along! Press E on the yellow beats.' : 'The chorus is singing with you. Press E on the yellow beats, between their calls.'));
  Bus.on('rhythmWin', () => { UI.hint(settings.reading === 'simple' ? 'The whole pond is singing with you!' : 'Eight in a row! The whole pond joins in, and a frog hops over to you.'); G.cam.punch = 1; });
  Bus.on('duet', () => UI.hint(settings.reading === 'simple' ? 'A duet! You sang together!' : 'A duet! Two frogs singing together.'));
  /* newly found creatures pop up one at a time */
  const guideQueue = []; let guideNextAt = 0;
  Bus.on('guideNew', (k) => guideQueue.push(k));
  function guideTick() { if (!guideQueue.length || G.time < guideNextAt) return; const k = guideQueue.shift(); guideNextAt = G.time + 1.3; G.particles.text(G.player.x, G.player.y - 48, '🔍 ' + GUIDE[k].name, '#bff0ff', 15); AudioFX.bubble && AudioFX.bubble(1.6, .06); }
  Bus.on('year', () => {});
  /* travelling between places */
  let travelHintAt = -1e9;
  Bus.on('wantTravel', (p, dest) => {
    G.travelling = { dest, t: 0, done: false };
    G.fadeTitle = PLACES[dest.kind].name;
    AudioFX.splash && dest.how !== 'overland' && AudioFX.splash(.8);
  });
  Bus.on('travelRefused', () => { if (G.time - travelHintAt > 20) { travelHintAt = G.time; UI.hint('travelRain'); Bus.emit('fact', 'migrate'); } });
  Bus.on('travel', (kind, how) => { Bus.emit('fact', kind === 'home' ? 'pond' : kind); if (how === 'overland') Bus.emit('fact', 'migrate'); UI.hint(settings.reading === 'simple' ? PLACES[kind].simple + '!' : PLACES[kind].name + '. ' + PLACES[kind].blurb); SaveGame.write(G); });
  /* the neighbours and the new hazards */
  Bus.on('turtleSlide', () => { UI.hint('plop'); Bus.emit('fact', 'turtle'); });
  Bus.on('snakeOut', () => Bus.emit('fact', 'snake'));
  Bus.on('snakeWarning', p1only(() => UI.hint('snake')));
  Bus.on('snakeScare', p1only(() => UI.hint('snakeScared')));
  Bus.on('snakeSafe', p1only(() => UI.hint('The snake slid right past. Statue!')));
  Bus.on('raccoonOut', () => Bus.emit('fact', 'raccoon'));
  Bus.on('raccoonWarning', p1only(() => UI.hint('raccoon')));
  Bus.on('raccoonScare', p1only(() => UI.hint('raccoonScared')));
  Bus.on('raccoonYuck', p1only(() => { UI.hint('yuck'); Bus.emit('fact', 'toad'); }));
  Bus.on('raccoonSafe', p1only(() => UI.hint('Safe! The raccoon cannot reach that deep.')));
  Bus.on('fishOut', () => Bus.emit('fact', 'fish'));
  Bus.on('fishWarning', p1only(() => UI.hint('fish')));
  Bus.on('fishScare', p1only(() => UI.hint('fishScared')));
  Bus.on('fishSafe', p1only(() => UI.hint('fishSafe')));
  Bus.on('wildHatch', (m, n) => { Bus.emit('fact', 'wildhatch'); if (m === G.lastMass || !m.wild) UI.hint(settings.reading === 'simple' ? 'Your eggs hatched! Look at all the tadpoles.' : 'Your eggs hatched into a crowd of tadpoles. Watch them grow.'); });
  Bus.on('seen', (k) => { if (['strider', 'caddis', 'boatman', 'newt', 'leech'].includes(k)) Bus.emit('fact', k); });
  Bus.on('froglet', (p) => { if (p.species.special === 'toad') { if (G.pond.weather.raining) G.neighbours.parade(p); else pendingParade = true; } });
  Bus.on('weather', (w) => { if (w === 'rain' && pendingParade) { pendingParade = false; G.neighbours.parade(G.player); } });
  Bus.on('toadParade', p1only(() => { UI.hint('parade'); Bus.emit('fact', 'parade'); }));
  Bus.on('season', (s) => { if (s === 'spring') { for (const sp of G.pond.spawnSpots) if (chance(.7)) { const f = pick(G.chorus.frogs); G.eggMasses.push({ x: sp.x + rnd(-30, 30), y: sp.y, count: 16, seed: rndInt(1, 999), laidAt: G.time, side: sp.side, wild: true, species: f.species.key, string: f.species.eggs === 'string' }); } } });
  Bus.on('dragonflyEmerged', () => UI.hint(settings.reading === 'simple' ? 'A dragonfly came out of a nymph! Frogs can snap those too.' : 'A nymph just climbed a reed and turned into a dragonfly. A frog can snap those, worth 3!'));

  /* ---------- debug jumps (?stage=froglet etc.) ---------- */
  function applyDebug() {
    const g = G.pond;
    if (params.has('season')) { const idx = SEASONS.indexOf(params.get('season')); if (idx >= 0) { g.dayOfYear = idx * DAYS_PER_SEASON + 1 + (+params.get('sday') || 0); g.updateSeason(); g.seasonChanged = false; if (g.season === 'winter') { g.weather.ice = +(params.get('ice') || 1); g.weather.snow = 1; for (const p of g.pads) { p.health = 0; p.size = .3; } } if (g.season === 'autumn') for (const p of g.pads) p.health = 1 - smoothstep(.2, 1, g.seasonT); } }
    if (params.has('ice')) { g.weather.ice = +params.get('ice'); }
    if (params.has('weather')) { const w = params.get('weather'); const wx = g.weather; wx.state = w; wx.timer = 30; if (w === 'rain') { wx.rain = 1; wx.cloud = 1; } if (w === 'clearing') { wx.rainbow = 1; wx.cloud = .3; } }
    if (params.has('dry')) { g.weather.dry = +params.get('dry'); g.level = g.weather.dry * 46; g.updateWet(); }
    const heronDebug = () => { if (params.has('heron')) { G.heron.timer = .5; if (params.get('heron') === 'now') { G.heron.timer = 0; G.heron.update(.01, G.players, .5, g.season); G.heron.state = 'stalk'; G.heron.x = G.heron.toX; G.heron.y = G.heron.toY; G.heron.stalkT = params.get('stalk') !== null ? +params.get('stalk') : 0; } }  if (params.has('snake')) { const S = G.hazards.snake; S.state = 'out'; S.t = 0; S.side = sign(G.player.x || 1); S.x = S.side * (g.W + 160); S.dir = -S.side; } if (params.has('raccoon')) { const R = G.hazards.raccoon; R.state = 'pat'; R.t = +(params.get('raccoon')) || 0; R.side = sign(G.player.x || 1); R.x = R.side * (g.W + 26); R.dir = -R.side; R.pose = 'pat'; } if (params.has('fish')) { const F = G.hazards.fish; F.state = 'patrol'; F.x = (G.player.x || 0) - 200; F.y = 330; F.dir = 1; F.vx = 60; } };
    const st = params.get('stage');
    if (!st) { heronDebug(); return; }
    const p = G.player;
    const idx = STAGES.findIndex(s => s.key === st);
    const setFrog = (stage) => { p.stage = stage; p.state = stage === 4 ? 'froglet' : 'frog'; p.legs = 1; p.arms = 1; p.tail = 0; p.stub = stage === 4 ? .3 : 0; p.mode = 'water'; p.firsts = { hop: true, snap: true, pad: true }; p.y = g.surfaceAt(p.x) + 6; };
    if (st === 'froglet') setFrog(4);
    else if (st === 'frog') setFrog(5);
    else if (st === 'hibernating') { setFrog(5); p.hibernate(p.species.special === 'freeze' ? 'litter' : 'mud'); Cinematic.stop(); }
    else if (idx >= 1 && idx <= 3) { p.stage = idx; p.state = 'tadpole'; p.legs = idx >= 2 ? 1 : 0; p.arms = idx >= 3 ? 1 : 0; if (idx === 3) { p.tailT = +(params.get('tailT') || .3); p.tail = 1 - p.tailT * .97; } p.y = 60; p.vx = 30; }
    if (params.has('x')) p.x = +params.get('x');
    if (params.has('y')) p.y = +params.get('y');
    if (params.has('mode') && p.isFrogLike()) {
      const m = params.get('mode');
      if (m === 'pad') { const pad = g.pads.reduce((a, b) => Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b); p.x = pad.x; g.update(.016, G.tod, 0); p.perchOn({ kind: 'pad', pad, y: pad.y - 3 }); Cinematic.stop(); }
      if (m === 'land') { p.x = sign(p.x || 1) * (g.W + 80); p.perchOn({ kind: 'land', y: g.bedY(p.x) }); }
      if (m === 'log') { p.x = g.log.x; p.perchOn({ kind: 'log', y: g.logTop(p.x) }); }
      if (m === 'air') { p.mode = 'air'; p.y = -120; p.vx = 120; p.vy = -100; }
      if (m === 'cling') { p.mode = 'cling'; p.cling = g.clingReeds[1]; p.dir = -1; p.x = p.cling.x + 2; p.y = p.cling.y; }
    }
    if (params.has('eaten')) p.eaten = +params.get('eaten');
    if (params.has('total')) p.total = +params.get('total');
    if (params.has('ready')) { p.readyFlag = true; }
    if (params.has('tongue') && p.isFrogLike()) { const b = G.bugs.add('fly', p.x + 70, p.y - 30); p.target = b; p.targetKind = 'bug'; p.snap(); p.tongue.t = .3; Cinematic.stop(); }
    if (params.has('p2') && G.players[1]) { const q = G.players[1]; q.stage = p.stage; q.state = p.state; q.mode = p.mode; q.legs = p.legs; q.arms = p.arms; q.tail = p.tail; q.x = p.x + 90; q.y = p.y; }
    heronDebug();
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
    if (G.travelling) {
      const T = G.travelling; T.t += rawDt;
      G.fade = Math.min(1, T.t / .45);
      if (T.t >= .5 && !T.done) { T.done = true; Places.travel(G, T.dest.kind, T.dest.enter, T.dest.how); snapCamera(); }
      if (T.done) { G.fade = Math.max(0, 1 - (T.t - .9) / .7); if (T.t > 1.6) { G.travelling = null; G.fade = 0; } }
    }
    const players = G.players;
    const modal = UI.anyModalOpen();
    const g = G.pond;

    if (G.started && !modal) readInput();
    else if (G.started && Reading.busy()) Reading.gamepad(Gamepads.poll());
    else for (const p of players) { p.input.x = p.input.y = 0; }
    for (const p of players) if (p.tapHop) { p.tapHop--; if (!p.tapHop) p.input.x = 0; }

    /* ----- the calendar ----- */
    const hibernating = players.length && players.every(p => p.state === 'hibernating');
    let rate = 1;
    if (settings.clock && !modal) {
      const changing = players.some(p => p.stage === 3 && p.state === 'tadpole');
      rate = hibernating ? 60 : changing ? 5 : 1;
      const prevTod = G.tod;
      G.tod = (G.tod + dt / DAY_LENGTH * rate) % 1;
      if (G.tod < prevTod) {
        G.day++;
        const mayAdvance = players.every(p => p.stage === 5 || p.state === 'hibernating');
        g.endDay(mayAdvance);
        if (hibernating && g.season === 'spring' && g.weather.ice < .3) { for (const p of players) if (p.state === 'hibernating') p.wake(); G.tod = .3; }
      }
      if (hibernating && g.season === 'spring' && g.weather.ice < .3) { for (const p of players) if (p.state === 'hibernating') p.wake(); }
    if (!culvertHinted && G.place === 'home' && G.player && Math.abs(G.player.x - g.W) < 400 && G.player.y > 0 && (G.player.inWater() || G.player.isTadpole())) { culvertHinted = true; UI.hint('culvert'); Bus.emit('fact', 'culvert'); }
      const night = Render.nightAmount(G.tod);
      if (night > .8 && !nightFactDone) { nightFactDone = true; Bus.emit('fact', 'night'); }
      if (night > .6 && !nightHinted) { nightHinted = true; if (G.player.stage === 5 && G.player.state === 'frog') UI.hint('night'); }
      if (night < .2) nightHinted = false;
      document.getElementById('sTod').value = Math.round(G.tod * 100);
    }
    G.time += dt;
    g.update(dt, G.tod, G.night, rate);
    if (g.weather.ice > .05 && !iceFactDone) { iceFactDone = true; Bus.emit('fact', 'ice'); }

    /* autumn leaves onto the water, winter snow */
    if (g.season === 'autumn' && chance(dt * 1.2 * g.seasonT)) G.particles.leaf(rnd(-g.W - 300, g.W + 300), -520, pick(['#d9a24a', '#c9622a', '#b5742e', '#e0c060']));
    if (g.weather.snow > .1) { const v = G.cam.viewRect(100); for (let i = 0; i < 2 * g.weather.snow; i++) if (chance(.6)) G.particles.snow(rnd(v.l, v.r), v.t); }

    if (G.started && !modal) {
      const diff = DIFFICULTY[settings.difficulty];
      const info = SEASON_INFO[g.season];
      const env = { light: (1 - G.night * .85) * (1 - g.weather.cloud * .4) * (1 - g.weather.ice * .7), algae: info.algae, wrigglers: info.wrigglers, bugs: info.bugs, raining: g.weather.raining, cold: g.season === 'winter', night: G.night, season: g.season, time: G.time, tod: G.tod };
      for (const p of players) p.update(dt);
      G.algae.update(dt, env);
      G.wrigglers.update(dt, players, diff, env);
      G.bugs.update(dt, env, diff);
      G.nymphs.update(dt, players, diff, env);
      G.minnows.update(dt, players, env);
      G.snails.update(dt);
      G.heron.update(dt, players, G.tod, g.season);
      G.chorus.update(dt);
      G.neighbours.update(dt, players, env);
      G.events.update(dt, env);
      guideTick();
      Reading.update(dt);
      Rhythm.update(rawDt);
      GrownupCorner.tick(rawDt);
      G.hazards.update(dt, players, env);
      for (let i = G.eggMasses.length - 1; i >= 0; i--) {
        const m = G.eggMasses[i], age = G.time - (m.laidAt || 0);
        if (age > 100 && !m.hatchedWild) { m.hatchedWild = true; G.neighbours.hatch(m); }
        if (m !== G.lastMass && age > 170) G.eggMasses.splice(i, 1);
      }
      if (g.level > 24 && !dryHinted) { dryHinted = true; UI.hint('dry'); Bus.emit('fact', 'dryspell'); }
      if (g.level < 6) dryHinted = false;
      hintTimer += dt;
      const p = G.player;
      if (p.isTadpole() && p.stage === 1 && hintTimer > 20 && p.eaten < 1) { UI.hint('algae'); hintTimer = -1e9; }
      if (p.isFrogLike() && p.target && !p.tongue.active && !snapHinted) { snapHinted = true; UI.hint('snap'); }
      Journal.update(dt);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; SaveGame.write(G); }
    }
    G.particles.update(dt, g);

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
      const look = p.mode === 'air' ? p.vx * .2 : 0;
      const ly = p.isFrogLike() && p.mode !== 'water' ? -30 : 0;
      G.cam.follow(p.x + look, p.y + ly, p.cameraZoom() * G.userZoom);
    }
    G.cam.update(rawDt, g.bounds);

    Render.frame(G, dt);
    if (params.has('debug')) { frames++; document.title = `t=${G.time.toFixed(2)} tod=${G.tod.toFixed(3)} day=${G.day} ${g.season} frames=${frames} state=${G.player.state}/${G.player.mode} p=${G.player.x | 0},${G.player.y | 0} cam=${G.cam.x | 0},${G.cam.y | 0},${G.cam.zoom.toFixed(2)} haz=${G.hazards.snake.state}/${G.hazards.raccoon.state}@${G.hazards.raccoon.x | 0}/${G.hazards.fish.state} fps=${Render.getFps().toFixed(0)}`; }
    if (G.started) UI.update();
    const p = G.player;
    const under = p && (p.inWater() || p.isTadpole()) && p.state !== 'egg' && p.y > g.surfaceAt(p.x) + 6 * p.scale() ? 1 : 0;
    underwaterAmt += (under - underwaterAmt) * (1 - Math.exp(-rawDt * 8));
    AudioFX.listener.x = G.cam.x; AudioFX.listener.hw = W / G.cam.zoom / 2;
    const airLow = p && p.stage === 3 && p.state === 'tadpole' ? clamp(1 - p.air / .4, 0, 1) : 0;
    AudioFX.update(rawDt, { night: G.night, underwater: underwaterAmt, wind: g.weather.wind, gust: g.weather.gust, rain: g.weather.rain, ice: g.weather.ice, airLow });
    drawTitle(rawDt);
  }
  let nightFactDone = false, iceFactDone = false, snapHinted = false, dryHinted = false, pendingParade = false, culvertHinted = false;

  /* ---------- who is playing ---------- */
  function buildProfiles() {
    const box = document.getElementById('profilePick'); if (!box) return;
    box.innerHTML = '';
    for (const pr of Profile.list()) {
      const b = document.createElement('button'); b.className = 'chip' + (pr.id === Profile.id ? ' on' : '');
      b.textContent = (pr.name || (pr.id === 'main' ? 'Me' : 'Player')) ;
      b.addEventListener('click', () => { if (pr.id === Profile.id) return; Profile.use(pr.id); location.reload(); });
      box.appendChild(b);
    }
    const add = document.createElement('button'); add.className = 'chip'; add.textContent = '+ Add a child';
    add.addEventListener('click', () => { const name = (prompt('Name of the new player?') || '').trim(); if (!name) return; const id = Profile.add(name); Profile.use(id); location.reload(); });
    box.appendChild(add);
    if (!Profile.name) { const n = document.createElement('button'); n.className = 'chip'; n.textContent = '✎ Name'; n.addEventListener('click', () => { const name = (prompt('What is your name?') || '').trim(); if (name) { Profile.rename(name); buildProfiles(); } }); box.appendChild(n); }
  }

  /* ---------- title backdrop ---------- */
  const tc = document.getElementById('titleCanvas');
  const tctx = tc.getContext('2d');
  const titleTads = [], titleFrogs = [];
  for (let i = 0; i < 9; i++) titleTads.push({ x: Math.random(), y: .55 + Math.random() * .4, a: rnd(TAU), sp: rnd(.03, .06), s: rnd(.9, 1.5), ph: rnd(TAU), legs: chance(.4) ? 1 : 0 });
  const keysArr = Object.keys(SPECIES);
  for (let i = 0; i < 4; i++) titleFrogs.push({ x: .1 + i * .26 + Math.random() * .08, key: keysArr[i % keysArr.length], dir: chance(.5) ? 1 : -1, ph: rnd(TAU), r: rnd(50, 80) });
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    const surf = H * .48;
    /* water */
    const wg = tctx.createLinearGradient(0, surf, 0, H); wg.addColorStop(0, 'rgba(110,190,210,.75)'); wg.addColorStop(1, 'rgba(10,50,60,.95)');
    tctx.fillStyle = wg; tctx.fillRect(0, surf, W, H - surf);
    tctx.strokeStyle = 'rgba(255,255,255,.6)'; tctx.lineWidth = 2; tctx.beginPath(); for (let x = 0; x <= W; x += 10) tctx.lineTo(x, surf + Math.sin(x * .02 + G.time * 1.5) * 3); tctx.stroke();
    for (const t of titleTads) {
      t.a += Math.sin(G.time * .7 + t.ph) * dt * .8;
      t.x += Math.cos(t.a) * t.sp * dt; t.y += Math.sin(t.a) * t.sp * dt * .4;
      if (t.x < -.1) t.x = 1.1; if (t.x > 1.1) t.x = -.1; if (t.y < .52) t.y = .52; if (t.y > .98) t.y = .98;
      tctx.save(); tctx.translate(t.x * W, t.y * H); tctx.rotate(t.a); if (Math.cos(t.a) < 0) tctx.scale(1, -1); tctx.globalAlpha = .9;
      Sprites.drawTadpole(tctx, { s: t.s, species: SPECIES.green, kick: G.time * 12 + t.ph, swim: .7, legs: t.legs });
      tctx.restore();
    }
    for (const f of titleFrogs) {
      const x = f.x * W, y = surf + Math.sin(G.time * 1.3 + f.ph) * 4;
      tctx.save(); tctx.translate(x, y);
      Sprites.drawLilyPad(tctx, { r: f.r, notch: f.ph, hue: .4, bloom: f.key === 'green' ? 1 : 0 });
      tctx.translate(0, -4); tctx.scale(f.dir, 1);
      Sprites.drawFrog(tctx, { s: 1.4, species: SPECIES[f.key], pose: 'sit', throat: Math.max(0, Math.sin(G.time * 2 + f.ph)) * .7, blink: 0 });
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
  if (params.has('species') && SPECIES[params.get('species')]) settings.species = params.get('species');
  newPond(seed, PLACES[params.get('place')] ? params.get('place') : 'home');
  if (params.has('tod')) { G.tod = +params.get('tod'); }
  if (params.has('labels')) { settings.labels = true; }
  if (params.has('pad')) { settings.pad = true; }
  if (params.has('p2')) { settings.p2 = true; ensurePlayers(); }
  if (params.has('read')) { settings.reading = params.get('read'); }
  if (params.has('quality')) { settings.quality = params.get('quality'); }
  if (params.has('zoom')) { G.userZoom = +params.get('zoom'); }
  applyDebug();
  for (let i = 0; i < 40; i++) G.pond.update(1 / 30, G.tod, 0);       // settle pads and weather
  if (params.has('stage') || params.has('zoom')) snapCamera();
  if (params.has('stage')) { const p = G.player; UI.hint(p.stage === 3 ? 'breathe' : p.isTadpole() ? 'swim' : p.stage === 4 ? 'froglet' : p.state === 'hibernating' ? 'hibernating' : 'frog'); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { start(false); }
  if (params.has('ladybug')) { G.events.ladyTimer = 0; }
  if (params.has('frost')) { G.events.frost = 1; }
  if (params.has('mayfly')) { setTimeout(() => { const g = G.pond; for (let i = 0; i < 46; i++) { const b = G.bugs.add('mayfly', lerp(-g.W + 100, g.W - 100, Math.random()), -rnd(20, 200)); b.life = 80; } }, 30); }
  if (params.has('readlevel')) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  if (params.has('fakemic')) {
    /* a pretend child reads all but the last two words, then stops (for screenshots and testing) */
    settings.readMic = true;
    Grownups.confirmMicrophone = () => Promise.resolve(true);   /* the pretend microphone hears nothing real */
    Listener.supported = () => true;
    let fake = null;
    Listener.start = (o) => { let i = 0; clearInterval(fake); fake = setInterval(() => { i++; o.onHeard(o.expected.slice(0, Math.min(i, Math.max(1, o.expected.length - 2)))); o.onLevel(.3 + Math.random() * .6); }, 250); return true; };
    Listener.stop = () => { clearInterval(fake); return { heard: [], seconds: 6, blob: Promise.resolve(null) }; };
  }
  if (params.has('grownlater')) setTimeout(() => { UI.closeModals(); GrownupCorner.open(); }, +params.get('grownlater') || 2500);
  if (params.has('dumpread')) setInterval(() => { document.title = 'L=' + JSON.stringify(Reading._listen() && { k: Reading._listen().kind, got: Reading._listen().got && Reading._listen().got.size }) + ' R=' + Reading.records().length + ' P=' + Reading.pageOpen(); }, 100);
  if (params.has('mission')) Reading._missionNow();
  if (params.has('mywords')) setTimeout(() => { for (const w of ['i','can','see','the','frog','go','up','little','big','swim','hop','look','at','me','my']) { const d = Reading.stats(); d.words[w] = { r: 4, w: 0, h: 0 }; } Reading.stats().words.where = { r: 0, w: 3, h: 2 }; Reading.stats().words.jump = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  if (params.has('readpage')) setTimeout(() => Reading.showPage(params.get('readpage'), { gate: params.has('gate') }), 80);
  if (params.has('readcard')) setTimeout(() => { G.player.input.actionPressed = true; Reading.intercept(G.player); }, 120);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); nx && nx.click(); }, +params.get('readtask') > 1 ? +params.get('readtask') : 400);
  if (params.has('keeper')) { settings.keeperAny = true; setTimeout(() => Keeper.toggle(true), 60); }
  if (params.has('rhythm')) { G.tod = .05; setTimeout(() => { Rhythm.start(); }, 60); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'tadpole' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'tadpole');
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'science') { settings.science = true; UI.refreshToggles(); }
      else if (o === 'drawer') document.getElementById('drawer').hidden = false;
      else if (o === 'choice') document.getElementById('choice').hidden = false;
      else if (o === 'guide') { for (const k of ['green', 'turtle', 'heron', 'nymph', 'lilypad', 'algae', 'fly']) Bus.emit('seen', k); FieldGuide.open(); }
      else if (o === 'story') Story.open(params.get('chapter') || 'legs', true);
      else if (o === 'safari') Safari.open(G);
      else if (o === 'grownup') GrownupCorner.open();
      else if (o === 'recorder') Recorder.open();
    }, 50);
  }
  requestAnimationFrame(loop);
})();
