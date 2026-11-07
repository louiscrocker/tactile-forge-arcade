/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `stag.stickers`, which a hub page can read).
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
  { key: 'tunnel', name: 'Tunnel Maker', simple: 'I made a long tunnel!', icon: 'wood', col: '#c9a06a', test: (S) => S.tunnel >= 1500 },
  { key: 'friend', name: 'Grub Friend', simple: 'I found another grub!', icon: 'grub1', col: '#ffd9e6', test: (S) => S.events.has('metGrub') },
  { key: 'song', name: 'First Song', simple: 'I sang, and a grub sang back!', icon: 'grub1', col: '#ffe9a0', test: (S) => S.events.has('answered') },
  { key: 'choir', name: 'The Grub Choir', simple: 'I sang the whole song back!', icon: 'grub2', col: '#ffd76a', test: (S) => S.events.has('choir') },
  { key: 'frost', name: 'Below the Frost', simple: 'I slept through a winter!', icon: 'moon', col: '#cfe6ff', test: (S) => S.years >= 1 },
  { key: 'three', name: 'Three Years', simple: 'I was a grub for 3 years!', icon: 'grub2', col: '#e6d0a0', test: (S) => S.years >= 2 },
  { key: 'seven', name: 'Seven Years', simple: 'I stayed for all 7 years!', icon: 'grub3', col: '#ffd23f', test: (S) => S.events.has('sevenYears') },
  { key: 'mole', name: 'The Mole Went By', simple: 'The mole did not find me!', icon: 'mole', col: '#c8c0d0', test: (S) => S.events.has('moleGone') },
  { key: 'badger', name: 'Claws Above', simple: 'The badger went away!', icon: 'badger', col: '#d8d8d8', test: (S) => S.events.has('badgerGone') },
  { key: 'room', name: 'As Big as an Orange', simple: 'I made my cocoon!', icon: 'room', col: '#f0a860', test: (S) => S.events.has('pupated') },
  { key: 'pupa', name: 'Metamorphosis', simple: 'I turned into a beetle!', icon: 'pupa', col: '#ffe9a8', test: (S) => S.events.has('emerged') },
  { key: 'dusk', name: 'A Warm Evening', simple: 'I dug up to the garden!', icon: 'moon', col: '#ffc8a0', test: (S) => S.events.has('surfaced') },
  { key: 'flight', name: 'First Flight', simple: 'I flew!', icon: 'wings', col: '#bfe3ff', test: (S) => S.flights >= 1 },
  { key: 'bonk', name: 'BONK!', simple: 'I bumped into something!', icon: 'star', col: '#ffb0a0', test: (S) => S.bonks >= 1 },
  { key: 'bonk5', name: 'Flying Tank', simple: 'I bumped into 5 things!', icon: 'star', col: '#ff8a7a', test: (S) => S.bonks >= 5 },
  { key: 'lamp', name: 'The Lamp Again', simple: 'I bumped the street lamp!', icon: 'lamp', col: '#ffe9a0', test: (S) => S.events.has('bonkLamp') },
  { key: 'upside', name: 'Legs in the Air', simple: 'I landed on my back!', icon: 'beetle', col: '#c9b6ff', test: (S) => S.flipsN >= 1 },
  { key: 'skip', name: 'Skip, Skip', simple: 'I bounced on the pond!', icon: 'rain', col: '#9fd4f0', test: (S) => S.events.has('skip') },
  { key: 'gold', name: 'Golden Nose', simple: 'I flew through 20 gold puffs!', icon: 'sap', col: '#ffd76a', test: (S) => S.puffs >= 20 },
  { key: 'sap', name: 'Orange Tongue', simple: 'I sipped sweet sap!', icon: 'sap', col: '#ffc070', test: (S) => S.sips >= 1 },
  { key: 'rear', name: 'Look How Big I Am', simple: 'I reared up at a visitor!', icon: 'antler', col: '#ffb070', test: (S) => S.rears >= 1 },
  { key: 'bat', name: 'Too Big for a Bat', simple: 'A bat went by!', icon: 'bat', col: '#b0a8c8', test: (S) => S.events.has('batMiss') },
  { key: 'wrestle', name: 'Antler to Antler', simple: 'I wrestled a beetle!', icon: 'rival', col: '#ff9a8a', test: (S) => S.events.has('ringStart') },
  { key: 'block', name: 'Blocked!', simple: 'I blocked a shove!', icon: 'star', col: '#ffe27a', test: (S) => S.events.has('ringBlock') },
  { key: 'win', name: 'Flip!', simple: 'I flipped a beetle off!', icon: 'antler', col: '#ffd23f', test: (S) => S.wins >= 1 },
  { key: 'tryagain', name: 'Try Again', simple: 'I fell off and tried again!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('tossedDown') && S.wins >= 1 },
  { key: 'duke', name: 'King of the Oak', simple: 'I beat The Duke!', icon: 'champ', col: '#ffcf40', test: (S) => S.events.has('champion') && S.wins >= 1 },
  { key: 'sneak', name: 'Sneaky', simple: 'I sneaked past the big ones!', icon: 'beetle', col: '#b0e0a0', test: (S) => S.sneaks >= 1 },
  { key: 'bite', name: 'Sharp Little Jaws', simple: 'I bit through the bark!', icon: 'female', col: '#ffc8e0', test: (S) => S.events.has('sapFlows') },
  { key: 'nose', name: 'Good Nose', simple: 'I smelled out the right wood!', icon: 'wood', col: '#c0e0a0', test: (S) => S.events.has('smellgood') },
  { key: 'mother', name: 'Eggs Laid', simple: 'I laid my eggs by the old wood!', icon: 'egg', col: '#f4a6c0', test: (S) => S.events.has('laidAll') },
  { key: 'met', name: 'A New Friend', simple: 'I met another beetle!', icon: 'female', col: '#ffc8e0', test: (S) => S.events.has('met') },
  { key: 'kid', name: 'Gentle Hands', simple: 'Someone moved me off the path!', icon: 'kid', col: '#ffe0c0', test: (S) => S.events.has('kidPut') },
  { key: 'gen2', name: 'Next Generation', simple: 'New grubs under the logs!', icon: 'pile', col: '#d9b080', test: (S) => S.generation >= 2 },
  { key: 'both', name: 'Both Ways', simple: 'I have been a boy and a girl!', icon: 'beetle', col: '#ffcf70', test: (S) => S.formsDone >= 2 },
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
  const KEY = 'stag.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), eaten: 0, punk: 0, molts: 0, tunnel: 0, sips: 0, flights: 0, bonks: 0, flipsN: 0, wins: 0, sneaks: 0, rears: 0, puffs: 0, years: 0, cards: 0, generation: 1, formsDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
    for (const ev of ['hatched', 'metGrub', 'answered', 'choir', 'pupated', 'emerged', 'surfaced', 'skip', 'batMiss', 'ringStart', 'ringBlock', 'tossedDown', 'champion', 'sapFlows', 'laidAll', 'met', 'kidPut', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('underGone', (u) => mark(u.kind + 'Gone'));
    Bus.on('bonk', (p, w) => { if (w === 'lamp' || w === 'post') mark('bonkLamp'); });
    Bus.on('sniffed', (p, q) => { if (q.key === 'pile') mark('smellgood'); });
    Bus.on('newYear', (p, y) => { if (y >= 7) mark('sevenYears'); });
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
    note('eaten', st.eaten); note('punk', st.punk); note('molts', st.molts); note('tunnel', st.tunnel); note('sips', st.sips); note('flights', st.flights); note('bonks', st.bonks); note('flipsN', st.flips); note('wins', st.wins); note('sneaks', st.sneaks); note('rears', st.rears); note('puffs', st.puffs); note('years', st.years); note('cards', Cards.count());
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
