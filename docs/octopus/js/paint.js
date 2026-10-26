/* ============================================================
   paint.js — the painted sea (with the WebGL look, on by default)
   ============================================================
     The same animals as sprites.js, with the same options and the
     same joints (so every pose, size, sex, colour form and skin
     state still works), built the way an artist's rig is: painted
     parts mounted on bones.  An octopus is soft skin, not armour,
     so each part is painted per pixel with a low, rounded relief:
     its outline becomes a gentle dome (a distance field), papillae
     are stamped into the height, the colour comes from a map of the
     real markings (a rust or brick or dusk body, pale and dark
     mottling, a cream underside), and the whole is lit with a soft,
     wet highlight.  The skin is painted in several STATES (its
     everyday colour, pale and calm, flushed red, and matched to
     sand, rock or kelp), and per frame the two nearest states are
     blended, so the octopus changes colour live.  Parts:
       mantle · head · a straight arm (near and far side)
     Per frame the parts are placed on the joints: the arms are
     drawn in slices along the same curves sprites.js uses, so they
     bend, curl, trail and reach; the eye, siphon, web, beak and egg
     strings are drawn live on top.
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

  /* ---------- the skin painter ----------
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
  function darker(part, k, tint = [6, 10, 14]) {
    const c = document.createElement('canvas'); c.width = part.c.width; c.height = part.c.height;
    const g = c.getContext('2d', SOFT); g.drawImage(part.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(tint, k); g.fillRect(0, 0, c.width, c.height);
    return { ...part, c: handOver(c) };
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
     THE OCTOPUS — palettes (sRGB) for the five resting looks, and the skin states
     ============================================================ */
  const PAL = {
    normal:  { top: [150, 70, 38], side: [176, 92, 52], m1: [214, 140, 90], m2: [96, 36, 22], under: [224, 190, 150], sucker: [244, 224, 196], spot: [60, 24, 14] },
    brick:   { top: [160, 48, 32], side: [188, 66, 42], m1: [226, 120, 90], m2: [96, 22, 18], under: [228, 176, 146], sucker: [246, 216, 186], spot: [70, 16, 12] },
    dusk:    { top: [92, 38, 56], side: [116, 52, 70], m1: [168, 104, 120], m2: [46, 14, 26], under: [190, 150, 158], sucker: [230, 206, 206], spot: [30, 10, 18] },
    pearl:   { top: [214, 178, 164], side: [232, 200, 184], m1: [248, 230, 220], m2: [176, 118, 108], under: [248, 236, 224], sucker: [255, 244, 234], spot: [180, 110, 96] },
    freckle: { top: [182, 130, 82], side: [204, 150, 96], m1: [236, 196, 140], m2: [96, 54, 30], under: [238, 212, 170], sucker: [248, 232, 208], spot: [58, 30, 18] }
  };
  const PALE = [240, 226, 214], FLUSH = [150, 30, 22];
  /* the skin states: 0 everyday · 1 calm, pale · 2 flushed red · 3 blended with sand · 4 with rock · 5 with kelp · 6 with mud */
  const STATES = [
    { k: 'base' },
    { k: 'calm', to: PALE, t: .72 },
    { k: 'red', to: FLUSH, t: .6, dark: .3 },
    { k: 'sand', to: [196, 176, 134], t: .78, pap: 1, mottle: [[232, 220, 190], [140, 118, 86]] },
    { k: 'rock', to: [120, 116, 108], t: .8, pap: 1.4, mottle: [[170, 166, 156], [62, 60, 56]] },
    { k: 'kelp', to: [96, 92, 46], t: .76, pap: .6, mottle: [[140, 136, 70], [48, 50, 22]] },
    { k: 'mud', to: [104, 96, 82], t: .78, pap: .8, mottle: [[150, 140, 120], [56, 50, 42]] }
  ];
  const BLEND_STATE = { sand: 3, rock: 4, gravel: 4, shell: 3, kelp: 5, grass: 5, mud: 6 };
  function palette(form, st) {
    const src = PAL[form] || PAL.normal, S = STATES[st] || STATES[0], out = {};
    for (const k of Object.keys(src)) out[k] = S.to ? mx(src[k], S.to, S.t * (k === 'under' || k === 'sucker' ? .5 : 1)) : src[k];
    if (S.dark) { out.top = mx(out.top, [40, 8, 6], S.dark); out.m2 = mx(out.m2, [30, 6, 4], S.dark); }
    if (S.mottle) { out.m1 = S.mottle[0]; out.m2 = S.mottle[1]; out.spot = mx(S.mottle[1], [0, 0, 0], .3); }
    out.pap = S.pap || .2; out.state = st;
    return out;
  }
  /* the skin's colour at a point: dark on top, warmer at the sides, mottled, cream below; t is 0 at the top of the part, 1 at the bottom */
  function skinColour(P, fb, x, y, t) {
    let c = mx(P.top, P.side, ss(.1, .7, t));
    const m = fb(x * .22, y * .22), m2 = fb(x * .7 + 40, y * .7 + 7);
    c = mx(c, P.m1, ss(.55, .8, m) * (.3 + .4 * t) * (P.state >= 3 ? 1.6 : 1));
    c = mx(c, P.m2, ss(.42, .22, m) * (P.state >= 3 ? .75 : .45));
    if (P.state >= 3) c = mx(c, P.m2, ss(.62, .68, m2) * .7);
    c = mx(c, P.under, ss(.86, 1.02, t) * .75);
    return c;
  }
  function speckles(R, n, inBox, P, fine) {
    const out = [];
    for (let i = 0; i < n; i++) { const [x, y] = inBox(R(), R()); out.push([x, y, (fine ? .2 : .3) + R() * (fine ? .3 : .6), R() < .8 ? P.spot : mx(P.spot, P.m1, .5), .35 + R() * .4]); }
    return out;
  }

  /* ---------- the parts of one octopus (form, skin state) ---------- */
  const ARM_L = 46, ARM_W = 6;
  function octSteps(form, st) {
    const P = palette(form, st), seed = 3 + form.length * 31 + st * 101;
    const R = mulberry32(seed), fb = fbmOf(seed + 5);
    const steps = [];
    /* --- the mantle: a rounded bag, papillae over the back, speckles and mottling --- */
    steps.push((parts) => {
      const p = new Path2D(); p.ellipse(0, 0, 26, 18, 0, 0, TAU);
      const bumps = [], spots = speckles(R, 120, (u, v) => { const a = u * TAU, r = Math.sqrt(v); return [Math.cos(a) * 25 * r, Math.sin(a) * 17 * r]; }, P);
      const nPap = Math.round(30 + P.pap * 60);
      for (let i = 0; i < nPap; i++) { const a = -Math.PI + R() * Math.PI * 1.1, r = .6 + R() * .4; const x = Math.cos(a) * 25 * r, y = Math.sin(a) * 17 * r; bumps.push([x, y, .7 + R() * 1.2 * P.pap, .35 + P.pap * .5]); if (R() < .4) spots.push([x, y - .3, .3, mx(P.m1, [255, 255, 255], .2), .5]); }
      for (let i = 0; i < 24; i++) { const x = (R() - .5) * 46, y = (R() - .5) * 30; bumps.push([x, y, 1.2 + R() * 2, .25]); }
      parts.mantle = paintShell(-28, -20, 28, 20, {
        paths: p, round: 11, gloss: .55, shine: 22, bumps, spots, amb: .46,
        color: (x, y) => skinColour(P, fb, x, y, (y + 18) / 36)
      });
    });
    /* --- the head: a smaller bulge in front, with the brow over the eye --- */
    steps.push((parts) => {
      const p = new Path2D();
      p.moveTo(-8, -12); p.bezierCurveTo(0, -22, 16, -22, 22, -10); p.bezierCurveTo(26, -2, 22, 8, 12, 9); p.bezierCurveTo(2, 10, -8, 4, -8, -12); p.closePath();
      const bumps = [[10, -14, 7, 1.6]], spots = speckles(R, 50, (u, v) => [lerp(-6, 22, u), lerp(-20, 8, v)], P);
      for (let i = 0; i < Math.round(10 + P.pap * 30); i++) { const x = lerp(-6, 22, R()), y = lerp(-20, 6, R()); bumps.push([x, y, .6 + R() * .9 * P.pap, .3 + P.pap * .4]); }
      parts.head = paintShell(-10, -24, 28, 12, {
        paths: p, round: 8, gloss: .55, shine: 22, bumps, spots, amb: .46,
        color: (x, y) => skinColour(P, fb, x + 30, y, (y + 22) / 32)
      });
    });
    /* --- a straight arm, pointing down +y from its root: tapered, two rows of suckers along the front edge --- */
    steps.push((parts) => {
      const L = ARM_L, w0 = ARM_W, p = new Path2D();
      p.moveTo(-w0 / 2, 0); p.quadraticCurveTo(-w0 * .55, L * .5, -.4, L); p.quadraticCurveTo(0, L + .6, .4, L); p.quadraticCurveTo(w0 * .55, L * .5, w0 / 2, 0); p.quadraticCurveTo(0, -w0 * .4, -w0 / 2, 0); p.closePath();
      const bumps = [], spots = speckles(R, 60, (u, v) => [lerp(-w0 / 2, w0 / 2, u) * (1 - v * .9), lerp(0, L, v)], P, true);
      /* suckers: two staggered rows down the underside (+x side), shrinking towards the tip */
      for (let i = 0; i < 22; i++) { const t = (i + .5) / 22, w = w0 * (1 - t * .92), r = Math.max(.3, w * .3); const x = w * .32 + (i % 2 ? .35 : -.15) * w * .6, y = t * L; bumps.push([x, y, r, .55]); spots.push([x, y, r * .9, P.sucker, .9]); spots.push([x + r * .1, y, r * .35, mx(P.sucker, [0, 0, 0], .45), .8]); }
      for (let i = 0; i < Math.round(6 + P.pap * 16); i++) { const t = R(), w = w0 * (1 - t * .9); bumps.push([-w * .3 - R() * w * .2, t * L, .4 + R() * .5 * P.pap, .3 + P.pap * .3]); }
      parts.arm = paintShell(-w0, -w0 * .6, w0, L + 1.5, {
        paths: p, round: w0 * .5, gloss: .55, shine: 22, bumps, spots, res: 5, amb: .46,
        color: (x, y) => { const t = clamp((x + w0 / 2) / w0, 0, 1); let c = skinColour(P, fb, y * .6, x * 2, t * .55); return mx(c, P.under, ss(.55, .95, t) * .55); }
      });
      parts.armF = darker(parts.arm, .3);
      parts.mantleF = parts.mantle; parts.headF = parts.head;
    });
    return steps;
  }
  function octParts(form, st) { return job(`oct|${form}|${st}`, octSteps(form, st)); }

  /* which skin states to blend, and how much, from the live skin values */
  function skinMix(o) {
    const calm = o.calm || 0, red = o.red || 0, blend = o.blend || 0;
    const bs = BLEND_STATE[o.blendMat] || 3;
    /* the strongest of the three wins the second slot; the base is always under it */
    const cands = [[1, calm * .9], [2, red * .85], [bs, blend * .9]].sort((a, b) => b[1] - a[1]);
    return { a: 0, b: cands[0][0], w: clamp(cands[0][1], 0, 1), c: cands[1][0], w2: clamp(cands[1][1], 0, 1) * (1 - clamp(cands[0][1], 0, 1)) * .8 };
  }
  function octopusReady(o) { return !!octParts(PAL[o.form] ? o.form : 'normal', 0); }

  /* an arm along its curve, in slices (near: lit; far: in shade) */
  function armDraw(ctx, parts, P, w0, near, short, alpha) {
    const img = (near ? parts.arm : parts.armF), iw = img.c.width, ih = img.c.height, N = 11, end = short ? .55 : 1;
    const k = w0 / ARM_W, drawW = (img.w) * k;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    for (let i = 0; i < N; i++) {
      const u0 = i / N * end, u1 = (i + 1) / N * end, [ax, ay] = Sprites.bez(P, u0), [bx, by] = Sprites.bez(P, u1);
      const len = Math.hypot(bx - ax, by - ay); if (len < .05) continue;
      const a = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.scale(1, len / (ARM_L * (u1 - u0)));
      /* the slice: that band of the straight arm image, at the root offset of the part */
      const sy = (u0 * ARM_L - img.y0) / img.h * ih, sh = ((u1 - u0) * ARM_L) / img.h * ih;
      ctx.drawImage(img.c, 0, sy, iw, sh + 1, img.x0 * k, -.3, drawW, (u1 - u0) * ARM_L + .6);
      ctx.restore();
    }
    if (short) { const [ex, ey] = Sprites.bez(P, end); ctx.fillStyle = css(mx(palette('normal', 0).under, [255, 240, 230], .4)); ctx.beginPath(); ctx.arc(ex, ey, w0 * .3, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  /* o: as Sprites.drawOctopus */
  function drawOctopus(ctx, o) {
    const form = PAL[o.form] ? o.form : 'normal';
    const mixv = skinMix(o);
    const PA = octParts(form, 0), PB = mixv.w > .02 ? octParts(form, mixv.b) : null, PC = mixv.w2 > .04 ? octParts(form, mixv.c) : null;
    if (!PA) return Sprites.drawOctopus(ctx, o);
    const layers = [[PA, 1]]; if (PB) layers.push([PB, mixv.w]); if (PC) layers.push([PC, mixv.w2]);
    const cols = Sprites.skinCols(form, o), dark = css(mx([cols.skin2[0], cols.skin2[1], cols.skin2[2]], [0, 0, 0], .4));
    const s = o.s || 1, tuck = o.tuck || 0, up = o.up || 0, jet = o.jet || 0, eggs = o.eggs || 0, squeeze = o.squeeze || 0;
    ctx.save();
    ctx.scale(s, s);
    if (squeeze > 0) { const q = Math.sin(squeeze * Math.PI); ctx.translate(0, 4 * q); ctx.scale(1 + q * .25, 1 - q * .3); }
    if (o.moving && o.swim === undefined) ctx.rotate(Math.sin((o.walk || 0) * .5) * .012);
    const arms = Sprites.armSet(o);
    if (eggs > 0) Sprites.drawEggStrings(ctx, { x: -14, y: -40, w: 44, h: 26 * eggs + 6, n: Math.round(7 + eggs * 9), ph: o.ph || 0, seed: o.seed || 5 });
    /* far arms */
    for (const A of arms) if (!A.near) for (const [Pt, al] of layers) armDraw(ctx, Pt, A.P, A.w0 * .9, false, 0, al);
    /* the web between spread arms */
    if (up > .15) {
      ctx.fillStyle = css(mx(cols.under, cols.skin, .5), .85 * up);
      ctx.beginPath(); ctx.moveTo(14, 4);
      for (const A of arms) if (A.near) { const [x, y] = Sprites.bez(A.P, .42); ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
    /* the mantle */
    ctx.save(); ctx.translate(-16, -12); ctx.rotate(-.32 - jet * .2);
    ctx.scale((1 + jet * .2) * (1 - tuck * .1), (1 - tuck * .12) * (1 - jet * .1));
    for (const [Pt, al] of layers) { ctx.globalAlpha = al; put(ctx, Pt.mantle); }
    ctx.globalAlpha = 1;
    /* dreaming: patches of colour come and go across the skin */
    if (o.dream) { const RD = mulberry32(11); for (let k = 0; k < 5; k++) { const a = RD() * TAU, r = Math.sqrt(RD()) * .7, ph = RD() * TAU; const al = Math.max(0, Math.sin(o.dream * (1.2 + k * .3) + ph)) * .5; ctx.fillStyle = css(k % 2 ? FLUSH : PALE, al); ctx.beginPath(); ctx.ellipse(Math.cos(a) * 26 * r, Math.sin(a) * 18 * r, 5 + k, 3.5, a, 0, TAU); ctx.fill(); } }
    ctx.restore();
    /* the head, the siphon, the eye */
    for (const [Pt, al] of layers) { ctx.globalAlpha = al; put(ctx, Pt.head); }
    ctx.globalAlpha = 1;
    const blow = o.fan ? .5 + .5 * Math.sin(o.fan * 10) : 0;
    ctx.fillStyle = css(mx(cols.under, cols.skin, .4)); ctx.strokeStyle = dark; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.quadraticCurveTo(-10, 8 + blow, -18, 9 + blow * 2); ctx.lineTo(-18, 12 + blow * 2); ctx.quadraticCurveTo(-10, 12, -1, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,8,.7)'; ctx.beginPath(); ctx.ellipse(-18, 10.5 + blow * 2, 1, 1.6 + blow, 0, 0, TAU); ctx.fill();
    const ex = 10, ey = -13, closed = (o.calm || 0) > .6 && o.dream ? .75 : tuck * .4;
    ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.ellipse(ex, ey, 5, 4.2, 0, 0, TAU); ctx.fill();
    const ig = ctx.createRadialGradient(ex - 1, ey - 1, .5, ex, ey, 4.4); ig.addColorStop(0, '#d8b870'); ig.addColorStop(.6, '#9a6a30'); ig.addColorStop(1, '#4a3016');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(ex, ey, 4.4, 3.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = css(cols.eye); ctx.beginPath(); ctx.ellipse(ex + .4, ey + .2, 3.4, 1.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(ex - 1.8, ey - 1.6, .9, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,200,220,.3)'; ctx.beginPath(); ctx.arc(ex + 2.2, ey + 1.4, .7, 0, TAU); ctx.fill();
    if (closed > 0) { ctx.fillStyle = css(cols.skin); ctx.beginPath(); ctx.ellipse(ex, ey - 4.4 + closed * 4.2, 5.4, 4.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(ex, ey - 4.4 + closed * 4.2, 5.4, 4.4, 0, .2, Math.PI - .2); ctx.stroke(); }
    /* near arms */
    const shortK = o.armShort > 0 ? 2 : -1;
    for (let i = arms.length - 1; i >= 0; i--) { const A = arms[i]; if (A.near) for (const [Pt, al] of layers) armDraw(ctx, Pt, A.P, A.w0, true, A.k === shortK ? o.armShort : 0, al); }
    if (o.eat) { const chew = Math.sin(o.eat * 18) * .6; ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.moveTo(15, 7 + chew); ctx.lineTo(19, 10 + chew); ctx.lineTo(14, 10.5 + chew); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function drawSettler(ctx, o) {
    if (!octParts(PAL[o.form] ? o.form : 'normal', 0)) return Sprites.drawSettler(ctx, o);
    drawOctopus(ctx, { s: o.s || .08, form: o.form, sex: 'boy', swim: o.ph || 0, ph: o.ph, seed: 2 });
  }

  /* ============================================================
     THE PARALARVA: a glassy baby, a round mantle full of colour cells, two huge eyes
     ============================================================ */
  function larvaParts(form, inst) {
    return job(`larva|${form}|${inst}`, [(parts) => {
      const F = FORMS[form] || FORMS.normal, sc = hexToRgb(F.skin), R = mulberry32(31 + inst);
      const RES = 18, x0 = -9, y0 = -6.5, x1 = 9, y1 = 5;
      const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * RES); c.height = Math.ceil((y1 - y0) * RES);
      const g = c.getContext('2d', SOFT); g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); g.lineCap = 'round'; g.lineJoin = 'round';
      /* the glass mantle: clear in the middle, bright at the rim */
      const body = new Path2D(); body.ellipse(1, -.6, 4.2 + inst * .3, 3.2 + inst * .2, .05, 0, TAU);
      const bg = g.createRadialGradient(1.4, -1.2, .2, 1, -.4, 4.8);
      bg.addColorStop(0, 'rgba(255,255,255,.18)'); bg.addColorStop(.62, 'rgba(240,226,214,.22)'); bg.addColorStop(.86, 'rgba(250,236,226,.55)'); bg.addColorStop(1, 'rgba(255,255,255,.85)');
      g.fillStyle = bg; g.fill(body);
      g.save(); g.clip(body);
      g.fillStyle = 'rgba(200,120,70,.35)'; g.beginPath(); g.ellipse(0, .2, 2.2, .9, .2, 0, TAU); g.fill();
      for (const [x, y, r] of [[-1.6, -1.4, .55], [.4, 1.2, .6], [-1.2, 1.1, .45], [2.4, -1.6, .45], [3.2, .8, .4], [1.2, -2.4, .35], [-2.6, -.2, .4], [-.4, -.4, .3]]) {
        const cc = mx(sc, [214, 64, 30], .4);
        g.fillStyle = css(cc, .85); g.beginPath(); g.arc(x, y, r * .5, 0, TAU); g.fill();
        g.strokeStyle = css(cc, .6); g.lineWidth = .1;
        for (let k = 0; k < 7; k++) { const a = R() * TAU, L = r * (1 + R()); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .4) * L * .5, y + Math.sin(a + .4) * L * .5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .12; g.stroke(body);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(0, -2.6, 2.2, .35, -.08, 0, TAU); g.fill();
      /* the siphon and the two big eyes */
      g.strokeStyle = 'rgba(255,230,210,.8)'; g.lineWidth = .45; g.beginPath(); g.moveTo(3, 1.8); g.lineTo(1.2, 3.2); g.stroke();
      for (const [x, y] of [[4.3, -1.6], [3.6, -2.6]]) {
        const eg = g.createRadialGradient(x - .3, y - .4, .1, x, y, 1.2); eg.addColorStop(0, '#56606a'); eg.addColorStop(.3, '#141820'); eg.addColorStop(.85, '#05060a'); eg.addColorStop(1, '#2a3a40');
        g.fillStyle = eg; g.beginPath(); g.arc(x, y, 1.1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(x - .35, y - .4, .32, 0, TAU); g.fill();
      }
      stat.n++;
      parts.img = { c: handOver(c), x0, y0, w: x1 - x0, h: y1 - y0 };
    }]);
  }
  function drawParalarva(ctx, o) {
    const inst = clamp(o.instar || 1, 1, 3) | 0, form = FORMS[o.form] ? o.form : 'normal', Pt = larvaParts(form, inst);
    if (!Pt) return Sprites.drawParalarva(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, pulse = .5 + .5 * Math.sin(ph);
    ctx.save(); ctx.scale(s, s);
    ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const a = Math.PI + (k - 3.5) * .22 + Math.sin(ph + k) * .12, L = 2.6 + inst * .7 + (k % 2) * .4;
      ctx.strokeStyle = `rgba(255,236,220,${k < 4 ? .5 : .85})`; ctx.lineWidth = .7 - k % 2 * .2;
      ctx.beginPath(); ctx.moveTo(-3.2, .4 + (k - 3.5) * .35); ctx.quadraticCurveTo(-3.2 + Math.cos(a) * L * .5, .4 + (k - 3.5) * .35 + Math.sin(a) * L * .5 + pulse, -3.2 + Math.cos(a) * L, .4 + (k - 3.5) * .5 + Math.sin(a) * L * .6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let j = 1; j <= 2; j++) { ctx.beginPath(); ctx.arc(-3.2 + Math.cos(a) * L * j / 3, .8 + (k - 3.5) * .4 + Math.sin(a) * L * j / 3 * .6, .22, 0, TAU); ctx.fill(); }
    }
    ctx.save(); ctx.translate(1, -.6); ctx.scale(1 + pulse * .06, 1 - pulse * .08); ctx.translate(-1, .6); put(ctx, Pt.img); ctx.restore();
    ctx.restore();
  }
  function drawEgg(ctx, o = {}) { Sprites.drawEgg(ctx, o); }

  /* ============================================================
     THE SEA'S OTHER ANIMALS: fish, the hunters, the seal, the otter, the whale,
     food on the floor, plankton.  Same frames as sprites.js; the body painted once,
     fins and tails placed each frame
     ============================================================ */
  const one = (key, make) => { const j = job(key, [(parts) => { parts.v = make(); }]); return j ? j.v : null; };
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
  const scales = (x, y, k) => { const u = x * k, v = y * k + (Math.floor(u) % 2) * .5, fu = u - Math.floor(u), fv = v - Math.floor(v); return .92 + .08 * ss(.25, .05, Math.hypot(fu - .9, fv - .5) - .45); };

  /* --- herring and the little bottom fish (canonical 34 long) --- */
  function drawFish(ctx, o) {
    const col = o.col || '#c8d8e8', col2 = o.col2 || '#3a5a7a', key = 'fish|' + col + '|' + col2;
    const B = one(key, () => {
      const c1 = hexToRgb(col), c2 = hexToRgb(col2);
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
  /* --- the hunters (canonical 100 long): lingcod, wolf eel, sixgill shark --- */
  const HUNT = {
    lingcod: { body: (p) => { p.moveTo(52, -4); p.quadraticCurveTo(30, -18, -10, -15); p.quadraticCurveTo(-35, -11, -46, -2); p.lineTo(-46, 4); p.quadraticCurveTo(-30, 13, -5, 14); p.quadraticCurveTo(30, 15, 52, 6); p.closePath(); },
      back: [70, 88, 56], side: [138, 136, 90], belly: [220, 210, 184], spot: [50, 44, 20], eye: [38, -6, 3.4], tail: [[120, 120, 80], [70, 80, 50]] },
    wolfeel: { body: (p) => { p.moveTo(50, -2); p.quadraticCurveTo(44, -11, 30, -10); p.quadraticCurveTo(0, -8, -30, -4); p.quadraticCurveTo(-46, -2, -52, 0); p.quadraticCurveTo(-46, 4, -30, 6); p.quadraticCurveTo(0, 10, 30, 9); p.quadraticCurveTo(46, 8, 50, 2); p.closePath(); },
      back: [74, 74, 70], side: [122, 122, 114], belly: [184, 180, 168], spot: [40, 40, 40], eye: [42, -5, 3], tail: [[100, 100, 94], [60, 60, 56]] },
    sixgill: { body: (p) => { p.moveTo(52, -2); p.quadraticCurveTo(44, -14, 10, -14); p.quadraticCurveTo(-30, -12, -46, -3); p.lineTo(-46, 3); p.quadraticCurveTo(-30, 12, 10, 13); p.quadraticCurveTo(44, 12, 52, 4); p.closePath(); },
      back: [58, 62, 68], side: [106, 110, 116], belly: [200, 200, 200], spot: [40, 44, 50], eye: [44, -4, 3.2], tail: [[90, 94, 100], [56, 60, 66]] }
  };
  function hunterBody(kind) {
    return one('hunter|' + kind, () => {
      const K = HUNT[kind], R = mulberry32(kind.length * 13), fb = fbmOf(kind.length * 5), p = new Path2D(); K.body(p);
      const spots = [], bumps = [];
      if (kind === 'lingcod') for (let i = 0; i < 200; i++) spots.push([lerp(-42, 46, R()), lerp(-13, 10, R()), .5 + R() * 1.2, R() < .7 ? K.spot : [200, 190, 150], .3 + R() * .3]);
      if (kind === 'wolfeel') { for (let i = 0; i < 40; i++) { const x = 20 - (i % 9) * 7, y = -5 + (i / 9 | 0) * 3; spots.push([x + (R() - .5) * 2, y, 2.2 + R(), K.spot, .35]); } for (let i = 0; i < 20; i++) bumps.push([lerp(30, 50, R()), lerp(-9, 6, R()), 1.2 + R() * 1.6, .9]); }
      if (kind === 'sixgill') for (let i = 0; i < 60; i++) spots.push([lerp(-40, 44, R()), lerp(-12, 6, R()), 1 + R() * 2.4, [48, 50, 54], .3]);
      return paintShell(-54, -30, 54, 30, {
        paths: p, round: kind === 'wolfeel' ? 7 : 11, gloss: kind === 'wolfeel' ? .45 : .8, shine: 26, res: 4, spots, bumps, rim: .35,
        grooves: kind === 'sixgill' ? [0, 1, 2, 3, 4, 5].map(k => [[[30 - k * 3, -6], [28 - k * 3, 0], [30 - k * 3, 7]], .8, .9]) : [[[[33, -12], [30, -2], [33, 9]], 1, .8]],
        color: (x, y) => {
          const top = -15, bot = 14, t = (y - top) / (bot - top);
          let c = mx(K.back, K.side, ss(.05, .55, t)); c = mx(c, K.belly, ss(.6, .9, t));
          if (kind === 'lingcod') { const m = fb(x * .1, y * .14); c = mx(c, K.spot, ss(.55, .75, m) * .5); c = mx(c, [180, 170, 120], ss(.42, .25, m) * .35); }
          if (kind === 'wolfeel') { const m = fb(x * .12, y * .12); c = mx(c, K.spot, ss(.55, .75, m) * .4); }
          return c.map(v => v * scales(x, y, .45));
        },
        post: (g) => {
          if (kind === 'lingcod') {
            const f = new Path2D(); f.moveTo(26, -13); for (let k = 0; k < 12; k++) f.lineTo(24 - k * 5.5, -24 + Math.sin(k * .8) * 3); f.lineTo(-40, -12); f.closePath(); fin(g, f, [64, 80, 50], fanRays(-8, -12, [[20, -22], [8, -24], [-6, -23], [-20, -22], [-34, -16]]));
            const af = new Path2D(); af.moveTo(10, 13); af.quadraticCurveTo(2, 25, -4, 24); af.quadraticCurveTo(-10, 19, -14, 13); af.closePath(); fin(g, af, [120, 120, 80], fanRays(0, 13, [[6, 22], [0, 24], [-8, 20]]));
            g.strokeStyle = 'rgba(30,30,20,.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(52, 2); g.quadraticCurveTo(38, 6, 26, 6); g.stroke();
            g.fillStyle = '#f0ece0'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(46 - k * 4, 3); g.lineTo(45 - k * 4, 5.5); g.lineTo(44 - k * 4, 3); g.fill(); }
          } else if (kind === 'wolfeel') {
            const f = new Path2D(); f.moveTo(30, -9); for (let k = 0; k < 16; k++) f.lineTo(28 - k * 5, -14 + Math.sin(k * .9) * 1.5); f.lineTo(-50, -1); f.closePath(); fin(g, f, [60, 60, 56], fanRays(-10, -8, [[20, -14], [0, -14], [-20, -13], [-40, -8]]));
            g.strokeStyle = 'rgba(40,40,40,.6)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(40, -1, 4 + k * 2, 2.6, 4.2); g.stroke(); }
            g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(48, 4, 4, 2.5, 0, 0, TAU); g.fill();
            g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(51, 2); g.quadraticCurveTo(44, 7, 36, 6); g.stroke();
          } else {
            const d = new Path2D(); d.moveTo(-14, -12); d.lineTo(-24, -24); d.lineTo(-32, -11); d.closePath(); fin(g, d, [60, 64, 70], fanRays(-22, -11, [[-24, -23], [-19, -18]]));
            const pf = new Path2D(); pf.moveTo(18, 11); pf.quadraticCurveTo(8, 24, -4, 22); pf.quadraticCurveTo(4, 14, 18, 11); pf.closePath(); fin(g, pf, [70, 74, 80], fanRays(14, 11, [[4, 22], [-2, 21]]));
            g.strokeStyle = 'rgba(30,30,30,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(50, 4); g.quadraticCurveTo(44, 8, 36, 7); g.stroke();
          }
        }
      });
    });
  }
  function drawHunter(ctx, kind, o) {
    if (!HUNT[kind]) return Sprites.drawHunter(ctx, kind, o);
    const K = HUNT[kind], B = hunterBody(kind), T = tailPart('htail|' + kind, kind === 'sixgill' ? 18 : 15, kind === 'wolfeel' ? 9 : kind === 'sixgill' ? 16 : 13, K.tail[0], K.tail[1], 4);
    if (!B || !T) return Sprites.drawHunter(ctx, kind, o);
    const s = o.s || 1, ph = o.ph || 0, tail = Math.sin(ph) * 5;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(kind === 'wolfeel' ? -50 : -44, 0); ctx.rotate(tail * .035); put(ctx, T); ctx.restore();
    put(ctx, B);
    const [ex, ey, er] = K.eye; eyeLive(ctx, ex, ey, er, kind === 'sixgill' ? [90, 192, 160] : kind === 'lingcod' ? [224, 192, 128] : [214, 206, 170]);
    ctx.restore();
  }
  /* --- the harbour seal (canonical 100 long) --- */
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
  /* --- the sea otter (canonical 100 long): dense dark fur, a pale grizzled face --- */
  function drawOtter(ctx, o) {
    const B = one('otter', () => {
      const R = mulberry32(66), fb = fbmOf(7), p = new Path2D();
      p.moveTo(48, -4); p.quadraticCurveTo(40, -14, 16, -14); p.quadraticCurveTo(-14, -14, -34, -8); p.quadraticCurveTo(-46, -4, -50, 0); p.quadraticCurveTo(-46, 6, -34, 9); p.quadraticCurveTo(-14, 14, 16, 13); p.quadraticCurveTo(40, 12, 48, 4); p.closePath();
      const spots = []; for (let i = 0; i < 400; i++) spots.push([lerp(-48, 46, R()), lerp(-13, 12, R()), .2 + R() * .4, R() < .5 ? [40, 26, 16] : [110, 80, 54], .5]);
      return paintShell(-52, -18, 52, 16, {
        paths: p, round: 10, gloss: .3, shine: 14, res: 4, spots, rim: .25, amb: .5,
        color: (x, y) => { const t = (y + 14) / 28; let c = mx([58, 40, 28], [96, 70, 48], ss(.1, .7, t)); c = mx(c, [130, 100, 70], ss(.7, 1, t) * .5); c = mx(c, [216, 200, 168], ss(30, 46, x) * .85); const m = fb(x * .2, y * .3); return mx(c, [30, 20, 12], ss(.6, .75, m) * .3); },
        post: (g) => { g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(49, 0, 3, 2.2, 0, 0, TAU); g.fill(); g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(30, -12, 3, 0, TAU); g.fill(); }
      });
    });
    const HF = one('otterFeet', () => { const p = new Path2D(); p.moveTo(0, -4); p.lineTo(-18, -8); p.lineTo(-22, 0); p.lineTo(-18, 8); p.lineTo(0, 4); p.closePath(); return paintShell(-24, -10, 2, 10, { paths: p, round: 2, gloss: .5, res: 4, color: () => [46, 32, 22], post: (g) => { g.strokeStyle = 'rgba(20,12,8,.6)'; g.lineWidth = .5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-4, k * 1.5); g.lineTo(-20, k * 3.5); g.stroke(); } } }); });
    if (!B || !HF) return Sprites.drawOtter(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, kick = Math.sin(ph) * 6;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-40, 4); ctx.rotate(kick * .06); put(ctx, HF); ctx.restore();
    ctx.save(); ctx.translate(-40, -2); ctx.rotate(-kick * .06); ctx.scale(1, -1); put(ctx, HF); ctx.restore();
    ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.moveTo(-48, 0); ctx.quadraticCurveTo(-64, 2, -70, 6 + kick * .3); ctx.quadraticCurveTo(-62, 1, -48, 2); ctx.fill();
    put(ctx, B);
    ctx.fillStyle = '#4a3424'; ctx.beginPath(); ctx.ellipse(10, 12, 7, 4, .3, 0, TAU); ctx.fill();
    eyeLive(ctx, 41, -5, 2.6, [30, 24, 20]);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .4; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(46, 1 + k); ctx.lineTo(58, 2 + k * 4); ctx.stroke(); }
    ctx.restore();
  }
  /* --- the grey whale (canonical 1000 long): the mottled body painted once, flukes and flipper live --- */
  function drawWhale(ctx, o) {
    const B = one('whale', () => {
      const R = mulberry32(5), fb = fbmOf(9), p = new Path2D();
      p.moveTo(470, -20); p.quadraticCurveTo(430, -80, 300, -92); p.quadraticCurveTo(0, -110, -300, -60); p.quadraticCurveTo(-420, -30, -440, -6); p.lineTo(-440, 14); p.quadraticCurveTo(-300, 50, 0, 78); p.quadraticCurveTo(300, 90, 440, 50); p.quadraticCurveTo(486, 20, 470, -20); p.closePath();
      const spots = [], bumps = [];
      for (let i = 0; i < 160; i++) spots.push([lerp(-420, 420, R()), lerp(-90, 60, R()), 3 + R() * 12, R() < .6 ? [226, 224, 216] : [52, 54, 58], .3 + R() * .25]);
      for (const [x, y, r] of [[380, -60, 26], [300, -80, 18], [430, -10, 14], [150, -90, 14], [-200, -70, 16]]) for (let k = 0; k < 18; k++) { const a = R() * TAU, d = Math.sqrt(R()) * r; spots.push([x + Math.cos(a) * d, y + Math.sin(a) * d * .6, 1.5 + R() * 2.5, [240, 222, 184], .8]); bumps.push([x + Math.cos(a) * d, y + Math.sin(a) * d * .6, 2.5, 2]); }
      for (let k = 0; k < 7; k++) bumps.push([-40 - k * 46, -84 + k * 6, 14, 6]);
      return paintShell(-450, -120, 490, 100, {
        paths: p, round: 70, gloss: .5, shine: 18, res: .55, spots, bumps, rim: .3,
        grooves: [[[[470, 10], [380, 44], [240, 50]], 4, 6]],
        color: (x, y) => { let c = mx([84, 90, 96], [128, 132, 138], ss(-80, 30, y)); c = mx(c, [196, 198, 200], ss(36, 80, y)); const m = fb(x * .006, y * .01); return mx(c, [60, 62, 66], ss(.55, .75, m) * .35); }
      });
    });
    const TL = one('whaleTail', () => { const p = new Path2D(); p.moveTo(10, -10); p.quadraticCurveTo(-70, -30, -130, -90); p.quadraticCurveTo(-90, -20, -70, 0); p.quadraticCurveTo(-90, 20, -130, 90); p.quadraticCurveTo(-70, 30, 10, 18); p.closePath(); return paintShell(-135, -95, 15, 95, { paths: p, round: 14, gloss: .5, res: .55, color: (x, y) => mx([70, 74, 78], [100, 104, 108], ss(-60, 60, y)) }); });
    const PF = one('whalePec', () => { const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(-70, 110, -150, 130); p.quadraticCurveTo(-100, 50, -90, 10); p.closePath(); return paintShell(-155, -4, 4, 134, { paths: p, round: 10, gloss: .5, res: .55, color: (x, y) => mx([76, 80, 86], [110, 112, 116], ss(0, 120, y)) }); });
    if (!B || !TL || !PF) return Sprites.drawWhale(ctx, o);
    const s = o.s || 1, t = o.t || 0, blow = o.blow || 0, sw = Math.sin(t * .9) * 26;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-430, 4); ctx.rotate(sw / 160); put(ctx, TL); ctx.restore();
    put(ctx, B);
    ctx.save(); ctx.translate(240, 60); ctx.rotate(Math.sin(t) * .04); put(ctx, PF); ctx.restore();
    eyeLive(ctx, 362, 8, 7, [40, 40, 40]);
    if (blow > 0) { ctx.fillStyle = `rgba(230,240,255,${blow * .5})`; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(300 + (k - 4) * 14 * (1.2 - blow), -100 - (1.2 - blow) * 90 - Math.abs(k - 4) * 6, 14 + (1.2 - blow) * 18, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }

  /* --- food on the floor: red rock crabs, butter clams, rock scallops, moon snails --- */
  function foodPart(kind) {
    return one('food|' + kind, () => {
      const R = mulberry32(kind.length * 17);
      if (kind === 'crab') {
        const p = new Path2D(); p.ellipse(0, 0, 5.4, 3.6, 0, 0, TAU);
        const bumps = []; for (let i = 0; i < 9; i++) { const a = Math.PI + .25 + i / 8 * (Math.PI - .5); bumps.push([Math.cos(a) * 5, Math.sin(a) * 3.3, .6, .5]); }
        const spots = []; for (let i = 0; i < 60; i++) spots.push([lerp(-5, 5, R()), lerp(-3.3, 3, R()), .12 + R() * .25, [120, 30, 30], .6]);
        const body = paintShell(-6.5, -4.5, 6.5, 4.5, { paths: p, round: 2.4, gloss: .8, shine: 28, res: 10, bumps, spots, color: (x, y) => mx([200, 84, 60], [150, 50, 40], ss(-3, 3, y)) });
        const cl = new Path2D(); cl.ellipse(0, 0, 2.2, 1.4, 0, 0, TAU);
        const claw = paintShell(-2.6, -1.8, 2.6, 1.8, { paths: cl, round: 1, gloss: .9, res: 12, color: (x) => mx([190, 70, 50], [30, 20, 18], ss(.4, 2.2, x)) });
        return { body, claw };
      }
      if (kind === 'clam') {
        const p = new Path2D(); p.moveTo(-6, 1); p.quadraticCurveTo(-5, -4.5, 1, -4.5); p.quadraticCurveTo(7, -3, 6, 2); p.quadraticCurveTo(0, 4, -6, 1); p.closePath();
        const grooves = []; for (let i = 0; i < 6; i++) { const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([lerp(-4.5, 5 - i * .6, t), lerp(1, -2.5 + i * 1.1, Math.sin(t * Math.PI) * .9) - (1 - t) * 0]); } grooves.push([pts, .22, .35]); }
        return paintShell(-7, -6, 8, 5, { paths: p, round: 2.4, gloss: .55, shine: 24, res: 10, rim: .3, grooves,
          color: (x, y) => { const d = Math.hypot(x + 5, y - 1), ring = .5 + .5 * Math.sin(d * 3.2); let c = mx([232, 220, 192], [196, 180, 148], ring * .5); return mx(c, [150, 134, 108], ss(4, 9, d) * .3); } });
      }
      if (kind === 'scallop') {
        const p = new Path2D(); p.moveTo(-2, 3); for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, r = 6.2 + (i % 2) * .6; p.lineTo(Math.cos(a) * r, 3 + Math.sin(a) * r * .9); } p.lineTo(2, 3); p.closePath();
        const grooves = []; for (let i = 1; i < 10; i += 2) { const a = Math.PI + i / 10 * Math.PI; grooves.push([[[0, 3], [Math.cos(a) * 6, 3 + Math.sin(a) * 5.4]], .35, .5]); }
        return paintShell(-7.5, -4, 7.5, 4, { paths: p, round: 2.2, gloss: .5, shine: 22, res: 10, grooves, rim: .3,
          color: (x, y) => { const d = Math.hypot(x, y - 3); return mx([224, 160, 136], [120, 60, 56], ss(1, 6.5, d) * .8); } });
      }
      if (kind === 'snail') {
        const p = new Path2D(); p.arc(0, 0, 4.4, 0, TAU);
        const grooves = [[[], .25, .4]]; for (let a = .6; a < 9; a += .2) grooves[0][0].push([Math.cos(a) * a * .45, Math.sin(a) * a * .45]);
        const shell = paintShell(-5, -5, 5, 5, { paths: p, round: 3.2, gloss: .8, shine: 30, res: 12, grooves, color: (x, y) => { const d = Math.hypot(x, y), a = Math.atan2(y, x); return mx([226, 214, 196], [150, 134, 116], .5 + .5 * Math.sin(d * 2.6 - a)); } });
        return { shell };
      }
      return null;
    });
  }
  function drawFood(ctx, it, t) {
    const k = FOOD_KINDS[it.kind], left = it.bites / k.bites, F = foodPart(it.kind);
    if (!F) return Sprites.drawFood(ctx, it, t);
    ctx.save(); ctx.rotate(it.rot * .3);
    if (it.kind === 'clam') { put(ctx, F); if (left < 1) { ctx.fillStyle = '#f0c080'; ctx.beginPath(); ctx.ellipse(1, 0, 3, 1.6, .2, 0, TAU); ctx.fill(); } }
    else if (it.kind === 'crab') {
      ctx.lineCap = 'round';
      for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) { const kx = s2 * 7, ky = -3 + i * 2 + Math.sin(t * 6 + i) * .6; ctx.strokeStyle = 'rgba(120,40,30,1)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(s2 * 3, -1 + i); ctx.lineTo(kx, ky); ctx.stroke(); ctx.strokeStyle = '#c0604a'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(s2 * 9, 1 + i * 1.5); ctx.stroke(); }
      ctx.save(); ctx.translate(-5.2, 2.6); ctx.rotate(.5); put(ctx, F.claw); ctx.restore(); ctx.save(); ctx.translate(5.2, 2.6); ctx.rotate(-.5 + Math.PI); ctx.scale(1, -1); put(ctx, F.claw); ctx.restore();
      put(ctx, F.body);
      for (const x of [-1.5, 1.5]) { ctx.fillStyle = '#0c0a08'; ctx.beginPath(); ctx.arc(x, -3, .55, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - .15, -3.15, .15, 0, TAU); ctx.fill(); }
      if (left < 1) { ctx.fillStyle = 'rgba(255,244,230,.6)'; ctx.beginPath(); ctx.arc(2, 0, 2.5 * (1 - left), 0, TAU); ctx.fill(); }
    } else if (it.kind === 'scallop') { put(ctx, F); if (left < 1) { ctx.fillStyle = '#fff0e0'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.8, 0, 0, TAU); ctx.fill(); } }
    else if (it.kind === 'snail') { ctx.fillStyle = '#9a8a7a'; ctx.beginPath(); ctx.ellipse(4, 2.6, 3.4, 1.5, 0, 0, TAU); ctx.fill(); put(ctx, F.shell); }
    ctx.restore();
  }

  /* --- plankton: a copepod, a krill, a crab zoea, a dinoflagellate --- */
  function planktonPart(kind) {
    return one('plk|' + kind, () => {
      const RES = 40;
      if (kind === 'krill') return paintShell(-3, -1.6, 3.6, 2, { paths: (() => { const p = new Path2D(); p.moveTo(2, 0); p.quadraticCurveTo(0, -.9, -2, -.4); p.lineTo(-2.6, 0); p.lineTo(-2, .5); p.quadraticCurveTo(0, 1, 2, 0); p.closePath(); return p; })(), round: .4, gloss: .9, res: RES, rim: .6,
        color: (x) => mx([250, 226, 214], [240, 190, 180], ss(-2, 2, x)),
        post: (g) => { g.strokeStyle = 'rgba(240,200,190,.85)'; g.lineWidth = .08; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-1.4 + k * .6, .6); g.lineTo(-1.6 + k * .6, 1.3); g.stroke(); } g.beginPath(); g.moveTo(1.8, -.4); g.lineTo(3.2, -1.6); g.stroke(); g.fillStyle = '#1a1a2a'; g.beginPath(); g.arc(1.6, -.2, .3, 0, TAU); g.fill(); } });
      if (kind === 'zoea') return paintShell(-3, -3.2, 2, 2.6, { paths: (() => { const p = new Path2D(); p.arc(0, 0, 1.1, 0, TAU); return p; })(), round: .5, gloss: .9, res: RES, rim: .5,
        color: (x, y) => mx([240, 210, 170], [200, 160, 110], ss(-.6, .8, y)),
        post: (g) => { g.strokeStyle = 'rgba(200,160,110,.9)'; g.lineWidth = .1; g.beginPath(); g.moveTo(0, -1); g.lineTo(.3, -3); g.moveTo(-1, .3); g.lineTo(-2.8, .9); g.moveTo(.8, .8); g.lineTo(1.4, 2.2); g.stroke(); g.fillStyle = '#101020'; g.beginPath(); g.arc(.7, -.3, .3, 0, TAU); g.arc(-.3, -.6, .25, 0, TAU); g.fill(); } });
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
    if (q.kind === 'copepod' || q.kind === 'zoea') ctx.rotate(-q.rot - t * .2 + Math.atan2(q.vy, q.vx || .01));
    if (q.kind === 'krill') ctx.rotate(-q.rot - t * .2 + Math.sin(q.ph) * .3);
    if (q.kind === 'dino') { const glow = night * .4 + q.glow; if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,230,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); } }
    put(ctx, P);
    ctx.restore();
  }

  /* ============================================================
     THE SEA FLOOR: bull kelp, boulders with a crack under the front, crevices and
     mud banks, sea stars, anemones, empty shells, the sunflower star, and a seamless
     detail tile for the cross-section
     ============================================================ */
  /* --- a bull kelp blade: a long narrow olive ribbon, painted straight once, then bent in slices --- */
  function kelpBlade(v, far) {
    return one('kelp|' + v + (far ? 'f' : ''), () => {
      const L = 240, Wd = 12, N = 120, p = new Path2D();
      const half = (u) => Wd / 2 * Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - u * .25) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - .85) / .15, 2)));
      const ruffle = (u, s) => (Math.sin(u * 40 + v * 3 + s) * .4 + Math.sin(u * 27 + v + s * 2) * .3) * ss(.04, .2, u) * (1 - ss(.9, 1, u));
      p.moveTo(0, 0);
      for (let i = 0; i <= N; i++) { const u = i / N; p.lineTo(-half(u) - ruffle(u, 0), u * L); }
      for (let i = N; i >= 0; i--) { const u = i / N; p.lineTo(half(u) + ruffle(u, 1.7), u * L); }
      p.closePath();
      const fb = fbmOf(80 + v);
      return paintShell(-Wd / 2 - 3, -1, Wd / 2 + 3, L + 1, {
        paths: p, round: 4, gloss: .25, shine: 10, res: 3, amb: .7, rim: 0,
        color: (x, y) => {
          const u = y / L, h = half(u) + .01, edge = clamp(Math.abs(x) / h, 0, 1.3);
          let c = mx([74, 70, 24], [96, 88, 30], fb(x * .1, y * .02));
          c = mx(c, mx([128, 112, 40], [150, 134, 56], .5 + .5 * Math.sin(y * .5 + v)), ss(.5, .95, edge) * .6);
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
    /* holdfast, the long whip of a stipe, the float */
    ctx.fillStyle = '#3e3018'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * 1.6, 1, 2.2, 1.6, i * .3, 0, TAU); ctx.fill(); }
    const topX = sw * 1.2, topY = -k.h;
    ctx.strokeStyle = far ? '#4a4a2a' : '#6a5a22'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * .3, -k.h * .5, topX, topY); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,180,110,.3)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-.4, 0); ctx.quadraticCurveTo(sw * .3 - .4, -k.h * .5, topX - .4, topY); ctx.stroke();
    const bg = ctx.createRadialGradient(topX - 1.2, topY - 5, .5, topX, topY - 3, 5 + k.w * .3); bg.addColorStop(0, '#9a9a4a'); bg.addColorStop(.5, '#5a5a1e'); bg.addColorStop(1, '#2e2e10');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(topX, topY - 3, 3.4 + k.w * .25, 4.5 + k.w * .3, 0, 0, TAU); ctx.fill();
    /* the blades: ribbons streaming from the float, each drawn in slices along its own sway */
    const img = B.c, iw = img.width, ih = img.height, N = 10, w = B.w * k.w * 1.6 / 12;
    for (let b = 0; b < 4; b++) {
      const L = k.h * (.35 + b * .08), dir = (b % 2 ? 1 : -1), ph = k.ph + b;
      const xAt = (u) => topX + dir * (u * 10 + Math.sin(u * 7 + t * 1.5 + ph) * k.w * .7) + sw * u * .5, yAt = (u) => topY + u * L;
      ctx.save(); ctx.globalAlpha = far ? .8 : .92;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N, xa = xAt(u0), xb = xAt(u1), ya = yAt(u0), yb = yAt(u1), hh = yb - ya;
        ctx.save(); ctx.translate((xa + xb) / 2, (ya + yb) / 2); ctx.transform(1, 0, (xb - xa) / hh, 1, 0, 0);
        ctx.drawImage(img, 0, ih * u0, iw, ih / N, -w / 2, -hh / 2 - .25, w, hh + .5);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  /* --- a boulder: a rounded granite stone, speckled, crusted with pink coralline, a few barnacles --- */
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
    if (sh.kind === 'bottle') return false;
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
  /* --- the sunflower star: a big soft disc with many arms, orange and purple, rows of pale spines --- */
  function drawSunStar(ctx, o) {
    const img = one('sunstar', () => {
      const R = mulberry32(17), n = 18, p = new Path2D();
      for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * TAU, r = k % 2 ? 7 : 14; const x = Math.cos(a) * r, y = Math.sin(a) * r * .5; k ? p.lineTo(x, y) : p.moveTo(x, y); }
      p.closePath();
      const bumps = [], spots = [];
      for (let k = 0; k < n; k++) { const an = k / n * TAU; for (let j = 1; j < 5; j++) { const d = j * 3; bumps.push([Math.cos(an) * d, Math.sin(an) * d * .5, .5, .4]); spots.push([Math.cos(an) * d, Math.sin(an) * d * .5, .3, [250, 236, 210], .75]); } }
      for (let i = 0; i < 40; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 6; bumps.push([Math.cos(a) * d, Math.sin(a) * d * .5, .6, .3]); }
      return paintShell(-15, -8, 15, 8, { paths: p, round: 3, gloss: .4, res: 8, bumps, spots, color: (x, y) => { const d = Math.hypot(x, y * 2); return mx(mx([236, 150, 90], [200, 100, 80], ss(2, 10, d)), [140, 70, 112], ss(8, 14, d) * .7); } });
    });
    if (!img) return Sprites.drawSunStar(ctx, o);
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s); ctx.scale(1 + Math.sin(ph * 2) * .02, 1); put(ctx, img); ctx.restore();
  }
  /* --- a sea star (ochre star): five arms, rows of pale spines; coloured by the decor --- */
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
  /* --- a plumose anemone: a smooth column, a cloud of fine tentacles that sway --- */
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
    const gc = document.createElement('canvas'); gc.width = c.width; gc.height = c.height; gc.getContext('2d').drawImage(c, 0, 0);
    floorPat = ctx.createPattern(gc, 'repeat');
    if (floorPat.setTransform) floorPat.setTransform(new DOMMatrix().scale(1 / K, 1 / K));
    stat.n++; stat.ms += performance.now() - t0; spent(t0);
    return floorPat;
  }

  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms) }; }

  const api = { beginFrame, drawOctopus, octopusReady, drawSettler, drawParalarva, drawEgg, drawFish, drawHunter, drawSeal, drawOtter, drawWhale, drawFood, drawPlankton, drawKelp, drawShelter, drawSunStar, drawStar, drawAnemone, drawShell, floorPattern, cached };
  /* anything not painted here is the classic sprite, so render.js can ask Painted for everything */
  for (const k of Object.keys(Sprites)) if (!(k in api)) api[k] = Sprites[k];
  return api;
})();
