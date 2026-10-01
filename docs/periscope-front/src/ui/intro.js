// =====================================================
// Tactile Forge — Tank Battle · Animated title intro
// 3.8s cold-open: scope sweep → enemy blips → wireframe
// tank rolls in from left → cannon flash → resolves to
// the PERISCOPE / FRONT wordmark.
// =====================================================

import { beamLine, beamPath, beamCircle, beamDot } from '../render/vector.js';
import * as audio from '../audio/audio.js';

const DURATION = 3.8;
let _running = null;

export function playIntro({ onDone } = {}) {
  if (_running) _running.skip();

  const canvas = document.getElementById('intro-canvas');
  const stack  = document.querySelector('.title-stack');
  if (!canvas || !stack) { onDone?.(); return; }

  const ctx = canvas.getContext('2d');
  let rafId = 0;
  let t0 = performance.now();
  let skipped = false;
  let done = false;

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

  const cues = [
    { t: 0.10, fn: () => audio.klaxon() },
    { t: 1.40, fn: () => audio.cannon() },
    { t: 2.10, fn: () => audio.cannon() },
    { t: 2.70, fn: () => audio.explode(true) },
    { t: 3.20, fn: () => audio.waveClear() },
  ];
  let cueIdx = 0;

  if (!audio.isUnlocked()) {
    audio.onUnlock(() => { try { audio.waveClear(); } catch {} });
  }

  const W = () => canvas.clientWidth;
  const H = () => canvas.clientHeight;

  function frame(now) {
    const t = (now - t0) / 1000;
    if (skipped) { return finish(true); }

    while (cueIdx < cues.length && t >= cues[cueIdx].t) {
      try { cues[cueIdx].fn(); } catch {}
      cueIdx += 1;
    }

    const w = W(), h = H();
    ctx.clearRect(0, 0, w, h);

    // ----- Background scope -----
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, 'rgba(0, 30, 16, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    drawRangeRings(ctx, w/2, h/2, t);

    // ----- Phase 1: scope sweep (0 .. 1.1) -----
    if (t < 1.2) {
      const sweep = (t / 1.2) * Math.PI * 2 - Math.PI/2;
      drawSweepLine(ctx, w/2, h/2, sweep);
      // Enemy blips
      if (t > 0.5) {
        const a = Math.min(1, (t - 0.5) / 0.4);
        const blips = [
          [0.30, 0.25], [0.70, 0.30], [0.55, 0.62],
        ];
        for (const [bx, by] of blips) {
          beamDot(ctx, bx * w, by * h, 4, {
            color: '#ff5a64', hot: '#ffd4d8', alpha: a * 0.9,
          });
        }
      }
    }

    // ----- Phase 2: wireframe tank rolls in (1.0 .. 2.7) -----
    if (t >= 1.0 && t < 3.0) {
      const tt = Math.min(1, (t - 1.0) / 1.4);
      const tx = w * (-0.20 + tt * 0.70);
      const ty = h * 0.62;
      const scale = Math.min(w, h) * 0.18;
      drawTankSilhouette(ctx, tx, ty, scale, t * 4.5);
      // Cannon flashes
      if (t >= 1.45 && t < 1.65) {
        const a = 1 - (t - 1.45) / 0.20;
        beamDot(ctx, tx + scale * 1.3, ty - scale * 0.35, scale * 0.45, {
          color: '#ffe04a', hot: '#ffffff', alpha: a,
        });
      }
      if (t >= 2.15 && t < 2.35) {
        const a = 1 - (t - 2.15) / 0.20;
        beamDot(ctx, tx + scale * 1.3, ty - scale * 0.35, scale * 0.5, {
          color: '#ffe04a', hot: '#ffffff', alpha: a,
        });
      }
    }

    // ----- Phase 3: blast (2.6 .. 3.4) -----
    if (t >= 2.6 && t < 3.4) {
      const bt = (t - 2.6) / 0.8;
      const r = ease(bt) * Math.min(w, h) * 0.20;
      const fade = bt < 0.5 ? 1 : 1 - (bt - 0.5) / 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createRadialGradient(w * 0.72, h * 0.55, 0, w * 0.72, h * 0.55, r);
      g2.addColorStop(0, '#ff7a3a');
      g2.addColorStop(0.5, 'rgba(255,90,100,0.4)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.55, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      beamCircle(ctx, w * 0.72, h * 0.55, r, {
        color: '#ffd4d8', hot: '#ffffff', width: 3.0, hotWidth: 1.2, alpha: fade * 0.95,
      });
    }

    // ----- Phase 4: wordmark (2.7 .. 3.6) -----
    if (t >= 2.7) {
      const wt = Math.min(1, (t - 2.7) / 0.9);
      drawWordmark(ctx, w/2, h/2, wt);
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
    _running = null;
    onDone?.(wasSkipped);
  }

  function skip(e) {
    if (e?.target?.closest?.('.topnav, .topbar')) return;
    skipped = true;
  }
  document.addEventListener('pointerdown', skip, true);
  document.addEventListener('keydown', skip, true);

  rafId = requestAnimationFrame(frame);
  _running = { skip: () => { skipped = true; } };
}

// ---------- Helpers ----------
function ease(t) { return 1 - Math.pow(1 - t, 3); }

function drawRangeRings(ctx, cx, cy, t) {
  const baseR = Math.min(ctx.canvas.clientWidth, ctx.canvas.clientHeight) * 0.05;
  for (let i = 1; i <= 5; i++) {
    const r = baseR * i * 1.6;
    const fade = 0.18 - i * 0.025;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#00d878';
    ctx.globalAlpha = Math.max(0.04, fade);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#00d878';
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy); ctx.lineTo(ctx.canvas.clientWidth, cy);
  ctx.moveTo(cx, 0); ctx.lineTo(cx, ctx.canvas.clientHeight);
  ctx.stroke();
  ctx.restore();
}

function drawSweepLine(ctx, cx, cy, angle) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
  const r = Math.max(w, h);
  const x = cx + Math.cos(angle) * r;
  const y = cy + Math.sin(angle) * r;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(cx, cy, x, y);
  grad.addColorStop(0, 'rgba(60, 255, 160, 0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(cx, cy); ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
  beamLine(ctx, cx, cy, x, y, {
    color: '#5cffaa', hot: '#ffffff', width: 2.4, hotWidth: 0.8, alpha: 0.85,
  });
}

// 2D wireframe tank for the intro (not the 3D engine version).
function drawTankSilhouette(ctx, cx, cy, s, t) {
  const opt = { color: '#5cffaa', hot: '#ffffff', width: 2.4, hotWidth: 1.0, alpha: 0.9 };

  // Treads (two rectangles, slight bob)
  const bob = Math.sin(t) * s * 0.04;
  const treadH = s * 0.34;
  const treadY = cy + bob;
  // Lower tread
  beamPath(ctx, [
    [cx - s * 1.05, treadY],
    [cx + s * 1.05, treadY],
    [cx + s * 1.0,  treadY + treadH],
    [cx - s * 1.0,  treadY + treadH],
  ], { ...opt, closed: true });

  // Wheels (5 dots)
  for (let i = 0; i < 5; i++) {
    const wx = cx - s * 0.85 + i * (s * 0.42);
    beamDot(ctx, wx, treadY + treadH * 0.5, s * 0.06, {
      color: '#5cffaa', hot: '#ffffff', alpha: 0.95,
    });
  }

  // Hull (trapezoid above treads)
  beamPath(ctx, [
    [cx - s * 0.95, treadY],
    [cx + s * 0.95, treadY],
    [cx + s * 0.75, treadY - s * 0.55],
    [cx - s * 0.75, treadY - s * 0.55],
  ], { ...opt, closed: true });

  // Turret + barrel
  beamPath(ctx, [
    [cx - s * 0.40, treadY - s * 0.55],
    [cx + s * 0.40, treadY - s * 0.55],
    [cx + s * 0.30, treadY - s * 0.95],
    [cx - s * 0.30, treadY - s * 0.95],
  ], { ...opt, closed: true });
  beamLine(ctx, cx + s * 0.05, treadY - s * 0.75, cx + s * 1.30, treadY - s * 0.45, {
    ...opt, width: 3.4, hotWidth: 1.6,
  });
}

function drawWordmark(ctx, cx, cy, t) {
  const W1 = 'PERISCOPE';
  const W2 = 'FRONT';
  let size = Math.min(ctx.canvas.clientWidth, ctx.canvas.clientHeight) * 0.13;
  ctx.save();
  ctx.font = `900 ${size}px Orbitron, Inter, sans-serif`;
  // PERISCOPE is long: shrink the wordmark so it fits 90% of the width.
  const widest = Math.max(ctx.measureText(W1).width, ctx.measureText(W2).width);
  const room = ctx.canvas.clientWidth * 0.9;
  if (widest > room) {
    size *= room / widest;
    ctx.font = `900 ${size}px Orbitron, Inter, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const total = W1.length + W2.length;
  const showCount = Math.floor(t * total);

  let line1 = '';
  for (let i = 0; i < W1.length; i++) line1 += i < showCount ? W1[i] : ' ';
  drawGlowText(ctx, line1, cx, cy - size * 0.6, size, '#d8ffe9', '#ffffff');

  let line2 = '';
  const lineOffset = W1.length;
  for (let i = 0; i < W2.length; i++) line2 += (i + lineOffset) < showCount ? W2[i] : ' ';
  drawGlowText(ctx, line2, cx, cy + size * 0.55, size, '#5cffaa', '#ffffff');

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
