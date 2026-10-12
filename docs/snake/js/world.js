/* ============================================================
   world.js — everything around the snake
   ============================================================
   covers      boards, logs, flat rocks, limestone slabs, the stone
               wall and leaf piles: climb over them, or push down to
               slide under and hide (the sun warms them; a snake under
               one is snug).  Rocks and slabs are basking spots.
   snacks      hidden until a tongue flick smells them, then they
               sparkle.  (In play a snack is only ever "a snack".)
   critters    frogs (plop into the pond), worms (wriggle back into
               the soil), grasshoppers, butterflies, dragonflies,
               fireflies on summer nights.  Nothing is ever caught.
   snakes      SnakeNPC: the mother and the litter in their bags,
               snakes on their way to the den in autumn, the winter
               crowd, the spring gathering, a girl and the other boys
               in the race, the boys a girl may meet, a new litter.
   visitors    the hawk (circles, dives, always misses), the raccoon
               (pokes about, leaves; a musk sends it off), the heron
               (stands in the pond, strikes, always misses), the snake
               scientist and her coverboard (counts, measures, puts
               you back).  Their outcomes live in Snake.struck().
   trails      scent trails: the old snakes' trail to the den in
               autumn, a girl's trail in spring.
   weather     sun, cloud, rain (worms come up), snow in winter;
               seasons; air temperature for the HUD.
   ============================================================ */
'use strict';

const COVER_KINDS = {
  board:  { name: 'old board', w: 76, h: 7, rough: true, bask: false, hide: true },
  log:    { name: 'log', w: 100, h: 26, rough: true, bask: false, hide: true },
  rock:   { name: 'flat rock', w: 64, h: 16, rough: true, bask: true, hide: true },
  slab:   { name: 'limestone slab', w: 84, h: 18, rough: true, bask: true, hide: true },
  wall:   { name: 'stone wall', w: 170, h: 40, rough: true, bask: true, hide: true },
  leaves: { name: 'leaf pile', w: 72, h: 13, rough: false, bask: false, hide: true },
  coverboard: { name: 'coverboard', w: 84, h: 6, rough: true, bask: false, hide: true }
};

class SnakeNPC {
  constructor(W, o) {
    this.W = W; this.isNPC = true;
    Object.assign(this, { x: 0, len: 110, form: 'eastern', sex: 'boy', mode: 'coil', face: 1, goal: null, speed: 30, alpha: 1, ph: rnd(TAU), tongueT: 0, tongueClock: rnd(1, 4), sacT: 0, s: 0, gone: false, role: null, fade: 0, coilR: null }, o);
    this.trail = []; this.dist = 0;
    this.y = W.topAt(this.x) - this.thick * .5;
    if (this.mode === 'coil' || this.mode === 'sac') this.coilUp(); else this.resetTrail();
  }
  get thick() { return this.len * .085; }
  resetTrail() { const W = this.W; Trail.reset(this.trail, this.x, this.y, this.face, this.len, (x) => W.topAt(x), this.thick * .5); }
  coilUp() { const W = this.W; this.trail = Trail.coil(this.len, this.thick, this.x - this.face * this.len * .08, W.topAt(this.x), this.face, this.len < 50 ? 1.3 : 1.7); this.coiled = true; }
  update(dt) {
    const W = this.W;
    this.ph += dt * 5;
    this.tongueClock -= dt; if (this.tongueClock <= 0) { this.tongueClock = rnd(1.5, 5); this.tongueT = .5; }
    this.tongueT = Math.max(0, this.tongueT - dt);
    if (this.fade > 0) { this.alpha = Math.max(0, this.alpha - dt * this.fade); if (this.alpha <= 0) this.gone = true; }
    if (this.mode === 'sac') { this.sacT -= dt; if (this.sacT <= 0) { this.mode = this.goal !== null ? 'crawl' : 'coil'; W.G.particles.sparkle(this.x, this.y - 4, 6, '#e8f4ff', 8); Bus.emit('sacBroke', this); } return; }
    if (this.mode === 'den') {
      /* along the crack in the rock */
      const L = W.land, target = this.goal === null ? L.pathLen : this.goal;
      const d = target - this.s, step = this.speed * dt;
      if (Math.abs(d) <= step) { this.s = target; if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(this); } }
      else this.s += Math.sign(d) * step;
      const q = L.pointAt(this.s); this.x = q.x; this.y = q.y; this.face = (q.tx * Math.sign(d || 1)) >= 0 ? 1 : -1;
      this.coiled = false; this.dist += step;
      Trail.push(this.trail, this.x, this.y, this.len, 3, 0);
      return;
    }
    if ((this.mode === 'crawl' || this.mode === 'race' || this.mode === 'leave') && this.goal !== null) {
      const dx = this.goal - this.x, step = this.speed * dt;
      if (Math.abs(dx) <= step) {
        this.x = this.goal;
        if (this.mode === 'leave') { this.fade = this.fade || 1; }
        else { this.mode = this.arriveMode || 'coil'; if (this.mode === 'coil') this.coilUp(); if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(this); } }
      } else { this.x += Math.sign(dx) * step; this.face = Math.sign(dx); this.dist += step; this.coiled = false; }
      this.y = W.topAt(this.x) - this.thick * .5;
      if (this.mode !== 'coil') Trail.push(this.trail, this.x, this.y, this.len, 3, Trail.wave(this.dist, this.len));
      return;
    }
    if (this.mode === 'coil' && !this.coiled) this.coilUp();
    this.y = W.topAt(this.x) - this.thick * .5;
  }
}

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed * 13 + 7);
    this.land = new Land(seed);
    this.t = 0; this.season = 'summer';
    this.weather = { state: 'sun', timer: 60, cloud: .1, rain: 0, snow: 0, snowCover: 0, gust: 0 };
    this.bounds = { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom };
    /* ---- covers ---- */
    this.covers = [];
    const put = (kind, x) => { const c = Object.assign({ kind, x, id: this.covers.length }, COVER_KINDS[kind]); c.w *= .9 + R() * .2; this.covers.push(c); return c; };
    put('slab', WORLD.hillC + 60); put('slab', WORLD.hillC + 250); put('slab', WORLD.hillC - 170); put('rock', WORLD.hillC + 330);
    put('rock', -480); put('board', -300); put('leaves', -130); put('log', 70); put('rock', 340); put('board', 540);
    put('rock', 780); put('log', 980); put('leaves', 1170); put('log', 1290);
    put('rock', 2260); put('wall', 2470); put('log', 2760); put('leaves', 2960); put('board', 3140);
    for (const c of this.covers) this.placeCover(c);
    /* ---- decorations that never move: grass tufts, flowers, cattails, trees ---- */
    this.flowers = []; for (let i = 0; i < 90; i++) { const x = lerp(WORLD.meadowL - 300, WORLD.meadowR + 60, R()); if (this.land.inPond(x)) continue; this.flowers.push({ x, h: 14 + R() * 26, col: pick(['#f2d043', '#ffffff', '#c86ad8', '#f08a3a', '#7ab0f0', '#ff6a8a']), ph: R() * TAU, k: R() }); }
    this.reeds = []; for (let i = 0; i < 34; i++) { const edge = R() < .5 ? WORLD.pondL + R() * 150 : WORLD.pondR - R() * 150; this.reeds.push({ x: edge, h: 50 + R() * 50, ph: R() * TAU }); }
    this.pads = []; for (let i = 0; i < 9; i++) this.pads.push({ x: lerp(WORLD.pondL + 180, WORLD.pondR - 180, R()), r: 9 + R() * 8, flower: R() < .35 });
    this.trees = []; for (let x = WORLD.woodsL + 100; x < WORLD.right; x += 120 + R() * 140) this.trees.push({ x, h: 260 + R() * 160, w: 90 + R() * 50, kind: R() < .5 ? 'maple' : R() < .6 ? 'oak' : 'pine', seed: (R() * 1e6) | 0 });
    this.trees.push({ x: -40, h: 280, w: 150, kind: 'oak', seed: 77 }); this.trees.push({ x: 1180, h: 220, w: 120, kind: 'maple', seed: 91 });
    this.trees.push({ x: WORLD.hillL + 120, h: 200, w: 80, kind: 'pine', seed: 12 }); this.trees.push({ x: WORLD.hillC - 330, h: 170, w: 70, kind: 'pine', seed: 13 });
    /* ---- living things ---- */
    this.snacks = []; this.snackClock = 0;
    this.critters = [];
    for (let i = 0; i < 4; i++) { const left = i % 2 === 0, x = left ? WORLD.pondL + 20 + R() * 70 : WORLD.pondR - 20 - R() * 70; this.critters.push({ kind: 'frog', x, home: x, y: 0, state: 'sit', t: 0, face: left ? 1 : -1, vy: 0, ph: R() * TAU }); }
    for (let i = 0; i < 7; i++) this.critters.push({ kind: 'hopper', x: lerp(WORLD.meadowL, WORLD.meadowR, R()), y: 0, state: 'sit', t: R() * 3, vx: 0, vy: 0 });
    for (let i = 0; i < 6; i++) this.critters.push({ kind: 'butterfly', x: lerp(WORLD.meadowL, WORLD.meadowR, R()), y: -40 - R() * 60, ph: R() * TAU, col: pick(['#f0a020', '#ffffff', '#f2d043', '#7ab0f0']), vx: rnd(-14, 14) });
    for (let i = 0; i < 4; i++) this.critters.push({ kind: 'dragonfly', x: lerp(WORLD.pondL + 100, WORLD.pondR - 100, R()), y: -20 - R() * 40, ph: R() * TAU, vx: 0, vy: 0, t: 0 });
    for (let i = 0; i < 30; i++) this.critters.push({ kind: 'firefly', x: lerp(WORLD.meadowL, WORLD.meadowR + 300, R()), y: -10 - R() * 70, ph: R() * TAU, per: 2 + R() * 2.5 });
    this.worms = [];
    this.npcs = []; this.mum = null;
    this.exuviae = [];
    this.trail = null;
    this.hawk = null; this.raccoon = null; this.heron = null; this.sci = null;
    this.denCrowd = 0;       /* snakes resting in the den's chamber (drawn as a tangle) */
    this.boardDone = false;
  }

  /* ---------- the ground with its covers ---------- */
  placeCover(c) { c.y = this.land.walkY(c.x); c.tilt = (this.land.walkY(c.x + c.w / 2) - this.land.walkY(c.x - c.w / 2)) / c.w; }
  coverTop(c, x) {
    const u = (x - c.x) / (c.w / 2);
    if (u <= -1 || u >= 1) return null;
    const base = c.y + c.tilt * (x - c.x);
    if (c.kind === 'board' || c.kind === 'coverboard') return base - c.h * smoothstep(1, .82, Math.abs(u));
    if (c.kind === 'wall') return base - c.h * Math.pow(1 - Math.pow(Math.abs(u), 4), .5);
    if (c.kind === 'leaves') return base - c.h * Math.pow(1 - u * u, .8);
    return base - c.h * Math.sqrt(1 - u * u);
  }
  /* what a crawling snake's belly rests on: the ground, the water, or the top of a rock, log or board */
  topAt(x) {
    let y = this.land.walkY(x);
    for (const c of this.covers) { if (c.lifted) continue; const t = this.coverTop(c, x); if (t !== null && t < y) y = t; }
    return y;
  }
  coverAt(x, pad = 0) { let best = null, bd = 1e9; for (const c of this.covers) { if (c.lifted) continue; const d = Math.abs(x - c.x); if (d < c.w / 2 + pad && d < bd) { bd = d; best = c; } } return best; }
  /* a rough edge to rub a nose on: any rock, log, board or wall close by */
  roughNear(x, r) { return this.covers.find(c => c.rough && !c.lifted && Math.abs(x - c.x) < c.w / 2 + r) || null; }
  baskSpot(x) { const c = this.coverAt(x); return c && c.bask ? c : null; }

  /* ---------- seasons and weather ---------- */
  setSeason(s) {
    if (!SEASON_INFO[s]) return;
    this.season = s;
    const wx = this.weather;
    if (s === 'winter') { wx.state = 'snow'; wx.timer = 40; wx.snowCover = 1; }
    else if (s === 'spring') { wx.state = 'sun'; wx.timer = 60; wx.snowCover = .35; }
    else { wx.snowCover = 0; if (wx.state === 'snow') { wx.state = 'sun'; wx.timer = 50; } }
  }
  setRain(on, t = 40) { const wx = this.weather; wx.state = on ? 'rain' : 'sun'; wx.timer = t; }
  /* air temperature (°C) for the HUD */
  airTemp(tod) { const si = SEASON_INFO[this.season]; return lerp(si[2], si[1], sunAmount(tod)) - this.weather.cloud * 3 - this.weather.rain * 3; }
  /* how strong the sunshine is on the ground right now (0..1) */
  sun(tod) { return sunAmount(tod) * SEASON_INFO[this.season][3] * (1 - this.weather.cloud * .75); }
  /* the birth pulses: a glow that swells and fades */
  pulse() { return Math.pow((Math.sin(this.t * TAU / 3.2 - Math.PI / 2) + 1) / 2, 1.6); }
  pulseIndex() { return Math.floor((this.t + .8) / 3.2); }

  update(dt, tod, p) {
    this.t += dt;
    const wx = this.weather, G = this.G;
    /* weather: sunny spells, clouds and summer rain (winter: snow) */
    wx.timer -= dt;
    if (wx.timer <= 0) {
      if (this.season === 'winter') { wx.state = this.R() < .6 ? 'snow' : 'cloud'; wx.timer = 30 + this.R() * 30; }
      else { const r = this.R(); wx.state = r < .55 ? 'sun' : r < .82 ? 'cloud' : 'rain'; wx.timer = wx.state === 'rain' ? 22 + this.R() * 20 : 50 + this.R() * 60; }
      if (wx.state === 'rain') Bus.emit('rainStart');
    }
    const cloudGoal = wx.state === 'sun' ? .1 : wx.state === 'cloud' ? .6 : .9;
    wx.cloud += (cloudGoal - wx.cloud) * Math.min(1, dt * .3);
    wx.rain += ((wx.state === 'rain' ? 1 : 0) - wx.rain) * Math.min(1, dt * .4);
    wx.snow += ((wx.state === 'snow' ? 1 : 0) - wx.snow) * Math.min(1, dt * .4);
    wx.gust = .5 + .5 * Math.sin(this.t * .3) * Math.sin(this.t * .11 + 1);
    if (this.season !== 'winter' && wx.snowCover > 0) wx.snowCover = Math.max(0, wx.snowCover - dt * .006);
    /* snacks: a few hidden ones always somewhere near the snake (not on the hill in summer, never in the water) */
    this.snackClock -= dt;
    if (this.snackClock <= 0 && p && p.stage === 'snake') {
      this.snackClock = 2.5;
      const near = this.snacks.filter(s => Math.abs(s.x - p.x) < 900).length;
      if (near < 7 && this.season !== 'winter') {
        for (let tries = 0; tries < 30; tries++) {
          const x = p.x + (this.R() < .5 ? -1 : 1) * (120 + this.R() * 650);
          if (x < WORLD.hillR - (this.season === 'spring' ? 500 : 60) || x > WORLD.woodsR || this.land.inPond(x) || this.coverAt(x, 6)) continue;
          if (this.snacks.some(s => Math.abs(s.x - x) < 70)) continue;
          this.snacks.push({ x, y: this.land.walkY(x), val: 4 + ((this.R() * 3) | 0), seen: false, t: 0, glint: this.R() * TAU });
          break;
        }
      }
      if (this.snacks.length > 40) this.snacks.splice(0, this.snacks.length - 40);
    }
    for (const s of this.snacks) s.t += dt;
    /* worms come up after rain, and go back down when a snake comes near */
    if (wx.rain > .5 && this.worms.length < 8 && this.R() < dt * .8 && p) { const x = p.x + rnd(-500, 500); if (x > WORLD.meadowL && x < WORLD.meadowR && !this.land.inPond(x)) this.worms.push({ x, y: this.land.walkY(x), up: 0, state: 'up', ph: rnd(TAU) }); }
    for (const w of this.worms) {
      w.ph += dt * 4;
      if (w.state === 'up') { w.up = Math.min(1, w.up + dt * .8); if (p && Math.abs(p.x - w.x) < 70 && p.stage === 'snake') { w.state = 'down'; Bus.emit('wormDown', w); } if (wx.rain < .1 && this.R() < dt * .1) w.state = 'down'; }
      else { w.up -= dt * 1.4; if (w.up <= 0) w.gone = true; }
    }
    this.worms = this.worms.filter(w => !w.gone);
    this.updateCritters(dt, tod, p);
    for (const n of this.npcs) n.update(dt);
    this.npcs = this.npcs.filter(n => !n.gone);
    if (this.mum) this.mum.update(dt);
    if (this.mum && this.mum.gone) this.mum = null;
    for (const e of this.exuviae) e.t += dt;
    if (this.trail) this.trail.age += dt;
    this.updateHawk(dt, p); this.updateRaccoon(dt, p); this.updateHeron(dt, p); this.updateScientist(dt, p);
  }

  updateCritters(dt, tod, p) {
    const L = this.land, near = (c, r) => p && p.stage === 'snake' && Math.abs(p.x - c.x) < r && Math.abs(p.y - (c.y || 0)) < 80;
    for (const c of this.critters) {
      c.ph = (c.ph || 0) + dt;
      if (c.kind === 'frog') {
        if (c.state === 'sit') { c.y = L.walkY(c.x); if (near(c, 90) && this.season !== 'winter') { c.state = 'hop'; c.vx = c.face * 90; c.vy = -110; Bus.emit('frogHop', c); } }
        else if (c.state === 'hop') { c.vy += 300 * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.vy > 0 && c.y >= L.walkY(c.x)) { if (L.inPond(c.x)) { c.state = 'under'; c.t = 10 + rnd(6); this.G.particles.ring(c.x, WORLD.waterY, 'rgba(220,240,255,.8)', 3, 40, .7); this.G.particles.splat(c.x, WORLD.waterY, 'rgba(200,230,255,.9)', 6); Bus.emit('frogPlop', c); } else { c.vx = c.face * 90; c.vy = -110; c.y = L.walkY(c.x); } } }
        else if (c.state === 'under') { c.t -= dt; if (c.t <= 0 && !near(c, 260)) { c.state = 'sit'; c.x = c.home; } }
      } else if (c.kind === 'hopper') {
        c.t -= dt; const gy = L.walkY(c.x);
        if (c.state === 'sit') { c.y = gy; if (c.t <= 0 || near(c, 60)) { c.state = 'jump'; const away = p && Math.abs(p.x - c.x) < 120 ? sign(c.x - p.x) : (Math.random() < .5 ? -1 : 1); c.vx = away * rnd(40, 90); c.vy = -rnd(80, 140); } }
        else { c.vy += 260 * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.y >= L.walkY(c.x) && c.vy > 0) { c.y = L.walkY(c.x); c.state = 'sit'; c.t = rnd(2, 6); } if (c.x < WORLD.meadowL || c.x > WORLD.meadowR || L.inPond(c.x)) { c.vx = -c.vx; c.x = clamp(c.x, WORLD.meadowL, WORLD.meadowR); } }
      } else if (c.kind === 'butterfly') {
        c.x += (c.vx + Math.sin(c.ph * .7) * 12) * dt; c.y = -40 + Math.sin(c.ph * .9) * 30 + L.walkY(c.x) - 20;
        if (c.x < WORLD.meadowL - 200 || c.x > WORLD.meadowR + 100) c.vx = -c.vx;
      } else if (c.kind === 'dragonfly') {
        c.t -= dt; if (c.t <= 0) { c.t = rnd(.6, 2); c.vx = rnd(-80, 80); c.vy = rnd(-30, 30); }
        c.x = clamp(c.x + c.vx * dt, WORLD.pondL + 60, WORLD.pondR - 60); c.y = clamp(c.y + c.vy * dt, -90, -6); c.vx *= Math.exp(-dt * 1.5); c.vy *= Math.exp(-dt * 1.5);
      }
    }
  }

  /* ---------- smelling: a tongue flick finds the snacks (and the scent trail) close by ---------- */
  sniff(x, y, r) {
    let n = 0;
    for (const s of this.snacks) if (!s.seen && Math.abs(s.x - x) < r) { s.seen = true; s.t = 0; n++; }
    return n;
  }
  snackNear(x, y, r) { let best = null, bd = 1e9; for (const s of this.snacks) { if (!s.seen) continue; const d = Math.abs(s.x - x); if (d < r && Math.abs(s.y - y) < 60 && d < bd) { bd = d; best = s; } } return best; }
  nearestSeenSnack(x) { let best = null, bd = 1e9; for (const s of this.snacks) { if (!s.seen) continue; const d = Math.abs(s.x - x); if (d < bd) { bd = d; best = s; } } return best; }
  eatSnack(s) { const i = this.snacks.indexOf(s); if (i >= 0) this.snacks.splice(i, 1); }
  exuviaNear(x, y, r) { return this.exuviae.find(e => !e.looked && Math.abs(e.x - x) < r + e.len * .3 && Math.abs(e.y - y) < 60) || null; }

  /* ---------- the snakes ---------- */
  addSnake(o) { const n = new SnakeNPC(this, o); this.npcs.push(n); return n; }
  /* the mother and her litter, each baby in its thin clear bag, at the start of a life */
  makeLitter(x, form) {
    const sexes = ['boy', 'girl'];
    this.mum = new SnakeNPC(this, { x: x - 70, len: snakeUnits(58), form, sex: 'girl', mode: 'coil', face: 1, role: 'mum' });
    for (let i = 0; i < 10; i++) {
      const bx = x + (i < 5 ? i - 5 : i - 4) * 34 + rnd(-4, 4);
      this.addSnake({ x: bx, len: snakeUnits(18), form: Math.random() < .85 ? form : pick(FORM_KEYS.slice(0, 2)), sex: pick(sexes), mode: 'sac', sacT: 2 + rnd(10), goal: bx + rnd(-500, 500), speed: rnd(16, 26), role: 'sib', arriveMode: 'coil' });
    }
  }
  /* the litter slithers away into the grass, one by one (they look after themselves) */
  sibsLeave() { for (const n of this.npcs) if (n.role === 'sib') { if (n.mode === 'sac') n.sacT = Math.min(n.sacT, rnd(.5, 3)); n.mode = n.mode === 'sac' ? 'sac' : 'leave'; n.goal = n.x + sign(n.x - WORLD.birthX + .1) * rnd(500, 900); n.speed = rnd(18, 28); n.arriveMode = 'leave'; n.fadeOnArrive = true; } }
  /* autumn: older snakes crawl to the den along the scent trail */
  startAutumn(p) {
    const L = this.land, m = L.mouth;
    const pts = []; for (let x = Math.max(p.x, m.x + 300) + 200; x >= m.x; x -= 10) pts.push({ x, y: this.land.walkY(x) });
    this.trail = { kind: 'den', pts, age: 0 };
    for (let i = 0; i < 6; i++) {
      const x = clamp(p.x + rnd(-300, 600), m.x + 200, WORLD.meadowR - 100);
      const n = this.addSnake({ x, len: snakeUnits(rnd(46, 62)), form: Math.random() < .8 ? this.G.form : pick(FORM_KEYS), sex: pick(['boy', 'girl']), mode: 'crawl', goal: m.x, speed: rnd(26, 40), role: 'migrant', arriveMode: 'den' });
      n.onArrive = (s) => { s.mode = 'den'; s.s = 0; s.goal = this.land.pathLen; s.speed = 24; s.onArrive = (q) => { q.gone = true; this.denCrowd++; }; };
    }
  }
  /* spring: the den's snakes come out and lie in heaps on the warm rocks */
  springCrowd(n = 9) {
    const m = this.land.mouth;
    for (let i = 0; i < n; i++) {
      const x = m.x + rnd(-260, 240);
      this.addSnake({ x, len: snakeUnits(rnd(40, 62)), form: Math.random() < .8 ? this.G.form : pick(FORM_KEYS), sex: pick(['boy', 'girl']), mode: 'coil', role: 'crowd' });
    }
    this.denCrowd = 0;
  }
  crowdLeave() { for (const n of this.npcs) if (n.role === 'crowd' || n.role === 'boy') { n.mode = 'leave'; n.goal = n.x + rnd(700, 1400); n.speed = rnd(22, 36); n.fade = 0; } }
  /* the boy's spring race: a girl comes out of the den and slithers away down the hill;
     two other boys follow her trail too */
  sendGirl(p) {
    const m = this.land.mouth, goal = m.x + 420 + rnd(0, 120);
    const g = this.addSnake({ x: m.x + 4, len: snakeUnits(60), form: Math.random() < .85 ? this.G.form : pick(FORM_KEYS), sex: 'girl', mode: 'race', goal, speed: 0, role: 'girl', arriveMode: 'coil' });
    g.y = m.y; g.trailPts = [];
    const base = p.raceSpeed();
    g.speed = base * .5;
    const rivals = [];
    for (let i = 0; i < 2; i++) {
      const r = this.addSnake({ x: m.x - 60 - i * 70, len: snakeUnits(rnd(50, 56)), form: Math.random() < .8 ? this.G.form : pick(FORM_KEYS), sex: 'boy', mode: 'race', goal, speed: base * this.G.diff().rival * (1 - i * .08), role: 'rival', arriveMode: 'coil' });
      rivals.push(r);
    }
    this.race = { girl: g, rivals, t: 0, done: null };
    Bus.emit('girlOut', g);
    return g;
  }
  updateRace(dt, p) {
    const r = this.race; if (!r || r.done) return;
    r.t += dt;
    const g = r.girl;
    if (!g.trailPts.length || Math.abs(g.trailPts[g.trailPts.length - 1].x - g.x) > 8) g.trailPts.push({ x: g.x, y: g.y });
    /* the other boys follow the trail, but never closer than her tail */
    for (const b of r.rivals) { if (b.mode === 'coil' || b.mode === 'race') { b.goal = g.x - g.face * (g.len * .5 + 10); if (b.mode === 'coil' && Math.abs(b.x - b.goal) > 4) b.mode = 'race'; } }
    if (p && Math.abs(p.x - g.x) < g.len * .5 + 30 && Math.abs(p.y - g.y) < 50) return;   /* he is beside her: Space to say hello */
    const first = r.rivals.find(b => Math.abs(b.x - g.x) < g.len * .5 + 22 && g.mode === 'coil');
    if (first) {
      r.done = 'lost';
      /* she and the other boy slither off together; the third boy wanders away */
      g.mode = 'leave'; g.goal = g.x + 900; g.speed = 30; g.fade = 0; first.mode = 'leave'; first.goal = g.x + 880; first.speed = 30;
      for (const b of r.rivals) if (b !== first) { b.mode = 'leave'; b.goal = b.x + 600; b.speed = 26; }
      Bus.emit('raceLost', g);
    }
  }
  endRace(won) { const r = this.race; if (!r) return; r.done = won ? 'won' : r.done || 'lost'; for (const b of r.rivals) { b.mode = 'leave'; b.goal = b.x + 700; b.speed = 28; } }
  /* the girl's spring: boys wait by the den for her */
  makeBoys(p) {
    const m = this.land.mouth, out = [];
    for (const dx of [-210, -90, 120, 260]) out.push(this.addSnake({ x: m.x + dx, len: snakeUnits(rnd(48, 54)), form: Math.random() < .8 ? this.G.form : pick(FORM_KEYS), sex: 'boy', mode: 'coil', role: 'boy', face: dx < 0 ? 1 : -1 }));
    return out;
  }
  boys() { return this.npcs.filter(n => n.role === 'boy' && n.mode === 'coil'); }
  /* a new litter: babies in their bags, breaking out and slithering off */
  babyBurst(x, n, form) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.addSnake({ x: x + rnd(-24, 24), len: snakeUnits(rnd(16, 19)), form: Math.random() < .85 ? form : pick(FORM_KEYS), sex: pick(['boy', 'girl']), mode: 'sac', sacT: rnd(.8, 3.5), goal: x + rnd(-700, 700), speed: rnd(16, 26), role: 'baby', arriveMode: 'coil' }));
    for (const b of out) b.onArrive = (s) => { s.fade = .4; };
    return out;
  }

  /* ---------- visitors (they never hurt anyone) ---------- */
  startHawk(p) {
    if (this.hawk) return null;
    this.hawk = { state: 'circle', x: p.x, y: -420, cx: p.x + rnd(-80, 80), t: 0, tx: 0, ty: 0, struck: false };
    Bus.emit('hawk', this.hawk);
    return this.hawk;
  }
  updateHawk(dt, p) {
    const h = this.hawk; if (!h) return;
    h.t += dt;
    if (h.state === 'circle') {
      h.cx += ((p ? p.x : h.cx) - h.cx) * Math.min(1, dt * .4);
      h.x = h.cx + Math.cos(h.t * .9) * 170; h.y = -380 + Math.sin(h.t * 1.8) * 26;
      if (h.t > 6) { h.state = 'dive'; h.t = 0; h.sx = h.x; h.sy = h.y; h.tx = p ? p.x : h.x; h.ty = p ? p.y - 10 : 0; Bus.emit('hawkDive', h); }
    } else if (h.state === 'dive') {
      const u = clamp(h.t / 1.1, 0, 1), e = u * u;
      h.x = lerp(h.sx, h.tx, e); h.y = lerp(h.sy, h.ty - 26, e);
      if (u >= 1 && !h.struck) { h.struck = true; if (p) p.struck(h); h.state = 'up'; h.t = 0; this.G.particles.puff(h.x, h.ty + 4, '#c8b888', 8); }
    } else if (h.state === 'up') { h.x += 200 * dt; h.y -= 230 * dt; if (h.t > 2.5) { this.hawk = null; Bus.emit('hawkGone'); } }
  }
  startRaccoon(p) {
    if (this.raccoon) return null;
    let dir = Math.random() < .5 ? -1 : 1;
    /* it comes along dry land, never through the pond */
    const wet = (d) => { for (let x = p.x; Math.abs(x - p.x) <= 520; x -= d * 20) if (this.land.inPond(x)) return true; return false; };
    if (wet(dir)) dir = -dir;
    if (wet(dir)) return null;
    this.raccoon = { state: 'come', x: p.x - dir * 520, dir, t: 0, y: 0, ph: 0, musked: false };
    Bus.emit('raccoon', this.raccoon);
    return this.raccoon;
  }
  updateRaccoon(dt, p) {
    const r = this.raccoon; if (!r) return;
    r.t += dt; r.ph += dt * 8;
    r.y = this.land.walkY(r.x);
    if (r.state === 'come') { r.x += r.dir * 46 * dt; if (p && Math.abs(p.x - r.x) < 70) { r.state = 'sniff'; r.t = 0; } if (r.t > 22) r.state = 'leave'; }
    else if (r.state === 'sniff') {
      if (r.t > 2.6 && !r.checked) { r.checked = true; if (p) p.struck(r); }
      if (r.t > (r.musked ? 3.2 : 4.2)) { r.state = 'leave'; r.t = 0; }
    } else if (r.state === 'leave') { r.x += (r.musked ? -r.dir * 120 : r.dir * 50) * dt; if (r.t > 8) { this.raccoon = null; Bus.emit('raccoonGone'); } }
    if (this.land.inPond(r.x)) r.x -= r.dir * 46 * dt;
  }
  startHeron(p) {
    if (this.heron) return null;
    const x = clamp(p.x + (Math.random() < .5 ? -110 : 110), WORLD.pondL + 60, WORLD.pondR - 60);
    this.heron = { state: 'fly', x: x + 500, y: -300, gx: x, t: 0, struck: false, face: -1 };
    Bus.emit('heron', this.heron);
    return this.heron;
  }
  updateHeron(dt, p) {
    const h = this.heron; if (!h) return;
    h.t += dt;
    const gy = Math.min(this.land.surfaceAt(h.gx), WORLD.waterY + 30);
    if (h.state === 'fly') { const u = clamp(h.t / 2.4, 0, 1); h.x = lerp(h.gx + 500, h.gx, easeOutCubic(u)); h.y = lerp(-300, gy, easeOutCubic(u)); if (u >= 1) { h.state = 'stand'; h.t = 0; } }
    else if (h.state === 'stand') { h.y = gy; if (p) h.face = sign(p.x - h.x); if (h.t > 4.5) { h.state = 'strike'; h.t = 0; } }
    else if (h.state === 'strike') { if (h.t > .45 && !h.struck) { h.struck = true; if (p && Math.abs(p.x - h.x) < 110) p.struck(h); else Bus.emit('heronMissed', h); this.G.particles.splat(h.x + h.face * 40, WORLD.waterY, 'rgba(200,230,255,.9)', 8); } if (h.t > 1.4) { h.state = 'leave'; h.t = 0; } }
    else if (h.state === 'leave') { h.x -= 180 * dt; h.y -= 140 * dt; if (h.t > 3) { this.heron = null; Bus.emit('heronGone'); } }
  }
  /* the snake scientist lays a coverboard, comes back later and lifts it */
  startScientist(p) {
    if (this.sci || this.boardDone) return null;
    const x = clamp(p.x + 110 * (p.face || 1), WORLD.meadowL + 80, WORLD.meadowR - 120);
    const bx = this.coverAt(x, 40) ? x + 130 : x;
    this.sci = { state: 'walk', x: bx + 600, gx: bx, t: 0, board: null, ph: 0, face: -1, holding: false };
    Bus.emit('scientist', this.sci);
    return this.sci;
  }
  updateScientist(dt, p) {
    const s = this.sci; if (!s) return;
    s.t += dt;
    const walk = (to, sp = 60) => { const d = to - s.x; if (Math.abs(d) < sp * dt) { s.x = to; return true; } s.x += Math.sign(d) * sp * dt; s.face = Math.sign(d); s.ph += dt * 6; return false; };
    if (s.state === 'walk') { if (walk(s.gx + 50)) { s.state = 'lay'; s.t = 0; } }
    else if (s.state === 'lay') { if (s.t > 1.2 && !s.board) { const c = Object.assign({ kind: 'coverboard', x: s.gx, id: this.covers.length }, COVER_KINDS.coverboard); this.placeCover(c); this.covers.push(c); s.board = c; Bus.emit('boardDown', c); } if (s.t > 2) { s.state = 'away'; s.t = 0; } }
    else if (s.state === 'away') { if (walk(s.gx + 700)) { s.ph = 0; } if (s.t > 30 || (p && p.mode === 'hide' && p.cover === s.board && s.t > 8)) { s.state = 'back'; s.t = 0; } }
    else if (s.state === 'back') { if (walk(s.gx + 50)) { s.state = 'lift'; s.t = 0; s.board.lifted = true; s.holding = true; Bus.emit('boardLifted', s.board); if (p && p.mode === 'hide' && p.cover === s.board) p.startMeasured(s); } }
    else if (s.state === 'lift') { if (s.t > 1 && !(p && p.mode === 'measured')) { s.state = 'putback'; s.t = 0; } }
    else if (s.state === 'putback') { if (s.t > 1.2) { s.board.lifted = false; s.holding = false; const i = this.covers.indexOf(s.board); if (i >= 0 && !(p && p.mode === 'hide' && p.cover === s.board)) this.covers.splice(i, 1); s.state = 'leaveAll'; s.t = 0; this.boardDone = true; Bus.emit('scientistDone', s); } }
    else if (s.state === 'leaveAll') { if (walk(s.gx + 800, 70)) this.sci = null; }
  }

  /* how far a hawk can see you: hidden things are invisible */
  serializeCovers() { return this.covers.filter(c => c.kind === 'coverboard').map(c => +c.x.toFixed(1)); }
}
