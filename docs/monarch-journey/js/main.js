/* ============================================================
   main.js — the game loop, input and glue
   ============================================================
   Two modes share one loop: 'milkweed' (egg to butterfly on one
   plant) and 'route' (the flight south).  A year is a relay: the
   super generation flies south and winters; in spring it hops
   north to Texas and lays eggs; two short summer generations
   carry the relay back to Ontario, where the next super
   generation is born.
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings ---------- */
  const DEFAULTS = { variant: 'male', difficulty: 'normal', ants: true, wasp: true, birds: true, coop: false, science: false, speak: false, sound: true, slowmo: false, simple: false, labels: false, pad: matchMedia('(pointer: coarse)').matches, clock: true,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto', readMic: false, readSave: true };
  let settings;
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('monarch.settings') || '{}')); } catch (e) { settings = Object.assign({}, DEFAULTS); }
  if (!VARIANTS[settings.variant]) settings.variant = 'male';
  if (!DIFFICULTY[settings.difficulty]) settings.difficulty = 'normal';
  if (settings.readMode !== 'play') settings.readMode = 'listen';
  if (!READ_LEVELS.includes(settings.readLevel)) settings.readLevel = 'B';
  if (settings.readHelp !== 'ask') settings.readHelp = 'auto';
  /* the microphone starts off on every load: a grown-up turns it on (Grownups.confirmMicrophone) */
  settings.readMic = false;
  const saveSettings = () => { try { localStorage.setItem('monarch.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };
  Journal.load();

  /* ---------- game state ---------- */
  const G = {
    settings, mode: 'milkweed', plant: null, route: null, cam: new Camera(), player: null, players: [], aphids: null, ants: null, wasp: null, mantis: null, bird: null, mate: null,
    particles: new Particles(), exuviae: [], eggShells: [], eggs: [],
    time: 0, tod: .36, day: 1, generation: 1, year: 1, relay: 0, summer: false, scene: null, started: false, userZoom: 1, night: 0,
    variantDef() { return VARIANTS[settings.variant] || VARIANTS.male; }
  };
  window.G = G;
  const DAY_LENGTH = { milkweed: 300, route: 150 };

  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1;
  let hintTimer = 0, nightFactDone = false, frames = 0, southTimer = -1, arrivedTimer = -1, catchUpCool = 0, lakeWasBefore = false;

  /* ---------- the milkweed ---------- */
  function newPlant(newSeed, relayIdx) {
    if (newSeed !== undefined) seed = newSeed;
    if (relayIdx !== undefined) G.relay = relayIdx;
    const stop = RELAY[G.relay];
    G.mode = 'milkweed';
    G.route = null; G.bird = null; G.players = [];
    G.summer = !stop.super;
    G.scene = stop.palette;
    G.plant = new Plant(seed, { type: stop.plant });
    G.aphids = G.plant.aphids = new Aphids(G.plant, G);
    G.ants = G.plant.ants = new Ants(G.plant, G);
    G.wasp = new Wasp(G);
    G.exuviae = []; G.eggShells = []; G.eggs = [];
    G.particles = new Particles();
    const eggSpot = pickEggSpot();
    G.mantis = new Mantis(G.plant, G, eggSpot.leaf);
    G.mate = G.summer ? new Mate(G, settings.variant === 'female' ? 'male' : 'female') : null;
    applyDifficulty();
    startLife(eggSpot);
    G.cam.follow(G.player.x, G.player.y - 20, G.player.cameraZoom());
    G.cam.snap();
    UI.setMode('milkweed');
    Journal.add('milkweeds', stop.plant);
    lakeWasBefore = false;
  }

  function pickEggSpot() {
    const P = G.plant;
    let spots = P.eggSpots.filter(s => s.y > -700 && s.y < -180);
    if (!spots.length) spots = P.eggSpots;
    return pick(spots);
  }

  function startLife(spot) {
    G.player = new Monarch(G, settings.variant, 1);
    G.player.plant = G.plant;
    G.player.summer = G.summer;
    G.player.placeEgg(spot);
    G.players = [G.player];
    southTimer = -1; arrivedTimer = -1;
    Reading.story('egg');
    UI.hint('egg');
    hintTimer = 0;
  }

  function applyDifficulty() {
    const d = DIFFICULTY[settings.difficulty];
    if (G.ants) { G.ants.enabled = settings.ants && d.ants; G.ants.setCount(settings.difficulty === 'hard' ? 4 : 2, settings.difficulty === 'hard' ? 70 : 50); }
    if (G.wasp) G.wasp.enabled = settings.wasp && d.wasp;
    if (G.mantis) G.mantis.enabled = G.mantis.leaf && settings.wasp && d.wasp;
    if (G.bird) G.bird.enabled = settings.birds && d.wasp;
  }

  /* ---------- the route ---------- */
  function startMigration(frac) {
    G.mode = 'route';
    G.route = new Route(G, seed, DIFFICULTY[settings.difficulty]);
    G.particles = new Particles();
    G.exuviae = []; G.eggShells = []; G.mate = null; G.mantis = null;
    const p = G.player;
    p.stage = 7; p.fresh = 0; p.readyFlag = false; p.summer = false;
    p.startMigration(G.route);
    if (frac) { p.x = frac * G.route.len; p.stats.miles = G.route.miles(p.x); }
    G.players = [p];
    if (settings.coop) {
      const p2 = new Monarch(G, settings.variant === 'female' ? 'male' : 'female', 2);
      p2.stage = 7; p2.startMigration(G.route); p2.x = p.x - 80; p2.y = p.y - 30;
      G.players.push(p2);
      Journal.add('milestones', 'coop');
      setTimeout(() => Bus.emit('fact', 'coop'), 8000);
    }
    G.bird = new RouteBird(G);
    applyDifficulty();
    G.tod = .36;
    G.cam.follow(p.x + 120, p.y - 60, p.cameraZoom());
    G.cam.snap();
    UI.setMode('route');
    UI.hint('migrate');
    Bus.emit('fact', 'compass');
    setTimeout(() => Bus.emit('fact', 'wind'), 20000);
    lakeWasBefore = G.route.lake ? p.x < G.route.lake.x1 : false;
  }

  /* ---------- the relay north ---------- */
  function nextGeneration(idx) {
    G.generation++; Journal.data.generations++;
    if (idx === 0) { G.year++; Journal.data.years++; Journal.add('milestones', 'relay'); }
    Journal.save();
    G.day = 1;
    UI.resetFacts();
    newPlant((Math.random() * 1e9) | 0, idx);
    UI.hint('egg');
    const stop = RELAY[idx];
    setTimeout(() => { Bus.emit('fact', MILKWEEDS[stop.plant].fact); if (G.summer) Bus.emit('fact', 'summer'); else Bus.emit('fact', 'relay'); }, 6000);
    UI.refreshJournalLine();
  }
  const hopText = (from, to) => `${from.place} to ${to.place}. ${to.blurb}`;

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
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (G.started && Reading.keydown(e)) return;          // a word card or reading page has the keys
    const k = e.key;
    keys[k] = true;
    if (!G.started) { if (k === ' ' || k === 'Enter') { start(); e.preventDefault(); } return; }
    if (UI.anyModal()) { if (k === 'Escape') UI.closeAll(); return; }
    const p2 = G.players[1];
    if (k === ' ') { if (!e.repeat) G.player.input.actionPressed = true; e.preventDefault(); }
    if (k === 'Enter') { if (!e.repeat) { if (p2) p2.input.actionPressed = true; else G.player.input.actionPressed = true; } e.preventDefault(); }
    if (k === 'l' || k === 'L') { if (!p2) toggle('labels'); }
    if (k === 'm' || k === 'M') toggle('sound');
    if (k === 'v' || k === 'V') toggle('speak');
    if (k === 'j' || k === 'J') { if (!p2) UI.showJournal(); }
    if (k === 'k' || k === 'K') { if (!p2) UI.showMap(); }
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') { UI.closeAll(); UI.forecast(null); }
    if (k.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.key] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function readInput() {
    const inp = G.player.input;
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
    if (keys.ArrowRight || keys.d || keys.D) x += 1;
    if (keys.ArrowUp || keys.w || keys.W) y -= 1;
    if (keys.ArrowDown || keys.s || keys.S) y += 1;
    x += inputState.padX; y += inputState.padY;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    inp.x = x; inp.y = y;
    inp.action = !!(keys[' '] || inputState.padAction);
    const p2 = G.players[1];
    if (p2) {
      let x2 = 0, y2 = 0;
      if (keys.j || keys.J) x2 -= 1; if (keys.l || keys.L) x2 += 1; if (keys.i || keys.I) y2 -= 1; if (keys.k || keys.K) y2 += 1;
      p2.input.x = x2; p2.input.y = y2; p2.input.action = !!keys.Enter;
    }
    Reading.intercept(G.player);                           // Read to Play: the action button asks for a word
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
  const btnAction = document.getElementById('btnAction');
  btnAction.addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModal()) G.player.input.actionPressed = true; inputState.padAction = true; });
  btnAction.addEventListener('pointerup', () => { inputState.padAction = false; });
  btnAction.addEventListener('pointercancel', () => { inputState.padAction = false; });

  /* click / tap the plant to walk there; tap the sky to act */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    const held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    if (G.mode === 'route') { p.input.actionPressed = true; return; }
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    if (!(p.state === 'larva' || p.state === 'adult')) { p.input.actionPressed = true; return; }
    const n = G.plant.nearest(wx, wy, 90 / Math.sqrt(G.cam.zoom));
    if (n) p.goTo(n.seg, n.t); else p.input.actionPressed = true;
  });
  canvas.addEventListener('wheel', (e) => {
    G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .9 : 1.1), .55, 2.2);
    e.preventDefault();
  }, { passive: false });

  /* ---------- toggles ---------- */
  async function toggle(key) {
    /* turning the microphone on needs a grown-up first; turning it off never does */
    if (key === 'readMic' && !settings.readMic && !(await Grownups.confirmMicrophone())) { settings.readMic = false; UI.refreshToggles(); return; }
    switch (key) {
      case 'labels': settings.labels = !settings.labels; break;
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'ants': settings.ants = !settings.ants; applyDifficulty(); break;
      case 'wasp': settings.wasp = !settings.wasp; applyDifficulty(); break;
      case 'birds': settings.birds = !settings.birds; applyDifficulty(); break;
      case 'coop': settings.coop = !settings.coop; if (G.mode === 'route') { if (settings.coop && !G.players[1]) { const p2 = new Monarch(G, settings.variant === 'female' ? 'male' : 'female', 2); p2.stage = 7; p2.startMigration(G.route); p2.x = G.player.x - 80; p2.y = Math.min(-80, G.player.y - 30); G.players.push(p2); Journal.add('milestones', 'coop'); } else if (!settings.coop) G.players.length = 1; } break;
      case 'science': settings.science = !settings.science; break;
      case 'speak': settings.speak = !settings.speak; if (!settings.speak) UI.stopSpeaking(); break;
      case 'slowmo': settings.slowmo = !settings.slowmo; break;
      case 'simple': settings.simple = !settings.simple; break;
      case 'pad': settings.pad = !settings.pad; break;
      case 'clock': settings.clock = !settings.clock; break;
      case 'readMic': settings.readMic = !settings.readMic; if (settings.readMic && !Listener.supported()) UI.hint('This browser cannot listen. Try Chrome.'); break;
      case 'readSave': settings.readSave = !(settings.readSave !== false); break;
    }
    saveSettings();
    UI.refreshToggles();
    AudioFX.click();
  }

  /* ---------- UI wiring ---------- */
  /* Read to Play: a big step of the journey waits for its page to be read */
  const readGate = (key, cont) => { if (Reading.on() && G.player) Reading.gate(G.player, key, cont); else cont(); };
  let nextGenKind = 'eggs';
  UI.init(G, {
    onStart: start,
    onVariant: (k) => { settings.variant = k; saveSettings(); if (G.player) G.player.variant = VARIANTS[k]; UI.refreshVariant(); },
    onDiff: (d) => { settings.difficulty = d; saveSettings(); applyDifficulty(); },
    onToggle: toggle,
    onTod: (v) => { G.tod = v; },
    onNewPlant: () => { UI.resetFacts(); newPlant((Math.random() * 1e9) | 0); UI.hint('egg'); },
    onRestart: () => { UI.resetFacts(); G.day = 1; if (G.mode !== 'milkweed') newPlant(seed); else startLife(pickEggSpot()); },
    onSkipSouth: () => { if (G.mode !== 'route') { G.relay = 0; G.summer = false; if (G.player.stage < 7) { G.player.stage = 7; G.player.state = 'adult'; } startMigration(0); } },
    onGoSouth: () => readGate('south', () => startMigration(0)),
    onStay: () => { UI.hint('adult'); southTimer = 45; },
    onWinter: () => readGate('forest', () => { Journal.add('milestones', 'winter'); Bus.emit('fact', 'winter'); setTimeout(() => UI.showSpring(G.variantDef()), 1500); }),
    onStayForest: () => { UI.hint('winterFly'); },
    onNorth: () => readGate('spring', () => {
      Journal.add('milestones', 'spring');
      const to = RELAY[1];
      UI.showHop(MapView.RESERVE, [to.lon, to.lat], 'Flying north', hopText({ place: 'El Rosario, Michoacán' }, to), () => nextGeneration(1));
    }),
    onNextGen: () => readGate(nextGenKind, () => {
      const from = RELAY[G.relay], idx = (G.relay + 1) % RELAY.length, to = RELAY[idx];
      UI.showHop([from.lon, from.lat], [to.lon, to.lat], idx === 0 ? 'The relay reaches Ontario' : 'Flying north', hopText(from, to), () => nextGeneration(idx));
    }),
    onFlyDawn: () => { G.player.decided = true; UI.hint('roosting'); },
    onWait: () => {
      const p = G.player;
      p.decided = true; p.waitDays = 1; p.energy = Math.max(0, p.energy - .05);
      Journal.add('milestones', 'waited');
      Bus.emit('fact', 'forecast');
      UI.hint('waiting');
    },
    onResetJournal: () => { Journal.reset(); UI.refreshJournalLine(); },
    onReadMode: (m) => { settings.readMode = m; if (m === 'play') settings.simple = true; else settings.speak = true; saveSettings(); },
    onReadLevel: (L) => { if (L === 'auto') settings.readAuto = !settings.readAuto; else { settings.readLevel = L; settings.readMode = 'play'; settings.simple = true; } saveSettings(); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); }
  });
  Voice.init();
  Grownups.guardOutboundLinks();
  Reading.init(G, { saveSettings });

  function start() {
    if (G.started) return;
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (G.player.state === 'egg') Reading.story('egg');
    UI.hint('egg');
  }

  /* ---------- events → hints and stickers ---------- */
  Bus.on('hatched', () => { UI.hint('crawl'); hintTimer = 0; Journal.add('milestones', 'hatched'); });
  Bus.on('moltStart', () => UI.hint('molt'));
  Bus.on('molted', (p) => { UI.hint(p.stage === 5 ? 'Last caterpillar stage! Eat up — then find a place to hang.' : 'bite'); if (p.stage === 2) Journal.add('milestones', 'molt1'); if (p.stage === 5) Journal.add('milestones', 'molt4'); });
  Bus.on('readyHang', () => UI.hint('readyHang'));
  Bus.on('jhang', () => { UI.hint('jhang'); Journal.add('milestones', 'jhang'); });
  Bus.on('pupated', () => { UI.hint('chrysalis'); Journal.add('milestones', 'chrysalis'); Reading.story('chrysalis'); });
  Bus.on('eclosed', () => { UI.hint('drying'); Journal.add('milestones', 'eclosed'); });
  Bus.on('wingsDry', (p) => { if (p.summer) { UI.hint('summerAdult'); Bus.emit('fact', 'summer'); } else { UI.hint('adult'); Bus.emit('fact', 'super'); Journal.add('milestones', 'super'); } });
  Bus.on('takeoff', (p) => { if (p.id !== 1) return; UI.hint(G.mode === 'route' ? 'migrate' : (p.summer && p.readyFlag ? (p.variant.key === 'female' ? 'laying' : 'mate') : 'flying')); Journal.add('milestones', 'flight'); });
  Bus.on('landed', (p) => { if (p.id !== 1) return; UI.hint(p.readyFlag ? (p.summer ? (p.variant.key === 'female' ? 'laying' : 'mate') : 'readyGo') : (p.summer ? 'summerAdult' : 'adult')); });
  Bus.on('sipStart', () => UI.hint('sip'));
  Bus.on('readyGo', () => { UI.hint('readyGo'); southTimer = 3; });
  Bus.on('readyMate', (p) => { UI.hint(p.variant.key === 'female' ? 'laying' : 'mate'); });
  Bus.on('eggsDone', () => { nextGenKind = 'eggs'; setTimeout(() => UI.showNextGen('eggs', RELAY[(G.relay + 1) % RELAY.length]), 1800); });
  Bus.on('mated', () => { nextGenKind = 'mate'; setTimeout(() => UI.showNextGen('mate', RELAY[(G.relay + 1) % RELAY.length]), 1200); });
  Bus.on('eat', (p) => { if (p.stage === 1 && p.eaten === 2) UI.hint('branch'); });
  Bus.on('podBurst', () => UI.hint('Seeds caught! Plant them in the garden (📓 journal → Garden).'));
  Bus.on('nectarStart', (p) => { if (p.id === 1) UI.hint('Drinking… press SPACE when you are full to fly on.'); });
  Bus.on('roost', (p, tree) => { if (p.id !== 1) return; p.decided = false; UI.hint(G.night > .4 || G.tod > .72 ? 'forecast' : 'Sheltering. Press SPACE when the sky is clear to fly on.'); });
  Bus.on('exhausted', (p) => { if (p.id !== 1) return; UI.hint('exhausted'); whyCard(p); });
  Bus.on('thermal', () => { UI.hint('thermal'); Journal.add('milestones', 'thermal'); });
  Bus.on('sheltered', () => Journal.add('milestones', 'storm'));
  Bus.on('stormOver', () => UI.hint('The storm has passed — and look, a tailwind behind it!'));
  Bus.on('newDay', (plan) => { if (G.mode === 'route' && G.player.state === 'roosting') UI.hint(`Morning! ${plan.label}. Press SPACE to fly on.`); });
  Bus.on('arrived', (p) => {
    if (p.id === 1) { UI.hint('arrived'); arrivedTimer = 6.5; AudioFX.arrive(); const p2 = G.players[1]; if (p2 && p2.state !== 'arrived') setTimeout(() => { if (p2.state !== 'arrived') p2.arrive(p.roostTree); }, 1200); }
  });
  Bus.on('birdCaught', (p) => { if (p.id === 1) UI.hint('spat'); });
  Bus.on('mantisStrike', () => { });
  /* reading stickers */
  Bus.on('readPage', () => Journal.add('milestones', 'reader'));
  Bus.on('missionDone', () => Journal.add('milestones', 'mission'));
  Bus.on('readAloud', () => Journal.add('milestones', 'aloud'));

  /* ---------- "why did that happen" ---------- */
  function whyCard(p) {
    const R = G.route; if (!R) return;
    const ds = R.dayStats;
    const pct = (v) => ds.fly > 0 ? Math.round(v / ds.fly * 100) : 0;
    const flap = pct(ds.flap), head = pct(ds.head), night = pct(ds.night), th = pct(ds.thermal);
    const tips = [];
    if (flap > 45) tips.push(`you flapped ${flap}% of the time (gliding is almost free: let go of SPACE and sink slowly)`);
    if (head > 35) tips.push(`you flew into a headwind ${head}% of the time (fly low, where the wind is weaker, or wait a day in a tree)`);
    if (night > 20) tips.push(`you flew at night ${night}% of the time (it is cold: roost at dusk)`);
    if (th < 10) tips.push('you barely used thermals (ride the shimmering columns up, then glide for miles)');
    if (p.blownBack) tips.unshift('you ran out over the water, where there is nowhere to land (fill up on nectar at the shore first, and wait for a tailwind)');
    const body = tips.length ? `Out of energy. Today ${tips.join('; ')}. Drink at the next flowers, then try the tip.` : 'Out of energy. Nectar stops refill it: drink at every flower patch you pass.';
    UI.card('Why did that happen?', G.settings.simple ? (p.blownBack ? 'You ran out of energy over the water. Fill up on nectar first!' : (flap > 45 ? 'Too much flapping! Let go and glide.' : head > 35 ? 'Headwind! Fly low or wait in a tree.' : 'Out of energy. Drink nectar at every flower patch.')) : body);
  }

  /* ---------- debug jumps (?stage=L3 etc.) ---------- */
  function applyDebug() {
    if (params.has('relay')) { G.relay = clamp(+params.get('relay'), 0, 2); newPlant(seed, G.relay); }
    if (params.has('seeds')) Journal.addSeeds(+params.get('seeds'));
    const st = params.get('stage');
    if (!st) return;
    const p = G.player;
    const idx = STAGES.findIndex(s => s.key === st);
    if (st === 'flying') { p.stage = 7; p.state = 'flying'; p.x = 0; p.y = -700; p.vx = 60; p.vy = 0; p.open = 1; }
    else if (st === 'chrysalis') { p.stage = 5; p.state = 'larva'; p.readyFlag = true; p.hangSpot = G.plant.hangSpots[2]; p.beginJ(); p.state = 'chrysalis'; p.stage = 6; p.timer = +(params.get('t') || 0); }
    else if (st === 'jhang') { p.stage = 5; p.state = 'larva'; p.readyFlag = true; p.hangSpot = G.plant.hangSpots[2]; p.beginJ(); }
    else if (st === 'drying') { p.stage = 5; p.hangSpot = G.plant.hangSpots[2]; p.seg = p.hangSpot.seg; p.t = p.hangSpot.t; p.state = 'drying'; p.stage = 7; p.crumple = 1; p.fresh = 1; }
    else if (st === 'adult') { p.stage = 7; p.state = 'adult'; p.fresh = +(params.get('fresh') || 0); }
    else if (st === 'migrate' || st === 'forest') { startMigration(st === 'forest' ? .93 : +(params.get('frac') || 0)); }
    else if (idx > 0) { p.stage = idx; p.state = 'larva'; }
    if (params.has('eaten')) p.eaten = +params.get('eaten');
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  let warpLeft = params.has('warp') ? +params.get('warp') : 0;     // ?warp=N: simulate N frames before the first draw
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = clamp((now - last) / 1000, 0, .05);
    last = now;
    if (document.hidden) return;
    while (warpLeft > 0) { warpLeft--; step(1 / 60); }
    step(dt);
    draw(dt);
  }

  function onDawn() {
    const p = G.player, R = G.route;
    if (G.mode !== 'route' || !R) return;
    if (p.state === 'roosting' && p.waitDays > 0) {
      p.waitDays--;
      R.applyForecast();
      return;
    }
    R.applyForecast();
  }

  function step(dt) {
    const p = G.player;
    const modal = UI.anyModal();

    if (G.started && !modal) readInput(); else { for (const q of G.players) { q.input.x = q.input.y = 0; q.input.action = false; } }

    Cinematic.update(dt);
    const sdt = dt * Cinematic.timeScale;

    /* time of day */
    const diff = DIFFICULTY[settings.difficulty];
    if (settings.clock && !modal) {
      let rate = 1;
      const landedOnRoute = G.mode === 'route' && p.state !== 'migrating' && p.state !== 'winterFly';
      if (p.state === 'chrysalis') rate = 14;
      else if (p.state === 'jhang' || p.state === 'drying') rate = 3;
      else if (landedOnRoute && p.state === 'roosting' && p.waitDays > 0) rate = 12;          // waiting out the weather
      else if (landedOnRoute && (G.night > .3 || G.tod > .74)) rate = 12;                       // nights pass quickly once you have landed
      else if (p.state === 'arrived') rate = 4;
      if (G.mode === 'route' && !diff.night) { G.tod = clamp(G.tod, .32, .7); if (G.tod > .69) { G.tod = .33; G.day++; onDawn(); } }
      const prevTod = G.tod;
      G.tod = (G.tod + dt / DAY_LENGTH[G.mode] * rate) % 1;
      if (G.tod < prevTod) { G.day++; p.stats.days++; }
      if (prevTod < .3 && G.tod >= .3) onDawn();
      if (Render.nightAmount(G.tod) > .8 && !nightFactDone && G.mode === 'milkweed') { nightFactDone = true; Bus.emit('fact', 'night'); }
      document.getElementById('sTod').value = Math.round(G.tod * 100);
    }
    G.night = Render.nightAmount(G.tod);
    G.time += sdt;

    if (G.started && !modal) {
      if (G.mode === 'milkweed') {
        G.plant.time = G.time; G.plant.gust = Math.max(0, Math.sin(G.time * .11) - .8) * 3;
        G.plant.update(sdt);
        p.update(sdt);
        G.aphids.update(sdt, p);
        G.ants.update(sdt, p);
        G.wasp.update(sdt, p, G.night);
        if (G.mantis) G.mantis.update(sdt, p);
        if (G.mate) G.mate.update(sdt, p);
        hintTimer += sdt;
        if (p.state === 'larva' && hintTimer > 18 && p.stage === 1 && p.eaten < 2) { UI.hint('branch'); hintTimer = -1e9; }
        if (southTimer > 0 && !Reading.busy()) { southTimer -= dt; if (southTimer <= 0 && p.readyFlag && !p.summer && (p.state === 'adult' || p.state === 'flying')) UI.showSouth(settings.coop); }
      } else {
        const R = G.route;
        R.update(sdt, p, G.tod, G.night);
        for (const q of G.players) q.update(sdt);
        if (G.bird) G.bird.update(sdt, G.players, R, G.night);
        /* player 2 keeps up */
        const p2 = G.players[1];
        catchUpCool = Math.max(0, catchUpCool - dt);
        if (p2 && catchUpCool <= 0 && (p.state === 'migrating' || p.state === 'winterFly') && (p2.x < p.x - 1000 || p2.x > p.x + 1300)) { p2.catchUp(p); catchUpCool = 4; }
        /* the lake */
        if (R.lake) { const past = p.x > R.lake.x1; if (past && lakeWasBefore && p.state === 'migrating') Journal.add('milestones', 'lake'); lakeWasBefore = !past; }
        /* zone stickers */
        const z = R.zone(p.x);
        if (p.state === 'migrating' && Journal.add('zones', z.key) && z.key === 'plains') Journal.add('milestones', 'funnel');
        /* dusk, storm, forecast */
        if (p.state === 'migrating' && G.tod > .72 && G.tod < .78 && diff.night) UI.hint('dusk');
        if (p.state === 'migrating' && R.inStorm(p.x)) { UI.hint('storm'); if (!R.storm.hit) { R.storm.hit = true; Bus.emit('fact', 'storm'); } }
        if (p.state === 'migrating' && R.lake && p.x > R.lake.x0 - 900 && p.x < R.lake.x0) UI.hint('lake');
        if (p.state === 'migrating' && z.key === 'forest') UI.hint('forest');
        if (p.state === 'roosting') {
          if (G.tod > .72 && !R.nextPlan && p.waitDays === 0) { R.rollForecast(p.x); p.decided = false; }
          const showFc = R.nextPlan && (G.night > .3 || G.tod > .72) && !p.decided && !p.winterNap;
          UI.forecast(showFc ? { tree: p.roostTree, plan: R.nextPlan, log: R.dayLog, stats: R.dayStats } : null);
          if (p.timer > 2 && G.night < .3 && G.tod > .3 && p.waitDays === 0 && !R.inStorm(p.x) && !(R.storm && Math.abs(R.storm.x - p.x) < 2200) && p.decided) UI.hint('Morning! Press SPACE to fly on.');
        } else UI.forecast(null);
        if (arrivedTimer > 0) { arrivedTimer -= dt; if (arrivedTimer <= 0) UI.showArrived(p.stats, G, p.tagInfo); }
      }
    }
    if (G.started && !modal) Reading.update(dt);
    G.particles.update(sdt);

    /* camera */
    const cine = Cinematic.camera();
    if (cine) G.cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (G.mode === 'route') {
      const ahead = (p.state === 'migrating' || p.state === 'winterFly') ? clamp(p.vx * .5, -120, 220) + 80 : 0;
      G.cam.follow(p.x + ahead, Math.min(p.y - 80, -160), p.cameraZoom() * G.userZoom * (G.players[1] ? .85 : 1));
    } else {
      const look = p.state === 'flying' ? 0 : 30 / Math.max(.5, G.cam.zoom);
      const hang = ['jhang', 'pupating', 'chrysalis', 'eclosing', 'drying'].includes(p.state) ? 30 : 0;
      G.cam.follow(p.x + (p.state === 'flying' ? p.vx * .15 : 0), p.y - look + hang, p.cameraZoom() * G.userZoom);
    }
    G.cam.update(dt, G.mode === 'route' ? G.route.bounds : G.plant.bounds, cine ? 3 : 4.5);
  }

  function draw(dt) {
    const p = G.player;
    Render.frame(G, dt);
    document.body.classList.toggle('cine', Cinematic.bars > .3);
    if (params.has('debug')) { frames++; document.title = `t=${G.time.toFixed(1)} tod=${G.tod.toFixed(3)} day=${G.day} f=${frames} ${p.state} x=${p.x | 0} y=${p.y | 0} e=${p.energy.toFixed(2)}`; }
    if (G.started) UI.update();
    UI.tick(dt);
    const wind = G.mode === 'route' ? G.route.wind(p.x, p.y).x : 0;
    AudioFX.update(dt, { night: G.night, wind: G.mode === 'route' ? clamp(Math.abs(wind) / 260, 0, 1) : .3 + .3 * Math.sin(G.time * .3), rain: G.mode === 'route' ? G.route.rain : 0, flying: p.state === 'flying' || p.state === 'migrating' || p.state === 'winterFly', flapping: p.flapping || p.state === 'flying' });
    drawTitle(dt);
  }

  /* ---------- title backdrop: monarchs drifting about ---------- */
  const tc = document.getElementById('titleCanvas');
  const tctx = tc.getContext('2d');
  const titleBugs = [];
  for (let i = 0; i < 9; i++) titleBugs.push({ x: Math.random(), y: Math.random(), a: rnd(TAU), sp: rnd(.03, .06), s: rnd(.8, 1.5), key: pick(['male', 'female', 'male', 'female', 'white']), ph: rnd(TAU) });
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    tctx.save(); tctx.globalAlpha = .5;
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * W + Math.sin(G.time * .4 + i) * 12, y = H + 10;
      Sprites.drawNectarPatch(tctx, { kind: i % 3 ? 'goldenrod' : 'aster', seed: i * 77, w: 140 }, x, y, G.time, false);
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
      Sprites.drawMonarch(tctx, { s: b.s, variant: VARIANTS[b.key], open: 1, flap: .4 + .6 * Math.abs(Math.cos(G.time * 9 + b.ph)) });
      tctx.restore();
    }
  }

  /* ---------- go ---------- */
  Render.init(canvas);
  resize();
  newPlant(seed, 0);
  if (params.has('labels')) { settings.labels = true; }
  if (params.has('pad')) { settings.pad = true; }
  if (params.has('coop')) { settings.coop = true; }
  if (params.get('clock') === '0') { settings.clock = false; }
  if (params.has('diff')) { settings.difficulty = params.get('diff'); applyDifficulty(); }
  applyDebug();
  if (params.has('tod')) { G.tod = +params.get('tod'); }
  if (params.has('storm') && G.route) { G.route.storm = { x: G.player.x + 900, w: 1500, vx: -95, life: 46, warned: true, hit: false }; }
  if (params.has('bird') && G.bird) { G.bird.timer = 0.1; }
  if (params.has('tag') && G.route) { const p = G.player; const n = G.route.nectar.find(n => n.x > p.x + 200); if (n) { p.x = n.x; p.y = n.y - 10; p.landNectar(n); } }
  if (params.has('roost') && G.route) { const p = G.player; const t = G.route.trees.find(t => t.x > p.x + 200 && !t.fir); if (t) { p.x = t.x; p.y = t.landY; p.roost(t); G.tod = +(params.get('tod') || .76); } }
  if (params.has('open')) {
    const p = G.player, which = params.get('open');
    if (which === 'journal') UI.showJournal();
    else if (which === 'garden') UI.showGarden();
    else if (which === 'map') UI.showMap();
    else if (which === 'citizen') UI.showCitizen();
    else if (which === 'south') UI.showSouth(settings.coop);
    else if (which === 'spring') UI.showSpring(G.variantDef());
    else if (which === 'nextgen') UI.showNextGen('eggs', RELAY[1]);
    else if (which === 'hop') UI.showHop(MapView.RESERVE, [RELAY[1].lon, RELAY[1].lat], 'Flying north', hopText({ place: 'El Rosario, Michoacán' }, RELAY[1]), () => {});
    else if (which === 'arrived') { G.day = 9; const t = Journal.newTag('Illinois', 'Point Pelee, Ontario', 2, 900, 1); Journal.recover(t, 9); UI.showArrived(p.stats, G, t); }
  }
  /* Read to Play debug: readlevel=B readpage=hang[&gate=1] readtask=1|ms readcard=1 mission=1|key mywords=1 readpics=1 grownup=1 fakemic=1 dumpread=1 */
  if (params.has('readlevel')) { settings.readMode = 'play'; settings.simple = true; const L = params.get('readlevel').toUpperCase(); if (READ_LEVELS.includes(L)) settings.readLevel = L; }
  if (params.get('readmode') === 'listen') settings.readMode = 'listen';
  if (params.has('fakemic')) {
    /* a pretend child reads all but the last two words, then stops (for screenshots and testing) */
    settings.readMic = true;
    Listener.supported = () => true;
    let fake = 0;
    Listener.start = (o) => { let i = 0; clearInterval(fake); fake = setInterval(() => { i++; o.onHeard(o.expected.slice(0, Math.min(i, Math.max(1, o.expected.length - 2)))); if (o.onLevel) o.onLevel(.3 + Math.random() * .6); }, 250); return true; };
    Listener.stop = () => { clearInterval(fake); return { heard: [], seconds: 6, blob: Promise.resolve(null) }; };
  }
  if (params.has('dumpread')) setInterval(() => { const l = Reading._listen(), m = Reading.mission(); document.title = `L=${l ? l.kind + ':' + (l.got ? l.got.size : '') : '-'} R=${Reading.records().length} P=${Reading.pageOpen()} C=${Reading.cardOpen()} M=${m ? m.m.key : '-'} S=${G.player.state} st=${G.player.stage}`; }, 100);
  UI.refreshToggles();
  if (params.has('notitle')) { start(); }
  if (params.has('readpage')) setTimeout(() => Reading.showPage(params.get('readpage'), { gate: params.has('gate') }), 80);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); if (nx) nx.click(); }, +params.get('readtask') > 1 ? +params.get('readtask') : 400);
  if (params.has('readcard')) setTimeout(() => { G.player.input.actionPressed = true; Reading.intercept(G.player); }, 120);
  if (params.has('mission')) setTimeout(() => { const k = params.get('mission'); if (k && k !== '1') Reading.startMission(G.player, k); else Reading._missionNow(); }, 60);
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'egg', 'go', 'up', 'little', 'big', 'fly', 'eat', 'look', 'at', 'me', 'my', 'leaf', 'hang']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.chew = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  if (params.has('readpics')) setTimeout(() => Reading.openPictures(), 100);
  if (params.has('grownup')) setTimeout(() => Reading.openGrownup(), 100);
  requestAnimationFrame(loop);
})();
