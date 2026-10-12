/* ============================================================
   main.js — the game loop, input, the story's director, glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'cream', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('polarbear.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('polarbear.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .3, day: 1, generation: 1, moon: .2, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form, sex: settings.sex,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 240;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;
  /* the director's clocks (null = not set) */
  const T = {};
  const clearT = () => { for (const k in T) delete T[k]; };

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
    G.tod = .3; G.moon = .2; G.year = 0;
    G.players = [new Bear(G, G.form, G.sex)];
    const p = G.player, d = G.world.den;
    p.x = d.cx + 12; p.y = d.cy + 10;
    clearT();
    for (const k in once) delete once[k];
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 5;
    UI.buildWheel();
  }

  function resize() { W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1); Render.resize(W, H, DPR); G.cam.resize(W, H); }
  addEventListener('resize', resize);

  /* ---------- input (only while the game runs; never while typing) ---------- */
  const keys = {};
  const inputState = { padX: 0, padY: 0, hold: false };
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
  const releaseAll = () => { for (const k in keys) keys[k] = false; inputState.padX = inputState.padY = 0; inputState.hold = false; document.querySelectorAll('.dpad button.down').forEach(b => b.classList.remove('down')); };
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
    let hold = !!keys.e || inputState.hold;
    if (g1) { x += g1.x; y += g1.y; if (g1.actionPressed) p1.input.actionPressed = true; if (g1.eggPressed) p1.input.eggPressed = true; if (g1.photoPressed) photo(); if (g1.scopePressed) Microscope.open(G); if (Gamepads.prev[0] && Gamepads.prev[0].b) hold = true; }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    if (x || y) p1.target = null;
    p1.input.x = x; p1.input.y = y; p1.input.hold = hold;
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
  /* the sniff button is held */
  const bd = document.getElementById('btnDash');
  bd.addEventListener('pointerdown', (e) => { e.preventDefault(); bd.setPointerCapture(e.pointerId); if (G.started && !UI.anyModalOpen()) { G.player.input.eggPressed = true; inputState.hold = true; } });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bd.addEventListener(ev, () => { inputState.hold = false; });

  /* tap the ground to go there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* in a play-fight a tap is the push button */
    if (p.mode === 'play') { p.input.actionPressed = true; return; }
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
  const nextBearNote = () => UI.hint(settings.reading === 'simple' ? `Your next bear will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This bear stays as it is.`);
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; UI.buildWheel(); } else nextBearNote(); UI.refreshForms(); },
    onSex: (s) => { settings.sex = s; saveSettings(); if (!G.started) { G.sex = s; G.player.sex = s; } else nextBearNote(); UI.buildForms(document.getElementById('formPick')); UI.buildForms(document.getElementById('formPickDrawer')); UI.refreshForms(); },
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
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Bear(G, G.form, G.sex); G.players = [b]; b.restore(po); });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Stickers.setGeneration(G.generation); UI.buildWheel(); afterRestore(); }
      G.cam.x = G.player.x; G.cam.y = G.player.y;
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else { Voice.say('Welcome back!', { force: true }); UI.hint(resumeHint()); }
  }
  /* put back what a save does not hold: the family where it belongs, the seals, the other bears, the clocks */
  function afterRestore() {
    const p = G.player, Wd = G.world, D = G.diff(), t = G.time, ph = Wd.phase;
    Wd.setSeason(Wd.season);
    if (ph !== 'den' && ph !== 'parent') Wd.setPhase(ph, p);
    if (ph === 'outside' || ph === 'shore' || ph === 'ice2') T.nurse = t + 8;
    if (ph === 'trek' && Wd.route) { const k = Wd.route.findIndex(x => x > p.x + 60); Wd.routeK = k < 0 ? Wd.route.length - 1 : k; }
    if (ph === 'ice') {
      if (!p.flags.feasted && p.stats.waits >= 1 && p.stats.stalks >= D.stalks) T.feast = t + 4;
      if (p.flags.feasted && !p.flags.found) T.lost = t + 5;
      if (p.flags.found) T.breakup = t + 5;
    }
    if (ph === 'breakup') { Wd.route = [WORLD.shoreX - 160]; Wd.routeK = 0; }
    if (ph === 'shore') { if (p.flags.autumn) { Wd.setSeason('autumn'); if (!p.flags.frozen) T.freeze = t + 8; } }
    if (ph === 'ice2') T.meal = t + 20;
    if (ph === 'alone' && p.flags.sparred) T.grown = t + 4;
    if (ph === 'adult') {
      if (p.flags.scentFound && !p.flags.met) spawnMate(p);
      if (p.flags.met) { const m = spawnMate(p); m.x = p.x - 60; m.following = true; m.y = Wd.ground.walkTop(m.x, 22) - m.feet; if (p.sex === 'boy' && !p.flags.sparBig) T.big = t + 6; else T.summer = t + 8; }
    }
    if (ph === 'shore2') { if (p.sex === 'boy' && !p.flags.cubsSeen) T.cubs = t + 8; if (p.sex === 'girl' && !p.flags.denTime) T.denTime = t + 6; }
    if (ph === 'parent' && Wd.newDen) {
      Wd.setPhase('parent', p);
      if (p.flags.cubsBorn && !p.flags.cubsOut) Wd.makeOwnCubs(true);
      if (p.flags.cubsOut) Wd.makeOwnCubs(false);
      if (!p.flags.cubsBorn) T.born = t + 6;
      if (p.flags.cubsBorn && p.stats.nurses >= D.nurses && !p.stats.carries) T.wander = t + 5;
      if (p.flags.cubsBorn && p.stats.carries && !p.flags.cubsOut) T.breakout = t + 2;
    }
    if (p.flags.lostMum) p.flags.lostMum = false;
    if (p.mode === 'burrow' && !p.flags.inDen && p.flags.denMade) p.flags.inDen = true;
    if (p.flags.cubsSeen && !p.flags.genDone) later(1500, () => P().milestone('cubs', generationDone));
  }
  function resumeHint() {
    const p = G.player, ph = G.world.phase;
    if (p.age === 1) return p.flags.eyesOpen ? 'eyes' : 'drink';
    if (p.age === 2) return 'play';
    if (p.age === 3) return ph === 'trek' ? 'trek' : ph === 'ice' ? (p.flags.feasted ? 'seaice' : 'hole') : ph === 'breakup' ? 'breakup' : 'shore';
    if (p.age === 4) return p.flags.alone ? 'alone' : 'yearling';
    if (ph === 'adult') return p.flags.met ? (p.sex === 'boy' ? 'bigmale' : 'together') : 'scent';
    if (ph === 'shore2') return p.sex === 'girl' ? 'denhill' : 'summer';
    if (!p.flags.cubsBorn) return p.flags.denMade ? 'inside' : 'den';
    return p.flags.cubsOut ? 'firstsniff' : p.stats.nurses >= G.diff().nurses ? 'wanderer' : 'nursecubs';
  }

  /* ---------- events → hints, facts, cinematics ---------- */
  const P = () => G.player;
  const once = {};
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* timers that outlive a New Game must not act on the new one */
  const later = (ms, fn) => { const W0 = G.world; setTimeout(() => { if (G.world === W0) fn(); }, ms); };
  const fact = (k, ms = 0) => ms ? later(ms, () => Bus.emit('fact', k)) : Bus.emit('fact', k);
  const sleepCine = (title, dur = 3.2) => Cinematic.play({ follow: P, zoom: 3, duration: dur, slow: .6, title });
  function spawnMate(p) {
    const Wd = G.world; let m = Wd.mate(); if (m) return m;
    const boy = p.sex === 'boy';
    m = new BearNPC(Wd, { role: 'mate', sex: boy ? 'girl' : 'boy', form: boy ? 'snow' : 'gold', kg: boy ? 210 : 430, x: clamp(p.x + 520, WORLD.left + 80, WORLD.iceR - 60) });
    m.goal = p.x + 70; m.mode = 'walk'; m.roam = 0; Wd.pack.push(m);
    return m;
  }
  function placeP(x) { const p = P(), S = G.world.ground; p.x = x; p.y = S.walkTop(x, p.span()) - p.feet; }
  Bus.on('started', () => { UI.hint('born'); fact('den', 1800); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a newborn polar bear cub. It is dark in the snow den. Find your mum.' : 'You are a newborn polar bear cub, tiny and blind in a snow den in the middle of winter. Your mother is close: find her by her warmth.', { force: true }); later(6000, () => { if (P().age === 1) UI.hint('drink'); }); fact('blind', 14000); fact('twins', 30000); fact('milk', 50000); });
  Bus.on('firstDrink', () => { UI.hint('crawl'); fact('hum', 6000); fact('fast', 22000); });
  Bus.on('eyesOpen', () => { AudioFX.magic(); UI.hint('eyes'); fact('eyes'); Cinematic.play({ follow: P, zoom: 6, duration: 3, slow: .5, title: 'My eyes are open!' }); });
  Bus.on('grewUp', (p, age) => {
    const Wd = G.world;
    if (age === 2) { Wd.setSeason('spring'); Wd.setPhase('outside', p); G.day += 80; G.tod = .42; sleepCine('March: out into the light!'); later(3400, () => { UI.hint('play'); fact('out'); fact('play', 12000); fact('slide', 30000); }); T.nurse = G.time + 16; }
    else if (age === 3) { Wd.setPhase('trek', p); G.day += 12; G.tod = .38; sleepCine('Two weeks later: the long walk to the sea'); later(3400, () => { UI.hint('trek'); fact('trek'); fact('tracks', 20000); }); Stickers.lifeDone(G.form, G.sex); }
    else if (age === 4) { Wd.springIce(); Wd.setPhase('ice2', p); G.day += 120; G.year++; G.tod = .4; sleepCine('Winter passes. One year old!'); later(3400, () => { UI.hint('yearling'); fact('yearling'); later(9000, () => { if (P().age === 4 && !P().flags.soloWait) UI.hint('solo'); }); }); T.meal = G.time + 30; T.nurse = G.time + 14; }
    else if (age === 5) { Wd.setPhase('adult', p); G.day += 700; G.year += 2; G.tod = .4; sleepCine('Years go by: a grown polar bear'); later(3400, () => { UI.hint('grown'); fact(p.sex === 'boy' ? 'big' : 'roam'); later(5000, () => { if (!P().flags.scentFound) UI.hint('scent'); }); }); }
    AudioFX.fanfare();
  });
  Bus.on('playStart', (p, n) => { UI.hint('playfight'); if (n && (n.role === 'young' || n.role === 'bigmale')) { fact('spar'); Bus.emit('sparStart', p); } });
  Bus.on('firstPlay', () => fact('play'));
  Bus.on('playWon', (p) => { UI.hint('won'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 20, 40); });
  Bus.on('playLost', () => UI.hint('lost'));
  Bus.on('playEnd', (p, n) => {
    if (!n) return;
    if (n.role === 'young' && !p.flags.sparred) { p.flags.sparred = true; T.grown = G.time + 6; }
    if (n.role === 'bigmale' && p.flags.met && !p.flags.sparBig) { p.flags.sparBig = true; const m = G.world.mate(); if (m) m.leave(1); T.summer = G.time + 5; }
  });
  Bus.on('firstWindSniff', () => { UI.hint('sniffwind'); fact('standup'); fact('nose', 15000); });
  Bus.on('windSniff', (p) => { G.particles.howlRings(p.x + p.face * p.w * .4, p.y - p.h * 1.2, 'rgba(200,230,255,.7)'); });
  Bus.on('slideStart', () => { if (first('slideFact')) fact('slide'); });
  Bus.on('slid', () => UI.hint('slid'));
  Bus.on('foxNear', () => { UI.hint('fox'); fact('fox'); });
  Bus.on('fullBear', (p) => { if (p.age === 2) UI.hint('twin'); });
  Bus.on('firstPounce', () => { UI.hint('away'); fact('lemming'); });
  Bus.on('firstSniff', () => { fact('nose'); });
  Bus.on('storm', () => { UI.hint('storm'); fact('blizzard'); });
  Bus.on('sheltered', () => { UI.hint('shelter'); T.blizzEnd = Math.min(T.blizzEnd || 1e9, G.time + 6); });
  Bus.on('firstTrack', () => { UI.hint('tracks'); });
  Bus.on('looked', (p, t) => { if (Reading.on()) UI.hint('tracks'); else UI.hint(TRACK_KINDS[t.kind].say, true); });
  Bus.on('swimStart', (p) => { UI.hint('swim'); fact('swim'); if (p.age <= 3) fact('ride', 8000); AudioFX.splash(); });
  Bus.on('cold', () => { UI.hint('cold'); fact('fat'); });
  Bus.on('tooCold', () => { G.particles.puff(P().x, P().y, '#fff', 6); });
  Bus.on('rested', () => { UI.hint('rest'); });
  Bus.on('onIce', (p) => { const Wd = G.world; if (Wd.phase === 'trek') { Wd.setPhase('ice', p); UI.hint('seaice'); fact('seaice'); fact('holes', 9000); later(7000, () => { if (P().stats.waits === 0 && G.world.phase === 'ice') UI.hint('hole'); }); } });
  Bus.on('stillStart', () => { UI.hint('still'); fact('still'); });
  Bus.on('sealUp', () => { AudioFX.puff && AudioFX.puff(); });
  Bus.on('waited', (p) => { UI.hint('seal'); AudioFX.splash(); checkHunts(p); if (p.age === 4 && !p.flags.soloStalk) later(4000, () => UI.hint('practise')); });
  Bus.on('stalkStart', () => { UI.hint('creep'); fact('stalk'); });
  Bus.on('sealLooks', () => { const p = P(); if (p.mode === 'stalk') UI.hint('freezeNow'); });
  Bus.on('stalked', (p, how) => { UI.hint(how === 'close' ? 'close' : 'spotted'); AudioFX.splash(); later(4000, () => { const q = P(), Wd = G.world; if (Wd.bask && Wd.bask.state === 'gone' && ['ice', 'ice2', 'alone'].includes(Wd.phase)) Wd.makeBask(clamp(q.x + 380 * (q.x > WORLD.holes[2] ? -1 : 1), WORLD.shoreX + 260, WORLD.iceR - 200)); }); checkHunts(p); if (p.age === 4 && !p.flags.soloWait) later(4000, () => UI.hint('solo')); });
  function checkHunts(p) { const Wd = G.world, D = G.diff(); if (Wd.phase === 'ice' && !p.flags.feasted && T.feast === undefined && p.stats.waits >= 1 && p.stats.stalks >= D.stalks) T.feast = G.time + 5; else if (Wd.phase === 'ice' && !p.flags.feasted && p.stats.waits >= 1 && Wd.bask && Wd.bask.state === 'bask') later(3000, () => UI.hint('bask')); }
  Bus.on('ateMeal', (p) => {
    const Wd = G.world;
    if (p.age === 3 && !p.flags.feasted) { p.flags.feasted = true; UI.hint('ate'); fact('meal'); AudioFX.fanfare(); p.mode = 'sleep'; p.sleepT = SLEEP_T; G.day += 3; sleepCine('A feast, then a long sleep'); const m = Wd.mum(); if (m) { m.mode = 'lie'; } T.lost = G.time + 16; Bus.emit('feast', p); }
    else UI.hint('ate');
    const m = Wd.mum(); if (m && Wd.phase === 'ice2') { m.mode = 'still'; m.still = true; }
  });
  Bus.on('lostMum', (p) => { p.flags.lostMum = true; UI.hint('lostmum'); fact('nose'); });
  Bus.on('sniffGame', (p, kind) => { if (kind === 'scent') UI.hint('scent'); else if (kind === 'cubs') UI.hint('firstsniff'); else UI.hint('lostmum'); });
  Bus.on('goodSniff', (p) => { G.particles.howlRings(p.x + p.face * p.w * .4, p.y - p.h * 1.2, 'rgba(200,230,255,.8)'); });
  Bus.on('mumFound', (p) => { const Wd = G.world; Wd.familyCameBack(p); Wd.setWeather('clear', 80); UI.hint('found'); AudioFX.fanfare(); T.breakup = G.time + 12; });
  Bus.on('ridge', () => { UI.hint('ridge'); fact('ridge'); });
  Bus.on('leadSwim', () => { UI.hint('lead'); fact('lead'); });
  Bus.on('ashore', (p) => { const Wd = G.world; Wd.openSea(); Wd.setPhase('shore', p); G.day += 14; G.tod = .1; UI.hint('shore'); fact('shore'); fact('sun', 12000); fact('hot', 40000); Cinematic.play({ follow: P, zoom: 2.2, duration: 3, slow: .6, title: 'Summer on the shore' }); T.nurse = G.time + 20; });
  Bus.on('scientistMet', () => { UI.hint('scientist'); fact('scientist'); });
  Bus.on('aurora', () => { UI.hint('aurora'); fact('aurora'); Cinematic.play({ follow: () => ({ x: P().x, y: P().y - 160 }), zoom: 1.2, duration: 4, slow: .6, title: 'The northern lights' }); });
  Bus.on('freezeUp', () => { UI.hint('freeze'); fact('freeze'); });
  Bus.on('wentAlone', (p) => { const Wd = G.world; Wd.setPhase('alone', p); G.day += 380; G.year++; G.tod = .4; placeP(WORLD.holes[1] + 120); p.face = 1; sleepCine('Two and a half years old: on my own', 3.6); later(3600, () => { UI.hint('alone'); fact('leave'); fact('nanuq', 30000); }); });
  Bus.on('scentFound', (p) => { spawnMate(p); UI.hint('meet'); AudioFX.chuff && AudioFX.chuff(); });
  Bus.on('met', (p, o) => {
    if (!o || o.role !== 'mate') return;
    UI.hint('together'); fact('mate'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 20, 50);
    Cinematic.play({ follow: () => ({ x: (P().x + o.x) / 2, y: P().y - 20 }), zoom: 2.4, duration: 3.5, slow: .5, title: 'A walk together' });
    if (p.sex === 'boy') T.big = G.time + 12; else { T.mateLeave = G.time + 12; T.summer = G.time + 16; }
  });
  Bus.on('digStart', () => { UI.hint('dig'); });
  Bus.on('deepEnough', (p) => { if (p.denReady()) UI.hint('denready'); });
  Bus.on('denMade', (p) => {
    const Wd = G.world; AudioFX.magic(); Cinematic.play({ follow: P, zoom: 2.8, duration: 3, slow: .6, title: 'A den of my own' });
    Wd.setPhase('parent', p); T.born = G.time + 6; later(3200, () => UI.hint('inside'));
  });
  Bus.on('carrying', () => { UI.hint('carrying'); });
  Bus.on('firstNurse', () => { fact('milk'); });
  Bus.on('nursed', (p) => { if (p.stats.nurses >= G.diff().nurses) T.wander = G.time + 4; else UI.hint('nursecubs'); });
  Bus.on('cubHome', () => { UI.hint('cubsout'); fact('carry'); T.breakout = G.time + 1.5; });
  Bus.on('cubsOut', (p) => { UI.hint('firstsniff'); fact('out'); Cinematic.play({ follow: () => ({ x: G.world.newDen.x + 30, y: G.world.newDen.y - 20 }), zoom: 2.6, duration: 4, slow: .6, title: 'The cubs come out!' }); });
  Bus.on('cubsSniff', () => generationDone());
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    UI.hint('newcubs'); fact('lifecycle'); fact('warming', 9000);
    AudioFX.fanfare();
    Bus.emit('generationDone'); UI.refreshToggles();
    const open = () => { if (Reading.busy() || Cinematic.active) later(800, open); else UI.choice(); };
    later(3000, open);
  }

  /* ---------- the director: nursing, the blizzard, the hunts and the feast, the whiteout, the
     ice breaking up, summer and autumn, freeze-up, Mum's meals, growing up, the other bears, the den ---------- */
  const due = (k) => T[k] !== undefined && G.time > T[k] && (delete T[k], true);
  function director(dt) {
    const p = G.player, Wd = G.world, D = G.diff(), t = G.time, S = Wd.ground;
    const night = nightAmount(G.tod) > .5;
    if (lastNight !== null && night !== lastNight && p.age >= 2 && p.mode === 'walk' && first('nightHint' + night)) { if (night) UI.hint('night'); }
    lastNight = night;
    const mum = Wd.mum();
    /* Mum lies down to nurse now and then (by the den, on the shore, between hunts as a yearling) */
    if (mum && ['outside', 'shore', 'ice2'].includes(Wd.phase) && p.age <= 4 && T.nurse !== undefined && t > T.nurse && p.mode === 'walk' && !mum.nurseOn && !mum.inDen) {
      T.nurse = t + 24 + Math.random() * 8;
      if (Wd.phase === 'ice2' && mum.still) { mum.still = false; }
      mum.mode = 'lie'; mum.nurseOn = true; mum.nursed = 0; mum.nurseUntil = t + 26; mum.roam = 0;
      UI.hint('nurse');
    }
    if (mum && mum.nurseOn && (mum.nursed > 0 || t > mum.nurseUntil)) { mum.nurseOn = false; if (Wd.phase === 'ice2') { mum.mode = 'still'; mum.still = true; } else if (Wd.phase === 'shore') mum.roam = 40; }
    /* the walk to the sea: a spring blizzard near the big rock; the family shelters in its lee */
    if (Wd.phase === 'trek' && !p.flags.blizzard && p.x > WORLD.rockX - 280 && p.mode === 'walk') {
      p.flags.blizzard = true; Wd.setWeather('blizzard', 60); T.blizzEnd = t + (settings.visitors ? 40 : 6);
      Wd.route.splice(Wd.routeK, 0, WORLD.rockX + 20); Bus.emit('storm', p);
    }
    if (Wd.phase === 'trek' && Wd.weather.state === 'blizzard' && mum && Math.abs(mum.x - WORLD.rockX - 20) < 12) { mum.mode = 'lie'; Wd.travelPaused = true; }
    if (due('blizzEnd')) { Wd.setWeather('clear', 90); Wd.travelPaused = false; if (mum && Wd.phase === 'trek') mum.mode = 'stand'; }
    /* the spring sea ice: Mum finds a meal once you have watched at a hole and crept up on a seal */
    if (due('feast') && !p.flags.feasted && mum) { mum.still = false; mum.mode = 'lie'; const x = mum.x + 40; Wd.spawnMeal(x); UI.hint('feast'); Bus.emit('mumMeal', p); }
    /* one day a whiteout: Mum walks on into the snow and you must sniff the wind to find her */
    if (T.lost !== undefined && t > T.lost && Wd.phase === 'ice' && p.flags.feasted && !p.flags.found && !p.flags.lostMum && !Wd.lostMode && p.mode === 'walk') {
      delete T.lost; Wd.setWeather('blizzard', 120); Wd.lostMode = { x: p.x + 900 };
      for (const n of Wd.pack) { n.still = false; n.mode = 'walk'; n.goal = clamp(p.x + 900 + (n.role === 'twin' ? -40 : 0), WORLD.shoreX + 200, WORLD.iceR - 100); n.roam = 0; }
      later(2500, () => { if (!P().flags.found) Bus.emit('lostMum', P()); });
    }
    /* early summer: the ice breaks up, and the family swims for the shore */
    if (T.breakup !== undefined && t > T.breakup && p.mode === 'walk' && Wd.phase === 'ice') {
      delete T.breakup; Wd.breakup(); Wd.setPhase('breakup', p); G.day += 45; G.tod = .45;
      UI.hint('breakup'); fact('breakup');
      Cinematic.play({ follow: () => ({ x: P().x - 140, y: P().y - 40 }), zoom: 1.4, duration: 4, slow: .7, title: 'Summer: the ice breaks up' });
    }
    if (Wd.phase === 'breakup' && Wd.pack.some(n => n.swimming) && first('rideFact')) fact('ride');
    /* summer on the shore → autumn (the northern lights) → freeze-up */
    if (Wd.phase === 'shore' && p.age === 3 && !p.flags.autumn && Wd.buggy && Wd.buggy.met && p.stats.pounces >= 1 && T.autumn === undefined) T.autumn = t + 8;
    if (due('autumn') && Wd.phase === 'shore') { p.flags.autumn = true; Wd.setSeason('autumn'); Wd.setWeather('clear', 150); G.day += 70; G.tod = .86; sleepCine('Autumn: the nights come back', 3); T.freeze = t + 22; }
    if (T.freeze !== undefined && t > T.freeze && p.mode === 'walk' && Wd.phase === 'shore') { delete T.freeze; Wd.freezeUp(); p.flags.frozen = true; G.day += 50; G.tod = .4; }
    /* the yearling's spring: Mum still finds meals to share */
    if (Wd.phase === 'ice2' && p.age === 4 && T.meal !== undefined && t > T.meal && p.mode === 'walk' && !Wd.meal && mum && p.food < D.grow[3]) {
      T.meal = t + 34; mum.still = false; mum.mode = 'lie'; Wd.spawnMeal(mum.x + 44); UI.hint('mealtime');
    }
    /* on your own: after play-sparring with the young males, years go by */
    if (T.grown !== undefined && t > T.grown && p.mode === 'walk' && p.age === 4 && p.flags.alone) { delete T.grown; p.growUp(); }
    if (Wd.phase === 'alone' && Math.abs(p.x - WORLD.sparX) < 380 && first('sparHint')) UI.hint('sparring');
    /* grown: a big male (boy), the bear you met walks off (girl), then summer */
    if (due('big') && p.sex === 'boy' && Wd.phase === 'adult' && !Wd.pack.some(n => n.role === 'bigmale')) { const b = new BearNPC(Wd, { role: 'bigmale', sex: 'boy', form: 'gold', kg: 440, x: clamp(p.x - 460, WORLD.shoreX + 300, WORLD.iceR - 100) }); b.goal = p.x - 90; b.mode = 'walk'; Wd.pack.push(b); UI.hint('bigmale'); fact('big'); }
    if (due('mateLeave')) { const m = Wd.mate(); if (m) m.leave(1); }
    if (T.summer !== undefined && t > T.summer && p.mode === 'walk' && Wd.phase === 'adult') {
      delete T.summer; Wd.breakup(); Wd.openSea(); Wd.setPhase('shore2', p); placeP(WORLD.shoreL + (p.sex === 'boy' ? 120 : 60)); p.face = 1; G.day += 90; G.tod = .2;
      p.mode = 'sleep'; p.sleepT = SLEEP_T; sleepCine('Summer on the shore');
      later(3400, () => { UI.hint('summer'); fact('shore'); });
      if (p.sex === 'boy') T.cubs = t + 16; else T.denTime = t + 12;
    }
    /* the boy's ending: next spring, far away on the den hills, new cubs come out of a snow den */
    if (T.cubs !== undefined && t > T.cubs && p.mode === 'walk' && Wd.phase === 'shore2') {
      delete T.cubs; p.flags.cubsSeen = true; G.day += 240; G.tod = .42;
      Wd.winter(true); Wd.setSeason('spring');
      const d = Wd.den, mo = new BearNPC(Wd, { role: 'mother', sex: 'girl', form: 'cream', kg: 180, x: d.x + 70 }); mo.mode = 'lie'; mo.roam = 0; mo.collar = true; Wd.pack.push(mo);
      Wd.cubs = [0, 1].map(k => { const q = new BearNPC(Wd, { role: 'owncub', sex: k ? 'girl' : 'boy', form: k ? 'snow' : G.form, kg: 11, x: d.x + 120 + k * 30 }); q.home = q.x; q.roam = 60; return q; });
      Cinematic.play({ follow: () => ({ x: G.world.den.x + 110, y: G.world.ground.walkTop(G.world.den.x + 110, 10) - 30 }), zoom: 2.2, duration: 5, slow: .6, title: 'Next spring, on the den hills: new cubs!' });
      later(5400, () => P().milestone('cubs', generationDone));
    }
    /* the girl's ending: back to the den hills in autumn to dig a den */
    if (due('denTime') && p.sex === 'girl') { p.flags.denTime = true; Wd.setSeason('autumn'); G.day += 60; G.tod = .4; UI.hint('denhill'); fact('digden'); fact('home', 20000); }
    if (T.born !== undefined && t > T.born && p.mode === 'burrow') {
      delete T.born; p.flags.cubsBorn = true; Wd.winter(true); Wd.makeOwnCubs(true); G.day += 50;
      p.mode = 'sleep'; p.sleepT = SLEEP_T; p.flags.inDen = true;
      sleepCine('Midwinter, deep in the den…'); later(3400, () => { UI.hint('inside'); Bus.emit('cubsBorn', P()); });
    }
    if (due('wander') && Wd.cubs.length && Wd.newDen) {
      for (const c of Wd.cubs) c.kg = 6; const q = Wd.cubs[0]; q.wandered = true; q.inDen = false; q.mode = 'sit'; q.x = Wd.newDen.x - Wd.newDen.dir * 16; q.y = S.walkTop(q.x, 22) - q.feet; UI.hint('wanderer');
    }
    for (const q of Wd.cubs) if (q.wandered && !q.inDen) { q.mode = 'sit'; q.roam = 0; }
    if (due('breakout') && Wd.newDen) {
      p.flags.cubsOut = true; Wd.setSeason('spring'); Wd.makeOwnCubs(false); G.day += 70; G.tod = .42;
      if (p.mode === 'burrow') p.surface(); placeP(Wd.newDen.x - Wd.newDen.dir * 30); p.mode = 'walk'; p.face = -Wd.newDen.dir;
      Bus.emit('cubsOut', p);
    }
    /* breath in the cold, snow kicked up */
    if (Wd.season !== 'summer' && p.moving && !p.underground && Math.random() < dt * 3) G.particles.breath(p.x + p.face * p.w * .55, p.y - p.h * .2, p.face);
    if (Wd.ground.snowOn && p.moving && p.age >= 3 && Math.random() < dt * 3) G.particles.snowKick(p.x - p.face * p.w * .3, p.y + p.feet, 1);
  }
  let lastNight = null;

  /* ---------- debug jumps (?stage=…) ---------- */
  function toAge(age, x, frac = .4) {
    const p = G.player, Wd = G.world, th = [0, ...G.diff().grow];
    p.age = age; p.food = age < 5 ? th[age - 1] + (th[age] - th[age - 1]) * frac : G.diff().grow[3] * (1 + (BONUS - 1) * frac); p.full = false;
    p.kg = bearKG(age, p.food, G.diff().grow, p.sex);
    p.flags.eyesOpen = age >= 2 || frac > .5; p.flags.drank = true;
    if (age >= 2) { p.mode = 'walk'; p.flags.played = true; p.flags.sniffedWind = true; }
    if (age >= 3) { p.flags.onIce = true; }
    p.x = x; p.y = Wd.ground.walkTop(x, p.span()) - p.feet; p.face = 1; G.tod = .4;
    Cinematic.stop();
  }
  function digHome(p, depth) {
    const S = G.world.ground, gx = p.x, g = S.surfaceAt(gx);
    for (let d = 0; d <= depth; d += 3) S.blob(gx - d * 1.1, g + d, Math.max(22, p.h * .55), Math.max(20, p.h * .5), MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL);
    S.flushTop(); p.burrow = { x: gx, y: g }; p.mode = 'burrow'; p.x = gx - depth * 1.1; p.y = g + depth; p.ang = Math.atan2(.6, -.8); p.face = -1;
  }
  function toSummer() { const Wd = G.world; Wd.breakup(); Wd.openSea(); }
  function toAdult(x) { toAge(5, x, .3); const p = G.player; Object.assign(p.flags, { alone: true, sparred: true, feasted: true, found: true, summer: true, autumn: true, frozen: true, soloWait: true, soloStalk: true }); const Wd = G.world; Wd.springIce(); Wd.setPhase('adult', p); }
  function toDenTime(x) { toAdult(x); const p = G.player, Wd = G.world; p.sex = 'girl'; G.sex = 'girl'; p.flags.scentFound = p.flags.met = true; toSummer(); Wd.setPhase('shore2', p); Wd.setSeason('autumn'); p.flags.denTime = true; p.kg = bearKG(5, p.food, G.diff().grow, 'girl'); placeP(x); }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world, p = G.player, frac = +(params.get('frac') || .5), D = G.diff();
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'rain') { wx.rain = 1; wx.cloud = 1; } if (s === 'snowfall') { wx.snow = 1; wx.cloud = .9; } if (s === 'blizzard') { wx.snow = 1; wx.white = 1; wx.cloud = 1; } }
    if (!st) return;
    const d = Wd.den;
    if (st === 'newborn' || st === 'den') { p.food = D.grow[0] * frac * .3; }
    else if (st === 'eyes') { p.flags.eyesOpen = true; p.food = D.grow[0] * .6; }
    else if (st === 'cub') { toAge(2, d.x + 90, frac); Wd.setSeason('spring'); Wd.setPhase('outside', p); }
    else if (st === 'play') { toAge(2, d.x + 90, frac); Wd.setSeason('spring'); Wd.setPhase('outside', p); const s = Wd.twin(); s.x = p.x + 30; s.mode = 'stand'; p.startPlay(s); p.wr.p = +(params.get('wp') || .3); p.wr.ring = 1.4; }
    else if (st === 'slide') { toAge(2, d.x + 70, frac); Wd.setSeason('spring'); Wd.setPhase('outside', p); p.startSlide(); p.sl.v = 120; }
    else if (st === 'nurse') { toAge(2, d.x + 70, frac); Wd.setSeason('spring'); Wd.setPhase('outside', p); T.nurse = G.time + .2; }
    else if (st === 'trek') { toAge(3, d.x + 400, .1); Wd.setSeason('spring'); Wd.setPhase('trek', p); }
    else if (st === 'blizzard') { toAge(3, WORLD.rockX - 90, .15); Wd.setSeason('spring'); Wd.setPhase('trek', p); p.flags.blizzard = true; Wd.setWeather('blizzard', 60); Wd.weather.white = 1; Wd.weather.snow = 1; Wd.weather.cloud = 1; const m = Wd.mum(); m.x = WORLD.rockX + 20; m.mode = 'lie'; Wd.travelPaused = true; }
    else if (st === 'seaice' || st === 'ice') { toAge(3, WORLD.holes[0] - 200, .2); Wd.setSeason('spring'); Wd.setPhase('ice', p); }
    else if (st === 'hole' || st === 'still') { toAge(3, WORLD.holes[0] + 26, .2); Wd.setSeason('spring'); Wd.setPhase('ice', p); p.face = -1; p.startStill(Wd.holes[0]); p.st.q = +(params.get('q') || .6); if (st === 'still' && p.st.q >= 1) Wd.sealUp(Wd.holes[0]); }
    else if (st === 'sealup') { toAge(3, WORLD.holes[0] + 26, .2); Wd.setSeason('spring'); Wd.setPhase('ice', p); p.face = -1; p.startStill(Wd.holes[0]); p.st.q = 1; p.st.done = 'up'; Wd.sealUp(Wd.holes[0]); }
    else if (st === 'stalk') { toAge(3, WORLD.holes[0] + 260, .2); Wd.setSeason('spring'); Wd.setPhase('ice', p); p.stats.waits = 1; p.startStalk(); Wd.bask.look = +(params.get('look') || 0); Wd.bask.lookHold = Wd.bask.look > .5 ? 2 : 0; }
    else if (st === 'feast') { toAge(3, WORLD.holes[0] - 60, .3); Wd.setSeason('spring'); Wd.setPhase('ice', p); p.stats.waits = 1; p.stats.stalks = D.stalks; T.feast = G.time + .3; }
    else if (st === 'lost') { toAge(3, WORLD.holes[0] + 100, .9); Wd.setSeason('spring'); Wd.setPhase('ice', p); p.flags.feasted = true; p.full = true; Wd.setWeather('blizzard', 120); Wd.weather.white = 1; Wd.weather.snow = 1; Wd.weather.cloud = 1; Wd.lostMode = { x: p.x + 900 }; for (const n of Wd.pack) n.x = p.x + 900; p.flags.lostMum = true; p.input.hold = true; p.startSniffGame(); p.sw.held = true; p.sw.ring = 1.8; }
    else if (st === 'breakup') { toAge(3, WORLD.shoreX + 700, .9); p.flags.feasted = p.flags.found = true; p.full = true; Wd.breakup(); Wd.setPhase('breakup', p); G.tod = .45; }
    else if (st === 'shore' || st === 'summer3') { toAge(3, WORLD.shoreL + 40, .9); p.flags.feasted = p.flags.found = p.flags.summer = true; p.full = true; toSummer(); Wd.setPhase('shore', p); G.tod = .1; }
    else if (st === 'scientist') { toAge(3, WORLD.buggyX - 130, .9); p.flags.feasted = p.flags.found = p.flags.summer = true; p.full = true; toSummer(); Wd.setPhase('shore', p); G.tod = .5; }
    else if (st === 'lemming') { toAge(3, WORLD.tundraR - 500, .9); p.flags.feasted = p.flags.found = p.flags.summer = true; p.full = true; toSummer(); Wd.setPhase('shore', p); G.tod = .55; }
    else if (st === 'aurora' || st === 'autumn') { toAge(3, WORLD.shoreL - 60, .9); p.flags.feasted = p.flags.found = p.flags.summer = p.flags.autumn = true; p.full = true; toSummer(); Wd.setPhase('shore', p); Wd.setSeason('autumn'); G.tod = .95; Wd.aurora = 1; Wd.auroraSeen = true; Wd.weather.cloud = 0; Wd.weather.state = 'clear'; Wd.weather.timer = 200; }
    else if (st === 'freeze') { toAge(3, WORLD.shoreX - 100, .9); p.flags.feasted = p.flags.found = p.flags.summer = p.flags.autumn = true; toSummer(); Wd.setPhase('shore', p); Wd.freezeUp(); G.tod = .35; }
    else if (st === 'yearling' || st === 'solo') { toAge(4, WORLD.holes[0] + 70, .3); Object.assign(p.flags, { feasted: true, found: true, summer: true, autumn: true, frozen: true }); Wd.springIce(); Wd.setPhase('ice2', p); if (st === 'solo') { p.x = WORLD.holes[0] + 26; p.face = -1; p.startStill(Wd.holes[0]); p.st.q = .5; } }
    else if (st === 'alone') { toAge(4, WORLD.holes[1] + 120, .7); Object.assign(p.flags, { feasted: true, found: true, summer: true, autumn: true, frozen: true, soloWait: true, soloStalk: true, alone: true }); Wd.springIce(); Wd.setPhase('alone', p); }
    else if (st === 'ridge') { toAge(4, WORLD.ridges[1] - 120, .7); Object.assign(p.flags, { alone: true, soloWait: true, soloStalk: true }); Wd.springIce(); Wd.setPhase('alone', p); }
    else if (st === 'lead') { toAge(4, WORLD.leadL + 60, .7); Object.assign(p.flags, { alone: true, soloWait: true, soloStalk: true }); Wd.springIce(); Wd.setPhase('alone', p); }
    else if (st === 'spar') { toAge(4, WORLD.sparX - 90, .7); Object.assign(p.flags, { alone: true, soloWait: true, soloStalk: true }); Wd.springIce(); Wd.setPhase('alone', p); const n = Wd.pack[0]; p.startPlay(n); p.wr.p = +(params.get('wp') || .3); p.wr.ring = 1.4; }
    else if (st === 'adult' || st === 'grown') toAdult(WORLD.sparX - 200);
    else if (st === 'scent') { toAdult(WORLD.sparX - 200); p.input.hold = true; p.startSniffGame(); p.sw.held = true; p.sw.ring = 1.8; }
    else if (st === 'meet') { toAdult(WORLD.sparX - 200); p.flags.scentFound = true; const m = spawnMate(p); m.x = p.x + 90; m.goal = m.x; m.mode = 'stand'; m.face = -1; m.y = Wd.ground.walkTop(m.x, 22) - m.feet; }
    else if (st === 'bigmale') { toAdult(WORLD.sparX - 200); p.sex = 'boy'; G.sex = 'boy'; p.flags.scentFound = p.flags.met = true; const m = spawnMate(p); m.x = p.x - 80; m.following = true; m.mode = 'stand'; const b = new BearNPC(Wd, { role: 'bigmale', sex: 'boy', form: 'gold', kg: 440, x: p.x + 70 }); b.mode = 'stand'; b.face = -1; Wd.pack.push(b); if (params.has('wp')) { p.startPlay(b); p.wr.p = +params.get('wp'); p.wr.ring = 1.4; } }
    else if (st === 'shore2') { toAdult(WORLD.shoreL + 120); p.sex = 'boy'; G.sex = 'boy'; p.flags.scentFound = p.flags.met = p.flags.sparBig = true; toSummer(); Wd.setPhase('shore2', p); G.tod = .5; }
    else if (st === 'cubsseen') { toAdult(WORLD.shoreL + 120); p.sex = 'boy'; G.sex = 'boy'; p.flags.scentFound = p.flags.met = p.flags.sparBig = true; toSummer(); Wd.setPhase('shore2', p); T.cubs = G.time + .2; }
    else if (st === 'denhill') { toDenTime(WORLD.bankR + 260); }
    else if (st === 'dig') { toDenTime(WORLD.bankL + 220); digHome(p, p.h * 1.1); }
    else if (['denmade', 'inside', 'nursecubs', 'carry', 'cubsout'].includes(st)) {
      toDenTime(WORLD.bankL + 220); digHome(p, p.denDepth() + 8); p.makeDen(); Cinematic.stop(); Wd.setPhase('parent', p); T.born = undefined; delete T.born;
      if (st !== 'denmade') { p.flags.cubsBorn = true; Wd.winter(true); Wd.makeOwnCubs(true); }
      if (st === 'carry') { p.stats.nurses = D.nurses; T.wander = G.time + .2; }
      if (st === 'cubsout') { p.stats.nurses = D.nurses; p.stats.carries = 1; T.breakout = G.time + .2; }
    }
    if (params.has('warmth')) p.warmth = +params.get('warmth');
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
    if (settings.clock) { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    director(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.mode === 'den') cam.follow(p.x, p.y, 4.2 * uz);
    else if (p.mode === 'play' && p.wr) cam.follow(p.wr.mid, p.y - p.h * .5, clamp(130 / (p.w + 20), 1.1, 3.2) * uz);
    else if (p.mode === 'stalk' && G.world.bask) cam.follow((p.x + G.world.bask.x) / 2, p.y - 40, clamp(520 / (Math.abs(G.world.bask.x - p.x) + 200), 1, 2.6) * uz);
    else if (p.mode === 'still') cam.follow(p.x, p.y - p.h * .4, clamp(170 / (p.w + 30), 1.6, 3.6) * uz);
    else if (p.mode === 'sniff') cam.follow(p.x, p.y - p.h, 2.2 * uz);
    else {
      const z = clamp(170 / (p.w + 16), 1.2, 4.5) * (p.underground ? 1.3 : 1);
      cam.follow(p.x + p.face * p.w * .6, p.y - (p.underground ? 0 : p.h * 1.1 + 110 / z), z * uz);
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
    if (G.started && !modal) readInput(); else { p.input.x = p.input.y = 0; p.input.hold = false; }
    if (G.started && modal && Reading.busy()) Reading.gamepad(Gamepads.poll());
    else if (modal || !G.started) padMenus(Gamepads.poll());
    if (G.started && !modal) {
      /* time-lapse (F), and a fast-forward while the bear just waits: a sleep, a rest */
      const waiting = ['sleep', 'rest'].includes(p.mode);
      G.warp = ['play', 'sniff', 'still', 'stalk', 'slide'].includes(p.mode) ? 1 : waiting ? 4 : G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, (x) => G.world.ground.walkTop(x, 4));
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} age${p.age}/${p.mode} food=${p.food.toFixed(0)} kg=${p.kg.toFixed(1)} w=${p.warmth.toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} ph=${G.world.phase} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, S = Wd.ground;
    let sea = 0; for (const dx of [-200, 0, 200]) if (Wd.openWater(G.cam.x + dx)) sea += 1 / 3;
    AudioFX.update(dt, { night: G.night, inside: p.underground, rain: Wd.weather.rain, snow: Wd.weather.snow, wind: Wd.weather.gust, white: Wd.weather.white, sea, ice: S.iceOn && S.isSea(p.x) ? 1 : 0, winter: Wd.season === 'winter' || S.snowOn, summer: Wd.season === 'summer' });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: the northern lights over the sea ice, a mother and her twins walking ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const walkers = [{ x: .9, s: .62, ph: 0, form: 'cream', age: 1 }, { x: .8, s: .3, ph: 1.7, form: 'snow', age: .3 }, { x: .75, s: .29, ph: 3.1, form: 'cream', age: .3 }];
  const tflakes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: .4 + Math.random() * .6 }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050a1e'); g.addColorStop(.45, '#0c1e3c'); g.addColorStop(.68, '#1e4a6a'); g.addColorStop(.72, '#9ac0d8'); g.addColorStop(1, '#203a58');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    /* stars */
    tctx.fillStyle = '#fff'; for (let k = 0; k < 80; k++) { tctx.globalAlpha = .35 + .5 * Math.sin(tt * 2 + k); tctx.beginPath(); tctx.arc((k * 97.3) % W, (k * 53.7) % (H * .55), .8 + (k % 3) * .5, 0, TAU); tctx.fill(); }
    tctx.globalAlpha = 1;
    Render.drawAurora(tctx, W, H * .62, tt, 1);
    /* far pressure ridges and icebergs on the horizon */
    const hy = H * .7;
    tctx.fillStyle = '#7aa0c0'; tctx.beginPath(); tctx.moveTo(0, hy); for (let x = 0; x <= W; x += 14) tctx.lineTo(x, hy - 6 - Math.abs(Math.sin(x * .021 + 1)) * 12 * (Math.sin(x * .004) > .3 ? 1 : .2)); tctx.lineTo(W, hy + 4); tctx.lineTo(0, hy + 4); tctx.closePath(); tctx.fill();
    for (const [bx, bw, bh] of [[.12, 70, 44], [.8, 110, 60], [.92, 50, 30]]) { tctx.fillStyle = '#b8d4ea'; tctx.beginPath(); tctx.moveTo(bx * W - bw / 2, hy); tctx.lineTo(bx * W - bw / 3, hy - bh * .7); tctx.lineTo(bx * W - bw / 8, hy - bh); tctx.lineTo(bx * W + bw / 4, hy - bh * .8); tctx.lineTo(bx * W + bw / 2, hy); tctx.closePath(); tctx.fill(); tctx.fillStyle = 'rgba(80,120,170,.35)'; tctx.beginPath(); tctx.moveTo(bx * W - bw / 8, hy - bh); tctx.lineTo(bx * W + bw / 4, hy - bh * .8); tctx.lineTo(bx * W + bw / 2, hy); tctx.lineTo(bx * W, hy); tctx.closePath(); tctx.fill(); }
    /* the snowy sea ice the family walks along */
    const ice = (x) => H * (.86 + .02 * Math.sin(x * .006 + 1));
    const sg = tctx.createLinearGradient(0, H * .72, 0, H); sg.addColorStop(0, '#c8dcf0'); sg.addColorStop(.4, '#eef6ff'); sg.addColorStop(1, '#9ab4d0');
    tctx.fillStyle = sg; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, hy + 4); tctx.lineTo(W, hy + 4); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    tctx.fillStyle = 'rgba(120,170,220,.25)'; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, ice(0) + 18); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, ice(x) + 18 + Math.sin(x * .05) * 3); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    /* the aurora's glow on the snow */
    tctx.fillStyle = 'rgba(120,255,190,.06)'; tctx.fillRect(0, hy, W, H - hy);
    /* a mother and her twins walking, nose to tail */
    for (const c of walkers) {
      c.x += .012 * dt; c.ph += dt * 6; if (c.x > 1.2) c.x -= 1.4;
      const x = c.x * W, s = c.s * Math.min(1.5, W / 900), y = ice(x) - 33 * s;
      tctx.save(); tctx.translate(x, y); Sprites.drawBear(tctx, { s, form: c.form, age: c.age, walk: c.ph, moving: true, seed: 3, sex: c.age > .9 ? 'girl' : 'boy', collar: false }); tctx.restore();
    }
    /* light snow */
    tctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const f of tflakes) { f.y += dt * .03 * f.z; f.x += Math.sin(tt + f.z * 9) * dt * .01; if (f.y > 1) f.y = 0; tctx.beginPath(); tctx.arc(((f.x % 1) + 1) % 1 * W, f.y * H, .8 + f.z * 1.3, 0, TAU); tctx.fill(); }
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
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); if (params.has('stage')) setTimeout(() => UI.hint(resumeHint()), 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'cub' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'boy');
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'drawer') document.getElementById('drawer').hidden = false;
      else if (o === 'choice') document.getElementById('choice').hidden = false;
    }, 60);
    if (o === 'scope' && params.has('cut')) setTimeout(() => document.getElementById('scopeCut').click(), 120);
  }
  /* ?clean=1: no panels or pop-ups, for screenshots (the Arcade card) */
  if (params.has('clean')) { const st = document.createElement('style'); st.textContent = '.hud,.hint,.fact,.toast,.mission-card,.pad{visibility:hidden!important}'; document.head.appendChild(st); }
  if (params.has('mission')) Reading._missionNow();
  if (params.has('readpage')) setTimeout(() => { Reading._solveGate(); Reading.showPage(params.get('readpage'), { gate: params.has('gate') }); }, 80);
  if (params.has('readcard')) setTimeout(() => { Reading._solveGate(); G.player.input.actionPressed = true; Reading.intercept(G.player); }, 120);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); nx && nx.click(); }, 400);
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'cub', 'go', 'up', 'little', 'big', 'slide', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.sniff = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
