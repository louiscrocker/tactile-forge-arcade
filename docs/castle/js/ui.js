/* ============================================================
   ui.js — HUD, the build bar, the room picker, quests, title,
            settings, sticker book, chronicle, hints, facts
   ============================================================ */
'use strict';

const UI = (function () {
  const $ = (id) => document.getElementById(id);
  let G, cb;
  let factQueue = [], factOpen = false, factsSeen = new Set(), factKey = null;
  let lastHUD = '', hintKey = '', hintText = '', iconKey = '';
  let toastTimer = 0, toastQueue = [], graphClock = 0, tab = 'hand', roomPage = null, pickRoom = null, palSig = '';

  const simple = () => G.settings.reading === 'simple';
  const T = (key) => { const h = HINTS[key]; if (!h) return key; return Array.isArray(h) ? h[simple() ? 1 : 0] : h; };

  function init(game, callbacks) {
    G = game; cb = callbacks;
    /* title: royal, looks, name, blueprint */
    $('sexPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onSex(b.dataset.sex); AudioFX.click(); const r = ROYALS[b.dataset.sex]; Voice.say(`${r.name}. ${simple() ? r.simple : r.blurb}`, { interrupt: true }); buildLooks(); refreshToggles(); }));
    buildLooks();
    for (const [id, list] of [['nameFirst', NAME_PARTS.first], ['nameSecond', NAME_PARTS.second]]) { const sel = $(id); sel.innerHTML = ''; for (const w of list) { const o = document.createElement('option'); o.value = w; o.textContent = w; sel.appendChild(o); } sel.addEventListener('change', () => { $('nameText').value = ''; cb.onName(castleNameFromPickers()); AudioFX.click(); }); }
    $('nameFirst').value = pick(NAME_PARTS.first); $('nameSecond').value = pick(NAME_PARTS.second);
    $('nameText').addEventListener('input', () => cb.onName($('nameText').value.trim() || castleNameFromPickers()));
    cb.onName(castleNameFromPickers());
    const bp = $('bpPick'); bp.innerHTML = '';
    for (const key of Object.keys(BLUEPRINTS)) { const b = document.createElement('button'); b.className = 'bp' + (key === 'keep' ? ' on' : ''); b.dataset.bp = key; const c = document.createElement('canvas'); c.width = 240; c.height = 120; drawBlueprintThumb(c, key); b.appendChild(c); const t = document.createElement('b'); t.textContent = BLUEPRINTS[key].name; b.appendChild(t); const s = document.createElement('small'); s.textContent = BLUEPRINTS[key].blurb; b.appendChild(s); b.addEventListener('click', () => { cb.onBlueprint(key); AudioFX.click(); Voice.say(`${BLUEPRINTS[key].name}. ${simple() ? BLUEPRINTS[key].simple : BLUEPRINTS[key].blurb}`, { interrupt: true }); refreshToggles(); }); bp.appendChild(b); }
    $('btnStart').addEventListener('click', () => cb.onStart(false));
    for (const grp of ['diffPickTitle', 'diffPick']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.diff)));
    for (const grp of ['readPick', 'readPickDrawer']) $(grp).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReading(b.dataset.read); AudioFX.click(); refreshToggles(); }));
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadMode(b.dataset.rm); AudioFX.click(); refreshToggles(); Voice.say(b.dataset.rm === 'play' ? 'I read to build. Pick your level.' : 'Read to me.', { interrupt: true }); }));
      const box = $('readLevel' + sfx);
      for (const L of [...READ_LEVELS, 'auto']) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.rl = L; b.textContent = L === 'auto' ? '⚙ Auto' : L; b.title = L === 'auto' ? 'Move up or down by itself' : LEVEL_INFO[L].about; b.addEventListener('click', () => { cb.onReadLevel(L); AudioFX.click(); refreshToggles(); }); box.appendChild(b); }
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cb.onReadHelp(b.dataset.rh); AudioFX.click(); refreshToggles(); }));
    $('btnMyWords').addEventListener('click', () => { show('drawer', false); Reading.openWords(); });
    $('btnHelp').addEventListener('click', () => { show('help', true); AudioFX.click(); });
    $('helpClose').addEventListener('click', () => show('help', false));
    $('btnMenu').addEventListener('click', () => { show('drawer', $('drawer').hidden); if (!$('drawer').hidden) buildSlots($('slotList'), true); AudioFX.click(); });
    $('drawerClose').addEventListener('click', () => show('drawer', false));
    for (const [id, key] of [['btnLabels', 'labels'], ['tgLabels', 'labels'], ['tgSoundChip', 'sound'], ['tgMusic', 'music'], ['btnVoice', 'voice'], ['tgVoice', 'voice'], ['tgVoiceTitle', 'voice'], ['tgVisitors', 'visitors'], ['tgSlow', 'slowmo'], ['tgUnlock', 'unlockAll'], ['tgClock', 'clock'], ['tgScience', 'science'], ['btnFast', 'fast']])
      $(id).addEventListener('click', () => cb.onToggle(key));
    $('selQuality').addEventListener('change', (e) => cb.onQuality(e.target.value));
    $('sTod').addEventListener('input', (e) => cb.onTod(e.target.value / 100));
    $('btnNewGame').addEventListener('click', () => { show('drawer', false); if (confirm('Start a new castle in this slot? The castle here will be gone.')) cb.onNewGame(); });
    $('btnPhoto').addEventListener('click', () => cb.onPhoto());
    $('btnQuests').addEventListener('click', () => openQuests());
    $('questsClose').addEventListener('click', () => show('quests', false));
    $('btnBook').addEventListener('click', () => openStickers());
    $('btnStickersDrawer').addEventListener('click', () => { show('drawer', false); openStickers(); });
    $('stickerClose').addEventListener('click', () => show('stickerBook', false));
    $('btnJournal').addEventListener('click', () => openJournal());
    $('btnJournalDrawer').addEventListener('click', () => { show('drawer', false); openJournal(); });
    $('journalClose').addEventListener('click', () => show('journal', false));
    $('journalPrint').addEventListener('click', () => window.print());
    $('journalClear').addEventListener('click', () => { if (confirm('Clear the whole chronicle?')) Journal.clear(); });
    $('scienceClose').addEventListener('click', () => cb.onToggle('science'));
    $('factClose').addEventListener('click', closeFact);
    $('factOk').addEventListener('click', () => { if (factKey) Bus.emit('factRead', factKey); closeFact(); });
    $('factSay').addEventListener('click', () => { Voice.say(`${$('factTitle').textContent}. ${$('factBody').textContent}`, { interrupt: true, force: true }); });
    $('hintSay').addEventListener('click', () => Voice.say(hintText, { interrupt: true, force: true }));
    /* the build bar */
    $('palTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); AudioFX.click(); }));
    $('btnUndo').addEventListener('click', () => { cb.onUndo(); AudioFX.click(); });
    $('btnRedo').addEventListener('click', () => { cb.onRedo(); AudioFX.click(); });
    /* the room picker */
    $('roomPickClose').addEventListener('click', () => show('roomPick', false));
    $('roomClear').addEventListener('click', () => { if (pickRoom) cb.onRoomType(pickRoom, 'empty', ''); show('roomPick', false); AudioFX.click(); });
    $('roomNameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && pickRoom) { const t = pickRoom.type === 'empty' ? 'store' : pickRoom.type; cb.onRoomType(pickRoom, t, $('roomNameInput').value.trim()); show('roomPick', false); } });
    const rg = $('roomGrid');
    for (const key of ROOM_KEYS) { const t = ROOM_TYPES[key], b = document.createElement('button'); b.className = 'roomopt'; b.dataset.type = key; b.appendChild(Sprites.icon(t.icon, 60)); const s = document.createElement('span'); s.textContent = `${t.emoji} ${t.name}`; b.appendChild(s); if (t.groundOnly) { const g = document.createElement('small'); g.textContent = 'ground floor'; b.appendChild(g); } b.addEventListener('click', () => { if (!pickRoom) return; const ok = cb.onRoomType(pickRoom, key, $('roomNameInput').value.trim()); if (ok === 'ground') { hint(simple() ? 'Stables go on the ground floor.' : `${t.name} must be on the ground floor, so the horses can walk in.`); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 500); return; } show('roomPick', false); AudioFX.pop(1.2); Voice.say(`${t.name}!`, { interrupt: true }); }); rg.appendChild(b); }
    Bus.on('fact', queueFact);
    Bus.on('hint', (k) => hint(k));
    Bus.on('cinematic', (title) => { if (title && !Reading.on()) Voice.say(title, { interrupt: false }); });
    Bus.on('questDone', (c, q, coins) => questToast(q, coins));
    refreshToggles();
  }
  function show(id, on) { $(id).hidden = !on; }
  function castleNameFromPickers() { return ($('nameFirst').value + $('nameSecond').value).replace(/\s+/g, ' ').trim(); }
  function drawBlueprintThumb(c, key) {
    const g = c.getContext('2d'); g.fillStyle = '#9fd0ff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#5aa03a'; g.fillRect(0, 96, c.width, 24);
    const tmp = new Castle(G); tmp.applyBlueprint(key); const grid = tmp.grid, b = grid.bounds();
    if (!b) { g.fillStyle = '#2a2016'; g.font = `900 16px ${UI_FONT}`; g.textAlign = 'center'; g.fillText('An empty plot', c.width / 2, 60); return; }
    const sc = Math.min(c.width / ((b.r - b.l + 10) * CELL), 96 / (GROUND * CELL) * 1.6);
    g.save(); g.translate(c.width / 2 - ((b.l + b.r + 1) / 2) * CELL * sc, 96 - GROUND * CELL * sc); g.scale(sc, sc);
    for (let cy = 0; cy < GROUND + 2; cy++) for (let cx = Math.max(0, b.l - 6); cx <= Math.min(COLS - 1, b.r + 6); cx++) { const t = grid.get(cx, cy); if (t === T.AIR || t === T.EARTH) continue; Sprites.tile(g, grid, cx, cy, t, { time: 0, snow: 0, bridge: 1, lit: false, season: 'summer' }); }
    g.restore();
  }
  function buildLooks() {
    const grid = $('lookPick'); grid.innerHTML = '';
    const r = ROYALS[G.settings.sex] || ROYALS.princess;
    for (const look of r.looks) {
      const b = document.createElement('button'); b.dataset.look = look.key;
      const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.scale(2, 2); g.translate(30, 56); Sprites.person(g, { role: 'royal', sex: G.settings.sex, look, s: 1.1 });
      b.appendChild(c); const t = document.createElement('span'); t.textContent = look.name; b.appendChild(t);
      b.addEventListener('click', () => { cb.onLook(look.key); AudioFX.click(); Voice.say(look.name, { interrupt: true }); refreshToggles(); });
      grid.appendChild(b);
    }
  }
  function refreshRoyal() {
    document.querySelectorAll('#sexPick button').forEach(b => b.classList.toggle('on', b.dataset.sex === G.settings.sex));
    document.querySelectorAll('#lookPick button').forEach(b => b.classList.toggle('on', b.dataset.look === G.settings.look));
    const r = ROYALS[G.settings.sex] || ROYALS.princess, look = royalLook(G.settings.sex, G.settings.look);
    const bl = $('royalBlurb'); bl.innerHTML = ''; const bb = document.createElement('b'); bb.textContent = `${r.name} ${look.name}`; bl.append(bb, document.createTextNode(' — ' + (simple() ? r.simple : r.blurb)));
    document.querySelectorAll('#bpPick .bp').forEach(b => b.classList.toggle('on', b.dataset.bp === G.settings.blueprint));
  }
  function setDiff(d) { cb.onDiff(d); document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === d)); AudioFX.click(); }
  function refreshToggles() {
    const s = G.settings, on = (id, v) => $(id).classList.toggle('on', !!v);
    on('btnLabels', s.labels); on('tgLabels', s.labels); on('tgSoundChip', s.sound); on('tgMusic', s.music);
    on('btnVoice', s.voice); on('tgVoice', s.voice); on('tgVoiceTitle', s.voice);
    $('btnVoice').textContent = s.voice ? '🔊' : '🔇';
    on('tgVisitors', s.visitors); on('tgSlow', s.slowmo); on('tgUnlock', s.unlockAll); on('tgClock', s.clock);
    $('tgClock').textContent = s.clock ? 'Clock running' : 'Clock paused';
    on('tgScience', s.science); $('science').hidden = !s.science;
    on('btnFast', G.fast);
    $('selQuality').value = s.quality;
    document.querySelectorAll('#diffPickTitle button, #diffPick button').forEach(b => b.classList.toggle('on', b.dataset.diff === s.difficulty));
    document.querySelectorAll('#readPick button, #readPickDrawer button').forEach(b => b.classList.toggle('on', b.dataset.read === s.reading));
    document.body.classList.toggle('simple', s.reading === 'simple');
    for (const sfx of ['Title', 'Drawer']) {
      $('readMode' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rm === (s.readMode || 'listen')));
      $('readLevel' + sfx).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rl === 'auto' ? !!s.readAuto : b.dataset.rl === (s.readLevel || 'B')));
      $('readLevel' + sfx).hidden = s.readMode !== 'play';
      $('readAbout' + sfx).textContent = s.readMode === 'play' ? `${LEVEL_INFO[s.readLevel || 'B'].name}: ${LEVEL_INFO[s.readLevel || 'B'].about}${s.readAuto ? ' The level moves up or down by itself.' : ''}` : 'Everything is read aloud. Pick "I read to build" to make reading how the castle is built.';
    }
    $('readHelpPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.rh === (s.readHelp || 'auto')));
    document.body.classList.toggle('read-play', s.readMode === 'play');
    refreshRoyal();
    palSig = ''; refreshPalette();
  }

  /* ---------- save slots ---------- */
  function buildSlots(box, inDrawer) {
    box.innerHTML = '';
    for (let i = 1; i <= SaveGame.SLOTS; i++) {
      const d = SaveGame.describe(i), b = document.createElement('button'); b.className = 'slot' + (SaveGame.slot === i && (G.started || !inDrawer) ? ' on' : '') + (d ? '' : ' empty');
      if (d && d.thumb) { const img = new Image(); img.src = d.thumb; b.appendChild(img); } else { const c = document.createElement('div'); c.className = 'slot-blank'; c.textContent = d ? '🏰' : '＋'; b.appendChild(c); }
      const t = document.createElement('div'); t.className = 'slot-txt';
      t.innerHTML = d ? `<b></b><small>${ROYALS[d.sex] ? ROYALS[d.sex].emoji : ''} day ${d.day} · ${d.stones} stones · ${d.rooms} rooms</small>` : `<b>Slot ${i}</b><small>${inDrawer ? 'Start a castle here' : 'A new castle'}</small>`;
      if (d) t.querySelector('b').textContent = d.name;
      b.appendChild(t);
      b.addEventListener('click', () => { AudioFX.click(); cb.onSlot(i, !!d, inDrawer); });
      box.appendChild(b);
    }
  }
  function showTitle() { $('title').classList.remove('out'); buildSlots($('titleSlots'), false); }
  function hideTitle() { $('title').classList.add('out'); }

  /* ---------- the build bar ---------- */
  function setTab(t) {
    tab = t; $('palTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'hand') cb.onTool({ kind: 'hand' });
    else if (t === 'erase') cb.onTool({ kind: 'erase' });
    else if (t === 'name') cb.onTool({ kind: 'name' });
    else if (t === 'build') { if (!G.tool || G.tool.kind !== 'tile') cb.onTool({ kind: 'tile', key: 'stone' }); }
    else if (t === 'garden') { if (!G.tool || G.tool.kind !== 'item' || !GARDEN_ITEMS.includes(G.tool.key)) cb.onTool({ kind: 'item', key: 'rosebush' }); }
    else if (t === 'furnish') { const pages = furnishPages(); if (!roomPage || !pages.includes(roomPage)) roomPage = pages[0] || null; if (roomPage) { const items = itemsForRoom(roomPage); if (!G.tool || G.tool.kind !== 'item' || !items.includes(G.tool.key)) cb.onTool({ kind: 'item', key: items[0] }); } else cb.onTool({ kind: 'hand' }); }
    palSig = ''; refreshPalette();
    const notes = { hand: T('pan'), build: T('stone'), furnish: roomPage ? T('furnish') : T('noRoom'), garden: T('outside'), name: T('nameRoom'), erase: simple() ? 'Tap a thing or a block to take it away.' : 'Tap a block or a piece of furniture to take it away. Furniture is refunded.' };
    $('palNote').textContent = notes[t] || '';
  }
  function furnishPages() {
    const c = G.castle, named = new Set(c ? c.namedRooms().map(r => r.type) : []);
    const pages = ROOM_KEYS.filter(k => named.has(k) || c.unlocked.has(k) || c.free());
    if (c && c.rooms().some(r => !r.tiny)) pages.push('any');
    return pages;
  }
  function refreshPalette() {
    const c = G.castle; if (!c) return;
    const free = c.free(), sig = `${tab}|${roomPage}|${G.tool && G.tool.key}|${free}|${[...c.unlocked].join()}|${[...c.questsDone].join()}|${c.namedRooms().map(r => r.type).join()}|${simple()}`;
    if (sig === palSig) { updateAffordable(); return; }
    palSig = sig;
    const rooms = $('palRooms'), items = $('palItems'); rooms.innerHTML = ''; items.innerHTML = '';
    rooms.hidden = tab !== 'furnish';
    const mkItem = (key, kind, label, icon, cost) => {
      const b = document.createElement('button'); b.className = 'pal-item' + (G.tool && G.tool.kind === kind && G.tool.key === key ? ' on' : ''); b.dataset.key = key; b.dataset.kind = kind;
      const ic = Sprites.icon(icon, 44); b.appendChild(ic);
      const s = document.createElement('span'); s.textContent = label; b.appendChild(s);
      if (cost !== undefined && cost > 0 && !free) { const p = document.createElement('small'); p.textContent = `🪙${cost}`; b.appendChild(p); }
      b.addEventListener('click', () => { cb.onTool({ kind, key }); AudioFX.click(); const word = kind === 'tile' ? TILE_INFO[TILE_BY_KEY[key]].name : ITEMS[key].name; Voice.say(word, { interrupt: true }); palSig = ''; refreshPalette(); });
      return b;
    };
    if (tab === 'build') { for (const key of BUILD_TOOLS) { const t = TILE_BY_KEY[key], info = TILE_INFO[t]; items.appendChild(mkItem(key, 'tile', simple() ? info.word : info.name, info.icon)); } }
    else if (tab === 'garden') { for (const key of GARDEN_ITEMS) { if (!c.available(key)) { const b = mkItem(key, 'item', simple() ? ITEMS[key].word : ITEMS[key].name, key, ITEMS[key].cost); b.classList.add('locked'); b.title = 'Finish a quest to open this'; items.appendChild(b); continue; } items.appendChild(mkItem(key, 'item', simple() ? ITEMS[key].word : ITEMS[key].name, key, ITEMS[key].cost)); } }
    else if (tab === 'furnish') {
      const pages = furnishPages();
      if (!pages.length) { items.innerHTML = `<p class="pal-empty">${simple() ? 'Make a room first. Walls all round, a floor and a roof!' : 'Close in a room first (walls on both sides, a floor and a ceiling), then name it with 🏷️ to open its furniture.'}</p>`; return; }
      for (const p of pages) { const b = document.createElement('button'); b.className = 'chip' + (p === roomPage ? ' on' : ''); b.textContent = p === 'any' ? '🧺 Any room' : `${ROOM_TYPES[p].emoji} ${ROOM_TYPES[p].name}`; b.addEventListener('click', () => { roomPage = p; const list = itemsForRoom(p); cb.onTool({ kind: 'item', key: list[0] }); AudioFX.click(); palSig = ''; refreshPalette(); }); rooms.appendChild(b); }
      if (roomPage) for (const key of itemsForRoom(roomPage)) items.appendChild(mkItem(key, 'item', simple() ? ITEMS[key].word : ITEMS[key].name, key, ITEMS[key].cost));
    }
    else if (tab === 'name') { items.innerHTML = `<p class="pal-empty">${simple() ? 'Tap a room to name it.' : 'Tap any closed room to say what it is for. Named rooms open their furniture pages.'}</p>`; }
    else if (tab === 'erase') { items.innerHTML = `<p class="pal-empty">${simple() ? 'Tap a block or a thing to take it away.' : 'Tap a block or a piece of furniture to take it away. Drag to clear a row.'}</p>`; }
    else { items.innerHTML = `<p class="pal-empty">${simple() ? 'Drag to look. Tap a horse to brush it!' : 'Drag to look around, pinch or scroll to zoom. Tap a horse to brush it, a dog to pat it, the dragon to make it puff.'}</p>`; }
    updateAffordable();
  }
  function updateAffordable() {
    const c = G.castle; if (!c) return;
    $('palItems').querySelectorAll('.pal-item').forEach(b => { if (b.dataset.kind === 'item') b.classList.toggle('poor', !c.canAfford(b.dataset.key)); });
    $('btnUndo').disabled = !c.undoStack.length; $('btnRedo').disabled = !c.redoStack.length;
  }
  function openRoomPick(room) {
    pickRoom = room; $('roomNameInput').value = room.name || '';
    $('roomGrid').querySelectorAll('.roomopt').forEach(b => { b.classList.toggle('on', b.dataset.type === room.type); b.classList.toggle('dim', !!ROOM_TYPES[b.dataset.type].groundOnly && !room.ground); });
    show('roomPick', true); AudioFX.click();
    Voice.say(simple() ? 'What is this room for?' : 'What is this room for? Tap a picture.', { interrupt: true });
  }

  /* ---------- HUD ---------- */
  const MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  function update(dt = 1 / 60) {
    const Wd = G.world, c = G.castle; if (!Wd || !c) return;
    const w = Wd.weather, sky = w.snowing ? '🌨️' : w.state === 'storm' ? '⛈️' : w.rain > .3 ? '🌧️' : w.cloud > .5 ? '☁️' : (G.night > .5 ? '🌙' : '☀️');
    const quests = c.activeQuests(), q = quests[0], done = c.questsDone.size, total = QUESTS.length;
    const moon = MOON_EMOJI[Math.round(((G.moon % 1) + 1) % 1 * 8) % 8];
    const folk = Wd.people.length + Wd.horses.length + Wd.dogs.length;
    const sig = `${G.castleName}|${Math.round(c.coins)}|${G.day}|${sky}|${folk}|${moon}|${Wd.season}|${q ? q.key : ''}|${done}|${c.undoStack.length}|${c.redoStack.length}|${c.version}`;
    const pal = $('palette'), hb = (pal && !pal.hidden ? pal.offsetHeight : 0) + 30; if (hb !== update.hb) { update.hb = hb; $('hint').style.bottom = hb + 'px'; }
    if (sig !== lastHUD) {
      lastHUD = sig;
      $('stageName').textContent = G.castleName || 'My Castle';
      $('progBar').style.width = (done / total * 100).toFixed(1) + '%'; $('progText').textContent = q ? `📜 ${simple() ? q.simple : q.title}` : 'Every quest done!';
      $('roDay').textContent = `Day ${G.day}`; $('roSeason').textContent = SEASON_INFO[Wd.season][0];
      $('weatherBadge').textContent = sky; $('roCoins').textContent = fmtInt(c.coins); $('roFolk').textContent = folk;
      $('roMoon').textContent = moon; $('roMoon').parentElement.title = moonName(G.moon);
      $('questCount').textContent = `${done} / ${total}`;
      updateAffordable();
    }
    const ik = `${G.sex}|${G.look}`;
    if (ik !== iconKey) { iconKey = ik; const cv = $('stageIcon'), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); ctx.save(); ctx.scale(2, 2); ctx.translate(28, 54); Sprites.person(ctx, { role: 'royal', sex: G.sex, look: royalLook(G.sex, G.look), s: 1.05 }); ctx.restore(); }
    if (G.settings.science) { graphClock -= dt; if (graphClock <= 0) { graphClock = .5; Journal.drawGraph($('scienceCanvas')); } }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) { $('stickerToast').hidden = true; $('questToast').hidden = true; if (toastQueue.length) { const n = toastQueue.shift(); n.q ? showQuestToast(n.q, n.coins) : showSticker(n); } } }
  }

  /* ---------- hints ---------- */
  let readHintTimer = null;
  function hint(keyOrText, flash = true) {
    const rt = Reading.hintText(keyOrText);
    if (rt) {
      if (rt === hintKey) return;
      hintKey = rt; hintText = rt;
      const h = $('hint'); $('hintText').textContent = rt;
      if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
      clearTimeout(readHintTimer);
      if (G.settings.readHelp !== 'ask') readHintTimer = setTimeout(() => { if (hintText === rt) Voice.say(rt, { interrupt: false }); }, LEVEL_INFO[Reading.level()].help * 1000);
      return;
    }
    const txt = T(keyOrText);
    if (txt === hintKey) return;
    hintKey = txt; hintText = txt;
    const h = $('hint'); $('hintText').textContent = txt;
    if (flash) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); }
    Voice.say(txt, { interrupt: true });
  }

  /* ---------- facts ---------- */
  function queueFact(key) { if (!FACTS[key] || factsSeen.has(key)) return; factsSeen.add(key); factQueue.push(key); if (!factOpen) nextFact(); }
  let factGap = null;
  function nextFact() {
    clearTimeout(factGap);
    if (Reading.busy() && factQueue.length) { factOpen = true; factGap = setTimeout(nextFact, 1500); return; }
    const key = factQueue.shift();
    if (!key) { factOpen = false; return; }
    factOpen = true; factKey = key;
    const f = FACTS[key];
    $('factTitle').textContent = f.title; $('factBody').textContent = simple() ? f.simple : f.body;
    const more = $('factMore'); more.hidden = !f.more; if (f.more) more.href = f.more;
    const el = $('fact'); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(nextFact._t); nextFact._t = setTimeout(closeFact, 30000);
    if (!Reading.on()) setTimeout(() => Voice.say(`${f.title}. ${simple() ? f.simple : f.body}`), 900);
  }
  function closeFact() { $('fact').hidden = true; clearTimeout(nextFact._t); clearTimeout(factGap); factGap = setTimeout(nextFact, 600); }
  function resetFacts() { clearTimeout(factGap); clearTimeout(nextFact._t); factQueue = []; factsSeen = new Set(); factOpen = false; $('fact').hidden = true; }

  /* ---------- stickers and quest toasts ---------- */
  function placeToast(t) { const below = [$('hud'), $('missionCard')].filter(el => el && !el.hidden).reduce((y, el) => Math.max(y, el.getBoundingClientRect().bottom), 0); if (innerWidth <= 900) t.style.top = Math.round(below + 10) + 'px'; else t.style.top = ''; }
  function showSticker(st) {
    const t = $('stickerToast'), c = $('stickerToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(Stickers.image(st, 80, false), 0, 0, 160, 160);
    $('stickerToastName').textContent = simple() ? st.simple : st.name;
    t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; placeToast(t);
    toastTimer = 4.5; AudioFX.sticker && AudioFX.sticker();
    Voice.say(`New sticker! ${simple() ? st.simple : st.name}`);
  }
  function showQuestToast(q, coins) {
    const t = $('questToast'), c = $('questToastCanvas'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(Sprites.icon(q.icon, 80), 0, 0, 160, 160);
    $('questToastName').textContent = q.title; $('questToastCoins').textContent = `+${coins} coins`;
    t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; placeToast(t);
    toastTimer = 4.5; AudioFX.fanfare && AudioFX.fanfare();
    Voice.say(`Quest done! ${q.title}. ${coins} coins!`);
  }
  function onSticker(st) { if (toastTimer > 0) toastQueue.push(st); else showSticker(st); }
  function questToast(q, coins) { if (toastTimer > 0) toastQueue.push({ q, coins }); else showQuestToast(q, coins); }
  function openStickers() {
    AudioFX.click();
    const grid = $('stickerGrid'); grid.innerHTML = '';
    let n = 0;
    for (const st of Stickers.all()) {
      const has = Stickers.has(st.key); if (has) n++;
      const b = document.createElement('button'); b.className = 'sticker' + (has ? '' : ' locked');
      const src = Stickers.image(st, 72, !has), img = document.createElement('canvas');
      img.width = src.width; img.height = src.height; img.getContext('2d').drawImage(src, 0, 0); img.style.width = img.style.height = '72px';
      b.appendChild(img);
      const s = document.createElement('span'); s.textContent = simple() ? st.simple : st.name; b.appendChild(s);
      b.addEventListener('click', () => Voice.say(has ? `${st.name}. ${st.simple}` : `Still locked: ${st.name}.`, { interrupt: true, force: true }));
      grid.appendChild(b);
    }
    $('stickerCount').textContent = `${n} / ${Stickers.all().length}`;
    show('stickerBook', true);
  }
  function openQuests() {
    AudioFX.click();
    const list = $('questList'); list.innerHTML = '';
    const c = G.castle, active = c.activeQuests();
    for (const q of QUESTS) {
      const done = c.questsDone.has(q.key), isActive = active.includes(q);
      if (!done && !isActive) continue;
      const div = document.createElement('div'); div.className = 'quest' + (done ? ' done' : '');
      div.appendChild(Sprites.icon(q.icon, 52));
      const t = document.createElement('div'); t.innerHTML = `<h4></h4><p></p><small></small>`; t.querySelector('h4').textContent = (done ? '✓ ' : '') + q.title; t.querySelector('p').textContent = simple() ? q.simple : q.text; t.querySelector('small').textContent = `🪙 ${Math.round(q.reward * G.diff().questK)} coins${q.unlock ? ' · opens ' + (ITEMS[q.unlock] ? ITEMS[q.unlock].name.toLowerCase() : q.unlock) : ''}`;
      div.appendChild(t);
      div.addEventListener('click', () => Voice.say(`${q.title}. ${simple() ? q.simple : q.text}`, { interrupt: true, force: true }));
      list.appendChild(div);
    }
    const left = QUESTS.length - c.questsDone.size - active.length;
    if (left > 0) { const p = document.createElement('p'); p.className = 'tiny'; p.textContent = `${left} more quests are waiting.`; list.appendChild(p); }
    show('quests', true);
  }
  function openJournal() { AudioFX.click(); Journal.renderBook(); show('journal', true); }
  function anyModalOpen() { return ['help', 'stickerBook', 'journal', 'quests', 'roomPick', 'readCard', 'readPage', 'myWords', 'drawer'].some(id => !$(id).hidden); }
  function closeModals() { ['help', 'stickerBook', 'journal', 'quests', 'roomPick', 'myWords', 'drawer'].forEach(id => show(id, false)); }

  return { init, update, hint, refreshToggles, refreshPalette, setTab, tab: () => tab, hideTitle, showTitle, buildSlots, resetFacts, queueFact, onSticker, openStickers, openJournal, openQuests, openRoomPick, anyModalOpen, closeModals, isFactOpen: () => factOpen, T, roomPage: () => roomPage };
})();
