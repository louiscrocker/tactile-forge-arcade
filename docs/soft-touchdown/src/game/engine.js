// =====================================================
// Tactile Forge — Lunar Lander · Game engine
// Physics, fuel, collision, multi-site landing loop.
// =====================================================

import { bus, state, persist } from '../state.js';
import * as audio from '../audio/audio.js';
import { Input } from './input.js';
import {
  WORLD_W, WORLD_H, VIEW_H, SPAWN, THRUST_ACCEL, ROT_RATE, FUEL_BURN,
  LANDER, DIFFICULTY, SCORE, RANK, PHOSPHOR, COMMS,
} from './constants.js';
import { generateTerrain, sampleHeight, padAt } from './terrain.js';
import { buildScene, makeProj } from '../render/displaylist.js';
import { createRenderer, resolveMode } from '../render/index.js';

const RAD = Math.PI / 180;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input();
    this.running = false;
    this.paused = false;
    this._loop = this._loop.bind(this);
    this._t0 = 0;
    this._raf = 0;
    this.game = null;

    this.renderer = null;
    this.rendererMode = null;
    this.setRenderer(state.settings.renderer);

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
  }

  /**
   * Swap the drawing back end. A canvas element is bound to its first context
   * type for life, so changing renderers means replacing the element itself.
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

  start({ difficulty = 'pilot' } = {}) {
    this._resize();
    audio.startDrone();
    const diff = DIFFICULTY[difficulty] || DIFFICULTY.pilot;
    this.game = {
      diff,
      site: 1,
      streak: 0,
      bestStreak: 0,
      landings: 0,
      crashes: 0,
      score: 0,
      bestSite: 1,
      totalTime: 0,
      lander: this._spawnLander(),
      fuel: diff.fuelInit,
      fuelInit: diff.fuelInit,
      throttle: 0,
      thrustOn: false,
      terrain: null,
      outcome: null,        // null | 'crash-final' | 'complete'
      siteState: 'flying',  // flying | landed | crashed | nextSite
      siteTimer: 0,
      explosionParts: [],
      dustParts: [],
      flashTimer: 0,
      lowFuelWarned: false,
      hoverCalled: false,
      _commT: 0,
      _phaseBannerNum: 1,
    };
    this.game.terrain = generateTerrain(1, {
      padScale: diff.padScale, terrainAmp: diff.terrainAmp,
    });
    this.running = true;
    this.paused = false;
    // Drop anything buffered while the player was in the menus — otherwise a
    // stray P from the briefing screen starts the mission paused.
    this.input.enable();
    bus.emit('phase', { num: 1, name: 'Site 01', sub: 'Find a level pad' });
    this._queueComm(this._pick(COMMS.approach));
    this._t0 = performance.now();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
    this._emitHud();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.input.disable();
    cancelAnimationFrame(this._raf);
    audio.stopDrone();
    audio.stopThrust();
  }

  setPaused(p) {
    this.paused = p;
    if (p) audio.stopThrust();
    else this._t0 = performance.now();
  }

  // ---------- Core loop ----------
  _loop(now) {
    if (!this.running) return;
    // rAF timestamps are captured at the start of the frame, so `now` can be
    // *earlier* than the performance.now() taken in start(). Without the lower
    // clamp the first frame integrates a negative step and the mission clock
    // starts below zero.
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

  _spawnLander() {
    return {
      x: SPAWN.x,
      y: SPAWN.y,
      vx: SPAWN.vx,
      vy: SPAWN.vy,
      angle: SPAWN.angle,    // radians; 0 = upright (engine pointing down)
    };
  }

  // ---------- Update ----------
  _update(dt) {
    const g = this.game;
    g.totalTime += dt;
    if (g._commT > 0) g._commT -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;

    // Particles decay in every state — landing dust is thrown while the site
    // state is already 'landed', so it can't be tied to one branch below.
    this._updateParticles(dt);

    if (g.siteState === 'flying') {
      this._updateFlight(dt);
    } else if (g.siteState === 'landed') {
      g.siteTimer -= dt;
      if (g.siteTimer <= 0) this._nextSite();
    } else if (g.siteState === 'crashed') {
      g.siteTimer -= dt;
      if (g.siteTimer <= 0) this._finish('crash-final', 'The lander is lost.');
    }

    this._emitHud();
  }

  _updateParticles(dt) {
    const g = this.game;
    const grav = g.diff.gravity;
    for (const p of g.explosionParts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= grav * dt;
      p.life -= dt;
    }
    g.explosionParts = g.explosionParts.filter(p => p.life > 0);

    for (const p of g.dustParts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= grav * dt;
      p.vx *= 1 - Math.min(1, 1.6 * dt);    // dust settles quickly
      p.life -= dt;
    }
    g.dustParts = g.dustParts.filter(p => p.life > 0);
  }

  _updateFlight(dt) {
    const g = this.game;
    const lander = g.lander;
    const intent = this.input.read();

    // ----- Rotation -----
    if (intent.rotate !== 0) {
      lander.angle += intent.rotate * ROT_RATE * dt;
    }

    // ----- Throttle / fuel -----
    let throttle = (intent.thrust && g.fuel > 0) ? 1 : 0;
    if (throttle > 0) {
      g.fuel -= FUEL_BURN * throttle * dt;
      if (g.fuel < 0) { g.fuel = 0; throttle = 0; }
    }
    g.throttle = throttle;
    g.thrustOn = throttle > 0;
    audio.setThrust(throttle);

    // Low-fuel warning chirp (one-shot, then suppress for the site)
    if (!g.lowFuelWarned && g.fuel > 0 && g.fuel < g.fuelInit * 0.15) {
      g.lowFuelWarned = true;
      audio.lowFuelChirp();
      this._queueComm(this._pick(COMMS.lowFuel));
    }

    // ----- Forces -----
    const ax = Math.sin(lander.angle) * THRUST_ACCEL * throttle;
    const ay = Math.cos(lander.angle) * THRUST_ACCEL * throttle - g.diff.gravity;
    lander.vx += ax * dt;
    lander.vy += ay * dt;
    lander.x  += lander.vx * dt;
    lander.y  += lander.vy * dt;

    // Horizontal wrap
    if (lander.x < 0)        lander.x += WORLD_W;
    if (lander.x >= WORLD_W) lander.x -= WORLD_W;

    // Cap altitude at the ceiling, which sits just inside the visible span so
    // the lander can never be thrusted off the top of the screen.
    if (lander.y > WORLD_H) {
      lander.y = WORLD_H;
      if (lander.vy > 0) lander.vy = 0;
    }

    // One-shot hover chatter as the descent closes on the surface.
    if (!g.hoverCalled && this._altitude() < 140) {
      g.hoverCalled = true;
      this._queueComm(this._pick(COMMS.hover));
    }

    // ----- Collision with terrain -----
    // Footpad y is hull base minus legDrop (foot below base).
    // Hull base in world-y (when angle=0) = lander.y - bodyH/2.
    // Approximate the lander footprint as a horizontal line at the foot height
    // spanning legSpan, rotated by angle. Sample terrain across the span.
    const halfSpan = LANDER.legSpan / 2;
    const footYLocal = -(LANDER.bodyH / 2 + LANDER.legDrop);
    // Foot endpoints in world space (clockwise rotation matches scene.js)
    const cosA = Math.cos(lander.angle), sinA = Math.sin(lander.angle);
    const fL = {
      x: lander.x + (-halfSpan) * cosA + footYLocal * sinA,
      y: lander.y - (-halfSpan) * sinA + footYLocal * cosA,
    };
    const fR = {
      x: lander.x +  halfSpan   * cosA + footYLocal * sinA,
      y: lander.y -  halfSpan   * sinA + footYLocal * cosA,
    };
    // Sample terrain at each foot
    const groundL = sampleHeight(g.terrain, fL.x);
    const groundR = sampleHeight(g.terrain, fR.x);
    const lowestFootY = Math.min(fL.y, fR.y);
    const groundUnderLowest = (fL.y <= fR.y) ? groundL : groundR;
    const xUnderLowest = (fL.y <= fR.y) ? fL.x : fR.x;

    if (lowestFootY <= groundUnderLowest + 0.15) {
      this._handleContact(xUnderLowest, groundUnderLowest);
    }
  }

  _handleContact(contactX, contactY) {
    const g = this.game;
    const lander = g.lander;
    const tilt = Math.abs(this._normalizeAngle(lander.angle));
    const safeV = Math.abs(lander.vy) < g.diff.vMax;
    const safeH = Math.abs(lander.vx) < g.diff.hMax;
    const safeTilt = tilt < g.diff.tiltMax;
    const pad = padAt(g.terrain, lander.x);
    const onPad = !!pad;
    // Need a flat pad to count as a successful landing — touching mountain side
    // but technically slow/upright is still a crash (not a controlled set-down).
    if (safeV && safeH && safeTilt && onPad) {
      this._landed(pad, contactX, contactY);
    } else {
      this._crashed(contactX, contactY);
    }
  }

  _landed(pad, cx, cy) {
    const g = this.game;
    const lander = g.lander;
    // Snap lander to rest pose on the pad
    lander.angle = 0;
    lander.vx = 0;
    lander.vy = 0;
    lander.y = pad.y + LANDER.bodyH / 2 + LANDER.legDrop;
    g.throttle = 0; g.thrustOn = false;
    audio.stopThrust();
    audio.thud();
    audio.landed(pad.mult);

    const fuelBonus = Math.round(g.fuel * SCORE.FUEL_BONUS);
    const baseScore = SCORE.LAND_BASE * pad.mult;
    g.streak += 1;
    g.landings += 1;
    // Track the high-water mark as we go: the sortie always ends in a crash,
    // and that reset g.streak to 0 before the debrief could ever read it.
    g.bestStreak = Math.max(g.bestStreak, g.streak);
    const streakBonus = SCORE.STREAK_BONUS * (g.streak - 1);
    const total = baseScore + fuelBonus + streakBonus;
    g.score += total;
    g.bestSite = Math.max(g.bestSite, g.site);

    // Burst little dust at the foot points
    this._spawnDust(cx, cy, 12);

    bus.emit('landing-toast', {
      x: this._worldToScreenX(lander.x),
      y: this._worldToScreenY(pad.y) - 60,
      mult: pad.mult,
      base: baseScore,
      fuelBonus,
      streakBonus,
      total,
    });
    this._queueComm(this._pick(COMMS.landed));

    g.siteState = 'landed';
    g.siteTimer = 2.6;
  }

  _crashed(cx, cy) {
    const g = this.game;
    audio.stopThrust();
    audio.explosion(true);
    g.streak = 0;
    g.crashes += 1;
    this._spawnExplosion(cx, cy);
    g.flashTimer = 0.4;
    bus.emit('hit');
    this._queueComm(this._pick(COMMS.crash));
    g.siteState = 'crashed';
    g.siteTimer = 1.8;
  }

  _nextSite() {
    const g = this.game;
    g.site += 1;
    g._phaseBannerNum = g.site;
    g.terrain = generateTerrain(g.site, {
      padScale: g.diff.padScale, terrainAmp: g.diff.terrainAmp,
    });
    g.lander = this._spawnLander();
    // Slight horizontal randomization in spawn to keep things fresh
    g.lander.x = 100 + Math.random() * 360;
    g.lander.vx = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 14);
    g.fuel = g.diff.fuelInit;
    g.lowFuelWarned = false;
    g.hoverCalled = false;
    g.siteState = 'flying';
    g.dustParts = [];
    g.explosionParts = [];
    bus.emit('phase', {
      num: g.site,
      name: `Site ${String(g.site).padStart(2, '0')}`,
      sub: g.streak >= 1 ? `Streak ×${g.streak}` : 'Find a level pad',
    });
    this._queueComm(this._pick(COMMS.approach));
  }

  _finish(outcome, msg) {
    const g = this.game;
    if (g.outcome) return;
    g.outcome = outcome;
    audio.stopThrust();
    audio.stopDrone();
    audio.defeat();
    state.career.sorties  += 1;
    state.career.landings += g.landings;
    state.career.crashes  += g.crashes;
    state.career.bestScore = Math.max(state.career.bestScore, g.score);
    state.career.bestStreak = Math.max(state.career.bestStreak, g.bestStreak);
    state.lastSortie = {
      outcome,
      score: g.score,
      landings: g.landings,
      crashes: g.crashes,
      bestStreak: g.bestStreak,
      time: g.totalTime,
      bestSite: g.bestSite,
      message: msg ?? null,
      rank: RANK(g.score),
    };
    persist();
    this.running = false;
    this.input.disable();
    bus.emit('mission-end', state.lastSortie);
  }

  // ---------- Particles ----------
  _spawnExplosion(x, y) {
    const g = this.game;
    for (let i = 0; i < 38; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 8 + Math.random() * 36;
      g.explosionParts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + 14,    // bias upward
        life: 0.6 + Math.random() * 0.9,
        len: 4 + Math.random() * 10,
      });
    }
  }
  _spawnDust(x, y, n) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * Math.PI * 0.4 + Math.PI;
      const sp = 4 + Math.random() * 10;
      g.dustParts.push({
        x, y,
        vx: Math.cos(a) * sp + (Math.random() - 0.5) * 8,
        vy: Math.abs(Math.sin(a) * sp) + 6,
        life: 0.5 + Math.random() * 0.5,
      });
    }
  }

  // ---------- Helpers ----------
  /** Height of the footpads above the surface directly below them, in metres. */
  _altitude() {
    const g = this.game;
    const ground = sampleHeight(g.terrain, g.lander.x);
    return g.lander.y - (LANDER.bodyH / 2 + LANDER.legDrop) - ground;
  }

  _normalizeAngle(a) {
    // Return signed angle in [-π, π]
    let x = a % (Math.PI * 2);
    if (x > Math.PI)  x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  _worldToScreenX(x) {
    const w = this.canvas.clientWidth;
    return (x / WORLD_W) * w;
  }
  _worldToScreenY(y) {
    const h = this.canvas.clientHeight;
    // Map y in [0, WORLD_H_VIS] to screen
    const visH = this._visibleWorldH();
    return h - (y / visH) * h;
  }
  _visibleWorldH() {
    // Vertical world span the camera shows: the lander spawns near the top and
    // the tallest mountains live in the lower third.
    return VIEW_H;
  }

  _pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  _queueComm(text) {
    if (!text) return;
    this.game._commT = 3.5;
    bus.emit('comm', text);
  }

  _emitHud() {
    const g = this.game;
    if (!g) return;
    bus.emit('hud', {
      fuel:   Math.max(0, g.fuel),
      fuelMax: g.fuelInit,
      alt:    Math.max(0, Math.round(this._altitude())),
      hvel:   g.lander.vx,
      vvel:   g.lander.vy,
      score:  g.score,
      site:   g.site,
      lands:  g.landings,
      time:   g.totalTime,
      // Tinting hints for the HUD
      vSafe:  Math.abs(g.lander.vy) < g.diff.vMax,
      hSafe:  Math.abs(g.lander.vx) < g.diff.hMax,
      lowFuel: g.fuel < g.fuelInit * 0.15,
    });
  }

  // ---------- Render delegate ----------
  _render(dt) {
    const g = this.game;
    if (!g || !this.renderer) return;
    const phos = PHOSPHOR[state.settings.phosphor] || PHOSPHOR.green;
    const proj = makeProj(
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      this._visibleWorldH(),
    );
    this.renderer.render(buildScene(g, phos, proj), {
      dt,
      crt: state.settings.crt,
      reduceMotion: state.settings.reduceMotion,
    });
  }
}
