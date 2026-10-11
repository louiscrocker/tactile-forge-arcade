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
    const raw = JSON.parse(localStorage.getItem('lobster.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('lobster.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

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
  let schoolAt = 0, sharkDone = false, ternAt = 0, hunterAt = null, trapAt = null, migrateAt = null, rivalAt = null, femaleAt = null, lastNight = null, lastFlip = -99;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.world = new World(G, seed);
    G.particles = new Particles();
    Render.invalidate();
  }
  /* the berried mother on the cobble bed, on a summer night, with her eggs under her tail */
  function makeMum(x0) {
    const Wd = G.world, S = Wd.ground, w = lobUnits(9.6);
    const cb = S.nearestCobble(x0 === undefined ? WORLD.eggX : x0), x = cb ? cb.x - cb.rad * 1.4 - w * .55 - 6 : WORLD.eggX;
    Wd.mum = { x, y: S.walkTop(x, 6) - w * .2, w, feet: w * .2, form: G.form, eggs: 1, shake: 0, ph: 0, leaving: false, face: -1 };
  }
  function newGame(newSeed) {
    G.form = settings.form; G.sex = settings.sex;
    G.fast = false;
    makeWorld(newSeed);
    G.tod = .9; G.moon = .5; G.year = 0;
    makeMum();
    G.players = [new Lobster(G, G.form, G.sex)];
    schoolAt = G.time + 30; sharkDone = false; ternAt = G.time + 25; hunterAt = null; trapAt = null; migrateAt = null; rivalAt = null; femaleAt = null; lastNight = null; lastFlip = -99;
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
    /* in a boxing match or while fanning the larvae, a tap is the button */
    if (p.mode === 'box' || p.mode === 'release' || p.stage === 'egg') { p.input.actionPressed = true; return; }
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next lobster will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This lobster stays as it is.`);
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
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Lobster(G, G.form, G.sex); G.players = [b]; b.restore(po); });
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
  /* put back the things a save does not hold: the egg's mother, the walking crowds, the partners on the cobble bed */
  function afterRestore() {
    const p = G.player, Wd = G.world;
    if (p.stage === 'egg') makeMum();
    if (p.flags.migrating && !p.flags.arrivedDeep) Wd.startMarch(p, -1);
    if (p.flags.returning && !p.flags.home) Wd.startMarch(p, 1);
    if (p.flags.home && p.sex === 'girl' && !p.flags.met) Wd.makeMaleDens();
    if (p.instar >= 4 && !p.flags.migrating) migrateAt = G.time + 25;
    if (p.flags.home && p.sex === 'boy' && p.flags.denDug && !p.flags.met) { if (p.flags.boss) femaleAt = G.time + 4; else rivalAt = G.time + 4; }
    if (p.flags.boss && !p.flags.bossSeen) { p.flags.bossSeen = true; later(1500, () => Bus.emit('boss', P())); }
    if (p.flags.met && !p.flags.genDone && p.sex === 'boy') later(2500, larvaeAtSea);
    if (p.flags.met && p.sex === 'girl' && p.flags.herMoultDone && !p.flags.broodStarted && p.mode !== 'harden') p.startBrood();
    if (p.stage === 'larva' && p.zinstar >= 3) sharkDone = true;
  }
  function resumeHint() {
    const p = G.player;
    if (p.stage === 'egg') return 'egg';
    if (p.stage === 'larva') return 'swim';
    if (p.stage === 'postlarva') return 'postlarva';
    if (p.mode === 'harden') return 'soft';
    if (p.mode === 'brood') return 'brood';
    if (p.mode === 'winter') return 'winter';
    if (p.flags.broodDone && !p.flags.released) return 'moonready';
    if (p.flags.migrating && !p.flags.arrivedDeep) return 'deep';
    if (p.flags.arrivedDeep && !p.flags.wintered) return 'arrived';
    if (p.flags.returning && !p.flags.home) return 'home';
    if (p.instar === 1) return p.full ? 'moult' : 'juvenile';
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
  Bus.on('started', () => { UI.hint('egg'); fact('egg', 1800); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? 'You are a lobster egg, under your mum\'s tail.' : 'You are one of thousands of lobster eggs, glued under your mother\'s tail on the cobble bed. It is a summer night.', { force: true }); });
  Bus.on('eggReady', () => { UI.hint('hatch'); const m = G.world.mum; if (m) m.shake = 1; });
  Bus.on('hatched', (p) => {
    AudioFX.hatch(); UI.hint('swim'); fact('hatch');
    const m = G.world.mum; if (m) { m.eggs = .5; later(5000, () => { const mm = G.world.mum; if (mm) { mm.shake = 0; mm.leaving = true; } }); }
    Cinematic.play({ follow: P, zoom: 7, duration: 3, slow: .5, title: 'Float free!' });
    fact('larva', 9000); fact('plankton', 30000); fact('moon', 60000);
  });
  Bus.on('ate', (p) => { if (p.stats.plankton === 6) fact('diatom'); if (p.stats.plankton === 3) UI.hint('bigger'); });
  Bus.on('copepodJump', () => { if (first('copepod')) UI.hint('copepod'); });
  Bus.on('ateCopepod', () => fact('copepod'));
  Bus.on('glow', () => { if (first('glow')) fact('glow'); });
  Bus.on('dash', () => { if (first('dashed')) UI.hint('swim'); });
  Bus.on('tight', () => { UI.hint('tight'); AudioFX.bump(); });
  Bus.on('molting', (p) => { AudioFX.molt(); Cinematic.play({ follow: P, zoom: p.stage === 'lobster' ? clamp(160 / (p.w + 20), 1.6, 6) : 7, duration: MOLT_T + .4, slow: .6, title: p.stage === 'lobster' ? 'The shell splits…' : 'Moulting!' }); });
  Bus.on('molted', (p, i) => { UI.hint('bigger'); fact('seamoult'); G.particles.sparkle(p.x, p.y, 16, '#fff3c0', 8); if (i === 2) later(12000, () => { if (P().stage === 'larva') UI.hint('flick'); }); });
  Bus.on('missed', () => UI.hint('missed'));
  Bus.on('herring', () => { UI.hint('herring'); fact('herring'); });
  Bus.on('combJelly', () => { if (first('jellyHint')) { UI.hint('jelly'); fact('combjelly'); } });
  Bus.on('basking', (w) => { UI.hint('basking'); fact('basking'); Cinematic.play({ follow: () => ({ x: (w.x + P().x) / 2, y: (w.y + P().y) / 2 }), zoom: .7, duration: 6, slow: .7, title: 'A basking shark!' }); });
  Bus.on('ternDip', () => { UI.hint('tern'); fact('tern'); });
  Bus.on('ternPass', (b) => { const p = P(); if (!p.swimming) return; if (Math.abs(b.target.x - p.x) < 60 && p.y < G.world.seaLevel() + 30) p.startTumble(80, 40); else Bus.emit('ternMissed'); });
  Bus.on('postlarva', (p) => { AudioFX.fanfare(); UI.hint('postlarva'); fact('postlarva'); Cinematic.play({ follow: P, zoom: 6, duration: 3, slow: .5, title: 'Stage IV!' }); fact('walkswim', 20000); });
  Bus.on('overBed', () => { UI.hint('search'); fact('settle'); });
  Bus.on('searching', () => UI.hint('search'));
  Bus.on('taken', () => { if (first('takenFact')) fact('settle'); });
  Bus.on('settled', (p) => {
    AudioFX.magic(); UI.hint('juvenile'); fact('nursery');
    Stickers.lifeDone(G.form, G.sex);
    Cinematic.play({ follow: P, zoom: 6, duration: 4, slow: .5, title: 'A hole of my own!' });
    fact('gulf', 9000); fact('firstyear', 40000); later(16000, () => { if (P().stage === 'lobster' && P().instar === 1) UI.hint('friend'); });
  });
  Bus.on('drifter', () => { if (first('drift')) UI.hint('drift'); });
  Bus.on('firstFood', () => { if (P().instar >= 2) UI.hint('forage'); });
  Bus.on('exposed', () => UI.hint('hide'));
  Bus.on('shaded', () => { if (first('shadeHint') || P().safe < .3) UI.hint('hidden'); });
  Bus.on('tuckIn', () => { G.particles.bubbles(P().x, P().y, 6); });
  Bus.on('tucked', () => { if (G.tod > .25 && G.tod < .78) G.tod = .8; UI.hint('tucked'); });
  Bus.on('predator', (h) => { UI.hint('predator'); fact('predators'); if (h.kind === 'seal') fact('seal'); });
  Bus.on('flipped', () => { if (first('flipFact')) { UI.hint('flipped'); fact('tailflip'); } });
  Bus.on('dodged', () => UI.hint('dodged'));
  Bus.on('fullLob', (p) => { UI.hint(p.instar === 1 ? (p.moultReady() ? 'moult' : 'home') : 'full'); });
  Bus.on('digStart', () => UI.hint('dig'));
  Bus.on('deepEnough', (p) => { if (p.moultReady()) UI.hint('moult'); });
  Bus.on('noRoof', () => UI.hint('cover'));
  Bus.on('lobMolted', (p, i) => {
    UI.hint('soft'); fact('soft'); if (i === 4) fact('age', 15000);
    G.particles.sparkle(p.x, p.y, 20, '#fff3c0', p.w * .6);
  });
  Bus.on('exuviaReady', () => { later(2500, () => { const p = P(); if (p.stage === 'lobster' && G.world.exuviae.some(e => !e.eaten)) { UI.hint('shellmeal'); fact('eatshell'); } }); });
  Bus.on('crusher', () => { UI.hint('crusher'); fact('claws'); fact('regrow', 20000); });
  Bus.on('clawChoice', () => { UI.hint('claw'); fact('claws'); });
  Bus.on('hardened', (p) => {
    const Wd = G.world;
    if (p.flags.herMoult) { if (!p.flags.broodStarted) p.startBrood(); return; }
    G.year++; G.day += 60;
    if (p.instar === 2) { UI.hint('forage'); fact('night'); fact('food', 12000); if (G.tod > .25 && G.tod < .75) G.tod = .82; if (once.forageNight) Bus.emit('forageNight'); }
    else if (p.instar >= 4) { UI.hint('adult'); fact('colour'); fact('bluewhy', 12000); fact('mill', 24000); fact('blood', 36000); fact('taste', 48000); migrateAt = G.time + 40; }
    else UI.hint(p.mode === 'dig' ? 'out' : 'hard');
  });
  Bus.on('ateFood', (p) => { if (p.instar >= 2 && G.night > .5 && first('forageNight')) Bus.emit('forageNight'); if (p.instar >= 2 && first('foodFact')) fact('urchin', 20000); });
  Bus.on('trapDown', () => { UI.hint('trap'); fact('trap'); });
  Bus.on('trapped', () => { UI.hint('hauled'); AudioFX.creak(); Cinematic.play({ follow: () => ({ x: P().x, y: P().y }), zoom: 2.4, duration: 4, slow: .8, title: 'Up to the boat!' }); });
  Bus.on('measured', (p) => { UI.hint('measured'); fact('vnotch'); AudioFX.creak(); });
  Bus.on('putBack', () => { UI.hint(G.night > .5 ? 'forage' : 'daytime'); });
  Bus.on('migrate', (p) => {
    const Wd = G.world;
    p.flags.migrating = true; p.flags.walkStart = p.x;
    Wd.setSeason('autumn'); Wd.setStorm(true, 50);
    Wd.startMarch(p, -1);
    UI.hint('autumn'); fact('migration');
    AudioFX.fanfare();
    Cinematic.play({ follow: () => ({ x: P().x - 200, y: P().y - 40 }), zoom: 1.1, duration: 5, slow: .7, title: 'The long walk!' });
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
  Bus.on('boss', () => { UI.hint('boss'); AudioFX.fanfare(); femaleAt = G.time + 6; fact('boss'); Cinematic.play({ follow: P, zoom: 2.4, duration: 3.5, slow: .5, title: 'Boss of the cobble bed!' }); });
  Bus.on('femaleArrived', () => { UI.hint('female'); fact('female'); });
  Bus.on('met', (p, o) => {
    if (p.sex === 'boy') {
      /* she goes into his den to moult where it is safe; he guards the door */
      o.x = p.den ? p.den.x : o.x; o.mode = 'enter'; o.eggs = 0;
      UI.hint('done');
      later(5000, larvaeAtSea);
    } else {
      /* he steps aside and guards; she goes down into his den to moult */
      o.mode = 'stand'; o.role = 'guard'; o.x += o.w * .9;
      p.startHerMoult(o.door);
      UI.hint('hermoult'); fact('female');
    }
  });
  Bus.on('brooding', () => { UI.hint('brood'); fact('eggs'); fact('swimmerets', 12000); fact('vnotch', 24000); G.world.setSeason('autumn'); });
  Bus.on('broodDone', () => { const Wd = G.world; Wd.setSeason('summer'); G.day += 270; G.year++; G.tod = .9; UI.hint('moonready'); fact('hatch'); });
  Bus.on('release', () => UI.hint('release'));
  Bus.on('fan', (p, n) => { if (n === 1) fact('larva'); });
  Bus.on('larvaeReleased', () => generationDone());
  /* a boy's ending: months later, on a summer night, she fans her larvae free from beside his den */
  function larvaeAtSea() {
    const p = P(); if (p.flags.genDone || p.flags.larvaeAtSea) return;
    p.flags.larvaeAtSea = true;
    const Wd = G.world;
    G.tod = .9; G.day += 300; Wd.setSeason('summer');
    makeMum(p.x + 60); const m = Wd.mum; m.form = Math.random() < .9 ? 'normal' : 'blue'; m.shake = 1; m.face = -1;
    UI.hint('larvae'); fact('hatch');
    Cinematic.play({ follow: () => ({ x: m.x - 10, y: m.y - 30 }), zoom: 2.8, duration: 6, slow: .8, title: 'The next summer…' });
    let n = 0; const burst = () => { if (G.world !== Wd || n >= 6) return; n++; Wd.larvaBurst(m.x - m.w * .2, m.y, 60); AudioFX.splash(); m.eggs = Math.max(0, 1 - n / 6); later(900, burst); };
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
  function toLarva(z, frac = .4) { const p = G.player, th = [0, ...G.diff().larva]; p.hatch(); p.zinstar = z; p.food = th[z - 1] + (th[z] - th[z - 1]) * frac; p.x = -600 - z * 300; p.y = 90; G.world.mum = null; G.world.larvaCloud.length = 0; Cinematic.stop(); for (let k = 1; k < z; k++) p.flags['zm' + k] = p.flags['ztight' + k] = true; }
  function toPost(x = -1500, y = 120) { toLarva(3, 1); const p = G.player; p.flags.zm3 = true; p.stage = 'postlarva'; p.x = x; p.y = y; G.world.drift = 1; }
  function toLob(instar, x, frac = .4) {
    const Wd = G.world, S = Wd.ground;
    toPost(x, 200); const p = G.player, D = G.diff(), th = [0, ...D.lob];
    let sh = Wd.nearestFreeHollow(x) || Wd.nearestShelter(x);
    p.settle(sh); p.instar = instar; p.cfood = instar < 4 ? th[instar - 1] + (th[instar] - th[instar - 1]) * frac : D.lob[2] * (1 + (BONUS - 1) * frac);
    p.cm = lobCM(p.instar, p.cfood, D.lob); p.pale = 0;
    if (instar >= 3) p.crusher = 'right';
    if (instar > 1 || Math.abs(sh.x - x) > 200) { p.x = x; }
    p.y = S.walkTop(p.x, Math.max(4, p.w * .2)) - p.feet;
    p.flags.forageGate = instar >= 2;
    G.tod = instar >= 2 ? .88 : .4;
    Cinematic.stop();
  }
  function digHome(p, depth) {
    const S = G.world.ground;
    /* a spot of clear sand (or mud) close by, so the den can be seen */
    const clear = (x) => { const g0 = S.surfaceAt(x); for (let dx = -14; dx <= 14 + depth * .25; dx += 6) for (let d = 4; d < depth + 8; d += 5) if (!S.diggable(S.matAt(x + dx, g0 + d))) return false; return true; };
    for (let k = 0; k < 60; k++) { const x = p.x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8; if (clear(x)) { p.x = x; break; } }
    const gx = p.x, g = S.surfaceAt(gx);
    for (let d = 0; d <= depth; d += 3) S.blob(gx + d * .25, g + d, Math.max(13, p.w * .55), Math.max(11, p.w * .36), MAT.AIR, (m) => S.diggable(m) || m === MAT.GRAVEL);
    S.flushTop(); p.den = { x: gx, y: g }; p.mode = 'dig'; p.x = gx + depth * .25; p.y = g + depth; p.ang = Math.PI / 2;
  }
  function toWalking(x) { toLob(4, x, .6); const p = G.player; p.flags.migrating = true; p.flags.walkStart = 600; G.world.startMarch(p, -1); G.world.setSeason('autumn'); G.tod = .62; }
  function toHome(x, sex) { toLob(4, x, .7); const p = G.player; p.flags.migrating = p.flags.arrivedDeep = p.flags.wintered = p.flags.returning = p.flags.home = true; p.sex = sex; G.sex = sex; G.tod = .85; }
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
      else if (st === 'shark') { toLarva(3, .5); sharkDone = true; Wd.startShark(p); Wd.shark.x = p.x - 520; }
      else if (st === 'herring') { toLarva(2, .5); Wd.startSchool(p); Wd.school.x = p.x - 180; }
      else if (st === 'jelly') { toLarva(2, .5); const j = Wd.makeJelly(p.x + 30, p.y - 4); j.r = 16; Wd.jellies.push(j); }
      else if (st === 'tern') { toLarva(1, .5); p.y = 14; G.tod = .45; Wd.dip(p); }
      else if (st === 'postlarva') toPost();
      else if (st === 'search') { const sh = Wd.shelters.find(s => s.kind === 'hollow' && s.x > 0); toPost(sh.x - 40, sh.y - 14); }
      else if (st === 'settle' || st === 'juvenile') toLob(1, WORLD.homeX, .3);
      else if (st === 'drift') { toLob(1, WORLD.homeX, .5); const it = Wd.spawnItem(p.x + 4, 'drift', true); it.fy = p.y - 60; }
      else if (st === 'jmoult') { toLob(1, WORLD.homeX, 1); p.full = true; p.startMoult(); p.molting = 1.2; }
      else if (st === 'young' || st === 'forage') { toLob(2, 300, .4); if (st === 'forage') { p.x += 40; p.y = Wd.ground.walkTop(p.x, 4) - p.feet; } }
      else if (st === 'hunter' || st === 'flip') { toLob(2, 600, .5); G.tod = .4; Wd.startHunter(st === 'flip' ? 'cod' : 'sculpin', p); Wd.hunters[0].x = p.x + 160; if (st === 'flip') p.flip(); }
      else if (st === 'seal') { toLob(3, 2200, .5); G.tod = .4; Wd.startHunter('seal', p); Wd.hunters[0].x = p.x + 200; }
      else if (st === 'den') { toLob(2, 700, 1); p.full = true; digHome(p, p.w * 1.2); }
      else if (st === 'harden') { toLob(3, 700, 0); digHome(p, p.w * 1.2); p.mode = 'harden'; p.hardT = 2; p.pale = .7; Wd.exuviae.push({ x: p.x - p.w * .35, y: p.y + p.feet * .2, s: p.w / 100 * .87, form: p.form, eaten: false, t: 0 }); }
      else if (st === 'kelp') toLob(3, 2000, .5);
      else if (st === 'trap') { toLob(2, 900, .5); Wd.startTrap(p); Wd.trap.state = 'set'; Wd.trap.y = Wd.trap.floor - 1; Wd.trap.x = p.x + 50; }
      else if (st === 'measured') { toLob(2, 900, .5); Wd.startTrap(p); Wd.trap.x = p.x; Wd.trap.state = 'up'; Wd.trap.y = Wd.seaLevel() - 24; Wd.trap.t = 0; p.mode = 'trap'; p.trapT = 0; p.flags.trapped = true; Wd.trap.holding = true; Wd.trap.visited = true; G.tod = .5; }
      else if (st === 'adult') toLob(4, 900, .5);
      else if (st === 'autumn') { toLob(4, 600, .6); Wd.setStorm(true, 60); Bus.emit('migrate', p); }
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
      else if (st === 'hermoult') { toHome(300, 'girl'); Wd.makeMaleDens(); const h = Wd.hosts()[1]; p.flags.met = true; h.mode = 'stand'; h.role = 'guard'; h.x += h.w * .9; p.startHerMoult(h.door); p.molting = .5; }
      else if (st === 'brood') { toHome(300, 'girl'); Wd.makeMaleDens(); const h = Wd.hosts()[1]; p.flags.met = p.flags.herMoult = p.flags.herMoultDone = true; h.mode = 'stand'; h.role = 'guard'; h.x += h.w * .9; p.startHerMoult(h.door); p.flags.herMoultDone = true; p.startBrood(); Cinematic.stop(); p.broodT = +(params.get('bt') || 6); G.tod = .5; }
      else if (st === 'release') { toHome(400, 'girl'); p.flags.met = p.flags.broodDone = true; p.eggs = 1; G.tod = .92; p.startRelease(); }
      else if (st === 'larvae') { toHome(500, 'boy'); p.flags.met = true; later(200, larvaeAtSea); }
    }
    if (params.has('safe')) G.player.safe = +params.get('safe');
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

  /* ---------- the director: visitors, seasons, the hunters, the trap, rivals, partners ---------- */
  function director(dt) {
    const p = G.player, Wd = G.world, D = G.diff(), vis = settings.visitors;
    /* the egg's mother walks back into her den once the larvae are free */
    const m = Wd.mum;
    if (m) { if (m.leaving) { m.x += 14 * dt; m.face = 1; m.ph += dt; m.y = Wd.ground.walkTop(m.x, 6) - m.feet; m.fade = (m.fade || 0) + dt * .25; if (m.fade > 1) Wd.mum = null; } else if (m.shake) m.ph += dt * 3; }
    const night = nightAmount(G.tod) > .5;
    if (p.swimming) {
      if (lastNight !== null && night !== lastNight && p.stage === 'larva') { UI.hint(night ? 'night' : 'day'); fact('updown'); }
      lastNight = night;
      if (p.stage === 'larva' && vis && D.fish && p.zinstar >= 2 && !Wd.school && G.time > schoolAt && p.molting <= 0) { Wd.startSchool(p); schoolAt = G.time + 80 + Math.random() * 50; }
      if (p.stage === 'larva' && vis && p.zinstar === 3 && !sharkDone && p.food > D.larva[1] + (D.larva[2] - D.larva[1]) * .3 && p.molting <= 0) { sharkDone = true; Wd.startShark(p); }
      if (vis && !night && p.y < Wd.seaLevel() + 50 && G.time > ternAt) { if (Wd.dip(p)) ternAt = G.time + 50 + Math.random() * 40; }
      return;
    }
    if (p.stage !== 'lobster') return;
    if (p.mode === 'walk' && p.instar >= 2 && !night && p.shade === 'open' && !p.flags.migrating && first('daytimeHint')) UI.hint('daytime');
    if (p.mode === 'walk' && p.instar >= 2 && !once.eatHintShown && p.context() === 'eat') { once.eatHintShown = true; UI.hint('eat'); }
    /* hunters come by when a small or soft lobster is out in the open (a seal by the kelp and the ledge) */
    const huntable = p.mode === 'walk' && p.busy <= 0 && (p.shade === 'open' || p.shade === 'kelp') && !(p.flags.home && (Wd.rival() || Wd.female())) && !p.flags.genDone;
    if (vis && huntable && !Wd.hunters.length) {
      if (hunterAt === null) hunterAt = G.time + (D.fish ? 35 + Math.random() * 40 : 80 + Math.random() * 60);
      if (G.time > hunterAt) {
        hunterAt = null;
        const x = p.x, kind = x > WORLD.kelpL ? (Math.random() < .5 ? 'seal' : 'bass') : x < WORLD.cobbleL ? 'cod' : pick(['cod', 'sculpin', 'sculpin', 'bass']);
        Wd.startHunter(kind, p);
      }
    }
    /* the lobsterman lets a trap down near a young lobster at night */
    if (vis && D.trap && p.instar >= 2 && p.instar <= 3 && !Wd.trap.done && Wd.trap.state === 'away' && p.mode === 'walk' && night && p.x > WORLD.cobbleL && p.x < WORLD.ledgeR - 200) {
      if (trapAt === null) trapAt = G.time + 40 + Math.random() * 40;
      if (G.time > trapAt) { trapAt = null; Wd.startTrap(p); }
    }
    /* autumn: the long walk offshore */
    if (p.instar >= 4 && !p.flags.migrating && migrateAt !== null && G.time > migrateAt && p.mode === 'walk') {
      migrateAt = null;
      Wd.setStorm(true, 70);
      later(2500, () => { if (!P().flags.migrating) Bus.emit('migrate', P()); });
    }
    if (p.flags.migrating && !p.flags.arrivedDeep) {
      if (p.x < WORLD.kelpL && p.x > WORLD.cobbleL && first('kelpHint')) UI.hint('kelpwalk');
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
    /* in the plankton the days go by twice as fast: the larvae spend weeks up there */
    if (settings.clock && p.mode !== 'release') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (p.swimming ? 2 : 1)) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    director(dt);
    if (p.stage === 'lobster' && p.instar === 1 && first('metFriends') && G.world.shelters.some(s => s.taken && !s.mine && Math.abs(s.x - p.x) < 60)) Bus.emit('hint', 'friend');
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.stage === 'egg') { const m = G.world.mum; cam.follow(m ? m.x : p.x, m ? m.y - 10 : p.y, 4.6 * uz); }
    else if (p.stage === 'larva') cam.follow(p.x + p.face * 10, p.y, (7.2 - p.zinstar * .4) * uz);
    else if (p.stage === 'postlarva') cam.follow(p.x + p.face * 20, p.y, 4.4 * uz);
    else if (p.mode === 'box' && p.wr) cam.follow(p.wr.mid, p.y - p.w * .2, clamp(210 / (p.w + 20), 1.6, 5) * uz);
    else if (p.mode === 'release') cam.follow(p.x, p.y - 24, 3.4 * uz);
    else if (p.mode === 'trap') cam.follow(p.x, p.y - 20, 2.6 * uz);
    else {
      const z = clamp(170 / (p.w + 20), 1.25, 6) * (p.underground ? 1.15 : 1);
      cam.follow(p.x + p.face * p.w * .6, p.y - p.w * (p.underground ? 0 : .5), z * uz);
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
      /* time-lapse (F), and a fast-forward while the lobster just waits: hardening, brooding, winter, tucked in */
      const waiting = (p.stage === 'egg' && !p.flags.eggReady) || ['harden', 'brood', 'tuck', 'winter'].includes(p.mode);
      G.warp = p.mode === 'box' || p.mode === 'release' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
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
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} i${p.instar} z${p.zinstar} food=${p.food.toFixed(0)}/${p.cfood.toFixed(0)} safe=${p.safe.toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, lvl = Wd.seaLevel();
    AudioFX.update(dt, { night: G.night, surface: clamp(1 - (G.cam.y - lvl) / 260, 0, 1), inside: p.underground, storm: Wd.weather.storm, wind: Wd.weather.gust, swash: Wd.swash(), boat: Wd.trap.state !== 'away' ? clamp(1 - Math.abs(Wd.boat.x - G.cam.x) / 700, 0, 1) : 0, deep: clamp((G.cam.y - 300) / 300, 0, 1) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: lobsters walking over the cobbles under a summer sea ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const walkers = Array.from({ length: 9 }, (_, i) => ({ x: Math.random(), s: .5 + Math.random() * .5, sp: .008 + Math.random() * .008, ph: Math.random() * TAU, row: Math.random(), form: i === 2 ? 'blue' : i === 6 ? 'calico' : 'normal', dir: Math.random() < .5 ? -1 : 1 }));
  walkers.sort((a, b) => a.row - b.row);
  const tLarvae = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * .5, ph: Math.random() * TAU }));
  const tKelp = Array.from({ length: 14 }, (_, i) => ({ x: (i + Math.random() * .5) / 14, h: 160 + Math.random() * 260, ph: Math.random() * TAU, w: 6 + Math.random() * 6 }));
  const tStones = Array.from({ length: 26 }, () => ({ x: Math.random(), r: 14 + Math.random() * 26, row: Math.random() }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5ab8e0'); g.addColorStop(.12, '#2a86c0'); g.addColorStop(.6, '#0e4a80'); g.addColorStop(1, '#06203a');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    /* the surface rippling overhead, and the boat's hull */
    tctx.fillStyle = 'rgba(255,255,255,.35)'; tctx.beginPath(); tctx.moveTo(0, 0); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, H * .05 + Math.sin(x * .02 + tt * 1.5) * 4); tctx.lineTo(W, 0); tctx.fill();
    tctx.save(); tctx.translate(W * .78, H * .05 + Math.sin(tt) * 2); tctx.fillStyle = 'rgba(10,30,50,.65)'; tctx.beginPath(); tctx.moveTo(-120, -4); tctx.quadraticCurveTo(0, 30, 120, -6); tctx.lineTo(120, -10); tctx.lineTo(-120, -10); tctx.fill(); tctx.strokeStyle = 'rgba(220,230,240,.5)'; tctx.lineWidth = 1.5; tctx.beginPath(); tctx.moveTo(-60, 4); tctx.quadraticCurveTo(-70, H * .4, -40, H * .62); tctx.stroke(); tctx.restore();
    /* sun rays through the water */
    tctx.save(); tctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) { const bx = (k / 9 + Math.sin(tt * .1 + k) * .02) * W; const lg = tctx.createLinearGradient(0, 0, 0, H * .85); lg.addColorStop(0, 'rgba(200,240,255,.14)'); lg.addColorStop(1, 'rgba(200,240,255,0)'); tctx.fillStyle = lg; tctx.beginPath(); tctx.moveTo(bx, 0); tctx.lineTo(bx + 40, 0); tctx.lineTo(bx + 200, H * .85); tctx.lineTo(bx + 110, H * .85); tctx.closePath(); tctx.fill(); }
    tctx.restore();
    /* glittering larvae drifting up near the surface */
    for (const l of tLarvae) { l.y -= dt * .006; if (l.y < .04) l.y = .5; const x = (l.x + Math.sin(tt * .3 + l.ph) * .01) * W, y = l.y * H; tctx.fillStyle = `rgba(200,240,255,${.4 + .4 * Math.sin(tt * 3 + l.ph)})`; tctx.beginPath(); tctx.arc(x, y, 1.6, 0, TAU); tctx.fill(); }
    /* kelp swaying */
    for (const k of tKelp) { tctx.save(); tctx.globalAlpha = .55; Sprites.drawKelp(tctx, { x: k.x * W, h: k.h * Math.min(1.4, H / 800), ph: k.ph, w: k.w }, tt, H * .8); tctx.restore(); }
    /* the cobble bed */
    const fg = tctx.createLinearGradient(0, H * .72, 0, H); fg.addColorStop(0, '#9a8a6a'); fg.addColorStop(1, '#4a4234');
    tctx.fillStyle = fg; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, H * .78); tctx.quadraticCurveTo(W * .5, H * .72, W, H * .77); tctx.lineTo(W, H); tctx.closePath(); tctx.fill();
    for (const s of tStones) { const x = s.x * W, y = H * (.8 + s.row * .16), r = s.r * Math.min(1.4, W / 1100); const sg = tctx.createRadialGradient(x - r * .3, y - r * .4, 2, x, y, r * 1.2); sg.addColorStop(0, '#c8c0b0'); sg.addColorStop(1, '#5a5448'); tctx.fillStyle = sg; tctx.beginPath(); tctx.ellipse(x, y, r, r * .6, 0, Math.PI, TAU); tctx.fill(); tctx.fillStyle = 'rgba(200,120,150,.35)'; tctx.beginPath(); tctx.arc(x - r * .2, y - r * .35, r * .15, 0, TAU); tctx.fill(); }
    /* lobsters walking across */
    for (const c of walkers) {
      c.x += c.sp * c.dir * dt; c.ph += dt * 7; if (c.x < -.15) c.x = 1.15; if (c.x > 1.15) c.x = -.15;
      const x = c.x * W, y = H * (.82 + c.row * .12), s = c.s * Math.min(1.6, W / 900) * (.7 + c.row * .5);
      tctx.save(); tctx.translate(x, y); tctx.scale(c.dir, 1); Sprites.drawLobster(tctx, { s, form: c.form, walk: c.ph, moving: true, sex: c.row > .5 ? 'boy' : 'girl', seed: 3, crusher: 'right', ph: tt }); tctx.restore();
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'lobster', 'go', 'up', 'little', 'big', 'dig', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.flip = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
