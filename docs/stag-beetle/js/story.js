/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics, cards and
   the "a new generation!" choice; smoke.js passes stubs.  Timers
   run on game time (G.time), so time-lapse speeds them up.

     THE STUMP YEARS  G.year 1..7, G.yt 0..1 (spring, summer, autumn,
       winter).  Each year has its own new thing (facts.js YEARS).
       Winter: below the frost line and you sleep; above it, you wait.
       From Year 3 a big enough grub can dig a cocoon in autumn.
     THE CHILD ABOVE  G.yearsAll counts every year, across generations
     THE SUMMER  G.evening 1, 2, 3…  Each evening has its flight.
       He: sap, then a rival (or two, and the sneaky way), to the
       female, then to the log pile.
       She: bite the bark, the sap; say hi; smell out the right wood;
       dig down and lay.  Evening 2 is the child, grown up, on the path.
   ============================================================ */
'use strict';

const Story = (function () {
  let G = null, ui = {}, timers = [];
  const once = {};
  const T = { hunter: null, song: null, quest: null, frostWait: 0, skipCool: 0 };
  const P = () => G.player;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, F0: G.forest }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const card = (k) => { Bus.emit('card', k); };
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; T.hunter = null; T.song = null; T.quest = null; T.frostWait = 0; T.skipCool = 0; }

  /* which rivals you meet on which evening */
  function rivalList() { const k = G.settings.difficulty; return (k === 'easy' ? ['nip', 'bramble', 'duke'] : k === 'hard' ? ['nip', 'bramble', 'rusty', 'thunder', 'duke'] : ['nip', 'rusty', 'thunder', 'duke']).map(key => RIVALS.find(r => r.key === key)); }
  const rivalNow = () => rivalList()[clamp(G.evening - 1, 0, rivalList().length - 1)];
  const isLastEvening = () => G.evening >= rivalList().length;

  /* ---------- the years ---------- */
  function questStart(y) {
    const p = P(), F = G.forest, key = YEARS[y].key;
    if (p.flags['yq' + y]) return;
    p.flags['yq' + y] = true;
    T.quest = { y, key, base: key === 'fungus' ? p.stats.punk : p.stats.eaten };
    hint('year_' + key);
    if (key === 'fungus') { F.spreading = 24; fact('fungus'); }
    else if (key === 'mole') { F.startUnder('mole', p); Bus.emit('moleCame', p); const u = F.under; if (u) { u.y = clamp(p.y - 70, 40, 200); cine({ follow: () => ({ x: u.x, y: u.y }), zoom: 1.8, duration: 3.2, slow: .8, title: 'A mole!' }); } }
    else if (key === 'song') { T.song = { round: 0, n: 3, i: 0, phase: 'call', t: 0, done: 0 }; fact('sing'); Bus.emit('songStart', p); }
    else if (key === 'rain') { Bus.emit('rainCame', p); F.floodOn = true; later(2.4, () => cine({ follow: () => ({ x: WORLD.stumpX, y: 20 }), zoom: 1.5, duration: 3.6, slow: .8, title: 'The rain soaks down' })); F.spreading = 20; fact('rainyear'); later(20, () => { F.floodOn = false; questDone(); }); }
    else if (key === 'badger') { F.startUnder('badger', p); fact('badger'); Bus.emit('badgerCame', p); cine({ follow: () => ({ x: WORLD.stumpX + 30, y: -120 }), zoom: 1.7, duration: 3.6, slow: .8, title: 'Claws at the stump!' }); }
    else if (key === 'feast') { F.spreading = 60; fact('rot'); }
    else if (key === 'neighbour') fact('sing', 4);
  }
  function questDone() {
    const p = P(), q = T.quest; if (!q) return;
    T.quest = null; p.flags['yd' + q.y] = true;
    hint('yeardone'); sound('fanfare');
    G.particles.sparkle(p.x, p.y, 20, '#fff3c0', 30);
    Bus.emit('yearDone', p, q.y);
  }
  function neighbourAnswers() {
    const p = P(), F = G.forest; let g = null, d = 1e9;
    for (const q of F.grubs) { const e = Math.hypot(q.x - p.x, q.y - p.y); if (e < d) { d = e; g = q; } }
    if (!g) return;
    later(.5, () => { g.sing = 1.2; sound('creak', .7); G.particles.text(g.x, g.y - 16, '♪', '#ffe9a0', 16); p.stats.sang++; p.foodHint = { x: g.x, y: g.y }; Bus.emit('answered', p, g); if (T.quest && T.quest.key === 'neighbour') questDone(); });
  }
  function updateSong(dt) {
    const s = T.song; if (!s) return;
    const p = P(), g = G.forest.grubs[0]; s.t += dt;
    if (s.phase === 'call') {
      if (s.t > .75) { s.t = 0; s.i++; if (g) g.sing = .6; sound('creak', .8); if (g) G.particles.text(p.x + 40, p.y - 40, '♪', '#ffe9a0', 18); Bus.emit('songNote', s.i); if (s.i >= s.n) { s.phase = 'answer'; s.i = 0; s.t = 0; hint('songyou'); } }
    } else if (s.phase === 'answer') {
      if (s.t > 10) { s.phase = 'call'; s.i = 0; s.t = 0; hint('songagain'); }
    }
  }
  function songPressed() {
    const s = T.song; if (!s || s.phase !== 'answer') return;
    s.i++; s.t = 0;
    if (s.i >= s.n) {
      s.round++; G.particles.sparkle(P().x, P().y, 14, '#ffe9a0', 26); sound('magic');
      if (s.round >= 2) { P().food += 40; P().stats.choir = (P().stats.choir || 0) + 1; T.song = null; Bus.emit('choir', P()); questDone(); }
      else { s.n++; s.i = 0; s.t = -.6; s.phase = 'call'; hint('songmore'); }
    }
  }
  function newYear() {
    const p = P(), F = G.forest;
    G.yt = 0; G.year++; G.yearsAll++; p.stats.years++;
    F.wood.age(G.year); F.frost = 0; T.frostWait = 0; T.quest = null; T.song = null;
    Bus.emit('newYear', p, G.year);
    if (p.stage === 'pupa') return;
    sound('magic'); fact(G.year === 2 ? 'years' : G.year === 3 ? 'rot' : G.year === 4 ? 'recycler' : G.year === 5 ? 'instar' : G.year === 6 ? 'sizejaws' : 'cocoon');
    cine({ follow: P, zoom: 1.5, duration: 2.6, slow: .8, title: YEARS[G.year].title });
  }
  /* after Year 3, a whole year can go by in a moment (you still eat) */
  function canSkip() { const p = P(); return !!p && p.stage === 'grub' && G.year > FIRST_COCOON_YEAR - 1 && G.year < LAST_YEAR && p.molting <= 0 && G.time > T.skipCool; }
  function skipYear() {
    if (!canSkip()) return false;
    const p = P(); T.skipCool = G.time + 3;
    if (T.quest) { if (T.quest.key === 'rain') G.forest.floodOn = false; T.quest = null; }
    T.song = null; G.forest.under = null;
    p.food = Math.min(p.food + G.diff().full * .13, G.diff().full * BONUS);
    Bus.emit('skippedYear', p); newYear();
    return true;
  }
  function updateYears(dt) {
    const p = P(), F = G.forest, D = G.diff();
    if (p.stage === 'egg') return;
    if (p.stage === 'pupa') { G.yt += dt * .72 / PUPA_T; F.frost = G.yt > .75 ? 1 : 0; if (G.yt >= 1) newYear(); return; }
    if (p.molting > 0 || p.stage === 'chamber') return;
    const y = G.yt, deep = p.y - F.wood.groundAt(p.x) > WORLD.frost + p.r;
    G.frostSlow = false;
    let rate = 1;
    if (y >= .75) {
      F.frost = Math.min(1, F.frost + dt * .5);
      if (deep) { rate = 3.2; if (first('sleep' + G.year)) { hint('sleep'); Bus.emit('firstWinter', p); if (G.year === 1) fact('frost'); } }
      else { G.frostSlow = true; T.frostWait += dt; if (first('frost' + G.year)) hint('frost'); rate = T.frostWait > 12 ? 1 : 0; }
    }
    /* Year 7: the cocoon can not wait past the autumn */
    if (G.year >= LAST_YEAR && y >= .74) rate = 0;
    G.yt += dt / D.yearLen * rate;
    if (G.yt >= .12 && y < .12) questStart(G.year);
    if (G.yt >= .45 && y < .45) { if (G.year === 2 && D.visitors && G.settings.visitors) F.startUnder('woodlice', p); if (G.year === 4 && D.visitors && G.settings.visitors) F.startUnder('centipede', p); }
    if (G.yt >= .6 && y < .6 && !p.full && G.year < LAST_YEAR) hint('autumn');
    if (G.yt >= 1) newYear();
    if (T.quest) {
      const q = T.quest;
      if (q.key === 'fungus' && p.stats.punk - q.base >= 12) questDone();
      if (q.key === 'feast' && p.stats.eaten - q.base >= 60) questDone();
    }
    updateSong(dt);
    if (F.under && F.underNear(p) && Math.random() < dt * 3) G.cam.shake = Math.max(G.cam.shake, .15);
    if (F.flood > .05 && p.y < WORLD.stumpTop + F.flood * 240) { if (first('wet' + G.year)) hint('wetdown'); }
    if (p.full && G.yt >= .5 && first('cocoon' + G.year)) hint(G.year >= LAST_YEAR ? 'lastcall' : 'cocoonready');
  }

  /* ---------- the summer: evenings ---------- */
  function placeFor(n) {
    const p = P(), W = G.forest.wood;
    const spots = p.male ? [null, null, 790, WORLD.pondX - 230, WORLD.lampX - 70, WORLD.pathL, 1040] : [null, null, 790, WORLD.pileX + 340, WORLD.pileX + 90];
    const x = spots[n];
    if (x !== null && x !== undefined) { p.mode = 'ground'; p.perch = null; p.x = x; p.y = W.walkTop(x, 10) - p.feet; p.ang = 0; p.vx = p.vy = 0; }
  }
  function setScent() {
    const p = P(), F = G.forest, fl = p.flags;
    F.scentPath = null;
    if (fl.searching && !p.male) { const s = ['compost', 'fence', 'pile'].map(k => F.sites.find(q => q.key === k)).find(q => !q.tried) || F.sites[2]; F.scentTrail(p.x, p.y - 60, { x: s.x, y: F.wood.walkTop(s.x, 8) - 16 }); }
    else if (fl.toPile || fl.digHere) F.scentTrail(p.x, p.y - 60, { x: WORLD.pileX, y: F.wood.walkTop(WORLD.pileX, 8) - 16 });
    else if (!p.male && fl.wantMeet && !fl.met) { const q = F.apple.paths[2].at_(F.apple.paths[2].len * .6); F.scentPath = F.apple.paths[2]; F.scentTrail(p.x, p.y - 60, { x: q.x, y: q.y - 20 }); }
    else if (!fl.sapDone) F.scentTrail(p.x, p.y - 60, { x: F.sap.x, y: F.sap.y - 22 });
    else if (p.male) { const q = F.ringPath.at_(F.ringPath.len * .5); F.puffs = []; F.scentTo = { x: q.x, y: q.y - 20 }; }
    else { F.puffs = []; F.scentTo = null; }
  }
  function startEvening(n, restoring) {
    const p = P(), F = G.forest, fl = p.flags;
    G.evening = n; G.tod = .79;
    if (!restoring) { fl.sapDone = false; F.scentTo = null; placeFor(n); if (F.kid.done && F.pile < 6) F.pile++; }
    if (p.male) F.sap.on = true;
    else if (n === 1) { if (!fl.sapDone && !F.sap.on) F.sap.flow = 0; } else { F.sap.on = true; fl.sapDone = true; }
    if (!p.male) {
      if (n === 2) fl.wantMeet = true;
      if (n === 3) { fl.searching = true; Bus.emit('smellNight', p); }
      if (n === 4) { fl.searching = false; fl.digHere = true; }
    } else if (fl.champion) { fl.sapDone = true; }
    if (n === 2 && !F.kid.done) { fl.holdStill = true; later(restoring ? .5 : 2.2, () => { if (p.mode !== 'ground') { p.mode = 'ground'; p.y = F.wood.walkTop(p.x, 10) - p.feet; } F.startKid(p); }); }
    setScent();
    if (restoring) return;
    Bus.emit('evening', p, n);
    if (n > 1) { hint(p.male ? 'evening' : ['', '', 'eveningshe2', 'eveningshe3', 'eveningshe4'][n]); sound('magic'); cine({ follow: P, zoom: 1.5, duration: 2.6, slow: .8, title: `Evening ${n}` }); }
      }
  function endEvening(wait = 4) {
    const p = P(), n = G.evening;
    if (p.flags['ev' + n]) return;
    p.flags['ev' + n] = true;
    later(wait, () => {
      if (p.male && isLastEvening()) return;
      for (const r of G.forest.npcs) if (r.mode === 'perch') r.flyAway();
      if (p.mode === 'tossed' || p.busy > 0) { later(2, () => { if (G.evening === n) startEvening(n + 1); }); return; }
      startEvening(n + 1);
    });
  }
  function sendRivals() {
    const p = P(), F = G.forest, R = rivalNow(), len = F.ringPath.len; if (F.rivals().length || p.flags['ev' + G.evening]) return;
    const small = p.lengthMM < SMALL_MALE_MM, losses = p.ringLosses[R.key] || 0;
    const pairUp = small || losses >= 2, a = F.sendRival(R, len * .58, undefined, pairUp);
    if (pairUp) {
      const other = RIVALS[(RIVALS.indexOf(R) + 1) % RIVALS.length];
      const b = F.sendRival(other, len * .58, undefined, true); F.lockPair(a, b);
      T.pairs = (T.pairs || 0) + 1;
      if (small) fact('sneaker');
    }
  }
  function winEvening(p, R) {
    card(R.rivalDef ? R.rivalDef.key : R.key);
    if (isLastEvening()) {
      p.flags.champion = true; p.flags['ev' + G.evening] = true;
      for (const r of G.forest.npcs) if (r !== R && r.male) r.flyAway();
      later(3, () => { hint('female'); const f = G.forest.sendFemale(G.forest.ringPath, G.forest.ringPath.len - 44); fact('short', 4); return f; });
      sound('fanfare'); fact('biggest');
      cine({ follow: P, zoom: 2.2, duration: 3.5, slow: .6, title: p.stats.sneaks > p.stats.wins ? 'The sneakiest beetle!' : 'King of the oak!' });
      Bus.emit('champion', p);
    } else endEvening(3.5);
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint('eggs'); fact('lifecycle'); fact('logpile', 8); fact('rare', 18);
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }
  function boyEnding() {
    const p = P(), F = G.forest; if (p.flags.boyEnd) return;
    p.flags.boyEnd = true; F.pile = 6;
    const f = F.female();
    cine({ follow: () => ({ x: WORLD.pileX, y: -20 }), zoom: 2, duration: 6, slow: .8, title: 'Eggs for a new generation' });
    hint('sheeggs');
    let n = 0;
    const lay = () => { if (n >= 5) return; n++; const a = n * 1.3; F.eggs.push({ x: WORLD.pileX + Math.cos(a) * 60, y: 100 + Math.sin(a) * 24 }); G.particles.sparkle(WORLD.pileX, -6, 8, '#fff3c0', 26); if (n < 5) later(1, lay); };
    later(1, lay);
    later(6.5, () => p.milestone('eggs', generationDone));
    if (f) later(2, () => { f.gone = true; });
  }

  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'egg') return; hint('egg'); fact('egg', 1.8); });
    Bus.on('eggReady', () => hint('hatch'));
    Bus.on('hatched', () => {
      sound('hatch'); hint('eat'); fact('grub');
      cine({ follow: P, zoom: 4.2, duration: 2.6, slow: .5, title: 'Out of the egg!' });
      fact('wood', 10);
      G.yt = .02;
    });
    Bus.on('chewed', (p) => { if (p.stats.eaten > 40 && first('years')) fact('years'); });
    Bus.on('ateFungus', () => { hint('fungus'); fact('fungus'); });
    Bus.on('tight', () => { hint('tight'); fact('molt'); sound('bump'); });
    Bus.on('molting', () => { sound('molt'); cine({ follow: P, zoom: 3.6, duration: MOLT_T + .4, slow: .6, title: 'Moulting!' }); });
    Bus.on('molted', (p, i) => { hint('bigger'); fact(i === 2 ? 'instar' : 'sizejaws'); G.particles.sparkle(p.x, p.y, 24, '#fff3c0', 30); });
    Bus.on('fullGrown', (p) => { sound('fanfare'); if (G.year < LAST_YEAR) fact('cocoon'); });
    Bus.on('deepEnough', () => hint('build'));
    Bus.on('chamberStart', () => hint('building'));
    Bus.on('sang', (p) => { if (T.song) songPressed(); else neighbourAnswers(); });
    Bus.on('under', (u) => { if (u.kind === 'mole') { hint('mole'); fact('mole'); } else if (u.kind === 'centipede') { hint('centipede'); fact('centipede'); } else if (u.kind === 'woodlice') { hint('woodlice'); fact('woodlice'); } else if (u.kind === 'badger') hint('badgerdig'); });
    Bus.on('badgerDig', () => { G.cam.shake = Math.max(G.cam.shake, .2); });
    Bus.on('underGone', (u) => { if (u.kind === 'mole' || u.kind === 'badger') { hint('gone'); if (T.quest && T.quest.key === YEARS[G.year].key) questDone(); } });
    Bus.on('pupated', (p) => { sound('magic'); hint('pupa'); fact('pupa'); fact('waiting', 8); cine({ follow: P, zoom: 3, duration: 3.5, slow: .5, title: 'As big as an orange' }); });
    Bus.on('emerged', (p) => { sound('fanfare'); hint('harden'); fact(p.male ? 'antlers' : 'girljaws'); cine({ follow: P, zoom: 2.8, duration: 3.5, slow: .5, title: p.male ? 'A stag beetle, with antlers!' : 'A stag beetle, with strong jaws!' }); card('stag'); });
    Bus.on('hardened', (p) => { if (!p.flags.digDown) hint('digup'); });
    Bus.on('surfaced', (p) => {
      if (p.flags.digDown) { p.flags.digDown = false; p.flags.digHere = false; G.forest.pile = 6; sound('fanfare'); cine({ follow: () => ({ x: WORLD.pileX, y: -20 }), zoom: 2, duration: 4.5, slow: .7, title: 'Eggs for a new generation' }); later(4.6, generationDone); return; }
      if (p.flags.summer) return;
      p.flags.summer = true; G.yt = .22;
      hint('dusk'); fact('dusk');
      cine({ follow: P, zoom: 1.5, duration: 3.5, slow: .6, title: 'A warm evening in June' });
      startEvening(1);
      later(5, () => hint('flynow'));
    });
    Bus.on('warmup', (p) => { if (first('warmup')) hint('warmup'); });
    Bus.on('firstFlight', (p) => { hint('flying'); fact('whirr'); fact('elytra', 12); });
    Bus.on('takeoff', (p) => { if (G.evening >= 2 && G.diff().visitors && G.settings.visitors && first('bats' + G.evening)) { G.forest.sendBats(G.evening === 2 ? 1 : 2); fact('bat', 3); } });
    Bus.on('puff', (p) => { if (first('puff')) { hint('scent'); fact('scent'); } });
    Bus.on('warmAir', () => { if (first('warmair')) hint('warmair'); });
    Bus.on('bonk', (p, w) => { hint(w === 'lamp' ? 'bonklamp' : 'bonk'); if (w === 'lamp' || w === 'post') fact('moth'); });
    Bus.on('batMiss', () => hint('bat'));
    Bus.on('skip', () => { if (first('skipfact')) hint('skip'); });
    Bus.on('flipped', () => { hint('flipped'); fact('upside'); });
    Bus.on('rightedSelf', () => hint('righted'));
    Bus.on('landed', (p, where) => { if (where === 'branch' && !p.flags.sapDone && first('branch' + G.evening)) hint('onbranch'); if (where === 'ground' && !p.flags.boyEnd && first('groundup' + G.evening)) hint('flyagain'); });
    Bus.on('ateSap', (p) => {
      hint('sapyum'); fact('sap'); fact('tongue', 8); setScent();
      if (p.male) later(1.6, sendRivals);
      else if (G.evening === 1) later(1, () => { const F = G.forest, a = F.sendRival(RIVALS[0], F.ringPath.len * .55), b = F.sendRival(RIVALS[1], F.ringPath.len * .55); F.lockPair(a, b); hint('boysfight'); fact('wrestle', 2); endEvening(9); });
    });
    Bus.on('biteStart', () => { hint('bite'); fact('girljaws'); });
    Bus.on('sapFlows', () => { hint('sapflows'); fact('bark'); });
    Bus.on('rivalLanded', (n) => { const p = P(); if (!p.male) return; if (G.forest.rivals().length >= 2) { if (first('pair' + G.evening)) { hint('pair'); p.stats.pairs = (p.stats.pairs || 0) + 1; } } else if (first('rival' + G.evening)) { hint('rival'); sound('huff'); } Bus.emit('rivalSeen', p); });
    Bus.on('ringStart', (p, r) => { hint('ring'); fact('wrestle'); cine({ follow: () => ({ x: (p.x + r.x) / 2, y: p.y - 20 }), zoom: 3, duration: 2, slow: .9, title: `${r.rivalDef.name}!` }); });
    Bus.on('ringTell', (p, m) => { if (m === 'feint') { if (first('feint')) hint('feint'); } else if (first('tell')) hint('block'); });
    Bus.on('ringBlock', () => { sound('heave'); if (first('blocked')) hint('hook'); });
    Bus.on('ringHook', () => { sound('heave'); });
    Bus.on('ringPush', () => sound('push'));
    Bus.on('ringWon', () => { sound('fanfare'); });
    Bus.on('ringOver', (p, r) => { hint('won'); G.particles.confetti(p.x, p.y - 30, 60); fact(p.lengthMM >= 70 ? 'biggest' : 'wrestle'); winEvening(p, r); });
    Bus.on('ringLost', () => { hint('lost'); sound('toss'); });
    Bus.on('tossedDown', (p) => { hint('tryagain'); const R = rivalNow(); if ((p.ringLosses[R.key] || 0) >= 2 && G.forest.rivals().length < 2) { const F = G.forest, o = RIVALS[(RIVALS.indexOf(R) + 1) % RIVALS.length], a = F.rival(), b = F.sendRival(o, F.ringPath.len * .58); if (a) { a.s = F.ringPath.len * .5; F.lockPair(a, b); } fact('sneaker'); } });
    Bus.on('sneakStart', () => { hint('sneak'); fact('sneaker'); });
    Bus.on('sneakWarn', () => hint('sneakstop'));
    Bus.on('sneakCaught', () => hint('sneakshoo'));
    Bus.on('sneaked', (p) => { hint('sneaked'); sound('fanfare'); const r = G.forest.rival(); winEvening(p, rivalNow()); if (r) p.flags.sneakAny = true; });
    Bus.on('predator', (h) => { hint(h.kind); fact(h.kind); });
    Bus.on('scared', () => { hint('scared'); });
    Bus.on('hunterBored', () => { hint('bored'); });
    Bus.on('kidComing', () => { hint('kid'); });
    Bus.on('kidStopped', () => { hint('kidlook'); cine({ follow: () => ({ x: G.forest.kid.x - 30, y: -100 }), zoom: (G.cam.h || 900) / 330, duration: 3, slow: .8, title: 'Look! A stag beetle!' }); fact('never'); });
    Bus.on('kidLifted', () => hint('lifted'));
    Bus.on('kidPut', (k) => { const p = P(); p.flags.holdStill = false; hint('putdown'); fact('logpile', 4); setScent(); Bus.emit('kidDone', p); });
    Bus.on('met', (p, o) => {
      hint(p.male ? 'metmale' : 'metfemale');
      if (p.male) { const F = G.forest, f = F.female(); if (f) { f.path = null; f.gx = WORLD.pileX - 30; f.mode = 'fly'; f.vy = -120; } p.flags.toPile = true; setScent(); later(2, () => hint('topile')); }
      else { if (o) later(3, () => o.flyAway()); p.flags['ev2'] = false; endEvening(4); }
    });
    Bus.on('sniffed', (p, s) => {
      if (s.key === 'pile') { hint('smellgood'); sound('magic'); p.flags.searching = false; endEvening(2.5); }
      else { hint(s.key === 'fence' ? 'smellfence' : 'smellcompost'); setScent(); }
    });
    Bus.on('digDown', () => { hint('digdown'); fact('dig'); });
    Bus.on('layEgg', (p, n) => { hint(n === 1 ? 'layone' : 'laymoreok'); if (n === 1) fact('lay'); });
    Bus.on('laidAll', (p) => { hint('digoutup'); });
  }

  /* ---------- every frame ---------- */
  function update(dt) {
    const p = P(), F = G.forest, D = G.diff(), vis = G.settings.visitors && D.visitors;
    for (let i = timers.length - 1; i >= 0; i--) { const t = timers[i]; if (t.F0 !== F) { timers.splice(i, 1); continue; } if (G.time >= t.at) { timers.splice(i, 1); t.fn(); } }
    if (p.stage !== 'adult') return updateYears(dt);
    if (!p.flags.summer) return;
    /* the evening never quite ends until the work is done */
    G.tod = Math.min(.825, G.tod + dt / 1500);
    if (p.mode === 'ground' && vis && !F.hunter && F.kid.state === 'away' && !p.flags.boyEnd && !p.flags.genDone) {
      if (T.hunter === null) T.hunter = G.time + 7 + Math.random() * 6;
      if (G.time > T.hunter) { const k = ['magpie', 'cat', 'fox'][(p.stats.hunters = (p.stats.hunters || 0) + 1) % 3]; if (first('hunter' + G.evening)) F.startHunter(k, p); T.hunter = null; }
    }
    /* he follows her to the log pile */
    if (p.male && p.flags.toPile && !p.flags.boyEnd && (p.mode === 'ground' || p.mode === 'climb') && Math.abs(p.x - WORLD.pileX) < 170) boyEnding();
  }

  /* put back what a save does not hold */
  function afterRestore() {
    const p = P(), F = G.forest;
    if (p.stage !== 'adult' || !p.flags.summer) { if (T.quest === null && p.stage === 'grub' && p.flags['yq' + G.year] && !p.flags['yd' + G.year]) { p.flags['yq' + G.year] = false; G.yt = Math.min(G.yt, .11); } return; }
    startEvening(G.evening, true);
    if (p.flags['ev' + G.evening] && !p.flags.champion) { p.flags['ev' + G.evening] = false; later(1, () => endEvening(.1)); }
    if (p.male && p.flags.sapDone && !p.flags.champion && !p.flags['ev' + G.evening]) later(1, sendRivals);
    if (p.male && p.flags.champion && !p.flags.met) later(1, () => F.sendFemale(F.ringPath, F.ringPath.len - 44));
    if (p.male && p.flags.toPile) F.npcs.push(new NPCBeetle(F, { male: false, len: 42, gx: WORLD.pileX - 30, from: -1 }));
    if (!p.male && p.flags.wantMeet && !p.flags.met && G.evening === 2 && F.kid.done) sendMale();
    if (p.flags.boyEnd && !p.flags.genDone) { p.flags.boyEnd = false; later(1, boyEnding); }
    if (p.flags.laid && p.mode === 'ground' && !p.flags.genDone) later(1, generationDone);
  }
  function sendMale() { const F = G.forest, br = F.apple.paths[2], m = new NPCBeetle(F, { male: true, len: 60, rival: RIVALS[2], path: br, s: br.len * .6, from: -1 }); F.npcs.push(m); return m; }
  Bus.on('kidDone', (p) => { if (!p.male) { hint('findhim'); sendMale(); } });

  return { init, bind, reset, update, afterRestore, startEvening, endEvening, generationDone, boyEnding, sendRivals, canSkip, skipYear, rivalList, rivalNow, once, T, get quest() { return T.quest; } };
})();
