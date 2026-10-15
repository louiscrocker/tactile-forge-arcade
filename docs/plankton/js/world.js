/* ============================================================
   world.js — the water column of the Gulf of Maine, and who lives in it
   ============================================================
   THE TOP      the surface (a little tide, waves bigger in a
                storm), the diatoms (lone cells and chains, thick
                in the spring bloom), the dinoflagellates that
                flash blue when bumped at night
   ALL THE WAY  other copepods of your stage swimming with you
                (down by day, up at night), comb jellies drifting,
                marine snow sinking, a herring school when you
                are seen in the light, the basking shark in
                summer, the right whale skimming a copepod cloud
   THE DEEP     the sleeping layer of fat stage V copepods
   GROWN-UPS    a girl and her scent trail (for a boy), a boy
                following your trail (for a girl), and eggs
                drifting free
   Nothing here ever hurts anybody: fish, jellies and whales
   always miss, and a bump is only a harmless tumble.
   ============================================================ */
'use strict';

const PLANKTON_KINDS = {
  diatom: { val: 1, r: 1.1 },
  chain:  { val: 3, r: 1.9 },
  dino:   { val: 1, r: 1.0 }
};

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    this.t = 0;
    this.weather = { state: 'calm', timer: 60 + this.R() * 60, storm: 0, cloud: .15, gust: 0, snow: 0 };
    this.season = 'spring'; this.temp = SEASON_INFO.spring[1];
    this.plankton = []; this.sibs = []; this.jellies = []; this.sleepers = []; this.flakes = [];
    this.school = null; this.shark = null; this.whale = null;
    this.mate = null;                      /* the other grown-up copepod (a girl for a boy, a boy for a girl) */
    this.trail = [];                       /* scent trail points {x, y, t} */
    this.eggs = [];                        /* eggs drifting free {x, y, vx, vy, t, ph} */
    this.mum = null;                       /* the mother who let your egg go, swimming away */
    this.bloom = 1;                        /* how thick the diatoms are: the spring bloom is 1 */
    for (let k = 0; k < 4; k++) this.jellies.push(this.makeJelly(lerp(-1500, 1500, this.R()), 60 + this.R() * 300));
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  /* ---------- the surface ---------- */
  seaLevel() { return -tideAt(this.G.tod) * 3; }
  surfaceY(x) { const t = this.t, st = 1 + this.weather.storm * 3; return this.seaLevel() + st * (2.2 * Math.sin(x * .03 - t * 1.6) + 1.4 * Math.sin(x * .071 + t * 2.1)); }
  /* the water's slow swirl (units per second) */
  current(x, y) {
    const t = this.t, depthK = clamp(1 - y / 900, .15, 1);
    const a = (Math.sin(x * .004 + t * .05) + Math.sin(y * .006 - t * .04 + 1.3)) * 1.6;
    let vx = Math.cos(a) * 3 * depthK, vy = Math.sin(a) * 1.6 * depthK;
    vx += Math.sin(t * .4) * 5 * this.weather.storm * depthK;
    return [vx, vy];
  }
  light(y) { return lightAt(y, this.G.tod, this.weather.cloud); }
  makeJelly(x, y) { const R = this.R; return { x, y, r: 12 + R() * 9, ph: R() * TAU, vx: 0, vy: 0, hitDone: false, cool: 0 }; }

  /* ---------- diatoms and dinoflagellates, kept alive around you ---------- */
  updatePlankton(dt, p) {
    const R = this.R, L = this.plankton, night = nightAmount(this.G.tod);
    const eats = p.stage !== 'egg' && p.mode !== 'sleep';
    const top = p.y < 300, want = !eats ? 24 : top ? Math.round(150 * (.5 + .5 * this.bloom)) : 4;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.ph += dt;
      const [cx, cy] = this.current(q.x, q.y);
      q.x += cx * .6 * dt + Math.sin(q.ph * .7) * 1.2 * dt; q.y += cy * .6 * dt + Math.cos(q.ph * .5) * 1 * dt + .6 * dt;
      q.glow = Math.max(0, q.glow - dt * 1.4);
      if (q.y < this.seaLevel() + 3) q.y = this.seaLevel() + 3;
      if (Math.hypot(q.x - p.x, (q.y - p.y) * 1.2) > 380 || q.eaten) L.splice(i, 1);
    }
    let tries = 0;
    while (L.length < want && tries++ < 400) {
      const a = R() * TAU, d = R() < .7 ? 40 + R() * 120 : 170 + R() * 170;
      const x = p.x + Math.cos(a) * d * 1.4;
      /* the plants live in the sunlit top: most cells are in the top 220, a few sink deeper */
      let y = top ? (R() < .85 ? Math.pow(R(), 1.4) * 230 : 230 + R() * 150) : p.y + (R() - .5) * 400;
      y = clamp(y, this.seaLevel() + 4, WORLD.floor - 60);
      if (Math.hypot(x - p.x, y - p.y) < 30) continue;
      const k = R(), dinoK = this.season === 'summer' ? .3 : .14;
      const kind = k < dinoK ? 'dino' : k < dinoK + .22 ? 'chain' : 'diatom';
      L.push({ x, y, kind, ph: R() * TAU, glow: 0, rot: R() * TAU, eaten: false, sp: R() });
      if (kind === 'diatom' && R() < .35) for (let j = 0; j < 4; j++) L.push({ x: x + (R() - .5) * 24, y: clamp(y + (R() - .5) * 16, this.seaLevel() + 4, WORLD.floor - 60), kind: 'diatom', ph: R() * TAU, glow: 0, rot: R() * TAU, eaten: false, sp: R() });
    }
    if (night < .1) for (const q of L) if (q.kind === 'dino') q.glow = Math.min(q.glow, .2);
  }

  /* ---------- other copepods of your stage, migrating with you ---------- */
  updateSibs(dt, p) {
    const R = this.R;
    if (p.stage === 'egg' || p.mode === 'sleep' || p.flags.genDone && p.stage !== 'adult') { this.sibs.length = 0; return; }
    const night = nightAmount(this.G.tod) > .5, eatsNow = p.step >= 3;
    /* where they want to be: copepodites go up at night and down by day; nauplii stay near the food */
    const band = p.step < 7 ? [20, 200] : night ? [10, 160] : [330, 520];
    while (this.sibs.length < 14) {
      const a = R() * TAU, d = 70 + R() * 200;
      this.sibs.push({ x: p.x + Math.cos(a) * d * 1.4, y: clamp(p.y + Math.sin(a) * d * .7, 8, WORLD.floor - 40), vx: 0, vy: 0, ph: R() * TAU, turn: 0, a: R() * TAU, step: clamp(p.step + Math.round((R() - .5) * 2), 1, 12), face: 1, jump: 0, sex: R() < .5 ? 'boy' : 'girl' });
    }
    for (let i = this.sibs.length - 1; i >= 0; i--) {
      const s = this.sibs[i];
      s.ph += dt * 6; s.turn -= dt; s.jump = Math.max(0, s.jump - dt * 2);
      if (s.turn <= 0) { s.turn = .6 + R() * 1.4; s.a += (R() - .5) * 2; }
      const goal = s.y < band[0] ? 1 : s.y > band[1] ? -1 : 0;
      const [cx, cy] = this.current(s.x, s.y);
      s.vx += (Math.cos(s.a) * 12 - s.vx) * dt * 2; s.vy += (Math.sin(s.a) * 6 + goal * 16 - s.vy) * dt * 2;
      /* they jump away from a herring or the whale too */
      const sc = this.school, w = this.whale;
      if ((sc && Math.hypot(sc.x - s.x, sc.y - s.y) < 90) || (w && Math.hypot(w.x + w.dir * 60 - s.x, w.y - s.y) < 120)) { if (s.jump <= 0) { s.jump = 1; s.vx += (R() - .5) * 160; s.vy += (R() - .5) * 120; } }
      s.vx *= Math.exp(-dt * 1.5); s.vy *= Math.exp(-dt * 1.5);
      s.x += (s.vx + cx * .8) * dt; s.y += (s.vy + cy * .8) * dt;
      if (Math.abs(s.vx) > 2) s.face = sign(s.vx);
      s.y = clamp(s.y, this.seaLevel() + 4, WORLD.floor - 30);
      if (Math.hypot(s.x - p.x, s.y - p.y) > 480) this.sibs.splice(i, 1);
      if (!eatsNow) continue;
    }
  }

  /* ---------- the sleeping layer: fat stage V copepods resting over the floor ---------- */
  updateSleepers(dt, p) {
    const near = p.y > WORLD.sleepY - 260 && (p.step >= 11 || p.mode === 'sleep');
    if (!near) { this.sleepers.length = 0; return; }
    const R = this.R;
    while (this.sleepers.length < 40) { const x = p.x + (R() - .5) * 900; this.sleepers.push({ x, y: lerp(WORLD.sleepY - 20, this.ground.surfaceAt(x) - 24, R()), ph: R() * TAU, face: R() < .5 ? -1 : 1, oil: .6 + R() * .4, waking: 0 }); }
    for (let i = this.sleepers.length - 1; i >= 0; i--) {
      const s = this.sleepers[i]; s.ph += dt * .4;
      s.y += Math.sin(s.ph) * .8 * dt;
      if (s.waking) { s.waking += dt; s.y -= dt * (10 + s.waking * 8); }
      if (Math.abs(s.x - p.x) > 700 || s.y < WORLD.sleepY - 400) this.sleepers.splice(i, 1);
    }
  }
  wakeAll() { for (const s of this.sleepers) if (!s.waking) s.waking = .01 + this.R() * 3; }

  /* ---------- marine snow: flakes sinking past, thicker in the deep ---------- */
  updateSnow(dt, p) {
    const R = this.R, want = p.y > 400 ? 70 : 30;
    while (this.flakes.length < want) this.flakes.push({ x: p.x + (R() - .5) * 700, y: p.y + (R() - .7) * 500, s: .5 + R() * 1.6, ph: R() * TAU, sp: 3 + R() * 6 });
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i]; f.ph += dt; f.y += f.sp * dt; f.x += Math.sin(f.ph * .6) * 2 * dt;
      if (Math.abs(f.x - p.x) > 420 || Math.abs(f.y - p.y) > 320 || f.y > this.ground.surfaceAt(f.x)) this.flakes.splice(i, 1);
    }
  }

  /* ---------- big visitors ---------- */
  startSchool(p) {
    if (this.school) return null;
    const dir = this.R() < .5 ? 1 : -1, R = this.R;
    this.school = { dir, x: p.x - dir * 460, y: p.y + (R() - .5) * 30, t: 0, fish: [], target: { x: p.x, y: p.y }, hitDone: false, passed: false };
    for (let k = 0; k < 20; k++) this.school.fish.push({ dx: (R() - .5) * 260, dy: (R() - .5) * 90, ph: R() * TAU, s: .8 + R() * .4 });
    Bus.emit('herring', this.school);
    return this.school;
  }
  startShark(p) {
    if (this.shark) return null;
    this.shark = { dir: 1, x: p.x - 1500, y: clamp(p.y + 20, 90, 220), t: 0, gulp: 0, passed: false, hitDone: false };
    Bus.emit('basking', this.shark);
    return this.shark;
  }
  sharkMouth() { const w = this.shark; return w ? { x: w.x + w.dir * 300, y: w.y + 10 } : null; }
  /* the right whale skims through a thick copepod cloud, mouth open */
  startWhale(p) {
    if (this.whale) return null;
    const dir = this.R() < .5 ? 1 : -1;
    this.whale = { dir, x: p.x - dir * 900, y: clamp(p.y, 70, WORLD.floor - 120), t: 0, open: 0, passed: false, hitDone: false };
    Bus.emit('whale', this.whale);
    return this.whale;
  }
  whaleMouth() { const w = this.whale; return w ? { x: w.x + w.dir * 150, y: w.y + 6 } : null; }
  updateVisitors(dt, p) {
    const s = this.school;
    if (s) {
      s.t += dt;
      /* the school heads for where it saw you, then sweeps on */
      const tx = s.target.x + s.dir * 600;
      s.x += s.dir * 95 * dt; s.y += (s.target.y - s.y) * dt * .8 + Math.sin(s.t * 1.2) * 10 * dt;
      for (const f of s.fish) f.ph += dt * 9;
      if (!s.passed && (s.x - p.x) * s.dir > 160) { s.passed = true; Bus.emit('schoolPassed', s); }
      /* it swept past without touching you: a jump just before counts as a good escape */
      if (!s.hitDone && (s.x - p.x) * s.dir > 110) { s.hitDone = true; if (p.t - p.lastJump < 3) { p.stats.dodges++; Bus.emit('dodged', p, 'herring'); } }
      if ((s.x - tx) * s.dir > 0 || s.t > 20) { this.school = null; Bus.emit('schoolGone'); }
    }
    const w = this.shark;
    if (w) {
      w.t += dt; w.x += w.dir * 55 * dt; w.gulp = .5 + .5 * Math.sin(w.t * .9);
      w.y += (clamp(p.y + 10, 90, 220) - w.y) * dt * .15;
      const m = this.sharkMouth();
      for (const q of this.plankton) if (Math.hypot(q.x - m.x, q.y - m.y) < 80) q.eaten = true;
      if (!w.passed && (w.x - p.x) * w.dir > 380) { w.passed = true; Bus.emit('sharkPassed'); }
      if ((w.x - p.x) * w.dir > 2400) this.shark = null;
    }
    const wh = this.whale;
    if (wh) {
      wh.t += dt; wh.x += wh.dir * 85 * dt; wh.open = clamp(wh.open + dt * .6, 0, 1);
      wh.y += (clamp(p.y + 4, 70, WORLD.floor - 120) - wh.y) * dt * .25;
      const m = this.whaleMouth();
      for (const q of this.plankton) if (Math.hypot(q.x - m.x, q.y - m.y) < 60) q.eaten = true;
      /* its mouth went by without touching you: missed (a jump just before was a good escape) */
      if (!wh.hitDone && (m.x - p.x) * wh.dir > 50) { wh.hitDone = true; if (p.t - p.lastJump < 3) { p.stats.dodges++; Bus.emit('dodged', p, 'whale'); } Bus.emit('whaleMissed', p); }
      if (!wh.passed && (wh.x - p.x) * wh.dir > 260) { wh.passed = true; Bus.emit('whalePassed'); }
      if ((wh.x - p.x) * wh.dir > 2400 || wh.t > 60) { if (!wh.hitDone) { wh.hitDone = true; Bus.emit('whaleMissed', p); } this.whale = null; }
    }
    for (let i = this.jellies.length - 1; i >= 0; i--) {
      const j = this.jellies[i];
      j.ph += dt * 1.2; j.cool = Math.max(0, (j.cool || 0) - dt);
      const [cx, cy] = this.current(j.x, j.y); j.vx += (cx * .7 - j.vx) * dt * .5; j.vy += (cy * .4 + Math.sin(j.ph) * 3 - j.vy) * dt;
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.y = clamp(j.y, this.seaLevel() + j.r, WORLD.floor - 80);
      if (Math.abs(j.x - p.x) > 2400) this.jellies.splice(i, 1);
    }
    if (p.stage !== 'egg' && p.mode !== 'sleep') {
      const near = this.jellies.filter(j => Math.abs(j.x - p.x) < 800 && Math.abs(j.y - p.y) < 400);
      if (near.length < 2) { const side = this.R() < .5 ? -1 : 1; this.jellies.push(this.makeJelly(p.x + side * (420 + this.R() * 300), clamp(p.y + (this.R() - .5) * 200, 20, WORLD.floor - 100))); }
    }
  }

  /* ---------- grown-ups: the other copepod and the scent trail ---------- */
  /* for a boy: a girl swimming slowly through the dim water, leaving her trail */
  sendGirl(p) {
    const R = this.R;
    let side = R() < .5 ? -1 : 1;
    if (p.x + side * 560 > WORLD.walkR - 150 || p.x + side * 560 < WORLD.walkL + 150) side = -side;
    const gx = p.x + side * 520, gy = clamp(p.y + (R() - .5) * 120, 320, WORLD.floor - 120);
    this.mate = { role: 'girl', sex: 'girl', x: gx, y: gy, vx: 0, vy: 0, ph: 0, face: side, a: side > 0 ? 0 : Math.PI, turn: 0, mode: 'swim', step: 12, form: p.form, met: false };
    /* she has been swimming here a while: the trail she left winds from near you to her */
    this.trail.length = 0;
    let x = p.x + side * 70, y = clamp(p.y + (R() - .5) * 40, 300, WORLD.floor - 100);
    for (let k = 0; k < 120; k++) {
      const a = Math.atan2(gy - y, gx - x) + Math.sin(k * .45) * .8;
      x += Math.cos(a) * 8; y = clamp(y + Math.sin(a) * 8, 300, WORLD.floor - 100);
      this.trail.push({ x, y, t: (120 - k) * .3 });
      if (Math.hypot(gx - x, gy - y) < 12) break;
    }
    Bus.emit('girlTrail', this.mate);
    return this.mate;
  }
  /* for a girl: a boy who has smelled her trail comes along it */
  sendBoy(p) {
    const R = this.R, side = R() < .5 ? -1 : 1;
    this.mate = { role: 'boy', sex: 'boy', x: clamp(p.x + side * 480, WORLD.walkL + 100, WORLD.walkR - 100), y: p.y + (R() - .5) * 80, vx: 0, vy: 0, ph: 0, face: -side, a: 0, turn: 0, mode: 'follow', step: 12, form: R() < .85 ? 'red' : pick(FORM_KEYS), met: false };
    Bus.emit('boyComing', this.mate);
    return this.mate;
  }
  updateMate(dt, p) {
    const m = this.mate, R = this.R;
    /* the trail fades with time */
    for (const q of this.trail) q.t += dt;
    if (this.trail.length > 180) this.trail.splice(0, this.trail.length - 180);
    if (!m) return;
    m.ph += dt * 6;
    if (m.mode === 'swim') {
      m.turn -= dt; if (m.turn <= 0) { m.turn = 1 + R() * 2; m.a += (R() - .5) * 1.4; }
      /* she wanders, but stays within reach of the boy */
      const dx = p.x - m.x; if (Math.abs(dx) > 600) m.a = dx > 0 ? 0 : Math.PI;
      m.vx += (Math.cos(m.a) * 9 - m.vx) * dt; m.vy += (Math.sin(m.a) * 5 - m.vy) * dt;
      m.x = clamp(m.x + m.vx * dt, WORLD.walkL + 100, WORLD.walkR - 100); m.y = clamp(m.y + m.vy * dt, 320, WORLD.floor - 100);
      if (m.x <= WORLD.walkL + 101 || m.x >= WORLD.walkR - 101) m.a = Math.PI - m.a;
      if (Math.abs(m.vx) > 1) m.face = sign(m.vx);
      m.dropT = (m.dropT || 0) - dt; if (m.dropT <= 0) { m.dropT = .35; this.trail.push({ x: m.x - m.face * 8, y: m.y, t: 0 }); }
    } else if (m.mode === 'follow') {
      /* he zig-zags towards her along her trail */
      const tx = p.x + (m.x > p.x ? 1 : -1) * (p.r * 3 + 8), ty = p.y, dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
      if (d > 4) { const zig = Math.sin(m.ph * .5) * .7, a = Math.atan2(dy, dx) + zig; m.x += Math.cos(a) * 34 * dt; m.y += Math.sin(a) * 34 * dt; m.face = sign(dx) || m.face; }
      else { m.mode = 'wait'; Bus.emit('boyArrived', m); }
    } else if (m.mode === 'wait') {
      m.x += (p.x + (m.x > p.x ? 1 : -1) * (p.r * 3 + 8) - m.x) * dt * 2; m.y += (p.y - m.y) * dt * 2; m.face = sign(p.x - m.x) || m.face;
    } else if (m.mode === 'leave') {
      m.x += m.face * 30 * dt; m.fade = (m.fade || 0) + dt * .3; if (m.fade >= 1) this.mate = null;
    }
  }
  /* the nearest bit of trail ahead of a boy (for the arrow) */
  trailAhead(p) {
    if (!this.trail.length) return null;
    let best = null, bd = 1e9;
    for (let i = 0; i < this.trail.length; i++) { const q = this.trail[i], d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i; } }
    const j = Math.min(this.trail.length - 1, best + 6);
    return this.trail[j];
  }

  /* ---------- eggs let go in the sea ---------- */
  eggBurst(x, y, n = 30) {
    const R = this.R;
    for (let k = 0; k < n; k++) { const a = R() * TAU, sp = 6 + R() * 22; this.eggs.push({ x: x + (R() - .5) * 6, y: y + (R() - .5) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, ph: R() * TAU }); }
    if (this.eggs.length > 400) this.eggs.splice(0, this.eggs.length - 400);
  }
  updateEggs(dt) {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const e = this.eggs[i]; e.t += dt;
      e.vx *= Math.exp(-dt * 1.4); e.vy = e.vy * Math.exp(-dt * 1.4) + 2 * dt;     /* Calanus eggs sink slowly */
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.t > 40) this.eggs.splice(i, 1);
    }
  }

  /* ============================================================
     WEATHER AND SEASONS
     ============================================================ */
  setStorm(on, hold = 40) { const W = this.weather; W.state = on ? 'storm' : 'clearing'; W.timer = hold; Bus.emit('weather', W.state); }
  setSeason(s) {
    if (this.season === s) return;
    this.season = s;
    this.bloom = s === 'spring' ? 1 : s === 'summer' ? .6 : s === 'autumn' ? .45 : .25;
    Bus.emit('season', s);
  }
  update(dt, tod, p) {
    const W = this.weather, R = this.R;
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const rough = this.season === 'autumn' || this.season === 'winter';
      const next = { calm: 'cloudy', cloudy: rough && R() < .5 ? 'storm' : R() < .2 ? 'storm' : 'calm', storm: 'clearing', clearing: 'calm' }[W.state];
      W.state = next; W.timer = { calm: (rough ? 60 : 110) + R() * 90, cloudy: 25 + R() * 25, storm: 30 + R() * 30, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { calm: .12, cloudy: .7, storm: 1, clearing: .4 }[W.state], ts = W.state === 'storm' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.storm += (ts - W.storm) * (1 - Math.exp(-dt * .4));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    W.snow += ((this.season === 'winter' && W.cloud > .4 ? 1 : 0) - W.snow) * (1 - Math.exp(-dt * .3));
    this.temp += (SEASON_INFO[this.season][1] - this.temp) * (1 - Math.exp(-dt * .05));
    this.updatePlankton(dt, p);
    this.updateSibs(dt, p);
    this.updateSleepers(dt, p);
    this.updateSnow(dt, p);
    this.updateVisitors(dt, p);
    this.updateMate(dt, p);
    this.updateEggs(dt);
    const m = this.mum;
    if (m) { m.t += dt; m.ph += dt * 6; m.x += 14 * dt * m.face; m.y -= 3 * dt; if (m.t > 9) this.mum = null; }
  }
}
