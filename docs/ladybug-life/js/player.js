/* ============================================================
   player.js — the bug you are
   ============================================================
   One object carries the whole life: egg → four larval instars →
   pupa → adult → eggs, and in winter, hibernation.  On a plant it
   is (plant, segment, t) and walks the branch graph; in the air
   it is free-flying and can land on any plant in the garden.

   States: egg | larva | molting | pupa | eclosing | adult |
           flying | laying | hibernating
   ============================================================ */
'use strict';

class Bug {
  constructor(G, speciesKey, id = 1) {
    this.G = G;
    this.id = id;
    this.plant = G.garden ? G.garden.main : G.plant;
    this.species = SPECIES[speciesKey] || SPECIES.sevenspot;
    this.stage = 0;
    this.state = 'egg';
    this.seg = 0; this.t = .5; this.dir = 1;
    this.x = 0; this.y = 0; this.ang = -Math.PI / 2;
    this.walk = 0; this.chew = 0; this.chewT = 0; this.prey = null; this.preyKind = 'aphid';
    this.eaten = 0; this.total = 0;
    this.timer = 0;
    this.hatchProg = 0; this.hatchWobble = 0;
    this.route = null;
    this.fresh = 0; this.open = 0; this.wingPhase = 0;
    this.vx = 0; this.vy = 0;
    this.shove = 0; this.shoveDir = 1;
    this.twitch = 0;
    this.readyFlag = false;
    this.pupaSpot = null;
    this.moltFrom = 1; this.moltTo = 1; this.moltT0 = 0; this.moltT1 = 0;
    this.eggSpot = null;
    this.frozen = 0;           // 0..1 how tucked-in we are
    this.playingDead = false;
    this.fright = 0;
    this.spotMoment = false;
    this.flownOnce = false;
    this.input = { x: 0, y: 0, action: false, actionPressed: false, eggPressed: false };
    this.moving = false;
    this.stats = { night: 0, rain: 0, quick: [], streak: 0, bestStreak: 0, plantsLanded: new Set(), shoved: 0, frozeSafe: 0, playedDead: 0, wild: 0, scales: 0, hibernations: 0, generations: 0 };
  }

  /* ---------- helpers ---------- */
  get diff() { return DIFFICULTY[this.G.settings.difficulty] || DIFFICULTY.normal; }
  stageDef() { return STAGES[this.stage]; }
  need() { return Math.max(1, Math.round(this.stageDef().need * this.diff.mult * this.species.need)); }
  progress() { const n = this.need(); return n ? clamp(this.eaten / n, 0, 1) : 0; }
  canEat() { return (this.state === 'larva' || this.state === 'adult') && !this.readyFlag && this.frozen < .5 && !this.playingDead; }
  onBranch() { return this.state === 'larva' || this.state === 'adult' || this.state === 'molting'; }
  isLarva() { return this.stage >= 1 && this.stage <= 4; }
  scale() {
    let s;
    if (this.state === 'molting') s = lerp(STAGES[this.moltFrom].scale, STAGES[this.moltTo].scale, smoothstep(1.0, 1.9, this.timer));
    else if (this.stage === 6) s = .95;
    else s = this.stageDef().scale;
    return s * (this.stage === 6 ? this.species.size : lerp(1, this.species.size, .5));
  }
  speed() {
    let s = this.stageDef().speed * (this.G.settings.slowmo ? .6 : 1) * this.species.speed;
    if (this.state === 'adult') s *= lerp(1, .55, this.fresh);
    return s;
  }
  cameraZoom() {
    switch (this.state) {
      case 'egg': return 2.4;
      case 'pupa': case 'eclosing': return 1.9;
      case 'flying': return .9;
      case 'hibernating': return 1.6;
      case 'adult': case 'laying': return 1.3;
      default: return [2.4, 2.1, 1.85, 1.6, 1.4][this.stage] || 1.4;
    }
  }
  isSafeFromBird() {
    if (this.state === 'egg' || this.state === 'pupa' || this.state === 'eclosing' || this.state === 'hibernating' || this.state === 'molting') return true;
    if (this.state === 'flying') return false;
    if (this.stage === 6) return this.playingDead;
    return this.frozen > .6 || !!this.plant.leafSpotNear(this.x, this.y, 42);
  }

  placeEgg(spot) {
    this.eggSpot = spot;
    if (this.G.garden && spot.plant !== undefined) this.plant = this.G.garden.plantAt(spot.plant);
    this.seg = spot.seg; this.t = spot.t;
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    this.ang = Math.atan2(p.ty, p.tx);
  }

  /* ---------- per-frame ---------- */
  update(dt) {
    const inp = this.input;
    this.twitch = Math.max(0, this.twitch - dt * 4);
    this.fright = Math.max(0, this.fright - dt * 2);
    switch (this.state) {
      case 'egg': this.updateEgg(dt); break;
      case 'larva': case 'adult': this.updateOnBranch(dt); break;
      case 'molting': this.updateMolt(dt); break;
      case 'pupa': this.updatePupa(dt); break;
      case 'eclosing': this.updateEclose(dt); break;
      case 'flying': this.updateFlying(dt); break;
      case 'laying': this.updateLaying(dt); break;
      case 'hibernating': this.updateHibernating(dt); break;
    }
    inp.actionPressed = false; inp.eggPressed = false;
  }

  updateEgg(dt) {
    const inp = this.input;
    this.hatchProg = Math.max(0, this.hatchProg - dt * .06);
    this.hatchWobble = Math.max(0, this.hatchWobble - dt * 3);
    if (inp.actionPressed || Math.hypot(inp.x, inp.y) > .5 && chance(dt * 3)) {
      this.hatchProg += .26;
      this.hatchWobble = 1;
      AudioFX.hatch();
      this.G.particles.puff(this.x, this.y - 6, '#fff3b0', 4);
    }
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.hatchProg >= 1) this.hatch();
  }

  hatch() {
    this.stage = 1; this.state = 'larva'; this.eaten = 0;
    this.dir = 1;
    this.G.eggClusters.push({ plant: this.plant.id, x: this.eggSpot.x, y: this.eggSpot.y, seg: this.seg, t: this.t, hatched: 1, seed: 11, count: 12, ang: this.ang });
    this.G.particles.sparkle(this.x, this.y, 24, '#fff3b0', 20);
    this.G.particles.text(this.x, this.y - 20, 'Hatched!', '#ffe27a', 18);
    AudioFX.molt();
    Bus.emit('hatched', this);
    Bus.emit('fact', 'hatch');
    setTimeout(() => Bus.emit('fact', 'larva'), 14000);
  }

  updateOnBranch(dt) {
    const inp = this.input;
    const P = this.plant;
    this.moving = false;
    const mag = Math.hypot(inp.x, inp.y);

    /* freezing / playing dead: hold DOWN while standing still */
    const wantStill = inp.y > .6 && Math.abs(inp.x) < .4 && !this.prey && !this.route;
    if (this.stage === 6) { this.playingDead = wantStill; this.frozen = 0; }
    else { this.frozen += ((wantStill ? 1 : 0) - this.frozen) * (1 - Math.exp(-dt * 6)); this.playingDead = false; }
    if (this.playingDead && chance(dt * 3)) this.G.particles.spawn({ type: 'dot', x: this.x + rnd(-14, 14), y: this.y + rnd(-8, 8), vx: 0, vy: 8, g: 40, r: 1.6, col: '#f2d23a', life: .8 });

    if (this.shove > 0) {
      this.shove -= dt;
      this.moveAlong(this.shoveDir * 160 * dt, () => -1);
      this.walk += dt * 20;
    }
    else if (this.prey) {
      this.chewT -= dt;
      if (inp.actionPressed) { this.chewT -= .12; this.G.particles.puff(this.x, this.y, '#c9f27a', 2); }
      this.chew = .5 + .5 * Math.sin(this.chewT * 28);
      const hx = this.x + Math.cos(this.ang) * 30 * this.scale(), hy = this.y + Math.sin(this.ang) * 30 * this.scale();
      this.prey.x = lerp(this.prey.x, hx, 1 - Math.exp(-dt * 14));
      this.prey.y = lerp(this.prey.y, hy, 1 - Math.exp(-dt * 14));
      this.prey.ang = this.ang + Math.PI + Math.sin(this.chewT * 30) * .3;
      if (this.chewT <= 0) this.finishEat();
    }
    else if (!wantStill) {
      this.chew = Math.max(0, this.chew - dt * 3);
      if (mag > .15) {
        this.route = null;
        const ix = inp.x / mag, iy = inp.y / mag;
        const p = P.posOn(this.seg, this.t, false);
        const dot = ix * p.tx + iy * p.ty;
        const atNode = this.t < .005 || this.t > .995;
        let d = 0;
        if (Math.abs(dot) > .12) d = dot > 0 ? 1 : -1;
        else if (atNode) d = this.t < .5 ? -1 : 1;
        else {
          const seg = P.segs[this.seg];
          const score = (node) => { let best = -1; for (const id of P.branchesAt(node, this.seg)) { const o = P.outDir(id, node); best = Math.max(best, o[0] * ix + o[1] * iy); } return best; };
          const sa = score(seg.a), sb = score(seg.b);
          if (Math.max(sa, sb) > .3) d = sb >= sa ? 1 : -1;
        }
        if (d !== 0) {
          const choose = (node, opts) => {
            let best = -1, bd = -0.15;
            for (const id of opts) {
              const o = P.outDir(id, node);
              const dd = o[0] * ix + o[1] * iy;
              if (dd > bd) { bd = dd; best = id; }
            }
            return best;
          };
          const before = this.t, segBefore = this.seg;
          this.moveAlong(d * this.speed() * dt, choose);
          if (this.t !== before || this.seg !== segBefore) this.moving = true;
        }
      } else if (this.route) {
        this.followRoute(dt);
      }
      if (this.moving) this.walk += dt * this.speed() * .16;

      /* look for lunch */
      if (this.canEat()) {
        const reach = this.stageDef().reach * this.scale() + 10;
        const hx = this.x + Math.cos(this.ang) * 18 * this.scale(), hy = this.y + Math.sin(this.ang) * 18 * this.scale();
        const a = P.aphids.nearest(hx, hy, reach);
        if (a) this.beginChew(a, 'aphid');
        else if (this.species.special === 'cannibal' && this.stage >= 2 && P.npcs && P.npcs.nearest) {
          const w = P.npcs.nearest(hx, hy, reach + 6);
          if (w && w.instar < this.stage) this.beginChew(w, 'larva');
        } else if (this.species.special === 'scale' && P.aphids.scales.length) {
          const sc = P.aphids.nearestScale(hx, hy, reach);
          if (sc) this.beginChew(sc.sc, 'scale');
        }
      }
    }

    const p = P.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    const target = Math.atan2(p.ty * this.dir, p.tx * this.dir);
    this.ang = angleLerp(this.ang, target, 1 - Math.exp(-dt * 9));

    /* stage progression */
    if (this.state === 'larva') {
      if (!this.readyFlag && this.eaten >= this.need()) {
        if (this.stage < 4) this.startMolt();
        else { this.readyFlag = true; Bus.emit('readyPupa', this); }
      }
      if (this.readyFlag) {
        this.pupaSpot = P.leafSpotNear(this.x, this.y, 60);
        if (this.pupaSpot && inp.actionPressed) this.pupate();
      }
    } else if (this.state === 'adult') {
      const wasFresh = this.fresh;
      this.fresh = Math.max(0, this.fresh - dt / 16);
      if (wasFresh >= .55 && this.fresh < .55 && !this.spotMoment) {
        this.spotMoment = true;
        Cinematic.play({ follow: () => this, zoom: 3.2, duration: 3.2, slow: .45, title: 'The spots appear' });
      }
      if (wasFresh >= .3 && this.fresh < .3) { Bus.emit('fact', 'fly'); Bus.emit('wingsDry', this); }
      if (!this.readyFlag && this.eaten >= this.need()) { this.readyFlag = true; Bus.emit('readyEggs', this); }
      if (this.readyFlag) {
        this.pupaSpot = P.leafSpotNear(this.x, this.y, 60);
        if (this.pupaSpot && inp.eggPressed) this.layEggs();
      }
      this.open = Math.max(0, this.open - dt * 4);
      if (inp.actionPressed && !this.prey && this.fresh < .3) this.takeoff();
    }
  }

  moveAlong(distance, choose) {
    const P = this.plant;
    let remaining = Math.abs(distance), d = sign(distance), guard = 0;
    while (remaining > 0 && guard++ < 8) {
      const seg = P.segs[this.seg];
      const nt = this.t + d * remaining / seg.len;
      if (nt >= 0 && nt <= 1) { this.t = nt; remaining = 0; break; }
      const node = d > 0 ? seg.b : seg.a;
      remaining -= d > 0 ? (1 - this.t) * seg.len : this.t * seg.len;
      const opts = P.branchesAt(node, this.seg);
      const next = node === 0 ? -1 : choose(node, opts);
      if (next < 0) { this.t = d > 0 ? 1 : 0; break; }
      const ns = P.segs[next];
      this.seg = next;
      if (ns.a === node) { this.t = 0; d = 1; } else { this.t = 1; d = -1; }
    }
    this.dir = d;
  }

  goTo(segId, t, plantId) {
    if (!(this.state === 'larva' || this.state === 'adult')) return;
    if (plantId !== undefined && plantId !== this.plant.id) return;     // larvae cannot leave their plant
    const path = this.plant.route(this.seg, segId);
    if (path === null) return;
    this.route = { path, seg: segId, t };
    const q = this.plant.posOn(segId, t);
    this.G.particles.ring(q.x, q.y, 'rgba(255,255,255,.8)', 6, 60, .5);
  }

  followRoute(dt) {
    const P = this.plant, r = this.route;
    const seg = P.segs[this.seg];
    if (this.seg === r.seg) {
      const diff = (r.t - this.t) * seg.len;
      if (Math.abs(diff) < 3) { this.route = null; return; }
      const step = Math.min(Math.abs(diff), this.speed() * dt);
      this.moveAlong(sign(diff) * step, () => -1);
      this.moving = true;
      return;
    }
    while (r.path.length && r.path[0] !== seg.a && r.path[0] !== seg.b) r.path.shift();
    if (!r.path.length) { this.route = null; return; }
    const nextNode = r.path[0];
    const d = nextNode === seg.b ? 1 : -1;
    const choose = (node, opts) => {
      r.path.shift();
      const after = r.path[0];
      if (after === undefined) return opts.includes(r.seg) ? r.seg : -1;
      const s = P.segBetween(node, after);
      return opts.includes(s) ? s : -1;
    };
    this.moveAlong(d * this.speed() * dt, choose);
    this.moving = true;
  }

  beginChew(target, kind) {
    target.caught = true;
    this.prey = target; this.preyKind = kind;
    this.chewT = ([0, .7, .6, .5, .42, 0, .35][this.stage] || .5) * (kind === 'larva' ? 1.8 : kind === 'scale' ? 1.4 : 1);
    if (this.G.garden && this.G.garden.weather.raining) this.chewT *= 1.3;
    this.route = null;
    AudioFX.munch();
  }

  finishEat() {
    const a = this.prey, kind = this.preyKind; this.prey = null;
    const P = this.plant;
    let worth = 1, col = '#a6e05a';
    if (kind === 'aphid') { P.aphids.remove(a); col = { green: '#a6e05a', pink: '#f7b7c9', black: '#6b6b70', yellow: '#f2df7a' }[a.variant] || col; }
    else if (kind === 'larva') { P.npcs.remove(a); worth = 3; col = '#8a93a8'; this.stats.wild++; }
    else if (kind === 'scale') { const i = P.aphids.scales.indexOf(a); if (i >= 0) P.aphids.scales.splice(i, 1); worth = 2; col = '#c99a6a'; this.stats.scales++; }
    this.eaten += worth; this.total += worth;
    this.G.particles.splat(a.x, a.y, col, 12);
    const left = this.need() - this.eaten;
    const words = ['CHOMP!', 'YUM!', 'MUNCH!', 'CRUNCH!'];
    const str = left <= 0 ? 'FULL!' : (worth > 1 ? `+${worth}` : (this.eaten % 5 === 0 ? pick(words) : '+1'));
    this.G.particles.text(a.x, a.y - 16, str, left <= 0 ? '#ffe27a' : '#e9ffd0', left <= 0 ? 20 : 14);
    AudioFX.pop(1 + this.progress() * .5);
    const now = this.G.time;
    this.stats.quick = this.stats.quick.filter(t => now - t < 10); this.stats.quick.push(now);
    if ((this.G.night || 0) > .6) this.stats.night++;
    if (this.G.garden && this.G.garden.weather.raining) this.stats.rain++;
    Bus.emit('eat', this, kind, a);
  }

  /* ---------- molting ---------- */
  startMolt() {
    this.state = 'molting'; this.timer = 0;
    this.moltFrom = this.stage; this.moltTo = this.stage + 1;
    this.route = null;
    this.moltT0 = this.t; this.moltSeg = this.seg;
    Bus.emit('moltStart', this);
    Cinematic.play({ follow: () => this, zoom: 2.8 / Math.max(.6, STAGES[this.moltTo].scale), duration: 3.4, slow: .5, title: 'Molting' });
  }
  updateMolt(dt) {
    const wasBefore = this.timer;
    this.timer += dt;
    this.walk += dt * 3;
    if (wasBefore < 1.0 && this.timer >= 1.0) {
      /* the skin splits: leave the exuvia behind, then ease forward out of it */
      this.G.exuviae.push({ plant: this.plant.id, seg: this.seg, t: this.t, ang: this.ang, instar: this.moltFrom, s: STAGES[this.moltFrom].scale, dir: this.dir, born: this.G.time });
      this.stage = this.moltTo; this.eaten = 0;
      this.moltT0 = this.t;
      this.moveAlong(this.dir * 26 * STAGES[this.stage].scale, () => -1);
      this.moltT1 = this.t; this.t = this.moltT0;
      this.G.particles.sparkle(this.x, this.y, 36, '#fff6c8', 30);
      AudioFX.molt();
    }
    if (this.timer >= 1.0 && this.timer < 2.2 && this.seg === this.moltSeg) {
      this.t = lerp(this.moltT0, this.moltT1, easeOutCubic(smoothstep(1.0, 2.2, this.timer)));
    }
    if (wasBefore < 2.2 && this.timer >= 2.2) {
      this.G.particles.text(this.x, this.y - 26, `${['', '1st', '2nd', '3rd', '4th'][this.stage]} instar!`, '#ffe27a', 18);
      Bus.emit('fact', ['', '', 'molt1', 'molt2', 'molt3'][this.stage]);
    }
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.timer >= 2.8) { this.state = 'larva'; Bus.emit('molted', this); }
  }

  /* ---------- pupa ---------- */
  pupate() {
    this.state = 'pupa'; this.stage = 5; this.timer = 0; this.readyFlag = false;
    this.route = null;
    this.G.exuviae.push({ plant: this.plant.id, seg: this.seg, t: this.t, ang: this.ang, instar: 4, s: STAGES[4].scale * .9, dir: this.dir, alpha: .5, born: this.G.time });
    this.G.particles.sparkle(this.x, this.y, 30, '#ffd9a0', 30);
    AudioFX.pupate();
    Bus.emit('pupated', this);
    Bus.emit('fact', 'pupate');
  }
  pupaProgress() { return clamp(this.timer / this.diff.pupaTime, 0, 1); }
  updatePupa(dt) {
    this.timer += dt;
    if (this.input.actionPressed) {
      this.twitch = 1; this.timer += .7;
      AudioFX.twitch();
      this.G.particles.puff(this.x, this.y, '#ffd9a0', 3);
    }
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.timer >= this.diff.pupaTime) this.eclose();
  }
  /* the pupa splits and the ladybug starts to come out */
  eclose() {
    this.state = 'eclosing'; this.timer = 0;
    AudioFX.fanfare();
    this.G.particles.sparkle(this.x, this.y, 50, '#fff6c8', 40);
    this.G.particles.confetti(this.x, this.y - 10, 50);
    Cinematic.play({ follow: () => this, zoom: 2.6, duration: 4.2, slow: .5, title: 'A ladybug is born' });
  }
  updateEclose(dt) {
    this.timer += dt;
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.timer >= 3.6) {
      this.state = 'adult'; this.stage = 6; this.eaten = 0; this.fresh = 1; this.readyFlag = false; this.spotMoment = false;
      this.moveAlong(this.dir * 24, () => -1);
      Bus.emit('eclosed', this);
      Bus.emit('fact', 'eclose');
    }
  }

  /* ---------- flight ---------- */
  takeoff() {
    this.state = 'flying'; this.route = null; this.playingDead = false;
    this.vx = Math.cos(this.ang) * 60; this.vy = Math.sin(this.ang) * 60 - 90;
    AudioFX.takeoff();
    this.G.particles.puff(this.x, this.y, '#ffffff', 6);
    if (!this.flownOnce) { this.flownOnce = true; Cinematic.play({ follow: () => this, zoom: 1.6, duration: 2.8, slow: .4, title: 'First flight' }); }
    Bus.emit('takeoff', this);
  }
  updateFlying(dt) {
    const inp = this.input;
    const G = this.G;
    this.open = Math.min(1, this.open + dt * 5);
    this.wingPhase += dt * 55;
    const acc = 520 * this.species.speed, drag = 2.2;
    this.vx += inp.x * acc * dt; this.vy += inp.y * acc * dt;
    this.vy += 40 * dt;
    const gust = G.garden ? G.garden.weather.gust : 0;
    this.vx += gust * 120 * dt;
    const k = Math.exp(-drag * dt);
    this.vx *= k; this.vy *= k;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const b = G.garden ? G.garden.bounds : this.plant.bounds;
    if (this.x < b.left) { this.x = b.left; this.vx = Math.abs(this.vx) * .4; }
    if (this.x > b.right) { this.x = b.right; this.vx = -Math.abs(this.vx) * .4; }
    if (this.y > -30) { this.y = -30; this.vy = -Math.abs(this.vy) * .3; }
    if (this.y < b.top - 250) { this.y = b.top - 250; this.vy = Math.abs(this.vy) * .3; }
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > 20) this.ang = angleLerp(this.ang, Math.atan2(this.vy, this.vx), 1 - Math.exp(-dt * 5));
    this.walk += dt * 6;
    /* land on any plant */
    this.landSpot = G.garden ? G.garden.nearest(this.x, this.y, 70) : this.plant.nearest(this.x, this.y, 70);
    /* or the warm crack in the wall, in winter */
    this.crackNear = false;
    if (G.garden && G.garden.season === 'winter') {
      const c = G.garden.wall.crack;
      if (dist(this.x, this.y, c.x, c.y) < 90) this.crackNear = true;
    }
    if (inp.actionPressed) {
      if (this.crackNear) this.hibernate();
      else if (this.landSpot) this.land(this.landSpot);
      else Bus.emit('hint', 'landHint');
    }
  }
  land(spot) {
    if (this.G.garden && spot.plant !== undefined) this.plant = this.G.garden.plantAt(spot.plant);
    this.seg = spot.seg; this.t = clamp(spot.t, .01, .99);
    this.state = 'adult';
    const p = this.plant.posOn(this.seg, this.t, false);
    this.dir = (this.vx * p.tx + this.vy * p.ty) >= 0 ? 1 : -1;
    this.vx = this.vy = 0;
    this.stats.plantsLanded.add(this.plant.id);
    AudioFX.land();
    this.G.particles.puff(this.x, this.y, '#ffffff', 5);
    Bus.emit('landed', this);
  }

  /* ---------- eggs ---------- */
  layEggs() {
    this.state = 'laying'; this.timer = 0; this.route = null;
    Bus.emit('layingStart', this);
  }
  updateLaying(dt) {
    this.timer += dt;
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    this.walk += dt * 2;
    if (this.timer >= 3) {
      const spot = this.pupaSpot;
      const cluster = { plant: this.plant.id, x: spot.x, y: spot.y, seg: spot.seg, t: spot.t, hatched: 0, seed: rndInt(1, 999), count: rndInt(10, 16), ang: this.ang, fresh: 1 };
      this.G.eggClusters.push(cluster);
      this.G.particles.confetti(this.x, this.y, 80);
      this.G.particles.text(this.x, this.y - 30, 'Eggs laid!', '#ffe27a', 22);
      AudioFX.eggs();
      this.state = 'adult'; this.eaten = 0; this.readyFlag = false;
      this.stats.generations++;
      this.moveAlong(this.dir * 40, () => -1);
      Cinematic.play({ x: spot.x, y: spot.y, zoom: 2.6, duration: 3, slow: .5, title: 'The next generation' });
      Bus.emit('eggsLaid', cluster, this);
      Bus.emit('fact', 'eggs');
    }
  }

  /* ---------- winter ---------- */
  hibernate() {
    const c = this.G.garden.wall.crack;
    this.state = 'hibernating'; this.timer = 0;
    this.x = c.x - 18; this.y = c.y; this.vx = this.vy = 0;
    this.ang = Math.PI; this.open = 0;
    this.stats.hibernations++;
    Cinematic.play({ x: c.x, y: c.y, zoom: 1.8, duration: 5, slow: .6, title: 'Sleeping until spring' });
    Bus.emit('hibernate', this);
    Bus.emit('fact', 'hibernate');
  }
  updateHibernating(dt) {
    this.timer += dt;
    /* main.js races the calendar to spring and then calls wake() */
  }
  wake() {
    this.state = 'flying';
    this.vx = -120; this.vy = -60; this.open = 1;
    this.eaten = 0; this.readyFlag = false;
    Bus.emit('wake', this);
    Bus.emit('fact', 'spring');
  }

  /* ---------- knocks and frights ---------- */
  shoved(ant) {
    const p = this.plant.posOn(this.seg, this.t, false);
    const away = ((this.x - ant.x) * p.tx + (this.y - ant.y) * p.ty) >= 0 ? 1 : -1;
    this.shove = .45;
    this.shoveDir = away;
    if (this.prey) { this.prey.caught = false; this.prey = null; }
    this.route = null;
    this.stats.shoved++;
    Bus.emit('shoved', this);
    this.G.cam.shake = 1;
    this.G.particles.text(this.x, this.y - 20, 'Shoved!', '#ffb3a7', 16);
    AudioFX.bump();
  }
  frightened(side) {
    this.fright = 1;
    this.G.cam.shake = 1.2;
    this.G.particles.text(this.x, this.y - 26, 'EEK!', '#ffb3a7', 20);
    AudioFX.bump();
    if (this.state === 'flying') { this.vx += side * 300; this.vy += 200; return; }
    if (this.prey) { this.prey.caught = false; this.prey = null; }
    this.route = null;
    this.shove = .5; this.shoveDir = this.dir * -1;
  }

  /* ---------- drawing ---------- */
  draw(ctx, time) {
    const s = this.scale();
    ctx.save();
    ctx.translate(this.x, this.y);
    switch (this.state) {
      case 'egg': {
        ctx.rotate(this.ang);
        const wob = Math.sin(time * 40) * this.hatchWobble * .15;
        ctx.rotate(wob);
        const k = 1 + this.hatchProg * .12 + this.hatchWobble * .06;
        ctx.scale(k, k);
        Sprites.drawEggCluster(ctx, { s: 1, count: 12, seed: 11, hatched: 0 });
        ctx.globalAlpha = .25 + .15 * Math.sin(time * 4);
        ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(time * 4) * 2, 0, TAU); ctx.stroke();
        break;
      }
      case 'larva': {
        ctx.rotate(this.ang);
        this.drawShadow(ctx, 30 * s, 10 * s);
        ctx.scale(1, 1 - this.frozen * .12);
        Sprites.drawLarva(ctx, { s, instar: this.stage, walk: this.frozen > .5 ? 0 : this.walk, chew: this.chew });
        break;
      }
      case 'molting': {
        ctx.rotate(this.ang);
        const k = this.timer;
        const pale = k < 1.0 ? smoothstep(0, 1.0, k) * .85 : (k < 1.6 ? .85 : .85 * (1 - smoothstep(1.6, 2.6, k)));
        const shiver = Math.sin(time * 50) * .03 * (k < 1.0 ? 1 : 0);
        ctx.rotate(shiver);
        this.drawShadow(ctx, 30 * s, 10 * s);
        Sprites.drawLarva(ctx, { s, instar: this.stage, walk: this.walk, chew: 0, pale });
        if (k > .85 && k < 1.3) {
          ctx.globalAlpha = 1 - Math.abs((k - 1.05) / .25);
          ctx.fillStyle = '#fff6c8';
          ctx.beginPath(); ctx.arc(0, 0, 40 * s, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'pupa': {
        ctx.rotate(this.ang);
        ctx.translate(-16, 0);
        this.drawShadow(ctx, 26, 12, 22);
        Sprites.drawPupa(ctx, { s: 1, prog: this.pupaProgress(), twitch: Math.sin(time * 60) * this.twitch });
        break;
      }
      case 'eclosing': {
        ctx.rotate(this.ang);
        const k = this.timer / 3.6;
        ctx.save();
        ctx.translate(-16, 0);
        ctx.globalAlpha = 1 - smoothstep(.4, 1, k);
        const split = smoothstep(.1, .6, k) * 10;
        ctx.save(); ctx.translate(0, -split); Sprites.drawPupa(ctx, { s: 1, prog: 1 }); ctx.restore();
        ctx.restore();
        const grow = smoothstep(.15, .9, k);
        ctx.translate(grow * 14, 0);
        const gs = lerp(.55, .95 * this.species.size, easeOutBack(grow));
        ctx.scale(gs, gs);
        Sprites.drawAdult(ctx, { s: 1, species: this.species, open: 0, walk: this.walk, fresh: 1, alpha: smoothstep(0, .35, k) });
        break;
      }
      case 'adult': case 'laying': {
        ctx.rotate(this.ang);
        this.drawShadow(ctx, 36 * s, 26 * s, -4);
        const lay = this.state === 'laying' ? Math.sin(this.timer * 12) * .04 : 0;
        ctx.rotate(lay);
        if (this.playingDead) ctx.scale(1, .92);
        Sprites.drawAdult(ctx, { s, species: this.species, open: this.open, wingPhase: this.wingPhase, walk: this.playingDead ? 0 : this.walk, fresh: this.fresh, tucked: this.playingDead });
        break;
      }
      case 'flying': {
        ctx.save();
        ctx.translate(14, 40);
        ctx.globalAlpha = .18;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 14, 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.rotate(this.ang + Math.sin(time * 30) * this.fright * .3);
        const bob = Math.sin(this.wingPhase * .15) * 1.5;
        ctx.translate(0, bob);
        Sprites.drawAdult(ctx, { s, species: this.species, open: this.open, wingPhase: this.wingPhase, walk: this.walk * .2, fresh: this.fresh });
        break;
      }
      case 'hibernating': {
        ctx.rotate(this.ang);
        ctx.scale(1, .9);
        Sprites.drawAdult(ctx, { s, species: this.species, open: 0, walk: 0, fresh: 0, tucked: true });
        ctx.rotate(-this.ang);
        const z = (time * .7) % 1;
        ctx.globalAlpha = 1 - z;
        ctx.font = `900 ${10 + z * 8}px ${UI_FONT}`; ctx.fillStyle = '#e8f0ff'; ctx.textAlign = 'center';
        ctx.fillText('z', 10 + z * 14, -20 - z * 30);
        break;
      }
    }
    ctx.restore();
  }

  drawShadow(ctx, rx, ry, ox = 0) {
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.fillStyle = '#0a1a08';
    ctx.beginPath(); ctx.ellipse(ox, 4, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- save / restore ---------- */
  serialize() {
    const o = {};
    for (const k of ['id', 'stage', 'state', 'seg', 't', 'dir', 'x', 'y', 'ang', 'eaten', 'total', 'timer', 'hatchProg', 'fresh', 'open', 'vx', 'vy', 'readyFlag', 'moltFrom', 'moltTo', 'spotMoment', 'flownOnce']) o[k] = this[k];
    o.species = this.species.key; o.plant = this.plant.id; o.eggSpot = this.eggSpot;
    o.stats = Object.assign({}, this.stats, { plantsLanded: [...this.stats.plantsLanded], quick: [] });
    if (o.state === 'molting') o.state = 'larva';
    if (o.state === 'eclosing') { o.state = 'adult'; o.stage = 6; o.fresh = 1; }
    if (o.state === 'laying') o.state = 'adult';
    return o;
  }
  restore(o) {
    for (const k in o) if (k !== 'species' && k !== 'plant' && k !== 'stats') this[k] = o[k];
    this.species = SPECIES[o.species] || this.species;
    if (this.G.garden) this.plant = this.G.garden.plantAt(o.plant || 0);
    if (o.stats) { this.stats = Object.assign(this.stats, o.stats); this.stats.plantsLanded = new Set(o.stats.plantsLanded || []); this.stats.quick = []; }
    this.prey = null; this.route = null;
  }
}
