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
  { key: 'hatch', name: 'Hatched!', simple: 'I hatched!', icon: 'egg', col: '#cfeaf5', test: (S) => S.events.has('hatched') },
  { key: 'salad', name: 'Pond Salad', simple: 'I ate algae!', icon: 'algae', col: '#a6e05a', test: (S) => S.algae >= 1 },
  { key: 'wriggler', name: 'Wriggler Snack', simple: 'I ate a wriggler!', icon: 'wriggler', col: '#e0d6a8', test: (S) => S.wrigglers >= 1 },
  { key: 'legs', name: 'Legs!', simple: 'My back legs grew!', icon: 'legs', col: '#c9f27a', test: (S) => S.events.has('legs') },
  { key: 'breath', name: 'First Breath', simple: 'I breathed air!', icon: 'breath', col: '#bfe8ff', test: (S) => S.gulps >= 1 },
  { key: 'froglet', name: 'Froglet!', simple: 'I am a froglet!', icon: 'froglet', col: '#8fd75f', test: (S) => S.events.has('froglet') },
  { key: 'frog', name: 'A Frog!', simple: 'I am a frog!', icon: 'frog', col: '#4f9a3a', test: (S) => S.events.has('frog') },
  { key: 'hop', name: 'First Hop', simple: 'I hopped!', icon: 'hop', col: '#ffd23f', test: (S) => S.hops >= 1 },
  { key: 'snap', name: 'Snap!', simple: 'I caught a bug!', icon: 'tongue', col: '#f08aa0', test: (S) => S.snaps >= 1 },
  { key: 'dragon', name: 'Dragon Catcher', simple: 'I caught a dragonfly!', icon: 'dragonfly', col: '#7fd0ff', test: (S) => S.dragonflies >= 1 },
  { key: 'night', name: 'Night Hunter', simple: 'I ate at night!', icon: 'moon', col: '#8fa3ff', test: (S) => S.nightEaten >= 8 },
  { key: 'rain', name: 'Rain Frog', simple: 'I ate in the rain!', icon: 'rain', col: '#7fc4ff', test: (S) => S.rainEaten >= 3 },
  { key: 'deep', name: 'Deep Diver', simple: 'I dived from the heron!', icon: 'deep', col: '#4a86c8', test: (S) => S.deepDodges >= 1 },
  { key: 'statue', name: 'Statue', simple: 'I froze. The heron missed!', icon: 'statue', col: '#c0ecff', test: (S) => S.statueDodges >= 1 },
  { key: 'hide', name: 'Hide and Seek', simple: 'I hid under a lily pad!', icon: 'pad', col: '#79c352', test: (S) => S.padDodges >= 1 },
  { key: 'zoom', name: 'Zoom!', simple: 'The nymph missed me!', icon: 'bolt', col: '#ffb347', test: (S) => S.escapes >= 1 },
  { key: 'padhopper', name: 'Pad Hopper', simple: 'I sat on 4 lily pads!', icon: 'pads', col: '#7dd3a0', test: (S) => S.pads >= 4 },
  { key: 'chorus', name: 'Chorus Leader', simple: 'The frogs sang back!', icon: 'note', col: '#f6d743', test: (S) => S.answers >= 3 },
  { key: 'winter', name: 'Winter Sleeper', simple: 'I slept under the ice!', icon: 'snow', col: '#e6f2ff', test: (S) => S.mudSleeps >= 1 },
  { key: 'frogsicle', name: 'Frogsicle', simple: 'I froze solid and woke up!', icon: 'ice', col: '#d0f0ff', test: (S) => S.litterSleeps >= 1 },
  { key: 'eggs', name: 'Egg Layer', simple: 'I laid eggs!', icon: 'eggs', col: '#dff6ff', test: (S) => S.events.has('eggsLaid') },
  { key: 'gen3', name: 'Grandparent', simple: '3 generations!', icon: 'gen', col: '#f4a6c0', test: (S) => S.generation >= 3 },
  { key: 'collector', name: 'Collector', simple: 'I have been 3 kinds!', icon: 'collect', col: '#ffcf70', test: (S) => S.speciesDone >= 3 },
  { key: 'scientist', name: 'Scientist', simple: 'I used the microscope!', icon: 'scope', col: '#c9b6ff', test: (S) => S.events.has('microscope') },
  { key: 'photo', name: 'Photographer', simple: 'I took a photo!', icon: 'camera', col: '#ffffff', test: (S) => S.photos >= 1 },
  { key: 'bookworm', name: 'Bookworm', simple: 'I read 10 facts!', icon: 'book', col: '#f6d743', test: (S) => S.factsRead >= 10 },
  { key: 'plop', name: 'Plop!', simple: 'I made the turtle slide off!', icon: 'turtle', col: '#9ab86a', test: (S) => S.events.has('turtleSlide') },
  { key: 'snakeproof', name: 'Snake Dodger', simple: 'The snake missed me!', icon: 'snake', col: '#c9e070', test: (S) => S.snakeDodges >= 1 },
  { key: 'bandit', name: 'Night Bandit', simple: 'The raccoon could not reach me!', icon: 'raccoon', col: '#b8b8c8', test: (S) => S.raccoonDodges >= 1 },
  { key: 'yuck', name: 'Yuck!', simple: 'The raccoon spat me out!', icon: 'toad', col: '#c9a870', test: (S) => S.events.has('raccoonYuck') },
  { key: 'shallows', name: 'Shallow Swimmer', simple: 'I escaped the big fish!', icon: 'fish', col: '#5a8aa8', test: (S) => S.fishDodges >= 1 },
  { key: 'parade', name: 'Toadlet Parade', simple: 'All the toadlets left together!', icon: 'toadlets', col: '#e0c890', test: (S) => S.events.has('toadParade') },
  { key: 'explorer', name: 'Explorer', simple: 'I visited 3 places!', icon: 'map', col: '#f0c870', test: (S) => S.places >= 3 },
  { key: 'traveller', name: 'Pond Traveller', simple: 'I visited all 5 places!', icon: 'map', col: '#e0a040', test: (S) => S.places >= 5 },
  { key: 'rainwalk', name: 'Rainy Night Walk', simple: 'I hopped to a new pond in the rain!', icon: 'rain', col: '#8fa3ff', test: (S) => S.events.has('overland') },
  { key: 'storytime', name: 'Story Time', simple: 'I read 3 story pages!', icon: 'book', col: '#c9b6ff', test: (S) => S.stories >= 3 },
  { key: 'intune', name: 'In Tune', simple: 'I sang with the chorus!', icon: 'note', col: '#ffe27a', test: (S) => S.events.has('rhythmWin') },
  { key: 'duet', name: 'Duet', simple: 'We sang together!', icon: 'note', col: '#ffb0d0', test: (S) => S.events.has('duet') },
  { key: 'safari', name: 'Safari', simple: '5 safari photos!', icon: 'camera', col: '#a8e0ff', test: (S) => S.safari >= 5 },
  { key: 'keeper', name: 'Pond Keeper', simple: 'I changed the pond!', icon: 'plants', col: '#8fd75f', test: (S) => S.keeper >= 5 },
  { key: 'mayflies', name: 'Mayfly Feast', simple: 'I ate at the mayfly hatch!', icon: 'mayfly', col: '#e8dcb0', test: (S) => S.events.has('mayflyEat') },
  { key: 'bignight', name: 'The Big Night', simple: 'I was there on the big night!', icon: 'moon', col: '#6a7ad9', test: (S) => S.events.has('bigNight') },
  { key: 'gardenfriend', name: 'Garden Friend', simple: 'A ladybug visited!', icon: 'ladybug', col: '#ff9a8a', test: (S) => S.events.has('ladybugSeen') },
  { key: 'firstread', name: 'First Word', simple: 'I read a word!', icon: 'abc', col: '#ffe27a', test: (S) => S.wordsRead >= 1 },
  { key: 'words10', name: 'Ten Words', simple: 'I read 10 words!', icon: 'abc', col: '#bff08a', test: (S) => S.wordsRead >= 10 },
  { key: 'words30', name: 'Word Collector', simple: 'I read 30 words!', icon: 'abc', col: '#8fd75f', test: (S) => S.wordsRead >= 30 },
  { key: 'reader', name: 'Page Reader', simple: 'I read 5 pages!', icon: 'book', col: '#c9b6ff', test: (S) => S.readPages >= 5 },
  { key: 'mission', name: 'Read and Do', simple: 'I did 5 reading missions!', icon: 'star', col: '#ffd23f', test: (S) => S.readMissions >= 5 },
  { key: 'levelup', name: 'Level Up!', simple: 'My reading level went up!', icon: 'up', col: '#7fd0ff', test: (S) => S.events.has('readLevelUp') },
  { key: 'aloud', name: 'Out Loud', simple: 'I read out loud!', icon: 'mic', col: '#ffb0a0', test: (S) => S.events.has('readAloud') },
  { key: 'naturalist', name: 'Naturalist', simple: 'I found 20 pond creatures!', icon: 'guide', col: '#8fd75f', test: (S) => S.seen >= 20 }
];

const Stickers = (function () {
  let unlocked = new Set();
  const S = { events: new Set(), algae: 0, wrigglers: 0, gulps: 0, hops: 0, snaps: 0, dragonflies: 0, nightEaten: 0, rainEaten: 0, deepDodges: 0, statueDodges: 0, padDodges: 0, escapes: 0, pads: 0, answers: 0, mudSleeps: 0, litterSleeps: 0, generation: 1, speciesDone: 0, photos: 0, factsRead: 0, snakeDodges: 0, raccoonDodges: 0, fishDodges: 0, seen: 0, places: 1, stories: 0, safari: 0, keeper: 0, wordsRead: 0, readPages: 0, readMissions: 0 };
  let speciesSet = new Set(), placeSet = new Set(['home']);
  const cache = new Map();
  let onUnlock = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(pkey('stickers')) || '{}');
      unlocked = new Set(d.unlocked || []);
      speciesSet = new Set(d.species || []);
      placeSet = new Set(d.places || ['home']);
      Object.assign(S, d.stats || {}); S.events = new Set(d.events || []);
    } catch (e) { /* fine */ }
  }
  function save() {
    try { localStorage.setItem(pkey('stickers'), JSON.stringify({ unlocked: [...unlocked], species: [...speciesSet], places: [...placeSet], stats: Object.assign({}, S, { events: undefined }), events: [...S.events] })); } catch (e) { /* fine */ }
  }

  function init(cb) {
    onUnlock = cb;
    load();
    Bus.on('hatched', () => mark('hatched'));
    Bus.on('legs', () => mark('legs'));
    Bus.on('gulp', () => { S.gulps++; check(); });
    Bus.on('froglet', () => mark('froglet'));
    Bus.on('frog', (p) => { mark('frog'); speciesSet.add(p.species.key); S.speciesDone = speciesSet.size; check(); });
    Bus.on('hop', () => { S.hops++; check(); });
    Bus.on('snap', () => { S.snaps++; check(); });
    Bus.on('eggsLaid', () => mark('eggsLaid'));
    Bus.on('landedPad', (p) => { S.pads = Math.max(S.pads, p.stats.pads.size + (p.stats._padCount || 0)); check(); });
    Bus.on('hibernate', (p, kind) => { if (kind === 'mud') S.mudSleeps++; else S.litterSleeps++; check(); });
    Bus.on('microscope', () => mark('microscope'));
    Bus.on('photo', () => { S.photos++; check(); });
    Bus.on('factRead', () => { S.factsRead++; check(); });
    Bus.on('chorusAnswer', (n) => { S.answers = Math.max(S.answers, n); check(); });
    Bus.on('heronSafe', (p) => { const r = p.safeReason(); if (r === 'deep') { S.deepDodges++; p.stats.deepDodges++; } else if (r === 'statue') { S.statueDodges++; p.stats.statueDodges++; } else if (r === 'pad') { S.padDodges++; p.stats.padDodges++; } check(); });
    Bus.on('turtleSlide', () => mark('turtleSlide'));
    Bus.on('storyRead', (k, n) => { S.stories = Math.max(S.stories, n); check(); });
    Bus.on('rhythmWin', () => mark('rhythmWin'));
    Bus.on('readWord', (w, n) => { if (n > S.wordsRead) { S.wordsRead = n; check(); } });
    Bus.on('readPage', (k, n) => { S.readPages = Math.max(S.readPages, n); check(); });
    Bus.on('missionDone', (k, n) => { S.readMissions = Math.max(S.readMissions, n); check(); });
    Bus.on('readLevel', (L, why) => { if (why === 'up') mark('readLevelUp'); });
    Bus.on('readAloud', () => mark('readAloud'));
    Bus.on('duet', () => mark('duet'));
    Bus.on('safari', (r, n) => { S.safari = Math.max(S.safari, n); check(); });
    Bus.on('keeperEdit', () => { S.keeper++; check(); });
    Bus.on('bigNight', () => mark('bigNight'));
    Bus.on('seen', (k) => { if (k === 'ladybug') mark('ladybugSeen'); });
    Bus.on('eat', (p, kind) => { if (kind === 'mayfly') mark('mayflyEat'); });
    Bus.on('travel', (kind, how) => { placeSet.add(kind); S.places = placeSet.size; if (how === 'overland') S.events.add('overland'); check(); });
    Bus.on('snakeSafe', () => { S.snakeDodges++; check(); });
    Bus.on('raccoonSafe', () => { S.raccoonDodges++; check(); });
    Bus.on('raccoonYuck', () => mark('raccoonYuck'));
    Bus.on('fishSafe', () => { S.fishDodges++; check(); });
    Bus.on('toadParade', () => mark('toadParade'));
    Bus.on('seen', () => { S.seen++; check(); });
    Bus.on('nymphMiss', (p) => { if (p && p.burst > .2) { S.escapes++; p.stats.escapes++; check(); } });
    Bus.on('eat', (p, kind) => {
      if (kind === 'algae') S.algae++;
      if (kind === 'wriggler') S.wrigglers++;
      if (kind === 'dragonfly') S.dragonflies++;
      S.nightEaten = Math.max(S.nightEaten, p.stats.night);
      S.rainEaten = Math.max(S.rainEaten, p.stats.rain);
      check();
    });
  }

  function setGeneration(g) { S.generation = Math.max(S.generation, g); check(); }
  function mark(ev) { S.events.add(ev); check(); }

  function check() {
    for (const st of STICKERS) {
      if (unlocked.has(st.key)) continue;
      let ok = false;
      try { ok = st.test(S); } catch (e) { ok = false; }
      if (ok) { unlocked.add(st.key); if (onUnlock) onUnlock(st); Bus.emit('sticker', st); }
    }
    save();
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
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * TAU, rr2 = r * (1 + .045 * Math.sin(a * 12));
      i ? ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fillStyle = locked ? '#d9d6cc' : st.col; ctx.fill();
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
    const sp = SPECIES.green;
    switch (icon) {
      case 'egg': Sprites.drawEggMass(ctx, { s: 1.4, count: 12, seed: 3, dev: .5 }); break;
      case 'eggs': Sprites.drawEggMass(ctx, { s: 1.6, count: 18, seed: 9, dev: .1 }); break;
      case 'algae': Sprites.drawAlgae(ctx, { x: 0, y: 0, r: 34 }, 1, 0); break;
      case 'wriggler': ctx.translate(-6, -22); Sprites.drawWriggler(ctx, { s: 2.6 }); break;
      case 'legs': ctx.rotate(-.3); Sprites.drawTadpole(ctx, { s: 1.5, species: sp, legs: 1, kick: 1, swim: .5 }); break;
      case 'breath': ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 3; for (const [x, y, r] of [[-14, 10, 8], [6, -4, 12], [-4, -24, 6], [18, -26, 4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); } break;
      case 'froglet': ctx.translate(2, 6); Sprites.drawFrog(ctx, { s: 1.2, species: sp, pose: 'sit', tail: .3 }); break;
      case 'frog': ctx.translate(2, 6); Sprites.drawFrog(ctx, { s: 1.3, species: sp, pose: 'sit' }); break;
      case 'hop': ctx.translate(-4, 6); ctx.rotate(-.5); Sprites.drawFrog(ctx, { s: 1.1, species: sp, pose: 'jump' }); break;
      case 'tongue': ctx.translate(-22, 6); Sprites.drawFrog(ctx, { s: 1.1, species: sp, pose: 'sit', tongue: 1, tongueLen: 46, tongueDy: -18 }); ctx.translate(74, -18); Sprites.drawFly(ctx, { s: 1.6, wing: 1 }); break;
      case 'dragonfly': ctx.translate(12, 0); Sprites.drawDragonfly(ctx, { s: 1.6, wing: 1 }); break;
      case 'moon': ctx.fillStyle = '#5c6bd9'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(10, -6, 24, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (const [x, y] of [[-22, -22], [-28, 10], [22, 24]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); } break;
      case 'rain': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-10, -10, 16, 0, TAU); ctx.arc(10, -14, 18, 0, TAU); ctx.arc(20, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x - 5, 30); ctx.stroke(); } break;
      case 'deep': ctx.strokeStyle = '#2a6fb8'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-30, -20); ctx.quadraticCurveTo(-15, -30, 0, -20); ctx.quadraticCurveTo(15, -10, 30, -20); ctx.stroke(); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 26); ctx.moveTo(-12, 14); ctx.lineTo(0, 28); ctx.lineTo(12, 14); ctx.stroke(); break;
      case 'statue': ctx.translate(2, 8); Sprites.drawFrog(ctx, { s: 1.2, species: sp, pose: 'crouch' }); ctx.strokeStyle = '#3fb0e6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -6, 34, 0, TAU); ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); break;
      case 'pad': Sprites.drawLilyPad(ctx, { r: 34, bloom: 0, hue: .3, notch: .9 }); ctx.translate(0, 18); Sprites.drawFrog(ctx, { s: .6, species: sp, pose: 'float' }); break;
      case 'bolt': ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(6, -34); ctx.lineTo(-16, 4); ctx.lineTo(-2, 4); ctx.lineTo(-8, 34); ctx.lineTo(16, -6); ctx.lineTo(2, -6); ctx.closePath(); ctx.fill(); break;
      case 'pads': for (const [x, y, r] of [[-20, -14, 16], [16, -8, 20], [-6, 18, 18]]) { ctx.save(); ctx.translate(x, y); Sprites.drawLilyPad(ctx, { r, bloom: 0, hue: .3, notch: x }); ctx.restore(); } break;
      case 'note': ctx.fillStyle = '#5a3c1a'; ctx.font = '900 56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', -8, 0); ctx.font = '900 34px sans-serif'; ctx.fillText('♪', 18, -12); break;
      case 'snow': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 12, 22, 0, TAU); ctx.arc(0, -16, 15, 0, TAU); ctx.fill(); ctx.fillStyle = '#333'; for (const [x, y] of [[-5, -18], [5, -18]]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, -11); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill(); break;
      case 'ice': ctx.translate(0, 8); Sprites.drawFrog(ctx, { s: 1.1, species: SPECIES.woodfrog, pose: 'sleep' }); ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-30 + i * 30, -30); ctx.rotate(i); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-7, -4); ctx.lineTo(7, 4); ctx.moveTo(-7, 4); ctx.lineTo(7, -4); ctx.stroke(); ctx.restore(); } break;
      case 'gen': for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-24 + i * 24, i % 2 ? 10 : -6); Sprites.drawFrog(ctx, { s: .42 + i * .1, species: sp, pose: 'sit' }); ctx.restore(); } break;
      case 'collect': [SPECIES.green, SPECIES.leopard, SPECIES.woodfrog].forEach((s, i) => { ctx.save(); ctx.translate(-24 + i * 24, 4); Sprites.drawFrog(ctx, { s: .5, species: s, pose: 'sit' }); ctx.restore(); }); break;
      case 'scope': ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-6, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(14, 30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(22, 30); ctx.stroke(); ctx.fillStyle = '#4a4a6a'; ctx.beginPath(); ctx.arc(-6, -30, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(-6, 16, 7, 0, TAU); ctx.fill(); break;
      case 'camera': ctx.fillStyle = '#4a4a6a'; rr(ctx, -30, -18, 60, 40, 8); ctx.fill(); ctx.fillRect(-14, -26, 22, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 2, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#3fb0e6'; ctx.beginPath(); ctx.arc(2, 2, 8, 0, TAU); ctx.fill(); break;
      case 'turtle': ctx.translate(-4, 6); Sprites.drawTurtle(ctx, { s: .9, pose: 'bask' }); break;
      case 'snake': ctx.translate(30, 4); Sprites.drawSnake(ctx, { s: .8, pose: 'slither', tongue: 1 }); break;
      case 'raccoon': ctx.translate(-6, 4); Sprites.drawRaccoon(ctx, { s: .8, pose: 'walk' }); break;
      case 'toad': ctx.translate(2, 6); Sprites.drawFrog(ctx, { s: 1.2, species: SPECIES.toad, pose: 'sit' }); break;
      case 'fish': Sprites.drawFish(ctx, { s: 1, ph: 1 }); break;
      case 'toadlets': for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(-30 + i * 20, 10 - (i % 2) * 20); Sprites.drawFrog(ctx, { s: .45, species: SPECIES.toad, pose: i % 2 ? 'jump' : 'sit' }); ctx.restore(); } break;
      case 'guide': ctx.fillStyle = '#3f9a4a'; rr(ctx, -28, -26, 56, 52, 6); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -22, -20, 44, 40, 3); ctx.fill(); ctx.translate(0, 2); Sprites.drawFrog(ctx, { s: .5, species: SPECIES.green, pose: 'sit' }); break;
      case 'mayfly': ctx.scale(3, 3); Sprites.drawMayfly(ctx, { s: 1, ph: 1 }); break;
      case 'ladybug': ctx.scale(3.4, 3.4); Sprites.drawLadybug(ctx, { s: 1 }); break;
      case 'abc': ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c0392b'; ctx.fillText('a', -18, 0); ctx.fillStyle = '#2a6fb8'; ctx.fillText('b', 0, -4); ctx.fillStyle = '#2f7a3a'; ctx.fillText('c', 18, 0); break;
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'up': ctx.fillStyle = '#2a6fb8'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(24, 0); ctx.lineTo(9, 0); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-9, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); break;
      case 'mic': ctx.fillStyle = '#4a4a6a'; rr(ctx, -10, -30, 20, 36, 10); ctx.fill(); ctx.strokeStyle = '#4a4a6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI); ctx.moveTo(0, 13); ctx.lineTo(0, 28); ctx.stroke(); break;
      case 'map': ctx.fillStyle = '#f4e4b8'; ctx.beginPath(); ctx.moveTo(-30, -22); ctx.lineTo(-10, -28); ctx.lineTo(10, -22); ctx.lineTo(30, -28); ctx.lineTo(30, 24); ctx.lineTo(10, 30); ctx.lineTo(-10, 24); ctx.lineTo(-30, 30); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a08050'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#6fb8c8'; for (const [x, y, r] of [[-16, -6, 8], [8, 10, 10], [18, -12, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } ctx.strokeStyle = '#c0392b'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(8, 10); ctx.lineTo(18, -12); ctx.stroke(); ctx.setLineDash([]); break;
      case 'book': ctx.fillStyle = '#2a6fb8'; rr(ctx, -28, -24, 56, 48, 5); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -22, -18, 44, 36, 3); ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; for (let y = -8; y <= 8; y += 8) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); } break;
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
