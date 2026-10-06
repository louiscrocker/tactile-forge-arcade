/* ============================================================
   world.js — the sea, the island and everything living there
   ============================================================
   THE SEA     the tide and the waves, the currents (out to sea
               while you are a zoea, back towards the island in
               an eddy once you are a megalopa), the plankton that
               is kept alive around you (green diatoms, glowing
               dinoflagellates, jumpy copepods; up near the top at
               night and down deep by day), sister larvae, a
               school of little fish, the whale shark, a manta,
               moon jellyfish you can ride, and the reef's fish
               and a turtle.
   THE ISLAND  trees (their canopy is shade), rocks and cracks to
               hide in, food on the forest floor (fallen leaves,
               flowers, figs, seedlings), the baby crabs' red
               carpet, the migrating crowd, seabirds, the robber
               crab, the ranger at the crab bridge, rival males,
               the female, the boys' burrows on the terrace, and
               the weather and the seasons.
   Nothing here ever hurts anybody: fish, sharks and birds miss,
   and the robber crab only wants the fruit.
   ============================================================ */
'use strict';

const FOOD_KINDS = {
  leaf:     { food: 4, bites: 2, name: 'fallen leaf', r: 6 },
  flower:   { food: 6, bites: 2, name: 'flower', r: 5 },
  fruit:    { food: 9, bites: 3, name: 'fallen fig', r: 5 },
  seedling: { food: 5, bites: 1, name: 'seedling', r: 5 }
};
const PLANKTON_KINDS = {
  diatom:  { val: 1, r: 1.1 },
  chain:   { val: 2, r: 1.8 },
  dino:    { val: 1, r: 1.0 },
  copepod: { val: 3, r: 1.5 }
};

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground;
    this.t = 0;
    /* ---------- the island ---------- */
    this.trees = [];
    for (let x = 1010 + R() * 60; x < WORLD.right - 60; x += 150 + R() * 140) {
      if (x > WORLD.bridgeL - 140 && x < WORLD.bridgeR + 140) continue;
      this.trees.push({ x, kind: R() < .5 ? 'tall' : R() < .55 ? 'chestnut' : 'fig', w: 26 + R() * 30, seed: (R() * 1e9) | 0, lean: (R() - .5) * .06 });
    }
    for (const x of [175, 330, 520, 600]) this.trees.push({ x: x + (R() - .5) * 40, kind: R() < .5 ? 'pandanus' : 'palm', w: 10 + R() * 4, seed: (R() * 1e9) | 0, lean: (R() - .5) * .2 });
    this.trees.push({ x: 60, kind: 'palm', w: 11, seed: 99, lean: -.22 });
    /* places to hide from the sun: rocks on the shore and terrace, cracks on the cliff ledges, fallen logs */
    this.shelters = [];
    for (const x of [44, 98, 190, 286, 402, 478, 588]) this.shelters.push({ x: x + (R() - .5) * 20, w: 26 + R() * 14, kind: 'rock' });
    for (const [x0, x1] of [[700, 730], [762, 794], [840, 870]]) this.shelters.push({ x: (x0 + x1) / 2, w: 26, kind: 'crack' });
    for (let k = 0; k < 6; k++) { const x = lerp(1300, WORLD.right - 300, (k + R()) / 6); if (x > WORLD.bridgeL - 100 && x < WORLD.bridgeR + 100) continue; this.shelters.push({ x, w: 70 + R() * 50, kind: 'log' }); }
    for (const sh of this.shelters) sh.y = S.walkTop(sh.x, 6);
    /* sunny gaps in the canopy: the road clearing, and one where a big tree fell */
    this.clearings = [[WORLD.bridgeL - 120, WORLD.bridgeR + 120], [3260, 3420]];
    this.items = []; this.falling = []; this.itemClock = 0;
    for (let k = 0; k < 70; k++) this.spawnItem(lerp(1000, WORLD.right - 80, R()), R() < .6 ? 'leaf' : R() < .5 ? 'flower' : R() < .5 ? 'fruit' : 'seedling');
    this.npcs = []; this.marchers = []; this.babies = []; this.exuviae = [];
    this.robber = { state: 'away', x: WORLD.right + 100, t: 0, dir: -1, legs: 0, done: false, target: 0 };
    this.bird = { state: 'soar', x: 0, y: -900, t: 0, ph: R() * TAU, target: null, cool: 30 };
    this.ranger = { x: WORLD.roadL + 50, wave: 0 };
    this.ants = { x0: WORLD.right - 170, x1: WORLD.right - 80 };      /* at the far end of the forest, where the rangers keep them back */
    this.weather = { state: 'clear', timer: 60 + R() * 60, rain: 0, cloud: .15, gust: 0, force: null };
    this.season = 'wet'; this.humid = .5;
    /* ---------- the sea ---------- */
    this.plankton = []; this.sibs = []; this.jellies = []; this.reefFish = []; this.school = null; this.whale = null; this.manta = null;
    this.drift = -1;                         /* -1: the current carries larvae out to sea; +1: back to the island */
    for (let k = 0; k < 6; k++) this.jellies.push(this.makeJelly(lerp(-3200, -500, R()), 60 + R() * 260));
    const fishCols = [['#ffd23f', '#2a6fb8'], ['#3fd0ff', '#1a3a8a'], ['#ff7a3a', '#ffffff'], ['#b06aff', '#ffd23f'], ['#5adf8a', '#1a6a4a']];
    for (let k = 0; k < 16; k++) { const c = fishCols[k % fishCols.length]; this.reefFish.push({ x: lerp(-740, -60, R()), y: 40 + R() * 70, dir: R() < .5 ? -1 : 1, sp: 14 + R() * 18, s: .6 + R() * .7, ph: R() * TAU, col: c[0], col2: c[1], home: 0 }); }
    for (const f of this.reefFish) f.home = f.x;
    this.turtle = { x: -500, y: 70, dir: 1, ph: 0 };
    this.mum = null;                         /* the mother at the sea's edge, while you are an egg */
    this.eggCloud = [];                      /* eggs bursting into larvae in the waves */
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  /* ============================================================
     THE SEA
     ============================================================ */
  seaLevel() { return -tideAt(this.G.tod) * 8; }
  /* the wavy surface, for drawing and for "am I at the top?" */
  surfaceY(x) { const t = this.t; return this.seaLevel() + 2.2 * Math.sin(x * .03 - t * 1.6) + 1.4 * Math.sin(x * .071 + t * 2.1); }
  inWater(x, y) { return y > this.seaLevel() && !this.ground.solidAt(x, y) && x < 140; }
  /* the swash on the shore: 0..1, 1 when a wave has run right up */
  swash() { const u = (this.t % 5.6) / 5.6; return u < .45 ? smoothstep(0, .45, u) : 1 - smoothstep(.45, 1, u); }
  waterEdge(full) {
    /* where the sea meets the rocks right now, a wave running up it (full: as far as the waves reach) */
    const lvl = this.seaLevel() - (full ? 1 : this.swash()) * 6, S = this.ground;
    let x = -20; while (x < 200 && S.walkTop(x, 4) > lvl) x += 2;
    return x;
  }
  /* the water's movement at a point (units per second) */
  current(x, y) {
    const t = this.t, depthK = clamp(1 - y / 520, .2, 1);
    const a = (Math.sin(x * .004 + t * .05) + Math.sin(y * .006 - t * .04 + 1.3)) * 1.6;
    let vx = Math.cos(a) * 4 + this.drift * 8 * depthK, vy = Math.sin(a) * 2.4;
    /* the ebbing tide pulls new larvae away from the island, strongly near the shore */
    if (this.drift < 0) vx -= 16 * smoothstep(-1500, -150, x) * depthK;
    /* in the shallows the waves surge in and out (and carry a megalopa in) */
    else if (x > -200) { const k = smoothstep(-200, -20, x), s = Math.sin(t / 5.6 * TAU); vx += (s * 26 + 8) * k; vy += Math.cos(t / 5.6 * TAU) * 4 * k; }
    return [vx, vy];
  }
  makeJelly(x, y) { const R = this.R; return { x, y, r: 22 + R() * 16, ph: R() * TAU, vx: 0, vy: 0, rider: false, hue: R() < .7 ? 'moon' : 'pink' }; }

  /* plankton is kept alive in a ring around whoever is swimming */
  updatePlankton(dt, p) {
    const night = nightAmount(this.G.tod), R = this.R;
    const band = night > .5 ? [6, 170] : [130, 430];
    const want = p.stage === 'zoea' ? 90 : p.stage === 'megalopa' ? 60 : 0;
    const L = this.plankton;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.ph += dt;
      const [cx, cy] = this.current(q.x, q.y);
      if (q.kind === 'copepod') {
        /* copepods jump away from anything coming close */
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < 26 && q.tired < 1.6) { q.vx += dx / d * 260 * dt; q.vy += dy / d * 260 * dt; q.tired += dt; if (!q.jumped) { q.jumped = true; Bus.emit('copepodJump', q); } }
        else q.tired = Math.max(0, q.tired - dt * .4);
        q.vx *= Math.exp(-dt * 3); q.vy *= Math.exp(-dt * 3);
        q.x += (q.vx + cx * .5) * dt; q.y += (q.vy + cy * .5) * dt;
      } else { q.x += cx * .6 * dt + Math.sin(q.ph * .7) * 1.5 * dt; q.y += cy * .6 * dt + Math.cos(q.ph * .5) * 1.2 * dt; }
      q.glow = Math.max(0, q.glow - dt * 1.5);
      const lvl = this.seaLevel() + 3;
      if (q.y < lvl) q.y = lvl;
      if (Math.hypot(q.x - p.x, q.y - p.y) > 360 || q.eaten || this.ground.solidAt(q.x, q.y)) L.splice(i, 1);
    }
    while (L.length < want) {
      /* most of it within sight (but not right on top of you), a little further out */
      const a = R() * TAU, d = R() < .7 ? 45 + R() * 110 : 160 + R() * 160;
      let x = p.x + Math.cos(a) * d * 1.4 - (p.stage === 'zoea' ? 30 : 0), y = p.y + Math.sin(a) * d * .7;
      /* plankton gathers in its depth band (near the top at night, deep by day): mostly there */
      if (R() < .55) y = lerp(band[0], band[1], R());
      y = clamp(y, this.seaLevel() + 4, 640);
      x = Math.min(x, -40);
      if (this.ground.solidAt(x, y) || Math.hypot(x - p.x, y - p.y) < 40) { if (L.length > want * .7) break; continue; }
      const k = R(), kind = k < .5 ? 'diatom' : k < .66 ? 'chain' : k < .86 ? 'dino' : 'copepod';
      L.push({ x, y, kind, ph: R() * TAU, vx: 0, vy: 0, glow: 0, tired: 0, rot: R() * TAU, eaten: false });
      /* sometimes a little cloud of them */
      if (kind === 'diatom' && R() < .3) for (let j = 0; j < 5; j++) L.push({ x: x + (R() - .5) * 26, y: clamp(y + (R() - .5) * 18, this.seaLevel() + 4, 640), kind: 'diatom', ph: R() * TAU, vx: 0, vy: 0, glow: 0, tired: 0, rot: R() * TAU, eaten: false });
    }
  }
  /* sister larvae drifting along with you */
  updateSibs(dt, p) {
    const swimming = p.stage === 'zoea' || p.stage === 'megalopa';
    if (!swimming) { this.sibs.length = 0; return; }
    const R = this.R;
    while (this.sibs.length < 12) { const a = R() * TAU, d = 60 + R() * 160; this.sibs.push({ x: p.x + Math.cos(a) * d, y: clamp(p.y + Math.sin(a) * d * .6, 10, 600), vx: 0, vy: 0, ph: R() * TAU, turn: 0, a: R() * TAU, mega: p.stage === 'megalopa' }); }
    for (let i = this.sibs.length - 1; i >= 0; i--) {
      const s = this.sibs[i];
      s.ph += dt * 6; s.turn -= dt;
      if (s.turn <= 0) { s.turn = .6 + R() * 1.4; s.a += (R() - .5) * 2; }
      const [cx, cy] = this.current(s.x, s.y);
      s.vx += (Math.cos(s.a) * 18 - s.vx) * dt * 2; s.vy += (Math.sin(s.a) * 10 - s.vy) * dt * 2;
      s.x += (s.vx + cx * .8) * dt; s.y += (s.vy + cy * .8) * dt;
      if (s.y < this.seaLevel() + 4) { s.y = this.seaLevel() + 4; s.a = Math.abs(s.a); }
      if (this.ground.solidAt(s.x, s.y)) { s.y -= 6; s.a = -Math.PI / 2; }
      if (Math.hypot(s.x - p.x, s.y - p.y) > 420) this.sibs.splice(i, 1);
    }
  }
  /* ---------- big visitors ---------- */
  startSchool(p) {
    if (this.school) return;
    const dir = this.R() < .5 ? 1 : -1, n = 26, R = this.R;
    this.school = { dir, x: p.x - dir * 420, y: p.y + (R() - .5) * 40, t: 0, fish: [] };
    for (let k = 0; k < n; k++) this.school.fish.push({ dx: (R() - .5) * 170, dy: (R() - .5) * 70, ph: R() * TAU, s: .8 + R() * .4 });
    Bus.emit('fishSchool', this.school);
  }
  startWhale(p) {
    if (this.whale) return;
    const dir = 1;
    this.whale = { dir, x: p.x - dir * 1700, y: clamp(p.y + 30, 120, 480), t: 0, gulp: 0, passed: false };
    Bus.emit('whaleShark', this.whale);
  }
  /* the whale shark's mouth, in world units */
  whaleMouth() { const w = this.whale; return w ? { x: w.x + w.dir * 300, y: w.y + 20 } : null; }
  startManta(p) { if (this.manta) return; this.manta = { x: p.x + 900, y: Math.min(560, p.y + 220), dir: -1, t: 0 }; Bus.emit('manta'); }
  updateSea(dt, p) {
    this.updatePlankton(dt, p);
    this.updateSibs(dt, p);
    /* jellies: keep a few near a swimming megalopa */
    if (p.stage === 'megalopa') {
      const near = this.jellies.filter(j => Math.abs(j.x - p.x) < 700);
      if (near.length < 2 && !this.jellies.some(j => j.rider)) { const side = this.R() < .5 ? -1 : 1; this.jellies.push(this.makeJelly(Math.min(-300, p.x + side * (260 + this.R() * 200)), clamp(p.y + (this.R() - .5) * 100, 30, 420))); }
    }
    for (let i = this.jellies.length - 1; i >= 0; i--) {
      const j = this.jellies[i];
      j.ph += dt * 1.6;
      const pulse = Math.max(0, Math.sin(j.ph)) ** 2;
      if (j.rider) { j.vx += (34 - j.vx) * dt * .8; j.vy += ((Math.min(j.y, 90) - j.y) * .2 - j.vy) * dt; }
      else { const [cx, cy] = this.current(j.x, j.y); j.vx += (cx * .6 - j.vx) * dt * .5; j.vy += (cy * .4 - pulse * 10 + 2 - j.vy) * dt; }
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.y = clamp(j.y, this.seaLevel() + j.r, 600);
      if (j.x > -60 - j.r) { j.x = -60 - j.r; j.vx = 0; }
      if (!j.rider && Math.abs(j.x - p.x) > 2600) this.jellies.splice(i, 1);
    }
    /* the school of fish sweeps past */
    const s = this.school;
    if (s) {
      s.t += dt; s.x += s.dir * 78 * dt; s.y += Math.sin(s.t * 1.2) * 18 * dt;
      for (const f of s.fish) f.ph += dt * 9;
      if ((s.x - p.x) * s.dir > 520) { this.school = null; Bus.emit('schoolGone'); }
    }
    /* the whale shark cruises slowly past, gulping */
    const w = this.whale;
    if (w) {
      w.t += dt; w.x += w.dir * 58 * dt; w.gulp = .5 + .5 * Math.sin(w.t * 1.3);
      w.y += (clamp(p.y + 20, 110, 500) - w.y) * dt * .15;
      const m = this.whaleMouth();
      for (const q of this.plankton) if (Math.hypot(q.x - m.x, q.y - m.y) < 90) q.eaten = true;
      if (!w.passed && (w.x - p.x) * w.dir > 400) { w.passed = true; Bus.emit('whalePassed'); }
      if ((w.x - p.x) * w.dir > 2600) this.whale = null;
    }
    const mt = this.manta;
    if (mt) { mt.t += dt; mt.x += mt.dir * 70 * dt; mt.y += Math.sin(mt.t * .5) * 8 * dt; if ((mt.x - p.x) * mt.dir > 1400) this.manta = null; }
    /* reef fish and the turtle */
    for (const f of this.reefFish) {
      f.ph += dt * 8; f.x += f.dir * f.sp * dt; f.y += Math.sin(f.ph * .2) * 4 * dt;
      if (Math.abs(f.x - f.home) > 120 || f.x > -40 || this.ground.solidAt(f.x + f.dir * 10, f.y)) f.dir *= -1;
    }
    const tu = this.turtle; tu.ph += dt; tu.x += tu.dir * 16 * dt; tu.y = 64 + Math.sin(tu.ph * .3) * 16; if (tu.x > -120) tu.dir = -1; if (tu.x < -820) tu.dir = 1;
    /* eggs bursting into larvae */
    for (let i = this.eggCloud.length - 1; i >= 0; i--) {
      const e = this.eggCloud[i]; e.t += dt;
      e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-dt * 2); e.vy = e.vy * Math.exp(-dt * 2) + 6 * dt;
      if (e.t > 4) this.eggCloud.splice(i, 1);
    }
  }
  /* a mother lets her eggs go: a dark cloud that pops into larvae */
  eggBurst(x, y, n = 70) {
    const R = this.R;
    for (let k = 0; k < n; k++) { const a = -Math.PI + R() * Math.PI * .9 - .1, sp = 10 + R() * 50; this.eggCloud.push({ x: x + (R() - .5) * 8, y: y + (R() - .5) * 4, vx: Math.cos(a) * sp - 16, vy: Math.abs(Math.sin(a)) * sp * .6 + 4, t: R() * .4, pop: .6 + R() * .8 }); }
  }

  /* ============================================================
     THE ISLAND
     ============================================================ */
  inClearing(x) { return this.clearings.some(([a, b]) => x > a && x < b); }
  /* is (x, y) out in the sun?  'burrow' | 'water' | 'shelter' | 'canopy' | 'sun' */
  shadeAt(x, y, w = 6) {
    const S = this.ground;
    if (y > S.surfaceAt(x) + w * .6) return 'burrow';
    if (this.inWater(x, y)) return 'water';
    for (const sh of this.shelters) if (Math.abs(x - sh.x) < sh.w * .5 && Math.abs(y - sh.y) < 30 + w) return 'shelter';
    if (x > 950 && !this.inClearing(x)) return 'canopy';
    return 'sun';
  }
  nearestShelter(x) { let best = null, bd = 1e9; for (const sh of this.shelters) { const d = Math.abs(sh.x - x); if (d < bd) { bd = d; best = sh; } } return best; }
  spawnItem(x, kind, fall) {
    const S = this.ground, k = FOOD_KINDS[kind];
    x = clamp(x, 960, WORLD.right - 200);
    if (x > WORLD.bridgeL - 30 && x < WORLD.bridgeR + 30) x += 300;
    const it = { kind, x, y: S.walkTop(x, 4) - 1, bites: k.bites, rot: (this.R() - .5) * 1.4, age: 0, col: this.R(), fy: fall ? S.walkTop(x, 4) - 500 - this.R() * 300 : null };
    this.items.push(it);
    return it;
  }
  foodNear(x, y, reach) { let best = null, bd = reach; for (const it of this.items) { if (it.bites <= 0 || it.fy !== null) continue; const d = Math.hypot(it.x - x, (it.y - y) * .6); if (d < bd) { bd = d; best = it; } } return best; }

  /* ---------- the robber crab: wanders over, sniffs, eats a fig, wanders off ---------- */
  startRobber(x) { const r = this.robber; if (r.state !== 'away') return; r.state = 'walk'; r.target = clamp(x + 60, 1100, WORLD.right - 200); r.x = r.target + 700; r.dir = -1; r.t = 0; Bus.emit('robber'); }
  updateRobber(dt) {
    const r = this.robber; if (r.state === 'away') return;
    r.t += dt; r.legs += dt * 6;
    if (r.state === 'walk') { r.x += r.dir * 34 * dt; if (Math.abs(r.x - r.target) < 6) { r.state = 'sniff'; r.t = 0; } }
    else if (r.state === 'sniff') { if (r.t > 9) { r.state = 'leave'; r.dir = 1; r.t = 0; Bus.emit('robberGone'); } }
    else if (r.state === 'leave') { r.x += 40 * dt; if (r.x > r.target + 900) { r.state = 'away'; r.done = true; } }
    r.y = this.ground.walkTop(r.x, 24);
  }
  /* ---------- seabirds: a frigatebird circling high; now and then one swoops low ---------- */
  swoop(p) { const b = this.bird; if (b.state !== 'soar') return false; b.state = 'dive'; b.t = 0; b.from = { x: p.x - 500, y: p.y - 420 }; b.target = { x: p.x, y: p.y - 6 }; Bus.emit('birdSwoop', b); return true; }
  updateBird(dt, p) {
    const b = this.bird; b.t += dt; b.ph += dt;
    if (b.state === 'soar') { b.x = p.x + Math.cos(b.ph * .15) * 600; b.y = Math.min(p.y, -100) - 520 + Math.sin(b.ph * .3) * 60; }
    else if (b.state === 'dive') {
      const u = clamp(b.t / 1.6, 0, 1);
      b.x = lerp(b.from.x, b.target.x + 300, u); b.y = lerp(b.from.y, b.target.y, Math.sin(u * Math.PI)) + (1 - Math.sin(u * Math.PI)) * 0;
      if (u > .48 && !b.hit) { b.hit = true; Bus.emit('birdPass', b); }
      if (u >= 1) { b.state = 'soar'; b.hit = false; }
    }
  }

  /* ---------- crowds ---------- */
  /* the baby crabs' red carpet, marching up from the shore */
  startBabies() {
    this.babies.length = 0;
    const R = this.R;
    for (let k = 0; k < 60; k++) this.babies.push({ x: 4 + R() * 110, sp: 7 + R() * 9, ph: R() * TAU, col: R(), wait: R() * 4 + k * .25, s: .85 + R() * .4 });
  }
  /* the migration: crabs pour out of the forest and march for the sea */
  startMarch(p) {
    this.marchers.length = 0;
    const R = this.R;
    for (let k = 0; k < 80; k++) this.marchers.push(this.makeMarcher(p.x - 900 + R() * 1700));
  }
  makeMarcher(x) { const R = this.R; return { x, sp: 34 + R() * 26, ph: R() * TAU, cm: 7.5 + R() * 3.6, form: R() < .9 ? 'red' : R() < .7 ? 'orange' : 'purple', male: R() < .5, pause: 0, arrived: R() < 0 }; }
  updateCrowds(dt, p) {
    const S = this.ground;
    for (const b of this.babies) {
      b.ph += dt * 10;
      if (b.wait > 0) { b.wait -= dt; continue; }
      const sl = Math.abs(S.slopeAt(b.x, 4));
      b.x += b.sp * dt / (1 + sl * 1.2);
      if (this.shadeAt(b.x, S.walkTop(b.x, 3)) === 'shelter' && Math.random() < dt * .3) b.wait = 1 + Math.random() * 3;
    }
    for (let i = this.babies.length - 1; i >= 0; i--) if (this.babies[i].x > 1700) this.babies.splice(i, 1);
    if (!this.marchers.length) return;
    for (const m of this.marchers) {
      m.ph += dt * 9;
      if (m.pause > 0) { m.pause -= dt; continue; }
      if (m.x < WORLD.terraceL + 20) { m.arrived = true; continue; }
      const sl = Math.abs(S.slopeAt(m.x, 6));
      m.x -= m.sp * dt / (1 + sl * 1.1);
      if (Math.random() < dt * .03) m.pause = .5 + Math.random() * 2;
    }
    /* keep the stream flowing past the player */
    for (const m of this.marchers) if (m.x < p.x - 1300 && !m.arrived) Object.assign(m, this.makeMarcher(p.x + 700 + this.R() * 600));
    /* the ones that reached the shore dig in on the terrace (only a few stay in sight) */
    for (const m of this.marchers) if (m.arrived && !m.gone) {
      m.x += Math.sin(m.ph * .05) * 6 * dt; m.x = clamp(m.x, 20, WORLD.terraceR);
      m.stay = (m.stay === undefined ? 2 + Math.random() * 10 : m.stay) - dt;
      if (m.stay < 0 && this.marchers.filter(o => o.arrived && !o.gone && !o.sink).length > 10) m.sink = 0;
      if (m.sink !== undefined) { m.sink += dt * .5; if (m.sink >= 1) m.gone = true; }
    }
  }

  /* ---------- other crabs you can push, meet and follow ---------- */
  sendRival(p) {
    this.rivalsSent = (this.rivalsSent || 0) + 1;
    const cm = this.rivalsSent === 1 ? Math.max(6.5, p.cm - 1.5) : clamp(p.cm + (this.R() - .5) * 2.4, 7, 11.6);
    const from = p.x < 300 ? 1 : -1;
    const n = new CrabNPC(this, { cm, sex: 'boy', form: pick(FORM_KEYS), x: p.x + from * 420 });
    n.goal = p.x + from * (crabUnits(p.cm) * .5 + crabUnits(cm) * .5 + 6); n.role = 'rival';
    this.npcs.push(n);
    return n;
  }
  sendFemale(p) {
    const n = new CrabNPC(this, { cm: Math.max(7, p.cm - 1.2), sex: 'girl', form: p.form, x: Math.min(p.x + 460, WORLD.cliffL - 20) });
    n.goal = p.x + crabUnits(p.cm) * .6 + 14; n.role = 'female';
    this.npcs.push(n);
    return n;
  }
  /* the boys waiting at their burrow doors on the terrace (a girl picks one) */
  makeMaleBurrows() {
    if (this.npcs.some(n => n.role === 'host')) return;
    const S = this.ground;
    for (const x of [230, 340, 450, 560]) {
      const cm = 8.5 + this.R() * 2.8, w = crabUnits(cm), g = S.walkTop(x, 4);
      /* a burrow going down at a slant */
      for (let k = 0; k < 8; k++) S.blob(x + k * 2, g + 4 + k * 5, w * .32, w * .3, MAT.AIR, (m) => m === MAT.SAND);
      S.flushTop();
      const n = new CrabNPC(this, { cm, sex: 'boy', form: this.R() < .85 ? 'red' : 'orange', x });
      n.mode = 'door'; n.goal = x; n.role = 'host'; n.door = { x, y: g };
      this.npcs.push(n);
    }
  }
  rival() { return this.npcs.find(n => n.role === 'rival' && !n.leaving && !n.gone && n.mode !== 'tossed'); }
  female() { return this.npcs.find(n => n.role === 'female' && !n.gone); }
  hosts() { return this.npcs.filter(n => n.role === 'host' && !n.gone && n.mode === 'door'); }

  /* ============================================================
     WEATHER AND SEASONS
     ============================================================ */
  setRain(on, hold = 40) { const W = this.weather; W.state = on ? 'rain' : 'clearing'; W.timer = hold; Bus.emit('weather', W.state); }
  update(dt, tod, p) {
    const G = this.G, W = this.weather, R = this.R;
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const dry = this.season === 'dry';
      const next = { clear: 'cloudy', cloudy: !dry && R() < .55 ? 'rain' : 'clear', rain: 'clearing', clearing: 'clear' }[W.state];
      W.state = next; W.timer = { clear: (dry ? 160 : 80) + R() * 100, cloudy: 25 + R() * 25, rain: 35 + R() * 35, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { clear: .12, cloudy: .7, rain: 1, clearing: .4 }[W.state], tr = W.state === 'rain' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.rain += (tr - W.rain) * (1 - Math.exp(-dt * .5));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    const night = nightAmount(tod);
    this.humid += (clamp(.3 + night * .3 + W.rain * .6 + (this.season === 'wet' ? .1 : -.15), 0, 1) - this.humid) * (1 - Math.exp(-dt * .25));

    if (p.stage === 'zoea' || p.stage === 'megalopa' || p.stage === 'egg' || this.whale || this.school || this.eggCloud.length) this.updateSea(dt, p);
    else { this.plankton.length = 0; this.sibs.length = 0; }

    /* the forest floor: leaves fall now and then, figs and flowers drop; old food is tidied away */
    this.itemClock -= dt;
    if (this.itemClock <= 0) {
      this.itemClock = 2 + R() * 3;
      const nearby = this.items.filter(it => it.bites > 0 && Math.abs(it.x - p.x) < 800).length;
      if (nearby < 14 && p.x > 600) this.spawnItem(p.x + (R() < .5 ? -1 : 1) * (200 + R() * 500), R() < .55 ? 'leaf' : R() < .5 ? 'flower' : R() < .6 ? 'fruit' : 'seedling', true);
      if (this.items.length > 160) { const old = this.items.findIndex(it => Math.abs(it.x - p.x) > 1200); if (old >= 0) this.items.splice(old, 1); }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      if (it.fy !== null) { it.fy += 60 * dt; if (it.fy >= it.y) { it.fy = null; } }
      if (it.bites <= 0) { it.gone = (it.gone || 0) + dt; if (it.gone > 3) this.items.splice(i, 1); }
    }
    this.updateCrowds(dt, p);
    this.updateRobber(dt);
    this.updateBird(dt, p);
    this.ranger.wave += dt;
    for (const n of this.npcs) n.update(dt);
    this.npcs = this.npcs.filter(n => !n.gone);
    if (this.mum) this.mum.ph += dt;
  }
}

/* another red crab: walks, stands at a burrow door, shoves, tumbles, leaves */
class CrabNPC {
  constructor(W, o) {
    this.W = W; this.cm = o.cm; this.sex = o.sex; this.form = o.form || 'red';
    this.x = o.x; this.y = W.ground.walkTop(this.x, 6) - this.feet;
    this.mode = 'walk'; this.face = 1; this.walk = 0; this.t = 0; this.goal = this.x; this.leaving = false; this.gone = false;
    this.vx = 0; this.vy = 0; this.spin = 0; this.lift = 0;
  }
  get w() { return crabUnits(this.cm); }
  get feet() { return this.w * .42; }
  update(dt) {
    const S = this.W.ground;
    this.t += dt;
    if (this.leaveIn !== undefined && this.mode === 'stand') { this.leaveIn -= dt; if (this.leaveIn <= 0) { this.leaveIn = undefined; this.leave(); } }
    if (this.mode === 'walk' || this.mode === 'leave') {
      const gx = this.mode === 'leave' ? this.leaveTo : this.goal, dx = gx - this.x;
      if (Math.abs(dx) > 3) { const sp = (this.mode === 'leave' ? 50 : 40) / (1 + Math.abs(S.slopeAt(this.x, 6)) * 1.1); this.x += sign(dx) * Math.min(Math.abs(dx), sp * dt); this.walk += dt * 12; this.face = sign(dx); }
      else if (this.mode === 'walk') { this.mode = 'stand'; Bus.emit(this.role === 'female' ? 'femaleArrived' : 'rivalArrived', this); }
      else this.gone = true;
      this.y = S.walkTop(this.x, 6) - this.feet;
    } else if (this.mode === 'stand' || this.mode === 'door') {
      this.y = S.walkTop(this.x, 6) - this.feet + (this.mode === 'door' ? this.w * .25 : 0);
    } else if (this.mode === 'tossed') {
      /* pushed off: it tumbles over, rights itself and scuttles away, unhurt */
      this.vy += 600 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += dt * 10 * sign(this.vx);
      const top = S.walkTop(this.x, 6) - this.feet;
      if (this.y >= top && this.vy > 0) { this.y = top; this.spin = 0; this.leave(); }
    } else if (this.mode === 'enter') {
      /* down into a burrow */
      this.sink = (this.sink || 0) + dt * .6; this.y += dt * 14;
      if (this.sink > 1) this.gone = true;
    }
  }
  leave() { this.mode = 'leave'; this.leaving = true; this.leaveTo = this.x < WORLD.cliffR + 200 ? this.x + 900 : (Math.random() < .5 ? this.x - 900 : this.x + 900); }
}
