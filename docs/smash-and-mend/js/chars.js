/* ============================================================
   chars.js — Mungo (the big, gentle demolition giant with his
   boulder mitts and his grey beard) and Pip (the tiny fixer with
   the tool belt, the round glasses and the bucket), and the hats.
   draw*(ctx, actor, opts): origin at the feet, facing actor.face.
   ============================================================ */
'use strict';

const Chars = {
  squash(ctx, a) { const q = a.squash || 0; if (q > 0) ctx.scale(1 + q * .22, 1 - q * .24); else if (q < 0) ctx.scale(1 + q * .12, 1 - q * .2); },
  shadow(ctx, x, y, w) { ctx.fillStyle = 'rgba(30,20,10,.22)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * .22, 0, 0, TAU); ctx.fill(); },
  boulder(ctx, x, y, r, seed) {
    const g = ctx.createRadialGradient(x - r * .4, y - r * .4, r * .2, x, y, r);
    g.addColorStop(0, '#c8c4bc'); g.addColorStop(.6, '#8e8a84'); g.addColorStop(1, '#5e5a56');
    ctx.fillStyle = g; ctx.beginPath();
    for (let k = 0; k < 9; k++) { const an = k / 9 * TAU, rr2 = r * (.9 + Sprites.hash(seed, k) * .18); ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,20,.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - r * .3, y - r * .5); ctx.lineTo(x, y - r * .1); ctx.lineTo(x - r * .1, y + r * .4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - r * .35, y - r * .4, r * .25, r * .15, -.6, 0, TAU); ctx.fill();
  },
  stars(ctx, x, y, t, n = 3) {
    for (let k = 0; k < n; k++) {
      const an = t * 5 + k / n * TAU, sx = x + Math.cos(an) * 20, sy = y + Math.sin(an) * 6;
      ctx.fillStyle = '#ffe24a'; ctx.strokeStyle = '#b8801a'; ctx.lineWidth = 1;
      ctx.beginPath(); for (let p = 0; p < 10; p++) { const r = p % 2 ? 2.6 : 6, aa = p / 10 * TAU - Math.PI / 2; ctx.lineTo(sx + Math.cos(aa) * r, sy + Math.sin(aa) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },

  mungo(ctx, a, o = {}) {
    const t = a.anim || 0, moving = Math.abs(a.vx) > 20 && a.onGround, ph = moving ? Math.sin(t * 11) : 0;
    if (a.onGround !== false && !o.noShadow) this.shadow(ctx, a.x, a.y, 30);
    ctx.save(); ctx.translate(a.x, a.y);
    const wob = a.dizzy > 0 ? Math.sin(t * 9) * .08 : 0; ctx.rotate(wob);
    this.squash(ctx, a); ctx.scale(a.face || 1, 1);
    const bob = moving ? Math.abs(ph) * 3 : Math.sin(t * 2.2) * 1.2, air = a.onGround === false;
    /* legs and boots */
    for (const s of [-1, 1]) {
      const lx = s * 12 + (moving ? ph * s * 8 : 0), ly = air ? -6 : 0;
      ctx.fillStyle = '#3a5a8a'; rr(ctx, lx - 8, -24 + ly, 16, 18, 5); ctx.fill();
      ctx.fillStyle = '#5a3a24'; rr(ctx, lx - 10, -9 + ly, 22, 10, 5); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.translate(0, -bob);
    /* body: blue jumper under a hi-vis jacket */
    ctx.fillStyle = '#ef7a2a'; ctx.beginPath(); ctx.ellipse(0, -44, 30, 27, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#2e5e9e'; ctx.beginPath(); ctx.moveTo(-8, -70); ctx.lineTo(8, -70); ctx.lineTo(4, -36); ctx.lineTo(-4, -36); ctx.fill();
    ctx.fillStyle = '#ffe85a'; for (const yy of [-48, -36]) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, -44, 29, 26, 0, 0, TAU); ctx.clip(); ctx.fillRect(-30, yy, 60, 5); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-30, yy, 60, 1.5); ctx.fillStyle = '#ffe85a'; ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-12, -58, 10, 6, -.5, 0, TAU); ctx.fill();
    /* head */
    const hy = -78 + (a.dizzy > 0 ? Math.sin(t * 7) * 2 : 0);
    ctx.fillStyle = '#f2b48a'; ctx.beginPath(); ctx.arc(2, hy, 17, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = '#d8dce6'; ctx.strokeStyle = '#8a90a0'; ctx.lineWidth = 1.2;
    for (const [bx, by, br] of [[-10, hy + 6, 7], [-3, hy + 12, 8], [6, hy + 12, 8], [13, hy + 6, 7], [2, hy + 16, 6]]) { ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#d8dce6'; ctx.beginPath(); ctx.ellipse(6, hy + 4, 9, 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e88a6a'; ctx.beginPath(); ctx.arc(10, hy - 1, 4.2, 0, TAU); ctx.fill();
    ctx.fillStyle = INK;
    if (a.dizzy > 0) { ctx.lineWidth = 1.6; ctx.strokeStyle = INK; for (const ex of [1, 13]) { ctx.beginPath(); ctx.arc(ex, hy - 6, 2.6, 0, 5); ctx.stroke(); } }
    else if (a.cheer > 0 || o.happy) { ctx.lineWidth = 2; ctx.strokeStyle = INK; for (const ex of [1, 13]) { ctx.beginPath(); ctx.arc(ex, hy - 5, 2.4, Math.PI, TAU); ctx.stroke(); } }
    else for (const ex of [1, 13]) { ctx.beginPath(); ctx.arc(ex, hy - 6, 2.1, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#7a8090'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, hy - 11); ctx.lineTo(4, hy - 12); ctx.moveTo(10, hy - 12); ctx.lineTo(17, hy - 10); ctx.stroke();
    this.hat(ctx, o.hat || 'hardhat', 2, hy - 14, 17);
    /* the boulder mitts */
    let f1 = [30, -40], f2 = [-28, -38];
    const p = a.punchT > 0 ? a.punchT / .2 : 0;
    if (a.climbing) { const c = Math.sin(t * 12); f1 = [24, -70 - c * 12]; f2 = [20, -50 + c * 12]; }
    else if (a.pound) { f1 = [18, -8]; f2 = [-14, -8]; }
    else if (p > 0 && a.punchDir === 'side') { const e = Math.sin(p * Math.PI); f1 = [30 + e * 30, -44]; f2 = [-20, -46]; }
    else if (p > 0 && a.punchDir === 'up') { const e = Math.sin(p * Math.PI); f1 = [10, -70 - e * 34]; f2 = [-22, -40]; }
    else if (p > 0 && a.punchDir === 'down') { const e = Math.sin(p * Math.PI); f1 = [22, -18 + e * 18]; f2 = [-22, -36]; }
    else if (a.cheer > 0 || o.happy) { const c = Math.abs(Math.sin(t * 6)); f1 = [26, -96 - c * 8]; f2 = [-24, -96 - c * 8]; }
    else if (moving) { f1 = [30, -38 + ph * 8]; f2 = [-28, -38 - ph * 8]; }
    else if (a.dizzy > 0) { f1 = [28, -22]; f2 = [-26, -22]; }
    ctx.strokeStyle = '#d8661e'; ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, -58); ctx.lineTo(f2[0] * .7, f2[1] * .85 - 6); ctx.stroke();
    this.boulder(ctx, f2[0], f2[1], 13, 2);
    ctx.strokeStyle = '#ef7a2a'; ctx.beginPath(); ctx.moveTo(18, -58); ctx.lineTo(f1[0] * .7, f1[1] * .85 - 4); ctx.stroke();
    this.boulder(ctx, f1[0], f1[1], 14, 1);
    ctx.restore();
    if (a.dizzy > 0) this.stars(ctx, a.x, a.y - 100, t);
  },

  pip(ctx, a, o = {}) {
    const t = a.anim || 0, moving = Math.abs(a.vx) > 20 && a.onGround, ph = moving ? Math.sin(t * 16) : 0;
    if (a.onGround && !o.noShadow) this.shadow(ctx, a.x, a.y, 13);
    ctx.save(); ctx.translate(a.x, a.y);
    ctx.rotate(a.dizzy > 0 ? Math.sin(t * 10) * .12 : 0);
    this.squash(ctx, a); ctx.scale(a.face || 1, 1);
    const bob = moving ? Math.abs(ph) * 2 : 0, air = !a.onGround && !a.onLadder;
    for (const s of [-1, 1]) {
      const lx = s * 4 + (moving ? ph * s * 4 : 0) + (a.onLadder ? 0 : 0), ly = a.onLadder ? Math.sin(t * 9 + s) * 3 : air ? -3 : 0;
      ctx.fillStyle = '#7a4aa8'; ctx.fillRect(lx - 2.5, -13 + ly, 5, 9);
      ctx.fillStyle = '#d84a3a'; rr(ctx, lx - 3.5, -5 + ly, 8, 5, 2); ctx.fill();
    }
    ctx.translate(0, -bob);
    ctx.fillStyle = '#f39a2b'; rr(ctx, -8, -27, 16, 16, 5); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#7a4aa8'; rr(ctx, -7, -20, 14, 9, 3); ctx.fill(); ctx.fillRect(-6, -27, 2.5, 8); ctx.fillRect(3.5, -27, 2.5, 8);
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-8.5, -15, 17, 3.5);
    ctx.fillStyle = '#9aa4b0'; ctx.fillRect(-9, -16, 2.5, 7);
    ctx.fillStyle = '#e8d070'; rr(ctx, 5, -16, 5, 6, 1.5); ctx.fill();
    const hy = -36;
    ctx.fillStyle = '#f6c8a0'; ctx.beginPath(); ctx.arc(1, hy, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#6a3a1a'; for (const [x, y] of [[-8, hy - 4], [-5, hy - 8], [-9, hy + 1]]) { ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 1.3; ctx.fillStyle = 'rgba(200,230,255,.45)';
    for (const ex of [2, 9]) { ctx.beginPath(); ctx.arc(ex, hy - 1, 3.4, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = INK;
    if (a.dizzy > 0) { ctx.font = `900 6px ${UI_FONT}`; ctx.fillText('@', -.5, hy + 1); ctx.fillText('@', 6.5, hy + 1); }
    else for (const ex of [2.4, 9.4]) { ctx.beginPath(); ctx.arc(ex, hy - 1, 1.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(220,110,90,.55)'; for (const fx of [-1, 7, 11]) { ctx.beginPath(); ctx.arc(fx, hy + 4, .9, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(6, hy + 5, 2.6, .2, Math.PI - .2); ctx.stroke();
    this.hat(ctx, o.hat || 'beanie', 1, hy - 8, 11);
    /* arms, tools and the bucket */
    ctx.strokeStyle = '#f39a2b'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    if (a.bucket) {
      ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-8, -50); ctx.moveTo(6, -24); ctx.lineTo(8, -50); ctx.stroke();
      this.bucket(ctx, 0, -50, o.bucket || '#3a8ad8');
    } else if (a.onLadder) {
      const c = Math.sin(t * 9); ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(-3, -40 - c * 5); ctx.moveTo(4, -24); ctx.lineTo(3, -40 + c * 5); ctx.stroke();
    } else if (a.fixT > 0) {
      const w = Math.sin(a.fixT * 40) * .5;
      ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(13, -34); ctx.stroke();
      ctx.save(); ctx.translate(14, -36); ctx.rotate(w - .6);
      if (a.fixKind === 'glue') { ctx.fillStyle = '#e8d070'; rr(ctx, -4, -4, 8, 9, 2); ctx.fill(); ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-1, -12, 2, 9); ctx.fillStyle = '#f8f0c0'; ctx.fillRect(-2, -14, 4, 3); }
      else { ctx.fillStyle = '#a8b0bc'; ctx.fillRect(-1.5, -12, 3, 14); ctx.beginPath(); ctx.arc(0, -13, 4, .6, TAU - .6); ctx.fill(); }
      ctx.restore();
    } else {
      const s2 = moving ? ph * 5 : 0;
      ctx.beginPath(); ctx.moveTo(-5, -24); ctx.lineTo(-8 - s2, -14); ctx.moveTo(5, -24); ctx.lineTo(8 + s2, -14); ctx.stroke();
    }
    ctx.restore();
    if (a.dizzy > 0) this.stars(ctx, a.x, a.y - 54, t);
  },
  bucket(ctx, x, y, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 12, y - 10); ctx.lineTo(x + 12, y - 10); ctx.lineTo(x + 9, y + 4); ctx.lineTo(x - 9, y + 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - 9, y - 8, 4, 10);
    ctx.fillStyle = shade(col, .6); ctx.beginPath(); ctx.ellipse(x, y - 10, 12, 3, 0, 0, TAU); ctx.fill();
  },

  hat(ctx, key, x, y, r) {
    ctx.save(); ctx.translate(x, y); const s = r / 17; ctx.scale(s, s); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    if (key === 'hardhat') { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 2, 17, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillRect(-22, 0, 44, 5); ctx.strokeRect(-22, 0, 44, 5); ctx.fillStyle = '#f0b020'; ctx.fillRect(-3, -14, 6, 15); }
    else if (key === 'bobble') { ctx.fillStyle = '#d83a3a'; ctx.beginPath(); ctx.arc(0, 3, 16, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-17, -1, 34, 6); ctx.beginPath(); ctx.arc(0, -15, 6, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (key === 'flowers') { for (let k = 0; k < 6; k++) { const an = Math.PI + k / 5 * Math.PI; ctx.fillStyle = ['#ff7aa8', '#ffe24a', '#8ad0ff'][k % 3]; ctx.beginPath(); ctx.arc(Math.cos(an) * 15, 4 + Math.sin(an) * 6, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(Math.cos(an) * 15, 4 + Math.sin(an) * 6, 1.8, 0, TAU); ctx.fill(); } }
    else if (key === 'cowboy') { ctx.fillStyle = '#a86a3a'; ctx.beginPath(); ctx.ellipse(0, 2, 28, 6, 0, 0, TAU); ctx.fill(); ctx.stroke(); rr(ctx, -12, -18, 24, 20, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-12, -4, 24, 4); }
    else if (key === 'party') { ctx.fillStyle = '#5ac0f0'; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(0, -30); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffe24a'; for (const [px, py] of [[-4, -6], [4, -14], [0, -22]]) { ctx.beginPath(); ctx.arc(px, py, 2.4, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.arc(0, -31, 4, 0, TAU); ctx.fill(); }
    else if (key === 'viking') { ctx.fillStyle = '#9aa4b0'; ctx.beginPath(); ctx.arc(0, 3, 17, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f6efd8'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s2 * 13, -4); ctx.quadraticCurveTo(s2 * 30, -10, s2 * 26, -28); ctx.quadraticCurveTo(s2 * 22, -12, s2 * 9, -10); ctx.fill(); ctx.stroke(); } }
    else if (key === 'beanie') { ctx.fillStyle = '#3aa86a'; ctx.beginPath(); ctx.arc(0, 4, 16, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2a8a5a'; ctx.fillRect(-17, 0, 34, 6); ctx.fillStyle = '#ffe24a'; ctx.beginPath(); ctx.arc(0, -13, 6, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (key === 'cap') { ctx.fillStyle = '#d83a3a'; ctx.beginPath(); ctx.arc(0, 4, 15, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(-16, 3, 10, 3.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (key === 'bow') { ctx.fillStyle = '#ff6aa0'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(s2 * 16, -14); ctx.lineTo(s2 * 16, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.arc(0, -5, 4, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (key === 'propeller') { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 4, 15, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3a8ad8'; ctx.beginPath(); ctx.arc(0, 4, 15, Math.PI * 1.33, Math.PI * 1.66); ctx.lineTo(0, 4); ctx.fill(); ctx.fillStyle = '#d83a3a'; const sp = (performance.now() / 60) % TAU; ctx.save(); ctx.translate(0, -14); ctx.scale(Math.cos(sp), 1); ctx.fillRect(-16, -2, 32, 4); ctx.restore(); ctx.fillRect(-1.5, -14, 3, 4); }
    else if (key === 'helmet') { ctx.fillStyle = '#3ac0b0'; ctx.beginPath(); ctx.ellipse(0, 2, 18, 15, 0, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; for (const hx of [-8, 0, 8]) ctx.fillRect(hx - 1.5, -11, 3, 8); }
    else if (key === 'paper') { ctx.fillStyle = '#f6d84a'; ctx.beginPath(); ctx.moveTo(-14, 3); ctx.lineTo(-14, -12); ctx.lineTo(-7, -4); ctx.lineTo(0, -16); ctx.lineTo(7, -4); ctx.lineTo(14, -12); ctx.lineTo(14, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
};
