/* ============================================================
   main.js — the game loop, input, the story's director, glue
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('scene');
  const params = new URLSearchParams(location.search);

  /* ---------- persistent settings (anything odd in storage is ignored) ---------- */
  const DEFAULTS = {
    sex: 'princess', look: 'rose', blueprint: 'keep', difficulty: 'normal', visitors: true, sound: true, music: true, slowmo: false, labels: false,
    clock: true, reading: 'simple', voice: true, quality: 'auto', science: false, unlockAll: false,
    readMode: 'listen', readLevel: 'B', readAuto: false, readHelp: 'auto', slot: 1
  };
  const ENUMS = { sex: ROYAL_KEYS, blueprint: Object.keys(BLUEPRINTS), difficulty: Object.keys(DIFFICULTY), reading: ['simple', 'normal'], quality: ['auto', 'high', 'low'], readMode: ['listen', 'play'], readLevel: READ_LEVELS, readHelp: ['auto', 'ask'], slot: [1, 2, 3] };
  const settings = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('castle.settings') || '{}');
    for (const k in DEFAULTS) {
      if (!(k in raw)) continue;
      if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) settings[k] = raw[k]; }
      else if (typeof raw[k] === typeof DEFAULTS[k]) settings[k] = raw[k];
    }
  } catch (e) { /* keep defaults */ }
  const saveSettings = () => { try { localStorage.setItem('castle.settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

  /* ---------- game state ---------- */
  const G = {
    settings, castle: null, world: null, cam: new Camera(), particles: new Particles(),
    time: 0, tod: .35, day: 1, moon: .5, started: false, userZoom: 1.2, night: 0, fast: false, warp: 1,
    sex: settings.sex, look: settings.look, castleName: 'My Castle', blueprint: settings.blueprint, tool: { kind: 'hand' }, cursor: null, royalRobe: '#b8302e',
    diff() { return DIFFICULTY[settings.difficulty] || DIFFICULTY.normal; }
  };
  window.G = G;
  const DAY_LENGTH = 240;
  let seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  let W = 1, H = 1, DPR = 1, saveClock = 8;
  SaveGame.slot = settings.slot;
  const CAM_BOUNDS = { left: -320, right: WORLD_W + 320, top: -520, bottom: GROUND_Y + 5 * CELL };

  function makeWorld(newSeed) {
    if (newSeed !== undefined) seed = newSeed;
    G.castle = new Castle(G);
    G.world = new World(G, G.castle, seed);
    G.particles = new Particles();
    G.royalRobe = royalLook(G.sex, G.look).robe;
    for (const k in once) delete once[k];
  }
  function newGame(newSeed) {
    G.sex = settings.sex; G.look = settings.look; G.blueprint = settings.blueprint; G.fast = false;
    makeWorld(newSeed);
    G.castle.applyBlueprint(G.blueprint);
    G.castle.coins = G.diff().coins;
    G.tod = .35; G.moon = .5; G.day = 1; G.time = 0;
    if (typeof Reading !== 'undefined' && Reading.reset) Reading.reset();
    Journal.resetGrowth();
    lookAtCastle(true);
  }
  function uiInsets() { const pal = document.getElementById('palette'), hud = document.getElementById('hud'); return { bottom: pal && !pal.hidden ? pal.offsetHeight + 24 : 24, top: hud ? hud.offsetHeight + 24 : 24 }; }
  function lookAtCastle(snap) {
    const b = G.castle.grid.bounds(), cx = b ? (b.l + b.r + 1) / 2 * CELL : WORLD_W / 2, ins = uiInsets();
    const span = b ? (b.r - b.l + 12) * CELL : 24 * CELL, tall = (b ? GROUND - G.castle.grid.tallest().h + 2 : GROUND - 8);
    const free = Math.max(200, H - ins.top - ins.bottom);
    const zoom = clamp(Math.min(W / span, free / ((GROUND - tall + 2) * CELL)), .55, 1.6);
    const groundScreenY = H - ins.bottom - 70;
    G.userZoom = zoom; G.cam.tx = cx; G.cam.ty = GROUND_Y - (groundScreenY - H / 2) / zoom; G.cam.tzoom = zoom;
    if (snap) G.cam.snap();
  }
  function resize() { W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1); Render.resize(W, H, DPR); G.cam.resize(W, H); }
  addEventListener('resize', resize);

  /* ---------- the tools ---------- */
  function setTool(t) { G.tool = t; G.cursor = null; }
  function cellAt(sx, sy) { const [wx, wy] = G.cam.toWorld(sx, sy); return [Math.floor(wx / CELL), Math.floor(wy / CELL), wx, wy]; }
  function hover(sx, sy) {
    const [cx, cy] = cellAt(sx, sy), t = G.tool, c = G.castle;
    if (t.kind === 'tile') { const tile = TILE_BY_KEY[t.key]; G.cursor = { cx, cy, ok: c.grid.canPlace(cx, cy, tile) }; }
    else if (t.kind === 'item') { const f = c.fits(t.key, cx, cy); G.cursor = { cx, cy, ok: f.ok && c.available(t.key) && c.canAfford(t.key), why: f.why }; }
    else if (t.kind === 'erase') G.cursor = { cx, cy, ok: c.grid.canErase(cx, cy) || !!c.itemAt(cx, cy) };
    else if (t.kind === 'name') { const r = c.roomAt(cx, cy); G.cursor = { cx, cy, room: r && !r.tiny ? r : null }; }
    else G.cursor = null;
  }
  const tileWord = (key) => TILE_INFO[TILE_BY_KEY[key]].word;
  function placeTileAt(cx, cy) {
    const c = G.castle, key = G.tool.key, tile = TILE_BY_KEY[key];
    if (!c.grid.canPlace(cx, cy, tile) || c.grid.get(cx, cy) === tile) return false;
    const go = () => {
      if (!c.placeTile(cx, cy, tile)) return;
      AudioFX.place(tile === T.WATER ? 'water' : tile === T.WOOD || tile === T.FLOOR || tile === T.DOOR || tile === T.DRAWBRIDGE ? 'wood' : WINDOWS.has(tile) ? 'small' : 'stone');
      G.particles.dust(cx * CELL + CELL / 2, cy * CELL + CELL / 2, tile === T.WATER ? '#6ab0f0' : tile === T.ROOF ? '#c05a40' : '#b8b2a6', 6);
      if (first('stone') && (tile === T.STONE || tile === T.TOWER)) Bus.emit('firstStone');
      if (tile === T.WATER && first('water')) Bus.emit('firstWater');
      if (tile === T.DRAWBRIDGE && first('bridgeT')) Bus.emit('firstDrawbridge');
      if (c.grid.tallest().h >= 6 && first('tower6')) Bus.emit('tower6');
    };
    if (Reading.gateBuild('tile:' + key, tileWord(key), TILE_INFO[tile].icon, go)) return true;
    go(); return true;
  }
  function placeItemAt(cx, cy) {
    const c = G.castle, key = G.tool.key, f = c.fits(key, cx, cy);
    if (!f.ok) { UI.hint(f.why || 'noFit'); AudioFX.bump(); return false; }
    if (!c.available(key)) { UI.hint('locked'); AudioFX.bump(); return false; }
    if (!c.canAfford(key)) { UI.hint('poor'); AudioFX.bump(); return false; }
    const go = () => {
      const r = c.placeItem(key, cx, cy); if (!r.ok) { UI.hint(r.why || 'noFit'); AudioFX.bump(); return; }
      AudioFX.pop(1 + Math.random() * .3); const d = ITEMS[key]; G.particles.sparkle(cx * CELL + d.w * CELL / 2, cy * CELL - d.h * CELL / 2, 10, '#fff3b0', 14);
      if (r.autoType) { UI.hint(settings.reading === 'simple' ? `Now it is a ${ROOM_TYPES[r.autoType].name.toLowerCase()}!` : `This room is now the ${ROOM_TYPES[r.autoType].name.toLowerCase()}. Its furniture page is open.`); UI.refreshPalette(); }
      if ((d.rooms.includes('outdoor') || d.rooms.includes('top')) && first('garden')) Bus.emit('firstGarden');
    };
    if (Reading.gateBuild('item:' + key, ITEMS[key].word, key, go)) return true;
    go(); return true;
  }
  function eraseAt(cx, cy) { const c = G.castle, it = c.itemAt(cx, cy, 'floor') || c.itemAt(cx, cy, 'wall') || c.itemAt(cx, cy, 'rug'); if (c.erase(cx, cy)) { AudioFX.thud(); G.particles.dust(cx * CELL + CELL / 2, cy * CELL + CELL / 2, it ? '#e8d8a0' : '#b8b2a6', 8); return true; } return false; }
  function tapAt(sx, sy) {
    const [cx, cy, wx, wy] = cellAt(sx, sy), t = G.tool, c = G.castle;
    if (t.kind === 'tile') { c.beginStroke(); placeTileAt(cx, cy); c.endStroke(); }
    else if (t.kind === 'item') placeItemAt(cx, cy);
    else if (t.kind === 'erase') { c.beginStroke(); eraseAt(cx, cy); c.endStroke(); }
    else if (t.kind === 'name') { const r = c.roomAt(cx, cy); if (r && !r.tiny) UI.openRoomPick(r); else if (r && r.tiny) UI.hint(settings.reading === 'simple' ? 'Too small! Make the room bigger.' : 'That room is too small. Make it at least two blocks wide and two tall.'); else { const poked = G.world.poke(wx, wy); if (!poked) UI.hint('nameRoom'); } }
    else { const poked = G.world.poke(wx, wy); if (poked === 'horse') { UI.hint('brushed'); if (Math.random() < .4) AudioFX.neigh(); } else if (poked === 'dragon') { AudioFX.roar(); } else if (poked === 'dog') AudioFX.bark(); else if (poked === 'person') AudioFX.pop(1.4); else if (!poked) { const r = c.roomAt(cx, cy); if (r && !r.tiny && r.type === 'empty') UI.openRoomPick(r); } }
  }

  /* ---------- input (only while the game runs; never while typing) ---------- */
  const keys = {};
  const typing = (e) => { const t = e.target; if (!t || !t.tagName) return false; if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true; return t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type); };
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (G.started && Reading.keydown(e)) return;
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    keys[K] = true;
    if (k.startsWith('Arrow')) e.preventDefault();
    if (e.repeat || e.altKey) return;
    if (!G.started) { if (k === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { start(false); e.preventDefault(); } return; }
    if ((e.ctrlKey || e.metaKey) && K === 'z') { e.preventDefault(); if (e.shiftKey) G.castle.redo(); else G.castle.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && K === 'y') { e.preventDefault(); G.castle.redo(); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (UI.anyModalOpen()) { if ((k === '?' || k === '/') && !document.getElementById('help').hidden) document.getElementById('help').hidden = true; if (k === 'Escape') UI.closeModals(); return; }
    if (K === 'z') G.castle.undo(); if (K === 'y') G.castle.redo();
    if (K === 'h') UI.setTab('hand'); if (K === '1') UI.setTab('build'); if (K === '2') UI.setTab('furnish'); if (K === '3') UI.setTab('garden'); if (K === 'n') UI.setTab('name'); if (K === 'e') UI.setTab('erase');
    if (K === 'l') toggle('labels'); if (K === 'm') toggle('sound'); if (K === 'v') toggle('voice'); if (K === 'p') photo(); if (K === 'q') UI.openQuests();
    if (K === 'b') UI.openStickers(); if (K === 'j') UI.openJournal(); if (K === 'f') toggle('fast'); if (K === 'g') toggle('science');
    if (K === '+' || K === '=') G.userZoom = clamp(G.userZoom * 1.2, .45, 3); if (K === '-' || K === '_') G.userZoom = clamp(G.userZoom / 1.2, .45, 3);
    if (K === 'o' && typeof GFX !== 'undefined' && GFX.canvas()) UI.hint(GFX.toggle() ? 'Painted look on' : 'Classic look on');
    if (k === '?' || k === '/') document.getElementById('help').hidden = !document.getElementById('help').hidden;
    if (k === 'Escape') { UI.closeModals(); if (G.tool.kind !== 'hand') UI.setTab('hand'); }
  });
  addEventListener('keyup', (e) => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = false; });
  const releaseAll = () => { for (const k in keys) keys[k] = false; };
  addEventListener('blur', releaseAll);
  document.querySelectorAll('#drawer input[type=range], #drawer select').forEach(el => el.addEventListener('change', () => el.blur()));
  function readInput(dt) {
    const pads = Gamepads.poll(); let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1; if (keys.ArrowRight || keys.d) x += 1; if (keys.ArrowUp || keys.w) y -= 1; if (keys.ArrowDown || keys.s) y += 1;
    const g1 = pads[0]; if (g1) { x += g1.x; y += g1.y; if (g1.photoPressed) photo(); if (g1.startPressed) UI.openQuests(); }
    if (x || y) { const sp = 520 / G.cam.zoom * dt; G.cam.tx += x * sp; G.cam.ty += y * sp; }
  }

  /* pointers: tap to build, drag to paint or pan, pinch to zoom */
  const ptrs = new Map(); let drag = null, pinch = null, lastCell = null, longPress = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!G.started) return;
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), button: e.button });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: G.cam.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, camx: G.cam.x, camy: G.cam.y }; drag = null; if (G.castle.stroke) G.castle.endStroke(); return; }
    const pan = G.tool.kind === 'hand' || e.button === 1 || e.button === 2 || UI.anyModalOpen();
    drag = { pan, moved: false, camx: G.cam.x, camy: G.cam.y, id: e.pointerId };
    if (!pan && (G.tool.kind === 'tile' || G.tool.kind === 'erase')) { G.castle.beginStroke(); const [cx, cy] = cellAt(e.clientX, e.clientY); lastCell = cx + ',' + cy; if (G.tool.kind === 'tile') placeTileAt(cx, cy); else eraseAt(cx, cy); drag.painted = true; }
    clearTimeout(longPress);
    longPress = setTimeout(() => { if (!drag || drag.moved) return; const [cx, cy] = cellAt(e.clientX, e.clientY); const it = G.castle.itemAt(cx, cy, 'floor') || G.castle.itemAt(cx, cy, 'wall') || G.castle.itemAt(cx, cy, 'rug'); const t = G.castle.grid.get(cx, cy); const name = it ? ITEMS[it.key].name : (t !== T.AIR && t !== T.EARTH ? TILE_INFO[t].name : null); if (name) { Voice.say(name, { interrupt: true, force: true }); UI.hint(name); } }, 650);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); G.userZoom = clamp(pinch.z0 * d / pinch.d0, .45, 3); G.cam.tzoom = G.userZoom; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; G.cam.tx = G.cam.x = pinch.camx - (mx - pinch.cx) / G.cam.zoom; G.cam.ty = G.cam.y = pinch.camy - (my - pinch.cy) / G.cam.zoom; return; }
    if (!G.started) return;
    if (drag && p && drag.id === e.pointerId) {
      const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.pan) { G.cam.tx = G.cam.x = drag.camx - dx / G.cam.zoom; G.cam.ty = G.cam.y = drag.camy - dy / G.cam.zoom; }
      else if (G.tool.kind === 'tile' || G.tool.kind === 'erase') { const [cx, cy] = cellAt(e.clientX, e.clientY); const key = cx + ',' + cy; if (key !== lastCell) { lastCell = key; if (G.tool.kind === 'tile') placeTileAt(cx, cy); else eraseAt(cx, cy); } }
    }
    if (e.pointerType === 'mouse' || !drag) hover(e.clientX, e.clientY);
  });
  const endPtr = (e) => {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); clearTimeout(longPress);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    if (!p || !drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (G.castle.stroke) G.castle.endStroke();
    if (!G.started) return;
    const held = performance.now() - p.t;
    if (!d.moved && !d.painted && held < 650 && e.type === 'pointerup') tapAt(e.clientX, e.clientY);
    if (e.pointerType !== 'mouse') G.cursor = null;
  };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { const z0 = G.cam.zoom; G.userZoom = clamp(G.userZoom * (e.deltaY > 0 ? .88 : 1.14), .45, 3); const [wx, wy] = G.cam.toWorld(e.clientX, e.clientY); const z1 = G.userZoom; G.cam.tx = wx - (wx - G.cam.x) * z0 / z1; G.cam.ty = wy - (wy - G.cam.y) * z0 / z1; e.preventDefault(); }, { passive: false });

  /* ---------- toggles ---------- */
  function toggle(key) {
    switch (key) {
      case 'sound': settings.sound = !settings.sound; AudioFX.setEnabled(settings.sound); break;
      case 'voice': settings.voice = !settings.voice; Voice.setEnabled(settings.voice); if (settings.voice) Voice.say('Reading aloud is on.', { force: true }); break;
      case 'fast': G.fast = !G.fast; if (G.fast) UI.hint(settings.reading === 'simple' ? '⏩ Fast!' : '⏩ Time-lapse. Press F again for normal speed.'); break;
      case 'unlockAll': settings.unlockAll = !settings.unlockAll; if (G.castle) G.castle.version++; UI.hint(settings.unlockAll ? 'Everything is unlocked and free.' : 'Coins and quests are back on.'); break;
      default: if (key in settings) settings[key] = !settings[key];
    }
    saveSettings(); UI.refreshToggles(); AudioFX.click();
  }
  function photo() {
    if (!G.started) return;
    Journal.photo(() => Render.snapshot(G));
    document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 300);
    AudioFX.shutter && AudioFX.shutter();
    UI.hint('photo');
  }
  G.thumbnail = () => { const src = Render.snapshot(G), c = document.createElement('canvas'); c.width = 200; c.height = Math.round(200 * src.height / src.width); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .55); };

  /* ---------- UI wiring ---------- */
  UI.init(G, {
    onStart: start,
    onSex: (s) => { settings.sex = s; saveSettings(); if (!ROYALS[s].looks.some(l => l.key === settings.look)) settings.look = ROYALS[s].looks[0].key; if (!G.started) { G.sex = s; G.look = settings.look; G.royalRobe = royalLook(G.sex, G.look).robe; } },
    onLook: (k) => { settings.look = k; saveSettings(); if (!G.started) { G.look = k; G.royalRobe = royalLook(G.sex, G.look).robe; } },
    onName: (n) => { if (!G.started) G.castleName = n || 'My Castle'; },
    onBlueprint: (b) => { settings.blueprint = b; saveSettings(); if (!G.started) { G.blueprint = b; newGame(seed); } },
    onDiff: (d) => { settings.difficulty = d; saveSettings(); if (!G.started && G.castle) G.castle.coins = G.diff().coins; },
    onReading: (r) => { settings.reading = r; saveSettings(); },
    onReadMode: (m) => { settings.readMode = m; if (m === 'play') settings.reading = 'simple'; saveSettings(); },
    onReadLevel: (L) => { if (L === 'auto') settings.readAuto = !settings.readAuto; else { settings.readLevel = L; settings.readMode = 'play'; } saveSettings(); },
    onReadHelp: (h) => { settings.readHelp = h; saveSettings(); },
    onQuality: (q) => { settings.quality = q; saveSettings(); Render.setQuality(q === 'low' ? 'low' : 'high'); },
    onToggle: toggle,
    onTod: (v) => { G.tod = v; },
    onNewGame: () => { UI.resetFacts(); SaveGame.clear(); G.started = false; newGame((Math.random() * 1e9) | 0); G.started = true; SaveGame.write(G); Reading.onStart(); Bus.emit('castleStarted'); UI.refreshToggles(); },
    onPhoto: photo,
    onTool: setTool,
    onUndo: () => G.castle.undo(), onRedo: () => G.castle.redo(),
    onRoomType: (room, type, name) => { const r = G.castle.setRoomType(room, type, name); if (r === true) { UI.refreshPalette(); if (type !== 'empty') { UI.hint('furnish'); } } return r; },
    onSlot: (slot, hasSave, inDrawer) => {
      if (inDrawer) { if (slot === SaveGame.slot) return; SaveGame.write(G); SaveGame.slot = slot; settings.slot = slot; saveSettings(); G.started = false; if (hasSave) start(true); else { UI.resetFacts(); newGame((Math.random() * 1e9) | 0); G.started = true; SaveGame.write(G); Reading.onStart(); Bus.emit('castleStarted'); } UI.closeModals(); UI.refreshToggles(); UI.hint(hasSave ? 'saved' : 'welcome'); }
      else { SaveGame.slot = slot; settings.slot = slot; saveSettings(); if (hasSave) start(true); else { newGame(seed); UI.buildSlots(document.getElementById('titleSlots'), false); } }
    }
  });
  Stickers.init(UI.onSticker);
  Journal.init(G);
  Voice.init(); Grownups.guardOutboundLinks(); Voice.setEnabled(settings.voice);
  Reading.init(G, { saveSettings });

  function start(resume) {
    if (G.started) return;
    if (resume) {
      const o = SaveGame.exists();
      const ok = o && SaveGame.read(G, o, (s) => makeWorld(s));
      if (!ok) { SaveGame.clear(); newGame(seed); resume = false; }
      else { G.world.quiet = 6; lookAtCastle(true); UI.refreshToggles(); }
    } else { if (G.castleName === 'My Castle') G.castleName = (document.getElementById('nameText').value.trim()) || G.castleName; }
    G.started = true;
    UI.hideTitle();
    AudioFX.setEnabled(settings.sound);
    Stickers.royalDone(G.sex);
    UI.setTab('hand');
    if (!resume) { if (Reading.on()) Reading.onStart(); Bus.emit('castleStarted'); SaveGame.write(G); }
    else { Voice.say('Welcome back!', { force: true }); UI.hint(resumeHint()); }
  }
  function resumeHint() { const S = G.castle.summary(G.world); if (S.rooms === 0) return 'stone'; if (S.named === 0) return 'room'; if (S.furniture < 3) return 'furnish'; if (!S.water) return 'moat'; return 'rooms'; }

  /* ---------- events → hints, facts, cinematics ---------- */
  const once = {};
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  const later = (ms, fn) => { const W0 = G.world; setTimeout(() => { if (G.world === W0) fn(); }, ms); };
  const fact = (k, ms = 0) => ms ? later(ms, () => Bus.emit('fact', k)) : Bus.emit('fact', k);
  const cine = (x, y, zoom, dur, title) => Cinematic.play({ follow: () => ({ x, y }), zoom: zoom * G.userZoom, duration: dur, slow: .7, title });
  Bus.on('castleStarted', () => { UI.hint(G.blueprint === 'plot' ? 'welcome' : 'furnish'); fact('stone', 2500); if (!Reading.on()) Voice.say(settings.reading === 'simple' ? `Welcome to ${G.castleName}!` : `Welcome to ${G.castleName}, ${ROYALS[G.sex].name}. Build it stone by stone.`, { force: true }); });
  Bus.on('firstStone', () => { UI.hint('stone'); fact('keep', 12000); });
  Bus.on('placed', (c, tile) => {
    if (tile === T.WIN_STAINED && first('stainedF')) fact('stained'); if (tile === T.WIN_SLIT && first('slitF')) fact('slit'); if (tile === T.GATE && first('gateF')) fact('portcullis');
    if (tile === T.DRAWBRIDGE && first('bridgeF')) { UI.hint('gate'); fact('drawbridge'); } if (tile === T.BATTLEMENT && first('battF')) { fact('battlement'); later(4000, () => UI.hint('battlements')); }
    if (tile === T.WATER && first('moatF')) { UI.hint('bridge'); fact('moat'); } if (tile === T.STAIR && first('stairF')) fact('stairs'); if (tile === T.CONE && first('coneF')) fact('hill');
    if (tile === T.DOOR && first('doorF')) UI.hint('stone');
  });
  Bus.on('roomMade', (c, n) => { if (n === 1) { UI.hint('room'); fact('hall', 15000); } else if (n <= 3) UI.hint('room'); });
  Bus.on('roomNamed', (c, room, type) => {
    const F = { throne: 'hall', hall: 'feast', kitchen: 'kitchen', bedroom: 'chamber', library: 'library', stables: 'stables', armoury: 'armour', forge: 'smith', bakery: 'bakery', lookout: 'hill', cellar: 'well', nursery: 'garderobe', music: 'jester', treasury: 'village', kennels: 'cat', store: 'well' };
    if (F[type]) fact(F[type], 1200);
    if (type === 'stables') later(1500, () => UI.hint('stable'));
    Bus.emit('roomNamedType', type);
  });
  Bus.on('item', (c, item) => {
    const F = { tapestry: 'tapestry', torch: 'torch', candle: 'torch', chandelier: 'torch', quintain: 'quintain', flag: 'flag', well: 'well', dovecote: 'pigeon', banner: 'banner', stall: 'horse', kennel: 'cat', fountain: 'garden', tiltrail: 'joust', fireworks: 'fireworks', armour: 'armour', harp: 'jester', oven: 'bakery', anvil: 'smith', bookshelf: 'library', longtable: 'feast', throne: 'keep', beehive: 'garden', appletree: 'garden' };
    if (F[item.key] && first('itemF_' + F[item.key])) fact(F[item.key], 800);
    if (item.key === 'stall' && first('stallHint')) UI.hint(settings.reading === 'simple' ? 'A horse is coming!' : 'A stall! A horse is on its way to it.');
    if (item.key === 'tiltrail' && first('railHint')) UI.hint(settings.reading === 'simple' ? 'The knights will joust here!' : 'A jousting rail! On tournament day two knights will ride here, if there are two horses.');
  });
  Bus.on('itemDropped', (c, it) => UI.hint(settings.reading === 'simple' ? `The ${ITEMS[it.key].word} came out.` : `The ${ITEMS[it.key].name.toLowerCase()} lost its floor and came out. The coins are back in the treasury.`));
  Bus.on('questDone', (c, q, coins) => { UI.hint('questDone'); G.particles.confetti(G.cam.x, G.cam.y - 80, 50); c.flags.celebrate = G.day; if (q.unlock) UI.refreshPalette(); later(2500, () => { const n = c.activeQuests()[0]; if (n) UI.hint(settings.reading === 'simple' ? `New quest: ${n.simple}` : `New quest: ${n.title}. ${n.text}`); }); });
  Bus.on('coins', (c, n, why) => { if (why === 'village' && G.day > 1) { if (first('coins' + G.day)) UI.hint('coins'); AudioFX.coins(); const b = c.grid.bounds(); G.particles.coins(b ? (b.r + 2) * CELL : WORLD_W / 2, GROUND_Y - 20, 8); if (first('villageF')) fact('village', 1500); } });
  Bus.on('horseCame', (h) => { UI.hint('horse'); fact('horse', 1500); AudioFX.neigh(); cine(h.home ? h.home.cx * CELL + CELL : h.x, GROUND_Y - 40, 2, 4, 'A horse!'); });
  Bus.on('horseAgain', () => { AudioFX.neigh(); UI.hint(settings.reading === 'simple' ? 'Another horse!' : 'Another horse has come to its stall.'); });
  Bus.on('arrived', (p, role) => {
    if (role === 'knight' && first('knight')) { UI.hint('knight'); fact('knight', 1500); fact('armour', 30000); Bus.emit('knightCame'); }
    if (role === 'king' && first('king')) { UI.hint(settings.reading === 'simple' ? 'The king and queen are here!' : 'The king and queen have come to live in the throne room.'); fact('banner', 2000); }
    if (role === 'cook' && first('cook')) UI.hint(settings.reading === 'simple' ? 'A cook is here!' : 'A cook has come for the kitchen. She cooks at the hearth.');
    if (role === 'jester' && first('jester')) fact('jester', 1500);
    if (role === 'falconer' && first('falconer')) fact('falcon', 1500);
    if (role === 'sage' && first('sage')) fact('library', 1500);
    if (role === 'smith' && first('smith')) fact('smith', 1500);
  });
  Bus.on('noWayIn', () => { if (first('noway' + Math.floor(G.time / 60))) UI.hint(G.castle.grid.count(T.WATER) ? 'bridge' : 'unreachable'); });
  Bus.on('feast', () => { UI.hint('feast'); fact('feast', 2000); const t = G.castle.items.find(it => it.key === 'longtable'); if (t) cine(t.cx * CELL + 2 * CELL, t.cy * CELL - 10, 2, 4, 'The feast!'); });
  Bus.on('joust', (J) => { UI.hint('joust'); fact('joust', 2000); cine((J.A[0] + J.B[0]) / 2 * CELL, J.A[1] * CELL - 20, 1.6, 5, 'Tournament day!'); });
  Bus.on('joustDone', (J) => { G.particles.confetti((J.A[0] + J.B[0]) / 2 * CELL, J.A[1] * CELL - 40, 60); AudioFX.fanfare(); UI.hint(settings.reading === 'simple' ? 'They bow! Well done, knights!' : `The joust is over: ${J.score[0]} taps to ${J.score[1]}. Both knights bow.`); });
  Bus.on('visitor', (v) => { UI.hint('visitor'); fact('hill', 3000); cine(v.x, v.y - 30, 1.8, 4, 'A royal visit!'); });
  Bus.on('market', () => { UI.hint('market'); fact('market', 2000); });
  Bus.on('fireworks', () => { UI.hint('fireworks'); fact('fireworks', 3000); });
  Bus.on('dragon', (d) => { UI.hint('dragon'); fact('dragon', 2500); AudioFX.roar(); cine(d.x, d.y - 60, 1.4, 5, 'A dragon!'); });
  Bus.on('dragonPoke', () => { if (first('dragonPoke')) UI.hint(settings.reading === 'simple' ? 'Sparkles!' : 'It breathes sparkles. It likes you!'); });
  Bus.on('nightFall', () => { UI.hint('night'); if (first('torchF')) fact('torch', 2000); if (G.castle.grid.tallest().h >= 5 && first('owlHint')) later(8000, () => UI.hint('owl')); });
  Bus.on('morning', () => { if (first('morning' + G.day)) UI.hint(settings.reading === 'simple' ? 'Good morning!' : 'Good morning! The drawbridge is down and the day begins.'); });
  Bus.on('snowfall', () => { UI.hint('snow'); fact('winter', 2000); });
  Bus.on('season', (s) => { if (s === 'winter' && first('winterHint')) UI.hint('snow'); });
  Bus.on('rain', () => { UI.hint('rain'); });
  Bus.on('lightning', () => AudioFX.thunder());
  Bus.on('brushed', () => { if (Math.random() < .3) AudioFX.neigh(); });
  Bus.on('dogCame', () => { AudioFX.bark(); fact('cat', 2000); });
  Bus.on('swan', () => fact('swan', 1500));
  Bus.on('owl', () => { if (first('owlF')) UI.hint('owl'); });
  Bus.on('undo', () => { if (first('undoHint')) UI.hint('undo'); });
  Bus.on('readLevel', () => {});

  /* ---------- debug jumps (?stage=…) ---------- */
  function warm(seconds, quiet = true) { const Wd = G.world; Wd.quiet = quiet ? seconds : 0; for (let t = 0; t < seconds; t += .25) Wd.update(.25, G.tod); Wd.quiet = 0; }
  function camOn(cx, cy, zoom) { G.cam.tx = cx * CELL; G.cam.ty = cy * CELL; G.userZoom = zoom; G.cam.tzoom = zoom; G.cam.snap(); }
  function applyDebug() {
    const st = params.get('stage'), Wd = G.world, c = G.castle;
    if (params.has('day')) G.day = Math.max(1, +params.get('day') | 0);
    if (params.has('season')) { const s = params.get('season'); const i = SEASONS.indexOf(s); if (i >= 0) G.day = i * DAYS_PER_SEASON + 1; Wd.setSeason(seasonOfDay(G.day)); }
    if (params.has('weather')) { const s = params.get('weather'), wx = Wd.weather; wx.state = s; wx.timer = 60; if (s === 'rain' || s === 'storm') wx.rain = s === 'storm' ? 1 : .7; if (s === 'snow') { wx.snowing = 1; wx.snow = 1; } if (s === 'storm') wx.cloud = 1; }
    if (params.has('snow')) Wd.weather.snow = +params.get('snow');
    if (params.has('tod')) G.tod = +params.get('tod');
    if (params.has('coins')) c.coins = +params.get('coins');
    const ox = 14, g = GROUND - 1;
    if (st) {
      if (st === 'half') { /* a keep with the top missing */ for (let cy = 0; cy < g - 4; cy++) for (let cx = 0; cx < COLS; cx++) if (c.grid.get(cx, cy) !== T.AIR) c.grid.t[cy * COLS + cx] = T.AIR; c.grid.version++; c.afterEdit(); c.undoStack.length = 0; }
      if (st === 'throne') camOn(ox + 8, g - 5, 2.2); if (st === 'stables') camOn(ox + 23, g - 1, 2.4); if (st === 'moat') camOn(ox + 39, g - 2, 2.2); if (st === 'kitchen') camOn(ox + 15, g - 1, 2.4);
      if (st === 'feast') { G.tod = .72; camOn(ox + 8, g - 1, 2.2); }
      if (st === 'night') { G.tod = .92; camOn(ox + 20, g - 6, 1.1); }
      if (st === 'snow') { G.day = 10; Wd.setSeason('winter'); Wd.weather.snow = 1; Wd.weather.state = 'snow'; Wd.weather.snowing = 1; Wd.weather.cloud = .8; }
      if (st === 'rain') { Wd.weather.state = 'rain'; Wd.weather.rain = .8; Wd.weather.cloud = .9; }
      if (st === 'joust') { if (!c.items.some(it => it.key === 'tiltrail')) c.items.push({ id: c.nextId++, key: 'tiltrail', cx: ox + 28, cy: g }); for (let i = 0; i < 3; i++) c.grid.t[g * COLS + ox + 27 + i * 3] = T.AIR; c.version++; G.tod = .5; }
      if (st === 'dragon') { Wd.dragon.state = 'arrive'; Wd.dragon.x = -200; Wd.dragon.y = 60; if (c.grid.tallest().h < 10) for (let k = 0; k < 4; k++) c.grid.t[(g - 14 - k) * COLS + ox + 1] = T.TOWER; c.grid.version++; c.version++; }
      if (st === 'visitor') { G.day = 3; G.tod = .42; }
      if (st === 'market') { G.day = 3; G.tod = .45; }
      if (st === 'fireworks') { G.tod = .95; if (!c.items.some(it => it.key === 'fireworks')) c.items.push({ id: c.nextId++, key: 'fireworks', cx: ox + 30, cy: g }); c.version++; }
    }
    if (params.has('warm')) warm(+params.get('warm') || 40); else if (st) warm(st === 'joust' ? 70 : 45);
    if (st === 'joust') { Wd.joustDay = 0; Wd.startJoust(); for (let k = 0; k < 20; k++) Wd.update(.25, G.tod); }
    if (st === 'visitor') { Wd.startCarriage(); for (let k = 0; k < 100; k++) Wd.update(.1, G.tod); const cc = Wd.carriage; if (cc) camOn(cc.x / CELL, g - 2, 1.8); }
    if (st === 'market') { Wd.marketDay = 0; for (let k = 0; k < 60; k++) Wd.update(.25, G.tod); camOn(ox + 30, g - 2, 1.8); }
    if (st === 'fireworks') { for (let k = 0; k < 40; k++) { Wd.update(.25, G.tod); G.particles.update(.25); } G.particles.firework(ox * CELL + 600, 120); for (let k = 0; k < 8; k++) G.particles.update(.2); }
    if (st === 'dragon') { for (let k = 0; k < 80; k++) Wd.update(.25, G.tod); const d = Wd.dragon; camOn(d.x / CELL, d.y / CELL - 2, 1.6); }
    if (st === 'feast') { Wd.feast = true; for (let k = 0; k < 120; k++) Wd.update(.25, .72); }
    Cinematic.stop(); G.particles.list.length = 0;
    if (params.has('cam')) { const [cx, cy] = params.get('cam').split(',').map(Number); camOn(cx, cy, +(params.get('zoom') || 1.5)); }
    else if (params.has('zoom')) { G.userZoom = +params.get('zoom'); G.cam.tzoom = G.userZoom; G.cam.snap(); }
    if (params.has('tool')) { const key = params.get('tool'); if (TILE_BY_KEY[key] !== undefined) setTool({ kind: 'tile', key }); else if (ITEMS[key]) setTool({ kind: 'item', key }); else setTool({ kind: key }); }
    if (params.has('cursor')) { const [cx, cy] = params.get('cursor').split(',').map(Number); const [sx, sy] = G.cam.toScreen(cx * CELL + 2, cy * CELL + 2); hover(sx, sy); }
  }

  /* the gamepad on the title and in the panels */
  function padMenus(pads) { const g = pads && pads[0]; if (!g) return; if (!G.started) { if (g.actionPressed || g.startPressed) start(false); return; } if (g.eggPressed || g.startPressed) UI.closeModals(); }

  /* ---------- loop ---------- */
  let last = performance.now(), frames = 0, saveWarned = false;
  function simulate(dt) {
    if (settings.clock) { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.time += dt;
    G.world.update(dt, G.tod);
    Journal.update(dt);
  }
  function camera(rawDt) {
    const cine = Cinematic.camera(), cam = G.cam;
    if (cine) { cam.follow(cine.x, cine.y, cine.zoom); }
    else cam.tzoom = G.userZoom;
    cam.update(rawDt, CAM_BOUNDS);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = clamp((now - last) / 1000, 0, .05);
    last = now;
    if (document.hidden) return;
    Cinematic.update(rawDt);
    const dt = rawDt * Cinematic.timeScale * (settings.slowmo ? .8 : 1);
    const modal = UI.anyModalOpen();
    if (G.started && !modal) readInput(rawDt);
    if (G.started && modal && Reading.busy()) Reading.gamepad(Gamepads.poll());
    else if (modal || !G.started) padMenus(Gamepads.poll());
    if (G.started && !modal) {
      G.warp = G.fast ? 4 : 1;
      for (let k = 0; k < G.warp; k++) simulate(dt);
      Reading.update(dt);
      if (frames % 30 === 0) { const S = G.castle.summary(G.world); S.stained = G.castle.grid.count(T.WIN_STAINED); Stickers.watch(S); }
      saveClock -= rawDt;
      if (saveClock <= 0) { saveClock = 8; if (!SaveGame.write(G) && !saveWarned) { saveWarned = true; UI.hint(settings.reading === 'simple' ? '💾 The game could not be saved: storage is full.' : '💾 The game could not be saved: the browser storage is full. Clearing the chronicle may help.'); } }
    } else if (!G.started) { G.time += rawDt; G.world.update(rawDt * .5, G.tod); }
    G.particles.update(dt, (x) => { const cx = Math.floor(x / CELL); const g = G.castle.grid; for (let cy = 0; cy < ROWS; cy++) if (g.solid(cx, cy)) return cy * CELL - 2; return WORLD_H; });
    camera(rawDt);
    if (!G.started && typeof GFX !== 'undefined' && GFX.active()) {
      const c0 = { x: G.cam.x, y: G.cam.y, zoom: G.cam.zoom }, tod0 = G.tod, n0 = G.night;
      const b = G.castle.grid.bounds(), cx = b ? (b.l + b.r + 1) / 2 * CELL : WORLD_W / 2;
      Object.assign(G.cam, { x: cx + (W > 900 ? W * .18 / 1.1 : 0), y: GROUND_Y - 6.5 * CELL, zoom: clamp(W / ((b ? b.r - b.l + 14 : 30) * CELL), .5, 1.4) }); G.tod = .45;
      Render.frame(G, dt, true);
      Object.assign(G.cam, c0); G.tod = tod0; G.night = n0;
    } else Render.frame(G, dt, !G.started);
    frames++;
    if (params.has('debug')) document.title = `t=${G.time.toFixed(1)} day${G.day} tod=${G.tod.toFixed(2)} folk=${G.world.people.length} horses=${G.world.horses.length} coins=${G.castle.coins | 0} q=${G.castle.questsDone.size} fps=${Render.getFps().toFixed(0)}${typeof GFX !== 'undefined' && GFX.active() ? ` gl=${GFX.stats().ms.toFixed(1)}ms` : ''}`;
    if (G.started) UI.update(rawDt);
    document.body.classList.toggle('cine', !!Cinematic.active);
    const Wd = G.world, cx = Math.floor(G.cam.x / CELL);
    let water = 0; for (let k = -8; k <= 8; k++) if (Wd.castle.grid.get(cx + k, GROUND) === T.WATER) water++;
    AudioFX.update(dt, { night: G.night, wind: Wd.weather.wind, rain: Wd.weather.rain, water: Math.min(1, water / 6), indoors: Wd.castle.grid.roomId(cx, Math.floor(G.cam.y / CELL)) > 0, feast: Wd.feast, joust: !!Wd.joust, music: settings.music });
    drawTitle(rawDt);
  }

  /* ---------- title backdrop (classic): a castle on a hill at sunset ---------- */
  const tc = document.getElementById('titleCanvas'), tctx = tc.getContext('2d');
  let tt = 0;
  const tBirds = Array.from({ length: 9 }, () => ({ x: Math.random(), y: .1 + Math.random() * .3, ph: Math.random() * TAU, s: .5 + Math.random() }));
  function drawTitle(dt) {
    const title = document.getElementById('title');
    if (title.classList.contains('out')) return;
    tt += dt;
    if (tc.width !== W * DPR || tc.height !== H * DPR) { tc.width = W * DPR; tc.height = H * DPR; }
    if (typeof GFX !== 'undefined' && GFX.active()) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.drawImage(GFX.canvas(), 0, 0, tc.width, tc.height); return; }
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = tctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a5ab0'); g.addColorStop(.5, '#8ab8f0'); g.addColorStop(.75, '#ffd0a0'); g.addColorStop(1, '#4a8a3a');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    tctx.fillStyle = '#ffe9b0'; tctx.beginPath(); tctx.arc(W * .8, H * .62, 36, 0, TAU); tctx.fill();
    for (let i = 0; i < 3; i++) { tctx.fillStyle = ['#3a6a3a', '#4a7a3a', '#5a9a4a'][i]; tctx.beginPath(); tctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) tctx.lineTo(x, H * (.7 + i * .06) - Math.sin(x * .004 + i) * 40 - Math.sin(x * .013 + i * 2) * 14); tctx.lineTo(W, H); tctx.fill(); }
    /* the castle silhouette */
    tctx.save(); tctx.translate(W * .5, H * .78); const s = Math.min(1.4, W / 900); tctx.scale(s, s);
    tctx.fillStyle = '#5a5560'; for (const [x, w, h] of [[-200, 40, 160], [-160, 320, 110], [160, 40, 200], [-40, 80, 170]]) { tctx.fillRect(x, -h, w, h); for (let k = 0; k < w; k += 16) tctx.fillRect(x + k, -h - 10, 8, 10); }
    tctx.fillStyle = '#4a4a80'; for (const [x, w, h] of [[-200, 40, 160], [160, 40, 200]]) { tctx.beginPath(); tctx.moveTo(x - 6, -h - 10); tctx.lineTo(x + w / 2, -h - 60); tctx.lineTo(x + w + 6, -h - 10); tctx.fill(); }
    tctx.fillStyle = '#c03a3a'; tctx.fillRect(179, -268, 2, 20); tctx.beginPath(); tctx.moveTo(181, -268); tctx.lineTo(200 + Math.sin(tt * 5) * 3, -262); tctx.lineTo(181, -256); tctx.fill();
    tctx.fillStyle = '#2a2030'; tctx.beginPath(); tctx.moveTo(-20, 0); tctx.lineTo(-20, -40); tctx.arc(0, -40, 20, Math.PI, 0); tctx.lineTo(20, 0); tctx.fill();
    tctx.fillStyle = '#ffd070'; for (const [x, y] of [[-120, -60], [-80, -60], [60, -60], [100, -60], [-20, -120], [-180, -100], [176, -140]]) tctx.fillRect(x, y, 10, 14);
    tctx.restore();
    tctx.fillStyle = '#3a78b8'; tctx.fillRect(0, H * .86, W, H * .04);
    for (const b of tBirds) { const x = ((b.x + tt * .02 * b.s) % 1.1) * W, y = b.y * H + Math.sin(tt * 2 + b.ph) * 6; tctx.strokeStyle = '#2a2a40'; tctx.lineWidth = 1.5; tctx.beginPath(); tctx.moveTo(x - 6 * b.s, y); tctx.quadraticCurveTo(x, y - 5 * b.s * Math.abs(Math.sin(tt * 8 + b.ph)), x + 6 * b.s, y); tctx.stroke(); }
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
  if (params.has('sex') && ROYALS[params.get('sex')]) settings.sex = params.get('sex');
  if (params.has('look')) settings.look = params.get('look');
  if (params.has('diff') && DIFFICULTY[params.get('diff')]) settings.difficulty = params.get('diff');
  if (params.has('blueprint') && BLUEPRINTS[params.get('blueprint')]) settings.blueprint = params.get('blueprint');
  else if (params.has('stage') && ['throne', 'stables', 'moat', 'kitchen', 'feast', 'night', 'snow', 'rain', 'joust', 'dragon', 'visitor', 'market', 'fireworks'].includes(params.get('stage'))) settings.blueprint = 'castle';
  if (params.has('unlock')) settings.unlockAll = true;
  newGame(seed);
  if (params.has('name')) G.castleName = params.get('name').slice(0, 40);
  if (params.has('labels')) settings.labels = true;
  if (['simple', 'normal'].includes(params.get('read'))) settings.reading = params.get('read');
  if (['auto', 'high', 'low'].includes(params.get('quality'))) settings.quality = params.get('quality');
  if (params.has('readlevel') && READ_LEVELS.includes(params.get('readlevel').toUpperCase())) { settings.readMode = 'play'; settings.readLevel = params.get('readlevel').toUpperCase(); }
  if (params.has('science')) settings.science = true;
  if (params.has('moon')) G.moon = +params.get('moon');
  UI.refreshToggles();
  UI.showTitle();
  if (params.has('notitle')) { document.getElementById('title').style.transition = 'none'; start(false); applyDebug(); if (params.has('tab')) UI.setTab(params.get('tab')); }
  else { G.world.quiet = 3; for (let k = 0; k < 30; k++) G.world.update(.2, G.tod); }
  if (params.has('open')) {
    const o = params.get('open');
    setTimeout(() => {
      if (o === 'stickers') { Stickers.check(); UI.openStickers(); }
      else if (o === 'journal') { Journal.add('milestone', 'A test page', 'This entry was added to show the chronicle.', { icon: 'room' }); UI.openJournal(); }
      else if (o === 'quests') UI.openQuests();
      else if (o === 'help') document.getElementById('help').hidden = false;
      else if (o === 'drawer') { document.getElementById('drawer').hidden = false; UI.buildSlots(document.getElementById('slotList'), true); }
      else if (o === 'roompick') { const r = G.castle.rooms().find(x => !x.tiny); if (r) UI.openRoomPick(r); }
    }, 60);
  }
  /* ?clean=1: no panels or pop-ups, for screenshots */
  if (params.has('clean')) { const st = document.createElement('style'); st.textContent = '.hud,.hint,.fact,.toast,.mission-card,.palette{visibility:hidden!important}'; document.head.appendChild(st); }
  if (params.has('mission')) Reading._missionNow();
  if (params.has('readpage')) setTimeout(() => { Reading._solveGate(); Reading.showPage(params.get('readpage'), { gate: params.has('gate') }); }, 80);
  if (params.has('readcard')) setTimeout(() => { Reading._solveGate(); Reading.gateBuild('item:throne', 'throne', 'throne', () => {}); }, 120);
  if (params.has('readtask')) setTimeout(() => { const nx = document.getElementById('rpNext'); nx && nx.click(); }, 400);
  if (params.has('mywords')) setTimeout(() => { const d = Reading.stats(); for (const w of ['i', 'can', 'see', 'the', 'castle', 'go', 'up', 'little', 'big', 'dig', 'stone', 'look', 'at', 'me', 'my']) d.words[w] = { r: 4, w: 0, h: 0 }; d.words.where = { r: 0, w: 3, h: 2 }; d.words.tower = { r: 1, w: 1, h: 0 }; Reading.openWords(); }, 100);
  requestAnimationFrame(loop);
})();
