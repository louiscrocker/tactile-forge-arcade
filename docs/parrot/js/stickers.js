/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `parrot.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatched', name: 'Out of the Egg', simple: 'I came out of the egg!', icon: 'egg', col: '#fff3c0', test: (S) => S.events.has('hatched') },
  { key: 'fed1', name: 'First Meal', simple: 'Mom and Dad fed me!', icon: 'chick', col: '#ffd9a0', test: (S) => S.feeds >= 1 },
  { key: 'fed8', name: 'Growing Fast', simple: 'I was fed 8 times!', icon: 'chick', col: '#ffc880', test: (S) => S.feeds >= 8 },
  { key: 'named', name: 'My Name', simple: 'I know my name!', icon: 'call', col: '#ffe9a0', test: (S) => S.events.has('named') },
  { key: 'feathers', name: 'Red Feathers', simple: 'I have red feathers!', icon: 'feather', col: '#ffb0a0', test: (S) => S.events.has('feathers') },
  { key: 'squawk', name: 'Squawk!', simple: 'I called, and the toucan went away!', icon: 'toucan', col: '#ffe08a', test: (S) => S.events.has('toucanGone') },
  { key: 'science', name: 'Hello, Scientist', simple: 'A scientist said hello to me!', icon: 'rope', col: '#e6c9a0', test: (S) => S.events.has('climber') },
  { key: 'door', name: 'At the Door', simple: 'I climbed up to the door!', icon: 'hollow', col: '#d8c8b0', test: (S) => S.events.has('atDoor') },
  { key: 'strong', name: 'Strong Wings', simple: 'I flapped and flapped!', icon: 'wing', col: '#bfe3ff', test: (S) => S.events.has('strong') },
  { key: 'fledged', name: 'First Flight', simple: 'I flew for the first time!', icon: 'fledge', col: '#a8d8ff', test: (S) => S.events.has('firstLanding') },
  { key: 'land10', name: 'Good Landings', simple: 'I landed 10 times!', icon: 'tree', col: '#c9e8a0', test: (S) => S.lands >= 10 },
  { key: 'land40', name: 'Branch Hopper', simple: 'I landed 40 times!', icon: 'tree', col: '#a8d880', test: (S) => S.lands >= 40 },
  { key: 'far1', name: 'Over the Trees', simple: 'I flew a long way!', icon: 'wing', col: '#d0f0e0', test: (S) => S.far >= 5000 },
  { key: 'far2', name: 'Long-distance Flier', simple: 'I flew a very long way!', icon: 'wing', col: '#a8e0c0', test: (S) => S.far >= 20000 },
  { key: 'fig1', name: 'Figs!', simple: 'I ate a fig!', icon: 'fig', col: '#e8c0f0', test: (S) => S.figs >= 1 },
  { key: 'fig10', name: 'Fig Fan', simple: 'I ate 10 figs!', icon: 'fig', col: '#d8a0e8', test: (S) => S.figs >= 10 },
  { key: 'clay', name: 'Clay Lick', simple: 'I ate clay with the flock!', icon: 'clay', col: '#f0c0a0', test: (S) => S.clay >= 1 },
  { key: 'nut', name: 'Nutcracker', simple: 'I cracked a nut!', icon: 'nut', col: '#e8c890', test: (S) => S.nuts >= 1 },
  { key: 'nut5', name: 'Strong Beak', simple: 'I cracked 5 nuts!', icon: 'beak', col: '#d8b070', test: (S) => S.nuts >= 5 },
  { key: 'flock', name: 'Up, Everybody!', simple: 'I flew up with the flock!', icon: 'eagle', col: '#cfd8ff', test: (S) => S.events.has('flushed') },
  { key: 'hide', name: 'In the Leaves', simple: 'I hid in the leaves!', icon: 'leaf', col: '#b8e0a0', test: (S) => S.events.has('hidden') },
  { key: 'call', name: 'Where Are You?', simple: 'I called, and my family called back!', icon: 'call', col: '#ffd0e0', test: (S) => S.events.has('found') },
  { key: 'call20', name: 'Loud and Proud', simple: 'I called 20 times!', icon: 'call', col: '#ffb0d0', test: (S) => S.calls >= 20 },
  { key: 'roost', name: 'Good Night', simple: 'I slept in the tall tree!', icon: 'moon', col: '#cfd8ff', test: (S) => S.days >= 1 },
  { key: 'days4', name: 'Four Days Out', simple: 'Four days out of the hollow!', icon: 'sun', col: '#ffe08a', test: (S) => S.days >= 4 },
  { key: 'splash', name: 'Splash!', simple: 'Oops! I found the river.', icon: 'river', col: '#a8d8f0', test: (S) => S.splashes >= 1 },
  { key: 'people', name: 'Wild and Free', simple: 'They looked from far away.', icon: 'boat', col: '#ffe0c0', test: (S) => S.events.has('boat') },
  { key: 'grown', name: 'All Grown Up', simple: 'I am a grown macaw!', icon: 'adult', col: '#ff9a8a', test: (S) => S.events.has('grownUp') },
  { key: 'pair', name: 'Wing to Wing', simple: 'I found a friend for life!', icon: 'pair', col: '#ffb0d0', test: (S) => S.events.has('paired') },
  { key: 'peek', name: 'Anybody Home?', simple: 'I looked into 3 hollows!', icon: 'hollow', col: '#e0d0b0', test: (S) => S.peeks >= 3 },
  { key: 'home', name: 'A Hollow of Our Own', simple: 'We found an empty hollow!', icon: 'box', col: '#e6c9a0', test: (S) => S.events.has('nestFound') },
  { key: 'eggs', name: 'Eggs!', simple: 'There are eggs in our hollow!', icon: 'egg', col: '#fff3c0', test: (S) => S.events.has('laid') },
  { key: 'chickname', name: 'A Name for You', simple: 'I gave my chick a name!', icon: 'parent', col: '#f4a6c0', test: (S) => S.events.has('chickNamed') },
  { key: 'gen2', name: 'Next Generation', simple: 'A new chick hatched!', icon: 'parent', col: '#d9c0e0', test: (S) => S.generation >= 2 },
  { key: 'both', name: 'Both Ways', simple: 'I have been a boy and a girl!', icon: 'pair', col: '#ffcf70', test: (S) => S.formsDone >= 2 },
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
  const KEY = 'parrot.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), feeds: 0, lands: 0, far: 0, figs: 0, clay: 0, nuts: 0, calls: 0, days: 0, splashes: 0, peeks: 0, cards: 0, generation: 1, formsDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
    for (const ev of ['hatched', 'named', 'toucanGone', 'atDoor', 'strong', 'firstLanding', 'grownUp', 'paired', 'nestFound', 'laid', 'chickNamed', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('grew', (p, i) => { if (i >= 2) mark('feathers'); });
    Bus.on('peopleLook', (p, Q) => mark(Q.kind));
    Bus.on('visitorBored', (v, how) => { if (how === 'air') mark('flushed'); if (how === 'leaves') mark('hidden'); });
    Bus.on('lessonDone', (p, k) => { if (k === 'call') mark('found'); });
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
    for (const k of ['feeds', 'lands', 'far', 'figs', 'clay', 'nuts', 'calls', 'days', 'splashes', 'peeks']) note(k, st[k]); note('cards', Cards.count());
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
