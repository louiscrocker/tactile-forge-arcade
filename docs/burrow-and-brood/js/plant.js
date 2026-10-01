/* ============================================================
   plant.js — one garden plant as a walkable graph
   ============================================================
   The plant is a tree of cubic-Bezier SEGMENTS joined at NODES.
   Every segment is sampled into a polyline with cumulative arc
   length, so anything living on the plant is described by
   (segment, t) where t is 0..1 along the arc.  Leaves and
   flowers hang off segments at recorded (seg, t) spots.

   A plant is grown from a seed and a TYPE (rose, milkweed, bean)
   and then shifted to its place in the garden; every stored
   coordinate is a world coordinate after construction.

   Wind sway is a pure function of position and time, so the
   plant and everything sitting on it move together.
   (Copied from Ladybug Life, same scale: in Ant Kingdom the ants
   climb it to farm the aphids.)
   ============================================================ */
'use strict';

const SEG_SAMPLES = 28;

const PLANT_TYPES = {
  rose: {
    key: 'rose', name: 'Rose bush', height: 1500, stemParts: 6,
    leafShape: 'ovate', leafSize: [60, 120], leavesPerSeg: [2, 4],
    flower: 'rose', thorns: true, woody: true,
    branchLen: [520, 300], branchW: [16, 9], maxDepth: 3, upness: [.55, 1.05],
    stemCol: ['#5a8a3a', '#4f8a33', '#3d6a28'], woodCol: '#6b4f2e',
    aphids: ['green', 'green', 'green', 'pink'], scale: true,
    blurb: 'Roses grow thorns to stop animals eating them, but aphids adore the soft new shoots.'
  },
  milkweed: {
    key: 'milkweed', name: 'Milkweed', height: 1300, stemParts: 5,
    leafShape: 'lance', leafSize: [90, 170], leavesPerSeg: [2, 3],
    flower: 'umbel', thorns: false, woody: false,
    branchLen: [420, 260], branchW: [14, 8], maxDepth: 2, upness: [.8, 1.2],
    stemCol: ['#8fc06a', '#7bb05a', '#5a8f42'], woodCol: '#7bb05a',
    aphids: ['yellow', 'yellow', 'yellow', 'black'], scale: false,
    blurb: 'Milkweed sap is milky and poisonous. Bright yellow oleander aphids drink it anyway and become poisonous too.'
  },
  bean: {
    key: 'bean', name: 'Bean plant', height: 1150, stemParts: 6,
    leafShape: 'heart', leafSize: [80, 150], leavesPerSeg: [2, 3],
    flower: 'bean', thorns: false, woody: false,
    branchLen: [440, 280], branchW: [13, 8], maxDepth: 3, upness: [.45, .95],
    stemCol: ['#7fb85a', '#69a84a', '#4c8536'], woodCol: '#69a84a',
    aphids: ['black', 'black', 'green'], scale: false,
    blurb: 'Black bean aphids swarm bean plants every summer. Gardeners plant nasturtiums nearby to lure them away.'
  }
};

class Plant {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.type = PLANT_TYPES[opts.type] || PLANT_TYPES.rose;
    this.id = opts.id || 0;
    this.rng = mulberry32(seed);
    this.segs = [];
    this.nodes = [];
    this.leaves = [];
    this.flowers = [];
    this.leafSpots = [];       // where a larva may pupate / an adult lay eggs
    this.height = opts.height || this.type.height;
    this.ox = opts.x || 0;
    this.swayAmp = 14;
    this.gust = 0;             // extra sway from weather
    this.time = 0;
    this.aphids = null; this.ants = null; this.npcs = [];   // filled by the garden
    this.build();
    this.shift(this.ox);
    this.computeBounds();
  }

  /* ---------- construction ---------- */
  addNode(x, y) {
    const n = { id: this.nodes.length, x, y, segs: [] };
    this.nodes.push(n);
    return n;
  }

  _sample(s) {
    let px = s.p0[0], py = s.p0[1], L = 0;
    s.pts = []; s.cum = [];
    for (let i = 0; i <= SEG_SAMPLES; i++) {
      const t = i / SEG_SAMPLES, u = 1 - t;
      const x = u * u * u * s.p0[0] + 3 * u * u * t * s.p1[0] + 3 * u * t * t * s.p2[0] + t * t * t * s.p3[0];
      const y = u * u * u * s.p0[1] + 3 * u * u * t * s.p1[1] + 3 * u * t * t * s.p2[1] + t * t * t * s.p3[1];
      if (i > 0) L += Math.hypot(x - px, y - py);
      s.pts.push([x, y]);
      s.cum.push(L);
      px = x; py = y;
    }
    s.len = L;
  }

  addSeg(a, b, c1, c2, w0, w1, depth) {
    const s = {
      id: this.segs.length, a: a.id, b: b.id,
      p0: [a.x, a.y], p1: c1, p2: c2, p3: [b.x, b.y],
      w0, w1, depth, pts: [], cum: [], len: 0,
      z: this.rng() * 2 - 1,
      hueShift: (this.rng() - .5) * 14
    };
    this._sample(s);
    a.segs.push(s.id); b.segs.push(s.id);
    this.segs.push(s);
    return s;
  }

  build() {
    const R = this.rng, T = this.type;
    const H = this.height;
    const root = this.addNode(0, 0);

    /* Main stem: several stacked segments so it can bend gently. */
    const stemParts = T.stemParts;
    let prev = root, x = 0, y = 0;
    let dir = -Math.PI / 2 + (R() - .5) * .12;
    const mainNodes = [root];
    const wig = T.key === 'bean' ? .4 : .28;
    for (let i = 0; i < stemParts; i++) {
      const len = (H / stemParts) * (0.85 + R() * .3);
      dir += (R() - .5) * wig;
      dir = clamp(dir, -Math.PI / 2 - .32, -Math.PI / 2 + .32);
      const nx = x + Math.cos(dir) * len, ny = y + Math.sin(dir) * len;
      const nn = this.addNode(nx, ny);
      const c1 = [x + Math.cos(dir + (R() - .5) * .5) * len * .35, y + Math.sin(dir) * len * .35];
      const c2 = [nx - Math.cos(dir) * len * .35 + (R() - .5) * 30, ny - Math.sin(dir) * len * .35];
      const w0 = lerp(T.woody ? 30 : 22, 10, i / stemParts), w1 = lerp(T.woody ? 30 : 22, 10, (i + 1) / stemParts);
      this.addSeg(prev, nn, c1, c2, w0, w1, 0);
      prev = nn; x = nx; y = ny;
      mainNodes.push(nn);
    }
    /* Crown */
    const crownN = 2 + (R() * 2 | 0);
    for (let i = 0; i < crownN; i++) {
      const a = -Math.PI / 2 + lerp(-.9, .9, crownN === 1 ? .5 : i / (crownN - 1)) + (R() - .5) * .2;
      this.grow(prev, a, 260 + R() * 120, 9, 1, T.maxDepth);
    }

    /* Side branches off the main stem, alternating left / right. */
    let side = R() < .5 ? 1 : -1;
    for (let i = 1; i < mainNodes.length - 1; i++) {
      const n = mainNodes[i];
      const count = i === 1 ? 1 : (R() < .45 ? 2 : 1);
      for (let k = 0; k < count; k++) {
        const up = lerp(T.upness[0], T.upness[1], i / mainNodes.length);
        const ang = -Math.PI / 2 + side * (1.55 - up + R() * .25);
        const len = lerp(T.branchLen[0], T.branchLen[1], i / mainNodes.length) * (0.85 + R() * .3);
        this.grow(n, ang, len, lerp(T.branchW[0], T.branchW[1], i / mainNodes.length), 1, T.maxDepth);
        side = -side;
      }
    }
    /* Low branch near the ground so a hatchling has somewhere to go */
    if (mainNodes.length > 2) {
      const n = mainNodes[1];
      this.grow(n, -Math.PI / 2 + side * 1.25, 330, 12, 1, 2);
    }

    /* Leaves along every segment, and flowers at tips */
    for (const s of this.segs) {
      const nLeaves = rndIntR(R, T.leavesPerSeg[0], T.leavesPerSeg[1]);
      for (let i = 0; i < nLeaves; i++) {
        const t = s.depth === 0 ? lerp(.15, .95, R()) : lerp(.25, 1, (i + .6) / nLeaves) - R() * .12;
        const lside = (i % 2 === 0 ? 1 : -1) * (R() < .85 ? 1 : -1);
        this.addLeaf(s, clamp(t, .1, .99), lside, lerp(T.leafSize[0], T.leafSize[1], R()) * (s.depth === 0 ? 1.15 : 1));
        /* milkweed leaves grow in opposite pairs */
        if (T.key === 'milkweed') this.addLeaf(s, clamp(t, .1, .99), -lside, lerp(T.leafSize[0], T.leafSize[1], R()) * (s.depth === 0 ? 1.15 : 1));
      }
    }
    for (const n of this.nodes) {
      if (n.segs.length === 1 && n.id !== 0) {
        const s = this.segs[n.segs[0]];
        if (s.depth >= 1 && R() < .6) this.addFlower(n, s);
        else this.addBud(n, s);
      }
    }
  }

  grow(from, ang, len, w, depth, maxDepth) {
    const R = this.rng;
    const endAng = lerp(ang, -Math.PI / 2, .35 + R() * .2);
    const ex = from.x + Math.cos(ang) * len * .5 + Math.cos(endAng) * len * .5;
    const ey = from.y + Math.sin(ang) * len * .5 + Math.sin(endAng) * len * .5;
    const end = this.addNode(ex, ey);
    const c1 = [from.x + Math.cos(ang) * len * .38, from.y + Math.sin(ang) * len * .38];
    const c2 = [ex - Math.cos(endAng) * len * .38, ey - Math.sin(endAng) * len * .38];
    const wEnd = Math.max(4, w * .55);
    this.addSeg(from, end, c1, c2, w, wEnd, depth);

    if (depth < maxDepth && len > 140) {
      const midT = .5 + (R() - .5) * .3;
      const seg = this.segs[this.segs.length - 1];
      const p = this.posOn(seg, midT, false);
      const mid = this.addNode(p.x, p.y);
      this.splitSeg(seg, midT, mid);
      const sgn = R() < .5 ? 1 : -1;
      const a2 = Math.atan2(p.ty, p.tx) + sgn * (.6 + R() * .5);
      this.grow(mid, a2, len * (.5 + R() * .2), wEnd * 1.1, depth + 1, maxDepth);
      if (R() < .45) {
        const a3 = Math.atan2(p.ty, p.tx) - sgn * (.7 + R() * .4);
        this.grow(mid, a3, len * (.4 + R() * .2), wEnd, depth + 1, maxDepth);
      }
      if (R() < .5) {
        const a4 = endAng + (R() - .5) * .8;
        this.grow(end, a4, len * (.45 + R() * .2), wEnd, depth + 1, maxDepth);
      }
    }
  }

  splitSeg(s, t, mid) {
    const L = t * s.len;
    let i = 0; while (i < SEG_SAMPLES - 1 && s.cum[i + 1] < L) i++;
    const f = (L - s.cum[i]) / Math.max(1e-6, s.cum[i + 1] - s.cum[i]);
    const u = clamp((i + f) / SEG_SAMPLES, .05, .95);
    const P = [s.p0, s.p1, s.p2, s.p3];
    const lp = (a, b) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const q0 = lp(P[0], P[1]), q1 = lp(P[1], P[2]), q2 = lp(P[2], P[3]);
    const r0 = lp(q0, q1), r1 = lp(q1, q2);
    const m = lp(r0, r1);
    mid.x = m[0]; mid.y = m[1];
    const b = this.nodes[s.b];
    const w1 = s.w1;
    const wm = lerp(s.w0, w1, u);
    b.segs = b.segs.filter(id => id !== s.id);
    s.b = mid.id; s.p1 = q0; s.p2 = r0; s.p3 = [mid.x, mid.y]; s.w1 = wm;
    this._sample(s);
    mid.segs.push(s.id);
    this.addSeg(mid, b, r1, q2, wm, w1, s.depth);
  }

  addLeaf(seg, t, side, size) {
    const p = this.posOn(seg, t, false);
    const R = this.rng;
    const tangentAng = Math.atan2(p.ty, p.tx);
    let ang = tangentAng + side * (0.95 + R() * .45);
    const upness = -Math.sin(ang);
    if (upness < -.4) ang += side * .5;
    const leaf = {
      id: this.leaves.length, seg: seg.id, t, side, size, ang,
      x: p.x, y: p.y,
      variant: (R() * 4) | 0,
      shape: this.type.leafShape,
      curl: (R() - .5) * .5,
      z: seg.z + (R() - .5) * .6,
      phase: R() * TAU,
      petiole: size * (this.type.leafShape === 'lance' ? .12 : .28 + R() * .18),
      fall: R()                 // when it drops in autumn (0 early .. 1 late)
    };
    this.leaves.push(leaf);
    this.leafSpots.push({ seg: seg.id, t, leaf: leaf.id, x: p.x, y: p.y, plant: this.id });
  }

  addFlower(node, seg) {
    const p = this.posOn(seg, 1, false);
    this.flowers.push({ x: node.x, y: node.y, ang: Math.atan2(p.ty, p.tx), size: 26 + this.rng() * 14, hue: this.rng(), z: seg.z, kind: this.type.flower, phase: this.rng() * TAU });
  }
  addBud(node, seg) {
    const p = this.posOn(seg, 1, false);
    this.flowers.push({ x: node.x, y: node.y, ang: Math.atan2(p.ty, p.tx), size: 12 + this.rng() * 8, hue: this.rng(), z: seg.z, kind: this.type.flower === 'bean' ? 'pod' : 'bud', phase: this.rng() * TAU });
  }

  /* Move the whole plant sideways to its place in the garden. */
  shift(dx) {
    if (!dx) return;
    for (const n of this.nodes) n.x += dx;
    for (const s of this.segs) {
      s.p0[0] += dx; s.p1[0] += dx; s.p2[0] += dx; s.p3[0] += dx;
      for (const p of s.pts) p[0] += dx;
    }
    for (const l of this.leaves) l.x += dx;
    for (const ls of this.leafSpots) ls.x += dx;
    for (const f of this.flowers) f.x += dx;
  }

  computeBounds() {
    let l = 1e9, r = -1e9, t = 1e9;
    for (const n of this.nodes) { l = Math.min(l, n.x); r = Math.max(r, n.x); t = Math.min(t, n.y); }
    for (const lf of this.leaves) { l = Math.min(l, lf.x - lf.size); r = Math.max(r, lf.x + lf.size); t = Math.min(t, lf.y - lf.size); }
    this.bounds = { left: l - 60, right: r + 60, top: t - 80, bottom: 0 };
  }

  /* ---------- wind ---------- */
  sway(x, y) {
    const h = clamp(-y / this.height, 0, 1.4);
    const k = h * h;
    const T = this.time;
    const amp = this.swayAmp * (1 + this.gust * 3.5);
    return amp * k * (Math.sin(T * .9 + x * .0015) * .7 + Math.sin(T * 1.7 + y * .002) * .3) + this.gust * k * 28 * Math.sin(T * 6 + x * .01);
  }

  /* ---------- queries ---------- */
  posOn(seg, t, withSway = true) {
    if (typeof seg === 'number') seg = this.segs[seg];
    t = clamp(t, 0, 1);
    const L = t * seg.len;
    let lo = 0, hi = SEG_SAMPLES;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (seg.cum[m] <= L) lo = m; else hi = m; }
    const i = lo;
    const segL = seg.cum[i + 1] - seg.cum[i];
    const f = segL > 1e-6 ? (L - seg.cum[i]) / segL : 0;
    const p = seg.pts[i], q = seg.pts[i + 1];
    let x = lerp(p[0], q[0], f), y = lerp(p[1], q[1], f);
    let tx = q[0] - p[0], ty = q[1] - p[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const w = lerp(seg.w0, seg.w1, t);
    if (withSway) x += this.sway(x, y);
    return { x, y, tx, ty, w };
  }

  nearest(wx, wy, maxDist = 1e9) {
    let best = null, bd = maxDist * maxDist;
    for (const s of this.segs) {
      for (let i = 0; i <= SEG_SAMPLES; i++) {
        const p = s.pts[i];
        const sx = p[0] + this.sway(p[0], p[1]);
        const dx = wx - sx, dy = wy - p[1];
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { seg: s.id, t: s.cum[i] / s.len, d: Math.sqrt(d), plant: this.id }; }
      }
    }
    return best;
  }

  branchesAt(nodeId, excludeSeg) {
    return this.nodes[nodeId].segs.filter(id => id !== excludeSeg);
  }

  outDir(segId, nodeId) {
    const s = this.segs[segId];
    if (s.a === nodeId) { const p = this.posOn(s, .03, false); return [p.tx, p.ty]; }
    const p = this.posOn(s, .97, false); return [-p.tx, -p.ty];
  }

  route(fromSeg, toSeg) {
    if (fromSeg === toSeg) return [];
    const s0 = this.segs[fromSeg];
    const target = this.segs[toSeg];
    const prev = new Map();
    const q = [];
    for (const n of [s0.a, s0.b]) { prev.set(n, -1); q.push(n); }
    let found = -1;
    while (q.length) {
      const n = q.shift();
      if (n === target.a || n === target.b) { found = n; break; }
      for (const sid of this.nodes[n].segs) {
        const s = this.segs[sid];
        const other = s.a === n ? s.b : s.a;
        if (!prev.has(other)) { prev.set(other, n); q.push(other); }
      }
    }
    if (found < 0) return null;
    const path = [];
    let n = found;
    while (n !== -1) { path.unshift(n); n = prev.get(n); }
    return path;
  }

  segBetween(n1, n2) {
    for (const sid of this.nodes[n1].segs) {
      const s = this.segs[sid];
      if ((s.a === n1 && s.b === n2) || (s.a === n2 && s.b === n1)) return sid;
    }
    return -1;
  }

  leafSpotNear(x, y, r = 70) {
    let best = null, bd = r;
    for (const ls of this.leafSpots) {
      const d = dist(x, y, ls.x + this.sway(ls.x, ls.y), ls.y);
      if (d < bd) { bd = d; best = ls; }
    }
    return best;
  }
}

function rndIntR(R, a, b) { return Math.floor(a + R() * (b - a + 1)); }
