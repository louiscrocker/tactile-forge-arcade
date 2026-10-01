/* ============================================================
   meshes.js — a very small polygon modeller
   ============================================================
   A mesh is:
     v  Float32Array of vertices          [x,y,z, x,y,z, ...]
     f  array of faces { i:[idx...], c:palIdx, t:twoSided }
     n  Float32Array of face normals      [nx,ny,nz, ...]
     r  bounding radius (for culling / level of detail)

   Winding is counter-clockwise seen from outside, so
   cross(v1-v0, v2-v0) points out of the solid. Faces built by
   hand where the winding is fiddly are marked two-sided and are
   simply never culled.
   ============================================================ */
'use strict';

class Mesh {
  constructor() { this.vs = []; this.f = []; this.v = null; this.n = null; this.r = 1; }

  vert(x, y, z) { this.vs.push(x, y, z); return this.vs.length / 3 - 1; }

  face(idx, hex, twoSided) { this.f.push({ i: idx, c: Pal.id(hex), t: !!twoSided }); return this; }

  /* Axis-aligned box. `cols` = [top, side, bottom] (bottom optional). */
  box(cx, cy, cz, hx, hy, hz, cols) {
    const top = cols[0], side = cols[1], bot = cols[2] || cols[1];
    const b = this.vs.length / 3;
    this.vert(cx - hx, cy - hy, cz - hz); // 0
    this.vert(cx + hx, cy - hy, cz - hz); // 1
    this.vert(cx + hx, cy - hy, cz + hz); // 2
    this.vert(cx - hx, cy - hy, cz + hz); // 3
    this.vert(cx - hx, cy + hy, cz - hz); // 4
    this.vert(cx + hx, cy + hy, cz - hz); // 5
    this.vert(cx + hx, cy + hy, cz + hz); // 6
    this.vert(cx - hx, cy + hy, cz + hz); // 7
    this.face([b + 7, b + 6, b + 5, b + 4], top);         // +Y
    this.face([b + 0, b + 1, b + 2, b + 3], bot);         // -Y
    this.face([b + 3, b + 2, b + 6, b + 7], side);        // +Z
    this.face([b + 1, b + 0, b + 4, b + 5], side);        // -Z
    this.face([b + 2, b + 1, b + 5, b + 6], side);        // +X
    this.face([b + 0, b + 3, b + 7, b + 4], side);        // -X
    return this;
  }

  /* Gable roof: eaves rectangle at y0, ridge line along X at y1. */
  gable(cx, y0, cz, hx, hz, y1, colSlope, colEnd) {
    const b = this.vs.length / 3;
    this.vert(cx - hx, y0, cz - hz); // 0 e0
    this.vert(cx + hx, y0, cz - hz); // 1 e1
    this.vert(cx + hx, y0, cz + hz); // 2 e2
    this.vert(cx - hx, y0, cz + hz); // 3 e3
    this.vert(cx - hx, y1, cz);      // 4 r0
    this.vert(cx + hx, y1, cz);      // 5 r1
    this.face([b + 3, b + 2, b + 5, b + 4], colSlope);
    this.face([b + 1, b + 0, b + 4, b + 5], colSlope);
    this.face([b + 2, b + 1, b + 5], colEnd);
    this.face([b + 0, b + 3, b + 4], colEnd);
    return this;
  }

  /* Vertical cylinder, optionally capped. */
  cyl(cx, y0, cz, r, h, sides, colSide, colTop) {
    const base = this.vs.length / 3;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      this.vert(cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r);
    }
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      this.vert(cx + Math.cos(a) * r, y0 + h, cz + Math.sin(a) * r);
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.face([base + j, base + i, base + sides + i, base + sides + j], colSide);
    }
    if (colTop) {
      const c = this.vert(cx, y0 + h, cz);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        this.face([c, base + sides + j, base + sides + i], colTop);
      }
    }
    return this;
  }

  /* Cone with the apex above the base ring — canopies, steeples, silo caps. */
  cone(cx, y0, cz, r, h, sides, hex) {
    const base = this.vs.length / 3;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      this.vert(cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r);
    }
    const apex = this.vert(cx, y0 + h, cz);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.face([base + j, base + i, apex], hex);
    }
    return this;
  }

  /* Flat upright panel facing +Z — signs, billboards, fence boards. */
  panel(cx, cy, cz, hx, hy, hex) {
    const b = this.vs.length / 3;
    this.vert(cx - hx, cy - hy, cz);
    this.vert(cx + hx, cy - hy, cz);
    this.vert(cx + hx, cy + hy, cz);
    this.vert(cx - hx, cy + hy, cz);
    this.face([b, b + 1, b + 2, b + 3], hex, true);
    return this;
  }

  /* Freeze into typed arrays and precompute face normals. */
  build() {
    this.v = new Float32Array(this.vs);
    const nf = this.f.length;
    this.n = new Float32Array(nf * 3);
    let maxR = 0;
    for (let i = 0; i < this.v.length; i += 3) {
      const d = this.v[i] * this.v[i] + this.v[i + 1] * this.v[i + 1] + this.v[i + 2] * this.v[i + 2];
      if (d > maxR) maxR = d;
    }
    this.r = Math.sqrt(maxR);
    for (let k = 0; k < nf; k++) {
      const idx = this.f[k].i, v = this.v;
      const a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
      const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const len = Math.hypot(nx, ny, nz) || 1;
      this.n[k * 3] = nx / len; this.n[k * 3 + 1] = ny / len; this.n[k * 3 + 2] = nz / len;
    }
    this.vs = null;
    return this;
  }
}

/* ------------------------------------------------------------
   Palettes for the town
   ------------------------------------------------------------ */
const C = {
  wall:  ['#e6e2d8', '#d8cfc0', '#c9d2d6', '#e8d9c4', '#cfd8cd', '#e3cfc6', '#d5d9e0', '#efe6d4'],
  roof:  ['#6d5a4e', '#5c5a63', '#7a4a42', '#4f5b5e', '#665441', '#4a4f58'],
  barn:  ['#a03a30', '#8e3229', '#b04a38'],
  door:  ['#4a4038', '#3d4a52', '#5a4436'],
  car:   ['#c9403c', '#2f6fb5', '#e3e6ea', '#3a4048', '#d9a032', '#3f8a63', '#8f5fb0', '#b8bcc2'],
  trunk: '#5b4433',
  leafA: '#3e7a44', leafB: '#4d8c4a', leafC: '#356b3e', leafD: '#5f8f42',
  grass: '#5d8347',
  slab:  '#9a968c',
  rubbleA: '#8a8074', rubbleB: '#6f665c', rubbleC: '#a3937f',
  cowW:  '#f2efe8', cowB:  '#2e2a28', cowP: '#d9a89b',
  road:  '#3f434a', dirt: '#8a7355'
};

/* ------------------------------------------------------------
   Model factory. Every entry returns a freshly built Mesh so
   damage stages can swap geometry without touching the original.
   ------------------------------------------------------------ */
const Models = {

  /* House with a staged-damage parameter:
     0 intact · 1 shingles gone · 2 roof gone · 3 walls failing · 4 slab only */
  house(o) {
    const m = new Mesh();
    const w = o.w, d = o.d, h = o.h, stage = o.stage | 0;
    const wall = o.wall, roof = o.roof;

    if (stage >= 4) {                       // swept to the foundation
      m.box(0, 0.18, 0, w / 2, 0.18, d / 2, [C.slab, '#7d7a72']);
      for (let i = 0; i < 7; i++) {
        const a = rnd(TAU), r = rnd(0.2, 0.62) * Math.max(w, d);
        m.box(Math.cos(a) * r, 0.5, Math.sin(a) * r, rnd(0.4, 1.3), rnd(0.2, 0.6), rnd(0.4, 1.3),
              [pick([C.rubbleA, C.rubbleB, C.rubbleC]), C.rubbleB]);
      }
      return m.build();
    }

    if (stage === 3) {                      // walls down, pile of sticks
      m.box(0, 0.18, 0, w / 2, 0.18, d / 2, [C.slab, '#7d7a72']);
      const hh = h * 0.34;
      m.box(0, hh / 2 + 0.3, 0, w / 2 * 0.86, hh / 2, d / 2 * 0.86, [C.rubbleB, wall]);
      for (let i = 0; i < 12; i++) {
        const a = rnd(TAU), r = rnd(0.15, 0.75) * Math.max(w, d);
        m.box(Math.cos(a) * r, rnd(0.4, 1.9), Math.sin(a) * r,
              rnd(0.25, 1.6), rnd(0.12, 0.4), rnd(0.25, 1.6),
              [pick([C.rubbleA, C.rubbleC, wall]), C.rubbleB]);
      }
      return m.build();
    }

    /* Standing house */
    m.box(0, h / 2, 0, w / 2, h / 2, d / 2, [stage >= 2 ? '#6b6157' : wall, wall]);

    if (stage < 2) {
      const ridge = h + Math.min(w, d) * 0.42;
      const rc = stage === 1 ? '#7d6f60' : roof;
      m.gable(0, h, 0, w / 2 + 0.35, d / 2 + 0.35, ridge, rc, wall);
      if (o.chimney) m.box(w * 0.26, ridge - 0.4, d * 0.18, 0.42, 1.5, 0.42, ['#5e5148', '#8a7264']);
    } else {
      // Roof deck gone — a few surviving rafters over open walls.
      for (let i = -2; i <= 2; i++) {
        m.box(i * (w / 5.5), h + 0.55, 0, 0.13, 0.13, d / 2 + 0.2, ['#8b7a63', '#6f6151']);
      }
    }

    /* Door and windows sit slightly proud of the +Z wall. */
    const fz = d / 2 + 0.06;
    m.box(0, 1.1, fz, 0.52, 1.1, 0.05, [o.door, o.door]);
    if (stage === 0) {
      const wy = h * 0.62;
      m.box(-w * 0.28, wy, fz, 0.46, 0.42, 0.04, ['#8fb3c9', '#8fb3c9']);
      m.box(w * 0.28, wy, fz, 0.46, 0.42, 0.04, ['#8fb3c9', '#8fb3c9']);
    }
    if (o.porch && stage === 0) {
      m.box(0, 0.16, d / 2 + 0.9, w * 0.4, 0.16, 0.9, ['#b5a894', '#9a8d7b']);
      m.box(-w * 0.36, 1.2, d / 2 + 1.7, 0.09, 1.2, 0.09, ['#d8cfc0', '#c3b8a6']);
      m.box(w * 0.36, 1.2, d / 2 + 1.7, 0.09, 1.2, 0.09, ['#d8cfc0', '#c3b8a6']);
    }
    return m.build();
  },

  barn(o) {
    const m = new Mesh();
    const w = o.w, d = o.d, h = o.h;
    const col = pick(C.barn);
    if (o.stage >= 3) return Models.house({ w, d, h, stage: 4, wall: col, roof: col, door: C.door[0] });
    m.box(0, h / 2, 0, w / 2, h / 2, d / 2, ['#f0ece2', col]);
    if (o.stage < 2) {
      m.gable(0, h, 0, w / 2 + 0.3, d / 2 + 0.3, h + d * 0.34, '#6b6b70', col);
      m.gable(0, h + d * 0.10, 0, w / 2 + 0.16, d / 2 * 0.55, h + d * 0.52, '#5f5f65', col);
    }
    m.box(0, 2.2, d / 2 + 0.05, w * 0.22, 2.2, 0.06, ['#e8e2d4', '#e8e2d4']);
    return m.build();
  },

  silo(o) {
    const m = new Mesh();
    if (o.stage >= 1) { m.box(0, 0.4, 0, o.r * 1.4, 0.4, o.r * 1.4, [C.rubbleB, C.rubbleA]); return m.build(); }
    m.cyl(0, 0, 0, o.r, o.h, 12, '#cfc9bd', '#e2ddd2');
    m.cone(0, o.h, 0, o.r * 1.04, o.r * 0.78, 12, '#8e9298');
    for (let i = 1; i < 4; i++) {
      m.cyl(0, o.h * (i / 4), 0, o.r * 1.015, 0.14, 12, '#b0a99c', null);
    }
    return m.build();
  },

  waterTower(o) {
    const m = new Mesh();
    if (o.stage >= 1) { m.box(0, 0.5, 0, 3, 0.5, 3, [C.rubbleB, C.rubbleA]); return m.build(); }
    const legY = o.h * 0.62;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.78;
      const x = Math.cos(a) * o.r * 0.78, z = Math.sin(a) * o.r * 0.78;
      m.box(x * 0.5, legY / 2, z * 0.5, 0.22, legY / 2, 0.22, ['#8d949a', '#79808a']);
    }
    m.box(0, legY * 0.55, 0, o.r * 0.8, 0.1, o.r * 0.8, ['#7c838c', '#6c737c']);
    m.cyl(0, legY, 0, o.r, o.h * 0.34, 12, '#b9c3c9', null);
    m.cone(0, legY + o.h * 0.34, 0, o.r * 1.02, o.r * 0.5, 12, '#9aa4ac');
    m.cone(0, legY, 0, o.r * 1.02, -o.r * 0.42, 12, '#a6b0b8');
    return m.build();
  },

  church(o) {
    const m = new Mesh();
    const w = o.w, d = o.d, h = o.h;
    if (o.stage >= 3) return Models.house({ w, d, h, stage: 4, wall: '#eae6db', roof: '#5c5a63', door: C.door[0] });
    m.box(0, h / 2, 0, w / 2, h / 2, d / 2, ['#eae6db', '#eae6db']);
    if (o.stage < 2) m.gable(0, h, 0, w / 2 + 0.3, d / 2 + 0.3, h + w * 0.46, '#4f5b5e', '#eae6db');
    const tz = d / 2 - 1.4;
    m.box(0, h * 0.78, tz, 1.5, h * 0.78, 1.5, ['#f2eee4', '#f2eee4']);
    if (o.stage < 2) {
      m.cone(0, h * 1.56, tz, 1.9, h * 0.72, 8, '#4f5b5e');
      m.box(0, h * 1.56 + h * 0.72 + 0.7, tz, 0.08, 0.7, 0.08, ['#d9c07a', '#d9c07a']);
      m.box(0, h * 1.56 + h * 0.72 + 0.78, tz, 0.32, 0.08, 0.08, ['#d9c07a', '#d9c07a']);
    }
    m.box(0, 1.3, d / 2 + 0.06, 0.7, 1.3, 0.05, ['#6b4f36', '#6b4f36']);
    return m.build();
  },

  shop(o) {
    const m = new Mesh();
    const w = o.w, d = o.d, h = o.h;
    if (o.stage >= 3) return Models.house({ w, d, h, stage: 4, wall: o.wall, roof: '#4a4f58', door: C.door[0] });
    m.box(0, h / 2, 0, w / 2, h / 2, d / 2, ['#5a5f66', o.wall]);
    if (o.stage < 2) {
      m.box(0, h + 0.9, d / 2 * 0.55, w / 2 + 0.12, 0.9, d / 2 * 0.45, [o.wall, o.wall]);  // false front
      m.box(0, h + 1.5, d / 2 * 0.9, w / 2 * 0.7, 0.32, 0.08, [o.sign, o.sign]);
    }
    m.box(0, 1.5, d / 2 + 0.05, w / 2 * 0.72, 1.4, 0.05, ['#7fa8c4', '#7fa8c4']);
    if (o.awning && o.stage === 0) {
      m.box(0, 3.1, d / 2 + 0.9, w / 2 * 0.86, 0.1, 0.9, [o.sign, o.sign]);
    }
    return m.build();
  },

  tree(o) {
    const m = new Mesh();
    const h = o.h;
    if (o.stage >= 2) {                     // snapped off at the stump
      m.cyl(0, 0, 0, o.r * 0.34, h * 0.22, 6, C.trunk, '#6d543f');
      return m.build();
    }
    m.cyl(0, 0, 0, o.r * 0.3, h * 0.42, 6, C.trunk, null);
    if (o.stage === 1) {                    // stripped of leaves
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        m.box(Math.cos(a) * o.r * 0.5, h * 0.6, Math.sin(a) * o.r * 0.5, 0.09, h * 0.22, 0.09, ['#6d5a45', '#5b4433']);
      }
      return m.build();
    }
    const leaf = o.leaf;
    m.cone(0, h * 0.34, 0, o.r, h * 0.42, 7, leaf);
    m.cone(0, h * 0.56, 0, o.r * 0.82, h * 0.4, 7, leaf);
    m.cone(0, h * 0.78, 0, o.r * 0.55, h * 0.34, 6, leaf);
    return m.build();
  },

  car(o) {
    const m = new Mesh();
    const col = o.col;
    m.box(0, 0.72, 0, 0.92, 0.34, 2.05, [col, col]);                     // body
    m.box(0, 1.22, -0.15, 0.8, 0.32, 1.02, ['#c8d6de', '#7f8b93']);      // greenhouse
    m.box(0, 0.3, 0, 0.86, 0.16, 1.9, ['#2b2f33', '#2b2f33']);           // sills
    for (let i = 0; i < 4; i++) {
      const x = i < 2 ? -0.9 : 0.9, z = (i % 2 ? 1 : -1) * 1.32;
      m.box(x, 0.34, z, 0.1, 0.34, 0.34, ['#1d2124', '#1d2124']);
    }
    m.box(0, 0.78, 2.06, 0.62, 0.14, 0.05, ['#f4e9c8', '#f4e9c8']);      // headlights
    m.box(0, 0.78, -2.06, 0.6, 0.12, 0.05, ['#c2453c', '#c2453c']);      // tail lights
    return m.build();
  },

  pickup(o) {
    const m = new Mesh();
    const col = o.col;
    m.box(0, 0.85, 0.55, 1.0, 0.42, 1.5, [col, col]);
    m.box(0, 1.42, 1.0, 0.86, 0.34, 0.78, ['#c8d6de', '#7f8b93']);
    m.box(0, 0.82, -1.35, 0.98, 0.4, 1.15, [col, col]);
    m.box(0, 1.06, -1.35, 0.82, 0.16, 1.0, ['#3a3f45', '#3a3f45']);
    for (let i = 0; i < 4; i++) {
      const x = i < 2 ? -1.0 : 1.0, z = (i % 2 ? 1.35 : -1.35);
      m.box(x, 0.4, z, 0.12, 0.4, 0.4, ['#1d2124', '#1d2124']);
    }
    return m.build();
  },

  tractor(o) {
    const m = new Mesh();
    m.box(0, 1.05, 0.1, 0.72, 0.45, 1.35, ['#2f7a3e', '#2f7a3e']);
    m.box(0, 1.85, -0.5, 0.6, 0.42, 0.6, ['#c9d6dc', '#3a6b46']);
    m.box(-0.95, 0.85, -1.0, 0.2, 0.85, 0.85, ['#1d2124', '#1d2124']);
    m.box(0.95, 0.85, -1.0, 0.2, 0.85, 0.85, ['#1d2124', '#1d2124']);
    m.box(-0.8, 0.45, 1.15, 0.16, 0.45, 0.45, ['#1d2124', '#1d2124']);
    m.box(0.8, 0.45, 1.15, 0.16, 0.45, 0.45, ['#1d2124', '#1d2124']);
    m.box(0, 2.5, 0.6, 0.1, 0.55, 0.1, ['#4a4a4a', '#4a4a4a']);
    return m.build();
  },

  /* Drawn a touch chunky so a cow still reads at 400 m. */
  cow(o) {
    const m = new Mesh();
    const spotted = o.spotted;
    const body = spotted ? C.cowW : o.hide;
    m.box(0, 1.35, 0, 0.62, 0.52, 1.32, [body, body]);
    if (spotted) {
      m.box(0.2, 1.88, 0.3, 0.34, 0.02, 0.42, [C.cowB, C.cowB]);
      m.box(-0.63, 1.3, -0.25, 0.02, 0.3, 0.44, [C.cowB, C.cowB]);
      m.box(0.63, 1.3, 0.4, 0.02, 0.26, 0.34, [C.cowB, C.cowB]);
    }
    m.box(0, 1.5, 1.5, 0.34, 0.34, 0.36, [body, spotted ? C.cowB : body]);   // head
    m.box(0, 1.28, 1.84, 0.24, 0.18, 0.1, [C.cowP, C.cowP]);                 // muzzle
    m.box(-0.4, 1.72, 1.44, 0.15, 0.05, 0.1, [body, body]);                  // ears
    m.box(0.4, 1.72, 1.44, 0.15, 0.05, 0.1, [body, body]);
    const legs = [[-0.42, 0.95], [0.42, 0.95], [-0.42, -0.9], [0.42, -0.9]];
    for (const [lx, lz] of legs) m.box(lx, 0.42, lz, 0.13, 0.42, 0.13, ['#3b332e', '#3b332e']);
    m.box(0, 1.5, -1.4, 0.06, 0.36, 0.06, [C.cowB, C.cowB]);                 // tail
    return m.build();
  },

  pole(o) {
    const m = new Mesh();
    if (o.stage >= 2) { m.cyl(0, 0, 0, 0.16, 1.1, 5, C.trunk, '#6d543f'); return m.build(); }
    const lean = o.stage === 1 ? 0.16 : 0;
    m.box(lean * o.h * 0.5, o.h / 2, 0, 0.16, o.h / 2, 0.16, ['#6a594a', '#5b4c40']);
    if (o.stage === 0) {
      m.box(lean * o.h, o.h - 0.9, 0, 1.5, 0.1, 0.1, ['#6a594a', '#5b4c40']);
      m.box(lean * o.h, o.h - 1.9, 0, 1.1, 0.09, 0.09, ['#6a594a', '#5b4c40']);
    }
    return m.build();
  },

  sign(o) {
    const m = new Mesh();
    m.box(0, o.h * 0.4, 0, 0.09, o.h * 0.4, 0.09, ['#77808a', '#69727c']);
    m.panel(0, o.h * 0.92, 0, o.w, o.h * 0.2, o.col);
    return m.build();
  },

  /* Homage: the drive-in screen from every good tornado movie. */
  driveIn(o) {
    const m = new Mesh();
    if (o.stage >= 1) { m.box(0, 1, 0, 6, 1, 1.4, [C.rubbleB, C.rubbleA]); return m.build(); }
    m.box(0, o.h / 2, 0, o.w / 2, o.h / 2, 0.32, ['#c8c4bb', '#e8e5dd']);
    m.box(0, o.h + 0.5, 0, o.w / 2 + 0.4, 0.5, 0.5, ['#8c3f36', '#a44b40']);
    for (let i = -1; i <= 1; i += 2) m.box(i * o.w * 0.36, o.h * 0.5, -1.2, 0.25, o.h * 0.5, 0.25, ['#6c737c', '#5c636c']);
    return m.build();
  },

  fence(o) {
    const m = new Mesh();
    m.box(0, 0.55, 0, o.len / 2, 0.05, 0.04, ['#b8ab93', '#a2957f']);
    m.box(0, 0.95, 0, o.len / 2, 0.05, 0.04, ['#b8ab93', '#a2957f']);
    const posts = Math.max(2, Math.round(o.len / 2.4));
    for (let i = 0; i <= posts; i++) {
      m.box(-o.len / 2 + (i / posts) * o.len, 0.6, 0, 0.07, 0.6, 0.07, ['#9a8d76', '#87795f']);
    }
    return m.build();
  },

  /* Wind-borne wreckage: a plank, a shingle sheet, a sheet of siding. */
  plank(o) {
    const m = new Mesh();
    m.box(0, 0, 0, o.hx, o.hy, o.hz, [o.col, o.col2 || o.col]);
    return m.build();
  },

  hayBale(o) {
    const m = new Mesh();
    m.cyl(0, -o.r, 0, o.r, o.r * 2, 8, '#c9ab63', '#d9bd78');
    return m.build();
  },

  mailbox() {
    const m = new Mesh();
    m.box(0, 0.5, 0, 0.05, 0.5, 0.05, ['#7a6a55', '#6a5c4a']);
    m.box(0, 1.08, 0, 0.14, 0.14, 0.24, ['#8d949a', '#79808a']);
    return m.build();
  }
};
