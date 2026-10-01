// =====================================================
// Tactile Forge — Tank Battle · Vector primitive renderer
// Phosphor "vector beam" look using additive blending.
// =====================================================

/**
 * Stroke a polyline with a phosphor-beam effect.
 * Uses 2 passes (additive): wide soft halo + thin hot core.
 *
 * @param ctx 2D context
 * @param pts [[x,y], ...]
 * @param opts { color, hot, alpha, width, hotWidth, closed }
 */
export function beamPath(ctx, pts, opts = {}) {
  if (pts.length < 2) return;
  const {
    color   = '#00b86a',
    hot     = '#d8ffe9',
    alpha   = 1.0,
    width   = 2.6,
    hotWidth = 1.0,
    closed  = false,
  } = opts;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Halo pass
  ctx.globalAlpha = 0.55 * alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  drawPath(ctx, pts, closed);

  // Core pass
  ctx.globalAlpha = 1.0 * alpha;
  ctx.strokeStyle = hot;
  ctx.lineWidth = hotWidth;
  drawPath(ctx, pts, closed);

  ctx.restore();
}

function drawPath(ctx, pts, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
  ctx.stroke();
}

/** Single beam line. */
export function beamLine(ctx, x1, y1, x2, y2, opts = {}) {
  beamPath(ctx, [[x1, y1], [x2, y2]], opts);
}

/** Beam edge list — pts is [[x,y],...] indexed; edges is [[i,j],...] */
export function beamEdges(ctx, pts, edges, opts = {}) {
  for (const [a, b] of edges) {
    if (!pts[a] || !pts[b]) continue;
    beamLine(ctx, pts[a][0], pts[a][1], pts[b][0], pts[b][1], opts);
  }
}

/** Helper: 2-pass beam stroke around an arbitrary path drawn by drawFn. */
function beamArcs(ctx, drawFn, opts = {}) {
  const {
    color = '#00b86a', hot = '#d8ffe9',
    alpha = 1, width = 2.6, hotWidth = 1,
  } = opts;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.55 * alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  drawFn();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hot;
  ctx.lineWidth = hotWidth;
  drawFn();
  ctx.restore();
}
export function beamCircle(ctx, x, y, r, opts = {}) {
  if (r <= 0) return;
  beamArcs(ctx, () => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }, opts);
}
export function beamEllipse(ctx, x, y, rx, ry, rot, opts = {}) {
  if (rx <= 0 || ry <= 0) return;
  beamArcs(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.stroke();
  }, opts);
}
export function beamArc(ctx, x, y, r, a0, a1, opts = {}) {
  if (r <= 0) return;
  beamArcs(ctx, () => {
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.stroke();
  }, opts);
}

/** Filled glow dot (for projectiles, lock points). */
export function beamDot(ctx, x, y, r, opts = {}) {
  const { color = '#5cffaa', hot = '#ffffff', alpha = 1 } = opts;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Outer halo
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  grad.addColorStop(0, color);
  grad.addColorStop(.4, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55 * alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  // Hot core
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Vector-style text. Renders in a chunky monospace look. */
export function beamText(ctx, text, x, y, opts = {}) {
  const {
    color = '#00b86a',
    hot   = '#d8ffe9',
    size  = 14,
    align = 'left',
    baseline = 'alphabetic',
    alpha = 1,
    font  = 'VT323, monospace',
  } = opts;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  ctx.globalAlpha = 0.55 * alpha;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.fillText(text, x, y);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = hot;
  ctx.fillText(text, x, y);
  ctx.restore();
}
