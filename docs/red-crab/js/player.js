/* ============================================================
   player.js — you, the red crab, from egg to the great march
   ============================================================
   stage  egg       one of thousands under your mum at the sea's
                    edge: when a wave comes, wiggle into the sea
          zoea      a see-through larva in the open ocean (mode
                    swim): eat plankton, moult twice (zoea II,
                    zoea III), then once more into…
          megalopa  half crab, half shrimp: swim back to the island
                    (mode swim, or ride on a jellyfish), crawl out
          crab      instar 1  a baby crab: march up the shore and
                              the cliff, keep your gills damp
                    instar 2–3 a young crab in the forest: eat, dig
                              a burrow, shut the door and moult
                    instar 4  an adult: wait for the first rains,
                              march to the sea, dip, then
                              boys: dig a burrow, push rivals away
                              girls: find a boy's burrow, brood the
                              eggs, shake them into the waves
          modes on land: walk · burrow · moult · harden · shove ·
                    tossed · rest (too dry) · brood · release
   Nothing hurts the crab, ever: a fish or a bird misses and you
   tumble; drying out means a rest in the shade until evening;
   losing a push means a roll in the sand and another go.
   ============================================================ */
'use strict';

const MOLT_T = 2.6, HARDEN_T = 8, BROOD_T = 22, REST_T = 2.4;

class Crab {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'red';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.eggX; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.phase = 0;
    this.food = 0; this.zinstar = 1; this.tight = 0; this.molting = 0;
    this.cfood = 0; this.instar = 1; this.full = false;
    this.water = 1; this.hardT = HARDEN_T; this.pale = 0; this.cm = .5;
    this.walk = 0; this.moving = false; this.up = 0; this.upT = 0; this.pinch = 0; this.eatAnim = 0; this.spin = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.burrow = null; this.ride = null; this.wr = null; this.rel = null; this.tumble = 0;
    this.dashCool = 0; this.restT = 0; this.broodT = 0; this.eggs = 0; this.shade = 'sun';
    this.hintClock = 0; this.digClock = 0; this.hungryT = 0; this.foodHint = null; this.sniffClock = 0; this.target = null;
    this.stats = { plankton: 0, copepods: 0, glow: 0, molts: 0, rides: 0, dashes: 0, food: 0, leaves: 0, flowers: 0, fruits: 0, seedlings: 0, dug: 0, burrows: 0, wins: 0, losses: 0, dips: 0, shakes: 0, eggsOut: 0, march: 0, shelters: 0, tumbles: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get swimming() { return this.stage === 'zoea' || this.stage === 'megalopa'; }
  /* the drawn width of a crab, and how far its middle sits above its toes */
  get w() { return crabUnits(this.cm); }
  get feet() { return this.w * .42; }
  /* collision radius */
  get r() {
    if (this.stage === 'egg') return 1.2;
    if (this.stage === 'zoea') { const th = [0, ...this.D.zoea], i = this.zinstar, t = clamp((this.food - th[i - 1]) / (th[i] - th[i - 1]), 0, 1); return [0, lerp(1.6, 2.2, t), lerp(2.4, 3.0, t), lerp(3.2, 3.8, t)][i]; }
    if (this.stage === 'megalopa') return 4.6;
    return this.w * .42;
  }
  get underground() { return this.stage === 'crab' && ['burrow', 'moult', 'harden', 'brood'].includes(this.mode) && this.y > this.S.surfaceAt(this.x) - 2; }
  get depth() { return this.y - this.S.surfaceAt(this.x); }
  stageKey() {
    if (this.stage === 'egg') return 'egg';
    if (this.stage === 'zoea') return 'zoea';
    if (this.stage === 'megalopa') return 'megalopa';
    if (this.instar <= 1) return 'baby';
    if (this.instar <= 3) return 'young';
    return this.flags.migrating ? 'march' : 'adult';
  }
  /* the threshold for the next moult on land */
  get crabTh() { return this.instar < 4 ? this.D.crab[this.instar - 1] : this.D.crab[2] * BONUS; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.dashCool -= dt;
    const inp = this.input;
    /* tap-to-go steers by writing the input; real input cancels it (see readInput in main.js) */
    if (this.target) this.steerToTarget();
    switch (this.stage) {
      case 'egg': this.updateEgg(dt); break;
      case 'zoea': case 'megalopa': this.updateSwim(dt); break;
      case 'crab': this.updateCrab(dt); break;
    }
    inp.actionPressed = false; inp.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (this.stage === 'crab' && this.mode === 'walk') {
      if (Math.abs(dx) < Math.max(4, this.w * .3)) { this.target = null; return; }
      this.input.x = sign(dx); this.input.y = 0;
    } else { if (d < Math.max(4, this.r * 2)) { this.target = null; return; } this.input.x = dx / d; this.input.y = dy / d; }
  }
  goTo(x, y) { if (this.stage === 'egg' || ['moult', 'harden', 'brood', 'release', 'shove', 'rest'].includes(this.mode)) return; this.target = { x, y }; }

  /* ---------- the egg ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    const m = this.W.mum;
    if (m) { this.x = m.x + 4; this.y = m.y + m.feet * .62; }
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    const W = this.W;
    this.stage = 'zoea'; this.mode = 'swim'; this.zinstar = 1; this.food = 0;
    this.x = Math.min(W.waterEdge() - 16, -20); this.y = W.seaLevel() + 10; this.vx = -24; this.vy = 6; this.face = -1;
    W.eggBurst(this.x + 10, this.y - 4, 90);
    W.drift = -1;
    Bus.emit('hatched', this);
  }

  /* ============================================================
     IN THE SEA
     ============================================================ */
  updateSwim(dt) {
    const W = this.W, inp = this.input, zoea = this.stage === 'zoea';
    if (this.molting > 0) { this.molting -= dt; this.drift(dt, .6); if (this.molting <= 0) this.finishSeaMolt(); return; }
    if (this.mode === 'ride') return this.updateRide(dt);
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 14; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    if (inp.actionPressed) this.act();
    /* E: flick the tail for a dash */
    if (inp.eggPressed && this.dashCool <= 0) {
      const m = Math.hypot(inp.x, inp.y), dx = m > .1 ? inp.x / m : this.face, dy = m > .1 ? inp.y / m : 0;
      this.vx += dx * (zoea ? 80 : 110); this.vy += dy * (zoea ? 80 : 110); this.dashCool = .9; this.stats.dashes++;
      this.G.particles.bubbles(this.x - dx * this.r * 2, this.y - dy * this.r * 2, 5);
      AudioFX.dash && AudioFX.dash(); Bus.emit('dash', this);
    }
    const accel = zoea ? 120 + this.zinstar * 14 : 190, maxSp = zoea ? 20 + this.zinstar * 4 : 46;
    this.vx += inp.x * accel * dt; this.vy += inp.y * accel * dt;
    this.vy += (zoea ? 5 : 2) * dt;                        /* a larva slowly sinks if it stops swimming */
    this.vx *= Math.exp(-dt * 2.4); this.vy *= Math.exp(-dt * 2.4);
    const sp = Math.hypot(this.vx, this.vy), cap = maxSp * (this.dashCool > .5 ? 2.4 : 1);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.drift(dt, 1);
    if (Math.abs(inp.x) > .2) this.face = sign(inp.x);
    this.moving = Math.hypot(inp.x, inp.y) > .1;
    this.ang = clamp(this.vy / 60, -.6, .6) * (this.face > 0 ? 1 : -1);
    /* eat any plankton you bump into */
    const R = this.r;
    for (const q of W.plankton) {
      if (q.eaten) continue;
      const d = Math.hypot(q.x - this.x, q.y - this.y);
      if (d < R + PLANKTON_KINDS[q.kind].r + 1.4) {
        q.eaten = true; this.food += PLANKTON_KINDS[q.kind].val; this.stats.plankton++;
        if (q.kind === 'copepod') { this.stats.copepods++; Bus.emit('ateCopepod', this); }
        if (q.kind === 'dino' && nightAmount(this.G.tod) > .4) { this.stats.glow++; this.G.particles.sparkle(q.x, q.y, 10, '#8ee8ff', 5); Bus.emit('glow', this); }
        else this.G.particles.puff(q.x, q.y, q.kind === 'copepod' ? '#ffd0a0' : '#c8f0a0', 3, .6);
        AudioFX.blip && AudioFX.blip(q.kind === 'copepod' ? 1.4 : 1);
        Bus.emit('ate', this, q);
      } else if (q.kind === 'dino' && d < R + 6) q.glow = 1;   /* bumped: it flashes blue */
    }
    /* the big animals: never harmful, but they knock you about */
    const sc = W.school;
    if (sc && !sc.hitDone) for (const f of sc.fish) {
      const fx = sc.x + f.dx, fy = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6;
      if (Math.hypot(fx + sc.dir * 14 - this.x, fy - this.y) < 10 * f.s + R) { sc.hitDone = true; this.startTumble(sc.dir * 70, -20); break; }
    }
    const mouth = W.whaleMouth();
    if (mouth) {
      const dx = mouth.x - this.x, dy = mouth.y - this.y, d = Math.hypot(dx, dy);
      if (d < 420) { const pull = (1 - d / 420) * 95; this.vx += dx / d * pull * dt; this.vy += dy / d * pull * dt; }
      if (d < 60 && !W.whale.hitDone) { W.whale.hitDone = true; this.startTumble(W.whale.dir * 90, -70); this.x = mouth.x + W.whale.dir * 40; this.y = mouth.y - 130; Bus.emit('whaleWhoosh', this); }
    }
    this.bounds();
    if (zoea) this.zoeaGrowth(dt);
    else {
      /* the megalopa: home is the island */
      this.homeHint = { x: -10, y: Math.max(W.seaLevel() + 10, 30) };
      if (this.x > -230 && !this.flags.surf) { this.flags.surf = true; Bus.emit('surf', this); }
      if (this.x > -14 && this.y < W.seaLevel() + 18 && !this.flags.ashoreGate) { this.flags.ashoreGate = true; this.milestone('ashore', () => this.becomeCrab()); }
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
    const top = W.seaLevel() + R + 1;
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    if (this.y > 660) { this.y = 660; this.vy = Math.min(0, this.vy); }
    if (this.x < WORLD.left + 80) { this.x = WORLD.left + 80; this.vx = Math.abs(this.vx); }
    const maxX = this.stage === 'zoea' ? -50 : 4;
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    /* the reef and the sea floor push you back up */
    for (let k = 0; k < 4 && S.solidAt(this.x, this.y + R); k++) { this.y -= 2; this.vy = Math.min(0, this.vy); }
    if (S.solidAt(this.x + sign(this.vx) * R, this.y)) { this.x -= sign(this.vx) * 2; this.vx *= -.3; }
  }
  startTumble(vx, vy) { this.tumble = 1.1; this.vx = vx; this.vy = vy; this.stats.tumbles++; this.target = null; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('missed', this); }
  zoeaGrowth(dt) {
    const th = this.D.zoea[this.zinstar - 1];
    if (this.food < th) return;
    this.food = Math.max(this.food, th);
    this.tight += dt;
    if (this.tight > .2 && !this.flags['ztight' + this.zinstar]) { this.flags['ztight' + this.zinstar] = true; Bus.emit('tight', this); }
    if (this.tight > 1.6 && !this.flags['zm' + this.zinstar]) {
      this.flags['zm' + this.zinstar] = true;
      const key = this.zinstar === 1 ? 'zoea2' : this.zinstar === 2 ? 'zoea3' : 'megalopa';
      this.milestone(key, () => { this.molting = MOLT_T; this.tight = 0; Bus.emit('molting', this); });
    }
  }
  finishSeaMolt() {
    this.stats.molts++;
    this.G.particles.shed(this.x, this.y, this.r);
    if (this.zinstar < 3) { this.zinstar++; Bus.emit('molted', this, this.zinstar); if (this.zinstar === 3) Bus.emit('zoea3', this); return; }
    this.stage = 'megalopa'; this.W.drift = 1;
    /* about a month at sea: the eddies have carried the larva far from the island */
    if (this.x > -1700) { this.x = -1700 - Math.random() * 500; this.y = clamp(this.y, 60, 300); this.G.world.sibs.length = 0; this.G.world.plankton.length = 0; }
    Bus.emit('megalopa', this);
  }
  /* riding a jellyfish home */
  updateRide(dt) {
    const j = this.ride;
    if (!j || this.input.actionPressed || j.x > -300) { this.hopOff(); return; }
    this.x = j.x + Math.sin(this.t * .7) * j.r * .2; this.y = j.y - j.r * .55 - 3; this.vx = j.vx; this.vy = 0; this.face = 1;
    this.homeHint = { x: -10, y: 30 };
  }
  hopOff() { const j = this.ride; if (j) j.rider = false; this.ride = null; this.mode = 'swim'; this.vy = -16; this.vx = 20; Bus.emit('hopOff', this); }
  becomeCrab() {
    const S = this.S;
    this.stage = 'crab'; this.mode = 'walk'; this.instar = 1; this.cfood = 0; this.water = 1; this.ride = null;
    this.cm = crabCM(1, 0, this.D.crab);
    this.x = 18; this.y = S.walkTop(this.x, 4) - this.feet; this.face = 1; this.hardT = HARDEN_T; this.pale = .6;
    this.G.particles.shed(this.x - 8, this.y, 4);
    this.W.startBabies();
    Bus.emit('ashore', this);
  }

  /* ============================================================
     ON LAND
     ============================================================ */
  updateCrab(dt) {
    const D = this.D;
    this.cm = crabCM(this.instar, this.cfood, D.crab);
    this.up = this.upT > 0 ? Math.min(1, this.up + dt * 6) : Math.max(0, this.up - dt * 4); this.upT -= dt;
    this.pinch = Math.max(0, this.pinch - dt * 2);
    if (this.pale > 0 && this.mode !== 'harden') this.pale = Math.max(0, this.pale - dt * .25);
    this.updateWater(dt);
    if (this.busy > 0) { this.updateBusy(dt); return; }
    switch (this.mode) {
      case 'walk': this.updateWalk(dt); break;
      case 'burrow': this.updateBurrow(dt); break;
      case 'moult': this.molting -= dt; if (this.molting <= 0) this.finishCrabMolt(); break;
      case 'harden': this.hardT += dt; this.pale = clamp(1 - this.hardT / HARDEN_T, 0, 1);
        if (this.hardT >= HARDEN_T && !this.flags.hardening) {
          /* the last moult: the "grown up" page waits until the new shell is hard */
          this.flags.hardening = true;
          const done = () => { this.mode = 'burrow'; this.pale = 0; this.flags.hardening = false; Bus.emit('hardened', this); };
          if (this.instar >= 4) this.milestone('adult', done); else done();
        }
        break;
      case 'shove': this.updateShove(dt); break;
      case 'tossed': this.updateTossed(dt); break;
      case 'rest': this.restT += dt; if (this.restT > REST_T) { this.mode = 'walk'; this.water = .7; Bus.emit('rested', this); } break;
      case 'brood': this.broodT += dt; this.eggs = clamp(.3 + this.broodT / BROOD_T * .7, 0, 1); if (this.broodT >= BROOD_T && !this.flags.broodDone) { this.flags.broodDone = true; this.mode = 'burrow'; Bus.emit('broodDone', this); } break;
      case 'release': this.updateRelease(dt); break;
    }
    /* growth: a full young crab must go home and moult */
    if (this.instar < 4 && this.cfood >= this.crabTh && !this.full) { this.full = true; Bus.emit('fullCrab', this); }
    if (this.mode === 'walk') this.sniff(dt);
    this.stats.march = Math.max(this.stats.march, this.flags.migrating ? (this.flags.marchFrom || this.x) - this.x : 0);
    if (this.x > WORLD.cliffL + 30 && this.x < WORLD.cliffR && !this.flags.onCliff) { this.flags.onCliff = true; Bus.emit('cliff', this); }
    if (this.x > WORLD.cliffR + 20 && this.instar === 1 && !this.flags.forestGate) { this.flags.forestGate = true; this.milestone('forest', () => { this.flags.forest = true; Bus.emit('forest', this); }); }
    if (this.x > WORLD.bridgeL + 80 && this.x < WORLD.bridgeR - 80 && this.mode === 'walk' && this.y < WORLD.plateau - 40 && !this.flags.bridge) { this.flags.bridge = true; Bus.emit('bridge', this); }
  }
  /* gills: the sun dries them, shade, burrows, rain, night and the sea keep them damp */
  updateWater(dt) {
    const W = this.W, D = this.D, G = this.G;
    const shade = this.mode === 'brood' || this.underground ? 'burrow' : W.shadeAt(this.x, this.y + this.feet - 1, this.w);
    const day = 1 - nightAmount(G.tod), rain = W.weather.rain, small = this.instar <= 1 ? 1.7 : this.instar <= 3 ? 1.2 : 1;
    let rate = 0;
    if (shade === 'sun') rate = -.016 * day * D.dry * small * (1 - W.weather.cloud * .5);
    else if (shade === 'canopy') rate = -.0045 * day * D.dry * small * (W.season === 'dry' ? 2.2 : 1);
    else rate = .03;
    rate += rain * .05 + (1 - day) * .008;
    if (shade === 'water') rate = .2;
    this.water = clamp(this.water + rate * dt, 0, 1);
    if (shade === 'shelter' && this.shade === 'sun' && this.water < .7) { this.stats.shelters++; Bus.emit('shaded', this); }
    this.shade = shade;
    if (this.water < .25 && !this.flags.drySaid && this.mode === 'walk') { this.flags.drySaid = true; Bus.emit('drying', this); }
    if (this.water > .55) this.flags.drySaid = false;
    if (this.water <= 0 && this.mode === 'walk' && this.busy <= 0) { this.mode = 'rest'; this.restT = 0; this.target = null; Bus.emit('tooDry', this); }
  }
  updateWalk(dt) {
    const S = this.S, W = this.W, inp = this.input, w = this.w;
    if (inp.actionPressed) { if (this.act()) return; }
    if (inp.eggPressed) { this.upT = 1.2; this.pinch = 1; Bus.emit('clawsUp', this); }
    const slope = S.slopeAt(this.x, Math.max(4, w * .4));
    const sp = (20 + w * 1.05) * (this.G.settings.slowmo ? .7 : 1) * (this.flags.migrating ? 1.15 : 1);
    if (Math.abs(inp.x) > .15) {
      const dx = inp.x * sp * dt / (1 + Math.abs(slope) * 1.1);
      const nx = clamp(this.x + dx, -30, WORLD.right - 30);
      /* the sea is too deep for a crab past the waves; the crazy ants are a no-go */
      const deep = nx < 80 && dx < 0 && S.walkTop(nx, 4) - W.seaLevel() > w * .9;
      const ants = nx > W.ants.x0 && nx < W.ants.x1;
      if (deep) { this.say('toodeep'); }
      else if (ants) { this.x -= sign(dx) * 6; this.say('ants'); Bus.emit('antsMet', this); }
      else { this.x = nx; this.walk += dt * 13 * Math.abs(inp.x); this.moving = true; this.face = sign(inp.x); }
    } else this.moving = false;
    if (this.flags.migrating && this.moving && inp.x < 0) this.flags.marchFrom = Math.max(this.flags.marchFrom || 0, this.x);
    this.y = S.walkTop(this.x, Math.max(4, w * .4)) - this.feet;
    this.ang = angleLerp(this.ang, clamp(Math.atan(slope), -1, 1) * .7, clamp(dt * 8, 0, 1));
    if (inp.y > .6 && !this._downHeld) this.tryDig();
    this._downHeld = inp.y > .6;
  }
  /* push down: into an open burrow door, or dig a new one in soft ground */
  tryDig() {
    const S = this.S, foot = this.y + this.feet;
    const hole = S.topAt(this.x) - S.walkTop(this.x, Math.max(4, this.w * .4)) > this.w * .35;
    /* the first solid ground under the crab, looking a little to each side too (the ground is bumpy) */
    const softAt = (x) => { for (let y = foot - 4; y < foot + 16; y += 3) { const m = S.matAt(x, y); if (m !== MAT.AIR) return S.diggable(m); } return false; };
    let dx = null;
    for (const o of [0, -4, 4, -8, 8, -this.w * .3, this.w * .3]) if (softAt(this.x + o)) { dx = o; break; }
    if (!hole && dx === null) { this.say('rock'); return; }
    if (!hole) this.x += dx;
    this.mode = 'burrow'; this.ang = Math.PI / 2; this.target = null;
    if (!this.burrow || Math.abs(this.burrow.x - this.x) > 40 || this.flags.migrating && !this.flags.siteBurrow) {
      this.burrow = { x: this.x, y: S.surfaceAt(this.x) };
      this.stats.burrows++;
      if (this.flags.migrating && this.x > WORLD.terraceL && this.x < WORLD.terraceR) this.flags.siteBurrow = true;
    }
    this.y += 2;
    Bus.emit('digStart', this);
  }
  updateBurrow(dt) {
    const S = this.S, inp = this.input, D = this.D;
    if (inp.actionPressed) { if (this.act()) return; }
    let mx = inp.x, my = inp.y; const m = Math.hypot(mx, my);
    if (m < .1) { this.moving = false; this.checkDepth(); return; }
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 7, 0, 1));
    if (Math.abs(mx) > .3) this.face = sign(mx);
    /* a burrow is always at least three cells wide, so you can see it in the soil */
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang), rad = Math.max(9, this.w * .5 + 1);
    const step = (16 + this.w * .45) * dt;
    const nx = this.x + dx * step, ny = this.y + dy * step;
    this.moving = true; this.walk += dt * 10;
    /* the burrow's open door is air too: the crab may move through any air, and it is out once its middle is above the ground */
    if (S.free(nx, ny, rad * .66, false)) { this.x = nx; this.y = ny; }
    else {
      /* dig the whole width of the body ahead, so a big crab never wedges itself in */
      const hx = this.x + dx * rad * .55, hy = this.y + dy * rad * .55;
      const res = S.dig(hx, hy, rad * 1.08 + 1, D.dig * (1.1 + this.instar * .35), dt, { root: this.instar >= 3 });
      this.digClock -= dt;
      if (res.cells) {
        this.stats.dug += res.cells;
        if (this.digClock <= 0) { this.digClock = .12; AudioFX.dig && AudioFX.dig(); this.G.particles.dust(hx, hy, S.matAt(hx, hy) === MAT.SAND ? '#d8b07a' : '#7a4a2a', 3, this.ang); }
        if (res.plug && !this.flags.plugOpen) { this.flags.plugOpen = true; Bus.emit('unplug', this); }
        /* creep into what was just dug */
        if (S.free(this.x + dx * 1.2, this.y + dy * 1.2, rad * .66, false)) { this.x += dx * 1.2; this.y += dy * 1.2; }
      } else if (res.blocked) {
        /* the open air is right there beside the rock: scramble out */
        if (dy < -.3 && S.survey(this.x, this.y - rad, rad * 1.2).sky > 0) { this.surface(); return; }
        this.say('rock');
        /* stuck under a rock on the way up: feel along towards the burrow's door */
        if (dy < -.3 && this.burrow && Math.abs(this.burrow.x - this.x) > 2) { const sx = sign(this.burrow.x - this.x); if (S.free(this.x + sx * step, this.y, rad * .66, false)) this.x += sx * step; else this.slide(dx, dy, step, rad); }
        else this.slide(dx, dy, step, rad);
      }
    }
    if (this.depth < -this.feet * .4 && dy < .2) { this.surface(); return; }
    /* keep within the soil: never deeper than a long arm's length */
    if (this.depth > Math.max(60, this.w * 2.6)) this.y -= 1;
    this.checkDepth();
  }
  slide(dx, dy, step, r) {
    for (const s of [1, -1]) { const a = this.ang + s * 1.1, nx = this.x + Math.cos(a) * step * .6, ny = this.y + Math.sin(a) * step * .6; if (this.S.free(nx, ny, r * .66, false)) { this.x = nx; this.y = ny; return true; } }
    return false;
  }
  checkDepth() {
    const deep = this.depth > this.w * 1.1 + 3;
    const siteDeep = this.depth > Math.min(this.w * 1.1 + 3, 28);
    if (deep && !this.flags.deepNow) { this.flags.deepNow = true; Bus.emit('deepEnough', this); }
    if (!deep) this.flags.deepNow = false;
    if (this.flags.migrating && this.sex === 'boy' && siteDeep && this.flags.siteBurrow && !this.flags.burrowDug) { this.flags.burrowDug = true; Bus.emit('siteDug', this); }
  }
  surface() {
    const S = this.S;
    this.mode = 'walk'; this.ang = 0; this.y = S.walkTop(this.x, Math.max(4, this.w * .4)) - this.feet;
    this.G.particles.dust(this.x, this.y + this.feet, '#7a4a2a', 8, -Math.PI / 2);
    Bus.emit('surfaced', this);
  }
  /* no food for a while: an arrow points to the nearest */
  sniff(dt) {
    if (this.instar <= 1 && !this.flags.forest) { this.foodHint = null; return; }
    if (this.full || this.flags.migrating) { this.foodHint = null; return; }
    this.hungryT += dt; this.sniffClock -= dt;
    if (this.hungryT < 8 || this.sniffClock > 0) return;
    this.sniffClock = 1.5;
    let best = null, bd = 1e9;
    for (const it of this.W.items) { if (it.bites <= 0 || it.fy !== null) continue; const d = Math.abs(it.x - this.x); if (d < bd) { bd = d; best = it; } }
    if (best && !this.foodHint) Bus.emit('hint', 'sniff');
    this.foodHint = best ? { x: best.x, y: best.y } : null;
  }

  /* ---------- moulting at home ---------- */
  moultReady() { return this.stage === 'crab' && this.mode === 'burrow' && this.full && this.instar < 4 && this.depth > this.w * 1.1 + 3; }
  sealAndMoult() {
    const go = () => { this.S.plugAbove(this.x, this.y, Math.max(9, this.w * .5 + 1)); this.mode = 'moult'; this.molting = MOLT_T; this.flags.plugOpen = false; Bus.emit('sealed', this); Bus.emit('molting', this); };
    this.flags.sealing = true;
    go();
  }
  finishCrabMolt() {
    this.W.exuviae.push({ x: this.x + this.face * this.w * .3, y: this.y + this.feet * .3, s: this.w / 100, form: this.form });
    this.instar++; this.stats.molts++; this.full = false; this.flags.sealing = false;
    this.cm = crabCM(this.instar, this.cfood, this.D.crab);
    this.pale = 1; this.hardT = 0; this.mode = 'harden';
    Bus.emit('crabMolted', this, this.instar);
  }

  /* ---------- what Space does right now ---------- */
  reach() { return this.w * .6 + 12; }
  context() {
    const W = this.W;
    if (this.stage === 'egg') return null;
    if (this.swimming) {
      if (this.mode === 'ride') return 'hop';
      if (this.stage === 'megalopa' && this.tumble <= 0 && W.jellies.some(j => Math.hypot(j.x - this.x, j.y - this.y) < j.r + 16)) return 'ride';
      return null;
    }
    if (this.busy > 0) return null;
    if (this.mode === 'burrow') return this.moultReady() ? 'moult' : null;
    if (this.mode !== 'walk') return null;
    const R = this.reach();
    const edge = W.waterEdge(true);
    if (this.flags.broodDone && !this.flags.released && this.sex === 'girl' && this.x < edge + 14) return 'shake';
    if (this.flags.migrating && this.x < edge + 10 && (!this.flags.dipped || this.water < .9)) return 'dip';
    const riv = W.rival(); if (riv && riv.mode === 'stand' && Math.abs(riv.x - this.x) < R + riv.w * .5 + 10) return 'push';
    if (this.sex === 'boy') { const f = W.female(); if (f && f.mode === 'stand' && !this.flags.met && Math.abs(f.x - this.x) < R + f.w * .5 + 14) return 'meet'; }
    else if (this.flags.dipped && !this.flags.met) { const h = W.hosts().find(n => Math.abs(n.x - this.x) < R + n.w * .5 + 14); if (h) return 'meet'; }
    if (W.foodNear(this.x, this.y + this.feet, R)) return 'eat';
    return null;
  }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    if (v === 'hop') this.hopOff();
    else if (v === 'ride') { { const j = W.jellies.find(j => Math.hypot(j.x - this.x, j.y - this.y) < j.r + 16); this.ride = j; j.rider = true; this.mode = 'ride'; this.stats.rides++; Bus.emit('ride', this, j); } }
    else if (v === 'eat') { const it = W.foodNear(this.x, this.y + this.feet, this.reach()); this.face = sign(it.x - this.x) || this.face; this.startBusy('eat', 1.1, it); }
    else if (v === 'dip') this.startBusy('dip', 2.2, null);
    else if (v === 'push') this.startShove(W.rival());
    else if (v === 'meet') { const o = this.sex === 'boy' ? W.female() : W.hosts().find(n => Math.abs(n.x - this.x) < this.reach() + n.w * .5 + 14); this.face = sign(o.x - this.x) || this.face; this.startBusy('meet', 2.2, o); }
    else if (v === 'moult') this.sealAndMoult();
    else if (v === 'shake') this.startRelease();
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; this.target = null; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy;
    this.busy -= dt;
    if (k === 'eat') { this.eatAnim = t0; if (Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.munch && AudioFX.munch(); this.G.particles.puff(o.x, o.y - 2, o.kind === 'fruit' ? '#c88ab8' : o.kind === 'flower' ? '#ff8a9a' : '#b8903a', 2); } }
    if (k === 'dip') { this.water = Math.min(1, this.water + dt); if (Math.random() < dt * 10) this.G.particles.drip(this.x + rnd(-this.w * .4, this.w * .4), this.y - this.w * .2); }
    if (k === 'meet' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - this.w * .5 - 10, '♥', '#ff7aa8', 14);
    if (this.busy > 0) return;
    this.busy = 0; this.eatAnim = 0;
    if (k === 'eat' && o.bites > 0) {
      o.bites--; const F = FOOD_KINDS[o.kind];
      this.cfood = Math.min(this.cfood + F.food / F.bites, this.crabTh); this.stats.food++;
      this.stats[o.kind === 'leaf' ? 'leaves' : o.kind === 'flower' ? 'flowers' : o.kind === 'fruit' ? 'fruits' : 'seedlings']++;
      this.hungryT = 0; this.foodHint = null;
      if (!this.flags.ateLand) { this.flags.ateLand = true; Bus.emit('firstFood', this, o); }
      Bus.emit('ateFood', this, o);
    }
    if (k === 'dip') { this.water = 1; this.stats.dips++; if (!this.flags.dipped) { this.flags.dipped = true; Bus.emit('dipped', this); } }
    if (k === 'meet') { this.flags.met = true; Bus.emit('met', this, o); }
  }

  /* ---------- pushing contests over a burrow ----------
     Tap Space to push.  A ring shrinks round and round: press E (or up)
     while it is green for a BIG SHOVE.  Push him off and he tumbles
     over, rights himself and scuttles away, unhurt. */
  startShove(r) {
    if (!r) return;
    this.mode = 'shove'; this.target = null;
    this.face = sign(r.x - this.x) || 1; r.face = -this.face; r.mode = 'shove';
    const gap = (this.w + r.w) * .36, mid = (this.x + r.x) / 2;
    this.wr = { rival: r, p: 0, ring: 0, t: 0, done: null, doneT: 0, mid, gap, flash: 0, taps: 0, shoves: 0 };
    Bus.emit('shove', this, r);
  }
  shoveWindow() { const w = this.wr; if (!w) return false; const u = (w.ring % 1.8) / 1.8; const wide = this.G.settings.difficulty === 'easy' ? .3 : this.G.settings.difficulty === 'hard' ? .14 : .2; return u > .9 - wide && u < .93; }
  updateShove(dt) {
    const w = this.wr, R = w.rival, inp = this.input, D = this.D, S = this.S;
    w.t += dt; w.flash = Math.max(0, w.flash - dt * 3);
    if (w.done) {
      w.doneT += dt;
      if (w.done === 'win') { this.upT = .5; if (w.doneT > .5 && R.mode === 'shove') { R.mode = 'tossed'; R.vx = this.face * 150; R.vy = -190; AudioFX.toss && AudioFX.toss(); } if (w.doneT > 1.1) this.endShove(); }
      else if (w.doneT > .4 && this.mode === 'shove') { this.mode = 'tossed'; this.vx = -this.face * 130; this.vy = -170; this.spin = 0; R.mode = 'stand'; R.leaveIn = 16; AudioFX.toss && AudioFX.toss(); }
      return;
    }
    const str = 1 + (this.cm - 9) / 3.5 + this.water * .2;
    const rStr = D.rival * Math.pow(R.cm / this.cm, 1.4);
    w.ring += dt;
    if (inp.actionPressed) { w.p += .06 * str; w.taps++; this.pinch = .6; AudioFX.clack && AudioFX.clack(); this.G.particles.dust(w.mid, this.y + this.feet, '#d8b07a', 2); }
    const big = inp.eggPressed || (inp.y < -.6 && !this._upHeld);
    this._upHeld = inp.y < -.6;
    if (big) {
      if (this.shoveWindow()) { w.p += .26 * str; w.flash = 1; w.shoves++; this.upT = .4; AudioFX.heave && AudioFX.heave(); this.G.particles.sparkle(w.mid, this.y - 10, 12, '#fff3b0', 16); }
      else w.p -= .05;
    }
    w.p -= rStr * .17 * dt * (1 + Math.sin(w.t * 1.7) * .4);
    w.p = clamp(w.p, -1, 1);
    const shove = w.p * 16;
    this.x = w.mid - this.face * w.gap + this.face * shove; R.x = w.mid + this.face * w.gap + this.face * shove;
    this.y = S.walkTop(this.x, 6) - this.feet; R.y = S.walkTop(R.x, 6) - R.feet;
    this.walk += dt * 8 * (1 + Math.abs(w.p)); this.moving = true; this.up = .5 + Math.sin(w.t * 9) * .2; R.walk = this.walk;
    if (w.p >= 1) { w.done = 'win'; this.stats.wins++; if (this.stats.wins >= D.wins) this.flags.king = true; Bus.emit('shoveWon', this, R); }
    else if (w.p <= -1) { w.done = 'lose'; this.stats.losses++; Bus.emit('shoveLost', this, R); }
  }
  endShove() { const w = this.wr; this.wr = null; this.mode = 'walk'; this.moving = false; if (w && w.done === 'win' && this.flags.king && !this.flags.kingSeen) { this.flags.kingSeen = true; Bus.emit('king', this); } }
  /* pushed off (or knocked by a bird): a roll over and back onto your feet */
  updateTossed(dt) {
    const S = this.S;
    this.vy += 600 * dt; this.vx *= Math.exp(-dt * 1.2);
    this.x = clamp(this.x + this.vx * dt, -20, WORLD.right - 30); this.y += this.vy * dt; this.spin += dt * 11 * (this.vx >= 0 ? 1 : -1);
    const top = S.walkTop(this.x, Math.max(4, this.w * .4)) - this.feet;
    if (this.y >= top && this.vy > 0) { this.y = top; this.mode = 'walk'; this.spin = 0; this.vx = this.vy = 0; const pushed = !!this.wr; this.wr = null; Bus.emit(pushed ? 'tossedDown' : 'knockedDown', this); }
  }
  knock(dir) { if (this.mode !== 'walk' || this.busy > 0) return; this.mode = 'tossed'; this.vx = dir * 60; this.vy = -120; this.spin = 0; this.stats.tumbles++; Bus.emit('missed', this); }

  /* ---------- the girl: brooding, and letting the eggs go ---------- */
  startBrood(door) {
    const S = this.S;
    this.mode = 'brood'; this.broodT = 0; this.eggs = .3; this.target = null;
    this.x = door.x; this.y = door.y + this.w * 1.15;
    /* his burrow, widened for her: a straight shaft down from the door to a round room */
    for (let y = door.y; y <= this.y; y += 3) S.blob(this.x, y, Math.max(9, this.w * .5), Math.max(7, this.w * .3), MAT.AIR, (m) => m !== MAT.AIR);
    S.blob(this.x, this.y, this.w * .58, this.w * .5, MAT.AIR, (m) => m !== MAT.AIR); S.flushTop();
    this.burrow = { x: door.x, y: door.y };
    Bus.emit('brooding', this);
  }
  startRelease() { this.mode = 'release'; this.rel = { good: 0, miss: 0, t: 0, flash: 0, lastWave: -1 }; this.target = null; Bus.emit('release', this); }
  releaseWindow() { return this.W.swash() > .62; }
  updateRelease(dt) {
    const r = this.rel, W = this.W, D = this.D;
    r.t += dt; r.flash = Math.max(0, r.flash - dt * 2);
    const wave = Math.floor(W.t / 5.6);
    this.up = .2; this.walk += dt * 3;
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.releaseGate) {
      if (this.releaseWindow() && r.lastWave !== wave) {
        r.lastWave = wave; r.good++; r.flash = 1; this.stats.shakes++;
        const n = Math.round(100000 / D.shakes); this.stats.eggsOut += n;
        this.eggs = Math.max(0, 1 - r.good / D.shakes);
        W.eggBurst(this.x - this.w * .2, this.y + this.feet * .6, 60);
        this.G.particles.sparkle(this.x - 10, this.y + this.feet, 18, '#fff3c0', 24);
        AudioFX.splash && AudioFX.splash(); Bus.emit('shake', this, r.good);
        if (r.good >= D.shakes && !this.flags.releaseGate) { this.flags.releaseGate = true; this.milestone('eggs', () => { this.flags.released = true; this.mode = 'walk'; Bus.emit('eggsReleased', this); }); }
      } else if (r.lastWave !== wave) { r.miss++; this.say('release'); }
    }
  }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'stage', 'mode', 'x', 'y', 'face', 'eggT', 'food', 'zinstar', 'cfood', 'instar', 'full', 'water', 'hardT', 'pale', 'burrow', 'broodT', 'eggs', 'stats', 'flags']) o[k] = this[k];
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    if (['egg', 'zoea', 'megalopa', 'crab'].includes(o.stage)) this.stage = o.stage;
    const modes = { egg: ['egg'], zoea: ['swim'], megalopa: ['swim'], crab: ['walk', 'burrow', 'harden', 'brood'] }[this.stage];
    this.mode = modes.includes(o.mode) ? o.mode : modes[0];
    const midMoult = o.mode === 'moult';
    if (midMoult) this.mode = 'harden';
    this.x = clamp(num(o.x, this.x), WORLD.left + 80, WORLD.right - 30); this.y = clamp(num(o.y, this.y), WORLD.top + 100, 660);
    this.face = o.face === -1 ? -1 : 1;
    this.eggT = num(o.eggT, 0); this.food = Math.max(0, num(o.food, 0)); this.zinstar = clamp(Math.round(num(o.zinstar, 1)), 1, 3);
    this.cfood = Math.max(0, num(o.cfood, 0)); this.instar = clamp(Math.round(num(o.instar, 1)), 1, 4); this.full = !!o.full;
    this.water = clamp(num(o.water, 1), 0, 1); this.hardT = clamp(num(o.hardT, HARDEN_T), 0, HARDEN_T); this.pale = clamp(num(o.pale, 0), 0, 1);
    this.burrow = o.burrow && Number.isFinite(o.burrow.x) && Number.isFinite(o.burrow.y) ? { x: o.burrow.x, y: o.burrow.y } : null;
    this.broodT = Math.max(0, num(o.broodT, 0)); this.eggs = clamp(num(o.eggs, 0), 0, 1);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    /* a gated step that was waiting when the game closed starts again by itself */
    for (const k of ['hatching', 'zm1', 'zm2', 'zm3', 'ashoreGate', 'forestGate', 'sealing', 'releaseGate', 'drySaid', 'deepNow', 'hardening', 'eggsAtSea']) delete this.flags[k];
    if (this.stats.wins >= this.D.wins) this.flags.king = true;
    if (midMoult && this.stage === 'crab' && this.instar < 4) { this.instar++; this.stats.molts++; this.full = false; this.hardT = 0; this.pale = 1; }
    this.cm = this.stage === 'crab' ? crabCM(this.instar, this.cfood, this.D.crab) : .5;
    if (this.stage === 'crab') {
      const S = this.S;
      if (this.mode === 'walk') this.y = S.walkTop(this.x, Math.max(4, this.w * .4)) - this.feet;
      else if (!S.free(this.x, this.y, this.w * .3, false)) { S.blob(this.x, this.y, this.w * .5, this.w * .45, MAT.AIR, (m) => S.diggable(m) || m === MAT.ROOT); S.flushTop(); }
    }
    if (this.swimming) this.W.drift = this.stage === 'megalopa' ? 1 : -1;
  }
}
