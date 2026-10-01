/* ============================================================
   critters.js — aphids, ants, scale insects
   ============================================================
   Each plant owns its own Aphids and Ants.  Aphids live in
   colonies on segments, drift about, give birth to live nymphs,
   squirt honeydew, sound the alarm and drop when frightened, hide
   under leaves in the rain, and stop breeding when it gets cold.
   When a plant runs low a winged migrant flies in from another
   plant and founds a new colony.

   Ants patrol the branches, drink honeydew, and shove ladybugs.
   ============================================================ */
'use strict';

class Aphids {
  constructor(plant, G) {
    this.plant = plant;
    this.G = G;
    this.list = [];
    this.migrants = [];
    this.honeydew = [];          // droplets on the stems for ants to find
    this.birthClock = 0;
    this.migrantClock = 8;
    this.dewClock = 3;
    this.coldClock = 0;
    this.maxTotal = 110;
    this.dropFactCount = 0;
    this.scales = [];
    this.seedColonies();
    if (plant.type.scale) this.seedScales();
  }

  seedColonies() {
    const P = this.plant;
    const candidates = P.segs.filter(s => s.depth >= 1 || s.len > 200);
    candidates.sort(() => Math.random() - .5);
    const n = Math.min(candidates.length, 9);
    for (let i = 0; i < n; i++) this.spawnColony(candidates[i].id, rnd(.35, .75), 5 + rndInt(3, 8));
    const low = P.segs.filter(s => s.depth >= 1 && P.nodes[s.a].y > -600);
    if (low.length) this.spawnColony(pick(low).id, .5, 8);
  }

  seedScales() {
    for (const s of this.plant.segs) {
      if (s.depth !== 0 || chance(.4)) continue;
      const n = rndInt(2, 5);
      for (let i = 0; i < n; i++) this.scales.push({ seg: s.id, t: rnd(.1, .9), off: rnd(-.6, .6), x: 0, y: 0, ang: 0 });
    }
  }

  spawnColony(segId, tc, count, variant) {
    const seg = this.plant.segs[segId];
    variant = variant || pick(this.plant.type.aphids);
    const spread = clamp(70 / seg.len, .05, .3);
    for (let i = 0; i < count; i++) this.add(segId, clamp(tc + rnd(-spread, spread), .04, .96), variant, rnd(.7, 1));
  }

  add(segId, t, variant, grow = 1) {
    const a = {
      seg: segId, t, off: rnd(-1, 1), variant, winged: chance(.06),
      grow, walk: rnd(TAU), state: 'feed', vt: 0, fear: 0, x: 0, y: 0, ang: 0,
      wait: rnd(1, 6), face: chance(.5) ? 1 : -1, caught: false, id: Math.random(),
      shy: chance(.35), hidden: 0, kick: 0
    };
    this.list.push(a);
    return a;
  }

  count() { return this.list.length; }

  /* hunters: array of bugs that can eat; env: { raining, birth, cold } */
  update(dt, hunters, diff, env) {
    const P = this.plant;
    const hunting = hunters.filter(h => h && h.plant === P && h.canEat());
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      const seg = P.segs[a.seg];
      a.grow = Math.min(1, a.grow + dt / 30);
      a.kick = Math.max(0, a.kick - dt * 3);
      /* rain: shy aphids tuck under the nearest leaf */
      a.hidden += (((env.raining && a.shy) ? 1 : 0) - a.hidden) * (1 - Math.exp(-dt * 1.5));

      const p = P.posOn(seg, a.t);
      const nx = -p.ty, ny = p.tx;
      const lat = a.off * (p.w * .5 + 3);
      a.x = p.x + nx * lat; a.y = p.y + ny * lat;
      a.ang = Math.atan2(p.ty * a.face, p.tx * a.face) + a.off * .25;

      if (a.caught) { a.kick = 1; continue; }

      /* fear of an approaching hunter */
      let nearest = null, nd = 1e9;
      for (const h of hunting) { const d = dist(a.x, a.y, h.x, h.y); if (d < nd) { nd = d; nearest = h; } }
      if (nearest && nd < 90) {
        a.fear = Math.min(1.5, a.fear + dt * (90 - nd) / 60 * diff.flee);
        if (a.fear > 1 && chance(diff.drop * dt * 2)) {
          this.drop(i, a);
          continue;
        }
        const towardPlus = ((nearest.x - a.x) * p.tx + (nearest.y - a.y) * p.ty) > 0;
        a.state = 'walk';
        a.vt = (towardPlus ? -1 : 1) * 22 * diff.flee;
        a.face = a.vt > 0 ? 1 : -1;
      } else a.fear = Math.max(0, a.fear - dt * .5);

      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.state === 'feed') { a.state = 'walk'; a.vt = rnd(6, 14) * (chance(.5) ? 1 : -1); a.face = a.vt > 0 ? 1 : -1; a.wait = rnd(.6, 2); }
        else { a.state = 'feed'; a.vt = 0; a.wait = rnd(3, 12); }
      }
      if (a.state === 'walk') {
        a.t += a.vt * dt / seg.len;
        a.walk += dt * 9;
        if (a.t < .03 || a.t > .97) {
          const node = a.t < .03 ? seg.a : seg.b;
          const opts = P.branchesAt(node, a.seg);
          if (opts.length && chance(.7)) {
            const ns = P.segs[pick(opts)];
            a.seg = ns.id;
            a.t = ns.a === node ? .04 : .96;
            a.vt = Math.abs(a.vt) * (ns.a === node ? 1 : -1);
            a.face = a.vt > 0 ? 1 : -1;
          } else { a.t = clamp(a.t, .03, .97); a.vt = -a.vt; a.face = -a.face; }
        }
      }
    }

    /* live births, scaled by season */
    this.birthClock -= dt;
    if (this.birthClock <= 0) {
      this.birthClock = rnd(1.2, 3) / Math.max(.05, env.birth);
      if (env.birth > 0 && this.list.length < this.maxTotal && this.list.length > 0) {
        const mum = pick(this.list);
        if (mum.grow > .9 && !mum.caught) {
          const seg = P.segs[mum.seg];
          const baby = this.add(mum.seg, clamp(mum.t + rnd(-12, 12) / seg.len, .04, .96), mum.variant, .1);
          baby.winged = false;
          this.G.particles.puff(mum.x, mum.y, '#dff7b5', 3);
          if (!Aphids.birthFact) { Aphids.birthFact = true; setTimeout(() => Bus.emit('fact', 'birth'), 30000); }
        }
      }
    }
    /* cold kills them off slowly */
    if (env.cold) {
      this.coldClock -= dt;
      if (this.coldClock <= 0 && this.list.length) { this.coldClock = rnd(1.5, 4); const a = this.list.pop(); this.G.particles.puff(a.x, a.y, '#cfe6ff', 3); }
    }

    /* honeydew droplets */
    this.dewClock -= dt;
    if (this.dewClock <= 0 && this.list.length) {
      this.dewClock = rnd(2.5, 6);
      const a = pick(this.list);
      if (!a.caught) {
        this.honeydew.push({ seg: a.seg, t: a.t, off: a.off * 1.6, life: rnd(14, 26), x: a.x, y: a.y });
        this.G.particles.spawn({ type: 'dot', x: a.x, y: a.y, vx: rnd(-6, 6), vy: 10, g: 60, r: 1.6, col: '#f2c54a', life: .5 });
      }
      if (this.honeydew.length > 14) this.honeydew.shift();
    }
    for (let i = this.honeydew.length - 1; i >= 0; i--) {
      const d = this.honeydew[i];
      d.life -= dt;
      if (d.life <= 0) { this.honeydew.splice(i, 1); continue; }
      const p = P.posOn(d.seg, d.t);
      d.x = p.x - p.ty * d.off * 4; d.y = p.y + p.tx * d.off * 4;
    }

    /* migrants */
    this.migrantClock -= dt;
    if (this.migrantClock <= 0) {
      this.migrantClock = rnd(6, 14);
      if (env.birth > 0 && this.list.length < 45 && this.migrants.length < 3) this.launchMigrant();
    }
    for (let i = this.migrants.length - 1; i >= 0; i--) {
      const m = this.migrants[i];
      m.life += dt;
      const target = P.posOn(m.seg, m.t);
      const dx = target.x - m.x, dy = target.y - m.y;
      const d = Math.hypot(dx, dy);
      m.walk += dt * 40;
      if (d < 4 || m.life > 25) {
        this.migrants.splice(i, 1);
        this.spawnColony(m.seg, m.t, 1, m.variant);
        const a = this.list[this.list.length - 1]; a.winged = true; a.grow = 1;
        for (let k = 0; k < 3; k++) this.add(m.seg, clamp(m.t + rnd(-.05, .05), .04, .96), m.variant, .1);
        if (!Aphids.wingedFact) { Aphids.wingedFact = true; Bus.emit('fact', 'winged'); }
      } else {
        const sp = 90;
        m.vx = lerp(m.vx, dx / d * sp, dt * 2) + Math.sin(m.life * 7) * 12 * dt;
        m.vy = lerp(m.vy, dy / d * sp, dt * 2) + Math.cos(m.life * 5) * 12 * dt;
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.ang = Math.atan2(m.vy, m.vx);
      }
    }

    /* scale insects just sit there */
    for (const sc of this.scales) {
      const p = P.posOn(sc.seg, sc.t);
      sc.x = p.x - p.ty * sc.off * p.w * .5; sc.y = p.y + p.tx * sc.off * p.w * .5;
      sc.ang = Math.atan2(p.ty, p.tx);
    }
  }

  /* An aphid lets go — and warns its neighbours with alarm scent. */
  drop(i, a) {
    this.list.splice(i, 1);
    this.G.particles.aphidFall(a);
    this.G.particles.ring(a.x, a.y, 'rgba(220,255,180,.6)', 6, 120, .7);
    for (const o of this.list) if (dist(o.x, o.y, a.x, a.y) < 70) o.fear = Math.min(1.5, o.fear + .5);
    if (this.dropFactCount++ === 1) Bus.emit('fact', 'drop');
    Bus.emit('aphidDropped', a);
  }

  launchMigrant() {
    const P = this.plant;
    const seg = pick(P.segs.filter(s => s.depth >= 1));
    if (!seg) return;
    /* set off from another plant if there is one, else from beyond the garden edge */
    const others = this.G.garden ? this.G.garden.plants.filter(p => p !== P) : [];
    let x, y;
    if (others.length) { const o = pick(others); const n = pick(o.nodes); x = n.x; y = Math.min(n.y, -200); }
    else { const b = P.bounds; x = (chance(.5) ? -1 : 1) * ((b.right - b.left) / 2 + 500); y = rnd(b.top, -200); }
    this.migrants.push({ x, y, vx: 0, vy: 0, seg: seg.id, t: rnd(.3, .8), life: 0, walk: 0, ang: 0, variant: pick(P.type.aphids) });
  }

  nearest(x, y, r) {
    let best = null, bd = r;
    for (const a of this.list) {
      if (a.caught || a.hidden > .5) continue;
      const d = dist(a.x, a.y, x, y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  nearestScale(x, y, r) {
    let best = null, bd = r, bi = -1;
    this.scales.forEach((sc, i) => { const d = dist(sc.x, sc.y, x, y); if (d < bd) { bd = d; best = sc; bi = i; } });
    return best ? { sc: best, i: bi } : null;
  }

  remove(a) {
    const i = this.list.indexOf(a);
    if (i >= 0) this.list.splice(i, 1);
  }
}

/* ============================================================ */

class Ants {
  constructor(plant, G) {
    this.plant = plant;
    this.G = G;
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
    const seg = pick(P.segs.filter(s => s.depth >= 1));
    this.list.push({ seg: seg.id, t: rnd(.2, .8), dir: chance(.5) ? 1 : -1, walk: 0, x: 0, y: 0, ang: 0, pause: 0, bite: 0, cooldown: 0, drinking: 0 });
  }

  update(dt, hunters) {
    if (!this.enabled) return;
    const P = this.plant;
    for (const a of this.list) {
      const seg = P.segs[a.seg];
      a.bite = Math.max(0, a.bite - dt * 3);
      a.cooldown = Math.max(0, a.cooldown - dt);
      /* honeydew nearby on this segment? stop and drink */
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
          const opts = P.branchesAt(node, a.seg);
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

      if (a.cooldown <= 0) for (const h of hunters) {
        if (!h || h.plant !== P || !h.onBranch()) continue;
        const d = dist(a.x, a.y, h.x, h.y);
        if (d < 26 * Math.max(.7, h.scale())) {
          a.bite = 1; a.cooldown = 1.6;
          h.shoved(a);
          if (!Ants.factShown) { Ants.factShown = true; Bus.emit('fact', 'ants'); }
        }
      }
    }
  }
}
