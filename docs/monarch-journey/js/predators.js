/* ============================================================
   predators.js — birds on the route, a mantis on the milkweed
   ============================================================
   Most birds leave a monarch alone; two Mexican birds do not.
   A RouteBird warns, then chases for a few seconds.  Dive or get
   into a tree.  If it catches you it spits you out (you taste of
   milkweed): a fright and a little energy, never worse.

   The Mantis sits on one leaf.  Walk within reach and it strikes;
   a big caterpillar drops on a silk thread and climbs back.
   ============================================================ */
'use strict';

class RouteBird {
  constructor(G) {
    this.G = G;
    this.state = 'idle';           // idle | warning | chase | leave
    this.timer = rnd(40, 70);
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.kind = 'grosbeak';
    this.phase = 0; this.side = 1;
    this.enabled = true;
    this.target = null;
    this.caught = false;
  }
  update(dt, players, route, night) {
    this.phase += dt * 14;
    const flying = players.filter(p => p.state === 'migrating' || p.state === 'winterFly');
    switch (this.state) {
      case 'idle': {
        this.timer -= dt;
        if (this.timer > 0) break;
        const p = flying[0];
        const z = p ? route.zone(p.x).key : '';
        const here = z === 'mexico' || z === 'forest' || z === 'plains';
        if (!this.enabled || !p || !here || night > .4) { this.timer = rnd(12, 25); break; }
        this.kind = z === 'forest' ? 'oriole' : (z === 'mexico' ? 'grosbeak' : 'kingbird');
        this.target = p;
        this.side = chance(.5) ? -1 : 1;
        this.x = p.x - this.side * 900; this.y = p.y - 200;
        this.state = 'warning'; this.timer = 2.2; this.caught = false;
        Bus.emit('hint', 'bird'); Bus.emit('birdWarning', this);
        if (this.kind !== 'kingbird') Bus.emit('fact', 'oriole');
        AudioFX.birdCall && AudioFX.birdCall();
        break;
      }
      case 'warning':
        this.timer -= dt;
        this.x += this.side * 120 * dt;
        if (this.timer <= 0) { this.state = 'chase'; this.timer = 5.5; }
        break;
      case 'chase': {
        this.timer -= dt;
        const p = this.target;
        const safe = !(p.state === 'migrating' || p.state === 'winterFly');
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        const sp = 250;
        this.vx = lerp(this.vx, dx / d * sp, dt * 3); this.vy = lerp(this.vy, dy / d * sp, dt * 3);
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y > -40) this.y = -40;
        if (!safe && d < 30 && !this.caught) {
          this.caught = true;
          p.spatOut(this.side);
          this.state = 'leave'; this.timer = 3;
          Bus.emit('birdCaught', p);
        } else if (safe || this.timer <= 0) {
          this.state = 'leave'; this.timer = 3;
          if (!safe || p.state === 'roosting' || p.state === 'nectaring') { Journal.add('milestones', 'escaped'); Bus.emit('birdEscaped', p); }
        }
        break;
      }
      case 'leave':
        this.timer -= dt;
        this.vx = lerp(this.vx, -this.side * 260, dt * 2); this.vy = lerp(this.vy, -120, dt * 2);
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = rnd(45, 90); Bus.emit('hint', 'safe'); }
        break;
    }
  }
  danger() { return this.state === 'warning' ? 1 - this.timer / 2.2 : this.state === 'chase' ? 1 : 0; }
}

/* ============================================================ */

class Mantis {
  constructor(plant, G, avoidLeaf) {
    this.plant = plant; this.G = G;
    const leaves = plant.leaves.filter(l => l.id !== avoidLeaf && plant.segs[l.seg].depth === 0);
    const lf = leaves.length ? leaves[Math.floor(leaves.length / 2)] : null;
    this.leaf = lf; this.seg = lf ? lf.seg : -1; this.t = .62;
    this.x = 0; this.y = 0; this.ang = 0; this.side = lf ? lf.side : 1;
    this.strike = 0; this.cooldown = 0; this.enabled = !!lf;
    this.sway = 0;
    this.warned = false;
  }
  update(dt, p) {
    if (!this.enabled) return;
    const P = this.plant;
    const q = P.posOn(this.seg, this.t);
    this.x = q.x; this.y = q.y; this.ang = Math.atan2(q.ty * -this.side, q.tx * -this.side);
    this.strike = Math.max(0, this.strike - dt * 2.5);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sway = Math.sin(this.G.time * 1.3) * .08;
    if (!p || !p.isLarva() || !p.onPlant()) return;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d < 150 && !this.warned) { this.warned = true; Bus.emit('hint', 'mantisNear'); Bus.emit('fact', 'mantis'); }
    if (d > 260) this.warned = false;
    if (d < 46 * Math.max(.7, p.scale()) && this.cooldown <= 0 && p.frozen < .6 && p.state === 'larva') {
      this.strike = 1; this.cooldown = 9;
      AudioFX.bump();
      if (p.stage >= 2) { p.dropOnSilk(this.x, this.y); Journal.add('milestones', 'mantis'); }
      else p.frightened(this.side);
      Bus.emit('mantisStrike', p);
    }
  }
}
