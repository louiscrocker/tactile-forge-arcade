/* ============================================================
   vegetation.js — the county's trees
   ============================================================
   Tens of thousands of trees drawn in one instanced call. The
   damageable trees around town stay ordinary Props; these are
   the wider landscape, and they exist to make forty kilometres
   of country look inhabited rather than bare.

   Instances are bucketed into a coarse spatial grid at build
   time so that they are CONTIGUOUS in the buffer by location.
   That is what makes flattening a swathe of them affordable:
   knocking down everything the tornado passes over becomes a
   handful of bufferSubData calls over small ranges, instead of
   re-uploading megabytes every frame.
   ============================================================ */
'use strict';

const Vegetation = {
  CELL: 600,            // spatial bucket size, metres
  STRIDE: 8,            // floats per instance

  count: 0,
  data: null,           // x, y, z, scale | yaw, tint, fallen, kind
  buckets: null,        // key -> { start, count }
  dirtyLo: 0, dirtyHi: -1,

  /*
     Trees on the plains are not sprinkled evenly — spread thirty thousand
     over sixteen hundred square kilometres and you get one tree every fifty
     thousand square metres, which reads as bare ground. They grow where
     people put them or water runs: windbreak rows along field boundaries,
     clumps around farmsteads, and a ribbon following the creek.

     So the scatter is structured, not random, and concentrated within the
     distance you can actually see.
  */
  build(target, roads) {
    const rng = mulberry32(90210);
    const clump = makeNoise2D(4242);
    const belt = makeNoise2D(1717);
    const REACH = 14000;              // beyond this nothing is legible anyway
    const FIELD = 420;                // field grid the windbreaks follow

    const pts = [];
    const room = () => pts.length < target * 2;

    const blocked = (x, z) => {
      if (Math.hypot(x, z) < 900) return true;          // town handled by props
      if (Terrain.slopeAt(x, z) > 0.16) return true;
      for (let r = 0; r < roads.length; r++) {
        const rd = roads[r];
        const hw = rd.w * 0.5 + 20, hl = rd.len * 0.5;
        if (rd.dir === 'z') {
          if (Math.abs(x - rd.x) < hw && Math.abs(z - rd.z) < hl) return true;
        } else {
          if (Math.abs(z - rd.z) < hw && Math.abs(x - rd.x) < hl) return true;
        }
      }
      return false;
    };

    /* 1. Windbreak rows along field boundaries — the characteristic look of
          farmland, and what makes the grid read from the air. */
    const lines = Math.floor(REACH * 2 / FIELD);
    for (let gi = -lines; gi <= lines && room(); gi++) {
      for (let gj = -lines; gj <= lines && room(); gj++) {
        if (rng() > 0.16) continue;
        const horiz = rng() < 0.5;
        const ax = gi * FIELD, az = gj * FIELD;
        if (Math.hypot(ax, az) > REACH) continue;
        const n = 22 + (rng() * 16) | 0;
        for (let k = 0; k < n && room(); k++) {
          const t = k / n;
          const x = horiz ? ax + t * FIELD : ax + (rng() - 0.5) * 7;
          const z = horiz ? az + (rng() - 0.5) * 7 : az + t * FIELD;
          if (blocked(x, z)) continue;
          pts.push(x, z);
        }
      }
    }

    /* 2. Woodlots and creek-side timber. */
    const tries = target * 5;
    for (let i = 0; i < tries && room(); i++) {
      const x = (rng() - 0.5) * REACH * 2;
      const z = (rng() - 0.5) * REACH * 2;
      if (blocked(x, z)) continue;

      // Hard threshold, not a gentle ramp: this is what makes clumps rather
      // than an even wash across the whole county.
      let d = smoothstep(0.56, 0.78, clump(x / 1500, z / 1500));
      const creek = (belt(x / 5200, 0.5) - 0.5) * 9000 - 3000;
      const along = z - creek;
      d = Math.max(d, Math.exp(-(along * along) / (2 * 320 * 320)) * 0.9);
      d *= 1 - smoothstep(REACH * 0.65, REACH, Math.hypot(x, z));
      if (rng() > d) continue;
      pts.push(x, z);
    }

    /* Bucket by cell so neighbours are adjacent in the buffer. */
    const CELL = this.CELL;
    const map = new Map();
    for (let i = 0; i < pts.length; i += 2) {
      const key = ((pts[i] / CELL) | 0) * 100000 + ((pts[i + 1] / CELL) | 0);
      let b = map.get(key);
      if (!b) { b = []; map.set(key, b); }
      b.push(pts[i], pts[i + 1]);
    }

    const n = pts.length / 2;
    const data = new Float32Array(n * this.STRIDE);
    const buckets = new Map();
    let k = 0, idx = 0;
    for (const [key, arr] of map) {
      buckets.set(key, { start: idx, count: arr.length / 2 });
      for (let i = 0; i < arr.length; i += 2) {
        const x = arr[i], z = arr[i + 1];
        data[k++] = x;
        data[k++] = Terrain.heightAt(x, z);
        data[k++] = z;
        data[k++] = 0.72 + rng() * 0.75;          // scale
        data[k++] = rng() * TAU;                  // yaw
        data[k++] = rng();                        // tint
        data[k++] = 0;                            // fallen
        data[k++] = rng() < 0.22 ? 1 : 0;         // kind: conifer / broadleaf
        idx++;
      }
    }

    this.data = data;
    this.count = n;
    this.buckets = buckets;
    this.dirtyLo = 0; this.dirtyHi = -1;
    return n;
  },

  /*
     Knock down everything inside a radius. Only the buckets the circle
     actually touches are examined, and the dirty range is tracked so the
     renderer can re-upload the smallest possible slice.
  */
  flatten(cx, cz, radius) {
    if (!this.data) return false;
    const CELL = this.CELL, S = this.STRIDE;
    const i0 = ((cx - radius) / CELL) | 0, i1 = ((cx + radius) / CELL) | 0;
    const j0 = ((cz - radius) / CELL) | 0, j1 = ((cz + radius) / CELL) | 0;
    const r2 = radius * radius;
    let hit = false;

    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const b = this.buckets.get(i * 100000 + j);
        if (!b) continue;
        for (let m = 0; m < b.count; m++) {
          const o = (b.start + m) * S;
          if (this.data[o + 6] > 0.5) continue;         // already down
          const dx = this.data[o] - cx, dz = this.data[o + 2] - cz;
          if (dx * dx + dz * dz > r2) continue;
          this.data[o + 6] = 1;
          // Lay it down pointing away from the centre.
          this.data[o + 4] = Math.atan2(dz, dx);
          const at = b.start + m;
          if (!hit) { this.dirtyLo = at; this.dirtyHi = at; hit = true; }
          else { if (at < this.dirtyLo) this.dirtyLo = at; if (at > this.dirtyHi) this.dirtyHi = at; }
        }
      }
    }
    return hit;
  },

  clearDirty() { this.dirtyLo = 0; this.dirtyHi = -1; },

  /* Stand everything back up (used when the storm is reset). */
  reset() {
    if (!this.data) return;
    for (let o = 6; o < this.data.length; o += this.STRIDE) this.data[o] = 0;
    this.dirtyLo = 0;
    this.dirtyHi = this.count - 1;
  }
};
