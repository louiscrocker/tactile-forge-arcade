/* ============================================================
   player.js — you, the sea star, from egg to the next generation
   ============================================================
   stage  egg        one of millions drifting out on a spring tide
          larva      a see-through swimming larva (mode swim): eat the
                     tiny plants of the plankton and grow through three
                     sizes (the third grows little sticky arms)
          postlarva  the settler: swim back to the shore, find a pink
                     rock with nobody on it, hold on (Space) and turn
                     into a tiny five-armed star
          star       instar 1  a tiny star by its pink rock: eat baby
                               barnacles, rest in a pool or crack to grow
                     instar 2–3 a young star: crawl up the shore when the
                               tide is in to eat, back to a pool before
                               you dry when it goes out; hold on tight
                               (E) when a wave, a gull, an otter or a crab
                               comes; the child at low tide
                     instar 4  a big star on the mussel bed: the keystone
                               (eat mussels, new life moves in), the
                               scientist, the winter storm (an arm tip
                               lets go and grows back), spring: stand tall
                               and let the eggs or the cloud go
          modes on the rock: crawl · rest (grow) · curl (too dry: wait
                     for a wave) · tossed (rolled by a wave) · lifted (the
                     child) · arch (spawning)
   Nothing hurts the sea star, ever.  Holding tight means nobody can
   budge you; otherwise you roll a little way down the rock, unhurt.
   ============================================================ */
'use strict';

const REST_T = 8, HOLD_T = 1.3, CURL_WAIT = 6;

class Starfish {
  constructor(G, form, sex) {
    this.G = G; this.isPlayer = true; this.id = 1;
    this.form = FORMS[form] ? form : 'normal';
    this.sex = sex === 'girl' ? 'girl' : 'boy';
    this.stage = 'egg'; this.mode = 'egg';
    this.x = WORLD.eggX; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1; this.ang = 0; this.spin = 0;
    this.input = { x: 0, y: 0, actionPressed: false, eggPressed: false };
    this.t = 0; this.eggT = 0; this.crack = 0; this.phase = 0;
    this.food = 0; this.zinstar = 1; this.tight = 0; this.growing = 0; this.tumble = 0;
    this.cfood = 0; this.instar = 1; this.full = false; this.cm = .1;
    this.wet = 1; this.grip = 0; this.holdT = 0; this.holdCool = 0; this.shade = 'sea'; this.inPool = false;
    this.walk = 0; this.moving = false; this.arch = 0; this.stomach = 0; this.pullT = 0; this.resting = 0; this.curlT = 0;
    this.busy = 0; this.busyKind = null; this.busyObj = null; this.busyT = 0;
    this.home = null; this.rel = null; this.armShort = 0; this.liftFrom = null;
    this.dashCool = 0; this.hintClock = 0; this.hungryT = 0; this.guide = null; this.guideClock = 0; this.target = null;
    this.stats = { plankton: 0, glow: 0, dashes: 0, tumbles: 0, food: 0, spat: 0, barnacles: 0, limpets: 0, snails: 0, chitons: 0, mussels: 0, shells: 0, rests: 0, holds: 0, held: 0, rolled: 0, dodges: 0, dried: 0, splashes: 0, pools: 0, lifted: 0, counted: 0, blows: 0, babiesOut: 0, walked: 0 };
    this.flags = {};
  }

  get D() { return this.G.diff(); }
  get W() { return this.G.world; }
  get S() { return this.G.world.ground; }
  get swimming() { return this.stage === 'larva' || this.stage === 'postlarva'; }
  /* the drawn width of the star, arm tip to arm tip */
  get w() { return starUnits(this.cm); }
  /* collision radius */
  get r() {
    if (this.stage === 'egg') return 1.2;
    if (this.stage === 'larva') { const th = [0, ...this.D.larva], i = this.zinstar, t = clamp((this.food - th[i - 1]) / (th[i] - th[i - 1]), 0, 1); return [0, lerp(1.8, 2.4, t), lerp(2.6, 3.2, t), lerp(3.4, 4.0, t)][i]; }
    if (this.stage === 'postlarva') return 4.4;
    return this.w * .3;
  }
  get held() { return this.holdT > 0 || this.grip > .85; }
  get exposed() { return this.stage === 'star' && this.shade !== 'sea' && this.shade !== 'pool'; }
  stageKey() {
    if (this.stage === 'egg') return 'egg';
    if (this.stage === 'larva') return 'larva';
    if (this.stage === 'postlarva') return 'postlarva';
    if (this.instar <= 1) return 'juvenile';
    if (this.instar <= 3) return 'young';
    return this.flags.spring ? 'spawn' : 'adult';
  }
  /* the food a star must eat before its next growth rest */
  get growTh() { return this.instar < 4 ? this.D.grow[this.instar - 1] : this.D.grow[2] * BONUS; }
  /* Read to Play wraps this so the big steps wait for a page */
  milestone(key, fn) { this.flags['m_' + key] = true; fn(); }
  say(key) { if (this.hintClock > 0) return; this.hintClock = 6; Bus.emit('hint', key); }

  /* ============================================================ */
  update(dt) {
    this.t += dt; this.phase += dt * 6;
    this.hintClock -= dt; this.dashCool -= dt; this.holdCool -= dt; this.holdT = Math.max(0, this.holdT - dt);
    if (this.armShort > 0) { this.armShort = Math.max(0, this.armShort - dt * .012); if (this.armShort === 0 && !this.flags.regrown) { this.flags.regrown = true; Bus.emit('regrown', this); } }
    if (this.target) this.steerToTarget();
    switch (this.stage) {
      case 'egg': this.updateEgg(dt); break;
      case 'larva': case 'postlarva': this.updateSwim(dt); break;
      case 'star': this.updateStar(dt); break;
    }
    this.input.actionPressed = false; this.input.eggPressed = false;
  }
  steerToTarget() {
    const T = this.target, dx = T.x - this.x, dy = T.y - this.y, d = Math.hypot(dx, dy);
    if (this.stage === 'star') {
      if (Math.abs(dx) < Math.max(4, this.w * .15)) { this.target = null; return; }
      this.input.x = sign(dx); this.input.y = 0;
    } else { if (d < Math.max(4, this.r * 2)) { this.target = null; return; } this.input.x = dx / d; this.input.y = dy / d; }
  }
  goTo(x, y) { if (this.stage === 'egg' || this.mode !== 'crawl' && this.mode !== 'swim') return; this.target = { x, y }; }

  /* ---------- the egg: drifting off on the tide ---------- */
  updateEgg(dt) {
    this.eggT += dt;
    const [cx, cy] = this.W.current(this.x, this.y);
    this.x += cx * .25 * dt - 3 * dt; this.y += cy * .25 * dt + Math.sin(this.eggT * .7) * 2 * dt;
    this.y = clamp(this.y, this.W.seaLevel() + 8, this.S.topAt(this.x) - 10);
    if (this.eggT > 3.5 && !this.flags.eggReady) { this.flags.eggReady = true; Bus.emit('eggReady', this); }
    if (this.flags.eggReady && (this.input.x || this.input.y || this.input.actionPressed)) {
      this.crack = Math.min(1, this.crack + dt * .7 + (this.input.actionPressed ? .2 : 0));
      if (this.crack >= 1 && !this.flags.hatching) { this.flags.hatching = true; this.milestone('hatch', () => this.hatch()); }
    }
  }
  hatch() {
    const W = this.W;
    this.stage = 'larva'; this.mode = 'swim'; this.zinstar = 1; this.food = 0;
    this.vx = -8; this.vy = -6; this.face = -1;
    W.drift = -1;
    Bus.emit('hatched', this);
  }

  /* ============================================================
     IN THE PLANKTON
     ============================================================ */
  updateSwim(dt) {
    const W = this.W, S = this.S, inp = this.input, larva = this.stage === 'larva';
    if (this.growing > 0) { this.growing -= dt; this.drift(dt, .6); if (this.growing <= 0) this.finishSeaGrowth(); return; }
    if (this.tumble > 0) { this.tumble -= dt; this.spin += dt * 14; this.drift(dt, 1); if (this.tumble <= 0) this.spin = 0; return; }
    if (inp.actionPressed) this.act();
    /* E: a quick burst of swimming along the arrows */
    if (inp.eggPressed && this.dashCool <= 0) {
      const m = Math.hypot(inp.x, inp.y), dx = m > .1 ? inp.x / m : this.face, dy = m > .1 ? inp.y / m : 0;
      this.vx += dx * (larva ? 70 : 90); this.vy += dy * (larva ? 70 : 90); this.dashCool = .9; this.stats.dashes++;
      this.G.particles.bubbles(this.x - dx * this.r * 2, this.y - dy * this.r * 2, 4);
      AudioFX.dash && AudioFX.dash(); Bus.emit('dash', this);
    }
    const accel = larva ? 110 + this.zinstar * 12 : 150, maxSp = larva ? 18 + this.zinstar * 4 : 40;
    this.vx += inp.x * accel * dt; this.vy += inp.y * accel * dt;
    this.vy += (larva ? 3 : 9) * dt;                        /* a larva slowly sinks if it stops swimming; a settler sinks faster */
    this.vx *= Math.exp(-dt * 2.4); this.vy *= Math.exp(-dt * 2.4);
    const sp = Math.hypot(this.vx, this.vy), cap = maxSp * (this.dashCool > .5 ? 2.4 : 1);
    if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    this.drift(dt, 1);
    if (Math.abs(inp.x) > .2) this.face = sign(inp.x);
    this.moving = Math.hypot(inp.x, inp.y) > .1;
    this.ang = clamp(this.vy / 60, -.6, .6) * (this.face > 0 ? 1 : -1);
    /* eat the plankton you bump into; dinoflagellates only glow */
    const R = this.r;
    for (const q of W.plankton) {
      if (q.eaten) continue;
      const d = Math.hypot(q.x - this.x, q.y - this.y);
      if (q.kind === 'dino') { if (d < R + 6) { if (q.glow < .3 && nightAmount(this.G.tod) > .4) { this.stats.glow++; this.G.particles.sparkle(q.x, q.y, 6, '#8ee8ff', 4); Bus.emit('glow', this); } q.glow = 1; } continue; }
      if (d < R + PLANKTON_KINDS[q.kind].r + 1.4) {
        q.eaten = true; if (larva) this.food += PLANKTON_KINDS[q.kind].val; this.stats.plankton++;
        this.G.particles.puff(q.x, q.y, q.kind === 'algae' ? '#a8e090' : '#d8e8a0', 3, .6);
        AudioFX.blip && AudioFX.blip(q.kind === 'chain' ? 1.4 : 1);
        Bus.emit('ate', this, q);
      }
    }
    /* the big animals: never harmful, but they knock you about */
    const sc = W.school;
    if (sc && !sc.hitDone) for (const f of sc.fish) {
      const fx = sc.x + f.dx, fy = sc.y + f.dy + Math.sin(sc.t * 2 + f.ph) * 6;
      if (Math.hypot(fx + sc.dir * 14 - this.x, fy - this.y) < 10 * f.s + R) { sc.hitDone = true; this.startTumble(sc.dir * 70, -20); break; }
    }
    const head = W.whaleHead();
    if (head) {
      const dx = head.x - this.x, dy = head.y - this.y, d = Math.hypot(dx, dy);
      if (d < 420) { const push = (1 - d / 420) * 70; this.vx += sign(-dx) * push * dt; this.vy -= dy / d * push * dt; }
      if (d < 110 && !W.whale.hitDone) { W.whale.hitDone = true; this.startTumble(W.whale.dir * 90, -70); this.y = Math.max(W.seaLevel() + 8, head.y - 140); Bus.emit('whaleWhoosh', this); }
    }
    for (const j of W.jellies) { if (!j.hitDone && Math.hypot(j.x - this.x, j.y - this.y) < j.r + R + 2) { j.hitDone = true; this.startTumble(sign(this.x - j.x) * 60, -30); Bus.emit('combJelly', this); } }
    this.bounds();
    if (larva) this.larvaGrowth(dt);
    else {
      /* the settler: home is the low shore, down on the rock */
      const floor = S.topAt(this.x), onShore = this.x > WORLD.lowL - 360 && this.x < WORLD.bedL + 200;
      this.guide = onShore ? null : { x: WORLD.homeX, y: S.topAt(WORLD.homeX) - 20, kind: 'home' };
      if (onShore && !this.flags.overShore) { this.flags.overShore = true; Bus.emit('overShore', this); }
      if (this.y > floor - 24 && onShore && !this.flags.searching) { this.flags.searching = true; Bus.emit('searching', this); }
      const sh = W.shelterAt(this.x, this.y, 8);
      if (sh && sh.kind === 'pink' && this.y > floor - 26 && sh !== this.lastSh) { this.lastSh = sh; if (sh.taken) { this.say('taken'); Bus.emit('taken', this); } else this.say('settle'); }
      if (!sh) this.lastSh = null;
      if (onShore && !this.guide) { const f = W.nearestFreePink(this.x); if (f && Math.abs(f.x - this.x) > 30) this.guide = { x: f.x, y: f.y - 10, kind: 'pink' }; }
    }
  }
  /* the sea carries you along */
  drift(dt, k) {
    const [cx, cy] = this.W.current(this.x, this.y);
    this.x += (this.vx + cx * k) * dt; this.y += (this.vy + cy * k) * dt;
    this.bounds();
  }
  bounds() {
    const W = this.W, S = this.S, R = this.r;
    const top = W.seaLevel() + R + 1;
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    if (this.x < WORLD.left + 80) { this.x = WORLD.left + 80; this.vx = Math.abs(this.vx); }
    const maxX = this.stage === 'larva' ? WORLD.lowR : WORLD.bedR;
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    for (let k = 0; k < 6 && S.solidAt(this.x, this.y + R); k++) { this.y -= 2; this.vy = Math.min(0, this.vy); }
    if (S.solidAt(this.x + sign(this.vx) * R, this.y)) { this.x -= sign(this.vx) * 2; this.vx *= -.3; }
    /* the water goes out from under a swimmer at the top of the shore: slide back down to the sea */
    if (this.y < W.seaLevel() + R && S.topAt(this.x) < W.seaLevel() + 4) { this.x -= 30 * (1 / 60); }
  }
  startTumble(vx, vy) { this.tumble = 1.1; this.vx = vx; this.vy = vy; this.stats.tumbles++; this.target = null; AudioFX.whoosh && AudioFX.whoosh(); Bus.emit('missed', this); }
  larvaGrowth(dt) {
    const th = this.D.larva[this.zinstar - 1];
    if (this.food < th) return;
    this.food = Math.max(this.food, th);
    this.tight += dt;
    if (this.tight > 1.6 && !this.flags['zm' + this.zinstar]) {
      this.flags['zm' + this.zinstar] = true;
      const key = this.zinstar === 1 ? 'larva2' : this.zinstar === 2 ? 'larva3' : 'postlarva';
      this.milestone(key, () => { this.growing = 1.6; this.tight = 0; Bus.emit('growing', this); });
    }
  }
  finishSeaGrowth() {
    this.G.particles.sparkle(this.x, this.y, 10, '#fff3c0', 6);
    if (this.zinstar < 3) { this.zinstar++; Bus.emit('grew', this, this.zinstar); if (this.zinstar === 3) Bus.emit('larva3', this); return; }
    this.stage = 'postlarva'; this.W.drift = 1;
    /* weeks at sea: the currents have carried the larva far out from the shore */
    if (this.x > -1600) { this.x = -1600 - Math.random() * 500; this.y = clamp(this.y, this.W.seaLevel() + 30, 200); this.W.sibs.length = 0; this.W.plankton.length = 0; }
    Bus.emit('postlarva', this);
  }
  /* the settler holds on to this pink rock and turns into a tiny star */
  settle(sh) {
    const S = this.S;
    this.stage = 'star'; this.mode = 'crawl'; this.instar = 1; this.cfood = 0; this.wet = 1;
    this.cm = starCM(1, 0, this.D.grow);
    sh.taken = true; sh.mine = true; this.home = sh;
    this.x = sh.x; this.y = S.topAt(this.x); this.face = 1; this.ang = 0; this.spin = 0; this.guide = null;
    this.G.particles.sparkle(this.x, this.y - 4, 14, '#fff3c0', 10);
    Bus.emit('settled', this, sh);
  }

  /* ============================================================
     ON THE ROCK
     ============================================================ */
  updateStar(dt) {
    const D = this.D;
    this.cm = starCM(this.instar, this.cfood, D.grow);
    this.updateMeters(dt);
    this.arch += (((this.mode === 'arch' || this.busyKind === 'meet' && this.busy > 0) ? 1 : 0) - this.arch) * (1 - Math.exp(-dt * 3));
    this.stomach = Math.max(0, this.stomach - dt * 1.5);
    if (this.busy > 0) { this.updateBusy(dt); return; }
    switch (this.mode) {
      case 'crawl': this.updateCrawl(dt); break;
      case 'rest': this.resting -= dt; if (this.resting <= 0 && !this.flags.waking) this.finishRest(); break;
      case 'curl': this.updateCurl(dt); break;
      case 'tossed': this.updateTossed(dt); break;
      case 'lifted': { const h = this.W.kidHand(); this.x = h.x; this.y = h.y; this.wet = Math.max(.3, this.wet); break; }
      case 'arch': this.updateRelease(dt); break;
    }
    if (this.instar < 4 && this.cfood >= this.growTh && !this.full) { this.full = true; Bus.emit('full', this); }
    this.updateGuide(dt);
  }
  /* wet: the sea and the pools keep you wet; out on the rock you slowly dry (rockweed and cracks
     slow it; night and cloud slow it); empty: curl up and wait for a wave.
     grip: builds while you keep still, full while you hold on (E) */
  updateMeters(dt) {
    const W = this.W, S = this.S, D = this.D;
    const P = S.poolAt(this.x);
    this.inPool = !!(P && this.y > P.rim - 3);
    const shade = this.mode === 'lifted' ? 'air' : W.shadeAt(this.x, this.y - 2, this.w);
    if (shade !== this.shade) {
      if (shade === 'pool' && this.shade !== 'sea') this.stats.pools++;
      if ((shade === 'pool' || shade === 'sea') && this.exposed && this.wet < .6) Bus.emit('wetAgain', this, shade);
      if (shade !== 'sea' && this.shade === 'sea') Bus.emit('outOfSea', this);
      if (shade === 'sea' && this.shade !== 'sea' && this.shade !== 'pool') Bus.emit('seaBack', this);
    }
    this.shade = shade;
    const day = 1 - nightAmount(this.G.tod), small = this.instar <= 1 ? 1.6 : this.instar <= 3 ? 1.2 : 1;
    let rate;
    if (shade === 'sea' || shade === 'pool') rate = .15;
    else if (this.mode === 'lifted') rate = -.005;
    else {
      const base = shade === 'crack' ? .004 : shade === 'weed' ? .007 : .02;
      rate = -base * D.dry * small * (.35 + day * .65) * (1 - W.weather.cloud * .3);
    }
    this.wet = clamp(this.wet + rate * dt, 0, 1);
    if (this.wet < .3 && this.mode === 'crawl' && !this.flags.drySaid) { this.flags.drySaid = true; Bus.emit('drying', this); }
    if (this.wet > .6) this.flags.drySaid = false;
    if (this.wet <= 0 && this.mode === 'crawl' && this.busy <= 0) { this.mode = 'curl'; this.curlT = 0; this.target = null; this.stats.dried++; Bus.emit('curl', this); }
    const still = !this.moving && this.mode !== 'tossed' && this.mode !== 'lifted';
    this.grip = clamp(this.grip + (still ? .6 : -1.5) * dt, 0, 1);
    if (this.holdT > 0) this.grip = 1;
  }
  updateCrawl(dt) {
    const S = this.S, inp = this.input, w = this.w;
    if (inp.actionPressed) { if (this.act()) return; }
    if (inp.eggPressed) this.holdOn();
    const slope = S.slopeAt(this.x, Math.max(4, w * .2));
    const sp = (9 + w * .32) * (this.G.settings.slowmo ? .7 : 1) * (this.holdT > 0 ? .3 : 1);
    if (Math.abs(inp.x) > .15) {
      const dx = inp.x * sp * dt / (1 + Math.abs(slope) * .8);
      this.x = clamp(this.x + dx, WORLD.kelpL + 40, WORLD.walkR);
      this.walk += dt * 6 * Math.abs(inp.x); this.moving = true; this.face = sign(inp.x);
      this.stats.walked += Math.abs(dx);
      this.sniffSnails();
    } else this.moving = false;
    this.y = S.topAt(this.x);
    this.ang = angleLerp(this.ang, clamp(Math.atan(slope), -1.1, 1.1) * .8, clamp(dt * 8, 0, 1));
  }
  /* E: hold on tight with every tube foot */
  holdOn() {
    if (this.holdCool > 0 || this.mode !== 'crawl') return false;
    this.holdT = HOLD_T; this.holdCool = 1.2; this.grip = 1; this.stats.holds++; this.target = null;
    this.G.particles.bubbles(this.x, this.y - 4, 3, 1); AudioFX.clack && AudioFX.clack();
    Bus.emit('holdOn', this);
    return true;
  }
  /* a turban snail that smells you coming lets go and tumbles away (once each) */
  sniffSnails() {
    for (const it of this.W.items) if (it.kind === 'snail' && !it.eaten && !it.sniffed && Math.abs(it.x - this.x) < this.w * .6 + 26 && Math.abs(it.y - this.y) < 30) {
      it.sniffed = true; if (Math.random() < .45) { it.roll = 1.6; Bus.emit('snailRoll', it); }
    }
  }
  /* too dry: hold your water in and wait; a wave comes (or the tide), and you are wet again */
  updateCurl(dt) {
    this.curlT += dt; this.moving = false;
    if (this.shade === 'sea' || this.shade === 'pool' || this.wet > .5) { this.mode = 'crawl'; Bus.emit('uncurl', this); return; }
    if (this.curlT > CURL_WAIT) this.splashWet();
  }
  splashWet() {
    this.wet = Math.max(this.wet, .75); this.stats.splashes++;
    this.G.particles.bubbles(this.x, this.y - 6, 14, 2); this.W.splash = 1;
    AudioFX.splash && AudioFX.splash();
    if (this.mode === 'curl') this.mode = 'crawl';
    Bus.emit('splashed', this);
  }
  /* a big breaker: hold tight (or be in a pool or a crack) and it rolls over you; otherwise a roll down the rock */
  waveHit(w) {
    if (this.stage !== 'star') return;
    if (!['crawl', 'curl', 'rest'].includes(this.mode)) return;
    const wasDry = this.exposed;
    this.wet = 1;
    if (this.held || this.mode === 'rest' || this.inCrack || this.inPool) {
      this.stats.held++; if (this.flags.storm) this.flags.stormHeld = (this.flags.stormHeld || 0) + 1;
      if (this.mode === 'curl') this.mode = 'crawl';
      Bus.emit('held', this, w);
    } else {
      this.stats.rolled++;
      this.knock(-1, 1.2);
      Bus.emit('rolled', this, w);
    }
    if (this.flags.storm && this.instar >= 4 && !this.flags.armTipDone) { this.flags.armTipDone = true; this.armShort = 1; Bus.emit('armTip', this); }
    if (wasDry && !this.held) this.stats.splashes++;
  }
  knock(dir, k = 1) { if (this.mode !== 'crawl' && this.mode !== 'curl') return; this.mode = 'tossed'; this.vx = dir * 70 * k; this.vy = -80 * k; this.spin = 0; this.stats.tumbles++; this.target = null; }
  updateTossed(dt) {
    const S = this.S;
    this.vy += 300 * dt; this.vx *= Math.exp(-dt * 1.2);
    this.x = clamp(this.x + this.vx * dt, WORLD.kelpL + 40, WORLD.walkR); this.y += this.vy * dt; this.spin += dt * 7 * (this.vx >= 0 ? 1 : -1);
    const top = S.topAt(this.x);
    if (this.y >= top && this.vy > 0) { this.y = top; this.mode = 'crawl'; this.spin = 0; this.vx = this.vy = 0; Bus.emit('landed', this); }
  }
  /* a visitor tries: it never hurts.  Holding tight (or hiding in a pool or a crack from a gull) and it gives up;
     otherwise a little roll down the rock.  From the sunflower star you just crawl away. */
  struck(h) {
    if (this.stage !== 'star' || this.mode === 'lifted' || this.mode === 'arch') return;
    if (h.kind === 'sunflower') {
      const away = this.moving && sign(this.input.x) === sign(this.x - h.x);
      this.stats.dodges++; Bus.emit(away ? 'escaped' : 'sniffedOff', this, h);
      return;
    }
    const safe = this.held || this.mode === 'rest' || (h.kind === 'gull' && (this.inPool || this.shade === 'crack' || this.shade === 'sea'));
    if (safe) { this.stats.dodges++; Bus.emit('dodged', this, h); }
    else { this.knock(h.kind === 'gull' ? 1 : -1, .8); Bus.emit('missed', this, h); }
  }
  /* the child: lifted to look at, and put back where you were */
  lifted(K) { this.busy = 0; this.busyKind = null; this.liftFrom = { x: this.x }; this.mode = 'lifted'; this.target = null; this.stats.lifted++; this.flags.lifted = true; Bus.emit('lifted', this); }
  putBack() { if (this.mode !== 'lifted') return; this.mode = 'crawl'; this.x = this.liftFrom ? this.liftFrom.x : this.x; this.y = this.S.topAt(this.x); this.ang = 0; Bus.emit('putBack', this); }
  /* an arrow for what you need most: a wet place when drying, a place to rest when full, food when hungry */
  updateGuide(dt) {
    this.guideClock -= dt; this.hungryT += dt;
    if (this.guideClock > 0) return;
    this.guideClock = .8;
    const W = this.W;
    if (this.mode !== 'crawl') { this.guide = null; return; }
    if (this.exposed && this.wet < .55) { const t = W.nearestWet(this.x); this.guide = t ? { x: t.x, y: t.y - 8, kind: 'wet' } : null; return; }
    if (this.full && this.instar < 4 && !this.restReady()) {
      let best = null, bd = 1e9;
      for (const P of W.pools) { const d = Math.abs(P.x - this.x); if (d < bd) { bd = d; best = { x: P.x, y: P.floor - 8, kind: 'rest' }; } }
      for (const sh of W.shelters) if (sh.kind === 'crack') { const d = Math.abs(sh.x - this.x); if (d < bd) { bd = d; best = { x: sh.x, y: sh.y - 8, kind: 'rest' }; } }
      this.guide = best; return;
    }
    if (this.flags.spring && !this.flags.met) { const m = W.mates()[0]; this.guide = m ? { x: m.x, y: m.y - 10, kind: 'mate' } : null; return; }
    if (this.hungryT > 10 && !this.full && !this.flags.spring) {
      /* a big star is after mussels (the keystone); anyone else, the nearest meal */
      const wantMussel = this.instar >= 4 && !this.flags.keystone;
      const f = (wantMussel && W.foodNear(this.x, this.y, 2400, (it) => it.kind === 'mussel' && this.canEat(it))) || W.foodNear(this.x, this.y, 900, (it) => this.canEat(it));
      this.guide = f ? { x: f.x, y: f.y - 8, kind: 'food' } : null;
      if (f && !this.flags.sniffSaid) { this.flags.sniffSaid = true; Bus.emit('hint', 'eat'); }
      return;
    }
    this.guide = null;
  }

  /* ---------- resting to grow, in a pool or a crack ---------- */
  /* in a crack in the rock (wet or dry) */
  get inCrack() { return this.W.shelters.some(sh => sh.kind === 'crack' && Math.abs(this.x - sh.x) < sh.w * .5 + 2 && Math.abs(this.y - sh.y) < 30 + this.w); }
  restReady() { return this.stage === 'star' && this.full && this.instar < 4 && this.mode === 'crawl' && (this.inPool || this.shade === 'crack' || this.inCrack || (this.instar === 1 && this.home && Math.abs(this.home.x - this.x) < 80)); }
  startRest() { this.mode = 'rest'; this.resting = REST_T; this.target = null; this.moving = false; this.guide = null; Bus.emit('resting', this); }
  finishRest() {
    this.flags.waking = true;
    this.instar = Math.min(4, this.instar + 1); this.stats.rests++; this.full = false;
    this.cm = starCM(this.instar, this.cfood, this.D.grow);
    Bus.emit('grewStar', this, this.instar);
    const done = () => { this.flags.waking = false; this.mode = 'crawl'; Bus.emit('awake', this); };
    if (this.instar >= 4) this.milestone('adult', done);
    else if (this.instar === 2) this.milestone('young', done);
    else done();
  }

  /* ---------- what Space does right now ---------- */
  reach() { return this.w * .5 + 8; }
  /* what a star of this size can open: a tiny one baby barnacles; a young one anything else, small mussels too */
  canEat(it) {
    if (it.eaten || it.roll) return false;
    if (this.instar <= 1) return it.kind === 'spat' || it.kind === 'barnacle';
    if (it.kind === 'mussel') return this.instar >= 2;
    return it.kind !== 'spat';
  }
  underWater() { return this.shade === 'sea' || this.inPool; }
  context() {
    const W = this.W;
    if (this.stage === 'egg') return null;
    if (this.swimming) {
      if (this.stage === 'postlarva' && this.tumble <= 0) { const sh = W.shelterAt(this.x, this.y, 8); if (sh && sh.kind === 'pink' && !sh.taken && this.y > this.S.topAt(this.x) - 26) return 'settle'; }
      return null;
    }
    if (this.busy > 0) return null;
    if (this.mode === 'arch') return 'arch';
    if (this.mode !== 'crawl') return null;
    const R = this.reach();
    if (this.restReady()) return 'rest';
    if (this.flags.spring) {
      if (!this.flags.met) { const m = W.mates().find(n => Math.abs(n.x - this.x) < R + n.w * .5 + 12); if (m) return 'meet'; }
      else if (!this.flags.released) return 'arch';
      return null;
    }
    if (this.instar >= 4 && W.sciNear(this.x, R)) return 'count';
    const f = W.foodNear(this.x, this.y, R, (it) => this.canEat(it));
    if (f) return this.underWater() ? 'eat' : 'toodry';
    return null;
  }
  act() {
    const v = this.context(), W = this.W;
    if (!v) return false;
    if (v === 'settle') { const sh = W.shelterAt(this.x, this.y, 8); this.milestone('settle', () => this.settle(sh)); }
    else if (v === 'eat') { const it = W.foodNear(this.x, this.y, this.reach(), (o) => this.canEat(o)); this.face = sign(it.x - this.x) || this.face; const t = FOOD_KINDS[it.kind].pull / (.55 + this.instar * .2); this.startBusy('eat', t, it); it.held = true; }
    else if (v === 'toodry') { this.say('toodry'); Bus.emit('tooDry', this); return true; }
    else if (v === 'rest') this.startRest();
    else if (v === 'count') { const d = W.sciNear(this.x, this.reach()); d.state = 'count'; d.t = 0; this.startBusy('count', 2.6, d); }
    else if (v === 'meet') { const m = W.mates().find(n => Math.abs(n.x - this.x) < this.reach() + n.w * .5 + 12); this.face = sign(m.x - this.x) || this.face; this.startBusy('meet', 2, m); }
    else if (v === 'arch') { if (this.mode !== 'arch') this.startRelease(); else return false; }
    Bus.emit('act', this, v);
    return true;
  }
  startBusy(kind, t, obj) { this.busy = t; this.busyKind = kind; this.busyObj = obj; this.busyT = t; this.moving = false; this.target = null; }
  updateBusy(dt) {
    const k = this.busyKind, o = this.busyObj, t0 = this.busyT - this.busy;
    this.busy -= dt; this.moving = false;
    if (k === 'eat') {
      const u = t0 / this.busyT; this.pullT = u;
      if (u > .6) this.stomach = 1;
      if (Math.floor(t0 * 2.5) !== Math.floor((t0 - dt) * 2.5)) { AudioFX.munch && AudioFX.munch(); this.G.particles.bubbles(o.x, o.y - 3, 1, .6); }
      if (o.kind === 'mussel' && !this.flags.pullSaid) { this.flags.pullSaid = true; Bus.emit('pulling', this); }
    }
    if (k === 'meet' && Math.random() < dt * 8) this.G.particles.text(this.x + rnd(-20, 20), this.y - this.w * .4 - 10, '♥', '#ff7aa8', 14);
    if (this.busy > 0) return;
    this.busy = 0; this.pullT = 0;
    const kk = this.busyKind; this.busyKind = null;
    if (kk === 'eat') {
      const F = FOOD_KINDS[o.kind];
      this.W.eatItem(o);
      this.cfood = Math.min(this.cfood + F.food, this.growTh); this.stats.food++;
      const sk = { spat: 'spat', barnacle: 'barnacles', limpet: 'limpets', snail: 'snails', chiton: 'chitons', mussel: 'mussels' }[o.kind]; if (sk) this.stats[sk]++;
      if (F.shell) this.stats.shells++;
      this.hungryT = 0; this.guide = null;
      this.G.particles.puff(o.x, o.y - 2, o.kind === 'mussel' ? '#f0a070' : '#f0e8d8', 3);
      if (!this.flags.ateRock) { this.flags.ateRock = true; Bus.emit('firstFood', this, o); }
      Bus.emit('ateFood', this, o);
    }
    if (kk === 'count') { this.flags.counted = true; this.stats.counted++; Bus.emit('counted', this, o); }
    if (kk === 'meet') { this.flags.met = true; o.met = true; Bus.emit('met', this, o); }
  }

  /* ---------- spring: stand tall and let the eggs (or the cloud) go on the swell ---------- */
  startRelease() { this.mode = 'arch'; this.rel = { good: 0, miss: 0, t: 0, flash: 0, lastWave: -1 }; this.target = null; Bus.emit('release', this); }
  releaseWindow() { return this.W.swash() > .62; }
  updateRelease(dt) {
    const r = this.rel, W = this.W, D = this.D;
    r.t += dt; r.flash = Math.max(0, r.flash - dt * 2);
    const wave = Math.floor(W.t / 5.6);
    if ((this.input.actionPressed || this.input.eggPressed) && !this.flags.releaseGate) {
      if (this.releaseWindow() && r.lastWave !== wave) {
        r.lastWave = wave; r.good++; r.flash = 1; this.stats.blows++;
        const n = Math.round((this.sex === 'girl' ? 8e6 : 0) / D.blows); this.stats.babiesOut += n;
        W.babyBurst(this.x, this.y - this.w * .45, 60, this.sex === 'boy');
        this.G.particles.sparkle(this.x, this.y - this.w * .4, 18, this.sex === 'boy' ? '#ffffff' : '#ffd8a0', 24);
        AudioFX.splash && AudioFX.splash(); Bus.emit('blow', this, r.good);
        if (r.good >= D.blows && !this.flags.releaseGate) { this.flags.releaseGate = true; this.milestone('larvae', () => { this.flags.released = true; this.mode = 'crawl'; Bus.emit('released', this); }); }
      } else if (r.lastWave !== wave) { r.miss++; this.say('arch'); }
    }
  }

  /* ============================================================ */
  serialize() {
    const o = {};
    for (const k of ['form', 'sex', 'stage', 'mode', 'x', 'y', 'face', 'eggT', 'food', 'zinstar', 'cfood', 'instar', 'full', 'wet', 'resting', 'armShort', 'stats', 'flags']) o[k] = this[k];
    o.home = this.home ? +this.home.x.toFixed(1) : null;
    return o;
  }
  restore(o) {
    const num = (v, d) => Number.isFinite(v) ? v : d;
    if (FORMS[o.form]) this.form = o.form;
    this.sex = o.sex === 'girl' ? 'girl' : 'boy';
    if (['egg', 'larva', 'postlarva', 'star'].includes(o.stage)) this.stage = o.stage;
    const modes = { egg: ['egg'], larva: ['swim'], postlarva: ['swim'], star: ['crawl', 'rest', 'curl'] }[this.stage];
    this.mode = modes.includes(o.mode) ? o.mode : modes[0];
    this.x = clamp(num(o.x, this.x), WORLD.left + 80, WORLD.walkR); this.y = clamp(num(o.y, this.y), WORLD.top + 100, 700);
    this.face = o.face === -1 ? -1 : 1;
    this.eggT = num(o.eggT, 0); this.food = Math.max(0, num(o.food, 0)); this.zinstar = clamp(Math.round(num(o.zinstar, 1)), 1, 3);
    this.cfood = Math.max(0, num(o.cfood, 0)); this.instar = clamp(Math.round(num(o.instar, 1)), 1, 4); this.full = !!o.full;
    this.wet = clamp(num(o.wet, 1), 0, 1); this.resting = clamp(num(o.resting, 0), 0, REST_T); this.armShort = clamp(num(o.armShort, 0), 0, 1);
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    if (o.flags && typeof o.flags === 'object') for (const k in o.flags) this.flags[k] = typeof o.flags[k] === 'number' ? o.flags[k] : !!o.flags[k];
    /* a gated step that was waiting when the game closed starts again by itself */
    for (const k of ['hatching', 'zm1', 'zm2', 'zm3', 'releaseGate', 'drySaid', 'waking', 'boyEnd', 'pullSaid', 'sniffSaid']) delete this.flags[k];
    if (this.mode === 'rest' && this.resting <= 0) this.resting = 1;
    if (this.mode === 'curl') this.mode = 'crawl';
    this.cm = this.stage === 'star' ? starCM(this.instar, this.cfood, this.D.grow) : .1;
    if (this.stage === 'star') {
      if (Number.isFinite(o.home)) { const sh = this.W.shelters.find(s => Math.abs(s.x - o.home) < 2); if (sh) { this.home = sh; sh.taken = true; sh.mine = true; } }
      this.y = this.S.topAt(this.x);
    }
    if (this.swimming) this.W.drift = this.stage === 'postlarva' ? 1 : -1;
  }
}
