/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game's stats; unlocked stickers persist in the
   browser (key `polarbear.stickers`, which a hub page can read).
   Every sticker is also a picture, so a child still learning to
   read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'milk', name: 'Milk!', simple: 'I drank my first milk!', icon: 'milk', col: '#fff4e0', test: (S) => S.drinks >= 1 },
  { key: 'eyes', name: 'Eyes Open', simple: 'My eyes opened!', icon: 'eyes', col: '#bfe0ff', test: (S) => S.events.has('eyesOpen') },
  { key: 'out', name: 'Into the Light', simple: 'I came out of the snow den!', icon: 'cub', col: '#ffe9a8', test: (S) => S.age >= 2 },
  { key: 'play', name: 'Twin Tumble', simple: 'I played with my twin!', icon: 'cubs', col: '#c9f2c0', test: (S) => S.plays >= 1 },
  { key: 'win', name: 'Top Cub', simple: 'I won a play-fight!', icon: 'twin', col: '#ffcf40', test: (S) => S.wins >= 1 },
  { key: 'tryagain', name: 'Up Again', simple: 'I rolled over in the snow and got right up!', icon: 'star', col: '#c9b6ff', test: (S) => S.events.has('tossedDown') },
  { key: 'stand', name: 'Stand Tall', simple: 'I stood up and sniffed the wind!', icon: 'sniff', col: '#d9f0ff', test: (S) => S.windSniffs >= 1 },
  { key: 'slide', name: 'Wheee!', simple: 'I slid down a snowy hill on my tummy!', icon: 'slide', col: '#cfe4ff', test: (S) => S.slides >= 1 },
  { key: 'slide5', name: 'Snow Slider', simple: 'I slid down five times!', icon: 'slide', col: '#9fd0ff', test: (S) => S.slides >= 5 },
  { key: 'fox', name: 'Little Shadow', simple: 'An Arctic fox came by!', icon: 'fox', col: '#e8eef4', test: (S) => S.events.has('foxNear') },
  { key: 'trek', name: 'To the Sea', simple: 'I set off for the sea with Mum!', icon: 'mum', col: '#d9d2c4', test: (S) => S.age >= 3 },
  { key: 'tracks', name: 'Tracker', simple: 'I read some tracks!', icon: 'tracks', col: '#d9e4f0', test: (S) => S.looks >= 1 },
  { key: 'tracks4', name: 'Master Tracker', simple: 'I know four kinds of tracks!', icon: 'paw', col: '#c8d8e8', test: (S) => S.tracks >= 4 },
  { key: 'blizzard', name: 'Blizzard!', simple: 'I curled up behind the rock in a blizzard!', icon: 'blizzard', col: '#b8c0d8', test: (S) => S.shelters >= 1 },
  { key: 'seaice', name: 'Sea Bear', simple: 'I walked on the frozen sea!', icon: 'ice', col: '#cfeaff', test: (S) => S.events.has('onIce') },
  { key: 'wait', name: 'Very Still', simple: 'I waited by a seal hole!', icon: 'hole', col: '#a8d0f0', test: (S) => S.waits >= 1 },
  { key: 'creep', name: 'Creep, Creep', simple: 'I crept up on a seal!', icon: 'seal', col: '#b8c8d4', test: (S) => S.stalks >= 1 },
  { key: 'close', name: 'So Close!', simple: 'I crept right up close to a seal!', icon: 'seal', col: '#8fd0c0', test: (S) => S.closes >= 1 },
  { key: 'feast', name: 'Full Tummy', simple: 'Mum found a meal and shared it!', icon: 'meal', col: '#ffcf70', test: (S) => S.events.has('feast') },
  { key: 'found', name: 'Found Mum', simple: 'I sniffed the wind and found Mum!', icon: 'mum', col: '#ffe27a', test: (S) => S.events.has('mumFound') },
  { key: 'swim', name: 'Swimmer', simple: 'I swam in the icy sea!', icon: 'swim', col: '#7fd0ff', test: (S) => S.events.has('swimStart') },
  { key: 'floes', name: 'Floe to Floe', simple: 'I swam to the shore when the ice broke up!', icon: 'floe', col: '#9fe0ff', test: (S) => S.events.has('ashore') },
  { key: 'warm', name: 'Warm Nose', simple: 'I curled up to get warm!', icon: 'tail', col: '#ffd8c0', test: (S) => S.rests >= 1 },
  { key: 'buggy', name: 'Hello, Scientists', simple: 'I waved to the scientists in the buggy!', icon: 'buggy', col: '#c9d4dc', test: (S) => S.events.has('scientistMet') },
  { key: 'pounce', name: 'Pounce!', simple: 'I pounced on a lemming!', icon: 'lemming', col: '#c9f2c0', test: (S) => S.pounces >= 1 },
  { key: 'pounce6', name: 'Lemming Chaser', simple: 'I pounced six times. They all got away!', icon: 'lemming', col: '#8fd75f', test: (S) => S.pounces >= 6 },
  { key: 'sniff', name: 'Super Nose', simple: 'I sniffed a scent on the wind!', icon: 'scent', col: '#ffe0b0', test: (S) => S.sniffs >= 1 },
  { key: 'scents', name: 'Scent Reader', simple: 'I know four different smells!', icon: 'nose', col: '#f0d8a0', test: (S) => S.scents >= 4 },
  { key: 'aurora', name: 'Northern Lights', simple: 'I saw the northern lights!', icon: 'lights', col: '#a8f0c8', test: (S) => S.events.has('aurora') },
  { key: 'freeze', name: 'Freeze-up', simple: 'The sea froze again!', icon: 'ice', col: '#dfeeff', test: (S) => S.events.has('freezeUp') },
  { key: 'yearling', name: 'One Year Old', simple: 'I am a yearling!', icon: 'yearling', col: '#9ae0a0', test: (S) => S.age >= 4 },
  { key: 'solo', name: 'All by Myself', simple: 'I waited at my own seal hole!', icon: 'hole', col: '#7fc0e8', test: (S) => S.events.has('soloWait') },
  { key: 'alone', name: 'On My Own', simple: 'I set off to live on my own!', icon: 'young', col: '#a8b8d8', test: (S) => S.events.has('wentAlone') },
  { key: 'ridge', name: 'Ice Climber', simple: 'I climbed over a pressure ridge!', icon: 'ridge', col: '#cfe6f6', test: (S) => S.events.has('ridge') },
  { key: 'lead', name: 'Across the Lead', simple: 'I swam across a crack in the ice!', icon: 'lead', col: '#7fb8e8', test: (S) => S.events.has('leadSwim') },
  { key: 'spar', name: 'Play-Sparring', simple: 'I play-sparred with the big bears!', icon: 'spar', col: '#ffc8a0', test: (S) => S.events.has('sparred') },
  { key: 'grown', name: 'Grown Up', simple: 'I am a grown polar bear!', icon: 'bear', col: '#ffd23f', test: (S) => S.age >= 5 },
  { key: 'mate', name: 'A Walk Together', simple: 'I met another bear on the ice!', icon: 'mate', col: '#ffc8e0', test: (S) => S.events.has('met') },
  { key: 'den', name: 'Den Digger', simple: 'I dug a den for my cubs!', icon: 'den', col: '#d9e6f2', test: (S) => S.events.has('denMade') },
  { key: 'nurse', name: 'Milk for Cubs', simple: 'I fed my cubs!', icon: 'milk', col: '#fff4e0', test: (S) => S.nurses >= 1 },
  { key: 'carry', name: 'Carried Home', simple: 'I carried a wandering cub home!', icon: 'cub', col: '#ffd0e0', test: (S) => S.carries >= 1 },
  { key: 'parent', name: 'New Cubs', simple: 'New cubs came out of the snow!', icon: 'parent', col: '#ff9a8a', test: (S) => S.events.has('generationDone') },
  { key: 'big', name: 'Biggest Bear', simple: 'I weigh 400 kilograms!', icon: 'bear', col: '#ffd23f', test: (S) => S.kg >= 400 },
  { key: 'gen2', name: 'Next Generation', simple: 'I am one of the new cubs!', icon: 'newborn', col: '#ffe0f0', test: (S) => S.generation >= 2 },
  { key: 'colours', name: 'Every Coat', simple: 'I have been white, creamy and golden!', icon: 'bear', col: '#ffcf70', test: (S) => S.formsDone >= 3 },
  { key: 'both', name: 'Boy and Girl', simple: 'I have been a boy bear and a girl bear!', icon: 'girl', col: '#ffd0f0', test: (S) => S.sexesDone >= 2 },
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
  const KEY = 'polarbear.stickers';
  let unlocked = new Set(), onUnlock = null, saved = {};
  const S = { events: new Set(), drinks: 0, meals: 0, plays: 0, wins: 0, windSniffs: 0, slides: 0, pounces: 0, sniffs: 0, scents: 0, looks: 0, tracks: 0, waits: 0, stalks: 0, closes: 0, nurses: 0, carries: 0, shelters: 0, rests: 0, age: 0, kg: 0, generation: 1, formsDone: 0, sexesDone: 0, photos: 0, factsRead: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
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
  /* a bear of this coat and sex has made it to the sea ice */
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
    for (const ev of ['eyesOpen', 'tossedDown', 'foxNear', 'onIce', 'swimStart', 'feast', 'mumFound', 'ashore', 'scientistMet', 'aurora', 'freezeUp', 'wentAlone', 'ridge', 'leadSwim', 'met', 'denMade', 'generationDone', 'microscope', 'readAloud']) Bus.on(ev, () => mark(ev));
    Bus.on('waited', (p) => { if (p && p.age === 4) mark('soloWait'); });
    Bus.on('playEnd', (p, n) => { if (n && (n.role === 'young' || n.role === 'bigmale')) mark('sparred'); });
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
    for (const k of ['drinks', 'meals', 'plays', 'wins', 'windSniffs', 'slides', 'pounces', 'sniffs', 'looks', 'waits', 'stalks', 'closes', 'nurses', 'carries', 'shelters', 'rests']) note(k, st[k]);
    note('scents', p.learned.scents.length); note('tracks', p.learned.tracks.length);
    note('age', p.age); note('kg', p.kg);
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
    ctx.clip();
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
