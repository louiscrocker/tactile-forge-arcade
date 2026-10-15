/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.
   Timers run on game time (G.time), so time-lapse speeds them up
   and a test is deterministic.
     the clock (days pass twice as fast as on land: a copepod's
     life is short) · spring → summer → autumn → winter → spring ·
     night and morning hints for the daily journey up and down ·
     herring when you are seen in the light · the basking shark in
     summer · the right whale at stage V · the long sleep · the
     grown-ups' meeting · the eggs · the next generation
   ============================================================ */
'use strict';

const DAY_LENGTH = 240;

const Story = (function () {
  let G = null, ui = {}, bound = false;
  let timers = [];
  const once = {};
  const T = { school: 0, shark: false, whale: false, lastNight: null, dayCounted: -1, nightCounted: -1 };

  const P = () => G.player;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* a timer on game time; one made for an old world never fires in a new one */
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, W0: G.world }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };
  const vis = () => G.settings.visitors !== false;

  function init(game, hooks) {
    G = game; if (hooks) ui = hooks;
    if (bound) return; bound = true;
    on('started', () => { hint('egg'); fact('egg', 2); });
    on('eggReady', () => hint('hatch'));
    on('hatched', () => { sound('hatch'); hint('yolk'); fact('hatch'); cine({ follow: P, zoom: 9, duration: 2.6, slow: .5, title: 'Hatch!' }); fact('nauplius', 14); fact('bloom', 34); });
    on('yolkBump', () => fact('yolk'));
    on('tight', () => hint('tight'));
    on('molting', (p) => { sound('molt'); cine({ follow: P, zoom: clamp(46 / (p.r + 3), 4, 10), duration: MOLT_T + .3, slow: .6, title: p.step + 1 === 12 ? 'Grown up!' : 'Moulting!' }); });
    on('molted', (p, step) => {
      hint(step === 3 ? 'eat' : step === 11 ? 'oil' : 'bigger'); fact('moult');
      if (step === 4) fact('feeding', 8);
      if (step === 5) fact('oxygen', 10);
      if (step === 8) { fact('updown', 4); fact('dark', 30); }
      if (step === 9) { G.world.setSeason('summer'); G.day += 30; fact('red', 20); }
      if (step === 10) { fact('foodweb', 20); fact('size', 50); }
    });
    on('canEat', () => fact('diatom'));
    on('copepodite', () => { sound('fanfare'); hint('copepodite'); fact('copepodite'); fact('antennae', 20); fact('eye', 45); fact('legs', 70); G.day += 12; });
    on('stage5', () => { hint('oil'); fact('oil'); fact('omega', 30); });
    on('oilFull', () => { hint('oilfull'); fact('diapause'); });
    on('sleepStart', (p) => {
      G.world.setSeason('autumn'); G.day += 30; hint('sleep'); fact('deepcold', 1); fact('snow', 6);
      cine({ follow: P, zoom: 3, duration: 4, slow: .6, title: 'The long sleep' });
      later(SLEEP_T * .5, () => { if (P().mode === 'sleep') { G.world.setSeason('winter'); G.day += 60; } });
    });
    on('woke', () => { const W = G.world; W.setSeason('winter'); W.wakeAll(); hint('wake'); fact('wake'); sound('fanfare'); });
    on('adult', (p) => {
      sound('fanfare'); hint('adult'); fact('boygirl', 3);
      if (typeof Stickers !== 'undefined') Stickers.lifeDone(G.form, G.sex);
      later(4, () => arrangeMate());
    });
    on('girlTrail', () => { hint('trail'); fact('trail'); });
    on('boyComing', () => { fact('trail'); });
    on('boyArrived', () => hint('meet'));
    on('met', (p, m) => {
      sound('magic');
      if (p.sex === 'boy') { hint('met'); later(3, nextSpring); }
      else {
        if (m) { m.mode = 'leave'; m.face = -sign(p.x - m.x) || 1; }
        G.world.setSeason('spring'); G.world.bloom = 1; G.day += 40;
        hint('rise'); fact('bloom', 2); fact('eggs', 20); Bus.emit('bloomTime', p);
      }
    });
    on('eggsReady', (p) => {
      hint(p.y < 260 ? 'ready' : 'rise');
      if (nightAmount(G.tod) < .6) { G.tod = .9; cine({ follow: P, zoom: 5, duration: 2.5, slow: .6, title: 'Night falls…' }); }
    });
    on('layStart', () => hint('lay'));
    on('eggsLaid', () => { hint('laid'); generationDone(); });
    on('glow', () => { if (first('glow')) { hint('glow'); fact('glow'); fact('metridia', 40); } });
    on('herring', () => { hint('herring'); fact('herring'); });
    on('dodged', (p, what) => { hint(what === 'whale' ? 'whalemiss' : 'dodged'); if (first('jumpFact')) fact('jump'); });
    on('missed', () => hint('missed'));
    on('jump', () => { if (first('jumpFirst')) fact('jump', 1); });
    on('combJelly', () => { if (first('jellyHint')) { hint('jelly'); fact('combjelly'); } });
    on('basking', (w) => { hint('basking'); fact('basking'); cine({ follow: () => ({ x: (w.x + P().x) / 2, y: (w.y + P().y) / 2 }), zoom: .7, duration: 5, slow: .7, title: 'A basking shark!' }); });
    on('whale', (w) => { hint('whale'); fact('rightwhale'); fact('baleen', 14); cine({ follow: () => ({ x: (w.x + P().x) / 2, y: P().y }), zoom: 1.3, duration: 5, slow: .6, title: 'A right whale!' }); });
    on('whaleMissed', () => { hint('whalemiss'); fact('whalefood', 3); });
    on('exposed', () => hint('seen'));
    on('seen', (p) => {
      const W = G.world;
      if (vis() && G.diff().fish && !W.school && !W.whale && !W.shark) { W.startSchool(p); T.school = G.time + 70; }
      else { hint('seen'); later(4, () => { const q = P(); q.flags.seenNow = false; q.safe = Math.max(q.safe, .5); }); }
    });
    on('schoolGone', () => { const p = P(); if (!p) return; p.flags.seenNow = false; p.safe = Math.max(p.safe, .5); });
  }
  function on(ev, fn) { Bus.on(ev, (...a) => { if (G && G.world) fn(...a); }); }
  function reset() { timers = []; for (const k in once) delete once[k]; T.school = 0; T.shark = false; T.whale = false; T.lastNight = null; T.dayCounted = -1; T.nightCounted = -1; }

  /* a new life: the egg drifting near the top, its mother swimming off after letting her eggs go */
  function setup() {
    reset();
    const p = P(), W = G.world;
    G.tod = .86; G.moon = .5; W.setSeason('spring'); W.bloom = 1;
    W.mum = { x: p.x - 14, y: p.y - 6, t: 0, ph: 0, face: -1, form: G.form };
    W.eggBurst(p.x - 6, p.y, 34);
    T.school = G.time + 40;
  }
  /* for a boy, a girl's trail; for a girl, a boy comes along hers */
  function arrangeMate() {
    const p = P(), W = G.world;
    if (p.step !== 12 || p.flags.met || W.mate) return;
    if (p.sex === 'boy') W.sendGirl(p);
    else { hint('wait'); later(7, () => { if (!P().flags.met && !G.world.mate) G.world.sendBoy(P()); }); }
  }
  /* a boy's ending: in the spring the girl he met lets her eggs go into the bloom */
  function nextSpring() {
    const p = P(), W = G.world;
    if (p.flags.genDone || p.flags.springShown) return;
    p.flags.springShown = true;
    W.setSeason('spring'); W.bloom = 1; G.day += 50; G.tod = .88;
    p.y = Math.min(p.y, 140); p.x = clamp(p.x, WORLD.walkL + 100, WORLD.walkR - 100);
    let m = W.mate;
    if (!m) m = W.mate = { role: 'girl', sex: 'girl', x: p.x + 40, y: p.y, vx: 0, vy: 0, ph: 0, face: -1, mode: 'wait', step: 12, form: G.form, met: true };
    m.mode = 'wait'; m.x = p.x + 40; m.y = p.y - 6; m.laying = true;
    hint('nextspring'); fact('eggs'); Bus.emit('bloomTime', p);
    cine({ follow: () => ({ x: m.x, y: m.y }), zoom: 4, duration: 6, slow: .8, title: 'The next spring…' });
    let n = 0;
    const burst = () => { if (G.world !== W || n >= 5) return; n++; W.eggBurst(m.x + 4, m.y + 3, 26); sound('splash'); later(1, burst); };
    later(1.2, burst);
    later(7, () => P().milestone('eggs', () => { if (W.mate) { W.mate.mode = 'leave'; W.mate.laying = false; } generationDone(); }));
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint(p.sex === 'girl' ? 'laid' : 'done'); fact('lifecycle');
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }
  /* put back what a save does not hold: timers and the other copepod */
  function afterRestore() {
    reset();
    const p = P(), W = G.world;
    T.school = G.time + 40;
    if (p.step >= 9) T.shark = true;
    if (p.step >= 12 || p.flags.slept) T.whale = true;
    if (p.step === 12 && !p.flags.met) later(2, arrangeMate);
    if (p.step === 12 && p.flags.met && p.sex === 'boy' && !p.flags.genDone) { p.flags.springShown = false; later(2, nextSpring); }
  }

  /* ---------- the clock, the world, you, and the director, every tick ---------- */
  function simulate(dt) {
    const p = P();
    if (G.settings.clock !== false && p.mode !== 'lay') { const prev = G.tod; G.tod = (G.tod + dt / DAY_LENGTH * 2) % 1; if (G.tod < prev) { G.day++; G.moon = (G.moon + 1 / 29.5) % 1; } }
    G.night = nightAmount(G.tod);
    G.time += dt;
    G.world.update(dt, G.tod, p);
    p.update(dt);
    update(dt);
  }
  /* how many ticks to run per frame: the waits are time-lapsed */
  function warp() {
    const p = P(), W = G.world;
    if (typeof Cinematic !== 'undefined' && Cinematic.active) return 1;
    if (p.mode === 'lay' || p.busy > 0) return 1;
    if (p.stage === 'egg' && !p.flags.eggReady) return 4;
    if (p.mode === 'sleep') return 4;
    if (G.fast) return 4;
    /* hiding in the dim water by day, waiting for night */
    if (p.step >= 7 && p.mode === 'swim' && G.night < .2 && W.light(p.y) < .05 && !W.school && !W.whale && !W.shark && !(p.step === 12 && W.mate)) return 4;
    return 1;
  }
  function update(dt) {
    for (let i = timers.length - 1; i >= 0; i--) { const t = timers[i]; if (t.W0 !== G.world) { timers.splice(i, 1); continue; } if (G.time >= t.at) { timers.splice(i, 1); t.fn(); } }
    const p = P(), W = G.world, D = G.diff();
    if (p.stage === 'egg' || p.flags.genDone && p.step !== 12) return;
    const night = G.night > .5;
    /* the daily journey: hints at dusk and dawn for a copepodite */
    if (p.step >= 7 && p.mode === 'swim') {
      if (T.lastNight !== null && night !== T.lastNight && !(p.step === 12 && p.flags.met)) { hint(night ? 'night' : 'day'); if (!night && p.flags.met) {} }
      if (night && p.y < 150 && T.nightCounted !== G.day) { T.nightCounted = G.day; p.stats.nightsUp++; }
      if (!night && W.light(p.y) < .05 && T.dayCounted !== G.day) { T.dayCounted = G.day; p.stats.deepDays++; if (first('daywait')) hint('daywait'); }
      if (G.moon > .45 && G.moon < .55 && night && first('moonFact')) fact('moon');
    }
    T.lastNight = night;
    if (!vis() || p.mode !== 'swim') return;
    /* herring sweep through the light by day now and then */
    if (D.fish && p.step >= 7 && !night && p.y < 200 && !W.school && !W.whale && G.time > T.school) { W.startSchool(p); T.school = G.time + 70 + Math.random() * 40; }
    /* the basking shark in summer, near the top */
    if (!T.shark && p.step >= 9 && p.step <= 10 && !night && p.y < 220 && !W.school) { T.shark = true; W.startShark(p); }
    /* the right whale skims a cloud of stage V copepods */
    if (!T.whale && p.step === 11 && p.oil > .2 && !W.school && !W.shark) { T.whale = true; W.startWhale(p); }
    /* a grown-up girl, met, rises to the bloom */
    if (p.step === 12 && p.sex === 'girl' && p.flags.met && !p.flags.eggsReady && p.y < 200 && first('atBloom')) hint('eggfood');
  }

  /* ---------- debug and test jumps (?stage=…) ---------- */
  function toStep(step, frac = .4) {
    const p = P(), W = G.world, D = G.diff();
    if (p.stage === 'egg') { p.stage = 'nauplius'; p.mode = 'swim'; }
    W.mum = null; W.eggs.length = 0;
    p.step = step; p.stage = p.stageFor(step); p.mode = 'swim'; p.tight = false;
    p.yolkT = step <= 2 ? D.yolk * frac : 0; p.food = stepNeed(D, step) * frac;
    if (step === 11) p.oil = clamp(frac, 0, 1);
    for (let s = 0; s < step; s++) p.flags['mo' + s] = true;
    for (const k of ['hatch', 'feed', 'copepodite', 'stage5', 'sleep', 'adult']) p.flags['m_' + k] = true;
    T.shark = true; T.whale = true; T.school = G.time + 60;
    if (step >= 9) W.setSeason('summer');
    if (step === 12) { p.flags.slept = p.flags.woke = p.flags.oilFull = true; p.oil = .6; W.setSeason('winter'); }
    p.y = step >= 7 ? 120 : 70;
    if (typeof Cinematic !== 'undefined') Cinematic.stop();
  }
  function jumpTo(st, q = {}) {
    const p = P(), W = G.world, num = (k, d) => (q[k] !== undefined && q[k] !== null && q[k] !== '' && Number.isFinite(+q[k]) ? +q[k] : d);
    const n = /^n([1-6])$/.exec(st), c = /^c([1-5])$/.exec(st);
    if (st === 'hatch') { p.eggT = 5; p.flags.eggReady = true; p.crack = .6; }
    else if (n) { toStep(+n[1], num('frac', .4)); G.tod = .45; }
    else if (c) { toStep(6 + +c[1], num('frac', .4)); G.tod = .9; }
    else if (st === 'tight') { toStep(4, 1); p.tight = true; G.tod = .45; }
    else if (st === 'moult') { toStep(8, 1); p.tight = true; p.flags.mo8 = true; p.mode = 'moult'; p.molting = MOLT_T * .6; G.tod = .9; }
    else if (st === 'day' || st === 'seen') { toStep(9, .5); G.tod = .45; p.y = st === 'seen' ? 40 : 420; if (st === 'seen') p.safe = .2; }
    else if (st === 'night') { toStep(9, .5); G.tod = .92; p.y = 60; }
    else if (st === 'herring') { toStep(9, .5); G.tod = .45; p.y = 70; W.startSchool(p); W.school.x = p.x - W.school.dir * 170; }
    else if (st === 'jelly') { toStep(5, .5); const j = W.makeJelly(p.x + 30, p.y - 6); j.r = 18; W.jellies.push(j); G.tod = .45; }
    else if (st === 'glow') { toStep(8, .5); G.tod = .95; p.y = 60; for (let k = 0; k < 14; k++) W.plankton.push({ x: p.x + (Math.random() - .5) * 60, y: p.y + (Math.random() - .5) * 40, kind: 'dino', ph: Math.random() * 6, glow: Math.random(), rot: 0, eaten: false, sp: .5 }); }
    else if (st === 'shark') { toStep(9, .5); G.tod = .45; p.y = 90; T.shark = true; W.startShark(p); W.shark.x = p.x - 520; }
    else if (st === 'whale') { toStep(11, .6); G.tod = .5; p.y = 160; T.whale = true; W.startWhale(p); W.whale.x = p.x - W.whale.dir * 330; W.whale.open = 1; }
    else if (st === 'stage5') { toStep(11, num('frac', .5)); G.tod = .9; p.y = 80; }
    else if (st === 'sink') { toStep(11, 1); p.flags.oilFull = true; T.whale = true; G.tod = .4; p.y = 600; }
    else if (st === 'sleep') { toStep(11, 1); p.flags.oilFull = true; T.whale = true; p.y = WORLD.sleepY + 60; p.mode = 'sleep'; p.flags.slept = true; p.sleepT = num('st', 4); W.setSeason('autumn'); G.tod = .5; }
    else if (st === 'wake') { toStep(11, 1); T.whale = true; p.y = WORLD.sleepY + 60; p.flags.oilFull = p.flags.slept = p.flags.woke = true; p.tight = true; p.oil = .62; W.setSeason('winter'); G.tod = .5; }
    else if (st === 'adult') { toStep(12); p.y = WORLD.sleepY; G.tod = .5; }
    else if (st === 'trail') { toStep(12); p.sex = G.sex = 'boy'; p.y = 500; G.tod = .5; W.sendGirl(p); }
    else if (st === 'boymeet') { toStep(12); p.sex = G.sex = 'boy'; p.y = 500; W.sendGirl(p); W.mate.x = p.x + 18; W.mate.y = p.y; }
    else if (st === 'girlwait') { toStep(12); p.sex = G.sex = 'girl'; p.y = 500; W.sendBoy(p); W.mate.x = p.x + 120; }
    else if (st === 'girlmeet') { toStep(12); p.sex = G.sex = 'girl'; p.y = 500; W.sendBoy(p); W.mate.mode = 'wait'; W.mate.x = p.x + 18; W.mate.y = p.y; }
    else if (st === 'bloom') { toStep(12); p.sex = G.sex = 'girl'; p.flags.met = true; W.setSeason('spring'); W.bloom = 1; p.y = 90; G.tod = .45; p.eggFood = G.diff().eggs * num('frac', .5); }
    else if (st === 'lay') { toStep(12); p.sex = G.sex = 'girl'; p.flags.met = p.flags.eggsReady = true; W.setSeason('spring'); p.y = 90; G.tod = .9; p.startLay(); }
    else if (st === 'nextspring') { toStep(12); p.sex = G.sex = 'boy'; p.flags.met = true; p.y = 300; later(.2, nextSpring); }
  }

  return { init, reset, setup, simulate, warp, update, afterRestore, arrangeMate, nextSpring, generationDone, jumpTo, toStep, later, _timers: () => timers, _T: T };
})();
