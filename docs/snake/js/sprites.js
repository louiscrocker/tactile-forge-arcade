/* ============================================================
   sprites.js — everything drawn with code: snakes, shed skins,
   the bags newborns come in, critters, visitors, covers, trees,
   and the icons for the HUD, the stickers and the pictures in
   Read to Play
   ============================================================
   A snake is drawn from a list of points, head first, that its
   body follows (see Trail in land.js).  We look at the meadow from
   the side and a little from above, so a snake's S-bends (z) show
   as gentle waves, its back shows a stripe on top, a stripe runs
   along its side, and its pale belly peeks out underneath.  Coils
   are drawn back halves first, then front halves.  Snakes have no
   eyelids, so their eyes are never drawn closed.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();

  /* ---------- colours ---------- */
  function snakeCols(form, o = {}) {
    const F = FORMS[form] || FORMS.eastern, dull = clamp(o.dull || 0, 0, 1) * .55;
    const d = (c) => dull ? mixHex(c, '#a8aaa0', dull) : c;
    return { back: d(F.back), back2: d(F.back2), stripe: d(F.stripe), side: d(F.side), check: d(F.check), belly: d(F.belly), lip: d(F.lip), eye: F.eye, iris: F.iris, fresh: clamp(o.fresh || 0, 0, 1) };
  }

  /* ---------- a snake ----------
     P: points head first {x, y, z, c, g} · o: { thick, form, tongue 0..1, blue 0..1,
     dull 0..1, fresh 0..1, peel 0..1 (the old skin still on from peel to the tail),
     headUp 0..1, baby 0..1, alpha, look (−1..1), swim, shadow } */
  function bodyWidth(u) { return u < .2 ? lerp(.74, 1, smoothstep(.04, .2, u)) : u < .6 ? 1 : lerp(1, .12, Math.pow((u - .6) / .4, 1.1)); }
  function drawSnake(ctx, P, o) {
    const n = P.length; if (n < 3) return;
    const th = o.thick, cols = snakeCols(o.form, o), baby = o.baby || 0;
    ctx.save();
    if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha *= o.alpha;
    /* place the points: crawling points get the oblique S-bend; coil points are placed already */
    const Q = new Array(n);
    for (let i = 0; i < n; i++) {
      const q = P[i], u = i / (n - 1), c = q.c || 0;
      let y = q.y + (1 - c) * (q.z || 0) * .45;
      if (o.headUp && u < .22) y -= o.headUp * th * 1.6 * Math.pow(1 - u / .22, 2);
      Q[i] = { x: q.x, y, z: c ? (q.z || 0) : (q.z || 0) / 6, g: q.g || ((q.z || 0) < 0 ? 0 : 100), u, w: th * bodyWidth(u) * (1 + (c ? (q.z || 0) * .05 : 0)) };
    }
    /* a soft shadow on the ground under a crawling snake */
    if (o.shadow !== false && !P[0].c) {
      ctx.strokeStyle = 'rgba(20,16,8,.18)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = th * .9;
      ctx.beginPath(); for (let i = 0; i < n; i += 2) { const q = Q[i]; i ? ctx.lineTo(q.x, q.y + th * .55) : ctx.moveTo(q.x, q.y + th * .55); } ctx.stroke();
    }
    /* normals that point down the screen (towards the belly side) */
    for (let i = 0; i < n; i++) {
      const a = Q[Math.max(0, i - 1)], b = Q[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }
      Q[i].nx = nx; Q[i].ny = ny;
    }
    /* groups: back halves first, then front halves (coils), each drawn layer by layer */
    const groups = new Map();
    for (let i = 1; i < n; i++) { const k = Math.min(Q[i].g, Q[i - 1].g); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    const keys = [...groups.keys()].sort((a, b) => a - b);
    const layer = (segs, col, wk, off, alpha = 1, every = 0) => {
      ctx.strokeStyle = col; ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * alpha;
      const buckets = new Map();
      for (const i of segs) {
        if (every && i % every) continue;
        const a = Q[i - 1], b = Q[i], w = Math.max(.4, (a.w + b.w) * .5 * wk), key = Math.round(w * 3);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push([a.x + a.nx * a.w * off, a.y + a.ny * a.w * off, b.x + b.nx * b.w * off, b.y + b.ny * b.w * off]);
      }
      for (const [key, list] of buckets) { ctx.lineWidth = key / 3; ctx.beginPath(); for (const s of list) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke(); }
    };
    const dots = (segs, col, rk, off, every, phase) => {
      ctx.fillStyle = col; ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
      ctx.beginPath();
      for (const i of segs) { if ((i + phase) % every) continue; const q = Q[i]; if (q.u < .12 || q.u > .93) continue; const r = q.w * rk; ctx.moveTo(q.x + q.nx * q.w * off + r, q.y + q.ny * q.w * off); ctx.arc(q.x + q.nx * q.w * off, q.y + q.ny * q.w * off, r, 0, TAU); }
      ctx.fill();
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const F = FORMS[o.form] || FORMS.eastern, red = F.side !== F.check;
    const sc = Math.max(.6, th / 10);
    for (const k of keys) {
      const segs = groups.get(k);
      layer(segs, cols.back2, 1, 0, 1); ctx.lineWidth += 0;
      layer(segs, cols.back2, 1.14, 0, .9);
      layer(segs, cols.back, .98, 0);
      layer(segs, cols.belly, .3, .34);
      layer(segs, cols.stripe, .17, .13);
      if (red) dots(segs, cols.side, .15, -.04, 3, 1);
      dots(segs, cols.check, .11, -.1, 3, 0);
      dots(segs, cols.check, .1, .28, 3, 2);
      layer(segs, cols.stripe, .16, -.25);
      layer(segs, '#ffffff', .07, -.36, .16 + cols.fresh * .3);
      /* still in its old skin: a pale see-through sleeve from the peel point to the tail */
      if (o.peel !== undefined && o.peel < 1) {
        const old = segs.filter(i => Q[i].u > o.peel);
        layer(old, 'rgba(236,236,226,1)', 1.12, 0, .55);
        layer(old, 'rgba(255,255,250,1)', .4, -.2, .35);
      }
    }
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.peel !== undefined && o.peel > 0 && o.peel < 1) {
      /* the rolled-back edge of the old skin, inside out */
      const i = clamp(Math.round(o.peel * (n - 1)), 1, n - 1), q = Q[i];
      ctx.fillStyle = 'rgba(240,238,228,.9)'; ctx.strokeStyle = 'rgba(160,160,150,.7)'; ctx.lineWidth = .6 * sc;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, q.w * .55, q.w * .75, Math.atan2(q.ny, q.nx), 0, TAU); ctx.fill(); ctx.stroke();
    }
    drawHead(ctx, Q, o, cols, th, baby);
    ctx.restore();
  }
  function drawHead(ctx, Q, o, cols, th, baby) {
    const a = Q[0], b = Q[Math.min(3, Q.length - 1)];
    let dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const face = dx >= 0 ? 1 : -1;
    /* keep the head fairly level: a snake looks where it is going */
    let ang = Math.atan2(dy, dx * face) * .6;
    ang = clamp(ang, -.7, .5);
    const hs = th * (1 + baby * .3);
    ctx.save();
    ctx.translate(a.x, a.y); ctx.scale(face, 1); ctx.rotate(ang);
    const L = hs * 1.55, Hh = hs * .62;
    /* the head: rounded, a little wider than the neck */
    const shape = () => { ctx.beginPath(); ctx.moveTo(-hs * .3, -Hh * .78); ctx.quadraticCurveTo(L * .45, -Hh * 1.05, L * .9, -Hh * .3); ctx.quadraticCurveTo(L * 1.05, 0, L * .88, Hh * .32); ctx.quadraticCurveTo(L * .45, Hh * .95, -hs * .3, Hh * .8); ctx.closePath(); };
    ctx.lineJoin = 'round';
    shape(); ctx.fillStyle = cols.back; ctx.fill(); ctx.strokeStyle = cols.back2; ctx.lineWidth = Math.max(.6, hs * .1); ctx.stroke();
    /* pale lips with little dark bars, and a smile */
    ctx.save(); shape(); ctx.clip();
    ctx.fillStyle = cols.lip; ctx.beginPath(); ctx.moveTo(-hs * .4, Hh * .14); ctx.quadraticCurveTo(L * .5, Hh * .32, L * 1.1, Hh * .02); ctx.lineTo(L * 1.1, Hh * 1.2); ctx.lineTo(-hs * .4, Hh * 1.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withAlpha(cols.back2.startsWith('#') ? cols.back2 : '#20241a', .55); ctx.lineWidth = Math.max(.4, hs * .06);
    for (const x of [.12, .34, .56]) { ctx.beginPath(); ctx.moveTo(L * x, Hh * .26); ctx.lineTo(L * x - hs * .04, Hh * .9); ctx.stroke(); }
    /* a little dorsal mark at the back of the head (garter snakes have two pale dots there) */
    ctx.fillStyle = cols.stripe; ctx.globalAlpha *= .8; for (const x of [-.05, .08]) { ctx.beginPath(); ctx.arc(L * x, -Hh * .55, hs * .07, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,20,10,.55)'; ctx.lineWidth = Math.max(.4, hs * .05); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L * .86, Hh * .2); ctx.quadraticCurveTo(L * .55, Hh * .3, L * .3, Hh * .14); ctx.stroke();
    /* nostril */
    ctx.fillStyle = 'rgba(10,8,4,.7)'; ctx.beginPath(); ctx.arc(L * .86, -Hh * .18, hs * .045, 0, TAU); ctx.fill();
    /* the eye: big and round, a round pupil (garter snakes are out by day), no eyelids */
    const ex = L * .58, ey = -Hh * .26, er = hs * (.25 + baby * .07);
    ctx.fillStyle = cols.iris; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = cols.eye; ctx.beginPath(); ctx.arc(ex + er * .12 * (o.look || 0), ey, er * .55, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + er * .22, ey - er * .3, er * .26, 0, TAU); ctx.fill();
    ctx.globalAlpha *= .6; ctx.beginPath(); ctx.arc(ex - er * .25, ey + er * .28, er * .12, 0, TAU); ctx.fill(); ctx.globalAlpha /= .6;
    if (o.blue > 0) { ctx.fillStyle = `rgba(178,206,232,${.9 * o.blue})`; ctx.beginPath(); ctx.arc(ex, ey, er * 1.05, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(255,255,255,${.5 * o.blue})`; ctx.beginPath(); ctx.arc(ex + er * .25, ey - er * .3, er * .3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(20,14,6,.5)'; ctx.lineWidth = Math.max(.3, hs * .04); ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
    /* the forked tongue: flick out, flick in */
    if (o.tongue > 0) {
      const k = Math.sin(clamp(o.tongue, 0, 1) * Math.PI), tl = hs * 1.3 * k, tx = L * .98, ty = Hh * .1;
      ctx.strokeStyle = '#d8323a'; ctx.lineWidth = Math.max(.5, hs * .09); ctx.lineCap = 'round';
      const wig = Math.sin(o.tongue * 30) * .12;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + tl, ty + tl * (.15 + wig)); ctx.stroke();
      const fx = tx + tl, fy = ty + tl * (.15 + wig), fl = hs * .38 * k;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + fl, fy - fl * .45); ctx.moveTo(fx, fy); ctx.lineTo(fx + fl, fy + fl * .55); ctx.stroke();
      ctx.strokeStyle = '#1a0a0a'; ctx.lineWidth *= .9;
      ctx.beginPath(); ctx.moveTo(fx + fl * .6, fy - fl * .27); ctx.lineTo(fx + fl, fy - fl * .45); ctx.moveTo(fx + fl * .6, fy + fl * .33); ctx.lineTo(fx + fl, fy + fl * .55); ctx.stroke();
    }
    ctx.restore();
  }

  /* simple poses for icons and pictures (local coordinates, the head at the right) */
  function posePts(kind, len, th) {
    if (kind === 'coil') return Trail.coil(len, th, 0, 0, 1, len < 50 ? 1.3 : 1.7);
    const pts = [];
    for (let s = 0; s <= len; s += len / 40) {
      const x = -s + len * .45;
      const z = kind === 'straight' ? 0 : Math.sin(s / (len * .34) * TAU) * len * .07 * smoothstep(0, len * .12, s);
      pts.push({ x, y: 0, z: z * 1.6, c: 0 });
    }
    return pts;
  }
  function snakeIcon(ctx, form, o = {}) {
    const len = o.len || 120, th = o.thick || len * .1;
    const P = posePts(o.pose || 'crawl', len, th);
    ctx.save(); if (o.pose === 'coil') ctx.translate(-4, 22); else ctx.translate(-2, 6);
    drawSnake(ctx, P, Object.assign({ thick: th, form, tongue: o.tongue || 0, shadow: false, headUp: o.headUp || 0 }, o));
    ctx.restore();
  }

  /* ---------- the thin clear bag a newborn comes in ---------- */
  function drawSac(ctx, x, y, s, t, crack, form) {
    ctx.save(); ctx.translate(x, y);
    const wob = crack > 0 ? Math.sin(t * 18) * crack * .08 : Math.sin(t * 2) * .02;
    ctx.scale(1 + wob, 1 - wob);
    const rx = 13 * s, ry = 9 * s;
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -ry, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(210,225,215,.35)'; ctx.fillRect(-rx, -ry * 2, rx * 2, ry * 2);
    const P = Trail.coil(snakeUnits(18) * s * .42, 2.6 * s, 0, 0, 1, 1.6);
    drawSnake(ctx, P, { thick: 2.6 * s, form, baby: 1, shadow: false });
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = .8 * s; ctx.beginPath(); ctx.ellipse(0, -ry, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-rx * .4, -ry * 1.45, rx * .3, ry * .18, -.4, 0, TAU); ctx.fill();
    if (crack > .3) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .7 * s; ctx.beginPath(); ctx.moveTo(rx * .2, -ry * 1.9); ctx.lineTo(rx * .45, -ry * 1.4); ctx.lineTo(rx * .3, -ry * 1.1); ctx.lineTo(rx * .6, -ry * .7); ctx.stroke(); }
    ctx.restore();
  }

  /* ---------- a shed skin, inside out, left lying on the ground ---------- */
  function drawExuvia(ctx, e, t) {
    const n = 30, len = e.len, th = e.thick || len * .085;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.face || 1, 1);
    const pts = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), x = len * .5 - u * len; pts.push({ x, y: -th * .3 + Math.sin(u * 9 + (e.seed || 0)) * th * .25 * (1 - u * .3) }); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const stroke = (col, wk, off = 0) => { ctx.strokeStyle = col; ctx.lineWidth = th * wk; ctx.beginPath(); pts.forEach((q, i) => { const u = i / (n - 1), w = bodyWidth(u); i ? ctx.lineTo(q.x, q.y + off * w) : ctx.moveTo(q.x, q.y + off * w); }); ctx.stroke(); };
    stroke('rgba(150,150,140,.35)', 1.15);
    stroke('rgba(238,236,224,.72)', 1.02);
    stroke('rgba(255,255,250,.6)', .34, -th * .22);
    /* the print of every scale: a fine diamond pattern */
    ctx.strokeStyle = 'rgba(150,150,138,.22)'; ctx.lineWidth = Math.max(.25, th * .035);
    for (let i = 2; i < n - 2; i++) { const q = pts[i], w = bodyWidth(i / (n - 1)) * th * .32; ctx.beginPath(); ctx.moveTo(q.x - w, q.y - w); ctx.lineTo(q.x + w, q.y + w); ctx.moveTo(q.x - w, q.y + w); ctx.lineTo(q.x + w, q.y - w); ctx.stroke(); }
    /* crinkles where it turned inside out */
    ctx.strokeStyle = 'rgba(170,168,156,.35)';
    for (const u of [.42, .74]) { const q = pts[Math.round(u * (n - 1))]; ctx.beginPath(); ctx.moveTo(q.x - th * .1, q.y - th * .45); ctx.quadraticCurveTo(q.x + th * .15, q.y, q.x - th * .1, q.y + th * .45); ctx.stroke(); }
    /* the head end: open, with a clear eye cap */
    const h = pts[0];
    ctx.fillStyle = 'rgba(245,244,236,.85)'; ctx.strokeStyle = 'rgba(150,150,140,.6)'; ctx.lineWidth = Math.max(.3, th * .06);
    ctx.beginPath(); ctx.ellipse(h.x + th * .3, h.y, th * .75, th * .5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(220,240,255,.85)'; ctx.beginPath(); ctx.arc(h.x + th * .5, h.y - th * .12, th * .2, 0, TAU); ctx.fill(); ctx.stroke();
    if (!e.looked && t !== undefined) { ctx.fillStyle = `rgba(255,250,200,${.5 + .4 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(h.x + th * .5, h.y - th * .12, th * .08, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- covers ---------- */
  function drawCover(ctx, c, W, season, snow) {
    const R = mulberry32(c.id * 97 + 3), top = (x) => W.coverTop(c, x);
    const x0 = c.x - c.w / 2, x1 = c.x + c.w / 2, base = (x) => c.y + c.tilt * (x - c.x);
    ctx.save();
    const outline = () => { ctx.beginPath(); ctx.moveTo(x0, base(x0) + 2); for (let x = x0; x <= x1; x += 3) { const t = top(x); ctx.lineTo(x, t === null ? base(x) : t); } ctx.lineTo(x1, base(x1) + 2); ctx.closePath(); };
    if (c.kind === 'board' || c.kind === 'coverboard') {
      outline(); ctx.fillStyle = c.kind === 'coverboard' ? '#b08a5a' : '#7a6448'; ctx.fill();
      ctx.strokeStyle = 'rgba(40,28,14,.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,28,14,.25)'; for (let k = 0; k < 3; k++) { const yy = base(c.x) - c.h * (.3 + k * .22); ctx.beginPath(); ctx.moveTo(x0 + 6, yy); ctx.lineTo(x1 - 6, yy + c.tilt * c.w * .1); ctx.stroke(); }
      if (c.kind === 'coverboard') { ctx.fillStyle = '#f0e8d0'; ctx.font = `900 ${c.h * .9}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CB 7', c.x, base(c.x) - c.h * .5); }
      else { ctx.fillStyle = '#5a7a3a'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x0 + 8 + R() * (c.w - 16), base(c.x) - c.h, 2 + R() * 2, Math.PI, TAU); ctx.fill(); } }
    } else if (c.kind === 'log') {
      outline(); const g = ctx.createLinearGradient(0, base(c.x) - c.h, 0, base(c.x)); g.addColorStop(0, '#8a6a46'); g.addColorStop(1, '#4a3420'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(30,18,8,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,24,10,.35)'; ctx.lineWidth = 1; for (let k = 0; k < 5; k++) { const xx = x0 + 10 + R() * (c.w - 20), t0 = top(xx); if (t0 === null) continue; ctx.beginPath(); ctx.moveTo(xx, t0 + 3); ctx.lineTo(xx + 14, t0 + 8 + R() * 8); ctx.stroke(); }
      /* the cut end, with rings */
      const ey = base(x1) - c.h * .5; ctx.fillStyle = '#c8a070'; ctx.beginPath(); ctx.ellipse(x1 - 2, ey, c.h * .26, c.h * .5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,60,30,.6)'; for (let r = .15; r < .5; r += .12) { ctx.beginPath(); ctx.ellipse(x1 - 2, ey, c.h * r * .52, c.h * r, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#6a9a3a'; for (let k = 0; k < 6; k++) { const xx = x0 + 6 + R() * (c.w - 12), t0 = top(xx); if (t0 !== null) { ctx.beginPath(); ctx.arc(xx, t0 + 1, 2 + R() * 3, 0, TAU); ctx.fill(); } }
      if (season === 'autumn') { ctx.fillStyle = '#e8a030'; for (let k = 0; k < 4; k++) { const xx = x0 + R() * c.w, t0 = top(xx); if (t0 !== null) { ctx.beginPath(); ctx.ellipse(xx, t0, 3, 1.5, R(), 0, TAU); ctx.fill(); } } }
    } else if (c.kind === 'leaves') {
      for (let k = 0; k < 40; k++) { const xx = x0 + R() * c.w, t0 = top(xx); if (t0 === null) continue; const yy = lerp(base(xx), t0, R()); ctx.fillStyle = season === 'summer' || season === 'spring' ? pick2(R, ['#7a5a2a', '#8a6a30', '#5a4a24']) : pick2(R, ['#d88a2a', '#c85a20', '#e8b040', '#8a5a2a']); ctx.beginPath(); ctx.ellipse(xx, yy, 4, 2, R() * TAU, 0, TAU); ctx.fill(); }
    } else {
      /* rocks, slabs and the stone wall */
      const stones = c.kind === 'wall' ? 9 : 1;
      for (let k = 0; k < stones; k++) {
        if (c.kind === 'wall') { const cx = x0 + (k % 5 + .5 + (k >= 5 ? .5 : 0)) * c.w / 5.5, cy = base(cx) - (k >= 5 ? c.h * .62 : c.h * .25), r = c.w / 11 + R() * 4; const g = ctx.createRadialGradient(cx - r * .3, cy - r * .4, 2, cx, cy, r * 1.3); g.addColorStop(0, '#b8b4a8'); g.addColorStop(1, '#5a5850'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.05, r * .7, R() * .3, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(30,30,24,.45)'; ctx.stroke(); }
        else { outline(); const g = ctx.createLinearGradient(0, base(c.x) - c.h, 0, base(c.x)); g.addColorStop(0, c.kind === 'slab' ? '#d8d0bc' : '#a8a498'); g.addColorStop(1, c.kind === 'slab' ? '#8a8270' : '#5a5850'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(30,30,24,.45)'; ctx.lineWidth = 1; ctx.stroke(); }
      }
      if (c.kind === 'slab') { ctx.strokeStyle = 'rgba(80,72,60,.35)'; for (let k = 1; k < 3; k++) { const yy = base(c.x) - c.h * k / 3; ctx.beginPath(); ctx.moveTo(x0 + 8, yy); ctx.lineTo(x1 - 8, yy - 1); ctx.stroke(); } }
      ctx.fillStyle = 'rgba(160,190,90,.55)'; for (let k = 0; k < 4; k++) { const xx = x0 + 8 + R() * (c.w - 16), t0 = top(xx); if (t0 !== null) { ctx.beginPath(); ctx.arc(xx, t0 + 3, 2.4 + R() * 2.5, 0, TAU); ctx.fill(); } }
    }
    if (snow > .05 && c.kind !== 'leaves') { ctx.fillStyle = `rgba(250,252,255,${snow})`; ctx.beginPath(); ctx.moveTo(x0 + 4, base(x0)); for (let x = x0 + 4; x <= x1 - 4; x += 3) { const t0 = top(x); ctx.lineTo(x, (t0 === null ? base(x) : t0) - 3 * snow); } for (let x = x1 - 4; x >= x0 + 4; x -= 3) { const t0 = top(x); ctx.lineTo(x, (t0 === null ? base(x) : t0) + 1); } ctx.fill(); }
    ctx.restore();
  }
  function pick2(R, arr) { return arr[(R() * arr.length) | 0]; }

  /* ---------- trees ---------- */
  const LEAF = { spring: ['#a8d868', '#8ac858', '#c8e890'], summer: ['#5a9a3a', '#4a8a30', '#6aaa48'], autumn: ['#e8a020', '#d86020', '#f0c040'], winter: null };
  function drawTree(ctx, T, gy, season, t, snow) {
    const R = mulberry32(T.seed);
    ctx.save(); ctx.translate(T.x, gy);
    const sway = Math.sin(t * .6 + T.seed) * 2;
    if (T.kind === 'pine') {
      ctx.fillStyle = '#4a3422'; ctx.fillRect(-5, -T.h * .2, 10, T.h * .2);
      for (let k = 0; k < 6; k++) { const y = -T.h * (.15 + k * .14), w = T.w * (1 - k * .14) * .55; ctx.fillStyle = k % 2 ? '#2e5a3a' : '#264e32'; ctx.beginPath(); ctx.moveTo(-w + sway * k * .2, y + 10); ctx.lineTo(sway * k * .3, y - T.h * .2); ctx.lineTo(w + sway * k * .2, y + 10); ctx.closePath(); ctx.fill(); if (snow > .1) { ctx.fillStyle = `rgba(250,252,255,${snow})`; ctx.beginPath(); ctx.moveTo(-w * .6, y + 2); ctx.lineTo(0, y - T.h * .16); ctx.lineTo(w * .6, y + 2); ctx.quadraticCurveTo(0, y - 4, -w * .6, y + 2); ctx.fill(); } }
    } else {
      ctx.strokeStyle = '#4a3624'; ctx.lineCap = 'round';
      ctx.lineWidth = T.w * .12; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -T.h * .3, sway, -T.h * .55); ctx.stroke();
      ctx.lineWidth = T.w * .05;
      const br = []; for (let k = 0; k < 6; k++) { const y = -T.h * (.4 + k * .08), a = (k % 2 ? 1 : -1) * (.5 + R() * .5), l = T.w * (.45 - k * .04); br.push([0, y, Math.sin(a) * l + sway, y - Math.cos(a) * l * .6]); ctx.beginPath(); ctx.moveTo(sway * .5, y); ctx.lineTo(Math.sin(a) * l + sway, y - Math.cos(a) * l * .6); ctx.stroke(); }
      const cols = LEAF[season];
      if (cols) for (let k = 0; k < 16; k++) { const a = R() * TAU, r = R(); ctx.fillStyle = cols[(R() * 3) | 0]; ctx.beginPath(); ctx.arc(Math.cos(a) * T.w * .45 * r + sway * 1.3, -T.h * .72 + Math.sin(a) * T.h * .2 * r, T.w * (.16 + R() * .1), 0, TAU); ctx.fill(); }
      else if (snow > .1) { ctx.strokeStyle = `rgba(250,252,255,${snow * .8})`; ctx.lineWidth = 2; for (const b of br) { ctx.beginPath(); ctx.moveTo(b[0], b[1] - 2); ctx.lineTo(b[2], b[3] - 2); ctx.stroke(); } }
    }
    ctx.restore();
  }

  /* ---------- critters (nothing is ever caught) ---------- */
  function drawFrog(ctx, c, s = 1) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale((c.face || 1) * s, s);
    const hop = c.state === 'hop';
    ctx.fillStyle = '#4a8a2a'; ctx.strokeStyle = '#2a5a1a'; ctx.lineWidth = .8;
    if (hop) { ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-14, 4); ctx.lineTo(-18, 2); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -5, 8, 5, hop ? -.4 : -.15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6aaa3a'; ctx.beginPath(); ctx.ellipse(5, -8, 4.5, 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0d040'; ctx.beginPath(); ctx.arc(6, -10.5, 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(6.4, -10.5, 1, 0, TAU); ctx.fill();
    if (!hop) { ctx.fillStyle = '#3a7a22'; ctx.beginPath(); ctx.ellipse(-4, -2, 5, 2.6, .3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e8e8b0'; ctx.beginPath(); ctx.ellipse(2, -2, 4, 1.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawHopper(ctx, c) { ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.vx < 0 ? -1 : 1, 1); ctx.fillStyle = '#7aa83a'; ctx.beginPath(); ctx.ellipse(0, -3, 5, 1.8, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5a882a'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(-4, -7); ctx.lineTo(-6, -1); ctx.moveTo(4, -4); ctx.lineTo(8, -8); ctx.stroke(); ctx.restore(); }
  function drawButterfly(ctx, c, t) { const f = Math.abs(Math.sin(t * 14 + c.ph)); ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = c.col; ctx.strokeStyle = 'rgba(30,20,10,.6)'; ctx.lineWidth = .5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 3 * f, -2, 3.2 * f + .4, 4, s * .3, 0, TAU); ctx.fill(); ctx.stroke(); } ctx.fillStyle = '#2a2018'; ctx.fillRect(-.6, -4, 1.2, 6); ctx.restore(); }
  function drawDragonfly(ctx, c, t) { ctx.save(); ctx.translate(c.x, c.y); ctx.strokeStyle = '#2a8ac0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.fillStyle = 'rgba(220,240,255,.6)'; const f = Math.sin(t * 40) * .3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(1, s * 3, 5, 1.5, s * (.3 + f), 0, TAU); ctx.fill(); } ctx.fillStyle = '#1a5a8a'; ctx.beginPath(); ctx.arc(5, 0, 1.6, 0, TAU); ctx.fill(); ctx.restore(); }
  function drawWorm(ctx, w) { if (w.up <= 0) return; ctx.save(); ctx.translate(w.x, w.y); ctx.strokeStyle = '#d88a8a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; const h = 9 * w.up; ctx.beginPath(); ctx.moveTo(0, 1); ctx.quadraticCurveTo(Math.sin(w.ph) * 4, -h * .5, Math.sin(w.ph + 1) * 3, -h); ctx.stroke(); ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse(0, 1, 4, 1.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }

  /* ---------- the snack: a little damp, leafy spot that sparkles once smelled ---------- */
  function drawSnack(ctx, s, t, sc = 1) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(70,50,30,.45)'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 2.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8ab848'; ctx.beginPath(); ctx.ellipse(-3, -2, 6, 2.6, -.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#6a9a38'; ctx.beginPath(); ctx.ellipse(3, -2.4, 5, 2.2, .4, 0, TAU); ctx.fill();
    const k = .6 + .4 * Math.sin(t * 5 + (s.glint || 0));
    ctx.fillStyle = `rgba(255,245,170,${k})`; star(ctx, 0, -9, 4.2 * k + 1.5); ctx.fillStyle = `rgba(255,190,230,${k * .8})`; star(ctx, 6, -5, 2.4); star(ctx, -6, -6, 2);
    ctx.restore();
  }
  function star(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr2 = i % 2 ? r * .38 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); }

  /* ---------- visitors ---------- */
  function drawHawk(ctx, h, t, s = 1) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(s, s);
    const dive = h.state === 'dive', flap = dive ? .2 : Math.sin(t * 3) * .25;
    ctx.fillStyle = '#7a5434'; ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1;
    for (const side of [-1, 1]) { ctx.save(); ctx.scale(side, 1); ctx.rotate(flap * side * 0 + (dive ? .9 : 0)); ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(30, -12 - flap * 20, 58, -4 - flap * 30); ctx.lineTo(50, 2); ctx.lineTo(44, 4 - flap * 10); ctx.lineTo(36, 6); ctx.quadraticCurveTo(18, 8, 4, 6); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#e8d8b8'; ctx.beginPath(); ctx.ellipse(0, 2, 8, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0502a'; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 26); ctx.lineTo(6, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4424'; ctx.beginPath(); ctx.arc(0, -11, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(0, -3); ctx.lineTo(2, -7); ctx.fill();
    ctx.restore();
  }
  function drawRaccoon(ctx, r, s = 1) {
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale((r.state === 'leave' && r.musked ? -r.dir : r.dir) * s, s);
    const step = Math.sin(r.ph || 0) * 3;
    ctx.fillStyle = '#5a5a5e'; ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 1;
    for (const lx of [-16, -8, 12, 18]) { ctx.beginPath(); ctx.rect(lx + (lx > 0 ? step : -step) * .3, -12, 4, 12); ctx.fill(); }
    /* ringed tail */
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#2a2a2e' : '#9a9a9e'; ctx.beginPath(); ctx.ellipse(-26 - k * 5, -22 + k * 2, 4.5, 5.5, .6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#7a7a80'; ctx.beginPath(); ctx.ellipse(0, -22, 22, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const sniff = r.state === 'sniff' ? Math.sin((r.ph || 0) * 2) * 2 : 0;
    ctx.save(); ctx.translate(20, -26 + sniff + (r.state === 'sniff' ? 6 : 0));
    ctx.fillStyle = '#8a8a90'; ctx.beginPath(); ctx.ellipse(4, 0, 11, 9, .1, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8e8ea'; ctx.beginPath(); ctx.ellipse(9, 3, 7, 4, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(4, -2, 9, 3.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -2, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, 3, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a6a70'; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-1, -14); ctx.lineTo(3, -7); ctx.fill();
    ctx.restore();
    if (r.musked) { ctx.strokeStyle = 'rgba(150,180,60,.7)'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let y = 0; y < 20; y += 2) ctx.lineTo(30 + k * 8 + Math.sin(y * .5 + (r.ph || 0)) * 3, -40 - y); ctx.stroke(); } }
    ctx.restore();
  }
  function drawHeron(ctx, h, t, s = 1) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale((h.face || 1) * s, s);
    const strike = h.state === 'strike' ? Math.sin(clamp(h.t / .45, 0, 1) * Math.PI) : 0, fly = h.state === 'fly' || h.state === 'leave';
    ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (!fly) { ctx.beginPath(); ctx.moveTo(-3, -40); ctx.lineTo(-4, 0); ctx.moveTo(3, -40); ctx.lineTo(4, 0); ctx.stroke(); }
    ctx.fillStyle = '#8a9aaa'; ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -52, 18, 11, -.2, 0, TAU); ctx.fill(); ctx.stroke();
    if (fly) { ctx.beginPath(); ctx.moveTo(-6, -56); ctx.quadraticCurveTo(-10, -90 + Math.sin(t * 6) * 20, 26, -80 + Math.sin(t * 6) * 18); ctx.lineTo(10, -54); ctx.fill(); ctx.stroke(); }
    /* the long neck: an S, straightening out for the strike (into the water, never at you) */
    const nx = 12 + strike * 34, ny = -78 + strike * 52;
    ctx.strokeStyle = '#9aaab8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(12, -58); ctx.quadraticCurveTo(22 - strike * 4, -70 + strike * 10, nx, ny); ctx.stroke();
    ctx.fillStyle = '#b8c4cc'; ctx.beginPath(); ctx.arc(nx, ny, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.moveTo(nx + 4, ny - 2); ctx.lineTo(nx + 20 + strike * 4, ny + 2 + strike * 6); ctx.lineTo(nx + 4, ny + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(nx + 1.5, ny - 1.5, 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(nx - 2, ny - 3); ctx.lineTo(nx - 12, ny - 6); ctx.stroke();
    ctx.restore();
  }
  function drawScientist(ctx, s, t, sc = 1) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale((s.face || 1) * sc, sc);
    const step = Math.sin(s.ph || 0) * 4, kneel = s.state === 'lift' || s.state === 'lay' || s.state === 'putback' || s.measuring;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a4a6a'; ctx.lineWidth = 6;
    if (kneel) { ctx.beginPath(); ctx.moveTo(-3, -30); ctx.lineTo(-10, -12); ctx.lineTo(-22, -2); ctx.moveTo(3, -30); ctx.lineTo(10, -2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-3, -38); ctx.lineTo(-3 - step, 0); ctx.moveTo(3, -38); ctx.lineTo(3 + step, 0); ctx.stroke(); }
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-8 - step * (kneel ? 0 : 1), -3, 10, 4);
    const by = kneel ? -26 : -38;
    ctx.fillStyle = '#5a8a4a'; rr(ctx, -9, by - 30, 18, 32, 5); ctx.fill();
    ctx.fillStyle = '#e8c09a'; ctx.beginPath(); ctx.arc(0, by - 38, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8b070'; ctx.beginPath(); ctx.ellipse(0, by - 43, 13, 3, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, by - 46, 7, 5, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.arc(-6, by - 36, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(4, by - 38, 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(3, by - 34, 2.5, .2, Math.PI - .4); ctx.stroke();
    /* arms: holding the clipboard, or the measuring tape */
    ctx.strokeStyle = '#5a8a4a'; ctx.lineWidth = 4;
    if (s.measuring) { ctx.beginPath(); ctx.moveTo(-6, by - 24); ctx.lineTo(-16, by - 8); ctx.moveTo(6, by - 24); ctx.lineTo(22, by - 8); ctx.stroke(); ctx.fillStyle = '#f0d040'; ctx.fillRect(-18, by - 10, 42, 4); ctx.fillStyle = '#222'; for (let k = 0; k < 10; k++) ctx.fillRect(-17 + k * 4, by - 10, .6, 2); }
    else if (s.holding) { ctx.beginPath(); ctx.moveTo(6, by - 24); ctx.lineTo(18, by - 30); ctx.stroke(); ctx.fillStyle = '#b08a5a'; ctx.save(); ctx.translate(26, by - 30); ctx.rotate(-1.2); ctx.fillRect(-30, -3, 60, 6); ctx.restore(); }
    else { ctx.beginPath(); ctx.moveTo(6, by - 24); ctx.lineTo(12, by - 14); ctx.stroke(); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(10, by - 24, 10, 13); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(12, by - 26, 6, 3); }
    ctx.restore();
  }

  /* ---------- icons (HUD, life wheel, stickers, reading pictures): a 100×100 box centred on 0,0 ---------- */
  function ground(ctx, col = '#8ab848') { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-46, 30); ctx.quadraticCurveTo(0, 22, 46, 30); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); }
  function drawIcon(ctx, key, px, form) {
    form = form || 'eastern';
    const roundBg = (a, b) => { const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill(); };
    if (['den', 'pond', 'winter', 'trail', 'eye', 'blueeye', 'tongue', 'scales', 'spring', 'meadow', 'grass'].includes(key)) { ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip(); }
    if (['shed', 'skin', 'snack', 'sac', 'born'].includes(key)) roundBg('#e8f4d8', '#a8cc88');
    switch (key) {
      case 'snake': case 'adult': case 'boy': snakeIcon(ctx, form, { len: 210, thick: 15, pose: 'coil', tongue: .5 }); break;
      case 'girl': snakeIcon(ctx, form, { len: 236, thick: 17.5, pose: 'coil' }); break;
      case 'young': snakeIcon(ctx, form, { len: 170, thick: 13, pose: 'coil', tongue: .5 }); break;
      case 'newborn': case 'baby': snakeIcon(ctx, form, { len: 130, thick: 11, baby: 1, pose: 'coil', tongue: .5 }); break;
      case 'sac': case 'born': { ctx.translate(0, 20); drawSac(ctx, 0, 0, 3.2, 0, 0, form); break; }
      case 'coil': case 'bask': { if (key === 'bask') { ctx.fillStyle = '#ffd04a'; ctx.beginPath(); ctx.arc(30, -30, 12, 0, TAU); ctx.fill(); } snakeIcon(ctx, form, { len: 210, thick: 15, pose: 'coil' }); break; }
      case 'shed': case 'skin': drawExuvia(ctx, { x: 0, y: 8, len: 86, thick: 16, face: 1, seed: 1, looked: true }); break;
      case 'tongue': { ctx.fillStyle = '#cfe8b8'; ctx.fillRect(-46, -46, 92, 92); ctx.save(); ctx.translate(-70, 18); ctx.scale(3, 3); const P = posePts('straight', 40, 8); drawSnake(ctx, P, { thick: 8, form, tongue: .5, shadow: false }); ctx.restore(); break; }
      case 'eye': case 'blueeye': { ctx.fillStyle = FORMS[form].back; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = FORMS[form].iris; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, -10, 7, 0, TAU); ctx.fill(); if (key === 'blueeye') { ctx.fillStyle = 'rgba(178,206,232,.88)'; ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fill(); } ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 33, -2.4, -1.2); ctx.stroke(); break; }
      case 'scales': { ctx.fillStyle = FORMS[form].back; ctx.fillRect(-46, -46, 92, 92); for (let r = -3; r <= 3; r++) for (let c = -3; c <= 3; c++) { const x = c * 18 + (r % 2 ? 9 : 0), y = r * 13; ctx.fillStyle = r === 0 ? FORMS[form].stripe : (r + c) % 3 === 0 ? FORMS[form].check : shade(FORMS[form].back.startsWith('#') ? FORMS[form].back : '#3c4a2a', 1.25); ctx.beginPath(); ctx.ellipse(x, y, 9, 7, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); } break; }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': { ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
      case 'rock': case 'stone': { const W = fakeW(); drawCover(ctx, Object.assign({ kind: 'rock', x: 0, y: 26, tilt: 0, id: 3 }, COVER_KINDS.rock, { w: 84, h: 30 }), W, 'summer', 0); break; }
      case 'board': { ground(ctx); const W = fakeW(); drawCover(ctx, Object.assign({ kind: 'board', x: 0, y: 30, tilt: 0, id: 4 }, COVER_KINDS.board, { w: 86, h: 10 }), W, 'summer', 0); ctx.save(); ctx.translate(36, 22); snakeIcon(ctx, form, { len: 40, thick: 6, baby: 1, pose: 'straight' }); ctx.restore(); break; }
      case 'log': { ground(ctx); const W = fakeW(); drawCover(ctx, Object.assign({ kind: 'log', x: 0, y: 30, tilt: 0, id: 5 }, COVER_KINDS.log, { w: 88, h: 34 }), W, 'summer', 0); break; }
      case 'hide': { ground(ctx); const W = fakeW(); ctx.save(); ctx.translate(40, 24); snakeIcon(ctx, form, { len: 46, thick: 7, pose: 'straight' }); ctx.restore(); drawCover(ctx, Object.assign({ kind: 'log', x: -6, y: 30, tilt: 0, id: 5 }, COVER_KINDS.log, { w: 80, h: 30 }), W, 'summer', 0); break; }
      case 'den': { ctx.fillStyle = '#9aa4b0'; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = '#c8bca4'; ctx.beginPath(); ctx.moveTo(-46, -10); ctx.quadraticCurveTo(0, -40, 46, -14); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(8, -24); ctx.lineTo(2, 0); ctx.lineTo(14, 20); ctx.lineTo(-20, 30); ctx.lineTo(-30, 26); ctx.lineTo(-4, 14); ctx.lineTo(-10, -4); ctx.closePath(); ctx.fill(); ctx.save(); ctx.translate(-12, 34); ctx.scale(.45, .45); snakeIcon(ctx, form, { len: 120, thick: 10, pose: 'coil' }); ctx.restore(); break; }
      case 'winter': { ctx.fillStyle = '#c8d4e4'; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-46, -16); ctx.quadraticCurveTo(0, -28, 46, -18); ctx.lineTo(46, -6); ctx.lineTo(-46, -4); ctx.fill(); ctx.fillStyle = '#8a7a64'; ctx.fillRect(-46, -5, 92, 60); ctx.strokeStyle = '#4a7ab0'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-46, 8); ctx.lineTo(46, 8); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.ellipse(0, 30, 34, 13, 0, 0, TAU); ctx.fill(); for (const [x, f] of [[-14, 'eastern'], [8, form], [20, 'redsided']]) { ctx.save(); ctx.translate(x, 38); ctx.scale(.28, .28); snakeIcon(ctx, f, { len: 120, thick: 10, pose: 'coil' }); ctx.restore(); } break; }
      case 'pond': { ctx.fillStyle = '#9ad0f0'; ctx.fillRect(-46, -46, 92, 46); ctx.fillStyle = '#3a8ac0'; ctx.fillRect(-46, 0, 92, 46); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .2) * 2); ctx.stroke(); ctx.fillStyle = '#4a9a3a'; ctx.beginPath(); ctx.ellipse(-16, 4, 14, 4, 0, .3, TAU - .3); ctx.fill(); ctx.fillStyle = '#ff9ad0'; ctx.beginPath(); ctx.arc(-14, 0, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5a8a2a'; ctx.lineWidth = 3; for (const x of [26, 32, 38]) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x - 2, -34); ctx.stroke(); } ctx.fillStyle = '#6a4a2a'; ctx.fillRect(28, -40, 5, 12); break; }
      case 'swim': { ctx.fillStyle = '#3a8ac0'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(0, 4); snakeIcon(ctx, form, { len: 100, thick: 9, headUp: .5 }); ctx.restore(); ctx.fillStyle = 'rgba(58,138,192,.55)'; ctx.fillRect(-46, 8, 92, 40); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, 8 + Math.sin(x * .25) * 2); ctx.stroke(); break; }
      case 'frog': { ctx.save(); ctx.scale(3.4, 3.4); ctx.translate(0, 8); drawFrog(ctx, { x: 0, y: 0, face: 1, state: 'hop' }); ctx.restore(); ctx.fillStyle = '#3a8ac0'; ctx.fillRect(-46, 34, 92, 12); break; }
      case 'hawk': drawHawk(ctx, { x: 0, y: -2, state: 'circle' }, .3, .7); break;
      case 'raccoon': drawRaccoon(ctx, { x: -2, y: 28, dir: 1, state: 'come', ph: 0 }, 1); break;
      case 'heron': drawHeron(ctx, { x: -10, y: 44, face: 1, state: 'stand' }, 0, .95); break;
      case 'scientist': drawScientist(ctx, { x: 0, y: 46, face: 1, state: 'walk', ph: 0 }, 0, .9); break;
      case 'measure': drawScientist(ctx, { x: -8, y: 46, face: 1, state: 'lift', measuring: true }, 0, .9); break;
      case 'snack': ctx.scale(3.6, 3.6); ctx.translate(0, 6); drawSnack(ctx, { x: 0, y: 0, glint: 0 }, .3); break;
      case 'snow': { ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (const [x, y] of [[-18, 20], [-2, 30], [14, 18], [26, 32], [-28, 34]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } break; }
      case 'leaf': case 'autumn': { ctx.fillStyle = '#e8902a'; ctx.beginPath(); ctx.moveTo(0, -36); ctx.quadraticCurveTo(30, -20, 26, 10); ctx.quadraticCurveTo(12, 30, 0, 32); ctx.quadraticCurveTo(-12, 30, -26, 10); ctx.quadraticCurveTo(-30, -20, 0, -36); ctx.fill(); ctx.strokeStyle = '#a85a10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 42); for (const y of [-14, 0, 14]) { ctx.moveTo(0, y); ctx.lineTo(16, y - 10); ctx.moveTo(0, y); ctx.lineTo(-16, y - 10); } ctx.stroke(); break; }
      case 'flower': case 'spring': case 'meadow': case 'grass': { if (key !== 'flower') { roundBg('#cfeef8', '#8ac8e8'); ground(ctx, '#7ab848'); } ctx.strokeStyle = '#4a8a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(0, -6); ctx.stroke(); ctx.fillStyle = '#f2d043'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 11, -14 + Math.sin(a) * 11, 8, 5, a, 0, TAU); ctx.fill(); } ctx.fillStyle = '#c87a20'; ctx.beginPath(); ctx.arc(0, -14, 6, 0, TAU); ctx.fill(); if (key === 'meadow' || key === 'grass') { ctx.save(); ctx.translate(-4, 30); snakeIcon(ctx, form, { len: 70, thick: 7 }); ctx.restore(); } break; }
      case 'firefly': { ctx.fillStyle = '#14203a'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill(); for (const [x, y, r] of [[-14, -10, 9], [16, 8, 6], [-4, 22, 5], [20, -22, 4]]) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, 'rgba(240,255,140,1)'); g.addColorStop(1, 'rgba(240,255,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill(); } break; }
      case 'trail': { roundBg('#e8f0d0', '#b8d090'); ctx.fillStyle = '#c86ad8'; for (let k = 0; k < 9; k++) { ctx.globalAlpha = .3 + k * .07; ctx.beginPath(); ctx.arc(-40 + k * 9, 20 - Math.sin(k * .7) * 10, 3.5, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; ctx.save(); ctx.translate(28, 2); ctx.scale(.55, .55); snakeIcon(ctx, form, { len: 70, thick: 9, tongue: .5 }); ctx.restore(); break; }
      case 'babies': case 'parent': case 'litter': { ground(ctx); ctx.save(); ctx.translate(-18, 6); ctx.scale(.62, .62); snakeIcon(ctx, form, { len: 130, thick: 11, pose: 'coil' }); ctx.restore(); for (const [x, y] of [[22, 26], [30, 8], [8, 34]]) { ctx.save(); ctx.translate(x, y); ctx.scale(.36, .36); snakeIcon(ctx, form, { len: 70, thick: 7, baby: 1 }); ctx.restore(); } ctx.save(); ctx.translate(-34, 36); drawSac(ctx, 0, 0, 1.1, 0, 0, form); ctx.restore(); break; }
      case 'mum': case 'heart': { if (key === 'heart') { ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-46, 0, -20, -40, 0, -14); ctx.bezierCurveTo(20, -40, 46, 0, 0, 30); ctx.fill(); break; } snakeIcon(ctx, form, { len: 230, thick: 17, pose: 'coil' }); break; }
      case 'hole': case 'crack': drawIcon(ctx, 'den', px, form); break;
      default: snakeIcon(ctx, form, { len: 90, thick: 9.5 });
    }
  }
  function fakeW() { return { coverTop: (c, x) => { const u = (x - c.x) / (c.w / 2); if (u <= -1 || u >= 1) return null; const base = c.y; if (c.kind === 'board') return base - c.h * smoothstep(1, .82, Math.abs(u)); return base - c.h * Math.sqrt(1 - u * u); } }; }
  function icon(key, px, form) {
    form = form || (typeof window !== 'undefined' && window.G && window.G.form) || 'eastern';
    const k = `${key}|${px}|${form}`;
    let c = iconCache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = px * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); ctx.scale(px / 100, px / 100);
      drawIcon(ctx, key, px, form);
      iconCache.set(k, c);
    }
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }

  return { drawSnake, drawHead, posePts, snakeIcon, snakeCols, drawSac, drawExuvia, drawCover, drawTree, drawFrog, drawHopper, drawButterfly, drawDragonfly, drawWorm, drawSnack, drawHawk, drawRaccoon, drawHeron, drawScientist, drawIcon, icon, star };
})();
