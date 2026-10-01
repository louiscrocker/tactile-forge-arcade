// =====================================================
// Tactile Forge — Missile Attack · Skyline polyline
// A gentle horizon polyline anchoring the cities. Less amplitude
// than Lunar Lander — mostly flat with mild dunes.
// =====================================================

import { WORLD_W, GROUND_Y } from './constants.js';

const VERTS = 80;

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a gentle horizon polyline. y values are in world coords (CSS y). */
export function generateSkyline(seed = 1) {
  const rng = mulberry32(seed >>> 0);
  const layers = [
    { amp: 14, freq: 0.7 },
    { amp:  7, freq: 1.9 },
    { amp:  3, freq: 4.3 },
  ];
  const phases = layers.map(() => rng() * Math.PI * 2);
  const dx = WORLD_W / (VERTS - 1);
  const pts = new Array(VERTS);
  for (let i = 0; i < VERTS; i++) {
    const t = i / (VERTS - 1);
    let off = 0;
    for (let li = 0; li < layers.length; li++) {
      const { amp, freq } = layers[li];
      off += Math.sin(t * Math.PI * 2 * freq + phases[li]) * amp;
    }
    pts[i] = [i * dx, GROUND_Y + off];
  }
  return pts;
}

/** Sample skyline y at a given world x (linear interp; clamps to edges). */
export function sampleSkyline(pts, x) {
  const dx = WORLD_W / (pts.length - 1);
  if (x <= 0) return pts[0][1];
  if (x >= WORLD_W) return pts[pts.length - 1][1];
  const idx = Math.floor(x / dx);
  const t = (x - idx * dx) / dx;
  return pts[idx][1] * (1 - t) + pts[idx + 1][1] * t;
}
