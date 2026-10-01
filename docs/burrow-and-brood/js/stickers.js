/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser.  Every sticker is also a picture, so a child who is
   still learning to read can collect them without the words.
   (Same engine as Ladybug Life; the hub reads `antkingdom.stickers`.)
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'landed', name: 'Touchdown', simple: 'I landed!', icon: 'alate', col: '#bfe3ff', test: (S) => S.events.has('landed') },
  { key: 'founded', name: 'A Room of My Own', simple: 'I dug my first room!', icon: 'room', col: '#d9a86a', test: (S) => S.events.has('founded') },
  { key: 'eggs', name: 'First Eggs', simple: 'I laid eggs!', icon: 'egg', col: '#fff3c0', test: (S) => S.events.has('eggsLaid') },
  { key: 'mother', name: 'Good Mother', simple: 'I fed my babies!', icon: 'larva', col: '#ffd9a0', test: (S) => S.queenFed >= 3 },
  { key: 'worker', name: 'Worker Ant', simple: 'I am a worker!', icon: 'worker', col: '#8fd75f', test: (S) => S.events.has('firstWorker') },
  { key: 'ten', name: 'Ten Ants', simple: 'We are 10 ants!', icon: 'ten', col: '#c9f27a', test: (S) => S.stage >= 2 },
  { key: 'hundred', name: 'One Hundred', simple: 'We are 100 ants!', icon: 'hundred', col: '#7dd3a0', test: (S) => S.stage >= 3 },
  { key: 'thousand', name: 'One Thousand', simple: 'We are 1,000 ants!', icon: 'thousand', col: '#f0c47a', test: (S) => S.stage >= 4 },
  { key: 'kingdom', name: 'Mighty Colony', simple: 'We are 5,000 ants!', icon: 'kingdom', col: '#ffd23f', test: (S) => S.stage >= 5 },
  { key: 'flight', name: 'Flying Ant Day', simple: 'New queens flew away!', icon: 'alate', col: '#a9dcff', test: (S) => S.events.has('flightDone') },
  { key: 'digger', name: 'Digger', simple: 'I dug lots of dirt!', icon: 'dirt', col: '#c9a06a', test: (S) => S.dug >= 200 },
  { key: 'deep', name: 'Deep Down', simple: 'I went deep, deep down!', icon: 'tunnel', col: '#9a7a5a', test: (S) => S.deepest >= 700 },
  { key: 'hill', name: 'Hill Builder', simple: 'I made the ant hill bigger!', icon: 'hill', col: '#e0b080', test: (S) => S.spoil >= 5 },
  { key: 'forager', name: 'Food Finder', simple: 'I brought food home!', icon: 'seed', col: '#b7e36a', test: (S) => S.food >= 1 },
  { key: 'pantry', name: 'Full Pantry', simple: 'I brought home 20 foods!', icon: 'crumb', col: '#f6d743', test: (S) => S.food >= 20 },
  { key: 'farmer', name: 'Aphid Farmer', simple: 'I got honeydew!', icon: 'honeydew', col: '#ffe27a', test: (S) => S.milked >= 1 },
  { key: 'dairy', name: 'Big Farmer', simple: '10 drops of honeydew!', icon: 'aphid', col: '#d7f0a8', test: (S) => S.milked >= 10 },
  { key: 'guard', name: 'Guard Ant', simple: 'I chased off the larva!', icon: 'ladylarva', col: '#ff9a8a', test: (S) => S.shooed >= 1 },
  { key: 'team', name: 'Teamwork', simple: 'We carried a beetle together!', icon: 'bug', col: '#9ab8e0', test: (S) => S.bigFood >= 1 },
  { key: 'caller', name: 'Call for Help', simple: 'My sisters came to help!', icon: 'call', col: '#ffcf70', test: (S) => S.events.has('help') },
  { key: 'nurse', name: 'Nurse', simple: 'I fed a larva!', icon: 'larva', col: '#f7a8c4', test: (S) => S.workerFed >= 1 },
  { key: 'rescue', name: 'Rescuer', simple: 'I saved a baby from the rain!', icon: 'rain', col: '#7fc4ff', test: (S) => S.rescued >= 1 },
  { key: 'queenfed', name: 'Queen\'s Helper', simple: 'I fed the queen!', icon: 'queen', col: '#ffd0e0', test: (S) => S.events.has('fedQueen') },
  { key: 'climber', name: 'Top of the Plant', simple: 'I climbed to the top!', icon: 'plant', col: '#a6e05a', test: (S) => S.highest >= 900 },
  { key: 'worm', name: 'Worm Friend', simple: 'I met the earthworm!', icon: 'worm', col: '#ffc8d0', test: (S) => S.events.has('worm') },
  { key: 'winter', name: 'Winter Rest', simple: 'We slept through winter!', icon: 'snow', col: '#e6f2ff', test: (S) => S.events.has('colonySpring') },
  { key: 'jobs', name: 'Boss of Nobody', simple: 'I asked ants to change jobs!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('boost') },
  { key: 'species', name: 'Collector', simple: 'I have been 3 kinds of ant!', icon: 'collect', col: '#ffcf70', test: (S) => S.speciesDone >= 3 },
  { key: 'gen2', name: 'New Kingdom', simple: 'My princess started a new kingdom!', icon: 'kingdom', col: '#f4a6c0', test: (S) => S.generation >= 2 },
  { key: 'scientist', name: 'Scientist', simple: 'I used the microscope!', icon: 'scope', col: '#c9b6ff', test: (S) => S.events.has('microscope') },
  { key: 'photo', name: 'Photographer', simple: 'I took a photo!', icon: 'camera', col: '#ffffff', test: (S) => S.photos >= 1 },
  { key: 'bookworm', name: 'Bookworm', simple: 'I read 10 facts!', icon: 'book', col: '#f6d743', test: (S) => S.factsRead >= 10 },
  /* Read to Play */
  { key: 'firstread', name: 'First Word', simple: 'I read a word!', icon: 'abc', col: '#ffe27a', test: (S) => S.wordsRead >= 1 },
  { key: 'words10', name: 'Ten Words', simple: 'I read 10 words!', icon: 'abc', col: '#bff08a', test: (S) => S.wordsRead >= 10 },
  { key: 'words30', name: 'Word Collector', simple: 'I read 30 words!', icon: 'abc', col: '#8fd75f', test: (S) => S.wordsRead >= 30 },
  { key: 'reader', name: 'Page Reader', simple: 'I read 5 pages!', icon: 'book', col: '#c9b6ff', test: (S) => S.readPages >= 5 },
  { key: 'mission', name: 'Read and Do', simple: 'I did 5 reading missions!', icon: 'star', col: '#ffd23f', test: (S) => S.readMissions >= 5 },
  { key: 'levelup', name: 'Level Up!', simple: 'My reading level went up!', icon: 'up', col: '#7fd0ff', test: (S) => S.events.has('readLevelUp') },
  { key: 'aloud', name: 'Out Loud', simple: 'I read out loud!', icon: 'mic', col: '#ffb0a0', test: (S) => S.events.has('readAloud') }
];

const Stickers = (function () {
  const KEY = 'antkingdom.stickers';
  let unlocked = new Set();
  const S = { events: new Set(), queenFed: 0, stage: 0, dug: 0, deepest: 0, spoil: 0, food: 0, milked: 0, shooed: 0, bigFood: 0, workerFed: 0, rescued: 0, highest: 0, speciesDone: 0, generation: 1, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
  let speciesSet = new Set();
  const cache = new Map();
  let onUnlock = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || '{}');
      unlocked = new Set(d.unlocked || []);
      speciesSet = new Set(d.species || []);
      Object.assign(S, d.stats || {}); S.events = new Set(d.events || []);
    } catch (e) { /* fine */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ unlocked: [...unlocked], species: [...speciesSet], stats: Object.assign({}, S, { events: undefined }), events: [...S.events] })); } catch (e) { /* fine */ }
  }
  const mine = (p) => p && p.isPlayer;

  function init(cb) {
    onUnlock = cb;
    load();
    for (const ev of ['landed', 'founded', 'eggsLaid', 'firstWorker', 'flightDone', 'help', 'fedQueen', 'colonySpring', 'microscope', 'boost', 'worm']) Bus.on(ev, () => mark(ev));
    Bus.on('founded', () => { const G = window.G; if (G) { speciesSet.add(G.settings.species); S.speciesDone = speciesSet.size; } check(); });
    Bus.on('fedLarva', () => { const G = window.G; if (!G) return; const p = G.players[0]; if (p && p.caste === 'queen') S.queenFed++; check(); });
    Bus.on('act', (p, verb) => { if (verb === 'feed' && p.caste === 'worker') { S.workerFed++; check(); } });
    Bus.on('stage', (st) => { S.stage = Math.max(S.stage, st); check(); });
    Bus.on('dug', (p, n) => { if (mine(p)) { S.dug += n; if (S.dug % 20 < n) check(); } });
    Bus.on('spoil', (p) => { if (mine(p)) { S.spoil++; check(); } });
    Bus.on('stored', (kind, k, who) => { if (who === 'player') { S.food++; check(); } });
    Bus.on('act', (p, verb) => { if (verb === 'milk') { S.milked++; check(); } });
    Bus.on('enemyShooed', () => { const G = window.G; if (G && G.players[0] && G.players[0].stats.bites > 0) { S.shooed++; check(); } });
    Bus.on('bigFood', (f, n) => { if (f.carriers && f.carriers.some(c => c.isPlayer) || (f._player)) { S.bigFood++; check(); } });
    Bus.on('broodMoved', (p, b) => { if (b.wasWet) { S.rescued++; check(); } });
    Bus.on('photo', () => { S.photos++; check(); });
    Bus.on('factRead', () => { S.factsRead++; check(); });
    Bus.on('readWord', (w, n) => { if (n > S.wordsRead) { S.wordsRead = n; check(); } });
    Bus.on('readPage', (k, n) => { S.readPages = Math.max(S.readPages, n); check(); });
    Bus.on('missionDone', (k, n) => { S.readMissions = Math.max(S.readMissions, n); check(); });
    Bus.on('readLevel', (L, why) => { if (why === 'up') mark('readLevelUp'); });
    Bus.on('readAloud', () => mark('readAloud'));
  }
  /* numbers the game updates now and then (depth, height) */
  function note(key, v) { if (v > (S[key] || 0)) { S[key] = v; check(); } }
  function setGeneration(g) { S.generation = Math.max(S.generation, g); check(); }
  function mark(ev) { S.events.add(ev); check(); }
  function check() {
    for (const st of STICKERS) {
      if (unlocked.has(st.key)) continue;
      let ok = false;
      try { ok = st.test(S); } catch (e) { ok = false; }
      if (ok) { unlocked.add(st.key); if (onUnlock) onUnlock(st); Bus.emit('sticker', st); }
    }
    save();
  }
  function has(key) { return unlocked.has(key); }
  function count() { return unlocked.size; }
  function all() { return STICKERS; }
  function reset() { unlocked = new Set(); save(); }

  /* ---------- drawing ---------- */
  function draw(ctx, st, px, locked) {
    ctx.save();
    ctx.translate(px / 2, px / 2);
    const r = px * .46;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, rr2 = r * (1 + .045 * Math.sin(a * 12)); i ? ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
    ctx.closePath();
    ctx.fillStyle = locked ? '#d9d6cc' : st.col; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = px * .03; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .84, 0, TAU);
    ctx.fillStyle = locked ? '#eeece6' : 'rgba(255,255,255,.75)'; ctx.fill();
    if (locked) { ctx.globalAlpha = .35; ctx.filter = 'grayscale(1)'; }
    ctx.scale(px / 100, px / 100);
    drawIcon(ctx, st.icon);
    ctx.restore();
  }
  function drawIcon(ctx, icon) {
    const sp = (window.G && window.G.speciesDef) ? window.G.speciesDef() : SPECIES.garden;
    switch (icon) {
      case 'room': ctx.fillStyle = '#8a6040'; rr(ctx, -34, -30, 68, 60, 10); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(0, 6, 26, 13, 0, 0, TAU); ctx.fill(); ctx.fillRect(-4, -30, 8, 26); Sprites.drawEggs(ctx, { s: 1.8, count: 5 }); break;
      case 'tunnel': ctx.fillStyle = '#8a6040'; rr(ctx, -34, -30, 68, 60, 10); ctx.fill(); ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(-26, 0, 0, 6); ctx.quadraticCurveTo(24, 12, 16, 30); ctx.stroke(); break;
      case 'hill': ctx.fillStyle = '#9a6a42'; ctx.beginPath(); ctx.moveTo(-34, 22); ctx.quadraticCurveTo(0, -46, 34, 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(0, -8, 5, 3.5, 0, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(14, 6); Sprites.drawAnt(ctx, { s: .8, sp, carry: 'soil', walk: 1 }); ctx.restore(); break;
      case 'call': ctx.strokeStyle = '#e0a020'; ctx.lineWidth = 4; for (const r of [14, 24, 34]) { ctx.globalAlpha = 1 - r / 44; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * .8, -Math.PI * .2); ctx.stroke(); } ctx.globalAlpha = 1; ctx.translate(-2, 14); Sprites.drawAnt(ctx, { s: 1.2, sp, walk: 1 }); break;
      case 'rain': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-10, -10, 16, 0, TAU); ctx.arc(10, -14, 18, 0, TAU); ctx.arc(20, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x - 5, 30); ctx.stroke(); } break;
      case 'snow': ctx.strokeStyle = '#3fb0e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.moveTo(-8, -20); ctx.lineTo(0, -12); ctx.lineTo(8, -20); ctx.moveTo(-8, 20); ctx.lineTo(0, 12); ctx.lineTo(8, 20); ctx.stroke(); ctx.restore(); } break;
      case 'plant': for (const [x, c] of [[-14, '#69a84a'], [8, '#4f8a33']]) { ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, -24); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x - 8, -6, 10, 5, -.6, 0, TAU); ctx.ellipse(x + 8, -14, 10, 5, .6, 0, TAU); ctx.fill(); } ctx.save(); ctx.translate(8, -30); ctx.rotate(-Math.PI / 2); Sprites.drawAnt(ctx, { s: .6, sp, walk: 1 }); ctx.restore(); break;
      case 'collect': Object.values(SPECIES).slice(0, 3).forEach((s, i) => { ctx.save(); ctx.translate(-4, -22 + i * 20); Sprites.drawAnt(ctx, { s: .85, sp: s, walk: i }); ctx.restore(); }); break;
      case 'scope': ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-6, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(14, 30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(22, 30); ctx.stroke(); ctx.fillStyle = '#4a4a6a'; ctx.beginPath(); ctx.arc(-6, -30, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(-6, 16, 7, 0, TAU); ctx.fill(); break;
      case 'camera': ctx.fillStyle = '#4a4a6a'; rr(ctx, -30, -18, 60, 40, 8); ctx.fill(); ctx.fillRect(-14, -26, 22, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 2, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#3fb0e6'; ctx.beginPath(); ctx.arc(2, 2, 8, 0, TAU); ctx.fill(); break;
      case 'abc': ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c0392b'; ctx.fillText('a', -18, 0); ctx.fillStyle = '#2a6fb8'; ctx.fillText('b', 0, -4); ctx.fillStyle = '#2f7a3a'; ctx.fillText('c', 18, 0); break;
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'up': ctx.fillStyle = '#2a6fb8'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(24, 0); ctx.lineTo(9, 0); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-9, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); break;
      case 'mic': ctx.fillStyle = '#4a4a6a'; rr(ctx, -10, -30, 20, 36, 10); ctx.fill(); ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI); ctx.moveTo(0, 13); ctx.lineTo(0, 28); ctx.stroke(); break;
      case 'book': ctx.fillStyle = '#e0392f'; rr(ctx, -28, -24, 56, 48, 5); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -22, -18, 44, 36, 3); ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; for (let y = -8; y <= 8; y += 8) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); } break;
      default: Sprites.drawIcon(ctx, icon, sp, 72);
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

  return { init, check, has, count, all, image, draw, note, setGeneration, reset, stats: S };
})();
