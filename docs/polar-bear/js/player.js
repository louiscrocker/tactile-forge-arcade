/* ============================================================
   player.js — you, the polar bear, from the snow den to cubs of your own
   ============================================================
   age 1  newborn   blind in the snow den (mode den): wriggle to
                    your mum and drink; your eyes open; grow until
                    Mum breaks the den open
   age 2  cub       March by the den: play-fight your twin, stand up
                    and sniff the wind, belly-slide down the drift,
                    drink when Mum lies down, the Arctic fox
   age 3  sea cub   the long walk to the sea (tracks, a blizzard in
                    the lee of the big rock), the spring sea ice:
                    wait still at a breathing hole, creep up on a
                    resting seal (it always slips away), Mum's meal,
                    lost in a whiteout (sniff to find her), the ice
                    breaks up: swim to shore; summer on land (the
                    scientists' buggy, lemmings, belugas), autumn,
                    the northern lights, freeze-up
   age 4  yearling  back on the ice: your own breathing hole, your
                    own careful creep, play with your twin; then
                    on your own: over a pressure ridge, across a lead,
                    play-sparring with young males
   age 5  grown     sniff another bear's scent and meet; boy: spar
                    with a big male, summer with the big males; girl:
                    dig a den in the peat bank, cubs in midwinter,
                    feed them, carry a wanderer home, their first sniff
                    of the sea wind.  Then the next generation.
   modes: den · walk (and swimming) · burrow (digging / inside a den)
          · rest (curled up warm) · sleep (a time-lapse) · play
          (a play-fight) · still (waiting at a hole) · stalk (creeping
          up on a seal) · slide (a belly slide) · sniff (the sniff
          game) · tossed
   Nothing hurts the bear, ever: seals slip away, a lost play-fight
   is a roll in the snow, cold means a curl-up and a rest.
   ============================================================ */
'use strict';

const SLEEP_T = 2.6, REST_T = 2.4, SNIFF_RING = 2.2;

class Bear {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'cream';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'bear'; this.mode = 'den'; this.age = 1;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false, hold: false };
    this.t = 0; this.phase = 0;
    this.food = 0; this.full = false; this.kg = .6;
    this.warmth = 1; this.wet = 0; this.snowy = 0;
    this.walk = 0; this.moving = false; this.spin = 0; this.sleepT = 0; this.restT = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.burrow = null; this.wr = null; this.sw = null; this.st = null; this.sk = null; this.sl = null; this.carrying = null; this.carryObj = null;
    this.standT = 0; this.sniffHeld = 0; this.bowT = 0;
    this.hintClock = 0; this.digClock = 0; this.shade = 'open'; this.target = null;
    this.stats = { drinks: 0, meals: 0, plays: 0, wins: 0, losses: 0, windSniffs: 0, goodSniffs: 0, pounces: 0, sniffs: 0, looks: 0, swims: 0, slides: 0, waits: 0, stalks: 0, closes: 0, dug: 0, dens: 0, nurses: 0, carries: 0, tumbles: 0, rests: 0, shelters: 0, waves: 0, swimTime: 0 };
    this.flags = {};
    this.learned = { tracks: [], scents: [] };
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get th() { return this.D.grow; }
  /* the drawn length of the bear, its height, and how far its middle sits above its paws */
  get w() { return bearUnits(this.kg); }
  get h() { return this.w * .55; }
  get feet() { return this.h * .6; }
  get r() { return this.h * .45; }
  get age01() { return Sprites.ageOf(this.kg); }
  /* the walking surface ignores holes narrower than this (a seal's hole, a den mouth) */
  span() { return Math.max(this.w * .45, 26); }
  get swimming() { return (this.mode === 'walk' || this.mode === 'sniff') && this.W.inWater(this.x, this.y + this.feet - 2); }
  get underground() { return (this.mode === 'den' || this.mode === 'burrow') && this.y > this.S.topAt(this.x) - 2; }
  get depth() { return this.y - this.S.surfaceAt(this.x); }
  get busyNow() { return this.busy > 0; }
  stageKey() {
    if (this.age <= 1) return 'newborn';
    if (this.age === 2) return 'cub';
    if (this.age === 3) return 'seacub';
    if (this.age === 4) return this.flags.alone ? 'young' : 'yearling';
    return this.flags.cubsBorn || this.flags.cubsSeen ? 'parent' : 'adult';
  }
  /* the food needed for the next growth step */
  get growTh() { return this.age < 5 ? this.th[this.age - 1] : this.th[3] * BONUS; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.bowT = Math.max(0, this.bowT - dt);
    this.wet = Math.max(0, this.wet - dt * .12); this.snowy = Math.max(0, this.snowy - dt * .05);
    this.kg = bearKG(this.age, this.food, this.th, this.sex);
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
      case 'still': this.updateStill(dt); break;
      case 'stalk': this.updateStalk(dt); break;
      case 'slide': this.updateSlide(dt); break;
      case 'sniff': this.updateSniffGame(dt); break;
      case 'tossed': this.updateTossed(dt); break;
    }
    /* a plain stand-up-and-sniff anywhere: hold E (not during a timing game) */
    if (this.mode === 'walk' || this.mode === 'den' || this.mode === 'burrow') this.plainSniff(dt);
    /* growth: the next stage waits for its page */
    this.checkGrowth();
    inp.actionPressed = false; inp.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y;
    if (this.mode === 'walk' || this.mode === 'stalk') {
      if (Math.abs(dx) < Math.max(4, this.w * .25)) { this.target = null; return; }
      this.input.x = sign(dx); this.input.y = 0;
    } else if (this.mode === 'den' || this.mode === 'burrow') { const d = Math.hypot(dx, dy); if (d < Math.max(4, this.r)) { this.target = null; return; } this.input.x = dx / d; this.input.y = dy / d; }
    else this.target = null;
  }
  goTo(x, y) { if (['sleep', 'rest', 'play', 'sniff', 'tossed', 'still', 'slide'].includes(this.mode) || this.busy > 0) return; this.target = { x, y }; }

  /* ---------- warmth: a blizzard, icy water and the night chill a cub; snuggling, the den and a curl-up warm it ---------- */
  updateWarmth(dt) {
    const W = this.W, D = this.D, G = this.G;
    const shade = this.mode === 'den' || this.underground ? 'den' : W.shadeAt(this.x, this.y + this.feet - 1, this.h);
    const night = nightAmount(G.tod), season = W.season, moving = this.moving ? .6 : 1;
    /* fat and fur: a grown bear hardly feels the cold */
    const thin = this.age <= 2 ? 1 : this.age === 3 ? .8 : this.age === 4 ? .4 : .2;
    let rate = 0;
    if (shade === 'den') rate = .03;
    else if (shade === 'water') rate = -.05 * D.cold * thin;
    else {
      const base = season === 'winter' ? -.007 : season === 'spring' ? -.004 : season === 'autumn' ? -.003 : .01;
      rate = (base - W.weather.white * .014 - night * .003) * D.cold * thin * moving;
      if (shade === 'lee') rate += .008;
      const mum = W.mum(); if (mum && this.age <= 3 && !mum.inDen && Math.abs(mum.x - this.x) < 60 && !this.swimming) rate += .02;
    }
    if (this.mode === 'rest' || this.mode === 'sleep') rate = .08;
    if (this.mode === 'play' || this.mode === 'slide') rate = Math.max(rate, .005);
    if (this.age <= 1) rate = Math.max(rate, .01);
    this.warmth = clamp(this.warmth + rate * dt, 0, 1);
    if (shade === 'lee' && this.shade !== 'lee' && W.weather.state === 'blizzard') { this.stats.shelters++; Bus.emit('sheltered', this); }
    this.shade = shade;
    if (shade === 'water' && this.mode === 'walk') { this.stats.swimTime += dt; this.wet = 1; }
    if (shade === 'water' && !this.flags.swamSaid && this.mode === 'walk') { this.flags.swamSaid = true; this.stats.swims++; Bus.emit('swimStart', this); }
    if (shade !== 'water') this.flags.swamSaid = false;
    if (this.warmth < .28 && !this.flags.coldSaid && this.mode === 'walk') { this.flags.coldSaid = true; Bus.emit('cold', this); }
    if (this.warmth > .6) this.flags.coldSaid = false;
    if (this.warmth <= 0 && this.mode === 'walk' && this.busy <= 0 && !this.swimming) { this.mode = 'rest'; this.restT = 0; this.target = null; Bus.emit('tooCold', this); }
  }

  /* ============================================================
     IN THE SNOW DEN (newborn)
     ============================================================ */
  updateDen(dt) {
    const S = this.S, inp = this.input;
    if (inp.actionPressed) { if (this.act()) return; }
    let mx = inp.x, my = inp.y; const m = Math.hypot(mx, my);
    if (m > .1) {
      mx /= m; my /= m;
      const sp = 9 + this.kg * 2, nx = this.x + mx * sp * dt, ny = this.y + my * sp * dt * .6;
      /* a newborn stays inside the den: never out into the open air */
      if (S.free(nx, ny, this.r * .8, true)) { this.x = nx; this.y = ny; this.moving = true; this.walk += dt * 8; if (Math.abs(mx) > .3) this.face = sign(mx); }
      else if (S.free(nx, this.y, this.r * .8, true)) { this.x = nx; this.moving = true; this.walk += dt * 8; }
      else this.moving = false;
    } else this.moving = false;
    /* settle onto the floor of the den */
    for (let k = 0; k < 3 && S.free(this.x, this.y + 1.5, this.r * .8, true); k++) this.y += 1.5;
  }
  checkGrowth() {
    const th = this.th, W = this.W, walking = this.mode === 'walk' && this.busy <= 0;
    if (this.age === 1 && !this.flags.eyesOpen && this.food >= th[0] * .4 && !this.flags.eyesGate) { this.flags.eyesGate = true; this.milestone('eyes', () => { this.flags.eyesOpen = true; Bus.emit('eyesOpen', this); }); }
    if (this.age < 5 && this.food >= this.growTh && !this.full) { this.full = true; Bus.emit('fullBear', this); }
    if (this.full && this.age === 1 && this.flags.eyesOpen && !this.flags.outGate && this.mode === 'den') { this.flags.outGate = true; this.milestone('out', () => this.growUp()); }
    if (this.full && this.age === 2 && !this.flags.trekGate && walking) { this.flags.trekGate = true; this.milestone('trek', () => this.growUp()); }
    /* the ice has broken up: back on land, summer begins */
    if (this.age === 3 && W.phase === 'breakup' && !this.flags.shoreGate && walking && !this.swimming && this.x < WORLD.shoreX - 30) { this.flags.shoreGate = true; this.milestone('shore', () => { this.flags.summer = true; Bus.emit('ashore', this); }); }
    if (this.full && this.age === 3 && this.flags.frozen && !(this.G.time < (this.frozenT || 0) + 6) && !this.flags.yearGate && walking) { this.flags.yearGate = true; this.milestone('yearling', () => this.growUp()); }
    if (this.age === 4 && !this.flags.alone && this.flags.soloWait && this.flags.soloStalk && this.stats.plays >= (this.flags.playsAtYear || 0) + 1 && this.food >= th[2] + (th[3] - th[2]) * .5 && !this.flags.leaveGate && walking && !this.swimming) { this.flags.leaveGate = true; this.milestone('leave', () => this.goAlone()); }
  }
  /* a time-lapse: weeks or years go by, and you wake up bigger */
  growUp() {
    const S = this.S, W = this.W, d = W.den;
    this.age++; this.full = false; this.food = Math.max(this.food, this.th[this.age - 2]); this.kg = bearKG(this.age, this.food, this.th, this.sex);
    this.target = null; this.carrying = null; this.flags.inDen = false;
    if (this.age === 2) { this.x = d.x + 40; this.y = S.walkTop(this.x, this.span()) - this.feet; this.face = 1; this.mode = 'sleep'; }
    else if (this.age === 3) { this.x = d.x + 150; this.y = S.walkTop(this.x, this.span()) - this.feet; this.face = 1; this.mode = 'sleep'; }
    else if (this.age === 4) { this.x = WORLD.holes[0] + 70; this.y = S.walkTop(this.x, this.span()) - this.feet; this.face = 1; this.mode = 'sleep'; this.flags.playsAtYear = this.stats.plays; }
    else { this.mode = 'sleep'; }
    this.sleepT = SLEEP_T; this.warmth = 1;
    Bus.emit('grewUp', this, this.age);
  }
  /* two and a half years old: Mum and the cubs go their own ways */
  goAlone() {
    this.flags.alone = true; this.full = false; this.target = null;
    this.mode = 'sleep'; this.sleepT = SLEEP_T; this.warmth = 1;
    Bus.emit('wentAlone', this);
  }

  /* ============================================================
     ON THE SNOW, ON THE ICE, IN THE WATER
     ============================================================ */
  speed() {
    const base = this.age === 2 ? 34 : this.age === 3 ? 50 : this.age === 4 ? 64 : 70;
    return base * (this.G.settings.slowmo ? .7 : 1);
  }
  updateWalk(dt) {
    const S = this.S, W = this.W, inp = this.input, w = this.w;
    if (inp.actionPressed) { if (this.act()) return; }
    const slope = S.slopeAt(this.x, this.span());
    const water = this.swimming, snow = W.snowAt(this.x), deep = snow > 10;
    const sp = this.speed() * (water ? .6 * this.D.swim : 1) / (deep ? 1 + snow / 30 : 1);
    if (Math.abs(inp.x) > .15) {
      const dx = inp.x * sp * dt / (1 + Math.abs(slope) * 1.1);
      const nx = clamp(this.x + dx, WORLD.left + 40, WORLD.right - 40);
      /* a little cub stays near Mum and the den */
      const mum = W.mum();
      const leash = this.age === 2 && mum ? Math.abs(nx - W.den.x) > 600 && Math.abs(nx - W.den.x) > Math.abs(this.x - W.den.x) : false;
      if (leash) { this.say('toofar'); }
      else { this.x = nx; this.walk += dt * (water ? 6 : 10) * Math.abs(inp.x); this.moving = true; this.face = sign(inp.x); if (snow > 0) S.breakTrail(this.x, this.y + this.feet - 2, Math.max(6, this.h * .3)); }
    } else this.moving = false;
    const top = S.walkTop(this.x, this.span());
    this.y = top - this.feet + (deep ? Math.min(snow, this.h * .3) * .4 : 0);
    if (water) { this.y = Math.min(this.y, WORLD.seaY - this.h * .2); this.wet = 1; if (Math.random() < dt * 6) this.G.particles.bubbles(this.x - this.face * w * .3, this.y + this.feet * .4, 2, .8); }
    if (deep && this.moving) this.snowy = Math.min(1, this.snowy + dt * .3);
    this.ang = angleLerp(this.ang, water ? 0 : clamp(Math.atan(slope), -1, 1) * .5, clamp(dt * 8, 0, 1));
    if (inp.y > .6 && !this._downHeld) this.tryDig();
    this._downHeld = inp.y > .6;
    /* places you pass: the sea ice, a pressure ridge, a lead */
    if (this.age >= 3 && W.ground.iceOn && W.ground.isSea(this.x) && !water && !this.flags.onIce) { this.flags.onIce = true; Bus.emit('onIce', this); }
    if (W.ground.iceMode === 'solid' && WORLD.ridges.some(rx => Math.abs(rx - this.x) < 20) && !this.flags['ridge' + this.age]) { this.flags['ridge' + this.age] = true; Bus.emit('ridge', this); }
    if (water && W.ground.iceMode === 'solid' && this.x > WORLD.leadL && this.x < WORLD.leadR && !this.flags.leadSwum) { this.flags.leadSwum = true; Bus.emit('leadSwim', this); }
  }
  /* push down: into a den mouth, or dig into the soft peat bank (only a grown girl in autumn digs a den) */
  tryDig() {
    const S = this.S, W = this.W, foot = this.y + this.feet;
    const atMouth = this.flags.denMade && W.newDen && Math.abs(this.x - W.newDen.x) < Math.max(26, this.w * .5);
    const hole = atMouth || S.topAt(this.x) - S.walkTop(this.x, this.span()) > this.h * .5;
    if (!(this.age >= 5 && this.flags.denTime)) return;
    /* the cubs have just come out: Mum stays out with them until their first sniff of the wind */
    if (this.flags.cubsOut && !this.flags.cubsSniffed) return;
    const softAt = (x) => { for (let y = foot - 4; y < foot + 16; y += 3) { const m = S.matAt(x, y); if (m !== MAT.AIR) return m === MAT.SOIL || m === MAT.SNOW; } return false; };
    let dx = null;
    for (const o of [0, -4, 4, -8, 8, -this.w * .3, this.w * .3]) if (softAt(this.x + o)) { dx = o; break; }
    if (!hole && this.flags.denMade) { this.say('outden'); return; }
    if (!hole && dx === null) { this.say('rock'); return; }
    if (!hole && (this.x < WORLD.bankL || this.x > WORLD.bankR)) { this.say('den'); return; }
    if (!hole) this.x += dx;
    this.mode = 'burrow'; this.ang = Math.PI / 2; this.target = null;
    /* into a finished den: step just inside the tunnel, so the slope never wedges you at the mouth */
    if (atMouth) { const nd = W.newDen, rr = Math.max(10, this.h * .5 + 2) * .66; let t = .3; for (let u = .15; u <= .9; u += .05) if (S.free(lerp(nd.x, nd.cx, u), lerp(nd.y, nd.cy, u), rr, false)) { t = u; break; } this.x = lerp(nd.x, nd.cx, t); this.y = lerp(nd.y, nd.cy, t); this.ang = Math.atan2(nd.cy - nd.y, nd.cx - nd.x); this.face = sign(nd.cx - nd.x); this.flags.inDen = true; return; }
    if (!hole && (!this.burrow || Math.abs(this.burrow.x - this.x) > 50)) { this.burrow = { x: this.x, y: S.surfaceAt(this.x) }; this.stats.dens++; Bus.emit('digStart', this); }
    this.y += 2;
  }
  updateBurrow(dt) {
    const S = this.S, inp = this.input, D = this.D, W = this.W;
    if (inp.actionPressed) { if (this.act()) return; }
    let mx = inp.x, my = inp.y;
    const digging = this.age >= 5 && this.flags.denTime && !this.flags.denMade;
    /* a new den slants down into the bank, the way real dens do (the slope is downhill to the right, so dig left, into the hill) */
    if (my > .5 && Math.abs(mx) < .3 && digging) { mx = -.8; my = .6; }
    /* inside a finished den, up and down follow the tunnel: out to the mouth, or down to the round room */
    else if (this.flags.denMade && Math.abs(mx) < .5) {
      if (my < -.5 && this.burrow) { mx = this.burrow.x - this.x; my = (this.burrow.y - this.feet - 6) - this.y; }
      else if (my > .5 && W.newDen) { mx = W.newDen.cx - this.x; my = W.newDen.cy - this.y; if (Math.hypot(mx, my) < 4) { mx = 0; my = 0; } }
    }
    const m = Math.hypot(mx, my);
    if (m < .1) { this.moving = false; this.checkDepth(); this.cubCarry(); return; }
    mx /= m; my /= m;
    this.ang = angleLerp(this.ang, Math.atan2(my, mx), clamp(dt * 7, 0, 1));
    if (Math.abs(mx) > .3) this.face = sign(mx);
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang), rad = Math.max(10, this.h * .5 + 2);
    const step = (16 + this.w * .3) * dt;
    const nx = this.x + dx * step, ny = this.y + dy * step;
    this.moving = true; this.walk += dt * 8;
    if (S.free(nx, ny, rad * .66, false)) { this.x = nx; this.y = ny; }
    else if (digging) {
      const hx = this.x + dx * rad * .55, hy = this.y + dy * rad * .55;
      const res = S.dig(hx, hy, rad * 1.08 + 1, D.dig * 1.8, dt, { root: true });
      this.digClock -= dt;
      if (res.cells) {
        this.stats.dug += res.cells;
        if (this.digClock <= 0) { this.digClock = .12; AudioFX.dig && AudioFX.dig(); this.G.particles.dust(hx, hy, '#6a4a32', 3, this.ang); }
        if (S.free(this.x + dx * 1.2, this.y + dy * 1.2, rad * .66, false)) { this.x += dx * 1.2; this.y += dy * 1.2; }
      } else if (res.blocked) {
        if (dy < -.3 && S.survey(this.x, this.y - rad, rad * 1.2).sky > 0) { this.surface(); return; }
        this.say('rock');
        this.slide2(dx, dy, step, rad);
      }
    } else if (!this.slide2(dx, dy, step, rad) && this.flags.denMade && W.newDen) {
      /* her own finished den: heading for the round room or the mouth always gets through */
      const nd = W.newDen, toRoom = Math.atan2(nd.cy - this.y, nd.cx - this.x), toMouth = this.burrow ? Math.atan2(this.burrow.y - this.y, this.burrow.x - this.x) : 9;
      const off = (a) => Math.abs(Math.atan2(Math.sin(this.ang - a), Math.cos(this.ang - a)));
      if (off(toRoom) < .8 || off(toMouth) < .8) { this.x = nx; this.y = ny; }
    }
    if (this.depth < -this.feet * .4 && dy < .2) { this.surface(); return; }
    if (this.depth > Math.max(90, this.w * 2)) this.y -= 1;
    this.checkDepth(); this.cubCarry();
  }
  slide2(dx, dy, step, r) {
    for (const s of [1, -1]) { const a = this.ang + s * 1.1, nx = this.x + Math.cos(a) * step * .6, ny = this.y + Math.sin(a) * step * .6; if (this.S.free(nx, ny, r * .66, false)) { this.x = nx; this.y = ny; return true; } }
    return false;
  }
  checkDepth() {
    const deep = this.depth > this.denDepth();
    if (deep && !this.flags.deepNow && !this.flags.denMade) { this.flags.deepNow = true; Bus.emit('deepEnough', this); }
    if (!deep) this.flags.deepNow = false;
  }
  denDepth() { return Math.min(this.h * 1.4 + 6, 76); }
  denReady() { return this.mode === 'burrow' && this.age >= 5 && this.flags.denTime && !this.flags.denMade && this.depth > this.denDepth(); }
  surface() {
    const S = this.S;
    this.mode = 'walk'; this.ang = 0; this.flags.inDen = false; this.y = S.walkTop(this.x, this.span()) - this.feet;
    this.G.particles.dust(this.x, this.y + this.feet, '#e8eef8', 6, -Math.PI / 2);
    Bus.emit('surfaced', this);
  }
  /* finish the den: a round room where you stand */
  makeDen() {
    const S = this.S, W = this.W;
    S.blob(this.x, this.y, Math.max(30, this.w * .5), Math.max(22, this.h * .62), MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL); S.flushTop();
    const dir = this.burrow && this.x < this.burrow.x ? -1 : 1;
    W.newDen = { x: this.burrow ? this.burrow.x : this.x, y: this.burrow ? this.burrow.y : S.surfaceAt(this.x), cx: this.x, cy: this.y, dir };
    this.flags.denMade = true; this.flags.inDen = true;
    this.G.particles.sparkle(this.x, this.y, 20, '#fff3c0', this.w * .5);
    Bus.emit('denMade', this);
  }
  /* a carried cub is put down by itself once you are back in the round room */
  cubCarry() {
    const W = this.W;
    if (this.carrying !== 'cub' || !W.newDen) return;
    const q = this.carryObj; if (!q) { this.carrying = null; return; }
    if (Math.hypot(this.x - W.newDen.cx, this.y - W.newDen.cy) < 26) {
      q.x = W.newDen.cx + 10; q.y = W.newDen.cy + 8; q.inDen = true; q.carried = false; q.mode = 'lie'; q.wandered = false; this.carrying = null; this.carryObj = null;
      this.stats.carries++; Bus.emit('cubHome', this, q);
    }
  }

  /* ---------- stand up and sniff the wind: hold E; in the sniff game let go when the ring is green ---------- */
  plainSniff(dt) {
    const inp = this.input;
    if (inp.hold && this.busy <= 0 && !this.swimming) {
      if (this.sniffHeld === 0) { if (this.wantsSniffGame()) { this.startSniffGame(); return; } AudioFX.sniff && AudioFX.sniff(this.age); }
      this.sniffHeld += dt; this.standT = 1; this.moving = false;
    } else if (this.sniffHeld > 0) {
      this.sniffHeld = 0; this.stats.windSniffs++;
      if (!this.flags.sniffedWind) { this.flags.sniffedWind = true; Bus.emit('firstWindSniff', this); }
      Bus.emit('windSniff', this);
    }
    this.standT = Math.max(0, this.standT - dt * (inp.hold ? 0 : 2.5));
  }
  wantsSniffGame() { return !!(this.flags.lostMum || (this.age >= 5 && this.W.phase === 'adult' && !this.flags.scentFound) || (this.sex === 'girl' && this.flags.cubsOut && !this.flags.cubsSniffed)); }
  startSniffGame() {
    const kind = this.flags.lostMum ? 'lost' : this.flags.cubsOut ? 'cubs' : 'scent';
    this.mode = 'sniff'; this.target = null; this.moving = false;
    this.sw = { kind, ring: 0, good: 0, miss: 0, t: 0, flash: 0, held: false };
    Bus.emit('sniffGame', this, kind);
  }
  sniffWindow() { const h = this.sw; if (!h) return false; const u = (h.ring % SNIFF_RING) / SNIFF_RING; const wide = this.G.settings.difficulty === 'easy' ? .3 : this.G.settings.difficulty === 'hard' ? .14 : .2; return u > .92 - wide && u < .95; }
  updateSniffGame(dt) {
    const h = this.sw, inp = this.input, D = this.D;
    h.t += dt; h.flash = Math.max(0, h.flash - dt * 2);
    this.y = this.S.walkTop(this.x, this.span()) - this.feet;
    if (inp.hold) {
      if (!h.held) { h.held = true; h.ring = 0; AudioFX.sniff && AudioFX.sniff(this.age); }
      h.ring += dt; this.standT = 1; this.sniffHeld += dt;
    } else if (h.held) {
      /* let go: a good sniff lands in the window */
      h.held = false; this.sniffHeld = 0; this.stats.windSniffs++;
      if (this.sniffWindow()) { h.good++; this.stats.goodSniffs++; h.flash = 1; this.G.particles.sparkle(this.x + this.face * this.w * .4, this.y - this.h, 18, '#fff3c0', 20); AudioFX.chuff && AudioFX.chuff(); Bus.emit('goodSniff', this, h.good); if (h.good >= D.sniffs) return this.endSniffGame(true); }
      else { h.miss++; this.say('lostmum'); Bus.emit('sniffMiss', this); }
      h.ring = 0;
    } else this.standT = Math.max(0, this.standT - dt * 2);
    if (!inp.hold && Math.abs(inp.x) > .5) { h.away = (h.away || 0) + dt; if (h.away > .8) return this.endSniffGame(false); } else h.away = 0;
    if (h.t > 90) this.endSniffGame(false);
  }
  endSniffGame(done) {
    const h = this.sw; this.sw = null; this.mode = 'walk'; this.standT = 0;
    if (!done) return;
    if (h.kind === 'lost') { this.flags.lostMum = false; this.flags.found = true; Bus.emit('mumFound', this); }
    else if (h.kind === 'scent') { this.flags.scentFound = true; Bus.emit('scentFound', this); }
    else if (h.kind === 'cubs') { this.flags.cubsSniffed = true; this.milestone('cubs', () => { Bus.emit('cubsSniff', this); }); }
  }

  /* ---------- still-hunting: wait beside a breathing hole and do not move ---------- */
  startStill(hole) {
    if (!hole) return;
    this.mode = 'still'; this.target = null; this.moving = false;
    this.face = sign(hole.x - this.x) || this.face;
    this.st = { hole, q: 0, t: 0, shh: 0, away: 0, done: null, doneT: 0 };
    Bus.emit('stillStart', this, hole);
  }
  updateStill(dt) {
    const s = this.st, inp = this.input, W = this.W;
    s.t += dt; s.shh = Math.max(0, s.shh - dt * 1.5);
    this.y = this.S.walkTop(this.x, this.span()) - this.feet;
    if (s.done) { s.doneT += dt; if (s.doneT > 2.2) this.endStill(true); return; }
    const fidget = Math.abs(inp.x) > .3 || Math.abs(inp.y) > .5 || inp.actionPressed || inp.hold;
    if (fidget) {
      if (s.shh <= 0) { s.q = Math.max(0, s.q - .3); s.shh = 1; this.say('shh'); Bus.emit('fidget', this); }
      if (Math.abs(inp.x) > .3) { s.away += dt; if (s.away > 1.2) return this.endStill(false); }
    } else { s.away = 0; s.q = Math.min(1, s.q + dt / this.D.still); }
    if (s.q >= 1) { s.done = 'up'; W.sealUp(s.hole); }
  }
  endStill(counted) {
    const s = this.st; this.st = null; this.mode = 'walk';
    if (!counted) return;
    this.stats.waits++;
    if (this.age === 4 && !this.flags.alone) this.flags.soloWait = true;
    Bus.emit('waited', this, s.hole);
  }

  /* ---------- the careful creep: up to a resting seal while its head is down ---------- */
  startStalk() {
    const b = this.W.bask; if (!b || b.state !== 'bask') return;
    this.mode = 'stalk'; this.target = null;
    this.face = sign(b.x - this.x) || this.face;
    this.sk = { t: 0, away: 0, done: null, doneT: 0, start: Math.abs(b.x - this.x) };
    Bus.emit('stalkStart', this, b);
  }
  updateStalk(dt) {
    const k = this.sk, inp = this.input, W = this.W, b = W.bask;
    k.t += dt;
    this.y = this.S.walkTop(this.x, this.span()) - this.feet;
    if (k.done) { this.moving = false; k.doneT += dt; if (k.doneT > 1.8) this.endStalk(true); return; }
    if (!b || b.state !== 'bask') return this.endStalk(false);
    const dir = sign(b.x - this.x), want = inp.x * dir > .3, back = inp.x * dir < -.3;
    if (want) {
      this.x += dir * (16 + this.w * .08) * dt; this.walk += dt * 5; this.moving = true; this.face = dir;
      if (b.look > .55) { k.done = 'saw'; W.baskDive('saw'); }
    } else this.moving = false;
    if (back) { k.away += dt; if (k.away > 1) return this.endStalk(false); } else k.away = 0;
    if (!k.done && Math.abs(b.x - this.x) < this.w * .5 + 22) { k.done = 'close'; W.baskDive('close'); }
  }
  endStalk(counted) {
    const k = this.sk; this.sk = null; this.mode = 'walk'; this.moving = false;
    if (!counted) return;
    this.stats.stalks++; if (k.done === 'close') this.stats.closes++;
    if (this.age === 4 && !this.flags.alone) this.flags.soloStalk = true;
    Bus.emit('stalked', this, k.done);
  }

  /* ---------- a belly slide down a snowy slope ---------- */
  canSlide() {
    const S = this.S; if (this.age > 4 || this.swimming) return false;
    const m = S.surfaceMat(this.x + this.face * 8);
    return (m === MAT.SNOW || m === MAT.DRIFT) && S.slopeAt(this.x + this.face * 24, 24) * this.face > .14;
  }
  startSlide() { this.mode = 'slide'; this.target = null; this.sl = { t: 0, v: 60, flat: 0 }; this.ang = 0; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('slideStart', this); }
  updateSlide(dt) {
    const s = this.sl, S = this.S;
    s.t += dt;
    const slope = S.slopeAt(this.x, 10) * this.face;
    s.v = clamp(s.v + (slope * 260 - 30) * dt, 0, 190);
    this.x = clamp(this.x + this.face * s.v * dt, WORLD.left + 40, WORLD.right - 40);
    this.y = S.walkTop(this.x, this.span()) - this.feet * .55;
    this.ang = angleLerp(this.ang, clamp(Math.atan(slope * this.face), -1, 1) * .7, clamp(dt * 8, 0, 1));
    this.walk += dt * 2; this.moving = true; this.snowy = 1;
    if (Math.random() < dt * 14) this.G.particles.snowKick(this.x + this.face * this.w * .4, this.y + this.feet * .5, 2);
    if (s.v < 12 && s.t > .6 || s.t > 6 || this.W.inWater(this.x, this.y + this.feet)) { this.mode = 'walk'; this.ang = 0; this.sl = null; this.stats.slides++; Bus.emit('slid', this); }
  }

  /* ---------- what Space does right now ---------- */
  reach() { return this.w * .55 + 14; }
  context() {
    const W = this.W, R = this.reach();
    if (this.busy > 0 || ['sleep', 'rest', 'play', 'sniff', 'tossed', 'still', 'stalk', 'slide'].includes(this.mode)) return null;
    if (this.mode === 'den') { const m = W.mum(); return m && Math.hypot(m.x - this.x, m.y - this.y) < R + m.len * .4 ? 'drink' : null; }
    if (this.mode === 'burrow') {
      if (this.denReady()) return 'dig';
      if (this.flags.cubsBorn && this.sex === 'girl' && this.stats.nurses < this.D.nurses && W.cubs.some(q => q.inDen && Math.hypot(q.x - this.x, q.y - this.y) < R + 14)) return 'feed';
      if (!this.carrying && W.cubs.some(q => q.wandered && Math.hypot(q.x - this.x, q.y - this.y) < R + 12)) return 'carry';
      return null;
    }
    if (this.mode !== 'walk') return null;
    const water = this.swimming;
    const near = (n, extra = 0) => n && !n.inDen && !n.gone && Math.abs(n.x - this.x) < R + n.len * .4 + extra && Math.abs(n.y - this.y) < 70;
    if (this.sex === 'girl' && this.flags.cubsBorn && !this.carrying && W.cubs.some(q => q.wandered && !q.inDen && Math.abs(q.x - this.x) < R + 10)) return 'carry';
    const mate = W.mate(); if (mate && !this.flags.met && near(mate, 12)) return 'meet';
    const bug = W.buggy; if (bug && !bug.met && Math.abs(bug.x - this.x) < R + 50 && !water) return 'hello';
    if (W.meal && !W.meal.taken && Math.abs(W.meal.x - this.x) < R + 8 && !water) return 'eat';
    const mum = W.mum(); if (mum && mum.nurseOn && this.age <= 4 && near(mum, 6)) return 'drink';
    if (!water) {
      /* once this stage's hunting is done, the twin right beside you wins over a hole or a far-off resting seal
         (a seal is always resting somewhere near, so the yearling's play with the twin was otherwise never offered) */
      const huntsDone = W.phase === 'ice2' ? this.flags.soloWait && this.flags.soloStalk : W.phase === 'ice' ? this.stats.waits >= 1 && this.stats.stalks >= this.D.stalks : false;
      if (huntsDone && W.pack.some(n => n.role === 'twin' && !['play', 'tossed', 'leave'].includes(n.mode) && !n.swimming && near(n))) return 'play';
      const hole = W.holeNear(this.x, R + 12); if (hole && hole.up <= 0 && this.huntOK()) return 'wait';
      const b = W.bask; if (b && b.state === 'bask' && Math.abs(b.x - this.x) < 380 && Math.abs(b.x - this.x) > this.w * .5 + 30 && this.huntOK()) return 'creep';
    }
    /* a young male or a big male to spar with comes before a passing scent (it is what you came for) */
    const sparer = W.pack.find(n => (n.role === 'young' || n.role === 'bigmale' && this.flags.met && this.sex === 'boy') && !['play', 'tossed', 'leave'].includes(n.mode) && !n.swimming && near(n)); if (sparer && !water) return 'play';
    /* a lemming or a scent, whichever is nearer */
    const hop = this.age >= 3 && !water ? W.hopperNear(this.x, this.y + this.feet, R) : null, sc = this.age >= 3 ? W.scentNear(this.x, this.y, R + 8) : null;
    if (hop && (!sc || Math.abs(hop.x - this.x) <= Math.abs(sc.x - this.x))) return 'pounce';
    if (sc) return 'sniff';
    if (this.age >= 3 && !water && W.trackNear(this.x, R + 6)) return 'look';
    if (!water && this.canSlide()) return 'slide';
    const mate2 = W.pack.find(n => (n.role === 'twin' || n.role === 'young' || n.role === 'bigmale' && this.flags.met && this.sex === 'boy') && !['play', 'tossed', 'leave'].includes(n.mode) && !n.swimming && near(n)); if (mate2 && !water) return 'play';
    const little = W.cubs.find(q => !q.inDen && q.mode !== 'tossed' && near(q, 4)); if (little) return 'play';
    return null;
  }
  /* may you still-hunt or creep right now? (not in the first days on the ice before Mum shows you how, nor in summer) */
  huntOK() { const W = this.W; return this.age >= 3 && W.ground.iceOn && W.ground.iceMode !== 'floes' && ['ice', 'ice2', 'alone', 'adult'].includes(W.phase); }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    const R = this.reach();
    if (v === 'drink') this.startBusy('drink', 1.5, W.mum());
    else if (v === 'eat') { this.face = sign(W.meal.x - this.x) || this.face; this.startBusy('eat', 1.8, W.meal); }
    else if (v === 'play') { const n = W.pack.find(n => (n.role === 'twin' || n.role === 'young' || n.role === 'bigmale') && !['play', 'tossed', 'leave'].includes(n.mode) && Math.abs(n.x - this.x) < R + n.len * .4 && !n.inDen); if (n) this.startPlay(n); else { const q = W.cubs.find(q => !q.inDen && Math.abs(q.x - this.x) < R + q.len * .4 + 4); if (q) { this.face = sign(q.x - this.x) || this.face; this.startBusy('play', 2, q); } } }
    else if (v === 'pounce') { const h = W.hopperNear(this.x, this.y + this.feet, R); this.face = sign(h.x - this.x) || this.face; this.startBusy('pounce', .9, h); }
    else if (v === 'sniff') { const s = W.scentNear(this.x, this.y, R + 8); this.startBusy('sniff', 1.4, s); }
    else if (v === 'look') { const t = W.trackNear(this.x, R + 6); this.face = sign(t.x - this.x) || this.face; this.startBusy('look', 1.4, t); }
    else if (v === 'wait') this.startStill(W.holeNear(this.x, R + 12));
    else if (v === 'creep') this.startStalk();
    else if (v === 'slide') this.startSlide();
    else if (v === 'meet') { const o = W.mate(); this.face = sign(o.x - this.x) || this.face; this.startBusy('meet', 2.2, o); }
    else if (v === 'hello') { const o = W.buggy; this.face = sign(o.x - this.x) || this.face; this.startBusy('hi', 2.2, o); }
    else if (v === 'dig') this.makeDen();
    else if (v === 'carry') { const obj = W.cubs.find(q => q.wandered); this.startBusy('carry', .8, obj); }
    else if (v === 'feed') this.startBusy('nurse', 2.4, null);
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; this.target = null; if (kind === 'play' || kind === 'pounce') this.bowT = t; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy, W = this.W, P = this.G.particles;
    this.busy -= dt;
    if (this.mode === 'walk') { this.y = this.S.walkTop(this.x, this.span()) - this.feet; if (this.swimming) this.y = Math.min(this.y, WORLD.seaY - this.h * .2); }
    if (k === 'drink' && Math.random() < dt * 4) { P.text(this.x + rnd(-6, 6), this.y - this.h, '♪', '#ffd0e0', 9); AudioFX.hum && AudioFX.hum(); }
    if (k === 'eat' && Math.floor(t0 * 3) !== Math.floor((t0 - dt) * 3)) { AudioFX.munch && AudioFX.munch(); P.puff(this.x + this.face * this.w * .4, this.y, '#e8d8b0', 2); }
    if ((k === 'meet' || k === 'hi' || k === 'play') && Math.random() < dt * 8) P.text(this.x + rnd(-20, 20), this.y - this.h - 10, k === 'hi' ? '👋' : '♥', '#ff7aa8', 14);
    if (k === 'sniff' && Math.random() < dt * 10) P.puff(this.x + this.face * this.w * .45, this.y - this.h * .2, '#ffe9a0', 1);
    if (k === 'nurse' && Math.random() < dt * 5) P.text(this.x + rnd(-14, 14), this.y - this.h * .6, '♪', '#ffd0e0', 10);
    if (k === 'pounce' && o && t0 > .25 && !o.hopped2) { o.hopped2 = true; W.hop(o, sign(o.x - this.x) || this.face, 1.4); }
    if (this.busy > 0) return;
    this.busy = 0;
    if (k === 'drink') { this.food = Math.min(this.food + (this.age === 2 ? 4 : 3), this.growTh); this.stats.drinks++; this.warmth = 1; if (o && o.nurseOn && this.age >= 2) o.nursed = (o.nursed || 0) + 1; if (!this.flags.drank) { this.flags.drank = true; Bus.emit('firstDrink', this); } Bus.emit('drank', this); }
    if (k === 'eat' && o) {
      o.taken = true; W.meal = null; this.stats.meals++;
      if (this.age === 3) { this.food = Math.max(this.food, this.th[2]); this.full = true; } else this.food = Math.min(this.food + (this.age === 4 ? 9 : 12), this.growTh);
      if (!this.flags.ateMeal) { this.flags.ateMeal = true; Bus.emit('firstMeal', this); }
      Bus.emit('ateMeal', this);
    }
    if (k === 'play' && o) { this.stats.plays++; o.playT = 2; Bus.emit('played', this, o); if (!this.flags.played) { this.flags.played = true; Bus.emit('firstPlay', this); } }
    if (k === 'pounce') { this.stats.pounces++; if (o) o.hopped2 = false; if (!this.flags.pounced) { this.flags.pounced = true; Bus.emit('firstPounce', this); } Bus.emit('pounced', this); this.say('away'); }
    if (k === 'sniff' && o) { o.sniffed = true; o.sniffedAt = o.t; this.stats.sniffs++; if (!this.learned.scents.includes(o.kind)) this.learned.scents.push(o.kind); if (!this.flags.sniffed) { this.flags.sniffed = true; Bus.emit('firstSniff', this, o); } Bus.emit('sniffed', this, o); }
    if (k === 'look' && o) { o.seen = true; this.stats.looks++; if (!this.learned.tracks.includes(o.kind)) this.learned.tracks.push(o.kind); if (!this.flags.looked) { this.flags.looked = true; Bus.emit('firstTrack', this, o); } Bus.emit('looked', this, o); }
    if (k === 'meet' && o) { this.flags.met = true; o.following = true; o.roam = 0; Bus.emit('met', this, o); }
    if (k === 'hi' && o) { o.met = true; this.stats.waves++; Bus.emit('scientistMet', this, o); }
    if (k === 'carry' && o) { this.carrying = 'cub'; this.carryObj = o; o.inDen = true; o.carried = true; o.mode = 'lie'; this.carryForm = o.form; Bus.emit('carrying', this, 'cub'); }
    if (k === 'nurse') { this.stats.nurses++; if (!this.flags.nursed) { this.flags.nursed = true; Bus.emit('firstNurse', this); } Bus.emit('nursed', this); }
  }

  /* ---------- play-fights: with your twin, young males, a big male ----------
     Tap Space to push.  A ring shrinks round and round: press E (or up)
     while it is green for a BIG PUSH.  Roll them over and they get up
     and ask for more; lose and you roll in the snow instead. */
  startPlay(n) {
    if (!n) return;
    this.mode = 'play'; this.target = null;
    this.face = sign(n.x - this.x) || 1; n.face = -this.face; n.mode = 'play'; n.playT = 0;
    if (n.partner && n.partner.mode === 'spar') n.partner.mode = 'stand';
    const gap = (this.w + n.len) * .3, mid = (this.x + n.x) / 2;
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
      if (w.done === 'win') { this.bowT = .5; if (w.doneT > .5 && R.mode === 'play') { R.mode = 'tossed'; R.vx = this.face * 100; R.vy = -140; AudioFX.toss && AudioFX.toss(); } if (w.doneT > 1.1) this.endPlay(); }
      else if (w.doneT > .4 && this.mode === 'play') { this.mode = 'tossed'; this.vx = -this.face * 90; this.vy = -130; this.spin = 0; R.mode = 'stand'; R.playT = 2; AudioFX.toss && AudioFX.toss(); }
      return;
    }
    /* a big bear pushes harder; a little one less */
    const str = 1 + (this.kg - R.kg) / Math.max(4, R.kg) * .6;
    const rStr = D.rival * Math.pow(R.kg / Math.max(.4, this.kg), .8);
    w.ring += dt;
    if (inp.actionPressed) { w.p += .06 * clamp(str, .5, 2); w.taps++; this.bowT = .3; AudioFX.huff && AudioFX.huff(); this.G.particles.snowKick(w.mid, this.y + this.feet, 2); }
    const big = inp.eggPressed || (inp.y < -.6 && !this._upHeld);
    this._upHeld = inp.y < -.6;
    if (big) {
      if (this.shoveWindow()) { w.p += .26 * clamp(str, .5, 2); w.flash = 1; w.shoves++; this.bowT = .4; AudioFX.heave && AudioFX.heave(); this.G.particles.sparkle(w.mid, this.y - 10, 12, '#fff3b0', 16); }
      else w.p -= .05;
    }
    w.p -= clamp(rStr, .2, 1.6) * .17 * dt * (1 + Math.sin(w.t * 1.7) * .4);
    w.p = clamp(w.p, -1, 1);
    const shove = w.p * 12;
    this.x = w.mid - this.face * w.gap + this.face * shove; R.x = w.mid + this.face * w.gap + this.face * shove;
    this.y = S.walkTop(this.x, this.span()) - this.feet; R.y = S.walkTop(R.x, 22) - R.feet;
    this.walk += dt * 8 * (1 + Math.abs(w.p)); this.moving = true; R.walk = this.walk;
    if (w.p >= 1) { w.done = 'win'; this.stats.wins++; Bus.emit('playWon', this, R); }
    else if (w.p <= -1) { w.done = 'lose'; this.stats.losses++; Bus.emit('playLost', this, R); }
  }
  endPlay() { const R = this.wr && this.wr.rival; this.wr = null; this.mode = 'walk'; this.moving = false; Bus.emit('playEnd', this, R); }
  updateTossed(dt) {
    const S = this.S;
    this.vy += 600 * dt; this.vx *= Math.exp(-dt * 1.2);
    this.x = clamp(this.x + this.vx * dt, WORLD.left + 40, WORLD.right - 40); this.y += this.vy * dt; this.spin += dt * 10 * (this.vx >= 0 ? 1 : -1);
    const top = S.walkTop(this.x, this.span()) - this.feet;
    if (this.y >= top && this.vy > 0) { this.y = top; this.mode = 'walk'; this.spin = 0; this.vx = this.vy = 0; const pushed = !!this.wr; const R = this.wr && this.wr.rival; this.wr = null; this.stats.tumbles++; Bus.emit(pushed ? 'tossedDown' : 'knockedDown', this); if (pushed) Bus.emit('playEnd', this, R); }
  }

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
    this.carrying = null;
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    if (o.learned && typeof o.learned === 'object') { this.learned.tracks = Array.isArray(o.learned.tracks) ? o.learned.tracks.filter(k => TRACK_KINDS[k]) : []; this.learned.scents = Array.isArray(o.learned.scents) ? o.learned.scents.filter(k => SCENT_KINDS[k]) : []; }
    /* a gated step that was waiting when the game closed starts again by itself */
    for (const k of ['eyesGate', 'outGate', 'trekGate', 'shoreGate', 'yearGate', 'leaveGate', 'deepNow', 'coldSaid', 'swamSaid', 'lostMum', 'm_cubs', 'cubsSniffed']) delete this.flags[k];
    if (this.flags.m_eyes && !this.flags.eyesOpen) delete this.flags.m_eyes;
    this.kg = bearKG(this.age, this.food, this.th, this.sex);
    const S = this.S;
    if (this.mode === 'walk') this.y = S.walkTop(this.x, this.span()) - this.feet;
    else if (this.age > 1 && !S.free(this.x, this.y, this.r * .6, false)) { S.blob(this.x, this.y, Math.max(16, this.w * .5), Math.max(12, this.h * .7), MAT.AIR, (m) => m !== MAT.ROCK && m !== MAT.GRAVEL); S.flushTop(); }
  }
}
