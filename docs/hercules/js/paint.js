/* ============================================================
   paint.js — the painted rainforest (with the WebGL look, ?gfx=gl)
   ============================================================
     The same creatures and props as sprites.js, with the same
     options and the same joints (so every stage, pose and form
     still works), but painted the way an illustrator would, here
     in code, once, and cached as images:
       the Hercules beetle: glossy black head, pronotum and horns
         (specular streaks, sky reflections, fine punctures), the
         golden brush under the thoracic horn, olive-khaki to
         yellow wing cases with scattered black spots (a black wet
         set crossfaded over them as the air gets damp), the hairy
         brown female, spined legs, veined hind wings
       the grub: creamy segments with folds, setae and spiracles,
         the grey-blue gut showing through at the back, the glossy
         orange-brown head capsule; the pupa; the egg; shed skins
       other beetles, the millipede, the coati (fur), fruit,
         sticks, mushrooms (and their glow), ferns, palms, leaf
         litter, moss, the four climbable trees (bark, buttresses,
         moss, a bromeliad, leaf clumps), hanging lianas, and two
         seamless detail tiles for the cut-away (rotting wood grain
         and fibres; soil with roots and pebbles)
     Painting happens on CPU canvases (thousands of tiny fills are
     very slow on a GPU canvas); each finished piece is copied once
     to an ordinary canvas, because a CPU canvas used as a drawing
     source is re-uploaded to the GPU every frame.  Baking has a
     time budget per frame; anything not painted yet is drawn the
     classic way until its turn comes.  Per frame only placing.
   ============================================================ */
'use strict';

const Painted = (function () {
  const SOFT = { willReadFrequently: true };
  const cache = new Map(), stat = { n: 0, ms: 0 }, slow = [];
  let budget = 10;
  function beginFrame(ms) { budget = ms || 10; }
  const canBake = () => budget > 0;
  const spent = (t0) => { budget -= performance.now() - t0; };
  const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const WHITE = [255, 255, 255], INK = [0, 0, 0];

  /* ---------- painting tools ---------- */
  function hand(c) {
    /* a big finished CPU canvas is copied once to an ordinary canvas: that one is uploaded to the GPU once and kept
       (a big CPU canvas drawn every frame, or used for a pattern, is re-sent to the GPU every time); small parts
       stay as they are, since making a GPU canvas for each costs more than it saves */
    if (c.width * c.height < 160000) return c;
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
    out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }
  function bake(x0, y0, x1, y1, paint, RES) {
    const t0 = performance.now();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0) * RES)); c.height = Math.max(1, Math.ceil((y1 - y0) * RES));
    const g = c.getContext('2d', SOFT);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); g.lineCap = 'round'; g.lineJoin = 'round';
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
    const r = paint(g, inside, RES);
    if (r && typeof r.next === 'function') drain(r);
    stat.n++; stat.ms += performance.now() - t0;
    return { c: hand(c), x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  /* the same, as a resumable job: paint() may be a generator that yields now and then, so a big piece is
     painted over several frames inside the budget (bake() drains such a painter in one go) */
  function* bakeJob(x0, y0, x1, y1, paint, RES) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0) * RES)); c.height = Math.max(1, Math.ceil((y1 - y0) * RES));
    const g = c.getContext('2d', SOFT);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES); g.lineCap = 'round'; g.lineJoin = 'round';
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
    const r = paint(g, inside, RES);
    if (r && typeof r.next === 'function') yield* r;
    yield;
    stat.n++;
    return { c: hand(c), x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  const drain = (it) => { let r; do r = it.next(); while (!r.done); return r.value; };
  function put(ctx, part) { ctx.drawImage(part.c, part.x0, part.y0, part.w, part.h); }
  function darker(part, k) {
    const c = document.createElement('canvas'); c.width = part.c.width; c.height = part.c.height;
    const g = c.getContext('2d'); g.drawImage(part.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(8,6,4,${k})`; g.fillRect(0, 0, c.width, c.height);
    return { ...part, c };
  }
  /* cache a piece by key, painting it only when there is budget left this frame */
  function once(key, make) {
    let v = cache.get(key);
    if (v !== undefined && !(v && v.job)) return v;
    if (!canBake()) return null;
    const t0 = performance.now();
    if (v === undefined) {
      const r = make();
      if (!(r && typeof r.next === 'function')) { cache.set(key, r); spent(t0); const ms = performance.now() - t0; if (ms > 15) slow.push([key, Math.round(ms)]); return r; }
      v = { job: r, ms: 0 }; cache.set(key, v);
    }
    /* a job: step it until this frame's budget is used up */
    const end = t0 + budget; let res;
    do res = v.job.next(); while (!res.done && performance.now() < end);
    const ms = performance.now() - t0; v.ms += ms; stat.ms += ms; spent(t0);
    if (res.done) { cache.set(key, res.value); if (v.ms > 15) slow.push([key + ' (job)', Math.round(v.ms)]); return res.value; }
    return null;
  }
  /* a part along a bone: sprites point down +y from (0,0) to (0,nominal) */
  function bone(ctx, part, ax, ay, bx, by, nominal, wk = 1) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2); ctx.scale(wk, len / nominal || 1);
    put(ctx, part); ctx.restore();
  }
  function hair(g, x, y, dx, dy, len, w, bend) {
    const nx = -dy, ny = dx, mxp = x + dx * len * .5 + nx * bend, myp = y + dy * len * .5 + ny * bend;
    g.beginPath();
    g.moveTo(x + nx * w, y + ny * w);
    g.quadraticCurveTo(mxp + nx * w * .5, myp + ny * w * .5, x + dx * len, y + dy * len);
    g.quadraticCurveTo(mxp - nx * w * .5, myp - ny * w * .5, x - nx * w, y - ny * w);
    g.closePath(); g.fill();
  }
  /* fur: under-fur, then guard hairs with pale bands and dark tips, following a flow field */
  function* coat(g, inside, path, box, R, n, flow, colour, o = {}) {
    const [bx0, by0, bx1, by1] = box, L = o.len || 3, Wd = o.w || .45;
    for (let pass = 0; pass < 2; pass++) {
      const count = pass ? n : n * .6;
      for (let i = 0; i < count; i++) {
        const x = bx0 + (bx1 - bx0) * R(), y = by0 + (by1 - by0) * R();
        if (!inside(path, x, y)) continue;
        let [dx, dy] = flow(x, y); const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const j = (R() - .5) * .5, ca = Math.cos(j), sa = Math.sin(j), fx = dx * ca - dy * sa, fy = dx * sa + dy * ca;
        let c = colour(x, y);
        if (pass) { const r = R(); if (r < .3) c = mx(c, colour.tip || [230, 220, 200], .45); else if (r > .8) c = mx(c, colour.dark || [26, 20, 14], .55); }
        else c = mx(c, INK, .18);
        const v = .9 + R() * .2; c = [c[0] * v, c[1] * v, c[2] * v];
        g.fillStyle = css(c, pass ? .75 + R() * .25 : .9);
        hair(g, x, y, fx, fy, L * (pass ? .7 + R() * .7 : .9 + R() * .4), Wd * (pass ? .6 + R() * .5 : 1.1), (R() - .5) * L * .25);
        if ((i & 255) === 255) yield;
      }
    }
  }
  /* volume: light from above, a soft darkening inside every edge */
  function volume(g, path, box, top = .14, bottom = .24, edge = .08) {
    const [bx0, by0, bx1, by1] = box;
    g.save(); g.clip(path);
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, by0, 0, by1);
    lg.addColorStop(0, `rgba(255,250,235,${top})`); lg.addColorStop(.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(12,8,4,${bottom})`);
    g.fillStyle = lg; g.fillRect(bx0 - 5, by0 - 5, bx1 - bx0 + 10, by1 - by0 + 10);
    g.strokeStyle = `rgba(10,6,2,${edge})`;
    const s = Math.max(bx1 - bx0, by1 - by0) / 40;
    for (const w of [6, 4, 2.4]) { g.lineWidth = w * s; g.stroke(path); }
    g.restore();
  }
  /* a glossy highlight along a polyline: a broad soft sheen, then a sharp glint */
  function glint(g, pts, wide, sharp, a1 = .22, a2 = .85, col = [255, 255, 255]) {
    const line = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    g.save();
    g.filter = `blur(${Math.max(.5, wide * .6)}px)`; g.strokeStyle = css(col, a1); g.lineWidth = wide; line(); g.stroke();
    g.filter = 'none';
    g.strokeStyle = css(col, a2); g.lineWidth = sharp;
    const n = pts.length, s0 = Math.floor(n * .18), s1 = Math.ceil(n * .78);
    g.beginPath(); g.moveTo(pts[s0][0], pts[s0][1]); for (let i = s0 + 1; i < s1; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    g.restore();
  }
  const cub = (a, b, c, d, t) => { const u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; };
  const curve = (a, b, c, d, n = 16, t0 = 0, t1 = 1) => { const o = []; for (let i = 0; i <= n; i++) o.push(cub(a, b, c, d, lerp(t0, t1, i / n))); return o; };
  /* fine pits in chitin */
  function punct(g, box, R, n, a = .18, r0 = .12, r1 = .32, light = .06) {
    for (let i = 0; i < n; i++) {
      const x = lerp(box[0], box[2], R()), y = lerp(box[1], box[3], R()), r = lerp(r0, r1, R());
      g.fillStyle = `rgba(0,0,0,${a * (.5 + R() * .5)})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (light) { g.fillStyle = `rgba(255,255,255,${light})`; g.beginPath(); g.arc(x - r * .4, y - r * .5, r * .5, 0, TAU); g.fill(); }
    }
  }

  /* ============================================================
     THE HERCULES BEETLE — same frame as Sprites.drawBeetle: side
     view, facing +x, a big male 150 units long, feet at y = +30
     ============================================================ */
  const BRES = 2.6;
  function blackOf(pale, base) { return pale > 0 ? mx(base, [214, 190, 150], pale) : base; }
  /* wing cases: dry (with spots), wet (black), or a female's hairy brown ones */
  function* elytra(form, male, pale, wet) {
    const F = FORMS[form] || FORMS.hercules, R = mulberry32(17 + form.length * 31 + (male ? 0 : 7) + (wet ? 3 : 0));
    const p = new Path2D();
    p.moveTo(8, -26); p.bezierCurveTo(-6, -38, -50, -36, -64, -14); p.bezierCurveTo(-72, 0, -60, 10, -44, 10); p.lineTo(4, 8); p.bezierCurveTo(10, 0, 12, -16, 8, -26); p.closePath();
    const box = [-74, -40, 15, 13];
    let base = hexToRgb(wet ? F.wet : F.wing), deep = hexToRgb(wet ? F.wet : F.wing2);
    if (!male) { base = wet ? [34, 24, 16] : mx(base, [74, 48, 26], .72); deep = wet ? [18, 12, 8] : mx(deep, [44, 28, 14], .75); }
    if (pale > 0) { base = mx(base, [236, 222, 190], pale); deep = mx(deep, [214, 196, 160], pale); }
    return yield* bakeJob(box[0], box[1], box[2], box[3], function* (g, inside) {
      const eg = g.createLinearGradient(0, -36, 0, 11);
      eg.addColorStop(0, css(mx(base, WHITE, .14))); eg.addColorStop(.42, css(base)); eg.addColorStop(1, css(mx(deep, INK, .35)));
      g.fillStyle = eg; g.fill(p);
      g.save(); g.clip(p);
      /* a waxy mottle: soft patches a shade lighter and darker */
      for (let i = 0; i < 46; i++) { const x = -70 + R() * 80, y = -36 + R() * 46, r = 3 + R() * 7; g.fillStyle = css(R() < .5 ? mx(base, WHITE, .3) : mx(deep, INK, .3), .07); g.beginPath(); g.ellipse(x, y, r * 1.4, r, R(), 0, TAU); g.fill(); }
      /* faint rows of pits along the case (the striae) */
      g.fillStyle = `rgba(0,0,0,${male ? .12 : .2})`;
      for (let row = 0; row < 6; row++) for (let i = 0; i < 26; i++) { const t = i / 26, x = lerp(4, -64, t), y = -27 + row * 5.4 + Math.sin(t * 2.8) * -4 + t * t * 6 * (row / 6); g.beginPath(); g.arc(x + R() * .6, y, .32, 0, TAU); g.fill(); }
      yield;
      if (male && F.spots && !wet) {
        /* the black spots: irregular blotches, more of them towards the back and the sides; a soft rim, a dark core */
        for (let k = 0; k < 19; k++) {
          const x = -64 + Math.pow(R(), .8) * 62, y = -30 + R() * 36, r = .9 + R() * R() * 4, blobs = [];
          for (let j = 0; j < 3; j++) blobs.push([x + (R() - .5) * r, y + (R() - .5) * r * .7, r * (.7 + R() * .5), r * (.5 + R() * .4), R() * TAU]);
          const col = mx([14, 12, 10], deep, .08 * R());
          for (const [k2, a] of [[1.18, .25], [1, .9]]) { g.fillStyle = css(col, a); for (const [bx, by, rx, ry, rot] of blobs) { g.beginPath(); g.ellipse(bx, by, rx * k2, ry * k2, rot, 0, TAU); g.fill(); } }
        }
      }
      if (!male) {
        /* the female: dull, coarsely pitted, with short reddish-brown hairs */
        punct(g, box, R, 900, .3, .2, .45, .05);
        yield;
        const hc = (x, y) => mx([120, 76, 40], [70, 44, 22], R()); hc.tip = [176, 120, 70]; hc.dark = [30, 18, 10];
        yield* coat(g, inside, p, box, R, 1600, () => [-1, .25], hc, { len: 1.6, w: .22 });
      }
      /* the dome: light on the upper middle, deep shade along the lower edge and the tip */
      const dg = g.createRadialGradient(-24, -24, 2, -26, -18, 40);
      dg.addColorStop(0, `rgba(255,252,236,${male ? .16 : .08})`); dg.addColorStop(.5, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,.42)');
      g.fillStyle = dg; g.fillRect(-74, -40, 90, 54);
      g.restore();
      /* the case's lower rim (epipleuron), the line of the fold, the top edge catching the light */
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(4, 6.5); g.bezierCurveTo(-20, 9, -50, 9, -62, -4); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .8; g.beginPath(); g.moveTo(2, -12); g.bezierCurveTo(-20, -18, -46, -16, -60, -8); g.stroke();
      g.save(); g.clip(p); g.strokeStyle = 'rgba(255,255,240,.35)'; g.lineWidth = .9; g.beginPath(); g.moveTo(7, -25.6); g.bezierCurveTo(-6, -37.2, -50, -35.2, -63.4, -13.6); g.stroke(); g.restore();
      /* specular: the sky in the lacquer, then the sharp glints */
      const top = curve([8, -26], [-6, -38], [-50, -36], [-64, -14], 22).map(([x, y]) => [x, y + 4.2]);
      const shine = wet ? 1.25 : male ? 1 : .35;
      glint(g, top, 7, 1.3, .26 * shine, .7 * shine, wet ? [214, 230, 255] : [255, 252, 238]);
      g.save(); g.clip(p);
      g.filter = 'blur(1.2px)'; g.fillStyle = `rgba(255,255,255,${.5 * shine})`; g.beginPath(); g.ellipse(-32, -30.5, 9, 1.6, -.08, 0, TAU); g.fill();
      g.filter = 'none'; g.fillStyle = `rgba(255,255,255,${.9 * shine})`; g.beginPath(); g.ellipse(-31, -30.6, 4.2, .7, -.08, 0, TAU); g.fill();
      g.beginPath(); g.arc(-8, -30.4, .9, 0, TAU); g.fill();
      /* a cool reflection of the sky low on the case */
      const rg = g.createLinearGradient(0, 0, 0, 9); rg.addColorStop(0, 'rgba(160,190,230,0)'); rg.addColorStop(1, `rgba(160,190,230,${.12 * shine})`); g.fillStyle = rg; g.fillRect(-70, 0, 80, 10);
      g.restore();
    }, BRES);
  }
  function* beetleParts(form, male, hornK, pale) {
    const F = FORMS[form] || FORMS.hercules, R = mulberry32(101 + Math.round(hornK * 40) + form.length * 13 + (male ? 0 : 5));
    const black = blackOf(pale, male ? hexToRgb(F.body) : [22, 17, 13]), B = { hornK };
    const sheen = pale > .5 ? .5 : 1;
    /* --- the pronotum and the great thoracic horn, in the frame translate(14,-16) --- */
    {
      const L = 92 * hornK, p = new Path2D();
      let box;
      if (male) {
        p.moveTo(-10, 22); p.bezierCurveTo(-14, 4, -8, -12, 6, -14);
        p.bezierCurveTo(16 + L * .2, -16 - L * .12, 16 + L * .6, -12 - L * .1, 16 + L, -2 - L * .02);
        p.quadraticCurveTo(18 + L, 4, 14 + L, 4);
        p.bezierCurveTo(16 + L * .65, -2 - L * .03, 16 + L * .25, 0, 22, 8);
        p.bezierCurveTo(24, 16, 22, 22, 18, 24); p.closePath();
        box = [-18, -18 - L * .14, 22 + L, 30];
      } else {
        p.moveTo(-10, 22); p.bezierCurveTo(-14, 2, -6, -12, 8, -10); p.bezierCurveTo(22, -8, 26, 8, 22, 22); p.closePath();
        box = [-18, -16, 28, 26];
      }
      B.pron = yield* bakeJob(box[0], box[1], box[2], box[3], function* (g, inside) {
        const pg = g.createRadialGradient(2, -6, 1, 6, 4, 28);
        pg.addColorStop(0, css(mx(black, WHITE, .2 * sheen))); pg.addColorStop(.4, css(mx(black, WHITE, .05))); pg.addColorStop(1, css(mx(black, INK, .3)));
        g.fillStyle = pg; g.fill(p);
        g.save(); g.clip(p);
        punct(g, [-14, -14, 22, 24], R, male ? 140 : 420, male ? .25 : .4, .15, .35, .07);
        if (male) {
          /* the horn: darker underneath, a long sky reflection on top */
          const hg = g.createLinearGradient(0, -14 - L * .12, 0, 6);
          hg.addColorStop(0, css(mx(black, [200, 215, 235], .2 * sheen))); hg.addColorStop(.45, css(black, 0)); hg.addColorStop(1, css(mx(black, INK, .5)));
          g.fillStyle = hg; g.fillRect(14, -18 - L * .14, L + 8, 26 + L * .14);
        }
        g.restore();
        volume(g, p, box, .05, .3, .12);
        yield;
        if (male) {
          /* the golden brush under the horn */
          const low = curve([14 + L, 4], [16 + L * .65, -2 - L * .03], [16 + L * .25, 0], [22, 8], 60);
          for (let i = 0; i < 420; i++) {
            const q = low[Math.floor(lerp(5, 55, R()))], hl = 1.4 + R() * 3.6 * (.6 + hornK * .4);
            g.fillStyle = pale > .5 ? css([240, 222, 176], .5) : css(mx([214, 146, 58], [150, 92, 30], R()), .55 + R() * .4);
            hair(g, q[0] + (R() - .5) * 1.2, q[1] - .6, -.25 - R() * .2, 1, hl, .18 + R() * .12, (R() - .5) * .8);
          }
          /* specular along the top of the horn and over the dome */
          const topC = curve([6, -14], [16 + L * .2, -16 - L * .12], [16 + L * .6, -12 - L * .1], [16 + L, -2 - L * .02], 26).map(([x, y]) => [x, y + 1.6]);
          glint(g, topC, 4, 1.1, .22 * sheen, .85 * sheen);
          g.save(); g.clip(p); g.fillStyle = `rgba(255,255,255,${.12 * sheen})`; g.filter = 'blur(2px)'; g.beginPath(); g.ellipse(3, -6, 7, 5, -.5, 0, TAU); g.fill(); g.filter = 'none'; g.restore();
          g.fillStyle = `rgba(255,255,255,${.85 * sheen})`; g.beginPath(); g.ellipse(2, -9, 2.4, 1, -.6, 0, TAU); g.fill();
        } else {
          g.fillStyle = `rgba(255,255,255,${.3 * sheen})`; g.filter = 'blur(1px)'; g.beginPath(); g.ellipse(6, -6, 7, 2, -.2, 0, TAU); g.fill(); g.filter = 'none';
          glint(g, curve([-6, -6], [0, -10], [10, -10], [16, -6], 10), 3, .7, .15 * sheen, .5 * sheen);
        }
      }, BRES);
    }
    /* --- the head, the head horn, an antenna, the mouth brushes, in the frame translate(34,2) --- */
    {
      const L = 46 * hornK, head = new Path2D(), horn = new Path2D();
      head.ellipse(6, 2, 11, 9, -.2, 0, TAU);
      if (male && hornK > 0) {
        horn.moveTo(8, -6); horn.bezierCurveTo(8 + L * .4, -6, 8 + L * .8, -12 - L * .1, 8 + L, -18 - L * .18);
        horn.lineTo(8 + L - 1, -15 - L * .18); horn.bezierCurveTo(8 + L * .75, -6 - L * .08, 8 + L * .4, 4, 10, 6); horn.closePath();
      }
      const box = [-7, -22 - L * .2, 12 + L, 14];
      B.head = yield* bakeJob(box[0], box[1], box[2], box[3], function* (g) {
        /* the antenna (behind): a thin stalk and a club of three leaves */
        g.strokeStyle = css(blackOf(pale, [90, 50, 24])); g.lineWidth = 1.2; g.beginPath(); g.moveTo(12, 6); g.quadraticCurveTo(16, 7, 19.5, 9.5); g.stroke();
        for (let k = 0; k < 3; k++) { g.fillStyle = css(blackOf(pale, mx([150, 86, 36], [96, 52, 22], k / 3))); g.beginPath(); g.ellipse(21 + k * .5, 9.4 + k * .9, 2.6, .8, .5, 0, TAU); g.fill(); }
        /* the maxillary brushes: orange hairs that lap fruit juice */
        for (let i = 0; i < 60; i++) { g.fillStyle = css(mx([224, 150, 60], [170, 96, 34], R()), .85); hair(g, 13 + R() * 4, 9 + R() * 2, .6, .8, 1.5 + R() * 2, .18, (R() - .5) * .6); }
        yield;
        const hg = g.createRadialGradient(3, -2, .5, 6, 2, 12);
        hg.addColorStop(0, css(mx(black, WHITE, .22 * sheen))); hg.addColorStop(.5, css(black)); hg.addColorStop(1, css(mx(black, INK, .35)));
        g.fillStyle = hg; g.fill(head);
        g.save(); g.clip(head); punct(g, [-6, -8, 18, 12], R, 80, .25, .12, .3, .05); g.restore();
        if (male && hornK > 0) {
          const hhg = g.createLinearGradient(0, -18 - L * .18, 0, 6);
          hhg.addColorStop(0, css(mx(black, [200, 215, 235], .22 * sheen))); hhg.addColorStop(.5, css(black)); hhg.addColorStop(1, css(mx(black, INK, .4)));
          g.fillStyle = hhg; g.fill(horn);
          /* the teeth on top of the head horn */
          g.fillStyle = css(mx(black, WHITE, .06));
          for (const t of [.45, .62]) { const x = 8 + L * t, y = -6 - L * t * .14 - 5; g.beginPath(); g.moveTo(x - 3, y + 3.2); g.quadraticCurveTo(x - .5, y - 3.4, x + 3, y + 3.2); g.fill(); g.fillStyle = `rgba(255,255,255,${.5 * sheen})`; g.beginPath(); g.arc(x - .6, y - .8, .45, 0, TAU); g.fill(); g.fillStyle = css(mx(black, WHITE, .06)); }
          const tc = curve([8, -6], [8 + L * .4, -6], [8 + L * .8, -12 - L * .1], [8 + L, -18 - L * .18], 18).map(([x, y]) => [x, y + 1.3]);
          glint(g, tc, 3, .9, .2 * sheen, .85 * sheen);
          g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .6; g.stroke(horn);
        }
        /* the eye: a dark facetted dome under the brow, with a glint */
        g.fillStyle = css(blackOf(pale, [40, 26, 18])); g.beginPath(); g.arc(9, -1, 2.3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(9.3, -.7, 1.7, 0, TAU); g.fill();
        g.fillStyle = `rgba(255,255,255,${.8 * sheen})`; g.beginPath(); g.arc(8.4, -1.8, .55, 0, TAU); g.fill();
        g.fillStyle = `rgba(255,255,255,${.75 * sheen})`; g.beginPath(); g.ellipse(2, -4, 2.6, .9, -.5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .6; g.stroke(head);
      }, BRES);
    }
    /* --- the legs: a glossy femur, a toothed tibia, the five-beaded foot with two claws --- */
    const legCol = blackOf(pale, [26, 20, 16]);
    const seg = function* (len, w0, w1, spines) {
      const p = new Path2D();
      p.moveTo(-w0 / 2, 0); p.quadraticCurveTo(-w0 * .62, len * .5, -w1 / 2, len); p.quadraticCurveTo(0, len + w1 * .45, w1 / 2, len);
      p.quadraticCurveTo(w0 * .62, len * .5, w0 / 2, 0); p.quadraticCurveTo(0, -w0 * .45, -w0 / 2, 0); p.closePath();
      const box = [-w0 - 2.5, -w0 * .5 - 1, w0 + 2.5, len + w1 + 2];
      return yield* bakeJob(box[0], box[1], box[2], box[3], (g) => {
        const lg = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0);
        lg.addColorStop(0, css(mx(legCol, INK, .3))); lg.addColorStop(.3, css(mx(legCol, WHITE, .14 * sheen))); lg.addColorStop(.6, css(legCol)); lg.addColorStop(1, css(mx(legCol, INK, .4)));
        g.fillStyle = lg; g.fill(p);
        if (spines) {
          g.fillStyle = css(legCol);
          for (let k = 1; k <= 4; k++) { const y = len * k / 5, w = lerp(w0, w1, k / 5) / 2; for (const sd of [-1, 1]) { if (sd < 0 && k % 2) continue; g.beginPath(); g.moveTo(sd * w * .8, y - .9); g.lineTo(sd * (w + 1.6 + k * .2), y + .5); g.lineTo(sd * w * .8, y + .7); g.fill(); } }
          g.beginPath(); g.moveTo(-w1 * .3, len); g.lineTo(-w1 * .6, len + 2.4); g.lineTo(0, len + .6); g.lineTo(w1 * .6, len + 2.2); g.lineTo(w1 * .3, len); g.fill();
        }
        g.strokeStyle = `rgba(255,255,255,${.35 * sheen})`; g.lineWidth = .5; g.beginPath(); g.moveTo(-w0 * .18, w0 * .3); g.lineTo(-w1 * .18, len - 1); g.stroke();
      }, BRES * 1.4);
    };
    B.femur = yield* seg(16, 5.6, 4.8, false); B.tibia = yield* seg(14, 4.2, 5, true);
    {
      const box = [-3.2, -1, 3.2, 15.5];
      B.tars = yield* bakeJob(box[0], box[1], box[2], box[3], (g) => {
        for (let k = 0; k < 5; k++) {
          const y = k * 2.6 + 1.2, r = lerp(1.5, 1.05, k / 4), sy = k === 4 ? 2 : 1.2;
          g.fillStyle = css(mx(legCol, WHITE, .05)); g.beginPath(); g.ellipse(0, y, r, sy, 0, 0, TAU); g.fill();
          g.fillStyle = `rgba(255,255,255,${.3 * sheen})`; g.beginPath(); g.ellipse(-r * .35, y - sy * .3, r * .3, sy * .3, 0, 0, TAU); g.fill();
          if (k < 4) { g.fillStyle = css([150, 96, 40], .5); g.fillRect(-r * .9, y + sy * .6, r * 1.8, .35); }
        }
        g.strokeStyle = css(legCol); g.lineWidth = .7;
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(0, 12.6); g.quadraticCurveTo(sd * 1.6, 14, sd * 1.2, 15.2); g.stroke(); }
      }, BRES * 1.6);
    }
    yield;
    B.femurFar = darker(B.femur, .45); B.tibiaFar = darker(B.tibia, .45); B.tarsFar = darker(B.tars, .45);
    /* --- the hind wings (flight): amber membranes with brown veins --- */
    {
      const p = new Path2D(); p.moveTo(0, 0); p.bezierCurveTo(-40, -50, -130, -40, -150, -6); p.bezierCurveTo(-120, 18, -40, 22, 0, 0); p.closePath();
      B.wing = yield* bakeJob(-154, -42, 3, 20, (g) => {
        const wg = g.createLinearGradient(0, 0, -150, 0); wg.addColorStop(0, 'rgba(140,92,44,.78)'); wg.addColorStop(.5, 'rgba(196,150,96,.4)'); wg.addColorStop(1, 'rgba(220,196,150,.22)');
        g.fillStyle = wg; g.fill(p);
        g.save(); g.clip(p);
        const ig = g.createLinearGradient(-30, -30, -110, 10); ig.addColorStop(0, 'rgba(160,220,255,0)'); ig.addColorStop(.5, 'rgba(160,220,255,.12)'); ig.addColorStop(.7, 'rgba(255,200,240,.08)'); ig.addColorStop(1, 'rgba(160,220,255,0)');
        g.fillStyle = ig; g.fillRect(-152, -42, 156, 64);
        g.strokeStyle = 'rgba(70,36,14,.75)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-40, -47, -128, -38, -149, -7); g.stroke();
        g.lineWidth = 1;
        for (const v of [-26, -12, 0, 10]) { g.strokeStyle = 'rgba(80,44,18,.55)'; g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(-60, v - 12, -136, v * .5 - 2); g.stroke(); }
        g.strokeStyle = 'rgba(80,44,18,.3)'; g.lineWidth = .5;
        for (let i = 0; i < 14; i++) { const x = -30 - i * 8; g.beginPath(); g.moveTo(x, -26 + i); g.lineTo(x - 4, 10); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = .6; g.beginPath(); g.moveTo(-60, -34); g.lineTo(-110, 6); g.stroke();
        g.restore();
      }, 1.6);
      /* the abdomen's underside, seen when the wing cases lift */
      const a = new Path2D(); a.moveTo(6, -20); a.bezierCurveTo(-10, -26, -46, -22, -58, -8); a.bezierCurveTo(-62, 4, -50, 9, -40, 9); a.lineTo(4, 8); a.closePath();
      B.abdo = yield* bakeJob(-64, -28, 9, 12, (g) => {
        const ag = g.createLinearGradient(0, -24, 0, 10); ag.addColorStop(0, css(blackOf(pale, [110, 66, 36]))); ag.addColorStop(1, css(blackOf(pale, [36, 22, 14])));
        g.fillStyle = ag; g.fill(a);
        g.save(); g.clip(a);
        for (let k = 0; k < 6; k++) { const x = -8 - k * 8.5; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, -20 + k * 1.8); g.quadraticCurveTo(x - 3, -6, x + 1, 8); g.stroke(); g.strokeStyle = 'rgba(255,220,170,.18)'; g.lineWidth = .6; g.beginPath(); g.moveTo(x + 1.2, -20 + k * 1.8); g.quadraticCurveTo(x - 1.8, -6, x + 2.2, 8); g.stroke(); }
        for (let i = 0; i < 260; i++) { g.fillStyle = css([210, 150, 80], .35); hair(g, -56 + R() * 60, -18 + R() * 26, -.3, 1, 1 + R() * 1.5, .14, (R() - .5) * .5); }
        g.restore();
      }, BRES);
    }
    return B;
  }
  function drawBeetle(ctx, o) {
    const male = o.male !== false, form = FORMS[o.form] ? o.form : 'hercules', F = FORMS[form];
    const wet = clamp(o.wet || 0, 0, 1), pale = clamp(o.pale || 0, 0, 1), walk = o.walk || 0, open = o.open || 0, lift = o.lift || 0, pinch = o.pinch || 0;
    const hornK = male ? clamp(((o.lengthMM || 150) - 50) / 110, .15, 1.15) * F.horn : 0;
    const hq = Math.round(hornK * 20) / 20, pq = Math.round(pale * 4) / 4;
    const B = once(`B|${form}|${male}|${hq}|${pq}`, () => beetleParts(form, male, hq, pq));
    const Ed = B && once(`E|${form}|${male}|${pq}|0`, () => elytra(form, male, pq, false));
    const Ew = Ed && wet > .02 ? once(`E|${form}|${male}|${pq}|1`, () => elytra(form, male, pq, true)) : null;
    if (!B || !Ed || (wet > .02 && !Ew)) return Sprites.drawBeetle(ctx, o);
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    if (!male) ctx.scale(.9, .95);
    const gait = (k) => o.moving ? Math.sin(walk + k * Math.PI) : 0;
    const up = (k) => o.moving ? Math.max(0, Math.sin(walk + k * Math.PI + Math.PI / 2)) * 5 : 0;
    const leg = (hx, hy, kx, ky, ax, ay, tx, ty, w, far) => {
      const wk = w / 5.6;
      bone(ctx, far ? B.tarsFar : B.tars, ax, ay, tx, ty, 13.6, wk * 1.05);
      bone(ctx, far ? B.tibiaFar : B.tibia, kx, ky, ax, ay, 14, wk);
      bone(ctx, far ? B.femurFar : B.femur, hx, hy, kx, ky, 16, wk);
    };
    if (open < .5) {
      leg(26, 6, 40 + gait(1) * 6, 14, 52 + gait(1) * 10, 26 - up(1), 62 + gait(1) * 12, 30 - up(1), 4.4, true);
      leg(-2, 8, 4 + gait(0) * 6, 20, -2 + gait(0) * 10, 28 - up(0), 2 + gait(0) * 12, 30 - up(0), 4.4, true);
      leg(-16, 8, -30 + gait(1) * 6, 18, -40 + gait(1) * 10, 26 - up(1), -54 + gait(1) * 10, 30 - up(1), 4.4, true);
    }
    if (open > .05) {
      const beat = Math.sin(o.flap || 0);
      for (const k of [0, 1]) {
        ctx.save(); ctx.translate(-4, -26); ctx.globalAlpha = Math.min(1, .95 * open) * (k ? .85 : 1);
        ctx.rotate(.35 + beat * .75 + k * .3); ctx.scale(1, .35 + Math.abs(beat) * .65);
        put(ctx, B.wing); ctx.restore();
      }
      put(ctx, B.abdo);
    }
    ctx.save(); ctx.translate(8, -26); ctx.rotate(open * .85); ctx.translate(-8, 26);
    put(ctx, Ed);
    if (Ew) { ctx.globalAlpha = wet; put(ctx, Ew); ctx.globalAlpha = 1; }
    ctx.restore();
    if (open < .5) {
      leg(30, 6, 44 + gait(0) * 6, 12, 56 + gait(0) * 10, 24 - up(0), 66 + gait(0) * 12, 30 - up(0), 5.6, false);
      leg(0, 8, 10 + gait(1) * 6, 18, 4 + gait(1) * 10, 28 - up(1), 10 + gait(1) * 12, 30 - up(1), 5.6, false);
      leg(-14, 8, -26 + gait(0) * 6, 16, -36 + gait(0) * 10, 26 - up(0), -50 + gait(0) * 10, 30 - up(0), 5.6, false);
    } else {
      for (const [hx, kx, ax] of [[30, 40, 48], [0, 6, 0], [-14, -26, -40]]) leg(hx, 8, kx, 18, ax, 24, ax + 6, 27, 5, false);
    }
    ctx.save(); ctx.translate(34, 2); ctx.rotate(-pinch * .32 + (o.eat ? Math.sin(o.eat * 20) * .05 : 0)); put(ctx, B.head); ctx.restore();
    ctx.save(); ctx.translate(14, -16); ctx.rotate(-lift * .38); put(ctx, B.pron); ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     THE GRUB — the same path-following body as Sprites.drawGrub:
     twelve segments, each a painted disc placed along the path
     (local +x towards the head, +y the belly side)
     ============================================================ */
  const DRES = 34;
  function grubDisc(k, inst1, pale) {
    const R = mulberry32(300 + k * 7 + (inst1 ? 1 : 0));
    let base = [238, 228, 200];
    if (k >= 8) base = mx(base, [104, 108, 120], (k - 7) / 4 * .62);
    if (inst1) base = mx(base, [252, 248, 236], .45);
    if (pale) base = mx(base, [255, 252, 244], .5);
    return bake(-1.4, -1.4, 1.4, 1.4, (g) => {
      const dg = g.createRadialGradient(-.12, -.2, .05, 0, 0, 1.02);
      dg.addColorStop(0, css(mx(base, WHITE, .35))); dg.addColorStop(.55, css(base)); dg.addColorStop(.86, css(mx(base, [150, 120, 84], .3))); dg.addColorStop(1, css(mx(base, [110, 86, 58], .55)));
      g.fillStyle = dg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.clip();
      /* the gut showing through the skin at the back */
      if (k >= 7) { const gg = g.createRadialGradient(.05, -.05, .05, 0, 0, .8); gg.addColorStop(0, css([70, 70, 84], .28 * (k - 6) / 5)); gg.addColorStop(1, 'rgba(70,70,84,0)'); g.fillStyle = gg; g.fillRect(-1, -1, 2, 2); }
      /* folds across the segment (each segment has a few little rings) */
      for (const x0 of [.42, .08, -.3]) {
        g.strokeStyle = css([120, 92, 56], .22); g.lineWidth = .05; g.beginPath(); g.moveTo(x0 - .1, -1); g.quadraticCurveTo(x0 + .14, 0, x0 - .1, 1); g.stroke();
        g.strokeStyle = 'rgba(255,255,250,.3)'; g.lineWidth = .04; g.beginPath(); g.moveTo(x0 - .17, -1); g.quadraticCurveTo(x0 + .07, 0, x0 - .17, 1); g.stroke();
      }
      /* the skin: fine pores and wrinkles */
      for (let i = 0; i < 160; i++) { const x = (R() - .5) * 2, y = (R() - .5) * 2; g.fillStyle = R() < .5 ? 'rgba(90,70,40,.08)' : 'rgba(255,255,255,.1)'; g.fillRect(x, y, .03 + R() * .04, .015); }
      g.restore();
      /* spiracle: a little brown breathing hole on the side */
      if (k >= 2 && k <= 10) {
        g.fillStyle = '#9a6228'; g.beginPath(); g.ellipse(-.5, .12, .09, .14, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a2a10'; g.beginPath(); g.ellipse(-.49, .12, .045, .085, 0, 0, TAU); g.fill();
      }
      /* sparse reddish setae on the back, sticking out past the edge */
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (.12 + .76 * R()), x = Math.cos(a) * .9, y = Math.sin(a) * .9;
        g.strokeStyle = css([176, 120, 64], .55); g.lineWidth = .025; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - .5) * (.2 + R() * .18), y + Math.sin(a - .5) * (.2 + R() * .18)); g.stroke();
      }
      for (let i = 0; i < 4; i++) { const a = -Math.PI * (.2 + .6 * R()), x = Math.cos(a) * .92, y = Math.sin(a) * .92; g.strokeStyle = css([176, 120, 64], .4); g.lineWidth = .02; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * .16, y + Math.sin(a) * .16); g.stroke(); }
    }, DRES);
  }
  function grubHead(pale) {
    return bake(-1.5, -1.5, 1.6, 1.5, (g) => {
      const c0 = pale ? [236, 206, 150] : [212, 136, 58], c1 = pale ? [176, 140, 84] : [110, 56, 18];
      const hg = g.createRadialGradient(-.3, -.4, .05, 0, 0, 1.02);
      hg.addColorStop(0, css(mx(c0, WHITE, .35))); hg.addColorStop(.45, css(c0)); hg.addColorStop(1, css(c1));
      g.fillStyle = hg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
      /* the Y-shaped suture on the head capsule, the clypeus at the front, tiny pits */
      g.strokeStyle = 'rgba(70,30,6,.5)'; g.lineWidth = .05;
      g.beginPath(); g.moveTo(-.85, 0); g.lineTo(-.15, 0); g.lineTo(.45, -.55); g.moveTo(-.15, 0); g.lineTo(.45, .55); g.stroke();
      g.fillStyle = css(mx(c1, [60, 30, 10], .3), .7); g.beginPath(); g.ellipse(.82, 0, .2, .42, 0, 0, TAU); g.fill();
      const R = mulberry32(55); for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(60,24,4,.3)'; g.beginPath(); g.arc((R() - .5) * 1.5, (R() - .5) * 1.5, .03, 0, TAU); g.fill(); }
      /* stubby antennae, a gloss */
      g.strokeStyle = css(c1); g.lineWidth = .1; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(.6, sd * .6); g.lineTo(.95, sd * .95); g.stroke(); }
      g.filter = 'blur(.6px)'; g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-.25, -.45, .35, .18, -.4, 0, TAU); g.fill(); g.filter = 'none';
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-.22, -.46, .14, .06, -.4, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,16,4,.4)'; g.lineWidth = .05; g.beginPath(); g.arc(0, 0, .98, 0, TAU); g.stroke();
    }, DRES);
  }
  function drawGrub(ctx, pts, r, o = {}) {
    if (pts.length < 2) return;
    const inst1 = o.instar === 1, pale = !!o.pale;
    const discs = [];
    for (let k = 1; k < 12; k++) { const d = once(`gd|${k}|${inst1}|${pale}`, () => grubDisc(k, inst1, pale)); if (!d) return Sprites.drawGrub(ctx, pts, r, o); discs.push(d); }
    const head = once('gh|' + pale, () => grubHead(pale)); if (!head) return Sprites.drawGrub(ctx, pts, r, o);
    const n = 12, segs = [];
    let total = 0; const cum = [0];
    for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(total); }
    const len = r * 4.8;
    for (let k = 0; k < n; k++) {
      const d = Math.min(total, k / (n - 1) * len);
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const a = pts[i - 1], b = pts[i], sg = cum[i] - cum[i - 1] || 1, t = clamp((d - cum[i - 1]) / sg, 0, 1);
      segs.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: Math.atan2(a.y - b.y, a.x - b.x) });
    }
    const phase = o.phase || 0;
    const radius = (k) => r * (k === 0 ? .62 : k < 4 ? .7 + k * .06 : k < 9 ? .9 + (k - 4) * .02 : 1.02 - (k - 9) * .04) * (1 + .06 * Math.sin(phase - k * .9));
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    for (let k = n - 1; k >= 1; k--) { const sg = segs[k]; ctx.beginPath(); ctx.arc(sg.x + r * .15, sg.y + r * .32, radius(k) * 1.02, 0, TAU); ctx.fill(); }
    for (let k = n - 1; k >= 1; k--) {
      const sg = segs[k], rr2 = radius(k);
      ctx.save(); ctx.translate(sg.x, sg.y); ctx.rotate(sg.ang); ctx.scale(rr2, rr2); put(ctx, discs[k - 1]); ctx.restore();
    }
    /* six little legs on the thorax: jointed, brown, darker at the tips */
    ctx.lineCap = 'round';
    for (let k = 1; k <= 3; k++) {
      const sg = segs[k], a = sg.ang - Math.PI / 2, rr2 = radius(k), sw = Math.sin(phase * 1.5 + k) * .3;
      const x0 = sg.x + Math.cos(a) * rr2 * .75, y0 = sg.y + Math.sin(a) * rr2 * .75, x1 = sg.x + Math.cos(a - sw) * rr2 * 1.12, y1 = sg.y + Math.sin(a - sw) * rr2 * 1.12;
      const x2 = sg.x + Math.cos(a - sw + .45) * rr2 * 1.22 + Math.cos(sg.ang) * rr2 * .32, y2 = sg.y + Math.sin(a - sw + .45) * rr2 * 1.22 + Math.sin(sg.ang) * rr2 * .32;
      ctx.strokeStyle = '#6a3a14'; ctx.lineWidth = Math.max(.7, r * .1); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(214,160,96,.8)'; ctx.lineWidth = Math.max(.35, r * .045); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    /* the hard brown head and its working jaws */
    const h = segs[0], hr = radius(0);
    const jaw = Math.sin(phase * 3) * .25;
    ctx.fillStyle = '#1e0e04';
    for (const sgn of [-1, 1]) { const a = h.ang + sgn * (.35 + jaw); ctx.beginPath(); ctx.moveTo(h.x + Math.cos(h.ang + sgn * .6) * hr * .7, h.y + Math.sin(h.ang + sgn * .6) * hr * .7); ctx.quadraticCurveTo(h.x + Math.cos(a + sgn * .2) * hr * 1.3, h.y + Math.sin(a + sgn * .2) * hr * 1.3, h.x + Math.cos(a) * hr * 1.45, h.y + Math.sin(a) * hr * 1.45); ctx.lineTo(h.x + Math.cos(h.ang) * hr * .8, h.y + Math.sin(h.ang) * hr * .8); ctx.fill(); }
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.ang); ctx.scale(hr, hr); put(ctx, head); ctx.restore();
    if (o.shed > 0) {
      ctx.strokeStyle = `rgba(255,250,230,${.8 * (1 - o.shed)})`; ctx.lineWidth = r * .25;
      ctx.beginPath(); for (let k = Math.floor(o.shed * n); k < n; k++) { const sg = segs[k]; k === Math.floor(o.shed * n) ? ctx.moveTo(sg.x, sg.y) : ctx.lineTo(sg.x, sg.y); } ctx.stroke();
    }
  }
  /* a shed skin: papery, translucent, wrinkled, the empty head capsule at the front */
  function drawExuvia(ctx, r, ang) {
    const img = once('exu', () => bake(-2.3, -1.1, 2.4, 1.1, (g) => {
      const R = mulberry32(77), p = new Path2D();
      p.moveTo(1.6, 0); p.bezierCurveTo(1, -.8, -1.4, -.6, -2, 0); p.bezierCurveTo(-1.4, .4, 1, .7, 1.6, 0); p.closePath();
      g.fillStyle = 'rgba(236,222,186,.5)'; g.fill(p);
      g.save(); g.clip(p);
      for (let i = 0; i < 40; i++) { const x = -2 + R() * 3.6; g.strokeStyle = `rgba(150,118,74,${.25 + R() * .3})`; g.lineWidth = .03 + R() * .03; g.beginPath(); g.moveTo(x, -.7); g.quadraticCurveTo(x + (R() - .5) * .3, 0, x + (R() - .5) * .2, .7); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-.2, -.25, 1.2, .12, 0, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(150,118,74,.6)'; g.lineWidth = .05; g.stroke(p);
      const hg = g.createRadialGradient(1.6, -.15, .05, 1.7, 0, .48); hg.addColorStop(0, 'rgba(220,150,70,.85)'); hg.addColorStop(1, 'rgba(120,64,20,.8)');
      g.fillStyle = hg; g.beginPath(); g.arc(1.72, 0, .45, 0, TAU); g.fill();
    }, 30));
    if (!img) return Sprites.drawExuvia(ctx, r, ang);
    ctx.save(); ctx.rotate(ang); ctx.scale(r, r); ctx.globalAlpha *= .9; put(ctx, img); ctx.restore();
  }
  /* the egg: a pearly shell, the curled grub showing through near hatching */
  function drawEgg(ctx, o) {
    const img = once('egg', () => bake(-1.2, -1.2, 1.2, 1.2, (g) => {
      const R = mulberry32(5);
      const eg = g.createRadialGradient(-.35, -.4, .05, 0, 0, 1.15); eg.addColorStop(0, '#ffffff'); eg.addColorStop(.55, '#f3edd8'); eg.addColorStop(1, '#bcae86');
      g.fillStyle = eg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.clip();
      for (let i = 0; i < 120; i++) { g.fillStyle = R() < .5 ? 'rgba(160,140,100,.12)' : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc((R() - .5) * 2, (R() - .5) * 2, .02 + R() * .05, 0, TAU); g.fill(); }
      const rg = g.createLinearGradient(0, .3, 0, 1); rg.addColorStop(0, 'rgba(255,240,210,0)'); rg.addColorStop(1, 'rgba(255,240,210,.35)'); g.fillStyle = rg; g.fillRect(-1, .3, 2, .7);
      g.restore();
      g.filter = 'blur(.5px)'; g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-.35, -.45, .26, .14, -.5, 0, TAU); g.fill(); g.filter = 'none';
    }, 30));
    if (!img) return Sprites.drawEgg(ctx, o);
    const s = o.s || 1, crack = o.crack || 0, grow = o.grow || 0;
    ctx.save(); ctx.scale(s, s);
    const rx = 5 + grow * 1.4, ry = 4 + grow * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(.8, ry * .9, rx, ry * .35, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.scale(rx, ry); put(ctx, img); ctx.restore();
    if (grow > .5) { ctx.globalAlpha = (grow - .5) * .3; ctx.save(); ctx.scale(.18, .18); drawGrub(ctx, Sprites.grubShape(18, 1, 0), 18, { instar: 1 }); ctx.restore(); ctx.globalAlpha = 1; }
    if (crack > 0) {
      ctx.strokeStyle = 'rgba(110,90,60,.8)'; ctx.lineWidth = .28;
      ctx.beginPath(); ctx.moveTo(-rx * .6, -ry * .2); for (let k = 0; k < 6; k++) ctx.lineTo(-rx * .6 + k * rx * .24 * crack * 1.4, -ry * .2 + (k % 2 ? -1 : 1) * ry * .25); ctx.stroke();
    }
    ctx.restore();
  }
  /* ---------- the pupa: a smooth, glossy, amber case; a male's horns in their sheaths ---------- */
  function pupaBake(male, hornK, dark) {
    const R = mulberry32(400 + Math.round(hornK * 20)), base = mx([232, 198, 132], [150, 84, 36], dark ? .8 : 0);
    const L = 50 * hornK;
    return bake(-64, -38 - (male ? L * .1 : 0), 40 + (male ? L : 0), 28, (g) => {
      const gr = (cx, cy, rad) => { const q = g.createRadialGradient(cx - rad * .35, cy - rad * .45, rad * .08, cx, cy, rad); q.addColorStop(0, css(mx(base, [255, 252, 236], .5))); q.addColorStop(.55, css(base)); q.addColorStop(1, css(mx(base, [60, 30, 10], .5))); return q; };
      const ab = new Path2D(); ab.ellipse(-22, 2, 38, 22, .08, 0, TAU);
      g.fillStyle = gr(-22, 2, 40); g.fill(ab);
      g.save(); g.clip(ab);
      for (let j = 0; j < 7; j++) {
        const x = -52 + j * 8.6, hgt = 20 - Math.abs(j - 2.5) * 1.6;
        g.strokeStyle = css(mx(base, [80, 40, 12], .5), .45); g.lineWidth = 1.3; g.beginPath(); g.ellipse(x, 2, 3, hgt, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
        g.strokeStyle = 'rgba(255,248,226,.25)'; g.lineWidth = .7; g.beginPath(); g.ellipse(x + 1.2, 2, 3, hgt, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
        if (j > 0 && j < 6) { g.fillStyle = css(mx(base, [90, 44, 12], .6)); g.beginPath(); g.ellipse(x + 3, 10, .9, 1.4, 0, 0, TAU); g.fill(); }
      }
      for (let i = 0; i < 200; i++) { g.fillStyle = R() < .5 ? 'rgba(90,50,20,.07)' : 'rgba(255,250,230,.1)'; g.beginPath(); g.arc(-60 + R() * 76, -20 + R() * 44, .3 + R() * .6, 0, TAU); g.fill(); }
      g.restore();
      const th = new Path2D(); th.ellipse(16, -4, 22, 19, -.15, 0, TAU);
      g.fillStyle = gr(16, -4, 24); g.fill(th);
      g.strokeStyle = css(mx(base, [80, 40, 12], .4), .35); g.lineWidth = .8; g.stroke(th);
      /* the wing pads, with the ghost of their veins */
      const wp = new Path2D(); wp.ellipse(-2, 6, 18, 9, .35, 0, TAU);
      g.fillStyle = css(mx(base, [255, 250, 230], .22)); g.fill(wp);
      g.save(); g.clip(wp); g.strokeStyle = css(mx(base, [90, 50, 20], .35), .4); g.lineWidth = .5; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(12, -2 + k); g.quadraticCurveTo(-2, 4 + k * 2, -16, 4 + k * 3); g.stroke(); } g.restore();
      g.strokeStyle = css(mx(base, [80, 40, 12], .4), .4); g.lineWidth = .7; g.stroke(wp);
      /* the folded legs, jointed */
      for (const [a, b] of [[22, 14], [12, 16], [2, 18]]) {
        g.strokeStyle = css(mx(base, [80, 40, 10], .4)); g.lineWidth = 3.2; g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a - 6, b + 6, a - 16, b + 2); g.stroke();
        g.strokeStyle = css(mx(base, [255, 245, 220], .3), .6); g.lineWidth = 1.1; g.beginPath(); g.moveTo(a - .5, b - .5); g.quadraticCurveTo(a - 6, b + 4.6, a - 15, b + .8); g.stroke();
      }
      if (male) {
        const hs = new Path2D(); hs.moveTo(14, -22); hs.bezierCurveTo(28 + L * .3, -30, 30 + L * .7, -22, 32 + L, -8); hs.quadraticCurveTo(32 + L, 0, 26 + L, -2); hs.bezierCurveTo(26 + L * .6, -8, 30, -2, 32, 4); hs.closePath();
        const hh = new Path2D(); hh.moveTo(34, 0); hh.quadraticCurveTo(34 + L * .4, 2, 34 + L * .6, -8); hh.lineTo(32 + L * .6, -5); hh.quadraticCurveTo(32 + L * .3, 6, 30, 6); hh.closePath();
        for (const p of [hh, hs]) { g.fillStyle = gr(26 + L * .4, -12, 26 + L * .5); g.fill(p); g.strokeStyle = css(mx(base, [80, 40, 12], .4), .4); g.lineWidth = .7; g.stroke(p); }
        glint(g, curve([16, -21], [28 + L * .3, -28], [30 + L * .7, -21], [31 + L, -9], 14), 3, .8, .25, .7, [255, 252, 240]);
      }
      g.filter = 'blur(1.5px)'; g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-26, -12, 16, 3.5, -.1, 0, TAU); g.fill(); g.filter = 'none';
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-28, -13, 7, 1.1, -.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(10, -16, 5, 1.2, -.3, 0, TAU); g.fill();
    }, 2.6);
  }
  function drawPupa(ctx, o) {
    const male = o.male !== false, hornK = male ? clamp(((o.lengthMM || 150) - 50) / 110, .15, 1.1) : 0, hq = Math.round(hornK * 20) / 20, k = clamp(o.progress || 0, 0, 1);
    const a = once(`pu|${male}|${hq}|0`, () => pupaBake(male, hq, false)), b = a && once(`pu|${male}|${hq}|1`, () => pupaBake(male, hq, true));
    if (!a || !b) return Sprites.drawPupa(ctx, o);
    ctx.save(); ctx.scale(o.s || 1, o.s || 1);
    ctx.rotate(Math.sin((o.t || 0) * 2.3) * .03 * (o.wiggle || 0));
    put(ctx, a); if (k > .01) { ctx.globalAlpha *= k; put(ctx, b); }
    ctx.restore();
  }

  /* ============================================================
     FRUIT, STICKS, FUNGUS, THE MILLIPEDE, THE COATI
     ============================================================ */
  function fruitBake(kind) {
    const K = FRUIT_KINDS[kind], r = K.r, R = mulberry32(600 + kind.length);
    return bake(-r * 1.5, -r * 1.75, r * 1.5, r * 1.2, (g) => {
      let p = new Path2D();
      if (kind === 'mango') p.ellipse(0, 0, r * 1.25, r * .9, -.2, 0, TAU);
      else if (kind === 'fig') { p.moveTo(0, -r * 1.2); p.bezierCurveTo(r * .9, -r * .6, r * 1.1, r, 0, r); p.bezierCurveTo(-r * 1.1, r, -r * .9, -r * .6, 0, -r * 1.2); p.closePath(); }
      else p.arc(0, 0, r, 0, TAU);
      const fg = g.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.25);
      if (kind === 'mango') { fg.addColorStop(0, '#ffe590'); fg.addColorStop(.45, '#f4a83a'); fg.addColorStop(.8, '#d9502a'); fg.addColorStop(1, '#8a2a16'); }
      else if (kind === 'fig') { fg.addColorStop(0, '#a87aa0'); fg.addColorStop(.5, '#6a3a6a'); fg.addColorStop(1, '#2e142e'); }
      else { fg.addColorStop(0, '#f4fac0'); fg.addColorStop(.55, '#c9d86a'); fg.addColorStop(1, '#6a8a2a'); }
      g.fillStyle = fg; g.fill(p);
      g.save(); g.clip(p);
      if (kind === 'mango') { const bg = g.createRadialGradient(r * .6, r * .3, 1, r * .6, r * .3, r); bg.addColorStop(0, 'rgba(120,150,40,.4)'); bg.addColorStop(1, 'rgba(120,150,40,0)'); g.fillStyle = bg; g.fillRect(-r * 2, -r * 2, r * 4, r * 4); }
      if (kind === 'fig') { const bg = g.createLinearGradient(0, -r * 1.2, 0, -r * .2); bg.addColorStop(0, 'rgba(110,140,60,.6)'); bg.addColorStop(1, 'rgba(110,140,60,0)'); g.fillStyle = bg; g.fillRect(-r, -r * 1.3, r * 2, r * 1.2); }
      if (kind === 'guava') { const bg = g.createRadialGradient(-r * .4, r * .4, 1, -r * .4, r * .4, r); bg.addColorStop(0, 'rgba(240,160,150,.45)'); bg.addColorStop(1, 'rgba(240,160,150,0)'); g.fillStyle = bg; g.fillRect(-r * 2, -r * 2, r * 4, r * 4); }
      /* lenticels and speckles */
      for (let i = 0; i < r * 14; i++) { g.fillStyle = kind === 'fig' ? 'rgba(220,200,230,.35)' : kind === 'mango' ? 'rgba(255,240,180,.35)' : 'rgba(90,110,40,.3)'; g.beginPath(); g.arc((R() - .5) * r * 2.4, (R() - .5) * r * 2.2, .2 + R() * .35, 0, TAU); g.fill(); }
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .5; g.stroke(p);
      if (kind === 'fig') { g.strokeStyle = '#4a6a2a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -r * 1.15); g.quadraticCurveTo(.5, -r * 1.4, 1.2, -r * 1.65); g.stroke(); }
      if (kind === 'mango') { g.fillStyle = '#5a4a2a'; g.beginPath(); g.arc(-r * 1.15, -r * .1, 1.1, 0, TAU); g.fill(); }
      if (kind === 'guava') { g.fillStyle = '#5a5a2a'; for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + (k - 2) * .3; g.beginPath(); g.ellipse(Math.cos(a) * r * .9, Math.sin(a) * r * .9, 1, .5, a, 0, TAU); g.fill(); } }
      g.filter = 'blur(.8px)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-r * .4, -r * .45, r * .3, r * .14, -.5, 0, TAU); g.fill(); g.filter = 'none';
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-r * .42, -r * .47, r * .12, r * .05, -.5, 0, TAU); g.fill();
    }, 5);
  }
  function drawFruit(ctx, kind, bites, max, rot = 0) {
    const K = FRUIT_KINDS[kind]; if (!K) return Sprites.drawFruit(ctx, kind, bites, max, rot);
    if (bites <= 0) return Sprites.drawFruit(ctx, kind, bites, max, rot);
    const img = once('fr|' + kind, () => fruitBake(kind)); if (!img) return Sprites.drawFruit(ctx, kind, bites, max, rot);
    const r = K.r;
    ctx.save(); ctx.rotate(rot);
    const sh = ctx.createRadialGradient(0, r * .8, 1, 0, r * .8, r * 1.1); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, r * .8, r * 1.1, r * .28, 0, 0, TAU); ctx.fill();
    put(ctx, img);
    const eaten = 1 - bites / max;
    if (eaten > 0) {
      const fx = r * .2, fy = -r * .1, rx = r * .7 * eaten + r * .2, ry = r * .5 * eaten + r * .15;
      const fl = ctx.createRadialGradient(fx - rx * .3, fy - ry * .3, 1, fx, fy, rx);
      fl.addColorStop(0, kind === 'fig' ? '#ffb0a0' : kind === 'mango' ? '#ffd27a' : '#ffc0b0'); fl.addColorStop(1, kind === 'fig' ? '#c03a50' : kind === 'mango' ? '#e88a10' : '#e06a6a');
      ctx.fillStyle = fl; ctx.beginPath(); ctx.ellipse(fx, fy, rx, ry, .3, 0, TAU); ctx.fill();
      if (kind === 'fig') { ctx.fillStyle = 'rgba(255,230,180,.7)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(fx + Math.cos(i * 2.4) * rx * .55, fy + Math.sin(i * 2.4) * ry * .55, .45, 0, TAU); ctx.fill(); } }
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(r * .1, -r * .25, r * .13, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function stickBake(len, v) {
    const R = mulberry32(700 + v * 13 + len);
    return bake(-len / 2 - 3, -22, len / 2 + 3, 9, (g) => {
      const p = new Path2D(); p.moveTo(-len / 2, -4); p.quadraticCurveTo(0, -7, len / 2, -3); p.lineTo(len / 2 + .5, 3); p.quadraticCurveTo(0, 6, -len / 2, 4); p.closePath();
      const bg = g.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, '#a88058'); bg.addColorStop(.45, '#6e4e32'); bg.addColorStop(1, '#2e1e12');
      g.fillStyle = bg; g.fill(p);
      g.save(); g.clip(p);
      for (let i = 0; i < len * 3; i++) { const x = -len / 2 + R() * len, y = -6 + R() * 11, L = 2 + R() * 6; g.strokeStyle = R() < .6 ? `rgba(30,18,8,${.3 + R() * .3})` : `rgba(210,180,140,${.15 + R() * .2})`; g.lineWidth = .3 + R() * .4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + (R() - .5) * .6); g.stroke(); }
      for (let k = 0; k < 3; k++) { const cx = -len / 2 + R() * len, cy = -3 + R() * 3; for (let i = 0; i < 14; i++) { g.fillStyle = css(mx([176, 188, 150], [214, 220, 190], R()), .6); g.beginPath(); g.arc(cx + (R() - .5) * 5, cy + (R() - .5) * 2, .4 + R() * .5, 0, TAU); g.fill(); } }
      for (let i = 0; i < len * .8; i++) { g.fillStyle = css(mx([80, 120, 50], [130, 160, 70], R()), .55); g.beginPath(); g.arc(-len / 2 + R() * len, -5 + R() * 2, .4 + R() * .5, 0, TAU); g.fill(); }
      g.restore();
      /* broken ends, a side twig with one leaf */
      g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(len / 2, 0, 1.2, 3.2, 0, 0, TAU); g.fill();
      g.strokeStyle = '#5e422a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(len * .2, -3); g.quadraticCurveTo(len * .25, -8, len * .32, -13); g.stroke();
      g.save(); g.translate(len * .34, -15); g.rotate(-.6);
      const lg = g.createLinearGradient(-5, 0, 5, 0); lg.addColorStop(0, '#3a6a2a'); lg.addColorStop(1, '#6a9a3a'); g.fillStyle = lg;
      g.beginPath(); g.moveTo(-5.5, 0); g.quadraticCurveTo(0, -3.2, 5.5, 0); g.quadraticCurveTo(0, 3.2, -5.5, 0); g.fill();
      g.strokeStyle = 'rgba(220,240,180,.5)'; g.lineWidth = .25; g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.stroke();
      g.restore();
    }, 4);
  }
  function drawStick(ctx, len, lift, seed) {
    const lq = Math.max(20, Math.round(len / 5) * 5), v = (seed >>> 0) % 3, img = once(`st|${lq}|${v}`, () => stickBake(lq, v));
    if (!img) return Sprites.drawStick(ctx, len, lift, seed);
    ctx.save(); ctx.rotate(-lift * .5); ctx.scale(len / lq, 1); put(ctx, img); ctx.restore();
  }
  /* mushrooms: a little brown bonnet (Mycena) or a zoned shelf (bracket); a glowing version for the night layer */
  function shroomBake(kind, glow) {
    const R = mulberry32(800 + (kind === 'bracket' ? 1 : 0));
    if (kind === 'bracket') return bake(-14, -7, 14, 3, (g) => {
      const p = new Path2D(); p.ellipse(0, 0, 12, 5, 0, Math.PI, TAU); p.closePath();
      if (glow) { g.fillStyle = 'rgba(110,240,140,.45)'; g.fill(p); g.fillStyle = 'rgba(170,255,190,.7)'; g.fillRect(-12, -.6, 24, 1.4); return; }
      const bg = g.createLinearGradient(0, -5, 0, 0); bg.addColorStop(0, '#8a5a30'); bg.addColorStop(1, '#d9b98a'); g.fillStyle = bg; g.fill(p);
      g.save(); g.clip(p); for (let k = 1; k < 7; k++) { g.strokeStyle = k % 2 ? 'rgba(70,40,20,.35)' : 'rgba(255,240,210,.3)'; g.lineWidth = .5; g.beginPath(); g.ellipse(0, 0, 12 * k / 7, 5 * k / 7, 0, Math.PI, TAU); g.stroke(); } g.restore();
      g.fillStyle = '#f2e6cc'; g.fillRect(-12, -.4, 24, 1.3); g.fillStyle = 'rgba(80,50,20,.4)'; g.fillRect(-12, .9, 24, .8);
    }, 6);
    return bake(-7, -13, 7, 1, (g) => {
      if (glow) { g.fillStyle = 'rgba(120,250,150,.55)'; g.beginPath(); g.moveTo(-5.4, -7.6); g.quadraticCurveTo(-4.6, -12.6, 0, -12.4); g.quadraticCurveTo(4.6, -12.6, 5.4, -7.6); g.quadraticCurveTo(0, -8.6, -5.4, -7.6); g.fill(); g.fillStyle = 'rgba(170,255,190,.7)'; g.beginPath(); g.ellipse(0, -7.9, 5, .6, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,250,150,.25)'; g.fillRect(-.6, -8, 1.2, 8); return; }
      const sg = g.createLinearGradient(-1, 0, 1, 0); sg.addColorStop(0, '#d8ccb0'); sg.addColorStop(.5, '#f6eedc'); sg.addColorStop(1, '#b8a888'); g.fillStyle = sg;
      g.beginPath(); g.moveTo(-.9, 0); g.lineTo(-.6, -8); g.lineTo(.6, -8); g.lineTo(.9, 0); g.fill();
      const cap = new Path2D(); cap.moveTo(-5.4, -7.6); g.fillStyle = '#000'; cap.quadraticCurveTo(-4.6, -12.6, 0, -12.4); cap.quadraticCurveTo(4.6, -12.6, 5.4, -7.6); cap.quadraticCurveTo(0, -8.6, -5.4, -7.6); cap.closePath();
      const cg = g.createRadialGradient(-1, -11.5, .3, 0, -9, 6.5); cg.addColorStop(0, '#e8c896'); cg.addColorStop(.5, '#b98a5a'); cg.addColorStop(1, '#6a4a2a'); g.fillStyle = cg; g.fill(cap);
      g.save(); g.clip(cap); g.strokeStyle = 'rgba(70,44,20,.4)'; g.lineWidth = .25; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(k * .2, -12.2); g.quadraticCurveTo(k * .9, -10, k * 1.25, -7.8); g.stroke(); } g.restore();
      g.fillStyle = 'rgba(60,40,20,.55)'; g.beginPath(); g.ellipse(0, -7.9, 5, .6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-1.6, -11.2, 1.6, .6, -.3, 0, TAU); g.fill();
    }, 6);
  }
  function drawMushroom(ctx, s, glow, kind) {
    const k = kind === 'bracket' ? 'bracket' : 'cap', g2 = glow > .3, img = once(`mu|${k}|${g2}`, () => shroomBake(k, g2));
    if (!img) return Sprites.drawMushroom(ctx, s, glow, kind);
    ctx.save(); ctx.scale(s, s); if (g2) ctx.globalAlpha *= clamp(.55 + glow * .45, 0, 1); put(ctx, img); ctx.restore();
  }
  function drawMillipede(ctx, ph, dir) {
    const S = once('mil', () => ({
      seg: bake(-2.8, -2.9, 2.8, 2.9, (g) => {
        const sg = g.createRadialGradient(-.6, -1, .2, 0, 0, 2.6); sg.addColorStop(0, '#c86a4a'); sg.addColorStop(.5, '#6a2414'); sg.addColorStop(1, '#2a0c06');
        g.fillStyle = sg; g.beginPath(); g.ellipse(0, 0, 2.3, 2.5, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(230,150,90,.5)'; g.beginPath(); g.ellipse(-1.4, 0, .5, 2.3, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-.4, -1.5, .9, .35, -.2, 0, TAU); g.fill();
      }, 10),
      head: bake(-2.8, -2.8, 3.2, 2.8, (g) => {
        g.fillStyle = '#2a120a'; g.beginPath(); g.arc(0, 0, 2.3, 0, TAU); g.fill();
        g.strokeStyle = '#3a1a10'; g.lineWidth = .4; g.beginPath(); g.moveTo(1.4, -1.2); g.quadraticCurveTo(2.6, -2.2, 3, -1.4); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(-.5, -1, .5, 0, TAU); g.fill();
      }, 10)
    }));
    if (!S) return Sprites.drawMillipede(ctx, ph, dir);
    ctx.save(); ctx.scale(dir, 1);
    ctx.strokeStyle = '#4a2010'; ctx.lineWidth = .55;
    for (let k = 0; k < 14; k++) { const x = -k * 3.2, y = Math.sin(ph * .4 - k * .4) * .8 - 3; for (const o2 of [-.8, .8]) { ctx.beginPath(); ctx.moveTo(x + o2, y + 2); ctx.lineTo(x + o2 + Math.sin(ph - k + o2) * 1.2, y + 4.6); ctx.stroke(); } }
    for (let k = 13; k >= 0; k--) { const x = -k * 3.2, y = Math.sin(ph * .4 - k * .4) * .8 - 3; ctx.save(); ctx.translate(x, y); put(ctx, S.seg); ctx.restore(); }
    ctx.save(); ctx.translate(2, -3); put(ctx, S.head); ctx.restore();
    ctx.restore();
  }
  /* the white-nosed coati: grizzled brown fur, a pale-marked face, a long dark snout, a ringed tail held up */
  function* coatiParts() {
    const R = mulberry32(911), C = {}, brown = [128, 90, 54], dark = [62, 42, 26], pale = [196, 164, 120], grey = [150, 128, 104];
    const fur = (base) => { const f = () => mx(base, R() < .5 ? dark : pale, R() * .35); f.tip = [222, 200, 160]; f.dark = [30, 20, 12]; return f; };
    {
      const body = new Path2D();
      body.moveTo(-26, -30); body.bezierCurveTo(-14, -42, 20, -42, 38, -34); body.bezierCurveTo(48, -28, 48, -14, 40, -8);
      body.bezierCurveTo(28, -4, -2, -4, -18, -8); body.bezierCurveTo(-30, -12, -34, -22, -26, -30); body.closePath();
      const box = [-36, -46, 50, -1];
      const col = (x, y) => { let c = mx(brown, grey, smoothstep(-30, 0, x) * .35); c = mx(c, dark, smoothstep(-24, -40, y) * .45); c = mx(c, pale, smoothstep(-14, -6, y) * .55); return c; };
      col.tip = [226, 206, 168]; col.dark = [30, 20, 12];
      C.body = yield* bakeJob(box[0], box[1], box[2], box[3], function* (g, inside) {
        g.fillStyle = css(brown); g.fill(body);
        yield* coat(g, inside, body, box, R, 2400, (x, y) => [1, .15 + (y > -14 ? .5 : 0)], col, { len: 3.2, w: .45 });
        volume(g, body, box, .12, .3, .08);
      }, 3);
    }
    {
      const skull = new Path2D(); skull.ellipse(-8, 0, 13, 10, 0, 0, TAU);
      const snout = new Path2D(); snout.moveTo(-14, -4.5); snout.quadraticCurveTo(-34, -3, -40, 5); snout.quadraticCurveTo(-41, 8.5, -37, 9.5); snout.quadraticCurveTo(-26, 7, -12, 6.5); snout.closePath();
      const box = [-46, -18, 8, 14];
      C.head = yield* bakeJob(box[0], box[1], box[2], box[3], function* (g, inside) {
        /* a rounded ear with a pale rim */
        g.fillStyle = css(dark); g.beginPath(); g.ellipse(-1, -10, 4.2, 5, .3, 0, TAU); g.fill();
        g.strokeStyle = css(pale, .9); g.lineWidth = .9; g.beginPath(); g.ellipse(-1, -10, 4, 4.8, .3, Math.PI * 1.1, Math.PI * 2.1); g.stroke();
        g.fillStyle = css(brown); g.fill(skull);
        const hc = (x, y) => mx(mx(brown, grey, .3), pale, smoothstep(2, 9, y) * .5); hc.tip = [220, 200, 160]; hc.dark = [30, 20, 12];
        yield* coat(g, inside, skull, box, R, 520, (x) => [1, .1], hc, { len: 2, w: .35 });
        g.fillStyle = css(mx(dark, INK, .2)); g.fill(snout);
        const sc = () => mx(dark, INK, R() * .3); sc.tip = [110, 84, 60]; sc.dark = [10, 6, 4];
        yield* coat(g, inside, snout, box, R, 300, () => [1, .05], sc, { len: 1.3, w: .25 });
        /* the white marks above and below the eye, the pale muzzle band */
        g.fillStyle = 'rgba(240,232,214,.9)'; g.beginPath(); g.ellipse(-13, -5.4, 4.2, 1.5, -.15, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(-14.5, 2.4, 3.8, 1.3, .1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(230,220,200,.75)'; g.beginPath(); g.ellipse(-20, 1.5, 3, 4.6, .2, 0, TAU); g.fill();
        g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(-12.5, -2.5, 1.9, 1.6, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(-13.1, -3.1, .55, 0, TAU); g.fill();
        /* the wet black nose at the tip */
        const ng = g.createRadialGradient(-39.5, 6, .2, -38.6, 7, 2.6); ng.addColorStop(0, '#5a4a44'); ng.addColorStop(1, '#0a0605'); g.fillStyle = ng; g.beginPath(); g.ellipse(-38.6, 7, 2.4, 2.2, .3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(-39.4, 6, .5, 0, TAU); g.fill();
        volume(g, skull, box, .1, .2, .06);
      }, 3.2);
    }
    {
      const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([40 + t * 22 + Math.sin(t * 3) * 6, -26 - t * 46]); }
      const tl = new Path2D(), wd = (t) => lerp(5.2, 2.2, t);
      tl.moveTo(pts[0][0] - wd(0), pts[0][1]); for (let i = 0; i <= 20; i++) tl.lineTo(pts[i][0] - wd(i / 20), pts[i][1]);
      tl.quadraticCurveTo(pts[20][0], pts[20][1] - 4, pts[20][0] + wd(1), pts[20][1]); for (let i = 20; i >= 0; i--) tl.lineTo(pts[i][0] + wd(i / 20), pts[i][1]); tl.closePath();
      const box = [30, -80, 76, -18];
      const rings = (x, y) => { const t = clamp((-26 - y) / 46, 0, 1), band = Math.sin(t * Math.PI * 9) > .1; return band ? mx(pale, brown, .35) : mx(dark, brown, .2); };
      rings.tip = [220, 200, 160]; rings.dark = [24, 16, 10];
      C.tail = yield* bakeJob(box[0], box[1], box[2], box[3], function* (g, inside) {
        g.fillStyle = css(brown); g.fill(tl);
        yield* coat(g, inside, tl, box, R, 1400, (x, y) => { const t = clamp((-26 - y) / 46, 0, 1); return [.45 + Math.cos(t * 3) * .4, -1]; }, rings, { len: 3.4, w: .45 });
        volume(g, tl, box, .1, .2, .06);
      }, 3);
    }
    {
      const p = new Path2D(); p.moveTo(-3.2, 0); p.quadraticCurveTo(-3.4, 8, -2.6, 15); p.lineTo(2.6, 15); p.quadraticCurveTo(3.4, 8, 3.2, 0); p.closePath();
      const box = [-5, -2, 6, 18];
      C.leg = yield* bakeJob(box[0], box[1], box[2], box[3], function* (g, inside) {
        g.fillStyle = css(dark); g.fill(p);
        const lc = () => mx(dark, INK, R() * .3); lc.tip = [120, 96, 70]; lc.dark = [10, 6, 4];
        yield* coat(g, inside, p, box, R, 160, () => [.1, 1], lc, { len: 1.6, w: .3 });
        g.fillStyle = '#1a120c'; g.beginPath(); g.ellipse(1, 15.4, 3.6, 1.6, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(220,210,190,.6)'; g.lineWidth = .3; for (const k of [-1, .5, 2, 3.4]) { g.beginPath(); g.moveTo(k + 1, 16); g.lineTo(k + 1.6, 17.2); g.stroke(); }
      }, 3.2);
      C.legFar = darker(C.leg, .35);
    }
    return C;
  }
  function drawCoati(ctx, o) {
    const C = once('coati', coatiParts); if (!C) return Sprites.drawCoati(ctx, o);
    const s = o.s || 1, legs = o.legs || 0, sniff = o.sniff || 0;
    ctx.save(); ctx.scale(s * (o.dir || 1), s);
    const sh = ctx.createRadialGradient(8, 0, 1, 8, 0, 44); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.scale(1, .12); ctx.fillStyle = sh; ctx.fillRect(-40, -44, 96, 88); ctx.restore();
    put(ctx, C.tail);
    for (const [x, ph, far] of [[-8, Math.PI, true], [34, 0, true]]) { const sw = Math.sin(legs + ph) * 6; bone(ctx, C.legFar, x + 2, -14, x + 2 + sw, 0, 15); }
    put(ctx, C.body);
    for (const [x, ph] of [[-20, 0], [24, Math.PI]]) { const sw = Math.sin(legs + ph) * 6; bone(ctx, C.leg, x, -14, x + sw, 0, 15); }
    ctx.save(); ctx.translate(-26, -26); ctx.rotate(.25 + sniff * .55); put(ctx, C.head); ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     THE FOREST: the climbable trees, leaf clumps, lianas, ferns,
     palms, litter, moss, a big blurred leaf in front
     ============================================================ */
  const TRES = 1.35;
  const LEAFSETS = {
    ceiba: [[46, 104, 52], [62, 128, 60], [82, 148, 70], [36, 88, 46], [104, 160, 80]],
    fig: [[40, 96, 40], [56, 120, 48], [76, 140, 56], [30, 80, 34], [96, 150, 66]],
    young: [[52, 120, 58], [70, 144, 66], [92, 164, 80], [40, 100, 50], [120, 176, 92]]
  };
  /* one leaf: elliptic, a drip tip, a midrib; lit on the upper side */
  function leafShape(g, L, Wd, col, lit, vein = true, flat = false) {
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .25, -Wd, L * .75, -Wd * .9, L, 0); g.bezierCurveTo(L * .75, Wd * .9, L * .25, Wd, 0, 0);
    if (flat) {
      /* cheaper: the leaf in shade, then its upper half lit */
      g.fillStyle = css(mx(col, INK, .18)); g.fill();
      g.fillStyle = css(mx(col, [255, 255, 220], lit)); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .25, -Wd, L * .75, -Wd * .9, L, 0); g.quadraticCurveTo(L * .5, Wd * .15, 0, 0); g.fill();
    } else {
      const lg = g.createLinearGradient(0, -Wd, 0, Wd); lg.addColorStop(0, css(mx(col, [255, 255, 220], lit))); lg.addColorStop(1, css(mx(col, INK, .25)));
      g.fillStyle = lg; g.fill();
    }
    if (vein) { g.strokeStyle = css(mx(col, [255, 255, 210], .35), .55); g.lineWidth = Math.max(.25, Wd * .1); g.beginPath(); g.moveTo(L * .05, 0); g.quadraticCurveTo(L * .5, -Wd * .1, L * .97, 0); g.stroke(); }
  }
  function* clumpBake(r, seed, kind) {
    const R = mulberry32(seed), cols = LEAFSETS[kind] || LEAFSETS.fig, s = r * 1.3;
    return yield* bakeJob(-s, -s, s, s, function* (g) {
      for (const pass of [0, 1, 2]) {
        yield;
        const n = Math.round(r * (pass === 1 ? 2 : 1.35));
        for (let k = 0; k < n; k++) {
          const a = R() * TAU, d = Math.sqrt(R()) * r * (pass === 0 ? .8 : 1), x = Math.cos(a) * d, y = Math.sin(a) * d * .72 + (pass === 0 ? r * .08 : 0);
          const L = 12 + R() * 14, Wd = L * (.28 + R() * .1);
          const up = clamp(.5 - y / (r * 1.4) - x / (r * 4), 0, 1);
          let c = cols[(R() * cols.length) | 0];
          if (pass === 0) c = mx(c, [8, 22, 10], .55);
          else if (pass === 2) c = mx(c, [214, 236, 150], up * .3);
          if (R() < .05) c = mx(c, [196, 176, 70], .55);           /* an old yellowing leaf */
          g.save(); g.translate(x, y); g.rotate(a * .4 + (R() - .5) * 2.2 + (pass === 2 ? -.5 : .4));
          leafShape(g, L, Wd, c, pass === 2 ? .2 + up * .25 : pass === 1 ? .08 : 0, pass > 0, true);
          g.restore();
          if ((k & 63) === 63) yield;
        }
      }
    }, 1.6);
  }
  function drawClump(ctx, cl, kind, x, y) {
    const rq = Math.round(cl.r / 20) * 20, v = ((cl.ph * 1000) | 0) % 4, img = once(`cl|${kind}|${rq}|${v}`, () => clumpBake(rq, 1300 + v * 71 + rq, kind));
    if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.scale(cl.r / rq, cl.r / rq); put(ctx, img); ctx.restore();
    return true;
  }
  /* the static part of a tree (buttresses, trunk, branches, bark, moss, lichen, a bromeliad), painted once */
  function* treeBake(T) {
    const R = mulberry32(T.seed + 5), paths = T.paths, tr = T.trunk, base = tr.pts[0];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of paths) for (const q of p.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    x0 -= 130; x1 += 130; y0 -= 60; y1 += 30;
    const kind = T.kind;
    const barkL = kind === 'ceiba' ? [178, 172, 152] : kind === 'fig' ? [150, 134, 112] : [138, 104, 72];
    const barkD = kind === 'ceiba' ? [92, 88, 74] : kind === 'fig' ? [74, 62, 48] : [64, 44, 28];
    const outline = (p, steps) => {
      const L = [], Rr = [];
      for (let k = 0; k <= steps; k++) { const q = p.at_(k / steps * p.len), nx = -Math.sin(q.ang), ny = Math.cos(q.ang); L.push([q.x + nx * q.w / 2, q.y + ny * q.w / 2]); Rr.push([q.x - nx * q.w / 2, q.y - ny * q.w / 2]); }
      const pp = new Path2D(); pp.moveTo(L[0][0], L[0][1]); for (const q of L) pp.lineTo(q[0], q[1]); for (let k = Rr.length - 1; k >= 0; k--) pp.lineTo(Rr[k][0], Rr[k][1]); pp.closePath();
      return { pp, L, Rr };
    };
    const img = yield* bakeJob(x0, y0, x1, y1, function* (g) {
      const limb = function* (p, isTrunk) {
        const steps = Math.max(8, Math.round(p.len / 14)), { pp, L, Rr } = outline(p, steps);
        g.fillStyle = css(mx(barkL, barkD, .45)); g.fill(pp);
        g.save(); g.clip(pp);
        /* cylinder shading, segment by segment: lit from the upper left, deep shade on the far side */
        for (let k = 0; k < steps; k++) {
          const a = L[k], b = Rr[k], gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
          const lit = isTrunk ? [mx(barkL, WHITE, .1), barkL, mx(barkL, barkD, .55), mx(barkD, INK, .35)] : [mx(barkL, WHITE, .12), mx(barkL, barkD, .3), mx(barkD, INK, .3)];
          lit.forEach((c, i) => gr.addColorStop(i / (lit.length - 1), css(c)));
          g.fillStyle = gr; g.beginPath(); g.moveTo(L[k][0], L[k][1]); g.lineTo(L[k + 1][0], L[k + 1][1]); g.lineTo(Rr[k + 1][0], Rr[k + 1][1]); g.lineTo(Rr[k][0], Rr[k][1]); g.closePath();
          g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 1.2; g.stroke();
        }
        yield;
        /* bark: furrows along the limb, pale plates, lenticels; a strangler fig's twisting root strands */
        const n = Math.round(p.len * p.w0 * (isTrunk ? .045 : .05));
        for (let i = 0; i < n; i++) {
          const s = R() * p.len, q = p.at_(s), off = (R() - .5) * q.w * .95, nx = -Math.sin(q.ang), ny = Math.cos(q.ang), x = q.x + nx * off, y = q.y + ny * off;
          const Lf = 4 + R() * (isTrunk ? 16 : 9), dx = Math.cos(q.ang), dy = Math.sin(q.ang), edge = Math.abs(off) / (q.w * .5);
          g.strokeStyle = R() < .58 ? `rgba(24,16,8,${.18 + R() * .28})` : css(mx(barkL, WHITE, .3), .12 + R() * .2);
          g.lineWidth = (.5 + R() * 1.2) * (1 - edge * .5);
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * Lf * .5 + nx * (R() - .5) * 2, y + dy * Lf * .5 + ny * (R() - .5) * 2, x + dx * Lf, y + dy * Lf); g.stroke();
          if ((i & 255) === 255) yield;
        }
        if (kind === 'fig' && isTrunk) {
          for (let k = 0; k < 9; k++) {
            let off = (R() - .5) * .9; g.strokeStyle = css(mx(barkL, WHITE, .12), .5); g.lineWidth = 2 + R() * 3; g.beginPath();
            for (let j = 0; j <= 40; j++) { const q = p.at_(j / 40 * p.len), nx = -Math.sin(q.ang), ny = Math.cos(q.ang); off = clamp(off + (R() - .5) * .08, -.48, .48); j ? g.lineTo(q.x + nx * off * q.w, q.y + ny * off * q.w) : g.moveTo(q.x + nx * off * q.w, q.y + ny * off * q.w); }
            g.stroke(); g.strokeStyle = 'rgba(20,14,8,.25)'; g.lineWidth = 1; g.stroke();
          }
        }
        for (let i = 0; i < p.len * .25; i++) { const s = R() * p.len, q = p.at_(s), off = (R() - .5) * q.w * .8, nx = -Math.sin(q.ang), ny = Math.cos(q.ang); g.fillStyle = css(kind === 'young' ? [190, 160, 120] : [210, 204, 186], .35); g.beginPath(); g.ellipse(q.x + nx * off, q.y + ny * off, 1.4, .6, q.ang, 0, TAU); g.fill(); }
        /* lichen: pale grey-green rosettes, a few orange ones */
        for (let k = 0; k < p.len / 60; k++) {
          const q = p.at_(R() * p.len), off = (R() - .5) * q.w * .7, nx = -Math.sin(q.ang), ny = Math.cos(q.ang), cx = q.x + nx * off, cy = q.y + ny * off, col = R() < .2 ? [214, 150, 70] : [186, 198, 168];
          for (let i = 0; i < 26; i++) { g.fillStyle = css(mx(col, WHITE, R() * .3), .55); g.beginPath(); g.arc(cx + (R() - .5) * 9, cy + (R() - .5) * 7, .6 + R() * 1.1, 0, TAU); g.fill(); }
        }
        yield;
        /* moss: thick on top of branches, in patches up the trunk, heavy near the foot */
        for (let i = 0; i < p.len * (isTrunk ? .9 : 1.6); i++) {
          const s = R() * p.len, q = p.at_(s), nx = -Math.sin(q.ang), ny = Math.cos(q.ang);
          let off;
          if (isTrunk) { if (R() > .2 + .45 * (1 - s / p.len) * (1 - s / p.len)) continue; off = (R() - .5) * q.w; }
          else off = -q.w * (.5 - R() * .3) * (ny > 0 ? 1 : -1);
          const x = q.x + nx * off, y = q.y + ny * off;
          if (isTrunk) { const col = mx([62, 96, 36], [120, 150, 60], R()); for (let j = 0; j < 7; j++) { g.fillStyle = css(mx(col, [30, 50, 20], R() * .4), .35 + R() * .3); g.beginPath(); g.ellipse(x + (R() - .5) * 7, y + (R() - .5) * 10, .5 + R() * 1.1, .4 + R() * .9, R(), 0, TAU); g.fill(); } }
          else { g.fillStyle = css(mx([70, 108, 40], [128, 160, 64], R()), .6 + R() * .3); g.beginPath(); g.arc(x, y, .8 + R() * 1.8, 0, TAU); g.fill(); }
          if ((i & 127) === 127) yield;
        }
        g.restore();
        /* moss hangs over the top edge of a branch */
        if (!isTrunk) for (let i = 0; i < p.len * .9; i++) {
          const s = R() * p.len, q = p.at_(s), nx = -Math.sin(q.ang), ny = Math.cos(q.ang), sgn = ny > 0 ? -1 : 1, x = q.x + nx * q.w * .5 * sgn, y = q.y + ny * q.w * .5 * sgn;
          g.fillStyle = css(mx([72, 112, 40], [140, 172, 70], R()), .85); g.beginPath(); g.ellipse(x, y - R() * 1.5, 1.2 + R() * 2.2, .9 + R() * 1.2, R(), 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(20,12,6,.35)'; g.lineWidth = 1; g.stroke(pp);
      };
      /* plank buttresses at the foot of the ceiba (and smaller root flares for the others) */
      const flare = kind === 'ceiba' ? 1 : kind === 'fig' ? .45 : .22;
      for (const sd of [-1, 1]) for (const k of [0, 1]) {
        const reach = (110 - k * 40) * flare, hgt = (170 - k * 60) * flare, w = tr.w0 * .3;
        const bp = new Path2D(); bp.moveTo(base.x + sd * w * .4, base.y - hgt); bp.quadraticCurveTo(base.x + sd * (w + reach * .25), base.y - hgt * .25, base.x + sd * (w + reach), base.y + 8); bp.lineTo(base.x + sd * w * .2, base.y + 14); bp.closePath();
        const bg = g.createLinearGradient(base.x, base.y - hgt, base.x + sd * reach, base.y);
        bg.addColorStop(0, css(mx(barkL, barkD, .2))); bg.addColorStop(1, css(mx(barkD, INK, .25 + k * .15)));
        g.fillStyle = bg; g.fill(bp);
        g.save(); g.clip(bp);
        for (let i = 0; i < reach * hgt * .02; i++) { const t = R(), x = base.x + sd * (w + reach * t * R()), y = base.y - hgt * (1 - t) * R(); g.strokeStyle = R() < .6 ? 'rgba(24,16,8,.25)' : css(mx(barkL, WHITE, .2), .2); g.lineWidth = .6 + R(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + sd * (2 + R() * 6), y + 3 + R() * 8); g.stroke(); }
        for (let i = 0; i < reach * .8; i++) { g.fillStyle = css(mx([70, 108, 40], [128, 160, 64], R()), .6); g.beginPath(); g.arc(base.x + sd * (w + reach * R()), base.y + 4 - R() * 30 * flare, .8 + R() * 1.8, 0, TAU); g.fill(); }
        g.restore();
        g.strokeStyle = css(mx(barkL, WHITE, .25), .35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(base.x + sd * w * .4, base.y - hgt); g.quadraticCurveTo(base.x + sd * (w + reach * .25), base.y - hgt * .25, base.x + sd * (w + reach), base.y + 8); g.stroke();
      }
      yield;
      for (const p of paths.slice(1)) yield* limb(p, false);
      yield* limb(tr, true);
      /* a ceiba's thorns (young bark), the bromeliad in a fork, a few orchid leaves */
      if (kind === 'ceiba') for (let k = 0; k < 34; k++) {
        const q = tr.at_(R() * tr.len * .85), side = R() < .5 ? -1 : 1, x = q.x + side * q.w / 2;
        const tg = g.createLinearGradient(x, q.y - 4, x + side * 7, q.y); tg.addColorStop(0, css(barkL)); tg.addColorStop(1, css(barkD)); g.fillStyle = tg;
        g.beginPath(); g.moveTo(x - side, q.y - 4.5); g.quadraticCurveTo(x + side * 4, q.y - 2, x + side * 8, q.y); g.quadraticCurveTo(x + side * 4, q.y + 1, x - side, q.y + 4.5); g.fill();
      }
      if (paths[2]) {
        const q = paths[2].at_(paths[2].len * .3), bx = q.x, by = q.y - q.w / 2;
        for (let k = -4; k <= 4; k++) { g.save(); g.translate(bx, by); g.rotate(-Math.PI / 2 + k * .3); leafShape(g, 18 - Math.abs(k), 2.6, mx([60, 120, 50], [110, 150, 60], R()), .2, true); g.restore(); }
        const fg = g.createLinearGradient(bx, by - 18, bx, by); fg.addColorStop(0, '#f05a3a'); fg.addColorStop(1, '#a8241a'); g.fillStyle = fg;
        g.beginPath(); g.moveTo(bx - 3, by - 2); g.quadraticCurveTo(bx - 4, by - 12, bx, by - 20); g.quadraticCurveTo(bx + 4, by - 12, bx + 3, by - 2); g.fill();
        g.fillStyle = 'rgba(255,220,120,.8)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(bx + (k % 2 ? 1 : -1), by - 6 - k * 3, .9, 0, TAU); g.fill(); }
      }
      for (const p of paths.slice(1)) if (R() < .6) {
        const q = p.at_(p.len * (.15 + R() * .3)), ox = q.x, oy = q.y - q.w / 2;
        for (let k = 0; k < 4; k++) { g.save(); g.translate(ox, oy); g.rotate(-Math.PI / 2 + (k - 1.5) * .55); leafShape(g, 12 + R() * 6, 3, mx([50, 100, 40], [96, 140, 60], R()), .25, true); g.restore(); }
      }
    }, TRES);
    return img;
  }
  /* back = the leaf clumps behind the branches; otherwise the tree and its swaying lianas */
  function drawTree(ctx, T, time, wind, back) {
    if (back) {
      let ok = true;
      for (const cl of T.leafClusters) { const sway = Math.sin(time * .7 + cl.ph) * (3 + wind * 8); if (!drawClump(ctx, cl, T.kind, cl.x + sway, cl.y)) ok = false; }
      return ok;
    }
    const img = once('tree|' + T.seed, () => treeBake(T)); if (!img) return false;
    put(ctx, img);
    const leaf = once('vleaf', () => bake(-1, -4, 15, 4, (g) => leafShape(g, 14, 3.6, [64, 118, 46], .2, true), 4));
    for (const p of T.paths.slice(1)) {
      const v = p.at_(p.len * .55), sw = Math.sin(time * .8 + p.at) * 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a4a22'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.quadraticCurveTo(v.x + sw, v.y + 80, v.x + sw * 1.5, v.y + 150); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,170,90,.5)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(v.x - .6, v.y); ctx.quadraticCurveTo(v.x + sw - .6, v.y + 80, v.x + sw * 1.5 - .6, v.y + 150); ctx.stroke();
      if (leaf) for (let k = 1; k < 7; k++) { ctx.save(); ctx.translate(v.x + sw * k / 4.6, v.y + k * 22); ctx.rotate((k % 2 ? .5 : Math.PI - .5) + sw * .02); put(ctx, leaf); ctx.restore(); }
    }
    return true;
  }
  /* ferns, broad leaves (a calathea), a little palm: painted once each, swayed by a shear */
  function* plantBake(kind, v) {
    const R = mulberry32(1500 + v * 37 + kind.length);
    return yield* bakeJob(-60, -72, 60, 4, function* (g) {
      if (kind === 'fern') {
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + (k - 3) * .32 + (R() - .5) * .1, L = 52 + R() * 12;
          g.save(); g.rotate(a + Math.PI / 2);
          g.strokeStyle = '#3a5a22'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -L * .5, 4 + (k - 3) * 2, -L); g.stroke();
          for (let j = 2; j < 22; j++) {
            const t = j / 22, x = lerp(0, 4 + (k - 3) * 2, t) + Math.sin(t * 3) * 4 * (1 - t), y = -t * L, pl = 7 * (1 - t * .75) * (.85 + R() * .3);
            for (const sd of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(sd * (1.25 - t * .3)); leafShape(g, pl, pl * .26, mx(k % 2 ? [70, 132, 52] : [56, 116, 44], [120, 170, 70], t * .4), .18, false, true); g.restore(); }
          }
          g.restore();
          yield;
        }
      } else if (kind === 'broad') {
        for (let k = 0; k < 5; k++) {
          g.save(); g.rotate(-1.35 + k * .62 + (R() - .5) * .2);
          g.strokeStyle = '#3e5a2a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -16); g.stroke();
          g.translate(0, -14); g.rotate(-Math.PI / 2);
          const L = 40 + R() * 10, Wd = L * .32;
          leafShape(g, L, Wd, k % 2 ? [44, 104, 50] : [36, 92, 44], .22, true);
          /* a calathea's painted stripes */
          g.strokeStyle = 'rgba(180,220,150,.35)'; g.lineWidth = .7;
          for (let j = 1; j < 8; j++) { const x = L * j / 8; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, -Wd * .8 * Math.sin(Math.PI * j / 8)); g.moveTo(x, 0); g.lineTo(x + 4, Wd * .8 * Math.sin(Math.PI * j / 8)); g.stroke(); }
          g.restore();
        }
      } else {
        g.strokeStyle = '#5a5030'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -48); g.stroke();
        for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(40,30,16,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-1.5, -i * 5); g.lineTo(1.5, -i * 5 - 1); g.stroke(); }
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI + k / 8 * Math.PI + (R() - .5) * .2;
          g.save(); g.translate(0, -48); g.rotate(a);
          for (let j = 0; j < 14; j++) { const t = j / 14; g.save(); g.translate(t * 36, Math.sin(t * 2.4) * 6 * (Math.abs(Math.cos(a)) + .2)); g.rotate(.9 - t * .2); leafShape(g, 11 * (1 - t * .5), 1.3, mx([64, 120, 44], [104, 150, 64], R()), .2, false, true); g.rotate(-1.8); leafShape(g, 11 * (1 - t * .5), 1.3, mx([56, 108, 40], [96, 140, 60], R()), .1, false, true); g.restore(); }
          g.restore();
          yield;
        }
      }
    }, 2.4);
  }
  function drawPlant(ctx, f, sway) {
    const v = ((f.ph * 10) | 0) % 3, img = once(`pl|${f.kind}|${v}`, () => plantBake(f.kind, v)); if (!img) return false;
    ctx.save(); ctx.transform(1, 0, sway * .8, 1, 0, 0); put(ctx, img); ctx.restore();
    return true;
  }
  /* leaf litter: dead leaves in browns, rusts and old yellows, with veins; some skeletonised */
  function litterBake(v) {
    const R = mulberry32(1700 + v * 19), cols = [[122, 74, 36], [154, 90, 42], [106, 90, 42], [168, 116, 46], [90, 58, 26], [96, 110, 46], [140, 60, 30], [80, 50, 28]];
    return bake(-8, -4, 8, 4, (g) => {
      const c = cols[v % cols.length];
      g.save(); g.scale(1, .55 + R() * .3);
      leafShape(g, 14, 4.2, c, .15, true);
      g.strokeStyle = css(mx(c, INK, .3), .4); g.lineWidth = .2; for (let j = 1; j < 6; j++) { const x = 14 * j / 7; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 2, -2.8 * Math.sin(Math.PI * j / 7)); g.moveTo(x, 0); g.lineTo(x + 2, 2.8 * Math.sin(Math.PI * j / 7)); g.stroke(); }
      for (let i = 0; i < 6; i++) { g.fillStyle = css(mx(c, INK, .4), .35); g.beginPath(); g.arc(2 + R() * 10, (R() - .5) * 4, .3 + R() * .6, 0, TAU); g.fill(); }
      g.restore();
    }, 4);
  }
  function drawLitter(ctx, l, y) {
    const v = ((l.a * 100) | 0) % 8, img = once('lit|' + v, () => litterBake(v)); if (!img) return false;
    ctx.save(); ctx.translate(l.x, y + 1); ctx.rotate(l.a * .3); ctx.scale(l.s * .9, l.s * .9); ctx.translate(-6, 0); put(ctx, img); ctx.restore();
    return true;
  }
  function drawLeaf(ctx, len, ang, col) {
    /* only the big, close, out-of-focus leaves in front of the camera use this */
    const img = once('bigleaf', () => bake(-6, -70, 226, 70, (g) => {
      g.filter = 'blur(2.5px)';
      leafShape(g, 220, 58, [24, 52, 30], .12, false);
      g.strokeStyle = 'rgba(80,120,70,.35)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(110, -6, 215, 0); g.stroke();
      g.lineWidth = 1; for (let j = 1; j < 10; j++) { const x = 220 * j / 11; g.beginPath(); g.moveTo(x, -1); g.quadraticCurveTo(x + 12, -24 * Math.sin(Math.PI * j / 11), x + 22, -46 * Math.sin(Math.PI * j / 11)); g.moveTo(x, 1); g.quadraticCurveTo(x + 12, 24 * Math.sin(Math.PI * j / 11), x + 22, 46 * Math.sin(Math.PI * j / 11)); g.stroke(); }
      g.filter = 'none';
    }, .8));
    if (!img || len < 100) return Sprites.drawLeaf(ctx, len, ang, col);
    ctx.save(); ctx.rotate(ang); ctx.scale(len / 220, len / 220); put(ctx, img); ctx.restore();
  }
  /* moss cushions on the top of the log */
  function drawMoss(ctx, x, y, s, v) {
    const img = once('moss|' + (v % 4), () => bake(-9, -6, 9, 2, (g) => {
      const R = mulberry32(1900 + v % 4);
      for (let i = 0; i < 160; i++) {
        const a = Math.PI + R() * Math.PI, d = Math.sqrt(R()), px = Math.cos(a) * 8 * d, py = Math.sin(a) * 5 * d + 1;
        g.fillStyle = css(mx([60, 96, 34], [150, 180, 72], clamp(.3 - py / 8 + R() * .4, 0, 1)), .9);
        g.beginPath(); g.ellipse(px, py, .5 + R() * .7, .4 + R() * .4, R() * TAU, 0, TAU); g.fill();
      }
      for (let i = 0; i < 7; i++) { const px = (R() - .5) * 12; g.strokeStyle = 'rgba(170,120,60,.8)'; g.lineWidth = .25; g.beginPath(); g.moveTo(px, -2); g.lineTo(px + (R() - .5), -6 - R() * 2); g.stroke(); g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(px + .2, -7 - R(), .35, .7, 0, 0, TAU); g.fill(); }
    }, 4));
    if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); put(ctx, img); ctx.restore();
    return true;
  }

  /* ============================================================
     THE CUT-AWAY: two seamless detail tiles laid source-atop over
     the cell layer (wood inside the log; soil, roots and pebbles
     below the floor) and a darker pass on the tunnels' back wall
     ============================================================ */
  const tiles = {};
  function* tileBake(kind) {
    const TW = 384, TH = 256, K = 2, R = mulberry32(kind === 'wood' ? 2203 : 2207);
    const c = document.createElement('canvas'); c.width = TW * K; c.height = TH * K;
    const g = c.getContext('2d', SOFT); g.scale(K, K); g.lineCap = 'round';
    /* every mark is drawn again across whichever edges it is near, so the tile is seamless; the job yields as it goes */
    let ops = 0, lx = 0, ly = 0;
    const wrap = (fn) => {
      for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) {
        if ((ox && (ox > 0 ? lx > 100 : lx < TW - 100)) || (oy && (oy > 0 ? ly > 100 : ly < TH - 100))) continue;
        g.save(); g.translate(ox, oy); fn(); g.restore();
      }
      ops++;
    };
    const at = (x, y) => { lx = x; ly = y; };
    if (kind === 'wood') {
      /* long fibres along the log, wavy, some split open into cracks; soft punky patches; tiny galleries */
      for (let i = 0; i < 26; i++) { const y = R() * TH, h = 2 + R() * 7, a = .05 + R() * .06, light = R() < .5; at(TW / 2, y); wrap(() => { g.fillStyle = light ? `rgba(255,230,190,${a})` : `rgba(30,12,0,${a})`; g.beginPath(); g.moveTo(-2, y); for (let x = 0; x <= TW; x += 16) g.lineTo(x, y + Math.sin(x / TW * TAU * 2 + i) * 3); g.lineTo(TW + 2, y + Math.sin(TAU * 2 + i) * 3); for (let x = TW; x >= 0; x -= 16) g.lineTo(x, y + h + Math.sin(x / TW * TAU * 2 + i + .7) * 3); g.lineTo(-2, y + h + Math.sin(i + .7) * 3); g.fill(); }); }
      yield;
      for (let i = 0; i < 520; i++) {
        const x = R() * TW, y = R() * TH, L = 18 + R() * 80, w = .3 + R() * .7, dark = R() < .55, a = dark ? .06 + R() * .14 : .05 + R() * .1, wob = (R() - .5) * 3;
        at(x + L / 2, y); wrap(() => { g.strokeStyle = dark ? `rgba(28,12,2,${a})` : `rgba(255,232,196,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + L * .3, y + wob, x + L * .7, y - wob, x + L, y + wob * .5); g.stroke(); });
        if ((i & 63) === 63) yield;
      }
      for (let i = 0; i < 26; i++) {
        const x = R() * TW, y = R() * TH, L = 20 + R() * 50, w = .7 + R() * .6;
        at(x + L / 2, y); wrap(() => { g.strokeStyle = 'rgba(16,6,0,.3)'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + L * .3, y + 1, x + L * .7, y - 1, x + L, y + .5); g.stroke(); g.strokeStyle = 'rgba(255,236,200,.18)'; g.lineWidth = .5; g.beginPath(); g.moveTo(x, y + 1.2); g.bezierCurveTo(x + L * .3, y + 2.2, x + L * .7, y + .2, x + L, y + 1.7); g.stroke(); });
      }
      yield;
      for (let i = 0; i < 60; i++) { const x = R() * TW, y = R() * TH, r = 6 + R() * 18; at(x, y); wrap(() => { const pg = g.createRadialGradient(x, y, 1, x, y, r); pg.addColorStop(0, 'rgba(255,236,200,.1)'); pg.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r * 1.8, r, 0, 0, TAU); g.fill(); }); }
      yield;
      for (let i = 0; i < 1800; i++) { const x = R() * TW, y = R() * TH, lt = R() < .45, w = .4 + R() * 1.6, h = .3 + R() * .4; at(x, y); wrap(() => { g.fillStyle = lt ? 'rgba(255,240,210,.16)' : 'rgba(20,8,0,.22)'; g.fillRect(x, y, w, h); }); if ((i & 255) === 255) yield; }
      /* old beetle galleries: meandering dark channels, packed here and there with pale frass */
      for (let i = 0; i < 9; i++) {
        const pts = [[R() * TW, R() * TH]]; let ang = (R() - .5) * 1.2 + (R() < .5 ? 0 : Math.PI);
        for (let k = 0; k < 16; k++) { ang += (R() - .5) * .8; const [x, y] = pts[pts.length - 1]; pts.push([x + Math.cos(ang) * 6, y + Math.sin(ang) * 3.5]); }
        const w = 2.2 + R() * 2, dots = []; for (let k = 0; k < 30; k++) { const q = pts[(R() * pts.length) | 0]; dots.push([q[0] + (R() - .5) * w, q[1] + (R() - .5) * w * .6, .3 + R() * .5]); }
        lx = TW / 2; ly = TH / 2;
        for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) {
          g.save(); g.translate(ox, oy);
          g.strokeStyle = 'rgba(20,8,0,.55)'; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts) g.lineTo(...q); g.stroke();
          g.strokeStyle = 'rgba(255,230,190,.16)'; g.lineWidth = .6; g.beginPath(); g.moveTo(pts[0][0], pts[0][1] + w * .45); for (const q of pts) g.lineTo(q[0], q[1] + w * .45); g.stroke();
          g.fillStyle = 'rgba(214,176,128,.55)'; for (const [x, y, r] of dots) { g.beginPath(); g.ellipse(x, y, r * 1.4, r, 0, 0, TAU); g.fill(); }
          g.restore();
        }
      }
      yield;
      for (let i = 0; i < 16; i++) { const x = R() * TW, y = R() * TH, r = .8 + R() * 1.4; at(x, y); wrap(() => { g.fillStyle = 'rgba(10,4,0,.5)'; g.beginPath(); g.ellipse(x, y, r * 1.6, r, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,230,190,.2)'; g.beginPath(); g.ellipse(x, y + r * .7, r * 1.4, r * .3, 0, 0, TAU); g.fill(); }); }
    } else {
      /* soil: crumbs and clods, pebbles, pale rootlets, pores */
      for (let i = 0; i < 220; i++) { const x = R() * TW, y = R() * TH, r = 2 + R() * 6, a = .06 + R() * .08, dk = R() < .6, e = .6 + R() * .3, rot = R(); at(x, y); wrap(() => { g.fillStyle = dk ? `rgba(26,14,4,${a})` : `rgba(255,226,180,${a * .6})`; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill(); }); if ((i & 63) === 63) yield; }
      for (let i = 0; i < 2200; i++) { const x = R() * TW, y = R() * TH, r = .25 + R() * .7, lt = R() < .45; at(x, y); wrap(() => { g.fillStyle = lt ? 'rgba(255,236,200,.2)' : 'rgba(16,8,0,.3)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); if ((i & 255) === 255) yield; }
      for (let i = 0; i < 22; i++) {
        const pts = [[R() * TW, R() * TH]]; let a = Math.PI / 2 + (R() - .5) * 1.6;
        for (let k = 0; k < 10; k++) { a += (R() - .5) * .9; const [x, y] = pts[pts.length - 1]; pts.push([x + Math.cos(a) * (4 + R() * 7), y + Math.sin(a) * (4 + R() * 7)]); }
        const w = .4 + R() * 1;
        lx = TW / 2; ly = TH / 2;   /* a rootlet wanders far: draw all its copies */
        for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) { g.save(); g.translate(ox, oy); g.strokeStyle = 'rgba(190,150,104,.26)'; g.lineWidth = w * .8; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts) g.lineTo(...q); g.stroke(); g.strokeStyle = 'rgba(30,16,6,.3)'; g.lineWidth = w * .5; g.beginPath(); g.moveTo(pts[0][0] + .5, pts[0][1] + .5); for (const q of pts) g.lineTo(q[0] + .5, q[1] + .5); g.stroke(); g.restore(); }
      }
      yield;
      for (let i = 0; i < 30; i++) { const x = R() * TW, y = R() * TH, r = 1 + R() * 2.5, rot = R(); at(x, y); wrap(() => { g.fillStyle = 'rgba(8,4,0,.45)'; g.beginPath(); g.ellipse(x, y, r, r * .7, rot, 0, TAU); g.fill(); }); }
      for (let i = 0; i < 40; i++) {
        const x = R() * TW, y = R() * TH, r = 1.2 + R() * R() * 4, e = .55 + R() * .35, rot = (R() - .5) * .8, tone = 90 + R() * 90, warm = R() * 24;
        at(x, y); wrap(() => {
          g.fillStyle = 'rgba(10,6,2,.4)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .35, r, r * e, rot, 0, TAU); g.fill();
          const pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1); pg.addColorStop(0, `rgba(${tone + 40 + warm},${tone + 32},${tone + 18},.75)`); pg.addColorStop(1, `rgba(${tone * .45 + warm},${tone * .4},${tone * .34},.75)`);
          g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill();
        });
      }
    }
    yield;
    return { c: hand(c), K };
  }
  /* returns { wood, soil } patterns (world units), or null until both are painted (each a job over several frames) */
  function cutPatterns(ctx) {
    for (const k of ['wood', 'soil']) if (!tiles[k]) {
      const t = once('tile|' + k, () => tileBake(k)); if (!t) return null;
      const p = ctx.createPattern(t.c, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix().scale(1 / t.K, 1 / t.K)); tiles[k] = p;
    }
    return tiles;
  }


  function cached() { return { parts: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms), slow: slow.slice().sort((a, b) => b[1] - a[1]).slice(0, 12) }; }

  return {
    drawBeetle, drawGrub, grubShape: Sprites.grubShape, drawExuvia, drawEgg, drawPupa, drawFruit, drawStick, drawMushroom, drawMillipede, drawCoati, drawLeaf,
    drawTree, drawClump, drawPlant, drawLitter, drawMoss, cutPatterns, beginFrame, cached
  };
})();
