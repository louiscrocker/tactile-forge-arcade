/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `widow.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Out of the Sac', simple: 'I came out of the egg sac!', icon: 'sac', col: '#fff3c0', test: (S) => S.events.has('hatched') },
  { key: 'balloon', name: 'Up and Away!', simple: 'The wind took me!', icon: 'wind', col: '#bfe3ff', test: (S) => S.events.has('launched') },
  { key: 'warm', name: 'Warm Air', simple: 'Warm air lifted me up!', icon: 'sun', col: '#ffe08a', test: (S) => S.events.has('warmAir') },
  { key: 'home', name: 'A New Home', simple: 'I found a den!', icon: 'den', col: '#e6c9a0', test: (S) => S.events.has('settled') },
  { key: 'thread1', name: 'First Thread', simple: 'I fixed a thread!', icon: 'thread', col: '#eaf6ff', test: (S) => S.threads >= 1 },
  { key: 'web', name: 'My Web', simple: 'I made my web!', icon: 'web', col: '#d8e8ff', test: (S) => S.events.has('webUp') },
  { key: 'gum', name: 'Sticky Feet', simple: 'I made a sticky line to the ground!', icon: 'gum', col: '#fff0b0', test: (S) => S.gum >= 1 },
  { key: 'gum5', name: 'Gumfoot Maker', simple: 'I made 5 sticky lines!', icon: 'gum', col: '#ffd76a', test: (S) => S.gum >= 5 },
  { key: 'spin10', name: 'Spinner', simple: 'I fixed 10 threads!', icon: 'web', col: '#c9e0ff', test: (S) => S.threads >= 10 },
  { key: 'spin25', name: 'Master Spinner', simple: 'I fixed 25 threads!', icon: 'web', col: '#a8c8ff', test: (S) => S.threads >= 25 },
  { key: 'drop', name: 'Drop Line', simple: 'I dropped on my line!', icon: 'thread', col: '#d0f0e0', test: (S) => S.drops >= 1 },
  { key: 'drop10', name: 'Yo-yo', simple: 'I dropped 10 times!', icon: 'thread', col: '#a8e0c0', test: (S) => S.drops >= 10 },
  { key: 'hum', name: 'I Felt It!', simple: 'I felt my web hum!', icon: 'web', col: '#ffe9a0', test: (S) => S.events.has('felt') },
  { key: 'wrap', name: 'Wrapped Up', simple: 'I wrapped a parcel!', icon: 'parcel', col: '#f4f0e0', test: (S) => S.events.has('parcel') },
  { key: 'snack1', name: 'First Snack', simple: 'I had a snack!', icon: 'fly', col: '#ffd9a0', test: (S) => S.meals >= 1 },
  { key: 'snack5', name: 'Five Snacks', simple: 'I had 5 snacks!', icon: 'moth', col: '#ffc880', test: (S) => S.meals >= 5 },
  { key: 'snack12', name: 'Good Hunter', simple: 'I had 12 snacks!', icon: 'ant', col: '#ffb060', test: (S) => S.meals >= 12 },
  { key: 'leaf', name: 'Just a Leaf', simple: 'It was only a leaf!', icon: 'leaf', col: '#c9e8a0', test: (S) => S.events.has('cutLeaf') },
  { key: 'molt1', name: 'Stripes!', simple: 'I moulted. I have stripes!', icon: 'young1', col: '#ffe0b0', test: (S) => S.molts >= 1 },
  { key: 'molt3', name: 'Getting Darker', simple: 'I moulted 3 times!', icon: 'young2', col: '#e0c8b0', test: (S) => S.molts >= 3 },
  { key: 'grown', name: 'All Grown Up', simple: 'I am a grown spider!', icon: 'adult', col: '#ff9a8a', test: (S) => S.events.has('grownUp') },
  { key: 'night3', name: 'Three Nights', simple: 'I was up for 3 nights!', icon: 'moon', col: '#cfd8ff', test: (S) => S.nights >= 3 },
  { key: 'night7', name: 'A Week of Nights', simple: 'I was up for 7 nights!', icon: 'moon', col: '#b0b8f0', test: (S) => S.nights >= 7 },
  { key: 'curl', name: 'Like a Seed', simple: 'I curled up and kept still!', icon: 'curl', col: '#d8c8b0', test: (S) => S.events.has('curled') },
  { key: 'red', name: 'Red Means Stop', simple: 'I showed my red mark!', icon: 'hourglass', col: '#ff8a7a', test: (S) => S.events.has('showed') },
  { key: 'dauber', name: 'The Blue Wasp Went By', simple: 'The blue wasp went away!', icon: 'wasp', col: '#a8c8f0', test: (S) => S.events.has('dauberGone') },
  { key: 'lizard', name: 'The Lizard Went By', simple: 'The lizard went away!', icon: 'lizard', col: '#c8d8a0', test: (S) => S.events.has('lizardGone') },
  { key: 'bird', name: 'The Bird Backed Off', simple: 'The bird went away!', icon: 'bird', col: '#e0c8a0', test: (S) => S.events.has('birdGone') },
  { key: 'mantis', name: 'Still as a Twig', simple: 'The mantis did not see me!', icon: 'mantis', col: '#b8e0a0', test: (S) => S.events.has('mantisGone') },
  { key: 'broom', name: 'Spin It Again', simple: 'The broom came. I am fine!', icon: 'broom', col: '#f0d8a0', test: (S) => S.events.has('swept') },
  { key: 'people', name: 'Look, Do Not Touch', simple: 'They looked. They did not touch.', icon: 'kid', col: '#ffe0c0', test: (S) => S.events.has('peopleLook') },
  { key: 'far', name: 'Long Walk', simple: 'I walked a long, long way!', icon: 'boy', col: '#e0d0b0', test: (S) => S.far >= 2000 },
  { key: 'court', name: 'Soft and Steady', simple: 'I plucked her web just right!', icon: 'boy', col: '#ffc8e0', test: (S) => S.events.has('courted') },
  { key: 'tryagain', name: 'Try Again', simple: 'Oops! I tried again.', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('lunged') && S.events.has('courted') },
  { key: 'hello', name: 'Hello!', simple: 'I said hello to a spider!', icon: 'heart', col: '#ffb0d0', test: (S) => S.events.has('met') },
  { key: 'sac', name: 'Round and Round', simple: 'I spun an egg sac!', icon: 'sac', col: '#f4a6c0', test: (S) => S.events.has('sacDone') },
  { key: 'gen2', name: 'Next Generation', simple: 'New spiderlings sailed away!', icon: 'parent', col: '#d9c0e0', test: (S) => S.generation >= 2 },
  { key: 'both', name: 'Both Ways', simple: 'I have been a boy and a girl!', icon: 'adult', col: '#ffcf70', test: (S) => S.formsDone >= 2 },
  { key: 'cards', name: 'Collector', simple: 'I have 8 cards!', icon: 'star', col: '#ffd23f', test: (S) => S.cards >= 8 },
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
  const KEY = 'widow.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), threads: 0, gum: 0, meals: 0, molts: 0, drops: 0, nights: 0, far: 0, cards: 0, generation: 1, formsDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
  const cache = new Map();

  function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (Array.isArray(o.unlocked)) unlocked = new Set(o.unlocked.filter(k => STICKERS.some(s => s.key === k))); saved = o; S.formsDone = Array.isArray(o.forms) ? o.forms.length : 0; S.photos = +o.photos || 0; S.factsRead = +o.factsRead || 0; } catch (e) { /* fresh */ } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ unlocked: [...unlocked], forms: saved.forms || [], photos: S.photos, factsRead: S.factsRead })); } catch (e) { /* full */ } }
  function note(key, v) { if (v > (S[key] || 0)) { S[key] = v; check(); } }
  function mark(ev) { if (!S.events.has(ev)) { S.events.add(ev); check(); } }
  function setGeneration(g) { S.generation = Math.max(S.generation, g); check(); }
  function formDone(form) { const f = new Set(saved.forms || []); f.add(form); saved.forms = [...f]; S.formsDone = f.size; check(true); }
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
    for (const ev of ['hatched', 'launched', 'warmAir', 'settled', 'webUp', 'parcel', 'cutLeaf', 'grownUp', 'curled', 'showed', 'swept', 'peopleLook', 'courted', 'lunged', 'met', 'sacDone', 'dauberGone', 'lizardGone', 'birdGone', 'mantisGone', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('caught', (b) => { if (b && !b.leaf) mark('felt'); });
    Bus.on('generationDone', (p) => { formDone(p.form); });
    Bus.on('card', () => setTimeout(() => note('cards', Cards.count()), 0));
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
    for (const k of ['threads', 'gum', 'meals', 'molts', 'drops', 'nights', 'far']) note(k, st[k]); note('cards', Cards.count());
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

  return { init, check, watch, has, count, all, image, draw, note, mark, setGeneration, formDone, reset, stats: S };
})();
