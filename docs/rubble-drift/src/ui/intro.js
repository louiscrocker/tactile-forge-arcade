// =====================================================
// Tactile Forge — Asteroids · Animated title intro
// 3.6s cold-open: starfield wake → drifting rocks → a single
// wireframe ship cuts across firing → a rock shatters →
// RUBBLE / DRIFT wordmark assembles from the debris.
// =====================================================

import { beamLine, beamPath, beamCircle, beamDot } from '../render/vector.js';
import * as audio from '../audio/audio.js';

const DURATION = 3.6;
let _running = null;

export function playIntro({ onDone } = {}) {
  if (_running) _running.skip();

  const canvas = document.getElementById('intro-canvas');
  const stack  = document.querySelector('.title-stack');
  if (!canvas || !stack) { onDone?.(); return; }

  const ctx = canvas.getContext('2d');
  let rafId = 0;
  let t0 = performance.now();
  let last = t0;
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

  // Pre-roll: queue audio cues
  const cues = [
    { t: 0.10, fn: () => audio.beat() },
    { t: 0.55, fn: () => audio.beat() },
    { t: 1.00, fn: () => audio.beat() },
    { t: 1.55, fn: () => audio.fire() },
    { t: 1.85, fn: () => audio.fire() },
    { t: 2.10, fn: () => audio.bangLarge() },
    { t: 3.10, fn: () => audio.waveClear() },
  ];
  let cueIdx = 0;

  if (!audio.isUnlocked()) {
    audio.onUnlock(() => {
      try { audio.waveClear(); } catch {}
    });
  }

  // Pre-baked rock seed shapes
  const rocks = [];
  for (let i = 0; i < 5; i++) {
    const verts = 12;
    const shape = [];
    for (let v = 0; v < verts; v++) {
      const a = (v / verts) * Math.PI * 2;
      const rr = 0.66 + Math.random() * 0.39;
      shape.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    rocks.push({
      shape,
      x:    0.10 + Math.random() * 0.80,
      y:    0.20 + Math.random() * 0.55,
      r:    [22, 30, 28, 24, 36][i] || 26,
      rot:  Math.random() * Math.PI * 2,
      rotR: (Math.random() * 2 - 1) * 0.6,
      vx:   (Math.random() * 2 - 1) * 0.04,
      vy:   (Math.random() * 2 - 1) * 0.025,
      shattered: false,
      shatterT: 0,
    });
  }
  // Mark one (the centre rock) for shattering at t=2.10
  const targetRock = rocks[2];

  // Ship sweep: enters left at 1.4, crosses to right at 2.05
  const ship = {
    a:  0.0,                   // angle (right)
    fireTimes: [1.55, 1.85],
    fired: [false, false],
  };

  // Bullets from the ship (added at fire times)
  const bullets = [];

  function frame(now) {
    const t = (now - t0) / 1000;
    // Real elapsed time, not a hard-coded 1/60 — otherwise the whole cold-open
    // plays at 2.4× on a 144 Hz panel and crawls on a throttled tab.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (skipped) return finish(true);

    while (cueIdx < cues.length && t >= cues[cueIdx].t) {
      try { cues[cueIdx].fn(); } catch {}
      cueIdx += 1;
    }

    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Background scope vignette
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, 'rgba(0, 30, 16, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Range rings
    drawRangeRings(ctx, w/2, h/2);

    // Rocks
    for (const r of rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.rotR * dt;
      const cx = r.x * w, cy = r.y * h;
      if (r === targetRock && r.shattered) {
        r.shatterT += dt;
        // Fragments fly outward
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + r.rot;
          const dist = r.shatterT * 200;
          const px = cx + Math.cos(a) * dist;
          const py = cy + Math.sin(a) * dist;
          const len = Math.max(2, 12 - r.shatterT * 30);
          beamLine(ctx, px, py, px + Math.cos(a) * len, py + Math.sin(a) * len, {
            color: '#5cffaa', hot: '#ffffff', width: 2.0, hotWidth: 0.8,
            alpha: Math.max(0, 1 - r.shatterT * 1.6),
          });
        }
        continue;
      }
      const pts = r.shape.map(([px, py]) => {
        const rx = px * r.r, ry = py * r.r;
        const c = Math.cos(r.rot), s = Math.sin(r.rot);
        return [cx + rx * c - ry * s, cy + rx * s + ry * c];
      });
      const alpha = t < 0.4 ? t / 0.4 : 1.0;
      beamPath(ctx, pts, {
        color: '#00d878', hot: '#d8ffe9',
        width: 2.2, hotWidth: 0.9, closed: true, alpha: alpha * 0.95,
      });
    }

    // Ship sweep (1.20 .. 2.10)
    if (t >= 1.20 && t < 2.30) {
      const at = (t - 1.20) / 1.10;
      const sx = (0.05 + at * 0.90) * w;
      const sy = (targetRock.y + Math.sin(at * Math.PI * 2) * 0.04) * h;
      drawShip(ctx, sx, sy);
      // Fire bullets at scheduled times
      for (let i = 0; i < ship.fireTimes.length; i++) {
        if (!ship.fired[i] && t >= ship.fireTimes[i]) {
          ship.fired[i] = true;
          // Aim at target rock
          const tx = targetRock.x * w, ty = targetRock.y * h;
          const ang = Math.atan2(ty - sy, tx - sx);
          bullets.push({ x: sx, y: sy, vx: Math.cos(ang) * 7.5, vy: Math.sin(ang) * 7.5, life: 1.2 });
        }
      }
    }

    // Bullets travel; trigger shatter on impact. The bang cue fires at t=2.10,
    // so the rock breaks by then whether or not a bullet happened to land —
    // a long frame can otherwise step a bullet clean through the hit radius.
    if (!targetRock.shattered && t >= 2.10) {
      targetRock.shattered = true;
      targetRock.shatterT = 0;
    }
    for (const b of bullets) {
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
      b.life -= dt;
      // Check distance to target rock
      const tx = targetRock.x * w, ty = targetRock.y * h;
      if (!targetRock.shattered &&
          (b.x - tx) * (b.x - tx) + (b.y - ty) * (b.y - ty) < (targetRock.r * targetRock.r)) {
        targetRock.shattered = true;
        targetRock.shatterT = 0;
        b.life = 0;
      }
      if (b.life > 0) {
        beamDot(ctx, b.x, b.y, 2.4, { color: '#d8ffe9', hot: '#ffffff', alpha: 1 });
      }
    }

    // Wordmark assemble (2.5 .. 3.4)
    if (t >= 2.5) {
      const wt = Math.min(1, (t - 2.5) / 0.9);
      drawWordmark(ctx, w/2, h/2, wt);
    }

    // Fade out (3.3 .. 3.6)
    if (t >= 3.3) {
      const ft = (t - 3.3) / 0.3;
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

function drawRangeRings(ctx, cx, cy) {
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
}

function drawShip(ctx, cx, cy) {
  const r = 16;
  // Triangle ship pointing right
  const pts = [
    [cx + r, cy],
    [cx - r * 0.7, cy - r * 0.55],
    [cx - r * 0.5, cy],
    [cx - r * 0.7, cy + r * 0.55],
  ];
  beamPath(ctx, pts, {
    color: '#5cffaa', hot: '#d8ffe9', width: 2.4, hotWidth: 1.0, closed: true,
  });
  // Tiny thrust flicker
  beamLine(ctx, cx - r * 0.5, cy, cx - r * 1.05, cy, {
    color: '#ff7a3a', hot: '#ffe04a', width: 1.6, hotWidth: 0.7, alpha: 0.85,
  });
}

function drawWordmark(ctx, cx, cy, t) {
  const W1 = 'RUBBLE';
  const W2 = 'DRIFT';
  const size = Math.min(ctx.canvas.clientWidth, ctx.canvas.clientHeight) * 0.13;
  ctx.save();
  ctx.font = `900 ${size}px Orbitron, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const total = W1.length + W2.length;
  const showCount = Math.floor(t * total);

  let line1 = '';
  for (let i = 0; i < W1.length; i++) line1 += i < showCount ? W1[i] : ' ';
  drawGlowText(ctx, line1, cx, cy - size * 0.6, size, '#d8ffe9', '#ffffff');

  let line2 = '';
  const lineOffset = W1.length;
  for (let i = 0; i < W2.length; i++) {
    line2 += (i + lineOffset) < showCount ? W2[i] : ' ';
  }
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
