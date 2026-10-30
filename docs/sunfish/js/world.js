/* ============================================================
   world.js — the open Pacific, the kelp coast, and who lives there
   ============================================================
   THE SURFACE  the tide and the waves (bigger in a storm), a gentle
                current, the plankton kept alive around a baby
                (copepods, krill, glowing dinoflagellates; near the
                top at night and deeper by day), sister hatchlings, a
                school of anchovies, comb jellies, a gull that dips at
                the top (or lands on a basking sunfish and pecks its
                sea lice off).
   THE OPEN SEA the young sunfish's school and the krill and little
                salps it eats; the jellies a grown sunfish dives for
                (moon jellies, sea nettles, comb jellies, salp chains:
                deep by day, higher at night); visitors that always
                miss (mahi-mahi, tuna, a sea lion, orcas, a blue
                shark) and a leatherback turtle that only passes; a
                boat that crosses the top and slows down for fins; a
                fishing net whose fishers let a sunfish go.
   THE COAST    giant kelp, garibaldi and other reef fish, and the
                cleaning station: señoritas and halfmoon fish that
                pick a visiting sunfish clean.
   THE WARM SEA the other grown sunfish, a mate with hearts.
   Nothing here ever hurts anybody.
   ============================================================ */
'use strict';

const PLANKTON_KINDS = {
  copepod: { val: 1, r: 1.5 },
  krill:   { val: 2, r: 2.0 },
  dino:    { val: 0, r: 1.0 }              /* not food: it glows when bumped */
};
/* drifting food for a young sunfish (krill, little salps) and a grown one (jellies) */
const FOOD_KINDS = {
  krill:   { val: 2, r: 3, name: 'krill', who: 'juvenile' },
  salplet: { val: 3, r: 4, name: 'little salp', who: 'juvenile' },
  moon:    { val: 7, r: 11, name: 'moon jelly', who: 'mola' },
  comb:    { val: 5, r: 8, name: 'comb jelly', who: 'mola' },
  nettle:  { val: 9, r: 13, name: 'sea nettle', who: 'mola' },
  salp:    { val: 12, r: 20, name: 'salp chain', who: 'mola' }
};
/* the visitors: they come, lunge (or just pass), always miss, and leave */
const VISITOR_KINDS = {
  dorado:  { name: 'mahi-mahi', len: 60, speed: 120, lunge: true },
  tuna:    { name: 'bluefin tuna', len: 80, speed: 130, lunge: true },
  sealion: { name: 'sea lion', len: 85, speed: 110, lunge: true },
  orca:    { name: 'orca', len: 270, speed: 80, lunge: true },
  shark:   { name: 'blue shark', len: 110, speed: 90, lunge: true },
  turtle:  { name: 'leatherback turtle', len: 75, speed: 40, lunge: false }
};

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground;
    this.t = 0;
    /* giant kelp: rooted on the rocks, reaching up to a canopy at the top */
    this.kelp = [];
    for (let x = WORLD.kelpL + 20; x < WORLD.kelpR + 150; x += 26 + R() * 40) {
      if (Math.abs(x - WORLD.stationX) < 70) continue;          /* a clear pool at the cleaning station */
      const g = S.walkTop(x, 4); this.kelp.push({ x, root: g, h: g + 10, ph: R() * TAU, seed: (R() * 1e9) | 0, w: 3 + R() * 2.5 });
    }
    /* the cleaning station: a big rock in a clearing, with its cleaner fish */
    const sg = S.walkTop(WORLD.stationX, 8);
    this.station = { x: WORLD.stationX, y: sg - 70, floor: sg };
    this.cleaners = [];
    for (let k = 0; k < 9; k++) this.cleaners.push({ kind: k < 6 ? 'senorita' : 'halfmoon', x: WORLD.stationX + (R() - .5) * 140, y: sg - 20 - R() * 60, ox: (R() - .5) * 2, oy: (R() - .5) * 2, dir: R() < .5 ? -1 : 1, ph: R() * TAU, s: k < 6 ? .55 + R() * .2 : .7 + R() * .2 });
    /* reef fish in the kelp: bright orange garibaldi, rockfish, a few perch */
    const fishCols = [['#ff8a1c', '#c8500a'], ['#c06850', '#5a2a20'], ['#9ab0a0', '#40584c'], ['#d0b070', '#6a5030']];
    this.smallFish = [];
    for (let k = 0; k < 22; k++) { const c = fishCols[k % fishCols.length], x = lerp(WORLD.kelpL, WORLD.kelpR + 400, R()); this.smallFish.push({ x, y: S.walkTop(x, 4) - 14 - R() * 90, dir: R() < .5 ? -1 : 1, sp: 10 + R() * 14, s: .55 + R() * .5, ph: R() * TAU, col: c[0], col2: c[1], home: x }); }
    this.gull = { state: 'hover', x: 0, y: -60, t: 0, ph: R() * TAU, target: null, cool: 30 };
    this.boat = { state: 'away', x: 0, dir: 1, t: 0, slow: 0, done: 0 };
    this.net = { state: 'away', x: 0, y: 0, t: 0, done: false, w: 130, h: 170, holding: false };
    this.weather = { state: 'calm', timer: 60 + R() * 60, storm: 0, cloud: .12, gust: 0, snow: 0 };
    this.season = 'summer'; this.temp = 17;
    this.plankton = []; this.sibs = []; this.combs = []; this.school = null;
    this.food = []; this.foodClock = 0;
    this.juvs = []; this.schoolC = null;             /* a young sunfish's school */
    this.visitors = [];
    this.mates = [];                                  /* grown sunfish in the warm sea */
    this.babies = [];                                 /* eggs let go, drifting up */
    this.mum = null;                                  /* the mother who let the egg go */
    for (let k = 0; k < 5; k++) this.combs.push(this.makeComb(lerp(WORLD.left + 400, WORLD.warmR, R()), 30 + R() * 160));
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  /* ============================================================
     THE SURFACE
     ============================================================ */
  seaLevel() { return -tideAt(this.G.tod) * 4; }
  surfaceY(x) { const t = this.t, st = 1 + this.weather.storm * 3; return this.seaLevel() + st * (2.2 * Math.sin(x * .03 - t * 1.6) + 1.4 * Math.sin(x * .071 + t * 2.1)); }
  inWater(x, y) { return y > this.seaLevel() && !this.ground.solidAt(x, y); }
  floorAt(x) { return Math.min(this.ground.walkTop(x, 6), 2400); }
  /* the swell: 0..1, a slow pulse (the eggs go free on the pulse) */
  swash() { const u = (this.t % 5.6) / 5.6; return u < .45 ? smoothstep(0, .45, u) : 1 - smoothstep(.45, 1, u); }
  /* the sea's temperature at a depth (°C): warm at the top, fridge-cold in the deep; the warm sea is warmer */
  tempAt(x, y) { return seaTempAt(y, this.temp + (x < WORLD.warmR ? 6 : 0)); }
  inWarmSea(x) { return x < WORLD.warmR; }
  /* the water's movement at a point (units per second) */
  current(x, y) {
    const t = this.t, depthK = clamp(1 - y / 600, .2, 1);
    const a = (Math.sin(x * .004 + t * .05) + Math.sin(y * .006 - t * .04 + 1.3)) * 1.6;
    let vx = Math.cos(a) * 4 * depthK, vy = Math.sin(a) * 2.2;
    vx += Math.sin(t * .4) * 6 * this.weather.storm * depthK;
    return [vx, vy];
  }
  makeComb(x, y) { const R = this.R; return { x, y, r: 10 + R() * 8, ph: R() * TAU, vx: 0, vy: 0, hitDone: false }; }

  /* plankton is kept alive in a ring around a baby sunfish */
  updatePlankton(dt, p) {
    const night = nightAmount(this.G.tod), R = this.R;
    const band = night > .5 ? [6, 110] : [60, 240];
    const want = p.stage === 'larva' ? 90 : 0;
    const L = this.plankton;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.ph += dt;
      const [cx, cy] = this.current(q.x, q.y);
      q.x += cx * .6 * dt + Math.sin(q.ph * .7) * 1.5 * dt; q.y += cy * .6 * dt + Math.cos(q.ph * .5) * 1.2 * dt;
      q.glow = Math.max(0, q.glow - dt * 1.5);
      const lvl = this.seaLevel() + 3;
      if (q.y < lvl) q.y = lvl;
      if (Math.hypot(q.x - p.x, q.y - p.y) > 330 || q.eaten) L.splice(i, 1);
    }
    let tries = 0;
    while (L.length < want && tries++ < 400) {
      const a = R() * TAU, d = R() < .7 ? 40 + R() * 100 : 150 + R() * 150;
      let x = p.x + Math.cos(a) * d * 1.4, y = p.y + Math.sin(a) * d * .7;
      if (R() < .5) y = lerp(band[0], band[1], R());
      y = clamp(y, this.seaLevel() + 4, 600);
      if (Math.hypot(x - p.x, y - p.y) < 36) continue;
      const k = R(), kind = k < .6 ? 'copepod' : k < .84 ? 'krill' : 'dino';
      L.push({ x, y, kind, ph: R() * TAU, vx: 0, vy: 0, glow: 0, rot: R() * TAU, eaten: false });
      if (kind === 'copepod' && R() < .3) for (let j = 0; j < 4; j++) L.push({ x: x + (R() - .5) * 26, y: clamp(y + (R() - .5) * 18, this.seaLevel() + 4, 600), kind: 'copepod', ph: R() * TAU, vx: 0, vy: 0, glow: 0, rot: R() * TAU, eaten: false });
    }
  }
  /* sister hatchlings drifting along with you */
  updateSibs(dt, p) {
    if (p.stage !== 'larva') { this.sibs.length = 0; return; }
    const R = this.R;
    while (this.sibs.length < 12) { const a = R() * TAU, d = 50 + R() * 150; this.sibs.push({ x: p.x + Math.cos(a) * d, y: clamp(p.y + Math.sin(a) * d * .6, 10, 400), vx: 0, vy: 0, ph: R() * TAU, turn: 0, a: R() * TAU, z: p.zinstar }); }
    for (let i = this.sibs.length - 1; i >= 0; i--) {
      const s = this.sibs[i];
      s.ph += dt * 6; s.turn -= dt;
      if (s.turn <= 0) { s.turn = .6 + R() * 1.4; s.a += (R() - .5) * 2; }
      const [cx, cy] = this.current(s.x, s.y);
      s.vx += (Math.cos(s.a) * 10 - s.vx) * dt * 2; s.vy += (Math.sin(s.a) * 6 - s.vy) * dt * 2;
      s.x += (s.vx + cx * .8) * dt; s.y += (s.vy + cy * .8) * dt;
      if (s.y < this.seaLevel() + 4) { s.y = this.seaLevel() + 4; s.a = Math.abs(s.a); }
      if (Math.hypot(s.x - p.x, s.y - p.y) > 380) this.sibs.splice(i, 1);
    }
  }
  /* a school of anchovies sweeps past a baby (they tumble it, never more) */
  startSchool(p) {
    if (this.school) return;
    const dir = this.R() < .5 ? 1 : -1, n = 34, R = this.R;
    this.school = { dir, x: p.x - dir * 380, y: p.y + (R() - .5) * 30, t: 0, fish: [] };
    for (let k = 0; k < n; k++) this.school.fish.push({ dx: (R() - .5) * 170, dy: (R() - .5) * 60, ph: R() * TAU, s: .7 + R() * .4 });
    Bus.emit('anchovy', this.school);
  }
  /* the gull: hovers over the top by day; dips at a baby near the top, or lands on a basking sunfish */
  dip(p) { const b = this.gull; if (b.state !== 'hover') return false; b.state = 'dive'; b.t = 0; b.from = { x: p.x - 200, y: -140 }; b.target = { x: p.x, y: this.seaLevel() + 2 }; Bus.emit('gullDip', b); return true; }
  landGull(p) { const b = this.gull; if (b.state !== 'hover') return false; b.state = 'land'; b.t = 0; b.from = { x: b.x, y: b.y }; b.pecks = 0; Bus.emit('gullLand', b); return true; }
  updateGull(dt, p) {
    const b = this.gull; b.t += dt; b.ph += dt;
    if (b.state === 'hover') { b.x = p.x + Math.cos(b.ph * .2) * 260; b.y = -100 + Math.sin(b.ph * .9) * 12; }
    else if (b.state === 'dive') {
      const u = clamp(b.t / 1.4, 0, 1);
      b.x = lerp(b.from.x, b.target.x + 180, u); b.y = lerp(b.from.y, b.target.y, Math.sin(u * Math.PI));
      if (u > .48 && !b.hit) { b.hit = true; Bus.emit('gullPass', b); }
      if (u >= 1) { b.state = 'hover'; b.hit = false; }
    } else if (b.state === 'land') {
      /* fly down onto the side of the basking sunfish, then peck */
      const spot = p.gullSpot ? p.gullSpot() : { x: p.x, y: p.y - 10 }, u = clamp(b.t / 1.8, 0, 1);
      b.x = lerp(b.from.x, spot.x, u); b.y = lerp(b.from.y, spot.y, u) - Math.sin(u * Math.PI) * 30;
      if (u >= 1) { b.state = 'peck'; b.t = 0; }
      if (p.mode !== 'bask') { b.state = 'leave'; b.t = 0; b.from = { x: b.x, y: b.y }; }
    } else if (b.state === 'peck') {
      const spot = p.gullSpot ? p.gullSpot() : { x: p.x, y: p.y - 10 };
      b.x = spot.x; b.y = spot.y;
      if (b.t > .7) { b.t = 0; b.pecks++; Bus.emit('gullPeck', b); p.peckLice && p.peckLice(); }
      if (b.pecks >= 6 || p.mode !== 'bask') { b.state = 'leave'; b.t = 0; b.from = { x: b.x, y: b.y }; Bus.emit('gullDone', b); }
    } else if (b.state === 'leave') {
      const u = clamp(b.t / 2, 0, 1);
      b.x = b.from.x + u * 260; b.y = lerp(b.from.y, -110, u);
      if (u >= 1) b.state = 'hover';
    }
  }
  updateSea(dt, p) {
    this.updatePlankton(dt, p);
    this.updateSibs(dt, p);
    /* comb jellies: keep a couple drifting near a baby */
    if (p.stage === 'larva') {
      const near = this.combs.filter(j => Math.abs(j.x - p.x) < 600);
      if (near.length < 2) { const side = this.R() < .5 ? -1 : 1; this.combs.push(this.makeComb(p.x + side * (260 + this.R() * 260), clamp(p.y + (this.R() - .5) * 100, 10, 260))); }
    }
    for (let i = this.combs.length - 1; i >= 0; i--) {
      const j = this.combs[i];
      j.ph += dt * 1.2;
      const [cx, cy] = this.current(j.x, j.y); j.vx += (cx * .7 - j.vx) * dt * .5; j.vy += (cy * .4 + Math.sin(j.ph) * 3 - j.vy) * dt;
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.y = clamp(j.y, this.seaLevel() + j.r, 400);
      if (Math.abs(j.x - p.x) > 2400) this.combs.splice(i, 1);
    }
    const s = this.school;
    if (s) {
      s.t += dt; s.x += s.dir * 70 * dt; s.y += Math.sin(s.t * 1.2) * 16 * dt;
      for (const f of s.fish) f.ph += dt * 9;
      if ((s.x - p.x) * s.dir > 480) { this.school = null; Bus.emit('schoolGone'); }
    }
  }
  /* a mother lets her eggs go: a cloud of tiny eggs drifting up */
  babyBurst(x, y, n = 60) {
    const R = this.R;
    for (let k = 0; k < n; k++) { const a = -Math.PI * .5 + (R() - .5) * 2.8, sp = 14 + R() * 40; this.babies.push({ x: x + (R() - .5) * 20, y: y + (R() - .5) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, t: R() * .4, ph: R() * TAU }); }
  }
  updateBabies(dt) {
    for (let i = this.babies.length - 1; i >= 0; i--) {
      const e = this.babies[i]; e.t += dt;
      e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-dt * 1.5); e.vy = e.vy * Math.exp(-dt * 1.2) - 6 * dt;
      if (e.y < this.seaLevel() + 4) e.y = this.seaLevel() + 4;
      if (e.t > 9) this.babies.splice(i, 1);
    }
  }

  /* ============================================================
     THE OPEN SEA: food, the school, the visitors
     ============================================================ */
  foodBand(p) {
    const night = nightAmount(this.G.tod) > .5;
    if (p.stage === 'juvenile') return { want: 28, kinds: ['krill', 'krill', 'krill', 'salplet'], band: [16, 170], spread: 520 };
    if (p.stage === 'mola' && !p.flags.journey) return { want: 16, kinds: ['moon', 'moon', 'comb', 'nettle', 'salp'], band: night ? [110, 380] : [250, 740], spread: 900 };
    if (p.stage === 'mola') return { want: 6, kinds: ['moon', 'comb'], band: [40, 300], spread: 800 };
    return { want: 0 };
  }
  spawnFood(kind, x, y) { const R = this.R, F = FOOD_KINDS[kind]; const f = { kind, x, y, r: F.r * (.85 + R() * .3), val: F.val, ph: R() * TAU, vx: 0, vy: 0, eaten: false, gone: 0, rot: (R() - .5) * .6 }; this.food.push(f); return f; }
  updateFood(dt, p) {
    const B = this.foodBand(p), R = this.R;
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i]; f.ph += dt;
      if (f.eaten) { f.gone += dt; if (f.gone > .6) this.food.splice(i, 1); continue; }
      const [cx, cy] = this.current(f.x, f.y);
      f.x += cx * .5 * dt; f.y += (cy * .3 + Math.sin(f.ph * 1.3) * 2.5) * dt;
      /* up at night, down by day (the jellies migrate too) */
      if (B.band && f.u !== undefined) f.y += (lerp(B.band[0], B.band[1], f.u) - f.y) * dt * .025;
      const fl = this.floorAt(f.x) - f.r - 6; if (f.y > fl) f.y = fl;
      if (f.y < this.seaLevel() + f.r * .5) f.y = this.seaLevel() + f.r * .5;
      if (!B.want || FOOD_KINDS[f.kind].who !== p.stage || Math.abs(f.x - p.x) > (B.spread || 600) * 1.7 || Math.abs(f.y - p.y) > 1100) this.food.splice(i, 1);
    }
    if (!B.want) return;
    const live = this.food.filter(f => !f.eaten).length;
    for (let k = 0; live + k < B.want && k < 6; k++) {
      const kind = pick(B.kinds), side = R() < (p.stage === 'juvenile' ? .3 : .5) ? -1 : 1;   /* a young one's food is mostly coastward */
      const cx0 = p.stage === 'juvenile' && this.schoolC ? this.schoolC.x : p.x;
      const x = clamp(cx0 + side * (60 + R() * B.spread), WORLD.left + 300, WORLD.beachX - 400), deepK = kind === 'salp' || kind === 'nettle' ? .35 : 0;
      let y = lerp(B.band[0], B.band[1], clamp(R() + deepK, 0, 1));
      const fl = this.floorAt(x) - 30; if (y > fl) { if (fl < B.band[0] * .6) continue; y = fl - R() * 60; }
      if (kind === 'krill' && R() < .5) for (let j = 0; j < 4; j++) this.spawnFood('krill', x + (R() - .5) * 40, y + (R() - .5) * 24);
      this.spawnFood(kind, x, y).u = clamp((y - B.band[0]) / (B.band[1] - B.band[0]), 0, 1);
    }
  }
  foodNear(x, y, reach) { let best = null, bd = 1e9; for (const f of this.food) { if (f.eaten) continue; const d = Math.hypot(f.x - x, f.y - y) - f.r; if (d < reach && d < bd) { bd = d; best = f; } } return best; }

  /* the young sunfish's school: a handful of friends round a slowly wandering centre */
  makeSchool(p) {
    const R = this.R;
    this.schoolC = { x: p.x + 50, y: clamp(p.y, 50, 150), a: 0, t: 0 };
    this.juvs = [];
    for (let k = 0; k < 7; k++) this.juvs.push({ x: p.x + (R() - .5) * 160, y: clamp(p.y + (R() - .5) * 80, 20, 200), vx: 0, vy: 0, ph: R() * TAU, s: .8 + R() * .35, ox: (R() - .5) * 140, oy: (R() - .5) * 70, form: R() < .8 ? 'normal' : pick(FORM_KEYS), face: 1, leaving: false });
    Bus.emit('schoolMade', this.schoolC);
  }
  updateSchool(dt, p) {
    const C = this.schoolC; if (!C) return;
    const juv = p.stage === 'juvenile', R = this.R;
    C.t += dt; C.a += (Math.sin(C.t * .31) + Math.sin(C.t * .17 + 2)) * dt * .4;
    const d = Math.hypot(p.x - C.x, p.y - C.y);
    let vx = Math.cos(C.a) * 10 + 22, vy = Math.sin(C.a) * 6;   /* the school drifts east, towards the coast */
    if (juv && d > 110) { vx += (p.x - C.x) / d * 34; vy += (p.y - C.y) / d * 26; }
    C.x += vx * dt; C.y = clamp(C.y + vy * dt, 40, 180);
    p.inSchool = juv && d < 140;
    for (const j of this.juvs) {
      j.ph += dt * 7;
      const tx = juv ? C.x + j.ox + Math.sin(C.t * .7 + j.ph * .05) * 20 : j.x + (j.x > p.x ? 1 : -1) * 300, ty = juv ? C.y + j.oy : j.y - 40;
      j.vx += ((tx - j.x) * .9 - j.vx) * dt * 1.4; j.vy += ((ty - j.y) * .9 - j.vy) * dt * 1.4;
      const sp = Math.hypot(j.vx, j.vy), mx = juv ? 70 : 50; if (sp > mx) { j.vx *= mx / sp; j.vy *= mx / sp; }
      j.x += j.vx * dt; j.y = clamp(j.y + j.vy * dt, this.seaLevel() + 8, 400);
      if (Math.abs(j.vx) > 3) j.face = sign(j.vx);
    }
    if (!juv && this.juvs.every(j => Math.abs(j.x - p.x) > 900)) { this.juvs = []; this.schoolC = null; }
  }

  startVisitor(kind, p) {
    const K = VISITOR_KINDS[kind], R = this.R, dir = R() < .5 ? 1 : -1;
    const lvl = this.seaLevel();
    const y = kind === 'sealion' ? clamp(p.y + 30, lvl + 20, 260) : kind === 'orca' ? clamp(p.y, lvl + 30, 300) : clamp(p.y + (R() - .5) * 120, lvl + 20, WORLD.maxDepth - 60);
    const v = { kind, dir, x: p.x - dir * (kind === 'orca' ? 1300 : 800), y, t: 0, state: 'come', ph: R() * TAU, hit: false, len: K.len, pod: [] };
    if (kind === 'orca') for (let k = 0; k < 2; k++) v.pod.push({ dx: -dir * (260 + k * 220), dy: (k ? 1 : -1) * (70 + R() * 40), ph: R() * TAU, s: .7 + R() * .2 });
    this.visitors.push(v);
    Bus.emit('visitor', v); Bus.emit(kind, v);
    return v;
  }
  updateVisitors(dt, p) {
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const v = this.visitors[i], K = VISITOR_KINDS[v.kind];
      v.t += dt; v.ph += dt * (v.kind === 'orca' ? 2 : 6);
      const dx = p.x - v.x, dy = p.y - v.y, d = Math.hypot(dx, dy) || 1;
      if (v.state === 'come') {
        if (!K.lunge) { v.x += v.dir * K.speed * dt; v.y += Math.sin(v.t * .5) * 6 * dt; if ((v.x - p.x) * v.dir > 600) v.state = 'leave'; continue; }
        v.dir = sign(dx); v.x += v.dir * K.speed * .7 * dt; v.y += clamp(dy, -60, 60) * dt * .9;
        if (Math.abs(dx) < v.len * .5 + 60 + p.len * .5 || v.t > 16) { v.state = 'lunge'; v.t = 0; v.aim = { x: p.x + v.dir * 40, y: p.y }; }
      } else if (v.state === 'lunge') {
        v.x += v.dir * K.speed * 1.7 * dt; v.y += (v.aim.y - v.y) * dt * 3;
        if (!v.hit && (v.x - p.x) * v.dir > -v.len * .3) { v.hit = true; const r = p.struck ? p.struck(v) : 'dodged'; Bus.emit(r === 'dodged' ? 'dodged' : 'missed', p, v); }
        if (v.t > 1.1) { v.state = 'leave'; v.t = 0; }
      } else {
        v.x += v.dir * K.speed * .9 * dt; v.y += (v.kind === 'sealion' ? -18 : -4) * dt;
        v.y = Math.max(v.y, this.seaLevel() + 14);
        if ((v.x - p.x) * v.dir > 1500 || v.t > 30) { this.visitors.splice(i, 1); Bus.emit('visitorGone', v); }
      }
      v.y = clamp(v.y, this.seaLevel() + 14, WORLD.maxDepth);
    }
  }

  /* a boat crosses the top; it slows right down when a sunfish is near the surface */
  startBoat(p) {
    const b = this.boat; if (b.state !== 'away') return false;
    b.dir = this.R() < .5 ? 1 : -1; b.x = p.x - b.dir * 1300; b.state = 'cross'; b.t = 0; b.slow = 0; b.slowSaid = false;
    Bus.emit('boat', b); return true;
  }
  updateBoat(dt, p) {
    const b = this.boat; if (b.state === 'away') return;
    b.t += dt;
    const near = Math.abs(b.x - p.x) < 300 && p.y < 90;
    b.slow += ((near ? 1 : 0) - b.slow) * (1 - Math.exp(-dt * 2));
    if (near && !b.slowSaid) { b.slowSaid = true; Bus.emit('boatSlow', b); }
    b.x += b.dir * 95 * (1 - b.slow * .85) * dt;
    if ((b.x - p.x) * b.dir > 1500 || b.t > 60) { b.state = 'away'; b.done++; Bus.emit('boatGone', b); }
  }
  /* a fishing net hangs from floats; a sunfish that swims into it is lifted out and let go */
  startNet(p) {
    const n = this.net; if (n.state !== 'away' || n.done) return false;
    n.x = p.x + (p.face || 1) * 300; n.y = this.seaLevel(); n.state = 'set'; n.t = 0; n.holding = false; n.lift = 0;
    Bus.emit('netSet', n); return true;
  }
  netTouches(p) { const n = this.net; return n.state === 'set' && Math.abs(p.x - n.x) < n.w * .5 + p.len * .3 && p.y < n.y + n.h + p.len * .3; }
  updateNet(dt, p) {
    const n = this.net; if (n.state === 'away' || n.state === 'gone') return;
    n.t += dt;
    if (n.state === 'set') {
      if (p.stage === 'mola' && p.mode === 'swim' && this.netTouches(p)) { n.state = 'haul'; n.t = 0; n.holding = true; p.netted && p.netted(n); Bus.emit('netted', n); }
      else if (n.t > 55) { n.state = 'gone'; n.done = true; Bus.emit('netGone', n); }
    } else if (n.state === 'haul') {
      n.lift = clamp(n.t / 3.5, 0, 1);
      if (n.t > 3.5) { n.state = 'lift'; n.t = 0; Bus.emit('netLift', n); }
    } else if (n.state === 'lift') {
      if (n.t > 3) { n.state = 'gone'; n.done = true; n.holding = false; p.freeFromNet && p.freeFromNet(n); Bus.emit('freed', p, n); }
    }
  }
  /* the cleaner fish: they potter round their rock, and swarm a sunfish holding still for them */
  updateCleaners(dt, p) {
    const S = this.station, cleaning = p.mode === 'clean';
    this.cleaners.forEach((c, k) => {
      c.ph += dt * 8;
      let tx, ty;
      if (cleaning) { const s = p.cleanSpot(k); tx = s.x; ty = s.y; }
      else { tx = S.x + Math.sin(c.ph * .05 + k) * 70; ty = S.floor - 30 - Math.cos(c.ph * .04 + k * 2) * 30; }
      c.ox += ((tx - c.x) * (cleaning ? 2.4 : .5) - c.ox) * dt * 2; c.oy += ((ty - c.y) * (cleaning ? 2.4 : .5) - c.oy) * dt * 2;
      c.x += c.ox * dt; c.y += c.oy * dt;
      if (Math.abs(c.ox) > 2) c.dir = sign(c.ox);
    });
  }
  stationNear(x, y, reach) { const S = this.station; return Math.abs(x - S.x) < 130 + reach * .5 && y > S.floor - 170 - reach * .5 && y < S.floor + 10; }

  /* the warm sea: other grown sunfish, and a mate of the other sex (with hearts) */
  makeMates(p, other) {
    const R = this.R; this.mates = [];
    for (let k = 0; k < 6; k++) {
      const x = WORLD.warmR - 500 - k * 260 - R() * 120, sex = k % 2 ? 'boy' : 'girl';
      this.mates.push({ x, y: 70 + R() * 170, hx: x, hy: 0, vx: 0, vy: 0, ph: R() * TAU, face: R() < .5 ? -1 : 1, form: R() < .7 ? 'normal' : pick(FORM_KEYS), sex, cm: 180 + R() * 40, heart: sex === other && k < 4, met: false });
    }
    for (const m of this.mates) m.hy = m.y;
    Bus.emit('matesMade', this.mates);
  }
  mateNear(x, y, reach) { let best = null, bd = 1e9; for (const m of this.mates) { if (!m.heart || m.met) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < reach && d < bd) { bd = d; best = m; } } return best; }
  updateMates(dt, p) {
    for (const m of this.mates) {
      m.ph += dt * 3;
      let tx = m.hx + Math.sin(m.ph * .05) * 120, ty = m.hy + Math.sin(m.ph * .07) * 30;
      if (m.met && m.with) { tx = p.x - p.face * p.len * .9; ty = p.y + 10; }
      m.vx += ((tx - m.x) * .5 - m.vx) * dt; m.vy += ((ty - m.y) * .5 - m.vy) * dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (Math.abs(m.vx) > 4) m.face = sign(m.vx);
    }
  }

  setStorm(on, hold = 40) { const W = this.weather; W.state = on ? 'storm' : 'clearing'; W.timer = hold; Bus.emit('weather', W.state); }
  setSeason(s) { if (this.season === s) return; this.season = s; Bus.emit('season', s); }
  update(dt, tod, p) {
    const W = this.weather, R = this.R;
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const next = { calm: 'cloudy', cloudy: R() < .2 ? 'storm' : 'calm', storm: 'clearing', clearing: 'calm' }[W.state];
      W.state = next; W.timer = { calm: 110 + R() * 90, cloudy: 25 + R() * 25, storm: 30 + R() * 25, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { calm: .1, cloudy: .65, storm: 1, clearing: .4 }[W.state], ts = W.state === 'storm' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.storm += (ts - W.storm) * (1 - Math.exp(-dt * .4));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    const want = SEASON_INFO[this.season][1];
    this.temp += (want - this.temp) * (1 - Math.exp(-dt * .05));
    if (p.stage === 'larva' || p.stage === 'egg' || this.school) this.updateSea(dt, p);
    else { this.plankton.length = 0; this.sibs.length = 0; }
    this.updateBabies(dt);
    this.updateFood(dt, p);
    this.updateSchool(dt, p);
    this.updateVisitors(dt, p);
    this.updateGull(dt, p);
    this.updateBoat(dt, p);
    this.updateNet(dt, p);
    this.updateCleaners(dt, p);
    this.updateMates(dt, p);
    for (const f of this.smallFish) {
      f.ph += dt * 8; f.x += f.dir * f.sp * dt; f.y += Math.sin(f.ph * .2) * 4 * dt;
      if (Math.abs(f.x - f.home) > 140 || this.ground.solidAt(f.x + f.dir * 10, f.y)) f.dir *= -1;
    }
    for (const k of this.kelp) k.h = k.root - this.seaLevel();
  }
}
