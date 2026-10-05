/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `hercules.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Hatched!', simple: 'I came out of my egg!', icon: 'egg', col: '#fff3c0', test: (S) => S.events.has('hatched') },
  { key: 'muncher', name: 'Wood Muncher', simple: 'I ate lots of wood!', icon: 'wood', col: '#d9a86a', test: (S) => S.eaten >= 300 },
  { key: 'fungus', name: 'Fungus Feast', simple: 'I ate the white fungus wood!', icon: 'fungus', col: '#c9f2c0', test: (S) => S.punk >= 20 },
  { key: 'molt1', name: 'Out of My Skin', simple: 'I moulted!', icon: 'grub2', col: '#ffe0b0', test: (S) => S.molts >= 1 },
  { key: 'molt2', name: 'Giant Grub', simple: 'I am a giant grub!', icon: 'grub3', col: '#f6d0a0', test: (S) => S.molts >= 2 },
  { key: 'heavy', name: 'Heavier than a Mouse', simple: 'My grub was over 100 grams!', icon: 'mouse', col: '#e0d6ff', test: (S) => S.grams >= 100 },
  { key: 'tunnel', name: 'Tunnel Maker', simple: 'I made a long tunnel!', icon: 'log', col: '#c9a06a', test: (S) => S.tunnel >= 1500 },
  { key: 'friend', name: 'Grub Friend', simple: 'I found another grub!', icon: 'grub1', col: '#ffd9e6', test: (S) => S.events.has('metGrub') },
  { key: 'hide', name: 'Hide and Seek', simple: 'The coati did not find me!', icon: 'coati', col: '#b8e0ff', test: (S) => S.events.has('hid') },
  { key: 'room', name: 'Room Builder', simple: 'I made my pupal room!', icon: 'room', col: '#e8b080', test: (S) => S.events.has('pupated') },
  { key: 'pupa', name: 'Metamorphosis', simple: 'I turned into a beetle!', icon: 'pupa', col: '#ffe9a8', test: (S) => S.events.has('emerged') },
  { key: 'night', name: 'Night Forest', simple: 'I dug up to the forest!', icon: 'moon', col: '#a9b8ff', test: (S) => S.events.has('surfaced') },
  { key: 'fruit', name: 'Fruit Feast', simple: 'I ate some fruit!', icon: 'fruit', col: '#ffc070', test: (S) => S.fruits >= 1 },
  { key: 'juicy', name: 'Juicy!', simple: 'I ate fruit 10 times!', icon: 'fig', col: '#e0a0e0', test: (S) => S.fruits >= 10 },
  { key: 'flight', name: 'First Flight', simple: 'I flew!', icon: 'wings', col: '#bfe3ff', test: (S) => S.flights >= 1 },
  { key: 'canopy', name: 'Over the Treetops', simple: 'I flew over the trees!', icon: 'tree', col: '#9ae0a0', test: (S) => S.events.has('overTrees') },
  { key: 'treetop', name: 'Tree Climber', simple: 'I climbed to the top of a tree!', icon: 'branch', col: '#b7e36a', test: (S) => S.events.has('treeTop') },
  { key: 'lift', name: 'Super Strong', simple: 'I lifted a stick!', icon: 'stick', col: '#f0c47a', test: (S) => S.lifts >= 1 },
  { key: 'lift5', name: 'Weightlifter', simple: 'I lifted 5 sticks!', icon: 'stick', col: '#ffb070', test: (S) => S.lifts >= 5 },
  { key: 'wrestle', name: 'Horn to Horn', simple: 'I wrestled a beetle!', icon: 'rival', col: '#ff9a8a', test: (S) => S.events.has('wrestle') },
  { key: 'win', name: 'Victory!', simple: 'I won a wrestle!', icon: 'horn', col: '#ffd23f', test: (S) => S.wins >= 1 },
  { key: 'champ', name: 'Champion', simple: 'I won 3 times!', icon: 'champ', col: '#ffcf40', test: (S) => S.wins >= 3 },
  { key: 'tryagain', name: 'Try Again', simple: 'I got flipped and tried again!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('tossedDown') && S.wins >= 1 },
  { key: 'colour', name: 'Colour Changer', simple: 'My wings went black in the damp!', icon: 'rain', col: '#7fc4ff', test: (S) => S.events.has('wetWings') },
  { key: 'big', name: 'Giant Beetle', simple: 'I grew to 15 cm!', icon: 'beetle', col: '#d7f0a8', test: (S) => S.length >= 150 },
  { key: 'record', name: 'Record Breaker', simple: 'I grew to 17 cm!', icon: 'horn', col: '#ffe27a', test: (S) => S.length >= 170 },
  { key: 'met', name: 'A New Friend', simple: 'I met a female beetle!', icon: 'female', col: '#ffc8e0', test: (S) => S.events.has('met') },
  { key: 'gen2', name: 'Next Generation', simple: 'Her eggs hatched into new grubs!', icon: 'egg', col: '#f4a6c0', test: (S) => S.generation >= 2 },
  { key: 'forms', name: 'Collector', simple: 'I have been 3 kinds of Hercules!', icon: 'beetle', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
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
  const KEY = 'hercules.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), eaten: 0, punk: 0, molts: 0, grams: 0, tunnel: 0, fruits: 0, flights: 0, lifts: 0, wins: 0, length: 0, generation: 1, formsDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
    for (const ev of ['hatched', 'metGrub', 'pupated', 'emerged', 'surfaced', 'overTrees', 'treeTop', 'wrestle', 'tossedDown', 'wetWings', 'met', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('coatiGone', () => { const p = window.G && window.G.player; if (p && p.flags.coatiSafe) mark('hid'); });
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
    note('eaten', st.eaten); note('punk', st.punk); note('molts', st.molts); note('tunnel', st.tunnel); note('fruits', st.fruits); note('flights', st.flights); note('lifts', st.lifts); note('wins', st.wins);
    if (p.stage !== 'adult' && p.stage !== 'egg') note('grams', p.grams);
    if (p.stage === 'adult') note('length', p.lengthMM);
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
