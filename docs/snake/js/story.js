/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.
   Timers run on game time (G.time), so time-lapse speeds them up
   and a test is deterministic.
     the litter slithers off · first autumn after the first shed ·
     the den, winter, spring · summer for a young snake · visitors
     (hawk by day, raccoon at night, heron at the pond, the scientist
     and her coverboard) · the second autumn once grown up · the
     spring gathering: the boy's race for a girl's trail, the girl
     meeting a boy · carrying the babies · a new litter
   ============================================================ */
'use strict';

const Story = (function () {
  let G = null, ui = {};
  let timers = [];
  const once = {};
  const T = { hawk: null, raccoon: null, heron: null, sci: null, autumn: null, girl: null, summer: null };

  const P = () => G.player;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  /* a timer on game time; one made for an old world never fires in a new one */
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, W0: G.world }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  /* the night is skipped to morning: a raccoon still poking about heads home */
  const dawn = () => { const r = G.world.raccoon; if (r && r.state !== 'leave') { r.state = 'leave'; r.t = 0; } };
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; for (const k in T) T[k] = null; }

  /* ---------- the big turns of the year ---------- */
  function startAutumn() {
    const p = P(), Wd = G.world;
    if (p.flags.autumnNow) return;
    T.autumn = null;
    p.flags.autumnNow = true; p.flags.wintered = false; p.flags.springOut = false;
    Wd.setSeason('autumn'); G.day += 25; G.tod = .38;   /* a crisp autumn morning: the trek to the den is by day */
    Wd.startAutumn(p);
    hint('autumn'); fact('trail'); fact('den', 25);
    sound('fanfare');
    cine({ follow: () => ({ x: P().x - 120, y: P().y - 30 }), zoom: 1.2, duration: 4.5, slow: .7, title: 'Autumn!' });
    Bus.emit('autumn', p);
  }
  function startGathering() {
    const p = P(), Wd = G.world;
    p.flags.gathering = true;
    if (p.sex === 'boy') { hint('gather'); fact('gathering', 4); T.girl = G.time + 9; }
    else { Wd.makeBoys(p); hint('girlout'); fact('gathering', 4); fact('sizes', 30); }
  }
  /* a boy's ending: late summer, the girl he met has her litter under a log */
  function litterLater() {
    const p = P(), Wd = G.world;
    if (p.flags.genDone || p.flags.litterShown) return;
    p.flags.litterShown = true;
    Wd.setSeason('summer'); G.day += 100; G.tod = .45;
    /* months later: the spring crowd, the girl he met and the other boys have long gone */
    Wd.crowdLeave(); for (const n of Wd.npcs) if ((n.role === 'girl' || n.role === 'rival') && n.mode !== 'leave') { n.mode = 'leave'; n.goal = n.x + 900; n.speed = 30; n.fade = .3; }
    let log = null, bd = 1e9; for (const c of Wd.covers) if ((c.kind === 'log' || c.kind === 'board') && !c.lifted) { const d = Math.abs(c.x - p.x); if (d < bd) { bd = d; log = c; } }
    const mx = log ? log.x + log.w / 2 + 30 : p.x + 80;
    const mum = Wd.addSnake({ x: mx, len: snakeUnits(60), form: Math.random() < .85 ? G.form : pick(FORM_KEYS), sex: 'girl', mode: 'coil', role: 'mother', face: -1 });
    hint('litterOut'); fact('litter');
    cine({ follow: () => ({ x: mum.x, y: mum.y - 20 }), zoom: 2.6, duration: 6, slow: .8, title: 'Late summer…' });
    let n = 0;
    const burst = () => { if (G.world !== Wd || n >= 5) return; n++; Wd.babyBurst(mum.x + 20, 3, mum.form); sound('pop', 1 + n * .1); later(1.1, burst); };
    later(1.2, burst);
    later(7.5, () => P().milestone('babies', () => generationDone()));
  }
  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint(p.sex === 'girl' ? 'babies' : 'done'); fact('lifecycle');
    Bus.emit('generationDone', p);
    if (ui.done) later(2.5, () => ui.done());
  }

  /* ---------- events → what happens next ---------- */
  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'sac') return; hint('newborn'); fact('born', 1.8); });
    Bus.on('sacReady', () => hint('wiggle'));
    Bus.on('born', (p) => {
      sound('hatch'); hint('tongue'); fact('litter', 9); fact('own', 30); fact('harmless', 60);
      cine({ follow: P, zoom: 5, duration: 3, slow: .5, title: 'Hello, world!' });
      later(7, () => { G.world.sibsLeave(); hint('sibs'); });
      later(26, () => { const m = G.world.mum; if (m) { m.mode = 'leave'; m.goal = m.x - 900; m.speed = 26; m.arriveMode = 'leave'; m.coiled = false; } });
    });
    Bus.on('flicked', (p, n) => {
      if (first('flick1')) fact('tongue');
      if (p.stats.flicks === 3) fact('fork');
      if (n > 0) hint('smelled'); else if (p.stats.flicks % 3 === 0 && !(G.world.race && !G.world.race.done)) hint('nothing');
      if (G.world.race && !G.world.race.done && p.sex === 'boy') hint('race');
      if (p.flags.autumnNow && !p.flags.wintered && G.world.trail && Math.abs(p.x - G.world.land.mouth.x) > 80 && first('trailHint')) hint('trail');
    });
    Bus.on('ateSnack', (p) => { if (first('snack1')) { hint('snack'); fact('snack'); } else if (p.stats.snacks === 3) { fact('digest'); hint('belly'); } });
    Bus.on('cold', (p) => { if (p.mode === 'den' || p.mode === 'winter') return; hint(p.flags.autumnNow && !p.flags.wintered ? 'autumn' : 'cold'); fact('cold'); });
    Bus.on('hot', () => { hint('hot'); fact('toohot'); });
    Bus.on('basking', () => { hint('bask'); fact('bask'); });
    Bus.on('chilled', () => { hint('chilled'); });
    Bus.on('chillDone', () => { if (nightAmount(G.tod) > .3) { G.tod = .3; G.day++; dawn(); hint('morning'); } });
    Bus.on('hid', (p, c) => { if (first('hid1')) { hint('hidden'); fact('cover'); } else if (p.shed !== 'blue') hint('hidden'); });
    Bus.on('dash', (p) => { if (first('dash1')) fact('slither'); });
    Bus.on('swimStart', () => { hint('pond'); fact('swim'); });
    Bus.on('frogHop', () => { const p = P(); if (p.stage === 'snake') p.stats.frogs++; });
    Bus.on('frogPlop', () => { if (first('frog1')) { hint('frog'); fact('frogs'); } });
    Bus.on('region', (p, reg) => { if (reg === 'pond' && first('pondSeen')) fact('frogs', 4); });
    Bus.on('tight', () => { hint('tight'); fact('often', 6); });
    Bus.on('blue', () => { hint('blue'); fact('blue'); fact('eyelids', 14); });
    Bus.on('eyesClear', () => hint('clear'));
    Bus.on('rubbing', (p, n) => { if (n < 3) hint('rub'); });
    Bus.on('peelStart', (p) => { hint('peel'); fact('shed'); sound('molt'); cine({ follow: P, zoom: clamp(260 / (p.len + 20), 1.6, 5), duration: 3, slow: .6, title: 'Out of my old skin!' }); });
    Bus.on('shed', (p, instar) => {
      G.day += 12;
      hint(instar >= 4 ? 'adult' : 'look'); fact('shedlength', 4); fact('scales', 22);
      if (instar === 2) { T.autumn = G.time + 40; fact('pupils', 40); }
      if (instar === 3) { fact('scutes', 8); fact('bones', 30); fact('hearing', 50); }
      if (instar >= 4) { fact('grow'); fact('sizes', 12); fact('colours', 24); fact('name', 40); fact('widespread', 60); T.autumn = G.time + 45; sound('fanfare'); }
    });
    Bus.on('lookedShed', () => { fact('eyecaps'); });
    Bus.on('hawk', () => { hint('hawk'); fact('hawk'); sound('hawk'); });
    Bus.on('dodged', (p, h) => { hint('dodged'); if (h === G.world.hawk || (h && h.state === 'dive')) fact('stripes'); });
    Bus.on('missed', () => hint('missed'));
    Bus.on('raccoon', () => { hint('raccoon'); fact('raccoon'); });
    Bus.on('musk', () => { hint('musk'); fact('musk'); sound('musk'); });
    Bus.on('raccoonMissed', () => hint('hidden'));
    Bus.on('heron', () => { hint('heron'); fact('heron'); });
    Bus.on('boardDown', () => hint('board'));
    Bus.on('lifted', () => { hint('lifted'); fact('scientist'); });
    Bus.on('measured', () => { fact('measure'); });
    Bus.on('putBack', () => hint('measured'));
    Bus.on('enterDen', () => { hint('deeper'); fact('den'); });
    Bus.on('belowFrost', () => fact('frost'));
    Bus.on('winterStart', (p) => {
      const Wd = G.world; Wd.setSeason('winter'); G.day += 40; G.tod = .5;
      /* any older snake still on its way is in the den by now (none left slithering about in spring) */
      for (const n of Wd.npcs) if (n.role === 'migrant' && !n.gone) { n.gone = true; Wd.denCrowd++; }
      hint('winter'); fact('brumation'); fact('narcisse', 10);
      cine({ follow: P, zoom: 2.6, duration: 4, slow: .6, title: 'Winter in the den' });
    });
    Bus.on('winterDone', (p) => { const Wd = G.world; Wd.setSeason('spring'); G.day += 150; G.year++; G.tod = .4; hint('spring'); });
    Bus.on('emerged', (p) => {
      const Wd = G.world;
      Wd.springCrowd(); sound('fanfare');
      hint('emerged'); fact('emerge');
      cine({ follow: P, zoom: 2, duration: 3.5, slow: .6, title: 'Spring!' });
      if (p.instar >= 4 && p.stats.winters >= 2) later(5, startGathering);
      else { later(30, () => G.world.crowdLeave()); T.summer = G.time + 35; if (p.instar >= 4) T.autumn = G.time + 70; }
    });
    Bus.on('leftDen', () => hint('meadow'));
    Bus.on('girlOut', () => { hint('race'); });
    Bus.on('raceLost', () => { const p = P(); p.stats.losses++; hint('lost'); T.girl = G.time + 11; });
    Bus.on('met', (p, o) => {
      const Wd = G.world;
      if (p.sex === 'boy') {
        Wd.endRace(true); p.stats.wins++;
        if (o) { o.mode = 'coil'; o.coiled = false; }
        hint('won'); sound('fanfare'); G.particles.confetti(p.x, p.y - 20, 40);
        later(6, litterLater);
      } else {
        later(3, () => { if (o) { o.mode = 'leave'; o.goal = o.x + 900; o.speed = 30; } G.world.crowdLeave(); });
        p.flags.carrying = true; p.flags.gathering = false;
        Wd.setSeason('summer'); G.day += 30;
        hint('carry'); fact('carry'); sound('magic');
      }
    });
    Bus.on('broodWarm', () => { if (first('broodWarm')) hint('carrywarm'); });
    Bus.on('babiesReady', () => { G.day += 60; hint('ready'); fact('safeplace'); });
    Bus.on('birthStart', () => hint('birth'));
    Bus.on('push', (p, n) => { sound('pop', 1 + n * .1); if (n === 1) fact('litter'); });
    Bus.on('litterBorn', () => generationDone());
  }

  /* ---------- after a save is loaded: re-arm whatever was about to happen ---------- */
  function afterRestore() {
    const p = P(), Wd = G.world;
    if (p.stage === 'sac') Wd.makeLitter(p.x, G.form);
    if (p.flags.autumnNow && !p.flags.wintered && !p.underground) Wd.startAutumn(p);
    if (p.stage === 'snake' && !p.flags.autumnNow && !p.underground && !p.flags.springOut && p.instar >= 2 && p.stats.winters === 0) T.autumn = G.time + 20;
    if (p.stage === 'snake' && !p.flags.autumnNow && !p.underground && p.instar >= 4 && p.stats.winters === 1 && !p.flags.gathering && !p.flags.met) T.autumn = G.time + 20;
    /* saved in spring after a winter: summer still comes (it was a timer, and timers are not saved) */
    if (p.stage === 'snake' && p.flags.springOut && !p.underground && Wd.season === 'spring' && !(p.instar >= 4 && p.stats.winters >= 2)) T.summer = G.time + 15;
    if (p.flags.springOut && p.instar >= 4 && p.stats.winters >= 2 && !p.flags.met) startGathering();
    if (p.flags.met && p.sex === 'boy' && !p.flags.genDone) later(3, litterLater);
    if (p.flags.birthDone && !p.flags.genDone) later(2, generationDone);
  }

  /* ---------- the director (every tick) ---------- */
  function update(dt) {
    if (!G) return;
    for (let i = 0; i < timers.length; i++) { const t = timers[i]; if (t.W0 !== G.world) { timers.splice(i--, 1); continue; } if (G.time >= t.at) { timers.splice(i--, 1); t.fn(); } }
    const p = P(), Wd = G.world, D = G.diff(), vis = G.settings.visitors;
    if (!p || p.stage !== 'snake') return;
    const night = nightAmount(G.tod), day = night < .3, reg = Wd.land.region(p.x);
    /* the turns of the year */
    if (T.autumn !== null && G.time > T.autumn && p.mode === 'crawl' && p.busy <= 0 && !p.shed && !Wd.raccoon && !Wd.hawk) startAutumn();   /* not in the middle of a visit */
    if (T.summer !== null && G.time > T.summer && Wd.season === 'spring') { T.summer = null; Wd.setSeason('summer'); G.day += 30; hint('meadow'); }
    /* the boy's race */
    if (T.girl !== null && G.time > T.girl && (!Wd.race || Wd.race.done) && p.mode === 'crawl' && !p.flags.met) { T.girl = null; Wd.sendGirl(p); }
    Wd.updateRace(dt, p);
    /* visitors: never during the big moments */
    const calm = !(Wd.race && !Wd.race.done) && !['birth', 'shed', 'measured', 'den', 'winter', 'chill'].includes(p.mode) && !p.flags.genDone && !Cinematic.active;
    const v = D.visits;
    if (vis && calm && Wd.season !== 'winter') {
      if (day && p.mode === 'crawl' && reg !== 'pond' && !Wd.hawk && !Wd.sci && p.stats.snacks >= 1) {
        if (T.hawk === null) T.hawk = G.time + (45 + Math.random() * 50) / v;
        if (G.time > T.hawk) { T.hawk = null; Wd.startHawk(p); }
      } else if (T.hawk !== null && !day) T.hawk = null;
      if (night > .6 && (reg === 'meadow' || reg === 'woods') && !Wd.raccoon && ['crawl', 'hide'].includes(p.mode)) {
        if (T.raccoon === null) T.raccoon = G.time + (25 + Math.random() * 30) / v;
        if (G.time > T.raccoon) { T.raccoon = null; Wd.startRaccoon(p); }
      }
      if (day && Math.abs(p.x - (WORLD.pondL + WORLD.pondR) / 2) < 520 && !Wd.heron && p.mode === 'crawl') {
        if (T.heron === null) T.heron = G.time + (20 + Math.random() * 25) / v;
        if (G.time > T.heron) { T.heron = null; Wd.startHeron(p); }
      }
    }
    if (D.board && vis && calm && !Wd.boardDone && !Wd.sci && p.instar >= 2 && p.instar <= 3 && Wd.season === 'summer' && day && reg === 'meadow' && p.mode === 'crawl') {
      if (T.sci === null) T.sci = G.time + 30;
      if (G.time > T.sci) { T.sci = null; Wd.startScientist(p); }
    }
    if (Wd.season === 'summer' && night > .75 && reg === 'meadow' && first('fireflies')) { Bus.emit('fireflies', p); fact('fireflies'); }
  }

  return { init, bind, reset, update, afterRestore, generationDone, startAutumn, startGathering, litterLater, later, timers: T };
})();
