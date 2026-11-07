/* ============================================================
   player.js — you, the stag beetle, from egg to the last summer
   ============================================================
   stage  egg      waiting, then wiggling out (push any arrow)
          grub     eating through the stump (push into wood); E sings
                   three instars; once you are big enough it can dig
                   into the soil at the end of a summer, or stay
                   another year and grow bigger antlers
          chamber  pressing the cocoon (Space, several times)
          pupa     still, through a whole winter (time-lapse)
          adult    mode tunnel   pale, hardening, digging up (or she
                                 digs down to lay her eggs)
                        ground   walking on the lawn
                        climb    on a trunk or branch (a Path)
                        warmup   wings open, whirring up
                        fly      heavy, upright, wobbling
                        fall     wings shut
                        flipped  on your back: rock to get up
                        ring     wrestling (ring.js)
                        sneak    under the branch, past the big ones
                        bite     her jaws in the bark
                        tossed   flipped off: flutters down
                        lifted   in the child's hands
                        busy     sipping, sniffing, meeting (short)
   Nothing hurts the beetle, ever.  The rest of the adult is in
   player2.js.
   ============================================================ */
'use strict';

const PUPA_T = 20, HARDEN_T = 6, MOLT_T = 2.6;

class Beetle {
  constructor(G, form) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'boy'; this.male = FORMS[this.form].male;
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.nestX; this.y = WORLD.nestY; this.ang = 0; this.face = 1;
    this.vx = 0; this.vy = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0;
    this.food = 0; this.instar = 1; this.tight = 0; this.full = false; this.molting = 0;
    this.trail = []; this.phase = 0; this.singT = 0; this.singClock = 0;
    this.build = 0; this.room = null; this.pupaT = 0; this.hardT = 0; this.pale = 0;
    this.energy = 1; this.wet = 0; this.lengthMM = 60; this.perch = null;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.lift = 0; this.pinch = 0; this.flap = 0; this.walk = 0; this.open = 0;
    this.ring = null; this.sn = null; this.bite = null; this.rock = 0; this.rockT = 0; this.wobble = 0; this.sway = 0; this.swayV = 0; this.wingUp = 0;
    this.target = null; this.hintClock = 0; this.chewClock = 0; this.hungryT = 0; this.foodHint = null; this.sniffClock = 0;
    this.ringLosses = {}; this.cards = [];
    this.stats = { eaten: 0, punk: 0, molts: 0, sips: 0, wins: 0, losses: 0, flights: 0, bonks: 0, flips: 0, sneaks: 0, tunnel: 0, met: 0, sung: 0, sang: 0, puffs: 0, blocks: 0, eggs: 0, flyTime: 0, rears: 0, years: 0 };
    this.flags = {};
    for (let k = 0; k < 14; k++) this.trail.push({ x: this.x - k, y: this.y });
  }

  get D() { return this.G.diff(); }
  get F() { return this.G.forest; }
  get W() { return this.G.forest.wood; }
  get r() {
    if (this.stage === 'egg') return 4;
    if (this.stage === 'adult') return 12 * this.size;
    const D = this.D, th = [0, D.molt2, D.molt3, D.full * BONUS], i = this.instar;
    const t = clamp((this.food - th[i - 1]) / (th[i] - th[i - 1]), 0, 1);
    return [0, lerp(4, 6, t), lerp(6.6, 10, t), lerp(10.6, 16, t)][i];
  }
  get grams() { return grubGrams(this.food, this.D.full); }
  get size() { return this.lengthMM * .0062; }
  get feet() { return 32 * this.size; }
  get underground() { return this.stage !== 'adult' || this.mode === 'tunnel'; }
  stageKey() {
    if (this.stage === 'egg') return 'egg';
    if (this.stage === 'grub') return 'grub' + this.instar;
    if (this.stage === 'chamber') return 'grub3';
    if (this.stage === 'pupa') return 'pupa';
    return this.flags.champion ? 'champ' : 'beetle';
  }
  /* Read to Play wraps this, so big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  update(dt) {
    this.t += dt; this.phase += dt * 4; this.hintClock -= dt;
    this.singT = Math.max(0, this.singT - dt);
    const inp = this.input;
    if (this.target && (inp.x || inp.y)) this.target = null;
    if (this.target) this.steerToTarget();
    switch (this.stage) {
      case 'egg': this.updateEgg(dt); break;
      case 'grub': case 'chamber': this.updateGrub(dt); break;
      case 'pupa': this.pupaT += dt; if (this.pupaT >= PUPA_T && !this.flags.emerge) { this.flags.emerge = true; this.milestone('emerge', () => this.emerge()); } break;
      case 'adult': this.updateAdult(dt); break;
    }
    inp.actionPressed = false; inp.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (d < Math.max(8, this.r)) { this.target = null; return; }
    if (this.stage === 'adult' && (this.mode === 'ground' || this.mode === 'climb')) {
      this.input.x = Math.abs(dx) > 6 ? sign(dx) : 0;
      this.input.y = dy < -40 ? -1 : dy > 40 ? 1 : 0;
      if (this.mode === 'ground' && Math.abs(dx) < 10 && dy < -40 && !this.F.treeAt(this.x)) this.target = null;
    } else { this.input.x = dx / d; this.input.y = dy / d; }
  }
  goTo(x, y) { if (this.stage === 'egg' || this.stage === 'pupa') return; this.target = { x, y }; }

  /* ---------- the egg ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    this.stage = 'grub'; this.mode = 'tunnel'; this.instar = 1; this.food = 0;
    this.G.particles.splat(this.x, this.y, '#f4efe0', 10);
    Bus.emit('hatched', this);
  }

  /* ---------- the grub ---------- */
  /* big enough for a cocoon? From Year 3, at the end of a summer; in Year 7, whatever your size */
  canCocoon() { const G = this.G; return (G.year >= FIRST_COCOON_YEAR && this.instar >= 3 && G.yt >= .4) || (G.year >= LAST_YEAR && G.yt >= .5); }
  updateGrub(dt) {
    const W = this.W, D = this.D, inp = this.input;
    if (this.molting > 0) { this.molting -= dt; if (this.molting <= 0) this.finishMolt(); return; }
    if (this.stage === 'chamber') { if (inp.actionPressed) this.press(); return; }
    if (inp.eggPressed) this.sing();
    /* growing out of the skin */
    const th = this.instar === 1 ? D.molt2 : D.molt3;
    if (this.instar < 3 && this.food >= th) {
      this.food = th; this.tight += dt;
      if (this.tight > .2 && !this.flags['tight' + this.instar]) { this.flags['tight' + this.instar] = true; Bus.emit('tight', this); }
      if (this.tight > 1.6 && !this.flags['molt' + this.instar]) { this.flags['molt' + this.instar] = true; this.milestone('molt' + (this.instar + 1), () => this.startMolt()); }
    }
    const can = this.canCocoon();
    if (can && !this.full) { this.full = true; if (this.instar < 3) { this.instar = 3; this.flags.molt1 = this.flags.molt2 = true; } Bus.emit('fullGrown', this); }
    if (!can) this.full = false;
    this.sniff(dt);
    if (inp.actionPressed && this.chamberReady()) { this.press(); return; }
    let mx = inp.x, my = inp.y;
    const m = Math.hypot(mx, my), r = this.r;
    if (m < .1) { this.checkChamber(); return; }
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 9, 0, 1));
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
    const sp = (18 + r * 2.4) * (this.G.settings.slowmo ? .7 : 1) * (this.G.frostSlow ? .55 : 1);
    const nx = this.x + dx * sp * dt, ny = this.y + dy * sp * dt;
    if (this.gfree(nx, ny, r * .78)) { this.x = nx; this.y = ny; this.pushTrail(); this.stats.tunnel += sp * dt; }
    else {
      const hx = this.x + dx * r * .8, hy = this.y + dy * r * .8, sv = W.survey(hx, hy, r * 1.05);
      const edge = W.survey(hx + dx * r * .4, hy + dy * r * .4, r * .55);
      if (edge.sky > 0 || edge.bark > 1) { this.say('outside'); this.slide(dx, dy, sp * dt, r); return; }
      /* soil is not food: a growing grub noses only a little way into it */
      const below = hy - W.groundAt(hx);
      if (sv.soil > 0 && !W.inWood(hx, hy) && (!this.full && !this.nearWood(hx, hy, 34) || (this.full && below > 570))) { this.say(this.full ? 'deeper' : 'soil'); this.slide(dx, dy, sp * dt, r); return; }
      const power = D.chew * (.75 + this.instar * .25) * (this.full ? 1.5 : 1);
      const res = W.chew(hx, hy, r + 1.6, power, dt, { root: this.instar >= 3, clay: this.full, heart: this.full });
      this.chewClock -= dt;
      if (res.cells) {
        const gain = res.food * (this.G.year === 7 ? 1.3 : 1);
        this.food = Math.min(this.food + gain, this.instar < 3 ? Infinity : D.full * BONUS);
        if (res.food) { this.hungryT = 0; this.foodHint = null; }
        this.stats.eaten += res.cells; this.stats.punk += res.punk;
        if (res.punk && !this.flags.punk) { this.flags.punk = true; Bus.emit('ateFungus', this); }
        if (this.chewClock <= 0) { this.chewClock = .12; AudioFX.chew && AudioFX.chew(res.soil ? 1.2 : res.punk ? .6 : .9); this.G.particles.dust(hx, hy, res.punk ? '#efe6d0' : res.soil ? '#7a5236' : '#c08a52', 2); }
        Bus.emit('chewed', this, res);
      } else if (res.blocked) { this.say(sv.rock ? 'rock' : 'hard'); this.slide(dx, dy, sp * dt, r); }
      if (this.gfree(this.x + dx * 1.2, this.y + dy * 1.2, r * .74)) { this.x += dx * 1.2; this.y += dy * 1.2; this.pushTrail(); }
    }
    this.checkChamber();
  }
  /* room for the grub: no solid cell in the whole body, and only the middle of it kept out of the sky, so a stump that crumbles round you can never pin you (and if it crumbles right under you, you can always go down) */
  gfree(x, y, r) {
    const W = this.W, i = W.idx(this.x, this.y), inSky = i >= 0 && W.sky[i];
    return W.free(x, y, r, false) && (W.free(x, y, r * .3, true) || (inSky && y >= this.y));
  }
  nearWood(x, y, d) { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; if (this.W.inWood(x + Math.cos(a) * d, y + Math.sin(a) * d)) return true; } return this.W.inWood(x, y); }
  slide(dx, dy, step, r) {
    for (const s of [1, -1]) {
      const a = this.ang + s * 1.1, nx = this.x + Math.cos(a) * step * .6, ny = this.y + Math.sin(a) * step * .6;
      if (this.gfree(nx, ny, r * .78)) { this.x = nx; this.y = ny; this.pushTrail(); return true; }
    }
    return false;
  }
  pushTrail() {
    const h = this.trail[0];
    if (!h || Math.hypot(h.x - this.x, h.y - this.y) > .8) { this.trail.unshift({ x: this.x, y: this.y }); if (this.trail.length > 90) this.trail.length = 90; }
    else { h.x = this.x; h.y = this.y; }
  }
  /* no food for a while: sniff out the nearest good wood (a pulsing pointer); full-grown: good soil */
  sniff(dt) {
    this.hungryT += dt; this.sniffClock -= dt;
    const W = this.W; let best = null, bd = 1e9;
    if (this.G.yt >= .75 && !this.full) return;
    if (this.full) {
      if (this.chamberReady()) { this.foodHint = null; this.hungryT = 0; return; }
      if (this.sniffClock > 0) return;
      this.sniffClock = 1.5;
      for (let k = 0; k < 900; k++) {
        const a = k * 2.399, d = 20 + Math.sqrt(k) * 16, x = this.x + Math.cos(a) * d, y = this.y + Math.abs(Math.sin(a)) * d * .7;
        if (y - W.groundAt(x) < 75 || y > 500 || W.matAt(x, y) !== MAT.SOIL || W.inWood(x, y)) continue;
        if (d < bd) { bd = d; best = { x, y }; }
      }
      this.foodHint = best; return;
    }
    if (this.hungryT < 6 || this.sniffClock > 0) return;
    this.sniffClock = 1.5;
    for (let k = 0; k < 900; k++) {
      const a = k * 2.399, d = 30 + Math.sqrt(k) * 22, x = this.x + Math.cos(a) * d, y = this.y + Math.sin(a) * d * .6;
      const i = W.idx(x, y); if (i < 0) continue;
      const m = W.mat[i]; if (m !== MAT.ROT && m !== MAT.PUNK) continue;
      const dd = d - (m === MAT.PUNK ? 40 : 0);
      if (dd < bd) { bd = dd; best = { x, y }; }
    }
    if (best && !this.foodHint) Bus.emit('hint', 'sniff');
    this.foodHint = best;
  }
  /* rub your legs together: a little creak through the wood */
  sing() {
    if (this.singClock > this.t) return;
    this.singClock = this.t + .22; this.singT = .5; this.stats.sung++;
    AudioFX.creak && AudioFX.creak(1);
    this.G.particles.text(this.x + rnd(-8, 8), this.y - this.r - 8, '♪', '#fff3c0', 14);
    Bus.emit('sang', this);
  }
  startMolt() { this.molting = MOLT_T; this.tight = 0; Bus.emit('molting', this); }
  finishMolt() {
    const t = this.trail[Math.min(8, this.trail.length - 1)];
    this.F.exuviae.push({ x: t.x, y: t.y, r: this.r * .9, ang: this.ang + Math.PI });
    this.instar++; this.stats.molts++;
    Bus.emit('molted', this, this.instar);
  }
  chamberReady() {
    if (!this.full || this.stage !== 'grub') return false;
    const W = this.W, depth = this.y - W.groundAt(this.x);
    return depth > 55 && !W.inWood(this.x, this.y);
  }
  checkChamber() {
    if (!this.full) return;
    const ready = this.chamberReady();
    if (ready && !this.flags.deepEnough) { this.flags.deepEnough = true; Bus.emit('deepEnough', this); }
    if (!ready && this.flags.deepEnough) this.flags.deepEnough = false;
  }
  press() {
    if (this.stage === 'grub') { if (!this.chamberReady()) return; this.stage = 'chamber'; this.room = { x: this.x, y: this.y }; this.build = 0; Bus.emit('chamberStart', this); }
    this.build++;
    const k = this.build / this.D.chamber;
    this.W.chamber(this.room.x, this.room.y, 14 + 12 * k, 10 + 8 * k, .6 + k);
    this.G.particles.dust(this.room.x, this.room.y, '#a86a42', 8, rnd(TAU));
    AudioFX.press && AudioFX.press(k);
    this.ang += 1.3;
    Bus.emit('pressed', this, k);
    if (this.build >= this.D.chamber && !this.flags.pupa) { this.flags.pupa = true; this.milestone('pupa', () => this.becomePupa()); }
  }
  becomePupa() {
    this.stage = 'pupa'; this.mode = 'pupa'; this.pupaT = 0;
    this.x = this.room.x; this.y = this.room.y + 2;
    this.lengthMM = adultLength(this.food, this.D.full, this.form);
    Bus.emit('pupated', this);
  }
  emerge() {
    this.stage = 'adult'; this.mode = 'tunnel'; this.pale = 1; this.hardT = 0; this.face = 1; this.ang = -Math.PI / 2; this.energy = 1;
    Bus.emit('emerged', this);
  }
}
