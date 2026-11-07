/* ============================================================
   forest.js — the garden around the stump
   ============================================================
   Trees are climbable paths: a trunk and branches, each a
   polyline you can walk along (`Path`).  Here too: the Antler
   Branch on the great oak, the sap, warm air, scent trails, what a
   flying beetle can bump into, the visitors below and above, the
   child who grew up and the log pile, bats, the other beetles.
   ============================================================ */
'use strict';

class Path {
  constructor(pts, w0, w1, parent = null, at = 0, side = 0) {
    this.pts = pts; this.w0 = w0; this.w1 = w1; this.parent = parent; this.at = at; this.side = side;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    this.len = this.cum[this.cum.length - 1];
    this.children = [];
  }
  /* position, direction and thickness at a distance s along the path */
  at_(s) {
    s = clamp(s, 0, this.len);
    let i = 1; while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i], seg = this.cum[i] - this.cum[i - 1] || 1, t = (s - this.cum[i - 1]) / seg;
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: Math.atan2(b.y - a.y, b.x - a.x), w: lerp(this.w0, this.w1, s / this.len) };
  }
  /* the nearest point on the path to (x, y) */
  nearest(x, y) {
    let best = { d: Infinity, s: 0 };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / L2, 0, 1), px = a.x + dx * t, py = a.y + dy * t, d = Math.hypot(x - px, y - py);
      if (d < best.d) best = { d, s: this.cum[i - 1] + t * Math.sqrt(L2) };
    }
    return best;
  }
}

class Tree {
  constructor(x, height, kind, wood, R) {
    this.x = x; this.kind = kind; this.height = height;
    const g = wood.groundAt(x), lean = (R() - .5) * 60;
    const trunkPts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; trunkPts.push({ x: x + Math.sin(t * 2.4 + R() * .3) * lean * t, y: g + 14 - t * height }); }
    const trunkW = kind === 'oak' ? 84 : kind === 'apple' ? 34 : 30;
    this.trunk = new Path(trunkPts, trunkW, trunkW * .38);
    this.paths = [this.trunk];
    this.leafClusters = [];
    const nb = kind === 'oak' ? 6 : 4;
    for (let k = 0; k < nb; k++) {
      const at = this.trunk.len * (kind === 'oak' ? .46 + k * .09 : .42 + k * .13) + (R() - .5) * 30;
      const side = k % 2 ? 1 : -1;
      const base = this.trunk.at_(at);
      const L = (kind === 'oak' ? 300 : 150) * (1 - k * .06) * (.85 + R() * .3);
      const lift = .18 + R() * .25;
      const pts = [{ x: base.x, y: base.y }];
      for (let j = 1; j <= 6; j++) { const t = j / 6; pts.push({ x: base.x + side * L * t, y: base.y - L * t * lift + Math.sin(t * Math.PI) * -18 + t * t * 26 + (R() - .5) * 8 }); }
      const br = new Path(pts, this.trunk.at_(at).w * .5, 6, this.trunk, at, side);
      this.trunk.children.push(br); this.paths.push(br);
      this.leafClusters.push({ x: pts[6].x, y: pts[6].y - 10, r: 70 + R() * 40, ph: R() * TAU });
      this.leafClusters.push({ x: pts[3].x, y: pts[3].y - 30, r: 50 + R() * 30, ph: R() * TAU });
    }
    const top = this.trunk.pts[this.trunk.pts.length - 1];
    this.leafClusters.push({ x: top.x, y: top.y - 30, r: 120, ph: R() * TAU });
    this.top = top.y;
    this.seed = (R() * 1e9) | 0;
  }
}

/* where something stands on top of a branch (or on a trunk) */
function perchPos(path, s, feet) {
  const here = path.at_(s);
  if (!path.parent) return { x: here.x, y: here.y, ang: -Math.PI / 2, here };
  const nx = Math.sin(here.ang), ny = -Math.cos(here.ang), up = ny < 0 ? 1 : -1;
  return { x: here.x + nx * up * (here.w / 2 + feet), y: here.y + ny * up * (here.w / 2 + feet), ang: here.ang + (Math.cos(here.ang) < 0 ? Math.PI : 0), here };
}

class Forest {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.wood = new Wood(seed);
    this.trees = [
      new Tree(WORLD.oakX, 980, 'oak', this.wood, R),
      new Tree(WORLD.appleX, 430, 'apple', this.wood, R),
      new Tree(WORLD.left + 180, 900, 'oak', this.wood, R),
      new Tree(WORLD.right - 110, 620, 'young', this.wood, R)
    ];
    /* the Antler Branch: long, nearly level, reaching out from the great oak over the fence */
    const T = this.trees[0], at = 300, base = T.trunk.at_(at), L = 470, pts = [{ x: base.x, y: base.y }];
    for (let j = 1; j <= 8; j++) { const t = j / 8; pts.push({ x: base.x - L * t, y: base.y - 26 * Math.sin(t * 2.4) + t * t * 16 }); }
    this.ringPath = new Path(pts, 34, 13, T.trunk, at, -1);
    T.trunk.children.push(this.ringPath); T.paths.push(this.ringPath);
    T.leafClusters.push({ x: pts[8].x, y: pts[8].y - 40, r: 60, ph: 1 }, { x: pts[5].x, y: pts[5].y - 96, r: 48, ph: 2 });
    this.sap = { path: this.ringPath, s: 70, flow: 0, x: 0, y: 0 };
    { const q = this.ringPath.at_(70); this.sap.x = q.x; this.sap.y = q.y; }
    this.apple = this.trees[1];
    this.npcs = []; this.grubs = []; this.critters = []; this.eggs = []; this.exuviae = [];
    this.weather = { state: 'clear', timer: 1e9, rain: 0, cloud: .12, gust: 0 };
    this.humid = .3;
    this.frost = 0; this.flood = 0; this.floodOn = false; this.spreading = 0; this.under = null; this.hunter = null;
    this.kid = { state: 'away', x: 0, y: 0, t: 0, done: false, dir: -1, carry: false };
    this.pile = 0; this.puffs = []; this.scentTo = null; this.bats = []; this.rivalsSent = 0;
    this.sites = [{ key: 'compost', x: -470 }, { key: 'fence', x: WORLD.fenceX - 34 }, { key: 'pile', x: WORLD.pileX }];
    /* warm air rising off the lawn, the path and the wall */
    this.warm = [];
    for (let k = 0; k < 8; k++) { const x = lerp(-900, 1250, (k + .2 + R() * .6) / 8); if (Math.abs(x - WORLD.pileX) > 190) this.warm.push({ x, w: 54 + R() * 34, y0: -320, y1: -30, ph: R() * TAU }); }
    /* brothers and sisters in the wood (laid by the same mother) */
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + R(), x = WORLD.stumpX + Math.cos(a) * 170, y = 140 + Math.sin(a) * 90;
      const g = { x, y, r: 4 + R() * 3, ang: R() * TAU, t: R() * 10, hx: x, hy: y, turn: 0, sing: 0 };
      this.wood.blob(x, y, 11, 10, MAT.AIR, () => true);
      this.grubs.push(g);
    }
  }
  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  nearestPerch(x, y, maxD = 30) {
    let best = null;
    for (const T of this.trees) for (const p of T.paths) {
      const n = p.nearest(x, y);
      if (n.d < maxD && (!best || n.d < best.d)) best = { path: p, s: n.s, d: n.d, tree: T };
    }
    return best;
  }
  treeAt(x) { return this.trees.find(T => Math.abs(T.trunk.pts[0].x - x) < T.trunk.w0 * .6 + 12); }
  /* the scent trail for tonight: a curve of puffs to fly through, ending at the goal */
  scentTrail(x0, y0, goal) {
    this.scentTo = goal; this.puffs = [];
    const dist = Math.abs(goal.x - x0), n = clamp(Math.round(dist / 170), 3, 12), top = Math.min(y0, goal.y) - 130;
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1), y = lerp(y0, goal.y, t) - Math.sin(t * Math.PI) * (Math.min(y0, goal.y) - top) + Math.sin(k * 1.7) * 26;
      this.puffs.push({ x: lerp(x0, goal.x, t), y: Math.min(y, -46), got: 0 });
    }
  }
  warmAt(x, y) { for (const w of this.warm) if (Math.abs(x - w.x) < w.w && y > w.y0 && y < w.y1) return w; return null; }
  /* what a heavy flying beetle can bump into */
  bonkAt(x, y, r) {
    if (x > WORLD.lineL && x < WORLD.lineR && y > -118 - r && y < -52 + r) return 'sheet';
    if (Math.hypot(x - WORLD.lampX, y + 196) < 26 + r) return 'lamp';
    if (Math.abs(x - WORLD.lampX) < 7 + r * .5 && y > -196) return 'post';
    if (Math.abs(x - WORLD.fenceX) < 10 + r * .5 && y > -74) return 'fence';
    return null;
  }

  update(dt, tod) {
    const G = this.G, W = this.weather;
    W.gust = Math.max(0, W.gust - dt * .3); if (this.R() < dt * .05) W.gust = .5 + this.R() * .5;
    W.cloud += ((this.floodOn ? .85 : .12) - W.cloud) * (1 - Math.exp(-dt * .5));
    W.rain += ((this.floodOn ? 1 : 0) - W.rain) * (1 - Math.exp(-dt * .8));
    this.flood += ((this.floodOn ? 1 : 0) - this.flood) * (1 - Math.exp(-dt * .35));
    this.humid += (clamp(.25 + nightAmount(tod) * .38 + W.rain * .7, 0, 1) - this.humid) * (1 - Math.exp(-dt * .25));
    if (this.spreading > 0) { this.spreading -= dt; this.wood.spread(Math.max(1, Math.round(dt * 60))); }
    this.sap.flow = this.sap.on ? Math.min(1, this.sap.flow + dt * .5) : this.sap.flow;
    /* the other grubs eat their way slowly through the stump */
    if (G.player && G.player.underground) for (const g of this.grubs) {
      g.t += dt; g.turn -= dt; g.sing = Math.max(0, g.sing - dt);
      if (g.turn <= 0) { g.turn = 2 + this.R() * 5; const back = Math.hypot(g.x - g.hx, g.y - g.hy) > 60; g.goal = back ? Math.atan2(g.hy - g.y, g.hx - g.x) : g.ang + (this.R() - .5) * 1.6; }
      g.ang = angleLerp(g.ang, g.goal || g.ang, dt * .8);
      const hx = g.x + Math.cos(g.ang) * (g.r + 3), hy = g.y + Math.sin(g.ang) * (g.r + 3), s = this.wood.survey(hx, hy, g.r + 2);
      if (s.sky || s.bark || s.rock || s.hard > 2) { g.ang += Math.PI * .6; continue; }
      const res = this.wood.chew(hx, hy, g.r + 1.5, .25, dt);
      g.r = Math.min(9, g.r + res.food * .004);
      if (this.wood.free(g.x + Math.cos(g.ang) * 1.5, g.y + Math.sin(g.ang) * 1.5, g.r * .8, true)) { g.x += Math.cos(g.ang) * 4 * dt; g.y += Math.sin(g.ang) * 4 * dt; }
    }
    this.updateUnder(dt); this.updateHunter(dt); this.updateKid(dt); this.updateBats(dt);
    for (const n of this.npcs) n.update(dt);
    this.npcs = this.npcs.filter(n => !n.gone);
  }

  /* ---------- visitors below: mole, centipede, woodlice, badger.  None ever finds you. ---------- */
  startUnder(kind, p) {
    if (this.under) return null;
    const sx = WORLD.stumpX, dir = p.x > sx ? -1 : 1;
    const u = { kind, dir, t: 0, x: sx - dir * 560, y: 90, n: kind === 'woodlice' ? 6 : 1 };
    if (kind === 'mole') u.y = clamp(p.y - 60, 40, 150);
    if (kind === 'centipede' || kind === 'woodlice') { u.x = p.x - dir * 260; u.y = clamp(p.y + (this.R() - .5) * 60, 30, 340); }
    if (kind === 'badger') { u.x = sx + 30; u.y = this.wood.topAt(sx + 30); u.dir = -1; }
    this.under = u; Bus.emit('under', u);
    return u;
  }
  updateUnder(dt) {
    const u = this.under; if (!u) return;
    u.t += dt;
    const W = this.wood, sx = WORLD.stumpX;
    if (u.kind === 'mole') {
      u.x += u.dir * 62 * dt; u.y += Math.sin(u.t * 1.3) * 14 * dt;
      W.blob(u.x, u.y, 16, 13, MAT.AIR, (m) => m === MAT.SOIL || m === MAT.ROT || m === MAT.PUNK || m === MAT.FRASS || m === MAT.ROOT);
      if (Math.abs(u.x - sx) > 570) { this.under = null; Bus.emit('underGone', u); }
    } else if (u.kind === 'centipede') { u.x += u.dir * 150 * dt; u.y += Math.sin(u.t * 3) * 30 * dt; if (u.t > 6) { this.under = null; Bus.emit('underGone', u); } }
    else if (u.kind === 'woodlice') { u.x += u.dir * 34 * dt; if (u.t > 15) { this.under = null; Bus.emit('underGone', u); } }
    else if (u.kind === 'badger') {
      if (u.t > 1 && u.t < 11 && Math.floor(u.t * 4) !== Math.floor((u.t - dt) * 4)) {
        const x = sx + 30 + (this.R() - .5) * 70, y = Math.min(W.topAt(x) + 8, 6);
        W.blob(x, y, 20, 16, MAT.AIR, (m) => m !== MAT.ROCK);
        W.cellsIn(x, y, 24, (i) => { if (W.mat[i] === MAT.AIR) W.sky[i] = 1; });
        this.G.particles.dust(x, y, '#7a5236', 6, -Math.PI / 2); Bus.emit('badgerDig', u);
      }
      if (u.t > 12) { this.under = null; Bus.emit('underGone', u); }
    }
  }
  /* is the visitor close enough to matter? (shakes the screen, tells you to go deep) */
  underNear(p) { const u = this.under; return !!u && (u.kind === 'badger' ? p.y - this.wood.topAt(p.x) < 80 && Math.abs(p.x - u.x) < 160 : Math.hypot(u.x - p.x, u.y - p.y) < 90); }

  /* ---------- visitors above: magpie, cat, fox.  Curious, then bored. ---------- */
  startHunter(kind, p) {
    if (this.hunter) return null;
    const dir = p.x > 0 ? 1 : -1, h = { kind, dir, x: p.x - dir * 420, y: kind === 'magpie' ? -240 : 0, t: 0, state: 'come', gx: p.x - dir * 58 };
    this.hunter = h; Bus.emit('predator', h);
    return h;
  }
  updateHunter(dt) {
    const h = this.hunter; if (!h) return;
    h.t += dt;
    const top = (x) => this.wood.walkTop(x, 10);
    if (h.state === 'come') {
      h.x += sign(h.gx - h.x) * (h.kind === 'magpie' ? 240 : 150) * dt;
      h.y = h.kind === 'magpie' ? lerp(h.y, top(h.x) - 4, 1 - Math.exp(-dt * 3)) : top(h.x);
      if (Math.abs(h.x - h.gx) < 8) { h.state = 'look'; h.t = 0; }
    } else if (h.state === 'look') {
      h.y = top(h.x);
      if (h.t > 3.2) { h.state = 'leave'; h.t = 0; Bus.emit('hunterBored', h); }
    } else {
      h.x -= h.dir * (h.kind === 'magpie' ? 300 : 190) * dt;
      h.y = h.kind === 'magpie' ? h.y - 180 * dt : top(h.x);
      if (h.t > 3.5) this.hunter = null;
    }
  }
  scare() { const h = this.hunter; if (h && h.state !== 'leave') { h.state = 'leave'; h.t = 0; Bus.emit('scared', h); return true; } return false; }

  /* ---------- the child who grew up: comes along the path, lifts you, sets you safe, builds a log pile ---------- */
  startKid(p) { const k = this.kid; if (k.state !== 'away' || k.done) return; k.state = 'come'; k.x = p.x + 620; k.y = 0; k.t = 0; k.dir = -1; Bus.emit('kidComing', k); }
  updateKid(dt) {
    const k = this.kid, p = this.G.player; if (k.state === 'away') return;
    k.t += dt; k.y = this.wood.walkTop(k.x, 8);
    if (k.state === 'come') { k.x -= 210 * dt; if (k.x - p.x < 62) { k.state = 'look'; k.t = 0; Bus.emit('kidStopped', k); } }
    else if (k.state === 'look') { if (k.t > 3) { k.state = 'lift'; k.t = 0; k.carry = true; p.lifted(); Bus.emit('kidLifted', k); } }
    else if (k.state === 'lift') { if (k.t > 1.2) { k.state = 'carry'; k.t = 0; } }
    else if (k.state === 'carry') {
      const gx = WORLD.pileX + 70; k.x += sign(gx - k.x) * Math.min(460, Math.abs(gx - k.x) * 3 + 60) * dt; p.x = k.x + 18; p.y = k.y - 74;
      if (Math.abs(k.x - gx) < 10) { k.state = 'put'; k.t = 0; }
    } else if (k.state === 'put') {
      if (k.t > 1 && k.carry) { k.carry = false; p.putDown(); this.pile = Math.max(this.pile, 2); Bus.emit('kidPut', k); }
      if (k.t > 3.2) { k.state = 'leave'; k.t = 0; }
    } else if (k.state === 'leave') { k.x += 190 * dt; if (k.t > 7) { k.state = 'away'; k.done = true; } }
  }

  /* ---------- bats at dusk: they swoop, they wobble you, they never catch you ---------- */
  sendBats(n) { const p = this.G.player; for (let k = 0; k < n; k++) this.bats.push({ x: p.x + 500 + k * 170, y: p.y - 150, ph: k * 2.1, t: 0, passed: false }); }
  updateBats(dt) {
    const p = this.G.player;
    for (const b of this.bats) {
      b.t += dt; b.ph += dt * 14;
      const dx = p.x - b.x; b.x += (b.passed ? -300 : clamp(dx, -340, 340) * .9 + 40) * dt * (b.passed ? 1 : 1.1); b.y += ((p.y - 50 + Math.sin(b.t * 4) * 60) - b.y) * (1 - Math.exp(-dt * 2));
      if (!b.passed && Math.abs(dx) < 26) { b.passed = true; if (p.mode === 'fly') { p.wobble = 1; Bus.emit('batMiss', b); } }
    }
    this.bats = this.bats.filter(b => b.t < 14 && b.x > WORLD.left - 300);
  }

  /* ---------- rivals and the female ---------- */
  sendRival(R, s, from, big) {
    const n = new NPCBeetle(this, { male: true, len: big ? Math.max(R.len, 62) : R.len, rival: R, path: this.ringPath, s, from });
    this.npcs.push(n); this.rivalsSent++;
    return n;
  }
  sendFemale(path, s, x) {
    const n = new NPCBeetle(this, { male: false, len: 42, path, s, gx: x, from: 1 });
    this.npcs.push(n); return n;
  }
  /* how far apart two beetles stand with their jaws locked, tips past each other */
  lockGap(a, b) { const reach = (q) => { const s = q.size || q.scale; return (47 + Sprites.antlerLen(true, q.lengthMM) * .86) * s; }; return reach(a) + reach(b); }
  /* two rivals wrestling: b takes his place at the lock from a */
  lockPair(a, b) { b.s = a.s + this.lockGap(a, b); a.pair = 1; b.pair = 1; a.face = -1; b.face = 1; a.jaw = b.jaw = .26; }
  rival() { return this.npcs.find(n => n.male && !n.leaving && !n.gone); }
  rivals() { return this.npcs.filter(n => n.male && !n.leaving && !n.gone); }
  female() { return this.npcs.find(n => !n.male && !n.gone); }
}

/* another beetle: flies in, lands on a branch (or the lawn), and flies away again */
class NPCBeetle {
  constructor(F, o) {
    this.F = F; this.male = o.male; this.lengthMM = o.len; this.rivalDef = o.rival || null; this.col = o.rival ? o.rival.col : null;
    this.x = (o.from || 1) > 0 ? WORLD.oakX + 420 : WORLD.left; this.y = -760 - F.R() * 180;
    this.vx = 0; this.vy = 0; this.mode = 'fly'; this.face = -1; this.flap = 0; this.t = 0; this.walk = 0; this.pair = 0;
    this.leaving = false; this.gone = false; this.lift = 0; this.ang = 0; this.spin = 0;
    this.path = o.path || null; this.s = o.s || 0; this.gx = o.gx;
  }
  get scale() { return this.lengthMM * .0062; }
  get feet() { return 32 * this.scale; }
  t0() { return this.F.G.time || 0; }
  goal() {
    if (this.leaving) return { x: this.x + this.face * 600, y: -1200 };
    if (this.path) { const q = perchPos(this.path, this.s, this.feet); return { x: q.x, y: q.y }; }
    return { x: this.gx, y: this.F.wood.walkTop(this.gx, 8) - this.feet };
  }
  update(dt) {
    this.t += dt;
    if (this.mode === 'fly') {
      this.flap += dt * 40;
      const g = this.goal(), dx = g.x - this.x, dy = g.y - this.y, d = Math.hypot(dx, dy) || 1, sp = this.leaving ? 240 : clamp(d * 1.3, 50, 220);
      this.vx += (dx / d * sp - this.vx) * (1 - Math.exp(-dt * 2.4)); this.vy += (dy / d * sp - this.vy) * (1 - Math.exp(-dt * 2.4));
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.abs(this.vx) > 10) this.face = sign(this.vx);
      if (this.leaving) { if (this.y < -1100 || this.x < WORLD.left - 200 || this.x > WORLD.right + 200) this.gone = true; return; }
      if (d < 16) { this.mode = 'perch'; this.vx = this.vy = 0; this.x = g.x; this.y = g.y; Bus.emit(this.male ? 'rivalLanded' : 'femaleLanded', this); }
    } else if (this.mode === 'perch') {
      if (this.path) { const q = perchPos(this.path, this.s + (this.pair ? Math.sin(this.t0() * 3) * 7 : 0), this.feet); this.x = q.x; this.y = q.y; this.ang = q.ang; }
      if (this.pair) this.walk += dt * 7;
    } else if (this.mode === 'tossed') {
      this.vy += 700 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += dt * 9;
      if (this.t > .8) { this.mode = 'fly'; this.leaving = true; this.spin = 0; this.vy = -200; this.flap = 0; }
    }
  }
  toss(dir) { this.mode = 'tossed'; this.t = 0; this.vx = dir * 170; this.vy = -330; this.path = null; }
  flyAway() { this.mode = 'fly'; this.leaving = true; this.vy = -180; this.path = null; }
}
