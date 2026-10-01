/* ============================================================
   player.js — the alicorn you are
   ============================================================
   `x, y` is where the hooves touch (the feet), so landing means
   y reaches a surface.  States: ground | air | talking.
   On the ground she walks, gallops, jumps, sits and sleeps.  In
   the air she flaps (hold FLY), glides, dives and dashes.
   Horn magic (E) talks to a friend if one is close, otherwise it
   casts a sparkle that wakes flowers, lights crystals, lifts
   fallen stars and cheers up storm clouds.
   ============================================================ */
'use strict';

class Alicorn {
  constructor(G, look, id = 1) {
    this.G = G; this.id = id;
    this.look = look;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.dir = 1;
    this.state = 'ground';
    this.surface = null;
    this.walk = 0; this.gallop = 0; this.holdT = 0;
    this.fly = 0; this.open = 0; this.flap = 0; this.pitch = 0;
    this.sit = 0; this.sitT = 0; this.sleep = false; this.zzT = 0;
    this.blink = 0; this.blinkT = rnd(2, 5); this.mouth = 0; this.happy = 0;
    this.magicT = 0; this.magicCd = 0;
    this.dashT = 0; this.sparkle = .5;
    this.trail = [];
    this.stepT = 0; this.squash = 0;
    this.passenger = null;
    this.prevX = 0;
    this.combo = 0; this.comboT = 0;
    this.zone = null; this.skyZone = null; this.onMoon = false; this.onWater = false;
    this.airT = 0; this.groundT = 0; this.glitterT = 0;
    this.skate = 0; this.diveT = 0; this.breathT = 0; this.prevVx = 0; this.prevVy = 0;
    this.hair = { tx: 0, ty: 0, mx: 0, my: 0, vtx: 0, vty: 0, vmx: 0, vmy: 0 };
    this.input = { x: 0, y: 0, fly: false, flyPressed: false, magicPressed: false, dashPressed: false };
    this.stats = { stars: 0, flights: 0, dashes: 0, butterflies: 0, cloudsCheered: 0, flowers: 0, distance: 0, moon: 0, water: 0, sleeps: 0, nightFly: 0, cloudLandings: 0, maxHeight: 0, talked: [] };
  }

  get diff() { return DIFFICULTY[this.G.settings.difficulty] || DIFFICULTY.normal; }
  get talking() { return !!(Dialog.active && Dialog.active.player === this); }
  cameraZoom() {
    if (this.talking) return 1.35;
    if (this.state === 'air') return this.dashT > 0 ? .78 : this.y < -2900 ? .78 : this.y < -1400 ? .82 : .88;
    if (this.state === 'swim') return .95;
    if (this.sit > .5) return 1.3;
    return lerp(1.15, 1.0, this.gallop);
  }
  placeAt(x, y) { this.x = x; this.y = y === undefined ? this.G.world.standY(x) : y; this.prevX = x; this.state = 'ground'; this.surface = this.G.world.surfaceBelow(x, this.y, 30); this.vx = this.vy = 0; }

  /* ---------- per frame ---------- */
  update(dt) {
    const inp = this.input, W = this.G.world, P = this.G.particles;
    this.prevX = this.x;
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blinkT = rnd(2, 6); this.blink = 1; }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.happy = Math.max(0, this.happy - dt); this.mouth = this.talking ? .3 + .3 * Math.abs(Math.sin(this.G.time * 12)) : Math.max(0, this.mouth - dt * 3);
    this.magicT = Math.max(0, this.magicT - dt); this.magicCd = Math.max(0, this.magicCd - dt);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    this.sparkle = Math.min(1, this.sparkle + dt * .035);
    this.updateTrail(dt);

    if (this.talking) {
      if (inp.magicPressed || inp.flyPressed) Dialog.next();
      this.vx *= 1 - dt * 6;
      const who = Dialog.active && Dialog.active.who;
      if (this.state === 'ground' && who && Math.abs(who.x - this.x) < 125 && who.home !== 'branch') { const want = who.x - this.dir * 125; this.x += (want - this.x) * (1 - Math.exp(-dt * 5)); this.walk += dt * 6; }
      if (this.state === 'ground') this.followGround(dt); else if (this.state === 'swim') { this.vx *= 1 - dt * 3; this.vy *= 1 - dt * 3; this.walk += dt * 2; } else this.updateAir(dt, true);
      this.updateHair(dt);
      inp.magicPressed = inp.flyPressed = inp.dashPressed = false;
      return;
    }

    /* magic / talk */
    if (inp.magicPressed && this.magicCd <= 0) {
      const f = this.G.friends.nearest(this.x, this.y - 20, 170);
      const fd = f ? dist(f.x, f.y - 20, this.x, this.y - 20) : Infinity;
      const md = this.G.world.magicTargetDist(this.x + this.dir * 48, this.y - 74);
      const foal = this.G.foal;
      const canTalk = this.state === 'ground' || this.state === 'swim';
      if (f && (canTalk || f.state === 'following') && Quests.bubble(f.key)) this.talk(f);
      else if (foal && foal.adopted && canTalk && foal.near(this, 150) && md > 120) { this.magicCd = .5; Bus.emit('foalCare', this, foal); }
      else if (f && canTalk && fd < md) this.talk(f);
      else this.cast();
    }
    /* auto-talk when bumping into a friend who has something to say */
    if (this.state === 'ground' && Math.abs(this.vx) > 5) {
      const f = this.G.friends.nearest(this.x, this.y - 20, 105);
      const b = f && Quests.bubble(f.key);
      if (f && f.talkCd <= 0 && b && b !== '★') this.talk(f);
    }
    if (inp.dashPressed && this.dashT <= 0 && this.sparkle >= .25) this.dash();

    if (this.state === 'ground') this.updateGround(dt); else if (this.state === 'swim') this.updateSwim(dt); else this.updateAir(dt, false);
    this.updateHair(dt);
    this.collect(dt);
    this.trackPlace();
    this.stats.distance += Math.abs(this.x - this.prevX);
    inp.magicPressed = inp.flyPressed = inp.dashPressed = false;
  }

  /* ---------- on the ground ---------- */
  updateGround(dt) {
    const inp = this.input, W = this.G.world, P = this.G.particles;
    this.groundT += dt; this.airT = 0;
    const mag = Math.abs(inp.x);
    const onWater = this.surface && this.surface.kind === 'water';
    if (onWater && inp.y > .6 && W.canDive(this.x)) { this.diveT += dt; if (this.diveT > .25) { this.dive(); return; } } else this.diveT = 0;
    const wantSit = inp.y > .6 && mag < .3 && Math.abs(this.vx) < 8 && !inp.fly && !onWater;
    /* sitting and sleeping */
    if (wantSit) { this.sitT += dt; } else { this.sitT = 0; if (this.sleep && (mag > .3 || inp.fly || inp.y < -.3)) { this.sleep = false; Bus.emit('wake', this); } }
    this.sit = approach(this.sit, wantSit || this.sleep ? 1 : 0, dt * 3);
    if (this.sit > .9 && !this.sleep) { if (this.sitT === dt) Bus.emit('sit', this); if (this.sitT > 5 && this.G.night > .5) { this.sleep = true; this.stats.sleeps++; Bus.emit('sleep', this); } }
    if (this.sleep) { this.zzT -= dt; if (this.zzT <= 0) { this.zzT = 1.2; P.zz(this.x + this.dir * 40, this.y - 60); } this.blink = 1; }
    if (this.sit > .3) { this.vx *= 1 - dt * 8; this.followGround(dt); this.walk = 0; this.gallop = 0; return; }

    /* walking and galloping */
    const speedK = this.G.settings.slowmo ? .7 : 1;
    const onIce = this.surface && this.surface.kind === 'ice';
    this.skate = approach(this.skate, onIce && Math.abs(this.vx) > 30 ? 1 : 0, dt * 4);
    const grip = onIce ? 260 : 900, slide = onIce ? 70 : 900;
    if (mag > .15) {
      this.holdT += dt; this.dir = sign(inp.x);
      const want = this.holdT > .7 ? 1 : 0;
      this.gallop = approach(this.gallop, onIce ? 0 : want, dt * 2.2);
      const target = inp.x * (onIce ? 380 : lerp(150, 330, this.gallop)) * speedK * (this.dashT > 0 ? 2 : 1);
      this.vx = approach(this.vx, target, dt * grip);
    } else {
      this.holdT = 0; this.gallop = approach(this.gallop, 0, dt * 3);
      this.vx = approach(this.vx, 0, dt * slide);
    }
    if (onIce && Math.abs(this.vx) > 120 && chance(dt * 10)) this.G.particles.sparkle(this.x - this.dir * 10, this.y - 2, 1, '#e6f6ff', 6);
    if (this.dashT > 0) { this.vx = this.dir * 640 * speedK; }
    this.x += this.vx * dt;
    this.x = clamp(this.x, W.bounds.left + 40, W.bounds.right - 40);
    const moving = Math.abs(this.vx) > 4;
    if (moving) {
      this.walk += dt * Math.abs(this.vx) * lerp(.075, .05, this.gallop) * (1 - this.skate * .85);
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = lerp(.28, .17, this.gallop); this.hoofStep(); }
    } else this.walk = 0;
    this.open = approach(this.open, this.gallop > .8 ? .35 : 0, dt * 3);
    this.fly = approach(this.fly, 0, dt * 4);

    /* jump / take off */
    if (inp.flyPressed || (inp.y < -.6 && !this.wasUp)) {
      this.vy = inp.fly ? -300 : -380;
      this.state = 'air'; this.surface = null; this.airT = 0;
      this.G.particles.dust(this.x, this.y, this.dir);
      if (inp.fly) { this.stats.flights++; Bus.emit('takeoff', this); AudioFX.flap(); } else { AudioFX.jump(); Bus.emit('jump', this); }
      this.wasUp = true;
      return;
    }
    this.wasUp = inp.y < -.6;
    /* walked off the edge of a cloud / the moon? */
    if (!W.onSurface(this.surface, this.x)) { const s = W.surfaceBelow(this.x, this.y, 24); if (s && Math.abs(s.y - this.y) < 24) { this.surface = s; } else { this.state = 'air'; this.surface = null; this.vy = 0; return; } }
    this.followGround(dt);
    if (moving && this.onWater && chance(dt * 8)) this.G.particles.ripple(this.x, this.y);
  }

  followGround(dt) {
    const W = this.G.world;
    if (!this.surface) this.surface = W.surfaceBelow(this.x, this.y, 40) || W.surfacesAt(this.x)[0];
    const sy = W.surfaceY(this.surface, this.x);
    this.y += (sy - this.y) * (1 - Math.exp(-dt * 18));
    this.onWater = this.surface.kind === 'water' || this.surface.kind === 'ice'; this.onMoon = this.surface.kind === 'moon';
    this.pitch = approach(this.pitch, Math.atan(W.slope(this.x)) * (this.surface.kind === 'ground' ? .7 : 0), dt * 3);
  }

  hoofStep() {
    const P = this.G.particles;
    if (this.surface && this.surface.kind === 'ice') { AudioFX.skate && AudioFX.skate(); }
    else if (this.onWater) { P.splash(this.x, this.y, 4, .5); AudioFX.step(true, this.gallop); }
    else { if (this.gallop > .5) P.dust(this.x, this.y, this.dir); AudioFX.step(false, this.gallop, this.surface && this.surface.kind === 'cloud'); }
    if (this.look.wear && this.look.wear.includes('boots')) P.sparkle(this.x, this.y - 4, 2, '#fff2a8', 6);
  }

  /* ---------- in the air ---------- */
  updateAir(dt, frozen) {
    const inp = this.input, W = this.G.world, P = this.G.particles, easy = this.G.settings.difficulty === 'easy';
    this.airT += dt; this.groundT = 0;
    this.sit = 0; this.sleep = false;
    const thrust = !frozen && (inp.fly || inp.y < -.5);
    const gravity = 780;
    if (thrust) {
      this.vy -= 1500 * dt;
      if (this.vy < -330) this.vy = -330;
      this.flap += dt * 13;
      if (chance(dt * 6)) P.puff(this.x - this.dir * 20, this.y - 30, 'rgba(255,255,255,.35)', 1, 20);
    } else {
      this.vy += gravity * dt;
      const gliding = Math.abs(this.vx) > 60 || easy;
      const cap = inp.y > .5 ? 560 : gliding ? (easy ? 120 : 170) : (easy ? 220 : 380);
      if (this.vy > cap) this.vy = approach(this.vy, cap, dt * 900);
      this.flap += dt * (gliding ? 4 : 7);
    }
    if (!frozen) {
      const target = inp.x * (this.dashT > 0 ? 640 : 300);
      if (Math.abs(inp.x) > .15) { this.dir = sign(inp.x); this.vx = approach(this.vx, target, dt * 700); }
      else this.vx *= 1 - Math.min(1, dt * 1.6);
      if (this.dashT > 0) { this.vx = this.dir * 640; this.vy *= 1 - Math.min(1, dt * 4); }
    }
    /* wind from the weather */
    this.vx += Math.sin(this.G.time * .4) * W.weather.gust * 40 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, W.bounds.left + 40, W.bounds.right - 40);
    if (this.y < W.bounds.top + 80) { this.y = W.bounds.top + 80; this.vy = Math.max(0, this.vy); }
    this.fly = approach(this.fly, 1, dt * 5); this.open = approach(this.open, 1, dt * 6);
    this.pitch = approach(this.pitch, clamp(this.vy / 900, -.3, .35) - (thrust ? .12 : 0), dt * 4);
    this.stats.maxHeight = Math.max(this.stats.maxHeight, -this.y);
    if (this.G.night > .5) this.stats.nightFly += dt;
    if (this.airT > .5 && this.stepT !== -1) { }
    /* landing */
    if (this.vy >= 0 && this.airT > .15) {
      const s = W.surfaceBelow(this.x, this.y, 10);
      if (s && this.y >= s.y - 2) this.land(s);
    }
  }

  land(s) {
    const W = this.G.world, P = this.G.particles;
    const hard = this.vy > 260;
    this.y = s.y; this.state = 'ground'; this.surface = s;
    this.squash = hard ? 1 : .4; this.vy = 0;
    this.onWater = s.kind === 'water'; this.onMoon = s.kind === 'moon';
    if (Math.abs(this.vx) > 200) this.gallop = 1;
    this.hair.vty += 90; this.hair.vmy += 60;
    if (s.kind === 'ice') { P.sparkle(this.x, this.y, 10, '#e6f6ff', 20); AudioFX.skate && AudioFX.skate(); this.stats.skated = (this.stats.skated || 0) + 1; Bus.emit('skate', this); }
    else if (s.kind === 'water') { P.splash(this.x, this.y, 14, 1); AudioFX.splash(); if (!this.stats.water) { Bus.emit('waterWalk', this); } this.stats.water++; }
    else if (s.kind === 'cloud') { P.puff(this.x, this.y, 'rgba(255,255,255,.8)', 10, 50); AudioFX.land(true); this.stats.cloudLandings++; }
    else if (s.kind === 'moon') { P.puff(this.x, this.y, 'rgba(230,220,170,.7)', 10, 40); AudioFX.land(false); this.stats.moon++; Bus.emit('moonLanded', this); }
    else { P.dust(this.x, this.y, this.dir); AudioFX.land(false); }
    Bus.emit('landed', this, s.kind);
  }

  /* ---------- actions ---------- */
  talk(friend) {
    this.vx = 0; this.dir = sign(friend.x - this.x) || this.dir;
    friend.dir = -this.dir;
    if (!this.stats.talked.includes(friend.key)) this.stats.talked.push(friend.key);
    AudioFX.talk(friend.def.kind);
    Quests.talkTo(friend, this);
  }
  cast() {
    const W = this.G.world, P = this.G.particles;
    this.magicT = .9; this.magicCd = .5;
    const hx = this.x + this.dir * 48, hy = this.y - 74;
    const range = this.G.settings.difficulty === 'easy' ? 240 : 175;
    P.sparkle(hx, hy, 26, '#fff2b0', 30);
    P.ring(hx, hy, 'rgba(255,230,150,.8)', 8, range * 2.2, .5);
    AudioFX.magic();
    Bus.emit('magic', this);
    const foal = this.G.foal;
    if (foal && foal.state === 'lost' && dist(foal.x, foal.y - 30, hx, hy) < range + 60) foal.befriend(this);
    const hits = W.magicAt(hx, hy, range);
    for (const h of hits) {
      P.sparkle(h.x, h.y, 14, h.kind === 'crystalLit' || h.kind === 'crystalGlow' ? '#bff4ff' : '#fff6c8', 14);
      if (h.kind === 'flowerBloomed' || h.kind === 'flowerMagic') { P.petals(h.x, h.y, 6); this.stats.flowers++; AudioFX.bloom(); }
      if (h.kind === 'crystalLit' || h.kind === 'crystalGlow') AudioFX.crystal();
      if (h.kind === 'starLifted') { P.starBurst(h.x, h.y, 10); AudioFX.starUp(); }
      if (h.kind === 'shellOpened') { P.sparkle(h.x, h.y, 20, '#fffaf0', 20); AudioFX.crystal(); }
      if (h.kind === 'applesShaken') { AudioFX.bloom(); }
      if (h.kind === 'cloudCheered') { P.hearts(h.x, h.y, 8); P.confetti(h.x, h.y, 24, 160); this.stats.cloudsCheered++; AudioFX.cheer(); }
      Bus.emit(h.kind, this, h);
    }
    if (!hits.length && this.G.settings.reading) { /* nothing nearby: a little fizzle */ P.text(hx, hy - 20, '✨', '#fff', 14); }
  }
  dash() {
    this.dashT = 1.1; this.sparkle -= .25; this.stats.dashes++;
    if (this.state === 'ground' && this.input.fly) { this.state = 'air'; this.surface = null; this.vy = -120; }
    this.G.particles.starBurst(this.x, this.y - 30, 10, '#fff', 120);
    AudioFX.dash();
    Bus.emit('dash', this);
  }
  updateTrail(dt) {
    this.dashT = Math.max(0, this.dashT - dt);
    const glitter = this.look.wear && this.look.wear.includes('glitter');
    if (this.dashT > 0 || (glitter && (Math.abs(this.vx) > 40 || this.state === 'air'))) {
      this.trail.push({ x: this.x - this.dir * 20, y: this.y - 34, t: 0, rainbow: this.dashT > 0 });
      if (glitter && chance(dt * 12)) this.G.particles.sparkle(this.x - this.dir * 30, this.y - 30, 2, pick(RAINBOW), 12);
    }
    for (const p of this.trail) p.t += dt;
    while (this.trail.length && this.trail[0].t > 1.1) this.trail.shift();
    if (this.trail.length > 90) this.trail.splice(0, this.trail.length - 90);
  }

  /* stars, gems, rings, constellation */
  collect(dt) {
    const W = this.G.world, P = this.G.particles;
    const cx = this.x, cy = this.y - 34;
    for (const s of W.stars) {
      if (s.taken || Math.abs(s.x - cx) > 60 || Math.abs(s.y - cy) > 60) continue;
      if (dist(s.x, s.y, cx, cy) < 46) {
        s.taken = true; s.timer = STAR_RESPAWN;
        this.G.stars++; this.stats.stars++; this.sparkle = Math.min(1, this.sparkle + .12); this.happy = 1;
        this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 1.6;
        P.starBurst(s.x, s.y, 8, '#ffe14a', 120); P.text(s.x, s.y - 16, '+1', '#fff29a', 14);
        AudioFX.star(this.combo);
        Bus.emit('star', this, this.combo);
      }
    }
    for (const g of W.gems) {
      if (!g.shown || g.taken || dist(g.x, g.y, cx, cy) > 52) continue;
      g.taken = true; g.shown = false;
      P.starBurst(g.x, g.y, 16, g.col, 200); P.confetti(g.x, g.y, 30, 200); P.text(g.x, g.y - 20, g.name + ' gem!', g.col, 16);
      AudioFX.gem(g.idx);
      Bus.emit('gem', this, g);
    }
    for (const s of W.shells) {
      if (s.state !== 'open' || s.t < .5 || dist(s.x, s.y - 8, cx, cy) > 70) continue;
      s.state = 'taken'; P.starBurst(s.x, s.y - 10, 12, '#fffaf0', 160); P.text(s.x, s.y - 30, 'Pearl!', '#fffaf0', 16); AudioFX.gem(2); Bus.emit('pearl', this, s);
    }
    for (const a of W.apples) {
      if (a.state !== 'ground' || Math.abs(a.x - this.x) > 44 || Math.abs(a.y - this.y) > 60) continue;
      a.state = 'taken'; a.timer = 45; this.G.apples = (this.G.apples || 0) + 1;
      P.text(a.x, a.y - 30, '🍎 ' + this.G.apples, '#fff', 15); AudioFX.pop ? AudioFX.pop() : AudioFX.star(1); Bus.emit('apple', this, this.G.apples);
    }
    const raceNext = W.rings.filter(r => r.set === 'race' && !r.passed).reduce((m, r) => Math.min(m, r.i), 1e9);
    for (const r of W.rings) {
      if (r.passed || (r.set === 'race' && (r.i !== raceNext || (typeof Race !== 'undefined' && !Race.racing())))) continue;
      const crossed = (this.prevX - r.x) * (this.x - r.x) <= 0 && Math.abs(this.y - 34 - r.y) < r.r * .85;
      const inside = Math.abs(this.x - r.x) < 22 && Math.abs(this.y - 34 - r.y) < r.r * .85;
      if (crossed || inside) { r.passed = true; P.starBurst(r.x, r.y, 14, pick(RAINBOW), 160); AudioFX.ring(r.i); Bus.emit('ringPassed', this, r); }
    }
    const C = W.constellation;
    if (!C.done && Quests.current() && Quests.current().key === 'moon' && Quests.status() === 'active') {
      const p = C.pts[C.lit];
      if (p && dist(p.x, p.y, cx, cy) < 70) { p.lit = true; C.lit++; P.starBurst(p.x, p.y, 16, '#fff', 200); AudioFX.constStar(C.lit); Bus.emit('constStar', this, C.lit); if (C.lit >= C.pts.length) C.done = true; }
    }
  }

  trackPlace() {
    const W = this.G.world;
    const z = W.zoneAt(this.x);
    if (z !== this.zone) { const first = !!this.zone; this.zone = z; if (first) Bus.emit('zone', this, z); }
    const s = W.skyZoneAt(this.y);
    if (s !== this.skyZone) { this.skyZone = s; if (s) Bus.emit('skyZone', this, s); }
  }

  /* ---------- under the water ---------- */
  dive() {
    const P = this.G.particles;
    this.state = 'swim'; this.surface = null; this.vy = 160; this.diveT = 0; this.sit = 0;
    P.splash(this.x, LAKE.y, 18, 1.2); AudioFX.splash();
    this.stats.dives = (this.stats.dives || 0) + 1;
    Bus.emit('dive', this);
  }
  updateSwim(dt) {
    const inp = this.input, W = this.G.world, P = this.G.particles;
    const sp = 230;
    const tx = inp.x * sp, ty = inp.y * sp * .9 + (Math.abs(inp.x) + Math.abs(inp.y) < .1 ? -28 : 0);
    this.vx = approach(this.vx, tx, dt * 500); this.vy = approach(this.vy, ty, dt * 500);
    if (inp.fly) this.vy = approach(this.vy, -sp, dt * 700);
    if (Math.abs(inp.x) > .15) this.dir = sign(inp.x);
    this.x += this.vx * dt; this.y += this.vy * dt;
    const bed = W.groundY(this.x) - 10;
    if (this.y > bed) { this.y = bed; this.vy = Math.min(0, this.vy); }
    /* keep inside the lake */
    if (!W.isWater(this.x + this.dir * 30) || W.groundY(this.x + this.dir * 30) < LAKE.y + 40) { this.x -= this.vx * dt; this.vx = 0; }
    this.walk += dt * (2 + Math.hypot(this.vx, this.vy) * .02);
    this.pitch = approach(this.pitch, clamp(this.vy / 500, -.45, .45) * (this.dir), dt * 3);
    this.fly = approach(this.fly, 0, dt * 4); this.open = approach(this.open, 0, dt * 4); this.gallop = 0;
    this.breathT -= dt;
    if (this.breathT <= 0) { this.breathT = rnd(.6, 1.4); P.spawn({ type: 'bubble', x: this.x + this.dir * 55, y: this.y - 70, vx: rnd(-8, 8), vy: -rnd(40, 70), g: -20, r: rnd(2, 4.5), life: 3 }); }
    /* back up through the surface */
    if (this.y < LAKE.y + 30 && (inp.y < -.4 || inp.fly)) {
      this.state = 'air'; this.y = LAKE.y - 2; this.vy = -430; this.airT = 0;
      P.splash(this.x, LAKE.y, 18, 1.3); AudioFX.splash(); AudioFX.jump();
      Bus.emit('surfaced', this);
    } else if (this.y < LAKE.y + 12) this.y = LAKE.y + 12;
  }
  /* springy hair: lags behind speed changes and bounces on landings */
  updateHair(dt) {
    const h = this.hair;
    const ax = (this.vx - this.prevVx) / Math.max(dt, 1e-3) * this.dir, ay = (this.vy - this.prevVy) / Math.max(dt, 1e-3);
    this.prevVx = this.vx; this.prevVy = this.vy;
    const floaty = this.state === 'swim';
    const ttx = clamp(-ax * .012, -12, 12) + (floaty ? -4 : 0), tty = clamp(-ay * .01, -12, 12) + (floaty ? -16 : 0);
    const tmx = clamp(-ax * .008, -8, 8), tmy = clamp(-ay * .008, -8, 8) + (floaty ? -14 : 0);
    const k = 70, d = 7;
    h.vtx += ((ttx - h.tx) * k - h.vtx * d) * dt; h.vty += ((tty - h.ty) * k - h.vty * d) * dt;
    h.vmx += ((tmx - h.mx) * k - h.vmx * d) * dt; h.vmy += ((tmy - h.my) * k - h.vmy * d) * dt;
    h.tx = clamp(h.tx + h.vtx * dt, -18, 18); h.ty = clamp(h.ty + h.vty * dt, -22, 18);
    h.mx = clamp(h.mx + h.vmx * dt, -12, 12); h.my = clamp(h.my + h.vmy * dt, -18, 12);
  }
  /* a soft shadow on whatever is below */
  drawShadow(ctx) {
    if (this.state === 'swim') return;
    const W = this.G.world;
    let best = null;
    for (const s of W.surfacesAt(this.x)) if (s.y >= this.y - 4 && (!best || s.y < best.y)) best = s;
    if (!best) return;
    const h = best.y - this.y;
    if (h > 700) return;
    const k = 1 - h / 700;
    ctx.save();
    ctx.fillStyle = `rgba(40,20,70,${.2 * k})`;
    ctx.beginPath(); ctx.ellipse(this.x, best.y + 2, 46 * (.5 + .5 * k), 8 * (.5 + .5 * k), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- drawing ---------- */
  drawTrail(ctx) {
    if (this.trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const T = this.trail;
    for (let band = 0; band < 7; band++) {
      ctx.beginPath();
      for (let i = 0; i < T.length; i++) { const p = T[i]; const off = (band - 3) * 2.6; i ? ctx.lineTo(p.x, p.y + off) : ctx.moveTo(p.x, p.y + off); }
      const last = T[T.length - 1];
      ctx.strokeStyle = last.rainbow ? withAlpha(RAINBOW[band], .75) : `rgba(255,255,255,${.35})`;
      ctx.lineWidth = last.rainbow ? 3 : 1.5;
      ctx.stroke();
    }
    /* fade the old part by painting it out */
    ctx.restore();
  }

  draw(ctx, time) {
    const s = 1;
    const feetK = this.squash;
    ctx.save();
    ctx.translate(this.x, this.y - ALICORN_FEET * s + feetK * 6);
    if (this.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(this.state === 'air' ? this.pitch : this.pitch);
    ctx.scale(1 + feetK * .12, 1 - feetK * .12);
    const o = {
      s, look: this.look, walk: this.walk, gallop: this.gallop, fly: this.fly, open: this.open, flap: this.flap,
      stream: Math.max(this.gallop, this.fly, this.dashT > 0 ? 1 : 0, this.skate * .6), blink: this.blink, mouth: this.mouth, magic: this.magicT / .9, time, sit: this.sit, sleep: this.sleep,
      swim: this.state === 'swim' ? 1 : 0, skate: this.skate, hair: this.hair
    };
    if (!(Render.rimLit && Render.rimLit(ctx, 240, 180, 128, 112, this.dir, (c) => Sprites.drawAlicorn(c, o)))) Sprites.drawAlicorn(ctx, o);
    if (this.passenger === 'puff') { ctx.save(); ctx.translate(-8, -18); ctx.scale(.55, .55); Sprites.drawSheep(ctx, { s: 1, lamb: true, time, blink: 0 }); ctx.restore(); }
    ctx.restore();
  }

  serialize() {
    return { id: this.id, x: +this.x.toFixed(1), y: +this.y.toFixed(1), dir: this.dir, look: this.look, stats: this.stats, sparkle: this.sparkle, state: this.state === 'air' || this.state === 'swim' ? 'air' : 'ground', passenger: this.passenger };
  }
  restore(o) {
    this.look = o.look || this.look; this.stats = Object.assign(this.stats, o.stats || {}); this.sparkle = o.sparkle === undefined ? .5 : o.sparkle;
    this.dir = o.dir || 1;
    if (o.state === 'air') { this.x = o.x; this.y = Math.min(o.y, this.G.world.standY(o.x) - 60); this.state = 'air'; this.vy = 0; this.fly = 1; this.open = 1; }
    else { this.x = o.x; this.y = o.y; this.state = 'ground'; this.surface = this.G.world.surfaceBelow(o.x, o.y, 40); if (!this.surface) this.placeAt(o.x); }
    this.passenger = null;
    this.zone = this.G.world.zoneAt(this.x);
  }
}
