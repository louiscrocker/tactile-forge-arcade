/* ============================================================
   wood.js — the rotting log and the soil under it, as cells
   ============================================================
   One grid covers the whole world from the sky above the log to
   deep in the soil: 6-unit cells, +x right, +y DOWN, the forest
   floor near y = 0.  Every cell is a material:

     AIR    nothing (the sky, or a tunnel somebody ate)
     BARK   the log's skin: a grub won't chew through it
     ROT    soft rotten wood: food
     PUNK   wood full of white fungus threads: better food, glows
     HEART  sound heartwood: too hard to chew
     SOIL   forest earth: diggable, not food
     CLAY   the pupal chamber's pressed walls, and a deep band
     ROCK   stones: nobody digs those
     ROOT   old roots in the topsoil: tough
     FRASS  grub droppings packed into old tunnels: soft, no food

   `orig` remembers what each cell was at the start, so an eaten
   tunnel shows the dark inside of the log behind it, and the sky
   (orig AIR) is never treated as a tunnel.
   ============================================================ */
'use strict';

const MAT = { AIR: 0, BARK: 1, ROT: 2, PUNK: 3, HEART: 4, SOIL: 5, CLAY: 6, ROCK: 7, ROOT: 8, FRASS: 9 };
/* hard: seconds of chewing per cell at power 1 (Infinity = never) · food: growth per cell */
const MAT_INFO = [
  { name: 'air', hard: 0, food: 0, col: [0, 0, 0], col2: [0, 0, 0] },
  { name: 'bark', hard: Infinity, food: 0, col: [78, 56, 38], col2: [50, 36, 26] },
  { name: 'rotten wood', hard: .5, food: 1, col: [172, 106, 58], col2: [124, 72, 38] },
  { name: 'fungus wood', hard: .35, food: 2.6, col: [206, 170, 120], col2: [170, 128, 82] },
  { name: 'hard wood', hard: Infinity, food: 0, col: [126, 82, 46], col2: [96, 62, 34] },
  { name: 'soil', hard: .55, food: 0, col: [92, 62, 40], col2: [66, 44, 28] },
  { name: 'clay', hard: 1.4, food: 0, col: [168, 104, 66], col2: [134, 80, 50] },
  { name: 'stone', hard: Infinity, food: 0, col: [132, 128, 120], col2: [96, 94, 90] },
  { name: 'root', hard: 2.2, food: 0, col: [128, 88, 56], col2: [100, 66, 40] },
  { name: 'frass', hard: .3, food: 0, col: [176, 132, 88], col2: [150, 108, 70] }
];
const WOOD_CH = 16;                         /* repaint chunk, in cells */

const WORLD = { left: -1800, right: 1800, top: -2000, bottom: 620, logL: -1260, logR: 230, logY: -112, nestX: -880, nestY: -70 };

class Wood {
  constructor(seed) {
    this.seed = seed;
    this.C = 6; this.X0 = WORLD.left; this.Y0 = -360;
    this.cols = Math.round((WORLD.right - WORLD.left) / this.C); this.rows = Math.round((WORLD.bottom - this.Y0) / this.C);
    const n = this.n = this.cols * this.rows;
    this.mat = new Uint8Array(n); this.orig = new Uint8Array(n); this.tex = new Uint8Array(n); this.sky = new Uint8Array(n);
    this.dmg = new Float32Array(n);
    this.ccols = Math.ceil(this.cols / WOOD_CH); this.crows = Math.ceil(this.rows / WOOD_CH);
    this.paint = new Uint8Array(this.ccols * this.crows);
    this.top = new Float32Array(this.cols);
    this.version = 0; this.dirtyAll = true;
    const R = mulberry32(seed), n1 = makeNoise1D(seed + 1), n2 = makeNoise2D(seed + 2), n3 = makeNoise2D(seed + 3);
    this.rng = R;
    /* the forest floor */
    this.groundAt = (x) => 6 * Math.sin(x * .0037 + 1) + 5 * Math.sin(x * .011 + 2) + (n1(x * .01) - .5) * 10;
    /* the log: a long cylinder lying on the floor, sunk a little into it */
    const radAt = (x) => {
      if (x < WORLD.logL - 30 || x > WORLD.logR + 30) return 0;
      const u = (x - WORLD.logL) / (WORLD.logR - WORLD.logL);
      let r = 128 + 18 * Math.sin(u * 3.1) + (n1(x * .02 + 40) - .5) * 14;
      /* the broken left end, the sawn-off right end */
      const left = smoothstep(-26, 34, x - WORLD.logL + (n1(x * .2) - .5) * 40), right = smoothstep(-10, 12, WORLD.logR - x);
      return r * Math.min(left, right);
    };
    this.radAt = radAt;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r), g = this.groundAt(x);
      let m = MAT.AIR;
      const lr = radAt(x), axis = WORLD.logY + (x - WORLD.logL) * .01;
      const d = lr > 0 ? Math.abs(y - axis) / lr : 9;
      if (d < 1) {
        /* inside the log */
        const bark = .9 + (n2(x * .05, y * .05) - .5) * .06;
        const hollowLeft = x < WORLD.logL + 120 && d < .42 + (n1(x * .07) - .5) * .2;
        if (hollowLeft) m = MAT.AIR;
        else if (d > bark && y < g - 4) m = MAT.BARK;
        else {
          m = MAT.ROT;
          const u = (x - WORLD.logL) / (WORLD.logR - WORLD.logL);
          /* hard heartwood in the sounder, right-hand end */
          const heart = d < .2 + u * .3 + (n2(x * .03, y * .06) - .5) * .18 && u > .45;
          if (heart) m = MAT.HEART;
          else if (n3(x * .045, y * .07) > .7 + (1 - u) * -.05) m = MAT.PUNK;
        }
      }
      if (m === MAT.AIR && y > g && !(d < 1 && x < WORLD.logL + 120)) {
        const depth = y - g;
        m = MAT.SOIL;
        if (depth > 210 + (n2(x * .01, 3) - .5) * 40 && depth < 270 + (n2(x * .012, 7) - .5) * 50) m = MAT.CLAY;
        if (depth < 60 && n2(x * .09, y * .09) > .78) m = MAT.ROOT;
      }
      if (d < 1 && y > g && m === MAT.AIR) m = MAT.SOIL;
      this.mat[i] = m;
      this.tex[i] = clamp(n2(x * .02, y * .3) * 160 + n3(x * .4, y * .4) * 95, 0, 255) | 0;
    }
    /* stones in the soil (never under the egg's spot) */
    for (let k = 0; k < 70; k++) {
      const x = lerp(WORLD.left + 40, WORLD.right - 40, R()), g = this.groundAt(x), y = g + 40 + R() * 520, rad = 6 + R() * 16;
      if (Math.abs(x - WORLD.nestX) < 120 && y < 140) continue;
      this.blob(x, y, rad, rad * (.6 + R() * .3), MAT.ROCK, (m) => m === MAT.SOIL || m === MAT.CLAY || m === MAT.ROOT);
    }
    /* the mother's egg chamber, in soft rotten wood */
    this.blob(WORLD.nestX, WORLD.nestY, 14, 11, MAT.ROT, (m) => m !== MAT.BARK);
    this.blob(WORLD.nestX, WORLD.nestY, 6, 5, MAT.AIR, () => true);
    this.orig.set(this.mat);
    /* the open sky: air outside the log and above the ground (a grub never crawls into it) */
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const i = r * this.cols + c, x = this.cx(c), y = this.cy(r); this.sky[i] = this.orig[i] === MAT.AIR && !this.inLog(x, y) && y <= this.groundAt(x) ? 1 : 0; }
    this.rebuildTop(0, this.cols - 1);
  }

  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  idx(x, y) { const c = this.col(x), r = this.row(y); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  matAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y > this.groundAt(x) ? MAT.SOIL : MAT.AIR) : this.mat[i]; }
  origAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y > this.groundAt(x) ? MAT.SOIL : MAT.AIR) : this.orig[i]; }
  solid(m) { return m !== MAT.AIR; }
  inLog(x, y) { const lr = this.radAt(x); if (lr <= 0) return false; const axis = WORLD.logY + (x - WORLD.logL) * .01; return Math.abs(y - axis) < lr; }
  logAxis(x) { return WORLD.logY + (x - WORLD.logL) * .01; }
  /* how far into the wood or soil a point is: distance to the nearest open sky, roughly */
  depthAt(x, y) { const t = this.topAt(x); return y - t; }

  set(i, m) {
    if (this.mat[i] === m) return;
    this.mat[i] = m; this.dmg[i] = 0;
    const c = i % this.cols, r = (i / this.cols) | 0;
    this.paint[((r / WOOD_CH) | 0) * this.ccols + ((c / WOOD_CH) | 0)] = 1;
    /* a pixel blends cells two away: wake the neighbouring chunk too */
    const cc = c % WOOD_CH, rr = r % WOOD_CH;
    if (cc < 2 && c >= WOOD_CH) this.paint[((r / WOOD_CH) | 0) * this.ccols + ((c / WOOD_CH) | 0) - 1] = 1;
    if (cc > WOOD_CH - 3 && c + WOOD_CH < this.cols) this.paint[((r / WOOD_CH) | 0) * this.ccols + ((c / WOOD_CH) | 0) + 1] = 1;
    if (rr < 2 && r >= WOOD_CH) this.paint[(((r / WOOD_CH) | 0) - 1) * this.ccols + ((c / WOOD_CH) | 0)] = 1;
    if (rr > WOOD_CH - 3 && r + WOOD_CH < this.rows) this.paint[(((r / WOOD_CH) | 0) + 1) * this.ccols + ((c / WOOD_CH) | 0)] = 1;
    this.version++;
    this.topDirty = true; this.topLo = Math.min(this.topLo === undefined ? c : this.topLo, c); this.topHi = Math.max(this.topHi === undefined ? c : this.topHi, c);
  }
  /* an ellipse of one material, only over cells `where` allows */
  blob(x, y, rx, ry, m, where) {
    for (let yy = y - ry - this.C; yy <= y + ry + this.C; yy += this.C) for (let xx = x - rx - this.C; xx <= x + rx + this.C; xx += this.C) {
      const i = this.idx(xx, yy); if (i < 0) continue;
      const cx = this.cx(i % this.cols), cy = this.cy((i / this.cols) | 0);
      if (((cx - x) / rx) ** 2 + ((cy - y) / ry) ** 2 > 1) continue;
      if (where(this.mat[i])) this.set(i, m);
    }
  }

  /* the first solid surface from the sky down, per column (for walking on top of things) */
  rebuildTop(c0, c1) {
    for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
      let y = null;
      for (let r = 0; r < this.rows; r++) { const m = this.mat[r * this.cols + c]; if (m !== MAT.AIR) { y = this.Y0 + r * this.C; break; } }
      this.top[c] = y === null ? WORLD.bottom : y;
    }
  }
  flushTop() { if (this.topDirty) { this.rebuildTop(this.topLo - 1, this.topHi + 1); this.topDirty = false; this.topLo = this.topHi = undefined; } }
  /* the surface a walking beetle stands on, smoothed over a few cells */
  topAt(x) {
    this.flushTop();
    const u = (x - this.X0) / this.C - .5, c = Math.floor(u), f = u - c;
    const a = this.top[clamp(c, 0, this.cols - 1)], b = this.top[clamp(c + 1, 0, this.cols - 1)];
    return lerp(a, b, f);
  }
  /* a walking surface that ignores narrow holes (a beetle steps over a grub's tunnel) */
  walkTop(x, span = 10) {
    let best = Infinity;
    for (let k = -span; k <= span; k += this.C) best = Math.min(best, this.topAt(x + k));
    return best;
  }

  /* every cell whose centre lies within `rad` (+ slack) of (x, y): calls fn(i, cellX, cellY) */
  cellsIn(x, y, rad, fn, slack = this.C * .35) {
    const R = rad + slack, c0 = Math.max(0, this.col(x - R)), c1 = Math.min(this.cols - 1, this.col(x + R)), r0 = Math.max(0, this.row(y - R)), r1 = Math.min(this.rows - 1, this.row(y + R));
    const R2 = R * R;
    for (let r = r0; r <= r1; r++) { const cy = this.Y0 + (r + .5) * this.C, dy = cy - y; for (let c = c0; c <= c1; c++) { const cx = this.X0 + (c + .5) * this.C, dx = cx - x; if (dx * dx + dy * dy <= R2) fn(r * this.cols + c, cx, cy); } }
  }
  /* is a circle free of solid cells (and of open sky, if `inside`)? */
  free(x, y, rad, inside) {
    if (x < this.X0 || y < this.Y0 || x >= this.X0 + this.cols * this.C || y >= this.Y0 + this.rows * this.C) return false;
    let ok = true;
    this.cellsIn(x, y, rad, (i) => { if (this.mat[i] !== MAT.AIR || (inside && this.sky[i])) ok = false; }, 0);
    const i = this.idx(x, y); if (i < 0 || this.mat[i] !== MAT.AIR || (inside && this.sky[i])) ok = false;
    return ok;
  }
  /* what is in a circle: counts of each material, and whether it touches the sky */
  survey(x, y, rad) {
    const out = { solid: 0, food: 0, rock: 0, hard: 0, bark: 0, sky: 0, soil: 0, punk: 0, n: 0 };
    this.cellsIn(x, y, rad, (i) => {
      out.n++;
      const m = this.mat[i];
      if (this.sky[i] && m === MAT.AIR) out.sky++;
      if (m === MAT.AIR) return;
      out.solid++;
      if (m === MAT.ROCK) out.rock++; else if (m === MAT.HEART || m === MAT.ROOT) out.hard++; else if (m === MAT.BARK) out.bark++;
      if (m === MAT.SOIL || m === MAT.CLAY) out.soil++;
      if (m === MAT.PUNK) out.punk++;
      if (MAT_INFO[m].food) out.food++;
    });
    return out;
  }
  /* chew a circle: each cell takes hard/power seconds; returns what was eaten.
     opts: { bark: can chew bark, root: can chew roots, clay: clay is softer } */
  chew(x, y, rad, power, dt, opts = {}) {
    const res = { food: 0, cells: 0, punk: 0, soil: 0, blocked: 0 };
    this.cellsIn(x, y, rad, (i) => {
      const m = this.mat[i]; if (m === MAT.AIR) return;
      let hard = MAT_INFO[m].hard;
      if (m === MAT.BARK && opts.bark) hard = 1.2;
      if (m === MAT.ROOT && !opts.root) hard = Infinity;
      if (m === MAT.CLAY && opts.clay) hard = .8;
      if (m === MAT.HEART && opts.heart) hard = 1.6;
      if (!isFinite(hard)) { res.blocked++; return; }
      this.dmg[i] += power * dt / hard;
      if (this.dmg[i] >= 1) {
        res.cells++; res.food += MAT_INFO[m].food;
        if (m === MAT.PUNK) res.punk++;
        if (m === MAT.SOIL || m === MAT.CLAY) res.soil++;
        this.set(i, MAT.AIR);
      }
    }, 0);
    return res;
  }
  /* carve an oval room and press its walls into smooth clay (the pupal chamber) */
  chamber(x, y, rx, ry, amount) {
    for (let yy = y - ry - 12; yy <= y + ry + 12; yy += this.C) for (let xx = x - rx - 12; xx <= x + rx + 12; xx += this.C) {
      const i = this.idx(xx, yy); if (i < 0) continue;
      const e = ((this.cx(i % this.cols) - x) / rx) ** 2 + ((this.cy((i / this.cols) | 0) - y) / ry) ** 2;
      const m = this.mat[i];
      if (e <= 1) { if (m !== MAT.AIR && m !== MAT.ROCK) this.set(i, MAT.AIR); }
      else if (e < 1 + amount * .9 && m !== MAT.ROCK && m !== MAT.AIR) this.set(i, MAT.CLAY);
    }
  }
  /* drop frass in an old tunnel (decoration that a grub can eat through again) */
  frass(x, y) { const i = this.idx(x, y); if (i >= 0 && this.mat[i] === MAT.AIR && !this.sky[i]) this.set(i, MAT.FRASS); }

  /* run-length encoding of the current materials (what was eaten survives a reload) */
  serialize() {
    const out = []; let cur = this.mat[0], run = 0;
    for (let i = 0; i < this.n; i++) { if (this.mat[i] === cur && run < 65535) run++; else { out.push(cur, run); cur = this.mat[i]; run = 1; } }
    out.push(cur, run);
    return out;
  }
  restore(arr) {
    if (!Array.isArray(arr)) return false;
    let i = 0;
    const mat = new Uint8Array(this.n);
    for (let k = 0; k + 1 < arr.length; k += 2) {
      const m = arr[k], run = arr[k + 1];
      if (!(m >= 0 && m < MAT_INFO.length) || !(run > 0) || i + run > this.n) return false;
      mat.fill(m, i, i + run); i += run;
    }
    if (i !== this.n) return false;
    this.mat.set(mat); this.dmg.fill(0); this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1);
    return true;
  }
}
