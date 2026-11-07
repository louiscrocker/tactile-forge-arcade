/* ============================================================
   wood.js — the old oak stump and the soil, as cells
   ============================================================
   One grid covers the whole garden from above the stump to deep
   in the soil: 6-unit cells, +x right, +y DOWN, the lawn near
   y = 0.  Every cell is a material:

     AIR    nothing (the sky, or a tunnel somebody ate)
     BARK   the stump's skin: a grub won't chew through it
     ROT    soft rotten wood: food
     PUNK   wood full of white fungus threads: the best food
     HEART  sound oak: far too hard for now
     SOIL   earth: diggable, not food
     CLAY   the cocoon's pressed walls, and a deep band
     ROCK   flints: nobody digs those
     ROOT   living roots from the hedge: tough
     FRASS  grub droppings packed into old tunnels: soft, no food

   THE STUMP CHANGES.  In Year 1 most of it is hard oak.  Each new
   year `age()` softens more HEART into ROT, spreads fungus, and
   from Year 5 the top crumbles away into the sky.  All of it is
   decided by noise, so it is the same stump on every reload, and
   the changes go through `mat`, so tunnels and decay are saved.
   ============================================================ */
'use strict';

const MAT = { AIR: 0, BARK: 1, ROT: 2, PUNK: 3, HEART: 4, SOIL: 5, CLAY: 6, ROCK: 7, ROOT: 8, FRASS: 9 };
/* hard: seconds of chewing per cell at power 1 (Infinity = never) · food: growth per cell */
const MAT_INFO = [
  { name: 'air', hard: 0, food: 0, col: [0, 0, 0], col2: [0, 0, 0] },
  { name: 'bark', hard: Infinity, food: 0, col: [70, 54, 40], col2: [44, 34, 26] },
  { name: 'rotten oak', hard: .5, food: 1, col: [168, 110, 62], col2: [122, 76, 42] },
  { name: 'fungus wood', hard: .35, food: 2.6, col: [214, 190, 150], col2: [176, 146, 104] },
  { name: 'hard oak', hard: Infinity, food: 0, col: [122, 84, 50], col2: [92, 62, 36] },
  { name: 'soil', hard: .55, food: 0, col: [86, 60, 42], col2: [62, 42, 30] },
  { name: 'clay', hard: 1.4, food: 0, col: [160, 104, 68], col2: [128, 80, 52] },
  { name: 'flint', hard: Infinity, food: 0, col: [136, 134, 128], col2: [92, 92, 92] },
  { name: 'root', hard: 2.2, food: 0, col: [124, 88, 58], col2: [96, 66, 42] },
  { name: 'frass', hard: .3, food: 0, col: [170, 130, 90], col2: [144, 106, 72] }
];
const WOOD_CH = 16;                         /* repaint chunk, in cells */

/* the garden, left to right: the wood's edge · the old stump · the log pile · the apple tree · the pond ·
   the washing line · the path · the street lamp · the fence · the great oak */
const WORLD = {
  left: -1900, right: 1900, top: -1500, bottom: 620,
  stumpX: -1080, stumpW: 150, stumpTop: -116, nestX: -1010, nestY: 170, frost: 66,
  pileX: -700, appleX: -300, pondX: 110, pondW: 180, lineL: 280, lineR: 590, pathL: 660, pathR: 880, lampX: 970, fenceX: 1110, oakX: 1480
};

class Wood {
  constructor(seed) {
    this.seed = seed;
    this.C = 6; this.X0 = WORLD.left; this.Y0 = -360;
    this.cols = Math.round((WORLD.right - WORLD.left) / this.C); this.rows = Math.round((WORLD.bottom - this.Y0) / this.C);
    const n = this.n = this.cols * this.rows;
    this.mat = new Uint8Array(n); this.orig = new Uint8Array(n); this.tex = new Uint8Array(n); this.sky = new Uint8Array(n);
    this.dmg = new Float32Array(n); this.wf = new Float32Array(n);   /* wf: how deep inside the wood a cell is, 0 outside */
    this.ccols = Math.ceil(this.cols / WOOD_CH); this.crows = Math.ceil(this.rows / WOOD_CH);
    this.paint = new Uint8Array(this.ccols * this.crows);
    this.top = new Float32Array(this.cols);
    this.version = 0; this.dirtyAll = true; this.year = 1;
    const R = mulberry32(seed), n1 = makeNoise1D(seed + 1), n2 = makeNoise2D(seed + 2), n3 = makeNoise2D(seed + 3), n4 = makeNoise2D(seed + 4);
    this.rng = R; this.n2 = n2; this.n3 = n3; this.n4 = n4;
    /* the lawn */
    this.groundAt = (x) => 5 * Math.sin(x * .0031 + 1) + 3 * Math.sin(x * .011 + 2) + (n1(x * .01) - .5) * 6;
    /* the stump: a broad cut trunk, swelling into the root plate below ground, tapering down */
    const sx = WORLD.stumpX, widthAt = (y) => {
      if (y < 0) return WORLD.stumpW + (y + 120) * -.06 + 8 * Math.sin(y * .05);
      if (y < 70) return lerp(WORLD.stumpW, 300, smoothstep(0, 70, y));
      return lerp(300, 110, smoothstep(70, 360, y));
    };
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r);
      if (y < WORLD.stumpTop + (n1(x * .03) - .5) * 14 || y > 370) continue;
      const w = widthAt(y) + (n2(x * .012, y * .02) - .5) * 30, k = 1 - Math.abs(x - sx) / w;
      if (k > 0) this.wf[i] = Math.max(this.wf[i], k);
    }
    /* the big roots, reaching out under the lawn (one runs right under the log pile) */
    const roots = [[-1, 330, 150, 48, -.15], [-1, 250, 260, 34, .28], [1, 520, 120, 52, .05], [1, 330, 250, 36, .3], [-.2, 140, 340, 30, .9]];
    for (const [dir, L, y0, r0, slope] of roots) {
      let x = sx + dir * 190, y = y0, a = (dir < 0 ? Math.PI : 0) - dir * slope;
      if (Math.abs(dir) < 1) { x = sx - 40; a = 1.2; }
      for (let t = 0; t < L; t += 6) {
        a += Math.sin(t * .021 + y0) * .03;
        x += Math.cos(a) * 6; y += Math.sin(a) * 6;
        const rad = lerp(r0, 12, t / L);
        this.cellsIn(x, y, rad, (i, cx, cy) => { const k = 1 - Math.hypot(cx - x, cy - y) / rad; this.wf[i] = Math.max(this.wf[i], k * .55 + .05); }, 0);
      }
    }
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r), g = this.groundAt(x), k = this.wf[i];
      let m = MAT.AIR;
      if (k > 0) {
        if (k < .13 + (n2(x * .05, y * .05) - .5) * .06 && y < g - 3) m = MAT.BARK;
        else {
          /* Year 1: hard oak in great blotches, rot in the seams between, a little fungus deep down */
          const h = n3(x * .012, y * .014);
          m = h > .47 ? MAT.HEART : MAT.ROT;
          if (y > 40 && n4(x * .03, y * .03) > .74) m = MAT.PUNK;
        }
      } else if (y > g) {
        const depth = y - g;
        m = MAT.SOIL;
        if (depth > 430 + (n2(x * .01, 3) - .5) * 40) m = MAT.CLAY;
        if (depth < 50 && n2(x * .09, y * .09) > .8) m = MAT.ROOT;
      }
      this.mat[i] = m;
      this.tex[i] = clamp(n2(x * .02, y * .3) * 160 + n3(x * .4, y * .4) * 95, 0, 255) | 0;
    }
    /* flints in the soil (never in the wood) */
    for (let k = 0; k < 70; k++) {
      const x = lerp(WORLD.left + 40, WORLD.right - 40, R()), g = this.groundAt(x), y = g + 40 + R() * 500, rad = 6 + R() * 16;
      this.blob(x, y, rad, rad * (.6 + R() * .3), MAT.ROCK, (m) => m === MAT.SOIL || m === MAT.ROOT);
    }
    /* the mother's little hole, in soft wood */
    this.blob(WORLD.nestX, WORLD.nestY, 90, 60, MAT.ROT, (m) => m === MAT.HEART);
    this.blob(WORLD.nestX, WORLD.nestY, 6, 5, MAT.AIR, () => true);
    this.orig.set(this.mat);
    this.markSky();
    this.rebuildTop(0, this.cols - 1);
  }

  /* the open sky: air outside the wood and above ground (a grub never crawls into it) */
  markSky() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c;
      this.sky[i] = (this.orig[i] === MAT.AIR && this.wf[i] <= 0 && this.cy(r) < this.groundAt(this.cx(c)) + 2) || this.crumbled(i, this.year) ? 1 : 0;
    }
  }
  /* from Year 5 the top of the stump crumbles away */
  crumbled(i, yr) {
    if (yr < 5 || this.wf[i] <= 0) return false;
    const x = this.cx(i % this.cols), y = this.cy((i / this.cols) | 0);
    return y < WORLD.stumpTop + (yr - 4) * 24 + this.n2(x * .02, 9) * 26 - 8;
  }
  /* a new year: softer wood, more fungus; returns how many cells changed */
  age(yr) {
    this.year = yr;
    const softK = clamp((yr - 1) / 5.2, 0, 1), fun = .74 - yr * .045;
    let changed = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, m = this.mat[i]; if (this.wf[i] <= 0 || m === MAT.AIR) continue;
      const x = this.cx(c), y = this.cy(r);
      if (this.crumbled(i, yr)) { this.set(i, MAT.AIR); this.sky[i] = 1; changed++; continue; }
      if (m === MAT.HEART && this.n3(x * .03 + 11, y * .03) < softK * 1.12 - .08) { this.set(i, MAT.ROT); changed++; }
      else if (m === MAT.ROT && this.n4(x * .03, y * .03) > fun) { this.set(i, MAT.PUNK); changed++; }
    }
    return changed;
  }
  /* a few cells of fungus creep on from where fungus already is (the white threads, live) */
  spread(n) {
    let done = 0;
    for (let k = 0; k < n * 40 && done < n; k++) {
      const i = (this.rng() * this.n) | 0; if (this.mat[i] !== MAT.ROT || this.wf[i] <= 0) continue;
      const nb = [i - 1, i + 1, i - this.cols, i + this.cols];
      if (nb.some(j => j >= 0 && j < this.n && this.mat[j] === MAT.PUNK)) { this.set(i, MAT.PUNK); done++; }
    }
    return done;
  }

  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  idx(x, y) { const c = this.col(x), r = this.row(y); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  matAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y > this.groundAt(x) ? MAT.SOIL : MAT.AIR) : this.mat[i]; }
  origAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y > this.groundAt(x) ? MAT.SOIL : MAT.AIR) : this.orig[i]; }
  solid(m) { return m !== MAT.AIR; }
  inWood(x, y) { const i = this.idx(x, y); return i >= 0 && this.wf[i] > 0; }
  inStump(x, y) { return Math.abs(x - WORLD.stumpX) < 340 && y < 380 && this.inWood(x, y); }
  /* how far into the ground or the wood a point is */
  depthAt(x, y) { return y - this.groundAt(x); }
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
    this.mat.set(mat); this.dmg.fill(0); this.dirtyAll = true; this.version++; this.markSky();
    this.rebuildTop(0, this.cols - 1);
    return true;
  }
}
