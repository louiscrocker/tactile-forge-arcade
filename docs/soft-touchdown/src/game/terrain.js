// =====================================================
// Tactile Forge — Lunar Lander · Procedural lunar surface
// Generates a polyline of (x, y) points across WORLD_W,
// then plants flat landing pads with score multipliers.
// =====================================================

import { WORLD_W, LANDER } from './constants.js';

// Number of vertices in the surface polyline
const VERTS = 96;

// A pad the lander cannot straddle is unlandable, so every pad is widened to
// comfortably clear the footpads.
const MIN_PAD_W = LANDER.legSpan * 1.4;

/** Deterministic PRNG (mulberry32). */
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

/**
 * Build a layered-noise mountain skyline.
 * Returns an array of [x, y] vertices, x evenly spaced over WORLD_W.
 */
function buildHeights(rng, ampMul = 1) {
  const n = VERTS;
  const dx = WORLD_W / (n - 1);
  const heights = new Array(n).fill(0);
  // 4 octaves of cosine wiggle with random phase.
  // Frequencies are whole numbers so every layer completes an exact number of
  // cycles across the world width — the surface then meets itself at the
  // horizontal wrap seam instead of stepping by tens of metres.
  const layers = [
    { amp: 70, freq: 1 },
    { amp: 36, freq: 2 },
    { amp: 18, freq: 5 },
    { amp:  9, freq: 9 },
  ];
  const phases = layers.map(() => rng() * Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let h = 90;     // baseline height
    for (let li = 0; li < layers.length; li++) {
      const { amp, freq } = layers[li];
      const ph = phases[li];
      h += Math.sin(t * Math.PI * 2 * freq + ph) * amp * ampMul;
    }
    // Sprinkle small spikes
    h += (rng() - 0.5) * 6;
    if (h < 18) h = 18 + rng() * 6;
    heights[i] = h;
  }
  // The first and last vertices are the same world point either side of the
  // seam; the per-vertex jitter and the floor clamp would otherwise split them.
  heights[n - 1] = heights[0];
  // Build vertex array
  const pts = new Array(n);
  for (let i = 0; i < n; i++) pts[i] = [i * dx, heights[i]];
  return pts;
}

/**
 * Flatten a span of vertices to plant a landing pad.
 * Returns the pad descriptor.
 */
function plantPad(pts, centerIdx, halfWidthIdx, mult) {
  const lo = Math.max(1, centerIdx - halfWidthIdx);
  const hi = Math.min(pts.length - 2, centerIdx + halfWidthIdx);
  // Use the centerline height (or average if you prefer)
  const yPad = pts[centerIdx][1];
  for (let i = lo; i <= hi; i++) pts[i][1] = yPad;
  // Slightly re-grade neighbors to avoid sharp cliffs into the pad
  if (lo - 1 >= 0) pts[lo - 1][1] = (pts[lo - 1][1] + yPad) * 0.5;
  if (hi + 1 < pts.length) pts[hi + 1][1] = (pts[hi + 1][1] + yPad) * 0.5;
  return {
    xLo: pts[lo][0],
    xHi: pts[hi][0],
    y:   yPad,
    mult,
  };
}

/**
 * Generate a fresh terrain for a given site.
 * @param {number} site - 1-indexed site number (higher = harder)
 * @param {object} opts - { padScale, terrainAmp, rng? }
 */
export function generateTerrain(site, opts = {}) {
  const { padScale = 1, terrainAmp = 1 } = opts;
  // Seed mixes site + a bit of the date so each run differs
  const seed = (site * 9301 + Math.floor(Math.random() * 0xffffff)) >>> 0;
  const rng = opts.rng || mulberry32(seed);
  const pts = buildHeights(rng, terrainAmp);
  const dx = WORLD_W / (pts.length - 1);

  // Pad widths in meters (scaled by difficulty + harder per site).
  // The shrink is capped: past roughly a third, the high-multiplier pads stop
  // being landable at all rather than merely demanding.
  const harden = Math.min(0.35, 0.06 * (site - 1));
  const widths = [
    { mult: 2, w: 80 * padScale * (1 - harden) },
    { mult: 3, w: 50 * padScale * (1 - harden) },
    { mult: 4, w: 36 * padScale * (1 - harden) },
    { mult: 5, w: 22 * padScale * (1 - harden) },
  ];
  // For higher sites drop the easy x2
  const padPlan = site >= 3 ? widths.slice(1) : widths;

  // Divide the surface into one slot per pad. Each pad — including the
  // re-graded shoulder either side — is confined to its own slot, which
  // guarantees every pad gets placed and that none can overlap another.
  // Slots stop short of both ends so no pad straddles the wrap seam.
  const loIdx  = 10;
  const hiIdx  = pts.length - 11;
  const slotW  = (hiIdx - loIdx) / padPlan.length;
  const maxHalf = Math.max(2, Math.floor(slotW / 2) - 1);

  // Deal the multipliers to slots in a random order, so the high-value pad
  // isn't always in the same part of the map.
  const order = padPlan.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const pads = [];
  order.forEach((specIdx, slot) => {
    const spec = padPlan[specIdx];
    const halfW = Math.min(
      maxHalf,
      Math.max(2, Math.round((Math.max(MIN_PAD_W, spec.w) / 2) / dx)),
    );
    const slotLo = loIdx + slotW * slot;
    const cMin = Math.ceil(slotLo + halfW + 1);
    const cMax = Math.floor(slotLo + slotW - halfW - 1);

    // Prefer the most approachable spot in the slot — a pad at the bottom of a
    // steep bowl is technically flat but impossible to fly into.
    let best = cMin, bestWall = Infinity;
    for (let idx = cMin; idx <= cMax; idx++) {
      const left  = pts[Math.max(0, idx - halfW - 4)][1];
      const right = pts[Math.min(pts.length - 1, idx + halfW + 4)][1];
      const wall  = Math.max(left, right) - pts[idx][1];
      if (wall < bestWall) { bestWall = wall; best = idx; }
    }
    pads.push(plantPad(pts, best, halfW, spec.mult));
  });

  pads.sort((a, b) => a.xLo - b.xLo);
  return { pts, pads };
}

/**
 * Sample terrain height at a given world x, with linear interpolation
 * between vertices. Wraps x into [0, WORLD_W).
 */
export function sampleHeight(terrain, x) {
  const pts = terrain.pts;
  let xx = x % WORLD_W;
  if (xx < 0) xx += WORLD_W;
  const dx = WORLD_W / (pts.length - 1);
  const idx = Math.floor(xx / dx);
  const i0 = idx;
  const i1 = (idx + 1) % pts.length;
  const t = (xx - i0 * dx) / dx;
  return pts[i0][1] * (1 - t) + pts[i1][1] * t;
}

/** Return the pad covering this x, or null. */
export function padAt(terrain, x) {
  let xx = x % WORLD_W;
  if (xx < 0) xx += WORLD_W;
  for (const p of terrain.pads) {
    if (xx >= p.xLo && xx <= p.xHi) return p;
  }
  return null;
}
