/* ============================================================
   arctic.js — the Arctic coast in cross-section, as cells
   ============================================================
   An Arctic coast from the side, left to right (+x right, +y
   DOWN, the sea's surface at y = 0):

     the den hills: a high tundra hill whose seaward slope holds a
       deep old snowdrift; the mother's snow den is dug into the
       drift (a tunnel and a round room, there from the start).
       Under the drift is a bank of soft peat, where a mother-to-
       be can dig a den of her own in autumn
     the tundra: low and rolling, peat over frozen ground (the
       permafrost), boulders, one big rock to shelter behind
     the beach: gravel shingle running down into the sea
     the sea: a gravel seabed far below.  In winter and spring a
       sheet of sea ice covers it, with seals' breathing holes, a
       lead (a long crack of open water) and pressure ridges (walls
       of piled-up ice blocks); in early summer the ice breaks into
       floes; in summer it is open water; in autumn it freezes again

   One grid of 6-unit cells covers it all.  Every cell is a material:

     AIR     open air (or a den somebody dug, or sea water)
     SOIL    peat and tundra earth: diggable
     ROCK    bedrock and boulders: nobody digs that
     FROZEN  the permafrost: frozen ground, only a big bear scrapes it
     GRAVEL  the beach shingle and the seabed
     SNOW    laid on top of everything in winter
     ICE     sea ice, laid on the sea (and the floes)
     DRIFT   the deep old snowdrift on the den hill: diggable, and
             part of the land from the start, so a dug den shows
             blue snow walls behind it; it melts away in summer

   `orig` remembers what each cell was, so a dug den shows its walls
   behind it, and `sky` marks the open air above the ground (snow is
   only ever laid into sky cells; a digging bear never digs out into
   them, it climbs out).
   ============================================================ */
'use strict';

const MAT = { AIR: 0, SOIL: 1, ROCK: 2, FROZEN: 3, GRAVEL: 4, SNOW: 5, ICE: 6, DRIFT: 7 };
/* hard: seconds of digging per cell at power 1 (Infinity = never) */
const MAT_INFO = [
  { name: 'air', hard: 0, col: [0, 0, 0], col2: [0, 0, 0] },
  { name: 'peat', hard: .4, col: [104, 78, 54], col2: [70, 50, 34] },
  { name: 'rock', hard: Infinity, col: [128, 126, 124], col2: [84, 84, 86] },
  { name: 'permafrost', hard: 2.4, col: [112, 104, 100], col2: [82, 76, 74] },
  { name: 'gravel', hard: Infinity, col: [152, 148, 140], col2: [108, 106, 100] },
  { name: 'snow', hard: .02, col: [246, 249, 255], col2: [214, 226, 244] },
  { name: 'sea ice', hard: Infinity, col: [206, 232, 246], col2: [150, 198, 226] },
  { name: 'snowdrift', hard: .06, col: [238, 244, 252], col2: [204, 218, 238] }
];
const CELL_CH = 16;                         /* repaint chunk, in cells */

const WORLD = {
  left: -900, right: 7500, top: -1800, bottom: 700,
  seaY: 0,
  hillTop: -300, denX: 270, driftL: -60, driftR: 440,
  slopeR: 760, bankL: 300, bankR: 640,
  tundraL: 760, rockX: 1300, buggyX: 1980, tundraR: 2200,
  shoreL: 2200, shoreX: 2620, seabedX: 3150,
  iceL: 2560, iceR: 7400,
  holes: [3350, 4380, 5950, 6750], leadL: 5440, leadR: 5620, ridges: [4060, 5180, 6420],
  sparX: 6250, meetX: 6900,
  gridL: -700, gridR: 7400, gridT: -720, gridB: 360
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
    this.version = 0; this.dirtyAll = true; this.backDirty = false; this.snowOn = false; this.iceOn = false; this.driftGone = false;
    const R = mulberry32(seed), n1 = makeNoise1D(seed + 1), n2 = makeNoise2D(seed + 2), n3 = makeNoise2D(seed + 3);
    this.rng = R;
    /* the shape of the land and the seabed (before anybody digs or any snow falls) */
    this.surfaceAt = (x) => {
      const W = WORLD;
      let y, bump = 1;
      if (x < W.hillTop) y = -262 - (W.hillTop - x) * .05;
      else if (x < 150) y = lerp(-262, -150, smoothstep(W.hillTop, 150, x));
      else if (x < W.slopeR) y = lerp(-150, -24, smoothstep(150, W.slopeR, x));
      else if (x < W.tundraR) y = lerp(-24, -12, (x - W.slopeR) / (W.tundraR - W.slopeR)) + Math.sin(x * .006) * 7 + Math.sin(x * .017 + 1) * 3;
      else if (x < W.shoreX) { const e = lerp(-24, -12, 1) + Math.sin(W.tundraR * .006) * 7 + Math.sin(W.tundraR * .017 + 1) * 3; y = lerp(e, 1, smoothstep(W.tundraR, W.shoreX, x)); bump = .3; }
      else if (x < W.seabedX) { y = lerp(1, 190, smoothstep(W.shoreX, W.seabedX, x)); bump = .4; }
      else y = 190 + Math.sin(x * .004) * 14 + Math.sin(x * .013 + 2) * 6;
      return y + ((n1(x * .02 + 7) - .5) * 7 + (n1(x * .07 + 3) - .5) * 2.5) * bump;
    };
    /* the old snowdrift's thickness on the den hill's seaward slope (a cornice near its top) */
    this.driftAt = (x) => {
      const W = WORLD; if (x <= W.driftL || x >= W.driftR) return 0;
      const t = (x - W.driftL) / (W.driftR - W.driftL);
      return 84 * Math.pow(Math.sin(Math.PI * Math.pow(t, .8)), .7) * (1 + (n1(x * .03 + 40) - .5) * .12);
    };
    const surf = new Float32Array(this.cols), drift = new Float32Array(this.cols);
    for (let c = 0; c < this.cols; c++) { surf[c] = this.surfaceAt(this.cx(c)); drift[c] = this.driftAt(this.cx(c)); }
    const W = WORLD;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, x = this.cx(c), y = this.cy(r), g = surf[c];
      let m = MAT.AIR;
      if (y >= g) {
        const depth = y - g;
        if (x > W.shoreL) {
          /* the beach and the seabed: shingle over bedrock */
          m = depth < 14 + (n2(x * .03, 7) - .5) * 6 ? MAT.GRAVEL : MAT.ROCK;
        } else {
          const hill = x < W.slopeR + 60;
          const peat = hill ? 130 + (n2(x * .01, 3) - .5) * 30 : 20 + (n2(x * .02, 5) - .5) * 8;
          const frozen = hill ? 0 : 70 + (n2(x * .01, 13) - .5) * 30;
          m = depth < peat ? MAT.SOIL : depth < peat + frozen ? MAT.FROZEN : MAT.ROCK;
        }
      } else if (y >= g - drift[c]) m = MAT.DRIFT;
      this.mat[i] = m;
      this.tex[i] = clamp(n2(x * .02, y * .3) * 160 + n3(x * .4, y * .4) * 95, 0, 255) | 0;
    }
    /* rocks deep in the ground */
    for (let k = 0; k < 50; k++) { const x = lerp(W.left + 200, W.shoreL, R()), g = this.surfaceAt(x); if (x > W.driftL - 80 && x < W.slopeR) continue; this.blob(x, g + 30 + R() * 70, 8 + R() * 14, 6 + R() * 10, MAT.ROCK, (m) => m === MAT.SOIL || m === MAT.FROZEN); }
    this.orig.set(this.mat);
    /* open air: never dug into; snow only ever lands here */
    for (let i = 0; i < n; i++) this.sky[i] = this.orig[i] === MAT.AIR ? 1 : 0;
    /* the mother's snow den: a tunnel from the drift's face going back into the drift,
       a round room at the end (dug after orig is taken, so its walls show blue snow) */
    this.den = this.carveDen(W.denX, -1);
    this.rebuildTop(0, this.cols - 1);
  }

  /* dig a den into a slope at x: the tunnel goes `dir` (−1 left, +1 right) and down to a round room.
     Returns { x, y, cx, cy, dir } (the mouth and the room's middle). */
  carveDen(x, dir) {
    const g = this.topAt ? this.walkTopRaw(x) : this.surfaceAt(x), len = 96, drop = 46;
    for (let k = 0; k <= 1; k += .05) {
      const px = x + dir * k * len, py = g + 8 + k * drop;
      this.blob(px, py, 18, 15, MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL);
    }
    const cx = x + dir * (len + 30), cy = g + 8 + drop + 6;
    this.blob(cx, cy, 62, 30, MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL);
    this.flushTop();
    return { x, y: g, cx, cy, dir };
  }
  /* the top of the land at x before the grid's top is built: ground plus drift */
  walkTopRaw(x) { return this.surfaceAt(x) - this.driftAt(x); }

  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  idx(x, y) { const c = this.col(x), r = this.row(y); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  /* off the grid: solid rock below the land's shape */
  matAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.ROCK : MAT.AIR) : this.mat[i]; }
  origAt(x, y) { const i = this.idx(x, y); return i < 0 ? (y >= this.surfaceAt(x) ? MAT.ROCK : MAT.AIR) : this.orig[i]; }
  solidAt(x, y) { return this.matAt(x, y) !== MAT.AIR; }
  diggable(m) { return m === MAT.SOIL || m === MAT.SNOW || m === MAT.DRIFT; }

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
  /* a walking surface that ignores narrow holes (a bear steps over a den mouth or a seal's hole) */
  walkTop(x, span = 8) {
    /* the ground right here, unless a hole narrower than the paws' reach is under it: then the
       level of its two rims (this hugs a slope, where taking the highest point would float) */
    const mid = this.topAt(x), l = this.topAt(x - span), r = this.topAt(x + span);
    let best = Math.min(mid, (l + r) / 2);
    if (mid > Math.max(l, r) + 4) best = Math.min(best, Math.max(l, r));
    return best;
  }
  /* how deep the snow is here (0 when there is none) */
  snowDepthAt(x) {
    if (!this.snowOn) return 0;
    const c = clamp(this.col(x), 0, this.cols - 1); this.flushTop();
    return Math.max(0, this.base[c] - this.top[c]);
  }
  /* how steep the ground is here (rise per unit across; + means downhill to the right) */
  slopeAt(x, span = 6) { return (this.walkTop(x + span, 4) - this.walkTop(x - span, 4)) / (2 * span); }
  /* what the walking surface is made of here (the first solid cell under the top) */
  surfaceMat(x) { const c = clamp(this.col(x), 0, this.cols - 1); this.flushTop(); return this.matAt(x, this.top[c] + 3); }

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
      if (m === MAT.SOIL || m === MAT.DRIFT) out.soft++;
      else if (m === MAT.FROZEN) out.root++;
      else if (m === MAT.SNOW) out.snow++;
      else out.rock++;
    });
    return out;
  }
  /* dig a circle: each cell takes hard/power seconds; returns what was dug.
     opts: { root: can scrape the permafrost } */
  dig(x, y, rad, power, dt, opts = {}) {
    const res = { cells: 0, blocked: 0, snow: 0 };
    this.cellsIn(x, y, rad, (i) => {
      const m = this.mat[i]; if (m === MAT.AIR) return;
      let hard = MAT_INFO[m].hard;
      if (m === MAT.FROZEN && !opts.root) hard = Infinity;
      if (!isFinite(hard)) { res.blocked++; return; }
      this.dmg[i] += power * dt / hard;
      if (this.dmg[i] >= 1) { res.cells++; if (m === MAT.SNOW) res.snow++; this.set(i, MAT.AIR); }
    }, 0);
    return res;
  }
  /* a walking bear packs the snow down: its footsteps are open air */
  breakTrail(x, y, rad) {
    let n = 0;
    this.cellsIn(x, y, rad, (i) => { if (this.mat[i] === MAT.SNOW) { this.set(i, MAT.AIR); n++; } }, 0);
    return n;
  }
  /* how deep (x, y) is below the open air straight above it */
  depthAt(x, y) { return y - this.topAt(x); }

  /* ---------- the seasons ---------- */
  /* lay snow on every surface: depthFn(x) in units (only into open sky cells, never inside a den,
     never on the seabed under open water) */
  laySnow(depthFn) {
    for (let c = 0; c < this.cols; c++) {
      const x = this.cx(c);
      let r0 = -1;
      for (let r = 0; r < this.rows; r++) if (this.mat[r * this.cols + c] !== MAT.AIR) { r0 = r; break; }
      if (r0 < 0 || this.cy(r0) > WORLD.seaY) continue;
      const d = Math.round(depthFn(x) / this.C);
      for (let k = 1; k <= d; k++) { const r = r0 - k; if (r < 0) break; const i = r * this.cols + c; if (this.mat[i] === MAT.AIR && this.sky[i]) this.set(i, MAT.SNOW); }
    }
    this.snowOn = true; this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }
  /* is x over the sea (water above the seabed)? */
  isSea(x) { return this.surfaceAt(x) > WORLD.seaY + 3; }
  /* the sea freezes: a sheet of ice two cells thick at the surface.
     mode 'solid' (winter and spring: breathing holes, a lead, pressure ridges), 'young' (freeze-up: flat new ice
     with breathing holes), 'floes' (early summer: broken into floes with water between) */
  layIce(mode, R = this.rng) {
    const W = WORLD, holeAt = (x) => W.holes.some(h => Math.abs(x - h) < 9);
    const floes = mode === 'floes' ? this.floeMap() : null;
    for (let c = 0; c < this.cols; c++) {
      const x = this.cx(c);
      if (x < W.iceL || x > W.iceR || !this.isSea(x) && x > W.shoreX) continue;
      if (holeAt(x) && mode !== 'floes') continue;
      if (mode === 'solid' && x > W.leadL && x < W.leadR) continue;
      if (floes && !floes(x)) continue;
      for (let r = 0; r < this.rows; r++) { const y = this.cy(r); if (y > -6 && y < 6) { const i = r * this.cols + c; if (this.mat[i] === MAT.AIR) this.set(i, MAT.ICE); } }
    }
    if (mode === 'solid') for (const rx of W.ridges) {
      /* a pressure ridge: a heap of tilted blocks */
      const k0 = mulberry32(this.seed + rx);
      for (let k = 0; k < 9; k++) { const bx = rx + (k0() - .5) * 70, by = -10 - k0() * 26; this.blob(bx, by, 8 + k0() * 10, 6 + k0() * 8, MAT.ICE, (m) => m === MAT.AIR); }
      this.blob(rx, -8, 46, 14, MAT.ICE, (m) => m === MAT.AIR);
    }
    this.iceOn = true; this.iceMode = mode; this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }
  /* where the floes are in early summer: wide floes near the shore, smaller ones out to sea, open water between */
  floeMap() {
    const W = WORLD, segs = [];
    let x = W.shoreX + 70, k = 0;
    const R = mulberry32(this.seed + 31);
    while (x < W.iceR) { const w = (k < 3 ? 300 : 220) + R() * 140, gap = 70 + R() * 50; segs.push([x, x + w]); x += w + gap; k++; }
    this.floes = segs;
    return (xx) => segs.some(([a, b]) => xx > a && xx < b);
  }
  clearIce() {
    for (let i = 0; i < this.n; i++) if (this.mat[i] === MAT.ICE) { this.mat[i] = MAT.AIR; this.dmg[i] = 0; }
    /* snow that lay on the ice goes with it (it never hangs over open water) */
    for (let c = 0; c < this.cols; c++) if (this.isSea(this.cx(c))) for (let r = 0; r < this.rows; r++) { const i = r * this.cols + c; if (this.mat[i] === MAT.SNOW) { this.mat[i] = MAT.AIR; this.dmg[i] = 0; } }
    this.snowOn = this.mat.includes(MAT.SNOW);
    this.iceOn = false; this.iceMode = null; this.floes = null; this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }
  meltSnow() {
    for (let i = 0; i < this.n; i++) if (this.mat[i] === MAT.SNOW) { this.mat[i] = MAT.AIR; this.dmg[i] = 0; }
    this.snowOn = false; this.dirtyAll = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }
  /* summer melts the old drift on the den hill (and with it the snow den): it is open air for good */
  meltDrift() {
    /* the part of the old snow den dug into the peat slumps and fills in */
    if (this.den) this.cellsIn(this.den.cx + 30, this.den.cy, 110, (i) => { if (this.mat[i] === MAT.AIR && this.orig[i] !== MAT.AIR && this.orig[i] !== MAT.DRIFT) { this.mat[i] = this.orig[i]; this.dmg[i] = 0; } }, 0);
    for (let i = 0; i < this.n; i++) if (this.orig[i] === MAT.DRIFT) { this.orig[i] = MAT.AIR; this.sky[i] = 1; if (this.mat[i] === MAT.DRIFT || this.mat[i] === MAT.AIR) { this.mat[i] = MAT.AIR; this.dmg[i] = 0; } }
    this.driftGone = true; this.dirtyAll = true; this.backDirty = true; this.version++;
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
  }

  /* run-length encoding of the current materials (every den, footprint, drift and ice floe survives a reload) */
  serialize() {
    const out = []; let cur = this.mat[0], run = 0;
    for (let i = 0; i < this.n; i++) { if (this.mat[i] === cur && run < 65535) run++; else { out.push(cur, run); cur = this.mat[i]; run = 1; } }
    out.push(cur, run);
    return out;
  }
  restore(arr, driftGone) {
    if (!Array.isArray(arr)) return false;
    let i = 0;
    const mat = new Uint8Array(this.n);
    for (let k = 0; k + 1 < arr.length; k += 2) {
      const m = arr[k], run = arr[k + 1];
      if (!(m >= 0 && m < MAT_INFO.length) || !(run > 0) || i + run > this.n) return false;
      mat.fill(m, i, i + run); i += run;
    }
    if (i !== this.n) return false;
    if (driftGone) this.meltDrift();
    this.mat.set(mat); this.dmg.fill(0); this.dirtyAll = true; this.backDirty = true; this.version++;
    this.snowOn = mat.includes(MAT.SNOW); this.iceOn = mat.includes(MAT.ICE);
    this.rebuildTop(0, this.cols - 1); this.topDirty = false;
    return true;
  }
}
