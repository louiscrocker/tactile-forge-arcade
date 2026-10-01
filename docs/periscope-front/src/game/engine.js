// =====================================================
// Tactile Forge — Tank Battle · Game engine
// First-person wireframe tank combat. Player drives a
// single tank around a small XZ plain dotted with cubes
// and pyramids; enemy armor and saucers spawn in waves.
// =====================================================

import { bus, state, persist } from '../state.js';
import * as audio from '../audio/audio.js';
import { Input } from './input.js';
import { generateField } from './terrain.js';
import { drawScene } from '../render/scene.js';
import { PostFX } from '../render/postfx.js';
import {
  WORLD_R, TANK, PLAYER, OBSTACLES, ENEMY,
  SCORE, RANK, PHOSPHOR, ENEMY_COLOR, COMMS,
  DIFFICULTY, waveCount, waveMult,
} from './constants.js';

let _idGen = 0;
const nextId = () => ++_idGen;

const SHELL_R = 0.5;
const TANK_R  = 2.6;     // radius for tank-vs-obstacle / tank-vs-shell collision
const RESPAWN_DELAY = 2.2;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    // Offscreen render target — engine draws here in 2D, then PostFX composites.
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

  start({ difficulty = 'defender' } = {}) {
    this._resize();
    // Anything typed before launch (a 'p' in the call sign, WASD letters) must
    // not arrive as a pause or a latched shot on frame one.
    this.input.reset();
    this.input.enabled = true;
    audio.startDrone();
    const diff = DIFFICULTY[difficulty] || DIFFICULTY.defender;
    const seed = ((Math.random() * 0xffffff) | 0) >>> 0;
    const field = generateField(seed, 0, 0);

    this.game = {
      diff,
      field,
      player: {
        x: 0, z: 0, heading: 0,
        vForward: 0,
        hull: PLAYER.hullMax,
        fireT: 0,
        lives: diff.startingTanks,
        dead: false,
        deadT: 0,
        flashT: 0,
      },
      enemies:   [],
      shells:    [],
      particles: [],
      wave: 1,
      score: 0,
      high:  state.career.bestScore,
      time:  0,
      outcome: null,
      mult:  waveMult(1),
      // Wave shaping
      spawnedThisWave: 0,
      spawnQuota: waveCount(1),
      spawnTimer: 0,
      betweenWaves: false,
      betweenT: 0,
      // Career counters (sortie-local)
      fired: 0,
      hits:  0,
      saucerKills: 0,
      superKills:  0,
      wavesCleared: 0,
      // FX / chatter
      flashTimer: 0,
      _commT: 0,
      // Bonus-tank milestone tracking
      nextBonusAt: SCORE.EXTRA_TANK,
    };

    this.running = true;
    this.paused = false;
    bus.emit('phase', { num: 1, name: 'Wave 01', sub: 'Hostile contact' });
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
  }

  setPaused(p) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) {
      // Cut the engine drone and drop keys held at the moment of pausing, or
      // the tank banks that input through the veil and lurches on resume.
      audio.stopDrone();
      this.input.reset();
    } else {
      this._t0 = performance.now();
      audio.startDrone();
    }
  }

  // ---------- Loop ----------
  _loop(now) {
    if (!this.running) return;
    const dtRaw = (now - this._t0) / 1000;
    this._t0 = now;
    // rAF can stamp the first frame earlier than the performance.now() taken
    // at start, so dtRaw can be negative: clamp it, or the clock runs backwards.
    const dt = Math.max(0, Math.min(0.05, this.paused ? 0 : dtRaw));

    if (this.input.pausePressed) {
      this.input.pausePressed = false;
      bus.emit('pause-toggle');
    }

    if (!this.paused && this.game.outcome === null) {
      this._update(dt);
    }
    this._render();
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---------- Update ----------
  _update(dt) {
    const g = this.game;
    g.time += dt;
    if (g._commT > 0) g._commT -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;
    if (g.player.flashT > 0) g.player.flashT -= dt;

    if (g.betweenWaves) {
      g.betweenT -= dt;
      if (g.betweenT <= 0) this._beginNextWave();
    } else {
      this._spawnTick(dt);
    }

    this._updatePlayer(dt);
    this._updateEnemies(dt);
    this._updateShells(dt);
    this._updateParticles(dt);

    // Bonus-tank milestone
    while (g.score >= g.nextBonusAt) {
      g.nextBonusAt += SCORE.EXTRA_TANK;
      g.player.lives += 1;
      audio.waveClear();
      this._queueComm(this._pick(COMMS.bonusTank));
    }

    // Wave-clear: full quota spawned, no enemies left, no enemy shells in flight
    if (!g.betweenWaves &&
        g.spawnedThisWave >= g.spawnQuota &&
        g.enemies.length === 0 &&
        !g.shells.some(s => s.owner === 'enemy')) {
      this._waveClear();
    }

    if (g.player.lives <= 0 && !g.player.dead) {
      this._finish('gameover');
    }

    this._emitHud();
  }

  // ---------- Player ----------
  _updatePlayer(dt) {
    const g = this.game;
    const p = g.player;

    if (p.dead) {
      p.deadT -= dt;
      if (p.deadT <= 0) {
        if (p.lives > 0) this._respawnPlayer();
        else this._finish('gameover');
      }
      return;
    }

    if (p.fireT > 0) p.fireT -= dt;

    const drv = this.input.driveAxis();
    const trn = this.input.turnAxis();

    // Hull rotation
    p.heading += trn * PLAYER.turnRate * dt;

    // Drive — forward direction is (sin h, cos h)
    let speed;
    if (drv > 0)      speed = PLAYER.driveSpeed;
    else if (drv < 0) speed = -PLAYER.reverseSpeed;
    else              speed = 0;
    p.vForward = speed;

    if (speed !== 0) {
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const nx = p.x + fx * speed * dt;
      const nz = p.z + fz * speed * dt;
      // Resolve obstacle collisions
      const resolved = this._resolveCollision(nx, nz, TANK_R);
      p.x = resolved.x;
      p.z = resolved.z;
    }

    // World bound: clamp to slightly inside WORLD_R
    const lim = WORLD_R - 4;
    if (p.x >  lim) p.x =  lim;
    if (p.x < -lim) p.x = -lim;
    if (p.z >  lim) p.z =  lim;
    if (p.z < -lim) p.z = -lim;

    // Fire?
    if (this.input.drainFire() && p.fireT <= 0) {
      p.fireT = PLAYER.fireCooldown;
      g.fired += 1;
      this._fireShell({
        owner: 'player',
        x: p.x + Math.sin(p.heading) * (TANK.hullL * 0.5 + TANK.barrelL * 0.5),
        z: p.z + Math.cos(p.heading) * (TANK.hullL * 0.5 + TANK.barrelL * 0.5),
        heading: p.heading,
        speed: PLAYER.shellSpeed,
      });
      audio.cannon();
    }
  }

  _respawnPlayer() {
    const g = this.game;
    g.player.x = 0; g.player.z = 0;
    g.player.heading = 0;
    g.player.hull = PLAYER.hullMax;
    g.player.dead = false;
    g.player.deadT = 0;
    g.player.flashT = 0.5;
    bus.emit('phase', {
      num:  g.wave,
      name: `Tank ${g.diff.startingTanks - g.player.lives + 1}`,
      sub:  `Periscope online`,
    });
  }

  // Push a candidate position out of any obstacle it overlaps.
  _resolveCollision(x, z, r) {
    for (const o of this.game.field.obstacles) {
      const dx = x - o.x, dz = z - o.z;
      const d = Math.hypot(dx, dz);
      const minD = r + o.r * 0.7;        // pyramid/cube footprint a bit smaller than visual r
      if (d < minD && d > 0.001) {
        const push = (minD - d) / d;
        x += dx * push;
        z += dz * push;
      } else if (d < 0.001) {
        x += r * 0.6; z += r * 0.6;
      }
    }
    return { x, z };
  }

  // ---------- Spawning ----------
  _spawnTick(dt) {
    const g = this.game;
    if (g.spawnedThisWave >= g.spawnQuota) return;
    if (g.enemies.length >= g.diff.maxConcurrent) return;
    g.spawnTimer -= dt;
    if (g.spawnTimer > 0) return;
    // Stagger so the field doesn't fill up instantly
    g.spawnTimer = 0.8 + Math.random() * 1.2;

    // Pick threat kind
    const w = g.wave;
    const d = g.diff;
    const rSau = (w >= d.saucerStartWave) ? d.saucerProb(w) : 0;
    const rSup = (w >= d.superStartWave)  ? d.superProb(w)  : 0;
    const r = Math.random();
    let kind;
    if (r < rSau)              kind = 'saucer';
    else if (r < rSau + rSup)  kind = 'super';
    else                       kind = 'tank';

    this._spawnEnemy(kind);
    g.spawnedThisWave += 1;
  }

  _spawnEnemy(kind) {
    const g = this.game;
    const p = g.player;
    // Spawn at random bearing, far from player
    const ang = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 80;
    const x = p.x + Math.cos(ang) * dist;
    const z = p.z + Math.sin(ang) * dist;
    // Clamp inside the world
    const lim = WORLD_R - 6;
    const sx = Math.max(-lim, Math.min(lim, x));
    const sz = Math.max(-lim, Math.min(lim, z));

    if (kind === 'saucer') {
      // Saucers fly across at altitude, in a straight line
      const vx = -Math.cos(ang) * ENEMY.saucer.drive;     // generally toward player
      const vz = -Math.sin(ang) * ENEMY.saucer.drive;
      g.enemies.push({
        id: nextId(), kind: 'saucer',
        x: sx, z: sz, y: ENEMY.saucer.altitude,
        vx, vz,
        bob: 0,
        hull: ENEMY.saucer.hullMax,
      });
      audio.saucer();
      this._queueComm(this._pick(COMMS.saucer));
      return;
    }

    const stats = (kind === 'super') ? ENEMY.super : ENEMY.tank;
    g.enemies.push({
      id: nextId(), kind,
      x: sx, z: sz,
      heading: Math.atan2(p.x - sx, p.z - sz),
      hull: stats.hullMax,
      fireT: 0.6 + Math.random() * 0.6,
      _think: 0,
    });
    if (kind === 'super') this._queueComm(this._pick(COMMS.super));
    else if (g.spawnedThisWave === 0) this._queueComm(this._pick(COMMS.inbound));
  }

  // ---------- Enemy AI ----------
  _updateEnemies(dt) {
    const g = this.game;
    const p = g.player;
    const out = [];
    for (const e of g.enemies) {
      if (e.kind === 'saucer') {
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.bob += dt;
        // Despawn if too far past world edge
        const lim = WORLD_R + 30;
        if (Math.abs(e.x) > lim || Math.abs(e.z) > lim) continue;
        out.push(e);
        continue;
      }

      // Ground tank AI
      const stats = (e.kind === 'super') ? ENEMY.super : ENEMY.tank;
      const speedMult = g.diff.enemySpeedMult;
      const dx = p.x - e.x, dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);

      // Angle toward player
      const desiredHeading = Math.atan2(dx, dz);
      const dh = wrapAngle(desiredHeading - e.heading);
      const turnStep = stats.turn * speedMult * dt;
      if (Math.abs(dh) <= turnStep) e.heading = desiredHeading;
      else e.heading += Math.sign(dh) * turnStep;

      // Drive (only if pointed roughly at player and not already too close)
      const facing = Math.cos(dh);
      let drive = 0;
      if (dist > 18 && facing > 0.7) drive = stats.drive * speedMult;
      // Back away if very close
      else if (dist < 14) drive = -stats.drive * 0.5;

      if (drive !== 0) {
        const nx = e.x + Math.sin(e.heading) * drive * dt;
        const nz = e.z + Math.cos(e.heading) * drive * dt;
        const r = this._resolveCollision(nx, nz, TANK_R);
        // Don't let enemy push into world bound
        const lim = WORLD_R - 4;
        e.x = Math.max(-lim, Math.min(lim, r.x));
        e.z = Math.max(-lim, Math.min(lim, r.z));
      }

      // Fire?
      if (e.fireT > 0) e.fireT -= dt;
      if (dist < stats.fireR && Math.abs(dh) < 0.35 && e.fireT <= 0) {
        e.fireT = stats.fireCooldown * g.diff.enemyFireRate * (0.85 + Math.random() * 0.3);
        // Aim with accuracy jitter
        const acc = g.diff.enemyAccuracy;
        const aimErr = (1 - acc) * 0.35;
        const aim = e.heading + (Math.random() - 0.5) * 2 * aimErr;
        const muzzleX = e.x + Math.sin(aim) * (TANK.hullL * 0.5 + TANK.barrelL * 0.5);
        const muzzleZ = e.z + Math.cos(aim) * (TANK.hullL * 0.5 + TANK.barrelL * 0.5);
        this._fireShell({
          owner: 'enemy', enemyId: e.id, kind: e.kind,
          x: muzzleX, z: muzzleZ, heading: aim, speed: stats.shellSpeed,
        });
        audio.cannon();
      }
      out.push(e);
    }
    g.enemies = out;
  }

  // ---------- Shells ----------
  _fireShell({ owner, enemyId, kind, x, z, heading, speed }) {
    this.game.shells.push({
      id: nextId(),
      owner, enemyId, kind,
      x, z, y: TANK.hullH * 0.6,
      vx: Math.sin(heading) * speed,
      vz: Math.cos(heading) * speed,
      life: PLAYER.shellLife,
    });
  }

  _updateShells(dt) {
    const g = this.game;
    const out = [];
    for (const s of g.shells) {
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      if (s.life <= 0) continue;

      // Out of world bounds → expire (no wrap; matches Battlezone "shell falls off")
      const lim = WORLD_R + 20;
      if (Math.abs(s.x) > lim || Math.abs(s.z) > lim) continue;

      // Obstacle hit?
      let hitObstacle = false;
      for (const o of g.field.obstacles) {
        const dx = s.x - o.x, dz = s.z - o.z;
        if (dx * dx + dz * dz <= (o.r * 0.7) * (o.r * 0.7)) {
          hitObstacle = true; break;
        }
      }
      if (hitObstacle) {
        audio.ricochet();
        this._spawnSparks(s.x, s.z, '#ffe04a');
        continue;
      }

      // Hit detection — ignore self-owner
      if (s.owner === 'player') {
        let killed = null;
        for (const e of g.enemies) {
          // Saucers float; check 3D distance
          if (e.kind === 'saucer') {
            const dx = s.x - e.x, dy = s.y - e.y, dz = s.z - e.z;
            if (dx * dx + dy * dy + dz * dz <= (ENEMY.saucer.radius + SHELL_R) * (ENEMY.saucer.radius + SHELL_R)) {
              killed = e; break;
            }
          } else {
            const dx = s.x - e.x, dz = s.z - e.z;
            if (dx * dx + dz * dz <= (TANK_R + SHELL_R) * (TANK_R + SHELL_R)) {
              killed = e; break;
            }
          }
        }
        if (killed) {
          this._killEnemy(killed);
          continue;
        }
      } else {
        const p = g.player;
        if (!p.dead) {
          const dx = s.x - p.x, dz = s.z - p.z;
          if (dx * dx + dz * dz <= (TANK_R + SHELL_R) * (TANK_R + SHELL_R)) {
            this._playerHit(s);
            continue;
          }
        }
      }
      out.push(s);
    }
    g.shells = out;
  }

  _killEnemy(e) {
    const g = this.game;
    let pts = SCORE.TANK_KILL;
    let big = false;
    if (e.kind === 'super')  { pts = SCORE.SUPER_KILL;  big = true; g.superKills += 1; }
    if (e.kind === 'saucer') { pts = SCORE.SAUCER_KILL; big = true; g.saucerKills += 1; }
    g.score += pts * waveMult(g.wave);
    g.hits += 1;
    audio.explode(big);
    const colKey = e.kind === 'super' ? 'super' : e.kind === 'saucer' ? 'saucer' : 'tank';
    this._spawnExplosion(e.x, e.kind === 'saucer' ? e.y : 0, e.z, ENEMY_COLOR[colKey]);
    g.enemies = g.enemies.filter(x => x !== e);
  }

  _playerHit(shell) {
    const g = this.game;
    const p = g.player;
    p.hull -= 50;            // shell does half hull
    p.flashT = 0.5;
    g.flashTimer = 0.5;
    audio.hullHit();
    bus.emit('hit');
    if (p.hull <= 0) {
      // Tank lost
      audio.explode(true);
      this._spawnExplosion(p.x, 0, p.z, { line: '#ff5a64', hot: '#ffd4d8' });
      p.dead = true;
      p.deadT = RESPAWN_DELAY;
      p.lives -= 1;
      if (p.lives > 0) this._queueComm(this._pick(COMMS.tankLost));
    } else {
      this._queueComm(this._pick(COMMS.hit));
    }
  }

  // ---------- Particles ----------
  _spawnSparks(x, z, color) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 10;
      this.game.particles.push({
        x, y: 0.6, z,
        vx: Math.cos(a) * sp,
        vy: 4 + Math.random() * 6,
        vz: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        color: { line: color, hot: '#ffffff' },
        len: 0.6,
      });
    }
  }

  _spawnExplosion(x, y, z, col) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.5;
      const sp = 8 + Math.random() * 18;
      this.game.particles.push({
        x, y: Math.max(0.4, y),
        z,
        vx: Math.cos(a) * Math.cos(elev) * sp,
        vy: Math.sin(elev) * sp + 3,
        vz: Math.sin(a) * Math.cos(elev) * sp,
        life: 0.6 + Math.random() * 0.7,
        color: { line: col.line || '#ff9a2a', hot: col.hot || '#ffffff' },
        len: 0.9,
      });
    }
  }

  _updateParticles(dt) {
    const g = this.game;
    const out = [];
    for (const p of g.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 22 * dt;          // gravity
      if (p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.life -= dt;
      if (p.life > 0) out.push(p);
    }
    g.particles = out;
  }

  // ---------- Wave clear / next wave ----------
  _waveClear() {
    const g = this.game;
    g.wavesCleared += 1;
    const bonus = SCORE.WAVE_BONUS * g.wave;
    g.score += bonus;
    audio.waveClear();
    bus.emit('bonus-toast', {
      wave: g.wave,
      mult: waveMult(g.wave),
      total: bonus,
      y: 200,
    });
    this._queueComm(this._pick(COMMS.waveClear));

    g.betweenWaves = true;
    g.betweenT = 2.6;
  }

  _beginNextWave() {
    const g = this.game;
    g.wave += 1;
    g.mult = waveMult(g.wave);
    g.spawnedThisWave = 0;
    g.spawnQuota = waveCount(g.wave);
    g.spawnTimer = 0.8;
    g.betweenWaves = false;
    bus.emit('phase', {
      num:  g.wave,
      name: `Wave ${String(g.wave).padStart(2, '0')}`,
      sub:  `Multiplier ×${g.mult}`,
    });
    if (g.wave >= g.diff.superStartWave) {
      this._queueComm(this._pick(COMMS.super));
    } else if (g.wave >= g.diff.saucerStartWave) {
      this._queueComm(this._pick(COMMS.saucer));
    } else {
      this._queueComm(this._pick(COMMS.inbound));
    }
  }

  _finish(outcome) {
    const g = this.game;
    if (g.outcome) return;
    g.outcome = outcome;
    audio.stopDrone();
    audio.defeat();
    this._queueComm(this._pick(COMMS.gameOver));

    // Career update
    state.career.sorties        += 1;
    state.career.wavesCleared   += g.wavesCleared;
    state.career.kills          += g.hits;
    state.career.saucerKills    += g.saucerKills;
    state.career.superKills     += g.superKills;
    state.career.shellsFired    += g.fired;
    state.career.bestScore = Math.max(state.career.bestScore, g.score);
    state.career.bestWave  = Math.max(state.career.bestWave,  g.wave);
    state.lastSortie = {
      outcome,
      score: g.score,
      wavesCleared: g.wavesCleared,
      kills: g.hits,
      saucerKills: g.saucerKills,
      superKills:  g.superKills,
      shellsFired: g.fired,
      time: g.time,
      message: outcome === 'gameover'
        ? 'Motor pool empty. CMD signs off.'
        : 'You stood your watch.',
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

  _queueComm(text) {
    if (!text) return;
    this.game._commT = 3.0;
    bus.emit('comm', text);
  }

  _emitHud() {
    const g = this.game;
    if (!g) return;
    // Range to nearest enemy (for HUD)
    let nearest = Infinity;
    for (const e of g.enemies) {
      const dx = e.x - g.player.x, dz = e.z - g.player.z;
      const d = Math.hypot(dx, dz);
      if (d < nearest) nearest = d;
    }
    bus.emit('hud', {
      wave:  g.wave,
      lives: g.player.lives,
      hull:  Math.max(0, g.player.hull) / PLAYER.hullMax,
      hullLow: g.player.hull <= 40,
      targets: g.enemies.length,
      range:   nearest === Infinity ? null : Math.round(nearest),
      score: g.score,
      high:  Math.max(g.high, g.score),
      mult:  waveMult(g.wave),
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

// Wrap an angle to (-π, π]
function wrapAngle(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}
