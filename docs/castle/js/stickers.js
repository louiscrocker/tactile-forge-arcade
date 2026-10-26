/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the castle's summary and the events seen; unlocked
   stickers persist in the browser (key `castle.stickers`).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'first', name: 'First Stone', simple: 'I laid my first stone!', icon: 'stone', col: '#d9d2c4', test: (S) => S.stones >= 1 },
  { key: 'stones50', name: 'Stonemason', simple: 'I laid fifty stones!', icon: 'stone', col: '#c8c0b0', test: (S) => S.stones >= 50 },
  { key: 'stones200', name: 'Master Mason', simple: 'I laid two hundred stones!', icon: 'tower', col: '#b8b0a0', test: (S) => S.stones >= 200 },
  { key: 'room', name: 'A Room!', simple: 'I closed in my first room!', icon: 'room', col: '#ffe9a8', test: (S) => S.rooms >= 1 },
  { key: 'named', name: 'What Is It For?', simple: 'I named a room!', icon: 'nametag', col: '#fff0d8', test: (S) => S.named >= 1 },
  { key: 'rooms6', name: 'Six Rooms', simple: 'My castle has six named rooms!', icon: 'room', col: '#ffd27a', test: (S) => S.named >= 6 },
  { key: 'door', name: 'Come In', simple: 'I put in a door!', icon: 'door', col: '#e8c8a0', test: (S) => S.doors >= 1 },
  { key: 'window', name: 'Let There Be Light', simple: 'I put in a window!', icon: 'arch', col: '#c8e0f8', test: (S) => S.windows >= 1 },
  { key: 'stained', name: 'Rainbow Glass', simple: 'I put in a stained glass window!', icon: 'stained', col: '#e0c8f8', test: (S) => S.stainedCount >= 1 },
  { key: 'tower6', name: 'Tall Tower', simple: 'My tower is six blocks high!', icon: 'cone', col: '#c8d0e8', test: (S) => S.tallest >= 6 },
  { key: 'tower10', name: 'Sky High', simple: 'My tower is ten blocks high!', icon: 'cone', col: '#a8c0f0', test: (S) => S.tallest >= 10 },
  { key: 'battlements', name: 'Battlements', simple: 'I built battlements along the wall!', icon: 'battlement', col: '#d0ccc0', test: (S) => S.battlements >= 5 },
  { key: 'moat', name: 'Moat Digger', simple: 'I dug a moat!', icon: 'moat', col: '#a8d8ff', test: (S) => S.water >= 4 },
  { key: 'moatAround', name: 'Water All Round', simple: 'My moat goes all the way round!', icon: 'moat', col: '#80c0f0', test: (S) => S.moatAround },
  { key: 'drawbridge', name: 'Drawbridge', simple: 'I built a drawbridge!', icon: 'drawbridge', col: '#e8c8a0', test: (S) => S.drawbridges >= 1 },
  { key: 'gate', name: 'Portcullis', simple: 'I put in a gate!', icon: 'gate', col: '#c8c8d0', test: (S) => S.gates >= 1 },
  { key: 'stairs', name: 'Up We Go', simple: 'I built stairs to the room above!', icon: 'stair', col: '#e0d8c8', test: (S) => S.stairsUp >= 1 },
  { key: 'throne', name: 'Royal Seat', simple: 'I put a throne in my throne room!', icon: 'throne', col: '#ffd23f', test: (S) => S.items.throne >= 1 },
  { key: 'bed', name: 'Sweet Dreams', simple: 'I put a bed in a bedchamber!', icon: 'canopybed', col: '#e0d0f0', test: (S) => S.roomTypes.bedroom >= 1 && (S.items.canopybed + S.items.bed) >= 1 },
  { key: 'kitchen', name: 'Cook\'s Kitchen', simple: 'My kitchen has a hearth!', icon: 'hearth', col: '#ffd0a0', test: (S) => S.items.hearth >= 1 },
  { key: 'hall', name: 'Feast!', simple: 'Everyone feasted in my great hall!', icon: 'feast', col: '#ffe0b0', test: (S) => S.events.has('feast') },
  { key: 'library', name: 'Bookworm Castle', simple: 'My library has books!', icon: 'bookshelf', col: '#d8c8a8', test: (S) => S.items.bookshelf >= 1 && S.roomTypes.library >= 1 },
  { key: 'music', name: 'Music Room', simple: 'My castle has a harp!', icon: 'harp', col: '#f0d8f8', test: (S) => S.items.harp >= 1 },
  { key: 'horse', name: 'A Horse!', simple: 'A horse came to my stables!', icon: 'horse', col: '#e8c8a0', test: (S) => S.horses >= 1 },
  { key: 'horses3', name: 'Three Horses', simple: 'Three horses live in my stables!', icon: 'horse', col: '#d8b890', test: (S) => S.horses >= 3 },
  { key: 'brush', name: 'Horse Friend', simple: 'I brushed a horse!', icon: 'horse', col: '#ffd0e0', test: (S) => S.brushed >= 1 },
  { key: 'knight', name: 'Knights!', simple: 'Knights came to guard my castle!', icon: 'knight', col: '#c8ccd8', test: (S) => S.knights >= 1 },
  { key: 'joust', name: 'Tournament', simple: 'My knights jousted!', icon: 'joust', col: '#ffd27a', test: (S) => S.events.has('joust') },
  { key: 'dog', name: 'Good Dog', simple: 'A dog lives in my kennel!', icon: 'dog', col: '#e8d0b0', test: (S) => S.dogs >= 1 },
  { key: 'swan', name: 'Swans', simple: 'Swans swim on my moat!', icon: 'swan', col: '#e8f0ff', test: (S) => S.events.has('swan') },
  { key: 'flag', name: 'Flying the Flag', simple: 'I flew a flag from my castle!', icon: 'flag', col: '#ffc0c0', test: (S) => S.items.flag >= 1 },
  { key: 'garden', name: 'Castle Garden', simple: 'I planted a garden!', icon: 'rosebush', col: '#c8f0c0', test: (S) => S.garden >= 5 },
  { key: 'fountain', name: 'Fountain', simple: 'My courtyard has a fountain!', icon: 'fountain', col: '#c0e8ff', test: (S) => S.items.fountain >= 1 },
  { key: 'night', name: 'Castle by Night', simple: 'I saw the torches lit at night!', icon: 'night', col: '#a0a8d0', test: (S) => S.events.has('nightFall') },
  { key: 'snow', name: 'Winter Castle', simple: 'Snow fell on my castle!', icon: 'snow', col: '#e8f0ff', test: (S) => S.events.has('snowfall') },
  { key: 'rain', name: 'Rainy Day', simple: 'It rained on my castle!', icon: 'rain', col: '#c0d0e0', test: (S) => S.events.has('rain') },
  { key: 'visitor', name: 'Royal Visit', simple: 'A royal carriage came to visit!', icon: 'carriage', col: '#f0c8e8', test: (S) => S.events.has('visitor') },
  { key: 'market', name: 'Market Day', simple: 'Traders came for market day!', icon: 'market', col: '#ffe0b0', test: (S) => S.events.has('market') },
  { key: 'fireworks', name: 'Fireworks!', simple: 'Fireworks lit up my castle!', icon: 'fireworks', col: '#f0b0f0', test: (S) => S.events.has('fireworks') },
  { key: 'dragon', name: 'Dragon Friend', simple: 'A friendly dragon landed on my tower!', icon: 'dragon', col: '#b0f0c0', test: (S) => S.events.has('dragon') },
  { key: 'quest1', name: 'First Quest', simple: 'I finished a royal quest!', icon: 'quest', col: '#ffe27a', test: (S) => S.quests >= 1 },
  { key: 'quest10', name: 'Ten Quests', simple: 'I finished ten royal quests!', icon: 'quest', col: '#ffd23f', test: (S) => S.quests >= 10 },
  { key: 'rich', name: 'Treasury', simple: 'I saved up 500 coins!', icon: 'coins', col: '#ffe9a8', test: (S) => S.coins >= 500 },
  { key: 'furniture20', name: 'Fully Furnished', simple: 'I placed twenty things in my castle!', icon: 'chest', col: '#e8d0b0', test: (S) => S.furniture >= 20 },
  { key: 'undo', name: 'Changed My Mind', simple: 'I used undo!', icon: 'star', col: '#d0d8f0', test: (S) => S.undos >= 1 },
  { key: 'photo', name: 'Photographer', simple: 'I took a castle portrait!', icon: 'camera', col: '#ffffff', test: (S) => S.photos >= 1 },
  { key: 'bookworm', name: 'Castle Expert', simple: 'I read 10 castle facts!', icon: 'book', col: '#f6d743', test: (S) => S.factsRead >= 10 },
  { key: 'both', name: 'Prince and Princess', simple: 'I have been a prince and a princess!', icon: 'crown', col: '#ffd0f0', test: (S) => S.royalsDone >= 2 },
  /* Read to Play */
  { key: 'firstread', name: 'First Word', simple: 'I read a word!', icon: 'abc', col: '#ffe27a', test: (S) => S.wordsRead >= 1 },
  { key: 'words10', name: 'Ten Words', simple: 'I read 10 words!', icon: 'abc', col: '#bff08a', test: (S) => S.wordsRead >= 10 },
  { key: 'words30', name: 'Word Collector', simple: 'I read 30 words!', icon: 'abc', col: '#8fd75f', test: (S) => S.wordsRead >= 30 },
  { key: 'reader', name: 'Page Reader', simple: 'I read 5 pages!', icon: 'book', col: '#c9b6ff', test: (S) => S.readPages >= 5 },
  { key: 'mission', name: 'Read and Build', simple: 'I did 5 reading missions!', icon: 'star', col: '#ffd23f', test: (S) => S.readMissions >= 5 },
  { key: 'levelup', name: 'Level Up!', simple: 'My reading level went up!', icon: 'up', col: '#7fd0ff', test: (S) => S.events.has('readLevelUp') },
  { key: 'aloud', name: 'Out Loud', simple: 'I read out loud!', icon: 'mic', col: '#ffb0a0', test: (S) => S.events.has('readAloud') }
];

const Stickers = (function () {
  const KEY = 'castle.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), stones: 0, rooms: 0, named: 0, doors: 0, windows: 0, stainedCount: 0, tallest: 0, battlements: 0, water: 0, moatAround: false, drawbridges: 0, gates: 0, stairsUp: 0, items: {}, roomTypes: {}, horses: 0, dogs: 0, knights: 0, brushed: 0, garden: 0, furniture: 0, quests: 0, coins: 0, undos: 0, photos: 0, factsRead: 0, royalsDone: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
  for (const k of ITEM_KEYS) S.items[k] = 0; for (const k of ROOM_KEYS) S.roomTypes[k] = 0;
  const cache = new Map();

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (Array.isArray(o.unlocked)) unlocked = new Set(o.unlocked.filter(k => STICKERS.some(s => s.key === k)));
      saved = o && typeof o === 'object' ? o : {};
      saved.royals = Array.isArray(saved.royals) ? saved.royals.filter(f => ROYALS[f]) : [];
      S.royalsDone = saved.royals.length; S.photos = +o.photos || 0; S.factsRead = +o.factsRead || 0;
    } catch (e) { /* fresh */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ unlocked: [...unlocked], royals: saved.royals || [], photos: S.photos, factsRead: S.factsRead })); } catch (e) { /* full */ } }
  function mark(ev) { if (!S.events.has(ev)) { S.events.add(ev); check(); } }
  function note(key, v) { if (v > (S[key] || 0)) { S[key] = v; check(); } }
  function royalDone(sex) { const f = new Set(saved.royals || []); f.add(sex); saved.royals = [...f]; S.royalsDone = f.size; check(true); }
  function check(force) {
    let changed = !!force;
    for (const st of STICKERS) {
      if (unlocked.has(st.key)) continue;
      let ok = false; try { ok = st.test(S); } catch (e) { ok = false; }
      if (ok) { unlocked.add(st.key); changed = true; if (onUnlock) onUnlock(st); Bus.emit('sticker', st); }
    }
    if (changed) save();
  }
  function init(cb) {
    onUnlock = cb; load();
    for (const ev of ['feast', 'joust', 'swan', 'nightFall', 'snowfall', 'rain', 'visitor', 'market', 'fireworks', 'dragon', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('readLevel', (L, why) => { if (why === 'up') mark('readLevelUp'); });
    Bus.on('photo', () => { S.photos++; check(true); });
    Bus.on('factRead', () => { S.factsRead++; check(true); });
    Bus.on('readWord', (w, n) => note('wordsRead', n));
    Bus.on('readPage', (k, n) => note('readPages', n));
    Bus.on('missionDone', (k, n) => note('readMissions', n));
  }
  /* called every half second with the castle's summary */
  function watch(summary) {
    for (const k of ['stones', 'rooms', 'named', 'doors', 'windows', 'tallest', 'battlements', 'water', 'drawbridges', 'gates', 'stairsUp', 'horses', 'dogs', 'knights', 'brushed', 'garden', 'furniture', 'quests', 'coins', 'undos']) if (summary[k] !== undefined) S[k] = Math.max(S[k] || 0, summary[k]);
    S.moatAround = S.moatAround || summary.moatAround; S.items = summary.items; S.roomTypes = summary.roomTypes;
    S.stainedCount = Math.max(S.stainedCount, summary.stained || 0);
    check();
  }
  function has(key) { return unlocked.has(key); }
  function count() { return unlocked.size; }
  function all() { return STICKERS; }

  function draw(ctx, st, px, locked) {
    ctx.save();
    ctx.translate(px / 2, px / 2);
    const r = px * .46;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r2 = r * (1 + .045 * Math.sin(a * 12)); i ? ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2) : ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2); }
    ctx.closePath();
    ctx.fillStyle = locked ? '#d9d6cc' : st.col; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = px * .03; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .84, 0, TAU);
    ctx.fillStyle = locked ? '#eeece6' : 'rgba(255,255,255,.75)'; ctx.fill();
    ctx.clip();
    if (locked) { ctx.globalAlpha = .35; ctx.filter = 'grayscale(1)'; }
    ctx.scale(px / 100, px / 100);
    ctx.scale(.78, .78);
    drawIcon(ctx, st.icon);
    ctx.restore();
  }
  function drawIcon(ctx, icon) {
    switch (icon) {
      case 'abc': ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c0392b'; ctx.fillText('a', -18, 0); ctx.fillStyle = '#2a6fb8'; ctx.fillText('b', 0, -4); ctx.fillStyle = '#2f7a3a'; ctx.fillText('c', 18, 0); break;
      case 'up': ctx.fillStyle = '#2a6fb8'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(24, 0); ctx.lineTo(9, 0); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-9, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); break;
      case 'mic': ctx.fillStyle = '#4a4a6a'; rr(ctx, -10, -30, 20, 36, 10); ctx.fill(); ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI); ctx.moveTo(0, 13); ctx.lineTo(0, 28); ctx.stroke(); break;
      default: Sprites.drawIcon(ctx, icon);
    }
  }
  function image(st, px, locked) {
    const key = `${st.key}|${px}|${locked}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = px * 2;
    const ctx = c.getContext('2d'); ctx.scale(2, 2);
    draw(ctx, st, px, locked);
    cache.set(key, c);
    return c;
  }
  function reset() { unlocked = new Set(); save(); }

  return { init, check, watch, has, count, all, image, draw, note, mark, royalDone, reset, stats: S };
})();
