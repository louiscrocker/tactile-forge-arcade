/* ============================================================
   soil.js — the cross-section of the ground, as real stuff
   ============================================================
   The ground is a grid of 6-unit cells, like the sand in an ant
   farm between two sheets of glass.  Each cell is air, topsoil,
   sand, clay, stone, root, water or ant-hill spoil, and they do
   what the real materials do:

     DIGGING   every cell has a hardness; biting at it builds up
               damage (like the tornado game's wind exposure) and
               when it gives way it becomes air.  Stone and roots
               cannot be dug; ants go around them.
     SAND      dry, loose sand falls into any gap and slides off
               to the side until the pile reaches its angle of
               repose.  Ants pack the walls of a new tunnel (most
               grains, not all), so trickles still fall in.  Damp
               sand holds together.
     SPOIL     dirt carried up and dropped outside rolls down into
               a cone: that is the ant hill.
     WATER     rain soaks into the surface; water that finds the
               entrance runs down the tunnels, drains fast through
               sand, slowly through topsoil, and pools on clay.

   Only chunks where something moved last step are simulated, so a
   still nest costs almost nothing.  The walkable mask (air next
   to a wall, floor or ceiling) and BFS distance fields are what
   the colony's ants follow to get around.
   ============================================================ */
'use strict';

const MAT = { AIR: 0, LOAM: 1, SAND: 2, CLAY: 3, ROCK: 4, ROOT: 5, WATER: 6, MOUND: 7 };
const MAT_INFO = [
  { key: 'air', name: 'Air' },
  { key: 'loam', name: 'Topsoil', hard: 1.0, falls: false, soak: .5, col: [96, 64, 40], col2: [128, 88, 56] },
  { key: 'sand', name: 'Sand', hard: .45, falls: true, soak: 1, col: [206, 170, 112], col2: [232, 202, 146] },
  { key: 'clay', name: 'Clay', hard: 2.6, falls: false, soak: .015, col: [150, 84, 58], col2: [178, 108, 78] },
  { key: 'rock', name: 'Stone', hard: Infinity, falls: false, soak: 0, col: [118, 114, 110], col2: [170, 166, 158] },
  { key: 'root', name: 'Root', hard: Infinity, falls: false, soak: .3, col: [150, 108, 66], col2: [196, 152, 100] },
  { key: 'water', name: 'Water' },
  { key: 'mound', name: 'Ant hill', hard: .35, falls: true, soak: .8, col: [128, 90, 58], col2: [162, 120, 80] }
];
const isSolidMat = (m) => m !== MAT.AIR && m !== MAT.WATER;

const SOIL_C = 6, SOIL_X0 = -1500, SOIL_Y0 = -150, SOIL_COLS = 500, SOIL_ROWS = 275;
const SOIL_CH = 16;                          // chunk size in cells
const FIELD_FAR = 65535;

class Soil {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.C = SOIL_C; this.X0 = SOIL_X0; this.Y0 = SOIL_Y0;
    this.cols = SOIL_COLS; this.rows = SOIL_ROWS;
    const n = this.n = this.cols * this.rows;
    this.X1 = this.X0 + this.cols * this.C; this.Y1 = this.Y0 + this.rows * this.C;
    this.mat = new Uint8Array(n);
    this.tex = new Uint8Array(n);
    this.dmg = new Float32Array(n);
    this.wet = new Float32Array(n);
    this.packed = new Uint8Array(n);
    this.walk = new Uint8Array(n);
    this.mv = new Uint32Array(n);             // step stamp: a grain moves once per step
    this.top = new Int16Array(this.cols);     // first solid row per column
    this.surf0 = new Float32Array(this.cols); // the original ground line (world y)
    this.surfRow0 = new Int16Array(this.cols);
    this.ccols = Math.ceil(this.cols / SOIL_CH); this.crows = Math.ceil(this.rows / SOIL_CH);
    this.active = new Uint8Array(this.ccols * this.crows);
    this.recolor = new Uint8Array(this.ccols * this.crows);   // wetness changed: repaint lazily
    this.paint = new Uint8Array(this.ccols * this.crows);     // soil changed: repaint now
    this.stepId = 1; this.acc = 0;
    this.version = 0;                         // bumps whenever the walkable shape changes
    this.dirtyAll = false;                    // the renderer must repaint everything
    this.walkDirty = null;
    this.waterCount = 0;
    this.nestAir = 0;                         // open cells below the original ground line
    this.plants = opts.plants || [];          // x positions of plant stems (flat ground, roots)
    this.clearAt = opts.clearAt || [];        // x positions kept free of stones (the queen's landing)
    this.queue = new Int32Array(n);
    this.generate();
  }

  /* ---------- indexing ---------- */
  col(x) { return Math.floor((x - this.X0) / this.C); }
  row(y) { return Math.floor((y - this.Y0) / this.C); }
  cx(c) { return this.X0 + (c + .5) * this.C; }
  cy(r) { return this.Y0 + (r + .5) * this.C; }
  idx(c, r) { return r * this.cols + c; }
  inside(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < this.rows; }
  matAt(x, y) {
    const c = this.col(x), r = this.row(y);
    if (r < 0) return MAT.AIR;
    if (r >= this.rows) return MAT.ROCK;
    if (c < 0 || c >= this.cols) return y > 0 ? MAT.LOAM : MAT.AIR;
    return this.mat[r * this.cols + c];
  }
  solidAt(x, y) { return isSolidMat(this.matAt(x, y)); }
  surfaceAt(x) { const c = clamp(this.col(x), 0, this.cols - 1); return this.Y0 + this.top[c] * this.C; }
  ground0(x) { const c = clamp(this.col(x), 0, this.cols - 1); return this.surf0[c]; }
  depthAt(x, y) { return y - this.ground0(x); }

  /* ---------- building the ground ---------- */
  generate() {
    const R = mulberry32(this.seed ^ 0x51a7), n1 = makeNoise1D(this.seed + 11), n2 = makeNoise2D(this.seed + 23), n3 = makeNoise2D(this.seed + 37);
    const { cols, rows, C, X0, Y0, mat, tex } = this;
    /* rotated, two-octave noise: no square blobs */
    const nz = (n, x, y) => { const rx = x * .8 - y * .6, ry = x * .6 + y * .8; return n(rx, ry) * .65 + n(rx * 2.3 + 17, ry * 2.3 + 5) * .35; };
    for (let c = 0; c < cols; c++) {
      const x = X0 + (c + .5) * C;
      let s = (n1(x * .004) - .5) * 30 + (n1(x * .013 + 50) - .5) * 10;
      for (const px of this.plants.concat(this.clearAt)) s *= smoothstep(30, 170, Math.abs(x - px));
      this.surf0[c] = s;
      this.surfRow0[c] = Math.max(0, Math.floor((s - Y0) / C));
      /* layers: topsoil, a band of sand, subsoil, a band of clay, then deep mixed earth */
      const loamB = 175 + (n1(x * .006 + 10) - .5) * 80;
      const sandB = loamB + 140 + (n1(x * .005 + 30) - .5) * 110;
      const clayT = sandB + 260 + (n1(x * .004 + 70) - .5) * 160;
      const clayB = clayT + 300 + (n1(x * .004 + 90) - .5) * 180;
      for (let r = 0; r < rows; r++) {
        const y = Y0 + (r + .5) * C, i = r * cols + c;
        tex[i] = (R() * 255) | 0;
        if (y < s) { mat[i] = MAT.AIR; continue; }
        const depth = y - s;
        let m = MAT.LOAM;
        if (depth > loamB && depth < sandB) m = nz(n2, x * .016, y * .016) < .3 ? MAT.LOAM : MAT.SAND;
        else if (depth >= clayT && depth < clayB) m = nz(n3, x * .018 + 9, y * .018) > .7 ? MAT.SAND : MAT.CLAY;
        else if (depth >= clayB) { const k = nz(n3, x * .011 + 40, y * .011); m = k > .64 ? MAT.CLAY : k < .34 ? MAT.SAND : MAT.LOAM; }
        mat[i] = m;
      }
    }
    /* stones: lumpy round pebbles, rare near the top, bigger and commoner deep down */
    for (let k = 0; k < 130; k++) {
      const d = Math.pow(R(), .7), px = lerp(X0 + 20, this.X1 - 20, R());
      const py = this.surf0[this.col(px)] + 40 + d * 1350, rad = 5 + d * 22 + R() * 8;
      const sq = .6 + R() * .5, rot = R() * TAU, ph = R() * TAU, lump = .12 + R() * .12;
      for (let r = Math.max(0, this.row(py - rad * 1.3)); r <= Math.min(rows - 1, this.row(py + rad * 1.3)); r++)
        for (let c = Math.max(0, this.col(px - rad * 1.3)); c <= Math.min(cols - 1, this.col(px + rad * 1.3)); c++) {
          const dx = this.cx(c) - px, dy = this.cy(r) - py;
          const u = dx * Math.cos(rot) + dy * Math.sin(rot), v = (-dx * Math.sin(rot) + dy * Math.cos(rot)) / sq;
          const a = Math.atan2(v, u), rr2 = rad * (1 + lump * Math.sin(3 * a + ph) + lump * .5 * Math.sin(5 * a + ph * 2));
          if (u * u + v * v < rr2 * rr2 && this.cy(r) > this.surf0[c] + 20) mat[r * cols + c] = MAT.ROCK;
        }
    }
    /* the queen's landing site and the plant stems are kept free of stones */
    for (const px of this.clearAt) this._replaceIn(px - 70, this.surf0[this.col(px)], px + 70, 330, MAT.ROCK, MAT.LOAM);
    /* roots under each plant */
    for (const px of this.plants) this._roots(px, R);
    /* a couple of old worm burrows */
    for (let k = 0; k < 3; k++) this._burrow(lerp(X0 + 200, this.X1 - 200, R()), 60 + R() * 120, R);
    this._recount();
    this.rebuildWalk(0, 0, cols - 1, rows - 1);
    this.dirtyAll = true;
  }
  _replaceIn(x0, y0, x1, y1, from, to) {
    for (let r = Math.max(0, this.row(y0)); r <= Math.min(this.rows - 1, this.row(y1)); r++)
      for (let c = Math.max(0, this.col(x0)); c <= Math.min(this.cols - 1, this.col(x1)); c++) { const i = r * this.cols + c; if (this.mat[i] === from) this.mat[i] = to; }
  }
  _disk(x, y, rad, m, onlySoil) {
    const r0 = this.row(y - rad), r1 = this.row(y + rad), c0 = this.col(x - rad), c1 = this.col(x + rad);
    for (let r = Math.max(0, r0); r <= Math.min(this.rows - 1, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
        if (dist(this.cx(c), this.cy(r), x, y) > rad) continue;
        const i = r * this.cols + c;
        if (onlySoil && !(this.mat[i] === MAT.LOAM || this.mat[i] === MAT.SAND)) continue;
        this.mat[i] = m;
      }
  }
  _roots(px, R) {
    const grow = (x, y, ang, len, w) => {
      const steps = Math.max(4, len / 8 | 0);
      for (let s = 0; s < steps; s++) {
        ang += (R() - .5) * .35; ang = clamp(ang, .35, Math.PI - .35);
        x += Math.cos(ang) * 8; y += Math.sin(ang) * 8;
        const ww = lerp(w, 2.2, s / steps);
        this._disk(x, y, ww, MAT.ROOT, true);
        if (w > 5 && R() < .05) grow(x, y, ang + (R() < .5 ? -1 : 1) * (.5 + R() * .5), len * .5, ww * .7);
      }
    };
    const base = this.ground0(px);
    for (let k = 0; k < 4; k++) grow(px + (R() - .5) * 10, base + 4, Math.PI / 2 + (k - 1.5) * .45, 240 + R() * 160, 9 - k);
  }
  _burrow(x, y, R) {
    let a = R() * TAU;
    for (let s = 0; s < 70; s++) {
      a += (R() - .5) * .6; x += Math.cos(a) * 5; y += Math.sin(a) * 4; y = clamp(y, 40, 260);
      const r0 = this.row(y), c0 = this.col(x);
      for (let r = r0 - 1; r <= r0; r++) for (let c = c0 - 1; c <= c0; c++) if (this.inside(c, r) && this.mat[this.idx(c, r)] === MAT.LOAM && y - this.surf0[c] > 30) this.mat[this.idx(c, r)] = MAT.AIR;
    }
  }
  _recount() {
    this.nestAir = 0; this.waterCount = 0;
    for (let c = 0; c < this.cols; c++) {
      let t = this.rows;
      for (let r = 0; r < this.rows; r++) {
        const m = this.mat[r * this.cols + c];
        if (t === this.rows && isSolidMat(m)) t = r;
        if (!isSolidMat(m) && r > this.surfRow0[c]) this.nestAir++;
        if (m === MAT.WATER) this.waterCount++;
      }
      this.top[c] = t;
    }
  }

  /* ---------- changing cells ---------- */
  set(i, m) {
    const old = this.mat[i];
    if (old === m) return;
    const c = i % this.cols, r = (i / this.cols) | 0;
    this.mat[i] = m;
    if (m !== MAT.WATER) this.dmg[i] = 0;
    if (r > this.surfRow0[c]) this.nestAir += (!isSolidMat(m) ? 1 : 0) - (!isSolidMat(old) ? 1 : 0);
    if (old === MAT.WATER) this.waterCount--;
    if (m === MAT.WATER) this.waterCount++;
    if (isSolidMat(old) !== isSolidMat(m)) {
      /* the first solid row of this column */
      if (isSolidMat(m)) { if (r < this.top[c]) this.top[c] = r; }
      else if (r === this.top[c]) { let t = r; while (t < this.rows && !isSolidMat(this.mat[t * this.cols + c])) t++; this.top[c] = t; }
      this.version++;
      this.walkDirty = this._grow(this.walkDirty, c, r);
    }
    this.touch(c, r, isSolidMat(old) || isSolidMat(m));
  }
  _grow(rect, c, r) {
    if (!rect) return { c0: c, r0: r, c1: c, r1: r };
    if (c < rect.c0) rect.c0 = c; if (c > rect.c1) rect.c1 = c; if (r < rect.r0) rect.r0 = r; if (r > rect.r1) rect.r1 = r;
    return rect;
  }
  /* wake the physics around a cell; paint = its look changed too */
  touch(c, r, paint = true) {
    const kc = (c / SOIL_CH) | 0, kr = (r / SOIL_CH) | 0;
    if (paint) this.paint[kr * this.ccols + kc] = 1;
    for (let y = kr - 1; y <= kr + 1; y++) for (let x = kc - 1; x <= kc + 1; x++) if (x >= 0 && y >= 0 && x < this.ccols && y < this.crows) this.active[y * this.ccols + x] = 1;
  }
  /* bring the walkable map up to date (before any path is worked out) */
  flushWalk() { if (this.walkDirty) { const w = this.walkDirty; this.walkDirty = null; this.rebuildWalk(w.c0 - 2, w.r0 - 2, w.c1 + 2, w.r1 + 2); } }

  /* Bite at the soil around (x, y).  amount is "digging effort"; it is
     divided by each cell's hardness.  Returns how many cells gave way. */
  dig(x, y, rad, amount, pack = .78) {
    const out = { removed: 0, hard: 0, blocked: 0, sand: 0 };
    const r0 = Math.max(0, this.row(y - rad)), r1 = Math.min(this.rows - 1, this.row(y + rad));
    const c0 = Math.max(0, this.col(x - rad)), c1 = Math.min(this.cols - 1, this.col(x + rad));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const d = dist(this.cx(c), this.cy(r), x, y);
      if (d > rad) continue;
      const i = r * this.cols + c, m = this.mat[i];
      if (!isSolidMat(m)) continue;
      const h = MAT_INFO[m].hard;
      if (!isFinite(h)) { out.blocked++; continue; }
      out.hard = Math.max(out.hard, h);
      this.dmg[i] += amount * (1 - d / rad * .5) / h;
      if (this.dmg[i] >= 1) { if (m === MAT.SAND) out.sand++; this.set(i, MAT.AIR); out.removed++; }
      else this.touch(c, r);
    }
    if (out.removed && pack > 0) this.packRing(x, y, rad, rad + this.C * 2, pack);
    return out;
  }
  /* ants press the loose grains around a fresh tunnel with their heads (and spit) */
  packRing(x, y, rIn, rOut, p) {
    const r0 = Math.max(0, this.row(y - rOut)), r1 = Math.min(this.rows - 1, this.row(y + rOut));
    const c0 = Math.max(0, this.col(x - rOut)), c1 = Math.min(this.cols - 1, this.col(x + rOut));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * this.cols + c;
      if (this.mat[i] !== MAT.SAND || this.packed[i]) continue;
      const d = dist(this.cx(c), this.cy(r), x, y);
      if (d > rIn - 2 && d <= rOut && Math.random() < p) { this.packed[i] = 1; this.touch(c, r); }
    }
  }
  /* open a round room instantly (the queen smoothing her chamber, debug jumps) */
  carve(x, y, rx, ry, pack = 1) {
    const r0 = Math.max(0, this.row(y - ry)), r1 = Math.min(this.rows - 1, this.row(y + ry));
    const c0 = Math.max(0, this.col(x - rx)), c1 = Math.min(this.cols - 1, this.col(x + rx));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const dx = (this.cx(c) - x) / rx, dy = (this.cy(r) - y) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const i = r * this.cols + c;
      if (isSolidMat(this.mat[i]) && isFinite(MAT_INFO[this.mat[i]].hard)) this.set(i, MAT.AIR);
    }
    this.packRing(x, y, Math.min(rx, ry), Math.max(rx, ry) + this.C * 2, pack);
  }
  /* a round room is "open" when most of it is air */
  openness(x, y, rx, ry) {
    let air = 0, all = 0;
    for (let yy = -ry; yy <= ry; yy += this.C) for (let xx = -rx; xx <= rx; xx += this.C) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
      all++; const m = this.matAt(x + xx, y + yy); if (!isSolidMat(m) || !isFinite(MAT_INFO[m].hard)) air++;
    }
    return all ? air / all : 1;
  }
  /* spoil dropped outside: grains appear on top of the ground and roll into a cone */
  addMound(x, count) {
    let placed = 0;
    const c0 = this.col(x);
    for (let k = 0; k < count * 3 && placed < count; k++) {
      /* each grain lands on the lowest of the nearby columns, so even a big load
         spreads into a cone instead of a pillar; then the physics rolls it */
      let c = -1;
      for (let d = 0; d <= 6; d++) for (const s of d ? [-1, 1] : [1]) {
        const cc = c0 + s * d;
        if (cc < 0 || cc >= this.cols || this.top[cc] > this.surfRow0[cc] + 2) continue;   /* never into a hole */
        if (c < 0 || this.top[cc] > this.top[c] + d * .5 + Math.random()) c = cc;
      }
      if (c < 0) break;
      const r = this.top[c] - 1;
      if (r < 1) continue;
      const i = r * this.cols + c;
      if (this.mat[i] !== MAT.AIR) continue;
      this.set(i, MAT.MOUND); this.tex[i] = (Math.random() * 255) | 0; placed++;
    }
    return placed;
  }
  addWater(x, y) {
    const c = this.col(x), r = this.row(y);
    if (!this.inside(c, r)) return false;
    const i = r * this.cols + c;
    if (this.mat[i] !== MAT.AIR) return false;
    this.set(i, MAT.WATER); return true;
  }

  /* Rain on the ground.  Most soaks straight into the surface; some runs
     off as water cells that find their way down the entrance. */
  rain(dt, amount, runoff) {
    const drops = amount * dt * 90;
    let k = Math.floor(drops); if (Math.random() < drops - k) k++;
    for (let d = 0; d < k; d++) {
      const c = (Math.random() * this.cols) | 0, t = this.top[c];
      if (t >= this.rows || t < 2) continue;
      const ti = t * this.cols + c;
      if (Math.random() < runoff && this.waterCount < 2600) { this.set(ti - this.cols, MAT.WATER); }
      else if (this.mat[ti] !== MAT.ROCK) { this.wet[ti] = Math.min(1, this.wet[ti] + .2); this.recolor[((t / SOIL_CH) | 0) * this.ccols + ((c / SOIL_CH) | 0)] = 1; }
    }
  }

  /* ---------- the physics step ---------- */
  update(dt) {
    this.acc = Math.min(this.acc + dt, .2);
    let steps = 0;
    while (this.acc >= 1 / 30 && steps < 3) { this.acc -= 1 / 30; this.step(); steps++; }
    this.wetClock = (this.wetClock || 0) - dt;
    if (this.wetClock <= 0) { this.wetClock = .5; this.dryOut(); }
    this.flushWalk();
  }
  step() {
    const { cols, rows, mat, mv, packed, wet } = this;
    const id = ++this.stepId;
    const act = this.active.slice(); this.active.fill(0);
    const flip = id & 1;
    for (let kr = this.crows - 1; kr >= 0; kr--) {
      for (let kk = 0; kk < this.ccols; kk++) {
        const kc = flip ? this.ccols - 1 - kk : kk;
        if (!act[kr * this.ccols + kc]) continue;
        const cA = kc * SOIL_CH, cB = Math.min(cols, cA + SOIL_CH), rA = kr * SOIL_CH, rB = Math.min(rows, rA + SOIL_CH);
        for (let r = rB - 1; r >= rA; r--) {
          for (let q = 0; q < cB - cA; q++) {
            const c = flip ? cB - 1 - q : cA + q, i = r * cols + c, m = mat[i];
            if (mv[i] === id) continue;
            if (m === MAT.SAND || m === MAT.MOUND) {
              if (m === MAT.SAND && (packed[i] || wet[i] > .35)) continue;
              if (r + 1 >= rows) continue;
              /* ant-hill spoil stays on top: the ants' rim keeps it out of the entrance */
              if (m === MAT.MOUND && r + 1 > this.surfRow0[c]) {
                /* a grain over an open hole would plug the door: the ants clear it away */
                const mb = mat[i + cols];
                if (mb === MAT.AIR || mb === MAT.WATER) this.set(i, MAT.AIR);
                continue;
              }
              const b = i + cols, mb = mat[b];
              if (mb === MAT.AIR || mb === MAT.WATER) { this.swap(i, b, id); continue; }
              const dir = Math.random() < .5 ? -1 : 1;
              for (const d of [dir, -dir]) {
                const cc = c + d; if (cc < 0 || cc >= cols) continue;
                const s = i + d, bd = b + d;
                if ((mat[s] === MAT.AIR || mat[s] === MAT.WATER) && (mat[bd] === MAT.AIR || mat[bd] === MAT.WATER)) { this.swap(i, bd, id); break; }
              }
            } else if (m === MAT.WATER) this.flowWater(c, r, i, id);
          }
        }
      }
    }
  }
  swap(i, j, id) {
    const mi = this.mat[i], mj = this.mat[j];
    const ti = this.tex[i]; this.tex[i] = this.tex[j]; this.tex[j] = ti;
    const wi = this.wet[i]; this.wet[i] = this.wet[j]; this.wet[j] = wi;
    this.packed[i] = 0; this.packed[j] = 0;
    this.set(i, mj); this.set(j, mi);            // set() keeps the counts, the top line and the dirty rects right
    this.mv[i] = id; this.mv[j] = id;
  }
  flowWater(c, r, i, id) {
    const { cols, rows, mat } = this;
    /* soak into soil it touches */
    for (const j of [i + cols, i - 1, i + 1]) {
      if (j < 0 || j >= this.n) continue;
      const m = mat[j];
      if (!isSolidMat(m)) continue;
      const soak = MAT_INFO[m].soak || 0;
      if (Math.random() < soak * .05 * (1 - this.wet[j] * .7)) {
        this.wet[j] = Math.min(1, this.wet[j] + .45);
        this.recolor[(((j / cols) | 0) / SOIL_CH | 0) * this.ccols + ((j % cols) / SOIL_CH | 0)] = 1;
        this.set(i, MAT.AIR); return;
      }
    }
    if (Math.random() < .0006) { this.set(i, MAT.AIR); return; }        // evaporates
    if (r + 1 < rows && mat[i + cols] === MAT.AIR) { this.swapWater(i, i + cols, id); return; }
    const dir = Math.random() < .5 ? -1 : 1;
    for (const d of [dir, -dir]) {
      const cc = c + d; if (cc < 0 || cc >= cols) continue;
      if (r + 1 < rows && mat[i + d] === MAT.AIR && mat[i + cols + d] === MAT.AIR) { this.swapWater(i, i + cols + d, id); return; }
    }
    for (const d of [dir, -dir]) {
      const cc = c + d; if (cc < 0 || cc >= cols) continue;
      if (mat[i + d] === MAT.AIR) { this.swapWater(i, i + d, id); return; }
    }
    this.touch(c, r, false);    // still settling: keep this chunk awake so it can soak
  }
  swapWater(i, j, id) {
    this.set(i, MAT.AIR); this.set(j, MAT.WATER);
    this.mv[i] = id; this.mv[j] = id;
  }
  /* wet soil dries slowly and wetness seeps downward */
  dryOut() {
    const { cols, rows, wet } = this;
    let any = false;
    for (let r = rows - 2; r >= 0; r--) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const w = wet[i];
      if (w <= .004) { if (w) wet[i] = 0; continue; }
      any = true;
      const b = i + cols;
      if (isSolidMat(this.mat[b]) && (MAT_INFO[this.mat[b]].soak || 0) > .1 && wet[b] < w) { const f = (w - wet[b]) * .08 * MAT_INFO[this.mat[b]].soak; wet[i] -= f; wet[b] += f; }
      wet[i] *= .985;
      if (w > .35 && wet[i] <= .35 && this.mat[i] === MAT.SAND && !this.packed[i]) this.touch(c, r, false);
      if (((r + c) & 7) === 0) this.recolor[((r / SOIL_CH) | 0) * this.ccols + ((c / SOIL_CH) | 0)] = 1;
    }
    this.anyWet = any;
  }

  /* ---------- walking ---------- */
  /* an ant can stand in air or water that has soil within two cells: floor, wall or ceiling */
  rebuildWalk(c0, r0, c1, r1) {
    const { cols, rows, mat, walk } = this;
    c0 = Math.max(0, c0); r0 = Math.max(0, r0); c1 = Math.min(cols - 1, c1); r1 = Math.min(rows - 1, r1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * cols + c;
      if (isSolidMat(mat[i])) { walk[i] = 0; continue; }
      let near = 0;
      for (let y = Math.max(0, r - 2); y <= Math.min(rows - 1, r + 2) && !near; y++)
        for (let x = Math.max(0, c - 2); x <= Math.min(cols - 1, c + 2); x++) if (isSolidMat(mat[y * cols + x])) { near = 1; break; }
      walk[i] = near;
    }
  }
  walkableAt(x, y) { const c = this.col(x), r = this.row(y); return this.inside(c, r) && this.walk[r * this.cols + c] === 1; }
  nearestWalkable(x, y, maxR = 12) {
    this.flushWalk();
    const c0 = this.col(x), r0 = this.row(y);
    for (let rad = 0; rad <= maxR; rad++) {
      let best = -1, bd = 1e9;
      for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== rad || !this.inside(c, r)) continue;
        const i = r * this.cols + c;
        if (!this.walk[i]) continue;
        const d = (c - c0) * (c - c0) + (r - r0) * (r - r0);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /* Is a circle of radius rad free of soil? */
  free(x, y, rad) {
    if (this.solidAt(x, y)) return false;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (this.solidAt(x + Math.cos(a) * rad, y + Math.sin(a) * rad)) return false; }
    return true;
  }
  /* Which way is the nearest soil?  (nx, ny) points from the ant toward it. */
  contact(x, y, rad) {
    let nx = 0, ny = 0, n = 0;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, ca = Math.cos(a), sa = Math.sin(a);
      for (const f of [.7, 1]) if (this.solidAt(x + ca * rad * f, y + sa * rad * f)) { nx += ca * (f < 1 ? 1.5 : 1); ny += sa * (f < 1 ? 1.5 : 1); n++; }
    }
    const l = Math.hypot(nx, ny);
    return { n, nx: l ? nx / l : 0, ny: l ? ny / l : 1 };
  }

  /* ---------- distance fields for the colony ---------- */
  /* BFS over walkable cells from every source cell; out[i] = steps to the nearest source */
  field(sources, out) {
    this.flushWalk();
    out.fill(FIELD_FAR);
    const q = this.queue, { cols, rows, walk } = this;
    let head = 0, tail = 0;
    for (const s of sources) if (s >= 0 && s < this.n && out[s] !== 0) { out[s] = 0; q[tail++] = s; }
    while (head < tail) {
      const i = q[head++], d = out[i] + 1, c = i % cols;
      /* 4-neighbours then diagonals */
      if (c > 0 && walk[i - 1] && out[i - 1] > d) { out[i - 1] = d; q[tail++] = i - 1; }
      if (c < cols - 1 && walk[i + 1] && out[i + 1] > d) { out[i + 1] = d; q[tail++] = i + 1; }
      if (i >= cols && walk[i - cols] && out[i - cols] > d) { out[i - cols] = d; q[tail++] = i - cols; }
      if (i + cols < this.n && walk[i + cols] && out[i + cols] > d) { out[i + cols] = d; q[tail++] = i + cols; }
      if (i >= cols) {
        if (c > 0 && walk[i - cols - 1] && out[i - cols - 1] > d) { out[i - cols - 1] = d; q[tail++] = i - cols - 1; }
        if (c < cols - 1 && walk[i - cols + 1] && out[i - cols + 1] > d) { out[i - cols + 1] = d; q[tail++] = i - cols + 1; }
      }
      if (i + cols < this.n) {
        if (c > 0 && walk[i + cols - 1] && out[i + cols - 1] > d) { out[i + cols - 1] = d; q[tail++] = i + cols - 1; }
        if (c < cols - 1 && walk[i + cols + 1] && out[i + cols + 1] > d) { out[i + cols + 1] = d; q[tail++] = i + cols + 1; }
      }
    }
    return out;
  }
  /* the neighbour one step closer to the source, or -1 */
  downhill(field, i) {
    const cols = this.cols, c = i % cols;
    let best = -1, bd = field[i];
    const tryN = (j) => { if (j >= 0 && j < this.n && field[j] < bd) { bd = field[j]; best = j; } };
    if (c > 0) { tryN(i - 1); tryN(i - cols - 1); tryN(i + cols - 1); }
    if (c < cols - 1) { tryN(i + 1); tryN(i - cols + 1); tryN(i + cols + 1); }
    tryN(i - cols); tryN(i + cols);
    return best;
  }

  /* ---------- saving ---------- */
  serialize() {
    const runs = []; let cur = this.mat[0], n = 0;
    for (let i = 0; i < this.n; i++) { if (this.mat[i] === cur) n++; else { runs.push(cur, n); cur = this.mat[i]; n = 1; } }
    runs.push(cur, n);
    return runs;
  }
  restore(runs) {
    if (!Array.isArray(runs)) return false;
    let total = 0;
    for (let k = 0; k + 1 < runs.length; k += 2) { const m = runs[k], n = runs[k + 1]; if (!Number.isInteger(m) || m < 0 || m > 7 || !Number.isInteger(n) || n < 0) return false; total += n; }
    if (total !== this.n) return false;
    let i = 0;
    for (let k = 0; k + 1 < runs.length; k += 2) { const m = runs[k] === MAT.WATER ? MAT.AIR : runs[k]; for (let j = 0; j < runs[k + 1] && i < this.n; j++) this.mat[i++] = m; }
    /* sand that was standing when saved was standing for a reason: pack it */
    for (let j = 0; j < this.n; j++) { this.dmg[j] = 0; this.wet[j] = 0; this.packed[j] = this.mat[j] === MAT.SAND ? 1 : 0; }
    this._recount();
    this.rebuildWalk(0, 0, this.cols - 1, this.rows - 1);
    this.dirtyAll = true;
    this.version++;
    return true;
  }
}
