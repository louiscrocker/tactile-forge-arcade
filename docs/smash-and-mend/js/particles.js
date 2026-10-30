/* ============================================================
   particles.js — the juice: dust clouds, sparkles, confetti,
   splashes, rain, and the big wobbly words ("CRUMBLE!", "x4!").
   Purely visual; the rules never read it.
   ============================================================ */
'use strict';

class Particles {
  constructor() { this.list = []; this.words = []; this.rain = []; }
  add(p) { if (this.list.length > 700) this.list.shift(); this.list.push(p); }
  dust(x, y, n, col = '#d8c8b0', big = 1) {
    for (let k = 0; k < n; k++) this.add({ kind: 'dust', x: x + rnd(-20, 20) * big, y: y + rnd(-10, 6), vx: rnd(-60, 60) * big, vy: rnd(-70, -10), r: rnd(8, 18) * big, grow: rnd(14, 30), life: rnd(.8, 1.6), t: 0, col });
  }
  sparkle(x, y, n, col = '#fff3a0') {
    for (let k = 0; k < n; k++) { const a = rnd(TAU), s = rnd(60, 220); this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rnd(.4, .9), t: 0, col, r: rnd(2, 4.5) }); }
  }
  confetti(x, y, n) {
    for (let k = 0; k < n; k++) this.add({ kind: 'conf', x: x + rnd(-40, 40), y, vx: rnd(-200, 200), vy: rnd(-520, -200), life: rnd(1.6, 2.6), t: 0, col: pick(['#ff6a8a', '#ffd24a', '#5ac0f0', '#7ad05a', '#a070e0']), rot: rnd(TAU), vr: rnd(-10, 10) });
  }
  drops(x, y, n, col = '#7ab8f0') { for (let k = 0; k < n; k++) this.add({ kind: 'drop', x, y, vx: rnd(-90, 90), vy: rnd(-220, -60), life: rnd(.4, .8), t: 0, col, r: rnd(2, 3.5) }); }
  ring(x, y, col = '#ffffff', r = 40) { this.add({ kind: 'ring', x, y, life: .35, t: 0, col, r }); }
  word(text, x, y, col = '#ffd24a', size = 30, tag = '') { if (tag) this.words = this.words.filter(w => w.tag !== tag); if (this.words.length > 12) this.words.shift(); this.words.push({ text, x, y, col, size, t: 0, life: 1.1, tag }); }
  update(dt) {
    for (let n = this.list.length - 1; n >= 0; n--) {
      const p = this.list[n]; p.t += dt;
      if (p.t >= p.life) { this.list.splice(n, 1); continue; }
      if (p.kind === 'dust') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.2, dt); p.vy *= Math.pow(.3, dt); p.r += p.grow * dt; }
      else if (p.kind === 'spark' || p.kind === 'drop') { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      else if (p.kind === 'conf') { p.vy = Math.min(p.vy + 700 * dt, 140); p.vx *= Math.pow(.4, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    }
    for (let n = this.words.length - 1; n >= 0; n--) { const w = this.words[n]; w.t += dt; w.y -= 40 * dt; if (w.t > w.life) this.words.splice(n, 1); }
  }
  /* layer 'back' = dust (behind the characters), 'front' = everything else */
  draw(ctx, layer) {
    for (const p of this.list) {
      if (layer && (layer === 'back') !== (p.kind === 'dust')) continue;
      const a = 1 - p.t / p.life;
      if (p.kind === 'dust') { ctx.fillStyle = withAlpha(p.col, a * .5); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      else if (p.kind === 'spark') { ctx.fillStyle = withAlpha(p.col, a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.5 + a * .5), 0, TAU); ctx.fill(); }
      else if (p.kind === 'drop') { ctx.fillStyle = withAlpha(p.col, a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      else if (p.kind === 'conf') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = withAlpha(p.col, Math.min(1, a * 2)); ctx.fillRect(-4, -2.5, 8, 5); ctx.restore(); }
      else if (p.kind === 'ring') { ctx.strokeStyle = withAlpha(p.col, a); ctx.lineWidth = 4 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - a * .6), 0, TAU); ctx.stroke(); }
    }
  }
  drawWords(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const w of this.words) {
      const pop = w.t < .15 ? easeOutBack(w.t / .15) : 1, a = Math.min(1, (w.life - w.t) * 3);
      ctx.save(); ctx.translate(w.x, w.y); ctx.scale(pop, pop); ctx.rotate(Math.sin(w.t * 9) * .06);
      ctx.font = `900 ${w.size}px ${UI_FONT}`; ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(58,36,24,${a})`; ctx.lineWidth = w.size * .22; ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = withAlpha(w.col, a); ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }
  }
  /* rain in screen space */
  drawRain(ctx, W, H, amount, wind, t) {
    if (amount <= 0) return;
    const n = Math.floor(160 * amount);
    while (this.rain.length < n) this.rain.push({ x: rnd(W), y: rnd(H), s: rnd(600, 900) });
    this.rain.length = n;
    ctx.strokeStyle = 'rgba(190,210,255,.45)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (const r of this.rain) {
      r.y += r.s / 60; r.x += wind * 3; if (r.y > H) { r.y = -20; r.x = rnd(-50, W + 50); } if (r.x > W + 50) r.x = -40; if (r.x < -50) r.x = W + 40;
      ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - wind * 4 - 2, r.y - 14);
    }
    ctx.stroke();
  }
}
