/* ============================================================
   main.js — the game loop, input, the title, glue
   (the story's director lives in story.js, shared with smoke.js)
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'pink', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('jellyfish.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!raw || !(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('jellyfish.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .85, day: 1, generation: 1, moon: .5, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form, sex: settings.sex,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
  const DAY_LENGTH = 240;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;

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
    G.tod = .85; G.moon = .5; G.year = 0;
    G.players = [new Jelly(G, G.form, G.sex)];
    Story.reset();
    Story.makeMum();
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 4;
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
    if (K === 'o' && typeof GFX !== 'undefined' && GFX.canvas()) UI.hint(GFX.toggle() ? 'New look (WebGL) on' : 'New look off (classic)');
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

  /* tap the sea to swim there */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    /* while popping free or letting the planulae go, and on Mum's arm, a tap is the button */
    if (p.mode === 'pop' || p.mode === 'release' || p.stage === 'egg') { p.input.actionPressed = true; return; }
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next jelly will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This jelly stays as it is.`);
  const freshStart = (gen) => { UI.resetFacts(); G.generation = gen; Stickers.setGeneration(G.generation); G.day = 1; newGame((Math.random() * 1e9) | 0); SaveGame.write(G); Reading.onStart(); Bus.emit('started', G.player); UI.refreshToggles(); };
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
    onNewGame: () => freshStart(1),
    onNextGeneration: () => freshStart(G.generation + 1),
    onPhoto: photo,
    canNextGen: () => !!(G.player && G.player.flags.genDone)
  });
  Stickers.init(UI.onSticker);
  Journal.init(G);
  Voice.init(); Grownups.guardOutboundLinks(); Voice.setEnabled(settings.voice);
  Reading.init(G, { saveSettings });
  /* the director: shared with smoke.js; it only ever talks to the page through these hooks */
  const openChoice = () => { const open = () => { if (Reading.busy() || Cinematic.active) setTimeout(open, 800); else UI.choice(); }; setTimeout(open, 2500); UI.refreshToggles(); };
  Story.init(G, { hint: (k) => UI.hint(k), fact: (k) => Bus.emit('fact', k), cine: (o) => Cinematic.play(o), done: openChoice, lifeDone: (f, s) => Stickers.lifeDone(f, s) });

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Jelly(G, G.form, G.sex); G.players = [b]; b.restore(po); });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Story.reset(); Stickers.setGeneration(G.generation); UI.buildWheel(); Story.afterRestore(); }
      G.cam.x = G.player.x; G.cam.y = G.player.y;
    }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('started', G.player); }
    else { Voice.say('Welcome back!', { force: true }); UI.hint(resumeHint()); }
  }
  function resumeHint() {
    const p = G.player;
    if (p.stage === 'egg') return 'egg';
    if (p.stage === 'planula') return 'swimfree';
    if (p.stage === 'polyp') return p.mode === 'polyp' ? (p.canBud() ? 'bud' : 'polyp') : p.mode === 'pop' ? 'pop' : 'stack';
    if (p.stage === 'ephyra') return 'eatplankton';
    if (p.mode === 'brood') return 'brood';
    if (p.flags.broodDone && !p.flags.released) return 'ready';
    if (p.flags.mating && !p.flags.met) return p.sex === 'boy' ? 'findgirl' : 'findcloud';
    if (p.flags.grown && !p.flags.bloomFound) return 'bloom';
    if (p.flags.genDone) return 'done';
    return p.stuck ? 'stuck' : 'medusa';
  }

  /* ---------- debug jumps (?stage=…) ---------- */
  const D = () => G.diff();
  function toPlanula(x, y) { const p = G.player; p.hatch(); p.x = x; p.y = y; G.world.mum = null; G.world.larvaCloud.length = 0; Cinematic.stop(); }
  function toPolyp(pinst, frac = .4, site) {
    const Wd = G.world, p = G.player;
    site = site || Wd.nearestFreeSite(WORLD.homeX, 200);
    toPlanula(site.x, site.y + 10); p.settle(site);
    const th = [0, ...D().polyp];
    p.pinst = pinst; p.pfood = th[pinst - 1] + (th[pinst] - th[pinst - 1]) * frac;
    Wd.setSeason('autumn'); G.tod = .45; Cinematic.stop();
  }
  function toEphyra(einst, frac = .4) {
    const p = G.player; toPolyp(3, 1); p.buds = D().buds; p.flags.budsDone = true;
    p.becomeEphyra(); p.einst = einst; const th = [0, ...D().ephyra]; p.efood = th[einst - 1] + (th[einst] - th[einst - 1]) * frac;
    p.x = 1200; p.y = 140; G.world.setSeason('spring'); G.tod = .4; Cinematic.stop();
  }
  function toMedusa(minst, frac = .4, x = 900, y = 140) {
    const p = G.player; toEphyra(3, 1); p.becomeMedusa(); p.minst = minst;
    p.mfood = minst === 1 ? D().medusa[0] * frac : D().medusa[0] + (D().medusa[1] - D().medusa[0]) * frac;
    p.x = x; p.y = y; G.world.setSeason(minst === 2 ? 'summer' : 'spring'); G.tod = .45; Cinematic.stop();
  }
  function toBloom(sex, mating) {
    const p = G.player, Wd = G.world; toMedusa(2, 1, WORLD.bloomX + 100, 150);
    p.sex = sex; G.sex = sex; p.flags.grown = true; Wd.makeBloom(p);
    if (mating) { p.flags.bloomFound = true; Story.startMating(); }
    G.tod = mating ? .88 : .45;
  }
  function applyDebug() {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { applyDebugInner(); } finally { settings.readMode = rm; }
  }
  function applyDebugInner() {
    const st = params.get('stage'), Wd = G.world;
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 40; if (s === 'storm') { wx.storm = 1; wx.cloud = 1; } }
    if (!st) return;
    const p = G.player, sex = params.get('sex') === 'girl' ? 'girl' : 'boy';
    if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; Wd.mum.shake = 1; }
    else if (st === 'planula') toPlanula(WORLD.mumX - 120, 110);
    else if (st === 'search') { const L = Wd.ground.ledges[2]; toPlanula(L.x + 70, L.g - 18); }
    else if (st === 'polyp' || st === 'settle') toPolyp(1, .3);
    else if (st === 'catch') { toPolyp(2, .5); p.caught.push({ kind: 'diatom', a: 0 }, { kind: 'copepod', a: 1 }); }
    else if (st === 'bud') { toPolyp(3, 1.05); p.pfood = D().polyp[2]; const s = Wd.budSite(p.site); if (s) { s.bud = true; s.form = p.form; } }
    else if (st === 'slug') { toPolyp(2, .5); Wd.startSlug(p); Wd.slug.x = p.site.x - Wd.slug.dir * 30; }
    else if (st === 'strobila') { toPolyp(3, 1); p.buds = D().buds; p.flags.budsDone = true; p.startStrobila(); p.strobT = +(params.get('frac') || .6) * STROB_T; Wd.setSeason('winter'); G.tod = .5; }
    else if (st === 'pop') { toPolyp(3, 1); p.buds = D().buds; p.flags.budsDone = true; p.startStrobila(); p.strobT = STROB_T; p.flags.stackDone = true; p.mode = 'pop'; p.rel = { good: 1, miss: 0, t: 0, flash: 0, lastWave: -1 }; Wd.setSeason('winter'); G.tod = .5; }
    else if (/^ephyra[123]?$/.test(st)) toEphyra(+(st[6] || 1), +(params.get('frac') || .4));
    else if (st === 'school') { toEphyra(2, .5); Wd.startSchool(p); Wd.school.x = p.x - Wd.school.dir * 180; Wd.school.y = p.y; }
    else if (st === 'comb') { toEphyra(2, .5); const j = Wd.makeComb(p.x + 34, p.y - 4); j.r = 16; Wd.jellies.push(j); }
    else if (st === 'tern') { toEphyra(1, .5); p.y = 16; G.tod = .45; Wd.dip(p, 'tern'); }
    else if (st === 'medusa') toMedusa(1, .3);
    else if (st === 'stuck') { toMedusa(1, .5); p.stuck = 7; p.stuckVal = 10; }
    else if (st === 'turtle' || st === 'sunfish') { toMedusa(1, .6, st === 'sunfish' ? -1200 : 600); Wd.startVisitor(st, p); Wd.visitors[0].x = p.x - Wd.visitors[0].dir * 170; Wd.visitors[0].y = p.y + 10; }
    else if (st === 'gull') { toMedusa(1, .6); p.y = 14; G.tod = .45; Wd.dip(p, 'gull'); }
    else if (st === 'adult') toMedusa(2, .3, 1000, 120);
    else if (st === 'current') { toMedusa(2, 1, 600, 125); p.flags.grown = true; Wd.makeBloom(p); }
    else if (st === 'bloom') toBloom(sex, false);
    else if (st === 'mating') toBloom(sex, true);
    else if (st === 'brood') { toBloom('girl', true); p.flags.met = true; p.startBrood(); p.broodT = +(params.get('bt') || 8); }
    else if (st === 'release') { toBloom('girl', true); p.flags.met = p.flags.broodStarted = p.flags.broodDone = true; p.eggs = 1; G.tod = .92; p.startRelease(); }
    else if (st === 'larvae') { toBloom('boy', true); const g = Wd.mates().find(j => j.role === 'girl'); if (g) g.met = true; p.flags.met = true; Story.later(.2, Story.boyEnding); }
    if (params.has('food')) { if (p.stage === 'ephyra') p.efood = +params.get('food'); else if (p.stage === 'medusa') p.mfood = +params.get('food'); else p.pfood = +params.get('food'); }
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
    if (settings.clock && p.mode !== 'release' && p.mode !== 'pop') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * (p.jelly ? 1.5 : 1)) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    Story.update(dt);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    /* on a tall phone the jelly sits a little higher, between the hint and the fact card */
    const lift = H > W ? H * .08 / cam.zoom : 0;
    if (cine) cam.follow(cine.x, cine.y, cine.zoom * uz);
    else if (p.stage === 'egg') { const m = G.world.mum; cam.follow(m ? m.x : p.x, m ? m.y + m.r * .6 : p.y, 4 * uz); }
    else if (p.stage === 'planula') cam.follow(p.x, p.y + lift, 7 * uz);
    else if (p.stage === 'polyp') cam.follow(p.site.x + (p.tipX - p.site.x) * .5, p.site.y + 18 + lift, (p.mode === 'polyp' ? 6 : 6.5) * uz);
    else if (p.stage === 'ephyra') cam.follow(p.x, p.y + lift, (7.4 - p.einst * .5) * uz);
    else if (p.flags.mating && !p.flags.met) cam.follow(p.x, p.y + lift, clamp(110 / (p.r + 16), 1.1, 3) * uz);
    else cam.follow(p.x + p.vx * .4, p.y + lift, clamp(180 / (p.r + 16), 1.3, 6) * uz);
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
      /* time-lapse (F), and a fast-forward while the jelly just waits: on Mum's arm, the stack growing, the babies growing */
      const waiting = (p.stage === 'egg' && !p.flags.eggReady) || p.mode === 'strobila' || p.mode === 'brood';
      G.warp = p.mode === 'pop' || p.mode === 'release' ? 1 : waiting ? 4 : G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, (x) => G.world.ground.topAt(x));
    camera(rawDt);
    Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} p${p.pinst} e${p.einst} m${p.minst} food=${(p.stage === 'polyp' ? p.pfood : p.stage === 'ephyra' ? p.efood : p.mfood).toFixed(0)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} fps=${Render.getFps().toFixed(0)}${typeof GFX !== 'undefined' && GFX.active() ? ` gl=${GFX.stats().ms.toFixed(1)}ms` : ''}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, lvl = Wd.seaLevel();
    AudioFX.update(dt, { night: G.night, surface: clamp(1 - (G.cam.y - lvl) / 260, 0, 1), inside: false, storm: Wd.weather.storm, wind: Wd.weather.gust, swash: Wd.swash(), boat: 0, deep: clamp((G.cam.y - 300) / 300, 0, 1) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: moon jellies drifting up through a summer sea ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const tJellies = Array.from({ length: 14 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: .35 + Math.random() * .65, ph: Math.random() * TAU, form: FORM_KEYS[i % 4], sp: .006 + Math.random() * .01, drift: (Math.random() - .5) * .006 }));
  tJellies.sort((a, b) => a.z - b.z);
  const tSpecks = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5ab8e0'); g.addColorStop(.12, '#2a86c0'); g.addColorStop(.6, '#0e4a80'); g.addColorStop(1, '#06203a');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    tctx.fillStyle = 'rgba(255,255,255,.35)'; tctx.beginPath(); tctx.moveTo(0, 0); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, H * .05 + Math.sin(x * .02 + tt * 1.5) * 4); tctx.lineTo(W, 0); tctx.fill();
    tctx.save(); tctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) { const bx = (k / 9 + Math.sin(tt * .1 + k) * .02) * W; const lg = tctx.createLinearGradient(0, 0, 0, H * .85); lg.addColorStop(0, 'rgba(200,240,255,.14)'); lg.addColorStop(1, 'rgba(200,240,255,0)'); tctx.fillStyle = lg; tctx.beginPath(); tctx.moveTo(bx, 0); tctx.lineTo(bx + 40, 0); tctx.lineTo(bx + 200, H * .85); tctx.lineTo(bx + 110, H * .85); tctx.closePath(); tctx.fill(); }
    tctx.restore();
    for (const s of tSpecks) { s.y -= dt * .004; if (s.y < 0) s.y = 1; tctx.fillStyle = `rgba(220,245,255,${.25 + .25 * Math.sin(tt * 2 + s.ph)})`; tctx.beginPath(); tctx.arc((s.x + Math.sin(tt * .2 + s.ph) * .01) * W, s.y * H, 1.3, 0, TAU); tctx.fill(); }
    /* the rocks and the dock far below */
    tctx.fillStyle = '#16304a'; tctx.beginPath(); tctx.moveTo(0, H); tctx.lineTo(0, H * .86); tctx.quadraticCurveTo(W * .3, H * .8, W * .55, H * .88); tctx.quadraticCurveTo(W * .8, H * .84, W, H * .9); tctx.lineTo(W, H); tctx.fill();
    for (const j of tJellies) {
      j.ph += dt * (1.1 + j.z * .4); j.y -= j.sp * dt * (.5 + .5 * Math.max(0, Math.sin(j.ph))); j.x += j.drift * dt;
      if (j.y < -.15) { j.y = 1.15; j.x = Math.random(); }
      if (j.x < -.1) j.x = 1.1; if (j.x > 1.1) j.x = -.1;
      const u = (j.ph / TAU) % 1, pulse = u < .28 ? smoothstep(0, .28, u) : 1 - smoothstep(.28, 1, u);
      const r = Math.min(W, H) * .07 * j.z;
      tctx.save(); tctx.translate(j.x * W, j.y * H); tctx.rotate(Math.sin(j.ph * .3) * .15); tctx.globalAlpha = .45 + j.z * .55;
      Sprites.drawJelly(tctx, { r, form: j.form, pulse, t: tt + j.ph, simple: r < 14 });
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
  /* ?sim=<seconds>: run the game that long before the first frame (headless Chrome draws only a few frames) */
  if (params.has('sim')) { const n = Math.min(3600, +params.get('sim') * 30); for (let k = 0; k < n; k++) simulate(1 / 30); camera(0); G.cam.snap(); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'planula' }); UI.openJournal(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'jelly', 'go', 'up', 'little', 'big', 'swim', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.pulse = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
