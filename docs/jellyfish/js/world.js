/* ============================================================
   world.js — the harbour bay and everything living in it
   ============================================================
   THE WATER    the tide and the waves (bigger in a storm), the
                swirling currents, and in the bay a strong current
                (a "river in the sea") running out to the open sea,
                where the summer bloom gathers; the plankton that
                is kept alive around you (diatoms, glowing
                dinoflagellates, jumpy copepods; near the top at
                night and deeper by day), sister planulae, sister
                ephyrae, comb jellies, a school of herring, a tern
                dipping at the surface
   THE LEDGES   the shady undersides of the rock ledges and of the
                dock's crossbeam: spots to settle on (many already
                taken by barnacles, sea squirts and other polyps),
                your clone buds, the sea slug crawling past
   VISITORS     the leatherback turtle, the ocean sunfish and the
                gull: they come for a jelly snack and always miss
   THE BLOOM    hundreds of moon jellies drifting together where
                the currents meet, boys and girls; the little
                clouds the boys let go; new planulae sinking down
   Nothing here ever hurts anybody: fish, turtles and birds miss,
   and the sea slug just crawls on by.
   ============================================================ */
'use strict';

const PLANKTON_KINDS = {
  diatom:  { val: 1, r: 1.1 },
  chain:   { val: 2, r: 1.8 },
  dino:    { val: 1, r: 1.0 },
  copepod: { val: 3, r: 1.5 }
};
/* visitors that come for a jelly snack (and always miss) */
const VISITOR_KINDS = {
  turtle:  { name: 'leatherback turtle', len: 150, speed: 52 },
  sunfish: { name: 'ocean sunfish', len: 130, speed: 34 },
  gull:    { name: 'gull', len: 50, speed: 0 }
};
/* what already lives on a taken spot under a ledge */
const OCCUPANTS = ['barnacle', 'squirt', 'polyp', 'polyp', 'sponge'];

class World {
  constructor(G, seed) {
    this.G = G; this.seed = seed;
    const R = this.R = mulberry32(seed + 77);
    this.ground = new Ground(seed);
    const S = this.ground, D = G.diff ? G.diff() : DIFFICULTY.normal;
    this.t = 0;
    /* ---------- the spots to settle on: under the ledges and under the dock's crossbeam ---------- */
    this.sites = [];
    for (const L of S.ledges) {
      for (let x = L.x - 24; x <= L.x + 64; x += 15) {
        const cy = S.ceilingAbove(x, L.g - 14, 60);
        if (cy === null || cy > L.g - 22 || cy < L.slabY - 4) continue;
        this.sites.push({ x, y: cy, kind: 'ledge' });
      }
    }
    for (let k = 0; k < WORLD.pilings.length - 1; k++) {
      const a = WORLD.dockX + WORLD.pilings[k] + 22, b = WORLD.dockX + WORLD.pilings[k + 1] - 22;
      for (let x = a; x <= b; x += 28) this.sites.push({ x, y: WORLD.beamBot, kind: 'dock' });
    }
    this.sites.sort((a, b) => a.x - b.x);
    for (const s of this.sites) { s.taken = R() < D.taken ? OCCUPANTS[(R() * OCCUPANTS.length) | 0] : null; s.mine = false; s.bud = false; s.ph = R() * TAU; }
    /* every ledge keeps at least two free spots */
    for (const L of S.ledges) { const here = this.sites.filter(s => Math.abs(s.x - L.x - 20) < 70); let free = here.filter(s => !s.taken).length; for (const s of here) { if (free >= 2) break; if (s.taken) { s.taken = null; free++; } } }
    /* kelp on the reef, eelgrass in the bay */
    this.kelp = [];
    for (let x = WORLD.reefL + 20; x < WORLD.reefR; x += 26 + R() * 34) { if (WORLD.ledgeXs.some(lx => x > lx - 80 && x < lx + 100)) continue; this.kelp.push({ x, h: 110 + R() * 160, ph: R() * TAU, seed: (R() * 1e9) | 0, w: 5 + R() * 5 }); }
    this.grass = [];
    for (let x = WORLD.bayL + 60; x < WORLD.bayR - 40; x += 5 + R() * 9) if ((Math.sin(x * .004) + Math.sin(x * .011 + 2)) > -.3) this.grass.push({ x, h: 22 + R() * 30, ph: R() * TAU });
    this.weather = { state: 'calm', timer: 60 + R() * 60, storm: 0, cloud: .15, gust: 0, snow: 0 };
    this.season = 'summer'; this.temp = 17;
    /* ---------- the water ---------- */
    this.plankton = []; this.sibs = []; this.jellies = []; this.smallFish = []; this.school = null;
    this.visitors = []; this.slug = null;
    this.tern = { state: 'hover', x: 0, y: -60, t: 0, ph: R() * TAU, target: null, kind: 'tern' };
    for (let k = 0; k < 4; k++) this.jellies.push(this.makeComb(lerp(-2400, 1400, R()), 30 + R() * 140));
    const fishCols = [['#9ab0c0', '#3a5060'], ['#c0b080', '#5a4a30'], ['#7a9ab0', '#2a3a50'], ['#b0a0a0', '#5a4040']];
    for (let k = 0; k < 18; k++) { const c = fishCols[k % fishCols.length], x = lerp(WORLD.bayL, WORLD.harbourR, R()); let y = S.surfaceAt(x) - 20 - R() * 60; for (let t = 0; t < 20 && (S.solidAt(x, y) || S.solidAt(x + 12, y) || S.solidAt(x - 12, y)); t++) y -= 8; this.smallFish.push({ x, y, dir: R() < .5 ? -1 : 1, sp: 12 + R() * 16, s: .5 + R() * .6, ph: R() * TAU, col: c[0], col2: c[1], home: x }); }
    this.mum = null;                         /* the mother jelly, while you are a baby in her arm pouch */
    this.larvaCloud = [];                    /* planulae let go, swimming down */
    this.discs = [];                         /* sister ephyrae popping off the winter stack */
    this.bloom = null;                       /* the summer bloom: { x, y, jellies[] } */
    this.clouds = [];                        /* little clouds the boys let go in the bloom */
    this.streamOn = true;
  }

  get bounds() { return { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom }; }

  /* ============================================================
     THE WATER
     ============================================================ */
  seaLevel() { return -tideAt(this.G.tod) * 8; }
  surfaceY(x) { const t = this.t, st = 1 + this.weather.storm * 3; return this.seaLevel() + st * (2.2 * Math.sin(x * .03 - t * 1.6) + 1.4 * Math.sin(x * .071 + t * 2.1)); }
  inWater(x, y) { return y > this.seaLevel() && !this.ground.solidAt(x, y); }
  /* the swell: 0..1, a slow pulse (the discs pop and the planulae go free on the pulse) */
  swash() { const u = (this.t % 5.6) / 5.6; return u < .45 ? smoothstep(0, .45, u) : 1 - smoothstep(.45, 1, u); }
  /* the strong current across the bay, out to the open sea: 0..1 how much of it is at (x, y) */
  streamAt(x, y) {
    if (!this.streamOn) return 0;
    const yk = smoothstep(40, 70, y) * (1 - smoothstep(190, 225, y));
    const xk = smoothstep(WORLD.bloomX - 200, WORLD.bloomX + 300, x) * (1 - smoothstep(WORLD.reefL - 200, WORLD.reefL + 200, x));
    return yk * xk;
  }
  /* the water's movement at a point (units per second) */
  current(x, y) {
    const t = this.t, depthK = clamp(1 - y / 520, .2, 1);
    const a = (Math.sin(x * .004 + t * .05) + Math.sin(y * .006 - t * .04 + 1.3)) * 1.6;
    let vx = Math.cos(a) * 4 + Math.sin(t * .13) * 3 * depthK, vy = Math.sin(a) * 2.4;
    vx -= 42 * this.streamAt(x, y);
    /* the open sea's swirl: the currents meet where the bloom gathers */
    if (x < WORLD.openR) { const dx = WORLD.bloomX - x; vx += clamp(dx * .02, -8, 8); }
    vx += Math.sin(t * .4) * 6 * this.weather.storm * depthK;
    /* still water in the shade under the ledges */
    for (const L of this.ground.ledges) if (Math.abs(x - L.x - 14) < 70 && y > L.slabY && y < L.g) { vx *= .35; vy *= .35; }
    return [vx, vy];
  }
  makeComb(x, y) { const R = this.R; return { x, y, r: 6 + R() * 4, ph: R() * TAU, vx: 0, vy: 0, hitDone: false }; }

  /* plankton is kept alive in a ring around whoever is swimming (or drifting past a polyp) */
  updatePlankton(dt, p) {
    const night = nightAmount(this.G.tod), R = this.R, S = this.ground;
    const band = night > .5 ? [6, 120] : [80, 300];
    const polyp = p.stage === 'polyp';
    const want = p.stage === 'ephyra' ? 90 : p.stage === 'medusa' ? 120 : polyp && p.mode === 'polyp' ? 16 : 0;
    const L = this.plankton;
    const reach = polyp ? 160 : 380;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.ph += dt;
      if (q.stuck) { L.splice(i, 1); continue; }
      let [cx, cy] = this.current(q.x, q.y);
      if (polyp) { cx = q.vx0; cy = Math.sin(q.ph * .8) * 3; }
      if (q.kind === 'copepod' && !polyp) {
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < 26 + p.r && q.tired < 1.6) { q.vx += dx / d * 260 * dt; q.vy += dy / d * 260 * dt; q.tired += dt; if (!q.jumped) { q.jumped = true; Bus.emit('copepodJump', q); } }
        else q.tired = Math.max(0, q.tired - dt * .4);
        q.vx *= Math.exp(-dt * 3); q.vy *= Math.exp(-dt * 3);
        q.x += (q.vx + cx * .5) * dt; q.y += (q.vy + cy * .5) * dt;
      } else { q.x += cx * .6 * dt + Math.sin(q.ph * .7) * 1.5 * dt; q.y += cy * .6 * dt + Math.cos(q.ph * .5) * 1.2 * dt; }
      q.glow = Math.max(0, q.glow - dt * 1.5);
      const lvl = this.seaLevel() + 3;
      if (q.y < lvl) q.y = lvl;
      if (Math.hypot(q.x - p.x, q.y - p.y) > reach || q.eaten || S.solidAt(q.x, q.y) || (polyp && q.vx0 && (q.x - p.tipX) * Math.sign(q.vx0) > 45)) L.splice(i, 1);
    }
    let tries = 0;
    while (L.length < want && tries++ < 400) {
      let x, y, vx0 = 0;
      if (polyp) {
        /* drifting in under the ledge on the slow tidal wash, from one side or the other */
        let side = R() < .5 ? -1 : 1;
        y = p.tipY + (R() - .5) * 34; x = p.tipX + side * (60 + R() * 70);
        if (S.solidAt(x, y)) { side = -side; x = p.tipX + side * (60 + R() * 70); }
        vx0 = -side * (5 + R() * 6);
      } else {
        const a = R() * TAU, d = R() < .7 ? 45 + R() * 110 : 160 + R() * 160;
        x = p.x + Math.cos(a) * d * 1.4; y = p.y + Math.sin(a) * d * .7;
        if (R() < .55) y = lerp(band[0], band[1], R());
        y = clamp(y, this.seaLevel() + 4, Math.min(620, S.surfaceAt(x) - 20));
        if (Math.hypot(x - p.x, y - p.y) < 40 + p.r) { if (L.length > want * .7) break; continue; }
      }
      if (S.solidAt(x, y)) { if (L.length > want * .7) break; continue; }
      const k = R(), kind = k < .5 ? 'diatom' : k < .66 ? 'chain' : k < .86 ? 'dino' : 'copepod';
      L.push({ x, y, kind, ph: R() * TAU, vx: 0, vy: 0, vx0, glow: 0, tired: 0, rot: R() * TAU, eaten: false });
      if (!polyp && kind === 'diatom' && R() < .3) for (let j = 0; j < 5; j++) L.push({ x: x + (R() - .5) * 26, y: clamp(y + (R() - .5) * 18, this.seaLevel() + 4, 620), kind: 'diatom', ph: R() * TAU, vx: 0, vy: 0, vx0, glow: 0, tired: 0, rot: R() * TAU, eaten: false });
    }
  }
  /* sister planulae, then sister ephyrae, drifting along with you */
  updateSibs(dt, p) {
    const kind = p.stage === 'planula' ? 'planula' : p.stage === 'ephyra' ? 'ephyra' : null;
    if (!kind) { this.sibs.length = 0; return; }
    const R = this.R;
    for (let i = this.sibs.length - 1; i >= 0; i--) if (this.sibs[i].kind !== kind) this.sibs.splice(i, 1);
    for (let tries = 0; this.sibs.length < (kind === 'planula' ? 10 : 8) && tries < 40; tries++) { const a = R() * TAU, d = 60 + R() * 160, x = p.x + Math.cos(a) * d, y = clamp(p.y + Math.sin(a) * d * .6, 10, 500); if (this.ground.solidAt(x, y) || this.ground.solidAt(x, y + 8)) continue; this.sibs.push({ kind, x, y, vx: 0, vy: 0, ph: R() * TAU, turn: 0, a: R() * TAU }); }
    for (let i = this.sibs.length - 1; i >= 0; i--) {
      const s = this.sibs[i];
      s.ph += dt * 6; s.turn -= dt;
      if (s.turn <= 0) { s.turn = .6 + R() * 1.4; s.a += (R() - .5) * 2; }
      const [cx, cy] = this.current(s.x, s.y);
      s.vx += (Math.cos(s.a) * 12 - s.vx) * dt * 2; s.vy += (Math.sin(s.a) * 8 - s.vy) * dt * 2;
      s.x += (s.vx + cx * .8) * dt; s.y += (s.vy + cy * .8) * dt;
      if (s.y < this.seaLevel() + 4) { s.y = this.seaLevel() + 4; s.a = Math.abs(s.a); }
      if (this.ground.solidAt(s.x, s.y + 4)) { s.y -= 6; s.a = -Math.PI / 2; }
      if (Math.hypot(s.x - p.x, s.y - p.y) > 420) this.sibs.splice(i, 1);
    }
  }
  /* ---------- visitors at the surface ---------- */
  startSchool(p) {
    if (this.school) return;
    const dir = this.R() < .5 ? 1 : -1, n = 30, R = this.R;
    this.school = { dir, x: p.x - dir * 420, y: p.y + (R() - .5) * 40, t: 0, fish: [] };
    for (let k = 0; k < n; k++) this.school.fish.push({ dx: (R() - .5) * 190, dy: (R() - .5) * 70, ph: R() * TAU, s: .8 + R() * .4 });
    Bus.emit('fishSchool', this.school);
  }
  /* the tern (for a tiny ephyra) or a gull (for a jelly): hovers over the surface by day, now and then dips */
  dip(p, kind) { const b = this.tern; if (b.state !== 'hover') return false; b.kind = kind || 'tern'; b.state = 'dive'; b.t = 0; b.from = { x: p.x - 200, y: -140 }; b.target = { x: p.x, y: this.seaLevel() + 2 }; Bus.emit(b.kind === 'gull' ? 'gullDip' : 'ternDip', b); return true; }
  updateTern(dt, p) {
    const b = this.tern; b.t += dt; b.ph += dt;
    if (b.state === 'hover') { b.x = p.x + Math.cos(b.ph * .2) * 260; b.y = -90 + Math.sin(b.ph * .9) * 12; }
    else if (b.state === 'dive') {
      const u = clamp(b.t / 1.4, 0, 1);
      b.x = lerp(b.from.x, b.target.x + 180, u); b.y = lerp(b.from.y, b.target.y, Math.sin(u * Math.PI));
      if (u > .48 && !b.hit) { b.hit = true; Bus.emit('birdPass', b); }
      if (u >= 1) { b.state = 'hover'; b.hit = false; }
    }
  }
  /* ---------- the turtle and the sunfish: they come for a look, try for a snack, miss, and leave ---------- */
  startVisitor(kind, p) {
    if (this.visitors.length) return null;
    const K = VISITOR_KINDS[kind], dir = this.R() < .5 ? 1 : -1;
    const v = { kind, dir, x: p.x - dir * 560, y: clamp(p.y + (this.R() - .5) * 80, this.seaLevel() + 30, this.ground.surfaceAt(p.x) - 40), state: 'come', t: 0, ph: this.R() * TAU, struck: false };
    this.visitors.push(v);
    Bus.emit('visitor', v);
    Bus.emit(kind, v);
    return v;
  }
  updateVisitors(dt, p) {
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const h = this.visitors[i], K = VISITOR_KINDS[h.kind];
      h.t += dt; h.ph += dt * (h.kind === 'turtle' ? 2 : 3);
      const floor = this.ground.surfaceAt(h.x) - 30;
      if (h.state === 'come') {
        const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy);
        h.dir = sign(dx) || h.dir;
        h.x += dx / (d || 1) * K.speed * dt; h.y += dy / (d || 1) * K.speed * .7 * dt;
        if (d < 60 + p.r) { h.state = 'strike'; h.t = 0; h.aim = { x: p.x, y: p.y }; }
        if (h.t > 25) { h.state = 'leave'; h.t = 0; }
      } else if (h.state === 'strike') {
        h.x += h.dir * K.speed * 2 * dt; h.y += (h.aim.y - h.y) * dt * 3;
        if (!h.struck && h.t > .35) { h.struck = true; if (p.struck) p.struck(h); Bus.emit('strike', h); }
        if (h.t > 1) { h.state = 'leave'; h.t = 0; }
      } else {
        h.x += h.dir * K.speed * 1.4 * dt; h.y += (Math.min(floor, h.y + 30) - h.y) * dt * .5;
        if (Math.abs(h.x - p.x) > 900) { this.visitors.splice(i, 1); Bus.emit('visitorGone', h); }
      }
      h.y = clamp(h.y, this.seaLevel() + 20, floor);
    }
  }
  /* ---------- the sea slug crawls along the ceiling towards the polyp, and on past it ---------- */
  startSlug(p) {
    if (this.slug || !p.site) return null;
    const dir = this.R() < .5 ? 1 : -1;
    this.slug = { x: p.site.x - dir * 90, y: p.site.y, dir, t: 0, state: 'crawl', touched: false, ph: 0 };
    Bus.emit('slug', this.slug);
    return this.slug;
  }
  updateSlug(dt, p) {
    const s = this.slug; if (!s) return;
    s.t += dt; s.ph += dt * 4;
    s.x += s.dir * 9 * dt;
    if (p.site) { const c = this.ground.ceilingAbove(s.x, p.site.y + 6, 30); if (c !== null) s.y += (c - s.y) * Math.min(1, dt * 4); }
    if (!s.touched && p.site && Math.abs(s.x - p.site.x) < 8) { s.touched = true; if (p.slugPass) p.slugPass(s); }
    if (p.site && (s.x - p.site.x) * s.dir > 100) { this.slug = null; Bus.emit('slugGone'); }
  }

  updateSea(dt, p) {
    this.updatePlankton(dt, p);
    this.updateSibs(dt, p);
    /* comb jellies: keep a couple drifting near a small swimmer */
    if (p.stage === 'ephyra' || p.stage === 'planula') {
      const near = this.jellies.filter(j => Math.abs(j.x - p.x) < 700);
      if (near.length < 2) { const side = this.R() < .5 ? -1 : 1; this.jellies.push(this.makeComb(p.x + side * (300 + this.R() * 300), clamp(p.y + (this.R() - .5) * 120, 10, 300))); }
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
  }
  /* new planulae let go by a mother: a cloud of tiny swimmers going down to find a rock */
  larvaBurst(x, y, n = 60) {
    const R = this.R;
    for (let k = 0; k < n; k++) { const a = Math.PI * .5 + (R() - .5) * 2.4, sp = 14 + R() * 40; this.larvaCloud.push({ x: x + (R() - .5) * 10, y: y + (R() - .5) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: R() * .4, ph: R() * TAU }); }
  }
  updateCloud(dt) {
    for (let i = this.larvaCloud.length - 1; i >= 0; i--) {
      const e = this.larvaCloud[i]; e.t += dt;
      e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-dt * 1.5); e.vy = e.vy * Math.exp(-dt * 1.2) + 10 * dt;
      if (e.t > 7) this.larvaCloud.splice(i, 1);
    }
    /* sister ephyrae popping off the stack and swimming away */
    for (let i = this.discs.length - 1; i >= 0; i--) {
      const d = this.discs[i]; d.t += dt; d.ph += dt * 7;
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= Math.exp(-dt * .4); d.vy = d.vy * Math.exp(-dt * .6) + 2 * dt;
      if (d.t > 14) this.discs.splice(i, 1);
    }
  }
  popDisc(x, y) { const R = this.R; this.discs.push({ x, y, vx: (R() - .5) * 40, vy: 10 + R() * 12, t: 0, ph: R() * TAU, rot: (R() - .5) * 2 }); }

  /* ============================================================
     THE LEDGES
     ============================================================ */
  siteAt(x, y, reach = 9) { let best = null, bd = reach; for (const s of this.sites) { const d = Math.hypot(s.x - x, (s.y - y) * 1.3); if (d < bd) { bd = d; best = s; } } return best; }
  nearestFreeSite(x, y = 200) { let best = null, bd = 1e9; for (const s of this.sites) { if (s.taken || s.mine || s.bud) continue; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } } return best; }
  /* a free spot next to the polyp for a bud (on the same ledge or beam) */
  budSite(site) {
    let best = null, bd = 1e9;
    for (const s of this.sites) { if (s === site || s.taken || s.mine || s.bud || s.kind !== site.kind) continue; const d = Math.abs(s.x - site.x); if (d < bd && d < 90) { bd = d; best = s; } }
    if (best) return best;
    /* no free spot: squeeze in right beside it */
    for (const dx of [12, -12, 22, -22, 32, -32]) {
      const x = site.x + dx, cy = this.ground.ceilingAbove(x, site.y + 8, 20);
      if (cy === null || Math.abs(cy - site.y) > 8 || this.sites.some(s => Math.abs(s.x - x) < 8 && Math.abs(s.y - cy) < 6)) continue;
      const s = { x, y: cy, kind: site.kind, taken: null, mine: false, bud: false, ph: this.R() * TAU, extra: true };
      this.sites.push(s); return s;
    }
    return null;
  }

  /* the ledge (if any) whose shady gap (x, y) is in, and the way out from under it */
  ledgeOver(x, y) { for (const L of this.ground.ledges) if (x > L.x - 75 && x < L.x + 84 && y > L.slabY - 4 && y < L.g + 4) return L; return null; }
  ledgeExit(L) { return { x: L.x + 125, y: L.slabY - 34 }; }

  /* ============================================================
     THE BLOOM
     ============================================================ */
  makeBloom(p) {
    if (this.bloom) return this.bloom;
    const R = this.R, b = { x: WORLD.bloomX, y: 150, jellies: [], t: 0 };
    for (let k = 0; k < 90; k++) b.jellies.push(this.makeBloomJelly(b, R));
    this.bloom = b;
    return b;
  }
  makeBloomJelly(b, R = this.R) {
    const a = R() * TAU, d = Math.sqrt(R()) * 440;
    const x = b.x + Math.cos(a) * d * 1.3, y = clamp(b.y + Math.sin(a) * d * .35, 40, 420);
    /* each crowd jelly drifts round its own spot in the bloom, so the crowd never piles up in a line */
    return { x, y, hx: x - b.x, hy: y - b.y, vx: 0, vy: 0, ph: R() * TAU, pr: .7 + R() * .5, cm: 16 + R() * 14, form: R() < .4 ? 'pink' : R() < .5 ? 'violet' : R() < .6 ? 'blue' : 'white', sex: R() < .5 ? 'girl' : 'boy', role: 'crowd', ang: (R() - .5) * .4, far: R() < .45 };
  }
  /* the girls for a boy (pink hearts), or boys with their little clouds for a girl, close to the player */
  makeMates(p, want) {
    const b = this.bloom || this.makeBloom(p);
    const R = this.R;
    for (let k = 0; k < 3; k++) {
      const a = R() * TAU, d = 120 + R() * 140;
      const j = this.makeBloomJelly(b, R);
      j.x = p.x + Math.cos(a) * d; j.y = clamp(p.y + Math.sin(a) * d * .5, 60, 360); j.far = false;
      j.sex = want; j.role = want === 'girl' ? 'girl' : 'boy'; j.cm = 20 + R() * 8; j.cloudT = 1 + k * 2.5;
      b.jellies.push(j);
    }
  }
  mates() { return this.bloom ? this.bloom.jellies.filter(j => j.role === 'girl' || j.role === 'boy') : []; }
  girlNear(x, y, reach) { let best = null, bd = reach; for (const j of this.mates()) { if (j.role !== 'girl' || j.met) continue; const d = Math.hypot(j.x - x, j.y - y); if (d < bd) { bd = d; best = j; } } return best; }
  cloudNear(x, y, reach) { let best = null, bd = reach; for (const c of this.clouds) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd + c.r) { bd = d; best = c; } } return best; }
  updateBloom(dt, p) {
    const b = this.bloom; if (!b) return;
    b.t += dt;
    for (const j of b.jellies) {
      j.ph += dt * 1.2 * j.pr;
      if (j.hold) continue;
      const [cx, cy] = this.current(j.x, j.y);
      /* the mates stay near you; the crowd drifts around the bloom's middle */
      const crowd = j.role === 'crowd', wob = Math.sin(b.t * .07 + j.pr * 9) * 30;
      const gx = crowd ? b.x + j.hx + wob : p.x + (j.offX || (j.offX = (this.R() - .5) * 360)), gy = crowd ? b.y + j.hy + wob * .3 : clamp(p.y + (j.offY || (j.offY = (this.R() - .5) * 140)), 50, 360);
      j.vx += ((gx - j.x) * (crowd ? .03 : .02) + (crowd ? 0 : cx * .3) - j.vx) * dt * .6;
      j.vy += ((gy - j.y) * (crowd ? .03 : .02) + Math.sin(j.ph) * 4 - j.vy) * dt * .6;
      /* a mate right beside you waits for you */
      if (!crowd && Math.hypot(j.x - p.x, j.y - p.y) < 110) { j.vx *= Math.exp(-dt * 4); j.vy *= Math.exp(-dt * 4); }
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.y = clamp(j.y, this.seaLevel() + 20, this.ground.surfaceAt(j.x) - 30);
      if (j.role === 'boy' && p.sex === 'girl' && !p.flags.met) { j.cloudT -= dt; if (j.cloudT <= 0) { j.cloudT = 6 + this.R() * 3; this.clouds.push({ x: j.x, y: j.y + j.cm * .4, r: 10, t: 0, from: j }); Bus.emit('cloud', j); } }
      if (j.role === 'crowd' && Math.abs(j.x - p.x) > 1600 && Math.abs(b.x - p.x) < 1200) Object.assign(j, this.makeBloomJelly(b));
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) { const c = this.clouds[i]; c.t += dt; c.r = 10 + c.t * 3; c.y += 2 * dt; if (c.t > 9) this.clouds.splice(i, 1); }
  }
  bloomCount(x, y, r) { if (!this.bloom) return 0; let n = 0; for (const j of this.bloom.jellies) if (Math.hypot(j.x - x, j.y - y) < r) n++; return n; }

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
      const next = { calm: 'cloudy', cloudy: rough && R() < .5 ? 'storm' : R() < .2 ? 'storm' : 'calm', storm: 'clearing', clearing: 'calm' }[W.state];
      W.state = next; W.timer = { calm: (rough ? 60 : 110) + R() * 90, cloudy: 25 + R() * 25, storm: 30 + R() * 30, clearing: 20 }[next];
      Bus.emit('weather', next);
    }
    const tc = { calm: .12, cloudy: .7, storm: 1, clearing: .4 }[W.state], ts = W.state === 'storm' ? 1 : 0;
    W.cloud += (tc - W.cloud) * (1 - Math.exp(-dt * .3));
    W.storm += (ts - W.storm) * (1 - Math.exp(-dt * .4));
    W.gust = Math.max(0, W.gust - dt * .3); if (R() < dt * .05) W.gust = .5 + R() * .5;
    W.snow += ((this.season === 'winter' && W.cloud > .4 ? 1 : 0) - W.snow) * (1 - Math.exp(-dt * .3));
    const want = SEASON_INFO[this.season][1];
    this.temp += (want - this.temp) * (1 - Math.exp(-dt * .05));
    this.updateSea(dt, p);
    this.updateCloud(dt);
    for (const f of this.smallFish) {
      f.ph += dt * 8; f.x += f.dir * f.sp * dt; f.y += Math.sin(f.ph * .2) * 4 * dt;
      if (Math.abs(f.x - f.home) > 140 || this.ground.solidAt(f.x + f.dir * 10, f.y)) f.dir *= -1;
    }
    for (const s of this.sites) s.ph += dt;
    this.updateVisitors(dt, p);
    this.updateTern(dt, p);
    this.updateSlug(dt, p);
    this.updateBloom(dt, p);
    if (this.mum) this.mum.ph += dt;
  }
}
