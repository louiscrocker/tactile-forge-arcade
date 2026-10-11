/* ============================================================
   particles.js — earth, snow, sparkles, breath, leaves, pop-up text
   ============================================================ */
'use strict';

class Particles {
  constructor() {
    this.list = [];
    this.ambient = [];
  }

  spawn(p) {
    p.life = p.life || 1; p.max = p.life;
    this.list.push(p);
    if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
    return p;
  }

  /* crumbs of earth flying off the digging paws */
  dust(x, y, col = '#8a6040', n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-1.4, 1.4) + Math.PI, sp = rnd(20, 70);
      this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, g: 240, r: rnd(.8, 2.2), col, life: rnd(.3, .7), drag: 1.5 });
    }
  }
  /* snow kicked up by running paws */
  snowKick(x, y, n = 5) {
    for (let i = 0; i < n; i++) { const a = rnd(-2.6, -.5), sp = rnd(20, 60); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 200, r: rnd(.8, 2), col: 'rgba(255,255,255,.9)', life: rnd(.3, .6), drag: 1.2 }); }
  }
  /* a puff of warm breath on a cold day */
  breath(x, y, dir = 1) {
    for (let i = 0; i < 3; i++) this.spawn({ type: 'dot', x: x + rnd(-1, 1), y: y + rnd(-1, 1), vx: dir * rnd(6, 14), vy: rnd(-8, -3), g: -6, r: rnd(1.5, 3), col: 'rgba(240,248,255,.35)', life: rnd(.6, 1.1), drag: 1.5 });
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
  /* a howl's sound rings, spreading out */
  howlRings(x, y, col = 'rgba(255,240,180,.8)') {
    for (let k = 0; k < 3; k++) this.spawn({ type: 'ring', x, y, r: 6 + k * 10, grow: 160 + k * 40, col, life: .9 + k * .25, width: 2 });
  }
  /* bubbles in the river */
  bubbles(x, y, n = 6, size = 1) {
    for (let i = 0; i < n; i++) this.spawn({ type: 'bubble', x: x + rnd(-2, 2) * size, y: y + rnd(-2, 2) * size, vx: rnd(-4, 4), vy: rnd(-26, -10), g: -20, r: rnd(.5, 1.4) * size, life: rnd(.5, 1), drag: 1, wob: rnd(TAU) });
  }
  /* water shaken off a wet coat */
  shake(x, y, n = 14) {
    for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(30, 110); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 300, r: rnd(1, 2), col: 'rgba(190,225,255,.9)', life: rnd(.4, .8), drag: 1 }); }
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
          ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(.5, .5);
          Sprites.drawLeaf(ctx, 12, 0, p.col || '#e8b030');
          ctx.restore();
          break;
        case 'bubble':
          ctx.globalAlpha = Math.min(1, k * 2) * .8;
          ctx.strokeStyle = 'rgba(220,245,255,.9)'; ctx.lineWidth = Math.max(.15, p.r * .25);
          ctx.beginPath(); ctx.arc(p.x + Math.sin(p.life * 8 + p.wob) * p.r * .6, p.y, p.r, 0, TAU); ctx.stroke();
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
