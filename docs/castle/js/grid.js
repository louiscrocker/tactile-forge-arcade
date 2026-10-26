/* ============================================================
   grid.js — the castle's cells: tiles, rooms, paths
   ============================================================
   The castle is a grid of CELL-unit cells, COLS wide and ROWS
   tall, seen side-on as a cutaway (a dollhouse).  Row GROUND and
   everything below it is earth unless it has been dug into a
   moat.  World units are canvas-native: +x right, +y down; cell
   (cx, cy) covers x ∈ [cx·CELL, (cx+1)·CELL), y likewise.

   Rooms are found by flood fill: any pocket of air that cannot
   reach the sky is a room.  Doors, stairs and windows are
   boundaries of the fill (so two rooms joined by a door stay two
   rooms) but people walk through doors and climb stairs.

   Paths for the people are a breadth-first search over standable
   cells: a passable cell with something solid under it, or a
   stair cell.  Stairs let you move up and down.
   ============================================================ */
'use strict';

const CELL = 32, COLS = 72, ROWS = 26, GROUND = 19, MOAT_DEPTH = 3;
const WORLD_W = COLS * CELL, WORLD_H = ROWS * CELL, GROUND_Y = GROUND * CELL;

const T = { AIR: 0, STONE: 1, TOWER: 2, ROOF: 3, CONE: 4, BATTLEMENT: 5, WOOD: 6, DOOR: 7, GATE: 8, WIN_SLIT: 9, WIN_ARCH: 10, WIN_STAINED: 11, STAIR: 12, EARTH: 13, WATER: 14, BRIDGE: 15, DRAWBRIDGE: 16, FLOOR: 17 };
/* name · simple name (Read to Play word) · where it may go */
const TILE_INFO = {
  [T.AIR]:        { key: 'air', name: 'air', word: 'air' },
  [T.STONE]:      { key: 'stone', name: 'Stone block', word: 'stone', where: 'above', solid: true, icon: 'stone' },
  [T.TOWER]:      { key: 'tower', name: 'Tower stone', word: 'tower', where: 'above', solid: true, icon: 'tower' },
  [T.ROOF]:       { key: 'roof', name: 'Tiled roof', word: 'roof', where: 'above', solid: true, icon: 'roof' },
  [T.CONE]:       { key: 'cone', name: 'Tower roof', word: 'spire', where: 'above', solid: true, icon: 'cone' },
  [T.BATTLEMENT]: { key: 'battlement', name: 'Battlements', word: 'wall top', where: 'above', solid: false, passable: true, icon: 'battlement' },
  [T.WOOD]:       { key: 'wood', name: 'Timber beam', word: 'wood', where: 'above', solid: true, icon: 'wood' },
  [T.FLOOR]:      { key: 'floor', name: 'Wooden floor', word: 'floor', where: 'above', solid: true, icon: 'floor' },
  [T.DOOR]:       { key: 'door', name: 'Door', word: 'door', where: 'above', passable: true, icon: 'door' },
  [T.GATE]:       { key: 'gate', name: 'Portcullis gate', word: 'gate', where: 'above', passable: true, icon: 'gate' },
  [T.WIN_SLIT]:   { key: 'slit', name: 'Arrow slit', word: 'slit', where: 'above', solid: true, icon: 'slit' },
  [T.WIN_ARCH]:   { key: 'arch', name: 'Arched window', word: 'window', where: 'above', solid: true, icon: 'arch' },
  [T.WIN_STAINED]:{ key: 'stained', name: 'Stained glass', word: 'glass', where: 'above', solid: true, icon: 'stained' },
  [T.STAIR]:      { key: 'stair', name: 'Stairs', word: 'stairs', where: 'above', passable: true, icon: 'stair' },
  [T.EARTH]:      { key: 'earth', name: 'earth', word: 'earth', solid: true },
  [T.WATER]:      { key: 'water', name: 'Moat water', word: 'moat', where: 'ground', icon: 'moat' },
  [T.BRIDGE]:     { key: 'bridge', name: 'Stone bridge', word: 'bridge', where: 'ground', solid: true, icon: 'bridge' },
  [T.DRAWBRIDGE]: { key: 'drawbridge', name: 'Drawbridge', word: 'drawbridge', where: 'ground', solid: true, icon: 'drawbridge' }
};
const TILE_BY_KEY = {}; for (const k in TILE_INFO) TILE_BY_KEY[TILE_INFO[k].key] = +k;
const SOLID_T = new Set([T.STONE, T.TOWER, T.ROOF, T.CONE, T.WOOD, T.FLOOR, T.WIN_SLIT, T.WIN_ARCH, T.WIN_STAINED, T.EARTH, T.BRIDGE, T.DRAWBRIDGE]);
const PASS_T = new Set([T.AIR, T.DOOR, T.GATE, T.STAIR, T.BATTLEMENT]);
const WALLISH = new Set([T.STONE, T.TOWER, T.WOOD, T.WIN_SLIT, T.WIN_ARCH, T.WIN_STAINED]);
const WINDOWS = new Set([T.WIN_SLIT, T.WIN_ARCH, T.WIN_STAINED]);

class Grid {
  constructor() {
    this.t = new Uint8Array(COLS * ROWS);
    this.version = 1;
    this.bridgeDown = true;
    this._rooms = null; this._roomsV = -1; this.label = new Int16Array(COLS * ROWS);
    this.clear();
  }
  clear() {
    this.t.fill(T.AIR);
    for (let cy = GROUND; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) this.t[cy * COLS + cx] = T.EARTH;
    this.version++;
  }
  idx(cx, cy) { return cy * COLS + cx; }
  inside(cx, cy) { return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS; }
  get(cx, cy) {
    if (cx < 0 || cx >= COLS) return cy >= GROUND ? T.EARTH : T.AIR;
    if (cy < 0) return T.AIR; if (cy >= ROWS) return T.EARTH;
    return this.t[cy * COLS + cx];
  }
  set(cx, cy, tile) {
    if (!this.inside(cx, cy)) return false;
    const i = cy * COLS + cx; if (this.t[i] === tile) return false;
    this.t[i] = tile; this.version++; return true;
  }
  /* a stable pseudo-random variant per cell, for art variety */
  variant(cx, cy) { let h = (cx * 374761393 + cy * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000; }

  solidT(t) { return t === T.DRAWBRIDGE ? this.bridgeDown : SOLID_T.has(t); }
  solid(cx, cy) { return this.solidT(this.get(cx, cy)); }
  passable(cx, cy) { return PASS_T.has(this.get(cx, cy)); }
  standable(cx, cy) {
    const t = this.get(cx, cy);
    if (t === T.STAIR) return true;
    if (!PASS_T.has(t)) return false;
    const b = this.get(cx, cy + 1);
    return this.solidT(b) || b === T.STAIR;
  }
  /* may this tile be placed here? (the rules a child meets as green/red ghosts) */
  canPlace(cx, cy, tile) {
    if (!this.inside(cx, cy) || cy < 1) return false;
    const info = TILE_INFO[tile]; if (!info || !info.where) return false;
    const cur = this.get(cx, cy);
    if (info.where === 'above') {
      if (cy >= GROUND) return false;
      if (tile === T.STAIR && cur !== T.AIR && !SOLID_T.has(cur)) return false;
      return true;
    }
    /* ground tiles: the moat is dug into the earth; bridges sit in a dug cell at ground level */
    if (tile === T.WATER) return cy >= GROUND && cy < GROUND + MOAT_DEPTH && (cur === T.EARTH || cur === T.BRIDGE || cur === T.DRAWBRIDGE);
    if (tile === T.BRIDGE || tile === T.DRAWBRIDGE) return cy === GROUND && (cur === T.WATER || cur === T.EARTH || cur === T.BRIDGE || cur === T.DRAWBRIDGE);
    return false;
  }
  canErase(cx, cy) {
    if (!this.inside(cx, cy)) return false;
    const cur = this.get(cx, cy);
    if (cur === T.AIR || cur === T.EARTH) return false;
    return true;
  }
  /* erasing puts back what was there before anything was built: air above, earth below */
  erased(cx, cy) { return cy >= GROUND ? T.EARTH : T.AIR; }

  /* ---------- rooms ---------- */
  rooms() {
    if (this._rooms && this._roomsV === this.version) return this._rooms;
    const L = this.label; L.fill(-1);
    const t = this.t, N = COLS * ROWS;
    const fillable = (i) => { const v = t[i]; return v === T.AIR || v === T.BATTLEMENT; };
    const stack = [];
    /* the outside: everything that can reach the sky (row 0) or the sides above ground */
    for (let cx = 0; cx < COLS; cx++) if (fillable(cx)) { L[cx] = 0; stack.push(cx); }
    for (let cy = 1; cy < GROUND; cy++) for (const cx of [0, COLS - 1]) { const i = cy * COLS + cx; if (fillable(i) && L[i] < 0) { L[i] = 0; stack.push(i); } }
    const flood = (lab) => {
      while (stack.length) {
        const i = stack.pop(), cx = i % COLS, cy = (i - cx) / COLS;
        const nb = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
        for (const [nx, ny] of nb) { if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue; const j = ny * COLS + nx; if (L[j] < 0 && fillable(j)) { L[j] = lab; stack.push(j); } }
      }
    };
    flood(0);
    const rooms = [];
    for (let i = 0; i < N; i++) {
      if (L[i] >= 0 || !fillable(i) || t[i] !== T.AIR) continue;
      const id = rooms.length + 1; L[i] = id; stack.push(i);
      const cells = [];
      while (stack.length) {
        const k = stack.pop(); cells.push(k);
        const cx = k % COLS, cy = (k - cx) / COLS;
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) { if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue; const j = ny * COLS + nx; if (L[j] < 0 && t[j] === T.AIR) { L[j] = id; stack.push(j); } }
      }
      let x0 = COLS, y0 = ROWS, x1 = -1, y1 = -1;
      for (const k of cells) { const cx = k % COLS, cy = (k - cx) / COLS; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy; }
      cells.sort((a, b) => a - b);
      const floor = cells.filter(k => { const cx = k % COLS, cy = (k - cx) / COLS; return this.solid(cx, cy + 1) || this.get(cx, cy + 1) === T.STAIR; });
      const tiny = (x1 - x0 + 1) < 2 || (y1 - y0 + 1) < 2 || cells.length < 4;
      rooms.push({ id, anchor: cells[0], cells, floor, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, tiny, type: 'empty', name: '', ground: y1 === GROUND - 1 });
    }
    this._rooms = rooms; this._roomsV = this.version;
    return rooms;
  }
  roomAt(cx, cy) { if (!this.inside(cx, cy)) return null; const rooms = this.rooms(); const id = this.label[cy * COLS + cx]; return id > 0 ? rooms[id - 1] : null; }
  /* is this cell under a roof (inside a room)? 0 outside, room id inside */
  roomId(cx, cy) { if (!this.inside(cx, cy)) return 0; this.rooms(); const id = this.label[cy * COLS + cx]; return id > 0 ? id : 0; }
  /* is the cell exposed to the sky straight up (for rain, snow and pigeons)? */
  skyAbove(cx, cy) { for (let y = cy - 1; y >= 0; y--) if (this.solid(cx, y) || this.get(cx, y) === T.CONE) return false; return true; }
  /* the topmost built cell in a column, or GROUND if nothing is built */
  topOf(cx) { for (let cy = 0; cy < GROUND; cy++) { const t = this.get(cx, cy); if (t !== T.AIR) return cy; } return GROUND; }
  /* how tall the tallest tower is (cells above the ground) */
  tallest() { let best = 0, col = -1; for (let cx = 0; cx < COLS; cx++) { const h = GROUND - this.topOf(cx); if (h > best) { best = h; col = cx; } } return { h: best, cx: col }; }
  /* the built part of the castle: leftmost and rightmost columns with anything above ground */
  bounds() { let l = COLS, r = -1; for (let cx = 0; cx < COLS; cx++) if (this.topOf(cx) < GROUND) { if (cx < l) l = cx; if (cx > r) r = cx; } return r < 0 ? null : { l, r }; }
  count(tile) { let n = 0; for (let i = 0; i < this.t.length; i++) if (this.t[i] === tile) n++; return n; }
  /* water cells on both sides of the castle: the moat goes "all the way round" (in a cutaway) */
  moatAround() { const b = this.bounds(); if (!b) return false; let left = false, right = false; for (let cx = 0; cx < b.l; cx++) if (this.get(cx, GROUND) === T.WATER) left = true; for (let cx = b.r + 1; cx < COLS; cx++) if (this.get(cx, GROUND) === T.WATER) right = true; return left && right; }
  waterAt(cx) { return this.get(cx, GROUND) === T.WATER; }
  /* battlement walkways: battlement cells with something solid underneath */
  walkways() { const out = []; for (let cy = 1; cy < GROUND; cy++) for (let cx = 0; cx < COLS; cx++) if (this.get(cx, cy) === T.BATTLEMENT && this.solid(cx, cy + 1)) out.push([cx, cy]); return out; }

  /* ---------- paths ---------- */
  neighbours(cx, cy, out) {
    out.length = 0;
    const here = this.get(cx, cy);
    if (this.standable(cx - 1, cy)) out.push([cx - 1, cy]);
    if (this.standable(cx + 1, cy)) out.push([cx + 1, cy]);
    if (here === T.STAIR) { if (this.get(cx, cy - 1) === T.STAIR || this.standable(cx, cy - 1)) out.push([cx, cy - 1]); if (this.get(cx, cy + 1) === T.STAIR || this.standable(cx, cy + 1)) out.push([cx, cy + 1]); }
    else if (this.get(cx, cy + 1) === T.STAIR) out.push([cx, cy + 1]);
    /* a step of one cell up or down onto the next standable cell, like a kerb */
    if (!this.standable(cx - 1, cy) && this.standable(cx - 1, cy - 1) && this.passable(cx, cy - 1)) out.push([cx - 1, cy - 1]);
    if (!this.standable(cx + 1, cy) && this.standable(cx + 1, cy - 1) && this.passable(cx, cy - 1)) out.push([cx + 1, cy - 1]);
    if (!this.standable(cx - 1, cy) && this.standable(cx - 1, cy + 1) && this.passable(cx - 1, cy)) out.push([cx - 1, cy + 1]);
    if (!this.standable(cx + 1, cy) && this.standable(cx + 1, cy + 1) && this.passable(cx + 1, cy)) out.push([cx + 1, cy + 1]);
    return out;
  }
  /* breadth-first: a list of [cx, cy] from start (excluded) to goal (included), or null */
  path(sx, sy, gx, gy, limit = 4000) {
    if (sx === gx && sy === gy) return [];
    if (!this.inside(gx, gy) || !this.standable(gx, gy)) return null;
    const prev = new Int32Array(COLS * ROWS).fill(-1), start = sy * COLS + sx, goal = gy * COLS + gx;
    prev[start] = start;
    const q = [start]; let qi = 0; const nb = [];
    while (qi < q.length && qi < limit) {
      const i = q[qi++], cx = i % COLS, cy = (i - cx) / COLS;
      if (i === goal) break;
      this.neighbours(cx, cy, nb);
      for (const [nx, ny] of nb) { if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue; const j = ny * COLS + nx; if (prev[j] < 0) { prev[j] = i; q.push(j); } }
    }
    if (prev[goal] < 0) return null;
    const out = []; let i = goal;
    while (i !== start) { out.push([i % COLS, (i - i % COLS) / COLS]); i = prev[i]; }
    return out.reverse();
  }
  /* every standable cell reachable from here (for "nobody can get in" hints and wandering) */
  reach(sx, sy, limit = 4000) {
    const seen = new Uint8Array(COLS * ROWS), q = [sy * COLS + sx]; seen[q[0]] = 1; let qi = 0; const nb = [], out = [];
    while (qi < q.length && qi < limit) { const i = q[qi++], cx = i % COLS, cy = (i - cx) / COLS; out.push(i); this.neighbours(cx, cy, nb); for (const [nx, ny] of nb) { if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue; const j = ny * COLS + nx; if (!seen[j]) { seen[j] = 1; q.push(j); } } }
    return out;
  }
  /* the nearest standable cell to a point, searching outwards */
  nearestStandable(cx, cy, r = 6) {
    for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue; const x = cx + dx, y = cy + dy; if (this.inside(x, y) && this.standable(x, y)) return [x, y]; }
    return null;
  }

  /* ---------- save ---------- */
  serialize() { const out = []; let cur = this.t[0], n = 0; for (let i = 0; i < this.t.length; i++) { if (this.t[i] === cur) n++; else { out.push(cur + ':' + n); cur = this.t[i]; n = 1; } } out.push(cur + ':' + n); return out.join(','); }
  restore(s) {
    if (typeof s !== 'string') return false;
    const t = new Uint8Array(COLS * ROWS); let i = 0;
    for (const run of s.split(',')) { const m = /^(\d+):(\d+)$/.exec(run); if (!m) return false; const v = +m[1], n = +m[2]; if (!(v in TILE_INFO) || i + n > t.length) return false; t.fill(v, i, i + n); i += n; }
    if (i !== t.length) return false;
    /* sanity: nothing above ground may be earth or water; nothing below may be a wall */
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) { const v = t[cy * COLS + cx]; if (cy < GROUND && (v === T.EARTH || v === T.WATER || v === T.BRIDGE || v === T.DRAWBRIDGE)) return false; if (cy >= GROUND && !(v === T.EARTH || v === T.WATER || ((v === T.BRIDGE || v === T.DRAWBRIDGE) && cy === GROUND))) return false; }
    this.t = t; this.version++; return true;
  }
}
