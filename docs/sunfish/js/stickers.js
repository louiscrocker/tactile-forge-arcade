/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `sunfish.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Hatched!', simple: 'I hatched out of my egg!', icon: 'larva', col: '#bfe8ff', test: (S) => S.events.has('hatched') },
  { key: 'plankton', name: 'Plankton Feast', simple: 'I ate 30 bits of plankton!', icon: 'plankton', col: '#c9f2c0', test: (S) => S.plankton >= 30 },
  { key: 'glow', name: 'Glowing Sea', simple: 'I made the plankton glow!', icon: 'plankton', col: '#8ee8ff', test: (S) => S.glow >= 1 },
  { key: 'star', name: 'Spiky Star', simple: 'I grew spikes like a tiny star!', icon: 'starlarva', col: '#ffe9a8', test: (S) => S.events.has('starGrew') },
  { key: 'dash', name: 'Spikes Out!', simple: 'I dashed with my spikes out!', icon: 'starlarva', col: '#ffd9e6', test: (S) => S.events.has('spikes') },
  { key: 'anchovy', name: 'Silver School', simple: 'A school of anchovies swept past me!', icon: 'anchovy', col: '#c8d8e8', test: (S) => S.events.has('schoolGone') },
  { key: 'comb', name: 'Rainbow Jelly', simple: 'A comb jelly drifted by!', icon: 'comb', col: '#e0d6ff', test: (S) => S.events.has('combJelly') },
  { key: 'gull', name: 'Close Call', simple: 'A gull dipped and missed!', icon: 'gull', col: '#e8eef4', test: (S) => S.events.has('gullMissed') },
  { key: 'juvenile', name: 'No Tail!', simple: 'My spikes faded and my rudder grew!', icon: 'juvenile', col: '#d9f0ff', test: (S) => S.events.has('juvenile') },
  { key: 'school', name: 'School Friends', simple: 'I swam with my school!', icon: 'school', col: '#b8e8d8', test: (S) => S.schoolT >= 20 },
  { key: 'krill', name: 'Krill Gulper', simple: 'I ate 20 krill!', icon: 'krill', col: '#ffd8c8', test: (S) => S.krill >= 20 },
  { key: 'fastfish', name: 'Too Fast!', simple: 'A fast fish came by and missed me!', icon: 'dorado', col: '#d8f0a0', test: (S) => S.events.has('dorado') || S.events.has('tuna') },
  { key: 'mola', name: 'A Real Sunfish', simple: 'I became a real sunfish!', icon: 'mola', col: '#c8d8e0', test: (S) => S.events.has('mola') },
  { key: 'dive', name: 'Deep Diver', simple: 'I dived 200 metres down!', icon: 'deep', col: '#7fb4ff', test: (S) => S.deepest >= 200 },
  { key: 'deeper', name: 'Into the Dark', simple: 'I dived 400 metres down!', icon: 'deep', col: '#4a70c0', test: (S) => S.deepest >= 400 },
  { key: 'jelly', name: 'Jelly Snack', simple: 'I slurped up a jelly!', icon: 'jelly', col: '#f0d8f8', test: (S) => S.jellies >= 1 },
  { key: 'jellies', name: 'Jelly Feast', simple: 'I ate 25 jellies!', icon: 'jelly', col: '#e8c0f0', test: (S) => S.jellies >= 25 },
  { key: 'nettle', name: 'Golden Jelly', simple: 'I ate a sea nettle!', icon: 'nettle', col: '#ffd890', test: (S) => S.nettle >= 1 },
  { key: 'salp', name: 'Salp Chain', simple: 'I ate a whole chain of salps!', icon: 'salp', col: '#d8f0f8', test: (S) => S.salp >= 1 },
  { key: 'combeat', name: 'Rainbow Snack', simple: 'I ate a comb jelly!', icon: 'comb', col: '#d8d0ff', test: (S) => S.comb >= 1 },
  { key: 'cold', name: 'Brr!', simple: 'The deep was cold as a fridge!', icon: 'deep', col: '#b8d8ff', test: (S) => S.events.has('cold') },
  { key: 'bask', name: 'Sunbather', simple: 'I lay flat in the sun to warm up!', icon: 'sun', col: '#ffe070', test: (S) => S.events.has('warmed') },
  { key: 'bask5', name: 'Sun Lover', simple: 'I sunbathed 5 times!', icon: 'sun', col: '#ffc840', test: (S) => S.basks >= 5 },
  { key: 'gullhelp', name: 'Bird Helper', simple: 'A gull pecked my sea lice off!', icon: 'gullstand', col: '#f0f4f8', test: (S) => S.pecks >= 1 },
  { key: 'clean', name: 'Squeaky Clean', simple: 'Little fish cleaned me in the kelp!', icon: 'cleaner', col: '#fff0a0', test: (S) => S.events.has('cleaned') },
  { key: 'breach', name: 'Splash!', simple: 'I jumped right out of the sea!', icon: 'mola', col: '#a8e0ff', test: (S) => S.events.has('jumped') },
  { key: 'sealion', name: 'Sea Lion Says Hi', simple: 'A sea lion came for a look!', icon: 'sealion', col: '#e0c8a8', test: (S) => S.events.has('sealion') },
  { key: 'orca', name: 'Orca Pod', simple: 'Orcas swam right past me!', icon: 'orca', col: '#d0d8e0', test: (S) => S.events.has('orca') },
  { key: 'shark', name: 'Blue Shark', simple: 'A blue shark came and missed!', icon: 'shark', col: '#a8c8f0', test: (S) => S.events.has('shark') },
  { key: 'turtle', name: 'Jelly Friend', simple: 'A leatherback turtle swam by!', icon: 'turtle', col: '#c0c8b8', test: (S) => S.events.has('turtle') },
  { key: 'dodge', name: 'Big Flap', simple: 'Something big missed me!', icon: 'fin', col: '#c8e0d0', test: (S) => S.events.has('dodged') },
  { key: 'boat', name: 'Slow Down!', simple: 'A boat slowed down for my fin!', icon: 'boat', col: '#ffd08a', test: (S) => S.events.has('boatSlow') },
  { key: 'net', name: 'Let Go!', simple: 'The fishers let me out of the net!', icon: 'net', col: '#ffe0b0', test: (S) => S.events.has('freed') },
  { key: 'big', name: 'Bigger!', simple: 'I grew to a metre long!', icon: 'mola', col: '#bfe0f0', test: (S) => S.cm >= 100 },
  { key: 'giant', name: 'Giant!', simple: 'I grew into a giant sunfish!', icon: 'giant', col: '#ffd23f', test: (S) => S.events.has('ready') },
  { key: 'heavy', name: 'Heavy as a Car', simple: 'I weighed a tonne!', icon: 'giant', col: '#ff9a8a', test: (S) => S.cm >= 200 },
  { key: 'journey', name: 'To the Warm Sea', simple: 'I swam back to the warm sea!', icon: 'sea', col: '#7fe0e0', test: (S) => S.events.has('arrived') },
  { key: 'hearts', name: 'Hello!', simple: 'I met a sunfish with hearts!', icon: 'heart', col: '#ffc8e0', test: (S) => S.events.has('met') },
  { key: 'cloud', name: 'Little Cloud', simple: 'I let my little cloud go!', icon: 'cloud', col: '#f0f0e8', test: (S) => S.events.has('cloud') },
  { key: 'eggs', name: '300 Million Eggs', simple: 'I let three hundred million eggs go!', icon: 'eggs', col: '#a6d8f4', test: (S) => S.events.has('eggsReleased') },
  { key: 'gen2', name: 'Next Generation', simple: 'My eggs started a new generation!', icon: 'egg', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been three looks of sunfish!', icon: 'sunfish', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy and a girl sunfish!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'sunfish.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), plankton: 0, glow: 0, dashes: 0, krill: 0, jellies: 0, nettle: 0, salp: 0, comb: 0, deepest: 0, basks: 0, pecks: 0, schoolT: 0, cm: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a sunfish of this look and sex has become a real sunfish */
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
    for (const ev of ['hatched', 'spikes', 'schoolGone', 'combJelly', 'gullMissed', 'juvenile', 'dorado', 'tuna', 'mola', 'cold', 'warmed', 'cleaned', 'jumped', 'sealion', 'orca', 'shark', 'turtle', 'dodged', 'boatSlow', 'freed', 'ready', 'arrived', 'met', 'cloud', 'eggsReleased', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('grew', (p) => { if (p.stage === 'larva' && p.zinstar === 2) mark('starGrew'); });
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
    for (const k of ['plankton', 'glow', 'dashes', 'krill', 'jellies', 'nettle', 'salp', 'comb', 'deepest', 'basks', 'pecks', 'schoolT']) note(k, st[k]);
    note('cm', p.cm);
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
