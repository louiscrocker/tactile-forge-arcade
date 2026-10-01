/* ============================================================
   sprites.js — the alicorn, her friends, and the land, all drawn
                by code
   ============================================================
   Every creature lives in its own local frame facing +x.  The
   alicorn's origin is her body centre (hooves at y = ALICORN_FEET
   when standing); every other animal and prop has its origin at
   the ground under it.  Callers translate / rotate / scale first.
   Sizes are in world units at scale 1.
   ============================================================ */
'use strict';

const ALICORN_FEET = 38;

const Sprites = (function () {

  /* ---------- shared bits ---------- */
  function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  const maneHex = (key) => { const m = MANE_COLORS.find(c => c.key === key); return m ? m.hex : '#ff7ab6'; };
  const bodyHex = (key) => { const b = BODY_COLORS.find(c => c.key === key); return b ? b.hex : '#ffc6da'; };
  const eyeHex = (key) => { const e = EYE_COLORS.find(c => c.key === key); return e ? e.hex : '#3f8fff'; };
  const hornDef = (key) => HORNS.find(h => h.key === key) || HORNS[0];
  function maneColours(look) {
    const keys = look.mane && look.mane.length ? look.mane : ['pink'];
    if (keys.includes('rainbow')) return RAINBOW.slice();
    return keys.map(maneHex);
  }
  function rainbowGrad(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    RAINBOW.forEach((c, i) => g.addColorStop(i / 6, c));
    return g;
  }

  /* ---------- hair helpers ---------- */
  const markImgs = new Map();
  function markImage(src) { let im = markImgs.get(src); if (!im) { im = new Image(); im.src = src; markImgs.set(src, im); } return im; }
  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
    return out;
  }
  function polyline(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
  /* push each point of a strand sideways by a growing wave: curls */
  function curl(pts, amp, freq, phase) {
    const n = pts.length - 1;
    return pts.map((p, i) => {
      if (!i) return p;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1, k = i / n;
      const off = Math.sin(k * freq * TAU + phase) * amp * (.35 + k * .65);
      return [p[0] - ty / L * off, p[1] + tx / L * off];
    });
  }
  /* a braid: overlapping ovals along a path, alternating colours */
  function braid(ctx, pts, w, c1, c2) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = shade(c1, .78); ctx.lineWidth = w + 1.2; polyline(ctx, pts); ctx.stroke();
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), k = 1 - i / pts.length * .4;
      ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(ang + (i % 2 ? .55 : -.55));
      ctx.fillStyle = i % 2 ? c1 : c2; ellipse(ctx, 0, 0, len * .78, w * .52 * k); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.32)'; ellipse(ctx, -len * .1, -w * .16 * k, len * .42, w * .15 * k); ctx.fill();
      ctx.restore();
    }
  }
  /* one soft lock of hair, with a highlight */
  function lock(ctx, pts, w, col, hl = .3) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.lineWidth = w; polyline(ctx, pts); ctx.stroke();
    if (hl > 0) { ctx.strokeStyle = `rgba(255,255,255,${hl})`; ctx.lineWidth = Math.max(1, w * .28); polyline(ctx, pts.map(([x, y]) => [x - .6, y - .9])); ctx.stroke(); }
  }

  /* ============================================================
     THE ALICORN
     o: { s, look, walk, gallop, fly, open, flap, stream, blink,
          mouth, magic, time, sit, sleep, alpha, swim, skate,
          baby (0 grown .. 1 new foal), hair {tx,ty,mx,my} }
     ============================================================ */
  function feetY(baby) { return ALICORN_FEET - 9 * (baby || 0); }
  function drawAlicorn(ctx, o) {
    const s = o.s || 1, look = o.look || DEFAULT_LOOK;
    const walk = o.walk || 0, gallop = o.gallop || 0, fly = o.fly || 0, swim = o.swim || 0, skate = o.skate || 0;
    const open = (o.open === undefined ? fly : o.open) * (1 - swim);
    const flap = o.flap || 0, stream = o.stream === undefined ? Math.max(gallop, fly) : o.stream;
    const blink = o.blink || 0, mouth = o.mouth || 0, magic = o.magic || 0, time = o.time || 0, sit = o.sit || 0;
    const baby = o.baby || 0, hair = o.hair || { tx: 0, ty: 0, mx: 0, my: 0 };
    const wear = look.wear || [];
    const has = (k) => wear.includes(k);
    const body = bodyHex(look.body);
    const dark = shade(body, .82), outline = shade(body, .55, .55);
    const manes = maneColours(look);
    const m2 = manes[1 % manes.length] || manes[0];
    const eye = eyeHex(look.eyes);
    const horn = hornDef(look.horn);
    const hoofCol = has('boots') ? '#ffd24a' : shade(body, .5);
    const maneStyle = look.maneStyle || 'flowing', tailStyle = look.tailStyle || 'flowing';
    const hs = 1 + .34 * baby, legK = 1 - .3 * baby;
    const headT = () => { ctx.translate(36, -36); ctx.scale(hs, hs); ctx.translate(-36, 36); };

    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    /* gait */
    const amp = lerp(.75, 1.15, gallop);
    const bob = -Math.abs(Math.sin(walk)) * 1.2 * (1 - gallop) - Math.max(0, Math.sin(walk * 2 + .4)) * 4 * gallop;
    const pitch = Math.sin(walk * 2 + 1) * .07 * gallop;
    ctx.translate(0, (walk || gallop ? bob : 0) * (1 - fly) + 17 * sit * legK + Math.sin(flap) * 2 * fly + Math.sin(time * 2) * 2 * swim);
    ctx.rotate(pitch);

    /* leg phases: trot pairs when walking, bounding when galloping */
    const ph = { FL: walk, FR: walk + lerp(Math.PI, .6, gallop), BL: walk + lerp(Math.PI, Math.PI, gallop), BR: walk + lerp(0, Math.PI + .6, gallop) };
    const legPose = (key) => {
      const p = ph[key], hind = key[0] === 'B';
      let swing = Math.sin(p) * amp, lift = Math.max(0, Math.cos(p)) * lerp(.7, 1, gallop);
      if (!o.walk && !gallop) { swing = 0; lift = 0; }
      if (skate > 0) { swing = lerp(swing, hind ? -.5 : .5, skate); lift = lerp(lift, 0, skate); }
      if (swim > 0) { const pp = time * 6 + (hind ? 1.3 : 0) + (key[1] === 'L' ? Math.PI : 0); swing = lerp(swing, Math.sin(pp) * .9, swim); lift = lerp(lift, .6 + .4 * Math.cos(pp), swim); }
      if (fly > 0) { swing = lerp(swing, hind ? -.35 : .3, fly); lift = lerp(lift, hind ? .55 : .85, fly); }
      if (sit > 0) { swing = lerp(swing, hind ? 1.5 : -1.3, sit); lift = lerp(lift, hind ? -2.2 : 2.3, sit); }
      return { swing, lift };
    };
    const leg = (hx, hy, pose, hind, col) => {
      const L1 = 15 * legK, L2 = 13 * legK;
      const a1 = pose.swing * .55;
      const a2 = a1 - pose.lift * (hind ? 1.15 : 1);
      const kx = hx + Math.sin(a1) * L1, ky = hy + Math.cos(a1) * L1;
      const fx = kx + Math.sin(a2) * L2, fy = ky + Math.cos(a2) * L2;
      const lw = 1 + .15 * baby;
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? col : outline; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = (pass ? 8 : 10.4) * lw;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
        ctx.lineWidth = (pass ? 6 : 8.4) * lw;
        ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(a2);
      ctx.fillStyle = hoofCol; rr(ctx, -4.2, 0, 8.4, 5.5, 2); ctx.fill();
      if (has('boots')) { ctx.fillStyle = 'rgba(255,255,255,.8)'; circle(ctx, -1.5, 2.5, 1.1); ctx.fill(); }
      if (skate > .3) { ctx.strokeStyle = '#c9d6e8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, 6.5); ctx.lineTo(6, 6.5); ctx.stroke(); }
      ctx.restore();
      return [fx, fy];
    };

    /* ---- tail ---- */
    const tw = Math.sin(time * 3.2) * 4;
    const tailK = (1 - .38 * baby) * (tailStyle === 'long' ? 1.3 : 1);
    const tailPts = (k) => {
      const up = lerp(0, -22, stream) - 10 * swim;
      const b = [-34, -6 + k * 4];
      const P = (rx, ry) => [b[0] + rx * tailK, b[1] + ry * tailK];
      let p3 = [-36 - k * 10 - stream * 12, 16 + k * 8 + up * 1.4 + tw * .8];
      if (tailStyle === 'long') { p3 = [p3[0] - 4, p3[1] + 16 * (1 - stream)]; }
      return [b, P(-18 + tw * .3, -16 + k * 4 + up * .6), P(-32 - k * 8 + hair.tx * .5, -2 + k * 6 + up + tw + hair.ty * .5), P(p3[0] + hair.tx, p3[1] + hair.ty)];
    };
    if (tailStyle === 'braided') {
      const [a, b, c, d] = tailPts(.5);
      const pts = bez(a, [b[0] - 2, b[1] + 6], [c[0] + 4, c[1] + 10], [d[0] + 6, d[1] + 12], 9);
      braid(ctx, pts.slice(0, 8), 10 * (1 - .2 * baby), manes[0], m2);
      const e = pts[7], f = pts[9];
      for (let i = 0; i < 5; i++) { const ang = Math.atan2(f[1] - e[1], f[0] - e[0]) + (i - 2) * .28; lock(ctx, [e, [e[0] + Math.cos(ang) * 8 * tailK, e[1] + Math.sin(ang) * 8 * tailK], [e[0] + Math.cos(ang + .2) * 15 * tailK, e[1] + Math.sin(ang + .2) * 15 * tailK]], 3, manes[i % manes.length], .2); }
      bow(ctx, pts[1][0], pts[1][1], 4.5, '#ff6fa8');
    } else {
      const n = tailStyle === 'long' ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const [a, b, c, d] = tailPts(k);
        let pts = bez(a, b, c, d, tailStyle === 'curly' ? 18 : 10);
        if (tailStyle === 'curly') pts = curl(pts, 5.5, 2.3, time * 2 + i * 1.3);
        lock(ctx, pts, (6.5 - k * 1.5) * (1 - .15 * baby), manes[i % manes.length], .28);
      }
    }
    if (has('ribbon')) bow(ctx, -37, -6, 5, '#ff6fa8');

    /* ---- wings ---- */
    const wingK = 1 - .42 * baby;
    const wing = (far) => {
      const phase = flap + (far ? .35 : 0);
      const downT = .5 + .5 * Math.sin(phase);
      const op = clamp(open, 0, 1);
      ctx.save();
      ctx.translate(far ? 2 : -2, -13);
      ctx.rotate(lerp(-.55, lerp(.55, -.7, downT), op));
      ctx.scale(lerp(.55, 1, op) * (far ? .92 : 1) * wingK, lerp(.22, 1, op) * wingK);
      const base = far ? shade(mixHex(body, '#ffffff', .45), .8) : mixHex(body, '#ffffff', .5);
      const tip = far ? shade(manes[0], .8) : manes[0];
      const feathers = [[-62, -40], [-52, -24], [-42, -12], [-31, -3], [-19, 4], [-8, 8]];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-8, -24, -32, -40, -62, -40);
      for (let i = 1; i < feathers.length; i++) { const [ax, ay] = feathers[i - 1], [bx, by] = feathers[i]; ctx.quadraticCurveTo((ax + bx) / 2 - 4, (ay + by) / 2 + 9, bx, by); }
      ctx.lineTo(2, 4);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -6, -60, -20);
      g.addColorStop(0, base); g.addColorStop(.7, base); g.addColorStop(1, mixHex(base, tip, .55));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = shade(base, .8, .7); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = shade(base, .85, .55); ctx.lineWidth = 1;
      for (let i = 0; i < feathers.length - 1; i++) { const [fx, fy] = feathers[i]; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(fx * .5 - 4, fy * .5 - 6, fx, fy); ctx.stroke(); }
      if (look.wings === 'glitter') {
        for (let i = 0; i < 9; i++) { const t = (time * 2 + i * .7) % 1; const [fx, fy] = feathers[i % 5]; ctx.fillStyle = `rgba(255,255,255,${.4 + .6 * Math.sin(t * Math.PI)})`; starPath(ctx, fx * (.3 + (i % 3) * .3), fy * (.3 + (i % 3) * .3) - 4, 2.2 + Math.sin(t * Math.PI) * 1.2); ctx.fill(); }
      }
      ctx.restore();
    };
    wing(true);

    /* ---- far legs ---- */
    leg(-22, 4, legPose('BL'), true, dark);
    leg(16, 6, legPose('FL'), false, dark);

    /* ---- body + neck + head, outline pass then colour pass ---- */
    const bodyPath = () => { ctx.beginPath(); ctx.moveTo(-34, -8); ctx.bezierCurveTo(-28, -20, -6, -20, 8, -17); ctx.bezierCurveTo(16, -16, 26, -14, 32, -6); ctx.bezierCurveTo(38, 2, 36, 14, 26, 17); ctx.bezierCurveTo(12, 20, -12, 20, -26, 16); ctx.bezierCurveTo(-36, 12, -38, 0, -34, -8); ctx.closePath(); };
    const bodyShapes = (pass) => {
      const col = pass ? body : outline, lw = pass ? 0 : 2.6;
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = 17 + lw;
      ctx.beginPath(); ctx.moveTo(18, -4); ctx.quadraticCurveTo(24, -28, 40, -38); ctx.stroke();
      bodyPath(); ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.stroke(); }
      ctx.save(); headT();
      ellipse(ctx, 44, -38, 12.5, 9.8, -.35); ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.stroke(); }
      circle(ctx, 55, -33, 7.2 * (1 - .12 * baby)); ctx.fill(); if (lw) ctx.stroke();
      for (const [ex, ey, sc] of [[33, -45, .85], [38, -47, 1]]) {
        ctx.save(); ctx.translate(ex, ey); ctx.scale(sc, sc);
        ctx.beginPath(); ctx.moveTo(-3.5, 2); ctx.quadraticCurveTo(-1, -12, 3, -11); ctx.quadraticCurveTo(6, -4, 4, 3); ctx.closePath();
        ctx.fillStyle = pass ? (sc < 1 ? dark : body) : outline; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.stroke(); }
        if (pass) { ctx.fillStyle = 'rgba(255,150,190,.55)'; ctx.beginPath(); ctx.moveTo(-1.5, 1); ctx.quadraticCurveTo(0, -7, 2.5, -7); ctx.quadraticCurveTo(3.5, -3, 2.5, 1.5); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      ctx.restore();
    };
    bodyShapes(0); bodyShapes(1);
    ctx.save(); bodyPath(); ctx.clip();
    const bg = ctx.createLinearGradient(0, -18, 0, 20); bg.addColorStop(0, 'rgba(255,255,255,.22)'); bg.addColorStop(.55, 'rgba(255,255,255,0)'); bg.addColorStop(1, shade(body, .72, .45));
    ctx.fillStyle = bg; ctx.fillRect(-40, -22, 80, 44);
    if (baby > .3) { ctx.fillStyle = `rgba(255,255,255,${.35 * baby})`; for (const [x, y] of [[-18, -8], [-10, -12], [-24, -2], [-4, -6]]) { circle(ctx, x, y, 2); ctx.fill(); } }
    ctx.restore();

    /* cutie mark on the rump (foals don't have one yet) */
    if (baby < .5) { ctx.save(); ctx.translate(-22, -1); drawMark(ctx, look.mark, 6.5, shade(manes[0], .9), m2, look.markImg); ctx.restore(); }
    if (has('blanket')) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(-24, -16); ctx.lineTo(8, -17); ctx.lineTo(10, 8); ctx.lineTo(-22, 10); ctx.closePath(); ctx.clip();
      RAINBOW.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-26, -18 + i * 4, 40, 4); });
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-24, -16); ctx.lineTo(8, -17); ctx.lineTo(10, 8); ctx.lineTo(-22, 10); ctx.closePath(); ctx.stroke();
    }

    /* ---- mane along the crest ---- */
    const crest = (t) => { const a = [40, -46], c = [26, -36], b = [12, -16]; const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
    const back = lerp(0, 14, stream) + 6 * swim;
    const maneLen = (maneStyle === 'long' ? 1.6 : 1) * (1 - .3 * baby);
    if (maneStyle === 'braided') {
      for (let i = 0; i < 4; i++) {
        const t = .05 + i * .28, [sx, sy] = crest(t);
        const w = Math.sin(time * 3 + i) * 1.5;
        const end = [sx - 10 - back + hair.mx * .7, sy + 20 * maneLen + w + hair.my * .7];
        const pts = bez([sx, sy], [sx - 4, sy + 5], [end[0] + 2, end[1] - 6], end, 5);
        braid(ctx, pts, 5.5, manes[i % manes.length], manes[(i + 1) % manes.length]);
        ctx.fillStyle = '#ffd24a'; circle(ctx, end[0], end[1] + 1, 2.2); ctx.fill();
      }
    } else {
      const nS = maneStyle === 'long' ? 7 : manes.length >= 6 ? 7 : 5;
      for (let i = 0; i < nS; i++) {
        const t = i / (nS - 1);
        const [sx, sy] = crest(t * .92);
        const w = Math.sin(time * 3.5 + i * .9) * 2.5;
        const L = maneLen * (maneStyle === 'long' ? 1 - t * .25 : 1);
        const end = [sx - 14 * L - back * 1.4 + hair.mx * (.6 + t * .4), sy + 18 * L + w * .6 + hair.my * (.6 + t * .4)];
        let pts = bez([sx, sy], [sx - 8 - back * .4, sy + 2 + w], [sx - 14 * L - back + hair.mx * .4, sy + 10 * L + w + hair.my * .4], end, maneStyle === 'curly' ? 14 : 8);
        if (maneStyle === 'curly') pts = curl(pts, 3.8, 1.8, time * 2 + i);
        lock(ctx, pts, 6.5 - t * 1.5, manes[i % manes.length], .3);
      }
      if (maneStyle === 'flowers') for (const [t, c] of [[.12, '#fff'], [.42, '#ffd23f'], [.72, '#ff8fb8']]) { const [x, y] = crest(t); daisyHead(ctx, x - 3, y + 3, 3.6, c); }
    }
    /* forelock */
    ctx.save(); headT();
    if (maneStyle === 'curly') { for (let i = 0; i < 2; i++) { ctx.strokeStyle = manes[(i + 1) % manes.length]; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(45 + i * 4, -46 + i * 3, 3.5, Math.PI * .8, Math.PI * 2.6); ctx.stroke(); } }
    else if (maneStyle === 'braided') braid(ctx, bez([40, -48], [45, -50], [49, -46], [49, -40], 3), 4, manes[0], m2);
    else for (let i = 0; i < 2; i++) lock(ctx, bez([40, -48], [46 + i * 2, -50 + i * 3], [50 + i * 3, -46 + i * 4], [48 + i * 4, -40 + i * 2], 6), 4.5, manes[(i + 1) % manes.length], .25);

    /* ---- horn ---- */
    ctx.save();
    ctx.translate(42, -48); ctx.rotate(-70 * DEG);
    const hl = 24 * (1 - .45 * baby);
    if (magic > 0) {
      const g = ctx.createRadialGradient(hl, 0, 2, hl, 0, 26 * magic + 8);
      g.addColorStop(0, `rgba(255,255,220,${.9 * magic})`); g.addColorStop(.4, `rgba(255,220,120,${.45 * magic})`); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; circle(ctx, hl, 0, 26 * magic + 8); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.lineTo(hl, 0); ctx.lineTo(0, 3.2); ctx.closePath();
    if (horn.hex === 'rainbow') ctx.fillStyle = rainbowGrad(ctx, 0, 0, hl, 0);
    else { const g = ctx.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, horn.hex2); g.addColorStop(.5, horn.hex); g.addColorStop(1, shade(horn.hex, .75)); ctx.fillStyle = g; }
    ctx.fill();
    ctx.strokeStyle = shade(horn.hex === 'rainbow' ? '#ffffff' : horn.hex, .7, .8); ctx.lineWidth = .9;
    for (let i = 1; i < 5; i++) { const x = i * hl / 5, w = 3.2 * (1 - x / hl); ctx.beginPath(); ctx.moveTo(x - 1.5, -w); ctx.lineTo(x + 1.5, w); ctx.stroke(); }
    ctx.restore();

    /* ---- face ---- */
    const ex = 47, ey = -40, eyeK = 1 + .18 * baby;
    ctx.save();
    ctx.translate(ex, ey); ctx.scale(eyeK, Math.max(.06, 1 - blink) * eyeK);
    ellipse(ctx, 0, 0, 4.6, 5.2); ctx.fillStyle = '#fff'; ctx.fill();
    circle(ctx, .5, .3, 3.5); ctx.fillStyle = eye; ctx.fill();
    circle(ctx, .8, .6, 2); ctx.fillStyle = '#1a1030'; ctx.fill();
    circle(ctx, 1.9, -1.4, 1.25); ctx.fillStyle = '#fff'; ctx.fill();
    circle(ctx, -.4, 1.8, .6); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3a2a4a'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (const [ax, ay, bx, by] of [[ex + 3.5, ey - 4.2, ex + 6.5, ey - 6.5], [ex + 1, ey - 5, ex + 2, ey - 8], [ex - 2.5, ey - 4.6, ex - 4.5, ey - 7]]) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    if (blink > .8 || o.sleep) { ctx.beginPath(); ctx.moveTo(ex - 4, ey); ctx.quadraticCurveTo(ex, ey + 3, ex + 4.5, ey); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,120,160,.32)'; ellipse(ctx, 49, -32.5, 4, 2.4); ctx.fill();
    ctx.fillStyle = shade(body, .55); ellipse(ctx, 59, -34, 1.1, .8); ctx.fill();
    ctx.strokeStyle = shade(body, .5); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(54, -28.5); ctx.quadraticCurveTo(57, -26 + mouth * 3, 60, -28.5); ctx.stroke();
    if (mouth > .2) { ctx.fillStyle = '#c0526e'; ellipse(ctx, 57, -27.5, 2 * mouth, 1.8 * mouth); ctx.fill(); }
    /* head accessories */
    if (has('bow')) bow(ctx, 37, -52, 5.5, '#ff6fa8');
    if (has('tiara')) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(31, -49); ctx.quadraticCurveTo(38, -55, 44, -52); ctx.stroke(); [[34, -53, 2, '#8fe3ff'], [38, -56, 2.6, '#ff8fd0'], [42, -54, 2, '#c9a5ff']].forEach(([x, y, r, c]) => { ctx.fillStyle = c; circle(ctx, x, y, r); ctx.fill(); }); }
    if (has('starcrown')) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(31, -49); ctx.quadraticCurveTo(38, -55, 44, -52); ctx.stroke(); for (const [x, y] of [[33, -52], [38, -56], [43, -53]]) { ctx.fillStyle = '#fff29a'; starPath(ctx, x, y, 3.2); ctx.fill(); } }
    if (has('queencrown')) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(31, -48); ctx.lineTo(32, -58); ctx.lineTo(36, -53); ctx.lineTo(38.5, -61); ctx.lineTo(41, -53); ctx.lineTo(45, -58); ctx.lineTo(45, -49); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c99a1a'; ctx.lineWidth = 1; ctx.stroke(); for (const [x, y] of [[32.5, -57], [38.5, -60], [44.5, -57]]) { ctx.fillStyle = '#ff4d6d'; circle(ctx, x, y, 1.4); ctx.fill(); } ctx.fillStyle = '#ff8fb8'; rr(ctx, 31, -50, 14, 3, 1); ctx.fill(); }
    if (has('shelltiara')) { ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(31, -49); ctx.quadraticCurveTo(38, -55, 44, -52); ctx.stroke(); drawShellShape(ctx, 38, -56, 4.5, '#ffd6e8', 1); for (const x of [33, 43]) { ctx.fillStyle = '#fffaf0'; circle(ctx, x, -52.5, 1.7); ctx.fill(); } }
    if (has('flowercrown')) for (let i = 0; i < 5; i++) daisyHead(ctx, 31 + i * 3.4, -50 - Math.sin(i / 4 * Math.PI) * 5, 2.6, ['#ff8fb8', '#fff', '#c9a5ff', '#ffd23f', '#8fe3ff'][i]);
    if (has('earmuffs')) { ctx.fillStyle = '#ff8fb8'; circle(ctx, 36, -47, 4.5); ctx.fill(); ctx.fillStyle = '#fff'; circle(ctx, 35, -48, 2); ctx.fill(); }
    ctx.restore();   /* headT */

    /* ---- near legs ---- */
    leg(-20, 5, legPose('BR'), true, body);
    leg(18, 7, legPose('FR'), false, body);

    /* ---- near wing ---- */
    wing(false);

    /* ---- neck accessories ---- */
    if (has('garland')) for (let i = 0; i < 7; i++) { const a = -.6 + i * .42; daisyHead(ctx, 24 + Math.cos(a) * 12, -12 + Math.sin(a) * 8, 3.2, ['#ff8fb8', '#fff', '#ffd23f', '#c9a5ff'][i % 4]); }
    if (has('scarf')) { ctx.strokeStyle = '#ff6b8a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(20, -14); ctx.quadraticCurveTo(30, -22, 36, -18); ctx.stroke(); ctx.strokeStyle = '#ffd6de'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, -16); ctx.quadraticCurveTo(30, -22, 35, -19); ctx.stroke(); ctx.strokeStyle = '#ff6b8a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(24, -12); ctx.quadraticCurveTo(18 - stream * 10, 0 + Math.sin(time * 5) * 3, 14 - stream * 18, 4); ctx.stroke(); }
    if (has('bell')) { ctx.strokeStyle = '#e04a6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(19, -14); ctx.quadraticCurveTo(30, -22, 38, -20); ctx.stroke(); ctx.fillStyle = '#e8e8f0'; circle(ctx, 27, -15, 3.2); ctx.fill(); ctx.fillStyle = '#8890a0'; circle(ctx, 27.5, -14, 1); ctx.fill(); }
    if (has('necklace')) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(19, -13); ctx.quadraticCurveTo(28, -8, 38, -20); ctx.stroke(); ctx.fillStyle = '#ffe98a'; circle(ctx, 28, -9, 3.6); ctx.fill(); ctx.fillStyle = body; circle(ctx, 29.6, -10, 3); ctx.fill(); }
    if (has('medal')) { ctx.strokeStyle = '#3fb8ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(19, -14); ctx.lineTo(28, -6); ctx.lineTo(37, -20); ctx.stroke(); ctx.fillStyle = '#ffd24a'; circle(ctx, 28, -3, 5); ctx.fill(); ctx.fillStyle = '#fff29a'; starPath(ctx, 28, -3, 3); ctx.fill(); }
    if (has('pearls')) { for (let i = 0; i < 8; i++) { const t = i / 7; ctx.fillStyle = '#fffaf0'; circle(ctx, lerp(19, 37, t), -13 + Math.sin(t * Math.PI) * 5 - t * 6, 1.8); ctx.fill(); } }

    ctx.restore();
  }
  function drawShellShape(ctx, x, y, r, col, open) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, r * .6);
    for (let i = 0; i <= 6; i++) { const a = Math.PI + i / 6 * Math.PI; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * .9 - (i % 2 ? 0 : r * .08)); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(col, .75); ctx.lineWidth = r * .08;
    for (let i = 1; i < 6; i++) { const a = Math.PI + i / 6 * Math.PI; ctx.beginPath(); ctx.moveTo(0, r * .6); ctx.lineTo(Math.cos(a) * r * .9, Math.sin(a) * r * .8); ctx.stroke(); }
    ctx.restore();
  }

  function bow(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ellipse(ctx, x - r, y, r, r * .65, -.5); ctx.fill();
    ellipse(ctx, x + r, y, r, r * .65, .5); ctx.fill();
    ctx.fillStyle = shade(col, .8); circle(ctx, x, y, r * .42); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(ctx, x - r * 1.1, y - r * .25, r * .22); ctx.fill(); circle(ctx, x + r * 1.1, y - r * .25, r * .22); ctx.fill();
  }
  function daisyHead(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ellipse(ctx, x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .55, r * .35, a); ctx.fill(); }
    ctx.fillStyle = '#ffd23f'; circle(ctx, x, y, r * .4); ctx.fill();
  }

  /* cutie marks and icons, centred at the origin, radius r */
  function drawMark(ctx, key, r, col, col2, img) {
    col = col || '#ff7ab6'; col2 = col2 || col;
    ctx.save();
    switch (key) {
      case 'custom': if (img) { const im = markImage(img); if (im.complete && im.naturalWidth) { ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, TAU); ctx.clip(); ctx.drawImage(im, -r * 1.35, -r * 1.35, r * 2.7, r * 2.7); } } else { starPath(ctx, 0, 0, r); ctx.fillStyle = col; ctx.fill(); } break;
      case 'heart': heartPath(ctx, 0, 0, r); ctx.fillStyle = col; ctx.fill(); break;
      case 'flower': for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ellipse(ctx, Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * .45, r * .3, a); ctx.fillStyle = col; ctx.fill(); } circle(ctx, 0, 0, r * .3); ctx.fillStyle = '#ffd23f'; ctx.fill(); break;
      case 'moon': circle(ctx, 0, 0, r); ctx.fillStyle = col; ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; circle(ctx, r * .45, -r * .2, r * .8); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; break;
      case 'rainbow': ctx.lineWidth = r * .32; RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, r * .5, r * 1.15 - i * r * .16, Math.PI, 0); ctx.stroke(); }); break;
      case 'butterfly': ctx.fillStyle = col; for (const sd of [-1, 1]) { ellipse(ctx, sd * r * .55, -r * .25, r * .55, r * .45, sd * .5); ctx.fill(); ctx.fillStyle = col2; ellipse(ctx, sd * r * .45, r * .45, r * .4, r * .32, -sd * .4); ctx.fill(); ctx.fillStyle = col; } ctx.fillStyle = '#4a3050'; ellipse(ctx, 0, .1, r * .12, r * .6); ctx.fill(); break;
      case 'bolt': ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(r * .2, -r); ctx.lineTo(-r * .6, r * .15); ctx.lineTo(-r * .05, r * .15); ctx.lineTo(-r * .3, r); ctx.lineTo(r * .6, -r * .2); ctx.lineTo(r * .05, -r * .2); ctx.closePath(); ctx.fill(); break;
      case 'note': ctx.fillStyle = col; ellipse(ctx, -r * .35, r * .55, r * .42, r * .3, -.4); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = r * .22; ctx.beginPath(); ctx.moveTo(r * .05, r * .45); ctx.lineTo(r * .05, -r * .9); ctx.quadraticCurveTo(r * .5, -r * .8, r * .6, -r * .3); ctx.stroke(); break;
      case 'crown': ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-r, r * .6); ctx.lineTo(-r, -r * .5); ctx.lineTo(-r * .45, r * .05); ctx.lineTo(0, -r); ctx.lineTo(r * .45, r * .05); ctx.lineTo(r, -r * .5); ctx.lineTo(r, r * .6); ctx.closePath(); ctx.fill(); ctx.fillStyle = col; circle(ctx, 0, r * .25, r * .18); ctx.fill(); break;
      case 'snow': ctx.strokeStyle = '#8fe3ff'; ctx.lineWidth = r * .18; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r * .3, -r * .6); ctx.lineTo(0, -r * .35); ctx.lineTo(r * .3, -r * .6); ctx.moveTo(-r * .3, r * .6); ctx.lineTo(0, r * .35); ctx.lineTo(r * .3, r * .6); ctx.stroke(); ctx.restore(); } break;
      case 'sun': ctx.fillStyle = '#ffd23f'; circle(ctx, 0, 0, r * .55); ctx.fill(); ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = r * .16; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .72, Math.sin(a) * r * .72); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); } break;
      case 'cloud': ctx.fillStyle = '#fff'; circle(ctx, -r * .45, r * .15, r * .45); ctx.fill(); circle(ctx, 0, -r * .2, r * .58); ctx.fill(); circle(ctx, r * .5, r * .15, r * .42); ctx.fill(); ctx.fillRect(-r * .45, r * .15, r * .95, r * .4); break;
      default: starPath(ctx, 0, 0, r); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; starPath(ctx, -r * .15, -r * .15, r * .45); ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================
     FRIENDS — origin at the ground under them, facing +x
     ============================================================ */
  function eyePair(ctx, x, y, gap, r, blink, col = '#1a1030') {
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(x + sd * gap, y); ctx.scale(1, Math.max(.08, 1 - blink));
      circle(ctx, 0, 0, r * 1.5); ctx.fillStyle = '#fff'; ctx.fill();
      circle(ctx, r * .3, r * .2, r); ctx.fillStyle = col; ctx.fill();
      circle(ctx, r * .55, -r * .35, r * .38); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    }
  }
  function drawBunny(ctx, o) {
    const s = o.s || 1, hop = o.hop || 0, blink = o.blink || 0, t = o.time || 0;
    ctx.save(); ctx.scale(s, s); ctx.translate(0, -hop * 18);
    const body = '#efe2d0', dark = '#d9c6ad';
    ctx.fillStyle = dark; ellipse(ctx, -12, -8, 8, 6); ctx.fill();                          // tail puff
    ctx.fillStyle = body; ellipse(ctx, 0, -14, 17, 14); ctx.fill();                         // body
    ctx.fillStyle = dark; ellipse(ctx, 6, -3, 8, 4); ctx.fill(); ellipse(ctx, -8, -3, 7, 3.5); ctx.fill();  // feet
    for (const [ex, tilt] of [[6, -.25], [12, .05]]) { ctx.save(); ctx.translate(ex, -28); ctx.rotate(tilt + Math.sin(t * 2 + ex) * .06); ctx.fillStyle = body; ellipse(ctx, 0, -14, 4.5, 15); ctx.fill(); ctx.fillStyle = '#ffb3c6'; ellipse(ctx, 0, -13, 2.2, 10); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = body; circle(ctx, 11, -26, 11); ctx.fill();                            // head
    ctx.fillStyle = 'rgba(255,150,170,.35)'; ellipse(ctx, 15, -22, 3, 1.8); ctx.fill();
    eyePair(ctx, 13, -28, 4.5, 1.7, blink);
    ctx.fillStyle = '#e07090'; ellipse(ctx, 21, -24, 1.8, 1.2); ctx.fill();                  // nose
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = .8; for (const dy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(19, -23 + dy); ctx.lineTo(27, -25 + dy * 3); ctx.stroke(); }
    ctx.restore();
  }
  function drawFox(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, t = o.time || 0;
    ctx.save(); ctx.scale(s, s);
    const or = '#f08c3a', cream = '#fff1dc';
    ctx.strokeStyle = or; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(-32, -6 + Math.sin(t * 2) * 3, -34, -24); ctx.stroke();       // tail
    ctx.strokeStyle = cream; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-31, -18); ctx.lineTo(-34, -25); ctx.stroke();
    ctx.fillStyle = or; ellipse(ctx, -2, -16, 16, 15); ctx.fill();                              // sitting body
    ctx.fillStyle = cream; ellipse(ctx, 4, -12, 8, 10); ctx.fill();                            // chest
    ctx.fillStyle = '#2a1a10'; ellipse(ctx, 8, -2, 6, 3); ctx.fill(); ellipse(ctx, -8, -2, 6, 3); ctx.fill();  // paws
    for (const ex of [4, 14]) { ctx.fillStyle = or; ctx.beginPath(); ctx.moveTo(ex - 4, -34); ctx.lineTo(ex, -48); ctx.lineTo(ex + 5, -34); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(ex - 1.5, -36); ctx.lineTo(ex, -43); ctx.lineTo(ex + 2.5, -36); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = or; ellipse(ctx, 10, -30, 12, 9); ctx.fill();                              // head
    ctx.fillStyle = cream; ctx.beginPath(); ctx.moveTo(12, -26); ctx.lineTo(24, -24); ctx.lineTo(14, -34); ctx.closePath(); ctx.fill();   // muzzle
    eyePair(ctx, 11, -32, 4, 1.5, blink);
    ctx.fillStyle = '#2a1a10'; circle(ctx, 24, -24, 1.8); ctx.fill();
    ctx.restore();
  }
  function drawOwl(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, tilt = o.tilt || 0;
    ctx.save(); ctx.scale(s, s);
    const br = '#a8825a', dk = '#7a5a3a', cream = '#f3e6cc';
    ctx.fillStyle = br; ellipse(ctx, 0, -22, 15, 20); ctx.fill();                              // body
    ctx.fillStyle = dk; ellipse(ctx, -11, -22, 5, 15, .1); ctx.fill(); ellipse(ctx, 11, -22, 5, 15, -.1); ctx.fill();  // wings
    ctx.fillStyle = cream; ellipse(ctx, 0, -16, 9, 12); ctx.fill();                            // belly
    ctx.strokeStyle = dk; ctx.lineWidth = 1; for (let y = -22; y < -8; y += 5) { ctx.beginPath(); ctx.moveTo(-6, y); ctx.quadraticCurveTo(0, y + 3, 6, y); ctx.stroke(); }
    ctx.save(); ctx.translate(0, -36); ctx.rotate(tilt);
    ctx.fillStyle = br; ellipse(ctx, 0, 0, 14, 11); ctx.fill();                                 // head
    ctx.beginPath(); ctx.moveTo(-13, -6); ctx.lineTo(-10, -16); ctx.lineTo(-4, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -6); ctx.lineTo(10, -16); ctx.lineTo(4, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cream; circle(ctx, -5.5, 0, 6.5); ctx.fill(); circle(ctx, 5.5, 0, 6.5); ctx.fill();
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 5.5, 0); ctx.scale(1, Math.max(.08, 1 - blink)); circle(ctx, 0, 0, 4.2); ctx.fillStyle = '#f7c948'; ctx.fill(); circle(ctx, .5, .3, 2.6); ctx.fillStyle = '#1a1030'; ctx.fill(); circle(ctx, 1.4, -1, .9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#f0a030'; ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(2, 3); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#f0a030'; ctx.lineWidth = 2; for (const fx of [-5, 5]) { ctx.beginPath(); ctx.moveTo(fx, -4); ctx.lineTo(fx - 3, 0); ctx.moveTo(fx, -4); ctx.lineTo(fx + 3, 0); ctx.stroke(); }
    ctx.restore();
  }
  function drawDeer(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, t = o.time || 0, graze = o.graze || 0;
    ctx.save(); ctx.scale(s, s);
    const br = '#c9915a', cream = '#f5e6cf', dk = '#8a5a30';
    ctx.strokeStyle = br; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const [hx, ph] of [[-14, 0], [-10, 1], [12, 2], [16, 3]]) { ctx.beginPath(); ctx.moveTo(hx, -22); ctx.lineTo(hx + Math.sin(t + ph) * .5, -8); ctx.lineTo(hx + 1, 0); ctx.stroke(); }   // legs
    ctx.fillStyle = br; ellipse(ctx, 0, -28, 20, 12); ctx.fill();                               // body
    ctx.fillStyle = cream; ellipse(ctx, 2, -22, 12, 5); ctx.fill();
    ctx.fillStyle = '#fff'; for (const [x, y] of [[-10, -32], [-3, -35], [5, -33], [-6, -27], [8, -28]]) { circle(ctx, x, y, 1.6); ctx.fill(); }
    ctx.fillStyle = cream; ellipse(ctx, -20, -26, 4, 3); ctx.fill();                            // tail
    ctx.save(); ctx.translate(18, -34); ctx.rotate(graze * .9);
    ctx.strokeStyle = br; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -14); ctx.stroke();       // neck
    ctx.fillStyle = br; ellipse(ctx, 9, -19, 8, 6.5, -.3); ctx.fill(); ellipse(ctx, 15, -16, 5, 4); ctx.fill();   // head
    for (const [ex, rot] of [[4, -.6], [9, -.2]]) { ctx.save(); ctx.translate(ex, -24); ctx.rotate(rot); ctx.fillStyle = br; ellipse(ctx, 0, -5, 3, 6.5); ctx.fill(); ctx.fillStyle = '#ffc0c8'; ellipse(ctx, 0, -5, 1.5, 4.5); ctx.fill(); ctx.restore(); }
    eyePair(ctx, 10, -20, 3, 1.4, blink);
    ctx.fillStyle = dk; circle(ctx, 19.5, -15.5, 1.5); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  function drawFrog(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, hop = o.hop || 0, throat = o.throat || 0;
    ctx.save(); ctx.scale(s, s); ctx.translate(0, -hop * 14);
    const g = '#6fcf5a', dk = '#3f9a3a';
    ctx.fillStyle = dk; ellipse(ctx, -10, -3, 7, 3.5); ctx.fill(); ellipse(ctx, 10, -3, 7, 3.5); ctx.fill();  // legs
    ctx.fillStyle = g; ellipse(ctx, 0, -10, 14, 9); ctx.fill();                                  // body
    ctx.fillStyle = '#d8f5a0'; ellipse(ctx, 2, -7, 9, 5 + throat * 4); ctx.fill();               // throat
    ctx.fillStyle = g; circle(ctx, -5, -18, 5); ctx.fill(); circle(ctx, 6, -18, 5); ctx.fill();   // eye bumps
    eyePair(ctx, .5, -19, 5.5, 2, blink);
    ctx.strokeStyle = dk; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(2, -11); ctx.quadraticCurveTo(9, -8, 13, -12); ctx.stroke();
    ctx.restore();
  }
  function drawSwan(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, t = o.time || 0;
    ctx.save(); ctx.scale(s, s); ctx.translate(0, Math.sin(t * 1.5) * 1.5);
    ctx.fillStyle = '#fff'; ellipse(ctx, -4, -10, 20, 10); ctx.fill();                          // body
    ctx.fillStyle = '#e8ecf4'; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(-4, -26, 8, -20); ctx.quadraticCurveTo(0, -14, -8, -14); ctx.fill();   // wing
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(12, -12); ctx.quadraticCurveTo(22, -14, 20, -30); ctx.quadraticCurveTo(18, -40, 24, -40); ctx.stroke();   // S neck
    ctx.fillStyle = '#fff'; ellipse(ctx, 25, -40, 6, 4.5); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ellipse(ctx, 28, -40, 3.5, 2.6); ctx.fill();                      // mask
    ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.moveTo(29, -42); ctx.lineTo(37, -39.5); ctx.lineTo(29, -37); ctx.closePath(); ctx.fill();   // beak
    ctx.save(); ctx.translate(27, -41.5); ctx.scale(1, Math.max(.1, 1 - blink)); circle(ctx, 0, 0, 1.3); ctx.fillStyle = '#1a1030'; ctx.fill(); circle(ctx, .4, -.4, .5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function drawSheep(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, t = o.time || 0, lamb = o.lamb;
    ctx.save(); ctx.scale(s * (lamb ? .6 : 1), s * (lamb ? .6 : 1));
    ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const hx of [-12, -6, 8, 14]) { ctx.beginPath(); ctx.moveTo(hx, -14); ctx.lineTo(hx, 0); ctx.stroke(); }
    ctx.fillStyle = '#fff';
    for (const [x, y, r] of [[-14, -18, 11], [-4, -24, 13], [8, -22, 12], [16, -16, 10], [0, -14, 12], [10, -12, 10], [-10, -12, 9]]) { circle(ctx, x, y, r); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,210,240,.45)'; for (const [x, y, r] of [[-8, -8, 8], [8, -6, 7]]) { circle(ctx, x, y, r); ctx.fill(); }
    if (!lamb) for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(t * 3 + i)})`; starPath(ctx, -10 + i * 8, -34 + Math.sin(t * 2 + i) * 3, 2.2); ctx.fill(); }
    ctx.fillStyle = '#3a3040'; ellipse(ctx, 20, -26, 8, 6.5, -.2); ctx.fill();                   // face
    ctx.fillStyle = '#3a3040'; ellipse(ctx, 14, -32, 4, 2.5, -.6); ctx.fill(); ellipse(ctx, 22, -33, 4, 2.5, .3); ctx.fill();   // ears
    ctx.fillStyle = '#fff'; for (const [x, y, r] of [[15, -33, 4], [21, -34, 4]]) { circle(ctx, x, y, r); ctx.fill(); }   // fluff on top
    eyePair(ctx, 21, -27, 3, 1.3, blink, '#1a1030');
    ctx.fillStyle = '#ffb3c6'; ellipse(ctx, 27, -24, 1.6, 1.1); ctx.fill();
    ctx.restore();
  }
  function drawDragon(ctx, o) {
    const s = o.s || 1, blink = o.blink || 0, t = o.time || 0, flap = o.flap || 0, fly = o.fly || 0, hic = o.hiccup || 0;
    ctx.save(); ctx.scale(s, s); ctx.translate(0, -fly * 6 + Math.sin(t * 6) * 2 * fly);
    const red = '#ff7a5c', dk = '#d9503a', cream = '#ffe0b8';
    /* tail */
    ctx.strokeStyle = red; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.quadraticCurveTo(-26, -8, -28, -20 + Math.sin(t * 3) * 4); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-28, -16 + Math.sin(t * 3) * 4); ctx.lineTo(-33, -30 + Math.sin(t * 3) * 4); ctx.lineTo(-22, -26 + Math.sin(t * 3) * 4); ctx.closePath(); ctx.fill();
    /* far wing */
    const wingAng = -.3 + Math.sin(flap) * .6 * (fly ? 1 : .15);
    for (const far of [true, false]) {
      ctx.save(); ctx.translate(far ? -2 : -4, -26); ctx.rotate(far ? wingAng * .8 + .2 : wingAng);
      ctx.fillStyle = far ? '#c96aa0' : '#e880c0';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -20); ctx.lineTo(-24, -12); ctx.lineTo(-28, 0); ctx.quadraticCurveTo(-16, 4, 0, 0); ctx.fill();
      ctx.strokeStyle = '#a04a80'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -20); ctx.moveTo(0, 0); ctx.lineTo(-24, -12); ctx.stroke();
      ctx.restore();
      if (far) { /* body between the wings */
        ctx.fillStyle = red; ellipse(ctx, 0, -18, 15, 15); ctx.fill();
        ctx.fillStyle = cream; ellipse(ctx, 4, -14, 9, 10); ctx.fill();
        ctx.strokeStyle = '#e8b890'; ctx.lineWidth = 1; for (let y = -20; y < -6; y += 4) { ctx.beginPath(); ctx.moveTo(-2, y); ctx.quadraticCurveTo(4, y + 2, 10, y); ctx.stroke(); }
        ctx.fillStyle = dk; ellipse(ctx, -6, -3, 6, 3.5); ctx.fill(); ellipse(ctx, 7, -3, 6, 3.5); ctx.fill();
        for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-14 + i * 5, -26 - i * 2); ctx.lineTo(-11 + i * 5, -36 - i * 1.5); ctx.lineTo(-8 + i * 5, -28 - i * 2); ctx.closePath(); ctx.fill(); }
      }
    }
    /* head */
    ctx.fillStyle = red; ellipse(ctx, 10, -32, 13, 11); ctx.fill();
    ctx.fillStyle = red; ellipse(ctx, 20, -28, 7, 5); ctx.fill();
    for (const hx of [4, 12]) { ctx.fillStyle = cream; ctx.beginPath(); ctx.moveTo(hx - 3, -40); ctx.lineTo(hx, -50); ctx.lineTo(hx + 3, -40); ctx.closePath(); ctx.fill(); }
    eyePair(ctx, 12, -34, 4.5, 2.2, blink, '#2a6a3a');
    ctx.fillStyle = dk; circle(ctx, 25, -30, 1.3); ctx.fill(); circle(ctx, 25, -26.5, 1.3); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(16, -24); ctx.quadraticCurveTo(21, -21 + hic * 3, 25, -24); ctx.stroke();
    if (hic > 0) { ctx.strokeStyle = `rgba(150,150,170,${hic})`; ctx.lineWidth = 2; circle(ctx, 30, -30 - (1 - hic) * 20, 4 + (1 - hic) * 6); ctx.stroke(); }
    ctx.restore();
  }
  function drawButterfly(ctx, o) {
    const s = o.s || 1, flap = o.flap || 0, col = o.col || '#ff9ad4', col2 = o.col2 || '#ffd23f';
    ctx.save(); ctx.scale(s, s);
    const k = .35 + .65 * Math.abs(Math.cos(flap));
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.scale(1, 1);
      ctx.fillStyle = col; ellipse(ctx, sd * 6 * k, -4, 6.5 * k, 5.5, sd * .5); ctx.fill();
      ctx.fillStyle = col2; ellipse(ctx, sd * 5 * k, 3, 4.5 * k, 3.8, -sd * .4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(ctx, sd * 7 * k, -5, 1.6); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#4a3050'; ellipse(ctx, 0, 0, 1.3, 6); ctx.fill();
    ctx.strokeStyle = '#4a3050'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-3, -10); ctx.moveTo(0, -5); ctx.lineTo(3, -10); ctx.stroke();
    ctx.restore();
  }
  function drawBird(ctx, o) {
    const s = o.s || 1, flap = o.flap || 0, col = o.col || '#5ab0ff';
    ctx.save(); ctx.scale(s, s);
    const w = Math.sin(flap) * 6;
    ctx.fillStyle = col; ellipse(ctx, 0, 0, 6, 3.5); ctx.fill(); circle(ctx, 5, -1.5, 2.8); ctx.fill();
    ctx.fillStyle = shade(col, .8); ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-9, -6 - w); ctx.lineTo(-11, -2 - w * .5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-9, 6 + w); ctx.lineTo(-11, 2 + w * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(7.5, -1.5); ctx.lineTo(10.5, -.8); ctx.lineTo(7.5, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     THE LAND
     ============================================================ */
  /* season = { snow, autumn, blossom } each 0..1 */
  const AUTUMN = ['#e8843a', '#f0b43a', '#d9533a'];
  function drawTree(ctx, tr, time, night, season) {
    const S = season || { snow: 0, autumn: 0, blossom: 0 };
    const s = tr.s, sway = Math.sin(time * .7 + tr.ph) * .012;
    ctx.save(); ctx.scale(s, s); ctx.rotate(sway);
    const rng = mulberry32(tr.seed);
    const snowCol = '#f6f9ff';
    if (tr.kind === 'pine') {
      ctx.fillStyle = '#6a4a30'; ctx.fillRect(-5, -30, 10, 32);
      for (let i = 0; i < 4; i++) {
        const y = -30 - i * 38, w = 62 - i * 12;
        ctx.fillStyle = i % 2 ? '#3f8a4a' : '#4a9c58'; ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y - 52); ctx.lineTo(w, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(-w * .2, y - 10); ctx.lineTo(0, y - 52); ctx.lineTo(w * .6, y); ctx.closePath(); ctx.fill();
        if (S.snow > .05) { ctx.globalAlpha = S.snow; ctx.fillStyle = snowCol; ctx.beginPath(); ctx.moveTo(-w * .55, y - 18); ctx.lineTo(0, y - 52); ctx.lineTo(w * .55, y - 18); ctx.quadraticCurveTo(w * .25, y - 10, 0, y - 20); ctx.quadraticCurveTo(-w * .25, y - 10, -w * .55, y - 18); ctx.fill(); ctx.globalAlpha = 1; }
      }
    } else if (tr.kind === 'willow') {
      ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-4, -80, 6, -150); ctx.lineTo(16, -150); ctx.quadraticCurveTo(8, -80, 9, 0); ctx.closePath(); ctx.fill();
      const leaf = mixHex(mixHex('#7fb85a', '#e8c04a', S.autumn), '#e8f0f6', S.snow * .8);
      ctx.fillStyle = leaf; ellipse(ctx, 8, -160, 70, 40); ctx.fill();
      ctx.strokeStyle = mixHex(mixHex('#8fc86a', '#f0d05a', S.autumn), '#eef4f8', S.snow * .8); ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) { const x = -60 + i * 8.5 + (rng() - .5) * 6; ctx.beginPath(); ctx.moveTo(x, -150); ctx.quadraticCurveTo(x - 6 + Math.sin(time + i) * 4, -90, x - 10 + Math.sin(time * 1.3 + i) * 6, -20 - rng() * 30 - S.snow * 40); ctx.stroke(); }
      if (S.snow > .05) { ctx.globalAlpha = S.snow; ctx.fillStyle = snowCol; ellipse(ctx, 8, -186, 56, 16); ctx.fill(); ctx.globalAlpha = 1; }
    } else {
      const big = tr.kind === 'bigoak';
      const h = big ? 250 : 140, tw = big ? 26 : 12;
      ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(-tw * 1.6, 0); ctx.quadraticCurveTo(-tw, -h * .4, -tw * .7, -h); ctx.lineTo(tw * .7, -h); ctx.quadraticCurveTo(tw, -h * .4, tw * 1.6, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-tw * .3, -10); ctx.quadraticCurveTo(-tw * .2, -h * .5, 0, -h * .8); ctx.stroke();
      if (big) { ctx.fillStyle = '#3a2418'; ellipse(ctx, 0, -70, 12, 18); ctx.fill(); }
      if (tr.kind === 'birch') { ctx.fillStyle = '#e8e4d8'; ctx.fillRect(-tw * .9, -h, tw * 1.8, h); ctx.fillStyle = '#3a3a3a'; for (let i = 0; i < 6; i++) { ctx.fillRect(-tw * .9 + rng() * tw * .8, -h * rng(), tw * .8, 3); } }
      let cols = tr.kind === 'blossom' ? ['#ffb3d0', '#ff9fc4', '#ffc9de'] : tr.kind === 'birch' ? ['#a8d86a', '#8fc85a', '#b8e07a'] : tr.kind === 'apple' ? ['#3f9a3a', '#4fae44', '#5fbf4a'] : ['#4f9a3a', '#5aae44', '#6fc250'];
      if (S.autumn > 0) cols = cols.map((c, i) => mixHex(c, AUTUMN[i], S.autumn * (tr.kind === 'blossom' ? .5 : 1)));
      if (S.snow > 0) cols = cols.map(c => mixHex(c, '#e6eef6', S.snow * .55));
      const n = big ? 9 : 5;
      const puffs = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + rng() * .5, rad = (big ? 90 : 46) * (.6 + rng() * .5), r = (big ? 80 : 44) * (.7 + rng() * .5);
        puffs.push([Math.cos(a) * rad, -h - 20 + Math.sin(a) * rad * .6, r, i]);
      }
      for (const [x, y, r, i] of puffs) {
        ctx.fillStyle = cols[i % 3]; circle(ctx, x, y, r); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)'; circle(ctx, x - r * .25, y - r * .3, r * .55); ctx.fill();
      }
      if (S.snow > .05) { ctx.globalAlpha = S.snow; ctx.fillStyle = snowCol; for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.ellipse(x, y - r * .55, r * .82, r * .42, 0, Math.PI, 0); ctx.fill(); } ctx.globalAlpha = 1; }
      if (tr.kind === 'blossom' || (S.blossom > .3 && tr.kind === 'oak')) { ctx.fillStyle = tr.kind === 'blossom' ? '#fff' : `rgba(255,190,220,${S.blossom})`; for (let i = 0; i < 16; i++) { circle(ctx, (rng() - .5) * (big ? 200 : 110), -h - 20 + (rng() - .5) * (big ? 120 : 70), tr.kind === 'blossom' ? 2.5 : 3.5); ctx.fill(); } }
      if (big && night > .3) { ctx.fillStyle = `rgba(255,240,150,${night * .8})`; ellipse(ctx, 0, -70, 5, 9); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawApple(ctx, r = 8) {
    ctx.fillStyle = '#e8403a'; circle(ctx, -r * .3, 0, r * .8); ctx.fill(); circle(ctx, r * .3, 0, r * .8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ellipse(ctx, -r * .4, -r * .3, r * .25, r * .35, -.4); ctx.fill();
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = r * .18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * .6); ctx.lineTo(r * .1, -r * 1.1); ctx.stroke();
    ctx.fillStyle = '#5aae44'; ellipse(ctx, r * .45, -r * .95, r * .45, r * .2, -.4); ctx.fill();
  }

  function drawSnowman(ctx, sm, time) {
    ctx.save(); ctx.scale(sm.s, sm.s);
    ctx.fillStyle = 'rgba(120,140,180,.25)'; ellipse(ctx, 0, 0, 34, 6); ctx.fill();
    for (const [y, r] of [[-26, 28], [-68, 21], [-100, 15]]) { const g = ctx.createRadialGradient(-r * .3, y - r * .3, r * .2, 0, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dde6f4'); ctx.fillStyle = g; circle(ctx, 0, y, r); ctx.fill(); }
    ctx.fillStyle = '#2a2a3a'; circle(ctx, -5, -104, 2.2); ctx.fill(); circle(ctx, 5, -104, 2.2); ctx.fill();
    for (const y of [-78, -66, -54]) { circle(ctx, 0, y, 2.2); ctx.fill(); }
    ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(0, -99); ctx.lineTo(16, -96); ctx.lineTo(0, -94); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -95, 6, .3, Math.PI - .3); ctx.stroke();
    ctx.fillStyle = sm.hat; rr(ctx, -13, -122, 26, 8, 3); ctx.fill(); rr(ctx, -9, -138, 18, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; circle(ctx, 0, -140, 4); ctx.fill();
    ctx.strokeStyle = sm.hat; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-14, -86); ctx.quadraticCurveTo(0, -80, 14, -86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -84); ctx.lineTo(14 + Math.sin(time * 2) * 2, -66); ctx.stroke();
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-19, -72); ctx.lineTo(-40, -86); ctx.moveTo(-32, -81); ctx.lineTo(-36, -92); ctx.moveTo(19, -72); ctx.lineTo(40, -88 + Math.sin(time * 3) * 3); ctx.stroke();
    ctx.restore();
  }

  function drawStable(ctx, home, time, night, foalName) {
    const paint = (HOME_PAINTS.find(p => p.key === home.paint) || HOME_PAINTS[0]).hex;
    const roof = (HOME_ROOFS.find(p => p.key === home.roof) || HOME_ROOFS[0]).hex;
    const has = (k) => home.items && home.items.includes(k);
    ctx.save();
    /* little garden */
    if (has('garden')) for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(-150 + i * 37 + (i > 4 ? 40 : 0), 0); drawFlower(ctx, { s: .9, kind: ['tulip', 'daisy', 'poppy'][i % 3], col: (i * .31) % 1, bloom: 1, ph: i, magicT: 0 }, time, 0); ctx.restore(); }
    /* walls */
    ctx.fillStyle = paint; rr(ctx, -120, -150, 240, 154, 6); ctx.fill();
    ctx.fillStyle = shade(paint, .88); for (let x = -110; x < 120; x += 22) ctx.fillRect(x, -146, 2, 148);
    /* roof */
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-144, -146); ctx.lineTo(0, -238); ctx.lineTo(144, -146); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(roof, .82); ctx.beginPath(); ctx.moveTo(-144, -146); ctx.lineTo(144, -146); ctx.lineTo(136, -136); ctx.lineTo(-136, -136); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(-144, -146); ctx.lineTo(0, -238); ctx.lineTo(-20, -226); ctx.lineTo(-120, -150); ctx.closePath(); ctx.fill();
    /* heart window in the gable */
    ctx.fillStyle = mixHex('#8fd0ff', '#ffe27a', night); heartPath(ctx, 0, -188, 16); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; heartPath(ctx, 0, -188, 16); ctx.stroke();
    /* big arched doorway with hay inside */
    ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.moveTo(-54, 4); ctx.lineTo(-54, -80); ctx.arc(0, -80, 54, Math.PI, 0); ctx.lineTo(54, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0c85a'; ellipse(ctx, 0, -6, 44, 14); ctx.fill(); ctx.fillStyle = '#e0b040'; for (let i = 0; i < 9; i++) { ctx.fillRect(-36 + i * 8, -18 + (i % 2) * 3, 1.5, 12); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-54, 4); ctx.lineTo(-54, -80); ctx.arc(0, -80, 54, Math.PI, 0); ctx.lineTo(54, 4); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-54, -40); ctx.lineTo(54, -40); ctx.stroke();
    /* sign with the foal's name */
    ctx.fillStyle = '#fff5e0'; rr(ctx, -62, -140, 124, 30, 10); ctx.fill(); ctx.strokeStyle = '#c99a6a'; ctx.lineWidth = 2; rr(ctx, -62, -140, 124, 30, 10); ctx.stroke();
    ctx.fillStyle = '#6a3a5a'; ctx.font = `900 17px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(foalName ? foalName + "'s Stable" : 'Starlight Stable', 0, -124);
    /* side windows */
    for (const x of [-92, 92]) { ctx.fillStyle = mixHex('#bfe8ff', '#ffe27a', night); rr(ctx, x - 16, -104, 32, 32, 6); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rr(ctx, x - 16, -104, 32, 32, 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, -104); ctx.lineTo(x, -72); ctx.moveTo(x - 16, -88); ctx.lineTo(x + 16, -88); ctx.stroke(); }
    if (has('flowerbox')) for (const x of [-92, 92]) { ctx.fillStyle = '#b07a4a'; rr(ctx, x - 20, -72, 40, 10, 3); ctx.fill(); for (let i = 0; i < 5; i++) daisyHead(ctx, x - 16 + i * 8, -75, 3.4, ['#ff6fa8', '#ffd23f', '#fff', '#c98bff', '#ff8a4a'][i]); }
    if (has('bunting')) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-120, -150); ctx.quadraticCurveTo(0, -120, 120, -150); ctx.stroke(); for (let i = 0; i < 11; i++) { const t = (i + .5) / 11, x = lerp(-120, 120, t), y = -150 + Math.sin(t * Math.PI) * 15; ctx.fillStyle = RAINBOW[i % 7]; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 14 + Math.sin(time * 3 + i) * 1.5); ctx.closePath(); ctx.fill(); } }
    if (has('lanterns')) for (const x of [-70, 70]) { ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -84); ctx.lineTo(x, -70); ctx.stroke(); ctx.fillStyle = '#ffd24a'; rr(ctx, x - 7, -70, 14, 18, 4); ctx.fill(); if (night > .2) { const g = ctx.createRadialGradient(x, -61, 2, x, -61, 40); g.addColorStop(0, `rgba(255,220,120,${.7 * night})`); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; circle(ctx, x, -61, 40); ctx.fill(); } }
    if (has('fairylights')) { for (let i = 0; i < 18; i++) { const t = i / 17, x = lerp(-140, 140, t), y = -144 - (1 - Math.abs(t - .5) * 2) * 92 + 6; ctx.fillStyle = [ '#ff8fb8', '#ffe27a', '#8fe3ff', '#c9a5ff'][i % 4]; ctx.globalAlpha = .6 + .4 * Math.sin(time * 3 + i); circle(ctx, x, y, 3.2); ctx.fill(); } ctx.globalAlpha = 1; }
    if (has('wreath')) { ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 6; circle(ctx, 0, -64, 14); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.fillStyle = '#ffe14a'; starPath(ctx, Math.cos(a) * 14, -64 + Math.sin(a) * 14, 3.5); ctx.fill(); } }
    if (has('weathervane')) { ctx.strokeStyle = '#c99a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -238); ctx.lineTo(0, -272); ctx.stroke(); ctx.save(); ctx.translate(0, -278); ctx.rotate(Math.sin(time * .5) * .3); ctx.scale(.28, .28); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-40, 10); ctx.quadraticCurveTo(-30, -20, 10, -18); ctx.lineTo(30, -40); ctx.lineTo(28, -14); ctx.quadraticCurveTo(44, -8, 40, 6); ctx.lineTo(20, 4); ctx.lineTo(18, 24); ctx.lineTo(6, 24); ctx.lineTo(4, 8); ctx.lineTo(-22, 10); ctx.lineTo(-26, 26); ctx.lineTo(-38, 26); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (has('mailbox')) { ctx.fillStyle = '#6a4a30'; ctx.fillRect(166, -40, 5, 44); ctx.fillStyle = '#ff6fa8'; rr(ctx, 152, -58, 34, 20, 8); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.fillRect(184, -60, 3, 12); ctx.fillStyle = '#fff'; heartPath(ctx, 169, -48, 5); ctx.fill(); }
    if (has('trough')) { ctx.fillStyle = '#8a6a4a'; rr(ctx, -206, -24, 64, 24, 4); ctx.fill(); ctx.fillStyle = '#e8403a'; for (let i = 0; i < 4; i++) { circle(ctx, -196 + i * 14, -26, 6); ctx.fill(); } }
    ctx.restore();
  }

  function drawRaceArch(ctx, time, active) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = RAINBOW[i]; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 118 - i * 7, Math.PI, 0); ctx.stroke(); }
    for (const x of [-120, 120]) { ctx.fillStyle = '#fff'; rr(ctx, x - 8, -4, 16, 8, 3); ctx.fill(); }
    /* checkered banner */
    ctx.save(); ctx.translate(0, -132);
    rr(ctx, -64, -18, 128, 36, 8); ctx.fillStyle = '#fff'; ctx.fill(); ctx.save(); rr(ctx, -64, -18, 128, 36, 8); ctx.clip();
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) { ctx.fillStyle = '#3a2a55'; ctx.fillRect(-64 + i * 8, j ? 10 : -18, 8, 8); }
    ctx.restore();
    ctx.fillStyle = '#ff5f9a'; ctx.font = `900 16px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RACE!', 0, 1);
    ctx.restore();
    for (const x of [-120, 120]) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, -44); ctx.stroke(); ctx.fillStyle = '#ff5f9a'; ctx.beginPath(); ctx.moveTo(x, -44); ctx.lineTo(x + 18 + Math.sin(time * 4 + x) * 3, -38); ctx.lineTo(x, -32); ctx.closePath(); ctx.fill(); }
    if (active) { ctx.globalAlpha = .6 + .4 * Math.sin(time * 6); ctx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { const a = Math.PI + i / 7 * Math.PI; starPath(ctx, Math.cos(a) * 120, Math.sin(a) * 120, 5); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawMermaid(ctx, o) {
    const s = o.s || 1, t = o.time || 0, blink = o.blink || 0;
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * 2) * .12;
    /* tail */
    ctx.save(); ctx.rotate(sw * .5);
    const tg = ctx.createLinearGradient(-10, -40, 20, 10); tg.addColorStop(0, '#5fd6d0'); tg.addColorStop(1, '#b08cff');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-10, -44); ctx.quadraticCurveTo(-18, -10, 4, 0); ctx.quadraticCurveTo(24, 6, 30, -6 + sw * 30); ctx.quadraticCurveTo(14, -4, 10, -18); ctx.quadraticCurveTo(10, -32, 10, -44); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-2 + i * 2, -36 + i * 7, 4, .2, Math.PI - .2); ctx.stroke(); }
    ctx.fillStyle = '#ff9ad4'; ctx.beginPath(); ctx.moveTo(28, -6 + sw * 30); ctx.quadraticCurveTo(40, -22 + sw * 30, 44, -12 + sw * 30); ctx.quadraticCurveTo(38, -6 + sw * 30, 44, 4 + sw * 30); ctx.quadraticCurveTo(38, 2 + sw * 30, 28, -6 + sw * 30); ctx.fill();
    ctx.restore();
    /* hair behind */
    ctx.fillStyle = '#b06cff'; ctx.beginPath(); ctx.moveTo(-10, -78); ctx.quadraticCurveTo(-26, -60 + Math.sin(t * 1.5) * 4, -18, -30 + Math.sin(t * 1.8) * 4); ctx.quadraticCurveTo(-4, -46, 6, -74); ctx.closePath(); ctx.fill();
    /* torso + arms */
    ctx.fillStyle = '#ffd9c2'; rr(ctx, -9, -60, 18, 20, 7); ctx.fill();
    ctx.strokeStyle = '#ffd9c2'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7, -56); ctx.lineTo(-16, -44 + Math.sin(t * 2) * 3); ctx.moveTo(7, -56); ctx.lineTo(16, -66 + Math.sin(t * 3) * 4); ctx.stroke();
    drawShellShape(ctx, -4, -52, 5, '#ff9ad4', 1); drawShellShape(ctx, 4, -52, 5, '#ff9ad4', 1);
    /* head */
    ctx.fillStyle = '#ffd9c2'; circle(ctx, 0, -72, 12); ctx.fill();
    ctx.fillStyle = '#b06cff'; ctx.beginPath(); ctx.arc(0, -74, 13, Math.PI * .95, Math.PI * 2.05); ctx.quadraticCurveTo(8, -78, 0, -80); ctx.quadraticCurveTo(-8, -76, -13, -72); ctx.fill();
    eyePair(ctx, 3, -71, 4.5, 1.8, blink, '#3a8a9a');
    ctx.fillStyle = 'rgba(255,120,160,.45)'; ellipse(ctx, 9, -66, 2.5, 1.5); ellipse(ctx, -3, -66, 2.5, 1.5); ctx.fill();
    ctx.strokeStyle = '#c0526e'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(3, -66, 3, .3, Math.PI - .3); ctx.stroke();
    drawShellShape(ctx, -6, -86, 4, '#fff1d6', 1);
    ctx.restore();
  }

  function drawSeaweed(ctx, sw, time) {
    ctx.strokeStyle = sw.col; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let i = 1; i <= 8; i++) { const t = i / 8; ctx.lineTo(Math.sin(time * 1.3 + sw.ph + t * 4) * 10 * t, -sw.h * t); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2; ctx.stroke();
  }
  function drawCoral(ctx, c) {
    ctx.save(); ctx.scale(c.s, c.s);
    ctx.fillStyle = c.col; ctx.strokeStyle = c.col; ctx.lineCap = 'round';
    if (c.kind === 'fan') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, -4, 34, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = shade(c.col, .75); ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const a = Math.PI * 1.1 + i / 6 * Math.PI * .8; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(Math.cos(a) * 32, -4 + Math.sin(a) * 32); ctx.stroke(); } }
    else if (c.kind === 'branch') { ctx.lineWidth = 6; const br = (x, y, a, l, d) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); if (d < 3) { br(x2, y2, a - .5, l * .72, d + 1); br(x2, y2, a + .45, l * .7, d + 1); } else { circle(ctx, x2, y2, 3.5); ctx.fill(); } }; br(0, 0, -Math.PI / 2, 22, 0); }
    else { ellipse(ctx, 0, -12, 22, 14); ctx.fill(); ctx.strokeStyle = shade(c.col, .75); ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, -12, 18 - i * 4, 10 - i * 2.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); } }
    ctx.restore();
  }
  function drawShell(ctx, sh, time) {
    const open = sh.state === 'open' || sh.state === 'taken' ? (sh.state === 'open' ? sh.t : 1) : 0;
    ctx.save();
    ctx.fillStyle = shade(sh.col, .85); ellipse(ctx, 0, 0, 20, 6); ctx.fill();
    if (open > 0 && sh.state === 'open') { const g = ctx.createRadialGradient(0, -6, 1, 0, -6, 26); g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; circle(ctx, 0, -6, 26); ctx.fill(); ctx.fillStyle = '#fffaf0'; circle(ctx, 0, -5, 6); ctx.fill(); ctx.fillStyle = 'rgba(200,220,255,.8)'; circle(ctx, -2, -7, 2); ctx.fill(); }
    ctx.save(); ctx.translate(-18, -2); ctx.rotate(-open * .9); ctx.translate(18, 2);
    drawShellShape(ctx, 0, -2, 20, sh.col, 1);
    ctx.restore();
    if (sh.state === 'closed') { const tw = .5 + .5 * Math.sin(time * 3 + sh.i); ctx.fillStyle = `rgba(255,255,255,${tw})`; starPath(ctx, 14, -22, 4); ctx.fill(); }
    ctx.restore();
  }
  function drawChest(ctx, ch, time) {
    ctx.save();
    ctx.fillStyle = '#8a5a3a'; rr(ctx, -30, -30, 60, 30, 5); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(-30, -20, 60, 4); ctx.fillRect(-4, -30, 8, 30);
    ctx.save(); ctx.translate(-30, -30); ctx.rotate(-ch.open * 1.1);
    ctx.fillStyle = '#9a6a42'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.quadraticCurveTo(30, -26, 60, -8); ctx.lineTo(60, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (ch.open > .2) { for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ffd24a', '#ff8fd0', '#8fe3ff', '#ffd24a', '#c9a5ff'][i]; circle(ctx, -18 + i * 9, -32 - (i % 2) * 4, 5); ctx.fill(); } }
    ctx.restore();
  }
  function drawJelly(ctx, j, time) {
    ctx.save(); ctx.scale(j.s, j.s);
    const pulse = 1 + Math.sin(j.ph * 2) * .08;
    ctx.globalAlpha = .75;
    ctx.fillStyle = j.col; ctx.beginPath(); ctx.ellipse(0, 0, 18 * pulse, 14 / pulse, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ellipse(ctx, -6, -7, 5, 3); ctx.fill();
    ctx.strokeStyle = j.col; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const x = -12 + i * 6; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(j.ph * 2 + i) * 6, 14, x + Math.sin(j.ph * 1.5 + i) * 4, 28); ctx.stroke(); }
    ctx.fillStyle = '#3a2a55'; circle(ctx, -5, -4, 1.4); ctx.fill(); circle(ctx, 5, -4, 1.4); ctx.fill();
    ctx.restore();
  }
  function drawSwimFish(ctx, col, t) {
    const w = Math.sin(t * 10) * .25;
    ctx.fillStyle = col; ellipse(ctx, 0, 0, 12, 6.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-19, -7 + w * 8); ctx.lineTo(-19, 7 + w * 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ellipse(ctx, 2, -2.5, 6, 2); ctx.fill();
    ctx.fillStyle = '#fff'; circle(ctx, 6, -1.5, 2.4); ctx.fill(); ctx.fillStyle = '#1a1030'; circle(ctx, 6.6, -1.5, 1.3); ctx.fill();
  }
  /* a floating letter bubble for the letter hunt */
  function drawLetterBubble(ctx, ch, r, time, next, done) {
    const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.7, next ? 'rgba(255,240,170,.75)' : 'rgba(200,230,255,.6)'); g.addColorStop(1, next ? 'rgba(255,200,80,.9)' : 'rgba(150,190,255,.8)');
    ctx.fillStyle = g; circle(ctx, 0, 0, r * (next ? 1 + .06 * Math.sin(time * 6) : 1)); ctx.fill();
    ctx.strokeStyle = done ? '#7fe0c8' : next ? '#ffb02e' : 'rgba(120,150,220,.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#3a2a55'; ctx.font = `900 ${Math.round(r * 1.25)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, r * .06);
  }

  function drawFlower(ctx, f, time, nightClose) {
    const s = f.s, bloom = clamp(f.bloom * (1 - nightClose * .8) + (f.magicT > 0 ? .9 : 0), 0, 1);
    const sway = Math.sin(time * 1.6 + f.ph) * .07;
    ctx.save(); ctx.scale(s, s); ctx.rotate(sway);
    const h = f.kind === 'sunflower' ? 46 : f.kind === 'bluebell' ? 26 : 30;
    ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(2, -h * .5, 0, -h); ctx.stroke();
    ctx.fillStyle = '#5aae44'; ellipse(ctx, -5, -h * .4, 6, 2.5, -.6); ctx.fill(); ellipse(ctx, 5, -h * .55, 6, 2.5, .6); ctx.fill();
    ctx.translate(0, -h);
    const hue = f.col;
    switch (f.kind) {
      case 'daisy': {
        const pc = hue < .5 ? '#ffffff' : hue < .8 ? '#ffd6e8' : '#ffe9a8';
        const open = lerp(.15, 1, bloom);
        ctx.fillStyle = pc;
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ellipse(ctx, Math.cos(a) * 6 * open, Math.sin(a) * 6 * open - 2, 4.5 * open + .5, 2.6, a); ctx.fill(); }
        ctx.fillStyle = bloom > .5 ? '#ffc93a' : '#8fc85a'; circle(ctx, 0, -2, 3.2); ctx.fill();
        break;
      }
      case 'tulip': {
        const pc = hue < .33 ? '#ff5a7a' : hue < .66 ? '#ffb02e' : '#c98bff';
        const open = lerp(0, 1, bloom);
        ctx.fillStyle = pc;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-8 - open * 3, -12, -4 - open * 4, -16 - open * 2); ctx.quadraticCurveTo(0, -8 + open * 4, 4 + open * 4, -16 - open * 2); ctx.quadraticCurveTo(8 + open * 3, -12, 6, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(pc, .85); ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, -15 - open * 3); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'bluebell': {
        ctx.fillStyle = hue < .5 ? '#7a8bff' : '#a58bff';
        for (let i = 0; i < 3; i++) { const y = -i * 7, x = (i % 2 ? -1 : 1) * 4; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 5, y - 6 * bloom - 2, x, y - 8 * bloom - 3); ctx.quadraticCurveTo(x + 5, y - 6 * bloom - 2, x + 4, y); ctx.quadraticCurveTo(x, y + 2 * bloom, x - 4, y); ctx.fill(); }
        break;
      }
      case 'sunflower': {
        const open = lerp(.2, 1, bloom);
        ctx.fillStyle = '#ffc93a';
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ellipse(ctx, Math.cos(a) * 11 * open, Math.sin(a) * 11 * open - 4, 7 * open + 1, 3.2, a); ctx.fill(); }
        ctx.fillStyle = '#6a4020'; circle(ctx, 0, -4, 7.5 * open + 1); ctx.fill();
        ctx.fillStyle = '#8a5a30'; circle(ctx, -2, -6, 3 * open); ctx.fill();
        break;
      }
      default: { /* poppy */
        const open = lerp(.1, 1, bloom);
        ctx.fillStyle = hue < .7 ? '#ff4d4d' : '#ff8a3a';
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; ellipse(ctx, Math.cos(a) * 5 * open, Math.sin(a) * 5 * open - 3, 6 * open + .8, 5 * open + .8, a); ctx.fill(); }
        ctx.fillStyle = '#2a1a2a'; circle(ctx, 0, -3, 2.5 * open); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawCrystal(ctx, c, time, night) {
    const s = c.s, lit = c.lit, glow = Math.max(lit, night * .35);
    ctx.save(); ctx.scale(s, s);
    if (glow > .02) {
      const g = ctx.createRadialGradient(0, -22, 4, 0, -22, 70 * glow + 20);
      g.addColorStop(0, withAlpha(c.col, .55 * glow)); g.addColorStop(1, withAlpha(c.col, 0));
      ctx.fillStyle = g; circle(ctx, 0, -22, 70 * glow + 20); ctx.fill();
    }
    const prisms = [[-12, 0, 8, 26, -.25], [10, 0, 7, 22, .3], [0, 0, 10, 44, 0], [-4, 0, 5, 18, -.5]];
    for (const [x, y, w, h, rot] of prisms) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * .8, -h * .8); ctx.lineTo(0, -h); ctx.lineTo(w * .8, -h * .8); ctx.lineTo(w, 0); ctx.closePath();
      const g = ctx.createLinearGradient(-w, 0, w, -h);
      g.addColorStop(0, mixHex(c.col, '#ffffff', .1 + lit * .3)); g.addColorStop(.5, mixHex(c.col, '#ffffff', .55 + lit * .3)); g.addColorStop(1, mixHex(c.col, '#ffffff', .2 + lit * .3));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = shade(c.col, .7, .6); ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-w * .5, -h * .2); ctx.lineTo(-w * .2, -h * .85); ctx.stroke();
      ctx.restore();
    }
    if (lit > .5) for (let i = 0; i < 3; i++) { const t = (time * 1.5 + i * .33) % 1; ctx.fillStyle = `rgba(255,255,255,${(1 - t) * lit})`; starPath(ctx, -14 + i * 14, -30 - t * 30, 3); ctx.fill(); }
    ctx.restore();
  }

  function drawMushroom(ctx, m) {
    ctx.save(); ctx.scale(m.s, m.s);
    ctx.fillStyle = '#f3e6cc'; rr(ctx, -4, -14, 8, 15, 3); ctx.fill();
    ctx.fillStyle = m.red ? '#e8453c' : '#c9a066'; ctx.beginPath(); ctx.arc(0, -14, 12, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; for (const [x, y] of [[-5, -18], [3, -21], [7, -16]]) { circle(ctx, x, y, 2); ctx.fill(); }
    ctx.restore();
  }
  function drawRock(ctx, r) {
    ctx.save();
    ctx.fillStyle = '#8a8fa0'; ellipse(ctx, 0, 0, r.w / 2, r.h); ctx.fill();
    ctx.fillStyle = '#a5aabb'; ellipse(ctx, -r.w * .12, -r.h * .3, r.w * .32, r.h * .5); ctx.fill();
    ctx.fillStyle = 'rgba(90,150,80,.5)'; ellipse(ctx, r.w * .2, -r.h * .6, r.w * .18, r.h * .2); ctx.fill();
    ctx.restore();
  }
  function drawReed(ctx, rd, time) {
    const sway = Math.sin(time * 1.4 + rd.ph) * 5;
    ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * .4, -rd.h * .5, sway, -rd.h); ctx.stroke();
    ctx.fillStyle = '#7a5a3a'; ellipse(ctx, sway, -rd.h + 4, 3, 8); ctx.fill();
  }
  function drawLilyPad(ctx, p, time) {
    const bob = Math.sin(time * 1.2 + p.ph) * 1.5;
    ctx.save(); ctx.translate(0, bob);
    ctx.fillStyle = '#4f9a3a'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .42, 0, .3, TAU - .3); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.ellipse(-p.r * .2, -p.r * .1, p.r * .5, p.r * .18, 0, 0, TAU); ctx.fill();
    if (p.flower) { ctx.fillStyle = '#ffb3d0'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ellipse(ctx, p.r * .35 + Math.cos(a) * 5, -6 + Math.sin(a) * 3, 5, 2.4, a); ctx.fill(); } ctx.fillStyle = '#ffd23f'; circle(ctx, p.r * .35, -6, 2.6); ctx.fill(); }
    ctx.restore();
  }

  /* collectible star with glow, at the origin */
  function drawStar(ctx, r, time, ph, col = '#ffe14a') {
    const tw = .75 + .25 * Math.sin(time * 4 + ph);
    const g = ctx.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.6);
    g.addColorStop(0, withAlpha(col, .55 * tw)); g.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = g; circle(ctx, 0, 0, r * 2.6); ctx.fill();
    ctx.save(); ctx.rotate(Math.sin(time * 1.5 + ph) * .25);
    starPath(ctx, 0, 0, r); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = shade(col, .8); ctx.lineWidth = 1; ctx.stroke();
    starPath(ctx, -r * .15, -r * .18, r * .5); ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fill();
    ctx.restore();
  }
  function drawGem(ctx, col, r, time, ph) {
    ctx.save(); ctx.translate(0, Math.sin(time * 2 + ph) * 3);
    const g = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 2.4);
    g.addColorStop(0, withAlpha(col, .5)); g.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = g; circle(ctx, 0, 0, r * 2.4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r, -r * .25); ctx.lineTo(-r * .55, -r * .8); ctx.lineTo(r * .55, -r * .8); ctx.lineTo(r, -r * .25); ctx.lineTo(0, r); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = shade(col, .6); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-r * .55, -r * .8); ctx.lineTo(r * .1, -r * .8); ctx.lineTo(-r * .5, -r * .25); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(-r, -r * .25); ctx.lineTo(r, -r * .25); ctx.moveTo(-r * .5, -r * .25); ctx.lineTo(0, r); ctx.moveTo(r * .5, -r * .25); ctx.lineTo(0, r); ctx.stroke();
    const t = (time * 1.2 + ph) % 1; ctx.fillStyle = `rgba(255,255,255,${1 - t})`; starPath(ctx, r * .6, -r * .9, 3 + t * 3); ctx.fill();
    ctx.restore();
  }
  /* a rainbow ring seen at a slight angle; `passed` fades it */
  function drawRing(ctx, ring, time) {
    const r = ring.r, k = ring.passed ? .35 : 1;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.lineWidth = r * .18;
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = RAINBOW[i]; ctx.beginPath(); ctx.ellipse(0, 0, (r - i * r * .04) * .3, r - i * r * .04, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = r * .045;
    }
    if (!ring.passed) for (let i = 0; i < 6; i++) { const a = time * 2 + i * TAU / 6; ctx.fillStyle = 'rgba(255,255,255,.8)'; starPath(ctx, Math.cos(a) * r * .3, Math.sin(a) * r, 3.5); ctx.fill(); }
    ctx.restore();
  }
  function drawCloudPlatform(ctx, c, time, night) {
    const rng = mulberry32(c.seed * 977);
    const w = c.w, h = c.h;
    ctx.save();
    const puffs = [];
    const n = Math.max(5, (w / 60) | 0);
    for (let i = 0; i < n; i++) { const t = (i + .5) / n; puffs.push([lerp(-w / 2 + 20, w / 2 - 20, t), 14 + Math.sin(t * Math.PI) * 6 + rng() * 6, 28 + rng() * 22 + Math.sin(t * Math.PI) * 18]); }
    const draw = (col, dy, sc) => { ctx.fillStyle = col; for (const [x, y, r] of puffs) { circle(ctx, x, y + dy, r * sc); ctx.fill(); } ctx.beginPath(); ctx.ellipse(0, h * .45 + dy, w / 2 - 6, h * .45 * sc, 0, 0, TAU); ctx.fill(); };
    draw(mixHex('#cfd8ea', '#7a86b0', night * .6), 8, 1.02);
    draw(mixHex('#ffffff', '#b8c4e8', night * .6), 0, 1);
    ctx.fillStyle = mixHex('#ffffff', '#d0daf5', night * .5); for (const [x, y, r] of puffs) { circle(ctx, x - r * .2, y - r * .35, r * .5); ctx.fill(); }
    ctx.restore();
  }
  function drawCloudCastle(ctx, c, time, night) {
    ctx.save();
    ctx.translate(0, 2);
    const tower = (x, w, h, col) => {
      ctx.fillStyle = col; rr(ctx, x - w / 2, -h, w, h + 4, 6); ctx.fill();
      ctx.fillStyle = '#ff9ad4'; ctx.beginPath(); ctx.moveTo(x - w * .62, -h); ctx.lineTo(x, -h - w * 1.05); ctx.lineTo(x + w * .62, -h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x - w * .62, -h); ctx.lineTo(x, -h - w * 1.05); ctx.lineTo(x - w * .1, -h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -h - w * 1.05); ctx.lineTo(x, -h - w * 1.05 - 18); ctx.stroke();
      ctx.fillStyle = '#ff5f9a'; ctx.beginPath(); ctx.moveTo(x, -h - w * 1.05 - 18); ctx.lineTo(x + 14 + Math.sin(time * 4 + x) * 2, -h - w * 1.05 - 13); ctx.lineTo(x, -h - w * 1.05 - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7fd0ff'; for (let y = -h + 18; y < -14; y += 26) { rr(ctx, x - 6, y, 12, 16, 5); ctx.fill(); }
    };
    ctx.fillStyle = '#f6f1ff'; rr(ctx, -150, -110, 300, 116, 12); ctx.fill();
    tower(-120, 56, 150, '#efe6ff'); tower(120, 56, 150, '#efe6ff'); tower(0, 76, 210, '#fff');
    ctx.fillStyle = '#c9a5ff'; rr(ctx, -26, -60, 52, 66, 20); ctx.fill();
    ctx.fillStyle = '#ffd24a'; circle(ctx, 0, -78, 8); ctx.fill();
    ctx.fillStyle = '#7fd0ff'; for (const x of [-70, -40, 40, 70]) { rr(ctx, x - 7, -80, 14, 20, 6); ctx.fill(); }
    ctx.restore();
  }
  function drawCastle(ctx, castle, time, night) {
    ctx.save();
    const pink = '#ffd6ea', wall = '#fff5fa', roof = '#c98bff', roof2 = '#a56cf0';
    const tower = (x, w, h, big) => {
      ctx.fillStyle = wall; rr(ctx, x - w / 2, -h, w, h + 6, 8); ctx.fill();
      ctx.fillStyle = pink; for (let y = -h + 20; y < -20; y += 34) { rr(ctx, x - w / 2 + 4, y, w - 8, 6, 3); ctx.fill(); }
      ctx.fillStyle = big ? roof2 : roof; ctx.beginPath(); ctx.moveTo(x - w * .66, -h); ctx.lineTo(x, -h - w * 1.15); ctx.lineTo(x + w * .66, -h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(x - w * .66, -h); ctx.lineTo(x, -h - w * 1.15); ctx.lineTo(x - w * .05, -h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, -h - w * 1.15); ctx.lineTo(x, -h - w * 1.15 - 26); ctx.stroke();
      ctx.fillStyle = '#ff5f9a'; ctx.beginPath(); ctx.moveTo(x, -h - w * 1.15 - 26); ctx.lineTo(x + 22 + Math.sin(time * 3 + x) * 3, -h - w * 1.15 - 18); ctx.lineTo(x, -h - w * 1.15 - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mixHex('#7fd0ff', '#ffe27a', night); for (let y = -h + 30; y < -30; y += 44) { rr(ctx, x - 9, y, 18, 26, 8); ctx.fill(); }
    };
    ctx.fillStyle = wall; rr(ctx, -180, -170, 360, 176, 10); ctx.fill();
    ctx.fillStyle = pink; for (let x = -170; x < 170; x += 40) { rr(ctx, x, -186, 26, 22, 4); ctx.fill(); }
    tower(-200, 70, 230, false); tower(200, 70, 230, false); tower(-90, 60, 300, false); tower(90, 60, 300, false); tower(0, 96, 360, true);
    ctx.fillStyle = roof; rr(ctx, -44, -110, 88, 116, 40); ctx.fill();
    ctx.fillStyle = mixHex('#7a4aa0', '#ffe27a', night * .6); rr(ctx, -30, -96, 60, 102, 28); ctx.fill();
    ctx.fillStyle = '#ffd24a'; circle(ctx, 0, -120, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; starPath(ctx, 0, -120, 6); ctx.fill();
    ctx.fillStyle = '#ffb3d0'; for (const x of [-150, -130, 130, 150]) { rr(ctx, x - 6, -60, 12, 30, 5); ctx.fill(); }
    ctx.restore();
  }
  function drawCave(ctx, cave, time, night) {
    ctx.save();
    ctx.fillStyle = '#6f6a7a'; ctx.beginPath(); ctx.moveTo(-130, 6); ctx.quadraticCurveTo(-120, -150, 0, -160); ctx.quadraticCurveTo(120, -150, 130, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a5568'; ctx.beginPath(); ctx.moveTo(-100, 6); ctx.quadraticCurveTo(-90, -110, 0, -120); ctx.quadraticCurveTo(90, -110, 100, 6); ctx.closePath(); ctx.fill();
    const g = ctx.createRadialGradient(0, -40, 10, 0, -40, 90);
    g.addColorStop(0, '#2a1a30'); g.addColorStop(1, '#1a1020');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-70, 6); ctx.quadraticCurveTo(-64, -90, 0, -96); ctx.quadraticCurveTo(64, -90, 70, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,80,.25)'; ellipse(ctx, 0, -20, 40, 30); ctx.fill();
    ctx.fillStyle = '#7a8a6a'; for (const [x, y, r] of [[-110, -20, 18], [105, -30, 16], [-60, -120, 14]]) { circle(ctx, x, y, r); ctx.fill(); }
    ctx.restore();
  }
  function drawMoon(ctx, m, time) {
    ctx.save();
    const g = ctx.createRadialGradient(0, 0, m.r * .8, 0, 0, m.r * 2.2);
    g.addColorStop(0, 'rgba(255,250,210,.35)'); g.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = g; circle(ctx, 0, 0, m.r * 2.2); ctx.fill();
    const mg = ctx.createRadialGradient(-m.r * .35, -m.r * .35, m.r * .1, 0, 0, m.r);
    mg.addColorStop(0, '#fffbe6'); mg.addColorStop(.7, '#f3e9b8'); mg.addColorStop(1, '#cfc38a');
    ctx.fillStyle = mg; circle(ctx, 0, 0, m.r); ctx.fill();
    ctx.fillStyle = 'rgba(160,150,100,.35)';
    for (const [x, y, r] of [[-.4, -.1, .18], [.2, .3, .22], [.35, -.35, .12], [-.1, .55, .1], [-.55, .4, .09], [.55, .1, .08]]) { ellipse(ctx, x * m.r, y * m.r, r * m.r, r * m.r * .85); ctx.fill(); ctx.fillStyle = 'rgba(255,255,240,.25)'; ellipse(ctx, x * m.r - r * m.r * .3, y * m.r - r * m.r * .3, r * m.r * .5, r * m.r * .4); ctx.fill(); ctx.fillStyle = 'rgba(160,150,100,.35)'; }
    /* a little flag someone left */
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.r * .5, -m.r * .86); ctx.lineTo(m.r * .5, -m.r * .86 - 26); ctx.stroke();
    ctx.fillStyle = '#ff5f9a'; ctx.fillRect(m.r * .5, -m.r * .86 - 26, 16, 10);
    ctx.restore();
  }
  function drawStormCloud(ctx, c, time) {
    const happy = c.happy || 0, r = c.r;
    ctx.save();
    const col = mixHex('#6a6a86', '#ffffff', happy), col2 = mixHex('#8a8aa8', '#e6ecff', happy);
    const puffs = [[-r * .55, 0, r * .5], [-r * .1, -r * .35, r * .6], [r * .45, -r * .05, r * .5], [0, r * .2, r * .55]];
    ctx.fillStyle = col; for (const [x, y, rad] of puffs) { circle(ctx, x, y, rad); ctx.fill(); }
    ctx.fillStyle = col2; for (const [x, y, rad] of puffs) { circle(ctx, x - rad * .25, y - rad * .3, rad * .45); ctx.fill(); }
    /* face */
    const ex = -r * .15, ey = -r * .1;
    ctx.fillStyle = '#2a2a40';
    if (happy > .5) { ctx.strokeStyle = '#2a2a40'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(ex + sd * r * .22, ey, r * .08, Math.PI, 0); ctx.stroke(); } ctx.beginPath(); ctx.arc(ex, ey + r * .15, r * .18, .2, Math.PI - .2); ctx.stroke(); ctx.fillStyle = 'rgba(255,150,170,.5)'; for (const sd of [-1, 1]) { circle(ctx, ex + sd * r * .38, ey + r * .12, r * .07); ctx.fill(); } }
    else { for (const sd of [-1, 1]) { circle(ctx, ex + sd * r * .22, ey, r * .06); ctx.fill(); } ctx.strokeStyle = '#2a2a40'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ex + sd * r * .32, ey - r * .16); ctx.lineTo(ex + sd * r * .12, ey - r * .1); ctx.stroke(); } ctx.beginPath(); ctx.arc(ex, ey + r * .3, r * .15, Math.PI + .3, -.3); ctx.stroke(); }
    if (happy < .5) { ctx.strokeStyle = 'rgba(120,160,255,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const t = (time * 1.4 + i * .25) % 1; ctx.beginPath(); ctx.moveTo(-r * .5 + i * r * .33, r * .5 + t * 30); ctx.lineTo(-r * .53 + i * r * .33, r * .5 + t * 30 + 9); ctx.stroke(); } }
    ctx.restore();
  }
  function drawFallenStar(ctx, f, time) {
    const pulse = .7 + .3 * Math.sin(time * 3 + f.ph);
    ctx.save();
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60 * pulse);
    g.addColorStop(0, 'rgba(255,240,160,.7)'); g.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = g; circle(ctx, 0, 0, 60 * pulse); ctx.fill();
    ctx.rotate(f.state === 'rising' ? time * 2 : .5);
    starPath(ctx, 0, 0, 16); ctx.fillStyle = '#fff29a'; ctx.fill(); ctx.strokeStyle = '#e8b830'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#1a1030'; circle(ctx, -4, -2, 1.6); ctx.fill(); circle(ctx, 4, -2, 1.6); ctx.fill();
    ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 2, 3, f.state === 'rising' ? .2 : Math.PI + .3, f.state === 'rising' ? Math.PI - .2 : -.3, f.state !== 'rising'); ctx.stroke();
    ctx.restore();
  }

  /* ---------- HUD icons (cached canvases; use iconEl for the DOM) ---------- */
  const iconCache = new Map();
  function drawIconInto(ctx, kind, look, px) {
    ctx.save();
    ctx.translate(px / 2, px / 2);
    const s = px / 100;
    ctx.scale(s, s);
    switch (kind) {
      case 'alicorn': ctx.translate(-30, 30); ctx.scale(1.15, 1.15); drawAlicorn(ctx, { s: 1, look, blink: 0, time: 0 }); break;
      case 'portrait': ctx.translate(-58, 52); ctx.scale(1.5, 1.5); drawAlicorn(ctx, { s: 1, look, time: 0 }); break;
      case 'bunny': ctx.translate(-10, 32); ctx.scale(1.4, 1.4); drawBunny(ctx, { s: 1 }); break;
      case 'fox': ctx.translate(-4, 34); ctx.scale(1.3, 1.3); drawFox(ctx, { s: 1 }); break;
      case 'owl': ctx.translate(0, 40); ctx.scale(1.35, 1.35); drawOwl(ctx, { s: 1 }); break;
      case 'deer': ctx.translate(-6, 40); ctx.scale(1.15, 1.15); drawDeer(ctx, { s: 1 }); break;
      case 'frog': ctx.translate(0, 26); ctx.scale(1.9, 1.9); drawFrog(ctx, { s: 1 }); break;
      case 'swan': ctx.translate(-12, 34); ctx.scale(1.3, 1.3); drawSwan(ctx, { s: 1 }); break;
      case 'sheep': ctx.translate(-6, 32); ctx.scale(1.35, 1.35); drawSheep(ctx, { s: 1 }); break;
      case 'lamb': ctx.translate(-6, 32); ctx.scale(1.35, 1.35); drawSheep(ctx, { s: 1, lamb: true }); ctx.scale(1 / .6, 1 / .6); break;
      case 'dragon': ctx.translate(-6, 36); ctx.scale(1.3, 1.3); drawDragon(ctx, { s: 1 }); break;
      case 'star': drawStar(ctx, 34, 0, 0); break;
      case 'gem': drawGem(ctx, look && look.col || '#ff4d4d', 30, 0, 0); break;
      case 'flower': ctx.translate(0, 34); ctx.scale(1.6, 1.6); drawFlower(ctx, { s: 1, kind: 'tulip', col: .2, bloom: 1, ph: 0, magicT: 0 }, 0, 0); break;
      case 'crystal': ctx.translate(0, 34); ctx.scale(1.3, 1.3); drawCrystal(ctx, { s: 1, col: '#7fe0ff', lit: 1 }, 0, 0); break;
      case 'ring': ctx.scale(2.2, 1); drawRing(ctx, { r: 36, passed: false }, 0); break;
      case 'moon': drawMoon(ctx, { r: 36 }, 0); break;
      case 'cloud': ctx.translate(0, -8); drawCloudPlatform(ctx, { w: 96, h: 40, seed: 3 }, 0, 0); break;
      case 'stormcloud': drawStormCloud(ctx, { r: 34, happy: 0 }, 0); break;
      case 'party': for (let i = 0; i < 7; i++) { ctx.fillStyle = RAINBOW[i]; starPath(ctx, Math.cos(i / 7 * TAU) * 28, Math.sin(i / 7 * TAU) * 28, 9); ctx.fill(); } ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-26, 26); ctx.lineTo(-24, -2); ctx.lineTo(-10, -10); ctx.lineTo(0, -28); ctx.lineTo(10, -10); ctx.lineTo(24, -2); ctx.lineTo(26, 26); ctx.closePath(); ctx.fill(); break;
      case 'constellation': { const pts = [[-30, 20], [-12, 0], [8, 6], [24, -14], [4, -26]]; ctx.strokeStyle = 'rgba(200,220,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); for (const [x, y] of pts) { ctx.fillStyle = '#fff'; starPath(ctx, x, y, 7); ctx.fill(); } break; }
      case 'rainbow': ctx.lineWidth = 7; RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 22, 44 - i * 6, Math.PI, 0); ctx.stroke(); }); break;
      case 'map': ctx.fillStyle = '#f3e6c8'; rr(ctx, -36, -28, 72, 56, 6); ctx.fill(); ctx.fillStyle = '#79c352'; rr(ctx, -30, 0, 60, 22, 4); ctx.fill(); ctx.fillStyle = '#7fd0ff'; rr(ctx, 4, 2, 22, 16, 4); ctx.fill(); ctx.fillStyle = '#c98bff'; ctx.beginPath(); ctx.moveTo(-30, 2); ctx.lineTo(-18, -18); ctx.lineTo(-6, 2); ctx.fill(); ctx.fillStyle = '#ff5f9a'; starPath(ctx, 10, -12, 8); ctx.fill(); break;
      case 'wardrobe': bow(ctx, -14, -8, 16, '#ff6fa8'); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(4, 30); ctx.lineTo(6, 4); ctx.lineTo(18, 14); ctx.lineTo(26, -6); ctx.lineTo(34, 14); ctx.lineTo(44, 4); ctx.lineTo(44, 30); ctx.closePath(); ctx.fill(); break;
      case 'camera': ctx.fillStyle = '#5a4a7a'; rr(ctx, -34, -20, 68, 46, 10); ctx.fill(); ctx.fillRect(-16, -30, 26, 12); ctx.fillStyle = '#fff'; circle(ctx, 2, 3, 15); ctx.fill(); ctx.fillStyle = '#7fd0ff'; circle(ctx, 2, 3, 9); ctx.fill(); break;
      case 'book': ctx.fillStyle = '#c98bff'; rr(ctx, -30, -26, 60, 52, 6); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -24, -20, 48, 40, 3); ctx.fill(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; for (let y = -8; y <= 8; y += 8) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); } break;
      case 'heart': heartPath(ctx, 0, 0, 34); ctx.fillStyle = '#ff5f9a'; ctx.fill(); break;
      case 'bolt': drawMark(ctx, 'bolt', 36); break;
      case 'moonwalk': drawMoon(ctx, { r: 30 }, 0); ctx.translate(-14, -20); ctx.scale(.5, .5); drawAlicorn(ctx, { s: 1, look, time: 0 }); break;
      case 'sleep': ctx.translate(-10, 10); ctx.scale(.9, .9); drawAlicorn(ctx, { s: 1, look, time: 0, sit: 1, blink: 1, sleep: true }); ctx.fillStyle = '#fff'; ctx.font = '900 22px sans-serif'; ctx.fillText('z', 30, -50); ctx.font = '900 16px sans-serif'; ctx.fillText('z', 44, -64); break;
      case 'water': ctx.fillStyle = '#7fd0ff'; rr(ctx, -40, 4, 80, 30, 8); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-20 + i * 20, 12, 8, Math.PI, 0); ctx.stroke(); } ctx.translate(-8, -30); ctx.scale(.55, .55); drawAlicorn(ctx, { s: 1, look, time: 0 }); break;
      case 'butterfly': ctx.scale(3, 3); drawButterfly(ctx, { s: 1, flap: 0 }); break;
      case 'friends': ctx.translate(-30, 26); ctx.scale(.9, .9); drawBunny(ctx, { s: 1 }); ctx.translate(38, 0); drawFox(ctx, { s: .9 }); break;
      case 'fashion': ctx.translate(-30, 30); ctx.scale(1.15, 1.15); drawAlicorn(ctx, { s: 1, look: Object.assign({}, look, { wear: ['tiara', 'garland', 'scarf'] }), time: 0 }); break;
      case 'glitter': for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.fillStyle = RAINBOW[i % 7]; starPath(ctx, Math.cos(a) * 26, Math.sin(a) * 26, 8 + (i % 3) * 3); ctx.fill(); } break;
      case 'foal': ctx.translate(-14, 30); ctx.scale(1.2, 1.2); drawAlicorn(ctx, { s: .75, look, time: 0, baby: 1 }); break;
      case 'foalgrown': ctx.translate(-26, 30); ctx.scale(1.05, 1.05); drawAlicorn(ctx, { s: 1, look, time: 0, baby: 0, fly: 1, flap: 1.4 }); break;
      case 'mermaid': ctx.translate(-8, 40); ctx.scale(1.05, 1.05); drawMermaid(ctx, { s: 1, time: 0 }); break;
      case 'stable': ctx.translate(0, 34); ctx.scale(.3, .3); drawStable(ctx, { paint: 'pink', roof: 'lilac', items: ['bunting', 'flowerbox'] }, 0, 0, ''); break;
      case 'apple': ctx.scale(3.4, 3.4); drawApple(ctx, 8); break;
      case 'basket': ctx.fillStyle = '#c9915a'; ctx.beginPath(); ctx.moveTo(-30, -4); ctx.lineTo(30, -4); ctx.lineTo(22, 30); ctx.lineTo(-22, 30); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a06a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 24, Math.PI, 0); ctx.stroke(); for (const [x, y] of [[-14, -10], [0, -14], [14, -10]]) { ctx.save(); ctx.translate(x, y); ctx.scale(1.2, 1.2); drawApple(ctx, 8); ctx.restore(); } break;
      case 'salon': ctx.fillStyle = '#c9a5ff'; rr(ctx, -30, -8, 44, 14, 5); ctx.fill(); ctx.fillStyle = '#9b6cff'; for (let i = 0; i < 8; i++) ctx.fillRect(-28 + i * 5.2, 6, 3, 16); bow(ctx, 16, -18, 12, '#ff6fa8'); break;
      case 'paint': ctx.fillStyle = '#f3e6c8'; ctx.beginPath(); ctx.ellipse(-4, 4, 32, 24, -.2, 0, TAU); ctx.fill(); RAINBOW.slice(0, 6).forEach((c, i) => { ctx.fillStyle = c; circle(ctx, -24 + (i % 3) * 16, -6 + Math.floor(i / 3) * 16, 5.5); ctx.fill(); }); ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(32, -20); ctx.stroke(); ctx.fillStyle = '#ff5f9a'; ellipse(ctx, 34, -26, 4, 8, .45); ctx.fill(); break;
      case 'trophy': ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-20, -30); ctx.lineTo(20, -30); ctx.quadraticCurveTo(20, 4, 0, 8); ctx.quadraticCurveTo(-20, 4, -20, -30); ctx.fill(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-22, -18, 9, Math.PI * .5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(22, -18, 9, -Math.PI * .5, Math.PI * .5); ctx.stroke(); ctx.fillStyle = '#e8b830'; ctx.fillRect(-5, 8, 10, 12); rr(ctx, -18, 20, 36, 10, 3); ctx.fill(); ctx.fillStyle = '#fff'; starPath(ctx, 0, -14, 9); ctx.fill(); break;
      case 'letters': ['A', 'B', 'C'].forEach((ch, i) => { ctx.save(); ctx.translate(-24 + i * 24, i === 1 ? -10 : 8); drawLetterBubble(ctx, ch, 15, 0, i === 1, false); ctx.restore(); }); break;
      case 'counting': ctx.save(); ctx.translate(-14, 6); ctx.scale(2.4, 2.4); drawApple(ctx, 8); ctx.restore(); ctx.fillStyle = '#3a2a55'; ctx.font = `900 34px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('3', 24, -12); break;
      case 'snowman': ctx.translate(0, 44); ctx.scale(.62, .62); drawSnowman(ctx, { s: 1, hat: '#ff5f9a' }, 0); break;
      case 'shell': ctx.translate(0, 10); ctx.scale(1.8, 1.8); drawShell(ctx, { col: '#ffd6e8', state: 'open', t: 1, i: 0 }, 0); break;
      case 'skate': ctx.fillStyle = '#bfe8ff'; rr(ctx, -40, 16, 80, 16, 6); ctx.fill(); ctx.translate(-8, -4); ctx.scale(.62, .62); drawAlicorn(ctx, { s: 1, look, time: 0, skate: 1 }); break;
      case 'swim': ctx.fillStyle = '#3fa0e0'; rr(ctx, -44, -44, 88, 88, 18); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; for (const [x, y, r] of [[26, -26, 5], [30, -10, 3], [22, 4, 4]]) { circle(ctx, x, y, r); ctx.fill(); } ctx.translate(-10, 6); ctx.scale(.6, .6); drawAlicorn(ctx, { s: 1, look, time: 0, swim: 1 }); break;
      case 'mane-flowing': case 'mane-curly': case 'mane-braided': case 'mane-long': case 'mane-flowers': ctx.translate(-58, 52); ctx.scale(1.45, 1.45); drawAlicorn(ctx, { s: 1, look: Object.assign({}, look, { maneStyle: kind.slice(5), wear: [] }), time: 0 }); break;
      case 'tail-flowing': case 'tail-curly': case 'tail-braided': case 'tail-long': ctx.translate(34, 18); ctx.scale(.95, .95); drawAlicorn(ctx, { s: 1, look: Object.assign({}, look, { tailStyle: kind.slice(5), wear: [] }), time: 0 }); break;
      case 'twoplayer': ctx.translate(-42, 20); ctx.scale(.7, .7); drawAlicorn(ctx, { s: 1, look, time: 0 }); ctx.translate(60, 0); drawAlicorn(ctx, { s: 1, look: Object.assign({}, look, { body: 'sky', mane: ['blue'] }), time: 0 }); break;
      case 'stars3': for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-26 + i * 26, i % 2 ? 8 : -8); drawStar(ctx, 14, 0, i); ctx.restore(); } break;
      case 'flight': ctx.translate(-26, 26); ctx.scale(1.05, 1.05); drawAlicorn(ctx, { s: 1, look, time: 0, fly: 1, flap: 1.4 }); break;
      case 'gallop': ctx.translate(-26, 30); ctx.scale(1.05, 1.05); drawAlicorn(ctx, { s: 1, look, time: 0, walk: 1.2, gallop: 1 }); break;
      case 'dash': ctx.lineWidth = 6; RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-40, -18 + i * 6); ctx.quadraticCurveTo(-10, -22 + i * 6, 14, -8 + i * 6); ctx.stroke(); }); ctx.translate(12, 10); ctx.scale(.6, .6); drawAlicorn(ctx, { s: 1, look, time: 0, fly: 1, flap: 1 }); break;
      default: {
        /* accessory icon: the alicorn's head wearing it */
        const acc = ACCESSORIES.find(a => a.key === kind);
        if (acc && acc.slot === 'head') { ctx.translate(-58, 52); ctx.scale(1.45, 1.45); drawAlicorn(ctx, { s: 1, look: Object.assign({}, look, { wear: [acc.key] }), time: 0 }); }
        else if (acc) { const k = [6, 10, .74]; ctx.translate(k[0], k[1]); ctx.scale(k[2], k[2]); drawAlicorn(ctx, { s: 1, look: Object.assign({}, look, { wear: [acc.key] }), time: 0 }); }
        else if (MARKS.find(m => m.key === kind)) drawMark(ctx, kind, 34, '#ff7ab6', '#c9a5ff');
      }
    }
    ctx.restore();
  }
  function icon(kind, look, px, cacheKey) {
    const key = `${kind}|${px}|${cacheKey || (look ? JSON.stringify([look.body, look.mane, look.horn, look.eyes, look.wings, look.mark, look.wear, look.maneStyle, look.tailStyle, look.markImg ? look.markImg.length : 0]) : '')}`;
    let c = iconCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    drawIconInto(ctx, kind, look, px);
    iconCache.set(key, c);
    return c;
  }
  function iconEl(kind, look, px, cacheKey) {
    const src = icon(kind, look, px, cacheKey);
    const c = document.createElement('canvas');
    c.width = c.height = px * 2; c.style.width = c.style.height = px + 'px';
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
  function clearIcons() { iconCache.clear(); }

  return { drawAlicorn, drawMark, bow, drawBunny, drawFox, drawOwl, drawDeer, drawFrog, drawSwan, drawSheep, drawDragon, drawButterfly, drawBird,
    drawTree, drawFlower, drawCrystal, drawMushroom, drawRock, drawReed, drawLilyPad, drawStar, drawGem, drawRing, drawCloudPlatform, drawCloudCastle, drawCastle, drawCave, drawMoon, drawStormCloud, drawFallenStar,
    drawApple, drawSnowman, drawStable, drawRaceArch, drawMermaid, drawSeaweed, drawCoral, drawShell, drawShellShape, drawChest, drawJelly, drawSwimFish, drawLetterBubble, feetY, markImage,
    icon, iconEl, clearIcons, maneColours, bodyHex, maneHex, eyeHex, hornDef, rainbowGrad };
})();
