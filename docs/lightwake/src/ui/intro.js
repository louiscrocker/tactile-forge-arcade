// =====================================================
// Tactile Forge — TRON · Animated title intro
// 3.8s cold-open: grid fades up → two light cycles streak
// across, trails laid down → head-on collision flash →
// "END OF / LINE" wordmark assembles → resolve to title.
// =====================================================

import { beamLine, beamPath, beamCircle, beamDot, beamText } from '../render/vector.js';
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
    { t: 0.10, fn: () => audio.boost() },
    { t: 1.00, fn: () => audio.turn() },
    { t: 1.20, fn: () => audio.boost() },
    { t: 2.55, fn: () => audio.derez(true) },
    { t: 2.75, fn: () => audio.victory() },
  ];
  let cueIdx = 0;

  if (!audio.isUnlocked()) {
    audio.onUnlock(() => { try { audio.victory(); } catch {} });
  }

  // Two cycles race toward the center on opposite sides of the grid.
  // Both are pinned to a horizontal track; they meet in the middle.
  const cycles = [
    { color: '#4ad8ff', hot: '#c8f2ff', dir: +1, x0: 0.10, x1: 0.51, y: 0.55 },
    { color: '#ff5a64', hot: '#ffd4d8', dir: -1, x0: 0.90, x1: 0.49, y: 0.55 },
  ];

  function frame(now) {
    const t = (now - t0) / 1000;
    if (skipped) return finish(true);

    while (cueIdx < cues.length && t >= cues[cueIdx].t) {
      try { cues[cueIdx].fn(); } catch {}
      cueIdx += 1;
    }

    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // ----- Background scope -----
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, 'rgba(8, 22, 36, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ----- Phase 1: grid fade-in (0..1.1s) -----
    const gridA = Math.min(1, t / 1.1);
    drawGrid(ctx, w, h, gridA * 0.35);

    // ----- Phase 2: light cycles race (0.5..2.55) -----
    if (t >= 0.5) {
      const at = Math.min(1, (t - 0.5) / 2.05);
      for (const c of cycles) {
        const cx = (c.x0 + (c.x1 - c.x0) * at) * w;
        const cy = c.y * h;
        const tx0 = c.x0 * w;
        const ty0 = c.y * h;
        // Trail
        beamLine(ctx, tx0, ty0, cx, cy, {
          color: c.color, hot: c.hot, width: 3.0, hotWidth: 1.2, alpha: 0.95,
        });
        // Head triangle
        const s = 14;
        const tip = [cx + c.dir * s, cy];
        const bL  = [cx - c.dir * s * 0.6, cy - s * 0.7];
        const bR  = [cx - c.dir * s * 0.6, cy + s * 0.7];
        beamPath(ctx, [tip, bL, bR], {
          color: c.color, hot: c.hot, width: 2.4, hotWidth: 1.0, closed: true, alpha: 1,
        });
        beamDot(ctx, tip[0], tip[1], 3.2, { color: c.hot, hot: '#ffffff', alpha: 1 });
      }
    }

    // ----- Phase 3: collision flash (2.5..3.1) -----
    if (t >= 2.5 && t < 3.1) {
      const bt = (t - 2.5) / 0.6;
      const r = ease(bt) * Math.min(w, h) * 0.18;
      const fade = bt < 0.5 ? 1 : 1 - (bt - 0.5) / 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createRadialGradient(w/2, h * 0.55, 0, w/2, h * 0.55, r);
      g2.addColorStop(0, '#ffffff');
      g2.addColorStop(0.5, 'rgba(74, 216, 255, 0.5)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(w/2, h * 0.55, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      beamCircle(ctx, w/2, h * 0.55, r, {
        color: '#c8f2ff', hot: '#ffffff', width: 3.0, hotWidth: 1.2, alpha: fade * 0.95,
      });
      // Outer shockwave
      const r2 = ease(Math.min(1, bt * 1.4)) * Math.min(w, h) * 0.32;
      beamCircle(ctx, w/2, h * 0.55, r2, {
        color: '#4ad8ff', hot: '#c8f2ff', width: 1.8, hotWidth: 0.7, alpha: fade * 0.5,
      });
    }

    // ----- Phase 4: wordmark assembles (2.7..3.6) -----
    if (t >= 2.7) {
      const wt = Math.min(1, (t - 2.7) / 0.9);
      drawWordmark(ctx, w/2, h * 0.4, wt);
    }

    // ----- Phase 5: fade out (3.5..3.8) -----
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

function ease(t) { return 1 - Math.pow(1 - t, 3); }

function drawGrid(ctx, w, h, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#4ad8ff';
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  const step = Math.max(28, Math.min(64, w / 24));
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWordmark(ctx, cx, cy, t) {
  const W1 = 'LIGHT';
  const W2 = 'WAKE';
  const size = Math.min(ctx.canvas.clientWidth, ctx.canvas.clientHeight) * 0.13;
  ctx.save();
  ctx.font = `900 ${size}px Orbitron, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const total = W1.length + W2.length;
  const showCount = Math.floor(t * total);

  let line1 = '';
  for (let i = 0; i < W1.length; i++) line1 += i < showCount ? W1[i] : ' ';
  drawGlowText(ctx, line1, cx, cy - size * 0.6, size, '#c8f2ff', '#ffffff');

  let line2 = '';
  for (let i = 0; i < W2.length; i++) line2 += (i + W1.length) < showCount ? W2[i] : ' ';
  drawGlowText(ctx, line2, cx, cy + size * 0.55, size, '#4ad8ff', '#ffffff');

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
