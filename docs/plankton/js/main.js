/* ============================================================
   main.js — the game loop, input, the camera, glue
   ============================================================
   The story itself (what happens when) is js/story.js, shared with
   smoke.js; this file only feeds it input and draws.
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    form: 'red', sex: 'boy', difficulty: 'normal', visitors: true, sound: true, slowmo: false, labels: false,
    pad: matchMedia('(pointer: coarse)').matches, clock: true, reading: 'simple', voice: true,
    quality: 'auto', science: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  const ENUMS = { form: FORM_KEYS, sex: Object.keys(SEXES), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('plankton.settings') || '{}');
    if (raw && typeof raw === 'object') for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('plankton.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], particles: new Particles(),
    time: 0, tod: .86, day: 1, generation: 1, moon: .5, year: 0, started: false, userZoom: 1, night: 0, fast: false, warp: 1,
    form: settings.form, sex: settings.sex,
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; },
    get player() { return this.players[0]; }
  };
  window.G = G;
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
    G.year = 0;
    G.players = [new Copepod(G, G.form, G.sex)];
    Story.setup();
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    const p = G.player; p.update(0);
    G.cam.x = p.x; G.cam.y = p.y; G.cam.zoom = 8;
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
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ } set(true); });
    b.addEventListener('pointerup', () => set(false));
    b.addEventListener('pointercancel', () => set(false));
    b.addEventListener('lostpointercapture', () => set(false));
  });
  document.getElementById('btnAction').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.actionPressed = true; });
  document.getElementById('btnDash').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.started && !UI.anyModalOpen()) G.player.input.eggPressed = true; });

  /* tap the sea to swim there; while laying eggs or in the egg a tap is the button */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    const p = G.player;
    if (p.mode === 'lay' || p.stage === 'egg' || p.context()) { p.input.actionPressed = true; return; }
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
  const nextNote = () => UI.hint(settings.reading === 'simple' ? `Your next copepod will be a ${FORMS[settings.form].short.toLowerCase()} ${settings.sex}!` : `Your next generation will be a ${FORMS[settings.form].name.toLowerCase()}, a ${settings.sex}. This copepod stays as it is.`);
  /* the new-generation choice waits for any page or cinematic to finish */
  const openChoice = () => { const W0 = G.world; const tryOpen = () => { if (G.world !== W0) return; if (Reading.busy() || Cinematic.active) setTimeout(tryOpen, 800); else UI.choice(); }; setTimeout(tryOpen, 2500); UI.refreshToggles(); };
  Story.init(G, { hint: (k) => UI.hint(k), fact: (k) => Bus.emit('fact', k), cine: (o) => Cinematic.play(o), done: openChoice });
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
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (po) => { const b = new Copepod(G, G.form, G.sex); G.players = [b]; b.restore(po); });
      if (!ok) { SaveGame.clear(); G.time = 0; G.day = 1; G.generation = 1; newGame(seed); resume = false; }
      else { Stickers.setGeneration(G.generation); UI.buildWheel(); Story.afterRestore(); }
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
    if (p.mode === 'sleep') return 'sleep';
    if (p.tight) return p.step === 11 ? 'wake' : 'tight';
    if (p.step <= 2) return 'yolk';
    if (p.step <= 6) return 'eat';
    if (p.step === 11) return p.oil >= 1 ? 'oilfull' : 'oil';
    if (p.step === 12) return p.sex === 'boy' ? (p.flags.met ? 'met' : 'trail') : !p.flags.met ? 'wait' : p.flags.eggsReady ? 'ready' : 'eggfood';
    return G.night > .5 ? 'night' : 'day';
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
  function camera(rawDt) {
    const p = G.player, cine = Cinematic.camera(), cam = G.cam, uz = G.userZoom;
    /* on an upright screen the copepod sits a little higher, between the hints and the fact card */
    const tall = H > W * 1.2 ? H * .08 / Math.max(1, cam.zoom) : 0;
    if (cine) cam.follow(cine.x, cine.y + tall, cine.zoom * uz);
    else if (p.stage === 'egg') cam.follow(p.x, p.y + tall, 9 * uz);
    else {
      const z = clamp(180 / (p.r * 5 + 12), 3.6, 9.5) * (p.mode === 'sleep' ? .8 : 1) * (W < 700 ? .85 : 1);
      cam.follow(p.x + p.face * p.r * 2, p.y + tall, z * uz);
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
      G.warp = Story.warp();
      for (let k = 0; k < G.warp; k++) Story.simulate(dt);
      Journal.update(dt);
      Reading.update(dt);
      if (frames % 30 === 0) Stickers.watch(p);
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the journal may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .3, G.tod, p); }
    G.particles.update(dt, () => 1e9);
    /* bubbles pop at the surface */
    { const lvl = G.world.seaLevel(); G.particles.list = G.particles.list.filter(q => q.type !== 'bubble' || q.y > lvl + 1); }
    camera(rawDt);
    /* behind the title the painted sea is shown in daylight; the game itself still starts at dusk */
    if (!G.started && typeof GFX !== 'undefined' && GFX.active()) { const tod0 = G.tod, n0 = G.night; G.tod = .45; Render.frame(G, dt); G.tod = tod0; G.night = n0; }
    else Render.frame(G, dt);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} ${p.stage}/${p.mode} s${p.step} food=${p.food.toFixed(0)} oil=${p.oil.toFixed(2)} safe=${p.safe.toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} w${G.warp} fps=${Render.getFps().toFixed(0)}${typeof GFX !== 'undefined' && GFX.active() ? ` gl=${GFX.stats().ms.toFixed(1)}ms` : ''}`;
    if (params.has('debughud')) document.getElementById('hintText').textContent = `${STEP_NAME[p.step]} ${p.mode} food ${p.food.toFixed(1)}/${p.need} oil ${p.oil.toFixed(2)} safe ${p.safe.toFixed(2)} y ${p.y.toFixed(0)} tod ${G.tod.toFixed(2)} ${G.world.season} day ${G.day}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, lvl = Wd.seaLevel();
    AudioFX.update(dt, { night: G.night, surface: clamp(1 - (G.cam.y - lvl) / 200, 0, 1), inside: false, storm: Wd.weather.storm, wind: Wd.weather.gust, swash: 0, boat: 0, deep: clamp((G.cam.y - 300) / 500, 0, 1) });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: copepods and nauplii in the green spring sea, diatoms glittering, a whale far off ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const swimmers = Array.from({ length: 14 }, (_, i) => ({ x: Math.random(), y: .25 + Math.random() * .65, s: .6 + Math.random() * .8, sp: .01 + Math.random() * .012, ph: Math.random() * TAU, dir: Math.random() < .5 ? -1 : 1, form: i === 3 ? 'blue' : i === 7 ? 'gold' : i === 10 ? 'clear' : 'red', naup: i % 4 === 1, hop: 0 }));
  swimmers.sort((a, b) => a.s - b.s);
  const tDiatoms = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, k: Math.random() < .25 ? 'chain' : 'diatom', r: Math.random() * TAU, s: .6 + Math.random() }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    /* with the painted look: the live GL sea (just rendered this frame) behind painted animals */
    const gl = typeof GFX !== 'undefined' && GFX.active() && typeof Painted !== 'undefined', A = gl ? Painted : Sprites;
    if (gl) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.drawImage(GFX.canvas(), 0, 0, tc.width, tc.height); tctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
    else {
      const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7ad0d8'); g.addColorStop(.15, '#3aa0b8'); g.addColorStop(.6, '#11568e'); g.addColorStop(1, '#04203e');
      tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
      tctx.fillStyle = 'rgba(255,255,255,.35)'; tctx.beginPath(); tctx.moveTo(0, 0); for (let x = 0; x <= W; x += 12) tctx.lineTo(x, H * .05 + Math.sin(x * .02 + tt * 1.5) * 4); tctx.lineTo(W, 0); tctx.fill();
      tctx.save(); tctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) { const bx = (k / 9 + Math.sin(tt * .1 + k) * .02) * W; const lg = tctx.createLinearGradient(0, 0, 0, H * .85); lg.addColorStop(0, 'rgba(210,250,240,.15)'); lg.addColorStop(1, 'rgba(200,240,255,0)'); tctx.fillStyle = lg; tctx.beginPath(); tctx.moveTo(bx, 0); tctx.lineTo(bx + 40, 0); tctx.lineTo(bx + 200, H * .85); tctx.lineTo(bx + 110, H * .85); tctx.closePath(); tctx.fill(); }
      tctx.restore();
    }
    /* a right whale far off in the blue */
    tctx.save(); tctx.globalAlpha = .28; tctx.translate(((tt * 14) % (W + 900)) - 450, H * .72); tctx.scale(.42 * Math.min(1.4, W / 1000), .42 * Math.min(1.4, W / 1000)); tctx.filter = 'blur(1px)'; A.drawWhale(tctx, { s: 1, t: tt, open: .6 }); tctx.restore(); tctx.filter = 'none';
    /* diatoms glittering in the light */
    for (const d of tDiatoms) { d.y -= dt * .004; if (d.y < -.02) d.y = 1.02; d.r += dt * .2; const x = (d.x + Math.sin(tt * .2 + d.ph) * .01) * W, y = d.y * H; tctx.save(); tctx.translate(x, y); tctx.scale(3.2 * d.s, 3.2 * d.s); A.drawPlankton(tctx, { x: 0, y: 0, kind: d.k, rot: d.r }, 0, 0); tctx.restore(); }
    /* copepods and nauplii swimming across, now and then a jump */
    for (const c of swimmers) {
      c.hop = Math.max(0, c.hop - dt * 2); if (Math.random() < dt * .08) c.hop = 1;
      c.x += (c.sp + c.hop * .05) * c.dir * dt; c.ph += dt * 6; if (c.x < -.12) c.x = 1.12; if (c.x > 1.12) c.x = -.12;
      const x = c.x * W, y = c.y * H + Math.sin(tt * .7 + c.ph) * 8, s = c.s * Math.min(1.7, W / 800) * 4.2;
      tctx.save(); tctx.translate(x, y); tctx.scale(c.dir, 1);
      if (c.naup) A.drawNauplius(tctx, { s: s * 1.4, form: c.form, step: 3, ph: c.ph, gut: .5 });
      else A.drawCopepod(tctx, { s, form: c.form, step: 12, sex: c.s > 1 ? 'girl' : 'boy', ph: c.ph, jump: c.hop, oil: c.form === 'gold' ? .9 : .3, gut: .6 });
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
  /* debug jumps: the story's own builders (the same ones smoke.js uses) */
  if (params.has('stage')) {
    const rm = settings.readMode; settings.readMode = 'listen';
    try { Story.jumpTo(params.get('stage'), Object.fromEntries(params)); } finally { settings.readMode = rm; }
  }
  if (params.has('weather')) { const s = params.get('weather'), wx = G.world.weather; wx.state = s; wx.timer = 40; if (s === 'storm') { wx.storm = 1; wx.cloud = 1; } }
  if (params.has('tod')) G.tod = +params.get('tod');
  if (params.has('moon')) G.moon = +params.get('moon');
  if (params.has('zoom')) G.userZoom = +params.get('zoom');
  if (params.has('season') && SEASON_INFO[params.get('season')]) G.world.setSeason(params.get('season'));
  if (params.has('safe')) G.player.safe = +params.get('safe');
  if (params.has('oil')) G.player.oil = +params.get('oil');
  if (params.has('y')) G.player.y = +params.get('y');
  { const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); if (params.has('stage')) setTimeout(() => UI.hint(resumeHint()), 50); }
  /* sim=<seconds>: run the game forward before the first frame (headless Chrome draws only a few frames) */
  if (params.has('sim')) { const n = Math.round(clamp(+params.get('sim') || 0, 0, 600) * 30); for (let k = 0; k < n; k++) Story.simulate(1 / 30); const p = G.player; G.cam.x = p.x; G.cam.y = p.y; camera(0); G.cam.snap(); }
  if (params.has('savenow')) setTimeout(() => SaveGame.write(G), 200);
  if (params.has('resume')) { document.getElementById('btnContinue').click(); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the journal.', { icon: 'nauplius' }); UI.openJournal(); }
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
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'copepod', 'go', 'up', 'little', 'big', 'swim', 'eat', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.jump = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
