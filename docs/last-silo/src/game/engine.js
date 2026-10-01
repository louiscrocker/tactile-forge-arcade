// =====================================================
// Tactile Forge — Missile Attack · Game engine
// Wave loop, ICBM/MIRV/smart-bomb spawning, counter-missile
// flight, blast damage, city + battery destruction.
// =====================================================

import { bus, state } from '../state.js';
import * as audio from '../audio/audio.js';
import { Input } from './input.js';
import { generateSkyline, sampleSkyline } from './terrain.js';
import { buildScene, makeProj } from '../render/displaylist.js';
import { createRenderer, resolveMode } from '../render/index.js';
import {
  WORLD_W, WORLD_H, GROUND_Y,
  BATTERIES, CITIES, CITY, BATTERY,
  COUNTER, BLAST, MIRV, SCORE, RANK, PHOSPHOR,
  ENEMY_COLOR, COMMS, KILLER, WAVE_PALETTE,
  DIFFICULTY, waveCount, waveDuration, waveMult,
} from './constants.js';

let _idGen = 0;
const nextId = () => ++_idGen;

export class Engine {
  /**
   * @param {HTMLElement} stage - stable wrapper holding the game canvas.
   *   Pointer input and layout anchor to this element rather than to the canvas,
   *   because switching renderers replaces the canvas node (a canvas is bound to
   *   its first context type for life) and would otherwise drop every listener.
   */
  constructor(stage) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');

    this.renderer = null;
    this.rendererMode = null;
    this.setRenderer(state.settings.renderer);

    this.input = new Input(stage);
    this.running = false;
    this.paused = false;
    this._loop = this._loop.bind(this);
    this._t0 = 0;
    this._raf = 0;
    this.game = null;

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    // Initial resize so the canvas has correct dimensions before first start()
    this._resize();
  }

  /**
   * Swap the drawing back end, replacing the canvas element in the process.
   * @param {'auto'|'webgl'|'canvas'} pref
   */
  setRenderer(pref) {
    const mode = resolveMode(pref);
    if (this.renderer && mode === this.rendererMode) return this.rendererMode;

    if (this.renderer) {
      const fresh = this.canvas.cloneNode(false);   // keeps id, class, attrs
      this.canvas.replaceWith(fresh);
      this.canvas = fresh;
      this.renderer.dispose();
      this.renderer = null;
    }

    this.renderer = createRenderer(this.canvas, mode, {
      // A lost context can't be recovered in place; drop to Canvas 2D.
      onContextLost: () => {
        console.warn('WebGL context lost — switching to Canvas 2D.');
        this.rendererMode = null;
        this.setRenderer('canvas');
      },
    });
    this.rendererMode = this.renderer.mode;
    this._resize();
    return this.rendererMode;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer?.resize(window.innerWidth, window.innerHeight, dpr);
  }

  // ----- Convert canvas-CSS px → world px -----
  _cssToWorld(px, py) {
    const w = this.stage.clientWidth  || window.innerWidth  || WORLD_W;
    const h = this.stage.clientHeight || window.innerHeight || WORLD_H;
    return { x: px * (WORLD_W / w), y: py * (WORLD_H / h) };
  }

  start({ difficulty = 'defender' } = {}) {
    this._resize();
    audio.startDrone();
    const diff = DIFFICULTY[difficulty] || DIFFICULTY.defender;
    const skyline = generateSkyline(((Math.random() * 0xffffff) | 0) >>> 0);

    // Plant cities & batteries on the skyline
    const cities = CITIES.map(c => ({
      id: c.id, x: c.x, y: sampleSkyline(skyline, c.x), alive: true,
    }));
    const batteries = BATTERIES.map(b => ({
      id: b.id, label: b.label, x: b.x, y: sampleSkyline(skyline, b.x),
      alive: true, ammo: diff.ammoPerBat,
    }));

    this.game = {
      diff,
      skyline,
      cities,
      batteries,
      ammoMax: diff.ammoPerBat * 3,
      icbms:    [],
      counters: [],
      blasts:   [],
      particles:[],
      sats:     [],          // killer satellites
      bombers:  [],          // bombers
      wave: 1,
      score: 0,
      high:  state.career.bestScore,
      time:  0,
      outcome: null,        // null | 'gameover' | 'manual'
      mult:  waveMult(1),
      // Wave shaping
      spawnedThisWave: 0,
      spawnQuota: waveCount(1),
      spawnTimer: 0,
      spawnInterval: waveDuration(1) / waveCount(1),
      betweenWaves: false,
      betweenT: 0,
      palette: WAVE_PALETTE[0],
      // Career counters (sortie-local)
      fired: 0,
      hits:  0,
      wavesCleared: 0,
      // FX
      flashTimer: 0,
      lowAmmoWarned: false,
      _commT: 0,
      _crosshair: { x: WORLD_W / 2, y: WORLD_H / 2 },
      // Bonus-city milestone tracking
      nextBonusAt: SCORE.BONUS_CITY_AT,
      cityCredits: 0,
    };

    this.running = true;
    this.paused = false;
    // Fresh queues: keystrokes typed on the briefing screen must not fire
    // shots (or start the round paused) the moment the mission opens.
    this.input.reset();
    this.input.setEnabled(true);
    bus.emit('phase', { num: 1, name: 'Wave 01', sub: 'Inbound detected' });
    this._queueComm(this._pick(COMMS.open));
    this._t0 = performance.now();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
    this._emitHud();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.input.setEnabled(false);
    cancelAnimationFrame(this._raf);
    audio.stopDrone();
  }

  /** True while a sortie is live (not finished, not abandoned). */
  inProgress() {
    return this.running && !!this.game && this.game.outcome === null;
  }

  /** Stand down: end the sortie deliberately and bank it to the career log. */
  quit() {
    if (this.inProgress()) this._finish('manual');
    else this.stop();
  }

  setPaused(p) {
    this.paused = p;
    if (!p) this._t0 = performance.now();
  }

  // ---------- Loop ----------
  _loop(now) {
    if (!this.running) return;
    // rAF timestamps are captured at the start of the frame, so `now` can be
    // *earlier* than the performance.now() taken in start()/setPaused().
    // Without the lower clamp the first frame integrates a negative step and
    // the mission clock starts below zero.
    const dtRaw = Math.max(0, (now - this._t0) / 1000);
    this._t0 = now;
    const dt = Math.min(0.05, this.paused ? 0 : dtRaw);

    if (this.input.pausePressed) {
      this.input.pausePressed = false;
      bus.emit('pause-toggle');
    }

    if (!this.paused && this.game.outcome === null) {
      this._update(dt);
    }
    // Render gets the real elapsed time, not the paused-to-zero step: the
    // phosphor decay should keep fading while the game is paused.
    this._render(Math.min(0.05, dtRaw));
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---------- Update ----------
  _update(dt) {
    const g = this.game;
    g.time += dt;
    if (g._commT > 0) g._commT -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;

    // Update crosshair (mouse → world)
    const c = this._cssToWorld(this.input.mouseX, this.input.mouseY);
    g._crosshair.x = c.x;
    g._crosshair.y = c.y;

    // Process fire commands
    for (const cmd of this.input.drainFire()) {
      const w = this._cssToWorld(cmd.x, cmd.y);
      this._fire(w.x, w.y, cmd.batteryHint);
    }

    if (g.betweenWaves) {
      g.betweenT -= dt;
      if (g.betweenT <= 0) this._beginNextWave();
    } else {
      this._spawnTick(dt);
    }

    this._updateIcbms(dt);
    this._updateCounters(dt);
    this._updateBlasts(dt);
    this._updateParticles(dt);
    this._updateSats(dt);
    this._updateBombers(dt);

    // Bonus-city milestone (faithful to original cabinet)
    this._maybeAwardBonusCity();

    // Wave-clear detection
    if (!g.betweenWaves &&
        g.spawnedThisWave >= g.spawnQuota &&
        g.icbms.length === 0 &&
        g.counters.length === 0 &&
        g.blasts.length === 0 &&
        g.sats.length === 0 &&
        g.bombers.length === 0) {
      this._waveClear();
    }

    // Game-over detection: any cities still alive?
    if (!g.cities.some(c => c.alive)) {
      this._finish('gameover');
    }

    this._emitHud();
  }

  // ---------- Bonus-city milestone ----------
  _maybeAwardBonusCity() {
    const g = this.game;
    while (g.score >= g.nextBonusAt) {
      g.nextBonusAt += SCORE.BONUS_CITY_AT;
      // Try to revive the leftmost dead city; otherwise bank a credit
      const dead = g.cities.find(c => !c.alive);
      if (dead) {
        dead.alive = true;
        audio.waveClear();
        this._queueComm(this._pick(COMMS.bonusCity));
      } else {
        g.cityCredits += 1;
        audio.waveClear();
      }
    }
  }

  _redeemCityCredits() {
    const g = this.game;
    while (g.cityCredits > 0) {
      const dead = g.cities.find(c => !c.alive);
      if (!dead) break;
      dead.alive = true;
      g.cityCredits -= 1;
    }
  }

  // ---------- Wave shaping ----------
  _spawnTick(dt) {
    const g = this.game;
    if (g.spawnedThisWave >= g.spawnQuota) return;
    g.spawnTimer += dt;
    if (g.spawnTimer >= g.spawnInterval) {
      g.spawnTimer = 0;
      // Late-wave threats: a roll for satellite or bomber instead of an ICBM
      const wave = g.wave;
      const rSat    = (wave >= KILLER.satStartWave)    ? KILLER.satProb(wave)    : 0;
      const rBomber = (wave >= KILLER.bomberStartWave) ? KILLER.bomberProb(wave) : 0;
      const r = Math.random();
      if (r < rSat) {
        this._spawnSat();
      } else if (r < rSat + rBomber) {
        this._spawnBomber();
      } else {
        this._spawnIcbm();
      }
      g.spawnedThisWave += 1;
    }
  }

  _spawnSat() {
    const g = this.game;
    const fromLeft = Math.random() < 0.5;
    g.sats.push({
      id: nextId(),
      x: fromLeft ? -30 : WORLD_W + 30,
      y: KILLER.satY + (Math.random() - 0.5) * 30,
      vx: (fromLeft ? 1 : -1) * KILLER.satSpeed,
      dropT: 0.8 + Math.random() * 0.8,
    });
    this._queueComm(this._pick(COMMS.satellite));
  }

  _spawnBomber() {
    const g = this.game;
    const fromLeft = Math.random() < 0.5;
    g.bombers.push({
      id: nextId(),
      x: fromLeft ? -40 : WORLD_W + 40,
      y: KILLER.bomberY + (Math.random() - 0.5) * 24,
      vx: (fromLeft ? 1 : -1) * KILLER.bomberSpeed,
      dropT: 1.0 + Math.random() * 0.6,
      dropsRemaining: KILLER.bomberDropBurst,
    });
    this._queueComm(this._pick(COMMS.bomber));
  }

  _spawnIcbm() {
    const g = this.game;
    const d = g.diff;
    const wave = g.wave;
    // Pick threat kind
    let kind = 'icbm';
    if (wave >= d.smartStartWave && Math.random() < d.smartProb(wave)) {
      kind = 'smart';
    } else if (wave >= d.mirvStartWave && Math.random() < d.mirvProb(wave)) {
      kind = 'mirv';
    }
    // Origin: top edge, random x with some bias toward middle
    const x0 = 30 + Math.random() * (WORLD_W - 60);
    // Target: a random alive city or battery
    const tgt = this._pickGroundTarget();
    const dx = tgt.x - x0;
    const dy = tgt.y - 0;
    const len = Math.hypot(dx, dy);
    const sp = d.icbmSpeed + (Math.random() - 0.5) * 2 * d.icbmSpeedJit;

    const icbm = {
      id: nextId(),
      kind,
      x: x0, y: 0,
      vx: (dx / len) * sp,
      vy: (dy / len) * sp,
      target: { x: tgt.x, y: tgt.y },
      color: kind === 'smart' ? ENEMY_COLOR.smart
            : kind === 'mirv' ? ENEMY_COLOR.mirv
            : ENEMY_COLOR.icbm,
      // Trail history (sampled positions for vector trail)
      trail: [[x0, 0]],
      trailT: 0,
      // MIRV-specific
      splitAt: kind === 'mirv'
        ? (MIRV.splitYMin + Math.random() * (MIRV.splitYMax - MIRV.splitYMin))
        : null,
      // Smart-bomb evasion timer
      lastEvade: 0,
      born: g.time,
    };
    g.icbms.push(icbm);
  }

  _pickGroundTarget() {
    const g = this.game;
    const candidates = [
      ...g.cities.filter(c => c.alive),
      ...g.batteries.filter(b => b.alive),
    ];
    if (candidates.length === 0) {
      // Fallback: aim at the center ground
      return { x: WORLD_W / 2, y: GROUND_Y };
    }
    return candidates[(Math.random() * candidates.length) | 0];
  }

  // ---------- ICBM update + collision ----------
  _updateIcbms(dt) {
    const g = this.game;
    const TRAIL_DT = 0.04;
    const out = [];
    for (const m of g.icbms) {
      // Smart-bomb evasion: look for active blasts within 150 world units
      if (m.kind === 'smart') {
        m.lastEvade += dt;
        if (m.lastEvade >= 0.35) {
          m.lastEvade = 0;
          let avoidX = 0, avoidY = 0, threats = 0;
          for (const b of g.blasts) {
            const ddx = m.x - b.x, ddy = m.y - b.y;
            const d = Math.hypot(ddx, ddy);
            if (d < 150 && d > 0.001) {
              avoidX += ddx / d;
              avoidY += ddy / d;
              threats += 1;
            }
          }
          if (threats > 0) {
            // Blend current heading with the avoidance vector
            const sp = Math.hypot(m.vx, m.vy);
            const ax = avoidX / threats;
            const ay = avoidY / threats;
            // Mostly continue downward; deflect by avoidance
            const nx = m.vx + ax * sp * 0.85;
            const ny = m.vy + ay * sp * 0.55;
            const nl = Math.hypot(nx, ny) || 1;
            m.vx = (nx / nl) * sp;
            m.vy = (ny / nl) * sp;
            // Always keep moving downward at least a little
            if (m.vy < sp * 0.25) m.vy = sp * 0.25;
          }
        }
      }

      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.trailT += dt;
      if (m.trailT >= TRAIL_DT) {
        m.trailT = 0;
        m.trail.push([m.x, m.y]);
        if (m.trail.length > 80) m.trail.shift();
      }

      // MIRV split
      if (m.kind === 'mirv' && m.splitAt !== null && m.y >= m.splitAt) {
        this._splitMirv(m);
        // (Don't push m to out — it's consumed by split)
        audio.mirvSplit();
        continue;
      }

      // Off-screen sideways → clamp
      if (m.x < -20 || m.x > WORLD_W + 20) continue;

      // Ground impact?
      const groundY = sampleSkyline(g.skyline, Math.max(0, Math.min(WORLD_W, m.x)));
      if (m.y >= groundY) {
        this._impactGround(m, groundY);
        continue;
      }

      // Blast damage check
      if (this._checkBlasts(m)) continue;

      out.push(m);
    }
    g.icbms = out;
  }

  _splitMirv(parent) {
    const g = this.game;
    const n = MIRV.splitMin + Math.floor(Math.random() * (MIRV.splitMax - MIRV.splitMin + 1));
    for (let i = 0; i < n; i++) {
      const tgt = this._pickGroundTarget();
      const dx = tgt.x - parent.x;
      const dy = tgt.y - parent.y;
      const len = Math.hypot(dx, dy) || 1;
      const sp = Math.hypot(parent.vx, parent.vy);
      g.icbms.push({
        id: nextId(),
        kind: 'icbm',           // children behave as plain ICBMs
        x: parent.x + (Math.random() - 0.5) * 6,
        y: parent.y + (Math.random() - 0.5) * 4,
        vx: (dx / len) * sp,
        vy: (dy / len) * sp,
        target: { x: tgt.x, y: tgt.y },
        color: ENEMY_COLOR.mirv,
        trail: [[parent.x, parent.y]],
        trailT: 0,
        splitAt: null,
        lastEvade: 0,
        born: g.time,
      });
    }
  }

  _impactGround(m, groundY) {
    const g = this.game;
    // Damage radius for an ICBM impact
    const R = 28;
    for (const c of g.cities) {
      if (!c.alive) continue;
      if (Math.abs(c.x - m.x) < R) {
        c.alive = false;
        audio.cityHit();
        bus.emit('hit');
        g.flashTimer = 0.4;
        this._queueComm(this._pick(COMMS.cityLost));
      }
    }
    for (const b of g.batteries) {
      if (!b.alive) continue;
      if (Math.abs(b.x - m.x) < R) {
        b.alive = false;
        audio.cityHit();
        bus.emit('hit');
        g.flashTimer = 0.4;
        this._queueComm(this._pick(COMMS.batteryLost));
      }
    }
    // Small ground burst (enemy color)
    audio.enemyExplode();
    this._spawnGroundBurst(m.x, groundY, m.color);
  }

  // Returns true if `m` was destroyed by a blast (also awards score).
  _checkBlasts(m) {
    const g = this.game;
    for (const b of g.blasts) {
      if (b.phase === 'fade') continue;          // shrink phase doesn't kill
      const dx = m.x - b.x, dy = m.y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) {
        // KILL
        const mult = waveMult(g.wave);
        const isSmart = (m.kind === 'smart');
        const points = (isSmart ? SCORE.SMART_HIT : SCORE.ICBM_HIT) * mult;
        g.score += points;
        g.hits += 1;
        b.killCount += 1;
        audio.enemyExplode(isSmart);
        this._spawnAirBurst(m.x, m.y, m.color);
        return true;
      }
    }
    return false;
  }

  // ---------- Killer satellites + bombers ----------
  _updateSats(dt) {
    const g = this.game;
    const out = [];
    for (const s of g.sats) {
      s.x += s.vx * dt;
      s.dropT -= dt;
      // Drop a vertical ICBM
      if (s.dropT <= 0 && s.x > 20 && s.x < WORLD_W - 20) {
        s.dropT = KILLER.satDropEvery;
        const tgt = this._pickGroundTarget();
        const dx = tgt.x - s.x, dy = tgt.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = g.diff.icbmSpeed;
        g.icbms.push({
          id: nextId(),
          kind: 'icbm',
          x: s.x, y: s.y,
          vx: (dx / len) * sp,
          vy: (dy / len) * sp,
          target: { x: tgt.x, y: tgt.y },
          color: ENEMY_COLOR.icbm,
          trail: [[s.x, s.y]],
          trailT: 0,
          splitAt: null,
          lastEvade: 0,
          born: g.time,
        });
        audio.mirvSplit();
      }
      // Off-screen → cull
      if (s.x < -60 || s.x > WORLD_W + 60) continue;
      // Killable by blast
      if (this._checkBlastsAt(s, SCORE.SAT_HIT)) continue;
      out.push(s);
    }
    g.sats = out;
  }

  _updateBombers(dt) {
    const g = this.game;
    const out = [];
    for (const b of g.bombers) {
      b.x += b.vx * dt;
      b.dropT -= dt;
      if (b.dropT <= 0 && b.dropsRemaining > 0 && b.x > 20 && b.x < WORLD_W - 20) {
        b.dropT = KILLER.bomberDropEvery;
        b.dropsRemaining -= 1;
        const tgt = this._pickGroundTarget();
        const dx = tgt.x - b.x, dy = tgt.y - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = g.diff.icbmSpeed;
        g.icbms.push({
          id: nextId(),
          kind: 'icbm',
          x: b.x, y: b.y,
          vx: (dx / len) * sp,
          vy: (dy / len) * sp,
          target: { x: tgt.x, y: tgt.y },
          color: ENEMY_COLOR.icbm,
          trail: [[b.x, b.y]],
          trailT: 0,
          splitAt: null,
          lastEvade: 0,
          born: g.time,
        });
      }
      if (b.x < -80 || b.x > WORLD_W + 80) continue;
      if (this._checkBlastsAt(b, SCORE.BOMBER_HIT)) continue;
      out.push(b);
    }
    g.bombers = out;
  }

  // Generic blast-collision used for sats/bombers.
  // `entity` needs { x, y } in world coords; awards basePoints * waveMult on kill.
  _checkBlastsAt(entity, basePoints) {
    const g = this.game;
    for (const b of g.blasts) {
      if (b.phase === 'fade') continue;
      const dx = entity.x - b.x, dy = entity.y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) {
        const mult = waveMult(g.wave);
        g.score += basePoints * mult;
        g.hits  += 1;
        b.killCount += 1;
        audio.enemyExplode(true);
        this._spawnAirBurst(entity.x, entity.y, ENEMY_COLOR.sat);
        return true;
      }
    }
    return false;
  }

  // ---------- Counter-missile flight ----------
  _fire(tx, ty, hint) {
    const g = this.game;
    if (g.outcome !== null || g.betweenWaves) return;
    // Don't allow firing at the ground or below
    if (ty > GROUND_Y - 8) ty = GROUND_Y - 8;

    // Pick battery
    let bat = null;
    if (hint !== null && g.batteries[hint] && g.batteries[hint].alive && g.batteries[hint].ammo > 0) {
      bat = g.batteries[hint];
    } else {
      // Choose nearest alive battery with ammo
      let bestD = Infinity;
      for (const b of g.batteries) {
        if (!b.alive || b.ammo <= 0) continue;
        const d = Math.abs(b.x - tx);
        if (d < bestD) { bestD = d; bat = b; }
      }
    }
    if (!bat) {
      audio.klaxon();
      return;
    }

    // Spawn counter-missile from battery turret tip
    const ox = bat.x, oy = bat.y - 22;     // turret height above ground
    const dx = tx - ox, dy = ty - oy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;                   // ignore zero-length shots — costs no ammo

    bat.ammo -= 1;
    g.fired += 1;
    g.counters.push({
      id: nextId(),
      x: ox, y: oy,
      ox, oy,
      tx, ty,
      vx: (dx / dist) * COUNTER.speed,
      vy: (dy / dist) * COUNTER.speed,
      dist,
      traveled: 0,
      from: bat.id,
    });
    audio.launch();

    // Low-ammo chirp once per wave
    const totalAmmo = g.batteries.reduce((a, b) => a + (b.alive ? b.ammo : 0), 0);
    if (!g.lowAmmoWarned && totalAmmo > 0 && totalAmmo <= 4) {
      g.lowAmmoWarned = true;
      audio.klaxon();
      this._queueComm(this._pick(COMMS.lowAmmo));
    }
  }

  _updateCounters(dt) {
    const g = this.game;
    const out = [];
    for (const c of g.counters) {
      const stepX = c.vx * dt;
      const stepY = c.vy * dt;
      c.x += stepX;
      c.y += stepY;
      c.traveled += Math.hypot(stepX, stepY);
      if (c.traveled >= c.dist) {
        // Arrival → spawn blast at intended target
        this._spawnBlast(c.tx, c.ty);
        audio.friendlyExplode();
      } else {
        out.push(c);
      }
    }
    g.counters = out;
  }

  // ---------- Blasts ----------
  _spawnBlast(x, y) {
    const g = this.game;
    g.blasts.push({
      x, y,
      r:  0,
      maxR: g.diff.blastMaxR,
      t:   0,
      phase: 'grow',
      killCount: 0,
    });
  }

  _updateBlasts(dt) {
    const g = this.game;
    const out = [];
    for (const b of g.blasts) {
      b.t += dt;
      if (b.phase === 'grow') {
        const f = Math.min(1, b.t / BLAST.growTime);
        b.r = b.maxR * f;
        if (f >= 1) { b.phase = 'hold'; b.t = 0; }
      } else if (b.phase === 'hold') {
        b.r = b.maxR;
        if (b.t >= BLAST.holdTime) { b.phase = 'fade'; b.t = 0; }
      } else { // fade
        const f = Math.min(1, b.t / BLAST.fadeTime);
        b.r = b.maxR * (1 - f);
        if (f >= 1) continue;       // drop
      }
      out.push(b);
    }
    g.blasts = out;
  }

  // ---------- Particles ----------
  _spawnAirBurst(x, y, col) {
    const g = this.game;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      g.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.45,
        len: 5 + Math.random() * 8,
        color: col,
      });
    }
  }
  _spawnGroundBurst(x, y, col) {
    const g = this.game;
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const sp = 50 + Math.random() * 130;
      g.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.6,
        len: 6 + Math.random() * 10,
        color: col,
      });
    }
  }
  _updateParticles(dt) {
    const g = this.game;
    const out = [];
    for (const p of g.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;        // gravity
      p.life -= dt;
      if (p.life > 0) out.push(p);
    }
    g.particles = out;
  }

  // ---------- Wave clear / next wave ----------
  _waveClear() {
    const g = this.game;
    g.wavesCleared += 1;
    const survivors = g.cities.filter(c => c.alive).length;
    const ammoLeft  = g.batteries.reduce((a, b) => a + (b.alive ? b.ammo : 0), 0);
    const cityBonus = SCORE.CITY_END_BONUS * g.wave * survivors;
    const ammoBonus = SCORE.AMMO_END_BONUS * g.wave * ammoLeft;
    const total = cityBonus + ammoBonus;
    g.score += total;
    audio.waveClear();
    bus.emit('bonus-toast', {
      wave: g.wave,
      mult: waveMult(g.wave),
      cityBonus, ammoBonus, total,
      y: 200,
    });
    this._queueComm(this._pick(COMMS.waveClear));

    g.betweenWaves = true;
    g.betweenT = 3.0;
  }

  _beginNextWave() {
    const g = this.game;
    g.wave += 1;
    g.mult = waveMult(g.wave);
    g.spawnedThisWave = 0;
    g.spawnQuota = waveCount(g.wave);
    g.spawnInterval = waveDuration(g.wave) / g.spawnQuota;
    g.spawnTimer = 0;
    g.betweenWaves = false;
    g.lowAmmoWarned = false;
    g.palette = WAVE_PALETTE[(g.wave - 1) % WAVE_PALETTE.length];
    // Redeem any banked bonus-city credits before next wave
    this._redeemCityCredits();
    // Reload + revive batteries
    for (const b of g.batteries) {
      b.alive = true;
      b.ammo  = g.diff.ammoPerBat;
    }
    bus.emit('phase', {
      num:  g.wave,
      name: `Wave ${String(g.wave).padStart(2, '0')}`,
      sub:  `Multiplier ×${g.mult}`,
    });
    if (g.wave >= g.diff.mirvStartWave) {
      this._queueComm(this._pick(COMMS.mirv));
    } else if (g.wave >= g.diff.smartStartWave) {
      this._queueComm(this._pick(COMMS.smart));
    } else {
      this._queueComm(this._pick(COMMS.inbound));
    }
  }

  _finish(outcome) {
    const g = this.game;
    if (!g || g.outcome) return;
    g.outcome = outcome;
    this.input.setEnabled(false);
    audio.stopDrone();
    if (outcome === 'gameover') {
      audio.defeat();
      this._queueComm(this._pick(COMMS.gameOver));
    } else {
      audio.waveClear();
    }

    // Career update
    const survivors = g.cities.filter(c => c.alive).length;
    state.career.shifts        += 1;
    state.career.wavesCleared  += g.wavesCleared;
    state.career.citiesSaved   += survivors;
    state.career.missilesFired += g.fired;
    state.career.hits          += g.hits;
    state.career.bestScore = Math.max(state.career.bestScore, g.score);
    state.career.bestWave  = Math.max(state.career.bestWave, g.wave);
    state.lastSortie = {
      outcome,
      score: g.score,
      wavesCleared: g.wavesCleared,
      citiesRemaining: survivors,
      missilesFired: g.fired,
      hits: g.hits,
      time: g.time,
      message: outcome === 'gameover'
        ? 'All silos cold. The coast burns.'
        : 'You stood your watch.',
      rank: RANK(g.score),
    };
    this.running = false;
    bus.emit('mission-end', state.lastSortie);
  }

  // ---------- Restart current wave ----------
  restartWave() {
    const g = this.game;
    if (!g || g.outcome) return;
    g.icbms.length = 0;
    g.counters.length = 0;
    g.blasts.length = 0;
    g.particles.length = 0;
    g.sats.length = 0;
    g.bombers.length = 0;
    g.spawnedThisWave = 0;
    g.spawnTimer = 0;
    g.lowAmmoWarned = false;
    g.betweenWaves = false;
    g.betweenT = 0;
    // Reload + revive batteries (fresh start)
    for (const b of g.batteries) {
      b.alive = true;
      b.ammo  = g.diff.ammoPerBat;
    }
    // Note: cities are NOT revived — restart compensates only for ammo/timing,
    // not for civilian losses. Bonus credits stay banked.
    bus.emit('phase', {
      num:  g.wave,
      name: `Wave ${String(g.wave).padStart(2, '0')}`,
      sub:  'Restart',
    });
    audio.waveClear();
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
    bus.emit('hud', {
      wave:  g.wave,
      cities: g.cities.filter(c => c.alive).length,
      batteryAmmo:  g.batteries.map(b => b.alive ? b.ammo : 0),
      batteryAlive: g.batteries.map(b => b.alive),
      ammoMax: g.ammoMax,
      score: g.score,
      high:  Math.max(g.high, g.score),
      mult:  waveMult(g.wave),
      time:  g.time,
      lowAmmo: g.batteries.reduce((a, b) => a + (b.alive ? b.ammo : 0), 0) <= 4,
    });
  }

  // ---------- Render delegate ----------
  _render(dt) {
    const g = this.game;
    if (!g || !this.renderer) return;
    const s = state.settings;
    const phos = PHOSPHOR[s.phosphor] || PHOSPHOR.green;
    const proj = makeProj(
      this.stage.clientWidth  || window.innerWidth,
      this.stage.clientHeight || window.innerHeight,
    );
    const bloom = s.bloom ?? 'soft';
    this.renderer.render(buildScene(g, phos, proj), {
      dt,
      // `curve` drives the tube geometry; `crt` stays with the CSS scanlines.
      crt: s.curve ?? true,
      reduceMotion: s.reduceMotion,
      bloomStrength: bloom === 'off' ? 0 : bloom === 'hot' ? 1.4 : 0.85,
    });
  }
}
