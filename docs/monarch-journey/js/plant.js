/* ============================================================
   plant.js — the milkweed as a walkable graph
   ============================================================
   The plant is a tree of cubic-Bezier SEGMENTS joined at NODES.
   Stem and branch segments carry the plant; LEAF segments are the
   leaves themselves — the petiole and midrib — so a caterpillar
   can crawl out onto a leaf and eat it.  Every segment is sampled
   into a polyline with cumulative arc length, so anything on the
   plant is described by (segment, t), t 0..1 along the arc.

   A leaf blade is a width profile along its segment.  Bites are
   notches in that profile: {t, side, d}.  When enough has been
   chewed the leaf is a skeleton (just the midrib) and slowly
   regrows.

   Wind sway is a pure function of position and time, so the
   plant and everything sitting on it move together.
   ============================================================ */
'use strict';

const SEG_SAMPLES = 28;

class Plant {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.segs = [];
    this.nodes = [];
    this.leaves = [];          // leaf blades; each owns one leaf segment
    this.flowers = [];         // umbels (nectar for the adult)
    this.pods = [];
    this.eggSpots = [];        // underside of leaves, near the tip
    this.hangSpots = [];       // where a full caterpillar may hang its J
    this.type = MILKWEEDS[opts.type] || MILKWEEDS.swamp;
    this.height = opts.height || this.type.height;
    this.ox = opts.x || 0;
    this.swayAmp = 12;
    this.gust = 0;             // extra sway from weather
    this.time = 0;
    this.aphids = null; this.ants = null;
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

  addSeg(a, b, c1, c2, w0, w1, depth, kind = 'stem') {
    const s = {
      id: this.segs.length, a: a.id, b: b.id,
      p0: [a.x, a.y], p1: c1, p2: c2, p3: [b.x, b.y],
      w0, w1, depth, kind, pts: [], cum: [], len: 0,
      z: this.rng() * 2 - 1,
      hueShift: (this.rng() - .5) * 14,
      leaf: -1
    };
    this._sample(s);
    a.segs.push(s.id); b.segs.push(s.id);
    this.segs.push(s);
    return s;
  }

  build() {
    const R = this.rng;
    const H = this.height;
    const root = this.addNode(0, 0);

    /* Main stem: stacked segments so it can bend gently. */
    const stemParts = 5;
    let prev = root, x = 0, y = 0;
    let dir = -Math.PI / 2 + (R() - .5) * .1;
    const mainNodes = [root];
    for (let i = 0; i < stemParts; i++) {
      const len = (H / stemParts) * (0.85 + R() * .3);
      dir += (R() - .5) * .22;
      dir = clamp(dir, -Math.PI / 2 - .26, -Math.PI / 2 + .26);
      const nx = x + Math.cos(dir) * len, ny = y + Math.sin(dir) * len;
      const nn = this.addNode(nx, ny);
      const c1 = [x + Math.cos(dir + (R() - .5) * .4) * len * .35, y + Math.sin(dir) * len * .35];
      const c2 = [nx - Math.cos(dir) * len * .35 + (R() - .5) * 24, ny - Math.sin(dir) * len * .35];
      const w0 = lerp(20, 8, i / stemParts), w1 = lerp(20, 8, (i + 1) / stemParts);
      this.addSeg(prev, nn, c1, c2, w0, w1, 0);
      prev = nn; x = nx; y = ny;
      mainNodes.push(nn);
    }
    const top = prev;

    /* Opposite leaf pairs: at each stem node and halfway along each stem segment. */
    const stemSegs = this.segs.slice();
    for (const s of stemSegs) {
      const midT = .5 + (R() - .5) * .2;
      const p = this.posOn(s, midT, false);
      const mid = this.addNode(p.x, p.y);
      this.splitSeg(s, midT, mid);
      const hf = clamp(-mid.y / H, 0, 1);
      const size = lerp(this.type.leafSize[1], this.type.leafSize[0], hf) * (0.9 + R() * .2);
      this.addLeaf(mid, 1, size, 0);
      this.addLeaf(mid, -1, size * (0.9 + R() * .2), 0);
    }
    for (let i = 1; i < mainNodes.length - 1; i++) {
      const n = mainNodes[i];
      const hf = clamp(-n.y / H, 0, 1);
      const size = lerp(this.type.leafSize[1] * .93, this.type.leafSize[0] * .95, hf) * (0.9 + R() * .2);
      this.addLeaf(n, 1, size, 0);
      this.addLeaf(n, -1, size * (0.9 + R() * .2), 0);
      /* the odd side branch with its own leaves and an umbel */
      if (i >= 2 && R() < .55) {
        const side = R() < .5 ? 1 : -1;
        const ang = -Math.PI / 2 + side * (0.55 + R() * .3);
        this.growBranch(n, ang, 240 + R() * 110, 8);
      }
    }
    /* Crown: a big umbel and two small leaves */
    this.addFlower(top, 30 + R() * 6, true);
    this.addLeaf(top, 1, 70, 0, -0.55);
    this.addLeaf(top, -1, 70, 0, -0.55);
    /* a couple of seed pods low on the plant */
    const podNode = mainNodes[2];
    if (podNode) this.pods.push({ node: podNode.id, x: podNode.x, y: podNode.y, side: R() < .5 ? 1 : -1, size: 46 + R() * 10, ang: -.9, burst: 0, seeds: 4 + rndIntR(R, 0, 3) });
    const podNode2 = mainNodes[4];
    if (podNode2 && R() < .7) this.pods.push({ node: podNode2.id, x: podNode2.x, y: podNode2.y, side: R() < .5 ? 1 : -1, size: 40 + R() * 8, ang: -1.1, burst: 0, seeds: 3 + rndIntR(R, 0, 3) });
  }

  growBranch(from, ang, len, w) {
    const R = this.rng;
    const endAng = lerp(ang, -Math.PI / 2, .4);
    const ex = from.x + Math.cos(ang) * len * .5 + Math.cos(endAng) * len * .5;
    const ey = from.y + Math.sin(ang) * len * .5 + Math.sin(endAng) * len * .5;
    const end = this.addNode(ex, ey);
    const c1 = [from.x + Math.cos(ang) * len * .38, from.y + Math.sin(ang) * len * .38];
    const c2 = [ex - Math.cos(endAng) * len * .38, ey - Math.sin(endAng) * len * .38];
    const s = this.addSeg(from, end, c1, c2, w, w * .6, 1);
    /* one leaf pair halfway, umbel at the tip */
    const p = this.posOn(s, .55, false);
    const mid = this.addNode(p.x, p.y);
    this.splitSeg(s, .55, mid);
    this.addLeaf(mid, 1, this.type.leafSize[0] * .85 + R() * 20, 1);
    this.addLeaf(mid, -1, this.type.leafSize[0] * .85 + R() * 20, 1);
    this.addFlower(end, 22 + R() * 5, false);
    this.hangSpots.push({ seg: this.segs[this.segs.length - 1].id, t: .82, x: 0, y: 0, kind: 'branch' });
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
    this.addSeg(mid, b, r1, q2, wm, w1, s.depth, s.kind);
  }

  /* A leaf is a segment: petiole + midrib, from `from` out to the tip. */
  addLeaf(from, side, size, depth, lift) {
    const R = this.rng;
    const up = lift !== undefined ? lift : -(0.18 + R() * .25);          // slight upward tilt at the base
    const ang = side > 0 ? up : Math.PI - up;
    const droop = (0.25 + R() * .3);                                        // tip droops back down
    const endAng = side > 0 ? up + droop : Math.PI - up - droop;
    const ex = from.x + Math.cos(ang) * size * .5 + Math.cos(endAng) * size * .5;
    const ey = from.y + Math.sin(ang) * size * .5 + Math.sin(endAng) * size * .5;
    const tip = this.addNode(ex, ey);
    const c1 = [from.x + Math.cos(ang) * size * .4, from.y + Math.sin(ang) * size * .4];
    const c2 = [ex - Math.cos(endAng) * size * .35, ey - Math.sin(endAng) * size * .35];
    const s = this.addSeg(from, tip, c1, c2, 4.5, 1.6, depth, 'leaf');
    const leaf = {
      id: this.leaves.length, seg: s.id, side, size,
      maxW: size * (this.type.leafW + R() * .05),
      petiole: 0.14,
      z: side * .4 + (R() - .5) * .6,
      phase: R() * TAU,
      bites: [], eaten: 0, capacity: Math.max(4, Math.round(size / 18)),
      skeleton: false, regrow: 0, grow: 1,
      hue: (R() - .5) * 10
    };
    s.leaf = leaf.id;
    this.leaves.push(leaf);
    this.eggSpots.push({ seg: s.id, t: .68, leaf: leaf.id, x: 0, y: 0 });
    this.hangSpots.push({ seg: s.id, t: .3, leaf: leaf.id, x: 0, y: 0, kind: 'leaf' });
    return leaf;
  }

  addFlower(node, size, crown) {
    this.flowers.push({ node: node.id, x: node.x, y: node.y, size, crown, hue: this.rng(), phase: this.rng() * TAU, nectar: 1 });
  }

  /* Move the whole plant sideways to its place. */
  shift(dx) {
    if (!dx) return;
    for (const n of this.nodes) n.x += dx;
    for (const s of this.segs) {
      s.p0[0] += dx; s.p1[0] += dx; s.p2[0] += dx; s.p3[0] += dx;
      for (const p of s.pts) p[0] += dx;
    }
    for (const f of this.flowers) f.x += dx;
    for (const p of this.pods) p.x += dx;
  }

  computeBounds() {
    let l = 1e9, r = -1e9, t = 1e9;
    for (const n of this.nodes) { l = Math.min(l, n.x); r = Math.max(r, n.x); t = Math.min(t, n.y); }
    for (const sp of this.eggSpots.concat(this.hangSpots)) { const p = this.posOn(sp.seg, sp.t, false); sp.x = p.x; sp.y = p.y; }
    this.bounds = { left: l - 260, right: r + 260, top: t - 160, bottom: 0 };
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
        if (d < bd) { bd = d; best = { seg: s.id, t: s.cum[i] / s.len, d: Math.sqrt(d) }; }
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

  spotNear(list, x, y, r = 70) {
    let best = null, bd = r;
    for (const sp of list) {
      const d = dist(x, y, sp.x + this.sway(sp.x, sp.y), sp.y);
      if (d < bd) { bd = d; best = sp; }
    }
    return best;
  }
  hangSpotNear(x, y, r) { return this.spotNear(this.hangSpots, x, y, r); }
  eggSpotNear(x, y, r) { return this.spotNear(this.eggSpots, x, y, r); }
  podNear(x, y, r = 80) {
    let best = null, bd = r;
    for (const pd of this.pods) { if (pd.burst) continue; const d = dist(x, y, pd.x + this.sway(pd.x, pd.y) + pd.side * pd.size * .5, pd.y - 6); if (d < bd) { bd = d; best = pd; } }
    return best;
  }
  flowerNear(x, y, r = 70) {
    let best = null, bd = r;
    for (const f of this.flowers) {
      const d = dist(x, y, f.x + this.sway(f.x, f.y), f.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /* ---------- leaves ---------- */
  leafOfSeg(segId) { const s = this.segs[segId]; return s && s.leaf >= 0 ? this.leaves[s.leaf] : null; }

  /* Blade half-width at t (0..1 along the leaf segment), before bites. */
  bladeWidth(leaf, t) {
    if (t < leaf.petiole) return 0;
    const u = (t - leaf.petiole) / (1 - leaf.petiole);
    return leaf.maxW * leaf.grow * Math.pow(u, .55) * Math.pow(1 - u, .9) * 2.35;
  }
  /* Half-width after bites, on one side. */
  bittenWidth(leaf, t, side) {
    const w = this.bladeWidth(leaf, t);
    if (!w) return 0;
    let k = 1;
    const seg = this.segs[leaf.seg];
    for (const b of leaf.bites) {
      if (b.side !== side) continue;
      const bw = b.r / seg.len;
      const f = 1 - Math.abs(t - b.t) / bw;
      if (f > 0) k -= b.d * Math.sqrt(f);
    }
    return w * clamp(k, 0, 1);
  }

  /* A caterpillar at (leaf, t) takes a bite. Returns the bite or null. */
  bite(leaf, t, side, size) {
    if (leaf.skeleton) return null;
    if (t < leaf.petiole + .05) t = leaf.petiole + .05;
    const seg = this.segs[leaf.seg];
    const w = this.bladeWidth(leaf, t);
    if (w < 3) return null;
    /* deepen an existing bite nearby, else start a fresh notch */
    let b = null;
    for (const o of leaf.bites) if (o.side === side && Math.abs(o.t - t) * seg.len < o.r * .6) { b = o; break; }
    const amount = clamp(size * 1.1, .35, 1);
    if (b) { if (b.d >= 1) return null; b.d = Math.min(1, b.d + amount * .8); b.r = Math.max(b.r, size * 26); }
    else { b = { t, side, d: amount * .7, r: size * 24 + 10 }; leaf.bites.push(b); }
    leaf.eaten++;
    if (leaf.eaten >= leaf.capacity) { leaf.skeleton = true; leaf.regrow = 0; }
    return b;
  }

  update(dt) {
    for (const lf of this.leaves) {
      if (lf.skeleton) {
        lf.regrow += dt / 120;
        if (lf.regrow >= 1) { lf.skeleton = false; lf.bites = []; lf.eaten = 0; lf.grow = .3; }
      } else if (lf.grow < 1) lf.grow = Math.min(1, lf.grow + dt / 40);
    }
    for (const f of this.flowers) f.nectar = Math.min(1, f.nectar + dt / 25);
  }
}
