/* ============================================================
   player.js — the frog you are
   ============================================================
   One object carries the whole life: jelly egg → tadpole → back
   legs → front legs and a shrinking tail → froglet → frog → eggs,
   and in winter, sleep under the ice.

   States: egg | tadpole | morphing | froglet | frog | laying |
           hibernating
   Modes (froglet/frog): water | perch | air | cling
   ============================================================ */
'use strict';

class Frog {
  constructor(G, speciesKey, id = 1) {
    this.G = G; this.id = id;
    this.species = SPECIES[speciesKey] || SPECIES.green;
    this.stage = 0; this.state = 'egg'; this.mode = 'water';
    this.x = 0; this.y = 30; this.vx = 0; this.vy = 0; this.ang = 0; this.dir = 1;
    this.kick = 0; this.swim = 0; this.legs = 0; this.arms = 0; this.tail = 1; this.tailT = 0; this.stub = 0; this.morph = 0; this.kickAnim = 0; this.kickT = 0;
    this.eaten = 0; this.total = 0; this.readyFlag = false;
    this.hatchProg = 0; this.hatchWobble = 0;
    this.air = 1; this.gulps = 0; this.atSurface = false;
    this.burst = 0; this.burstCd = 0;
    this.tongue = { active: false, t: 0, len: 0, dy: 0, target: null, kind: null, grabbed: false };
    this.target = null; this.targetKind = null;
    this.throat = 0; this.singCd = 0; this.blink = 0; this.blinkT = rnd(2, 6);
    this.crouch = 0; this.fright = 0; this.grazeT = 0; this.grazing = null; this.hopCd = 0;
    this.perch = null; this.cling = null;
    this.spawnNear = false; this.mudNear = false; this.litterNear = false;
    this.eggSpot = null; this.timer = 0; this.morphTo = 0; this.hibKind = null;
    this.input = { x: 0, y: 0, action: false, actionPressed: false, singPressed: false };
    this.stats = { night: 0, rain: 0, quick: [], pads: new Set(), deepDodges: 0, statueDodges: 0, padDodges: 0, snaps: 0, dragonflies: 0, wrigglers: 0, sang: 0, answers: 0, hibernations: 0, hops: 0, bursts: 0, escapes: 0, frights: 0, gulps: 0 };
    this.firsts = {};
    this.wasDeep = false;
    this.look = { dx: 0, dy: 0 }; this.landT = 0; this.travelCd = 0;
  }

  /* ---------- helpers ---------- */
  get diff() { return DIFFICULTY[this.G.settings.difficulty] || DIFFICULTY.normal; }
  stageDef() { return STAGES[this.stage]; }
  need() { return Math.max(1, Math.round(this.stageDef().need * this.diff.mult * this.species.need)); }
  progress() { const n = this.need(); return n ? clamp(this.eaten / n, 0, 1) : 0; }
  tailProgress() { return clamp(this.tailT, 0, 1); }
  isTadpole() { return this.stage >= 1 && this.stage <= 3 && (this.state === 'tadpole' || this.state === 'morphing'); }
  isFrogLike() { return this.state === 'froglet' || this.state === 'frog'; }
  inWater() { return this.state === 'tadpole' || this.state === 'morphing' || (this.isFrogLike() && this.mode === 'water') || (this.state === 'hibernating' && this.hibKind === 'mud'); }
  canEat() { return (this.state === 'tadpole' && this.stage < 3 || this.isFrogLike()) && !this.readyFlag && this.fright < .3; }
  canHuntWrigglers() { return (this.state === 'tadpole' && this.stage >= 2) || (this.isFrogLike() && this.mode === 'water'); }
  scale() {
    let s = this.stageDef().scale;
    if (this.state === 'morphing') s = lerp(STAGES[this.stage].scale, STAGES[this.morphTo].scale, smoothstep(.6, 2.4, this.timer));
    return s * lerp(1, this.species.size, this.stage >= 4 ? 1 : .5);
  }
  speed() { return this.stageDef().speed * (this.G.settings.slowmo ? .6 : 1) * this.species.speed; }
  reach() { return (this.stage === 5 ? 118 : 74) * this.species.reach * (this.G.settings.difficulty === 'easy' ? 1.25 : 1); }
  cameraZoom() {
    switch (this.state) {
      case 'egg': return 2.4;
      case 'tadpole': case 'morphing': return [2.4, 2.2, 1.9, 1.7][this.stage] || 1.7;
      case 'froglet': return this.mode === 'air' ? 1.25 : 1.5;
      case 'frog': case 'laying': return this.mode === 'air' ? 1.05 : 1.25;
      case 'hibernating': return 1.7;
    }
    return 1.4;
  }
  mouth() {
    const s = this.scale();
    if (this.isTadpole()) return { x: this.x + Math.cos(this.ang) * 15 * s, y: this.y + Math.sin(this.ang) * 15 * s };
    return { x: this.x + this.dir * 22 * s, y: this.y - 2 * s };
  }
  isSafeFromHeron() {
    if (this.state === 'egg' || this.state === 'hibernating' || this.state === 'laying' || this.state === 'morphing') return true;
    const pond = this.G.pond, surf = pond.surfaceAt(this.x);
    if (this.mode === 'cling') return true;
    if (this.y > 165) return true;
    if (this.inWater()) {
      const pad = pond.padAt(this.x, surf, -4);
      if (pad && this.y > surf + 6) return true;
      if (Math.abs(this.x) > pond.W - 200 && this.y > surf + 12) return true;     // among the reed stems
    }
    if (this.crouch > .6) return true;
    return false;
  }
  /* what kept us safe, for stickers and journal */
  safeReason() {
    if (this.mode === 'cling') return 'cling';
    if (this.y > 165) return 'deep';
    if (this.crouch > .6) return 'statue';
    const pond = this.G.pond;
    if (this.inWater() && pond.padAt(this.x, pond.surfaceAt(this.x), -4)) return 'pad';
    return 'reeds';
  }

  placeEgg(spot) {
    this.eggSpot = { x: spot.x, y: spot.y };
    this.x = spot.x; this.y = spot.y; this.ang = -.3; this.dir = spot.x < 0 ? 1 : -1;
  }

  /* ---------- per frame ---------- */
  update(dt) {
    const inp = this.input;
    this.fright = Math.max(0, this.fright - dt * 1.4);
    this.burst = Math.max(0, this.burst - dt * 2.2);
    this.burstCd = Math.max(0, this.burstCd - dt);
    this.throat = Math.max(0, this.throat - dt * 2);
    this.singCd = Math.max(0, this.singCd - dt);
    this.hopCd = Math.max(0, this.hopCd - dt);
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blinkT = rnd(2.5, 7); this.blink = 1; }
    this.blink = Math.max(0, this.blink - dt * 6);
    this.kickAnim = Math.max(0, this.kickAnim - dt * 2.6);
    this.landT = Math.max(0, this.landT - dt * 4);
    this.travelCd = Math.max(0, this.travelCd - dt);
    this.updateLook(dt);
    switch (this.state) {
      case 'egg': this.updateEgg(dt); break;
      case 'tadpole': this.updateTadpole(dt); break;
      case 'morphing': this.updateMorph(dt); break;
      case 'froglet': case 'frog': this.updateFrog(dt); break;
      case 'laying': this.updateLaying(dt); break;
      case 'hibernating': this.updateHibernating(dt); break;
    }
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) { this.x = 0; this.y = 40; this.vx = this.vy = 0; }
    inp.actionPressed = false; inp.singPressed = false;
  }

  /* eyes follow the target bug, or the way we are going */
  updateLook(dt) {
    let tx = 0, ty = 0;
    if (this.target) { const m = this.mouth(); const dx = this.target.x - m.x, dy = this.target.y - m.y, d = Math.hypot(dx, dy) || 1; tx = dx / d * this.dir; ty = dy / d; }
    else if (this.isTadpole()) { ty = clamp(this.vy / 200, -1, 1) * .5; }
    else { tx = clamp(this.vx * this.dir / 250, -1, 1) * .6; ty = clamp(this.vy / 300, -1, 1) * .7; }
    const k = 1 - Math.exp(-dt * 8);
    this.look.dx += (tx - this.look.dx) * k; this.look.dy += (ty - this.look.dy) * k;
  }

  /* ---------- egg ---------- */
  updateEgg(dt) {
    const inp = this.input;
    this.hatchProg = Math.max(0, this.hatchProg - dt * .05);
    this.hatchWobble = Math.max(0, this.hatchWobble - dt * 3);
    if (inp.actionPressed || Math.hypot(inp.x, inp.y) > .5 && chance(dt * 3)) {
      this.hatchProg += .24; this.hatchWobble = 1;
      AudioFX.wriggle && AudioFX.wriggle(this.x);
      this.G.particles.bubbles(this.x, this.y, 2, .7);
    }
    this.x = this.eggSpot.x; this.y = this.eggSpot.y + Math.sin(this.G.time * 2) * 1.5;
    if (this.hatchProg >= 1) this.hatch();
  }
  /* swimming into the culvert, or down the stream */
  checkWaterExit(inp) {
    if (this.id !== 1 || this.travelCd > 0) return false;
    const pond = this.G.pond, key = pond.place.key, side = sign(this.x);
    if (Math.abs(this.x) < pond.wetW() - 130 || inp.x * side < .3) return false;
    let dest = null;
    const inPipe = this.y > 14 && this.y < 90;
    if (key === 'home' && side === 1 && inPipe) dest = { kind: 'stream', how: 'culvert', enter: -1 };
    if (key === 'stream') dest = side < 0 ? (inPipe ? { kind: 'home', how: 'culvert', enter: 1 } : null) : { kind: 'marsh', how: 'stream', enter: -1 };
    if (!dest) return false;
    this.travelCd = 4;
    Bus.emit('wantTravel', this, dest);
    return true;
  }

  hatch() {
    this.stage = 1; this.state = 'tadpole'; this.eaten = 0; this.tail = 1; this.legs = 0; this.arms = 0;
    this.vx = 40; this.vy = 20;
    this.G.particles.sparkle(this.x, this.y, 22, '#dff6ff', 18);
    this.G.particles.bubbles(this.x, this.y, 6, .8);
    this.G.particles.text(this.x, this.y - 22, 'Hatched!', '#ffe27a', 18);
    AudioFX.hatch && AudioFX.hatch(this.x);
    Bus.emit('hatched', this);
    Bus.emit('fact', 'hatch');
    setTimeout(() => Bus.emit('fact', 'tadpole'), 15000);
  }

  /* ---------- tadpole (stages 1–3) ---------- */
  updateTadpole(dt) {
    const inp = this.input, pond = this.G.pond, s = this.scale();
    const mag = Math.hypot(inp.x, inp.y);
    const surf = pond.surfaceAt(this.x), bed = pond.bedY(this.x);
    const ice = pond.weather.ice;
    let maxSp = this.speed() * (this.stage === 3 ? .8 : 1);
    /* grazing algae: hold SPACE next to a patch */
    const m = this.mouth();
    let patch = null;
    if (this.canEat() && this.stage < 3) patch = this.G.algae.nearest(m.x, m.y, 14 + s * 6);
    this.grazing = patch;
    if (patch && inp.action) {
      this.grazeT += dt * (inp.actionPressed ? 2.5 : 1);
      this.vx *= 1 - Math.min(1, 6 * dt); this.vy *= 1 - Math.min(1, 6 * dt);
      const want = { x: patch.x + (this.x - patch.x) * .2, y: patch.y + (this.y - patch.y) * .2 };
      this.ang = angleLerp(this.ang, Math.atan2(patch.y - this.y, patch.x - this.x), 1 - Math.exp(-dt * 5));
      if (this.grazeT >= .5) { this.grazeT = 0; this.G.algae.graze(patch, .07); this.eat('algae', 1, m.x, m.y); }
      this.kick += dt * 6;
    } else {
      this.grazeT = Math.max(0, this.grazeT - dt);
      /* burst of speed */
      if (inp.actionPressed && this.burstCd <= 0) {
        this.burst = 1; this.burstCd = .8; this.stats.bursts++;
        const a = mag > .1 ? Math.atan2(inp.y, inp.x) : this.ang;
        this.vx += Math.cos(a) * 240 * this.species.speed; this.vy += Math.sin(a) * 240 * this.species.speed;
        this.G.particles.bubbles(this.x - Math.cos(this.ang) * 10, this.y, 5, .7);
        AudioFX.burst && AudioFX.burst(this.x);
        Bus.emit('burst', this);
      }
      if (mag > .05) { this.vx += inp.x * 560 * dt; this.vy += inp.y * 560 * dt; this.swim += (1 - this.swim) * (1 - Math.exp(-dt * 6)); }
      else this.swim += (0 - this.swim) * (1 - Math.exp(-dt * 3));
    }
    /* wrigglers: bump them with your mouth */
    if (this.stage >= 2 && this.canEat()) {
      const w = this.G.wrigglers.nearest(m.x, m.y, 12 + s * 8);
      if (w && w.dive < .7) { w.caught = true; this.G.wrigglers.remove(w); this.eat('wriggler', 2, w.x, w.y + 8); this.stats.wrigglers++; }
    }
    /* stage 3: lungs. Breathe at the surface; the tail shrinks faster when you do. */
    if (this.stage === 3) {
      const atSurf = this.y < surf + 9 + s * 4 && ice < .5;
      if (atSurf) {
        const was = this.air; this.air = Math.min(1, this.air + dt * .9);
        if ((was < .55 && this.air >= .55) || (!this.atSurface && (this.air < .85 || !this.gulps))) this.gulp();
        if (chance(dt * 2)) pond.disturb(this.x, 2, 1);
      } else this.air = Math.max(0, this.air - dt / 16);
      this.atSurface = atSurf;
      if (this.air <= 0.01) { this.vy -= 320 * dt; if (!this._airHint) { this._airHint = true; Bus.emit('needAir', this); } }
      else if (this.air > .4) this._airHint = false;
      this.tailT += dt / this.diff.tailTime * (atSurf ? 2.2 : 1) * (this.G.settings.slowmo ? .7 : 1);
      this.tail = 1 - smoothstep(0, 1, this.tailT) * .97;
      this.morph = smoothstep(.2, 1, this.tailT);
      if (this.tailT >= 1) { this.becomeFroglet(); return; }
    }
    /* water drag, speed cap */
    const drag = 1 - Math.min(1, 3 * dt);
    this.vx *= drag; this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy), cap = maxSp * (1 + this.burst * 1.2) * (1 + this.fright * .4);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x += pond.currentAt(this.x, this.y) * dt;
    /* stay in the water */
    const top = surf + 5 * s + (ice > .5 ? 10 + ice * 24 : 0);
    if (this.y < top) { this.y = top; if (this.vy < 0) this.vy *= -.2; if (ice < .5 && sp > 60 && chance(.3)) pond.disturb(this.x, sp * .04, 1); }
    if (this.y > bed - 7 * s) { this.y = bed - 7 * s; if (this.vy > 0) this.vy *= -.1; this.vx *= .9; }
    const lim = pond.wetW() - 18;
    if (this.checkWaterExit(inp)) return;
    if (Math.abs(this.x) > lim) { this.x = sign(this.x) * lim; this.vx *= -.3; }
    /* facing & tail beat */
    if (sp > 6) this.ang = angleLerp(this.ang, Math.atan2(this.vy, this.vx), 1 - Math.exp(-dt * 7));
    this.dir = Math.cos(this.ang) >= 0 ? 1 : -1;
    this.kick += dt * (3 + sp * .12 + this.burst * 18);
    if (sp > 30 && chance(dt * .8)) this.G.particles.bubbles(this.x, this.y, 1, .6);
    /* the legs keep growing while you swim */
    if (this.stage >= 2) this.legs = Math.min(1, this.legs + dt * .04);
    if (this.stage >= 3) this.arms = Math.min(1, this.arms + dt * .08);
    /* deep-water tracking for the journal */
    const deep = this.y > 165; if (deep && !this.wasDeep) Bus.emit('wentDeep', this); this.wasDeep = deep;
    /* grow */
    if (this.stage < 3 && this.eaten >= this.need()) this.advance();
  }

  eat(kind, worth, x, y) {
    this.eaten += worth; this.total += worth;
    const now = this.G.time;
    this.stats.quick = this.stats.quick.filter(t => now - t < 12); this.stats.quick.push(now);
    if (this.G.night > .5) this.stats.night++;
    if (this.G.pond.weather.raining) this.stats.rain++;
    if (kind === 'algae') { this.G.particles.flecks(x, y, '#8fd85a', 6); AudioFX.scrape && AudioFX.scrape(this.x); }
    else { this.G.particles.splat(x, y, kind === 'wriggler' ? '#c9c0a0' : '#dfe8ff', 8); AudioFX.gulpBug && AudioFX.gulpBug(this.x); this.blink = 1; }
    if (kind !== 'algae' || this.eaten % 3 === 0) this.G.particles.text(x, y - 14, kind === 'algae' ? 'yum' : `+${worth}`, kind === 'algae' ? '#bff08a' : '#fff', 13);
    Bus.emit('eat', this, kind);
  }
  gulp() {
    this.gulps++; this.stats.gulps++;
    this.G.particles.ripple(this.x, this.G.pond.surfaceAt(this.x), .8);
    this.G.particles.bubbles(this.x, this.y + 4, 3, .6);
    AudioFX.gulp && AudioFX.gulp(this.x);
    Bus.emit('gulp', this);
  }

  /* stage 1 → 2 (back legs) and 2 → 3 (front legs, tail starts shrinking) */
  advance() {
    this.morphTo = this.stage + 1; this.state = 'morphing'; this.timer = 0;
    const title = this.morphTo === 2 ? 'Back legs!' : 'Front legs!';
    Cinematic.play({ follow: () => ({ x: this.x, y: this.y }), zoom: 2.6, duration: 3.4, slow: .4, title });
    AudioFX.molt && AudioFX.molt(this.x);
    Bus.emit(this.morphTo === 2 ? 'legsStart' : 'armsStart', this);
  }
  updateMorph(dt) {
    const pond = this.G.pond;
    this.timer += dt;
    this.vx *= 1 - Math.min(1, 2 * dt); this.vy *= 1 - Math.min(1, 2 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt + Math.sin(this.G.time * 3) * 4 * dt;
    this.kick += dt * 5;
    const k = smoothstep(.6, 2.6, this.timer);
    if (this.morphTo === 2) this.legs = Math.max(this.legs, k * .8);
    if (this.morphTo === 3) this.arms = Math.max(this.arms, k * .85);
    if (this.timer > 1.2 && chance(dt * 6)) this.G.particles.sparkle(this.x + rnd(-14, 14), this.y + rnd(-8, 8), 1, '#e8fff0', 4);
    const surf = pond.surfaceAt(this.x); if (this.y < surf + 12) this.y = surf + 12;
    if (this.timer >= 3.4) {
      this.stage = this.morphTo; this.state = 'tadpole'; this.eaten = 0; this.tailT = 0; this.air = 1;
      this.G.particles.text(this.x, this.y - 24, this.stage === 2 ? 'Legs!' : 'Lungs!', '#ffe27a', 18);
      Bus.emit(this.stage === 2 ? 'legs' : 'arms', this);
      Bus.emit('fact', this.stage === 2 ? 'legs' : 'arms');
      if (this.stage === 3) setTimeout(() => Bus.emit('fact', 'tail'), 12000);
    }
  }
  becomeFroglet() {
    this.stage = 4; this.state = 'froglet'; this.mode = 'water'; this.eaten = 0; this.stub = .35; this.tail = 0;
    this.dir = Math.cos(this.ang) >= 0 ? 1 : -1;
    this.legs = 1; this.arms = 1;
    Cinematic.play({ follow: () => ({ x: this.x, y: this.y }), zoom: 2.4, duration: 3.2, slow: .45, title: 'A froglet!' });
    this.G.particles.sparkle(this.x, this.y, 36, '#fff6c8', 26);
    this.G.particles.confetti(this.x, this.y, 30);
    AudioFX.fanfare && AudioFX.fanfare();
    Bus.emit('froglet', this);
    Bus.emit('fact', 'froglet');
    setTimeout(() => Bus.emit('fact', 'tongue'), 20000);
  }
  becomeFrog() {
    this.stage = 5; this.state = 'frog'; this.eaten = 0; this.stub = 0;
    Cinematic.play({ follow: () => ({ x: this.x, y: this.y }), zoom: 2.0, duration: 3.2, slow: .45, title: 'A frog!' });
    this.G.particles.sparkle(this.x, this.y, 40, '#fff6c8', 30);
    this.G.particles.confetti(this.x, this.y, 50);
    AudioFX.fanfare && AudioFX.fanfare();
    Bus.emit('frog', this);
    Bus.emit('fact', 'frog');
    setTimeout(() => Bus.emit('fact', 'eyes'), 25000);
  }

  /* ---------- froglet / frog ---------- */
  updateFrog(dt) {
    const inp = this.input, pond = this.G.pond, s = this.scale();
    const mag = Math.hypot(inp.x, inp.y);
    const surf = pond.surfaceAt(this.x);
    const ice = pond.weather.ice;
    this.stub = Math.max(0, this.stub - dt * .006);
    this.updateTongue(dt);
    this.findTarget();
    /* crouch: hold DOWN while perched and still */
    const wantCrouch = this.mode === 'perch' && inp.y > .5 && Math.abs(inp.x) < .3;
    this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * (1 - Math.exp(-dt * 8));

    /* singing / spawning on E */
    if (inp.singPressed && this.singCd <= 0 && !this.tongue.active) {
      if (this.readyFlag && this.spawnNear) { this.layEggs(); return; }
      if (this.stage === 5) this.sing();
    }

    if (this.mode === 'water') {
      const diving = inp.y > .3;
      const atSurf = this.y < surf + 8 * s;
      /* buoyant: drift up to float with the eyes out, unless diving */
      if (!diving && ice < .5) { if (this.y > surf + 4 * s) this.vy -= (inp.y < -.3 ? 520 : 240) * dt; }
      /* frog kicks come in pulses */
      this.kickT -= dt;
      if (mag > .05 && this.kickT <= 0) {
        this.kickT = .5; this.kickAnim = 1;
        const pw = 150 * this.species.speed * (this.stage === 5 ? 1.15 : 1);
        this.vx += inp.x * pw; this.vy += inp.y * pw * .9;
        if (!atSurf) this.G.particles.bubbles(this.x - this.dir * 10 * s, this.y + 6 * s, 2, .7);
        else if (ice < .5 && chance(.5)) pond.disturb(this.x, 5, 1);
      }
      if (inp.actionPressed && !this.tongue.active) {
        if (this.target) this.snap();
        else if (atSurf && ice < .5 && this.hopCd <= 0) { this.leap(this.dir * 150 * this.species.jump, -330 * this.species.jump); this.G.particles.splash(this.x, surf, .9, 12); pond.disturb(this.x, 26, 2); AudioFX.splash && AudioFX.splash(.6, this.x, s); }
        else { this.kickT = .3; this.kickAnim = 1; this.burst = 1; this.vx += this.dir * 200; this.G.particles.bubbles(this.x - this.dir * 10, this.y, 4, .8); AudioFX.burst && AudioFX.burst(this.x); }
      }
      const drag = 1 - Math.min(1, 2.6 * dt);
      this.vx *= drag; this.vy *= drag;
      const sp = Math.hypot(this.vx, this.vy), cap = this.speed() * 1.4 * (1 + this.burst) * (1 + this.fright * .4);
      if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.x += pond.currentAt(this.x, this.y) * dt;
      const top = surf + 3 * s + (ice > .5 ? 12 + ice * 24 : 0);
      if (this.y < top) { this.y = top; if (this.vy < 0) this.vy = 0; }
      const bed = pond.bedY(this.x);
      if (this.y > bed - 8 * s) { this.y = bed - 8 * s; if (this.vy > 0) this.vy = 0; this.vx *= .92; }
      if (Math.abs(this.vx) > 6) this.dir = sign(this.vx);
      if (atSurf && sp > 110 && ice < .5 && chance(dt * 14)) this.G.particles.foam(this.x - this.dir * 12 * s, surf);
      if (this.checkWaterExit(inp)) return;
      /* climbing out: onto a pad, the log, or the bank */
      if (!diving && this.y < surf + 16 * s && ice < .5) {
        const pad = pond.padAt(this.x, surf, 10);
        if (pad && pond.padSize(pad) > 24) { this.perchOn({ kind: 'pad', pad, y: pad.y - 3 }); return; }
        if (pond.onLog(this.x) && this.y < pond.logTop(this.x) + 30) { this.perchOn({ kind: 'log', y: pond.logTop(this.x) }); return; }
      }
      if (Math.abs(this.x) > pond.wetW() - 26 && this.y < surf + 40 && (inp.x * sign(this.x) > .2 || !diving)) { this.x = sign(this.x) * (pond.wetW() + 10); this.perchOn({ kind: 'land', y: pond.bedY(this.x) }); return; }
      if (Math.abs(this.x) > pond.wetW() - 12) { this.x = sign(this.x) * (pond.wetW() - 12); this.vx = 0; }
      /* wrigglers by mouth while swimming */
      if (this.canEat() && !this.tongue.active) {
        const m = this.mouth();
        const w = this.G.wrigglers.nearest(m.x, m.y, 12 + s * 8);
        if (w && w.dive < .7) { w.caught = true; this.G.wrigglers.remove(w); this.eat('wriggler', 1, w.x, w.y + 8); this.stats.wrigglers++; }
      }
      this.wasDeep = this.y > 165;
      /* special spots */
      this.mudNear = pond.season === 'winter' && this.stage === 5 && this.species.special !== 'freeze' && dist(this.x, this.y, pond.mudSpot.x, pond.mudSpot.y) < 70;
      this.spawnNear = this.readyFlag && pond.spawnSpots.some(sp2 => dist(this.x, this.y, sp2.x, sp2.y) < 90);
      this.litterNear = false;
      if (this.mudNear && inp.actionPressed && !this.tongue.active) { this.hibernate('mud'); return; }
    }
    else if (this.mode === 'perch') {
      const p = this.perch;
      if (p.kind === 'pad') {
        const pad = p.pad;
        if (pond.padSize(pad) < 22 || pad.health < .15) { this.mode = 'water'; this.perch = null; this.y = pond.surfaceAt(this.x) + 6; this.G.particles.splash(this.x, this.y, .5, 6); return; }
        pad.weight = Math.max(pad.weight, this.stage === 5 ? 1 : .6);
        this.y = pad.y - 3 + Math.abs(this.x - pad.x) * pad.tilt;
        this.x += pad.vx * dt;
      } else if (p.kind === 'log') this.y = pond.logTop(this.x);
      else this.y = pond.bedY(this.x);
      /* walking off the end of the bank: overland to the next pond */
      if (p.kind === 'land' && this.id === 1 && Math.abs(this.x) > pond.W + 560 && !this.travelCd) {
        const dest = Places.overland(pond.place.key, sign(this.x));
        this.travelCd = 4;
        if (dest) { if ((pond.weather.rain > .3 && this.G.night > .4) || this.G.settings.anytravel || this.G.settings.difficulty === 'easy') Bus.emit('wantTravel', this, dest); else Bus.emit('travelRefused', this, dest); }
      }
      this.vx = 0; this.vy = 0;
      this.mudNear = false; this.spawnNear = false;
      this.litterNear = pond.season === 'winter' && this.stage === 5 && this.species.special === 'freeze' && dist(this.x, this.y, pond.litterSpot.x, pond.litterSpot.y) < 70;
      if (this.crouch < .5 && this.hopCd <= 0) {
        if (inp.actionPressed && !this.tongue.active) {
          if (this.litterNear) { this.hibernate('litter'); return; }
          if (this.target) this.snap();
          else this.leap(this.dir * 250 * this.species.jump, -330 * this.species.jump);
        }
        else if (Math.abs(inp.x) > .4) { this.dir = sign(inp.x); this.leap(this.dir * 150 * this.species.jump, -230 * this.species.jump); }
        else if (inp.y < -.4) this.leap(this.dir * 70 * this.species.jump, -380 * this.species.jump);
      }
    }
    else if (this.mode === 'cling') {
      this.vx = this.vy = 0;
      this.y = this.cling.y + Math.sin(this.G.time * 1.1) * 3;
      this.x = this.cling.x + this.dir * -2;
      if (inp.actionPressed && !this.tongue.active) { if (this.target) this.snap(); else this.leap(this.dir * 200, -200); }
      else if (Math.abs(inp.x) > .4) { this.dir = sign(inp.x); this.leap(this.dir * 160, -140); }
      else if (inp.y > .4) { this.leap(this.dir * 40, 40); }
    }
    else if (this.mode === 'air') {
      this.vy += 900 * dt;
      this.vx += inp.x * 140 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.abs(this.vx) > 10) this.dir = sign(this.vx);
      if (inp.actionPressed && this.target && !this.tongue.active) this.snap();
      if (this.vy > 0) {
        const pad = pond.padAt(this.x, surf, 4);
        if (pad && pond.padSize(pad) > 24 && this.y >= pad.y - 6) { this.perchOn({ kind: 'pad', pad, y: pad.y - 3 }, true); return; }
        if (pond.onLog(this.x) && this.y >= pond.logTop(this.x) - 2) { this.perchOn({ kind: 'log', y: pond.logTop(this.x) }, true); return; }
        if ((pond.isLand(this.x) || Math.abs(this.x) >= pond.wetW()) && this.y >= pond.bedY(this.x)) { this.perchOn({ kind: 'land', y: pond.bedY(this.x) }, true); return; }
        if (this.species.special === 'cling') { for (const c of pond.clingReeds) if (Math.abs(this.x - c.x) < 22 && this.y > c.y - 30 && this.y < c.y + 60) { this.mode = 'cling'; this.cling = c; this.dir = -c.side; AudioFX.hop && AudioFX.hop(); Bus.emit('clung', this); return; } }
        if (!pond.isLand(this.x) && this.y >= surf - 2) {
          if (ice > .5) { this.perchOn({ kind: 'ice', y: -ice * 6 }, true); return; }
          this.mode = 'water'; this.perch = null;
          const pw = clamp(this.vy / 400, .3, 1.6);
          this.G.particles.splash(this.x, surf, pw, 10 + pw * 8, this.vx); pond.disturb(this.x, 18 * pw + 8, 2);
          AudioFX.splash && AudioFX.splash(pw, this.x, s);
          this.vy *= .35; this.vx *= .6;
          Bus.emit('landedWater', this);
        }
      }
      if (this.x < pond.bounds.left + 120) { this.x = pond.bounds.left + 120; this.vx = Math.abs(this.vx); }
      if (this.x > pond.bounds.right - 120) { this.x = pond.bounds.right - 120; this.vx = -Math.abs(this.vx); }
    }
    if (this.perch && this.perch.kind === 'ice') {
      this.mode = 'perch';
      this.y = -pond.weather.ice * 6;
      if (pond.weather.ice < .5) { this.mode = 'water'; this.perch = null; }
    }
    /* grow */
    if (this.stage === 4 && this.eaten >= this.need()) { this.becomeFrog(); return; }
    if (this.stage === 5 && !this.readyFlag && this.eaten >= this.need() && pond.season !== 'winter') { this.readyFlag = true; Bus.emit('readyEggs', this); }
  }

  perchOn(p, landed = false) {
    const pond = this.G.pond;
    const from = this.mode;
    this.mode = 'perch'; this.perch = p; this.vx = 0; this.vy = 0; this.y = p.y;
    if (p.kind === 'pad') {
      p.pad.weight = 1; p.pad.sink += 4;
      pond.disturb(p.pad.x, landed ? 22 : 10, 3);
      this.G.particles.ripple(this.x, p.pad.y, landed ? 1.2 : .6);
      this.stats.pads.add(p.pad);
      Bus.emit('landedPad', this, p.pad);
      if (!this.firsts.pad) { this.firsts.pad = true; Bus.emit('fact', 'lilypad'); }
    } else if (from === 'water') {
      Bus.emit('climbedOut', this);
    }
    if (landed) { this.landT = 1; AudioFX.hop && AudioFX.hop(this.x); Bus.emit('landed', this, p.kind); }
    else { AudioFX.climb && AudioFX.climb(this.x); }
  }
  leap(vx, vy) {
    this.mode = 'air'; this.perch = null; this.cling = null;
    this.vx = vx; this.vy = vy; this.hopCd = .25; this.kickAnim = 1; this.crouch = 0;
    this.stats.hops++;
    AudioFX.jump && AudioFX.jump(this.x);
    Bus.emit('hop', this);
    if (!this.firsts.hop) { this.firsts.hop = true; Cinematic.play({ follow: () => ({ x: this.x, y: this.y }), zoom: 1.6, duration: 2.2, slow: .45, title: 'First hop!' }); }
  }

  /* ---------- tongue ---------- */
  findTarget() {
    this.target = null; this.targetKind = null;
    if (this.tongue.active || !this.canEat()) return;
    const m = this.mouth(), r = this.reach();
    const surf = this.G.pond.surfaceAt(this.x);
    const b = this.G.bugs.nearest(m.x, m.y, r);
    let best = null, kind = null, bd = 1e9;
    if (b && (this.mode !== 'water' || this.y < surf + 10 * this.scale())) { best = b; kind = 'bug'; bd = dist(m.x, m.y, b.x, b.y); }
    const w = this.G.wrigglers.nearest(m.x, m.y, r * .7);
    if (w && w.dive < .7 && (this.mode === 'water' || this.mode === 'perch')) { const d = dist(m.x, m.y, w.x, w.y + 8); if (d < bd) { best = w; kind = 'wriggler'; } }
    this.target = best; this.targetKind = kind;
  }
  snap() {
    const t = this.target; if (!t) return;
    this.tongue = { active: true, t: 0, len: 0, dy: 0, target: t, kind: this.targetKind, grabbed: false };
    t.caught = true;
    const m = this.mouth();
    this.dir = sign(t.x - this.x) || this.dir;
    this.tongue.len = dist(m.x, m.y, t.x, t.y + (this.targetKind === 'wriggler' ? 8 : 0));
    this.tongue.dy = (t.y + (this.targetKind === 'wriggler' ? 8 : 0)) - m.y;
    this.stats.snaps++;
    AudioFX.snap && AudioFX.snap(this.x);
    Bus.emit('snap', this);
    if (!this.firsts.snap) { this.firsts.snap = true; Cinematic.play({ follow: () => ({ x: this.x, y: this.y }), zoom: 2.6, duration: 1.8, slow: .25, title: 'Snap!' }); }
  }
  updateTongue(dt) {
    const tg = this.tongue;
    if (!tg.active) return;
    tg.t += dt / .3;
    const t = tg.target;
    if (tg.t >= .45 && !tg.grabbed) { tg.grabbed = true; this.G.particles.puff(t.x, t.y, 'rgba(255,255,255,.7)', 4); }
    if (tg.grabbed && t) { const m = this.mouth(); const k = clamp((tg.t - .45) / .55, 0, 1); const tipX = m.x + this.dir * tg.len * (1 - k), tipY = m.y + tg.dy * (1 - k); t.x = tipX; t.y = tipY - (tg.kind === 'wriggler' ? 8 : 0); }
    if (tg.t >= 1) {
      tg.active = false;
      const worth = tg.kind === 'wriggler' ? 1 : BUG_KINDS[t.kind].worth;
      if (tg.kind === 'wriggler') { this.G.wrigglers.remove(t); this.stats.wrigglers++; }
      else { this.G.bugs.remove(t); if (t.kind === 'dragonfly') this.stats.dragonflies++; }
      const m = this.mouth();
      this.G.cam.punch = .6;
      this.eat(tg.kind === 'wriggler' ? 'wriggler' : t.kind, worth, m.x, m.y);
      this.stats.quick = this.stats.quick.filter(x => this.G.time - x < 12);
    }
  }

  /* ---------- singing ---------- */
  sing() {
    this.throat = 1; this.singCd = 1.3; this.stats.sang++;
    AudioFX.ribbit && AudioFX.ribbit(this.species.call, 1, this.x);
    for (let i = 0; i < 3; i++) this.G.particles.note(this.x + this.dir * 12, this.y - 20 - i * 6, '#fff3b0');
    if (this.inWater()) { this.G.pond.disturb(this.x, 6, 2); }
    Bus.emit('sing', this);
  }

  /* ---------- eggs ---------- */
  layEggs() {
    this.state = 'laying'; this.timer = 0; this.vx = this.vy = 0;
    Cinematic.play({ follow: () => ({ x: this.x, y: this.y }), zoom: 2.2, duration: 3.4, slow: .5, title: 'Laying eggs' });
    AudioFX.eggs && AudioFX.eggs();
    Bus.emit('layingStart', this);
  }
  updateLaying(dt) {
    this.timer += dt;
    this.y += Math.sin(this.G.time * 2) * 2 * dt;
    if (chance(dt * 4)) this.G.particles.bubbles(this.x - this.dir * 16, this.y + 4, 1, .5);
    if (this.timer >= 3.2) {
      const spot = this.G.pond.spawnSpots.reduce((a, b) => dist(this.x, this.y, a.x, a.y) < dist(this.x, this.y, b.x, b.y) ? a : b);
      const mass = { x: spot.x, y: spot.y, count: 16, seed: rndInt(1, 999), dev: 0, hatch: 0, laidAt: this.G.time, side: spot.side, string: this.species.eggs === 'string', species: this.species.key };
      this.G.eggMasses.push(mass);
      this.G.lastMass = mass;
      this.eaten = 0; this.readyFlag = false; this.state = 'frog'; this.mode = 'water';
      this.G.particles.sparkle(spot.x, spot.y, 30, '#dff6ff', 24);
      Bus.emit('eggsLaid', mass, this);
      Bus.emit('fact', 'eggs');
    }
  }

  /* ---------- winter ---------- */
  hibernate(kind) {
    const pond = this.G.pond;
    this.hibKind = kind; this.state = 'hibernating'; this.timer = 0; this.vx = this.vy = 0; this.crouch = 1; this.perch = null; this.cling = null;
    if (kind === 'mud') { this.x = pond.mudSpot.x; this.y = pond.mudSpot.y + 6; this.mode = 'water'; }
    else { this.x = pond.litterSpot.x; this.y = pond.litterSpot.y; this.mode = 'perch'; this.perch = { kind: 'land', y: this.y }; }
    this.stats.hibernations++;
    Cinematic.play({ x: this.x, y: this.y - 10, zoom: 2.2, duration: 3.6, slow: .4, title: kind === 'mud' ? 'Sleep under the ice' : 'Frozen solid' });
    this.G.particles.puff(this.x, this.y, kind === 'mud' ? 'rgba(90,70,40,.6)' : 'rgba(220,240,255,.8)', 12);
    AudioFX.sleep && AudioFX.sleep(this.x);
    Bus.emit('hibernate', this, kind);
    Bus.emit('fact', kind === 'mud' ? 'winter' : 'frogsicle');
  }
  updateHibernating(dt) {
    this.timer += dt;
    const pond = this.G.pond;
    if (this.hibKind === 'mud') { this.y = pond.mudSpot.y + 6; if (chance(dt * .15)) this.G.particles.bubbles(this.x, this.y - 4, 1, .5); }
    else this.y = pond.litterSpot.y;
  }
  wake() {
    if (this.state !== 'hibernating') return;
    this.state = 'frog'; this.crouch = 0; this.timer = 0;
    if (this.hibKind === 'mud') { this.mode = 'water'; this.vy = -80; this.G.particles.bubbles(this.x, this.y, 8, 1); }
    else { this.mode = 'perch'; this.perch = { kind: 'land', y: this.G.pond.litterSpot.y }; this.G.particles.sparkle(this.x, this.y, 20, '#dff6ff', 16); }
    AudioFX.wake && AudioFX.wake(this.x);
    Bus.emit('wake', this);
    Bus.emit('fact', 'spring');
  }

  /* ---------- a fright ---------- */
  frightened(fx, fy, kind) {
    this.fright = 1; this.stats.frights++;
    this.crouch = 0; this.grazing = null;
    if (this.tongue.active) { this.tongue.active = false; if (this.tongue.target) this.tongue.target.caught = false; }
    const away = sign(this.x - fx) || (chance(.5) ? -1 : 1);
    if (this.inWater() || this.isTadpole()) { this.vx = away * 300; this.vy = 220; this.G.particles.bubbles(this.x, this.y, 8, 1); }
    else { this.mode = 'air'; this.perch = null; this.cling = null; this.vx = away * 220; this.vy = -260; }
    this.G.cam.shake = .8;
    this.G.particles.ring(this.x, this.y, 'rgba(255,120,80,.8)', 10, 260, .5);
    this.G.particles.text(this.x, this.y - 30, 'Eek!', '#ff9a7a', 20);
    AudioFX.bump && AudioFX.bump(this.x);
    Bus.emit('fright', this, kind);
  }

  /* ---------- save / restore ---------- */
  serialize() {
    return {
      species: this.species.key, stage: this.stage, state: this.state === 'morphing' ? 'tadpole' : this.state === 'laying' ? 'frog' : this.state, mode: this.mode === 'air' ? 'water' : this.mode,
      x: +this.x.toFixed(1), y: +this.y.toFixed(1), dir: this.dir, eaten: this.eaten, total: this.total, readyFlag: this.readyFlag,
      legs: +this.legs.toFixed(2), arms: +this.arms.toFixed(2), tail: +this.tail.toFixed(2), tailT: +this.tailT.toFixed(3), stub: +this.stub.toFixed(2), air: +this.air.toFixed(2),
      eggSpot: this.eggSpot, hibKind: this.hibKind, hatchProg: this.hatchProg, firsts: this.firsts, perchKind: this.perch ? this.perch.kind : null,
      stats: Object.assign({}, this.stats, { pads: this.stats.pads.size, quick: [] })
    };
  }
  restore(o) {
    this.species = SPECIES[o.species] || this.species;
    this.stage = o.stage; this.state = o.state; this.mode = o.mode || 'water';
    this.x = o.x; this.y = o.y; this.dir = o.dir || 1; this.ang = this.dir > 0 ? 0 : Math.PI;
    this.eaten = o.eaten || 0; this.total = o.total || 0; this.readyFlag = !!o.readyFlag;
    this.legs = o.legs || 0; this.arms = o.arms || 0; this.tail = o.tail === undefined ? 1 : o.tail; this.tailT = o.tailT || 0; this.stub = o.stub || 0; this.air = o.air === undefined ? 1 : o.air;
    this.eggSpot = o.eggSpot; this.hibKind = o.hibKind || null; this.hatchProg = o.hatchProg || 0; this.firsts = o.firsts || {};
    if (o.stats) { const pads = o.stats.pads; Object.assign(this.stats, o.stats); this.stats.pads = new Set(); this.stats.quick = []; this.stats._padCount = pads || 0; }
    if (this.state === 'hibernating') { if (this.hibKind === 'litter') { this.mode = 'perch'; this.perch = { kind: 'land', y: this.y }; } }
    else if (this.mode === 'perch') { const pond = this.G.pond; const p = pond.perchAt(this.x, this.y); if (p) this.perch = p; else { this.mode = 'water'; this.perch = null; } }
    else if (this.mode === 'cling') { const pond = this.G.pond; this.cling = pond.clingReeds.reduce((a, b) => Math.abs(a.x - this.x) < Math.abs(b.x - this.x) ? a : b); }
  }
}
