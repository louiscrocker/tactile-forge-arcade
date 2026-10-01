// =====================================================
// Tactile Forge — TRON · Scene renderer
// Game grid + arena perimeter + light-cycle trails + heads.
// =====================================================

import { beamPath, beamLine, beamDot, beamText, beamCircle } from './vector.js';
import { GRID_W, GRID_H } from '../game/constants.js';

function makeProj(canvas) {
  const w = canvas._logicalW || canvas.clientWidth || canvas.width;
  const h = canvas._logicalH || canvas.clientHeight || canvas.height;
  // Reserve room for the topbar + HUD around the arena.
  const marginTop = 96;
  const marginBottom = 64;
  const marginX = 48;
  const availW = Math.max(40, w - marginX * 2);
  const availH = Math.max(40, h - marginTop - marginBottom);
  const cellSize = Math.min(availW / GRID_W, availH / GRID_H);
  const arenaW = cellSize * GRID_W;
  const arenaH = cellSize * GRID_H;
  const ox = (w - arenaW) / 2;
  const oy = marginTop + (availH - arenaH) / 2;
  // (col, row) → CSS pixel center of cell
  const sx = (col) => ox + (col + 0.5) * cellSize;
  const sy = (row) => oy + (row + 0.5) * cellSize;
  return { w, h, ox, oy, cellSize, arenaW, arenaH, sx, sy };
}

export function drawScene(ctx, canvas, g, phos) {
  const proj = makeProj(canvas);
  const { w, h, ox, oy, arenaW, arenaH } = proj;
  const color = phos.line, hot = phos.hot;

  // ===== Background =====
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#01080d');
  bg.addColorStop(1, '#000408');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ===== Crash flash =====
  if (g.flashTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 70, 70, ${0.45 * g.flashTimer / 0.5})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ===== Grid lines (subtle) =====
  drawGridLines(ctx, proj, color);

  // ===== Arena perimeter (the wall around the grid) =====
  drawPerimeter(ctx, proj, color, hot);

  // ===== Cycle walls (trails) =====
  for (const c of g.cycles) drawTrail(ctx, proj, c);

  // ===== Cycle heads =====
  for (const c of g.cycles) drawCycleHead(ctx, proj, c, g);

  // ===== Derez bursts (lingering for ~1s after a cycle dies) =====
  for (const c of g.cycles) {
    if (!c.alive && c.derezzedAtTime != null) {
      const age = g.time - c.derezzedAtTime;
      if (age >= 0 && age < 1.0) drawDerezBurst(ctx, proj, c, age);
    }
  }

  // ===== Round-end overlay =====
  if (g.roundEnd) {
    const sub = g.roundEnd.result === 'win' ? 'ROUND CLEAR' : 'WRECKED';
    const sw = g.roundEnd.result === 'win' ? hot : '#ff8a96';
    beamText(ctx, sub, w / 2, h * 0.6, {
      color: sw, hot: '#ffffff', size: 36, align: 'center', baseline: 'middle', alpha: 0.9,
    });
  }

  // ===== Corner labels =====
  beamText(ctx, `ROUND ${String(g.round).padStart(2, '0')}`, w - 14, h - 12, {
    color, hot, size: 16, align: 'right', baseline: 'bottom', alpha: 0.55,
  });
  beamText(ctx, `× ${g.round}`, 14, h - 12, {
    color, hot, size: 16, align: 'left', baseline: 'bottom', alpha: 0.55,
  });
}

// ===== Grid lines =====
function drawGridLines(ctx, proj, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  // Minor lines every 4 cells, more visible every 20
  ctx.globalAlpha = 0.05;
  for (let c = 0; c <= GRID_W; c += 4) {
    const x = proj.ox + c * proj.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, proj.oy);
    ctx.lineTo(x, proj.oy + proj.arenaH);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID_H; r += 4) {
    const y = proj.oy + r * proj.cellSize;
    ctx.beginPath();
    ctx.moveTo(proj.ox, y);
    ctx.lineTo(proj.ox + proj.arenaW, y);
    ctx.stroke();
  }
  // Major lines every 20 cells
  ctx.globalAlpha = 0.13;
  for (let c = 0; c <= GRID_W; c += 20) {
    const x = proj.ox + c * proj.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, proj.oy);
    ctx.lineTo(x, proj.oy + proj.arenaH);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID_H; r += 20) {
    const y = proj.oy + r * proj.cellSize;
    ctx.beginPath();
    ctx.moveTo(proj.ox, y);
    ctx.lineTo(proj.ox + proj.arenaW, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ===== Arena perimeter (4 beam edges) =====
function drawPerimeter(ctx, proj, color, hot) {
  const x0 = proj.ox - 1, y0 = proj.oy - 1;
  const x1 = proj.ox + proj.arenaW + 1, y1 = proj.oy + proj.arenaH + 1;
  beamPath(ctx, [
    [x0, y0], [x1, y0], [x1, y1], [x0, y1],
  ], { color, hot, width: 3.0, hotWidth: 1.2, closed: true, alpha: 0.95 });
  // Corner brackets for emphasis
  const k = 14;
  const bracket = (cx, cy, dx, dy) => {
    beamLine(ctx, cx, cy, cx + dx * k, cy, { color: hot, hot: '#ffffff', width: 2.2, hotWidth: 0.9 });
    beamLine(ctx, cx, cy, cx, cy + dy * k, { color: hot, hot: '#ffffff', width: 2.2, hotWidth: 0.9 });
  };
  bracket(x0, y0, +1, +1);
  bracket(x1, y0, -1, +1);
  bracket(x0, y1, +1, -1);
  bracket(x1, y1, -1, -1);
}

// ===== Cycle wall trail =====
function drawTrail(ctx, proj, c) {
  if (!c.trail || c.trail.length < 1) return;
  // Convert visited cells to CSS-pixel polyline points (cell centers).
  const sp = c.trail.map(([col, row]) => [proj.sx(col), proj.sy(row)]);
  if (sp.length < 2) return;
  beamPath(ctx, sp, {
    color: c.color.line, hot: c.color.hot,
    width: 2.6, hotWidth: 1.0, alpha: c.alive ? 0.95 : 0.55,
  });
}

// ===== Cycle head (triangle) =====
function drawCycleHead(ctx, proj, c, g) {
  if (!c.alive) return;
  // Smooth interpolation between previous cell and current cell.
  const f = g.lastTickFrac;
  const fc = c.prevCol + (c.col - c.prevCol) * f;
  const fr = c.prevRow + (c.row - c.prevRow) * f;
  const hx = proj.sx(fc), hy = proj.sy(fr);
  const s = proj.cellSize * 1.25;
  const dirAngle = c.dir * Math.PI / 2;     // 0=right, 1=down, 2=left, 3=up — matches CSS
  // Triangle: tip in direction, base behind.
  const tip = rot(s * 0.6, 0, dirAngle);
  const bL  = rot(-s * 0.4, -s * 0.4, dirAngle);
  const bR  = rot(-s * 0.4,  s * 0.4, dirAngle);
  beamPath(ctx, [
    [hx + tip[0], hy + tip[1]],
    [hx + bL[0],  hy + bL[1]],
    [hx + bR[0],  hy + bR[1]],
  ], {
    color: c.color.line, hot: c.color.hot,
    width: 2.6, hotWidth: 1.1, closed: true, alpha: 1.0,
  });
  // Hot tip dot
  beamDot(ctx, hx + tip[0], hy + tip[1], 2.6, {
    color: c.color.hot, hot: '#ffffff', alpha: 1.0,
  });
  // Boost flare (player only, when active)
  if (c.isPlayer && g.boostActive) {
    const back = rot(-s * 0.55, 0, dirAngle);
    const flare = rot(-s * 1.35, 0, dirAngle);
    beamLine(ctx, hx + back[0], hy + back[1], hx + flare[0], hy + flare[1], {
      color: '#ffd57a', hot: '#ffffff', width: 3.4, hotWidth: 1.3, alpha: 0.85,
    });
  }
  // Faint label above the head (foes only)
  if (!c.isPlayer && c.name) {
    beamText(ctx, c.name, hx, hy - proj.cellSize * 1.6, {
      color: c.color.line, hot: c.color.hot, size: 11,
      align: 'center', baseline: 'middle', alpha: 0.65,
    });
  }
}

function rot(x, y, a) {
  const cs = Math.cos(a), sn = Math.sin(a);
  return [x * cs - y * sn, x * sn + y * cs];
}

// ===== Derez burst =====
function drawDerezBurst(ctx, proj, c, age) {
  if (!c.derezzedAt) return;
  const [col, row] = c.derezzedAt;
  const cx = proj.sx(col), cy = proj.sy(row);
  const t = age / 1.0;             // 0..1
  const r = (10 + t * 60) * proj.cellSize / 12;
  const fade = 1 - t;
  // Outer expanding ring
  beamCircle(ctx, cx, cy, r, {
    color: c.color.line, hot: c.color.hot,
    width: 2.8, hotWidth: 1.1, alpha: fade * 0.9,
  });
  // Inner hot ring
  beamCircle(ctx, cx, cy, r * 0.5, {
    color: c.color.hot, hot: '#ffffff',
    width: 2.0, hotWidth: 0.8, alpha: fade * 0.7,
  });
  // Particle shards (deterministic radial spokes)
  const spokes = 12;
  for (let i = 0; i < spokes; i++) {
    const ang = (i / spokes) * Math.PI * 2 + (c.uid || 0) * 0.31;
    const x0 = cx + Math.cos(ang) * r * 0.4;
    const y0 = cy + Math.sin(ang) * r * 0.4;
    const x1 = cx + Math.cos(ang) * r * 1.1;
    const y1 = cy + Math.sin(ang) * r * 1.1;
    beamLine(ctx, x0, y0, x1, y1, {
      color: c.color.line, hot: c.color.hot,
      width: 2.0, hotWidth: 0.8, alpha: fade * 0.85,
    });
  }
}
