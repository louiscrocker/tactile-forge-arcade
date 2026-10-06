/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `redcrab.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Splash!', simple: 'I hatched in the sea!', icon: 'zoea', col: '#bfe8ff', test: (S) => S.events.has('hatched') },
  { key: 'plankton', name: 'Plankton Feast', simple: 'I ate 30 bits of plankton!', icon: 'plankton', col: '#c9f2c0', test: (S) => S.plankton >= 30 },
  { key: 'copepod', name: 'Copepod Catcher', simple: 'I caught a jumpy copepod!', icon: 'copepod', col: '#ffe0b0', test: (S) => S.copepods >= 1 },
  { key: 'glow', name: 'Glowing Sea', simple: 'I made the plankton glow!', icon: 'plankton', col: '#8ee8ff', test: (S) => S.glow >= 1 },
  { key: 'zoea3', name: 'Zoea III', simple: 'I moulted twice at sea!', icon: 'zoea', col: '#ffd9e6', test: (S) => S.events.has('zoea3') },
  { key: 'dash', name: 'Tail Flick', simple: 'I dashed with a flick of my tail!', icon: 'zoea', col: '#d9f0ff', test: (S) => S.dashes >= 3 },
  { key: 'fish', name: 'Fish Dodger', simple: 'A school of fish swam past me!', icon: 'fish', col: '#c8d8e8', test: (S) => S.events.has('schoolGone') },
  { key: 'whale', name: 'Whale Shark!', simple: 'I saw the biggest fish in the world!', icon: 'whaleshark', col: '#9ec8ff', test: (S) => S.events.has('whalePassed') },
  { key: 'megalopa', name: 'Megalopa', simple: 'I grew claws and a tail!', icon: 'megalopa', col: '#ffc8b0', test: (S) => S.events.has('megalopa') },
  { key: 'jelly', name: 'Jellyfish Taxi', simple: 'I rode a jellyfish!', icon: 'jelly', col: '#e0d6ff', test: (S) => S.rides >= 1 },
  { key: 'ashore', name: 'Out of the Sea', simple: 'I crawled out onto the rocks!', icon: 'baby', col: '#ffb0a0', test: (S) => S.events.has('ashore') },
  { key: 'cliff', name: 'Cliff Climber', simple: 'I climbed the cliff!', icon: 'cliff', col: '#d9d2c4', test: (S) => S.events.has('forest') },
  { key: 'shade', name: 'Shade Seeker', simple: 'I hid from the hot sun!', icon: 'rock', col: '#a8e0ff', test: (S) => S.shelters >= 1 },
  { key: 'bird', name: 'Close Call', simple: 'A seabird swooped and missed!', icon: 'bird', col: '#b8c0d8', test: (S) => S.events.has('birdMissed') },
  { key: 'forest', name: 'Rainforest', simple: 'I reached the forest!', icon: 'forest', col: '#9ae0a0', test: (S) => S.events.has('forest') },
  { key: 'leaf', name: 'Leaf Muncher', simple: 'I ate 10 fallen leaves!', icon: 'leaf', col: '#e8c87a', test: (S) => S.leaves >= 10 },
  { key: 'flower', name: 'Flower Snack', simple: 'I ate a flower!', icon: 'flower', col: '#ffc8d8', test: (S) => S.flowers >= 1 },
  { key: 'fig', name: 'Fig Feast', simple: 'I ate a fig!', icon: 'fruit', col: '#e0a0e0', test: (S) => S.fruits >= 1 },
  { key: 'seedling', name: 'Gardener', simple: 'I ate a seedling: crabs shape the forest!', icon: 'seedling', col: '#b7e36a', test: (S) => S.seedlings >= 1 },
  { key: 'burrow', name: 'Burrow Digger', simple: 'I dug a burrow!', icon: 'burrow', col: '#d9a86a', test: (S) => S.events.has('deepEnough') },
  { key: 'moult', name: 'New Shell', simple: 'I moulted in my burrow!', icon: 'shell', col: '#ffe9a8', test: (S) => S.events.has('crabMolted') },
  { key: 'robber', name: 'Hide and Seek', simple: 'The robber crab did not find me!', icon: 'robber', col: '#c8b8ff', test: (S) => S.events.has('robberHid') },
  { key: 'adult', name: 'Grown Up', simple: 'I grew into an adult crab!', icon: 'adult', col: '#ff9a8a', test: (S) => S.instar >= 4 },
  { key: 'big', name: 'Big Red', simple: 'My shell grew to 10 cm!', icon: 'claw', col: '#ffd23f', test: (S) => S.cm >= 10 },
  { key: 'rain', name: 'First Rain', simple: 'The first big rain came!', icon: 'rain', col: '#7fc4ff', test: (S) => S.events.has('migrate') },
  { key: 'bridge', name: 'Crab Bridge', simple: 'I crossed the crab bridge!', icon: 'bridge', col: '#c9d4dc', test: (S) => S.events.has('bridge') },
  { key: 'march', name: 'The Great March', simple: 'I marched all the way to the sea!', icon: 'march', col: '#ff8a6a', test: (S) => S.events.has('dipped') },
  { key: 'dip', name: 'Sea Dip', simple: 'I dipped in the sea!', icon: 'sea', col: '#7fd0ff', test: (S) => S.dips >= 1 },
  { key: 'push', name: 'Claw to Claw', simple: 'I had a pushing contest!', icon: 'rival', col: '#ffb070', test: (S) => S.events.has('shove') },
  { key: 'win', name: 'Victory!', simple: 'I won a push!', icon: 'claw', col: '#ffcf40', test: (S) => S.wins >= 1 },
  { key: 'king', name: 'King of the Terrace', simple: 'I kept my burrow by the sea!', icon: 'king', col: '#ffd23f', test: (S) => S.events.has('king') },
  { key: 'tryagain', name: 'Try Again', simple: 'I got pushed over and tried again!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('tossedDown') && S.wins >= 1 },
  { key: 'brood', name: 'Egg Keeper', simple: 'I kept my eggs safe in my burrow!', icon: 'female', col: '#ffc8e0', test: (S) => S.events.has('broodDone') },
  { key: 'release', name: '100,000 Eggs', simple: 'I shook my eggs into the sea!', icon: 'eggs', col: '#f4a6c0', test: (S) => S.events.has('eggsReleased') },
  { key: 'gen2', name: 'Next Generation', simple: 'The eggs hatched into new zoea!', icon: 'egg', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been all three colours of crab!', icon: 'crab', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy crab and a girl crab!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'redcrab.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), plankton: 0, copepods: 0, glow: 0, dashes: 0, rides: 0, shelters: 0, leaves: 0, flowers: 0, fruits: 0, seedlings: 0, instar: 0, cm: 0, dips: 0, wins: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
  const cache = new Map();

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (Array.isArray(o.unlocked)) unlocked = new Set(o.unlocked.filter(k => STICKERS.some(s => s.key === k)));
      saved = o && typeof o === 'object' ? o : {};
      saved.forms = Array.isArray(saved.forms) ? saved.forms.filter(f => FORMS[f]) : [];
      saved.sexes = Array.isArray(saved.sexes) ? saved.sexes.filter(f => SEXES[f]) : [];
      S.formsDone = saved.forms.length; S.sexesDone = saved.sexes.length; S.photos = +o.photos || 0; S.factsRead = +o.factsRead || 0;
    } catch (e) { /* fresh */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ unlocked: [...unlocked], forms: saved.forms || [], sexes: saved.sexes || [], photos: S.photos, factsRead: S.factsRead })); } catch (e) { /* full */ } }
  function note(key, v) { if (v > (S[key] || 0)) { S[key] = v; check(); } }
  function mark(ev) { if (!S.events.has(ev)) { S.events.add(ev); check(); } }
  function setGeneration(g) { S.generation = Math.max(S.generation, g); check(); }
  /* a crab of this colour and sex has reached the forest */
  function lifeDone(form, sex) {
    const f = new Set(saved.forms || []); f.add(form); saved.forms = [...f]; S.formsDone = f.size;
    const x = new Set(saved.sexes || []); x.add(sex); saved.sexes = [...x]; S.sexesDone = x.size;
    check(true);
  }
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
    for (const ev of ['hatched', 'zoea3', 'schoolGone', 'whalePassed', 'megalopa', 'ashore', 'forest', 'deepEnough', 'crabMolted', 'migrate', 'bridge', 'dipped', 'shove', 'king', 'tossedDown', 'broodDone', 'eggsReleased', 'microscope', 'readAloud', 'birdMissed', 'robberHid']) Bus.on(ev, () => mark(ev));
    Bus.on('readLevel', (L, why) => { if (why === 'up') mark('readLevelUp'); });
    Bus.on('photo', () => { S.photos++; check(true); });
    Bus.on('factRead', () => { S.factsRead++; check(true); });
    Bus.on('readWord', (w, n) => note('wordsRead', n));
    Bus.on('readPage', (k, n) => note('readPages', n));
    Bus.on('missionDone', (k, n) => note('readMissions', n));
  }
  /* called every half second with the player's numbers */
  function watch(p) {
    const st = p.stats;
    for (const k of ['plankton', 'copepods', 'glow', 'dashes', 'rides', 'shelters', 'leaves', 'flowers', 'fruits', 'seedlings', 'dips', 'wins']) note(k, st[k]);
    if (p.stage === 'crab') { note('instar', p.instar); note('cm', p.cm); }
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
    if (locked) { ctx.globalAlpha = .35; ctx.filter = 'grayscale(1)'; }
    ctx.scale(px / 100, px / 100);
    ctx.scale(.8, .8);
    drawIcon(ctx, st.icon);
    ctx.restore();
  }
  function drawIcon(ctx, icon) {
    switch (icon) {
      case 'scope': ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-6, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(14, 30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(22, 30); ctx.stroke(); ctx.fillStyle = '#4a4a6a'; ctx.beginPath(); ctx.arc(-6, -30, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(-6, 16, 7, 0, TAU); ctx.fill(); break;
      case 'camera': ctx.fillStyle = '#4a4a6a'; rr(ctx, -30, -18, 60, 40, 8); ctx.fill(); ctx.fillRect(-14, -26, 22, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 2, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#3fb0e6'; ctx.beginPath(); ctx.arc(2, 2, 8, 0, TAU); ctx.fill(); break;
      case 'abc': ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c0392b'; ctx.fillText('a', -18, 0); ctx.fillStyle = '#2a6fb8'; ctx.fillText('b', 0, -4); ctx.fillStyle = '#2f7a3a'; ctx.fillText('c', 18, 0); break;
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'up': ctx.fillStyle = '#2a6fb8'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(24, 0); ctx.lineTo(9, 0); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-9, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); break;
      case 'mic': ctx.fillStyle = '#4a4a6a'; rr(ctx, -10, -30, 20, 36, 10); ctx.fill(); ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI); ctx.moveTo(0, 13); ctx.lineTo(0, 28); ctx.stroke(); break;
      case 'book': ctx.fillStyle = '#e0392f'; rr(ctx, -28, -24, 56, 48, 5); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -22, -18, 44, 36, 3); ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; for (let y = -8; y <= 8; y += 8) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); } break;
      default: Sprites.drawIcon(ctx, icon, 100);
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

  return { init, check, watch, has, count, all, image, draw, note, mark, setGeneration, lifeDone, reset, stats: S };
})();
