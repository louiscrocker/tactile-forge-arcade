/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `starfish.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Hatch!', simple: 'I hatched in the sea!', icon: 'larva', col: '#bfe8ff', test: (S) => S.events.has('hatched') },
  { key: 'plankton', name: 'Plankton Feast', simple: 'I ate 30 tiny plants!', icon: 'plankton', col: '#c9f2c0', test: (S) => S.plankton >= 30 },
  { key: 'glow', name: 'Glowing Sea', simple: 'I made the plankton glow!', icon: 'plankton', col: '#8ee8ff', test: (S) => S.glow >= 1 },
  { key: 'larva3', name: 'Sticky Arms', simple: 'I grew three sticky arms!', icon: 'postlarva', col: '#ffd9e6', test: (S) => S.events.has('larva3') },
  { key: 'dash', name: 'Speedy Swimmer', simple: 'I swam fast three times!', icon: 'larva', col: '#d9f0ff', test: (S) => S.dashes >= 3 },
  { key: 'herring', name: 'Herring Dodger', simple: 'A school of herring swam past me!', icon: 'herring', col: '#c8d8e8', test: (S) => S.events.has('schoolGone') },
  { key: 'whale', name: 'Grey Whale!', simple: 'A whale as long as a bus swam past me!', icon: 'whale', col: '#b8c0c8', test: (S) => S.events.has('whalePassed') },
  { key: 'jelly', name: 'Rainbow Jelly', simple: 'A comb jelly drifted by!', icon: 'combjelly', col: '#e0d6ff', test: (S) => S.events.has('combJelly') },
  { key: 'postlarva', name: 'Back to Shore', simple: 'I swam back to the rocks!', icon: 'postlarva', col: '#ffc8b0', test: (S) => S.events.has('postlarva') },
  { key: 'settle', name: 'A Tiny Star', simple: 'I held on and became a sea star!', icon: 'juvenile', col: '#ffc0d8', test: (S) => S.events.has('settled') },
  { key: 'spat', name: 'Barnacle Muncher', simple: 'I ate 5 baby barnacles!', icon: 'barnacle', col: '#f0e8d8', test: (S) => S.spat >= 5 },
  { key: 'rest', name: 'Rest and Grow', simple: 'I rested and grew!', icon: 'rest', col: '#ffe9a8', test: (S) => S.events.has('awake') },
  { key: 'pool', name: 'Tide Pooler', simple: 'I hid in a tide pool at low tide!', icon: 'pool', col: '#a8e0ff', test: (S) => S.pools >= 1 },
  { key: 'dry', name: 'Hold Your Water', simple: 'I waited for a wave when I was dry!', icon: 'dry', col: '#ffe0a0', test: (S) => S.dried >= 1 },
  { key: 'splash', name: 'Splash!', simple: 'A wave splashed me wet again!', icon: 'wave', col: '#bfe8ff', test: (S) => S.splashes >= 1 },
  { key: 'hold', name: 'Hold On Tight', simple: 'I held on while a wave rolled over!', icon: 'hold', col: '#9ad0ff', test: (S) => S.held >= 1 },
  { key: 'hold5', name: 'Wave Rider', simple: 'I held on through 5 big waves!', icon: 'wave', col: '#7fc4ff', test: (S) => S.held >= 5 },
  { key: 'rolled', name: 'Roly-Poly', simple: 'A wave rolled me and I was OK!', icon: 'wave', col: '#d8f0ff', test: (S) => S.rolled >= 1 },
  { key: 'barnacle', name: 'Barnacle Fan', simple: 'I ate 5 barnacles!', icon: 'barnacle', col: '#ece6da', test: (S) => S.barnacles >= 5 },
  { key: 'limpet', name: 'Limpet Lifter', simple: 'I ate a limpet!', icon: 'limpet', col: '#e0c8a0', test: (S) => S.limpets >= 1 },
  { key: 'snail', name: 'Snail Snack', simple: 'I ate a turban snail!', icon: 'snail', col: '#c8c0d0', test: (S) => S.snails >= 1 },
  { key: 'snailroll', name: 'Rolling Snail', simple: 'A snail tumbled away from me!', icon: 'snail', col: '#e8e0f0', test: (S) => S.events.has('snailRoll') },
  { key: 'chiton', name: 'Armour Eater', simple: 'I ate a chiton!', icon: 'chiton', col: '#b0e0d0', test: (S) => S.chitons >= 1 },
  { key: 'mussel', name: 'Pull, Pull, Pull!', simple: 'I opened a mussel!', icon: 'mussel', col: '#a8b8d8', test: (S) => S.mussels >= 1 },
  { key: 'stomach', name: 'Tummy Out!', simple: 'I pushed my stomach out to eat!', icon: 'stomach', col: '#ffd8c0', test: (S) => S.mussels >= 1 },
  { key: 'mussel10', name: 'Mussel Muncher', simple: 'I ate 10 mussels!', icon: 'mussel', col: '#8a9ac8', test: (S) => S.mussels >= 10 },
  { key: 'shells', name: 'Shell Pile', simple: 'I left 10 empty shells!', icon: 'shell', col: '#f0e8d8', test: (S) => S.shells >= 10 },
  { key: 'keystone', name: 'Keystone!', simple: 'I made room for new life on the shore!', icon: 'keystone', col: '#b0f0b0', test: (S) => S.events.has('keystone') },
  { key: 'dodge', name: 'Can\'t Budge Me', simple: 'A visitor tried to pull me off and gave up!', icon: 'hold', col: '#c8d0a0', test: (S) => S.events.has('dodged') },
  { key: 'gull', name: 'Gull Gone', simple: 'A gull landed by me and flew off!', icon: 'gull', col: '#e8eef4', test: (S) => S.gulls >= 1 },
  { key: 'otter', name: 'Otter Visit', simple: 'A sea otter came for a look!', icon: 'otter', col: '#d8c0a0', test: (S) => S.otters >= 1 },
  { key: 'crab', name: 'Crab Visit', simple: 'A red rock crab came by!', icon: 'crab', col: '#f0a090', test: (S) => S.crabs >= 1 },
  { key: 'sunflower', name: 'Run Away!', simple: 'I hurried away from a sunflower star!', icon: 'sunflower', col: '#ffd0a0', test: (S) => S.events.has('escaped') },
  { key: 'kid', name: 'Gently Does It', simple: 'A child looked at me and put me back!', icon: 'kid', col: '#ffd08a', test: (S) => S.events.has('putBack') },
  { key: 'young', name: 'Young Star', simple: 'I grew into a young sea star!', icon: 'young', col: '#ffc8e0', test: (S) => S.instar >= 2 },
  { key: 'adult', name: 'Big Star!', simple: 'I grew into a big sea star!', icon: 'adult', col: '#ff9a8a', test: (S) => S.instar >= 4 },
  { key: 'big', name: 'Really Big', simple: 'I grew 25 cm across!', icon: 'adult', col: '#ffd23f', test: (S) => S.cm >= 25 },
  { key: 'counted', name: 'Counted!', simple: 'A scientist counted and measured me!', icon: 'scientist', col: '#a8d8f0', test: (S) => S.counted >= 1 },
  { key: 'regrow', name: 'It Grows Back', simple: 'My arm tip grew back!', icon: 'arm', col: '#ffd8c0', test: (S) => S.events.has('armTip') },
  { key: 'winter', name: 'Storm Holder', simple: 'I held on through the winter storm!', icon: 'storm', col: '#c0c8d8', test: (S) => S.events.has('spring') },
  { key: 'spring', name: 'Spring!', simple: 'The sea stars gathered in spring!', icon: 'spring', col: '#b0f0b0', test: (S) => S.events.has('spring') },
  { key: 'met', name: 'Hello, Friends', simple: 'I said hi to the other sea stars!', icon: 'mate', col: '#ffc0d8', test: (S) => S.events.has('met') },
  { key: 'release', name: 'Stand Tall', simple: 'I stood tall and let my eggs or cloud go!', icon: 'spawn', col: '#ffe0b0', test: (S) => S.events.has('released') },
  { key: 'gen2', name: 'Next Generation', simple: 'My eggs hatched into new babies!', icon: 'egg', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been three colours of sea star!', icon: 'adult', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy and a girl sea star!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'starfish.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), plankton: 0, glow: 0, dashes: 0, spat: 0, barnacles: 0, limpets: 0, snails: 0, chitons: 0, mussels: 0, shells: 0, pools: 0, dried: 0, splashes: 0, held: 0, rolled: 0, counted: 0, gulls: 0, otters: 0, crabs: 0, instar: 0, cm: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a sea star of this colour and sex has settled on the shore */
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
    for (const ev of ['hatched', 'larva3', 'schoolGone', 'whalePassed', 'combJelly', 'postlarva', 'settled', 'awake', 'dodged', 'escaped', 'putBack', 'keystone', 'snailRoll', 'armTip', 'spring', 'met', 'released', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('predator', (h) => { const k = { gull: 'gulls', otter: 'otters', crab: 'crabs' }[h.kind]; if (k) note(k, (S[k] || 0) + 1); });
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
    for (const k of ['plankton', 'glow', 'dashes', 'spat', 'barnacles', 'limpets', 'snails', 'chitons', 'mussels', 'shells', 'pools', 'dried', 'splashes', 'held', 'rolled', 'counted']) note(k, st[k]);
    if (p.stage === 'star') { note('instar', p.instar); note('cm', p.cm); }
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
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip();
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
