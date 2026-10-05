/* ============================================================
   forest.js — the rainforest around the log
   ============================================================
   Trees are climbable paths: a trunk and branches, each a
   polyline you can walk along (`Path`).  Branches hang off the
   trunk at a distance `at` along it.  Fruit hangs on branches and
   falls at night; fallen fruit, sticks to lift, rival males, the
   female, the coati and the sibling grubs in the log all live
   here, along with the weather and the damp in the air (which
   turns a Hercules beetle's wing cases black).
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
    const trunkW = kind === 'ceiba' ? 74 : kind === 'fig' ? 52 : 40;
    this.trunk = new Path(trunkPts, trunkW, trunkW * .38);
    this.paths = [this.trunk];
    this.leafClusters = [];
    const nb = kind === 'ceiba' ? 6 : 5;
    for (let k = 0; k < nb; k++) {
      const at = this.trunk.len * (kind === 'ceiba' ? .42 + k * .1 : .35 + k * .12) + (R() - .5) * 30;
      const side = k % 2 ? 1 : -1;
      const base = this.trunk.at_(at);
      const L = (kind === 'ceiba' ? 260 : 210) * (1 - k * .06) * (.85 + R() * .3);
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

const FRUIT_KINDS = {
  fig:   { r: 8,  bites: 3, col: '#6a3a6a', col2: '#9a6a3a', name: 'fig' },
  mango: { r: 13, bites: 5, col: '#f2a43a', col2: '#d9502a', name: 'mango' },
  guava: { r: 10, bites: 4, col: '#c9d86a', col2: '#f0a0a0', name: 'guava' }
};

class Forest {
  constructor(G, seed) {
    this.G = G;
    this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.wood = new Wood(seed);
    this.trees = [
      new Tree(860, 1500, 'ceiba', this.wood, R),
      new Tree(1460, 980, 'fig', this.wood, R),
      new Tree(-1560, 1150, 'fig', this.wood, R),
      new Tree(470, 760, 'young', this.wood, R)
    ];
    this.fruits = []; this.sticks = []; this.npcs = []; this.grubs = []; this.critters = [];
    this.coati = { state: 'away', x: 1900, t: 0, dir: -1, at: 0, done: false, legs: 0 };
    this.weather = { state: 'clear', timer: 60 + R() * 60, rain: 0, cloud: .15, gust: 0 };
    this.humid = .3;
    this.fruitClock = 5; this.rivalClock = 20; this.rivalsSent = 0;
    /* fruit hanging on the fig trees, and some on the ground already */
    for (const T of this.trees) if (T.kind === 'fig') for (const p of T.paths.slice(1)) for (let k = 0; k < 3; k++) this.hang(p, p.len * (.35 + k * .22));
    for (let k = 0; k < 4; k++) this.dropFruit(pick(['mango', 'guava', 'fig']), lerp(300, 1650, R()), true);
    for (let k = 0; k < 5; k++) { const x = lerp(-1650, 1700, R()); if (Math.abs(x - WORLD.nestX) < 250) continue; this.sticks.push({ x, len: 40 + R() * 40, ang: (R() - .5) * .2, flipped: false, t: 0, hide: pick(['fruit', 'millipede', 'beetle', 'fruit']), kind: R() }); }
    /* brothers and sisters in the log (laid by the same mother) */
    for (let k = 0; k < 4; k++) {
      const x = lerp(WORLD.logL + 220, WORLD.logR - 260, (k + R() * .6) / 4.2), y = this.wood.logAxis(x) + (R() - .5) * 120;
      if (Math.abs(x - WORLD.nestX) < 120) continue;
      const g = { x, y, r: 4 + R() * 3, ang: R() * TAU, t: R() * 10, hx: x, hy: y, curl: R(), turn: 0 };
      this.wood.blob(x, y, 9, 8, MAT.AIR, (m) => m === MAT.ROT || m === MAT.PUNK);
      this.grubs.push(g);
    }
    /* a millipede on the log, and night moths */
    this.critters.push({ kind: 'millipede', x: -400, dir: 1, sp: 14, ph: 0 });
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  hang(path, s) { const p = path.at_(s); this.fruits.push({ kind: 'fig', x: p.x, y: p.y + 10, path, s, hanging: true, bites: FRUIT_KINDS.fig.bites, vy: 0, rot: 0, age: 0 }); }
  dropFruit(kind, x, settled) {
    const f = { kind, x: clamp(x, WORLD.left + 40, WORLD.right - 40), y: settled ? 0 : -900, hanging: false, bites: FRUIT_KINDS[kind].bites, vy: 0, rot: (this.R() - .5) * 2, age: 0, falling: !settled };
    if (settled) f.y = this.wood.walkTop(f.x, 6) - FRUIT_KINDS[kind].r * .7;
    this.fruits.push(f);
    return f;
  }
  groundFruits() { return this.fruits.filter(f => !f.hanging && !f.falling && f.bites > 0); }

  /* where on the trees is closest to a point (for climbing and landing) */
  nearestPerch(x, y, maxD = 30) {
    let best = null;
    for (const T of this.trees) for (const p of T.paths) {
      const n = p.nearest(x, y);
      if (n.d < maxD && (!best || n.d < best.d)) best = { path: p, s: n.s, d: n.d, tree: T };
    }
    return best;
  }
  treeAt(x) { return this.trees.find(T => Math.abs(T.trunk.pts[0].x - x) < T.trunk.w0 * .6 + 12); }

  /* ---------- the night and the damp ---------- */
  update(dt, tod) {
    const G = this.G, W = this.weather, R = this.R;
    W.timer -= dt;
    if (W.timer <= 0) {
      const next = { clear: 'cloudy', cloudy: R() < .55 ? 'rain' : 'clear', rain: 'clearing', clearing: 'clear' }[W.state];
      W.state = next; W.timer = { clear: 90 + R() * 120, cloudy: 25 + R() * 25, rain: 40 + R() * 40, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { clear: .12, cloudy: .7, rain: 1, clearing: .4 }[W.state], tr = W.state === 'rain' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.rain += (tr - W.rain) * (1 - Math.exp(-dt * .5));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    const night = nightAmount(tod);
    const target = clamp(.25 + night * .38 + W.rain * .7 + W.cloud * .1, 0, 1);
    this.humid += (target - this.humid) * (1 - Math.exp(-dt * .25));

    /* fruit: ripe figs drop at night; the ground keeps a few fruits */
    this.fruitClock -= dt;
    if (this.fruitClock <= 0) {
      this.fruitClock = 9 + R() * 10;
      const hanging = this.fruits.filter(f => f.hanging);
      if (night > .4 && hanging.length && R() < .6) { const f = pick(hanging); f.hanging = false; f.falling = true; f.vy = 0; f.path = null; }
      if (this.groundFruits().length < 4) this.dropFruit(pick(['mango', 'guava', 'fig']), pick(this.trees.filter(t => t.kind !== 'young')).x + (R() - .5) * 420);
      for (const T of this.trees) if (T.kind === 'fig' && this.fruits.filter(f => f.hanging).length < 6) { const p = pick(T.paths.slice(1)); this.hang(p, p.len * (.3 + R() * .6)); }
    }
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.age += dt;
      if (f.falling) {
        f.vy += 900 * dt; f.y += f.vy * dt; f.rot += dt * 3;
        const top = this.wood.walkTop(f.x, 6) - FRUIT_KINDS[f.kind].r * .7;
        if (f.y >= top) { f.y = top; f.falling = false; if (f.vy > 300) { Bus.emit('fruitThud', f); G.particles.splat(f.x, f.y, FRUIT_KINDS[f.kind].col2, 8); } f.vy = 0; }
      } else if (f.hanging && f.path) { const p = f.path.at_(f.s); f.x = p.x + Math.sin(G.time * 1.3 + f.s) * 2; f.y = p.y + 12; }
      if (f.bites <= 0) { f.gone = (f.gone || 0) + dt; if (f.gone > 6) this.fruits.splice(i, 1); }
      else if (!f.hanging && !f.falling && f.age > 300 && this.groundFruits().length > 8) f.bites = 0;   /* old fruit rots away */
    }
    /* sticks that were lifted settle back into the leaf litter after a while */
    for (const s of this.sticks) { if (s.t > 0) s.t = Math.max(0, s.t - dt); if (s.flipped) { s.back = (s.back || 0) + dt; if (s.back > 90) { s.flipped = false; s.back = 0; s.hide = pick(['fruit', 'millipede', 'beetle']); } } }

    /* the sibling grubs eat their way slowly through the log */
    for (const g of this.grubs) {
      g.t += dt; g.turn -= dt;
      if (g.turn <= 0) { g.turn = 2 + R() * 5; const back = Math.hypot(g.x - g.hx, g.y - g.hy) > 70; g.goal = back ? Math.atan2(g.hy - g.y, g.hx - g.x) : g.ang + (R() - .5) * 2.4; }
      g.ang = angleLerp(g.ang, g.goal || g.ang, dt * .8);
      const hx = g.x + Math.cos(g.ang) * (g.r + 3), hy = g.y + Math.sin(g.ang) * (g.r + 3);
      const s = this.wood.survey(hx, hy, g.r + 2);
      if (s.sky || s.bark || s.rock || s.hard > 2) { g.ang += Math.PI * .6; continue; }
      const res = this.wood.chew(hx, hy, g.r + 1.5, .35, dt);
      g.r = Math.min(9, g.r + res.food * .004);
      if (this.wood.free(g.x + Math.cos(g.ang) * 1.5, g.y + Math.sin(g.ang) * 1.5, g.r * .8, true)) { g.x += Math.cos(g.ang) * 4 * dt; g.y += Math.sin(g.ang) * 4 * dt; }
    }
    /* critters */
    for (const c of this.critters) {
      if (c.kind === 'millipede') {
        c.ph += dt * 8; c.x += c.dir * c.sp * dt;
        if (c.x > WORLD.logR - 20) c.dir = -1; if (c.x < WORLD.logL + 60) c.dir = 1;
        c.y = this.wood.walkTop(c.x, 6) - 3;
      } else if (c.kind === 'scuttle') {
        c.life -= dt; c.x += c.dir * 60 * dt; c.ph += dt * 14; c.y = this.wood.walkTop(c.x, 6) - 3;
      }
    }
    this.critters = this.critters.filter(c => c.kind !== 'scuttle' || c.life > 0);
    this.updateCoati(dt);
    for (const n of this.npcs) n.update(dt);
    this.npcs = this.npcs.filter(n => !n.gone);
  }

  /* ---------- the coati: sniffs at the log for grubs, never finds the player ---------- */
  startCoati(x) { const c = this.coati; if (c.state !== 'away') return; c.state = 'walk'; c.target = clamp(x, WORLD.logL + 100, WORLD.logR - 60); c.x = c.target + 900; c.dir = -1; c.t = 0; Bus.emit('coati'); }
  updateCoati(dt) {
    const c = this.coati;
    if (c.state === 'away') return;
    c.t += dt; c.legs += dt * 10;
    const wt = this.wood;
    if (c.state === 'walk') { c.x += c.dir * 95 * dt; if (Math.abs(c.x - c.target) < 8) { c.state = 'sniff'; c.t = 0; } }
    else if (c.state === 'sniff') {
      /* digs at the top of the log: shreds a little bark (it really does tear rotten logs apart) */
      if (c.t > 2 && c.t < 9 && this.R() < dt * 6) { const top = wt.topAt(c.x - 30); this.G.particles.dust(c.x - 30, top, '#7a5236', 5, -Math.PI / 2); Bus.emit('coatiDig'); }
      if (c.t > 10) { c.state = 'leave'; c.dir = 1; c.t = 0; Bus.emit('coatiGone'); }
    } else if (c.state === 'leave') { c.x += 110 * dt; if (c.x > WORLD.right + 200) { c.state = 'away'; c.done = true; } }
    c.y = wt.walkTop(c.x, 18);
  }
  /* is the coati's nose near this point right now? */
  coatiNear(x, y) { const c = this.coati; return c.state === 'sniff' && Math.abs(x - (c.x - 30)) < 90 && y - this.wood.topAt(x) < 80; }

  /* ---------- rivals and the female ---------- */
  sendRival(player) {
    this.rivalsSent++;
    const big = player.lengthMM;
    /* the first rival is always a bit smaller than you, later ones may be bigger */
    const len = this.rivalsSent === 1 ? Math.max(60, big - 22) : clamp(big + (this.R() - .55) * 50, 70, 176);
    const n = new NPCBeetle(this, { male: true, len, form: pick(FORM_KEYS), from: player.x > 0 ? -1 : 1 });
    /* it heads for food near the player */
    const fruit = this.fruits.filter(f => f.bites > 0 && !f.falling && !f.hanging).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
    const gx = fruit ? fruit.x + (fruit.x > player.x ? 26 : -26) : clamp(player.x + 120, WORLD.left + 60, WORLD.right - 60);
    n.goal = { x: gx, y: this.wood.walkTop(gx), fruit };
    this.npcs.push(n);
    Bus.emit('rivalComing', n);
    return n;
  }
  sendFemale(player) {
    const n = new NPCBeetle(this, { male: false, len: 62, form: player.form, from: player.x > 0 ? 1 : -1 });
    n.goal = { x: player.x + (player.x > 0 ? -90 : 90), y: 0 };
    this.npcs.push(n);
    return n;
  }
  rival() { return this.npcs.find(n => n.male && !n.leaving && !n.gone); }
  female() { return this.npcs.find(n => !n.male && !n.gone); }
}

/* another beetle: flies in, lands, eats, wrestles, and flies away again */
class NPCBeetle {
  constructor(F, o) {
    this.F = F; this.male = o.male; this.lengthMM = o.len; this.form = o.form;
    this.x = o.from > 0 ? WORLD.right + 80 : WORLD.left - 80; this.y = -700 - F.R() * 300;
    this.vx = 0; this.vy = 0; this.mode = 'fly'; this.face = -o.from; this.flap = 0; this.t = 0; this.walk = 0;
    this.wet = F.humid > .55 ? 1 : 0; this.pose = 0; this.leaving = false; this.gone = false; this.lift = 0;
  }
  get scale() { return this.lengthMM / 150; }
  update(dt) {
    const F = this.F, wt = F.wood;
    this.t += dt;
    if (this.leaveIn !== undefined && this.mode === 'ground') { this.leaveIn -= dt; if (this.leaveIn <= 0) { this.leaveIn = undefined; this.flyAway(); } }
    this.wet += ((F.humid > .55 ? 1 : 0) - this.wet) * (1 - Math.exp(-dt * .25));
    if (this.mode === 'fly') {
      this.flap += dt * 40;
      const g = this.leaving ? { x: this.x + this.face * 600, y: -1500 } : this.goal;
      const dx = g.x - this.x, dy = (g.y - 30) - this.y, d = Math.hypot(dx, dy) || 1;
      const sp = this.leaving ? 260 : clamp(d * 1.2, 60, 230);
      this.vx += (dx / d * sp - this.vx) * (1 - Math.exp(-dt * 2));
      this.vy += (dy / d * sp - this.vy) * (1 - Math.exp(-dt * 2)) + Math.sin(this.t * 7) * 6 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.abs(this.vx) > 10) this.face = sign(this.vx);
      if (this.leaving) { if (this.y < -1300 || this.x < WORLD.left - 200 || this.x > WORLD.right + 200) this.gone = true; return; }
      if (d < 26) { this.mode = 'ground'; this.vx = this.vy = 0; Bus.emit(this.male ? 'rivalLanded' : 'femaleLanded', this); }
    } else if (this.mode === 'ground') {
      const top = wt.walkTop(this.x, 10);
      this.y = top - 11.4 * this.scale;
      const f = this.goal && this.goal.fruit;
      if (f && f.bites > 0 && Math.abs(f.x - this.x) > 22 * this.scale + 8) { this.x += sign(f.x - this.x) * 22 * dt; this.walk += dt * 9; this.face = sign(f.x - this.x); }
      else if (f) this.face = sign(f.x - this.x) || this.face;
    } else if (this.mode === 'tossed') {
      /* lifted and thrown: tumbles, opens its wings and flies off, unhurt */
      this.vy += 700 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin = (this.spin || 0) + dt * 9;
      if (this.t > .7) { this.mode = 'fly'; this.leaving = true; this.spin = 0; this.vy = -200; }
    }
  }
  flyAway() { this.mode = 'fly'; this.leaving = true; this.vy = -180; }
}
