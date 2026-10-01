/* ============================================================
   wildlife.js — wild larvae and the bird
   ============================================================
   Wild larvae are other ladybugs' children hunting the same
   aphids.  They wander the branch graph, eat now and then, and a
   Harlequin player can eat the small ones.

   The bird is a shadow that sweeps over the garden.  A larva that
   freezes (holds DOWN) or sits under a leaf is safe; an adult
   that plays dead is safe.  Anyone else gets a fright and a
   shove — never worse than that.
   ============================================================ */
'use strict';

class WildLarvae {
  constructor(plant, G) {
    this.plant = plant; this.G = G;
    this.list = [];
    this.factShown = false;
  }

  setCount(n) {
    while (this.list.length < n) this.spawn();
    this.list.length = Math.min(this.list.length, n);
  }

  spawn() {
    const P = this.plant;
    const seg = pick(P.segs.filter(s => s.depth >= 1));
    this.list.push({ seg: seg.id, t: rnd(.2, .8), dir: chance(.5) ? 1 : -1, instar: rndInt(1, 3), walk: 0, x: 0, y: 0, ang: 0, pause: 0, chew: 0, eatClock: rnd(6, 14), id: Math.random() });
  }

  update(dt, env) {
    const P = this.plant;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      const seg = P.segs[w.seg];
      w.chew = Math.max(0, w.chew - dt * 2);
      if (w.pause > 0) w.pause -= dt;
      else {
        const sp = 40 + w.instar * 10;
        w.t += w.dir * sp * dt / seg.len;
        w.walk += dt * sp * .16;
        if (w.t <= 0 || w.t >= 1) {
          const node = w.t <= 0 ? seg.a : seg.b;
          const opts = P.branchesAt(node, w.seg);
          if (opts.length && node !== 0) {
            const ns = P.segs[pick(opts)];
            w.seg = ns.id; w.t = ns.a === node ? .01 : .99; w.dir = ns.a === node ? 1 : -1;
          } else { w.t = clamp(w.t, 0, 1); w.dir = -w.dir; w.pause = rnd(.5, 1.5); }
        }
        if (chance(dt * .1)) w.pause = rnd(.5, 2);
      }
      const p = P.posOn(seg, w.t);
      w.x = p.x; w.y = p.y;
      w.ang = Math.atan2(p.ty * w.dir, p.tx * w.dir);
      /* the odd snack */
      w.eatClock -= dt;
      if (w.eatClock <= 0) {
        w.eatClock = rnd(8, 18) / Math.max(.2, env.birth || 1);
        const a = P.aphids.nearest(w.x, w.y, 22);
        if (a && !a.caught) { P.aphids.remove(a); w.chew = 1; w.pause = .8; this.G.particles.splat(a.x, a.y, '#a6e05a', 6); }
      }
    }
    if (!this.factShown && this.list.length) { this.factShown = true; setTimeout(() => Bus.emit('fact', 'wild'), 45000); }
  }

  nearest(x, y, r) {
    let best = null, bd = r;
    for (const w of this.list) { const d = dist(w.x, w.y, x, y); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  remove(w) { const i = this.list.indexOf(w); if (i >= 0) this.list.splice(i, 1); }
}

/* ============================================================ */

class Bird {
  constructor(G) {
    this.G = G;
    this.state = 'idle';      // idle | warning | pass | gone
    this.timer = rnd(70, 120);
    this.x = 0; this.y = 0; this.vx = 0;
    this.phase = 0;
    this.targetX = 0;
    this.checked = false;
    this.enabled = true;
    this.factShown = false;
  }

  update(dt, players, tod, season) {
    const day = tod > .28 && tod < .8;
    this.phase += dt * 9;
    switch (this.state) {
      case 'idle':
        this.timer -= dt;
        if (this.timer <= 0) {
          if (!this.enabled || !day || season === 'winter' || !players.some(p => p.onBranch() || p.state === 'flying')) { this.timer = rnd(20, 40); break; }
          const target = pick(players.filter(p => p.onBranch() || p.state === 'flying'));
          this.targetX = target.x; this.targetY = target.y;
          this.state = 'warning'; this.timer = 2.6; this.checked = false;
          this.side = chance(.5) ? -1 : 1;
          this.x = this.targetX - this.side * 1400; this.y = this.targetY - 120;
          this.vx = this.side * 700;
          AudioFX.birdCall && AudioFX.birdCall();
          for (const p of players) Bus.emit('hint', p.stage === 6 ? 'birdAdult' : 'bird');
          Bus.emit('birdWarning');
        }
        break;
      case 'warning':
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'pass'; this.timer = 4; }
        break;
      case 'pass':
        this.x += this.vx * dt;
        this.y = this.targetY - 120 + Math.sin(this.phase * .2) * 20;
        this.timer -= dt;
        /* the moment it passes over each player */
        for (const p of players) {
          if (p._birdChecked) continue;
          if (Math.abs(this.x - p.x) < 40) {
            p._birdChecked = true;
            const safe = p.isSafeFromBird();
            if (safe) {
              this.G.particles.text(p.x, p.y - 30, 'Safe!', '#c9ffb0', 18);
              Bus.emit('birdSafe', p);
            } else {
              p.frightened(this.side);
              Bus.emit('birdScare', p);
            }
          }
        }
        if (this.timer <= 0 || Math.abs(this.x - this.targetX) > 1800) {
          this.state = 'idle'; this.timer = rnd(80, 150);
          for (const p of players) p._birdChecked = false;
          Bus.emit('hint', 'safe');
          if (!this.factShown) { this.factShown = true; Bus.emit('fact', 'bird'); }
        }
        break;
    }
  }

  /* 0..1 how close the danger is, for the warning vignette */
  danger() {
    if (this.state === 'warning') return 1 - this.timer / 2.6;
    if (this.state === 'pass') return 1;
    return 0;
  }
}
