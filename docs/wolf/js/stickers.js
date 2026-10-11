/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `wolf.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'milk', name: 'Milk!', simple: 'I drank my first milk!', icon: 'milk', col: '#fff4e0', test: (S) => S.drinks >= 1 },
  { key: 'eyes', name: 'Blue Eyes', simple: 'My eyes opened!', icon: 'eyes', col: '#bfe0ff', test: (S) => S.events.has('eyesOpen') },
  { key: 'out', name: 'Into the Light', simple: 'I came out of the den!', icon: 'pup', col: '#ffe9a8', test: (S) => S.age >= 2 },
  { key: 'play', name: 'Play Bow', simple: 'I played with my litter-mates!', icon: 'pups', col: '#c9f2c0', test: (S) => S.plays >= 1 },
  { key: 'win', name: 'Top Pup', simple: 'I won a play-fight!', icon: 'pup', col: '#ffcf40', test: (S) => S.wins >= 1 },
  { key: 'tryagain', name: 'Up Again', simple: 'I got bowled over and got right up!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('tossedDown') },
  { key: 'yip', name: 'First Yip', simple: 'I howled for the first time!', icon: 'howl', col: '#d9f0ff', test: (S) => S.howls >= 1 },
  { key: 'raven', name: 'Wolf Bird', simple: 'A raven came to play!', icon: 'raven', col: '#c8c8d8', test: (S) => S.events.has('ravenNear') },
  { key: 'meal', name: 'Meal Time', simple: 'A grown-up brought me a meal!', icon: 'meal', col: '#e8c87a', test: (S) => S.meals >= 1 },
  { key: 'meals5', name: 'Hungry Pup', simple: 'I ate five meals!', icon: 'dad', col: '#ffb070', test: (S) => S.meals >= 5 },
  { key: 'meadow', name: 'Summer Meadow', simple: 'The pack moved me to the meadow!', icon: 'meadow', col: '#b7e36a', test: (S) => S.age >= 3 },
  { key: 'pounce', name: 'Pounce!', simple: 'I pounced on a grasshopper!', icon: 'grasshopper', col: '#c9f2c0', test: (S) => S.pounces >= 1 },
  { key: 'pounce8', name: 'Grasshopper Chaser', simple: 'I pounced eight times. They all got away!', icon: 'grasshopper', col: '#8fd75f', test: (S) => S.pounces >= 8 },
  { key: 'storm', name: 'Storm Shelter', simple: 'I waited out a storm under a tree!', icon: 'storm', col: '#b8c0d8', test: (S) => S.shelters >= 1 },
  { key: 'sniff', name: 'Super Nose', simple: 'I sniffed a scent on the breeze!', icon: 'scent', col: '#ffe0b0', test: (S) => S.sniffs >= 1 },
  { key: 'scents', name: 'Scent Reader', simple: 'I know four different smells!', icon: 'nose', col: '#f0c890', test: (S) => S.scents >= 4 },
  { key: 'travel', name: 'On the Move', simple: 'I travelled with the pack!', icon: 'pack', col: '#d9d2c4', test: (S) => S.events.has('travel') },
  { key: 'tracks', name: 'Tracker', simple: 'I read some tracks!', icon: 'tracks', col: '#d9c8a8', test: (S) => S.looks >= 1 },
  { key: 'tracks4', name: 'Master Tracker', simple: 'I know four kinds of tracks!', icon: 'paw', col: '#c8a878', test: (S) => S.tracks >= 4 },
  { key: 'swim', name: 'Swimmer', simple: 'I swam across the river!', icon: 'river', col: '#7fd0ff', test: (S) => S.events.has('swimStart') },
  { key: 'post', name: 'Our Place', simple: 'I sniffed the scent post at the edge!', icon: 'post', col: '#d9d6cc', test: (S) => S.events.has('firstPost') },
  { key: 'found', name: 'Lost and Found', simple: 'I howled and the pack found me!', icon: 'howl', col: '#ffe27a', test: (S) => S.events.has('packFound') },
  { key: 'snow', name: 'First Snow', simple: 'Winter came!', icon: 'snow', col: '#eef4ff', test: (S) => S.events.has('winterCame') },
  { key: 'trail', name: 'In the Trail', simple: 'I walked in the trail the pack broke!', icon: 'snow', col: '#cfe4ff', test: (S) => S.trailSteps >= 4 },
  { key: 'warm', name: 'Warm Nose', simple: 'I curled up with my tail over my nose!', icon: 'tail', col: '#ffd8c0', test: (S) => S.rests >= 1 },
  { key: 'chase', name: 'The Chase', simple: 'I ran with the pack at the herd!', icon: 'elk', col: '#ffb070', test: (S) => S.chases >= 1 },
  { key: 'feast', name: 'Full Belly', simple: 'The pack had a feast!', icon: 'pack', col: '#ffcf70', test: (S) => S.events.has('feast') },
  { key: 'collar', name: 'Radio Collar', simple: 'I met the wolf scientist!', icon: 'antenna', col: '#c9d4dc', test: (S) => S.events.has('biologistMet') },
  { key: 'yearling', name: 'One Year Old', simple: 'I am a yearling!', icon: 'yearling', col: '#9ae0a0', test: (S) => S.age >= 4 },
  { key: 'babysit', name: 'Babysitter', simple: 'I played with the new pups!', icon: 'pups', col: '#ffc8d8', test: (S) => S.events.has('babysat') },
  { key: 'watch', name: 'Keeping Watch', simple: 'I kept watch at the den!', icon: 'den', col: '#d9a86a', test: (S) => S.guards >= 1 },
  { key: 'lone', name: 'Lone Wolf', simple: 'I left home to find my own place!', icon: 'lone', col: '#a8b8d8', test: (S) => S.events.has('dispersed') },
  { key: 'tunnel', name: 'Safe Crossing', simple: 'I went under the road in the tunnel!', icon: 'tunnel', col: '#c9c4b8', test: (S) => S.events.has('underpass') },
  { key: 'mate', name: 'A Pair', simple: 'I found my mate!', icon: 'mate', col: '#ffc8e0', test: (S) => S.events.has('met') },
  { key: 'mark', name: 'Scent Marker', simple: 'I marked a scent post!', icon: 'post', col: '#ffe9a0', test: (S) => S.marks >= 1 },
  { key: 'valley', name: 'Our Valley', simple: 'We howled together and claimed the valley!', icon: 'valley', col: '#9ec8ff', test: (S) => S.events.has('claimed') },
  { key: 'den', name: 'Den Digger', simple: 'I dug a den for the pups!', icon: 'den', col: '#d9a86a', test: (S) => S.events.has('denMade') },
  { key: 'bring', name: 'Food for the Den', simple: 'I brought a meal home!', icon: 'meal', col: '#e8c87a', test: (S) => S.mealsGiven >= 1 },
  { key: 'guard', name: 'Den Guard', simple: 'I barked a raven away from the den!', icon: 'raven', col: '#b8c0d8', test: (S) => S.barks >= 1 },
  { key: 'nurse', name: 'Milk for Pups', simple: 'I fed my pups!', icon: 'milk', col: '#fff4e0', test: (S) => S.nurses >= 1 },
  { key: 'carry', name: 'Carried Home', simple: 'I carried a wandering pup home!', icon: 'pup', col: '#ffd0e0', test: (S) => S.carries >= 1 },
  { key: 'parent', name: 'A New Pack', simple: 'My pups came out of the den!', icon: 'parent', col: '#ff9a8a', test: (S) => S.events.has('generationDone') },
  { key: 'big', name: 'Big Wolf', simple: 'I weigh 48 kilos!', icon: 'wolf', col: '#ffd23f', test: (S) => S.kg >= 48 },
  { key: 'gen2', name: 'Next Generation', simple: 'I am one of the new pups!', icon: 'newborn', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been gray, black and white!', icon: 'wolf', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy wolf and a girl wolf!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'wolf.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), drinks: 0, meals: 0, plays: 0, wins: 0, howls: 0, pounces: 0, sniffs: 0, scents: 0, looks: 0, tracks: 0, marks: 0, chases: 0, mealsGiven: 0, barks: 0, nurses: 0, carries: 0, shelters: 0, rests: 0, guards: 0, trailSteps: 0, age: 0, kg: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a wolf of this colour and sex has grown into a yearling */
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
    for (const ev of ['eyesOpen', 'tossedDown', 'ravenNear', 'travel', 'swimStart', 'firstPost', 'packFound', 'winterCame', 'feast', 'biologistMet', 'babysat', 'dispersed', 'underpass', 'met', 'claimed', 'denMade', 'generationDone', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
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
    for (const k of ['drinks', 'meals', 'plays', 'wins', 'howls', 'pounces', 'sniffs', 'looks', 'marks', 'chases', 'mealsGiven', 'barks', 'nurses', 'carries', 'shelters', 'rests', 'guards', 'trailSteps']) note(k, st[k]);
    note('scents', p.learned.scents.length); note('tracks', p.learned.tracks.length);
    note('age', p.age); note('kg', p.kg);
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
