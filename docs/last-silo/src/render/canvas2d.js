// =====================================================
// Tactile Forge · Canvas 2D back end  [SHARED across games — keep in sync]
//
// The original renderer, now driven by the shared display list. Approximates
// the phosphor beam with two additive strokes: a wide soft halo and a thin hot
// core. Always available — this is the fallback when WebGL2 isn't.
// =====================================================

import { beamPath, beamDot, beamText } from './vector.js';

export class Canvas2DRenderer {
  static mode = 'canvas';
  static label = 'Canvas 2D';

  constructor(canvas) {
    this.mode = 'canvas';
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D context unavailable');
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width  = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.style.width  = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(list) {
    const ctx = this.ctx;
    const { w, h } = list;

    // Background gradient
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, list.bg0);
    grad.addColorStop(1, list.bg1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Crash flash
    if (list.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 70, 70, ${list.flash})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Ground hatching
    if (list.hatch.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1;
      for (const s of list.hatch) {
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y0);
        ctx.lineTo(s.x, s.y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Filled elliptical glows sit under the line work, like a fireball behind
    // its shock ring. Drawn in unit space so the gradient stretches with the
    // ellipse instead of being sampled circularly.
    for (const gl of list.glows || []) {
      if (!(gl.rx > 0) || !(gl.ry > 0)) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(gl.x, gl.y);
      ctx.scale(gl.rx, gl.ry);
      const rad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      rad.addColorStop(0, gl.color);
      rad.addColorStop(0.7, gl.mid || 'rgba(60,255,160,0.25)');
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rad;
      ctx.globalAlpha = gl.alpha;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of list.paths) {
      beamPath(ctx, p.pts, {
        color: p.color, hot: p.hot, alpha: p.alpha,
        width: p.width, hotWidth: p.hotWidth, closed: p.closed,
      });
    }

    for (const d of list.dots) {
      beamDot(ctx, d.x, d.y, d.r, { color: d.color, hot: d.hot, alpha: d.alpha });
    }

    for (const t of list.texts) {
      beamText(ctx, t.text, t.x, t.y, {
        color: t.color, hot: t.hot, size: t.size,
        align: t.align, baseline: t.baseline, alpha: t.alpha,
      });
    }
  }

  dispose() {}
}
