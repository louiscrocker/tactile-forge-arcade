// =====================================================
// Tactile Forge — Asteroids · Scene renderer
// World-to-screen draw of ship, bullets, asteroids,
// saucers, debris and an outline-overlay for screen wrap.
// =====================================================

import { beamPath, beamLine, beamDot, beamText, beamCircle } from './vector.js';
import {
  WORLD_W, WORLD_H,
  SHIP, ASTEROID, SAUCER, SAUCER_COLOR,
} from '../game/constants.js';

function makeProj(canvas) {
  const w = canvas._logicalW || canvas.clientWidth || canvas.width;
  const h = canvas._logicalH || canvas.clientHeight || canvas.height;
  // Use uniform world-px ratio so circles stay round; pillarbox if needed.
  const sxRaw = (x) => (x / WORLD_W) * w;
  const syRaw = (y) => (y / WORLD_H) * h;
  const ppmX = w / WORLD_W;
  const ppmY = h / WORLD_H;
  // Use the smaller of x/y scale uniformly, centered, so 1 world-px is the
  // same on both axes. Letterboxes for non-4:3 viewports.
  const ppm = Math.min(ppmX, ppmY);
  const offX = (w - WORLD_W * ppm) / 2;
  const offY = (h - WORLD_H * ppm) / 2;
  const sx = (x) => offX + x * ppm;
  const sy = (y) => offY + y * ppm;
  return { w, h, sx, sy, ppm, offX, offY };
}

export function drawScene(ctx, canvas, g, phos) {
  const proj = makeProj(canvas);
  const { w, h, ppm, offX, offY } = proj;
  const color = phos.line, hot = phos.hot;

  // ===== Background tint =====
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const pal = g.palette || { bg0: '#000604', bg1: '#001209' };
  grad.addColorStop(0, pal.bg0);
  grad.addColorStop(1, pal.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ===== Death flash overlay =====
  if (g.flashTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 70, 70, ${0.45 * g.flashTimer / 0.45})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ===== Play-field frame (dim border so wrap edges are visible) =====
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.10;
  ctx.lineWidth = 1;
  ctx.strokeRect(offX, offY, WORLD_W * ppm, WORLD_H * ppm);
  ctx.restore();

  // Helper to draw something with toroidal wrap (renders ghosts near edges)
  function drawWithWrap(x, y, r, fn) {
    const sx0 = proj.sx(x), sy0 = proj.sy(y);
    fn(sx0, sy0);
    // Edge ghosts — only draw if the entity is within `r` world units of an edge
    const dx = x < r ? WORLD_W : (x > WORLD_W - r ? -WORLD_W : 0);
    const dy = y < r ? WORLD_H : (y > WORLD_H - r ? -WORLD_H : 0);
    if (dx) fn(proj.sx(x + dx), sy0);
    if (dy) fn(sx0, proj.sy(y + dy));
    // Corner ghost — without it an entity straddling a corner loses the
    // diagonal quarter of itself.
    if (dx && dy) fn(proj.sx(x + dx), proj.sy(y + dy));
  }

  // Entities are clipped to the play rect: a rock straddling an edge is drawn
  // twice (native + ghost), and without the clip the overhanging half spills
  // into the letterbox margin outside the frame.
  ctx.save();
  ctx.beginPath();
  ctx.rect(offX, offY, WORLD_W * ppm, WORLD_H * ppm);
  ctx.clip();

  // ===== Asteroids =====
  for (const a of g.asteroids) {
    const r = ASTEROID.radii[a.tier];
    drawWithWrap(a.x, a.y, r + 8, (cx, cy) => {
      const pts = a.shape.map(([px, py]) => {
        const rx = px * r, ry = py * r;
        const c = Math.cos(a.rot), s = Math.sin(a.rot);
        return [cx + (rx * c - ry * s) * ppm, cy + (rx * s + ry * c) * ppm];
      });
      beamPath(ctx, pts, {
        color, hot,
        width: ASTEROID.lineWidth[a.tier] * 1.2,
        hotWidth: 0.9,
        closed: true,
      });
    });
  }

  // ===== Saucer =====
  if (g.saucer) {
    drawWithWrap(g.saucer.x, g.saucer.y, SAUCER[g.saucer.kind].radius + 6, (cx, cy) => {
      drawSaucer(ctx, cx, cy, g.saucer.kind, ppm);
    });
  }

  // ===== Player bullets =====
  for (const b of g.bullets) {
    drawWithWrap(b.x, b.y, 4, (cx, cy) => {
      beamDot(ctx, cx, cy, 2.4, { color: hot, hot: '#ffffff', alpha: 1 });
    });
  }

  // ===== Saucer bullets (warm) =====
  for (const b of g.sBullets) {
    drawWithWrap(b.x, b.y, 4, (cx, cy) => {
      beamDot(ctx, cx, cy, 2.6, {
        color: SAUCER_COLOR.bullet.line,
        hot: SAUCER_COLOR.bullet.hot,
        alpha: 1,
      });
    });
  }

  // ===== Ship =====
  if (g.ship.alive) {
    drawWithWrap(g.ship.x, g.ship.y, SHIP.radius + 6, (cx, cy) => {
      drawShip(ctx, cx, cy, g.ship, color, hot, ppm);
    });
  }

  // ===== Particles (debris) =====
  drawParticles(ctx, proj, g.particles, color, hot);

  ctx.restore();   // end play-field clip — banners and labels live outside it

  // ===== Between-wave banner =====
  if (g.betweenWaves) {
    beamText(ctx, 'STAND BY · NEXT FIELD', w / 2, h * 0.78, {
      color, hot, size: 26, align: 'center', baseline: 'middle', alpha: 0.85,
    });
  }
  // ===== Game-over banner =====
  if (g.outcome === 'gameover') {
    beamText(ctx, 'GAME OVER', w / 2, h / 2 - 30, {
      color: hot, hot: '#ffffff', size: 56, align: 'center', baseline: 'middle', alpha: 0.95,
    });
    beamText(ctx, 'PATROL ENDS', w / 2, h / 2 + 24, {
      color, hot, size: 18, align: 'center', baseline: 'middle', alpha: 0.7,
    });
  }

  // ===== Corner labels =====
  beamText(ctx, `WAVE ${String(g.wave).padStart(2, '0')}`, w - 14, h - 12, {
    color, hot, size: 16, align: 'right', baseline: 'bottom', alpha: 0.55,
  });
  beamText(ctx, `ROCKS ${g.asteroids.length}`, 14, h - 12, {
    color, hot, size: 16, align: 'left', baseline: 'bottom', alpha: 0.55,
  });
}

// ===== Ship — classic triangular wireframe with rear cutout + thrust flame =====
function drawShip(ctx, cx, cy, s, color, hot, ppm) {
  const a = s.angle;
  const r = SHIP.radius * ppm;
  const c = Math.cos(a), si = Math.sin(a);
  // Local model (pointing along +x): tip(1.0, 0), rearLeft(-0.7, -0.55), rearRight(-0.7, 0.55), inner cutout
  const local = [
    [ 1.00,  0.00],         // 0: nose
    [-0.70, -0.55],         // 1: tail-left
    [-0.50,  0.00],         // 2: cutout point
    [-0.70,  0.55],         // 3: tail-right
  ];
  const pts = local.map(([x, y]) => {
    return [cx + (x * c - y * si) * r, cy + (x * si + y * c) * r];
  });

  // Invulnerability: blink ~10Hz
  const blink = (s.invulnT > 0) ? (Math.floor(s.invulnT * 10) % 2 === 0) : false;
  const alpha = blink ? 0.35 : 1.0;

  beamPath(ctx, pts, { color, hot, width: 2.4, hotWidth: 1.0, closed: true, alpha });

  // Thrust flame (animated)
  if (s.thrusting) {
    const flick = (Math.sin(s.flameT * 60) * 0.25 + 0.75);
    const fLocal = [
      [-0.60, -0.30],
      [-1.20 * flick, 0.00],
      [-0.60,  0.30],
    ];
    const fpts = fLocal.map(([x, y]) => {
      return [cx + (x * c - y * si) * r, cy + (x * si + y * c) * r];
    });
    beamPath(ctx, fpts, {
      color: '#ff7a3a', hot: '#ffe04a',
      width: 2.0, hotWidth: 0.8, alpha: 0.95,
    });
  }
}

// ===== Saucer — classic two-trapezoid + dome =====
function drawSaucer(ctx, cx, cy, kind, ppm) {
  const r = SAUCER[kind].radius * ppm;
  const col = SAUCER_COLOR[kind];
  // Body: hexagon-ish silhouette
  const body = [
    [-1.0,  0.0],
    [-0.55,-0.35],
    [ 0.55,-0.35],
    [ 1.0,  0.0],
    [ 0.55, 0.35],
    [-0.55, 0.35],
  ].map(([x, y]) => [cx + x * r, cy + y * r]);
  beamPath(ctx, body, {
    color: col.line, hot: col.hot,
    width: 2.2, hotWidth: 1.0, closed: true,
  });
  // Mid stripe (between top and bottom trapezoids)
  beamLine(ctx, cx - r, cy, cx + r, cy, {
    color: col.line, hot: col.hot, width: 1.6, hotWidth: 0.6, alpha: 0.85,
  });
  // Dome on top
  const dome = [
    [-0.40, -0.35],
    [-0.30, -0.55],
    [ 0.30, -0.55],
    [ 0.40, -0.35],
  ].map(([x, y]) => [cx + x * r, cy + y * r]);
  beamPath(ctx, dome, {
    color: col.line, hot: col.hot, width: 1.8, hotWidth: 0.7,
  });
  // Antenna pip
  beamDot(ctx, cx, cy - r * 0.6, 1.6, { color: col.hot, hot: '#ffffff', alpha: 0.9 });
}

// ===== Particles =====
function drawParticles(ctx, proj, parts, color, hot) {
  for (const p of parts) {
    const sx = proj.sx(p.x), sy = proj.sy(p.y);
    const ux = -p.vx, uy = -p.vy;
    const len = p.len;
    const norm = Math.hypot(ux, uy) || 1;
    const tx = sx + (ux / norm) * len;
    const ty = sy + (uy / norm) * len;
    const a = Math.max(0, p.life);
    beamLine(ctx, sx, sy, tx, ty, {
      color: p.color?.line || color,
      hot:   p.color?.hot  || hot,
      width: 1.8, hotWidth: 0.8, alpha: Math.min(1, a * 1.4),
    });
  }
}
