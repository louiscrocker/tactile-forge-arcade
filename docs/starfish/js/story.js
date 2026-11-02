/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.  Timers run on
   game time (G.time), so time-lapse speeds them up.
     a spring evening: a mother lets her eggs go on the mussel bed ·
     the larva in the plankton (herring, comb jellies, the grey whale,
     a gull) · sticky arms · back to the shore: settle on a pink rock ·
     the tiny star · the young star and the tide (in: crawl up and eat;
     out: a pool before you dry) · waves to hold on through · visitors
     that never hurt · the child at low tide · the big star: mussels and
     the keystone · the scientist · the winter storm (an arm tip) ·
     spring: stand tall, the eggs or the cloud · next generation
   ============================================================ */
'use strict';

const Story = (function () {
  let G = null, ui = {};
  let timers = [];
  const once = {};
  const T = { school: null, gull: null, hunter: null, wave: null, kid: null, sci: null, winter: null, stormN: 0, storm: null };
  let lastNight = null, lastTide = null, seen = {};

  const P = () => G.player;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* a timer on game time; one made for an old world never fires in a new one */
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, W0: G.world }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; for (const k in T) T[k] = null; T.stormN = 0; lastNight = null; lastTide = null; seen = {}; }

  /* the mother: a big sea star standing tall on the mussel bed at the spring high tide, letting her eggs go */
  function makeMum() {
    const Wd = G.world, S = Wd.ground, x = WORLD.eggX;
    Wd.mum = { x, y: S.topAt(x), cm: 26, form: G.form, face: 1, ph: 0, arch: 1, leaving: false, fade: 0, puff: 0 };
    const p = P(); if (p && p.stage === 'egg') { p.x = x - 30; p.y = S.topAt(x) - 40; }
    Wd.babyBurst(x, S.topAt(x) - 20, 120);
    return Wd.mum;
  }
  function updateMum(dt) {
    const Wd = G.world, m = Wd.mum; if (!m) return;
    m.ph += dt;
    if (m.leaving) { m.arch = Math.max(0, m.arch - dt * .5); m.fade += dt * .15; if (m.fade > 1) Wd.mum = null; }
    else { m.puff -= dt; if (m.puff <= 0) { m.puff = 1.4 + Math.random(); Wd.babyBurst(m.x, m.y - 26, 18); } }
  }

  /* ---------- the big turns ---------- */
  function startWinter() {
    const p = P(), Wd = G.world;
    T.winter = null;
    if (p.flags.storm || p.flags.spring || p.stage !== 'star') return;
    p.flags.storm = true; p.flags.stormHeld = 0;
    Wd.setSeason('winter'); Wd.setStorm(true, 999); G.day += 120;
    for (const h of Wd.hunters) h.state = 'leave';
    T.stormN = 0; T.storm = G.time + 6;
    hint('winter'); fact('winter'); fact('waves', 14);
    cine({ follow: () => ({ x: P().x - 60, y: P().y - 30 }), zoom: 1.6, duration: 4, slow: .7, title: 'Winter storm!' });
    Bus.emit('winter', p);
  }
  function startSpring() {
    const p = P(), Wd = G.world;
    if (p.flags.spring) return;
    p.flags.spring = true; T.storm = null;
    Wd.setSeason('spring'); Wd.setStorm(false, 60); G.day += 90; G.year++;
    /* a spring high tide, and the plankton blooming */
    G.tod = .48;
    Wd.makeGathering(p, p.sex === 'boy' ? 'girl' : 'boy');
    sound('fanfare'); hint('spring'); fact('spring');
    later(5, () => hint(p.sex === 'boy' ? 'findgirl' : 'findboy'));
    cine({ follow: () => ({ x: P().x, y: P().y - 30 }), zoom: 1.4, duration: 4.5, slow: .7, title: 'Spring!' });
    Bus.emit('spring', p);
  }
  /* a boy's ending: the girls let their eggs go, his cloud meets them */
  function boyEnding() {
    const p = P(), Wd = G.world;
    if (p.flags.genDone || p.flags.boyEnd) return;
    p.flags.boyEnd = true;
    const girl = Wd.mates().find(m => m.met) || Wd.mates()[0];
    if (!girl) { generationDone(); return; }
    hint('larvae'); fact('spawn');
    cine({ follow: () => ({ x: girl.x, y: girl.y - 30 }), zoom: 2.2, duration: 6, slow: .8, title: 'Millions of eggs!' });
    let n = 0;
    const burst = () => { if (n >= 6) return; n++; Wd.babyBurst(girl.x, girl.y - girl.w * .45, 60); Wd.babyBurst(p.x, p.y - p.w * .45, 30, true); sound('splash'); if (n < 6) later(.9, burst); };
    later(1, burst);
    later(7, generationDone);
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint('larvae'); fact('lifecycle'); fact('babies', 8); fact('old', 20);
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }
  function keystone() {
    const p = P(), Wd = G.world;
    if (p.flags.keystone) return;
    p.flags.keystone = true;
    Wd.growLife(3);
    sound('magic'); hint('keystone'); fact('keystone'); fact('room', 14);
    const b = Wd.bare[0];
    cine({ follow: () => ({ x: b ? b.x : P().x, y: (b ? Wd.ground.topAt(b.x) : P().y) - 20 }), zoom: 2.4, duration: 4.5, slow: .6, title: 'Room for new life!' });
    Bus.emit('keystone', p);
  }
  /* which visitor comes: a gull to a star out in the air, an otter, a crab or the sunflower star under water */
  function pickVisitor(p) {
    if (p.exposed) return nightAmount(G.tod) < .5 && !p.inPool ? 'gull' : null;
    if (p.shade !== 'sea') return null;
    const list = p.x < WORLD.bedL ? ['crab', 'sunflower', 'otter'] : ['crab', 'otter'];
    const fresh = list.filter(k => !seen[k]);
    const k = fresh.length ? fresh[0] : pick(list);
    seen[k] = true;
    return k;
  }

  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'egg') return; hint('egg'); fact('egg', 1.8); fact('drift', 14); });
    Bus.on('eggReady', () => hint('hatch'));
    Bus.on('hatched', () => {
      sound('hatch'); hint('swim'); fact('hatch');
      cine({ follow: P, zoom: 8, duration: 3, slow: .5, title: 'Hatch!' });
      fact('bipinnaria', 9); fact('plankton', 30);
      T.school = G.time + 40; T.gull = G.time + 25;
      later(5, () => { const m = G.world.mum; if (m) m.leaving = true; });
    });
    Bus.on('ate', (p) => { if (p.stats.plankton === 3) hint('bigger'); if (p.stats.plankton === 10) fact('diatom'); });
    Bus.on('glow', () => { if (first('glow')) fact('glow'); });
    Bus.on('dash', (p) => { if (first('dash1') && p.stage === 'larva') hint('flick'); });
    Bus.on('growing', (p) => { sound('molt'); cine({ follow: P, zoom: 7, duration: 2, slow: .6, title: 'Growing!' }); });
    Bus.on('grew', (p, i) => { hint('grow'); if (i === 2) fact('weeks'); });
    Bus.on('larva3', () => { hint('sticky'); fact('brachiolaria'); });
    Bus.on('missed', (p) => { hint(p.stage === 'star' ? 'rolled' : 'missed'); });
    Bus.on('herring', () => { hint('herring'); fact('herring'); });
    Bus.on('combJelly', () => { if (first('jellyHint')) { hint('jelly'); fact('combjelly'); } });
    Bus.on('whale', (w) => { hint('whale'); fact('whale'); cine({ follow: () => ({ x: (w.x + P().x) / 2, y: (w.y + P().y) / 2 }), zoom: .7, duration: 6, slow: .7, title: 'A grey whale!' }); });
    Bus.on('gullDip', () => { hint('gull'); fact('gull'); });
    Bus.on('gullPass', (b) => { const p = P(); if (!p.swimming) return; if (Math.abs(b.target.x - p.x) < 60 && p.y < G.world.seaLevel() + 30) p.startTumble(80, 40); });
    Bus.on('postlarva', () => { sound('fanfare'); hint('postlarva'); fact('settle'); cine({ follow: P, zoom: 6, duration: 3, slow: .5, title: 'Back to the shore!' }); });
    Bus.on('overShore', () => hint('search'));
    Bus.on('searching', () => hint('search'));
    Bus.on('taken', () => { if (first('takenFact')) fact('mussel'); });
    Bus.on('settled', () => {
      sound('magic'); hint('juvenile'); fact('change'); fact('tiny', 10); fact('tubefeet', 30);
      cine({ follow: P, zoom: 6, duration: 4, slow: .5, title: 'A tiny star!' });
    });
    Bus.on('firstFood', (p, o) => { fact(o.kind === 'spat' ? 'barnacle' : o.kind); });
    Bus.on('full', (p) => hint(p.restReady() ? 'rest' : 'full'));
    Bus.on('resting', (p) => { hint('resting'); fact(p.stats.rests === 0 ? 'water' : p.stats.rests === 1 ? 'eyes' : 'noblood'); sound('molt'); cine({ follow: P, zoom: clamp(160 / (p.w + 20), 1.6, 6), duration: 3, slow: .6, title: 'Growing…' }); });
    Bus.on('grewStar', (p) => { G.particles.sparkle(p.x, p.y - p.w * .2, 20, '#fff3c0', p.w * .6); });
    Bus.on('awake', (p) => {
      G.day += 40;
      if (p.instar === 2) { hint('young'); fact('tide'); fact('hightide', 14); fact('notfish', 40); }
      else if (p.instar === 3) { hint('awake'); fact('mussel', 8); fact('spines', 30); }
      else if (p.instar >= 4) { hint('adult'); fact('colour', 8); fact('cousins', 30); T.sci = G.time + 30; T.winter = G.time + 300; }
    });
    Bus.on('outOfSea', (p) => { if (p.instar >= 2 && G.world.tideDir() < 0 && first('tideout' + G.day + (G.tod < .5 ? 'a' : 'b'))) { hint('tideout'); if (first('lowFact')) { fact('lowtide'); fact('pool', 12); } } });
    Bus.on('seaBack', (p) => { if (p.instar >= 2 && (p.stats.food < 30 || first('tidein' + G.day))) hint('tidein'); });
    Bus.on('drying', () => { hint('dry'); if (first('dryFact')) fact('dry'); });
    Bus.on('curl', () => hint('curl'));
    Bus.on('splashed', () => hint('splash'));
    Bus.on('wetAgain', (p, shade) => { hint('wet'); if (shade === 'pool' && first('poolFact')) fact('pool'); });
    Bus.on('tooDry', () => { if (first('dryEat')) fact('hightide'); });
    Bus.on('pulling', () => { hint('pulling'); fact('pull'); });
    Bus.on('ateFood', (p, o) => {
      p.hungryT = 0;
      if (o.kind === 'mussel') {
        if (first('stomach')) { hint('stomach'); fact('stomach'); }
        const Wd = G.world;
        if (Wd.keystone >= G.diff().keystone && !p.flags.keystone && p.instar >= 3) keystone();
        else if (p.flags.keystone) Wd.growLife(1);
      } else if (first('food_' + o.kind)) fact(o.kind === 'spat' ? 'barnacle' : o.kind);
    });
    Bus.on('snailRoll', () => { if (first('snailFact')) fact('snail'); });
    Bus.on('waveComing', () => { const p = P(); if (p.stage === 'star' && (p.stats.held + p.stats.rolled < 3 || p.flags.storm)) hint(p.flags.storm ? 'storm' : 'hold'); });
    Bus.on('held', (p) => { hint('held'); if (first('holdFact')) fact('hold'); if (p.flags.storm) { T.stormN++; } });
    Bus.on('rolled', (p) => { if (first('wavesFact')) fact('waves'); if (p.flags.storm) T.stormN++; });
    Bus.on('holdOn', (p) => { if (first('holdOnFact')) fact('tubefeet'); });
    Bus.on('predator', (h) => {
      const k = h.kind;
      hint(k === 'gull' ? 'gulllow' : k);
      fact(k === 'gull' ? 'gull' : k);
      if (k === 'sunflower') fact('run', 6);
    });
    Bus.on('dodged', () => hint('dodged'));
    Bus.on('escaped', () => hint('escaped'));
    Bus.on('sniffedOff', () => hint('escaped'));
    Bus.on('kidArrived', () => { hint('kid'); fact('kids'); });
    Bus.on('lifted', () => { hint('lifted'); cine({ follow: () => ({ x: P().x, y: P().y - 10 }), zoom: 2.6, duration: 4, slow: .8, title: 'Look, a sea star!' }); });
    Bus.on('putBack', () => hint('putback'));
    Bus.on('sciArrived', () => { hint('scientist'); fact('scientist'); });
    Bus.on('counted', () => { hint('counted'); sound('shutter'); if (T.winter === null || T.winter > G.time + 120) T.winter = G.time + 90; });
    Bus.on('armTip', () => { hint('armtip'); fact('regrow'); });
    Bus.on('regrown', () => hint('regrown'));
    Bus.on('met', (p) => {
      if (p.sex === 'girl') { hint('arch'); fact('arch'); }
      else { for (const n of G.world.mates()) n.spawning = true; hint('cloud'); fact('arch'); }
    });
    Bus.on('release', (p) => { if (p.sex === 'girl') for (const n of G.world.npcs) if (!n.hearts) n.spawning = true; });
    Bus.on('blow', (p, n) => { if (n === 1) fact(p.sex === 'girl' ? 'egg' : 'spawn'); });
    Bus.on('released', (p) => { if (p.sex === 'boy') boyEnding(); else generationDone(); });
  }

  /* ---------- every frame: visitors, the tide, waves, the child, the scientist, the seasons ---------- */
  function update(dt) {
    const p = P(), Wd = G.world, D = G.diff(), vis = G.settings.visitors;
    for (let i = timers.length - 1; i >= 0; i--) { const t = timers[i]; if (t.W0 !== Wd) { timers.splice(i, 1); continue; } if (G.time >= t.at) { timers.splice(i, 1); t.fn(); } }
    updateMum(dt);
    const night = nightAmount(G.tod) > .5;
    if (p.swimming || p.stage === 'egg') {
      if (lastNight !== null && night !== lastNight && p.stage === 'larva') { hint(night ? 'night' : 'day'); fact('updown'); }
      lastNight = night;
      if (p.stage === 'larva' && vis && p.zinstar >= 2 && !Wd.school && T.school !== null && G.time > T.school && p.growing <= 0) { Wd.startSchool(p); T.school = G.time + 80 + Math.random() * 50; }
      if (p.stage === 'larva' && vis && p.zinstar === 3 && !once.whale && p.food > D.larva[1] + (D.larva[2] - D.larva[1]) * .3 && p.growing <= 0) { once.whale = true; Wd.startWhale(p); }
      if (vis && !night && p.stage === 'larva' && p.y < Wd.seaLevel() + 50 && T.gull !== null && G.time > T.gull) { if (Wd.dip(p)) T.gull = G.time + 50 + Math.random() * 40; }
      return;
    }
    if (p.stage !== 'star' || p.flags.genDone) return;
    const crawling = p.mode === 'crawl' && p.busy <= 0;
    /* the tide turning, for a young star */
    const dir = Wd.tideDir();
    if (lastTide !== null && dir !== lastTide && p.instar >= 2 && !p.flags.spring) { if (dir > 0 && first('flood' + G.day + (G.tod < .5 ? 'a' : 'b'))) Bus.emit('tideTurn', 1); }
    lastTide = dir;
    /* big breakers: now and then for a star near the edge of the sea; one after another in the storm */
    if (T.wave === null) T.wave = G.time + 25 + Math.random() * 20;
    if (G.time > T.wave && !Wd.wave && p.instar >= 2 && (crawling || p.mode === 'curl')) {
      const near = Math.abs(p.y - Wd.seaLevel()) < 60;
      if (p.flags.storm || near || (p.mode === 'curl')) { Wd.startWave(p.flags.storm ? 1.6 : 1); T.wave = G.time + (p.flags.storm ? 7 : 30 + Math.random() * 25); }
      else T.wave = G.time + 5;
    }
    /* visitors: one at a time, never during the storm or spring */
    const kidTime = D.kid && p.instar >= 2 && p.instar <= 3 && !Wd.kid.done && Wd.seaLevel() > 30 && !night;
    if (vis && crawling && p.instar >= 2 && !Wd.hunters.length && !p.flags.storm && !p.flags.spring && Wd.kid.state === 'away' && Wd.sci.state === 'away' && !kidTime) {
      if (T.hunter === null) T.hunter = G.time + 35 + Math.random() * 40;
      if (G.time > T.hunter) { const k = pickVisitor(p); T.hunter = k ? null : G.time + 6; if (k) Wd.startHunter(k, p); }
    }
    /* the child, once: a young star at low tide, by day */
    const low = Wd.seaLevel() > 40;
    if (vis && D.kid && p.instar >= 2 && p.instar <= 3 && !Wd.kid.done && Wd.kid.state === 'away' && crawling && low && !night && p.x > WORLD.lowL - 100) {
      if (T.kid === null) T.kid = G.time + 8;
      if (G.time > T.kid) { T.kid = null; for (const h of Wd.hunters) if (h.state !== 'leave') { h.state = 'leave'; h.t = 0; } Wd.startKid(p); }
    }
    /* the scientist, once: a big star at low tide, by day (or right away after a long wait) */
    if (vis && p.instar >= 4 && !Wd.sci.done && Wd.sci.state === 'away' && crawling && T.sci !== null && G.time > T.sci && (low && !night || G.time > T.sci + 120) && !p.flags.storm && !p.flags.spring) { T.sci = null; Wd.startSci(p); }
    /* a big star always has a winter coming: after the keystone and the scientist, or after a long while */
    if (p.instar >= 4 && !p.flags.storm && !p.flags.spring) {
      if (T.winter === null) T.winter = G.time + 300;
      const ready = (p.flags.keystone && (Wd.sci.done || !vis)) || G.time > T.winter;
      if (ready && crawling && Wd.sci.state === 'away' && G.time > (T.winterMin || 0)) { if (!T.winterMin) T.winterMin = G.time + 8; else startWinter(); }
    }
    /* the keystone, once enough mussels have been eaten by a big enough star */
    if (p.instar >= 3 && !p.flags.keystone && Wd.keystone >= D.keystone && crawling) keystone();
    /* the storm ends after enough big waves, then spring */
    if (p.flags.storm && !p.flags.spring && T.stormN >= D.storm && !Wd.wave && (crawling || p.mode === 'curl')) startSpring();
  }

  /* put back what a save does not hold */
  function afterRestore() {
    const p = P(), Wd = G.world;
    if (p.stage === 'egg') makeMum();
    if (p.stage === 'star' && p.instar >= 4 && !p.flags.storm) { T.sci = G.time + 10; T.winter = G.time + (p.flags.keystone ? 90 : 240); }
    if (p.flags.storm && !p.flags.spring) { Wd.setSeason('winter'); Wd.setStorm(true, 999); T.stormN = p.flags.stormHeld || 0; }
    if (p.flags.spring) { Wd.setSeason('spring'); Wd.makeGathering(p, p.sex === 'boy' ? 'girl' : 'boy'); if (p.flags.met) { const m = Wd.mates()[0]; if (m) m.met = true; if (p.sex === 'boy') for (const n of Wd.mates()) n.spawning = true; } }
    if (p.flags.released && !p.flags.genDone) { if (p.sex === 'boy') boyEnding(); else generationDone(); }
  }

  return { init, bind, reset, update, makeMum, afterRestore, startWinter, startSpring, keystone, boyEnding, generationDone, once, T };
})();
