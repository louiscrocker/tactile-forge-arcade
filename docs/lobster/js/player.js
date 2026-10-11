/* ============================================================
   player.js — you, the lobster, from egg to the next generation
   ============================================================
   stage  egg        one of thousands under your mum's tail, in her
                     den on the cobble bed: on a summer night she
                     fans you free
          larva      a tiny shrimp-like swimmer near the surface
                     (mode swim): eat plankton, moult twice (stage
                     II, stage III), then once more into…
          postlarva  stage IV, the "superlobster": swim forwards with
                     the tail fan, dive to the cobble bed and find a
                     hole under a cobble that nobody is in
          lobster    instar 1  a juvenile in its hole: eat what drifts
                               in, moult (the shelter years)
                     instar 2–3 a young lobster: forage at night, hide
                               by day, dig a den under a cobble and
                               moult; the claws are decided; the trap
                     instar 4  an adult: autumn's long walk offshore,
                               winter in the mud, spring's walk home,
                               boys: dig a den and box rivals; girls:
                               moult in a boy's den, carry the eggs,
                               fan the larvae free on a summer night
          modes on the bottom: walk · dig · moult · harden · box ·
                     tossed · tuck (hidden, waiting) · trap · winter ·
                     brood · release
   Nothing hurts the lobster, ever: a fish, a seal or a bird misses
   and you tumble; the lobsterman measures you and puts you back;
   losing a boxing match means backing off and another go.
   ============================================================ */
'use strict';

const MOLT_T = 2.8, HARDEN_T = 8, BROOD_T = 24, TUCK_T = 2.4, WINTER_T = 9, FLIP_T = .55;

class Lobster {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'normal';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.eggX; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.phase = 0;
    this.food = 0; this.zinstar = 1; this.tight = 0; this.molting = 0;
    this.cfood = 0; this.instar = 1; this.full = false;
    this.safe = 1; this.hardT = HARDEN_T; this.pale = 0; this.cm = .5;
    this.walk = 0; this.moving = false; this.up = 0; this.upT = 0; this.pinch = 0; this.eatAnim = 0; this.spin = 0;
    this.flipT = 0; this.flipCool = 0; this.tuckT = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.den = null; this.home = null; this.wr = null; this.rel = null; this.tumble = 0;
    this.dashCool = 0; this.broodT = 0; this.winterT = 0; this.eggs = 0; this.shade = 'open';
    this.crusher = null; this.lead = null;
    this.hintClock = 0; this.digClock = 0; this.hungryT = 0; this.foodHint = null; this.sniffClock = 0; this.target = null;
    this.stats = { plankton: 0, copepods: 0, glow: 0, molts: 0, dashes: 0, flips: 0, dodges: 0, food: 0, mussels: 0, crabs: 0, urchins: 0, snails: 0, kelp: 0, drifters: 0, shells: 0, dug: 0, dens: 0, wins: 0, losses: 0, trapped: 0, walked: 0, fans: 0, larvaeOut: 0, shelters: 0, tumbles: 0, clawUse: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get swimming() { return this.stage === 'larva' || this.stage === 'postlarva'; }
  /* the drawn length of a lobster, and how far its middle sits above its feet */
  get w() { return lobUnits(this.cm); }
  get feet() { return this.w * .2; }
  /* collision radius */
  get r() {
    if (this.stage === 'egg') return 1.2;
    if (this.stage === 'larva') { const th = [0, ...this.D.larva], i = this.zinstar, t = clamp((this.food - th[i - 1]) / (th[i] - th[i - 1]), 0, 1); return [0, lerp(1.6, 2.2, t), lerp(2.4, 3.0, t), lerp(3.2, 3.8, t)][i]; }
    if (this.stage === 'postlarva') return 4.6;
    return this.w * .22;
  }
  get underground() { return this.stage === 'lobster' && ['dig', 'moult', 'harden', 'brood', 'winter'].includes(this.mode) && this.y > this.S.surfaceAt(this.x) - 2; }
  get depth() { return this.y - this.S.surfaceAt(this.x); }
  get soft() { return this.pale > 0 || this.mode === 'harden'; }
  get hidden() { return this.shade === 'shelter' || this.shade === 'den'; }
  stageKey() {
    if (this.stage === 'egg') return 'egg';
    if (this.stage === 'larva') return 'larva';
    if (this.stage === 'postlarva') return 'postlarva';
    if (this.instar <= 1) return 'juvenile';
    if (this.instar <= 3) return 'young';
    return this.flags.migrating && !this.flags.home ? 'walk' : 'adult';
  }
  /* the threshold for the next moult on the bottom */
  get lobTh() { return this.instar < 4 ? this.D.lob[this.instar - 1] : this.D.lob[2] * BONUS; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.dashCool -= dt; this.flipCool -= dt;
    const inp = this.input;
    if (this.target) this.steerToTarget();
    switch (this.stage) {
      case 'egg': this.updateEgg(dt); break;
      case 'larva': case 'postlarva': this.updateSwim(dt); break;
      case 'lobster': this.updateLobster(dt); break;
    }
    inp.actionPressed = false; inp.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (this.stage === 'lobster' && this.mode === 'walk') {
      if (Math.abs(dx) < Math.max(4, this.w * .2)) { this.target = null; return; }
      this.input.x = sign(dx); this.input.y = 0;
    } else { if (d < Math.max(4, this.r * 2)) { this.target = null; return; } this.input.x = dx / d; this.input.y = dy / d; }
  }
  goTo(x, y) { if (this.stage === 'egg' || ['moult', 'harden', 'brood', 'release', 'box', 'tuck', 'trap', 'winter'].includes(this.mode)) return; this.target = { x, y }; }

  /* ---------- the egg ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    const m = this.W.mum;
    if (m) { this.x = m.x - m.w * .16; this.y = m.y + m.feet * .5; }
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    const W = this.W, m = W.mum;
    this.stage = 'larva'; this.mode = 'swim'; this.zinstar = 1; this.food = 0;
    this.x = m ? m.x - 10 : WORLD.eggX; this.y = (m ? m.y : this.S.surfaceAt(this.x)) - 26; this.vx = -10; this.vy = -30; this.face = -1;
    W.larvaBurst(this.x + 6, this.y + 10, 80);
    W.drift = -1;
    Bus.emit('hatched', this);
  }

  /* ============================================================
     IN THE PLANKTON
     ============================================================ */
  updateSwim(dt) {
    const W = this.W, S = this.S, inp = this.input, larva = this.stage === 'larva';
    if (this.molting > 0) { this.molting -= dt; this.drift(dt, .6); if (this.molting <= 0) this.finishSeaMolt(); return; }
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 14; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    if (inp.actionPressed) this.act();
    /* E: snap the tail for a dash (a larva flicks forward; stage IV flips backwards like a lobster) */
    if (inp.eggPressed && this.dashCool <= 0) {
      const m = Math.hypot(inp.x, inp.y), dx = m > .1 ? inp.x / m : this.face, dy = m > .1 ? inp.y / m : 0;
      const k = larva ? 1 : -1;
      this.vx += dx * (larva ? 80 : 120) * k; this.vy += dy * (larva ? 80 : 120) * k; this.dashCool = .9; this.stats.dashes++;
      this.G.particles.bubbles(this.x - dx * this.r * 2, this.y - dy * this.r * 2, 5);
      AudioFX.dash && AudioFX.dash(); Bus.emit('dash', this);
    }
    const accel = larva ? 120 + this.zinstar * 14 : 200, maxSp = larva ? 20 + this.zinstar * 4 : 50;
    this.vx += inp.x * accel * dt; this.vy += inp.y * accel * dt;
    this.vy += (larva ? 5 : 8) * dt;                        /* a larva slowly sinks if it stops swimming; stage IV sinks faster */
    this.vx *= Math.exp(-dt * 2.4); this.vy *= Math.exp(-dt * 2.4);
    const sp = Math.hypot(this.vx, this.vy), cap = maxSp * (this.dashCool > .5 ? 2.4 : 1);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.drift(dt, 1);
    if (Math.abs(inp.x) > .2) this.face = sign(inp.x);
    this.moving = Math.hypot(inp.x, inp.y) > .1;
    this.ang = clamp(this.vy / 60, -.6, .6) * (this.face > 0 ? 1 : -1);
    /* eat any plankton you bump into (a larva; stage IV eats a little too) */
    const R = this.r;
    for (const q of W.plankton) {
      if (q.eaten) continue;
      const d = Math.hypot(q.x - this.x, q.y - this.y);
      if (d < R + PLANKTON_KINDS[q.kind].r + 1.4) {
        q.eaten = true; if (larva) this.food += PLANKTON_KINDS[q.kind].val; this.stats.plankton++;
        if (q.kind === 'copepod') { this.stats.copepods++; Bus.emit('ateCopepod', this); }
        if (q.kind === 'dino' && nightAmount(this.G.tod) > .4) { this.stats.glow++; this.G.particles.sparkle(q.x, q.y, 10, '#8ee8ff', 5); Bus.emit('glow', this); }
        else this.G.particles.puff(q.x, q.y, q.kind === 'copepod' ? '#ffd0a0' : '#c8f0a0', 3, .6);
        AudioFX.blip && AudioFX.blip(q.kind === 'copepod' ? 1.4 : 1);
        Bus.emit('ate', this, q);
      } else if (q.kind === 'dino' && d < R + 6) q.glow = 1;
    }
    /* the big animals: never harmful, but they knock you about */
    const sc = W.school;
    if (sc && !sc.hitDone) for (const f of sc.fish) {
      const fx = sc.x + f.dx, fy = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6;
      if (Math.hypot(fx + sc.dir * 14 - this.x, fy - this.y) < 10 * f.s + R) { sc.hitDone = true; this.startTumble(sc.dir * 70, -20); break; }
    }
    const mouth = W.sharkMouth();
    if (mouth) {
      const dx = mouth.x - this.x, dy = mouth.y - this.y, d = Math.hypot(dx, dy);
      if (d < 420) { const pull = (1 - d / 420) * 95; this.vx += dx / d * pull * dt; this.vy += dy / d * pull * dt; }
      if (d < 60 && !W.shark.hitDone) { W.shark.hitDone = true; this.startTumble(W.shark.dir * 90, -70); this.x = mouth.x + W.shark.dir * 40; this.y = Math.max(W.seaLevel() + 8, mouth.y - 130); Bus.emit('sharkWhoosh', this); }
    }
    for (const j of W.jellies) { if (!j.hitDone && Math.hypot(j.x - this.x, j.y - this.y) < j.r + R + 2) { j.hitDone = true; this.startTumble(sign(this.x - j.x) * 60, -30); Bus.emit('combJelly', this); } }
    this.bounds();
    if (larva) this.larvaGrowth(dt);
    else {
      /* stage IV: home is the cobble bed, down on the bottom */
      const floor = S.walkTop(this.x, 6), onBed = this.x > WORLD.cobbleL && this.x < WORLD.cobbleR;
      this.homeHint = onBed ? null : { x: WORLD.homeX, y: S.surfaceAt(WORLD.homeX) - 20 };
      if (onBed && !this.flags.overBed) { this.flags.overBed = true; Bus.emit('overBed', this); }
      if (this.y > floor - 14 && onBed && !this.flags.searching) { this.flags.searching = true; Bus.emit('searching', this); }
      const sh = W.shelterAt(this.x, this.y, 8);
      if (sh && sh.kind === 'hollow' && this.y > floor - 24 && sh !== this.lastSh) { this.lastSh = sh; if (sh.taken) { this.say('taken'); Bus.emit('taken', this); } else this.say('settle'); }
      if (!sh) this.lastSh = null;
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
    if (this.x < WORLD.left + 80) { this.x = WORLD.left + 80; this.vx = Math.abs(this.vx); }
    const maxX = this.stage === 'larva' ? WORLD.kelpR : WORLD.ledgeR;
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    /* the sea floor pushes you back up */
    for (let k = 0; k < 4 && S.solidAt(this.x, this.y + R); k++) { this.y -= 2; this.vy = Math.min(0, this.vy); }
    if (S.solidAt(this.x + sign(this.vx) * R, this.y)) { this.x -= sign(this.vx) * 2; this.vx *= -.3; }
  }
  startTumble(vx, vy) { this.tumble = 1.1; this.vx = vx; this.vy = vy; this.stats.tumbles++; this.target = null; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('missed', this); }
  larvaGrowth(dt) {
    const th = this.D.larva[this.zinstar - 1];
    if (this.food < th) return;
    this.food = Math.max(this.food, th);
    this.tight += dt;
    if (this.tight > .2 && !this.flags['ztight' + this.zinstar]) { this.flags['ztight' + this.zinstar] = true; Bus.emit('tight', this); }
    if (this.tight > 1.6 && !this.flags['zm' + this.zinstar]) {
      this.flags['zm' + this.zinstar] = true;
      const key = this.zinstar === 1 ? 'larva2' : this.zinstar === 2 ? 'larva3' : 'postlarva';
      this.milestone(key, () => { this.molting = MOLT_T; this.tight = 0; Bus.emit('molting', this); });
    }
  }
  finishSeaMolt() {
    this.stats.molts++;
    this.G.particles.shed(this.x, this.y, this.r);
    if (this.zinstar < 3) { this.zinstar++; Bus.emit('molted', this, this.zinstar); if (this.zinstar === 3) Bus.emit('larva3', this); return; }
    this.stage = 'postlarva'; this.W.drift = 1;
    /* weeks at sea: the currents have carried the larva well offshore */
    if (this.x > -1500) { this.x = -1500 - Math.random() * 600; this.y = clamp(this.y, 40, 200); this.G.world.sibs.length = 0; this.G.world.plankton.length = 0; }
    Bus.emit('postlarva', this);
  }
  /* stage IV settles: this hole under this cobble is home */
  settle(sh) {
    const S = this.S;
    this.stage = 'lobster'; this.mode = 'walk'; this.instar = 1; this.cfood = 0; this.safe = 1;
    this.cm = lobCM(1, 0, this.D.lob);
    sh.taken = true; sh.mine = true; this.home = sh;
    this.x = sh.x; this.y = S.walkTop(this.x, 4) - this.feet; this.face = 1; this.hardT = HARDEN_T; this.pale = .5;
    this.G.particles.sparkle(this.x, this.y, 14, '#fff3c0', 10);
    Bus.emit('settled', this, sh);
  }

  /* ============================================================
     ON THE BOTTOM
     ============================================================ */
  updateLobster(dt) {
    const D = this.D;
    this.cm = lobCM(this.instar, this.cfood, D.lob);
    this.up = this.upT > 0 ? Math.min(1, this.up + dt * 6) : Math.max(0, this.up - dt * 4); this.upT -= dt;
    this.pinch = Math.max(0, this.pinch - dt * 2);
    if (this.pale > 0 && this.mode !== 'harden') this.pale = Math.max(0, this.pale - dt * .25);
    this.updateSafe(dt);
    if (this.busy > 0) { this.updateBusy(dt); return; }
    switch (this.mode) {
      case 'walk': this.updateWalk(dt); break;
      case 'dig': this.updateDig(dt); break;
      case 'moult': this.molting -= dt; if (this.molting <= 0) this.finishMolt(); break;
      case 'harden': if (this.input.actionPressed) this.act(); this.hardT += dt; this.pale = clamp(1 - this.hardT / HARDEN_T, 0, 1);
        if (this.hardT >= HARDEN_T && !this.flags.hardening) {
          this.flags.hardening = true;
          const done = () => { this.pale = 0; this.flags.hardening = false; if (this.flags.herMoult && !this.flags.broodStarted) { this.startBrood(); Bus.emit('hardened', this); return; } this.mode = this.den ? 'dig' : 'walk'; Bus.emit('hardened', this); };
          /* the first moult out of the nursery hole and the last moult into an adult: the page waits until the shell is hard */
          if (this.instar >= 4 && !this.flags.herMoult) this.milestone('adult', done);
          else if (this.instar === 2 && !this.flags.forageGate) { this.flags.forageGate = true; this.milestone('forage', done); }
          else done();
        }
        break;
      case 'box': this.updateBox(dt); break;
      case 'tossed': this.updateTossed(dt); break;
      case 'tuck': this.tuckT += dt; if (this.tuckT > TUCK_T) { this.mode = 'walk'; this.safe = .7; Bus.emit('tucked', this); } break;
      case 'trap': this.updateTrap(dt); break;
      case 'winter': this.winterT += dt; if (this.winterT >= WINTER_T && !this.flags.wintered) { this.flags.wintered = true; this.flags.returning = true; this.mode = 'dig'; Bus.emit('winterDone', this); } break;
      case 'brood': this.broodT += dt; this.eggs = clamp(.3 + this.broodT / BROOD_T * .7, 0, 1); if (this.broodT >= BROOD_T && !this.flags.broodDone) { this.flags.broodDone = true; this.mode = 'walk'; this.y = this.S.walkTop(this.x, 6) - this.feet; Bus.emit('broodDone', this); } break;
      case 'release': this.updateRelease(dt); break;
    }
    /* growth: a full young lobster must hide and moult */
    if (this.instar < 4 && this.cfood >= this.lobTh && !this.full) { this.full = true; Bus.emit('fullLob', this); }
    if (this.mode === 'walk') this.sniff(dt);
    if (this.flags.migrating && !this.flags.arrivedDeep && this.x < WORLD.deepR - 300 && this.mode === 'walk') { this.flags.arrivedDeep = true; Bus.emit('arrivedDeep', this); }
    if (this.flags.returning && !this.flags.home && this.x > WORLD.cobbleL + 150 && this.mode === 'walk') { this.flags.home = true; Bus.emit('homeAgain', this); }
    if (this.flags.migrating && !this.flags.arrivedDeep && this.x < WORLD.kelpL && this.x > WORLD.cobbleL - 100 && !this.flags.kelpSeen && this.mode === 'walk') { this.flags.kelpSeen = true; }
    this.stats.walked = Math.max(this.stats.walked, this.flags.migrating && !this.flags.arrivedDeep ? (this.flags.walkFrom || this.x) - this.x : 0);
  }
  /* the hiding meter: out in the open by day it drains (fast when the shell is soft, faster still for a small one);
     under a cobble, in a den, or at night it holds; kelp is half cover */
  updateSafe(dt) {
    const W = this.W, D = this.D, G = this.G;
    const shade = this.underground || ['brood', 'winter', 'trap'].includes(this.mode) ? 'den' : W.shadeAt(this.x, this.y + this.feet - 1, this.w);
    const day = 1 - nightAmount(G.tod), small = this.instar <= 1 ? 1.7 : this.instar <= 3 ? 1.2 : 1, soft = this.soft ? 2.4 : 1;
    let rate = 0;
    if (shade === 'open') rate = -.016 * D.risk * small * soft * (day + .12 * (this.soft ? 2 : 1)) * (1 - W.weather.cloud * .3);
    else if (shade === 'kelp') rate = -.006 * D.risk * small * soft * (day + .08);
    else rate = .03;
    if (W.hunters.length && shade !== 'den' && shade !== 'shelter') rate -= .012 * D.risk;
    if (this.mode === 'tuck') rate = .04;
    this.safe = clamp(this.safe + rate * dt, 0, 1);
    if (shade === 'shelter' && this.shade !== 'shelter' && this.safe < .7) { this.stats.shelters++; Bus.emit('shaded', this); }
    this.shade = shade;
    if (this.safe < .25 && !this.flags.hideSaid && this.mode === 'walk') { this.flags.hideSaid = true; Bus.emit('exposed', this); }
    if (this.safe > .55) this.flags.hideSaid = false;
    if (this.safe <= 0 && this.mode === 'walk' && this.busy <= 0 && this.flipT <= 0) { this.mode = 'tuck'; this.tuckT = 0; this.target = null; Bus.emit('tuckIn', this); }
  }
  updateWalk(dt) {
    const S = this.S, W = this.W, inp = this.input, w = this.w;
    /* a tail flip in progress: shoot backwards, then settle back on the floor */
    if (this.flipT > 0) {
      this.flipT -= dt; this.vy += 320 * dt; this.vx *= Math.exp(-dt * 2.2);
      this.x = clamp(this.x + this.vx * dt, WORLD.gridL + 40, WORLD.walkR); this.y += this.vy * dt;
      const top = S.walkTop(this.x, Math.max(4, w * .2)) - this.feet;
      if (this.y > top) { this.y = top; this.vy = 0; if (this.flipT < .25) this.flipT = 0; }
      if (this.y < W.seaLevel() + w * .3) this.y = W.seaLevel() + w * .3;
      this.moving = false; return;
    }
    if (inp.actionPressed) { if (this.act()) return; }
    if (inp.eggPressed) this.flip();
    const slope = S.slopeAt(this.x, Math.max(4, w * .2));
    const sp = (18 + w * .95) * (this.G.settings.slowmo ? .7 : 1) * (this.flags.migrating ? 1.15 : 1) * (this.soft ? .7 : 1);
    if (Math.abs(inp.x) > .15) {
      const dx = inp.x * sp * dt / (1 + Math.abs(slope) * 1.1);
      const nx = clamp(this.x + dx, WORLD.gridL + 40, WORLD.walkR);
      if (nx >= WORLD.walkR - 1 && dx > 0) this.say('cold');
      this.x = nx; this.walk += dt * 13 * Math.abs(inp.x); this.moving = true; this.face = sign(inp.x);
    } else this.moving = false;
    if (this.flags.migrating && !this.flags.arrivedDeep && this.moving && inp.x < 0) this.flags.walkFrom = Math.max(this.flags.walkFrom || 0, this.x);
    this.y = S.walkTop(this.x, Math.max(4, w * .2)) - this.feet;
    this.ang = angleLerp(this.ang, clamp(Math.atan(slope), -1, 1) * .7, clamp(dt * 8, 0, 1));
    if (inp.y > .6 && !this._downHeld) this.tryDig();
    this._downHeld = inp.y > .6;
  }
  /* E on the bottom: snap the tail and shoot backwards, out of reach */
  flip() {
    if (this.flipCool > 0 || this.mode !== 'walk' || this.busy > 0) return false;
    this.flipT = FLIP_T; this.flipCool = 1.1; this.lastFlipT = this.t; this.vx = -this.face * 170; this.vy = -70; this.target = null; this.stats.flips++;
    this.G.particles.bubbles(this.x, this.y, 8, 1.5); AudioFX.dash && AudioFX.dash();
    Bus.emit('flipped', this);
    return true;
  }
  /* push down: into an open den, or dig a new one in soft ground */
  tryDig() {
    const S = this.S, foot = this.y + this.feet;
    const hole = S.topAt(this.x) - S.walkTop(this.x, Math.max(4, this.w * .2)) > this.w * .3;
    const softAt = (x) => { for (let y = foot - 4; y < foot + 16; y += 3) { const m = S.matAt(x, y); if (m !== MAT.AIR) return S.diggable(m); } return false; };
    let dx = null;
    for (const o of [0, -4, 4, -8, 8, -this.w * .2, this.w * .2]) if (softAt(this.x + o)) { dx = o; break; }
    if (!hole && dx === null) { this.say('rock'); return; }
    if (!hole) this.x += dx;
    this.mode = 'dig'; this.ang = Math.PI / 2; this.target = null;
    if (!this.den || Math.abs(this.den.x - this.x) > 40) {
      this.den = { x: this.x, y: S.surfaceAt(this.x) };
      this.stats.dens++;
    }
    /* a den dug back home on the cobble bed (a boy's) or out in the deep mud (for winter) */
    if (this.flags.home && this.x > WORLD.cobbleL && this.x < WORLD.cobbleR) this.flags.siteDen = true;
    if (this.flags.arrivedDeep && !this.flags.wintered && this.x < WORLD.deepR) this.flags.winterDen = true;
    this.y += 2;
    Bus.emit('digStart', this);
  }
  updateDig(dt) {
    const S = this.S, inp = this.input, D = this.D;
    if (inp.actionPressed) { if (this.act()) return; }
    let mx = inp.x, my = inp.y; const m = Math.hypot(mx, my);
    if (m < .1) { this.moving = false; this.checkDepth(); return; }
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 7, 0, 1));
    if (Math.abs(mx) > .3) this.face = sign(mx);
    /* a den is always at least three cells wide, so you can see it in the sand */
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang), rad = Math.max(10, this.w * .34 + 2);
    const step = (16 + this.w * .3) * dt;
    const nx = this.x + dx * step, ny = this.y + dy * step;
    this.moving = true; this.walk += dt * 10;
    if (S.free(nx, ny, rad * .66, false)) { this.x = nx; this.y = ny; }
    else {
      const hx = this.x + dx * rad * .55, hy = this.y + dy * rad * .55;
      const res = S.dig(hx, hy, rad * 1.08 + 1, D.dig * (1.1 + this.instar * .35), dt, { gravel: this.instar >= 3 });
      this.digClock -= dt;
      if (res.cells) {
        this.stats.dug += res.cells;
        if (this.digClock <= 0) { this.digClock = .12; AudioFX.dig && AudioFX.dig(); this.G.particles.dust(hx, hy, S.matAt(hx, hy) === MAT.MUD ? '#6a6050' : '#c8b088', 3, this.ang); }
        if (S.free(this.x + dx * 1.2, this.y + dy * 1.2, rad * .66, false)) { this.x += dx * 1.2; this.y += dy * 1.2; }
      } else if (res.blocked) {
        if (dy < -.3 && S.survey(this.x, this.y - rad, rad * 1.2).sky > 0) { this.surface(); return; }
        this.say('rock');
        if (dy < -.3 && this.den && Math.abs(this.den.x - this.x) > 2) { const sx = sign(this.den.x - this.x); if (S.free(this.x + sx * step, this.y, rad * .66, false)) this.x += sx * step; else this.slide(dx, dy, step, rad); }
        else this.slide(dx, dy, step, rad);
      }
    }
    if (this.depth < -this.feet * .4 && dy < .2) { this.surface(); return; }
    if (this.depth > Math.max(60, this.w * 1.4)) this.y -= 1;
    this.checkDepth();
  }
  slide(dx, dy, step, r) {
    for (const s of [1, -1]) { const a = this.ang + s * 1.1, nx = this.x + Math.cos(a) * step * .6, ny = this.y + Math.sin(a) * step * .6; if (this.S.free(nx, ny, r * .66, false)) { this.x = nx; this.y = ny; return true; } }
    return false;
  }
  /* a dug den is a shelter once it is deep, or has a stone over it */
  get dugShelter() { const rad = Math.max(10, this.w * .34 + 2); return this.mode === 'dig' && (this.depth > this.w * .6 + 3 || (this.depth > this.feet * 1.2 && this.S.roofAt(this.x, this.y, rad))); }
  checkDepth() {
    const rad = Math.max(10, this.w * .34 + 2);
    const deep = this.depth > this.w * .6 + 3, roofed = this.depth > this.feet * 1.2 && this.S.roofAt(this.x, this.y, rad);
    if ((deep || roofed) && !this.flags.deepNow) { this.flags.deepNow = true; Bus.emit('deepEnough', this); }
    if (!deep && !roofed) this.flags.deepNow = false;
    if (deep && !roofed && this.full && this.instar < 4 && !this.flags.coverSaid) { this.flags.coverSaid = true; Bus.emit('noRoof', this); }
    if (this.flags.home && this.sex === 'boy' && (this.depth > Math.min(this.w * .6 + 3, 24) || roofed) && this.flags.siteDen && !this.flags.denDug) { this.flags.denDug = true; Bus.emit('siteDug', this); }
    if (this.flags.arrivedDeep && !this.flags.wintered && this.flags.winterDen && deep && this.mode === 'dig' && !this.flags.winterStarted) { this.flags.winterStarted = true; this.mode = 'winter'; this.winterT = 0; Bus.emit('winterStart', this); }
  }
  surface() {
    const S = this.S;
    this.mode = 'walk'; this.ang = 0; this.y = S.walkTop(this.x, Math.max(4, this.w * .2)) - this.feet;
    this.G.particles.dust(this.x, this.y + this.feet, '#c8b088', 8, -Math.PI / 2);
    Bus.emit('surfaced', this);
  }
  /* no food for a while: an arrow points to the nearest (a lobster smells food from far away) */
  sniff(dt) {
    if (this.instar <= 1 || this.full || this.flags.migrating && !this.flags.home || this.flags.broodDone) { this.foodHint = null; return; }
    this.hungryT += dt; this.sniffClock -= dt;
    if (this.hungryT < 8 || this.sniffClock > 0) return;
    this.sniffClock = 1.5;
    let best = null, bd = 1e9;
    for (const it of this.W.items) { if (it.bites <= 0 || it.fy !== null || it.kind === 'drift') continue; const d = Math.abs(it.x - this.x); if (d < bd) { bd = d; best = it; } }
    if (best && !this.foodHint) Bus.emit('hint', 'sniff');
    this.foodHint = best ? { x: best.x, y: best.y } : null;
  }

  /* ---------- moulting in a hole or a den ---------- */
  moultReady() { return this.stage === 'lobster' && this.full && this.instar < 4 && ((this.mode === 'walk' && this.shade === 'shelter') || this.dugShelter); }
  startMoult() {
    this.mode = 'moult'; this.molting = MOLT_T; this.target = null; this.flags.sealing = true;
    Bus.emit('molting', this);
  }
  finishMolt() {
    this.W.exuviae.push({ x: this.x - this.face * this.w * .35, y: this.y + this.feet * .2, s: this.w / 100, form: this.form, eaten: false, t: 0 });
    this.instar = Math.min(4, this.instar + 1); this.stats.molts++; this.full = false; this.flags.sealing = false;
    this.cm = lobCM(this.instar, this.cfood, this.D.lob);
    /* the claws are decided at the moult after the shelter years: the one used more becomes the crusher */
    if (this.instar === 3 && !this.crusher) { this.crusher = this.lead || 'right'; Bus.emit('crusher', this); }
    this.pale = 1; this.hardT = 0; this.mode = 'harden';
    if (this.flags.herMoult) { this.flags.herMoultDone = true; this.cfood = Math.min(this.cfood + this.D.lob[2] * .1, this.D.lob[2] * BONUS); }
    Bus.emit('lobMolted', this, this.instar);
    Bus.emit('exuviaReady', this);
  }

  /* ---------- what Space does right now ---------- */
  reach() { return this.w * .45 + 12; }
  context() {
    const W = this.W;
    if (this.stage === 'egg') return null;
    if (this.swimming) {
      if (this.stage === 'postlarva' && this.tumble <= 0) { const sh = W.shelterAt(this.x, this.y, 8); if (sh && sh.kind === 'hollow' && !sh.taken && this.y > this.S.walkTop(this.x, 6) - 24) return 'settle'; }
      return null;
    }
    if (this.busy > 0 || this.flipT > 0) return null;
    if (this.mode === 'dig' || this.mode === 'harden') { if (this.mode === 'dig' && this.moultReady()) return 'moult'; return this.W.exuviaNear(this.x, this.y + this.feet, this.reach()) ? 'shell' : null; }
    if (this.mode !== 'walk') return null;
    const R = this.reach();
    if (this.moultReady()) return 'moult';
    if (this.flags.broodDone && !this.flags.released && this.sex === 'girl' && nightAmount(this.G.tod) > .5) return 'fan';
    const riv = W.rival(); if (riv && riv.mode === 'stand' && Math.abs(riv.x - this.x) < R + riv.w * .4 + 10) return 'box';
    if (this.sex === 'boy') { const f = W.female(); if (f && f.mode === 'stand' && !this.flags.met && Math.abs(f.x - this.x) < R + f.w * .4 + 14) return 'meet'; }
    else if (this.flags.home && !this.flags.met) { const h = W.hosts().find(n => Math.abs(n.x - this.x) < R + n.w * .4 + 14); if (h) return 'meet'; }
    if (W.trapMouthNear(this.x, this.y) && !this.flags.trapped && this.instar <= 3) return 'bait';
    if (W.exuviaNear(this.x, this.y + this.feet, R)) return 'shell';
    if (W.foodNear(this.x, this.y + this.feet, R)) return 'eat';
    return null;
  }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    if (v === 'settle') { const sh = W.shelterAt(this.x, this.y, 8); this.milestone('settle', () => this.settle(sh)); }
    else if (v === 'eat') { const it = W.foodNear(this.x, this.y + this.feet, this.reach()); this.face = sign(it.x - this.x) || this.face; this.startBusy('eat', 1.1, it); }
    else if (v === 'shell') { const e = W.exuviaNear(this.x, this.y + this.feet, this.reach()); this.face = sign(e.x - this.x) || this.face; this.startBusy('shell', 1.6, e); }
    else if (v === 'bait') { this.startBusy('bait', 2.2, W.trap); }
    else if (v === 'box') this.startBox(W.rival());
    else if (v === 'meet') { const o = this.sex === 'boy' ? W.female() : W.hosts().find(n => Math.abs(n.x - this.x) < this.reach() + n.w * .4 + 14); this.face = sign(o.x - this.x) || this.face; this.startBusy('meet', 2.2, o); }
    else if (v === 'moult') this.startMoult();
    else if (v === 'fan') this.startRelease();
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; this.target = null; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy;
    this.busy -= dt;
    if (k === 'eat' || k === 'shell' || k === 'bait') { this.eatAnim = t0; this.pinch = .5; if (Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.munch && AudioFX.munch(); const px = k === 'bait' ? this.x + this.face * 10 : o.x; this.G.particles.puff(px, (k === 'bait' ? this.y : o.y) - 2, k === 'shell' ? '#ffe8d0' : o.kind === 'urchin' ? '#9ac86a' : o.kind === 'kelp' ? '#8a9a3a' : '#c8d8f0', 2); } }
    if (k === 'meet' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - this.w * .3 - 10, '♥', '#ff7aa8', 14);
    if (this.busy > 0) return;
    this.busy = 0; this.eatAnim = 0;
    if (k === 'eat' && o.bites > 0) {
      o.bites--; const F = FOOD_KINDS[o.kind];
      this.cfood = Math.min(this.cfood + F.food / F.bites, this.lobTh); this.stats.food++;
      const sk = { mussel: 'mussels', crab: 'crabs', urchin: 'urchins', snail: 'snails', kelp: 'kelp', drift: 'drifters', bait: 'food' }[o.kind]; if (sk) this.stats[sk]++;
      if (F.shellfood && this.instar <= 2 && !this.crusher) { this.stats.clawUse++; const side = this.face >= 0 ? 'clawR' : 'clawL'; this.flags[side] = (this.flags[side] || 0) + 1; this.lead = (this.flags.clawR || 0) >= (this.flags.clawL || 0) ? 'right' : 'left'; if (this.instar === 2 && !this.flags.clawAsked) { this.flags.clawAsked = true; Bus.emit('clawChoice', this); } }
      this.hungryT = 0; this.foodHint = null;
      if (!this.flags.ateBottom) { this.flags.ateBottom = true; Bus.emit('firstFood', this, o); }
      Bus.emit('ateFood', this, o);
    }
    if (k === 'shell' && !o.eaten) { o.eaten = true; this.stats.shells++; this.hardT = Math.min(HARDEN_T, this.hardT + 2); this.cfood = Math.min(this.cfood + 4, this.lobTh); Bus.emit('ateShell', this); }
    if (k === 'bait') { const T = this.W.trap; T.bait = 0; this.cfood = Math.min(this.cfood + FOOD_KINDS.bait.food, this.lobTh); this.stats.food++; this.startTrapRide(); }
    if (k === 'meet') { this.flags.met = true; Bus.emit('met', this, o); }
  }

  /* ---------- the lobsterman's trap: hauled up, measured, put back ---------- */
  startTrapRide() {
    const T = this.W.trap; T.holding = true; T.state = 'haul'; T.t = 0; T.visited = true;
    this.mode = 'trap'; this.target = null; this.flags.trapped = true; this.stats.trapped++; this.trapT = 0;
    Bus.emit('trapped', this);
  }
  updateTrap(dt) {
    const T = this.W.trap; this.trapT += dt;
    this.x = T.x; this.y = T.y - 9; this.moving = false; this.up = T.state === 'up' ? .6 : 0;
    if (T.state === 'up' && !this.flags.measured && T.t > 1.5) { this.flags.measured = true; Bus.emit('measured', this); }
    if (T.state === 'set' || T.state === 'gone' || T.state === 'away') { this.mode = 'walk'; this.y = this.S.walkTop(this.x, 6) - this.feet; T.holding = false; Bus.emit('putBack', this); }
  }

  /* ---------- boxing contests over a den ----------
     Tap Space to push.  A ring shrinks round and round: press E (or up)
     while it is green for a BIG HEAVE.  Push him back and he backs off,
     flips away and leaves, unhurt. */
  startBox(r) {
    if (!r) return;
    this.mode = 'box'; this.target = null;
    this.face = sign(r.x - this.x) || 1; r.face = -this.face; r.mode = 'box';
    const gap = (this.w + r.w) * .5, mid = (this.x + r.x) / 2;
    this.wr = { rival: r, p: 0, ring: 0, t: 0, done: null, doneT: 0, mid, gap, flash: 0, taps: 0, shoves: 0 };
    Bus.emit('box', this, r);
  }
  boxWindow() { const w = this.wr; if (!w) return false; const u = (w.ring % 1.8) / 1.8; const wide = this.G.settings.difficulty === 'easy' ? .3 : this.G.settings.difficulty === 'hard' ? .14 : .2; return u > .9 - wide && u < .93; }
  updateBox(dt) {
    const w = this.wr, R = w.rival, inp = this.input, D = this.D, S = this.S;
    w.t += dt; w.flash = Math.max(0, w.flash - dt * 3);
    if (w.done) {
      w.doneT += dt;
      if (w.done === 'win') { this.upT = .5; if (w.doneT > .5 && R.mode === 'box') { R.mode = 'tossed'; R.vx = this.face * 170; R.vy = -90; AudioFX.toss && AudioFX.toss(); } if (w.doneT > 1.1) this.endBox(); }
      else if (w.doneT > .4 && this.mode === 'box') { this.mode = 'tossed'; this.vx = -this.face * 150; this.vy = -80; this.spin = 0; R.mode = 'stand'; R.leaveIn = 16; AudioFX.toss && AudioFX.toss(); }
      return;
    }
    const str = 1 + (this.cm - 9) / 3.5 + this.safe * .2;
    const rStr = D.rival * Math.pow(R.cm / this.cm, 1.4);
    w.ring += dt;
    if (inp.actionPressed) { w.p += .06 * str; w.taps++; this.pinch = .6; AudioFX.clack && AudioFX.clack(); this.G.particles.dust(w.mid, this.y + this.feet, '#c8b088', 2); }
    const big = inp.eggPressed || (inp.y < -.6 && !this._upHeld);
    this._upHeld = inp.y < -.6;
    if (big) {
      if (this.boxWindow()) { w.p += .26 * str; w.flash = 1; w.shoves++; this.upT = .4; AudioFX.heave && AudioFX.heave(); this.G.particles.sparkle(w.mid, this.y - 10, 12, '#fff3b0', 16); }
      else w.p -= .05;
    }
    w.p -= rStr * .17 * dt * (1 + Math.sin(w.t * 1.7) * .4);
    w.p = clamp(w.p, -1, 1);
    const shove = w.p * 16;
    this.x = w.mid - this.face * w.gap + this.face * shove; R.x = w.mid + this.face * w.gap + this.face * shove;
    this.y = S.walkTop(this.x, 6) - this.feet; R.y = S.walkTop(R.x, 6) - R.feet;
    this.walk += dt * 8 * (1 + Math.abs(w.p)); this.moving = true; this.up = .7 + Math.sin(w.t * 9) * .2; R.walk = this.walk;
    if (w.p >= 1) { w.done = 'win'; this.stats.wins++; if (this.stats.wins >= D.wins) this.flags.boss = true; Bus.emit('boxWon', this, R); }
    else if (w.p <= -1) { w.done = 'lose'; this.stats.losses++; Bus.emit('boxLost', this, R); }
  }
  endBox() { const w = this.wr; this.wr = null; this.mode = 'walk'; this.moving = false; if (w && w.done === 'win' && this.flags.boss && !this.flags.bossSeen) { this.flags.bossSeen = true; Bus.emit('boss', this); } }
  /* pushed back (or knocked by a hunter): a tumble, then back on your feet */
  updateTossed(dt) {
    const S = this.S;
    this.vy += 320 * dt; this.vx *= Math.exp(-dt * 1.2);
    this.x = clamp(this.x + this.vx * dt, WORLD.gridL + 40, WORLD.walkR); this.y += this.vy * dt; this.spin += dt * 7 * (this.vx >= 0 ? 1 : -1);
    const top = S.walkTop(this.x, Math.max(4, this.w * .2)) - this.feet;
    if (this.y >= top && this.vy > 0) { this.y = top; this.mode = 'walk'; this.spin = 0; this.vx = this.vy = 0; const pushed = !!this.wr; this.wr = null; Bus.emit(pushed ? 'tossedDown' : 'knockedDown', this); }
  }
  /* a hunter lunges: it always misses.  Hidden, tucked in, or a tail flip just in time: it never even comes close */
  struck(h) {
    if (this.stage !== 'lobster') return;
    const hiddenMode = ['tuck', 'dig', 'harden', 'brood', 'winter', 'trap', 'moult'].includes(this.mode) || this.hidden;
    if (hiddenMode || this.flipT > 0 || this.t - (this.lastFlipT === undefined ? -99 : this.lastFlipT) < 1.4 || Math.abs(h.x - this.x) > 90) { this.stats.dodges++; Bus.emit('dodged', this); }
    else this.knock(h.dir);
  }
  knock(dir) { if (this.mode !== 'walk' || this.busy > 0) return; this.mode = 'tossed'; this.vx = dir * 70; this.vy = -90; this.spin = 0; this.stats.tumbles++; this.target = null; Bus.emit('missed', this); }

  /* ---------- the girl: a moult in his den, the eggs, and the larvae ---------- */
  startHerMoult(door) {
    const S = this.S;
    this.x = door.x; this.y = door.y + this.w * .6; this.target = null;
    for (let y = door.y; y <= this.y; y += 3) S.blob(this.x, y, Math.max(9, this.w * .28), Math.max(7, this.w * .2), MAT.AIR, (m) => m !== MAT.AIR);
    S.blob(this.x, this.y, this.w * .5, this.w * .3, MAT.AIR, (m) => m !== MAT.AIR); S.flushTop();
    this.den = { x: door.x, y: door.y };
    this.flags.herMoult = true; this.full = true;
    this.mode = 'dig';
    this.startMoult();
    Bus.emit('herMoult', this);
  }
  startBrood() {
    this.mode = 'brood'; this.broodT = 0; this.eggs = .3; this.target = null; this.flags.broodStarted = true;
    Bus.emit('brooding', this);
  }
  startRelease() { this.mode = 'release'; this.rel = { good: 0, miss: 0, t: 0, flash: 0, lastWave: -1 }; this.target = null; Bus.emit('release', this); }
  releaseWindow() { return this.W.swash() > .62; }
  updateRelease(dt) {
    const r = this.rel, W = this.W, D = this.D;
    r.t += dt; r.flash = Math.max(0, r.flash - dt * 2);
    const wave = Math.floor(W.t / 5.6);
    this.up = .3; this.fan = (this.fan || 0) + dt;
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.releaseGate) {
      if (this.releaseWindow() && r.lastWave !== wave) {
        r.lastWave = wave; r.good++; r.flash = 1; this.stats.fans++;
        const n = Math.round(10000 / D.fans); this.stats.larvaeOut += n;
        this.eggs = Math.max(0, 1 - r.good / D.fans);
        W.larvaBurst(this.x - this.face * this.w * .2, this.y + this.feet * .4, 50);
        this.G.particles.sparkle(this.x - 10, this.y, 18, '#bfefff', 24);
        AudioFX.splash && AudioFX.splash(); Bus.emit('fan', this, r.good);
        if (r.good >= D.fans && !this.flags.releaseGate) { this.flags.releaseGate = true; this.milestone('larvae', () => { this.flags.released = true; this.mode = 'walk'; Bus.emit('larvaeReleased', this); }); }
      } else if (r.lastWave !== wave) { r.miss++; this.say('release'); }
    }
  }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'stage', 'mode', 'x', 'y', 'face', 'eggT', 'food', 'zinstar', 'cfood', 'instar', 'full', 'safe', 'hardT', 'pale', 'den', 'broodT', 'winterT', 'eggs', 'crusher', 'lead', 'stats', 'flags']) o[k] = this[k];
    o.home = this.home ? +this.home.x.toFixed(1) : null;
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    if (['egg', 'larva', 'postlarva', 'lobster'].includes(o.stage)) this.stage = o.stage;
    const modes = { egg: ['egg'], larva: ['swim'], postlarva: ['swim'], lobster: ['walk', 'dig', 'harden', 'brood', 'winter'] }[this.stage];
    this.mode = modes.includes(o.mode) ? o.mode : modes[0];
    const midMoult = o.mode === 'moult';
    if (midMoult) this.mode = 'harden';
    this.x = clamp(num(o.x, this.x), WORLD.left + 80, WORLD.walkR); this.y = clamp(num(o.y, this.y), WORLD.top + 100, 700);
    this.face = o.face === -1 ? -1 : 1;
    this.eggT = num(o.eggT, 0); this.food = Math.max(0, num(o.food, 0)); this.zinstar = clamp(Math.round(num(o.zinstar, 1)), 1, 3);
    this.cfood = Math.max(0, num(o.cfood, 0)); this.instar = clamp(Math.round(num(o.instar, 1)), 1, 4); this.full = !!o.full;
    this.safe = clamp(num(o.safe, 1), 0, 1); this.hardT = clamp(num(o.hardT, HARDEN_T), 0, HARDEN_T); this.pale = clamp(num(o.pale, 0), 0, 1);
    this.den = o.den && Number.isFinite(o.den.x) && Number.isFinite(o.den.y) ? { x: o.den.x, y: o.den.y } : null;
    this.broodT = Math.max(0, num(o.broodT, 0)); this.winterT = Math.max(0, num(o.winterT, 0)); this.eggs = clamp(num(o.eggs, 0), 0, 1);
    this.crusher = ['left', 'right'].includes(o.crusher) ? o.crusher : null; this.lead = ['left', 'right'].includes(o.lead) ? o.lead : null;
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    /* a gated step that was waiting when the game closed starts again by itself */
    for (const k of ['hatching', 'zm1', 'zm2', 'zm3', 'sealing', 'releaseGate', 'hideSaid', 'deepNow', 'hardening', 'larvaeAtSea', 'forageGate', 'winterStarted', 'clawAsked']) delete this.flags[k];
    if (this.flags.winterDen && this.mode === 'winter') this.flags.winterStarted = true;
    if (this.stats.wins >= this.D.wins) this.flags.boss = true;
    if (midMoult && this.stage === 'lobster' && this.instar < 4) { this.instar++; this.stats.molts++; this.full = false; this.hardT = 0; this.pale = 1; if (this.instar === 3 && !this.crusher) this.crusher = this.lead || 'right'; }
    if (this.instar >= 3 && !this.crusher) this.crusher = this.lead || 'right';
    this.cm = this.stage === 'lobster' ? lobCM(this.instar, this.cfood, this.D.lob) : .5;
    if (this.stage === 'lobster') {
      const S = this.S;
      if (Number.isFinite(o.home)) { const sh = this.W.shelters.find(s => Math.abs(s.x - o.home) < 2); if (sh) { this.home = sh; sh.taken = true; sh.mine = true; } }
      if (this.mode === 'walk') this.y = S.walkTop(this.x, Math.max(4, this.w * .2)) - this.feet;
      else if (!S.free(this.x, this.y, this.w * .2, false)) { S.blob(this.x, this.y, this.w * .4, this.w * .3, MAT.AIR, (m) => S.diggable(m) || m === MAT.GRAVEL); S.flushTop(); }
    }
    if (this.swimming) this.W.drift = this.stage === 'postlarva' ? 1 : -1;
  }
}
