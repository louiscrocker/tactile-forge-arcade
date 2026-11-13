/* ============================================================
   yard.js — the back yard, and everything a spider can walk on
   ============================================================
   World: +x right, +y DOWN, the ground at y = 0.  A dry back yard
   in the American Southwest, left to right: the board fence · the
   woodpile · the shed and an old crate · two flowerpots · an old
   boot · the prickly pear on its rock · the porch (post, roof,
   the porch light).

   Everything walkable is a Line: a polyline you can be on at a
   distance s from its start.
     ground   one flat line, in front of everything
     object   the outline of a thing, feet on the ground; walls and
              undersides are just segments of it
     thread   two points: silk you (or another spider) fixed
   Lines meet at junctions (a thread's ends, crossings, an object's
   feet).  The spider moves along a line and may change line at a
   junction; Net.steer() finds the way from A to B over all of it.
   The rest of the yard (bugs, visitors, people) is in yard2.js.
   ============================================================ */
'use strict';

const WORLD = {
  left: -1500, right: 1230, top: -620, bottom: 150,
  sacX: 1150, sacY: -298, launchX: 1104, launchY: -338,
  lampX: 1118, lampY: -288, doorX: 1420
};

class Line {
  constructor(pts, kind, o) {
    this.pts = pts; this.kind = kind; this.cum = [0]; this.junc = [];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
    if (o) Object.assign(this, o);
  }
  seg(s) { const c = this.cum; let i = 0; while (i < c.length - 2 && c[i + 1] < s) i++; return i; }
  /* the point at s, the way along (tx, ty) and the way out of the surface (nx, ny) */
  at(s) {
    s = clamp(s, 0, this.len);
    const i = this.seg(s), a = this.pts[i], b = this.pts[i + 1], L = (this.cum[i + 1] - this.cum[i]) || 1, u = (s - this.cum[i]) / L;
    const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
    let nx = ty, ny = -tx;
    if (this.kind === 'thread' && (ny < -.05 || (Math.abs(ny) <= .05 && nx < 0))) { nx = -nx; ny = -ny; }   /* she hangs under a thread */
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, tx, ty, nx, ny, i };
  }
  nearest(x, y) {
    let best = null;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), px = a[0] + dx * u, py = a[1] + dy * u, d = Math.hypot(x - px, y - py);
      if (!best || d < best.d) best = { d, s: this.cum[i] + Math.sqrt(L2) * u, x: px, y: py };
    }
    return best;
  }
}

/* the things in the yard: outlines from the left foot, up and over, to the right foot */
const OBJECTS = [
  { key: 'fence', pts: [[-1500, -430], [-1500, 0]] },
  { key: 'woodpile', pts: [[-1330, 0], [-1342, -48], [-1326, -96], [-1338, -132], [-1300, -150], [-1090, -150], [-1058, -128], [-1070, -84], [-1052, -40], [-1062, 0]] },
  { key: 'shed', pts: [[-820, 0], [-820, -250], [-880, -235], [-886, -250], [-620, -362], [-354, -250], [-360, -235], [-420, -250], [-420, 0]] },
  { key: 'crate', pts: [[-335, 0], [-335, -70], [-235, -70], [-235, 0]] },
  { key: 'pot', pts: [[-62, 0], [-74, -84], [-80, -86], [-80, -98], [26, -98], [26, -86], [20, -84], [8, 0]] },
  { key: 'pot2', pts: [[110, 0], [104, -40], [108, -76], [120, -80], [236, -62], [240, -30], [236, 0]] },
  { key: 'boot', pts: [[330, 0], [324, -118], [332, -126], [384, -126], [392, -118], [388, -66], [452, -52], [478, -30], [480, 0]] },
  { key: 'pear', pts: [[610, 0], [622, -34], [668, -48], [700, -52], [688, -110], [700, -160], [690, -215], [716, -252], [760, -250], [792, -205], [776, -150], [800, -100], [786, -56], [830, -40], [850, 0]] },
  { key: 'porch', pts: [[1050, 0], [1050, -40], [1180, -40], [1180, -320], [1085, -320], [1078, -336], [1260, -352]] }
];

/* where a spider can live.  retreat: her den.  guide: the first threads the game suggests, [from, to] */
const SITES = [
  { key: 'woodpile', name: 'the woodpile', x: -1420, x0: -1500, x1: -1320, retreat: [-1338, -132], guide: [[[-1338, -132], [-1500, -150]], [[-1326, -96], [-1500, -78]]] },
  { key: 'shed', name: 'the shed', x: -380, x0: -420, x1: -300, retreat: [-414, -248], guide: [[[-364, -236], [-250, -70]], [[-420, -140], [-335, -70]]] },
  { key: 'pots', name: 'the flowerpots', x: 62, x0: 8, x1: 112, retreat: [22, -85], guide: [[[22, -85], [108, -76]], [[14, -42], [104, -40]]] },
  { key: 'pear', name: 'the prickly pear', x: 545, x0: 390, x1: 700, retreat: [688, -110], guide: [[[688, -110], [392, -118]], [[668, -48], [478, -30]]] }
];

class Net {
  constructor() {
    this.ground = new Line([[WORLD.left, 0], [WORLD.right, 0]], 'ground', { key: 'ground' });
    this.objects = OBJECTS.map(o => new Line(o.pts, 'object', { key: o.key }));
    this.polys = OBJECTS.filter(o => o.key !== 'fence').map(o => o.pts.concat(o.key === 'porch' ? [[1260, 0]] : []));
    this.threads = []; this.nextId = 1; this.version = 0; this.memo = new Map();
    this.rebuild();
  }
  get lines() { return [this.ground, ...this.objects, ...this.threads]; }
  inside(x, y) {
    if (y > .5 || x < WORLD.left - .5) return true;
    for (const P of this.polys) {
      let c = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
      if (c) return true;
    }
    return false;
  }
  /* can silk run straight from a to b?  (a little slack at the ends, where it leaves a surface) */
  clear(ax, ay, bx, by) {
    const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 4);
    for (let k = 1; k < n; k++) { const u = k / n, d = Math.min(u, 1 - u) * L; if (d < 5) continue; if (this.inside(ax + (bx - ax) * u, ay + (by - ay) * u)) return false; }
    return true;
  }
  /* the nearest place to stand, on any line */
  locate(x, y, maxD = 1e9, skip) {
    let best = null;
    for (const L of this.lines) { if (L === skip) continue; const q = L.nearest(x, y); if (q.d < maxD && (!best || q.d < best.d)) { best = q; best.line = L; } }
    return best;
  }
  /* fix a thread between two points that lie on lines; returns it, or null if it can not be done */
  addThread(ax, ay, bx, by, o = {}) {
    const A = this.locate(ax, ay, 6), B = this.locate(bx, by, 6);
    if (!A || !B) return null;
    if (!o.force) {
      if (Math.hypot(B.x - A.x, B.y - A.y) < 20) return null;
      if (A.line === B.line && A.line.kind !== 'thread' && (A.line.kind === 'ground' || A.line.seg(A.s) === B.line.seg(B.s))) return null;
      if (!this.clear(A.x, A.y, B.x, B.y)) return null;
    }
    const T = new Line([[A.x, A.y], [B.x, B.y]], 'thread', { id: this.nextId++, a: { line: A.line, s: A.s }, b: { line: B.line, s: B.s }, hum: 0, born: 0 });
    T.gum = A.line === this.ground || B.line === this.ground;
    Object.assign(T, o.props || {});
    this.threads.push(T); this.rebuild();
    return T;
  }
  /* take threads away (and any that hung from them) */
  removeThreads(test) {
    let gone = this.threads.filter(test), n = 0;
    while (gone.length) {
      n += gone.length;
      this.threads = this.threads.filter(t => !gone.includes(t));
      gone = this.threads.filter(t => gone.includes(t.a.line) || gone.includes(t.b.line));
    }
    if (n) this.rebuild();
    return n;
  }
  rebuild() {
    this.version++; this.memo.clear();
    const all = this.lines; for (const L of all) L.junc = [];
    const join = (L1, s1, L2, s2) => { L1.junc.push({ s: s1, to: L2, ts: s2 }); L2.junc.push({ s: s2, to: L1, ts: s1 }); };
    for (const O of this.objects) for (const [p, s] of [[O.pts[0], 0], [O.pts[O.pts.length - 1], O.len]]) if (Math.abs(p[1]) < .5 && p[0] >= WORLD.left && p[0] <= WORLD.right) join(O, s, this.ground, p[0] - WORLD.left);
    for (const T of this.threads) { join(T, 0, T.a.line, T.a.s); join(T, T.len, T.b.line, T.b.s); }
    for (let i = 0; i < this.threads.length; i++) for (let j = i + 1; j < this.threads.length; j++) {
      const P = this.threads[i], Q = this.threads[j], [a, b] = P.pts, [c, d] = Q.pts;
      const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
      if (t > .02 && t < .98 && u > .02 && u < .98) join(P, t * P.len, Q, u * Q.len);
    }
  }
  /* which way to press to get from (line, s) to (tline, ts): a unit vector, or null when there */
  steer(line, s, tline, ts) {
    if (line === tline && Math.abs(s - ts) < 4) return null;
    const key = line.kind + (line.id || line.key) + ':' + Math.round(s / 3) + '>' + tline.kind + (tline.id || tline.key) + ':' + Math.round(ts / 3);
    const hop = (m) => { if (!m) return null; const q = m.L.at((m.L === line ? s : m.s0) + m.dir * .6); return { x: q.tx * m.dir, y: q.ty * m.dir, dist: m.dist }; };
    if (this.memo.has(key)) { const m = this.memo.get(key); if (!m || (m.L === line ? (s - m.s1) * m.dir < -4 : Math.abs(s - m.near) < 5)) return hop(m); }
    const nodes = [{ L: line, s, d: 0, prev: -1 }, { L: tline, s: ts, d: 1e9, prev: -1 }];
    for (const L of this.lines) for (const j of L.junc) nodes.push({ L, s: j.s, d: 1e9, prev: -1, j });
    const done = new Uint8Array(nodes.length);
    for (;;) {
      let k = -1; for (let i = 0; i < nodes.length; i++) if (!done[i] && nodes[i].d < 1e9 && (k < 0 || nodes[i].d < nodes[k].d)) k = i;
      if (k < 0 || k === 1) break;
      done[k] = 1; const n = nodes[k];
      for (let i = 0; i < nodes.length; i++) {
        if (done[i]) continue; const m = nodes[i]; let w = -1;
        if (m.L === n.L) w = Math.abs(m.s - n.s);
        else if (n.j && n.j.to === m.L && Math.abs(n.j.ts - m.s) < .01) w = 0;
        if (w >= 0 && n.d + w < m.d) { m.d = n.d + w; m.prev = k; }
      }
    }
    let out = null;
    if (nodes[1].d < 1e9) {
      const path = []; for (let k = 1; k >= 0; k = nodes[k].prev) path.unshift(nodes[k]);
      for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i]; if (a.L === b.L && Math.abs(b.s - a.s) > (i === 1 ? 4 : .05)) { let near = s; for (const q of path) { if (q.L !== line) break; near = q.s; } out = { L: a.L, s0: a.s, s1: b.s, near, dir: b.s > a.s ? 1 : -1, dist: nodes[1].d }; break; } }
    }
    this.memo.set(key, out);
    return hop(out);
  }
}
