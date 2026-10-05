/* ============================================================
   player.js — you, the Hercules beetle, from egg to champion
   ============================================================
   stage  egg      waiting, then wiggling out (push any arrow)
          grub     eating its way through the log (push into wood)
                   three instars; at each threshold the skin gets
                   tight and the grub moults (a gated page in Read
                   to Play); full-grown it digs down into the soil
          chamber  pressing an oval room (Space, several times)
          pupa     still; turning into a beetle (time-lapse)
          adult    mode tunnel   pale, hardening, then digging up
                        ground   walking on the floor or the log
                        climb    on a trunk or branch (a Path)
                        fly      buzzing about (E opens the wings)
                        wrestle  horn to horn with a rival
                        tossed   flipped by a rival: flutters down
                        busy     eating, lifting, meeting (short)
   Nothing hurts the beetle, ever: losing a wrestle means a
   flutter to the ground and another go.
   ============================================================ */
'use strict';

const PUPA_T = 18, HARDEN_T = 7, MOLT_T = 2.6;

class Beetle {
  constructor(G, form) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'hercules';
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.nestX; this.y = WORLD.nestY; this.ang = 0; this.face = 1;
    this.vx = 0; this.vy = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0;
    this.food = 0; this.instar = 1; this.tight = 0; this.full = false; this.molting = 0;
    this.trail = []; this.phase = 0;
    this.build = 0; this.room = null; this.pupaT = 0; this.hardT = 0; this.pale = 0;
    this.energy = 1; this.wet = 0; this.lengthMM = 120; this.perch = null;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.lift = 0; this.pinch = 0; this.flap = 0; this.walk = 0; this.open = 0;
    this.wr = null; this.target = null; this.hintClock = 0; this.chewClock = 0; this.frassClock = 0; this.hungryT = 0; this.foodHint = null; this.sniffClock = 0;
    this.stats = { eaten: 0, punk: 0, molts: 0, fruits: 0, lifts: 0, wins: 0, losses: 0, flights: 0, highest: 0, deepest: 0, tunnel: 0, met: 0, hid: 0, flyTime: 0 };
    this.flags = {};
    for (let k = 0; k < 14; k++) this.trail.push({ x: this.x - k, y: this.y });
  }

  get D() { return this.G.diff(); }
  get F() { return this.G.forest; }
  get W() { return this.G.forest.wood; }
  /* grub radius from instar and how far through it the grub is */
  get r() {
    if (this.stage === 'egg') return 4;
    if (this.stage === 'adult') return 12 * this.size;
    const D = this.D, th = [0, D.molt2, D.molt3, D.full], i = this.instar;
    const t = clamp((this.food - th[i - 1]) / (th[i] - th[i - 1]), 0, 1);
    return [0, lerp(4, 6, t), lerp(6.6, 9.6, t), lerp(10.2, 14, t)][i];
  }
  get grams() { return grubGrams(this.food, this.D.full); }
  /* drawing scale of the adult (a 150 mm male is 57 world units long) */
  get size() { return this.lengthMM * .38 / 150; }
  get feet() { return 30 * this.size; }
  get underground() { return this.stage !== 'adult' || this.mode === 'tunnel'; }
  stageKey() {
    if (this.stage === 'egg') return 'egg';
    if (this.stage === 'grub') return 'grub' + this.instar;
    if (this.stage === 'chamber') return 'grub3';
    if (this.stage === 'pupa') return 'pupa';
    return this.stats.wins >= 3 ? 'champ' : 'beetle';
  }
  /* the colony-style milestone hook: Read to Play wraps it so big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 4;
    this.hintClock -= dt;
    const inp = this.input;
    /* tap-to-go: steer toward the tapped point when no key is held */
    if (this.target && (inp.x || inp.y)) this.target = null;
    if (this.target) this.steerToTarget();
    switch (this.stage) {
      case 'egg': this.updateEgg(dt); break;
      case 'grub': case 'chamber': this.updateGrub(dt); break;
      case 'pupa': this.updatePupa(dt); break;
      case 'adult': this.updateAdult(dt); break;
    }
    /* the damp: wing cases darken slowly when the air is wet */
    const wetT = this.F.humid > .55 ? 1 : 0;
    this.wet += (wetT - this.wet) * (1 - Math.exp(-dt * .22));
    if (this.stage === 'adult' && this.mode !== 'tunnel' && this.wet > .8 && !this.flags.wetSeen) { this.flags.wetSeen = true; Bus.emit('wetWings', this); }
    this.stats.deepest = Math.max(this.stats.deepest, this.y - this.W.groundAt(this.x));
    this.stats.highest = Math.max(this.stats.highest, -this.y);
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

  /* ---------- the egg ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack > .3) Bus.emit('wiggle', this);
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    this.stage = 'grub'; this.mode = 'tunnel'; this.instar = 1; this.food = 0;
    this.G.particles.splat(this.x, this.y, '#f4efe0', 10);
    Bus.emit('hatched', this);
  }

  /* ---------- the grub ---------- */
  updateGrub(dt) {
    const W = this.W, D = this.D, inp = this.input;
    if (this.molting > 0) { this.molting -= dt; if (this.molting <= 0) this.finishMolt(); return; }
    if (this.stage === 'chamber') { if (inp.actionPressed) this.press(); this.curl(dt); return; }
    /* growing out of the skin */
    const th = this.instar === 1 ? D.molt2 : this.instar === 2 ? D.molt3 : D.full;
    if (this.food >= th) {
      if (this.instar < 3) {
        this.food = th;
        this.tight += dt;
        if (this.tight > .2 && !this.flags['tight' + this.instar]) { this.flags['tight' + this.instar] = true; Bus.emit('tight', this); }
        if (this.tight > 1.6 && !this.flags['molt' + this.instar]) { this.flags['molt' + this.instar] = true; this.milestone('molt' + (this.instar + 1), () => this.startMolt()); }
      } else if (!this.full) { this.full = true; Bus.emit('fullGrown', this); }
    }
    this.sniff(dt);
    if (inp.actionPressed && this.chamberReady()) { this.press(); return; }
    let mx = inp.x, my = inp.y;
    const m = Math.hypot(mx, my);
    const r = this.r;
    if (m < .1) { this.curl(dt); this.checkChamber(); return; }
    mx /= m; my /= m;
    const want = Math.atan2(my, mx);
    this.ang = angleLerp(this.ang, want, clamp(dt * 9, 0, 1));
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
    const sp = (18 + r * 2.4) * (this.G.settings.slowmo ? .7 : 1);
    const nx = this.x + dx * sp * dt, ny = this.y + dy * sp * dt;
    if (W.free(nx, ny, r * .78, true)) { this.x = nx; this.y = ny; this.pushTrail(); this.stats.tunnel += sp * dt; }
    else {
      /* push into the wood: chew what is in front of the head */
      const hx = this.x + dx * r * .8, hy = this.y + dy * r * .8;
      const sv = W.survey(hx, hy, r * 1.05);
      if (sv.sky > 0 || sv.bark > 1) { this.say('outside'); this.slide(dx, dy, sp * dt, r); return; }
      /* soil is not food: a growing grub only noses a little way into it; a full-grown one digs down to make its room */
      const below = hy - W.groundAt(hx);
      const farOut = hx < WORLD.logL - 160 || hx > WORLD.logR + 220;
      if (sv.soil > 0 && (farOut || (!this.full && below > 34 && !W.inLog(hx, hy)) || (this.full && below > 170))) { this.say(this.full ? 'deeper' : 'soil'); this.slide(dx, dy, sp * dt, r); return; }
      const power = D.chew * (.75 + this.instar * .25) * (this.full ? 1.5 : 1);
      const res = W.chew(hx, hy, r + 1.6, power, dt, { root: this.instar >= 3, clay: this.full, heart: this.full });
      this.chewClock -= dt;
      if (res.cells) {
        if (this.full) this.hungryT = Math.max(0, this.hungryT - dt * .5);
        this.food = Math.min(this.food + res.food, this.instar < 3 ? Infinity : D.full * BONUS);
        if (res.food) { this.hungryT = 0; this.foodHint = null; }
        this.stats.eaten += res.cells; this.stats.punk += res.punk;
        if (res.punk && !this.flags.punk) { this.flags.punk = true; Bus.emit('ateFungus', this); }
        if (this.chewClock <= 0) { this.chewClock = .12; AudioFX.chew && AudioFX.chew(res.soil ? 1.2 : res.punk ? .6 : .9); this.G.particles.dust(hx, hy, res.punk ? '#efe2c0' : res.soil ? '#6a4a30' : '#b07a48', 3, this.ang); }
        Bus.emit('chewed', this, res);
      } else if (res.blocked) { this.say(sv.rock ? 'rock' : 'hard'); this.slide(dx, dy, sp * dt, r); }
      /* creep into what was just chewed */
      if (W.free(this.x + dx * 1.2, this.y + dy * 1.2, r * .74, true)) { this.x += dx * 1.2; this.y += dy * 1.2; this.pushTrail(); }
    }
    this.checkChamber();
  }
  /* blocked: slide along the wall instead of stopping dead */
  slide(dx, dy, step, r) {
    for (const s of [1, -1]) {
      const a = this.ang + s * 1.1, nx = this.x + Math.cos(a) * step * .6, ny = this.y + Math.sin(a) * step * .6;
      if (this.W.free(nx, ny, r * .78, true)) { this.x = nx; this.y = ny; this.pushTrail(); return true; }
    }
    return false;
  }
  pushTrail() {
    const h = this.trail[0];
    if (!h || Math.hypot(h.x - this.x, h.y - this.y) > .8) { this.trail.unshift({ x: this.x, y: this.y }); if (this.trail.length > 90) this.trail.length = 90; }
    else { h.x = this.x; h.y = this.y; }
  }
  /* no food for a while: sniff out the nearest good wood (shown as a pulsing pointer) */
  sniff(dt) {
    this.hungryT += dt; this.sniffClock -= dt;
    const W = this.W; let best = null, bd = 1e9;
    if (this.full) {
      /* full-grown: point the way down to good digging soil */
      if (this.chamberReady()) { this.foodHint = null; this.hungryT = 0; return; }
      if (this.hungryT < 10 || this.sniffClock > 0) return;
      this.sniffClock = 1.5;
      for (let k = 0; k < 600; k++) {
        const a = k * 2.399, d = 20 + Math.sqrt(k) * 14, x = this.x + Math.cos(a) * d, y = this.y + Math.abs(Math.sin(a)) * d;
        if (y - W.groundAt(x) < 75 || W.matAt(x, y) !== MAT.SOIL || W.inLog(x, y)) continue;
        if (d < bd) { bd = d; best = { x, y }; }
      }
      this.foodHint = best; return;
    }
    if (this.hungryT < 7 || this.sniffClock > 0) return;
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
  /* resting: the body curls up into a C */
  curl(dt) { }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  startMolt() {
    this.molting = MOLT_T; this.tight = 0;
    Bus.emit('molting', this);
  }
  finishMolt() {
    this.F.exuviae = this.F.exuviae || [];
    this.F.exuviae.push({ x: this.trail[Math.min(8, this.trail.length - 1)].x, y: this.trail[Math.min(8, this.trail.length - 1)].y, r: this.r * .9, ang: this.ang + Math.PI });
    this.instar++; this.stats.molts++;
    Bus.emit('molted', this, this.instar);
  }
  /* deep enough in the soil to make the pupal chamber? */
  chamberReady() {
    if (!this.full || this.stage !== 'grub') return false;
    const W = this.W, depth = this.y - W.groundAt(this.x);
    return depth > 55 && W.origAt(this.x, this.y) !== MAT.ROT && W.origAt(this.x, this.y) !== MAT.PUNK && W.origAt(this.x, this.y) !== MAT.HEART;
  }
  checkChamber() {
    if (!this.full) return;
    const ready = this.chamberReady();
    if (ready && !this.flags.deepEnough) { this.flags.deepEnough = true; Bus.emit('deepEnough', this); }
    if (!ready && this.flags.deepEnough) this.flags.deepEnough = false;
  }
  /* Space in the soil: press the walls smooth.  Enough presses make the chamber. */
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
    this.lengthMM = adultLength(this.grams, this.form);
    Bus.emit('pupated', this);
  }

  /* ---------- the pupa ---------- */
  updatePupa(dt) {
    this.pupaT += dt;
    if (this.pupaT >= PUPA_T && !this.flags.emerge) { this.flags.emerge = true; this.milestone('emerge', () => this.emerge()); }
  }
  emerge() {
    this.stage = 'adult'; this.mode = 'tunnel'; this.pale = 1; this.hardT = 0; this.face = 1; this.ang = -Math.PI / 2;
    this.energy = 1;
    Bus.emit('emerged', this);
  }

  /* ============================================================
     THE ADULT
     ============================================================ */
  updateAdult(dt) {
    const inp = this.input;
    this.flap += dt * 46;
    this.lift = Math.max(0, this.lift - dt * 2); this.pinch = Math.max(0, this.pinch - dt * 2);
    this.open += ((this.mode === 'fly' || this.mode === 'tossed' ? 1 : 0) - this.open) * (1 - Math.exp(-dt * 10));
    if (this.mode === 'tunnel') return this.updateDigOut(dt);
    if (this.busy > 0) { this.updateBusy(dt); return; }
    if (this.mode === 'wrestle') return this.updateWrestle(dt);
    if (this.mode === 'tossed') return this.updateTossed(dt);
    if (inp.eggPressed) {
      if (this.mode === 'fly') { this.mode = 'fall'; Bus.emit('folded', this); }
      else if (this.energy > .06) this.takeOff();
      else this.say('tired');
    }
    if (inp.actionPressed && this.mode !== 'fly' && this.mode !== 'fall') this.act();
    if (this.mode === 'ground') this.updateGround(dt);
    else if (this.mode === 'climb') this.updateClimb(dt);
    else if (this.mode === 'fly' || this.mode === 'fall') this.updateFly(dt);
  }
  /* soft and pale in the chamber, then digging up to the forest floor */
  updateDigOut(dt) {
    const W = this.W, inp = this.input;
    this.hardT += dt;
    this.pale = clamp(1 - this.hardT / HARDEN_T, 0, 1);
    if (this.hardT < HARDEN_T) return;
    if (!this.flags.hard) { this.flags.hard = true; Bus.emit('hardened', this); }
    let mx = inp.x, my = inp.y; const m = Math.hypot(mx, my);
    if (m < .1) return;
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 6, 0, 1));
    if (Math.abs(mx) > .3) this.face = sign(mx);
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang), rad = 11 * this.size + 3;
    const nx = this.x + dx * 30 * dt, ny = this.y + dy * 30 * dt;
    if (W.free(nx, ny, rad * .8, false)) { this.x = nx; this.y = ny; this.walk += dt * 10; }
    else {
      const res = W.chew(this.x + dx * rad * .8, this.y + dy * rad * .8, rad + 2, 2.2, dt, { root: true, clay: true, bark: true, heart: true });
      if (res.cells && this.chewClock <= 0) { this.chewClock = .12; AudioFX.chew && AudioFX.chew(1.3); this.G.particles.dust(this.x + dx * rad, this.y + dy * rad, '#6a4a30', 3, this.ang); }
      this.chewClock -= dt;
      if (!res.cells && res.blocked) this.slide(dx, dy, 30 * dt, rad);
    }
    /* out into the air? */
    const top = W.topAt(this.x);
    if (this.y - this.feet <= top + 2 && W.survey(this.x, this.y - rad, rad).sky > 0) this.surface();
  }
  surface() {
    const W = this.W, g = W.groundAt(this.x);
    W.cellsIn(this.x, g + 16, 22, (i, cx, cy) => { if (W.mat[i] === MAT.AIR && !W.sky[i] && cy > W.groundAt(cx) - 2 && !W.inLog(cx, cy)) W.set(i, MAT.SOIL); });
    W.flushTop();
    this.mode = 'ground'; this.ang = 0; this.y = this.W.walkTop(this.x, 10) - this.feet;
    this.G.particles.dust(this.x, this.y + this.feet, '#6a4a30', 18, -Math.PI / 2);
    Bus.emit('surfaced', this);
  }
  /* walking along the forest floor and over the log */
  updateGround(dt) {
    const W = this.W, inp = this.input, s = this.size;
    const sp = (46 + 30 * s) * (this.G.settings.slowmo ? .7 : 1);
    if (Math.abs(inp.x) > .15) { this.face = sign(inp.x); this.x += inp.x * sp * dt; this.walk += dt * 11 * Math.abs(inp.x); this.moving = true; }
    else this.moving = false;
    this.x = clamp(this.x, WORLD.left + 30, WORLD.right - 30);
    const top = W.walkTop(this.x, 10 * s + 4);
    const want = top - this.feet;
    if (want - this.y > 14) { this.mode = 'fall'; this.vy = 0; this.vx = inp.x * sp * .6; return; }
    this.y = want;
    const l = W.walkTop(this.x - 14 * s, 6), rr2 = W.walkTop(this.x + 14 * s, 6);
    this.ang = angleLerp(this.ang, clamp(Math.atan2(rr2 - l, 28 * s), -.7, .7), clamp(dt * 8, 0, 1));
    /* push up at a trunk to climb */
    if (inp.y < -.5) { const T = this.F.treeAt(this.x); if (T) { this.mode = 'climb'; this.perch = { path: T.trunk, s: 6, dir: 1 }; Bus.emit('climbed', this); } else if (this.hintClock <= 0 && this.flags.surfaced) this.say('fly'); }
  }
  /* on a trunk or branch: walk along the path; at a fork, push toward the branch */
  updateClimb(dt) {
    const inp = this.input, P = this.perch, path = P.path, s = this.size;
    const here = path.at_(P.s);
    const tx = Math.cos(here.ang), ty = Math.sin(here.ang);
    let v = inp.x * tx + inp.y * ty;
    if (path === path.parent || !path.parent) { /* a trunk: up/down is along it */ v = -inp.y; if (Math.abs(inp.y) < .2 && Math.abs(inp.x) > .5) v = 0; }
    const sp = (34 + 18 * s) * (this.G.settings.slowmo ? .7 : 1);
    if (Math.abs(v) > .15) { P.s += v * sp * dt; P.dir = sign(v); this.walk += dt * 11; this.moving = true; } else this.moving = false;
    if (!path.parent) {
      /* on the trunk: take a branch? */
      if (Math.abs(inp.x) > .5) for (const br of path.children) if (Math.abs(br.at - P.s) < 16 && br.side === sign(inp.x)) { this.perch = { path: br, s: 3, dir: 1 }; Bus.emit('onBranch', this); break; }
      if (P.s <= 0) { this.mode = 'ground'; this.perch = null; this.y = this.W.walkTop(this.x) - this.feet; this.ang = 0; return; }
      P.s = Math.min(P.s, path.len - 10);
    } else {
      if (P.s <= 0) { this.perch = { path: path.parent, s: path.at, dir: 1 }; }
      P.s = Math.min(P.s, path.len - 8);
    }
    this.placeOnPerch(dt);
    if (P.s > path.len - 30 && !path.parent) Bus.emit('treeTop', this);
  }
  placeOnPerch(dt) {
    const P = this.perch, here = P.path.at_(P.s);
    if (!P.path.parent) {
      /* on the trunk, facing up or down it */
      this.x = here.x; this.y = here.y; this.face = P.dir >= 0 ? 1 : -1;
      this.ang = P.dir >= 0 ? -Math.PI / 2 : Math.PI / 2; this.face = 1;
    } else {
      const nx = Math.sin(here.ang), ny = -Math.cos(here.ang);   /* the "up" side of the branch */
      const up = ny < 0 ? 1 : -1;
      this.x = here.x + nx * up * (here.w / 2 + this.feet * .9); this.y = here.y + ny * up * (here.w / 2 + this.feet * .9);
      this.face = P.dir >= 0 ? (Math.cos(here.ang) >= 0 ? 1 : -1) : (Math.cos(here.ang) >= 0 ? -1 : 1);
      this.ang = here.ang + (Math.cos(here.ang) < 0 ? Math.PI : 0);
    }
  }
  takeOff() {
    this.mode = 'fly'; this.vy = -140; this.vx = this.face * 40; this.perch = null;
    this.stats.flights++;
    if (!this.flags.flown) { this.flags.flown = true; Bus.emit('firstFlight', this); }
    Bus.emit('takeoff', this);
  }
  updateFly(dt) {
    const inp = this.input, W = this.W, F = this.F;
    const flying = this.mode === 'fly' && this.energy > 0;
    const D = this.D;
    if (this.mode === 'fly') { this.energy = Math.max(0, this.energy - dt * .03 * D.energy); this.stats.flyTime += dt; if (this.energy <= 0 && !this.flags.tiredSaid) { this.flags.tiredSaid = true; this.say('tired'); } }
    const g = 420, lift = flying ? 380 : 0;
    this.vx += (flying ? inp.x * 520 : 0) * dt;
    this.vy += (g - lift + (flying ? inp.y * (inp.y < 0 ? 520 : 260) : 0)) * dt;
    const drag = Math.exp(-dt * (flying ? 1.7 : .6));
    this.vx *= drag; this.vy *= flying ? drag : Math.exp(-dt * .3);
    this.vy = Math.min(this.vy, flying ? 220 : 380);
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 12) this.face = sign(this.vx);
    this.ang = clamp(this.vx / 900, -.25, .25) * this.face - (flying ? .18 : 0) + clamp(this.vy / 1200, -.2, .3);
    if (this.x < WORLD.left + 30) { this.x = WORLD.left + 30; this.vx = Math.abs(this.vx) * .3; }
    if (this.x > WORLD.right - 30) { this.x = WORLD.right - 30; this.vx = -Math.abs(this.vx) * .3; }
    if (this.y < WORLD.top + 140) { this.y = WORLD.top + 140; this.vy = Math.abs(this.vy) * .3; }
    if (this.mode === 'fly' && -this.y > 1550 && !this.flags.overTrees) { this.flags.overTrees = true; Bus.emit('overTrees', this); }
    /* landing: on a branch going down, or on the floor */
    if (this.vy > 20) {
      const p = F.nearestPerch(this.x, this.y + this.feet, 12);
      if (p && p.path.parent && (this.mode === 'fall' || inp.y >= 0)) { this.mode = 'climb'; this.perch = { path: p.path, s: p.s, dir: 1 }; this.vx = this.vy = 0; this.placeOnPerch(0); Bus.emit('landed', this, 'branch'); return; }
    }
    const top = W.walkTop(this.x, 10 * this.size + 4);
    if (this.y + this.feet >= top) { this.y = top - this.feet; this.mode = 'ground'; this.vx = this.vy = 0; this.ang = 0; Bus.emit('landed', this, 'ground'); AudioFX.thud && AudioFX.thud(); }
  }

  /* ---------- what Space does right now ---------- */
  near(list, reach) { let best = null, bd = reach; for (const o of list) { const d = Math.hypot(o.x - this.x, (o.y - this.y) * .7); if (d < bd) { bd = d; best = o; } } return best; }
  reach() { return 24 + 34 * this.size; }
  context() {
    if (this.stage === 'egg' || this.stage === 'pupa') return null;
    if (this.stage === 'grub' || this.stage === 'chamber') return this.stage === 'chamber' || this.chamberReady() ? 'build' : null;
    if (this.mode === 'tunnel' || this.mode === 'fly' || this.mode === 'fall' || this.mode === 'wrestle' || this.mode === 'tossed' || this.busy > 0) return null;
    const F = this.F, R = this.reach();
    const fem = F.female(); if (fem && fem.mode === 'ground' && Math.hypot(fem.x - this.x, fem.y - this.y) < R + 30 && !this.flags.met) return 'meet';
    const riv = F.rival(); if (riv && riv.mode === 'ground' && Math.abs(riv.x - this.x) < R + 30 && Math.abs(riv.y - this.y) < 40 && this.mode === 'ground') return 'push';
    if (this.near(F.fruits.filter(f => f.bites > 0 && !f.falling), R)) return 'eat';
    if (this.mode === 'ground' && this.near(F.sticks.filter(s => !s.flipped).map(s => ({ x: s.x, y: this.W.walkTop(s.x) - 6, s })), R + 10)) return 'lift';
    return null;
  }
  act() {
    const v = this.context(), F = this.F, R = this.reach();
    if (!v) return false;
    if (v === 'eat') { const f = this.near(F.fruits.filter(f => f.bites > 0 && !f.falling), R); this.face = sign(f.x - this.x) || this.face; this.startBusy('eat', 1.3, f); }
    else if (v === 'lift') { const st = this.near(F.sticks.filter(s => !s.flipped).map(s => ({ x: s.x, y: this.W.walkTop(s.x) - 6, s })), R + 10).s; this.face = sign(st.x - this.x) || this.face; this.startBusy('lift', 1.4, st); }
    else if (v === 'push') this.startWrestle(F.rival());
    else if (v === 'meet') { const fem = F.female(); this.face = sign(fem.x - this.x) || this.face; this.startBusy('meet', 2.2, fem); }
    else if (v === 'build') this.press();
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy;
    this.busy -= dt;
    if (k === 'eat') { this.eatAnim = t0; if (Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.slurp && AudioFX.slurp(); this.G.particles.puff(this.x + this.face * 30 * this.size, this.y + 4, '#ffd27a', 2); } }
    if (k === 'lift') { this.lift = Math.sin(clamp(t0 / this.busyT, 0, 1) * Math.PI) * 1.2; this.pinch = this.lift * .6; o.t = 1.4; o.lift = this.lift; }
    if (k === 'meet') { if (Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - 30, '♥', '#ff7aa8', 14); }
    if (this.busy > 0) return;
    this.busy = 0; this.eatAnim = 0;
    if (k === 'eat' && o.bites > 0) {
      o.bites--; this.energy = Math.min(1, this.energy + .34); this.stats.fruits++;
      this.flags.tiredSaid = false;
      if (!this.flags.fruit) { this.flags.fruit = true; Bus.emit('firstFruit', this, o); }
      Bus.emit('ate', this, o);
    }
    if (k === 'lift') {
      o.flipped = true; o.lift = 0; this.stats.lifts++;
      AudioFX.heave && AudioFX.heave();
      if (o.hide === 'fruit') this.F.dropFruit(pick(['mango', 'guava', 'fig']), o.x + this.face * 10, true);
      else if (o.hide === 'millipede' || o.hide === 'beetle') this.F.critters.push({ kind: 'scuttle', what: o.hide, x: o.x, y: o.y, dir: this.face, life: 4, ph: 0 });
      if (!this.flags.lifted) { this.flags.lifted = true; Bus.emit('firstLift', this, o); }
      Bus.emit('lifted', this, o);
    }
    if (k === 'meet') { this.flags.met = true; this.stats.met++; Bus.emit('met', this, o); }
  }

  /* ---------- horn wrestling ----------
     Tap Space to push.  A ring shrinks round and round: press E (or up)
     while it is green for a big LIFT.  Push him to the end and he is
     lifted and thrown (he flies away, unhurt). */
  startWrestle(rival) {
    if (!rival) return;
    this.mode = 'wrestle';
    this.face = sign(rival.x - this.x) || 1;
    rival.face = -this.face; rival.mode = 'wrestle';
    const gap = (this.lengthMM + rival.lengthMM) * .19;
    const mid = (this.x + rival.x) / 2;
    this.wr = { rival, p: 0, ring: 0, t: 0, done: null, doneT: 0, mid, gap, flash: 0, combo: 0, taps: 0, lifts: 0 };
    Bus.emit('wrestle', this, rival);
  }
  wrestleWindow() { const w = this.wr; if (!w) return false; const u = (w.ring % 1.8) / 1.8; const wide = this.G.settings.difficulty === 'easy' ? .3 : this.G.settings.difficulty === 'hard' ? .14 : .2; return u > .9 - wide && u < .93; }
  updateWrestle(dt) {
    const w = this.wr, R = w.rival, inp = this.input, D = this.D;
    w.t += dt; w.flash = Math.max(0, w.flash - dt * 3);
    if (w.done) {
      w.doneT += dt;
      if (w.done === 'win') { this.lift = Math.min(1.3, w.doneT * 2); this.pinch = 1; if (R.mode === 'wrestle') { R.y = this.y - this.lift * 26 * this.size; R.spin = w.doneT * 2; } if (w.doneT > .9 && R.mode === 'wrestle') { R.mode = 'tossed'; R.t = 0; R.vx = this.face * 260; R.vy = -360; AudioFX.toss && AudioFX.toss(); } if (w.doneT > 1.4) this.endWrestle(); }
      else { if (w.doneT > .5 && this.mode === 'wrestle') { this.mode = 'tossed'; this.vx = -this.face * 200; this.vy = -330; this.tossT = 0; R.mode = 'ground'; R.leaveIn = 20; AudioFX.toss && AudioFX.toss(); } }
      return;
    }
    const str = 1 + (this.lengthMM - 110) / 120 + this.energy * .25;
    const rStr = D.rival * Math.pow(R.lengthMM / this.lengthMM, 1.4);
    w.ring += dt;
    if (inp.actionPressed) { w.p += .06 * str; w.taps++; this.pinch = .5; AudioFX.push && AudioFX.push(); this.G.particles.dust(w.mid, this.y + this.feet, '#7a5236', 2); }
    const liftKey = inp.eggPressed || (inp.y < -.6 && !this._upHeld);
    this._upHeld = inp.y < -.6;
    if (liftKey) {
      if (this.wrestleWindow()) { w.p += .26 * str; w.flash = 1; w.lifts++; this.lift = .8; AudioFX.heave && AudioFX.heave(); this.G.particles.sparkle(w.mid, this.y - 20, 14, '#fff3b0', 20); }
      else { w.p -= .05; }
    }
    w.p -= rStr * .17 * dt * (1 + Math.sin(w.t * 1.7) * .4);
    w.p = clamp(w.p, -1, 1);
    this.energy = Math.max(0, this.energy - dt * .01 * D.energy);
    /* the pair slides toward whoever is losing */
    const shove = w.p * 22;
    this.x = w.mid - this.face * w.gap + this.face * shove; R.x = w.mid + this.face * w.gap + this.face * shove;
    this.y = this.W.walkTop(this.x, 8) - this.feet; R.y = this.W.walkTop(R.x, 8) - 30 * R.scale * .38;
    this.walk += dt * 6 * (1 + Math.abs(w.p)); this.moving = true;
    if (w.p >= 1) { w.done = 'win'; this.stats.wins++; if (this.stats.wins >= 3) this.flags.champion = true; Bus.emit('wrestleWon', this, R); }
    else if (w.p <= -1) { w.done = 'lose'; this.stats.losses++; Bus.emit('wrestleLost', this, R); }
  }
  endWrestle() {
    const w = this.wr; this.wr = null;
    this.mode = 'ground'; this.moving = false;
    if (w && w.done === 'win') { if (this.flags.champion && !this.flags.champSeen) { this.flags.champSeen = true; Bus.emit('champion', this); } }
  }
  /* flipped off by a rival: the wings pop open and you flutter down */
  updateTossed(dt) {
    this.tossT = (this.tossT || 0) + dt;
    this.vy += 500 * dt; this.vx *= Math.exp(-dt * 1.2);
    if (this.tossT > .6) this.vy = Math.min(this.vy, 90);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.ang += dt * (this.tossT < .6 ? 9 : 0); if (this.tossT >= .6) this.ang = angleLerp(this.ang, 0, dt * 6);
    const top = this.W.walkTop(this.x, 10);
    if (this.y + this.feet >= top && this.vy > 0) {
      this.y = top - this.feet; this.mode = 'ground'; this.ang = 0; this.vx = this.vy = 0; this.wr = null;
      this.energy = Math.max(.15, this.energy - .2);
      Bus.emit('landed', this, 'ground'); Bus.emit('tossedDown', this);
    }
  }

  /* ---------- tap to go ---------- */
  goTo(x, y) { if (this.stage === 'egg' || this.stage === 'pupa') return; this.target = { x, y }; }

  serialize() {
    const o = {};
    for (const k of ['form', 'stage', 'mode', 'x', 'y', 'ang', 'face', 'eggT', 'crack', 'food', 'instar', 'full', 'build', 'room', 'pupaT', 'hardT', 'pale', 'energy', 'wet', 'lengthMM', 'stats', 'flags']) o[k] = this[k];
    if (this.perch) o.perch = { tree: this.G.forest.trees.findIndex(T => T.paths.includes(this.perch.path)), path: null, s: this.perch.s };
    if (o.perch) { const T = this.G.forest.trees[o.perch.tree]; o.perch.path = T ? T.paths.indexOf(this.perch.path) : -1; }
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    if (['egg', 'grub', 'chamber', 'pupa', 'adult'].includes(o.stage)) this.stage = o.stage;
    const modes = { egg: ['egg'], grub: ['tunnel'], chamber: ['tunnel'], pupa: ['pupa'], adult: ['tunnel', 'ground', 'climb', 'fly', 'fall'] }[this.stage];
    this.mode = modes.includes(o.mode) ? o.mode : modes[modes.length > 1 ? 1 : 0];
    if (this.mode === 'fly' || this.mode === 'fall') this.mode = 'fall';
    this.x = clamp(num(o.x, this.x), WORLD.left + 20, WORLD.right - 20); this.y = clamp(num(o.y, this.y), WORLD.top + 100, WORLD.bottom - 20);
    this.ang = num(o.ang, 0); this.face = o.face === -1 ? -1 : 1;
    this.eggT = num(o.eggT, 0); this.crack = num(o.crack, 0); this.food = Math.max(0, num(o.food, 0)); this.instar = clamp(Math.round(num(o.instar, 1)), 1, 3);
    this.full = !!o.full; this.build = num(o.build, 0); this.room = o.room && Number.isFinite(o.room.x) ? { x: o.room.x, y: o.room.y } : null;
    if (this.stage === 'chamber' && !this.room) this.stage = 'grub';
    this.pupaT = num(o.pupaT, 0); this.hardT = num(o.hardT, 0); this.pale = clamp(num(o.pale, 0), 0, 1);
    this.energy = clamp(num(o.energy, 1), 0, 1); this.wet = clamp(num(o.wet, 0), 0, 1); this.lengthMM = clamp(num(o.lengthMM, 120), 50, 180);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = !!o.flags[k];
    /* a gated step that was waiting when the game closed starts again on its own */
    for (const k of ['hatching', 'molt1', 'molt2', 'pupa', 'emerge', 'laying']) delete this.flags[k];
    if (this.stats.wins >= 3) this.flags.champion = true;
    if (this.stage === 'egg') this.crack = 0;
    if (this.mode === 'climb') {
      const T = this.G.forest.trees[o.perch && o.perch.tree], P = T && T.paths[o.perch.path];
      if (P) { this.perch = { path: P, s: clamp(num(o.perch.s, 0), 0, P.len), dir: 1 }; this.placeOnPerch(0); } else this.mode = 'fall';
    }
    this.trail = []; for (let k = 0; k < 14; k++) this.trail.push({ x: this.x - Math.cos(this.ang) * k, y: this.y - Math.sin(this.ang) * k });
  }
}
