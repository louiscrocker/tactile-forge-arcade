/* ============================================================
   player.js — you, the ocean sunfish, from egg to the warm sea
   ============================================================
   stage  egg       one of millions drifting in the warm open ocean:
                    wiggle to hatch
          larva     zinstar 1  a see-through hatchling in the plankton
                    zinstar 2–3 a spiky star (E: spikes out and dash)
          juvenile  jsize 1–2  spikes fading, the clavus growing: swim
                    with your school near the top, eat krill and salps
          mola      size 1–3   a real sunfish: dive deep for jellies
                    (Space to slurp), the warm meter drops in the
                    cold; bask flat in the sun to warm up (gulls peck
                    the sea lice off); itchy → the kelp cleaning
                    station; breach (E at the top) to shake lice off;
                    then the journey to the warm sea: the boy lets a
                    little cloud go by a girl, the girl lets her eggs go
          modes     swim · bask · clean · breach · chilly (floating up
                    to warm) · net (lifted out and let go) · release
   Nothing hurts the sunfish, ever: a visitor misses and you tumble;
   too cold means you float up to the sun; the net is lifted and
   you are let go.
   ============================================================ */
'use strict';

const BASK_FULL = 6, CLEAN_T = 6, GROW_T = 1.4;

class Sunfish {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'normal';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.eggX; this.y = 40; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0; this.roll = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.phase = 0; this.flap = 0;
    this.food = 0; this.zinstar = 1; this.jsize = 1; this.size = 1; this.growing = 0; this.growNext = null;
    this.warm = 1; this.itch = 0; this.baskT = 0; this.cleanT = 0; this.relT = 0; this.rel = null;
    this.tumble = 0; this.spin = 0; this.dashCool = 0; this.dashT = 0; this.eatAnim = 0; this.dark = 0; this.coldSaid = false;
    this.moving = false; this.inSchool = false; this.hintClock = 0; this.target = null; this.netFrom = 0; this.homeHint = null;
    this.stats = { plankton: 0, glow: 0, dashes: 0, krill: 0, salplets: 0, jellies: 0, moon: 0, comb: 0, nettle: 0, salp: 0, dives: 0, deepest: 0, basks: 0, pecks: 0, cleans: 0, breaches: 0, dodges: 0, tumbles: 0, flaps: 0, netted: 0, boats: 0, eggsOut: 0, blows: 0, clouds: 0, schoolT: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get swimming() { return this.stage !== 'egg'; }
  get cm() { return molaCM(this); }
  /* the drawn body length (nose to clavus), world units */
  get len() { return molaUnits(this.cm); }
  /* collision radius: the round body */
  get r() { return this.stage === 'egg' ? 1.2 : this.len * (this.stage === 'mola' ? .4 : .5); }
  get underground() { return false; }
  stageKey() {
    if (this.stage === 'egg') return 'egg';
    if (this.stage === 'larva') return this.zinstar === 1 ? 'larva' : 'star';
    if (this.stage === 'juvenile') return 'juvenile';
    if (this.flags.journey) return 'spawn';
    return this.size >= 3 ? 'giant' : 'mola';
  }
  /* the food needed for the next step, and the food that step started from */
  steps() { const D = this.D; return this.stage === 'larva' ? [0, ...D.larva] : this.stage === 'juvenile' ? [0, ...D.juv] : [0, ...D.grow]; }
  get stepI() { return this.stage === 'larva' ? this.zinstar : this.stage === 'juvenile' ? this.jsize : this.size; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }
  /* where the mouth is (the front of the body) */
  mouth() { return { x: this.x + this.face * this.len * .42, y: this.y + this.len * .04 }; }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.dashCool -= dt; this.dashT = Math.max(0, this.dashT - dt); this.eatAnim = Math.max(0, this.eatAnim - dt * 3);
    this.dark = Math.max(0, this.dark - dt * .4);
    if (this.target) this.steerToTarget();
    if (this.stage === 'egg') this.updateEgg(dt); else this.updateSwim(dt);
    this.input.actionPressed = false; this.input.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (d < Math.max(5, this.r * 1.2)) { this.target = null; return; }
    this.input.x = dx / d; this.input.y = dy / d;
  }
  goTo(x, y) { if (this.stage === 'egg' || this.mode !== 'swim') return; this.target = { x, y }; }

  /* ---------- the egg: drifting near the top of the warm sea ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    this.y = 40 + Math.sin(this.eggT * .8) * 3; this.x = WORLD.eggX + Math.sin(this.eggT * .3) * 4;
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    this.stage = 'larva'; this.mode = 'swim'; this.zinstar = 1; this.food = 0;
    this.vx = 6; this.vy = -6; this.face = 1;
    this.W.babyBurst(this.x, this.y, 50);
    Bus.emit('hatched', this);
  }
  startTumble(vx, vy) { this.tumble = 1; this.vx += vx; this.vy += vy; this.stats.tumbles++; AudioFX.whoosh && AudioFX.whoosh(); }
  /* a visitor lunges: it always misses.  A dash just now (or being in your school) means it never got close */
  struck(v) {
    if (this.mode !== 'swim') return 'dodged';
    if (this.dashT > 0 || this.inSchool) { this.stats.dodges++; return 'dodged'; }
    this.startTumble(v.dir * 70, -30); this.dark = 1;
    return 'tumble';
  }

  /* ============================================================
     SWIMMING: every stage after the egg
     ============================================================ */
  updateSwim(dt) {
    const W = this.W, inp = this.input, st = this.stage;
    this.flap += dt * (this.moving ? 7 : 3) * (st === 'mola' ? .7 : 1);
    if (this.growing > 0) { this.growing -= dt; this.drift(dt, .5); if (this.growing <= 0) this.finishGrowth(); return; }
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 12; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    switch (this.mode) {
      case 'bask': return this.updateBask(dt);
      case 'clean': return this.updateClean(dt);
      case 'breach': return this.updateBreach(dt);
      case 'chilly': return this.updateChilly(dt);
      case 'net': return this.updateNet(dt);
      case 'release': return this.updateRelease(dt);
    }
    if (inp.actionPressed) this.act();
    const lvl = W.seaLevel();
    /* E: a dash (spikes out, for a star; a big flap of the fins, for a sunfish; at the top, a jump!) */
    if (inp.eggPressed && this.dashCool <= 0) {
      if (st === 'mola' && this.y < lvl + this.len * .7) return this.startBreach();   /* at the top, the button says JUMP: it jumps (no second finger needed on a touch pad) */
      const m = Math.hypot(inp.x, inp.y), dx = m > .1 ? inp.x / m : this.face, dy = m > .1 ? inp.y / m : 0;
      const k = st === 'larva' ? 60 : st === 'juvenile' ? 110 : 120;
      this.vx += dx * k; this.vy += dy * k; this.dashCool = st === 'mola' ? 1.1 : .9; this.dashT = 1.2;
      this.stats.dashes++; if (st === 'mola') this.stats.flaps++;
      this.G.particles.bubbles(this.x - dx * this.r * 1.5, this.y - dy * this.r * 1.5, st === 'mola' ? 10 : 5, st === 'mola' ? 2.5 : 1);
      AudioFX.dash && AudioFX.dash(); Bus.emit(st === 'larva' && this.zinstar >= 2 ? 'spikes' : 'dash', this);
    }
    const accel = st === 'larva' ? 90 + this.zinstar * 12 : st === 'juvenile' ? 150 : 110;
    const maxSp = st === 'larva' ? 13 + this.zinstar * 4 : st === 'juvenile' ? 40 + this.jsize * 8 : 52 + this.size * 9;
    this.vx += inp.x * accel * dt; this.vy += inp.y * accel * dt;
    if (st === 'larva') this.vy += 3 * dt;
    this.vx *= Math.exp(-dt * 2.2); this.vy *= Math.exp(-dt * 2.2);
    const sp = Math.hypot(this.vx, this.vy), cap = maxSp * (this.dashT > .6 ? 2.3 : 1);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.drift(dt, st === 'mola' ? .3 : 1);
    if (Math.abs(inp.x) > .2) this.face = sign(inp.x);
    this.moving = Math.hypot(inp.x, inp.y) > .1;
    this.ang += (clamp(this.vy / (maxSp * 1.6), -.55, .55) * this.face - this.ang) * (1 - Math.exp(-dt * 4));
    this.roll += (0 - this.roll) * (1 - Math.exp(-dt * 3));
    if (st === 'larva') this.eatPlankton();
    else if (st === 'juvenile') { this.eatBumped(); if (this.inSchool) this.stats.schoolT += dt; }
    this.bumps();
    if (st === 'mola') this.meters(dt);
    this.checkGrowth();
    this.stats.deepest = Math.max(this.stats.deepest, DEPTH_M(this.y));
    if (st === 'mola' && this.y > 300 && !this.flags.inDive) { this.flags.inDive = true; this.stats.dives++; Bus.emit('dived', this); }
    if (this.y < 120) this.flags.inDive = false;
  }
  /* eat any plankton you bump into; dinoflagellates only glow */
  eatPlankton() {
    const W = this.W, R = this.r + 1;
    for (const q of W.plankton) {
      if (q.eaten) continue;
      const d = Math.hypot(q.x - this.x, q.y - this.y);
      if (q.kind === 'dino') { if (d < R + 6) { if (q.glow < .3 && nightAmount(this.G.tod) > .4) { this.stats.glow++; this.G.particles.sparkle(q.x, q.y, 6, '#8ee8ff', 4); Bus.emit('glow', this); } q.glow = 1; } continue; }
      if (d < R + PLANKTON_KINDS[q.kind].r + 1.2) {
        q.eaten = true; this.food += PLANKTON_KINDS[q.kind].val; this.stats.plankton++;
        this.G.particles.puff(q.x, q.y, q.kind === 'krill' ? '#ffc8c0' : '#f0e0c0', 3, .6);
        AudioFX.blip && AudioFX.blip(1);
        Bus.emit('ate', this, q);
      }
    }
  }
  /* a young sunfish gulps krill and little salps it swims into */
  eatBumped() {
    const m = this.mouth();
    for (const f of this.W.food) {
      if (f.eaten || FOOD_KINDS[f.kind].who !== 'juvenile') continue;
      if (Math.hypot(f.x - m.x, f.y - m.y) < f.r + this.r * .8) this.eat(f);
    }
  }
  eat(f) {
    f.eaten = true; this.food += f.val; this.eatAnim = 1;
    if (f.kind === 'krill') this.stats.krill++; else if (f.kind === 'salplet') this.stats.salplets++;
    else { this.stats.jellies++; this.stats[f.kind] = (this.stats[f.kind] || 0) + 1; }
    this.G.particles.puff(f.x, f.y, f.kind === 'nettle' ? '#ffd890' : '#e0f0ff', 5, 1);
    AudioFX.munch && AudioFX.munch();
    Bus.emit(FOOD_KINDS[f.kind].who === 'mola' ? 'ateJelly' : 'ateKrill', this, f);
  }
  /* the anchovies and comb jellies bump a baby about */
  bumps() {
    const W = this.W, R = this.r;
    if (this.stage !== 'larva') return;
    const sc = W.school;
    if (sc && !sc.hitDone) for (const f of sc.fish) {
      const fx = sc.x + f.dx, fy = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6;
      if (Math.hypot(fx - this.x, fy - this.y) < 8 * f.s + R) { sc.hitDone = true; if (this.dashT > 0) { this.stats.dodges++; Bus.emit('dodged', this); } else { this.startTumble(sc.dir * 50, -16); Bus.emit('missed', this); } break; }
    }
    for (const j of W.combs) { if (!j.hitDone && Math.hypot(j.x - this.x, j.y - this.y) < j.r + R + 2) { j.hitDone = true; this.startTumble(sign(this.x - j.x) * 40, -20); Bus.emit('combJelly', this); } }
  }
  /* the warm meter (cold in the deep, warm at the top) and the itch of sea lice */
  meters(dt) {
    const lvl = this.W.seaLevel(), y = this.y - lvl, D = this.D;
    if (y < 70) this.warm = Math.min(1, this.warm + .03 * dt);
    else if (y > 120) this.warm -= dt * .022 * D.cold * clamp((y - 120) / 350, .3, 1.4);
    if (this.warm < .35 && !this.coldSaid) { this.coldSaid = true; Bus.emit('cold', this); }
    if (this.warm > .6) this.coldSaid = false;
    if (this.warm <= 0) { this.warm = 0; this.mode = 'chilly'; this.target = null; Bus.emit('chilly', this); }
    this.itch = Math.min(1, this.itch + dt * .0055 * D.itch * (this.size === 1 ? .6 : 1));
    if (this.itch > .6 && !this.flags.itchSaid) { this.flags.itchSaid = true; Bus.emit('itchy', this); }
    if (this.itch < .3) this.flags.itchSaid = false;
  }

  /* ============================================================
     GROWING: each step needs its food; the big ones wait for a page in Read to Play
     ============================================================ */
  checkGrowth() {
    if (this.growing > 0 || this.flags.waitGrow || this.mode !== 'swim') return;
    const th = this.steps(), i = this.stepI, need = th[i];
    if (this.stage === 'mola' && i >= 3) { if (this.food >= need) { this.food = need; if (!this.flags.ready) { this.flags.ready = true; Bus.emit('ready', this); } } return; }
    if (this.food < need) return;
    this.food = need;
    if (this.stage === 'larva') { if (i === 1) return this.gate('star', () => this.startGrow()); if (i === 2) return this.startGrow(); return this.gate('juvenile', () => this.startGrow('juvenile')); }
    if (this.stage === 'juvenile') { if (i === 1) return this.startGrow(); return this.gate('mola', () => this.startGrow('mola')); }
    if (i === 1) { if (!this.flags.basked) { if (!this.flags.baskFirst) { this.flags.baskFirst = true; Bus.emit('needBask', this); } return; } return this.startGrow(); }
    if (!this.flags.cleaned) { if (!this.flags.fullSaid) { this.flags.fullSaid = true; Bus.emit('fullItchy', this); } return; }
    return this.gate('giant', () => this.startGrow());
  }
  gate(key, fn) { this.flags.waitGrow = true; this.milestone(key, () => { this.flags.waitGrow = false; fn(); }); }
  startGrow(next) { this.growing = GROW_T; this.growNext = next || null; Bus.emit('growing', this); }
  finishGrowth() {
    const n = this.growNext; this.growNext = null;
    if (n === 'juvenile') { this.stage = 'juvenile'; this.jsize = 1; this.food = 0; Bus.emit('juvenile', this); return; }
    if (n === 'mola') { this.stage = 'mola'; this.size = 1; this.food = 0; this.warm = 1; this.itch = .05; Bus.emit('mola', this); return; }
    if (this.stage === 'larva') this.zinstar++; else if (this.stage === 'juvenile') this.jsize++; else this.size++;
    Bus.emit('grew', this, this.stageKey());
  }

  /* ============================================================
     THE GROWN-UP'S MOMENTS
     ============================================================ */
  startBask() { this.mode = 'bask'; this.baskT = 0; this.flags.warmSaid = false; this.target = null; this.stats.basks++; Bus.emit('basking', this); }
  updateBask(dt) {
    const lvl = this.W.seaLevel(), inp = this.input;
    this.baskT += dt; this.roll += (1 - this.roll) * (1 - Math.exp(-dt * 2));
    this.y += (lvl + this.len * .1 - this.y) * (1 - Math.exp(-dt * 2)); this.vx *= Math.exp(-dt * 2); this.vy = 0;
    this.drift(dt, .3); this.ang *= Math.exp(-dt * 3);
    this.warm = Math.min(1, this.warm + dt / BASK_FULL);
    if (this.warm >= 1 && !this.flags.warmSaid) { this.flags.warmSaid = true; this.flags.basked = true; Bus.emit('warmed', this); }
    if (this.baskT > 1.2 && (Math.hypot(inp.x, inp.y) > .3 || inp.actionPressed || inp.eggPressed)) { this.mode = 'swim'; if (this.warm > .8) this.flags.basked = true; Bus.emit('baskEnd', this); }
  }
  /* where a gull stands on a basking sunfish (its upper side, out of the water) */
  gullSpot() { return { x: this.x - this.face * this.len * .05, y: this.W.seaLevel() - 2 }; }
  peckLice() { this.itch = Math.max(0, this.itch - .08); this.stats.pecks++; this.G.particles.puff(this.x, this.W.seaLevel(), '#f0e8d0', 3, .6); }
  startClean() { this.mode = 'clean'; this.cleanT = 0; this.itch0 = this.itch; this.target = null; Bus.emit('cleaning', this); }
  updateClean(dt) {
    const Stn = this.W.station; this.cleanT += dt;
    const tx = Stn.x, ty = Math.min(Stn.floor - this.len * .9, Stn.floor - 60);
    this.x += (tx - this.x) * (1 - Math.exp(-dt * 1.2)); this.y += (ty - this.y) * (1 - Math.exp(-dt * 1.2));
    this.vx = this.vy = 0; this.roll += (.45 - this.roll) * (1 - Math.exp(-dt * 2)); this.ang *= Math.exp(-dt * 2);
    this.itch = this.itch0 * (1 - clamp(this.cleanT / CLEAN_T, 0, 1));
    if (this.cleanT >= CLEAN_T) { this.itch = 0; this.flags.cleaned = true; this.stats.cleans++; this.mode = 'swim'; Bus.emit('cleaned', this); }
  }
  cleanSpot(k) { const a = k / 9 * TAU + this.t * .3; return { x: this.x + Math.cos(a) * this.len * .42, y: this.y + Math.sin(a) * this.len * .5 }; }
  startBreach() { this.mode = 'breach'; this.vy = -(150 + this.size * 30); this.vx = this.face * 70; this.stats.breaches++; this.target = null; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('breach', this); }
  updateBreach(dt) {
    const lvl = this.W.seaLevel();
    this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 330 * dt;
    this.ang = clamp(this.vy / 260, -1, 1) * this.face; this.roll = clamp((this.vy + 100) / 300, 0, .8);
    if (this.y > lvl && this.vy > 0) {
      this.mode = 'swim'; this.vy *= .3; this.itch = Math.max(0, this.itch - .6); this.flags.breached = true;
      this.G.particles.bubbles(this.x, lvl + 6, 24, 3); this.G.particles.splat && this.G.particles.splat(this.x, lvl, '#ffffff', 26);
      AudioFX.splash && AudioFX.splash(); Bus.emit('jumped', this);
    }
  }
  updateChilly(dt) {
    const lvl = this.W.seaLevel();
    this.vy += (-48 - this.vy) * (1 - Math.exp(-dt * 2)); this.vx *= Math.exp(-dt * 2);
    this.drift(dt, .3); this.ang += (-.4 * this.face - this.ang) * (1 - Math.exp(-dt * 2));
    if (this.y < lvl + 80) { this.mode = 'swim'; this.warm = Math.max(this.warm, .12); Bus.emit('upToWarm', this); }
  }
  netted(n) { this.mode = 'net'; this.netFrom = this.y; this.stats.netted++; this.target = null; this.vx = this.vy = 0; }
  updateNet(dt) { const n = this.W.net, lvl = this.W.seaLevel(); this.x += (n.x - this.x) * (1 - Math.exp(-dt * 3)); this.y = lerp(this.netFrom, lvl + this.len * .2, n.lift || 0); this.roll += (.6 - this.roll) * dt; }
  freeFromNet() { this.mode = 'swim'; this.y = this.W.seaLevel() + this.len * .6; this.vy = 30; this.roll = 0; this.flags.netFreed = true; }
  startRelease() { this.mode = 'release'; this.rel = { good: 0, cool: 0 }; this.target = null; Bus.emit('release', this); }
  releaseWindow() { return this.W.swash() > .75; }
  updateRelease(dt) {
    const R = this.rel, inp = this.input;
    R.cool -= dt; this.vx *= Math.exp(-dt * 2); this.vy *= Math.exp(-dt * 2); this.drift(dt, .2);
    if (inp.actionPressed) {
      if (this.releaseWindow() && R.cool <= 0) {
        R.good++; R.cool = .9; this.stats.blows++; this.stats.eggsOut = Math.round(3e8 * R.good / this.D.blows);
        this.W.babyBurst(this.x - this.face * this.len * .25, this.y + this.len * .2, 80); AudioFX.splash && AudioFX.splash();
        Bus.emit('eggsOut', this, R.good);
      } else Bus.emit('notYet', this);
    }
    if (R.good >= this.D.blows) { this.flags.released = true; this.mode = 'swim'; this.stats.eggsOut = 3e8; Bus.emit('eggsReleased', this); }
  }

  /* ---------- what Space means right now ---------- */
  context() {
    if (this.stage !== 'mola' || this.mode !== 'swim' || this.growing > 0 || this.tumble > 0) return null;
    const W = this.W, m = this.mouth();
    if (this.flags.arrived && !this.flags.met && W.mateNear(this.x, this.y, this.len * 1.8)) return 'meet';
    if (this.flags.met && this.sex === 'boy' && !this.flags.clouded) return 'cloud';
    if (this.flags.met && this.sex === 'girl' && !this.flags.released) return 'eggs';
    if (W.foodNear(m.x, m.y, this.len * .35 + 6)) return 'eat';
    if (W.stationNear(this.x, this.y, this.len) && (this.itch > .12 || !this.flags.cleaned)) return 'clean';
    if (this.y < W.seaLevel() + this.len * .5) return 'bask';
    return null;
  }
  act() {
    const W = this.W, m = this.mouth();
    switch (this.context()) {
      case 'eat': { const f = W.foodNear(m.x, m.y, this.len * .35 + 6); if (f) this.eat(f); break; }
      case 'bask': this.startBask(); break;
      case 'clean': this.startClean(); break;
      case 'meet': { const o = W.mateNear(this.x, this.y, this.len * 1.8); if (o) { o.met = true; o.with = true; this.flags.met = true; Bus.emit('met', this, o); } break; }
      case 'cloud': this.flags.clouded = true; this.stats.clouds++; this.G.particles.puff(this.x - this.face * this.len * .3, this.y + this.len * .2, 'rgba(240,240,230,.8)', 14, 3); Bus.emit('cloud', this); break;
      case 'eggs': this.startRelease(); break;
    }
  }

  /* the sea carries you along */
  drift(dt, k) {
    const [cx, cy] = this.W.current(this.x, this.y);
    this.x += (this.vx + cx * k) * dt; this.y += (this.vy + cy * k) * dt;
    this.bounds();
  }
  bounds() {
    const W = this.W, S = this.S, R = this.r;
    const top = W.seaLevel() + (this.stage === 'mola' ? this.len * .08 : R + 1);
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    if (this.y > WORLD.maxDepth) { this.y = WORLD.maxDepth; this.vy = Math.min(0, this.vy); }
    if (this.x < WORLD.left + 120) { this.x = WORLD.left + 120; this.vx = Math.abs(this.vx); }
    if (this.x > WORLD.beachX - 200) { this.x = WORLD.beachX - 200; this.vx = Math.min(0, this.vx); }
    for (let k = 0; k < 6 && S.solidAt(this.x, this.y + R); k++) { this.y -= 3; this.vy = Math.min(0, this.vy); }
    if (S.solidAt(this.x + sign(this.vx) * R, this.y)) { this.x -= sign(this.vx) * 3; this.vx *= -.3; }
  }

  serialize() {
    const n = (v) => +(+v).toFixed(2);
    return { form: this.form, sex: this.sex, stage: this.stage, mode: this.mode, x: n(this.x), y: n(this.y), face: this.face, food: n(this.food), zinstar: this.zinstar, jsize: this.jsize, size: this.size, warm: n(this.warm), itch: n(this.itch), stats: this.stats, flags: this.flags };
  }
  restore(o) {
    if (!o || typeof o !== 'object') throw new Error('no player');
    if (!['egg', 'larva', 'juvenile', 'mola'].includes(o.stage)) throw new Error('bad stage');
    for (const k of ['x', 'y', 'food', 'warm', 'itch']) if (!Number.isFinite(o[k])) throw new Error('bad ' + k);
    this.stage = o.stage; this.mode = o.stage === 'egg' ? 'egg' : 'swim';
    this.x = clamp(o.x, WORLD.left + 120, WORLD.beachX - 200); this.y = clamp(o.y, 0, WORLD.maxDepth);
    this.face = o.face === -1 ? -1 : 1; this.food = Math.max(0, o.food);
    this.zinstar = clamp(o.zinstar | 0, 1, 3); this.jsize = clamp(o.jsize | 0, 1, 2); this.size = clamp(o.size | 0, 1, 3);
    this.warm = clamp(o.warm, .1, 1); this.itch = clamp(o.itch, 0, 1);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) if (typeof o.flags[k] === 'boolean') this.flags[k] = o.flags[k];
    this.flags.waitGrow = false; this.flags.hatching = this.stage !== 'egg';
  }
}
