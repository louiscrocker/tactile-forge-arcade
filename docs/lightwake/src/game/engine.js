// =====================================================
// Tactile Forge — TRON · Game engine
// Tick-based light-cycle simulation on a 2D occupancy grid.
// One head per cycle; each tick the head moves one cell in its
// current direction and stamps a wall behind it. Crash = derez.
// =====================================================

import { bus, state, persist } from '../state.js';
import * as audio from '../audio/audio.js';
import { Input } from './input.js';
import { drawScene } from '../render/scene.js';
import { PostFX } from '../render/postfx.js';
import {
  GRID_W, GRID_H,
  BASE_TICKS_PER_SEC, TICKS_PER_ROUND_BUMP,
  BOOST, LIVES_START, foesForRound, SPAWN_SLOTS,
  DIFFICULTY, SCORE, RANK, PHOSPHOR, FOE_COLORS, COMMS,
} from './constants.js';

// Direction vectors: 0=right, 1=down, 2=left, 3=up
export const DIR_VEC = [
  [+1, 0],
  [ 0, +1],
  [-1, 0],
  [ 0, -1],
];

let _idGen = 0;
const nextId = () => ++_idGen;

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
    // not arrive as a pause or a queued turn on frame one.
    this.input.reset();
    this.input.enabled = true;
    audio.startDrone();
    const diff = DIFFICULTY[difficulty] || DIFFICULTY.defender;

    this.game = {
      diff,
      round: 1,
      score: 0,
      high: state.career.bestScore,
      time: 0,
      outcome: null,                   // null | 'gameover' | 'manual'
      lives: Math.max(1, LIVES_START + (diff.livesBonus || 0)),
      cycles: [],
      occ: new Uint8Array(GRID_W * GRID_H),
      tickAccum: 0,
      tickRate: BASE_TICKS_PER_SEC,
      lastTickFrac: 0,
      // Boost
      boostFuel: BOOST.max,
      boostActive: false,
      _boostWasActive: false,
      // Round transition
      roundEnd: null,                  // null | { result: 'win' | 'death', t: 0 }
      // Stats
      derezzes: 0,
      foesThisRound: 0,
      foesDerezzedThisRound: 0,
      longestRound: 0,
      roundStartTime: 0,
      roundsCleared: 0,
      _lastFoeAnnounced: false,
      _commT: 0,
      flashTimer: 0,
    };

    this._setupRound();
    this.running = true;
    this.paused = false;
    bus.emit('phase', { num: 1, name: 'Round 01', sub: 'Gates opening' });
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
    audio.stopHum();
  }

  setPaused(p) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) {
      // Cut the loops and drop keys held at the moment of pausing, or the cycle
      // banks that input through the veil and lurches on resume.
      audio.stopDrone();
      audio.stopHum();
      this.input.reset();
    } else {
      this._t0 = performance.now();
      audio.startDrone();
    }
  }

  // ---------- Round setup ----------
  _setupRound() {
    const g = this.game;
    g.occ.fill(0);
    g.cycles.length = 0;
    g.tickAccum = 0;
    g.lastTickFrac = 0;
    g.boostFuel = BOOST.max;
    g.boostActive = false;
    g._boostWasActive = false;
    g.roundEnd = null;
    g.flashTimer = 0;
    g.foesThisRound = foesForRound(g.round);
    g.foesDerezzedThisRound = 0;
    g.roundStartTime = g.time;
    g._lastFoeAnnounced = false;

    // Player
    const ps = SPAWN_SLOTS[0];
    const playerCol = PHOSPHOR[state.settings.phosphor] || PHOSPHOR.cyan;
    g.cycles.push(this._mkCycle({
      id: 'player', isPlayer: true, color: playerCol,
      col: ps.col, row: ps.row, dir: ps.dir, name: state.pilot,
    }));
    // AI foes
    for (let i = 0; i < g.foesThisRound; i++) {
      const slot = SPAWN_SLOTS[i + 1];
      const col = FOE_COLORS[i % FOE_COLORS.length];
      g.cycles.push(this._mkCycle({
        id: `foe-${i}`, isPlayer: false, color: col,
        col: slot.col, row: slot.row, dir: slot.dir, name: col.name,
      }));
    }
    // Mark spawn cells in occ grid
    for (const c of g.cycles) {
      g.occ[c.row * GRID_W + c.col] = 1;
    }
    g.tickRate = this._computeTickRate();
    audio.startHum();
  }

  _mkCycle({ id, isPlayer, color, col, row, dir, name }) {
    return {
      uid: nextId(),
      id, isPlayer, color, name,
      col, row, prevCol: col, prevRow: row,
      dir, prevDir: dir,
      alive: true,
      trail: [[col, row]],
      derezzedAt: null,
      derezzedAtTime: null,
    };
  }

  _computeTickRate() {
    const g = this.game;
    const base = BASE_TICKS_PER_SEC + (g.round - 1) * TICKS_PER_ROUND_BUMP;
    return base * g.diff.tickMult * (g.boostActive ? BOOST.speedMult : 1);
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

    // Boost fuel + audio bend
    const wantBoost = this.input.boostHeld && g.boostFuel > 0 && !g.roundEnd;
    g.boostActive = wantBoost;
    if (wantBoost) g.boostFuel = Math.max(0, g.boostFuel - BOOST.burnRate * dt);
    else g.boostFuel = Math.min(BOOST.max, g.boostFuel + BOOST.refillRate * dt);
    if (g.boostActive !== g._boostWasActive) {
      audio.setHumBoost(g.boostActive);
      if (g.boostActive) audio.boost();
      g._boostWasActive = g.boostActive;
    }

    g.tickRate = this._computeTickRate();

    // Round transition delay
    if (g.roundEnd) {
      g.roundEnd.t += dt;
      if (g.roundEnd.t >= 2.5) {
        if (g.roundEnd.result === 'death') {
          g.lives -= 1;
          if (g.lives <= 0) {
            this._finish('gameover');
          } else {
            this._setupRound();
            bus.emit('phase', {
              num: g.round, name: `Round ${String(g.round).padStart(2, '0')}`,
              sub: 'Replay — life lost',
            });
          }
        } else if (g.roundEnd.result === 'win') {
          const elapsed = g.time - g.roundStartTime;
          g.longestRound = Math.max(g.longestRound, elapsed);
          g.roundsCleared += 1;
          g.round += 1;
          this._setupRound();
          bus.emit('phase', {
            num: g.round, name: `Round ${String(g.round).padStart(2, '0')}`,
            sub: `${g.foesThisRound} rider${g.foesThisRound === 1 ? '' : 's'} deployed`,
          });
          this._queueComm(this._pick(COMMS.roundStart));
        }
      }
      this._emitHud();
      return;
    }

    // Tick the simulation
    g.tickAccum += dt;
    const tickPeriod = 1 / g.tickRate;
    let safety = 16;          // never run more than 16 catch-up ticks
    while (g.tickAccum >= tickPeriod && !g.roundEnd && safety-- > 0) {
      g.tickAccum -= tickPeriod;
      this._stepTick();
    }
    g.lastTickFrac = Math.max(0, Math.min(1, g.tickAccum / tickPeriod));

    this._emitHud();
  }

  _stepTick() {
    const g = this.game;

    // 1) Decide directions
    for (const c of g.cycles) {
      if (!c.alive) continue;
      c.prevDir = c.dir;
      if (c.isPlayer) {
        // Drain queued turns until we find a valid (non-180°) one.
        while (true) {
          const t = this.input.consumeTurn();
          if (t < 0) break;
          if (t === c.dir) continue;                  // already going that way
          if ((t + 2) % 4 === c.dir) continue;        // 180° forbidden
          c.dir = t;
          audio.turn();
          break;
        }
      } else {
        c.dir = this._aiDecide(c);
      }
    }

    // 2) Compute next cells
    const nextCells = new Map();    // uid → [col, row]
    for (const c of g.cycles) {
      if (!c.alive) continue;
      const [dc, dr] = DIR_VEC[c.dir];
      nextCells.set(c.uid, [c.col + dc, c.row + dr]);
    }

    // 3) Detect collisions
    const toKill = new Set();
    for (const [uid, [nc, nr]] of nextCells) {
      if (nc < 0 || nc >= GRID_W || nr < 0 || nr >= GRID_H) {
        toKill.add(uid);
        continue;
      }
      if (g.occ[nr * GRID_W + nc] === 1) {
        toKill.add(uid);
      }
    }
    // Two cycles entering the same empty cell on the same tick → both crash
    const cellOwners = new Map();
    for (const [uid, [nc, nr]] of nextCells) {
      if (nc < 0 || nc >= GRID_W || nr < 0 || nr >= GRID_H) continue;
      const k = nr * GRID_W + nc;
      if (cellOwners.has(k)) {
        toKill.add(uid);
        toKill.add(cellOwners.get(k));
      } else {
        cellOwners.set(k, uid);
      }
    }

    // 4) Resolve: derez or move
    for (const c of g.cycles) {
      if (!c.alive) continue;
      const next = nextCells.get(c.uid);
      c.prevCol = c.col;
      c.prevRow = c.row;
      if (toKill.has(c.uid)) {
        c.alive = false;
        c.derezzedAt = [c.col, c.row];
        c.derezzedAtTime = g.time;
        this._onDerez(c);
      } else {
        c.col = next[0];
        c.row = next[1];
        g.occ[c.row * GRID_W + c.col] = 1;
        c.trail.push([c.col, c.row]);
      }
    }

    // 5) Round-end check
    const playerAlive = g.cycles[0].alive;
    const aliveFoeCount = g.cycles.reduce((a, c, i) => a + (i > 0 && c.alive ? 1 : 0), 0);

    if (!playerAlive) {
      g.roundEnd = { result: 'death', t: 0 };
      audio.stopHum();
      audio.defeat();
      this._queueComm(this._pick(COMMS.death));
    } else if (aliveFoeCount === 0) {
      const bonus = SCORE.ROUND_CLEAR + g.foesThisRound * SCORE.ROUND_PER_FOE;
      g.score += bonus;
      g.roundEnd = { result: 'win', t: 0 };
      audio.stopHum();
      audio.victory();
      bus.emit('round-toast', {
        round: g.round,
        foes: g.foesThisRound,
        derez: g.foesDerezzedThisRound,
        bonus,
        y: 220,
      });
      this._queueComm(this._pick(COMMS.roundClear));
    } else {
      // Survival drip — tiny, per tick
      g.score += SCORE.SURVIVAL_PER_S * (1 / g.tickRate);
      if (aliveFoeCount === 1 && g.foesThisRound > 1 && !g._lastFoeAnnounced) {
        g._lastFoeAnnounced = true;
        this._queueComm(this._pick(COMMS.lastFoe));
      }
    }
  }

  _onDerez(c) {
    const g = this.game;
    if (c.isPlayer) {
      audio.derez(true);
      g.flashTimer = 0.5;
      bus.emit('hit');
    } else {
      audio.derez(false);
      g.derezzes += 1;
      g.foesDerezzedThisRound += 1;
      const remaining = g.cycles.reduce((a, x, i) => a + (i > 0 && x.alive ? 1 : 0), 0);
      const isLast = remaining === 0;
      const points = SCORE.DEREZ * g.round + (isLast ? SCORE.LAST_STAND : 0);
      g.score += points;
      bus.emit('derez-pop', {
        col: c.col, row: c.row, points, color: c.color, name: c.name, isLast,
      });
      this._queueComm(this._pick(COMMS.derez));
    }
  }

  // ---------- AI ----------
  _aiDecide(c) {
    const diff = this.game.diff;
    // Candidate directions: forward, left, right (NOT back).
    const forward = c.dir;
    const left    = (c.dir + 3) % 4;
    const right   = (c.dir + 1) % 4;
    const cands = [forward, left, right];
    let bestScore = -Infinity;
    let bestDir = forward;
    for (const d of cands) {
      const free = this._evalDir(c, d, diff.aiDepth);
      // Forward bias keeps cycles from oscillating in tight quarters.
      const fwdBias = (d === forward) ? 0.6 : 0;
      // Random noise, scaled by aiNoise * aiDepth.
      const noise = (Math.random() - 0.5) * 2 * diff.aiDepth * diff.aiNoise;
      const total = free + fwdBias + noise;
      if (total > bestScore) { bestScore = total; bestDir = d; }
    }
    // Fallback: if forward is fatal (free=0), prefer ANY direction with free > 0.
    if (this._evalDir(c, bestDir, 1) === 0) {
      for (const d of cands) {
        if (this._evalDir(c, d, 1) > 0) { bestDir = d; break; }
      }
    }
    return bestDir;
  }

  /** How many cells `c` can travel in direction `dir` before hitting wall/edge. */
  _evalDir(c, dir, maxDepth) {
    const g = this.game;
    const [dc, dr] = DIR_VEC[dir];
    let nc = c.col, nr = c.row;
    for (let i = 1; i <= maxDepth; i++) {
      nc += dc; nr += dr;
      if (nc < 0 || nc >= GRID_W || nr < 0 || nr >= GRID_H) return i - 1;
      if (g.occ[nr * GRID_W + nc] === 1) return i - 1;
    }
    return maxDepth;
  }

  // ---------- Round restart ----------
  restartRound() {
    const g = this.game;
    if (!g || g.outcome) return;
    this._setupRound();
    bus.emit('phase', {
      num:  g.round,
      name: `Round ${String(g.round).padStart(2, '0')}`,
      sub:  'Restart',
    });
  }

  // ---------- Finish ----------
  _finish(outcome) {
    const g = this.game;
    if (g.outcome) return;
    g.outcome = outcome;
    audio.stopDrone();
    audio.stopHum();
    if (outcome === 'gameover') {
      audio.defeat();
      this._queueComm(this._pick(COMMS.gameOver));
    }

    // Career update
    state.career.runs          += 1;
    state.career.roundsCleared += g.roundsCleared;
    state.career.derezzes      += g.derezzes;
    state.career.deaths        += Math.max(0, LIVES_START - g.lives + (outcome === 'gameover' ? 0 : 0));
    state.career.longestRound  = Math.max(state.career.longestRound, g.longestRound);
    state.career.bestScore     = Math.max(state.career.bestScore, g.score);
    state.career.bestRound     = Math.max(state.career.bestRound, g.round);

    state.lastSortie = {
      outcome,
      score: Math.floor(g.score),
      roundsCleared: g.roundsCleared,
      reachedRound: g.round,
      derezzes: g.derezzes,
      longestRound: g.longestRound,
      time: g.time,
      message: outcome === 'gameover'
        ? 'The arena keeps your bike.'
        : 'You ride out of the arena.',
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
    const aliveFoeCount = g.cycles.reduce((a, c, i) => a + (i > 0 && c.alive ? 1 : 0), 0);
    bus.emit('hud', {
      round: g.round,
      lives: g.lives,
      foes:  aliveFoeCount,
      foesThisRound: g.foesThisRound,
      score: Math.floor(g.score),
      high:  Math.max(g.high, Math.floor(g.score)),
      mult:  g.round,
      time:  g.time,
      speed: Math.round(g.tickRate),
      boostFuel: g.boostFuel,
      boostMax:  BOOST.max,
      boostActive: g.boostActive,
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
      const curveOn = s.curve ?? true;
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
