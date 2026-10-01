/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the collected stats; unlocked stickers persist in the
   browser.  Every sticker is a picture first, so a child who is
   still learning to read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'steps', name: 'First Steps', simple: 'I went for a walk!', icon: 'alicorn', col: '#ffd6ea', test: (S) => S.distance >= 400 },
  { key: 'flight', name: 'First Flight', simple: 'I flew!', icon: 'flight', col: '#bfe3ff', test: (S) => S.flights >= 1 },
  { key: 'gallop', name: 'Galloper', simple: 'I galloped far!', icon: 'gallop', col: '#c2f2dc', test: (S) => S.distance >= 6000 },
  { key: 'cloud', name: 'Cloud Hopper', simple: 'I stood on a cloud!', icon: 'cloud', col: '#e6f0ff', test: (S) => S.cloudLandings >= 1 },
  { key: 'skyhigh', name: 'Sky High', simple: 'I reached the Star Sky!', icon: 'glitter', col: '#4a4a8c', test: (S) => S.events.has('starsky') },
  { key: 'moon', name: 'Moon Walker', simple: 'I stood on the Moon!', icon: 'moonwalk', col: '#fff3b8', test: (S) => S.moon >= 1 },
  { key: 'flowers', name: 'Flower Friend', simple: 'I woke 10 flowers!', icon: 'flower', col: '#ffb3d0', test: (S) => S.flowers >= 10 },
  { key: 'stars25', name: 'Star Catcher', simple: 'I caught 25 stars!', icon: 'star', col: '#fff0a8', test: (S) => S.stars >= 25 },
  { key: 'stars100', name: 'Star Hoarder', simple: 'I caught 100 stars!', icon: 'stars3', col: '#ffe27a', test: (S) => S.stars >= 100 },
  { key: 'gems', name: 'Gem Hunter', simple: 'I found all 7 gems!', icon: 'gem', col: '#c9a5ff', test: (S) => S.gems >= 7 },
  { key: 'rainbow', name: 'Rainbow Maker', simple: 'I fixed the rainbow!', icon: 'rainbow', col: '#ffffff', test: (S) => S.quests.has('rainbow') },
  { key: 'butterfly', name: 'Butterfly Kisses', simple: 'I tickled 10 butterflies!', icon: 'butterfly', col: '#ffd6b3', test: (S) => S.butterflies >= 10 },
  { key: 'cheer', name: 'Cloud Cheerer', simple: 'I cheered up 3 grumpy clouds!', icon: 'stormcloud', col: '#d6dcff', test: (S) => S.cloudsCheered >= 3 },
  { key: 'lake', name: 'Lake Lights', simple: 'I lit the lake crystals!', icon: 'crystal', col: '#bff4ff', test: (S) => S.quests.has('crystals') },
  { key: 'lamb', name: 'Little Shepherd', simple: 'I took Puff home!', icon: 'lamb', col: '#ffffff', test: (S) => S.quests.has('lamb') },
  { key: 'dragon', name: 'Dragon Friend', simple: 'Ember can fly!', icon: 'dragon', col: '#ffc6b3', test: (S) => S.quests.has('ember') },
  { key: 'night', name: 'Night Flyer', simple: 'I flew at night!', icon: 'moon', col: '#8fa3ff', test: (S) => S.nightFly >= 20 },
  { key: 'dash', name: 'Speedster', simple: '10 rainbow dashes!', icon: 'dash', col: '#ffb347', test: (S) => S.dashes >= 10 },
  { key: 'rings', name: 'Ring Master', simple: 'I flew through 11 rings!', icon: 'ring', col: '#ff9ad4', test: (S) => S.rings >= 11 },
  { key: 'stargazer', name: 'Stargazer', simple: 'I lit the Unicorn stars!', icon: 'constellation', col: '#2a2a60', test: (S) => S.quests.has('moon') },
  { key: 'princess', name: 'Alicorn Princess', simple: 'I had a big party!', icon: 'party', col: '#ffd24a', test: (S) => S.quests.has('party') },
  { key: 'fashion', name: 'Fashionista', simple: 'I wore 3 things at once!', icon: 'fashion', col: '#ff8fb8', test: (S) => S.wearing >= 3 },
  { key: 'photo', name: 'Photographer', simple: 'I took a photo!', icon: 'camera', col: '#ffffff', test: (S) => S.photos >= 1 },
  { key: 'book', name: 'Bookworm', simple: 'I read 10 facts!', icon: 'book', col: '#f6d743', test: (S) => S.factsRead >= 10 },
  { key: 'sleep', name: 'Sleepyhead', simple: 'I had a nap under the stars!', icon: 'sleep', col: '#d6c4ff', test: (S) => S.sleeps >= 1 },
  { key: 'water', name: 'Water Dancer', simple: 'I walked on the lake!', icon: 'water', col: '#9fe0e8', test: (S) => S.water >= 1 },
  { key: 'friends', name: 'Best Friends', simple: 'I talked to everyone!', icon: 'friends', col: '#ffe9a8', test: (S) => S.talked >= 9 },
  { key: 'two', name: 'Better Together', simple: 'I played with a friend!', icon: 'twoplayer', col: '#bfe3ff', test: (S) => S.events.has('twoplayer') },
  { key: 'foal', name: 'New Baby', simple: 'I found a baby alicorn!', icon: 'foal', col: '#c2f2dc', test: (S) => S.events.has('foalAdopted') },
  { key: 'foalgrown', name: 'All Grown Up', simple: 'My foal grew up!', icon: 'foalgrown', col: '#9fe0e8', test: (S) => S.events.has('foalGrown') },
  { key: 'feeder', name: 'Apple Snacks', simple: 'I fed my foal 10 apples!', icon: 'apple', col: '#ffc6c6', test: (S) => S.fed >= 10 },
  { key: 'groomer', name: 'Shiny Coat', simple: 'I brushed my foal 5 times!', icon: 'salon', col: '#e9c6f5', test: (S) => S.brushed >= 5 },
  { key: 'decorator', name: 'Home Sweet Home', simple: 'I decorated the stable!', icon: 'stable', col: '#ffd6ea', test: (S) => S.homeItems >= 4 },
  { key: 'diver', name: 'Deep Diver', simple: 'I swam under the lake!', icon: 'swim', col: '#9fe0ff', test: (S) => S.events.has('dive') },
  { key: 'pearls', name: 'Pearl Finder', simple: 'I found Marina\'s pearls!', icon: 'mermaid', col: '#d6f5ff', test: (S) => S.quests.has('mermaid') },
  { key: 'skater', name: 'Ice Skater', simple: 'I skated on the ice!', icon: 'skate', col: '#e6f6ff', test: (S) => S.events.has('skate') },
  { key: 'seasons', name: 'All Year Round', simple: 'I saw all 4 seasons!', icon: 'snowman', col: '#fff3b8', test: (S) => S.seasons >= 4 },
  { key: 'racer', name: 'Race Winner', simple: 'I won a race!', icon: 'trophy', col: '#ffe27a', test: (S) => S.raceWins >= 1 },
  { key: 'champ', name: 'Champion', simple: 'I won 5 races!', icon: 'dash', col: '#ffb347', test: (S) => S.raceWins >= 5 },
  { key: 'counter', name: 'Counting Star', simple: 'I counted apples 3 times!', icon: 'basket', col: '#ffd6b3', test: (S) => S.counted >= 3 },
  { key: 'words', name: 'Word Wizard', simple: 'I spelled 3 words!', icon: 'letters', col: '#c9a5ff', test: (S) => S.words >= 3 },
  { key: 'painter', name: 'Little Artist', simple: 'I painted my cutie mark!', icon: 'paint', col: '#fff0a8', test: (S) => S.events.has('painted') },
  { key: 'stylist', name: 'New Hairdo', simple: 'I went to the salon!', icon: 'salon', col: '#ffc6da', test: (S) => S.events.has('salon') },
  /* Read to Play */
  { key: 'firstread', name: 'First Page', simple: 'I read a page!', icon: 'book', col: '#f3e6ff', test: (S) => S.readPages >= 1 },
  { key: 'words10', name: 'Ten Words', simple: 'I read 10 words!', icon: 'letters', col: '#fff3b0', test: (S) => S.readWords >= 10 },
  { key: 'words30', name: 'Thirty Words', simple: 'I read 30 words!', icon: 'letters', col: '#d8f5c8', test: (S) => S.readWords >= 30 },
  { key: 'reader', name: 'Story Reader', simple: 'I read 10 pages!', icon: 'book', col: '#ffd6ea', test: (S) => S.readPages >= 10 },
  { key: 'mission', name: 'Read and Do', simple: 'I did a reading mission!', icon: 'star', col: '#fff0a8', test: (S) => S.readMissions >= 1 },
  { key: 'levelup', name: 'Level Up!', simple: 'I moved up a reading level!', icon: 'rainbow', col: '#c9e6ff', test: (S) => S.readLevelUps >= 1 },
  { key: 'aloud', name: 'Out Loud', simple: 'I read a page out loud!', icon: 'note', col: '#ffd6b3', test: (S) => S.readAloud >= 1 }
];

const Stickers = (function () {
  let unlocked = new Set();
  const S = { fed: 0, brushed: 0, homeItems: 0, seasons: 0, seasonSet: [], raceWins: 0, counted: 0, words: 0, readWords: 0, readPages: 0, readMissions: 0, readLevelUps: 0, readAloud: 0, events: new Set(), quests: new Set(), distance: 0, flights: 0, cloudLandings: 0, moon: 0, flowers: 0, stars: 0, gems: 0, butterflies: 0, cloudsCheered: 0, nightFly: 0, dashes: 0, rings: 0, wearing: 0, photos: 0, factsRead: 0, sleeps: 0, water: 0, talked: 0 };
  const cache = new Map();
  let onUnlock = null, look = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('alicorn.stickers') || '{}');
      unlocked = new Set(d.unlocked || []);
      Object.assign(S, d.stats || {}); S.events = new Set(d.events || []); S.quests = new Set(d.quests || []);
    } catch (e) { /* fine */ }
  }
  function save() {
    try { localStorage.setItem('alicorn.stickers', JSON.stringify({ unlocked: [...unlocked], stats: Object.assign({}, S, { events: undefined, quests: undefined }), events: [...S.events], quests: [...S.quests] })); } catch (e) { /* fine */ }
  }

  function init(cb) {
    onUnlock = cb;
    load();
    const bump = (k, n = 1) => { S[k] += n; check(); };
    Bus.on('takeoff', () => bump('flights'));
    Bus.on('landed', (p, kind) => { if (kind === 'cloud') bump('cloudLandings'); if (kind === 'water') bump('water'); });
    Bus.on('moonLanded', () => bump('moon'));
    Bus.on('flowerBloomed', () => bump('flowers')); Bus.on('flowerMagic', () => bump('flowers'));
    Bus.on('star', () => bump('stars'));
    Bus.on('gem', () => bump('gems'));
    Bus.on('butterfly', () => bump('butterflies'));
    Bus.on('cloudCheered', () => bump('cloudsCheered'));
    Bus.on('dash', () => bump('dashes'));
    Bus.on('ringPassed', () => bump('rings'));
    Bus.on('photo', () => bump('photos'));
    Bus.on('factRead', () => bump('factsRead'));
    Bus.on('sleep', () => bump('sleeps'));
    Bus.on('skyZone', (p, z) => { if (z.key === 'stars') mark('starsky'); });
    Bus.on('questDone', (q) => { S.quests.add(q.key); check(); });
    Bus.on('talk', (f, p) => { if (p && p.stats) { S.talked = Math.max(S.talked, p.stats.talked.length); check(); } });
    Bus.on('wear', (n) => { S.wearing = Math.max(S.wearing, n); check(); });
    Bus.on('twoplayer', () => mark('twoplayer'));
    Bus.on('foalAdopted', () => mark('foalAdopted'));
    Bus.on('foalGrew', (f, st) => { if (st >= 2) mark('foalGrown'); });
    Bus.on('foalFed', () => bump('fed'));
    Bus.on('foalBrushed', () => bump('brushed'));
    Bus.on('homeItem', (n) => { S.homeItems = Math.max(S.homeItems, n); check(); });
    Bus.on('dive', () => mark('dive'));
    Bus.on('skate', () => mark('skate'));
    Bus.on('season', (s) => { S.seasonSet = S.seasonSet || []; if (!S.seasonSet.includes(s)) S.seasonSet.push(s); S.seasons = S.seasonSet.length; check(); });
    Bus.on('raceDone', (p, won) => { if (won) bump('raceWins'); });
    Bus.on('gameDone', (k) => { if (k === 'apple') bump('counted'); if (k === 'letters') bump('words'); });
    Bus.on('painted', () => mark('painted'));
    Bus.on('salon', () => mark('salon'));
    Bus.on('readWord', (w, n) => { S.readWords = Math.max(S.readWords || 0, n); check(); });
    Bus.on('readPage', () => bump('readPages'));
    Bus.on('missionDone', () => bump('readMissions'));
    Bus.on('readLevel', (L, why) => { if (why === 'up') bump('readLevelUps'); });
    Bus.on('readAloud', () => bump('readAloud'));
  }
  let tickT = 0;
  function tick(p, dt) { S.distance += Math.abs(p.x - p.prevX) || 0; if (p.state === 'air' && p.G.night > .5) S.nightFly += dt; tickT += dt; if (tickT > 1) { tickT = 0; check(); } }
  function mark(ev) { S.events.add(ev); check(); }
  function setLook(l) { look = l; }

  function check() {
    let any = false;
    for (const st of STICKERS) {
      if (unlocked.has(st.key)) continue;
      let ok = false;
      try { ok = st.test(S); } catch (e) { ok = false; }
      if (ok) { unlocked.add(st.key); any = true; if (onUnlock) onUnlock(st); Bus.emit('sticker', st); }
    }
    save();
    return any;
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
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * TAU, rad = r * (1 + .045 * Math.sin(a * 12));
      i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = locked ? '#d9d6cc' : st.col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = px * .03; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .84, 0, TAU);
    ctx.fillStyle = locked ? '#eeece6' : 'rgba(255,255,255,.75)'; ctx.fill();
    if (locked) { ctx.globalAlpha = .5; ctx.filter = 'grayscale(1) brightness(.9)'; }
    const img = Sprites.icon(st.icon, look || DEFAULT_LOOK, 64);
    ctx.drawImage(img, -r * .66, -r * .66, r * 1.32, r * 1.32);
    ctx.restore();
  }
  function image(st, px, locked) {
    const key = `${st.key}|${px}|${locked}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    draw(ctx, st, px, locked);
    cache.set(key, c);
    return c;
  }
  function imageEl(st, px, locked) { const src = image(st, px, locked); const c = document.createElement('canvas'); c.width = c.height = px * 2; c.style.width = c.style.height = px + 'px'; c.getContext('2d').drawImage(src, 0, 0); return c; }

  return { init, check, tick, has, count, all, image, imageEl, draw, reset, setLook, stats: S };
})();
