/* ============================================================
   world.js — the rocky shore and everything living on it
   ============================================================
   THE SEA      the big tide (the water climbs the shore and falls
                back twice a day), waves (bigger in a storm, and a big
                breaker now and then), the currents (out to sea while
                you are a larva, back to the shore once you are ready
                to settle), the plankton kept alive around you (diatoms,
                green algae cells, diatom chains, glowing dinoflagellates),
                sister larvae, a school of herring, comb jellies, the
                grey whale, a gull dipping at the surface.
   THE SHORE    the tide pools, pink rocks where a larva settles (some
                are crowded), cracks, bull kelp, rockweed and surfgrass;
                food on the rocks (baby barnacles, barnacles, limpets,
                turban snails that tumble away, chitons and the mussel
                bed); the bare rock where mussels were eaten, and the new
                life that moves in (the keystone); visitors that never
                hurt anybody (a gull, a sea otter, a red rock crab, the
                sunflower star); the child tide-pooling, the scientist
                counting stars; the other sea stars in spring.
   Nothing here ever hurts anybody: waves roll you, birds and otters
   cannot budge a star holding tight, the child puts you back.
   ============================================================ */
'use strict';

const FOOD_KINDS = {
  spat:     { food: 3, name: 'baby barnacle', r: 2, pull: .8, shell: false },
  barnacle: { food: 4, name: 'barnacle', r: 3.5, pull: 1, shell: false },
  limpet:   { food: 6, name: 'limpet', r: 4, pull: 1.3, shell: true },
  snail:    { food: 6, name: 'turban snail', r: 4, pull: 1.2, shell: true },
  chiton:   { food: 8, name: 'chiton', r: 5, pull: 1.6, shell: true },
  mussel:   { food: 14, name: 'mussel', r: 6, pull: 3, shell: true }
};
const PLANKTON_KINDS = {
  diatom: { val: 1.5, r: 1.5 },
  algae:  { val: 2, r: 1.8 },
  chain:  { val: 3, r: 2.6 },
  dino:   { val: 0, r: 1.0 }              /* not food: it glows when bumped */
};
/* visitors to a sea star: none of them ever hurts it */
const HUNTER_KINDS = {
  gull:      { name: 'gull', speed: 90, air: true },
  otter:     { name: 'sea otter', speed: 60, water: true },
  crab:      { name: 'red rock crab', speed: 34, water: true },
  sunflower: { name: 'sunflower star', speed: 22, water: true }
};
const LIFE_KINDS = ['anemone', 'barnacles', 'weed', 'limpet', 'chiton', 'goose', 'urchin', 'nudibranch'];

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground;
    this.t = 0;
    /* ---------- the shore ---------- */
    this.pools = S.pools;
    /* pink rocks: where a settling larva can hold on (the crowded ones are packed with mussels) */
    this.shelters = [];
    let last = -1e9;
    for (let x = WORLD.lowL - 300; x < WORLD.bedL + 200; x += 46 + R() * 50) {
      if (S.poolAt(x) || x - last < 50) continue;
      last = x;
      this.shelters.push({ x, w: 34, kind: 'pink', taken: R() < .55 });
    }
    /* the pink rocks just by the pools are always free */
    for (const P of this.pools) if (P.x < WORLD.bedL + 200) this.shelters.push({ x: P.x, w: P.w * .7, kind: 'pink', taken: false, pool: P });
    /* cracks in the rock: a good place for a tiny star to hide and rest */
    for (let x = WORLD.lowL - 100; x < WORLD.highR - 60; x += 110 + R() * 120) if (!S.poolAt(x)) this.shelters.push({ x, w: 26 + R() * 10, kind: 'crack', taken: false });
    for (const sh of this.shelters) sh.y = S.topAt(sh.x);
    this.shelters.sort((a, b) => a.x - b.x);
    /* bull kelp offshore, surfgrass on the low shore, rockweed on the middle and high shore */
    this.kelp = [];
    for (let x = WORLD.kelpL + 20; x < WORLD.kelpR; x += 26 + R() * 36) this.kelp.push({ x, h: 120 + R() * 160, ph: R() * TAU, seed: (R() * 1e9) | 0, w: 5 + R() * 5 });
    this.grass = [];
    for (let x = WORLD.lowL; x < WORLD.lowR; x += 8 + R() * 12) if (!S.poolAt(x)) this.grass.push({ x, h: 14 + R() * 18, ph: R() * TAU, n: 3 + (R() * 3 | 0), kind: 'surf' });
    for (let x = WORLD.bedR - 200; x < WORLD.highR; x += 14 + R() * 22) if (!S.poolAt(x)) this.grass.push({ x, h: 10 + R() * 10, ph: R() * TAU, n: 4 + (R() * 3 | 0), kind: 'rockweed' });
    /* food on the rocks */
    this.items = []; this.itemClock = 0;
    for (let x = WORLD.bedL + 20; x < WORLD.bedR - 30; x += 7 + R() * 7) if (!S.poolAt(x)) this.spawnItem(x, 'mussel');
    for (let x = WORLD.bedR - 60; x < WORLD.highR; x += 9 + R() * 12) if (!S.poolAt(x)) this.spawnItem(x, 'barnacle');
    for (let k = 0; k < 26; k++) this.spawnItem(lerp(WORLD.lowL - 200, WORLD.bedR, R()), pick(['limpet', 'snail', 'snail', 'chiton', 'barnacle']));
    /* bare rock left where mussels were eaten, and the new life moving in (the keystone) */
    this.bare = []; this.life = []; this.keystone = 0;
    this.npcs = []; this.hunters = []; this.midden = [];
    this.gull = { state: 'hover', x: 0, y: -160, t: 0, ph: R() * TAU, target: null, cool: 30 };
    this.wave = null; this.waveClock = 20; this.splash = 0;
    this.kid = { state: 'away', x: 0, y: 0, t: 0, done: false, hand: 0 };
    this.sci = { state: 'away', x: 0, y: 0, t: 0, done: false, flash: 0 };
    this.weather = { state: 'calm', timer: 60 + R() * 60, storm: 0, cloud: .2, gust: 0, snow: 0 };
    this.season = 'spring'; this.temp = 10;
    /* ---------- the open sea ---------- */
    this.plankton = []; this.sibs = []; this.jellies = []; this.smallFish = []; this.school = null; this.whale = null;
    this.drift = -1;                         /* -1: the ebb carries larvae out to sea; +1: back to the shore */
    for (let k = 0; k < 5; k++) this.jellies.push(this.makeJelly(lerp(-3000, 400, R()), 30 + R() * 140));
    const fishCols = [['#9ab0c0', '#3a5060'], ['#c0a070', '#5a4a30'], ['#7a9ab0', '#2a3a50'], ['#d08060', '#6a3020']];
    for (let k = 0; k < 16; k++) { const c = fishCols[k % fishCols.length], x = lerp(WORLD.kelpL, WORLD.lowR, R()); this.smallFish.push({ x, y: S.surfaceAt(x) - 20 - R() * 60, dir: R() < .5 ? -1 : 1, sp: 12 + R() * 16, s: .5 + R() * .6, ph: R() * TAU, col: c[0], col2: c[1], home: x }); }
    this.mum = null;                         /* the mother letting her eggs go, while you are an egg */
    this.babies = [];                        /* eggs drifting off on the tide */
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  /* ============================================================
     THE SEA
     ============================================================ */
  /* the big tide: from y −50 at high tide to y +80 at low tide (about four metres) */
  seaLevel() { return 15 - tideAt(this.G.tod) * 65; }
  /* the tide's height in metres above the lowest low */
  tideM() { return (80 - this.seaLevel()) / UNITS_PER_M; }
  /* rising (+1) or falling (−1) */
  tideDir() { return tideAt(this.G.tod + .004) > tideAt(this.G.tod) ? 1 : -1; }
  /* the wavy surface, for drawing and for "am I at the top?" */
  surfaceY(x) { const t = this.t, st = 1 + this.weather.storm * 3; return this.seaLevel() + st * (2.2 * Math.sin(x * .03 - t * 1.6) + 1.4 * Math.sin(x * .071 + t * 2.1)); }
  /* is (x, y) under water?  The sea, or a tide pool */
  wetAt(x, y) {
    if (y > this.seaLevel() - 1) return true;
    const P = this.ground.poolAt(x);
    return !!(P && y > P.rim - 2);
  }
  inWater(x, y) { return this.wetAt(x, y) && !this.ground.solidAt(x, y); }
  /* the swell: 0..1, a slow pulse of the water over the rocks (the eggs go on the pulse) */
  swash() { const u = (this.t % 5.6) / 5.6; return u < .45 ? smoothstep(0, .45, u) : 1 - smoothstep(.45, 1, u); }
  /* the water's movement at a point (units per second) */
  current(x, y) {
    const t = this.t, depthK = clamp(1 - (y - this.seaLevel()) / 520, .2, 1);
    const a = (Math.sin(x * .004 + t * .05) + Math.sin(y * .006 - t * .04 + 1.3)) * 1.6;
    let vx = Math.cos(a) * 4 + this.drift * 8 * depthK, vy = Math.sin(a) * 2.4;
    /* the ebb pulls new larvae away from the shore and out to sea */
    if (this.drift < 0) vx -= 14 * smoothstep(-2000, WORLD.lowL, x) * depthK;
    /* the flood brings a settler back towards the shore */
    else { const k = smoothstep(-3400, WORLD.kelpL, x) * (1 - smoothstep(WORLD.homeX - 200, WORLD.homeX + 300, x)); vx += 10 * k * depthK; if (x > WORLD.bedL) vx -= 12 * depthK; }
    vx += Math.sin(t * .4) * 6 * this.weather.storm * depthK;
    return [vx, vy];
  }
  makeJelly(x, y) { const R = this.R; return { x, y, r: 10 + R() * 8, ph: R() * TAU, vx: 0, vy: 0, hitDone: false }; }

  /* plankton is kept alive in a ring around whoever is swimming */
  updatePlankton(dt, p) {
    const night = nightAmount(this.G.tod), R = this.R, lvl0 = this.seaLevel();
    const band = night > .5 ? [lvl0 + 6, lvl0 + 110] : [lvl0 + 50, lvl0 + 260];
    const want = p.stage === 'larva' ? 90 : p.stage === 'postlarva' ? 50 : 0;
    const L = this.plankton;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.ph += dt;
      const [cx, cy] = this.current(q.x, q.y);
      q.x += cx * .6 * dt + Math.sin(q.ph * .7) * 1.5 * dt; q.y += cy * .6 * dt + Math.cos(q.ph * .5) * 1.2 * dt;
      q.glow = Math.max(0, q.glow - dt * 1.5);
      if (q.y < lvl0 + 3) q.y = lvl0 + 3;
      if (Math.hypot(q.x - p.x, q.y - p.y) > 360 || q.eaten || this.ground.solidAt(q.x, q.y)) L.splice(i, 1);
    }
    let tries = 0;
    while (L.length < want && tries++ < 400) {
      const a = R() * TAU, d = R() < .7 ? 45 + R() * 110 : 160 + R() * 160;
      let x = p.x + Math.cos(a) * d * 1.4 - (p.stage === 'larva' ? 30 : 0), y = p.y + Math.sin(a) * d * .7;
      if (R() < .55) y = lerp(band[0], band[1], R());
      y = clamp(y, lvl0 + 4, Math.min(620, this.ground.surfaceAt(x) - 14));
      if (this.ground.solidAt(x, y) || Math.hypot(x - p.x, y - p.y) < 40) { if (L.length > want * .7) break; continue; }
      const k = R(), kind = k < .45 ? 'diatom' : k < .72 ? 'algae' : k < .84 ? 'chain' : 'dino';
      L.push({ x, y, kind, ph: R() * TAU, vx: 0, vy: 0, glow: 0, rot: R() * TAU, eaten: false });
      if (kind === 'diatom' && R() < .3) for (let j = 0; j < 4; j++) L.push({ x: x + (R() - .5) * 26, y: clamp(y + (R() - .5) * 18, lvl0 + 4, 620), kind: 'diatom', ph: R() * TAU, vx: 0, vy: 0, glow: 0, rot: R() * TAU, eaten: false });
    }
  }
  /* sister larvae drifting along with you */
  updateSibs(dt, p) {
    const swimming = p.stage === 'larva' || p.stage === 'postlarva';
    if (!swimming) { this.sibs.length = 0; return; }
    const R = this.R, lvl = this.seaLevel();
    while (this.sibs.length < 12) { const a = R() * TAU, d = 60 + R() * 160; this.sibs.push({ x: p.x + Math.cos(a) * d, y: clamp(p.y + Math.sin(a) * d * .6, lvl + 10, 500), vx: 0, vy: 0, ph: R() * TAU, turn: 0, a: R() * TAU, post: p.stage === 'postlarva' }); }
    for (let i = this.sibs.length - 1; i >= 0; i--) {
      const s = this.sibs[i];
      s.ph += dt * 6; s.turn -= dt;
      if (s.turn <= 0) { s.turn = .6 + R() * 1.4; s.a += (R() - .5) * 2; }
      const [cx, cy] = this.current(s.x, s.y);
      s.vx += (Math.cos(s.a) * 14 - s.vx) * dt * 2; s.vy += (Math.sin(s.a) * 8 - s.vy) * dt * 2;
      s.x += (s.vx + cx * .8) * dt; s.y += (s.vy + cy * .8) * dt;
      if (s.y < lvl + 4) { s.y = lvl + 4; s.a = Math.abs(s.a); }
      if (this.ground.solidAt(s.x, s.y + 4)) { s.y -= 6; s.a = -Math.PI / 2; }
      if (Math.hypot(s.x - p.x, s.y - p.y) > 420) this.sibs.splice(i, 1);
    }
  }
  /* ---------- big visitors in the open sea ---------- */
  startSchool(p) {
    if (this.school) return;
    const dir = this.R() < .5 ? 1 : -1, n = 30, R = this.R;
    this.school = { dir, x: p.x - dir * 420, y: p.y + (R() - .5) * 40, t: 0, fish: [] };
    for (let k = 0; k < n; k++) this.school.fish.push({ dx: (R() - .5) * 190, dy: (R() - .5) * 70, ph: R() * TAU, s: .8 + R() * .4 });
    Bus.emit('herring', this.school);
  }
  startWhale(p) {
    if (this.whale) return;
    this.whale = { dir: 1, x: p.x - 1700, y: clamp(p.y + 30, this.seaLevel() + 70, 300), t: 0, blow: 0, passed: false };
    Bus.emit('whale', this.whale);
  }
  /* the whale's head, in world units (the wave it pushes comes from here) */
  whaleHead() { const w = this.whale; return w ? { x: w.x + w.dir * 300, y: w.y } : null; }
  /* the gull: hovers over the shore by day; dips at something near the top of the sea */
  dip(p) { const b = this.gull; if (b.state !== 'hover') return false; b.state = 'dive'; b.t = 0; b.from = { x: p.x - 200, y: this.seaLevel() - 150 }; b.target = { x: p.x, y: this.seaLevel() + 2 }; Bus.emit('gullDip', b); return true; }
  updateGull(dt, p) {
    const b = this.gull; b.t += dt; b.ph += dt;
    if (b.state === 'hover') { b.x = p.x + Math.cos(b.ph * .2) * 260; b.y = Math.min(this.seaLevel(), p.y) - 150 + Math.sin(b.ph * .9) * 12; }
    else if (b.state === 'dive') {
      const u = clamp(b.t / 1.4, 0, 1);
      b.x = lerp(b.from.x, b.target.x + 180, u); b.y = lerp(b.from.y, b.target.y, Math.sin(u * Math.PI));
      if (u > .48 && !b.hit) { b.hit = true; Bus.emit('gullPass', b); }
      if (u >= 1) { b.state = 'hover'; b.hit = false; }
    }
  }
  updateSea(dt, p) {
    this.updatePlankton(dt, p);
    this.updateSibs(dt, p);
    if (p.stage === 'larva' || p.stage === 'postlarva') {
      const near = this.jellies.filter(j => Math.abs(j.x - p.x) < 700);
      if (near.length < 2) { const side = this.R() < .5 ? -1 : 1; this.jellies.push(this.makeJelly(p.x + side * (300 + this.R() * 300), clamp(p.y + (this.R() - .5) * 120, this.seaLevel() + 20, 300))); }
    }
    for (let i = this.jellies.length - 1; i >= 0; i--) {
      const j = this.jellies[i];
      j.ph += dt * 1.2;
      const [cx, cy] = this.current(j.x, j.y); j.vx += (cx * .7 - j.vx) * dt * .5; j.vy += (cy * .4 + Math.sin(j.ph) * 3 - j.vy) * dt;
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.y = clamp(j.y, this.seaLevel() + j.r, Math.max(this.seaLevel() + j.r, Math.min(400, this.ground.surfaceAt(j.x) - j.r - 10)));
      if (Math.abs(j.x - p.x) > 2600) this.jellies.splice(i, 1);
    }
    const s = this.school;
    if (s) {
      s.t += dt; s.x += s.dir * 78 * dt; s.y += Math.sin(s.t * 1.2) * 18 * dt;
      for (const f of s.fish) f.ph += dt * 9;
      if ((s.x - p.x) * s.dir > 520) { this.school = null; Bus.emit('schoolGone'); }
    }
    const w = this.whale;
    if (w) {
      w.t += dt; w.x += w.dir * 56 * dt; w.blow = Math.max(0, w.blow - dt);
      w.y += (clamp(p.y + 20, this.seaLevel() + 60, 320) - w.y) * dt * .12;
      if (w.y < this.seaLevel() + 90 && Math.random() < dt * .3) w.blow = 1.2;
      if (!w.passed && (w.x - p.x) * w.dir > 400) { w.passed = true; Bus.emit('whalePassed'); }
      if ((w.x - p.x) * w.dir > 2600) this.whale = null;
    }
  }
  /* eggs (or a milky cloud) let go into the sea: a puff of tiny drifting dots */
  babyBurst(x, y, n = 60, cloud = false) {
    const R = this.R;
    for (let k = 0; k < n; k++) { const a = -Math.PI * .5 + (R() - .5) * 2.8, sp = 14 + R() * 40; this.babies.push({ x: x + (R() - .5) * 10, y: y + (R() - .5) * 4, vx: Math.cos(a) * sp - 8, vy: Math.sin(a) * sp - 4, t: R() * .4, ph: R() * TAU, cloud }); }
    if (this.babies.length > 900) this.babies.splice(0, this.babies.length - 900);
  }
  updateBabies(dt) {
    for (let i = this.babies.length - 1; i >= 0; i--) {
      const e = this.babies[i]; e.t += dt;
      const [cx, cy] = this.current(e.x, e.y);
      e.x += (e.vx + cx * .6 - 6) * dt; e.y += (e.vy + cy * .6) * dt; e.vx *= Math.exp(-dt * 1.5); e.vy = e.vy * Math.exp(-dt * 1.2) - 4 * dt;
      if (e.y < this.seaLevel() + 3) e.y = this.seaLevel() + 3;
      if (e.t > 9) this.babies.splice(i, 1);
    }
  }

  /* ============================================================
     THE SHORE
     ============================================================ */
  /* where (x, y) is for a sea star: 'sea' (under the sea) | 'pool' (in a tide pool) |
     'crack' (in a crack: shaded) | 'weed' (under wet rockweed) | 'air' (out on the rock) */
  shadeAt(x, y, w = 6) {
    const S = this.ground;
    if (y > this.seaLevel() - 1) return 'sea';
    const P = S.poolAt(x);
    if (P && y > P.rim - 3) return 'pool';
    for (const sh of this.shelters) if (sh.kind === 'crack' && Math.abs(x - sh.x) < sh.w * .5 && Math.abs(y - sh.y) < 16 + w * .3) return 'crack';
    if (this.grass.some(g => g.kind === 'rockweed' && Math.abs(g.x - x) < 12)) return 'weed';
    return 'air';
  }
  shelterAt(x, y, w = 6) { for (const sh of this.shelters) if (Math.abs(x - sh.x) < sh.w * .5 && Math.abs(y - sh.y) < 30 + w) return sh; return null; }
  nearestShelter(x, kind) { let best = null, bd = 1e9; for (const sh of this.shelters) { if (kind && sh.kind !== kind) continue; const d = Math.abs(sh.x - x); if (d < bd) { bd = d; best = sh; } } return best; }
  /* a pink rock a settler can take */
  nearestFreePink(x) { let best = null, bd = 1e9; for (const sh of this.shelters) { if (sh.kind !== 'pink' || sh.taken) continue; const d = Math.abs(sh.x - x); if (d < bd) { bd = d; best = sh; } } return best; }
  /* the nearest wet place to wait out the low tide: a pool, or the sea's edge down the shore */
  nearestWet(x) {
    const S = this.ground, lvl = this.seaLevel();
    let best = null, bd = 1e9;
    for (const P of this.pools) { const d = Math.abs(P.x - x); if (d < bd) { bd = d; best = { x: P.x, y: P.floor, pool: P }; } }
    for (let k = 0; k < 160; k++) { const xx = x - k * 12; if (S.topAt(xx) > lvl + 8) { const d = k * 12; if (d < bd) { bd = d; best = { x: xx, y: S.topAt(xx), pool: null }; } break; } }
    return best;
  }
  spawnItem(x, kind) {
    const S = this.ground;
    x = clamp(x, WORLD.gridL + 60, WORLD.walkR - 40);
    const it = { kind, x, y: S.topAt(x) - 1, rot: (this.R() - .5) * 1.4, age: 0, col: this.R(), eaten: false, roll: 0 };
    this.items.push(it);
    return it;
  }
  foodNear(x, y, reach, ok) { let best = null, bd = reach; for (const it of this.items) { if (it.eaten || it.roll) continue; if (ok && !ok(it)) continue; const d = Math.hypot(it.x - x, (it.y - y) * .6); if (d < bd) { bd = d; best = it; } } return best; }
  /* a meal finished: an empty shell, and where a mussel was, a patch of bare rock */
  eatItem(it) {
    it.eaten = true;
    if (FOOD_KINDS[it.kind].shell) this.midden.push({ x: it.x + (this.R() - .5) * 6, y: it.y, kind: it.kind, rot: (this.R() - .5) * 2, t: 0 });
    if (this.midden.length > 90) this.midden.shift();
    if (it.kind === 'mussel') { this.bare.push({ x: it.x, t: 0 }); this.keystone++; }
  }
  /* the keystone: new life moves into the bare rock, one patch at a time */
  growLife(n = 1) {
    const R = this.R;
    for (let k = 0; k < n; k++) {
      const b = this.bare.find(q => !q.filled); if (!b) return;
      b.filled = true;
      const kind = LIFE_KINDS[this.life.length % LIFE_KINDS.length];
      this.life.push({ x: b.x + (R() - .5) * 8, y: this.ground.topAt(b.x), kind, t: 0, s: .8 + R() * .5, ph: R() * TAU });
    }
  }
  /* how many kinds of animals and seaweeds live on this stretch of shore */
  lifeCount() { return 9 + new Set(this.life.map(l => l.kind)).size; }

  /* ---------- the big breakers ---------- */
  startWave(big = 1) {
    if (this.wave) return null;
    const p = this.G.player;
    this.wave = { x: p.x - 700, y: this.seaLevel(), h: (26 + this.R() * 14) * big, sp: 300, t: 0, hit: false, big };
    Bus.emit('waveComing', this.wave);
    return this.wave;
  }
  updateWave(dt, p) {
    const w = this.wave; this.splash = Math.max(0, this.splash - dt * .8);
    if (!w) return;
    w.t += dt; w.x += w.sp * dt; w.y = this.seaLevel();
    if (!w.hit && w.x >= p.x) { w.hit = true; if (p.y > w.y - w.h - 30 && p.y < w.y + w.h + 50) { this.splash = 1; if (p.waveHit) p.waveHit(w); Bus.emit('waveHit', w); } }
    if (w.x - p.x > 600) this.wave = null;
  }

  /* ---------- visitors: a gull, an otter, a crab or the sunflower star comes, tries, gives up, leaves ---------- */
  startHunter(kind, p) {
    if (this.hunters.length) return null;
    const S = this.ground, dir = p.face >= 0 ? 1 : -1, lvl = this.seaLevel();
    const h = { kind, dir: -dir, x: p.x + dir * 480, y: 0, state: 'come', t: 0, ph: this.R() * TAU, struck: false };
    if (kind === 'gull') { h.x = p.x - 400; h.y = Math.min(lvl, S.topAt(p.x)) - 180; h.dir = 1; }
    else if (kind === 'otter') h.y = lvl + 8;
    else h.y = S.topAt(h.x);
    this.hunters.push(h);
    Bus.emit('predator', h);
    return h;
  }
  updateHunters(dt, p) {
    const S = this.ground, lvl = this.seaLevel();
    for (let i = this.hunters.length - 1; i >= 0; i--) {
      const h = this.hunters[i], K = HUNTER_KINDS[h.kind];
      h.t += dt; h.ph += dt * 6;
      if (h.kind === 'gull') {
        /* flies in, lands beside you, tugs, gives up and flies off */
        const gx = p.x - 14, gy = S.topAt(gx) - 2;
        if (h.state === 'come') { h.x += (gx - h.x) * dt * 1.6; h.y += (gy - h.y) * dt * 1.6; if (Math.hypot(gx - h.x, gy - h.y) < 8) { h.state = 'stand'; h.t = 0; } }
        else if (h.state === 'stand') { h.x = gx; h.y = gy; if (h.t > 1.2) { h.state = 'strike'; h.t = 0; } }
        else if (h.state === 'strike') { if (!h.struck && h.t > .4) { h.struck = true; if (p.struck) p.struck(h); Bus.emit('strike', h); } if (h.t > 1.2) { h.state = 'leave'; h.t = 0; } }
        else { h.x += 120 * dt; h.y -= 90 * dt; if (h.t > 5) this.hunters.splice(i, 1); }
        continue;
      }
      if (h.kind === 'otter') {
        /* floats on its back, dives down to have a look, pulls, gives up, floats off */
        if (h.state === 'come') { h.x += sign(p.x - h.x) * K.speed * dt; h.y += (lvl + 6 - h.y) * dt * 2; if (Math.abs(p.x - h.x) < 40) { h.state = 'dive'; h.t = 0; } }
        else if (h.state === 'dive') { h.x += (p.x - 10 - h.x) * dt * 2; h.y += (p.y - 14 - h.y) * dt * 2; if (h.t > 1.4) { h.state = 'strike'; h.t = 0; } }
        else if (h.state === 'strike') { if (!h.struck && h.t > .3) { h.struck = true; if (p.struck) p.struck(h); Bus.emit('strike', h); } if (h.t > 1.2) { h.state = 'leave'; h.t = 0; } }
        else { h.x -= K.speed * dt; h.y += (lvl + 6 - h.y) * dt * 2; if (Math.abs(h.x - p.x) > 900) this.hunters.splice(i, 1); }
        continue;
      }
      /* a crab or the sunflower star walks along the rock */
      const sp = K.speed * (h.kind === 'sunflower' ? 1 + Math.min(1, h.t / 20) * .3 : 1);
      if (h.state === 'come') {
        const dx = p.x - h.x;
        h.x += sign(dx) * Math.min(Math.abs(dx), sp * dt); h.dir = sign(dx) || h.dir;
        if (Math.abs(dx) < (h.kind === 'sunflower' ? 20 + p.w * .4 : 26)) { h.state = 'strike'; h.t = 0; }
        if (h.kind === 'sunflower' && h.t > 28) { h.state = 'leave'; h.t = 0; Bus.emit('sunflowerGone', h); }
      } else if (h.state === 'strike') {
        if (!h.struck && h.t > .4) { h.struck = true; if (p.struck) p.struck(h); Bus.emit('strike', h); }
        if (h.t > 1.1) { h.state = 'leave'; h.t = 0; h.dir = -h.dir; }
      } else {
        h.x += h.dir * sp * 1.2 * dt;
        if (Math.abs(h.x - p.x) > 700 || h.t > 30) this.hunters.splice(i, 1);
      }
      h.y = S.topAt(h.x);
    }
  }

  /* ---------- a child tide-pooling at low tide: looks, lifts you gently, puts you back ---------- */
  startKid(p) {
    const K = this.kid; if (K.state !== 'away') return false;
    K.state = 'come'; K.t = 0; K.x = p.x + 420; K.y = this.ground.topAt(K.x); K.hand = 0; K.face = -1;
    Bus.emit('kidArrived', K);
    return true;
  }
  updateKid(dt, p) {
    const K = this.kid; if (K.state === 'away') return;
    const S = this.ground; K.t += dt;
    const stand = p.x + 46;
    if (K.state === 'come') { const dx = stand - K.x; K.x += sign(dx) * Math.min(Math.abs(dx), 44 * dt); K.walk = (K.walk || 0) + dt * 6; if (Math.abs(dx) < 2) { K.state = 'look'; K.t = 0; } }
    else if (K.state === 'look') { K.hand = Math.min(1, K.t / 1.6); const ok = p.mode === 'crawl' || p.mode === 'curl'; if (K.t > 2.2 && ok) { K.state = 'lift'; K.t = 0; if (p.lifted) p.lifted(K); } else if (K.t > 16) { K.state = 'leave'; K.t = 0; } }
    else if (K.state === 'lift') { K.hand = 1 + Math.min(1, K.t / 1.2); if (K.t > 4.4) { K.state = 'putback'; K.t = 0; } }
    else if (K.state === 'putback') { K.hand = Math.max(0, 2 - K.t / 1.2); if (K.t > 1.4) { K.state = 'leave'; K.t = 0; K.done = true; if (p.putBack) p.putBack(K); } }
    else if (K.state === 'leave') { K.x += 50 * dt; K.face = 1; K.walk = (K.walk || 0) + dt * 6; K.hand = 0; if (K.t > 9) K.state = 'away'; }
    /* the child is following a star along the rock while it is crawling about */
    if (K.state === 'look' && Math.abs(stand - K.x) > 2) K.x += sign(stand - K.x) * Math.min(Math.abs(stand - K.x), 44 * dt);
    K.y = S.topAt(K.x);
  }
  /* where the child's hand holds you up to look */
  kidHand() { const K = this.kid; return { x: K.x - 18, y: K.y - 22 - Math.max(0, K.hand - 1) * 38 }; }

  /* ---------- the scientist counting sea stars at low tide ---------- */
  startSci(p) {
    const D = this.sci; if (D.state !== 'away') return false;
    D.state = 'come'; D.t = 0; D.x = p.x + 460; D.y = this.ground.topAt(D.x); D.face = -1; D.flash = 0; D.counted = false;
    Bus.emit('sciArrived', D);
    return true;
  }
  updateSci(dt, p) {
    const D = this.sci; if (D.state === 'away') return;
    const S = this.ground; D.t += dt; D.flash = Math.max(0, D.flash - dt * 3);
    const stand = p.x + p.w * .7 + 30;
    if (D.state === 'come') { const dx = stand - D.x; D.x += sign(dx) * Math.min(Math.abs(dx), 40 * dt); D.walk = (D.walk || 0) + dt * 6; if (Math.abs(dx) < 2) { D.state = 'wait'; D.t = 0; } }
    else if (D.state === 'wait') { if (D.t > 45 || Math.abs(p.x - D.x) > 320) { D.state = 'leave'; D.t = 0; } }
    else if (D.state === 'count') { if (D.t > 2.8) { D.state = 'leave'; D.t = 0; D.flash = 1; } }
    else if (D.state === 'leave') { D.x += 46 * dt; D.face = 1; D.walk = (D.walk || 0) + dt * 6; if (D.t > 10) { D.state = 'away'; D.done = true; } }
    D.y = S.topAt(D.x);
  }
  sciNear(x, reach) { const D = this.sci; return D.state === 'wait' && Math.abs(D.x - x) < reach + 40 ? D : null; }

  /* ---------- the other sea stars, gathering on the mussel bed in spring ---------- */
  makeGathering(p, want) {
    if (this.npcs.length) return;
    const R = this.R;
    const xs = [-170, -110, 90, 150, 230, -250];
    xs.forEach((dx, k) => {
      const sex = k < 3 ? want : (want === 'girl' ? 'boy' : 'girl');
      this.npcs.push(new StarNPC(this, { x: clamp(p.x + dx + (R() - .5) * 20, WORLD.lowR + 40, WORLD.highR - 60), cm: 20 + R() * 10, sex, form: R() < .7 ? 'normal' : pick(FORM_KEYS), hearts: sex === want }));
    });
  }
  mates(near) { return this.npcs.filter(n => n.hearts && (near === undefined || Math.abs(n.x - near.x) < near.r)); }

  /* ============================================================
     WEATHER AND SEASONS
     ============================================================ */
  setStorm(on, hold = 40) { const W = this.weather; W.state = on ? 'storm' : 'clearing'; W.timer = hold; Bus.emit('weather', W.state); }
  setSeason(s) { if (this.season === s) return; this.season = s; Bus.emit('season', s); }
  update(dt, tod, p) {
    const W = this.weather, R = this.R;
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const rough = this.season === 'autumn' || this.season === 'winter';
      const next = { calm: 'cloudy', cloudy: rough && R() < .5 ? 'storm' : R() < .15 ? 'storm' : 'calm', storm: 'clearing', clearing: 'calm' }[W.state];
      W.state = next; W.timer = { calm: (rough ? 60 : 110) + R() * 90, cloudy: 25 + R() * 25, storm: 30 + R() * 30, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { calm: .2, cloudy: .7, storm: 1, clearing: .4 }[W.state], ts = W.state === 'storm' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.storm += (ts - W.storm) * (1 - Math.exp(-dt * .4));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    W.snow = 0;
    const want = SEASON_INFO[this.season][1];
    this.temp += (want - this.temp) * (1 - Math.exp(-dt * .05));

    if (p.stage === 'larva' || p.stage === 'postlarva' || p.stage === 'egg' || this.whale || this.school) this.updateSea(dt, p);
    else { this.plankton.length = 0; this.sibs.length = 0; }
    this.updateBabies(dt);

    /* food on the rocks: barnacles and snails turn up again now and then; baby barnacles round a tiny star */
    this.itemClock -= dt;
    if (this.itemClock <= 0 && p.stage === 'star') {
      this.itemClock = 2.5 + R() * 3;
      if (p.instar === 1) {
        const near = this.items.filter(it => !it.eaten && it.kind === 'spat' && Math.abs(it.x - p.x) < 160).length;
        if (near < 5) this.spawnItem(p.x + (R() < .5 ? -1 : 1) * (20 + R() * 120), 'spat');
      } else {
        const near = this.items.filter(it => !it.eaten && it.kind !== 'mussel' && it.kind !== 'spat' && Math.abs(it.x - p.x) < 700).length;
        if (near < 14) this.spawnItem(clamp(p.x + (R() < .5 ? -1 : 1) * (120 + R() * 500), WORLD.lowL - 300, WORLD.highR - 20), pick(['barnacle', 'limpet', 'snail', 'chiton', 'barnacle']));
        /* a big star keeps the mussel bed in food: new mussels settle in the gaps, slowly */
        if (p.instar >= 3 && this.items.filter(it => !it.eaten && it.kind === 'mussel').length < 60) this.spawnItem(lerp(WORLD.bedL + 20, WORLD.bedR - 30, R()), 'mussel');
      }
      if (this.items.length > 320) { const old = this.items.findIndex(it => it.eaten); if (old >= 0) this.items.splice(old, 1); }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      /* a turban snail that smelled a star lets go and tumbles down the rock */
      if (it.roll) { it.roll -= dt; it.x -= 40 * dt; it.rot -= dt * 8; it.y = this.ground.topAt(it.x) - 1; if (it.roll <= 0) it.roll = 0; }
      if (it.eaten) { it.gone = (it.gone || 0) + dt; if (it.gone > 2) this.items.splice(i, 1); }
    }
    for (const m of this.midden) m.t += dt;
    for (const b of this.bare) b.t += dt;
    for (const l of this.life) { l.t += dt; l.ph += dt; }
    for (const f of this.smallFish) {
      f.ph += dt * 8; f.x += f.dir * f.sp * dt; f.y += Math.sin(f.ph * .2) * 4 * dt;
      if (f.y < this.seaLevel() + 8) f.y = this.seaLevel() + 8;
      if (Math.abs(f.x - f.home) > 140 || this.ground.solidAt(f.x + f.dir * 10, f.y)) f.dir *= -1;
    }
    this.updateHunters(dt, p);
    this.updateGull(dt, p);
    this.updateWave(dt, p);
    this.updateKid(dt, p);
    this.updateSci(dt, p);
    for (const n of this.npcs) n.update(dt);
    if (this.mum) this.mum.ph += dt;
  }
}

/* another sea star: sits on the rock; in spring it stands tall and lets its eggs or its cloud go */
class StarNPC {
  constructor(W, o) {
    this.W = W; this.cm = o.cm; this.sex = o.sex; this.form = o.form || 'normal'; this.hearts = !!o.hearts;
    this.x = o.x; this.y = W.ground.topAt(this.x); this.face = 1; this.t = Math.random() * 5; this.arch = 0; this.spawning = false; this.met = false;
    this.ph = Math.random() * TAU; this.puff = 0;
  }
  get w() { return starUnits(this.cm); }
  update(dt) {
    this.t += dt; this.ph += dt;
    this.arch += ((this.spawning ? 1 : 0) - this.arch) * (1 - Math.exp(-dt * 1.5));
    this.y = this.W.ground.topAt(this.x);
    if (this.spawning) { this.puff -= dt; if (this.puff <= 0) { this.puff = 1.6 + Math.random() * 1.4; this.W.babyBurst(this.x, this.y - this.w * .45, 10, this.sex === 'boy'); } }
  }
}
