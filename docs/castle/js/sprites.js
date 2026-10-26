/* ============================================================
   sprites.js — everything drawn by code: tiles, furniture, the
                people, the animals, the dragon, the icons
   ============================================================
   Tiles are drawn in world units at their cell.  An item is drawn
   with its bottom-left corner at the origin: x from 0 to w·CELL,
   y from -h·CELL up to 0 (the floor line).  People stand with
   their feet at the origin and face +x unless o.face = -1.
   No images anywhere: this is the whole art department.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const C = CELL;
  const iconCache = new Map();
  const STONE_COLS = ['#a8a39a', '#b4afa4', '#9e9a92', '#aba69c', '#b8b2a6', '#a19c93'];
  const MORTAR = '#6f6a62';
  const WOOD = '#7a4e2a', WOOD_D = '#5a361a', WOOD_L = '#9a6a3a';
  const IRON = '#3a3a42', GOLD = '#f2c14e', GOLD_D = '#b8862a', RED = '#b8302e', RED_D = '#7a1e1e', BLUE = '#2f5aa8';

  /* ---------- tiny helpers ---------- */
  function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function ell(ctx, x, y, rx, ry, col, rot = 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }
  function circ(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function poly(ctx, pts, col, stroke) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (col) { ctx.fillStyle = col; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
  function line(ctx, x0, y0, x1, y1, col, w = 1) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function vgrad(ctx, x, y0, y1, c0, c1) { const g = ctx.createLinearGradient(x, y0, x, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  function hgrad(ctx, x0, x1, y, c0, c1, c2) { const g = ctx.createLinearGradient(x0, y, x1, y); g.addColorStop(0, c0); if (c2) { g.addColorStop(.5, c1); g.addColorStop(1, c2); } else g.addColorStop(1, c1); return g; }
  const painted = () => typeof Painted !== 'undefined' && Painted.on();
  const tex = (name) => (painted() ? Painted.pattern(name) : null);

  /* ---------- tiles ---------- */
  function stoneFace(ctx, x, y, w, h, v, round) {
    const base = STONE_COLS[Math.floor(v * STONE_COLS.length) % STONE_COLS.length];
    const pat = tex(round ? 'tower' : 'stone');
    ctx.fillStyle = pat || base; ctx.fillRect(x, y, w, h);
    if (!pat) {
      /* classic: blocks in running bond with mortar lines */
      ctx.strokeStyle = MORTAR; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y + h - .6); ctx.lineTo(x + w, y + h - .6); ctx.stroke();
      const off = (Math.round(y / C) % 2) ? w * .5 : 0;
      ctx.beginPath(); ctx.moveTo(x + off + (off ? 0 : w) - .6, y); ctx.lineTo(x + off + (off ? 0 : w) - .6, y + h); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x + 1, y + 1, w - 2, 2); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + 1, y + h - 4, w - 2, 3);
      if (v > .72) { ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(x + w * .2, y + h * .4, w * .35, h * .25); }
    }
  }
  /* round towers are shaded like a cylinder across their run */
  function towerShade(ctx, x, y, runL, runR) {
    const g = ctx.createLinearGradient(runL, 0, runR, 0);
    g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(.28, 'rgba(255,255,255,.06)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(.75, 'rgba(0,0,0,.08)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
    ctx.fillStyle = g; ctx.fillRect(x, y, C, C);
  }
  function run(grid, cx, cy, t) { let l = cx, r = cx; while (l > 0 && grid.get(l - 1, cy) === t) l--; while (r < COLS - 1 && grid.get(r + 1, cy) === t) r++; return [l, r]; }
  function coneShape(grid, cx, cy) {
    const [l, r] = run(grid, cx, cy, T.CONE);
    let below = 0, above = 0; while (grid.get(cx, cy + 1 + below) === T.CONE) below++; while (grid.get(cx, cy - 1 - above) === T.CONE) above++;
    return { l, r, i: below, n: below + above + 1 };
  }
  function moss(ctx, x, y, v, k) { ctx.fillStyle = `rgba(90,130,50,${.18 * k})`; ctx.beginPath(); ctx.ellipse(x + C * (.2 + v * .6), y + C * .85, C * .3, C * .14, 0, 0, TAU); ctx.fill(); }

  /* o: { time, snow 0..1, bridge 0..1 (down), gate 0..1 (open), lit (a room behind the window is lit) } */
  function tile(ctx, grid, cx, cy, t, o) {
    const x = cx * C, y = cy * C, v = grid.variant(cx, cy);
    switch (t) {
      case T.STONE: case T.WIN_SLIT: case T.WIN_ARCH: case T.WIN_STAINED: {
        stoneFace(ctx, x, y, C, C, v, false);
        if (cy >= GROUND - 2 && v > .4 && t === T.STONE) moss(ctx, x, y, v, 1);
        if (t === T.WIN_SLIT) { rect(ctx, x + C * .4, y + C * .12, C * .2, C * .76, '#1a1a24'); rect(ctx, x + C * .34, y + C * .12, C * .06, C * .76, '#8a857c'); rect(ctx, x + C * .6, y + C * .12, C * .06, C * .76, '#c8c3ba'); if (o.lit) { ctx.fillStyle = 'rgba(255,190,90,.75)'; ctx.fillRect(x + C * .42, y + C * .14, C * .16, C * .72); } }
        if (t === T.WIN_ARCH) { ctx.save(); ctx.beginPath(); ctx.moveTo(x + C * .22, y + C * .9); ctx.lineTo(x + C * .22, y + C * .4); ctx.arc(x + C * .5, y + C * .4, C * .28, Math.PI, 0); ctx.lineTo(x + C * .78, y + C * .9); ctx.closePath(); ctx.fillStyle = o.lit ? '#ffcb70' : '#2a3a5a'; ctx.fill(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; line(ctx, x + C * .5, y, x + C * .5, y + C, 'rgba(60,50,40,.7)', 1.5); line(ctx, x, y + C * .6, x + C, y + C * .6, 'rgba(60,50,40,.7)', 1.5); if (!o.lit) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + C * .25, y + C * .2, C * .12, C * .7); } ctx.restore(); ctx.strokeStyle = '#d8d3c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + C * .22, y + C * .9); ctx.lineTo(x + C * .22, y + C * .4); ctx.arc(x + C * .5, y + C * .4, C * .28, Math.PI, 0); ctx.lineTo(x + C * .78, y + C * .9); ctx.stroke(); }
        if (t === T.WIN_STAINED) { ctx.save(); ctx.beginPath(); ctx.moveTo(x + C * .18, y + C * .92); ctx.lineTo(x + C * .18, y + C * .38); ctx.arc(x + C * .5, y + C * .38, C * .32, Math.PI, 0); ctx.lineTo(x + C * .82, y + C * .92); ctx.closePath(); ctx.clip(); const cols = ['#d83a3a', '#2a6ad8', '#f0c020', '#3aa84a', '#a040c0', '#f08030']; let k = 0; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) { ctx.fillStyle = cols[(k++ + Math.floor(v * 6)) % 6]; ctx.globalAlpha = o.lit ? 1 : .8; ctx.fillRect(x + C * .18 + xx * C * .22, y + C * .06 + yy * C * .22, C * .22, C * .22); } ctx.globalAlpha = 1; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5; for (let xx = 1; xx < 3; xx++) line(ctx, x + C * .18 + xx * C * .22, y, x + C * .18 + xx * C * .22, y + C, '#2a2a2a', 1.5); for (let yy = 1; yy < 4; yy++) line(ctx, x, y + C * .06 + yy * C * .22, x + C, y + C * .06 + yy * C * .22, '#2a2a2a', 1.5); if (o.lit) { ctx.fillStyle = 'rgba(255,230,160,.35)'; ctx.fillRect(x, y, C, C); } ctx.restore(); ctx.strokeStyle = '#e8e3d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + C * .18, y + C * .92); ctx.lineTo(x + C * .18, y + C * .38); ctx.arc(x + C * .5, y + C * .38, C * .32, Math.PI, 0); ctx.lineTo(x + C * .82, y + C * .92); ctx.stroke(); }
        break;
      }
      case T.TOWER: { const [l, r] = run(grid, cx, cy, T.TOWER); stoneFace(ctx, x, y, C, C, v, true); towerShade(ctx, x, y, l * C, (r + 1) * C); if (cy >= GROUND - 2 && v > .5) moss(ctx, x, y, v, .8); break; }
      case T.FLOOR: {
        const pat = tex('plank'); ctx.fillStyle = pat || WOOD; ctx.fillRect(x, y, C, C);
        if (!pat) { ctx.fillStyle = WOOD_D; for (let k = 0; k < 3; k++) ctx.fillRect(x, y + 2 + k * (C / 3), C, 1.2); ctx.fillStyle = WOOD_L; ctx.fillRect(x, y, C, 2); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + (v > .5 ? C * .3 : C * .7), y + 3, 1.2, C / 3 - 3); }
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + C - 3, C, 3); ctx.fillStyle = 'rgba(255,230,180,.25)'; ctx.fillRect(x, y, C, 1.5);
        break;
      }
      case T.WOOD: { const pat = tex('beam'); ctx.fillStyle = pat || WOOD_D; ctx.fillRect(x, y, C, C); if (!pat) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) line(ctx, x, y + k * C / 4 + Math.sin(v * 9 + k) * 2, x + C, y + k * C / 4 + Math.cos(v * 7 + k) * 2, 'rgba(0,0,0,.22)', 1); } ctx.strokeStyle = 'rgba(255,220,170,.22)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, C - 2, C - 2); break; }
      case T.ROOF: {
        const noL = grid.get(cx - 1, cy) !== T.ROOF && !grid.solid(cx - 1, cy), noR = grid.get(cx + 1, cy) !== T.ROOF && !grid.solid(cx + 1, cy), top = grid.get(cx, cy - 1) !== T.ROOF;
        ctx.save(); ctx.beginPath(); ctx.moveTo(x + (noL ? C * .5 : 0), y); ctx.lineTo(x + C - (noR ? C * .5 : 0), y); ctx.lineTo(x + C, y + C); ctx.lineTo(x, y + C); ctx.closePath(); ctx.clip();
        const pat = tex('tiles'); ctx.fillStyle = pat || '#a8402e'; ctx.fillRect(x, y, C, C);
        if (!pat) { ctx.fillStyle = '#c05a40'; for (let r = 0; r < 3; r++) for (let k = -1; k < 3; k++) { const ox = (r % 2) * C / 4; ctx.beginPath(); ctx.arc(x + ox + k * C / 2 + C / 4, y + r * C / 3 + C / 3, C / 4, 0, Math.PI); ctx.fill(); } ctx.strokeStyle = 'rgba(60,20,10,.45)'; ctx.lineWidth = 1; for (let r = 1; r < 3; r++) line(ctx, x, y + r * C / 3, x + C, y + r * C / 3, 'rgba(60,20,10,.45)', 1); }
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + C - 4, C, 4);
        ctx.restore();
        if (top) { ctx.fillStyle = '#6a2a22'; ctx.fillRect(x + (noL ? C * .5 : 0), y, C - (noL ? C * .5 : 0) - (noR ? C * .5 : 0), 3); }
        if (o.snow > 0) { ctx.fillStyle = `rgba(245,248,255,${o.snow})`; ctx.fillRect(x + (noL ? C * .5 : 0), y, C - (noL ? C * .5 : 0) - (noR ? C * .5 : 0), 5 * o.snow); }
        break;
      }
      case T.CONE: {
        const s = coneShape(grid, cx, cy), x0 = s.l * C, x1 = (s.r + 1) * C, cxm = (x0 + x1) / 2, hw = (x1 - x0) / 2;
        if (cx !== s.l) break;                                   /* the whole slice is drawn once, from its left cell */
        const wb = hw * (s.n - s.i) / s.n, wt = hw * (s.n - s.i - 1) / s.n;
        const g = ctx.createLinearGradient(cxm - wb, 0, cxm + wb, 0); g.addColorStop(0, '#2a3450'); g.addColorStop(.4, '#4a5a80'); g.addColorStop(.6, '#5a6a90'); g.addColorStop(1, '#222a40');
        poly(ctx, [[cxm - wb, y + C], [cxm - wt, y], [cxm + wt, y], [cxm + wb, y + C]], g);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (let k = 1; k < 3; k++) { const yy = y + k * C / 3, f = (yy - y) / C, w = wt + (wb - wt) * f; line(ctx, cxm - w, yy, cxm + w, yy, 'rgba(0,0,0,.25)', 1); }
        if (o.snow > 0) { ctx.fillStyle = `rgba(245,248,255,${o.snow * .8})`; poly(ctx, [[cxm - wb, y + C], [cxm - wb * .8, y + C - 4], [cxm + wb * .8, y + C - 4], [cxm + wb, y + C]], `rgba(245,248,255,${o.snow * .8})`); }
        if (s.i === s.n - 1) { circ(ctx, cxm, y + 2, 3.5, GOLD); line(ctx, cxm, y + 2, cxm, y - 6, GOLD_D, 1.5); }
        break;
      }
      case T.BATTLEMENT: {
        const merlon = cx % 2 === 0, h = merlon ? C * .7 : C * .22;
        stoneFace(ctx, x, y + C - h, C, h, v, false);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, y + C - h, C, 2);
        if (o.snow > 0) { ctx.fillStyle = `rgba(245,248,255,${o.snow})`; ctx.fillRect(x, y + C - h - 1, C, 4 * o.snow + 1); }
        break;
      }
      case T.DOOR: {
        const wallish = grid.solid(cx - 1, cy) || grid.solid(cx + 1, cy);
        if (wallish) stoneFace(ctx, x, y, C, C, v, false);
        ctx.fillStyle = '#1e1610'; ctx.beginPath(); ctx.moveTo(x + C * .14, y + C); ctx.lineTo(x + C * .14, y + C * .42); ctx.arc(x + C * .5, y + C * .42, C * .36, Math.PI, 0); ctx.lineTo(x + C * .86, y + C); ctx.closePath(); ctx.fill();
        /* the door leaf, open against the wall */
        ctx.save(); ctx.beginPath(); ctx.moveTo(x + C * .14, y + C); ctx.lineTo(x + C * .14, y + C * .42); ctx.arc(x + C * .5, y + C * .42, C * .36, Math.PI, 0); ctx.lineTo(x + C * .86, y + C); ctx.closePath(); ctx.clip();
        ctx.fillStyle = WOOD; ctx.fillRect(x + C * .14, y + C * .1, C * .2, C * .9); ctx.fillStyle = WOOD_D; ctx.fillRect(x + C * .22, y + C * .1, 1.5, C * .9); ctx.fillStyle = IRON; ctx.fillRect(x + C * .15, y + C * .42, C * .17, 2.5); ctx.fillRect(x + C * .15, y + C * .78, C * .17, 2.5);
        ctx.restore();
        ctx.strokeStyle = '#d8d3c8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + C * .14, y + C); ctx.lineTo(x + C * .14, y + C * .42); ctx.arc(x + C * .5, y + C * .42, C * .36, Math.PI, 0); ctx.lineTo(x + C * .86, y + C); ctx.stroke();
        break;
      }
      case T.GATE: {
        stoneFace(ctx, x, y, C, C, v, false);
        ctx.fillStyle = '#15120f'; ctx.beginPath(); ctx.moveTo(x + C * .1, y + C); ctx.lineTo(x + C * .1, y + C * .36); ctx.arc(x + C * .5, y + C * .36, C * .4, Math.PI, 0); ctx.lineTo(x + C * .9, y + C); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#d8d3c8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + C * .1, y + C); ctx.lineTo(x + C * .1, y + C * .36); ctx.arc(x + C * .5, y + C * .36, C * .4, Math.PI, 0); ctx.lineTo(x + C * .9, y + C); ctx.stroke();
        break;
      }
      case T.STAIR: {
        ctx.fillStyle = tex('plaster') || '#cfc3a8'; ctx.fillRect(x, y, C, C);
        const right = cy % 2 === 0, n = 4;
        ctx.fillStyle = '#8f8a80';
        for (let k = 0; k < n; k++) { const sx = right ? x + k * C / n : x + C - (k + 1) * C / n; const sy = y + C - (k + 1) * C / n; ctx.fillRect(sx, sy, C / n + .5, C - (sy - y)); }
        ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < n; k++) { const sx = right ? x + k * C / n : x + C - (k + 1) * C / n, sy = y + C - (k + 1) * C / n; ctx.fillRect(sx, sy, C / n, 1.5); }
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y, C, 2);
        break;
      }
      case T.EARTH: {
        const pat = tex('earth'); ctx.fillStyle = pat || (cy === GROUND ? '#6a4a30' : '#5a3e28'); ctx.fillRect(x, y, C, C);
        if (!pat) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + v * 20, y + 8 + v * 12, 6, 4); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x + 20 - v * 14, y + 20 - v * 8, 5, 3); }
        if (cy === GROUND) {
          const g = tex('grass'); ctx.fillStyle = g || (o.season === 'autumn' ? '#8a9a3a' : o.season === 'winter' ? '#6a8a4a' : '#5aa03a'); ctx.fillRect(x, y, C, 7);
          if (!g) { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, y, C, 1.5); ctx.fillStyle = o.season === 'autumn' ? '#6a7a2a' : '#3a7a2a'; for (let k = 0; k < 4; k++) ctx.fillRect(x + ((v * 37 + k * 9) % C), y + 1, 2, 4 + ((k * 3 + v * 10) % 3)); }
          if (o.snow > 0) { ctx.fillStyle = `rgba(245,248,255,${o.snow})`; ctx.fillRect(x, y - 1, C, 7); }
          if (o.season === 'spring' && v > .6) { circ(ctx, x + v * C, y + 2, 1.6, v > .8 ? '#ffd0e0' : '#fff6a0'); }
        }
        break;
      }
      case T.WATER: {
        const top = grid.get(cx, cy - 1) !== T.WATER, tt = o.time || 0;
        ctx.fillStyle = cy === GROUND ? '#3a78b8' : cy === GROUND + 1 ? '#2d609e' : '#234e88'; ctx.fillRect(x, y, C, C);
        if (top) { ctx.fillStyle = '#4a90d0'; ctx.fillRect(x, y, C, 3); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k <= 4; k++) ctx.lineTo(x + k * C / 4, y + 4 + Math.sin(tt * 2 + x * .08 + k * 1.4) * 1.5); ctx.stroke(); }
        if (v > .6 && !painted()) { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4, y + C * .55 + Math.sin(tt * 1.3 + v * 6) * 3); ctx.lineTo(x + 4 + C * .5, y + C * .55 + Math.sin(tt * 1.3 + v * 6) * 3); ctx.stroke(); }
        if (o.snow > .3 && top) { ctx.fillStyle = `rgba(230,240,255,${(o.snow - .3) * .9})`; ctx.fillRect(x, y, C * .35, 4); ctx.fillRect(x + C * .7, y, C * .3, 4); }
        break;
      }
      case T.BRIDGE: {
        ctx.fillStyle = vgrad(ctx, x, y, y + C, '#2a5a98', '#1a3a68'); ctx.fillRect(x, y, C, C);
        stoneFace(ctx, x, y, C, C * .4, v, false);
        ctx.fillStyle = '#8a857c'; ctx.beginPath(); ctx.moveTo(x, y + C * .4); ctx.lineTo(x, y + C); ctx.lineTo(x + C * .18, y + C); ctx.lineTo(x + C * .18, y + C * .75); ctx.arc(x + C * .5, y + C * .75, C * .32, Math.PI, 0); ctx.lineTo(x + C * .82, y + C); ctx.lineTo(x + C, y + C); ctx.lineTo(x + C, y + C * .4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, y, C, 2);
        break;
      }
      case T.DRAWBRIDGE: {
        ctx.fillStyle = vgrad(ctx, x, y, y + C, '#2a5a98', '#1a3a68'); ctx.fillRect(x, y, C, C);
        const down = o.bridge === undefined ? 1 : o.bridge, hingeRight = grid.solid(cx + 1, cy - 1) || grid.get(cx + 1, cy - 1) === T.GATE;
        ctx.save(); ctx.translate(hingeRight ? x + C : x, y); ctx.rotate((hingeRight ? 1 : -1) * (1 - down) * 1.45);
        const x0 = hingeRight ? -C : 0;
        ctx.fillStyle = WOOD; ctx.fillRect(x0, 0, C, C * .3); ctx.fillStyle = WOOD_D; for (let k = 1; k < 4; k++) ctx.fillRect(x0 + k * C / 4, 0, 1.2, C * .3); ctx.fillStyle = IRON; ctx.fillRect(x0 + 2, C * .1, C - 4, 2.5);
        ctx.restore();
        /* chains to the gatehouse */
        ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
        const tipX = hingeRight ? x + C - Math.cos((1 - down) * 1.45) * C : x + Math.cos((1 - down) * 1.45) * C, tipY = y - Math.sin((1 - down) * 1.45) * C;
        ctx.beginPath(); ctx.moveTo(tipX, tipY + 2); ctx.lineTo(hingeRight ? x + C + 2 : x - 2, y - C * 2.2); ctx.stroke(); ctx.setLineDash([]);
        break;
      }
    }
  }
  /* the portcullis grid, drawn in front of whoever walks under it; open 0..1 slides it up */
  function gateGrid(ctx, cx, cy, open) {
    const x = cx * C, y = cy * C, up = open * C * .78;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x + C * .1, y + C); ctx.lineTo(x + C * .1, y + C * .36); ctx.arc(x + C * .5, y + C * .36, C * .4, Math.PI, 0); ctx.lineTo(x + C * .9, y + C); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = IRON; ctx.lineWidth = 2.2;
    for (let k = 0; k < 4; k++) { const bx = x + C * .2 + k * C * .2; ctx.beginPath(); ctx.moveTo(bx, y - up); ctx.lineTo(bx, y + C - up); ctx.stroke(); ctx.fillStyle = IRON; ctx.beginPath(); ctx.moveTo(bx - 2.5, y + C - up); ctx.lineTo(bx + 2.5, y + C - up); ctx.lineTo(bx, y + C + 5 - up); ctx.fill(); }
    for (let k = 0; k < 3; k++) { const by = y + C * .28 + k * C * .26 - up; ctx.beginPath(); ctx.moveTo(x + C * .1, by); ctx.lineTo(x + C * .9, by); ctx.stroke(); }
    ctx.restore();
  }

  /* ---------- furniture ----------
     each draws with the floor at y = 0, from x = 0 to W, up to y = -H; o: { t, fire, season, lit, wall (room wall colour) } */
  function flame(ctx, x, y, s, t, k = 1) {
    for (let i = 0; i < 3; i++) { const ph = t * 7 + i * 2.1, w = s * (.55 - i * .12), h = s * (1 - i * .22) * (.9 + .15 * Math.sin(ph)); ctx.fillStyle = ['rgba(255,120,30,.85)', 'rgba(255,200,60,.9)', 'rgba(255,250,200,.95)'][i]; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * .9, y - h * .6, x + Math.sin(ph) * w * .2, y - h); ctx.quadraticCurveTo(x + w * .9, y - h * .6, x + w, y); ctx.fill(); }
    ctx.fillStyle = `rgba(255,160,60,${.12 * k})`; ctx.beginPath(); ctx.arc(x, y - s * .3, s * 1.6, 0, TAU); ctx.fill();
  }
  function cushion(ctx, x, y, w, h, col) { ctx.fillStyle = col; rr(ctx, x, y, w, h, Math.min(w, h) * .3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(ctx, x + 2, y + 2, w - 4, h * .4, 3); ctx.fill(); }
  function book(ctx, x, y, w, h, col) { rect(ctx, x, y, w, h, col); rect(ctx, x + 1, y + h * .2, w - 2, 1.5, 'rgba(255,255,255,.4)'); }
  function legs(ctx, x, w, y0, y1, col, n = 2) { ctx.fillStyle = col; for (let k = 0; k < n; k++) ctx.fillRect(x + 3 + k * (w - 10) / (n - 1), y0, 4, y1 - y0); }
  function tableTop(ctx, x, y, w, col = WOOD, d = WOOD_D) { rect(ctx, x, y, w, 5, col); rect(ctx, x, y + 5, w, 2, d); rect(ctx, x, y, w, 1.5, 'rgba(255,230,180,.4)'); }
  function crown(ctx, x, y, s) { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s, y - s * .9); ctx.lineTo(x - s * .5, y - s * .45); ctx.lineTo(x, y - s * 1.1); ctx.lineTo(x + s * .5, y - s * .45); ctx.lineTo(x + s, y - s * .9); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = GOLD_D; ctx.lineWidth = 1; ctx.stroke(); circ(ctx, x, y - s * .35, s * .18, '#e03a5a'); circ(ctx, x - s * .55, y - s * .3, s * .12, '#3a8ae0'); circ(ctx, x + s * .55, y - s * .3, s * .12, '#3ab06a'); }
  function shieldShape(ctx, x, y, w, h, col, col2) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w / 2, y - h * .45); ctx.quadraticCurveTo(x + w / 2, y, x, y); ctx.quadraticCurveTo(x - w / 2, y, x - w / 2, y - h * .45); ctx.closePath(); ctx.fill(); ctx.strokeStyle = GOLD_D; ctx.lineWidth = 1.5; ctx.stroke(); if (col2) { ctx.fillStyle = col2; ctx.fillRect(x - w / 2 + 2, y - h + 2, w / 2 - 2, h * .5); ctx.fillRect(x, y - h * .5, w / 2 - 2, h * .3); } }
  function bush(ctx, x, y, r, col, col2) { for (const [dx, dy, k] of [[0, -.6, 1], [-.5, -.3, .7], [.5, -.3, .7], [0, -.2, .8]]) circ(ctx, x + dx * r, y + dy * r, r * k, col); ctx.fillStyle = col2 || 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(x - r * .25, y - r * .85, r * .35, 0, TAU); ctx.fill(); }
  function horseHead(ctx, x, y, s, col) { ell(ctx, x, y, s * .9, s * .55, col, -.4); ell(ctx, x + s * .7, y + s * .3, s * .45, s * .35, col, -.2); circ(ctx, x + s * .25, y - s * .15, s * .09, '#1a1a1a'); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - s * .4, y - s * .4); ctx.lineTo(x - s * .25, y - s * .95); ctx.lineTo(x - s * .05, y - s * .45); ctx.fill(); }

  const ITEM_DRAW = {
    throne(ctx, W, H, o) { rect(ctx, W * .15, -H * .95, W * .7, H * .62, '#7a1e1e'); rr(ctx, W * .12, -H, W * .76, H * .2, 8); ctx.fillStyle = GOLD; ctx.fill(); rect(ctx, W * .15, -H * .95, W * .7, H * .62, 'rgba(0,0,0,0)'); cushion(ctx, W * .2, -H * .88, W * .6, H * .5, RED); rect(ctx, W * .12, -H * .42, W * .76, H * .1, GOLD); rect(ctx, W * .12, -H * .32, W * .76, H * .32, '#8a1e1e'); legs(ctx, W * .12, W * .76, -H * .1, 0, GOLD_D); rect(ctx, W * .08, -H * .62, W * .08, H * .32, GOLD); rect(ctx, W * .84, -H * .62, W * .08, H * .32, GOLD); crown(ctx, W * .5, -H * .98, W * .14); },
    carpet(ctx, W) { rect(ctx, 0, -5, W, 5, RED); rect(ctx, 0, -5, W, 1.5, GOLD); rect(ctx, 0, -1.5, W, 1.5, GOLD); for (let k = 0; k < W; k += 12) rect(ctx, k + 4, -3.5, 3, 1.5, GOLD); },
    rug(ctx, W) { rect(ctx, 0, -5, W, 5, '#3a6ab0'); rect(ctx, 2, -4, W - 4, 3, '#c04a60'); for (let k = 0; k < W; k += 10) rect(ctx, k + 3, -3, 4, 1, '#f0d070'); },
    banner(ctx, W, H, o) { const col = o.robe || BLUE; rect(ctx, W * .1, -H * .98, W * .8, 3, GOLD_D); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(W * .15, -H * .95); ctx.lineTo(W * .85, -H * .95); ctx.lineTo(W * .85, -H * .25); ctx.lineTo(W * .5, -H * .1); ctx.lineTo(W * .15, -H * .25); ctx.fill(); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(W * .5, -H * .78); ctx.lineTo(W * .64, -H * .58); ctx.lineTo(W * .5, -H * .36); ctx.lineTo(W * .36, -H * .58); ctx.fill(); crown(ctx, W * .5, -H * .62, W * .14); },
    chandelier(ctx, W, H, o) { line(ctx, W / 2, -H, W / 2, -H * .55, IRON, 2); ell(ctx, W / 2, -H * .45, W * .4, H * .12, 'rgba(0,0,0,0)'); ctx.strokeStyle = GOLD_D; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(W / 2, -H * .45, W * .4, H * .14, 0, 0, TAU); ctx.stroke(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU, x = W / 2 + Math.cos(a) * W * .4, y = -H * .45 + Math.sin(a) * H * .14; rect(ctx, x - 1.5, y - 10, 3, 10, '#fff4d0'); if (o.lit !== false) flame(ctx, x, y - 10, 4, (o.t || 0) + k, .6); } },
    pillar(ctx, W, H) { ctx.fillStyle = hgrad(ctx, 0, W, 0, '#8a857c', '#d8d3c8', '#7a756c'); ctx.fillRect(W * .25, -H * .9, W * .5, H * .9); rect(ctx, W * .12, -H, W * .76, H * .1, '#c8c3b8'); rect(ctx, W * .15, -H * .1, W * .7, H * .1, '#c8c3b8'); },
    armour(ctx, W, H) { rect(ctx, W * .42, -H * .08, W * .16, H * .08, '#4a4a52'); ctx.fillStyle = '#b8bcc8'; rr(ctx, W * .28, -H * .62, W * .44, H * .34, 5); ctx.fill(); rect(ctx, W * .3, -H * .28, W * .16, H * .2, '#a8acb8'); rect(ctx, W * .54, -H * .28, W * .16, H * .2, '#a8acb8'); rect(ctx, W * .14, -H * .58, W * .14, H * .3, '#a8acb8'); rect(ctx, W * .72, -H * .58, W * .14, H * .3, '#a8acb8'); ctx.fillStyle = '#c8ccd8'; rr(ctx, W * .3, -H * .9, W * .4, H * .28, 8); ctx.fill(); rect(ctx, W * .34, -H * .76, W * .32, 3, '#2a2a30'); ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(W * .5, -H * .9); ctx.quadraticCurveTo(W * .9, -H * 1.02, W * .95, -H * .8); ctx.quadraticCurveTo(W * .75, -H * .9, W * .55, -H * .86); ctx.fill(); },
    torch(ctx, W, H, o) { rect(ctx, W * .44, -H * .55, W * .12, H * .4, WOOD_D); rect(ctx, W * .36, -H * .62, W * .28, H * .1, IRON); if (o.lit !== false) flame(ctx, W / 2, -H * .6, 7, o.t || 0); },
    longtable(ctx, W, H, o) { tableTop(ctx, 2, -H * .5, W - 4); legs(ctx, 2, W - 4, -H * .35, 0, WOOD_D, 3); if (o.feast) { for (let k = 0; k < 4; k++) { const x = W * (.12 + k * .25); ell(ctx, x, -H * .52, 7, 2.5, '#e8e0d0'); circ(ctx, x, -H * .58, 4, k % 2 ? '#c8602a' : '#e8c060'); if (k % 2) circ(ctx, x + 1, -H * .62, 2, '#5aa03a'); } rect(ctx, W * .5 - 2, -H * .78, 4, H * .26, '#f0e8d0'); flame(ctx, W * .5, -H * .78, 3.5, o.t || 0, .4); } else { ell(ctx, W * .3, -H * .52, 6, 2.5, '#e8e0d0'); circ(ctx, W * .7, -H * .56, 4, '#e8c060'); } },
    bench(ctx, W, H) { tableTop(ctx, 2, -H * .36, W - 4); legs(ctx, 2, W - 4, -H * .28, 0, WOOD_D); },
    gbench(ctx, W, H) { tableTop(ctx, 2, -H * .4, W - 4, '#8a6a4a', '#5a4a3a'); legs(ctx, 2, W - 4, -H * .32, 0, IRON); rect(ctx, 4, -H * .8, W - 8, 4, '#8a6a4a'); legs(ctx, 2, W - 4, -H * .8, -H * .4, '#5a4a3a'); },
    fireplace(ctx, W, H, o) { stoneFace(ctx, 0, -H, W, H, .3, false); rect(ctx, W * .18, -H * .72, W * .64, H * .72, '#1a1410'); rect(ctx, 0, -H, W, 6, '#8a857c'); rect(ctx, W * .22, -H * .1, W * .56, H * .1, '#3a2a20'); for (let k = 0; k < 3; k++) rect(ctx, W * .25 + k * W * .17, -H * .18, W * .14, H * .1, WOOD_D); if (o.lit !== false) flame(ctx, W / 2, -H * .16, W * .22, o.t || 0); if (o.season === 'winter') { rect(ctx, W * .3, -H * 1.05, W * .12, 3, '#3aa83a'); rect(ctx, W * .55, -H * 1.05, W * .12, 3, '#3aa83a'); } },
    tapestry(ctx, W, H, o) { rect(ctx, W * .05, -H * .97, W * .9, 3, WOOD_D); rect(ctx, W * .1, -H * .94, W * .8, H * .8, '#3a4a8a'); rect(ctx, W * .14, -H * .9, W * .72, H * .72, '#5a6aa8'); ctx.fillStyle = '#e8d8a0'; ctx.beginPath(); ctx.moveTo(W * .5, -H * .82); ctx.lineTo(W * .72, -H * .5); ctx.lineTo(W * .5, -H * .26); ctx.lineTo(W * .28, -H * .5); ctx.fill(); ell(ctx, W * .5, -H * .55, W * .14, H * .1, '#c8a040'); circ(ctx, W * .5, -H * .62, W * .07, '#e8c060'); for (let k = 0; k < 6; k++) rect(ctx, W * .1 + k * W * .14, -H * .14, W * .04, H * .08, '#c8b060'); },
    barrel(ctx, W, H) { ctx.fillStyle = hgrad(ctx, 0, W, 0, '#6a4020', '#a87040', '#5a3418'); rr(ctx, W * .1, -H * .92, W * .8, H * .9, 6); ctx.fill(); rect(ctx, W * .1, -H * .72, W * .8, 3, IRON); rect(ctx, W * .1, -H * .32, W * .8, 3, IRON); },
    crates(ctx, W, H) { rect(ctx, W * .08, -H * .6, W * .6, H * .6, '#b08a50'); ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 2; ctx.strokeRect(W * .08 + 1, -H * .6 + 1, W * .6 - 2, H * .6 - 2); line(ctx, W * .1, -H * .58, W * .66, -H * .02, '#7a5a30', 2); rect(ctx, W * .4, -H * .98, W * .5, H * .4, '#c09a60'); ctx.strokeRect(W * .4 + 1, -H * .98 + 1, W * .5 - 2, H * .4 - 2); },
    hearth(ctx, W, H, o) { stoneFace(ctx, 0, -H, W, H, .5, false); rect(ctx, W * .12, -H * .74, W * .76, H * .74, '#1a1410'); rect(ctx, 0, -H, W, 6, '#6a655c'); line(ctx, W * .2, -H * .6, W * .8, -H * .6, IRON, 2.5); line(ctx, W * .5, -H * .6, W * .5, -H * .42, IRON, 2); ctx.fillStyle = '#2a2a30'; rr(ctx, W * .36, -H * .42, W * .28, H * .18, 5); ctx.fill(); if (o.lit !== false) { flame(ctx, W / 2, -H * .08, W * .2, o.t || 0); ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 3; k++) circ(ctx, W * .5 + Math.sin((o.t || 0) * 2 + k) * 4, -H * .46 - k * 5 - ((o.t || 0) * 10 % 8), 2 + k * .5, 'rgba(255,255,255,.35)'); } for (let k = 0; k < 3; k++) rect(ctx, W * .2 + k * W * .2, -H * .14, W * .16, H * .1, WOOD_D); },
    potrack(ctx, W, H) { rect(ctx, W * .05, -H * .9, W * .9, 3, IRON); for (let k = 0; k < 3; k++) { const x = W * (.2 + k * .3); line(ctx, x, -H * .88, x, -H * .7, IRON, 1.5); ctx.fillStyle = k % 2 ? '#b87333' : '#8a8a92'; ctx.beginPath(); ctx.arc(x, -H * .5, W * .1, 0, Math.PI); ctx.lineTo(x - W * .1, -H * .68); ctx.lineTo(x + W * .1, -H * .68); ctx.fill(); } },
    herbs(ctx, W, H) { rect(ctx, 0, -H, W, 3, WOOD_D); for (let k = 0; k < 5; k++) { const x = W * (.1 + k * .2); line(ctx, x, -H, x, -H * .8, '#a89060', 1); ctx.fillStyle = k % 2 ? '#4a8a3a' : '#7a9a4a'; for (let j = 0; j < 4; j++) ell(ctx, x + (j % 2 ? 3 : -3), -H * .78 + j * 5, 4, 2.5, k % 2 ? '#4a8a3a' : '#7a9a4a', j % 2 ? .6 : -.6); if (k === 2) for (let j = 0; j < 3; j++) circ(ctx, x, -H * .74 + j * 7, 3.5, '#d8a030'); } },
    kitchentable(ctx, W, H) { tableTop(ctx, 2, -H * .5, W - 4, '#c0a070', '#8a6a40'); legs(ctx, 2, W - 4, -H * .36, 0, '#8a6a40'); ell(ctx, W * .3, -H * .54, 7, 3, '#e8e0d0'); rect(ctx, W * .55, -H * .62, W * .25, H * .1, '#c88040'); circ(ctx, W * .72, -H * .6, 3, '#e04040'); },
    cauldron(ctx, W, H, o) { ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(W / 2, -H * .38, W * .36, 0, Math.PI); ctx.lineTo(W * .14, -H * .62); ctx.lineTo(W * .86, -H * .62); ctx.fill(); ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, -H * .62, W * .3, Math.PI, 0); ctx.stroke(); ell(ctx, W / 2, -H * .62, W * .3, 4, '#5a8a3a'); legs(ctx, W * .2, W * .6, -H * .12, 0, '#2a2a30'); if (o.lit !== false) flame(ctx, W / 2, 0, 5, o.t || 0, .3); },
    breadshelf(ctx, W, H) { rect(ctx, W * .08, -H, W * .84, H, '#a87a48'); for (let k = 0; k < 3; k++) { const y = -H * (.22 + k * .3); rect(ctx, W * .12, y, W * .76, 3, WOOD_D); for (let j = 0; j < 2; j++) ell(ctx, W * (.3 + j * .4), y - 5, 7, 4.5, j % 2 ? '#c88a40' : '#e0a850'); } },
    canopybed(ctx, W, H) { rect(ctx, W * .05, -H, W * .06, H, WOOD_D); rect(ctx, W * .89, -H, W * .06, H, WOOD_D); rect(ctx, 0, -H, W, H * .1, '#7a2a6a'); ctx.fillStyle = 'rgba(160,80,150,.5)'; ctx.fillRect(W * .11, -H * .9, W * .1, H * .5); ctx.fillRect(W * .79, -H * .9, W * .1, H * .5); rect(ctx, W * .08, -H * .4, W * .84, H * .22, '#f0e8e0'); rect(ctx, W * .08, -H * .36, W * .84, H * .18, '#c04a60'); ell(ctx, W * .22, -H * .42, W * .1, H * .07, '#fff'); rect(ctx, W * .08, -H * .18, W * .84, H * .18, WOOD); legs(ctx, W * .08, W * .84, -H * .05, 0, WOOD_D); ctx.fillStyle = GOLD; for (let k = 0; k < 7; k++) ctx.fillRect(W * .02 + k * W * .145, -H * .92, W * .08, 3); },
    bed(ctx, W, H) { rect(ctx, W * .04, -H * .9, W * .06, H * .9, WOOD_D); rect(ctx, W * .9, -H * .6, W * .06, H * .6, WOOD_D); rect(ctx, W * .08, -H * .5, W * .86, H * .22, '#f0e8e0'); rect(ctx, W * .08, -H * .44, W * .86, H * .16, '#4a7ac0'); ell(ctx, W * .22, -H * .52, W * .1, H * .08, '#fff'); rect(ctx, W * .08, -H * .28, W * .86, H * .28, WOOD); },
    wardrobe(ctx, W, H) { rect(ctx, W * .08, -H * .96, W * .84, H * .96, '#8a5a30'); rect(ctx, W * .04, -H, W * .92, H * .06, '#6a4020'); rect(ctx, W * .14, -H * .88, W * .32, H * .8, '#a87040'); rect(ctx, W * .54, -H * .88, W * .32, H * .8, '#a87040'); circ(ctx, W * .44, -H * .5, 2, GOLD); circ(ctx, W * .56, -H * .5, 2, GOLD); },
    mirror(ctx, W, H) { ctx.fillStyle = GOLD_D; rr(ctx, W * .18, -H * .92, W * .64, H * .82, 10); ctx.fill(); ctx.fillStyle = hgrad(ctx, W * .2, W * .8, 0, '#c8e0f0', '#eef8ff', '#a8c8e0'); rr(ctx, W * .25, -H * .86, W * .5, H * .7, 8); ctx.fill(); line(ctx, W * .32, -H * .8, W * .32, -H * .3, 'rgba(255,255,255,.7)', 2); },
    candle(ctx, W, H, o) { tableTop(ctx, W * .15, -H * .4, W * .7); legs(ctx, W * .15, W * .7, -H * .3, 0, WOOD_D); rect(ctx, W * .45, -H * .7, W * .1, H * .3, '#f6f0d8'); if (o.lit !== false) flame(ctx, W / 2, -H * .7, 4, o.t || 0, .5); },
    cradle(ctx, W, H, o) { const rock = Math.sin((o.t || 0) * 2.5) * .08; ctx.save(); ctx.translate(W / 2, -H * .15); ctx.rotate(rock); ctx.fillStyle = '#b08050'; ctx.beginPath(); ctx.moveTo(-W * .4, -H * .5); ctx.lineTo(W * .4, -H * .5); ctx.lineTo(W * .3, 0); ctx.lineTo(-W * .3, 0); ctx.fill(); rect(ctx, -W * .34, -H * .5, W * .68, 4, '#f0e8e0'); circ(ctx, -W * .12, -H * .5, 5, '#f2c9a8'); ctx.fillStyle = '#e8b0c0'; ctx.fillRect(-W * .06, -H * .55, W * .34, 6); ctx.restore(); ctx.strokeStyle = WOOD_D; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, -H * .5, W * .45, .3, Math.PI - .3); ctx.stroke(); },
    rockinghorse(ctx, W, H) { ctx.strokeStyle = WOOD_D; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, -H * .6, W * .5, .35, Math.PI - .35); ctx.stroke(); ell(ctx, W / 2, -H * .45, W * .28, H * .16, '#e8e0d8'); horseHead(ctx, W * .72, -H * .62, W * .2, '#e8e0d8'); rect(ctx, W * .36, -H * .36, 4, H * .22, '#e8e0d8'); rect(ctx, W * .6, -H * .36, 4, H * .22, '#e8e0d8'); rect(ctx, W * .4, -H * .62, W * .2, 4, RED); for (let k = 0; k < 3; k++) circ(ctx, W * (.4 + k * .1), -H * .45, 2, '#c04a60'); },
    toychest(ctx, W, H) { ctx.fillStyle = '#b06a40'; rr(ctx, W * .1, -H * .6, W * .8, H * .6, 4); ctx.fill(); ctx.fillStyle = '#d08a50'; rr(ctx, W * .1, -H * .68, W * .8, H * .2, 5); ctx.fill(); rect(ctx, W * .46, -H * .55, W * .08, H * .1, GOLD); circ(ctx, W * .3, -H * .74, 5, '#e04040'); rect(ctx, W * .6, -H * .8, 8, 8, '#3a8ae0'); },
    dollhouse(ctx, W, H) { rect(ctx, W * .12, -H * .6, W * .76, H * .6, '#f0d8c0'); poly(ctx, [[W * .08, -H * .6], [W * .5, -H * .92], [W * .92, -H * .6]], '#c0504a'); rect(ctx, W * .22, -H * .5, W * .18, H * .16, '#80c0f0'); rect(ctx, W * .6, -H * .5, W * .18, H * .16, '#80c0f0'); rect(ctx, W * .4, -H * .26, W * .2, H * .26, '#8a5a30'); rect(ctx, W * .5 - 2, -H, 4, H * .1, '#8a5a30'); poly(ctx, [[W * .52, -H], [W * .7, -H * .96], [W * .52, -H * .92]], RED); },
    bookshelf(ctx, W, H) { rect(ctx, 0, -H, W, H, '#6a4020'); for (let k = 0; k < 3; k++) { const y = -H * (.95 - k * .3), sh = H * .26; rect(ctx, 4, y, W - 8, sh, '#3a2010'); let x = 6; const R = mulberry32(k + 3); while (x < W - 12) { const bw = 5 + R() * 6, bh = sh * (.6 + R() * .35); book(ctx, x, y + sh - bh, bw, bh, ['#c03a3a', '#2a6ad8', '#3aa84a', '#e8a030', '#8a4ad0', '#e8e0c0'][Math.floor(R() * 6)]); x += bw + 1; } rect(ctx, 2, y + sh, W - 4, 3, '#8a5a30'); } },
    desk(ctx, W, H) { tableTop(ctx, 2, -H * .5, W - 4, '#8a5a30', '#5a3a1a'); rect(ctx, W * .55, -H * .36, W * .4, H * .36, '#7a4a28'); legs(ctx, 2, W * .5, -H * .36, 0, '#5a3a1a'); rect(ctx, W * .12, -H * .56, W * .3, 3, '#f6f0d8'); line(ctx, W * .5, -H * .56, W * .56, -H * .85, '#2a2a2a', 1.5); ell(ctx, W * .56, -H * .86, 3, 2, '#e8e8f0'); circ(ctx, W * .5, -H * .56, 3.5, IRON); },
    globe(ctx, W, H) { rect(ctx, W * .3, -H * .12, W * .4, H * .12, WOOD_D); line(ctx, W / 2, -H * .12, W / 2, -H * .3, WOOD_D, 3); ctx.strokeStyle = GOLD_D; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, -H * .58, W * .3, .4, Math.PI - .4, true); ctx.stroke(); circ(ctx, W / 2, -H * .58, W * .26, '#3a7ac0'); ctx.fillStyle = '#5aa03a'; ctx.beginPath(); ctx.ellipse(W * .42, -H * .62, 5, 7, .4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(W * .58, -H * .5, 4, 5, -.4, 0, TAU); ctx.fill(); },
    telescope(ctx, W, H) { legs(ctx, W * .2, W * .6, -H * .4, 0, WOOD_D, 3); ctx.save(); ctx.translate(W / 2, -H * .45); ctx.rotate(-.6); rect(ctx, -W * .4, -4, W * .9, 8, '#b87333'); rect(ctx, W * .2, -5, W * .3, 10, '#8a5a30'); rect(ctx, -W * .45, -3, W * .1, 6, IRON); ctx.restore(); },
    scrolls(ctx, W, H) { rect(ctx, W * .1, -H * .9, W * .8, H * .7, '#6a4020'); for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { const y = -H * (.78 - r * .3) , x = W * (.3 + k * .4); circ(ctx, x, y, W * .14, '#f0e4c0'); circ(ctx, x, y, W * .06, '#c8b088'); } },
    brazier(ctx, W, H, o) { legs(ctx, W * .2, W * .6, -H * .4, 0, IRON, 3); ctx.fillStyle = IRON; ctx.beginPath(); ctx.arc(W / 2, -H * .5, W * .36, 0, Math.PI); ctx.fill(); rect(ctx, W * .14, -H * .54, W * .72, 4, '#4a4a52'); if (o.lit !== false) flame(ctx, W / 2, -H * .54, W * .22, o.t || 0); },
    bell(ctx, W, H, o) { const sw = o.ring ? Math.sin((o.t || 0) * 12) * .3 : 0; rect(ctx, 0, -H, W, 3, WOOD_D); ctx.save(); ctx.translate(W / 2, -H + 3); ctx.rotate(sw); ctx.fillStyle = GOLD_D; ctx.beginPath(); ctx.moveTo(-W * .1, 0); ctx.lineTo(W * .1, 0); ctx.lineTo(W * .34, H * .6); ctx.lineTo(-W * .34, H * .6); ctx.fill(); rect(ctx, -W * .36, H * .6, W * .72, 4, GOLD); circ(ctx, 0, H * .68, 3, IRON); ctx.restore(); },
    harp(ctx, W, H) { ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(W * .25, 0); ctx.lineTo(W * .25, -H * .9); ctx.quadraticCurveTo(W * .6, -H * 1.05, W * .8, -H * .7); ctx.lineTo(W * .8, 0); ctx.stroke(); ctx.strokeStyle = '#f8f0d0'; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { const x = W * (.3 + k * .09); line(ctx, x, -H * .05, x, -H * (.86 + k * .02) + k * 3, '#f8f0d0', 1); } rect(ctx, W * .2, -H * .06, W * .64, H * .06, GOLD_D); },
    lute(ctx, W, H) { rect(ctx, W * .2, -H * .12, W * .6, H * .12, WOOD_D); ctx.save(); ctx.translate(W / 2, -H * .4); ctx.rotate(-.5); ell(ctx, 0, 0, W * .26, H * .32, '#c08a40'); circ(ctx, 0, -2, 4, '#3a2010'); rect(ctx, -2, -H * .32, 4, -H * .3, WOOD_D); rect(ctx, -3, -H * .62, 6, 6, '#3a2010'); ctx.restore(); },
    drum(ctx, W, H) { rect(ctx, W * .18, -H * .64, W * .64, H * .6, RED); ell(ctx, W / 2, -H * .64, W * .32, H * .1, '#f0e8d0'); for (let k = 0; k < 4; k++) line(ctx, W * (.22 + k * .18), -H * .6, W * (.3 + k * .18), -H * .1, GOLD, 1.5); line(ctx, W * .6, -H * .95, W * .5, -H * .68, WOOD_D, 2); circ(ctx, W * .6, -H * .95, 3, '#f0e8d0'); },
    armourstand(ctx, W, H) { ITEM_DRAW.armour(ctx, W, H); rect(ctx, W * .3, -H * .04, W * .4, H * .04, WOOD_D); },
    shields(ctx, W, H) { shieldShape(ctx, W * .27, -H * .1, W * .36, H * .8, RED, GOLD); shieldShape(ctx, W * .73, -H * .1, W * .36, H * .8, BLUE, '#e8e8f0'); },
    lancerack(ctx, W, H) { rect(ctx, W * .1, -H * .5, W * .8, 4, WOOD_D); rect(ctx, W * .1, -H * .15, W * .8, 4, WOOD_D); for (let k = 0; k < 4; k++) { const x = W * (.2 + k * .2); line(ctx, x, 0, x + 4, -H * .95, k % 2 ? '#c8a060' : '#a88040', 3); circ(ctx, x + 4, -H * .95, 3.5, '#e8e0d0'); } },
    helmets(ctx, W, H) { rect(ctx, 0, -H * .3, W, 4, WOOD_D); for (let k = 0; k < 3; k++) { const x = W * (.18 + k * .32); ctx.fillStyle = '#c8ccd8'; rr(ctx, x - 7, -H * .75, 14, H * .45, 6); ctx.fill(); rect(ctx, x - 6, -H * .55, 12, 2.5, '#2a2a30'); if (k === 1) { ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(x, -H * .75); ctx.quadraticCurveTo(x + 10, -H * .95, x + 14, -H * .72); ctx.fill(); } } },
    chest(ctx, W, H) { ctx.fillStyle = '#8a5a30'; rr(ctx, W * .1, -H * .55, W * .8, H * .55, 3); ctx.fill(); ctx.fillStyle = '#a87040'; rr(ctx, W * .1, -H * .7, W * .8, H * .22, 6); ctx.fill(); rect(ctx, W * .1, -H * .5, W * .8, 3, GOLD_D); rect(ctx, W * .45, -H * .52, W * .1, H * .12, GOLD); for (let k = 0; k < 3; k++) circ(ctx, W * (.25 + k * .25), -H * .62, 2.5, GOLD); },
    coins(ctx, W, H) { for (let k = 0; k < 14; k++) { const R = mulberry32(k * 7 + 1), x = W * .1 + R() * W * .8, y = -R() * H * .5; ell(ctx, x, y, 5, 2.2, k % 3 ? GOLD : GOLD_D); } ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(W * .35, -H * .3, W * .3, H * .28, 0, 0, TAU); ctx.fill(); ctx.fillStyle = GOLD_D; for (let k = 0; k < 5; k++) ell(ctx, W * .2 + k * W * .08, -H * .2 - (k % 2) * 4, 4.5, 2, GOLD_D); circ(ctx, W * .7, -H * .28, 5, '#e03a5a'); circ(ctx, W * .8, -H * .14, 4, '#3a8ae0'); },
    crownstand(ctx, W, H) { rect(ctx, W * .3, -H * .1, W * .4, H * .1, '#5a2a6a'); rect(ctx, W * .45, -H * .5, W * .1, H * .4, '#5a2a6a'); cushion(ctx, W * .15, -H * .6, W * .7, H * .14, '#7a2a7a'); crown(ctx, W / 2, -H * .6, W * .3); },
    stall(ctx, W, H) { rect(ctx, 0, -H, W, H * .05, WOOD_D); for (let k = 0; k < 2; k++) { const x = k ? W - 6 : 0; rect(ctx, x, -H * .7, 6, H * .7, WOOD); } for (let k = 0; k < 4; k++) rect(ctx, 6, -H * (.66 - k * .13), W - 12, 4, '#a07040'); ctx.fillStyle = '#e8c860'; for (let k = 0; k < 10; k++) { const R = mulberry32(k + 11); ctx.fillRect(4 + R() * (W - 12), -5 - R() * 6, 6, 3); } rect(ctx, 0, -5, W, 5, '#d8b860'); },
    hay(ctx, W, H) { ctx.fillStyle = '#d8b040'; rr(ctx, W * .08, -H * .7, W * .84, H * .7, 6); ctx.fill(); ctx.strokeStyle = '#a88020'; ctx.lineWidth = 1; for (let k = 0; k < 9; k++) line(ctx, W * .12 + k * 3, -H * .66, W * .14 + k * 3, -H * .05, '#a88020', 1); rect(ctx, W * .08, -H * .5, W * .84, 2.5, '#8a5a20'); rect(ctx, W * .08, -H * .25, W * .84, 2.5, '#8a5a20'); },
    haystack(ctx, W, H) { ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.moveTo(W * .05, 0); ctx.quadraticCurveTo(W * .1, -H * .9, W * .5, -H * .98); ctx.quadraticCurveTo(W * .9, -H * .9, W * .95, 0); ctx.fill(); ctx.strokeStyle = '#a88020'; ctx.lineWidth = 1.2; for (let k = 0; k < 10; k++) line(ctx, W * .15 + k * W * .07, -H * .1 - (k % 3) * 10, W * .2 + k * W * .07, -H * .7 + (k % 2) * 6, '#a88020', 1.2); },
    trough(ctx, W, H) { rect(ctx, W * .05, -H * .5, W * .9, H * .5, '#8a6a40'); rect(ctx, W * .1, -H * .42, W * .8, H * .3, '#4a90d0'); rect(ctx, W * .05, -H * .5, W * .9, 3, '#a88050'); line(ctx, W * .15, -H * .35, W * .5, -H * .35, 'rgba(255,255,255,.5)', 1.5); },
    saddles(ctx, W, H) { rect(ctx, W * .1, -H * .62, W * .8, 4, WOOD_D); ctx.fillStyle = '#8a4a20'; ctx.beginPath(); ctx.moveTo(W * .15, -H * .6); ctx.quadraticCurveTo(W * .5, -H * .9, W * .85, -H * .6); ctx.lineTo(W * .8, -H * .25); ctx.quadraticCurveTo(W * .5, -H * .4, W * .2, -H * .25); ctx.fill(); rect(ctx, W * .3, -H * .34, W * .4, 3, GOLD_D); },
    lantern(ctx, W, H, o) { line(ctx, W * .3, -H * .75, W * .5, -H * .62, IRON, 2); rect(ctx, W * .36, -H * .62, W * .28, H * .36, IRON); rect(ctx, W * .4, -H * .58, W * .2, H * .28, o.lit !== false ? '#ffd070' : '#8a8a70'); if (o.lit !== false) { ctx.fillStyle = 'rgba(255,200,100,.25)'; ctx.beginPath(); ctx.arc(W / 2, -H * .44, W * .4, 0, TAU); ctx.fill(); } },
    kennel(ctx, W, H) { rect(ctx, W * .1, -H * .62, W * .8, H * .62, '#a87040'); poly(ctx, [[W * .04, -H * .6], [W * .5, -H * .98], [W * .96, -H * .6]], '#6a4020'); ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(W * .5, -H * .3, W * .18, Math.PI, 0); ctx.lineTo(W * .68, 0); ctx.lineTo(W * .32, 0); ctx.fill(); },
    bowl(ctx, W, H) { ctx.fillStyle = '#c05030'; ctx.beginPath(); ctx.moveTo(W * .15, -H * .3); ctx.lineTo(W * .85, -H * .3); ctx.lineTo(W * .75, 0); ctx.lineTo(W * .25, 0); ctx.fill(); ell(ctx, W / 2, -H * .3, W * .35, 4, '#8a5a30'); },
    anvil(ctx, W, H) { rect(ctx, W * .3, -H * .3, W * .4, H * .3, '#4a4a52'); ctx.fillStyle = '#6a6a74'; ctx.beginPath(); ctx.moveTo(W * .05, -H * .62); ctx.lineTo(W * .95, -H * .62); ctx.lineTo(W * .98, -H * .5); ctx.lineTo(W * .75, -H * .42); ctx.lineTo(W * .7, -H * .3); ctx.lineTo(W * .3, -H * .3); ctx.lineTo(W * .25, -H * .42); ctx.lineTo(W * .02, -H * .5); ctx.fill(); rect(ctx, W * .05, -H * .62, W * .9, 3, '#9a9aa4'); },
    forgefire(ctx, W, H, o) { stoneFace(ctx, 0, -H, W, H * .6, .6, false); rect(ctx, 0, -H * .4, W, H * .4, '#3a3a40'); rect(ctx, W * .08, -H * .5, W * .84, H * .12, '#2a2a30'); if (o.lit !== false) { flame(ctx, W / 2, -H * .5, W * .2, o.t || 0); ctx.fillStyle = `rgba(255,120,30,${.5 + .3 * Math.sin((o.t || 0) * 9)})`; ctx.fillRect(W * .2, -H * .48, W * .6, 4); } rect(ctx, W * .3, -H, W * .4, H * .42, '#5a5a62'); rect(ctx, W * .34, -H * .92, W * .32, H * .28, '#1a1410'); },
    bellows(ctx, W, H) { ctx.fillStyle = '#a87040'; ctx.beginPath(); ctx.moveTo(W * .1, -H * .2); ctx.lineTo(W * .7, -H * .55); ctx.lineTo(W * .7, -H * .1); ctx.lineTo(W * .1, -H * .05); ctx.fill(); rect(ctx, W * .7, -H * .36, W * .25, 4, IRON); for (let k = 0; k < 3; k++) line(ctx, W * .2 + k * W * .15, -H * .12, W * .2 + k * W * .15, -H * .3 - k * 4, '#5a3a1a', 1.5); },
    tools(ctx, W, H) { rect(ctx, 0, -H * .8, W, 4, WOOD_D); for (let k = 0; k < 4; k++) { const x = W * (.14 + k * .24); line(ctx, x, -H * .76, x, -H * .2, WOOD, 3); if (k % 2) rect(ctx, x - 7, -H * .7, 14, 7, IRON); else rect(ctx, x - 3, -H * .7, 10, 5, '#8a8a92'); } },
    oven(ctx, W, H, o) { stoneFace(ctx, 0, -H, W, H, .8, false); ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(W / 2, -H * .45, W * .3, Math.PI, 0); ctx.lineTo(W * .8, -H * .25); ctx.lineTo(W * .2, -H * .25); ctx.fill(); if (o.lit !== false) { ctx.fillStyle = 'rgba(255,140,40,.6)'; ctx.beginPath(); ctx.arc(W / 2, -H * .45, W * .22, Math.PI, 0); ctx.lineTo(W * .72, -H * .27); ctx.lineTo(W * .28, -H * .27); ctx.fill(); } for (let k = 0; k < 3; k++) ell(ctx, W * (.3 + k * .2), -H * .3, 6, 4, '#d8a050'); rect(ctx, W * .4, -H * 1.04, W * .2, H * .1, '#5a554c'); },
    flour(ctx, W, H) { ctx.fillStyle = '#e8e0d0'; rr(ctx, W * .1, -H * .62, W * .5, H * .62, 7); ctx.fill(); rr(ctx, W * .45, -H * .5, W * .48, H * .5, 7); ctx.fill(); rect(ctx, W * .18, -H * .6, W * .34, 4, '#a89070'); rect(ctx, W * .52, -H * .48, W * .34, 4, '#a89070'); },
    cheese(ctx, W, H) { ell(ctx, W / 2, -H * .22, W * .4, H * .14, '#e8b830'); rect(ctx, W * .1, -H * .22, W * .8, H * .22, '#f0c838'); ell(ctx, W / 2, 0, W * .4, H * .1, '#e0b020'); ctx.fillStyle = '#f0c838'; ctx.beginPath(); ctx.moveTo(W * .5, -H * .62); ctx.lineTo(W * .8, -H * .42); ctx.lineTo(W * .5, -H * .36); ctx.fill(); for (const [x, y] of [[.3, -.1], [.6, -.15], [.45, -.05]]) circ(ctx, W * x, H * y - 2, 2, '#d0a020'); },
    winerack(ctx, W, H) { rect(ctx, 0, -H, W, H, '#5a3a1a'); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { const x = W * (.2 + k * .3), y = -H * (.85 - r * .3); circ(ctx, x, y, 6, '#2a4a2a'); circ(ctx, x, y, 2.5, '#c0a060'); } },
    painting(ctx, W, H) { rect(ctx, W * .1, -H * .9, W * .8, H * .8, GOLD_D); rect(ctx, W * .16, -H * .84, W * .68, H * .68, '#8ac0e8'); rect(ctx, W * .16, -H * .5, W * .68, H * .34, '#5a9a3a'); rect(ctx, W * .4, -H * .7, W * .2, H * .3, '#a8a09a'); poly(ctx, [[W * .38, -H * .7], [W * .5, -H * .82], [W * .62, -H * .7]], '#8a3a30'); },
    plant(ctx, W, H) { ctx.fillStyle = '#b86a40'; ctx.beginPath(); ctx.moveTo(W * .25, -H * .35); ctx.lineTo(W * .75, -H * .35); ctx.lineTo(W * .68, 0); ctx.lineTo(W * .32, 0); ctx.fill(); rect(ctx, W * .2, -H * .4, W * .6, H * .08, '#c87a50'); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .5; ell(ctx, W / 2 + Math.cos(a) * W * .22, -H * .5 + Math.sin(a) * H * .25, 7, 3.5, '#4a9a3a', a + Math.PI / 2); } circ(ctx, W / 2, -H * .72, 4, '#e04a7a'); },
    stool(ctx, W, H) { tableTop(ctx, W * .15, -H * .45, W * .7); legs(ctx, W * .15, W * .7, -H * .38, 0, WOOD_D); },
    table(ctx, W, H) { tableTop(ctx, W * .08, -H * .55, W * .84); legs(ctx, W * .08, W * .84, -H * .48, 0, WOOD_D); ell(ctx, W / 2, -H * .58, 6, 2.5, '#e8e0d0'); },
    fountain(ctx, W, H, o) { const t = o.t || 0; ctx.fillStyle = '#a8a39a'; rr(ctx, W * .05, -H * .3, W * .9, H * .3, 8); ctx.fill(); rect(ctx, W * .1, -H * .26, W * .8, H * .18, '#4a90d0'); rect(ctx, W * .3, -H * .62, W * .4, H * .06, '#b8b3aa'); rect(ctx, W * .45, -H * .58, W * .1, H * .3, '#9a958c'); rect(ctx, W * .35, -H * .66, W * .3, H * .05, '#4a90d0'); for (let k = 0; k < 7; k++) { const a = (k - 3) * .35, l = H * .45; ctx.strokeStyle = 'rgba(180,220,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, -H * .66); ctx.quadraticCurveTo(W / 2 + Math.sin(a) * l * .6, -H * .66 - l * .9, W / 2 + Math.sin(a) * l * .9, -H * .3); ctx.stroke(); } for (let k = 0; k < 8; k++) { const ph = t * 3 + k; circ(ctx, W / 2 + Math.sin(ph * .7 + k) * W * .3, -H * .3 - ((ph * 20) % 30), 1.8, 'rgba(220,240,255,.8)'); } ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k <= 6; k++) ctx.lineTo(W * .12 + k * W * .76 / 6, -H * .24 + Math.sin(t * 4 + k) * 1.5); ctx.stroke(); },
    rosebush(ctx, W, H) { bush(ctx, W / 2, 0, W * .36, '#2e7a30'); for (const [x, y] of [[.3, -.5], [.6, -.75], [.72, -.4], [.45, -.3]]) circ(ctx, W * x, H * y, 3.2, '#e03a5a'); },
    hedge(ctx, W, H) { ctx.fillStyle = '#2e7a30'; rr(ctx, 1, -H * .92, W - 2, H * .92, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, 4, -H * .88, W - 8, H * .2, 4); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(1, -H * .25, W - 2, H * .2); },
    hedgearch(ctx, W, H) { ctx.fillStyle = '#2e7a30'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H * .55); ctx.arc(W / 2, -H * .55, W / 2, Math.PI, 0); ctx.lineTo(W, 0); ctx.lineTo(W * .8, 0); ctx.lineTo(W * .8, -H * .5); ctx.arc(W / 2, -H * .5, W * .3, 0, Math.PI, true); ctx.lineTo(W * .2, 0); ctx.closePath(); ctx.fill(); for (const [x, y] of [[.15, -.6], [.5, -.9], [.85, -.6]]) circ(ctx, W * x, H * y, 2.5, '#f0e060'); },
    topiary(ctx, W, H) { rect(ctx, W * .44, -H * .3, W * .12, H * .3, '#6a4020'); circ(ctx, W / 2, -H * .72, W * .34, '#2e7a30'); circ(ctx, W / 2, -H * .42, W * .22, '#2e7a30'); ctx.fillStyle = 'rgba(255,255,255,.15)'; circ(ctx, W * .42, -H * .8, W * .12, 'rgba(255,255,255,.15)'); },
    appletree(ctx, W, H, o) { rect(ctx, W * .44, -H * .45, W * .12, H * .45, '#6a4020'); const au = o.season === 'autumn', wi = o.season === 'winter'; if (!wi) { bush(ctx, W / 2, -H * .4, W * .42, au ? '#c08a30' : '#3a8a3a'); if (!au && o.season !== 'spring') for (const [x, y] of [[.3, -.6], [.62, -.8], [.72, -.5], [.45, -.5], [.55, -.65]]) circ(ctx, W * x, H * y, 3, '#e03a3a'); if (o.season === 'spring') for (const [x, y] of [[.3, -.6], [.62, -.8], [.72, -.5], [.45, -.52], [.55, -.68], [.35, -.78]]) circ(ctx, W * x, H * y, 2.5, '#ffd0e0'); } else { for (const [x0, y0, x1, y1] of [[.5, -.45, .3, -.75], [.5, -.45, .7, -.78], [.5, -.5, .5, -.85], [.3, -.75, .2, -.85], [.7, -.78, .82, -.9]]) line(ctx, W * x0, H * y0, W * x1, H * y1, '#5a3418', 3); } },
    well(ctx, W, H) { stoneFace(ctx, W * .1, -H * .3, W * .8, H * .3, .4, false); rect(ctx, W * .18, -H * .32, W * .64, 3, '#1a1410'); rect(ctx, W * .15, -H * .9, W * .08, H * .6, WOOD_D); rect(ctx, W * .77, -H * .9, W * .08, H * .6, WOOD_D); poly(ctx, [[W * .05, -H * .88], [W * .5, -H * 1.02], [W * .95, -H * .88]], '#8a3a30'); line(ctx, W * .5, -H * .86, W * .5, -H * .55, '#6a6a72', 1.5); rect(ctx, W * .42, -H * .56, W * .16, H * .1, IRON); },
    pond(ctx, W) { ell(ctx, W / 2, -2, W * .48, 6, '#3a78b8'); ell(ctx, W / 2, -3, W * .44, 4, '#4a90d0'); for (const [x, col] of [[.25, '#3a9a3a'], [.6, '#2e7a30'], [.8, '#3a9a3a']]) ell(ctx, W * x, -4, 5, 2.5, col); circ(ctx, W * .6, -6, 2.5, '#f0a0c0'); },
    quintain(ctx, W, H, o) { const sw = o.swing || 0; rect(ctx, W * .44, -H * .9, W * .12, H * .9, WOOD_D); ctx.save(); ctx.translate(W / 2, -H * .72); ctx.rotate(sw); rect(ctx, -W * .9, -2, W * 1.8, 4, WOOD); shieldShape(ctx, -W * .9, H * .14, W * .5, H * .3, RED, GOLD); circ(ctx, W * .9, 0, W * .22, '#c8a060'); ctx.restore(); },
    tiltrail(ctx, W) { rect(ctx, 0, -8, W, 8, '#8a6a40'); rect(ctx, 0, -8, W, 2, '#c0a070'); for (let k = 0; k < W; k += 24) { rect(ctx, k + 6, -8, 4, 8, '#5a4a30'); } for (let k = 0; k < W; k += 16) rect(ctx, k, -8, 8, 2, k % 32 ? RED : '#f0f0f0'); },
    stand(ctx, W, H, o) { rect(ctx, W * .08, -H * .5, W * .84, H * .5, '#8a6a40'); rect(ctx, W * .08, -H * .5, W * .84, 4, '#c0a070'); rect(ctx, W * .05, -H, W * .06, H, WOOD_D); rect(ctx, W * .89, -H, W * .06, H, WOOD_D); ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(0, -H); ctx.lineTo(W, -H); for (let k = 5; k >= 0; k--) ctx.lineTo(k * W / 5, -H * .82 + (k % 2 ? 0 : -H * .06)); ctx.fill(); ctx.fillStyle = '#f0f0f0'; for (let k = 0; k < 5; k += 2) ctx.fillRect(k * W / 5, -H, W / 5, H * .1); cushion(ctx, W * .2, -H * .62, W * .6, H * .12, '#7a1e5a'); },
    flag(ctx, W, H, o) { const t = o.t || 0, col = o.robe || RED; line(ctx, W * .3, 0, W * .3, -H * .98, '#8a857c', 2.5); circ(ctx, W * .3, -H * .98, 2.5, GOLD); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(W * .32, -H * .95); for (let k = 0; k <= 6; k++) ctx.lineTo(W * .32 + k * W * .14, -H * .95 + Math.sin(t * 6 + k * .9) * 2.5 * (k / 6)); for (let k = 6; k >= 0; k--) ctx.lineTo(W * .32 + k * W * .14, -H * .62 + Math.sin(t * 6 + k * .9 + .5) * 2.5 * (k / 6)); ctx.fill(); crown(ctx, W * .6, -H * .74, 4); },
    tent(ctx, W, H) { ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(W * .05, 0); ctx.lineTo(W * .5, -H * .95); ctx.lineTo(W * .95, 0); ctx.fill(); ctx.fillStyle = '#f4f0e8'; for (let k = 0; k < 4; k += 2) poly(ctx, [[W * .05 + k * W * .9 / 4, 0], [W * .05 + (k + 1) * W * .9 / 4, 0], [W * .5, -H * .95]], '#f4f0e8'); ctx.fillStyle = RED; poly(ctx, [[W * .05, 0], [W * .5, -H * .95], [W * .275, 0]], RED); poly(ctx, [[W * .5, -H * .95], [W * .725, 0], [W * .5, 0]], RED); ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.moveTo(W * .4, 0); ctx.lineTo(W * .5, -H * .4); ctx.lineTo(W * .6, 0); ctx.fill(); line(ctx, W * .5, -H * .95, W * .5, -H * 1.12, WOOD_D, 2); poly(ctx, [[W * .5, -H * 1.12], [W * .66, -H * 1.07], [W * .5, -H * 1.02]], GOLD); },
    marketstall(ctx, W, H) { rect(ctx, W * .1, -H * .42, W * .8, H * .42, '#a87040'); rect(ctx, W * .06, -H, W * .05, H, WOOD_D); rect(ctx, W * .89, -H, W * .05, H, WOOD_D); ctx.fillStyle = '#3a8ae0'; ctx.beginPath(); ctx.moveTo(0, -H); ctx.lineTo(W, -H); for (let k = 6; k >= 0; k--) ctx.lineTo(k * W / 6, -H * .82 - (k % 2) * H * .05); ctx.fill(); ctx.fillStyle = '#f0f0f0'; for (let k = 0; k < 6; k += 2) ctx.fillRect(k * W / 6, -H, W / 6, H * .09); for (let k = 0; k < 4; k++) circ(ctx, W * (.22 + k * .18), -H * .48, 5, ['#e04040', '#e8c060', '#5aa03a', '#e0a050'][k]); },
    lamppost(ctx, W, H, o) { rect(ctx, W * .44, -H * .85, W * .12, H * .85, IRON); rect(ctx, W * .3, -H * .06, W * .4, H * .06, IRON); rect(ctx, W * .3, -H * .98, W * .4, H * .2, IRON); rect(ctx, W * .36, -H * .94, W * .28, H * .14, o.lit !== false ? '#ffd070' : '#8a8a70'); if (o.lit !== false) { ctx.fillStyle = 'rgba(255,200,100,.25)'; ctx.beginPath(); ctx.arc(W / 2, -H * .88, W * .5, 0, TAU); ctx.fill(); } },
    swing(ctx, W, H, o) { const a = Math.sin((o.t || 0) * 1.8) * .3; rect(ctx, W * .05, -H, W * .06, H, WOOD_D); rect(ctx, W * .89, -H, W * .06, H, WOOD_D); rect(ctx, 0, -H, W, 4, WOOD_D); ctx.save(); ctx.translate(W / 2, -H + 4); ctx.rotate(a); line(ctx, -W * .15, 0, -W * .15, H * .65, '#8a8a70', 1.5); line(ctx, W * .15, 0, W * .15, H * .65, '#8a8a70', 1.5); rect(ctx, -W * .2, H * .65, W * .4, 5, WOOD); ctx.restore(); },
    beehive(ctx, W, H, o) { ctx.fillStyle = '#d8a850'; for (let k = 0; k < 4; k++) ell(ctx, W / 2, -H * (.12 + k * .2), W * (.42 - k * .06), H * .12, k % 2 ? '#d8a850' : '#c89840'); rect(ctx, W * .42, -H * .22, W * .16, H * .08, '#3a2010'); for (let k = 0; k < 4; k++) { const ph = (o.t || 0) * 4 + k * 1.7; circ(ctx, W / 2 + Math.cos(ph) * W * .45, -H * .5 + Math.sin(ph * 1.3) * H * .3, 1.6, '#f0c020'); } },
    birdbath(ctx, W, H) { rect(ctx, W * .3, -H * .1, W * .4, H * .1, '#a8a39a'); rect(ctx, W * .44, -H * .5, W * .12, H * .4, '#a8a39a'); ell(ctx, W / 2, -H * .55, W * .42, H * .1, '#b8b3aa'); ell(ctx, W / 2, -H * .57, W * .34, H * .06, '#4a90d0'); circ(ctx, W * .7, -H * .66, 3, '#7a8a9a'); },
    cart(ctx, W, H) { rect(ctx, W * .1, -H * .62, W * .7, H * .32, '#a87040'); circ(ctx, W * .3, -H * .22, H * .22, '#5a3a1a'); circ(ctx, W * .3, -H * .22, H * .08, '#c0a070'); line(ctx, W * .8, -H * .4, W * .98, -H * .28, WOOD_D, 3); ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.moveTo(W * .12, -H * .62); ctx.quadraticCurveTo(W * .45, -H, W * .78, -H * .62); ctx.fill(); },
    dovecote(ctx, W, H, o) { rect(ctx, W * .44, -H * .3, W * .12, H * .3, WOOD_D); rect(ctx, W * .15, -H * .8, W * .7, H * .5, '#f0e8d8'); poly(ctx, [[W * .08, -H * .8], [W * .5, -H], [W * .92, -H * .8]], '#8a3a30'); for (let k = 0; k < 2; k++) { ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(W * (.32 + k * .36), -H * .6, 3.5, Math.PI, 0); ctx.lineTo(W * (.32 + k * .36) + 3.5, -H * .5); ctx.lineTo(W * (.32 + k * .36) - 3.5, -H * .5); ctx.fill(); } rect(ctx, W * .15, -H * .5, W * .7, 3, '#c0b8a8'); },
    sundial(ctx, W, H) { rect(ctx, W * .38, -H * .5, W * .24, H * .5, '#a8a39a'); ell(ctx, W / 2, -H * .52, W * .4, H * .12, '#c8c3b8'); ell(ctx, W / 2, -H * .53, W * .32, H * .08, GOLD_D); poly(ctx, [[W / 2, -H * .55], [W / 2, -H * .82], [W * .66, -H * .55]], GOLD); },
    perch(ctx, W, H) { rect(ctx, 0, -H * .35, W, H * .35, '#6a655c'); rect(ctx, 0, -H * .35, W, 3, '#a8a39a'); for (let k = 0; k < 3; k++) rect(ctx, W * (.15 + k * .3), -H * .55, W * .1, H * .2, GOLD_D); },
    fireworks(ctx, W, H) { rect(ctx, W * .15, -H * .5, W * .7, H * .5, '#8a3a30'); for (let k = 0; k < 3; k++) { rect(ctx, W * (.22 + k * .22), -H * .9, W * .12, H * .42, ['#e04040', '#3a8ae0', '#e8c060'][k]); poly(ctx, [[W * (.22 + k * .22), -H * .9], [W * (.28 + k * .22), -H * 1.02], [W * (.34 + k * .22), -H * .9]], '#f0f0f0'); } },
    stool2() {}
  };
  function item(ctx, key, o = {}) {
    const it = ITEMS[key]; if (!it) return;
    const W = it.w * C, H = it.h * C;
    (ITEM_DRAW[key] || ITEM_DRAW.crates)(ctx, W, H, o);
  }

  /* ---------- people ----------
     p: { role, look {hair, skin, robe, trim}, ph (walk phase), moving, face (±1), act, actT, s, carry }
     roles: royal (prince/princess), king, queen, knight, cook, maid, jester, falconer, sage, smith, baker, groom, guard, visitor */
  const ROLE_LOOK = {
    king: { hair: '#a8a8a8', skin: '#f2c9a8', robe: '#7a1e5a', trim: GOLD }, queen: { hair: '#5a2a12', skin: '#f2c9a8', robe: '#2a6a9a', trim: GOLD },
    knight: { hair: '#4a2a12', skin: '#f2c9a8', robe: '#9a9ea8', trim: '#c8ccd8' }, cook: { hair: '#8a4a2a', skin: '#e8b890', robe: '#f0f0f0', trim: '#c0c0c0' },
    maid: { hair: '#3a2a12', skin: '#f6d8c0', robe: '#4a6ab0', trim: '#f0f0f0' }, jester: { hair: '#c0402a', skin: '#f2c9a8', robe: '#e8c020', trim: '#7a2ad0' },
    falconer: { hair: '#2a1a12', skin: '#8a5a3a', robe: '#5a7a3a', trim: '#8a5a30' }, sage: { hair: '#e8e8e8', skin: '#f2c9a8', robe: '#3a3a7a', trim: '#8a8ad0' },
    smith: { hair: '#1a1210', skin: '#7a4a2a', robe: '#5a4a40', trim: '#8a7a70' }, baker: { hair: '#e8c060', skin: '#f6d8c0', robe: '#f4ece0', trim: '#d8c8a0' },
    groom: { hair: '#8a5a2a', skin: '#e8b890', robe: '#8a6a40', trim: '#5a4a30' }, guard: { hair: '#4a2a12', skin: '#e8b890', robe: '#6a7a9a', trim: '#c8ccd8' },
    visitor: { hair: '#2a1a12', skin: '#8a5a3a', robe: '#c03a7a', trim: GOLD }, trader: { hair: '#5a3a1a', skin: '#f2c9a8', robe: '#3a8a6a', trim: '#e8c060' }
  };
  function person(ctx, p) {
    const s = p.s || 1, look = p.look || ROLE_LOOK[p.role] || ROLE_LOOK.guard, t = p.ph || 0, mv = p.moving ? 1 : 0;
    const act = p.act || 'walk', royal = p.role === 'royal' || p.role === 'king' || p.role === 'queen' || p.role === 'visitor';
    ctx.save(); ctx.scale(s * (p.face || 1), s);
    if (act === 'sleep') { ctx.translate(0, -8); ctx.rotate(-Math.PI / 2); ctx.translate(-10, 0); }
    const bob = act === 'walk' ? Math.abs(Math.sin(t * 2)) * 1.6 * mv : 0;
    const sit = act === 'sit' || act === 'eat' || act === 'read' || act === 'play' || act === 'ride';
    const legA = act === 'walk' ? Math.sin(t * 2) * .7 * mv : 0;
    /* legs */
    ctx.strokeStyle = p.role === 'knight' || p.role === 'guard' ? '#8a8e9a' : shade(look.robe, .55); ctx.lineWidth = 5; ctx.lineCap = 'round';
    if (!sit) { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 3, -16 - bob); ctx.lineTo(d * 3 + Math.sin(legA * d) * 7, -2); ctx.stroke(); } }
    else { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 3, -16); ctx.lineTo(8, -14); ctx.lineTo(9, -2); ctx.stroke(); } }
    ctx.fillStyle = '#3a2a1a'; ell(ctx, -3 + (sit ? 12 : Math.sin(legA * -1) * 7), -1.5, 4.5, 2.2, '#3a2a1a'); ell(ctx, 3 + (sit ? 12 : Math.sin(legA) * 7), -1.5, 4.5, 2.2, '#3a2a1a');
    /* body: a robe or a tunic */
    const long = royal || p.role === 'sage' || p.role === 'maid' || p.role === 'queen';
    ctx.fillStyle = look.robe;
    ctx.beginPath(); ctx.moveTo(-7, -36 - bob); ctx.lineTo(7, -36 - bob); ctx.lineTo(long ? 11 : 8, long ? -6 : -14); ctx.lineTo(long ? -11 : -8, long ? -6 : -14); ctx.closePath(); ctx.fill();
    if (p.role === 'knight' || p.role === 'guard') { ctx.fillStyle = '#b8bcc8'; rr(ctx, -7, -36 - bob, 14, 18, 3); ctx.fill(); rect(ctx, -7, -26 - bob, 14, 2, '#5a5e6a'); if (p.role === 'knight') { ctx.fillStyle = look.robe === ROLE_LOOK.knight.robe ? RED : look.robe; rect(ctx, -5, -34 - bob, 10, 12, ctx.fillStyle); poly(ctx, [[-4, -33 - bob], [0, -29 - bob], [4, -33 - bob], [0, -24 - bob]], GOLD); } }
    else { rect(ctx, -7, -24 - bob, 14, 2.5, look.trim); if (p.role === 'cook' || p.role === 'baker' || p.role === 'smith') { rect(ctx, -5, -30 - bob, 10, 20, p.role === 'smith' ? '#3a3a40' : '#f8f8f4'); } if (p.role === 'jester') { for (let k = 0; k < 3; k++) rect(ctx, -6 + k * 4.5, -34 - bob + (k % 2) * 6, 4, 6, k % 2 ? '#7a2ad0' : '#2a9a6a'); } if (p.role === 'maid') rect(ctx, -6, -22 - bob, 12, 14, '#f8f8f4'); }
    /* arms */
    ctx.strokeStyle = look.robe; ctx.lineWidth = 4.5;
    const armA = act === 'walk' ? Math.sin(t * 2) * .6 * mv : 0;
    const armPose = (d) => {
      ctx.beginPath(); ctx.moveTo(d * 6, -33 - bob);
      if (act === 'wave' || act === 'cheer') ctx.lineTo(d * 12, -46 - Math.sin(t * 6) * 3);
      else if (act === 'hammer' || act === 'cook' || act === 'bake') ctx.lineTo(d > 0 ? 14 : -4, d > 0 ? -28 + Math.abs(Math.sin(t * 5)) * -12 : -22);
      else if (act === 'read' || act === 'eat') ctx.lineTo(d * 4 + 8, -24);
      else if (act === 'brush') ctx.lineTo(d > 0 ? 16 : -6, -28 + Math.sin(t * 6) * 4);
      else if (act === 'play') ctx.lineTo(d * 2 + 9, -26 + Math.sin(t * 5 + d) * 3);
      else if (act === 'ride') ctx.lineTo(10, -26);
      else if (act === 'look') ctx.lineTo(d > 0 ? 8 : -5, d > 0 ? -40 : -22);
      else ctx.lineTo(d * 7 + Math.sin(-armA * d) * 6, -18 - bob);
      ctx.stroke();
    };
    armPose(-1); armPose(1);
    circ(ctx, act === 'wave' || act === 'cheer' ? 12 : act === 'hammer' || act === 'cook' || act === 'bake' ? 14 : 7 + Math.sin(-armA) * 6, act === 'wave' || act === 'cheer' ? -46 - Math.sin(t * 6) * 3 : act === 'hammer' ? -28 + Math.abs(Math.sin(t * 5)) * -12 : -18 - bob, 2.8, look.skin);
    /* things in hand */
    if (act === 'hammer') { ctx.save(); ctx.translate(14, -28 + Math.abs(Math.sin(t * 5)) * -12); ctx.rotate(-.8 + Math.abs(Math.sin(t * 5)) * .9); rect(ctx, -1.5, -14, 3, 14, WOOD); rect(ctx, -6, -18, 12, 6, IRON); ctx.restore(); }
    if (act === 'cook') { rect(ctx, 12, -42, 2, 16, WOOD); ell(ctx, 13, -43, 4, 2, '#8a8a92'); }
    if (act === 'brush') { rect(ctx, 14, -32 + Math.sin(t * 6) * 4, 8, 4, '#c08a40'); }
    if (act === 'read') { rect(ctx, 6, -30, 12, 9, '#e8e0c0'); rect(ctx, 12, -30, .8, 9, '#8a7a5a'); }
    if (act === 'eat') { ell(ctx, 10, -26, 2, 1.2, '#8a8a92'); }
    if (act === 'play' && p.role !== 'jester') { rect(ctx, 4, -30, 10, 3, WOOD); }
    if (p.role === 'falconer') { rect(ctx, 7, -26 - bob, 6, 5, '#8a5a30'); }
    if (p.role === 'knight' && act === 'train') { ctx.save(); ctx.translate(8, -30); ctx.rotate(-.2 + Math.sin(t * 4) * .15); rect(ctx, 0, -1.5, 34, 3, '#c8a060'); circ(ctx, 34, 0, 2.5, '#e8e0d0'); ctx.restore(); }
    /* head */
    const hy = -44 - bob;
    circ(ctx, 0, hy, 7.5, look.skin);
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(0, hy - 1, 7.8, Math.PI, 0); ctx.lineTo(7.8, hy + 1); ctx.lineTo(-7.8, hy + 1); ctx.fill();
    if (p.role === 'royal' && p.sex === 'princess' || p.role === 'queen' || p.role === 'maid') { ctx.fillStyle = look.hair; ctx.fillRect(-8, hy - 1, 3.5, 14); ctx.fillRect(4.5, hy - 1, 3.5, 14); }
    if (p.role === 'sage') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.moveTo(-5, hy + 4); ctx.lineTo(5, hy + 4); ctx.lineTo(0, hy + 16); ctx.fill(); }
    circ(ctx, 3, hy, 1.1, '#1a1a1a'); circ(ctx, -1.5, hy, 1.1, '#1a1a1a'); ctx.strokeStyle = '#a05050'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(1, hy + 2.5, 2.2, .2, Math.PI - .2); ctx.stroke();
    /* hats */
    if (royal) crown(ctx, 0, hy - 6, 5.5);
    if (p.role === 'knight' || p.role === 'guard') { ctx.fillStyle = '#c8ccd8'; rr(ctx, -8, hy - 9, 16, 11, 5); ctx.fill(); rect(ctx, -8, hy - 2, 16, 2.5, '#2a2a30'); if (p.role === 'knight') { ctx.fillStyle = look.robe === ROLE_LOOK.knight.robe ? RED : look.robe; ctx.beginPath(); ctx.moveTo(0, hy - 9); ctx.quadraticCurveTo(-10, hy - 16, -14, hy - 4); ctx.quadraticCurveTo(-8, hy - 10, -1, hy - 8); ctx.fill(); } }
    if (p.role === 'cook' || p.role === 'baker') { ctx.fillStyle = '#fff'; rr(ctx, -7, hy - 15, 14, 9, 4); ctx.fill(); rect(ctx, -7, hy - 8, 14, 3, '#f0f0f0'); }
    if (p.role === 'jester') { ctx.fillStyle = '#7a2ad0'; poly(ctx, [[-7, hy - 5], [-12, hy - 16], [-3, hy - 7]], '#7a2ad0'); poly(ctx, [[7, hy - 5], [12, hy - 16], [3, hy - 7]], '#e8c020'); poly(ctx, [[-4, hy - 7], [0, hy - 18], [4, hy - 7]], '#2a9a6a'); circ(ctx, -12, hy - 16, 2, GOLD); circ(ctx, 12, hy - 16, 2, GOLD); circ(ctx, 0, hy - 18, 2, GOLD); }
    if (p.role === 'maid') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, hy - 2, 8, Math.PI, 0); ctx.fill(); }
    if (p.role === 'sage') { ctx.fillStyle = look.robe; poly(ctx, [[-8, hy - 5], [0, hy - 20], [8, hy - 5]], look.robe); }
    if (p.role === 'falconer' || p.role === 'groom' || p.role === 'trader') { ctx.fillStyle = look.trim; rr(ctx, -8, hy - 8, 16, 5, 2); ctx.fill(); }
    if (p.role === 'falconer' && act !== 'walk') { ctx.save(); ctx.translate(11, -30 - bob); hawk(ctx, { s: .55, perched: true }); ctx.restore(); }
    if (p.carry === 'tray') { rect(ctx, 6, -22 - bob, 14, 2, '#c0a070'); circ(ctx, 10, -25 - bob, 2.5, '#e8c060'); circ(ctx, 16, -25 - bob, 2.5, '#c8602a'); }
    if (p.carry === 'bucket') { rect(ctx, 8, -18 - bob, 6, 7, '#8a8a92'); }
    if (p.carry === 'book') { rect(ctx, 6, -22 - bob, 8, 6, '#c03a3a'); }
    if (p.carry === 'hay') { ell(ctx, 10, -22 - bob, 7, 4, '#d8b040'); }
    if (p.zzz) { ctx.font = `900 ${8}px ${UI_FONT}`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('z', 14, hy - 10 - (p.zzz % 1) * 10); }
    ctx.restore();
  }

  /* ---------- animals ---------- */
  /* a horse: body about 56 long and 40 tall, feet at the origin, facing +x */
  function horse(ctx, h) {
    const s = h.s || 1, t = h.ph || 0, mv = h.moving ? 1 : 0, col = h.col || '#8a5a3a', mane = h.mane || '#3a2210';
    ctx.save(); ctx.scale(s * (h.face || 1), s);
    const gallop = h.gallop ? 1 : 0, bob = Math.abs(Math.sin(t * 2)) * 2 * mv;
    /* legs */
    ctx.strokeStyle = shade(col, .8); ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const x = k < 2 ? -18 + k * 6 : 12 + (k - 2) * 7, ph = t * 2 + (k % 2) * Math.PI + (k < 2 ? 0 : .5), sw = Math.sin(ph) * (8 + gallop * 8) * mv; ctx.beginPath(); ctx.moveTo(x, -24 - bob); ctx.lineTo(x + sw * .5, -12 - bob * .5); ctx.lineTo(x + sw, -2); ctx.stroke(); ell(ctx, x + sw, -1.5, 3.2, 2, '#2a2016'); }
    /* body */
    ell(ctx, 0, -28 - bob, 26, 12, col);
    ell(ctx, -16, -30 - bob, 12, 11, col);
    /* tail */
    ctx.strokeStyle = mane; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, -32 - bob); ctx.quadraticCurveTo(-36 - Math.sin(t) * 3 * mv, -26, -34, -8 + Math.sin(t * 1.5) * 3); ctx.stroke();
    /* neck and head */
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(14, -36 - bob); ctx.lineTo(30, -56 - bob + (h.grazing ? 20 : 0)); ctx.lineTo(36, -50 - bob + (h.grazing ? 20 : 0)); ctx.lineTo(24, -26 - bob); ctx.closePath(); ctx.fill();
    const hx = 34, hy = -56 - bob + (h.grazing ? 22 : 0);
    horseHead(ctx, hx, hy, 11, col);
    ctx.strokeStyle = mane; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(16, -38 - bob); ctx.quadraticCurveTo(26, -56 - bob + (h.grazing ? 18 : 0), 30, -62 - bob + (h.grazing ? 20 : 0)); ctx.stroke();
    if (h.blaze) ell(ctx, hx + 4, hy + 1, 2.5, 5, '#f4efe6');
    /* saddle and bridle */
    if (h.saddle) { ctx.fillStyle = h.saddleCol || RED; rr(ctx, -8, -40 - bob, 18, 9, 4); ctx.fill(); rect(ctx, -6, -40 - bob, 14, 2, GOLD); rect(ctx, 0, -34 - bob, 3, 14, '#5a3a1a'); line(ctx, hx + 6, hy + 3, 22, -34 - bob, '#5a3a1a', 1.5); }
    if (h.hearts) { for (let k = 0; k < 3; k++) { const ph = h.hearts * 3 + k * 2; ctx.fillStyle = `rgba(255,90,130,${clamp(1 - h.hearts * .5, 0, 1)})`; ctx.font = `900 ${10 + k * 2}px ${UI_FONT}`; ctx.fillText('♥', 10 + k * 10 - 10, -66 - ph * 6); } }
    ctx.restore();
  }
  function dog(ctx, d) {
    const s = d.s || 1, t = d.ph || 0, mv = d.moving ? 1 : 0, col = d.col || '#c8955a';
    ctx.save(); ctx.scale(s * (d.face || 1), s);
    ctx.strokeStyle = shade(col, .85); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const x = k < 2 ? -8 + k * 4 : 6 + (k - 2) * 4, sw = Math.sin(t * 3 + (k % 2) * Math.PI) * 5 * mv; ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x + sw, -1); ctx.stroke(); }
    ell(ctx, 0, -14, 13, 6.5, col);
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, -16); ctx.quadraticCurveTo(-18, -22 + Math.sin(t * 8) * 4 * (d.wag ? 1 : .2), -20, -18); ctx.stroke();
    circ(ctx, 13, -19, 6, col); ell(ctx, 18, -17, 4.5, 3, col); circ(ctx, 21.5, -17, 1.5, '#1a1a1a'); circ(ctx, 14.5, -20.5, 1.2, '#1a1a1a');
    ctx.fillStyle = shade(col, .7); ell(ctx, 10, -24, 3, 5, shade(col, .7), .3);
    if (d.sit) {} ctx.restore();
  }
  function cat(ctx, c) {
    const s = c.s || 1, t = c.ph || 0, mv = c.moving ? 1 : 0, col = c.col || '#6a6a72';
    ctx.save(); ctx.scale(s * (c.face || 1), s);
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const x = k < 2 ? -6 + k * 3 : 4 + (k - 2) * 3, sw = Math.sin(t * 4 + (k % 2) * Math.PI) * 4 * mv; ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x + sw, -.5); ctx.stroke(); }
    ell(ctx, 0, -10, 9, 4.5, col);
    ctx.beginPath(); ctx.moveTo(-8, -11); ctx.quadraticCurveTo(-15, -14, -14, -22 + Math.sin(t * 3) * 2); ctx.stroke();
    circ(ctx, 9, -14, 4.5, col); poly(ctx, [[6, -17], [6.5, -22], [9, -18]], col); poly(ctx, [[12, -17], [12.5, -22], [10, -18]], col);
    circ(ctx, 10, -14.5, 1, '#3aa84a'); circ(ctx, 8, -14.5, 1, '#3aa84a');
    ctx.restore();
  }
  function mouse(ctx, m) { const s = m.s || 1; ctx.save(); ctx.scale(s * (m.face || 1), s); ell(ctx, 0, -3, 5, 3, '#8a8a8a'); circ(ctx, 5, -4, 2.2, '#8a8a8a'); circ(ctx, 4, -6.5, 1.6, '#c8a8a8'); circ(ctx, 6.5, -4, .6, '#1a1a1a'); line(ctx, -5, -3, -11, -1, '#c8a8a8', 1); ctx.restore(); }
  function pigeon(ctx, b) {
    const s = b.s || 1, t = b.ph || 0; ctx.save(); ctx.scale(s * (b.face || 1), s);
    const fly = b.flying ? Math.sin(t * 14) : 0;
    ell(ctx, 0, -6, 7, 4.5, '#8a8a9a'); circ(ctx, 6, -9, 3, '#6a6a7a'); circ(ctx, 7, -9.5, .7, '#1a1a1a'); poly(ctx, [[8.5, -9], [11, -8.5], [8.5, -8]], '#e0a050');
    ell(ctx, -1, -8 - fly * 4, 6, 2.5, '#9a9aaa', b.flying ? -.4 * fly : -.2); ell(ctx, -7, -5, 3, 1.5, '#5a5a6a', .3);
    if (!b.flying) { line(ctx, -1, -2, -1, 0, '#e0a050', 1); line(ctx, 2, -2, 2, 0, '#e0a050', 1); }
    ell(ctx, 3, -7, 3, 2, '#4aa070'); ctx.restore();
  }
  function swan(ctx, w) {
    const s = w.s || 1, t = w.ph || 0; ctx.save(); ctx.scale(s * (w.face || 1), s);
    ell(ctx, 0, -4, 12, 5.5, '#f8f8f4'); ctx.fillStyle = '#f8f8f4'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-4, -14, 4, -8); ctx.lineTo(2, -5); ctx.fill();
    ctx.strokeStyle = '#f8f8f4'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, -7); ctx.quadraticCurveTo(14, -12 + Math.sin(t) * 1, 12, -20); ctx.quadraticCurveTo(11, -24, 14, -24); ctx.stroke();
    circ(ctx, 14, -24, 2.6, '#f8f8f4'); poly(ctx, [[16, -24.5], [20.5, -23.5], [16, -22.5]], '#e8a030'); circ(ctx, 15, -25, .6, '#1a1a1a'); poly(ctx, [[16.2, -25.5], [15, -24], [16.5, -23]], '#1a1a1a');
    ctx.restore();
  }
  function fish(ctx, f) { const s = f.s || 1; ctx.save(); ctx.scale(s * (f.face || 1), s); ell(ctx, 0, 0, 6, 2.6, f.col || '#e8a030'); poly(ctx, [[-5, 0], [-9, -3], [-9, 3]], f.col || '#e8a030'); circ(ctx, 3.5, -.6, .6, '#1a1a1a'); ctx.restore(); }
  function owl(ctx, o) { const s = o.s || 1, t = o.ph || 0; ctx.save(); ctx.scale(s, s); ell(ctx, 0, -9, 7, 9, '#6a5a4a'); ell(ctx, 0, -7, 4.5, 6, '#a89078'); circ(ctx, -3, -14, 3.2, '#f0e8d0'); circ(ctx, 3, -14, 3.2, '#f0e8d0'); circ(ctx, -3, -14, 1.6, '#1a1a1a'); circ(ctx, 3, -14, 1.6, '#1a1a1a'); if (Math.sin(t * .7) > .95) { rect(ctx, -6, -15, 12, 2.5, '#6a5a4a'); } poly(ctx, [[-1.5, -11], [1.5, -11], [0, -8.5]], '#e0a050'); poly(ctx, [[-6, -17], [-4, -21], [-2, -17]], '#6a5a4a'); poly(ctx, [[6, -17], [4, -21], [2, -17]], '#6a5a4a'); ctx.restore(); }
  function hawk(ctx, h) { const s = h.s || 1, t = h.ph || 0; ctx.save(); ctx.scale(s * (h.face || 1), s); if (h.perched) { ell(ctx, 0, -8, 4.5, 7, '#7a5a3a'); circ(ctx, 1, -15, 3.2, '#8a6a4a'); circ(ctx, 2.5, -15.5, .7, '#f0c020'); poly(ctx, [[4, -15], [6.5, -14], [4, -13.5]], '#e0a050'); } else { const f = Math.sin(t * 9); ell(ctx, 0, 0, 7, 3.5, '#7a5a3a'); ell(ctx, -10, -f * 5, 10, 2.5, '#8a6a4a', -f * .5); ell(ctx, 10, -f * 5, 10, 2.5, '#8a6a4a', f * .5); circ(ctx, 7, -1, 2.8, '#8a6a4a'); poly(ctx, [[9.5, -1], [12.5, 0], [9.5, .8]], '#e0a050'); } ctx.restore(); }
  /* the friendly dragon: about 150 wide, perched facing +x */
  function dragon(ctx, d) {
    const s = d.s || 1, t = d.ph || 0, col = d.col || '#3a9a5a', col2 = d.col2 || '#8ad0a0', wing = d.flying ? Math.sin(t * 5) : Math.sin(t * 1.2) * .15;
    ctx.save(); ctx.scale(s * (d.face || 1), s);
    /* far wing */
    ctx.fillStyle = shade(col, .7); ctx.beginPath(); ctx.moveTo(-10, -40); ctx.quadraticCurveTo(-40, -80 - wing * 30, -70, -60 - wing * 40); ctx.lineTo(-56, -38 - wing * 10); ctx.lineTo(-40, -44 - wing * 20); ctx.lineTo(-22, -34); ctx.fill();
    /* tail */
    ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-30, -24); ctx.quadraticCurveTo(-60, -20 + Math.sin(t) * 4, -78, -36 + Math.sin(t * .8) * 6); ctx.stroke();
    poly(ctx, [[-78, -36 + Math.sin(t * .8) * 6], [-90, -48 + Math.sin(t * .8) * 6], [-70, -46 + Math.sin(t * .8) * 6]], col2);
    /* legs */
    ctx.strokeStyle = col; ctx.lineWidth = 8; for (const x of [-18, 10]) { ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x + 2, -8); ctx.lineTo(x + 6, -2); ctx.stroke(); for (let k = 0; k < 3; k++) circ(ctx, x + 2 + k * 5, -1, 2, '#f0e8d0'); }
    /* body */
    ell(ctx, -4, -34, 36, 22, col);
    ell(ctx, -2, -28, 26, 12, col2);
    for (let k = 0; k < 5; k++) rect(ctx, -2 + k * 8 - 20, -26 + k * .5, 8, 1.5, shade(col2, .85));
    /* neck and head */
    ctx.strokeStyle = col; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(22, -40); ctx.quadraticCurveTo(44, -60, 50, -82 + Math.sin(t * .9) * 3); ctx.stroke();
    ell(ctx, 58, -88 + Math.sin(t * .9) * 3, 18, 12, col);
    ell(ctx, 70, -84 + Math.sin(t * .9) * 3, 12, 8, col2);
    circ(ctx, 62, -92 + Math.sin(t * .9) * 3, 4.5, '#fff'); circ(ctx, 63.5, -92 + Math.sin(t * .9) * 3, 2.4, '#1a1a1a'); circ(ctx, 64.5, -93 + Math.sin(t * .9) * 3, .8, '#fff');
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(72, -81 + Math.sin(t * .9) * 3, 5, .1, Math.PI * .8); ctx.stroke();
    circ(ctx, 78, -86 + Math.sin(t * .9) * 3, 1.3, '#1a1a1a');
    for (let k = 0; k < 3; k++) poly(ctx, [[40 + k * 8, -92 + Math.sin(t * .9) * 3 + k * 1], [46 + k * 8, -104 + Math.sin(t * .9) * 3 - k * 2], [52 + k * 8, -90 + Math.sin(t * .9) * 3]], col2);
    poly(ctx, [[48, -100 + Math.sin(t * .9) * 3], [54, -106 + Math.sin(t * .9) * 3], [58, -98 + Math.sin(t * .9) * 3]], '#f0e8d0');
    /* near wing */
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -44); ctx.quadraticCurveTo(-30, -96 - wing * 30, -60, -76 - wing * 44); ctx.lineTo(-52, -46 - wing * 12); ctx.lineTo(-36, -56 - wing * 24); ctx.lineTo(-14, -40); ctx.fill();
    ctx.strokeStyle = shade(col, .75); ctx.lineWidth = 2; for (const [x, y] of [[-60, -76 - wing * 44], [-52, -46 - wing * 12], [-36, -56 - wing * 24]]) line(ctx, -4, -44, x, y, shade(col, .75), 2);
    /* a puff of sparkles or smoke from the nose */
    if (d.puff > 0) { for (let k = 0; k < 8; k++) { const ph = t * 2 + k * .8, px = 84 + d.puff * 30 + Math.cos(ph) * 6 * k * .3, py = -86 - d.puff * 10 + Math.sin(ph) * 8; circ(ctx, px, py, 2 + k * .4, k % 2 ? 'rgba(255,220,120,.8)' : 'rgba(255,140,200,.8)'); } }
    ctx.restore();
  }
  /* a royal carriage, facing +x, wheels at the origin, about 90 wide */
  function carriage(ctx, c) {
    const s = c.s || 1, t = c.ph || 0, mv = c.moving ? 1 : 0; ctx.save(); ctx.scale(s * (c.face || 1), s);
    ctx.save(); ctx.translate(56, 0); horse(ctx, { ph: t, moving: mv, col: '#f0f0f0', mane: '#d8d8d8', saddle: false }); ctx.restore();
    line(ctx, 18, -30, 44, -32, WOOD_D, 3);
    ctx.fillStyle = '#7a1e5a'; rr(ctx, -34, -56, 52, 34, 8); ctx.fill(); rect(ctx, -34, -58, 52, 4, GOLD);
    rect(ctx, -26, -50, 14, 14, '#c8e0f0'); rect(ctx, 0, -50, 14, 14, '#c8e0f0'); crown(ctx, -8, -46, 4); rect(ctx, -36, -62, 56, 4, '#5a1e4a');
    for (const x of [-22, 6]) { circ(ctx, x, -10, 10, '#5a3a1a'); circ(ctx, x, -10, 3, GOLD); ctx.strokeStyle = '#c0a070'; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { const a = t * 3 * mv + k * Math.PI / 4; line(ctx, x - Math.cos(a) * 9, -10 - Math.sin(a) * 9, x + Math.cos(a) * 9, -10 + Math.sin(a) * 9, '#c0a070', 1.5); } }
    rect(ctx, -34, -22, 52, 3, '#5a1e4a');
    ctx.save(); ctx.translate(26, -24); person(ctx, { role: 'groom', s: .7, act: 'sit', face: 1 }); ctx.restore();
    ctx.restore();
  }
  function butterfly(ctx, b) { const t = b.ph || 0, f = Math.abs(Math.sin(t * 10)); ell(ctx, -3 * f - 1, 0, 4, 2.5, b.col || '#f0a030', .4); ell(ctx, 3 * f + 1, 0, 4, 2.5, b.col || '#f0a030', -.4); line(ctx, 0, -2, 0, 2, '#1a1a1a', 1); }

  /* ---------- icons (100 × 100 box, centred) ---------- */
  function drawIcon(ctx, key) {
    const inRoom = (fn) => { ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = WOOD; ctx.fillRect(-46, 30, 92, 16); fn(); };
    const itemIcon = (k) => { const it = ITEMS[k]; const W = it.w * C, H = it.h * C, sc = Math.min(80 / W, 80 / H); ctx.save(); ctx.translate(-W * sc / 2, Math.min(40, H * sc / 2)); ctx.scale(sc, sc); item(ctx, k, { t: 1, lit: true, feast: true }); ctx.restore(); };
    const tileIcon = (t) => { ctx.save(); ctx.translate(-40, -40); ctx.scale(80 / C, 80 / C); const g = { get: () => T.AIR, solid: () => false, variant: () => .3 }; tile(ctx, g, 0, 0, t, { time: 1, snow: 0, bridge: 1, lit: false }); ctx.restore(); };
    switch (key) {
      case 'stone': case 'tower': case 'roof': case 'wood': case 'floor': case 'door': case 'gate': case 'slit': case 'arch': case 'stained': case 'stair': case 'bridge': case 'drawbridge': tileIcon(TILE_BY_KEY[key]); if (key === 'drawbridge' || key === 'bridge') { } break;
      case 'moat': case 'water': { ctx.fillStyle = '#5aa03a'; ctx.fillRect(-46, -46, 92, 30); tileIcon(T.WATER); ctx.fillStyle = '#5aa03a'; ctx.fillRect(-46, -46, 92, 20); ctx.save(); ctx.translate(-10, -6); swan(ctx, { s: 1.3 }); ctx.restore(); break; }
      case 'cone': { ctx.fillStyle = '#4a5a80'; poly(ctx, [[-40, 40], [0, -44], [40, 40]], ctx.fillStyle); for (let k = 1; k < 4; k++) line(ctx, -40 * k / 4, 40 - 84 * (1 - k / 4) + 0, 40 * k / 4, 40 - 84 * (1 - k / 4), 'rgba(0,0,0,.25)', 2); circ(ctx, 0, -44, 5, GOLD); break; }
      case 'battlement': { stoneFace(ctx, -46, 10, 92, 36, .3, false); for (let k = 0; k < 3; k++) stoneFace(ctx, -46 + k * 36, -20, 20, 30, .5, false); break; }
      case 'eraser': { ctx.fillStyle = '#f08aa0'; rr(ctx, -36, -14, 72, 36, 8); ctx.fill(); ctx.fillStyle = '#5a8ad0'; rr(ctx, -36, -14, 30, 36, 8); ctx.fill(); break; }
      case 'hand': { ctx.fillStyle = '#f2c9a8'; rr(ctx, -22, -10, 44, 44, 12); ctx.fill(); for (let k = 0; k < 4; k++) { rr(ctx, -20 + k * 11, -40 + (k === 0 || k === 3 ? 10 : 0), 9, 40, 4); ctx.fill(); } rr(ctx, 18, -8, 12, 28, 5); ctx.fill(); break; }
      case 'nametag': { ctx.fillStyle = '#fff6d0'; rr(ctx, -40, -24, 80, 48, 10); ctx.fill(); ctx.strokeStyle = GOLD_D; ctx.lineWidth = 3; rr(ctx, -40, -24, 80, 48, 10); ctx.stroke(); ctx.fillStyle = '#2a2016'; ctx.font = `900 26px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Aa', 0, 2); break; }
      case 'room': { inRoom(() => { ctx.strokeStyle = MORTAR; ctx.lineWidth = 6; ctx.strokeRect(-43, -43, 86, 86); }); break; }
      case 'quest': { ctx.fillStyle = '#f4e8c8'; rr(ctx, -30, -40, 60, 80, 6); ctx.fill(); ctx.fillStyle = '#c8b088'; for (let k = 0; k < 4; k++) ctx.fillRect(-20, -24 + k * 14, 40 - (k === 3 ? 16 : 0), 4); circ(ctx, 0, -42, 8, RED); circ(ctx, 0, 42, 8, RED); break; }
      case 'coin': case 'coins': { circ(ctx, 0, 0, 40, GOLD_D); circ(ctx, 0, 0, 33, GOLD); crown(ctx, 0, 10, 16); break; }
      case 'horse': { ctx.save(); ctx.translate(-10, 36); horse(ctx, { s: 1.15, col: '#8a5a3a' }); ctx.restore(); break; }
      case 'knight': { ctx.save(); ctx.translate(0, 44); person(ctx, { role: 'knight', s: 1.6 }); ctx.restore(); break; }
      case 'princess': case 'prince': case 'royal': { ctx.save(); ctx.translate(0, 44); person(ctx, { role: 'royal', sex: key === 'prince' ? 'prince' : 'princess', look: royalLook(key === 'prince' ? 'prince' : 'princess', key === 'prince' ? 'oak' : 'rose'), s: 1.6 }); ctx.restore(); break; }
      case 'dragon': { ctx.save(); ctx.translate(14, 44); dragon(ctx, { s: .5, ph: 1 }); ctx.restore(); break; }
      case 'cook': case 'jester': case 'sage': case 'maid': case 'smith': case 'falconer': case 'groom': { ctx.save(); ctx.translate(0, 44); person(ctx, { role: key, s: 1.6 }); ctx.restore(); break; }
      case 'dog': { ctx.save(); ctx.translate(-4, 30); dog(ctx, { s: 2.2 }); ctx.restore(); break; }
      case 'cat': { ctx.save(); ctx.translate(-4, 30); cat(ctx, { s: 2.6 }); ctx.restore(); break; }
      case 'swan': { ctx.fillStyle = '#4a90d0'; ctx.fillRect(-46, 20, 92, 26); ctx.save(); ctx.translate(-6, 24); swan(ctx, { s: 2.4 }); ctx.restore(); break; }
      case 'pigeon': { ctx.save(); ctx.translate(-6, 24); pigeon(ctx, { s: 3 }); ctx.restore(); break; }
      case 'owl': { ctx.save(); ctx.translate(0, 40); owl(ctx, { s: 2.8 }); ctx.restore(); break; }
      case 'carriage': { ctx.save(); ctx.translate(-30, 36); carriage(ctx, { s: .6 }); ctx.restore(); break; }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': { ctx.fillStyle = '#f5e8a0'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); break; }
      case 'night': { ctx.fillStyle = '#1a2040'; ctx.fillRect(-46, -46, 92, 92); circ(ctx, 14, -14, 14, '#f5e8a0'); for (const [x, y] of [[-30, -30], [-10, -36], [-32, 0], [30, 20]]) circ(ctx, x, y, 2, '#fff'); stoneFace(ctx, -46, 10, 92, 36, .4, false); break; }
      case 'snow': { ctx.fillStyle = '#a8c0e0'; ctx.fillRect(-46, -46, 92, 92); stoneFace(ctx, -46, 0, 92, 46, .4, false); ctx.fillStyle = '#fff'; ctx.fillRect(-46, -6, 92, 8); for (const [x, y] of [[-30, -30], [-10, -36], [10, -20], [30, -34], [0, -10]]) circ(ctx, x, y, 3, '#fff'); break; }
      case 'rain': { ctx.fillStyle = '#6a7a90'; ctx.fillRect(-46, -46, 92, 92); for (let k = 0; k < 8; k++) line(ctx, -40 + k * 11, -30 + (k % 3) * 10, -44 + k * 11, -10 + (k % 3) * 10, '#c8e0ff', 2.5); break; }
      case 'feast': { itemIcon('longtable'); break; }
      case 'joust': { ctx.save(); ctx.translate(-20, 40); horse(ctx, { s: .8, saddle: true, moving: true, ph: 1, gallop: true }); ctx.translate(-8, -36); person(ctx, { role: 'knight', s: .9, act: 'ride' }); ctx.restore(); break; }
      case 'fireworks': { ctx.fillStyle = '#1a2040'; ctx.fillRect(-46, -46, 92, 92); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; line(ctx, 0, 0, Math.cos(a) * 36, Math.sin(a) * 36, k % 2 ? '#ffd040' : '#ff6090', 3); circ(ctx, Math.cos(a) * 36, Math.sin(a) * 36, 3, '#fff'); } break; }
      case 'camera': ctx.fillStyle = '#4a4a6a'; rr(ctx, -30, -18, 60, 40, 8); ctx.fill(); ctx.fillRect(-14, -26, 22, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 2, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#3fb0e6'; ctx.beginPath(); ctx.arc(2, 2, 8, 0, TAU); ctx.fill(); break;
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'book': ctx.fillStyle = '#e0392f'; rr(ctx, -28, -24, 56, 48, 5); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -22, -18, 44, 36, 3); ctx.fill(); break;
      case 'crown': crown(ctx, 0, 16, 34); break;
      case 'market': itemIcon('marketstall'); break;
      case 'village': { ctx.fillStyle = '#5aa03a'; ctx.fillRect(-46, 20, 92, 26); for (let k = 0; k < 3; k++) { const x = -32 + k * 30; rect(ctx, x - 10, -4, 20, 24, '#e8d8b0'); poly(ctx, [[x - 13, -4], [x, -22], [x + 13, -4]], '#8a3a30'); rect(ctx, x - 3, 8, 6, 12, '#5a3a1a'); } break; }
      default: if (ITEMS[key]) itemIcon(key); else if (TILE_BY_KEY[key] !== undefined) tileIcon(TILE_BY_KEY[key]); else { ctx.fillStyle = '#8a857c'; ctx.fillRect(-30, -30, 60, 60); }
    }
  }
  function icon(key, px) {
    const k = `${key}|${px}`;
    let c = iconCache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = px * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); ctx.scale(px / 100, px / 100);
      drawIcon(ctx, key);
      iconCache.set(k, c);
    }
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }

  return { tile, gateGrid, item, person, horse, dog, cat, mouse, pigeon, swan, fish, owl, hawk, dragon, carriage, butterfly, flame, crown, drawIcon, icon, ROLE_LOOK, stoneFace, ITEM_DRAW };
})();
