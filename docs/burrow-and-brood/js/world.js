/* ============================================================
   world.js — the ground, the plants above it, and the weather
   ============================================================
   The World owns the soil, two plants (a bean and a milkweed,
   Ladybug Life's plants at the same scale), the aphid herds on
   them, the ladybug who visits and the larva she leaves behind,
   food lying on the ground, an earthworm, the calendar and the
   weather.  The colony (colony.js) and the ants live on top.
   ============================================================ */
'use strict';

const WORLD = { left: -1500, right: 1500, top: -1750, bottom: 1500, queenX: -160, plants: [{ type: 'bean', x: 560 }, { type: 'milkweed', x: -1080, height: 1050 }] };

/* ---------- walking along a plant's stems (ants, the larva, the player) ----------
   w: { seg, t, dir, route } ; returns true if it moved */
const PlantWalk = {
  moveAlong(w, P, distance, choose) {
    let remaining = Math.abs(distance), d = sign(distance), guard = 0;
    while (remaining > 0 && guard++ < 8) {
      const seg = P.segs[w.seg];
      const nt = w.t + d * remaining / seg.len;
      if (nt >= 0 && nt <= 1) { w.t = nt; remaining = 0; break; }
      const node = d > 0 ? seg.b : seg.a;
      remaining -= d > 0 ? (1 - w.t) * seg.len : w.t * seg.len;
      const opts = P.branchesAt(node, w.seg);
      const next = choose(node, opts);
      if (next < 0) { w.t = d > 0 ? 1 : 0; break; }
      const ns = P.segs[next];
      w.seg = next;
      if (ns.a === node) { w.t = 0; d = 1; } else { w.t = 1; d = -1; }
    }
    w.dir = d;
  },
  goTo(w, P, seg, t) {
    const path = P.route(w.seg, seg);
    if (path === null) return false;
    w.route = { path, seg, t };
    return true;
  },
  /* follow w.route; returns 'done' when there */
  follow(w, P, step) {
    const r = w.route; if (!r) return 'done';
    const seg = P.segs[w.seg];
    if (w.seg === r.seg) {
      const diff = (r.t - w.t) * seg.len;
      if (Math.abs(diff) < 2) { w.route = null; return 'done'; }
      this.moveAlong(w, P, sign(diff) * Math.min(Math.abs(diff), step), () => -1);
      return 'moving';
    }
    while (r.path.length && r.path[0] !== seg.a && r.path[0] !== seg.b) r.path.shift();
    if (!r.path.length) { w.route = null; return 'done'; }
    const d = r.path[0] === seg.b ? 1 : -1;
    this.moveAlong(w, P, d * step, (node, opts) => {
      r.path.shift();
      const after = r.path[0];
      if (after === undefined) return opts.includes(r.seg) ? r.seg : -1;
      const s = P.segBetween(node, after);
      return opts.includes(s) ? s : -1;
    });
    return 'moving';
  },
  /* steer by keyboard direction (ix, iy): the Ladybug Life rule */
  steer(w, P, ix, iy, step) {
    const p = P.posOn(w.seg, w.t, false);
    const dot = ix * p.tx + iy * p.ty;
    const atNode = w.t < .005 || w.t > .995;
    let d = 0;
    if (Math.abs(dot) > .12) d = dot > 0 ? 1 : -1;
    else if (atNode) d = w.t < .5 ? -1 : 1;
    else {
      const seg = P.segs[w.seg];
      const score = (node) => { let best = -1; for (const id of P.branchesAt(node, w.seg)) { const o = P.outDir(id, node); best = Math.max(best, o[0] * ix + o[1] * iy); } return best; };
      const sa = score(seg.a), sb = score(seg.b);
      if (Math.max(sa, sb) > .3) d = sb >= sa ? 1 : -1;
    }
    if (!d) return false;
    const before = w.t, segBefore = w.seg;
    this.moveAlong(w, P, d * step, (node, opts) => {
      let best = -1, bd = -0.15;
      for (const id of opts) { const o = P.outDir(id, node); const dd = o[0] * ix + o[1] * iy; if (dd > bd) { bd = dd; best = id; } }
      return best;
    });
    return w.t !== before || w.seg !== segBefore;
  },
  /* world position and heading of a walker */
  place(w, P) {
    const p = P.posOn(w.seg, w.t);
    const side = w.side || 1;
    return { x: p.x - p.ty * (p.w * .5 + 2) * side, y: p.y + p.tx * (p.w * .5 + 2) * side, ang: Math.atan2(p.ty * w.dir, p.tx * w.dir), nx: p.ty * side, ny: -p.tx * side };
  }
};

/* ============================================================
   APHIDS — the herd on one plant
   ============================================================ */
class AphidHerd {
  constructor(plant, world) {
    this.plant = plant; this.world = world;
    this.list = [];
    this.nextId = 1;
    this.birthClock = 6;
    this.max = plant.type.key === 'bean' ? 26 : 18;
    this.seed();
  }
  seed() {
    const P = this.plant, R = mulberry32(P.seed ^ 77);
    const segs = P.segs.filter(s => s.depth >= 1 || s.id > 1);
    for (let k = 0; k < 3; k++) {
      const s = segs[(R() * segs.length) | 0], t0 = .3 + R() * .5;
      for (let i = 0; i < 4; i++) this.add(s.id, clamp(t0 + (R() - .5) * .25, .05, .95), pick(P.type.aphids), .6 + R() * .4);
    }
  }
  add(seg, t, variant, grow = 0) {
    const a = { id: this.nextId++, seg, t, variant, grow, dew: Math.random() * .6, side: Math.random() < .5 ? -1 : 1, x: 0, y: 0, ang: 0, walk: 0, dir: 1 };
    this.list.push(a);
    return a;
  }
  count() { return this.list.length; }
  nearest(x, y, r) {
    let best = null, bd = r;
    for (const a of this.list) { const d = dist(a.x, a.y, x, y); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  /* an ant strokes the aphid with her antennae: a drop of honeydew if one is ready */
  milk(a, extra = 1) {
    if (!a || a.dew < .5) return 0;
    a.dew = 0;
    Bus.emit('milked', a);
    return extra;
  }
  remove(a) { const i = this.list.indexOf(a); if (i >= 0) this.list.splice(i, 1); }
  update(dt, season, farmerSpecies) {
    const info = SEASON_INFO[season];
    if (season === 'winter') { if (this.list.length) this.list.length = 0; return; }
    const P = this.plant;
    /* live births near a mother, faster in spring */
    this.birthClock -= dt * info.aphid;
    if (this.birthClock <= 0) {
      this.birthClock = rnd(7, 12);
      if (this.list.length < this.max * (season === 'autumn' ? .6 : 1)) {
        const m = this.list.length ? pick(this.list) : null;
        if (m) this.add(m.seg, clamp(m.t + rnd(-.08, .08), .03, .97), m.variant, 0);
        else { const s = pick(P.segs.filter(s => s.depth >= 1)) || P.segs[1]; this.add(s.id, rnd(.3, .8), pick(P.type.aphids), .2); }
      }
    }
    const dewRate = (farmerSpecies ? 1.5 : 1) / 13;
    for (const a of this.list) {
      a.grow = Math.min(1, a.grow + dt / 30);
      a.dew = Math.min(1, a.dew + dt * dewRate * (.4 + a.grow * .6));
      const p = P.posOn(a.seg, a.t);
      const off = p.w * .5 + 3;
      a.x = p.x - p.ty * off * a.side; a.y = p.y + p.tx * off * a.side;
      a.ang = Math.atan2(p.ty, p.tx) + (a.side > 0 ? .2 : -.2);
    }
  }
  serialize() { return this.list.map(a => [a.seg, +a.t.toFixed(3), a.variant, +a.grow.toFixed(2), a.side]); }
  restore(arr) { this.list.length = 0; for (const [seg, t, variant, grow, side] of arr || []) if (this.plant.segs[seg]) { const a = this.add(seg, t, variant, grow); a.side = side || 1; } }
}

/* ============================================================
   THE LADYBUG — a visitor who lays eggs, and the larva that hatches
   ============================================================
   state: away → visit (the mother flies in, lays, flies off) →
   eggs → hunt (the larva eats aphids) → falling (bitten off the
   plant) → leaving (scuttles away along the ground) → away.
   Nobody is hurt: the larva just goes and finds another garden.
   ============================================================ */
class Ladybug {
  constructor(world) {
    this.world = world;
    this.state = 'away';
    this.timer = 70;
    this.enabled = true;
    this.hits = 0;
    this.eaten = 0;
  }
  get active() { return this.state === 'hunt' || this.state === 'eggs'; }
  get onPlant() { return this.state === 'hunt'; }
  start(plantId) {
    const W = this.world, P = W.plants[plantId];
    this.plant = P;
    const s = P.segs.filter(s => s.depth >= 1);
    const seg = pick(s.length ? s : P.segs);
    this.egg = { seg: seg.id, t: rnd(.4, .8) };
    const q = P.posOn(this.egg.seg, this.egg.t);
    this.state = 'visit'; this.timer = 0;
    this.fly = { x: W.bounds.right + 200, y: -900, tx: q.x, ty: q.y - 16, phase: 0, open: 1, leave: false };
    Bus.emit('ladybugVisit', this);
  }
  hit(strength) {
    if (this.state !== 'hunt') return false;
    this.hits += strength;
    this.chew = 0;
    this.flinch = .4;
    Bus.emit('enemyBitten', this);
    if (this.hits >= this.world.G.diff().bites) {
      /* let go and tumble off the stem */
      this.state = 'falling';
      const p = PlantWalk.place(this.w, this.plant);
      this.x = p.x; this.y = p.y; this.vx = rnd(-60, 60); this.vy = -40; this.spin = rnd(-6, 6); this.ang = p.ang;
      Bus.emit('enemyShooed', this);
    }
    return true;
  }
  update(dt, season, tod) {
    const W = this.world;
    const warm = season === 'spring' || season === 'summer';
    switch (this.state) {
      case 'away':
        if (!this.enabled || !warm || W.G.colonyPhase() !== 'growing') return;
        this.timer -= dt;
        if (this.timer <= 0) this.start(chance(.7) ? 0 : 1);
        break;
      case 'visit': {
        const f = this.fly; f.phase += dt * 50;
        if (!f.leave) {
          const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
          const sp = Math.min(260, d * 1.5 + 30);
          f.x += dx / (d || 1) * sp * dt; f.y += dy / (d || 1) * sp * dt;
          f.ang = Math.atan2(dy, dx);
          if (d < 6) { this.timer += dt; f.open = Math.max(0, f.open - dt * 3); if (this.timer > 2.4) { f.leave = true; f.open = 1; Bus.emit('ladybugEggs', this); } }
        } else {
          f.x -= 220 * dt; f.y -= 160 * dt; f.ang = Math.atan2(-160, -220);
          if (f.y < -1500) { this.state = 'eggs'; this.timer = 14; }
        }
        break;
      }
      case 'eggs':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'hunt'; this.hits = 0; this.eaten = 0;
          this.w = { seg: this.egg.seg, t: this.egg.t, dir: 1, route: null, side: 1 };
          this.walk = 0; this.chew = 0; this.eatClock = 4; this.flinch = 0;
          Bus.emit('enemy', this);
        }
        break;
      case 'hunt': {
        const P = this.plant, herd = P.herd;
        /* winter (or a grown-up switching her off): she lets go and wanders away */
        if (season === 'winter' || W.G.settings.enemy === false) {
          const p = PlantWalk.place(this.w, P);
          this.x = p.x; this.y = p.y; this.vx = rnd(-40, 40); this.vy = -30; this.spin = rnd(-5, 5); this.ang = p.ang; this.state = 'falling';
          break;
        }
        this.flinch = Math.max(0, (this.flinch || 0) - dt);
        if (this.chew > 0) { this.chew -= dt; if (this.chew <= 0 && this.prey) { herd.remove(this.prey); this.prey = null; this.eaten++; Bus.emit('aphidEaten', this); } }
        else if (this.flinch <= 0) {
          if (!this.w.route || chance(dt * .2)) {
            const a = herd.list.length ? herd.list.reduce((b, a) => (dist(a.x, a.y, this.x || 0, this.y || 0) < dist(b.x, b.y, this.x || 0, this.y || 0) ? a : b)) : null;
            if (a) PlantWalk.goTo(this.w, P, a.seg, a.t);
            else PlantWalk.goTo(this.w, P, pick(P.segs).id, rnd(.2, .8));
          }
          if (PlantWalk.follow(this.w, P, 34 * dt) === 'moving') this.walk += dt * 5;
          this.eatClock -= dt;
          const near = herd.nearest(this.x, this.y, 22);
          if (near && this.eatClock <= 0) { this.prey = near; this.chew = 1.4; this.eatClock = rnd(6, 10); }
        }
        const p = PlantWalk.place(this.w, P);
        this.x = p.x; this.y = p.y; this.ang = angleLerp(this.ang || p.ang, p.ang, 1 - Math.exp(-dt * 8));
        break;
      }
      case 'falling': {
        this.vy += 700 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.ang += this.spin * dt;
        const gy = W.soil.surfaceAt(this.x) - 8;
        if (this.y >= gy) { this.y = gy; this.state = 'leaving'; this.dir = this.x < W.nest().x ? -1 : 1; if (Math.abs(this.x - W.nest().x) > 900) this.dir = this.x < 0 ? -1 : 1; }
        break;
      }
      case 'leaving':
        this.x += this.dir * 70 * dt; this.walk += dt * 9;
        this.y = W.soil.surfaceAt(this.x) - 8; this.ang = this.dir > 0 ? 0 : Math.PI;
        if (this.x < W.bounds.left - 60 || this.x > W.bounds.right + 60) {
          this.state = 'away'; const d = W.G.diff();
          this.timer = rnd(d.enemyEvery[0], d.enemyEvery[1]);
          /* the grown-up's switch wins; on Little kid she only comes back now and then */
          this.enabled = W.G.settings.enemy !== false && (d.enemy !== false || chance(.3));
        }
        break;
    }
  }
}

/* ============================================================
   FOOD on the ground: seeds, crumbs, a beetle, bits of leaf
   ============================================================ */
const FOOD_KINDS = {
  seed: { value: 2, need: 1, r: 7, name: 'seed' },
  crumb: { value: 3, need: 1, r: 8, name: 'crumb' },
  bug: { value: 14, need: 3, r: 26, name: 'beetle' },
  leaf: { value: 2, need: 1, r: 8, name: 'leaf' }
};
class Foods {
  constructor(world) { this.world = world; this.list = []; this.clock = 4; this.nextId = 1; }
  add(kind, x, y, falling) {
    const k = FOOD_KINDS[kind];
    const f = { id: this.nextId++, kind, x, y, vy: 0, falling: !!falling, value: k.value, need: k.need, r: k.r, carriers: [], rot: rnd(-.6, .6), age: 0 };
    this.list.push(f);
    return f;
  }
  remove(f) { const i = this.list.indexOf(f); if (i >= 0) this.list.splice(i, 1); }
  nearest(x, y, r, filter) {
    let best = null, bd = r;
    for (const f of this.list) { if (filter && !filter(f)) continue; const d = dist(f.x, f.y, x, y) - f.r * .5; if (d < bd) { bd = d; best = f; } }
    return best;
  }
  update(dt, season) {
    const W = this.world, info = SEASON_INFO[season];
    /* the more ants go looking, the more they find (the garden is big) */
    const C = W.G.colony, foragers = C ? C.agents.filter(a => a.job === 'forager').length : 0;
    this.clock -= dt * info.food * (1 + foragers * .12);
    if (this.clock <= 0 && season !== 'winter') {
      this.clock = rnd(7, 15);
      if (this.list.length < 9 + Math.min(8, foragers / 3)) {
        const nx = W.nest().x;
        let x = 0; for (let k = 0; k < 8; k++) { x = rnd(W.bounds.left + 120, W.bounds.right - 120); if (Math.abs(x - nx) > 180) break; }
        const r = Math.random();
        /* autumn seeds rain from the plants' pods */
        if (season === 'autumn' && r < .5) { const P = pick(W.plants); const f = pick(P.flowers); this.add('seed', f.x + P.sway(f.x, f.y), f.y, true); }
        else this.add(r < .5 ? 'seed' : r < .82 ? 'crumb' : 'bug', x, -700, true);
      }
    }
    const S = W.soil;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.age += dt;
      /* food nobody fetches is taken by someone else after a while (and never lies off the edge) */
      f.x = clamp(f.x, S.X0 + 80, S.X1 - 80);
      if (f.age > 200 && !f.carriers.length && !f.falling) { this.list.splice(i, 1); continue; }
      if (f.falling) {
        f.vy += 600 * dt; f.y += f.vy * dt; f.rot += dt * 3;
        const gy = W.soil.surfaceAt(f.x) - f.r * (f.kind === 'bug' ? .55 : .6);
        if (f.y >= gy) { f.y = gy; f.falling = false; f.vy = 0; Bus.emit('foodLanded', f); }
      } else if (!f.carriers.length) {
        /* stay sitting on the ground even if it changes under the food */
        const gy = W.soil.surfaceAt(f.x) - f.r * (f.kind === 'bug' ? .55 : .6);
        if (Math.abs(f.y - gy) > 2) f.y = lerp(f.y, gy, 1 - Math.exp(-dt * 10));
      }
    }
  }
}

/* ============================================================
   THE EARTHWORM — wanders through the topsoil making a burrow
   ============================================================ */
class Worm {
  constructor(world, R) {
    this.world = world;
    this.x = lerp(world.bounds.left + 300, world.bounds.right - 300, R());
    if (Math.abs(this.x - WORLD.queenX) < 300) this.x += 600;
    this.y = 140 + R() * 60;
    this.a = R() * TAU;
    this.body = [];
    for (let i = 0; i < 14; i++) this.body.push([this.x - i * 4, this.y]);
    this.clock = 0;
  }
  update(dt, raining) {
    const S = this.world.soil;
    this.clock += dt;
    /* in the rain worms come up toward the surface (real!) */
    const wantY = raining ? 30 : 160;
    this.a += (Math.random() - .5) * dt * 2 + Math.sign(wantY - this.y) * Math.sign(Math.sin(this.a)) * dt * .3;
    const nx = this.x + Math.cos(this.a) * 9 * dt, ny = this.y + Math.sin(this.a) * 9 * dt;
    const g = S.ground0(nx);
    if (ny < g + 26 || ny > 330 || Math.abs(nx - WORLD.queenX) < 120 || !isFinite(MAT_INFO[S.matAt(nx + Math.cos(this.a) * 6, ny + Math.sin(this.a) * 6)].hard || 0)) { this.a += Math.PI * .6; return; }
    this.x = nx; this.y = ny;
    const h = this.body[0];
    if (dist(h[0], h[1], this.x, this.y) > 4) {
      this.body.unshift([this.x, this.y]); this.body.pop();
      /* a thin burrow behind the head */
      const c = S.col(this.x), r = S.row(this.y);
      if (S.inside(c, r)) { const i = S.idx(c, r); if (S.mat[i] === MAT.LOAM) S.set(i, MAT.AIR); }
    }
  }
}

/* ============================================================
   WEATHER (from Ladybug Life): clear → cloudy → rain → clearing
   ============================================================ */
class Weather {
  constructor(world, rng) {
    this.world = world;
    this.state = 'clear'; this.timer = rnd(60, 110);
    this.rain = 0; this.cloud = 0; this.rainbow = 0; this.gust = 0; this.gustTimer = rnd(20, 45); this.snow = 0;
    this.firstRain = false;
  }
  update(dt, tod, season) {
    const info = SEASON_INFO[season];
    this.timer -= dt;
    if (this.timer <= 0) {
      switch (this.state) {
        case 'clear':
          if (season !== 'winter' && chance(info.rain)) { this.state = 'cloudy'; this.timer = rnd(8, 14); }
          else this.timer = rnd(50, 100);
          break;
        case 'cloudy': this.state = 'rain'; this.timer = rnd(16, 26); if (!this.firstRain) { this.firstRain = true; Bus.emit('fact', 'rain'); } Bus.emit('weather', 'rain'); break;
        case 'rain': this.state = 'clearing'; this.timer = rnd(25, 40); Bus.emit('weather', 'clearing'); break;
        case 'clearing': this.state = 'clear'; this.timer = rnd(70, 150); break;
      }
    }
    const k = 1 - Math.exp(-dt * .6);
    this.cloud += (((this.state === 'cloudy' || this.state === 'rain') ? 1 : (this.state === 'clearing' ? .35 : 0)) - this.cloud) * k;
    this.rain += ((this.state === 'rain' ? 1 : 0) - this.rain) * (1 - Math.exp(-dt * .8));
    const day = tod > .3 && tod < .78;
    this.rainbow += (((this.state === 'clearing' && day) ? 1 : 0) - this.rainbow) * (1 - Math.exp(-dt * .5));
    this.snow += ((season === 'winter' ? 1 : 0) - this.snow) * (1 - Math.exp(-dt * .3));
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) { this.gustTimer = rnd(25, 60) * (this.state === 'rain' ? .5 : 1); this.gustLeft = rnd(2.2, 4); Bus.emit('gust'); }
    if (this.gustLeft > 0) { this.gustLeft -= dt; this.gust = Math.min(1, this.gust + dt * 2.5); }
    else this.gust = Math.max(0, this.gust - dt * 1.2);
  }
  get raining() { return this.rain > .4; }
}

/* ============================================================
   THE WORLD
   ============================================================ */
class World {
  constructor(G, seed) {
    this.G = G;
    this.seed = seed;
    const R = mulberry32(seed ^ 0xa11);
    this.bounds = { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom };
    this.plants = WORLD.plants.map((l, i) => new Plant((seed + (i + 1) * 7919) >>> 0, { type: l.type, x: l.x, id: i, height: l.height }));
    this.soil = new Soil(seed, { plants: this.plants.map(p => p.ox), clearAt: [WORLD.queenX] });
    for (const P of this.plants) P.herd = new AphidHerd(P, this);
    this.ladybug = new Ladybug(this);
    this.foods = new Foods(this);
    this.worm = new Worm(this, R);
    this.weather = new Weather(this, R);
    /* a new kingdom starts in summer, on flying-ant day */
    this.dayOfYear = DAYS_PER_SEASON + 1; this.year = 1;
    this.season = 'summer'; this.seasonT = 0; this.seasonChanged = false;
    /* a few things to find straight away */
    for (const [k, x] of [['seed', WORLD.queenX + 260], ['crumb', WORLD.queenX - 330], ['seed', WORLD.queenX + 520], ['bug', WORLD.queenX + 760]]) this.foods.add(k, x, this.soil.surfaceAt(x) - FOOD_KINDS[k].r * .6, false);
  }

  nest() { const c = this.G.colony; return c && c.entrance ? c.entrance : { x: WORLD.queenX, y: 0 }; }
  plantAt(id) { return this.plants[id] || this.plants[0]; }
  nearestPlant(x, y, maxDist) {
    let best = null;
    for (const P of this.plants) { const n = P.nearest(x, y, maxDist); if (n && (!best || n.d < best.d)) best = n; }
    return best;
  }
  bareness() {
    if (this.season === 'autumn') return smoothstep(.35, 1, this.seasonT) * .7;
    if (this.season === 'winter') return .85;
    if (this.season === 'spring') return (1 - smoothstep(0, .5, this.seasonT)) * .5;
    return 0;
  }
  endDay() {
    this.dayOfYear++;
    if (this.dayOfYear > SEASONS.length * DAYS_PER_SEASON) { this.dayOfYear = 1; this.year++; }
    this.updateSeason();
  }
  updateSeason() {
    const s = SEASONS[Math.min(3, Math.floor((this.dayOfYear - 1) / DAYS_PER_SEASON))];
    this.seasonT = ((this.dayOfYear - 1) % DAYS_PER_SEASON) / DAYS_PER_SEASON;
    if (s !== this.season) {
      const was = this.season;
      this.season = s; this.seasonChanged = true;
      if (was === 'winter') for (const P of this.plants) P.herd.seed();
      Bus.emit('season', s);
    }
  }
  update(dt, tod) {
    const G = this.G;
    for (const P of this.plants) { P.time = G.time; P.gust = this.weather.gust; }
    this.weather.update(dt, tod, this.season);
    if (this.weather.rain > .05) this.soil.rain(dt, this.weather.rain, .1 * G.diff().flood);
    this.soil.update(dt);
    const farmer = G.speciesDef().special === 'farmer';
    for (const P of this.plants) P.herd.update(dt, this.season, farmer);
    this.ladybug.update(dt, this.season, tod);
    this.foods.update(dt, this.season);
    this.worm.update(dt, this.weather.raining);
  }
}
