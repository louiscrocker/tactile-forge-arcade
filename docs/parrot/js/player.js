/* ============================================================
   player.js — you, the scarlet macaw, from the egg on
   ============================================================
   stage  egg     in the egg, in a hollow high in a tree
          chick   in the hollow: fed, feather by feather (instar 0..3)
          young   out of the hollow, learning from your family
          adult   grown: a mate, a hollow, eggs of your own
   mode   egg     wiggle out (push any arrow)
          nest    on the floor of the hollow.  Up climbs to the door
                  when your feathers are grown.
          perch   on a Line at s: a branch, a ledge, the ground.
                  Left and right sidle along; up takes off.
          fly     arrows fly; up (or Space) flaps; down comes down
                  and lands on whatever is near.
          sleep   the night goes by
          echo · crack · preen   the little games (player2.js)
   Space is "do it" (beg, flap, eat, crack, peek…).  E is your call.
   Nothing hurts the parrot, ever.
   ============================================================ */
'use strict';

const SIZE = { chick: [5, 7, 10, 13], young: 14, adult: 16 };
const BODY_CM = { chick: [6, 14, 30, 60], young: 80, adult: 85 };

class Parrot {
  constructor(G, form) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'girl'; this.male = FORMS[this.form].male;
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.eggX; this.y = WORLD.eggY; this.face = 1; this.vx = 0; this.vy = 0;
    this.line = null; this.s = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.walkPh = 0; this.flapPh = 0; this.flapping = 0; this.moving = false;
    this.food = 0; this.instar = 0; this.crop = 0; this.begN = 0; this.flapN = 0; this.eggsN = 0;
    this.busy = 0; this.busyKind = null; this.busyDone = null; this.callCool = 0; this.callT = 0; this.sleepT = 0;
    this.ec = null; this.cr = null; this.pr = null; this.backTo = null; this.lastDir = null;
    this.target = null; this.auto = null; this.hintClock = 0; this.hidden = false;
    this.stats = { feeds: 0, begs: 0, figs: 0, nuts: 0, clay: 0, calls: 0, lands: 0, flights: 0, far: 0, hides: 0, flushes: 0, visitors: 0, people: 0, peeks: 0, eggs: 0, trips: 0, preens: 0, days: 0, notes: 0, splashes: 0, lessons: 0 };
    this.flags = {};
  }
  get D() { return this.G.diff(); }
  get F() { return this.G.forest; }
  get r() { return this.stage === 'egg' ? 5 : this.stage === 'chick' ? SIZE.chick[this.instar] : SIZE[this.stage]; }
  get lengthCM() { return this.stage === 'egg' ? 5 : this.stage === 'chick' ? BODY_CM.chick[this.instar] : BODY_CM[this.stage]; }
  get need() { const th = this.D.feeds; return this.stage === 'chick' && this.instar < th.length ? th[this.instar] : Infinity; }
  get flySpeed() { return (this.flags.firstFlight ? 125 : this.stage === 'adult' ? 255 : 195 + Math.min(4, this.stats.lessons) * 10) * (this.G.settings.slowmo ? .8 : 1); }
  get underground() { return false; }
  name() { return String(this.flags.name || '').split('').map(c => NOTES['urdl'.indexOf(c)]).filter(Boolean); }
  stageKey() {
    if (this.stage === 'egg' || this.stage === 'chick') return this.stage;
    if (this.stage === 'adult') return this.flags.laid ? 'parent' : 'adult';
    return this.stats.lessons >= 2 ? 'young' : 'fledge';
  }
  /* Read to Play wraps this, so big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 5; Bus.emit('hint', key); }

  update(dt) {
    this.t += dt; this.hintClock -= dt; this.callCool -= dt; this.callT = Math.max(0, this.callT - dt); this.flapping = Math.max(0, this.flapping - dt);
    const inp = this.input;
    if (this.target && (inp.x || inp.y)) this.target = null;
    this.moving = false;
    if (inp.eggPressed && !['egg', 'echo', 'sleep'].includes(this.mode)) this.call();
    switch (this.mode) {
      case 'egg': this.updateEgg(dt); break;
      case 'nest': this.updateNest(dt); break;
      case 'perch': this.updatePerch(dt); break;
      case 'fly': this.updateFly(dt); break;
      case 'sleep': this.sleepT -= dt; if (this.sleepT <= 0) { this.mode = 'perch'; Bus.emit('woke', this); } break;
      case 'echo': this.updateEcho(dt); break;
      case 'crack': this.updateCrack(dt); break;
      case 'preen': this.updatePreen(dt); break;
    }
    this.grow();
    this.hidden = this.stage !== 'egg' && this.stage !== 'chick' && !!this.F.inLeaves(this.x, this.y);
    inp.actionPressed = false; inp.eggPressed = false;
  }
  goTo(x, y) { if (this.mode === 'perch' || this.mode === 'fly') this.target = { x, y }; }
  runBusy(dt) { if (this.busy <= 0) return false; this.busy -= dt; if (this.busy <= 0) { const f = this.busyDone; this.busyDone = null; this.busyKind = null; if (f) f(); } return true; }

  /* ---------- the egg ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    if (this.eggT > 3 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    const inp = this.input;
    if (this.flags.eggReady && (inp.x || inp.y || inp.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (inp.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    this.stage = 'chick'; this.mode = 'nest'; this.x = WORLD.eggX; this.y = WORLD.nestY;
    this.G.particles.sparkle(this.x, this.y - 6, 14, '#fff3c0', 20);
    Bus.emit('hatched', this);
  }

  /* ---------- in the hollow ---------- */
  nestBox() { const h = this.F.hollow(this.stage === 'chick' ? 'home' : this.flags.nest); return h ? { x0: h.inside[0] - 24, x1: h.inside[0] + 24, y: h.inside[1], h } : null; }
  updateNest(dt) {
    const inp = this.input, B = this.nestBox();
    if (this.runBusy(dt)) return;
    if (inp.actionPressed) { this.act(); if (this.mode !== 'nest') return; }
    if (Math.abs(inp.x) > .2 && !this.flags.laid) { this.x = clamp(this.x + inp.x * 34 * dt, B.x0, B.x1); this.face = sign(inp.x); this.walkPh += dt * 9; this.moving = true; }
    this.y = B.y;
    if (inp.y < -.5) {
      if (this.stage === 'chick' && this.instar < 3) return this.say('toosmall');
      if (this.flags.laid && !this.flags.genDone) return this.say('stayeggs');
      this.flags.inNest = false; this.mode = 'perch'; this.setOn(B.h.line, B.h.s); this.face = 1;
      if (this.stage === 'chick' && !this.flags.atDoor) { this.flags.atDoor = true; Bus.emit('atDoor', this); }
    }
  }
  grow() {
    if (this.stage !== 'chick' || this.instar >= 3 || this.food < this.need) return;
    this.food -= this.need; this.instar++;
    this.G.particles.sparkle(this.x, this.y - 8, 18, '#ffd24a', 26);
    Bus.emit('grew', this, this.instar);
  }

  /* ---------- sitting ---------- */
  setOn(line, s) { this.line = line; this.s = clamp(s, 0, line.len); const q = line.at(this.s); this.x = q.x; this.y = q.y; return q; }
  land(line, s) {
    this.mode = 'perch'; this.setOn(line, s); this.vx = this.vy = 0; this.stats.lands++; this.target = null; this.auto = null;
    this.G.particles.dust && this.G.particles.dust(this.x, this.y, '#d8c9a0', 3);
    if (this.flags.firstFlight) { this.flags.firstFlight = false; Bus.emit('firstLanding', this, line); }
    Bus.emit('landed', this, line);
  }
  takeOff(vy = -90) {
    if (this.stage === 'chick') {
      if (!this.flags.strong) return this.say('flapfirst');
      if (!this.flags.fledged) { this.flags.fledged = true; return this.milestone('fledge', () => { this.stage = 'young'; this.flags.firstFlight = true; this.lift(vy); Bus.emit('fledged', this); }); }
    }
    this.lift(vy);
  }
  lift(vy) { this.mode = 'fly'; this.airT = 0; this.line = null; this.y -= this.r; this.vy = vy; this.vx = this.face * 40; this.stats.flights++; this.flapping = .5; Bus.emit('tookOff', this); }
  updatePerch(dt) {
    const inp = this.input, L = this.line;
    if (!L) { this.mode = 'fly'; return; }
    if (this.runBusy(dt)) return;
    if (this.auto) { this.takeOff(-120); return; }
    if (inp.actionPressed) { this.act(); if (this.mode !== 'perch' || this.busy > 0) return; }
    let ix = inp.x, iy = inp.y;
    if (this.target) {
      const q = L.nearest(this.target.x, this.target.y);
      if (q.d < 16) { if (Math.abs(q.s - this.s) < 3) this.target = null; else ix = sign(q.s - this.s) * sign(L.at(this.s).tx || 1); }
      else iy = -1;
    }
    if (iy < -.5) { this.takeOff(-90); return; }
    if (iy > .6 && this.stage !== 'chick' && L.kind === 'branch') { this.lift(40); return; }
    if (Math.abs(ix) > .2) {
      const q = L.at(this.s), dir = sign(ix) * sign(q.tx || 1), s0 = this.s;
      this.setOn(L, this.s + dir * 46 * dt); this.face = sign(ix);
      if (this.s !== s0) { this.walkPh += dt * 10; this.moving = true; }
    }
  }

  /* ---------- flying ---------- */
  updateFly(dt) {
    const inp = this.input, F = this.F, sp = this.flySpeed, first = this.flags.firstFlight;
    this.airT = (this.airT || 0) + dt;
    let ix = inp.x, iy = inp.y, wantLand = inp.y > .6;
    const tg = this.auto || this.target;
    if (tg) {
      const dx = tg.x - this.x, dy = (tg.y - 22) - this.y, d = Math.hypot(dx, dy);
      if (this.auto) { this.auto.t -= dt; if (this.auto.t <= 0 || d < 30) this.auto = null; }
      if (d < 26) { if (!this.auto) { wantLand = true; iy = 1; ix = 0; } } else { ix = clamp(dx / 60, -1, 1); iy = clamp(dy / 60, -1, .5); }
    }
    const up = iy < -.3;
    if (inp.actionPressed) { this.vy -= first ? 40 : 80; this.flapping = .35; Bus.emit('flapped', this); }
    if (up) this.flapping = .2;
    const vyT = up ? -sp * (first ? .32 : .75) * -iy : iy > .3 ? sp * .8 * iy : (first ? 44 : 22) + (first ? Math.sin(this.t * 5) * 30 : 0);
    this.vx += (ix * sp - this.vx) * Math.min(1, dt * 3); this.vy += (vyT - this.vy) * Math.min(1, dt * 3.5);
    this.x = clamp(this.x + this.vx * dt, WORLD.left + 20, WORLD.right - 20); this.y = Math.max(WORLD.top + 40, this.y + this.vy * dt);
    if (Math.abs(this.vx) > 8) this.face = sign(this.vx);
    this.flapPh += dt * (this.flapping > 0 || first ? 17 : 6); this.stats.far += Math.hypot(this.vx, this.vy) * dt; this.moving = true;
    /* the ground, the cliff, the river */
    const gy = groundY(this.x) - this.r;
    if (this.y >= gy) {
      if (overWater(this.x)) { this.y = gy - 2; this.vy = -150; this.stats.splashes++; this.target = null; Bus.emit('splash', this); return; }
      const g = F.locate(this.x, this.y + this.r, this.r + 10);
      if (g && g.line.kind === 'ground') return this.land(g.line, g.s);
      this.y = gy;
    }
    /* down by a branch lands on it (not in the first moments of a flight: you have only just left one) */
    if (wantLand && this.vy > -30 && this.airT > .5) { const q = F.locate(this.x, this.y + this.r * .6, 22); if (q) this.land(q.line, q.s); }
  }

  /* ---------- your call ---------- */
  call() {
    if (this.callCool > 0 || this.stage === 'egg') return;
    this.callCool = .9; this.callT = .8; this.stats.calls++;
    const F = this.F, v = F.visitor;
    F.ring(this.x, this.y - this.r, 'me', this.name());
    if (v && v.kind === 'toucan' && v.state !== 'leave') v.shooed = true;
    Bus.emit('called', this);
    if (this.stage !== 'chick' || this.flags.named) F.answer();
  }
  isSafe(v) {
    if (v.kind === 'toucan') return !!v.shooed;
    if (v.need === 'air') return this.mode === 'fly' && this.y < groundY(this.x) - 60;
    return !!this.F.inLeaves(this.x, this.y);
  }
  safeHow(v) { return v.kind === 'toucan' ? 'call' : v.need; }
  /* too slow: you are startled, and off you go anyway */
  flee(v) {
    if (v.kind !== 'eagle' || !['perch', 'fly'].includes(this.mode)) return;
    if (v.need === 'air') this.auto = { x: this.x - v.side * 160, y: this.y - 190, t: 2.2 };
    else { const c = this.F.nearestCrown(this.x, this.y); this.auto = { x: c.crown[0], y: c.crown[1] + 22, t: 6 }; }
  }
  startSleep() { if (this.mode !== 'perch') return; this.mode = 'sleep'; this.sleepT = 3; this.target = null; Bus.emit('sleeping', this); }
}
