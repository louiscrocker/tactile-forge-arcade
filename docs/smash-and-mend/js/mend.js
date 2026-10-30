/* ============================================================
   mend.js — Pip: climb the drainpipes, walk the scaffold, fix
   what's broken, and catch falling things in the bucket.
   Falling things come from the oak tree, the pigeons, the
   clumsy crane next door, or the storm.  A thing that bumps Pip
   gives a dizzy wobble; one that clips a mended window may crack
   it again (not on Easy).  Feathers are just for catching.
   ============================================================ */
'use strict';

const THINGS = {
  acorn:    { r: 8,  bonk: true,  pts: 20, word: 'acorn' },
  twig:     { r: 11, bonk: true,  pts: 20, word: 'twig' },
  feather:  { r: 9,  bonk: false, pts: 15, word: 'feather', slow: true },
  pot:      { r: 12, bonk: true,  pts: 30, word: 'flowerpot' },
  leafball: { r: 12, bonk: true,  pts: 20, word: 'leaves', slow: true },
  bucket:   { r: 12, bonk: true,  pts: 30, word: 'bucket' },
  paint:    { r: 11, bonk: true,  pts: 30, word: 'paint pot' },
  bolt:     { r: 8,  bonk: true,  pts: 25, word: 'bolt' },
  sandbag:  { r: 13, bonk: true,  pts: 35, word: 'sandbag' }
};
const PIP_REACH_X = 34, PIP_REACH_UP = 62;

Object.assign(Level.prototype, {
  ladderAt(a) {
    const c = Math.floor(a.x / CELL);
    if (Math.abs(a.x - (c + .5) * CELL) > 14) return null;
    if (!this.isLadder(c, Math.floor((a.y - 1) / CELL)) && !this.isLadder(c, Math.floor((a.y + 1) / CELL))) return null;
    return c;
  },
  floorNear(y, c0, c1, tol) {
    if (Math.abs(y - GROUND_Y) <= tol) return GROUND_Y;
    for (let s = 1; s <= (this.house ? this.house.storeys : 0); s++) { const fy = this.floorY(s); if (Math.abs(y - fy) <= tol) { for (let c = c0; c <= c1; c++) if (this.isPlat(c, ROWS - 3 * s)) return fy; } }
    return null;
  },
  controlPip(a, i, dt) {
    a.cool -= dt; a.fixT = Math.max(0, a.fixT - dt); a.squash = Math.max(0, a.squash - dt * 4); a.anim += dt;
    if (a.dizzy > 0) {
      a.dizzy -= dt; a.bucket = false;
      if (a.onLadder) { a.vy = 0; return; }
      a.vx *= Math.pow(.02, dt); a.vy = Math.min(a.vy + G_FALL * dt, 900); this.moveActor(a, dt); return;
    }
    const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0), S = ACTOR.pip;
    if (dir) a.face = dir;
    const H = this.house, topY = H ? H.topY : GROUND_Y;
    if (a.onLadder) {
      const lc = Math.floor(a.x / CELL);
      a.vx = 0; a.vy = i.up ? -S.climb : i.down ? S.climb : 0;
      a.y += a.vy * dt;
      if (a.y < topY) a.y = topY;
      if (a.y >= GROUND_Y) { a.y = GROUND_Y; if (i.down) a.vy = 0; }
      if (!i.up && !i.down) { const f = this.floorNear(a.y, lc, lc, 8); if (f !== null) a.y = f; }
      a.onGround = false;
      if (dir) { const f = this.floorNear(a.y, lc - 1, lc + 1, 12); if (f !== null) { a.y = f; a.onLadder = false; a.onGround = true; a.vx = dir * 120; } }
      if (i.jumpP) { a.onLadder = false; a.vy = -300; a.vx = dir * 150; this.emit('jump', { who: 'pip', x: a.x, y: a.y }); }
      if (!this.isLadder(lc, Math.floor((a.y - 1) / CELL)) && a.y < GROUND_Y && a.y > topY + 2) a.onLadder = false;
      a.anim += Math.abs(a.vy) * dt * .02;
    } else {
      const lc = this.ladderAt(a);
      const canUp = lc !== null && a.y > topY + 2, canDown = lc !== null && a.y < GROUND_Y - 1 && this.isLadder(lc, Math.floor((a.y + 2) / CELL));
      if ((i.up && canUp && a.onGround) || (i.up && canUp && !a.onGround && a.vy > -100) || (i.down && canDown && a.onGround)) {
        a.onLadder = true; a.x = (lc + .5) * CELL; a.vx = 0; a.vy = 0; a.bucket = false; this.emit('grab', { who: 'pip', x: a.x, y: a.y });
        return;
      }
      a.bucket = !!(i.down && a.onGround);
      const run = a.bucket ? 150 : S.run, k = S.accel * dt * (a.onGround ? 1 : .7);
      a.vx += clamp(dir * run - a.vx, -k, k);
      if (this.gust && !a.onLadder) a.vx += this.gust.dir * this.gust.str * dt * (a.onGround ? 1 : 1.4);
      if ((i.jumpP || (i.upP && lc === null)) && a.onGround) { a.vy = -S.jump; a.onGround = false; a.squash = -.6; this.emit('jump', { who: 'pip', x: a.x, y: a.y }); }
      a.vy = Math.min(a.vy + G_FALL * dt, 900);
      this.moveActor(a, dt);
    }
    if (i.actionP && a.cool <= 0) { a.cool = .16; this.tryFix(a); }
  },
  fixInReach(a) {
    if (!this.house) return null;
    let best = null, bd = 1e9;
    for (const f of this.house.fixes) {
      if (f.fixed) continue;
      const dx = Math.abs(f.x - a.x), dy = (a.y - a.h / 2) - f.y;
      if (dx < PIP_REACH_X && dy > -30 && dy < PIP_REACH_UP) { const d = dx + Math.abs(dy) * .5; if (d < bd) { bd = d; best = f; } }
    }
    return best;
  },
  tryFix(a) {
    const f = this.fixInReach(a);
    if (!f) { this.emit('nofix', { x: a.x, y: a.y - a.h }); return false; }
    a.fixT = .28; a.fixKind = (f.t === 'window' || f.t === 'shingle') ? 'glue' : 'spanner';
    f.taps++; a.face = f.x >= a.x ? 1 : -1;
    if (f.taps >= f.need) {
      f.fixed = true; f.since = this.time; f.glint = 1.5; f.taps = 0; this.score += 50; this.version++;
      this.emit('fixed', { t: f.t, x: f.x, y: f.y, left: this.house.fixes.filter(q => !q.fixed).length });
    } else this.emit('fixTap', { t: f.t, x: f.x, y: f.y, tool: a.fixKind });
    return true;
  },
  rebreak(f, why) {
    if (!f.fixed || this.done) return;
    this.mendDone = false;
    f.fixed = false; f.taps = 0; this.rebreaks++; this.version++;
    this.emit('rebreak', { t: f.t, x: f.x, y: f.y, why });
  },

  /* ---------- weather, crane, pigeons ---------- */
  updateWeather(dt) {
    const d = this.def;
    if (d.boss === 'storm') {
      this.gustClock -= dt;
      if (this.gust) { this.gust.t -= dt; if (this.gust.t <= 0) this.gust = null; }
      else if (this.gustClock <= 0) {
        this.gustClock = 6 + this.rng() * 5;
        this.gust = { dir: this.rng() < .5 ? -1 : 1, t: 1.8 + this.rng(), str: 260 * this.diff.gust };
        this.emit('gust', { dir: this.gust.dir });
      }
      this.boltClock -= dt;
      if (this.boltClock <= 0) { this.boltClock = 5 + this.rng() * 7; this.emit('lightning', {}); }
    }
    const C = this.crane;
    if (C) {
      C.t -= dt; C.swing += dt;
      if (C.t <= 0) { C.t = 2 + this.rng() * 3; C.tx = (this.house.x0 + .5 + this.rng() * (this.house.w - 1)) * CELL; }
      C.x += clamp((C.tx || C.x) - C.x, -90 * dt, 90 * dt);
    }
    for (let n = this.pigeons.length - 1; n >= 0; n--) {
      const p = this.pigeons[n]; p.x += p.vx * dt; p.t += dt;
      if (!p.dropped && Math.sign(p.vx) * (p.x - p.dropX) > 0) { p.dropped = true; this.dropThing(p.x, p.y + 10, p.kind); }
      if (p.x < -100 || p.x > this.W + 100) this.pigeons.splice(n, 1);
    }
  },
  dropThing(x, y, kind) {
    this.things.push({ kind, x, y, vx: 0, vy: 0, rot: 0, vr: (this.rng() - .5) * 5, age: 0, passed: new Set() });
    this.emit('drop', { kind, x, y });
  },
  spawnHazards(dt) {
    const hz = this.def.hazards; if (!hz || !this.house || this.mendDone) return;
    this.spawnAcc += dt * hz.rate * this.diff.hazard;
    if (this.time < 3) return;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const H = this.house, from = hz.from[(this.rng() * hz.from.length) | 0], kind = hz.kinds[(this.rng() * hz.kinds.length) | 0];
      const x = (H.x0 + .3 + this.rng() * (H.w - .6)) * CELL, top = H.topY - 4 * CELL;
      if (from === 'pigeon') { const dirn = this.rng() < .5 ? 1 : -1; this.pigeons.push({ x: dirn > 0 ? -60 : this.W + 60, y: top - this.rng() * 60, vx: dirn * 150, dropX: x, kind: this.rng() < .3 ? 'feather' : kind, dropped: false, t: 0 }); }
      else if (from === 'crane' && this.crane) this.dropThing(this.crane.x, H.topY - 5 * CELL + 30, kind);
      else this.dropThing(x, top, kind);
    }
  },
  updateThings(dt) {
    const H = this.house, grav = 620 * this.diff.fall;
    for (let n = this.things.length - 1; n >= 0; n--) {
      const t = this.things[n], T = THINGS[t.kind] || THINGS.twig; t.age += dt;
      const term = (T.slow ? 120 : 380) * this.diff.fall;
      t.vy = Math.min(t.vy + grav * dt * (T.slow ? .35 : 1), term);
      if (this.gust) t.vx += this.gust.dir * 80 * dt; else t.vx *= Math.pow(.5, dt);
      if (T.slow) t.vx += Math.sin(t.age * 3) * 40 * dt;
      t.x += t.vx * dt; t.y += t.vy * dt; t.rot += t.vr * dt;
      let gone = false;
      for (const a of this.players) {
        if (a.type !== 'pip' || gone) continue;
        if (a.bucket && Math.abs(t.x - a.x) < 24 && t.y > a.y - a.h - 30 && t.y < a.y - a.h + 8 && t.vy > 0) {
          gone = true; this.catches++; this.score += T.pts; this.emit('catch', { kind: t.kind, x: t.x, y: t.y });
        } else if (Math.abs(t.x - a.x) < a.w / 2 + T.r - 4 && t.y > a.y - a.h - T.r + 4 && t.y < a.y) {
          if (T.bonk && a.dizzy <= 0) { a.dizzy = this.diff.dizzy; a.bucket = false; this.bonks++; this.emit('bonk', { who: 'pip', x: a.x, y: a.y - a.h, kind: t.kind }); gone = true; }
          else if (!T.bonk) { gone = true; this.catches++; this.score += T.pts; this.emit('catch', { kind: t.kind, x: t.x, y: t.y }); }
        }
      }
      if (!gone && H && T.bonk) for (const f of H.fixes) {
        if (t.passed.has(f) || Math.abs(t.x - f.x) > 18 || Math.abs(t.y - f.y) > 18) continue;
        t.passed.add(f);
        if (f.fixed && this.time - f.since > 3 && this.rng() < this.diff.rebreak) this.rebreak(f, t.kind);
      }
      if (!gone && t.y >= GROUND_Y - 6) { gone = true; this.emit('thingLand', { kind: t.kind, x: t.x, y: GROUND_Y }); }
      if (gone || t.x < -50 || t.x > this.W + 50) this.things.splice(n, 1);
    }
  },
  /* where will this thing be when it reaches height y? (the bots and the warning marks use it) */
  landingX(t, y) {
    if (t.y >= y) return t.x;
    const T = THINGS[t.kind] || THINGS.twig, v = Math.max(60, t.vy + 120);
    return t.x + t.vx * (y - t.y) / v + (T.slow ? 0 : 0);
  }
});
