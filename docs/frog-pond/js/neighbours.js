/* ============================================================
   neighbours.js — everyone else who lives at the pond
   ============================================================
   A painted turtle that basks on the log and slides off when
   you come close, water striders skating on the surface,
   caddisfly larvae in stone cases, water boatmen rowing,
   newts, leeches, and the wild tadpoles that hatch from every
   egg mass in the pond.  None of them can hurt you.  Coming
   close to one is how it gets into the field guide.
   ============================================================ */
'use strict';

class Neighbours {
  constructor(G) {
    this.G = G;
    const pond = G.pond, rng = mulberry32(pond.seed ^ 0x77aa);
    this.turtle = { state: 'bask', x: pond.log.x - 40, y: 0, t: 0, ph: rng() * TAU, timer: 0, dir: 1 };
    this.striders = [];
    for (let i = 0; i < 6; i++) this.striders.push({ x: lerp(-pond.W + 200, pond.W - 200, rng()), vx: 0, ph: rng() * TAU, timer: rng() * 2, dir: 1 });
    this.caddis = [];
    for (let i = 0; i < 4; i++) { const x = lerp(-pond.W + 160, pond.W - 160, rng()); this.caddis.push({ x, dir: rng() < .5 ? -1 : 1, walk: 0, seed: (rng() * 99) | 0, pause: 0 }); }
    this.boatmen = [];
    for (let i = 0; i < 5; i++) this.boatmen.push({ x: lerp(-pond.W + 200, pond.W - 200, rng()), y: 30 + rng() * 80, vx: 0, vy: 0, ph: rng() * TAU, timer: rng(), dir: 1 });
    this.newts = [];
    for (let i = 0; i < 2; i++) this.newts.push({ x: lerp(-pond.W + 300, pond.W - 300, rng()), y: 120 + rng() * 120, vx: 20, vy: 0, ph: rng() * TAU, timer: 0, tx: 0, ty: 0, dir: 1, breath: rng() * 40 });
    this.leeches = [];
    for (const r of pond.rocks.filter(r => !r.pebble).slice(0, 3)) this.leeches.push({ x: r.x - r.rx * .6, y: r.y - r.ry * .9, ph: rng() * TAU });
    this.tadpoles = [];
    this.toadlets = [];
    this.seen = new Set();
    this.seenClock = 0;
  }

  /* wild tadpoles from a hatched egg mass */
  hatch(mass) {
    const n = Math.min(10, 26 - this.tadpoles.length);
    for (let i = 0; i < n; i++) this.tadpoles.push({ x: mass.x + rnd(-20, 20), y: mass.y + rnd(-10, 10), ang: rnd(TAU), kick: rnd(TAU), size: .28, age: 0, species: mass.species || 'green', tx: mass.x, ty: mass.y, timer: rnd(2) });
    this.G.particles.sparkle(mass.x, mass.y, 20, '#dff6ff', 20);
    Bus.emit('wildHatch', mass, n);
  }

  /* every toadlet leaves the pond at once on a rainy day */
  parade(p) {
    const pond = this.G.pond, side = p.x < 0 ? -1 : 1;
    for (let i = 0; i < 14; i++) this.toadlets.push({ x: side * (pond.W + 4 + i * 6), y: pond.bedY(side * (pond.W + 4)), dir: side, hop: rnd(.1, .8), air: false, vy: 0, vx: 0, life: 40 });
    Bus.emit('toadParade', p);
  }
  update(dt, players, env) {
    const G = this.G, pond = G.pond, p = players[0];
    for (let i = this.toadlets.length - 1; i >= 0; i--) {
      const t = this.toadlets[i]; t.life -= dt; t.hop -= dt;
      if (!t.air && t.hop <= 0) { t.air = true; t.vx = t.dir * rnd(40, 80); t.vy = -rnd(120, 180); }
      if (t.air) { t.vy += 700 * dt; t.x += t.vx * dt; t.y += t.vy * dt; const gy = pond.bedY(t.x); if (t.vy > 0 && t.y >= gy) { t.y = gy; t.air = false; t.hop = rnd(.2, 1); } }
      if (t.life <= 0 || Math.abs(t.x) > pond.W + 900) this.toadlets.splice(i, 1);
    }
    const cold = env.cold;
    /* ---- turtle ---- */
    const T = this.turtle;
    T.ph += dt * 3;
    const logTop = pond.logTop(T.x);
    switch (T.state) {
      case 'bask':
        T.y = logTop - 2;
        T.timer += dt;
        if (cold || env.night > .7) { T.state = 'gone'; T.timer = 0; }
        for (const q of players) { const sp = Math.hypot(q.vx, q.vy); if (dist(q.x, q.y, T.x, T.y) < 140 && (sp > 40 || q.mode === 'air') && T.timer > 4) { T.state = 'slide'; T.t = 0; Bus.emit('turtleSlide', T); break; } }
        break;
      case 'slide': {
        T.t += dt;
        const L = pond.log, endX = L.x + L.len / 2 + 30;
        T.x = lerp(L.x - 40, endX, smoothstep(0, 1.1, T.t));
        T.y = T.t < 1.1 ? pond.logTop(Math.min(T.x, L.x + L.len / 2 - 4)) - 2 : T.y + 140 * dt;
        if (T.t >= 1.1 && !T.splashed) { T.splashed = true; G.particles.splash(T.x, pond.surfaceAt(T.x), 1.3, 18); pond.disturb(T.x, 40, 3); AudioFX.splash && AudioFX.splash(1.4, T.x, 3.5); }
        if (T.t > 1.8) { T.state = 'gone'; T.timer = 0; T.splashed = false; }
        break;
      }
      case 'gone':
        T.timer += dt;
        if (T.timer > rnd(25, 40) && !cold && env.night < .5) { T.state = 'climb'; T.t = 0; T.x = pond.log.x + pond.log.len / 2 + 20; T.y = pond.surfaceAt(T.x) + 10; }
        break;
      case 'climb':
        T.t += dt;
        T.x = lerp(pond.log.x + pond.log.len / 2 + 20, pond.log.x - 40, smoothstep(0, 3, T.t));
        T.y = lerp(pond.surfaceAt(T.x) + 10, pond.logTop(T.x) - 2, smoothstep(0, 1.2, T.t));
        if (T.t > 3) { T.state = 'bask'; T.timer = 0; }
        break;
    }
    /* ---- striders ---- */
    for (const s of this.striders) {
      s.timer -= dt; s.ph += dt * (Math.abs(s.vx) > 20 ? 30 : 4);
      let flee = 0; for (const q of players) { const d = q.x - s.x; if (Math.abs(d) < 90 && q.y < 40) flee = -sign(d); }
      if (flee) { s.vx = flee * 220; s.timer = .3; }
      else if (s.timer <= 0) { s.timer = rnd(.4, 2.5); s.vx = chance(.6) ? rnd(-90, 90) : 0; }
      s.vx *= 1 - Math.min(1, 4 * dt); s.x += s.vx * dt;
      if (Math.abs(s.x) > pond.W - 120) { s.x = sign(s.x) * (pond.W - 120); s.vx *= -1; }
      if (Math.abs(s.vx) > 4) s.dir = sign(s.vx);
      if (Math.abs(s.vx) > 30 && chance(dt * 10)) pond.disturb(s.x, .8, 1);
      s.y = pond.surfaceAt(s.x) - 1;
      if (pond.weather.ice > .3 || cold) s.y = 9999;     // gone for the winter
    }
    /* ---- caddis ---- */
    for (const c of this.caddis) { c.pause -= dt; if (c.pause > 0) continue; c.walk += dt * 5; c.x += c.dir * 4 * dt; if (chance(dt * .1)) c.pause = rnd(2, 6); if (chance(dt * .05)) c.dir *= -1; c.x = clamp(c.x, -pond.W + 120, pond.W - 120); }
    /* ---- boatmen ---- */
    for (const b of this.boatmen) {
      b.timer -= dt; b.ph += dt * 9;
      if (b.timer <= 0) { b.timer = rnd(.3, .9); const a = rnd(TAU); b.vx += Math.cos(a) * 70; b.vy += Math.sin(a) * 40 - 8; }
      b.vx *= 1 - Math.min(1, 3 * dt); b.vy *= 1 - Math.min(1, 3 * dt); b.vy += 4 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const surf = pond.surfaceAt(b.x) + 6, bed = pond.bedY(b.x) - 8;
      if (b.y < surf) { b.y = surf; b.vy = Math.abs(b.vy) * .3; } if (b.y > bed) { b.y = bed; b.vy = -Math.abs(b.vy); }
      b.x = clamp(b.x, -pond.W + 100, pond.W - 100);
      if (Math.abs(b.vx) > 5) b.dir = sign(b.vx);
    }
    /* ---- newts ---- */
    for (const n of this.newts) {
      n.timer -= dt; n.breath -= dt; n.ph += dt * (3 + Math.hypot(n.vx, n.vy) * .08);
      if (n.timer <= 0) { n.timer = rnd(3, 8); n.tx = clamp(n.x + rnd(-300, 300), -pond.W + 200, pond.W - 200); n.ty = rnd(60, Math.max(70, pond.bedY(n.tx) - 40)); }
      if (n.breath <= 0) { n.ty = pond.surfaceAt(n.x) + 8; if (n.y < pond.surfaceAt(n.x) + 14) { n.breath = rnd(40, 90); G.particles.ripple(n.x, pond.surfaceAt(n.x), .5); } }
      n.vx += ((n.tx - n.x) * .4 - n.vx) * (1 - Math.exp(-dt * 1.5)); n.vy += ((n.ty - n.y) * .4 - n.vy) * (1 - Math.exp(-dt * 1.5));
      const sp = Math.hypot(n.vx, n.vy), cap = cold ? 10 : 45; if (sp > cap) { n.vx *= cap / sp; n.vy *= cap / sp; }
      n.x += n.vx * dt; n.y += n.vy * dt;
      n.y = clamp(n.y, pond.surfaceAt(n.x) + 8, pond.bedY(n.x) - 8);
      if (Math.abs(n.vx) > 3) n.dir = sign(n.vx);
    }
    for (const l of this.leeches) l.ph += dt * 1.4;
    /* ---- wild tadpoles: school near their birthplace, grow, then slip away into the reeds ---- */
    for (let i = this.tadpoles.length - 1; i >= 0; i--) {
      const t = this.tadpoles[i];
      t.age += dt; t.timer -= dt;
      t.size = Math.min(1, .28 + t.age / 600);
      if (t.timer <= 0) { t.timer = rnd(1, 3); t.tx = clamp(t.tx + rnd(-80, 80), -pond.W + 80, pond.W - 80); t.ty = clamp(t.ty + rnd(-40, 40), pond.surfaceAt(t.tx) + 20, pond.bedY(t.tx) - 20); }
      const dx = t.tx - t.x, dy = t.ty - t.y, d = Math.hypot(dx, dy) || 1;
      let ax = dx / d * 40, ay = dy / d * 40;
      for (const q of players) { const dd = dist(q.x, q.y, t.x, t.y); if (dd < 70 && q.isFrogLike()) { ax += (t.x - q.x) / dd * 200; ay += (t.y - q.y) / dd * 200; } }
      const want = Math.atan2(ay, ax);
      t.ang = angleLerp(t.ang, want, 1 - Math.exp(-dt * 3));
      const sp = (cold ? 8 : 34) * (0.7 + t.size * .5);
      t.x += Math.cos(t.ang) * sp * dt; t.y += Math.sin(t.ang) * sp * dt; t.kick += dt * 9;
      t.y = clamp(t.y, pond.surfaceAt(t.x) + 8, pond.bedY(t.x) - 8);
      if (t.size >= 1 && chance(dt * .05)) { this.tadpoles.splice(i, 1); Bus.emit('wildGrown', t); }
    }
    /* ---- field guide sightings ---- */
    this.seenClock -= dt;
    if (this.seenClock <= 0 && p) {
      this.seenClock = .5;
      const near = (x, y, r = 170) => dist(p.x, p.y, x, y) < r;
      const mark = (key) => { if (!this.seen.has(key)) { this.seen.add(key); Bus.emit('seen', key); } };
      if (T.state !== 'gone' && near(T.x, T.y)) mark('turtle');
      for (const s of this.striders) if (near(s.x, s.y)) mark('strider');
      for (const c of this.caddis) if (near(c.x, pond.bedY(c.x))) mark('caddis');
      for (const b of this.boatmen) if (near(b.x, b.y)) mark('boatman');
      for (const n of this.newts) if (near(n.x, n.y)) mark('newt');
      for (const l of this.leeches) if (near(l.x, l.y, 120)) mark('leech');
      for (const t of this.tadpoles) if (near(t.x, t.y, 120)) mark('wildtadpole');
      for (const s of G.snails.list) if (near(s.x, pond.bedY(s.x), 120)) mark('snail');
      if (!pond.place.goldfish) for (const m of G.minnows.list) if (near(m.x, m.y)) { mark('minnow'); break; }
      for (const w of G.wrigglers.list) if (near(w.x, w.y, 120)) { mark('wriggler'); break; }
      for (const b of G.bugs.list) if (near(b.x, b.y, 200)) mark(b.kind);
      for (const n of G.nymphs.list) if (near(n.x, n.y)) mark('nymph');
      if (G.heron && G.heron.active && near(G.heron.x, G.heron.y, 500)) mark('heron');
      for (const f of G.chorus.frogs) if (f.present > .5 && near(f.x, f.y, 200)) mark(f.species.key);
      for (const a of G.algae.patches) if (a.amount > .3 && near(a.x, a.y, 100)) { mark('algae'); break; }
      for (const pd of pond.pads) if (pond.padSize(pd) > 20 && near(pd.x, pd.y, 120)) { mark('lilypad'); break; }
      if (near(pond.log.x, pond.log.y, 260)) mark('log');
      for (const r of pond.reeds) if (r.kind === 'cattail' && near(r.x, r.base - 100, 200)) { mark('cattail'); break; }
      for (const m of G.eggMasses) if (near(m.x, m.y, 120)) mark(m.string ? 'toadspawn' : 'spawn');
      if (G.hazards) G.hazards.sightings(mark, near);
      for (const pp of pond.pitchers) if (near(pp.x, pond.bedY(pp.x) - 20, 200)) { mark('pitcher'); break; }
      for (const m of pond.mossMats) if (near(m.x, 0, 220)) { mark('sphagnum'); break; }
      if (pond.blackbird && near(pond.blackbird.reed.x, pond.blackbird.reed.base - pond.blackbird.reed.h, 420)) mark('blackbird');
      if (pond.place.goldfish) for (const m of G.minnows.list) if (near(m.x, m.y)) { mark('goldfish'); break; }
      if (G.events && G.events.ladybug && near(G.events.ladybug.x, G.events.ladybug.y, 260)) mark('ladybug');
    }
  }

  serialize() { return { tadpoles: this.tadpoles.map(t => [+t.x.toFixed(0), +t.y.toFixed(0), +t.size.toFixed(2), t.species]), seen: [...this.seen] }; }
  restore(o) {
    if (!o) return;
    this.tadpoles = (o.tadpoles || []).map(([x, y, size, species]) => ({ x, y, ang: rnd(TAU), kick: rnd(TAU), size, age: (size - .28) * 600, species: species || 'green', tx: x, ty: y, timer: rnd(2) }));
    this.seen = new Set(o.seen || []);
  }
}
