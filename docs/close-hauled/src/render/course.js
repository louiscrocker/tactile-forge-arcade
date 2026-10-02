// =====================================================
// Tactile Forge — Course / Yacht renderer
// =====================================================

// Must match the breakpoint in styles/game.css.
export const COMPACT = window.matchMedia('(max-width: 700px)');

export class CourseRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.t = 0;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    this.hover = null; // {x,y} normalized
    this.engine = null;
    this.aim = null; // {angle, magnitude}
    this._raf = null;
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width  = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.W = w; this.H = h;
    this._compactArea = null;
  }

  setEngine(engine) { this.engine = engine; }

  setHover(nx, ny) {
    if (nx == null) { this.hover = null; this.aim = null; return; }
    this.hover = { x: nx, y: ny };
    if (this.engine) {
      const p = this.engine.getCurrentPlayer();
      const dx = nx - p.x, dy = ny - p.y;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      this.aim = { angle, magnitude: Math.hypot(dx, dy) };
    }
  }

  // Full-bleed playable area with safe margins so HUDs don't crush the action.
  _area() {
    if (COMPACT.matches) return this._compact();
    const left = 260;   // wind HUD
    const right = 320;  // standings
    const top = 32;
    const bottom = 200; // action dock
    const x = Math.max(40, left);
    const y = top;
    const w = Math.max(200, this.W - left - right);
    const h = Math.max(200, this.H - top - bottom);
    return { x, y, w, h };
  }

  // Phones in portrait: the chart spans the width between the top strip
  // (wind + standings bar) and the action dock. Measured from the layout
  // (offsetTop ignores the screen-in transform) and cached until a resize;
  // falls back to the CSS sizes while the game screen is still hidden.
  _compact() {
    if (this._compactArea) return this._compactArea;
    const standings = document.getElementById('hud-standings');
    const dock = document.querySelector('.action-dock');
    const measured = !!(standings?.offsetParent && dock?.offsetHeight);
    const top = (measured ? standings.offsetTop : 70) + 40 + 18;  // collapsed bar is 40px tall
    const bottom = (measured ? this.H - dock.offsetTop : 190) + 16;
    const side = 26;                                               // room for name tags at the edges
    const w = Math.max(160, this.W - side * 2);
    let h = Math.max(160, this.H - top - bottom);
    let y = top;
    const maxH = w * 1.5;                                          // don't stretch the course too tall
    if (h > maxH) { y += (h - maxH) / 2; h = maxH; }
    const area = { x: side, y, w, h };
    if (measured) this._compactArea = area;
    return area;
  }

  _toPx(nx, ny) {
    const a = this._area();
    return { x: a.x + nx * a.w, y: a.y + ny * a.h };
  }

  _toNorm(px, py) {
    const a = this._area();
    return { x: (px - a.x) / a.w, y: (py - a.y) / a.h };
  }

  pickFromEvent(evt) {
    const r = this.canvas.getBoundingClientRect();
    const px = (evt.clientX - r.left);
    const py = (evt.clientY - r.top);
    return this._toNorm(px, py);
  }

  start() {
    if (this._raf) return;
    const tick = (now) => {
      this.t = (now || 0) * 0.001;
      this._draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }

  _draw() {
    const ctx = this.ctx;
    const { W, H } = this;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, W, H);

    if (!this.engine) { ctx.restore(); return; }
    const e = this.engine;
    const a = this._area();

    // ---- Full-bleed ocean background ----
    this._drawOcean(ctx, W, H);

    // No clip — ocean is full-screen. Draw a faint compass-grid only over the playable area.
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 212, 134, .045)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const x = a.x + (a.w * i) / 10;
      ctx.beginPath(); ctx.moveTo(x, a.y); ctx.lineTo(x, a.y + a.h); ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      const y = a.y + (a.h * i) / 8;
      ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(a.x + a.w, y); ctx.stroke();
    }
    ctx.restore();

    // ---- Shallows ----
    for (const s of (e.course.shallows || [])) {
      const c = this._toPx(s.x, s.y);
      const r = s.r * Math.min(a.w, a.h);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, 'rgba(245, 212, 134, .22)');
      g.addColorStop(1, 'rgba(245, 212, 134, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(245, 212, 134, .35)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- Islands ----
    for (const isl of (e.course.islands || [])) {
      const c = this._toPx(isl.x, isl.y);
      const rx = isl.rx * Math.min(a.w, a.h);
      const ry = isl.ry * Math.min(a.w, a.h);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate((isl.rotation || 0) * Math.PI / 180);
      // Beach
      ctx.fillStyle = '#3b2f1c';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      // Land
      ctx.fillStyle = '#5e4a26';
      ctx.beginPath(); ctx.ellipse(0, -2, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      // Vegetation
      ctx.fillStyle = '#2d5b3a';
      ctx.beginPath(); ctx.ellipse(-2, -4, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---- Lighthouses ----
    for (const lh of (e.course.lighthouses || [])) {
      const c = this._toPx(lh.x, lh.y);
      ctx.save();
      // Tower
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(c.x - 3, c.y - 16, 6, 18);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(c.x - 3, c.y - 12, 6, 4);
      ctx.fillRect(c.x - 3, c.y - 4, 6, 4);
      // Lantern
      ctx.fillStyle = '#f5d486';
      ctx.beginPath(); ctx.arc(c.x, c.y - 18, 3, 0, Math.PI * 2); ctx.fill();
      // Sweeping beam
      const beamA = (this.t * 1.2) % (Math.PI * 2);
      const grad = ctx.createRadialGradient(c.x, c.y - 18, 0, c.x, c.y - 18, 80);
      grad.addColorStop(0, 'rgba(245, 212, 134, .45)');
      grad.addColorStop(1, 'rgba(245, 212, 134, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 18);
      ctx.arc(c.x, c.y - 18, 80, beamA - 0.18, beamA + 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ---- Course path between marks ----
    if (e.course.marks.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 212, 134, .25)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const first = this._toPx(e.course.marks[0].x, e.course.marks[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < e.course.marks.length; i++) {
        const p = this._toPx(e.course.marks[i].x, e.course.marks[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(first.x, first.y);
      ctx.stroke();
      ctx.restore();
    }

    // ---- Marks ----
    e.course.marks.forEach((m, i) => {
      const c = this._toPx(m.x, m.y);
      const isStart = m.type === 'start';
      const color = isStart ? '#f5d486' : (m.type === 'red' ? '#e74c3c' : '#27ae60');
      const isNext = e.players[e.currentPlayerIndex].currentMark % e.course.marks.length === i;

      // Halo for next mark
      if (isNext) {
        const pulse = (Math.sin(this.t * 3) + 1) * 0.5;
        ctx.fillStyle = `rgba(245, 212, 134, ${.18 + pulse * .15})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, 22 + pulse * 6, 0, Math.PI * 2); ctx.fill();
      }

      // Buoy body
      ctx.save();
      ctx.translate(c.x, c.y);
      const sway = Math.sin(this.t * 1.2 + i) * 2;
      ctx.translate(sway, 0);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.ellipse(0, 4, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      // base
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      // top stripe
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(-9, -3, 18, 2);
      // pole
      ctx.fillStyle = '#222';
      ctx.fillRect(-1, -16, 2, 10);
      // flag
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(8, -13);
      ctx.lineTo(0, -10);
      ctx.fill();
      ctx.restore();

      // Label
      ctx.fillStyle = isStart ? '#f5d486' : '#d6e6f2';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isStart ? 'START / FINISH' : `${i}`, c.x, c.y + 24);
    });

    // ---- Trails ----
    for (const p of e.players) {
      if (p.trail.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = p.color.hex;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const pt = this._toPx(p.trail[i].x, p.trail[i].y);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      const head = this._toPx(p.animX, p.animY);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      ctx.restore();
    }

    // ---- Aim line (current player only, when hovering) ----
    const cur = e.getCurrentPlayer();
    if (cur && this.aim && !cur.isAI && e.phase === 'heading') {
      const start = this._toPx(cur.x, cur.y);
      const end = this._toPx(this.hover.x, this.hover.y);
      const pos = e.getPointOfSail(this.aim.angle);
      ctx.save();
      ctx.strokeStyle = pos.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // arrowhead
      const ang = Math.atan2(end.y - start.y, end.x - start.x);
      ctx.translate(end.x, end.y); ctx.rotate(ang);
      ctx.fillStyle = pos.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, 6);
      ctx.lineTo(-12, -6);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // POS label near cursor
      ctx.save();
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = pos.color;
      // Flip to the left of the cursor when the label would run off screen (narrow phones).
      const label = pos.name.toUpperCase();
      const flip = end.x + 14 + ctx.measureText(label).width > W - 4;
      ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillText(label, flip ? end.x - 14 : end.x + 14, end.y + 4);
      ctx.restore();
    }

    // ---- Yachts ----
    for (const p of e.players) {
      if (p.finished) continue;
      const c = this._toPx(p.animX, p.animY);
      // Smooth animate toward target
      p.animX += (p.x - p.animX) * 0.18;
      p.animY += (p.y - p.animY) * 0.18;
      let dh = p.heading - p.animHeading;
      while (dh > 180) dh -= 360;
      while (dh < -180) dh += 360;
      p.animHeading += dh * 0.18;
      this._drawYacht(ctx, c.x, c.y, p, e);
    }

    ctx.restore();
  }

  _drawOcean(ctx, w, h) {
    const t = this.t;

    // Deep gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,   '#02060c');
    sky.addColorStop(0.30,'#06121f');
    sky.addColorStop(0.55,'#0a223a');
    sky.addColorStop(0.85,'#04101c');
    sky.addColorStop(1,   '#020812');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Two slow auroras for depth
    const a1x = w * (0.3 + Math.sin(t * 0.12) * 0.08);
    const a1 = ctx.createRadialGradient(a1x, h * 0.22, 0, a1x, h * 0.22, w * 0.55);
    a1.addColorStop(0, 'rgba(95, 211, 196, .07)');
    a1.addColorStop(1, 'rgba(95, 211, 196, 0)');
    ctx.fillStyle = a1; ctx.fillRect(0, 0, w, h);

    const a2x = w * (0.72 + Math.cos(t * 0.09) * 0.06);
    const a2 = ctx.createRadialGradient(a2x, h * 0.78, 0, a2x, h * 0.78, w * 0.5);
    a2.addColorStop(0, 'rgba(245, 212, 134, .05)');
    a2.addColorStop(1, 'rgba(245, 212, 134, 0)');
    ctx.fillStyle = a2; ctx.fillRect(0, 0, w, h);

    // Wave bands (parallax) — full screen, top to bottom
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const k = i / (bands - 1);
      const yBase = k * h;
      const amp = 1.2 + k * 5;
      const freq = 0.014 + k * 0.006;
      const speed = 0.3 + k * 1.4;
      const phase = t * speed + i * 0.7;
      const alpha = 0.06 + k * 0.08;
      ctx.strokeStyle = `rgba(${Math.round(80 + k * 50)}, ${Math.round(140 + k * 60)}, ${Math.round(180 + k * 50)}, ${alpha})`;
      ctx.lineWidth = 1 + k * 0.6;
      ctx.beginPath();
      const step = Math.max(8, 26 - k * 16);
      for (let x = 0; x <= w; x += step) {
        const yy = yBase
          + Math.sin(x * freq + phase) * amp
          + Math.sin(x * freq * 0.4 + phase * 0.7) * amp * 0.5;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Animated glints scattered across the surface
    const seed = Math.floor(t * 0.4);
    for (let i = 0; i < 80; i++) {
      const ix = (i * 4373) % w;
      const iy = (i * 7919) % h;
      const phase = (t * 1.6 + i) % (Math.PI * 2);
      const a = (Math.sin(phase) + 1) * 0.5;
      ctx.fillStyle = `rgba(214, 230, 242, ${0.08 * a})`;
      ctx.fillRect(ix, iy, 2, 1);
    }

    // Soft inner vignette so HUDs feel inset
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  _drawYacht(ctx, x, y, p, engine) {
    const heading = p.animHeading;
    const r = (heading - 90) * Math.PI / 180;
    const isCurrent = engine.players[engine.currentPlayerIndex].id === p.id;

    ctx.save();
    ctx.translate(x, y);
    // Wake (bow wave)
    if (p.lastMoveDistance > 0) {
      ctx.save();
      ctx.rotate(r);
      ctx.fillStyle = 'rgba(214,230,242,.25)';
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const off = (this.t * 80 + i * 8) % 40;
        ctx.globalAlpha = (1 - t) * 0.3;
        ctx.beginPath();
        ctx.ellipse(-12 - off, -6, 8, 1.4, 0, 0, Math.PI * 2);
        ctx.ellipse(-12 - off,  6, 8, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.rotate(r);

    // Selection ring
    if (isCurrent) {
      ctx.strokeStyle = 'rgba(245, 212, 134, .55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Hull shadow
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hull
    ctx.fillStyle = p.color.deep;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(7, -8, 8, 6, 4, 10);
    ctx.lineTo(-4, 10);
    ctx.bezierCurveTo(-8, 6, -7, -8, 0, -12);
    ctx.fill();

    // Deck
    ctx.fillStyle = p.color.hex;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(5, -7, 6, 4, 3, 8);
    ctx.lineTo(-3, 8);
    ctx.bezierCurveTo(-6, 4, -5, -7, 0, -10);
    ctx.fill();

    // Mast
    ctx.strokeStyle = '#3a2f1c';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 6); ctx.stroke();

    // Sail (color shows point of sail tone)
    const pos = engine.getPointOfSail(heading);
    const sailColor = pos.tone === 'best' ? '#ffffff' : pos.tone === 'ok' ? '#f1e8c2' : '#ffb2b2';
    ctx.fillStyle = sailColor;
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 0.5;
    // Mainsail (luffing if in irons)
    const luff = pos.modifier <= -2 ? Math.sin(this.t * 12) * 3 : 0;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(-7 + luff, -2, 0, 6);
    ctx.fill(); ctx.stroke();
    // Jib
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(5 + luff, -3, 0, 0);
    ctx.fill(); ctx.stroke();

    ctx.restore();

    // Name tag
    ctx.save();
    ctx.fillStyle = 'rgba(3,8,15,.65)';
    ctx.strokeStyle = p.color.hex;
    ctx.lineWidth = 1;
    const text = p.name;
    ctx.font = '600 10px Inter, sans-serif';
    const tw = ctx.measureText(text).width + 12;
    this._roundRect(ctx, x - tw/2, y + 16, tw, 14, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d6e6f2';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 26);
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}
