/* ============================================================
   particles.js — sparkles, hearts, petals, stars, splashes,
                  confetti, fireworks, pop-up text, ambient motes
   ============================================================ */
'use strict';

class Particles {
  constructor() {
    this.list = [];
    this.ambient = [];      // pollen by day, fireflies by night — recycled forever
  }

  spawn(p) {
    p.life = p.life || 1; p.max = p.life;
    this.list.push(p);
    if (this.list.length > 1200) this.list.splice(0, this.list.length - 1200);
    return p;
  }

  /* horn magic: a burst of pale sparkles drifting up */
  sparkle(x, y, n = 24, col = '#fff6c8', spread = 40) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), r = Math.sqrt(Math.random()) * spread;
      this.spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: rnd(-14, 14), vy: rnd(-50, -12), g: -12, r: rnd(1.5, 3.6), col, life: rnd(.7, 1.6), twinkle: rnd(TAU) });
    }
  }
  /* a ring of little stars flying outwards */
  starBurst(x, y, n = 12, col = '#ffe14a', speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rnd(-.2, .2), sp = speed * rnd(.6, 1.2);
      this.spawn({ type: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 160, r: rnd(3, 6), col, life: rnd(.6, 1.1), rot: rnd(TAU), vr: rnd(-6, 6), drag: 1.6 });
    }
    this.spawn({ type: 'ring', x, y, r: 6, grow: 260, col: 'rgba(255,255,255,.8)', life: .4, width: 3 });
  }
  hearts(x, y, n = 5, col = '#ff6fa8') {
    for (let i = 0; i < n; i++) this.spawn({ type: 'heart', x: x + rnd(-14, 14), y: y + rnd(-6, 6), vx: rnd(-16, 16), vy: rnd(-70, -35), g: -10, r: rnd(4, 7), col, life: rnd(.9, 1.5), ph: rnd(TAU) });
  }
  petals(x, y, n = 10, col = '#ffb3d0') {
    for (let i = 0; i < n; i++) this.spawn({ type: 'petal', x, y, vx: rnd(-40, 40), vy: rnd(-90, -30), g: 90, r: rnd(2.5, 4.5), col, life: rnd(1, 1.8), rot: rnd(TAU), vr: rnd(-6, 6), drag: 1.2 });
  }
  puff(x, y, col = 'rgba(255,255,255,.7)', n = 6, sp = 30) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), v = rnd(sp * .3, sp);
      this.spawn({ type: 'puff', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, g: -20, r: rnd(3, 7), col, life: rnd(.4, .9), drag: 2.5 });
    }
  }
  dust(x, y, dir = 1) { for (let i = 0; i < 3; i++) this.spawn({ type: 'puff', x: x + rnd(-6, 6), y, vx: -dir * rnd(10, 40), vy: rnd(-25, -5), g: -15, r: rnd(2, 4.5), col: 'rgba(240,230,200,.55)', life: rnd(.3, .6), drag: 3 }); }
  splash(x, y, n = 10, power = 1) {
    for (let i = 0; i < n; i++) this.spawn({ type: 'drop', x: x + rnd(-8, 8), y, vx: rnd(-60, 60) * power, vy: rnd(-160, -50) * power, g: 420, r: rnd(1.5, 3.5), col: 'rgba(200,235,255,.9)', life: rnd(.4, .8) });
    this.spawn({ type: 'ripple', x, y, r: 6, grow: 90 * power, col: 'rgba(255,255,255,.6)', life: .7 });
  }
  ripple(x, y) { this.spawn({ type: 'ripple', x, y, r: 4, grow: 50, col: 'rgba(255,255,255,.45)', life: .8 }); }
  text(x, y, str, col = '#fff', size = 16) {
    this.spawn({ type: 'text', x, y, vx: rnd(-8, 8), vy: -55, g: 40, str, col, size, life: 1.2 });
  }
  note(x, y, col = '#fff') { this.spawn({ type: 'note', x, y, vx: rnd(-14, 14), vy: rnd(-40, -25), g: -6, col, life: 1.4, ph: rnd(TAU) }); }
  zz(x, y) { this.spawn({ type: 'zz', x, y, vx: 6, vy: -18, g: -4, col: '#fff', life: 2.2, ph: rnd(TAU) }); }
  ring(x, y, col, r = 10, grow = 200, life = .6) { this.spawn({ type: 'ring', x, y, r, grow, col, life, width: 3 }); }
  confetti(x, y, n = 70, spread = 320) {
    const cols = ['#ff5d8f', '#ffd23f', '#5dd9ff', '#8cff7a', '#ff9ef0', '#c9a5ff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(80, spread);
      this.spawn({ type: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, g: 300, r: rnd(2.5, 5), col: pick(cols), life: rnd(1.4, 2.8), rot: rnd(TAU), vr: rnd(-10, 10), drag: 1.2 });
    }
  }
  /* a firework: a rocket streak then a burst */
  firework(x, y, col) {
    col = col || pick(RAINBOW);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rnd(-.1, .1), sp = rnd(120, 260);
      this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 90, r: rnd(2, 3.5), col: chance(.3) ? '#fff' : col, life: rnd(1, 1.8), twinkle: rnd(TAU), drag: 1.1 });
    }
    this.spawn({ type: 'ring', x, y, r: 10, grow: 400, col: withAlpha(col, .8), life: .5, width: 4 });
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
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.type === 'ring' || p.type === 'ripple') p.r += p.grow * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.type === 'heart' || p.type === 'note' || p.type === 'zz') p.x += Math.sin(p.life * 4 + p.ph) * 18 * dt;
      if (p.type === 'petal') p.vx += Math.sin(p.life * 5 + p.rot) * 60 * dt;
      if (p.type === 'bubble') { p.x += Math.sin(p.life * 6 + p.r) * 12 * dt; if (p.y < LAKE.y + 4) p.life = 0; }
      if (p.type === 'leaf') { p.vx += Math.sin(p.life * 3 + p.rot) * 50 * dt; if (p.ground !== undefined && p.y > p.ground) { p.y = p.ground; p.vx = p.vy = p.vr = 0; p.g = 0; } }
    }
  }

  draw(ctx, cam) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'dot': case 'drop':
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * .4), 0, TAU); ctx.fill();
          break;
        case 'puff':
          ctx.globalAlpha = k * .9;
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k * .6), 0, TAU); ctx.fill();
          break;
        case 'spark': {
          const tw = .6 + .4 * Math.sin(p.twinkle + (1 - k) * 20);
          ctx.globalAlpha = k * tw;
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          ctx.globalAlpha = k * tw * .45;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.6, 0, TAU); ctx.fill();
          break;
        }
        case 'star':
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          starPath(ctx, 0, 0, p.r); ctx.fillStyle = p.col; ctx.fill();
          ctx.restore();
          break;
        case 'heart':
          ctx.globalAlpha = Math.min(1, k * 2);
          heartPath(ctx, p.x, p.y, p.r); ctx.fillStyle = p.col; ctx.fill();
          break;
        case 'petal':
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'ring':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.col; ctx.lineWidth = (p.width || 2) * k + .5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
          break;
        case 'ripple':
          ctx.globalAlpha = k * .8;
          ctx.strokeStyle = p.col; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .3, 0, 0, TAU); ctx.stroke();
          break;
        case 'text': {
          ctx.globalAlpha = Math.min(1, k * 2);
          const s = p.size / Math.max(.6, cam.zoom) * (1 + (1 - k) * .3);
          ctx.font = `900 ${s}px ${UI_FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = s * .18; ctx.strokeStyle = 'rgba(60,30,80,.6)'; ctx.lineJoin = 'round';
          ctx.strokeText(p.str, p.x, p.y);
          ctx.fillStyle = p.col; ctx.fillText(p.str, p.x, p.y);
          break;
        }
        case 'note': case 'zz': {
          ctx.globalAlpha = Math.min(1, k * 2);
          const s = (p.type === 'zz' ? 14 : 16) / Math.max(.6, cam.zoom);
          ctx.font = `900 ${s}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = s * .16; ctx.strokeStyle = 'rgba(60,30,80,.5)'; ctx.strokeText(p.type === 'zz' ? 'z' : '♪', p.x, p.y);
          ctx.fillStyle = p.col; ctx.fillText(p.type === 'zz' ? 'z' : '♪', p.x, p.y);
          break;
        }
        case 'bubble':
          ctx.globalAlpha = Math.min(1, k * 3) * .8;
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(p.x - p.r * .35, p.y - p.r * .35, p.r * .3, 0, TAU); ctx.fill();
          break;
        case 'leaf':
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
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

  /* additive re-draw of sparkly particles so they glow at night */
  drawGlow(ctx, k) {
    for (const p of this.list) {
      if (p.type !== 'spark' && p.type !== 'star' && p.type !== 'heart' && p.type !== 'conf') continue;
      const a = p.life / p.max;
      ctx.globalAlpha = a * k * (p.type === 'conf' ? .4 : .8);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, (p.r || 3) * 2.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ambient motes: pollen by day, fireflies by night ---------- */
  ensureAmbient(n, rect) {
    while (this.ambient.length < n) {
      this.ambient.push({ x: rnd(rect.l, rect.r), y: rnd(rect.t, rect.b), ph: rnd(TAU), sp: rnd(.4, 1.2), r: rnd(1.2, 2.6), blink: rnd(TAU) });
    }
  }
  drawAmbient(ctx, rect, time, night, dt, fireflyK = 1) {
    for (const m of this.ambient) {
      m.x += Math.sin(time * .5 + m.ph) * 14 * dt * m.sp + 6 * dt;
      m.y += Math.cos(time * .37 + m.ph * 1.3) * 10 * dt * m.sp - 3 * dt * (1 - night);
      if (m.x < rect.l) m.x = rect.r; if (m.x > rect.r) m.x = rect.l;
      if (m.y < rect.t) m.y = rect.b; if (m.y > rect.b) m.y = rect.t;
      if (night > .5 && fireflyK > 0) {
        const b = Math.max(0, Math.sin(time * 1.8 + m.blink));
        if (b < .15) continue;
        ctx.globalAlpha = b * night * fireflyK;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 7);
        g.addColorStop(0, 'rgba(220,255,140,.95)'); g.addColorStop(.3, 'rgba(180,255,100,.5)'); g.addColorStop(1, 'rgba(180,255,100,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 7, 0, TAU); ctx.fill();
      } else if (night <= .5) {
        ctx.globalAlpha = (0.25 + .2 * Math.sin(time * 2 + m.blink)) * (1 - night);
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * .8, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
