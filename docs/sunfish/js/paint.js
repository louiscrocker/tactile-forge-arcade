/* ============================================================
   paint.js — the painted sea (with the WebGL look, on by default)
   ============================================================
     The same animals as sprites.js, with the same options, painted
     by code: no artist and no image files.  The sunfish's body is
     painted per pixel once per form and stage (a lit, rough, silvery
     disc with soft blotches), its tall fins and clavus are painted
     parts placed each frame so they can flap; the herring-style
     fish and the plankton are Jellyfish's painted ones.  Painting
     happens on CPU canvases with a per-frame time budget; anything
     not painted yet is drawn the classic way meanwhile.
   ============================================================ */
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
     THE SUNFISH: body, fins and clavus painted once per form;
     the fins are placed along bones each frame so they flap
     ============================================================ */
  function molaParts(form, juv) {
    const F = FORMS[form] || FORMS.normal, key = 'mola|' + form + (juv ? '|j' : '');
    return job(key, [
      (parts) => {
        const round = juv ? 1.05 : 1, h = 34 * round, p = new Path2D();
        p.moveTo(50, 2); p.bezierCurveTo(50, -h * .9, 18, -h * 1.2, -30, -h * .95); p.lineTo(-30, h * .95); p.bezierCurveTo(18, h * 1.2, 50, h * .9, 50, 2); p.closePath();
        const b = hexToRgb(F.body), b2 = hexToRgb(F.body2), be = hexToRgb(F.belly), sp = hexToRgb(F.spots), fb = fbmOf(form.length * 13 + 7), R = mulberry32(form.length * 31 + (juv ? 5 : 0));
        const bumps = []; for (let i = 0; i < 520; i++) bumps.push([lerp(-30, 50, R()), lerp(-40, 40, R()), .5 + R() * .7, .12 + R() * .1]);
        const spots = []; if (form === 'spotted') for (let i = 0; i < 70; i++) spots.push([lerp(-26, 44, R()), lerp(-32, 32, R()), 1.2 + R() * 2.6, sp, .5]);
        for (let i = 0; i < 16; i++) spots.push([lerp(-24, 40, R()), lerp(-30, 30, R()), 4 + R() * 6, mx(b, [255, 255, 255], .25), .12]);
        parts.body = paintShell(-32, -44, 52, 44, { paths: p, round: 14, gloss: .55, shine: 18, res: 3, amb: .5, rim: .3, bumps, spots,
          color: (x, y) => { const t = (y + h) / (2 * h); let c = mx(b2, b, ss(0, .45, t)); c = mx(c, be, ss(.58, 1, t)); const n = fb(x * .05, y * .05); c = c.map(v => v * (.88 + .24 * n)); return mx(c, b2, ss(-18, -30, x) * .35); },
          post: (g) => { g.strokeStyle = css(mx(b2, [0, 0, 0], .3), .35); g.lineWidth = .5; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(-28, -28 + i * 9); g.quadraticCurveTo(-10, -26 + i * 8.5, 6, -22 + i * 7.5); g.stroke(); } } });
      },
      (parts) => {
        const p = new Path2D(); p.moveTo(-14, 0); p.quadraticCurveTo(-12, 30, 0, 54); p.quadraticCurveTo(8, 30, 14, 0); p.closePath();
        const f = hexToRgb(F.fin), b2 = hexToRgb(F.body2);
        parts.fin = paintShell(-15, -1, 15, 55, { paths: p, round: 5, gloss: .4, shine: 14, res: 4, amb: .55, rim: .2,
          color: (x, y) => mx(f, b2, ss(20, 54, y) * .5 + ss(8, 14, Math.abs(x)) * .25),
          post: (g) => { g.strokeStyle = css(mx(b2, [0, 0, 0], .2), .4); g.lineWidth = .35; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 3, 0); g.lineTo(i * .9, 50 - Math.abs(i) * 4); g.stroke(); } } });
      },
      (parts) => {
        const n = juv ? 5 : 8, ch = 34 * (juv ? 1.05 : 1) * .95, p = new Path2D();
        Sprites.clavusPath(p, ch, n, juv ? 9 : 14, 0);
        const f = mx(hexToRgb(F.fin), hexToRgb(F.belly), .25), b2 = hexToRgb(F.body2);
        parts.clavus = paintShell(-50, -ch - 2, -22, ch + 2, { paths: p, round: 3, gloss: .35, res: 4, amb: .55, color: (x) => mx(f, b2, ss(-30, -46, x) * .3),
          post: (g) => { g.strokeStyle = css(b2, .35); g.lineWidth = .35; for (let i = 0; i <= 12; i++) { const y = -ch + i * ch / 6; g.beginPath(); g.moveTo(-28, y * .9); g.lineTo(-32 - 14 * Math.sqrt(Math.max(0, 1 - (y / ch) ** 2)), y); g.stroke(); } } });
      }
    ]);
  }
  function drawSunfish(ctx, o) {
    const st = o.stage || 'mola';
    if (st !== 'mola' && st !== 'juvenile') return Sprites.drawSunfish(ctx, o);
    const juv = st === 'juvenile', P = molaParts(FORMS[o.form] ? o.form : 'normal', juv);
    if (!P) return Sprites.drawSunfish(ctx, o);
    const s = o.s || 1, f = Math.sin(o.flap || 0), k = .62 + .38 * Math.abs(Math.cos(o.flap || 0)), lean = f * 9, H = juv ? 40 : 54;
    ctx.save(); ctx.scale(s, s);
    if (o.roll) { ctx.rotate(-.1 * o.roll); ctx.scale(1, 1 - .62 * o.roll); }
    bone(ctx, P.fin, [-20, -27], [-24 + lean, -30 - H * k], 54);
    bone(ctx, P.fin, [-20, 27], [-24 + lean, 30 + H * k], 54);
    put(ctx, P.clavus);
    put(ctx, P.body);
    const cols = Sprites.molaCols(o.form, o), R = mulberry32(o.seed || 7);
    ctx.save(); Sprites.bodyPath(ctx, juv ? 1.05 : 1); ctx.clip();
    if (o.dark) { ctx.fillStyle = `rgba(20,28,38,${.4 * o.dark})`; ctx.fillRect(-40, -50, 100, 100); }
    if (o.spots > .05) for (let i = 0; i < 34; i++) { ctx.fillStyle = css(cols.sp, .5 * o.spots); ctx.beginPath(); ctx.arc(-26 + R() * 72, -30 + R() * 60, 1.5 + R() * 3.2, 0, TAU); ctx.fill(); }
    const lice = Math.round((o.lice || 0) * 26);
    for (let i = 0; i < lice; i++) { const x = -24 + R() * 66, y = -28 + R() * 56; ctx.fillStyle = 'rgba(70,52,40,.85)'; ctx.beginPath(); ctx.ellipse(x, y, 1.6, 1, R() * 3, 0, TAU); ctx.fill(); }
    if (juv && (o.spiky || 0) > .02) { ctx.fillStyle = css(cols.b, .9); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, x = 10 + Math.cos(a) * 36, y = Math.sin(a) * 32, L = 5 * o.spiky; ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * 2, y + Math.cos(a) * 2); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.lineTo(x + Math.sin(a) * 2, y - Math.cos(a) * 2); ctx.fill(); } }
    ctx.restore();
    ctx.fillStyle = css(cols.b2, .7); ctx.beginPath(); ctx.ellipse(22, 3, 2, 4.5, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = css(mx(cols.fin, cols.b2, .3), .95); ctx.save(); ctx.translate(19, 4); ctx.rotate(.5 + f * .3); ctx.beginPath(); ctx.ellipse(-5, 0, 7, 3.2, 0, 0, TAU); ctx.fill(); ctx.restore();
    eyeLive(ctx, 36.5, -7, 4.8, [222, 228, 232]);
    const m = 1.6 + (o.eat || 0) * 2.2;
    ctx.fillStyle = css(cols.b2); ctx.beginPath(); ctx.ellipse(49.5, 3, m * .7, m, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1e1e'; ctx.beginPath(); ctx.ellipse(50, 3, m * .4, m * .65, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function molaReady(form) { return !!molaParts(FORMS[form] ? form : 'normal', false); }

  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms) }; }
  const api = { beginFrame, drawFish, drawPlankton, drawSunfish, molaReady, cached };
  /* anything not painted here is the classic sprite, so render.js can ask Painted for everything */
  for (const k of Object.keys(Sprites)) if (!(k in api)) api[k] = Sprites[k];
  return api;
})();
