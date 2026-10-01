// =====================================================
// Tactile Forge — Missile Attack · Animated title intro
// 3.8s cold-open: scope sweep → blips → ICBM arcs →
// blast bloom → resolve to LAST/SILO wordmark.
// Pure canvas2D using the existing vector beam primitives.
// =====================================================

import { beamLine, beamPath, beamCircle, beamDot, beamText } from '../render/vector.js';
import * as audio from '../audio/audio.js';
import { state } from '../state.js';
import { PHOSPHOR } from '../game/constants.js';

const DURATION = 3.8;     // total seconds
let _running = null;      // active intro instance, if any

/** Intro colours for the chosen phosphor. The inbound arcs keep their own. */
function introPalette() {
  const p = PHOSPHOR[state.settings.phosphor] || PHOSPHOR.green;
  const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;
  return {
    line: p.line,
    mid:  p.mid,
    hot:  p.hot,
    glow: rgba(rgb(p.glow), 0.35),
    // The scope backdrop is the line colour at about a seventh of its brightness.
    scope: rgba(rgb(p.line).map(c => Math.round(c * 0.14)), 0.55),
  };
}

export function playIntro({ onDone } = {}) {
  // Two intros share one canvas and one title stack: the older one's cleanup
  // would hide the canvas out from under the newer one. Let the running intro
  // finish rather than starting a second.
  if (_running) return;

  const canvas = document.getElementById('intro-canvas');
  const stack  = document.querySelector('.title-stack');
  if (!canvas || !stack) { onDone?.(); return; }

  const ctx = canvas.getContext('2d');
  const pal = introPalette();
  let rafId = 0;
  let t0 = performance.now();
  let skipped = false;
  let done = false;

  // Hide static title content during intro
  stack.style.opacity = '0';
  stack.style.transition = 'opacity 0.6s ease-out';
  canvas.style.display = 'block';
  canvas.style.opacity = '1';

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Pre-roll: queue audio cues at scheduled times
  const cues = [
    { t: 0.10, fn: () => audio.klaxon() },
    { t: 1.10, fn: () => audio.launch() },
    { t: 1.45, fn: () => audio.launch() },
    { t: 1.80, fn: () => audio.launch() },
    { t: 2.55, fn: () => audio.friendlyExplode() },
    { t: 2.65, fn: () => audio.enemyExplode(true) },
    { t: 3.20, fn: () => audio.waveClear() },
  ];
  let cueIdx = 0;

  // Audio context may still be locked at intro time (no user gesture yet).
  // Queue a one-shot catch-up chime to acknowledge the user's first tap.
  if (!audio.isUnlocked()) {
    audio.onUnlock(() => {
      try { audio.waveClear(); } catch {}
    });
  }

  // Pre-baked ICBM arc paths so per-frame draw stays cheap
  const W = () => canvas.clientWidth;
  const H = () => canvas.clientHeight;
  const arcs = [
    { x0: 0.10, x1: 0.50, y0: 0.05, y1: 0.55, t0: 1.05, t1: 2.55, color: '#ff5a64', hot: '#ffd4d8' },
    { x0: 0.92, x1: 0.50, y0: 0.05, y1: 0.55, t0: 1.40, t1: 2.55, color: '#ff7a3a', hot: '#ffe2c8' },
    { x0: 0.50, x1: 0.50, y0: 0.05, y1: 0.55, t0: 1.75, t1: 2.55, color: '#ff3a8a', hot: '#ffd1e6' },
  ];

  function frame(now) {
    const t = (now - t0) / 1000;
    if (skipped) { return finish(true); }

    // Fire scheduled audio cues
    while (cueIdx < cues.length && t >= cues[cueIdx].t) {
      try { cues[cueIdx].fn(); } catch {}
      cueIdx += 1;
    }

    const w = W(), h = H();
    ctx.clearRect(0, 0, w, h);

    // ----- Background scope -----
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, pal.scope);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ----- Range rings (always visible) -----
    drawRangeRings(ctx, w/2, h/2, pal);

    // ----- Phase 1: scope sweep (0 .. 1.1) -----
    if (t < 1.1) {
      const sweep = (t / 1.1) * Math.PI * 2 - Math.PI/2;
      drawSweepLine(ctx, w/2, h/2, sweep, pal);
      // Blips at top
      if (t > 0.5) {
        const a = Math.min(1, (t - 0.5) / 0.4);
        for (const arc of arcs) {
          beamDot(ctx, arc.x0 * w, arc.y0 * h, 4, {
            color: arc.color, hot: arc.hot, alpha: a * 0.9,
          });
        }
      }
    }

    // ----- Phase 2: ICBM arcs (1.05 .. 2.55) -----
    for (const arc of arcs) {
      if (t < arc.t0) continue;
      const at = Math.min(1, (t - arc.t0) / (arc.t1 - arc.t0));
      // Quadratic arc: control point pulls outward in y
      const cx = (arc.x0 + arc.x1) / 2;
      const cy = (arc.y0 + arc.y1) / 2 - 0.18;
      const px = bez(arc.x0, cx, arc.x1, at) * w;
      const py = bez(arc.y0, cy, arc.y1, at) * h;
      // Trail: draw a polyline from origin
      const pts = [];
      const STEPS = 18;
      for (let i = 0; i <= STEPS; i++) {
        const ti = (i / STEPS) * at;
        pts.push([
          bez(arc.x0, cx, arc.x1, ti) * w,
          bez(arc.y0, cy, arc.y1, ti) * h,
        ]);
      }
      beamPath(ctx, pts, {
        color: arc.color, hot: arc.hot, width: 2.6, hotWidth: 1.0, alpha: 0.95,
      });
      // Hot tip
      beamDot(ctx, px, py, 3.6, { color: arc.hot, hot: '#ffffff' });
    }

    // ----- Phase 3: blast bloom at center (2.5 .. 3.2) -----
    if (t >= 2.5 && t < 3.3) {
      const bt = (t - 2.5) / 0.8;
      const r = ease(bt) * Math.min(w, h) * 0.22;
      const fade = bt < 0.5 ? 1 : 1 - (bt - 0.5) / 0.5;
      // Filled gradient core
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, r);
      g2.addColorStop(0, pal.hot);
      g2.addColorStop(0.5, pal.glow);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(w/2, h/2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Outline ring
      beamCircle(ctx, w/2, h/2, r, {
        color: pal.hot, hot: '#ffffff', width: 3.0, hotWidth: 1.2, alpha: fade * 0.95,
      });
      // Shockwave secondary ring
      const r2 = ease(Math.min(1, bt * 1.4)) * Math.min(w, h) * 0.35;
      beamCircle(ctx, w/2, h/2, r2, {
        color: pal.mid, hot: pal.hot, width: 1.6, hotWidth: 0.7, alpha: fade * 0.45,
      });
    }

    // ----- Phase 4: wordmark assembles (2.7 .. 3.6) -----
    if (t >= 2.7) {
      const wt = Math.min(1, (t - 2.7) / 0.9);
      drawWordmark(ctx, w/2, h/2, wt, pal);
    }

    // ----- Phase 5: fade out (3.5 .. 3.8) -----
    if (t >= 3.5) {
      const ft = (t - 3.5) / 0.3;
      canvas.style.opacity = String(Math.max(0, 1 - ft));
      stack.style.opacity = String(Math.min(1, ft));
    }

    if (t >= DURATION) return finish(false);
    rafId = requestAnimationFrame(frame);
  }

  function finish(wasSkipped) {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    canvas.style.display = 'none';
    canvas.style.opacity = '1';
    stack.style.opacity = '1';
    document.removeEventListener('pointerdown', skip, true);
    document.removeEventListener('keydown', skip, true);
    if (_running === self) _running = null;
    onDone?.(wasSkipped);
  }

  function skip(e) {
    // Don't skip when clicking topnav or settings — they trigger their own actions
    if (e?.target?.closest?.('.topnav, .topbar')) return;
    skipped = true;
  }
  document.addEventListener('pointerdown', skip, true);
  document.addEventListener('keydown', skip, true);

  const self = { skip: () => { skipped = true; } };
  _running = self;
  rafId = requestAnimationFrame(frame);
}

// ---------- Helpers ----------
function bez(p0, p1, p2, t) {
  const u = 1 - t;
  return u*u*p0 + 2*u*t*p1 + t*t*p2;
}
function ease(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawRangeRings(ctx, cx, cy, pal) {
  const baseR = Math.min(ctx.canvas.clientWidth, ctx.canvas.clientHeight) * 0.05;
  for (let i = 1; i <= 5; i++) {
    const r = baseR * i * 1.6;
    const fade = 0.18 - i * 0.025;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = pal.line;
    ctx.globalAlpha = Math.max(0.04, fade);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Crosshairs
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = pal.line;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy); ctx.lineTo(ctx.canvas.clientWidth, cy);
  ctx.moveTo(cx, 0); ctx.lineTo(cx, ctx.canvas.clientHeight);
  ctx.stroke();
  ctx.restore();
}

function drawSweepLine(ctx, cx, cy, angle, pal) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
  const r = Math.max(w, h);
  const x = cx + Math.cos(angle) * r;
  const y = cy + Math.sin(angle) * r;
  // Wedge gradient behind
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(cx, cy, x, y);
  grad.addColorStop(0, pal.glow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(cx, cy); ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
  // Beam line
  beamLine(ctx, cx, cy, x, y, {
    color: pal.mid, hot: '#ffffff', width: 2.4, hotWidth: 0.8, alpha: 0.85,
  });
}

function drawWordmark(ctx, cx, cy, t, pal) {
  // Letter-by-letter reveal of "LAST / SILO"
  const W1 = 'LAST';
  const W2 = 'SILO';
  // Approximate font sizes responsive to viewport
  const size = Math.min(ctx.canvas.clientWidth, ctx.canvas.clientHeight) * 0.13;
  ctx.save();
  ctx.font = `900 ${size}px Orbitron, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const total = W1.length + W2.length;
  const showCount = Math.floor(t * total);

  // Line 1
  let line1 = '';
  for (let i = 0; i < W1.length; i++) {
    line1 += i < showCount ? W1[i] : ' ';
  }
  drawGlowText(ctx, line1, cx, cy - size * 0.6, size, pal.hot, '#ffffff');

  // Line 2 (accent)
  let line2 = '';
  const lineOffset = W1.length;
  for (let i = 0; i < W2.length; i++) {
    line2 += (i + lineOffset) < showCount ? W2[i] : ' ';
  }
  drawGlowText(ctx, line2, cx, cy + size * 0.55, size, pal.mid, '#ffffff');

  ctx.restore();
}

function drawGlowText(ctx, text, x, y, size, color, hot) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = size * 0.25;
  ctx.fillStyle = hot;
  ctx.fillText(text, x, y);
  ctx.restore();
}
