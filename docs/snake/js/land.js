/* ============================================================
   land.js — the meadow, the pond and the rocky hill with its den
   ============================================================
   World: +x right, +y DOWN, the meadow's surface near y = 0.
   A side view, left to right:

     the rocky hill  −1750 … −620   limestone, top about y −175;
                     the winter den is a crack in the rock that
                     opens on the hill's right flank (DEN.x) and
                     winds down, far below the frost line, to a
                     chamber where the snakes spend the winter
     the meadow      −620 … 1380    grass, flowers, boards, logs,
                     flat rocks (birth spot BIRTH.x)
     the pond        1380 … 2180    banks, then water (surface y 18)
     the woods edge  2180 … 3400    an old stone wall, logs, leaves

   No cells: snakes do not dig.  The ground is a smooth curve from
   the seed (a few bumps), and the den is a fixed path of points.
   ============================================================ */
'use strict';

const WORLD = {
  left: -1900, right: 3500, top: -900, bottom: 460,
  hillL: -1750, hillC: -1180, hillR: -620, hillH: 175,
  meadowL: -620, meadowR: 1380, birthX: 220, homeX: 220,
  pondL: 1380, pondR: 2180, waterY: 18,
  woodsL: 2180, woodsR: 3400,
  walkL: -1840, walkR: 3420,
  frost: 74             /* the frost line: this far below the surface in winter */
};

class Land {
  constructor(seed) {
    this.seed = seed;
    this.n1 = makeNoise1D(seed * 3 + 11);
    this.n2 = makeNoise1D(seed * 5 + 23);
    /* the den: a crack that starts on the hill's flank and winds down to a chamber */
    const mx = WORLD.hillC + 168, my = this.rawSurface(mx);
    this.mouth = { x: mx, y: my };
    const rel = [[0, 0], [-16, 26], [-30, 52], [-16, 82], [-40, 112], [-74, 136], [-92, 168], [-74, 200], [-100, 228], [-140, 242]];
    this.path = rel.map(([dx, dy]) => ({ x: mx + dx, y: my + dy }));
    let L = 0; this.path[0].s = 0;
    for (let i = 1; i < this.path.length; i++) { L += Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y); this.path[i].s = L; }
    this.pathLen = L;
    const end = this.path[this.path.length - 1];
    this.chamber = { x: end.x - 26, y: end.y + 6, rx: 82, ry: 28 };
  }

  rawSurface(x) {
    let y = Math.sin(x * .011) * 4 + (this.n1(x * .004) - .5) * 16;
    /* the rocky hill */
    const u = (x - WORLD.hillC) / 560;
    if (u > -1 && u < 1) { const b = (Math.cos(Math.PI * u) + 1) / 2; y -= WORLD.hillH * Math.pow(b, .9) + (this.n2(x * .05) - .5) * 8 * b; }
    /* the pond: banks, then a bowl under the water */
    if (x > WORLD.pondL && x < WORLD.pondR) { const v = (x - WORLD.pondL) / (WORLD.pondR - WORLD.pondL); y += 118 * Math.pow(Math.sin(Math.PI * v), .8); }
    /* the woods rise gently */
    y -= 34 * smoothstep(WORLD.woodsL + 60, WORLD.woodsL + 520, x);
    /* the far edges rise, so the world has walls */
    y -= 120 * smoothstep(WORLD.walkL + 80, WORLD.left - 20, x) + 120 * smoothstep(WORLD.walkR - 60, WORLD.right + 40, x);
    return y;
  }
  surfaceAt(x) { return this.rawSurface(x); }
  inPond(x) { return x > WORLD.pondL && x < WORLD.pondR && this.rawSurface(x) > WORLD.waterY + 3; }
  /* where a snake's belly rests: the ground, or the water's surface over the pond */
  walkY(x) { const s = this.rawSurface(x); return x > WORLD.pondL && x < WORLD.pondR && s > WORLD.waterY ? WORLD.waterY : s; }
  slopeAt(x) { return (this.walkY(x + 6) - this.walkY(x - 6)) / 12; }
  onHill(x) { return x > WORLD.hillL && x < WORLD.hillR; }
  region(x) { return x < WORLD.hillR ? 'hill' : x < WORLD.meadowR ? 'meadow' : x < WORLD.pondR ? 'pond' : 'woods'; }

  /* ---------- the den path ---------- */
  pointAt(s) {
    const P = this.path; s = clamp(s, 0, this.pathLen);
    for (let i = 1; i < P.length; i++) if (P[i].s >= s) {
      const a = P[i - 1], b = P[i], t = (s - a.s) / Math.max(1e-6, b.s - a.s), len = Math.max(1e-6, b.s - a.s);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), tx: (b.x - a.x) / len, ty: (b.y - a.y) / len };
    }
    const a = P[P.length - 2], b = P[P.length - 1], len = Math.max(1e-6, b.s - a.s);
    return { x: b.x, y: b.y, tx: (b.x - a.x) / len, ty: (b.y - a.y) / len };
  }
  /* how deep below the surface (positive = underground) */
  depthAt(x, y) { return y - this.rawSurface(x); }
}

/* ---------- a snake's body follows the path its head took ----------
   A trail is a list of points, head first, spaced about ds apart. */
const Trail = {
  /* the S-bends of a slithering snake stay put on the ground while the body slides
     through them, so each trail point keeps its own sideways offset z (and c = 1
     for a point that is part of a coil, already placed in 3-D) */
  wave(dist, len) { const wl = clamp(len * .34, 14, 46); return Math.sin(dist / wl * TAU) * clamp(len * .08, 3, 10); },
  reset(tr, x, y, face, len, topAt, lift = 0) {
    tr.length = 0;
    for (let s = 0; s <= len + 8; s += 3) { const tx = x - face * s; tr.push({ x: tx, y: (topAt ? topAt(tx) : y) - lift, z: Trail.wave(s, len) * smoothstep(0, len * .12, s), c: 0 }); }
  },
  /* the head moved to (x, y): add a point when it has gone far enough */
  push(tr, x, y, len, ds = 3, z = 0) {
    if (!tr.length) { tr.push({ x, y, z, c: 0 }); return; }
    const h = tr[0], d = Math.hypot(x - h.x, y - h.y);
    if (d >= ds) tr.unshift({ x, y, z, c: 0 }); else { h.x = x; h.y = y; h.z = z; h.c = 0; }
    /* keep only as much trail as the body needs */
    let acc = 0;
    for (let i = 1; i < tr.length; i++) { acc += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y); if (acc > len + 12) { tr.length = i + 1; break; } }
  },
  /* a resting coil, head first: the head lies on top, facing `face`, and the body spirals
     out underneath it.  Points are already placed (c = 1); z is front (+) or back (−);
     g orders the drawing: back halves outer→inner, then front halves outer→inner. */
  coil(len, th, cx, gy, face, turns = 1.7) {
    const headLen = len * .16, body = len - headLen, Rin = th * 1.05;
    const spiral = (Rout, step) => {
      const pts = [], tmax = turns * TAU;
      for (let a = 0; a <= tmax + 1e-6; a += step) {
        const r = Rin + (Rout - Rin) * a / tmax, stack = (1 - (r - Rin) / Math.max(1, Rout - Rin)) * th * .85;
        pts.push({ x: cx + face * Math.cos(a + Math.PI) * r, y: gy - th * .5 - Rout * .36 + Math.sin(a + Math.PI) * r * .36 - stack, z: Math.sin(a + Math.PI), c: 1, loop: Math.floor((tmax - a) / TAU) });
      }
      return pts;
    };
    const lenOf = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };
    let Rout = Math.max(Rin + th, body / (TAU * turns * .8));
    let pts = null;
    for (let k = 0; k < 8; k++) { pts = spiral(Rout, .12); const L = lenOf(pts); Rout = Math.max(Rin + th * .6, Rout * Math.pow(body / Math.max(1, L), .9)); }
    pts = spiral(Rout, .12);
    for (const q of pts) q.g = (q.z < 0 ? 0 : 100) + (10 - q.loop);
    /* the head and neck: from the inner end of the spiral, up and forwards over the top */
    const s0 = pts[0], hx = cx + face * Rout * .55, hy = gy - th * .5 - Rout * .72 - th * 1.1, head = [];
    for (let k = 6; k >= 1; k--) { const t = k / 6; head.push({ x: lerp(s0.x, hx, t), y: lerp(s0.y, hy, t) - Math.sin(t * Math.PI) * th * .4, z: 1, c: 1, g: 300 }); }
    return head.concat(pts);
  },
  /* n points along the first len units of the trail, head first */
  sample(tr, len, n) {
    const out = [];
    if (!tr.length) return out;
    if (tr.length === 1) { for (let k = 0; k < n; k++) out.push({ x: tr[0].x - len * k / (n - 1), y: tr[0].y, z: 0, c: 0, g: 0 }); return out; }
    let i = 0, acc = 0;
    for (let k = 0; k < n; k++) {
      const want = len * k / (n - 1);
      while (i < tr.length - 2) { const seg = Math.hypot(tr[i + 1].x - tr[i].x, tr[i + 1].y - tr[i].y); if (acc + seg >= want) break; acc += seg; i++; }
      const a = tr[i], b = tr[i + 1], seg = Math.hypot(b.x - a.x, b.y - a.y) || 1, t = (want - acc) / seg;
      /* past the end of the trail: carry on in the same direction */
      const tt = clamp(t, 0, 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: lerp(a.z || 0, b.z || 0, tt), c: lerp(a.c || 0, b.c || 0, tt), g: tt < .5 ? (a.g || 0) : (b.g || 0) });
    }
    return out;
  }
};
