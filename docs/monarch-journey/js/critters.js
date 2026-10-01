/* ============================================================
   critters.js — oleander aphids, ants and the paper wasp
   ============================================================
   Aphids are scenery with a lesson attached: bright yellow, just
   as poisonous as you, and NOT food.  Ants farm them for honeydew
   and shove caterpillars off the stem.  The wasp is the milkweed
   equivalent of the ladybug game's bird: a shadow that sweeps in;
   freeze (hold DOWN) or sit on a leaf and you are safe.
   ============================================================ */
'use strict';

class Aphids {
  constructor(plant, G) {
    this.plant = plant; this.G = G;
    this.list = [];
    this.honeydew = [];
    this.dewClock = 3;
    this.factShown = false;
    this.seedColonies();
  }

  seedColonies() {
    const P = this.plant;
    const stems = P.segs.filter(s => s.kind !== 'leaf' && s.len > 60);
    stems.sort(() => Math.random() - .5);
    const n = Math.min(stems.length, 4);
    for (let i = 0; i < n; i++) this.spawnColony(stems[i].id, rnd(.3, .7), rndInt(6, 11));
  }

  spawnColony(segId, tc, count) {
    const seg = this.plant.segs[segId];
    const spread = clamp(60 / seg.len, .05, .3);
    for (let i = 0; i < count; i++) this.add(segId, clamp(tc + rnd(-spread, spread), .04, .96));
  }

  add(segId, t) {
    const a = { seg: segId, t, off: rnd(-1, 1), walk: rnd(TAU), state: 'feed', vt: 0, x: 0, y: 0, ang: 0, wait: rnd(1, 6), face: chance(.5) ? 1 : -1, grow: rnd(.6, 1) };
    this.list.push(a);
    return a;
  }

  count() { return this.list.length; }

  update(dt, player) {
    const P = this.plant;
    for (const a of this.list) {
      const seg = P.segs[a.seg];
      a.grow = Math.min(1, a.grow + dt / 40);
      const p = P.posOn(seg, a.t);
      const nx = -p.ty, ny = p.tx;
      const lat = a.off * (p.w * .5 + 2);
      a.x = p.x + nx * lat; a.y = p.y + ny * lat;
      a.ang = Math.atan2(p.ty * a.face, p.tx * a.face) + a.off * .25;
      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.state === 'feed') { a.state = 'walk'; a.vt = rnd(5, 12) * (chance(.5) ? 1 : -1); a.face = a.vt > 0 ? 1 : -1; a.wait = rnd(.6, 2); }
        else { a.state = 'feed'; a.vt = 0; a.wait = rnd(3, 12); }
      }
      if (a.state === 'walk') {
        a.t += a.vt * dt / seg.len;
        a.walk += dt * 9;
        if (a.t < .04 || a.t > .96) { a.t = clamp(a.t, .04, .96); a.vt = -a.vt; a.face = -a.face; }
      }
    }
    /* honeydew for the ants */
    this.dewClock -= dt;
    if (this.dewClock <= 0 && this.list.length) {
      this.dewClock = rnd(3, 7);
      const a = pick(this.list);
      this.honeydew.push({ seg: a.seg, t: a.t, off: a.off * 1.6, life: rnd(14, 26), x: a.x, y: a.y });
      this.G.particles.spawn({ type: 'dot', x: a.x, y: a.y, vx: rnd(-6, 6), vy: 10, g: 60, r: 1.6, col: '#f2c54a', life: .5 });
      if (this.honeydew.length > 12) this.honeydew.shift();
    }
    for (let i = this.honeydew.length - 1; i >= 0; i--) {
      const d = this.honeydew[i];
      d.life -= dt;
      if (d.life <= 0) { this.honeydew.splice(i, 1); continue; }
      const p = P.posOn(d.seg, d.t);
      d.x = p.x - p.ty * d.off * 4; d.y = p.y + p.tx * d.off * 4;
    }
    /* the first time the caterpillar wanders close, explain them */
    if (!this.factShown && player && player.isLarva()) {
      for (const a of this.list) if (dist(a.x, a.y, player.x, player.y) < 60) { this.factShown = true; Bus.emit('fact', 'aphids'); break; }
    }
  }
}

/* ============================================================ */

class Ants {
  constructor(plant, G) {
    this.plant = plant; this.G = G;
    this.list = [];
    this.enabled = false;
    this.speed = 55;
  }

  setCount(n, speed) {
    this.speed = speed || 55;
    while (this.list.length < n) this.spawn();
    this.list.length = Math.min(this.list.length, n);
  }

  spawn() {
    const P = this.plant;
    const seg = pick(P.segs.filter(s => s.kind !== 'leaf'));
    this.list.push({ seg: seg.id, t: rnd(.2, .8), dir: chance(.5) ? 1 : -1, walk: 0, x: 0, y: 0, ang: 0, pause: 0, bite: 0, cooldown: 0, drinking: 0 });
  }

  update(dt, player) {
    if (!this.enabled) return;
    const P = this.plant;
    for (const a of this.list) {
      const seg = P.segs[a.seg];
      a.bite = Math.max(0, a.bite - dt * 3);
      a.cooldown = Math.max(0, a.cooldown - dt);
      if (a.pause <= 0 && a.drinking <= 0) {
        for (const d of P.aphids.honeydew) {
          if (d.seg === a.seg && Math.abs(d.t - a.t) * seg.len < 6) { a.drinking = rnd(2, 4); d.life = Math.min(d.life, a.drinking); break; }
        }
      }
      if (a.drinking > 0) { a.drinking -= dt; a.bite = .4; }
      else if (a.pause > 0) { a.pause -= dt; }
      else {
        a.t += a.dir * this.speed * dt / seg.len;
        a.walk += dt * 14;
        if (a.t <= 0 || a.t >= 1) {
          const node = a.t <= 0 ? seg.a : seg.b;
          const opts = P.branchesAt(node, a.seg).filter(id => P.segs[id].kind !== 'leaf' || chance(.3));
          if (opts.length && node !== 0) {
            const ns = P.segs[pick(opts)];
            a.seg = ns.id; a.t = ns.a === node ? 0.01 : 0.99; a.dir = ns.a === node ? 1 : -1;
          } else { a.t = clamp(a.t, 0, 1); a.dir = -a.dir; a.pause = rnd(.4, 1.2); }
        }
        if (chance(dt * .15)) a.pause = rnd(.3, 1.5);
      }
      const p = P.posOn(seg, a.t);
      a.x = p.x; a.y = p.y;
      a.ang = Math.atan2(p.ty * a.dir, p.tx * a.dir);

      if (a.cooldown <= 0 && player && player.onPlant() && player.isLarva()) {
        const d = dist(a.x, a.y, player.x, player.y);
        if (d < 26 * Math.max(.7, player.scale())) {
          a.bite = 1; a.cooldown = 1.6;
          player.shoved(a);
          if (!Ants.factShown) { Ants.factShown = true; Bus.emit('fact', 'ants'); }
        }
      }
    }
  }
}

/* ============================================================ */

class Wasp {
  constructor(G) {
    this.G = G;
    this.state = 'idle';      // idle | warning | pass
    this.timer = rnd(50, 90);
    this.x = 0; this.y = 0; this.vx = 0;
    this.phase = 0;
    this.targetX = 0; this.targetY = 0;
    this.enabled = true;
    this.factShown = false;
    this.side = 1;
    this.checked = false;
  }

  update(dt, p, night) {
    this.phase += dt * 40;
    switch (this.state) {
      case 'idle':
        this.timer -= dt;
        if (this.timer <= 0) {
          if (!this.enabled || night > .5 || !p.isLarva() || !p.onPlant()) { this.timer = rnd(15, 30); break; }
          this.targetX = p.x; this.targetY = p.y;
          this.state = 'warning'; this.timer = 2.6; this.checked = false;
          this.side = chance(.5) ? -1 : 1;
          this.x = this.targetX - this.side * 900; this.y = this.targetY - 60;
          this.vx = this.side * 420;
          Bus.emit('hint', 'wasp');
          Bus.emit('waspWarning');
          AudioFX.waspBuzz(true);
        }
        break;
      case 'warning':
        this.timer -= dt;
        this.x = this.targetX - this.side * (900 - (2.6 - this.timer) * 120);
        if (this.timer <= 0) { this.state = 'pass'; this.timer = 4; }
        break;
      case 'pass':
        this.x += this.vx * dt;
        this.y = this.targetY - 50 + Math.sin(this.phase * .2) * 14;
        this.timer -= dt;
        if (!this.checked && Math.abs(this.x - p.x) < 30) {
          this.checked = true;
          if (p.isSafeFromWasp()) { this.G.particles.text(p.x, p.y - 30, 'Safe!', '#c9ffb0', 18); Bus.emit('waspSafe'); }
          else { p.frightened(this.side); Bus.emit('waspScare'); }
        }
        if (this.timer <= 0 || Math.abs(this.x - this.targetX) > 1300) {
          this.state = 'idle'; this.timer = rnd(60, 120);
          AudioFX.waspBuzz(false);
          Bus.emit('hint', 'safe');
          if (!this.factShown) { this.factShown = true; Bus.emit('fact', 'wasp'); }
        }
        break;
    }
  }

  danger() {
    if (this.state === 'warning') return 1 - this.timer / 2.6;
    if (this.state === 'pass') return 1;
    return 0;
  }
}
