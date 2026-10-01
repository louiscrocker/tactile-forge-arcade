/* ============================================================
   cinematic.js — letterbox moments
   ============================================================
   A cinematic slows time, zooms the camera onto a point and
   drops black bars in for a few seconds.  Used for hatching,
   the back legs sprouting, the front legs popping out, the
   tail vanishing, the first hop, the first tongue snap, spawning
   and going to sleep under the ice.
   ============================================================ */
'use strict';

const Cinematic = {
  active: null,
  bars: 0,          // 0..1 letterbox amount, eased
  timeScale: 1,

  /* opts: { x, y, zoom, duration, slow (time scale), title, follow (fn → {x,y}) } */
  play(opts) {
    this.active = Object.assign({ duration: 3, slow: .35, zoom: 2.4, t: 0, title: '' }, opts);
    Bus.emit('cinematic', this.active.title);
  },

  stop() { this.active = null; },

  update(dt) {
    const a = this.active;
    const target = a ? 1 : 0;
    this.bars += (target - this.bars) * (1 - Math.exp(-dt * 6));
    if (!a) { this.timeScale += (1 - this.timeScale) * (1 - Math.exp(-dt * 6)); return; }
    a.t += dt;
    const edge = Math.min(smoothstep(0, .4, a.t), 1 - smoothstep(a.duration - .6, a.duration, a.t));
    this.timeScale = lerp(1, a.slow, edge);
    if (a.t >= a.duration) this.active = null;
  },

  camera() {
    const a = this.active;
    if (!a) return null;
    const p = a.follow ? a.follow() : { x: a.x, y: a.y };
    return { x: p.x, y: p.y, zoom: a.zoom };
  },

  draw(ctx, W, H) {
    if (this.bars < .01) return;
    const h = H * .11 * this.bars;
    ctx.fillStyle = '#05080a';
    ctx.fillRect(0, 0, W, h);
    ctx.fillRect(0, H - h, W, h);
    const a = this.active;
    if (a && a.title) {
      ctx.globalAlpha = Math.min(1, a.t * 2) * this.bars;
      ctx.font = `900 ${Math.round(H * .04)}px ${UI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff3c0';
      ctx.fillText(a.title, W / 2, H - h / 2);
      ctx.globalAlpha = 1;
    }
  }
};
