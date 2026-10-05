/* ============================================================
   particles.js — wood dust, sparkles, juice, pop-up text, fireflies
   ============================================================ */
'use strict';

class Particles {
  constructor() {
    this.list = [];
    this.ambient = [];      // pollen / fireflies above ground, dust motes below
  }

  spawn(p) {
    p.life = p.life || 1; p.max = p.life;
    this.list.push(p);
    if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
    return p;
  }

  /* crumbs of soil flying off the digging jaws */
  dust(x, y, col = '#8a6040', n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-1.4, 1.4) + Math.PI, sp = rnd(20, 70);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, g: 240, r: rnd(.8, 2.2), col, life: rnd(.3, .7), drag: 1.5 });
    }
  }
  splat(x, y, col = '#f2c54a', n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(30, 120);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, r: rnd(1.2, 3), col, life: rnd(.4, .8), drag: 2 });
    }
    this.spawn({ type: 'ring', x, y, r: 3, grow: 70, col: 'rgba(255,255,255,.7)', life: .35 });
  }
  puff(x, y, col, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(8, 30);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, r: rnd(1, 2.5), col, life: rnd(.5, 1), drag: 2 });
    }
  }
  text(x, y, str, col = '#fff', size = 16) {
    this.spawn({ type: 'text', x, y, vx: rnd(-8, 8), vy: -55, g: 40, str, col, size, life: 1.1 });
  }
  sparkle(x, y, n = 30, col = '#fff6c8', spread = 40) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), r = Math.sqrt(Math.random()) * spread;
      this.spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: rnd(-10, 10), vy: rnd(-40, -10), g: -10, r: rnd(1.5, 3.5), col, life: rnd(.8, 1.8), twinkle: rnd(TAU) });
    }
  }
  ring(x, y, col, r = 10, grow = 200, life = .6) {
    this.spawn({ type: 'ring', x, y, r, grow, col, life, width: 3 });
  }
  /* a puff of alarm / recruitment scent: soft expanding rings */
  scent(x, y, col = 'rgba(255,230,120,.8)') {
    for (let k = 0; k < 3; k++) this.spawn({ type: 'ring', x, y, r: 6 + k * 10, grow: 160 + k * 40, col, life: .9 + k * .25, width: 2 });
  }
  drip(x, y) { this.spawn({ type: 'dot', x, y, vx: 0, vy: 30, g: 500, r: 1.8, col: 'rgba(190,225,255,.9)', life: 1 }); }
  fallingLeaf(x, y, col) {
    this.spawn({ type: 'leaf', x, y, vx: rnd(-30, 30), vy: rnd(10, 30), g: 40, drag: 1.4, rot: rnd(TAU), vr: rnd(-2, 2), col, life: rnd(5, 8) });
  }
  confetti(x, y, n = 60) {
    const cols = ['#ff5d5d', '#ffd23f', '#5dd9ff', '#8cff7a', '#ff9ef0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(80, 320);
      this.spawn({ type: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 300, r: rnd(2.5, 5), col: pick(cols), life: rnd(1.2, 2.4), rot: rnd(TAU), vr: rnd(-10, 10), drag: 1.2 });
    }
  }

  update(dt, groundAt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      if (p.vx !== undefined) {
        p.vy += (p.g || 0) * dt;
        if (p.drag) { const k = 1 - Math.min(1, p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.type === 'ring') p.r += p.grow * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.type === 'leaf') {
        p.vx += Math.sin(p.life * 3 + p.rot) * 60 * dt;
        const gy = groundAt ? groundAt(p.x) - 3 : -4;
        if (p.y > gy) { p.y = gy; p.vx = 0; p.vy = 0; p.vr = 0; p.life = Math.min(p.life, 1.5); }
      }
    }
  }

  draw(ctx, cam) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'dot':
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * .4), 0, TAU); ctx.fill();
          break;
        case 'spark': {
          const tw = .6 + .4 * Math.sin(p.twinkle + (1 - k) * 20);
          ctx.globalAlpha = k * tw;
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          ctx.globalAlpha = k * tw * .5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, TAU); ctx.fill();
          break;
        }
        case 'ring':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.col; ctx.lineWidth = (p.width || 2) * k + .5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
          break;
        case 'text': {
          ctx.globalAlpha = Math.min(1, k * 2);
          const s = p.size / Math.max(.6, cam.zoom) * (1 + (1 - k) * .3);
          ctx.font = `900 ${s}px ${UI_FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = s * .18; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round';
          ctx.strokeText(p.str, p.x, p.y);
          ctx.fillStyle = p.col; ctx.fillText(p.str, p.x, p.y);
          break;
        }
        case 'leaf':
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(.7, .7);
          Sprites.drawLeaf(ctx, 16, 0, p.col || '#5a8a3a');
          ctx.restore();
          break;
        case 'wing':
          /* a scrap of shed skin, see-sawing down */
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 2) * .8;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.life * 4) * .5);
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-10, -8, -30, -7, -36, -1); ctx.bezierCurveTo(-30, 3, -12, 3, 0, 0);
          ctx.fillStyle = 'rgba(225,235,250,.6)'; ctx.fill();
          ctx.strokeStyle = 'rgba(120,130,150,.6)'; ctx.lineWidth = .6; ctx.stroke();
          ctx.restore();
          break;
        case 'conf':
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2);
          ctx.restore();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ambient motes: pollen by day, fireflies by night (above ground only) ---------- */
  ensureAmbient(n, rect) {
    while (this.ambient.length < n) this.ambient.push({ x: rnd(rect.l, rect.r), y: rnd(rect.t, rect.b), ph: rnd(TAU), sp: rnd(.4, 1.2), r: rnd(1.2, 2.6), blink: rnd(TAU) });
  }
  drawAmbient(ctx, rect, time, night, dt, ceiling) {
    for (const m of this.ambient) {
      m.x += Math.sin(time * .5 + m.ph) * 14 * dt * m.sp + 6 * dt;
      m.y += Math.cos(time * .37 + m.ph * 1.3) * 10 * dt * m.sp - 3 * dt * (1 - night);
      if (m.x < rect.l) m.x = rect.r; if (m.x > rect.r) m.x = rect.l;
      if (m.y < rect.t) m.y = rect.b; if (m.y > rect.b) m.y = rect.t;
      if (typeof ceiling === 'function' ? !ceiling(m.x, m.y) : m.y > ceiling) continue;
      if (night > .5) {
        const b = Math.max(0, Math.sin(time * 1.8 + m.blink));
        if (b < .15) continue;
        ctx.globalAlpha = b * night;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 7);
        g.addColorStop(0, 'rgba(220,255,140,.95)'); g.addColorStop(.3, 'rgba(180,255,100,.5)'); g.addColorStop(1, 'rgba(180,255,100,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 7, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = (0.25 + .2 * Math.sin(time * 2 + m.blink)) * (1 - night);
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * .8, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

const UI_FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';
