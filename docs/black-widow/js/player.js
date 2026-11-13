/* ============================================================
   player.js — you, the black widow, from the egg sac on
   ============================================================
   stage  sac     in the egg sac with your brothers and sisters
          ling    a pale spiderling: climb, balloon, find a home
          young   striped, growing; moult by moult she turns dark
          adult   she: glossy black with the red hourglass
                  he: small, striped, long-legged
   mode   sac     wiggle out (push any arrow)
          walk    on a Line at s: the ground, a wall, an underside,
                  a thread.  Arrows go the way they point.
          hang    on a dragline: down lets out silk, up climbs,
                  left and right swing.  Touch anything and the
                  line is fixed there: a new thread.
          balloon up lets out silk (rise), down pulls it in (sink)
          fall    let go; lands on whatever is below
          curl    curled up on the ground, legs in
          molt · show · wrap · pluck · spin   (player2.js)
   Space is silk: fix an end here, walk, fix the other end.
   Nothing hurts the spider, ever.
   ============================================================ */
'use strict';

const MOLT_T = 2.6;
const SIZE = { girl: [2.4, 3.6, 5, 6.6, 8.4, 11], boy: [2.4, 3.4, 4.4, 5.2] };
const BODY_MM = { girl: [1.5, 3, 5, 7, 10, 13], boy: [1.5, 3, 4.5, 6] };

class Spider {
  constructor(G, form) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'girl'; this.male = FORMS[this.form].male;
    this.stage = 'sac'; this.mode = 'sac';
    this.x = WORLD.sacX; this.y = WORLD.sacY; this.ang = 0; this.face = 1; this.up = { nx: 0, ny: -1 };
    this.line = null; this.s = 0; this.vx = 0; this.vy = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.sacT = 0; this.crack = 0; this.walkPh = 0; this.moving = false;
    this.food = 0; this.instar = 0; this.tight = 0; this.tightT = 0; this.molting = 0;
    this.silk = null; this.rope = null; this.bal = null; this.curlT = 0; this.showT = 0; this.afterFall = null;
    this.busy = 0; this.busyKind = null; this.busyDone = null;
    this.wrap = null; this.pl = null; this.sp = null; this.cutN = 0; this.ansN = 0; this.bunN = 0; this.guardT = 0;
    this.target = null; this.hintClock = 0; this.lastDir = 0;
    this.stats = { threads: 0, gum: 0, meals: 0, molts: 0, drops: 0, balloons: 0, hides: 0, shows: 0, plucks: 0, eggs: 0, leaves: 0, visitors: 0, people: 0, nights: 0, got: 0, away: 0, swept: 0, far: 0 };
    this.flags = {};
  }
  get D() { return this.G.diff(); }
  get Y() { return this.G.yard; }
  get N() { return this.G.yard.net; }
  get last() { return SIZE[this.form].length - 1; }
  get r() { return SIZE[this.form][Math.min(this.instar, this.last)]; }
  get lengthMM() { return BODY_MM[this.form][Math.min(this.instar, this.last)]; }
  get speed() { return (44 + this.r * 4.2) * (this.male && this.stage === 'adult' ? 1.5 : 1) * (this.G.settings.slowmo ? .75 : 1); }
  get maxPrey() { return this.stage === 'adult' ? 4 : Math.min(3, 1 + this.instar); }
  get need() { const th = this.D.molts[this.form]; return this.instar < th.length ? th[this.instar] : Infinity; }
  get underground() { return false; }
  stageKey() {
    if (this.stage === 'sac') return 'sac';
    if (this.stage === 'ling') return 'ling';
    if (this.stage === 'adult') return this.flags.met ? 'parent' : 'adult';
    return this.instar >= 3 ? 'young2' : 'young1';
  }
  /* Read to Play wraps this, so big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 5; Bus.emit('hint', key); }

  update(dt) {
    this.t += dt; this.hintClock -= dt;
    const inp = this.input;
    if (this.target && (inp.x || inp.y)) this.target = null;
    if (this.target && this.mode === 'walk') { const v = this.N.lines.includes(this.target.line) ? this.N.steer(this.line, this.s, this.target.line, this.target.s) : null; if (!v) this.target = null; else { inp.x = v.x; inp.y = v.y; } }
    this.moving = false;
    switch (this.mode) {
      case 'sac': this.updateSac(dt); break;
      case 'walk': this.updateWalk(dt); break;
      case 'hang': this.updateHang(dt); break;
      case 'fall': this.updateFall(dt); break;
      case 'balloon': this.updateBalloon(dt); break;
      case 'curl': this.curlT += dt; if (this.curlT > 1.2 && Math.hypot(inp.x, inp.y) > .3 && !(this.Y.visitor && this.Y.visitor.state === 'look' && this.curlT < 3)) { this.mode = 'walk'; Bus.emit('uncurled', this); } break;
      case 'show': this.showT += dt; if (this.showT > 2.4) this.mode = 'walk'; break;
      case 'molt': this.molting -= dt; if (this.molting <= 0) this.finishMolt(); break;
      case 'wrap': this.updateWrap(dt); break;
      case 'pluck': this.updatePluck(dt); break;
      case 'spin': this.updateSpin(dt); break;
    }
    this.growTight(dt);
    inp.actionPressed = false; inp.eggPressed = false;
  }
  goTo(x, y) {
    if (this.mode === 'hang') { this.input.x = sign(x - this.x); return; }
    if (this.mode !== 'walk') return;
    const q = this.N.locate(x, y, 90); if (q) this.target = { line: q.line, s: q.s };
  }

  /* ---------- the egg sac ---------- */
  updateSac(dt) {
    this.sacT += dt;
    if (this.sacT > 3 && !this.flags.sacReady) { this.flags.sacReady = true; Bus.emit('sacReady', this); }
    const inp = this.input;
    if (this.flags.sacReady && (inp.x || inp.y || inp.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (inp.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    this.stage = 'ling'; this.mode = 'walk';
    const L = this.N.objects.find(o => o.key === 'porch');
    this.setOn(L, L.nearest(WORLD.sacX, -320).s);
    this.G.particles.sparkle(this.x, this.y, 14, '#fff3c0', 20);
    Bus.emit('hatched', this);
  }

  /* ---------- on a line ---------- */
  setOn(line, s) {
    this.line = line; this.s = clamp(s, 0, line.len);
    const q = line.at(this.s), h = this.r * .85;
    this.x = q.x + q.nx * h; this.y = q.y + q.ny * h;
    this.up = { nx: q.nx, ny: q.ny }; this.ang = Math.atan2(q.nx, -q.ny);
    this.foot = { x: q.x, y: q.y };
    return q;
  }
  onGround() { return this.mode === 'curl' || (this.mode === 'walk' && this.line === this.N.ground); }
  atLaunch() { return this.stage === 'ling' && !this.flags.landed && this.mode === 'walk' && Math.hypot(this.x - WORLD.launchX, this.y - WORLD.launchY) < 16; }
  updateWalk(dt) {
    const N = this.N, inp = this.input;
    if (!N.lines.includes(this.line)) { this.startFall(); Bus.emit('threadGone', this); return; }
    if (this.busy > 0) { this.busy -= dt; if (this.busy <= 0) { const f = this.busyDone; this.busyDone = null; this.busyKind = null; if (f) f(); } return; }
    if (inp.actionPressed) { this.act(); if (this.mode !== 'walk' || this.busy > 0) return; }
    if (inp.eggPressed && this.flags.landed) { this.curl(false); return; }
    const m = Math.hypot(inp.x, inp.y); if (m < .2) return;
    const ix = inp.x / m, iy = inp.y / m, L = this.line;
    let best = null;
    const tryDir = (line, s, dir) => { if ((dir > 0 && s >= line.len - .01) || (dir < 0 && s <= .01)) return; const q = line.at(s + dir * .5), d = (q.tx * ix + q.ty * iy) * dir; if (!best || d > best.d) best = { line, s, dir, d }; };
    tryDir(L, this.s, 1); tryDir(L, this.s, -1);
    for (const j of L.junc) if (Math.abs(j.s - this.s) < 6) { tryDir(j.to, j.ts, 1); tryDir(j.to, j.ts, -1); }
    const pureDown = iy > .6 && Math.abs(ix) < .3;
    if (pureDown && best && best.d <= .8 && this.canDrop()) { this.tryDrop(); return; }
    if (best && best.d > .35) {
      const step = this.speed * dt;
      this.setOn(best.line, best.s + best.dir * step);
      const q = best.line.at(this.s), rx = Math.cos(this.ang), ry = Math.sin(this.ang);
      this.face = (q.tx * rx + q.ty * ry) * best.dir >= 0 ? 1 : -1;
      this.walkPh += step * .5; this.moving = true; this.stats.far += step;
    } else if (iy > .6) this.tryDrop();
  }
  /* let go and hang on a line of silk */
  canDrop() {
    if (this.mode !== 'walk' || this.stage === 'sac' || !this.line) return false;
    const q = this.line.at(this.s);
    return (this.line.kind === 'thread' || q.ny > .3) && q.y < -14 && !this.N.inside(q.x, q.y + 9);
  }
  tryDrop() {
    if (!this.canDrop()) return false;
    const q = this.line.at(this.s);
    this.rope = { ax: q.x, ay: q.y, L: 9, th: 0, om: 0, line: this.line, s: this.s };
    this.silk = { x: q.x, y: q.y }; this.mode = 'hang'; this.stats.drops++;
    this.up = { nx: 0, ny: 1 }; this.ang = Math.PI;
    Bus.emit('dropped', this);
    return true;
  }
  updateHang(dt) {
    const r = this.rope, inp = this.input, N = this.N;
    if (!N.lines.includes(r.line)) { this.rope = null; this.startFall(); return; }
    r.L += r.auto ? 170 * dt : inp.y > .3 ? 85 * dt : inp.y < -.3 ? -65 * dt : 0;
    r.om += (-(420 / Math.max(20, r.L)) * Math.sin(r.th) + inp.x * 2.6) * dt; r.om *= 1 - 1.1 * dt;
    const th0 = r.th; r.th = clamp(r.th + r.om * dt, -1.25, 1.25);
    let x = r.ax + Math.sin(r.th) * r.L, y = r.ay + Math.cos(r.th) * r.L;
    if (N.inside(x, y - 1) && y < -this.r) { r.th = th0; r.om *= -.3; x = r.ax + Math.sin(r.th) * r.L; y = r.ay + Math.cos(r.th) * r.L; }
    this.x = x; this.y = y; this.ang = Math.PI - r.th; this.up = { nx: Math.sin(r.th), ny: Math.cos(r.th) }; this.moving = Math.abs(inp.y) > .3;
    if (r.L <= 6) { this.rope = null; this.silk = null; this.mode = 'walk'; this.setOn(r.line, r.s); return; }
    if (inp.actionPressed && this.tight > 0) { this.act(); return; }
    /* touch something: the line is fixed there */
    let hit = null;
    if (y >= -this.r * .9) hit = { line: N.ground, s: clamp(x - WORLD.left, 0, N.ground.len), x, y: 0 };
    else if (r.L > 16) for (const L of N.lines) { const q = L.nearest(x, y); if (q.d < this.r * .7 + 2.5 && Math.hypot(q.x - r.ax, q.y - r.ay) > 14 && (!hit || q.d < hit.d)) { hit = q; hit.line = L; } }
    if (!hit) return;
    this.rope = null; this.silk = null; this.mode = 'walk';
    if (!r.noThread && r.L >= 22) this.makeThread(r.ax, r.ay, hit.x, hit.y, 'drop');
    this.setOn(hit.line, hit.s);
    Bus.emit('touched', this, hit.line);
  }
  startFall(then) { this.mode = 'fall'; this.vy = 0; this.rope = null; this.silk = null; this.afterFall = then || null; this.up = { nx: 0, ny: -1 }; this.ang = 0; }
  updateFall(dt) {
    this.vy = Math.min(this.vy + 520 * dt, 330); this.y += this.vy * dt;
    const N = this.N; let hit = null;
    if (this.y >= -this.r) hit = { line: N.ground, s: clamp(this.x - WORLD.left, 0, N.ground.len) };
    else for (const L of N.objects) { const q = L.nearest(this.x, this.y); if (q.d < this.r + 2 && L.at(q.s).ny < -.3) { hit = q; hit.line = L; } }
    if (!hit) return;
    this.setOn(hit.line, hit.s); this.mode = 'walk';
    const f = this.afterFall; this.afterFall = null; if (f) f();
  }

  /* ---------- ballooning ---------- */
  launch() {
    this.mode = 'balloon'; this.bal = { sl: .55, t: 0 }; this.vx = -30; this.vy = -46; this.line = null; this.stats.balloons++;
    this.up = { nx: 0, ny: -1 }; this.ang = 0; this.face = -1;
    Bus.emit('launched', this);
  }
  updateBalloon(dt) {
    const b = this.bal, inp = this.input, Y = this.Y, N = this.N;
    b.t += dt;
    b.sl = clamp(b.sl + (inp.y < -.3 ? .55 : inp.y > .3 ? -.55 : 0) * dt, 0, 1);
    const warm = Y.thermal(this.x) * (this.y > -430 ? 1 : .2);
    if (warm > .3 && !this.flags.warm) { this.flags.warm = true; Bus.emit('warmAir', this); }
    const wind = -(62 + 26 * b.sl + 14 * Math.sin(b.t * .9)) + inp.x * 16;
    const vyT = 52 - 104 * b.sl - warm * 46 * (.4 + b.sl) + (this.y < -470 ? (-470 - this.y) * 1.2 : 0) + (b.t < 1.2 ? -40 : 0);
    this.vx += (wind - this.vx) * Math.min(1, dt * 1.6); this.vy += (vyT - this.vy) * Math.min(1, dt * 1.8);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.ang = Math.sin(b.t * 1.7) * .25; this.moving = true;
    if (b.t < 1) return;
    let hit = null;
    if (this.y >= -this.r) hit = { line: N.ground, s: clamp(this.x - WORLD.left, 0, N.ground.len) };
    else if (this.x <= WORLD.left + this.r + 1) { const L = N.objects[0]; hit = L.nearest(WORLD.left, this.y); hit.line = L; }
    else for (const L of N.objects) { const q = L.nearest(this.x, this.y); if (q.d < this.r + 2.5 && (!hit || q.d < hit.d)) { hit = q; hit.line = L; } }
    if (!hit) return;
    this.bal = null; this.mode = 'walk'; this.setOn(hit.line, hit.s); this.flags.landed = true;
    Bus.emit('landed', this);
  }

  /* ---------- silk ---------- */
  makeThread(ax, ay, bx, by, how) {
    if (this.Y.own().length >= 34) { this.say('webfull'); return null; }
    const T = this.N.addThread(ax, ay, bx, by, { force: how === 'drop' });
    if (!T) return null;
    this.stats.threads++; if (T.gum) this.stats.gum++;
    T.born = 0;
    this.G.particles.sparkle(bx, by, 8, '#eaf6ff', 14);
    if (typeof AudioFX !== 'undefined' && AudioFX.pluck) AudioFX.pluck(.6 + Math.min(1, T.len / 300));
    Bus.emit('thread', this, T, how);
    return T;
  }
  /* Space with nothing else to do: fix the silk here */
  fix() {
    const f = this.foot; if (!f) return;
    if (this.male && this.stage === 'adult') { this.say('nobuild'); return; }
    if (!this.silk) { this.silk = { x: f.x, y: f.y }; this.G.particles.ring(f.x, f.y, '#eaf6ff', 3, 50, .4); if (typeof AudioFX !== 'undefined' && AudioFX.pop) AudioFX.pop(1.5); Bus.emit('silkStart', this); return; }
    const d = Math.hypot(f.x - this.silk.x, f.y - this.silk.y);
    if (d < 20) { this.say('silkshort'); return; }
    const T = d < 560 ? this.makeThread(this.silk.x, this.silk.y, f.x, f.y, 'walk') : null;
    if (!T) { this.say('snag'); if (typeof AudioFX !== 'undefined' && AudioFX.bump) AudioFX.bump(); }
    this.silk = T ? null : { x: f.x, y: f.y };
  }
}
