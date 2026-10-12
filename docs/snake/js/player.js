/* ============================================================
   player.js — you, the garter snake, from birth to a new litter
   ============================================================
   stage  sac     born in late summer, curled up in a thin clear bag:
                  wiggle to break out
          snake   instar 1  a newborn (about 18 cm)
                  instar 2  after the first shed: a baby snake; its
                            first autumn, the trail to the den, winter
                  instar 3  a young snake (the next summer)
                  instar 4  grown up: autumn and winter again, then the
                            spring gathering at the den; boys follow a
                            girl's scent trail, girls meet a boy, carry
                            the babies all summer and give birth
   modes  crawl (slithering, swimming in the pond, basking in a coil)
          hide (under a board, log, rock or leaves) · den (in the
          crack in the rock) · winter · chill (too cold: curled up,
          resting) · shed (crawling out of the old skin) · startle ·
          measured (the scientist) · birth
   Every frame: warmth (sun, shade, cover, water, night, season), the
   tummy turning snacks into growth while warm, and the shed cycle:
   tight → blue eyes (hide!) → clear → rub the nose → crawl out.
   Nothing hurts the snake, ever: a hawk or heron misses; a raccoon
   is sent off by a stinky musk; the scientist measures and lets go.
   ============================================================ */
'use strict';

const SAC_T = 3, TIGHT_T = 3, WINTER_T = 10, CHILL_T = 4, BROOD_T = 40, MEASURE_T = 4.6, STARTLE_T = 1, DIGEST = .9, BELLY_MAX = 14;

class Snake {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'eastern';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'sac'; this.mode = 'sac';
    this.x = WORLD.birthX; this.y = 0; this.face = 1; this.dist = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.sacT = 0; this.crack = 0;
    this.instar = 1; this.cfood = 0; this.belly = 0; this.warm = .55; this.full = false; this.cm = 17;
    this.shed = null; this.tightT = 0; this.blueT = 0; this.rubN = 0; this.peel = undefined; this.fresh = 0; this.peelFrom = 0;
    this.tongueT = 0; this.scentT = 0; this.dashT = 0; this.dashCool = 0; this.lastDash = -99;
    this.moving = false; this.stillT = 0; this.coiled = false; this.headUp = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.cover = null; this.s = 0; this.winterT = 0; this.chillT = 0; this.startleT = 0; this.measureT = 0; this.broodT = 0; this.eggs = 0; this.birth = null;
    this.hintClock = 0; this.target = null; this.trail = [];
    this.stats = { flicks: 0, snacks: 0, sheds: 0, looked: 0, bask: 0, hides: 0, dashes: 0, dodges: 0, startles: 0, musks: 0, swim: 0, frogs: 0, measured: 0, babies: 0, winters: 0, wins: 0, losses: 0, chills: 0, rubs: 0, crawled: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get L() { return this.G.world.land; }
  get len() { return snakeUnits(this.cm); }
  get thick() { return this.len * .085; }
  get r() { return this.thick; }
  get hidden() { return ['hide', 'den', 'winter', 'measured'].includes(this.mode); }
  get underground() { return this.mode === 'den' || this.mode === 'winter'; }
  get swimming() { return this.stage === 'snake' && (this.mode === 'crawl' || this.mode === 'startle') && this.L.inPond(this.x); }
  get blue() { return this.shed === 'blue' ? clamp(Math.min(this.blueT * 1.2, (this.D.blue - this.blueT) * 1.2), 0, 1) : 0; }
  get warmBand() { return this.D.warm; }
  get lobTh() { return this.instar < 4 ? this.D.food[this.instar - 1] : this.D.food[2] * BONUS; }
  stageKey() {
    if (this.stage === 'sac' || this.instar <= 1) return 'newborn';
    if (this.underground || (this.flags.autumnNow && !this.flags.springOut)) return 'den';
    if (this.instar === 2 && !this.stats.winters) return 'baby';
    if (this.instar <= 3) return 'young';
    return this.flags.met ? 'parent' : 'adult';
  }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 5; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt;
    this.hintClock -= dt; this.dashCool -= dt; this.dashT = Math.max(0, this.dashT - dt);
    this.tongueT = Math.max(0, this.tongueT - dt * 2.2); this.scentT = Math.max(0, this.scentT - dt);
    this.fresh = Math.max(0, this.fresh - dt * .05);
    if (this.target) this.steerToTarget();
    if (this.stage === 'sac') this.updateSac(dt);
    else this.updateSnake(dt);
    this.input.actionPressed = false; this.input.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x;
    if (Math.abs(dx) < Math.max(4, this.thick)) { this.target = null; this.input.x = 0; return; }
    this.input.x = sign(dx); this.input.y = 0;
  }
  goTo(x, y) { if (this.stage === 'sac' || !['crawl', 'hide'].includes(this.mode)) return; this.target = { x, y }; }

  /* ---------- in the bag ---------- */
  updateSac(dt) {
    this.sacT += dt;
    this.y = this.W.topAt(this.x);
    if (this.sacT > SAC_T && !this.flags.sacReady) { this.flags.sacReady = true; Bus.emit('sacReady', this); }
    if (this.flags.sacReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.breaking) { this.flags.breaking = true; this.milestone('born', () => this.breakOut()); }
    }
  }
  breakOut() {
    this.stage = 'snake'; this.mode = 'crawl'; this.instar = 1; this.cfood = 0; this.warm = .55;
    this.cm = snakeCM(1, 0, this.D.food, this.sex);
    this.y = this.W.topAt(this.x) - this.thick * .5;
    this.trail = Trail.coil(this.len, this.thick, this.x - this.face * this.len * .1, this.W.topAt(this.x), this.face, 1.3); this.coiled = true;
    this.G.particles.sparkle(this.x, this.y - 6, 14, '#e8f4ff', 10);
    Bus.emit('born', this);
  }

  /* ============================================================
     THE SNAKE
     ============================================================ */
  updateSnake(dt) {
    const D = this.D;
    this.cm = snakeCM(this.instar, this.cfood, D.food, this.sex);
    this.updateWarmth(dt);
    /* the tummy: snacks turn into growing only while the snake is warm enough */
    if (this.belly > 0 && this.warm >= this.warmBand[0] && !this.underground) {
      const d = Math.min(this.belly, dt * DIGEST * (.6 + this.warm));
      this.belly -= d; this.cfood = Math.min(this.cfood + d, this.lobTh);
      if (this.belly <= 0 && !this.flags.digested) { this.flags.digested = true; Bus.emit('digested', this); }
    }
    if (this.flags.carrying && !this.flags.ready) this.updateBrood(dt);
    this.updateShed(dt);
    if (this.busy > 0) { this.updateBusy(dt); return; }
    switch (this.mode) {
      case 'crawl': this.updateCrawl(dt); break;
      case 'hide': this.updateHide(dt); break;
      case 'den': this.updateDen(dt); break;
      case 'winter': this.winterT += dt; if (this.winterT >= WINTER_T && !this.flags.winterEnding) { this.flags.winterEnding = true; this.endWinter(); } break;
      case 'chill': this.chillT += dt; if (this.chillT >= CHILL_T) { this.mode = 'crawl'; this.warm = Math.max(this.warm, .34); Bus.emit('chillDone', this); } break;
      case 'shed': this.updatePeel(dt); break;
      case 'startle': this.startleT -= dt; if (this.startleT <= 0) this.mode = 'crawl'; break;
      case 'measured': this.updateMeasured(dt); break;
      case 'birth': this.updateBirth(dt); break;
    }
    if (this.instar < 4 && this.cfood >= this.lobTh && !this.full) { this.full = true; Bus.emit('full', this); }
  }

  /* ---------- warmth: a snake is as warm as the place it is in ---------- */
  warmTarget() {
    const W = this.W, G = this.G, si = SEASON_INFO[W.season];
    const sun = W.sun(G.tod), night = nightAmount(G.tod);
    const amb = { summer: .5, spring: .32, autumn: .26, winter: .1 }[W.season] - night * .2 - W.weather.rain * .06;
    if (this.underground) return .22;
    if (this.mode === 'measured') return Math.max(this.warm, .45);
    if (this.mode === 'hide') return amb + .1 + sun * .2;
    if (this.swimming) return .2 + sun * .12;
    const rock = W.baskSpot(this.x), black = this.form === 'black' ? .07 : 0;
    return amb + sun * (.6 + black) + (rock ? sun * .14 : 0) + (si ? 0 : 0);
  }
  updateWarmth(dt) {
    if (this.mode === 'winter') { this.warm += (.12 - this.warm) * dt * .5; return; }
    const target = this.warmTarget();
    const basking = this.coiled && this.mode === 'crawl' && !this.swimming && target > this.warm;
    let k = .085 * (basking ? 1.5 : 1);
    if (target < this.warm) k *= this.D.cold * (this.swimming ? 1.6 : 1);
    this.warm = clamp(this.warm + (target - this.warm) * k * dt, 0, 1);
    const [lo, hi] = this.warmBand;
    if (basking && this.W.sun(this.G.tod) > .3) { this.stats.bask += dt; if (!this.flags.baskSaid && this.stats.bask > 1.5) { this.flags.baskSaid = true; Bus.emit('basking', this); } }
    if (this.warm < lo - .02 && !this.flags.coldSaid && ['crawl', 'hide'].includes(this.mode)) { this.flags.coldSaid = true; Bus.emit('cold', this); }
    if (this.warm > lo + .08) this.flags.coldSaid = false;
    if (this.warm > hi + .02 && !this.flags.hotSaid && this.mode === 'crawl') { this.flags.hotSaid = true; Bus.emit('hot', this); }
    if (this.warm < hi - .06) this.flags.hotSaid = false;
    /* too cold to move: curl up and rest until it is warmer (a time-lapse) */
    if (this.warm < .05 && this.mode === 'crawl' && this.busy <= 0 && this.stage === 'snake') { this.mode = 'chill'; this.chillT = 0; this.target = null; this.stats.chills++; this.coilHere(); Bus.emit('chilled', this); }
  }
  /* the speed a snake slithers at: slow when cold */
  speedNow() {
    const warmF = lerp(.4, 1.1, smoothstep(.05, .5, this.warm)) * (this.warm > this.warmBand[1] + .04 ? .9 : 1);
    return (24 + this.len * .42) * warmF;
  }
  raceSpeed() { return (24 + this.len * .42) * lerp(.4, 1.1, smoothstep(.05, .5, .7)); }

  updateCrawl(dt) {
    const W = this.W, L = this.L, inp = this.input;
    if (inp.actionPressed) { if (this.act()) return; }
    if (inp.eggPressed) this.dash();
    let sp = this.speedNow() * (this.dashT > 0 ? 2.2 : 1) * (this.G.settings.slowmo ? .7 : 1) * (this.shed === 'blue' ? .8 : 1);
    const wasSwim = this.swimming;
    if (wasSwim) sp *= .78;
    if (W.race && !W.race.done && this.sex === 'boy') sp *= this.scentT > 0 ? 1.12 : .65;
    if (Math.abs(inp.x) > .15) {
      const dx = inp.x * sp * dt, nx = clamp(this.x + dx, WORLD.walkL, WORLD.walkR);
      if ((nx <= WORLD.walkL + 1 && dx < 0) || (nx >= WORLD.walkR - 1 && dx > 0)) this.say('edge');
      this.dist += Math.abs(nx - this.x); this.stats.crawled += Math.abs(nx - this.x);
      if (wasSwim) this.stats.swim += Math.abs(nx - this.x);
      this.x = nx; this.face = sign(inp.x); this.moving = true; this.stillT = 0; this.coiled = false;
    } else { this.moving = false; this.stillT += dt; }
    const swim = this.swimming;
    this.y = swim ? WORLD.waterY - this.thick * .15 : W.topAt(this.x) - this.thick * .5;
    if (this.moving) Trail.push(this.trail, this.x, this.y, this.len, 3, Trail.wave(this.dist, this.len));
    this.headUp += ((swim ? .55 : this.tongueT > 0 ? .3 : W.race && !W.race.done ? .2 : 0) - this.headUp) * Math.min(1, dt * 5);
    /* still for a while out of the water: coil up to bask */
    if (!this.moving && this.stillT > 2.2 && !swim && !this.coiled) this.coilHere();
    if (swim && !this.flags.swam) { this.flags.swam = true; Bus.emit('swimStart', this); }
    /* push down: into the den's crack (in autumn), or under a cover */
    /* at the den mouth in autumn, holding down is enough (a finger resting on the pad's down button) */
    const denNow = this.flags.autumnNow && !this.flags.wintered && this.atDenMouth();
    if (inp.y > .6 && (!this._downHeld || denNow)) this.tryDown();
    this._downHeld = inp.y > .6;
    if (denNow && this.mode === 'crawl') this.say('denmouth');
    /* places */
    const reg = L.region(this.x);
    if (reg !== this.region) { this.region = reg; Bus.emit('region', this, reg); }
  }
  coilHere() { this.trail = Trail.coil(this.len, this.thick, this.x - this.face * this.len * .1, this.W.topAt(this.x), this.face, this.len < 60 ? 1.3 : 1.7); this.coiled = true; }
  dash() {
    if (this.dashCool > 0 || this.mode !== 'crawl') return false;
    this.dashT = .8; this.dashCool = 1.3; this.lastDash = this.t; this.stats.dashes++; this.target = null;
    this.G.particles.dust(this.x - this.face * this.len * .3, this.y + this.thick * .5, '#b8a070', 5, this.face > 0 ? Math.PI : 0);
    Bus.emit('dash', this);
    return true;
  }
  atDenMouth() { const m = this.L.mouth; return Math.abs(this.x - m.x) < 26 + this.thick && Math.abs(this.y - m.y) < 40; }
  tryDown() {
    if (this.atDenMouth()) { if (this.flags.autumnNow && !this.flags.wintered) { this.enterDen(); return; } this.say('notyet'); return; }
    const c = this.W.coverAt(this.x, this.thick);
    if (c && c.hide) { this.hideUnder(c); return; }
  }

  /* ---------- hiding under a cover ---------- */
  hideUnder(c) {
    this.mode = 'hide'; this.cover = c; this.target = null; this.coiled = false;
    /* tuck in so the snout just peeks out of the near edge */
    const side = this.x >= c.x ? 1 : -1;
    this.face = side; this.x = c.x + side * (c.w / 2 + this.thick * .2);
    this.y = this.L.walkY(this.x) - this.thick * .5;
    Trail.reset(this.trail, this.x, this.y, this.face, this.len, (x) => this.L.walkY(x), this.thick * .5);
    this.stats.hides++;
    Bus.emit('hid', this, c);
  }
  updateHide(dt) {
    const inp = this.input;
    if (inp.actionPressed) { if (this.act()) return; }
    this.headUp += (0 - this.headUp) * Math.min(1, dt * 5);
    if (this.cover && this.cover.lifted && this.mode === 'hide') { this.unhide(); return; }
    if ((Math.abs(inp.x) > .5 && !this.flags.ready) || inp.y < -.6 || (Math.abs(inp.x) > .5 && this.flags.ready && !this.flags.birthing)) { if (Math.abs(inp.x) > .5) this.face = sign(inp.x); this.unhide(); }
  }
  unhide() { this.mode = 'crawl'; this.cover = null; Bus.emit('unhid', this); }

  /* ---------- the den: a crack in the rock, down below the frost line ---------- */
  enterDen() {
    const go = () => { this.mode = 'den'; this.s = 0; this.coiled = false; this.target = null; const q = this.L.pointAt(0); this.x = q.x; this.y = q.y; Bus.emit('enterDen', this); };
    if (!this.flags.denGate) { this.flags.denGate = true; this.milestone('den', go); } else go();
  }
  updateDen(dt) {
    const L = this.L, inp = this.input;
    const q = L.pointAt(this.s);
    let v = inp.x * q.tx + inp.y * q.ty;
    if (Math.abs(v) < .3 && Math.abs(inp.y) > .3) v = inp.y;
    if (Math.abs(v) < .3 && Math.abs(inp.x) > .3) v = inp.x * (q.tx < 0 ? -1 : 1);
    const sp = this.speedNow() * .7 + 10;
    if (Math.abs(v) > .15) { this.s = clamp(this.s + v * sp * dt, 0, L.pathLen); this.dist += Math.abs(v * sp * dt); this.moving = true; } else this.moving = false;
    const p = L.pointAt(this.s); this.x = p.x; this.y = p.y;
    if (this.moving) { this.face = (p.tx * Math.sign(v)) >= 0 ? 1 : -1; Trail.push(this.trail, this.x, this.y, this.len, 3, 0); }
    const deep = L.depthAt(this.x, this.y);
    if (deep > WORLD.frost + 10 && !this.flags.belowFrostSaid) { this.flags.belowFrostSaid = true; Bus.emit('belowFrost', this); }
    if (this.s >= L.pathLen - 4 && this.flags.autumnNow && !this.flags.wintered) this.startWinter();
    if (this.s <= 0 && v < -.2) this.leaveDen();
  }
  startWinter() {
    const C = this.L.chamber;
    this.mode = 'winter'; this.winterT = 0; this.flags.winterEnding = false; this.target = null;
    this.x = C.x + rnd(-20, 20); this.y = C.y;
    this.trail = Trail.coil(this.len, this.thick, this.x, C.y + C.ry * .7, this.face, this.len < 60 ? 1.3 : 1.7); this.coiled = true;
    Bus.emit('winterStart', this);
  }
  endWinter() {
    this.flags.wintered = true; this.stats.winters++;
    this.mode = 'den'; this.s = this.L.pathLen;
    const q = this.L.pointAt(this.s); this.x = q.x; this.y = q.y;
    Bus.emit('winterDone', this);
  }
  leaveDen() {
    const L = this.L, m = L.mouth;
    this.mode = 'crawl'; this.face = 1; this.x = m.x + this.thick; this.y = this.W.topAt(this.x) - this.thick * .5;
    Trail.reset(this.trail, this.x, this.y, -1, this.len, null);
    for (let i = 0; i < this.trail.length; i++) { const q = L.pointAt(i * 3); this.trail[i].x = q.x; this.trail[i].y = q.y; this.trail[i].z = 0; }
    this.trail.unshift({ x: this.x, y: this.y, z: 0, c: 0 });
    if (this.flags.wintered && this.flags.autumnNow) {
      this.flags.autumnNow = false; this.flags.springOut = true;
      const go = () => Bus.emit('emerged', this);
      if (!this.flags.springGate) { this.flags.springGate = true; this.milestone('spring', go); } else go();
    } else Bus.emit('leftDen', this);
  }

  /* ---------- the shed: tight → blue eyes → clear → rub → crawl out ---------- */
  updateShed(dt) {
    if (this.full && !this.shed && this.instar < 4 && !this.underground && this.mode !== 'measured') { this.shed = 'tight'; this.tightT = 0; Bus.emit('tight', this); }
    if (this.shed === 'tight') { this.tightT += dt; if (this.tightT > TIGHT_T) { this.shed = 'blue'; this.blueT = 0; Bus.emit('blue', this); } }
    else if (this.shed === 'blue') {
      /* hidden and resting, the blue days pass quickly; out in the open, slowly */
      this.blueT += dt * (this.mode === 'hide' ? 1 : .3);
      if (this.blueT >= this.D.blue) { this.shed = 'clear'; Bus.emit('eyesClear', this); }
    }
  }
  startPeel() {
    this.mode = 'shed'; this.peel = 0; this.cover = null; this.target = null; this.peelFrom = this.x; this.coiled = false;
    Bus.emit('peelStart', this);
  }
  updatePeel(dt) {
    const inp = this.input, W = this.W;
    if (Math.abs(inp.x) > .15) {
      const sp = this.speedNow() * .55 + 8, dx = inp.x * sp * dt;
      this.x = clamp(this.x + dx, WORLD.walkL, WORLD.walkR); this.face = sign(inp.x); this.dist += Math.abs(dx);
      this.peel = Math.min(1, this.peel + Math.abs(dx) / (this.len * .95));
      this.y = (this.swimming ? WORLD.waterY : W.topAt(this.x)) - this.thick * .5;
      Trail.push(this.trail, this.x, this.y, this.len, 3, Trail.wave(this.dist, this.len));
      if (Math.random() < dt * 6) this.G.particles.puff(this.x - this.face * this.len * this.peel, this.y, 'rgba(240,238,228,.8)', 1);
      this.moving = true;
    } else this.moving = false;
    if (this.peel >= 1 && !this.flags.peelDone) { this.flags.peelDone = true; this.finishShed(); }
  }
  finishShed() {
    const W = this.W, before = this.instar, len = this.len;
    /* the old skin stays behind, inside out, a little longer than the snake */
    const ex = this.x - this.face * len * .95;
    W.exuviae.push({ x: ex, y: W.topAt(ex), len: len * 1.08, thick: this.thick, form: this.form, face: this.face, seed: (Math.random() * 9) | 0, looked: false, t: 0 });
    const done = () => {
      this.instar = Math.min(4, this.instar + 1); this.full = false; this.shed = null; this.peel = undefined; this.rubN = 0; this.blueT = 0;
      this.flags.peelDone = false; this.fresh = 1; this.mode = 'crawl'; this.stats.sheds++;
      this.cm = snakeCM(this.instar, this.cfood, this.D.food, this.sex);
      this.G.particles.sparkle(this.x, this.y - 4, 22, '#fff8c0', this.len * .4);
      Bus.emit('shed', this, this.instar, before);
    };
    if (before === 3) this.milestone('adult', done); else done();
  }

  /* ---------- what Space does right now ---------- */
  reach() { return this.thick * 2 + 14; }
  context() {
    const W = this.W;
    if (this.stage === 'sac') return null;
    if (this.busy > 0) return null;
    if (this.mode === 'hide') {
      if (this.flags.ready && !this.flags.birthDone && this.sex === 'girl') return 'birth';
      if (this.shed === 'clear' && this.cover && this.cover.rough) return 'rub';
      return 'flick';
    }
    if (this.mode !== 'crawl') return null;
    const R = this.reach(), hx = this.x + this.face * this.thick;
    if (this.shed === 'clear' && !this.swimming && W.roughNear(hx, this.thick + 6)) return 'rub';
    if (!this.flags.met) {
      if (this.sex === 'boy' && W.race && !W.race.done) { const g = W.race.girl; if (Math.abs(g.x - this.x) < g.len * .5 + 30 && Math.abs(g.y - this.y) < 50) return 'meet'; }
      if (this.sex === 'girl' && this.flags.gathering) { const b = W.boys().find(n => Math.abs(n.x - this.x) < R + n.len * .3); if (b) return 'meet'; }
    }
    if (W.exuviaNear(this.x, this.y, R)) return 'look';
    if (this.belly < BELLY_MAX - 2 && W.snackNear(hx, this.y, R)) return 'eat';
    if (this.atDenMouth() && this.flags.autumnNow && !this.flags.wintered) return 'den';
    return 'flick';
  }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    if (v === 'flick') this.flick();
    else if (v === 'eat') { const s = W.snackNear(this.x + this.face * this.thick, this.y, this.reach()); this.face = sign(s.x - this.x) || this.face; this.startBusy('eat', 1, s); }
    else if (v === 'look') { const e = W.exuviaNear(this.x, this.y, this.reach()); this.startBusy('look', 1.6, e); }
    else if (v === 'rub') { this.startBusy('rub', .55, null); }
    else if (v === 'meet') { const o = this.sex === 'boy' ? W.race.girl : W.boys().find(n => Math.abs(n.x - this.x) < this.reach() + n.len * .3); this.face = sign(o.x - this.x) || this.face; this.startBusy('meet', 2, o); }
    else if (v === 'den') this.enterDen();
    else if (v === 'birth') this.startBirth();
    Bus.emit('act', this, v);
    return true;
  }
  /* the tongue flick: smell the air and the ground */
  flick() {
    this.tongueT = 1; this.scentT = 3.2; this.stats.flicks++;
    const n = this.W.sniff(this.x, this.y, 300 + this.len);
    if (this.W.race && !this.W.race.done) this.W.race.girl.trailShown = 3;
    AudioFX.flick && AudioFX.flick();
    Bus.emit('flicked', this, n);
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; this.target = null; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj;
    this.busy -= dt;
    if (k === 'eat' && Math.random() < dt * 6) this.G.particles.sparkle(this.x + this.face * this.thick * 2, this.y - this.thick, 1, '#fff3b0', 6);
    if (k === 'meet' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - this.thick * 3, '♥', '#ff7aa8', 14);
    if (k === 'rub') { this.headUp = .1 + Math.abs(Math.sin(this.busy * 18)) * .2; if (Math.random() < dt * 10) this.G.particles.dust(this.x + this.face * this.thick * 1.5, this.y, '#c8c0b0', 1); }
    if (this.busy > 0) return;
    this.busy = 0;
    if (k === 'eat' && o) {
      this.W.eatSnack(o);
      this.belly = Math.min(BELLY_MAX, this.belly + o.val); this.flags.digested = false; this.stats.snacks++;
      this.G.particles.text(this.x, this.y - this.thick * 3, 'yum!', '#fff3b0', 13);
      Bus.emit('ateSnack', this, o);
    }
    if (k === 'look' && o) { o.looked = true; this.stats.looked++; Bus.emit('lookedShed', this, o); }
    if (k === 'rub') {
      this.rubN++; this.stats.rubs++; Bus.emit('rubbing', this, this.rubN);
      if (this.rubN >= 3 && !this.flags.rubbed) { this.flags.rubbed = true; const go = () => { this.flags.rubbed = false; this.startPeel(); }; if (!this.flags.shedGate) { this.flags.shedGate = true; this.milestone('shed', go); } else go(); }
    }
    if (k === 'meet' && o) { this.flags.met = true; Bus.emit('met', this, o); }
  }

  /* ---------- a visitor came for a look: it always misses ---------- */
  struck(h) {
    if (this.stage !== 'snake') return;
    const isRaccoon = h === this.W.raccoon;
    if (isRaccoon) {
      if (this.hidden || Math.abs(h.x - this.x) > 110) { Bus.emit('raccoonMissed', this, h); return; }
      h.musked = true; this.stats.musks++;
      this.G.particles.puff(this.x, this.y - 6, 'rgba(150,180,60,.7)', 10);
      Bus.emit('musk', this, h);
      return;
    }
    const recentDash = this.t - this.lastDash < 1.4;
    if (this.hidden || recentDash || Math.abs((h.tx !== undefined ? h.tx : h.x) - this.x) > 110) { this.stats.dodges++; Bus.emit('dodged', this, h); }
    else this.startle(h);
  }
  startle(h) { if (this.mode !== 'crawl' || this.busy > 0) { this.stats.dodges++; Bus.emit('dodged', this, h); return; } this.mode = 'startle'; this.startleT = STARTLE_T; this.stats.startles++; this.target = null; Bus.emit('missed', this, h); }

  /* ---------- the scientist's coverboard ---------- */
  startMeasured(sci) { this.mode = 'measured'; this.measureT = 0; this.sci = sci; sci.measuring = true; this.target = null; Bus.emit('lifted', this); }
  updateMeasured(dt) {
    const s = this.sci; this.measureT += dt;
    if (s) { this.x = s.x + s.face * 14; this.y = this.L.walkY(s.x) - 30; }
    if (this.measureT > 1.8 && !this.flags.measuredNow) { this.flags.measuredNow = true; this.stats.measured++; Bus.emit('measured', this); }
    if (this.measureT >= MEASURE_T) {
      if (s) s.measuring = false;
      this.flags.measuredNow = false; this.sci = null;
      const c = s && s.board; this.x = c ? c.x + c.w / 2 + this.thick : this.x; this.mode = 'crawl'; this.y = this.W.topAt(this.x) - this.thick * .5;
      Trail.reset(this.trail, this.x, this.y, this.face, this.len, (x) => this.W.topAt(x), this.thick * .5);
      Bus.emit('putBack', this);
    }
  }

  /* ---------- the girl: carrying the babies, then a litter ---------- */
  updateBrood(dt) {
    const [lo, hi] = this.warmBand;
    if (!this.underground && this.warm >= lo + .04 && this.warm <= hi + .04) { this.broodT += dt; if (!this.flags.warmBrood) { this.flags.warmBrood = true; Bus.emit('broodWarm', this); } }
    else if (this.warm < lo) this.flags.warmBrood = false;
    this.eggs = clamp(this.broodT / BROOD_T, 0, 1);
    if (this.broodT >= BROOD_T && !this.flags.ready) { this.flags.ready = true; Bus.emit('babiesReady', this); }
  }
  startBirth() { this.mode = 'birth'; this.flags.birthing = true; this.birth = { good: 0, miss: 0, t: 0, flash: 0, lastIdx: -1 }; this.target = null; Bus.emit('birthStart', this); }
  birthWindow() { return this.W.pulse() > .62; }
  updateBirth(dt) {
    const b = this.birth, W = this.W, D = this.D;
    b.t += dt; b.flash = Math.max(0, b.flash - dt * 2);
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.birthGate) {
      const idx = W.pulseIndex();
      if (this.birthWindow() && b.lastIdx !== idx) {
        b.lastIdx = idx; b.good++; b.flash = 1;
        const n = 3 + ((Math.random() * 3) | 0); this.stats.babies += n;
        W.babyBurst(this.x + this.face * (this.thick * 3 + 18), n, this.form);
        this.G.particles.sparkle(this.x, this.y - 8, 16, '#fff3c0', 20);
        Bus.emit('push', this, b.good, n);
        if (b.good >= D.pushes) { this.flags.birthGate = true; this.milestone('babies', () => { this.flags.birthDone = true; this.mode = 'hide'; this.flags.ready = false; this.flags.carrying = false; this.eggs = 0; Bus.emit('litterBorn', this); }); }
      } else if (b.lastIdx !== idx) { b.miss++; this.say('birth'); }
    }
  }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'stage', 'mode', 'x', 'y', 'face', 'sacT', 'instar', 'cfood', 'belly', 'warm', 'full', 'shed', 'blueT', 'rubN', 'broodT', 'eggs', 's', 'winterT', 'stats', 'flags']) o[k] = this[k];
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    if (['sac', 'snake'].includes(o.stage)) this.stage = o.stage;
    const modes = this.stage === 'sac' ? ['sac'] : ['crawl', 'hide', 'den', 'winter'];
    this.mode = modes.includes(o.mode) ? o.mode : modes[0];
    this.x = clamp(num(o.x, this.x), WORLD.walkL, WORLD.walkR);
    this.face = o.face === -1 ? -1 : 1;
    this.sacT = num(o.sacT, 0);
    this.instar = clamp(Math.round(num(o.instar, 1)), 1, 4); this.cfood = Math.max(0, num(o.cfood, 0)); this.belly = clamp(num(o.belly, 0), 0, BELLY_MAX);
    this.warm = clamp(num(o.warm, .5), 0, 1); this.full = !!o.full;
    this.shed = ['tight', 'blue', 'clear'].includes(o.shed) ? o.shed : null; this.blueT = Math.max(0, num(o.blueT, 0)); this.rubN = clamp(num(o.rubN, 0) | 0, 0, 3);
    this.broodT = Math.max(0, num(o.broodT, 0)); this.eggs = clamp(num(o.eggs, 0), 0, 1);
    this.s = clamp(num(o.s, 0), 0, this.L.pathLen); this.winterT = Math.max(0, num(o.winterT, 0));
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) if (/^[A-Za-z_0-9]{1,30}$/.test(k)) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    /* a step that was waiting when the game closed starts again by itself */
    for (const k of ['breaking', 'rubbed', 'peelDone', 'winterEnding', 'birthGate', 'birthing', 'baskSaid', 'coldSaid', 'hotSaid', 'measuredNow', 'warmBrood', 'digested']) delete this.flags[k];
    if (this.shed === 'clear') this.rubN = 0;
    this.cm = this.stage === 'snake' ? snakeCM(this.instar, this.cfood, this.D.food, this.sex) : 17;
    const W = this.W, L = this.L;
    if (this.mode === 'den' || this.mode === 'winter') {
      if (this.mode === 'winter') { this.startWinter(); this.winterT = clamp(num(o.winterT, 0), 0, WINTER_T - .5); }
      else { const q = L.pointAt(this.s); this.x = q.x; this.y = q.y; Trail.reset(this.trail, this.x, this.y, this.face, this.len, null); for (let i = 0; i < this.trail.length; i++) { const p = L.pointAt(this.s - i * 3); this.trail[i].x = p.x; this.trail[i].y = p.y; this.trail[i].z = 0; } }
    } else if (this.mode === 'hide') {
      const c = W.coverAt(this.x, this.thick * 2 + 10);
      if (c && !c.lifted) this.hideUnder(c); else { this.mode = 'crawl'; }
    }
    if (this.mode === 'crawl') { this.y = (this.stage === 'snake' && L.inPond(this.x) ? WORLD.waterY - this.thick * .15 : W.topAt(this.x) - this.thick * .5); Trail.reset(this.trail, this.x, this.y, this.face, this.len, (x) => W.topAt(x), this.thick * .5); }
    if (this.stage === 'sac') this.y = W.topAt(this.x);
  }
}
