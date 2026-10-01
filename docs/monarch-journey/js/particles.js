/* ============================================================
   particles.js — juice: splashes, sparkles, sap, rain, pop-up text
   ============================================================ */
'use strict';

class Particles {
  constructor() {
    this.list = [];
    this.ambient = [];      // pollen / fireflies, recycled forever
  }

  spawn(p) {
    p.life = p.life || 1; p.max = p.life;
    this.list.push(p);
    if (this.list.length > 1200) this.list.splice(0, this.list.length - 1200);
    return p;
  }

  /* green flecks when a leaf is bitten */
  splat(x, y, col = '#a6e05a', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(20, 110);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 260, r: rnd(1.2, 3.2), col, life: rnd(.4, .9), drag: 2 });
    }
  }

  /* milky latex beads welling from a bite */
  sap(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      this.spawn({ type: 'dot', x: x + rnd(-4, 4), y: y + rnd(-2, 2), vx: rnd(-4, 4), vy: rnd(4, 14), g: 90, r: rnd(1.4, 2.6), col: '#ffffff', life: rnd(.8, 1.6), drag: 1 });
    }
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

  /* the molting flash: pale sparkles drifting up */
  sparkle(x, y, n = 30, col = '#fff6c8', spread = 40) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), r = Math.sqrt(Math.random()) * spread;
      this.spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: rnd(-10, 10), vy: rnd(-40, -10), g: -10, r: rnd(1.5, 3.5), col, life: rnd(.8, 1.8), twinkle: rnd(TAU) });
    }
  }

  ring(x, y, col, r = 10, grow = 200, life = .6) {
    this.spawn({ type: 'ring', x, y, r, grow, col, life, width: 3 });
  }

  confetti(x, y, n = 60) {
    const cols = ['#ff5d5d', '#ffd23f', '#5dd9ff', '#f28c1e', '#ff9ef0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(80, 320);
      this.spawn({ type: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 300, r: rnd(2.5, 5), col: pick(cols), life: rnd(1.2, 2.4), rot: rnd(TAU), vr: rnd(-10, 10), drag: 1.2 });
    }
  }

  /* a drop of meconium after eclosion, or a raindrop */
  drip(x, y, col = '#c9612a') {
    this.spawn({ type: 'dot', x, y, vx: 0, vy: 20, g: 400, r: 2.2, col, life: 1.2 });
  }

  /* rain streaks across the visible rect, blown by the wind */
  rain(rect, n, windX) {
    for (let i = 0; i < n; i++) {
      this.spawn({ type: 'rain', x: rnd(rect.l, rect.r), y: rect.t, vx: windX * .6 + rnd(-10, 10), vy: rnd(520, 700), g: 0, life: (rect.b - rect.t) / 560 + .2 });
    }
  }

  /* autumn leaves tumbling in the wind */
  leaf(rect, windX) {
    this.spawn({ type: 'leaf', x: windX > 0 ? rect.l : rect.r, y: rnd(rect.t, rect.b * .5 + rect.t * .5), vx: windX * .9 + rnd(-20, 20), vy: rnd(10, 40), g: 25, r: rnd(4, 7), col: pick(['#e2552b', '#f28c1e', '#f2c21b', '#b8863a']), rot: rnd(TAU), vr: rnd(-4, 4), life: 8, ph: rnd(TAU) });
  }

  /* wind streaks so the air is visible */
  streak(rect, windX, y) {
    this.spawn({ type: 'streak', x: windX > 0 ? rect.l : rect.r, y, vx: windX * 1.6, vy: 0, g: 0, len: 30 + Math.abs(windX) * .3, life: (rect.r - rect.l) / Math.max(40, Math.abs(windX) * 1.6) });
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      if (p.vx !== undefined) {
        p.vy += (p.g || 0) * dt;
        if (p.drag) { const k = 1 - Math.min(1, p.drag * dt); p.vx *= k; p.vy *= k; }
        if (p.type === 'leaf' || p.type === 'seed') { p.vx += Math.sin(p.life * 3 + p.ph) * 30 * dt; p.vy += Math.cos(p.life * 2.2 + p.ph) * 40 * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.type === 'ring') p.r += p.grow * dt;
      if (p.vr) p.rot += p.vr * dt;
      if ((p.type === 'rain' || p.type === 'leaf') && p.y > -2) { p.life = Math.min(p.life, p.type === 'rain' ? 0 : .3); p.vx = p.vy = 0; }
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
        case 'conf':
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2);
          ctx.restore();
          break;
        case 'rain':
          ctx.globalAlpha = .45;
          ctx.strokeStyle = '#cfe3ff'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke();
          break;
        case 'leaf':
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'seed':
          ctx.globalAlpha = Math.min(1, k * 2);
          Sprites.drawSeed(ctx, p.x, p.y, 1, p.rot);
          break;
        case 'streak':
          ctx.globalAlpha = .22 * Math.min(1, k * 4) * Math.min(1, (1 - k) * 4);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - sign(p.vx) * p.len, p.y); ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ambient motes: pollen by day, fireflies by night ---------- */
  ensureAmbient(n, rect) {
    while (this.ambient.length < n) {
      this.ambient.push({ x: rnd(rect.l, rect.r), y: rnd(rect.t, rect.b), ph: rnd(TAU), sp: rnd(.4, 1.2), r: rnd(1.2, 2.6), blink: rnd(TAU) });
    }
  }
  drawAmbient(ctx, rect, time, night, dt, windX = 0) {
    for (const m of this.ambient) {
      m.x += Math.sin(time * .5 + m.ph) * 14 * dt * m.sp + (6 + windX * .3) * dt;
      m.y += Math.cos(time * .37 + m.ph * 1.3) * 10 * dt * m.sp - 3 * dt * (1 - night);
      if (m.x < rect.l) m.x = rect.r; if (m.x > rect.r) m.x = rect.l;
      if (m.y < rect.t) m.y = rect.b; if (m.y > rect.b) m.y = rect.t;
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
