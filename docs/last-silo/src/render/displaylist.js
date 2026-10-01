// =====================================================
// Tactile Forge — Missile Attack · Scene display list
//
// Turns game state into renderer-agnostic geometry in screen space. Both the
// Canvas 2D and the WebGL back ends consume this same list, so they draw
// provably the same picture and only differ in how the beam is shaded.
//
// Screen space: CSS pixels, origin top-left, y down. World y is *also* down in
// this game, so unlike Lunar Lander there is no vertical flip — just a scale.
// =====================================================

import {
  WORLD_W, WORLD_H,
  CITY, BATTERY, ENEMY_COLOR,
} from '../game/constants.js';

const ACCENT     = '#ffe04a';
const ACCENT_HOT = '#ffffff';
const WHITE      = '#ffffff';
const RUBBLE     = '#6a3a30';
const RUBBLE_HOT = '#ffb29a';
const STUMP      = '#7a4030';
const STUMP_HOT  = '#ffd0b8';

/** Projection from world units to screen pixels. */
export function makeProj(w, h) {
  return {
    w, h,
    sx: (x) => (x / WORLD_W) * w,
    sy: (y) => (y / WORLD_H) * h,
    ppmX: w / WORLD_W,
    ppmY: h / WORLD_H,
  };
}

/** Points around an ellipse, as a closed polyline. */
function ellipsePts(cx, cy, rx, ry, n = 48) {
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts[i] = [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  }
  return pts;
}

export function buildScene(g, phos, proj) {
  const color = phos.line, hot = phos.hot;
  const pal = g.palette || { bg0: '#000a06', bg1: '#001209' };

  const list = {
    w: proj.w,
    h: proj.h,
    bg0: pal.bg0,
    bg1: pal.bg1,
    flash: g.flashTimer > 0 ? 0.5 * g.flashTimer / 0.4 : 0,
    hatch: [],
    glows: [],
    paths: [],
    dots: [],
    texts: [],
  };

  emitSkyline(list, g.skyline, proj, color, hot);
  for (const b of g.batteries) emitBattery(list, b, proj, color, hot);
  for (const c of g.cities)    emitCity(list, c, proj, color, hot);
  for (const m of g.counters)  emitCounter(list, m, proj, phos);
  for (const s of g.sats    || []) emitSat(list, s, proj);
  for (const b of g.bombers || []) emitBomber(list, b, proj);
  for (const m of g.icbms)     emitIcbm(list, m, proj);
  for (const b of g.blasts)    emitBlast(list, b, proj, phos);
  emitParticles(list, g.particles, proj);
  emitCrosshair(list, g._crosshair, proj);

  list.texts.push({
    text: `WAVE ${String(g.wave).padStart(2, '0')}`,
    x: proj.w - 14, y: proj.h - 12,
    size: 16, align: 'right', baseline: 'bottom', color, hot, alpha: 0.55,
  });
  list.texts.push({
    text: `× ${g.mult}`,
    x: 14, y: proj.h - 12,
    size: 16, align: 'left', baseline: 'bottom', color, hot, alpha: 0.55,
  });
  if (g.betweenWaves) {
    list.texts.push({
      text: 'RELOADING SILOS',
      x: proj.w / 2, y: proj.h * 0.72,
      size: 28, align: 'center', baseline: 'middle', color, hot, alpha: 0.85,
    });
  }

  return list;
}

function path(list, pts, opts) {
  list.paths.push({
    pts, closed: false, width: 2.2, hotWidth: 0.9, alpha: 1, ...opts,
  });
}

// ===== Skyline =====
function emitSkyline(list, pts, proj, color, hot) {
  if (!pts || pts.length === 0) return;
  const sp = pts.map(([x, y]) => [proj.sx(x), proj.sy(y)]);
  const step = 3;
  for (let i = 0; i < sp.length; i += step) {
    list.hatch.push({ x: sp[i][0], y0: sp[i][1], y1: proj.h, color, alpha: 0.10 });
  }
  path(list, sp, { color, hot, width: 2.2, hotWidth: 0.9 });
}

// ===== City =====
function emitCity(list, c, proj, color, hot) {
  const cx = proj.sx(c.x);
  const baseY = proj.sy(c.y);

  if (!c.alive) {
    const w = CITY.w * proj.ppmX * 0.9;
    const h = CITY.h * proj.ppmY * 0.35;
    path(list, [[cx - w / 2, baseY], [cx + w / 2, baseY]], {
      color: RUBBLE, hot: RUBBLE_HOT, width: 2.0, hotWidth: 0.8, alpha: 0.85,
    });
    for (let i = 0; i < 3; i++) {
      const sx = cx - w / 2 + (i + 0.5) * (w / 3);
      const stumpH = h * (0.4 + 0.3 * Math.sin(i * 1.3 + c.id));
      path(list, [[sx, baseY], [sx, baseY - stumpH]], {
        color: STUMP, hot: STUMP_HOT, width: 1.6, hotWidth: 0.6, alpha: 0.7,
      });
    }
    return;
  }

  // Alive: four spires of varying height inside the bounding box
  const w = CITY.w * proj.ppmX;
  const left = cx - w / 2;
  const heights = [0.55, 0.95, 0.75, 0.40];
  for (let i = 0; i < heights.length; i++) {
    const t = (i + 0.5) / heights.length;
    const sx = left + t * w;
    const baseScale = CITY.h * proj.ppmY;
    const phaseShift = (c.id * 1.7 + i * 0.9) % 6.28;
    const hF = (heights[i] + 0.1 * Math.sin(phaseShift)) * baseScale;
    const sw = (w / heights.length) * 0.55;
    const bx0 = sx - sw / 2, bx1 = sx + sw / 2, by0 = baseY - hF;
    path(list, [[bx0, baseY], [bx0, by0], [bx1, by0], [bx1, baseY]], {
      color, hot, width: 2.0, hotWidth: 0.8,
    });
    if (hF > baseScale * 0.5) {
      list.dots.push({ x: sx, y: by0 + hF * 0.35, r: 1.4, color: hot, hot: WHITE, alpha: 0.65 });
    }
  }
}

// ===== Battery =====
const AMMO_ROWS = [1, 3, 3, 3, 3];     // holds up to 13 rounds

function emitBattery(list, b, proj, color, hot) {
  const cx = proj.sx(b.x);
  const baseY = proj.sy(b.y);
  const w = BATTERY.w * proj.ppmX;
  const h = BATTERY.h * proj.ppmY;

  if (!b.alive) {
    path(list, [[cx - w * 0.45, baseY], [cx + w * 0.45, baseY]], {
      color: RUBBLE, hot: RUBBLE_HOT, width: 2.0, hotWidth: 0.8,
    });
    path(list, [[cx, baseY], [cx, baseY - h * 0.3]], {
      color: STUMP, hot: STUMP_HOT, width: 1.8, hotWidth: 0.7,
    });
    return;
  }

  path(list, [
    [cx - w / 2, baseY],
    [cx - w * 0.30, baseY - h * 0.55],
    [cx + w * 0.30, baseY - h * 0.55],
    [cx + w / 2, baseY],
  ], { color, hot, width: 2.4, hotWidth: 1.0, closed: true });

  const turretTop = baseY - h * 0.55 - 18 * proj.ppmY * 0.6;
  path(list, [[cx, baseY - h * 0.55], [cx, turretTop]], {
    color, hot, width: 2.0, hotWidth: 0.8,
  });

  // Apex-up pyramid of rounds. Each dot carries a halo of ~3x its radius, so
  // the spacing has to clear that or the stack reads as one smear, not a count.
  const s = Math.max(0.8, Math.min(1.6, proj.ppmX));
  emitAmmoDots(list, cx, turretTop - 8 * s, b.ammo, color, hot, s);

  list.texts.push({
    text: b.label || '', x: cx, y: baseY + 16,
    size: 18, align: 'center', baseline: 'top', color, hot, alpha: 0.7,
  });
}

function emitAmmoDots(list, cx, bottomY, ammo, color, hot, s) {
  if (ammo <= 0) return;
  const r = 2.2 * s, dx = 10 * s, gap = 7.5 * s;

  let rowsUsed = 0;
  for (let acc = 0; acc < ammo && rowsUsed < AMMO_ROWS.length; rowsUsed++) {
    acc += AMMO_ROWS[rowsUsed];
  }
  const topY = bottomY - (rowsUsed - 1) * gap;

  let placed = 0;
  for (let row = 0; row < rowsUsed; row++) {
    const cnt = Math.min(AMMO_ROWS[row], ammo - placed);
    const startX = cx - ((AMMO_ROWS[row] - 1) * dx) / 2;
    const yy = topY + row * gap;
    for (let i = 0; i < cnt; i++) {
      // Tight halo: this stack is a *readout*, and at the default glow the
      // rounds bleed into one another instead of staying countable.
      list.dots.push({ x: startX + i * dx, y: yy, r, color, hot, alpha: 0.95, glow: 1.0 });
      placed += 1;
    }
  }
}

// ===== ICBM / MIRV / smart bomb =====
function emitIcbm(list, m, proj) {
  const sp = m.trail.map(([x, y]) => [proj.sx(x), proj.sy(y)]);
  sp.push([proj.sx(m.x), proj.sy(m.y)]);
  const smart = m.kind === 'smart';

  if (sp.length >= 2) {
    path(list, sp, {
      color: m.color.line, hot: m.color.hot,
      width: smart ? 2.6 : 2.2,
      hotWidth: smart ? 1.2 : 0.9,
      alpha: 0.85,
      // The trail is a dense breadcrumb polyline, not a shape with corners.
      noVertexDots: true,
    });
  }

  list.dots.push({
    x: proj.sx(m.x), y: proj.sy(m.y), r: smart ? 3.6 : 2.8,
    color: m.color.hot, hot: WHITE, alpha: 1,
  });

  if (smart) {
    const x = proj.sx(m.x), y = proj.sy(m.y), r = 6;
    path(list, [[x, y - r], [x + r, y], [x, y + r], [x - r, y]], {
      color: m.color.line, hot: m.color.hot,
      width: 1.6, hotWidth: 0.7, closed: true, alpha: 0.85,
    });
  }

  if (m.kind === 'mirv' && m.splitAt !== null) {
    // Expected split altitude, as a dashed rule. Emitted as real segments so
    // both back ends agree — setLineDash has no WebGL equivalent.
    const y = proj.sy(m.splitAt);
    for (let x = 0; x < proj.w; x += 10) {
      path(list, [[x, y], [Math.min(x + 4, proj.w), y]], {
        color: m.color.line, hot: m.color.line,
        width: 1.0, hotWidth: 0.5, alpha: 0.18, noVertexDots: true,
      });
    }
  }
}

// ===== Counter-missile =====
function emitCounter(list, c, proj, phos) {
  const ox = proj.sx(c.ox), oy = proj.sy(c.oy);
  const cx = proj.sx(c.x),  cy = proj.sy(c.y);
  path(list, [[ox, oy], [cx, cy]], {
    color: phos.line, hot: phos.hot, width: 2.0, hotWidth: 0.9, alpha: 0.95,
  });
  list.dots.push({ x: cx, y: cy, r: 3.4, color: phos.hot, hot: WHITE, alpha: 1 });

  // Faint marker at the commanded detonation point
  path(list, ellipsePts(proj.sx(c.tx), proj.sy(c.ty), 5, 5, 20), {
    color: phos.line, hot: phos.line,
    width: 1.0, hotWidth: 0.5, alpha: 0.35, closed: true, noVertexDots: true,
  });
}

// ===== Blast =====
function emitBlast(list, b, proj, phos) {
  const cx = proj.sx(b.x), cy = proj.sy(b.y);
  // Collision is a circle in WORLD units and the axes scale independently, so
  // the on-screen kill zone is an ellipse. Drawing a circle would show a radius
  // that doesn't match the one that actually kills, badly so on wide monitors.
  const rx = b.r * proj.ppmX;
  const ry = b.r * proj.ppmY;
  if (rx <= 0 || ry <= 0) return;

  // Phosphor-coloured, flickering against the brass accent while it holds.
  let col, hot;
  if (b.phase === 'grow') {
    col = phos.hot; hot = WHITE;
  } else if (b.phase === 'hold') {
    col = (Math.floor(b.t * 30) % 2) ? phos.mid : ACCENT;
    hot = WHITE;
  } else {
    col = phos.mid; hot = phos.hot;
  }

  const n = parseInt(phos.glow.slice(1), 16);
  list.glows.push({
    x: cx, y: cy, rx, ry,
    color: col,
    mid: `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0.25)`,
    alpha: b.phase === 'fade' ? 0.55 : 0.85,
  });

  path(list, ellipsePts(cx, cy, rx, ry, 48), {
    color: col, hot, width: 2.4, hotWidth: 1.0, alpha: 0.9,
    closed: true, noVertexDots: true,
  });
}

// ===== Particles =====
function emitParticles(list, parts, proj) {
  for (const p of parts) {
    const sx = proj.sx(p.x), sy = proj.sy(p.y);
    const norm = Math.hypot(p.vx, p.vy) || 1;
    // Streak trails the particle's motion; world y is already screen-down here.
    const tx = sx + (-p.vx / norm) * p.len;
    const ty = sy + (-p.vy / norm) * p.len;
    path(list, [[sx, sy], [tx, ty]], {
      color: p.color?.line || '#ff9a2a',
      hot:   p.color?.hot  || WHITE,
      width: 2.2, hotWidth: 0.9,
      alpha: Math.max(0, Math.min(1, p.life)),
      noVertexDots: true,
    });
  }
}

// ===== Killer satellite =====
function emitSat(list, s, proj) {
  const cx = proj.sx(s.x), cy = proj.sy(s.y);
  const col = ENEMY_COLOR.sat;
  const size = 12 * proj.ppmX;

  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    hex.push([cx + Math.cos(a) * size, cy + Math.sin(a) * size]);
  }
  path(list, hex, { color: col.line, hot: col.hot, closed: true, width: 2.0, hotWidth: 0.9 });

  for (const side of [-1, 1]) {
    path(list, [[cx + side * size, cy], [cx + side * size * 2.2, cy]], {
      color: col.line, hot: col.hot, width: 1.8, hotWidth: 0.7,
    });
    path(list, [[cx + side * size * 2.2, cy - 4], [cx + side * size * 2.2, cy + 4]], {
      color: col.line, hot: col.hot, width: 1.6, hotWidth: 0.6,
    });
  }
  path(list, [[cx, cy - size], [cx, cy - size - 6]], {
    color: col.line, hot: col.hot, width: 1.4, hotWidth: 0.6,
  });
  list.dots.push({ x: cx, y: cy - size - 6, r: 1.6, color: col.hot, hot: WHITE, alpha: 1 });
}

// ===== Bomber =====
function emitBomber(list, b, proj) {
  const cx = proj.sx(b.x), cy = proj.sy(b.y);
  const col = ENEMY_COLOR.bomber;
  const w = 22 * proj.ppmX;
  const h = 8 * proj.ppmY;
  const dir = Math.sign(b.vx) || 1;

  path(list, [
    [cx + dir * w, cy],
    [cx - dir * w * 0.2, cy - h],
    [cx - dir * w, cy],
    [cx - dir * w * 0.2, cy + h],
  ], { color: col.line, hot: col.hot, closed: true, width: 2.2, hotWidth: 1.0 });

  list.dots.push({ x: cx + dir * w * 0.4, y: cy, r: 1.8, color: col.hot, hot: WHITE, alpha: 1 });
  for (const side of [-1, 1]) {
    list.dots.push({
      x: cx - dir * w * 0.5, y: cy + side * h * 0.4, r: 1.2,
      color: '#ffd57a', hot: WHITE, alpha: 0.85,
    });
  }
}

// ===== Crosshair =====
function emitCrosshair(list, c, proj) {
  if (!c) return;
  const cx = proj.sx(c.x), cy = proj.sy(c.y);
  const r = 14;
  const arm = { color: ACCENT, hot: ACCENT_HOT, width: 1.6, hotWidth: 0.8, alpha: 1 };
  path(list, [[cx - r, cy], [cx - 4, cy]], arm);
  path(list, [[cx + 4, cy], [cx + r, cy]], arm);
  path(list, [[cx, cy - r], [cx, cy - 4]], arm);
  path(list, [[cx, cy + 4], [cx, cy + r]], arm);
  path(list, ellipsePts(cx, cy, 2, 2, 12), {
    color: ACCENT, hot: ACCENT_HOT, width: 1.4, hotWidth: 0.7,
    closed: true, noVertexDots: true,
  });
}
