/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `snake.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'born', name: 'Hello, World!', simple: 'I wiggled out of my bag!', icon: 'sac', col: '#d8f0ff', test: (S) => S.events.has('born') },
  { key: 'flick', name: 'Tongue Flicker', simple: 'I flicked my tongue 10 times!', icon: 'tongue', col: '#ffd0d0', test: (S) => S.flicks >= 10 },
  { key: 'snack', name: 'First Snack', simple: 'I smelled a snack and ate it!', icon: 'snack', col: '#e8f8c0', test: (S) => S.snacks >= 1 },
  { key: 'snacks', name: 'Snack Finder', simple: 'I found 15 snacks!', icon: 'snack', col: '#c9f2a0', test: (S) => S.snacks >= 15 },
  { key: 'bask', name: 'Sunbather', simple: 'I basked in the sun!', icon: 'bask', col: '#ffe680', test: (S) => S.events.has('basking') },
  { key: 'sunny', name: 'Solar Powered', simple: 'I basked for a whole minute!', icon: 'sun', col: '#ffd23f', test: (S) => S.bask >= 60 },
  { key: 'chill', name: 'Brr!', simple: 'I got too cold and curled up to rest!', icon: 'snow', col: '#cfe4ff', test: (S) => S.events.has('chilled') },
  { key: 'hide', name: 'Hide and Seek', simple: 'I hid under a board!', icon: 'board', col: '#e8d0a8', test: (S) => S.hides >= 1 },
  { key: 'dash', name: 'Zoom!', simple: 'I dashed off fast!', icon: 'snake', col: '#d9f0ff', test: (S) => S.dashes >= 3 },
  { key: 'hawk', name: 'Hawk Dodger', simple: 'A hawk missed me!', icon: 'hawk', col: '#e8d8c0', test: (S) => S.events.has('hawkDodged') },
  { key: 'musk', name: 'Pee-yew!', simple: 'My stinky musk sent a raccoon away!', icon: 'raccoon', col: '#d8e8a0', test: (S) => S.events.has('musk') },
  { key: 'heron', name: 'Heron Watch', simple: 'I saw a great blue heron!', icon: 'heron', col: '#c8d8e8', test: (S) => S.events.has('heron') },
  { key: 'swim', name: 'Swimmer', simple: 'I swam in the pond!', icon: 'swim', col: '#a8d8f4', test: (S) => S.swim >= 60 },
  { key: 'frog', name: 'Plop!', simple: 'A frog jumped into the pond!', icon: 'frog', col: '#b8e8a0', test: (S) => S.events.has('frogPlop') },
  { key: 'fireflies', name: 'Firefly Night', simple: 'I saw fireflies on a summer night!', icon: 'firefly', col: '#3a4a7a', test: (S) => S.events.has('fireflies') },
  { key: 'blue', name: 'Blue Eyes', simple: 'My eyes went cloudy blue before a shed!', icon: 'blueeye', col: '#c8dcf0', test: (S) => S.events.has('blue') },
  { key: 'shed', name: 'New Skin!', simple: 'I crawled out of my old skin!', icon: 'shed', col: '#fff3c0', test: (S) => S.sheds >= 1 },
  { key: 'look', name: 'Skin Detective', simple: 'I looked closely at my old skin!', icon: 'shed', col: '#f0f0e0', test: (S) => S.looked >= 1 },
  { key: 'sheds', name: 'Shed Collector', simple: 'I shed my skin 3 times!', icon: 'shed', col: '#ffe9a8', test: (S) => S.sheds >= 3 },
  { key: 'trail', name: 'Trail Follower', simple: 'I followed the scent trail to the den!', icon: 'trail', col: '#e8c8f0', test: (S) => S.events.has('enterDen') },
  { key: 'frost', name: 'Below the Frost', simple: 'I went down below the frost line!', icon: 'den', col: '#b8c8e0', test: (S) => S.events.has('belowFrost') },
  { key: 'winter', name: 'Winter Rest', simple: 'I rested in the den all winter!', icon: 'winter', col: '#c0c8d8', test: (S) => S.events.has('winterDone') },
  { key: 'spring', name: 'Spring!', simple: 'I crawled out into the spring sun!', icon: 'spring', col: '#b0f0b0', test: (S) => S.events.has('emerged') },
  { key: 'scientist', name: 'Counted!', simple: 'A snake scientist measured me and let me go!', icon: 'measure', col: '#ffd08a', test: (S) => S.events.has('putBack') },
  { key: 'young', name: 'Growing Up', simple: 'I became a young snake!', icon: 'young', col: '#c8f0c8', test: (S) => S.instar >= 3 },
  { key: 'adult', name: 'Grown Up', simple: 'I grew into a grown-up garter snake!', icon: 'adult', col: '#ff9a8a', test: (S) => S.instar >= 4 },
  { key: 'long', name: 'Long Snake', simple: 'I grew to 55 cm long!', icon: 'snake', col: '#ffd23f', test: (S) => S.cm >= 55 },
  { key: 'twowinters', name: 'Two Winters', simple: 'I spent two winters in the den!', icon: 'winter', col: '#d0d8f0', test: (S) => S.winters >= 2 },
  { key: 'race', name: 'On the Trail', simple: 'I followed a girl\'s scent trail!', icon: 'trail', col: '#ffc8e0', test: (S) => S.events.has('girlOut') },
  { key: 'won', name: 'Found Her!', simple: 'I found her first!', icon: 'heart', col: '#ffb0c8', test: (S) => S.wins >= 1 },
  { key: 'tryagain', name: 'Try Again', simple: 'I lost a race and tried again!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('raceLost') && S.wins >= 1 },
  { key: 'met', name: 'Hello!', simple: 'I met another snake in spring!', icon: 'heart', col: '#ffd0e0', test: (S) => S.events.has('met') },
  { key: 'carry', name: 'Keeping Warm', simple: 'I kept my babies warm in the sun!', icon: 'girl', col: '#ffd8f0', test: (S) => S.events.has('babiesReady') },
  { key: 'litter', name: 'A New Litter', simple: 'My babies wiggled out of their bags!', icon: 'babies', col: '#ffe0f0', test: (S) => S.events.has('litterBorn') },
  { key: 'babies', name: 'Big Family', simple: 'I had 15 babies!', icon: 'babies', col: '#ffc0d8', test: (S) => S.babies >= 15 },
  { key: 'gen', name: 'The Whole Life', simple: 'I saw a whole garter snake life!', icon: 'coil', col: '#d8f8c8', test: (S) => S.events.has('generationDone') },
  { key: 'gen2', name: 'Next Generation', simple: 'I started again as one of the babies!', icon: 'baby', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Collector', simple: 'I have been three kinds of garter snake!', icon: 'scales', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy and a girl snake!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
  { key: 'woods', name: 'Explorer', simple: 'I slithered all the way to the woods!', icon: 'log', col: '#c8e0a8', test: (S) => S.events.has('woods') },
  { key: 'hilltop', name: 'Top of the Hill', simple: 'I climbed the rocky hill!', icon: 'rock', col: '#e0d8c0', test: (S) => S.events.has('hill') },
  { key: 'microscope', name: 'Scientist', simple: 'I used the microscope!', icon: 'scope', col: '#c9b6ff', test: (S) => S.events.has('microscope') },
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
  const KEY = 'snake.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), flicks: 0, snacks: 0, bask: 0, hides: 0, dashes: 0, swim: 0, sheds: 0, looked: 0, winters: 0, babies: 0, instar: 0, cm: 0, wins: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a snake of this colour and sex has been born */
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
    for (const ev of ['born', 'basking', 'chilled', 'musk', 'heron', 'frogPlop', 'fireflies', 'blue', 'enterDen', 'belowFrost', 'winterDone', 'emerged', 'putBack', 'girlOut', 'raceLost', 'met', 'babiesReady', 'litterBorn', 'generationDone', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('dodged', (p, h) => { if (h && h.state && (h.state === 'dive' || h.state === 'up')) mark('hawkDodged'); });
    Bus.on('region', (p, r) => { if (r === 'woods') mark('woods'); });
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
    for (const k of ['flicks', 'snacks', 'bask', 'hides', 'dashes', 'swim', 'sheds', 'looked', 'winters', 'babies', 'wins']) note(k, st[k]);
    if (p.stage === 'snake') { note('instar', p.instar); note('cm', p.cm); if (Math.abs(p.x - WORLD.hillC) < 140) mark('hill'); }
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
