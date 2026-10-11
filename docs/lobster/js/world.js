/* ============================================================
   world.js — the sea floor and everything living in the Gulf
   ============================================================
   THE SURFACE  the tide and the waves (bigger in a storm), the
                currents (offshore while you are a larva, back
                over the cobble bed once you are stage IV), the
                plankton that is kept alive around you (diatoms,
                glowing dinoflagellates, jumpy copepods; near the
                top at night and deeper by day), sister larvae, a
                school of herring, comb jellies, the basking shark,
                a tern dipping at the surface.
   THE BOTTOM   the cobbles and the holes under them (the nursery:
                some are taken), kelp, mussel beds, food on the sea
                floor (mussels, crabs, urchins, snails, kelp), bits
                that drift into a juvenile's hole, the hunters (cod,
                sculpin, striped bass, a seal) that always miss, the
                lobsterman's boat and trap, the lobsters walking
                offshore in autumn and back in spring, rival males,
                the female, the boys at their dens, the weather and
                the seasons, and snow on the water in winter.
   Nothing here ever hurts anybody: fish, seals and birds miss,
   and the lobsterman always puts you back.
   ============================================================ */
'use strict';

const FOOD_KINDS = {
  mussel: { food: 6, bites: 2, name: 'blue mussel', r: 5, shellfood: true },
  crab:   { food: 9, bites: 3, name: 'little crab', r: 6, shellfood: true },
  urchin: { food: 8, bites: 2, name: 'green sea urchin', r: 6, shellfood: true },
  snail:  { food: 4, bites: 1, name: 'periwinkle', r: 4, shellfood: true },
  kelp:   { food: 3, bites: 2, name: 'bit of kelp', r: 7, shellfood: false },
  drift:  { food: 4, bites: 1, name: 'bit of food', r: 3, shellfood: false },
  bait:   { food: 8, bites: 2, name: 'bait', r: 5, shellfood: false }
};
const PLANKTON_KINDS = {
  diatom:  { val: 1, r: 1.1 },
  chain:   { val: 2, r: 1.8 },
  dino:    { val: 1, r: 1.0 },
  copepod: { val: 3, r: 1.5 }
};
const HUNTER_KINDS = {
  cod:     { name: 'cod', len: 150, speed: 44, zone: [WORLD.cobbleL - 200, WORLD.kelpR], lift: 26 },
  sculpin: { name: 'sculpin', len: 70, speed: 70, zone: [WORLD.cobbleL, WORLD.ledgeR], lift: 8 },
  bass:    { name: 'striped bass', len: 130, speed: 64, zone: [WORLD.kelpL - 300, WORLD.ledgeR], lift: 40 },
  seal:    { name: 'harbour seal', len: 170, speed: 58, zone: [WORLD.kelpL, WORLD.walkR], lift: 36 }
};

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground;
    this.t = 0;
    /* ---------- the bottom ---------- */
    /* holes under cobbles: the nursery.  Most are taken by other little lobsters. */
    this.shelters = [];
    const cbs = S.cobbles.slice().sort((a, b) => a.x - b.x);
    let last = -1e9;
    for (const cb of cbs) {
      if (cb.x - last < 70 || cb.rad < 9) continue;
      last = cb.x;
      const taken = R() < .6;
      this.shelters.push({ x: cb.x + (R() < .5 ? -1 : 1) * cb.rad * .5, w: cb.rad * 1.5 + 8, kind: 'hollow', rad: cb.rad, taken, npcPh: R() * TAU, npcForm: R() < .97 ? 'normal' : 'blue' });
    }
    /* crevices under the kelp boulders and on the ledge, and mud banks offshore */
    for (const x of [1680, 1960, 2260, 2520]) this.shelters.push({ x: x + (R() - .5) * 40, w: 40 + R() * 14, kind: 'crevice', taken: false });
    for (const x of [2820, 3060, 3300, 3500]) this.shelters.push({ x: x + (R() - .5) * 30, w: 34 + R() * 10, kind: 'crevice', taken: false });
    for (const x of [-2420, -2160, -1940]) this.shelters.push({ x, w: 60, kind: 'bank', taken: false });
    for (const sh of this.shelters) sh.y = S.walkTop(sh.x, 6);
    /* kelp fronds (drawn by render; also partial cover) */
    this.kelp = [];
    for (let x = WORLD.kelpL + 20; x < WORLD.kelpR + 200; x += 22 + R() * 30) this.kelp.push({ x, h: 120 + R() * 220, ph: R() * TAU, seed: (R() * 1e9) | 0, w: 5 + R() * 5 });
    for (let x = WORLD.ledgeR - 200; x < WORLD.walkR; x += 40 + R() * 40) this.kelp.push({ x, h: 50 + R() * 60, ph: R() * TAU, seed: (R() * 1e9) | 0, w: 3 + R() * 3 });
    this.items = []; this.itemClock = 0; this.driftClock = 0;
    for (let k = 0; k < 60; k++) this.spawnItem(lerp(WORLD.cobbleL, WORLD.ledgeR, R()), pick(['mussel', 'mussel', 'crab', 'urchin', 'snail', 'kelp']));
    this.npcs = []; this.marchers = []; this.exuviae = []; this.hunters = [];
    this.tern = { state: 'hover', x: 0, y: -60, t: 0, ph: R() * TAU, target: null, cool: 30 };
    this.boat = { x: WORLD.boatX, ph: 0, wave: 0 };
    this.trap = { state: 'away', x: WORLD.trapX, y: 0, t: 0, done: false, bait: 2 };
    this.weather = { state: 'calm', timer: 60 + R() * 60, storm: 0, cloud: .15, gust: 0, snow: 0 };
    this.season = 'summer'; this.temp = 14;
    /* ---------- the surface ---------- */
    this.plankton = []; this.sibs = []; this.jellies = []; this.smallFish = []; this.school = null; this.shark = null;
    this.drift = -1;                         /* -1: the current carries larvae offshore; +1: back over the cobble bed */
    for (let k = 0; k < 5; k++) this.jellies.push(this.makeJelly(lerp(-2800, 600, R()), 20 + R() * 120));
    const fishCols = [['#9ab0c0', '#3a5060'], ['#c0b080', '#5a4a30'], ['#7a9ab0', '#2a3a50'], ['#b0a0a0', '#5a4040']];
    for (let k = 0; k < 18; k++) { const c = fishCols[k % fishCols.length], x = lerp(WORLD.cobbleL, WORLD.walkR, R()); this.smallFish.push({ x, y: S.surfaceAt(x) - 20 - R() * 60, dir: R() < .5 ? -1 : 1, sp: 12 + R() * 16, s: .5 + R() * .6, ph: R() * TAU, col: c[0], col2: c[1], home: x }); }
    this.mum = null;                         /* the berried mother in her den, while you are an egg */
    this.larvaCloud = [];                    /* larvae fanned free, swimming up */
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  /* ============================================================
     THE SURFACE
     ============================================================ */
  seaLevel() { return -tideAt(this.G.tod) * 8; }
  /* the wavy surface, for drawing and for "am I at the top?" */
  surfaceY(x) { const t = this.t, st = 1 + this.weather.storm * 3; return this.seaLevel() + st * (2.2 * Math.sin(x * .03 - t * 1.6) + 1.4 * Math.sin(x * .071 + t * 2.1)); }
  inWater(x, y) { return y > this.seaLevel() && !this.ground.solidAt(x, y); }
  /* the swell: 0..1, a slow pulse of the current over the bottom (the larvae go free on the pulse) */
  swash() { const u = (this.t % 5.6) / 5.6; return u < .45 ? smoothstep(0, .45, u) : 1 - smoothstep(.45, 1, u); }
  /* the water's movement at a point (units per second) */
  current(x, y) {
    const t = this.t, depthK = clamp(1 - y / 520, .2, 1);
    const a = (Math.sin(x * .004 + t * .05) + Math.sin(y * .006 - t * .04 + 1.3)) * 1.6;
    let vx = Math.cos(a) * 4 + this.drift * 8 * depthK, vy = Math.sin(a) * 2.4;
    /* the ebb pulls new larvae offshore, strongest over the shelf */
    if (this.drift < 0) vx -= 14 * smoothstep(-1500, 200, x) * depthK;
    /* the flood brings a postlarva back over the cobble bed */
    else { const k = smoothstep(-3000, WORLD.cobbleL, x) * (1 - smoothstep(WORLD.homeX, WORLD.cobbleR, x)); vx += 10 * k * depthK; if (x > WORLD.cobbleR - 100) vx -= 12 * depthK; }
    vx += Math.sin(t * .4) * 6 * this.weather.storm * depthK;
    return [vx, vy];
  }
  makeJelly(x, y) { const R = this.R; return { x, y, r: 10 + R() * 8, ph: R() * TAU, vx: 0, vy: 0, hitDone: false }; }

  /* plankton is kept alive in a ring around whoever is swimming */
  updatePlankton(dt, p) {
    const night = nightAmount(this.G.tod), R = this.R;
    const band = night > .5 ? [6, 120] : [90, 300];
    const want = p.stage === 'larva' ? 90 : p.stage === 'postlarva' ? 50 : 0;
    const L = this.plankton;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.ph += dt;
      const [cx, cy] = this.current(q.x, q.y);
      if (q.kind === 'copepod') {
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
    let tries = 0;
    while (L.length < want && tries++ < 400) {
      const a = R() * TAU, d = R() < .7 ? 45 + R() * 110 : 160 + R() * 160;
      let x = p.x + Math.cos(a) * d * 1.4 - (p.stage === 'larva' ? 30 : 0), y = p.y + Math.sin(a) * d * .7;
      if (R() < .55) y = lerp(band[0], band[1], R());
      y = clamp(y, this.seaLevel() + 4, Math.min(620, this.ground.surfaceAt(x) - 20));
      if (this.ground.solidAt(x, y) || Math.hypot(x - p.x, y - p.y) < 40) { if (L.length > want * .7) break; continue; }
      const k = R(), kind = k < .5 ? 'diatom' : k < .66 ? 'chain' : k < .86 ? 'dino' : 'copepod';
      L.push({ x, y, kind, ph: R() * TAU, vx: 0, vy: 0, glow: 0, tired: 0, rot: R() * TAU, eaten: false });
      if (kind === 'diatom' && R() < .3) for (let j = 0; j < 5; j++) L.push({ x: x + (R() - .5) * 26, y: clamp(y + (R() - .5) * 18, this.seaLevel() + 4, 620), kind: 'diatom', ph: R() * TAU, vx: 0, vy: 0, glow: 0, tired: 0, rot: R() * TAU, eaten: false });
    }
  }
  /* sister larvae drifting along with you */
  updateSibs(dt, p) {
    const swimming = p.stage === 'larva' || p.stage === 'postlarva';
    if (!swimming) { this.sibs.length = 0; return; }
    const R = this.R;
    while (this.sibs.length < 12) { const a = R() * TAU, d = 60 + R() * 160; this.sibs.push({ x: p.x + Math.cos(a) * d, y: clamp(p.y + Math.sin(a) * d * .6, 10, 500), vx: 0, vy: 0, ph: R() * TAU, turn: 0, a: R() * TAU, post: p.stage === 'postlarva' }); }
    for (let i = this.sibs.length - 1; i >= 0; i--) {
      const s = this.sibs[i];
      s.ph += dt * 6; s.turn -= dt;
      if (s.turn <= 0) { s.turn = .6 + R() * 1.4; s.a += (R() - .5) * 2; }
      const [cx, cy] = this.current(s.x, s.y);
      s.vx += (Math.cos(s.a) * 18 - s.vx) * dt * 2; s.vy += (Math.sin(s.a) * 10 - s.vy) * dt * 2;
      s.x += (s.vx + cx * .8) * dt; s.y += (s.vy + cy * .8) * dt;
      if (s.y < this.seaLevel() + 4) { s.y = this.seaLevel() + 4; s.a = Math.abs(s.a); }
      if (this.ground.solidAt(s.x, s.y + 4)) { s.y -= 6; s.a = -Math.PI / 2; }
      if (Math.hypot(s.x - p.x, s.y - p.y) > 420) this.sibs.splice(i, 1);
    }
  }
  /* ---------- big visitors at the surface ---------- */
  startSchool(p) {
    if (this.school) return;
    const dir = this.R() < .5 ? 1 : -1, n = 30, R = this.R;
    this.school = { dir, x: p.x - dir * 420, y: p.y + (R() - .5) * 40, t: 0, fish: [] };
    for (let k = 0; k < n; k++) this.school.fish.push({ dx: (R() - .5) * 190, dy: (R() - .5) * 70, ph: R() * TAU, s: .8 + R() * .4 });
    Bus.emit('herring', this.school);
  }
  startShark(p) {
    if (this.shark) return;
    this.shark = { dir: 1, x: p.x - 1700, y: clamp(p.y + 30, 60, 300), t: 0, gulp: 0, passed: false };
    Bus.emit('basking', this.shark);
  }
  /* the basking shark's mouth, in world units */
  sharkMouth() { const w = this.shark; return w ? { x: w.x + w.dir * 300, y: w.y + 10 } : null; }
  /* the tern: hovers over the surface by day, now and then dips at something near the top */
  dip(p) { const b = this.tern; if (b.state !== 'hover') return false; b.state = 'dive'; b.t = 0; b.from = { x: p.x - 200, y: -140 }; b.target = { x: p.x, y: this.seaLevel() + 2 }; Bus.emit('ternDip', b); return true; }
  updateTern(dt, p) {
    const b = this.tern; b.t += dt; b.ph += dt;
    if (b.state === 'hover') { b.x = p.x + Math.cos(b.ph * .2) * 260; b.y = -90 + Math.sin(b.ph * .9) * 12; }
    else if (b.state === 'dive') {
      const u = clamp(b.t / 1.4, 0, 1);
      b.x = lerp(b.from.x, b.target.x + 180, u); b.y = lerp(b.from.y, b.target.y, Math.sin(u * Math.PI));
      if (u > .48 && !b.hit) { b.hit = true; Bus.emit('ternPass', b); }
      if (u >= 1) { b.state = 'hover'; b.hit = false; }
    }
  }
  updateSea(dt, p) {
    this.updatePlankton(dt, p);
    this.updateSibs(dt, p);
    /* comb jellies: keep a couple drifting near a larva */
    if (p.stage === 'larva' || p.stage === 'postlarva') {
      const near = this.jellies.filter(j => Math.abs(j.x - p.x) < 700);
      if (near.length < 2) { const side = this.R() < .5 ? -1 : 1; this.jellies.push(this.makeJelly(p.x + side * (300 + this.R() * 300), clamp(p.y + (this.R() - .5) * 120, 10, 300))); }
    }
    for (let i = this.jellies.length - 1; i >= 0; i--) {
      const j = this.jellies[i];
      j.ph += dt * 1.2;
      const [cx, cy] = this.current(j.x, j.y); j.vx += (cx * .7 - j.vx) * dt * .5; j.vy += (cy * .4 + Math.sin(j.ph) * 3 - j.vy) * dt;
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.y = clamp(j.y, this.seaLevel() + j.r, Math.min(400, this.ground.surfaceAt(j.x) - j.r - 10));
      if (Math.abs(j.x - p.x) > 2600) this.jellies.splice(i, 1);
    }
    const s = this.school;
    if (s) {
      s.t += dt; s.x += s.dir * 78 * dt; s.y += Math.sin(s.t * 1.2) * 18 * dt;
      for (const f of s.fish) f.ph += dt * 9;
      if ((s.x - p.x) * s.dir > 520) { this.school = null; Bus.emit('schoolGone'); }
    }
    const w = this.shark;
    if (w) {
      w.t += dt; w.x += w.dir * 52 * dt; w.gulp = .5 + .5 * Math.sin(w.t * .9);
      w.y += (clamp(p.y + 20, 50, 320) - w.y) * dt * .15;
      const m = this.sharkMouth();
      for (const q of this.plankton) if (Math.hypot(q.x - m.x, q.y - m.y) < 80) q.eaten = true;
      if (!w.passed && (w.x - p.x) * w.dir > 400) { w.passed = true; Bus.emit('sharkPassed'); }
      if ((w.x - p.x) * w.dir > 2600) this.shark = null;
    }
    /* larvae fanned free, swimming up to the light */
    for (let i = this.larvaCloud.length - 1; i >= 0; i--) {
      const e = this.larvaCloud[i]; e.t += dt;
      e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-dt * 1.5); e.vy = e.vy * Math.exp(-dt * 1.2) - 18 * dt;
      if (e.y < this.seaLevel() + 4) e.y = this.seaLevel() + 4;
      if (e.t > 6) this.larvaCloud.splice(i, 1);
    }
  }
  /* a mother fans her larvae free: a cloud of tiny swimmers rising */
  larvaBurst(x, y, n = 60) {
    const R = this.R;
    for (let k = 0; k < n; k++) { const a = -Math.PI * .5 + (R() - .5) * 2.6, sp = 24 + R() * 60; this.larvaCloud.push({ x: x + (R() - .5) * 10, y: y + (R() - .5) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, t: R() * .4, ph: R() * TAU }); }
  }

  /* ============================================================
     THE BOTTOM
     ============================================================ */
  /* where (x, y) is: 'den' (dug in) | 'shelter' (a hole under a cobble, a crevice, a mud bank) | 'kelp' | 'open' */
  shadeAt(x, y, w = 6) {
    const S = this.ground;
    if (y > S.surfaceAt(x) + w * .5) return 'den';
    for (const sh of this.shelters) if (Math.abs(x - sh.x) < sh.w * .5 && Math.abs(y - sh.y) < 30 + w) return 'shelter';
    if (x > WORLD.kelpL && x < WORLD.kelpR) return 'kelp';
    return 'open';
  }
  shelterAt(x, y, w = 6) { for (const sh of this.shelters) if (Math.abs(x - sh.x) < sh.w * .5 && Math.abs(y - sh.y) < 30 + w) return sh; return null; }
  nearestShelter(x, free) { let best = null, bd = 1e9; for (const sh of this.shelters) { if (free && sh.taken) continue; const d = Math.abs(sh.x - x); if (d < bd) { bd = d; best = sh; } } return best; }
  nearestFreeHollow(x) { let best = null, bd = 1e9; for (const sh of this.shelters) { if (sh.kind !== 'hollow' || sh.taken) continue; const d = Math.abs(sh.x - x); if (d < bd) { bd = d; best = sh; } } return best; }
  spawnItem(x, kind, fall) {
    const S = this.ground, k = FOOD_KINDS[kind];
    x = clamp(x, WORLD.gridL + 60, WORLD.walkR - 40);
    const it = { kind, x, y: S.walkTop(x, 4) - 1, bites: k.bites, rot: (this.R() - .5) * 1.4, age: 0, col: this.R(), fy: fall ? S.walkTop(x, 4) - 200 - this.R() * 200 : null };
    this.items.push(it);
    return it;
  }
  foodNear(x, y, reach) { let best = null, bd = reach; for (const it of this.items) { if (it.bites <= 0 || it.fy !== null) continue; const d = Math.hypot(it.x - x, (it.y - y) * .6); if (d < bd) { bd = d; best = it; } } return best; }
  exuviaNear(x, y, reach) { let best = null, bd = reach; for (const e of this.exuviae) { if (e.eaten) continue; const d = Math.hypot(e.x - x, (e.y - y) * .6); if (d < bd) { bd = d; best = e; } } return best; }

  /* ---------- the hunters: a fish or a seal comes for a look, lunges, misses, leaves ---------- */
  startHunter(kind, p) {
    if (this.hunters.length) return null;
    const K = HUNTER_KINDS[kind], dir = p.face >= 0 ? 1 : -1;
    const h = { kind, dir, x: p.x + dir * 520, y: this.ground.walkTop(p.x + dir * 520, 6) - K.lift, state: 'come', t: 0, ph: this.R() * TAU, struck: false };
    this.hunters.push(h);
    Bus.emit('predator', h);
    return h;
  }
  updateHunters(dt, p) {
    const S = this.ground;
    for (let i = this.hunters.length - 1; i >= 0; i--) {
      const h = this.hunters[i], K = HUNTER_KINDS[h.kind];
      h.t += dt; h.ph += dt * 6;
      const floor = S.walkTop(h.x, 6) - K.lift;
      if (h.state === 'come') {
        const dx = p.x - h.x, d = Math.abs(dx);
        h.x += sign(dx) * K.speed * dt; h.dir = sign(dx) || h.dir;
        h.y += (floor - h.y) * dt * 3;
        if (d < 70) { h.state = 'strike'; h.t = 0; }
      } else if (h.state === 'strike') {
        h.x += h.dir * K.speed * 2.2 * dt; h.y += (p.y - h.y) * dt * 4;
        if (!h.struck && h.t > .3) { h.struck = true; if (p.struck) p.struck(h); Bus.emit('strike', h); }
        if (h.t > .9) { h.state = 'leave'; h.t = 0; }
      } else {
        h.x += h.dir * K.speed * 1.4 * dt; h.y += (floor - 60 - h.y) * dt;
        if (Math.abs(h.x - p.x) > 900) this.hunters.splice(i, 1);
      }
    }
  }

  /* ---------- the lobsterman: the boat steers over, the trap comes down, waits, then is hauled ---------- */
  startTrap(p) {
    const T = this.trap; if (T.state !== 'away') return;
    this.boat.x = p.x + 60; T.x = p.x + 90; T.y = -10; T.state = 'down'; T.t = 0; T.bait = 2;
    T.floor = this.ground.walkTop(T.x, 10);
    Bus.emit('trapDown', T);
  }
  updateTrap(dt, p) {
    const T = this.trap, b = this.boat;
    b.ph += dt; b.wave = Math.sin(b.ph * 1.3) * (1 + this.weather.storm * 3);
    if (T.state === 'away') return;
    T.t += dt;
    if (T.state === 'down') { T.y = Math.min(T.floor - 1, T.y + 60 * dt); if (T.y >= T.floor - 1) { T.state = 'set'; T.t = 0; Bus.emit('trapSet', T); } }
    else if (T.state === 'set') { if (T.t > 160 && !T.holding) { T.state = 'haul'; T.t = 0; } }
    else if (T.state === 'haul') { T.y -= 50 * dt; if (T.y < this.seaLevel() - 24) { T.state = 'up'; T.t = 0; Bus.emit('trapUp', T); } }
    else if (T.state === 'up') { T.y = this.seaLevel() - 24 + Math.sin(b.ph * 1.3) * 2; if (T.t > 4.5) { T.state = 'lower'; T.t = 0; Bus.emit('trapBack', T); } }
    else if (T.state === 'lower') { T.y += 60 * dt; if (T.y >= T.floor - 1) { T.state = 'gone'; T.t = 0; T.holding = false; } }
    else if (T.state === 'gone') { T.y -= 70 * dt; if (T.y < -40) { T.state = 'away'; T.done = true; } }
  }
  trapMouthNear(x, y) { const T = this.trap; return T.state === 'set' && Math.abs(x - T.x) < 34 && Math.abs(y - T.y) < 30; }

  /* ---------- crowds: the lobsters walking offshore in autumn, and back inshore in spring ---------- */
  startMarch(p, dir) {
    this.marchers.length = 0; this.marchDir = dir;
    const R = this.R;
    for (let k = 0; k < 50; k++) this.marchers.push(this.makeMarcher(p.x - 900 + R() * 1800));
  }
  makeMarcher(x) { const R = this.R; return { x, sp: 26 + R() * 18, ph: R() * TAU, cm: 7.5 + R() * 3.6, form: R() < .96 ? 'normal' : 'blue', male: R() < .5, pause: 0, arrived: false }; }
  updateCrowds(dt, p) {
    const S = this.ground;
    if (!this.marchers.length) return;
    const dir = this.marchDir || -1;
    for (const m of this.marchers) {
      m.ph += dt * 9;
      if (m.pause > 0) { m.pause -= dt; continue; }
      if ((dir < 0 && m.x < WORLD.deepR - 300) || (dir > 0 && m.x > WORLD.homeX - 200 && m.x < WORLD.homeX + 500)) { m.arrived = true; continue; }
      const sl = Math.abs(S.slopeAt(m.x, 6));
      m.x += dir * m.sp * dt / (1 + sl * 1.1);
      if (Math.random() < dt * .03) m.pause = .5 + Math.random() * 2;
    }
    for (const m of this.marchers) if ((m.x - p.x) * dir > 1300 && !m.arrived) Object.assign(m, this.makeMarcher(p.x - dir * (700 + this.R() * 600)));
    for (const m of this.marchers) if (m.arrived && !m.gone) {
      m.stay = (m.stay === undefined ? 2 + Math.random() * 10 : m.stay) - dt;
      if (m.stay < 0 && this.marchers.filter(o => o.arrived && !o.gone && o.sink === undefined).length > 8) m.sink = 0;
      if (m.sink !== undefined) { m.sink += dt * .5; if (m.sink >= 1) m.gone = true; }
    }
  }

  /* ---------- other lobsters you can box, meet and follow ---------- */
  sendRival(p) {
    this.rivalsSent = (this.rivalsSent || 0) + 1;
    const cm = this.rivalsSent === 1 ? Math.max(6.5, p.cm - 1.5) : clamp(p.cm + (this.R() - .5) * 2.4, 7, 12.4);
    const from = p.x < WORLD.homeX ? 1 : -1;
    const n = new LobNPC(this, { cm, sex: 'boy', form: this.R() < .9 ? 'normal' : pick(FORM_KEYS), x: p.x + from * 420 });
    n.goal = p.x + from * (lobUnits(p.cm) * .5 + lobUnits(cm) * .5 + 6); n.role = 'rival';
    this.npcs.push(n);
    return n;
  }
  sendFemale(p) {
    const n = new LobNPC(this, { cm: Math.max(7, p.cm - 1.2), sex: 'girl', form: p.form, x: Math.min(p.x + 460, WORLD.kelpR) });
    n.goal = p.x + lobUnits(p.cm) * .6 + 14; n.role = 'female';
    this.npcs.push(n);
    return n;
  }
  /* the boys waiting at their den doors on the cobble bed (a girl picks one) */
  makeMaleDens() {
    if (this.npcs.some(n => n.role === 'host')) return;
    const S = this.ground;
    for (const x0 of [-200, 100, 700, 1100]) {
      const cb = S.nearestCobble(x0), x = cb ? cb.x + cb.rad * .9 : x0;
      const cm = 8.5 + this.R() * 2.8, w = lobUnits(cm), g = S.walkTop(x, 4);
      for (let k = 0; k < 8; k++) S.blob(x - k * 2, g + 4 + k * 5, w * .3, w * .22, MAT.AIR, (m) => S.diggable(m) || m === MAT.GRAVEL);
      S.flushTop();
      const n = new LobNPC(this, { cm, sex: 'boy', form: this.R() < .9 ? 'normal' : 'orange', x });
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
  setStorm(on, hold = 40) { const W = this.weather; W.state = on ? 'storm' : 'clearing'; W.timer = hold; Bus.emit('weather', W.state); }
  setSeason(s) { if (this.season === s) return; this.season = s; Bus.emit('season', s); }
  update(dt, tod, p) {
    const G = this.G, W = this.weather, R = this.R;
    this.t += dt;
    W.timer -= dt;
    if (W.timer <= 0) {
      const rough = this.season === 'autumn' || this.season === 'winter';
      const next = { calm: 'cloudy', cloudy: rough && R() < .6 ? 'storm' : R() < .25 ? 'storm' : 'calm', storm: 'clearing', clearing: 'calm' }[W.state];
      W.state = next; W.timer = { calm: (rough ? 60 : 110) + R() * 90, cloudy: 25 + R() * 25, storm: 35 + R() * 35, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { calm: .12, cloudy: .7, storm: 1, clearing: .4 }[W.state], ts = W.state === 'storm' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.storm += (ts - W.storm) * (1 - Math.exp(-dt * .4));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    W.snow += ((this.season === 'winter' && W.cloud > .4 ? 1 : 0) - W.snow) * (1 - Math.exp(-dt * .3));
    const want = SEASON_INFO[this.season][1];
    this.temp += (want - this.temp) * (1 - Math.exp(-dt * .05));

    if (p.stage === 'larva' || p.stage === 'postlarva' || p.stage === 'egg' || this.shark || this.school || this.larvaCloud.length) this.updateSea(dt, p);
    else { this.plankton.length = 0; this.sibs.length = 0; }

    /* the sea floor: food turns up now and then; a juvenile's hole gets bits drifting in */
    this.itemClock -= dt; this.driftClock -= dt;
    if (this.itemClock <= 0) {
      this.itemClock = 2 + R() * 3;
      const nearby = this.items.filter(it => it.bites > 0 && Math.abs(it.x - p.x) < 800 && it.kind !== 'drift').length;
      if (nearby < 12 && p.stage === 'lobster' && p.instar >= 2) this.spawnItem(p.x + (R() < .5 ? -1 : 1) * (200 + R() * 500), R() < .4 ? 'mussel' : R() < .5 ? 'crab' : R() < .5 ? 'urchin' : R() < .5 ? 'snail' : 'kelp', R() < .4);
      if (this.items.length > 160) { const old = this.items.findIndex(it => Math.abs(it.x - p.x) > 1200); if (old >= 0) this.items.splice(old, 1); }
    }
    if (this.driftClock <= 0 && p.stage === 'lobster' && p.instar === 1 && p.home) {
      this.driftClock = 6 + R() * 6;
      const near = this.items.filter(it => it.kind === 'drift' && it.bites > 0).length;
      if (near < 2) { const it = this.spawnItem(p.home.x + (R() - .5) * p.home.w * .6, 'drift', true); it.fy = p.home.y - 120 - R() * 80; Bus.emit('drifter', it); }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      if (it.fy !== null) { it.fy += (it.kind === 'drift' ? 18 : 40) * dt; it.x += Math.sin(it.age * 2) * 3 * dt; if (it.fy >= it.y) { it.fy = null; it.y = this.ground.walkTop(it.x, 4) - 1; } }
      if (it.bites <= 0) { it.gone = (it.gone || 0) + dt; if (it.gone > 3) this.items.splice(i, 1); }
    }
    for (const f of this.smallFish) {
      f.ph += dt * 8; f.x += f.dir * f.sp * dt; f.y += Math.sin(f.ph * .2) * 4 * dt;
      if (Math.abs(f.x - f.home) > 140 || this.ground.solidAt(f.x + f.dir * 10, f.y)) f.dir *= -1;
    }
    this.updateCrowds(dt, p);
    this.updateHunters(dt, p);
    this.updateTern(dt, p);
    this.updateTrap(dt, p);
    for (const n of this.npcs) n.update(dt);
    this.npcs = this.npcs.filter(n => !n.gone);
    if (this.mum) this.mum.ph += dt;
  }
}

/* another lobster: walks, stands at a den door, boxes, backs off, leaves */
class LobNPC {
  constructor(W, o) {
    this.W = W; this.cm = o.cm; this.sex = o.sex; this.form = o.form || 'normal';
    this.x = o.x; this.y = W.ground.walkTop(this.x, 6) - this.feet;
    this.mode = 'walk'; this.face = 1; this.walk = 0; this.t = 0; this.goal = this.x; this.leaving = false; this.gone = false;
    this.vx = 0; this.vy = 0; this.spin = 0; this.lift = 0;
  }
  get w() { return lobUnits(this.cm); }
  get feet() { return this.w * .2; }
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
      this.y = S.walkTop(this.x, 6) - this.feet + (this.mode === 'door' ? this.w * .12 : 0);
    } else if (this.mode === 'tossed') {
      /* pushed back: a tail flip away, unhurt, then it leaves */
      this.vy += 300 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += dt * 4 * sign(this.vx);
      const top = S.walkTop(this.x, 6) - this.feet;
      if (this.y >= top && this.vy > 0) { this.y = top; this.spin = 0; this.leave(); }
    } else if (this.mode === 'enter') {
      this.sink = (this.sink || 0) + dt * .6; this.y += dt * 10;
      if (this.sink > 1) this.gone = true;
    }
  }
  leave() { this.mode = 'leave'; this.leaving = true; this.leaveTo = this.x + (Math.random() < .5 ? -900 : 900); if (this.leaveTo > WORLD.walkR - 100) this.leaveTo = this.x - 900; }
}
