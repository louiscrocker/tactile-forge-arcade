/* ============================================================
   particles.js — bubbles, splashes, sparkles, pop-up text,
                  floating leaves, snow, fireflies and motes
   ============================================================ */
'use strict';

class Particles {
  constructor() {
    this.list = [];
    this.ambient = [];      // pollen / fireflies above the water
    this.motes = [];        // drifting specks under the water
  }

  spawn(p) {
    p.life = p.life || 1; p.max = p.life;
    this.list.push(p);
    if (this.list.length > 1000) this.list.splice(0, this.list.length - 1000);
    return p;
  }

  /* air bubbles rising from (x, y) underwater */
  bubbles(x, y, n = 4, big = 1) {
    for (let i = 0; i < n; i++) this.spawn({ type: 'bubble', x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: rnd(-6, 6), vy: rnd(-40, -20) * big, g: -30, r: rnd(1.2, 3) * big, wob: rnd(TAU), life: rnd(1.5, 3.5) });
  }
  /* a splash where something hits the surface */
  splash(x, y, power = 1, n = 14, bias = 0) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rnd(-1, 1) * .9, sp = rnd(60, 220) * power;
      this.spawn({ type: 'drop', x, y, vx: Math.cos(a) * sp + bias * rnd(.2, .7), vy: Math.sin(a) * sp * (1 - Math.abs(bias) / 900), g: 520, r: rnd(1.4, 3.4) * Math.sqrt(power), life: rnd(.5, 1.1) });
    }
    for (let i = 0; i < n * .5; i++) this.foam(x + rnd(-14, 14) * power, y);
    this.spawn({ type: 'ring', x, y, r: 6, grow: 140 * power, col: 'rgba(255,255,255,.7)', life: .6, flat: true });
    this.spawn({ type: 'ring', x, y, r: 2, grow: 90 * power, col: 'rgba(255,255,255,.45)', life: .9, flat: true });
  }
  foam(x, y) { this.spawn({ type: 'foam', x, y, r: rnd(1.2, 3), life: rnd(1.2, 3), ph: rnd(TAU) }); }
  ripple(x, y, power = 1) { this.spawn({ type: 'ring', x, y, r: 3, grow: 70 * power, col: 'rgba(255,255,255,.5)', life: .8, flat: true }); }

  /* green flecks when algae is scraped */
  flecks(x, y, col = '#8fd85a', n = 8) {
    for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(10, 50); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, g: -6, r: rnd(1, 2.4), col, life: rnd(.6, 1.4), drag: 2.5 }); }
  }
  splat(x, y, col = '#a6e05a', n = 12) {
    for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(30, 140); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, r: rnd(1.5, 4), col, life: rnd(.4, .9), drag: 2 }); }
    this.spawn({ type: 'ring', x, y, r: 4, grow: 90, col: 'rgba(255,255,255,.7)', life: .35 });
  }
  puff(x, y, col, n = 6) {
    for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(8, 30); this.spawn({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, r: rnd(1, 2.5), col, life: rnd(.5, 1), drag: 2 }); }
  }
  text(x, y, str, col = '#fff', size = 16) {
    this.spawn({ type: 'text', x, y, vx: rnd(-8, 8), vy: -55, g: 40, str, col, size, life: 1.1 });
  }
  sparkle(x, y, n = 30, col = '#fff6c8', spread = 40) {
    for (let i = 0; i < n; i++) { const a = rnd(TAU), r = Math.sqrt(Math.random()) * spread; this.spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: rnd(-10, 10), vy: rnd(-40, -10), g: -10, r: rnd(1.5, 3.5), col, life: rnd(.8, 1.8), twinkle: rnd(TAU) }); }
  }
  ring(x, y, col, r = 10, grow = 200, life = .6) { this.spawn({ type: 'ring', x, y, r, grow, col, life, width: 3 }); }
  /* a leaf falling onto the water, then floating and sinking */
  leaf(x, y, col) { this.spawn({ type: 'leaf', x, y, vx: rnd(-30, 30), vy: rnd(10, 30), g: 40, drag: 1.4, rot: rnd(TAU), vr: rnd(-2, 2), col, life: rnd(14, 22), floating: false, s: rnd(.8, 1.3) }); }
  snow(x, y) { this.spawn({ type: 'snow', x, y, vx: rnd(-14, 14), vy: rnd(18, 40), g: 0, r: rnd(1.2, 2.6), ph: rnd(TAU), life: 12 }); }
  confetti(x, y, n = 60) {
    const cols = ['#ff5d5d', '#ffd23f', '#5dd9ff', '#8cff7a', '#ff9ef0', '#ffffff'];
    for (let i = 0; i < n; i++) { const a = rnd(TAU), sp = rnd(80, 320); this.spawn({ type: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 300, r: rnd(2.5, 5), col: pick(cols), life: rnd(1.2, 2.4), rot: rnd(TAU), vr: rnd(-10, 10), drag: 1.2 }); }
  }
  /* a musical note drifting up from a singing frog */
  note(x, y, col = '#fff3b0') { this.spawn({ type: 'note', x, y, vx: rnd(-10, 10), vy: rnd(-40, -25), g: -5, life: 1.8, ph: rnd(TAU), col, size: rnd(10, 15) }); }

  /* pond is needed so drops know where the surface is and bubbles know where to pop */
  update(dt, pond) {
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
      if (!pond) continue;
      const surf = pond.surfaceAt(p.x);
      if (p.type === 'bubble') { p.x += Math.sin(p.life * 6 + p.wob) * 12 * dt; if (p.y < surf + 2) { L.splice(i, 1); if (Math.abs(p.x) < pond.W) pond.disturb(p.x, -3, 1); continue; } }
      if (p.type === 'drop' && p.vy > 0 && p.y > surf && Math.abs(p.x) < pond.W) { L.splice(i, 1); pond.disturb(p.x, p.vy * .05, 1); continue; }
      if (p.type === 'drop' && p.vy > 0 && pond.isLand(p.x) && p.y > pond.bedY(p.x)) { L.splice(i, 1); continue; }
      if (p.type === 'leaf') {
        if (!p.floating) {
          p.vx += Math.sin(p.life * 3 + p.rot) * 60 * dt;
          if (Math.abs(p.x) < pond.W && p.y >= surf - 1) { p.floating = true; p.y = surf - 1; p.vy = 0; p.vx *= .2; p.vr = 0; pond.disturb(p.x, 4, 1); p.sinkAt = p.life - rnd(5, 9); }
          else if (pond.isLand(p.x) && p.y >= pond.bedY(p.x) - 1) { p.y = pond.bedY(p.x) - 1; p.vx = 0; p.vy = 0; p.vr = 0; p.g = 0; p.floating = true; p.sinkAt = -1; }
        } else if (p.sinkAt >= 0 && p.life < p.sinkAt) { p.y += 12 * dt; p.x += Math.sin(p.life * 2) * 8 * dt; if (p.y > pond.bedY(p.x) - 2) p.life = Math.min(p.life, .5); }
        else if (!pond.isLand(p.x)) { p.y = surf - 1; p.x += (pond.weather.wind + pond.weather.gust) * 18 * dt; }
      }
      if (p.type === 'foam') { p.y = surf - .5; p.x += (pond.weather.wind + pond.weather.gust) * 10 * dt + Math.sin(p.life * 3 + p.ph) * 4 * dt; if (Math.abs(p.x) > pond.W) { L.splice(i, 1); continue; } }
      if (p.type === 'snow') {
        p.x += Math.sin(p.life * 1.7 + p.ph) * 14 * dt + pond.weather.wind * 20 * dt;
        const ground = pond.isLand(p.x) ? pond.bedY(p.x) : (pond.weather.ice > .5 ? -pond.weather.ice * 6 : surf);
        if (p.y >= ground) { L.splice(i, 1); continue; }
      }
    }
  }

  draw(ctx, cam, underwaterOnly) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'dot':
          ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * .4), 0, TAU); ctx.fill(); break;
        case 'bubble':
          ctx.globalAlpha = Math.min(1, k * 3) * .8;
          ctx.strokeStyle = 'rgba(235,250,255,.85)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .35, 0, TAU); ctx.fill(); break;
        case 'drop':
          ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = 'rgba(210,240,255,.85)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); break;
        case 'spark': {
          const tw = .6 + .4 * Math.sin(p.twinkle + (1 - k) * 20);
          ctx.globalAlpha = k * tw; ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          ctx.globalAlpha = k * tw * .5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, TAU); ctx.fill(); break;
        }
        case 'ring':
          ctx.globalAlpha = k; ctx.strokeStyle = p.col; ctx.lineWidth = (p.width || 2) * k + .5;
          ctx.beginPath();
          if (p.flat) ctx.ellipse(p.x, p.y, p.r, p.r * .22, 0, 0, TAU); else ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.stroke(); break;
        case 'text': {
          ctx.globalAlpha = Math.min(1, k * 2);
          const s = p.size / Math.max(.6, cam.zoom) * (1 + (1 - k) * .3);
          ctx.font = `900 ${s}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = s * .18; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round';
          ctx.strokeText(p.str, p.x, p.y); ctx.fillStyle = p.col; ctx.fillText(p.str, p.x, p.y); break;
        }
        case 'note': {
          ctx.globalAlpha = Math.min(1, k * 2);
          const s = p.size;
          ctx.font = `900 ${s}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = p.col; ctx.fillText('♪', p.x + Math.sin(p.life * 4 + p.ph) * 6, p.y); break;
        }
        case 'leaf':
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 3);
          ctx.translate(p.x, p.y); ctx.rotate(p.floating ? 0 : p.rot);
          if (p.floating) ctx.scale(1, .5);
          Sprites.drawLeaf(ctx, { s: p.s, col: p.col }); ctx.restore(); break;
        case 'foam':
          ctx.globalAlpha = k * .75; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.6, p.r * .7, 0, 0, TAU); ctx.fill(); break;
        case 'snow':
          ctx.globalAlpha = .85; ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); break;
        case 'conf':
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2); ctx.restore(); break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ambient: pollen by day, fireflies by night (above the water) ---------- */
  ensureAmbient(n, rect) {
    while (this.ambient.length < n) this.ambient.push({ x: rnd(rect.l, rect.r), y: rnd(rect.t, Math.min(rect.b, -10)), ph: rnd(TAU), sp: rnd(.4, 1.2), r: rnd(1.2, 2.6), blink: rnd(TAU) });
  }
  drawAmbient(ctx, rect, time, night, dt, pond) {
    const top = rect.t, bottom = -6;
    for (const m of this.ambient) {
      m.x += Math.sin(time * .5 + m.ph) * 14 * dt * m.sp + 6 * dt;
      m.y += Math.cos(time * .37 + m.ph * 1.3) * 10 * dt * m.sp - 3 * dt * (1 - night);
      if (m.x < rect.l) m.x = rect.r; if (m.x > rect.r) m.x = rect.l;
      if (m.y < top) m.y = bottom; if (m.y > bottom) m.y = top;
      if (pond && pond.isLand(m.x) && m.y > pond.bedY(m.x) - 4) m.y = pond.bedY(m.x) - 30;
      if (night > .5) {
        const b = Math.max(0, Math.sin(time * 1.8 + m.blink));
        if (b < .15) continue;
        ctx.globalAlpha = b * night;
        Sprites.drawFirefly(ctx, m.x, m.y, m.r, 1);
      } else {
        ctx.globalAlpha = (0.25 + .2 * Math.sin(time * 2 + m.blink)) * (1 - night);
        ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * .8, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  /* ---------- underwater motes ---------- */
  ensureMotes(n, rect) {
    while (this.motes.length < n) this.motes.push({ x: rnd(rect.l, rect.r), y: rnd(Math.max(rect.t, 4), rect.b), ph: rnd(TAU), r: rnd(.8, 2), a: rnd(.15, .45) });
  }
  drawMotes(ctx, rect, time, dt, pond) {
    for (const m of this.motes) {
      m.x += Math.sin(time * .3 + m.ph) * 6 * dt; m.y += Math.cos(time * .27 + m.ph * 1.7) * 5 * dt - 1.5 * dt;
      if (m.x < rect.l) m.x = rect.r; if (m.x > rect.r) m.x = rect.l;
      const surf = pond.surfaceAt(m.x), bed = pond.bedY(m.x);
      if (m.y < surf + 4 || m.y > bed || pond.isLand(m.x)) { m.y = rnd(surf + 10, Math.max(surf + 20, bed - 10)); m.x = rnd(rect.l, rect.r); }
      if (m.y < rect.t || m.y > rect.b) continue;
      ctx.globalAlpha = m.a; ctx.fillStyle = '#e8f6e0'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

const UI_FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';
