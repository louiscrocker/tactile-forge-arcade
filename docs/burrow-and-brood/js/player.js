/* ============================================================
   player.js — you are the ant
   ============================================================
   First the new queen: she flies in, lands, snaps off her wings,
   digs a room and raises the first brood alone.  When the first
   worker climbs out of her cocoon, you become that worker.

   MOVING   Ants cling to every surface: floors, walls, ceilings.
            Each step tries to go the way you push; if that would
            leave the soil it bends round the corner instead, and
            with nothing to hold, the ant falls.  Push INTO the
            soil and she digs: bites pile up damage on each grain
            until it gives (hardness from soil.js).  Workers carry
            the dug dirt; outside it drops onto the ant hill.
   PLANTS   At the foot of a plant, push up to climb.  The stems
            are the same walkable graph as Ladybug Life.
   ACTIONS  One button does what fits: lay (queen), feed, sip
            honeydew, take, drop, bite.  The second calls sisters
            to help (a puff of recruitment scent).
   ============================================================ */
'use strict';

class Ant {
  constructor(G, id, caste) {
    this.G = G; this.id = id; this.caste = caste;
    this.isPlayer = true;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.ang = 0; this.flip = false; this.nx = 0; this.ny = 1;
    this.walk = 0; this.moving = false;
    this.input = { x: 0, y: 0, action: false, actionPressed: false, eggPressed: false };
    this.mode = 'ground';
    this.plant = null; this.w = null;
    this.carry = null; this.carryVal = 0; this.carryBrood = null; this.carryFood = null; this.aphidVariant = 'green';
    this.crop = 0; this.load = 0;
    this.wings = caste === 'queen' ? 1 : 0;
    this.callow = caste === 'worker' ? 1 : 0;
    this.bite = 0; this.tap = 0; this.dig = 0; this.busy = 0;
    this.digging = false; this.faceX = 1; this.faceY = 0;
    this.goal = null;
    this.callCool = 0; this.dropClock = 0;
    this.underground = false;
    this.stats = { dug: 0, food: 0, milked: 0, bites: 0, moved: 0, fed: 0, deepest: 0, climbed: 0, helped: 0 };
  }
  get S() { return this.G.world.soil; }
  get colony() { return this.G.colony; }
  radius() { return this.caste === 'queen' ? 10 : 7; }
  speed() {
    const sp = this.G.speciesDef();
    let v = this.caste === 'queen' ? 55 : 96;
    if (this.S.matAt(this.x, this.y) === MAT.WATER && sp.special !== 'raft') v *= .5;
    if (this.carryFood) v *= this.carryFood.carriers.length >= this.carryFood.need ? .6 : .05;
    if (this.carry === 'bug') v *= .85;
    return v * (this.G.settings.slowmo ? .7 : 1);
  }
  scale() { return this.caste === 'queen' ? 1.25 : 1; }

  /* ---------- the queen's wedding flight: she arrives from the sky ---------- */
  startFlight(x) {
    this.mode = 'fly';
    this.fly = { t: 0, x0: x - 700, y0: -820, x1: x, y1: this.S.surfaceAt(x) - 11 };
    this.x = this.fly.x0; this.y = this.fly.y0; this.wings = 1;
  }
  place(x, y) { this.x = x; this.y = y; this.mode = 'ground'; }

  /* ---------- per frame ---------- */
  update(dt) {
    const inp = this.input, S = this.S;
    this.bite = Math.max(0, this.bite - dt * 3); this.tap = Math.max(0, this.tap - dt); this.dig = Math.max(0, this.dig - dt * 2.5);
    this.callCool = Math.max(0, this.callCool - dt);
    this.callow = Math.max(0, this.callow - dt / 40);
    this.digging = false; this.moving = false;
    if (this.mode === 'fly') { this.updateFly(dt); inp.actionPressed = inp.eggPressed = false; return; }
    if (this.wingsOff > 0) { this.wingsOff -= dt; this.wings = Math.max(0, this.wingsOff / 1.4); }
    if (this.busy > 0) { this.busy -= dt; inp.actionPressed = inp.eggPressed = false; this.finishPose(dt); return; }

    if (inp.eggPressed) this.call();
    if (inp.actionPressed) { const v = this.context(); if (v) this.act(v); }
    inp.actionPressed = inp.eggPressed = false;

    let ix = inp.x, iy = inp.y, routed = false;
    /* tapped somewhere off this plant: climb down first, then carry on */
    if (this.goal && this.mode === 'plant' && Math.hypot(ix, iy) < .15) {
      const P = this.plant, root = P.nodes[0].segs[0], rt = P.segs[root].a === 0 ? 0 : 1;
      if (!this.w.route || this.w.route.seg !== root) PlantWalk.goTo(this.w, P, root, rt);
      if (this.w.seg === root && Math.abs(this.w.t - rt) < .03) this.dismount();
    }
    /* tap-to-go: head for the goal (and dig toward it if it is inside the soil) */
    if (this.goal && Math.hypot(ix, iy) < .15 && this.mode !== 'plant') {
      const g = this.goal, d = Math.hypot(g.x - this.x, g.y - this.y);
      g.t += dt;
      if (d < (g.plantTarget ? 22 : 10) || g.t > 25) {
        /* at the foot of the plant that was tapped: climb up to the spot */
        const pt = g.plantTarget;
        if (pt && d < 22) { const P = this.G.world.plants[pt.plant]; this.mountPlant(P, this.x < P.ox ? -1 : 1); PlantWalk.goTo(this.w, P, pt.seg, pt.t); }
        this.goal = null;
      }
      else if (this.walkRoute(dt, g)) { this.finishRoute(dt); routed = true; }
      else { const v = [(g.x - this.x) / d, (g.y - this.y) / d]; ix = v[0]; iy = v[1]; }
    } else if (Math.hypot(ix, iy) > .15) this.goal = null;
    this.pathing = false;

    if (routed) { /* already moved along the route */ }
    else if (this.mode === 'plant') this.updatePlant(dt, ix, iy);
    else this.updateGround(dt, ix, iy);

    /* carrying big food with sisters: it follows your jaws */
    const f = this.carryFood;
    if (f) {
      f.x = lerp(f.x, this.x + Math.cos(this.ang) * (f.r + 6), 1 - Math.exp(-dt * 10));
      f.y = lerp(f.y, this.y - 2, 1 - Math.exp(-dt * 10));
      if (f.carriers.length >= f.need && this.colony.entrance && dist(this.x, this.y, this.colony.entrance.x, this.colony.entrance.y) < 40) this.colony.cutUp(f);
    }
    /* dirt carried outside goes onto the ant hill */
    if ((this.carry === 'soil' || this.carry === 'sand') && !this.underground && this.mode === 'ground') {
      this.dropClock += dt;
      if (this.dropClock > .5) this.dropSoil();
    } else this.dropClock = 0;
    /* food carried home leaves a scent trail for sisters */
    if ((this.carry && !['soil', 'sand', 'egg', 'larva', 'pupa'].includes(this.carry)) || this.crop > 0) { if (this.y < S.ground0(this.x) + 20 && this.colony.phase === 'growing') this.colony.dropTrail(this); }
    this.x = clamp(this.x, S.X0 + 24, S.X1 - 24);
    this.stats.deepest = Math.max(this.stats.deepest, S.depthAt(this.x, this.y));
    const was = this.underground;
    this.underground = this.mode !== 'plant' && this.y > S.ground0(this.x) + 10;
    if (this.underground && !was) Bus.emit('wentDown', this);
    if (!this.underground && was) Bus.emit('wentUp', this);
    if (this.underground && this.caste === 'queen' && this.colony.entryX === null) this.colony.entryX = this.x;
    if (this.moving) this.walk += dt * this.speed() * .16;
  }
  finishPose(dt) {
    if (this.mode === 'plant') { const p = PlantWalk.place(this.w, this.plant); this.x = p.x; this.y = p.y; }
  }
  updateFly(dt) {
    const f = this.fly; f.t += dt;
    const k = Math.min(1, f.t / 4.2), e = easeInOut(k);
    this.x = lerp(f.x0, f.x1, e); this.y = lerp(f.y0, f.y1, e) - Math.sin(k * Math.PI) * 80;
    this.ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0) * (1 - k); this.flip = false;
    this.flap = (this.flap || 0) + dt * 70; this.walk += dt * 2;
    if (k >= 1) {
      this.mode = 'ground'; this.ang = 0; this.wingsOff = 1.4;
      Bus.emit('landed', this);
      /* the two wings flutter down */
      for (let i = 0; i < 2; i++) this.G.particles.spawn({ type: 'wing', x: this.x - 6, y: this.y - 12, vx: rnd(-30, 30), vy: -30, g: 60, drag: 1.5, rot: rnd(-1, 1), vr: rnd(-3, 3), life: 5 });
    }
  }

  /* ---------- moving through the soil ---------- */
  updateGround(dt, ix, iy) {
    const S = this.S, r = this.radius(), m = Math.hypot(ix, iy);
    /* feel for soil a little beyond the legs: wide tunnels (the queen's shaft) still have walls to hold */
    const c = S.contact(this.x, this.y, r + 10);
    if (c.n) { this.nx = lerp(this.nx, c.nx, .3); this.ny = lerp(this.ny, c.ny, .3); const l = Math.hypot(this.nx, this.ny) || 1; this.nx /= l; this.ny /= l; }
    if (!c.n) {
      /* nothing to hold: fall */
      this.vy = Math.min(this.vy + 900 * dt, 600);
      const nx = this.x + ix * 40 * dt, ny = this.y + this.vy * dt;
      if (S.free(nx, ny, r)) { this.x = nx; this.y = ny; }
      else { this.vy = 0; }
      this.ny = 1; this.nx = 0;
      if (this.y > S.Y1 - 20) this.y = S.Y1 - 20;
      this.climbPlantCheck(ix, iy);
      this.faceTo(dt, this.ang);
      return;
    }
    this.vy = 0;
    if (this.climbPlantCheck(ix, iy)) return;
    if (m > .15) {
      const ux = ix / m, uy = iy / m;
      this.faceX = ux; this.faceY = uy;
      const step = this.speed() * dt * Math.min(1, m);
      const into = ux * c.nx + uy * c.ny;
      const tryMove = (a) => {
        const dx = Math.cos(a) * step, dy = Math.sin(a) * step, nx = this.x + dx, ny = this.y + dy;
        if (S.free(nx, ny, r) && S.contact(nx, ny, r + 10).n) { this.x = nx; this.y = ny; return true; }
        return false;
      };
      const base = Math.atan2(uy, ux), ox = this.x, oy = this.y;
      /* go where you push if there is room; pushing into soil digs; along a wall, bend round corners
         (following a tapped path she always slides along walls rather than digging) */
      let moved = tryMove(base);
      if (!moved && (into <= .55 || this.pathing)) {
        for (const k of [.45, .9, 1.35]) {
          /* bend round the corner toward the soil first */
          const toward = Math.atan2(c.ny, c.nx), s = Math.sign(Math.sin(toward - base)) || 1;
          if (tryMove(base + s * k) || tryMove(base - s * k)) { moved = true; break; }
        }
      }
      if (moved) { this.moving = true; this.faceTo(dt, Math.atan2(this.y - oy, this.x - ox)); }
      else if (!this.pathing && (into > .2 || !S.free(this.x + ux * (r + 4), this.y + uy * (r + 4), 3))) this.digAt(dt, ux, uy);
    }
    /* hug the surface: settle to about one body-height from the nearest soil */
    let gap = 20;
    for (let d = 2; d <= 20; d += 2) if (S.solidAt(this.x + c.nx * d, this.y + c.ny * d)) { gap = d; break; }
    const want = r + 2.5;
    if (gap < 20 && Math.abs(gap - want) > .8) {
      const mv = clamp(gap - want, -30 * dt, 60 * dt);
      const nx = this.x + c.nx * mv, ny = this.y + c.ny * mv;
      if (S.free(nx, ny, r - 1)) { this.x = nx; this.y = ny; }
    }
    /* stuck inside soil (sand fell on us, or a save restored oddly): pop out */
    if (!S.free(this.x, this.y, r - 2)) this.unstick();
  }
  faceTo(dt, a) {
    this.ang = angleLerp(this.ang, a, 1 - Math.exp(-dt * 12));
    const fx = -Math.sin(this.ang), fy = Math.cos(this.ang);
    this.flip = fx * this.nx + fy * this.ny < 0;
  }
  unstick() {
    const S = this.S, i = S.nearestWalkable(this.x, this.y, 8);
    if (i >= 0) { this.x = S.cx(i % S.cols); this.y = S.cy((i / S.cols) | 0); }
    else S.dig(this.x, this.y, this.radius() + 3, 5, .9);
  }
  digAt(dt, ux, uy) {
    const S = this.S, sp = this.G.speciesDef(), diff = this.G.diff(), r = this.radius();
    if (this.caste === 'worker' && this.load >= 12 && diff.pellets) { this.blockedByLoad = true; return; }
    this.blockedByLoad = false;
    const rate = (this.caste === 'queen' ? 2.4 : 3.2) * diff.dig * (sp.special === 'builder' ? 1.3 : 1) * (this.G.settings.slowmo ? 1.2 : 1);
    /* bite just in front of the head, wide enough for the whole body to follow */
    const dr = r + 5, reach = r * .75 + 2;
    const res = S.dig(this.x + ux * reach, this.y + uy * reach, dr, rate * dt, .8);
    this.digging = true; this.dig = 1; this.walk += dt * 4;
    this.faceTo(dt, Math.atan2(uy, ux));
    if (res.removed) {
      this.stats.dug += res.removed;
      if (this.caste === 'worker') { this.load += res.removed; if (res.sand) this.loadSand = true; }
      this.G.particles.dust(this.x + ux * (r + 8), this.y + uy * (r + 8), res.sand ? '#d8b878' : res.hard > 2 ? '#a8604a' : '#8a6040', 3, Math.atan2(uy, ux));
      AudioFX.dig && AudioFX.dig(res.hard);
      Bus.emit('dug', this, res.removed);
      if (this.caste === 'worker' && diff.pellets && this.load >= 12 && !this.carry) { this.carry = this.loadSand ? 'sand' : 'soil'; this.loadSand = false; Bus.emit('fullOfDirt', this); }
      if (this.caste === 'worker' && !diff.pellets && this.load >= 12) { const e = this.colony.entrance; if (e) S.addMound(e.x + rnd(-80, 80), 12); this.load = 0; }
    } else if (res.blocked > 4) { this.stoneBump = (this.stoneBump || 0) + dt; if (this.stoneBump > .6) { this.stoneBump = 0; Bus.emit('stone', this); AudioFX.bump && AudioFX.bump(); } }
  }
  dropSoil() {
    this.S.addMound(this.x + rnd(-6, 6), Math.max(6, Math.round(this.load)));
    this.G.particles.dust(this.x, this.y - 4, '#8a6040', 10, -Math.PI / 2);
    this.carry = null; this.load = 0; this.dropClock = 0;
    this.stats.spoil = (this.stats.spoil || 0) + 1;
    Bus.emit('spoil', this);
    AudioFX.pop && AudioFX.pop(.7);
  }
  /* Tap-to-go: walk the colony's paths (cells that touch a floor, wall or ceiling),
     like the other ants do.  Returns true while it is walking the route; false
     once it is close, or when the spot is inside the soil (then she digs toward it). */
  walkRoute(dt, g) {
    const S = this.S;
    if (!g.F || (S.version !== g.ver && g.t - (g.at || 0) > .4)) {
      g.F = g.F || new Uint16Array(S.n); g.ver = S.version; g.at = g.t;
      g.target = S.nearestWalkable(g.x, g.y, 5);
      if (g.target < 0) { g.route = false; return false; }
      S.field([g.target], g.F);
      g.cell = S.nearestWalkable(this.x, this.y, 4);
      g.route = g.cell >= 0 && g.F[g.cell] < FIELD_FAR;
    }
    if (!g.route) return false;
    if (g.cell < 0 || g.F[g.cell] <= 1) return false;
    if (g.next === undefined || g.next < 0 || g.F[g.next] >= g.F[g.cell]) g.next = S.downhill(g.F, g.cell);
    if (g.next < 0) { g.route = false; return false; }
    const tx = S.cx(g.next % S.cols), ty = S.cy((g.next / S.cols) | 0);
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy), step = this.speed() * dt;
    if (d <= step) { this.x = tx; this.y = ty; g.cell = g.next; g.next = -1; }
    else { this.x += dx / d * step; this.y += dy / d * step; }
    this.moving = true;
    if (d > .01) this.routeAng = Math.atan2(dy, dx);
    return true;
  }
  finishRoute(dt) {
    const c = this.S.contact(this.x, this.y, this.radius() + 10);
    if (c.n) { this.nx = lerp(this.nx, c.nx, .3); this.ny = lerp(this.ny, c.ny, .3); const l = Math.hypot(this.nx, this.ny) || 1; this.nx /= l; this.ny /= l; }
    this.faceTo(dt, this.routeAng || this.ang);
    this.walk += dt * this.speed() * .16;
    const S = this.S;
    this.underground = this.y > S.ground0(this.x) + 10;
  }

  /* ---------- plants ---------- */
  climbPlantCheck(ix, iy) {
    if (iy > -.5 || this.underground) return false;
    for (const P of this.G.world.plants) {
      const bx = P.ox, by = P.nodes[0].y;
      if (Math.abs(this.x - bx) < 24 && Math.abs(this.y - by) < 30) { this.mountPlant(P, this.x < bx ? -1 : 1); return true; }
    }
    return false;
  }
  mountPlant(P, side) {
    const root = P.nodes[0].segs[0];
    this.plant = P; this.mode = 'plant';
    this.w = { seg: root, t: P.segs[root].a === 0 ? 0 : 1, dir: 1, route: null, side };
    this.stats.climbed++;
    Bus.emit('climbed', this, P);
  }
  dismount() {
    const P = this.plant;
    this.mode = 'ground'; this.plant = null; this.w = null;
    this.x = P.ox + (this.x < P.ox ? -16 : 16); this.y = this.S.surfaceAt(this.x) - this.radius() - 2;
  }
  updatePlant(dt, ix, iy) {
    const P = this.plant, w = this.w;
    const step = this.speed() * .85 * dt;
    let moved = false;
    if (Math.hypot(ix, iy) > .15) { w.route = null; moved = PlantWalk.steer(w, P, ix, iy, step); }
    else if (w.route) moved = PlantWalk.follow(w, P, step) === 'moving';
    /* at the bottom of the stem, down steps off onto the ground */
    const root = P.nodes[0].segs[0], atRoot = w.seg === root && (P.segs[root].a === 0 ? w.t < .02 : w.t > .98);
    if (atRoot && iy > .5) { this.dismount(); return; }
    const p = PlantWalk.place(w, P);
    this.x = p.x; this.y = p.y;
    this.ang = angleLerp(this.ang, p.ang, 1 - Math.exp(-dt * 10));
    this.nx = -p.nx; this.ny = -p.ny;
    const fx = -Math.sin(this.ang), fy = Math.cos(this.ang);
    this.flip = fx * this.nx + fy * this.ny < 0;
    this.moving = moved;
    this.stats.highest = Math.max(this.stats.highest || 0, -this.y);
  }
  goTo(x, y) {
    const P = this.G.world.nearestPlant(x, y, 60 / Math.sqrt(this.G.cam.zoom));
    this.G.particles.ring(x, y, 'rgba(255,255,255,.8)', 5, 50, .5);
    if (this.mode === 'plant' && P && P.plant === this.plant.id) { this.goal = null; PlantWalk.goTo(this.w, this.plant, P.seg, P.t); return; }
    /* a spot on a plant: walk to its foot first, then climb */
    if (P && y < this.S.ground0(x) - 12) { const pl = this.G.world.plants[P.plant], bx = pl.ox + (this.x < pl.ox ? -12 : 12); this.goal = { x: bx, y: this.S.surfaceAt(bx) - 9, t: 0, plantTarget: P }; return; }
    this.goal = { x, y, t: 0 };
  }

  /* ---------- what the action button would do right now ---------- */
  near(list, r, pos = (o) => o) { let best = null, bd = r; for (const o of list) { const q = pos(o); const d = dist(q.x, q.y, this.x, this.y); if (d < bd) { bd = d; best = o; } } return best; }
  context() {
    const C = this.colony, W = this.G.world;
    if (this.caste === 'queen') {
      if (C.phase === 'founding' && !C.royal) return C.canFound(this) ? 'eggs' : null;
      return C.broodNear(this.x, this.y, 34, b => C.hungryLarva(b)) && C.queenReserve > .16 ? 'feed' : null;
    }
    const lb = W.ladybug;
    if (lb.onPlant && dist(lb.x, lb.y, this.x, this.y) < 50) return 'bite';
    if (this.carryFood) return 'drop';
    if (this.carryBrood && (!this.underground || this.mode === 'plant')) return null;
    if (this.carry) {
      if (['seed', 'crumb', 'bug', 'leaf'].includes(this.carry) && C.broodNear(this.x, this.y, 34, b => C.hungryLarva(b))) return 'feed';
      return 'drop';
    }
    if (this.mode === 'plant') {
      const a = this.plant.herd.nearest(this.x, this.y, 30);
      if (a && a.dew >= .5 && this.crop < 3) return 'milk';
      if (this.G.speciesDef().special === 'gardener') { const lf = this.leafNear(); if (lf) return 'take'; }
    }
    if (this.crop >= 1) {
      if (C.broodNear(this.x, this.y, 34, b => C.hungryLarva(b))) return 'feed';
      if (C.queen && dist(C.queen.x, C.queen.y, this.x, this.y) < 40) return 'feedq';
    }
    if (W.foods.nearest(this.x, this.y, 22, f => !f.falling)) return 'take';
    if (C.broodNear(this.x, this.y, 22)) return 'take';
    return null;
  }
  leafNear() {
    const P = this.plant; if (!P) return null;
    let best = null, bd = 44;
    for (const lf of P.leaves) { if ((lf.bites || 0) >= 3) continue; const p = P.posOn(lf.seg, lf.t); const d = dist(p.x, p.y, this.x, this.y); if (d < bd) { bd = d; best = lf; } }
    return best;
  }

  act(verb) {
    const C = this.colony, W = this.G.world, G = this.G;
    switch (verb) {
      case 'eggs': {
        if (!C.canFound(this)) return;
        const room = C.found(this);
        this.x = room.x + room.rx * .45; this.y = room.y + room.ry - this.radius() - 2;
        this.busy = 1.2; this.tap = 1.2;
        C.layFirstEggs(this);
        break;
      }
      case 'feed': case 'feedq': {
        if (verb === 'feedq' || (this.crop >= 1 && !this.carry && C.queen && !C.broodNear(this.x, this.y, 34, b => C.hungryLarva(b)))) {
          if (this.crop < 1) return;
          this.crop -= 1; C.feedQueen(); this.stats.fed++; this.tap = 1; this.busy = .8; AudioFX.pop && AudioFX.pop(1.3); break;
        }
        const b = C.broodNear(this.x, this.y, 34, x => C.hungryLarva(x));
        if (!b) return;
        if (this.caste === 'queen') C.feedLarva(b, true);
        else if (this.carry && ['seed', 'crumb', 'bug', 'leaf'].includes(this.carry)) { C.feedLarva(b, false); if (this.carryVal >= 3 && C.hungryLarva(b)) C.feedLarva(b, false); this.carry = null; this.carryVal = 0; }
        else if (this.crop >= 1) { this.crop -= 1; C.feedLarva(b, false); }
        else return;
        this.stats.fed++; this.tap = 1; this.busy = .7;
        G.particles.sparkle(b.x, b.y - 4, 8, '#fff3b0', 10);
        AudioFX.pop && AudioFX.pop(1.2);
        break;
      }
      case 'milk': {
        const a = this.plant.herd.nearest(this.x, this.y, 30);
        const got = this.plant.herd.milk(a, G.speciesDef().special === 'farmer' ? 1.5 : 1);
        if (!got) return;
        this.crop = Math.min(3, this.crop + got);
        this.stats.milked++; this.tap = 1.1; this.busy = .9;
        G.particles.sparkle(a.x, a.y, 8, '#ffd86a', 8);
        AudioFX.slurp ? AudioFX.slurp() : AudioFX.pop(1.4);
        break;
      }
      case 'take': {
        if (this.mode === 'plant') {
          const lf = this.leafNear(); if (!lf) return;
          lf.bites = (lf.bites || 0) + 1; this.carry = 'leaf'; this.carryVal = 2; this.busy = .8; this.bite = 1;
          G.particles.puff(this.x, this.y, '#8fd050', 6); Bus.emit('leafCut', this); break;
        }
        const f = W.foods.nearest(this.x, this.y, 26, f => !f.falling);
        if (f) {
          if (f.need <= 1) {
            W.foods.remove(f); this.carry = f.kind; this.carryVal = f.value * (f.kind === 'seed' && G.speciesDef().special === 'seeds' ? 2 : 1);
            C.dirtyFields();
            Bus.emit('pickup', this, f);
          } else {
            if (!f.carriers.includes(this)) f.carriers.push(this);
            this.carryFood = f; this.carry = null;
            Bus.emit('bigGrab', this, f);
          }
          this.bite = 1; AudioFX.pop && AudioFX.pop(.9);
          break;
        }
        const b = C.broodNear(this.x, this.y, 26);
        if (b) { b.carried = this; b.claimed = null; b.wasWet = b.wet > .3 || this.S.matAt(b.x, b.y) === MAT.WATER; this.carryBrood = b; this.carry = b.kind === 'egg' ? 'egg' : b.kind === 'larva' ? 'larva' : 'pupa'; this.bite = 1; Bus.emit('broodTaken', this, b); }
        break;
      }
      case 'drop': {
        if (this.carryFood) { const f = this.carryFood; f.carriers.splice(f.carriers.indexOf(this), 1); this.carryFood = null; break; }
        if (this.carryBrood) {
          const b = this.carryBrood, room = C.roomAt(this.x, this.y, 16) || C.nurseries()[0];
          let y = this.y; const S = this.S; while (y < this.y + 40 && !S.solidAt(this.x, y + 3)) y += 2;
          b.x = this.x + Math.cos(this.ang) * 8; b.y = y - 1; b.room = room ? room.id : b.room; b.carried = null; b.wet = S.matAt(b.x, b.y) === MAT.WATER ? 1 : 0;
          this.carryBrood = null; this.carry = null; this.stats.moved++;
          Bus.emit('broodMoved', this, b); break;
        }
        if (this.carry === 'soil' || this.carry === 'sand') { if (!this.underground) this.dropSoil(); else { Bus.emit('hint', 'dirt'); } break; }
        if (this.carry) {
          if (this.underground || C.roomAt(this.x, this.y, 20)) {
            const got = C.store('food', this.carryVal, 'player');
            this.stats.food += this.carryVal;
            G.particles.text(this.x, this.y - 18, '+' + fmtInt(got), '#ffe27a', 15);
            AudioFX.sticker && AudioFX.sticker();
          } else {
            const f = W.foods.add(this.carry === 'aphid' ? 'seed' : this.carry, this.x + Math.cos(this.ang) * 12, this.y, false); f.value = this.carryVal;
            C.dirtyFields();
          }
          this.carry = null; this.carryVal = 0;
        }
        break;
      }
      case 'bite': {
        const lb = W.ladybug;
        this.bite = 1; this.busy = .35; this.stats.bites++;
        G.particles.ring(lb.x, lb.y, 'rgba(255,120,90,.8)', 6, 90, .4);
        lb.hit(G.speciesDef().special === 'builder' ? 1.5 : 1);
        AudioFX.snap ? AudioFX.snap() : AudioFX.bump();
        break;
      }
    }
    Bus.emit('act', this, verb);
  }
  /* the second button: a puff of scent that brings sisters to help */
  call() {
    if (this.callCool > 0) return;
    this.callCool = 3;
    this.G.particles.scent(this.x, this.y);
    AudioFX.chirp && AudioFX.chirp();
    if (this.colony.phase !== 'growing') { Bus.emit('callAlone', this); return; }
    const n = this.colony.callHelp(this);
    this.stats.helped += n;
  }

  /* ---------- saving ---------- */
  serialize() {
    return { caste: this.caste, x: +this.x.toFixed(1), y: +this.y.toFixed(1), mode: this.mode === 'fly' ? 'ground' : this.mode, plant: this.plant ? this.plant.id : null, w: this.w ? { seg: this.w.seg, t: this.w.t, dir: this.w.dir, side: this.w.side } : null, carry: ['egg', 'larva', 'pupa'].includes(this.carry) ? null : this.carry, carryVal: this.carryVal, crop: this.crop, load: this.load, stats: this.stats };
  }
  restore(o) {
    this.caste = o.caste; this.x = o.x; this.y = o.y; this.mode = o.mode || 'ground';
    this.wings = 0; this.callow = 0;
    if (this.mode === 'plant' && o.plant !== null && this.G.world.plants[o.plant]) { this.plant = this.G.world.plants[o.plant]; this.w = Object.assign({ route: null }, o.w); }
    else this.mode = 'ground';
    this.carry = o.carry || null; this.carryVal = o.carryVal || 0; this.crop = o.crop || 0; this.load = o.load || 0;
    Object.assign(this.stats, o.stats || {});
  }
}
