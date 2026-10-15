/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `jellyfish.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Swim Free!', simple: 'I swam free from Mum\'s arm!', icon: 'planula', col: '#bfe8ff', test: (S) => S.events.has('hatched') },
  { key: 'taken', name: 'Taken!', simple: 'I found a spot that was taken!', icon: 'ledge', col: '#d9d2c4', test: (S) => S.taken >= 1 },
  { key: 'settle', name: 'Upside Down', simple: 'I stuck on under a rock!', icon: 'polyp', col: '#ffe9a8', test: (S) => S.events.has('settled') },
  { key: 'catch', name: 'First Catch', simple: 'My tentacles caught some food!', icon: 'tentacles', col: '#c9f2c0', test: (S) => S.catches >= 1 },
  { key: 'catch20', name: 'Good Catcher', simple: 'I caught 20 bits of food!', icon: 'tentacles', col: '#9ae0a0', test: (S) => S.catches >= 20 },
  { key: 'eight', name: 'Eight Tentacles', simple: 'I grew eight tentacles!', icon: 'polyp', col: '#ffd9e6', test: (S) => S.events.has('tentacles8') },
  { key: 'sixteen', name: 'Sixteen Tentacles', simple: 'I grew sixteen tentacles!', icon: 'tentacles', col: '#ffc8e0', test: (S) => S.events.has('tentacles16') },
  { key: 'bud', name: 'A Copy of Me', simple: 'I grew a bud!', icon: 'bud', col: '#e0d6ff', test: (S) => S.buds >= 1 },
  { key: 'clones', name: 'Clone Family', simple: 'I made two clones!', icon: 'bud', col: '#c9b6ff', test: (S) => S.buds >= 2 },
  { key: 'slug', name: 'Slug Slid By', simple: 'A sea slug crawled past me!', icon: 'slug', col: '#ffd0b0', test: (S) => S.slugs >= 1 },
  { key: 'pullin', name: 'Pull In Tight', simple: 'I pulled my tentacles in tight!', icon: 'polyp', col: '#d9f0ff', test: (S) => S.events.has('pulledIn') },
  { key: 'winter', name: 'Brr, Winter!', simple: 'I felt the cold of winter!', icon: 'snow', col: '#e8eef4', test: (S) => S.events.has('strobila') },
  { key: 'stack', name: 'Stack of Plates', simple: 'I turned into a stack of discs!', icon: 'strobila', col: '#fff0d8', test: (S) => S.events.has('stack') },
  { key: 'pop', name: 'Pop!', simple: 'I popped free as a baby jelly!', icon: 'ephyra', col: '#ffe0b0', test: (S) => S.events.has('popFree') },
  { key: 'plankton', name: 'Plankton Feast', simple: 'I ate 30 bits of plankton!', icon: 'plankton', col: '#c9f2c0', test: (S) => S.plankton >= 30 },
  { key: 'copepod', name: 'Copepod Catcher', simple: 'I caught a jumpy copepod!', icon: 'copepod', col: '#ffe0b0', test: (S) => S.copepods >= 1 },
  { key: 'glow', name: 'Glowing Sea', simple: 'I made the plankton glow!', icon: 'sparkle', col: '#8ee8ff', test: (S) => S.glow >= 1 },
  { key: 'pulse', name: 'Pulse, Pulse', simple: 'I pulsed 100 times!', icon: 'ephyra', col: '#d9f0ff', test: (S) => S.pulses >= 100 },
  { key: 'zoom', name: 'Big Pulse', simple: 'I gave three big pulses!', icon: 'jelly', col: '#bfe8ff', test: (S) => S.dashes >= 3 },
  { key: 'grew', name: 'Filling In', simple: 'My arms filled in!', icon: 'ephyra', col: '#ffe9a8', test: (S) => S.events.has('grew') },
  { key: 'herring', name: 'Fish Went By', simple: 'A school of herring swam past me!', icon: 'herring', col: '#c8d8e8', test: (S) => S.events.has('schoolGone') },
  { key: 'comb', name: 'Rainbow Blob', simple: 'A comb jelly drifted by!', icon: 'combjelly', col: '#e0d6ff', test: (S) => S.events.has('combJelly') },
  { key: 'tern', name: 'Close Call', simple: 'A tern dipped and missed!', icon: 'tern', col: '#e8eef4', test: (S) => S.events.has('ternDip') },
  { key: 'medusa', name: 'Young Jelly', simple: 'I grew into a young moon jelly!', icon: 'medusa', col: '#ffc8e0', test: (S) => S.events.has('medusa') },
  { key: 'sticky', name: 'Sticky Bell', simple: 'Food stuck to my bell!', icon: 'jelly', col: '#f0e0c0', test: (S) => S.stuckMax >= 1 },
  { key: 'lick', name: 'Lick It Off', simple: 'I licked food off my bell!', icon: 'arms', col: '#ffd9e6', test: (S) => S.licks >= 1 },
  { key: 'lick10', name: 'Busy Arms', simple: 'I licked my bell 10 times!', icon: 'arms', col: '#ffb0c8', test: (S) => S.licks >= 10 },
  { key: 'full', name: 'Full Bell', simple: 'My bell was covered in food!', icon: 'plankton', col: '#c0c8f0', test: (S) => S.stuckMax >= 12 },
  { key: 'ride', name: 'Current Rider', simple: 'I rode the current!', icon: 'current', col: '#7fc4ff', test: (S) => S.ride >= 3 },
  { key: 'turtle', name: 'Turtle Missed!', simple: 'A sea turtle came by and missed!', icon: 'turtle', col: '#b0d8a0', test: (S) => S.events.has('turtleGone') },
  { key: 'sunfish', name: 'Sunfish Missed!', simple: 'An ocean sunfish came by and missed!', icon: 'sunfish', col: '#c8d0d8', test: (S) => S.events.has('sunfishGone') },
  { key: 'gull', name: 'Gull Missed!', simple: 'A gull pecked at the top and missed!', icon: 'gull', col: '#f0f0f0', test: (S) => S.events.has('gullDip') },
  { key: 'dodge', name: 'Too Quick!', simple: 'My big pulse took me away!', icon: 'jelly', col: '#c8d0a0', test: (S) => S.events.has('dodged') },
  { key: 'adult', name: 'Four Rings', simple: 'I grew four rings!', icon: 'rings', col: '#ff9ac8', test: (S) => S.events.has('adult') },
  { key: 'big', name: 'Dinner Plate', simple: 'My bell grew 25 cm wide!', icon: 'adult', col: '#ffd23f', test: (S) => S.cm >= 25 },
  { key: 'sparkle', name: 'Night Sparkles', simple: 'The sea sparkled when I pulsed!', icon: 'sparkle', col: '#7fd0ff', test: (S) => S.sparkles >= 3 },
  { key: 'bloom', name: 'In the Bloom', simple: 'I joined the summer bloom!', icon: 'bloom', col: '#b0f0f0', test: (S) => S.events.has('inBloom') },
  { key: 'met', name: 'Hello!', simple: 'I said hi in the bloom!', icon: 'heart', col: '#ffd0f0', test: (S) => S.events.has('met') },
  { key: 'brood', name: 'Babies on Board', simple: 'I carried my babies on my arms!', icon: 'pouch', col: '#ffc8e0', test: (S) => S.events.has('broodDone') },
  { key: 'release', name: 'Swim Free, Little Ones', simple: 'I let my planulae go!', icon: 'planulae', col: '#a6d8f4', test: (S) => S.events.has('larvaeReleased') },
  { key: 'gendone', name: 'The Cycle Again', simple: 'New planulae swam down to the rocks!', icon: 'planulae', col: '#b0f0b0', test: (S) => S.events.has('generationDone') },
  { key: 'gen2', name: 'Next Generation', simple: 'I started life again as a new planula!', icon: 'planula', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been three colours of moon jelly!', icon: 'rings', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy and a girl jelly!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'jellyfish.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), plankton: 0, copepods: 0, glow: 0, pulses: 0, dashes: 0, catches: 0, buds: 0, pops: 0, licks: 0, stuckMax: 0, dodges: 0, tumbles: 0, taken: 0, ride: 0, slugs: 0, sparkles: 0, fans: 0, cm: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a jelly of this colour and sex has stuck on under a rock */
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
    for (const ev of ['hatched', 'settled', 'pulledIn', 'strobila', 'stack', 'popFree', 'grew', 'schoolGone', 'combJelly', 'ternDip', 'gullDip', 'medusa', 'dodged', 'adult', 'inBloom', 'met', 'broodDone', 'larvaeReleased', 'generationDone', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('tentacles', (p, n) => mark('tentacles' + n));
    Bus.on('visitorGone', (h) => { if (h && (h.kind === 'turtle' || h.kind === 'sunfish')) mark(h.kind + 'Gone'); });
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
    for (const k of ['plankton', 'copepods', 'glow', 'pulses', 'dashes', 'catches', 'buds', 'pops', 'licks', 'stuckMax', 'dodges', 'tumbles', 'taken', 'ride', 'slugs', 'sparkles', 'fans']) note(k, st[k]);
    if (p.stage === 'medusa') note('cm', p.cm);
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
