// =====================================================
// Tactile Forge — Animated ocean background
// Layered sine-wave gradient + parallax stars + subtle aurora.
// Pure 2D canvas, GPU-friendly via offscreen layers.
// =====================================================

export class WaterBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.stars = [];
    this.lights = [];
    this._raf = null;
    this._reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    this.start();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width  = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.W = w; this.H = h;
    // Stars
    this.stars = [];
    const count = Math.floor(w * h / 8000);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.6,
        s: Math.random() * 1.4 + 0.2,
        a: Math.random() * .8 + .2,
        tw: Math.random() * Math.PI * 2
      });
    }
    // Distant harbour lights
    this.lights = [];
    const lc = Math.floor(w / 220);
    for (let i = 0; i < lc; i++) {
      this.lights.push({
        x: Math.random() * w,
        y: h * (0.55 + Math.random() * 0.05),
        c: ['#f5d486', '#ffffff', '#5fd3c4'][Math.floor(Math.random()*3)],
        a: Math.random() * .6 + .2,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  start() {
    if (this._raf) return;
    const tick = (now) => {
      this._frame(now);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _frame(now) {
    this.t = (now || 0) * 0.001;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const w = this.W, h = this.H;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // ---- Sky gradient ----
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,    '#020812');
    sky.addColorStop(0.35, '#06121f');
    sky.addColorStop(0.55, '#0a223a');
    sky.addColorStop(0.85, '#04101c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // ---- Aurora glow ----
    const aurora = ctx.createRadialGradient(
      w * (0.3 + Math.sin(this.t * 0.12) * 0.1), h * 0.25, 0,
      w * 0.3, h * 0.25, w * 0.6
    );
    aurora.addColorStop(0,   'rgba(95, 211, 196, 0.08)');
    aurora.addColorStop(0.4, 'rgba(95, 211, 196, 0.04)');
    aurora.addColorStop(1,   'rgba(95, 211, 196, 0)');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, w, h);

    const aurora2 = ctx.createRadialGradient(
      w * (0.7 + Math.cos(this.t * 0.09) * 0.08), h * 0.18, 0,
      w * 0.7, h * 0.18, w * 0.5
    );
    aurora2.addColorStop(0,   'rgba(245, 212, 134, 0.07)');
    aurora2.addColorStop(0.4, 'rgba(245, 212, 134, 0.025)');
    aurora2.addColorStop(1,   'rgba(245, 212, 134, 0)');
    ctx.fillStyle = aurora2;
    ctx.fillRect(0, 0, w, h);

    // ---- Stars ----
    for (const s of this.stars) {
      const tw = (Math.sin(this.t * 1.5 + s.tw) + 1) / 2;
      ctx.globalAlpha = s.a * (0.6 + tw * 0.4);
      ctx.fillStyle = '#cfe2f5';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // ---- Horizon glow ----
    const hg = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.62);
    hg.addColorStop(0, 'rgba(245, 212, 134, 0)');
    hg.addColorStop(0.5, 'rgba(245, 212, 134, 0.18)');
    hg.addColorStop(1, 'rgba(245, 212, 134, 0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, h * 0.5, w, h * 0.12);

    // ---- Harbour lights ----
    for (const lt of this.lights) {
      const tw = (Math.sin(this.t * 2 + lt.tw) + 1) / 2;
      ctx.globalAlpha = lt.a * (0.5 + tw * 0.5);
      ctx.fillStyle = lt.c;
      ctx.beginPath();
      ctx.arc(lt.x, lt.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
      // halo
      ctx.globalAlpha = lt.a * 0.18 * tw;
      ctx.beginPath();
      ctx.arc(lt.x, lt.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- Water bands (parallax sine waves) ----
    const horizonY = h * 0.55;
    const seaH = h - horizonY;

    // base sea fill
    const sea = ctx.createLinearGradient(0, horizonY, 0, h);
    sea.addColorStop(0,    '#0a2540');
    sea.addColorStop(0.5,  '#061b30');
    sea.addColorStop(1,    '#020a14');
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizonY, w, seaH);

    // moving wave bands
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const k = i / bands;
      const yBase = horizonY + k * seaH;
      const amp = 2 + k * 14;
      const freq = 0.012 + k * 0.008;
      const speed = (0.5 + k * 1.6) * (this._reduced ? 0.2 : 1);
      const phase = this.t * speed + i * 0.7;
      const alpha = 0.10 + k * 0.18;
      ctx.fillStyle = `rgba(${Math.round(20 + k * 60)}, ${Math.round(60 + k * 80)}, ${Math.round(110 + k * 70)}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      const step = Math.max(6, 22 - k * 16);
      for (let x = 0; x <= w; x += step) {
        const y = yBase
          + Math.sin(x * freq + phase) * amp
          + Math.sin(x * freq * 0.4 + phase * 0.7) * amp * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // crest highlight
      if (k > 0.3) {
        ctx.strokeStyle = `rgba(214, 230, 242, ${0.04 + k * 0.05})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += step) {
          const y = yBase
            + Math.sin(x * freq + phase) * amp
            + Math.sin(x * freq * 0.4 + phase * 0.7) * amp * 0.5;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // ---- Moon glints on the water ----
    const glintX = w * (0.5 + Math.sin(this.t * 0.05) * 0.02);
    for (let i = 0; i < 24; i++) {
      const yy = horizonY + 8 + i * (seaH / 24);
      const wgth = (i / 24);
      const amp = 30 + wgth * 80;
      const offset = Math.sin(this.t * (0.4 + wgth) + i) * amp;
      ctx.globalAlpha = 0.1 + (1 - wgth) * 0.18;
      ctx.fillStyle = '#f5e8c2';
      ctx.fillRect(glintX + offset - 12, yy, 24, 1);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
