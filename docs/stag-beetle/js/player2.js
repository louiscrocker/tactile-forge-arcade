/* ============================================================
   player2.js — the grown beetle: one summer
   ============================================================
   Added to Beetle.prototype so player.js stays the grub's file.
   The flight is the heart of it: a stag beetle flies almost
   standing up, heavy, wobbling, whirring, and bumps into things.
   It has to warm its wings up first.  It sinks unless you hold ↑.
   It turns like a bus.  A hard landing leaves you on your back,
   legs waving, and you rock to get up.  None of this can fail.
   ============================================================ */
'use strict';

Object.assign(Beetle.prototype, {
  updateAdult(dt) {
    const inp = this.input;
    this.flap += dt * 46;
    this.lift = Math.max(0, this.lift - dt * 2); this.pinch = Math.max(0, this.pinch - dt * 2);
    this.wobble = Math.max(0, this.wobble - dt * 1.4);
    const wingsOut = ['fly', 'tossed', 'warmup'].includes(this.mode);
    this.open += ((wingsOut ? 1 : 0) - this.open) * (1 - Math.exp(-dt * 10));
    if (this.mode === 'tunnel') return this.updateDig(dt);
    if (this.mode === 'lifted') return;
    if (this.busy > 0) return this.updateBusy(dt);
    if (this.mode === 'ring') return this.updateRing(dt);
    if (this.mode === 'sneak') return this.updateSneak(dt);
    if (this.mode === 'bite') return this.updateBite(dt);
    if (this.mode === 'tossed') return this.updateTossed(dt);
    if (this.mode === 'flipped') return this.updateFlipped(dt);
    if (this.mode === 'warmup') return this.updateWarmup(dt);
    if (inp.eggPressed) {
      if (this.mode === 'fly') { this.mode = 'fall'; Bus.emit('folded', this); }
      else if (this.flags.holdStill) Bus.emit('hint', 'kid');
      else if (this.mode === 'ground' || this.mode === 'climb') this.startWarmup();
    }
    if (inp.actionPressed && this.mode !== 'fly' && this.mode !== 'fall') this.act();
    if (this.mode === 'ground') this.updateGround(dt);
    else if (this.mode === 'climb') this.updateClimb(dt);
    else if (this.mode === 'fly' || this.mode === 'fall') this.updateFly(dt);
  },

  /* ---------- digging: up out of the cocoon, or (she) down to lay ---------- */
  updateDig(dt) {
    const W = this.W, inp = this.input;
    this.hardT += dt;
    this.pale = clamp(1 - this.hardT / HARDEN_T, 0, 1);
    if (this.hardT < HARDEN_T) return;
    if (!this.flags.hard) { this.flags.hard = true; Bus.emit('hardened', this); }
    if (inp.actionPressed && this.flags.digDown && !this.flags.laid) this.layEgg();
    if (this.flags.digDown && !this.flags.laid) this.sniffWood(dt);
    let mx = inp.x, my = inp.y; const m = Math.hypot(mx, my);
    if (m < .1) return;
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 6, 0, 1));
    if (Math.abs(mx) > .3) this.face = sign(mx);
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang), rad = 11 * this.size + 3, sp = this.male ? 34 : 46;
    const nx = this.x + dx * sp * dt, ny = this.y + dy * sp * dt;
    const blocked = this.flags.digDown && !this.flags.laid && dy < 0 && ny < W.groundAt(nx) + 26;
    if (blocked) { this.say('laymore'); return; }
    if (W.free(nx, ny, rad * .8, false)) { this.x = nx; this.y = ny; this.walk += dt * 10; this.moving = true; }
    else {
      const res = W.chew(this.x + dx * rad * .8, this.y + dy * rad * .8, rad + 2, 2.4, dt, { root: true, clay: true, bark: true, heart: true });
      if (res.cells && this.chewClock <= 0) { this.chewClock = .12; AudioFX.chew && AudioFX.chew(1.3); this.G.particles.dust(this.x + dx * rad, this.y + dy * rad, '#6a4a30', 3); }
      this.chewClock -= dt;
      if (!res.cells && res.blocked) this.slide(dx, dy, sp * dt, rad);
    }
    if (this.y - this.feet <= W.topAt(this.x) + 2 && W.survey(this.x, this.y - rad, rad).sky > 0 && (!this.flags.digDown || this.flags.laid)) this.surface();
  },
  surface() {
    const W = this.W, g = W.groundAt(this.x);
    W.cellsIn(this.x, g + 16, 22, (i, cx, cy) => { if (W.mat[i] === MAT.AIR && !W.sky[i] && cy > W.groundAt(cx) - 2 && !W.inWood(cx, cy)) W.set(i, MAT.SOIL); });
    W.flushTop();
    this.mode = 'ground'; this.ang = 0; this.y = W.walkTop(this.x, 10) - this.feet;
    this.G.particles.dust(this.x, this.y + this.feet, '#6a4a30', 18, -Math.PI / 2);
    Bus.emit('surfaced', this);
  },
  /* her arrow: the nearest old wood with room for one more egg */
  sniffWood(dt) {
    this.sniffClock -= dt; if (this.sniffClock > 0) return;
    this.sniffClock = 1;
    const W = this.W; let best = null, bd = 1e9;
    for (let k = 0; k < 900; k++) {
      const a = k * 2.399, d = 20 + Math.sqrt(k) * 16, x = this.x + Math.cos(a) * d, y = this.y + Math.sin(a) * d * .8;
      const m = W.matAt(x, y); if ((m !== MAT.ROT && m !== MAT.PUNK) || y - W.groundAt(x) < 50) continue;
      if (this.F.eggs.some(e => Math.hypot(e.x - x, e.y - y) < 44)) continue;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    this.foodHint = best;
  },
  canLay() {
    if (!this.flags.digDown || this.flags.laid || this.mode !== 'tunnel' || this.hardT < HARDEN_T) return false;
    const W = this.W, d = this.y - W.groundAt(this.x);
    if (d < 40) return false;
    const sv = W.survey(this.x, this.y, 30); let wood = false;
    W.cellsIn(this.x, this.y, 34, (i) => { const m = W.mat[i]; if (m === MAT.ROT || m === MAT.PUNK) wood = true; });
    if (!wood) return false;
    return !this.F.eggs.some(e => Math.hypot(e.x - this.x, e.y - this.y) < 30) && sv.n > 0;
  },
  layEgg() {
    if (!this.canLay()) { this.say(this.y - this.W.groundAt(this.x) < 40 ? 'digdeeper' : this.F.eggs.some(e => Math.hypot(e.x - this.x, e.y - this.y) < 30) ? 'eggspace' : 'findwood'); return; }
    const done = () => {
      this.F.eggs.push({ x: this.x + this.face * 6, y: this.y + 4 }); this.stats.eggs++;
      AudioFX.magic && AudioFX.magic(); this.G.particles.sparkle(this.x, this.y, 10, '#fff3c0', 16);
      Bus.emit('layEgg', this, this.stats.eggs);
      if (this.stats.eggs >= this.D.eggs) { this.flags.laid = true; Bus.emit('laidAll', this); }
    };
    if (this.stats.eggs + 1 >= this.D.eggs) this.milestone('eggs', done); else done();
  },
  startDig() {
    const W = this.W;
    this.mode = 'tunnel'; this.flags.digDown = true; this.hardT = 99; this.pale = 0; this.ang = Math.PI / 2; this.flags.hard = true;
    W.blob(this.x, W.groundAt(this.x) + 14, 12, 12, MAT.AIR, (m) => m !== MAT.ROCK);
    this.y = W.groundAt(this.x) + 12;
    Bus.emit('digDown', this);
  },

  /* ---------- walking and climbing ---------- */
  updateGround(dt) {
    const W = this.W, inp = this.input, s = this.size;
    this.energy = Math.min(1, this.energy + dt * .06);
    const sp = (58 + 60 * s) * (this.G.settings.slowmo ? .7 : 1);
    if (Math.abs(inp.x) > .15) { this.face = sign(inp.x); this.x += inp.x * sp * dt; this.walk += dt * 11 * Math.abs(inp.x); this.moving = true; }
    else this.moving = false;
    this.x = clamp(this.x, WORLD.left + 30, WORLD.right - 30);
    const top = W.walkTop(this.x, 10 * s + 4), want = top - this.feet;
    if (want - this.y > 14) { this.mode = 'fall'; this.vy = 0; this.vx = inp.x * sp * .6; return; }
    this.y = want;
    const l = W.walkTop(this.x - 14 * s, 6), rr2 = W.walkTop(this.x + 14 * s, 6);
    this.ang = angleLerp(this.ang, clamp(Math.atan2(rr2 - l, 28 * s), -.7, .7), clamp(dt * 8, 0, 1));
    if (inp.y < -.5) { const T = this.F.treeAt(this.x); if (T) { this.mode = 'climb'; this.perch = { path: T.trunk, s: 6, dir: 1 }; Bus.emit('climbed', this); } else this.say('flyup'); }
  },
  updateClimb(dt) {
    const inp = this.input, P = this.perch, path = P.path, s = this.size, here = path.at_(P.s);
    this.energy = Math.min(1, this.energy + dt * .06);
    const tx = Math.cos(here.ang), ty = Math.sin(here.ang);
    let v = inp.x * tx + inp.y * ty;
    if (!path.parent) { v = -inp.y; if (Math.abs(inp.y) < .2 && Math.abs(inp.x) > .5) v = 0; }
    const sp = (44 + 40 * s) * (this.G.settings.slowmo ? .7 : 1);
    if (Math.abs(v) > .15) { P.s += v * sp * dt; P.dir = sign(v); this.walk += dt * 11; this.moving = true; } else this.moving = false;
    if (!path.parent) {
      if (Math.abs(inp.x) > .5) for (const br of path.children) if (Math.abs(br.at - P.s) < 22 && br.side === sign(inp.x)) { this.perch = { path: br, s: 3, dir: 1 }; Bus.emit('onBranch', this); return; }
      if (P.s <= 0) { this.mode = 'ground'; this.perch = null; this.y = this.W.walkTop(this.x) - this.feet; this.ang = 0; return; }
      P.s = Math.min(P.s, path.len - 10);
    } else {
      if (P.s <= 0) this.perch = { path: path.parent, s: path.at, dir: 1 };
      else P.s = Math.min(P.s, path.len - 8);
    }
    this.placeOnPerch();
  },
  placeOnPerch() {
    const P = this.perch, q = perchPos(P.path, P.s, this.feet * (P.path.parent ? 1 : 0));
    this.x = q.x; this.y = q.y;
    if (!P.path.parent) { this.ang = P.dir >= 0 ? -Math.PI / 2 : Math.PI / 2; this.face = 1; }
    else { this.face = P.dir >= 0 ? (Math.cos(q.here.ang) >= 0 ? 1 : -1) : (Math.cos(q.here.ang) >= 0 ? -1 : 1); this.ang = q.ang; }
  },

  /* ---------- flying like a small helicopter full of soup ---------- */
  startWarmup() {
    if (this.mode === 'climb') { this.perchFrom = this.perch; }
    this.modeFrom = this.mode; this.mode = 'warmup'; this.wingUp = 0;
    AudioFX.whirrStart && AudioFX.whirrStart();
    Bus.emit('warmup', this);
  },
  updateWarmup(dt) {
    this.wingUp += dt / .75;
    this.y += Math.sin(this.t * 50) * .25;
    if (this.wingUp >= 1) {
      this.mode = 'fly'; this.vy = -110; this.vx = this.face * 30; this.perch = null; this.sway = 0; this.swayV = .6;
      this.stats.flights++;
      if (!this.flags.flown) { this.flags.flown = true; Bus.emit('firstFlight', this); }
      Bus.emit('takeoff', this);
    }
  },
  updateFly(dt) {
    const inp = this.input, F = this.F, D = this.D, flying = this.mode === 'fly', heavy = this.male ? 1 + (this.lengthMM - 50) / 100 : .85;
    if (flying) { this.energy = Math.max(0, this.energy - dt * .022 * D.energy); this.stats.flyTime += dt; }
    const tired = this.energy <= .02;
    if (tired && !this.flags.tiredSaid) { this.flags.tiredSaid = true; Bus.emit('hint', 'tired'); }
    if (!tired) this.flags.tiredSaid = false;
    const warm = flying ? F.warmAt(this.x, this.y) : null;
    /* always sinking; ↑ whirrs you up; warm air lifts you for free */
    const g = flying ? 210 * heavy : 430, up = flying ? (inp.y < -.1 ? (tired ? 230 : 390) * -inp.y : 0) + (warm ? g * (this.y > -150 ? 1.25 : .8) : 0) : 0, down = flying && inp.y > .1 ? 200 : 0;
    this.vx += (flying ? inp.x * (tired ? 70 : 118) / heavy : 0) * dt;
    this.vy += (g - up + down) * dt;
    /* the wobble: a spring that the wind and every turn keep kicking */
    const gust = F.weather.gust;
    this.swayV += (-16 * this.sway - 1.6 * this.swayV + Math.sin(this.t * 3.1) * 2.2 + (this.wobble * Math.sin(this.t * 19) * 16) + (inp.x * 2.4) + gust * Math.sin(this.t * 7) * 6) * dt;
    this.sway += this.swayV * dt;
    if (flying) this.vx += this.sway * 50 * dt;
    const drag = Math.exp(-dt * (flying ? .9 : .5));
    this.vx *= drag; this.vy *= flying ? Math.exp(-dt * 1.1) : Math.exp(-dt * .3);
    this.vy = clamp(this.vy, -210, flying ? 190 : 380);
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 14) this.face = sign(this.vx);
    this.ang = flying ? this.face * (-1.05 + this.sway * .5) + clamp(this.vx / 500, -.3, .3) : this.ang;
    if (flying && warm && this.t > (this.warmSpark || 0)) { this.warmSpark = this.t + .25; this.energy = Math.min(1, this.energy + .012); this.G.particles.sparkle(this.x, this.y + 20, 2, '#ffd9a0', 20); Bus.emit('warmAir', this); }
    if (this.x < WORLD.left + 30) { this.x = WORLD.left + 30; this.vx = Math.abs(this.vx) * .3; }
    if (this.x > WORLD.right - 30) { this.x = WORLD.right - 30; this.vx = -Math.abs(this.vx) * .3; }
    if (this.y < -900) { this.y = -900; this.vy = Math.abs(this.vy) * .3; Bus.emit('hint', 'toohigh'); }
    /* scent puffs: a sniff of the trail lifts your spirits */
    for (const q of F.puffs) if (!q.got && Math.hypot(q.x - this.x, q.y - this.y) < 46) { q.got = 1; this.stats.puffs++; this.energy = Math.min(1, this.energy + .1); this.G.particles.sparkle(q.x, q.y, 8, '#ffe9a0', 26); AudioFX.puff && AudioFX.puff(); Bus.emit('puff', this, q); }
    /* bumps */
    if (flying && this.t > (this.bonkCool || 0)) { const b = F.bonkAt(this.x, this.y, 16 + 20 * this.size); if (b) this.bonk(b); }
    /* landing: on a branch going down, or the lawn */
    if (this.vy > 10 && (this.mode === 'fall' || inp.y >= 0)) {
      const p = F.nearestPerch(this.x, this.y + this.feet, p2near(this));
      if (p && p.path.parent && landOK(this, p)) { this.mode = 'climb'; this.perch = { path: p.path, s: p.s, dir: this.vx * Math.cos(p.path.at_(p.s).ang) >= 0 ? 1 : -1 }; this.vx = this.vy = 0; this.placeOnPerch(); this.stats.landings = (this.stats.landings || 0) + 1; AudioFX.thud && AudioFX.thud(.4); Bus.emit('landed', this, 'branch', p); return; }
    }
    const top = this.W.walkTop(this.x, 10 * this.size + 4);
    if (this.y + this.feet >= top) {
      const hard = this.vy > 130 || Math.abs(this.vx) > 170;
      if (Math.abs(this.x - WORLD.pondX) < WORLD.pondW && this.vy > 60) { this.vy = -Math.max(120, this.vy * .7); this.y = top - this.feet - 2; AudioFX.splash && AudioFX.splash(); this.G.particles.splat(this.x, this.y + 6, '#bfe3ff', 10); Bus.emit('skip', this); return; }
      this.y = top - this.feet; this.vx = this.vy = 0; this.ang = 0;
      AudioFX.thud && AudioFX.thud(hard ? 1 : .5);
      if (hard) this.flipOver(); else { this.mode = 'ground'; Bus.emit('landed', this, 'ground'); }
    }
  },
  bonk(what) {
    this.bonkCool = this.t + .9; this.stats.bonks++; this.vx = -this.vx * .7 - this.face * 30; this.vy = -40; this.wobble = 1; this.G.cam.shake = .3;
    AudioFX.bonk && AudioFX.bonk();
    this.G.particles.text(this.x, this.y - 30, 'BONK!', '#fff3c0', 22);
    Bus.emit('bonk', this, what);
  },
  flipOver() { this.mode = 'flipped'; this.rock = 0; this.rockT = 0; this.stats.flips++; Bus.emit('flipped', this); },
  updateFlipped(dt) {
    const inp = this.input;
    this.rockT += dt; this.walk += dt * 22;
    if (inp.actionPressed || (Math.abs(inp.x) > .5 && !this._rocked) || inp.eggPressed) { this.rock++; this.ang = (this.rock % 2 ? 1 : -1) * .35; AudioFX.creak && AudioFX.creak(.6); }
    this._rocked = Math.abs(inp.x) > .5;
    this.ang *= Math.exp(-dt * 3);
    if (this.rock >= 3 || this.rockT > 6) { this.mode = 'ground'; this.ang = 0; this.y -= 2; this.G.particles.dust(this.x, this.y + this.feet, '#6a4a30', 8, -Math.PI / 2); Bus.emit('rightedSelf', this); }
  },

  /* ---------- what Space does right now ---------- */
  near(list, reach) { let best = null, bd = reach; for (const o of list) { const d = Math.hypot(o.x - this.x, (o.y - this.y) * .7); if (d < bd) { bd = d; best = o; } } return best; },
  reach() { return 34 + 40 * this.size; },
  onBranch() { return this.mode === 'climb' && !!this.perch && this.perch.path === this.F.ringPath; },
  context() {
    if (this.stage === 'egg' || this.stage === 'pupa') return null;
    if (this.stage === 'grub' || this.stage === 'chamber') return this.stage === 'chamber' || this.chamberReady() ? 'build' : null;
    if (this.mode === 'tunnel') return this.flags.digDown && !this.flags.laid && this.canLay() ? 'lay' : null;
    if (!['ground', 'climb'].includes(this.mode) || this.busy > 0) return null;
    const F = this.F, R = this.reach(), fl = this.flags, h = F.hunter;
    if (h && h.state === 'look' && this.mode === 'ground' && Math.abs(h.x - this.x) < 130) return 'rear';
    const fem = F.female();
    if (fem && this.male && fem.mode === 'perch' && !fl.met && Math.hypot(fem.x - this.x, fem.y - this.y) < R + 40) return 'hi';
    if (!this.male && fl.wantMeet && !fl.met) { const m = F.rival(); if (m && m.mode === 'perch' && Math.hypot(m.x - this.x, m.y - this.y) < R + 40) return 'hi'; }
    if (Math.hypot(F.sap.x - this.x, F.sap.y - this.y) < R + 30) {
      if (!this.male && !F.sap.on && !fl.sapDone) return 'bite';
      if (F.sap.flow > .4 && !fl.sapDone) return 'eat';
    }
    if (fl.searching && this.mode === 'ground') { const s = F.sites.find(q => Math.abs(q.x - this.x) < 70 && !q.tried); if (s) return 'sniff'; }
    if (fl.digHere && this.mode === 'ground' && Math.abs(this.x - WORLD.pileX) < 110) return 'dig';
    if (this.onBranch() && this.male && !fl.met && !fl['ev' + this.G.evening]) {
      const rs = F.rivals().filter(r => r.mode === 'perch');
      if (rs.length >= 2) return 'sneak';
      if (rs[0] && Math.abs(rs[0].s - this.perch.s) < 130) return 'push';
    }
    return null;
  },
  act() {
    const v = this.context(), F = this.F;
    if (!v) return false;
    if (v === 'eat') { this.startBusy('eat', 1.6, F.sap); }
    else if (v === 'bite') this.startBite();
    else if (v === 'push') this.startRing(F.rivals().find(r => r.mode === 'perch'));
    else if (v === 'sneak') this.startSneak();
    else if (v === 'hi') { this.startBusy('hi', 2.2, this.male ? F.female() : F.rival()); }
    else if (v === 'rear') { this.startBusy('rear', 1, null); this.lift = 1.2; this.stats.rears++; F.scare(); AudioFX.huff && AudioFX.huff(); }
    else if (v === 'sniff') { this.startBusy('sniff', 1.4, F.sites.find(q => Math.abs(q.x - this.x) < 70 && !q.tried)); }
    else if (v === 'dig') this.startDig();
    else if (v === 'build') this.press();
    else if (v === 'lay') this.layEgg();
    Bus.emit('act', this, v);
    return true;
  },
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; },
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy;
    this.busy -= dt;
    if (k === 'eat') { this.eatAnim = t0; if (Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.slurp && AudioFX.slurp(); } }
    if (k === 'hi' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - 30, '♥', '#ff7aa8', 14);
    if (k === 'rear') this.lift = 1.2;
    if (this.busy > 0) return;
    this.busy = 0; this.eatAnim = 0;
    if (k === 'eat') { this.energy = 1; this.stats.sips++; this.flags.sapDone = true; Bus.emit('ateSap', this); }
    if (k === 'hi') { this.flags.met = true; this.stats.met++; Bus.emit('met', this, o); }
    if (k === 'sniff') { o.tried = true; Bus.emit('sniffed', this, o); }
  },

  /* ---------- the Antler Ring ---------- */
  startRing(rival) {
    if (!rival) return;
    const F = this.F, path = F.ringPath;
    this.mode = 'ring'; this.ring = new Ring(this, rival, this.D);
    this.ringMid = path.len * .47; this.ringGap = this.F.lockGap(this, rival) / 2; rival.mode = 'ring';
    this.perch = { path, s: this.ringMid - this.ringGap, dir: 1 };
    Bus.emit('ringStart', this, rival);
  },
  updateRing(dt) {
    const w = this.ring, R = w.rival, inp = this.input, path = this.F.ringPath;
    w.update(dt, inp.actionPressed, inp.eggPressed || (inp.y < -.6 && !this._upHeld)); this._upHeld = inp.y < -.6;
    this.walk += dt * (6 + Math.abs(w.shove) * 10); this.moving = true;
    const shift = w.pos * path.len * .36;
    this.perch.s = clamp(this.ringMid + shift - this.ringGap, 8, path.len - 8); this.perch.dir = 1; this.placeOnPerch();
    /* the two pairs of jaws lock: heads down and straining on a hold, a real lift when you hook him */
    const hold = w.done === 'win' ? 1 : w.state === 'lift' ? clamp(w.lifts / 3, .2, 1) : 0, strain = Math.sin(this.t * 26) * .014;
    this.jaw = lerp(.3, -.3, hold) + strain; this.rear = hold * .3; this.ringHold = hold;
    R.jaw = (w.state === 'open' || w.move === 'feint' && w.state === 'tell' ? .02 : .3) - strain; R.tilt = -hold * .62;
    if (w.done === 'win' && w.doneT > .15) { R.lift = Math.min(1.5, w.doneT * 2); }
    const rs = this.ringMid + shift + this.ringGap + (w.closing() * 9 - w.shove * 10) * R.scale / .41 - hold * (this.ringGap * 2 - 58 * this.size / .43), q = perchPos(path, clamp(rs, 8, path.len - 2), R.feet);
    if (R.mode === 'ring') { R.x = q.x; R.y = q.y - hold * 44 * this.size / .43 - (w.done === 'win' ? R.lift * 20 : 0); R.ang = q.ang; R.face = 1; R.s = rs; R.walk += dt * 6; }
    if (w.done && w.doneT > .7) this.endRing();
  },
  endRing() {
    const w = this.ring, R = w.rival; this.ring = null; this.moving = false; this.jaw = 0; this.rear = 0; R.jaw = 0; R.tilt = 0;
    if (w.done === 'win') { this.mode = 'climb'; this.stats.wins++; this.stats.blocks += w.stats.blocks; R.toss(-1); Bus.emit('ringOver', this, R); }
    else { this.stats.losses++; this.ringLosses[R.rivalDef.key] = (this.ringLosses[R.rivalDef.key] || 0) + 1; this.mode = 'tossed'; this.vx = 170; this.vy = -300; this.tossT = 0; this.perch = null; R.mode = 'perch'; R.s = this.F.ringPath.len * .55; R.lift = 0; }
  },
  updateTossed(dt) {
    this.tossT = (this.tossT || 0) + dt;
    this.vy += 500 * dt; this.vx *= Math.exp(-dt * 1.2);
    if (this.tossT > .6) this.vy = Math.min(this.vy, 90);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.ang += dt * (this.tossT < .6 ? 9 : 0); if (this.tossT >= .6) this.ang = angleLerp(this.ang, 0, dt * 6);
    const top = this.W.walkTop(this.x, 10);
    if (this.y + this.feet >= top && this.vy > 0) {
      this.y = top - this.feet; this.mode = 'ground'; this.ang = 0; this.vx = this.vy = 0;
      Bus.emit('landed', this, 'ground'); Bus.emit('tossedDown', this);
    }
  },

  /* ---------- the sneak: under the branch while the big ones are busy ---------- */
  startSneak() {
    const path = this.F.ringPath;
    this.mode = 'sneak'; this.sn = { s: Math.max(10, path.len * .1), state: 'locked', t: 0, next: 3 + Math.random() * 1.5, shoo: 0, goal: path.len - 34, caught: 0 };
    this.stats.sneakTries = (this.stats.sneakTries || 0) + 1;
    Bus.emit('sneakStart', this);
  },
  updateSneak(dt) {
    const n = this.sn, path = this.F.ringPath, inp = this.input, D = this.D;
    n.t += dt; n.shoo = Math.max(0, n.shoo - dt);
    const v = Math.abs(inp.x) > .15 || Math.abs(inp.y) > .15;
    /* towards the tip means pushing ← on this branch; ↑ or ← both creep on, for small hands */
    const go = inp.x < -.15 || inp.y < -.15, back = inp.x > .15;
    if (n.shoo <= 0) { if (go) { n.s += (56 + 30 * this.size) * dt; this.walk += dt * 9; this.moving = true; } else if (back) { n.s -= 40 * dt; this.moving = true; } else this.moving = false; }
    const lookT = 1.6 + (D === DIFFICULTY.hard ? .6 : 0), warn = D === DIFFICULTY.easy ? 1.2 : .9;
    if (n.state === 'locked' && n.t > n.next) { n.state = 'warn'; n.t = 0; Bus.emit('sneakWarn', this); }
    else if (n.state === 'warn' && n.t > warn) { n.state = 'look'; n.t = 0; }
    else if (n.state === 'look') {
      if (v && n.t > .2 && n.shoo <= 0) { n.shoo = 1; n.s = Math.max(10, n.s - 70); n.caught++; AudioFX.huff && AudioFX.huff(); Bus.emit('sneakCaught', this); }
      if (n.t > lookT) { n.state = 'locked'; n.t = 0; n.next = 2.6 + Math.random() * 1.8; }
    }
    n.s = clamp(n.s, 8, path.len - 6);
    const here = path.at_(n.s);
    this.x = here.x; this.y = here.y + here.w / 2 + this.feet; this.ang = here.ang + Math.PI; this.face = -1;
    if (n.s >= n.goal) {
      this.sn = null; this.mode = 'climb'; this.perch = { path, s: path.len - 40, dir: 1 }; this.moving = false; this.placeOnPerch();
      this.stats.sneaks++; Bus.emit('sneaked', this);
    }
  },

  /* ---------- her jaws in the bark ---------- */
  startBite() { this.mode = 'bite'; this.bite = { t: 0, ok: 0, flash: 0 }; Bus.emit('biteStart', this); },
  biteOpen() { const b = this.bite; if (!b) return false; const u = (b.t % 1.5) / 1.5; return u > (this.D === DIFFICULTY.easy ? .55 : .68); },
  updateBite(dt) {
    const b = this.bite, F = this.F; b.t += dt; b.flash = Math.max(0, b.flash - dt * 3);
    if (this.input.actionPressed) {
      if (this.biteOpen()) { b.ok++; b.flash = 1; b.t = 0; this.pinch = 1; AudioFX.chew && AudioFX.chew(1.4); this.G.particles.dust(F.sap.x, F.sap.y, '#6a4a30', 8); Bus.emit('bit', this, b.ok); }
      else Bus.emit('hint', 'bitewait');
    }
    if (b.ok >= 3) { this.mode = 'climb'; this.bite = null; F.sap.on = true; AudioFX.magic && AudioFX.magic(); Bus.emit('sapFlows', this); }
  },

  lifted() { this.mode = 'lifted'; this.perch = null; this.moving = false; this.ang = 0; this.target = null; },
  putDown() { this.mode = 'ground'; this.y = this.W.walkTop(this.x, 10) - this.feet; this.ang = 0; },

  serialize() {
    const o = {};
    for (const k of ['form', 'stage', 'mode', 'x', 'y', 'ang', 'face', 'eggT', 'crack', 'food', 'instar', 'full', 'build', 'room', 'pupaT', 'hardT', 'pale', 'energy', 'lengthMM', 'stats', 'flags', 'ringLosses']) o[k] = this[k];
    if (this.perch) { const T = this.F.trees.find(T => T.paths.includes(this.perch.path)); o.perch = { tree: this.F.trees.indexOf(T), path: T ? T.paths.indexOf(this.perch.path) : -1, s: this.perch.s }; }
    return o;
  },
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) { this.form = o.form; this.male = FORMS[o.form].male; }
    if (['egg', 'grub', 'chamber', 'pupa', 'adult'].includes(o.stage)) this.stage = o.stage;
    const modes = { egg: ['egg'], grub: ['tunnel'], chamber: ['tunnel'], pupa: ['pupa'], adult: ['tunnel', 'ground', 'climb', 'fall'] }[this.stage];
    const m = { fly: 'fall', warmup: 'ground', flipped: 'ground', tossed: 'fall', lifted: 'ground', ring: 'climb', sneak: 'climb', bite: 'climb' }[o.mode] || o.mode;
    this.mode = modes.includes(m) ? m : modes[modes.length > 1 ? 1 : 0];
    this.x = clamp(num(o.x, this.x), WORLD.left + 20, WORLD.right - 20); this.y = clamp(num(o.y, this.y), WORLD.top + 100, WORLD.bottom - 20);
    this.ang = num(o.ang, 0); this.face = o.face === -1 ? -1 : 1;
    this.eggT = num(o.eggT, 0); this.crack = num(o.crack, 0); this.food = Math.max(0, num(o.food, 0)); this.instar = clamp(Math.round(num(o.instar, 1)), 1, 3);
    this.full = !!o.full; this.build = num(o.build, 0); this.room = o.room && Number.isFinite(o.room.x) ? { x: o.room.x, y: o.room.y } : null;
    if (this.stage === 'chamber' && !this.room) this.stage = 'grub';
    this.pupaT = num(o.pupaT, 0); this.hardT = num(o.hardT, 0); this.pale = clamp(num(o.pale, 0), 0, 1);
    this.energy = clamp(num(o.energy, 1), 0, 1); this.lengthMM = clamp(num(o.lengthMM, 60), 30, 76);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = !!o.flags[k];
    if (o.ringLosses && typeof o.ringLosses === 'object') for (const r of RIVALS) if (Number.isFinite(o.ringLosses[r.key])) this.ringLosses[r.key] = o.ringLosses[r.key];
    /* a gated step that was waiting when the game closed starts again on its own */
    for (const k of ['hatching', 'molt1', 'molt2', 'pupa', 'emerge']) delete this.flags[k];
    if (this.instar >= 2) this.flags.molt1 = true; if (this.instar >= 3) this.flags.molt2 = true;
    if (this.stage === 'egg') this.crack = 0;
    if (this.mode === 'climb') {
      const T = this.F.trees[o.perch && o.perch.tree], P = T && T.paths[o.perch.path];
      if (P) { this.perch = { path: P, s: clamp(num(o.perch.s, 0), 0, P.len), dir: 1 }; this.placeOnPerch(); } else this.mode = 'fall';
    }
    this.trail = []; for (let k = 0; k < 14; k++) this.trail.push({ x: this.x - Math.cos(this.ang) * k, y: this.y - Math.sin(this.ang) * k });
  }
});
/* a heavy flyer lands where it is heading; it does not stop at every twig on the way */
function landOK(b, p) { const g = b.F.scentTo; return !g || (g.y < -60 && p.path === (b.F.scentPath || b.F.ringPath)); }
/* landing is forgiving near the night's goal */
function p2near(p) { const g = p.F.scentTo; return g && Math.hypot(g.x - p.x, g.y - p.y) < 160 ? 44 : 20; }
