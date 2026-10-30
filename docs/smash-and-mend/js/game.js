/* ============================================================
   game.js — the rules: one Level, its blocks, its house, its
   players, the falling things.  No DOM and no drawing here, so
   smoke.js runs exactly this code in Node.

   Level.step(dt, inputs) advances 1/60 s.  inputs[i] for player i:
     { left, right, up, down, upP, downP, jumpP, actionP }
   (…P = pressed this step).  Things that the screen and the
   speakers should know about are pushed onto level.events.

   Kid-safe by construction: nothing has health.  A bump is a
   wobble (`dizzy` seconds of dizzy stars) and play goes on.
   Animals in windows always hop out before their block can
   break or fall; nobody else is ever inside an old building.
   ============================================================ */
'use strict';

const G_FALL = 1500;
const ACTOR = {
  mungo: { w: 56, h: 76, run: 210, accel: 2000, jump: 560, climb: 150 },
  pip:   { w: 24, h: 40, run: 230, accel: 2600, jump: 470, climb: 175 }
};

class Actor {
  constructor(type, x, y) {
    const A = ACTOR[type];
    Object.assign(this, { type, x, y, w: A.w, h: A.h, vx: 0, vy: 0, face: 1, onGround: true, onLadder: false, climbing: false,
      dizzy: 0, punchT: 0, punchDir: 'side', cool: 0, pound: false, squash: 0, fixT: 0, fixKind: '', bucket: false,
      mantleT: 0, mantleDir: 0, anim: 0, wasGround: true, landV: 0, cheer: 0 });
  }
  get top() { return this.y - this.h; }
}

class Level {
  constructor(def, opt = {}) {
    this.def = def; this.kind = def.kind; this.diffKey = DIFF[opt.diff] ? opt.diff : 'normal'; this.diff = DIFF[this.diffKey];
    this.rng = mulberry32((opt.seed || 1) * 7919 + def.id.length);
    this.cols = def.cols; this.W = this.cols * CELL;
    const n = this.cols * ROWS;
    this.cell = new Uint8Array(n); this.hp = new Uint8Array(n); this.plat = new Uint8Array(n); this.ladder = new Uint8Array(n);
    Object.assign(this, { time: 0, score: 0, combo: 0, lastBreak: -9, bestCombo: 0, mess: 0, bonks: 0, catches: 0, broken: 0,
      events: [], chunks: [], bits: [], things: [], critters: [], pigeons: [], done: false, result: null, endT: 0,
      finale: false, finaleT: 0, smashDone: true, mendDone: true, version: 0, gust: null, gustClock: 8, boltClock: 7, spawnAcc: 0,
      crumbles: 0, ballPunches: 0, fenceBumps: 0, rebreaks: 0, critterLeft: 0, hitStop: 0 });
    this.smash = def.kind === 'smash' || def.kind === 'coop';
    this.mend = def.kind === 'mend' || def.kind === 'coop';
    if (this.smash) this.buildOld();
    if (this.mend) this.buildHouse();
    this.limit = this.diff.timer ? def.par * (this.diffKey === 'hard' ? 1.3 : 1.7) : 0;
    this.players = [];
    if (this.smash) this.players.push(new Actor('mungo', (this.lot[0] + .5) * CELL - 30, GROUND_Y));
    if (this.mend) this.players.push(new Actor('pip', (this.house.x0 - 2) * CELL, GROUND_Y));
    if (def.boss === 'ball') { this.makeBall(); this.players[0].x = this.ball.ax - 90; this.players[0].face = -1; }
    if (def.crane || (def.hazards && def.hazards.from.includes('crane'))) this.crane = { x: (this.house.x0 + this.house.w / 2) * CELL, tx: 0, t: 0, swing: 0 };
  }

  /* ---------- the grid ---------- */
  idx(c, r) { return r * this.cols + c; }
  inside(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < ROWS; }
  code(c, r) { return this.inside(c, r) ? this.cell[this.idx(c, r)] : 0; }
  solid(c, r) { if (r >= ROWS || c < 0 || c >= this.cols) return true; if (r < 0) return false; return this.cell[this.idx(c, r)] !== 0; }
  isPlat(c, r) { return this.inside(c, r) && this.plat[this.idx(c, r)] === 1; }
  isLadder(c, r) { return this.inside(c, r) && this.ladder[this.idx(c, r)] === 1; }
  emit(type, o = {}) { o.type = type; this.events.push(o); }

  buildOld() {
    const d = this.def, h = d.plan.length, w = d.plan[0].length;
    this.bx = d.bx; this.bw = w; this.bh = h;
    this.lot = [d.bx - 3, d.bx + w + (d.lotPad || 3)];
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const ch = d.plan[i][j]; if (!MAT[ch]) continue;
      const c = d.bx + j, r = ROWS - h + i, k = this.idx(c, r);
      this.cell[k] = matCode(ch); this.hp[k] = MAT[ch].hp[this.diff.i];
    }
    this.initial = this.countCells();
    this.smashDone = false;
  }
  countCells() { let n = 0; for (let k = 0; k < this.cell.length; k++) if (this.cell[k]) n++; for (const ch of this.chunks) n += ch.cells.length; return n; }

  buildHouse() {
    const d = this.def, S = d.storeys;
    const H = this.house = { x0: d.hx, w: d.hw, storeys: S, roofRow: ROWS - 3 * S, fixes: [], folk: d.folk || [] };
    H.topY = H.roofRow * CELL;
    for (let s = 1; s <= S; s++) for (let c = d.hx - 1; c <= d.hx + d.hw; c++) this.plat[this.idx(c, ROWS - 3 * s)] = 1;
    for (const lc of d.ladders) for (let r = H.roofRow; r < ROWS; r++) this.ladder[this.idx(d.hx + lc, r)] = 1;
    for (const f of d.fixes) {
      const c = d.hx + f.c; let y;
      if (f.t === 'shingle') y = (H.roofRow - 1.5) * CELL;
      else if (f.t === 'gutter') y = (H.roofRow - .35) * CELL;
      else y = (ROWS - 3 * f.s - 1.5) * CELL;
      H.fixes.push({ t: f.t, c, s: f.s === undefined ? S : f.s, x: (c + .5) * CELL, y, taps: 0, need: this.diff.fixTaps, fixed: false, since: 0, glint: 0 });
    }
    this.mendDone = false;
  }
  floorY(s) { return (ROWS - 3 * s) * CELL; }

  /* ---------- collisions ---------- */
  colsOf(a) { return [Math.floor((a.x - a.w / 2) / CELL), Math.floor((a.x + a.w / 2 - .01) / CELL)]; }
  rowsOf(a) { return [Math.floor((a.y - a.h) / CELL), Math.floor((a.y - .01) / CELL)]; }
  rectHitsSolid(x, y, w, h, extra) {
    const c0 = Math.floor((x - w / 2) / CELL), c1 = Math.floor((x + w / 2 - .01) / CELL), r0 = Math.floor((y - h) / CELL), r1 = Math.floor((y - .01) / CELL);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { if (this.solid(c, r)) return true; if (extra && extra.has(c + ',' + r)) return true; }
    return false;
  }
  moveActor(a, dt) {
    /* x first */
    let nx = a.x + a.vx * dt; a.touch = 0;
    const [r0, r1] = [Math.floor((a.y - a.h) / CELL), Math.floor((a.y - .01) / CELL)];
    if (a.vx > 0) { const c = Math.floor((nx + a.w / 2 - .01) / CELL); for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { nx = c * CELL - a.w / 2; a.vx = 0; a.touch = 1; break; } }
    else if (a.vx < 0) { const c = Math.floor((nx - a.w / 2) / CELL); for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { nx = (c + 1) * CELL + a.w / 2; a.vx = 0; a.touch = -1; break; } }
    a.x = nx;
    /* then y */
    const prevY = a.y; let ny = a.y + a.vy * dt; a.onGround = false;
    const [c0, c1] = this.colsOf(a);
    if (a.vy >= 0) {
      const r = Math.floor(ny / CELL), rTop = r * CELL;
      let land = false;
      for (let c = c0; c <= c1 && !land; c++) if (this.solid(c, r) && prevY <= rTop + 2) land = true;
      if (!land && !a.onLadder) for (let c = c0; c <= c1 && !land; c++) if (this.isPlat(c, r) && prevY <= rTop + .5 && ny >= rTop) land = true;
      if (land || ny >= GROUND_Y) { a.landV = a.vy; ny = Math.min(land ? rTop : GROUND_Y, ny); a.vy = 0; a.onGround = true; }
    } else {
      const r = Math.floor((ny - a.h) / CELL);
      for (let c = c0; c <= c1; c++) if (this.solid(c, r) && r >= 0) { ny = (r + 1) * CELL + a.h; a.vy = 0; break; }
    }
    a.y = ny;
    if (a.x < a.w / 2) a.x = a.w / 2; if (a.x > this.W - a.w / 2) a.x = this.W - a.w / 2;
    if (!a.wasGround && a.onGround && a.landV > 300) { a.squash = Math.min(1, a.landV / 900); this.emit('land', { who: a.type, x: a.x, y: a.y, v: a.landV }); }
    a.wasGround = a.onGround;
  }
  /* is there a block beside the actor (side = -1 or 1) at rows r0..r1? */
  wallBeside(a, side, upper) {
    const c = side > 0 ? Math.floor((a.x + a.w / 2 + 2) / CELL) : Math.floor((a.x - a.w / 2 - 2) / CELL);
    const r0 = Math.floor((a.y - a.h) / CELL), r1 = upper ? Math.floor((a.y - a.h * .5) / CELL) : Math.floor((a.y - .01) / CELL);
    for (let r = r0; r <= r1; r++) if (r >= 0 && r < ROWS && c >= 0 && c < this.cols && this.cell[this.idx(c, r)]) return true;
    return false;
  }
}

/* ---------- Mungo: walk, climb, punch, stomp ---------- */
Object.assign(Level.prototype, {
  controlMungo(a, i, dt) {
    a.cool -= dt; a.punchT = Math.max(0, a.punchT - dt); a.mantleT = Math.max(0, a.mantleT - dt); a.squash = Math.max(0, a.squash - dt * 4); a.anim += dt;
    if (a.dizzy > 0) { a.dizzy -= dt; a.climbing = false; a.vx *= Math.pow(.02, dt); a.vy = Math.min(a.vy + G_FALL * dt, 1000); this.moveActor(a, dt); return; }
    const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    if (dir) a.face = dir;
    /* climbing: hold up against the side of the old building */
    const wall = this.wallBeside(a, a.face, false), wallHigh = this.wallBeside(a, a.face, true);
    if (i.up && wall && (dir === a.face || dir === 0 || a.climbing) && a.mantleT <= 0) {
      if (!a.climbing) this.emit('grab', { x: a.x, y: a.y });
      a.climbing = true; a.vx = 0;
      if (wallHigh) a.vy = -ACTOR.mungo.climb;
      else { a.vy = -360; a.mantleT = .32; a.mantleDir = a.face; a.climbing = false; this.emit('mantle', { x: a.x, y: a.y }); }
    } else a.climbing = false;
    if (!a.climbing) {
      if (a.mantleT > 0) a.vx = a.mantleDir * 170;
      else { const target = dir * ACTOR.mungo.run, k = ACTOR.mungo.accel * dt * (a.onGround ? 1 : .6); a.vx += clamp(target - a.vx, -k, k); }
      const wantJump = i.jumpP || (i.upP && !wall);
      if (wantJump && a.onGround) { a.vy = -ACTOR.mungo.jump; a.onGround = false; a.squash = -.6; this.emit('jump', { who: 'mungo', x: a.x, y: a.y }); }
      if (!a.onGround && i.downP && !a.pound && a.vy > -250) { a.pound = true; a.vy = 950; a.vx = 0; this.emit('poundStart', { x: a.x, y: a.y }); }
      a.vy = Math.min(a.vy + G_FALL * dt, a.pound ? 1100 : 1000);
    }
    if (i.actionP && a.cool <= 0) {
      a.cool = this.diffKey === 'easy' ? .16 : .2; a.punchT = .2;
      a.punchDir = i.up ? 'up' : (i.down && a.onGround) ? 'down' : 'side';
      this.punch(a, a.punchDir);
    }
    this.moveActor(a, dt);
    if (a.pound && a.onGround) { a.pound = false; this.stomp(a); }
    if (a.climbing && a.onGround && !i.up) a.climbing = false;
  },

  punchCells(a, dir) {
    const out = [];
    if (dir === 'side') {
      const c = a.face > 0 ? Math.floor((a.x + a.w / 2 + 14) / CELL) : Math.floor((a.x - a.w / 2 - 14) / CELL);
      const [r0, r1] = this.rowsOf(a);
      for (let r = r0; r <= r1; r++) out.push([c, r]);
    } else if (dir === 'up') {
      const r = Math.floor((a.y - a.h - 14) / CELL), [c0, c1] = this.colsOf(a);
      for (let c = c0; c <= c1; c++) out.push([c, r]);
    } else {
      const r = Math.floor((a.y + 6) / CELL), [c0, c1] = this.colsOf(a);
      for (let c = c0; c <= c1; c++) out.push([c, r]);
    }
    return out.filter(([c, r]) => this.inside(c, r));
  },
  punch(a, dir) {
    let hit = 0;
    for (const [c, r] of this.punchCells(a, dir)) if (this.hitCell(c, r, 1, 'mungo')) hit++;
    if (this.ball && dir === 'side') this.punchBall(a);
    this.emit('punch', { x: a.x + (dir === 'side' ? a.face * (a.w / 2 + 16) : 0), y: dir === 'up' ? a.y - a.h - 8 : dir === 'down' ? a.y + 4 : a.y - a.h * .55, dir, face: a.face, hit });
    if (hit) { this.hitStop = Math.max(this.hitStop, .035); this.settle(); }
  },
  stomp(a) {
    const r = Math.floor((a.y + 6) / CELL), [c0, c1] = this.colsOf(a); let hit = 0;
    for (let c = c0; c <= c1; c++) if (this.hitCell(c, r, 2, 'mungo')) hit++;
    this.emit('stomp', { x: a.x, y: a.y, hit });
    a.squash = 1;
    if (hit) { this.hitStop = Math.max(this.hitStop, .06); this.settle(); }
  },

  /* a hit on one block: an animal hops out, or the block cracks or breaks */
  hitCell(c, r, dmg, by) {
    if (!this.inside(c, r)) return false;
    const k = this.idx(c, r), code = this.cell[k]; if (!code) return false;
    const m = matOf(code);
    if (m.critter) { this.critterOut(c, r, m.critter); return true; }
    this.hp[k] = Math.max(0, this.hp[k] - dmg);
    if (this.hp[k] > 0) { this.emit('crack', { x: (c + .5) * CELL, y: (r + .5) * CELL, mat: m.key }); return true; }
    this.breakCell(c, r, by);
    return true;
  },
  critterOut(c, r, kind) {
    const k = this.idx(c, r);
    this.cell[k] = matCode('G'); this.hp[k] = 1; this.critterLeft++; this.version++;
    const away = (c + .5) * CELL < this.W / 2 ? -1 : 1;
    this.critters.push({ kind, x: (c + .5) * CELL, y: (r + .7) * CELL, vx: away * (kind === 'cat' ? 140 : 190), vy: kind === 'cat' ? -260 : -120, t: 0 });
    this.emit('critter', { kind, x: (c + .5) * CELL, y: (r + .5) * CELL });
  },
  breakCell(c, r, by) {
    const k = this.idx(c, r), m = matOf(this.cell[k]);
    this.cell[k] = 0; this.hp[k] = 0; this.broken++; this.version++;
    const x = (c + .5) * CELL, y = (r + .5) * CELL;
    if (by === 'mungo' || by === 'ball') {
      this.combo = this.time - this.lastBreak < .9 ? Math.min(9, this.combo + 1) : 1;
      this.lastBreak = this.time; this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += 10 * this.combo;
    } else this.score += 5;
    for (let n = 0; n < 3; n++) this.addBit(x + (this.rng() - .5) * 20, y + (this.rng() - .5) * 20, (this.rng() - .5) * 180, -120 - this.rng() * 160, m.color);
    this.emit('break', { x, y, mat: m.key, combo: by === 'mungo' || by === 'ball' ? this.combo : 0, by });
  }
});
