/* ============================================================
   paint.js — the painted wolf (with the WebGL look, ?gfx=gl)
   ============================================================
     The same wolf as Sprites.drawWolf, with the same options and
     the same joints (so every pose, age and coat still works), but
     built the way an artist's rig is: painted body parts mounted on
     bones.  Each part is painted once, here in code, as thousands of
     tapered hairs that follow the lie of the coat, coloured from a
     map of the real markings (the dark saddle, the tawny legs and
     ears, the cream belly, chest and cheeks, the black tail tip),
     then shaded for volume and cached as an image:
       torso · thigh · upper foreleg · lower legs · paw · tail ·
       neck-and-head · lower jaw   (+ a darker set for the far side)
     Per frame the parts are only placed on the joints, so a pack of
     wolves costs a few dozen drawImage calls.  The eye, the open
     mouth, snow, drips and the collar are drawn live on top.
     A real painted sheet could replace any part later: bake() is
     the seam.
   ============================================================ */
'use strict';

const Painted = (function () {
  const RES0 = 4;                      /* pixels per wolf unit in the cached parts (bake() can take more) */
  /* parts are painted on CPU canvases: thousands of tiny fills are far slower on a GPU-backed canvas */
  const SOFT = { willReadFrequently: true };
  const cache = new Map(), stat = { n: 0, ms: 0, trees: 0 };
  /* a baking budget per frame: anything not painted yet is drawn the classic way until its turn comes */
  let budget = 10;
  function beginFrame() { budget = 10; }
  const canBake = () => budget > 0;
  const spent = (t0) => { budget -= performance.now() - t0; };

  /* ---------- the coats (sRGB 0..255) ---------- */
  const PAL = {
    gray:  { base: [136, 132, 124], saddle: [50, 46, 43], tawny: [168, 142, 112], cream: [234, 226, 210], dark: [34, 30, 27], tip: [214, 207, 194] },
    black: { base: [48, 45, 42], saddle: [24, 22, 20], tawny: [66, 57, 50], cream: [96, 90, 84], dark: [14, 13, 12], tip: [104, 98, 92] },
    white: { base: [224, 218, 204], saddle: [190, 182, 168], tawny: [224, 208, 178], cream: [246, 242, 234], dark: [150, 140, 126], tip: [252, 250, 246] }
  };
  const NEWBORN = { base: [72, 66, 62], saddle: [46, 42, 39], tawny: [90, 78, 68], cream: [112, 104, 97], dark: [30, 27, 25], tip: [124, 118, 112] };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  function palette(form, age) {
    const P = PAL[form] || PAL.gray, k = clamp(1 - age * 2.6, 0, 1) * .85, out = {};
    for (const key of Object.keys(P)) out[key] = mix(P[key], NEWBORN[key], form === 'black' ? k * .3 : k);
    return out;
  }

  /* ---------- painting tools ---------- */
  function bake(x0, y0, x1, y1, paint, RES = RES0) {
    const t0 = performance.now();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0) * RES)); c.height = Math.max(1, Math.ceil((y1 - y0) * RES));
    const g = c.getContext('2d', SOFT);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    /* "is this point inside the shape?" from a one-off alpha mask of the path (isPointInPath per hair is slow) */
    const masks = new Map(), mw = c.width, mh = c.height;
    const inside = (path, x, y) => {
      let m = masks.get(path);
      if (!m) {
        const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
        const mg = mc.getContext('2d', { willReadFrequently: true }); mg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); mg.fill(path);
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
  /* a darker copy, for the legs on the far side */
  function darker(part, k) {
    const c = document.createElement('canvas'); c.width = part.c.width; c.height = part.c.height;
    const g = c.getContext('2d', SOFT); g.drawImage(part.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(10,8,6,${k})`; g.fillRect(0, 0, c.width, c.height);
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
  /* a coat of hairs over a path: under-fur first, then guard hairs with light bands and dark tips */
  function coat(g, inside, path, box, R, n, flow, colour, o = {}) {
    const [bx0, by0, bx1, by1] = box, L = o.len || 3.2, W = o.w || .45;
    g.save();
    for (let pass = 0; pass < 2; pass++) {
      const count = pass ? n : n * .6;
      for (let i = 0; i < count; i++) {
        const x = bx0 + (bx1 - bx0) * R(), y = by0 + (by1 - by0) * R();
        if (!inside(path, x, y)) continue;
        let [dx, dy] = flow(x, y); const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const j = (R() - .5) * .5; const ca = Math.cos(j), sa = Math.sin(j); const fx = dx * ca - dy * sa, fy = dx * sa + dy * ca;
        let c = colour(x, y);
        if (pass) { const r = R(), k = o.contrast === undefined ? 1 : o.contrast; if (r < .28) c = mix(c, colour.tip || [230, 224, 212], .45 * k); else if (r > .82) c = mix(c, colour.dark || [30, 26, 22], .55 * k); }
        else c = mix(c, [0, 0, 0], .18);
        const v = .9 + R() * .2; c = [c[0] * v, c[1] * v, c[2] * v];
        g.fillStyle = css(c, pass ? .75 + R() * .25 : .9);
        hair(g, x, y, fx, fy, L * (pass ? .7 + R() * .7 : .9 + R() * .4), W * (pass ? .6 + R() * .5 : 1.1), (R() - .5) * L * .25);
      }
    }
    g.restore();
  }
  /* volume: light from above, a soft darkening inside every edge */
  function volume(g, path, box, o = {}) {
    const [bx0, by0, bx1, by1] = box;
    g.save(); g.clip(path);
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, by0, 0, by1);
    lg.addColorStop(0, `rgba(255,250,235,${o.top === undefined ? .14 : o.top})`); lg.addColorStop(.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(12,8,4,${o.bottom === undefined ? .22 : o.bottom})`);
    g.fillStyle = lg; g.fillRect(bx0 - 5, by0 - 5, bx1 - bx0 + 10, by1 - by0 + 10);
    g.strokeStyle = 'rgba(10,6,2,.07)';
    for (const w of [6, 4, 2.4]) { g.lineWidth = w; g.stroke(path); }
    g.restore();
  }

  /* ---------- the parts of one wolf (form, sex, age bucket) ---------- */
  function build(form, boy, age) {
    const P = palette(form, age), R = mulberry32(7 + Math.round(age * 10) * 13 + (boy ? 1 : 0) + form.length * 101);
    const fuzzy = clamp(1 - age * 2, 0, 1);                      /* a pup's coat is soft and woolly */
    const hairLen = lerp(2.2, 3.4, age) + fuzzy * .6, hairW = lerp(.55, .42, age);
    const headR = lerp(13.5, 12, age) * (boy ? 1.04 : 1), muz = lerp(7, 18, age), earH = lerp(6, 13, age), flop = clamp(1 - age * 3, 0, 1);
    const legL = lerp(17, 40, age), bodyRy = lerp(19, 16.5, age) * (boy ? 1.05 : 1), hipX = lerp(-24, -34, age), tailL = lerp(12, 36, age), neckL = lerp(9, 17, age);
    const chR = lerp(19, 20, age) * (boy ? 1.05 : 1), hipR = lerp(16, 17, age);
    const parts = { headR, muz, earH, legL, bodyRy, hipX, tailL, neckL, chR, hipR, P };
    const tipCol = P.tip, darkCol = P.dark;
    const withTips = (fn) => { fn.tip = tipCol; fn.dark = darkCol; return fn; };

    /* --- the torso: a deep chest, a tucked waist, the saddle over the shoulders and back --- */
    {
      const body = new Path2D();
      body.moveTo(chR * .2, -bodyRy);
      body.bezierCurveTo(chR * .9, -bodyRy - 2, chR + 4, -bodyRy * .5, chR + 3, 2);
      body.bezierCurveTo(chR + 2, bodyRy * .7, chR * .4, bodyRy + 1, 0, bodyRy);
      body.bezierCurveTo(hipX * .5, bodyRy * .72, hipX + 4, bodyRy * .7, hipX - hipR * .6, bodyRy * .55);
      body.bezierCurveTo(hipX - hipR - 4, bodyRy * .3, hipX - hipR - 4, -bodyRy * .6, hipX - hipR * .5, -bodyRy * .9);
      body.bezierCurveTo(hipX * .6, -bodyRy - 4, -6, -bodyRy - 3, chR * .2, -bodyRy);
      body.closePath();
      const box = [hipX - hipR - 8, -bodyRy - 8, chR + 9, bodyRy + 8];
      const span = chR + 4 - (hipX - hipR);
      const col = withTips((x, y) => {
        const u = (x - (hipX - hipR)) / span, t = (y + bodyRy) / (2 * bodyRy);
        let c = P.base;
        c = mix(c, P.tawny, smoothstep(.4, .72, t) * .55);
        c = mix(c, P.saddle, smoothstep(.48, .08, t) * smoothstep(.05, .3, u) * smoothstep(1.02, .6, u) * .85);
        c = mix(c, P.cream, clamp(smoothstep(.66, .92, t) + smoothstep(.78, .95, u) * smoothstep(.25, .6, t), 0, 1));
        return c;
      });
      const flow = (x, y) => { const u = (x - (hipX - hipR)) / span, t = (y + bodyRy) / (2 * bodyRy); return u > .82 ? [-.35, 1] : u < .12 ? [-.3, 1] : [-1, .15 + .7 * t]; };
      parts.torso = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(mix(P.base, P.saddle, .35)); g.fill(body);
        coat(g, inside, body, box, R, 2600, flow, col, { len: hairLen, w: hairW });
        /* the belly fringe and the long hair at the back of the thighs */
        g.save();
        for (let i = 0; i < 140; i++) {
          const x = lerp(hipX - 4, chR * .6, R()), t = R();
          const y = x > 0 ? lerp(bodyRy * .9, bodyRy, x / chR) : bodyRy * lerp(.6, .9, (x - hipX) / -hipX) ;
          g.fillStyle = css(mix(P.cream, P.tawny, R() * .5), .7); hair(g, x, y - 1.5, -.4, 1, hairLen * (1 + t), hairW * .8, (R() - .5));
        }
        g.restore();
        volume(g, body, box);
      });
    }
    /* --- legs: a muscular thigh, an upper foreleg, the lower legs, a paw --- */
    const segment = (len, w0, w1, colTop, colBot, back, bulge) => {
      const p = new Path2D();
      p.moveTo(-w0 / 2 - (back ? bulge : 0), 0);
      p.quadraticCurveTo(-w0 * .62 - (back ? bulge : 0), len * .45, -w1 / 2, len);
      p.quadraticCurveTo(0, len + w1 * .7, w1 / 2, len);
      p.quadraticCurveTo(w0 * .58, len * .4, w0 / 2, 0);
      p.quadraticCurveTo(0, -w0 * .35, -w0 / 2 - (back ? bulge : 0), 0);
      p.closePath();
      const box = [-w0 - bulge - 3, -w0 * .5 - 3, w0 + 3, len + w1 + 4];
      const col = withTips((x, y) => mix(mix(colTop, colBot, clamp(y / len, 0, 1)), P.cream, smoothstep(0, w0 * .5, x) * .35));
      return bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(mix(colTop, colBot, .5)); g.fill(p);
        coat(g, inside, p, box, R, Math.round(len * w0 * 2.2), (x, y) => [-.15 - (x < 0 ? .2 : 0), 1], col, { len: hairLen * .8, w: hairW * .85 });
        volume(g, p, box, { top: .05, bottom: .12 });
        /* fade the top into the body */
        g.save(); g.globalCompositeOperation = 'destination-in';
        const fg = g.createLinearGradient(0, -w0 * .5, 0, len * .3); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(.45, 'rgba(0,0,0,1)');
        g.fillStyle = fg; g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]); g.restore();
      });
    };
    const thighW = lerp(12, 18, age), armW = lerp(9, 10.5, age), lowW = lerp(6, 5.4, age);
    parts.thigh = segment(legL * .55, thighW, lowW + 1.5, mix(P.base, P.tawny, .4), P.tawny, true, lerp(1, 3, age));
    parts.arm = segment(legL * .55, armW, lowW + .8, mix(P.base, P.tawny, .3), mix(P.tawny, P.cream, .3), false, 0);
    parts.shinB = segment(legL * .5, lowW + 1.2, lowW * .8, P.tawny, mix(P.tawny, P.cream, .4), false, 0);
    parts.shinF = segment(legL * .5, lowW + .6, lowW * .8, mix(P.tawny, P.cream, .3), mix(P.tawny, P.cream, .55), false, 0);
    {
      const pw = lowW * 1.25, ph = lowW * .62, p = new Path2D();
      p.moveTo(-pw * .55, 0); p.quadraticCurveTo(-pw * .5, -ph, 0, -ph); p.quadraticCurveTo(pw * .9, -ph * .9, pw, -ph * .1);
      p.quadraticCurveTo(pw * 1.02, ph * .3, pw * .7, ph * .35); p.lineTo(-pw * .45, ph * .35); p.closePath();
      const box = [-pw - 2, -ph - 3, pw + 3, ph + 2];
      parts.paw = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(mix(P.tawny, P.cream, .4)); g.fill(p);
        coat(g, inside, p, box, R, 60, () => [1, .5], withTips(() => mix(P.tawny, P.cream, .5)), { len: hairLen * .6, w: hairW * .7 });
        g.strokeStyle = css(P.dark, .55); g.lineWidth = .35;
        for (const k of [.15, .45, .72]) { g.beginPath(); g.moveTo(pw * k, ph * .3); g.lineTo(pw * k - .3, -ph * .25); g.stroke(); }
        g.fillStyle = css(P.dark, .7); for (const k of [.15, .45, .72, .95]) { g.beginPath(); g.ellipse(pw * k + .5, ph * .32, .45, .25, 0, 0, TAU); g.fill(); }
        volume(g, p, box, { top: .1, bottom: .2 });
      });
    }
    for (const k of ['thigh', 'arm', 'shinB', 'shinF', 'paw']) parts[k + 'Far'] = darker(parts[k], .32);

    /* --- the tail: bushy, a dark spot near the base, a black tip --- */
    {
      const L = tailL, p = new Path2D();
      const w = (u) => lerp(3, lerp(6.5, 9, age), Math.sin(Math.min(1, u * 1.15) * Math.PI * .85)) * (1 - u * .25) + .8;
      const cy = (u) => L * .22 * u * u;
      p.moveTo(0, -w(0) * .6);
      for (let i = 1; i <= 12; i++) { const u = i / 12; p.lineTo(L * u, cy(u) - w(u)); }
      p.quadraticCurveTo(L + 3, cy(1), L * .98, cy(1) + w(1) * .6);
      for (let i = 12; i >= 0; i--) { const u = i / 12; p.lineTo(L * u, cy(u) + w(u) * .9); }
      p.closePath();
      const box = [-4, -14, L + 7, L * .22 + 14];
      const col = withTips((x, y) => { const u = x / L; let c = mix(P.base, P.tawny, .25); c = mix(c, P.saddle, smoothstep(.12, .2, u) * smoothstep(.3, .22, u) * smoothstep(cy(u) + 2, cy(u) - 4, y)); c = mix(c, P.cream, smoothstep(cy(u) + 1, cy(u) + 6, y) * .6); return mix(c, P.dark, smoothstep(.8, .9, u)); });
      parts.tail = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(mix(P.base, P.saddle, .3)); g.fill(p);
        coat(g, inside, p, box, R, Math.round(L * 30), (x, y) => [1, (y - cy(x / L)) * .08 + .15], col, { len: hairLen * 1.5, w: hairW });
        volume(g, p, box, { top: .1, bottom: .18 });
      });
    }

    /* --- neck and head, in the frame of the neck's root; the head sits at (hx, hy) --- */
    {
      const hx = neckL + 6, hy = -neckL * .45 - 2, r = headR, m = muz;
      parts.hx = hx; parts.hy = hy;
      const ruff = new Path2D();
      ruff.moveTo(-9, -7); ruff.quadraticCurveTo(neckL * .45, -8 - neckL * .2, hx - r * .45, hy - r * .75);
      ruff.lineTo(hx + r * .2, hy + r * .7); ruff.quadraticCurveTo(neckL * .5, 13, -7, 12); ruff.closePath();
      const skull = new Path2D();
      skull.moveTo(hx - r * 1.05, hy + r * .05);
      skull.bezierCurveTo(hx - r * 1.05, hy - r * .8, hx - r * .3, hy - r * 1.05, hx + r * .35, hy - r * .88);
      skull.quadraticCurveTo(hx + r * .78, hy - r * .76, hx + r * .82, hy - r * .5);                     /* the stop */
      skull.quadraticCurveTo(hx + r * .4 + m * .55, hy - r * .46, hx + r * .4 + m, hy - r * .3);           /* the muzzle */
      skull.quadraticCurveTo(hx + r * .5 + m + 2, hy - r * .05, hx + r * .42 + m, hy + r * .2);             /* the nose */
      skull.quadraticCurveTo(hx + r * .5 + m * .5, hy + r * .3, hx + r * .5, hy + r * .42);                 /* the upper lip */
      skull.quadraticCurveTo(hx + r * .2, hy + r * .8, hx - r * .4, hy + r * .78);                         /* cheek and throat */
      skull.quadraticCurveTo(hx - r * .95, hy + r * .6, hx - r * 1.05, hy + r * .05);
      skull.closePath();
      const box = [-12, hy - r - earH - 6, hx + r * .4 + m + 6, Math.max(14, hy + r + 4)];
      const ruffCol = withTips((x, y) => { const t = clamp((y - (hy - r)) / (r * 2 + 14), 0, 1); let c = mix(P.base, P.tawny, .45); c = mix(c, P.saddle, smoothstep(.4, .05, t) * .5); return mix(c, P.cream, smoothstep(.55, .9, t) * .8); });
      const faceCol = withTips((x, y) => {
        const fx = (x - hx) / r, fy = (y - hy) / r;
        let c = mix(P.base, P.tawny, .25);
        c = mix(c, P.saddle, smoothstep(-.3, -.85, fy) * smoothstep(1.2, .3, fx) * .45);             /* the darker crown */
        c = mix(c, P.cream, clamp(smoothstep(-.05, .35, fy) * smoothstep(-.6, .3, fx), 0, 1) * .9);   /* the pale cheek */
        c = mix(c, P.cream, smoothstep(.45, .9, fx) * smoothstep(-.15, .15, fy) * .8);              /* the muzzle's side */
        c = mix(c, mix(P.base, P.saddle, .3), smoothstep(.6, 1, fx) * smoothstep(-.2, -.45, fy) * .6); /* the top of the muzzle */
        return c;
      });
      const ears = [];
      for (const [dx, far] of [[-r * .55, true], [-r * .25, false]]) {
        const e = new Path2D(), ex = hx + dx, ey = hy - r * .62;
        const lean = -.15 + flop * 1.5, tx = ex + Math.sin(lean) * earH, ty = ey - Math.cos(lean) * earH;
        e.moveTo(ex - earH * .32, ey + 1); e.quadraticCurveTo(ex - earH * .3, ey - earH * .5, tx, ty); e.quadraticCurveTo(ex + earH * .4, ey - earH * .35, ex + earH * .38, ey + 1.5); e.closePath();
        ears.push([e, far, ex, ey, tx, ty]);
      }
      parts.head = bake(box[0], box[1], box[2], box[3], (g, inside) => {
        g.fillStyle = css(mix(P.base, P.tawny, .4)); g.fill(ruff);
        coat(g, inside, ruff, box, R, 700, (x, y) => [-1, .35 + (y > hy ? .6 : 0)], ruffCol, { len: hairLen * 1.4, w: hairW });
        volume(g, ruff, box, { top: .08, bottom: .14 });
        for (const [e, far, ex, ey] of ears) if (far) {
          g.fillStyle = css(mix(P.tawny, P.saddle, .35)); g.fill(e);
          coat(g, inside, e, box, R, 60, () => [.2, -1], withTips(() => mix(P.tawny, P.saddle, .5)), { len: hairLen * .6, w: hairW * .7 });
        }
        g.fillStyle = css(mix(P.base, P.cream, .3)); g.fill(skull);
        coat(g, inside, skull, box, R, 1300, (x, y) => { const fx = (x - hx) / r, fy = (y - hy) / r; return fx > .5 ? [-1, .05] : [-1, fy * .9]; }, faceCol, { len: hairLen * .75, w: hairW * .75 });
        volume(g, skull, box, { top: .12, bottom: .1 });
        /* the near ear: tawny outside, a pale tuft inside, a dark rim at the back */
        for (const [e, far, ex, ey, tx, ty] of ears) if (!far) {
          g.fillStyle = css(P.tawny); g.fill(e);
          coat(g, inside, e, box, R, 90, () => [.15, -1], withTips(() => mix(P.tawny, P.base, .3)), { len: hairLen * .6, w: hairW * .7 });
          g.save(); g.clip(e); g.fillStyle = css(P.cream, .55); g.beginPath(); g.moveTo(ex + earH * .05, ey); g.quadraticCurveTo(ex + earH * .15, ey - earH * .4, tx + .5, ty + 2); g.lineTo(ex + earH * .32, ey + 1); g.fill(); g.restore();
          g.strokeStyle = css(P.dark, .6); g.lineWidth = .8; g.beginPath(); g.moveTo(ex - earH * .32, ey + 1); g.quadraticCurveTo(ex - earH * .3, ey - earH * .5, tx, ty); g.stroke();
        }
        /* nose leather, the lip line, whisker spots, the dark line from the eye */
        const nx = hx + r * .42 + m, ny = hy - r * .1;
        const ng = g.createRadialGradient(nx - .8, ny - 1, .3, nx, ny, 3.6); ng.addColorStop(0, '#4a4440'); ng.addColorStop(1, '#0c0a09');
        g.fillStyle = ng; g.beginPath(); g.ellipse(nx - .3, ny, lerp(2.4, 3.4, age), lerp(2, 2.8, age), -.15, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(nx - .9, ny - 1.1, .9, .5, -.3, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(14,10,8,.85)'; g.lineWidth = .9; g.beginPath(); g.moveTo(nx - 1, hy + r * .22); g.quadraticCurveTo(hx + r * .5 + m * .5, hy + r * .32, hx + r * .5, hy + r * .42); g.stroke();
        g.fillStyle = 'rgba(30,24,20,.35)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(hx + r * .5 + m * (.45 + .4 * R()), hy + r * (.02 + .18 * R()), .25, 0, TAU); g.fill(); }
        g.strokeStyle = css(P.saddle, .5); g.lineWidth = .7; g.beginPath(); g.moveTo(hx + r * .3, hy - r * .22); g.quadraticCurveTo(hx, hy - r * .1, hx - r * .3, hy + r * .05); g.stroke();
      });
      /* the lower jaw, hinged at (jx, jy) */
      const jx = hx + r * .35, jy = hy + r * .38;
      parts.jx = jx; parts.jy = jy;
      const jaw = new Path2D();
      jaw.moveTo(0, -r * .05); jaw.quadraticCurveTo(m * .5, -r * .12, m + r * .02, -r * .16);
      jaw.quadraticCurveTo(m + r * .06, r * .06, m * .8, r * .14); jaw.quadraticCurveTo(m * .3, r * .32, -r * .3, r * .3); jaw.closePath();
      const jbox = [-r * .4 - 2, -r * .2 - 2, m + r * .2 + 2, r * .4 + 2];
      parts.jaw = bake(jbox[0], jbox[1], jbox[2], jbox[3], (g, inside) => {
        g.fillStyle = css(P.cream); g.fill(jaw);
        coat(g, inside, jaw, jbox, R, 140, () => [-1, .2], withTips(() => mix(P.cream, P.tawny, .25)), { len: hairLen * .6, w: hairW * .7 });
        g.strokeStyle = 'rgba(14,10,8,.8)'; g.lineWidth = .7; g.beginPath(); g.moveTo(0, -r * .05); g.quadraticCurveTo(m * .5, -r * .12, m + r * .02, -r * .16); g.stroke();
        volume(g, jaw, jbox, { top: .05, bottom: .2 });
      });
    }
    return parts;
  }
  function partsFor(form, boy, age) {
    const key = `${form}|${boy ? 1 : 0}|${age.toFixed(1)}`;
    let p = cache.get(key);
    if (!p) { if (!canBake()) return null; const t0 = performance.now(); p = build(form, boy, age); cache.set(key, p); spent(t0); }
    return p;
  }

  /* ---------- placing the parts ---------- */
  function bone(ctx, part, a, b, nominal) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2); ctx.scale(1, len / nominal || 1);
    put(ctx, part); ctx.restore();
  }
  function legDraw(ctx, Pt, pts, back, far, legL) {
    const up = back ? (far ? Pt.thighFar : Pt.thigh) : (far ? Pt.armFar : Pt.arm), low = back ? (far ? Pt.shinBFar : Pt.shinB) : (far ? Pt.shinFFar : Pt.shinF);
    bone(ctx, low, pts[1], pts[2], legL * .5);
    bone(ctx, up, pts[0], pts[1], legL * .55);
    ctx.save(); ctx.translate(pts[2][0] + 1, pts[2][1] - 1); put(ctx, far ? Pt.pawFar : Pt.paw); ctx.restore();
  }

  function drawWolf(ctx, o) {
    const s = o.s || 1, ageIn = clamp(o.age === undefined ? 1 : o.age, 0, 1), age = Math.round(ageIn * 10) / 10;
    const form = PAL[o.form] ? o.form : 'gray', boy = o.sex !== 'girl';
    const Pt = partsFor(form, boy, age);
    if (!Pt) return Sprites.drawWolf(ctx, o);
    const { headR, muz, legL, bodyRy, hipX, tailL, neckL, chR, hipR } = Pt;
    const walk = o.walk || 0, moving = !!o.moving, run = !!o.run;
    const howl = clamp(o.howl || 0, 0, 1), pounce = clamp(o.pounce || 0, 0, 1), bow = clamp(o.bow || 0, 0, 1), eyes = o.eyes === undefined ? (ageIn < .08 ? 0 : 1) : o.eyes;
    const sit = !!o.sit, lie = !!o.lie, curl = !!o.curl, swim = !!o.swim;
    ctx.save(); ctx.scale(s, s);
    /* a soft contact shadow, under everything and never tilted */
    if (!swim) {
      const gy = lie || curl ? bodyRy + 2 : 8 + legL, cx = (hipX + chR) * .45, rx = (chR - hipX + hipR) * .62;
      const sg = ctx.createRadialGradient(cx, gy, 1, cx, gy, rx);
      sg.addColorStop(0, 'rgba(0,0,0,.32)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(0, gy); ctx.scale(1, .16); ctx.translate(0, -gy); ctx.fillStyle = sg; ctx.fillRect(cx - rx, gy - rx, rx * 2, rx * 2); ctx.restore();
    }
    let tilt = -pounce * .35 + bow * .3 - (sit ? .3 : 0);
    if (swim) tilt = -.08;
    const lift = pounce * 10 + (sit ? 6 : 0);
    ctx.translate(0, -lift); ctx.rotate(tilt);
    const amp = moving ? (run ? 15 : 9) : 0;
    const legPts = (hx, hy, k, back) => {
      const ph = walk + k * Math.PI, swing = Math.cos(ph) * amp * (run ? 1.3 : 1), up = moving ? Math.max(0, Math.sin(ph)) * (run ? 9 : 5) : 0;
      let px = hx + swing, py = hy + legL - up;
      if (sit && back) return [[hx, hy], [hx - 6, hy + legL * .55], [hx + 10, hy + legL * .62]];
      if (lie || curl) return [[hx, hy], [hx + (back ? -4 : 8), hy + legL * .32], [hx + (back ? 6 : 16), hy + legL * .36]];
      if (pounce > 0) { px += back ? -pounce * 10 : pounce * 12; py -= back ? 0 : pounce * 8; }
      if (bow > 0 && !back) { py = hy + legL * .55; px = hx + 8; }
      if (swim) { py = hy + legL * .6 + Math.sin(ph) * 5; px = hx + Math.cos(ph) * 6; }
      const kx = back ? hx - 5 + swing * .4 : hx + 2 + swing * .5, ky = hy + legL * (back ? .5 : .55) - up * .5;
      return [[hx, hy], [kx, ky], [px, py]];
    };
    /* the tail */
    {
      const wag = (o.wag || 0) * Math.sin(walk * 2.2 + (o.t || 0) * 14) * .6, tuck = o.tuck || 0;
      ctx.save();
      if (curl) { ctx.translate(hipX - 8, bodyRy * .55); ctx.rotate(.12); ctx.scale(1.25, 1); }
      else {
        let a = tuck ? 1.3 : (o.tailUp || 0) > 0 ? -1.1 : (moving ? .35 : .55);
        a += wag;
        ctx.translate(hipX - hipR * .7, -bodyRy * .45); ctx.rotate(Math.PI - a); ctx.scale(1, -1);
      }
      put(ctx, Pt.tail); ctx.restore();
    }
    /* far legs, torso, near legs */
    legDraw(ctx, Pt, legPts(hipX + 2, 6, 1, true).map(([x, y]) => [x + 4, y]), true, true, legL);
    legDraw(ctx, Pt, legPts(6, 8, 0, false).map(([x, y]) => [x + 4, y]), false, true, legL);
    put(ctx, Pt.torso);
    if (o.snow > 0) { ctx.fillStyle = `rgba(255,255,255,${.6 * o.snow})`; ctx.beginPath(); ctx.moveTo(chR * .1, -bodyRy - 1); ctx.quadraticCurveTo(-8, -bodyRy - 5, hipX - hipR * .4, -bodyRy * .95); ctx.quadraticCurveTo(-8, -bodyRy + 1, chR * .1, -bodyRy - 1); ctx.fill(); }
    if (o.wet > 0) { ctx.fillStyle = `rgba(170,210,235,${.55 * o.wet})`; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(hipX + k * 11, bodyRy * .8 + 2 + (k % 2) * 2, .9, 2, 0, 0, TAU); ctx.fill(); } }
    legDraw(ctx, Pt, legPts(hipX + 2, 6, 0, true), true, false, legL);
    legDraw(ctx, Pt, legPts(6, 8, 1, false), false, false, legL);
    /* neck and head */
    const headA = -howl * 1.15 + pounce * .25 - bow * .15 + (lie && !curl ? .35 : 0) + (curl ? .9 : 0) + (o.sniff || 0) * .55 + (swim ? -.25 : 0);
    const nx = chR * .55, ny = -bodyRy * .55;
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(headA);
    if (curl) ctx.translate(-8, 10);
    const mouthOpen = howl * .5 + (o.pant || 0) * .35 + (o.carry ? .25 : 0);
    const r = headR, hx = Pt.hx, hy = Pt.hy;
    /* the mouth's inside, then the jaw, then the head over it */
    if (mouthOpen > .05) {
      ctx.fillStyle = '#2a1212'; ctx.beginPath(); ctx.moveTo(Pt.jx, Pt.jy - 1); ctx.lineTo(hx + r * .4 + muz - 1, hy + r * .1); ctx.lineTo(Pt.jx + muz * .9 * Math.cos(mouthOpen * .6), Pt.jy + muz * .9 * Math.sin(mouthOpen * .6)); ctx.closePath(); ctx.fill();
      if (o.pant) { ctx.fillStyle = '#e9788a'; ctx.beginPath(); ctx.ellipse(Pt.jx + muz * .7, Pt.jy + muz * .5 * Math.sin(mouthOpen * .6) + 1.5, 3.4, 1.6, mouthOpen * .6, 0, TAU); ctx.fill(); }
    }
    ctx.save(); ctx.translate(Pt.jx, Pt.jy); ctx.rotate(mouthOpen * .6); put(ctx, Pt.jaw); ctx.restore();
    put(ctx, Pt.head);
    /* the eye: almond, amber (blue for a pup), lined in black; shut for a newborn or a sleeper */
    const ex = hx + r * .4, ey = hy - r * .3, eyeCol = ageIn < .55 ? mixHex(FORMS[form].pupEye, FORMS[form].eye, smoothstep(.25, .55, ageIn)) : FORMS[form].eye;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(-.12);
    if (eyes > .2) {
      const ew = lerp(3.3, 3.1, ageIn), eh = lerp(2.6, 1.9, ageIn) * eyes;
      ctx.fillStyle = '#0e0a08'; ctx.beginPath(); ctx.ellipse(0, 0, ew + .7, eh + .6, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, ew, eh, 0, 0, TAU); ctx.clip();
      const ig = ctx.createRadialGradient(.4, .2, .2, .4, 0, ew); ig.addColorStop(0, eyeCol); ig.addColorStop(1, shade(eyeCol.startsWith('#') ? eyeCol : '#e0a428', .55));
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(.5, 0, ew * .85, 0, TAU); ctx.fill();
      ctx.fillStyle = '#050403'; ctx.beginPath(); ctx.arc(.7, 0, ew * .32, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(-.3, -eh * .35, .55, 0, TAU); ctx.fill();
    } else { ctx.strokeStyle = '#120e0c'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(0, 1.4, 3, 0); ctx.stroke(); }
    ctx.restore();
    if (o.carry === 'meal') { ctx.save(); ctx.translate(hx + r * .4 + muz + 2, hy + r * .3); Sprites.drawMeal(ctx, .55); ctx.restore(); }
    else if (o.carry === 'pup') { ctx.save(); ctx.translate(hx + r * .4 + muz + 4, hy + r * .55); ctx.rotate(.4); ctx.scale(.3, .3); drawWolf(ctx, { form: o.carryForm || o.form, age: .02, lie: true, eyes: 0 }); ctx.restore(); }
    ctx.restore();
    if (o.collar) { ctx.save(); ctx.translate(nx + neckL * .55, ny - neckL * .2); ctx.rotate(headA * .5 - .4); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.ellipse(0, 0, 5, 8.5, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#4a4a52'; ctx.fillRect(-3, 6, 6, 4); ctx.restore(); }
    ctx.restore();
  }
  /* ============================================================
     PAINTED TREES: conifers of drooping needle sprays, aspens of
     leaf dabs on white bark, willow thickets.  Painted once per
     shape (height in 20-unit steps × 4 variants × season × snow)
     and shared by every tree of that shape; the wind shears them.
     ============================================================ */
  const TRES = 2.2, treeCache = new Map();
  const LEAVES = { spring: [[150, 200, 92], [120, 178, 70], [178, 214, 112]], summer: [[92, 150, 64], [70, 130, 52], [118, 168, 78]], autumn: [[236, 184, 44], [222, 150, 30], [246, 206, 80]], winter: null };
  function bakeT(x0, y0, x1, y1, paint) {
    const t0 = performance.now();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0) * TRES)); c.height = Math.max(1, Math.ceil((y1 - y0) * TRES));
    const g = c.getContext('2d', SOFT); g.setTransform(TRES, 0, 0, TRES, -x0 * TRES, -y0 * TRES); g.lineCap = 'round'; g.lineJoin = 'round';
    paint(g);
    stat.n++; stat.ms += performance.now() - t0; stat.trees++;
    return { c, x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  function bark(g, R, x0, x1, top, bot, w0, w1, light, dark) {
    g.fillStyle = css(mix(light, dark, .45));
    g.beginPath(); g.moveTo(-w0 / 2, bot); g.lineTo(-w1 / 2, top); g.lineTo(w1 / 2, top); g.lineTo(w0 / 2, bot); g.closePath(); g.fill();
    for (let i = 0; i < (bot - top) * 2.5; i++) {
      const y = lerp(top, bot, R()), ww = lerp(w1, w0, (y - top) / (bot - top)), x = (R() - .5) * ww * .9;
      g.strokeStyle = css(R() < .5 ? light : dark, .5 + R() * .4); g.lineWidth = .4 + R() * .6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * .6, y + 1.5 + R() * 3); g.stroke();
    }
    const sg = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0); sg.addColorStop(0, 'rgba(255,245,225,.15)'); sg.addColorStop(.6, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = sg; g.beginPath(); g.moveTo(-w0 / 2, bot); g.lineTo(-w1 / 2, top); g.lineTo(w1 / 2, top); g.lineTo(w0 / 2, bot); g.closePath(); g.fill();
  }
  function conifer(h, w, seed, snow, big) {
    const R = mulberry32(seed), half = w * .5;
    return bakeT(-half - 8, -h - 8, half + 8, 8, (g) => {
      bark(g, R, 0, 0, -h * .92, 4, big ? 11 : 6, 1.5, [128, 96, 70], [58, 40, 26]);
      const levels = Math.round(h / (big ? 3.6 : 5));
      for (let L = 0; L < levels; L++) {
        const u = L / levels, y = -h * (.1 + u * .88);
        const reach = half * Math.pow(1 - u, .85) * (.75 + R() * .5) + 3;
        for (const side of [-1, 1]) {
          const len = reach * (.8 + R() * .3), droop = len * (.25 + R() * .15), tx = side * len, ty = y + droop;
          /* the branch, then its sprays of needles, darker beneath and lit on top */
          g.strokeStyle = 'rgba(58,40,26,.8)'; g.lineWidth = lerp(1.6, .6, u);
          g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(tx * .5, y - droop * .2, tx, ty); g.stroke();
          const n = Math.round(len * (big ? 3.2 : 2.6));
          for (let i = 0; i < n; i++) {
            const t = R(), bx = tx * t, by = y + (ty - y) * t * t - droop * .2 * t * (1 - t) * 4 + (R() - .5) * 4;
            const under = R() < .45, nl = 2.2 + R() * 2.4, a = (side > 0 ? .5 : Math.PI - .5) + (R() - .5) * 1.2 + (under ? .6 * side : -.2 * side);
            const col = under ? mix([22, 52, 34], [16, 38, 26], R()) : mix([44, 92, 54], [70, 124, 70], R() * (1 - u * .3) + (R() < .15 ? .6 : 0));
            g.strokeStyle = css(col, .9); g.lineWidth = .7 + R() * .5;
            g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * nl, by + Math.abs(Math.sin(a)) * nl * (under ? 1 : .5)); g.stroke();
          }
          if (snow > 0) {
            g.fillStyle = `rgba(246,250,255,${.9 * snow})`;
            for (let i = 0; i < len * .5; i++) { const t = R(); g.beginPath(); g.ellipse(tx * t, y + (ty - y) * t * t - 1.5, 1.5 + R() * 2.2, .9 + R() * .8, side * .3, 0, TAU); g.fill(); }
          }
        }
      }
      /* the leader at the top */
      g.strokeStyle = css([40, 84, 50]); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -h * .9); g.lineTo(0, -h - 4); g.stroke();
      for (let i = 0; i < 14; i++) { const y = -h + R() * 10 - 4; g.strokeStyle = css(mix([40, 84, 50], [70, 124, 70], R()), .9); g.lineWidth = .7; g.beginPath(); g.moveTo(0, y); g.lineTo((R() - .5) * 6, y + 2 + R() * 2); g.stroke(); }
    });
  }
  function aspen(h, wTrunk, seed, season) {
    const R = mulberry32(seed), cols = LEAVES[season], cw = 22 + h * .15;
    return bakeT(-cw - 6, -h - cw * .9, cw + 6, 8, (g) => {
      /* white bark, dark "eyes", a rough dark base */
      const tw = wTrunk * 1.1;
      g.fillStyle = '#e6e2d4'; g.beginPath(); g.moveTo(-tw * .6, 4); g.lineTo(-tw * .28, -h); g.lineTo(tw * .28, -h); g.lineTo(tw * .6, 4); g.closePath(); g.fill();
      const sg = g.createLinearGradient(-tw * .6, 0, tw * .6, 0); sg.addColorStop(0, 'rgba(255,255,250,.3)'); sg.addColorStop(.55, 'rgba(160,170,150,.1)'); sg.addColorStop(1, 'rgba(70,80,70,.45)');
      g.fillStyle = sg; g.fill();
      for (let i = 0; i < h * .18; i++) { const y = -R() * h * .95, ww = lerp(tw * .55, tw * .28, -y / h); g.fillStyle = `rgba(30,26,22,${.5 + R() * .4})`; g.beginPath(); g.ellipse((R() - .5) * ww, y, .6 + R() * 1.4, .35 + R() * .5, (R() - .5) * .4, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(60,52,44,.55)'; for (let i = 0; i < 40; i++) { const y = -R() * h * .12; g.fillRect((R() - .5) * tw * 1.1, y, .5 + R(), 1 + R() * 2); }
      /* branches into the crown */
      g.strokeStyle = '#d8d4c6'; g.lineWidth = 1.2;
      const cy = -h - cw * .1;
      const tips = [];
      for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (R() - .5) * 2.4, y0 = -h * (.62 + R() * .3), L = cw * (.5 + R() * .45), x1 = Math.cos(a) * L, y1 = y0 + Math.sin(a) * L * .7; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(x1 * .4, y0 + (y1 - y0) * .7, x1, y1); g.stroke(); tips.push([x1, y1]); }
      if (!cols) {
        /* winter: fine bare twigs */
        g.strokeStyle = 'rgba(200,196,184,.85)'; g.lineWidth = .5;
        for (const [x, y] of tips) for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (R() - .5) * 2.6, L = 4 + R() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
        return;
      }
      /* the crown: clusters of leaves round the twig tips, the back ones in shade, a few gaps */
      for (const pass of [0, 1, 2]) {
        for (const [x, y] of tips.concat([[0, cy], [-cw * .4, cy + cw * .2], [cw * .4, cy + cw * .15]])) {
          const n = pass === 2 ? 45 : 60;
          for (let i = 0; i < n; i++) {
            const a = R() * TAU, d = Math.sqrt(R()) * cw * .38, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * .8;
            let c = cols[(R() * 3) | 0];
            const lit = clamp(.5 - (ly - (cy - cw * .4)) / (cw * 1.6) - lx / (cw * 3), 0, 1);
            c = pass === 0 ? mix(c, [26, 30, 14], .55) : pass === 1 ? mix(c, [60, 50, 20], .22 * R()) : mix(c, [255, 250, 220], lit * .5);
            g.fillStyle = css(c, .95);
            g.beginPath(); g.ellipse(lx, ly, 1.7 + R() * 1.2, 1.1 + R() * .7, R() * TAU, 0, TAU); g.fill();
          }
        }
      }
    });
  }
  function willow(h, wStem, seed, season) {
    const R = mulberry32(seed), cols = LEAVES[season] ? [[138, 170, 92], [112, 150, 74], [160, 186, 112]].map(c => season === 'autumn' ? mix(c, [214, 182, 70], .6) : c) : null;
    return bakeT(-h * .5 - 10, -h - 16, h * .5 + 10, 6, (g) => {
      const tips = [];
      for (let k = -3; k <= 3; k++) { const x1 = k * h * .08 + (R() - .5) * 8, y1 = -h * (.75 + R() * .25); g.strokeStyle = css(mix([110, 70, 50], [150, 96, 60], R())); g.lineWidth = wStem * .5; g.beginPath(); g.moveTo(k * 1.2, 4); g.quadraticCurveTo(k * 3, -h * .5, x1, y1); g.stroke(); tips.push([x1, y1]); for (let j = 0; j < 4; j++) tips.push([lerp(k * 3, x1, .5 + R() * .5), lerp(-h * .4, y1, .5 + R() * .5)]); }
      if (!cols) return;
      for (const [x, y] of tips) for (let i = 0; i < 26; i++) { const a = R() * TAU, d = R() * 9; g.strokeStyle = css(mix(cols[(R() * 3) | 0], [30, 40, 20], R() * .4), .9); g.lineWidth = .9; const lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + Math.cos(a + .4) * 3.2, ly + Math.sin(a + .4) * 3.2 + 1); g.stroke(); }
    });
  }
  function drawTree(ctx, T, season, time, wind) {
    const hq = Math.max(40, Math.round(T.h / 20) * 20), v = (T.seed >>> 0) % 4, snow = T.snow > .5 ? 1 : T.snow > .05 ? .5 : 0;
    const key = `${T.kind}|${hq}|${v}|${T.kind === 'pine' || T.kind === 'bigtree' ? snow : season}|${Math.round(T.w)}`;
    let img = treeCache.get(key);
    if (!img) {
      if (!canBake()) return false;
      const t0 = performance.now();
      const seed = 1000 + v * 7919 + hq;
      img = T.kind === 'aspen' ? aspen(hq, T.w, seed, season) : T.kind === 'willow' ? willow(hq, T.w, seed, season)
        : conifer(hq, T.kind === 'bigtree' ? 92 : 36 + T.w * 2.4, seed, snow, T.kind === 'bigtree');
      treeCache.set(key, img); spent(t0);
    }
    const sw = Math.sin(time * .7 + T.seed) * (.012 + wind * .035);
    ctx.save(); ctx.translate(T.x, T.y);
    ctx.transform(1, 0, sw + (T.lean || 0), 1, 0, 0);
    if ((T.seed >>> 3) & 1) ctx.scale(-1, 1);
    put(ctx, img);
    ctx.restore();
    return true;
  }
  /* ============================================================
     PAINTED ELK, BISON AND RAVENS: the same frames and joints as
     the classic sprites (elk hooves at y = +58, bison at +50), the
     body painted once, the legs placed on their bones each frame
     ============================================================ */
  const herdCache = new Map();
  /* a sleek coat: smooth paint, then a fine low-contrast grain of short hairs (elk, not wolves) */
  function sleek(g, path, box, R, n, flow, colour, len, w) {
    g.save(); g.clip(path);
    for (let i = 0; i < n; i++) {
      const x = lerp(box[0], box[2], R()), y = lerp(box[1], box[3], R()), [dx, dy] = flow(x, y), d = Math.hypot(dx, dy) || 1;
      const c = mix(colour(x, y), R() < .5 ? [255, 240, 214] : [30, 18, 8], .12 + R() * .12);
      g.fillStyle = css(c, .22 + R() * .2); hair(g, x, y, dx / d, dy / d, len * (.6 + R() * .7), w, (R() - .5) * .4);
    }
    g.restore();
  }
  function legBake(len, w0, w1, cTop, cBot, R, hl, hw, hoof, shag, smooth) {
    const p = new Path2D();
    p.moveTo(-w0 / 2, 0); p.quadraticCurveTo(-w0 * .6, len * .45, -w1 / 2, len); p.quadraticCurveTo(0, len + w1 * .7, w1 / 2, len);
    p.quadraticCurveTo(w0 * .55, len * .4, w0 / 2, 0); p.quadraticCurveTo(0, -w0 * .35, -w0 / 2, 0); p.closePath();
    const box = [-w0 - 4 - (shag || 0), -w0 * .5 - 3, w0 + 4 + (shag || 0), len + w1 + 5];
    const col = (x, y) => mix(cTop, cBot, clamp(y / len, 0, 1)); col.tip = mix(cTop, [240, 230, 210], .3); col.dark = [20, 14, 10];
    return bake(box[0], box[1], box[2], box[3], (g, inside) => {
      if (smooth) {
        const lg = g.createLinearGradient(0, 0, 0, len); lg.addColorStop(0, css(cTop)); lg.addColorStop(.55, css(mix(cTop, cBot, .7))); lg.addColorStop(1, css(cBot)); g.fillStyle = lg; g.fill(p);
        const sg = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0); sg.addColorStop(0, 'rgba(255,240,215,.16)'); sg.addColorStop(.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(10,6,2,.3)'); g.fillStyle = sg; g.fill(p);
        sleek(g, p, box, R, Math.round(len * w0 * .9), () => [-.05, 1], col, 2, .22);
      } else {
        g.fillStyle = css(mix(cTop, cBot, .5)); g.fill(p);
        coat(g, inside, p, box, R, Math.round(len * w0 * 1.6), () => [-.1, 1], col, { len: hl * (shag ? 2.2 : 1), w: hw });
      }
      if (hoof) { g.fillStyle = css(hoof); g.beginPath(); g.moveTo(-w1 * .6, len - 1); g.lineTo(w1 * .7, len - 1); g.lineTo(w1 * .9, len + w1 * .55); g.lineTo(-w1 * .6, len + w1 * .55); g.closePath(); g.fill(); }
      volume(g, p, box, { top: .05, bottom: .15 });
      g.save(); g.globalCompositeOperation = 'destination-in';
      const fg = g.createLinearGradient(0, -w0 * .5, 0, len * .25); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(.5, 'rgba(0,0,0,1)');
      g.fillStyle = fg; g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]); g.restore();
    });
  }
  function elkParts(bull) {
    const key = 'elk' + (bull ? 1 : 0); let E = herdCache.get(key); if (E) return E;
    const R = mulberry32(bull ? 41 : 43), tan = [164, 136, 100], brown = [74, 48, 30], pale = [226, 206, 168], dark = [40, 26, 16];
    E = {};
    /* the body: withers a touch higher than the croup, a deep chest, the flank tucked up before the hind leg */
    const body = new Path2D();
    body.moveTo(28, -25); body.bezierCurveTo(14, -28, -12, -24, -30, -23);       /* withers, back, croup */
    body.bezierCurveTo(-40, -22, -46, -18, -49, -10);                              /* the rump slopes to the tail */
    body.bezierCurveTo(-52, -2, -51, 8, -46, 16);                                  /* the buttock */
    body.bezierCurveTo(-42, 22, -34, 23, -30, 18);                                 /* the hind thigh, lowest here */
    body.bezierCurveTo(-26, 12, -20, 13, -12, 17);                                 /* the flank tucks up */
    body.bezierCurveTo(0, 21, 14, 25, 24, 22);                                     /* belly and deep chest */
    body.bezierCurveTo(33, 19, 38, 8, 36, -6); body.bezierCurveTo(35, -16, 33, -22, 28, -25); body.closePath();
    const bbox = [-56, -34, 42, 28];
    const bcol = (x, y) => { let c = tan; c = mix(c, brown, smoothstep(6, 20, y) * .55); c = mix(c, mix(brown, dark, .3), smoothstep(16, 32, x) * .9); return c; };
    E.body = bake(bbox[0], bbox[1], bbox[2], bbox[3], (g) => {
      const lg = g.createLinearGradient(0, -26, 0, 22); lg.addColorStop(0, css(mix(tan, [236, 214, 170], .25))); lg.addColorStop(.45, css(tan)); lg.addColorStop(.8, css(mix(tan, brown, .45))); lg.addColorStop(1, css(mix(tan, brown, .75)));
      g.fillStyle = lg; g.fill(body);
      g.save(); g.clip(body);
      /* the dark chest and shoulder running into the neck */
      const fg = g.createLinearGradient(14, 0, 34, 0); fg.addColorStop(0, 'rgba(74,48,30,0)'); fg.addColorStop(1, css(mix(brown, dark, .2), .95)); g.fillStyle = fg; g.fillRect(10, -30, 30, 56);
      /* the pale rump patch with its dark edge */
      const rg = g.createRadialGradient(-53, -8, 1, -51, -6, 10); rg.addColorStop(0, css(pale)); rg.addColorStop(.5, css(pale, .8)); rg.addColorStop(1, css(pale, 0));
      g.fillStyle = rg; g.beginPath(); g.ellipse(-50, -6, 6.5, 12, .1, 0, TAU); g.fill();
      /* the darker belly line and the crease behind the elbow */
      g.strokeStyle = 'rgba(50,30,14,.25)'; g.lineWidth = 2.5; g.filter = 'blur(1px)'; g.beginPath(); g.moveTo(-14, 16); g.quadraticCurveTo(4, 21, 20, 20); g.stroke(); g.beginPath(); g.moveTo(14, 18); g.quadraticCurveTo(12, 6, 16, -2); g.stroke(); g.filter = 'none';
      g.fillStyle = css(dark, .9); g.beginPath(); g.ellipse(-49.5, -12, 2, 4.5, .3, 0, TAU); g.fill();              /* the short dark tail */
      /* muscle: the shoulder blade and the round of the haunch catch the light */
      for (const [x, y, rx, ry] of [[20, -8, 10, 13], [-30, -6, 13, 14]]) { const mg = g.createRadialGradient(x - 3, y - 5, 1, x, y, Math.max(rx, ry)); mg.addColorStop(0, 'rgba(255,240,210,.18)'); mg.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = mg; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(40,24,10,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-22, 14); g.quadraticCurveTo(-20, -4, -30, -14); g.stroke();
      g.restore();
      sleek(g, body, bbox, R, 2600, (x, y) => [-1, .1 + (y > 6 ? .3 : 0)], bcol, 2.4, .26);
      volume(g, body, bbox, { top: .12, bottom: .3 });
    });
    /* the neck with its dark mane, the long head, ears, and a bull's antlers */
    const neck = new Path2D(); neck.moveTo(14, -24); neck.quadraticCurveTo(36, -40, 47, -58); neck.lineTo(63, -47); neck.quadraticCurveTo(55, -20, 40, 8); neck.quadraticCurveTo(26, 10, 14, -24); neck.closePath();
    const head = new Path2D(); head.moveTo(48, -60); head.quadraticCurveTo(56, -64, 64, -56); head.quadraticCurveTo(72, -50, 75, -46); head.quadraticCurveTo(74, -41, 68, -42); head.quadraticCurveTo(58, -44, 50, -48); head.quadraticCurveTo(46, -54, 48, -60); head.closePath();
    const hbox = [14, -112, 82, 6];
    E.head = bake(hbox[0], hbox[1], hbox[2], hbox[3], (g, inside) => {
      const mane = (x, y) => mix(brown, dark, R() * .4); mane.tip = [130, 96, 66]; mane.dark = [30, 20, 12];
      g.fillStyle = css(brown); g.fill(neck); coat(g, inside, neck, hbox, R, 900, (x, y) => [-.3, 1], mane, { len: bull ? 4.5 : 3.2, w: .55 }); volume(g, neck, hbox, { top: .05, bottom: .2 });
      const hc = (x, y) => mix(mix(tan, brown, .45), dark, smoothstep(66, 74, x) * .6); hc.tip = [200, 170, 130]; hc.dark = [40, 28, 18];
      g.fillStyle = css(mix(tan, brown, .4)); g.fill(head); coat(g, inside, head, hbox, R, 400, () => [-1, -.2], hc, { len: 1.8, w: .4 }); volume(g, head, hbox, { top: .12, bottom: .15 });
      g.fillStyle = '#120c08'; g.beginPath(); g.ellipse(73.5, -45, 1.4, 1.1, 0, 0, TAU); g.fill();
      g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(59, -56, 1.6, 1.3, -.3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(58.6, -56.4, .45, 0, TAU); g.fill();
      for (const [ex, ey, a] of [[50, -60, -2.3], [53, -61, -2.0]]) { const e = new Path2D(); e.moveTo(ex, ey); e.quadraticCurveTo(ex + Math.cos(a) * 6 - 2, ey + Math.sin(a) * 6, ex + Math.cos(a) * 10, ey + Math.sin(a) * 10); e.quadraticCurveTo(ex + Math.cos(a) * 5 + 3, ey + Math.sin(a) * 5 + 1, ex + 3, ey + 1); e.closePath(); g.fillStyle = css(mix(tan, brown, .3)); g.fill(e); g.strokeStyle = css(dark, .5); g.lineWidth = .4; g.stroke(e); }
      if (bull) {
        const beam = (pts, w) => { for (let i = 1; i < pts.length; i++) { const t = i / pts.length; g.strokeStyle = css(mix([120, 96, 70], [236, 226, 206], t * t)); g.lineWidth = lerp(w, w * .45, t); g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); } };
        for (const side of [0, 1]) {
          const o = side * 3, main = []; for (let i = 0; i <= 10; i++) { const t = i / 10; main.push([52 - o - t * 26 + Math.sin(t * 3) * 3, -60 - t * 46 + t * t * 6]); }
          beam(main, 2.6 - side * .4);
          for (const [t, len, a] of [[.12, 12, -.4], [.3, 13, -.7], [.5, 12, -.9], [.72, 10, -1.2]]) { const i = Math.round(t * 10), [bx, by] = main[i]; beam([[bx, by], [bx + Math.cos(a) * len * .5, by + Math.sin(a) * len * .5], [bx + Math.cos(a - .2) * len, by + Math.sin(a - .2) * len]], 1.6 - side * .3); }
        }
      }
    });
    E.upB = legBake(30, 19, 6, mix(tan, brown, .55), mix(brown, dark, .2), R, 1.4, .5, null, 0, true); E.upF = legBake(30, 13, 6, mix(brown, dark, .25), mix(brown, dark, .4), R, 1.4, .5, null, 0, true); E.low = legBake(28, 6, 4.2, mix(brown, dark, .45), mix(dark, [20, 14, 10], .4), R, 1.1, .4, [24, 18, 14], 0, true);
    E.upBFar = darker(E.upB, .3); E.upFFar = darker(E.upF, .3); E.lowFar = darker(E.low, .3);
    herdCache.set(key, E); return E;
  }
  function drawElk(ctx, o) {
    if (!herdCache.has('elk' + (o.bull ? 1 : 0)) && !canBake()) return Sprites.drawElk(ctx, o);
    const t0 = performance.now(), had = herdCache.has('elk' + (o.bull ? 1 : 0));
    const s = o.s || 1, ph = o.ph || 0, moving = Math.abs(o.vx || 0) > 5, E = elkParts(!!o.bull);
    if (!had) spent(t0);
    ctx.save(); ctx.scale(s, s);
    const amp = moving ? 16 : 0;
    const legs = (k, hx, hy) => { const sw = Math.cos(ph + k * Math.PI) * amp, up = moving ? Math.max(0, Math.sin(ph + k * Math.PI)) * 8 : 0; return [[hx, hy], [hx + sw * .4 - 2, hy + 30 - up * .5], [hx + sw, hy + 58 - up]]; };
    const sh = ctx.createRadialGradient(-6, 60, 1, -6, 60, 52); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, 60); ctx.scale(1, .14); ctx.translate(0, -60); ctx.fillStyle = sh; ctx.fillRect(-60, 8, 120, 104); ctx.restore();
    /* all four legs go under the body, so each one grows out of it rather than sitting on it */
    for (const [k, hx, hy, far] of [[1, -30, 2, true], [0, 20, 4, true], [0, -30, 2, false], [1, 20, 4, false]]) {
      const p = legs(k, hx + (far ? 5 : 0), hy);
      const up = hx < 0 ? (far ? E.upBFar : E.upB) : (far ? E.upFFar : E.upF);
      bone(ctx, far ? E.lowFar : E.low, p[1], p[2], 28); bone(ctx, up, [p[0][0], p[0][1] - 8], p[1], 30);
    }
    put(ctx, E.body);
    put(ctx, E.head);
    ctx.restore();
  }
  function bisonParts() {
    let B = herdCache.get('bison'); if (B) return B;
    const R = mulberry32(53), brown = [96, 66, 40], dark = [44, 30, 18], shag = [128, 92, 56], black = [24, 18, 12];
    B = {};
    const body = new Path2D(); body.moveTo(30, -10); body.bezierCurveTo(28, -34, 10, -46, -6, -42); body.bezierCurveTo(-26, -40, -46, -22, -50, -6); body.bezierCurveTo(-54, 10, -36, 20, -20, 20); body.lineTo(24, 20); body.bezierCurveTo(36, 18, 38, 4, 30, -10); body.closePath();
    const head = new Path2D(); head.ellipse(41, -2, 17, 15, .3, 0, TAU);
    const muzzle = new Path2D(); muzzle.ellipse(53, 6, 9, 7.5, .3, 0, TAU);
    const box = [-60, -56, 66, 32];
    B.body = bake(box[0], box[1], box[2], box[3], (g, inside) => {
      const c = (x, y) => { let k = mix(brown, shag, smoothstep(-10, 10, x) * smoothstep(5, -30, y)); k = mix(k, dark, smoothstep(0, 18, y) * .6); return mix(k, dark, smoothstep(-20, -45, x) * .3); }; c.tip = [170, 130, 84]; c.dark = black;
      g.fillStyle = css(brown); g.fill(body);
      coat(g, inside, body, box, R, 2400, (x, y) => x > -6 ? [-.4, 1] : [-1, .3], c, { len: 3, w: .6 });
      /* the long woolly cape over the hump and shoulders */
      const cape = new Path2D(); cape.moveTo(30, -10); cape.bezierCurveTo(28, -34, 10, -48, -8, -44); cape.quadraticCurveTo(-14, -10, -2, 22); cape.lineTo(28, 22); cape.closePath();
      coat(g, inside, cape, box, R, 900, () => [-.2, 1], c, { len: 6.5, w: .9 });
      volume(g, body, box, { top: .12, bottom: .25 });
      const hc = (x, y) => mix(dark, brown, R() * .5); hc.tip = [120, 90, 60]; hc.dark = black;
      g.fillStyle = css(dark); g.fill(head); coat(g, inside, head, box, R, 700, () => [-.3, 1], hc, { len: 4, w: .7 });
      g.fillStyle = css(mix(dark, black, .4)); g.fill(muzzle); coat(g, inside, muzzle, box, R, 160, () => [.6, .8], hc, { len: 1.6, w: .45 });
      /* the beard */
      for (let i = 0; i < 120; i++) { const x = 34 + R() * 16, y = 12 + R() * 6; g.fillStyle = css(mix(dark, shag, R() * .4), .9); hair(g, x, y, -.15, 1, 5 + R() * 6, .6, (R() - .5) * 2); }
      g.strokeStyle = '#e4dccb'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(37, -13); g.quadraticCurveTo(30, -24, 36, -29); g.stroke();
      g.strokeStyle = '#2a2420'; g.lineWidth = 1; g.beginPath(); g.moveTo(35.8, -27.5); g.lineTo(36, -29); g.stroke();
      g.fillStyle = '#080604'; g.beginPath(); g.ellipse(47, -7, 1.9, 1.5, .2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(46.5, -7.5, .5, 0, TAU); g.fill();
      g.fillStyle = '#0a0806'; g.beginPath(); g.ellipse(59, 6, 1.5, 1.2, .3, 0, TAU); g.fill();
    });
    B.up = legBake(24, 11, 7, brown, dark, R, 2, .55, null, 3); B.low = legBake(22, 7, 5.5, dark, dark, R, 1.6, .5, [16, 12, 8]);
    B.upFar = darker(B.up, .3); B.lowFar = darker(B.low, .3);
    herdCache.set('bison', B); return B;
  }
  function drawBison(ctx, o) {
    if (!herdCache.has('bison') && !canBake()) return Sprites.drawBison(ctx, o);
    const t0 = performance.now(), had = herdCache.has('bison');
    const s = o.s || 1, ph = o.ph || 0, moving = Math.abs(o.vx || 0) > 5, B = bisonParts();
    if (!had) spent(t0);
    ctx.save(); ctx.scale(s, s);
    const amp = moving ? 12 : 0;
    const sh = ctx.createRadialGradient(0, 52, 1, 0, 52, 60); sh.addColorStop(0, 'rgba(0,0,0,.32)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, 52); ctx.scale(1, .14); ctx.translate(0, -52); ctx.fillStyle = sh; ctx.fillRect(-60, -8, 120, 120); ctx.restore();
    const legPts = (k, hx, far) => { const sw = Math.cos(ph + k * Math.PI) * amp, up = moving ? Math.max(0, Math.sin(ph + k * Math.PI)) * 6 : 0, x = hx + (far ? 5 : 0); return [[x, 8], [x + sw * .4, 30 - up * .5], [x + sw, 50 - up]]; };
    for (const [k, hx, far] of [[1, -34, true], [0, 18, true]]) { const p = legPts(k, hx, far); bone(ctx, B.lowFar, p[1], p[2], 22); bone(ctx, B.upFar, p[0], p[1], 24); }
    for (const [k, hx] of [[0, -34], [1, 18]]) { const p = legPts(k, hx, false); bone(ctx, B.low, p[1], p[2], 22); bone(ctx, B.up, p[0], p[1], 24); }
    put(ctx, B.body);
    ctx.restore();
  }
  function ravenPart() {
    let P = herdCache.get('raven'); if (P) return P;
    const R = mulberry32(61), body = new Path2D();
    body.ellipse(-2, -7, 11, 6, -.2, 0, TAU); body.moveTo(-10, -6); body.lineTo(-23, -3); body.lineTo(-21, .5); body.lineTo(-8, -3); body.closePath(); body.moveTo(12.5, -14); body.arc(8, -14, 4.8, 0, TAU);
    const box = [-26, -22, 24, 3];
    P = bake(box[0], box[1], box[2], box[3], (g, inside) => {
      g.fillStyle = '#121016'; g.fill(body);
      const c = () => mix([20, 18, 26], [56, 54, 92], R() * R()); c.tip = [80, 86, 130]; c.dark = [6, 6, 8];
      coat(g, inside, body, box, R, 500, (x) => [-1, .15], c, { len: 2.6, w: .5 });
      g.fillStyle = '#16141a'; g.beginPath(); g.moveTo(11, -15.5); g.quadraticCurveTo(17, -15, 21, -12); g.lineTo(11, -11); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,130,170,.35)'; g.lineWidth = .4; g.beginPath(); g.moveTo(12, -14.6); g.quadraticCurveTo(17, -14.4, 20.5, -12.2); g.stroke();
      g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(9, -15, 1.1, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(8.7, -15.3, .35, 0, TAU); g.fill();
      g.strokeStyle = '#1a1a22'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -2); g.lineTo(1, 1); g.moveTo(4, -2); g.lineTo(5, 1); g.stroke();
    });
    herdCache.set('raven', P); return P;
  }
  function drawRaven(ctx, o) {
    if (!herdCache.has('raven')) { if (!canBake()) return Sprites.drawRaven(ctx, o); const t0 = performance.now(); ravenPart(); spent(t0); }
    ctx.save(); ctx.scale(o.s || 1, o.s || 1); ctx.translate(0, -(o.hop || 0) * 6); put(ctx, ravenPart()); ctx.restore();
  }
  /* the wolf biologist: a quilted parka, field trousers, boots, a knitted hat, a real face; one arm waves */
  function bioParts() {
    let B = herdCache.get('bio'); if (B) return B;
    const R = mulberry32(71), parka = [196, 74, 44], parkaD = [120, 38, 24], trou = [62, 72, 58], skin = [214, 168, 132], hair = [86, 56, 38], hat = [70, 116, 168];
    B = {};
    const cloth = (g, path, box, base, deep, n, flow, len) => {
      g.fillStyle = css(base); g.fill(path);
      g.save(); g.clip(path);
      for (let i = 0; i < n; i++) { const x = lerp(box[0], box[2], R()), y = lerp(box[1], box[3], R()), [dx, dy] = flow; g.strokeStyle = css(mix(base, R() < .5 ? deep : [255, 230, 210], R() * .35), .35); g.lineWidth = .5 + R() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * len * (.5 + R()), y + dy * len * (.5 + R())); g.stroke(); }
      g.restore();
    };
    const box = [-24, -116, 44, 4];
    B.body = bake(box[0], box[1], box[2], box[3], (g) => {
      const shadow = (path, k) => { g.save(); g.clip(path); const sg = g.createLinearGradient(-15, 0, 15, 0); sg.addColorStop(0, 'rgba(255,240,220,.12)'); sg.addColorStop(.55, 'rgba(0,0,0,0)'); sg.addColorStop(1, `rgba(10,4,0,${k})`); g.fillStyle = sg; g.fillRect(-30, -120, 80, 130); g.restore(); };
      /* boots and trousers */
      for (const x of [-11, 2]) {
        const leg = new Path2D(); leg.moveTo(x, -38); leg.lineTo(x + 9, -38); leg.lineTo(x + 8.6, -6); leg.lineTo(x + .4, -6); leg.closePath();
        cloth(g, leg, [x - 1, -40, x + 10, -4], trou, [30, 36, 28], 60, [0, 1], 5); shadow(leg, .35);
        g.strokeStyle = 'rgba(20,24,18,.5)'; g.lineWidth = .6; g.beginPath(); g.moveTo(x + 2, -22); g.quadraticCurveTo(x + 5, -20, x + 8, -23); g.stroke();
        g.fillStyle = '#3a2a1e'; g.beginPath(); g.moveTo(x - .5, -8); g.lineTo(x + 9, -8); g.lineTo(x + 12, -2); g.quadraticCurveTo(x + 12, 0, x + 10, 0); g.lineTo(x - .5, 0); g.closePath(); g.fill();
        g.fillStyle = '#1e1610'; g.fillRect(x - .5, -1.2, 12.5, 1.2);
      }
      /* the parka: quilted panels, a hood behind the neck, a zip, pockets */
      const coatP = new Path2D(); coatP.moveTo(-14, -66); coatP.quadraticCurveTo(0, -71, 14, -66); coatP.quadraticCurveTo(17, -50, 16, -33); coatP.quadraticCurveTo(0, -30, -16, -33); coatP.quadraticCurveTo(-17, -50, -14, -66); coatP.closePath();
      g.fillStyle = css(parkaD); g.beginPath(); g.ellipse(0, -67, 11, 4.5, 0, 0, TAU); g.fill();
      cloth(g, coatP, [-17, -71, 17, -30], parka, parkaD, 160, [.2, 1], 4);
      g.save(); g.clip(coatP); g.strokeStyle = 'rgba(90,24,12,.45)'; g.lineWidth = .8;
      for (let y = -60; y < -32; y += 7) { g.beginPath(); g.moveTo(-17, y); g.quadraticCurveTo(0, y + 2.2, 17, y); g.stroke(); }
      g.restore(); shadow(coatP, .4);
      g.strokeStyle = '#3a3a3e'; g.lineWidth = .9; g.beginPath(); g.moveTo(0, -67); g.lineTo(0, -32); g.stroke();
      g.fillStyle = 'rgba(80,20,10,.4)'; g.fillRect(-12, -44, 7, 1); g.fillRect(5, -44, 7, 1);
      /* the arm that holds the antenna up, and the receiver on the chest strap */
      const arm = new Path2D(); arm.moveTo(9, -64); arm.lineTo(14, -67); arm.lineTo(24, -77); arm.lineTo(20, -81); arm.closePath();
      g.lineCap = 'round'; g.strokeStyle = css(parka); g.lineWidth = 7.5; g.beginPath(); g.moveTo(11, -62); g.lineTo(22, -75); g.stroke();
      g.strokeStyle = 'rgba(90,24,12,.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(14, -64); g.lineTo(23, -74); g.stroke();
      g.fillStyle = '#2a2a2e'; g.beginPath(); g.ellipse(23, -77, 3.6, 3.2, 0, 0, TAU); g.fill();                  /* a glove */
      g.strokeStyle = '#3a3a3e'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12, -66); g.lineTo(18, -58); g.stroke();
      g.fillStyle = '#26262c'; rr(g, 13, -64, 10, 8, 1.5); g.fill(); g.fillStyle = '#7ad35a'; g.fillRect(15, -62, 2.5, 1.4); g.fillStyle = '#4a4a52'; g.fillRect(19, -61, 3, 3);
      /* the H antenna, metal with a highlight */
      const metal = (x0, y0, x1, y1) => { g.strokeStyle = '#6a6a72'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = 'rgba(240,244,255,.7)'; g.lineWidth = .6; g.beginPath(); g.moveTo(x0, y0 - .5); g.lineTo(x1, y1 - .5); g.stroke(); };
      metal(23, -79, 23, -108); metal(10, -108, 36, -108); metal(8, -100, 38, -100); metal(6, -92, 40, -92);
      /* the head: neck, hair, a real face, the knitted hat */
      g.fillStyle = css(mix(skin, [150, 100, 80], .25)); g.fillRect(-3, -71, 6, 5);
      g.fillStyle = css(hair); g.beginPath(); g.ellipse(0, -80, 10.5, 11, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(6, -80); g.quadraticCurveTo(13, -72, 9, -64); g.quadraticCurveTo(7, -70, 5, -74); g.fill();     /* a ponytail */
      const face = new Path2D(); face.ellipse(0, -78, 8.6, 10, 0, 0, TAU);
      const fg = g.createRadialGradient(-2.5, -81, 1, 0, -78, 11); fg.addColorStop(0, css(mix(skin, [255, 230, 210], .25))); fg.addColorStop(.7, css(skin)); fg.addColorStop(1, css(mix(skin, [130, 80, 60], .4)));
      g.fillStyle = fg; g.fill(face);
      g.fillStyle = 'rgba(220,110,100,.22)'; g.beginPath(); g.ellipse(-4.6, -74.5, 2.4, 1.6, 0, 0, TAU); g.ellipse(4.6, -74.5, 2.4, 1.6, 0, 0, TAU); g.fill();   /* rosy cheeks in the cold */
      for (const ex of [-3.4, 3.4]) {
        g.fillStyle = '#f4efe8'; g.beginPath(); g.ellipse(ex, -79, 1.7, 1.05, 0, 0, TAU); g.fill();
        g.fillStyle = '#5a3a24'; g.beginPath(); g.arc(ex + .2, -79, .85, 0, TAU); g.fill(); g.fillStyle = '#120a06'; g.beginPath(); g.arc(ex + .2, -79, .42, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(ex - .1, -79.3, .22, 0, TAU); g.fill();
        g.strokeStyle = css(mix(hair, [0, 0, 0], .2)); g.lineWidth = .7; g.beginPath(); g.moveTo(ex - 1.9, -81.2); g.quadraticCurveTo(ex, -82.1, ex + 1.9, -81.4); g.stroke();
      }
      g.strokeStyle = 'rgba(140,90,70,.6)'; g.lineWidth = .6; g.beginPath(); g.moveTo(.3, -78.5); g.quadraticCurveTo(1.3, -75.6, -.3, -75.2); g.stroke();
      g.strokeStyle = 'rgba(150,70,60,.8)'; g.lineWidth = .7; g.beginPath(); g.moveTo(-2.4, -72.4); g.quadraticCurveTo(0, -71, 2.4, -72.4); g.stroke();
      g.fillStyle = css(hat); g.beginPath(); g.moveTo(-10.5, -83); g.quadraticCurveTo(-10, -96, 0, -96.5); g.quadraticCurveTo(10, -96, 10.5, -83); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,60,100,.5)'; g.lineWidth = .5; for (let x = -9; x <= 9; x += 1.6) { g.beginPath(); g.moveTo(x, -84); g.lineTo(x * .9, -95); g.stroke(); }
      g.fillStyle = css(mix(hat, [20, 40, 70], .3)); rr(g, -11, -86, 22, 4.2, 2); g.fill();
      g.fillStyle = '#e8e4dc'; g.beginPath(); g.arc(0, -98, 3, 0, TAU); g.fill();
    });
    B.arm = bake(-5, -5, 5, 24, (g) => {
      g.lineCap = 'round'; g.strokeStyle = css(parka); g.lineWidth = 7.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 18); g.stroke();
      g.strokeStyle = 'rgba(90,24,12,.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, 2); g.lineTo(2, 17); g.stroke();
      g.fillStyle = '#2a2a2e'; g.beginPath(); g.ellipse(0, 21, 3.6, 3.4, 0, 0, TAU); g.fill();
    });
    herdCache.set('bio', B); return B;
  }
  function drawBiologist(ctx, o) {
    if (!herdCache.has('bio')) { if (!canBake()) return Sprites.drawBiologist(ctx, o); const t0 = performance.now(); bioParts(); spent(t0); }
    const s = o.s || 1, wave = o.wave || 0, B = bioParts();
    ctx.save(); ctx.scale(s, s);
    const sh = ctx.createRadialGradient(0, 0, 1, 0, 0, 22); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.scale(1, .18); ctx.fillStyle = sh; ctx.fillRect(-22, -22, 44, 44); ctx.restore();
    const a = -2.2 + Math.sin(wave * 3) * .5;
    ctx.save(); ctx.translate(-10, -62); ctx.rotate(a - Math.PI / 2); put(ctx, B.arm); ctx.restore();
    put(ctx, B.body);
    const k = (wave * .7) % 1; ctx.strokeStyle = `rgba(255,230,140,${.8 * (1 - k)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(23, -112, 6 + k * 24, -2.4, -.7); ctx.stroke();
    ctx.restore();
  }
  /* grass: tufts of tapered blades, darker at the root, a few seed heads; 6 variants per season */
  const GRASS = { spring: [[96, 150, 60], [140, 186, 84]], summer: [[110, 140, 62], [176, 182, 96]], autumn: [[150, 120, 60], [214, 186, 110]], winter: [[150, 140, 110], [206, 196, 160]] };
  function grassTuft(season, v) {
    const key = 'grass|' + season + '|' + v; let t = herdCache.get(key); if (t) return t;
    const R = mulberry32(300 + v * 17), [lo, hi] = GRASS[season] || GRASS.summer;
    t = bake(-10, -18, 10, 1, (g) => {
      for (let i = 0; i < 16 + v * 2; i++) {
        const x0 = (R() - .5) * 7, h = 6 + R() * 10, lean = (R() - .5) * 8, w = .45 + R() * .4;
        const gg = g.createLinearGradient(0, 0, 0, -h); gg.addColorStop(0, css(mix(lo, [30, 30, 10], .45))); gg.addColorStop(1, css(mix(lo, hi, R())));
        g.fillStyle = gg; g.beginPath(); g.moveTo(x0 - w, 0); g.quadraticCurveTo(x0 + lean * .3, -h * .6, x0 + lean, -h); g.quadraticCurveTo(x0 + lean * .3 + w * .3, -h * .6, x0 + w, 0); g.closePath(); g.fill();
        if (R() < .15 && season !== 'spring') { g.fillStyle = css(mix(hi, [120, 90, 50], .3)); g.beginPath(); g.ellipse(x0 + lean, -h - 1.2, .5, 1.6, lean * .05, 0, TAU); g.fill(); }
      }
    });
    herdCache.set(key, t); return t;
  }
  function drawGrass(ctx, x, y, s, season, sway, v) {
    if (!herdCache.has('grass|' + season + '|' + (v % 6))) { if (!canBake()) return false; const t0 = performance.now(); grassTuft(season, v % 6); spent(t0); }
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sway * .25, 1, 0, 0); ctx.scale(s * 1.05, s * 1.05); put(ctx, grassTuft(season, v % 6)); ctx.restore();
    return true;
  }
  /* ============================================================
     THE REST OF THE VALLEY: a raven in flight, the wildflowers by
     species, sagebrush, boulders, fallen logs, the scent posts.
     Every piece is painted once per variant and cached; a draw
     that finds its piece not painted yet returns false (or falls
     back to the classic sprite) and gets it a frame or two later.
     ============================================================ */
  const once = (key, make) => {
    let v = herdCache.get(key);
    if (!v) { if (!canBake()) return null; const t0 = performance.now(); v = make(); herdCache.set(key, v); spent(t0); }
    return v;
  };
  /* --- the raven in flight: a body with its wedge tail, and one wing drawn twice (the far one darker) --- */
  function ravenFlyParts() {
    const R = mulberry32(67), F = {};
    const feather = () => mix([18, 16, 24], [58, 58, 96], R() * R()); feather.tip = [86, 92, 140]; feather.dark = [6, 6, 8];
    const body = new Path2D();
    body.moveTo(16, 1); body.quadraticCurveTo(12, -3.5, 8, -3); body.quadraticCurveTo(0, -4.5, -10, -1.5);
    body.lineTo(-23, -4); body.lineTo(-25, 2); body.lineTo(-22, 6); body.lineTo(-10, 4);
    body.quadraticCurveTo(0, 6.5, 8, 4.5); body.quadraticCurveTo(12, 4.5, 16, 2.5); body.closePath();
    const bbox = [-27, -8, 24, 9];
    F.body = bake(bbox[0], bbox[1], bbox[2], bbox[3], (g, inside) => {
      g.fillStyle = '#121016'; g.fill(body);
      coat(g, inside, body, bbox, R, 420, (x) => x < -10 ? [-1, (R() - .5) * .3] : [-1, .05], feather, { len: 2.4, w: .45 });
      /* the heavy beak, the shaggy throat, the eye */
      g.fillStyle = '#17151b'; g.beginPath(); g.moveTo(14.5, -1.8); g.quadraticCurveTo(19, -1.2, 22.5, 1.4); g.quadraticCurveTo(18.5, 2.6, 14.5, 2.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(130,140,190,.4)'; g.lineWidth = .35; g.beginPath(); g.moveTo(15, -1.2); g.quadraticCurveTo(19, -.8, 22, 1.2); g.stroke();
      g.fillStyle = 'rgba(30,28,40,.9)'; for (let i = 0; i < 14; i++) hair(g, 12 - R() * 4, 3 + R(), -.3, 1, 2 + R() * 1.6, .4, (R() - .5) * .6);
      g.fillStyle = '#060508'; g.beginPath(); g.arc(12.3, -1.2, .8, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(12.1, -1.4, .25, 0, TAU); g.fill();
      volume(g, body, bbox, { top: .18, bottom: .2 });
    });
    /* the wing points up from its root at (0,0) and sweeps back; long primaries splay into "fingers" at the tip */
    /* primaries splay into "fingers" at the tip, secondaries make the trailing edge, coverts overlap like tiles at the front */
    const quill = (g, bx, by, tx, ty, w, c) => {
      const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      g.fillStyle = css(c); g.beginPath();
      g.moveTo(bx + nx * w * .5, by + ny * w * .5);
      g.quadraticCurveTo(bx + dx * .6 + nx * w * .6, by + dy * .6 + ny * w * .6, tx + nx * w * .25 - ux * w * .4, ty + ny * w * .25 - uy * w * .4);
      g.quadraticCurveTo(tx + ux * w * .3, ty + uy * w * .3, tx - nx * w * .3 - ux * w * .4, ty - ny * w * .3 - uy * w * .4);
      g.quadraticCurveTo(bx + dx * .6 - nx * w * .55, by + dy * .6 - ny * w * .55, bx - nx * w * .5, by - ny * w * .5);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = .22; g.stroke();
      g.strokeStyle = 'rgba(130,140,190,.3)'; g.lineWidth = .2; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx - ux * w * .5, ty - uy * w * .5); g.stroke();
      g.strokeStyle = 'rgba(90,96,150,.18)'; g.lineWidth = .15;
      for (let i = 1; i < L / 1.2; i++) { const t = i / (L / 1.2), x = bx + dx * t, y = by + dy * t; g.beginPath(); g.moveTo(x, y); g.lineTo(x + nx * w * .45 + ux * .8, y + ny * w * .45 + uy * .8); g.stroke(); }
    };
    const wbox = [-20, -37, 9, 5];
    F.wing = bake(wbox[0], wbox[1], wbox[2], wbox[3], (g) => {
      const tone = () => mix([16, 14, 22], [40, 40, 64], R());
      const tips = [[-15, -24.5], [-12.5, -28], [-9, -31], [-5, -33], [-1, -34]];
      tips.forEach(([tx, ty], k) => quill(g, 2.5 - k * .3, -14 - k * 1.2, tx, ty, lerp(2.6, 2.1, k / 4), tone()));
      for (let k = 7; k >= 0; k--) { const t = k / 7; quill(g, lerp(4, 2.6, t), lerp(-1, -13, t), lerp(-9, -15.5, t), lerp(1.5, -20, t), 3, tone()); }
      /* the coverts */
      for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
        const t = i / 8, x = lerp(4.5, 3, t) - row * 2.2, y = lerp(-1, -18, t) + row * .6;
        g.fillStyle = css(mix([22, 20, 30], [52, 54, 86], R() * .7)); g.beginPath(); g.ellipse(x - 1, y, 2.2, 1.5, -.5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .2; g.beginPath(); g.ellipse(x - 1, y, 2.2, 1.5, -.5, .6, 2.6); g.stroke();
      }
      const sg = g.createLinearGradient(6, 0, -3, 0); sg.addColorStop(0, 'rgba(140,150,210,.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = sg; g.fillRect(-6, -24, 14, 28); g.globalCompositeOperation = 'source-over';
    });
    F.wingFar = darker(F.wing, .35);
    return F;
  }
  function drawRavenFly(ctx, o) {
    const F = once('ravenFly', ravenFlyParts); if (!F) return Sprites.drawRaven(ctx, o);
    const s = o.s || 1, flap = Math.sin(o.ph || 0), sy = Math.sign(flap || 1) * Math.max(.14, Math.abs(flap));
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.translate(-2, -1); ctx.scale(.92, sy); put(ctx, F.wingFar); ctx.restore();
    put(ctx, F.body);
    ctx.save(); ctx.translate(1, 1); ctx.scale(1, sy); put(ctx, F.wing); ctx.restore();
    ctx.restore();
  }
  function drawRavenAny(ctx, o) { return o.fly ? drawRavenFly(ctx, o) : drawRaven(ctx, o); }

  /* --- wildflowers of the northern Rockies, one per colour the valley already uses ---
       yellow: arrowleaf balsamroot · pink: sticky geranium · purple: lupine ·
       white: yarrow · orange: Indian paintbrush.  Unit height ~16, base at y = 0. */
  function flowerBake(col, v) {
    const R = mulberry32(500 + v * 31 + col.charCodeAt(2) * 7);
    const stemC = [72, 112, 52], leafC = [92, 134, 66], sage = [128, 150, 112];
    const stem = (g, x0, x1, top, w = .55) => { g.strokeStyle = css(mix(stemC, [40, 60, 30], R() * .4)); g.lineWidth = w; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + (x1 - x0) * .2, top * .5, x1, top); g.stroke(); };
    const leaf = (g, x, y, a, L, W, c) => { g.fillStyle = css(c); g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .45, -W, L, 0); g.quadraticCurveTo(L * .45, W, 0, 0); g.fill(); g.strokeStyle = css(mix(c, [255, 255, 230], .25), .6); g.lineWidth = .18; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * .9, 0); g.stroke(); g.restore(); };
    return bake(-11, -26, 11, 2, (g) => {
      g.lineCap = 'round';
      if (col === '#ffd23f') {
        /* balsamroot: big silvery arrow-shaped leaves at the base, sunflower heads on bare stalks */
        for (let i = 0; i < 4; i++) leaf(g, (R() - .5) * 3, 0, -Math.PI / 2 + (R() - .5) * 1.6, 7 + R() * 3, 2.4, mix(sage, leafC, R() * .5));
        for (let k = 0; k < 2 + (v % 2); k++) {
          const hx = (k - .5) * 5 + (R() - .5) * 3, hy = -13 - R() * 7; stem(g, hx * .3, hx, hy);
          for (let i = 0; i < 13; i++) { const a = i / 13 * TAU + R() * .2; g.fillStyle = css(mix([250, 206, 40], [255, 228, 110], R()), .95); g.save(); g.translate(hx, hy); g.rotate(a); g.scale(1, .55); g.beginPath(); g.ellipse(2.4, 0, 2, .7, 0, 0, TAU); g.fill(); g.restore(); }
          const cg = g.createRadialGradient(hx - .4, hy - .4, .1, hx, hy, 1.6); cg.addColorStop(0, '#d8a040'); cg.addColorStop(1, '#7a4a18'); g.fillStyle = cg; g.beginPath(); g.ellipse(hx, hy, 1.5, 1, 0, 0, TAU); g.fill();
        }
      } else if (col === '#ff7a9a') {
        /* sticky geranium: deeply lobed leaves, open five-petalled pink flowers with dark veins */
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (R() - .5) * 2, x = Math.cos(a) * 4, y = Math.sin(a) * 4; stem(g, 0, x, y, .35); for (let j = 0; j < 5; j++) leaf(g, x, y, a + (j - 2) * .5, 2.6, 1, mix(leafC, [60, 100, 40], R() * .4)); }
        for (let k = 0; k < 3; k++) {
          const hx = (k - 1) * 5 + (R() - .5) * 2, hy = -11 - R() * 7; stem(g, hx * .2, hx, hy, .45);
          for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .3; g.fillStyle = css(mix([226, 110, 168], [246, 160, 200], R())); g.beginPath(); g.ellipse(hx + Math.cos(a) * 1.6, hy + Math.sin(a) * 1.1, 1.5, 1.05, a, 0, TAU); g.fill(); g.strokeStyle = 'rgba(120,30,80,.55)'; g.lineWidth = .15; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 2.6, hy + Math.sin(a) * 1.8); g.stroke(); }
          g.fillStyle = '#f2e8a0'; g.beginPath(); g.arc(hx, hy, .45, 0, TAU); g.fill();
        }
      } else if (col === '#b48aff') {
        /* lupine: palmate leaves low down, tall spikes of little pea flowers, buds paler at the tip */
        for (let i = 0; i < 4; i++) { const x = (R() - .5) * 6, y = -2 - R() * 3; for (let j = 0; j < 7; j++) leaf(g, x, y, -Math.PI / 2 + (j - 3) * .42, 3, .55, mix(leafC, sage, R() * .4)); }
        for (let k = 0; k < 2 + (v % 2); k++) {
          const hx = (k - .5) * 4.5 + (R() - .5) * 2, top = -19 - R() * 5; stem(g, hx * .3, hx, top + 8, .6);
          for (let i = 0; i < 22; i++) { const t = i / 22, y = lerp(top + 9, top, t), side = i % 2 ? 1 : -1, w = lerp(1.6, .5, t); g.fillStyle = css(mix(mix([108, 82, 196], [150, 120, 230], R()), [236, 226, 250], t * t * .7)); g.beginPath(); g.ellipse(hx + side * w * .6, y, w * .7, .75, side * .4, 0, TAU); g.fill(); if (R() < .3) { g.fillStyle = 'rgba(250,250,255,.8)'; g.beginPath(); g.arc(hx + side * w * .4, y - .3, .3, 0, TAU); g.fill(); } }
        }
      } else if (col === '#ffffff') {
        /* yarrow: feathery leaves, a flat-topped head of tiny off-white florets */
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (R() - .5) * 1.4, L = 6 + R() * 4; g.strokeStyle = css(mix(leafC, sage, .5)); g.lineWidth = .3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke(); for (let j = 1; j < 8; j++) { const t = j / 8, x = Math.cos(a) * L * t, y = Math.sin(a) * L * t; g.beginPath(); g.moveTo(x - .9, y + .2); g.lineTo(x + .9, y - .2); g.stroke(); } }
        for (let k = 0; k < 2; k++) {
          const hx = (k - .5) * 6, hy = -15 - R() * 6; stem(g, hx * .2, hx, hy, .5);
          for (let j = 0; j < 7; j++) { g.strokeStyle = css(stemC, .8); g.lineWidth = .2; g.beginPath(); g.moveTo(hx, hy + 2.5); g.lineTo(hx + (j - 3) * .9, hy); g.stroke(); }
          for (let i = 0; i < 40; i++) { const x = hx + (R() - .5) * 7, y = hy - R() * 1.6 + Math.abs(x - hx) * .15; g.fillStyle = css(mix([250, 248, 236], [214, 206, 180], R() * .5)); g.beginPath(); g.arc(x, y, .42, 0, TAU); g.fill(); }
        }
      } else {
        /* Indian paintbrush: narrow leaves up the stem, a head of scarlet-orange bracts */
        for (let k = 0; k < 3; k++) {
          const hx = (k - 1) * 3.6 + (R() - .5) * 2, top = -14 - R() * 6; stem(g, hx * .2, hx, top + 4, .6);
          for (let j = 0; j < 5; j++) { const y = lerp(-1, top + 5, j / 5); leaf(g, hx, y, -Math.PI / 2 + (j % 2 ? .6 : -.6), 3, .5, mix(leafC, [110, 100, 60], .3)); }
          for (let i = 0; i < 16; i++) { const t = i / 16, y = lerp(top + 5, top, t), a = -Math.PI / 2 + (i % 2 ? .7 : -.7) * (1 - t); g.fillStyle = css(mix(mix([226, 72, 36], [250, 130, 50], R()), [240, 200, 120], t * .25)); g.save(); g.translate(hx, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(.9, -1.2, 0, -2.4); g.quadraticCurveTo(-.9, -1.2, 0, 0); g.fill(); g.restore(); }
        }
      }
    });
  }
  function drawFlower(ctx, x, y, s, col, sway, v) {
    const k = v % 3, img = once('flower|' + col + '|' + k, () => flowerBake(col, k)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sway * .06, 1, 0, 0); ctx.scale(s * .62 * ((v >> 2) % 2 ? -1 : 1), s * .62); put(ctx, img); ctx.restore();
    return true;
  }
  /* --- sagebrush: a twisted woody base under a domed mound of tiny silver-grey leaves --- */
  function sageBake(v) {
    const R = mulberry32(900 + v * 17);
    return bake(-17, -17, 17, 2, (g) => {
      g.lineCap = 'round';
      for (let k = 0; k < 6; k++) { const x1 = (R() - .5) * 22, y1 = -6 - R() * 6; g.strokeStyle = css(mix([96, 80, 60], [130, 112, 88], R())); g.lineWidth = 1.4 - k * .1; g.beginPath(); g.moveTo((R() - .5) * 3, 1); g.quadraticCurveTo(x1 * .3, y1 * .4, x1, y1); g.stroke(); }
      for (const pass of [0, 1, 2]) {
        const n = pass === 1 ? 420 : 260;
        for (let i = 0; i < n; i++) {
          const a = Math.PI + R() * Math.PI, r = Math.sqrt(R()), x = Math.cos(a) * 14 * r, y = -4 + Math.sin(a) * 11 * r * (.75 + .25 * Math.cos(x * .3 + v));
          const lit = clamp(-(y + 4) / 11 * .8 - x / 40, 0, 1);
          let c = mix([112, 132, 112], [150, 168, 146], R());
          c = pass === 0 ? mix(c, [40, 52, 40], .45) : pass === 1 ? c : mix(c, [226, 232, 214], lit * .6);
          if (pass === 2 && R() < .5) continue;
          g.fillStyle = css(c, .95); g.beginPath(); g.ellipse(x, y, .9 + R() * .7, .45 + R() * .3, R() * TAU, 0, TAU); g.fill();
        }
      }
    });
  }
  function drawSage(ctx, x, y, s, seed) {
    const v = seed % 5, img = once('sage|' + v, () => sageBake(v)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (seed & 8 ? -1 : 1), s); put(ctx, img); ctx.restore();
    return true;
  }
  /* --- boulders: an irregular rounded top sunk into the ground, speckled granite, cracks, lichen --- */
  function stoneBake(v, wet, res) {
    const R = mulberry32(1300 + v * 23 + (wet ? 5 : 0)), pts = [];
    const n = 11, hk = .55 + R() * .35;
    for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI, rr = 10 * (.82 + R() * .3); pts.push([Math.cos(a) * rr * 1.05, Math.min(1.5, Math.sin(a) * rr * hk)]); }
    const p = new Path2D(); p.moveTo(pts[0][0], 2);
    for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], [nx, ny] = pts[Math.min(pts.length - 1, i + 1)]; p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); }
    p.lineTo(pts[pts.length - 1][0], 2); p.closePath();
    const box = [-13, -12, 13, 3], top = Math.min(...pts.map(q => q[1]));
    const img = bake(box[0], box[1], box[2], box[3], (g) => {
      const base = wet ? [104, 108, 104] : [168, 160, 146], dark = wet ? [42, 46, 44] : [92, 86, 76];
      const bg = g.createLinearGradient(-8, -10, 8, 2); bg.addColorStop(0, css(mix(base, [240, 236, 224], .25))); bg.addColorStop(.55, css(base)); bg.addColorStop(1, css(dark));
      g.fillStyle = bg; g.fill(p);
      g.save(); g.clip(p);
      for (let i = 0; i < 520; i++) { const x = (R() - .5) * 24, y = -R() * 11 + 1; g.fillStyle = css(R() < .5 ? mix(base, [250, 248, 240], .35) : mix(dark, [20, 18, 16], .3), .25 + R() * .3); g.beginPath(); g.arc(x, y, .14 + R() * .2, 0, TAU); g.fill(); }
      g.strokeStyle = css(mix(dark, [0, 0, 0], .4), .55); g.lineWidth = .3;
      for (let k = 0; k < 2; k++) { let x = (R() - .5) * 12, y = -9 + R() * 3; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (R() - .5) * 3; y += 1.5 + R() * 1.5; g.lineTo(x, y); } g.stroke(); }
      if (!wet) {
        /* lichen: pale green-grey rosettes and a few orange spots, on the lit top */
        for (let k = 0; k < 3; k++) { const cx = (R() - .6) * 10, cy = -7 + R() * 3, col = R() < .3 ? [214, 150, 60] : [176, 188, 140]; for (let i = 0; i < 26; i++) { g.fillStyle = css(mix(col, [240, 240, 220], R() * .3), .7); g.beginPath(); g.arc(cx + (R() - .5) * 3.5, cy + (R() - .5) * 1.6, .3 + R() * .4, 0, TAU); g.fill(); } }
      } else {
        const sh = g.createLinearGradient(0, -10, 0, -3); sh.addColorStop(0, 'rgba(230,240,250,.4)'); sh.addColorStop(1, 'rgba(230,240,250,0)'); g.fillStyle = sh; g.fillRect(-12, -12, 14, 9);
      }
      /* the rim of light along the top, darkness where it meets the soil */
      g.strokeStyle = 'rgba(255,250,236,.35)'; g.lineWidth = .7; g.beginPath(); g.moveTo(pts[1][0], pts[1][1] + .4); for (let i = 2; i < 6; i++) g.lineTo(pts[i][0], pts[i][1] + .4); g.stroke();
      const fg = g.createLinearGradient(0, -3, 0, 2); fg.addColorStop(0, 'rgba(10,8,4,0)'); fg.addColorStop(1, 'rgba(10,8,4,.55)'); g.fillStyle = fg; g.fillRect(-13, -3, 26, 5);
      g.restore();
    }, res);
    img.top = top; return img;
  }
  function drawStone(ctx, x, y, r, seed, wet, snow, sy = 1) {
    const v = seed % 6, big = r > 12, img = once('stone|' + v + (wet ? 'w' : '') + (big ? 'B' : ''), () => stoneBake(v, wet, big ? 10 : RES0)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.scale(r / 10 * (seed & 16 ? -1 : 1), r / 10 * sy); put(ctx, img);
    if (snow) { const ty = img.top + 1.6; ctx.fillStyle = 'rgba(248,251,255,.95)'; ctx.beginPath(); ctx.ellipse(0, ty, 7.5, 2.2, 0, Math.PI, TAU); ctx.ellipse(0, ty, 7.5, .9, 0, 0, Math.PI); ctx.fill(); }
    ctx.restore();
    return true;
  }
  /* --- a fallen log: furrowed bark, a sawn-looking broken end with rings, moss along the top --- */
  function logBake(w, v) {
    const R = mulberry32(1700 + v * 29 + w), h = 14;
    return bake(-w / 2 - 4, -h - 3, w / 2 + 6, 2.5, (g) => {
      const body = new Path2D(); body.roundRect(-w / 2, -h, w, h, h / 2);
      g.fillStyle = 'rgba(10,8,4,.35)'; g.beginPath(); g.ellipse(1, 0, w / 2 + 3, 1.8, 0, 0, TAU); g.fill();
      const bg = g.createLinearGradient(0, -h, 0, 0); bg.addColorStop(0, '#9a7a56'); bg.addColorStop(.45, '#6a4e34'); bg.addColorStop(1, '#2e2016');
      g.fillStyle = bg; g.fill(body);
      g.save(); g.clip(body); g.lineCap = 'round';
      for (let i = 0; i < w * 3.2; i++) { const x = -w / 2 + R() * w, y = -h + R() * h, L = 3 + R() * 9; g.strokeStyle = R() < .55 ? `rgba(30,20,12,${.35 + R() * .3})` : `rgba(200,170,130,${.15 + R() * .2})`; g.lineWidth = .3 + R() * .5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y + (R() - .5), x + L, y + (R() - .5) * .8); g.stroke(); }
      /* moss on the top, a bare patch where the bark has fallen away */
      for (let i = 0; i < w * 2; i++) { const x = -w / 2 + R() * w, y = -h + R() * 3.5; g.fillStyle = css(mix([96, 130, 60], [140, 170, 80], R()), .55); g.beginPath(); g.arc(x, y, .5 + R() * .7, 0, TAU); g.fill(); }
      const bx = (R() - .5) * w * .4; g.fillStyle = 'rgba(196,160,112,.6)'; g.beginPath(); g.ellipse(bx, -h * .55, w * .12, h * .18, 0, 0, TAU); g.fill();
      g.restore();
      /* the end: pale wood, growth rings, radial cracks */
      const ex = w / 2, ey = -h / 2;
      g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(ex, ey, h * .3, h / 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#cfa874'; g.beginPath(); g.ellipse(ex + .4, ey, h * .26, h / 2 - 1.2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,80,40,.55)'; g.lineWidth = .3; for (let k = 1; k < 6; k++) { g.beginPath(); g.ellipse(ex + .4, ey, h * .26 * k / 6, (h / 2 - 1.2) * k / 6, 0, 0, TAU); g.stroke(); }
      g.strokeStyle = 'rgba(70,40,20,.6)'; g.lineWidth = .35; for (let k = 0; k < 3; k++) { const a = R() * TAU; g.beginPath(); g.moveTo(ex + .4, ey); g.lineTo(ex + .4 + Math.cos(a) * h * .24, ey + Math.sin(a) * (h / 2 - 1.5)); g.stroke(); }
    });
  }
  function drawLog(ctx, x, y, w, seed, snow) {
    const wq = Math.max(30, Math.round(w / 10) * 10), v = seed % 3, img = once('log|' + wq + '|' + v, () => logBake(wq, v)); if (!img) return false;
    ctx.save(); ctx.translate(x, y); put(ctx, img);
    if (snow) { ctx.fillStyle = 'rgba(248,251,255,.95)'; rr(ctx, -wq / 2 + 2, -18, wq - 4, 6, 3); ctx.fill(); }
    ctx.restore();
    return true;
  }
  /* --- scent posts: a big boulder, a fallen log, or a weathered stump; the scent wisps stay live --- */
  function stumpBake() {
    const R = mulberry32(1901);
    return bake(-13, -30, 13, 3, (g) => {
      const p = new Path2D(); p.moveTo(-11, 2); p.quadraticCurveTo(-9, -6, -9, -24); p.lineTo(9, -24); p.quadraticCurveTo(9, -6, 12, 2); p.closePath();
      const bg = g.createLinearGradient(-10, 0, 10, 0); bg.addColorStop(0, '#8a6a4a'); bg.addColorStop(.5, '#6a4c32'); bg.addColorStop(1, '#2e2018'); g.fillStyle = bg; g.fill(p);
      g.save(); g.clip(p); for (let i = 0; i < 160; i++) { const x = -11 + R() * 22, y = -24 + R() * 26; g.strokeStyle = R() < .6 ? `rgba(28,18,10,${.4 + R() * .3})` : `rgba(210,180,140,${.2 + R() * .2})`; g.lineWidth = .3 + R() * .5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * .8, y + 2 + R() * 5); g.stroke(); } g.restore();
      g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(0, -24, 9.5, 3.4, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,80,40,.6)'; g.lineWidth = .3; for (let k = 1; k < 7; k++) { g.beginPath(); g.ellipse(0, -24, 9 * k / 7, 3.2 * k / 7, 0, 0, TAU); g.stroke(); }
      g.strokeStyle = 'rgba(60,36,18,.7)'; g.lineWidth = .4; g.beginPath(); g.moveTo(0, -24); g.lineTo(7, -25.5); g.moveTo(0, -24); g.lineTo(-5, -21.8); g.stroke();
      for (let i = 0; i < 30; i++) { g.fillStyle = css(mix([96, 130, 60], [150, 176, 90], R()), .6); g.beginPath(); g.arc(-10 + R() * 5, -2 - R() * 8, .5 + R() * .6, 0, TAU); g.fill(); }
    });
  }
  function drawPost(ctx, p, time) {
    let ok;
    if (p.kind === 'rock') ok = drawStone(ctx, 0, 3, 17, 7, false, false, 1.5);
    else if (p.kind === 'log') ok = drawLog(ctx, -3, 2, 48, 1, false);
    else { const img = once('stump', stumpBake); ok = !!img; if (img) put(ctx, img); }
    if (!ok) return Sprites.drawPost(ctx, p, time);
    if (p.marked || p.home) { ctx.strokeStyle = 'rgba(255,220,120,.55)'; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { const u = ((time * .4 + k * .33) % 1); ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.moveTo(-6 + k * 6, -10 - u * 22); ctx.quadraticCurveTo(-2 + k * 6, -16 - u * 22, -6 + k * 6, -20 - u * 22); ctx.stroke(); } ctx.globalAlpha = 1; }
  }

  /* --- the earth's detail: one seamless tile of pebbles, clods, specks, root threads and strata,
         laid source-atop over the cell layer (so it only lands on earth and rock) --- */
  let earthPat = null;
  function earthPattern(ctx) {
    if (earthPat) return earthPat;
    if (!canBake()) return null;
    const t0 = performance.now(), TW = 480, TH = 320, K = 2, R = mulberry32(2203);
    const c = document.createElement('canvas'); c.width = TW * K; c.height = TH * K;
    const g = c.getContext('2d', SOFT); g.scale(K, K); g.lineCap = 'round';
    const wrap = (fn) => { for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    for (let i = 0; i < 10; i++) { const y = R() * TH, h = 3 + R() * 7, ph = R() * TAU, a = .05 + R() * .05; wrap(() => { g.fillStyle = R() < .5 ? `rgba(20,10,0,${a})` : `rgba(255,236,200,${a * .6})`; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= TW; x += 20) g.lineTo(x, y + Math.sin(x / TW * TAU * 2 + ph) * 4); for (let x = TW; x >= 0; x -= 20) g.lineTo(x, y + h + Math.sin(x / TW * TAU * 2 + ph + .5) * 4); g.fill(); }); }
    for (let i = 0; i < 160; i++) { const x = R() * TW, y = R() * TH, r = 3 + R() * 7, a = .06 + R() * .08; wrap(() => { g.fillStyle = `rgba(36,20,8,${a})`; g.beginPath(); g.ellipse(x, y, r, r * (.5 + R() * .3), R(), 0, TAU); g.fill(); }); }
    for (let i = 0; i < 1400; i++) { const x = R() * TW, y = R() * TH, r = .3 + R() * .7, lt = R() < .5; wrap(() => { g.fillStyle = lt ? 'rgba(255,240,210,.22)' : 'rgba(20,10,0,.28)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); }
    for (let i = 0; i < 28; i++) {
      const pts = [[R() * TW, R() * TH]]; let a = R() * TAU;
      for (let k = 0; k < 8; k++) { a += (R() - .5) * 1.2; const [x, y] = pts[pts.length - 1]; pts.push([x + Math.cos(a) * (4 + R() * 6), y + Math.sin(a) * (4 + R() * 6)]); }
      const w = .35 + R() * .8;
      wrap(() => { g.strokeStyle = 'rgba(30,16,6,.32)'; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts) g.lineTo(...q); g.stroke(); g.strokeStyle = 'rgba(255,230,190,.08)'; g.lineWidth = w * .6; g.beginPath(); g.moveTo(pts[0][0] + .6, pts[0][1] - .6); for (const q of pts) g.lineTo(q[0] + .6, q[1] - .6); g.stroke(); });
    }
    for (let i = 0; i < 90; i++) {
      const x = R() * TW, y = R() * TH, r = 1.4 + R() * R() * 5, e = .55 + R() * .35, rot = (R() - .5) * .8, tone = 90 + R() * 90, warm = R() * 20;
      wrap(() => {
        g.fillStyle = 'rgba(10,6,2,.35)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .35, r, r * e, rot, 0, TAU); g.fill();
        const pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1); pg.addColorStop(0, `rgba(${tone + 60 + warm},${tone + 55},${tone + 40},.85)`); pg.addColorStop(1, `rgba(${tone * .5 + warm},${tone * .48},${tone * .42},.85)`);
        g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill();
      });
    }
    /* the tile is painted on a CPU canvas (fast for thousands of fills) but a pattern from one is re-sent to the GPU every frame (~130 ms): hand it over once */
    const gc = document.createElement('canvas'); gc.width = c.width; gc.height = c.height; gc.getContext('2d').drawImage(c, 0, 0);
    earthPat = ctx.createPattern(gc, 'repeat');
    if (earthPat.setTransform) earthPat.setTransform(new DOMMatrix().scale(1 / K, 1 / K));
    stat.n++; stat.ms += performance.now() - t0; spent(t0);
    return earthPat;
  }

  function cached() { return { parts: cache.size + treeCache.size + herdCache.size, bakes: stat.n, trees: stat.trees, bakeMs: Math.round(stat.ms) }; }

  return { drawWolf, drawTree, drawElk, drawBison, drawRaven: drawRavenAny, drawBiologist, drawGrass, drawFlower, drawSage, drawStone, drawLog, drawPost, earthPattern, beginFrame, cached };
})();
