/* ============================================================
   story.js — the director: what happens when, and what it means
   ============================================================
   Shared by main.js (the browser) and smoke.js (Node), so the test
   plays exactly the story the children play.  No DOM here: the
   browser passes in hooks for hints, facts, cinematics and the
   "a new generation!" choice; smoke.js passes stubs.  Timers run
   on game time (G.time), so time-lapse speeds them up.

     HOLLOW   the egg; fed at the door; your NAME, a call your
              parents give you; the toucan; the scientist; feathers
     FLEDGE   flap at the door, then the first flight
     LESSONS  one a day with your family: figs · the clay lick (and
              the eagle: up, everybody!) · palm nuts · lost in the
              mist (call, and they answer) · the hawk (into the
              leaves).  Each evening: the roost.
     GROWN    a lone macaw at the clay lick: preen, and you are a
              pair.  Wing to wing you look for a hollow.  Most are
              taken.  Eggs; one sits, one brings food; a name for
              your own chick.
   ============================================================ */
'use strict';

const LESSONS = ['fig', 'clay', 'nut', 'call', 'hide'];
const LESSON_FOOD = { fig: 'fig', clay: 'clay', nut: 'nut' };

const Story = (function () {
  let G = null, ui = {}, timers = [];
  const once = {};
  const T = { cool: 0, duskT: 0, lostT: 0, hideT: 0 };
  const P = () => G.player, F = () => G.forest;
  const first = (k) => { if (once[k]) return false; once[k] = true; return true; };
  function later(sec, fn) { timers.push({ at: G.time + sec, fn, F0: G.forest }); }
  const hint = (k) => ui.hint && ui.hint(k);
  const fact = (k, sec = 0) => { if (!ui.fact) return; if (sec) later(sec, () => ui.fact(k)); else ui.fact(k); };
  const cine = (o) => ui.cine && ui.cine(o);
  const sound = (n, ...a) => { if (typeof AudioFX !== 'undefined' && AudioFX[n]) AudioFX[n](...a); };

  function bind(game, hooks) { G = game; if (hooks) ui = hooks; }
  function reset() { timers = []; for (const k in once) delete once[k]; T.cool = 0; T.duskT = 0; T.lostT = 0; T.hideT = 0; }
  const wild = () => G.settings.visitors && G.diff().visitors;
  const lessons = () => LESSONS.filter(k => k !== 'hide' || wild());
  const queue = () => (P().flags.q ? String(P().flags.q).split(',') : []);
  const setQueue = (a) => { P().flags.q = a.join(','); };
  const push = (...k) => setQueue(queue().concat(k));
  const pt = (q, kind) => ({ x: q.x, y: q.y, kind });
  const doorPt = (h, kind) => { const q = h.line.at(h.s); return { x: q.x, y: q.y, kind }; };

  /* where the story wants you next: a pointer for the child, a target for the bot */
  function goal() {
    const p = P(), f = F(), fl = p.flags, v = f.visitor;
    if (p.stage === 'egg' || ['echo', 'crack', 'preen', 'sleep'].includes(p.mode)) return null;
    if (v && v.kind === 'eagle' && v.state !== 'leave' && p.stage !== 'chick') {
      if (v.need === 'air') return { x: p.x, y: Math.min(p.y, groundY(p.x) - 60) - 150, kind: 'up' };
      const c = f.nearestCrown(p.x, p.y); return { x: c.crown[0], y: c.crown[1] + 30, kind: 'hide' };
    }
    if (p.stage === 'chick') {
      if (p.mode === 'nest') return fl.ready ? { x: WORLD.doorX, y: WORLD.doorY, kind: 'door' } : null;
      return fl.strong ? pt(f.station('first'), 'fly') : null;
    }
    if (p.stage === 'young') {
      if (fl.firstFlight) return pt(f.station('first'), 'fly');
      if (fl.dusk) return T.duskT > 40 ? null : pt(f.station('roost'), 'roost');
      const k = fl.ls;
      if (LESSON_FOOD[k]) { const fd = f.nextFood(LESSON_FOOD[k], p.x, p.y); return fd ? { x: fd.x - 12, y: fd.y, kind: 'food' } : null; }
      if (k === 'call') return fl.heard ? pt(f.station('lost'), 'family') : null;
      if (k === 'hide') return pt(f.station('hide'), 'family');
      return null;
    }
    if (!fl.paired) return f.mate ? { x: f.mate.x - 34, y: f.mate.y, kind: 'mate' } : null;
    if (!fl.nest) { const hs = f.hollows.filter(h => h.key !== 'home' && !h.seen).sort((a, b) => (a.who === 'free') - (b.who === 'free') || Math.abs(a.door[0] - p.x) - Math.abs(b.door[0] - p.x)); return hs.length ? doorPt(hs[0], 'hollow') : null; }
    const h = f.hollow(fl.nest);
    if (!p.male) return !fl.laid && p.mode !== 'nest' ? doorPt(h, 'nest') : null;
    if (fl.laid && !fl.hatched) { if (p.crop >= G.diff().crop) return doorPt(h, 'nest'); const fd = f.nextFood('fig', p.x, p.y); return fd ? { x: fd.x - 12, y: fd.y, kind: 'food' } : null; }
    return null;
  }

  function generationDone() {
    const p = P(); if (p.flags.genDone) return;
    p.flags.genDone = true;
    hint('newgen'); fact('lifecycle'); fact('longlife', 8);
    Bus.emit('generationDone', p);
    if (ui.done) ui.done();
  }
  function hatchOut() {
    const p = P(), f = F(), h = f.hollow(p.flags.nest); if (p.flags.hatched) return;
    p.flags.hatched = true;
    p.milestone('eggs', () => {
      f.chicks = [{ x: h.inside[0] - 9, y: h.inside[1], t: 0 }, { x: h.inside[0] + 9, y: h.inside[1], t: -.6 }];
      sound('fanfare'); fact('chick');
      cine({ follow: () => ({ x: h.door[0], y: h.door[1] }), zoom: 2.6, duration: 4.5, slow: .8, title: 'The eggs hatch!' });
      later(5, nameChick);
    });
  }
  function nameChick() {
    const p = P(); if (p.flags.chickName) return generationDone();
    if (p.mode !== 'perch' && p.mode !== 'nest') return later(1.5, nameChick);
    hint('namechick'); fact('name'); p.startEcho(null, 'give');
  }

  /* ---------- the lessons ---------- */
  function startLesson() {
    const p = P(), f = F(), fl = p.flags, k = lessons()[fl.lesson | 0];
    if (!k) return;
    fl.ls = k; fl.ln = 0; fl.heard = false; T.lostT = 0; T.hideT = 0;
    if (f.sib) f.sib.follow = p;
    if (k === 'call') {
      f.fogWanted = true; f.lead('lost'); if (f.sib) { f.sib.follow = null; const q = f.station('lost'); f.sib.flyTo(q.line, q.s + 40); }
      later(3, () => { if (P().flags.ls === 'call') { hint('lost'); fact('contact'); } });
    } else { f.lead(k); hint('go' + k); if (k === 'clay') fact('clay'); if (k === 'nut') fact('beak'); if (k === 'fig') fact('fruit'); }
    Bus.emit('lessonStart', p, k); Bus.emit('lesson_' + k, p);
  }
  function lessonDone() {
    const p = P(), f = F(), fl = p.flags, k = fl.ls; if (!k) return;
    fl.ls = ''; fl.lesson = (fl.lesson | 0) + 1; p.stats.lessons++; f.fogWanted = false;
    sound('fanfare'); G.particles.sparkle(p.x, p.y - 12, 20, '#ffd24a', 30);
    if (f.sib) f.sib.follow = p;
    Bus.emit('lessonDone', p, k);
    if (lessons()[fl.lesson] === 'call') later(3, startLesson);
    else later(k === 'clay' ? 9 : 3.5, startDusk);
  }
  function startDusk() {
    const p = P(), fl = p.flags; if (p.stage !== 'young' || fl.dusk) return;
    if (F().visitor || F().people) return later(2, startDusk);
    fl.dusk = true; T.duskT = 0; G.tod = Math.max(G.tod, .73); F().lead('roost'); hint('roost'); fact('roost');
  }
  function growUp() {
    const p = P(), f = F();
    p.milestone('grown', () => {
      p.stage = 'adult'; p.flags.ls = '';
      for (const b of [f.mum, f.dad]) b.follow = null;
      f.mum.flyTo(f.line('homehigh'), 40); f.dad.flyTo(f.line('homehigh'), 90);
      if (f.sib) { const s = f.sib; s.follow = null; s.leaving = true; s.flyToXY(WORLD.right + 300, -900); later(8, () => { if (F().sib === s) F().sib = null; }); }
      makeMate();
      Bus.emit('grownUp', p);
    });
  }
  function makeMate() { const f = F(), q = f.station('mate'); f.mate = new Bird(f, 'mate').perchAt(q.line, q.s); f.mate.face = -1; return f.mate; }
  function nameSeq() { const r = mulberry32((F().seed >>> 0) + 5), s = [NOTES[(r() * 4) | 0], NOTES[(r() * 4) | 0], NOTES[(r() * 4) | 0]]; if (s[0] === s[1] && s[1] === s[2]) s[1] = NOTES[(NOTES.indexOf(s[1]) + 1) % 4]; return s; }

  function init(game, hooks) {
    bind(game, hooks);
    Bus.on('started', (p) => { if (!p || p.stage !== 'egg') return; hint('egg'); fact('egg', 1.8); });
    Bus.on('eggReady', () => hint('wiggle'));
    Bus.on('hatched', (p) => {
      const f = F(); sound('hatch'); hint('hatched'); fact('chick');
      f.sib = new Bird(f, 'sib'); f.sib.mode = 'nest'; f.sib.x = WORLD.eggX + 17; f.sib.y = WORLD.nestY; f.sib.size = .5; f.sib.face = -1;
      cine({ follow: P, zoom: 3.6, duration: 2.6, slow: .5, title: 'Out of the egg!' });
    });
    Bus.on('parentHere', (p, b) => {
      const f = F();
      if (p.stage === 'chick' && p.instar >= 1 && !p.flags.named) {
        f.feed.state = 'teach'; const seq = nameSeq(); b.callT = 1.2; f.ring(b.x, b.y - 12, 'family', seq);
        hint('name'); fact('name');
        later(1.1, () => { if (P() === p && p.mode === 'nest') p.startEcho(seq, 'name'); else F().feed.state = 'offer'; });
      } else { hint(p.stage === 'chick' ? 'beg' : 'take'); if (first('crop')) fact('crop', 2); }
    });
    Bus.on('wrongNote', (p) => { hint('again'); const b = F().feed.bird; if (b && p.ec) F().ring(b.x, b.y - 12, 'family', p.ec.seq); });
    Bus.on('named', (p) => {
      const f = F(); sound('magic'); hint('named'); fact('namecall', 3);
      if (f.feed.state === 'teach') { f.feed.state = 'offer'; f.feed.t = 0; }
      cine({ follow: P, zoom: 3, duration: 2.6, slow: .7, title: 'That is your name!' });
    });
    Bus.on('fed', (p) => {
      sound('slurp');
      if (p.stage === 'chick') { hint('yum'); return; }
      p.flags.sitFed = (p.flags.sitFed | 0) + 1; hint('yum2');
      if (p.flags.sitFed >= G.diff().sitFeeds) later(2.5, hatchOut);
    });
    Bus.on('grew', (p, i) => {
      const f = F(); if (f.sib) f.sib.size = [.5, .6, .75, .9][i];
      sound('molt');
      if (i === 1) { hint('pins'); fact('pins'); }
      if (i === 2) { hint('red'); fact('feathers'); push(...(wild() ? ['toucan'] : []), 'climber'); T.cool = G.time + 4; }
      if (i === 3) { p.flags.ready = true; hint('climb'); fact('fledge'); }
      cine({ follow: P, zoom: 3.2, duration: 2.4, slow: .6, title: ['', 'Your eyes open!', 'Red feathers!', 'All your feathers!'][i] });
    });
    Bus.on('visitor', (v) => { hint(v.kind === 'eagle' && v.need === 'leaves' ? 'hawk' : v.kind); fact(v.kind); if (v.kind === 'eagle') sound('alarm'); Bus.emit(v.kind === 'toucan' ? 'toucanCame' : v.need === 'air' ? 'flockUp' : 'hawkCame', P()); });
    Bus.on('visitorLooks', (v) => { const p = P(); if (!p.isSafe(v)) hint(v.kind === 'toucan' ? 'squawk' : v.need === 'air' ? 'flyup' : 'hideleaves'); });
    Bus.on('visitorBored', (v, how) => {
      const p = P(); p.stats.visitors++; if (how === 'air') p.stats.flushes++; if (how === 'leaves') p.stats.hides++;
      hint(how === 'call' ? 'boredcall' : how === 'air' ? 'boredair' : 'boredleaves'); if (how === 'air') fact('manyeyes'); if (how === 'leaves') fact('green');
      Bus.emit(v.kind + 'Gone', p);
    });
    Bus.on('scared', (p, v) => hint(v.kind === 'toucan' ? 'scaredtoucan' : 'scared'));
    Bus.on('visitorGone', (v) => { T.cool = G.time + 6; const p = P(); if (v.kind === 'eagle' && p.flags.ls === 'hide') lessonDone(); else if (v.kind === 'eagle') hint('backclay'); });
    Bus.on('peopleCame', (p, Q) => hint(Q.kind));
    Bus.on('peopleLook', (p, Q) => {
      p.stats.people++; fact(Q.kind === 'climber' ? 'science' : 'wild'); if (Q.kind === 'boat') fact('pets', 9);
      cine({ follow: () => ({ x: (Q.x + p.x) / 2, y: (Q.y + p.y) / 2 - 20 }), zoom: clamp((G.cam.w || 900) / (Math.hypot(Q.x - p.x, Q.y - p.y) + 300), .8, 2.2), duration: 9.6, slow: 1, title: Q.kind === 'climber' ? 'A scientist says hello' : 'Look. From far away.' });
    });
    Bus.on('peopleGone', () => { hint('peoplegone'); T.cool = G.time + 6; });
    Bus.on('atDoor', () => { hint('flap'); fact('wings'); });
    Bus.on('strong', (p) => { sound('magic'); hint('jump'); F().lead('first'); });
    Bus.on('fledged', (p) => {
      const f = F(); sound('fanfare'); hint('firstflight'); fact('firstflight');
      if (f.sib) { f.sib.size = 1; f.sib.perchAt(f.line('doorstep'), 30); f.sib.follow = p; f.sib.off = 44; }
      cine({ follow: P, zoom: 2, duration: 2.2, slow: .8, title: 'Your first flight!' });
    });
    Bus.on('firstLanding', (p) => { sound('fanfare'); hint('landed1'); G.particles.sparkle(p.x, p.y - 10, 20, '#ffd24a', 28); later(4, startLesson); });
    Bus.on('landed', (p, L) => {
      const fl = p.flags;
      if (/^ledge|clifftop/.test(L.key) && first('lick')) { fact('lick'); for (const c of ['blueyellow', 'redgreen', 'mealy']) Bus.emit('card', c); if (fl.ls === 'clay') hint('lick'); }
      if (p.stage === 'adult' && !fl.paired && p.nearMate() && first('meet')) hint('preen');
      if (fl.ls === 'call' && fl.heard) { const q = F().station('lost'); if (Math.hypot(p.x - q.x, p.y - q.y) < 130) { hint('found'); G.particles.text(p.x, p.y - 26, '♥', '#ff9ad0', 22); lessonDone(); } }
    });
    Bus.on('splash', () => { hint('splash'); sound('pop'); });
    Bus.on('crackStart', () => hint('crack'));
    Bus.on('ate', (p, kind) => {
      const fl = p.flags, D = G.diff();
      sound('slurp'); if (first('ate' + kind)) fact(kind === 'fig' ? 'seeds' : kind === 'nut' ? 'foot' : 'lick');
      if (LESSON_FOOD[fl.ls] !== kind) { if (p.male && fl.laid && !fl.hatched && p.crop >= D.crop) hint('cropfull'); return; }
      fl.ln = (fl.ln | 0) + 1;
      if (kind === 'clay' && fl.ln === 1 && wild() && !fl.eagle1) { fl.eagle1 = true; later(1.6, () => { if (!F().startVisitor('eagle', 'air')) P().flags.eagle1 = false; }); }
      if (fl.ln >= { fig: D.figs, clay: D.clay, nut: D.nuts }[kind]) { if (kind === 'clay') { push('boat'); T.cool = G.time + 2.5; } lessonDone(); } else hint('more');
    });
    Bus.on('called', (p) => { if (first('call')) fact('loud'); });
    Bus.on('answered', (p) => { if (p.flags.ls === 'call' && !p.flags.heard) { p.flags.heard = true; hint('heard'); } });
    Bus.on('lessonDone', (p, k) => hint('did' + k));
    Bus.on('sleeping', () => { G.tod = .9; cine({ follow: P, zoom: 1.6, duration: 2.8, slow: 1, title: 'Good night' }); });
    Bus.on('woke', (p) => {
      const fl = p.flags; G.tod = .27; G.day++; p.stats.days++; fl.dusk = false; Bus.emit('dawn', p);
      if ((fl.lesson | 0) >= lessons().length) growUp(); else { hint('morning'); later(2, startLesson); }
    });
    Bus.on('grownUp', (p) => {
      sound('fanfare'); Bus.emit('card', 'scarlet'); hint('grown'); fact('grown'); fact('lone', 9);
      cine({ follow: P, zoom: 2.4, duration: 3.6, slow: .5, title: 'Years go by. You are grown!' });
      later(5, () => hint('gomeet'));
    });
    Bus.on('preenStart', () => { hint('preengame'); fact('preen'); });
    Bus.on('tooSoon', () => hint('gentle'));
    Bus.on('paired', (p, m) => {
      sound('fanfare'); G.particles.text(p.x, p.y - 28, '♥', '#ff9ad0', 26); hint('paired'); fact('pair'); fact('wingtowing', 9);
      m.follow = p; m.off = 42;
      cine({ follow: P, zoom: 2.6, duration: 3.4, slow: .6, title: 'Friends for life' });
      later(5, () => hint('findhollow'));
    });
    Bus.on('peeked', (p, h) => {
      p.flags.seen = F().hollows.filter(q => q.seen).map(q => q.key).join(',');
      if (h.who === 'free') return;
      sound('bump'); hint('taken' + h.who); if (first('taken')) fact('hollows'); Bus.emit('card', h.who === 'toucan' ? 'toucan' : h.who === 'bees' ? 'bees' : 'scarlet');
    });
    Bus.on('nestFound', (p, h) => {
      const f = F(), m = f.mate; sound('fanfare'); fact(h.key === 'box' ? 'nestbox' : 'deadpalm');
      cine({ follow: () => ({ x: h.door[0], y: h.door[1] }), zoom: 2.4, duration: 3.2, slow: .7, title: 'An empty hollow. Home!' });
      if (m) m.follow = null;
      if (p.male) { hint('shelays'); if (m) { m.mode = 'nest'; m.line = null; m.x = h.inside[0]; m.y = h.inside[1]; } later(4.5, () => { const q = P(); if (q === p && !q.flags.laid) { q.flags.laid = true; q.stats.eggs = G.diff().eggs; Bus.emit('laid', q); } }); }
      else { hint('enter'); if (m) m.flyTo(h.line, clamp(h.s + (h.s > h.line.len / 2 ? -34 : 34), 0, h.line.len)); }
    });
    Bus.on('entered', () => hint('lay'));
    Bus.on('laid', (p) => {
      sound('magic'); fact('eggs'); hint(p.male ? 'bringfood' : 'sit'); F().feed.clock = 4; p.crop = 0;
      cine({ follow: () => { const h = F().hollow(p.flags.nest); return { x: h.door[0], y: h.door[1] }; }, zoom: 2.8, duration: 3, slow: .7, title: 'Eggs!' });
      if (wild()) { push('toucan'); T.cool = G.time + 9; }
    });
    Bus.on('fedMate', (p, n) => { sound('slurp'); hint(n >= G.diff().trips ? 'fedlast' : 'fedmore'); fact('share'); if (n >= G.diff().trips) later(2.5, hatchOut); });
    Bus.on('chickNamed', (p, seq) => {
      const h = F().hollow(p.flags.nest); sound('magic'); hint('chicknamed');
      later(1, () => F().ring(h.inside[0], h.inside[1] - 10, 'family', seq));
      later(3.2, generationDone);
    });
  }

  /* ---------- every frame ---------- */
  function update(dt) {
    const p = P(), f = F(), fl = p.flags;
    for (let i = timers.length - 1; i >= 0; i--) { const t = timers[i]; if (t.F0 !== f) { timers.splice(i, 1); continue; } if (G.time >= t.at) { timers.splice(i, 1); t.fn(); } }
    if (p.stage === 'egg') return;
    const busy = f.visitor || f.people;
    /* the clock */
    if (G.settings.clock !== false && !busy && !Cinematic.active && p.mode !== 'sleep') {
      const night = G.tod >= .78 || G.tod < .22, t0 = G.tod;
      if (p.stage === 'young') G.tod = fl.dusk ? Math.min(.86, G.tod + dt * .012) : Math.min(.66, G.tod + dt / 420);
      else { G.tod += dt * (night ? 1 / 14 : 1 / (p.stage === 'chick' ? 70 : 260)); if (G.tod >= 1) G.tod -= 1; if (t0 < .25 && G.tod >= .25) { G.day++; p.stats.days++; Bus.emit('dawn', p); } }
    }
    /* the next thing the story has waiting */
    const q = queue();
    if (q.length && !busy && G.time > T.cool && !Cinematic.active && f.feed.state === 'away' && ['nest', 'perch', 'fly'].includes(p.mode) && p.busy <= 0) {
      const kind = q.shift(); setQueue(q); T.cool = G.time + 8;
      if (kind === 'toucan') f.startVisitor('toucan'); else if (kind === 'climber') { if (p.mode === 'nest' && p.stage === 'chick') f.startPeople('climber'); } else if (kind === 'boat') f.startPeople('boat');
    }
    if (p.stage === 'young') {
      if (fl.dusk && !busy) {
        T.duskT += dt; const r = f.station('roost');
        if (T.duskT > 40 && !f.mum.follow) { f.mum.follow = p; f.mum.off = 44; f.dad.follow = p; f.dad.off = -44; hint('theycome'); }
        if (p.mode === 'perch' && p.busy <= 0 && !Cinematic.active && (Math.hypot(p.x - r.x, p.y - r.y) < 180 || (T.duskT > 44 && f.mum.mode === 'perch'))) p.startSleep();
      }
      if (fl.ls === 'call' && !fl.heard) { T.lostT += dt; if (T.lostT > 22) { fl.heard = true; hint('theycall'); Bus.emit('theyCall', p); for (const b of [f.mum, f.dad]) { b.callT = 1; f.ring(b.x, b.y - 12, 'family', p.name()); } } }
      if (fl.ls === 'hide' && !fl.hawk && !busy && G.time > T.cool) { T.hideT += dt; if (T.hideT > 5 && p.mode === 'fly') { fl.hawk = true; f.startVisitor('eagle', 'leaves'); } else if (T.hideT > 40) { fl.hawk = true; f.startVisitor('eagle', 'leaves'); } }
    }
  }

  /* put back what a save does not hold */
  function afterRestore() {
    const p = P(), f = F(), fl = p.flags;
    for (const k of String(fl.seen || '').split(',')) { const h = f.hollow(k); if (h) h.seen = true; }
    if (p.stage === 'chick') { f.sib = new Bird(f, 'sib'); f.sib.mode = 'nest'; f.sib.x = WORLD.eggX + 17; f.sib.y = WORLD.nestY; f.sib.size = [.5, .6, .75, .9][p.instar]; f.sib.face = -1; if (fl.strong) f.lead('first'); }
    if (p.stage === 'young') {
      f.sib = new Bird(f, 'sib').perchAt(p.line, p.s + 34); f.sib.follow = p; f.sib.off = 44;
      if (fl.dusk) { T.duskT = 0; f.lead('roost'); }
      else if (fl.ls) { const k = fl.ls; if (k === 'call') { fl.heard = true; f.lead('lost'); } else f.lead(k); if (k === 'hide') fl.hawk = false; }
      else if ((fl.lesson | 0) >= lessons().length || fl.lesson > 0) later(2, startDusk); else later(2, startLesson);
    }
    if (p.stage === 'adult') {
      f.mum.perchAt(f.line('homehigh'), 40); f.dad.perchAt(f.line('homehigh'), 90);
      const m = makeMate(), h = f.hollow(fl.nest);
      if (fl.paired && !h) { m.perchAt(p.line || f.line('ledge3'), p.s + 30); m.follow = p; m.off = 42; }
      if (h) { if (p.male) { m.mode = 'nest'; m.line = null; m.x = h.inside[0]; m.y = h.inside[1]; if (!fl.laid) later(2, () => { if (!P().flags.laid) { P().flags.laid = true; Bus.emit('laid', P()); } }); } else m.perchAt(h.line, clamp(h.s + (h.s > h.line.len / 2 ? -34 : 34), 0, h.line.len)); }
      if (fl.hatched && !fl.genDone) { f.chicks = [{ x: h.inside[0] - 9, y: h.inside[1], t: 3 }, { x: h.inside[0] + 9, y: h.inside[1], t: 3 }]; later(1.5, nameChick); }
      else if (!p.male && fl.laid && (fl.sitFed | 0) >= G.diff().sitFeeds) later(1.5, hatchOut);
      else if (p.male && fl.laid && p.stats.trips >= G.diff().trips) later(1.5, hatchOut);
    }
  }

  return { init, bind, reset, update, afterRestore, goal, generationDone, hatchOut, startLesson, lessonDone, startDusk, growUp, makeMate, nameSeq, lessons, queue, once, T };
})();
