/* ============================================================
   mapview.js — the town map: one long street with a stop for
   every level.  Old buildings still standing are drawn as they
   are; cleared lots show what went up; mended houses sparkle.
   Mungo and Pip wait at the chosen stop.
   ============================================================ */
'use strict';

const MapView = {
  camX: 0, GAP: 300, stops: [],
  layout(W, H) {
    const s = clamp(Math.min(H / 640, W / 700), .55, 1.25), street = H * .7;
    return { s, street };
  },
  stopX(i) { return 160 + i * this.GAP; },
  /* over: the painted look's overlay canvas (the stop numbers, stars and tags stay crisp
     there); without it everything goes on ctx, sky and hills too (the classic look) */
  draw(ctx, W, H, t, sel, over) {
    const { s, street } = this.layout(W, H), D = SaveGame.data;
    const target = this.stopX(sel) - W / 2 / s;
    this.camX += (target - this.camX) * .12;
    const fakeCam = { x: this.camX * .6, toScreen: () => [0, street + 40] };
    if (!over) { Scene.sky(ctx, W, H, 'morning', this.camX, t, 0); Scene.hills(ctx, W, H, 'morning', fakeCam); }
    const lc = over || ctx;
    ctx.save(); ctx.scale(s, s); ctx.translate(-this.camX, 0);
    if (over) { over.save(); over.scale(s, s); over.translate(-this.camX, 0); }
    const gy = street / s, view = { l: this.camX - 100, r: this.camX + W / s + 100 };
    ctx.save(); ctx.translate(0, gy - GROUND_Y);
    Scene.street(ctx, { def: { tod: 'morning' } }, view);
    for (let x = 0; x < this.stopX(LEVELS.length) + 200; x += this.GAP) Scene.lamp(ctx, x + this.GAP / 2 - 40, false);
    ctx.restore();
    this.stops = [];
    LEVELS.forEach((L, i) => {
      const x = this.stopX(i), open = SaveGame.unlocked(L.id), stars = D.stars[L.id] || 0;
      ctx.save(); ctx.translate(x, gy);
      if (over) { over.save(); over.translate(x, gy); }
      if (L.kind === 'smash') {
        if (stars > 0) { ctx.save(); ctx.scale(.5, .5); ctx.translate(0, -GROUND_Y); Scene.newBuilding(ctx, D.styles[L.id] || 'garden', -190, 190, 1, false); ctx.restore(); }
        else this.miniOld(ctx, L);
      } else this.miniHouse(ctx, L, stars > 0, t);
      if (!open) { ctx.fillStyle = 'rgba(230,236,244,.72)'; ctx.fillRect(-110, -260, 220, 262); this.padlock(lc, 0, -110); }
      /* the stop's number and its stars */
      const sy = -268, on = i === sel;
      lc.fillStyle = on ? '#ffe24a' : '#ffffff'; lc.strokeStyle = INK; lc.lineWidth = 3; lc.beginPath(); lc.arc(0, sy, 22, 0, TAU); lc.fill(); lc.stroke();
      lc.fillStyle = INK; lc.font = `900 22px ${UI_FONT}`; lc.textAlign = 'center'; lc.textBaseline = 'middle'; lc.fillText(String(i + 1), 0, sy + 1);
      for (let k = 0; k < 3; k++) this.star(lc, -30 + k * 30, sy - 38, 11, k < stars);
      lc.fillStyle = L.kind === 'smash' ? '#ef7a2a' : '#3aa86a'; rr(lc, -46, 14, 92, 24, 12); lc.fill();
      lc.fillStyle = '#fff'; lc.font = `900 13px ${UI_FONT}`; lc.fillText(L.kind === 'smash' ? 'SMASH' : 'MEND', 0, 27);
      if (L.boss) { lc.fillStyle = '#d83a6a'; rr(lc, 30, sy - 12, 52, 22, 11); lc.fill(); lc.fillStyle = '#fff'; lc.font = `900 11px ${UI_FONT}`; lc.fillText('BIG ONE', 56, sy - 1); }
      if (over) over.restore();
      ctx.restore();
      this.stops.push({ i, x, sx: (x - this.camX) * s, sy: street });
    });
    /* Mungo and Pip at the chosen stop */
    const cx = this.stopX(sel);
    const mk = (type, x, face) => { const a = new Actor(type, x, gy); a.face = face; a.anim = t; a.onGround = true; return a; };
    Chars.mungo(ctx, mk('mungo', cx - 140, 1), { hat: D.hats.mungo, happy: true });
    Chars.pip(ctx, mk('pip', cx + 128, -1), { hat: D.hats.pip, bucket: (BUCKETS.find(b => b.key === D.bucket) || BUCKETS[0]).color });
    ctx.restore(); if (over) over.restore();
  },
  /* which stop is under a screen point? */
  hit(px, py, W, H) {
    const { s, street } = this.layout(W, H);
    for (const st of this.stops) if (Math.abs(px - st.sx) < 120 * s && py > street - 300 * s && py < street + 50 * s) return st.i;
    return -1;
  },
  miniOld(ctx, L) {
    const cs = 13, w = L.plan[0].length, h = L.plan.length;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const ch = L.plan[i][j]; if (!MAT[ch]) continue;
      const x = (j - w / 2) * cs, y = -(h - i) * cs;
      ctx.drawImage(painted() ? Painted.block(matCode(ch), (i + j) % 4) : Sprites.block(matCode(ch), (i + j) % 4), x, y, cs, cs);
    }
  },
  miniHouse(ctx, L, done, t) {
    const w = L.hw * 14, h = L.storeys * 42;
    ctx.fillStyle = L.color; ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = L.roofColor; ctx.beginPath(); ctx.moveTo(-w / 2 - 8, -h); ctx.lineTo(-w / 2 + 14, -h - 36); ctx.lineTo(w / 2 - 14, -h - 36); ctx.lineTo(w / 2 + 8, -h); ctx.fill();
    for (let s = 0; s < L.storeys; s++) for (let k = 0; k < Math.floor(L.hw / 3); k++) { const x = -w / 2 + 12 + k * 42, y = -s * 42 - 34; ctx.fillStyle = '#cfe8f8'; ctx.fillRect(x, y, 16, 20); ctx.strokeStyle = L.trim; ctx.lineWidth = 2; ctx.strokeRect(x, y, 16, 20); if (!done && (s + k) % 2 === 0) { ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 13, y + 16); ctx.stroke(); } }
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-8, -26, 16, 26);
    if (done) for (let k = 0; k < 3; k++) { const a = t * 2 + k * 2.1; this.heart(ctx, Math.cos(a) * w * .4, -h - 50 + Math.sin(a * 1.3) * 8, 7); }
  },
  star(ctx, x, y, r, on) {
    ctx.fillStyle = on ? '#ffd23a' : 'rgba(255,255,255,.55)'; ctx.strokeStyle = on ? '#b8801a' : 'rgba(58,36,24,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let p = 0; p < 10; p++) { const rr2 = p % 2 ? r * .45 : r, a = p / 10 * TAU - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); ctx.stroke();
  },
  heart(ctx, x, y, r) { ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.moveTo(x, y + r); ctx.bezierCurveTo(x - r * 1.6, y - r * .2, x - r * .6, y - r * 1.4, x, y - r * .4); ctx.bezierCurveTo(x + r * .6, y - r * 1.4, x + r * 1.6, y - r * .2, x, y + r); ctx.fill(); },
  padlock(ctx, x, y) {
    ctx.strokeStyle = '#6a7480'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y - 14, 14, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = '#9aa4b0'; rr(ctx, x - 22, y - 14, 44, 34, 6); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); ctx.fillRect(x - 2, y, 4, 10);
  }
};
