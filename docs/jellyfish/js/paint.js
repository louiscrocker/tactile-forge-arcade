/* ============================================================
   paint.js — the painted bay (with the WebGL look, ?gfx=gl)
   ============================================================
     The same animals as sprites.js, with the same options, painted
     by code: no artist and no image files.  The moon jelly's bell is
     painted per pixel once per colour form (a lit, see-through dome,
     brighter at the rim, with radial canals and a soft sheen) and
     its four rings are a painted layer of their own; the arms, the
     fringe of tentacles and a mother's babies are drawn live over
     it.  Also painted: the herring and the little reef fish, the
     plankton, the kelp, sea stars, anemones, mussels and shells,
     the dock's pilings, and a seamless detail tile for the floor.
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
     THE SEA FLOOR: sugar kelp, sea stars, frilled anemones, mussels,
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
  /* ============================================================
     THE MOON JELLY, painted: the bell is a lit, see-through dome,
     painted per pixel once per colour form: thin and clear in the
     middle, thicker and brighter towards the rim (you look through
     more jelly there), faint radial canals, a milky ring canal, a
     soft sheen; the four rings are a separate painted layer (a
     young jelly has none yet).  Per frame the dome is squeezed for
     the pulse and the arms, the fringe and any babies are drawn
     live, see-through, over it.
     ============================================================ */
  const BR = 96;                                  /* the painted bell's radius, in pixels */
  const BH = .54, BU = .14;                       /* dome height and underside, as parts of the radius */
  function bellParts(form) {
    return job('bell|' + form, [(parts) => {
      const f = FORMS[form] || FORMS.pink, tint = hexToRgb(f.bell), edge = hexToRgb(f.bell2);
      const W = BR * 2 + 4, H = Math.ceil(BR * (BH + BU)) + 6, ox = W / 2, oy = Math.ceil(BR * BH) + 3;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', SOFT), img = g.createImageData(W, H), d = img.data;
      const N = fbmOf(form.length * 31 + 7);
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const u = (px - ox) / BR, v = (py - oy) / BR;
        if (Math.abs(u) > 1) continue;
        const topY = -BH * Math.pow(1 - u * u, .55), botY = BU * (1 - u * u) * .8;
        if (v < topY || v > botY) continue;
        /* where on the dome: z = how much it faces you; a sphere-ish normal from the profile */
        const hdome = (v - topY) / Math.max(.01, botY - topY);
        const nz = Math.sqrt(Math.max(0, 1 - u * u)), ny = -Math.min(1, (botY - v) / (BH + BU)) * .9;
        const edgeD = Math.min(1 - Math.abs(u), (v - topY) * 3, (botY - v) * 4);
        const rim = Math.exp(-edgeD / .09);
        /* radial canals: meridians fanning out from the top */
        const az = Math.atan2(u, .35 + (v - topY) * 2.2);
        const canal = Math.pow(Math.max(0, Math.cos(az * 16)), 18) * (1 - hdome * .3) * .55;
        const ringCanal = Math.exp(-Math.pow((v - (botY - .03)) / .018, 2)) * .5;
        const n = N(u * 4, v * 4);
        const light = clamp(.55 + .45 * (-ny * .5 + nz * .4 + u * -.25), 0, 1);
        const spec = Math.pow(clamp(1 - Math.hypot(u + .32, v + BH * .62) / .28, 0, 1), 2) * .9;
        let a = .14 + rim * .55 + canal * .5 + ringCanal * .4 + n * .05 + spec * .4;
        const col = mx(tint, edge, rim * .7);
        const k = (py * W + px) * 4;
        const lum = .82 + light * .3 + spec;
        d[k] = clamp(col[0] * lum + 255 * (canal * .3 + spec * .6), 0, 255);
        d[k + 1] = clamp(col[1] * lum + 255 * (canal * .3 + spec * .6), 0, 255);
        d[k + 2] = clamp(col[2] * lum + 255 * (canal * .3 + spec * .6), 0, 255);
        d[k + 3] = clamp(a, 0, .92) * 255;
      }
      g.putImageData(img, 0, 0);
      parts.bell = { c: handOver(c), ox, oy, W, H };
    }, (parts) => {
      /* the four rings (the gonads) and the stomach between them, seen a little from above */
      const f = FORMS[form] || FORMS.pink, ring = hexToRgb(f.ring), ring2 = hexToRgb(f.ring2);
      const W = BR * 2 + 4, H = Math.ceil(BR * (BH + BU)) + 6, ox = W / 2, oy = Math.ceil(BR * BH) + 3;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', SOFT);
      const gy = oy - BR * BH * .4, tilt = .34, R1 = BR * .2, r2 = BR * .15;
      g.lineCap = 'round';
      for (const back of [true, false]) for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4, isBack = Math.sin(a) < 0;
        if (isBack !== back) continue;
        const cx = ox + Math.cos(a) * R1, cz = Math.sin(a) * R1;
        const pts = []; for (let j = 0; j <= 24; j++) { const th = a + .75 + j / 24 * (TAU - 1.5); pts.push([cx + Math.cos(th) * r2, gy + (cz + Math.sin(th) * r2) * tilt]); }
        for (const [wd, col, al] of [[BR * .11, back ? ring2 : ring, back ? .35 : .55], [BR * .065, back ? ring2 : ring, back ? .6 : .9], [BR * .025, mx(back ? ring2 : ring, [255, 255, 255], .5), back ? .3 : .7]]) {
          g.strokeStyle = css(col, al); g.lineWidth = wd; g.beginPath(); pts.forEach(([x, y], j) => j ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
        }
      }
      g.filter = 'blur(.6px)'; g.drawImage(c, 0, 0); g.filter = 'none';
      parts.rings = { c: handOver(c), ox, oy, W, H };
    }]);
  }
  function jellyReady(form) { return !!bellParts(FORMS[form] ? form : 'pink'); }
  function drawJelly(ctx, o) {
    const form = FORMS[o.form] ? o.form : 'pink', P = bellParts(form);
    if (!P) return Sprites.drawJelly(ctx, o);
    const r = o.r || 10, c = clamp(o.pulse || 0, 0, 1);
    const w = r * (1 - .17 * c), h = r * (.5 + .22 * c), k = r / BR;
    /* the arms, the fringe and the babies, live and see-through, behind and through the bell */
    Sprites.drawJelly(ctx, Object.assign({}, o, { skipBell: true }));
    const sx = w / r, sy = h / (r * .5);
    const b = P.bell;
    ctx.drawImage(b.c, -b.ox * k * sx, -b.oy * k * sy, b.W * k * sx, b.H * k * sy);
    const rings = o.rings === undefined ? 1 : o.rings;
    if (rings > .02) { ctx.save(); ctx.globalAlpha *= rings; ctx.drawImage(P.rings.c, -b.ox * k * sx, -b.oy * k * sy, b.W * k * sx, b.H * k * sy); ctx.restore(); }
    else { ctx.fillStyle = 'rgba(250,220,235,.25)'; ctx.beginPath(); ctx.ellipse(0, -h * .38, r * .26, r * .07, 0, 0, TAU); ctx.fill(); }
    /* food stuck in the slime on the bell */
    if (o.stuck) { const R = mulberry32(7); for (let j = 0; j < o.stuck; j++) { const u = R() * 1.6 - .8, x = u * w * .9, y = -Math.sqrt(Math.max(0, 1 - u * u)) * h * (.4 + R() * .5); ctx.fillStyle = j % 3 ? 'rgba(170,236,120,.95)' : 'rgba(255,206,150,.95)'; ctx.beginPath(); ctx.arc(x, y, Math.max(.6, r * .045), 0, TAU); ctx.fill(); } }
  }
  /* the dock's pilings: weathered wood with grain, green weed and barnacles at the tide line, mussels low down */
  function pilingPart() {
    return one('piling', () => {
      const W = 24, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', SOFT), img = g.createImageData(W, H), d = img.data, N = fbmOf(77);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = x / (W - 1) * 2 - 1, round = Math.sqrt(Math.max(0, 1 - u * u)), grain = N(x * .15, y * .02) * .6 + .4 * Math.sin(y * .3 + N(x * .3, y * .05) * 6);
        const sh = .45 + .55 * round * (1 - u * .35);
        const base = [128, 98, 66], dark = [70, 50, 32];
        const col = mx(dark, base, clamp(grain * .7 + .3, 0, 1));
        const k = (y * W + x) * 4; d[k] = col[0] * sh; d[k + 1] = col[1] * sh; d[k + 2] = col[2] * sh; d[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return { c: handOver(c), W, H };
    });
  }
  function drawPiling(ctx, x, top, floor) {
    const P = pilingPart(); if (!P) return false;
    ctx.drawImage(P.c, x - 6, top, 12, floor - top);
    ctx.fillStyle = 'rgba(60,110,60,.7)'; ctx.beginPath(); ctx.moveTo(x - 6.5, -9); for (let k = 0; k <= 6; k++) ctx.lineTo(x - 6.5 + k * 13 / 6, 6 + (k % 2) * 4); ctx.lineTo(x + 6.5, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0d8c8'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x - 4 + (k % 3) * 4, 9 + Math.floor(k / 3) * 4, 1.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#1e1e48'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x - 4.5 + k * 2.3, floor - 10 - (k % 2) * 4, 1.6, 3, .3, 0, TAU); ctx.fill(); }
    return true;
  }

  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms) }; }

  const api = { beginFrame, drawJelly, jellyReady, drawPiling, drawFish, drawPlankton, drawKelp, drawStar, drawAnemone, drawMusselDecor, drawShell, floorPattern, cached };
  /* anything not painted here is the classic sprite, so render.js can ask Painted for everything */
  for (const k of Object.keys(Sprites)) if (!(k in api)) api[k] = Sprites[k];
  return api;
})();
