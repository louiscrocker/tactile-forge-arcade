/* ============================================================
   main.js — the game loop, input, the story's director, glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'normal', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('octopus.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('octopus.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .9, day: 1, generation: 1, moon: .5, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form, sex: settings.sex,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 240;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;
  /* the director's clocks */
  let schoolAt = 0, whaleDone = false, gullAt = 0, hunterAt = null, trapAt = null, diverAt = null, migrateAt = null, rivalAt = null, femaleAt = null, lastNight = null;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.world = new World(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  /* the mother in her den under a boulder on the reef, on a spring night, her egg strings hanging over her */
  function makeMum(x0) {
    const Wd = G.world, S = Wd.ground, w = octUnits(30);
    const cb = S.nearestBoulder(x0 === undefined ? WORLD.eggX : x0), x = cb ? cb.x + cb.rad * .9 + 6 : WORLD.eggX, g = S.surfaceAt(x);
    /* a den dug down beside the boulder and in under it, so she sits in the dark with the egg strings hanging over her */
    const dir = cb ? -1 : 1;
    for (let k = 0; k < 9; k++) S.blob(x + dir * k * 3.5, g + 4 + k * 5, w * .2, w * .14, MAT.AIR, (m) => S.diggable(m) || m === MAT.GRAVEL);
    const mx0 = x + dir * 30, my0 = g + 46;
    S.blob(mx0, my0, w * .44, w * .3, MAT.AIR, (m) => S.diggable(m) || m === MAT.GRAVEL);
    S.flushTop();
    Wd.mum = { x: mx0, y: my0 + w * .06, w, feet: w * .2, form: G.form, eggs: 1, shake: 0, ph: 0, leaving: false, face: -dir, den: { x, y: g } };
  }
  function newGame(newSeed) {
    G.form = settings.form; G.sex = settings.sex;
    G.fast = false;
    makeWorld(newSeed);
    G.tod = .9; G.moon = .5; G.year = 0;
    makeMum();
    G.players = [new Octopus(G, G.form, G.sex)];
    schoolAt = G.time + 30; whaleDone = false; gullAt = G.time + 25; hunterAt = null; trapAt = null; diverAt = null; migrateAt = null; rivalAt = null; femaleAt = null; lastNight = null;
    for (const k in once) delete once[k];
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 5;
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
    if (x || y) p1.target = null;
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
  document.getElementById('btnDash').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.eggPressed = true; });

  /* tap the sea or the floor to go there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* in a wrestle, while blowing the babies out, or tending the eggs, a tap is the button */
    if (p.mode === 'box' || p.mode === 'release' || p.mode === 'brood' || p.stage === 'egg') { p.input.actionPressed = true; return; }
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next octopus will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This octopus stays as it is.`);
  UI.init(G, {
    onStart: start,
    onForm: (k) => { settings.form = k; saveSettings(); if (!G.started) { G.form = k; G.player.form = k; if (G.world.mum) G.world.mum.form = k; UI.buildWheel(); } else nextNote(); UI.refreshForms(); },
    onSex: (s) => { settings.sex = s; saveSettings(); if (!G.started) { G.sex = s; G.player.sex = s; } else nextNote(); UI.buildForms(document.getElementById('formPick')); UI.buildForms(document.getElementById('formPickDrawer')); UI.refreshForms(); },
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
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Octopus(G, G.form, G.sex); G.players = [b]; b.restore(po); });
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
  /* put back the things a save does not hold: the egg's mother, the crawling crowds, the partners on the reef */
  function afterRestore() {
    const p = G.player, Wd = G.world;
    if (p.stage === 'egg') makeMum();
    if (p.flags.migrating && !p.flags.arrivedDeep) Wd.startMarch(p, -1);
    if (p.flags.returning && !p.flags.home) Wd.startMarch(p, 1);
    if (p.flags.home && p.sex === 'girl' && !p.flags.met) Wd.makeMaleDens();
    if (p.instar >= 4 && !p.flags.migrating) { migrateAt = G.time + 40; if (!Wd.diver.done && !p.flags.shook) diverAt = G.time + 8; }
    if (p.flags.home && p.sex === 'boy' && p.flags.denDug && !p.flags.met) { if (p.flags.boss) femaleAt = G.time + 4; else rivalAt = G.time + 4; }
    if (p.flags.boss && !p.flags.bossSeen) { p.flags.bossSeen = true; later(1500, () => Bus.emit('boss', P())); }
    if (p.flags.met && !p.flags.genDone && p.sex === 'boy') later(2500, babiesAtSea);
    if (p.flags.met && p.sex === 'girl' && p.flags.nested && !p.flags.broodStarted && p.mode !== 'sleep') p.startBrood();
    if (p.stage === 'larva' && p.zinstar >= 3) whaleDone = true;
  }
  function resumeHint() {
    const p = G.player;
    if (p.stage === 'egg') return 'egg';
    if (p.stage === 'larva') return 'swim';
    if (p.stage === 'postlarva') return 'postlarva';
    if (p.mode === 'sleep') return 'sleeping';
    if (p.mode === 'brood') return 'brood';
    if (p.mode === 'winter') return 'winter';
    if (p.flags.broodDone && !p.flags.released) return 'moonready';
    if (p.flags.migrating && !p.flags.arrivedDeep) return 'deep';
    if (p.flags.arrivedDeep && !p.flags.wintered) return 'arrived';
    if (p.flags.returning && !p.flags.home) return 'home';
    if (p.instar === 1) return p.full ? 'sleep' : 'juvenile';
    if (p.full) return 'full';
    if (p.instar >= 4 && !p.flags.migrating) return 'adult';
    return 'forage';
  }

  /* ---------- events → hints, facts, cinematics ---------- */
  const P = () => G.player;
  const once = {};
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* timers that outlive a New Game must not act on the new one */
  const later = (ms, fn) => { const W0 = G.world; setTimeout(() => { if (G.world === W0) fn(); }, ms); };
  const fact = (k, ms = 0) => ms ? later(ms, () => Bus.emit('fact', k)) : Bus.emit('fact', k);
  Bus.on('started', () => { UI.hint('egg'); fact('egg', 1800); fact('tend', 14000); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are an octopus egg, hanging in your mum\'s den.' : 'You are one of fifty thousand octopus eggs, hanging in strings from the roof of your mother\'s den on the reef. It is a spring night.', { force: true }); });
  Bus.on('eggReady', () => { UI.hint('hatch'); const m = G.world.mum; if (m) m.shake = 1; });
  Bus.on('hatched', (p) => {
    AudioFX.hatch(); UI.hint('swim'); fact('hatch');
    const m = G.world.mum; if (m) { m.eggs = .5; later(5000, () => { const mm = G.world.mum; if (mm) { mm.shake = 0; mm.leaving = true; } }); }
    Cinematic.play({ follow: P, zoom: 7, duration: 3, slow: .5, title: 'Pop out!' });
    fact('larva', 9000); fact('plankton', 30000); fact('moon', 60000);
  });
  Bus.on('ate', (p) => { if (p.stats.plankton === 6) fact('krill'); if (p.stats.plankton === 3) UI.hint('bigger'); });
  Bus.on('copepodJump', () => { if (first('zoea')) UI.hint('copepod'); });
  Bus.on('ateZoea', () => fact('zoea'));
  Bus.on('glow', () => { if (first('glow')) fact('glow'); });
  Bus.on('dash', () => { if (first('dashed')) UI.hint('swim'); });
  Bus.on('tight', () => { UI.hint('bigger'); AudioFX.bump(); });
  Bus.on('growing', (p) => { AudioFX.molt(); Cinematic.play({ follow: P, zoom: 7, duration: 2, slow: .6, title: 'Growing!' }); });
  Bus.on('grew', (p, i) => { UI.hint('grow'); fact('nogrow'); G.particles.sparkle(p.x, p.y, 16, '#fff3c0', 8); if (i === 2) later(12000, () => { if (P().stage === 'larva') UI.hint('flick'); }); });
  Bus.on('missed', () => UI.hint('missed'));
  Bus.on('herring', () => { UI.hint('herring'); fact('herring'); });
  Bus.on('combJelly', () => { if (first('jellyHint')) { UI.hint('jelly'); fact('combjelly'); } });
  Bus.on('whale', (w) => { UI.hint('whale'); fact('whale'); Cinematic.play({ follow: () => ({ x: (w.x + P().x) / 2, y: (w.y + P().y) / 2 }), zoom: .7, duration: 6, slow: .7, title: 'A grey whale!' }); });
  Bus.on('gullDip', () => { UI.hint('gull'); fact('gull'); });
  Bus.on('gullPass', (b) => { const p = P(); if (!p.swimming) return; if (Math.abs(b.target.x - p.x) < 60 && p.y < G.world.seaLevel() + 30) p.startTumble(80, 40); else Bus.emit('gullMissed'); });
  Bus.on('postlarva', (p) => { AudioFX.fanfare(); UI.hint('postlarva'); fact('settle'); Cinematic.play({ follow: P, zoom: 6, duration: 3, slow: .5, title: 'Time to settle!' }); fact('jet', 20000); });
  Bus.on('overBed', () => { UI.hint('search'); fact('den'); });
  Bus.on('searching', () => UI.hint('search'));
  Bus.on('taken', () => { if (first('takenFact')) fact('den'); });
  Bus.on('settled', (p, sh) => {
    AudioFX.magic(); UI.hint('juvenile'); fact(sh && sh.kind === 'bottle' ? 'bottle' : 'squeeze');
    Stickers.lifeDone(G.form, G.sex);
    Cinematic.play({ follow: P, zoom: 6, duration: 4, slow: .5, title: 'A den of my own!' });
    fact('sound', 9000); fact('suckers', 40000); later(16000, () => { if (P().stage === 'octopus' && P().instar === 1) UI.hint('friend'); });
  });
  Bus.on('drifter', () => { if (first('drift')) UI.hint('drift'); });
  Bus.on('firstFood', () => { if (P().instar >= 2) UI.hint('forage'); });
  Bus.on('exposed', () => UI.hint('hide'));
  Bus.on('shaded', () => { if (first('shadeHint') || P().safe < .3) UI.hint('hidden'); });
  Bus.on('blended', () => { if (first('blendHint')) { UI.hint('blend'); fact('camo'); fact('papillae', 15000); } });
  Bus.on('tuckIn', () => { G.particles.bubbles(P().x, P().y, 6); });
  Bus.on('tucked', () => { if (G.tod > .25 && G.tod < .78) G.tod = .8; UI.hint('tucked'); });
  Bus.on('predator', (h) => { UI.hint('predator'); fact('predators'); if (h.kind === 'seal') fact('seal', 4000); if (h.kind === 'otter') fact('otter', 4000); if (h.kind === 'lingcod') fact('lingcod', 4000); if (h.kind === 'wolfeel') fact('wolfeel', 4000); if (h.kind === 'sixgill') fact('sixgill', 4000); });
  Bus.on('flipped', () => { if (first('jetFact')) { UI.hint('flipped'); fact('ink'); } });
  Bus.on('dodged', () => UI.hint('dodged'));
  Bus.on('fullOct', (p) => { UI.hint(p.instar === 1 ? (p.sleepReady() ? 'sleep' : 'home') : 'full'); });
  Bus.on('digStart', () => UI.hint('dig'));
  Bus.on('deepEnough', (p) => { if (p.sleepReady()) UI.hint('sleep'); });
  Bus.on('noRoof', () => UI.hint('cover'));
  Bus.on('sleeping', (p) => { UI.hint('sleeping'); fact('sleep'); AudioFX.molt(); Cinematic.play({ follow: P, zoom: clamp(160 / (p.w + 20), 1.6, 6), duration: 3, slow: .6, title: 'Zzz…' }); });
  Bus.on('grewOct', (p, i) => { G.particles.sparkle(p.x, p.y, 20, '#fff3c0', p.w * .6); if (i === 4) { fact('size'); fact('life', 15000); } });
  Bus.on('favArm', () => { UI.hint('favarm'); fact('favarm'); fact('brains', 20000); });
  Bus.on('armChoice', () => { UI.hint('arm'); fact('favarm'); });
  Bus.on('middenGrew', () => { UI.hint('midden'); fact('midden'); });
  Bus.on('awake', (p) => {
    G.year++; G.day += 60;
    if (p.instar === 2) { UI.hint('forage'); fact('night'); fact('food', 12000); fact('beak', 24000); if (G.tod > .25 && G.tod < .75) G.tod = .82; if (once.forageNight) Bus.emit('forageNight'); }
    else if (p.instar >= 4) { UI.hint('adult'); fact('mood'); fact('hearts', 12000); fact('blood', 24000); fact('eyes', 36000); fact('smart', 48000); migrateAt = G.time + 60; if (!G.world.diver.done) diverAt = G.time + 12; }
    else UI.hint(p.mode === 'dig' ? 'out' : 'awake');
  });
  Bus.on('ateFood', (p, o) => { if (p.instar >= 2 && G.night > .5 && first('forageNight')) Bus.emit('forageNight'); if (p.instar >= 2 && first('foodFact')) fact('crab', 20000); if (o.kind === 'scallop' && first('eelgrassFact')) fact('eelgrass', 8000); });
  Bus.on('trapDown', () => { UI.hint('trap'); fact('pot'); });
  Bus.on('trapped', () => { UI.hint('hauled'); AudioFX.creak(); Cinematic.play({ follow: () => ({ x: P().x, y: P().y }), zoom: 2.4, duration: 4, slow: .8, title: 'Up to the boat!' }); });
  Bus.on('measured', (p) => { UI.hint('measured'); AudioFX.creak(); });
  Bus.on('putBack', () => { UI.hint(G.night > .5 ? 'forage' : 'daytime'); });
  Bus.on('diverArrived', () => { UI.hint('diver'); fact('diver'); AudioFX.magic(); });
  Bus.on('diverPhoto', () => { AudioFX.shutter && AudioFX.shutter(); });
  Bus.on('shook', () => { UI.hint('done'); later(2500, () => { if (P().instar >= 4) UI.hint('adult'); }); });
  Bus.on('armTip', () => { UI.hint('armtip'); fact('regrow'); });
  Bus.on('migrate', (p) => {
    const Wd = G.world;
    p.flags.migrating = true; p.flags.walkStart = p.x;
    Wd.setSeason('autumn'); Wd.setStorm(true, 50);
    Wd.startMarch(p, -1);
    UI.hint('autumn'); fact('seasons');
    AudioFX.fanfare();
    Cinematic.play({ follow: () => ({ x: P().x - 200, y: P().y - 40 }), zoom: 1.1, duration: 5, slow: .7, title: 'Down to the deep!' });
  });
  Bus.on('arrivedDeep', () => { UI.hint('arrived'); fact('winter'); });
  Bus.on('winterStart', () => { const Wd = G.world; Wd.setSeason('winter'); Wd.setStorm(false, 60); UI.hint('winter'); G.tod = .5; Cinematic.play({ follow: P, zoom: 2.2, duration: 4, slow: .6, title: 'Winter in the deep' }); });
  Bus.on('winterDone', (p) => {
    const Wd = G.world;
    Wd.setSeason('spring'); G.day += 120; G.year++;
    Wd.startMarch(p, 1);
    UI.hint('spring');
  });
  Bus.on('homeAgain', (p) => {
    const Wd = G.world;
    Wd.setSeason('summer'); Wd.marchers.length = 0;
    AudioFX.fanfare();
    Cinematic.play({ follow: P, zoom: 2, duration: 3.5, slow: .6, title: 'Home again!' });
    if (p.sex === 'boy') { UI.hint('site'); fact('contest', 9000); }
    else { Wd.makeMaleDens(); UI.hint('findmale'); fact('boss', 9000); }
  });
  Bus.on('siteDug', () => { rivalAt = G.time + 5; fact('contest'); });
  Bus.on('rivalArrived', () => { if (P().flags.met) return; UI.hint('rival'); AudioFX.clack(); });
  Bus.on('box', () => UI.hint('box'));
  Bus.on('boxWon', (p) => { UI.hint('won'); AudioFX.fanfare(); G.particles.confetti(p.x, p.y - 20, 50); if (!p.flags.boss) rivalAt = G.time + 8; });
  Bus.on('boxLost', () => { UI.hint('lost'); rivalAt = G.time + 22; });
  Bus.on('boss', () => { UI.hint('boss'); AudioFX.fanfare(); femaleAt = G.time + 6; fact('boss'); Cinematic.play({ follow: P, zoom: 2.4, duration: 3.5, slow: .5, title: 'The biggest on the reef!' }); });
  Bus.on('femaleArrived', () => { UI.hint('female'); fact('gift'); });
  Bus.on('met', (p, o) => {
    if (p.sex === 'boy') {
      /* she takes his den to lay her eggs; he goes off to rest */
      o.x = p.den ? p.den.x : o.x; o.mode = 'enter'; o.eggs = 0;
      UI.hint('done');
      later(5000, babiesAtSea);
    } else {
      /* he steps aside; she takes a den of her own next door and hangs her eggs */
      o.mode = 'stand'; o.role = 'guard'; o.x -= o.w * .9;
      p.startNest(o.door);
      UI.hint('nest'); fact('gift');
    }
  });
  Bus.on('brooding', () => { UI.hint('brood'); fact('egg'); fact('tend', 12000); fact('star', 30000); G.world.setSeason('autumn'); });
  Bus.on('intruder', (I) => { UI.hint('puff'); if (I.kind === 'rockfish') fact('rockfish'); });
  Bus.on('puffed', () => UI.hint('puffed'));
  Bus.on('broodDone', () => { const Wd = G.world; Wd.setSeason('spring'); G.day += 180; G.year++; G.tod = .9; UI.hint('moonready'); fact('hatch'); });
  Bus.on('release', () => UI.hint('release'));
  Bus.on('fan', (p, n) => { if (n === 1) fact('babies'); });
  Bus.on('babiesReleased', () => generationDone());
  /* a boy's ending: months later, on a spring night, she blows her babies free from his den */
  function babiesAtSea() {
    const p = P(); if (p.flags.genDone || p.flags.babiesAtSea) return;
    p.flags.babiesAtSea = true;
    const Wd = G.world;
    G.tod = .9; G.day += 200; Wd.setSeason('spring');
    makeMum(p.x + 60); const m = Wd.mum; m.form = Math.random() < .8 ? 'normal' : 'freckle'; m.shake = 1; m.face = -1;
    UI.hint('larvae'); fact('hatch');
    Cinematic.play({ follow: () => ({ x: m.x - 10, y: m.y - 30 }), zoom: 2.8, duration: 6, slow: .8, title: 'The next spring…' });
    let n = 0; const burst = () => { if (G.world !== Wd || n >= 6) return; n++; Wd.babyBurst(m.x - m.w * .2, m.y - m.w * .1, 60); AudioFX.splash(); m.eggs = Math.max(0, 1 - n / 6); later(900, burst); };
    later(1200, burst);
    later(7200, () => P().milestone('larvae', () => { if (Wd.mum) { Wd.mum.shake = 0; Wd.mum.leaving = true; } generationDone(); }));
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    UI.hint('larvae'); fact('lifecycle');
    Bus.emit('generationDone'); UI.refreshToggles();
    const open = () => { if (Reading.busy() || Cinematic.active) later(800, open); else UI.choice(); };
    later(2500, open);
  }

  /* ---------- debug jumps (?stage=…) ---------- */
  function toLarva(z, frac = .4) { const p = G.player, th = [0, ...G.diff().larva]; p.hatch(); p.zinstar = z; p.food = th[z - 1] + (th[z] - th[z - 1]) * frac; p.x = -600 - z * 300; p.y = 90; G.world.mum = null; G.world.babies.length = 0; Cinematic.stop(); for (let k = 1; k < z; k++) p.flags['zm' + k] = p.flags['ztight' + k] = true; }
  function toPost(x = -1500, y = 120) { toLarva(3, 1); const p = G.player; p.flags.zm3 = true; p.stage = 'postlarva'; p.x = x; p.y = y; G.world.drift = 1; }
  function toOct(instar, x, frac = .4) {
    const Wd = G.world, S = Wd.ground;
    toPost(x, 200); const p = G.player, D = G.diff(), th = [0, ...D.grow];
    let sh = Wd.nearestFreeHollow(x) || Wd.nearestShelter(x);
    p.settle(sh); p.squeeze = 0; p.instar = instar; p.cfood = instar < 4 ? th[instar - 1] + (th[instar] - th[instar - 1]) * frac : D.grow[2] * (1 + (BONUS - 1) * frac);
    p.cm = octCM(p.instar, p.cfood, D.grow);
    if (instar >= 3) p.favArm = 'right';
    if (instar > 1 || Math.abs(sh.x - x) > 200) { p.x = x; }
    p.y = S.walkTop(p.x, Math.max(4, p.w * .2)) - p.feet;
    p.flags.forageGate = instar >= 2;
    G.tod = instar >= 2 ? .88 : .4;
    Cinematic.stop();
  }
  function digHome(p, depth) {
    const S = G.world.ground;
    const clear = (x) => { const g0 = S.surfaceAt(x); for (let dx = -14; dx <= 14 + depth * .25; dx += 6) for (let d = 4; d < depth + 8; d += 5) if (!S.diggable(S.matAt(x + dx, g0 + d))) return false; return true; };
    for (let k = 0; k < 60; k++) { const x = p.x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8; if (clear(x)) { p.x = x; break; } }
    const gx = p.x, g = S.surfaceAt(gx);
    for (let d = 0; d <= depth; d += 3) S.blob(gx + d * .25, g + d, Math.max(13, p.w * .55), Math.max(11, p.w * .36), MAT.AIR, (m) => S.diggable(m) || m === MAT.GRAVEL);
    S.flushTop(); p.den = { x: gx, y: g }; p.mode = 'dig'; p.x = gx + depth * .25; p.y = g + depth; p.ang = Math.PI / 2;
  }
  function toWalking(x) { toOct(4, x, .6); const p = G.player; p.flags.migrating = true; p.flags.walkStart = 600; G.world.startMarch(p, -1); G.world.setSeason('autumn'); G.tod = .62; }
  function toHome(x, sex) { toOct(4, x, .7); const p = G.player; p.flags.migrating = p.flags.arrivedDeep = p.flags.wintered = p.flags.returning = p.flags.home = true; p.sex = sex; G.sex = sex; G.tod = .85; }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world;
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'storm') { wx.storm = 1; wx.cloud = 1; } }
    if (st) {
      const p = G.player;
      if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; Wd.mum.shake = 1; }
      else if (/^larva[123]$/.test(st)) toLarva(+st[5], +(params.get('frac') || .5));
      else if (st === 'whale') { toLarva(3, .5); whaleDone = true; Wd.startWhale(p); Wd.whale.x = p.x - 520; }
      else if (st === 'herring') { toLarva(2, .5); Wd.startSchool(p); Wd.school.x = p.x - 180; }
      else if (st === 'jelly') { toLarva(2, .5); const j = Wd.makeJelly(p.x + 30, p.y - 4); j.r = 16; Wd.jellies.push(j); }
      else if (st === 'gull') { toLarva(1, .5); p.y = 14; G.tod = .45; Wd.dip(p); }
      else if (st === 'postlarva') toPost();
      else if (st === 'search') { const sh = Wd.shelters.find(s => s.kind === 'hollow' && s.x > 0); toPost(sh.x - 40, sh.y - 14); }
      else if (st === 'bottle') { const sh = Wd.shelters.find(s => s.kind === 'bottle'); toPost(sh.x - 30, sh.y - 14); }
      else if (st === 'settle' || st === 'juvenile') toOct(1, WORLD.homeX, .3);
      else if (st === 'drift') { toOct(1, WORLD.homeX, .5); const it = Wd.spawnItem(p.x + 4, 'drift', true); it.fy = p.y - 60; }
      else if (st === 'sleep') { toOct(1, WORLD.homeX, 1); p.full = true; p.startSleep(); p.sleeping = 4; p.calm = 1; p.dream = 2; }
      else if (st === 'young' || st === 'forage') { toOct(2, 300, .4); if (st === 'forage') { p.x += 40; p.y = Wd.ground.walkTop(p.x, 4) - p.feet; } }
      else if (st === 'hunter' || st === 'jet') { toOct(2, 600, .5); G.tod = .4; Wd.startHunter(st === 'jet' ? 'lingcod' : 'wolfeel', p); Wd.hunters[0].x = p.x + 160; if (st === 'jet') p.jet(); }
      else if (st === 'blend') { toOct(2, 640, .5); G.tod = .4; p.blend = .95; p.red = 0; }
      else if (st === 'ink') { toOct(3, 700, .5); G.tod = .4; p.jet(); p.jetT = .35; }
      else if (st === 'seal' || st === 'otter') { toOct(3, 2200, .5); G.tod = .4; Wd.startHunter(st, p); Wd.hunters[0].x = p.x + 200; if (st === 'otter') Wd.hunters[0].y = p.y - 60; }
      else if (st === 'sixgill') { toWalking(-2050); p.flags.arrivedDeep = true; G.tod = .5; Wd.startHunter('sixgill', p); Wd.hunters[0].x = p.x + 300; }
      else if (st === 'den') { toOct(2, 700, 1); p.full = true; digHome(p, p.w * 1.2); }
      else if (st === 'midden') { toOct(2, 700, .6); G.tod = .86; digHome(p, p.w * .9); p.surface(); for (const k of ['crab', 'clam', 'crab', 'scallop', 'snail', 'clam']) Wd.dropShell(p.den.x + 8, k); p.x = p.den.x + p.w * .5; p.y = Wd.ground.walkTop(p.x, 6) - p.feet; }
      else if (st === 'kelp') toOct(3, 2000, .5);
      else if (st === 'trap') { toOct(2, 900, .5); Wd.startTrap(p); Wd.trap.state = 'set'; Wd.trap.y = Wd.trap.floor - 1; Wd.trap.x = p.x + 50; }
      else if (st === 'measured') { toOct(2, 900, .5); Wd.startTrap(p); Wd.trap.x = p.x; Wd.trap.state = 'up'; Wd.trap.y = Wd.seaLevel() - 24; Wd.trap.t = 0; p.mode = 'trap'; p.trapT = 0; p.flags.potted = true; Wd.trap.holding = true; Wd.trap.visited = true; G.tod = .5; }
      else if (st === 'adult') toOct(4, 900, .5);
      else if (st === 'diver') { toOct(4, 900, .5); G.tod = .45; Wd.startDiver(p); Wd.diver.x = p.x + 90; Wd.diver.y = Wd.ground.walkTop(Wd.diver.x, 6) - 34; Wd.diver.state = 'wait'; Wd.diver.t = 3; Wd.diver.photos = 1; }
      else if (st === 'armtip') { toOct(4, 900, .5); G.tod = .45; p.armShort = .9; p.flags.armTipDone = true; Wd.startHunter('wolfeel', p); Wd.hunters[0].x = p.x - 220; Wd.hunters[0].state = 'leave'; Wd.hunters[0].dir = -1; }
      else if (st === 'autumn') { toOct(4, 600, .6); Wd.setStorm(true, 60); Bus.emit('migrate', p); }
      else if (st === 'walk') toWalking(-400);
      else if (st === 'deep') { toWalking(-2050); p.flags.arrivedDeep = true; G.tod = .5; }
      else if (st === 'winter') { toWalking(-2100); p.flags.arrivedDeep = p.flags.winterDen = p.flags.winterStarted = true; digHome(p, p.w * .9); p.mode = 'winter'; p.winterT = 2; Wd.setSeason('winter'); Wd.weather.snow = 1; Wd.weather.cloud = .8; G.tod = .5; }
      else if (st === 'spring') { toWalking(-1500); p.flags.arrivedDeep = p.flags.wintered = p.flags.returning = true; Wd.marchers.length = 0; Wd.startMarch(p, 1); Wd.setSeason('spring'); G.tod = .3; }
      else if (st === 'site' || st === 'rival' || st === 'box' || st === 'boss' || st === 'female') {
        toHome(500, 'boy');
        digHome(p, p.w * .8); p.flags.siteDen = p.flags.denDug = true; p.surface();
        p.x = p.den.x + p.w * .7; p.y = Wd.ground.walkTop(p.x, 6) - p.feet;
        if (st === 'rival' || st === 'box') { const r = Wd.sendRival(p); r.x = r.goal; r.mode = 'stand'; r.face = -1; if (st === 'box') { p.startBox(r); p.wr.p = +(params.get('wp') || .3); p.wr.ring = 1.4; } }
        if (st === 'boss' || st === 'female') { p.stats.wins = G.diff().wins; p.flags.boss = p.flags.bossSeen = true; if (st === 'female') { const f = Wd.sendFemale(p); f.x = f.goal; f.mode = 'stand'; f.face = -1; } }
      }
      else if (st === 'host') { toHome(300, 'girl'); Wd.makeMaleDens(); }
      else if (st === 'nest' || st === 'brood' || st === 'puff') { toHome(300, 'girl'); Wd.makeMaleDens(); const h = Wd.hosts()[1]; p.flags.met = true; h.mode = 'stand'; h.role = 'guard'; h.x -= h.w * .9; p.startNest(h.door); Cinematic.stop(); p.broodT = +(params.get('bt') || (st === 'nest' ? 1 : 6)); G.tod = .5; if (st === 'puff') { Wd.intruderClock = 0; Wd.updateIntruder(.1, p); if (Wd.intruder) { Wd.intruder.x = p.den.x + Wd.intruder.side * 40; Wd.intruder.y = Wd.intruder.kind === 'star' ? Wd.ground.walkTop(Wd.intruder.x, 6) + 1 : Wd.ground.walkTop(p.den.x, 6) - 26; } } }
      else if (st === 'release') { toHome(400, 'girl'); p.flags.met = p.flags.broodDone = true; p.eggs = 1; G.tod = .92; digHome(p, p.w * .6); p.surface(); p.startRelease(); }
      else if (st === 'larvae') { toHome(500, 'boy'); p.flags.met = true; later(200, babiesAtSea); }
    }
    if (params.has('safe')) G.player.safe = +params.get('safe');
    if (params.has('food')) G.player.food = +params.get('food');
    if (params.has('blend')) G.player.blend = +params.get('blend');
    if (params.has('red')) G.player.red = +params.get('red');
  }

  /* the gamepad on the title and in the panels */
  function padMenus(pads) {
    const g = pads && pads[0]; if (!g) return;
    if (!G.started) { if (g.actionPressed || g.startPressed) start(false); return; }
    const choice = document.getElementById('choice');
    if (!choice.hidden) { if (g.actionPressed) document.getElementById('btnNextGen').click(); else if (g.eggPressed || g.startPressed) document.getElementById('btnKeep').click(); return; }
    if (g.eggPressed || g.startPressed || g.scopePressed) UI.closeModals();
  }

  /* ---------- the director: visitors, seasons, the hunters, the pot, the diver, rivals, partners ---------- */
  function director(dt) {
    const p = G.player, Wd = G.world, D = G.diff(), vis = settings.visitors;
    /* the egg's mother crawls off to rest once the babies are free */
    const m = Wd.mum;
    if (m) { if (m.leaving) { m.x += 14 * dt; m.face = 1; m.ph += dt; const top = Wd.ground.walkTop(m.x, 6) - m.feet; m.y += (top - m.y) * dt * 1.5; m.fade = (m.fade || 0) + dt * .25; if (m.fade > 1) Wd.mum = null; } else if (m.shake) m.ph += dt * 3; }
    const night = nightAmount(G.tod) > .5;
    if (p.swimming) {
      if (lastNight !== null && night !== lastNight && p.stage === 'larva') { UI.hint(night ? 'night' : 'day'); fact('updown'); }
      lastNight = night;
      if (p.stage === 'larva' && vis && D.fish && p.zinstar >= 2 && !Wd.school && G.time > schoolAt && p.growing <= 0) { Wd.startSchool(p); schoolAt = G.time + 80 + Math.random() * 50; }
      if (p.stage === 'larva' && vis && p.zinstar === 3 && !whaleDone && p.food > D.larva[1] + (D.larva[2] - D.larva[1]) * .3 && p.growing <= 0) { whaleDone = true; Wd.startWhale(p); }
      if (vis && !night && p.y < Wd.seaLevel() + 50 && G.time > gullAt) { if (Wd.dip(p)) gullAt = G.time + 50 + Math.random() * 40; }
      return;
    }
    if (p.stage !== 'octopus') return;
    if (p.mode === 'walk' && p.instar >= 2 && !night && p.shade === 'open' && !p.flags.migrating && first('daytimeHint')) UI.hint('daytime');
    if (p.mode === 'walk' && p.instar >= 2 && !once.eatHintShown && p.context() === 'eat') { once.eatHintShown = true; UI.hint('eat'); }
    /* hunters come by when a small octopus is out in the open (a seal or an otter by the kelp, the sixgill in the deep) */
    const huntable = p.mode === 'walk' && p.busy <= 0 && (p.shade === 'open' || p.shade === 'kelp' || p.shade === 'grass') && !(p.flags.home && (Wd.rival() || Wd.female())) && !p.flags.genDone && Wd.diver.state === 'away';
    if (vis && huntable && !Wd.hunters.length) {
      if (hunterAt === null) hunterAt = G.time + (D.fish ? 35 + Math.random() * 40 : 80 + Math.random() * 60);
      if (G.time > hunterAt) {
        hunterAt = null;
        const x = p.x, kind = x > WORLD.kelpL ? (Math.random() < .5 ? 'seal' : 'otter') : x < WORLD.slopeR ? 'sixgill' : x < WORLD.reefL ? 'lingcod' : pick(['lingcod', 'wolfeel', 'wolfeel', 'lingcod']);
        Wd.startHunter(kind, p);
      }
    }
    /* the crabber lets a pot down near a young octopus at night */
    if (vis && D.pot && p.instar >= 2 && p.instar <= 3 && !Wd.trap.done && Wd.trap.state === 'away' && p.mode === 'walk' && night && p.x > WORLD.reefL && p.x < WORLD.flatsR - 200) {
      if (trapAt === null) trapAt = G.time + 40 + Math.random() * 40;
      if (G.time > trapAt) { trapAt = null; Wd.startTrap(p); }
    }
    /* a diver comes to visit a giant by day, once */
    if (vis && p.instar >= 4 && !p.flags.migrating && !Wd.diver.done && Wd.diver.state === 'away' && p.mode === 'walk' && !night && !Wd.hunters.length && p.x > WORLD.reefL && p.x < WORLD.flatsR) {
      if (diverAt === null) diverAt = G.time + 10 + Math.random() * 10;
      if (G.time > diverAt) { diverAt = null; Wd.startDiver(p); }
    }
    /* a giant always has an autumn coming (also after a reload or a debug jump) */
    if (p.instar >= 4 && !p.flags.migrating && migrateAt === null) migrateAt = G.time + 60;
    /* autumn: down to the deep (not while the diver is here) */
    if (p.instar >= 4 && !p.flags.migrating && migrateAt !== null && G.time > migrateAt && p.mode === 'walk' && Wd.diver.state === 'away' && (Wd.diver.done || p.flags.shook || G.time > migrateAt + 90)) {
      migrateAt = null;
      Wd.setStorm(true, 70);
      later(2500, () => { if (!P().flags.migrating) Bus.emit('migrate', P()); });
    }
    if (p.flags.migrating && !p.flags.arrivedDeep) {
      if (p.x < WORLD.kelpL && p.x > WORLD.reefL && first('kelpHint')) UI.hint('kelpwalk');
      if (p.x < WORLD.slopeR && first('deepHint')) UI.hint('deep');
    }
    if (p.flags.returning && !p.flags.home && p.mode === 'walk' && first('homeHint')) UI.hint('home');
    /* boys: rivals come for the den, then a female */
    if (p.sex === 'boy' && p.flags.home && p.flags.denDug && !p.flags.met) {
      if (rivalAt !== null && G.time > rivalAt && !Wd.rival() && !p.flags.boss && p.mode !== 'box') { rivalAt = null; Wd.sendRival(p); }
      if (femaleAt !== null && G.time > femaleAt && !Wd.female() && p.flags.boss) { femaleAt = null; Wd.sendFemale(p); }
    }
  }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0, saveWarned = false;
  function simulate(dt) {
    const p = G.player;
    /* in the plankton the days go by twice as fast: the babies spend weeks up there */
    if (settings.clock && p.mode !== 'release') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (p.swimming ? 2 : 1)) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    director(dt);
    if (p.stage === 'octopus' && p.instar === 1 && first('metFriends') && G.world.shelters.some(s => s.taken && !s.mine && Math.abs(s.x - p.x) < 60)) Bus.emit('hint', 'friend');
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.stage === 'egg') { const m = G.world.mum; cam.follow(m ? m.x : p.x, m ? m.y - 14 : p.y, 4.2 * uz); }
    else if (p.stage === 'larva') cam.follow(p.x + p.face * 10, p.y, (7.2 - p.zinstar * .4) * uz);
    else if (p.stage === 'postlarva') cam.follow(p.x + p.face * 20, p.y, 4.4 * uz);
    else if (p.mode === 'box' && p.wr) cam.follow(p.wr.mid, p.y - p.w * .2, clamp(210 / (p.w + 20), 1.3, 5) * uz);
    else if (p.mode === 'release') cam.follow(p.x, p.y - 24, 3 * uz);
    else if (p.mode === 'trap') cam.follow(p.x, p.y - 20, 2.6 * uz);
    else {
      const z = clamp(170 / (p.w + 20), 1.2, 6) * (p.underground ? 1.15 : 1);
      cam.follow(p.x + p.face * p.w * .5, p.y - p.w * (p.underground ? 0 : .4), z * uz);
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
    if (G.started && !modal) readInput(); else p.input.x = p.input.y = 0;
    if (G.started && modal && Reading.busy()) Reading.gamepad(Gamepads.poll());
    else if (modal || !G.started) padMenus(Gamepads.poll());
    if (G.started && !modal) {
      /* time-lapse (F), and a fast-forward while the octopus just waits: sleeping, tending the eggs with nobody about, winter, tucked in */
      const waiting = (p.stage === 'egg' && !p.flags.eggReady) || ['sleep', 'tuck', 'winter'].includes(p.mode) || (p.mode === 'brood' && !G.world.intruder);
      G.warp = p.mode === 'box' || p.mode === 'release' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, (x) => G.world.ground.walkTop(x, 4));
    camera(rawDt);
    /* behind the title, with the painted look: the world from the title camera, its animals beside the card (the reef in spring) */
    if (!G.started && typeof GFX !== 'undefined' && GFX.active()) {
      const c0 = { x: G.cam.x, y: G.cam.y, zoom: G.cam.zoom }, tod0 = G.tod, n0 = G.night;
      Object.assign(G.cam, { x: 182 + .35 * W / 1.3, y: 270, zoom: 1.3 }); G.tod = 0.45;
      Render.frame(G, dt);
      Object.assign(G.cam, c0); G.tod = tod0; G.night = n0;
    } else Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} i${p.instar} z${p.zinstar} food=${p.food.toFixed(0)}/${p.cfood.toFixed(0)} safe=${p.safe.toFixed(2)} blend=${p.blend.toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}${typeof GFX !== 'undefined' && GFX.active() ? ` gl=${GFX.stats().ms.toFixed(1)}ms` : ''}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, lvl = Wd.seaLevel();
    AudioFX.update(dt, { night: G.night, surface: clamp(1 - (G.cam.y - lvl) / 260, 0, 1), inside: p.underground, storm: Wd.weather.storm, wind: Wd.weather.gust, swash: Wd.swash(), boat: Wd.trap.state !== 'away' ? clamp(1 - Math.abs(Wd.boat.x - G.cam.x) / 700, 0, 1) : 0, deep: clamp((G.cam.y - 300) / 300, 0, 1) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop (classic look): octopuses crawling over the reef under a spring sea ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const walkers = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), s: .5 + Math.random() * .5, sp: .006 + Math.random() * .006, ph: Math.random() * TAU, row: Math.random(), form: i === 2 ? 'brick' : i === 5 ? 'freckle' : 'normal', dir: Math.random() < .5 ? -1 : 1 }));
  walkers.sort((a, b) => a.row - b.row);
  const tBabies = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * .5, ph: Math.random() * TAU }));
  const tKelp = Array.from({ length: 10 }, (_, i) => ({ x: (i + Math.random() * .5) / 10, h: 220 + Math.random() * 260, ph: Math.random() * TAU, w: 6 + Math.random() * 6 }));
  const tStones = Array.from({ length: 22 }, () => ({ x: Math.random(), r: 16 + Math.random() * 30, row: Math.random() }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    if (typeof GFX !== 'undefined' && GFX.active()) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.drawImage(GFX.canvas(), 0, 0, tc.width, tc.height); return; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4aa8c8'); g.addColorStop(.12, '#2a7ea8'); g.addColorStop(.6, '#0e4a70'); g.addColorStop(1, '#06202e');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    tctx.fillStyle = 'rgba(255,255,255,.35)'; tctx.beginPath(); tctx.moveTo(0, 0); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, H * .05 + Math.sin(x * .02 + tt * 1.5) * 4); tctx.lineTo(W, 0); tctx.fill();
    tctx.save(); tctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) { const bx = (k / 9 + Math.sin(tt * .1 + k) * .02) * W; const lg = tctx.createLinearGradient(0, 0, 0, H * .85); lg.addColorStop(0, 'rgba(200,240,255,.14)'); lg.addColorStop(1, 'rgba(200,240,255,0)'); tctx.fillStyle = lg; tctx.beginPath(); tctx.moveTo(bx, 0); tctx.lineTo(bx + 40, 0); tctx.lineTo(bx + 200, H * .85); tctx.lineTo(bx + 110, H * .85); tctx.closePath(); tctx.fill(); }
    tctx.restore();
    for (const l of tBabies) { l.y -= dt * .006; if (l.y < .04) l.y = .5; const x = (l.x + Math.sin(tt * .3 + l.ph) * .01) * W, y = l.y * H; tctx.fillStyle = `rgba(200,240,255,${.4 + .4 * Math.sin(tt * 3 + l.ph)})`; tctx.beginPath(); tctx.arc(x, y, 1.6, 0, TAU); tctx.fill(); }
    for (const k of tKelp) { tctx.save(); tctx.globalAlpha = .55; Sprites.drawKelp(tctx, { x: k.x * W, h: k.h * Math.min(1.4, H / 800), ph: k.ph, w: k.w }, tt, H * .8); tctx.restore(); }
    const fg = tctx.createLinearGradient(0, H * .72, 0, H); fg.addColorStop(0, '#8a8070'); fg.addColorStop(1, '#3a3630');
    tctx.fillStyle = fg; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, H * .78); tctx.quadraticCurveTo(W * .5, H * .72, W, H * .77); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    for (const s of tStones) { const x = s.x * W, y = H * (.8 + s.row * .16), r = s.r * Math.min(1.4, W / 1100); const sg = tctx.createRadialGradient(x - r * .3, y - r * .4, 2, x, y, r * 1.2); sg.addColorStop(0, '#c8c0b0'); sg.addColorStop(1, '#5a5448'); tctx.fillStyle = sg; tctx.beginPath(); tctx.ellipse(x, y, r, r * .6, 0, Math.PI, TAU); tctx.fill(); tctx.fillStyle = 'rgba(200,120,150,.35)'; tctx.beginPath(); tctx.arc(x - r * .2, y - r * .35, r * .15, 0, TAU); tctx.fill(); }
    for (const c of walkers) {
      c.x += c.sp * c.dir * dt; c.ph += dt * 6; if (c.x < -.15) c.x = 1.15; if (c.x > 1.15) c.x = -.15;
      const x = c.x * W, y = H * (.82 + c.row * .12), s = c.s * Math.min(1.6, W / 900) * (.7 + c.row * .5);
      tctx.save(); tctx.translate(x, y); tctx.scale(c.dir, 1); Sprites.drawOctopus(tctx, { s, form: c.form, walk: c.ph, moving: true, sex: c.row > .5 ? 'boy' : 'girl', seed: 3, favArm: 'right', ph: tt }); tctx.restore();
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
  if (params.has('season') && SEASON_INFO[params.get('season')]) G.world.season = params.get('season');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); if (params.has('stage')) setTimeout(() => UI.hint(resumeHint()), 50); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'larva' }); UI.openJournal(); }
      else if (o === 'scope') { Microscope.open(G, params.get('subject') || 'boy'); if (params.has('cut')) document.getElementById('scopeCut').click(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'octopus', 'go', 'up', 'little', 'big', 'dig', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.jet = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
