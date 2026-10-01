/* ============================================================
   terrain.js — the ground itself
   ============================================================
   A precomputed heightmap over the whole county, sampled
   bilinearly. Everything that needs to know where the ground is
   — prop placement, debris touchdown, dust spawning, the damage
   swath, the terrain mesh — reads Terrain.heightAt() so there is
   one definition of "ground level".

   Two deliberate choices:

   · Relief is gentle. Rolling plains, not mountains. Tornado
     Alley is flat for a reason, and gentle relief keeps the
     physics integration honest without special cases.

   · The town sits in a flattened basin. Towns get built on flat
     ground, and it means a hundred buildings don't need to be
     individually fitted to a hillside.
   ============================================================ */
'use strict';

const Terrain = {
  SPAN: 40000,          // metres across the whole county
  N: 1024,              // heightmap resolution (~39 m per sample)
  TOWN_FLAT: 1300,      // fully flat inside this radius
  TOWN_BLEND: 2600,     // blended back to natural relief by here

  h: null,
  ready: false,

  init(seed) {
    const N = this.N, S = this.SPAN;
    this.step = S / (N - 1);
    this.inv = 1 / this.step;
    this.h = new Float32Array(N * N);

    const n1 = makeNoise2D((seed ^ 0x9e37) >>> 0);
    const n2 = makeNoise2D((seed ^ 0x51ed) >>> 0);
    const n3 = makeNoise2D((seed ^ 0xc2b2) >>> 0);
    const ridge = makeNoise2D((seed ^ 0x27d4) >>> 0);

    let lo = 1e9, hi = -1e9;
    for (let j = 0; j < N; j++) {
      const wz = -S / 2 + j * this.step;
      for (let i = 0; i < N; i++) {
        const wx = -S / 2 + i * this.step;

        /* Three octaves of rolling plain. The wavelengths matter more than
           the amplitude: ±80 m spread over six kilometres is a 1.5% grade,
           which is honest for the Great Plains but reads as dead flat. The
           middle octave is deliberately short enough to give visible rolls. */
        let y = (n1(wx / 6200, wz / 6200) - 0.5) * 120;
        y += (n2(wx / 900, wz / 900) - 0.5) * 44;
        y += (n3(wx / 300, wz / 300) - 0.5) * 15;

        // One low ridge running north-east, to give the horizon a shape.
        const along = (wx * 0.7 + wz * 0.7) / 9000;
        const across = (wx * 0.7 - wz * 0.7) / 5200;
        const r = ridge(along, across * 0.35) - 0.5;
        y += Math.exp(-across * across * 2.2) * r * 85;

        // Flatten the basin the town is built in.
        const d = Math.hypot(wx, wz);
        const flat = 1 - smoothstep(this.TOWN_FLAT, this.TOWN_BLEND, d);
        y *= 1 - flat;

        this.h[j * N + i] = y;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
    this.min = lo;
    this.max = hi;
    this.ready = true;
    return this;
  },

  /* Bilinear sample. Called for every prop and every debris touchdown,
     so it avoids allocation and bounds-checks cheaply. */
  heightAt(x, z) {
    if (!this.ready) return 0;
    const N = this.N;
    let fx = (x + this.SPAN / 2) * this.inv;
    let fz = (z + this.SPAN / 2) * this.inv;
    if (fx < 0) fx = 0; else if (fx > N - 1.001) fx = N - 1.001;
    if (fz < 0) fz = 0; else if (fz > N - 1.001) fz = N - 1.001;
    const i = fx | 0, j = fz | 0;
    const tx = fx - i, tz = fz - j;
    const h = this.h, o = j * N + i;
    const a = h[o], b = h[o + 1], c = h[o + N], d = h[o + N + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  },

  /* Surface normal by central difference — used for terrain shading. */
  normalAt(x, z, out) {
    const e = this.step;
    const hL = this.heightAt(x - e, z), hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e), hU = this.heightAt(x, z + e);
    let nx = hL - hR, ny = 2 * e, nz = hD - hU;
    const len = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / len; out[1] = ny / len; out[2] = nz / len;
    return out;
  },

  /* Steepness 0..1, for scattering vegetation off the steep faces. */
  slopeAt(x, z) {
    this.normalAt(x, z, _tn);
    return 1 - _tn[1];
  }
};

const _tn = [0, 1, 0];
