/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.  Timers run
   on game time (G.time), so time-lapse speeds them up.

     MORNING   the egg sac on the porch, the climb, the balloon ride
     HOME      where you land is where you live: reach the den,
               fix the first threads, drop a gumfoot line
     NIGHTS    G.day counts them.  Bugs come by night; the web tells
               you where.  Each moult brings a new thing (PLAN).
     HE        grown: leaves his web, follows the scent to her web,
               plucks it gently, folds a bit of it up, walks away
     SHE       grown: black and red; the bird; a male plucks; the
               egg sac, round and round; guard it; they balloon away
   ============================================================ */
'use strict';

/* what each moult brings (by the new instar).  day / night: when it can happen */
const PLAN = {
  girl: { 2: [['dauber', 'day']], 3: [['people', 'night']], 4: [['broom', 'day'], ['lizard', 'night']], 5: [['bird', 'day'], ['people', 'night']] },
  boy: { 1: [['dauber', 'day']], 2: [['people', 'night']], 3: [['mantis', 'night'], ['lizard', 'night']] }
};
const WILD = ['dauber', 'lizard', 'bird', 'mantis'];

const Story = (function () {
  let G = null, ui = {}, timers = [];
  const once = {};
  const T = { cool: 0, suitorAt: 0, leaveT: 0 };
  const P = () => G.player, Y = () => G.yard;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, Y0: G.yard }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; T.cool = 0; T.suitorAt = 0; T.leaveT = 0; }
  const queue = () => (P().flags.q ? String(P().flags.q).split(',') : []);
  const setQueue = (a) => { P().flags.q = a.join(','); };
  function plan(i) { const add = (PLAN[P().form] || {})[i]; if (!add) return; const vis = G.settings.visitors && G.diff().visitors; setQueue(queue().concat(add.filter(e => vis || !WILD.includes(e[0])).map(e => e.join(':')))); T.cool = G.time + 7; }

  /* where the story wants you next: a pointer for the child, a target for the bot */
  function goal() {
    const p = P(), y = Y(), fl = p.flags, h = y.home;
    if (p.stage === 'sac' || p.mode === 'balloon') return null;
    if (p.stage === 'ling' && !fl.landed) return { x: WORLD.launchX, y: WORLD.launchY, kind: 'launch' };
    if (h && !fl.settled) return { x: h.retreat[0], y: h.retreat[1], kind: 'den' };
    if (p.male && p.stage === 'adult') {
      if (fl.leave) return fl.boyEnd ? null : { x: y.her.x + (y.her.x > 0 ? -260 : 260), y: 0, kind: 'away' };
      const g = y.net.threads.find(t => t.hers && t.gum); if (!g) return null;
      const q = g.at(g.a.line === y.net.ground ? 26 : g.len - 26); return { x: q.x, y: q.y, kind: 'her' };
    }
    if (!p.male && fl.spinNow && !fl.sac && h) return { x: h.retreat[0], y: h.retreat[1], kind: 'den' };
    if (fl.guard && !fl.hatchedOut && y.sac) return { x: y.sac.x, y: y.sac.y - 14, kind: 'sac' };
    return null;
  }

  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint('eggs'); fact('lifecycle'); fact('sacs', 8);
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }
  function hatchOut() {
    const p = P(), y = Y(); if (p.flags.hatchedOut) return;
    p.flags.hatchedOut = true;
    p.milestone('eggs', () => {
      y.startBabies(y.sac.x, y.sac.y); sound('fanfare'); fact('ling');
      cine({ follow: () => ({ x: y.sac.x, y: y.sac.y - 40 }), zoom: 2.6, duration: 6, slow: .8, title: 'The spiderlings climb out!' });
      later(6.2, generationDone);
    });
  }
  function boyEnding() {
    const p = P(), y = Y(), h = y.her; if (p.flags.boyEnd || !h) return;
    p.flags.boyEnd = true;
    y.sac = { x: h.x + (h.x < h.site.x ? 12 : -12), y: h.y + 16, t: 0 };
    hint('shesac'); fact('sac');
    cine({ follow: () => ({ x: h.x, y: h.y }), zoom: 2.6, duration: 7, slow: .8, title: 'She spins an egg sac' });
    later(3.2, () => { y.startBabies(y.sac.x, y.sac.y); });
    later(7.2, () => p.milestone('eggs', generationDone));
  }
  function startNight() {
    const p = P();
    G.day++; p.stats.nights++;
    Bus.emit('dusk', p, G.day);
    if (p.stage === 'adult' && !p.male && !p.flags.met && !Y().suitor && T.suitorAt && G.day >= T.suitorAt) later(5, trySuitor);
  }
  function trySuitor() {
    const p = P(), y = Y(); if (p.flags.met || y.suitor) return;
    if (y.visitor || y.people || y.stuck() || queue().length || !y.sendSuitor()) { if (!y.own().length && first('needweb' + G.day)) hint('needweb'); later(4, trySuitor); }
  }

  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'sac') return; hint('sac'); fact('sac', 1.8); });
    Bus.on('sacReady', () => hint('wiggle'));
    Bus.on('hatched', (p) => {
      sound('hatch'); hint('climb'); fact('ling'); Y().startSibs();
      cine({ follow: P, zoom: 4.2, duration: 2.6, slow: .5, title: 'Out of the egg sac!' });
      fact('firstmolt', 9);
    });
    Bus.on('launched', () => { sound('magic'); hint('balloon'); fact('balloon'); cine({ follow: P, zoom: 2.2, duration: 2.4, slow: .8, title: 'Up and away!' }); });
    Bus.on('warmAir', () => { hint('warmair'); fact('thermal'); });
    Bus.on('landed', (p) => {
      const y = Y(); y.home = y.siteNear(p.x); p.flags.home = y.home.key;
      sound('fanfare'); hint('landed'); fact('home');
      cine({ follow: P, zoom: 2.4, duration: 2.8, slow: .7, title: 'You land by ' + y.home.name });
      Bus.emit('homeChosen', p, y.home);
    });
    Bus.on('silkStart', () => { if (first('silkgo')) hint('silkgo'); });
    Bus.on('dropped', () => { if (first('hang')) { hint('hang'); fact('dragline'); } });
    Bus.on('thread', (p, t) => {
      const n = p.stats.threads;
      if (t.gum && first('gum')) { hint('gumfoot'); fact('gumfoot'); sound('magic'); Bus.emit('firstGum', p); }
      else if (n === 1) { hint('build2'); fact('silk'); }
      else if (n === 2) hint('dropnow');
      if (n >= 3 && p.stats.gum >= 1 && first('webup')) { later(2.5, () => { hint('wait'); fact('feel'); }); Bus.emit('webUp', p); }
    });
    Bus.on('caught', (b) => {
      if (b.leaf) return;
      if (first('feelit')) { hint('feelit'); fact('pulse'); } else hint('hum');
      if (!b.def.fly && first('snap')) fact('gumsnap', 2);
    });
    Bus.on('flung', () => { if (first('fling')) { hint('fling'); fact('comb'); } });
    Bus.on('wrapStart', () => hint('wrap'));
    Bus.on('ate', (p, b) => { hint('yum'); sound('slurp'); if (first('snack')) fact('snack'); else if (p.stats.meals === 4) fact('drink'); });
    Bus.on('gotAway', (b) => { if (!b.leaf) { hint(b.def.size > P().maxPrey ? 'toobig' : 'gotaway'); P().stats.away++; } });
    Bus.on('cutLeaf', () => { hint('leafcut'); fact('leaf'); });
    Bus.on('tight', () => { hint('tight'); fact('molt'); sound('bump'); });
    Bus.on('molting', () => { sound('molt'); cine({ follow: P, zoom: 3.6, duration: MOLT_T + .4, slow: .6, title: 'Moulting!' }); });
    Bus.on('molted', (p, i) => {
      G.particles.sparkle(p.x, p.y, 24, '#fff3c0', 30);
      if (p.stage !== 'adult') { hint(i === 1 ? 'stripes' : i >= 3 ? 'darker' : 'bigger'); fact(i === 1 ? 'colours' : i === 2 ? 'eightlegs' : i === 3 ? 'eyes' : 'strongsilk'); }
      plan(i);
    });
    Bus.on('grownUp', (p) => {
      sound('fanfare'); Bus.emit('card', 'western');
      if (p.male) {
        const y = Y(), k = (y.sites.indexOf(y.home) + 2) % y.sites.length;
        p.flags.noHunt = true; p.flags.herSite = y.sites[k].key; y.makeHer(p.flags.herSite);
        for (const b of y.prey) b.state = 'free';
        hint('grownboy'); fact('boy'); fact('scent', 9);
        cine({ follow: P, zoom: 3.4, duration: 3.5, slow: .5, title: 'A grown-up boy: small and striped' });
        later(4.5, () => hint('gofind'));
      } else {
        T.suitorAt = G.day + 1;
        hint('growngirl'); fact('hourglass'); fact('bigweb', 10);
        cine({ follow: P, zoom: 2.8, duration: 3.5, slow: .5, title: 'Glossy black, with a red hourglass!' });
      }
    });
    Bus.on('visitor', (v) => { hint(v.kind); fact(v.kind); if (v.kind === 'broom') cine({ follow: () => ({ x: (v.x0 + v.x1) / 2, y: -70 }), zoom: 1.5, duration: 3, slow: .8, title: 'A broom!' }); });
    Bus.on('visitorLooks', (v) => { const p = P(); if (!p.isSafe()) hint(p.stage === 'adult' && !p.male ? 'showred' : 'hide'); });
    Bus.on('visitorBored', (v, how) => { const p = P(); p.stats.visitors++; hint(how === 'show' ? 'boredred' : 'bored'); if (how === 'show') fact('warning'); Bus.emit(v.kind + 'Gone', p); });
    Bus.on('scared', () => hint('scared'));
    Bus.on('curled', (p) => { if (first('curl')) fact('playdead'); if (!Y().visitor) hint('curled'); });
    Bus.on('showed', () => hint('showing'));
    Bus.on('swept', (p, n) => { p.stats.swept++; hint('swept'); fact('broom'); });
    Bus.on('threadGone', () => hint('fell'));
    Bus.on('visitorGone', (v) => { T.cool = G.time + 8; if (v.kind === 'broom') hint('rebuild'); });
    Bus.on('peopleCame', () => hint('people'));
    Bus.on('peopleLook', (p, Q) => {
      p.stats.people++; fact('never'); fact('shy', 9);
      cine({ follow: () => ({ x: (Q.x + p.x) / 2, y: -90 }), zoom: clamp((G.cam.w || 900) / (Math.abs(Q.x - p.x) + 260), .9, 1.9), duration: 9.6, slow: 1, title: 'Look. Do not touch.' });
    });
    Bus.on('peopleGone', () => { hint('peoplegone'); T.cool = G.time + 8; });
    /* her story */
    Bus.on('suitorCame', () => { hint('malehum'); fact('courtship'); });
    Bus.on('met', (p, m) => {
      sound('magic'); G.particles.text(p.x, p.y - 20, '♥', '#ff9ad0', 22);
      if (p.male) return;
      hint('metgirl'); fact('boy', 3);
      later(2.5, () => { const y = Y(), t = y.own().filter(q => q !== p.line && q.gum)[1]; if (t) { y.net.removeThreads(q => q === t); hint('hebundles'); fact('bundle'); } });
      later(5.5, () => { if (Y().suitor) { Y().suitor.state = 'leave'; Y().suitor.t = 0; } });
      later(8, () => { p.flags.spinNow = true; hint('spinsac'); });
    });
    Bus.on('spinStart', () => { hint('spin'); fact('sac'); });
    Bus.on('sacDone', (p) => {
      sound('fanfare'); p.flags.guard = true; hint('guard'); fact('eggs');
      cine({ follow: () => ({ x: Y().sac.x, y: Y().sac.y }), zoom: 3, duration: 3.5, slow: .6, title: 'An egg sac!' });
      if (G.settings.visitors && G.diff().visitors) setQueue(queue().concat(['lizard:any']));
    });
    /* his story */
    Bus.on('pluckStart', () => { hint('pluck'); if (first('court')) fact('courtship'); });
    Bus.on('herAnswer', (p, n) => { hint(n >= 3 ? 'bundle' : 'sheanswers'); sound('magic'); });
    Bus.on('tooHard', () => hint('toohard'));
    Bus.on('lunged', () => { hint('lunged'); fact('careful'); });
    Bus.on('courted', () => { sound('fanfare'); fact('bundle'); });
    Bus.on('bundled', (p) => { p.flags.met = true; Bus.emit('met', p, Y().her); hint('metboy'); fact('malelife'); later(3.5, () => { p.flags.leave = true; hint('walkaway'); }); });
  }

  /* ---------- every frame ---------- */
  function update(dt) {
    const p = P(), y = Y(), fl = p.flags;
    for (let i = timers.length - 1; i >= 0; i--) { const t = timers[i]; if (t.Y0 !== y) { timers.splice(i, 1); continue; } if (G.time >= t.at) { timers.splice(i, 1); t.fn(); } }
    if (p.stage === 'sac') return;
    if (p.atLaunch() && first('tiptoe')) hint('tiptoe');
    if (!fl.settled) {
      if (y.home && p.mode === 'walk' && p.nearDen()) { fl.settled = true; G.tod = .74; sound('magic'); hint('build1'); fact('web'); Bus.emit('settled', p); }
      return;
    }
    /* the clock: long nights, short days; it waits for a visitor to go */
    const busy = y.visitor || y.people, guarding = fl.guard && !fl.hatchedOut;
    if (G.settings.clock !== false && !busy && !Cinematic.active) {
      const night = G.tod >= .78 || G.tod < .22, t0 = G.tod;
      const qq = queue(), hurry = qq.length && !y.stuck() && p.tight <= 0 && !qq.some(e => { const w = e.split(':')[1]; return w === 'any' || (w === 'night') === night; });
      G.tod += dt * (night ? .44 / G.diff().nightLen : .56 / 14) * (guarding ? 3 : hurry ? 5 : 1);
      if (G.tod >= 1) G.tod -= 1;
      if (t0 < .78 && G.tod >= .78) startNight();
      if (t0 < .22 && G.tod >= .22) { Bus.emit('dawn', p); if (first('day' + (G.day > 1))) hint('day'); }
    }
    /* the next thing the story has waiting */
    const q = queue();
    if (q.length && !busy && G.time > T.cool && !Cinematic.active && p.mode === 'walk' && p.busy <= 0 && !y.stuck() && p.tight <= 0) {
      const isNight = G.night > .6, isDay = G.night < .2;
      const i = q.findIndex(e => { const w = e.split(':')[1]; return w === 'any' || (w === 'night' ? isNight : isDay); });
      if (i >= 0) { const kind = q[i].split(':')[0]; q.splice(i, 1); setQueue(q); T.cool = G.time + 10; if (kind === 'people') y.startPeople(); else y.startVisitor(kind); }
    }
    if (fl.spinNow && !fl.sac && p.nearDen() && first('spinhere')) hint('spinhere');
    if (guarding && y.sac) {
      if (Math.hypot(p.x - y.sac.x, p.y - y.sac.y) < 50) { if (!y.visitor) p.guardT += dt; } else if (first('guardfar' + Math.floor(G.time / 20))) hint('guard');
      if (p.guardT >= G.diff().guard && !y.visitor) hatchOut();
    }
    if (p.male && p.stage === 'adult') {
      if (p.onHers() && !fl.courted && p.mode === 'walk' && first('ather')) hint('pluckher');
      if (fl.leave && !fl.boyEnd) { T.leaveT += dt; if ((p.onGround() && Math.abs(p.x - y.her.x) > 170) || T.leaveT > 30) boyEnding(); }
    }
  }

  /* put back what a save does not hold */
  function afterRestore() {
    const p = P(), y = Y(), fl = p.flags;
    if (fl.home) y.home = y.site(fl.home) || null;
    if (p.stage === 'ling' && !fl.landed && p.mode === 'walk') y.startSibs();
    if (p.male && p.stage === 'adult' && fl.herSite && !y.her) y.makeHer(fl.herSite);
    if (!p.male && p.stage === 'adult' && !fl.met) { T.suitorAt = G.day; later(6, trySuitor); }
    if (!p.male && fl.met && !fl.spinNow) fl.spinNow = true;
    if (fl.boyEnd && !fl.genDone) { fl.boyEnd = false; later(1, boyEnding); }
    if (fl.hatchedOut && !fl.genDone) later(1, generationDone);
    if (fl.bundled && !fl.leave) fl.leave = true;
  }

  return { init, bind, reset, update, afterRestore, goal, generationDone, boyEnding, hatchOut, trySuitor, plan, queue, once, T };
})();
