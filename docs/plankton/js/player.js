/* ============================================================
   player.js — you, the copepod, from egg to the next generation
   ============================================================
   step   0       an egg drifting in the spring sea
          1 – 6   nauplius I – VI: a round little swimmer with one
                  red eye.  I and II live on their yolk; from III
                  on you eat diatoms.  Each step ends in a moult.
          7 – 10  copepodite I – IV: the copepod shape (long body,
                  tail, long feelers).  Eat at the top at night,
                  hide down in the dark by day (the "hidden" meter
                  drops in the light, and herring come).
          11      stage V: eat to fill the oil sac, sink to the
                  deep and sleep (diapause) through autumn
          12      grown up, after the winter moult.  Boys follow a
                  girl's scent trail; girls meet a boy, swim up to
                  the spring bloom, eat and lay their eggs.
   modes  egg · swim · moult · sleep · lay
   E jumps (a copepod's escape kick).  Space does what the moment
   needs (moult, sleep, say hi, lay eggs).
   Nothing hurts the copepod, ever: a fish, a jelly or a whale
   misses, and at worst you tumble.
   ============================================================ */
'use strict';

const MOLT_T = 1.6, SLEEP_T = 16, JUMP_COOL = .8, LAY_PULSE = 2.4;

class Copepod {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'red';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'egg'; this.mode = 'egg'; this.step = 0;
    this.x = WORLD.eggX; this.y = 60; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.phase = 0;
    this.food = 0; this.yolkT = 0; this.tight = false; this.molting = 0;
    this.safe = 1; this.oil = 0; this.eggFood = 0; this.sleepT = 0;
    this.jumpCool = 0; this.lastJump = -99; this.jumpAnim = 0; this.tumble = 0; this.spin = 0;
    this.busy = 0; this.busyKind = null; this.flipT = 0; this.rel = null;
    this.moving = false; this.hintClock = 0; this.target = null;
    this.stats = { diatoms: 0, chains: 0, glow: 0, molts: 0, jumps: 0, dodges: 0, tumbles: 0, deepDays: 0, nightsUp: 0, clutches: 0, eggsOut: 0, trail: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get swimming() { return this.stage !== 'egg'; }
  get need() { return stepNeed(this.D, this.step); }
  /* how far through this step (0..1), for size and the HUD */
  get frac() {
    if (this.step === 1 || this.step === 2) return clamp(this.yolkT / this.D.yolk, 0, 1);
    if (this.step === 11) return this.oil;
    const n = this.need; return n ? clamp(this.food / n, 0, 1) : 0;
  }
  get r() { return copR(this.step, this.frac); }
  get mm() { return copMM(this.step, this.frac); }
  stageKey() {
    if (this.step === 0) return 'egg';
    if (this.step <= 6) return 'nauplius';
    if (this.step <= 10) return 'copepodite';
    if (this.step === 11) return this.mode === 'sleep' || this.flags.slept ? 'sleep' : 'stage5';
    return 'adult';
  }
  stageFor(step) { return step === 0 ? 'egg' : step <= 6 ? 'nauplius' : step <= 11 ? 'copepodite' : 'adult'; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.jumpCool -= dt; this.jumpAnim = Math.max(0, this.jumpAnim - dt * 2.5);
    if (this.target) this.steerToTarget();
    if (this.stage === 'egg') this.updateEgg(dt);
    else this.updateSwim(dt);
    this.input.actionPressed = false; this.input.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (d < Math.max(4, this.r * 2)) { this.target = null; return; }
    this.input.x = dx / d; this.input.y = dy / d;
  }
  goTo(x, y) { if (this.stage === 'egg' || ['moult', 'sleep', 'lay'].includes(this.mode)) return; this.target = { x, y }; }

  /* ---------- the egg ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    /* an egg sinks slowly and drifts */
    const [cx, cy] = this.W.current(this.x, this.y);
    this.x += cx * .5 * dt; this.y = Math.min(140, this.y + (cy * .3 + 1.2) * dt);
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    this.stage = 'nauplius'; this.mode = 'swim'; this.step = 1; this.food = 0; this.yolkT = 0; this.tight = false;
    this.vx = 0; this.vy = -6;
    this.G.particles.shed(this.x, this.y, 1.4);
    Bus.emit('hatched', this);
  }

  /* ============================================================
     IN THE WATER
     ============================================================ */
  updateSwim(dt) {
    const W = this.W, inp = this.input, D = this.D;
    if (this.mode === 'moult') { this.molting -= dt; this.drift(dt, .5); if (this.molting <= 0) this.finishMoult(); return; }
    if (this.mode === 'sleep') { this.updateSleep(dt); return; }
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 14; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    if (this.busy > 0) { this.updateBusy(dt); this.drift(dt, .3); return; }
    if (this.mode === 'lay') { this.updateLay(dt); this.drift(dt, .4); return; }
    if (inp.actionPressed) this.act();
    if (inp.eggPressed) this.jump();
    const naup = this.step <= 6, adult = this.step >= 12;
    /* a nauplius swims in little hops; a copepodite glides */
    const hop = naup ? .35 + .65 * Math.max(0, Math.sin(this.phase * 1.3)) : 1;
    const accel = (naup ? 110 : 150) * hop, maxSp = naup ? 16 + this.step * 2 : adult ? 40 : 26 + (this.step - 7) * 3;
    this.vx += inp.x * accel * dt; this.vy += inp.y * accel * dt;
    this.vy += (this.moving ? 1 : 3) * dt;                     /* sinks slowly when it stops swimming */
    this.vx *= Math.exp(-dt * 2.6); this.vy *= Math.exp(-dt * 2.6);
    const sp = Math.hypot(this.vx, this.vy), cap = maxSp * (this.t - this.lastJump < .35 ? 4 : 1);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.drift(dt, 1);
    if (Math.abs(inp.x) > .2) this.face = sign(inp.x);
    this.moving = Math.hypot(inp.x, inp.y) > .1;
    this.ang = angleLerp(this.ang, clamp(this.vy / 50, -.7, .7) * (this.face > 0 ? 1 : -1), clamp(dt * 6, 0, 1));
    this.eat();
    this.visitors(dt);
    this.updateSafe(dt);
    this.grow(dt);
  }
  /* the sea carries you along */
  drift(dt, k) {
    const [cx, cy] = this.W.current(this.x, this.y);
    this.x += (this.vx + cx * k) * dt; this.y += (this.vy + cy * k) * dt;
    this.bounds();
  }
  bounds() {
    const W = this.W, R = this.r, top = W.seaLevel() + R + 1, floor = W.ground.surfaceAt(this.x) - R - 4;
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    if (this.y > floor) { this.y = floor; this.vy = Math.min(0, this.vy); }
    if (this.x < WORLD.walkL) { this.x = WORLD.walkL; this.vx = Math.abs(this.vx); this.say('tooFar'); }
    if (this.x > WORLD.walkR) { this.x = WORLD.walkR; this.vx = -Math.abs(this.vx); this.say('tooFar'); }
  }
  /* bump into diatoms to eat them (from nauplius III on); dinoflagellates flash blue at night */
  eat() {
    const W = this.W, R = this.r, canEat = this.step >= 3 && !(this.step === 11 && this.oil >= 1) && !(this.step === 12 && (this.sex === 'boy' || !this.flags.met || this.flags.eggsReady));
    const night = nightAmount(this.G.tod);
    for (const q of W.plankton) {
      if (q.eaten) continue;
      const d = Math.hypot(q.x - this.x, q.y - this.y), reach = R + PLANKTON_KINDS[q.kind].r + 1.6 + (this.step >= 7 ? R * .6 : 0);
      if (q.kind === 'dino' && d < reach + 6 && night > .4 && q.glow < .3) { q.glow = 1; this.stats.glow++; this.G.particles.sparkle(q.x, q.y, 8, '#8ee8ff', 5); Bus.emit('glow', this, q); }
      if (d >= reach) continue;
      if (!canEat) { if (this.step < 3 && !this.flags.yolkSaid) { this.flags.yolkSaid = true; Bus.emit('yolkBump', this); } continue; }
      q.eaten = true;
      const v = PLANKTON_KINDS[q.kind].val;
      if (this.step === 12) this.eggFood += v; else this.food += v;
      this.stats.diatoms++; if (q.kind === 'chain') this.stats.chains++;
      this.G.particles.puff(q.x, q.y, q.kind === 'dino' ? '#d8c890' : '#b8e890', 3, .6);
      AudioFX.blip && AudioFX.blip(q.kind === 'chain' ? .8 : 1.2);
      Bus.emit('ate', this, q);
    }
  }
  /* the big animals: never harmful.  A jump in time and they miss you; otherwise a harmless tumble */
  visitors(dt) {
    const W = this.W, R = this.r, D = this.D, jumped = this.t - this.lastJump < D.jump;
    const sc = W.school;
    if (sc && !sc.hitDone) {
      let close = false;
      for (const f of sc.fish) { const fx = sc.x + f.dx, fy = sc.y + f.dy; if (Math.hypot(fx - this.x, (fy - this.y) * 1.6) < 15 * f.s + R) { close = true; break; } }
      if (close) { sc.hitDone = true; if (jumped) { this.stats.dodges++; Bus.emit('dodged', this, 'herring'); } else this.startTumble(sc.dir * 60, -20); }
    }
    const mouth = W.sharkMouth();
    if (mouth) {
      const dx = mouth.x - this.x, dy = mouth.y - this.y, d = Math.hypot(dx, dy);
      if (d < 360) { const pull = (1 - d / 360) * 60; this.vx += dx / d * pull * dt; this.vy += dy / d * pull * dt; }
      if (d < 60 && !W.shark.hitDone) { W.shark.hitDone = true; if (jumped) { this.stats.dodges++; Bus.emit('dodged', this, 'shark'); } else this.startTumble(W.shark.dir * 80, -60); this.x = mouth.x + W.shark.dir * 50; this.y = Math.max(W.seaLevel() + 8, mouth.y - 110); Bus.emit('sharkWhoosh', this); }
    }
    const wm = W.whaleMouth();
    if (wm) {
      const dx = wm.x - this.x, dy = wm.y - this.y, d = Math.hypot(dx, dy);
      if (d < 260 && (wm.x - this.x) * W.whale.dir < 0) { const pull = (1 - d / 260) * 45; this.vx += dx / d * pull * dt; this.vy += dy / d * pull * dt; }
      if (d < 46 && !W.whale.hitDone) {
        W.whale.hitDone = true;
        if (jumped) { this.stats.dodges++; Bus.emit('dodged', this, 'whale'); }
        else { this.startTumble(-W.whale.dir * 40, -90); this.x = wm.x - W.whale.dir * 10; this.y = wm.y - 70; }
        Bus.emit('whaleMissed', this);
      }
    }
    for (const j of W.jellies) {
      const d = Math.hypot(j.x - this.x, j.y - this.y);
      /* a bump, then the jelly is just gently in the way for a while (no tumble after tumble) */
      if (d < j.r + R + 1) { if (!j.cool) { j.cool = 6; this.startTumble(sign(this.x - j.x) * 50, -30); Bus.emit('combJelly', this); } else { const k = (j.r + R + 1 - d) / Math.max(1, d); this.x += (this.x - j.x) * k; this.y += (this.y - j.y) * k; } }
    }
  }
  startTumble(vx, vy) { this.tumble = 1.1; this.vx = vx; this.vy = vy; this.stats.tumbles++; this.target = null; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('missed', this); }
  /* E: kick every leg at once and jump (a copepod's escape) */
  jump() {
    if (this.jumpCool > 0 || this.mode !== 'swim' || this.busy > 0) return false;
    const inp = this.input, m = Math.hypot(inp.x, inp.y);
    let dx = m > .1 ? inp.x / m : this.face, dy = m > .1 ? inp.y / m : -.2;
    /* with no direction, jump away from whatever is coming */
    const W = this.W, th = W.whale ? W.whaleMouth() : W.school ? { x: W.school.x, y: W.school.y } : W.shark ? W.sharkMouth() : null;
    if (m <= .1 && th) { dx = sign(this.x - th.x) * .55; dy = this.y < th.y + 10 ? -.83 : .83; }
    const k = this.step <= 6 ? 70 : this.step >= 12 ? 170 : 130 + (this.step - 7) * 8;
    this.vx += dx * k; this.vy += dy * k; this.jumpCool = JUMP_COOL; this.lastJump = this.t; this.jumpAnim = 1; this.stats.jumps++;
    if (Math.abs(dx) > .2) this.face = sign(dx);
    this.G.particles.bubbles(this.x - dx * this.r * 2, this.y - dy * this.r * 2, 4, .6);
    AudioFX.dash && AudioFX.dash(); Bus.emit('jump', this);
    return true;
  }
  /* the hidden meter (copepodites and grown-ups): in the light near the top by day it drops; in the dim water it fills */
  updateSafe(dt) {
    if (this.step < 7) { this.safe = 1; return; }
    const L = this.W.light(this.y), D = this.D;
    const rate = L > .12 ? -L * .07 * D.risk : L > .06 ? .01 : .06;
    this.safe = clamp(this.safe + rate * dt, 0, 1);
    if (this.safe < .3 && !this.flags.exposedSaid) { this.flags.exposedSaid = true; Bus.emit('exposed', this); }
    if (this.safe > .6) this.flags.exposedSaid = false;
    if (this.safe <= 0 && !this.flags.seenNow) { this.flags.seenNow = true; Bus.emit('seen', this); }
  }
  /* growing: a step is done when you have eaten enough (or, for nauplius I and II, swum long enough) */
  grow(dt) {
    const D = this.D;
    if (this.step === 1 || this.step === 2) { this.yolkT += dt; if (this.yolkT >= D.yolk) this.setTight(); return; }
    if (this.step >= 3 && this.step <= 10) { if (this.food >= this.need) { this.food = this.need; this.setTight(); } return; }
    if (this.step === 11) {
      if (!this.flags.slept) { this.oil = clamp(this.food / D.oil, 0, 1); if (this.oil >= 1 && !this.flags.oilFull) { this.flags.oilFull = true; Bus.emit('oilFull', this); } }
      return;
    }
    if (this.step === 12 && this.sex === 'girl' && this.flags.met && !this.flags.eggsReady && this.eggFood >= D.eggs) { this.flags.eggsReady = true; Bus.emit('eggsReady', this); }
  }
  setTight() { if (this.tight) return; this.tight = true; Bus.emit('tight', this); }

  /* ---------- moulting: out of the old skin, one step bigger ---------- */
  /* the step a moult leads into, and the page it waits for in Read to Play */
  moultGate() { return { 3: 'feed', 7: 'copepodite', 11: 'stage5', 12: 'adult' }[this.step + 1] || null; }
  startMoult() {
    if (!this.tight || this.mode !== 'swim' || this.flags['mo' + this.step]) return;
    this.flags['mo' + this.step] = true;
    const go = () => { this.mode = 'moult'; this.molting = MOLT_T; this.target = null; Bus.emit('molting', this); };
    const gate = this.moultGate();
    if (gate) this.milestone(gate, go); else go();
  }
  finishMoult() {
    const W = this.W;
    this.G.particles.shed(this.x, this.y, this.r);
    this.step = Math.min(12, this.step + 1); this.stage = this.stageFor(this.step);
    this.food = 0; this.tight = false; this.mode = 'swim'; this.stats.molts++;
    if (this.step === 12) this.oil = Math.min(this.oil, .55);
    Bus.emit('molted', this, this.step);
    if (this.step === 3) Bus.emit('canEat', this);
    if (this.step === 7) Bus.emit('copepodite', this);
    if (this.step === 11) Bus.emit('stage5', this);
    if (this.step === 12) Bus.emit('adult', this);
  }

  /* ---------- the long sleep in the deep ---------- */
  canSleep() { return this.step === 11 && this.oil >= 1 && !this.flags.slept && this.y > WORLD.sleepY - 60; }
  startSleep() { this.mode = 'sleep'; this.sleepT = 0; this.target = null; this.vx = this.vy = 0; this.flags.slept = true; Bus.emit('sleepStart', this); }
  updateSleep(dt) {
    this.sleepT += dt;
    this.oil = Math.max(.6, 1 - this.sleepT / SLEEP_T * .4);   /* the oil is slowly used up while it sleeps */
    this.y += (Math.min(this.W.ground.surfaceAt(this.x) - 40, Math.max(this.y, WORLD.sleepY + 40)) - this.y) * dt * .5;
    this.x += Math.sin(this.t * .3) * 2 * dt;
    if (this.sleepT >= SLEEP_T && !this.flags.woke) { this.flags.woke = true; this.mode = 'swim'; this.tight = true; Bus.emit('woke', this); }
  }

  /* ---------- what Space does right now ---------- */
  mateNear() {
    const m = this.W.mate; if (!m || this.flags.met || m.mode === 'leave') return null;
    if (this.sex === 'girl' && m.mode !== 'wait') return null;
    return Math.hypot(m.x - this.x, m.y - this.y) < this.r * 4 + 20 ? m : null;
  }
  context() {
    if (this.stage === 'egg' || this.mode !== 'swim' || this.tumble > 0 || this.busy > 0) return null;
    if (this.tight) return 'moult';
    if (this.canSleep()) return 'sleep';
    if (this.step === 12 && this.mateNear()) return 'meet';
    if (this.step === 12 && this.sex === 'girl' && this.flags.eggsReady && !this.flags.laid && this.y < 260) return 'lay';
    return null;
  }
  act() {
    const v = this.context();
    if (!v) return false;
    if (v === 'moult') this.startMoult();
    else if (v === 'sleep') this.milestone('sleep', () => this.startSleep());
    else if (v === 'meet') { const m = this.mateNear(); this.face = sign(m.x - this.x) || this.face; this.busy = 1.6; this.busyKind = 'meet'; this.busyObj = m; this.target = null; }
    else if (v === 'lay') this.startLay();
    Bus.emit('act', this, v);
    return true;
  }
  updateBusy(dt) {
    this.busy -= dt;
    if (this.busyKind === 'meet' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-6, 6), this.y - this.r * 2 - 4, '♥', '#ff7aa8', 5);
    if (this.busy > 0) return;
    this.busy = 0;
    if (this.busyKind === 'meet') { this.flags.met = true; this.stats.trail++; Bus.emit('met', this, this.busyObj); }
    this.busyKind = null; this.busyObj = null;
  }

  /* ---------- a mother lets her eggs go: press when the ring turns green ---------- */
  startLay() { this.mode = 'lay'; this.rel = { good: 0, miss: 0, t: 0, flash: 0, lastPulse: -1 }; this.target = null; this.vx = this.vy = 0; Bus.emit('layStart', this); }
  layWindow() { const r = this.rel; if (!r) return false; const u = (r.t % LAY_PULSE) / LAY_PULSE; return u > .93 - this.D.wide && u < .97; }
  updateLay(dt) {
    const r = this.rel, D = this.D;
    r.t += dt; r.flash = Math.max(0, r.flash - dt * 2);
    const pulse = Math.floor(r.t / LAY_PULSE);
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.layGate) {
      if (this.layWindow() && r.lastPulse !== pulse) {
        r.lastPulse = pulse; r.good++; r.flash = 1; this.stats.clutches++;
        const n = 30 + ((Math.random() * 25) | 0); this.stats.eggsOut += n;
        this.W.eggBurst(this.x - this.face * this.r, this.y + this.r * .5, 26);
        this.G.particles.sparkle(this.x, this.y, 12, '#fff0c0', 10);
        AudioFX.splash && AudioFX.splash(); Bus.emit('clutch', this, r.good);
        if (r.good >= D.lays) { this.flags.layGate = true; this.milestone('eggs', () => { this.flags.laid = true; this.mode = 'swim'; Bus.emit('eggsLaid', this); }); }
      } else if (r.lastPulse !== pulse) { r.lastPulse = pulse; r.miss++; this.say('lay'); }
    }
  }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'stage', 'mode', 'step', 'x', 'y', 'face', 'eggT', 'food', 'yolkT', 'tight', 'safe', 'oil', 'eggFood', 'sleepT', 'stats', 'flags']) o[k] = this[k];
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    this.step = clamp(Math.round(num(o.step, 0)), 0, 12);
    this.stage = this.stageFor(this.step);
    this.mode = this.step === 0 ? 'egg' : ['swim', 'sleep'].includes(o.mode) ? o.mode : 'swim';
    /* a moult or a lay that was going on when the game closed starts again */
    this.x = clamp(num(o.x, this.x), WORLD.walkL, WORLD.walkR); this.y = clamp(num(o.y, this.y), 0, WORLD.floor - 20);
    this.face = o.face === -1 ? -1 : 1;
    this.eggT = Math.max(0, num(o.eggT, 0)); this.food = Math.max(0, num(o.food, 0)); this.yolkT = Math.max(0, num(o.yolkT, 0));
    this.tight = !!o.tight; this.safe = clamp(num(o.safe, 1), 0, 1); this.oil = clamp(num(o.oil, 0), 0, 1);
    this.eggFood = Math.max(0, num(o.eggFood, 0)); this.sleepT = clamp(num(o.sleepT, 0), 0, SLEEP_T);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    /* gated steps that were waiting when the game closed start again by themselves */
    for (const k of ['hatching', 'layGate', 'seenNow', 'exposedSaid']) delete this.flags[k];
    for (let s = 0; s <= 12; s++) if (s >= this.step) delete this.flags['mo' + s];
    if (this.flags.met && this.sex === 'girl' && this.flags.eggsReady && !this.flags.laid) this.mode = 'swim';
    if (this.mode === 'sleep' && this.step !== 11) this.mode = 'swim';
  }
}
