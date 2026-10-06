/* ============================================================
   island.js — the island in cross-section, as cells
   ============================================================
   Christmas Island from the side, left to right (+x right,
   +y DOWN, the sea's surface at y = 0):

     the deep blue ocean (no cells: the floor is far below)
     the reef slope and the reef flat, coral on top
     the rocky shore, where the waves wash in
     the shore terrace: sandy soil where the boys dig burrows
     the inland cliff: limestone, climbed by every crab
     the plateau: rainforest on deep red soil, crossed by a road
     with low crab fences and a crab bridge

   One grid of 6-unit cells covers the reef to the far forest.
   Every cell is a material:

     AIR     open air or sea water (or a burrow somebody dug)
     SAND    shore-terrace soil: soft, easy to dig
     SOIL    red-brown forest soil: diggable
     ROCK    limestone: nobody digs that
     CORAL   the living reef on top of the rock
     ROOT    tree roots in the topsoil: only a big crab digs them
     ROAD    the road's tarmac
     FENCE   the low crab fence beside the road
     BRIDGE  the crab bridge's mesh deck and ramps
     PLUG    leaves packed into a burrow door (dry season, moult)

   `orig` remembers what each cell was, so a dug burrow shows the
   dark soil behind it, and `sky` marks the open air and the sea
   (a burrowing crab never digs out into those; it comes out).
   ============================================================ */
'use strict';

const MAT = { AIR: 0, SAND: 1, SOIL: 2, ROCK: 3, CORAL: 4, ROOT: 5, ROAD: 6, FENCE: 7, BRIDGE: 8, PLUG: 9 };
/* hard: seconds of digging per cell at power 1 (Infinity = never) */
const MAT_INFO = [
  { name: 'air', hard: 0, col: [0, 0, 0], col2: [0, 0, 0] },
  { name: 'sandy soil', hard: .22, col: [214, 176, 122], col2: [176, 136, 88] },
  { name: 'forest soil', hard: .42, col: [128, 66, 40], col2: [92, 44, 26] },
  { name: 'limestone', hard: Infinity, col: [178, 168, 150], col2: [128, 120, 108] },
  { name: 'coral', hard: Infinity, col: [236, 128, 120], col2: [178, 96, 150] },
  { name: 'roots', hard: 2.4, col: [120, 82, 52], col2: [92, 60, 36] },
  { name: 'road', hard: Infinity, col: [70, 72, 76], col2: [52, 54, 58] },
  { name: 'crab fence', hard: Infinity, col: [90, 168, 90], col2: [60, 130, 66] },
  { name: 'crab bridge', hard: Infinity, col: [150, 160, 168], col2: [110, 120, 130] },
  { name: 'leaf plug', hard: .15, col: [150, 120, 60], col2: [110, 86, 40] }
];
const CELL_CH = 16;                         /* repaint chunk, in cells */

const WORLD = {
  left: -4200, right: 5300, top: -1500, bottom: 760,
  seaFloor: 720, reefDrop: -1150, reefL: -760, shore: 0,
  terraceL: 130, terraceR: 640, cliffL: 650, cliffR: 905, plateau: -442,
  roadL: 2440, roadR: 2540, bridgeL: 2350, bridgeR: 2630, deck: 70,
  homeX: 3900, eggX: 30,
  gridL: -1300, gridR: 5300, gridT: -640, gridB: 340
};
/* the cliff's profile: steep rock faces with ledges to rest on */
const CLIFF_PTS = [[650, -44], [668, -62], [700, -170], [730, -176], [762, -300], [794, -306], [840, -428], [905, -442]];

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
    /* the shape of the island (before anybody digs) */
    this.surfaceAt = (x) => {
      if (x < WORLD.reefDrop) return WORLD.seaFloor;
      if (x < WORLD.reefL) return lerp(WORLD.seaFloor, 112, smoothstep(WORLD.reefDrop, WORLD.reefL, x)) + (n1(x * .02) - .5) * 30;
      if (x < -170) return 100 + (n1(x * .012) - .5) * 44;
      if (x < 0) return lerp(100, 8, smoothstep(-170, 0, x)) + (n1(x * .05 + 9) - .5) * 8;
      if (x < WORLD.terraceL) return lerp(8, -26, x / WORLD.terraceL) + (n1(x * .09 + 3) - .5) * 7;
      if (x < WORLD.cliffL) return -28 - (x - WORLD.terraceL) * .03 + (n1(x * .03 + 5) - .5) * 8;
      if (x < WORLD.cliffR) {
        let i = 1; while (i < CLIFF_PTS.length - 1 && CLIFF_PTS[i][0] < x) i++;
        const a = CLIFF_PTS[i - 1], b = CLIFF_PTS[i], t = clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
        const by = i === CLIFF_PTS.length - 1 ? plateauY(WORLD.cliffR) : b[1];
        return lerp(a[1], by, t) + (n1(x * .2 + 11) - .5) * 5 * (1 - t * (i === CLIFF_PTS.length - 1));
      }
      return plateauY(x);
    };
    const plateauY = (x) => {
      let y = WORLD.plateau + 16 * Math.sin(x * .0021 + 1) + 7 * Math.sin(x * .009) + (n1(x * .02 + 7) - .5) * 8;
      /* the road runs flat across the plateau */
      const r = smoothstep(WORLD.bridgeL - 60, WORLD.roadL - 10, x) * (1 - smoothstep(WORLD.roadR + 10, WORLD.bridgeR + 60, x));
      return lerp(y, WORLD.plateau + 4, r);
    };
    const surf = new Float32Array(this.cols);
    for (let c = 0; c < this.cols; c++) surf[c] = this.surfaceAt(this.cx(c));
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r), g = surf[c];
      let m = MAT.AIR;
      if (y >= g) {
        const depth = y - g;
        if (x < -170) m = depth < 14 ? (n2(x * .03, y * .03) > .5 ? MAT.CORAL : MAT.SAND) : MAT.ROCK;
        else if (x < WORLD.terraceL) m = (depth < 10 && x > -60 && x < 30 && n2(x * .05, 5) > .45) ? MAT.SAND : MAT.ROCK;
        else if (x < WORLD.cliffL) m = depth < 56 + (n2(x * .02, 9) - .5) * 24 ? MAT.SAND : MAT.ROCK;
        else if (x < WORLD.cliffR) m = MAT.ROCK;
        else {
          m = depth < 120 + (n2(x * .01, 13) - .5) * 60 ? MAT.SOIL : MAT.ROCK;
          if (m === MAT.SOIL && depth > 14 && depth < 90 && n3(x * .06, y * .06) > .76) m = MAT.ROOT;
          if (x >= WORLD.roadL && x <= WORLD.roadR && depth < 7) m = MAT.ROAD;
        }
      }
      this.mat[i] = m;
      this.tex[i] = clamp(n2(x * .02, y * .3) * 160 + n3(x * .4, y * .4) * 95, 0, 255) | 0;
    }
    /* coral heads standing up on the reef flat */
    for (let k = 0; k < 22; k++) {
      const x = lerp(-740, -190, R()), g = this.surfaceAt(x), rad = 8 + R() * 16;
      this.blob(x, g - rad * .5, rad, rad * (.7 + R() * .5), MAT.CORAL, () => true);
    }
    /* limestone boulders sticking out of the terrace and the forest floor */
    /* (none on the terrace: the boys dig their burrows there; its hiding rocks are drawn as scenery) */
    for (let k = 0; k < 9; k++) R();
    for (let k = 0; k < 26; k++) { const x = lerp(1000, WORLD.right - 100, R()); if (x > WORLD.bridgeL - 80 && x < WORLD.bridgeR + 80) continue; this.blob(x, this.surfaceAt(x) + 6, 10 + R() * 16, 7 + R() * 7, MAT.ROCK, () => true); }
    /* pinnacles of limestone in the soil, deeper down */
    for (let k = 0; k < 40; k++) { const x = lerp(1000, WORLD.right - 60, R()), g = this.surfaceAt(x); this.blob(x, g + 50 + R() * 90, 8 + R() * 14, 6 + R() * 10, MAT.ROCK, (m) => m === MAT.SOIL || m === MAT.ROOT); }
    /* the road: a crab fence each side, and the crab bridge over the top */
    for (const fx of [WORLD.roadL - 12, WORLD.roadR + 12]) {
      const g = this.surfaceAt(fx);
      for (let y = g - 34; y < g + 4; y += this.C) { const i = this.idx(fx, y); if (i >= 0) this.mat[i] = MAT.FENCE; }
    }
    const deckY = WORLD.plateau + 4 - WORLD.deck;
    for (let x = WORLD.bridgeL; x <= WORLD.bridgeR; x += this.C / 2) {
      const g = this.surfaceAt(x);
      const up = smoothstep(WORLD.bridgeL, WORLD.bridgeL + 70, x), down = 1 - smoothstep(WORLD.bridgeR - 70, WORLD.bridgeR, x);
      const y = lerp(g, deckY, Math.min(up, down));
      if (y > g - 3) continue;
      for (let t = 0; t < 7; t += 3) { const i = this.idx(x, y + t); if (i >= 0) this.mat[i] = MAT.BRIDGE; }
    }
    /* the bridge's legs */
    for (const lx of [WORLD.roadL - 26, WORLD.roadR + 26]) for (let y = deckY + 6; y < this.surfaceAt(lx); y += this.C) { const i = this.idx(lx, y); if (i >= 0) this.mat[i] = MAT.BRIDGE; }
    this.orig.set(this.mat);
    /* open air and sea: never dug into */
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const i = r * this.cols + c; this.sky[i] = this.orig[i] === MAT.AIR ? 1 : 0; }
    this.rebuildTop(0, this.cols - 1);
  }

  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  idx(x, y) { const c = this.col(x), r = this.row(y); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  /* off the grid: the deep sea floor to the left, solid rock below */
  matAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.ROCK : MAT.AIR) : this.mat[i]; }
  origAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.ROCK : MAT.AIR) : this.orig[i]; }
  solidAt(x, y) { return this.matAt(x, y) !== MAT.AIR; }
  diggable(m) { return m === MAT.SAND || m === MAT.SOIL || m === MAT.PLUG; }

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

  /* the first solid surface from the sky down, per column (for walking on top of things) */
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
  /* a walking surface that ignores narrow holes (a crab steps over a burrow door) */
  walkTop(x, span = 8) {
    let best = Infinity;
    for (let k = -span; k <= span; k += this.C) best = Math.min(best, this.topAt(x + k));
    return best;
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
    const out = { solid: 0, soft: 0, rock: 0, root: 0, sky: 0, plug: 0, n: 0 };
    this.cellsIn(x, y, rad, (i) => {
      out.n++;
      const m = this.mat[i];
      if (this.sky[i] && m === MAT.AIR) out.sky++;
      if (m === MAT.AIR) return;
      out.solid++;
      if (m === MAT.SAND || m === MAT.SOIL) out.soft++;
      else if (m === MAT.ROOT) out.root++;
      else if (m === MAT.PLUG) out.plug++;
      else out.rock++;
    });
    return out;
  }
  /* dig a circle: each cell takes hard/power seconds; returns what was dug.
     opts: { root: can dig through roots } */
  dig(x, y, rad, power, dt, opts = {}) {
    const res = { cells: 0, blocked: 0, plug: 0 };
    this.cellsIn(x, y, rad, (i) => {
      const m = this.mat[i]; if (m === MAT.AIR) return;
      let hard = MAT_INFO[m].hard;
      if (m === MAT.ROOT && !opts.root) hard = Infinity;
      if (!isFinite(hard)) { res.blocked++; return; }
      this.dmg[i] += power * dt / hard;
      if (this.dmg[i] >= 1) { res.cells++; if (m === MAT.PLUG) res.plug++; this.set(i, MAT.AIR); }
    }, 0);
    return res;
  }
  /* pack leaves into the burrow just above (x, y): the door is shut */
  plugAbove(x, y, rad) {
    let n = 0;
    for (let yy = y - rad * 1.2; yy > y - rad * 4; yy -= this.C) {
      this.cellsIn(x, yy, rad * .9, (i) => { if (this.mat[i] === MAT.AIR && !this.sky[i]) { this.set(i, MAT.PLUG); n++; } }, 0);
      if (n > 6) break;
    }
    this.flushTop();
    return n;
  }
  /* how deep (x, y) is below the open air straight above it */
  depthAt(x, y) { return y - this.topAt(x); }

  /* run-length encoding of the current materials (every burrow survives a reload) */
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
