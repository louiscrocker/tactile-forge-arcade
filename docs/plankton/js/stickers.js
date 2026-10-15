/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `plankton.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Hatched!', simple: 'I hatched into a nauplius!', icon: 'nauplius', col: '#bfe8ff', test: (S) => S.events.has('hatched') },
  { key: 'yolk', name: 'Yolk Power', simple: 'I lived on my yolk!', icon: 'egg', col: '#fff0b0', test: (S) => S.step >= 3 },
  { key: 'firstmeal', name: 'First Meal', simple: 'I ate my first diatom!', icon: 'diatom', col: '#c9f2c0', test: (S) => S.diatoms >= 1 },
  { key: 'diatoms', name: 'Diatom Feast', simple: 'I ate 50 diatoms!', icon: 'plankton', col: '#b7e36a', test: (S) => S.diatoms >= 50 },
  { key: 'chain', name: 'Chain Muncher', simple: 'I ate a chain of diatoms!', icon: 'chain', col: '#d8f0a0', test: (S) => S.chains >= 1 },
  { key: 'glow', name: 'Glowing Sea', simple: 'I made the plankton glow!', icon: 'dino', col: '#8ee8ff', test: (S) => S.glow >= 1 },
  { key: 'glow10', name: 'Light Show', simple: 'I made 10 sparkles!', icon: 'dino', col: '#6ad0f0', test: (S) => S.glow >= 10 },
  { key: 'moult', name: 'Out of My Skin', simple: 'I moulted!', icon: 'skin', col: '#ffe9a8', test: (S) => S.molts >= 1 },
  { key: 'naup6', name: 'Six Stages', simple: 'I was all six nauplius stages!', icon: 'nauplius', col: '#ffd9e6', test: (S) => S.step >= 6 },
  { key: 'copepodite', name: 'A Copepod at Last', simple: 'I grew a long body and a tail!', icon: 'copepodite', col: '#ffc8b0', test: (S) => S.step >= 7 },
  { key: 'jump', name: 'Super Jump', simple: 'I kicked all my legs and jumped!', icon: 'copepod', col: '#d9f0ff', test: (S) => S.jumps >= 1 },
  { key: 'jump10', name: 'Jumpy', simple: 'I jumped 10 times!', icon: 'copepod', col: '#bfe0ff', test: (S) => S.jumps >= 10 },
  { key: 'herring', name: 'Herring Dodger', simple: 'A school of herring missed me!', icon: 'herring', col: '#c8d8e8', test: (S) => S.events.has('schoolGone') },
  { key: 'dodge', name: 'Just in Time', simple: 'I jumped away in time!', icon: 'copepod', col: '#c8f0d0', test: (S) => S.dodges >= 1 },
  { key: 'jelly', name: 'Rainbow Jelly', simple: 'A comb jelly drifted by!', icon: 'combjelly', col: '#e0d6ff', test: (S) => S.events.has('combJelly') },
  { key: 'shark', name: 'Basking Shark!', simple: 'I saw the second biggest fish in the world!', icon: 'basking', col: '#b8c0c8', test: (S) => S.events.has('sharkPassed') },
  { key: 'whale', name: 'Right Whale!', simple: 'A rare right whale swam by!', icon: 'whale', col: '#a8b8d0', test: (S) => S.events.has('whalePassed') || S.events.has('whaleMissed') },
  { key: 'deep', name: 'Into the Dark', simple: 'I hid in the dark all day!', icon: 'deep', col: '#7fa4d8', test: (S) => S.deepDays >= 1 },
  { key: 'updown', name: 'Up and Down', simple: 'I went up at night and down by day, three times!', icon: 'moon', col: '#9ab0e0', test: (S) => S.deepDays >= 3 && S.nightsUp >= 3 },
  { key: 'stage5', name: 'Stage V', simple: 'I became stage five!', icon: 'stage5', col: '#ffcf70', test: (S) => S.step >= 11 },
  { key: 'oil', name: 'Full of Oil', simple: 'I filled my oil sac!', icon: 'oil', col: '#ffd23f', test: (S) => S.events.has('oilFull') },
  { key: 'sleep', name: 'The Long Sleep', simple: 'I slept in the deep for months!', icon: 'sleep', col: '#c0c8d8', test: (S) => S.events.has('woke') },
  { key: 'snow', name: 'Sea Snow', simple: 'I saw marine snow in the deep!', icon: 'snow', col: '#e8eef4', test: (S) => S.events.has('sleepStart') },
  { key: 'adult', name: 'Grown Up', simple: 'I grew into a grown copepod!', icon: 'adult', col: '#ff9a8a', test: (S) => S.step >= 12 },
  { key: 'moults11', name: 'Eleven Moults', simple: 'I moulted eleven times!', icon: 'skin', col: '#fff0d8', test: (S) => S.molts >= 11 },
  { key: 'trail', name: 'Scent Trail', simple: 'We found each other by a scent trail!', icon: 'trail', col: '#ffc8e0', test: (S) => S.events.has('met') },
  { key: 'bloom', name: 'Spring Bloom', simple: 'I saw the spring bloom!', icon: 'bloom', col: '#b0f0b0', test: (S) => S.events.has('bloomTime') },
  { key: 'eggs', name: 'Eggs Away', simple: 'I let my eggs go into the sea!', icon: 'eggs', col: '#a6d8f4', test: (S) => S.events.has('eggsLaid') },
  { key: 'gen2', name: 'Next Generation', simple: 'New eggs hatched into the sea!', icon: 'egg', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been three kinds of copepod!', icon: 'copepod', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy and a girl copepod!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'plankton.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), diatoms: 0, chains: 0, glow: 0, jumps: 0, dodges: 0, molts: 0, deepDays: 0, nightsUp: 0, step: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a copepod of this look and sex has grown up */
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
    for (const ev of ['hatched', 'schoolGone', 'sharkPassed', 'whalePassed', 'whaleMissed', 'combJelly', 'oilFull', 'sleepStart', 'woke', 'met', 'bloomTime', 'eggsLaid', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
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
    for (const k of ['diatoms', 'chains', 'glow', 'jumps', 'dodges', 'molts', 'deepDays', 'nightsUp']) note(k, st[k]);
    note('step', p.step);
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
