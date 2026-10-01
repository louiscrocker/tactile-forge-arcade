// =====================================================
// Tactile Forge — Asteroids · Game engine
// Ship physics + bullets + asteroid splitting + saucers,
// toroidal screen wrap, wave progression, beat pacing.
// =====================================================

import { bus, state, persist } from '../state.js';
import * as audio from '../audio/audio.js';
import { Input } from './input.js';
import { drawScene } from '../render/scene.js';
import { PostFX } from '../render/postfx.js';
import {
  WORLD_W, WORLD_H,
  SHIP, ASTEROID, SAUCER, WAVE, SCORE, BEAT,
  DIFFICULTY, RANK, PHOSPHOR, WAVE_PALETTE, COMMS, SAUCER_COLOR,
} from './constants.js';

let _idGen = 0;
const nextId = () => ++_idGen;

// ----- Toroidal helpers -----
function wrapPos(o) {
  if (o.x < 0)            o.x += WORLD_W;
  else if (o.x >= WORLD_W) o.x -= WORLD_W;
  if (o.y < 0)            o.y += WORLD_H;
  else if (o.y >= WORLD_H) o.y -= WORLD_H;
}
function wrappedDistSq(ax, ay, bx, by) {
  let dx = ax - bx, dy = ay - by;
  if (dx >  WORLD_W / 2) dx -= WORLD_W;
  if (dx < -WORLD_W / 2) dx += WORLD_W;
  if (dy >  WORLD_H / 2) dy -= WORLD_H;
  if (dy < -WORLD_H / 2) dy += WORLD_H;
  return dx * dx + dy * dy;
}

// ----- Asteroid polygon generator -----
function makeRockShape(rng) {
  const n = ASTEROID.verts;
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Each vertex has a per-angle radius in [0.66, 1.05]
    const rr = 0.66 + rng() * 0.39;
    pts[i] = [Math.cos(a) * rr, Math.sin(a) * rr];
  }
  return pts;
}

function rng01() { return Math.random(); }

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderCanvas = document.createElement('canvas');
    this.ctx = this.renderCanvas.getContext('2d');

    this.postfx = new PostFX(this.renderCanvas, canvas);
    if (!this.postfx.available()) {
      this.fallbackCtx = canvas.getContext('2d');
      this.postfx = null;
    }

    this.input = new Input();
    this.running = false;
    this.paused = false;
    this._loop = this._loop.bind(this);
    this._t0 = 0;
    this._raf = 0;
    this.game = null;

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  _resize() {
    this._staleFrame = true;      // resizing clears the canvas — repaint even if paused
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.renderCanvas.width  = Math.floor(w * dpr);
    this.renderCanvas.height = Math.floor(h * dpr);
    this.renderCanvas._logicalW = w;
    this.renderCanvas._logicalH = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.fallbackCtx) {
      this.canvas.width  = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.fallbackCtx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (this.postfx) {
      this.postfx._resize();
    }
  }

  start({ difficulty = 'pilot' } = {}) {
    this._resize();
    // Anything typed before launch (a 'p' in the call sign, Shift for capitals)
    // must not arrive as a pause or a hyperspace jump on frame one.
    this.input.reset();
    this.input.enabled = true;
    const diff = DIFFICULTY[difficulty] || DIFFICULTY.pilot;

    this.game = {
      diff,
      ship: this._makeShip(true),
      bullets:    [],
      sBullets:   [],   // saucer bullets
      asteroids:  [],
      saucer:     null,
      particles:  [],
      wave:    1,
      score:   0,
      lives:   SHIP.startLives,
      high:    state.career.bestScore,
      time:    0,
      outcome: null,
      // Wave shaping
      betweenWaves: false,
      betweenT:     0,
      // Saucer scheduling
      saucerT:      this._randIn(SAUCER.firstSpawnDelay),
      // Beat
      beatT:    BEAT.startInterval,
      beatInterval: BEAT.startInterval,
      // Sortie counters
      shotsFired:       0,
      hits:             0,
      asteroidsBlasted: 0,
      saucersDowned:    0,
      wavesCleared:     0,
      // Bonus ship tracking
      nextExtraAt: SCORE.EXTRA_LIFE_AT,
      // FX
      flashTimer: 0,
      _commT:     0,
      palette:    WAVE_PALETTE[0],
    };

    audio.resetBeat();
    this._spawnAsteroidsForWave(this.game.wave);

    this.running = true;
    this.paused = false;
    bus.emit('phase', { num: 1, name: 'Wave 01', sub: 'Belt is hot' });
    this._queueComm(this._pick(COMMS.open));
    this._t0 = performance.now();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
    this._emitHud();
  }

  stop() {
    this.running = false;
    this.input.enabled = false;
    this.input.reset();
    cancelAnimationFrame(this._raf);
    audio.stopDrone();
    audio.stopThrust();
  }

  setPaused(p) {
    if (this.paused === p) return;
    this.paused = p;
    this._staleFrame = true;
    if (p) {
      audio.stopThrust();
      audio.stopDrone();
      // Drop keys held at the moment of pausing, or the ship keeps that input
      // banked through the veil and lurches on resume.
      this.input.reset();
    } else {
      this._t0 = performance.now();
      // The drone was cut on pause; a saucer still on screen needs it back.
      if (this.game?.saucer) audio.startDrone(this.game.saucer.kind === 'small');
    }
  }

  // ---------- Loop ----------
  _loop(now) {
    if (!this.running) return;
    const dtRaw = (now - this._t0) / 1000;
    this._t0 = now;
    const dt = Math.min(0.05, this.paused ? 0 : dtRaw);

    if (this.input.pausePressed) {
      this.input.pausePressed = false;
      bus.emit('pause-toggle');
    }

    if (!this.paused && this.game.outcome === null) {
      this._update(dt);
      this._render();
    } else if (this._staleFrame) {
      // Paused / finished: the canvas already holds the last frame, so only
      // repaint when something invalidated it (a resize, or entering pause).
      this._staleFrame = false;
      this._render();
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---------- Update ----------
  _update(dt) {
    const g = this.game;
    g.time += dt;
    if (g._commT > 0) g._commT -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;

    this._updateShip(dt);
    this._updateBullets(dt);
    this._updateSaucerBullets(dt);
    this._updateAsteroids(dt);
    this._updateSaucer(dt);
    this._updateParticles(dt);
    this._updateBeat(dt);

    if (g.betweenWaves) {
      g.betweenT -= dt;
      if (g.betweenT <= 0) this._beginNextWave();
    } else if (g.asteroids.length === 0 && !g.saucer) {
      this._waveClear();
    }

    this._emitHud();
  }

  // ---------- Ship ----------
  _makeShip(centered) {
    return {
      x: centered ? WORLD_W / 2 : Math.random() * WORLD_W,
      y: centered ? WORLD_H / 2 : Math.random() * WORLD_H,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,            // pointing up
      alive: true,
      respawnT: 0,
      invulnT: SHIP.invulnTime,
      thrusting: false,
      fireT: 0,
      hyperT: 0,
      // For drawing thrust flicker
      flameT: 0,
    };
  }

  _updateShip(dt) {
    const g = this.game;
    const s = g.ship;
    if (!s.alive) {
      // Respawn timer counts down only when no rocks/saucer-bullets are near center
      s.respawnT -= dt;
      if (s.respawnT <= 0 && this._isRespawnSafe()) {
        Object.assign(s, this._makeShip(true));
      }
      audio.stopThrust();
      return;
    }

    // Rotation
    if (this.input.rotLeft)  s.angle -= SHIP.rotRate * dt;
    if (this.input.rotRight) s.angle += SHIP.rotRate * dt;

    // Thrust
    s.thrusting = !!this.input.thrust;
    if (s.thrusting) {
      const a = s.angle;
      s.vx += Math.cos(a) * SHIP.thrust * dt;
      s.vy += Math.sin(a) * SHIP.thrust * dt;
      audio.startThrust();
      s.flameT += dt;
    } else {
      audio.stopThrust();
    }
    // Cap speed
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > SHIP.maxSpeed) {
      s.vx = (s.vx / sp) * SHIP.maxSpeed;
      s.vy = (s.vy / sp) * SHIP.maxSpeed;
    }
    // Friction (gentle exponential decay)
    const decay = Math.exp(-SHIP.friction * dt);
    s.vx *= decay;
    s.vy *= decay;

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    wrapPos(s);

    // Invulnerability tick
    if (s.invulnT > 0) s.invulnT -= dt;

    // Fire
    if (s.fireT > 0) s.fireT -= dt;
    const queued = this.input.drainFire();
    const wantsFire = (queued > 0) || (this.input.fireHeld && s.fireT <= 0);
    if (wantsFire && s.fireT <= 0 && g.bullets.length < SHIP.bulletMax) {
      const cd = SHIP.fireCooldown * (g.diff.fireCooldownMult || 1);
      const ttl = SHIP.bulletTTL * (g.diff.bulletTTLMult || 1);
      const a = s.angle;
      g.bullets.push({
        id: nextId(),
        x: s.x + Math.cos(a) * SHIP.radius,
        y: s.y + Math.sin(a) * SHIP.radius,
        vx: s.vx + Math.cos(a) * SHIP.bulletSpeed,
        vy: s.vy + Math.sin(a) * SHIP.bulletSpeed,
        ttl,
        from: 'ship',
      });
      s.fireT = cd;
      g.shotsFired += 1;
      audio.fire();
    }

    // Hyperspace
    if (s.hyperT > 0) s.hyperT -= dt;
    const hyper = this.input.drainHyper();
    if (hyper > 0 && s.hyperT <= 0) {
      s.hyperT = SHIP.hyperspaceCooldown;
      audio.hyperspace();
      this._queueComm(this._pick(COMMS.hyperspace));
      // 1-in-N mishap chance — spawn dead instead
      if (Math.random() < SHIP.hyperspaceMishap) {
        this._killShip();
        return;
      }
      // Teleport to random location, lose velocity
      s.x = Math.random() * WORLD_W;
      s.y = Math.random() * WORLD_H;
      s.vx = 0; s.vy = 0;
      s.invulnT = Math.max(s.invulnT, 0.6);
    }

    // Collide with asteroids (skip during invulnerability)
    if (s.invulnT <= 0) {
      for (const a of g.asteroids) {
        const r = ASTEROID.radii[a.tier] + SHIP.radius - 4;
        if (wrappedDistSq(s.x, s.y, a.x, a.y) <= r * r) {
          this._destroyAsteroid(a, true);
          this._killShip();
          return;
        }
      }
      // Saucer collision
      if (g.saucer) {
        const r = SAUCER[g.saucer.kind].radius + SHIP.radius - 2;
        if (wrappedDistSq(s.x, s.y, g.saucer.x, g.saucer.y) <= r * r) {
          this._killSaucer(true);
          this._killShip();
          return;
        }
      }
      // Saucer-bullet collision
      for (const b of g.sBullets) {
        const dr = SHIP.radius - 2;
        if (wrappedDistSq(s.x, s.y, b.x, b.y) <= dr * dr) {
          b.ttl = 0;
          this._killShip();
          return;
        }
      }
    }
  }

  _isRespawnSafe() {
    const g = this.game;
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    const SAFE2 = 110 * 110;
    for (const a of g.asteroids) {
      if (wrappedDistSq(cx, cy, a.x, a.y) < SAFE2 + ASTEROID.radii[a.tier] * ASTEROID.radii[a.tier]) {
        return false;
      }
    }
    if (g.saucer) {
      const r = SAUCER[g.saucer.kind].radius;
      if (wrappedDistSq(cx, cy, g.saucer.x, g.saucer.y) < SAFE2 + r * r) return false;
    }
    for (const b of g.sBullets) {
      if (wrappedDistSq(cx, cy, b.x, b.y) < (140 * 140)) return false;
    }
    return true;
  }

  _killShip() {
    const g = this.game;
    const s = g.ship;
    if (!s.alive) return;
    s.alive = false;
    s.thrusting = false;
    s.respawnT = SHIP.respawnDelay;
    audio.shipExplode();
    audio.stopThrust();
    audio.stopDrone();
    g.flashTimer = 0.45;
    bus.emit('hit');
    this._spawnShipDebris(s.x, s.y);
    this._queueComm(this._pick(COMMS.death));

    g.lives -= 1;
    if (g.lives < 0) {
      // No reserves left
      this._finish('gameover');
    }
  }

  // ---------- Bullets ----------
  _updateBullets(dt) {
    const g = this.game;
    const out = [];
    for (const b of g.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      wrapPos(b);
      if (b.ttl <= 0) continue;
      // Collide with asteroids
      let hit = false;
      for (const a of g.asteroids) {
        const r = ASTEROID.radii[a.tier];
        if (wrappedDistSq(b.x, b.y, a.x, a.y) <= r * r) {
          this._destroyAsteroid(a, false);
          g.hits += 1;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // Collide with saucer
      if (g.saucer) {
        const r = SAUCER[g.saucer.kind].radius;
        if (wrappedDistSq(b.x, b.y, g.saucer.x, g.saucer.y) <= r * r) {
          this._killSaucer(false);
          g.hits += 1;
          continue;
        }
      }
      out.push(b);
    }
    g.bullets = out;
  }

  _updateSaucerBullets(dt) {
    const g = this.game;
    const out = [];
    for (const b of g.sBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      wrapPos(b);
      if (b.ttl <= 0) continue;
      // Saucer bullets can also break asteroids (cabinet behavior — saucer can clear rocks)
      let hit = false;
      for (const a of g.asteroids) {
        const r = ASTEROID.radii[a.tier];
        if (wrappedDistSq(b.x, b.y, a.x, a.y) <= r * r) {
          this._destroyAsteroid(a, true);  // killed by enemy — no points
          hit = true;
          break;
        }
      }
      if (hit) continue;
      out.push(b);
    }
    g.sBullets = out;
  }

  // ---------- Asteroids ----------
  _spawnAsteroidsForWave(wave) {
    const g = this.game;
    const count = Math.min(WAVE.maxRocks, WAVE.startRocks + (wave - 1) * WAVE.perWaveStep);
    for (let i = 0; i < count; i++) {
      this._spawnAsteroidEdge(2, wave);
    }
    // Baseline for the beat's within-wave acceleration (large rock = 4 smalls).
    g.waveStartWeight = count * 4;
  }

  /** Per-wave speed scaling shared by fresh spawns and split fragments. */
  _rockSpeedScale(wave) {
    return (this.game.diff.rockSpeedMult || 1) * (1 + (wave - 1) * 0.04);
  }

  _spawnAsteroidEdge(tier, wave) {
    const g = this.game;
    // Spawn near an edge so the field doesn't appear on top of the ship. Between
    // waves the ship keeps its position, so an edge slot can still land on it —
    // retry until the slot is clear (bounded, then take the best of a bad lot).
    let x = 0, y = 0;
    const clear = (ASTEROID.radii[tier] + SHIP.radius + 90) ** 2;
    for (let attempt = 0; attempt < 12; attempt++) {
      if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 : WORLD_W;
        y = Math.random() * WORLD_H;
      } else {
        x = Math.random() * WORLD_W;
        y = Math.random() < 0.5 ? 0 : WORLD_H;
      }
      if (!g.ship.alive) break;
      if (wrappedDistSq(x, y, g.ship.x, g.ship.y) >= clear) break;
    }
    const angle = Math.random() * Math.PI * 2;
    const sp = (ASTEROID.baseSpeed[tier] + (Math.random() * 2 - 1) * ASTEROID.speedJit[tier])
              * this._rockSpeedScale(wave);
    g.asteroids.push(this._mkAsteroid(x, y, angle, sp, tier));
  }

  _mkAsteroid(x, y, angle, speed, tier) {
    return {
      id: nextId(),
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      tier,
      shape: makeRockShape(rng01),
      rot:  Math.random() * Math.PI * 2,
      rotRate: (Math.random() * 2 - 1) * ASTEROID.tumble[tier],
    };
  }

  _updateAsteroids(dt) {
    const g = this.game;
    for (const a of g.asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.rotRate * dt;
      wrapPos(a);
    }
  }

  // killedByEnemy=true means no score (ship death, saucer bullet)
  _destroyAsteroid(a, killedByEnemy) {
    const g = this.game;
    const idx = g.asteroids.indexOf(a);
    if (idx < 0) return;
    g.asteroids.splice(idx, 1);
    g.asteroidsBlasted += 1;
    // Score
    if (!killedByEnemy) {
      g.score += ASTEROID.points[a.tier];
      this._maybeAwardExtraShip();
    }
    // Audio
    if (a.tier === 2) audio.bangLarge();
    else if (a.tier === 1) audio.bangMedium();
    else audio.bangSmall();
    // Debris
    this._spawnRockDebris(a.x, a.y, a.tier);
    // Split into 2 smaller asteroids if not already small
    if (a.tier > 0) {
      const childTier = a.tier - 1;
      const baseAngle = Math.atan2(a.vy, a.vx);
      // Fragments obey the same difficulty/wave scaling as fresh rocks —
      // they are most of the field, so leaving them unscaled flattens the tiers.
      const childSpeed = (ASTEROID.baseSpeed[childTier] +
                          Math.random() * ASTEROID.speedJit[childTier])
                         * this._rockSpeedScale(g.wave);
      const fan = 0.7;
      for (let i = 0; i < 2; i++) {
        const off = (i === 0 ? -1 : 1) * (fan * (0.55 + Math.random() * 0.4));
        const angle = baseAngle + off;
        g.asteroids.push(this._mkAsteroid(a.x, a.y, angle, childSpeed, childTier));
      }
    }
  }

  // ---------- Saucer ----------
  _updateSaucer(dt) {
    const g = this.game;
    if (g.betweenWaves) return;
    if (!g.saucer) {
      g.saucerT -= dt;
      if (g.saucerT <= 0) this._spawnSaucer();
      return;
    }
    const s = g.saucer;
    const def = SAUCER[s.kind];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // Saucers wrap horizontally but die when reaching the opposite edge
    if (s.dir > 0 && s.x > WORLD_W + 20) { g.saucer = null; audio.stopDrone(); g.saucerT = this._randIn(SAUCER.respawnDelay); return; }
    if (s.dir < 0 && s.x < -20)         { g.saucer = null; audio.stopDrone(); g.saucerT = this._randIn(SAUCER.respawnDelay); return; }
    // Vertical wrap
    if (s.y < 0) s.y += WORLD_H;
    if (s.y >= WORLD_H) s.y -= WORLD_H;
    // Zigzag
    s.zigT -= dt;
    if (s.zigT <= 0) {
      s.zigT = this._randIn(SAUCER.zigzagEvery);
      s.vy = (Math.random() * 2 - 1) * def.speed * 0.6 * (g.diff.saucerSpeedMult || 1);
    }
    // Fire
    s.fireT -= dt;
    if (s.fireT <= 0) {
      s.fireT = def.fireEvery / (g.diff.saucerFireMult || 1);
      this._saucerShoot(s);
    }
  }

  _spawnSaucer() {
    const g = this.game;
    const wave = g.wave;
    const smallStart = g.diff.smallStartWave ?? SAUCER.smallStartWave;
    const wantSmall = wave >= smallStart && Math.random() < SAUCER.smallProb(wave) * (g.diff.saucerSmallProbMult || 1);
    const kind = wantSmall ? 'small' : 'large';
    const def = SAUCER[kind];
    const fromLeft = Math.random() < 0.5;
    const speed = def.speed * (g.diff.saucerSpeedMult || 1);
    g.saucer = {
      kind,
      x: fromLeft ? -20 : WORLD_W + 20,
      y: 100 + Math.random() * (WORLD_H - 200),
      vx: (fromLeft ? 1 : -1) * speed,
      vy: 0,
      dir: fromLeft ? 1 : -1,
      fireT: 1.2 + Math.random() * 0.8,
      zigT:  this._randIn(SAUCER.zigzagEvery),
    };
    audio.startDrone(kind === 'small');
    this._queueComm(this._pick(kind === 'small' ? COMMS.saucerSmall : COMMS.saucer));
  }

  _saucerShoot(s) {
    const g = this.game;
    const def = SAUCER[s.kind];
    let aim;
    if (g.ship.alive) {
      // Aim at ship through wrap (shortest delta)
      let dx = g.ship.x - s.x, dy = g.ship.y - s.y;
      if (dx >  WORLD_W / 2) dx -= WORLD_W;
      if (dx < -WORLD_W / 2) dx += WORLD_W;
      if (dy >  WORLD_H / 2) dy -= WORLD_H;
      if (dy < -WORLD_H / 2) dy += WORLD_H;
      aim = Math.atan2(dy, dx);
    } else {
      aim = Math.random() * Math.PI * 2;
    }
    aim += (Math.random() * 2 - 1) * def.aimJitter;
    g.sBullets.push({
      id: nextId(),
      x: s.x, y: s.y,
      vx: Math.cos(aim) * def.bulletSpeed,
      vy: Math.sin(aim) * def.bulletSpeed,
      ttl: def.bulletTTL,
      from: 'saucer',
    });
    audio.saucerFire();
  }

  // killedByCollision=true means the saucer was rammed (ship dies too — no points)
  _killSaucer(killedByCollision) {
    const g = this.game;
    if (!g.saucer) return;
    const def = SAUCER[g.saucer.kind];
    if (!killedByCollision) {
      g.score += def.points;
      g.saucersDowned += 1;
      this._maybeAwardExtraShip();
    }
    audio.bangLarge();
    audio.stopDrone();
    this._spawnRockDebris(g.saucer.x, g.saucer.y, 2);
    g.saucer = null;
    g.saucerT = this._randIn(SAUCER.respawnDelay);
  }

  // ---------- Particles ----------
  _spawnRockDebris(x, y, tier) {
    const g = this.game;
    const n = 8 + tier * 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;
      g.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.6,
        len: 4 + Math.random() * 7,
        color: null,           // null → use phosphor color
      });
    }
  }
  _spawnShipDebris(x, y) {
    const g = this.game;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 180;
      g.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.7,
        len: 5 + Math.random() * 10,
        color: null,
      });
    }
  }
  _updateParticles(dt) {
    const g = this.game;
    const out = [];
    for (const p of g.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      wrapPos(p);
      if (p.life > 0) out.push(p);
    }
    g.particles = out;
  }

  // ---------- Beat ----------
  _updateBeat(dt) {
    const g = this.game;
    if (g.betweenWaves || g.outcome) return;
    if (!state.settings.music) return;
    // Interval shrinks over the wave as rocks are cleared. Measure progress in
    // *small-rock equivalents* (large=4, medium=2, small=1), which splitting
    // conserves — a raw asteroid count rises when a rock splits, which would
    // make the beat slow down mid-wave.
    const startWeight = Math.max(1, g.waveStartWeight || 1);
    let remaining = 0;
    for (const a of g.asteroids) remaining += 1 << a.tier;
    const cleared = Math.min(1, Math.max(0, 1 - remaining / startWeight));
    const waveBase   = Math.max(BEAT.minInterval, BEAT.startInterval - (g.wave - 1) * BEAT.decayPerWave);
    g.beatInterval = Math.max(BEAT.minInterval, waveBase - cleared * BEAT.emptyShrink);
    g.beatT -= dt;
    if (g.beatT <= 0) {
      g.beatT = g.beatInterval;
      audio.beat();
    }
  }

  // ---------- Wave clear / next wave ----------
  _waveClear() {
    const g = this.game;
    g.wavesCleared += 1;
    g.betweenWaves = true;
    g.betweenT = WAVE.betweenDelay;
    audio.waveClear();
    audio.stopDrone();
    this._queueComm(this._pick(COMMS.waveClear));
  }

  _beginNextWave() {
    const g = this.game;
    g.wave += 1;
    g.betweenWaves = false;
    g.palette = WAVE_PALETTE[(g.wave - 1) % WAVE_PALETTE.length];
    audio.resetBeat();
    g.beatT = BEAT.startInterval;
    g.saucerT = this._randIn(SAUCER.firstSpawnDelay);
    this._spawnAsteroidsForWave(g.wave);
    bus.emit('phase', {
      num:  g.wave,
      name: `Wave ${String(g.wave).padStart(2, '0')}`,
      sub:  'Belt thicker',
    });
    this._queueComm(this._pick(COMMS.wave));
  }

  // ---------- Restart current wave ----------
  restartWave() {
    const g = this.game;
    if (!g || g.outcome) return;
    g.bullets.length = 0;
    g.sBullets.length = 0;
    g.asteroids.length = 0;
    g.particles.length = 0;
    g.saucer = null;
    audio.stopDrone();
    g.betweenWaves = false;
    g.betweenT = 0;
    g.saucerT = this._randIn(SAUCER.firstSpawnDelay);
    Object.assign(g.ship, this._makeShip(true));
    this._spawnAsteroidsForWave(g.wave);
    bus.emit('phase', {
      num:  g.wave,
      name: `Wave ${String(g.wave).padStart(2, '0')}`,
      sub:  'Restart',
    });
  }

  // ---------- Bonus ship ----------
  _maybeAwardExtraShip() {
    const g = this.game;
    while (g.score >= g.nextExtraAt) {
      g.nextExtraAt += SCORE.EXTRA_LIFE_AT;
      g.lives += 1;
      audio.extraShip();
      this._queueComm(this._pick(COMMS.extraShip));
    }
  }

  // ---------- Finish ----------
  _finish(outcome) {
    const g = this.game;
    if (g.outcome) return;
    g.outcome = outcome;
    audio.stopDrone();
    audio.stopThrust();
    audio.defeat();
    this._queueComm(this._pick(COMMS.gameOver));

    state.career.patrols          += 1;
    state.career.wavesCleared     += g.wavesCleared;
    state.career.asteroidsBlasted += g.asteroidsBlasted;
    state.career.saucersDowned    += g.saucersDowned;
    state.career.shotsFired       += g.shotsFired;
    state.career.hits             += g.hits;
    state.career.bestScore = Math.max(state.career.bestScore, g.score);
    state.career.bestWave  = Math.max(state.career.bestWave, g.wave);
    state.lastSortie = {
      outcome,
      score: g.score,
      wavesCleared: g.wavesCleared,
      asteroidsBlasted: g.asteroidsBlasted,
      saucersDowned: g.saucersDowned,
      shotsFired: g.shotsFired,
      hits: g.hits,
      time: g.time,
      wave: g.wave,
      message: 'The void is quiet again.',
      rank: RANK(g.score),
    };
    this.running = false;
    this.input.enabled = false;
    this.input.reset();
    persist();
    bus.emit('mission-end', state.lastSortie);
  }

  // ---------- Helpers ----------
  _pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  _randIn([lo, hi]) { return lo + Math.random() * (hi - lo); }

  _queueComm(text) {
    if (!text) return;
    this.game._commT = 3.0;
    bus.emit('comm', text.replace('{pilot}', state.pilot || 'ROGUE'));
  }

  _emitHud() {
    const g = this.game;
    if (!g) return;
    bus.emit('hud', {
      wave:  g.wave,
      lives: Math.max(0, g.lives),
      rocks: g.asteroids.length,
      saucer: g.saucer ? g.saucer.kind.toUpperCase() : '—',
      score: g.score,
      high:  Math.max(g.high, g.score),
      time:  g.time,
    });
  }

  // ---------- Render delegate ----------
  _render() {
    const g = this.game;
    if (!g) return;
    const phos = PHOSPHOR[state.settings.phosphor] || PHOSPHOR.green;
    drawScene(this.ctx, this.renderCanvas, g, phos);
    if (this.postfx) {
      const s = state.settings;
      const bloomLevel = s.bloom ?? 'soft';
      const curveOn   = s.curve ?? true;
      const opts = {
        bloom:    bloomLevel === 'off' ? 0 : bloomLevel === 'hot' ? 1.4 : 0.8,
        threshold: bloomLevel === 'hot' ? 0.45 : 0.6,
        curve:    curveOn ? 0.06 : 0,
        scanline: s.crt ? 0.55 : 0,
        chroma:   curveOn ? 0.6 : 0,
      };
      this.postfx.present(opts);
    } else if (this.fallbackCtx) {
      this.fallbackCtx.drawImage(this.renderCanvas, 0, 0);
    }
  }
}
