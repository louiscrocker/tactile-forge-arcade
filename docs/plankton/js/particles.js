/* ============================================================
   particles.js — sand, bubbles, sparkles, shed skins, pop-up text
   ============================================================ */
'use strict';

class Particles {
  /* k scales dots, sparks and bubbles: plankton is tiny, so the copepod's world uses about a third */
  constructor(k = .35) {
    this.list = []; this.k = k;
  }

  spawn(p) {
    p.life = p.life || 1; p.max = p.life;
    this.list.push(p);
    if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
    return p;
  }

  /* crumbs of sand or mud flying off the digging claws (they drift down slowly under water) */
  dust(x, y, col = '#8a6040', n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-1.4, 1.4) + Math.PI, sp = rnd(16, 50);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, g: 90, r: rnd(.8, 2.2), col, life: rnd(.4, .9), drag: 2 });
    }
  }
  splat(x, y, col = '#f2c54a', n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(30, 120);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 120, r: rnd(1.2, 3), col, life: rnd(.4, .8), drag: 2 });
    }
    this.spawn({ type: 'ring', x, y, r: 3, grow: 70, col: 'rgba(255,255,255,.7)', life: .35 });
  }
  puff(x, y, col, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(8, 30) * this.k;
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, r: rnd(1, 2.5) * this.k, col, life: rnd(.5, 1), drag: 2 });
    }
  }
  text(x, y, str, col = '#fff', size = 16) {
    this.spawn({ type: 'text', x, y, vx: rnd(-8, 8), vy: -55, g: 40, str, col, size, life: 1.1 });
  }
  sparkle(x, y, n = 30, col = '#fff6c8', spread = 40) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), r = Math.sqrt(Math.random()) * spread;
      this.spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: rnd(-10, 10), vy: rnd(-40, -10), g: -10, r: rnd(1.5, 3.5) * this.k, col, life: rnd(.8, 1.8), twinkle: rnd(TAU) });
    }
  }
  ring(x, y, col, r = 10, grow = 200, life = .6) {
    this.spawn({ type: 'ring', x, y, r, grow, col, life, width: 3 });
  }
  /* bubbles rising in the sea */
  bubbles(x, y, n = 6, size = 1) {
    for (let i = 0; i < n; i++) this.spawn({ type: 'bubble', x: x + rnd(-2, 2) * size, y: y + rnd(-2, 2) * size, vx: rnd(-4, 4), vy: rnd(-26, -10), g: -20, r: rnd(.5, 1.4) * size * this.k, life: rnd(.8, 1.6), drag: 1, wob: rnd(TAU) });
  }
  /* the old see-through skin floating off after a larval moult */
  shed(x, y, r) { this.spawn({ type: 'skin', x, y, vx: rnd(-6, 6), vy: rnd(-6, 2), g: 2, r, life: 3, rot: rnd(TAU), vr: rnd(-1, 1), drag: .6 }); }
  drip(x, y) { this.spawn({ type: 'dot', x, y, vx: 0, vy: 30, g: 200, r: 1.8, col: 'rgba(190,225,255,.9)', life: 1 }); }
  /* a scrap of kelp or shell tumbling down */
  bit(x, y, col) {
    this.spawn({ type: 'bit', x, y, vx: rnd(-20, 20), vy: rnd(6, 20), g: 20, drag: 1.4, rot: rnd(TAU), vr: rnd(-2, 2), col, life: rnd(4, 7) });
  }
  confetti(x, y, n = 60) {
    const cols = ['#ff5d5d', '#ffd23f', '#5dd9ff', '#8cff7a', '#ff9ef0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), sp = rnd(80, 320);
      this.spawn({ type: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 160, r: rnd(2.5, 5), col: pick(cols), life: rnd(1.2, 2.4), rot: rnd(TAU), vr: rnd(-10, 10), drag: 1.6 });
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
      if (p.type === 'bit') {
        p.vx += Math.sin(p.life * 3 + p.rot) * 40 * dt;
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
        case 'bit':
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col || '#7a8a2a';
          ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'bubble':
          ctx.globalAlpha = Math.min(1, k * 2) * .8;
          ctx.strokeStyle = 'rgba(220,245,255,.9)'; ctx.lineWidth = Math.max(.15, p.r * .25);
          ctx.beginPath(); ctx.arc(p.x + Math.sin(p.life * 8 + p.wob) * p.r * .6, p.y, p.r, 0, TAU); ctx.stroke();
          break;
        case 'skin':
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5) * .5;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.strokeStyle = 'rgba(255,240,225,.9)'; ctx.fillStyle = 'rgba(255,240,225,.25)'; ctx.lineWidth = Math.max(.2, p.r * .08);
          ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.1, p.r * .9, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.r * .8, -p.r * .3); ctx.lineTo(p.r * 1.8, -p.r * .6); ctx.stroke();
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
}

const UI_FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';
