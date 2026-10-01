/* ============================================================
   stickers.js — the sticker book
   ============================================================
   Achievements drawn as round stickers.  Each has a test that
   looks at the game state; unlocked stickers persist in the
   browser.  Every sticker is also a picture, so a child who is
   still learning to read can collect them without the words.
   ============================================================ */
'use strict';

const STICKERS = [
  { key: 'hatch', name: 'Hatched!', simple: 'I hatched!', icon: 'egg', col: '#ffe27a', test: (S) => S.events.has('hatched') },
  { key: 'firstbite', name: 'First Bite', simple: 'My first aphid!', icon: 'aphid', col: '#a6e05a', test: (S) => S.totalEaten >= 1 },
  { key: 'molt1', name: 'First Molt', simple: 'I shed my skin!', icon: 'L2', col: '#c9f27a', test: (S) => S.molts >= 1 },
  { key: 'bigkid', name: 'Big Kid', simple: 'I am a 4th instar!', icon: 'L4', col: '#8fd75f', test: (S) => S.molts >= 3 },
  { key: 'pupa', name: 'Pupa Power', simple: 'I became a pupa!', icon: 'pupa', col: '#f39a2b', test: (S) => S.events.has('pupated') },
  { key: 'ladybug', name: 'Ladybug!', simple: 'I am a ladybug!', icon: 'adult', col: '#e0392f', test: (S) => S.events.has('eclosed') },
  { key: 'flight', name: 'First Flight', simple: 'I can fly!', icon: 'wings', col: '#7fd0ff', test: (S) => S.events.has('takeoff') },
  { key: 'eggs', name: 'Egg Layer', simple: 'I laid eggs!', icon: 'eggs', col: '#ffd23f', test: (S) => S.events.has('eggsLaid') },
  { key: 'speedy', name: 'Speed Eater', simple: '5 aphids fast!', icon: 'bolt', col: '#ffb347', test: (S) => S.quickBest >= 5 },
  { key: 'night', name: 'Night Hunter', simple: 'I ate at night!', icon: 'moon', col: '#8fa3ff', test: (S) => S.nightEaten >= 8 },
  { key: 'rain', name: 'Rain Hunter', simple: 'I ate in the rain!', icon: 'rain', col: '#7fc4ff', test: (S) => S.rainEaten >= 3 },
  { key: 'statue', name: 'Statue', simple: 'I froze. The bird missed!', icon: 'freeze', col: '#c0ecff', test: (S) => S.frozeSafe >= 1 },
  { key: 'playdead', name: 'Playing Dead', simple: 'I played dead!', icon: 'dead', col: '#ffd9a0', test: (S) => S.playedDead >= 1 },
  { key: 'tough', name: 'Tough Cookie', simple: 'Ants shoved me 5 times!', icon: 'ant', col: '#d9a066', test: (S) => S.shoved >= 5 },
  { key: 'sneaky', name: 'Sneaky', simple: '10 aphids, none dropped!', icon: 'shh', col: '#b7e36a', test: (S) => S.sneakBest >= 10 },
  { key: 'traveller', name: 'World Traveller', simple: 'I landed on all 3 plants!', icon: 'plants', col: '#7dd3a0', test: (S) => S.plantsLanded >= 3 },
  { key: 'winter', name: 'Winter Sleeper', simple: 'I slept all winter!', icon: 'snow', col: '#e6f2ff', test: (S) => S.hibernations >= 1 },
  { key: 'gen3', name: 'Grandparent', simple: '3 generations!', icon: 'gen', col: '#f4a6c0', test: (S) => S.generation >= 3 },
  { key: 'species', name: 'Collector', simple: 'I have been 3 kinds!', icon: 'collect', col: '#ffcf70', test: (S) => S.speciesDone >= 3 },
  { key: 'scientist', name: 'Scientist', simple: 'I used the microscope!', icon: 'scope', col: '#c9b6ff', test: (S) => S.events.has('microscope') },
  { key: 'photo', name: 'Photographer', simple: 'I took a photo!', icon: 'camera', col: '#ffffff', test: (S) => S.photos >= 1 },
  { key: 'bookworm', name: 'Bookworm', simple: 'I read 10 facts!', icon: 'book', col: '#f6d743', test: (S) => S.factsRead >= 10 },
  { key: 'wild', name: 'Big Fish', simple: 'I ate a wild larva!', icon: 'L3', col: '#8a93a8', test: (S) => S.wild >= 1 },
  { key: 'scale', name: 'Scale Buster', simple: 'I ate a scale bug!', icon: 'scale', col: '#c99a6a', test: (S) => S.scales >= 1 },
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
  let unlocked = new Set();
  const S = { events: new Set(), totalEaten: 0, molts: 0, quickBest: 0, nightEaten: 0, rainEaten: 0, frozeSafe: 0, playedDead: 0, shoved: 0, sneakBest: 0, sneakRun: 0, plantsLanded: 0, hibernations: 0, generation: 1, speciesDone: 0, photos: 0, factsRead: 0, wild: 0, scales: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
  let speciesSet = new Set();
  const cache = new Map();
  let onUnlock = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('ladybug.stickers') || '{}');
      unlocked = new Set(d.unlocked || []);
      speciesSet = new Set(d.species || []);
      Object.assign(S, d.stats || {}); S.events = new Set(d.events || []);
    } catch (e) { /* fine */ }
  }
  function save() {
    try { localStorage.setItem('ladybug.stickers', JSON.stringify({ unlocked: [...unlocked], species: [...speciesSet], stats: Object.assign({}, S, { events: undefined }), events: [...S.events] })); } catch (e) { /* fine */ }
  }

  function init(cb) {
    onUnlock = cb;
    load();
    Bus.on('hatched', () => mark('hatched'));
    Bus.on('molted', () => { S.molts++; check(); });
    Bus.on('pupated', () => mark('pupated'));
    Bus.on('eclosed', (p) => { mark('eclosed'); speciesSet.add(p.species.key); S.speciesDone = speciesSet.size; check(); });
    Bus.on('takeoff', () => mark('takeoff'));
    Bus.on('eggsLaid', () => mark('eggsLaid'));
    Bus.on('landed', (p) => { S.plantsLanded = Math.max(S.plantsLanded, p.stats.plantsLanded.size); check(); });
    Bus.on('hibernate', () => { S.hibernations++; check(); });
    Bus.on('microscope', () => mark('microscope'));
    Bus.on('photo', () => { S.photos++; check(); });
    Bus.on('factRead', () => { S.factsRead++; check(); });
    Bus.on('birdSafe', (p) => { if (p.stage === 6) S.playedDead++; else S.frozeSafe++; check(); });
    Bus.on('eat', (p, kind) => {
      S.totalEaten++;
      S.quickBest = Math.max(S.quickBest, p.stats.quick.length);
      S.nightEaten = p.stats.night > S.nightEaten ? p.stats.night : S.nightEaten;
      S.rainEaten = Math.max(S.rainEaten, p.stats.rain);
      S.shoved = Math.max(S.shoved, p.stats.shoved);
      if (kind === 'larva') S.wild++;
      if (kind === 'scale') S.scales++;
      S.sneakRun++; S.sneakBest = Math.max(S.sneakBest, S.sneakRun);
      check();
    });
    Bus.on('aphidDropped', () => { S.sneakRun = 0; });
    Bus.on('readWord', (w, n) => { if (n > S.wordsRead) { S.wordsRead = n; check(); } });
    Bus.on('readPage', (k, n) => { S.readPages = Math.max(S.readPages, n); check(); });
    Bus.on('missionDone', (k, n) => { S.readMissions = Math.max(S.readMissions, n); check(); });
    Bus.on('readLevel', (L, why) => { if (why === 'up') mark('readLevelUp'); });
    Bus.on('readAloud', () => mark('readAloud'));
  }

  function setGeneration(g) { S.generation = Math.max(S.generation, g); check(); }
  function mark(ev) { S.events.add(ev); check(); }

  function check() {
    let any = false;
    for (const st of STICKERS) {
      if (unlocked.has(st.key)) continue;
      let ok = false;
      try { ok = st.test(S); } catch (e) { ok = false; }
      if (ok) { unlocked.add(st.key); any = true; if (onUnlock) onUnlock(st); Bus.emit('sticker', st); }
    }
    if (any) save(); else save();
  }

  function has(key) { return unlocked.has(key); }
  function count() { return unlocked.size; }
  function all() { return STICKERS; }
  function reset() { unlocked = new Set(); save(); }

  /* ---------- drawing ---------- */
  function draw(ctx, st, px, locked) {
    ctx.save();
    ctx.translate(px / 2, px / 2);
    const r = px * .46;
    /* scalloped edge */
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * TAU, rr = r * (1 + .045 * Math.sin(a * 12));
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = locked ? '#d9d6cc' : st.col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = px * .03; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .84, 0, TAU);
    ctx.fillStyle = locked ? '#eeece6' : 'rgba(255,255,255,.75)'; ctx.fill();
    if (locked) { ctx.globalAlpha = .35; ctx.filter = 'grayscale(1)'; }
    const s = px / 100;
    ctx.scale(s, s);
    drawIcon(ctx, st.icon);
    ctx.restore();
  }

  function drawIcon(ctx, icon) {
    const sp = SPECIES.sevenspot;
    switch (icon) {
      case 'egg': Sprites.drawEggCluster(ctx, { s: 1.6, count: 7, seed: 3 }); break;
      case 'eggs': Sprites.drawEggCluster(ctx, { s: 1.9, count: 14, seed: 9 }); break;
      case 'aphid': ctx.rotate(-.6); Sprites.drawAphid(ctx, { s: 3.4, variant: 'green' }); break;
      case 'L2': ctx.rotate(-.7); Sprites.drawLarva(ctx, { s: .62, instar: 2 }); break;
      case 'L3': ctx.rotate(-.7); Sprites.drawLarva(ctx, { s: .72, instar: 3 }); break;
      case 'L4': ctx.rotate(-.7); Sprites.drawLarva(ctx, { s: .8, instar: 4 }); break;
      case 'pupa': ctx.rotate(-1.1); ctx.translate(-20, 6); Sprites.drawPupa(ctx, { s: 1, prog: .6 }); break;
      case 'adult': ctx.rotate(-Math.PI / 2); Sprites.drawAdult(ctx, { s: .62, species: sp }); break;
      case 'wings': ctx.rotate(-Math.PI / 2 + .3); Sprites.drawAdult(ctx, { s: .5, species: sp, open: 1, wingPhase: 1 }); break;
      case 'dead': ctx.rotate(Math.PI / 2); ctx.scale(1, -1); Sprites.drawAdult(ctx, { s: .6, species: sp, tucked: true }); break;
      case 'ant': ctx.rotate(-.5); Sprites.drawAnt(ctx, { s: 2, walk: 1 }); break;
      case 'scale': Sprites.drawScale(ctx, { s: 5 }); break;
      case 'bolt': ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(6, -34); ctx.lineTo(-16, 4); ctx.lineTo(-2, 4); ctx.lineTo(-8, 34); ctx.lineTo(16, -6); ctx.lineTo(2, -6); ctx.closePath(); ctx.fill(); break;
      case 'moon': ctx.fillStyle = '#5c6bd9'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(10, -6, 24, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (const [x, y] of [[-22, -22], [-28, 10], [22, 24]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); } break;
      case 'rain': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-10, -10, 16, 0, TAU); ctx.arc(10, -14, 18, 0, TAU); ctx.arc(20, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x - 5, 30); ctx.stroke(); } break;
      case 'freeze': ctx.strokeStyle = '#3fb0e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.moveTo(-8, -20); ctx.lineTo(0, -12); ctx.lineTo(8, -20); ctx.moveTo(-8, 20); ctx.lineTo(0, 12); ctx.lineTo(8, 20); ctx.stroke(); ctx.restore(); } break;
      case 'snow': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 12, 22, 0, TAU); ctx.arc(0, -16, 15, 0, TAU); ctx.fill(); ctx.fillStyle = '#333'; for (const [x, y] of [[-5, -18], [5, -18]]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, -11); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill(); break;
      case 'shh': ctx.rotate(-.4); Sprites.drawLarva(ctx, { s: .55, instar: 3, walk: 0 }); ctx.font = '900 26px sans-serif'; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.fillText('shh', 0, -26); break;
      case 'plants': for (const [x, c] of [[-24, '#69a84a'], [0, '#4f8a33'], [24, '#7bb05a']]) { ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, -20); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x - 8, -6, 10, 5, -.6, 0, TAU); ctx.ellipse(x + 8, -14, 10, 5, .6, 0, TAU); ctx.fill(); } break;
      case 'gen': for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-22 + i * 22, i % 2 ? 8 : -8); ctx.rotate(-Math.PI / 2); Sprites.drawAdult(ctx, { s: .22 + i * .06, species: sp }); ctx.restore(); } break;
      case 'collect': [SPECIES.sevenspot, SPECIES.fourteenspot, SPECIES.harlequin].forEach((s, i) => { ctx.save(); ctx.translate(-22 + i * 22, 0); ctx.rotate(-Math.PI / 2); Sprites.drawAdult(ctx, { s: .26, species: s }); ctx.restore(); }); break;
      case 'scope': ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-6, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(14, 30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(22, 30); ctx.stroke(); ctx.fillStyle = '#4a4a6a'; ctx.beginPath(); ctx.arc(-6, -30, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(-6, 16, 7, 0, TAU); ctx.fill(); break;
      case 'camera': ctx.fillStyle = '#4a4a6a'; rr(ctx, -30, -18, 60, 40, 8); ctx.fill(); ctx.fillRect(-14, -26, 22, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 2, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#3fb0e6'; ctx.beginPath(); ctx.arc(2, 2, 8, 0, TAU); ctx.fill(); break;
      case 'abc': ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c0392b'; ctx.fillText('a', -18, 0); ctx.fillStyle = '#2a6fb8'; ctx.fillText('b', 0, -4); ctx.fillStyle = '#2f7a3a'; ctx.fillText('c', 18, 0); break;
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'up': ctx.fillStyle = '#2a6fb8'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(24, 0); ctx.lineTo(9, 0); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-9, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); break;
      case 'mic': ctx.fillStyle = '#4a4a6a'; rr(ctx, -10, -30, 20, 36, 10); ctx.fill(); ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI); ctx.moveTo(0, 13); ctx.lineTo(0, 28); ctx.stroke(); break;
      case 'book': ctx.fillStyle = '#e0392f'; rr(ctx, -28, -24, 56, 48, 5); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -22, -18, 44, 36, 3); ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; for (let y = -8; y <= 8; y += 8) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); } break;
    }
  }

  function image(st, px, locked) {
    const key = `${st.key}|${px}|${locked}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    draw(ctx, st, px, locked);
    cache.set(key, c);
    return c;
  }

  return { init, check, has, count, all, image, draw, setGeneration, reset, stats: S };
})();
