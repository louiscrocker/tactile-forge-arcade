/* ============================================================
   migration.js — the route south
   ============================================================
   The Route is a very wide strip of world: x from 0 at the
   milkweed patch to `len` at the oyamel forest, ground at y = 0.
   It owns the zones (landscape, sky, what grows there), the nectar
   patches and roost trees you can land on, the thermals, the wind
   field, the storm machine, the lake, and the flock of other
   monarchs that grows as the funnel narrows.
   ============================================================ */
'use strict';

class Route {
  constructor(G, seed, diff) {
    this.G = G;
    this.seed = seed;
    this.diff = diff;
    const rng = this.rng = mulberry32(seed ^ 0x5eed);
    this.len = Math.round(52000 * diff.routeK);
    this.milesPer = ROUTE_MILES / this.len;
    this.bounds = { left: -300, right: this.len + 900, top: -1150, bottom: 0 };
    this.noise = makeNoise1D(seed ^ 0x99);
    this.noise2 = makeNoise1D(seed ^ 0x77);

    this.nectar = [];
    this.trees = [];
    this.props = [];
    this.thermals = [];
    this.lake = null;
    this.buildScenery(rng);

    /* weather */
    this.storm = null;               // { x, w, vx, life, warned }
    this.stormClock = rnd(35, 60) / Math.max(.2, diff.storms);
    this.front = 0;                  // tailwind after a storm, seconds left
    this.gust = 0; this.gustTimer = rnd(12, 30);
    this.gustLeft = 0;
    this.rain = 0;                   // 0..1 eased, at the player's position
    this.cloud = 0;

    /* other monarchs */
    this.flock = [];
    this.flockTarget = 3;

    this.factsDone = new Set();
    this.time = 0;

    /* the forecast: tomorrow's plan, rolled at the roost, applied at dawn */
    this.plan = null;              // today's plan
    this.nextPlan = null;          // tomorrow's, shown in the forecast
    this.windBias = 0;
    this.plannedStormAt = -1;
    this.dayLog = [];              // [tod, energy] samples for the energy graph
    this.logClock = 0;
    this.dayStats = { fly: 0, flap: 0, head: 0, night: 0, thermal: 0 };
  }

  /* ---------- forecasts ---------- */
  rollForecast(x) {
    const z = this.zone(x);
    const r = Math.random();
    const wind = r < .38 ? 1 : r < .68 ? 0 : -1;
    const storm = z.storm > 0 && this.diff.storms > 0 && chance(.22 * z.storm * this.diff.storms);
    const names = { 1: 'Tailwind from the north', 0: 'Light and variable wind', '-1': 'Headwind from the south' };
    const plan = { wind, storm, label: names[wind] + (storm ? ', storm by afternoon' : ', clear skies'), icon: storm ? '⛈️' : wind > 0 ? '💨' : wind < 0 ? '🌬️' : '☀️' };
    this.nextPlan = plan;
    return plan;
  }
  applyForecast() {
    this.plan = this.nextPlan || this.rollForecast(0);
    this.nextPlan = null;
    this.windBias = this.plan.wind * 150 * this.diff.wind;
    this.plannedStormAt = this.plan.storm ? rnd(.46, .6) : -1;
    this.dayLog = []; this.dayStats = { fly: 0, flap: 0, head: 0, night: 0, thermal: 0 };
    Bus.emit('newDay', this.plan);
  }

  /* ---------- building ---------- */
  buildScenery(rng) {
    const L = this.len;
    for (const z of ZONES) {
      const x0 = z.from * L, x1 = z.to * L;
      if (z.key === 'lake' && this.diff.lake) this.lake = { x0: x0 + 300, x1: x1 - 300 };
      if (z.key === 'lake' && !this.diff.lake) {
        /* little kids get a shoreline meadow instead of open water */
        for (let x = x0 + 400; x < x1; x += 1500) this.nectar.push(this.makePatch(x, 'aster', rng));
        for (let x = x0 + 900; x < x1; x += 1700) this.trees.push(this.makeTree(x, 'birch', rng));
      }
      if (z.nectarEvery) for (let x = x0 + 500 + rng() * 400; x < x1 - 300; x += z.nectarEvery * (0.7 + rng() * .6)) this.nectar.push(this.makePatch(x, z.nectar[(rng() * z.nectar.length) | 0], rng));
      if (z.treeEvery) for (let x = x0 + 900 + rng() * 500; x < x1 - 200; x += z.treeEvery * (0.75 + rng() * .5)) this.trees.push(this.makeTree(x, z.trees[(rng() * z.trees.length) | 0], rng, z.key === 'forest'));
      /* thermals every so often, never over the lake */
      if (z.key !== 'lake' && z.key !== 'forest') for (let x = x0 + 1500 + rng() * 800; x < x1 - 600; x += 2600 + rng() * 1800) this.thermals.push({ x, r: 240 + rng() * 80, top: -880, strength: 150 + rng() * 60, hawks: 1 + (rng() * 2 | 0), used: false });
      /* props */
      const propsFor = { north: ['fence', 'sign', 'fence'], lake: [], farm: ['barn', 'corn', 'hay', 'windmill', 'corn', 'fence', 'sign'], plains: ['windmill', 'hay', 'fence', 'cactus', 'sign', 'agave'], mexico: ['agave', 'house', 'church', 'cactus', 'agave', 'sign'], forest: ['stream'] }[z.key] || [];
      if (propsFor.length) for (let x = x0 + 700 + rng() * 600; x < x1 - 300; x += 1100 + rng() * 900) {
        const kind = propsFor[(rng() * propsFor.length) | 0];
        const text = kind === 'sign' ? ({ north: 'SOUTH ↓', farm: 'ILLINOIS', plains: 'TEXAS', mexico: 'MÉXICO' }[z.key] || 'SOUTH') : undefined;
        this.props.push({ x, kind, seed: (rng() * 1e9) | 0, text });
      }
    }
    /* the first patch is right by the milkweed, so a fresh butterfly finds fuel */
    this.nectar.unshift(this.makePatch(700, 'goldenrod', rng));
    this.trees.unshift(this.makeTree(1200, 'maple', rng));
    /* the forest: a dense stand of firs at the very end */
    const fx0 = ZONES[5].from * this.len + 600;
    for (let x = fx0; x < this.len + 400; x += 260 + rng() * 120) this.trees.push(this.makeTree(x, 'fir', rng, true));
    this.trees.sort((a, b) => a.x - b.x);
    this.nectar.sort((a, b) => a.x - b.x);
  }
  makePatch(x, kind, rng) { return { x, kind, seed: (rng() * 1e9) | 0, w: 90 + rng() * 80, nectar: 1, y: -NECTAR_PLANTS[kind].h[1] * .75 }; }
  makeTree(x, kind, rng, fir = false) {
    const h = fir ? 520 + rng() * 260 : (kind === 'pine' ? 300 + rng() * 120 : 240 + rng() * 140);
    return { x, kind, h, seed: (rng() * 1e9) | 0, roost: fir ? .35 + rng() * .5 : 0, landY: -h * (fir ? .5 : .58), fir };
  }

  /* ---------- queries ---------- */
  frac(x) { return clamp(x / this.len, 0, 1); }
  zone(x) { return zoneAt(this.frac(x)); }
  miles(x) { return clamp(x, 0, this.len) * this.milesPer; }
  overWater(x) { return !!this.lake && x > this.lake.x0 && x < this.lake.x1; }

  /* Wind at a point. Positive x = tailwind (south is to the right). */
  wind(x, y) {
    const z = this.zone(x);
    const alt = clamp(-y / 650, 0, 1);
    const altK = 0.3 + 0.7 * alt;                                   // weaker near the ground
    /* slow big-scale pattern, so there are headwind stretches and tailwind stretches */
    const n = this.noise(x / 2200 + this.time / 70) * 2 - 1;
    const n2 = this.noise2(x / 600 + this.time / 25) * 2 - 1;
    let wx = (n * .8 + n2 * .2 + .18) * z.wind * this.diff.wind * 260;
    wx += this.windBias;
    wx *= altK;
    wx += this.gust * 90 * altK;
    if (this.front > 0) wx += 220 * Math.min(1, this.front / 4) * altK;
    let wy = 0;
    if (this.storm && Math.abs(x - this.storm.x) < this.storm.w / 2) {
      const k = 1 - Math.abs(x - this.storm.x) / (this.storm.w / 2);
      wx -= 300 * k * altK; wy += 110 * k;
    }
    for (const t of this.thermals) {
      if (y < t.top || Math.abs(x - t.x) > t.r) continue;
      const k = 1 - Math.abs(x - t.x) / t.r;
      wy -= t.strength * k * (0.4 + .6 * alt);
    }
    return { x: wx, y: wy };
  }
  thermalAt(x, y) { return this.thermals.find(t => y > t.top && Math.abs(x - t.x) < t.r) || null; }
  inStorm(x) { return !!this.storm && Math.abs(x - this.storm.x) < this.storm.w / 2; }

  nectarNear(x, y, r = 90) {
    let best = null, bd = r;
    for (const p of this.nectar) { if (Math.abs(p.x - x) > 400) continue; const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  treeNear(x, y, r = 110) {
    let best = null, bd = r;
    for (const t of this.trees) { if (Math.abs(t.x - x) > 400) continue; const d = dist(x, y, t.x, t.landY); if (d < bd) { bd = d; best = t; } }
    return best;
  }

  /* ---------- per frame ---------- */
  update(dt, p, tod, night) {
    this.time += dt;
    const px = p.x;
    const z = this.zone(px);

    /* gusts */
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) { this.gustTimer = rnd(14, 34); this.gustLeft = rnd(2, 4); }
    if (this.gustLeft > 0) { this.gustLeft -= dt; this.gust = Math.min(1, this.gust + dt * 2); } else this.gust = Math.max(0, this.gust - dt);

    /* storms roll in from ahead and sweep back over you */
    if (!this.storm) {
      this.stormClock -= dt;
      const planned = this.plannedStormAt > 0 && tod >= this.plannedStormAt && tod < .75;
      if (planned) this.plannedStormAt = -1;
      const wantStorm = (planned || (this.stormClock <= 0 && !(this.plan && !this.plan.storm && tod < .75))) && z.storm > 0 && this.diff.storms > 0 && (p.state === 'migrating' || p.state === 'nectaring' || p.state === 'roosting' || p.state === 'resting');
      if (wantStorm) {
        this.storm = { x: px + 2600, w: 1500, vx: -95, life: 46, warned: false, hit: false };
        this.stormClock = rnd(40, 75) / Math.max(.2, this.diff.storms * z.storm);
      }
    } else {
      const s = this.storm;
      s.x += s.vx * dt; s.life -= dt;
      if (!s.warned && s.x - px < 2100) { s.warned = true; Bus.emit('stormWarning', s); Bus.emit('hint', 'stormWarn'); }
      if (s.life <= 0 || s.x + s.w / 2 < px - 1500) { this.storm = null; this.front = 22; Bus.emit('stormOver'); }
    }
    if (this.front > 0) this.front -= dt;
    const inStorm = this.inStorm(px);
    this.rain += (((inStorm) ? 1 : 0) - this.rain) * (1 - Math.exp(-dt * 1.2));
    this.cloud += (((this.storm && Math.abs(this.storm.x - px) < this.storm.w * 1.2) ? 1 : 0) - this.cloud) * (1 - Math.exp(-dt * .8));

    /* the day's log, for the energy graph and the "why" cards */
    this.logClock -= dt;
    if (this.logClock <= 0) { this.logClock = .5; if (this.dayLog.length < 600) this.dayLog.push([tod, p.energy]); }
    if (p.state === 'migrating') {
      const ds = this.dayStats;
      ds.fly += dt; if (p.flapping) ds.flap += dt;
      if (this.wind(p.x, p.y).x < -40) ds.head += dt;
      if (night > .4) ds.night += dt;
      if (this.thermalAt(p.x, p.y)) ds.thermal += dt;
    }

    /* nectar patches regrow */
    for (const n of this.nectar) if (Math.abs(n.x - px) < 4000) n.nectar = Math.min(1, n.nectar + dt / 60);

    /* the flock: more company the further south you get */
    this.flockTarget = Math.round(3 + this.frac(px) * 34);
    if (z.key === 'forest') this.flockTarget = 40;
    while (this.flock.length < this.flockTarget) this.flock.push({ x: px + rnd(-600, 900), y: rnd(-800, -120), ph: rnd(TAU), s: rnd(.4, .85), sp: rnd(.8, 1.2), wob: rnd(.5, 1.5), ang: 0 });
    if (this.flock.length > this.flockTarget) this.flock.length = this.flockTarget;
    const flying = p.state === 'migrating' || p.state === 'winterFly';
    for (const f of this.flock) {
      const w = this.wind(f.x, f.y);
      const cruise = flying ? 120 * f.sp : 0;
      const roostNear = (!flying || night > .6) ? this.treeNear(f.x, f.y, 900) : null;
      if (roostNear) {
        f.x += (roostNear.x + Math.sin(f.ph) * 40 - f.x) * dt * .8; f.y += (roostNear.landY + Math.cos(f.ph) * 30 - f.y) * dt * .8;
      } else {
        f.x += (cruise + w.x * .8) * dt + Math.sin(this.time * f.wob + f.ph) * 30 * dt;
        f.y += w.y * .5 * dt + Math.cos(this.time * f.wob * .7 + f.ph) * 40 * dt;
        if (f.y > -90) f.y = -90; if (f.y < -950) f.y = -950;
      }
      /* keep them around the player */
      if (f.x < px - 900) f.x = px + rnd(300, 900);
      if (f.x > px + 1400) f.x = px - rnd(200, 800);
      f.ang = Math.atan2(Math.cos(this.time * f.wob + f.ph) * .3, 1);
    }

    /* zone facts and hints */
    const fact = (k) => { if (!this.factsDone.has(k)) { this.factsDone.add(k); Bus.emit('fact', k); } };
    if (flying) {
      if (z.key === 'lake' && this.lake) fact('lake');
      if (z.key === 'plains') fact('funnel');
      if (z.key === 'mexico') fact('dia');
      if (z.key === 'forest') { fact('arrive'); }
    }
  }
}
