/* ============================================================
   paint.js — the painted sea (with the WebGL look, ?gfx=gl)
   ============================================================
     The same animals as sprites.js, with the same options and the
     same joints, so every stage, pose, look and moult still works.
     Plankton is glass, not armour: each body is painted per pixel
     as see-through glass (paintGlass): what is inside (a green gut,
     the golden oil sac, a mother's ripe eggs, red colour cells) is
     painted first, then a dome of glass over it, clear where it
     faces you and bright at the rim where the light bends, with a
     wet highlight.  The copepod's front body and tail, the
     nauplius and the egg are painted once per look and cached;
     feelers, legs, bristles and the red eye are drawn live.
     Fish, the basking shark and the right whale are painted per
     pixel as domes (paintShell) with spots and bumps (the whale's
     pale callosities); its mouth and baleen are live.  Diatoms,
     chains and dinoflagellates are little painted glass cells.
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
     GLASS: plankton is see-through, so its bodies are painted as
     glass rather than armour.  The outline becomes a dome (the same
     distance field as paintShell); what is inside (gut, oil, eggs,
     colour cells) is painted first, then the glass over it: nearly
     clear where it faces you, bright and coloured at the rim where
     the light bends (a fresnel edge), with a wet highlight on top.
     o: { paths, res, round, tint [r,g,b], edge [r,g,b], inner(g), post(g), clear (0..1, how see-through the middle is) }
     ============================================================ */
  function paintGlass(x0, y0, x1, y1, o) {
    const t0 = performance.now(), RES = o.res || 16;
    const W = Math.max(2, Math.ceil((x1 - x0) * RES)), H = Math.max(2, Math.ceil((y1 - y0) * RES)), n = W * H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', SOFT);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    /* inside first: clipped to the body */
    if (o.inner) { g.save(); g.beginPath(); for (const p of [].concat(o.paths)) g.clip(p); o.inner(g); g.restore(); }
    /* the mask and the dome */
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mg = m.getContext('2d', SOFT); mg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); mg.fillStyle = '#fff';
    for (const p of [].concat(o.paths)) mg.fill(p);
    const md = mg.getImageData(0, 0, W, H).data;
    const dist = new Float32Array(n);
    for (let i = 0; i < n; i++) dist[i] = md[i * 4 + 3] > 127 ? 1e6 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!dist[i]) continue; let d = dist[i]; d = Math.min(d, (x > 0 ? dist[i - 1] : 0) + 1, (y > 0 ? dist[i - W] : 0) + 1, (x > 0 && y > 0 ? dist[i - W - 1] : 0) + 1.414, (x < W - 1 && y > 0 ? dist[i - W + 1] : 0) + 1.414); dist[i] = d; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!dist[i]) continue; let d = dist[i]; d = Math.min(d, (x < W - 1 ? dist[i + 1] : 0) + 1, (y < H - 1 ? dist[i + W] : 0) + 1, (x < W - 1 && y < H - 1 ? dist[i + W + 1] : 0) + 1.414, (x > 0 && y < H - 1 ? dist[i + W - 1] : 0) + 1.414); dist[i] = d; }
    const R = Math.max(1, (o.round || 2) * RES), hgt = new Float32Array(n);
    for (let i = 0; i < n; i++) if (dist[i]) { const t = 1 - Math.min(dist[i], R) / R; hgt[i] = R * Math.sqrt(1 - t * t); }
    /* soften the dome: the chamfer distance leaves creases along the middle of a shape */
    {
      const r = Math.max(1, Math.round(R * .35)), tmp = new Float32Array(n);
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < H; y++) { let acc = 0; const row = y * W; for (let x = -r; x < W; x++) { if (x + r < W) acc += hgt[row + x + r]; if (x - r - 1 >= 0) acc -= hgt[row + x - r - 1]; if (x >= 0) tmp[row + x] = acc / (2 * r + 1); } }
        for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y < H; y++) { if (y + r < H) acc += tmp[(y + r) * W + x]; if (y - r - 1 >= 0) acc -= tmp[(y - r - 1) * W + x]; if (y >= 0) { const i = y * W + x; hgt[i] = dist[i] ? acc / (2 * r + 1) : 0; } } }
      }
    }
    const glass = mg.createImageData(W, H), D = glass.data;
    const tint = o.tint || [240, 230, 220], edge = o.edge || tint, clear = o.clear === undefined ? .8 : o.clear;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!dist[i]) continue;
      const hl = x > 0 && dist[i - 1] ? hgt[i - 1] : hgt[i] - R * .5, hr = x < W - 1 && dist[i + 1] ? hgt[i + 1] : hgt[i] - R * .5;
      const hu = y > 0 && dist[i - W] ? hgt[i - W] : hgt[i] - R * .5, hd = y < H - 1 && dist[i + W] ? hgt[i + W] : hgt[i] - R * .5;
      let nx = (hl - hr) * .5, ny = (hu - hd) * .5, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const ndl = nx * LV[0] + ny * LV[1] + nz * LV[2], ndh = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
      const fr = Math.pow(1 - nz, 1.4), diff = .6 + .4 * Math.max(0, ndl);
      const spec = Math.pow(ndh, 34) * .95 + Math.pow(ndh, 6) * .06;
      const col = mx(tint, edge, ss(.05, .7, fr));
      const a = clamp((1 - clear) * .55 + .12 + fr * .85 + spec, 0, .97);
      const k = i * 4;
      D[k] = clamp(col[0] * diff + spec * 255, 0, 255); D[k + 1] = clamp(col[1] * diff + spec * 255, 0, 255); D[k + 2] = clamp(col[2] * diff + spec * 255, 0, 255); D[k + 3] = a * 255;
    }
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, W, H); mg.putImageData(glass, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(m, 0, 0); g.restore();
    if (o.post) { g.save(); o.post(g); g.restore(); }
    stat.n++; stat.ms += performance.now() - t0;
    return { c: handOver(c), x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  const one = (key, make) => { const j = job(key, [(parts) => { parts.v = make(); }]); return j ? j.v : null; };
  const FC = (form) => { const F = FORMS[form] || FORMS.red; return { body: hexToRgb(F.body), edge: hexToRgb(F.edge), pig: hexToRgb(F.pig), oil: hexToRgb(F.oil), eye: F.eye }; };

  /* ============================================================
     THE COPEPOD: the glassy front body (prosome) and tail (urosome)
     painted once per look; feelers, legs, bristles and the eye live
     ============================================================ */
  function prosome() { const p = new Path2D(); p.moveTo(11, -.4); p.bezierCurveTo(11.2, -2.6, 9.4, -3.6, 7, -3.6); p.lineTo(-2.6, -3.3); p.bezierCurveTo(-5, -3.1, -6, -1.6, -6, 0); p.bezierCurveTo(-6, 1.6, -4.6, 2.5, -2.6, 2.6); p.lineTo(6.4, 2.6); p.bezierCurveTo(9.4, 2.5, 10.9, 1.4, 11, -.4); p.closePath(); return p; }
  function bodyPart(form, oilQ, gutQ, ripe) {
    return one(`copBody|${form}|${oilQ}|${gutQ}|${ripe ? 1 : 0}`, () => {
      const C = FC(form), R = mulberry32(7 + oilQ * 3 + gutQ), oil = oilQ / 4, gut = gutQ / 2;
      return paintGlass(-6.5, -4.2, 11.6, 3.2, { paths: prosome(), round: 2.6, res: 16, tint: mx(C.body, [255, 255, 255], .2), edge: C.edge, clear: .82,
        inner: (g) => {
          /* the gut: a tube from the mouth to the tail, green-brown with diatoms */
          const gc = mx([200, 176, 130], [96, 150, 60], gut);
          g.strokeStyle = css(gc, .75); g.lineWidth = 1.05; g.lineCap = 'round';
          g.beginPath(); g.moveTo(8.6, .3); g.quadraticCurveTo(2, 1.15, -6.4, .45); g.stroke();
          g.strokeStyle = css(mx(gc, [40, 60, 20], .4), .5); g.lineWidth = .35; g.beginPath(); g.moveTo(7.6, .5); g.quadraticCurveTo(2, 1.3, -5.6, .6); g.stroke();
          /* the oil sac: a long amber drop with a bright edge */
          if (oil > .02) {
            const ox = 1.5 - (1 - oil) * 1.5, rx = 1.2 + oil * 5.6, ry = .45 + oil * 1.35;
            const og = g.createRadialGradient(ox - rx * .3, -1.2 - ry * .4, .1, ox, -1.2, rx);
            og.addColorStop(0, css(mx(C.oil, [255, 250, 220], .55), .95)); og.addColorStop(.6, css(C.oil, .9)); og.addColorStop(1, css(mx(C.oil, [150, 60, 10], .5), .85));
            g.fillStyle = og; g.beginPath(); g.ellipse(ox, -1.2, rx, ry, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,240,.55)'; g.beginPath(); g.ellipse(ox - rx * .2, -1.2 - ry * .55, rx * .55, ry * .2, 0, 0, TAU); g.fill();
          }
          /* ripe eggs along a mother's back */
          if (ripe) for (let k = 0; k < 10; k++) { const ex = 6.4 - k * 1.15, ey = -2.4 + Math.sin(k * 1.3) * .25; const eg = g.createRadialGradient(ex - .15, ey - .15, .05, ex, ey, .6); eg.addColorStop(0, 'rgba(170,130,190,.95)'); eg.addColorStop(1, 'rgba(70,40,90,.9)'); g.fillStyle = eg; g.beginPath(); g.arc(ex, ey, .55, 0, TAU); g.fill(); }
          /* colour cells: little red-orange stars of pigment, thickest by the mouth */
          for (let k = 0; k < 26; k++) {
            const x = k < 10 ? 7 + R() * 3.4 : -5 + R() * 13, y = k < 10 ? .4 + R() * 1.8 : -2.8 + R() * 5;
            const r = .12 + R() * .2; g.fillStyle = css(C.pig, .55 + R() * .35); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            g.strokeStyle = css(C.pig, .35); g.lineWidth = .05; for (let j = 0; j < 5; j++) { const a = R() * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 2.6, y + Math.sin(a) * r * 2.6); g.stroke(); }
          }
          /* the heart, a faint pulse on the back */
          g.fillStyle = 'rgba(255,200,200,.25)'; g.beginPath(); g.ellipse(-1.4, -2.5, .9, .4, 0, 0, TAU); g.fill();
        },
        post: (g) => {
          g.setTransform(16, 0, 0, 16, 6.5 * 16, 4.2 * 16);
          /* segment lines across the back, and the head's edge */
          g.strokeStyle = css(mx(C.edge, [255, 255, 255], .3), .55); g.lineWidth = .1;
          for (const x of [5.4, 2.8, .4, -2]) { g.beginPath(); g.moveTo(x, -3.5); g.quadraticCurveTo(x - .5, -2.4, x - .2, -1.3); g.stroke(); }
          g.beginPath(); g.moveTo(8.6, -3.4); g.quadraticCurveTo(7.7, -1.6, 8.4, 0); g.stroke();
        } });
    });
  }
  function uroPart(form, nSeg, girl) {
    return one(`copTail|${form}|${nSeg}|${girl ? 1 : 0}`, () => {
      const C = FC(form), tl = 5.2 + nSeg * 1.1;
      const p = new Path2D(); p.moveTo(.6, -1.15); p.bezierCurveTo(-tl * .4, -1, -tl * .8, -.7, -tl, -.62); p.lineTo(-tl, .62); p.bezierCurveTo(-tl * .8, .7, -tl * .4, 1, .6, 1.15); p.closePath();
      if (girl) p.ellipse(-.6, .75, 1.2, 1, 0, 0, TAU);
      return paintGlass(-tl - .4, -1.6, 1, 2, { paths: p, round: .9, res: 16, tint: mx(C.body, [255, 255, 255], .2), edge: C.edge, clear: .8,
        inner: (g) => { g.strokeStyle = 'rgba(150,140,90,.55)'; g.lineWidth = .5; g.beginPath(); g.moveTo(.6, .1); g.lineTo(-tl + .4, .05); g.stroke(); g.fillStyle = css(C.pig, .8); g.beginPath(); g.ellipse(-tl + .3, 0, .7, .5, 0, 0, TAU); g.fill(); },
        post: (g) => { g.setTransform(16, 0, 0, 16, (tl + .4) * 16, 1.6 * 16); g.strokeStyle = css(C.edge, .6); g.lineWidth = .1; for (let k = 1; k < nSeg; k++) { const x = -k * tl / nSeg; g.beginPath(); g.moveTo(x, -.95 + k * .07); g.lineTo(x, .95 - k * .07); g.stroke(); } } });
    });
  }
  /* a feeler: tapered, banded, with fine bristles and a red tip */
  function feeler(ctx, C, o, far, fold) {
    const x0 = 9.4, y0 = -2.6, ex = lerp(-12 - (o.step >= 12 ? 3 : 0), -9, fold), ey = lerp(-10.5 + (far ? 1.4 : 0) + Math.sin((o.ph || 0) * .3) * .4, -3.6, fold), cx = 1, cy = lerp(-10.5, -4.4, fold);
    const pt = (t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * ey];
    ctx.lineCap = 'round';
    const N = 12;
    for (let k = 0; k < N; k++) { const a = pt(k / N), b = pt((k + 1) / N); ctx.strokeStyle = css(mx(C.edge, C.pig, (k / N) * (k / N)), far ? .5 : .9); ctx.lineWidth = lerp(.55, .18, k / N) * (far ? .8 : 1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    if (o.simple) return;
    const nb = o.step >= 12 && o.sex === 'boy' ? 24 : 15;
    ctx.strokeStyle = css(mx(C.edge, [255, 255, 255], .4), far ? .25 : .5); ctx.lineWidth = .07;
    for (let k = 1; k < nb; k++) { const [px, py] = pt(k / nb); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - .6, py - 1.3 + fold * .9); ctx.stroke(); }
  }
  function drawCopepod(ctx, o) {
    const step = clamp(o.step || 12, 7, 12), form = FORMS[o.form] ? o.form : 'red';
    const oilQ = Math.round(clamp(o.oil || 0, 0, 1) * 4), gutQ = Math.round(clamp(o.gut === undefined ? .5 : o.gut, 0, 1) * 2);
    const nSeg = step >= 12 ? (o.sex === 'boy' ? 5 : 4) : clamp(step - 7, 1, 4), girl = step >= 12 && o.sex === 'girl';
    const B = bodyPart(form, oilQ, gutQ, !!o.ripe), U = uroPart(form, nSeg, girl);
    if (!B || !U) return Sprites.drawCopepod(ctx, o);
    const C = FC(form), s = o.s || 1, ph = o.ph || 0, jump = o.jump || 0, sleep = !!o.sleep, fold = Math.max(jump, sleep ? 1 : 0);
    ctx.save(); ctx.scale(s, s); ctx.scale(.82 + (step - 7) * .045, 1);
    feeler(ctx, C, Object.assign({}, o, { step }), true, fold);
    const tl = 5.2 + nSeg * 1.1, bend = Math.sin(ph * 1.3) * .06 * (sleep ? 0 : 1) - jump * .1;
    ctx.save(); ctx.translate(-5.6, .2); ctx.rotate(bend);
    /* the tail's long bristles, fanned, behind the tail itself */
    ctx.strokeStyle = css(mx(C.edge, [255, 255, 255], .3), .75); ctx.lineWidth = .1;
    for (let k = 0; k < 6; k++) { const a = Math.PI + (k - 2.5) * .11 + Math.sin(ph + k) * .03; ctx.beginPath(); ctx.moveTo(-tl, (k - 2.5) * .18); ctx.quadraticCurveTo(-tl - 2.4, (k - 2.5) * .5, -tl + Math.cos(a) * 5.2, (k - 2.5) * .18 + Math.sin(a) * 5.2); ctx.stroke(); }
    put(ctx, U);
    ctx.restore();
    /* swimming legs: flat paddles fringed with bristles */
    const nLeg = clamp(step - 5, 2, 5); ctx.lineCap = 'round';
    for (let k = 0; k < nLeg; k++) {
      const x0 = 5.6 - k * 1.9, a = sleep ? .4 : jump > .2 ? 1.25 : .55 + Math.sin(ph * 2 - k * .9) * .35, L = 3.4, x1 = x0 - Math.sin(a) * L, y1 = 2.5 + Math.cos(a) * L;
      ctx.strokeStyle = css(C.edge, .8); ctx.lineWidth = .42; ctx.beginPath(); ctx.moveTo(x0, 2.4); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = css(mx(C.edge, [255, 255, 255], .4), .45); ctx.lineWidth = .06;
      for (let j = 1; j <= 6; j++) { const t = j / 7, px = lerp(x0, x1, t), py = lerp(2.4, y1, t); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - .9, py + .45); ctx.stroke(); }
    }
    if (step >= 12 && o.sex === 'boy') { ctx.strokeStyle = css(C.edge, .9); ctx.lineWidth = .32; ctx.beginPath(); ctx.moveTo(-3.4, 2.3); ctx.quadraticCurveTo(-5.2, 4.2, -6.6, 3.6); ctx.stroke(); }
    if (!sleep) { ctx.strokeStyle = css(C.pig, .55); ctx.lineWidth = .2; for (let k = 0; k < 3; k++) { const a = .5 + Math.sin(ph * 5 + k * 1.7) * .5; ctx.beginPath(); ctx.moveTo(8.4 - k * .9, 2.3); ctx.lineTo(8.4 - k * .9 + Math.sin(a) * 1.2, 2.3 + Math.cos(a) * 2); ctx.stroke(); } }
    put(ctx, B);
    /* the eye: a deep red bead with a spark of light */
    const eg = ctx.createRadialGradient(9.85, -.8, .05, 10, -.6, .7); eg.addColorStop(0, '#ff6a50'); eg.addColorStop(.5, C.eye); eg.addColorStop(1, '#3a0404');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(10, -.6, .62, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(9.82, -.86, .17, 0, TAU); ctx.fill();
    feeler(ctx, C, Object.assign({}, o, { step }), false, fold);
    ctx.restore();
  }

  /* ---------- the nauplius: a glassy pear, yolk or a green gut inside; legs live ---------- */
  function naupPart(form, step, gutQ) {
    return one(`naup|${form}|${step}|${gutQ}`, () => {
      const C = FC(form), R = mulberry32(step * 11 + gutQ), gut = gutQ / 2, t = (step - 1) * .55;
      const p = new Path2D(); p.moveTo(3, 0); p.bezierCurveTo(3, -2.4, .4, -2.6, -1, -2.2); p.bezierCurveTo(-2.8, -1.6, -3, 1.6, -1, 2.2); p.bezierCurveTo(.4, 2.6, 3, 2.4, 3, 0); p.closePath();
      if (step >= 2) { p.moveTo(-2.2, -1); p.lineTo(-2.6 - t, -.45); p.lineTo(-2.6 - t, .45); p.lineTo(-2.2, 1.1); p.closePath(); }
      return paintGlass(-3.4 - t, -2.8, 3.4, 2.8, { paths: p, round: 1.6, res: 24, tint: mx(C.body, [255, 255, 255], .2), edge: C.edge, clear: .78,
        inner: (g) => {
          if (step <= 2) for (let k = 0; k < 9; k++) { const x = -1.4 + R() * 2.4, y = -1.2 + R() * 2.4, r = .3 + R() * .4; const yg = g.createRadialGradient(x - r * .3, y - r * .3, .02, x, y, r); yg.addColorStop(0, 'rgba(255,230,160,.95)'); yg.addColorStop(1, 'rgba(220,160,70,.75)'); g.fillStyle = yg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
          else { const gc = mx([200, 180, 120], [96, 160, 60], gut); g.fillStyle = css(gc, .7); g.beginPath(); g.ellipse(-.3, .3, 1.5, .85, .1, 0, TAU); g.fill(); }
          for (let k = 0; k < 9; k++) { const x = -2 + R() * 4.6, y = -1.8 + R() * 3.6; g.fillStyle = css(C.pig, .5 + R() * .3); g.beginPath(); g.arc(x, y, .1 + R() * .12, 0, TAU); g.fill(); }
          g.fillStyle = css(C.pig, .55); g.beginPath(); g.ellipse(1.8, 1.3, .7, .35, -.4, 0, TAU); g.fill();
        } });
    });
  }
  function drawNauplius(ctx, o) {
    const step = clamp(o.step || 1, 1, 6), form = FORMS[o.form] ? o.form : 'red', gutQ = Math.round(clamp(o.gut === undefined ? .5 : o.gut, 0, 1) * 2);
    const Bp = naupPart(form, step, gutQ); if (!Bp) return Sprites.drawNauplius(ctx, o);
    const C = FC(form), s = o.s || 1, ph = o.ph || 0, grow = 1 + (step - 1) * .06;
    ctx.save(); ctx.scale(s, s); ctx.lineCap = 'round';
    const limb = (x0, y0, base, L, two, k) => {
      const a = base + Math.sin(ph * 2.2 - k * 1.3) * .55, x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
      ctx.strokeStyle = css(C.edge, .85); ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (two) { ctx.beginPath(); ctx.moveTo(x0 + Math.cos(a) * L * .3, y0 + Math.sin(a) * L * .3); ctx.lineTo(x0 + Math.cos(a + .5) * L * .8, y0 + Math.sin(a + .5) * L * .8); ctx.stroke(); }
      if (o.simple) return;
      ctx.lineWidth = .06; ctx.strokeStyle = css(mx(C.edge, [255, 255, 255], .4), .55);
      for (let j = 0; j < 5; j++) { const b = a - 1 + j * .25; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(x1 + Math.cos(b) * 1, y1 + Math.sin(b) * 1 + .3, x1 + Math.cos(b) * 2, y1 + Math.sin(b) * 2); ctx.stroke(); }
    };
    limb(2, -1, -.9, 2.4 * grow, false, 0); limb(1.6, .7, .3, 3.2 * grow, true, 1); limb(.3, 1.6, 1.1, 2.6 * grow, true, 2);
    if (step >= 2) { const t = (step - 1) * .55; ctx.strokeStyle = css(C.edge, .75); ctx.lineWidth = .12; for (const sy of [-.35, .35]) { ctx.beginPath(); ctx.moveTo(-2.6 - t, sy); ctx.lineTo(-4 - t * 1.4, sy * 2.6); ctx.stroke(); } }
    put(ctx, Bp);
    const eg = ctx.createRadialGradient(2.2, -.85, .04, 2.3, -.7, .55); eg.addColorStop(0, '#ff6a50'); eg.addColorStop(.5, C.eye); eg.addColorStop(1, '#3a0404');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(2.3, -.7, .5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(2.15, -.9, .14, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* ---------- the egg: a glass bead full of golden yolk ---------- */
  function drawEgg(ctx, o = {}) {
    const P = one('egg', () => {
      const R = mulberry32(3), p = new Path2D(); p.arc(0, 0, 1, 0, TAU);
      return paintGlass(-1.05, -1.05, 1.05, 1.05, { paths: p, round: 1, res: 60, tint: [250, 236, 200], edge: [210, 170, 100], clear: .55,
        inner: (g) => { const yg = g.createRadialGradient(-.2, -.2, .05, 0, 0, 1); yg.addColorStop(0, 'rgba(255,228,150,.95)'); yg.addColorStop(1, 'rgba(206,150,60,.9)'); g.fillStyle = yg; g.fillRect(-1, -1, 2, 2); for (let k = 0; k < 16; k++) { g.fillStyle = `rgba(${200 + R() * 40 | 0},${140 + R() * 50 | 0},60,.5)`; g.beginPath(); g.arc(-.7 + R() * 1.4, -.7 + R() * 1.4, .1 + R() * .18, 0, TAU); g.fill(); } } });
    });
    if (!P) return Sprites.drawEgg(ctx, o);
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    if (o.crack) ctx.rotate(Math.sin((o.ph || 0) * 9) * o.crack * .4);
    put(ctx, P);
    if (o.eye) { ctx.fillStyle = '#c01818'; ctx.beginPath(); ctx.arc(.35, -.15, .16, 0, TAU); ctx.fill(); }
    if (o.crack > .3) { ctx.strokeStyle = 'rgba(120,80,30,.7)'; ctx.lineWidth = .06; ctx.beginPath(); ctx.moveTo(-.6, -.6); ctx.lineTo(-.2, -.2); ctx.lineTo(-.4, .1); ctx.lineTo(0, .4); ctx.stroke(); }
    ctx.restore();
  }
  function drawExuvia(ctx, o) { ctx.save(); ctx.globalAlpha *= .6; if ((o.step || 1) <= 6) drawNauplius(ctx, { s: o.s, form: 'clear', step: o.step, simple: true, gut: 0 }); else drawCopepod(ctx, { s: o.s, form: 'clear', step: o.step, simple: true, gut: 0, sleep: true }); ctx.restore(); }

  /* ---------- the North Atlantic right whale (canonical 1000 long): body painted, mouth and baleen live ---------- */
  function drawWhale(ctx, o) {
    const B = one('whale', () => {
      const R = mulberry32(17), p = new Path2D();
      p.moveTo(480, -10); p.bezierCurveTo(470, -120, 320, -150, 120, -140); p.bezierCurveTo(-120, -130, -330, -90, -440, -24); p.lineTo(-450, 6); p.bezierCurveTo(-330, 70, -100, 120, 120, 120); p.bezierCurveTo(330, 118, 450, 80, 480, -10); p.closePath();
      const bumps = [], spots = [];
      for (const [x, y, r] of [[430, -70, 14], [404, -92, 10], [372, -106, 9], [300, -120, 12], [270, -126, 7], [458, -38, 9], [330, -60, 8]]) { bumps.push([x, y, r * 1.1, 6]); for (let k = 0; k < 14; k++) spots.push([x + (R() - .5) * r * 1.6, y + (R() - .5) * r, 1.5 + R() * 3, [226, 220, 196], .9]); }
      for (let k = 0; k < 40; k++) spots.push([lerp(-380, 380, R()), lerp(-120, 100, R()), 3 + R() * 8, [40, 44, 50], .35]);
      const fb = fbmOf(23);
      return paintShell(-460, -160, 490, 130, { paths: p, round: 80, gloss: .22, shine: 14, res: .5, bumps, spots, rim: .2, amb: .3,
        color: (x, y) => { let c = mx([28, 32, 38], [20, 22, 26], ss(-100, 60, y)); c = mx(c, [214, 212, 204], ss(70, 104, y) * ss(-120, -40, x) * ss(200, 120, x) * .55); return mx(c, [48, 52, 58], ss(.55, .8, fb(x * .008, y * .012)) * .5); } });
    });
    const FL = one('whaleFluke', () => { const p = new Path2D(); p.moveTo(10, -14); p.quadraticCurveTo(-60, -20, -150, -110); p.quadraticCurveTo(-120, -20, -170, 10); p.quadraticCurveTo(-120, 30, -150, 120); p.quadraticCurveTo(-60, 30, 10, 18); p.closePath(); return paintShell(-175, -115, 15, 125, { paths: p, round: 14, gloss: .6, res: .5, color: () => [24, 26, 30] }); });
    if (!B || !FL) return Sprites.drawWhale(ctx, o);
    const s = o.s || 1, t = o.t || 0, open = clamp(o.open || 0, 0, 1), sw = Math.sin(t * .9) * 26;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-440, -8); ctx.rotate(sw / 300); put(ctx, FL); ctx.restore();
    put(ctx, B);
    ctx.fillStyle = '#0c0a0c';
    ctx.beginPath(); ctx.moveTo(470, -30); ctx.bezierCurveTo(400, -90, 240, -70, 150, -10); ctx.lineTo(150, 10 + open * 60); ctx.bezierCurveTo(260, 40 + open * 50, 420, 30 + open * 30, 476, 10); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 26; k++) { const u = k / 25, x = lerp(445, 170, u), y0 = lerp(-40, -20, Math.sin(u * Math.PI)) - Math.sin(u * Math.PI) * 30, L = 40 + open * 50 * Math.sin(u * Math.PI * .9 + .2); const bg = ctx.createLinearGradient(0, y0, 0, y0 + L); bg.addColorStop(0, 'rgba(60,54,48,.95)'); bg.addColorStop(.8, 'rgba(110,100,86,.9)'); bg.addColorStop(1, 'rgba(210,200,180,.7)'); ctx.strokeStyle = bg; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - 6, y0 + L); ctx.stroke(); }
    ctx.strokeStyle = '#2a2e34'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(150, 14 + open * 60); ctx.bezierCurveTo(260, 46 + open * 50, 420, 36 + open * 30, 476, 12); ctx.stroke();
    ctx.fillStyle = '#121418'; ctx.save(); ctx.translate(90, 70); ctx.rotate(.5 + Math.sin(t * .7) * .1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, 90, -10, 140); ctx.quadraticCurveTo(30, 120, 40, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    eyeLive(ctx, 200, 6 + open * 30, 7, [40, 36, 32]);
    ctx.restore();
  }
  function drawCombJelly(ctx, j, t) { return Sprites.drawCombJelly(ctx, j, t); }

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
      return null;
    });
  }
  function drawPlankton(ctx, q, night, t) {
    const P = planktonPart(q.kind); if (!P) return Sprites.drawPlankton(ctx, q, night, t);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + t * .2);
    if (q.kind === 'dino') { const glow = night * .4 + q.glow; if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,230,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); } }
    put(ctx, P);
    ctx.restore();
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

  const api = { beginFrame, drawCopepod, drawNauplius, drawEgg, drawExuvia, drawWhale, drawCombJelly, drawFish, drawBaskingShark, drawPlankton, floorPattern, cached };
  /* anything not painted here is the classic sprite, so render.js can ask Painted for everything */
  for (const k of Object.keys(Sprites)) if (!(k in api)) api[k] = Sprites[k];
  return api;
})();
