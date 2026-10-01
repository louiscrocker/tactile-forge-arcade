// =====================================================
// Tactile Forge — Tank Battle · Battlefield generation
// Procedural placement of pyramid + cube obstacles on the
// XZ ground plane, and a static distant mountain silhouette
// for the horizon backdrop.
// =====================================================

import { WORLD_R, OBSTACLES } from './constants.js';

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

/** Returns { obstacles: [...], mountains: [polyline of [angleRad, heightFrac]] } */
export function generateField(seed = 1, playerX = 0, playerZ = 0) {
  const rng = mulberry32(seed >>> 0);
  const obstacles = [];

  // Helper: pick a free spot ≥ minSpawnDist from player and from any existing obstacle
  function placeOne(kind, baseR) {
    for (let attempts = 0; attempts < 30; attempts++) {
      const ang = rng() * Math.PI * 2;
      const dist = OBSTACLES.minSpawnDist + rng() * (WORLD_R - OBSTACLES.minSpawnDist - 10);
      const x = playerX + Math.cos(ang) * dist;
      const z = playerZ + Math.sin(ang) * dist;
      const r = baseR * (0.85 + rng() * 0.5);
      let collides = false;
      for (const o of obstacles) {
        const dx = o.x - x, dz = o.z - z;
        if (Math.hypot(dx, dz) < (o.r + r + 4)) { collides = true; break; }
      }
      if (!collides) {
        obstacles.push({ kind, x, z, r, rotY: rng() * Math.PI * 2 });
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < OBSTACLES.pyramidCount; i++) placeOne('pyramid', OBSTACLES.pyramidR);
  for (let i = 0; i < OBSTACLES.cubeCount; i++)    placeOne('cube',    OBSTACLES.cubeR);

  // Mountain silhouette as a polyline of heights around the full 360°.
  // We sample every ~3° and produce a low-frequency profile.
  const N = 120;
  const mountains = new Array(N);
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    let h = 0;
    h += Math.sin(ang * 1.0 + rng() * 0.3) * 0.30;
    h += Math.sin(ang * 2.3 + rng() * 0.5) * 0.18;
    h += Math.sin(ang * 5.7 + rng() * 0.7) * 0.08;
    mountains[i] = [ang, Math.max(0.05, 0.12 + h)];
  }

  return { obstacles, mountains, seed };
}
