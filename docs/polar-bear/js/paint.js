/* ============================================================
   paint.js — the painted Arctic (with the WebGL look, ?gfx=gl)
   ============================================================
     The same animals as sprites.js, with the same options and the
     same joints (so every pose and age still works), built the way
     an artist's rig is: painted body parts mounted on bones.  Each
     part is painted once, here in code, as soft clumps and fine
     strands of fur that follow the lie of the coat, shaded for
     volume, and cached as an image:
       POLAR BEAR: torso · upper hind leg · upper foreleg · lower
         legs · big furry paw · tail · neck · head · lower jaw (+ a
         cooler, darker set for the far side); dense cream-white fur
         with a yellowish tint low down, blue-grey in the shadows,
         black nose, lips and eyes; a newborn's thin fur shows pink
       ringed seal (sleek, with its pale rings), Arctic fox (winter
       white or summer brown), caribou (white neck mane, antlers),
       boulders, driftwood, kelp, sedges, Arctic flowers, bearberry,
       cotton grass, and two detail tiles for the cross-section
       (earth and peat below the surface, snow and ice above it)
     Per frame the parts are only placed.  Baking happens on CPU
     canvases with a 10 ms budget per frame; anything not painted yet
     is drawn the classic way until its turn comes.  bake() is the
     seam where real painted sheets could replace any part later.
   ============================================================ */
'use strict';

const Painted = (function () {
  const RES0 = 4;                       /* pixels per unit in the cached parts */
  const SOFT = { willReadFrequently: true };
  const cache = new Map(), stat = { n: 0, ms: 0 };
  let budget = 10;
  function beginFrame() { budget = 10; }
  const canBake = () => budget > 0;
  const spent = (t0) => { budget -= performance.now() - t0; };
  const once = (key, make) => {
    let v = cache.get(key);
    if (!v) { if (!canBake()) return null; const t0 = performance.now(); v = make(); cache.set(key, v); spent(t0); }
    return v;
  };

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const rgb = (hex) => hexToRgb(hex);

  /* ---------- painting tools ---------- */
  function bake(x0, y0, x1, y1, paint, RES = RES0) {
    const t0 = performance.now();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0) * RES)); c.height = Math.max(1, Math.ceil((y1 - y0) * RES));
    const g = c.getContext('2d', SOFT);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); g.lineCap = 'round'; g.lineJoin = 'round';
    /* "is this point inside the shape?" from a one-off alpha mask of the path (isPointInPath per hair is slow) */
    const masks = new Map(), mw = c.width, mh = c.height;
    const inside = (path, x, y) => {
      let m = masks.get(path);
      if (!m) {
        const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
        const mg = mc.getContext('2d', SOFT); mg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); mg.fill(path);
        m = mg.getImageData(0, 0, mw, mh).data; masks.set(path, m);
      }
      const px = ((x - x0) * RES) | 0, py = ((y - y0) * RES) | 0;
      return px >= 0 && py >= 0 && px < mw && py < mh && m[(py * mw + px) * 4 + 3] > 127;
    };
    paint(g, inside);
    stat.n++; stat.ms += performance.now() - t0;
    return { c, x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  function put(ctx, part) { ctx.drawImage(part.c, part.x0, part.y0, part.w, part.h); }
  /* a tinted copy (the far legs sit in the body's shadow; wet fur) */
  function tinted(part, col, k) {
    const c = document.createElement('canvas'); c.width = part.c.width; c.height = part.c.height;
    const g = c.getContext('2d', SOFT); g.drawImage(part.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(col, k); g.fillRect(0, 0, c.width, c.height);
    return { ...part, c };
  }
  /* one hair: a tapered, slightly curved sliver from (x,y) along (dx,dy) */
  function hair(g, x, y, dx, dy, len, w, bend) {
    const nx = -dy, ny = dx, mx = x + dx * len * .5 + nx * bend, my = y + dy * len * .5 + ny * bend;
    g.beginPath();
    g.moveTo(x + nx * w, y + ny * w);
    g.quadraticCurveTo(mx + nx * w * .5, my + ny * w * .5, x + dx * len, y + dy * len);
    g.quadraticCurveTo(mx - nx * w * .5, my - ny * w * .5, x - nx * w, y - ny * w);
    g.closePath(); g.fill();
  }
  /* dense fur: soft clumps that give the coat its lie, then fine strands, low in contrast (a bear, not a sheep) */
  function fur(g, inside, path, box, R, n, flow, colour, o = {}) {
    const [bx0, by0, bx1, by1] = box, L = o.len || 3, W = o.w || .5, k = o.contrast === undefined ? 1 : o.contrast;
    const lite = colour.lite || [255, 255, 250], dark = colour.dark || [120, 130, 150];
    for (let pass = 0; pass < 2; pass++) {
      const count = pass ? n : n * .45;
      for (let i = 0; i < count; i++) {
        const x = bx0 + (bx1 - bx0) * R(), y = by0 + (by1 - by0) * R();
        if (!inside(path, x, y)) continue;
        let [dx, dy] = flow(x, y); const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const j = (R() - .5) * (pass ? .5 : .3), ca = Math.cos(j), sa = Math.sin(j), fx = dx * ca - dy * sa, fy = dx * sa + dy * ca;
        let c = colour(x, y);
        if (pass) { const r = R(); if (r < .3) c = mix(c, lite, .4 * k); else if (r > .84) c = mix(c, dark, .32 * k); }
        else c = mix(c, R() < .5 ? lite : dark, .12 * k);
        const v = 1 + (R() - .5) * .06 * k; c = [c[0] * v, c[1] * v, c[2] * v];
        g.fillStyle = css(c, pass ? .5 + R() * .4 : .38);
        hair(g, x, y, fx, fy, L * (pass ? .6 + R() * .7 : 1.2 + R() * .6), W * (pass ? .5 + R() * .4 : 2.1), (R() - .5) * L * .3);
      }
    }
  }
  /* volume: light from above, a cool shadow below, a soft darkening inside every edge */
  function volume(g, path, box, o = {}) {
    const [bx0, by0, bx1, by1] = box;
    g.save(); g.clip(path);
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, by0, 0, by1);
    lg.addColorStop(0, `rgba(255,252,240,${o.top === undefined ? .16 : o.top})`); lg.addColorStop(.45, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(${o.cool ? '40,60,100' : '20,16,10'},${o.bottom === undefined ? .26 : o.bottom})`);
    g.fillStyle = lg; g.fillRect(bx0 - 5, by0 - 5, bx1 - bx0 + 10, by1 - by0 + 10);
    g.strokeStyle = o.cool ? `rgba(50,64,96,${o.edge || .1})` : 'rgba(10,6,2,.06)';
    for (const w of [6, 4, 2.4]) { g.lineWidth = w; g.stroke(path); }
    g.restore();
    /* a thin painted contour, like an artist's line, so a white animal holds its shape against white snow */
    if (o.line) { g.save(); g.strokeStyle = `rgba(64,74,96,${o.line})`; g.lineWidth = o.lw || .9; g.stroke(path); g.restore(); }
  }
  /* a smooth, sleek coat (seal, caribou legs): soft paint and a fine low-contrast grain */
  function sleek(g, path, box, R, n, flow, colour, len, w, a = .2) {
    g.save(); g.clip(path);
    for (let i = 0; i < n; i++) {
      const x = lerp(box[0], box[2], R()), y = lerp(box[1], box[3], R()), [dx, dy] = flow(x, y), d = Math.hypot(dx, dy) || 1;
      const c = mix(colour(x, y), R() < .5 ? [255, 250, 240] : [20, 20, 24], .1 + R() * .12);
      g.fillStyle = css(c, a + R() * .2); hair(g, x, y, dx / d, dy / d, len * (.6 + R() * .7), w, (R() - .5) * .4);
    }
    g.restore();
  }
  function bone(ctx, part, a, b, nominal) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2); ctx.scale(1, len / nominal || 1);
    put(ctx, part); ctx.restore();
  }
  function shadowAt(ctx, cx, gy, rx, k = .3) {
    const sg = ctx.createRadialGradient(cx, gy, 1, cx, gy, rx);
    sg.addColorStop(0, `rgba(30,44,80,${k})`); sg.addColorStop(1, 'rgba(30,44,80,0)');
    ctx.save(); ctx.translate(0, gy); ctx.scale(1, .16); ctx.translate(0, -gy); ctx.fillStyle = sg; ctx.fillRect(cx - rx, gy - rx, rx * 2, rx * 2); ctx.restore();
  }

  /* ============================================================
     THE POLAR BEAR
     ============================================================ */
  function palette(form, a) {
    const F = FORMS[form] || FORMS.cream, pink = clamp(1 - a * 6, 0, 1) * .5;
    /* a touch warmer than the classic coat so a bear reads against blue-white snow */
    const warmUp = (c, k) => mix(c, [236, 220, 182], k);
    const fur = warmUp(rgb(F.fur), .26), fur2 = warmUp(rgb(F.fur2), .16), belly = warmUp(rgb(F.belly), .3), mask = rgb(F.mask);
    const skin = [238, 196, 188];
    const P = {
      lite: mix(fur, [255, 254, 248], .45),
      base: fur,
      warm: mix(belly, [222, 196, 132], .3),         /* the yellowish tint low on the body, the legs and the rump */
      shade: mix(fur2, [150, 168, 196], .4),         /* white fur goes blue-grey in shadow */
      deep: mix(fur2, [84, 98, 124], .55),
      mask: mask
    };
    for (const k of Object.keys(P)) P[k] = mix(P[k], skin, pink);
    return P;
  }
  function withTones(fn, P) { fn.lite = P.lite; fn.dark = P.deep; return fn; }

  function buildBear(form, boy, a) {
    const P = palette(form, a), R = mulberry32(17 + Math.round(a * 10) * 31 + (boy ? 7 : 0) + form.length * 101);
    const hr = lerp(13.5, 8.6, a) * (boy && a > .8 ? 1.06 : 1), muz = lerp(4.5, 12, a), earR = lerp(4.4, 3, a);
    const hx = lerp(-22, -30, a), sx = lerp(10, 15, a);
    const ryC = lerp(17, 17.5, a) * (boy && a > .8 ? 1.06 : 1), ryH = lerp(16, 18, a), cy0 = lerp(-1, -5, a);
    const neckL = lerp(5, 16, a), legW = lerp(10, 13.5, a);
    const newborn = clamp(1 - a * 8, 0, 1);
    const hl = lerp(2.2, 3.6, a) * (1 - newborn * .45), hw = lerp(.42, .55, a);
    const nFur = 1 - newborn * .5;
    const B = { hr, muz, earR, hx, sx, ryC, ryH, cy0, neckL, legW, P };

    /* --- the torso (in a frame where the body's centre line cy = 0) --- */
    {
      const rumpTop = -ryH - (a > .3 ? 2.5 : 0);
      const body = new Path2D();
      body.moveTo(hx - 4, rumpTop);
      body.bezierCurveTo(hx * .4, rumpTop + 1, sx * .3, -ryC - .5, sx, -ryC + 1);
      body.bezierCurveTo(sx + ryC * .7, -ryC + 3, sx + ryC * .95, -2, sx + ryC * .8, ryC * .5);
      body.bezierCurveTo(sx + ryC * .55, ryC + 2, sx - 2, ryC + 1, sx - 6, ryC);
      body.quadraticCurveTo((sx + hx) / 2, (ryC + ryH) / 2 + 3, hx + 6, ryH + 1.2);
      body.bezierCurveTo(hx - ryH * .5, ryH + 1, hx - ryH - 3, ryH * .4, hx - ryH - 2, -ryH * .3);
      body.bezierCurveTo(hx - ryH - 1, rumpTop + 4, hx - 9, rumpTop, hx - 4, rumpTop);
      body.closePath();
      const x0 = hx - ryH - 4, x1 = sx + ryC + 2, box = [x0 - 4, rumpTop - 5, x1 + 4, ryH + 9];
      const col = withTones((x, y) => {
        const t = (y - rumpTop) / (ryH - rumpTop), u = (x - x0) / (x1 - x0);
        let c = mix(P.lite, P.base, smoothstep(.05, .5, t));
        c = mix(c, P.warm, clamp(smoothstep(.55, .95, t) * .7 + smoothstep(.3, 0, u) * .3 * t, 0, 1));
        return mix(c, P.shade, smoothstep(.7, 1, t) * .5);
      }, P);
      const flow = (x, y) => { const t = (y - rumpTop) / (ryH - rumpTop), u = (x - x0) / (x1 - x0); return u > .82 ? [-.25, 1] : u < .14 ? [-.4, 1] : [-1, .2 + .9 * t]; };
      B.torso = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        const lg = g.createLinearGradient(0, rumpTop, 0, ryH); lg.addColorStop(0, css(P.lite)); lg.addColorStop(.5, css(P.base)); lg.addColorStop(1, css(mix(P.warm, P.shade, .4)));
        g.fillStyle = lg; g.fill(body);
        fur(g, inside, body, box, R, Math.round((x1 - x0) * (ryC + ryH) * 1.25 * nFur), flow, col, { len: hl, w: hw, contrast: .8 });
        /* the long fringe along the belly and the back of the haunch */
        for (let i = 0; i < 160 * nFur; i++) {
          const u = R(), x = lerp(hx - ryH * .6, sx + 2, u), y = lerp(ryH, ryC, u) + .2 + Math.sin(u * Math.PI) * 2.5;
          g.fillStyle = css(mix(P.warm, P.shade, .3 + R() * .4), .55); hair(g, x, y - 1.6, -.35, 1, hl * (1 + R() * .8), hw * .9, (R() - .5));
        }
        /* the haunch and the shoulder catch the light; a soft crease behind the shoulder */
        g.save(); g.clip(body); g.globalCompositeOperation = 'source-atop';
        for (const [cx, cyy, r, k] of [[hx + 1, -2, ryH * .85, .2], [sx - 2, -3, ryC * .7, .16]]) { const mg = g.createRadialGradient(cx - r * .3, cyy - r * .4, 1, cx, cyy, r); mg.addColorStop(0, `rgba(255,252,240,${k})`); mg.addColorStop(1, 'rgba(255,252,240,0)'); g.fillStyle = mg; g.fillRect(cx - r, cyy - r, r * 2, r * 2); }
        /* the belly and the flank behind the shoulder sit in cool shade */
        for (const [cx, cyy, rx, ry, k] of [[(hx + sx) / 2, ryC * .9, (sx - hx) * .55, ryC * .45, .2], [sx - ryC * .6, ryC * .2, ryC * .35, ryC * .7, .07]]) { g.save(); g.translate(cx, cyy); g.scale(rx, ry); const sg = g.createRadialGradient(0, 0, 0, 0, 0, 1); sg.addColorStop(0, `rgba(70,92,140,${k})`); sg.addColorStop(1, 'rgba(70,92,140,0)'); g.fillStyle = sg; g.fillRect(-1, -1, 2, 2); g.restore(); }
        g.restore();
        volume(g, body, box, { top: .18, bottom: .38, cool: true, edge: .14, line: .5, lw: 1.1 });
      });
      B.torsoWet = null;
      B.body = body;
    }
    /* --- legs: thick columns of fur, wider at the top, feathered behind; under the body so they grow out of it --- */
    const segment = (len, w0, w1, cTop, cBot, feather) => {
      const p = new Path2D();
      p.moveTo(-w0 / 2, -w0 * .2);
      p.quadraticCurveTo(-w0 * .58, len * .5, -w1 / 2, len);
      p.quadraticCurveTo(0, len + w1 * .45, w1 / 2, len);
      p.quadraticCurveTo(w0 * .56, len * .45, w0 / 2, -w0 * .2);
      p.quadraticCurveTo(0, -w0 * .6, -w0 / 2, -w0 * .2);
      p.closePath();
      const box = [-w0 - 3 - feather, -w0 * .7 - 2, w0 + 3, len + w1 + 4];
      const col = withTones((x, y) => mix(mix(cTop, cBot, clamp(y / len, 0, 1)), P.lite, smoothstep(0, w0 * .5, x) * .3), P);
      return bake(box[0], box[1], box[2], box[3], (g, inside) => {
        const lg = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0); lg.addColorStop(0, css(mix(cBot, P.shade, .3))); lg.addColorStop(.6, css(cTop)); lg.addColorStop(1, css(mix(cTop, P.lite, .4)));
        g.fillStyle = lg; g.fill(p);
        fur(g, inside, p, box, R, Math.round(len * w0 * 1.6 * nFur), (x, y) => [-.12 - (x < 0 ? .15 : 0), 1], col, { len: hl * .8, w: hw * .9, contrast: .7 });
        /* long hair hanging off the back of the leg */
        if (feather > 0) for (let i = 0; i < len * 4 * nFur; i++) { const y = R() * len * .85, x = -lerp(w0, w1, y / len) * .45; g.fillStyle = css(mix(cBot, P.shade, R() * .4), .55); hair(g, x, y, -.55, .85, hl * (1 + R() * feather * .3), hw * .8, (R() - .5)); }
        volume(g, p, box, { top: .06, bottom: .1, cool: true, line: .45 });
      });
    };
    const ground = 33, hipY = cy0 + ryH * .35, shY = cy0 + 5;
    B.hindNom = (ground - hipY) * .5; B.foreNom = (ground - shY) * .5;
    B.thigh = segment(B.hindNom, legW * 1.45, legW * 1.05, P.base, mix(P.base, P.warm, .5), 2);
    B.arm = segment(B.foreNom, legW * 1.25, legW, P.base, mix(P.base, P.warm, .4), 3);
    B.shinB = segment(B.hindNom, legW * 1.05, legW * .95, mix(P.base, P.warm, .5), P.warm, 1);
    B.shinF = segment(B.foreNom, legW * 1.02, legW * .95, mix(P.base, P.warm, .4), P.warm, 3.5);
    /* the big paw: a broad furry snowshoe, short black claws at the front */
    {
      const w = legW, pw = w * .82, ph = w * .42, p = new Path2D();
      p.moveTo(-pw * .9, ph * .7); p.quadraticCurveTo(-pw * 1.02, -ph * .7, -pw * .1, -ph * 1.1);
      p.quadraticCurveTo(pw * .9, -ph * 1.05, pw * 1.12, ph * .1); p.quadraticCurveTo(pw * 1.15, ph * .8, pw * .8, ph * .9); p.lineTo(-pw * .7, ph * .95); p.closePath();
      const box = [-pw - 3, -ph * 1.2 - 3, pw * 1.3 + 3, ph + 3];
      B.paw = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(mix(P.warm, P.base, .5)); g.fill(p);
        fur(g, inside, p, box, R, Math.round(pw * ph * 6 * nFur), (x) => [x < 0 ? -.4 : 1, .7], withTones(() => mix(P.warm, P.base, .55), P), { len: hl * .6, w: hw * .8, contrast: .6 });
        /* fur hangs over the toes; the claws peep out under it */
        g.fillStyle = '#1c1a1c';
        if (a > .1) for (let k = 0; k < 4; k++) { const cx = pw * (.45 + k * .2), cyy = ph * (.55 + k * .05); g.beginPath(); g.moveTo(cx, cyy - .5); g.quadraticCurveTo(cx + 1.4, cyy - .2, cx + 1.6, cyy + 1.1); g.quadraticCurveTo(cx + .6, cyy + .6, cx - .2, cyy + .4); g.closePath(); g.fill(); }
        volume(g, p, box, { top: .1, bottom: .22, cool: true, line: .5 });
      });
    }
    const far = [96, 112, 142];
    for (const k of ['thigh', 'arm', 'shinB', 'shinF', 'paw']) B[k + 'Far'] = tinted(B[k], far, .3);
    /* the tail: a little round tuft */
    {
      const rx = 3.6 + a * 1.5, ry = 3 + a, p = new Path2D(); p.ellipse(0, 0, rx, ry, -.5, 0, TAU);
      const box = [-rx - 4, -ry - 4, rx + 4, ry + 4];
      B.tail = bake(box[0], box[1], box[2], box[3], (g, inside) => { g.fillStyle = css(P.base); g.fill(p); fur(g, inside, p, box, R, 80, () => [-1, .6], withTones(() => P.base, P), { len: hl * .9, w: hw }); volume(g, p, box, { cool: true }); });
    }
    /* the neck, in its own frame (origin at the root, x along the neck) */
    {
      const p = new Path2D();
      p.moveTo(-17, -ryC * .5); p.quadraticCurveTo(neckL * .6, -ryC * .6, neckL + 4, -hr * .7);
      p.lineTo(neckL + 5, hr * .72); p.quadraticCurveTo(neckL * .4, ryC * .6, -15, ryC * .8); p.closePath();
      const box = [-19, -ryC * .7 - 4, neckL + 8, ryC * .8 + 6];
      const col = withTones((x, y) => { const t = (y + ryC * .6) / (ryC * 1.4); return mix(mix(P.lite, P.base, smoothstep(0, .5, t)), P.shade, smoothstep(.6, 1, t) * .45); }, P);
      B.neck = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(P.base); g.fill(p);
        fur(g, inside, p, box, R, Math.round((neckL + 20) * ryC * 1.5 * nFur), (x, y) => [-1, (y > 0 ? .45 : .04)], col, { len: hl * .8, w: hw, contrast: .7 });
        for (let i = 0; i < 40 * nFur; i++) { const x = lerp(-10, neckL, R()); g.fillStyle = css(mix(P.base, P.shade, .4), .5); hair(g, x, lerp(ryC * .7, hr * .7, (x + 10) / (neckL + 10)) - 1, -.4, 1, hl * 1.3, hw * .8, R() - .5); }
        volume(g, p, box, { top: .12, bottom: .16, cool: true, line: .22 });
        /* melt the root into the body */
        g.globalCompositeOperation = 'destination-in';
        const fg = g.createLinearGradient(-17, 0, -6, 0); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = fg; g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      });
    }
    /* the head, in the skull's frame: a long flat profile, a "Roman" nose, small round ears; the lower jaw apart */
    {
      const head = new Path2D();
      head.moveTo(-hr * 1.02, hr * .1);
      head.bezierCurveTo(-hr * 1.05, -hr * .7, -hr * .45, -hr * .9, hr * .15, -hr * .8);                    /* crown */
      head.quadraticCurveTo(hr * .7 + muz * .5, -hr * .82 - (a > .5 ? .6 : 0), hr * .8 + muz, -hr * .36);   /* forehead and the long nose */
      head.quadraticCurveTo(hr * .92 + muz, -hr * .05, hr * .78 + muz, hr * .2);                          /* nose tip */
      head.quadraticCurveTo(hr * .55 + muz * .6, hr * .36, hr * .3, hr * .44);                            /* upper lip */
      head.quadraticCurveTo(hr * .05, hr * .78, -hr * .45, hr * .72);                                       /* cheek */
      head.quadraticCurveTo(-hr * .95, hr * .55, -hr * 1.02, hr * .1);
      head.closePath();
      const ear = new Path2D(); ear.arc(-hr * .35, -hr * .78, earR, 0, TAU);
      const box = [-hr * 1.2 - 3, -hr - earR - 4, hr + muz + 4, hr + 3];
      const col = withTones((x, y) => {
        const fx = x / hr, fy = y / hr;
        let c = mix(P.lite, P.base, smoothstep(-.6, .4, fy));
        c = mix(c, P.mask, smoothstep(.4, 1, fx) * .5);
        return mix(c, P.shade, smoothstep(.2, .8, fy) * smoothstep(.6, -.2, fx) * .45);
      }, P);
      B.head = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(P.base); g.fill(ear);
        fur(g, inside, ear, box, R, 40, (x, y) => [x + hr * .35, y + hr * .78], withTones(() => P.base, P), { len: hl * .5, w: hw * .7 });
        g.fillStyle = css(P.deep, .55); g.beginPath(); g.arc(-hr * .3, -hr * .74, earR * .5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(64,74,96,.45)'; g.lineWidth = .7; g.stroke(ear);
        g.fillStyle = css(P.base); g.fill(head);
        fur(g, inside, head, box, R, Math.round(hr * hr * 9 * nFur), (x, y) => { const fx = x / hr; return fx > .3 ? [-1, .08] : [-1, y / hr * .8 + .1]; }, col, { len: hl * .62, w: hw * .75, contrast: .7 });
        volume(g, head, box, { top: .14, bottom: .14, cool: true, line: .5 });
        /* black skin: the lip line, the nose leather with its highlight, a few whisker spots */
        const nx = hr * .74 + muz, ny = -hr * .1;
        g.strokeStyle = 'rgba(22,18,20,.9)'; g.lineWidth = .45 + a * .2; g.beginPath(); g.moveTo(nx - .5, hr * .22); g.quadraticCurveTo(hr * .7 + muz * .7, hr * .34, hr * .45 + muz * .35, hr * .42); g.stroke();
        g.strokeStyle = 'rgba(22,18,20,.35)'; g.beginPath(); g.moveTo(hr * .45 + muz * .35, hr * .42); g.quadraticCurveTo(hr * .4 + muz * .2, hr * .45, hr * .3, hr * .46); g.stroke();
        const ng = g.createRadialGradient(nx - .6, ny - .9, .2, nx, ny, 3.6); ng.addColorStop(0, '#4a4648'); ng.addColorStop(1, '#0e0c0e');
        g.fillStyle = ng; g.beginPath(); g.ellipse(nx, ny, 2.8 + a * .7, 2.3 + a * .5, -.25, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(nx - .8, ny - 1, .9, .45, -.3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(40,36,40,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(hr * .45 + muz * (.45 + .4 * R()), hr * (.02 + .15 * R()), .22, 0, TAU); g.fill(); }
      });
      /* the lower jaw, hinged at (jx, jy) */
      const jx = hr * .22, jy = hr * .44;
      B.jx = jx; B.jy = jy;
      const jaw = new Path2D(); const L = hr * .5 + muz * .85;
      jaw.moveTo(-hr * .3, -hr * .02); jaw.quadraticCurveTo(L * .5, -hr * .06, L, -hr * .1);
      jaw.quadraticCurveTo(L + 1, hr * .12, L * .75, hr * .2); jaw.quadraticCurveTo(L * .3, hr * .38, -hr * .45, hr * .34); jaw.closePath();
      const jb = [-hr * .5 - 2, -hr * .2 - 2, L + 3, hr * .45 + 3];
      B.jaw = bake(jb[0], jb[1], jb[2], jb[3], (g, inside) => {
        g.fillStyle = css(mix(P.base, P.shade, .25)); g.fill(jaw);
        fur(g, inside, jaw, jb, R, 120, () => [-1, .25], withTones(() => mix(P.base, P.shade, .3), P), { len: hl * .5, w: hw * .7 });
        g.strokeStyle = 'rgba(22,18,20,.85)'; g.lineWidth = .7; g.beginPath(); g.moveTo(-hr * .1, -hr * .03); g.quadraticCurveTo(L * .5, -hr * .06, L, -hr * .1); g.stroke();
        volume(g, jaw, jb, { top: .05, bottom: .2, cool: true, line: .45, lw: .7 });
      });
    }
    /* curled up asleep: the big round haunch over the tucked paws */
    {
      const p = new Path2D(); p.ellipse(0, 0, ryH * .8, ryH * .75, 0, 0, TAU);
      const box = [-ryH - 3, -ryH - 3, ryH + 3, ryH + 3];
      B.haunch = bake(box[0], box[1], box[2], box[3], (g, inside) => { g.fillStyle = css(P.base); g.fill(p); fur(g, inside, p, box, R, Math.round(ryH * ryH * 3 * nFur), (x, y) => [-y, x * .6 + 1], withTones((x, y) => mix(P.lite, P.warm, smoothstep(-ryH * .5, ryH * .8, y) * .6), P), { len: hl, w: hw, contrast: .7 });
        g.save(); g.clip(p); g.globalCompositeOperation = 'source-atop'; const sg = g.createRadialGradient(-ryH * .3, -ryH * .35, 1, 0, 0, ryH * .85); sg.addColorStop(0, 'rgba(255,252,240,.2)'); sg.addColorStop(.6, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(60,80,120,.25)'); g.fillStyle = sg; g.fillRect(-ryH, -ryH, ryH * 2, ryH * 2); g.restore();
        g.globalCompositeOperation = 'destination-in'; const fg = g.createRadialGradient(0, 0, ryH * .3, 0, 0, ryH * .95); fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fillRect(-ryH - 3, -ryH - 3, ryH * 2 + 6, ryH * 2 + 6); });
    }
    B.wet = tinted(B.torso, [150, 176, 200], .55);
    return B;
  }
  function bearParts(form, boy, a) {
    const key = `bear|${form}|${boy && a > .8 ? 1 : 0}|${a.toFixed(1)}`;
    let p = cache.get(key);
    if (!p) { if (!canBake()) return null; const t0 = performance.now(); p = buildBear(FORMS[form] ? form : 'cream', boy, a); cache.set(key, p); spent(t0); }
    return p;
  }

  function drawBear(ctx, o) {
    const aIn = clamp(o.age === undefined ? 1 : o.age, 0, 1), a = Math.round(aIn * 10) / 10;
    const boy = o.sex !== 'girl';
    const B = bearParts(o.form, boy, a);
    if (!B) return Sprites.drawBear(ctx, o);
    const s = o.s || 1, walk = o.walk || 0, moving = !!o.moving, run = !!o.run;
    const stand = clamp(Math.max(o.stand || 0, (o.spar || 0) * .75), 0, 1), crouch = clamp(o.crouch || 0, 0, 1), sniff = clamp(o.sniff || 0, 0, 1);
    const sit = !!o.sit, lie = !!o.lie || !!o.still, curl = !!o.curl, swim = !!o.swim, slide = !!o.slide;
    const eyes = o.eyes === undefined ? (aIn < .06 ? 0 : 1) : o.eyes;
    const { hr, muz, hx, sx, ryC, ryH, neckL, legW } = B;
    const ground = 33, cy = B.cy0 + crouch * 7;
    ctx.save(); ctx.scale(s, s);
    let drop = 0;
    if (lie || curl) drop = ground - (cy + ryC) - 1;
    if (slide) drop = ground * .55 - (cy + ryC) + 18;
    if (!swim) { shadowAt(ctx, (hx + sx) * .5, ground + 1, (sx - hx + ryC + ryH) * .62, lie || slide ? .5 : .45); shadowAt(ctx, (hx + sx) * .5, ground + .5, (sx - hx + ryC + ryH) * .4, .35); }
    ctx.translate(0, drop);
    const amp = moving ? (run ? 13 : 7) * (1 - crouch * .4) : 0;
    const legPts = (lx, ly, k, back, extra = 0) => {
      const ph = walk + k * Math.PI, swing = Math.cos(ph) * amp, up = moving ? Math.max(0, Math.sin(ph)) * (run ? 8 : 4) : 0;
      const gy = ground - drop + extra;
      if (swim) { const st = Math.sin(walk * 1.1 + k * Math.PI); return back ? [[lx, ly], [lx - 6, ly + 10], [lx - 14 + st * 3, ly + 13]] : [[lx, ly], [lx + 6 + st * 7, ly + 9], [lx + 10 + st * 10, ly + 15 - Math.abs(st) * 3]]; }
      if (slide) return back ? [[lx, ly], [lx - 10, ly + 6], [lx - 22, ly + 8]] : [[lx, ly], [lx + 9, ly + 5], [lx + 20, ly + 7]];
      if (lie || curl) return [[lx, ly], [lx + (back ? -2 : 7), ly + (gy - ly) * .55], [lx + (back ? 4 : 15), gy - 2]];
      if (sit && back) return [[lx, ly], [lx + 2, gy - 6], [lx + 11, gy - 1]];
      const kx = lx + swing * .45 + (back ? -3 : 2), ky = ly + (gy - ly) * .5 - up * .5;
      return [[lx, ly], [kx, ky], [lx + swing, gy - up]];
    };
    const leg = (pts, back, farSide) => {
      const up = back ? (farSide ? B.thighFar : B.thigh) : (farSide ? B.armFar : B.arm), low = back ? (farSide ? B.shinBFar : B.shinB) : (farSide ? B.shinFFar : B.shinF);
      const nom = back ? B.hindNom : B.foreNom;
      bone(ctx, low, pts[1], pts[2], nom);
      bone(ctx, up, pts[0], pts[1], nom);
      ctx.save(); ctx.translate(pts[2][0] + legW * .05, pts[2][1] - legW * .12); put(ctx, farSide ? B.pawFar : B.paw); ctx.restore();
    };
    const hipY = cy + ryH * .35, pivot = [hx + 2, hipY];
    const rot = -stand * 1.15 + (sit ? -.3 : 0), sitExtra = sit ? (sx - pivot[0]) * Math.sin(.3) : 0;
    /* the hind legs (never rotated when standing), under the body */
    leg(stand > .05 ? [[hx + 6, hipY], [hx + 7, (hipY + ground) / 2], [hx + 9, ground]] : legPts(hx + 6, hipY, 1, true), true, true);
    if (!curl) leg(stand > .05 ? [[hx, hipY], [hx + 1, (hipY + ground) / 2], [hx + 3, ground]] : legPts(hx, hipY, 0, true), true, false);
    ctx.save();
    ctx.translate(pivot[0], pivot[1]); ctx.rotate(rot); ctx.translate(-pivot[0], -pivot[1]);
    ctx.save(); ctx.translate(hx - ryH - 1, cy - ryH * .35); put(ctx, B.tail); ctx.restore();
    if (!curl) {
      leg(stand > .05 ? [[sx + 2, cy + 6], [sx + 9, cy + 15], [sx + 11, cy + 22]] : legPts(sx + 2, cy + 5, 0, false, sitExtra), false, true);
      leg(stand > .05 ? [[sx, cy + 6], [sx + 7 + Math.sin((o.t || 0) * 3) * 2 * (o.spar ? 1 : 0), cy + 16], [sx + 6 + (o.spar ? 10 : 0), cy + 24 - (o.spar ? 8 : 0)]] : legPts(sx, cy + 5, 1, false, sitExtra), false, false);
    }
    ctx.save(); ctx.translate(0, cy);
    put(ctx, B.torso);
    if (o.wet > 0) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * clamp(o.wet, 0, 1) * .35; put(ctx, B.wet); ctx.globalAlpha = ga; }
    if (o.snow > 0) { for (let k = 0; k < 11; k++) { const x = lerp(hx - 2, sx + 2, k / 10) + Math.sin(k * 7.1) * 2, y = -ryC + 1 + Math.sin(k * 2.3) * 1.4, r = 1.6 + (k * 37 % 5) * .4; const sg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6); sg.addColorStop(0, `rgba(255,255,255,${.9 * o.snow})`); sg.addColorStop(.6, `rgba(250,253,255,${.6 * o.snow})`); sg.addColorStop(1, 'rgba(250,253,255,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, 0, 0, TAU); ctx.fill(); } }
    ctx.restore();
    if (o.wet > 0) { ctx.fillStyle = `rgba(190,220,240,${.65 * o.wet})`; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(hx + 4 + k * 8, cy + ryC + 3 + (k % 2) * 2.4, .9, 2, 0, 0, TAU); ctx.fill(); } }
    /* the neck and the head */
    let headA = sniff * .7 + (lie && !o.still ? -.1 : 0) + (o.still ? .55 : 0) + crouch * .35 + (swim ? -.28 : 0) + (slide ? -.2 : 0) - stand * .55 + (sit ? .2 : 0);
    if (stand > .05) headA += stand * 1.05;
    if (curl) headA = .9;
    const nx = sx + ryC * .5, ny = cy - ryC * .45;
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(headA);
    put(ctx, B.neck);
    ctx.translate(neckL + hr * .55, -1);
    if (curl) ctx.translate(-10, 9);
    const HS = lerp(1.04, 1.22, aIn); ctx.scale(HS, HS);
    const mo = clamp(o.mouth || 0, 0, 1) + (o.spar ? .5 + .3 * Math.sin((o.t || 0) * 6) : 0);
    if (mo > .08) {
      const L = hr * .5 + muz * .85, ang = mo * .45;
      ctx.fillStyle = '#2a1418'; ctx.beginPath(); ctx.moveTo(B.jx - hr * .2, B.jy); ctx.lineTo(hr * .76 + muz, hr * .14); ctx.lineTo(B.jx + Math.cos(ang) * L, B.jy + Math.sin(ang) * L); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a3050'; ctx.beginPath(); ctx.ellipse(B.jx + L * .55 * Math.cos(ang * .6), B.jy + L * .55 * Math.sin(ang * .6) + .8, 2.6, 1.1, ang * .6, 0, TAU); ctx.fill();   /* a polar bear's tongue is blue-black */
      ctx.save(); ctx.translate(B.jx, B.jy); ctx.rotate(ang); put(ctx, B.jaw); ctx.restore();
    } else { ctx.save(); ctx.translate(B.jx, B.jy); put(ctx, B.jaw); ctx.restore(); }
    put(ctx, B.head);
    /* the small dark eye, set in black skin; shut for a newborn or a sleeper */
    const ex = hr * .26, ey = -hr * .34, er = 1.05 + (1 - aIn) * .95;
    if (eyes > .2) {
      ctx.fillStyle = '#141012'; ctx.beginPath(); ctx.ellipse(ex, ey, er + .5, (er + .4) * eyes, -.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.ellipse(ex + .2, ey, er * .8, er * .8 * eyes, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#060406'; ctx.beginPath(); ctx.arc(ex + .3, ey, er * .42 * eyes, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(ex - .3, ey - er * .35, .3, 0, TAU); ctx.fill();
    } else { ctx.strokeStyle = '#1e1a1c'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(ex - 2.2, ey + .3); ctx.quadraticCurveTo(ex, ey + 1.6, ex + 2.2, ey + .3); ctx.stroke(); }
    if (o.carry === 'cub') { ctx.save(); ctx.translate(hr * .7 + muz + 3, hr * .7); ctx.rotate(.5); drawBear(ctx, { s: .22, form: o.carryForm || o.form, age: .02, lie: true, eyes: 0, seed: 9 }); ctx.restore(); }
    ctx.restore();
    if (o.collar) {
      ctx.save(); ctx.translate(nx + neckL * .15, ny + 1); ctx.rotate(headA * .6 - .35);
      ctx.strokeStyle = '#262c34'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, ryC * .62, 0, -Math.PI * .5, Math.PI * .5); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,180,200,.35)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(.6, 0, 4.5, ryC * .62, 0, -Math.PI * .4, Math.PI * .3); ctx.stroke();
      const bg = ctx.createLinearGradient(0, ryC * .5, 0, ryC * .5 + 5); bg.addColorStop(0, '#f0c050'); bg.addColorStop(1, '#a87a20');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-3, ryC * .5, 6, 5, 1.5); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    if (curl) { ctx.save(); ctx.translate(hx + 2, cy + ryH * .3); put(ctx, B.haunch); ctx.restore(); }
    ctx.restore();
  }

  /* ============================================================
     THE RINGED SEAL (60 long, belly on the ice at y = 0)
     ============================================================ */
  const SEAL = { back: [62, 66, 70], side: [128, 134, 138], belly: [196, 196, 190], ring: [206, 210, 208] };
  function sealBody(lk) {
    const R = mulberry32(81 + Math.round(lk * 4)), look = lk, hx = 22, hy = -9 - look * 9;
    const p = new Path2D();
    p.moveTo(-30, -2.5); p.bezierCurveTo(-27, -9, -18, -12.5, -6, -13.2);
    p.bezierCurveTo(6, -13.8, 14, -12, 17, -10 - look * 4);
    p.quadraticCurveTo(hx - 3, hy + 2, hx + 1, hy + 6);
    p.quadraticCurveTo(hx - 1, hy + 11, 14, -2);
    p.quadraticCurveTo(6, .8, -4, .6); p.lineTo(-24, .4); p.quadraticCurveTo(-29, .2, -30, -2.5); p.closePath();
    const box = [-42, hy - 4, hx + 6, 4];
    return bake(box[0], box[1], box[2], box[3], (g) => {
      /* the hind flippers, held together */
      for (const [dy, k] of [[-2.5, .8], [1, 1]]) { g.fillStyle = css(mix(SEAL.back, [30, 30, 34], .3 * k)); g.beginPath(); g.moveTo(-28, -2 + dy * .3); g.quadraticCurveTo(-34, -4 + dy, -39, -6 + dy * 1.6); g.quadraticCurveTo(-37.5, -1 + dy, -39, 3 + dy * .8); g.quadraticCurveTo(-34, 1 + dy * .3, -28, 0); g.closePath(); g.fill(); }
      const lg = g.createLinearGradient(0, -14, 0, 1); lg.addColorStop(0, css(SEAL.back)); lg.addColorStop(.45, css(mix(SEAL.back, SEAL.side, .6))); lg.addColorStop(.8, css(SEAL.side)); lg.addColorStop(1, css(SEAL.belly));
      g.fillStyle = lg; g.fill(p);
      g.save(); g.clip(p);
      /* the pale rings with dark centres that give the seal its name */
      for (let k = 0; k < 34; k++) {
        const x = lerp(-27, 16, R()), y = lerp(-12.5, -3, R() * R()), r = .9 + R() * 1.1;
        g.strokeStyle = css(mix(SEAL.ring, SEAL.side, y > -6 ? .4 : 0), .55 + R() * .2); g.lineWidth = .45 + R() * .3;
        g.beginPath(); g.ellipse(x, y, r * 1.3, r, R() * .5, 0, TAU); g.stroke();
        g.fillStyle = css(mix(SEAL.back, [20, 22, 26], .3), .45); g.beginPath(); g.ellipse(x, y, r * .7, r * .5, 0, 0, TAU); g.fill();
      }
      /* the wet sheen along the back */
      const sh = g.createLinearGradient(0, -14, 0, -7); sh.addColorStop(0, 'rgba(230,240,250,.35)'); sh.addColorStop(1, 'rgba(230,240,250,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(-4, -11.5, 18, 2.2, -.02, 0, TAU); g.fill();
      g.restore();
      sleek(g, p, box, R, 700, (x, y) => [-1, .05], (x, y) => mix(SEAL.side, SEAL.back, smoothstep(-4, -12, y)), 1.6, .18, .12);
      volume(g, p, box, { top: .12, bottom: .3, cool: true });
      /* the fore flipper with its little claws */
      g.fillStyle = css(mix(SEAL.side, SEAL.back, .5)); g.beginPath(); g.ellipse(10, -2.2, 5, 1.9, .4, 0, TAU); g.fill();
      g.strokeStyle = '#1a1a1e'; g.lineWidth = .3; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(13.4 + k * .5, -.4 + k * .3); g.lineTo(14.6 + k * .5, .2 + k * .3); g.stroke(); }
    });
  }
  function sealHead() {
    const R = mulberry32(91), p = new Path2D(); p.ellipse(0, 0, 7.2, 6, 0, 0, TAU); p.ellipse(5.6, 1.2, 3.4, 2.6, .2, 0, TAU);
    return bake(-9, -8, 12, 8, (g) => {
      const hg = g.createRadialGradient(-2, -3, .5, 0, 0, 8); hg.addColorStop(0, css(SEAL.side)); hg.addColorStop(1, css(SEAL.back));
      g.fillStyle = hg; g.fill(p);
      sleek(g, p, [-9, -8, 12, 8], R, 160, () => [-1, .1], () => mix(SEAL.side, SEAL.back, .4), 1.2, .15, .1);
      g.fillStyle = 'rgba(40,40,44,.6)'; g.beginPath(); g.ellipse(8.3, .6, .7, .5, 0, 0, TAU); g.fill();
      /* the big dark eye */
      g.fillStyle = '#0a0c10'; g.beginPath(); g.ellipse(2.6, -1.8, 2, 1.8, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(2.1, -2.4, .55, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(236,236,230,.8)'; g.lineWidth = .22; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(6.5, 1.6 + k * .35); g.quadraticCurveTo(9, 1.2 + k * .6, 11.5, .8 + k * 1.1); g.stroke(); }
      volume(g, p, [-9, -8, 12, 8], { top: .14, bottom: .25, cool: true });
    });
  }
  function sealHole() {
    const R = mulberry32(93), p = new Path2D(); p.ellipse(0, -6, 8, 9, 0, Math.PI, TAU); p.lineTo(8, 3); p.lineTo(-8, 3); p.closePath();
    return bake(-10, -16, 10, 4, (g) => {
      const hg = g.createRadialGradient(-2, -10, .5, 0, -5, 11); hg.addColorStop(0, css(mix(SEAL.side, [220, 226, 230], .2))); hg.addColorStop(1, css(SEAL.back));
      g.fillStyle = hg; g.fill(p);
      g.save(); g.clip(p); for (let k = 0; k < 7; k++) { const x = (R() - .5) * 12, y = -13 + R() * 6; g.strokeStyle = css(SEAL.ring, .5); g.lineWidth = .4; g.beginPath(); g.ellipse(x, y, 1.3, 1, 0, 0, TAU); g.stroke(); } g.restore();
      sleek(g, p, [-10, -16, 10, 4], R, 120, () => [0, 1], () => SEAL.side, 1.2, .15, .1);
      for (const ex of [-3.2, 3.2]) { g.fillStyle = '#080a0e'; g.beginPath(); g.ellipse(ex, -8, 2.1, 2.3, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(ex - .5, -8.8, .6, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(30,30,34,.8)'; g.beginPath(); g.ellipse(-1.1, -3.5, .8, .55, .3, 0, TAU); g.ellipse(1.1, -3.5, .8, .55, -.3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(240,240,236,.85)'; g.lineWidth = .25; for (const d of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(d * 2, -2.8 + k * .5); g.lineTo(d * 8, -3.6 + k * 1.3); g.stroke(); }
      /* wet: a bright rim of water on top */
      g.strokeStyle = 'rgba(240,248,255,.45)'; g.lineWidth = .6; g.beginPath(); g.ellipse(0, -6, 7.4, 8.4, 0, Math.PI * 1.15, Math.PI * 1.6); g.stroke();
    });
  }
  function drawSeal(ctx, o) {
    const s = o.s || 1;
    if (o.head) { const img = once('sealHole', sealHole); if (!img) return Sprites.drawSeal(ctx, o); ctx.save(); ctx.scale(s, s); ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha; put(ctx, img); ctx.restore(); return; }
    const look = clamp(o.look || 0, 0, 1), lk = Math.round(look * 4) / 4;
    const body = once('seal|' + lk, () => sealBody(lk)), head = body && once('sealHead', sealHead);
    if (!body || !head) return Sprites.drawSeal(ctx, o);
    ctx.save(); ctx.scale(s, s); ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
    shadowAt(ctx, -4, 0, 30, .3);
    put(ctx, body);
    ctx.save(); ctx.translate(22, -9 - lk * 9); ctx.rotate(-look * .3); put(ctx, head); ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     THE ARCTIC FOX (50 long, paws at y = +15): winter white, summer brown
     ============================================================ */
  function foxParts(summer) {
    const R = mulberry32(summer ? 121 : 123), F = {};
    const top = summer ? [112, 96, 76] : [244, 246, 248], dark = summer ? [70, 58, 46] : [196, 204, 216], belly = summer ? [214, 200, 168] : [252, 252, 252];
    const tone = (fn) => { fn.lite = summer ? [170, 150, 120] : [255, 255, 255]; fn.dark = dark; return fn; };
    const body = new Path2D(); body.ellipse(-2, 0, 16, 7.8, 0, 0, TAU);
    const head = new Path2D(); head.arc(15, -6, 6.4, 0, TAU); head.moveTo(18, -10); head.quadraticCurveTo(24, -7.6, 26.2, -5.2); head.quadraticCurveTo(24, -2.6, 18, -1.5); head.closePath();
    const ears = new Path2D(); for (const dx of [-2, 3]) { ears.moveTo(10.5 + dx, -10); ears.quadraticCurveTo(11.5 + dx, -16.5, 15.2 + dx, -10.8); ears.closePath(); }
    const box = [-22, -18, 28, 12];
    F.body = bake(box[0], box[1], box[2], box[3], (g, inside) => {
      g.fillStyle = css(top); g.fill(body);
      fur(g, inside, body, box, R, 700, (x, y) => [-1, .3 + y * .06], tone((x, y) => mix(top, belly, smoothstep(-1, 7, y))), { len: 2.6, w: .5 });
      volume(g, body, box, { top: .12, bottom: .2, cool: !summer });
      g.fillStyle = css(top); g.fill(ears); g.fill(head);
      fur(g, inside, ears, box, R, 50, () => [0, -1], tone(() => mix(top, dark, .3)), { len: 1.2, w: .35 });
      fur(g, inside, head, box, R, 380, (x, y) => [-1, (y + 6) * .1], tone((x, y) => mix(top, belly, smoothstep(-6, 0, y) * (summer ? .8 : .3))), { len: 1.6, w: .4 });
      volume(g, head, box, { top: .12, bottom: .14, cool: !summer });
      g.fillStyle = '#16121a'; g.beginPath(); g.arc(25.8, -5.1, 1.25, 0, TAU); g.fill();
      g.fillStyle = '#2a1e14'; g.beginPath(); g.ellipse(17.6, -7.8, 1.25, 1.05, 0, 0, TAU); g.fill(); g.fillStyle = '#060406'; g.beginPath(); g.arc(17.8, -7.8, .55, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(17.3, -8.2, .3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,24,22,.6)'; g.lineWidth = .4; g.beginPath(); g.moveTo(25.2, -4); g.quadraticCurveTo(23, -2.6, 20.5, -2.6); g.stroke();
    });
    const tail = new Path2D(); tail.moveTo(0, -3); tail.quadraticCurveTo(-14, -8, -21, 3); tail.quadraticCurveTo(-13, 9, 0, 3); tail.closePath();
    const tb = [-26, -11, 3, 11];
    F.tail = bake(tb[0], tb[1], tb[2], tb[3], (g, inside) => { g.fillStyle = css(top); g.fill(tail); fur(g, inside, tail, tb, R, 520, (x, y) => [-1, y * .08], tone((x) => summer ? mix(top, dark, smoothstep(-6, -20, x) * .5) : top), { len: 3.4, w: .55 }); volume(g, tail, tb, { top: .1, bottom: .2, cool: !summer }); });
    const haunch = new Path2D(); haunch.ellipse(0, 0, 8, 7, 0, 0, TAU);
    F.haunch = bake(-10, -9, 10, 9, (g, inside) => { g.fillStyle = css(top); g.fill(haunch); fur(g, inside, haunch, [-10, -9, 10, 9], R, 200, (x, y) => [-y, x + 2], tone(() => top), { len: 2.2, w: .45 }); volume(g, haunch, [-10, -9, 10, 9], { cool: !summer }); });
    const legC = summer ? mix(dark, top, .3) : [232, 236, 242];
    const lp = new Path2D(); lp.moveTo(-1.8, 0); lp.lineTo(-1.2, 7); lp.lineTo(1.2, 7); lp.lineTo(1.8, 0); lp.closePath();
    F.leg = bake(-3, -1, 3, 8, (g, inside) => { g.fillStyle = css(legC); g.fill(lp); fur(g, inside, lp, [-3, -1, 3, 8], R, 50, () => [0, 1], tone(() => legC), { len: 1.4, w: .3 }); g.fillStyle = css(summer ? [56, 46, 36] : [214, 220, 228]); g.beginPath(); g.ellipse(.6, 7, 2, 1, 0, 0, TAU); g.fill(); });
    F.legFar = tinted(F.leg, [80, 90, 110], .3);
    return F;
  }
  function drawFox(ctx, o) {
    const summer = !!o.summer, F = once('fox|' + (summer ? 1 : 0), () => foxParts(summer));
    if (!F) return Sprites.drawFox(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, moving = o.state === 'trot' || o.state === 'run', sitting = o.state === 'sit';
    ctx.save(); ctx.scale(s, s);
    shadowAt(ctx, 0, 15.5, 20, .28);
    const amp = moving ? (o.state === 'run' ? 8 : 5) : 0;
    const legs = (k, x) => { const sw = Math.cos(ph + k * Math.PI) * amp; return [[x, 2], [x + sw * .4, 9], [x + sw, 15]]; };
    for (const [k, x, far] of [[1, -12, true], [0, 9, true], [0, -14, false], [1, 7, false]]) {
      if (sitting && x < 0) continue;
      const p = legs(k, x + (far ? 2 : 0)); bone(ctx, far ? F.legFar : F.leg, p[0], p[1], 3.5); bone(ctx, far ? F.legFar : F.leg, p[1], [p[2][0], p[2][1] - 1], 3.5);
    }
    ctx.save(); ctx.translate(9, 2); ctx.rotate(sitting ? -.4 : 0); ctx.translate(-9, -2);
    ctx.save(); ctx.translate(-16, 0); ctx.rotate(Math.sin(ph * .5) * .1 + (sitting ? .5 : 0)); put(ctx, F.tail); ctx.restore();
    if (sitting) { ctx.save(); ctx.translate(-12, 6); put(ctx, F.haunch); ctx.restore(); }
    put(ctx, F.body);
    ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     CARIBOU (hooves at y = +60): a brown coat, a creamy neck mane, a white rump, white socks
     ============================================================ */
  function legBake(len, w0, w1, cTop, cBot, R, hoof, sock) {
    const p = new Path2D();
    p.moveTo(-w0 / 2, 0); p.quadraticCurveTo(-w0 * .6, len * .45, -w1 / 2, len); p.quadraticCurveTo(0, len + w1 * .7, w1 / 2, len);
    p.quadraticCurveTo(w0 * .55, len * .4, w0 / 2, 0); p.quadraticCurveTo(0, -w0 * .35, -w0 / 2, 0); p.closePath();
    const box = [-w0 - 4, -w0 * .5 - 3, w0 + 4, len + w1 + 5];
    return bake(box[0], box[1], box[2], box[3], (g) => {
      const lg = g.createLinearGradient(0, 0, 0, len); lg.addColorStop(0, css(cTop)); lg.addColorStop(.6, css(mix(cTop, cBot, .7))); lg.addColorStop(1, css(cBot)); g.fillStyle = lg; g.fill(p);
      if (sock) { g.save(); g.clip(p); const sg = g.createLinearGradient(0, len * .72, 0, len * .86); sg.addColorStop(0, 'rgba(236,232,222,0)'); sg.addColorStop(1, 'rgba(236,232,222,.95)'); g.fillStyle = sg; g.fillRect(-w0, len * .7, w0 * 2, len); g.restore(); }
      const sg = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0); sg.addColorStop(0, 'rgba(255,240,215,.14)'); sg.addColorStop(.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(10,6,2,.3)'); g.fillStyle = sg; g.fill(p);
      sleek(g, p, box, R, Math.round(len * w0 * .9), () => [-.05, 1], (x, y) => mix(cTop, cBot, clamp(y / len, 0, 1)), 2, .22);
      if (hoof) { g.fillStyle = css(hoof); g.beginPath(); g.moveTo(-w1 * .8, len - .5); g.lineTo(w1 * .9, len - .5); g.lineTo(w1 * 1.3, len + w1 * .6); g.lineTo(-w1 * .8, len + w1 * .6); g.closePath(); g.fill(); }
      g.save(); g.globalCompositeOperation = 'destination-in';
      const fg = g.createLinearGradient(0, -w0 * .5, 0, len * .25); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(.5, 'rgba(0,0,0,1)');
      g.fillStyle = fg; g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]); g.restore();
    });
  }
  function caribouParts(bull) {
    const R = mulberry32(bull ? 141 : 143), brown = [116, 98, 78], dark = [66, 54, 42], pale = [232, 226, 212], belly = [212, 206, 192], E = {};
    const body = new Path2D();
    body.moveTo(28, -22); body.bezierCurveTo(12, -28, -14, -25, -32, -22);
    body.bezierCurveTo(-42, -20, -48, -14, -50, -6); body.bezierCurveTo(-52, 4, -48, 12, -42, 17);
    body.bezierCurveTo(-36, 21, -30, 20, -26, 16); body.bezierCurveTo(-18, 17, 0, 21, 22, 21);
    body.bezierCurveTo(33, 19, 38, 6, 36, -6); body.bezierCurveTo(35, -15, 33, -20, 28, -22); body.closePath();
    const bbox = [-56, -32, 42, 27];
    E.body = bake(bbox[0], bbox[1], bbox[2], bbox[3], (g, inside) => {
      const lg = g.createLinearGradient(0, -26, 0, 22); lg.addColorStop(0, css(mix(brown, [180, 166, 146], .3))); lg.addColorStop(.5, css(brown)); lg.addColorStop(.72, css(dark)); lg.addColorStop(1, css(belly));
      g.fillStyle = lg; g.fill(body);
      g.save(); g.clip(body);
      /* the dark band along the flank above the pale belly, the white rump and tail */
      g.strokeStyle = css(dark, .6); g.lineWidth = 6; g.filter = 'blur(2px)'; g.beginPath(); g.moveTo(-36, 10); g.quadraticCurveTo(-6, 15, 30, 10); g.stroke(); g.filter = 'none';
      const rg = g.createRadialGradient(-50, -6, 1, -48, -4, 12); rg.addColorStop(0, css(pale)); rg.addColorStop(.6, css(pale, .85)); rg.addColorStop(1, css(pale, 0)); g.fillStyle = rg; g.beginPath(); g.ellipse(-47, -4, 8, 12, .1, 0, TAU); g.fill();
      /* a pale shoulder where the mane begins */
      const pg = g.createRadialGradient(30, -10, 1, 30, -8, 14); pg.addColorStop(0, css(pale, .8)); pg.addColorStop(1, css(pale, 0)); g.fillStyle = pg; g.fillRect(14, -26, 30, 40);
      for (const [x, y, rx, ry] of [[20, -6, 11, 13], [-32, -4, 13, 14]]) { const mg = g.createRadialGradient(x - 3, y - 5, 1, x, y, Math.max(rx, ry)); mg.addColorStop(0, 'rgba(255,240,210,.16)'); mg.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = mg; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
      g.restore();
      const c = (x, y) => mix(brown, dark, smoothstep(2, 12, y) * smoothstep(18, 10, y) * .7); c.lite = [200, 186, 164]; c.dark = dark;
      fur(g, inside, body, bbox, R, 1500, (x, y) => [-1, .15 + (y > 6 ? .3 : 0)], c, { len: 2.6, w: .4, contrast: .5 });
      volume(g, body, bbox, { top: .1, bottom: .25 });
      g.fillStyle = css(pale); g.beginPath(); g.ellipse(-50.5, -11, 2.2, 4, .3, 0, TAU); g.fill();
    });
    const neck = new Path2D(); neck.moveTo(16, -22); neck.quadraticCurveTo(38, -36, 50, -50); neck.lineTo(62, -42); neck.quadraticCurveTo(52, -18, 38, 6); neck.quadraticCurveTo(26, 8, 16, -22); neck.closePath();
    const head = new Path2D(); head.moveTo(50, -54); head.quadraticCurveTo(58, -58, 64, -52); head.quadraticCurveTo(71, -46, 72, -41); head.quadraticCurveTo(70, -36, 64, -37.5); head.quadraticCurveTo(56, -40, 50, -44); head.quadraticCurveTo(47, -49, 50, -54); head.closePath();
    const hbox = [12, -118, 84, 14];
    E.head = bake(hbox[0], hbox[1], hbox[2], hbox[3], (g, inside) => {
      /* the neck: grey-brown along the top, the long creamy mane on the throat */
      const mane = (x, y) => { const front = clamp((x - 28 - (y + 40) * -.35) / 16, 0, 1); return mix(mix(brown, [150, 136, 116], .4), pale, smoothstep(.15, .7, front)); }; mane.lite = [250, 248, 240]; mane.dark = [110, 96, 80];
      const ng = g.createLinearGradient(20, -40, 50, -10); ng.addColorStop(0, css(mix(brown, [150, 136, 116], .4))); ng.addColorStop(1, css(pale)); g.fillStyle = ng; g.fill(neck);
      fur(g, inside, neck, hbox, R, 900, () => [-.2, 1], mane, { len: 3.2, w: .5, contrast: .6 });
      for (let i = 0; i < 180; i++) { const t = R(), x = lerp(38, 58, t), y = lerp(6, -40, t) + R() * 3; g.fillStyle = css(mix(pale, [196, 188, 170], R() * .5), .7); hair(g, x, y, -.25, 1, 4 + R() * 7, .45, (R() - .5) * 1.5); }
      volume(g, neck, hbox, { top: .06, bottom: .18 });
      const hc = (x) => mix(mix(brown, dark, .3), pale, smoothstep(66, 72, x) * .5); hc.lite = [190, 170, 140]; hc.dark = dark;
      g.fillStyle = css(mix(brown, dark, .3)); g.fill(head); fur(g, inside, head, hbox, R, 360, () => [-1, -.15], hc, { len: 1.6, w: .38, contrast: .6 }); volume(g, head, hbox, { top: .12, bottom: .15 });
      g.fillStyle = '#1a1410'; g.beginPath(); g.ellipse(70.5, -40.5, 1.5, 1.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(58.5, -50.5, 1.6, 1.3, -.3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(58.1, -50.9, .45, 0, TAU); g.fill();
      for (const [ex, ey, an] of [[51, -54, -2.5], [53, -55, -2.2]]) { g.fillStyle = css(mix(brown, dark, .2)); g.beginPath(); g.ellipse(ex + Math.cos(an) * 4, ey + Math.sin(an) * 4, 4.2, 1.8, an, 0, TAU); g.fill(); }
      /* antlers: long beams sweeping back and up, tines, the flat brow "shovel" over the face */
      const big = bull ? 1 : .6;
      const beam = (pts, w) => { for (let i = 1; i < pts.length; i++) { const t = i / pts.length; g.strokeStyle = css(mix([126, 104, 80], [232, 222, 200], t)); g.lineWidth = lerp(w, w * .45, t); g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); } };
      for (const side of [1, 0]) {
        /* each beam sweeps back and up from the skull, then curves forward at the top */
        const o = side * 6, main = [];
        for (let i = 0; i <= 14; i++) { const t = i / 14; main.push([53 - o * .6 - Math.sin(t * Math.PI) * 24 * big + t * 6 * big, -56 - t * 62 * big + side * 2]); }
        beam(main, (3.2 - side * .5) * big + .6);
        for (const [t, len, an] of [[.45, 12, -.55], [.7, 13, -.25], [.88, 11, .05], [1, 7, -.6]]) { const [bx, by] = main[Math.round(t * 14)]; beam([[bx, by], [bx + Math.cos(an) * len * .55 * big, by + Math.sin(an) * len * .55 * big], [bx + Math.cos(an - .35) * len * big, by + Math.sin(an - .35) * len * big]], 1.7 * big + .4); }
        if (side === 0) { const [bx, by] = main[1]; g.fillStyle = css([150, 128, 100]); g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 8 * big, by - 2, bx + 12 * big, by + 6 * big); g.lineTo(bx + 9 * big, by + 7 * big); g.quadraticCurveTo(bx + 5, by + 2, bx, by + 1.5); g.closePath(); g.fill(); }
      }
    });
    E.upB = legBake(30, 17, 6, mix(brown, dark, .3), dark, R, null); E.upF = legBake(30, 12, 6, mix(brown, dark, .2), dark, R, null);
    E.low = legBake(28, 6, 4.4, dark, mix(dark, [30, 24, 20], .4), R, [28, 22, 18], true);
    E.upBFar = tinted(E.upB, [20, 16, 12], .3); E.upFFar = tinted(E.upF, [20, 16, 12], .3); E.lowFar = tinted(E.low, [20, 16, 12], .3);
    return E;
  }
  function drawCaribou(ctx, o) {
    const E = once('caribou|' + (o.bull ? 1 : 0), () => caribouParts(!!o.bull)); if (!E) return Sprites.drawCaribou(ctx, o);
    const s = o.s || 1, ph = o.ph || 0, moving = Math.abs(o.vx || 0) > 4;
    ctx.save(); ctx.scale(s, s);
    shadowAt(ctx, -6, 61, 52, .28);
    const amp = moving ? 12 : 0;
    const legs = (k, hx, hy) => { const sw = Math.cos(ph + k * Math.PI) * amp, up = moving ? Math.max(0, Math.sin(ph + k * Math.PI)) * 7 : 0; return [[hx, hy], [hx + sw * .4 - 2, hy + 30 - up * .5], [hx + sw, hy + 58 - up]]; };
    for (const [k, hx, hy, far] of [[1, -30, 2, true], [0, 20, 4, true], [0, -30, 2, false], [1, 20, 4, false]]) {
      const p = legs(k, hx + (far ? 4 : 0), hy), up = hx < 0 ? (far ? E.upBFar : E.upB) : (far ? E.upFFar : E.upF);
      bone(ctx, far ? E.lowFar : E.low, p[1], p[2], 28); bone(ctx, up, [p[0][0], p[0][1] - 8], p[1], 30);
    }
    put(ctx, E.body); put(ctx, E.head);
    ctx.restore();
  }

  /* ============================================================
     ROCKS, DRIFTWOOD, KELP AND THE TUNDRA'S PLANTS
     ============================================================ */
  /* a boulder: granite with frost-split cracks, map lichen, lit from above */
  function boulderBake(w, h, seed) {
    const R = mulberry32(seed * 7 + 3), pts = [], n = 12;
    for (let k = 0; k <= n; k++) { const u = k / n, an = Math.PI * (1 - u); pts.push([Math.cos(an) * w * .5 * (.9 + R() * .14), -Math.sin(an) * h * (.86 + R() * .18)]); }
    const p = new Path2D(); p.moveTo(-w * .52, 5); p.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const [x, y] = pts[i - 1], [nx, ny] = pts[i]; p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); }
    p.lineTo(pts[n][0], pts[n][1]); p.lineTo(w * .52, 5); p.closePath();
    const box = [-w * .6, -h * 1.1, w * .6, 7];
    return bake(box[0], box[1], box[2], box[3], (g) => {
      const bg = g.createLinearGradient(-w * .3, -h, w * .3, 4); bg.addColorStop(0, '#b8b6b2'); bg.addColorStop(.5, '#8a8a8a'); bg.addColorStop(1, '#4a4c52');
      g.fillStyle = bg; g.fill(p);
      g.save(); g.clip(p);
      /* big facets: planes that face the light or turn away */
      for (let k = 0; k < 7; k++) { const x = (R() - .5) * w * .8, y = -R() * h * .9; g.fillStyle = R() < .5 ? 'rgba(255,255,255,.08)' : 'rgba(20,24,32,.1)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .3) * w * .4, y + R() * h * .3); g.lineTo(x + (R() - .7) * w * .4, y + h * .4); g.closePath(); g.fill(); }
      for (let i = 0; i < w * h * .9; i++) { const x = (R() - .5) * w, y = -R() * h; g.fillStyle = R() < .5 ? `rgba(240,240,236,${.18 + R() * .25})` : `rgba(30,30,34,${.18 + R() * .25})`; g.beginPath(); g.arc(x, y, .25 + R() * .45, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(30,30,36,.55)'; g.lineWidth = .6;
      for (let k = 0; k < 3; k++) { let x = (R() - .5) * w * .6, y = -h * (.6 + R() * .3); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (R() - .5) * 5; y += h * .1 + R() * 3; g.lineTo(x, y); } g.stroke(); }
      /* map lichen (yellow-green) and orange crustose lichen on the lit top */
      for (let k = 0; k < 5; k++) { const cx = (R() - .55) * w * .7, cyy = -h * (.55 + R() * .35), col = R() < .35 ? [216, 130, 50] : [180, 196, 110]; for (let i = 0; i < 30; i++) { g.fillStyle = css(mix(col, [240, 240, 220], R() * .3), .6); g.beginPath(); g.arc(cx + (R() - .5) * w * .14, cyy + (R() - .5) * h * .08, .4 + R() * .8, 0, TAU); g.fill(); } }
      g.strokeStyle = 'rgba(255,252,240,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pts[2][0], pts[2][1] + .6); for (let i = 3; i < 8; i++) g.lineTo(pts[i][0], pts[i][1] + .6); g.stroke();
      const fg = g.createLinearGradient(0, -6, 0, 5); fg.addColorStop(0, 'rgba(10,14,24,0)'); fg.addColorStop(1, 'rgba(10,14,24,.55)'); g.fillStyle = fg; g.fillRect(-w, -6, w * 2, 12);
      g.restore();
    });
  }
  function drawRock(ctx, r) {
    const wq = Math.round(r.w / 4) * 4, hq = Math.round(r.h / 4) * 4, img = once(`rock|${wq}|${hq}|${r.seed % 5}`, () => boulderBake(wq, hq, r.seed % 5));
    if (!img) return Sprites.drawRock(ctx, r);
    ctx.save(); ctx.scale(r.w / wq, r.h / hq); put(ctx, img); ctx.restore();
  }
  /* small stones on the tundra and the beach (a half-buried pebble, r = its radius) */
  function drawStone(ctx, x, y, r, seed, snow) {
    const v = seed % 6, img = once('stone|' + v, () => boulderBake(20, 12, 20 + v)); if (!img) return false;
    ctx.save(); ctx.translate(x, y + r * .08); ctx.scale(r / 10 * (seed & 16 ? -1 : 1), r / 10); put(ctx, img);
    if (snow) { ctx.fillStyle = 'rgba(250,252,255,.95)'; ctx.beginPath(); ctx.ellipse(0, -10.5, 7.5, 2.2, 0, Math.PI, TAU); ctx.ellipse(0, -10.5, 7.5, .9, 0, 0, Math.PI); ctx.fill(); }
    ctx.restore();
    return true;
  }
  /* driftwood: a silver-grey sea-worn log with long cracks and a broken end */
  function driftBake(w, v) {
    const R = mulberry32(1700 + v * 29 + w), h = 10;
    return bake(-w / 2 - 4, -h / 2 - 3, w / 2 + 5, h / 2 + 3, (g) => {
      const body = new Path2D(); body.roundRect(-w / 2, -h / 2, w, h, h / 2);
      const bg = g.createLinearGradient(0, -h / 2, 0, h / 2); bg.addColorStop(0, '#e2dace'); bg.addColorStop(.5, '#b4aa9a'); bg.addColorStop(1, '#6a6258');
      g.fillStyle = bg; g.fill(body);
      g.save(); g.clip(body);
      for (let i = 0; i < w * 3; i++) { const x = -w / 2 + R() * w, y = -h / 2 + R() * h, L = 4 + R() * 14; g.strokeStyle = R() < .6 ? `rgba(70,62,54,${.25 + R() * .3})` : `rgba(250,246,236,${.2 + R() * .2})`; g.lineWidth = .2 + R() * .4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y + (R() - .5) * .6, x + L, y + (R() - .5) * .5); g.stroke(); }
      for (let k = 0; k < 2; k++) { const kx = (R() - .5) * w * .6; g.fillStyle = 'rgba(80,70,60,.5)'; g.beginPath(); g.ellipse(kx, (R() - .5) * 3, 1.8, 1.3, 0, 0, TAU); g.fill(); }
      g.restore();
      g.fillStyle = '#cfc6b6'; g.beginPath(); g.moveTo(w / 2 - 2, -h / 2); g.lineTo(w / 2 + 3, -h / 4); g.lineTo(w / 2 + 1, 0); g.lineTo(w / 2 + 4, h / 4); g.lineTo(w / 2 - 2, h / 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,60,50,.5)'; g.lineWidth = .3; g.stroke();
    });
  }
  function drawLog(ctx, x, y, w, a, seed) {
    const wq = Math.max(40, Math.round(w / 10) * 10), v = seed % 3, img = once('drift|' + wq + '|' + v, () => driftBake(wq, v)); if (!img) return false;
    ctx.save(); ctx.translate(x, y - 4); ctx.rotate(a); ctx.scale(w / wq, 1);
    ctx.fillStyle = 'rgba(30,40,60,.22)'; ctx.beginPath(); ctx.ellipse(1, 5, wq / 2 + 2, 1.6, 0, 0, TAU); ctx.fill();
    put(ctx, img); ctx.restore();
    return true;
  }
  /* kelp washed up on the shingle: olive-brown ribbons with a glossy wet edge */
  function kelpBake(v) {
    const R = mulberry32(2100 + v * 13);
    return bake(-14, -6, 14, 3, (g) => {
      for (let k = 0; k < 4; k++) {
        const x0 = -10 + R() * 4, y0 = 1 - R(), x1 = 6 + R() * 6, y1 = -1 - R() * 3, w = .6 + R() * .7;
        g.strokeStyle = css(mix([86, 74, 34], [124, 110, 46], R())); g.lineWidth = w * 1.3;
        g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + 6, y0 - 4 * R(), x1 - 6, y1 + 3, x1, y1); g.stroke();
        g.strokeStyle = 'rgba(230,236,200,.35)'; g.lineWidth = .3; g.beginPath(); g.moveTo(x0, y0 - w * .8); g.bezierCurveTo(x0 + 6, y0 - 4 * R() - w * .8, x1 - 6, y1 + 3 - w * .8, x1, y1 - w * .8); g.stroke();
      }
      for (let k = 0; k < 3; k++) { g.fillStyle = css([140, 124, 50]); g.beginPath(); g.ellipse(-4 + R() * 10, -R() * 2, 1.1, .9, 0, 0, TAU); g.fill(); }
    });
  }
  function drawKelp(ctx, x, y, s, v) {
    const img = once('kelp|' + (v % 3), () => kelpBake(v % 3)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (v & 4 ? -1 : 1), s); put(ctx, img); ctx.restore();
    return true;
  }
  /* sedges and grasses: tufts of narrow blades, darker at the root; straw in autumn, dry stalks poking through snow */
  const SEDGE = { summer: [[96, 120, 58], [168, 176, 92]], autumn: [[150, 110, 56], [214, 176, 104]], spring: [[130, 122, 84], [184, 176, 128]], winter: [[150, 136, 100], [210, 196, 150]] };
  function sedgeBake(season, v) {
    const R = mulberry32(300 + v * 17 + season.length * 5), [lo, hi] = SEDGE[season] || SEDGE.summer;
    return bake(-8, -15, 8, 1, (g) => {
      for (let i = 0; i < 14 + v * 2; i++) {
        const x0 = (R() - .5) * 6, h = 5 + R() * 9, lean = (R() - .5) * 7, w = .35 + R() * .3;
        const gg = g.createLinearGradient(0, 0, 0, -h); gg.addColorStop(0, css(mix(lo, [30, 30, 14], .5))); gg.addColorStop(1, css(mix(lo, hi, R())));
        g.fillStyle = gg; g.beginPath(); g.moveTo(x0 - w, 0); g.quadraticCurveTo(x0 + lean * .3, -h * .6, x0 + lean, -h); g.quadraticCurveTo(x0 + lean * .3 + w * .3, -h * .6, x0 + w, 0); g.closePath(); g.fill();
        if (R() < .12) { g.fillStyle = css(mix(hi, [90, 70, 40], .4)); g.beginPath(); g.ellipse(x0 + lean, -h - 1, .45, 1.4, lean * .05, 0, TAU); g.fill(); }
      }
    });
  }
  function drawSedge(ctx, x, y, s, season, sway, v) {
    const k = v % 5, img = once('sedge|' + season + '|' + k, () => sedgeBake(season, k)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sway * .25, 1, 0, 0); ctx.scale(s * .85, s * .85); put(ctx, img); ctx.restore();
    return true;
  }
  /* bearberry and dwarf willow: a low mat of glossy leaves, red and gold in autumn, with berries */
  function berryBake(season, v) {
    const R = mulberry32(400 + v * 23), autumn = season === 'autumn';
    return bake(-7, -5, 7, 1, (g) => {
      for (let i = 0; i < 26; i++) {
        const x = (R() - .5) * 11, y = -R() * 3.4, c = autumn ? (R() < .6 ? mix([200, 50, 34], [230, 90, 40], R()) : mix([226, 160, 40], [240, 196, 70], R())) : mix([62, 98, 46], [104, 136, 62], R());
        g.fillStyle = css(c); g.beginPath(); g.ellipse(x, y, 1.3, .75, (R() - .5) * 1.4, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,240,.25)'; g.beginPath(); g.ellipse(x - .3, y - .25, .5, .2, 0, 0, TAU); g.fill();
      }
      if (autumn || season === 'summer') for (let i = 0; i < 4; i++) { const x = (R() - .5) * 8, y = -1 - R() * 2; g.fillStyle = autumn ? '#c41e1e' : '#b8d070'; g.beginPath(); g.arc(x, y, .75, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x - .25, y - .3, .22, 0, TAU); g.fill(); }
    });
  }
  function drawBerry(ctx, x, y, s, season, v) {
    const k = v % 4, img = once('berry|' + season + '|' + k, () => berryBake(season, k)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * .62, s * .62); put(ctx, img); ctx.restore();
    return true;
  }
  /* Arctic flowers, one per colour the coast already uses:
     yellow: Arctic poppy · pink: dwarf fireweed · white: mountain avens · purple: purple saxifrage · pale yellow: Arctic cinquefoil */
  function flowerBake(col, v) {
    const R = mulberry32(500 + v * 31 + col.charCodeAt(2) * 7), stemC = [80, 108, 54], leafC = [86, 120, 62];
    const stem = (g, x1, top, w = .4) => { g.strokeStyle = css(mix(stemC, [40, 60, 30], R() * .4)); g.lineWidth = w; g.beginPath(); g.moveTo(x1 * .3, 0); g.quadraticCurveTo(x1 * .2, top * .5, x1, top); g.stroke(); };
    const petals = (g, x, y, n, len, wid, c1, c2, rot = 0) => { for (let i = 0; i < n; i++) { const an = i / n * TAU + rot; g.fillStyle = css(mix(c1, c2, R())); g.save(); g.translate(x, y); g.rotate(an); g.beginPath(); g.ellipse(len * .55, 0, len * .55, wid, 0, 0, TAU); g.fill(); g.restore(); } };
    return bake(-9, -16, 9, 1, (g) => {
      for (let i = 0; i < 6; i++) { g.fillStyle = css(mix(leafC, [60, 84, 40], R())); g.beginPath(); g.ellipse((R() - .5) * 6, -.6, 1.6, .6, (R() - .5) * .8, 0, TAU); g.fill(); }
      if (col === '#ffd23f' || col === '#ffe060') {
        const poppy = col === '#ffd23f';
        for (let k = 0; k < 2; k++) { const hx = (k - .5) * 5 + (R() - .5) * 2, hy = poppy ? -10 - R() * 4 : -6 - R() * 3; stem(g, hx, hy); g.save(); g.translate(hx, hy); g.scale(1, poppy ? .6 : .7); petals(g, 0, 0, poppy ? 4 : 5, poppy ? 2.6 : 2, poppy ? 1.6 : 1.1, poppy ? [250, 214, 40] : [246, 222, 90], [255, 236, 120], R()); g.restore(); g.fillStyle = poppy ? '#7a8a30' : '#d8a020'; g.beginPath(); g.arc(hx, hy - .2, .6, 0, TAU); g.fill(); }
      } else if (col === '#e868b0') {
        /* dwarf fireweed (river beauty): big magenta flowers on short leafy stems */
        for (let k = 0; k < 2; k++) { const hx = (k - .5) * 6, hy = -8 - R() * 4; stem(g, hx, hy, .55); for (let j = 0; j < 3; j++) { g.fillStyle = css([120, 140, 100]); g.beginPath(); g.ellipse(hx * .6 + (j % 2 ? 1.2 : -1.2), hy * (j + 1) / 4, 1.6, .5, j % 2 ? .4 : -.4, 0, TAU); g.fill(); } petals(g, hx, hy, 4, 2.8, 1.4, [214, 70, 150], [240, 120, 190], .4); g.fillStyle = '#7a2a5a'; g.beginPath(); g.arc(hx, hy, .5, 0, TAU); g.fill(); }
      } else if (col === '#ffffff') {
        /* mountain avens: eight white petals round a golden centre */
        for (let k = 0; k < 2; k++) { const hx = (k - .5) * 5.5, hy = -7 - R() * 3; stem(g, hx, hy); g.save(); g.translate(hx, hy); g.scale(1, .7); petals(g, 0, 0, 8, 2.2, .9, [250, 250, 244], [228, 230, 220], R()); g.restore(); g.fillStyle = '#e8b830'; g.beginPath(); g.arc(hx, hy, .8, 0, TAU); g.fill(); }
      } else {
        /* purple saxifrage: a low cushion studded with small purple stars */
        for (let i = 0; i < 18; i++) { g.fillStyle = css(mix([70, 100, 60], [100, 128, 76], R())); g.beginPath(); g.arc((R() - .5) * 9, -R() * 2.5, .9, 0, TAU); g.fill(); }
        for (let k = 0; k < 7; k++) { const hx = (R() - .5) * 9, hy = -1.5 - R() * 2.5; petals(g, hx, hy, 5, 1.3, .6, [150, 70, 190], [190, 110, 230], R()); g.fillStyle = '#f0d8f8'; g.beginPath(); g.arc(hx, hy, .3, 0, TAU); g.fill(); }
      }
    });
  }
  function drawFlower(ctx, x, y, s, col, sway, v) {
    const k = v % 3, img = once('flower|' + col + '|' + k, () => flowerBake(col, k)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sway * .06, 1, 0, 0); ctx.scale(s * .62 * (v & 4 ? -1 : 1), s * .62); put(ctx, img); ctx.restore();
    return true;
  }
  /* cotton grass: a slender stalk with a soft white tuft of silky hairs */
  function cottonBake(v) {
    const R = mulberry32(600 + v * 11);
    return bake(-6, -18, 6, 1, (g) => {
      g.strokeStyle = '#7a8048'; g.lineWidth = .4; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(.6, -6, 0, -12.5); g.stroke();
      for (let i = 0; i < 4; i++) { g.strokeStyle = '#8a9050'; g.lineWidth = .35; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo((R() - .5) * 4, -3, (R() - .5) * 5, -4 - R() * 3); g.stroke(); }
      for (let i = 0; i < 70; i++) { const an = R() * TAU, r = Math.sqrt(R()) * 2.8; g.fillStyle = `rgba(255,255,252,${.35 + R() * .4})`; hair(g, 0, -13.5, Math.cos(an), Math.sin(an) * .9 - .1, r + .6, .12, (R() - .5) * .5); }
      const cg = g.createRadialGradient(-.6, -14.2, .2, 0, -13.5, 3); cg.addColorStop(0, 'rgba(255,255,255,.7)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.beginPath(); g.arc(0, -13.5, 3, 0, TAU); g.fill();
    });
  }
  function drawCotton(ctx, x, y, s, sway, v) {
    const img = once('cotton|' + (v % 3), () => cottonBake(v % 3)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sway * .12, 1, 0, 0); ctx.scale(s, s); put(ctx, img); ctx.restore();
    return true;
  }

  /* ============================================================
     THE CROSS-SECTION'S DETAIL: two seamless tiles laid source-atop
     over the cell layer: earth (peat fibres, pebbles, ice lenses,
     strata) below the land's surface, and snow and ice (crystal
     glints, wind layers, air bubbles) above it
     ============================================================ */
  let earthPat = null, snowPat = null;
  function tile(TW, TH, K, seed, paint) {
    const R = mulberry32(seed), c = document.createElement('canvas'); c.width = TW * K; c.height = TH * K;
    const g = c.getContext('2d', SOFT); g.scale(K, K); g.lineCap = 'round';
    /* draw a piece, and again across any edge it overlaps, so the tile is seamless */
    const wrap = (fn, x, y, r) => {
      for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) {
        if (x !== undefined && (x + ox + r < 0 || x + ox - r > TW)) continue;
        if (y !== undefined && (y + oy + r < 0 || y + oy - r > TH)) continue;
        if (ox || oy) { g.save(); g.translate(ox, oy); fn(); g.restore(); } else fn();
      }
    };
    paint(g, R, wrap);
    /* painted on a CPU canvas; a pattern from one would be re-sent to the GPU every frame, so hand it over once */
    const gc = document.createElement('canvas'); gc.width = c.width; gc.height = c.height; gc.getContext('2d').drawImage(c, 0, 0);
    return gc;
  }
  function patterns(ctx) {
    if (earthPat && snowPat) return true;
    if (!canBake()) return false;
    const t0 = performance.now(), K = 2;
    if (!earthPat) {
      const c = tile(480, 320, K, 2203, (g, R, wrap) => {
        const TW = 480, TH = 320;
        for (let i = 0; i < 9; i++) { const y = R() * TH, h = 3 + R() * 7, ph = R() * TAU, a = .05 + R() * .05; wrap(() => { g.fillStyle = R() < .5 ? `rgba(20,10,0,${a})` : `rgba(255,236,200,${a * .6})`; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= TW; x += 20) g.lineTo(x, y + Math.sin(x / TW * TAU * 2 + ph) * 4); for (let x = TW; x >= 0; x -= 20) g.lineTo(x, y + h + Math.sin(x / TW * TAU * 2 + ph + .5) * 4); g.fill(); }, undefined, y, 16); }
        for (let i = 0; i < 1300; i++) { const x = R() * TW, y = R() * TH, r = .3 + R() * .7, lt = R() < .5; wrap(() => { g.fillStyle = lt ? 'rgba(255,240,210,.2)' : 'rgba(20,10,0,.26)'; g.fillRect(x - r, y - r, r * 1.6, r * 1.6); }, x, y, 20); }
        /* peat fibres and old roots */
        for (let i = 0; i < 60; i++) { const x = R() * TW, y = R() * TH, L = 4 + R() * 10, an = (R() - .5) * .8; wrap(() => { g.strokeStyle = `rgba(40,24,10,${.25 + R() * .2})`; g.lineWidth = .3 + R() * .5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L * .5, y + (R() - .5) * 3, x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke(); }, x, y, 16); }
        /* ice lenses in the frozen ground */
        for (let i = 0; i < 26; i++) { const x = R() * TW, y = R() * TH, w = 4 + R() * 10; wrap(() => { g.fillStyle = 'rgba(214,232,250,.22)'; g.beginPath(); g.ellipse(x, y, w, .8 + R() * .8, (R() - .5) * .2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x - w * .5, y - .5, w * .5, .4); }, x, y, 16); }
        for (let i = 0; i < 45; i++) {
          const x = R() * TW, y = R() * TH, r = 1.2 + R() * R() * 4, e = .55 + R() * .35, rot = (R() - .5) * .8, tone = 60 + R() * 60;
          wrap(() => {
            g.fillStyle = 'rgba(10,6,2,.32)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .35, r, r * e, rot, 0, TAU); g.fill();
            const pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1); pg.addColorStop(0, `rgba(${tone + 40},${tone + 36},${tone + 30},.6)`); pg.addColorStop(1, `rgba(${tone * .5},${tone * .48},${tone * .45},.6)`);
            g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill();
          }, x, y, 8);
        }
      });
      earthPat = ctx.createPattern(c, 'repeat'); if (earthPat.setTransform) earthPat.setTransform(new DOMMatrix().scale(1 / K, 1 / K));
    }
    if (!snowPat) {
      const c = tile(400, 240, K, 3301, (g, R, wrap) => {
        const TW = 400, TH = 240;
        /* wind-packed layers */
        for (let i = 0; i < 14; i++) { const y = R() * TH, h = 1 + R() * 3, ph = R() * TAU, a = .04 + R() * .05, blue = R() < .6; wrap(() => { g.fillStyle = blue ? `rgba(80,120,190,${a})` : `rgba(255,255,255,${a * 1.5})`; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= TW; x += 20) g.lineTo(x, y + Math.sin(x / TW * TAU * 3 + ph) * 2); for (let x = TW; x >= 0; x -= 20) g.lineTo(x, y + h + Math.sin(x / TW * TAU * 3 + ph + .4) * 2); g.fill(); }, undefined, y, 8); }
        /* soft blue hollows */
        for (let i = 0; i < 40; i++) { const x = R() * TW, y = R() * TH, r = 6 + R() * 16; wrap(() => { const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(90,130,200,.06)'); gg.addColorStop(1, 'rgba(90,130,200,0)'); g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2); }, x, y, 24); }
        /* air bubbles caught in the ice */
        for (let i = 0; i < 70; i++) { const x = R() * TW, y = R() * TH, r = .4 + R() * 1.2; wrap(() => { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .3, 0, TAU); g.fill(); }, x, y, 20); }
        /* crystal glints */
        for (let i = 0; i < 500; i++) { const x = R() * TW, y = R() * TH, b = R(); wrap(() => { g.fillStyle = b < .7 ? `rgba(255,255,255,${.3 + R() * .5})` : `rgba(120,160,220,${.2 + R() * .2})`; g.fillRect(x, y, .6, .6); }, x, y, 20); }
      });
      snowPat = ctx.createPattern(c, 'repeat'); if (snowPat.setTransform) snowPat.setTransform(new DOMMatrix().scale(1 / K, 1 / K));
    }
    stat.n++; stat.ms += performance.now() - t0; spent(t0);
    return true;
  }
  /* b: the cell buffer, in world space, compositing source-atop */
  function cellDetail(b, S, view) {
    if (!patterns(b)) return;
    const step = 12, l = view.l - step, r = view.r + step;
    const below = new Path2D(), above = new Path2D();
    below.moveTo(l, view.b + 20); above.moveTo(l, view.t - 20);
    for (let x = l; x <= r + step; x += step) { const y = S.surfaceAt(x) + 2; below.lineTo(x, y); above.lineTo(x, y); }
    below.lineTo(r + step, view.b + 20); above.lineTo(r + step, view.t - 20); below.closePath(); above.closePath();
    b.save(); b.clip(below); b.fillStyle = earthPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); b.restore();
    b.save(); b.clip(above); b.fillStyle = snowPat; b.fillRect(view.l, view.t, view.r - view.l, view.b - view.t); b.restore();
  }

  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms) }; }

  return { drawBear, drawSeal, drawFox, drawCaribou, drawRock, drawStone, drawLog, drawKelp, drawSedge, drawBerry, drawFlower, drawCotton, cellDetail, beginFrame, cached };
})();
