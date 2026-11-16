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
    const raw = JSON.parse(localStorage.getItem('parrot.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('parrot.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, forest: null, cam: new Camera(), players: [], particles: new Particles(),
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
    G.forest = new Forest(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  function newGame(newSeed) {
    G.form = settings.form;
    G.fast = false;
    makeWorld(newSeed);
    G.players = [new Parrot(G, G.form)];
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
    if (['egg', 'nest', 'crack', 'preen', 'echo'].includes(p.mode)) { p.input.actionPressed = true; return; }
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
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; UI.buildWheel(); } else UI.hint(settings.reading === 'simple' ? 'Your next parrot will be a ' + FORMS[k].short.toLowerCase() + '!' : `Your next generation will be a ${FORMS[k].name}. This parrot stays as it is.`); UI.refreshForms(); },
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
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Parrot(G, G.form); b.restore(po); G.players = [b]; });
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
      UI.hint(p.stage === 'egg' ? 'egg' : p.stage === 'chick' ? (!fl.ready ? 'hatched' : p.mode === 'nest' ? 'climb' : fl.strong ? 'jump' : 'flap') : p.stage === 'young' ? (fl.dusk ? 'roost' : ({ fig: 'gofig', clay: 'goclay', nut: 'gonut', call: 'lost', hide: 'gohide' })[fl.ls] || 'morning') : !fl.paired ? 'gomeet' : !fl.nest ? 'findhollow' : fl.hatched ? 'namechick' : p.male ? 'bringfood' : fl.laid ? 'sit' : 'enter');
    }
  }

  /* ---------- the director's hooks ---------- */
  const P = () => G.player;
  let quiet = false;   /* the debug jumps do not play the cinematics of the steps they skip */
  Story.init(G, {
    hint: (k) => { if (!quiet) UI.hint(k); },
    fact: (k) => { if (!quiet) Bus.emit('fact', k); },
    cine: (o) => { if (!quiet) Cinematic.play(o); },
    done: () => { const open = () => { if (Reading.busy() || Cinematic.active) setTimeout(open, 800); else UI.choice(); }; setTimeout(open, 3000); UI.refreshToggles(); }
  });
  /* a few words as you start */
  Bus.on('started', () => { if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a parrot, in an egg.' : 'You are a scarlet macaw, inside an egg, in a hollow high in a rainforest tree. Grow your feathers, learn your name, and fly.'); });
  Bus.on('ring', (kind, seq) => { if (G.started && AudioFX.call) AudioFX.call(kind, seq); });
  Bus.on('note', (p, dir) => { if (AudioFX.note) AudioFX.note(dir); });
  Bus.on('flapped', () => { if (G.started && AudioFX.flap) AudioFX.flap(); });
  Bus.on('peopleSay', (t) => { if (!Reading.on()) Voice.say(t, { interrupt: false }); });

  /* ---------- debug jumps (?stage=…) ---------- */
  function dbgChick(instar) {
    const p = G.player, F = G.forest;
    p.flags.eggReady = p.flags.hatching = true; p.hatch(); p.instar = clamp(instar, 0, 3);
    if (F.sib) F.sib.size = [.5, .6, .75, .9][p.instar];
    if (p.instar >= 2) { p.flags.named = true; p.flags.name = 'uru'; }
    if (p.instar >= 3) p.flags.ready = true;
    F.feed.clock = 99;
  }
  function dbgYoung(lesson, at) {
    const p = G.player, F = G.forest, fl = p.flags;
    dbgChick(3); Object.assign(fl, { atDoor: true, strong: true, fledged: true, lesson, q: '' }); p.stage = 'young'; p.stats.lessons = lesson; p.flapN = 9;
    const q = F.station(at || 'fig'); p.mode = 'perch'; p.setOn(q.line, clamp(q.s - 70, 0, q.line.len));
    F.sib.size = 1; F.sib.off = 44; F.sib.follow = p; F.sib.perchAt(q.line, clamp(q.s + 66, 0, q.line.len));
    F.mum.perchAt(q.line, q.s - 22); F.dad.perchAt(q.line, q.s + 22); G.tod = .4;
    for (const k of ['crop', 'call', 'atefig', 'ateclay', 'atenut', 'lick']) Story.once[k] = true;
  }
  function dbgAdult(at) {
    const p = G.player, F = G.forest;
    dbgYoung(5, at || 'mate'); p.stage = 'adult'; F.sib = null;
    F.mum.perchAt(F.line('homehigh'), 40); F.dad.perchAt(F.line('homehigh'), 90);
    const m = Story.makeMate(); if (at && at !== 'mate') { m.perchAt(p.line, p.s + 30); }
    return m;
  }
  function dbgPair(hollowKey) {
    const p = G.player, F = G.forest, m = dbgAdult('hide'); p.flags.paired = true; m.follow = p; m.off = 30;
    if (hollowKey) { const h = F.hollow(hollowKey); p.setOn(h.line, h.s); m.perchAt(h.line, clamp(h.s + (h.s > h.line.len / 2 ? -34 : 34), 0, h.line.len)); m.follow = null; return h; }
    return null;
  }
  function applyDebug() {
    /* the debug jumps skip Read to Play's gates (they call the life-cycle steps directly) */
    const rm = settings.readMode; settings.readMode = 'listen';
    quiet = true;
    try { applyDebugInner(); } finally { settings.readMode = rm; quiet = false; }
  }
  function applyDebugInner() {
    const st = params.get('stage'); if (!st) return;
    const p = G.player, F = G.forest, fl = p.flags, door = F.line('doorstep'), free = F.hollows.find(h => h.who === 'free');
    const num = (k, d) => params.has(k) ? +params.get(k) : d;
    if (st === 'hatch') { p.eggT = 5; fl.eggReady = true; p.crack = .6; return; }
    if (st === 'chick') { dbgChick(num('instar', 0)); F.feed.clock = 3; return; }
    if (st === 'feed' || st === 'name') {
      dbgChick(num('instar', st === 'name' ? 1 : 0)); F.feed.bird = F.mum; F.mum.perchAt(door, 10); F.mum.face = -1; F.feed.state = 'offer'; F.feed.t = 0;
      if (st === 'name') { F.feed.state = 'teach'; const seq = Story.nameSeq(); p.startEcho(seq, 'name'); p.ec.t = num('et', 0); }
      return;
    }
    if (st === 'toucan' || st === 'climber') {
      dbgChick(2);
      if (st === 'toucan') { const v = F.startVisitor('toucan'); v.x = v.tx; v.y = v.ty; v.state = 'look'; v.patience = 999; }
      else { const Q = F.startPeople('climber'); Q.y = Q.wy; Q.state = 'look'; Q.t = num('pt', 0); }
      return;
    }
    if (st === 'door') { dbgChick(3); p.mode = 'perch'; p.setOn(door, 6); fl.atDoor = true; p.flapN = num('n', 3); p.flapping = 99; return; }
    if (st === 'fledge') { dbgChick(3); p.mode = 'perch'; p.setOn(door, 6); Object.assign(fl, { atDoor: true, strong: true }); F.lead('first'); p.takeOff(-90); p.x += 90; p.y += 10; return; }
    const LES = { fig: 0, clay: 1, nut: 2, lost: 3, hide: 4 };
    if (st in LES || st === 'eagle' || st === 'boat' || st === 'crack' || st === 'hawk') {
      const k = st === 'eagle' || st === 'boat' ? 'clay' : st === 'crack' ? 'nut' : st === 'hawk' ? 'hide' : st;
      dbgYoung(LES[k], k); if (k === 'hide') dbgYoung(4, 'roost');
      Story.startLesson(); const q = F.station(k); if (k !== 'hide') { F.mum.perchAt(q.line, q.s - 22); F.dad.perchAt(q.line, q.s + 22); }
      const fd = F.nextFood(k, p.x, p.y); if (fd) { p.setOn(fd.line, fd.s - 12); p.face = 1; }
      if (st === 'eagle') { fl.eagle1 = true; const v = F.startVisitor('eagle', 'air'); v.x = p.x + 150; v.y = p.y - 190; v.state = 'look'; v.patience = 999; p.takeOff(-90); p.y -= 60; }
      if (st === 'hawk') { fl.hawk = true; p.takeOff(-90); p.y -= 40; const v = F.startVisitor('eagle', 'leaves'); v.x = p.x + 170; v.y = p.y - 170; v.state = 'look'; v.patience = 999; }
      if (st === 'boat') { const Q = F.startPeople('boat'); Q.x = Q.wx; Q.state = 'look'; Q.t = num('pt', 0); }
      if (st === 'crack') { p.act(); if (p.cr) { p.cr.n = 2; p.cr.t = num('ct', .5); } }
      if (st === 'lost') { F.weather.fog = 1; p.setOn(F.line('palma'), 50); if (params.has('heard')) fl.heard = true; }
      return;
    }
    if (st === 'fly') { dbgYoung(num('lesson', 1), 'roost'); p.takeOff(-90); p.x = num('x', 300); p.y = num('y', -520); p.vx = 190; F.sib.x = p.x - 40; F.sib.y = p.y - 10; F.sib.mode = 'fly'; if (params.has('adult')) p.stage = 'adult'; return; }
    if (st === 'roost' || st === 'sleep') { dbgYoung(1, 'roost'); fl.dusk = true; G.tod = st === 'sleep' ? .9 : .78; if (st === 'sleep') { p.mode = 'sleep'; p.sleepT = 99; } return; }
    if (st === 'grown') { dbgAdult(); p.setOn(F.line('figb'), 40); return; }
    if (st === 'meet' || st === 'preen') { const m = dbgAdult(); p.setOn(m.line, m.s - 34); p.face = 1; m.face = -1; if (st === 'preen') { p.act(); if (p.pr) { p.pr.good = 1; p.pr.t = num('pt', .75); } } return; }
    if (st === 'pair') { dbgPair(); p.takeOff(-90); p.x = num('x', 620); p.y = -470; p.vx = 220; F.mate.x = p.x - 30; F.mate.y = p.y - 14; F.mate.mode = 'fly'; return; }
    if (st === 'hollow' || st === 'peek') { const h = dbgPair(params.get('h') || 'kapok'); if (st === 'peek') { h.seen = true; h.pop = 99; } return; }
    /* a hollow of your own */
    const h = dbgPair(free.key); fl.nest = h.key; for (const q of F.hollows) q.seen = true;
    if (p.male) { F.mate.mode = 'nest'; F.mate.line = null; F.mate.x = h.inside[0]; F.mate.y = h.inside[1]; }
    const inside = () => { p.mode = 'nest'; p.line = null; fl.inNest = true; p.x = h.inside[0]; p.y = h.inside[1]; };
    if (st === 'nest') { if (!p.male) { inside(); p.eggsN = num('n', 1); } return; }
    fl.laid = true; p.eggsN = p.stats.eggs = G.diff().eggs; F.feed.clock = num('clock', 2);
    if (st === 'sit') { if (!p.male) inside(); else { const q = F.station('fig'); p.setOn(q.line, q.s - 40); } return; }
    if (st === 'bring') { p.crop = G.diff().crop; p.setOn(h.line, h.s); return; }
    if (st === 'chicks' || st === 'done') {
      if (!p.male) inside(); fl.hatched = true; F.chicks = [{ x: h.inside[0] - 9, y: h.inside[1], t: 3 }, { x: h.inside[0] + 9, y: h.inside[1], t: 3 }];
      if (st === 'chicks') p.startEcho(null, 'give'); else { fl.chickName = 'uru'; Story.generationDone(); }
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
    G.forest.update(dt);
    p.update(dt);
    Story.update(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, m = p.mode, F = G.forest;
    const k = clamp(Math.min(W, H) / 600, .62, 1.35) * G.userZoom, top = Math.min(70, H * .1);
    if (!G.started) { const z = clamp(W / 640, 1.1, 2.2), side = W > 720; cam.follow(-1396 + (side ? (W / 2 - Math.max(70, (W - 620) / 4)) / z : 0), -566 - (side ? H * .16 : -H * .3) / z, z); }
    else if (cine) cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (p.stage === 'egg') cam.follow(p.x + 20, p.y - 14, 3.2 * k);
    else if (m === 'nest' || (m === 'echo' && p.backTo === 'nest')) { const z = (p.stage === 'chick' ? 2.6 : 2.3) * k, B = p.nestBox(); cam.follow(lerp(p.x, B.h.door[0], .6), p.y - 26 - top / z, z); }
    else if (m === 'fly') { const z = 1.36 * k; cam.follow(p.x + clamp(p.vx * .45, -120, 120), p.y + clamp(p.vy * .25, -60, 60) - top / z, z); }
    else { const z = (m === 'sleep' ? 1.6 : p.stage === 'chick' ? 2.1 : 1.8) * k; cam.follow(p.x + p.face * 24, p.y - 40 - top / z, z); }
    cam.update(rawDt, F.bounds);
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
      /* time-lapse only where you wait: in the hollow */
      G.warp = G.forest.people ? 1 : p.mode === 'nest' && G.fast ? 3 : p.stage === 'egg' && !p.flags.eggReady ? 2 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.forest.update(rawDt); }
    G.particles.update(dt, () => 0);
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} day ${G.day} tod ${G.tod.toFixed(2)} ${p.stage}/${p.mode} i${p.instar} food=${p.food}/${p.need} ls=${p.flags.ls || '-'} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    AudioFX.update(dt, G.night, false, 0, G.forest.weather.gust, false);
    drawTitle(rawDt);
  }

  /* ---------- the title: the old ironwood in the morning, your mother and father at the door of the hollow.
     The real scene, copied into the title's canvas in either look. ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let titleScene = false;
  function setTitleScene() { const F = G.forest, L = F.line('doorstep'); G.tod = .31; titleScene = true; F.mum.perchAt(L, 34); F.mum.face = 1; F.dad.perchAt(L, 84); F.dad.face = -1; }
  function leaveTitle() { if (!titleScene) return; titleScene = false; const F = G.forest, q = F.station('fig'); G.tod = .36; G.time = 0; F.mum.perchAt(F.line('homehigh'), 40); F.dad.perchAt(q.line, q.s); }
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
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); const p = G.player; if (params.has('stage')) setTimeout(() => { if (p.mode === 'crack') UI.hint('crack'); else if (p.mode === 'preen') UI.hint('preengame'); }, 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'young' }); UI.openJournal(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'parrot', 'go', 'up', 'little', 'big', 'tree', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.wings = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
