// =====================================================
// Tactile Forge — Missile Attack · Background starfield
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
    // Drift and twinkle are JS-driven, so the CSS reduced-motion rules can't
    // reach them — check the OS preference and the in-app setting directly.
    this._prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Star tint follows the phosphor. Cached rather than read per frame —
    // getComputedStyle in the render loop is needlessly expensive.
    this._starColor = '#bfffd9';
    this._readStarColor();
    new MutationObserver(() => this._readStarColor())
      .observe(document.body, { attributes: true, attributeFilter: ['data-phosphor'] });
    window.addEventListener('resize', () => this.resize(), { passive: true });
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _readStarColor() {
    const c = getComputedStyle(document.body).getPropertyValue('--c-paper').trim();
    if (c) this._starColor = c;
  }

  get still() {
    return this._prefersStill.matches ||
           document.body.dataset.reduceMotion === 'true';
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
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'source-over';

    // Stars
    const still = this.still;
    for (const s of this.stars) {
      if (!still) {
        // gentle drift downward
        s.y += dt * 8 * s.z;
        if (s.y > this.h + 4) { s.y = -2; s.x = Math.random() * this.w; }
        s.tw += dt * (1 + s.z * 2);
      }
      const a = 0.45 + 0.35 * Math.sin(s.tw);
      ctx.globalAlpha = a * (0.4 + s.z * 0.6);
      ctx.fillStyle = this._starColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s * (0.4 + s.z * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this._raf = requestAnimationFrame(this._loop);
  }
}
