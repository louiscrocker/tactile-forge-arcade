/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `octopus.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Pop Out!', simple: 'I hatched on a spring night!', icon: 'larva', col: '#bfe8ff', test: (S) => S.events.has('hatched') },
  { key: 'plankton', name: 'Plankton Feast', simple: 'I ate 30 bits of plankton!', icon: 'plankton', col: '#c9f2c0', test: (S) => S.plankton >= 30 },
  { key: 'zoea', name: 'Crab Catcher', simple: 'I caught a jumpy baby crab!', icon: 'copepod', col: '#ffe0b0', test: (S) => S.zoea >= 1 },
  { key: 'glow', name: 'Glowing Sea', simple: 'I made the plankton glow!', icon: 'plankton', col: '#8ee8ff', test: (S) => S.glow >= 1 },
  { key: 'larva3', name: 'Big Baby', simple: 'I grew twice in the plankton!', icon: 'larva', col: '#ffd9e6', test: (S) => S.events.has('larva3') },
  { key: 'dash', name: 'Little Jet', simple: 'I jetted with my siphon!', icon: 'larva', col: '#d9f0ff', test: (S) => S.dashes >= 3 },
  { key: 'herring', name: 'Herring Dodger', simple: 'A school of herring swam past me!', icon: 'herring', col: '#c8d8e8', test: (S) => S.events.has('schoolGone') },
  { key: 'whale', name: 'Grey Whale!', simple: 'A whale as long as a bus swam past me!', icon: 'whale', col: '#b8c0c8', test: (S) => S.events.has('whalePassed') },
  { key: 'jelly', name: 'Rainbow Jelly', simple: 'A comb jelly drifted by!', icon: 'combjelly', col: '#e0d6ff', test: (S) => S.events.has('combJelly') },
  { key: 'gull', name: 'Close Call', simple: 'A gull dipped and missed!', icon: 'gull', col: '#e8eef4', test: (S) => S.events.has('gullMissed') },
  { key: 'postlarva', name: 'Settler', simple: 'I was big enough to settle!', icon: 'postlarva', col: '#ffc8b0', test: (S) => S.events.has('postlarva') },
  { key: 'settle', name: 'A Den of My Own', simple: 'I found a free crack under a boulder!', icon: 'den', col: '#d9d2c4', test: (S) => S.events.has('settled') },
  { key: 'bottle', name: 'Bottle Home', simple: 'I made my home in an old bottle!', icon: 'bottle', col: '#c8e8c0', test: (S) => S.events.has('bottleHome') },
  { key: 'drift', name: 'Shrimp Snatcher', simple: 'I grabbed 5 shrimps from my den!', icon: 'shrimp', col: '#f0e0c0', test: (S) => S.shrimps >= 5 },
  { key: 'sleep', name: 'Sleepyhead', simple: 'I slept in my den and grew!', icon: 'sleep', col: '#ffe9a8', test: (S) => S.events.has('awake') },
  { key: 'dream', name: 'Dreaming in Colour', simple: 'My skin flickered while I dreamed!', icon: 'sleep', col: '#e0c8ff', test: (S) => S.sleeps >= 2 },
  { key: 'forage', name: 'Night Hunter', simple: 'I went out to hunt at night!', icon: 'crab', col: '#9ab0e0', test: (S) => S.events.has('forageNight') },
  { key: 'crab', name: 'Crab Cracker', simple: 'I ate 5 crabs!', icon: 'crab', col: '#e8a890', test: (S) => S.crabs >= 5 },
  { key: 'clam', name: 'Clam Opener', simple: 'I opened a clam!', icon: 'clam', col: '#e8dcc0', test: (S) => S.clams >= 1 },
  { key: 'scallop', name: 'Scallop Supper', simple: 'I ate a rock scallop!', icon: 'scallop', col: '#f0c0b0', test: (S) => S.scallops >= 1 },
  { key: 'snail', name: 'Snail Snack', simple: 'I ate a moon snail!', icon: 'snail', col: '#d8c8a8', test: (S) => S.snails >= 1 },
  { key: 'midden', name: 'My Midden', simple: 'I piled up 5 shells by my door!', icon: 'shell', col: '#f0e8d8', test: (S) => S.shells >= 5 },
  { key: 'ink', name: 'Ink Cloud', simple: 'I squirted ink and jetted away!', icon: 'ink', col: '#9aa0c0', test: (S) => S.jets >= 1 },
  { key: 'dodge', name: 'Too Quick!', simple: 'A hunter missed me!', icon: 'lingcod', col: '#c8d0a0', test: (S) => S.events.has('dodged') },
  { key: 'blend', name: 'Now You See Me…', simple: 'I blended in and vanished!', icon: 'cobble', col: '#c8c0b0', test: (S) => S.blends >= 1 },
  { key: 'hide', name: 'Hide and Seek', simple: 'I hid in a crack!', icon: 'cobble', col: '#a8e0ff', test: (S) => S.shelters >= 1 },
  { key: 'favarm', name: 'Favourite Arm', simple: 'My favourite arm was decided!', icon: 'arm', col: '#ffcf40', test: (S) => S.events.has('favArm') },
  { key: 'den', name: 'Den Digger', simple: 'I dug a den!', icon: 'den', col: '#d9a86a', test: (S) => S.events.has('deepEnough') },
  { key: 'pot', name: 'Not a Crab!', simple: 'The crabber lifted the lid and let me go!', icon: 'crabber', col: '#ffd08a', test: (S) => S.events.has('putBack') },
  { key: 'adult', name: 'Giant!', simple: 'I grew into a giant Pacific octopus!', icon: 'adult', col: '#ff9a8a', test: (S) => S.instar >= 4 },
  { key: 'big', name: 'Really Big', simple: 'My mantle grew to 40 cm!', icon: 'arm', col: '#ffd23f', test: (S) => S.cm >= 40 },
  { key: 'diver', name: 'Hello, Diver', simple: 'I said hi to a diver with an arm!', icon: 'diver', col: '#a8d8f0', test: (S) => S.shakes >= 1 },
  { key: 'regrow', name: 'It Grows Back', simple: 'I lost an arm tip and it grew back!', icon: 'arm', col: '#ffd8c0', test: (S) => S.events.has('armTip') },
  { key: 'autumn', name: 'Down to the Deep', simple: 'I crawled down to the deep!', icon: 'deep', col: '#7fc4ff', test: (S) => S.events.has('arrivedDeep') },
  { key: 'winter', name: 'Winter Rest', simple: 'I rested in a deep den all winter!', icon: 'mud', col: '#c0c8d8', test: (S) => S.events.has('winterDone') },
  { key: 'spring', name: 'Home Again', simple: 'I crawled back home in spring!', icon: 'cobble', col: '#b0f0b0', test: (S) => S.events.has('homeAgain') },
  { key: 'box', name: 'Arm to Arm', simple: 'I had a wrestling match!', icon: 'rival', col: '#ffb070', test: (S) => S.events.has('box') },
  { key: 'win', name: 'Victory!', simple: 'I won a wrestling match!', icon: 'arm', col: '#ffcf40', test: (S) => S.wins >= 1 },
  { key: 'boss', name: 'Biggest on the Reef', simple: 'I kept the best den!', icon: 'boss', col: '#ffd23f', test: (S) => S.events.has('boss') },
  { key: 'tryagain', name: 'Try Again', simple: 'I got pushed back and tried again!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('tossedDown') && S.wins >= 1 },
  { key: 'brood', name: 'Egg Keeper', simple: 'I looked after my eggs for months!', icon: 'female', col: '#ffc8e0', test: (S) => S.events.has('broodDone') },
  { key: 'puff', name: 'Puff!', simple: 'I puffed a sunflower star away from my eggs!', icon: 'sunstar', col: '#ffd0a0', test: (S) => S.puffs >= 1 },
  { key: 'release', name: 'Babies Away', simple: 'I blew my babies free!', icon: 'eggs', col: '#a6d8f4', test: (S) => S.events.has('babiesReleased') },
  { key: 'gen2', name: 'Next Generation', simple: 'My eggs hatched into new babies!', icon: 'egg', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been three colours of octopus!', icon: 'octopus', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy and a girl octopus!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'octopus.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), plankton: 0, zoea: 0, glow: 0, dashes: 0, jets: 0, shelters: 0, crabs: 0, clams: 0, scallops: 0, snails: 0, shrimps: 0, shells: 0, blends: 0, shakes: 0, puffs: 0, sleeps: 0, instar: 0, cm: 0, wins: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* an octopus of this colour and sex has settled on the reef */
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
    for (const ev of ['hatched', 'larva3', 'schoolGone', 'whalePassed', 'combJelly', 'gullMissed', 'postlarva', 'settled', 'awake', 'forageNight', 'dodged', 'favArm', 'deepEnough', 'putBack', 'arrivedDeep', 'winterDone', 'homeAgain', 'box', 'boss', 'tossedDown', 'broodDone', 'babiesReleased', 'microscope', 'readAloud', 'armTip']) Bus.on(ev, () => mark(ev));
    Bus.on('settled', (p, sh) => { if (sh && sh.kind === 'bottle') mark('bottleHome'); });
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
    for (const k of ['plankton', 'zoea', 'glow', 'dashes', 'jets', 'shelters', 'crabs', 'clams', 'scallops', 'snails', 'shrimps', 'shells', 'blends', 'shakes', 'puffs', 'sleeps', 'wins']) note(k, st[k]);
    if (p.stage === 'octopus') { note('instar', p.instar); note('cm', p.cm); }
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
