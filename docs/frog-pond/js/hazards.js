/* ============================================================
   hazards.js — the garter snake, the raccoon and the fish
   ============================================================
   Three more things that want to eat a frog, each with a warning
   you can read and a way out that teaches something:
     snake   lives in the bank grass; hunts frogs on land; freeze
             or hop into the water.
     raccoon comes to the shallows at night and pats the water;
             go deep or under a pad.  A toad gets spat out: yuck.
     fish    a big shadow in deep water at dusk; tadpoles and
             froglets should swim UP to the shallows.  This flips
             the heron lesson: deep is safe by day, not at dusk.
   Nothing dies.  A hit is a fright and a shove.
   ============================================================ */
'use strict';

class Hazards {
  constructor(G) {
    this.G = G;
    const pond = G.pond, rng = mulberry32(pond.seed ^ 0x5a5a);
    const side = rng() < .5 ? -1 : 1;
    this.snake = { side, x: side * (pond.W + 260), y: 0, state: 'hidden', timer: rnd(45, 90), ph: 0, t: 0, dir: -side, tongue: 0, strike: 0, target: null };
    this.raccoon = { side: -side, x: -side * (pond.W + 500), y: 0, state: 'away', timer: rnd(60, 120), ph: 0, t: 0, dir: side, pose: 'walk', target: null };
    this.fish = { x: 0, y: 320, vx: 40, vy: 0, dir: 1, state: 'away', timer: rnd(30, 70), ph: 0, t: 0, target: null, tx: 0 };
    this.enabled = true;
  }

  /* ---------- helpers ---------- */
  snakeReach(p) { return p.mode === 'perch' && p.perch && p.perch.kind === 'land' && Math.abs(p.x - this.snake.x) < 120; }
  raccoonReach(p) { const r = this.raccoon; return Math.abs(p.x - r.x) < 150 && p.y < 90 && (p.mode === 'water' || p.isTadpole() || (p.mode === 'perch' && p.perch && p.perch.kind !== 'land')); }
  fishReach(p) { return (p.isTadpole() || p.stage === 4) && p.y > 150 && dist(p.x, p.y, this.fish.x, this.fish.y) < 130; }
  fishSafe(p) { return p.y < 140 || p.state === 'egg' || p.state === 'morphing' || p.mode !== 'water' && !p.isTadpole(); }
  raccoonSafe(p) { return p.y > 130 || (p.inWater() && !!this.G.pond.padAt(p.x, this.G.pond.surfaceAt(p.x), -4) && p.y > 6) || p.state === 'egg' || p.state === 'morphing' || p.state === 'hibernating'; }

  update(dt, players, env) {
    if (!this.enabled) return;
    const G = this.G, pond = G.pond, p = players[0];
    if (!p) return;
    this.updateSnake(dt, players, env);
    this.updateRaccoon(dt, players, env);
    this.updateFish(dt, players, env);
  }

  /* ---------- garter snake ---------- */
  updateSnake(dt, players, env) {
    const S = this.snake, G = this.G, pond = G.pond, p = players[0];
    S.ph += dt * 6; S.t += dt; S.tongue = Math.max(0, S.tongue - dt * 3);
    S.y = pond.bedY(S.x) - 2;
    switch (S.state) {
      case 'hidden':
        S.timer -= dt;
        if (S.timer <= 0 && !env.cold && env.night < .6 && players.some(q => q.stage >= 4)) { S.state = 'out'; S.t = 0; S.x = S.side * (pond.W + 300); Bus.emit('snakeOut', S); }
        break;
      case 'out': {
        /* slither along the bank toward the nearest frog on land; give up after a while */
        let target = null, bd = 1e9;
        for (const q of players) if (q.mode === 'perch' && q.perch && q.perch.kind === 'land' && sign(q.x) === S.side) { const d = Math.abs(q.x - S.x); if (d < bd) { bd = d; target = q; } }
        const want = target ? target.x : S.side * (pond.W + 80);
        S.dir = sign(want - S.x) || S.dir;
        if (Math.abs(want - S.x) > 8) S.x += S.dir * 42 * dt;
        S.x = clamp(S.x, Math.min(S.side * (pond.W + 20), S.side * (pond.W + 700)), Math.max(S.side * (pond.W + 20), S.side * (pond.W + 700)));
        if (chance(dt * .5)) S.tongue = 1;
        if (target && bd < 110) { S.state = 'coil'; S.t = 0; S.target = target; Bus.emit('snakeWarning', target); AudioFX.hiss && AudioFX.hiss(S.x); }
        else if (S.t > 22) { S.state = 'leave'; S.t = 0; }
        break;
      }
      case 'coil':
        S.tongue = .5 + .5 * Math.sin(S.t * 12);
        if (S.t >= 1.6) { S.state = 'strike'; S.t = 0; S.checked = false; }
        break;
      case 'strike': {
        S.strike = smoothstep(0, .12, S.t) - smoothstep(.25, .5, S.t);
        if (S.t >= .12 && !S.checked) {
          S.checked = true;
          for (const q of players) {
            if (!this.snakeReach(q)) continue;
            if (q.crouch > .6) Bus.emit('snakeSafe', q);
            else { q.frightened(S.x, S.y, 'snake'); Bus.emit('snakeScare', q); }
          }
        }
        if (S.t > .7) { S.state = 'leave'; S.t = 0; S.strike = 0; }
        break;
      }
      case 'leave':
        S.dir = S.side; S.x += S.dir * 60 * dt;
        if (Math.abs(S.x) > pond.W + 720) { S.state = 'hidden'; S.timer = rnd(90, 160); }
        break;
    }
  }

  /* ---------- raccoon ---------- */
  updateRaccoon(dt, players, env) {
    const R = this.raccoon, G = this.G, pond = G.pond, p = players[0];
    R.ph += dt * 5; R.t += dt;
    switch (R.state) {
      case 'away':
        R.timer -= dt;
        if (R.timer <= 0 && env.night > .6 && !env.cold) { R.state = 'walk'; R.t = 0; R.side = p.x < 0 ? -1 : 1; R.x = R.side * (pond.W + 760); R.dir = -R.side; R.pose = 'walk'; Bus.emit('raccoonOut', R); AudioFX.chitter && AudioFX.chitter(R.x); }
        break;
      case 'walk': {
        const want = R.side * (pond.W + 26);
        R.dir = sign(want - R.x) || R.dir;
        R.x += R.dir * 55 * dt; R.y = pond.bedY(R.x) - 18;
        if (Math.abs(R.x - want) < 6) { R.state = 'pat'; R.t = 0; R.pose = 'pat'; R.dir = -R.side; }
        break;
      }
      case 'pat': {
        R.y = pond.bedY(R.x) - 18;
        if (chance(dt * 3)) { pond.disturb(R.x - R.side * 40, 10, 2); G.particles.ripple(R.x - R.side * 40, pond.surfaceAt(R.x - R.side * 40), .6); }
        const inReach = players.filter(q => this.raccoonReach(q));
        if (R.t > 2.5 && inReach.length && !R.warned) { R.warned = true; Bus.emit('raccoonWarning', inReach[0]); }
        if (R.t > 5 && inReach.length && !R.checked) {
          R.checked = true;
          for (const q of inReach) {
            if (q.species.special === 'toad' && q.stage >= 4) { R.pose = 'yuck'; G.particles.text(R.x, R.y - 40, 'yuck!', '#fff', 18); q.frightened(R.x, R.y, 'raccoon'); q.fright = .3; Bus.emit('raccoonYuck', q); }
            else if (this.raccoonSafe(q)) Bus.emit('raccoonSafe', q);
            else { q.frightened(R.x, R.y, 'raccoon'); Bus.emit('raccoonScare', q); }
          }
          G.particles.splash(R.x - R.side * 40, pond.surfaceAt(R.x - R.side * 40), .9, 12); AudioFX.splash && AudioFX.splash(1, R.x, 2);
        }
        if (R.t > 8 || (R.t > 4 && !inReach.length && !R.checked && chance(dt * .3))) { R.state = 'leave'; R.t = 0; R.pose = 'walk'; R.dir = R.side; R.warned = false; R.checked = false; }
        break;
      }
      case 'leave':
        R.x += R.dir * 70 * dt; R.y = pond.bedY(R.x) - 18;
        if (Math.abs(R.x) > pond.W + 800) { R.state = 'away'; R.timer = rnd(100, 200); }
        break;
    }
  }

  /* ---------- the fish ---------- */
  updateFish(dt, players, env) {
    const F = this.fish, G = this.G, pond = G.pond;
    const dusk = env.tod > .7 && env.tod < .97 || (env.night > .4 && env.tod < .2);
    F.ph += dt * (4 + Math.abs(F.vx) * .04); F.t += dt;
    switch (F.state) {
      case 'away':
        F.timer -= dt;
        if (F.timer <= 0 && dusk && !env.cold && pond.maxDepth >= 350) { F.state = 'patrol'; F.t = 0; F.x = -pond.W * .6; F.y = 330; F.vx = 60; F.dir = 1; Bus.emit('fishOut', F); AudioFX.swirl && AudioFX.swirl(F.x); }
        break;
      case 'patrol': {
        F.vx += (F.dir * 70 - F.vx) * (1 - Math.exp(-dt * 1.2));
        F.vy = Math.sin(F.t * .7) * 20;
        F.x += F.vx * dt; F.y += F.vy * dt;
        if (F.x > pond.W - 450) F.dir = -1; if (F.x < -pond.W + 450) F.dir = 1;
        F.y = clamp(F.y, 240, pond.bedY(F.x) - 40);
        const target = players.find(q => this.fishReach(q));
        if (target) { F.state = 'hunt'; F.t = 0; F.target = target; Bus.emit('fishWarning', target); AudioFX.swirl && AudioFX.swirl(F.x); }
        if (!dusk || F.t > 60) { F.state = 'leave'; F.t = 0; }
        break;
      }
      case 'hunt': {
        const q = F.target;
        F.dir = sign(q.x - F.x) || F.dir;
        F.vx += ((q.x - F.x) * 1.4 - F.vx) * (1 - Math.exp(-dt * 2)); F.vy += ((q.y - F.y) * 1.4 - F.vy) * (1 - Math.exp(-dt * 2));
        const sp = Math.hypot(F.vx, F.vy), cap = 190; if (sp > cap) { F.vx *= cap / sp; F.vy *= cap / sp; }
        F.x += F.vx * dt; F.y += F.vy * dt;
        F.y = clamp(F.y, 150, pond.bedY(F.x) - 30);
        if (F.t > 1.3 && !F.checked) {
          F.checked = true;
          if (this.fishSafe(q) || dist(q.x, q.y, F.x, F.y) > 70) Bus.emit('fishSafe', q);
          else { q.frightened(F.x, F.y, 'fish'); Bus.emit('fishScare', q); G.particles.bubbles(F.x + F.dir * 30, F.y, 10, 1.2); }
        }
        if (F.t > 2.2) { F.state = 'patrol'; F.t = 0; F.checked = false; F.y = Math.max(F.y, 240); }
        break;
      }
      case 'leave':
        F.vx += (F.dir * 120 - F.vx) * dt; F.x += F.vx * dt; F.y += 20 * dt;
        if (Math.abs(F.x) > pond.W - 200 || F.y > pond.bedY(F.x) - 30) { F.state = 'away'; F.timer = rnd(60, 140); }
        break;
    }
  }

  sightings(mark, near) {
    if (this.snake.state !== 'hidden' && near(this.snake.x, this.snake.y, 260)) mark('snake');
    if (this.raccoon.state !== 'away' && near(this.raccoon.x, this.raccoon.y, 300)) mark('raccoon');
    if (this.fish.state !== 'away' && near(this.fish.x, this.fish.y, 260)) mark('fish');
  }
}
