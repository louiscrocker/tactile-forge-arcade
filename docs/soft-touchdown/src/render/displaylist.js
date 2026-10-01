// =====================================================
// Tactile Forge — Lunar Lander · Scene display list
//
// Turns game state into renderer-agnostic geometry in screen space. Both the
// Canvas 2D and the WebGL back ends consume this same list, so they draw
// provably the same picture and only differ in how the beam is shaded.
//
// Screen space: pixels, origin top-left, y down (world y is up — the flip
// happens here and nowhere else).
// =====================================================

import { WORLD_W, LANDER } from '../game/constants.js';

const ACCENT      = '#ffe04a';
const ACCENT_HOT  = '#ffffff';
const FLAME       = '#ffd57a';
const FLAME_INNER = '#fff5b8';
const WHITE       = '#ffffff';
const EXPLOSION   = '#ff9a2a';

/** Projection from world metres to screen pixels. */
export function makeProj(w, h, visH) {
  return {
    w, h,
    sx: (x) => (x / WORLD_W) * w,
    sy: (y) => h - (y / visH) * h,
  };
}

/**
 * Build the frame's display list.
 * @returns {{
 *   w:number, h:number, bg0:string, bg1:string, flash:number,
 *   hatch:Array, paths:Array, dots:Array, texts:Array
 * }}
 */
export function buildScene(g, phos, proj) {
  const color = phos.line, hot = phos.hot;
  const list = {
    w: proj.w,
    h: proj.h,
    bg0: phos.bg0,
    bg1: phos.bg1,
    flash: g.flashTimer > 0 ? 0.5 * g.flashTimer / 0.4 : 0,
    hatch: [],
    paths: [],
    dots: [],
    texts: [],
  };

  emitTerrain(list, g.terrain, proj, color, hot);
  emitPads(list, g.terrain, proj);

  if (g.siteState !== 'crashed') {
    emitLander(list, g.lander, g.thrustOn, proj, color, hot);
    // Mirrored copies so the lander stays visible across the wrap seam.
    if (g.lander.x < 80) {
      emitLander(list, { ...g.lander, x: g.lander.x + WORLD_W }, g.thrustOn, proj, color, hot);
    }
    if (g.lander.x > WORLD_W - 80) {
      emitLander(list, { ...g.lander, x: g.lander.x - WORLD_W }, g.thrustOn, proj, color, hot);
    }
  }

  emitDust(list, g.dustParts, proj, hot);
  emitExplosion(list, g.explosionParts, proj);

  list.texts.push({
    text: `SITE ${String(g.site).padStart(2, '0')}`,
    x: proj.w - 14, y: proj.h - 12,
    size: 16, align: 'right', baseline: 'bottom', color, hot, alpha: 0.55,
  });
  list.texts.push({
    text: `STREAK ×${g.streak}`,
    x: 14, y: proj.h - 12,
    size: 16, align: 'left', baseline: 'bottom', color, hot, alpha: 0.55,
  });

  return list;
}

function path(list, pts, opts) {
  list.paths.push({
    pts,
    closed: false,
    width: 2.6,
    hotWidth: 1.0,
    alpha: 1,
    ...opts,
  });
}

// ===== Terrain polyline + ground hatching =====
function emitTerrain(list, terrain, proj, color, hot) {
  if (!terrain) return;
  const sp = terrain.pts.map(([x, y]) => [proj.sx(x), proj.sy(y)]);

  // Vertical hatch from every Nth surface vertex down to the bottom edge.
  const step = 3;
  for (let i = 0; i < sp.length; i += step) {
    list.hatch.push({ x: sp[i][0], y0: sp[i][1], y1: proj.h, color, alpha: 0.12 });
  }

  path(list, sp, { color, hot, width: 2.4, hotWidth: 1.0 });
}

// ===== Landing pads + multiplier labels =====
function emitPads(list, terrain, proj) {
  if (!terrain) return;
  for (const pad of terrain.pads) {
    const ax = proj.sx(pad.xLo);
    const bx = proj.sx(pad.xHi);
    const py = proj.sy(pad.y);

    path(list, [[ax, py], [bx, py]], {
      color: ACCENT, hot: ACCENT_HOT, width: 3.6, hotWidth: 1.4,
    });
    path(list, [[ax, py], [ax, py + 8]], {
      color: ACCENT, hot: ACCENT_HOT, width: 1.6, hotWidth: 0.6,
    });
    path(list, [[bx, py], [bx, py + 8]], {
      color: ACCENT, hot: ACCENT_HOT, width: 1.6, hotWidth: 0.6,
    });

    list.texts.push({
      text: `×${pad.mult}`,
      x: (ax + bx) / 2, y: py - 10,
      size: 18, align: 'center', baseline: 'bottom',
      color: ACCENT, hot: ACCENT_HOT, alpha: 1,
    });
  }
}

// ===== Lander =====
// Built in a local frame (metres, +x right, +y up), rotated into world space,
// then projected. Clockwise rotation matches the engine's force equation
// (ax = sin·T, ay = cos·T - g), so +angle leans the lander right.
function emitLander(list, lander, thrustOn, proj, color, hot) {
  const bw = LANDER.bodyW / 2;
  const bh = LANDER.bodyH / 2;
  const ls = LANDER.legSpan / 2;
  const ld = LANDER.legDrop;
  const bd = LANDER.bellDrop;

  const cosA = Math.cos(lander.angle);
  const sinA = Math.sin(lander.angle);
  const lx = lander.x, ly = lander.y;
  const toWorld = ([x, y]) => [lx + x * cosA + y * sinA, ly - x * sinA + y * cosA];
  const tx = (pts) => pts.map((p) => {
    const [wx, wy] = toWorld(p);
    return [proj.sx(wx), proj.sy(wy)];
  });

  // Thrust flame first, so it sits under the hull lines.
  if (thrustOn) {
    const flicker = 0.7 + Math.random() * 0.4;
    const flameLen = (5 + Math.random() * 4) * flicker;
    path(list, tx([
      [-3.2, -bh - bd], [3.2, -bh - bd], [0, -bh - bd - flameLen],
    ]), { color: FLAME, hot: WHITE, closed: true, width: 3.2, hotWidth: 1.4, alpha: 0.9 * flicker });
    path(list, tx([
      [-1.4, -bh - bd], [1.4, -bh - bd], [0, -bh - bd - flameLen * 0.6],
    ]), { color: FLAME_INNER, hot: WHITE, closed: true, width: 2.0, hotWidth: 0.9, alpha: 0.95 });
  }

  // Hull octagon (descent stage)
  path(list, tx([
    [-bw, -bh + 2], [-bw + 2, -bh], [bw - 2, -bh], [bw, -bh + 2],
    [bw, bh - 4], [bw - 4, bh], [-bw + 4, bh], [-bw, bh - 4],
  ]), { color, hot, closed: true, width: 2.4, hotWidth: 1.0 });

  // Ascent stage (upper module)
  path(list, tx([
    [-bw + 4, bh], [-bw + 4, bh + 5], [-bw + 7, bh + 8],
    [bw - 7, bh + 8], [bw - 4, bh + 5], [bw - 4, bh],
  ]), { color, hot, closed: true, width: 2.0, hotWidth: 0.8 });

  // Engine bell
  path(list, tx([
    [-3, -bh], [-5, -bh - bd], [5, -bh - bd], [3, -bh],
  ]), { color, hot, closed: true, width: 2.0, hotWidth: 0.8 });

  // Cabin window hint
  path(list, tx([
    [-2, bh + 5], [2, bh + 5], [2, bh + 7], [-2, bh + 7],
  ]), { color, hot, closed: true, width: 1.6, hotWidth: 0.6, alpha: 0.7 });

  // Legs: strut + footpad, left and right
  for (const side of [-1, 1]) {
    const strut = tx([[side * (bw - 2), -bh + 2], [side * ls, -bh - ld]]);
    const foot  = tx([[side * (ls - 4), -bh - ld + 1], [side * (ls + 4), -bh - ld + 1]]);
    path(list, strut, { color, hot, width: 2.0, hotWidth: 0.8 });
    path(list, foot,  { color, hot, width: 2.4, hotWidth: 1.0 });
  }
}

// ===== Particles =====
function emitDust(list, parts, proj, hot) {
  for (const p of parts) {
    list.dots.push({
      x: proj.sx(p.x), y: proj.sy(p.y), r: 1.4,
      color: hot, hot: WHITE,
      alpha: Math.max(0, Math.min(1, p.life)),
    });
  }
}

function emitExplosion(list, parts, proj) {
  for (const p of parts) {
    const sx = proj.sx(p.x), sy = proj.sy(p.y);
    // Streak trails the particle's motion; screen y inverts world y.
    const norm = Math.hypot(p.vx, p.vy) || 1;
    const ex = sx + (-p.vx / norm) * p.len;
    const ey = sy - (-p.vy / norm) * p.len;
    path(list, [[sx, sy], [ex, ey]], {
      color: EXPLOSION, hot: WHITE, width: 2.4, hotWidth: 1.0,
      alpha: Math.max(0, Math.min(1, p.life)),
    });
  }
}
