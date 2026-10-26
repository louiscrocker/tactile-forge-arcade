/* ============================================================
   particles.js — dust, sparks, smoke, steam, fireflies, fireworks,
                  confetti, hearts and pop-up text
   ============================================================ */
'use strict';

class Particles {
  constructor() { this.list = []; }
  spawn(p) { p.life = p.life || 1; p.max = p.life; this.list.push(p); if (this.list.length > 1200) this.list.splice(0, this.list.length - 1200); return p; }

  /* stone dust when a block lands or is knocked out */
  dust(x, y, col = '#b8b2a6', n = 8) { for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(20, 80); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, r: rnd(1, 3), col, life: rnd(.4, .8), drag: 1.5 }); } }
  splat(x, y, col = '#4a90d0', n = 12) { for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(30, 120); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 300, r: rnd(1.2, 3), col, life: rnd(.4, .8), drag: 1 }); } this.spawn({ type: 'ring', x, y, r: 3, grow: 70, col: 'rgba(255,255,255,.7)', life: .35 }); }
  puff(x, y, col = 'rgba(230,230,230,.8)', n = 6) { for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(8, 30); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, g: -10, r: rnd(2, 5), col, life: rnd(.5, 1), drag: 2 }); } }
  text(x, y, str, col = '#fff', size = 16) { this.spawn({ type: 'text', x, y, vx: rnd(-8, 8), vy: -55, g: 40, str, col, size, life: 1.1 }); }
  sparkle(x, y, n = 30, col = '#fff6c8', spread = 40) { for (let i = 0; i < n; i++) { const a = rnd(TAU), r = Math.sqrt(Math.random()) * spread; this.spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: rnd(-10, 10), vy: rnd(-40, -10), g: -10, r: rnd(1.5, 3.5), col, life: rnd(.8, 1.8), twinkle: rnd(TAU) }); } }
  ring(x, y, col, r = 10, grow = 200, life = .6) { this.spawn({ type: 'ring', x, y, r, grow, col, life, width: 3 }); }
  smoke(x, y, s = 1) { this.spawn({ type: 'smoke', x, y, vx: rnd(-4, 4), vy: rnd(-22, -14) * s, g: -6, r: rnd(2, 4) * s, life: rnd(2.5, 4.5), drag: .3, wob: rnd(TAU) }); }
  steam(x, y) { this.spawn({ type: 'smoke', x, y, vx: rnd(-6, 6), vy: rnd(-30, -18), g: -4, r: rnd(2, 3.5), life: rnd(.8, 1.4), drag: .5, wob: rnd(TAU), white: true }); }
  sparks(x, y, n = 6) { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0), sp = rnd(60, 160); this.spawn({ type: 'ember', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 320, r: rnd(.8, 1.8), col: '#ffb040', life: rnd(.3, .7), drag: .5 }); } }
  firefly(x, y) { this.spawn({ type: 'firefly', x, y, vx: rnd(-10, 10), vy: rnd(-6, 6), g: 0, r: 1.6, life: rnd(3, 6), twinkle: rnd(TAU), wob: rnd(TAU) }); }
  drip(x, y) { this.spawn({ type: 'dot', x, y, vx: rnd(-10, 10), vy: -20, g: 200, r: 1.6, col: 'rgba(190,225,255,.9)', life: .7 }); }
  hearts(x, y, n = 3) { for (let i = 0; i < n; i++) this.spawn({ type: 'text', x: x + rnd(-10, 10), y, vx: rnd(-6, 6), vy: -40, g: 10, str: '♥', col: '#ff6a9a', size: rnd(12, 18), life: 1.4 }); }
  confetti(x, y, n = 60) { const cols = ['#ff5d5d', '#ffd23f', '#5dd9ff', '#8cff7a', '#ff9ef0', '#ffffff']; for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(80, 320); this.spawn({ type: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 160, r: rnd(2.5, 5), col: pick(cols), life: rnd(1.2, 2.4), rot: rnd(TAU), vr: rnd(-10, 10), drag: 1.6 }); } }
  coins(x, y, n = 8) { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI * .9, -Math.PI * .1), sp = rnd(60, 160); this.spawn({ type: 'coin', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, r: rnd(2.5, 3.5), life: rnd(.9, 1.4), rot: rnd(TAU), vr: rnd(-8, 8) }); } }
  /* a rocket that bursts into a flower of light */
  firework(x, y) { this.spawn({ type: 'rocket', x, y: GROUND_Y - 10, vx: rnd(-10, 10), vy: -rnd(260, 340), g: 120, r: 2, life: rnd(1.1, 1.5), burstY: y, col: pick(['#ff6090', '#ffd040', '#60c0ff', '#90ff80', '#ffffff', '#ff9040']), trail: 0 }); }
  burst(x, y, col) { const n = 70; for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(-.1, .1), sp = rnd(80, 160); this.spawn({ type: 'fw', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, r: rnd(1.6, 2.8), col: Math.random() < .25 ? '#ffffff' : col, life: rnd(1, 1.8), drag: 1.2, twinkle: rnd(TAU) }); } this.spawn({ type: 'ring', x, y, r: 4, grow: 300, col: 'rgba(255,255,255,.6)', life: .5, width: 2 }); }

  update(dt, groundAt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { if (p.type === 'rocket') this.burst(p.x, p.y, p.col); L.splice(i, 1); continue; }
      if (p.vx !== undefined) {
        p.vy += (p.g || 0) * dt;
        if (p.drag) { const k = 1 - Math.min(1, p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.type === 'ring') p.r += p.grow * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.type === 'smoke') { p.x += Math.sin(p.life * 2 + p.wob) * 8 * dt; p.r += dt * 2.5; }
      if (p.type === 'firefly') { p.vx += Math.sin(p.life * 1.7 + p.wob) * 30 * dt; p.vy += Math.cos(p.life * 1.3 + p.wob) * 30 * dt; }
      if (p.type === 'rocket') { if (p.y < p.burstY || p.vy > -20) { this.burst(p.x, p.y, p.col); L.splice(i, 1); continue; } p.trail -= dt; if (p.trail <= 0) { p.trail = .03; this.spawn({ type: 'ember', x: p.x, y: p.y, vx: rnd(-10, 10), vy: rnd(10, 40), g: 60, r: 1.2, col: '#ffd890', life: .35 }); } }
      if ((p.type === 'coin' || p.type === 'conf') && groundAt) { const gy = groundAt(p.x); if (p.y > gy) { p.y = gy; p.vy = -Math.abs(p.vy) * .3; p.vx *= .6; } }
    }
  }

  draw(ctx, cam) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'dot': ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * .4), 0, TAU); ctx.fill(); break;
        case 'ember': ctx.globalAlpha = k; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); break;
        case 'spark': case 'fw': { const tw = .6 + .4 * Math.sin(p.twinkle + (1 - k) * 20); ctx.globalAlpha = k * tw; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = k * tw * .45; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.6, 0, TAU); ctx.fill(); break; }
        case 'firefly': { const tw = Math.max(0, Math.sin(p.twinkle + (1 - k) * 14)); ctx.globalAlpha = Math.min(1, k * 2) * tw; ctx.fillStyle = '#d8ff80'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha *= .4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.5, 0, TAU); ctx.fill(); break; }
        case 'smoke': ctx.globalAlpha = Math.min(1, k * 1.4) * (p.white ? .55 : .35); ctx.fillStyle = p.white ? '#ffffff' : '#6a6a72'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); break;
        case 'ring': ctx.globalAlpha = k; ctx.strokeStyle = p.col; ctx.lineWidth = (p.width || 2) * k + .5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); break;
        case 'rocket': ctx.globalAlpha = 1; ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); break;
        case 'text': { ctx.globalAlpha = Math.min(1, k * 2); const s = p.size / Math.max(.6, cam.zoom) * (1 + (1 - k) * .3); ctx.font = `900 ${s}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = s * .18; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round'; ctx.strokeText(p.str, p.x, p.y); ctx.fillStyle = p.col; ctx.fillText(p.str, p.x, p.y); break; }
        case 'conf': ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2); ctx.restore(); break;
        case 'coin': ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y); ctx.scale(Math.abs(Math.cos(p.rot)) * .7 + .3, 1); ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b8862a'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

const UI_FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';
