/* ============================================================
   player.js — you, the wolf, from the den to a den of your own
   ============================================================
   age 1  newborn   blind in the den (mode den): wriggle to your
                    mum and drink; your eyes open; grow until you
                    can wobble out
   age 2  pup       outside the den: play-fight your litter-mates,
                    eat the meals the grown-ups bring, your first
                    howl, the ravens
   age 3  big pup   the summer meadow: pounce (they get away),
                    sniff scents, shelter from storms; then autumn:
                    follow the pack single file, read tracks, swim
                    the river, the scent post, howl when lost;
                    winter: the trail, the chase (the herd gets
                    away), the feast
   age 4  yearling  babysit the new litter, keep watch; then
                    disperse: a lone wolf over the ridge, the road's
                    tunnel, the mate, scent posts, the duet
   age 5  adult     dig a den; boy: bring meals, bark off the
                    raven, the pups come out; girl: the pups are
                    born, feed them, carry a wanderer home, their
                    first howl.  Then the next generation.
   modes: den · walk (and swimming) · burrow (digging / inside a den)
          · rest (curled up warm) · sleep (a time-lapse) · play
          (a play-fight) · chase · howl (the howl game) · tossed
   Nothing hurts the wolf, ever: the herd gets away, a lost play-
   fight is a roll in the grass, cold means a curl-up and a rest.
   ============================================================ */
'use strict';

const SLEEP_T = 2.6, REST_T = 2.4, HOWL_RING = 2.2;

class Wolf {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'gray';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'wolf'; this.mode = 'den'; this.age = 1;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false, hold: false };
    this.t = 0; this.phase = 0;
    this.food = 0; this.full = false; this.kg = .5;
    this.warmth = 1; this.stamina = 1; this.pant = 0; this.wet = 0; this.snowy = 0;
    this.walk = 0; this.moving = false; this.run = false; this.spin = 0; this.sleepT = 0; this.restT = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.burrow = null; this.wr = null; this.hw = null; this.carrying = null; this.carryObj = null;
    this.howlT = 0; this.howlHeld = 0; this.bowT = 0; this.tumble = 0;
    this.hintClock = 0; this.digClock = 0; this.shade = 'open'; this.target = null; this.sniffT = 0;
    this.stats = { drinks: 0, meals: 0, plays: 0, wins: 0, losses: 0, howls: 0, goodHowls: 0, pounces: 0, sniffs: 0, looks: 0, swims: 0, marks: 0, chases: 0, feasts: 0, dug: 0, dens: 0, mealsGiven: 0, barks: 0, nurses: 0, carries: 0, tumbles: 0, trailSteps: 0, rests: 0, shelters: 0, guards: 0 };
    this.flags = {};
    this.learned = { tracks: [], scents: [] };
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get th() { return this.D.grow; }
  /* the drawn length of the wolf, its height and how far its chest sits above its paws */
  get w() { return wolfUnits(this.kg); }
  get h() { return this.w * .58; }
  get feet() { return this.h * .62; }
  get r() { return this.h * .45; }
  get age01() { return Sprites.ageOf(this.kg); }
  /* the walking surface ignores holes narrower than this (a den mouth is about 42 wide) */
  span() { return Math.max(this.w * .45, 26); }
  get swimming() { return this.stage === 'wolf' && this.mode === 'walk' && this.W.inWater(this.x, this.y + this.feet - 2); }
  get underground() { return (this.mode === 'den' || this.mode === 'burrow') && this.y > this.S.surfaceAt(this.x) - 2; }
  get depth() { return this.y - this.S.surfaceAt(this.x); }
  get busyNow() { return this.busy > 0; }
  stageKey() {
    if (this.age <= 1) return 'newborn';
    if (this.age === 2) return 'pup';
    if (this.age === 3) return 'bigpup';
    if (this.age === 4) return this.flags.lone ? 'lone' : 'yearling';
    return this.flags.pupsOut || this.flags.pupsBorn ? 'parent' : 'adult';
  }
  /* the food needed for the next growth step */
  get growTh() { return this.age < 5 ? this.th[this.age - 1] : this.th[3] * BONUS; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.bowT = Math.max(0, this.bowT - dt); this.pant = Math.max(0, this.pant - dt * .4); this.sniffT = Math.max(0, this.sniffT - dt);
    this.wet = Math.max(0, this.wet - dt * .15); this.snowy = Math.max(0, this.snowy - dt * .05);
    this.kg = wolfKG(this.age, this.food, this.th, this.sex);
    const inp = this.input;
    if (this.target) this.steerToTarget();
    this.updateWarmth(dt);
    if (this.mode === 'sleep') { this.sleepT -= dt; if (this.sleepT <= 0) { this.mode = this.age === 1 ? 'den' : this.flags.inDen ? 'burrow' : 'walk'; Bus.emit('woke', this); } inp.actionPressed = false; inp.eggPressed = false; return; }
    if (this.busy > 0) { this.updateBusy(dt); inp.actionPressed = false; inp.eggPressed = false; return; }
    switch (this.mode) {
      case 'den': this.updateDen(dt); break;
      case 'walk': this.updateWalk(dt); break;
      case 'burrow': this.updateBurrow(dt); break;
      case 'rest': this.restT += dt; if (this.restT > REST_T) { this.mode = 'walk'; this.warmth = Math.max(this.warmth, .75); this.stats.rests++; Bus.emit('rested', this); } break;
      case 'play': this.updatePlay(dt); break;
      case 'chase': this.updateChase(dt); break;
      case 'howl': this.updateHowl(dt); break;
      case 'tossed': this.updateTossed(dt); break;
    }
    /* a plain howl anywhere: hold E (not during a game of timing) */
    if (this.mode === 'walk' || this.mode === 'den' || this.mode === 'burrow') this.plainHowl(dt);
    /* growth: the next stage waits for its page */
    this.checkGrowth();
    inp.actionPressed = false; inp.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y;
    if (this.mode === 'walk' || this.mode === 'chase') {
      if (Math.abs(dx) < Math.max(4, this.w * .25)) { this.target = null; return; }
      this.input.x = sign(dx); this.input.y = 0;
    } else if (this.mode === 'den' || this.mode === 'burrow') { const d = Math.hypot(dx, dy); if (d < Math.max(4, this.r)) { this.target = null; return; } this.input.x = dx / d; this.input.y = dy / d; }
    else this.target = null;
  }
  goTo(x, y) { if (['sleep', 'rest', 'play', 'howl', 'tossed'].includes(this.mode) || this.busy > 0) return; this.target = { x, y }; }

  /* ---------- warmth: cold snow, the river and the night use it up; the den, a tree, the sun and a curl-up bring it back ---------- */
  updateWarmth(dt) {
    const W = this.W, D = this.D, G = this.G;
    const shade = this.mode === 'den' || this.underground ? 'den' : W.shadeAt(this.x, this.y + this.feet - 1, this.h);
    const night = nightAmount(G.tod), season = W.season, moving = this.moving ? .55 : 1;
    let rate = 0;
    if (shade === 'den') rate = .03;
    else if (shade === 'water') rate = -.06 * D.cold;
    else {
      const base = season === 'winter' ? -.011 : season === 'summer' ? .012 : .003;
      rate = base * (season === 'winter' ? D.cold * moving : 1) - night * .004 * (season === 'winter' ? D.cold : .5) * moving;
      if (shade === 'tree') rate += season === 'winter' ? .003 : .01;
      if (W.weather.rain > .3 && shade !== 'tree') rate -= .006;
      if (W.snowAt(this.x) > 8 && this.moving) rate -= .004 * D.cold;
    }
    if (this.mode === 'rest' || this.mode === 'sleep') rate = .08;
    if (this.mode === 'chase') rate = .01;
    if (this.age <= 1) rate = Math.max(rate, .01);
    this.warmth = clamp(this.warmth + rate * dt, 0, 1);
    if (shade === 'tree' && this.shade !== 'tree' && (W.weather.state === 'storm' || W.weather.rain > .5)) { this.stats.shelters++; Bus.emit('sheltered', this); }
    this.shade = shade;
    if (shade === 'water' && !this.flags.swamSaid && this.mode === 'walk') { this.flags.swamSaid = true; this.stats.swims++; Bus.emit('swimStart', this); }
    if (shade !== 'water') this.flags.swamSaid = false;
    if (this.warmth < .28 && !this.flags.coldSaid && this.mode === 'walk') { this.flags.coldSaid = true; Bus.emit('cold', this); }
    if (this.warmth > .6) this.flags.coldSaid = false;
    if (this.warmth <= 0 && this.mode === 'walk' && this.busy <= 0 && !this.swimming) { this.mode = 'rest'; this.restT = 0; this.target = null; Bus.emit('tooCold', this); }
  }

  /* ============================================================
     IN THE DEN (newborn)
     ============================================================ */
  updateDen(dt) {
    const S = this.S, inp = this.input, W = this.W;
    if (inp.actionPressed) { if (this.act()) return; }
    let mx = inp.x, my = inp.y; const m = Math.hypot(mx, my);
    if (m > .1) {
      mx /= m; my /= m;
      const sp = 9 + this.kg * 3, nx = this.x + mx * sp * dt, ny = this.y + my * sp * dt * .6;
      if (S.free(nx, ny, this.r * .8, false) && ny > S.surfaceAt(nx) + 4) { this.x = nx; this.y = ny; this.moving = true; this.walk += dt * 8; if (Math.abs(mx) > .3) this.face = sign(mx); }
      else if (S.free(nx, this.y, this.r * .8, false) && this.y > S.surfaceAt(nx) + 4) { this.x = nx; this.moving = true; this.walk += dt * 8; }
      else this.moving = false;
    } else this.moving = false;
    /* gravity in the den: settle onto the floor */
    for (let k = 0; k < 3 && S.free(this.x, this.y + 1.5, this.r * .8, false); k++) this.y += 1.5;
  }
  /* the eyes open part way through the newborn weeks */
  checkGrowth() {
    const th = this.th;
    if (this.age === 1 && !this.flags.eyesOpen && this.food >= th[0] * .4 && !this.flags.eyesGate) { this.flags.eyesGate = true; this.milestone('eyes', () => { this.flags.eyesOpen = true; Bus.emit('eyesOpen', this); }); }
    if (this.age < 5 && this.food >= this.growTh && !this.full) { this.full = true; Bus.emit('fullWolf', this); }
    if (this.full && this.age === 1 && this.flags.eyesOpen && !this.flags.outGate && this.mode === 'den') { this.flags.outGate = true; this.milestone('out', () => this.growUp()); }
    if (this.full && this.age === 2 && !this.flags.rvGate && this.mode === 'walk' && this.busy <= 0) { this.flags.rvGate = true; this.milestone('rendezvous', () => this.growUp()); }
    if (this.age === 3 && !this.flags.travel && this.food >= th[2] * .45 && !this.flags.travelGate && this.mode === 'walk' && this.busy <= 0) { this.flags.travelGate = true; this.milestone('travel', () => { this.flags.travel = true; this.full = false; Bus.emit('travel', this); }); }
    if (this.full && this.age === 3 && this.flags.travel && this.flags.feasted && !this.flags.yearGate && this.mode === 'walk' && this.busy <= 0) { this.flags.yearGate = true; this.milestone('yearling', () => this.growUp()); }
    if (this.age === 4 && !this.flags.lone && this.flags.guarded && this.stats.plays >= (this.flags.playsAtHome || 0) + 2 && this.food >= th[3] * .5 && !this.flags.loneGate && this.mode === 'walk' && this.busy <= 0) { this.flags.loneGate = true; this.milestone('disperse', () => this.disperse()); }
  }
  /* a time-lapse: weeks go by, and you wake up bigger */
  growUp() {
    const S = this.S, W = this.W, d = W.den;
    this.age++; this.full = false; this.food = Math.max(this.food, this.th[this.age - 2]); this.kg = wolfKG(this.age, this.food, this.th, this.sex);
    this.target = null; this.carrying = null; this.flags.inDen = false;
    if (this.age === 2) { this.x = d.x + 34; this.y = S.walkTop(this.x, 6) - this.feet; this.face = 1; this.mode = 'sleep'; }
    else if (this.age === 3) { this.x = WORLD.rvX; this.y = S.walkTop(this.x, 6) - this.feet; this.mode = 'sleep'; }
    else if (this.age === 4) { this.x = d.x + 90; this.y = S.walkTop(this.x, 6) - this.feet; this.mode = 'sleep'; this.flags.playsAtHome = this.stats.plays; }
    else { this.mode = 'sleep'; }
    this.sleepT = SLEEP_T; this.warmth = 1;
    Bus.emit('grewUp', this, this.age);
  }
  disperse() {
    const S = this.S;
    this.flags.lone = true; this.full = false; this.target = null;
    this.x = WORLD.postX - 120; this.y = S.walkTop(this.x, 6) - this.feet; this.face = 1;
    this.mode = 'sleep'; this.sleepT = SLEEP_T; this.warmth = 1;
    Bus.emit('dispersed', this);
  }

  /* ============================================================
     ON THE MOVE
     ============================================================ */
  speed() {
    const base = this.age === 2 ? 36 : this.age === 3 ? 56 : this.age === 4 ? 70 : 74;
    return base * (this.G.settings.slowmo ? .7 : 1);
  }
  updateWalk(dt) {
    const S = this.S, W = this.W, inp = this.input, w = this.w;
    if (inp.actionPressed) { if (this.act()) return; }
    const slope = S.slopeAt(this.x, this.span());
    const water = this.swimming, snow = W.snowAt(this.x), deep = snow > 8;
    const sp = this.speed() * (water ? .5 : 1) / (deep ? 1 + snow / 16 : 1);
    if (Math.abs(inp.x) > .15) {
      const dx = inp.x * sp * dt / (1 + Math.abs(slope) * 1.1);
      const nx = clamp(this.x + dx, WORLD.left + 40, WORLD.right - 40);
      /* a pup stays near the den until it has grown */
      const leash = this.age === 2 ? Math.abs(nx - W.den.x) > 520 && Math.abs(nx - W.den.x) > Math.abs(this.x - W.den.x) : false;
      if (leash) { this.say('toofar'); }
      else { this.x = nx; this.walk += dt * (water ? 7 : 12) * Math.abs(inp.x); this.moving = true; this.face = sign(inp.x); if (W.ground.snowOn && snow < 8) this.stats.trailSteps += dt; if (snow > 0) S.breakTrail(this.x, this.y + this.feet - 2, Math.max(8, this.h * .4)); }
    } else this.moving = false;
    this.run = false;
    const top = S.walkTop(this.x, this.span());
    this.y = top - this.feet + (deep ? Math.min(snow, this.h * .4) * .5 : 0);
    if (water) { this.y = Math.min(this.y, WORLD.riverY - this.h * .32); this.wet = 1; if (Math.random() < dt * 6) this.G.particles.bubbles(this.x - this.face * w * .3, this.y + this.feet * .4, 2, .8); }
    if (deep && this.moving) this.snowy = Math.min(1, this.snowy + dt * .3);
    this.ang = angleLerp(this.ang, water ? 0 : clamp(Math.atan(slope), -1, 1) * .5, clamp(dt * 8, 0, 1));
    if (inp.y > .6 && !this._downHeld) this.tryDig();
    this._downHeld = inp.y > .6;
    /* places you pass: the ridge, the road's tunnel, the river bank */
    if (W.inTunnel(this.x) && !this.flags.underpass && this.flags.lone) { this.flags.underpass = true; Bus.emit('underpass', this); }
    if (this.flags.lone && this.x > WORLD.ridgeL && !this.flags.ridge) { this.flags.ridge = true; Bus.emit('ridge', this); }
    if (this.flags.travel && this.x > WORLD.riverR && !this.flags.crossed) { this.flags.crossed = true; Bus.emit('crossed', this); }
    if (this.flags.lone && this.x > WORLD.roadR + 30 && !this.flags.newValley) { this.flags.newValley = true; Bus.emit('newValley', this); }
  }
  /* push down: into a den mouth, or dig into soft ground (only a grown pair digs a den) */
  tryDig() {
    const S = this.S, W = this.W, foot = this.y + this.feet;
    const atMouth = this.flags.denMade && W.newDen && Math.abs(this.x - W.newDen.x) < Math.max(24, this.w * .5);
    const hole = atMouth || S.topAt(this.x) - S.walkTop(this.x, this.span()) > this.h * .5;
    if (!(this.age >= 5 && this.flags.claimed)) { if (this.age >= 4 && !hole) this.say('den'); return; }
    const softAt = (x) => { for (let y = foot - 4; y < foot + 16; y += 3) { const m = S.matAt(x, y); if (m !== MAT.AIR) return m === MAT.SOIL; } return false; };
    let dx = null;
    for (const o of [0, -4, 4, -8, 8, -this.w * .3, this.w * .3]) if (softAt(this.x + o)) { dx = o; break; }
    if (!hole && this.flags.denMade) { this.say('outden'); return; }
    if (!hole && dx === null) { this.say('rock'); return; }
    if (!hole && (this.x < WORLD.newDenL || this.x > WORLD.newDenR)) { this.say('den'); return; }
    if (!hole) this.x += dx;
    this.mode = 'burrow'; this.ang = Math.PI / 2; this.target = null;
    if (!hole && (!this.burrow || Math.abs(this.burrow.x - this.x) > 40)) { this.burrow = { x: this.x, y: S.surfaceAt(this.x) }; this.stats.dens++; Bus.emit('digStart', this); }
    this.y += 2;
  }
  updateBurrow(dt) {
    const S = this.S, inp = this.input, D = this.D, W = this.W;
    if (inp.actionPressed) { if (this.act()) return; }
    let mx = inp.x, my = inp.y;
    /* a new den slants down into the hillside, the way real dens do */
    if (my > .5 && Math.abs(mx) < .3 && this.age >= 5 && this.flags.claimed && !this.flags.denMade) { mx = this.face * .8; my = .6; }
    /* inside a finished den, up and down follow the tunnel: out to the mouth, or down to the pups' room */
    else if (this.flags.denMade && Math.abs(mx) < .5) {
      if (my < -.5 && this.burrow) { mx = this.burrow.x - this.x; my = (this.burrow.y - this.feet - 6) - this.y; }
      else if (my > .5 && W.newDen) { mx = W.newDen.cx - this.x; my = W.newDen.cy - this.y; if (Math.hypot(mx, my) < 4) { mx = 0; my = 0; } }
    }
    const m = Math.hypot(mx, my);
    if (m < .1) { this.moving = false; this.checkDepth(); this.pupCarry(); return; }
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 7, 0, 1));
    if (Math.abs(mx) > .3) this.face = sign(mx);
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang), rad = Math.max(10, this.h * .5 + 2);
    const step = (18 + this.w * .4) * dt;
    const nx = this.x + dx * step, ny = this.y + dy * step;
    this.moving = true; this.walk += dt * 8;
    const canDig = this.age >= 5 && this.flags.claimed && !this.flags.denMade;
    if (S.free(nx, ny, rad * .66, false)) { this.x = nx; this.y = ny; }
    else if (canDig) {
      const hx = this.x + dx * rad * .55, hy = this.y + dy * rad * .55;
      const res = S.dig(hx, hy, rad * 1.08 + 1, D.dig * 1.8, dt, { root: true });
      this.digClock -= dt;
      if (res.cells) {
        this.stats.dug += res.cells;
        if (this.digClock <= 0) { this.digClock = .12; AudioFX.dig && AudioFX.dig(); this.G.particles.dust(hx, hy, '#7a5a3a', 3, this.ang); }
        if (S.free(this.x + dx * 1.2, this.y + dy * 1.2, rad * .66, false)) { this.x += dx * 1.2; this.y += dy * 1.2; }
      } else if (res.blocked) {
        if (dy < -.3 && S.survey(this.x, this.y - rad, rad * 1.2).sky > 0) { this.surface(); return; }
        this.say('rock');
        this.slide(dx, dy, step, rad);
      }
    } else this.slide(dx, dy, step, rad);
    if (this.depth < -this.feet * .4 && dy < .2) { this.surface(); return; }
    if (this.depth > Math.max(80, this.w * 2.4)) this.y -= 1;
    this.checkDepth(); this.pupCarry();
  }
  slide(dx, dy, step, r) {
    for (const s of [1, -1]) { const a = this.ang + s * 1.1, nx = this.x + Math.cos(a) * step * .6, ny = this.y + Math.sin(a) * step * .6; if (this.S.free(nx, ny, r * .66, false)) { this.x = nx; this.y = ny; return true; } }
    return false;
  }
  checkDepth() {
    const deep = this.depth > this.denDepth();
    if (deep && !this.flags.deepNow && !this.flags.denMade) { this.flags.deepNow = true; Bus.emit('deepEnough', this); }
    if (!deep) this.flags.deepNow = false;
  }
  denDepth() { return Math.min(this.h * 1.6 + 6, 70); }
  denReady() { return this.mode === 'burrow' && this.age >= 5 && this.flags.claimed && !this.flags.denMade && this.depth > this.denDepth(); }
  surface() {
    const S = this.S;
    this.mode = 'walk'; this.ang = 0; this.flags.inDen = false; this.y = S.walkTop(this.x, this.span()) - this.feet;
    this.G.particles.dust(this.x, this.y + this.feet, '#7a5a3a', 6, -Math.PI / 2);
    Bus.emit('surfaced', this);
  }
  /* finish the den: a round chamber where you stand, and the pups' room is ready */
  makeDen() {
    const S = this.S, W = this.W;
    S.blob(this.x, this.y, Math.max(26, this.w * .5), Math.max(20, this.h * .8), MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL); S.flushTop();
    const dir = this.burrow && this.x < this.burrow.x ? -1 : 1;
    W.newDen = { x: this.burrow ? this.burrow.x : this.x, y: this.burrow ? this.burrow.y : S.surfaceAt(this.x), cx: this.x, cy: this.y, dir };
    this.flags.denMade = true; this.flags.inDen = true;
    this.G.particles.sparkle(this.x, this.y, 20, '#fff3c0', this.w * .5);
    Bus.emit('denMade', this);
  }
  /* a carried pup is put down by itself once you are back in the chamber */
  pupCarry() {
    const W = this.W;
    if (this.carrying !== 'pup' || !W.newDen) return;
    const q = this.carryObj; if (!q) { this.carrying = null; return; }
    if (Math.hypot(this.x - W.newDen.cx, this.y - W.newDen.cy) < 22) {
      q.x = W.newDen.cx + 6; q.y = W.newDen.cy + 6; q.inDen = true; q.carried = false; q.mode = 'lie'; q.wandered = false; this.carrying = null; this.carryObj = null;
      this.stats.carries++; Bus.emit('pupHome', this, q);
    }
  }

  /* ---------- howling: hold E; let go when the ring is green to match the chorus ---------- */
  plainHowl(dt) {
    const inp = this.input, G = this.G;
    if (inp.hold && this.busy <= 0) {
      if (this.howlHeld === 0) { if (this.wantsHowlGame()) { this.startHowlGame(); return; } AudioFX.howl && AudioFX.howl(this.age); }
      this.howlHeld += dt; this.howlT = 1; this.moving = false;
    } else if (this.howlHeld > 0) {
      this.howlHeld = 0; this.stats.howls++;
      if (!this.flags.howled) { this.flags.howled = true; Bus.emit('firstHowl', this); }
      Bus.emit('howled', this);
    }
    this.howlT = Math.max(0, this.howlT - dt * (inp.hold ? 0 : 2));
  }
  wantsHowlGame() { return !!(this.flags.lostPack || (this.flags.met && this.flags.marksDone && !this.flags.claimed) || (this.flags.pupsOut && this.sex === 'girl' && !this.flags.litterHowled)); }
  startHowlGame() {
    const kind = this.flags.lostPack ? 'lost' : this.flags.claimed ? 'litter' : 'duet';
    this.mode = 'howl'; this.target = null; this.moving = false;
    this.hw = { kind, ring: 0, good: 0, miss: 0, t: 0, flash: 0, held: false, msg: '' };
    Bus.emit('howlGame', this, kind);
  }
  howlWindow() { const h = this.hw; if (!h) return false; const u = (h.ring % HOWL_RING) / HOWL_RING; const wide = this.G.settings.difficulty === 'easy' ? .3 : this.G.settings.difficulty === 'hard' ? .14 : .2; return u > .92 - wide && u < .95; }
  updateHowl(dt) {
    const h = this.hw, inp = this.input, D = this.D;
    h.t += dt; h.flash = Math.max(0, h.flash - dt * 2);
    if (inp.hold) {
      if (!h.held) { h.held = true; h.ring = 0; AudioFX.howl && AudioFX.howl(this.age); }
      h.ring += dt; this.howlT = 1; this.howlHeld += dt;
    } else if (h.held) {
      /* let go: a good howl lands in the window */
      h.held = false; this.howlHeld = 0; this.stats.howls++;
      if (this.howlWindow()) { h.good++; this.stats.goodHowls++; h.flash = 1; this.G.particles.sparkle(this.x, this.y - this.h, 18, '#fff3c0', 20); AudioFX.chorus && AudioFX.chorus(); Bus.emit('goodHowl', this, h.good); if (h.good >= D.howls) return this.endHowl(true); }
      else { h.miss++; this.say('lostpack'); Bus.emit('howlMiss', this); }
      h.ring = 0;
    } else this.howlT = Math.max(0, this.howlT - dt * 2);
    if (!inp.hold && Math.abs(inp.x) > .5) { h.away = (h.away || 0) + dt; if (h.away > .8) return this.endHowl(false); } else h.away = 0;
    if (h.t > 90) this.endHowl(false);
  }
  endHowl(done) {
    const h = this.hw; this.hw = null; this.mode = 'walk'; this.howlT = 0;
    if (!done) return;
    if (h.kind === 'lost') { this.flags.lostPack = false; this.flags.found = true; Bus.emit('packFound', this); }
    else if (h.kind === 'duet') { this.flags.claimed = true; Bus.emit('claimed', this); }
    else if (h.kind === 'litter') { this.flags.litterHowled = true; this.milestone('pups', () => { Bus.emit('litterHowl', this); }); }
  }

  /* ---------- the chase: hold right to run with the pack; mind your puff ---------- */
  startChase() {
    const W = this.W; if (!W.startChase(this)) return;
    this.mode = 'chase'; this.target = null; this.stamina = 1; this.stats.chases++;
  }
  updateChase(dt) {
    const S = this.S, inp = this.input, W = this.W, D = this.D;
    const want = inp.x > .3;
    if (want && this.stamina > 0) { const sp = 150 * (this.stamina < .25 ? .6 : 1); this.x += sp * dt; this.walk += dt * 18; this.moving = true; this.run = true; this.face = 1; this.stamina = Math.max(0, this.stamina - dt * .14 / D.stamina); }
    else { this.moving = inp.x > .3; this.run = false; if (this.moving) { this.x += 40 * dt; this.walk += dt * 9; } this.stamina = Math.min(1, this.stamina + dt * .16); this.pant = 1; }
    this.y = S.walkTop(this.x, 6) - this.feet + (W.snowAt(this.x) > 8 ? Math.min(W.snowAt(this.x), this.h * .4) * .4 : 0);
    if (!W.chase || !W.chase.on) { this.mode = 'walk'; this.run = false; this.pant = 1; this.moving = false; }
  }

  /* ---------- what Space does right now ---------- */
  reach() { return this.w * .55 + 14; }
  context() {
    const W = this.W, R = this.reach();
    if (this.busy > 0 || this.mode === 'sleep' || this.mode === 'rest' || this.mode === 'play' || this.mode === 'howl' || this.mode === 'tossed' || this.mode === 'chase') return null;
    if (this.mode === 'den') { const m = W.mum(); return m && Math.hypot(m.x - this.x, m.y - this.y) < R + m.len * .4 ? 'drink' : null; }
    if (this.mode === 'burrow') {
      if (this.denReady()) return 'dig';
      if (this.flags.pupsBorn && this.sex === 'girl' && this.stats.nurses < this.D.nurses && W.pups.some(q => q.inDen && Math.hypot(q.x - this.x, q.y - this.y) < R + 10)) return 'feed';
      if (!this.carrying && W.pups.some(q => q.wandered && Math.hypot(q.x - this.x, q.y - this.y) < R + 10)) return 'carry';
      return null;
    }
    if (this.mode !== 'walk') return null;
    const near = (n, extra = 0) => n && !n.inDen && !n.gone && Math.abs(n.x - this.x) < R + n.len * .4 + extra && Math.abs(n.y - this.y) < 60;
    if (this.carrying === 'meal' && W.newDen && Math.abs(this.x - W.newDen.x) < R + 20) return 'give';
    if (!this.carrying && W.meal && !W.meal.taken && this.flags.denMade && this.sex === 'boy' && Math.abs(W.meal.x - this.x) < R) return 'carry';
    if (W.denRaven && W.denRaven.state === 'ground' && Math.abs(W.denRaven.x - this.x) < R + 10) return 'bark';
    if (this.sex === 'girl' && this.flags.pupsBorn && !this.carrying && W.pups.some(q => q.wandered && !q.inDen && Math.abs(q.x - this.x) < R + 8)) return 'carry';
    const mate = W.mate(); if (mate && !this.flags.met && near(mate, 10)) return 'meet';
    const bio = W.biologist; if (bio && !bio.met && Math.abs(bio.x - this.x) < R + 16 && Math.abs(bio.y - (this.y + this.feet)) < 40) return 'hello';
    const feeder = W.pack.find(n => n.meal && near(n, 6)); if (feeder && this.age <= 3) return 'eat';
    /* a scent post first (it is what you came for), then a grasshopper or a scent, whichever is nearer */
    const post = W.postNear(this.x, R + 10);
    if (post) { if (post.home && !this.flags.postSniffed && this.age <= 4 && !this.flags.lone) return 'sniff'; if (!post.home && !post.marked && this.flags.met) return 'mark'; }
    const hop = this.age >= 3 ? W.hopperNear(this.x, this.y + this.feet, R) : null, sc = this.age >= 3 ? W.scentNear(this.x, this.y, R + 8) : null;
    if (hop && (!sc || Math.abs(hop.x - this.x) <= Math.abs(sc.x - this.x))) return 'pounce';
    if (sc) return 'sniff';
    if (this.age >= 3 && W.trackNear(this.x, R + 6)) return 'look';
    if (W.phase === 'winter' && !(W.chase && W.chase.on) && !this.flags.feasted && W.herd.length && W.herd.some(e => e.x - this.x > 60 && e.x - this.x < 420) && W.packHead() !== null && Math.abs(W.packHead() - this.x) < 160) return 'run';
    if (this.age === 4 && !this.flags.lone && !this.flags.guarded && Math.abs(this.x - W.den.x) < R + 30 && W.pups.length) return 'guard';
    const mate2 = W.pack.find(n => n.role === 'sib' && n.mode !== 'play' && n.mode !== 'tossed' && near(n)); if (mate2) return 'play';
    const little = W.pups.find(q => !q.inDen && q.mode !== 'tossed' && near(q, 4)); if (little) return 'play';
    return null;
  }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    const R = this.reach();
    if (v === 'drink') this.startBusy('drink', 1.5, W.mum());
    else if (v === 'eat') { const n = W.pack.find(n => n.meal && Math.abs(n.x - this.x) < R + n.len * .4 + 6); this.face = sign(n.x - this.x) || this.face; this.startBusy('eat', 1.8, n); }
    else if (v === 'play') { const n = W.pack.find(n => n.role === 'sib' && n.mode !== 'play' && Math.abs(n.x - this.x) < R + n.len * .4 && !n.inDen) ; if (n) this.startPlay(n); else { const q = W.pups.find(q => !q.inDen && Math.abs(q.x - this.x) < R + q.len * .4 + 4); if (q) { this.face = sign(q.x - this.x) || this.face; this.startBusy('play', 2, q); } } }
    else if (v === 'pounce') { const h = W.hopperNear(this.x, this.y + this.feet, R); this.face = sign(h.x - this.x) || this.face; this.startBusy('pounce', .9, h); }
    else if (v === 'sniff') { const hp = W.postNear(this.x, R + 10), s = hp && hp.home && !this.flags.postSniffed && this.age <= 4 && !this.flags.lone ? hp : W.scentNear(this.x, this.y, R + 8); this.startBusy('sniff', 1.4, s); }
    else if (v === 'look') { const t = W.trackNear(this.x, R + 6); this.face = sign(t.x - this.x) || this.face; this.startBusy('look', 1.4, t); }
    else if (v === 'mark') { const q = W.postNear(this.x, R + 10); this.face = sign(q.x - this.x) || this.face; this.startBusy('mark', 1.3, q); }
    else if (v === 'meet') { const o = W.mate(); this.face = sign(o.x - this.x) || this.face; this.startBusy('meet', 2.2, o); }
    else if (v === 'hello') { const o = W.biologist; this.face = sign(o.x - this.x) || this.face; this.startBusy('hi', 2.2, o); }
    else if (v === 'dig') this.makeDen();
    else if (v === 'carry') { const obj = this.mode === 'burrow' || this.sex === 'girl' && this.flags.pupsBorn ? W.pups.find(q => q.wandered) : W.meal; this.startBusy('carry', .8, obj); }
    else if (v === 'give') this.startBusy('give', 1.6, W.mate());
    else if (v === 'feed') this.startBusy('nurse', 2.4, null);
    else if (v === 'bark') { this.face = sign(W.denRaven.x - this.x) || this.face; this.startBusy('bark', 1, W.denRaven); }
    else if (v === 'run') this.startChase();
    else if (v === 'guard') this.startBusy('guard', 3, null);
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; this.target = null; if (kind === 'play' || kind === 'pounce') this.bowT = t; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy, W = this.W, P = this.G.particles;
    this.busy -= dt;
    if (k === 'drink' && Math.random() < dt * 4) P.text(this.x + rnd(-6, 6), this.y - this.h, '♥', '#ffd0e0', 8);
    if (k === 'eat' && Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.munch && AudioFX.munch(); P.puff(this.x + this.face * this.w * .4, this.y, '#c8a070', 2); }
    if ((k === 'meet' || k === 'hi' || k === 'play') && Math.random() < dt * 8) P.text(this.x + rnd(-20, 20), this.y - this.h - 10, k === 'hi' ? '👋' : '♥', '#ff7aa8', 14);
    if (k === 'sniff' && Math.random() < dt * 10) P.puff(this.x + this.face * this.w * .45, this.y - this.h * .2, '#ffe9a0', 1);
    if (k === 'nurse' && Math.random() < dt * 5) P.text(this.x + rnd(-14, 14), this.y - this.h * .6, '♥', '#ffd0e0', 10);
    if (k === 'pounce' && o && t0 > .25 && !o.hopped2) { o.hopped2 = true; W.hop(o, sign(o.x - this.x) || this.face, 1.4); }
    if (k === 'guard') this.face = this.W.den.dir ? -this.W.den.dir : this.face;
    if (this.busy > 0) return;
    this.busy = 0;
    if (k === 'drink') { this.food = Math.min(this.food + 3, this.growTh); this.stats.drinks++; this.warmth = 1; if (!this.flags.drank) { this.flags.drank = true; Bus.emit('firstDrink', this); } Bus.emit('drank', this); }
    if (k === 'eat' && o) { o.meal = false; o.mealWait = undefined; if (o.temp) o.leaveIn = 4; else { o.roam = 140; o.home = o.x; } this.food = Math.min(this.food + 5, this.growTh); this.stats.meals++; if (!this.flags.ateMeal) { this.flags.ateMeal = true; Bus.emit('firstMeal', this); } Bus.emit('ateMeal', this); }
    if (k === 'play' && o) { this.stats.plays++; o.wag = 4; o.playT = 0; Bus.emit('played', this, o); if (o.role === 'newpup' || o.role === 'ownpup') Bus.emit('babysat', this, o); if (!this.flags.played) { this.flags.played = true; Bus.emit('firstPlay', this); } }
    if (k === 'pounce') { this.stats.pounces++; if (o) o.hopped2 = false; if (!this.flags.pounced) { this.flags.pounced = true; Bus.emit('firstPounce', this); } Bus.emit('pounced', this); this.say('away'); }
    if (k === 'sniff' && o) {
      if (o.kind && SCENT_KINDS[o.kind]) { o.sniffed = true; o.sniffedAt = o.t; this.stats.sniffs++; if (!this.learned.scents.includes(o.kind)) this.learned.scents.push(o.kind); if (!this.flags.sniffed) { this.flags.sniffed = true; Bus.emit('firstSniff', this, o); } Bus.emit('sniffed', this, o); }
      else { this.flags.postSniffed = true; Bus.emit('firstPost', this, o); }
    }
    if (k === 'look' && o) { o.seen = true; this.stats.looks++; if (!this.learned.tracks.includes(o.kind)) this.learned.tracks.push(o.kind); if (!this.flags.looked) { this.flags.looked = true; Bus.emit('firstTrack', this, o); } Bus.emit('looked', this, o); }
    if (k === 'mark' && o) { o.marked = true; this.stats.marks++; W.G.particles.sparkle(o.x, o.y - 10, 10, '#ffe9a0', 12); Bus.emit('marked', this, o); if (W.posts.filter(q => !q.home && q.marked).length >= this.D.marks && !this.flags.marksDone) { this.flags.marksDone = true; Bus.emit('marksDone', this); } }
    if (k === 'meet' && o) { this.flags.met = true; o.following = true; o.roam = 0; Bus.emit('met', this, o); }
    if (k === 'hi' && o) { o.met = true; Bus.emit('biologistMet', this, o); }
    if (k === 'carry' && o) { if (o === W.meal) { o.taken = true; W.meal = null; this.carrying = 'meal'; Bus.emit('carrying', this, 'meal'); } else { this.carrying = 'pup'; this.carryObj = o; o.inDen = true; o.carried = true; o.mode = 'lie'; this.carryForm = o.form; Bus.emit('carrying', this, 'pup'); } }
    if (k === 'give') { this.carrying = null; this.stats.mealsGiven++; if (!this.flags.gave) { this.flags.gave = true; Bus.emit('firstGiven', this); } Bus.emit('given', this); }
    if (k === 'nurse') { this.stats.nurses++; if (!this.flags.nursed) { this.flags.nursed = true; Bus.emit('firstNurse', this); } Bus.emit('nursed', this); }
    if (k === 'bark' && o) { o.state = 'away'; o.t = 0; o.dir = -this.face; this.stats.barks++; AudioFX.bark && AudioFX.bark(); Bus.emit('barked', this, o); }
    if (k === 'guard') { this.flags.guarded = true; this.stats.guards++; Bus.emit('guarded', this); }
  }

  /* ---------- play-fights with a litter-mate ----------
     Tap Space to push.  A ring shrinks round and round: press E (or up)
     while it is green for a BIG POUNCE.  Bowl them over and they roll,
     get up wagging and ask for more; lose and you roll instead. */
  startPlay(n) {
    if (!n) return;
    this.mode = 'play'; this.target = null;
    this.face = sign(n.x - this.x) || 1; n.face = -this.face; n.mode = 'play'; n.playT = 0;
    const gap = (this.w + n.len) * .34, mid = (this.x + n.x) / 2;
    this.wr = { rival: n, p: 0, ring: 0, t: 0, done: null, doneT: 0, mid, gap, flash: 0, taps: 0, shoves: 0 };
    this.stats.plays++;
    if (!this.flags.played) { this.flags.played = true; Bus.emit('firstPlay', this); }
    Bus.emit('playStart', this, n);
  }
  shoveWindow() { const w = this.wr; if (!w) return false; const u = (w.ring % 1.8) / 1.8; const wide = this.G.settings.difficulty === 'easy' ? .3 : this.G.settings.difficulty === 'hard' ? .14 : .2; return u > .9 - wide && u < .93; }
  updatePlay(dt) {
    const w = this.wr, R = w.rival, inp = this.input, D = this.D, S = this.S;
    w.t += dt; w.flash = Math.max(0, w.flash - dt * 3);
    if (w.done) {
      w.doneT += dt;
      if (w.done === 'win') { this.bowT = .5; if (w.doneT > .5 && R.mode === 'play') { R.mode = 'tossed'; R.vx = this.face * 110; R.vy = -150; AudioFX.toss && AudioFX.toss(); } if (w.doneT > 1.1) this.endPlay(); }
      else if (w.doneT > .4 && this.mode === 'play') { this.mode = 'tossed'; this.vx = -this.face * 100; this.vy = -140; this.spin = 0; R.mode = 'stand'; R.wag = 3; AudioFX.toss && AudioFX.toss(); }
      return;
    }
    const str = 1 + (this.kg - R.kg) / Math.max(4, R.kg) * .6;
    const rStr = D.rival * Math.pow(R.kg / Math.max(.4, this.kg), .8);
    w.ring += dt;
    if (inp.actionPressed) { w.p += .06 * str; w.taps++; this.bowT = .3; AudioFX.yip && AudioFX.yip(); this.G.particles.dust(w.mid, this.y + this.feet, '#c8b890', 2); }
    const big = inp.eggPressed || (inp.y < -.6 && !this._upHeld);
    this._upHeld = inp.y < -.6;
    if (big) {
      if (this.shoveWindow()) { w.p += .26 * str; w.flash = 1; w.shoves++; this.bowT = .4; AudioFX.heave && AudioFX.heave(); this.G.particles.sparkle(w.mid, this.y - 10, 12, '#fff3b0', 16); }
      else w.p -= .05;
    }
    w.p -= rStr * .17 * dt * (1 + Math.sin(w.t * 1.7) * .4);
    w.p = clamp(w.p, -1, 1);
    const shove = w.p * 12;
    this.x = w.mid - this.face * w.gap + this.face * shove; R.x = w.mid + this.face * w.gap + this.face * shove;
    this.y = S.walkTop(this.x, 6) - this.feet; R.y = S.walkTop(R.x, 6) - R.feet;
    this.walk += dt * 8 * (1 + Math.abs(w.p)); this.moving = true; R.walk = this.walk;
    if (w.p >= 1) { w.done = 'win'; this.stats.wins++; Bus.emit('playWon', this, R); }
    else if (w.p <= -1) { w.done = 'lose'; this.stats.losses++; Bus.emit('playLost', this, R); }
  }
  endPlay() { this.wr = null; this.mode = 'walk'; this.moving = false; }
  updateTossed(dt) {
    const S = this.S;
    this.vy += 600 * dt; this.vx *= Math.exp(-dt * 1.2);
    this.x = clamp(this.x + this.vx * dt, WORLD.left + 40, WORLD.right - 40); this.y += this.vy * dt; this.spin += dt * 10 * (this.vx >= 0 ? 1 : -1);
    const top = S.walkTop(this.x, this.span()) - this.feet;
    if (this.y >= top && this.vy > 0) { this.y = top; this.mode = 'walk'; this.spin = 0; this.vx = this.vy = 0; const pushed = !!this.wr; this.wr = null; this.stats.tumbles++; Bus.emit(pushed ? 'tossedDown' : 'knockedDown', this); }
  }
  /* the bison turns: the pack scatters and you tumble, unhurt */
  knock(dir) { if (this.mode !== 'walk' && this.mode !== 'chase' || this.busy > 0) return; this.mode = 'tossed'; this.vx = dir * 60; this.vy = -120; this.spin = 0; Bus.emit('missed', this); }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'mode', 'age', 'x', 'y', 'face', 'food', 'full', 'kg', 'warmth', 'burrow', 'carrying', 'stats', 'flags', 'learned']) o[k] = this[k];
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    this.age = clamp(Math.round(num(o.age, 1)), 1, 5);
    const modes = this.age === 1 ? ['den'] : ['walk', 'burrow'];
    this.mode = modes.includes(o.mode) ? o.mode : modes[0];
    this.x = clamp(num(o.x, this.x), WORLD.left + 40, WORLD.right - 40); this.y = clamp(num(o.y, this.y), WORLD.top + 100, WORLD.bottom - 40);
    this.face = o.face === -1 ? -1 : 1;
    this.food = Math.max(0, num(o.food, 0)); this.full = !!o.full;
    this.warmth = clamp(num(o.warmth, 1), 0, 1);
    this.burrow = o.burrow && Number.isFinite(o.burrow.x) && Number.isFinite(o.burrow.y) ? { x: o.burrow.x, y: o.burrow.y } : null;
    this.carrying = o.carrying === 'meal' ? 'meal' : null;
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    if (o.learned && typeof o.learned === 'object') { this.learned.tracks = Array.isArray(o.learned.tracks) ? o.learned.tracks.filter(k => TRACK_KINDS[k]) : []; this.learned.scents = Array.isArray(o.learned.scents) ? o.learned.scents.filter(k => SCENT_KINDS[k]) : []; }
    /* a gated step that was waiting when the game closed starts again by itself */
    for (const k of ['eyesGate', 'outGate', 'rvGate', 'travelGate', 'yearGate', 'loneGate', 'deepNow', 'coldSaid', 'swamSaid', 'lostPack', 'pupsAtSea', 'm_pups', 'litterHowled']) delete this.flags[k];
    if (this.flags.m_eyes && !this.flags.eyesOpen) delete this.flags.m_eyes;
    this.kg = wolfKG(this.age, this.food, this.th, this.sex);
    const S = this.S;
    if (this.mode === 'walk') this.y = S.walkTop(this.x, this.span()) - this.feet;
    else if (!S.free(this.x, this.y, this.r * .6, false)) { S.blob(this.x, this.y, Math.max(16, this.w * .5), Math.max(12, this.h * .7), MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL); S.flushTop(); }
  }
}
