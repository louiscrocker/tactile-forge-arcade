/* ============================================================
   render.js — draws a level: sky, town, the old building, the
   house, everyone, the juice.  Canvas 2D, CSS pixels × DPR.
   ============================================================ */
'use strict';

const Render = {
  W: 1, H: 1, DPR: 1, ctx: null, flash: 0, fps: 60, _fa: 0, _fn: 0,
  init(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); },
  resize(W, H, DPR) { this.W = W; this.H = H; this.DPR = DPR; if (this.canvas) { this.canvas.width = Math.round(W * DPR); this.canvas.height = Math.round(H * DPR); } },

  /* the camera for a level: follow one player, or keep both in view */
  frameCamera(cam, L, insets, snap) {
    const W = this.W, H = this.H, playH = Math.max(200, H - insets.top - insets.bottom);
    const rows = clamp(playH / 52, 5.5, 11);   /* a short phone screen shows fewer rows, bigger */
    let zoom = clamp(Math.min(playH / (rows * CELL), W / (8.5 * CELL)), .45, 1.5);
    const ps = L.players;
    let fx = ps[0].x, fy = ps[0].y - 40;
    if (ps.length > 1) {
      const xs = ps.map(p => p.x), ys = ps.map(p => p.y - 40);
      fx = (Math.min(...xs) + Math.max(...xs)) / 2; fy = (Math.min(...ys) + Math.max(...ys)) / 2;
      zoom = Math.min(zoom, (W - 160) / (Math.max(...xs) - Math.min(...xs) + 300), playH / (Math.max(...ys) - Math.min(...ys) + 360));
      zoom = Math.max(.4, zoom);
    }
    /* never show much below the street; centre the action in the free band between HUD and pad */
    const midScreen = insets.top + playH * .55, viewBelow = (H - midScreen) / zoom;
    fy = Math.min(fy, GROUND_Y + 110 - viewBelow);
    cam.follow(fx, fy + (H / 2 - midScreen) / zoom, zoom);
    if (snap) cam.snap();
  },

  frame(G, dt) {
    const ctx = this.ctx, L = G.level, W = this.W, H = this.H, cam = G.cam, t = G.t;
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.flash = Math.max(0, this.flash - dt * 3);
    const sky = SKIES[L.def.tod] || SKIES.noon, night = !!sky.night;
    Scene.sky(ctx, W, H, L.def.tod, cam.x, t, this.flash);
    Scene.hills(ctx, W, H, L.def.tod, cam);
    ctx.save(); cam.apply(ctx);
    const view = cam.viewRect(80);
    this.backdrop(ctx, L, t, night, view);
    Scene.street(ctx, L, view);
    if (L.smash) this.lot(ctx, L, night);
    if (G.newBuilding && L.smash) Scene.newBuilding(ctx, G.newBuilding.style, (L.bx - 1) * CELL, (L.bx + L.bw + 1) * CELL, easeOutCubic(Math.min(1, G.newBuilding.t / 2.2)), night);
    if (L.mend) { Scene.house(ctx, L, t); Scene.pipes(ctx, L, t); for (const f of L.house.fixes) Scene.fixable(ctx, f, L, t); Scene.scaffold(ctx, L); }
    this.blocks(ctx, L, view);
    if (L.crane) Scene.crane(ctx, L, t);
    if (L.ball) Scene.ball(ctx, L, t);
    for (const k of L.critters) this.critter(ctx, k, t);
    for (const p of L.pigeons) Sprites.pigeon(ctx, p.x, p.y, 1.6 * (p.vx > 0 ? -1 : 1), t * 14, false);
    if (L.diff.markers) for (const th of L.things) Scene.marker(ctx, L, th);
    for (const th of L.things) Scene.thing(ctx, th);
    for (const b of L.bits) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.globalAlpha = Math.min(1, b.life); ctx.fillStyle = b.color; ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * .7); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-b.size / 2, b.size * .1, b.size, b.size * .25); ctx.restore(); }
    ctx.globalAlpha = 1;
    G.particles.draw(ctx, 'back');
    L.players.forEach((a, n) => {
      const o = { hat: G.hats[a.type], bucket: G.bucketColor, happy: L.done };
      if (a.type === 'mungo') Chars.mungo(ctx, a, o); else Chars.pip(ctx, a, o);
      if (L.players.length > 1) { ctx.fillStyle = n ? '#3aa86a' : '#ef7a2a'; ctx.font = `900 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText(n ? 'P2' : 'P1', a.x, a.y - a.h - (a.type === 'mungo' ? 46 : 28)); }
    });
    G.particles.draw(ctx, 'front');
    G.particles.drawWords(ctx);
    ctx.restore();
    if (night) { const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9); g.addColorStop(0, 'rgba(10,14,40,0)'); g.addColorStop(1, 'rgba(10,14,40,.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (L.def.boss === 'storm') G.particles.drawRain(ctx, W, H, 1, L.gust ? L.gust.dir * 2.5 : .6, t);
    Cinematic.draw(ctx, W, H);
    this._fa += dt; this._fn++; if (this._fa > .5) { this.fps = this._fn / this._fa; this._fa = 0; this._fn = 0; }
  },

  backdrop(ctx, L, t, night, view) {
    const seed = L.def.id.length * 7;
    const spots = [];
    if (L.smash && !L.mend) spots.push([L.lot[0] * CELL - 330, 300, 2], [L.lot[1] * CELL + 30, 300, 2]);
    if (L.mend && !L.smash) spots.push([L.house.x0 * CELL - 360, 280, 2], [(L.house.x0 + L.house.w) * CELL + (L.crane ? 260 : 80), 300, 2]);
    if (L.smash && L.mend) spots.push([L.lot[0] * CELL - 330, 300, 2], [(L.house.x0 + L.house.w) * CELL + 80, 300, 2]);
    spots.forEach(([x, w, s], k) => { if (x + w > view.l && x < view.r) Scene.neighbour(ctx, x, w, s, seed + k, night, L.kind === 'smash' ? L.mess * (k ? .5 : .5) : 0); });
    for (let x = 60; x < L.W; x += 520) if (x > view.l - 100 && x < view.r + 100 && !this.busy(L, x)) Scene.lamp(ctx, x, night);
    if (L.def.hazards && L.def.hazards.from.includes('tree')) Scene.tree(ctx, (L.house.x0 - 1.5) * CELL, 1.4, t, night);
  },
  busy(L, x) { const c = x / CELL; if (L.smash && c > L.lot[0] - 1 && c < L.lot[1] + 1) return true; if (L.mend && c > L.house.x0 - 2 && c < L.house.x0 + L.house.w + 2) return true; return false; },

  lot(ctx, L, night) {
    const x0 = L.lot[0] * CELL, x1 = L.lot[1] * CELL;
    ctx.fillStyle = night ? '#5a4a3a' : '#a88a64'; ctx.fillRect(x0, GROUND_Y - 4, x1 - x0, 10);
    for (const x of [x0, x1]) { ctx.fillStyle = '#f0a020'; ctx.fillRect(x - 3, GROUND_Y - 50, 6, 50); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, GROUND_Y - 38, 6, 8); ctx.fillRect(x - 3, GROUND_Y - 18, 6, 8); }
    ctx.strokeStyle = '#f0a020'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.moveTo(x0, GROUND_Y - 44); ctx.lineTo(x0 - 60, GROUND_Y - 44); ctx.moveTo(x1, GROUND_Y - 44); ctx.lineTo(x1 + 60, GROUND_Y - 44); ctx.stroke(); ctx.setLineDash([]);
    /* the crew's sign: everyone is out, the new building is coming */
    const sx = x0 + 6, sy = GROUND_Y - 96;
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(sx + 30, sy + 40, 5, 56);
    ctx.fillStyle = '#ffe24a'; rr(ctx, sx - 6, sy, 82, 44, 6); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `900 10px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('ALL OUT!', sx + 35, sy + 15); ctx.font = `800 8px ${UI_FONT}`; ctx.fillText('Something new', sx + 35, sy + 27); ctx.fillText('is coming!', sx + 35, sy + 37);
  },

  blocks(ctx, L, view) {
    const c0 = Math.max(0, Math.floor(view.l / CELL)), c1 = Math.min(L.cols - 1, Math.ceil(view.r / CELL));
    for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
      const k = L.idx(c, r), code = L.cell[k]; if (!code) continue;
      this.block(ctx, L, c, r, code, L.hp[k], c * CELL, r * CELL);
    }
    for (const ch of L.chunks) for (const b of ch.cells) this.block(ctx, L, b.c, b.r, b.code, b.hp, b.c * CELL, b.r * CELL + ch.off);
    /* the outline of the building's roofline so it reads as one building */
  },
  block(ctx, L, c, r, code, hp, x, y) {
    const v = ((c * 7 + r * 3) % 4);
    ctx.drawImage(Sprites.block(code, v), x, y, CELL, CELL);
    const max = matOf(code).hp[L.diff.i];
    if (hp < max) Sprites.cracks(ctx, x, y, hp / max, c * 31 + r);
    if (!L.code(c, r - 1)) { ctx.fillStyle = 'rgba(255,240,200,.18)'; ctx.fillRect(x, y, CELL, 3); }
  },
  critter(ctx, k, t) {
    if (k.kind === 'pigeon') Sprites.pigeon(ctx, k.x, k.y, 1.6 * (k.vx > 0 ? -1 : 1), t * 16, false);
    else { ctx.save(); ctx.translate(k.x, k.y); ctx.scale(k.vx > 0 ? -1 : 1, 1); ctx.fillStyle = '#e89a4a'; ctx.beginPath(); ctx.ellipse(0, -10, 14, 9, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-12, -18, 8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-17, -30); ctx.lineTo(-13, -24); ctx.moveTo(-10, -24); ctx.lineTo(-7, -31); ctx.lineTo(-6, -23); ctx.fill(); ctx.strokeStyle = '#e89a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(12, -12); ctx.quadraticCurveTo(22, -26, 16, -32); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-14, -19, 1.5, 0, TAU); ctx.fill(); ctx.restore(); }
  }
};
