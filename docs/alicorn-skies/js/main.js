/* ============================================================
   main.js — the game loop, input and glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings ---------- */
  const DEFAULTS = {
    difficulty: 'normal', reading: 'simple', voice: true, sound: true, music: true, labels: false, arrow: true, storms: true,
    slowmo: false, pad: matchMedia('(pointer: coarse)').matches, clock: true, p2: false, gpP2: false, quality: 'auto',
    season: 'auto', glow: true, follow: true, rim: true,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto'
  };
  let settings;
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('alicorn.settings') || '{}')); } catch (e) { settings = Object.assign({}, DEFAULTS); }
  if (!DIFFICULTY[settings.difficulty]) settings.difficulty = 'normal';
  const saveSettings = () => { try { localStorage.setItem('alicorn.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };
  const loadLook = () => { try { const l = JSON.parse(localStorage.getItem('alicorn.look') || 'null'); if (l && l.body) return Object.assign({}, DEFAULT_LOOK, l); } catch (e) { /* fine */ } return JSON.parse(JSON.stringify(DEFAULT_LOOK)); };
  const saveLook = (l) => { try { localStorage.setItem('alicorn.look', JSON.stringify(l)); } catch (e) { /* fine */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, world: null, cam: new Camera(), players: [], friends: null, butterflies: null, birds: null, storms: null, fish: null,
    particles: new Particles(), time: 0, tod: .36, day: 1, stars: 0, started: false, userZoom: 1, night: 0, alt: 0, partyT: 0,
    foal: null, home: null, apples: 0,
    get player() { return this.players[0]; }
  };
  window.G = G;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1;
  let saveClock = 8;
  const START_X = 260;

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.world = new World(G, seed);
    G.particles = new Particles();
    G.friends = new Friends(G);
    G.butterflies = new Butterflies(G);
    G.birds = new Birds(G);
    G.storms = new StormClouds(G);
    G.fish = new Fish(G);
    G.foal = new Foal(G);
    G.home = new Home();
    applySeason(true);
    applyDifficulty();
  }
  /* the season: turning by itself every few days, or chosen in settings */
  let lastSeason = null;
  function applySeason(instant) {
    if (!G.world) return;
    const key = settings.season && settings.season !== 'auto' ? settings.season : SEASONS[Math.floor((G.day - 1) / SEASON_DAYS) % 4];
    if (key !== G.world.season || instant) { G.world.setSeason(key, instant); }
    if (key !== lastSeason) { const was = lastSeason; lastSeason = key; if (was && !instant) Bus.emit('season', key); }
  }
  function newPlayer(look, id) {
    const p = new Alicorn(G, look, id);
    p.placeAt(START_X + (id - 1) * 90);
    return p;
  }
  function p2Look() {
    const l = JSON.parse(JSON.stringify(DEFAULT_LOOK));
    const p1 = G.players[0] ? G.players[0].look : DEFAULT_LOOK;
    l.name = pick(NAMES.filter(n => n !== p1.name)); l.body = pick(BODY_COLORS.filter(b => b.key !== p1.body)).key;
    l.mane = [pick(MANE_COLORS.filter(m => !m.locked)).key]; l.mark = pick(MARKS).key; l.eyes = pick(EYE_COLORS).key; l.horn = pick(HORNS.filter(h => !h.locked)).key;
    return l;
  }
  function ensurePlayers() {
    if (settings.p2 && G.players.length < 2) { const q = newPlayer(p2Look(), 2); q.placeAt(G.player.x + 90, undefined); G.players[1] = q; Bus.emit('twoplayer'); }
    else if (!settings.p2 && G.players.length > 1) G.players.length = 1;
  }
  function applyDifficulty() {
    const d = DIFFICULTY[settings.difficulty];
    if (G.storms) { G.storms.enabled = settings.storms && d.storms; if (!G.storms.enabled) G.world.stormClouds.length = 0; }
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
  const pad = { x: 0, y: 0, fly: false };
  const isTyping = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    if (e.repeat && keys[K]) { if (k === ' ' || k.startsWith('Arrow')) e.preventDefault(); return; }
    keys[K] = true;
    if (Creator.isOpen()) { if (k === 'Enter') document.getElementById('creatorDone').click(); return; }
    if (G.started && Reading.keydown(e)) { keys[K] = false; return; }
    if (!G.started) { if (k === ' ' || k === 'Enter') { start(!!SaveGame.exists()); e.preventDefault(); } return; }
    const p1 = G.players[0], p2 = G.players[1];
    if (k === ' ' || k === 'Enter') { p1.input.flyPressed = true; e.preventDefault(); }
    if (K === 'e') p1.input.magicPressed = true;
    if (k === 'Shift') p1.input.dashPressed = true;
    if (p2) { if (K === 'u') p2.input.flyPressed = true; if (K === 'o') p2.input.magicPressed = true; if (K === 'h') p2.input.dashPressed = true; }
    if (K === 'm') { if (document.getElementById('mapModal').hidden) UI.openMap(); else UI.closeMap(); }
    if (K === 'c') { if (Wardrobe.isOpen()) Wardrobe.close(); else Wardrobe.open(G); }
    if (K === 'f' && G.foal && G.foal.adopted) { if (Care.isOpen()) Care.close(); else Care.open(G); }
    if (K === 'n') toggle('sound');
    if (K === 'v') toggle('voice');
    if (K === 'p') photo();
    if (K === 'b') UI.openStickers();
    if (!p2 && K === 'j') UI.openJournal();
    if (!p2 && K === 'l') toggle('labels');
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') UI.closeModals();
    if (k.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; pad.x = pad.y = 0; pad.fly = false; });

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
    x += pad.x; y += pad.y;
    const g1 = padFor(1);
    if (g1) {
      x += g1.x; y += g1.y;
      if (g1.flyPressed) p1.input.flyPressed = true; if (g1.magicPressed) p1.input.magicPressed = true; if (g1.dashPressed) p1.input.dashPressed = true;
      if (g1.photoPressed) photo(); if (g1.mapPressed) { if (document.getElementById('mapModal').hidden) UI.openMap(); else UI.closeMap(); }
    }
    p1.input.x = clamp(x, -1, 1); p1.input.y = clamp(y, -1, 1);
    p1.input.fly = !!(keys[' '] || keys.Enter || pad.fly || (g1 && g1.fly));
    if (Race.locked()) for (const p of G.players) { p.input.x = p.input.y = 0; p.input.fly = false; p.input.flyPressed = false; }
    const p2 = G.players[1];
    if (p2) {
      let x2 = 0, y2 = 0;
      if (keys.j) x2 -= 1; if (keys.l) x2 += 1; if (keys.i) y2 -= 1; if (keys.k) y2 += 1;
      const g2 = padFor(2);
      if (g2) { x2 += g2.x; y2 += g2.y; if (g2.flyPressed) p2.input.flyPressed = true; if (g2.magicPressed) p2.input.magicPressed = true; if (g2.dashPressed) p2.input.dashPressed = true; }
      p2.input.x = clamp(x2, -1, 1); p2.input.y = clamp(y2, -1, 1);
      p2.input.fly = !!(keys.u || (g2 && g2.fly));
    }
    /* Read to Play: the action buttons open a word card first */
    Reading.intercept(p1);
  }

  /* touch pad */
  document.querySelectorAll('#pad .dpad button').forEach(b => {
    const dir = b.dataset.dir;
    const set = (on) => {
      b.classList.toggle('down', on);
      if (dir === 'left') pad.x = on ? -1 : (pad.x < 0 ? 0 : pad.x);
      if (dir === 'right') pad.x = on ? 1 : (pad.x > 0 ? 0 : pad.x);
      if (dir === 'up') pad.y = on ? -1 : (pad.y < 0 ? 0 : pad.y);
      if (dir === 'down') pad.y = on ? 1 : (pad.y > 0 ? 0 : pad.y);
    };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
    b.addEventListener('pointerup', () => set(false));
    b.addEventListener('pointercancel', () => set(false));
    b.addEventListener('lostpointercapture', () => set(false));
  });
  const holdBtn = (id, down, up) => {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } down(); });
    const off = () => { b.classList.remove('down'); if (up) up(); };
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  };
  holdBtn('btnFly', () => { pad.fly = true; if (G.started) G.player.input.flyPressed = true; }, () => { pad.fly = false; });
  holdBtn('btnMagic', () => { if (G.started) G.player.input.magicPressed = true; });
  holdBtn('btnDash', () => { if (G.started) G.player.input.dashPressed = true; });

  /* tap the sky/ground: fly toward it is too fiddly for small hands — a tap near a friend talks, otherwise it's magic */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || !G.started) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]), held = performance.now() - downAt[2];
    downAt = null;
    if (moved > 12 || held > 600) return;
    if (Dialog.active) { Dialog.next(); return; }
    const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY);
    if (G.foal && G.foal.adopted && dist(G.foal.x, G.foal.y - 30, wx, wy) < 70 && dist(G.foal.x, G.foal.y, G.player.x, G.player.y) < 300) { Care.open(G); return; }
    const f = G.friends.nearest(wx, wy, 70);
    if (f && dist(f.x, f.y, G.player.x, G.player.y) < 260 && G.player.state === 'ground') { G.player.talk(f); return; }
    G.player.input.magicPressed = true;
  });
  canvas.addEventListener('wheel', (e) => { G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .9 : 1.1), .45, 2); e.preventDefault(); }, { passive: false });

  /* ---------- toggles ---------- */
  function toggle(key) {
    switch (key) {
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'music': settings.music = !settings.music; AudioFX.setMusic(settings.music); break;
      case 'voice': settings.voice = !settings.voice; Voice.setEnabled(settings.voice); if (settings.voice) Voice.say('Reading aloud is on.', { force: true }); break;
      case 'storms': settings.storms = !settings.storms; applyDifficulty(); break;
      case 'follow': settings.follow = !settings.follow; Voice.follow = settings.follow; break;
      case 'p2': settings.p2 = !settings.p2; if (G.started) { ensurePlayers(); UI.hint(settings.p2 ? 'p2' : 'Player 2 went home. Bye bye!'); } break;
      default: settings[key] = !settings[key];
    }
    saveSettings(); UI.refreshToggles(); AudioFX.click();
  }

  function photo() {
    if (!G.started) return;
    document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 300);
    AudioFX.shutter();
    Bus.emit('photo');
    PhotoStudio.open(G, Render.snapshot());
  }

  /* magic-map travel: whoosh across the land */
  function travel(hit) {
    const p = G.player, Wd = G.world;
    G.particles.starBurst(p.x, p.y - 34, 20, '#fff', 220);
    let ty = hit.y - 160;
    const s = Wd.surfaceBelow(hit.x, hit.y - 40, 60);
    if (s) ty = s.y - 140;
    p.x = clamp(hit.x, Wd.bounds.left + 60, Wd.bounds.right - 60); p.y = ty; p.state = 'air'; p.surface = null; p.vx = 0; p.vy = -60; p.fly = 1; p.open = 1;
    for (let i = 1; i < G.players.length; i++) { const q = G.players[i]; q.x = p.x - 80; q.y = ty; q.state = 'air'; q.surface = null; q.vy = -60; }
    const em = G.friends.get('ember'); if (em.state === 'following') { em.x = p.x - 70; em.y = p.y - 30; }
    if (G.foal.state === 'follow') { if (G.foal.canFly()) { G.foal.x = p.x - 90; G.foal.y = p.y; G.foal.fly = 1; } else G.foal.goHome(true); }
    AudioFX.whoosh();
    Cinematic.play({ follow: () => ({ x: p.x, y: p.y - 40 }), zoom: .95, duration: 1.6, slow: .7, title: settings.reading === 'simple' ? hit.name.replace(/^The /, 'the ').replace(/^./, c => c.toUpperCase()) + '!' : 'To ' + hit.name + '!' });
    setTimeout(() => G.particles.starBurst(p.x, p.y - 34, 24, pick(RAINBOW), 260), 50);
  }

  /* ---------- UI wiring ---------- */
  UI.init(G, {
    onStart: start,
    onDiff: (d) => { settings.difficulty = d; saveSettings(); applyDifficulty(); },
    onReading: (r) => { settings.reading = r; saveSettings(); },
    onQuality: (q) => { settings.quality = q; saveSettings(); Render.setQuality(q === 'low' ? 'low' : 'high'); },
    onToggle: toggle,
    onTod: (v) => { G.tod = v; },
    onPhoto: photo,
    onTravel: travel,
    onSeason: (s) => { settings.season = s; saveSettings(); applySeason(false); },
    onLookSaved: () => { saveLook(G.player.look); Sprites.clearIcons(); },
    onEditLook: () => Creator.open(G, G.player.look, { mode: 'edit', onDone: (l) => { saveLook(l); Sprites.clearIcons(); } }),
    onNewAdventure: () => {
      const look = G.player.look;
      UI.resetFacts(); G.day = 1; G.tod = .36;
      makeWorld((Math.random() * 1e9) | 0);
      G.players = [newPlayer(look, 1)]; ensurePlayers();
      G.apples = 0;
      Quests.reset(); G.cam.x = G.player.x; G.cam.y = G.player.y - 60;
      SaveGame.write(G); UI.hint('start'); Reading.storyStart();
    },
    onReadMode: (m) => { settings.readMode = m; saveSettings(); if (m === 'play' && G.started) Voice.say('Now you read to play!', { interrupt: true, force: true }); },
    onReadLevel: (L) => { Reading.setLevel(L); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); },
    onRestart: () => { SaveGame.clear(); try { localStorage.removeItem('alicorn.look'); } catch (e) { /* fine */ } location.reload(); }
  });
  Reading.init(G, { saveSettings });
  Creator.init(); Wardrobe.init();
  Games.init(G); Race.init(G); Care.init(G); HomeUI.init(G); Salon.init(G); Paint.init(G); Studio.init(G); Printables.init(G); PhotoStudio.init(G);
  Voice.follow = settings.follow !== false;
  Stickers.init(UI.onSticker);
  Voice.init(); Voice.setEnabled(settings.voice);
  Grownups.guardOutboundLinks();   /* "See the real thing ↗" asks a grown-up first */

  function start(resume) {
    if (G.started) return;
    AudioFX.setEnabled(settings.sound); AudioFX.setMusic(settings.music);
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s), (players) => {
        G.players = [];
        players.forEach((po, i) => { const q = new Alicorn(G, po.look || loadLook(), i + 1); q.restore(po); G.players[i] = q; });
        if (!G.players.length) G.players = [newPlayer(loadLook(), 1)];
      });
      if (ok) { applySeason(true); begin(true); return; }
    }
    /* a new adventure: make the alicorn first */
    UI.hideTitle();
    const look = loadLook();
    Creator.open(G, look, { mode: 'create', onDone: (l) => { saveLook(l); G.players = [newPlayer(l, 1)]; Journal.add('event', 'Hello, ' + l.name + '!', 'A brand new alicorn arrived at Starlight Castle.', { icon: 'alicorn' }); begin(false); } });
  }
  function begin(resume) {
    G.started = true;
    UI.hideTitle();
    ensurePlayers();
    Stickers.setLook(G.player.look);
    G.cam.x = G.player.x; G.cam.y = G.player.y - 60; G.cam.zoom = G.player.cameraZoom();
    if (resume) { Voice.say(`Welcome back, ${G.player.look.name}!`, { force: true }); UI.hint(Quests.card().text); }
    else {
      Cinematic.play({ x: G.world.castle.x + 120, y: G.world.castle.y - 200, zoom: .75, duration: 4, slow: 1, title: `Welcome, ${G.player.look.name}!` });
      setTimeout(() => UI.hint('start'), 3500);
      Reading.storyStart();
      setTimeout(() => Bus.emit('fact', 'alicorn'), 45000);
    }
  }

  /* ---------- events → hints, facts, moments ---------- */
  const once = new Set();
  const first = (k, fn) => (...a) => { if (once.has(k)) return; once.add(k); fn(...a); };
  const p1 = (fn) => (p, ...a) => { if (!p || p.id === 1) fn(p, ...a); };
  Bus.on('takeoff', p1(first('takeoff', (p) => { Cinematic.play({ follow: () => ({ x: p.x, y: p.y - 40 }), zoom: 1.2, duration: 2.6, slow: .5, title: settings.reading === 'simple' ? 'You can fly!' : 'Your first flight!' }); setTimeout(() => UI.hint('fly'), 1500); })));
  Bus.on('landed', p1((p, kind) => { if (kind === 'cloud') { first('cloudland', () => { UI.hint('clouds'); Bus.emit('fact', 'clouds'); })(); } }));
  Bus.on('skyZone', p1((p, z) => { if (z.key === 'clouds') first('cloudzone', () => { UI.hint(settings.reading === 'simple' ? '☁️ The Cloud Kingdom! You can stand on clouds.' : '☁️ Welcome to the Cloud Kingdom! You can land on the clouds.'); })(); if (z.key === 'stars') first('starzone', () => { UI.hint(settings.reading === 'simple' ? '✨ The Star Sky! Look, the Moon!' : '✨ The Star Sky! The Moon is up here — try landing on it.'); Bus.emit('fact', 'stars'); })(); }));
  Bus.on('moonLanded', p1(first('moon', (p) => { Cinematic.play({ follow: () => ({ x: p.x, y: p.y - 40 }), zoom: 1.1, duration: 3, slow: .5, title: settings.reading === 'simple' ? 'On the Moon!' : 'You landed on the Moon!' }); Bus.emit('fact', 'moon'); G.particles.confetti(p.x, p.y - 40, 50); })));
  Bus.on('waterWalk', p1(first('water', () => UI.hint('water'))));
  Bus.on('stormNear', p1(first('storm', () => { UI.hint('storm'); Bus.emit('fact', 'wind'); })));
  Bus.on('butterfly', (p) => { p.stats.butterflies++; first('butterfly', () => Bus.emit('fact', 'butterfly'))(); });
  Bus.on('flowerBloomed', first('bloom', () => setTimeout(() => Bus.emit('fact', 'bees'), 4000)));
  Bus.on('crystalLit', first('crystal', () => Bus.emit('fact', 'crystal')));
  Bus.on('constStar', (p, n) => { if (n >= 5) { Bus.emit('fact', 'constellation'); G.particles.confetti(p.x, p.y - 40, 60); } });
  Bus.on('sit', p1(first('sit', () => UI.hint(settings.reading === 'simple' ? 'Sitting down. At night, sit a while to fall asleep!' : 'Resting. Sit for a while at night and you will fall asleep under the stars.'))));
  Bus.on('sleep', p1(() => { AudioFX.sleep(); first('sleepfact', () => Bus.emit('fact', 'sleep'))(); }));
  Bus.on('wake', p1(() => AudioFX.wake()));
  Bus.on('star', p1(first('star', () => UI.hint('stars'))));
  Bus.on('zone', p1((p, z) => { UI.hint(settings.reading === 'simple' ? `Welcome to ${z.simple}!` : `Welcome to ${z.name}!`); if (z.key === 'lake') first('narwhal', () => setTimeout(() => Bus.emit('fact', 'narwhal'), 20000))(); if (z.key === 'woods' && G.night > .5) Bus.emit('fact', 'fireflies'); }));
  Bus.on('gem', (p, g) => { const left = G.world.gems.filter(x => !x.taken).length; UI.hint(left ? (settings.reading === 'simple' ? `The ${g.name} gem! ${left} to go.` : `You found the ${g.name} gem! ${left} more to find.`) : (settings.reading === 'simple' ? 'All 7 gems! Fly to the top of the Mountain!' : 'All seven gems! Now carry them to the top of Rainbow Mountain.')); });
  Bus.on('questStart', (q) => {
    if (q.key === 'flowers') setTimeout(() => UI.hint('magic'), 600);
    else if (q.phases.length) setTimeout(() => UI.hint(Quests.card().text), 600);
  });
  Bus.on('readLevel', (L, why) => { if (why === 'up') Journal.add('event', `Reading level ${L}!`, `I moved up to reading level ${L}.`, { icon: 'book' }); });
  Bus.on('questDone', (q) => {
    const p = G.player;
    G.particles.confetti(p.x, p.y - 60, 80); G.particles.starBurst(p.x, p.y - 40, 20, '#ffe14a', 260);
    if (q.key === 'fly') setTimeout(() => UI.hint('dash'), 5000);
    if (q.key === 'hello') setTimeout(() => UI.hint('talk'), 3000);
    if (q.key === 'lamb') setTimeout(() => UI.hint('map'), 6000);
  });
  Bus.on('rainbowRestored', () => {
    const Wd = G.world;
    Cinematic.play({ x: (Wd.summit.x + Wd.rainbowEnd.x) / 2, y: Wd.summit.y - 700, zoom: .45, duration: 5, slow: .8, title: settings.reading === 'simple' ? 'The rainbow is back!' : 'The rainbow is back!' });
    for (let i = 0; i < 6; i++) setTimeout(() => { G.particles.firework(Wd.summit.x + rnd(-400, 400), Wd.summit.y - rnd(300, 900), RAINBOW[i]); AudioFX.firework(); }, 600 + i * 500);
  });
  Bus.on('party', () => {
    G.partyT = 16;
    Cinematic.play({ x: G.world.castle.x, y: G.world.castle.y - 220, zoom: .7, duration: 6, slow: 1, title: settings.reading === 'simple' ? 'Party time!' : 'The big party at Starlight Castle!' });
  });
  Bus.on('questsFree', () => setTimeout(() => UI.hint('free'), 8000));
  const sim = () => settings.reading === 'simple';
  Bus.on('foalTrust', (p, f, n) => UI.hint(sim() ? `She likes you! ${3 - n} more sparkle${3 - n > 1 ? 's' : ''}!` : `She's starting to trust you! ${3 - n} more gentle sparkle${3 - n > 1 ? 's' : ''}.`));
  Bus.on('foalFound', (p, f) => { Cinematic.play({ follow: () => ({ x: f.x, y: f.y - 40 }), zoom: 1.5, duration: 3, slow: .6, title: sim() ? 'She trusts you!' : 'The baby alicorn trusts you!' }); f.G.particles.hearts(f.x, f.y - 50, 14); setTimeout(() => UI.hint(sim() ? 'Walk her home to the stable! No flying.' : 'Walk her home to the stable by the castle. She can\'t fly yet!'), 3000); });
  Bus.on('foalNaming', (f) => {
    if (!document.getElementById('creator')) return;
    setTimeout(() => { const look = f.look; look.name = f.name; Creator.open(G, look, { mode: 'foal', onDone: (l) => { f.name = l.name; f.look = l; f.goHome(false); f.state = 'follow'; f.leader = G.player; Journal.add('event', 'Welcome home, ' + f.name + '!', 'I adopted a baby alicorn called ' + f.name + '.', { icon: 'foal' }); UI.hint('foal'); Voice.say(`Welcome home, ${f.name}!`, { force: true }); SaveGame.write(G); } }); }, 800);
  });
  Bus.on('foalCare', () => Care.open(G));
  Bus.on('foalGrew', (f, st) => { Cinematic.play({ follow: () => ({ x: f.x, y: f.y - 40 }), zoom: 1.4, duration: 3.5, slow: .5, title: st >= 2 ? `${f.name} is all grown up!` : `${f.name} is growing up!` }); f.G.particles.starBurst(f.x, f.y - 40, 30, '#fff6c8', 260); AudioFX.fanfare ? AudioFX.fanfare() : AudioFX.quest(); setTimeout(() => UI.hint(st >= 2 ? (sim() ? `${f.name} can fly anywhere with you!` : `${f.name} is grown up and can fly anywhere with you!`) : (sim() ? `${f.name} can flutter now! She can follow you a bit higher.` : `${f.name} can flutter now — she'll follow you when you fly low.`)), 3000); });
  Bus.on('foalHome', (f) => UI.hint(sim() ? `${f.name} went home to the stable.` : `${f.name} is too little to follow you there, so she went home to the stable.`));
  Bus.on('dive', p1(first('dive', () => { UI.hint(sim() ? 'You are swimming! Arrows to swim. Go UP to come out.' : 'You are under the water! Swim with the arrows; go up to jump out.'); setTimeout(() => Bus.emit('fact', 'fish'), 6000); })));
  Bus.on('landed', p1((p, kind) => { if (kind === 'water' && G.world.canDive(p.x)) first('swimhint', () => setTimeout(() => UI.hint('swim'), 2500))(); }));
  Bus.on('skate', p1(first('skate', () => { UI.hint('skate'); Bus.emit('fact', 'ice'); })));
  Bus.on('apple', p1((p, n) => { first('apple', () => { UI.hint(sim() ? 'An apple! Foals love apples.' : 'An apple! Keep some for your foal.'); setTimeout(() => Bus.emit('fact', 'apples'), 5000); })(); }));
  Bus.on('shellOpened', first('pearlfact', () => setTimeout(() => Bus.emit('fact', 'pearls'), 3000)));
  Bus.on('pearl', () => { const left = G.world.shells.filter(s => s.state !== 'taken').length; if (left) UI.hint(sim() ? `A pearl! ${left} more.` : `You found a pearl! ${left} more to find.`); });
  Bus.on('talk', (f) => { if (f.key === 'marina') first('mermaidfact', () => setTimeout(() => Bus.emit('fact', 'mermaid'), 8000))(); });
  Bus.on('season', (s) => { const n = { spring: '🌸 Spring!', summer: '☀️ Summer!', autumn: '🍂 Autumn! The leaves are changing colour.', winter: '❄️ Winter! Snow is falling and the lake is freezing.' }[s]; UI.hint(n); AudioFX.season && AudioFX.season(s !== 'winter'); Bus.emit('fact', s === 'autumn' ? 'leaves' : s === 'winter' ? 'snowflakes' : 'seasons'); Journal.add('event', n, 'The season changed.', { icon: s === 'winter' ? 'snowman' : 'flower' }); });
  Bus.on('raceDone', first('racefact', () => setTimeout(() => Bus.emit('fact', 'race'), 6000)));
  Bus.on('gameStart', (k) => { if (k === 'letters') first('lettersfact', () => setTimeout(() => Bus.emit('fact', 'letters'), 15000))(); });
  Bus.on('painted', () => { saveLook(G.player.look); });
  Bus.on('lookChanged', () => saveLook(G.player.look));
  Bus.on('mapOpened', () => {});

  /* ---------- debug jumps ---------- */
  function skipToQuest(n) {
    const Wd = G.world, F = G.friends;
    for (let i = 0; i < n && i < QUESTS.length; i++) {
      const q = QUESTS[i], r = q.reward || {}, look = G.player.look;
      look.owned = look.owned || []; look.unlocked = look.unlocked || [];
      if (r.accessory && !look.owned.includes(r.accessory)) look.owned.push(r.accessory);
      if (r.mane) look.unlocked.push('mane:' + r.mane); if (r.horn) look.unlocked.push('horn:' + r.horn); if (r.wings) look.unlocked.push('wings:' + r.wings);
      Quests.state.done.push(q.key);
      if (q.key === 'lamb') F.lambHome();
      if (q.key === 'ember') F.emberFollow(G.player);
      if (q.key === 'rainbow') { for (const g of Wd.gems) g.taken = true; Wd.rainbowTarget = true; Wd.rainbowRestored = 1; }
      if (q.key === 'fallen') for (const f of Wd.fallen) f.state = 'gone';
      if (q.key === 'crystals') for (const c of Wd.crystals) if (c.quest) { c.litTarget = true; c.lit = 1; }
      if (q.key === 'moon') { for (const p of Wd.constellation.pts) p.lit = true; Wd.constellation.lit = 5; Wd.constellation.done = true; }
      if (q.key === 'party') F.gatherForParty();
      if (q.key === 'foal') { G.foal.adopt(); G.foal.goHome(false); }
      if (q.key === 'mermaid') for (const s of Wd.shells) s.state = 'taken';
    }
    Quests.state.idx = Quests.nextIdx();
    Quests.state.status = 'offered';
    if (Quests.state.idx >= QUESTS.length) Quests.state.status = 'free';
  }
  function applyDebug() {
    const p = G.player;
    if (params.has('quest')) skipToQuest(+params.get('quest'));
    if (params.has('active')) { const q = Quests.current(); if (q) { Quests.talkTo(G.friends.get(q.giver), p); while (Dialog.active) Dialog.next(); } }
    if (params.has('stars')) G.stars = +params.get('stars');
    if (params.has('wear')) { p.look.wear = params.get('wear').split(','); p.look.owned = p.look.wear.slice(); }
    if (params.has('mane')) p.look.mane = params.get('mane').split(',');
    if (params.has('body')) p.look.body = params.get('body');
    if (params.has('horn')) p.look.horn = params.get('horn');
    if (params.has('x')) { const x = +params.get('x'); if (params.has('y')) { p.x = x; p.y = +params.get('y'); const s = G.world.surfaceBelow(x, p.y, 20); if (s && Math.abs(s.y - p.y) < 20) { p.surface = s; p.state = 'ground'; } else { p.state = 'air'; p.fly = 1; p.open = 1; } } else p.placeAt(x); }
    if (params.has('air')) { p.state = 'air'; p.y -= +params.get('air') || 200; p.fly = 1; p.open = 1; p.flap = 1.2; p.vx = 200; }
    if (params.has('gallop')) { p.gallop = 1; p.walk = 2.2; p.vx = 330; }
    if (params.has('dash')) { p.dashT = 1; for (let i = 0; i < 40; i++) p.trail.push({ x: p.x - 16 * i - 30, y: p.y - 34 + Math.sin(i * .3) * 10, t: i * .02, rainbow: true }); p.trail.reverse(); }
    if (params.has('sit')) { p.sit = 1; if (params.get('sit') === 'sleep') p.sleep = true; }
    if (params.has('magic')) p.magicT = .8;
    if (params.has('weather')) { const w = params.get('weather'); const wx = G.world.weather; wx.state = w; wx.timer = 30; if (w === 'rain') { wx.rain = 1; wx.cloud = 1; } if (w === 'clearing') { wx.rainbow = 1; wx.cloud = .25; } }
    if (params.has('storm')) { G.storms.spawn(p); const s = G.world.stormClouds[G.world.stormClouds.length - 1]; s.x = p.x + 260; s.y = p.y - 180; s.vx = 0; }
    if (params.has('party')) { G.friends.gatherForParty(); G.partyT = 30; }
    if (params.has('talk')) { const f = G.friends.get(params.get('talk')); if (f) { p.placeAt(f.x - 90); p.dir = 1; Quests.talkTo(f, p); } }
    /* Read to Play screens */
    if (params.has('readcard')) Reading._open(params.get('readcard') || 'fly');
    if (params.has('readpage')) Reading.showPage(params.get('readpage') || 'start', { gate: params.has('gate') });
    if (params.has('readtask')) { Reading.showPage(params.get('readtask') || 'hello', { gate: true }); Reading._next(); if (params.has('task2')) Reading._next(); }
    if (params.has('mission')) { Reading._missionNow(); Reading.update(.1); }
    if (params.has('mywords')) { for (const w of ['i', 'can', 'fly', 'see', 'the', 'castle', 'magic', 'up', 'go', 'my', 'foal']) for (let i = 0; i < 4; i++) Reading.markText(w, 'right'); for (const w of ['look', 'here', 'come']) for (let i = 0; i < 3; i++) Reading.markText(w, 'help'); Reading.markText('said', 'wrong'); Reading.openWords(); }
    if (params.has('foal')) { const st = +params.get('foal'); G.foal.adopt(); G.foal.stage = st; G.foal.babyK = st === 0 ? 1 : st === 1 ? .5 : 0; G.foal.care = FOAL_GROW[st]; G.foal.x = p.x - 110; G.foal.y = G.world.standY(G.foal.x); G.foal.state = params.get('foalhome') ? 'home' : 'follow'; G.foal.leader = p; if (params.get('foalhome')) G.foal.goHome(false); if (params.has('foalneed')) G.foal.full = .1; }
    if (params.has('apples')) G.apples = +params.get('apples');
    if (params.has('swim')) { p.x = +params.get('swim') || 3500; p.y = +(params.get('depth') || 300); p.state = 'swim'; p.surface = null; p.dir = 1; p.walk = 1; G.world.bounds.bottom = 880; }
    if (params.has('shells')) G.world.showShells(true);
    if (params.has('letters')) { Quests.state.done.push('hello', 'fallen'); Games.talk(G.friends.get('hoot'), p); while (Dialog.active) Dialog.next(); }
    if (params.has('race')) { Quests.state.done.push('race'); Race.start(); if (params.get('race') === 'go') { for (let i = 0; i < 240; i++) Race.update(1 / 60); } }
    if (params.has('p2') && G.players[1]) { const q = G.players[1]; q.x = p.x - 110; q.y = p.y; q.state = p.state; q.surface = p.surface; q.fly = p.fly; q.open = p.open; }
  }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0;
  function step(rawDt) {
    Cinematic.update(rawDt);
    const dt = rawDt * Cinematic.timeScale;
    const players = G.players;
    const modal = UI.anyModalOpen();
    if (G.started && !modal) readInput();
    else for (const p of players) { p.input.x = p.input.y = 0; p.input.fly = false; }
    if (G.started) { if (Reading.busy()) Reading.gamepad(Gamepads.poll()); Reading.update(rawDt); }

    if (settings.clock && !modal && G.started) {
      const sleeping = players.every(p => p.sleep);
      const prev = G.tod;
      G.tod = (G.tod + dt / DAY_LENGTH * (sleeping ? 12 : 1)) % 1;
      if (G.tod < prev) { G.day++; applySeason(false); }
      if (sleeping && G.tod > .3 && G.tod < .32) { for (const p of players) { p.sleep = false; p.sit = 0; } Bus.emit('wake', players[0]); UI.hint(settings.reading === 'simple' ? 'Good morning! ☀️' : 'Good morning! The sun is up. ☀️'); }
      if (Render.nightAmount(G.tod) > .8) first('nightfact', () => { UI.hint('night'); })();
      if (Math.abs(G.tod - .78) < .01) first('sunset', () => Bus.emit('fact', 'sunset'))();
      document.getElementById('sTod').value = Math.round(G.tod * 100);
    }
    G.time += dt;
    G.world.update(dt, G.tod);
    if (G.started && !modal && !params.has('pause')) {
      for (const p of players) p.update(dt);
      G.foal.update(dt, players);
      Race.update(rawDt);
      Games.update(dt);
      Quests.update(dt, players);
      G.friends.update(dt, players, G.night);
      G.butterflies.update(dt, players, G.night);
      G.birds.update(dt);
      G.storms.update(dt, players);
      G.fish.update(dt);
      Stickers.tick(G.player, dt);
      if (G.player.gallop > .95) first('gallopfact', () => setTimeout(() => Bus.emit('fact', 'gallop'), 1500))();
      if (G.stars >= 10 && ACCESSORIES.some(a => a.cost && a.cost <= G.stars && !(G.player.look.owned || []).includes(a.key))) first('wardrobe', () => UI.hint('wardrobe'))();
      if (G.partyT > 0) { G.partyT -= dt; if (chance(dt * 2.2)) { G.particles.firework(G.world.castle.x + rnd(-500, 500), G.world.castle.y - rnd(400, 800)); AudioFX.firework(); } }
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; SaveGame.write(G); }
    }
    G.particles.update(dt);
    /* autumn: leaves drift down from the trees in view */
    if (G.world.autumn > .3 && G.started && chance(dt * 3 * G.world.autumn)) {
      const v = G.cam.viewRect(0), t = pick(G.world.trees);
      if (t && t.x > v.l && t.x < v.r && t.kind !== 'pine') G.particles.spawn({ type: 'leaf', x: t.x + rnd(-60, 60) * t.s, y: t.y - rnd(120, 200) * t.s, vx: rnd(-20, 20), vy: rnd(10, 30), g: 30, drag: 1.2, rot: rnd(TAU), vr: rnd(-3, 3), col: pick(['#e8843a', '#f0b43a', '#d9533a', '#c9a03a']), ground: G.world.groundY(t.x) - 3, life: rnd(5, 8) });
    }
    /* the camera may look under the lake while someone swims */
    G.world.bounds.bottom = approach(G.world.bounds.bottom, players.some(p => p.state === 'swim') ? 880 : 190, rawDt * 900);
    const cine = Cinematic.camera();
    if (cine) G.cam.follow(cine.x, cine.y, cine.zoom * G.userZoom);
    else if (players.length > 1) {
      const a = players[0], b = players[1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 50;
      const span = Math.max(Math.abs(a.x - b.x) + 500, (Math.abs(a.y - b.y) + 400) * (W / H));
      G.cam.follow(mx, my, clamp(Math.min(W / span, a.cameraZoom()), .3, 1.3) * G.userZoom);
    } else if (G.player) {
      const p = G.player;
      const ahead = clamp(p.vx * .35, -260, 260);
      G.cam.follow(p.x + ahead, p.y - (p.state === 'air' ? 40 : 90), p.cameraZoom() * G.userZoom);
    }
    G.cam.update(rawDt, G.world.bounds, G.player && Math.abs(G.player.vx) > 400 ? 7 : 4.5);
    return dt;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = clamp((now - last) / 1000, 0, .05);
    last = now;
    if (document.hidden) return;
    const dt = step(rawDt);
    if (G.player) Render.frame(G, dt);
    if (params.has('debug')) { frames++; const p = G.player; document.title = `t=${G.time.toFixed(1)} tod=${G.tod.toFixed(2)} ${p ? p.state + ' ' + p.x.toFixed(0) + ',' + p.y.toFixed(0) : ''} cam=${G.cam.x.toFixed(0)},${G.cam.y.toFixed(0)},${G.cam.zoom.toFixed(2)} fps=${Render.getFps().toFixed(0)} f=${frames}`; }
    if (G.started) UI.update(rawDt);
    if (G.player && G.started) {
      const p = G.player;
      AudioFX.update(rawDt, { night: G.night, high: G.alt || 0, rain: G.world.weather.rain, gust: G.world.weather.gust, speed: Math.hypot(p.vx, p.vy), flying: p.state === 'air', water: smoothstep(1800, 2400, p.x) * (1 - smoothstep(4900, 5300, p.x)) * (p.y > -600 ? 1 : 0) * (G.world.frozen ? 0 : 1), woods: p.x < -2300,
        underwater: p.state === 'swim', race: Race.active(), party: G.partyT > 0, clouds: p.y < -1500 && p.y > -2900, winter: G.world.season === 'winter', home: Math.abs(p.x - G.world.stable.x) < 450 && p.y > -300, zone: G.world.zoneAt(p.x).key });
    }
    drawTitle(rawDt);
  }

  /* ---------- title backdrop: alicorns flying through a pink sky ---------- */
  const tc = document.getElementById('titleCanvas');
  const tctx = tc.getContext('2d');
  const titleFliers = [];
  for (let i = 0; i < 4; i++) {
    const l = JSON.parse(JSON.stringify(DEFAULT_LOOK));
    l.body = BODY_COLORS[(i * 3 + 1) % BODY_COLORS.length].key; l.mane = [MANE_COLORS[(i * 2) % 10].key, MANE_COLORS[(i * 2 + 3) % 10].key]; l.horn = HORNS[i % 4].key; l.mark = MARKS[i * 2].key;
    titleFliers.push({ look: l, x: Math.random(), y: .15 + i * .2, sp: rnd(.03, .06) * (i % 2 ? -1 : 1), ph: rnd(TAU), s: rnd(1.1, 1.8) });
  }
  const tstars = Array.from({ length: 120 }, () => [Math.random(), Math.random(), Math.random(), Math.random() * TAU]);
  let ttime = 0;
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    ttime += dt;
    if (tc.width !== Math.round(W * DPR) || tc.height !== Math.round(H * DPR)) { tc.width = Math.round(W * DPR); tc.height = Math.round(H * DPR); }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    for (const [x, y, r, ph] of tstars) { tctx.globalAlpha = .3 + .5 * (.5 + .5 * Math.sin(ttime * 2 + ph * 6)); tctx.fillStyle = '#fff'; starPath(tctx, x * W, y * H, 1.5 + r * 3); tctx.fill(); }
    tctx.globalAlpha = .55; tctx.lineWidth = 22;
    RAINBOW.forEach((c, i) => { tctx.strokeStyle = c; tctx.beginPath(); tctx.arc(W / 2, H * 1.15, Math.max(W, H) * .75 - i * 22, Math.PI, 0); tctx.stroke(); });
    tctx.globalAlpha = 1;
    /* soft clouds along the bottom */
    tctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 12; i++) { const x = ((i / 12) * W * 1.2 + ttime * 12) % (W * 1.2) - W * .1; tctx.beginPath(); tctx.arc(x, H * .96 + Math.sin(i) * 20, 70 + (i % 3) * 30, 0, TAU); tctx.fill(); }
    for (const f of titleFliers) {
      f.x += f.sp * dt; if (f.x > 1.2) f.x = -.2; if (f.x < -.2) f.x = 1.2;
      const y = f.y * H + Math.sin(ttime * 1.2 + f.ph) * 30;
      tctx.save(); tctx.translate(f.x * W, y); if (f.sp < 0) tctx.scale(-1, 1); tctx.rotate(Math.cos(ttime * 1.2 + f.ph) * .12);
      /* rainbow trail */
      tctx.lineWidth = 3; tctx.lineCap = 'round';
      RAINBOW.forEach((c, i) => { tctx.strokeStyle = withAlpha(c, .55); tctx.beginPath(); tctx.moveTo(-40 * f.s, (-34 + i * 3) * f.s); tctx.quadraticCurveTo(-160 * f.s, (-34 + i * 3 + Math.sin(ttime * 2 + f.ph) * 20) * f.s, -300 * f.s, (-30 + i * 3) * f.s); tctx.stroke(); });
      Sprites.drawAlicorn(tctx, { s: f.s, look: f.look, fly: 1, flap: ttime * 9 + f.ph, time: ttime + f.ph, stream: 1 });
      tctx.restore();
    }
  }

  /* ---------- save on leave, install offline ---------- */
  addEventListener('visibilitychange', () => { if (document.hidden) SaveGame.write(G); });
  addEventListener('beforeunload', () => SaveGame.write(G));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });

  /* ---------- go ---------- */
  Render.init(canvas);
  resize();
  Render.setQuality(settings.quality === 'low' ? 'low' : 'high');
  makeWorld(seed);
  Journal.init(G);
  Quests.init(G);
  if (params.has('tod')) G.tod = +params.get('tod');
  if (params.has('labels')) settings.labels = true;
  if (params.has('pad')) settings.pad = true;
  if (params.has('p2')) settings.p2 = true;
  if (params.has('read')) settings.reading = params.get('read');
  if (params.has('readmode')) settings.readMode = params.get('readmode');
  if (params.has('readlevel')) settings.readLevel = params.get('readlevel').toUpperCase();
  if (params.has('readhelp')) settings.readHelp = params.get('readhelp');
  if (params.has('quality')) settings.quality = params.get('quality');
  if (params.has('diff')) settings.difficulty = params.get('diff');
  if (params.has('season')) { settings.season = params.get('season'); applySeason(true); }
  UI.refreshToggles();
  UI.showTitle(!!SaveGame.exists());
  if (params.has('notitle')) {
    G.players = [newPlayer(loadLook(), 1)];
    if (params.has('look')) { const l = G.player.look; l.body = pick(BODY_COLORS).key; l.mane = [pick(MANE_COLORS).key, pick(MANE_COLORS).key]; l.mark = pick(MARKS).key; }
    AudioFX.setEnabled(settings.sound);
    G.started = true; UI.hideTitle(); document.getElementById('title').hidden = true; ensurePlayers(); Stickers.setLook(G.player.look);
    applyDebug();
    if (params.has('zoom')) G.userZoom = +params.get('zoom');
    step(0);
    G.cam.snap();
    if (!params.has('talk') && !params.has('quiet')) UI.hint('start');
  }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'creator') { UI.hideTitle(); Creator.open(G, G.player ? G.player.look : loadLook(), { mode: 'create', onDone: () => {} }); }
      else if (o === 'wardrobe') Wardrobe.open(G);
      else if (o === 'map') UI.openMap();
      else if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('event', 'A test page', 'This entry shows how the diary looks.', { icon: 'alicorn' }); UI.openJournal(); }
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'drawer') { document.getElementById('drawer').hidden = false; Reading.renderReport(); }
      else if (o === 'fact') Bus.emit('fact', params.get('fact') || 'rainbow');
      else if (o === 'care') Care.open(G);
      else if (o === 'home') HomeUI.open(G);
      else if (o === 'salon') Salon.open(G);
      else if (o === 'paint') Paint.open(G, G.player.look);
      else if (o === 'studio') Studio.open(G);
      else if (o === 'print') Printables.open(G, params.get('kind') || 'certificate');
      else if (o === 'photo') { step(0); Render.frame(G, 0); PhotoStudio.open(G, Render.snapshot()); }
      else if (o === 'foalname') { G.foal.adopt(); Bus.emit('foalNaming', G.foal); }
    }, 50);
  }
  if (params.has('autostart')) setTimeout(() => { document.getElementById('btnStart').click(); setTimeout(() => document.getElementById('creatorDone').click(), 200); }, 100);
  if (params.has('warp')) { const n = +params.get('warp'); for (let i = 0; i < n; i++) step(1 / 60); G.cam.snap(); }
  window.__step = step;
  requestAnimationFrame(loop);
})();
