// =====================================================
// Tactile Forge — Tank Battle · Scene renderer
// First-person wireframe view: horizon, mountains,
// pyramid + cube obstacles, enemy tanks, saucers, shells,
// crosshair reticle, radar overlay, periscope chrome.
// =====================================================

import { beamPath, beamLine, beamDot, beamText, beamCircle } from './vector.js';
import {
  WORLD_R, TANK, CAMERA, PLAYER, ENEMY, ENEMY_COLOR,
} from '../game/constants.js';

const NEAR = CAMERA.near;
const FAR  = CAMERA.far;

// ===== Camera projection =====
function makeCamera(canvas, player) {
  const w = canvas._logicalW || canvas.clientWidth || canvas.width;
  const h = canvas._logicalH || canvas.clientHeight || canvas.height;
  const focal = (h * 0.5) / Math.tan(CAMERA.fov / 2);
  const horizonY = h * CAMERA.horizonY;
  return {
    w, h, focal, horizonY,
    x: player.x, z: player.z, eyeY: CAMERA.eyeY,
    cosH: Math.cos(player.heading),
    sinH: Math.sin(player.heading),
    heading: player.heading,
  };
}

function toCam(wx, wy, wz, cam) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  const dy = wy - cam.eyeY;
  const cx =  dx * cam.cosH - dz * cam.sinH;
  const cz =  dx * cam.sinH + dz * cam.cosH;
  return { cx, cy: dy, cz };
}
function project(p, cam) {
  return {
    sx: cam.w / 2 + (p.cx / p.cz) * cam.focal,
    sy: cam.horizonY - (p.cy / p.cz) * cam.focal,
    cz: p.cz,
  };
}

// Clip a line to the near plane and return 2 screen points (or null if fully clipped).
function clipAndProject(p1, p2, cam) {
  let a = p1, b = p2;
  if (a.cz < NEAR && b.cz < NEAR) return null;
  if (a.cz < NEAR || b.cz < NEAR) {
    const t = (NEAR - a.cz) / (b.cz - a.cz);
    const nx = a.cx + t * (b.cx - a.cx);
    const ny = a.cy + t * (b.cy - a.cy);
    const clipped = { cx: nx, cy: ny, cz: NEAR };
    if (a.cz < NEAR) a = clipped;
    else b = clipped;
  }
  // Far culling
  if (a.cz > FAR && b.cz > FAR) return null;
  return [project(a, cam), project(b, cam)];
}

function drawWorldLine(ctx, cam, x1, y1, z1, x2, y2, z2, opts) {
  const a = toCam(x1, y1, z1, cam);
  const b = toCam(x2, y2, z2, cam);
  const pr = clipAndProject(a, b, cam);
  if (!pr) return;
  beamLine(ctx, pr[0].sx, pr[0].sy, pr[1].sx, pr[1].sy, opts);
}

// ===== Public entry =====
export function drawScene(ctx, canvas, g, phos) {
  const cam = makeCamera(canvas, g.player);
  const { w, h } = cam;
  const color = phos.line, hot = phos.hot;

  // ===== Sky / void =====
  ctx.save();
  const skyGrad = ctx.createLinearGradient(0, 0, 0, cam.horizonY);
  skyGrad.addColorStop(0, '#000402');
  skyGrad.addColorStop(1, '#000c06');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, cam.horizonY);
  // ===== Ground band =====
  const grdGrad = ctx.createLinearGradient(0, cam.horizonY, 0, h);
  grdGrad.addColorStop(0, '#001509');
  grdGrad.addColorStop(1, '#000604');
  ctx.fillStyle = grdGrad;
  ctx.fillRect(0, cam.horizonY, w, h - cam.horizonY);
  ctx.restore();

  // ===== Crash flash overlay =====
  if (g.flashTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 70, 70, ${0.4 * g.flashTimer / 0.5})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ===== Distant mountains (horizon polyline) =====
  drawMountains(ctx, cam, g.field.mountains, color, hot);

  // ===== Horizon line =====
  beamLine(ctx, 0, cam.horizonY, w, cam.horizonY, {
    color, hot, width: 2.0, hotWidth: 0.8, alpha: 0.85,
  });

  // ===== Ground grid (radial + concentric, gives speed cues) =====
  drawGroundGrid(ctx, cam, color);

  // ===== Sort drawables by distance, far → near =====
  const drawables = [];
  for (const o of g.field.obstacles) {
    const dx = o.x - cam.x, dz = o.z - cam.z;
    drawables.push({ d2: dx*dx + dz*dz, kind: 'obstacle', ref: o });
  }
  for (const e of g.enemies) {
    const dx = e.x - cam.x, dz = e.z - cam.z;
    drawables.push({ d2: dx*dx + dz*dz, kind: 'enemy', ref: e });
  }
  drawables.sort((a, b) => b.d2 - a.d2);

  for (const d of drawables) {
    if (d.kind === 'obstacle') drawObstacle(ctx, cam, d.ref, color, hot);
    else                       drawEnemy(ctx, cam, d.ref, color, hot);
  }

  // ===== Shells =====
  for (const s of g.shells) drawShell(ctx, cam, s);

  // ===== Particles (short streaks) =====
  for (const p of g.particles) drawParticle(ctx, cam, p);

  // ===== Player chrome: periscope reticle + dashboard ring =====
  drawPeriscope(ctx, cam, color, hot, g);
  drawCrosshair(ctx, cam, color, hot, g);
  drawRadar(ctx, cam, g, color, hot);

  // ===== Phase / status text overlays =====
  if (g.betweenWaves) {
    beamText(ctx, 'SECTOR CLEAR · STAND BY', w / 2, h * 0.30, {
      color, hot, size: 28, align: 'center', baseline: 'middle', alpha: 0.85,
    });
  }
  if (g.player.dead) {
    beamText(ctx, 'TANK LOST', w / 2, h * 0.36, {
      color: '#ff5a64', hot: '#ffd4d8',
      size: 44, align: 'center', baseline: 'middle', alpha: 0.95,
    });
    if (g.player.lives > 0) {
      beamText(ctx, 'STAND BY · NEXT TANK ROLLING', w / 2, h * 0.44, {
        color, hot, size: 18, align: 'center', baseline: 'middle', alpha: 0.7,
      });
    }
  }
}

// ===== Distant mountains =====
function drawMountains(ctx, cam, mountains, color, hot) {
  if (!mountains || mountains.length === 0) return;
  // Sample heights at points around the player, projected to screen.
  // Use a fixed far radius so they always feel distant.
  const R = WORLD_R * 1.8;
  const baseY = cam.horizonY;
  const ptsTop = [];
  const N = mountains.length;
  const step = Math.PI * 2 / N;
  // We render across the screen by mapping bearings relative to the camera heading.
  // Bearing of camera-forward is +π/2 in atan2(x,z) convention; we walk all bearings
  // and project the world point at that bearing onto the screen.
  for (let i = 0; i <= N; i++) {
    const idx = i % N;
    const ang = mountains[idx][0];          // world angle (atan2(z,x))
    const hF  = mountains[idx][1];          // height fraction
    const wx  = cam.x + Math.cos(ang) * R;
    const wz  = cam.z + Math.sin(ang) * R;
    const peakY = hF * 60;                  // 60m tall mountains
    const top  = toCam(wx, peakY, wz, cam);
    if (top.cz < NEAR) continue;
    const sx = cam.w / 2 + (top.cx / top.cz) * cam.focal;
    const sy = cam.horizonY - (top.cy / top.cz) * cam.focal;
    ptsTop.push([sx, sy]);
  }
  if (ptsTop.length < 2) return;
  // Sort by screen-x so the polyline is monotonic
  ptsTop.sort((a, b) => a[0] - b[0]);
  // Draw the silhouette polyline
  beamPath(ctx, ptsTop, {
    color, hot, width: 1.6, hotWidth: 0.7, alpha: 0.55,
  });
}

// ===== Ground grid =====
function drawGroundGrid(ctx, cam, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.10;
  ctx.lineWidth = 1;

  // Concentric rings ahead of the camera (perspective).
  for (const r of [12, 24, 40, 60, 100, 160, 240]) {
    drawGroundRing(ctx, cam, r);
  }
  // Radial lines fanning forward.
  for (let i = -3; i <= 3; i++) {
    const ang = i * (Math.PI / 12);
    drawGroundRay(ctx, cam, ang, 280);
  }
  ctx.restore();
}
function drawGroundRing(ctx, cam, r) {
  const STEPS = 28;
  let prev = null;
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    const wx = cam.x + Math.cos(a) * r;
    const wz = cam.z + Math.sin(a) * r;
    const cp = toCam(wx, 0, wz, cam);
    if (cp.cz < NEAR) { prev = null; continue; }
    const sx = cam.w / 2 + (cp.cx / cp.cz) * cam.focal;
    const sy = cam.horizonY - (cp.cy / cp.cz) * cam.focal;
    if (prev) {
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    prev = [sx, sy];
  }
}
function drawGroundRay(ctx, cam, headingOffset, length) {
  // Ray relative to camera heading, on ground, length out
  const ang = cam.heading + headingOffset;
  const x1 = cam.x + Math.sin(ang) * 4;
  const z1 = cam.z + Math.cos(ang) * 4;
  const x2 = cam.x + Math.sin(ang) * length;
  const z2 = cam.z + Math.cos(ang) * length;
  const a = toCam(x1, 0, z1, cam), b = toCam(x2, 0, z2, cam);
  const pr = clipAndProject(a, b, cam);
  if (!pr) return;
  ctx.beginPath();
  ctx.moveTo(pr[0].sx, pr[0].sy);
  ctx.lineTo(pr[1].sx, pr[1].sy);
  ctx.stroke();
}

// ===== Obstacles =====
function drawObstacle(ctx, cam, o, color, hot) {
  if (o.kind === 'pyramid') drawPyramid(ctx, cam, o, color, hot);
  else                      drawCube(ctx, cam, o, color, hot);
}

function drawPyramid(ctx, cam, o, color, hot) {
  const r = o.r;
  const h = r * 1.4;
  const cosR = Math.cos(o.rotY), sinR = Math.sin(o.rotY);
  // 4 base corners
  const base = [
    [ r,  r], [ r, -r], [-r, -r], [-r,  r],
  ].map(([dx, dz]) => [
    o.x + dx * cosR - dz * sinR,
    o.z + dx * sinR + dz * cosR,
  ]);
  const apex = [o.x, o.z];
  const apexY = h;

  const opt = { color, hot, width: 2.4, hotWidth: 1.0, alpha: 0.92 };

  // Base square
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = base[i];
    const [x2, z2] = base[(i + 1) % 4];
    drawWorldLine(ctx, cam, x1, 0, z1, x2, 0, z2, opt);
  }
  // Sides up to apex
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = base[i];
    drawWorldLine(ctx, cam, x1, 0, z1, apex[0], apexY, apex[1], opt);
  }
}

function drawCube(ctx, cam, o, color, hot) {
  const r = o.r;
  const h = r * 1.7;
  const cosR = Math.cos(o.rotY), sinR = Math.sin(o.rotY);
  const corners = [
    [-r, 0, -r], [ r, 0, -r], [ r, 0,  r], [-r, 0,  r],
    [-r, h, -r], [ r, h, -r], [ r, h,  r], [-r, h,  r],
  ].map(([dx, dy, dz]) => [
    o.x + dx * cosR - dz * sinR,
    dy,
    o.z + dx * sinR + dz * cosR,
  ]);
  const edges = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  const opt = { color, hot, width: 2.4, hotWidth: 1.0, alpha: 0.92 };
  for (const [a, b] of edges) {
    const [x1, y1, z1] = corners[a];
    const [x2, y2, z2] = corners[b];
    drawWorldLine(ctx, cam, x1, y1, z1, x2, y2, z2, opt);
  }
}

// ===== Enemy tank / super / saucer =====
function drawEnemy(ctx, cam, e, color, hot) {
  if (e.kind === 'saucer') {
    drawSaucer(ctx, cam, e);
    return;
  }
  drawTankWire(ctx, cam, e.x, e.z, e.heading,
    e.kind === 'super' ? ENEMY_COLOR.super : ENEMY_COLOR.tank);
}

function drawTankWire(ctx, cam, tx, tz, heading, col) {
  // Tank box-on-treads + turret + barrel.
  const hw = TANK.hullW * 0.5;
  const hl = TANK.hullL * 0.5;
  const hh = TANK.hullH;
  const cosH = Math.cos(heading), sinH = Math.sin(heading);

  // Helper: tank-local (x, y, z) → world
  function lw(lx, ly, lz) {
    return [
      tx + lx * cosH - lz * sinH,
      ly,
      tz + lx * sinH + lz * cosH,
    ];
  }

  const opt = { color: col.line, hot: col.hot, width: 2.4, hotWidth: 1.0, alpha: 0.95 };

  // Hull box (8 corners)
  const hullPts = [
    [-hw, 0, -hl],[ hw, 0, -hl],[ hw, 0,  hl],[-hw, 0,  hl],
    [-hw, hh, -hl],[ hw, hh, -hl],[ hw, hh,  hl],[-hw, hh,  hl],
  ].map(([x, y, z]) => lw(x, y, z));
  const hullEdges = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  for (const [a, b] of hullEdges) {
    const [x1, y1, z1] = hullPts[a];
    const [x2, y2, z2] = hullPts[b];
    drawWorldLine(ctx, cam, x1, y1, z1, x2, y2, z2, opt);
  }

  // Turret octagon at hh + turretH
  const tR = TANK.turretR;
  const tH = hh + TANK.turretH;
  const turretPts = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    turretPts.push(lw(Math.cos(a) * tR, tH, Math.sin(a) * tR));
  }
  for (let i = 0; i < N; i++) {
    const [x1, y1, z1] = turretPts[i];
    const [x2, y2, z2] = turretPts[(i + 1) % N];
    drawWorldLine(ctx, cam, x1, y1, z1, x2, y2, z2, opt);
  }
  // Vertical posts at 4 corners of turret
  for (let i = 0; i < 8; i += 2) {
    const [x1, y1, z1] = turretPts[i];
    const [bx, , bz] = lw(Math.cos((i / N) * Math.PI * 2) * tR, hh, Math.sin((i / N) * Math.PI * 2) * tR);
    drawWorldLine(ctx, cam, x1, y1, z1, bx, hh, bz, opt);
  }

  // Barrel forward
  const bx0 = lw(0, tH - 0.05, 0);
  const bx1 = lw(0, tH - 0.05, TANK.barrelL);
  drawWorldLine(ctx, cam, bx0[0], bx0[1], bx0[2], bx1[0], bx1[1], bx1[2], {
    ...opt, width: 3.4, hotWidth: 1.6,
  });
}

function drawSaucer(ctx, cam, e) {
  // Saucer body: ellipse outline at altitude e.y, with bobbing
  const bob = Math.sin(e.bob * 4) * 0.4;
  const cy = e.y + bob;
  const r  = ENEMY.saucer.radius;

  // Approximate the ellipse with a polygon in 3D (XZ plane disc with slight Z tilt)
  const N = 14;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wx = e.x + Math.cos(a) * r;
    const wz = e.z + Math.sin(a) * r * 0.55;       // ellipse
    const cp = toCam(wx, cy, wz, cam);
    if (cp.cz < NEAR) { prev = null; continue; }
    const sx = cam.w / 2 + (cp.cx / cp.cz) * cam.focal;
    const sy = cam.horizonY - (cp.cy / cp.cz) * cam.focal;
    if (prev) {
      beamLine(ctx, prev[0], prev[1], sx, sy, {
        color: ENEMY_COLOR.saucer.line, hot: ENEMY_COLOR.saucer.hot,
        width: 2.4, hotWidth: 1.0, alpha: 0.92,
      });
    }
    prev = [sx, sy];
  }
  // Dome on top
  const N2 = 10;
  const dr = r * 0.55;
  let prev2 = null;
  for (let i = 0; i <= N2; i++) {
    const a = (i / N2) * Math.PI;
    const wx = e.x + Math.cos(a) * dr;
    const dy = cy + Math.sin(a) * dr * 0.7;
    const wz = e.z;
    const cp = toCam(wx, dy, wz, cam);
    if (cp.cz < NEAR) { prev2 = null; continue; }
    const sx = cam.w / 2 + (cp.cx / cp.cz) * cam.focal;
    const sy = cam.horizonY - (cp.cy / cp.cz) * cam.focal;
    if (prev2) {
      beamLine(ctx, prev2[0], prev2[1], sx, sy, {
        color: ENEMY_COLOR.saucer.line, hot: ENEMY_COLOR.saucer.hot,
        width: 2.0, hotWidth: 0.9, alpha: 0.92,
      });
    }
    prev2 = [sx, sy];
  }
}

// ===== Shell =====
function drawShell(ctx, cam, s) {
  const cp = toCam(s.x, s.y, s.z, cam);
  if (cp.cz < NEAR) return;
  const sx = cam.w / 2 + (cp.cx / cp.cz) * cam.focal;
  const sy = cam.horizonY - (cp.cy / cp.cz) * cam.focal;
  // Size scales with proximity
  const r = Math.max(2, Math.min(8, 60 / cp.cz));
  const col = s.owner === 'player'
    ? { color: '#ffe04a', hot: '#ffffff' }
    : { color: ENEMY_COLOR.tank.hot, hot: '#ffffff' };
  beamDot(ctx, sx, sy, r, { color: col.color, hot: col.hot, alpha: 0.95 });
}

// ===== Particle (a short streak in the direction of motion) =====
function drawParticle(ctx, cam, p) {
  const head = toCam(p.x, p.y, p.z, cam);
  const tail = toCam(p.x - p.vx * 0.04, p.y - p.vy * 0.04, p.z - p.vz * 0.04, cam);
  const pr = clipAndProject(head, tail, cam);
  if (!pr) return;
  const a = Math.max(0, p.life);
  beamLine(ctx, pr[0].sx, pr[0].sy, pr[1].sx, pr[1].sy, {
    color: p.color?.line || '#ff9a2a',
    hot:   p.color?.hot  || '#ffffff',
    width: 2.0, hotWidth: 0.9, alpha: a,
  });
}

// ===== Periscope chrome (player tank dashboard at bottom of screen) =====
function drawPeriscope(ctx, cam, color, hot, g) {
  const w = cam.w, h = cam.h;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Dashboard arc at the bottom
  const cx = w / 2;
  const cy = h + h * 0.55;
  const r  = h * 1.0;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Heading tape across the top of the dashboard arc
  const tapeY = cam.horizonY + h * 0.36;
  const tapeW = w * 0.42;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - tapeW / 2, tapeY);
  ctx.lineTo(cx + tapeW / 2, tapeY);
  ctx.stroke();

  // Tick marks every 15°
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  const totalRad = Math.PI;       // tape spans 180° of bearings
  const pxPerRad = tapeW / totalRad;
  const headingDeg = (g.player.heading * 180 / Math.PI + 720) % 360;
  for (let bd = 0; bd < 360; bd += 15) {
    // Relative bearing from player heading
    let rel = bd - headingDeg;
    while (rel >  180) rel -= 360;
    while (rel < -180) rel += 360;
    if (Math.abs(rel) > 90) continue;
    const tx = cx + (rel * Math.PI / 180) * pxPerRad;
    const big = (bd % 90 === 0);
    ctx.beginPath();
    ctx.moveTo(tx, tapeY);
    ctx.lineTo(tx, tapeY + (big ? 8 : 5));
    ctx.stroke();
    if (big) {
      const lbl = bd === 0 ? 'N' : bd === 90 ? 'E' : bd === 180 ? 'S' : 'W';
      ctx.fillStyle = hot;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.font = '12px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, tx, tapeY + 22);
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}

// ===== Crosshair (center of view) =====
function drawCrosshair(ctx, cam, color, hot, g) {
  const cx = cam.w / 2;
  const cy = cam.horizonY;
  const r  = 18;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#ffe04a';
  ctx.shadowColor = 'rgba(255, 224, 74, .6)';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.6;
  // Open cross with center gap
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + r);
  ctx.stroke();
  // Center pip
  ctx.beginPath();
  ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
  ctx.stroke();
  // Wing brackets when an enemy is in front + close
  if (g.player.fireT > 0) {
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ===== Radar (top center: circular scope with player at center, enemies as blips) =====
function drawRadar(ctx, cam, g, color, hot) {
  const cx = cam.w / 2;
  const cy = 110;
  const R  = 70;
  const radarRange = 220;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Faint backdrop
  ctx.fillStyle = 'rgba(0, 18, 10, 0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  beamCircle(ctx, cx, cy, R, { color, hot, width: 2.0, hotWidth: 0.8, alpha: 0.9 });
  // Cross-hairs
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();
  // Forward wedge (always pointing up — player is at center, view is up)
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.10;
  ctx.beginPath();
  const wedge = Math.PI / 4;
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R - 4, -Math.PI / 2 - wedge, -Math.PI / 2 + wedge);
  ctx.closePath();
  ctx.fill();

  // Sweep line
  const sweepA = (performance.now() / 1500) % (Math.PI * 2);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = hot;
  ctx.lineWidth = 1;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(sweepA) * (R - 2), cy - Math.cos(sweepA) * (R - 2));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Blips for each enemy — relative to player heading. Up = forward.
  for (const e of g.enemies) {
    const dx = e.x - g.player.x;
    const dz = e.z - g.player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > radarRange) continue;
    // Rotate dx,dz by -heading so forward is +Z up
    const rdx =  dx * Math.cos(g.player.heading) - dz * Math.sin(g.player.heading);
    const rdz =  dx * Math.sin(g.player.heading) + dz * Math.cos(g.player.heading);
    const sx = cx + (rdx / radarRange) * (R - 4);
    const sy = cy - (rdz / radarRange) * (R - 4);
    const blipCol = e.kind === 'saucer' ? ENEMY_COLOR.saucer
                  : e.kind === 'super'  ? ENEMY_COLOR.super
                  : ENEMY_COLOR.tank;
    beamDot(ctx, sx, sy, e.kind === 'super' ? 3.4 : 2.6, {
      color: blipCol.line, hot: blipCol.hot, alpha: 0.95,
    });
  }

  // Range label below
  beamText(ctx, 'RADAR', cx, cy + R + 14, {
    color, hot, size: 11, align: 'center', baseline: 'top', alpha: 0.7,
  });
}
