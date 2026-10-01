// =====================================================
// Tactile Forge — TRON · Background starfield
// Drifting parallax stars on a dedicated canvas.
// =====================================================

export class Starfield {
  constructor(canvas, count = 240) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.count = count;
    this.resize();
    this.seed();
    this._raf = 0;
    this._t0 = performance.now();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width  = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
  }
  seed() {
    this.stars = [];
    for (let i = 0; i < this.count; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z: Math.random() * 0.9 + 0.1,        // depth (0..1)
        s: Math.random() * 1.4 + 0.2,        // size
        tw: Math.random() * Math.PI * 2,     // twinkle phase
      });
    }
  }
  _loop(now) {
    const dt = Math.min(0.05, (now - this._t0) / 1000);
    this._t0 = now;
    // The game canvas paints over this layer edge to edge; redrawing 200+ stars
    // underneath it every frame is pure waste while a run is in progress.
    if (document.querySelector('.screen-game.is-active')) {
      this._raf = requestAnimationFrame(this._loop);
      return;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'source-over';

    // Stars
    for (const s of this.stars) {
      // gentle drift downward
      s.y += dt * 8 * s.z;
      if (s.y > this.h + 4) { s.y = -2; s.x = Math.random() * this.w; }
      s.tw += dt * (1 + s.z * 2);
      const a = 0.45 + 0.35 * Math.sin(s.tw);
      ctx.globalAlpha = a * (0.4 + s.z * 0.6);
      ctx.fillStyle = '#bfffd9';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s * (0.4 + s.z * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this._raf = requestAnimationFrame(this._loop);
  }
}
