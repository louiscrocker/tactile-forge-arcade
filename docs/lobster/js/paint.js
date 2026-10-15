/* ============================================================
   paint.js — the painted sea (with the WebGL look, ?gfx=gl)
   ============================================================
     The same animals as sprites.js, with the same options and the
     same joints (so every pose, size, sex, colour form and moult
     stage still works), built the way an artist's rig is: painted
     parts mounted on bones.  A lobster is armour, not fur, so each
     part is painted per pixel: its outline is turned into a dome
     (a distance field), bumps are added for tubercles and grooves,
     the colour comes from a map of the real markings (the dark
     olive back, orange-brown and blue-black mottling, dark
     speckles, the cream underside, red-orange tips on the claws,
     legs and feelers), and the whole is lit with a glossy, wet
     highlight.  Each part is painted once and cached as an image:
       carapace · six tail plates · tail-fan blade · claw arm
       (merus, carpus) · crusher and cutter hands · their fingers ·
       leg segments · the egg mass   (+ darker far-side copies)
     Per frame the parts are only placed on the joints; feelers,
     eyes, mouthparts and swimmerets are drawn live on top.
     Painting happens on CPU canvases with a per-frame time budget;
     anything not painted yet is drawn the classic way meanwhile.
   ============================================================ */
'use strict';

const Painted = (function () {
  /* parts are painted on CPU canvases: thousands of tiny fills are far slower on a GPU-backed canvas */
  const SOFT = { willReadFrequently: true };
  const cache = new Map(), stat = { n: 0, ms: 0 };
  let budget = 10;
  function beginFrame(ms) { budget = ms || 10; }
  const canBake = () => budget > 0;
  const spent = (t0) => { budget -= performance.now() - t0; };
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ss = smoothstep;
  /* light from above, a little from the front and the left; the half-vector for the highlight */
  const LV = (() => { const l = Math.hypot(-.32, -.82, .6); return [-.32 / l, -.82 / l, .6 / l]; })();
  const HV = (() => { const x = LV[0], y = LV[1], z = LV[2] + 1, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();

  /* ---------- the shell painter ----------
     o: { paths: Path2D | [Path2D], res, round (dome radius, units), bumps: [[x, y, r, h]], grooves: [[[x, y]…], w, depth],
          color(x, y) → [r, g, b], spots: [[x, y, r, [r, g, b], a]], gloss, shine, amb, rim, post(g) } */
  function paintShell(x0, y0, x1, y1, o) {
    const t0 = performance.now(), RES = o.res || 4;
    const W = Math.max(2, Math.ceil((x1 - x0) * RES)), H = Math.max(2, Math.ceil((y1 - y0) * RES)), n = W * H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', SOFT);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    g.fillStyle = '#fff';
    for (const p of [].concat(o.paths)) g.fill(p);
    const id = g.getImageData(0, 0, W, H), D = id.data;
    /* distance to the edge (chamfer), then a dome over it */
    const dist = new Float32Array(n);
    for (let i = 0; i < n; i++) dist[i] = D[i * 4 + 3] > 127 ? 1e6 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!dist[i]) continue;
      let d = dist[i];
      d = Math.min(d, (x > 0 ? dist[i - 1] : 0) + 1, (y > 0 ? dist[i - W] : 0) + 1);
      d = Math.min(d, (x > 0 && y > 0 ? dist[i - W - 1] : 0) + 1.414, (x < W - 1 && y > 0 ? dist[i - W + 1] : 0) + 1.414);
      dist[i] = d;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!dist[i]) continue;
      let d = dist[i];
      d = Math.min(d, (x < W - 1 ? dist[i + 1] : 0) + 1, (y < H - 1 ? dist[i + W] : 0) + 1);
      d = Math.min(d, (x < W - 1 && y < H - 1 ? dist[i + W + 1] : 0) + 1.414, (x > 0 && y < H - 1 ? dist[i + W - 1] : 0) + 1.414);
      dist[i] = d;
    }
    const R = Math.max(1, (o.round || 3) * RES), hgt = new Float32Array(n);
    for (let i = 0; i < n; i++) if (dist[i]) { const t = 1 - Math.min(dist[i], R) / R; hgt[i] = R * Math.sqrt(1 - t * t); }
    /* the chamfer distance leaves creases along the middle of a shape: soften the dome before the bumps go on */
    {
      const r = Math.max(1, Math.round(R * .3)), tmp = new Float32Array(n);
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < H; y++) { let acc = 0; const row = y * W; for (let x = -r; x < W; x++) { if (x + r < W) acc += hgt[row + x + r]; if (x - r - 1 >= 0) acc -= hgt[row + x - r - 1]; if (x >= 0) tmp[row + x] = acc / (2 * r + 1); } }
        for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y < H; y++) { if (y + r < H) acc += tmp[(y + r) * W + x]; if (y - r - 1 >= 0) acc -= tmp[(y - r - 1) * W + x]; if (y >= 0) { const i = y * W + x; hgt[i] = dist[i] ? acc / (2 * r + 1) : 0; } } }
      }
    }
    const stamp = (bx, by, br, bh) => {
      const cx = (bx - x0) * RES, cy = (by - y0) * RES, r = Math.max(.8, br * RES), h = bh * RES;
      const xa = Math.max(0, (cx - r) | 0), xb = Math.min(W - 1, Math.ceil(cx + r)), ya = Math.max(0, (cy - r) | 0), yb = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { const q = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) / (r * r); if (q < 1) { const i = y * W + x; if (dist[i]) hgt[i] += h * (1 - q) * (1 - q); } }
    };
    if (o.bumps) for (const b of o.bumps) stamp(b[0], b[1], b[2], b[3]);
    if (o.grooves) for (const [pts, w, dep] of o.grooves) for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(L / (w * .35)));
      for (let j = 0; j < m; j++) { const t = j / m; stamp(ax + (bx - ax) * t, ay + (by - ay) * t, w, -dep / 2.2); }
    }
    /* the colour map, then spots stamped into it */
    const alb = new Float32Array(n * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!dist[i]) continue;
      const col = o.color(x0 + (x + .5) / RES, y0 + (y + .5) / RES);
      alb[i * 3] = col[0]; alb[i * 3 + 1] = col[1]; alb[i * 3 + 2] = col[2];
    }
    if (o.spots) for (const [sx, sy, sr, sc, sa] of o.spots) {
      const cx = (sx - x0) * RES, cy = (sy - y0) * RES, r = Math.max(.7, sr * RES);
      const xa = Math.max(0, (cx - r - 1) | 0), xb = Math.min(W - 1, Math.ceil(cx + r + 1)), ya = Math.max(0, (cy - r - 1) | 0), yb = Math.min(H - 1, Math.ceil(cy + r + 1));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const i = y * W + x; if (!dist[i]) continue;
        const d = Math.hypot(x + .5 - cx, y + .5 - cy), a = sa * clamp(r + .5 - d, 0, 1);
        if (a > 0) for (let k = 0; k < 3; k++) alb[i * 3 + k] += (sc[k] - alb[i * 3 + k]) * a;
      }
    }
    /* light it: wrapped diffuse, a wet highlight, a little sky in the rim, dark at the very edge */
    const amb = o.amb === undefined ? .42 : o.amb, gloss = o.gloss === undefined ? .7 : o.gloss, shine = o.shine || 26, rimK = o.rim === undefined ? .18 : o.rim;
    const hv = (i, j) => (dist[j] ? hgt[j] : hgt[i] - R * .6);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!dist[i]) continue;
      const hl = x > 0 ? hv(i, i - 1) : hgt[i], hr = x < W - 1 ? hv(i, i + 1) : hgt[i], hu = y > 0 ? hv(i, i - W) : hgt[i], hd = y < H - 1 ? hv(i, i + W) : hgt[i];
      let nx = (hl - hr) * .5, ny = (hu - hd) * .5, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const ndl = nx * LV[0] + ny * LV[1] + nz * LV[2], ndh = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
      const diff = amb + (1 - amb) * Math.max(0, ndl * .85 + .15);
      const spec = (Math.pow(ndh, shine) + Math.pow(ndh, shine * .18) * .12) * gloss * 255;
      const ao = .62 + .38 * ss(0, 2.4, dist[i]);
      const fr = Math.pow(1 - nz, 2.5) * rimK * Math.max(0, -ny * .8 + .4) * 255;
      const k = i * 4;
      D[k] = clamp(alb[i * 3] * diff * ao + spec * .95 + fr * .55, 0, 255);
      D[k + 1] = clamp(alb[i * 3 + 1] * diff * ao + spec * .98 + fr * .8, 0, 255);
      D[k + 2] = clamp(alb[i * 3 + 2] * diff * ao + spec + fr, 0, 255);
    }
    g.putImageData(id, 0, 0);
    if (o.post) { g.save(); o.post(g); g.restore(); }
    stat.n++; stat.ms += performance.now() - t0;
    return { c: handOver(c), x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  /* painting is done on a CPU canvas; what is drawn every frame lives on a normal one (copied once) */
  function handOver(c) { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); return o; }
  function put(ctx, part) { ctx.drawImage(part.c, part.x0, part.y0, part.w, part.h); }
  /* a darker copy, for the far side */
  function darker(part, k, tint = [6, 10, 14]) {
    const c = document.createElement('canvas'); c.width = part.c.width; c.height = part.c.height;
    const g = c.getContext('2d', SOFT); g.drawImage(part.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(tint, k); g.fillRect(0, 0, c.width, c.height);
    return { ...part, c: handOver(c) };
  }
  /* a part along a bone: drawn pointing down +y from its root, stretched to the bone's length */
  function bone(ctx, part, a, b, nominal) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2); ctx.scale(1, len / nominal || 1);
    put(ctx, part); ctx.restore();
  }
  /* jobs: a set of parts painted one at a time, a few per frame, never more than the budget allows */
  function job(key, steps) {
    let j = cache.get(key);
    if (!j) { j = { steps, i: 0, parts: {} }; cache.set(key, j); }
    while (j.i < j.steps.length && canBake()) { const t0 = performance.now(); j.steps[j.i++](j.parts); spent(t0); }
    return j.i >= j.steps.length ? j.parts : null;
  }
  const fbmOf = (seed) => { const N = makeNoise2D(seed); return (x, y) => N(x, y) * .55 + N(x * 2.1 + 17, y * 2.1 + 5) * .3 + N(x * 4.3 + 3, y * 4.3 + 11) * .15; };

  /* ============================================================
     THE LOBSTER — palettes (sRGB) for the five forms
     ============================================================ */
  const PAL = {
    normal: { top: [30, 46, 42], side: [70, 96, 70], m1: [120, 90, 46], m2: [26, 52, 62], belly: [222, 182, 112], under: [196, 156, 92], spot: [24, 20, 14], tip: [214, 86, 38], leg: [156, 92, 48], joint: [74, 112, 132], gran: [176, 150, 96] },
    blue:   { top: [18, 44, 116], side: [46, 104, 206], m1: [96, 152, 236], m2: [16, 32, 92], belly: [176, 204, 242], under: [150, 186, 236], spot: [12, 26, 76], tip: [160, 198, 255], leg: [52, 104, 206], joint: [130, 176, 240], gran: [150, 190, 250] },
    orange: { top: [168, 66, 18], side: [234, 136, 44], m1: [252, 174, 76], m2: [186, 84, 26], belly: [255, 216, 164], under: [252, 206, 150], spot: [150, 56, 18], tip: [236, 82, 36], leg: [218, 112, 40], joint: [250, 182, 112], gran: [255, 210, 150] },
    calico: { top: [136, 90, 34], side: [226, 164, 66], m1: [242, 194, 104], m2: [28, 22, 16], belly: [244, 214, 164], under: [238, 204, 156], spot: [24, 18, 14], tip: [222, 108, 40], leg: [158, 104, 52], joint: [206, 156, 86], gran: [250, 220, 160] }
  };
  PAL.split = { ...PAL.orange, lower: PAL.blue };
  const PALE = [255, 228, 214];
  function palette(form, pale) {
    const src = PAL[form] || PAL.normal, out = {};
    const wash = (P) => { const o = {}; for (const k of Object.keys(P)) if (Array.isArray(P[k])) o[k] = pale > 0 ? mx(P[k], PALE, pale * .72) : P[k]; return o; };
    Object.assign(out, wash(src));
    if (src.lower) out.lower = wash(src.lower);
    out.calico = form === 'calico';
    return out;
  }
  /* split lobsters: orange above, blue below (as the classic sprite shows them) */
  const pickPal = (P, y, mid) => (P.lower && y > mid ? P.lower : P);
  /* the shell's colour: dark back, mottled sides, cream below; t is 0 at the top of the part, 1 at the bottom */
  function shellColour(P, fb, x, y, t, mid) {
    const Q = pickPal(P, y, mid);
    let c = mx(Q.top, Q.side, ss(.12, .78, t));
    const m = fb(x * .32, y * .32), m2 = fb(x * .9 + 40, y * .9 + 7);
    c = mx(c, Q.m1, ss(.52, .78, m) * (.25 + .5 * t));
    c = mx(c, Q.m2, ss(.42, .2, m) * .55);
    if (P.calico) c = mx(c, Q.m2, ss(.6, .64, m2) * .92);
    c = mx(c, Q.belly, ss(.82, 1.02, t) * .7);
    return c;
  }
  function speckles(R, n, inBox, P, fine) {
    const out = [];
    for (let i = 0; i < n; i++) { const [x, y] = inBox(R(), R()); out.push([x, y, (fine ? .18 : .25) + R() * (fine ? .3 : .5), R() < .8 ? P.spot : mx(P.spot, P.m1, .5), .45 + R() * .45]); }
    return out;
  }

  /* ---------- the parts of one lobster (form, sex, paleness) ---------- */
  function lobSteps(form, boy, pale) {
    const P = palette(form, pale), seed = 3 + form.length * 31 + (boy ? 7 : 0) + Math.round(pale * 4) * 101;
    const R = mulberry32(seed), fb = fbmOf(seed + 5), tailH = boy ? 1 : 1.16;
    const steps = [];
    /* --- the carapace: a long glossy dome, the rostrum spike, the cervical groove, granules on the front --- */
    steps.push((parts) => {
      const p = new Path2D();
      p.moveTo(-12, -4); p.bezierCurveTo(-12, -14, 0, -15, 14, -14); p.bezierCurveTo(26, -13, 34, -10, 36, -6);
      p.lineTo(44, -9); p.lineTo(37, -3);
      p.bezierCurveTo(36, 4, 28, 9, 16, 10); p.bezierCurveTo(4, 11, -8, 9, -12, 4); p.closePath();
      const bumps = [], spots = speckles(R, 150, (u, v) => [lerp(-11, 34, u), lerp(-13, 9, v)], P);
      for (let i = 0; i < 70; i++) { const x = lerp(6, 34, Math.sqrt(R())), y = lerp(-13, 4, R()); bumps.push([x, y, .45 + R() * .5, .22 + R() * .2]); if (R() < .5) spots.push([x - .1, y - .15, .22, P.gran, .7]); }
      for (let i = 0; i < 26; i++) { const x = lerp(-10, 8, R()), y = lerp(-12, 6, R()); bumps.push([x, y, .4 + R() * .4, .14]); }
      const groove = []; for (let k = 0; k <= 10; k++) { const t = k / 10; groove.push([(1 - t) ** 2 * 8 + 2 * (1 - t) * t * 6 + t * t * 9, (1 - t) ** 2 * -13 + 2 * (1 - t) * t * -2 + t * t * 9]); }
      const branchio = []; for (let k = 0; k <= 8; k++) { const t = k / 8; branchio.push([lerp(-10, 30, t), 3.5 + Math.sin(t * Math.PI) * 1.4]); }
      parts.carapace = paintShell(-14, -17, 46, 13, {
        paths: p, round: 7.5, gloss: .85, shine: 30, bumps, spots,
        grooves: [[groove, 1.1, 1.3], [branchio, .8, .5], [[[24, -11], [29, -6], [33, -4]], .6, .5]],
        color: (x, y) => { const t = (y + 14) / 24; let c = shellColour(P, fb, x, y, t, -2); return mx(c, P.tip, ss(37, 44, x) * .55); },
        post: (g) => {
          /* the rostrum's little teeth and the spine beside the eye */
          g.fillStyle = css(mx(P.top, [0, 0, 0], .3));
          for (const x of [38, 40.2, 42.2]) { g.beginPath(); g.moveTo(x - .8, -8.1 + (x - 37) * .14); g.lineTo(x + .2, -9.6 + (x - 37) * .12); g.lineTo(x + .6, -7.9 + (x - 37) * .14); g.fill(); }
          g.fillStyle = css(P.tip, .8); g.beginPath(); g.moveTo(35.5, -1); g.lineTo(38.6, -2.2); g.lineTo(35.8, .2); g.fill();
        }
      });
    });
    /* --- six tail plates, each a glossy band with its side flap (the pleuron) --- */
    for (let k = 0; k < 6; k++) steps.push((parts) => {
      const L = 6.5 - k * .3, h = (12 - k * 1.1) * tailH, p = new Path2D();
      p.moveTo(2, -h * .9); p.quadraticCurveTo(-L * .5, -h * 1.05, -L - 2, -h * .8); p.lineTo(-L - 1, h * .75);
      p.quadraticCurveTo(-L * .4, h * 1.02, 2, h * .85); p.closePath();
      /* the pleuron points backwards a little at the bottom */
      p.moveTo(-L - 1.2, h * .5); p.lineTo(-L - 2.6, h * .92); p.lineTo(-L * .5, h * .98); p.closePath();
      const spots = speckles(R, 22, (u, v) => [lerp(-L - 1, 1.5, u), lerp(-h * .9, h * .6, v)], P, true);
      for (let i = 0; i < 8; i++) spots.push([lerp(-L, 1, R()), lerp(-h * .85, -h * .2, R()), .2, P.gran, .5]);
      parts['tail' + k] = paintShell(-L - 4, -h * 1.1, 3, h * 1.06, {
        paths: p, round: h * .62, gloss: .85, shine: 28, spots,
        grooves: [[[[-.6, -h * .92], [-1.2, h * .2]], .55, .9], [[[-L - 1, h * .42], [1.5, h * .48]], .45, .5]],
        bumps: [[-L * .45, -h * .55, L * .35, .25]],
        color: (x, y) => { const t = (y + h) / (2 * h); let c = shellColour(P, fb, x + k * 9, y, t, h * .2); if (x > -.7) c = mx(c, [0, 0, 0], .25); return c; }
      });
    });
    /* --- the tail fan: one blade shape, used five times; red-orange edged, with a fringe of fine hairs --- */
    steps.push((parts) => {
      const p = new Path2D();
      p.moveTo(1, -2.6 * tailH); p.quadraticCurveTo(-8, -4 * tailH, -13, -1.2); p.quadraticCurveTo(-8, 3.6 * tailH, 1, 2.6 * tailH); p.closePath();
      parts.fan = paintShell(-15, -5 * tailH, 2, 4.6 * tailH, {
        paths: p, round: 1.8, gloss: .75, shine: 24, res: 6,
        grooves: [[[[0, 0], [-11, -.6]], .35, .4]],
        spots: speckles(R, 10, (u, v) => [lerp(-10, 0, u), lerp(-2, 2, v)], P, true),
        color: (x, y) => { const t = (y + 3) / 6; let c = shellColour(P, fb, x, y + 20, t * .7, 0); return mx(c, pickPal(P, y, 0).tip, ss(-6, -12.5, x) * .6); },
        post: (g) => { g.strokeStyle = css(mx(P.belly, [255, 255, 255], .3), .55); g.lineWidth = .12; for (let i = 0; i < 22; i++) { const t = i / 21, a = lerp(-1.1, 1.1, t), x = -12.6 * Math.cos(a * .35) + 1.4, y = lerp(-1.4, 1.4, t) * tailH; g.beginPath(); g.moveTo(x, y); g.lineTo(x - .9 - Math.abs(a) * .3, y + a * .5); g.stroke(); } }
      });
    });
    /* --- the claw arm: merus (shoulder to elbow) and carpus (elbow to wrist), spiny on top --- */
    const segment = (len, w0, w1, spines, colTop, colBot, key, tipCol) => (parts) => {
      const p = new Path2D();
      p.moveTo(-w0 / 2, 0); p.quadraticCurveTo(-w0 * .62, len * .45, -w1 / 2, len); p.quadraticCurveTo(0, len + w1 * .55, w1 / 2, len);
      p.quadraticCurveTo(w0 * .58, len * .45, w0 / 2, 0); p.quadraticCurveTo(0, -w0 * .45, -w0 / 2, 0); p.closePath();
      const bumps = [], spots = speckles(R, Math.round(len * w0 * .35), (u, v) => [lerp(-w0 / 2, w0 / 2, u), lerp(0, len, v)], P, true);
      for (let i = 0; i < spines; i++) { const y = lerp(len * .1, len * .9, i / Math.max(1, spines - 1)), x = -lerp(w0, w1, y / len) * .42; bumps.push([x, y, .55, .55]); spots.push([x - .1, y, .3, tipCol || P.tip, .85]); }
      parts[key] = paintShell(-w0 - 1, -w0 * .6, w0 + 1, len + w1 + 1, {
        paths: p, round: Math.max(w0, w1) * .5, gloss: .8, shine: 26, bumps, spots, res: 5,
        color: (x, y) => { const t = clamp((x + w0 / 2) / w0, 0, 1); let c = mx(colTop, colBot, ss(.15, .85, t)); const m = fb(x * .5 + 30, y * .4); c = mx(c, P.m2, ss(.4, .2, m) * .4); return mx(c, P.joint, ss(len * .82, len, y) * .3); }
      });
      parts[key + 'F'] = darker(parts[key], .28);
    };
    steps.push(segment(19.7, 7.6, 7, 4, P.top, P.side, 'merus'));
    steps.push(segment(18.4, 7, 7.6, 3, P.top, mx(P.side, P.under, .3), 'carpus'));
    /* --- the hands: a fat crusher with rounded knobs, a slim cutter with rows of small sharp tubercles --- */
    for (const crusher of [true, false]) steps.push((parts) => {
      const big = (crusher ? 1.3 : .92) * (boy ? 1.12 : .95), L = 22 * big, H = 9 * big * (crusher ? 1.15 : .85);
      const p = new Path2D();
      p.moveTo(-4, -H * .6); p.quadraticCurveTo(L * .5, -H * 1.25, L, -H * .3); p.lineTo(L, H * .2); p.quadraticCurveTo(L * .5, H * 1.15, -4, H * .55); p.closePath();
      const bumps = [], spots = speckles(R, Math.round(L * H * .45), (u, v) => [lerp(-3, L, u), lerp(-H, H, v)], P, true);
      if (crusher) for (let i = 0; i < 22; i++) { const x = lerp(0, L * .9, R()), y = lerp(-H * .75, H * .65, R()); const r = .9 + R() * 1.1; bumps.push([x, y, r, .45]); spots.push([x - r * .15, y - r * .2, r * .32, mx(P.tip, P.gran, .4), .55]); }
      else {
        for (let i = 0; i < 46; i++) { const x = lerp(-1, L * .95, R()), y = lerp(-H * .8, H * .7, R()); bumps.push([x, y, .45 + R() * .35, .35]); if (R() < .6) spots.push([x - .1, y - .1, .25, P.tip, .7]); }
        for (const side of [-1, 1]) for (let i = 0; i < 9; i++) { const u = i / 8, x = lerp(1, L * .92, u), y = side < 0 ? -H * (.62 + .5 * Math.sin(u * Math.PI) * .9) * .95 : H * (.55 + .5 * Math.sin(u * Math.PI) * .85) * .9; bumps.push([x, y, .6, .55]); spots.push([x, y, .3, P.tip, .9]); }
      }
      const hand = paintShell(-6, -H * 1.35, L + 2, H * 1.3, {
        paths: p, round: H * .78, gloss: .9, shine: 32, bumps, spots, res: 5,
        grooves: [[[[L * .1, H * .15], [L * .55, H * .2], [L * .95, H * .05]], .7, .4]],
        color: (x, y) => { const t = (y + H) / (2 * H); let c = shellColour(P, fb, x + 50, y, t * .9, 0); c = mx(c, pickPal(P, y, 0).under, ss(.55, .9, t) * .6); return c; }
      });
      hand.L = L; hand.H = H;
      const k = crusher ? 'cr' : 'cu';
      parts['hand' + k] = hand; parts['hand' + k + 'F'] = darker(hand, .26);
      /* the fingers: the fixed one below, the moving one above, toothed along the bite, red-orange tipped */
      for (const fixed of [true, false]) {
        const fl = L * (crusher ? .75 : .95), fh = H * (fixed ? .42 : .34), q = new Path2D();
        q.moveTo(0, -fh); q.quadraticCurveTo(fl * .6, -fh * 1.1, fl, 0); q.quadraticCurveTo(fl * .6, fh * .9, 0, fh); q.closePath();
        const iy = fixed ? -fh * .82 : fh * .82, teeth = [];
        if (crusher) for (let i = 1; i < 4; i++) { const x = fl * i / 4.2; q.moveTo(x + fh * .36, iy); q.arc(x, iy, fh * .36, 0, TAU); teeth.push([x, iy, fh * .36, .5]); }
        else for (let i = 0; i < 9; i++) { const x = fl * (i + .5) / 9.5; q.moveTo(x - fl * .03, iy); q.lineTo(x, iy + (fixed ? -1 : 1) * fh * .4); q.lineTo(x + fl * .03, iy); q.closePath(); }
        const fing = paintShell(-1, -fh * 1.6, fl + 1, fh * 1.6, {
          paths: q, round: fh * .75, gloss: .9, shine: 34, bumps: teeth, res: 6,
          spots: speckles(R, 8, (u, v) => [lerp(0, fl * .6, u), lerp(-fh * .5, fh * .5, v)], P, true),
          color: (x, y) => { let c = mx(mx(P.top, P.side, .55), P.tip, ss(fl * .4, fl * .95, x)); if (Math.abs(y - iy) < fh * .45) c = mx(c, [236, 220, 186], .55); return c; }
        });
        parts['f' + k + (fixed ? 'x' : 'm')] = fing; parts['f' + k + (fixed ? 'x' : 'm') + 'F'] = darker(fing, .26);
      }
    });
    /* --- walking legs: an upper segment and a slim lower one ending in a red-orange tip --- */
    steps.push(segment(8, 2.7, 2.3, 0, P.leg, mx(P.leg, P.belly, .3), 'legU'));
    steps.push((parts) => {
      const len = 14, w0 = 2.1, w1 = .8, p = new Path2D();
      p.moveTo(-w0 / 2, 0); p.quadraticCurveTo(-w0 * .6, len * .5, -w1 / 2, len); p.quadraticCurveTo(0, len + .8, w1 / 2, len); p.quadraticCurveTo(w0 * .55, len * .45, w0 / 2, 0); p.quadraticCurveTo(0, -w0 * .4, -w0 / 2, 0); p.closePath();
      parts.legL = paintShell(-2.5, -1.4, 2.5, len + 1.8, {
        paths: p, round: 1.1, gloss: .7, shine: 22, res: 6,
        grooves: [[[[-1, len * .62], [1, len * .62]], .3, .4]],
        color: (x, y) => mx(mx(mx(P.leg, P.joint, ss(1.5, 0, y) * .5), P.leg, .2), P.tip, ss(len * .5, len, y) * .75),
        post: (g) => { g.strokeStyle = css(mx(P.belly, [255, 255, 255], .2), .5); g.lineWidth = .1; for (let i = 0; i < 8; i++) { const y = len * (.66 + i * .04); g.beginPath(); g.moveTo(.4, y); g.lineTo(1.4, y + .6); g.stroke(); } }
      });
      parts.legLF = darker(parts.legL, .32); parts.legUF = darker(parts.legU, .32);
    });
    return steps;
  }
  /* the egg mass under a mother's tail: hundreds of glossy dark-green eggs (painted per quarter of fullness) */
  function eggMass(e) {
    return job('eggs|' + e, [(parts) => {
      const R = mulberry32(77 + e * 8), cx = -16, cy = 11 + e * 3, rx = 14 + e * 10, ry = 5 + e * 5;
      const c = document.createElement('canvas'), RES = 6, x0 = cx - rx - 2, y0 = cy - ry - 2, w = rx * 2 + 4, h = ry * 2 + 4;
      c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
      const g = c.getContext('2d', SOFT); g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
      g.fillStyle = 'rgba(20,24,14,.85)'; g.beginPath(); g.ellipse(cx, cy, rx * .92, ry * .88, .05, 0, TAU); g.fill();
      const eggs = [], n = Math.round(rx * ry * 2.2);
      for (let i = 0; i < n; i++) { const a = R() * TAU, r = Math.sqrt(R()); const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r; if (r > .92 && R() < .6) continue; eggs.push([x, y, .95 + R() * .35, R()]); }
      eggs.sort((a, b) => a[1] - b[1]);
      for (const [x, y, r, v] of eggs) {
        const eg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
        const base = mx([46, 60, 30], [70, 56, 30], v * .5);
        eg.addColorStop(0, css(mx(base, [190, 200, 150], .45))); eg.addColorStop(.45, css(base)); eg.addColorStop(1, css(mx(base, [0, 0, 0], .7)));
        g.fillStyle = eg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,240,.55)'; g.beginPath(); g.arc(x - r * .38, y - r * .42, r * .2, 0, TAU); g.fill();
      }
      parts.img = { c: handOver(c), x0, y0, w, h };
    }]);
  }
  function lobParts(form, boy, pale) { return job(`lob|${form}|${boy ? 1 : 0}|${pale}`, lobSteps(form, boy, pale)); }

  /* ---------- placing the parts ---------- */
  function antenna(ctx, x0, y0, cx, cy, x1, y1, w0, cBase, cTip) {
    const N = 16; let px = x0, py = y0;
    ctx.lineCap = 'round';
    for (let i = 1; i <= N; i++) {
      const t = i / N, u = 1 - t, x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const c = mx(cBase, cTip, Math.pow(t, .55)), band = i % 2 ? 1 : .82;
      ctx.strokeStyle = css([c[0] * band, c[1] * band, c[2] * band]); ctx.lineWidth = lerp(w0, .35, Math.pow(t, .7));
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      if (i < 5) { ctx.strokeStyle = 'rgba(255,240,220,.35)'; ctx.lineWidth *= .3; ctx.beginPath(); ctx.moveTo(px, py - .3); ctx.lineTo(x, y - .3); ctx.stroke(); }
      px = x; py = y;
    }
  }
  function legDraw(ctx, Pt, hx, hy, kx, ky, tx, ty, far) {
    bone(ctx, far ? Pt.legLF : Pt.legL, [kx, ky], [tx, ty], 14);
    bone(ctx, far ? Pt.legUF : Pt.legU, [hx, hy], [kx, ky], 8);
  }
  function clawDraw(ctx, Pt, o) {
    const { sx, sy, up, pinch, crusher, near } = o;
    const ex = lerp(sx + 18, sx + 10, up), ey = lerp(sy + 8, sy - 16, up), hx = lerp(sx + 36, sx + 30, up), hy = lerp(sy + 4, sy - 26, up);
    const F = near ? '' : 'F', k = crusher ? 'cr' : 'cu', hand = Pt['hand' + k + F];
    bone(ctx, Pt['carpus' + F], [ex, ey], [hx, hy], 18.4);
    bone(ctx, Pt['merus' + F], [sx, sy], [ex, ey], 19.7);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(lerp(.1, -.9, up));
    const L = hand.L, H = hand.H, open = pinch * .5 + up * .3;
    for (const [dy, rot, fixed] of [[H * .15, open * .15, true], [-H * .35, -open, false]]) { ctx.save(); ctx.translate(L - 3, dy); ctx.rotate(rot); put(ctx, Pt['f' + k + (fixed ? 'x' : 'm') + F]); ctx.restore(); }
    put(ctx, hand);
    ctx.restore();
  }
  function lobsterReady(o) { const pale = Math.round(clamp(o.pale || 0, 0, 1) * 4) / 4; return !!lobParts(PAL[o.form] ? o.form : 'normal', o.sex !== 'girl', pale); }

  /* o: as Sprites.drawLobster */
  function drawLobster(ctx, o) {
    const form = PAL[o.form] ? o.form : 'normal', boy = o.sex !== 'girl', pale = Math.round(clamp(o.pale || 0, 0, 1) * 4) / 4;
    const Pt = lobParts(form, boy, pale);
    if (!Pt) return Sprites.drawLobster(ctx, o);
    const eggsAmt = o.eggs || 0, Eg = eggsAmt > 0 ? eggMass(Math.max(.25, Math.round(eggsAmt * 4) / 4)) : null;
    const P = palette(form, pale);
    const s = o.s || 1, walk = o.walk || 0, tuck = o.tuck || 0, up = o.up || 0, flip = o.flip || 0, swim = o.swim;
    const face = o.face === undefined ? 1 : o.face, nearSide = face >= 0 ? 'right' : 'left';
    const crusherNear = o.crusher ? o.crusher === nearSide : null;
    const tailH = boy ? 1 : 1.16;
    ctx.save();
    ctx.scale(s, s);
    if (o.moving && !swim) ctx.rotate(Math.sin(walk * .5) * .015);
    /* --- the feelers: two long red-orange antennae, banded, and the short forked antennules --- */
    const ant = Math.sin((o.ph || walk) * .6) * .12, antBase = mx(P.side, P.tip, .45), antTip = mx(P.tip, [255, 200, 160], .15);
    for (const k of [-1, 1]) antenna(ctx, 34, -6 + k * 1.5, 70 + k * 6, -30 + ant * 40 * k - up * 10, 112 + k * 4, -14 + ant * 60 * k - up * 20 - k * 10, k < 0 ? 1.7 : 2.1, k < 0 ? mx(antBase, [0, 0, 0], .25) : antBase, antTip);
    ctx.lineWidth = .55; ctx.lineCap = 'round';
    for (const k of [-1, 1]) for (const f of [0, 1]) { ctx.strokeStyle = css(mx(P.side, P.tip, .3 + f * .2)); ctx.beginPath(); ctx.moveTo(36, -4); ctx.quadraticCurveTo(44 + f * 2, -9 + k * 3, 51 + f * 2, -14 + k * 5 + ant * 10 - f * 1.5); ctx.stroke(); }
    /* --- the far claw and the far legs, in shade --- */
    clawDraw(ctx, Pt, { sx: 24, sy: 2, up, pinch: o.pinch || 0, crusher: crusherNear === null ? false : !crusherNear, near: false });
    const HIP = [[22, 6], [12, 7], [2, 7], [-8, 6]];
    for (let k = 3; k >= 0; k--) {
      const ph = walk + k * 1.6 + Math.PI, lift = o.moving ? Math.max(0, Math.sin(ph)) * 5 : 0, swing = o.moving ? Math.cos(ph) * 6 : 0;
      const [hx, hy] = HIP[k], tx = hx + swing + 4 - k * 3 - tuck * 6, ty = 20 - lift - tuck * 6;
      legDraw(ctx, Pt, hx, hy, (hx + tx) / 2 + 6, hy + 4 - lift * .5, tx, ty, true);
    }
    /* --- the tail: six plates (front ones overlap the back ones), swimmerets, the fan, a mother's eggs --- */
    ctx.save(); ctx.translate(-10, 0);
    const curl = flip * .62 + tuck * .4, segs = [];
    let px = 0, py = 0, ang = 0;
    for (let k = 0; k < 6; k++) { ang += curl; const L = 6.5 - k * .3; segs.push([px, py, ang, L, (12 - k * 1.1) * tailH]); px += -L * Math.cos(ang) - .5; py += -L * Math.sin(ang); }
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + curl);
    const spread = .35 + flip * .3 + (swim !== undefined ? .2 : 0);
    for (const a of [-spread, spread, -spread * .5, spread * .5, 0]) { ctx.save(); ctx.rotate(a); put(ctx, Pt.fan); ctx.restore(); }
    ctx.restore();
    for (let k = 5; k >= 0; k--) {
      const [x, y, a, L, h] = segs[k];
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const beat = swim !== undefined ? Math.sin(swim + k) * .7 : (o.fan ? Math.sin(o.fan * 14 + k) * .8 : 0);
      if (k < 5) { ctx.strokeStyle = css(mx(P.belly, P.tip, .2), .85); ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-L * .5, h * .8); ctx.lineTo(-L * .5 - 1 + beat * 3, h * .8 + 4.5 - Math.abs(beat)); ctx.stroke(); ctx.strokeStyle = css(mx(P.belly, [255, 255, 255], .3), .45); ctx.lineWidth = .15; for (let j = 1; j < 4; j++) { const t = j / 4, bx = -L * .5 + (-1 + beat * 3) * t, by = h * .8 + (4.5 - Math.abs(beat)) * t; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 1, by + .4); ctx.stroke(); } }
      put(ctx, Pt['tail' + k]);
      ctx.restore();
    }
    if (Eg) { ctx.save(); ctx.globalAlpha = clamp(eggsAmt * 3, 0, 1); put(ctx, Eg.img); ctx.restore(); }
    ctx.restore();
    /* --- the carapace, the mouthparts chewing, the eye on its stalk --- */
    put(ctx, Pt.carapace);
    const chew = o.eat ? Math.sin(o.eat * 18) * 1.5 : 0;
    ctx.strokeStyle = css(mx(P.belly, P.top, .35)); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const dx of [0, 2.4]) { ctx.beginPath(); ctx.moveTo(26 + dx, 7.5); ctx.quadraticCurveTo(29 + dx, 9 + chew * .4, 31.5 + dx, 11 + chew * .5); ctx.stroke(); }
    ctx.strokeStyle = css(mx(P.belly, [255, 255, 255], .2), .6); ctx.lineWidth = .14;
    for (let i = 0; i < 7; i++) { const x = 27 + i * .9; ctx.beginPath(); ctx.moveTo(x, 9.6 + chew * .2); ctx.lineTo(x + .5, 11.6 + chew * .3); ctx.stroke(); }
    const ey = -11 + tuck * 3;
    ctx.strokeStyle = css(mx(P.top, P.side, .4)); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(32, -7); ctx.lineTo(36, ey); ctx.stroke();
    const eg = ctx.createRadialGradient(35.6, ey - 1, .3, 36.5, ey, 3.2);
    eg.addColorStop(0, '#5c6070'); eg.addColorStop(.35, '#1a1c24'); eg.addColorStop(1, '#030305');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(36.5, ey, 3.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(35.4, ey - 1.3, .9, .55, -.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,200,220,.35)'; ctx.beginPath(); ctx.arc(37.6, ey + 1.2, .6, 0, TAU); ctx.fill();
    /* --- the near legs, then the near claw --- */
    for (let k = 3; k >= 0; k--) {
      const ph = walk + k * 1.6, lift = o.moving ? Math.max(0, Math.sin(ph)) * 6 : 0, swing = o.moving ? Math.cos(ph) * 7 : 0;
      const [hx, hy] = HIP[k], tx = hx + swing + 2 - k * 4 - tuck * 6, ty = 20 - lift - tuck * 7;
      legDraw(ctx, Pt, hx, hy + 2, (hx + tx) / 2 + 7, hy + 6 - lift * .5, tx, ty, false);
    }
    clawDraw(ctx, Pt, { sx: 26, sy: 5, up: up * .9, pinch: o.pinch || 0, crusher: crusherNear === null ? false : crusherNear, near: true });
    ctx.restore();
  }
  /* an empty shed shell, pale and see-through, split along the back */
  function drawExuvia(ctx, s, form) {
    if (!lobParts(PAL[form] ? form : 'normal', true, 1)) return Sprites.drawExuvia(ctx, s, form);
    ctx.save(); ctx.globalAlpha = .6;
    drawLobster(ctx, { s, form, pale: 1, tuck: .2, seed: 2 });
    ctx.scale(s, s); ctx.strokeStyle = 'rgba(90,50,30,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -11); ctx.quadraticCurveTo(12, -17, 34, -12); ctx.stroke();
    ctx.restore();
  }
  function drawPostlarva(ctx, o) {
    if (!lobParts(PAL[o.form] ? o.form : 'normal', true, 0)) return Sprites.drawPostlarva(ctx, o);
    drawLobster(ctx, { s: o.s || .08, form: o.form, sex: 'boy', swim: o.ph || 0, ph: o.ph, seed: 2, up: .15 });
  }

  /* ============================================================
     THE LARVA: a glassy little swimmer, see-through with red-orange
     colour cells, a green gut, a huge dark eye, a spiky back
     ============================================================ */
  function larvaParts(form, inst) {
    return job(`larva|${form}|${inst}`, [(parts) => {
      const F = FORMS[form] || FORMS.normal, sc = hexToRgb(F.shell), R = mulberry32(31 + inst);
      const RES = 18, x0 = -14.5, y0 = -6.5, x1 = 9, y1 = 4.5;
      const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * RES); c.height = Math.ceil((y1 - y0) * RES);
      const g = c.getContext('2d', SOFT); g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); g.lineCap = 'round'; g.lineJoin = 'round';
      /* the tail: thin glassy segments and a small fan */
      const tail = new Path2D(); tail.moveTo(-3, -.6); tail.quadraticCurveTo(-7, -.2, -10.5, 1.5); tail.lineTo(-10.5, 2.8); tail.quadraticCurveTo(-7, 1.8, -3, 1.8); tail.closePath();
      const tg = g.createLinearGradient(0, -.6, 0, 2.8); tg.addColorStop(0, 'rgba(255,246,236,.75)'); tg.addColorStop(.5, 'rgba(250,226,206,.35)'); tg.addColorStop(1, 'rgba(240,200,170,.6)');
      g.fillStyle = tg; g.fill(tail); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = .14; g.stroke(tail);
      for (let k = 1; k <= 4; k++) { const x = -3 - k * 1.7; g.strokeStyle = 'rgba(255,236,220,.55)'; g.lineWidth = .12; g.beginPath(); g.moveTo(x, -.35 + k * .25); g.lineTo(x - .2, 1.9 + k * .1); g.stroke(); }
      const fan = new Path2D(); fan.moveTo(-10.5, 2.1); fan.lineTo(-13, .4); fan.quadraticCurveTo(-14.1, 2.2, -13, 4); fan.closePath();
      g.fillStyle = 'rgba(255,236,220,.45)'; g.fill(fan); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = .1; g.stroke(fan);
      for (let i = 0; i < 9; i++) { const a = lerp(-.6, .6, i / 8); g.beginPath(); g.moveTo(-13.4, 2.2 + a * 2.4); g.lineTo(-14.3, 2.2 + a * 3); g.stroke(); }
      for (const [x, y] of [[-6, .5], [-8.5, 1.4]]) { g.fillStyle = css(mx(sc, [220, 60, 30], .5), .6); g.beginPath(); g.arc(x, y, .32, 0, TAU); g.fill(); }
      /* the rostrum and the spines on the back */
      g.strokeStyle = 'rgba(255,244,232,.9)'; g.lineWidth = .32;
      g.beginPath(); g.moveTo(3.8, -1.2); g.lineTo(7.2 + inst * .3, -2.2); g.stroke();
      for (const [x, y] of [[-1, -3.2], [1.2, -3.4]]) { g.lineWidth = .3; g.beginPath(); g.moveTo(x + .3, y + .3); g.lineTo(x - .8, y - 2.4); g.stroke(); }
      /* the glass carapace: clear in the middle, bright at the rim (light bends at the edge) */
      const body = new Path2D(); body.ellipse(1, -.4, 4.4, 2.8, .05, 0, TAU);
      const bg = g.createRadialGradient(.4, -1, .2, 1, -.4, 4.6);
      bg.addColorStop(0, 'rgba(255,255,255,.18)'); bg.addColorStop(.62, 'rgba(240,226,214,.22)'); bg.addColorStop(.86, 'rgba(250,236,226,.55)'); bg.addColorStop(1, 'rgba(255,255,255,.85)');
      g.fillStyle = bg; g.fill(body);
      /* the gut (green-brown with what it ate), the colour cells (branching red-orange stars) */
      g.save(); g.clip(body);
      g.fillStyle = 'rgba(110,150,60,.6)'; g.beginPath(); g.ellipse(-.2, .3, 2.4, .9, .2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(70,100,30,.45)'; g.beginPath(); g.ellipse(-.8, .4, 1.2, .5, .2, 0, TAU); g.fill();
      for (const [x, y, r] of [[-1.6, -1.4, .55], [.4, 1.2, .6], [-2.6, .4, .45], [2.4, -1.6, .4], [3.2, .8, .4], [1.2, -.6, .35]]) {
        const cc = mx(sc, [214, 64, 30], .55);
        g.fillStyle = css(cc, .85); g.beginPath(); g.arc(x, y, r * .45, 0, TAU); g.fill();
        g.strokeStyle = css(cc, .6); g.lineWidth = .1;
        for (let k = 0; k < 7; k++) { const a = R() * TAU, L = r * (1 + R()); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .4) * L * .5, y + Math.sin(a + .4) * L * .5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .12; g.stroke(body);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(0, -2.2, 2.2, .35, -.08, 0, TAU); g.fill();
      /* the huge compound eye on its short stalk */
      g.fillStyle = 'rgba(230,220,210,.6)'; g.beginPath(); g.ellipse(3.6, -1.5, .9, .5, -.5, 0, TAU); g.fill();
      const eg = g.createRadialGradient(3.9, -2.3, .1, 4.2, -1.8, 1.8);
      eg.addColorStop(0, '#56606a'); eg.addColorStop(.3, '#141820'); eg.addColorStop(.85, '#05060a'); eg.addColorStop(1, '#2a3a40');
      g.fillStyle = eg; g.beginPath(); g.arc(4.2, -1.8, 1.75, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,200,190,.35)'; g.lineWidth = .14; g.beginPath(); g.arc(4.2, -1.8, 1.5, .4, 2.2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(3.75, -2.35, .42, 0, TAU); g.fill();
      stat.n++;
      parts.img = { c: handOver(c), x0, y0, w: x1 - x0, h: y1 - y0 };
    }]);
  }
  function drawLarva(ctx, o) {
    const inst = clamp(o.instar || 1, 1, 3) | 0, form = FORMS[o.form] ? o.form : 'normal', Pt = larvaParts(form, inst);
    if (!Pt) return Sprites.drawLarva(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, beat = Math.sin(ph);
    ctx.save(); ctx.scale(s, s);
    /* feathery swimming legs (the exopods), beating under the thorax: fine shafts fringed with setae */
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = .7 + Math.sin(ph + k * .9) * .55, L = 4.5 + inst * .4;
      const x0 = 1.4 - k * 1.3, y0 = 2.2, x1 = x0 - Math.cos(a) * L * .4, y1 = y0 + Math.sin(a) * L;
      ctx.strokeStyle = 'rgba(255,240,224,.85)'; ctx.lineWidth = .32; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,246,236,.5)'; ctx.lineWidth = .1;
      for (let j = 1; j <= 7; j++) { const t = j / 8, px = lerp(x0, x1, t), py = lerp(y0, y1, t); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 1.3, py + .4); ctx.moveTo(px, py); ctx.lineTo(px + 1.1, py + .7); ctx.stroke(); }
    }
    /* the tail flicks with the beat: a slight shear behind the carapace */
    ctx.save(); ctx.translate(-3, 0); ctx.transform(1, beat * .09, 0, 1, 0, 0); ctx.translate(3, 0);
    ctx.beginPath(); ctx.rect(-15, -7, 12.2, 12); ctx.clip(); put(ctx, Pt.img); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-2.8, -7, 12, 12); ctx.clip(); put(ctx, Pt.img); ctx.restore();
    ctx.restore();
  }
  /* an egg: a glossy dark-olive bead, the eye of the embryo showing through */
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-.38, -.42, .05, 0, 0, 1.05);
    g.addColorStop(0, '#9aa070'); g.addColorStop(.35, '#3c4a26'); g.addColorStop(.85, '#151a0c'); g.addColorStop(1, '#2a3418');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    if (o.eye) { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.ellipse(.32, -.08, .2, .26, .3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(200,120,60,.4)'; ctx.beginPath(); ctx.ellipse(-.1, .25, .35, .18, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,240,.75)'; ctx.beginPath(); ctx.ellipse(-.4, -.45, .22, .14, -.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     THE SEA'S OTHER ANIMALS: fish, the seal, the basking shark,
     food on the floor, plankton.  Same frames as sprites.js; the
     body painted once, fins and tails placed each frame
     ============================================================ */
  const one = (key, make) => { const j = job(key, [(parts) => { parts.v = make(); }]); return j ? j.v : null; };
  /* fins: thin membranes with rays, painted behind a body (destination-over) */
  function fin(g, path, col, rays) {
    g.save(); g.globalCompositeOperation = 'destination-over';
    g.fillStyle = css(col, .78); g.fill(path);
    g.save(); g.clip(path); g.strokeStyle = css(mx(col, [0, 0, 0], .35), .6); g.lineWidth = .35;
    for (const [ax, ay, bx, by] of rays) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.restore(); g.restore();
  }
  const fanRays = (bx, by, pts) => pts.map(([x, y]) => [bx, by, x, y]);
  function tailPart(key, len, half, col, colTip, res) {
    return one(key, () => {
      const p = new Path2D(); p.moveTo(2, -half * .25); p.quadraticCurveTo(-len * .5, -half * .5, -len, -half); p.quadraticCurveTo(-len * .7, 0, -len, half); p.quadraticCurveTo(-len * .5, half * .5, 2, half * .25); p.closePath();
      return paintShell(-len - 2, -half - 1, 3, half + 1, {
        paths: p, round: half * .25, gloss: .5, shine: 20, res: res || 4, amb: .55,
        color: (x, y) => mx(col, colTip, ss(-len * .3, -len, x) * .6),
        post: (g) => { g.strokeStyle = css(mx(col, [0, 0, 0], .4), .45); g.lineWidth = len * .012; for (let i = 0; i <= 12; i++) { const t = i / 12 * 2 - 1; g.beginPath(); g.moveTo(0, t * half * .2); g.lineTo(-len * (.95 - .2 * (1 - Math.abs(t))), t * half * .95); g.stroke(); } }
      });
    });
  }
  function eyeLive(ctx, x, y, r, iris) {
    ctx.fillStyle = css(iris || [200, 190, 150]); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - r * .2, y - r * .2, r * .1, x, y, r * .7); g.addColorStop(0, '#26303a'); g.addColorStop(1, '#030405');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + r * .08, y, r * .66, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x - r * .28, y - r * .3, r * .22, 0, TAU); ctx.fill();
  }
  /* scales: a soft lattice of overlapping arcs that only changes the shine a little */
  const scales = (x, y, k) => { const u = x * k, v = y * k + (Math.floor(u) % 2) * .5, fu = u - Math.floor(u), fv = v - Math.floor(v); return .92 + .08 * ss(.25, .05, Math.hypot(fu - .9, fv - .5) - .45); };

  /* --- herring and the little bottom fish (canonical 34 long), coloured by the caller's col/col2 --- */
  function drawFish(ctx, o) {
    const col = o.col || '#c8d8e8', col2 = o.col2 || '#3a5a7a', key = 'fish|' + col + '|' + col2;
    const B = one(key, () => {
      const c1 = hexToRgb(col), c2 = hexToRgb(col2), R = mulberry32(col.length * 7 + col.charCodeAt(1));
      const p = new Path2D(); p.moveTo(17, 0); p.quadraticCurveTo(10, -7, -6, -5); p.lineTo(-13, 0); p.lineTo(-6, 5); p.quadraticCurveTo(10, 7, 17, 0); p.closePath();
      const df = new Path2D(); df.moveTo(-3, -4.6); df.quadraticCurveTo(1, -9.5, 6, -5.6); df.closePath();
      return paintShell(-14, -10, 18, 8, {
        paths: p, round: 4.5, gloss: 1, shine: 30, res: 8, rim: .4,
        color: (x, y) => { const t = (y + 5) / 10; let c = mx(c2, c1, ss(.15, .55, t)); c = mx(c, [244, 248, 252], ss(.6, .95, t)); c = mx(c, [150, 120, 190], Math.exp(-((y + .6) ** 2) * 1.2) * .25); return c.map(v => v * scales(x, y, .9)); },
        post: (g) => { fin(g, df, mx(c2, c1, .4), fanRays(1, -4.8, [[-2, -7], [0, -8.6], [2, -8.8], [4, -7.6], [5.5, -6]])); g.strokeStyle = 'rgba(30,40,50,.35)'; g.lineWidth = .3; g.beginPath(); g.arc(14.5, .5, 4.4, 2.2, 3.9); g.stroke(); }
      });
    });
    const T = tailPart('fishTail|' + col + '|' + col2, 8, 6.5, mx(hexToRgb(col2), hexToRgb(col), .5), hexToRgb(col2), 8);
    if (!B || !T) return Sprites.drawFish(ctx, o);
    const s = o.s || 1, tail = Math.sin(o.ph || 0) * 3;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-12, 0); ctx.rotate(tail * .06); put(ctx, T); ctx.restore();
    put(ctx, B);
    eyeLive(ctx, 11, -1.5, 1.7, [214, 214, 200]);
    ctx.restore();
  }
  /* --- the hunters (canonical 100 long): cod, longhorn sculpin, striped bass --- */
  const HUNT = {
    cod: { body: (p) => { p.moveTo(50, -2); p.quadraticCurveTo(30, -18, -10, -16); p.quadraticCurveTo(-35, -12, -46, -2); p.lineTo(-46, 4); p.quadraticCurveTo(-30, 14, -5, 15); p.quadraticCurveTo(30, 16, 50, 4); p.closePath(); },
      back: [86, 84, 44], side: [150, 138, 84], belly: [236, 230, 204], spot: [92, 72, 30], eye: [38, -4, 3.2], tail: [[132, 120, 70], [90, 84, 44]] },
    sculpin: { body: (p) => { p.moveTo(50, 2); p.quadraticCurveTo(40, -16, 10, -10); p.quadraticCurveTo(-20, -8, -46, -2); p.lineTo(-46, 4); p.quadraticCurveTo(-10, 12, 20, 12); p.quadraticCurveTo(44, 12, 50, 2); p.closePath(); },
      back: [96, 70, 40], side: [168, 132, 84], belly: [226, 206, 150], spot: [58, 40, 20], eye: [36, -6, 3.5], tail: [[150, 112, 66], [86, 60, 32]] },
    bass: { body: (p) => { p.moveTo(50, -1); p.quadraticCurveTo(28, -15, -8, -13); p.quadraticCurveTo(-34, -10, -46, -2); p.lineTo(-46, 3); p.quadraticCurveTo(-30, 12, -4, 13); p.quadraticCurveTo(28, 14, 50, 3); p.closePath(); },
      back: [58, 72, 86], side: [192, 200, 210], belly: [244, 246, 250], spot: [40, 46, 60], eye: [38, -4, 3], tail: [[120, 132, 146], [60, 72, 90]] }
  };
  function hunterBody(kind) {
    return one('hunter|' + kind, () => {
      const K = HUNT[kind], R = mulberry32(kind.length * 13), fb = fbmOf(kind.length * 5), p = new Path2D(); K.body(p);
      const spots = [], bumps = [];
      if (kind === 'cod') for (let i = 0; i < 160; i++) spots.push([lerp(-42, 44, R()), lerp(-14, 9, R()), .5 + R() * .9, K.spot, .35 + R() * .3]);
      if (kind === 'sculpin') { for (let i = 0; i < 40; i++) spots.push([lerp(-40, 44, R()), lerp(-8, 8, R()), 1 + R() * 2.4, K.spot, .4]); for (const [x, y] of [[30, -8], [22, -6], [40, -4], [44, 2]]) bumps.push([x, y, 1.6, 1]); }
      return paintShell(-48, -30, 52, 30, {
        paths: p, round: kind === 'sculpin' ? 9 : 11, gloss: kind === 'sculpin' ? .45 : .85, shine: 26, res: 4, spots, bumps, rim: .35,
        grooves: [[[[33, -12], [30, -2], [33, 9]], 1, .8]],
        color: (x, y) => {
          const top = kind === 'sculpin' ? -10 : -15, bot = kind === 'sculpin' ? 12 : 14, t = (y - top) / (bot - top);
          let c = mx(K.back, K.side, ss(.05, .55, t)); c = mx(c, K.belly, ss(.6, .9, t));
          if (kind === 'sculpin') { const m = fb(x * .12, y * .12); c = mx(c, K.spot, ss(.55, .75, m) * .6); }
          if (kind === 'bass') for (let k = 0; k < 7; k++) { const sy = -9 + k * 3 + x * .012 * (k - 3); c = mx(c, K.spot, Math.exp(-((y - sy) ** 2) * 1.6) * (.75 - k * .06) * ss(-44, -30, x) * ss(42, 30, x)); }
          return c.map(v => v * scales(x, y, .45));
        },
        post: (g) => {
          if (kind === 'cod') {
            g.strokeStyle = 'rgba(240,236,214,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(44, -3); g.quadraticCurveTo(10, -9, -40, -3); g.stroke();
            for (const [x0, x1] of [[-2, 22], [-20, -6], [-36, -24]]) { const f = new Path2D(); f.moveTo(x1, -13); f.quadraticCurveTo(x1 - 3, -27, (x0 + x1) / 2 - 2, -26); f.quadraticCurveTo(x0, -20, x0 - 1, -12); f.closePath(); fin(g, f, [104, 98, 56], fanRays((x0 + x1) / 2, -12, [[x1 - 1, -24], [(x0 + x1) / 2, -26], [x0, -20]])); }
            const af = new Path2D(); af.moveTo(10, 13); af.quadraticCurveTo(2, 25, -4, 24); af.quadraticCurveTo(-10, 19, -12, 13); af.closePath(); fin(g, af, [150, 138, 90], fanRays(0, 13, [[6, 22], [0, 24], [-8, 20]]));
          } else if (kind === 'sculpin') {
            const f = new Path2D(); f.moveTo(22, -9); for (let k = 0; k < 7; k++) { const x = 20 - k * 8; f.lineTo(x - 3, -22 + Math.sin(k) * 4); f.lineTo(x - 7, -9); } f.closePath(); fin(g, f, [110, 80, 44], []);
            g.strokeStyle = 'rgba(60,40,16,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(30, -8); g.lineTo(36, -17); g.moveTo(22, -6); g.lineTo(24, -15); g.stroke();
          } else {
            for (const f of [[4, -12, -8, -26, -18, -12], [-20, -11, -28, -21, -34, -10]]) { const q = new Path2D(); q.moveTo(f[0], f[1]); q.quadraticCurveTo(f[2] + 4, f[3] - 2, f[2], f[3]); q.quadraticCurveTo(f[4] + 2, f[5] - 4, f[4], f[5]); q.closePath(); fin(g, q, [80, 92, 108], fanRays(f[2] + 4, f[1], [[f[2], f[3]], [f[2] + 4, f[3] + 2], [f[4] + 2, f[5] - 3]])); }
          }
        }
      });
    });
  }
  function drawHunter(ctx, kind, o) {
    if (!HUNT[kind]) return Sprites.drawHunter(ctx, kind, o);
    const K = HUNT[kind], B = hunterBody(kind), T = tailPart('htail|' + kind, 15, kind === 'sculpin' ? 10 : 13, K.tail[0], K.tail[1], 4);
    if (!B || !T) return Sprites.drawHunter(ctx, kind, o);
    const s = o.s || 1, ph = o.ph || 0, tail = Math.sin(ph) * 5;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-44, 0); ctx.rotate(tail * .035); put(ctx, T); ctx.restore();
    put(ctx, B);
    if (kind === 'sculpin') { const pf = one('sculpinPec', () => { const p = new Path2D(); p.moveTo(28, 6); p.quadraticCurveTo(26, 26, 2, 20); p.quadraticCurveTo(10, 10, 28, 6); p.closePath(); return paintShell(0, 4, 30, 24, { paths: p, round: 1.5, gloss: .3, res: 4, amb: .6, color: (x, y) => mx([170, 130, 80], [110, 70, 40], ss(6, 22, y)), post: (g) => { g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = .4; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(26, 7); g.lineTo(lerp(4, 22, i / 8), lerp(21, 24, i / 8)); g.stroke(); } } }); }); if (pf) { ctx.save(); ctx.translate(27, 6); ctx.rotate(Math.sin(ph * .7) * .12); ctx.translate(-27, -6); ctx.globalAlpha = .9; put(ctx, pf); ctx.restore(); } }
    if (kind === 'cod') { ctx.strokeStyle = 'rgba(120,104,70,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(44, 7); ctx.quadraticCurveTo(45, 11, 46.5, 13.5 + Math.sin(ph) * .5); ctx.stroke(); }
    const [ex, ey, er] = K.eye; eyeLive(ctx, ex, ey, er, kind === 'sculpin' ? [230, 170, 80] : [214, 206, 170]);
    ctx.restore();
  }
  /* --- the harbour seal (canonical 100 long): sleek grey with dark rings, whiskers, big wet eyes --- */
  function drawSeal(ctx, o) {
    const S = one('seal', () => {
      const R = mulberry32(88), p = new Path2D();
      p.moveTo(52, -2); p.quadraticCurveTo(44, -16, 20, -17); p.quadraticCurveTo(-10, -18, -34, -10); p.quadraticCurveTo(-46, -6, -50, 0); p.quadraticCurveTo(-46, 8, -34, 12); p.quadraticCurveTo(-10, 18, 20, 16); p.quadraticCurveTo(44, 14, 52, 4); p.closePath();
      const spots = [];
      for (let i = 0; i < 260; i++) { const x = lerp(-46, 44, R()), y = lerp(-16, 12, R()), r = .35 + R() * 1.1; spots.push([x, y, r, [44, 44, 50], .3 + R() * .25]); if (R() < .3) spots.push([x + .2, y, r * .5, [150, 150, 156], .35]); }
      return paintShell(-52, -20, 56, 20, {
        paths: p, round: 13, gloss: .55, shine: 30, res: 4, spots, rim: .35,
        color: (x, y) => { const t = (y + 17) / 33; let c = mx([88, 90, 98], [140, 140, 146], ss(.1, .6, t)); return mx(c, [206, 200, 192], ss(.62, .95, t)); },
        post: (g) => { g.fillStyle = '#16161a'; g.beginPath(); g.ellipse(51, 0, 2.6, 2, .2, 0, TAU); g.fill(); g.strokeStyle = 'rgba(20,20,24,.5)'; g.lineWidth = .5; g.beginPath(); g.moveTo(51, 2); g.quadraticCurveTo(48, 5, 45, 4.5); g.stroke(); }
      });
    });
    const HF = tailPart('sealHind', 14, 10, [96, 96, 104], [60, 60, 68], 4);
    const FF = one('sealFore', () => { const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(-2, 10, -16, 11); p.quadraticCurveTo(-6, 4, 0, 0); p.closePath(); return paintShell(-18, -2, 2, 13, { paths: p, round: 2, gloss: .8, res: 4, color: () => [92, 92, 100] }); });
    if (!S || !HF || !FF) return Sprites.drawSeal(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, flip = Math.sin(ph) * 5;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-48, 0); ctx.rotate(flip * .05); put(ctx, HF); ctx.restore();
    put(ctx, S);
    ctx.save(); ctx.translate(14, 11); ctx.rotate(Math.sin(ph * .7) * .25); put(ctx, FF); ctx.restore();
    eyeLive(ctx, 40, -6, 3.6, [30, 24, 20]);
    ctx.strokeStyle = 'rgba(240,240,236,.75)'; ctx.lineWidth = .35; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(47, 2 + k * .6); ctx.quadraticCurveTo(54, 2 + k * 2, 59, 3 + k * 4); ctx.stroke(); }
    ctx.restore();
  }
  /* --- the basking shark (canonical 1000 long): the body painted once, the tail, the fin and the great mouth live --- */
  function drawBaskingShark(ctx, o) {
    const B = one('shark', () => {
      const R = mulberry32(5), p = new Path2D();
      p.moveTo(470, -30); p.quadraticCurveTo(440, -90, 300, -100); p.quadraticCurveTo(0, -116, -300, -62); p.quadraticCurveTo(-420, -30, -440, -6); p.lineTo(-440, 14); p.quadraticCurveTo(-300, 56, 0, 86); p.quadraticCurveTo(300, 94, 440, 60); p.quadraticCurveTo(480, 30, 470, -30); p.closePath();
      const df = new Path2D(); df.moveTo(70, -104); df.quadraticCurveTo(-10, -230, -90, -240); df.quadraticCurveTo(-70, -150, -120, -88); df.closePath();
      const d2 = new Path2D(); d2.moveTo(-300, -66); d2.quadraticCurveTo(-330, -110, -360, -112); d2.quadraticCurveTo(-345, -80, -375, -54); d2.closePath();
      const fb = fbmOf(9), spots = [];
      for (let i = 0; i < 70; i++) spots.push([lerp(-420, 420, R()), lerp(-90, 40, R()), 4 + R() * 9, [52, 50, 46], .25]);
      return paintShell(-450, -250, 490, 100, {
        paths: [p, df, d2], round: 70, gloss: .55, shine: 18, res: .55, spots, rim: .3,
        grooves: [0, 1, 2, 3, 4].map(k => [[[330 - k * 22, -72], [314 - k * 22, 0], [330 - k * 22, 72]], 5, 9]),
        color: (x, y) => { let c = mx([62, 60, 54], [108, 104, 94], ss(-80, 30, y)); c = mx(c, [200, 196, 184], ss(36, 80, y)); const m = fb(x * .006, y * .01); return mx(c, [40, 40, 36], ss(.55, .75, m) * .35); }
      });
    });
    const TL = one('sharkTail', () => { const p = new Path2D(); p.moveTo(10, -10); p.quadraticCurveTo(-80, -40, -120, -170); p.quadraticCurveTo(-100, -50, -60, 0); p.quadraticCurveTo(-100, 40, -115, 120); p.quadraticCurveTo(-60, 30, 10, 18); p.closePath(); return paintShell(-125, -175, 15, 125, { paths: p, round: 14, gloss: .5, res: .55, color: (x, y) => mx([60, 58, 52], [84, 82, 74], ss(-60, 60, y)) }); });
    const PF = one('sharkPec', () => { const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(-80, 134, -170, 174); p.quadraticCurveTo(-110, 74, -100, 10); p.closePath(); return paintShell(-175, -4, 4, 178, { paths: p, round: 10, gloss: .5, res: .55, color: (x, y) => mx([66, 64, 58], [96, 94, 86], ss(0, 160, y)) }); });
    if (!B || !TL || !PF) return Sprites.drawBaskingShark(ctx, o);
    const s = o.s || 1, t = o.t || 0, gulp = o.gulp || 0, sw = Math.sin(t * 1.1) * 22;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-430, 4); ctx.rotate(sw / 160); put(ctx, TL); ctx.restore();
    put(ctx, B);
    /* the huge open mouth with the pale gill rakers inside */
    ctx.fillStyle = '#1e1a1c'; ctx.beginPath(); ctx.moveTo(470, -30); ctx.quadraticCurveTo(440, 20 + gulp * 30, 400, 40 + gulp * 26); ctx.quadraticCurveTo(430, 30, 440, 60 + gulp * 20); ctx.quadraticCurveTo(480, 30, 470, -30); ctx.fill();
    ctx.strokeStyle = 'rgba(220,210,200,.35)'; ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(430 - k * 5, -10 + k * 6); ctx.lineTo(412 - k * 5, 30 + gulp * 20 + k * 2); ctx.stroke(); }
    ctx.save(); ctx.translate(230, 66); ctx.rotate(Math.sin(t) * .04); put(ctx, PF); ctx.restore();
    eyeLive(ctx, 420, -44, 6, [40, 40, 40]);
    ctx.restore();
  }

  /* --- food on the floor: blue mussels, rock crabs, green urchins, periwinkles --- */
  function foodPart(kind) {
    return one('food|' + kind, () => {
      const R = mulberry32(kind.length * 17);
      if (kind === 'mussel') {
        const p = new Path2D(); p.moveTo(-6, 1); p.quadraticCurveTo(-4, -5, 4, -4); p.quadraticCurveTo(7, -2, 6, 2); p.quadraticCurveTo(0, 4, -6, 1); p.closePath();
        return paintShell(-7, -6, 8, 5, { paths: p, round: 2.6, gloss: 1, shine: 40, res: 10, rim: .5,
          color: (x, y) => { const d = Math.hypot(x + 6, y - 1), ring = .5 + .5 * Math.sin(d * 4.2); let c = mx([22, 22, 52], [44, 40, 92], ring * .5); return mx(c, [70, 90, 150], ss(4, 8, d) * .25); },
          post: (g) => { g.strokeStyle = 'rgba(200,170,120,.4)'; g.lineWidth = .18; g.beginPath(); g.moveTo(-5.6, 1.2); g.quadraticCurveTo(0, 3.6, 5.8, 1.8); g.stroke(); } });
      }
      if (kind === 'crab') {
        const p = new Path2D(); p.ellipse(0, 0, 5.3, 3.5, 0, 0, TAU);
        const bumps = []; for (let i = 0; i < 9; i++) { const a = Math.PI + .25 + i / 8 * (Math.PI - .5); bumps.push([Math.cos(a) * 5, Math.sin(a) * 3.3, .6, .5]); }
        const spots = []; for (let i = 0; i < 60; i++) spots.push([lerp(-5, 5, R()), lerp(-3.3, 3, R()), .12 + R() * .25, [150, 40, 60], .7]);
        const body = paintShell(-6.5, -4.5, 6.5, 4.5, { paths: p, round: 2.4, gloss: .8, shine: 28, res: 10, bumps, spots, color: (x, y) => mx([222, 170, 90], [170, 96, 50], ss(-3, 3, y)) });
        const cl = new Path2D(); cl.ellipse(0, 0, 2.2, 1.4, 0, 0, TAU);
        const claw = paintShell(-2.6, -1.8, 2.6, 1.8, { paths: cl, round: 1, gloss: .9, res: 12, color: (x) => mx([200, 120, 60], [40, 26, 20], ss(.6, 2.2, x)) });
        return { body, claw };
      }
      if (kind === 'urchin') {
        const p = new Path2D(); p.ellipse(0, 0, 4.6, 3.8, 0, 0, TAU);
        const bumps = []; for (let i = 0; i < 70; i++) bumps.push([lerp(-4.3, 4.3, R()), lerp(-3.6, 3.6, R()), .35, .25]);
        return paintShell(-9, -8, 9, 8, { paths: p, round: 2.8, gloss: .5, res: 10, bumps, color: (x, y) => mx([150, 196, 104], [56, 100, 44], ss(-3, 3, y)),
          post: (g) => { g.lineCap = 'round'; for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 70; i++) { const a = R() * TAU, r0 = 3.2 + R(), L = 2.6 + R() * 1.6, x0 = Math.cos(a) * r0 * 1.05, y0 = Math.sin(a) * r0 * .85; if (pass === 0 && Math.sin(a) < 0) continue; g.strokeStyle = css(mx([90, 150, 70], [160, 120, 170], R() * .4), .9); g.lineWidth = .32; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * .85); g.stroke(); g.strokeStyle = 'rgba(230,250,210,.6)'; g.lineWidth = .12; g.beginPath(); g.moveTo(x0, y0 - .1); g.lineTo(x0 + Math.cos(a) * L * .7, y0 + Math.sin(a) * L * .6 - .1); g.stroke(); } } });
      }
      if (kind === 'snail') {
        const p = new Path2D(); p.arc(0, 0, 4, 0, TAU);
        const grooves = [[[], .25, .5]]; for (let a = .6; a < 9; a += .2) grooves[0][0].push([Math.cos(a) * a * .42, Math.sin(a) * a * .42]);
        const shell = paintShell(-4.6, -4.6, 4.6, 4.6, { paths: p, round: 3, gloss: .9, shine: 34, res: 12, grooves, color: (x, y) => { const d = Math.hypot(x, y), a = Math.atan2(y, x); return mx([110, 96, 70], [40, 34, 26], .5 + .5 * Math.sin(d * 3 - a)); } });
        return { shell };
      }
      return null;
    });
  }
  function drawFood(ctx, it, t) {
    const k = FOOD_KINDS[it.kind], left = it.bites / k.bites, F = foodPart(it.kind);
    if (!F) return Sprites.drawFood(ctx, it, t);
    ctx.save(); ctx.rotate(it.rot * .3);
    if (it.kind === 'mussel') { put(ctx, F); if (left < 1) { ctx.fillStyle = '#f0a860'; ctx.beginPath(); ctx.ellipse(1, 0, 3, 1.6, .2, 0, TAU); ctx.fill(); } }
    else if (it.kind === 'crab') {
      ctx.lineCap = 'round';
      for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) { const kx = s2 * 7, ky = -3 + i * 2 + Math.sin(t * 6 + i) * .6; ctx.strokeStyle = 'rgba(110,60,30,1)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(s2 * 3, -1 + i); ctx.lineTo(kx, ky); ctx.stroke(); ctx.strokeStyle = '#c07a40'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(s2 * 9, 1 + i * 1.5); ctx.stroke(); }
      ctx.save(); ctx.translate(-5.2, 2.6); ctx.rotate(.5); put(ctx, F.claw); ctx.restore(); ctx.save(); ctx.translate(5.2, 2.6); ctx.rotate(-.5 + Math.PI); ctx.scale(1, -1); put(ctx, F.claw); ctx.restore();
      put(ctx, F.body);
      for (const x of [-1.5, 1.5]) { ctx.fillStyle = '#0c0a08'; ctx.beginPath(); ctx.arc(x, -3, .55, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - .15, -3.15, .15, 0, TAU); ctx.fill(); }
      if (left < 1) { ctx.fillStyle = 'rgba(255,244,230,.6)'; ctx.beginPath(); ctx.arc(2, 0, 2.5 * (1 - left), 0, TAU); ctx.fill(); }
    } else if (it.kind === 'urchin') { put(ctx, F); if (left < 1) { ctx.fillStyle = '#f0b860'; ctx.beginPath(); ctx.ellipse(0, .5, 3, 2, 0, 0, TAU); ctx.fill(); } }
    else if (it.kind === 'snail') { ctx.fillStyle = '#4a463a'; ctx.beginPath(); ctx.ellipse(4, 2.4, 3, 1.3, 0, 0, TAU); ctx.fill(); put(ctx, F.shell); }
    ctx.restore();
  }

  /* --- plankton: glassy diatoms, a diatom chain, a dinoflagellate, a copepod with its red eye and oil drop --- */
  function planktonPart(kind) {
    return one('plk|' + kind, () => {
      const RES = 40, R = mulberry32(kind.length);
      if (kind === 'diatom') return paintShell(-1.3, -1.3, 1.3, 1.3, { paths: (() => { const p = new Path2D(); p.arc(0, 0, 1.15, 0, TAU); return p; })(), round: .5, gloss: 1, shine: 40, res: RES, rim: .6,
        color: (x, y) => { const a = Math.atan2(y, x), d = Math.hypot(x, y); return mx([150, 176, 96], [214, 206, 130], (.5 + .5 * Math.cos(a * 16)) * ss(.2, .9, d) * .7); },
        post: (g) => { g.fillStyle = 'rgba(110,90,40,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i) * .45, Math.sin(i * 1.7) * .45, .12, 0, TAU); g.fill(); } } });
      if (kind === 'chain') return paintShell(-2.8, -1.8, 2.8, 1.8, { paths: (() => { const p = new Path2D(); for (let k = -2; k <= 2; k++) p.roundRect(k * .8 - .36, -.46, .72, .92, .2); return p; })(), round: .3, gloss: .9, res: RES, rim: .6,
        color: (x) => mx([150, 190, 90], [200, 200, 120], .5 + .5 * Math.sin(x * 8)),
        post: (g) => { g.strokeStyle = 'rgba(230,250,210,.8)'; g.lineWidth = .06; g.beginPath(); g.moveTo(-2, -.5); g.lineTo(-2.6, -1.6); g.moveTo(2, .5); g.lineTo(2.6, 1.6); g.stroke(); } });
      if (kind === 'dino') return paintShell(-1.2, -1, 1.2, 2.8, { paths: (() => { const p = new Path2D(); p.ellipse(0, 0, 1, .8, 0, 0, TAU); return p; })(), round: .5, gloss: .8, res: RES, rim: .5,
        color: (x, y) => mx([214, 184, 120], [170, 130, 80], ss(-.6, .6, y)),
        post: (g) => { g.strokeStyle = 'rgba(214,184,120,.75)'; g.lineWidth = .08; g.beginPath(); g.moveTo(-1, 0); g.lineTo(1, 0); g.moveTo(0, .8); g.quadraticCurveTo(.8, 1.8, 0, 2.6); g.stroke(); } });
      if (kind === 'copepod') return paintShell(-3.2, -2.4, 3, 2.4, { paths: (() => { const p = new Path2D(); p.ellipse(.2, 0, 1.5, .68, 0, 0, TAU); p.moveTo(-1.2, -.2); p.lineTo(-2.4, -.15); p.lineTo(-2.4, .2); p.lineTo(-1.2, .25); p.closePath(); return p; })(), round: .45, gloss: 1, res: RES, rim: .6,
        color: (x) => mx([236, 206, 156], [214, 170, 110], ss(-1, 1.5, x)),
        post: (g) => { g.fillStyle = 'rgba(230,90,40,.75)'; g.beginPath(); g.ellipse(-.2, .05, .45, .22, 0, 0, TAU); g.fill(); g.fillStyle = '#d01818'; g.beginPath(); g.arc(1.25, -.05, .2, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(236,206,156,.85)'; g.lineWidth = .05; g.beginPath(); g.moveTo(1.2, -.3); g.quadraticCurveTo(2, -1.3, 2.9, -2.2); g.moveTo(1.2, .3); g.quadraticCurveTo(2, 1.3, 2.9, 2.2); g.stroke(); } });
      return null;
    });
  }
  function drawPlankton(ctx, q, night, t) {
    const P = planktonPart(q.kind); if (!P) return Sprites.drawPlankton(ctx, q, night, t);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + t * .2);
    if (q.kind === 'copepod') ctx.rotate(-q.rot - t * .2 + Math.atan2(q.vy, q.vx || .01));
    if (q.kind === 'dino') { const glow = night * .4 + q.glow; if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,230,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); } }
    put(ctx, P);
    ctx.restore();
  }

  /* ============================================================
     THE SEA FLOOR: sugar kelp, cobbles with a hole under the front,
     crevices and mud banks, sea stars, frilled anemones, mussels,
     empty shells, and a seamless detail tile for the cross-section
     ============================================================ */
  /* --- sugar kelp: a long golden-brown blade, blistered down the middle, ruffled at the edges;
         painted straight once, then bent and waved by drawing it in slices --- */
  function kelpBlade(v, far) {
    return one('kelp|' + v + (far ? 'f' : ''), () => {
      const L = 240, Wd = 24, N = 140, p = new Path2D();
      /* the outline: grows out of the stipe, a long ribbon narrowing a little, a rounded tip; ruffled margins */
      const half = (u) => Wd / 2 * Math.sin(Math.min(1, u * 6) * Math.PI / 2) * (1 - u * .3) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - .8) / .2, 2)));
      const ruffle = (u, s) => (Math.sin(u * 46 + v * 3 + s) * .65 + Math.sin(u * 31 + v + s * 2) * .45) * ss(.04, .2, u) * (1 - ss(.9, 1, u));
      p.moveTo(0, 0);
      for (let i = 0; i <= N; i++) { const u = i / N; p.lineTo(-half(u) - ruffle(u, 0), u * L); }
      for (let i = N; i >= 0; i--) { const u = i / N; p.lineTo(half(u) + ruffle(u, 1.7), u * L); }
      p.closePath();
      const fb = fbmOf(80 + v);
      return paintShell(-Wd / 2 - 3, -1, Wd / 2 + 3, L + 1, {
        paths: p, round: 7, gloss: .2, shine: 10, res: 3, amb: .7, rim: 0,
        color: (x, y) => {
          const u = y / L, h = half(u) + .01, edge = clamp(Math.abs(x) / h, 0, 1.3);
          /* a smooth darker central band, puckered margins where the light shines through gold */
          let c = mx([64, 52, 22], [86, 68, 28], fb(x * .08, y * .02));
          const pucker = .5 + .5 * Math.sin(y * .55 + Math.sin(y * .13 + v) * 2);
          c = mx(c, mx([118, 92, 38], [150, 120, 52], pucker), ss(.45, .95, edge) * .7);
          c = mx(c, [58, 50, 22], ss(.16, 0, u) * .5);
          if (far) c = mx(mx(c, [0, 0, 0], .25), [44, 84, 90], .25);
          return c;
        }
      });
    });
  }
  function drawKelp(ctx, k, t, ground, far) {
    const B = kelpBlade(((k.seed >>> 0) || ((k.x * 7) | 0)) % 3, !!far);
    if (!B) return Sprites.drawKelp(ctx, k, t, ground);
    const sw = Math.sin(t * .6 + k.ph) * 10 + Math.sin(t * 1.3 + k.ph * 2) * 4;
    ctx.save(); ctx.translate(k.x, ground);
    /* the holdfast and the stipe */
    ctx.fillStyle = '#3e3018'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * 1.6, 1, 2.2, 1.6, i * .3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#5a4a1e'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * .15, -k.h * .18, sw * .3 + Math.sin(.3 * 9 + t * 1.5 + k.ph) * k.w * .8, -k.h * .3); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,180,110,.35)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-.4, 0); ctx.quadraticCurveTo(sw * .15 - .4, -k.h * .18, sw * .3 - .4, -k.h * .3); ctx.stroke();
    /* the blade in slices, following the classic sway: each slice sheared so its ends meet its neighbours */
    const N = 12, img = B.c, iw = img.width, ih = img.height, w = B.w * k.w * 2.6 / 24;
    const xAt = (u) => sw * (.3 + u * .7) + Math.sin(u * 9 + t * 1.5 + k.ph) * k.w * .8, yAt = (u) => -k.h * (.3 + u * .72);
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N, xa = xAt(u0), xb = xAt(u1), ya = yAt(u0), yb = yAt(u1), hh = ya - yb;
      ctx.save(); ctx.translate((xa + xb) / 2, (ya + yb) / 2); ctx.transform(1, 0, (xa - xb) / hh, 1, 0, 0); ctx.scale(1, -1);
      ctx.drawImage(img, 0, ih * u0, iw, ih / N, -w / 2, -hh / 2 - .25, w, hh + .5);
      ctx.restore();
    }
    ctx.restore();
  }
  /* --- a cobble: a rounded granite stone, speckled, crusted with pink coralline, a few barnacles --- */
  function cobble(v, wq, rq) {
    return one(`cobble|${v}|${wq}|${rq}`, () => {
      const R = mulberry32(900 + v * 31 + wq), w = wq, rad = rq, cy = -rad * .5, p = new Path2D();
      for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU, r = 1 + (R() - .5) * .07 + Math.sin(a * 3 + v) * .03; const x = Math.cos(a) * w * .56 * r, y = cy + Math.sin(a) * rad * .78 * r; k ? p.lineTo(x, y) : p.moveTo(x, y); }
      p.closePath();
      const spots = [], bumps = [], fb = fbmOf(30 + v);
      for (let i = 0; i < w * rad * .6; i++) { const x = (R() - .5) * w * 1.05, y = cy + (R() - .5) * rad * 1.5; spots.push([x, y, .2 + R() * .35, R() < .5 ? [200, 196, 188] : [60, 56, 52], .28]); }
      for (let k = 0; k < 4; k++) { const cx = (R() - .5) * w * .7, cyy = cy - R() * rad * .5, r = 2 + R() * w * .08; for (let i = 0; i < 26; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r; spots.push([cx + Math.cos(a) * d, cyy + Math.sin(a) * d * .6, .8 + R() * 1.4, [172, 112, 128], .35]); bumps.push([cx + Math.cos(a) * d, cyy + Math.sin(a) * d * .6, .9, .15]); } }
      for (let i = 0; i < 6; i++) { const x = (R() - .5) * w * .8, y = cy - rad * (.2 + R() * .5); bumps.push([x, y, 1.1, .7]); spots.push([x, y, 1, [226, 220, 204], .8]); spots.push([x, y - .1, .35, [70, 64, 56], .8]); }
      return paintShell(-w * .62, cy - rad * .9, w * .62, cy + rad * .9, {
        paths: p, round: Math.min(w, rad) * .45, gloss: .25, shine: 12, res: 3, spots, bumps, amb: .5,
        color: (x, y) => { const m = fb(x * .08 + v, y * .08); return mx([150, 144, 134], [110, 104, 96], m); }
      });
    });
  }
  function drawShelter(ctx, sh, time) {
    if (sh.kind === 'hollow') {
      const rad = sh.rad || 12, wq = Math.max(16, Math.round(sh.w / 4) * 4), rq = Math.max(8, Math.round(rad / 2) * 2), img = cobble((sh.x * 13 | 0) % 4 & 3, wq, rq);
      if (!img) return false;
      const y = sh.y;
      ctx.save(); ctx.translate(sh.x, y); ctx.scale(sh.w / wq, rad / rq); put(ctx, img); ctx.restore();
      const w = sh.w, hg = ctx.createRadialGradient(sh.x, y, 1, sh.x, y, w * .42);
      hg.addColorStop(0, 'rgba(6,4,2,.95)'); hg.addColorStop(.75, 'rgba(10,8,4,.85)'); hg.addColorStop(1, 'rgba(10,8,4,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x, y + 1, w * .4, rad * .42, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,180,140,.45)'; ctx.beginPath(); ctx.ellipse(sh.x, y + 1.5, w * .44, 1.4, 0, 0, TAU); ctx.fill();
      return true;
    }
    if (sh.kind === 'crevice') {
      const img = one('slab|' + ((sh.x | 0) % 3), () => {
        const R = mulberry32(sh.x | 0), p = new Path2D(); p.moveTo(-36, -1); p.quadraticCurveTo(-12, -14, 14, -11); p.lineTo(38, -3); p.quadraticCurveTo(10, 1, -36, 1); p.closePath();
        const spots = []; for (let i = 0; i < 90; i++) spots.push([lerp(-34, 36, R()), lerp(-12, 0, R()), .3 + R() * .5, R() < .5 ? [220, 216, 206] : [50, 46, 40], .45]);
        for (let i = 0; i < 30; i++) spots.push([lerp(-20, 10, R()), lerp(-12, -8, R()), .8 + R(), [206, 120, 156], .5]);
        return paintShell(-38, -16, 40, 3, { paths: p, round: 5, gloss: .25, res: 3, spots, amb: .5, color: (x, y) => mx([176, 168, 152], [96, 90, 80], ss(-12, 0, y)) });
      });
      if (!img) return false;
      const y = sh.y, w = sh.w, hg = ctx.createRadialGradient(sh.x, y, 1, sh.x, y - 4, w * .6);
      hg.addColorStop(0, 'rgba(8,6,4,.92)'); hg.addColorStop(1, 'rgba(8,6,4,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x, y - 4, w * .6, 11, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(sh.x, y - 10); ctx.scale(w / 52, 1); put(ctx, img); ctx.restore();
      return true;
    }
    const img = one('bank', () => {
      const R = mulberry32(3), p = new Path2D(); p.moveTo(-36, 1); p.quadraticCurveTo(-12, -20, 18, -16); p.quadraticCurveTo(36, -12, 39, 1); p.closePath();
      const spots = []; for (let i = 0; i < 120; i++) spots.push([lerp(-34, 36, R()), lerp(-16, 0, R()), .3 + R() * .6, R() < .5 ? [130, 120, 100] : [40, 36, 30], .4]);
      return paintShell(-38, -22, 41, 3, { paths: p, round: 8, gloss: .15, res: 3, spots, amb: .5, color: (x, y) => mx([112, 104, 86], [60, 54, 46], ss(-16, 0, y)) });
    });
    if (!img) return false;
    ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sh.w / 60, 1); put(ctx, img); ctx.restore();
    ctx.fillStyle = 'rgba(8,6,4,.88)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y - 4, sh.w * .28, 6, 0, 0, TAU); ctx.fill();
    return true;
  }
  /* --- a sea star (Asterias): five arms, rows of pale spines, the madreporite; coloured by the decor --- */
  function drawStar(ctx, x, y, s, col, a) {
    const img = one('star|' + col, () => {
      const R = mulberry32(col.charCodeAt(2) * 7), c0 = hexToRgb(col), p = new Path2D();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 7.2, an = i * Math.PI / 5; const px = Math.cos(an) * r, py = Math.sin(an) * r; i ? p.lineTo(px, py) : p.moveTo(px, py); }
      p.closePath();
      const bumps = [], spots = [];
      for (let k = 0; k < 5; k++) { const an = k * TAU / 5; for (let j = 1; j < 9; j++) { const d = j * .75; for (const off of [-.5, 0, .5]) { const bx = Math.cos(an) * d - Math.sin(an) * off * (1 - j / 10), by = Math.sin(an) * d + Math.cos(an) * off * (1 - j / 10); bumps.push([bx, by, .35, .35]); if (off === 0 || R() < .4) spots.push([bx, by, .18, [245, 240, 225], .7]); } } }
      spots.push([1, -1, .5, [240, 210, 120], .9]);
      return paintShell(-8, -8, 8, 8, { paths: p, round: 2, gloss: .45, res: 8, bumps, spots, color: (x2, y2) => mx(c0, mx(c0, [255, 230, 200], .3), ss(4, 0, Math.hypot(x2, y2)) * .5) });
    });
    if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s * .55); put(ctx, img); ctx.restore();
    return true;
  }
  /* --- a frilled anemone (Metridium): a smooth column, a cloud of fine tentacles that sway --- */
  function drawAnemone(ctx, x, y, s, col, time, ph) {
    const img = one('anem|' + col, () => {
      const c0 = hexToRgb(col), p = new Path2D(); p.moveTo(-3, 0); p.quadraticCurveTo(-3.4, -3, -2.6, -5); p.lineTo(2.6, -5); p.quadraticCurveTo(3.4, -3, 3, 0); p.closePath();
      return paintShell(-4, -6, 4, 1, { paths: p, round: 2.5, gloss: .5, res: 10, color: (x2, y2) => mx(c0, mx(c0, [150, 110, 100], .4), ss(-4, 0, y2)) });
    });
    if (!img) return false;
    const c0 = hexToRgb(col);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    put(ctx, img);
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) for (let k = 0; k < 30; k++) {
      const ang = -Math.PI + (k + pass * .5) / 29.5 * Math.PI, sway = Math.sin(time * 1.5 + k + ph) * 1.6, L = 7 + (k % 3);
      const ex = Math.cos(ang) * L + sway, ey = -5 + Math.sin(ang) * L * .9;
      ctx.strokeStyle = css(pass ? mx(c0, [255, 255, 255], .3) : mx(c0, [120, 90, 90], .3), pass ? .85 : .9); ctx.lineWidth = pass ? .28 : .42;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(Math.cos(ang) * L * .5, -5 + Math.sin(ang) * L * .6, ex, ey); ctx.stroke();
    }
    ctx.restore();
    return true;
  }
  function drawMusselDecor(ctx, x, y, s, a) {
    const F = foodPart('mussel'); if (!F) return false;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a * .3 - 1.2); ctx.scale(s * .8, s * .8); put(ctx, F); ctx.restore();
    return true;
  }
  function drawShell(ctx, x, y, s, a, col) {
    const img = one('shell|' + col, () => {
      const c0 = hexToRgb(col), p = new Path2D(); p.ellipse(0, 0, 3, 1.6, 0, Math.PI, TAU); p.closePath();
      const grooves = []; for (let k = -4; k <= 4; k++) grooves.push([[[0, .2], [k * .7, -1.5]], .12, .25]);
      return paintShell(-3.4, -2, 3.4, .6, { paths: p, round: 1.2, gloss: .6, res: 14, grooves, color: (x2, y2) => mx(c0, mx(c0, [150, 120, 100], .4), ss(-1.5, 0, y2) * .5) });
    });
    if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a * .2); ctx.scale(s, s); put(ctx, img); ctx.restore();
    return true;
  }
  /* --- the floor's detail: one seamless tile of sand grains, shell bits and pebbles, laid source-atop over the cells --- */
  let floorPat = null;
  function floorPattern(ctx) {
    if (floorPat) return floorPat;
    if (!canBake()) return null;
    const t0 = performance.now(), TW = 400, TH = 260, K = 2, R = mulberry32(2207);
    const c = document.createElement('canvas'); c.width = TW * K; c.height = TH * K;
    const g = c.getContext('2d', SOFT); g.scale(K, K);
    const wrap = (fn) => { for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    for (let i = 0; i < 2600; i++) { const x = R() * TW, y = R() * TH, r = .25 + R() * .5, lt = R() < .55; wrap(() => { g.fillStyle = lt ? 'rgba(255,248,226,.26)' : 'rgba(30,22,10,.3)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); }
    for (let i = 0; i < 60; i++) {
      const x = R() * TW, y = R() * TH, r = .8 + R() * 1.6, rot = R() * TAU, tone = R();
      wrap(() => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = tone < .5 ? 'rgba(250,240,224,.5)' : 'rgba(120,110,150,.45)'; g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(0, -r * 1.2, r, 0); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,50,40,.25)'; g.lineWidth = .15; g.stroke(); g.restore(); });
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * TW, y = R() * TH, r = .7 + R() * R() * 2, e = .5 + R() * .3, rot = (R() - .5), tone = 60 + R() * 70;
      wrap(() => {
        g.fillStyle = 'rgba(10,6,2,.3)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .35, r, r * e, rot, 0, TAU); g.fill();
        const pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1); pg.addColorStop(0, `rgba(${tone + 40},${tone + 34},${tone + 22},.55)`); pg.addColorStop(1, `rgba(${tone * .5},${tone * .46},${tone * .4},.55)`);
        g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill();
      });
    }
    /* a CPU canvas as a pattern source is re-sent to the GPU every frame: hand the tile over once */
    const gc = document.createElement('canvas'); gc.width = c.width; gc.height = c.height; gc.getContext('2d').drawImage(c, 0, 0);
    floorPat = ctx.createPattern(gc, 'repeat');
    if (floorPat.setTransform) floorPat.setTransform(new DOMMatrix().scale(1 / K, 1 / K));
    stat.n++; stat.ms += performance.now() - t0; spent(t0);
    return floorPat;
  }

  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms) }; }

  const api = { beginFrame, drawLobster, lobsterReady, drawExuvia, drawPostlarva, drawLarva, drawEgg, drawFish, drawHunter, drawSeal, drawBaskingShark, drawFood, drawPlankton, drawKelp, drawShelter, drawStar, drawAnemone, drawMusselDecor, drawShell, floorPattern, cached };
  /* anything not painted here is the classic sprite, so render.js can ask Painted for everything */
  for (const k of Object.keys(Sprites)) if (!(k in api)) api[k] = Sprites[k];
  return api;
})();
