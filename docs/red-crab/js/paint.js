/* ============================================================
   paint.js — the painted island (with the WebGL look, ?gfx=gl)
   ============================================================
     The same animals and props as sprites.js, with the same
     options and the same joints (so every pose, size, stage and
     colour form still works), but built the way an artist's rig is:
     painted parts mounted on bones.

     Each part is painted ONCE, here in code, as a little relief:
     its silhouette is turned into a height field (a rounded
     "pillow" from the distance to its edge, plus domes, granules,
     grooves and bark), lit per pixel by a key light from the upper
     left (wrapped diffuse, a sharp specular and a broad sheen, a
     sky/ground reflection at grazing angles, occlusion in the
     grooves), and cached as an image.  Shells come out glossy,
     not furry: the red crab's carapace is scarlet in the middle,
     crimson to purple-red at its edges and in its grooves, with
     fine granules that each catch a highlight.
       crab: carapace · leg segments (merus, propodus, dactyl) ·
             claw arm, hand, finger · eye stalk, eye · mouth plate ·
             egg mass          (per colour form, soft-shell stage)
       robber crab, larvae (zoea, megalopa), egg, fish, whale shark,
       manta, jellyfish, turtle, frigatebird, the ranger, rainforest
       trunks and crowns, palms, pandanus, ferns, litter, coral,
       sea fans, boulders, logs, and detail tiles for the cross-
       section (reef, sand, limestone, red soil)
     Per frame the parts are only placed, so a crab is ~40 drawImage
     calls and a crowd crab (pre-composed by render.js) is one.

     Lessons from Wolf, kept: parts are painted on CPU canvases
     (willReadFrequently: thousands of tiny fills or a getImageData
     on a GPU canvas stall for seconds), inside-tests use an alpha
     mask, baking has a ~10 ms budget per frame and anything not
     baked yet is drawn the classic way for that frame; finished
     parts are copied once to ordinary canvases (a CPU canvas drawn
     every frame, or used as a pattern, is re-uploaded every frame).
   ============================================================ */
'use strict';

const Painted = (function () {
  const SOFT = { willReadFrequently: true };
  const stat = { n: 0, ms: 0 };
  const cache = new Map();
  let budget = 10;
  function beginFrame() { budget = 10; }
  const canBake = () => budget > 0;
  const spent = (t0) => { budget -= performance.now() - t0; };
  /* get a cached thing, or make it now if the frame still has time (else null: draw the classic way) */
  function get(key, make) {
    let v = cache.get(key);
    if (v === undefined) {
      if (!canBake()) return null;
      const t0 = performance.now();
      v = make(); cache.set(key, v); stat.n++; stat.ms += performance.now() - t0; spent(t0);
    }
    return v;
  }

  /* ---------- colour ---------- */
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);
  const GAM = new Uint8ClampedArray(4096); for (let i = 0; i < 4096; i++) GAM[i] = Math.round(255 * Math.pow(i / 4095, 1 / 2.2));
  const toG = (v) => GAM[v >= 1 ? 4095 : v <= 0 ? 0 : (v * 4095) | 0];
  const lin = (c) => LIN[clamp(c | 0, 0, 255)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const HX = (h) => hexToRgb(h);

  /* ---------- the relief painter ---------- */
  function newCanvas(w, h, soft) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return [c, c.getContext('2d', soft ? SOFT : undefined)]; }
  /* hand a finished CPU canvas over to an ordinary one, once */
  function finish(c) { const [o, g] = newCanvas(c.width, c.height); g.drawImage(c, 0, 0); return o; }
  /*  o: { box: [x0,y0,x1,y1] (units), res (px per unit), shape(g) fills the silhouette,
         depth: the pillow's radius (units), dome(x,y): extra height, bumps: [[x,y,r,h]], grooves: [[[x,y]...], width, depth],
         noise(x,y): extra height, relief: slope gain, albedo(x,y,ctx) → [r,g,b] 0..255, alpha(x,y,ctx) → 0..1,
         light: [x,y,z], amb, diff, wrap, spec, shin, sheen, env, sss: [r,g,b], ao, after(g) → paint on top }  */
  const log = [];
  function relief(o) {
    const T0 = performance.now();
    const [x0, y0, x1, y1] = o.box, RES = o.res || 4;
    const W = Math.max(1, Math.ceil((x1 - x0) * RES)), Hh = Math.max(1, Math.ceil((y1 - y0) * RES)), N = W * Hh;
    const [mc, mg] = newCanvas(W, Hh, true);
    mg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); mg.fillStyle = '#fff'; mg.strokeStyle = '#fff'; mg.lineCap = 'round'; mg.lineJoin = 'round';
    o.shape(mg);
    const md = mg.getImageData(0, 0, W, Hh).data;
    /* distance to the edge (chamfer), in px */
    const D = new Float32Array(N);
    for (let i = 0; i < N; i++) D[i] = md[i * 4 + 3] > 110 ? 1e6 : 0;
    if (o.rows) {
      /* across only (for tiles that repeat up and down): the distance to the run's left or right end */
      for (let y = 0; y < Hh; y++) {
        let x = 0;
        while (x < W) {
          if (!D[y * W + x]) { x++; continue; }
          let e = x; while (e < W && D[y * W + e]) e++;
          for (let k = x; k < e; k++) D[y * W + k] = Math.min(k - x + 1, e - k);
          x = e;
        }
      }
    } else
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!D[i]) continue;
      let d = D[i];
      if (x > 0) d = Math.min(d, D[i - 1] + 1); else d = Math.min(d, 1);
      if (y > 0) { d = Math.min(d, D[i - W] + 1); if (x > 0) d = Math.min(d, D[i - W - 1] + 1.414); if (x < W - 1) d = Math.min(d, D[i - W + 1] + 1.414); } else d = Math.min(d, 1);
      D[i] = d;
    }
    if (!o.rows) for (let y = Hh - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!D[i]) continue;
      let d = D[i];
      if (x < W - 1) d = Math.min(d, D[i + 1] + 1); else d = Math.min(d, 1);
      if (y < Hh - 1) { d = Math.min(d, D[i + W] + 1); if (x < W - 1) d = Math.min(d, D[i + W + 1] + 1.414); if (x > 0) d = Math.min(d, D[i + W - 1] + 1.414); } else d = Math.min(d, 1);
      D[i] = d;
    }
    /* the height field */
    const Hf = new Float32Array(N), G = new Float32Array(N), dep = o.depth || 4;
    const ux = (x) => x0 + (x + .5) / RES, uy = (y) => y0 + (y + .5) / RES;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!D[i]) continue;
      const t = Math.min(D[i] / RES, dep) / dep, X = ux(x), Y = uy(y);
      let h = dep * Math.sqrt(1 - (1 - t) * (1 - t));
      if (o.dome) h += o.dome(X, Y);
      if (o.noise) h += o.noise(X, Y);
      Hf[i] = h;
    }
    if (o.bumps) for (const [bx, by, br, bh] of o.bumps) {
      const cx = (bx - x0) * RES, cy = (by - y0) * RES, r = br * RES;
      for (let y = Math.max(0, (cy - r) | 0); y <= Math.min(Hh - 1, (cy + r) | 0); y++) for (let x = Math.max(0, (cx - r) | 0); x <= Math.min(W - 1, (cx + r) | 0); x++) {
        const d = Math.hypot(x - cx, y - cy) / r; if (d >= 1) continue;
        const i = y * W + x; if (D[i]) Hf[i] += bh * Math.sqrt(1 - d * d);
      }
    }
    if (o.grooves) for (const [pts, gw, gd] of o.grooves) {
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L * RES / 2));
        for (let s = 0; s <= n; s++) {
          const px = (lerp(ax, bx, s / n) - x0) * RES, py = (lerp(ay, by, s / n) - y0) * RES, r = gw * RES;
          for (let y = Math.max(0, (py - r) | 0); y <= Math.min(Hh - 1, (py + r) | 0); y++) for (let x = Math.max(0, (px - r) | 0); x <= Math.min(W - 1, (px + r) | 0); x++) {
            const d = Math.hypot(x - px, y - py) / r; if (d >= 1) continue;
            const i = y * W + x, v = gd * (.5 + .5 * Math.cos(d * Math.PI)); if (v > G[i]) G[i] = v;
          }
        }
      }
      for (let i = 0; i < N; i++) if (G[i]) Hf[i] -= G[i];
    }
    /* light it */
    let [lx, ly, lz] = o.light || [-.42, -.62, .66]; { const l = Math.hypot(lx, ly, lz); lx /= l; ly /= l; lz /= l; }
    let hx = lx, hy = ly, hz = lz + 1; { const l = Math.hypot(hx, hy, hz); hx /= l; hy /= l; hz /= l; }
    const amb = o.amb === undefined ? .42 : o.amb, kd = o.diff === undefined ? .78 : o.diff, wrap = o.wrap === undefined ? .25 : o.wrap;
    const ks = o.spec || 0, shin = o.shin || 40, sheen = o.sheen || 0, kr = o.env || 0, relief0 = o.relief || 1, aoR = (o.ao === undefined ? 1.2 : o.ao) * RES;
    const sss = o.sss, gMax = o.grooves ? Math.max(...o.grooves.map(g => g[2])) : 1;
    const out = mg.createImageData(W, Hh), q = out.data, step = 2 / RES;
    const ctx = { h: 0, nx: 0, ny: 0, nz: 1, edge: 0, groove: 0 };
    let al = null;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, a = md[i * 4 + 3];
      if (a < 3) continue;
      const hL = x > 0 && D[i - 1] ? Hf[i - 1] : Hf[i], hR = x < W - 1 && D[i + 1] ? Hf[i + 1] : Hf[i];
      const hU = y > 0 && D[i - W] ? Hf[i - W] : Hf[i], hD = y < Hh - 1 && D[i + W] ? Hf[i + W] : Hf[i];
      let nx = -(hR - hL) / step * relief0, ny = -(hD - hU) / step * relief0, nz = 1;
      if (!D[i]) { nx = 0; ny = 0; }
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const X = ux(x), Y = uy(y);
      ctx.h = Hf[i]; ctx.nx = nx; ctx.ny = ny; ctx.nz = nz; ctx.edge = D[i] / RES; ctx.groove = G[i] / gMax;
      /* the colour changes slowly: work it out on every other pixel */
      if (!(x & 1) || !al) al = o.albedo(X, Y, ctx);
      const ar = LIN[clamp(al[0] | 0, 0, 255)], ag = LIN[clamp(al[1] | 0, 0, 255)], ab = LIN[clamp(al[2] | 0, 0, 255)];
      const ndl = nx * lx + ny * ly + nz * lz, dif = Math.max(0, (ndl + wrap) / (1 + wrap));
      let ao = Math.min(1, .55 + .45 * Math.min(1, D[i] / aoR)) * (1 - ctx.groove * .55);
      const sky = amb * (.75 + .35 * Math.max(0, -ny) - .15 * Math.max(0, ny));
      let r = ar * (sky * ao + dif * kd * Math.sqrt(ao)), g = ag * (sky * ao + dif * kd * Math.sqrt(ao)), b = ab * (sky * ao + dif * kd * Math.sqrt(ao));
      if (sss) { const k = (1 - dif) * .5 * ao; r += sss[0] * k; g += sss[1] * k; b += sss[2] * k; }
      if (ks || sheen) {
        const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
        const s = (ks ? ks * Math.pow(ndh, shin) : 0) + (sheen ? sheen * Math.pow(ndh, 6) : 0);
        const sp = s * ao * (o.specMask ? o.specMask(X, Y, ctx) : 1);
        r += sp; g += sp * .97; b += sp * .92;
      }
      if (kr) {
        const fr = Math.pow(1 - nz, 2.5) * kr * ao, up = clamp(.5 - ny * .6, 0, 1);
        r += fr * lerp(.05, .55, up); g += fr * lerp(.04, .62, up); b += fr * lerp(.03, .72, up);
      }
      q[i * 4] = toG(r); q[i * 4 + 1] = toG(g); q[i * 4 + 2] = toG(b);
      q[i * 4 + 3] = o.alpha ? clamp(a * o.alpha(X, Y, ctx), 0, 255) : a;
    }
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, W, Hh); mg.putImageData(out, 0, 0);
    if (o.after) { mg.save(); mg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); mg.globalCompositeOperation = 'source-atop'; mg.lineCap = 'round'; mg.lineJoin = 'round'; o.after(mg); mg.restore(); }
    if (o.over) { mg.save(); mg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); mg.lineCap = 'round'; mg.lineJoin = 'round'; o.over(mg); mg.restore(); }
    const part = { c: o.keepSoft ? mc : finish(mc), x0, y0, w: x1 - x0, h: y1 - y0 };
    if (log.length < 400) log.push([W * Hh, Math.round(performance.now() - T0)]);
    return part;
  }
  function put(ctx, part) { ctx.drawImage(part.c, part.x0, part.y0, part.w, part.h); }
  /* a part along a bone from a to b (its own frame runs down +y, `nominal` long); ws scales its width */
  function bone(ctx, part, a, b, nominal, ws = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2); ctx.scale(ws, len / nominal || .001);
    put(ctx, part); ctx.restore();
  }
  /* value noise with rotated octaves (one octave alone shows its square lattice) */
  function fbmN(seed) {
    const N = makeNoise2D(seed);
    return (x, y) => N(x * .94 + y * .34, y * .94 - x * .34) * .5 + N(x * 1.93 + y * .52 + 17, y * 1.93 - x * .52 + 5) * .3 + N(x * 3.9 - y * 1.1 + 3, y * 3.9 + x * 1.1 + 9) * .2;
  }
  /* a plain painted part (no relief): for thin things like leaves */
  function bake2d(box, res, paint) {
    const [x0, y0, x1, y1] = box;
    const [c, g] = newCanvas(Math.ceil((x1 - x0) * res), Math.ceil((y1 - y0) * res), true);
    g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res); g.lineCap = 'round'; g.lineJoin = 'round';
    paint(g);
    return { c: finish(c), x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  /* one thin leaf along +x from the origin: flat colour with a slight fold at the midrib, veins,
     a soft light edge and a glow where the light comes through it */
  function thinLeaf(g, L, wd, col, R, o = {}) {
    const W = L * wd, path = new Path2D();
    path.moveTo(0, 0); path.bezierCurveTo(L * .22, -W * 1.05, L * .72, -W * .85, L, 0); path.bezierCurveTo(L * .72, W * .85, L * .22, W * 1.05, 0, 0);
    g.save();
    const dark = mix(col, [18, 40, 16], .35), light = mix(col, [190, 230, 120], .22);
    const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, css(dark)); lg.addColorStop(.45, css(col)); lg.addColorStop(1, css(light));
    g.fillStyle = lg; g.fill(path);
    g.clip(path);
    g.fillStyle = 'rgba(10,30,8,.16)'; g.fillRect(0, 0, L, W * 1.2);                         /* the lower half, folded away from the light */
    if (o.glow !== false) {
      const gx = L * (.45 + R() * .35), gy = -W * .3, rg = g.createRadialGradient(gx, gy, 0, gx, gy, L * .45);
      rg.addColorStop(0, `rgba(214,246,130,${.22 + R() * .2})`); rg.addColorStop(1, 'rgba(214,246,130,0)');
      g.fillStyle = rg; g.fillRect(0, -W * 1.2, L, W * 2.4);
    }
    g.lineWidth = Math.max(.12, L * .022); g.strokeStyle = 'rgba(226,250,190,.55)';
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .5, -W * .06, L * .98, 0); g.stroke();
    if (L > 8) {
      g.lineWidth = Math.max(.08, L * .009); g.strokeStyle = 'rgba(220,248,180,.3)';
      for (let k = 1; k < 7; k++) { const t = k / 7.5, x = L * t; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + L * .07, sd * W * .4, x + L * .14, sd * W * .75 * Math.sin(Math.PI * Math.min(1, t + .1))); g.stroke(); } }
    }
    g.lineWidth = Math.max(.2, L * .03); g.strokeStyle = 'rgba(236,255,200,.35)'; g.stroke(path);   /* the soft light edge */
    g.restore();
  }
  /* scattered points, for granules */
  function scatter(R, n, fn) { const out = []; for (let i = 0; i < n; i++) { const v = fn(R); if (v) out.push(v); } return out; }

  /* ============================================================
     THE CRAB (front view, the same frame as Sprites.drawCrab:
     shell 100 units wide, origin mid-shell, leg tips at y ≈ +42)
     ============================================================ */
  const SEG = 30;                                    /* the nominal length of a leg segment's bake */
  function shellPath(g, robber) {
    g.beginPath();
    if (robber) { g.moveTo(-40, 8); g.bezierCurveTo(-46, -24, -26, -38, 0, -38); g.bezierCurveTo(26, -38, 46, -24, 40, 8); g.bezierCurveTo(36, 18, 16, 20, 0, 20); g.bezierCurveTo(-16, 20, -36, 18, -40, 8); }
    else { g.moveTo(-48, 6); g.bezierCurveTo(-53, -22, -30, -33, 0, -33); g.bezierCurveTo(30, -33, 53, -22, 48, 6); g.bezierCurveTo(44, 16, 20, 18, 0, 18); g.bezierCurveTo(-20, 18, -44, 16, -48, 6); }
    g.closePath();
  }
  function crabKit(form, pale, robber) {
    const cols = Sprites.crabCols(form, pale, robber), R = mulberry32(17 + form.length * 31 + Math.round(pale * 4) * 7 + (robber ? 99 : 0));
    const sh = cols.shell, sh2 = cols.shell2, leg = cols.leg, claw = cols.claw;
    const deep = mix(sh2, robber ? [20, 16, 50] : [70, 10, 40], .45);           /* the purple-red of the shadows and grooves */
    const bright = mix(sh, robber ? [150, 140, 230] : [255, 120, 70], .22);      /* scarlet, warm in the middle */
    const glossy = { spec: pale > .5 ? .3 : .78, shin: 110, sheen: .045, env: .18, wrap: .3 };
    const kit = { cols };
    /* --- the carapace: a domed shell with an H of grooves, eye orbits, granules at its front and sides --- */
    const grooves = robber
      ? [[[[-16, -33], [-10, -18], [-13, 2]], 1.8, 1.6], [[[16, -33], [10, -18], [13, 2]], 1.8, 1.6], [[[-10, -16], [0, -13], [10, -16]], 1.6, 1.3], [[[-30, -10], [-20, -4]], 1.4, 1], [[[30, -10], [20, -4]], 1.4, 1]]
      : [[[[-15, -29], [-11, -20], [-8, -14], [-10, -5], [-11, 4]], 1.7, 1.3], [[[15, -29], [11, -20], [8, -14], [10, -5], [11, 4]], 1.7, 1.3], [[[-9, -13], [-4, -10.5], [0, -10], [4, -10.5], [9, -13]], 1.5, 1.1], [[[-40, 4], [-28, 9], [-14, 11]], 1.2, .7], [[[40, 4], [28, 9], [14, 11]], 1.2, .7], [[[-17, 13], [-13, 9.5], [-9, 13]], 2.4, 1.6], [[[17, 13], [13, 9.5], [9, 13]], 2.4, 1.6]];
    const bumps = scatter(R, robber ? 420 : 240, (R) => {
      const x = (R() - .5) * 96, y = -32 + R() * 50, side = Math.abs(x) / 48, front = (y + 33) / 51;
      if (R() > .25 + side * .7 + front * .25) return null;
      return [x, y, .55 + R() * (robber ? 1.4 : .9), .12 + R() * (robber ? .45 : .2)];
    });
    const N2 = fbmN(R() * 1e6 | 0);
    kit.shell = () => relief({
      box: robber ? [-44, -41, 44, 23] : [-52, -36, 52, 21], res: 3.2, depth: 15, shape: (g) => { shellPath(g, robber); g.fill(); },
      dome: (x, y) => 9 * Math.max(0, 1 - (x * x) / 2500 - ((y + 6) * (y + 6)) / 900),
      noise: (x, y) => N2(x * .35, y * .35) * .35 + N2(x * 1.4, y * 1.4) * .08,
      bumps, grooves, relief: 1.1,
      albedo: (x, y, c) => {
        const r = Math.min(1, Math.hypot(x / 50, (y + 8) / 28));
        let col = mix(bright, sh, smoothstep(.15, .7, r));
        col = mix(col, sh2, smoothstep(.55, 1, r) * .8 + smoothstep(8, 17, y) * .35);
        col = mix(col, deep, c.groove * .8 + smoothstep(3, 0, c.edge) * .35);
        const n = N2(x * .18 + 9, y * .18);
        col = mix(col, robber ? [110, 100, 190] : [255, 150, 90], (n - .5) * .4 * (1 - c.groove));
        return col;
      },
      ...glossy, amb: .4, diff: .76, sss: robber ? null : [.09, .005, .004]
    });
    /* --- leg segments (thigh, shin, the pointed last joint) --- */
    const segPaint = (w0, w1, cTop, cBot, tip) => relief({
      box: [-w0 / 2 - 1, -w0 * .4, w0 / 2 + 1, SEG + w1 * .5 + (tip ? 1 : 0)], res: 5, depth: w0 * .5,
      shape: (g) => {
        g.beginPath(); g.moveTo(-w0 / 2, 0); g.quadraticCurveTo(-w0 * .55, SEG * .5, -w1 / 2, SEG * (tip ? .82 : 1));
        if (tip) g.lineTo(0, SEG + 1); else g.quadraticCurveTo(0, SEG + w1 * .5, w1 / 2, SEG);
        g.lineTo(w1 / 2, SEG * (tip ? .82 : 1)); g.quadraticCurveTo(w0 * .55, SEG * .5, w0 / 2, 0); g.quadraticCurveTo(0, -w0 * .4, -w0 / 2, 0); g.fill();
      },
      bumps: scatter(R, 26, (R) => [(R() - .5) * w0 * .7, R() * SEG, .35 + R() * .5, .08 + R() * .14]),
      dome: (x, y) => 0,
      albedo: (x, y, c) => {
        let col = mix(cTop, cBot, clamp(y / SEG, 0, 1));
        if (tip) { col = mix(col, claw, smoothstep(SEG * .45, SEG * .78, y)); col = mix(col, [40, 22, 12], smoothstep(SEG * .86, SEG, y)); }
        else col = mix(col, mix(cBot, [60, 10, 30], .5), smoothstep(SEG * .8, SEG, y) * .5);
        return mix(mix(col, sh2, .12), deep, smoothstep(2, 0, c.edge) * .6);
      },
      light: [-.25, -.35, .9], ...glossy, spec: glossy.spec * .7, shin: 60, amb: .36
    });
    kit.merus = () => segPaint(8.4, 7.4, mix(leg, [255, 255, 255], .06), leg);
    kit.pro = () => segPaint(7, 5.9, leg, mix(leg, sh2, .25));
    kit.dact = () => segPaint(4.8, 1.3, mix(leg, sh2, .15), leg, true);
    kit.stalk = () => segPaint(6, 5.6, sh, mix(sh, sh2, .3));
    /* --- the eye: a glossy dark bulb --- */
    kit.eye = () => relief({
      box: [-6.4, -6.4, 6.4, 6.4], res: 8, depth: 5.4, shape: (g) => { g.beginPath(); g.arc(0, 0, 5.6, 0, TAU); g.fill(); },
      albedo: (x, y) => mix([42, 38, 46], cols.eye, smoothstep(0, 5, Math.hypot(x - 1, y - 1))),
      spec: 1.1, shin: 90, sheen: .15, env: .5, amb: .35
    });
    /* --- the mouth plates (the third maxillipeds) --- */
    kit.plate = () => relief({
      box: [-.5, -.5, 11.5, 13.5], res: 6, depth: 2.2, shape: (g) => { g.beginPath(); g.roundRect(0, 0, 11, 12, 3); g.fill(); },
      bumps: scatter(R, 30, (R) => [R() * 11, R() * 12, .3 + R() * .4, .2]),
      albedo: (x, y, c) => mix(mix(sh, sh2, .35), deep, smoothstep(1.2, 0, c.edge) * .2),
      spec: .35, shin: 40, amb: .4,
      after: (g) => { g.strokeStyle = 'rgba(255,230,200,.45)'; g.lineWidth = .25; for (let i = 0; i < 16; i++) { const x = .5 + i * .65; g.beginPath(); g.moveTo(x, 11.4); g.lineTo(x + (R() - .5) * .6, 13.2); g.stroke(); } }
    });
    return kit;
  }
  /* a claw's hand and finger, for one size factor (boy, girl, robber) */
  function clawKit(form, pale, robber) {
    const cols = Sprites.crabCols(form, pale, robber), R = mulberry32(5 + form.length * 13 + (robber ? 7 : 0));
    const sh = cols.shell, sh2 = cols.shell2, deep = mix(sh2, robber ? [20, 16, 50] : [70, 10, 40], .45);
    const hand = 15, glossy = { spec: pale > .5 ? .25 : .6, shin: 70, sheen: .1, env: .22, wrap: .3 };
    const kit = {};
    kit.hand = () => relief({
      box: [-hand - 1, -hand * .7, hand + 1, hand * .7], res: 5, depth: 7,
      shape: (g) => { g.beginPath(); g.ellipse(0, 0, hand, hand * .62, 0, 0, TAU); g.fill(); },
      dome: (x, y) => 2 * Math.max(0, 1 - (x * x) / 225 - (y * y) / 80),
      bumps: scatter(R, robber ? 160 : 90, (R) => { const a = R() * TAU, d = Math.sqrt(R()); return [Math.cos(a) * hand * d * .95, Math.sin(a) * hand * .6 * d, .45 + R() * .7, .18 + R() * .3]; }),
      grooves: [[[[-hand * .6, hand * .15], [hand * .7, hand * .2]], 1, .5]],
      albedo: (x, y, c) => { let col = mix(mix(sh, [255, 140, 90], robber ? 0 : .15), sh2, smoothstep(-2, hand * .6, y) * .6); col = mix(col, cols.claw, smoothstep(hand * .45, hand, x) * .35); return mix(col, deep, smoothstep(1.5, 0, c.edge) * .4 + c.groove * .4); },
      ...glossy
    });
    kit.finger = () => relief({
      box: [-1, -hand * .3, hand * 1.15, hand * .3], res: 6, depth: 2.4,
      shape: (g) => { g.beginPath(); g.moveTo(0, -hand * .2); g.quadraticCurveTo(hand * .7, -hand * .26, hand * 1.1, 0); g.quadraticCurveTo(hand * .6, hand * .14, 0, hand * .2); g.closePath(); g.fill(); },
      bumps: Array.from({ length: 7 }, (_, i) => [hand * (.15 + i * .12), hand * (.12 - i * .012), .7, .5]),
      albedo: (x) => { let col = mix(sh, cols.claw, smoothstep(hand * .2, hand * .75, x)); return mix(col, [60, 34, 20], smoothstep(hand * .9, hand * 1.1, x)); },
      ...glossy
    });
    return kit;
  }
  function eggKit() {
    const R = mulberry32(77);
    return relief({
      box: [-38, -21, 38, 21], res: 4, depth: 8, shape: (g) => { g.beginPath(); g.ellipse(0, 0, 36, 19, 0, 0, TAU); g.fill(); },
      bumps: scatter(R, 900, (R) => { const a = R() * TAU, d = Math.sqrt(R()); return [Math.cos(a) * 35 * d, Math.sin(a) * 18 * d, .9 + R() * .4, .9]; }),
      albedo: (x, y, c) => mix([150, 84, 62], [70, 36, 30], smoothstep(.2, 1, Math.hypot(x / 36, y / 19)) * .7 + (c.h < 7.5 ? .25 : 0)),
      spec: .45, shin: 50, amb: .4, env: .1
    });
  }
  const crabKey = (form, pale, robber) => `crab|${robber ? 'robber' : form}|${Math.round(clamp(pale || 0, 0, 1) * 4)}`;
  /* a kit is a recipe of parts; each part is baked on its own (one big part per frame at most), and
     the kit is ready once every part is */
  const resolved = new Map();
  function resolve(key, recipe, names) {
    let r = resolved.get(key); if (r) return r;
    const thunks = get(key + '|recipe', recipe); if (!thunks) return null;
    const out = {};
    for (const n of names) { const v = get(key + '|' + n, thunks[n]); if (!v) return null; out[n] = v; }
    resolved.set(key, out);
    return out;
  }
  const CRAB_PARTS = ['shell', 'merus', 'pro', 'dact', 'stalk', 'eye', 'plate'], CLAW_PARTS = ['hand', 'finger'];
  function kitFor(form, pale, robber) {
    const pq = Math.round(clamp(pale || 0, 0, 1) * 4) / 4;
    return resolve(crabKey(form, pale, robber), () => crabKit(robber ? 'red' : form, pq, robber), CRAB_PARTS);
  }
  function clawsFor(form, pale, robber) {
    const pq = Math.round(clamp(pale || 0, 0, 1) * 4) / 4;
    return resolve(crabKey(form, pale, robber) + '|claw', () => clawKit(robber ? 'red' : form, pq, robber), CLAW_PARTS);
  }
  function crabReady(form, pale, robber) { return resolved.has(crabKey(form, pale, robber)) && resolved.has(crabKey(form, pale, robber) + '|claw'); }
  /* quiet frames (nothing else baked yet) pre-bake the crowd's crabs, so the march doesn't stutter on arrival */
  const WARM = [['red', 0, false], ['orange', 0, false], ['purple', 0, false]];
  function idle() {
    if (budget < 9) return;
    for (const [f, pl, rb] of WARM) if (!kitFor(f, pl, rb) || !clawsFor(f, pl, rb)) return;
    get('eggmass', eggKit);
  }

  function drawClaw(ctx, kit, ck, side, k, up, pinch) {
    const sh = side;
    const ax = 30 * sh, ay = 12, ex = lerp(40 * sh, 52 * sh, up), ey = lerp(26, 2, up), hx = lerp(17 * sh, 44 * sh, up), hy = lerp(32, -18, up);
    const hand = 15 * k, hb = [hx + sh * 8 * k, hy];
    bone(ctx, kit.pro, [ex, ey], hb, SEG, 10 * k / 7);
    bone(ctx, kit.merus, [ax, ay], [ex, ey], SEG, 10 * k / 8.4);
    ctx.save(); ctx.translate(hx, hy);
    ctx.rotate(lerp(sh > 0 ? Math.PI * .92 : Math.PI * .08, -Math.PI / 2 + sh * .25, up));
    ctx.scale(k, k);
    const open = pinch * .55;
    ctx.save(); ctx.translate(15 * .78, 15 * .26); ctx.rotate(open * .3); ctx.scale(1, -1); put(ctx, ck.finger); ctx.restore();
    ctx.save(); ctx.translate(15 * .78, -15 * .28); ctx.rotate(-open); put(ctx, ck.finger); ctx.restore();
    put(ctx, ck.hand);
    ctx.restore();
  }

  function drawCrab(ctx, o) {
    const robber = !!o.robber, form = robber ? 'red' : (FORMS[o.form] ? o.form : 'red');
    const kit = kitFor(form, o.pale || 0, robber), ck = kit && clawsFor(form, o.pale || 0, robber);
    if (!kit || !ck) return Sprites.drawCrab(ctx, o);
    const s = o.s || 1, boy = o.sex !== 'girl';
    const walk = o.walk || 0, tuck = o.tuck || 0, up = o.up || 0, eyes = o.eyes === undefined ? 1 : o.eyes;
    ctx.save(); ctx.scale(s, s);
    if (o.face) ctx.rotate(o.face * .04 * (o.moving ? 1 : 0));
    const reach = robber ? 1.12 : 1, legW = robber ? 8 : 7.6;
    const KNEE = [[50, -6], [68, -22], [86, -32], [100, -37]], TIP = [[54, 42], [88, 43], [118, 40], [146, 31]];
    for (const side of [-1, 1]) for (let k = 3; k >= 0; k--) {
      const hy = 6 - k * 6, hx = side * (40 - k * 1.5);
      const ph = walk + k * 1.7 + (side > 0 ? Math.PI : 0);
      const lift = o.moving ? Math.max(0, Math.sin(ph)) * 9 : 0, swing = o.moving ? Math.cos(ph) * 7 : 0;
      const spread = reach * (1 - tuck * .42);
      const kx = side * KNEE[k][0] * spread + swing * .5, ky = hy + KNEE[k][1] - lift * .5 - tuck * 6;
      const tx = side * TIP[k][0] * spread + swing, ty = TIP[k][1] - lift - tuck * 10;
      const w = (legW - k * .5) / 8.4 * 1.1, m = [lerp(kx, tx, .72), lerp(ky, ty, .72)];
      bone(ctx, kit.dact, m, [tx, ty], SEG, w);
      bone(ctx, kit.pro, [kx, ky], m, SEG, w);
      bone(ctx, kit.merus, [hx, hy], [kx, ky], SEG, w);
    }
    if (o.eggs > 0) {
      const e = o.eggs, eg = get('eggmass', eggKit);
      if (eg) { ctx.save(); ctx.translate(0, 26 + e * 4); ctx.scale((22 + e * 14) / 36, (10 + e * 9) / 19); put(ctx, eg); ctx.restore(); }
    }
    put(ctx, kit.shell);
    if (o.wet > .05) {
      ctx.fillStyle = `rgba(255,255,255,${o.wet * .3})`;
      for (const [x, y, r] of [[-20, -22, 2.2], [14, -25, 1.6], [26, -12, 1.4], [-34, -8, 1.2], [4, -16, 1.1]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * .8, 0, 0, TAU); ctx.fill(); }
    }
    const chew = o.eat ? Math.sin(o.eat * 18) * 2 : 0;
    ctx.save(); ctx.translate(-12, 13 + chew * .3); put(ctx, kit.plate); ctx.restore();
    ctx.save(); ctx.translate(12, 13 - chew * .3); ctx.scale(-1, 1); put(ctx, kit.plate); ctx.restore();
    for (const side of [-1, 1]) {
      const bx = side * 13, by = 12, tx = side * (15 + eyes * 2), ty = lerp(13, -2, eyes);
      if (eyes > .25) bone(ctx, kit.stalk, [bx, by], [tx, ty], SEG, .9);
      ctx.save(); ctx.translate(tx, ty); ctx.scale(.98, .98); put(ctx, kit.eye); ctx.restore();
    }
    if (robber) { ctx.strokeStyle = 'rgba(208,104,42,.95)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 6, 12); ctx.quadraticCurveTo(side * 40, -60, side * 70 + Math.sin(walk * .5) * 4, -54); ctx.stroke(); } }
    const k = robber ? 1.9 : boy ? 1.26 : .9;
    for (const side of [-1, 1]) drawClaw(ctx, kit, ck, side, k, side < 0 ? up : up * .85, o.pinch || 0);
    ctx.restore();
  }
  function drawExuvia(ctx, s, form) {
    ctx.save(); ctx.globalAlpha = .6;
    drawCrab(ctx, { s, form, pale: 1, tuck: .6, eyes: .2, sex: 'girl' });
    ctx.restore();
  }

  /* ============================================================
     THE LARVAE (side-on, facing +x, as in sprites.js)
     ============================================================ */
  /* glass: see-through in the middle, bright at the rim where you look through more of it */
  function zoeaKit(form) {
    const F = FORMS[form] || FORMS.red, chrom = HX(F.shell), R = mulberry32(31 + form.length);
    const N2 = makeNoise2D(9);
    const body = relief({
      box: [-6, -14, 7.5, 10], res: 22, depth: 3.6,
      shape: (g) => {
        g.beginPath(); g.ellipse(0, 0, 4.4, 3.9, -.15, 0, TAU); g.fill();
        g.lineWidth = 1.1; g.beginPath(); g.moveTo(-.2, -3.4); g.quadraticCurveTo(-1.3, -8, -2.8, -12.8); g.stroke();
        g.lineWidth = .8; g.beginPath(); g.moveTo(2.8, 2.4); g.lineTo(5.3, 8.8); g.stroke();
        g.lineWidth = .9; g.beginPath(); g.moveTo(3.4, -1.6); g.lineTo(6.6, -.2); g.stroke();
      },
      albedo: (x, y, c) => mix([255, 238, 216], [236, 196, 160], smoothstep(1, 4, Math.hypot(x, y))),
      alpha: (x, y, c) => clamp(.22 + Math.pow(1 - c.nz, 1.6) * 1.1 + (Math.hypot(x, y) > 4.6 ? .35 : 0), 0, .95),
      spec: .9, shin: 60, env: .5, amb: .7, diff: .4,
      over: (g) => {
        /* inside: the gut, the yolk, star-shaped colour cells */
        g.fillStyle = 'rgba(110,140,60,.5)'; g.beginPath(); g.ellipse(-1, .5, 1.7, 1, .3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(230,150,60,.35)'; g.beginPath(); g.ellipse(.4, -.6, 1.3, 1, 0, 0, TAU); g.fill();
        for (const [x, y, r] of [[-1.6, -1.6, .55], [.4, 1.6, .7], [-2.4, .9, .45], [1.4, -2.4, .4], [-.4, -10.5, .35], [4.2, 6.5, .3]]) {
          g.fillStyle = css(chrom, .85);
          g.beginPath(); g.arc(x, y, r * .45, 0, TAU); g.fill();
          g.strokeStyle = css(chrom, .6); g.lineWidth = .12;
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + R(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .4) * r * .8, y + Math.sin(a + .4) * r * .8, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); g.stroke(); }
        }
        /* the huge compound eye: black, a green-gold sheen, a window of light */
        const eg = g.createRadialGradient(2.3, -1.4, .2, 2.6, -.9, 2.2);
        eg.addColorStop(0, '#2a3036'); eg.addColorStop(.7, '#07080c'); eg.addColorStop(1, '#000');
        g.fillStyle = eg; g.beginPath(); g.arc(2.6, -.9, 2.1, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(150,200,120,.45)'; g.lineWidth = .25; g.beginPath(); g.arc(2.6, -.9, 1.75, -2.4, .3); g.stroke();
        for (let i = 0; i < 40; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 1.9; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.arc(2.6 + Math.cos(a) * d, -.9 + Math.sin(a) * d, .14, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(1.9, -1.8, .6, .4, -.5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(3.4, -.1, .25, 0, TAU); g.fill();
      }
    });
    /* the curled tail: segments to a forked telson, drawn in its own frame from the body (-3, 2.2) */
    const tail = relief({
      box: [-10, -1.5, 1.5, 9.5], res: 22, depth: .8,
      shape: (g) => {
        g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-5, .8, -6.5, 5.3); g.stroke();
        g.lineWidth = .55; g.beginPath(); g.moveTo(-6.5, 5.3); g.lineTo(-8.8, 7.2); g.moveTo(-6.5, 5.3); g.lineTo(-5.6, 8.4); g.stroke();
      },
      albedo: () => [250, 226, 200], alpha: (x, y, c) => clamp(.35 + Math.pow(1 - c.nz, 1.4) * .9, 0, .95),
      spec: .8, shin: 50, env: .4, amb: .7, diff: .4,
      over: (g) => { for (let k = 1; k <= 4; k++) { const t = k / 5, x = lerp(0, -6.5, t), y = lerp(0, 5.3, t * t); g.fillStyle = css(chrom, .55); g.beginPath(); g.arc(x, y, .38, 0, TAU); g.fill(); } }
    });
    return { body, tail };
  }
  function drawZoea(ctx, o) {
    const kit = get('zoea|' + (FORMS[o.form] ? o.form : 'red'), () => zoeaKit(o.form));
    if (!kit) return Sprites.drawZoea(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, inst = o.instar || 1, beat = Math.sin(ph);
    ctx.save(); ctx.scale(s, s);
    /* the feathery swimming legs, beating */
    ctx.lineCap = 'round';
    for (const k of [0, 1]) {
      const a = .6 + beat * .55 + k * .35, L = 6.5 + inst * .4, x0 = .6 - k * 1.2, y0 = 3.4, x1 = x0 + Math.cos(a) * L * -.3, y1 = y0 + Math.sin(a) * L;
      ctx.strokeStyle = 'rgba(255,240,222,.55)'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,244,230,.4)'; ctx.lineWidth = .18;
      for (let j = 1; j <= 6; j++) { const t = j / 7, px = lerp(x0, x1, t), py = lerp(y0, y1, t); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 1.8, py + .7); ctx.moveTo(px, py); ctx.lineTo(px + 1.6, py + .9); ctx.stroke(); }
    }
    ctx.save(); ctx.translate(-3, 2.2); ctx.rotate(beat * .08); put(ctx, kit.tail); ctx.restore();
    put(ctx, kit.body);
    ctx.restore();
  }
  function megaKit(form) {
    const F = FORMS[form] || FORMS.red, sc = HX(F.shell), pale = mix(sc, [255, 230, 210], .45), R = mulberry32(41 + form.length);
    const deep = mix(sc, [70, 20, 30], .45);
    const body = relief({
      box: [-4, -5.5, 11.5, 6.5], res: 20, depth: 2.6,
      shape: (g) => {
        g.beginPath(); g.ellipse(2, 0, 5.2, 3.6, 0, 0, TAU); g.fill();
        g.lineWidth = .7; for (let k = 0; k < 4; k++) { const x = 3.4 - k * 1.7; g.beginPath(); g.moveTo(x, 2.6); g.lineTo(x - 1, 5); g.lineTo(x - 2.6, 5.6); g.stroke(); }
        g.lineWidth = .8; g.beginPath(); g.moveTo(5.2, 1.6); g.lineTo(7.6, 2.8); g.stroke();
        g.beginPath(); g.ellipse(8.4, 2.9, 1.5, .85, .2, 0, TAU); g.fill();
        g.lineWidth = .45; g.beginPath(); g.moveTo(9.4, 2.4); g.lineTo(10.7, 2.1); g.moveTo(9.4, 3.4); g.lineTo(10.5, 3.7); g.stroke();
        g.lineWidth = .9; g.beginPath(); g.moveTo(6, -1.6); g.lineTo(7.4, -2.8); g.stroke();
      },
      bumps: scatter(R, 60, (R) => [2 + (R() - .5) * 9, (R() - .5) * 6, .25 + R() * .3, .12]),
      albedo: (x, y, c) => { let col = mix(mix(pale, [255, 255, 255], .25), sc, smoothstep(-2, 3, y) * .55 + smoothstep(2, 6, Math.abs(x - 2)) * .3); return mix(col, deep, smoothstep(.8, 0, c.edge) * .5); },
      alpha: (x, y, c) => clamp(.62 + Math.pow(1 - c.nz, 1.5) * .6, 0, 1),
      spec: .7, shin: 60, env: .3, amb: .5, sss: [.06, .02, .01],
      over: (g) => {
        g.fillStyle = css(sc, .55); for (const [x, y] of [[0, -1.4], [2.6, .6], [3.6, -1.8], [-.6, 1.2], [4.6, .2]]) { g.beginPath(); g.arc(x, y, .5, 0, TAU); g.fill(); }
        const eg = g.createRadialGradient(7.3, -3.3, .1, 7.6, -3, 1.4); eg.addColorStop(0, '#30343a'); eg.addColorStop(1, '#040406');
        g.fillStyle = eg; g.beginPath(); g.arc(7.6, -3, 1.35, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(7.15, -3.45, .38, .26, -.4, 0, TAU); g.fill();
      }
    });
    const abdo = relief({
      box: [-13.5, -1.2, -1.8, 3.2], res: 20, depth: 1.2,
      shape: (g) => { for (let k = 0; k < 5; k++) { const x = -3.5 - k * 2, y = 1 + k * .3; g.beginPath(); g.ellipse(x, y, 1.45, 1.55 - k * .1, 0, 0, TAU); g.fill(); } },
      albedo: (x, y, c) => mix(pale, deep, smoothstep(.5, 0, c.edge) * .5), alpha: (x, y, c) => clamp(.55 + Math.pow(1 - c.nz, 1.4) * .6, 0, 1),
      spec: .6, shin: 50, env: .3, amb: .5
    });
    const fan = relief({
      box: [-3.6, -3.2, .6, 3.2], res: 20, depth: .5,
      shape: (g) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(-3.2, -2.8); g.quadraticCurveTo(-3.6, 0, -3.2, 2.8); g.closePath(); g.fill(); },
      albedo: () => mix(pale, [255, 255, 255], .2), alpha: () => .7, spec: .5, shin: 40, amb: .6,
      over: (g) => { g.strokeStyle = css(deep, .4); g.lineWidth = .12; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(-3.3, k * 1.2); g.stroke(); } }
    });
    return { body, abdo, fan, pale };
  }
  function drawMegalopa(ctx, o) {
    const kit = get('mega|' + (FORMS[o.form] ? o.form : 'red'), () => megaKit(o.form));
    if (!kit) return Sprites.drawMegalopa(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, beat = Math.sin(ph);
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = 'rgba(255,236,214,.6)'; ctx.lineWidth = .35; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const x = -4 - k * 2, a = Math.sin(ph + k * .8) * .6; ctx.beginPath(); ctx.moveTo(x, 2.4); ctx.quadraticCurveTo(x + Math.sin(a) * 1, 4, x + Math.sin(a) * 2, 5.8); ctx.stroke(); }
    ctx.save(); ctx.translate(-12.4, 2.2); ctx.rotate(beat * .12); put(ctx, kit.fan); ctx.restore();
    put(ctx, kit.abdo);
    put(ctx, kit.body);
    ctx.restore();
  }
  function drawEgg(ctx, o = {}) {
    const e = get('egg', () => relief({
      box: [-1.15, -1.15, 1.15, 1.15], res: 40, depth: 1, shape: (g) => { g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); },
      albedo: (x, y) => mix([120, 76, 72], [40, 20, 24], smoothstep(0, 1, Math.hypot(x + .3, y + .3))), spec: .9, shin: 60, env: .3, amb: .45
    }));
    if (!e) return Sprites.drawEgg(ctx, o);
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s); put(ctx, e);
    if (o.eye) { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.arc(.3, -.1, .22, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ============================================================
     THE RAINFOREST: trunks (a buttressed base + a bark tile that
     repeats up the trunk), leaf crowns, the canopy wall's tile,
     palms and pandanus on the terrace, ferns, the leaf litter
     ============================================================ */
  const BARK = { tall: [[196, 190, 172], [120, 114, 100], [80, 74, 64]], chestnut: [[150, 124, 96], [96, 76, 56], [62, 46, 32]], fig: [[160, 160, 128], [104, 104, 80], [68, 70, 52]] };
  const TILE_H = 128;
  function barkTile(kind, w, v) {
    const B = BARK[kind] || BARK.tall, N = fbmN(300 + v * 17 + kind.length), R = mulberry32(400 + v);
    const half = w / 2;
    return relief({
      box: [-half, 0, half, TILE_H], res: 3, depth: half, rows: true, relief: 1.2,
      shape: (g) => g.fillRect(-half, 0, w, TILE_H),
      /* vertical fissures and plates; the noise repeats every 128 units up the trunk */
      noise: (x, y) => { const f = N(x * .45 + 3, y * .5); return Math.abs(f - .5) * 2.2 + N(x * 1.6, y * 2) * .5 + (kind === 'fig' ? Math.max(0, Math.sin(x * .55 + Math.sin(y / TILE_H * TAU * 2) * 2.4) - .6) * 6 : 0); },
      albedo: (x, y, c) => {
        let col = mix(B[0], B[1], N(x * .3 + 11, y * .25) * .9);
        const lichen = smoothstep(.55, .8, N(x * .2 + 40, y * .125));
        col = mix(col, [214, 216, 196], lichen * .55);
        const moss = smoothstep(.55, .75, N(x * .18 + 70, y * .0625)) * smoothstep(half * .2, -half, x);
        col = mix(col, [72, 110, 52], moss * .75);
        return mix(col, B[2], smoothstep(.9, .3, c.h / half) * .3);
      },
      light: [-.6, -.3, .74], amb: .38, diff: .8, spec: .05, shin: 12
    });
  }
  function buttress(kind, w, v) {
    const B = BARK[kind] || BARK.tall, N = fbmN(500 + v * 13 + kind.length), R = mulberry32(600 + v + w);
    const fl = kind === 'chestnut' ? 1.4 : 1, reach = w * .5 + 66 * fl, top = -150;
    const fins = [];
    for (const s of [-1, 1]) for (const k of [1, .62, .34]) fins.push([s, k * (.8 + R() * .4)]);
    return relief({
      box: [-reach - 6, top, reach + 6, 10], res: 1.6, depth: 9, relief: 1,
      shape: (g) => {
        g.fillRect(-w * .45, top, w * .9, 16 - top);
        for (const [s, k] of fins) {
          g.beginPath(); g.moveTo(s * w * .25, -110 * k * fl); g.quadraticCurveTo(s * w * .5, -16 * k, s * (w * .5 + 64 * k * fl), 6);
          g.lineTo(s * w * .15, 8); g.closePath(); g.fill();
        }
      },
      dome: (x) => Math.max(0, 1 - (x * x) / (w * w * .25)) * w * .3,
      noise: (x, y) => Math.abs(N(x * .45 + 3, y * .5) - .5) * 2 + N(x * 1.6, y * 2) * .4,
      albedo: (x, y, c) => {
        let col = mix(B[0], B[1], N(x * .3 + 11, y * .25) * .9);
        col = mix(col, [214, 216, 196], smoothstep(.64, .74, N(x * .2 + 40, y * .125)) * .5);
        col = mix(col, [70, 104, 48], smoothstep(-30, 4, y) * .35 + smoothstep(.6, .8, N(x * .1, y * .1)) * .4);
        return mix(col, B[2], smoothstep(3, 0, c.edge) * .35);
      },
      light: [-.6, -.3, .74], amb: .38, diff: .8, spec: .05, shin: 12,
      over: (g) => {
        /* fade the top into the bark tile above */
        const fg = g.createLinearGradient(0, top, 0, top + 45); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
        g.globalCompositeOperation = 'destination-in'; g.fillStyle = fg; g.fillRect(-reach - 6, top, reach * 2 + 12, 170);
        /* the dark gaps between the fins where they meet the ground */
        const gg = g.createLinearGradient(0, -20, 0, 8); gg.addColorStop(0, 'rgba(20,12,6,0)'); gg.addColorStop(1, 'rgba(20,12,6,.55)');
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = gg; g.fillRect(-reach, -20, reach * 2, 30);
      }
    });
  }
  /* the trunk of a rainforest giant: false = not ready (draw it the classic way) */
  function drawTrunk(ctx, T, g, time) {
    const h = T.kind === 'tall' ? 1050 : T.kind === 'chestnut' ? 820 : 900, wq = Math.max(24, Math.round(T.w / 8) * 8), v = (T.seed >>> 4) % 2, kind = T.kind;
    const tile = get(`bark|${kind}|${wq}|${v}`, () => barkTile(kind, wq * .82, v));
    const base = tile && get(`butt|${kind}|${wq}|${v}`, () => buttress(kind, wq, v));
    if (!tile || !base) return false;
    ctx.save(); ctx.translate(T.x, g);
    ctx.transform(1, 0, -T.lean, 1, 0, 0);
    if ((T.seed >>> 2) & 1) ctx.scale(-1, 1);
    for (let y = -60; y > -h; y -= TILE_H - .5) ctx.drawImage(tile.c, tile.x0, y - TILE_H, tile.w, TILE_H + .5);
    put(ctx, base);
    /* a liana hanging from the canopy */
    const vx = wq * .25, sw = Math.sin(time * .7 + T.seed) * 8;
    ctx.strokeStyle = 'rgba(52,78,34,.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(vx, -h + 80); ctx.quadraticCurveTo(vx + 30 + sw, -400, vx + 20 + sw * 1.5, -140); ctx.stroke();
    ctx.strokeStyle = 'rgba(130,170,90,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vx - 1, -h + 80); ctx.quadraticCurveTo(vx + 29 + sw, -400, vx + 19 + sw * 1.5, -140); ctx.stroke();
    ctx.restore();
    return true;
  }
  /* a crown of leaves: a lumpy volume of leaf-sized bumps, each leaf with its own green */
  const CROWN = { rain: [[42, 104, 58], [58, 138, 70], [74, 160, 82], [47, 122, 62], [90, 176, 96]], fig: [[47, 106, 42], [63, 138, 54], [79, 154, 62], [90, 168, 72], [42, 90, 40]] };
  function crown(r, v, tint) {
    const R = mulberry32(900 + v * 31 + r), N = fbmN(700 + v), cols = CROWN[tint] || CROWN.rain, leaves = [];
    for (let k = 0; k < 420; k++) { const a = R() * TAU, d = Math.pow(R(), .7) * r, x = Math.cos(a) * d, y = Math.sin(a) * d * .75; leaves.push([x, y, R() * TAU, r * .1 + R() * r * .14, (R() * cols.length) | 0]); }
    const s = r * 1.3;
    const part = relief({
      box: [-s, -s, s, s], res: r > 120 ? .8 : r > 80 ? 1 : 1.4, depth: r * .45, relief: .8,
      shape: (g) => { g.beginPath(); g.ellipse(0, 0, r * .72, r * .52, 0, 0, TAU); g.fill(); for (const [x, y, a, L] of leaves) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .3, -L * .3, L * .8, -L * .2, L, 0); g.bezierCurveTo(L * .8, L * .2, L * .3, L * .3, 0, 0); g.fill(); g.restore(); } },
      bumps: leaves.map(([x, y, a, L]) => [x + Math.cos(a) * L * .5, y + Math.sin(a) * L * .5, L * .5, L * .22]),
      albedo: (x, y, c) => { const k = N(x * .15, y * .15) * cols.length, c0 = cols[Math.min(cols.length - 1, k | 0)]; return mix(c0, [20, 40, 20], smoothstep(r * .2, -r * .1, c.h - r * .3) * .5); },
      light: [-.45, -.7, .55], amb: .34, diff: .85, spec: .18, shin: 24, wrap: .4, sss: [.02, .05, .01]
    });
    part.c.uw = s * 2; part.c.uh = s * 2;
    return part.c;
  }
  /* a crown image the same size (in units) as render.js's classic clump */
  function clump(r, seed, tint) {
    const rq = r < 55 ? 45 : r < 80 ? 70 : r < 115 ? 100 : 140, v = seed % 4;
    return get(`crown|${rq}|${v}|${tint}`, () => crown(rq, v, tint));
  }
  /* the canopy wall's tile, made of painted crowns once they exist */
  let canopy = null;
  function canopyTile() {
    if (canopy) return canopy;
    for (const rq of [45, 70, 100]) for (let v = 0; v < 2; v++) for (const t of ['rain', 'fig']) if (!clump(rq, v, t)) return null;
    if (!canBake()) return null;
    const t0 = performance.now();
    const [c, g] = newCanvas(1024, 640), R = mulberry32(55);
    const grad = g.createLinearGradient(0, 0, 0, 640); grad.addColorStop(0, '#0e2616'); grad.addColorStop(.7, '#183e24'); grad.addColorStop(1, '#22502e');
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 640);
    for (let i = 0; i < 90; i++) {
      const r = 40 + R() * 70, img = clump(r, ((R() * 997) | 0) % 2, R() < .5 ? 'fig' : 'rain'), x = R() * 1024, y = R() * 600, k = .55 + R() * .45;
      g.globalAlpha = .5 + R() * .5; g.filter = `brightness(${(.45 + y / 640 * .5) * k})`;
      for (const dx of [-1024, 0, 1024]) g.drawImage(img, x + dx - img.uw / 2, y - img.uh / 2, img.uw, img.uh);
    }
    g.filter = 'none'; g.globalAlpha = 1;
    /* sky through the gaps, and flecks of sun */
    for (let i = 0; i < 120; i++) { const x = R() * 1024, y = R() * 360, rr2 = 1 + R() * 4; g.fillStyle = `rgba(230,250,220,${.2 + R() * .35})`; g.beginPath(); g.ellipse(x, y, rr2 * 1.6, rr2, R(), 0, TAU); g.fill(); }
    canopy = c; stat.n++; spent(t0);
    return canopy;
  }

  /* --- coconut palms and pandanus on the terrace --- */
  function palmParts(kind) {
    const R = mulberry32(kind === 'palm' ? 61 : 62), palm = kind === 'palm';
    const seg = relief({
      box: [-7, -1, 7, 21], res: 3, depth: 6, rows: true,
      shape: (g) => g.fillRect(-6, 0, 12, 20),
      noise: (x, y) => (palm ? Math.pow(Math.abs(Math.sin(y / 20 * Math.PI * 3)), 6) * -1.2 : 0) + Math.random() * .15,
      albedo: (x, y) => palm ? mix([150, 136, 108], [110, 96, 74], (Math.sin(y / 20 * Math.PI * 3) + 1) * .4) : mix([120, 104, 74], [92, 80, 56], (Math.sin(y * .9) + 1) * .3),
      light: [-.6, -.3, .74], amb: .4, spec: .05, shin: 10
    });
    let frond;
    if (palm) {
      frond = bake2d([-2, -30, 100, 46], 3, (g) => {
        const P = (t) => [2 * (1 - t) * t * 50 + t * t * 92, 2 * (1 - t) * t * -18 + t * t * 20];
        g.strokeStyle = '#7a7a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); for (let k = 1; k <= 24; k++) g.lineTo(...P(k / 24)); g.stroke();
        for (let k = 3; k < 46; k++) {
          const t = k / 46; if (R() < .14) continue;                                   /* gaps where leaflets split apart */
          const [x, y] = P(t), [x2, y2] = P(t + .01), a = Math.atan2(y2 - y, x2 - x);
          const L = (24 * Math.sin(Math.min(1, t * 1.5) * Math.PI * .8) + 5) * (.85 + R() * .3);
          const col = mix(mix([58, 96, 40], [104, 152, 58], Math.sin(t * Math.PI)), [196, 184, 96], Math.max(0, t - .8) * 1.6 + R() * .08);
          for (const sd of [-1, 1]) {
            const ang = a + sd * (.9 + R() * .25), droop = (sd > 0 ? .9 : .6) + R() * .4;
            /* a leaflet: a tapering blade that curves down under its own weight */
            const ex = Math.cos(ang) * L, ey = Math.sin(ang) * L + droop * L * .45, mx = Math.cos(ang) * L * .5, my = Math.sin(ang) * L * .5 - L * .05;
            const w0 = 1.3, nx = -Math.sin(ang) * w0, ny = Math.cos(ang) * w0;
            g.fillStyle = css(sd > 0 ? mix(col, [20, 40, 16], .25) : col);
            g.beginPath(); g.moveTo(x + nx, y + ny); g.quadraticCurveTo(x + mx + nx * .7, y + my + ny * .7, x + ex, y + ey); g.quadraticCurveTo(x + mx - nx * .7, y + my - ny * .7, x - nx, y - ny); g.fill();
            g.strokeStyle = 'rgba(220,240,170,.3)'; g.lineWidth = .25; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + mx, y + my, x + ex, y + ey); g.stroke();
          }
        }
      });
    } else {
      frond = relief({
        box: [-2, -10, 66, 10], res: 3, depth: 1.6, relief: 1.4,
        shape: (g) => { g.beginPath(); g.moveTo(0, -2.4); g.quadraticCurveTo(30, -13, 62, 6); g.quadraticCurveTo(30, 0, 0, 2.4); g.fill(); },
        grooves: [[[[2, 0], [30, -6], [60, 5]], .8, .6]],
        albedo: (x, y, c) => mix([66, 112, 46], [104, 140, 56], smoothstep(-8, 4, y) + c.groove * .3),
        light: [-.4, -.7, .6], amb: .4, spec: .3, shin: 30
      });
    }
    const fruit = relief({
      box: palm ? [-6, -6, 6, 6] : [-10, -13, 10, 13], res: 4, depth: palm ? 5 : 8,
      shape: (g) => { g.beginPath(); if (palm) g.arc(0, 0, 5.2, 0, TAU); else g.ellipse(0, 0, 9, 12, 0, 0, TAU); g.fill(); },
      bumps: palm ? null : scatter(R, 60, (R) => [(R() - .5) * 16, (R() - .5) * 22, 2.2, 1.2]),
      albedo: (x, y, c) => palm ? mix([120, 120, 50], [80, 70, 30], smoothstep(-4, 4, x + y)) : mix([238, 150, 40], [200, 90, 20], smoothstep(-6, 10, y)),
      spec: .3, shin: 30, amb: .4
    });
    return { seg, frond, fruit };
  }
  function drawPalm(ctx, T, g, time, wind) {
    const kit = get('palm|' + T.kind, () => palmParts(T.kind));
    if (!kit) return false;
    const palm = T.kind === 'palm', h = palm ? 230 : 120, lean = T.lean, topX = T.x + Math.sin(lean) * h, topY = g - h;
    if (!palm) { ctx.strokeStyle = '#6e5e40'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(T.x + k * 3, g - 30); ctx.quadraticCurveTo(T.x + k * 6, g - 10, T.x + k * 9, g + 2); ctx.stroke(); } }
    /* the trunk: segments along the curve */
    const P = (t) => { const u = 1 - t; return [u * u * T.x + 2 * u * t * (T.x + Math.sin(lean) * h * .2) + t * t * topX, u * u * (g + 4) + 2 * u * t * (g - h * .6) + t * t * topY]; };
    const n = Math.ceil(h / 16);
    for (let k = 0; k < n; k++) bone(ctx, kit.seg, P(k / n), P((k + 1) / n), 20, T.w / 12);
    const nf = palm ? 11 : 14;
    for (let k = 0; k < nf; k++) {
      const a = (k / nf) * TAU + Math.sin(time * .6 + k) * (.05 + wind * .08);
      ctx.save(); ctx.translate(topX, topY); ctx.rotate(a); if (Math.cos(a) < 0) { ctx.scale(1, -1); } put(ctx, kit.frond); ctx.restore();
    }
    if (palm) for (const [dx, dy] of [[-6, 6], [4, 8], [0, 12]]) { ctx.save(); ctx.translate(topX + dx, topY + dy); put(ctx, kit.fruit); ctx.restore(); }
    else { ctx.save(); ctx.translate(topX + 6, topY + 14); put(ctx, kit.fruit); ctx.restore(); }
    return true;
  }
  /* --- a sapling's crown or palm in the understory: render.js asks for crowns via clump() --- */
  function fernPart(kind, v) {
    const R = mulberry32(1300 + v + (kind === 'fern' ? 0 : 50));
    if (kind === 'fern') {
      /* arching fronds of many small leaflets: short at the base and the tip, darker near the ground */
      return bake2d([-62, -70, 62, 6], 3, (g) => {
        const fronds = [];
        for (let k = 0; k < 7; k++) { const side = (k - 3) / 3; fronds.push([side, 46 + R() * 22, R()]); }
        fronds.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]));                       /* the outer, lower fronds first */
        for (const [side, L, rnd] of fronds) {
          const ex = side * L * .95, ey = -L * (.55 - Math.abs(side) * .45) + 6, cx = side * L * .25, cy = -L * (1.05 - Math.abs(side) * .3);
          const P = (t) => [2 * (1 - t) * t * cx + t * t * ex, 2 * (1 - t) * t * cy + t * t * ey];
          const base = mix([40, 84, 34], [58, 112, 44], rnd), tip = mix([96, 150, 60], [124, 170, 74], rnd);
          g.strokeStyle = css(mix(base, [60, 50, 24], .4)); g.lineWidth = .7; g.beginPath(); g.moveTo(0, 0); for (let k = 1; k <= 20; k++) g.lineTo(...P(k / 20)); g.stroke();
          for (let k = 2; k < 40; k++) {
            const t = k / 40; if (R() < .05) continue;
            const [x, y] = P(t), [x2, y2] = P(t + .01), a = Math.atan2(y2 - y, x2 - x), len = 9 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), .7) + 1.2;
            for (const sd of [-1, 1]) {
              g.save(); g.translate(x, y); g.rotate(a + sd * (1.05 - t * .3) + (R() - .5) * .15);
              thinLeaf(g, len * (.85 + R() * .3), .24, mix(mix(base, tip, t), [255, 255, 200], (R() - .5) * .08), R, { glow: R() < .4 });
              g.restore();
            }
          }
        }
      });
    }
    /* a broad-leaved seedling: a thin stem and a few leaves at different heights, sizes and tilts */
    return bake2d([-52, -66, 52, 4], 3, (g) => {
      const n = 4 + (v % 2), top = 22 + R() * 18;
      g.strokeStyle = 'rgba(70,96,46,1)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(2, -top * .5, (R() - .5) * 4, -top); g.stroke();
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), sd = k % 2 ? 1 : -1, hy = -2 - t * top, L = 18 + R() * 16 - t * 4, tilt = sd * (.25 + R() * .55);
        const col = mix(mix([40, 98, 42], [76, 136, 58], R()), [120, 170, 80], t * .2);
        g.save(); g.translate(sd * 1, hy);
        if (sd < 0) g.scale(-1, 1);
        g.rotate(-tilt * sd - .1 + R() * .3);
        g.scale(1, .55 + R() * .45);                                                /* some seen more edge-on than others */
        g.strokeStyle = 'rgba(70,96,46,1)'; g.lineWidth = .8; g.beginPath(); g.moveTo(0, 0); g.lineTo(4, 0); g.stroke();
        g.translate(4, 0); thinLeaf(g, L, .3 + R() * .08, col, R);
        g.restore();
      }
    });
  }
  function drawFern(ctx, f, sway) {
    const v = (f.ph * 10 | 0) % 3, part = get(`fern|${f.kind}|${v}`, () => fernPart(f.kind, v));
    if (!part) return false;
    ctx.transform(1, 0, sway, 1, 0, 0);
    put(ctx, part);
    return true;
  }
  /* a fallen leaf, seen lying on the floor */
  const LITTER = ['#7a4a24', '#9a5a2a', '#a8742e', '#5a3a1a', '#b8903a', '#6a5a2a', '#c8a050'];
  function litterLeaf(col) {
    const c0 = HX(col), R = mulberry32(col.length + c0[0]);
    return relief({
      box: [-6, -2.6, 6, 2.6], res: 8, depth: .6, relief: 2,
      shape: (g) => { g.beginPath(); g.moveTo(-5.6, 0); g.bezierCurveTo(-3, -2.6, 3, -2.4, 5.6, 0); g.bezierCurveTo(3, 2.4, -3, 2.6, -5.6, 0); g.fill(); },
      grooves: [[[[-5, 0], [5, 0]], .25, .3]],
      noise: (x, y) => Math.sin(x * 3) * .05,
      albedo: (x, y, c) => mix(c0, [40, 22, 10], c.groove * .5 + smoothstep(.6, 0, c.edge) * .3),
      light: [-.4, -.7, .6], amb: .45, spec: .15, shin: 20
    });
  }
  function drawLitter(ctx, l, y) {
    const part = get('litter|' + l.col, () => litterLeaf(l.col));
    if (!part) return false;
    ctx.save(); ctx.translate(l.x, y + .4); ctx.rotate(l.a * .3); ctx.scale(.75 * l.s, .55 * l.s); put(ctx, part); ctx.restore();
    return true;
  }

  /* ============================================================
     ROCKS AND LOGS: weathered limestone boulders, fallen trunks
     ============================================================ */
  function boulder(w, v) {
    const R = mulberry32(1700 + v * 7 + w), N = fbmN(1800 + v), base = 2, top = -24;
    const pts = []; for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI, r = 1 + (R() - .5) * .14; pts.push([Math.cos(a) * w * .56 * r, base - 6 + Math.sin(a) * (base - top - 6) * r]); }
    return relief({
      box: [-w * .65, top - 6, w * .65, base + 2], res: 3, depth: 10, relief: 1.1,
      shape: (g) => { g.beginPath(); g.moveTo(-w * .58, base); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w * .58, base); g.closePath(); g.fill(); },
      noise: (x, y) => N(x * .15, y * .15) * 3 + N(x * .6, y * .6) * .8 - Math.pow(Math.max(0, N(x * .9 + 9, y * .9) - .62), 1) * 6,
      bumps: scatter(R, 30, (R) => [(R() - .5) * w, top + R() * 24, .8 + R() * 2, -.8 - R()]),
      albedo: (x, y, c) => {
        let col = mix([226, 220, 204], [168, 160, 144], N(x * .1 + 5, y * .1) * .9);
        col = mix(col, [96, 90, 80], smoothstep(.5, .9, N(x * .5, y * .05)) * .35);                 /* rain streaks */
        col = mix(col, [104, 130, 70], smoothstep(-6, -16, y) * smoothstep(.45, .65, N(x * .2 + 30, y * .2)) * .8);   /* moss on top */
        return mix(col, [70, 62, 52], smoothstep(-6, 2, y) * .45);
      },
      light: [-.5, -.7, .5], amb: .42, spec: .08, shin: 16
    });
  }
  function drawRock(ctx, sh) {
    const wq = Math.round(sh.w / 6) * 6, v = (Math.abs(sh.x * 13) | 0) % 3, part = get(`rock|${wq}|${v}`, () => boulder(wq, v));
    if (!part) return false;
    const y = sh.y, w = sh.w, base = y + 2;
    ctx.save(); ctx.translate(sh.x, y); ctx.scale(w / wq, 1); put(ctx, part); ctx.restore();
    const hg = ctx.createRadialGradient(sh.x + w * .05, base, 1, sh.x + w * .05, base, w * .4);
    hg.addColorStop(0, 'rgba(14,10,6,.88)'); hg.addColorStop(1, 'rgba(14,10,6,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x + w * .05, base, w * .4, 8, 0, Math.PI, TAU); ctx.fill();
    return true;
  }
  function logPart(w, v) {
    const N = fbmN(1900 + v), R = mulberry32(2000 + v);
    return relief({
      box: [-w / 2 - 2, -22, w / 2 + 5, 0], res: 2.4, depth: 8, relief: 1,
      shape: (g) => { g.beginPath(); g.roundRect(-w / 2, -20, w, 16, 8); g.fill(); },
      noise: (x, y) => Math.abs(N(x * .08, y * .6) - .5) * 2.2,
      bumps: scatter(R, 5, (R) => [(R() - .5) * w * .8, -6 - R() * 4, 3 + R() * 2, 1.5]),
      albedo: (x, y, c) => {
        let col = mix([122, 92, 62], [70, 52, 34], N(x * .05 + 3, y * .3));
        col = mix(col, [86, 126, 56], smoothstep(-12, -19, y) * smoothstep(.4, .6, N(x * .06 + 20, 1)) * .9);
        return mix(col, [40, 28, 18], smoothstep(-8, -4, y) * .4);
      },
      light: [-.5, -.7, .5], amb: .4, spec: .06, shin: 12,
      over: (g) => {
        /* the cut end: rings */
        const ex = w / 2;
        g.fillStyle = '#b08a5c'; g.beginPath(); g.ellipse(ex, -12, 4, 8, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = .35; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(ex, -12, 4 * k / 4, 8 * k / 4, 0, 0, TAU); g.stroke(); }
        /* bracket fungi */
        for (let k = 0; k < 3; k++) { const x = (R() - .4) * w * .7; g.fillStyle = '#e8d8b0'; g.beginPath(); g.ellipse(x, -4, 3.4, 1.4, 0, Math.PI, TAU); g.fill(); g.fillStyle = 'rgba(120,90,50,.6)'; g.fillRect(x - 3.4, -4, 6.8, .5); }
      }
    });
  }
  function drawLog(ctx, sh) {
    const wq = Math.round(sh.w / 10) * 10, v = (Math.abs(sh.x) | 0) % 2, part = get(`log|${wq}|${v}`, () => logPart(wq, v));
    if (!part) return false;
    ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sh.w / wq, 1); put(ctx, part); ctx.restore();
    return true;
  }

  /* ============================================================
     THE REEF: brain and table corals, sea fans
     ============================================================ */
  function coralPart(kind, col) {
    const c0 = HX(col), N = makeNoise2D(2100 + col.length + c0[1]), R = mulberry32(2200 + c0[0]);
    if (kind === 'brain') return relief({
      box: [-13, -11, 13, 1], res: 6, depth: 6, relief: 1.2,
      shape: (g) => { g.beginPath(); g.ellipse(0, 0, 12, 10, 0, Math.PI, TAU); g.closePath(); g.fill(); },
      /* the meandering ridges and valleys */
      noise: (x, y) => { const m = Math.sin(N(x * .5, y * .5) * 26); return (1 - Math.abs(m)) * .7; },
      albedo: (x, y, c) => { const m = Math.abs(Math.sin(N(x * .5, y * .5) * 26)); return mix(mix(c0, [255, 240, 210], .25), mix(c0, [70, 50, 40], .55), smoothstep(.2, .9, m)); },
      light: [-.4, -.7, .6], amb: .42, spec: .12, shin: 20
    });
    if (kind === 'table') return relief({
      box: [-17, -14, 17, 1], res: 5, depth: 1.6, relief: 1.3,
      shape: (g) => { g.fillRect(-1.6, -10, 3.2, 10); g.beginPath(); g.ellipse(0, -10.5, 16, 3.2, 0, 0, TAU); g.fill(); },
      bumps: scatter(R, 120, (R) => [(R() - .5) * 30, -10.5 + (R() - .5) * 5, .5 + R() * .4, .4]),
      albedo: (x, y) => mix(mix(c0, [255, 236, 210], .3), mix(c0, [60, 40, 30], .5), smoothstep(-11, -8, y)),
      light: [-.4, -.7, .6], amb: .42, spec: .12, shin: 20
    });
    /* a sea fan: a flat net of branches with polyps along them */
    const segs = [];
    const branch = (x, y, a, L, d) => { if (d > 5) return; const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; segs.push([x, y, ex, ey, 1.6 - d * .22]); branch(ex, ey, a - .42 + (R() - .5) * .2, L * .74, d + 1); branch(ex, ey, a + .42 + (R() - .5) * .2, L * .74, d + 1); };
    branch(0, 0, -Math.PI / 2, 12, 0);
    return relief({
      box: [-32, -46, 32, 2], res: 4, depth: .7, relief: 2,
      shape: (g) => { for (const [x0, y0, x1, y1, w] of segs) { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } },
      bumps: segs.flatMap(([x0, y0, x1, y1]) => [[lerp(x0, x1, .3), lerp(y0, y1, .3), .7, .35], [lerp(x0, x1, .75), lerp(y0, y1, .75), .7, .35]]),
      albedo: () => c0, light: [-.4, -.7, .6], amb: .5, spec: .2, shin: 20
    });
  }
  function drawCoral(ctx, kind, col) {
    const part = get(`coral|${kind}|${col}`, () => coralPart(kind, col));
    if (!part) return false;
    put(ctx, part);
    return true;
  }

  /* ============================================================
     THE CROSS-SECTION'S DETAIL: four seamless tiles (reef rubble,
     sand, limestone, red soil), laid source-atop over the cell
     layer, each over its own stretch of the island
     ============================================================ */
  const tiles = {};
  function detailTile(kind) {
    const TW = 360, TH = 240, K = 2, R = mulberry32(2300 + kind.length * 7);
    const [c, g] = newCanvas(TW * K, TH * K, true); g.scale(K, K); g.lineCap = 'round';
    const wrap = (fn) => { for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    const pebble = (x, y, r, e, rot, tone, warm, a = .85) => wrap(() => {
      g.fillStyle = 'rgba(10,6,2,.32)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .35, r, r * e, rot, 0, TAU); g.fill();
      const pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1);
      pg.addColorStop(0, `rgba(${tone + 60 + warm},${tone + 50},${tone + 36},${a})`); pg.addColorStop(1, `rgba(${tone * .5 + warm},${tone * .45},${tone * .4},${a})`);
      g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill();
    });
    const specks = (n, dark, light) => { for (let i = 0; i < n; i++) { const x = R() * TW, y = R() * TH, r = .25 + R() * .6, lt = R() < .5; wrap(() => { g.fillStyle = lt ? light : dark; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); } };
    if (kind === 'sand') {
      for (let i = 0; i < 8; i++) { const y = R() * TH, h = 2 + R() * 4, a = .04 + R() * .05; wrap(() => { g.fillStyle = `rgba(90,60,20,${a})`; g.fillRect(0, y, TW, h); }); }
      specks(2600, 'rgba(60,40,20,.3)', 'rgba(255,250,235,.35)');
      for (let i = 0; i < 40; i++) { const x = R() * TW, y = R() * TH; wrap(() => { g.fillStyle = 'rgba(255,245,230,.55)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 1.6 + R(), Math.PI, TAU); g.fill(); g.strokeStyle = 'rgba(120,90,60,.3)'; g.lineWidth = .3; g.stroke(); }); }   /* shell bits */
      for (let i = 0; i < 26; i++) pebble(R() * TW, R() * TH, 1 + R() * 2.4, .6 + R() * .3, R(), 150 + R() * 60, 10);
    } else if (kind === 'soil') {
      for (let i = 0; i < 150; i++) { const x = R() * TW, y = R() * TH, r = 3 + R() * 7, a = .06 + R() * .1; wrap(() => { g.fillStyle = `rgba(60,16,4,${a})`; g.beginPath(); g.ellipse(x, y, r, r * (.5 + R() * .3), R(), 0, TAU); g.fill(); }); }
      specks(1600, 'rgba(30,8,0,.3)', 'rgba(255,200,160,.18)');
      for (let i = 0; i < 40; i++) pebble(R() * TW, R() * TH, .6 + R() * 1.4, .7 + R() * .3, R(), 70 + R() * 30, 30, .7);      /* laterite pellets */
      for (let i = 0; i < 26; i++) {
        const pts = [[R() * TW, R() * TH]]; let a = R() * TAU;
        for (let k = 0; k < 10; k++) { a += (R() - .5) * 1.1; const [x, y] = pts[pts.length - 1]; pts.push([x + Math.cos(a) * (4 + R() * 6), y + Math.sin(a) * (4 + R() * 6)]); }
        const w = .3 + R() * .9;
        wrap(() => { g.strokeStyle = 'rgba(40,18,6,.4)'; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts) g.lineTo(...q); g.stroke(); g.strokeStyle = 'rgba(255,220,180,.12)'; g.lineWidth = w * .5; g.beginPath(); g.moveTo(pts[0][0] + .5, pts[0][1] - .5); for (const q of pts) g.lineTo(q[0] + .5, q[1] - .5); g.stroke(); });
      }
    } else if (kind === 'rock') {
      for (let i = 0; i < 140; i++) { const x = R() * TW, y = R() * TH, r = .8 + R() * R() * 4, e = .4 + R() * .5, rot = R() * TAU; wrap(() => { g.fillStyle = 'rgba(255,255,245,.16)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .3, r, r * e, rot, 0, TAU); g.fill(); g.fillStyle = 'rgba(30,26,20,.3)'; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill(); }); }   /* solution pits: dark, lit on their lower lip */
      for (let i = 0; i < 18; i++) { const x = R() * TW, y = R() * TH, L = 10 + R() * 30, a = Math.PI / 2 + (R() - .5) * .8; wrap(() => { g.strokeStyle = 'rgba(30,26,20,.35)'; g.lineWidth = .5 + R() * .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L * .5 + (R() - .5) * 4, y + Math.sin(a) * L * .5); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }); }   /* cracks */
      specks(1400, 'rgba(40,36,30,.25)', 'rgba(255,255,250,.3)');
      for (let i = 0; i < 12; i++) { const x = R() * TW, y = R() * TH; wrap(() => { g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = .4; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x, y, k * 1.1, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }); }   /* fossil shells */
    } else {
      /* reef rubble: porous coral rock, branch fragments */
      for (let i = 0; i < 300; i++) { const x = R() * TW, y = R() * TH, r = .6 + R() * 1.6; wrap(() => { g.fillStyle = 'rgba(40,20,20,.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,240,235,.25)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .5, 0, TAU); g.fill(); }); }
      for (let i = 0; i < 30; i++) { const x = R() * TW, y = R() * TH, a = R() * TAU, L = 6 + R() * 10; wrap(() => { g.strokeStyle = 'rgba(250,236,226,.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.lineTo(x + Math.cos(a + .6) * L * 1.4, y + Math.sin(a + .6) * L * 1.4); g.stroke(); }); }
      specks(1200, 'rgba(60,30,30,.25)', 'rgba(255,250,245,.3)');
    }
    return finish(c);
  }
  /* the pattern for one stretch, scaled to world units (made once, from an ordinary canvas: see the top) */
  function detailPattern(ctx, kind) {
    if (tiles[kind] !== undefined) return tiles[kind];
    if (!canBake()) return null;
    const t0 = performance.now();
    const c = detailTile(kind), pat = ctx.createPattern(c, 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(.5, .5));
    tiles[kind] = pat; stat.n++; spent(t0);
    return pat;
  }

  /* ============================================================
     SEA LIFE: fish, the whale shark, the manta, moon jellies, the
     green turtle; and the frigatebird overhead
     ============================================================ */
  function fishKit(col, col2, stripe) {
    const c1 = HX(col), c2 = HX(col2), R = mulberry32(c1[0] * 7 + c2[2]);
    const body = relief({
      box: [-14, -8, 18, 8], res: 7, depth: 4.2, relief: 1,
      shape: (g) => { g.beginPath(); g.moveTo(17, 0); g.quadraticCurveTo(10, -7, -6, -5); g.lineTo(-13, 0); g.lineTo(-6, 5); g.quadraticCurveTo(10, 7, 17, 0); g.fill(); },
      grooves: [[[[9, -4.6], [7.6, 0], [9, 4.4]], .5, .5]],
      albedo: (x, y, c) => {
        let k = mix(c2, c1, smoothstep(-5, 0, y));
        k = mix(k, [244, 248, 255], smoothstep(.5, 4.5, y) * .85);
        if (stripe) { const b = Math.min(Math.abs(x - 4), Math.abs(x + 3)); k = mix(k, HX(stripe), smoothstep(1.4, .8, b)); }
        return k;
      },
      light: [-.3, -.8, .55], amb: .45, spec: .55, shin: 50, env: .4,
      over: (g) => {
        /* scales: rows of tiny arcs that catch the light */
        g.lineWidth = .14;
        for (let x = -8; x < 12; x += 1.1) for (let y = -5; y < 5; y += 1) { g.strokeStyle = `rgba(255,255,255,${.12 + R() * .12})`; g.beginPath(); g.arc(x + (y % 2) * .55, y, .55, -1.2, 1.2); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .3; g.beginPath(); g.moveTo(13, -1); g.quadraticCurveTo(0, -1.8, -11, -.4); g.stroke();
        /* fins: dorsal and pectoral, see-through with rays */
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = css(mix(c2, [255, 255, 255], .2), .55); g.beginPath(); g.moveTo(6, -6); g.quadraticCurveTo(0, -10.5, -6, -5.4); g.closePath(); g.fill();
        g.fillStyle = css(mix(c1, [255, 255, 255], .3), .5); g.beginPath(); g.moveTo(7, 1.5); g.quadraticCurveTo(3, 4.5, 1.4, 3.6); g.quadraticCurveTo(3.5, 2.4, 7, 1.5); g.fill();
        g.strokeStyle = 'rgba(40,40,60,.25)'; g.lineWidth = .15; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(5 - k * 2, -5.6); g.lineTo(3 - k * 2.2, -8.6 + k * .5); g.stroke(); }
        /* the eye */
        g.fillStyle = '#d8c070'; g.beginPath(); g.arc(11, -1.5, 1.7, 0, TAU); g.fill();
        g.fillStyle = '#080a10'; g.beginPath(); g.arc(11.2, -1.5, 1.15, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(10.7, -2, .42, 0, TAU); g.fill();
      }
    });
    const tail = relief({
      box: [-8, -7.5, 1.5, 7.5], res: 7, depth: .5, relief: 1.5,
      shape: (g) => { g.beginPath(); g.moveTo(1, -1.2); g.lineTo(-7, -6.4); g.quadraticCurveTo(-4.4, 0, -7, 6.4); g.lineTo(1, 1.2); g.closePath(); g.fill(); },
      albedo: (x, y) => mix(mix(c2, c1, .5), [255, 255, 255], .15), alpha: (x) => .9 - smoothstep(-2, -7, x) * .3,
      light: [-.3, -.8, .55], amb: .5, spec: .3, shin: 30,
      over: (g) => { g.strokeStyle = 'rgba(30,30,50,.25)'; g.lineWidth = .14; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * .25); g.lineTo(-6.6, k * 1.5); g.stroke(); } }
    });
    return { body, tail };
  }
  function drawFish(ctx, o) {
    const col = o.col || '#c8d8e8', col2 = o.col2 || '#5a7a9a', kit = get(`fish|${col}|${col2}|${o.stripe || ''}`, () => fishKit(col, col2, o.stripe));
    if (!kit) return Sprites.drawFish(ctx, o);
    const s = o.s || 1, tail = Math.sin(o.ph || 0) * 3;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-12, 0); ctx.transform(1, -tail / 7, 0, 1, 0, 0); put(ctx, kit.tail); ctx.restore();
    put(ctx, kit.body);
    ctx.restore();
  }

  /* the whale shark: a checkerboard of pale spots and stripes on a dark back, a white belly */
  function sharkHalf(front) {
    const R = mulberry32(front ? 5 : 6), N = fbmN(2500);
    const path = (g) => {
      g.beginPath(); g.moveTo(500, -8); g.quadraticCurveTo(470, -80, 300, -96); g.quadraticCurveTo(0, -112, -300, -60); g.quadraticCurveTo(-420, -30, -440, -6);
      g.lineTo(-440, 14); g.quadraticCurveTo(-300, 56, 0, 84); g.quadraticCurveTo(300, 92, 470, 46); g.quadraticCurveTo(505, 26, 500, -8); g.fill();
      g.beginPath(); g.moveTo(40, -104); g.quadraticCurveTo(-30, -220, -100, -230); g.quadraticCurveTo(-80, -150, -110, -90); g.fill();
      g.beginPath(); g.moveTo(220, 60); g.quadraticCurveTo(140, 190, 60, 230); g.quadraticCurveTo(110, 130, 120, 72); g.fill();
    };
    const x0 = front ? 0 : -450, x1 = front ? 510 : 2;
    return relief({
      box: [x0, -240, x1, 240], res: .8, depth: 80, relief: 1,
      shape: (g) => { g.save(); g.beginPath(); g.rect(x0, -240, x1 - x0, 480); g.clip(); path(g); g.restore(); },
      dome: (x, y) => 0,
      grooves: front ? [0, 1, 2, 3, 4].map(k => [[[330 - k * 18, -40], [322 - k * 18, 0], [330 - k * 18, 40]], 3, 6]) : null,
      noise: (x, y) => N(x * .02, y * .02) * 6,
      albedo: (x, y, c) => {
        let k = mix([36, 62, 88], [58, 92, 120], N(x * .01 + 4, y * .01));
        return mix(k, [226, 234, 238], smoothstep(10, 50, y + Math.abs(x) * .03));
      },
      light: [-.3, -.8, .55], amb: .45, spec: .2, shin: 20, env: .25,
      after: (g) => {
        /* pale spots between pale stripes, as in every whale shark (each one's pattern is its own) */
        g.fillStyle = 'rgba(236,244,250,.78)';
        for (let k = 0; k < 330; k++) { const x = -420 + R() * 880, top = -100 + Math.abs(x) * .06, y = lerp(top, 40, R()); if (x > 430 || x < x0 - 6 || x > x1 + 6) continue; g.beginPath(); g.arc(x, y, 3 + R() * 4.5, 0, TAU); g.fill(); }
        g.strokeStyle = 'rgba(236,244,250,.5)'; g.lineWidth = 3;
        for (let k = 0; k < 12; k++) { const x = 260 - k * 56; g.beginPath(); g.moveTo(x, -98 + Math.abs(x) * .05); g.lineTo(x - 8, 30); g.stroke(); }
        for (const dy of [-60, -34]) { g.beginPath(); g.moveTo(360, dy - 18); g.quadraticCurveTo(0, dy - 34, -380, dy * .3); g.stroke(); }
        if (front) { g.fillStyle = '#0a1018'; g.beginPath(); g.arc(440, -10, 7, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(438, -12, 2, 0, TAU); g.fill(); }
      }
    });
  }
  function sharkTail() {
    return relief({
      box: [-140, -170, 12, 120], res: .8, depth: 30, relief: 1,
      shape: (g) => { g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(-90, -40, -130, -160); g.quadraticCurveTo(-110, -50, -70, 0); g.quadraticCurveTo(-110, 40, -125, 110); g.quadraticCurveTo(-70, 30, 0, 14); g.closePath(); g.fill(); },
      albedo: () => [44, 70, 98], light: [-.3, -.8, .55], amb: .45, spec: .15, shin: 20
    });
  }
  function drawWhaleShark(ctx, o) {
    const front = get('shark|f', () => sharkHalf(true)), back = front && get('shark|b', () => sharkHalf(false)), tail = back && get('shark|t', sharkTail);
    if (!tail) return Sprites.drawWhaleShark(ctx, o);
    const s = o.s || 1, t = o.t || 0, gulp = o.gulp || 0, sw = Math.sin(t * 1.4) * 22;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-430, 0); ctx.transform(1, -sw / 140, 0, 1, 0, 0); put(ctx, tail); ctx.restore();
    put(ctx, back); put(ctx, front);
    /* the wide mouth, opening to gulp */
    const mg = ctx.createLinearGradient(420, 0, 500, 30); mg.addColorStop(0, '#0c141c'); mg.addColorStop(1, '#2a3a48');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.moveTo(502, 4); ctx.quadraticCurveTo(470, 24 + gulp * 22, 420, 30 + gulp * 26); ctx.quadraticCurveTo(470, 14, 502, 4); ctx.fill();
    ctx.restore();
  }

  /* the manta: a dark back with pale shoulder patches, a white belly; wings that bend */
  function mantaKit() {
    const N = fbmN(2600);
    const wing = (up) => relief({
      box: [-125, up ? -146 : -2, 125, up ? 2 : 86], res: 1.6, depth: 14, relief: 1,
      shape: (g) => { g.beginPath(); if (up) { g.moveTo(120, 0); g.quadraticCurveTo(40, -40, -40, -140); g.quadraticCurveTo(-60, -10, -120, 0); } else { g.moveTo(-120, 0); g.quadraticCurveTo(-60, 10, -40, 80); g.quadraticCurveTo(40, 40, 120, 0); } g.closePath(); g.fill(); },
      albedo: (x, y) => up ? mix(mix([20, 28, 38], [34, 46, 60], N(x * .03, y * .03)), [200, 210, 214], smoothstep(.62, .8, N(x * .02 + 9, y * .03)) * smoothstep(-60, -20, y) * .6) : mix([226, 232, 236], [40, 50, 62], smoothstep(30, 70, y) * .7),
      light: [-.3, -.8, .55], amb: .45, spec: .25, shin: 30, env: .2
    });
    const fin = relief({
      box: [-20, -8, 20, 8], res: 4, depth: 4, shape: (g) => { g.beginPath(); g.ellipse(0, 0, 18, 6, 0, 0, TAU); g.fill(); },
      albedo: () => [40, 54, 70], amb: .45, spec: .2, shin: 20
    });
    return { up: wing(true), low: wing(false), fin };
  }
  function drawManta(ctx, o) {
    const kit = get('manta', mantaKit);
    if (!kit) return Sprites.drawManta(ctx, o);
    const s = o.s || 1, t = o.t || 0, flap = Math.sin(t * 1.6);
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-110, 0); ctx.quadraticCurveTo(-200, 4, -280, -4); ctx.stroke();
    ctx.save(); ctx.scale(1, (20 + flap * 60) / 80); put(ctx, kit.low); ctx.restore();
    ctx.save(); ctx.scale(1, (20 + flap * 120) / 140); put(ctx, kit.up); ctx.restore();
    for (const dy of [-10, 10]) { ctx.save(); ctx.translate(132, dy); ctx.rotate(dy * .03); put(ctx, kit.fin); ctx.restore(); }
    ctx.restore();
  }

  /* a moon jelly: a glassy bell, brighter at its rim, four horseshoe rings, fine canals */
  function jellyBell(hue) {
    const tint = hue === 'pink' ? [255, 176, 214] : [204, 228, 255], ring = hue === 'pink' ? [255, 120, 180] : [196, 140, 236];
    const w = 40, h = 24.8;
    return relief({
      box: [-w - 2, -h * 1.05, w + 2, 4], res: 3, depth: 10, relief: 1,
      shape: (g) => { g.beginPath(); g.moveTo(-w, 0); g.bezierCurveTo(-w, -h * 1.3, w, -h * 1.3, w, 0); for (let k = 8; k >= 0; k--) { const x = (k / 8 - .5) * 2 * w; g.quadraticCurveTo(x + w / 8, 3, x, 0); } g.fill(); },
      albedo: () => tint,
      alpha: (x, y, c) => clamp(.14 + Math.pow(1 - c.nz, 1.4) * .9, 0, .85),
      light: [-.3, -.8, .55], amb: .8, diff: .3, spec: .9, shin: 60, env: .6,
      over: (g) => {
        g.strokeStyle = css(tint, .25); g.lineWidth = .4;
        for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(0, -h * .95); g.quadraticCurveTo(k * w * .1, -h * .6, k * w * .16, 0); g.stroke(); }
        g.strokeStyle = css(ring, .75); g.lineWidth = 2.2;
        for (const [dx, dy] of [[-.32, -.42], [.32, -.42], [-.16, -.18], [.16, -.18]]) { g.beginPath(); g.ellipse(dx * w, dy * h, w * .15, h * .13, 0, .3, TAU - .3); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = .8; g.beginPath(); g.ellipse(-w * .35, -h * .7, w * .3, h * .14, -.35, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      }
    });
  }
  function drawJelly(ctx, j, t) {
    const bell = get('jelly|' + (j.hue === 'pink' ? 'pink' : 'blue'), () => jellyBell(j.hue));
    if (!bell) return Sprites.drawJelly(ctx, j, t);
    const r = j.r, pulse = Math.max(0, Math.sin(j.ph)) ** 2, w = r * (1 - pulse * .14), h = r * (.62 + pulse * .1);
    const tint = j.hue === 'pink' ? '255,170,210' : '200,225,255';
    ctx.save(); ctx.translate(j.x, j.y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${tint},.35)`; ctx.lineWidth = .5;
    for (let k = 0; k < 22; k++) { const x = (k / 21 - .5) * w * 1.9; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(t * 2 + k) * 3, r * .5, x + Math.sin(t * 1.4 + k) * 5, r * (.8 + (k % 3) * .1)); ctx.stroke(); }
    for (const k of [-1, -.35, .35, 1]) {
      ctx.beginPath(); ctx.moveTo(k * w * .2, 0); ctx.bezierCurveTo(k * w * .3 + Math.sin(t * 1.5 + k * 3) * 6, r * .6, k * w * .1 - Math.sin(t + k) * 6, r * 1.1, k * w * .2 + Math.sin(t * 1.2 + k) * 8, r * 1.6);
      ctx.strokeStyle = `rgba(${tint},.22)`; ctx.lineWidth = 3.2; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,.4)`; ctx.lineWidth = .7; ctx.stroke();
    }
    ctx.scale(w / 40, h / 24.8); put(ctx, bell);
    ctx.restore();
  }

  function turtleKit() {
    const R = mulberry32(2700), N = fbmN(2800);
    const shell = relief({
      box: [-28, -15, 38, 6], res: 4, depth: 7, relief: 1,
      shape: (g) => { g.beginPath(); g.ellipse(0, 0, 26, 12, 0, Math.PI, TAU); g.lineTo(26, 2); g.quadraticCurveTo(0, 8, -26, 2); g.fill(); g.beginPath(); g.ellipse(31, -2, 8, 5.5, -.1, 0, TAU); g.fill(); },
      grooves: [[[[-12, -11], [-10, 2]], .5, .8], [[[0, -12], [2, 2]], .5, .8], [[[12, -11], [14, 2]], .5, .8], [[[-24, -3], [24, -3]], .4, .6], [[[22, -1], [24, 1]], .6, .6]],
      albedo: (x, y, c) => x > 24 ? mix([120, 150, 90], [70, 100, 60], N(x, y)) : mix(mix([150, 110, 60], [80, 58, 30], N(x * .2, y * .2)), [60, 40, 20], c.groove * .6 + smoothstep(-4, 3, y) * .4),
      light: [-.3, -.8, .55], amb: .42, spec: .4, shin: 40, env: .2,
      over: (g) => { g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(34, -4, 1.4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(33.6, -4.4, .45, 0, TAU); g.fill(); }
    });
    const flip = relief({
      box: [-2, -6, 22, 6], res: 4, depth: 2, shape: (g) => { g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(14, -6, 21, 0); g.quadraticCurveTo(12, 3, 0, 3); g.fill(); },
      albedo: (x, y) => mix([116, 146, 84], [70, 96, 56], N(x * .5, y * .5)), amb: .45, spec: .25, shin: 30
    });
    return { shell, flip };
  }
  function drawTurtle(ctx, o) {
    const kit = get('turtle', turtleKit);
    if (!kit) return Sprites.drawTurtle(ctx, o);
    const s = o.s || 1, fl = Math.sin((o.ph || 0) * 2);
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-12, 5); ctx.rotate(Math.PI - .4 - fl * .3); ctx.scale(.55, .8); put(ctx, kit.flip); ctx.restore();
    ctx.save(); ctx.translate(-4, 6 + fl * 2); ctx.rotate(.5 + fl * .4); put(ctx, kit.flip); ctx.restore();
    put(ctx, kit.shell);
    ctx.restore();
  }

  /* the frigatebird: glossy black with a sheen, long angled wings, a forked tail, the red throat */
  function birdKit() {
    const wing = (side) => relief({
      box: side < 0 ? [-104, -34, 4, 12] : [-4, -34, 100, 12], res: 2.5, depth: 4, relief: 1.2,
      shape: (g) => { g.beginPath(); if (side < 0) { g.moveTo(0, 0); g.quadraticCurveTo(-40, -30, -100, -10); g.quadraticCurveTo(-60, -4, -10, 8); } else { g.moveTo(-10, 8); g.quadraticCurveTo(40, -4, 96, -14); g.quadraticCurveTo(40, -30, 0, 0); } g.closePath(); g.fill(); },
      albedo: (x, y) => mix([22, 22, 30], [44, 40, 58], smoothstep(-20, 4, y) * .5),
      light: [-.3, -.8, .55], amb: .5, spec: .5, shin: 30, env: .4,
      over: (g) => { g.strokeStyle = 'rgba(120,120,150,.25)'; g.lineWidth = .4; for (let k = 1; k < 9; k++) { const x = side * (40 + k * 7); g.beginPath(); g.moveTo(x, -10 - k * .4); g.lineTo(x + side * 6, 0); g.stroke(); } }
    });
    const body = relief({
      box: [-44, -2, 36, 24], res: 3, depth: 5,
      shape: (g) => { g.beginPath(); g.ellipse(0, 6, 18, 7, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-14, 8); g.lineTo(-40, 22); g.lineTo(-30, 10); g.lineTo(-42, 4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(16, 4); g.lineTo(34, 8); g.lineTo(16, 9); g.fill(); g.beginPath(); g.ellipse(12, 12, 6, 4.5, 0, 0, TAU); g.fill(); },
      albedo: (x, y) => (Math.hypot(x - 12, (y - 12) * 1.3) < 5.8 ? [220, 40, 30] : x > 17 ? [150, 150, 140] : [26, 26, 34]),
      light: [-.3, -.8, .55], amb: .5, spec: .6, shin: 40, env: .4
    });
    return { l: wing(-1), r: wing(1), body };
  }
  function drawBird(ctx, o) {
    const kit = get('bird', birdKit);
    if (!kit) return Sprites.drawBird(ctx, o);
    const s = o.s || 1, flap = Math.sin(o.ph || 0) * .25;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.transform(1, flap * .55, 0, 1 + flap * .4, 0, 0); put(ctx, kit.l); ctx.restore();
    ctx.save(); ctx.transform(1, -flap * .55, 0, 1 + flap * .4, 0, 0); put(ctx, kit.r); ctx.restore();
    put(ctx, kit.body);
    ctx.restore();
  }

  /* ============================================================
     THE PARK RANGER: a real (painted) face under a bush hat, a
     khaki shirt, a rake; one arm waves.  Feet at 0, ~94 tall.
     ============================================================ */
  function rangerKit() {
    const R = mulberry32(2900), N = fbmN(3000);
    const SKIN = [196, 146, 108], KHAKI = [176, 160, 112], OLIVE = [92, 92, 62];
    const body = relief({
      box: [-20, -70, 44, 6], res: 4, depth: 6, relief: 1,
      shape: (g) => {
        g.lineWidth = 2.6; g.beginPath(); g.moveTo(22, -62); g.lineTo(30, 0); g.stroke();                /* the rake's handle */
        g.lineWidth = 2; g.beginPath(); g.moveTo(22, 0); g.lineTo(40, 0); g.stroke(); for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(23 + k * 3.4, 0); g.lineTo(23 + k * 3.4, 4); g.stroke(); }
        g.beginPath(); g.roundRect(-12, -36, 10, 36, 3); g.fill(); g.beginPath(); g.roundRect(2, -36, 10, 36, 3); g.fill();            /* legs */
        g.beginPath(); g.roundRect(-14, -3, 13, 6, 3); g.fill(); g.beginPath(); g.roundRect(1, -3, 13, 6, 3); g.fill();              /* boots */
        g.beginPath(); g.moveTo(-15, -38); g.lineTo(-16, -60); g.quadraticCurveTo(-15, -67, -6, -68); g.lineTo(6, -68); g.quadraticCurveTo(15, -67, 16, -60); g.lineTo(15, -38); g.closePath(); g.fill();   /* shirt */
        g.lineWidth = 7; g.beginPath(); g.moveTo(11, -62); g.lineTo(22, -48); g.stroke();                /* the arm holding the rake */
        g.beginPath(); g.arc(22.5, -48, 3.6, 0, TAU); g.fill();
      },
      grooves: [[[[0, -38], [0, -66]], .6, .8], [[[-15, -38], [15, -38]], 1.2, 1.2], [[[-2, -36], [-1, 0]], .8, 1]],
      noise: (x, y) => N(x * .4, y * .4) * .4,
      albedo: (x, y, c) => {
        if (Math.hypot(x - 22.5, y + 48) < 4) return SKIN;                                   /* the hand on the rake */
        const t = clamp(((x - 11) * 11 + (y + 62) * 14) / 317, 0, 1);
        if (Math.hypot(x - 11 - 11 * t, y + 62 - 14 * t) < 3.8) return t > .55 ? mix(SKIN, [170, 120, 90], .2) : KHAKI;   /* the arm */
        if (x > 17) return y > -1 ? [120, 120, 118] : [150, 116, 70];                        /* the rake: steel teeth, a wooden handle */
        if (y > -3) return [52, 40, 30];
        if (y > -37) return OLIVE;
        return mix(KHAKI, [150, 132, 88], N(x * .2, y * .2) * .5);
      },
      light: [-.45, -.7, .55], amb: .42, spec: .06, shin: 12,
      over: (g) => {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(60,50,30,.35)'; g.fillRect(-12, -54, 9, 1); g.fillRect(3, -54, 9, 1);           /* pocket flaps */
        g.strokeStyle = 'rgba(60,50,30,.4)'; g.lineWidth = .4; g.strokeRect(-12, -54, 9, 8); g.strokeRect(3, -54, 9, 8);
        g.fillStyle = '#4a3c26'; g.fillRect(-15, -39.5, 30, 3);                                          /* the belt */
        g.fillStyle = '#c8b070'; g.fillRect(-1.6, -39.5, 3.2, 3);
        g.fillStyle = 'rgba(80,90,60,.8)'; g.beginPath(); g.ellipse(-11, -60, 3, 1.4, -.3, 0, TAU); g.fill();  /* a shoulder patch (a plain leaf) */
      }
    });
    const head = relief({
      box: [-21, -97, 21, -64], res: 8, depth: 6, relief: 1,
      shape: (g) => {
        g.beginPath(); g.ellipse(0, -76, 8.6, 10.2, 0, 0, TAU); g.fill();                               /* the face */
        g.beginPath(); g.ellipse(-8.6, -76, 1.8, 3, 0, 0, TAU); g.ellipse(8.6, -76, 1.8, 3, 0, 0, TAU); g.fill();  /* ears */
        g.beginPath(); g.roundRect(-4, -68, 8, 4, 2); g.fill();                                          /* the neck */
        g.beginPath(); g.ellipse(0, -84, 19, 3.6, 0, 0, TAU); g.fill();                                   /* the hat's brim */
        g.beginPath(); g.moveTo(-9.5, -84); g.quadraticCurveTo(-10, -95, 0, -95); g.quadraticCurveTo(10, -95, 9.5, -84); g.fill();   /* its crown */
      },
      grooves: [[[[-9.4, -87], [9.4, -87]], .8, 1.2], [[[0, -95], [0, -89]], .8, .8]],
      dome: (x, y) => (y > -83.5 ? 3 * Math.max(0, 1 - (x * x) / 70 - ((y + 75) * (y + 75)) / 110) : 0),
      albedo: (x, y) => {
        if (y < -83.4 || (y < -82 && Math.abs(x) > 9)) return mix([140, 108, 66], [110, 82, 48], N(x * .3, y * .3) * .6);
        if (y < -86.3 && y > -88) return [70, 52, 34];
        if (y > -68.5) return mix(SKIN, [150, 104, 74], .3);
        let k = SKIN;
        k = mix(k, [214, 132, 112], smoothstep(4, 1, Math.hypot(Math.abs(x) - 4.6, y + 73)) * .35);       /* cheeks */
        return mix(k, [120, 80, 56], smoothstep(-80, -84, y) * .5);                                       /* the hat's shadow */
      },
      light: [-.45, -.7, .55], amb: .45, spec: .12, shin: 18, sss: [.05, .015, .008],
      over: (g) => {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = '#3a2a1e'; g.beginPath(); g.moveTo(-8.6, -79); g.quadraticCurveTo(-8, -84, -3, -83.6); g.lineTo(-8.9, -83); g.fill(); g.beginPath(); g.moveTo(8.6, -79); g.quadraticCurveTo(8, -84, 3, -83.6); g.lineTo(8.9, -83); g.fill();   /* hair under the hat */
        for (const sx of [-1, 1]) {
          const ex = sx * 3.4, ey = -77.6;
          g.strokeStyle = '#3a2618'; g.lineWidth = .7; g.beginPath(); g.moveTo(ex - 2 * sx, ey - 2.4); g.quadraticCurveTo(ex, ey - 3.3, ex + 2 * sx, ey - 2.2); g.stroke();   /* brows */
          g.fillStyle = '#f4efe8'; g.beginPath(); g.ellipse(ex, ey, 1.7, 1, 0, 0, TAU); g.fill();
          g.fillStyle = '#5a3a20'; g.beginPath(); g.arc(ex + .25, ey + .05, .82, 0, TAU); g.fill();
          g.fillStyle = '#100a06'; g.beginPath(); g.arc(ex + .25, ey + .05, .4, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ex - .05, ey - .3, .2, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(70,40,24,.7)'; g.lineWidth = .35; g.beginPath(); g.ellipse(ex, ey - .1, 1.8, 1.05, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();   /* the upper lid */
        }
        g.strokeStyle = 'rgba(110,64,40,.55)'; g.lineWidth = .45; g.beginPath(); g.moveTo(.3, -77); g.quadraticCurveTo(1.4, -73.6, -.2, -72.9); g.stroke();   /* the nose */
        g.fillStyle = 'rgba(110,64,40,.25)'; g.beginPath(); g.ellipse(.6, -73, 1.3, .5, 0, 0, TAU); g.fill();
        g.strokeStyle = '#8a4434'; g.lineWidth = .55; g.beginPath(); g.moveTo(-2.4, -70.6); g.quadraticCurveTo(0, -69.7, 2.4, -70.6); g.stroke();   /* a quiet smile */
        g.strokeStyle = 'rgba(160,90,70,.4)'; g.lineWidth = .8; g.beginPath(); g.moveTo(-1.6, -69.9); g.quadraticCurveTo(0, -69.3, 1.6, -69.9); g.stroke();
      }
    });
    const arm = relief({
      box: [-4, -5, 26, 5], res: 5, depth: 3,
      shape: (g) => { g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(19, 0); g.stroke(); g.beginPath(); g.arc(22, 0, 3.8, 0, TAU); g.fill(); },
      albedo: (x) => (x > 18.5 ? SKIN : x > 8 ? mix(SKIN, [170, 120, 90], .2) : KHAKI), light: [-.45, -.7, .55], amb: .45, spec: .08, shin: 14,
      over: (g) => { g.strokeStyle = 'rgba(80,50,30,.5)'; g.lineWidth = .3; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(23 + k * .2, -2 + k * 1.3); g.lineTo(25.4, -2.4 + k * 1.5); g.stroke(); } }
    });
    return { body, head, arm };
  }
  function drawRanger(ctx, o) {
    const kit = get('ranger', rangerKit);
    if (!kit) return Sprites.drawRanger(ctx, o);
    const s = o.s || 1, a = -2.2 + Math.sin((o.wave || 0) * 3) * .5;
    ctx.save(); ctx.scale(s, s);
    const sg = ctx.createRadialGradient(4, 1, 1, 4, 1, 26); sg.addColorStop(0, 'rgba(0,0,0,.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.scale(1, .18); ctx.fillStyle = sg; ctx.fillRect(-24, -24, 56, 56); ctx.restore();
    put(ctx, kit.body);
    ctx.save(); ctx.translate(-10, -60); ctx.rotate(a); put(ctx, kit.arm); ctx.restore();
    put(ctx, kit.head);
    ctx.restore();
  }

  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms), log: log.slice(0, 40).map(a => a.join(':')).join(' ') }; }

  const api = { drawCrab, drawExuvia, drawZoea, drawMegalopa, drawEgg, crabReady, drawTrunk, clump, canopyTile, drawPalm, drawFern, drawLitter, drawRock, drawLog, drawCoral, detailPattern, drawFish, drawWhaleShark, drawManta, drawJelly, drawTurtle, drawBird, drawRanger, idle, beginFrame, cached, _relief: relief };
  /* anything not painted (yet) is the classic sprite */
  for (const k of Object.keys(Sprites)) if (!(k in api)) api[k] = Sprites[k];
  return api;
})();
