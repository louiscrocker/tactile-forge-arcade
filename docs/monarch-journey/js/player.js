/* ============================================================
   player.js — the monarch you are
   ============================================================
   One object carries the whole life: egg → five instars → the J
   → chrysalis → butterfly → the flight south → the forest.

   On the milkweed it is (segment, t) and walks the branch graph.
   In the air it is free-flying.  On the route it is a point in a
   very wide world with wind.

   States: egg | larva | molting | jhang | pupating | chrysalis |
           eclosing | drying | adult | flying | sipping |
           migrating | nectaring | roosting | resting | arrived |
           winterFly
   ============================================================ */
'use strict';

class Monarch {
  constructor(G, variantKey, id = 1) {
    this.G = G;
    this.id = id;
    this.plant = G.plant;
    this.summer = false;           // a short-lived summer generation (not the super generation)
    this.tag = false; this.tagInfo = null; this.tagging = 0;
    this.silkY = 0; this.eggsLaid = 0; this.mateNear = false; this.podNear = null; this.eggSpotNear = null;
    this.spat = 0; this.waitDays = 0; this.decided = false; this.blownBack = false; this.winterNap = false;
    this.variant = VARIANTS[variantKey] || VARIANTS.male;
    this.stage = 0;
    this.state = 'egg';
    this.seg = 0; this.t = .5; this.dir = 1;
    this.x = 0; this.y = 0; this.ang = -Math.PI / 2;
    this.walk = 0; this.chew = 0; this.biteCool = 0;
    this.eaten = 0; this.total = 0;
    this.timer = 0;
    this.hatchProg = 0; this.hatchWobble = 0;
    this.route = null;
    this.fresh = 0; this.open = 0; this.flap = 1; this.wingPhase = 0; this.crumple = 0;
    this.vx = 0; this.vy = 0;
    this.shove = 0; this.shoveDir = 1;
    this.twitch = 0;
    this.readyFlag = false;
    this.hangSpot = null; this.landSpot = null; this.eggSpot = null;
    this.moltFrom = 1; this.moltTo = 1; this.moltT0 = 0; this.moltT1 = 0; this.moltSeg = 0;
    this.frozen = 0;
    this.fright = 0;
    this.flownOnce = false; this.clearFact = false;
    this.curl = 0;
    /* migration */
    this.energy = 1; this.fat = 0; this.flapping = false; this.glideT = 0;
    this.landing = null; this.roostTree = null; this.patch = null;
    this.sipClock = 0; this.restT = 0; this.tag = false;
    this.input = { x: 0, y: 0, action: false, actionPressed: false };
    this.moving = false;
    this.stats = { bites: 0, molts: 0, sips: 0, nectarStops: 0, storms: 0, roosts: 0, thermals: 0, exhausted: 0, shoved: 0, frozeSafe: 0, days: 0, miles: 0, generations: 0 };
  }

  /* ---------- helpers ---------- */
  get diff() { return DIFFICULTY[this.G.settings.difficulty] || DIFFICULTY.normal; }
  stageDef() { return STAGES[this.stage]; }
  need() { return Math.max(1, Math.round(this.stageDef().need * this.diff.mult * this.variant.need)); }
  progress() { const n = this.need(); return n ? clamp(this.eaten / n, 0, 1) : 0; }
  isLarva() { return this.stage >= 1 && this.stage <= 5; }
  onPlant() { return this.state === 'larva' || this.state === 'adult' || this.state === 'molting'; }
  onRoute() { return ['migrating', 'nectaring', 'roosting', 'resting', 'arrived', 'winterFly'].includes(this.state); }
  scale() {
    let s;
    if (this.state === 'molting') s = lerp(STAGES[this.moltFrom].scale, STAGES[this.moltTo].scale, smoothstep(1.0, 1.9, this.timer));
    else if (this.stage === 7) s = 1;
    else s = this.stageDef().scale;
    return s;
  }
  speed() {
    let s = this.stageDef().speed * (this.G.settings.slowmo ? .6 : 1);
    if (this.state === 'adult') s *= lerp(1, .6, this.fresh);
    return s;
  }
  cameraZoom() {
    switch (this.state) {
      case 'egg': return 3.2;
      case 'jhang': case 'pupating': case 'chrysalis': case 'eclosing': case 'drying': return 2.2;
      case 'flying': return .95;
      case 'migrating': case 'winterFly': return .85;
      case 'nectaring': case 'resting': return 1.5;
      case 'roosting': return 1.1;
      case 'arrived': return .8;
      case 'adult': case 'sipping': return 1.3;
      default: return [3.2, 3.0, 2.6, 2.2, 1.9, 1.6][this.stage] || 1.6;
    }
  }
  isSafeFromWasp() {
    if (!this.onPlant() || this.state === 'molting') return true;
    if (this.frozen > .6) { this.stats.frozeSafe++; return true; }
    const seg = this.plant.segs[this.seg];
    return seg.kind === 'leaf' && this.t > .3 && !this.moving;
  }
  onLeaf() { const seg = this.plant.segs[this.seg]; return seg.kind === 'leaf' ? this.plant.leaves[seg.leaf] : null; }

  placeEgg(spot) {
    this.eggSpot = spot;
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
    this.biteCool = Math.max(0, this.biteCool - dt);
    switch (this.state) {
      case 'egg': this.updateEgg(dt); break;
      case 'larva': case 'adult': this.updateOnPlant(dt); break;
      case 'molting': this.updateMolt(dt); break;
      case 'jhang': this.updateJ(dt); break;
      case 'pupating': this.updatePupating(dt); break;
      case 'chrysalis': this.updateChrysalis(dt); break;
      case 'eclosing': this.updateEclose(dt); break;
      case 'drying': this.updateDrying(dt); break;
      case 'flying': this.updateFlying(dt); break;
      case 'sipping': this.updateSipping(dt); break;
      case 'migrating': case 'winterFly': this.updateMigrating(dt); break;
      case 'nectaring': this.updateNectaring(dt); break;
      case 'roosting': this.updateRoosting(dt); break;
      case 'resting': this.updateResting(dt); break;
      case 'arrived': this.updateArrived(dt); break;
      case 'silk': this.updateSilk(dt); break;
      case 'laying': this.updateLaying(dt); break;
      case 'courting': this.updateCourting(dt); break;
      case 'tagging': this.updateTagging(dt); break;
    }
    inp.actionPressed = false;
  }
  onRoute() { return ['migrating', 'nectaring', 'roosting', 'resting', 'arrived', 'winterFly', 'tagging'].includes(this.state); }

  /* ---------- egg ---------- */
  updateEgg(dt) {
    const inp = this.input;
    this.hatchProg = Math.max(0, this.hatchProg - dt * .06);
    this.hatchWobble = Math.max(0, this.hatchWobble - dt * 3);
    if (inp.actionPressed || Math.hypot(inp.x, inp.y) > .5 && chance(dt * 3)) {
      this.hatchProg += .22;
      this.hatchWobble = 1;
      AudioFX.hatch();
      this.G.particles.puff(this.x, this.y, '#fff3b0', 3);
    }
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.hatchProg >= 1) this.hatch();
  }
  hatch() {
    this.stage = 1; this.state = 'larva'; this.eaten = 0;
    this.dir = -1;                                  // face back toward the stem
    this.G.eggShells.push({ seg: this.seg, t: this.t, born: this.G.time });
    this.G.particles.sparkle(this.x, this.y, 20, '#fff3b0', 16);
    this.G.particles.text(this.x, this.y - 16, 'Hatched!', '#ffe27a', 16);
    AudioFX.molt();
    Bus.emit('hatched', this);
    Bus.emit('fact', 'hatch');
    setTimeout(() => Bus.emit('fact', 'milkweed'), 16000);
  }

  /* ---------- on the plant ---------- */
  updateOnPlant(dt) {
    const inp = this.input;
    const P = this.plant;
    this.moving = false;
    const mag = Math.hypot(inp.x, inp.y);

    /* freezing: hold DOWN while standing still */
    const wantStill = inp.y > .6 && Math.abs(inp.x) < .4 && !this.route && this.state === 'larva';
    this.frozen += ((wantStill ? 1 : 0) - this.frozen) * (1 - Math.exp(-dt * 6));

    if (this.shove > 0) {
      this.shove -= dt;
      this.moveAlong(this.shoveDir * 160 * dt, () => -1);
      this.walk += dt * 20;
    } else if (!wantStill) {
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

      /* eating: a caterpillar bites the leaf it stands on */
      if (this.state === 'larva' && !this.readyFlag && (inp.action || inp.actionPressed) && this.biteCool <= 0) {
        const leaf = this.onLeaf();
        if (leaf) {
          const side = (this.stats.bites % 2 === 0) ? 1 : -1;
          let b = P.bite(leaf, this.t, side, this.scale() * .9) || P.bite(leaf, this.t, -side, this.scale() * .9);
          if (!b && !leaf.skeleton) {
            /* this bit is eaten: shuffle along the leaf to the next mouthful */
            const seg = P.segs[this.seg];
            const step = 26 / seg.len;
            if (this.t < .92) { this.t = Math.min(.95, this.t + step); this.dir = 1; }
            else { this.t = leaf.petiole + .12; this.dir = 1; }
            this.walk += 4; this.biteCool = .22; this.moving = true;
          }
          if (b) {
            b.fresh = 1.4;
            this.biteCool = .38 / Math.max(.6, this.scale());
            this.chew = 1;
            this.eaten++; this.total++; this.stats.bites++;
            const p = P.posOn(this.seg, this.t);
            this.G.particles.splat(p.x, p.y, '#a6e05a', 6);
            this.G.particles.sap(p.x, p.y, 2);
            const left = this.need() - this.eaten;
            const words = ['CHOMP!', 'MUNCH!', 'CRUNCH!', 'NOM!'];
            if (left <= 0 || this.eaten % 4 === 0) this.G.particles.text(p.x, p.y - 14, left <= 0 ? 'FULL!' : pick(words), left <= 0 ? '#ffe27a' : '#e9ffd0', left <= 0 ? 18 : 13);
            AudioFX.munch();
            if (this.stats.bites === 3) Bus.emit('fact', 'trench');
            Bus.emit('eat', this);
          } else if (leaf.skeleton) { Bus.emit('hint', 'crawl'); this.biteCool = .5; }
        } else { this.biteCool = .4; if (inp.actionPressed) Bus.emit('hint', 'crawl'); }
      }
    }
    for (const lf of P.leaves) for (const b of lf.bites) if (b.fresh > 0) b.fresh -= dt;

    const p = P.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    const target = Math.atan2(p.ty * this.dir, p.tx * this.dir);
    this.ang = angleLerp(this.ang, target, 1 - Math.exp(-dt * 9));

    /* stage progression */
    if (this.state === 'larva') {
      if (!this.readyFlag && this.eaten >= this.need()) {
        if (this.stage < 5) this.startMolt();
        else { this.readyFlag = true; Bus.emit('readyHang', this); }
      }
      if (this.readyFlag) {
        this.hangSpot = P.hangSpotNear(this.x, this.y, 55);
        if (this.hangSpot && inp.actionPressed) this.beginJ();
      }
    } else if (this.state === 'adult') {
      this.fresh = Math.max(0, this.fresh - dt / 12);
      /* basking: open the wings slowly when standing still in the sun */
      const bask = !this.moving && (this.G.night || 0) < .5 ? .5 + .5 * Math.sin(this.G.time * .5) : 0;
      this.open += (bask * .35 - this.open) * (1 - Math.exp(-dt * 2));
      if (!this.readyFlag && this.eaten >= this.need()) { this.readyFlag = true; Bus.emit(this.summer ? 'readyMate' : 'readyGo', this); }
      const f = P.flowerNear(this.x, this.y, 60);
      this.flowerNear = f && f.nectar > .3 ? f : null;
      this.podNear = P.podNear(this.x, this.y, 70);
      this.eggSpotNear = (this.summer && this.readyFlag && this.variant.key === 'female') ? P.spotNear(P.eggSpots.filter(es => !this.G.eggs.some(e => e.seg === es.seg)), this.x, this.y, 55) : null;
      if (inp.actionPressed) {
        if (this.podNear) this.burstPod(this.podNear);
        else if (this.eggSpotNear) this.layEgg(this.eggSpotNear);
        else if (this.flowerNear && !this.readyFlag) this.beginSip(this.flowerNear);
        else if (this.summer && this.readyFlag && this.variant.key !== 'female' && this.mateNear) this.court();
        else this.takeoff();
      }
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

  goTo(segId, t) {
    if (!(this.state === 'larva' || this.state === 'adult')) return;
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

  /* ---------- the silk lifeline ---------- */
  dropOnSilk(fromX, fromY) {
    if (this.state !== 'larva') return;
    this.state = 'silk'; this.timer = 0; this.silkY = 0; this.route = null;
    this.silkFrom = [fromX === undefined ? this.x - 10 : fromX, fromY === undefined ? this.y : fromY];
    this.silkX = this.x; this.silkBaseY = this.y;
    this.G.particles.text(this.x, this.y - 20, 'EEK!', '#ffb3a7', 18);
    this.G.cam.shake = .8;
    AudioFX.silk();
    Bus.emit('hint', 'fell');
    Bus.emit('fact', 'silk');
  }
  updateSilk(dt) {
    this.timer += dt;
    const drop = 90 * this.scale() + 40;
    if (this.timer < .5) this.silkY = easeOutCubic(this.timer / .5) * drop;
    else if (this.timer < 3) this.silkY = drop + Math.sin(this.timer * 6) * 3;
    else this.silkY = drop * (1 - smoothstep(3, 4.4, this.timer));
    const q = this.plant.posOn(this.seg, this.t);
    this.x = q.x; this.y = q.y + this.silkY;
    if (this.timer >= 4.4) {
      /* back on the leaf: scuttle away from whatever it was */
      this.state = 'larva'; this.silkY = 0;
      const q2 = this.plant.posOn(this.seg, this.t, false);
      const away = ((this.x - this.silkFrom[0]) * q2.tx + (this.y - this.silkFrom[1]) * q2.ty) >= 0 ? 1 : -1;
      this.shove = .7; this.shoveDir = away;
      Bus.emit('hint', 'crawl');
    }
  }

  /* ---------- seed pods ---------- */
  burstPod(pod) {
    pod.burst = 1;
    const x = pod.x + this.plant.sway(pod.x, pod.y) + pod.side * pod.size * .5, y = pod.y - 6;
    for (let i = 0; i < pod.seeds * 3; i++) this.G.particles.spawn({ type: 'seed', x, y, vx: rnd(-40, 90), vy: rnd(-60, -10), g: 12, rot: rnd(TAU), vr: rnd(-2, 2), life: rnd(3, 6), ph: rnd(TAU) });
    Journal.addSeeds(pod.seeds);
    this.G.particles.text(x, y - 30, `+${pod.seeds} seeds!`, '#ffe27a', 18);
    AudioFX.pop && AudioFX.pop(); AudioFX.silk();
    Journal.add('milestones', 'pod');
    Bus.emit('podBurst', pod);
    Bus.emit('fact', 'pod');
  }

  /* ---------- a summer life: eggs, or a mate ---------- */
  layEgg(spot) {
    this.state = 'laying'; this.timer = 0; this.route = null; this.laySpot = spot;
    this.seg = spot.seg; this.t = spot.t;
    Bus.emit('layingStart', this);
  }
  updateLaying(dt) {
    this.timer += dt;
    const q = this.plant.posOn(this.seg, this.t);
    this.x = q.x; this.y = q.y;
    this.open = .1 + .1 * Math.sin(this.timer * 8);
    if (this.timer >= 2.2) {
      this.G.eggs.push({ seg: this.laySpot.seg, t: this.laySpot.t, born: this.G.time });
      this.eggsLaid++;
      this.G.particles.sparkle(this.x, this.y + 6, 14, '#fff3b0', 14);
      this.G.particles.text(this.x, this.y - 24, `Egg ${this.eggsLaid}!`, '#ffe27a', 16);
      AudioFX.sip();
      this.state = 'adult';
      Journal.add('milestones', 'eggs');
      Bus.emit('eggLaid', this);
      if (this.eggsLaid === 1) Bus.emit('fact', 'eggs');
      if (this.eggsLaid >= 3) Bus.emit('eggsDone', this);
    }
  }
  court() {
    this.state = 'courting'; this.timer = 0; this.vx = this.vy = 0; this.route = null;
    Cinematic.play({ follow: () => this, zoom: 1.8, duration: 3.2, slow: .5, title: 'A mate' });
    AudioFX.silk();
    Bus.emit('courting', this);
  }
  updateCourting(dt) {
    this.timer += dt;
    this.open = 1; this.wingPhase += dt * 20; this.flap = .5 + .5 * Math.abs(Math.cos(this.wingPhase * .5));
    const a = this.timer * 4;
    this.x += Math.cos(a) * 60 * dt; this.y += Math.sin(a) * 40 * dt - 10 * dt;
    this.ang = a + Math.PI / 2;
    if (this.timer >= 3.2) {
      this.state = 'flying'; this.vx = 40; this.vy = -40;
      Journal.add('milestones', 'mate');
      Bus.emit('mated', this);
      Bus.emit('fact', 'mate');
    }
  }

  /* ---------- the tagging volunteer ---------- */
  beginTagging() {
    this.state = 'tagging'; this.timer = 0; this.open = 0;
    Bus.emit('hint', 'tagged');
    Cinematic.play({ follow: () => ({ x: this.x + 40, y: this.y - 40 }), zoom: 1.7, duration: 4.5, slow: .6, title: 'Tagged!' });
    Bus.emit('taggingStart', this);
  }
  updateTagging(dt) {
    this.timer += dt;
    this.open += ((.2 + .2 * Math.sin(this.timer * 1.1)) - this.open) * dt * 2;
    if (this.timer >= 2.4 && !this.tag) {
      this.tag = true;
      const z = this.routeRef.zone(this.x);
      this.tagInfo = Journal.newTag(z.place, RELAY[this.G.relay || 0].place, this.G.day, Math.round(this.routeRef.miles(this.x)), this.G.generation);
      this.G.particles.sparkle(this.x, this.y, 20, '#fff', 20);
      this.G.particles.text(this.x, this.y - 30, this.tagInfo.code, '#ffe27a', 20);
      AudioFX.molt();
      Journal.add('milestones', 'tagged');
      Bus.emit('tagged', this.tagInfo);
    }
    if (this.timer >= 4.6) { this.state = 'nectaring'; this.timer = 0; Bus.emit('fact', 'tagged'); }
  }

  /* ---------- a bird had a go ---------- */
  spatOut(side) {
    this.spat = 1.5; this.fright = 1;
    this.energy = Math.max(0, this.energy - .06);
    this.vx += side * 220; this.vy += 160;
    this.G.cam.shake = 1.2;
    this.G.particles.text(this.x, this.y - 30, 'Yuck! Spat out!', '#c9ffb0', 18);
    this.G.particles.puff(this.x, this.y, '#ffffff', 8);
    AudioFX.bump();
    Bus.emit('hint', 'spat');
    Bus.emit('fact', 'toxic2');
  }

  /* ---------- molting ---------- */
  startMolt() {
    this.state = 'molting'; this.timer = 0;
    this.moltFrom = this.stage; this.moltTo = this.stage + 1;
    this.route = null;
    this.moltT0 = this.t; this.moltSeg = this.seg;
    Bus.emit('moltStart', this);
    Cinematic.play({ follow: () => this, zoom: 3.2 / Math.max(.6, STAGES[this.moltTo].scale), duration: 3.4, slow: .5, title: 'Molting' });
  }
  updateMolt(dt) {
    const wasBefore = this.timer;
    this.timer += dt;
    this.walk += dt * 3;
    if (wasBefore < 1.0 && this.timer >= 1.0) {
      this.G.exuviae.push({ seg: this.seg, t: this.t, ang: this.ang, instar: this.moltFrom, s: STAGES[this.moltFrom].scale, dir: this.dir, born: this.G.time });
      this.stage = this.moltTo; this.eaten = 0; this.stats.molts++;
      this.moltT0 = this.t;
      this.moveAlong(this.dir * 22 * STAGES[this.stage].scale, () => -1);
      this.moltT1 = this.t; this.t = this.moltT0;
      this.G.particles.sparkle(this.x, this.y, 30, '#fff6c8', 26);
      AudioFX.molt();
    }
    if (this.timer >= 1.0 && this.timer < 2.2 && this.seg === this.moltSeg) {
      this.t = lerp(this.moltT0, this.moltT1, easeOutCubic(smoothstep(1.0, 2.2, this.timer)));
    }
    if (wasBefore < 2.2 && this.timer >= 2.2) {
      this.G.particles.text(this.x, this.y - 22, `${['', '1st', '2nd', '3rd', '4th', '5th'][this.stage]} instar!`, '#ffe27a', 16);
      Bus.emit('fact', ['', '', 'molt1', 'molt2', 'molt3', 'molt4'][this.stage]);
      /* the old skin gets eaten: it fades out */
      const ex = this.G.exuviae[this.G.exuviae.length - 1]; if (ex) ex.eatenAt = this.G.time + 6;
    }
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.timer >= 2.8) { this.state = 'larva'; Bus.emit('molted', this); }
  }

  /* ---------- the J and the chrysalis ---------- */
  beginJ() {
    const sp = this.hangSpot;
    this.state = 'jhang'; this.timer = 0; this.readyFlag = false; this.route = null;
    this.seg = sp.seg; this.t = sp.t; this.curl = 0;
    const p = this.plant.posOn(this.seg, this.t, false);
    this.hangAng = Math.atan2(p.ty, p.tx);
    this.G.particles.sparkle(this.x, this.y, 16, '#fff6c8', 20);
    AudioFX.silk();
    Bus.emit('jhang', this);
    Bus.emit('fact', 'jhang');
    Cinematic.play({ follow: () => this, zoom: 2.6, duration: 3.5, slow: .55, title: 'The J' });
  }
  jTime() { return 9; }
  updateJ(dt) {
    this.timer += dt;
    if (this.input.actionPressed) { this.twitch = 1; this.timer += .6; AudioFX.twitch(); }
    this.curl = lerp(0, 2.3, smoothstep(0, 2.5, this.timer));
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.timer >= this.jTime()) {
      this.state = 'pupating'; this.timer = 0;
      AudioFX.pupate();
      Bus.emit('pupating', this);
      Cinematic.play({ follow: () => this, zoom: 2.8, duration: 4.2, slow: .5, title: 'The skin comes off' });
    }
  }
  updatePupating(dt) {
    this.timer += dt;
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (chance(dt * 6)) this.G.particles.puff(this.x, this.y + 30, '#e8f3d8', 2);
    if (this.timer >= 3.6) {
      this.state = 'chrysalis'; this.stage = 6; this.timer = 0;
      this.G.exuviae.push({ seg: this.seg, t: this.t, ang: this.hangAng, instar: 5, s: STAGES[5].scale * .7, dir: 1, alpha: .5, born: this.G.time, dropped: true });
      this.G.particles.sparkle(this.x, this.y + 20, 30, '#c8f0c0', 26);
      AudioFX.molt();
      Bus.emit('pupated', this);
      Bus.emit('fact', 'chrysalis');
    }
  }
  pupaProgress() { return clamp(this.timer / this.diff.pupaTime, 0, 1); }
  clearAmount() { return smoothstep(.78, .96, this.pupaProgress()); }
  updateChrysalis(dt) {
    this.timer += dt;
    if (this.input.actionPressed) { this.twitch = 1; this.timer += .6; AudioFX.twitch(); this.G.particles.puff(this.x, this.y + 30, '#c8f0c0', 3); }
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (!this.clearFact && this.clearAmount() > .5) { this.clearFact = true; Bus.emit('fact', 'clear'); Bus.emit('chrysalisClear', this); }
    if (this.timer >= this.diff.pupaTime) this.eclose();
  }
  /* the chrysalis splits (Read to Play waits here for the butterfly page) */
  eclose() {
    this.state = 'eclosing'; this.timer = 0;
    AudioFX.fanfare();
    this.G.particles.sparkle(this.x, this.y + 20, 50, '#fff6c8', 40);
    this.G.particles.confetti(this.x, this.y + 10, 50);
    Cinematic.play({ follow: () => ({ x: this.x, y: this.y + 30 }), zoom: 2.6, duration: 4.4, slow: .5, title: 'A monarch is born' });
  }
  updateEclose(dt) {
    this.timer += dt;
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    if (this.timer >= 3.8) {
      this.state = 'drying'; this.stage = 7; this.timer = 0; this.eaten = 0; this.fresh = 1; this.crumple = 1; this.readyFlag = false; this.open = 0;
      Bus.emit('eclosed', this);
      Bus.emit('fact', 'eclose');
    }
  }
  dryTime() { return 16; }
  updateDrying(dt) {
    this.timer += dt;
    const p = this.plant.posOn(this.seg, this.t);
    this.x = p.x; this.y = p.y;
    const k = this.timer / this.dryTime();
    this.crumple = 1 - smoothstep(.05, .6, k);
    /* pumping: the wings open and close slowly as fluid goes in */
    this.open = smoothstep(.3, .9, k) * (.5 + .5 * Math.sin(this.timer * 1.6));
    if (k > .15 && k < .5 && chance(dt * 1.2)) this.G.particles.drip(this.x, this.y + 44, '#c9612a');
    if (this.timer >= this.dryTime()) {
      /* climb up onto the leaf: an ordinary adult from here on */
      this.state = 'adult'; this.fresh = .4; this.open = 0;
      this.t = clamp(this.t + .06, .05, .95); this.dir = 1;
      Bus.emit('wingsDry', this);
    }
  }

  /* ---------- flight on the milkweed ---------- */
  takeoff() {
    this.state = 'flying'; this.route = null;
    this.vx = Math.cos(this.ang) * 70; this.vy = Math.sin(this.ang) * 70 - 100;
    AudioFX.takeoff();
    this.G.particles.puff(this.x, this.y, '#ffffff', 6);
    if (!this.flownOnce) { this.flownOnce = true; Cinematic.play({ follow: () => this, zoom: 1.6, duration: 2.8, slow: .4, title: 'First flight' }); }
    Bus.emit('takeoff', this);
  }
  updateFlying(dt) {
    const inp = this.input;
    const G = this.G;
    this.open = Math.min(1, this.open + dt * 5);
    this.wingPhase += dt * 22;
    this.flap = .55 + .45 * Math.abs(Math.cos(this.wingPhase * .5));
    const acc = 460 * this.variant.speed, drag = 2.0;
    this.vx += inp.x * acc * dt; this.vy += inp.y * acc * dt;
    this.vy += 30 * dt;
    this.vx += (G.plant.gust || 0) * 90 * dt;
    const k = Math.exp(-drag * dt);
    this.vx *= k; this.vy *= k;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const b = G.plant.bounds;
    if (this.x < b.left) { this.x = b.left; this.vx = Math.abs(this.vx) * .4; }
    if (this.x > b.right) { this.x = b.right; this.vx = -Math.abs(this.vx) * .4; }
    if (this.y > -30) { this.y = -30; this.vy = -Math.abs(this.vy) * .3; }
    if (this.y < b.top - 200) { this.y = b.top - 200; this.vy = Math.abs(this.vy) * .3; }
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > 20) this.ang = angleLerp(this.ang, Math.atan2(this.vy, this.vx), 1 - Math.exp(-dt * 5));
    this.walk += dt * 6;
    this.landSpot = G.plant.nearest(this.x, this.y, 70);
    const f = G.plant.flowerNear(this.x, this.y, 75);
    this.flowerNear = f && f.nectar > .3 ? f : null;
    this.podNear = G.plant.podNear(this.x, this.y, 80);
    if (inp.actionPressed) {
      if (this.podNear) this.burstPod(this.podNear);
      else if (this.summer && this.readyFlag && this.variant.key !== 'female' && this.mateNear) this.court();
      else if (this.flowerNear && !this.readyFlag) this.landOnFlower(this.flowerNear);
      else if (this.landSpot) this.land(this.landSpot);
      else Bus.emit('hint', 'landHint');
    }
  }
  land(spot) {
    this.seg = spot.seg; this.t = clamp(spot.t, .02, .98);
    this.state = 'adult';
    const p = this.plant.posOn(this.seg, this.t, false);
    this.dir = (this.vx * p.tx + this.vy * p.ty) >= 0 ? 1 : -1;
    this.vx = this.vy = 0; this.open = 0;
    AudioFX.land();
    this.G.particles.puff(this.x, this.y, '#ffffff', 5);
    Bus.emit('landed', this);
  }
  landOnFlower(f) {
    this.state = 'sipping'; this.timer = 0; this.sipClock = .8; this.patch = f;
    this.x = f.x + this.plant.sway(f.x, f.y); this.y = f.y - f.size * .5;
    this.ang = 0; this.vx = this.vy = 0; this.open = 0;
    AudioFX.land();
    Bus.emit('sipStart', this);
  }
  beginSip(f) { this.landOnFlower(f); }
  updateSipping(dt) {
    this.timer += dt;
    const f = this.patch;
    this.x = f.x + this.plant.sway(f.x, f.y); this.y = f.y - f.size * .5;
    this.open = .15 + .15 * Math.sin(this.timer * 1.2);
    this.sipClock -= dt;
    if (this.sipClock <= 0 && f.nectar > .25) {
      this.sipClock = 1.1;
      f.nectar -= .3;
      this.eaten++; this.total++; this.stats.sips++;
      this.G.particles.text(this.x, this.y - 24, 'sip!', '#ffe27a', 13);
      this.G.particles.puff(this.x + 12, this.y, '#f2c4dc', 3);
      AudioFX.sip();
      if (this.stats.sips === 1) Bus.emit('fact', 'nectar');
      if (this.eaten >= this.need()) { this.readyFlag = true; Bus.emit(this.summer ? 'readyMate' : 'readyGo', this); }
    }
    if (this.input.actionPressed || f.nectar <= .25 || this.readyFlag) {
      if (this.input.actionPressed || this.readyFlag) { this.state = 'adult'; this.takeoff(); }
      else { this.state = 'adult'; this.takeoff(); Bus.emit('hint', 'adult'); }
    }
  }

  /* ---------- the migration ---------- */
  startMigration(route) {
    this.routeRef = route;
    this.state = 'migrating'; this.timer = 0;
    this.x = 200; this.y = -320; this.vx = 120; this.vy = 0; this.ang = 0;
    this.energy = 1; this.fat = .1; this.open = 1; this.readyFlag = false;
    this.stats.miles = 0;
    Bus.emit('migrateStart', this);
  }
  updateMigrating(dt) {
    const inp = this.input, G = this.G, R = this.routeRef;
    const night = G.night || 0;
    const winter = this.state === 'winterFly';
    this.wingPhase += dt * (this.flapping ? 26 : 6);
    this.timer += dt;

    /* flap or glide */
    const wantFlap = inp.action || inp.actionPressed || inp.y < -.35;
    this.flapping = wantFlap && this.energy > 0;
    const wind = R.wind(this.x, this.y);
    const cold = night * .5 + R.rain * .5;
    this.spat = Math.max(0, this.spat - dt);
    const dive = inp.y > .35 ? 70 : 0;                   // a dive buys speed: the way to shake a bird
    const airTarget = (inp.x < -.5 ? -90 : 115 + inp.x * 95 + dive) * this.variant.speed * (1 - cold * .45);
    this.vx += (airTarget + wind.x - this.vx) * (1 - Math.exp(-dt * 1.6));
    if (this.flapping) this.vy -= 260 * dt;
    else if (inp.y > .35) this.vy += 160 * dt;
    /* gliding: a gentle sink; wings held in a V */
    this.vy += 55 * dt * (1 + cold);
    this.vy += wind.y * dt * 1.4;
    this.vy *= Math.exp(-dt * 1.4);
    this.vy = clamp(this.vy, -260, 220);
    this.x += this.vx * dt; this.y += this.vy * dt;
    const b = R.bounds;
    if (this.x < b.left + 40) { this.x = b.left + 40; this.vx = Math.abs(this.vx) * .3; }
    if (this.x > b.right - 40) { this.x = b.right - 40; this.vx = -Math.abs(this.vx) * .3; }
    if (this.y < b.top) { this.y = b.top; this.vy = Math.abs(this.vy) * .3; }
    this.flap = this.flapping ? .35 + .65 * Math.abs(Math.cos(this.wingPhase * .5)) : .82 + .06 * Math.sin(this.wingPhase * .5);
    this.ang = angleLerp(this.ang, Math.atan2(this.vy * .45, this.vx), 1 - Math.exp(-dt * 4));

    /* energy */
    const drainK = this.diff.drain * (R.inStorm(this.x) ? 3 : 1) * (night > .5 ? 2.2 : 1);
    this.energy -= (this.flapping ? .028 : .0045) * drainK * dt;
    if (R.thermalAt(this.x, this.y)) {
      const t = R.thermalAt(this.x, this.y);
      if (!t.used) { t.used = true; this.stats.thermals++; Bus.emit('thermal', t); if (this.stats.thermals === 1) Bus.emit('fact', 'glide'); }
      if (chance(dt * 8)) G.particles.spawn({ type: 'spark', x: this.x + rnd(-40, 40), y: this.y + rnd(-20, 40), vx: 0, vy: -60, g: 0, r: 2, col: '#fff2c0', life: .8, twinkle: rnd(TAU) });
    }
    if (!winter) this.stats.miles = Math.max(this.stats.miles, R.miles(this.x));
    if (this.energy <= 0) { this.energy = 0; this.exhaust(); return; }
    if (this.energy < .25 && chance(dt * .3)) Bus.emit('hint', 'lowEnergy');

    /* the ground, the lake */
    if (this.y > -36) {
      if (R.overWater(this.x)) { this.y = -36; this.vy = -120; this.energy -= .03; G.particles.text(this.x, this.y - 30, 'Water!', '#bfe0ff', 14); if (chance(.5)) AudioFX.splash(); }
      else { this.y = -36; this.vy = -Math.abs(this.vy) * .2; }
    }

    /* landing options */
    this.landing = null;
    const patch = R.nectarNear(this.x, this.y, 95);
    const tree = R.treeNear(this.x, this.y, 120);
    if (patch && patch.nectar > .2 && !winter) this.landing = { type: 'nectar', patch };
    else if (tree) this.landing = { type: tree.fir ? 'fir' : 'tree', tree };
    else if (this.y > -70 && !R.overWater(this.x)) this.landing = { type: 'ground' };
    if (inp.actionPressed && this.landing) {
      if (this.landing.type === 'nectar') this.landNectar(this.landing.patch);
      else if (this.landing.type === 'tree') this.roost(this.landing.tree);
      else if (this.landing.type === 'fir') { if (winter) this.roost(this.landing.tree, true); else this.arrive(this.landing.tree); }
      else this.rest(false);
    }
  }
  exhaust() {
    this.blownBack = this.routeRef.overWater(this.x);
    if (this.blownBack) {
      /* kid-friendly: the wind blows you back to the shore */
      const shore = this.routeRef.lake.x0 - 200;
      this.x = shore; this.y = -60;
      Bus.emit('hint', 'lake');
      this.G.particles.text(this.x, this.y - 40, 'Blown back to shore!', '#bfe0ff', 16);
    }
    this.stats.exhausted++;
    Bus.emit('exhausted', this);
    Bus.emit('fact', 'exhausted');
    this.rest(true);
  }
  rest(exhausted) {
    this.state = 'resting'; this.timer = 0; this.restT = exhausted ? 7 : 2; this.exhaustedFlag = exhausted;
    this.vx = 0; this.vy = 0; this.open = 0; this.ang = 0;
    if (!exhausted) this.y = -34;
    AudioFX.land();
    Bus.emit('rest', this);
  }
  updateResting(dt) {
    this.timer += dt;
    /* an exhausted butterfly flutters down before it can rest */
    if (this.y < -34) { this.y = Math.min(-34, this.y + 150 * dt); this.x += 25 * dt; this.wingPhase += dt * 8; this.open = 1; this.flap = .6 + .4 * Math.abs(Math.cos(this.wingPhase * .5)); return; }
    this.open += ((.2 + .2 * Math.sin(this.timer)) - this.open) * dt * 2;
    if (this.exhaustedFlag) this.energy = Math.min(.3, this.energy + dt * .035);
    else this.energy = Math.min(1, this.energy + dt * .01);
    if (this.timer >= this.restT && this.input.actionPressed) this.takeoffRoute();
  }
  takeoffRoute() {
    this.state = this.winter ? 'winterFly' : 'migrating';
    this.vx = 80; this.vy = -120; this.open = 1; this.ang = 0;
    this.exhaustedFlag = false; this.roostTree = null; this.patch = null;
    AudioFX.takeoff();
    this.G.particles.puff(this.x, this.y, '#ffffff', 6);
    Bus.emit('takeoff', this);
  }
  landNectar(patch) {
    this.state = 'nectaring'; this.timer = 0; this.sipClock = .6; this.patch = patch;
    this.x = patch.x + rnd(-10, 10); this.y = patch.y - 6; this.vx = this.vy = 0; this.open = 0; this.ang = 0;
    this.stats.nectarStops++;
    Journal.add('plants', patch.kind);
    AudioFX.land();
    Bus.emit('nectarStart', this);
    if (this.stats.nectarStops === 1) Bus.emit('fact', 'nectar');
    const fr = this.routeRef.frac(this.x);
    if (!this.tag && this.id === 1 && fr > .06 && fr < .85 && !this.summer) { this.beginTagging(); return; }
  }
  updateNectaring(dt) {
    this.timer += dt;
    const p = this.patch;
    this.open += ((.25 + .25 * Math.sin(this.timer * 1.1)) - this.open) * dt * 2;
    this.sipClock -= dt;
    if (this.sipClock <= 0 && p.nectar > .05 && this.energy < 1) {
      this.sipClock = .8;
      const amt = NECTAR_PLANTS[p.kind].nectar * .5;
      p.nectar = Math.max(0, p.nectar - .12);
      this.energy = Math.min(1, this.energy + amt);
      this.fat = Math.min(1, this.fat + amt * .18);
      this.stats.sips++;
      this.G.particles.text(this.x, this.y - 26, '+nectar', '#ffe27a', 12);
      this.G.particles.puff(this.x + 12, this.y, NECTAR_PLANTS[p.kind].col, 3);
      AudioFX.sip();
      Bus.emit('nectarSip', this);
    }
    if (this.input.actionPressed) this.takeoffRoute();
    else if ((p.nectar <= .05 || this.energy >= 1) && this.timer > 2 && chance(dt * .8)) Bus.emit('hint', 'migrate');
  }
  roost(tree, winterNap) {
    this.state = 'roosting'; this.timer = 0; this.roostTree = tree; this.winterNap = !!winterNap;
    this.x = tree.x + rnd(-24, 24); this.y = tree.landY + rnd(-20, 20); this.vx = this.vy = 0; this.open = 0; this.ang = 0;
    this.stats.roosts++; this.waitDays = 0; this.decided = false;
    tree.roost = Math.min(1, tree.roost + .35);
    Journal.add('trees', tree.kind);
    Journal.add('milestones', 'roost');
    if (this.id === 1 && !winterNap) this.routeRef.rollForecast(this.x);
    AudioFX.land();
    Bus.emit('roost', this, tree);
    if (this.stats.roosts === 1) Bus.emit('fact', 'roost');
    if (this.routeRef.inStorm(this.x) || (this.routeRef.storm && this.routeRef.storm.warned)) { this.stats.storms++; Bus.emit('sheltered', this); }
  }
  updateRoosting(dt) {
    this.timer += dt;
    this.open += ((.1 + .1 * Math.sin(this.timer * .8)) - this.open) * dt * 2;
    this.energy = Math.min(1, this.energy + dt * .004);
    /* main.js races the clock through the night; take off when it is light and calm */
    const night = this.G.night || 0;
    const storm = this.routeRef.inStorm(this.x) || (this.routeRef.storm && Math.abs(this.routeRef.storm.x - this.x) < 2200);
    if (this.waitDays > 0) return;                     // waiting out the weather: main.js runs the clock
    if (this.input.actionPressed && this.timer > 1.2) {
      if (night > .5 || storm) { Bus.emit('hint', storm ? 'stormWarn' : 'roosting'); this.twitch = 1; }
      else this.takeoffRoute();
    }
  }
  /* Player 2 fell too far behind (or ahead): pop back beside player 1. */
  catchUp(other) {
    this.x = other.x - 60; this.y = Math.min(-80, other.y - 20);
    if (this.state !== 'migrating' && this.state !== 'winterFly') this.takeoffRoute();
    this.energy = Math.max(this.energy, .3);
    this.G.particles.puff(this.x, this.y, '#ffffff', 8);
    Bus.emit('hint', 'coopBehind');
  }
  arrive(tree) {
    this.state = 'arrived'; this.timer = 0; this.roostTree = tree; this.winter = true;
    this.x = tree.x + rnd(-20, 20); this.y = tree.landY + rnd(-30, 10); this.vx = this.vy = 0; this.open = 0; this.ang = 0;
    tree.roost = 1;
    this.stats.miles = ROUTE_MILES;
    if (this.tagInfo) { Journal.recover(this.tagInfo, this.G.day); Bus.emit('fact', 'recovery'); }
    Journal.add('milestones', 'arrived');
    Journal.bestRun(ROUTE_MILES, this.stats.nectarStops, this.G.day);
    AudioFX.fanfare();
    this.G.particles.confetti(this.x, this.y - 40, 120);
    Cinematic.play({ follow: () => ({ x: this.x, y: this.y - 120 }), zoom: .7, duration: 6, slow: .5, title: 'The oyamel forest' });
    Bus.emit('arrived', this);
    Bus.emit('fact', 'arrive');
  }
  updateArrived(dt) {
    this.timer += dt;
    this.open += ((.08 + .12 * Math.max(0, Math.sin(this.timer * .7))) - this.open) * dt * 2;
    this.energy = Math.min(1, this.energy + dt * .01);
    if (this.input.actionPressed && this.timer > 6) { this.state = 'winterFly'; this.takeoffRoute(); Bus.emit('hint', 'winterFly'); }
  }

  /* ---------- knocks and frights ---------- */
  shoved(ant) {
    const p = this.plant.posOn(this.seg, this.t, false);
    const away = ((this.x - ant.x) * p.tx + (this.y - ant.y) * p.ty) >= 0 ? 1 : -1;
    this.shove = .45; this.shoveDir = away;
    this.route = null;
    this.stats.shoved++;
    this.G.cam.shake = 1;
    this.G.particles.text(this.x, this.y - 20, 'Shoved!', '#ffb3a7', 16);
    AudioFX.bump();
  }
  frightened(side) {
    this.fright = 1;
    this.G.cam.shake = 1.2;
    this.G.particles.text(this.x, this.y - 26, 'EEK!', '#ffb3a7', 20);
    AudioFX.bump();
    this.route = null;
    this.shove = .5; this.shoveDir = this.dir * -1;
  }

  /* ---------- drawing ---------- */
  draw(ctx, time) {
    const s = this.scale();
    ctx.save();
    ctx.translate(this.x, this.y);
    const v = this.variant;
    switch (this.state) {
      case 'egg': {
        ctx.rotate(this.ang);
        ctx.translate(0, 4);                        // glued under the leaf
        const k = 1 + this.hatchProg * .1;
        ctx.scale(k, k);
        Sprites.drawEgg(ctx, { s: 1.6, wobble: this.hatchWobble * time, crack: this.hatchProg });
        ctx.globalAlpha = .25 + .15 * Math.sin(time * 4);
        ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(time * 4) * 2, 0, TAU); ctx.stroke();
        break;
      }
      case 'larva': {
        ctx.rotate(this.ang);
        this.drawShadow(ctx, 30 * s, 8 * s);
        ctx.scale(1, 1 - this.frozen * .12);
        Sprites.drawCaterpillar(ctx, { s, instar: this.stage, walk: this.frozen > .5 ? 0 : this.walk, chew: this.chew });
        break;
      }
      case 'molting': {
        ctx.rotate(this.ang);
        const k = this.timer;
        const pale = k < 1.0 ? smoothstep(0, 1.0, k) * .85 : (k < 1.6 ? .85 : .85 * (1 - smoothstep(1.6, 2.6, k)));
        ctx.rotate(Math.sin(time * 50) * .03 * (k < 1.0 ? 1 : 0));
        this.drawShadow(ctx, 30 * s, 8 * s);
        Sprites.drawCaterpillar(ctx, { s, instar: this.stage, walk: this.walk, chew: 0, pale });
        if (k > .85 && k < 1.3) { ctx.globalAlpha = 1 - Math.abs((k - 1.05) / .25); ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(0, 0, 40 * s, 0, TAU); ctx.fill(); }
        break;
      }
      case 'jhang': {
        /* silk button on the leaf, tail up, body hanging, head curling into the J */
        ctx.fillStyle = '#f2ead0'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, TAU); ctx.fill();
        ctx.rotate(Math.PI / 2 + Math.sin(time * 40) * this.twitch * .08);
        ctx.translate(34 * s, 0);                    // tail sits at the button, body hangs down
        Sprites.drawCaterpillar(ctx, { s, instar: 5, walk: time * .3, chew: 0, curl: this.curl });
        break;
      }
      case 'pupating': {
        const k = this.timer / 3.6;
        ctx.fillStyle = '#f2ead0'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, TAU); ctx.fill();
        /* the caterpillar skin slides up and off */
        ctx.save();
        ctx.globalAlpha = 1 - smoothstep(.55, 1, k);
        ctx.rotate(Math.PI / 2 + Math.sin(time * 30) * .05 * (1 - k));
        ctx.translate(34 * s - smoothstep(.2, 1, k) * 40, 0);     // the skin slides up toward the button
        Sprites.drawCaterpillar(ctx, { s: s * (1 - k * .25), instar: 5, walk: 0, chew: 0, curl: 2.3 * (1 - k * .8), pale: smoothstep(0, .5, k) * .6 });
        ctx.restore();
        /* the chrysalis grows out from underneath */
        const g = smoothstep(.15, .9, k);
        ctx.save();
        ctx.globalAlpha = smoothstep(.1, .5, k);
        ctx.scale(lerp(.6, 1, g), lerp(.6, 1, g));
        Sprites.drawChrysalis(ctx, { s: 1.1, prog: 0, twitch: 0, variant: v });
        ctx.restore();
        break;
      }
      case 'chrysalis': {
        Sprites.drawChrysalis(ctx, { s: 1.1, prog: this.pupaProgress(), clear: this.clearAmount(), twitch: Math.sin(time * 60) * this.twitch, variant: v });
        break;
      }
      case 'eclosing': {
        const k = this.timer / 3.8;
        ctx.save();
        ctx.globalAlpha = 1 - smoothstep(.5, 1, k);
        Sprites.drawChrysalis(ctx, { s: 1.1, prog: 1, clear: 1, split: smoothstep(0, .4, k), variant: v });
        ctx.restore();
        /* the butterfly crawls out and hangs head-down under the shell */
        const out = smoothstep(.15, .85, k);
        ctx.translate(0, 8 + out * 40);
        ctx.rotate(Math.PI / 2);
        ctx.globalAlpha = smoothstep(.05, .35, k);
        Sprites.drawMonarch(ctx, { s: lerp(.5, .9, out), variant: v, open: 0, crumple: 1, fresh: 1 });
        break;
      }
      case 'drying': {
        ctx.fillStyle = '#f2ead0'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.4, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = .35; Sprites.drawChrysalis(ctx, { s: 1.1, prog: 1, clear: 1, split: 1, variant: v, alpha: .35 }); ctx.globalAlpha = 1;
        ctx.translate(0, 48);
        ctx.rotate(Math.PI / 2 + Math.sin(time * 1.5) * .04);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, crumple: this.crumple, fresh: this.fresh, walk: 0 });
        break;
      }
      case 'adult': {
        ctx.rotate(this.ang);
        this.drawShadow(ctx, 30, 20, -4);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, flap: 1, walk: this.walk, fresh: this.fresh, tag: this.tag });
        break;
      }
      case 'sipping': case 'nectaring': {
        this.drawShadow(ctx, 26, 8, 0);
        ctx.rotate(-.35 + Math.sin(time * 2) * .03);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, flap: 1, walk: 0, fresh: this.fresh, tag: this.tag });
        break;
      }
      case 'flying': case 'migrating': case 'winterFly': {
        ctx.save();
        ctx.translate(14, Math.min(60, -this.y * .08 + 30));
        ctx.globalAlpha = .12; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.rotate(this.ang + Math.sin(time * 30) * this.fright * .3);
        const bob = Math.sin(this.wingPhase * .5) * 1.5;
        ctx.translate(0, bob);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: 1, flap: this.flap, walk: this.walk * .2, fresh: this.fresh, tag: this.tag });
        break;
      }
      case 'roosting': case 'arrived': {
        ctx.rotate(Math.PI / 2 + Math.sin(time * .7) * .03);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, walk: 0, tag: this.tag });
        if (this.state === 'roosting' && (this.G.night || 0) > .3) {
          ctx.rotate(-Math.PI / 2);
          const z = (time * .7) % 1;
          ctx.globalAlpha = 1 - z;
          ctx.font = `900 ${10 + z * 8}px ${UI_FONT}`; ctx.fillStyle = '#e8f0ff'; ctx.textAlign = 'center';
          ctx.fillText('z', 10 + z * 14, -30 - z * 30);
        }
        break;
      }
      case 'silk': {
        /* a thread back up to the leaf, and the caterpillar dangling */
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -this.silkY); ctx.lineTo(0, 0); ctx.stroke();
        ctx.rotate(Math.PI / 2 + Math.sin(time * 3) * .15);
        Sprites.drawCaterpillar(ctx, { s, instar: this.stage, walk: time * 2, chew: 0, curl: .6 });
        break;
      }
      case 'laying': {
        ctx.rotate(this.ang);
        this.drawShadow(ctx, 30, 20, -4);
        ctx.rotate(Math.sin(this.timer * 12) * .05);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, flap: 1, walk: this.walk, tag: this.tag });
        break;
      }
      case 'courting': {
        ctx.rotate(this.ang);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: 1, flap: this.flap, walk: 0, tag: this.tag });
        break;
      }
      case 'tagging': {
        this.drawShadow(ctx, 26, 8, 0);
        ctx.rotate(-.35);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, flap: 1, walk: 0, tag: this.tag });
        break;
      }
      case 'resting': {
        this.drawShadow(ctx, 26, 8, 0);
        ctx.rotate(-.1);
        Sprites.drawMonarch(ctx, { s: .95, variant: v, open: this.open, walk: 0, tag: this.tag });
        if (this.exhaustedFlag) { ctx.globalAlpha = .8; ctx.font = `900 12px ${UI_FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(this.timer < this.restT ? '…resting…' : 'SPACE to fly', 0, -50); }
        break;
      }
    }
    ctx.restore();
  }

  drawShadow(ctx, rx, ry, ox = 0) {
    ctx.save();
    ctx.globalAlpha = .2;
    ctx.fillStyle = '#0a1a08';
    ctx.beginPath(); ctx.ellipse(ox, 4, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
