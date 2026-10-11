/* ============================================================
   main.js — the game loop, input, the story's director, glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'gray', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('wolf.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('wolf.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

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
  /* the director's clocks */
  let mealAt = 0, feastAt = null, lostAt = null, winterAt = null, chaseHintAt = 0, pupWanderAt = null, mealSpawnAt = null, ravenAt = null, pupsOutAt = null, bornAt = null, lastNight = null;

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
    G.players = [new Wolf(G, G.form, G.sex)];
    const p = G.player, d = G.world.den;
    p.x = d.cx + 14; p.y = d.cy + 4;
    mealAt = G.time + 20; feastAt = null; lostAt = null; winterAt = null; chaseHintAt = 0; pupWanderAt = null; mealSpawnAt = null; ravenAt = null; pupsOutAt = null; bornAt = null; lastNight = null;
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
  /* the howl button is held */
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
  const nextWolfNote = () => UI.hint(settings.reading === 'simple' ? `Your next wolf will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This wolf stays as it is.`);
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; UI.buildWheel(); } else nextWolfNote(); UI.refreshForms(); },
    onSex: (s) => { settings.sex = s; saveSettings(); if (!G.started) { G.sex = s; G.player.sex = s; } else nextWolfNote(); UI.buildForms(document.getElementById('formPick')); UI.buildForms(document.getElementById('formPickDrawer')); UI.refreshForms(); },
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
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Wolf(G, G.form, G.sex); G.players = [b]; b.restore(po); });
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
  /* put back the things a save does not hold: the pack where it belongs, the pups, the herds, the mate */
  function afterRestore() {
    const p = G.player, Wd = G.world;
    const phase = Wd.phase;
    if (phase === 'den') { /* the pack is already in and around the den */ }
    else if (phase === 'lone' || phase === 'parent') {
      Wd.setPhase('lone', p);
      const m = Wd.mate();
      if (p.flags.met && m) { m.following = !p.flags.denMade; m.roam = 0; m.x = clamp(p.x - 40, WORLD.left + 60, WORLD.right - 60); m.goal = m.x; m.y = Wd.ground.walkTop(m.x, 22) - m.feet; }
      if (p.flags.denMade && Wd.newDen) {
        Wd.setPhase('parent', p);
        /* once the pups are out, the boy's mate sits outside with them */
        if (p.flags.pupsOut && m) { m.inDen = false; m.mode = 'sit'; m.x = Wd.newDen.x - Wd.newDen.dir * 40; m.y = Wd.ground.walkTop(m.x, 22) - m.feet; m.roam = 30; m.home = m.x; }
      }
    }
    else Wd.setPhase(phase, p);
    /* travelling: the pack goes on from here, not back to the start of its route */
    if (phase === 'travel' && Wd.route) { const k = Wd.route.findIndex(x => x > p.x + 100); Wd.routeK = k < 0 ? Wd.route.length - 1 : k; }
    /* winter before the feast: back to the herd on the valley floor, ready for the next chase */
    if (phase === 'winter' && !p.flags.feasted) { Wd.resetHunt(p); chaseHintAt = G.time + 6; }
    if (phase === 'winter' && Wd.biologist) Wd.biologist.met = !!Wd.bioMetSaved;
    if (p.age === 4 && !p.flags.lone && phase !== 'home2') Wd.setPhase('home2', p);
    if (p.flags.pupsBorn && !p.flags.pupsOut) Wd.makeOwnPups(true);
    if (p.flags.pupsOut) Wd.makeOwnPups(false);
    if (p.flags.lostPack) { p.flags.lostPack = false; }
    if (p.mode === 'burrow' && !p.flags.inDen && p.flags.denMade) p.flags.inDen = true;
    /* the clocks that drive what happens next */
    mealAt = G.time + 15;
    if (p.flags.feasted === false || (phase === 'winter' && !p.flags.feasted && p.stats.chases >= G.diff().chases)) feastAt = G.time + 8;
    if (p.flags.denMade && p.sex === 'boy' && p.stats.mealsGiven < G.diff().meals && !Wd.meal) mealSpawnAt = G.time + 4;
    if (p.flags.denMade && p.sex === 'boy' && p.stats.mealsGiven >= G.diff().meals && !p.stats.barks) ravenAt = G.time + 4;
    if (p.flags.denMade && p.sex === 'boy' && p.stats.barks && !p.flags.pupsOut) pupsOutAt = G.time + 6;
    if (p.flags.denMade && p.sex === 'girl' && !p.flags.pupsBorn) bornAt = G.time + 6;
    if (p.flags.pupsBorn && p.sex === 'girl' && p.stats.nurses >= G.diff().nurses && !p.stats.carries) pupWanderAt = G.time + 5;
    if (p.flags.claimed && !p.flags.denMade && (Wd.season === 'winter' || p.age < 5)) later(3000, springComes);
    /* a step that was on its way when the game closed carries on */
    if (phase === 'travel' && p.flags.found && p.flags.postSniffed) winterAt = G.time + 6;
    if (p.sex === 'boy' && p.flags.pupsOut && !p.flags.genDone) later(1500, () => P().milestone('pups', generationDone));
    if (p.sex === 'girl' && p.flags.pupsBorn && p.stats.carries && !p.flags.pupsOut) later(800, () => { const q = P(); q.flags.pupsOut = true; Wd.makeOwnPups(false); if (q.mode === 'burrow') q.surface(); q.x = Wd.newDen.x - Wd.newDen.dir * 30; q.y = Wd.ground.walkTop(q.x, 22) - q.feet; Bus.emit('pupsOut', q); });
  }
  function resumeHint() {
    const p = G.player;
    if (p.age === 1) return p.flags.eyesOpen ? 'eyes' : 'drink';
    if (p.age === 2) return 'play';
    if (p.age === 3) return p.flags.travel ? (G.world.phase === 'winter' ? 'winter' : 'follow') : 'rendezvous';
    if (p.age === 4) return p.flags.lone ? (p.flags.met ? 'pair' : 'lone') : 'babysit';
    if (!p.flags.denMade) return 'den';
    if (p.sex === 'boy') return p.flags.pupsOut ? 'pupsout' : p.stats.mealsGiven >= G.diff().meals ? 'guardden' : 'bring';
    return p.flags.pupsOut ? 'firsthowl' : p.stats.nurses >= G.diff().nurses ? 'wanderer' : p.flags.pupsBorn ? 'nurse' : 'inside';
  }

  /* ---------- events → hints, facts, cinematics ---------- */
  const P = () => G.player;
  const once = {};
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* timers that outlive a New Game must not act on the new one */
  const later = (ms, fn) => { const W0 = G.world; setTimeout(() => { if (G.world === W0) fn(); }, ms); };
  const fact = (k, ms = 0) => ms ? later(ms, () => Bus.emit('fact', k)) : Bus.emit('fact', k);
  const sleepCine = (title, dur = 3.2) => Cinematic.play({ follow: P, zoom: 3, duration: dur, slow: .6, title });
  Bus.on('started', () => { UI.hint('born'); fact('den', 1800); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a newborn wolf pup. It is dark in the den. Find your mum.' : 'You are a newborn wolf pup, blind and deaf in a den under a hill. Your mother is close: find her by her warmth.', { force: true }); later(6000, () => { if (P().age === 1) UI.hint('drink'); }); fact('blind', 14000); fact('milk', 40000); });
  Bus.on('firstDrink', () => { UI.hint('crawl'); fact('mum', 8000); });
  Bus.on('drank', (p) => { if (p.stats.drinks === 3) fact('pack'); });
  Bus.on('eyesOpen', () => { AudioFX.magic(); UI.hint('eyes'); fact('eyes'); Cinematic.play({ follow: P, zoom: 6, duration: 3, slow: .5, title: 'My eyes are open!' }); });
  Bus.on('grewUp', (p, age) => {
    const Wd = G.world;
    if (age === 2) { Wd.setPhase('outside', p); G.day += 7; G.tod = .4; sleepCine('Three weeks old…'); later(3400, () => { UI.hint('play'); fact('out'); fact('play', 12000); }); mealAt = G.time + 18; }
    else if (age === 3) { Wd.season = 'summer'; Wd.setPhase('rendezvous', p); G.day += 35; G.tod = .45; sleepCine('Eight weeks later: the summer meadow'); later(3400, () => { UI.hint('rendezvous'); fact('rendezvous'); fact('pounce', 15000); fact('nose', 40000); }); mealAt = G.time + 24; Stickers.lifeDone(G.form, G.sex); }
    else if (age === 4) { Wd.spring(); Wd.setPhase('home2', p); G.day += 60; G.tod = .4; G.year++; sleepCine('Spring: one year old'); later(3400, () => { UI.hint('yearling'); fact('yearling'); fact('aspen', 30000); Bus.emit('babysitStart', p); }); mealAt = G.time + 30; }
    else if (age === 5) { sleepCine('Grown up'); }
    AudioFX.fanfare();
  });
  Bus.on('woke', () => { const p = P(); if (p.flags.lone && !p.flags.met && first('loneHint')) UI.hint('lone'); });
  Bus.on('playStart', () => { UI.hint('playfight'); });
  Bus.on('firstPlay', () => fact('play'));
  Bus.on('playWon', (p) => { UI.hint('won'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 20, 40); fact('tail', 4000); });
  Bus.on('playLost', () => UI.hint('lost'));
  Bus.on('babysat', () => UI.hint('babysit'));
  Bus.on('firstHowl', (p) => { UI.hint('howl'); fact('howl'); fact('moon', 20000); });
  Bus.on('howled', (p) => { G.particles.howlRings(p.x, p.y - p.h); });
  Bus.on('ravenNear', () => { UI.hint('raven'); fact('raven'); });
  Bus.on('mealHome', () => { UI.hint('meal'); });
  Bus.on('firstMeal', () => { fact('meal'); fact('teeth', 25000); });
  Bus.on('fullWolf', (p) => { if (p.age === 2) UI.hint('friend'); });
  Bus.on('firstPounce', () => { UI.hint('away'); });
  Bus.on('firstSniff', () => { fact('nose'); });
  Bus.on('storm', () => { UI.hint('storm'); fact('storm'); AudioFX.thunder(); });
  Bus.on('thunder', () => AudioFX.thunder());
  Bus.on('sheltered', () => UI.hint('shelter'));
  Bus.on('travel', (p) => { const Wd = G.world; Wd.season = 'autumn'; Wd.setPhase('travel', p); G.day += 60; UI.hint('travel'); fact('travel'); fact('tracks', 20000); AudioFX.fanfare(); Cinematic.play({ follow: () => ({ x: P().x + 120, y: P().y - 40 }), zoom: 1.4, duration: 5, slow: .7, title: 'Autumn: the pack is on the move' }); lostAt = G.time + 55; });
  Bus.on('firstTrack', () => { UI.hint('tracks'); });
  Bus.on('looked', (p, t) => { if (Reading.on()) UI.hint('tracks'); else UI.hint(TRACK_KINDS[t.kind].say, true); });
  Bus.on('swimStart', () => { UI.hint('river'); fact('river'); AudioFX.splash(); });
  Bus.on('crossed', (p) => { G.particles.shake(p.x, p.y, 16); UI.hint('follow'); });
  Bus.on('cold', () => { UI.hint('cold'); fact('coat'); });
  Bus.on('tooCold', () => { G.particles.puff(P().x, P().y, '#fff', 6); });
  Bus.on('rested', () => { if (G.tod > .25 && G.tod < .78) G.tod = .3; UI.hint('rest'); });
  Bus.on('firstPost', (p) => { UI.hint('post'); fact('territory'); const Wd = G.world; if (Wd.phase === 'travel' && winterAt === null && P().flags.found) winterAt = G.time + 6; });
  Bus.on('lostPack', (p) => { p.flags.lostPack = true; UI.hint('lostpack'); fact('sound'); });
  Bus.on('howlGame', (p, kind) => { if (kind === 'duet') UI.hint('duet'); else if (kind === 'litter') UI.hint('firsthowl'); });
  Bus.on('goodHowl', (p, n) => { G.particles.howlRings(p.x, p.y - p.h); });
  Bus.on('packFound', (p) => { const Wd = G.world; Wd.packCameBack(p); UI.hint('found'); AudioFX.fanfare(); G.tod = .26; if (p.flags.postSniffed && winterAt === null) winterAt = G.time + 6; });
  Bus.on('winterCame', () => { UI.hint('winter'); fact('paws'); fact('trail', 15000); fact('elk', 30000); });
  Bus.on('chaseStart', () => { UI.hint('chase'); fact('chase'); Cinematic.play({ follow: () => ({ x: P().x + 160, y: P().y - 30 }), zoom: 1.2, duration: 2.5, slow: .8, title: 'The chase!' }); });
  Bus.on('chaseEnd', (p, ch) => { UI.hint('gotaway'); fact('fast'); AudioFX.whoosh(); const Wd = G.world; if (p.stats.chases >= G.diff().chases && !p.flags.feasted) feastAt = G.time + 6; else later(3500, () => { if (P().flags.feasted) return; Wd.resetHunt(P()); P().mode = 'sleep'; P().sleepT = SLEEP_T; sleepCine('Later that day…'); chaseHintAt = G.time + 6; }); });
  Bus.on('feast', (p) => { UI.hint('feast'); fact('feast'); fact('yellowstone', 14000); AudioFX.fanfare(); });
  Bus.on('biologistMet', () => { UI.hint('biologist'); fact('biologist'); });
  Bus.on('babysitStart', () => { later(8000, () => { if (P().age === 4 && !P().flags.guarded) UI.hint('guard'); }); });
  Bus.on('guarded', () => { UI.hint('babysit'); fact('father', 6000); });
  Bus.on('dispersed', (p) => { const Wd = G.world; Wd.season = 'winter'; Wd.winter(); Wd.setPhase('lone', p); G.day += 120; G.tod = .35; sleepCine('Autumn, then winter: a lone wolf far from home', 3.6); later(3600, () => { UI.hint('lone'); fact('disperse'); }); });
  Bus.on('ridge', () => { UI.hint('road'); });
  Bus.on('underpass', () => { UI.hint('underpass'); fact('underpass'); });
  Bus.on('newValley', () => { UI.hint('mate'); });
  Bus.on('met', (p, o) => { if (o && o.role === 'mate') { UI.hint('pair'); fact('mate'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 20, 50); Cinematic.play({ follow: () => ({ x: (P().x + o.x) / 2, y: P().y - 20 }), zoom: 3, duration: 3.5, slow: .5, title: 'A pair!' }); } });
  Bus.on('marked', (p, q) => { if (!p.flags.marksDone) UI.hint('mark'); });
  Bus.on('marksDone', () => { UI.hint('duet'); });
  Bus.on('claimed', (p) => { const Wd = G.world; UI.hint('claimed'); fact('colour'); AudioFX.fanfare(); if (Wd.mate()) { Wd.mate().mode = 'howl'; Wd.mate().howlT = 3; } Cinematic.play({ follow: P, zoom: 2.2, duration: 4, slow: .6, title: 'Our valley' }); later(6000, springComes); });
  function springComes() {
    const p = P(), Wd = G.world; if (p.flags.denMade || !p.flags.claimed) return;
    if (p.age < 5) p.growUp(); else { p.mode = 'sleep'; p.sleepT = SLEEP_T; }
    Wd.spring(); G.day += 90; G.year++; G.tod = .4;
    sleepCine('Winter passes. Spring!');
    later(3400, () => { UI.hint('den'); fact('digden'); });
  }
  Bus.on('digStart', () => { UI.hint('dig'); });
  Bus.on('deepEnough', (p) => { if (p.denReady()) UI.hint('denready'); });
  Bus.on('denMade', (p) => {
    const Wd = G.world; AudioFX.magic(); Cinematic.play({ follow: P, zoom: 2.8, duration: 3, slow: .6, title: 'A den of our own' });
    G.day += 14;
    if (p.sex === 'boy') { Wd.setPhase('parent', p); later(3200, () => { P().surface(); UI.hint('bring'); fact('father'); }); mealSpawnAt = G.time + 5; }
    else { Wd.setPhase('parent', p); bornAt = G.time + 6; later(3200, () => UI.hint('inside')); }
  });
  Bus.on('carrying', (p, what) => { UI.hint(what === 'meal' ? 'carry' : 'carrying'); });
  Bus.on('given', (p) => { const Wd = G.world; if (p.stats.mealsGiven < G.diff().meals) { UI.hint('given'); mealSpawnAt = G.time + 3; } else { ravenAt = G.time + 3; UI.hint('given'); } });
  Bus.on('firstGiven', () => fact('father'));
  Bus.on('barked', () => { UI.hint('shooed'); pupsOutAt = G.time + 5; });
  Bus.on('firstNurse', () => { fact('milk'); });
  Bus.on('nursed', (p) => { if (p.stats.nurses >= G.diff().nurses) pupWanderAt = G.time + 4; else UI.hint('nurse'); });
  Bus.on('pupHome', (p) => { UI.hint('firsthowl'); fact('carry'); later(1500, () => { const Wd = G.world; p.flags.pupsOut = true; Wd.makeOwnPups(false); p.surface(); p.x = Wd.newDen.x - Wd.newDen.dir * 30; p.y = Wd.ground.walkTop(p.x, 6) - p.feet; G.day += 21; Bus.emit('pupsOut', p); }); });
  Bus.on('pupsOut', (p) => { UI.hint(p.sex === 'girl' ? 'firsthowl' : 'pupsout'); fact('out'); Cinematic.play({ follow: () => ({ x: G.world.newDen.x, y: G.world.newDen.y - 20 }), zoom: 2.6, duration: 4, slow: .6, title: 'The pups come out!' }); });
  Bus.on('litterHowl', () => generationDone());
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    UI.hint('newpack'); fact('lifecycle');
    AudioFX.fanfare();
    Bus.emit('generationDone'); UI.refreshToggles();
    const open = () => { if (Reading.busy() || Cinematic.active) later(800, open); else UI.choice(); };
    later(3000, open);
  }
  Bus.on('tossedDown', () => {});

  /* ---------- the director: meals, storms, the lost night, winter, the chase, the feast, the den's visitors ---------- */
  function director(dt) {
    const p = G.player, Wd = G.world, D = G.diff(), vis = settings.visitors, t = G.time;
    const night = nightAmount(G.tod) > .5;
    if (lastNight !== null && night !== lastNight && p.age >= 2 && p.mode === 'walk' && first('nightHint' + night)) { if (night) UI.hint('night'); }
    lastNight = night;
    /* a grown-up comes home with a meal while you are a pup (and feasts for a yearling) */
    if ((p.age === 2 || p.age === 3 && !p.flags.travel) && t > mealAt && p.mode === 'walk' && !Wd.pack.some(n => n.meal)) {
      mealAt = t + 26 + Math.random() * 10;
      const adults = Wd.pack.filter(n => n.role !== 'sib' && n.role !== 'sitter');
      let n = adults.find(a => !a.inDen && a.role !== 'mum') || adults[0];
      if (!n || p.age === 3) { n = new WolfNPC(Wd, { role: 'dad', sex: 'boy', form: G.form === 'black' ? 'black' : 'gray', kg: 50, x: p.x + 520 }); n.home = p.x + 60; n.roam = 0; n.temp = true; Wd.pack.push(n); }
      n.meal = true; n.x = p.x + 480 * (Math.random() < .5 ? 1 : -1); n.goal = p.x + 50 * sign(n.x - p.x); n.mode = 'walk'; n.roam = 0; n.inDen = false;
      Bus.emit('mealHome', n);
    }
    for (const n of Wd.pack) if (n.meal && n.mode === 'stand' && n.mealWait === undefined) n.mealWait = t + 40;
    for (const n of Wd.pack) if (n.meal && n.mealWait !== undefined && t > n.mealWait) { n.meal = false; n.mealWait = undefined; if (n.temp) n.leaveIn = 2; else { n.roam = 140; n.home = Wd.den.x + 200; } }
    if (p.age === 4 && !p.flags.lone && t > mealAt && p.mode === 'walk' && p.food < D.grow[3] * .6) { mealAt = t + 30; p.food = Math.min(p.food + 8, p.growTh); UI.hint('feast'); G.particles.sparkle(p.x, p.y - p.h, 14, '#ffe27a', 20); }
    /* the pup stage: the raven comes to play now and then */
    if (p.age === 2 && p.mode === 'walk' && t > (once.ravenHop || 0)) { once.ravenHop = t + 20; const b = Wd.ravens[0]; if (b && b.state === 'ground') { b.home = p.x + 60; b.x = b.home; } }
    /* autumn: one night the pack goes on ahead and you must howl to find them */
    if (Wd.phase === 'travel' && !p.flags.found && !p.flags.lostPack && !Wd.lostMode && p.mode === 'walk' && p.x > WORLD.flatL + 200) {
      lostAt = null; G.tod = .95; Wd.lostMode = { x: p.x + 1100 };
      for (const n of Wd.pack) { n.mode = 'run'; n.goal = p.x + 1100 + (n.lineK || 0) * 40; }
      later(2500, () => Bus.emit('lostPack', P()));
    }
    /* winter comes once the pack reaches the edge of the territory */
    if (winterAt !== null && t > winterAt && p.mode === 'walk' && Wd.phase === 'travel') {
      winterAt = null; Wd.winter(); Wd.setPhase('winter', p); G.day += 40; G.tod = .4;
      p.x = WORLD.herdX - 560; p.y = Wd.ground.walkTop(p.x, 6) - p.feet; p.mode = 'sleep'; p.sleepT = SLEEP_T; p.warmth = 1;
      sleepCine('Winter'); chaseHintAt = t + 8; for (const T of Wd.trees) T.snow = 1;
    }
    if (Wd.phase === 'winter' && chaseHintAt && t > chaseHintAt && p.mode === 'walk' && !p.flags.feasted && !(Wd.chase && Wd.chase.on)) { chaseHintAt = 0; UI.hint('herd'); }
    if (Wd.phase === 'winter' && Wd.biologist && !Wd.biologist.met && Math.abs(Wd.biologist.x - p.x) < 260 && first('bioHint')) UI.hint('biologist');
    if (feastAt !== null && t > feastAt && p.mode === 'walk') {
      feastAt = null; p.flags.feasted = true; p.food = Math.max(p.food, D.grow[2]); p.full = true; p.stats.feasts++;
      for (const n of Wd.pack) { n.mode = 'lie'; n.roam = 0; }
      G.day += 3; Bus.emit('feast', p);
    }
    /* the boy's den: meals to fetch, then a raven to shoo, then the pups come out */
    if (mealSpawnAt !== null && t > mealSpawnAt && !Wd.meal && !p.carrying) { mealSpawnAt = null; Wd.spawnMeal(p); UI.hint('bring'); }
    if (ravenAt !== null && t > ravenAt && !Wd.denRaven) { ravenAt = null; Wd.sendDenRaven(); UI.hint('guardden'); }
    if (pupsOutAt !== null && t > pupsOutAt && p.mode === 'walk') {
      pupsOutAt = null; p.flags.pupsOut = true; Wd.makeOwnPups(false); G.day += 56;
      const m = Wd.mate(); if (m) { m.inDen = false; m.mode = 'sit'; m.x = Wd.newDen.x - Wd.newDen.dir * 40; m.y = Wd.ground.walkTop(m.x, 22) - m.feet; m.roam = 30; m.home = m.x; }
      sleepCine('Eight weeks later…'); later(3400, () => { Bus.emit('pupsOut', P()); P().milestone('pups', () => generationDone()); });
    }
    /* the girl's den: the pups are born, then one wanders */
    if (bornAt !== null && t > bornAt && p.mode === 'burrow') {
      bornAt = null; p.flags.pupsBorn = true; Wd.makeOwnPups(true); G.day += 50;
      p.mode = 'sleep'; p.sleepT = SLEEP_T; p.flags.inDen = true;
      sleepCine('Weeks later, deep in the den…'); later(3400, () => { UI.hint('inside'); Bus.emit('pupsBorn', P()); });
    }
    if (pupWanderAt !== null && t > pupWanderAt && Wd.pups.length) {
      pupWanderAt = null; const q = Wd.pups[0]; q.wandered = true; q.inDen = false; q.mode = 'sit'; q.x = Wd.newDen.x - Wd.newDen.dir * 12; q.y = Wd.ground.walkTop(q.x, 22) - q.feet; UI.hint('wanderer');
    }
    /* keep a wandered pup sitting at the den mouth */
    for (const q of Wd.pups) if (q.wandered && !q.inDen) { q.mode = 'sit'; q.roam = 0; }
    /* breath in the cold, snow kicked up */
    if (Wd.season === 'winter' && p.moving && Math.random() < dt * 3) G.particles.breath(p.x + p.face * p.w * .55, p.y - p.h * .35, p.face);
    if (Wd.season === 'winter' && p.run && Math.random() < dt * 8) G.particles.snowKick(p.x - p.face * p.w * .3, p.y + p.feet);
  }

  /* ---------- debug jumps (?stage=…) ---------- */
  function toAge(age, x, frac = .4) {
    const p = G.player, Wd = G.world, th = [0, ...G.diff().grow];
    p.age = age; p.food = age < 5 ? th[age - 1] + (th[age] - th[age - 1]) * frac : G.diff().grow[3] * (1 + (BONUS - 1) * frac); p.full = false;
    p.kg = wolfKG(age, p.food, G.diff().grow, p.sex);
    p.flags.eyesOpen = age >= 2 || frac > .5; p.flags.drank = true;
    if (age >= 2) { p.mode = 'walk'; p.flags.played = true; }
    if (age >= 3) { p.flags.ateMeal = true; }
    p.x = x; p.y = Wd.ground.walkTop(x, 6) - p.feet; p.face = 1; G.tod = .4;
    Cinematic.stop();
  }
  function digHome(p, depth) {
    const S = G.world.ground, gx = p.x, g = S.surfaceAt(gx);
    for (let d = 0; d <= depth; d += 3) S.blob(gx + d * 1.1, g + d, Math.max(18, p.h * .6), Math.max(16, p.h * .55), MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL);
    S.flushTop(); p.burrow = { x: gx, y: g }; p.mode = 'burrow'; p.x = gx + depth * 1.1; p.y = g + depth; p.ang = Math.atan2(.6, .8); p.face = 1;
  }
  function toPair(x, claimed) {
    toAge(4, x, .9); const p = G.player, Wd = G.world;
    p.flags.lone = p.flags.guarded = p.flags.travel = p.flags.feasted = p.flags.ridge = p.flags.underpass = p.flags.newValley = true;
    Wd.season = 'winter'; Wd.winter(); Wd.setPhase('lone', p);
    const m = Wd.mate(); m.x = x - 50; m.y = Wd.ground.walkTop(m.x, 22) - m.feet;
    p.flags.met = true; m.following = true; m.roam = 0;
    if (claimed) { for (const q of Wd.posts) q.marked = true; p.flags.marksDone = p.flags.claimed = true; p.stats.marks = 3; }
  }
  function toDen(x) {
    toPair(x, true); const p = G.player, Wd = G.world;
    Wd.spring(); p.age = 5; p.kg = wolfKG(5, p.food, G.diff().grow, p.sex); G.tod = .4;
  }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world, p = G.player, frac = +(params.get('frac') || .5);
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'rain' || s === 'storm') { wx.rain = 1; wx.cloud = 1; } if (s === 'snowfall') { wx.snow = 1; wx.cloud = .9; } }
    if (!st) return;
    if (st === 'newborn' || st === 'den') { p.food = G.diff().grow[0] * frac * .3; }
    else if (st === 'eyes') { p.flags.eyesOpen = true; p.food = G.diff().grow[0] * .6; }
    else if (st === 'pup') { toAge(2, Wd.den.x + 60, frac); Wd.setPhase('outside', p); }
    else if (st === 'meal') { toAge(2, Wd.den.x + 60, frac); Wd.setPhase('outside', p); mealAt = G.time + .5; }
    else if (st === 'play') { toAge(2, Wd.den.x + 60, frac); Wd.setPhase('outside', p); const s = Wd.sibs()[0]; s.x = p.x + 30; s.mode = 'stand'; p.startPlay(s); p.wr.p = +(params.get('wp') || .3); p.wr.ring = 1.4; }
    else if (st === 'bigpup' || st === 'meadow') { toAge(3, WORLD.rvX, 0); Wd.season = 'summer'; Wd.setPhase('rendezvous', p); }
    else if (st === 'storm') { toAge(3, WORLD.rvX, 0); Wd.season = 'summer'; Wd.setPhase('rendezvous', p); Wd.weather.state = 'storm'; Wd.weather.rain = 1; Wd.weather.cloud = 1; Wd.weather.timer = 60; G.tod = .6; }
    else if (st === 'travel') { toAge(3, WORLD.rvX + 200, .5); Wd.season = 'autumn'; p.flags.travel = true; Wd.setPhase('travel', p); Wd.spawnScent(p); }
    else if (st === 'river') { toAge(3, WORLD.riverL - 80, .5); Wd.season = 'autumn'; p.flags.travel = true; Wd.setPhase('travel', p); }
    else if (st === 'post') { toAge(3, WORLD.postX - 80, .5); Wd.season = 'autumn'; p.flags.travel = true; Wd.setPhase('travel', p); Wd.routeK = 5; }
    else if (st === 'lost') { toAge(3, WORLD.flatL + 300, .5); Wd.season = 'autumn'; p.flags.travel = true; Wd.setPhase('travel', p); G.tod = .95; Wd.lostMode = { x: p.x + 1100 }; for (const n of Wd.pack) { n.x = p.x + 1100; } p.flags.lostPack = true; p.input.hold = true; p.startHowlGame(); p.hw.held = true; p.hw.ring = 1.8; }
    else if (st === 'winter') { toAge(3, WORLD.herdX - 560, .7); p.flags.travel = true; Wd.winter(); Wd.setPhase('winter', p); chaseHintAt = G.time + 1; }
    else if (st === 'chase') { toAge(3, WORLD.herdX - 300, .7); p.flags.travel = true; Wd.winter(); Wd.setPhase('winter', p); for (const n of Wd.pack) n.x = p.x + 40 + (n.lineK || 0) * 30; p.startChase(); Wd.chase.t = 2; }
    else if (st === 'feast') { toAge(3, WORLD.herdX - 300, .7); p.flags.travel = true; Wd.winter(); Wd.setPhase('winter', p); p.stats.chases = G.diff().chases; feastAt = G.time + .5; }
    else if (st === 'biologist') { toAge(3, WORLD.bioX - 80, .7); p.flags.travel = true; Wd.winter(); Wd.setPhase('winter', p); }
    else if (st === 'yearling') { toAge(4, Wd.den.x + 90, .3); Wd.setPhase('home2', p); p.flags.travel = p.flags.feasted = true; }
    else if (st === 'guard') { toAge(4, Wd.den.x + 20, .4); Wd.setPhase('home2', p); p.flags.travel = p.flags.feasted = true; p.stats.plays = 2; }
    else if (st === 'disperse') { toAge(4, Wd.den.x + 90, .6); Wd.setPhase('home2', p); p.flags.travel = p.flags.feasted = p.flags.guarded = true; p.stats.plays = 2; }
    else if (st === 'lone') { toAge(4, WORLD.postX - 120, .9); p.flags.lone = p.flags.guarded = p.flags.travel = p.flags.feasted = true; Wd.winter(); Wd.setPhase('lone', p); }
    else if (st === 'ridge') { toAge(4, WORLD.ridgeTop - 100, .9); p.flags.lone = p.flags.guarded = p.flags.travel = p.flags.feasted = true; Wd.winter(); Wd.setPhase('lone', p); }
    else if (st === 'tunnel') { toAge(4, WORLD.tunnelL - 120, .9); p.flags.lone = p.flags.guarded = p.flags.travel = p.flags.feasted = p.flags.ridge = true; Wd.winter(); Wd.setPhase('lone', p); }
    else if (st === 'mate') { toAge(4, WORLD.mateX - 120, .9); p.flags.lone = p.flags.guarded = p.flags.travel = p.flags.feasted = p.flags.ridge = p.flags.underpass = p.flags.newValley = true; Wd.winter(); Wd.setPhase('lone', p); }
    else if (st === 'pair' || st === 'mark') toPair(WORLD.posts2[0] - 80, false);
    else if (st === 'duet') { toPair(WORLD.posts2[1], true); p.flags.claimed = false; p.input.hold = true; p.startHowlGame(); p.hw.held = true; p.hw.ring = 1.8; }
    else if (st === 'spring' || st === 'adult') { toDen(WORLD.newDenL + 100); }
    else if (st === 'dig') { toDen(WORLD.newDenL + 120); digHome(p, p.h * 1.2); }
    else if (st === 'denmade' || st === 'bring' || st === 'raven' || st === 'pupsout') {
      toDen(WORLD.newDenL + 120); p.sex = 'boy'; G.sex = 'boy'; digHome(p, p.denDepth() + 8); p.makeDen(); p.surface(); Cinematic.stop();
      Wd.setPhase('parent', p);
      if (st === 'bring') { Wd.spawnMeal(p); p.x = Wd.meal.x - 40; p.y = Wd.ground.walkTop(p.x, 6) - p.feet; mealSpawnAt = null; }
      if (st === 'raven') { p.stats.mealsGiven = G.diff().meals; mealSpawnAt = null; Wd.sendDenRaven(); }
      if (st === 'pupsout') { p.stats.mealsGiven = G.diff().meals; p.stats.barks = 1; mealSpawnAt = null; p.flags.pupsOut = true; Wd.makeOwnPups(false); const m = Wd.mate(); m.inDen = false; m.mode = 'sit'; m.x = Wd.newDen.x - Wd.newDen.dir * 40; m.y = Wd.ground.walkTop(m.x, 22) - m.feet; }
    }
    else if (st === 'inside' || st === 'nurse' || st === 'carry' || st === 'litter') {
      toDen(WORLD.newDenL + 120); p.sex = 'girl'; G.sex = 'girl'; digHome(p, p.denDepth() + 8); p.makeDen(); Cinematic.stop();
      Wd.setPhase('parent', p); bornAt = null;
      if (st !== 'inside') { p.flags.pupsBorn = true; Wd.makeOwnPups(true); }
      if (st === 'carry') { p.stats.nurses = G.diff().nurses; pupWanderAt = G.time + .2; }
      if (st === 'litter') { p.stats.nurses = G.diff().nurses; p.stats.carries = 1; p.flags.pupsOut = true; Wd.makeOwnPups(false); p.surface(); p.x = Wd.newDen.x - Wd.newDen.dir * 30; p.y = Wd.ground.walkTop(p.x, 6) - p.feet; }
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
    else if (p.mode === 'play' && p.wr) cam.follow(p.wr.mid, p.y - p.h * .5, clamp(110 / (p.w + 20), 1.2, 3.2) * uz);
    else if (p.mode === 'chase') cam.follow(p.x + 160, p.y - 30, 1.3 * uz);
    else if (p.mode === 'howl') cam.follow(p.x, p.y - p.h, 2.4 * uz);
    else {
      const z = clamp(120 / (p.w + 16), 1.25, 4.5) * (p.underground ? 1.3 : 1);
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
      /* time-lapse (F), and a fast-forward while the wolf just waits: a sleep, a rest */
      const waiting = ['sleep', 'rest'].includes(p.mode);
      G.warp = p.mode === 'play' || p.mode === 'howl' || p.mode === 'chase' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
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
    const Wd = G.world;
    AudioFX.update(dt, { night: G.night, inside: p.underground, rain: Wd.weather.rain, snow: Wd.weather.snow, wind: Wd.weather.gust, river: clamp(1 - Math.abs(G.cam.x - (WORLD.riverL + WORLD.riverR) / 2) / 500, 0, 1), forest: p.x < WORLD.meadowL || (p.x > WORLD.valleyL) ? 1 : .3, winter: Wd.season === 'winter', summer: Wd.season === 'summer', storm: Wd.weather.state === 'storm' });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: a pack on a snowy ridge at dusk, one wolf howling ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const walkers = Array.from({ length: 7 }, (_, i) => ({ x: .15 + i * .11, s: .34 + (i % 3) * .04, ph: i * 1.7, form: ['gray', 'black', 'gray', 'white', 'black', 'gray', 'black'][i], age: i === 6 ? .55 : 1 }));
  const tflakes = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: .4 + Math.random() * .6 }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c1230'); g.addColorStop(.4, '#3a2a5c'); g.addColorStop(.62, '#e8805a'); g.addColorStop(.7, '#ffc890'); g.addColorStop(.72, '#5a6a8a'); g.addColorStop(1, '#1a2238');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    /* stars and a growing moon */
    tctx.fillStyle = '#fff'; for (let k = 0; k < 60; k++) { tctx.globalAlpha = .4 + .5 * Math.sin(tt * 2 + k); tctx.beginPath(); tctx.arc((k * 97.3) % W, (k * 53.7) % (H * .45), 1 + (k % 3) * .5, 0, TAU); tctx.fill(); }
    tctx.globalAlpha = .95; Render.drawMoonDisc(tctx, W * .8, H * .18, 30, .3); tctx.globalAlpha = 1;
    /* far peaks, then a nearer mountain with pines */
    tctx.fillStyle = '#5a6a90'; tctx.beginPath(); tctx.moveTo(0, H * .7); for (let x = 0; x <= W; x += 20) tctx.lineTo(x, H * (.56 + .1 * Math.abs(Math.sin(x * .004 + 1)) - .06 * Math.abs(Math.sin(x * .011)))); tctx.lineTo(W, H * .7); tctx.closePath(); tctx.fill();
    tctx.fillStyle = '#e8f0fa'; for (let x = 0; x <= W; x += 20) { const y = H * (.56 + .1 * Math.abs(Math.sin(x * .004 + 1)) - .06 * Math.abs(Math.sin(x * .011))); if (y < H * .6) { tctx.beginPath(); tctx.moveTo(x, y); tctx.lineTo(x - 16, y + 24); tctx.lineTo(x + 16, y + 26); tctx.closePath(); tctx.fill(); } }
    tctx.fillStyle = '#2a3a4a'; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, H * .78); for (let x = 0; x <= W; x += 16) tctx.lineTo(x, H * (.76 + .04 * Math.sin(x * .01) + .02 * Math.sin(x * .03 + 2))); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    tctx.fillStyle = '#1c2a36'; for (let k = 0; k < 40; k++) { const x = (k * 137.5) % W, s = 10 + (k * 7) % 14, y = H * (.76 + .04 * Math.sin(x * .01) + .02 * Math.sin(x * .03 + 2)) + 2; tctx.beginPath(); tctx.moveTo(x, y - s * 3); tctx.lineTo(x + s, y); tctx.lineTo(x - s, y); tctx.closePath(); tctx.fill(); }
    /* the snowy ridge the pack walks along */
    const ridge = (x) => H * (.86 + .025 * Math.sin(x * .008 + 1));
    const sg = tctx.createLinearGradient(0, H * .82, 0, H); sg.addColorStop(0, '#f4f8ff'); sg.addColorStop(1, '#a8b8d0');
    tctx.fillStyle = sg; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, ridge(0)); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, ridge(x)); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    tctx.fillStyle = 'rgba(120,150,190,.25)'; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, ridge(0) + 16); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, ridge(x) + 16 + Math.sin(x * .05) * 3); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    /* the pack, single file, one howling on the rise */
    for (const c of walkers) {
      c.x -= .018 * dt; c.ph += dt * 9; if (c.x < -.1) c.x = 1.1;
      const x = c.x * W, s = c.s * Math.min(1.4, W / 1000), y = ridge(x) - 40 * s;
      tctx.save(); tctx.translate(x, y); tctx.scale(-1, 1); Sprites.drawWolf(tctx, { s, form: c.form, age: c.age, walk: c.ph, moving: true, seed: 3, snow: .4, pant: .3 }); tctx.restore();
    }
    const hx = W * .86, hs = .5 * Math.min(1.4, W / 1000);
    tctx.save(); tctx.translate(hx, ridge(hx) - 40 * hs); tctx.scale(-1, 1); Sprites.drawWolf(tctx, { s: hs, form: 'black', age: 1, howl: 1, seed: 5, snow: .4 }); tctx.restore();
    tctx.strokeStyle = 'rgba(255,240,200,.5)'; tctx.lineWidth = 2; for (let k = 1; k <= 3; k++) { const u = ((tt * .5 + k * .33) % 1); tctx.globalAlpha = 1 - u; tctx.beginPath(); tctx.arc(hx - 30 * hs, ridge(hx) - 110 * hs, 10 + u * 60, Math.PI * 1.1, Math.PI * 1.7); tctx.stroke(); } tctx.globalAlpha = 1;
    /* snow falling */
    tctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const f of tflakes) { f.y += dt * .04 * f.z; f.x += Math.sin(tt + f.z * 9) * dt * .01; if (f.y > 1) f.y = 0; tctx.beginPath(); tctx.arc(((f.x % 1) + 1) % 1 * W, f.y * H, 1 + f.z * 1.5, 0, TAU); tctx.fill(); }
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
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'pup' }); UI.openJournal(); }
      else if (o === 'scope') Microscope.open(G, params.get('subject') || 'boy');
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'pup', 'go', 'up', 'little', 'big', 'dig', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.howl = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
