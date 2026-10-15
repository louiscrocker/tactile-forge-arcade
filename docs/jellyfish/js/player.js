/* ============================================================
   player.js — you, the moon jelly, from a baby on your mother's
   arm to the next generation
   ============================================================
   stage  egg       a tiny baby in a brood pouch on your mother's
                    frilly arm: wiggle free when she lets you go
          planula   a tiny hairy oval swimmer (mode swim): it does
                    not eat; find a free shady spot under a rock
                    ledge or the dock and stick on, upside down
          polyp     hanging from your spot: lean and stretch to
                    catch the food drifting by in your tentacles
                    (4, then 8, then 16), fold it into your mouth,
                    bud clones of yourself; when winter comes you
                    grow into a stack of discs (mode strobila) and
                    pulse on the swell to pop free (mode pop)
          ephyra    a baby jellyfish, a little eight-armed star:
                    hold an arrow and it pulses that way; bump into
                    plankton to eat; the arms fill in
          medusa    a young moon jelly, then a grown one with four
                    rings: plankton sticks to your bell, lick it off
                    with your arms; ride the current to the summer
                    bloom; a boy lets a little cloud go by a girl,
                    a girl catches a boy's cloud, keeps her babies
                    in pouches on her arms (mode brood) and lets
                    them go on the swell (mode release)
   Nothing hurts the jelly, ever: a turtle, a sunfish, a fish or a
   bird always misses and you tumble away; the sea slug crawls past.
   ============================================================ */
'use strict';

const STROB_T = 12, BROOD_T = 22, BUD_T = 2.2, LICK_T = 1.1, EAT_T = .9, MEET_T = 2.2;

class Jelly {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'pink';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.mumX; this.y = 80; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.phase = 0;
    this.pulseT = 0; this.pulse = 0; this.spin = 0; this.tumble = 0; this.dashCool = 0; this.lastDashT = -99; this.grow = 0;
    this.site = null; this.lean = 0; this.stretch = .6; this.pinst = 1; this.pfood = 0; this.caught = []; this.buds = 0; this.wobble = 0;
    this.strobT = 0; this.rel = null;
    this.efood = 0; this.einst = 1;
    this.mfood = 0; this.minst = 1; this.stuck = 0; this.stuckVal = 0;
    this.eggs = 0; this.broodT = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.hintClock = 0; this.target = null; this.homeHint = null; this.lastSite = null;
    this.stats = { plankton: 0, copepods: 0, glow: 0, pulses: 0, dashes: 0, catches: 0, polypMeals: 0, buds: 0, pops: 0, licks: 0, stuckMax: 0, dodges: 0, tumbles: 0, taken: 0, ride: 0, slugs: 0, sparkles: 0, fans: 0, planulaeOut: 0, bloomTime: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get swimming() { return this.stage === 'planula' || this.stage === 'ephyra' || this.stage === 'medusa'; }
  get jelly() { return this.stage === 'ephyra' || this.stage === 'medusa'; }
  get cm() { return jellyCM(this); }
  /* the drawn bell radius (or a body radius for the small ones) */
  get r() {
    if (this.stage === 'egg') return 1.2;
    if (this.stage === 'planula') return 1.8;
    if (this.stage === 'polyp') return 5;
    return bellUnits(this.cm);
  }
  /* the polyp: how many tentacles, its length, where its mouth and tentacles are */
  get tentacles() { return [4, 4, 8, 16][this.pinst]; }
  get polypLen() { return 9 + this.pinst * 2.5 + this.stretch * 7; }
  get reachR() { return 5 + this.pinst * 2.6 + this.stretch * 3; }
  get tipX() { return this.site ? this.site.x + Math.sin(this.lean * .75) * this.polypLen : this.x; }
  get tipY() { return this.site ? this.site.y + Math.cos(this.lean * .75) * this.polypLen : this.y; }
  get stuckCap() { return 8 + this.minst * 4; }
  stageKey() {
    if (this.stage === 'egg' || this.stage === 'planula') return 'planula';
    if (this.stage === 'polyp') return this.mode === 'polyp' ? 'polyp' : 'strobila';
    if (this.stage === 'ephyra') return 'ephyra';
    if (this.minst < 2) return 'medusa';
    return this.flags.bloomFound ? 'bloom' : 'adult';
  }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.dashCool -= dt;
    this.grow = Math.max(0, this.grow - dt);
    this.wobble = Math.max(0, this.wobble - dt);
    if (this.target) this.steerToTarget();
    switch (this.stage) {
      case 'egg': this.updateEgg(dt); break;
      case 'planula': this.updatePlanula(dt); break;
      case 'polyp': this.updatePolyp(dt); break;
      case 'ephyra': case 'medusa': this.updateJelly(dt); break;
    }
    this.input.actionPressed = false; this.input.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target;
    if (this.stage === 'polyp') { this.input.x = clamp((T.x - this.site.x) / 30, -1, 1); this.input.y = clamp((T.y - this.tipY) / 20, -1, 1); if (Math.abs(T.x - this.tipX) < 4) this.target = null; return; }
    const dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (d < Math.max(4, this.r * 1.2)) { this.target = null; return; }
    this.input.x = dx / d; this.input.y = dy / d;
  }
  goTo(x, y) { if (this.stage === 'egg' || ['strobila', 'pop', 'brood', 'release'].includes(this.mode) || this.busy > 0) return; this.target = { x, y }; }

  /* ---------- a baby in the brood pouch on Mum's arm ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    const m = this.W.mum;
    if (m) { const sw = Math.sin(m.ph * 1.3) * 3; this.x = m.x + 6 + sw; this.y = m.y + m.r * 1.5 + Math.cos(m.ph) * 2; }
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    const W = this.W, m = W.mum;
    this.stage = 'planula'; this.mode = 'swim';
    this.vx = 4; this.vy = 12; this.ang = Math.PI;
    W.larvaBurst(this.x, this.y, 50);
    if (m) m.eggs = .4;
    Bus.emit('hatched', this);
  }

  /* ============================================================
     THE PLANULA: swim on your hairs, find a free spot, stick on
     ============================================================ */
  updatePlanula(dt) {
    const W = this.W, inp = this.input;
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 14; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    if (inp.actionPressed) this.act();
    if (inp.eggPressed && this.dashCool <= 0) { const m = Math.hypot(inp.x, inp.y) || 1; this.vx += (inp.x / m || 0) * 36; this.vy += (inp.y / m || 0) * 36; this.dashCool = .9; this.stats.dashes++; this.lastDashT = this.t; Bus.emit('dash', this); }
    this.vx += inp.x * 70 * dt; this.vy += inp.y * 70 * dt; this.vy += 2 * dt;
    this.vx *= Math.exp(-dt * 2.6); this.vy *= Math.exp(-dt * 2.6);
    const sp = Math.hypot(this.vx, this.vy), cap = this.dashCool > .5 ? 34 : 17;
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    if (sp > 2) this.ang = angleLerp(this.ang, Math.atan2(this.vx, -this.vy), clamp(dt * 5, 0, 1));
    this.drift(dt, .7);
    this.moving = Math.hypot(inp.x, inp.y) > .1;
    /* where are the ledges? */
    const near = this.x > WORLD.reefL - 120 && this.x < WORLD.harbourR;
    this.homeHint = near && this.y > 120 ? null : this.nearestLedgeHint();
    if (near && this.y > 140 && !this.flags.overReef) { this.flags.overReef = true; Bus.emit('overReef', this); }
    const s = W.siteAt(this.x, this.y - 3, 12);
    if (s && this.y > s.y && this.y - s.y < 14 && s !== this.lastSite) {
      this.lastSite = s;
      if (s.taken || s.bud) { this.stats.taken++; this.say('taken'); Bus.emit('taken', this, s); }
      else if (!s.mine) this.say('settle');
    }
    if (!s) this.lastSite = null;
  }
  nearestLedgeHint() {
    let best = null, bd = 1e9;
    for (const s of this.W.sites) { if (s.taken || s.bud) continue; const d = Math.hypot(s.x - this.x, s.y - this.y); if (d < bd) { bd = d; best = s; } }
    return best ? { x: best.x, y: best.y + 14 } : null;
  }
  settle(site) {
    this.stage = 'polyp'; this.mode = 'polyp'; this.site = site; site.mine = true;
    this.pinst = 1; this.pfood = 0; this.stretch = .6; this.lean = 0; this.caught = [];
    this.x = site.x; this.y = site.y + 8; this.vx = this.vy = 0;
    this.G.particles.sparkle(this.x, this.y, 14, '#fff3c0', 10, .35);
    Bus.emit('settled', this, site);
  }

  /* ============================================================
     THE POLYP: catch, eat, grow tentacles, bud; in winter, the stack
     ============================================================ */
  updatePolyp(dt) {
    const inp = this.input, D = this.D;
    this.x = this.site.x; this.y = this.site.y + this.polypLen * .5;
    if (this.busy > 0) { this.updateBusy(dt); return; }
    if (this.mode === 'strobila') {
      this.strobT += dt;
      this.stretch += (.9 - this.stretch) * dt; this.lean += (0 - this.lean) * dt * 2;
      if (this.strobT >= STROB_T && !this.flags.stackDone) { this.flags.stackDone = true; this.milestone('strobila', () => { this.mode = 'pop'; this.rel = { good: 0, miss: 0, t: 0, flash: 0, lastWave: -1 }; Bus.emit('stack', this); }); }
      return;
    }
    if (this.mode === 'pop') { this.updatePop(dt); return; }
    if (inp.actionPressed && this.act()) return;
    /* lean with left and right; down stretches out, up pulls in tight */
    this.lean += (clamp(inp.x, -1, 1) - this.lean) * clamp(dt * 3, 0, 1);
    if (inp.y > .3) this.stretch = Math.min(1, this.stretch + dt * 1.6);
    else if (inp.y < -.3) this.stretch = Math.max(0, this.stretch - dt * 2.4);
    else this.stretch += (.6 - this.stretch) * dt * .4;
    if (inp.y < -.3 && !this.flags.pulledIn) { this.flags.pulledIn = true; Bus.emit('pulledIn', this); }
    /* food drifting by sticks to the tentacles (folded tentacles catch nothing) */
    if (this.stretch > .25 && this.caught.length < 3) {
      const tx = this.tipX, ty = this.tipY, R = this.reachR;
      for (const q of this.W.plankton) {
        if (q.eaten) continue;
        if (Math.hypot(q.x - tx, q.y - ty) < R + PLANKTON_KINDS[q.kind].r) {
          q.eaten = true; this.caught.push({ kind: q.kind, a: Math.random() * TAU }); this.stats.catches++;
          if (q.kind === 'copepod') this.stats.copepods++;
          AudioFX.blip && AudioFX.blip(1.2);
          Bus.emit('caught', this, q);
          if (this.caught.length >= 3) break;
        }
      }
    }
  }
  polypGrow() {
    const D = this.D;
    if (this.pinst === 1 && this.pfood >= D.polyp[0]) { this.pinst = 2; this.grow = 1; Bus.emit('tentacles', this, 8); }
    if (this.pinst === 2 && this.pfood >= D.polyp[1]) { this.pinst = 3; this.grow = 1; Bus.emit('tentacles', this, 16); }
    if (this.canBud() && !this.flags.fullSaid) { this.flags.fullSaid = true; Bus.emit('fullPolyp', this); }
  }
  canBud() { return this.stage === 'polyp' && this.mode === 'polyp' && this.pinst === 3 && this.pfood >= this.D.polyp[2] && this.buds < this.D.buds; }
  /* the sea slug comes past: pulled in tight it never even touches; stretched out, a little wobble */
  slugPass(s) {
    this.stats.slugs++;
    if (this.stretch < .3 || this.mode !== 'polyp') { Bus.emit('slugPast', this, true); return; }
    this.wobble = 1.4; this.caught.length = 0;
    Bus.emit('slugBump', this); Bus.emit('slugPast', this, false);
  }
  startStrobila() {
    if (this.mode !== 'polyp') return;
    this.busy = 0; this.caught.length = 0;
    this.mode = 'strobila'; this.strobT = 0; this.target = null;
    Bus.emit('strobila', this);
  }
  /* pulse on the swell to wiggle the bottom disc (you) loose */
  popWindow() { return this.W.swash() > .62; }
  updatePop(dt) {
    const r = this.rel, W = this.W, D = this.D;
    r.t += dt; r.flash = Math.max(0, r.flash - dt * 2);
    const wave = Math.floor(W.t / 5.6);
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.popGate) {
      if (this.popWindow() && r.lastWave !== wave) {
        r.lastWave = wave; r.good++; r.flash = 1; this.stats.pops++;
        this.G.particles.sparkle(this.tipX, this.tipY, 12, '#dff6ff', 10, .4);
        AudioFX.pop && AudioFX.pop(1 + r.good * .12); Bus.emit('popPulse', this, r.good);
        if (r.good >= D.pops) { this.flags.popGate = true; this.milestone('ephyra', () => this.becomeEphyra()); }
      } else if (r.lastWave !== wave) { r.miss++; this.say('pop'); }
    }
  }
  becomeEphyra() {
    const tx = this.tipX, ty = this.tipY;
    this.stage = 'ephyra'; this.mode = 'swim'; this.einst = 1; this.efood = 0; this.rel = null;
    this.x = tx; this.y = ty + 8; this.vx = 22; this.vy = 10; this.ang = .8; this.pulseT = 0; this.underT = 3;
    this.site.regrow = 0;
    this.G.particles.sparkle(this.x, this.y, 20, '#fff3c0', 14, .45);
    Bus.emit('popFree', this);
  }

  /* ============================================================
     THE JELLY: pulse to swim, eat, grow
     ============================================================ */
  updateJelly(dt) {
    const W = this.W, inp = this.input, eph = this.stage === 'ephyra';
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 9; this.pulseT = 0; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    if (this.busy > 0) { this.updateBusy(dt); this.swimPhysics(dt, 0, 0, false); return; }
    if (this.mode === 'brood') { this.updateBrood(dt); this.swimPhysics(dt, 0, 0, false); return; }
    if (this.mode === 'release') { this.updateRelease(dt); this.swimPhysics(dt, 0, 0, false); return; }
    if (inp.actionPressed && this.act()) return;
    if (inp.eggPressed && this.dashCool <= 0) this.bigPulse();
    this.swimPhysics(dt, inp.x, inp.y, true);
    /* the comb jellies and the herring never hurt, but they bump a small jelly about */
    if (eph) {
      for (const j of W.jellies) if (!j.hitDone && Math.hypot(j.x - this.x, j.y - this.y) < j.r + this.r) { j.hitDone = true; this.startTumble(sign(this.x - j.x) * 50, -25); Bus.emit('combJelly', this); return; }
      const sc = W.school;
      if (sc && !sc.hitDone) for (const f of sc.fish) { const fx = sc.x + f.dx, fy = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6; if (Math.hypot(fx + sc.dir * 14 - this.x, fy - this.y) < 10 * f.s + this.r) { sc.hitDone = true; if (this.t - this.lastDashT < 1.4) { this.stats.dodges++; Bus.emit('dodged', this, sc); } else this.startTumble(sc.dir * 70, -20); return; } }
    }
    /* eating */
    const R = this.r, night = nightAmount(this.G.tod);
    for (const q of W.plankton) {
      if (q.eaten) continue;
      const K = PLANKTON_KINDS[q.kind], d = Math.hypot(q.x - this.x, q.y - this.y);
      if (q.kind === 'dino' && d < R * 1.6 + 6) { if (night > .4 && q.glow < .3) { this.stats.glow++; Bus.emit('glow', this); } q.glow = 1; }
      if (eph) {
        if (d < R * .9 + K.r + 1) {
          q.eaten = true; this.efood += K.val; this.stats.plankton++;
          if (q.kind === 'copepod') { this.stats.copepods++; Bus.emit('ateCopepod', this); }
          this.G.particles.puff(q.x, q.y, q.kind === 'copepod' ? '#ffd0a0' : '#c8f0a0', 3);
          AudioFX.blip && AudioFX.blip(q.kind === 'copepod' ? 1.4 : 1);
          Bus.emit('ate', this, q);
        }
      } else if (d < R * 1.05 + K.r && this.stuck < this.stuckCap) {
        /* it sticks to the slime on the bell */
        q.eaten = true; q.stuck = true; this.stuck++; this.stuckVal += K.val; this.stats.plankton++;
        if (q.kind === 'copepod') this.stats.copepods++;
        this.stats.stuckMax = Math.max(this.stats.stuckMax, this.stuck);
        AudioFX.blip && AudioFX.blip(.8);
        Bus.emit('stuck', this, this.stuck);
        if (this.stuck >= this.stuckCap) Bus.emit('stuckFull', this);
      }
    }
    /* swum in under a ledge: after a while, an arrow shows the way back out to the open water */
    const L = W.ledgeOver(this.x, this.y);
    this.underT = L ? (this.underT || 0) + dt : 0;
    this.outHint = L && this.underT > 4 ? W.ledgeExit(L) : null;
    if (W.streamAt(this.x, this.y) > .5) { this.stats.ride += dt; if (!this.flags.rode && this.stats.ride > 1.5) { this.flags.rode = true; Bus.emit('ride', this); } }
    this.jellyGrowth();
  }
  swimPhysics(dt, ix, iy, steer) {
    const eph = this.stage === 'ephyra', m = Math.hypot(ix, iy), moving = steer && m > .15;
    this.moving = moving;
    /* the bell turns to face where you push; with nothing pushed it rights itself, top up */
    const want = moving ? Math.atan2(ix, -iy) : 0;
    this.ang = angleLerp(this.ang, want, clamp(dt * (moving ? 3.2 : .8), 0, 1));
    const rate = (moving ? (eph ? 1.6 : 1.25) : .5) * (this.G.settings.slowmo ? .8 : 1);
    this.pulseT += dt * rate;
    if (this.pulseT >= 1) {
      this.pulseT -= 1;
      const k = (eph ? 22 + this.einst * 3 : 22 + this.r * .55) * (moving ? 1 : .12);
      this.vx += Math.sin(this.ang) * k; this.vy -= Math.cos(this.ang) * k; this.stats.pulses++;
      if (nightAmount(this.G.tod) > .5 && this.stage === 'medusa' && moving && this.y < 400) {
        this.G.particles.sparkle(this.x - Math.sin(this.ang) * this.r, this.y + Math.cos(this.ang) * this.r, 5, '#8ef0ff', this.r * .8, .5);
        this.stats.sparkles++; if (this.stats.sparkles === 3) Bus.emit('sparkle', this);
      }
    }
    const u = this.pulseT; this.pulse = u < .28 ? smoothstep(0, .28, u) : 1 - smoothstep(.28, 1, u);
    this.vy += 3.5 * dt;                                     /* jellies sink slowly when they stop pulsing */
    this.vx *= Math.exp(-dt * 1.5); this.vy *= Math.exp(-dt * 1.5);
    const sp = Math.hypot(this.vx, this.vy), cap = (eph ? 34 : 44) * (this.dashCool > .6 ? 2 : 1);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.drift(dt, 1);
  }
  bigPulse() {
    const k = (this.stage === 'ephyra' ? 60 : 70);
    this.vx += Math.sin(this.ang) * k; this.vy -= Math.cos(this.ang) * k;
    this.dashCool = 1.1; this.stats.dashes++; this.lastDashT = this.t; this.pulseT = 0;
    this.G.particles.bubbles(this.x - Math.sin(this.ang) * this.r, this.y + Math.cos(this.ang) * this.r, 6, 1.2);
    AudioFX.dash && AudioFX.dash(); Bus.emit('dash', this);
  }
  jellyGrowth() {
    const D = this.D;
    if (this.stage === 'ephyra') {
      if (this.einst < 3 && this.efood >= D.ephyra[this.einst - 1]) { this.einst++; this.grow = 1; this.G.particles.sparkle(this.x, this.y, 12, '#fff3c0', this.r, .5); Bus.emit('grew', this, this.einst); }
      if (this.efood >= D.ephyra[2] && !this.flags.medusaGate) { this.efood = D.ephyra[2]; this.flags.medusaGate = true; this.milestone('medusa', () => this.becomeMedusa()); }
      return;
    }
    if (this.minst === 1 && this.mfood >= D.medusa[0] && !this.flags.adultGate) { this.flags.adultGate = true; this.milestone('adult', () => { this.minst = 2; this.grow = 1; Bus.emit('adult', this); }); }
    if (this.minst === 2 && this.mfood >= D.medusa[1] && !this.flags.grown) { this.flags.grown = true; Bus.emit('grown', this); }
  }
  becomeMedusa() {
    this.stage = 'medusa'; this.minst = 1; this.mfood = 0; this.stuck = 0; this.stuckVal = 0; this.grow = 1;
    this.G.particles.sparkle(this.x, this.y, 18, '#fff3c0', 12);
    Bus.emit('medusa', this);
  }
  /* the sea carries you along */
  drift(dt, k) {
    const [cx, cy] = this.W.current(this.x, this.y);
    this.x += (this.vx + cx * k) * dt; this.y += (this.vy + cy * k) * dt;
    this.bounds();
  }
  bounds() {
    const W = this.W, S = this.S, R = this.stage === 'medusa' ? this.r * .8 : this.r;
    const top = W.seaLevel() + R * .8 + 1;
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    if (this.x < WORLD.left + 120) { this.x = WORLD.left + 120; this.vx = Math.abs(this.vx); }
    const maxX = WORLD.harbourR - 40;
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); this.say('edge'); }
    for (let k = 0; k < 6 && S.solidAt(this.x, this.y + R); k++) { this.y -= 2; this.vy = Math.min(0, this.vy); }
    for (let k = 0; k < 6 && S.solidAt(this.x, this.y - R); k++) { this.y += 2; this.vy = Math.max(0, this.vy); }
    for (const sx of [1, -1]) for (let k = 0; k < 6 && S.solidAt(this.x + sx * R, this.y); k++) { this.x -= sx * 2; this.vx = sx > 0 ? Math.min(0, this.vx) : Math.max(0, this.vx); }
  }
  startTumble(vx, vy) { this.tumble = 1.1; this.vx = vx; this.vy = vy; this.stats.tumbles++; this.target = null; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('missed', this); }
  /* a visitor tries for a jelly snack: it always misses.  A big pulse just in time, or deep enough for a bird: it never even comes close */
  struck(h) {
    if (!this.jelly) return;
    const bird = h.kind === 'gull' || h.kind === 'tern';
    if (this.t - this.lastDashT < 1.4 || (bird && this.y > this.W.seaLevel() + 40) || (!bird && Math.hypot(h.x - this.x, h.y - this.y) > 120)) { this.stats.dodges++; Bus.emit('dodged', this, h); }
    else this.startTumble(sign(this.x - h.x) * 60, -20);
  }

  /* ---------- what Space does right now ---------- */
  context() {
    const W = this.W;
    if (this.stage === 'egg' || this.tumble > 0 || this.busy > 0) return null;
    if (this.stage === 'planula') { const s = W.siteAt(this.x, this.y - 3, 12); if (s && !s.taken && !s.mine && !s.bud && this.y > s.y && this.y - s.y < 14) return 'settle'; return null; }
    if (this.stage === 'polyp') { if (this.mode !== 'polyp') return null; if (this.caught.length) return 'eat'; if (this.canBud()) return 'bud'; return null; }
    if (this.mode !== 'swim') return null;
    if (this.stage === 'medusa') {
      if (this.flags.broodDone && !this.flags.released && this.sex === 'girl') return 'fan';
      if (this.flags.mating && !this.flags.met) {
        if (this.sex === 'boy' && W.girlNear(this.x, this.y, this.r + 60)) return 'meet';
        if (this.sex === 'girl' && W.cloudNear(this.x, this.y, this.r + 20)) return 'meet';
      }
      if (this.stuck > 0) return 'lick';
    }
    return null;
  }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    if (v === 'settle') { const s = W.siteAt(this.x, this.y - 3, 12); this.milestone('settle', () => this.settle(s)); }
    else if (v === 'eat') this.startBusy('eat', EAT_T);
    else if (v === 'bud') this.startBusy('bud', BUD_T);
    else if (v === 'lick') this.startBusy('lick', LICK_T);
    else if (v === 'meet') { const o = this.sex === 'boy' ? W.girlNear(this.x, this.y, this.r + 60) : W.cloudNear(this.x, this.y, this.r + 20); this.startBusy('meet', MEET_T, o); }
    else if (v === 'fan') this.startRelease();
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj || null; this.busyT = t; this.target = null; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy;
    this.busy -= dt;
    if ((k === 'eat' || k === 'lick') && Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.munch && AudioFX.munch(); this.G.particles.puff(k === 'eat' ? this.tipX : this.x, k === 'eat' ? this.tipY : this.y + this.r * .6, '#e8f8c8', 2); }
    if (k === 'meet' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - this.r - 8, '♥', '#ff7aa8', 14);
    if (k === 'bud' && Math.random() < dt * 10) this.G.particles.sparkle(this.site.x + rnd(-10, 10), this.site.y + 6, 1, '#fff3c0', 4, .35);
    if (this.busy > 0) return;
    this.busy = 0;
    if (k === 'eat') {
      let v = 0; for (const c of this.caught) v += PLANKTON_KINDS[c.kind].val * 1.4;
      this.caught.length = 0; this.pfood = Math.min(this.pfood + v, this.D.polyp[2] * 1.2); this.stats.polypMeals++;
      Bus.emit('polypAte', this, v);
      this.polypGrow();
    }
    if (k === 'bud') {
      const s = this.W.budSite(this.site);
      if (s) { s.bud = true; s.form = this.form; s.budT = 0; }
      this.buds++; this.stats.buds++;
      this.pfood = Math.max(this.D.polyp[1], this.pfood - (this.D.polyp[2] - this.D.polyp[1]) * .8);
      this.flags.fullSaid = false;
      this.G.particles.sparkle(s ? s.x : this.x, s ? s.y + 5 : this.y, 14, '#fff3c0', 8, .35);
      Bus.emit('budded', this, this.buds, s);
      if (this.buds >= this.D.buds && !this.flags.budsDone) { this.flags.budsDone = true; Bus.emit('budsDone', this); }
      else this.polypGrow();
    }
    if (k === 'lick') {
      this.mfood = Math.min(this.mfood + this.stuckVal, this.D.medusa[1] * 1.05); this.stats.licks++;
      const n = this.stuck; this.stuck = 0; this.stuckVal = 0;
      Bus.emit('licked', this, n);
      this.jellyGrowth();
    }
    if (k === 'meet') {
      this.flags.met = true;
      if (o && o.from) { const i = this.W.clouds.indexOf(o); if (i >= 0) this.W.clouds.splice(i, 1); }
      if (o && this.sex === 'boy') { o.met = true; this.W.clouds.push({ x: this.x + sign(o.x - this.x) * this.r, y: this.y + this.r * .4, r: 10, t: 0, from: this, mine: true }); }
      Bus.emit('met', this, o && o.from ? o.from : o);
    }
  }

  /* ---------- the girl: babies in the pouches on her arms, then let go on the swell ---------- */
  startBrood() { this.mode = 'brood'; this.broodT = 0; this.eggs = .2; this.target = null; this.flags.broodStarted = true; Bus.emit('brooding', this); }
  updateBrood(dt) {
    this.broodT += dt; this.eggs = clamp(.2 + this.broodT / BROOD_T * .8, 0, 1);
    if (this.broodT >= BROOD_T && !this.flags.broodDone) { this.flags.broodDone = true; this.mode = 'swim'; Bus.emit('broodDone', this); }
  }
  startRelease() { this.mode = 'release'; this.rel = { good: 0, miss: 0, t: 0, flash: 0, lastWave: -1 }; this.target = null; Bus.emit('release', this); }
  releaseWindow() { return this.W.swash() > .62; }
  updateRelease(dt) {
    const r = this.rel, W = this.W, D = this.D;
    r.t += dt; r.flash = Math.max(0, r.flash - dt * 2);
    const wave = Math.floor(W.t / 5.6);
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.releaseGate) {
      if (this.releaseWindow() && r.lastWave !== wave) {
        r.lastWave = wave; r.good++; r.flash = 1; this.stats.fans++;
        const n = Math.round(4000 / D.fans); this.stats.planulaeOut += n;
        this.eggs = Math.max(0, 1 - r.good / D.fans);
        W.larvaBurst(this.x, this.y + this.r * 1.6, 50);
        this.G.particles.sparkle(this.x, this.y + this.r, 18, '#bfefff', 24);
        AudioFX.splash && AudioFX.splash(); Bus.emit('fan', this, r.good);
        if (r.good >= D.fans && !this.flags.releaseGate) { this.flags.releaseGate = true; this.milestone('larvae', () => { this.flags.released = true; this.mode = 'swim'; Bus.emit('larvaeReleased', this); }); }
      } else if (r.lastWave !== wave) { r.miss++; this.say('release'); }
    }
  }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'stage', 'mode', 'x', 'y', 'ang', 'eggT', 'lean', 'stretch', 'pinst', 'pfood', 'buds', 'strobT', 'efood', 'einst', 'mfood', 'minst', 'stuck', 'stuckVal', 'eggs', 'broodT', 'stats', 'flags']) o[k] = this[k];
    o.site = this.site ? [+this.site.x.toFixed(1), +this.site.y.toFixed(1)] : null;
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    if (['egg', 'planula', 'polyp', 'ephyra', 'medusa'].includes(o.stage)) this.stage = o.stage;
    const modes = { egg: ['egg'], planula: ['swim'], polyp: ['polyp', 'strobila', 'pop'], ephyra: ['swim'], medusa: ['swim', 'brood', 'release'] }[this.stage];
    this.mode = modes.includes(o.mode) ? o.mode : modes[0];
    this.x = clamp(num(o.x, this.x), WORLD.left + 120, WORLD.harbourR - 40); this.y = clamp(num(o.y, this.y), 0, 700);
    this.ang = num(o.ang, 0);
    this.eggT = num(o.eggT, 0); this.lean = clamp(num(o.lean, 0), -1, 1); this.stretch = clamp(num(o.stretch, .6), 0, 1);
    this.pinst = clamp(Math.round(num(o.pinst, 1)), 1, 3); this.pfood = Math.max(0, num(o.pfood, 0)); this.buds = clamp(Math.round(num(o.buds, 0)), 0, 9);
    this.strobT = clamp(num(o.strobT, 0), 0, STROB_T);
    this.efood = Math.max(0, num(o.efood, 0)); this.einst = clamp(Math.round(num(o.einst, 1)), 1, 3);
    this.mfood = Math.max(0, num(o.mfood, 0)); this.minst = clamp(Math.round(num(o.minst, 1)), 1, 2);
    this.stuck = clamp(Math.round(num(o.stuck, 0)), 0, 20); this.stuckVal = Math.max(0, num(o.stuckVal, 0));
    this.eggs = clamp(num(o.eggs, 0), 0, 1); this.broodT = clamp(num(o.broodT, 0), 0, BROOD_T);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) if (/^[A-Za-z_0-9]{1,30}$/.test(k)) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    /* a gated step that was waiting when the game closed starts again by itself */
    for (const k of ['hatching', 'stackDone', 'popGate', 'medusaGate', 'adultGate', 'releaseGate', 'fullSaid']) delete this.flags[k];
    if (this.mode === 'pop') { this.mode = 'strobila'; this.strobT = STROB_T - .5; }
    if (this.mode === 'release') this.mode = 'swim';
    if (this.stage === 'ephyra' && this.efood >= this.D.ephyra[2]) this.efood = this.D.ephyra[2] - .5;
    if (this.stage === 'medusa' && this.minst === 1 && this.mfood >= this.D.medusa[0]) this.mfood = this.D.medusa[0] - .5;
    if (this.stage === 'polyp' || Array.isArray(o.site)) {
      const W = this.W;
      let s = Array.isArray(o.site) ? W.sites.find(q => Math.abs(q.x - o.site[0]) < 2 && Math.abs(q.y - o.site[1]) < 3) : null;
      if (!s && this.stage === 'polyp') s = W.nearestFreeSite(this.x, this.y) || W.sites[0];
      if (s) { s.taken = null; s.bud = false; s.mine = true; this.site = s; if (this.stage !== 'polyp') s.regrow = 1; }
      if (this.stage === 'polyp') { this.x = s.x; this.y = s.y + this.polypLen * .5; }
    }
    if (this.stage === 'planula' || this.jelly) { const S = this.S; for (let k = 0; k < 80 && S.solidAt(this.x, this.y); k++) this.y -= 4; }
  }
}
