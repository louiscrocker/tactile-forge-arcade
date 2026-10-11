/* ============================================================
   valley.js — the valley in cross-section, as cells
   ============================================================
   A northern-Rockies valley from the side, left to right
   (+x right, +y DOWN, the valley floor near y = 0):

     the den hill: a lodgepole-pine slope with the home den dug
       into it (a tunnel and a round chamber, there from the start)
     the summer meadow (the rendezvous site), with one big tree
     the aspen slope down to the river, the river itself (a dip
       filled with water; frozen over in winter) and the far bank
     the sagebrush valley floor, where the elk and bison herds
       stand in winter, and the home pack's scent post at its edge
     the ridge, the territory's edge; then the road on its
       embankment, with the wildlife tunnel under it
     the new valley: aspens, scent posts, and a soft hillside at
       the far end where a pair digs its den

   One grid of 6-unit cells covers the whole valley.  Every cell
   is a material:

     AIR     open air (or a den somebody dug, or the river)
     SOIL    diggable earth
     ROCK    bedrock and boulders: nobody digs that
     ROOT    tree roots in the topsoil: only a big wolf digs them
     GRAVEL  the river bed
     SNOW    laid on top of everything in winter; a walking pack
             breaks a trail through it (SNOW → AIR)
     ICE     the frozen river's surface, walkable in winter

   `orig` remembers what each cell was, so a dug den shows dark
   earth behind it, and `sky` marks the open air above the ground
   (snow is only ever laid into sky cells; a digging wolf never
   digs out into them, it climbs out).
   ============================================================ */
'use strict';

const MAT = { AIR: 0, SOIL: 1, ROCK: 2, ROOT: 3, GRAVEL: 4, SNOW: 5, ICE: 6 };
/* hard: seconds of digging per cell at power 1 (Infinity = never) */
const MAT_INFO = [
  { name: 'air', hard: 0, col: [0, 0, 0], col2: [0, 0, 0] },
  { name: 'earth', hard: .4, col: [128, 92, 58], col2: [88, 60, 36] },
  { name: 'rock', hard: Infinity, col: [132, 126, 116], col2: [86, 82, 76] },
  { name: 'roots', hard: 2.4, col: [112, 78, 48], col2: [84, 56, 32] },
  { name: 'gravel', hard: Infinity, col: [150, 146, 136], col2: [108, 104, 96] },
  { name: 'snow', hard: .02, col: [244, 248, 255], col2: [214, 226, 244] },
  { name: 'ice', hard: Infinity, col: [190, 224, 240], col2: [140, 190, 220] }
];
const CELL_CH = 16;                         /* repaint chunk, in cells */

const WORLD = {
  left: -700, right: 6700, top: -1700, bottom: 700,
  denX: 150, denHillL: -400, denHillR: 520,
  meadowL: 900, meadowR: 1500, rvX: 1200, treeX: 1230,
  riverL: 1880, riverR: 2080, riverY: 6,
  flatL: 2300, flatR: 3800, postX: 3680, herdX: 3150, bioX: 2640,
  ridgeL: 3800, ridgeTop: 4150, ridgeR: 4500,
  roadL: 4600, roadR: 4700, tunnelL: 4560, tunnelR: 4740, roadH: 64,
  valleyL: 4800, valleyR: 6600, mateX: 5240, newDenL: 5720, newDenR: 6120, posts2: [5020, 5460, 6280],
  gridL: -500, gridR: 6600, gridT: -760, gridB: 320
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
    this.top = new Float32Array(this.cols); this.base = new Float32Array(this.cols);
    this.version = 0; this.dirtyAll = true; this.snowOn = false;
    const R = mulberry32(seed), n1 = makeNoise1D(seed + 1), n2 = makeNoise2D(seed + 2), n3 = makeNoise2D(seed + 3);
    this.rng = R;
    /* the shape of the valley (before anybody digs or any snow falls) */
    this.surfaceAt = (x) => {
      const W = WORLD;
      let y;
      if (x < W.denHillL) y = -240 + (W.denHillL - x) * .12;
      else if (x < W.denX) y = lerp(-240, -100, smoothstep(W.denHillL, W.denX, x));
      else if (x < W.denHillR) y = lerp(-100, -30, smoothstep(W.denX, W.denHillR, x));
      else if (x < W.meadowL) y = lerp(-30, -16, (x - W.denHillR) / (W.meadowL - W.denHillR));
      else if (x < W.meadowR) y = -16;
      else if (x < W.riverL) y = lerp(-16, -2, smoothstep(W.meadowR, W.riverL, x));
      else if (x < W.riverR) { const t = (x - W.riverL) / (W.riverR - W.riverL); y = -2 + 44 * Math.sin(Math.PI * t) ** .8; }
      else if (x < W.flatL) y = lerp(-2, -10, smoothstep(W.riverR, W.flatL, x));
      else if (x < W.ridgeL) y = -10 + Math.sin(x * .004) * 9 + Math.sin(x * .011 + 2) * 4;
      else if (x < W.ridgeTop) y = lerp(-10, -150, smoothstep(W.ridgeL, W.ridgeTop, x));
      else if (x < W.ridgeR) y = lerp(-150, -24, smoothstep(W.ridgeTop, W.ridgeR, x));
      else if (x < W.valleyL) y = -24;
      else if (x < W.newDenL) y = -24 + Math.sin(x * .005) * 7 - (x - W.valleyL) * .028;
      else if (x < W.newDenR) y = lerp(-24 + Math.sin(W.newDenL * .005) * 7 - (W.newDenL - W.valleyL) * .028, -150, smoothstep(W.newDenL, W.newDenR, x));
      else y = -150 - (x - W.newDenR) * .09;
      /* a little bumpiness everywhere except on the river and the road */
      const smoothZone = (x > W.riverL && x < W.riverR) || (x > W.ridgeR && x < W.valleyL) ? .15 : 1;
      return y + (n1(x * .02 + 7) - .5) * 7 * smoothZone + (n1(x * .07 + 3) - .5) * 2.5 * smoothZone;
    };
    const surf = new Float32Array(this.cols);
    for (let c = 0; c < this.cols; c++) surf[c] = this.surfaceAt(this.cx(c));
    const W = WORLD;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r), g = surf[c];
      let m = MAT.AIR;
      if (y >= g) {
        const depth = y - g;
        const denHill = (x > W.denHillL - 100 && x < W.denHillR) || (x > W.newDenL - 60 && x < W.newDenR + 200);
        const soilDepth = denHill ? 130 + (n2(x * .01, 3) - .5) * 30 : x > W.ridgeL && x < W.ridgeR ? 18 + (n2(x * .02, 5) - .5) * 12 : 54 + (n2(x * .01, 13) - .5) * 40;
        if (x > W.riverL && x < W.riverR && depth < 12) m = MAT.GRAVEL;
        else {
          m = depth < soilDepth ? MAT.SOIL : MAT.ROCK;
          const forest = x < W.meadowL - 80 || (x > W.valleyL && x < W.newDenL - 60);
          if (m === MAT.SOIL && forest && depth > 10 && depth < 60 && n3(x * .06, y * .06) > .78) m = MAT.ROOT;
        }
      }
      this.mat[i] = m;
      this.tex[i] = clamp(n2(x * .02, y * .3) * 160 + n3(x * .4, y * .4) * 95, 0, 255) | 0;
    }
    /* (boulders on the surface are scenery: see Render decor.stones) */
    /* pinnacles of rock deep in the soil */
    for (let k = 0; k < 40; k++) { const x = lerp(W.left + 200, W.right - 100, R()), g = this.surfaceAt(x); if ((x > W.denHillL && x < W.denHillR) || x > W.newDenL - 60) continue; this.blob(x, g + 40 + R() * 80, 8 + R() * 14, 6 + R() * 10, MAT.ROCK, (m) => m === MAT.SOIL || m === MAT.ROOT); }
    this.orig.set(this.mat);
    /* open air: never dug into; snow only ever lands here */
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const i = r * this.cols + c; this.sky[i] = this.orig[i] === MAT.AIR ? 1 : 0; }
    /* the home den: a tunnel from the hillside going into the hill, a round chamber at the end
       (dug after orig is taken, so its back wall shows dark earth) */
    this.den = this.carveDen(W.denX, -1);
    this.rebuildTop(0, this.cols - 1);
  }

  /* dig a wolf den into a hillside at x: the tunnel goes `dir` (−1 left, +1 right) and down to a chamber.
     Returns { x, y, cx, cy, dir } (the mouth and the chamber's middle). */
  carveDen(x, dir) {
    const g = this.surfaceAt(x), len = 96, drop = 58;
    for (let k = 0; k <= 1; k += .06) {
      const px = x + dir * k * len, py = g + 6 + k * drop;
      this.blob(px, py, 17, 14, MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL);
    }
    const cx = x + dir * (len + 14), cy = g + 6 + drop + 4;
    this.blob(cx, cy, 30, 22, MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL);
    this.flushTop();
    return { x, y: g, cx, cy, dir };
  }

  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  idx(x, y) { const c = this.col(x), r = this.row(y); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  /* off the grid: solid rock below the valley's shape */
  matAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.ROCK : MAT.AIR) : this.mat[i]; }
  origAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.ROCK : MAT.AIR) : this.orig[i]; }
  solidAt(x, y) { return this.matAt(x, y) !== MAT.AIR; }
  diggable(m) { return m === MAT.SOIL || m === MAT.SNOW; }

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

  /* the first solid surface from the sky down, per column (for walking on top of things),
     and the first surface that is not snow (so the snow's depth is top − base) */
  rebuildTop(c0, c1) {
    for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
      let y = null, b = null;
      for (let r = 0; r < this.rows; r++) {
        const m = this.mat[r * this.cols + c];
        if (m === MAT.AIR) { if (y !== null && b === null) { b = this.Y0 + r * this.C; } continue; }
        if (y === null) y = this.Y0 + r * this.C;
        if (m !== MAT.SNOW) { b = this.Y0 + r * this.C; break; }
      }
      this.top[c] = y === null ? WORLD.gridB : y;
      this.base[c] = b === null ? this.top[c] : b;
    }
  }
  flushTop() { if (this.topDirty) { this.rebuildTop(this.topLo - 1, this.topHi + 1); this.topDirty = false; this.topLo = this.topHi = undefined; } }
  /* the surface something walking stands on, smoothed over a cell */
  topAt(x) {
    if (x < this.X0 + this.C || x > this.X0 + (this.cols - 1) * this.C) return this.surfaceAt(x);
    this.flushTop();
    const u = (x - this.X0) / this.C - .5, c = Math.floor(u), f = u - c;
    const a = this.top[clamp(c, 0, this.cols - 1)], b = this.top[clamp(c + 1, 0, this.cols - 1)];
    return lerp(a, b, f);
  }
  /* a walking surface that ignores narrow holes (a wolf steps over a den mouth) */
  walkTop(x, span = 8) {
    let best = Infinity;
    for (let k = -span; k <= span; k += this.C) best = Math.min(best, this.topAt(x + k));
    return best;
  }
  /* how deep the snow is here (0 when there is none) */
  snowDepthAt(x) {
    if (!this.snowOn) return 0;
    const c = clamp(this.col(x), 0, this.cols - 1); this.flushTop();
    return Math.max(0, this.base[c] - this.top[c]);
  }
  /* how steep the ground is here (rise per unit across) */
  slopeAt(x, span = 6) { return (this.walkTop(x + span, 4) - this.walkTop(x - span, 4)) / (2 * span); }

  /* every cell whose centre lies within `rad` (+ slack) of (x, y): calls fn(i, cellX, cellY) */
  cellsIn(x, y, rad, fn, slack = this.C * .35) {
    const R = rad + slack, c0 = Math.max(0, this.col(x - R)), c1 = Math.min(this.cols - 1, this.col(x + R)), r0 = Math.max(0, this.row(y - R)), r1 = Math.min(this.rows - 1, this.row(y + R));
    const R2 = R * R;
    for (let r = r0; r <= r1; r++) { const cy = this.Y0 + (r + .5) * this.C, dy = cy - y; for (let c = c0; c <= c1; c++) { const cx = this.X0 + (c + .5) * this.C, dx = cx - x; if (dx * dx + dy * dy <= R2) fn(r * this.cols + c, cx, cy); } }
  }
  /* is a circle free of solid cells (and of open air, if `inside`)? */
  free(x, y, rad, inside) {
    if (x < this.X0 || y < this.Y0 || x >= this.X0 + this.cols * this.C || y >= this.Y0 + this.rows * this.C) return false;
    let ok = true;
    this.cellsIn(x, y, rad, (i) => { if (this.mat[i] !== MAT.AIR || (inside && this.sky[i])) ok = false; }, 0);
    const i = this.idx(x, y); if (i < 0 || this.mat[i] !== MAT.AIR || (inside && this.sky[i])) ok = false;
    return ok;
  }
  /* what is in a circle: counts of each kind, and whether it touches the open air */
  survey(x, y, rad) {
    const out = { solid: 0, soft: 0, rock: 0, root: 0, sky: 0, snow: 0, n: 0 };
    this.cellsIn(x, y, rad, (i) => {
      out.n++;
      const m = this.mat[i];
      if (this.sky[i] && m === MAT.AIR) out.sky++;
      if (m === MAT.AIR) return;
      out.solid++;
      if (m === MAT.SOIL) out.soft++;
      else if (m === MAT.ROOT) out.root++;
      else if (m === MAT.SNOW) out.snow++;
      else out.rock++;
    });
    return out;
  }
  /* dig a circle: each cell takes hard/power seconds; returns what was dug.
     opts: { root: can dig through roots } */
  dig(x, y, rad, power, dt, opts = {}) {
    const res = { cells: 0, blocked: 0, snow: 0 };
    this.cellsIn(x, y, rad, (i) => {
      const m = this.mat[i]; if (m === MAT.AIR) return;
      let hard = MAT_INFO[m].hard;
      if (m === MAT.ROOT && !opts.root) hard = Infinity;
      if (!isFinite(hard)) { res.blocked++; return; }
      this.dmg[i] += power * dt / hard;
      if (this.dmg[i] >= 1) { res.cells++; if (m === MAT.SNOW) res.snow++; this.set(i, MAT.AIR); }
    }, 0);
    return res;
  }
  /* a walking pack packs the snow down: the trail it breaks is open air */
  breakTrail(x, y, rad) {
    let n = 0;
    this.cellsIn(x, y, rad, (i) => { if (this.mat[i] === MAT.SNOW) { this.set(i, MAT.AIR); n++; } }, 0);
    return n;
  }
  /* how deep (x, y) is below the open air straight above it */
  depthAt(x, y) { return y - this.topAt(x); }

  /* ---------- winter ---------- */
  /* lay snow on every surface: depthFn(x) in units (only into open sky cells, never inside a den);
     the river freezes over with a sheet of ice */
  laySnow(depthFn) {
    for (let c = 0; c < this.cols; c++) {
      const x = this.cx(c);
      let r0 = -1;
      for (let r = 0; r < this.rows; r++) if (this.mat[r * this.cols + c] !== MAT.AIR) { r0 = r; break; }
      if (r0 < 0) continue;
      const d = Math.round(depthFn(x) / this.C);
      for (let k = 1; k <= d; k++) { const r = r0 - k; if (r < 0) break; const i = r * this.cols + c; if (this.mat[i] === MAT.AIR && this.sky[i]) this.set(i, MAT.SNOW); }
    }
    for (let x = WORLD.riverL + 4; x < WORLD.riverR - 4; x += this.C) {
      const i = this.idx(x, WORLD.riverY - 3); if (i >= 0 && this.mat[i] === MAT.AIR) this.set(i, MAT.ICE);
    }
    this.snowOn = true; this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }
  melt() {
    for (let i = 0; i < this.n; i++) if (this.mat[i] === MAT.SNOW || this.mat[i] === MAT.ICE) { this.mat[i] = MAT.AIR; this.dmg[i] = 0; }
    this.snowOn = false; this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }

  /* run-length encoding of the current materials (every den, trail and snowdrift survives a reload) */
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
    this.snowOn = mat.includes(MAT.SNOW);
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
    return true;
  }
}
