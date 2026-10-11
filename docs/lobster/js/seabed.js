/* ============================================================
   seabed.js — the Gulf of Maine sea floor in cross-section, as cells
   ============================================================
   The coast of Maine from the side, left to right (+x right,
   +y DOWN, the sea's surface at y = 0; everything is under water):

     the offshore winter grounds: deep, soft mud over clay (no
       storms down here, and the water keeps its temperature)
     the mud slope rising towards the coast
     THE COBBLE BED: a shallow shelf of sand strewn with cobbles,
       the lobsters' nursery and home (a hole under a cobble is
       a nursery; a den dug under a big cobble is an adult's)
     the kelp forest on rock, with boulders and mussel beds
     the rocky ledge, stepping up towards the shore, where the
       lobsterman's boat sits on the surface
     the shore: rock that climbs out of the water at the far right

   One grid of 6-unit cells covers the slope to the shore.
   Every cell is a material:

     AIR     sea water (or a den somebody dug)
     SAND    the cobble bed's sand: soft, easy to dig
     MUD     offshore mud: soft, easy to dig
     CLAY    stiff clay under the mud: slow digging
     ROCK    bedrock and the ledge: nobody digs that
     COBBLE  a loose stone lying on the sand (undiggable; dig under it)
     GRAVEL  coarse gravel: hard digging, only for a big lobster
     SHELL   a mussel bed: food, not for digging

   `orig` remembers what each cell was, so a dug den shows the
   dark sand behind it, and `sky` marks the open water (a digging
   lobster never digs out into it; it comes out).
   ============================================================ */
'use strict';

const MAT = { AIR: 0, SAND: 1, MUD: 2, CLAY: 3, ROCK: 4, COBBLE: 5, GRAVEL: 6, SHELL: 7 };
/* hard: seconds of digging per cell at power 1 (Infinity = never) */
const MAT_INFO = [
  { name: 'water', hard: 0, col: [0, 0, 0], col2: [0, 0, 0] },
  { name: 'sand', hard: .22, col: [190, 170, 130], col2: [150, 132, 98] },
  { name: 'mud', hard: .2, col: [96, 88, 72], col2: [66, 60, 48] },
  { name: 'clay', hard: .7, col: [120, 104, 92], col2: [84, 72, 64] },
  { name: 'bedrock', hard: Infinity, col: [98, 94, 88], col2: [62, 60, 56] },
  { name: 'cobble', hard: Infinity, col: [146, 138, 124], col2: [92, 86, 78] },
  { name: 'gravel', hard: 2.4, col: [150, 138, 112], col2: [104, 94, 78] },
  { name: 'mussel bed', hard: Infinity, col: [40, 36, 60], col2: [22, 20, 36] }
];
const CELL_CH = 16;                         /* repaint chunk, in cells */

const WORLD = {
  left: -4600, right: 4200, top: -1100, bottom: 900,
  surface: 0,
  deepR: -1700, slopeR: -700, cobbleL: -700, cobbleR: 1500, kelpL: 1500, kelpR: 2700, ledgeL: 2700, ledgeR: 3600, walkR: 3760,
  homeX: 420, eggX: 300, boatX: 3150, trapX: 2100,
  deepFloor: 640, cobbleFloor: 300,
  gridL: -2600, gridR: 4200, gridT: -60, gridB: 760
};

class Ground {
  constructor(seed) {
    this.seed = seed;
    this.C = 6; this.X0 = WORLD.gridL; this.Y0 = WORLD.gridT;
    this.cols = Math.round((WORLD.gridR - WORLD.gridL) / this.C); this.rows = Math.round((WORLD.gridB - WORLD.gridT) / this.C);
    const n = this.n = this.cols * this.rows;
    this.mat = new Uint8Array(n); this.orig = new Uint8Array(n); this.tex = new Uint8Array(n); this.sky = new Uint8Array(n);
    this.dmg = new Float32Array(n);
    this.ccols = Math.ceil(this.cols / CELL_CH); this.crows = Math.ceil(this.rows / CELL_CH);
    this.paint = new Uint8Array(this.ccols * this.crows);
    this.top = new Float32Array(this.cols);
    this.version = 0; this.dirtyAll = true;
    const R = mulberry32(seed), n1 = makeNoise1D(seed + 1), n2 = makeNoise2D(seed + 2), n3 = makeNoise2D(seed + 3);
    this.rng = R;
    /* the shape of the sea floor (before anybody digs) */
    this.surfaceAt = (x) => {
      if (x < WORLD.deepR) return WORLD.deepFloor + (n1(x * .006) - .5) * 24;
      if (x < WORLD.slopeR) return lerp(WORLD.deepFloor, WORLD.cobbleFloor, smoothstep(WORLD.deepR, WORLD.slopeR, x)) + (n1(x * .01 + 3) - .5) * 26;
      if (x < WORLD.cobbleR) return WORLD.cobbleFloor - (x - WORLD.cobbleL) * .012 + (n1(x * .02 + 5) - .5) * 14;
      if (x < WORLD.kelpR) return lerp(274, 170, smoothstep(WORLD.kelpL, WORLD.kelpR, x)) + (n1(x * .03 + 7) - .5) * 18;
      if (x < WORLD.ledgeR) { const t = (x - WORLD.ledgeL) / (WORLD.ledgeR - WORLD.ledgeL); return lerp(170, 90, t) - Math.floor(t * 5) * 6 + (n1(x * .05 + 9) - .5) * 6; }
      return lerp(60, -70, smoothstep(WORLD.ledgeR, WORLD.right, x)) + (n1(x * .04 + 11) - .5) * 10;
    };
    const surf = new Float32Array(this.cols);
    for (let c = 0; c < this.cols; c++) surf[c] = this.surfaceAt(this.cx(c));
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r), g = surf[c];
      let m = MAT.AIR;
      if (y >= g) {
        const depth = y - g;
        if (x < WORLD.slopeR) {
          m = depth < 70 + (n2(x * .01, 2) - .5) * 30 ? MAT.MUD : depth < 150 ? MAT.CLAY : MAT.ROCK;
          if (x > WORLD.deepR && depth < 8 && n2(x * .05, 4) > .72) m = MAT.GRAVEL;
        } else if (x < WORLD.cobbleR) {
          m = depth < 46 + (n2(x * .02, 9) - .5) * 20 ? MAT.SAND : MAT.ROCK;
          if (m === MAT.SAND && depth > 12 && n3(x * .05, y * .05) > .8) m = MAT.GRAVEL;
        } else if (x < WORLD.kelpR) {
          m = depth < 10 + (n2(x * .03, 13) - .5) * 12 ? MAT.SAND : MAT.ROCK;
          if (depth < 6 && n2(x * .02, 17) > .62) m = MAT.SHELL;
        } else if (x < WORLD.ledgeR) {
          m = MAT.ROCK;
          if (depth < 8 && n2(x * .04, 19) > .66) m = MAT.SAND;
        } else m = depth < 8 && n2(x * .05, 21) > .5 ? MAT.SAND : MAT.ROCK;
      }
      this.mat[i] = m;
      this.tex[i] = clamp(n2(x * .02, y * .3) * 160 + n3(x * .4, y * .4) * 95, 0, 255) | 0;
    }
    /* the cobbles: loose stones half-buried in the sand of the cobble bed (bigger ones at the home end) */
    this.cobbles = [];
    for (let k = 0; k < 64; k++) {
      const x = lerp(WORLD.cobbleL + 20, WORLD.cobbleR - 20, R()), g = this.surfaceAt(x), rad = 7 + R() * 14 + (x > WORLD.homeX - 300 && x < WORLD.homeX + 500 ? 4 : 0);
      this.blob(x, g + rad * .3, rad * .7, rad * .5, MAT.COBBLE, () => true);
      this.cobbles.push({ x, rad });
    }
    /* boulders among the kelp, and a few on the ledge */
    for (let k = 0; k < 14; k++) { const x = lerp(WORLD.kelpL, WORLD.ledgeR - 60, R()), g = this.surfaceAt(x), rad = 12 + R() * 20; this.blob(x, g + rad * .4, rad, rad * .9, MAT.COBBLE, () => true); }
    /* gravel lenses deeper in the cobble bed */
    for (let k = 0; k < 20; k++) { if (k % 2) { R(); R(); R(); R(); continue; } const x = lerp(WORLD.cobbleL, WORLD.cobbleR, R()), g = this.surfaceAt(x); this.blob(x, g + 28 + R() * 14, 10 + R() * 12, 4 + R() * 4, MAT.GRAVEL, (m) => m === MAT.SAND); }
    /* stones on the mud slope */
    for (let k = 0; k < 10; k++) { const x = lerp(WORLD.gridL + 40, WORLD.slopeR, R()), g = this.surfaceAt(x), rad = 6 + R() * 10; this.blob(x, g + rad * .4, rad, rad * .8, MAT.COBBLE, () => true); }
    this.orig.set(this.mat);
    /* open water: never dug into */
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const i = r * this.cols + c; this.sky[i] = this.orig[i] === MAT.AIR ? 1 : 0; }
    this.rebuildTop(0, this.cols - 1);
  }

  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  idx(x, y) { const c = this.col(x), r = this.row(y); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  /* off the grid: the deep sea floor to the left (mud), solid rock below */
  matAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? (y < this.surfaceAt(x) + 70 ? MAT.MUD : MAT.ROCK) : MAT.AIR) : this.mat[i]; }
  origAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.MUD : MAT.AIR) : this.orig[i]; }
  solidAt(x, y) { return this.matAt(x, y) !== MAT.AIR; }
  diggable(m) { return m === MAT.SAND || m === MAT.MUD || m === MAT.CLAY; }
  /* is there a stone (cobble or rock) within `rad` straight above (x, y)?  A den needs a roof. */
  roofAt(x, y, rad) { let roof = false; this.cellsIn(x, y - rad * 1.3, rad * 1.1, (i) => { const m = this.mat[i]; if (m === MAT.COBBLE || m === MAT.ROCK) roof = true; }, 0); return roof; }
  /* the nearest cobble to x on the cobble bed */
  nearestCobble(x) { let best = null, bd = 1e9; for (const cb of this.cobbles) { const d = Math.abs(cb.x - x); if (d < bd) { bd = d; best = cb; } } return best; }

  set(i, m) {
    if (this.mat[i] === m) return;
    this.mat[i] = m; this.dmg[i] = 0;
    const c = i % this.cols, r = (i / this.cols) | 0;
    this.paint[((r / CELL_CH) | 0) * this.ccols + ((c / CELL_CH) | 0)] = 1;
    /* a pixel blends cells two away: wake the neighbouring chunk too */
    const cc = c % CELL_CH, rr = r % CELL_CH;
    if (cc < 2 && c >= CELL_CH) this.paint[((r / CELL_CH) | 0) * this.ccols + ((c / CELL_CH) | 0) - 1] = 1;
    if (cc > CELL_CH - 3 && c + CELL_CH < this.cols) this.paint[((r / CELL_CH) | 0) * this.ccols + ((c / CELL_CH) | 0) + 1] = 1;
    if (rr < 2 && r >= CELL_CH) this.paint[(((r / CELL_CH) | 0) - 1) * this.ccols + ((c / CELL_CH) | 0)] = 1;
    if (rr > CELL_CH - 3 && r + CELL_CH < this.rows) this.paint[(((r / CELL_CH) | 0) + 1) * this.ccols + ((c / CELL_CH) | 0)] = 1;
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

  /* the first solid surface from the water down, per column (for walking on top of things) */
  rebuildTop(c0, c1) {
    for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
      let y = null;
      for (let r = 0; r < this.rows; r++) { const m = this.mat[r * this.cols + c]; if (m !== MAT.AIR) { y = this.Y0 + r * this.C; break; } }
      this.top[c] = y === null ? WORLD.gridB : y;
    }
  }
  flushTop() { if (this.topDirty) { this.rebuildTop(this.topLo - 1, this.topHi + 1); this.topDirty = false; this.topLo = this.topHi = undefined; } }
  /* the surface something walking stands on, smoothed over a cell */
  topAt(x) {
    if (x < this.X0 + this.C) return this.surfaceAt(x);
    this.flushTop();
    const u = (x - this.X0) / this.C - .5, c = Math.floor(u), f = u - c;
    const a = this.top[clamp(c, 0, this.cols - 1)], b = this.top[clamp(c + 1, 0, this.cols - 1)];
    return lerp(a, b, f);
  }
  /* a walking surface that ignores narrow holes (a lobster steps over a den's door) */
  walkTop(x, span = 8) {
    let best = Infinity;
    for (let k = -span; k <= span; k += this.C) best = Math.min(best, this.topAt(x + k));
    return best;
  }
  /* how steep the floor is here (rise per unit across) */
  slopeAt(x, span = 6) { return (this.walkTop(x + span, 4) - this.walkTop(x - span, 4)) / (2 * span); }

  /* every cell whose centre lies within `rad` (+ slack) of (x, y): calls fn(i, cellX, cellY) */
  cellsIn(x, y, rad, fn, slack = this.C * .35) {
    const R = rad + slack, c0 = Math.max(0, this.col(x - R)), c1 = Math.min(this.cols - 1, this.col(x + R)), r0 = Math.max(0, this.row(y - R)), r1 = Math.min(this.rows - 1, this.row(y + R));
    const R2 = R * R;
    for (let r = r0; r <= r1; r++) { const cy = this.Y0 + (r + .5) * this.C, dy = cy - y; for (let c = c0; c <= c1; c++) { const cx = this.X0 + (c + .5) * this.C, dx = cx - x; if (dx * dx + dy * dy <= R2) fn(r * this.cols + c, cx, cy); } }
  }
  /* is a circle free of solid cells (and of open water, if `inside`)? */
  free(x, y, rad, inside) {
    if (x < this.X0 || y < this.Y0 || x >= this.X0 + this.cols * this.C || y >= this.Y0 + this.rows * this.C) return false;
    let ok = true;
    this.cellsIn(x, y, rad, (i) => { if (this.mat[i] !== MAT.AIR || (inside && this.sky[i])) ok = false; }, 0);
    const i = this.idx(x, y); if (i < 0 || this.mat[i] !== MAT.AIR || (inside && this.sky[i])) ok = false;
    return ok;
  }
  /* what is in a circle: counts of each kind, and whether it touches the open water */
  survey(x, y, rad) {
    const out = { solid: 0, soft: 0, rock: 0, gravel: 0, sky: 0, n: 0 };
    this.cellsIn(x, y, rad, (i) => {
      out.n++;
      const m = this.mat[i];
      if (this.sky[i] && m === MAT.AIR) out.sky++;
      if (m === MAT.AIR) return;
      out.solid++;
      if (this.diggable(m)) out.soft++;
      else if (m === MAT.GRAVEL) out.gravel++;
      else out.rock++;
    });
    return out;
  }
  /* dig a circle: each cell takes hard/power seconds; returns what was dug.
     opts: { gravel: can dig through gravel } */
  dig(x, y, rad, power, dt, opts = {}) {
    const res = { cells: 0, blocked: 0 };
    this.cellsIn(x, y, rad, (i) => {
      const m = this.mat[i]; if (m === MAT.AIR) return;
      let hard = MAT_INFO[m].hard;
      if (m === MAT.GRAVEL && !opts.gravel) hard = Infinity;
      if (!isFinite(hard)) { res.blocked++; return; }
      this.dmg[i] += power * dt / hard;
      if (this.dmg[i] >= 1) { res.cells++; this.set(i, MAT.AIR); }
    }, 0);
    return res;
  }
  /* how deep (x, y) is below the open water straight above it */
  depthAt(x, y) { return y - this.topAt(x); }

  /* run-length encoding of the current materials (every den survives a reload) */
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
