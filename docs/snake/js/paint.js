/* ============================================================
   paint.js — the painted meadow (with the WebGL look, ?gfx=gl)
   ============================================================
     The same pictures as sprites.js, with the same functions and
     the same options (so every pose, age, form and shed stage
     still works), but painted, here in code, the way an artist
     would: no image files and no image service.  Everything is
     painted once into a cached picture (bake) and per frame only
     placed:
       THE GARTER SNAKE: a strip of skin is painted once per form
         (and per shed state): rows of keeled, overlapping scales,
         each coloured from a map of the real markings (the dark
         ground colour, the yellow back and side stripes, the
         checkerboard of black spots between them, red bars on a
         red-sided garter, the pale belly scutes), shaded round
         like a body and glossed along the back.  Per frame the
         strip is laid along the snake's spine segment by segment
         (an affine slice per segment), so the S-bends, coils,
         tapers and every age come for free.  The head (lip
         scales with dark bars, head plates, parietal spots) is a
         painted image too; the eye (round pupil, golden iris, the
         milky blue before a shed) and the forked tongue are drawn
         live on top.  The old skin (peeling, and the shed skin on
         the ground) is a see-through strip with the print of
         every scale.
       the covers (weathered boards, the coverboard, logs, field
         stones, limestone slabs, the stone wall, leaf piles),
         trees by season, grass tufts, wildflowers by species,
         cattails, the soil and limestone detail tiles, frogs,
         worms, grasshoppers, the red-tailed hawk, the raccoon,
         the great blue heron and the scientist (a real painted
         face, no smiley).
     Baking happens on CPU canvases (willReadFrequently: thousands
     of tiny fills are ~50x slower on a GPU canvas) within a time
     budget per frame; a finished picture is copied once to a
     normal canvas before it is drawn every frame (a CPU canvas
     used as a per-frame image or pattern is re-sent to the GPU
     every time).  Anything not painted yet is drawn the classic
     way for a frame or two.
   ============================================================ */
'use strict';

const Painted = (function () {
  const SOFT = { willReadFrequently: true };
  const cache = new Map(), stat = { n: 0, ms: 0 };
  let budget = 10;
  function beginFrame() { budget = 10; }
  const canBake = () => budget > 0;
  const spent = (t0) => { budget -= performance.now() - t0; };
  /* get a cached picture, painting it now if the frame's budget allows (null = not yet) */
  function once(key, make) {
    let v = cache.get(key);
    if (v === undefined) {
      if (!canBake()) return null;
      const t0 = performance.now(); v = make(); cache.set(key, v); stat.n++; stat.ms += performance.now() - t0; spent(t0);
    }
    return v;
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const rgb = (h) => hexToRgb(h);
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  /* hand a finished CPU-painted canvas over to a normal (GPU) one, once */
  /* hand a finished CPU-painted canvas over to a normal (GPU) canvas, once (an ImageBitmap made from a CPU canvas
     was tried: it stays CPU-side and the world layer got ~10x slower to upload) */
  function toGPU(c, holder = {}) {
    const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; g.getContext('2d').drawImage(c, 0, 0);
    holder.c = g; holder.ready = true; return holder;
  }
  function soft(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d', SOFT)]; }
  /* paint a picture in world units over the box x0..x1, y0..y1 at RES pixels per unit */
  function bake(x0, y0, x1, y1, RES, paint) {
    const [c, g] = soft((x1 - x0) * RES, (y1 - y0) * RES);
    g.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    g.lineCap = 'round'; g.lineJoin = 'round';
    paint(g);
    const out = { x0, y0, w: x1 - x0, h: y1 - y0 }; toGPU(c, out); return out;
  }
  function put(ctx, img) { ctx.drawImage(img.c, img.x0, img.y0, img.w, img.h); }

  /* ============================================================
     THE GARTER SNAKE
     ============================================================ */
  const SPX = 64;                 /* strip pixels across the body (one full body width) */
  const PER = 4;                  /* the markings repeat every 4 body widths */
  const SLEN = SPX * PER;         /* one period in pixels; the strip holds two */
  const COLS = 16;                /* scale columns per period: a scale is a quarter of the body's width long */
  function bodyWidth(u) { return u < .2 ? lerp(.74, 1, smoothstep(.04, .2, u)) : u < .6 ? 1 : lerp(1, .12, Math.pow((u - .6) / .4, 1.1)); }

  /* the rows from the top edge (the far side of the back) to the belly, and what each one carries:
     back, the back stripe on the mid-line, two rows of checks, the side stripe (rows 2–3 above the
     belly), the first row with its dark edges, the belly scutes */
  const ROLE = ['far', 'farspot', 'dstripe', 'checkA', 'checkB', 'lstripe', 'first', 'belly', 'belly'];
  const rowEdge = (k) => { const t = k / ROLE.length; return lerp(t - .5, .5 * Math.sin(-Math.PI / 2 + Math.PI * t), .55); };
  /* the colour of one scale (uw body widths along its row) for a form: the real markings */
  function markings(F, form) {
    const back = rgb(F.back), back2 = rgb(F.back2), stripe = rgb(F.stripe), side = rgb(F.side), check = rgb(F.check), belly = rgb(F.belly);
    const red = form === 'redsided', sf = form === 'sanfran';
    const spot = (uw, phase, w = .17) => { const k = ((uw + phase) % 1 + 1) % 1; return Math.min(k, 1 - k) < w; };   /* one spot per body width */
    return (uw, role) => {
      switch (role) {
        case 'belly': return belly;
        case 'lstripe': return stripe;
        case 'dstripe': return stripe;
        case 'first': return spot(uw, .25, .12) ? check : mix(back, back2, .35);
        case 'far': return mix(back, back2, .4);
        case 'farspot': return spot(uw, .5) ? check : back;
        case 'checkA': if (sf) return side; return spot(uw, 0) ? check : red && spot(uw, .5, .14) ? side : back;
        case 'checkB': if (sf) return side; return spot(uw, .5) ? check : red && spot(uw, 0, .14) ? side : back;
      }
      return back;
    };
  }
  /* the scales: per row, a column every quarter body width, staggered row to row */
  function scaleGrid() {
    const out = [];
    for (let r = 0; r < ROLE.length; r++) {
      const a = rowEdge(r), b = rowEdge(r + 1), cy = (a + b) / 2, hh = b - a, role = ROLE[r];
      const stagger = (r % 2) * .5;
      for (let c = -1; c < COLS * 2 + 1; c++) out.push({ uw: (c + stagger + .5) / COLS * PER, off: cy, h: hh, belly: role === 'belly', role, r });
    }
    return out;
  }
  const GRID = scaleGrid();
  /* one skin strip: kind 'skin' (a living snake; dull 0..1 before a shed) or 'old' (the shed skin) */
  function skinStrip(form, dull, kind) {
    const F = FORMS[form] || FORMS.eastern, colourAt = markings(F, form), R = mulberry32(form.length * 31 + 7 + (kind === 'old' ? 5 : 0));
    const W2 = SLEN * 2, Hp = SPX;
    const [c, g] = soft(W2, Hp);
    const X = (uw) => uw / PER * SLEN, Y = (off) => (off + .5) * Hp, L = SLEN / COLS;
    const old = kind === 'old';
    /* the skin between the scales */
    if (!old) { g.fillStyle = css(mix(rgb(F.back2), rgb(F.belly), .12)); g.fillRect(0, 0, W2, Hp); }
    /* the skin under each scale takes the scale's colour, so stripes and checks read whole */
    if (!old) for (const s of GRID) {
      const base = colourAt(((s.uw % PER) + PER) % PER, s.role);
      for (const ox of [0, SLEN * 2]) { const xx = X(s.uw) - ox; g.fillStyle = css(mul(base, .8)); g.fillRect(xx - L * .55, Y(s.off - s.h / 2) - .5, L * 1.1, s.h * Hp + 1); }
    }
    /* scales from the tail end towards the head, so each overlaps the one behind it */
    const order = GRID.slice().sort((p, q) => q.uw - p.uw);
    for (const s of order) {
      const x = X(s.uw), y = Y(s.off), hh = s.h * Hp, base = colourAt(((s.uw % PER) + PER) % PER, s.role);
      const j = .9 + R() * .2;
      for (const ox of [0, SLEN * 2]) {                       /* paint the wrap-around copy so the strip tiles */
        const xx = x - ox;
        if (xx < -L * 2 || xx > W2 + L * 2) continue;
        if (s.belly) {
          /* a broad belly plate: pale, glossy, its back edge darker */
          const top = Y(s.off - s.h / 2), bot = Hp + 2;
          if (old) {
            g.fillStyle = 'rgba(246,244,232,.5)'; g.fillRect(xx - L * .5, top, L * 1.02, bot - top);
            g.strokeStyle = 'rgba(150,150,138,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(xx + L * .5, top); g.lineTo(xx + L * .5, bot); g.stroke();
            continue;
          }
          const pg = g.createLinearGradient(xx - L * .5, 0, xx + L * .5, 0);
          pg.addColorStop(0, css(mix(base, [255, 255, 240], .15))); pg.addColorStop(.75, css(mul(base, j))); pg.addColorStop(1, css(mix(base, [40, 40, 30], .22)));
          g.fillStyle = pg; g.fillRect(xx - L * .5, top, L * 1.02, bot - top);
          continue;
        }
        /* a keeled scale: rounded at the front, its free tip pointing back towards the tail */
        const x0 = xx - L * .62, x1 = xx + L * .7, ht = hh * .62;
        g.beginPath();
        g.moveTo(x0, y);
        g.bezierCurveTo(x0 + L * .1, y - ht, xx + L * .2, y - ht * .9, x1, y + hh * .04);
        g.bezierCurveTo(xx + L * .2, y + ht * .95, x0 + L * .1, y + ht, x0, y);
        g.closePath();
        if (old) {
          g.fillStyle = `rgba(242,240,228,${.45 + R() * .15})`; g.fill();
          g.strokeStyle = 'rgba(140,140,128,.5)'; g.lineWidth = .8; g.stroke();
          g.strokeStyle = 'rgba(255,255,250,.55)'; g.lineWidth = .7; g.beginPath(); g.moveTo(xx - L * .25, y); g.lineTo(xx + L * .45, y + hh * .03); g.stroke();
          continue;
        }
        const sg = g.createLinearGradient(x0, y - ht, x1, y + ht);
        sg.addColorStop(0, css(mix(mul(base, j), [255, 255, 235], .16)));
        sg.addColorStop(.55, css(mul(base, j)));
        sg.addColorStop(1, css(mix(mul(base, j), [0, 0, 0], .2)));
        g.fillStyle = sg; g.fill();
        g.strokeStyle = css(mix(base, [0, 0, 0], .5), .3); g.lineWidth = .7; g.stroke();
        /* the keel: a fine ridge along the scale, lit above and shadowed below */
        g.lineWidth = .8;
        g.strokeStyle = css(mix(base, [255, 255, 235], .25), .35); g.beginPath(); g.moveTo(xx - L * .3, y - .5); g.lineTo(xx + L * .5, y - .3 + hh * .03); g.stroke();
        g.strokeStyle = css(mix(base, [0, 0, 0], .5), .25); g.beginPath(); g.moveTo(xx - L * .25, y + .6); g.lineTo(xx + L * .5, y + .8 + hh * .03); g.stroke();
      }
    }
    /* round the body: light from above, the far side turning away at the top, shade under the belly */
    g.globalCompositeOperation = 'source-atop';
    const vg = g.createLinearGradient(0, 0, 0, Hp);
    if (!old) {
      vg.addColorStop(0, 'rgba(0,0,0,.42)'); vg.addColorStop(.14, 'rgba(0,0,0,.1)'); vg.addColorStop(.3, 'rgba(255,250,230,.1)');
      vg.addColorStop(.5, 'rgba(0,0,0,0)'); vg.addColorStop(.78, 'rgba(0,0,0,.2)'); vg.addColorStop(.9, 'rgba(0,0,0,.3)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
    } else { vg.addColorStop(0, 'rgba(0,0,0,.15)'); vg.addColorStop(.4, 'rgba(255,255,255,.1)'); vg.addColorStop(1, 'rgba(0,0,0,.15)'); }
    g.fillStyle = vg; g.fillRect(0, 0, W2, Hp);
    if (!old) {
      /* the glossy highlight along the back: a glint on each scale it crosses */
      const gy = Y(-.31);
      for (const s of GRID) {
        if (s.belly) continue;
        const y = Y(s.off), d = Math.abs(y - gy) / (Hp * .1);
        if (d > 1.6) continue;
        for (const ox of [0, SLEN * 2]) {
          const xx = X(s.uw) - ox; if (xx < -L || xx > W2 + L) continue;
          const a = .32 * Math.exp(-d * d) * (1 - dull * .85);
          const hg = g.createRadialGradient(xx - L * .1, y - s.h * Hp * .15, 0, xx - L * .1, y - s.h * Hp * .15, L * .55);
          hg.addColorStop(0, `rgba(255,255,250,${a})`); hg.addColorStop(1, 'rgba(255,255,250,0)');
          g.fillStyle = hg; g.fillRect(xx - L, y - s.h * Hp, L * 2, s.h * Hp * 2);
        }
      }
      /* a milky, dull skin before a shed: the old outer layer loosening */
      if (dull > 0) { g.fillStyle = `rgba(176,190,200,${dull * .5})`; g.fillRect(0, 0, W2, Hp); }
    }
    /* soften the very edges so the silhouette is smooth when scaled */
    g.globalCompositeOperation = 'destination-in';
    const eg = g.createLinearGradient(0, 0, 0, Hp);
    eg.addColorStop(0, 'rgba(0,0,0,.4)'); eg.addColorStop(.04, 'rgba(0,0,0,1)'); eg.addColorStop(.96, 'rgba(0,0,0,1)'); eg.addColorStop(1, 'rgba(0,0,0,.4)');
    g.fillStyle = eg; g.fillRect(0, 0, W2, Hp);
    g.globalCompositeOperation = 'source-over';
    return toGPU(c);
  }
  /* the fresh gloss of a snake just out of its old skin */
  function glossStrip() {
    const [c, g] = soft(SLEN * 2, SPX);
    const vg = g.createLinearGradient(0, 0, 0, SPX);
    vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(.15, 'rgba(255,255,255,.55)'); vg.addColorStop(.28, 'rgba(255,255,255,0)');
    vg.addColorStop(.62, 'rgba(255,255,255,0)'); vg.addColorStop(.72, 'rgba(255,255,255,.18)'); vg.addColorStop(.8, 'rgba(255,255,255,0)');
    g.fillStyle = vg; g.fillRect(0, 0, SLEN * 2, SPX);
    return toGPU(c);
  }
  const dullKey = (d) => Math.round(clamp(d || 0, 0, 1) * 4) / 4;
  function stripFor(form, dull) { const d = dullKey(dull); return once(`strip|${form}|${d}`, () => skinStrip(form, d, 'skin')); }
  function oldStrip(form) { return once(`old|${form}`, () => skinStrip(form, 0, 'old')); }

  /* lay a strip along the body: one affine slice per segment, tail end first so the pieces overlap like scales */
  function laySkin(ctx, Q, segs, img, tu, wk = 1, minU = -1) {
    const m = ctx.getTransform();
    for (let k = segs.length - 1; k >= 0; k--) {
      const i = segs[k], a = Q[i - 1], b = Q[i];
      if (b.u < minU) continue;
      let dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy); if (len < 1e-3) continue;
      dx /= len; dy /= len;
      /* average the two normals, unless they disagree (where a coil turns end-on the down-screen normal flips) */
      let nx = a.nx, ny = a.ny;
      if (a.nx * b.nx + a.ny * b.ny > .3) { nx += b.nx; ny += b.ny; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; }
      const wm = (a.w + b.w) * .5 * wk; if (wm < .05) continue;
      /* overlap the neighbours by enough to close the outside of a bend */
      const e = Math.min(wm * (.04 + .5 * (a.bend || 0)) + .15, len * 1.5), tail = i === Q.length - 1 ? 0 : Math.min(wm * (.04 + .5 * (b.bend || 0)) + .15, len * 1.5);
      const t0 = tu[i - 1] - e / wm, span = (len + e + tail) / wm;
      let sx = ((t0 % PER) + PER) % PER / PER * SLEN; const sw = Math.min(SLEN, span / PER * SLEN);
      const la = dx, lb = dy, lc = nx * wm, ld = ny * wm, le = a.x, lf = a.y;
      ctx.setTransform(m.a * la + m.c * lb, m.b * la + m.d * lb, m.a * lc + m.c * ld, m.b * lc + m.d * ld, m.a * le + m.c * lf + m.e, m.b * le + m.d * lf + m.f);
      ctx.drawImage(img.c, sx, 0, Math.max(1, sw), SPX, -e, -.5, len + e + tail, 1);
    }
    ctx.setTransform(m);
  }

  /* the head, painted once per form and shed state: plates, lip scales with dark bars, parietal spots */
  const HRES = 44;
  function headImg(form, dull) {
    const d = dullKey(dull);
    return once(`head|${form}|${d}`, () => {
      const F = FORMS[form] || FORMS.eastern, back = rgb(F.back), back2 = rgb(F.back2), lip = rgb(F.lip), stripe = rgb(F.stripe), belly = rgb(F.belly);
      const L = 1.55, Hh = .62, hs = 1;
      return bake(-.85, -.9, 1.75, .9, HRES, (g) => {
        const shape = new Path2D();
        shape.moveTo(-hs * .62, -Hh * .66);
        shape.bezierCurveTo(-.1, -Hh * .9, L * .45, -Hh * 1.08, L * .86, -Hh * .36);
        shape.quadraticCurveTo(L * 1.04, -Hh * .02, L * .9, Hh * .3);
        shape.bezierCurveTo(L * .55, Hh * .72, 0, Hh * .74, -hs * .62, Hh * .64);
        shape.closePath();
        /* the head's top and sides: ground colour, a little warmer, shaded round */
        const hg = g.createLinearGradient(0, -Hh, 0, Hh);
        hg.addColorStop(0, css(mix(back, [255, 250, 220], .12))); hg.addColorStop(.45, css(mix(back, [120, 90, 40], .12))); hg.addColorStop(1, css(mix(back2, [0, 0, 0], .2)));
        g.fillStyle = hg; g.fill(shape);
        g.save(); g.clip(shape);
        /* the lips: pale upper lip scales from just under the eye down to the mouth, a paler chin below */
        const lipP = new Path2D(); lipP.moveTo(-hs * .05, Hh * .3); lipP.bezierCurveTo(L * .25, Hh * .06, L * .6, Hh * .1, L * 1.1, -Hh * .18); lipP.lineTo(L * 1.1, Hh * 1.2); lipP.lineTo(-hs * .05, Hh * 1.2); lipP.closePath();
        const lg = g.createLinearGradient(0, 0, 0, Hh);
        lg.addColorStop(0, css(mix(lip, back, .4))); lg.addColorStop(.45, css(mix(lip, back, .12))); lg.addColorStop(1, css(mix(mix(lip, belly, .5), [0, 0, 0], .2)));
        g.fillStyle = lg; g.fill(lipP);
        /* thin dark seams between the upper lip scales, slanting back, stopping short of the mouth */
        const seams = [.24, .38, .52, .65, .78];
        g.lineCap = 'round';
        for (let k = 0; k < seams.length; k++) {
          const x = L * seams[k], y0 = Hh * (.2 - seams[k] * .28), y1 = Hh * (.3 - seams[k] * .1);
          g.strokeStyle = css(mix(back2, [0, 0, 0], .2), .55); g.lineWidth = .028;
          g.beginPath(); g.moveTo(x, y0); g.lineTo(x - .03, y1); g.stroke();
        }
        /* the head plates: faint seams of the big scales on the top and in front of the eye */
        g.strokeStyle = css(mix(back2, [0, 0, 0], .4), .5); g.lineWidth = .025;
        g.beginPath(); g.moveTo(L * .2, -Hh * .98); g.quadraticCurveTo(L * .3, -Hh * .6, L * .42, -Hh * .5); g.stroke();
        g.beginPath(); g.moveTo(L * .74, -Hh * .66); g.quadraticCurveTo(L * .76, -Hh * .3, L * .82, Hh * .05); g.stroke();
        g.beginPath(); g.moveTo(-.05, -Hh * .9); g.quadraticCurveTo(.1, -Hh * .55, .02, -Hh * .2); g.stroke();
        g.beginPath(); g.moveTo(L * .47, -Hh * .2); g.quadraticCurveTo(L * .38, Hh * .02, L * .44, Hh * .16); g.stroke();
        /* the two pale parietal spots, and the start of the back stripe on the neck */
        g.fillStyle = css(mix(stripe, [255, 255, 230], .2), .85);
        for (const x of [-.04, .12]) { g.beginPath(); g.ellipse(x, -Hh * .66, .055, .04, 0, 0, TAU); g.fill(); }
        g.fillStyle = css(stripe, .9); g.beginPath(); g.ellipse(-hs * .6, -Hh * .62, .2, .05, 0, 0, TAU); g.fill();
        /* gloss on the crown and the snout */
        const gg = g.createRadialGradient(L * .35, -Hh * .78, 0, L * .35, -Hh * .78, L * .5);
        gg.addColorStop(0, `rgba(255,255,248,${.4 * (1 - d * .8)})`); gg.addColorStop(1, 'rgba(255,255,248,0)');
        g.fillStyle = gg; g.fillRect(-1, -1, 3, 2);
        if (d > 0) { g.fillStyle = `rgba(176,190,200,${d * .5})`; g.fillRect(-1, -1, 3, 2); }
        g.restore();
        /* the mouth line, the nostril; a soft edge */
        g.strokeStyle = 'rgba(28,18,10,.7)'; g.lineWidth = .04;
        g.beginPath(); g.moveTo(L * .88, Hh * .22); g.quadraticCurveTo(L * .55, Hh * .34, L * .22, Hh * .16); g.stroke();
        g.fillStyle = 'rgba(8,6,4,.85)'; g.beginPath(); g.ellipse(L * .86, -Hh * .2, .05, .035, -.3, 0, TAU); g.fill();
        g.strokeStyle = css(mix(back2, [0, 0, 0], .3), .6); g.lineWidth = .04; g.stroke(shape);
        /* fade the back of the head into the neck */
        g.globalCompositeOperation = 'destination-in';
        const fg = g.createLinearGradient(-hs * .66, 0, -hs * .25, 0); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = fg; g.fillRect(-1, -1, 3, 2);
        g.globalCompositeOperation = 'source-over';
      });
    });
  }

  function drawSnake(ctx, P, o) {
    const n = P.length; if (n < 3) return;
    /* skip a snake that is entirely off the screen (the spring crowd, migrants far along the trail) */
    {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const q of P) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
      const pad = (o.thick || 4) * 4, m = ctx.getTransform(), cv = ctx.canvas;
      if (cv && !m.b && !m.c) { const sx0 = m.a * (x0 - pad) + m.e, sx1 = m.a * (x1 + pad) + m.e, sy0 = m.d * (y0 - pad) + m.f, sy1 = m.d * (y1 + pad) + m.f;
        if (Math.max(sx0, sx1) < 0 || Math.min(sx0, sx1) > cv.width || Math.max(sy0, sy1) < 0 || Math.min(sy0, sy1) > cv.height) return; }
    }
    const form = FORMS[o.form] ? o.form : 'eastern';
    const strip = stripFor(form, o.dull), head = headImg(form, o.dull);
    if (!strip || !head) return Sprites.drawSnake(ctx, P, o);
    const th = o.thick, cols = Sprites.snakeCols(form, o), baby = o.baby || 0;
    ctx.save();
    if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha *= o.alpha;
    const A = ctx.globalAlpha;
    const Q = new Array(n);
    for (let i = 0; i < n; i++) {
      const q = P[i], u = i / (n - 1), c = q.c || 0;
      let y = q.y + (1 - c) * (q.z || 0) * .45;
      if (o.headUp && u < .22) y -= o.headUp * th * 1.6 * Math.pow(1 - u / .22, 2);
      Q[i] = { x: q.x, y, z: c ? (q.z || 0) : (q.z || 0) / 6, g: q.g || ((q.z || 0) < 0 ? 0 : 100), u, w: th * bodyWidth(u) * (1 + (c ? (q.z || 0) * .05 : 0)) };
    }
    if (o.shadow !== false && !P[0].c) {
      ctx.strokeStyle = 'rgba(20,16,8,.22)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = th * 1.05;
      ctx.beginPath(); for (let i = 0; i < n; i += 2) { const q = Q[i]; i ? ctx.lineTo(q.x, q.y + th * .55) : ctx.moveTo(q.x, q.y + th * .55); } ctx.stroke();
    }
    /* the spine, resampled finer along a Catmull-Rom curve so the skin slices follow the bends smoothly */
    /* level of detail: how big the body is on the screen decides how finely it is sliced */
    const M0 = ctx.getTransform(), scr = Math.hypot(M0.a, M0.b) * th, fine = scr > 22 ? 1 : scr > 11 ? .6 : 0;
    const R = [];
    R.push({ x: Q[0].x, y: Q[0].y, w: Q[0].w, u: 0, sg: Q[0].g });
    let last = 0, prev = 0;
    for (let i = 1; i < n; i++) {
      /* a small snake on the screen: every other point is plenty (keep the group boundaries and the tail) */
      if (scr < 7 && i % 2 && i < n - 1 && Q[i].g === Q[i - 1].g && Q[i].g === Q[i + 1].g) continue;
      const p0 = Q[prev], p1 = Q[last], p2 = Q[i], p3 = Q[Math.min(n - 1, i + 1)];
      prev = last; last = i;
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y), wm = (p1.w + p2.w) * .5;
      /* how much the spine turns across this segment: straight runs need no extra points */
      const ax = p2.x - p0.x, ay = p2.y - p0.y, bx = p3.x - p1.x, by = p3.y - p1.y;
      const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
      const k = clamp(Math.ceil(len / Math.max(.3, wm * .22) * Math.min(1, turn * 2.5) * fine), 1, 5), sg = Math.min(p1.g, p2.g);
      for (let j = 1; j <= k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const cr = (a0, a1, a2, a3) => .5 * (2 * a1 + (a2 - a0) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (3 * a1 - a0 - 3 * a2 + a3) * t3);
        R.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), w: lerp(p1.w, p2.w, t), u: lerp(p1.u, p2.u, t), sg });
      }
    }
    const m = R.length;
    for (let i = 0; i < m; i++) {
      const a = R[Math.max(0, i - 1)], b = R[Math.min(m - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }
      R[i].nx = nx; R[i].ny = ny;
    }
    /* how sharply the body turns at each point (tan of half the angle), for the overlap of the skin slices */
    for (let i = 1; i < m - 1; i++) {
      const ax = R[i].x - R[i - 1].x, ay = R[i].y - R[i - 1].y, bx = R[i + 1].x - R[i].x, by = R[i + 1].y - R[i].y;
      R[i].bend = Math.min(1.5, Math.abs(Math.tan(Math.atan2(ax * by - ay * bx, ax * bx + ay * by) / 2)));
    }
    /* texture coordinate along the body, in body widths (so the scales shrink towards the tail) */
    const tu = new Float32Array(m);
    for (let i = 1; i < m; i++) tu[i] = tu[i - 1] + Math.hypot(R[i].x - R[i - 1].x, R[i].y - R[i - 1].y) / Math.max(.3, (R[i].w + R[i - 1].w) * .5);
    const groups = new Map();
    for (let i = 1; i < m; i++) { const k = R[i].sg; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    const keys = [...groups.keys()].sort((a, b) => a - b);
    const under = typeof PAINT_DEBUG !== 'undefined' ? 'red' : css(mix(rgb(cols.back), rgb(cols.back2), .5));
    const old = o.peel !== undefined && o.peel < 1 ? oldStrip(form) : null, gloss = o.fresh > .02 ? once('gloss', glossStrip) : null;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k of keys) {
      const segs = groups.get(k);
      /* the silhouette underneath fills the outside of every bend */
      /* the silhouette underneath, one outline per unbroken run, fills the outside of every bend */
      ctx.fillStyle = under;
      ctx.beginPath();
      for (let j = 0; j < segs.length;) {
        let e = j; while (e + 1 < segs.length && segs[e + 1] === segs[e] + 1) e++;
        const i0 = segs[j] - 1, i1 = segs[e];
        for (let i = i0; i <= i1; i++) { const q = R[i], h = q.w * .47; i === i0 ? ctx.moveTo(q.x + q.nx * h, q.y + q.ny * h) : ctx.lineTo(q.x + q.nx * h, q.y + q.ny * h); }
        for (let i = i1; i >= i0; i--) { const q = R[i], h = q.w * .47; ctx.lineTo(q.x - q.nx * h, q.y - q.ny * h); }
        ctx.closePath();
        j = e + 1;
      }
      ctx.fill('nonzero');
      laySkin(ctx, R, segs, strip, tu);
      if (gloss) { ctx.globalAlpha = A * clamp(o.fresh, 0, 1) * .7; laySkin(ctx, R, segs, gloss, tu); ctx.globalAlpha = A; }
      if (old) { ctx.globalAlpha = A * .9; laySkin(ctx, R, segs, old, tu, 1.1, o.peel); ctx.globalAlpha = A; }
    }
    if (o.peel !== undefined && o.peel > 0 && o.peel < 1) {
      /* the rolled-back edge of the old skin, inside out: a pale crumpled collar */
      const q = R[clamp(Math.round(o.peel * (m - 1)), 1, m - 1)], ang = Math.atan2(q.ny, q.nx);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang);
      const rg = ctx.createLinearGradient(-q.w * .6, 0, q.w * .6, 0); rg.addColorStop(0, 'rgba(255,255,250,.95)'); rg.addColorStop(1, 'rgba(200,198,186,.9)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 0, q.w * .6, q.w * .24, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(150,148,136,.7)'; ctx.lineWidth = q.w * .05;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * q.w * .2, -q.w * .2); ctx.quadraticCurveTo(k * q.w * .2 + q.w * .06, 0, k * q.w * .2, q.w * .2); ctx.stroke(); }
      ctx.restore();
    }
    drawHead(ctx, Q, o, cols, th, baby, head);
    ctx.restore();
  }
  function drawHead(ctx, Q, o, cols, th, baby, head) {
    const a = Q[0], b = Q[Math.min(3, Q.length - 1)];
    let dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const face = dx >= 0 ? 1 : -1;
    const ang = clamp(Math.atan2(dy, dx * face) * .6, -.7, .5);
    const hs = th * (1 + baby * .3), L = hs * 1.55, Hh = hs * .62;
    ctx.save();
    ctx.translate(a.x, a.y); ctx.scale(face, 1); ctx.rotate(ang);
    ctx.save(); ctx.scale(hs, hs); put(ctx, head); ctx.restore();
    /* the eye: big, a round pupil, a golden iris flecked dark, no eyelids; a scale like a brow above it */
    const ex = L * .58, ey = -Hh * .26, er = hs * (.25 + baby * .07), iris = rgb(cols.iris);
    const ig = ctx.createRadialGradient(ex, ey, er * .2, ex, ey, er);
    ig.addColorStop(0, css(mix(iris, [255, 230, 150], .3))); ig.addColorStop(.7, css(iris)); ig.addColorStop(1, css(mix(iris, [30, 20, 6], .6)));
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(40,24,8,.35)'; ctx.beginPath(); ctx.ellipse(ex, ey + er * .55, er * .9, er * .45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#060404'; ctx.beginPath(); ctx.arc(ex + er * .12 * (o.look || 0), ey, er * .52, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(ex + er * .28, ey - er * .34, er * .2, er * .14, -.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(ex - er * .3, ey + er * .32, er * .1, 0, TAU); ctx.fill();
    if (o.blue > 0) {
      /* before a shed: the old eye cap turns milky blue */
      const bg = ctx.createRadialGradient(ex - er * .2, ey - er * .3, 0, ex, ey, er * 1.05);
      bg.addColorStop(0, `rgba(222,236,248,${.95 * o.blue})`); bg.addColorStop(1, `rgba(150,180,212,${.9 * o.blue})`);
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ex, ey, er * 1.05, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${.6 * o.blue})`; ctx.beginPath(); ctx.ellipse(ex + er * .25, ey - er * .32, er * .28, er * .18, -.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(16,10,4,.65)'; ctx.lineWidth = Math.max(.25, hs * .04); ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(16,10,4,.45)'; ctx.lineWidth = Math.max(.3, hs * .06); ctx.beginPath(); ctx.arc(ex, ey + er * .1, er * 1.15, -2.6, -.5); ctx.stroke();
    /* the forked tongue: flick out, flick in (red, with black tips) */
    if (o.tongue > 0) {
      const k = Math.sin(clamp(o.tongue, 0, 1) * Math.PI), tl = hs * 1.3 * k, tx = L * .98, ty = Hh * .1;
      const wig = Math.sin(o.tongue * 30) * .12;
      ctx.strokeStyle = '#c8242e'; ctx.lineWidth = Math.max(.4, hs * .08); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + tl * .5, ty + tl * (.05 + wig), tx + tl, ty + tl * (.15 + wig)); ctx.stroke();
      const fx = tx + tl, fy = ty + tl * (.15 + wig), fl = hs * .38 * k;
      ctx.lineWidth = Math.max(.3, hs * .06);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + fl, fy - fl * .45); ctx.moveTo(fx, fy); ctx.lineTo(fx + fl, fy + fl * .55); ctx.stroke();
      ctx.strokeStyle = '#140606';
      ctx.beginPath(); ctx.moveTo(fx + fl * .55, fy - fl * .25); ctx.lineTo(fx + fl, fy - fl * .45); ctx.moveTo(fx + fl * .55, fy + fl * .3); ctx.lineTo(fx + fl, fy + fl * .55); ctx.stroke();
    }
    ctx.restore();
  }

  /* the thin clear bag a newborn comes in: a wet, see-through membrane with the baby coiled inside */
  function drawSac(ctx, x, y, s, t, crack, form) {
    if (!stripFor(FORMS[form] ? form : 'eastern', 0)) return Sprites.drawSac(ctx, x, y, s, t, crack, form);
    ctx.save(); ctx.translate(x, y);
    const wob = crack > 0 ? Math.sin(t * 18) * crack * .08 : Math.sin(t * 2) * .02;
    ctx.scale(1 + wob, 1 - wob);
    const rx = 13 * s, ry = 9 * s;
    ctx.fillStyle = 'rgba(20,16,8,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, rx * .9, ry * .18, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -ry, rx, ry, 0, 0, TAU); ctx.clip();
    const mg = ctx.createRadialGradient(-rx * .3, -ry * 1.4, 1, 0, -ry, rx * 1.1);
    mg.addColorStop(0, 'rgba(236,240,226,.35)'); mg.addColorStop(.7, 'rgba(206,216,196,.3)'); mg.addColorStop(1, 'rgba(170,180,150,.55)');
    ctx.fillStyle = mg; ctx.fillRect(-rx, -ry * 2, rx * 2, ry * 2);
    const P = Trail.coil(snakeUnits(18) * s * .42, 2.6 * s, 0, 0, 1, 1.6);
    drawSnake(ctx, P, { thick: 2.6 * s, form, baby: 1, shadow: false });
    ctx.fillStyle = 'rgba(220,230,210,.22)'; ctx.fillRect(-rx, -ry * 2, rx * 2, ry * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,250,.55)'; ctx.lineWidth = .6 * s; ctx.beginPath(); ctx.ellipse(0, -ry, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,170,150,.35)'; ctx.lineWidth = .35 * s;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-rx * .6 + k * rx * .5, -ry * .2); ctx.quadraticCurveTo(-rx * .4 + k * rx * .5, -ry * 1.1, -rx * .5 + k * rx * .55, -ry * 1.7); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-rx * .4, -ry * 1.45, rx * .26, ry * .13, -.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(rx * .45, -ry * .55, s * .7, 0, TAU); ctx.fill();
    if (crack > .3) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .7 * s; ctx.beginPath(); ctx.moveTo(rx * .2, -ry * 1.9); ctx.lineTo(rx * .45, -ry * 1.4); ctx.lineTo(rx * .3, -ry * 1.1); ctx.lineTo(rx * .6, -ry * .7); ctx.stroke(); }
    ctx.restore();
  }

  /* a shed skin lying on the ground: the see-through old skin with every scale printed, the clear eye cap */
  function drawExuvia(ctx, e, t) {
    const form = FORMS[e.form] ? e.form : 'eastern', img = oldStrip(form);
    if (!img) return Sprites.drawExuvia(ctx, e, t);
    const n = 30, len = e.len, th = e.thick || len * .085;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.face || 1, 1);
    const Q = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1); Q.push({ x: len * .5 - u * len, y: -th * .3 + Math.sin(u * 9 + (e.seed || 0)) * th * .25 * (1 - u * .3), u, w: th * bodyWidth(u) * 1.02, g: 0 }); }
    for (let i = 0; i < n; i++) { const a = Q[Math.max(0, i - 1)], b = Q[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, ty = b.y - a.y; const d = Math.hypot(tx, ty) || 1; let nx = -ty / d, ny = tx / d; if (ny < 0) { nx = -nx; ny = -ny; } Q[i].nx = nx; Q[i].ny = ny; }
    const tu = new Float32Array(n); for (let i = 1; i < n; i++) tu[i] = tu[i - 1] + Math.hypot(Q[i].x - Q[i - 1].x, Q[i].y - Q[i - 1].y) / ((Q[i].w + Q[i - 1].w) * .5);
    ctx.strokeStyle = 'rgba(20,16,8,.12)'; ctx.lineCap = 'round'; ctx.lineWidth = th * .8;
    ctx.beginPath(); Q.forEach((q, i) => i ? ctx.lineTo(q.x, q.y + th * .4) : ctx.moveTo(q.x, q.y + th * .4)); ctx.stroke();
    const segs = []; for (let i = 1; i < n; i++) segs.push(i);
    laySkin(ctx, Q, segs, img, tu);
    /* crinkles where it turned inside out */
    ctx.strokeStyle = 'rgba(160,158,146,.45)'; ctx.lineWidth = Math.max(.25, th * .05);
    for (const u of [.42, .58, .74]) { const q = Q[Math.round(u * (n - 1))]; ctx.beginPath(); ctx.moveTo(q.x - th * .1, q.y - q.w * .45); ctx.quadraticCurveTo(q.x + th * .15, q.y, q.x - th * .1, q.y + q.w * .45); ctx.stroke(); }
    /* the head end: open, with the clear cap that covered the eye */
    const h = Q[0];
    const hg = ctx.createRadialGradient(h.x + th * .2, h.y - th * .2, 0, h.x + th * .3, h.y, th * .8);
    hg.addColorStop(0, 'rgba(255,255,250,.9)'); hg.addColorStop(1, 'rgba(214,212,198,.8)');
    ctx.fillStyle = hg; ctx.strokeStyle = 'rgba(150,150,140,.6)'; ctx.lineWidth = Math.max(.3, th * .05);
    ctx.beginPath(); ctx.ellipse(h.x + th * .3, h.y, th * .75, th * .5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const eg = ctx.createRadialGradient(h.x + th * .45, h.y - th * .18, 0, h.x + th * .5, h.y - th * .12, th * .22);
    eg.addColorStop(0, 'rgba(255,255,255,.95)'); eg.addColorStop(1, 'rgba(190,220,245,.8)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(h.x + th * .5, h.y - th * .12, th * .2, 0, TAU); ctx.fill(); ctx.stroke();
    if (!e.looked && t !== undefined) { ctx.fillStyle = `rgba(255,250,200,${.5 + .4 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(h.x + th * .5, h.y - th * .12, th * .08, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ============================================================
     THE COVERS: each one painted once for its own size, tilt and season
     ============================================================ */
  const seasonKey = (s) => s === 'autumn' ? 'a' : s === 'winter' ? 'w' : s === 'spring' ? 'p' : 's';
  function speckle(g, R, n, x0, y0, x1, y1, cols, r0, r1, a0, a1) {
    for (let i = 0; i < n; i++) { g.fillStyle = css(cols[(R() * cols.length) | 0], a0 + R() * (a1 - a0)); g.beginPath(); g.arc(lerp(x0, x1, R()), lerp(y0, y1, R()), r0 + R() * (r1 - r0), 0, TAU); g.fill(); }
  }
  function lichen(g, R, cx, cy, r, col) {
    for (let i = 0; i < 18; i++) { const a = R() * TAU, d = R() * r; g.fillStyle = css(mix(col, [255, 255, 240], R() * .3), .55 + R() * .3); g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .6, .25 + R() * .45, 0, TAU); g.fill(); }
  }
  function mossClump(g, R, cx, cy, r) {
    for (let i = 0; i < 26; i++) { const a = R() * TAU, d = R() * r; g.fillStyle = css(mix([70, 104, 40], [150, 180, 80], R()), .7); g.beginPath(); g.arc(cx + Math.cos(a) * d, cy - Math.abs(Math.sin(a)) * d * .7, .3 + R() * .5, 0, TAU); g.fill(); }
  }
  function leafShape(g, x, y, s, a, col, kind) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    g.fillStyle = css(col); g.beginPath();
    if (kind) { /* maple: five points */ for (let k = 0; k < 10; k++) { const t = k / 10 * TAU - Math.PI / 2, r = k % 2 ? .45 : 1; g.lineTo(Math.cos(t) * r, Math.sin(t) * r * .9); } }
    else { /* oak: an oval with soft lobes */ for (let k = 0; k <= 16; k++) { const t = k / 16 * TAU, r = .55 + .12 * Math.cos(t * 5); g.lineTo(Math.cos(t) * r * 1.5, Math.sin(t) * r * .8); } }
    g.closePath(); g.fill();
    g.strokeStyle = css(mix(col, [40, 20, 6], .5), .6); g.lineWidth = .12; g.beginPath(); g.moveTo(kind ? 0 : -.8, kind ? .8 : 0); g.lineTo(kind ? 0 : .8, kind ? -.6 : 0); g.stroke();
    g.restore();
  }
  function coverBake(c, Wd, season) {
    const R = mulberry32(c.id * 97 + 3 + c.kind.length * 7), w = c.w, h = c.h, sk = seasonKey(season);
    const tilt = c.tilt || 0, ext = Math.abs(tilt) * w / 2;
    const top = (x) => { const t = Wd.coverTop(c, c.x + x); return t === null ? null : t - c.y; };
    const base = (x) => tilt * x;
    const x0 = -w / 2, x1 = w / 2;
    const outline = () => { const p = new Path2D(); p.moveTo(x0, base(x0) + 2); for (let x = x0; x <= x1; x += 1.5) { const t = top(x); p.lineTo(x, t === null ? base(x) : t); } p.lineTo(x1, base(x1) + 2); p.closePath(); return p; };
    const B = [x0 - 8, -h - 10 - ext, x1 + 10, 6 + ext];
    return bake(B[0], B[1], B[2], B[3], 6, (g) => {
      /* a soft contact shadow on the ground */
      const sh = g.createRadialGradient(0, 0, 1, 0, 0, w * .62); sh.addColorStop(0, 'rgba(10,8,4,.4)'); sh.addColorStop(1, 'rgba(10,8,4,0)');
      g.save(); g.translate(0, 2); g.scale(1, .12); g.fillStyle = sh; g.fillRect(-w, -w, w * 2, w * 2); g.restore();
      const P = outline();
      if (c.kind === 'board' || c.kind === 'coverboard') {
        const ply = c.kind === 'coverboard';
        const c0 = ply ? [196, 160, 106] : [128, 116, 98], c1 = ply ? [140, 104, 60] : [70, 62, 52];
        const bg = g.createLinearGradient(0, -h, 0, 2); bg.addColorStop(0, css(mix(c0, [255, 250, 230], .15))); bg.addColorStop(.5, css(c0)); bg.addColorStop(1, css(c1));
        g.fillStyle = bg; g.fill(P);
        g.save(); g.clip(P);
        /* the grain: long wavy lines, a knot or two, weathered cracks */
        for (let i = 0; i < w * 1.2; i++) { const y = -h + R() * (h + 2), xa = x0 + R() * w, L = 6 + R() * 26, ph = R() * 6; g.strokeStyle = R() < .6 ? css(c1, .35 + R() * .3) : `rgba(255,245,225,${.12 + R() * .15})`; g.lineWidth = .15 + R() * .3; g.beginPath(); for (let k = 0; k <= 8; k++) { const xx = xa + L * k / 8; g.lineTo(xx, y + base(xx) * 0 + Math.sin(ph + k * .7) * .35); } g.stroke(); }
        for (let k = 0; k < (ply ? 0 : 2); k++) { const kx = x0 + w * (.25 + R() * .5), ky = -h * .5 + base(kx); g.strokeStyle = css(c1, .7); g.lineWidth = .3; for (let r = 1; r < 4; r++) { g.beginPath(); g.ellipse(kx, ky, r * .9, r * .45, 0, 0, TAU); g.stroke(); } g.fillStyle = css(mix(c1, [0, 0, 0], .4)); g.beginPath(); g.ellipse(kx, ky, .8, .4, 0, 0, TAU); g.fill(); }
        if (!ply) for (let k = 0; k < 3; k++) { const cx = R() < .5 ? x0 + R() * 8 : x1 - R() * 8; g.strokeStyle = 'rgba(30,24,16,.6)'; g.lineWidth = .3; g.beginPath(); g.moveTo(cx, -h + R() * h); g.lineTo(cx + (cx < 0 ? 6 : -6) * R(), -h * .5 + R() * 2); g.stroke(); }
        /* the board's edge: a lit top corner, the end grain darker */
        g.strokeStyle = 'rgba(255,250,235,.45)'; g.lineWidth = .5; g.beginPath(); for (let x = x0 + 1; x <= x1 - 1; x += 2) { const t = top(x); if (t !== null) x === x0 + 1 ? g.moveTo(x, t + .4) : g.lineTo(x, t + .4); } g.stroke();
        if (ply) { g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = .25; for (const f of [.35, .65]) { g.beginPath(); g.moveTo(x0, base(x0) - h * f); g.lineTo(x1, base(x1) - h * f); g.stroke(); } }
        g.restore();
        if (ply) {
          /* the survey number, stencilled in white paint, a little worn */
          g.save(); g.translate(0, base(0) - h * .5); g.rotate(Math.atan(tilt));
          g.font = `900 ${h * .85}px ${typeof UI_FONT !== 'undefined' ? UI_FONT : 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = 'rgba(246,242,226,.92)'; g.fillText('CB 7', 0, .3);
          g.globalCompositeOperation = 'destination-out'; speckle(g, R, 60, -12, -3, 12, 3, [[0, 0, 0]], .15, .35, .3, .7);
          g.restore();
        } else if (sk !== 'w') { for (let k = 0; k < 4; k++) { const mx = x0 + 6 + R() * (w - 12), t = top(mx); if (t !== null) mossClump(g, R, mx, t + .6, 2 + R() * 2); } }
      } else if (c.kind === 'log') {
        const bg = g.createLinearGradient(0, -h, 0, 2); bg.addColorStop(0, '#8a7058'); bg.addColorStop(.4, '#5e4834'); bg.addColorStop(1, '#2a1e14');
        g.fillStyle = bg; g.fill(P);
        g.save(); g.clip(P);
        /* furrowed bark: ridges running along the log, deep cracks between them */
        for (let i = 0; i < w * 3; i++) { const x = x0 + R() * w, t = top(x); if (t === null) continue; const y = lerp(t, base(x), R()), L = 4 + R() * 12; g.strokeStyle = R() < .55 ? `rgba(24,16,10,${.4 + R() * .35})` : `rgba(196,170,136,${.14 + R() * .2})`; g.lineWidth = .3 + R() * .7; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y + (R() - .5) * 1.2, x + L, y + (R() - .5)); g.stroke(); }
        /* round: lit from above, dark underneath */
        const vg = g.createLinearGradient(0, -h, 0, 2); vg.addColorStop(0, 'rgba(255,240,210,.18)'); vg.addColorStop(.35, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(x0, -h - 2, w, h + 6);
        if (sk !== 'w') for (let k = 0; k < 6; k++) { const mx = x0 + 6 + R() * (w - 14), t = top(mx); if (t !== null) mossClump(g, R, mx, t + 1.5, 3 + R() * 3); }
        for (let k = 0; k < 3; k++) { const lx = x0 + 10 + R() * (w - 20), t = top(lx); if (t !== null) lichen(g, R, lx, t + h * .35, 2, [190, 196, 160]); }
        g.restore();
        /* the broken end: pale wood, growth rings, cracks, darker bark rim */
        const ex = x1 - 2, ey = base(ex) - h * .5;
        g.fillStyle = '#3a2a1c'; g.beginPath(); g.ellipse(ex, ey, h * .28, h * .52, 0, 0, TAU); g.fill();
        const eg = g.createRadialGradient(ex - h * .05, ey - h * .1, 0, ex, ey, h * .48); eg.addColorStop(0, '#d8b27c'); eg.addColorStop(1, '#a87c4c');
        g.fillStyle = eg; g.beginPath(); g.ellipse(ex + .3, ey, h * .24, h * .46, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(110,70,34,.55)'; g.lineWidth = .25; for (let k = 1; k < 7; k++) { g.beginPath(); g.ellipse(ex + .3, ey, h * .24 * k / 7, h * .46 * k / 7, 0, 0, TAU); g.stroke(); }
        g.strokeStyle = 'rgba(60,34,16,.7)'; g.lineWidth = .35; for (let k = 0; k < 3; k++) { const a = R() * TAU; g.beginPath(); g.moveTo(ex + .3, ey); g.lineTo(ex + .3 + Math.cos(a) * h * .22, ey + Math.sin(a) * h * .43); g.stroke(); }
        if (sk === 'a') for (let k = 0; k < 6; k++) { const lx = x0 + R() * w, t = top(lx); if (t !== null) leafShape(g, lx, t + .5, 2.2 + R(), R() * TAU, [[214, 120, 30], [200, 70, 26], [230, 180, 60]][(R() * 3) | 0], R() < .5); }
      } else if (c.kind === 'leaves') {
        const mound = new Path2D(); mound.moveTo(x0, 2); for (let x = x0; x <= x1; x += 2) { const t = top(x); mound.lineTo(x, t === null ? 2 : t + 2); } mound.lineTo(x1, 2); mound.closePath();
        g.fillStyle = '#3a2a18'; g.fill(mound);
        const autumn = sk === 'a';
        const palette = autumn ? [[214, 128, 34], [196, 76, 28], [232, 178, 64], [150, 92, 40], [176, 60, 30]] : sk === 'w' ? [[110, 86, 60], [92, 72, 50], [130, 104, 72]] : [[124, 96, 56], [140, 110, 66], [96, 78, 46], [150, 120, 70]];
        for (let i = 0; i < w * 2.2; i++) {
          const x = x0 + 2 + R() * (w - 4), t = top(x); if (t === null) continue;
          const y = lerp(2, t + 1, Math.sqrt(R()));
          const col = palette[(R() * palette.length) | 0], lit = y < t + 4 ? 1.08 : .85 + R() * .15;
          leafShape(g, x, y, 2.2 + R() * 1.6, R() * TAU, mul(col, lit), R() < .45);
        }
      } else if (c.kind === 'wall') {
        /* a dry-stone wall of rounded field stones, moss in the cracks */
        const stones = [];
        for (let k = 0; k < 9; k++) { const cx = x0 + (k % 5 + .5 + (k >= 5 ? .5 : 0)) * w / 5.5, cy = base(cx) - (k >= 5 ? h * .62 : h * .25), r = w / 11 + R() * 4; stones.push([cx, cy, r]); }
        g.fillStyle = 'rgba(30,26,18,.85)'; for (const [cx, cy, r] of stones) { g.beginPath(); g.ellipse(cx, cy + 1, r * 1.12, r * .78, 0, 0, TAU); g.fill(); }
        for (const [cx, cy, r] of stones) paintStone(g, R, cx, cy, r * 1.08, r * .72, R() < .5 ? [168, 164, 152] : [150, 140, 126]);
        for (let k = 0; k < 6; k++) { const [cx, cy, r] = stones[(R() * 9) | 0]; mossClump(g, R, cx + (R() - .5) * r, cy - r * .55, 2.5); }
      } else {
        /* a flat rock (fieldstone) or a limestone slab */
        const slab = c.kind === 'slab';
        const c0 = slab ? [214, 206, 184] : [160, 156, 146], c1 = slab ? [128, 118, 96] : [76, 74, 68];
        const bg = g.createLinearGradient(-w * .2, -h, w * .1, 2); bg.addColorStop(0, css(mix(c0, [255, 252, 240], .2))); bg.addColorStop(.5, css(c0)); bg.addColorStop(1, css(c1));
        g.fillStyle = bg; g.fill(P);
        g.save(); g.clip(P);
        speckle(g, R, w * h * .9, x0, -h, x1, 2, slab ? [[236, 230, 214], [150, 140, 116], [110, 100, 80]] : [[220, 218, 210], [70, 68, 64], [120, 116, 108], [190, 170, 150]], .12, .4, .25, .6);
        if (slab) {
          /* bedding planes and pits; a crinoid stem fossil or two */
          for (let k = 1; k < 4; k++) { const yy = -h * k / 4; g.strokeStyle = 'rgba(90,80,60,.45)'; g.lineWidth = .4; g.beginPath(); for (let x = x0; x <= x1; x += 3) g.lineTo(x, yy + base(x) + Math.sin(x * .2 + k) * .4); g.stroke(); g.strokeStyle = 'rgba(255,250,236,.3)'; g.beginPath(); for (let x = x0; x <= x1; x += 3) g.lineTo(x, yy + .5 + base(x) + Math.sin(x * .2 + k) * .4); g.stroke(); }
          for (let k = 0; k < 2; k++) { const fx = x0 + 10 + R() * (w - 20), fy = -h * (.3 + R() * .4) + base(fx); g.strokeStyle = 'rgba(110,96,70,.6)'; g.lineWidth = .25; for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(fx + j * 1.1, fy, .5, .9, 0, 0, TAU); g.stroke(); } }
        } else {
          for (let k = 0; k < 2; k++) { let x = x0 + R() * w, y = -h * .8; g.strokeStyle = 'rgba(40,36,30,.55)'; g.lineWidth = .3; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (R() - .5) * 4; y += h * .25; g.lineTo(x, y); } g.stroke(); }
        }
        const vg = g.createLinearGradient(0, -h, 0, 2); vg.addColorStop(0, 'rgba(255,250,240,.2)'); vg.addColorStop(.4, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = vg; g.fillRect(x0, -h - 2, w, h + 6);
        if (sk !== 'w') for (let k = 0; k < 4; k++) { const lx = x0 + 6 + R() * (w - 12), t = top(lx); if (t !== null) lichen(g, R, lx, t + 2 + R() * 2, 2.5, R() < .3 ? [214, 150, 60] : [178, 190, 140]); }
        g.restore();
        g.strokeStyle = 'rgba(255,252,240,.4)'; g.lineWidth = .5; g.beginPath(); let st = false; for (let x = x0 + 3; x <= x1 - 3; x += 2) { const t = top(x); if (t === null) continue; st ? g.lineTo(x, t + .5) : g.moveTo(x, t + .5); st = true; } g.stroke();
      }
    });
  }
  function paintStone(g, R, cx, cy, rx, ry, col) {
    const p = new Path2D(); const n = 12;
    for (let k = 0; k <= n; k++) { const a = k / n * TAU, rr2 = 1 + (R() - .5) * .18; p.lineTo(cx + Math.cos(a) * rx * rr2, cy + Math.sin(a) * ry * rr2); }
    p.closePath();
    const sg = g.createRadialGradient(cx - rx * .35, cy - ry * .45, 1, cx, cy, rx * 1.2);
    sg.addColorStop(0, css(mix(col, [255, 252, 240], .3))); sg.addColorStop(.6, css(col)); sg.addColorStop(1, css(mul(col, .45)));
    g.fillStyle = sg; g.fill(p);
    g.save(); g.clip(p); speckle(g, R, rx * ry * 1.2, cx - rx, cy - ry, cx + rx, cy + ry, [[230, 228, 220], [70, 66, 60], [120, 112, 100]], .12, .35, .2, .5);
    if (R() < .7) lichen(g, R, cx + (R() - .5) * rx, cy - ry * .5, rx * .3, R() < .3 ? [214, 150, 60] : [178, 190, 140]);
    g.restore();
  }
  function drawCover(ctx, c, Wd, season, snow) {
    const key = `cover|${c.kind}|${c.id}|${Math.round(c.w)}|${c.h}|${(c.tilt || 0).toFixed(3)}|${seasonKey(season)}`;
    const img = once(key, () => coverBake(c, Wd, season));
    if (!img) return Sprites.drawCover(ctx, c, Wd, season, snow);
    ctx.save(); ctx.translate(c.x, c.y); put(ctx, img); ctx.restore();
    if (snow > .05 && c.kind !== 'leaves') {
      const x0 = c.x - c.w / 2, x1 = c.x + c.w / 2, base = (x) => c.y + c.tilt * (x - c.x);
      ctx.fillStyle = `rgba(250,252,255,${snow})`; ctx.beginPath(); ctx.moveTo(x0 + 4, base(x0));
      for (let x = x0 + 4; x <= x1 - 4; x += 3) { const t0 = Wd.coverTop(c, x); ctx.lineTo(x, (t0 === null ? base(x) : t0) - 3 * snow); }
      for (let x = x1 - 4; x >= x0 + 4; x -= 3) { const t0 = Wd.coverTop(c, x); ctx.lineTo(x, (t0 === null ? base(x) : t0) + 1); }
      ctx.fill();
    }
  }

  /* ============================================================
     THE GROUND'S DETAIL: seamless tiles laid over the soil and the limestone
     ============================================================ */
  function tile(TW, TH, K, seed, paint) {
    const [c, g] = soft(TW * K, TH * K); g.scale(K, K); g.lineCap = 'round';
    const R = mulberry32(seed);
    const wrap = (fn) => { for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    paint(g, R, wrap);
    return toGPU(c);
  }
  const pats = {};
  function pattern(ctx, name, make, K) {
    if (pats[name]) return pats[name];
    let h = pats['_' + name];
    if (!h) {
      if (!canBake()) return null;
      const t0 = performance.now(); h = pats['_' + name] = make(); stat.n++; stat.ms += performance.now() - t0; spent(t0);
    }
    /* the pattern is made from the GPU copy only (a pattern on a CPU canvas is re-sent every frame) */
    if (!h.ready) return null;
    const p = ctx.createPattern(h.c, 'repeat');
    if (p && p.setTransform) p.setTransform(new DOMMatrix().scale(1 / K, 1 / K));
    return (pats[name] = p);
  }
  function soilPattern(ctx) {
    return pattern(ctx, 'soil', () => tile(240, 200, 3, 2203, (g, R, wrap) => {
      for (let i = 0; i < 140; i++) { const x = R() * 240, y = R() * 200, r = 3 + R() * 9, a = .05 + R() * .08, dark = R() < .6; wrap(() => { g.fillStyle = dark ? `rgba(30,16,6,${a})` : `rgba(255,230,190,${a * .6})`; g.beginPath(); g.ellipse(x, y, r, r * (.5 + R() * .3), R(), 0, TAU); g.fill(); }); }
      for (let i = 0; i < 1600; i++) { const x = R() * 240, y = R() * 200, r = .2 + R() * .6, lt = R() < .45; wrap(() => { g.fillStyle = lt ? 'rgba(255,236,200,.25)' : 'rgba(16,8,0,.3)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); }
      for (let i = 0; i < 22; i++) {
        const pts = [[R() * 240, R() * 200]]; let a = R() * TAU;
        for (let k = 0; k < 9; k++) { a += (R() - .5) * 1.1; const [x, y] = pts[pts.length - 1]; pts.push([x + Math.cos(a) * (3 + R() * 5), y + Math.abs(Math.sin(a)) * (3 + R() * 5)]); }
        const w = .25 + R() * .6;
        wrap(() => { g.strokeStyle = 'rgba(40,22,8,.35)'; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts) g.lineTo(...q); g.stroke(); g.strokeStyle = 'rgba(230,200,160,.12)'; g.lineWidth = w * .5; g.beginPath(); g.moveTo(pts[0][0] + .4, pts[0][1] - .4); for (const q of pts) g.lineTo(q[0] + .4, q[1] - .4); g.stroke(); });
      }
      for (let i = 0; i < 38; i++) {
        const x = R() * 240, y = R() * 200, r = 1 + R() * R() * 4, e = .55 + R() * .35, rot = (R() - .5) * .8, tone = 90 + R() * 80, warm = R() * 18;
        wrap(() => {
          g.fillStyle = 'rgba(10,6,2,.35)'; g.beginPath(); g.ellipse(x + r * .25, y + r * .35, r, r * e, rot, 0, TAU); g.fill();
          const pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1); pg.addColorStop(0, `rgba(${tone + 60 + warm},${tone + 55},${tone + 40},.85)`); pg.addColorStop(1, `rgba(${tone * .5 + warm},${tone * .48},${tone * .42},.85)`);
          g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * e, rot, 0, TAU); g.fill();
        });
      }
    }), 3);
  }
  function rockPattern(ctx) {
    return pattern(ctx, 'rock', () => tile(260, 156, 3, 4409, (g, R, wrap) => {
      /* limestone beds: bands of slightly different stone, thin shaly partings, vertical joints, fossils */
      let y = 0;
      while (y < 156) {
        const hgt = 10 + R() * 16, tone = R() < .5 ? `rgba(255,248,230,${.06 + R() * .08})` : `rgba(60,50,30,${.05 + R() * .07})`, ph = R() * TAU;
        const yy = y;
        wrap(() => { g.fillStyle = tone; g.beginPath(); g.moveTo(0, yy); for (let x = 0; x <= 260; x += 10) g.lineTo(x, yy + Math.sin(x / 260 * TAU + ph) * 1.5); for (let x = 260; x >= 0; x -= 10) g.lineTo(x, yy + hgt + Math.sin(x / 260 * TAU + ph + .4) * 1.5); g.fill();
          g.strokeStyle = 'rgba(70,60,44,.45)'; g.lineWidth = .8; g.beginPath(); for (let x = 0; x <= 260; x += 10) g.lineTo(x, yy + Math.sin(x / 260 * TAU + ph) * 1.5); g.stroke();
          g.strokeStyle = 'rgba(255,250,236,.25)'; g.lineWidth = .5; g.beginPath(); for (let x = 0; x <= 260; x += 10) g.lineTo(x, yy + .9 + Math.sin(x / 260 * TAU + ph) * 1.5); g.stroke(); });
        /* joints: short vertical cracks within the bed */
        for (let k = 0; k < 3; k++) { const jx = R() * 260, j2 = jx + (R() - .5) * 3; wrap(() => { g.strokeStyle = 'rgba(60,50,36,.4)'; g.lineWidth = .5; g.beginPath(); g.moveTo(jx, yy + 1); g.lineTo(j2, yy + hgt - 1); g.stroke(); }); }
        y += hgt;
      }
      for (let i = 0; i < 1200; i++) { const x = R() * 260, yy = R() * 156, r = .2 + R() * .5, lt = R() < .5; wrap(() => { g.fillStyle = lt ? 'rgba(255,252,240,.3)' : 'rgba(70,60,40,.28)'; g.beginPath(); g.arc(x, yy, r, 0, TAU); g.fill(); }); }
      /* fossils: crinoid stems (stacks of discs) and little brachiopod shells */
      for (let i = 0; i < 9; i++) {
        const x = R() * 260, yy = R() * 156, a = R() * TAU, shell = R() < .5;
        wrap(() => {
          g.save(); g.translate(x, yy); g.rotate(a); g.strokeStyle = 'rgba(96,84,60,.55)'; g.lineWidth = .35;
          if (shell) { g.fillStyle = 'rgba(240,232,210,.35)'; g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(-3, -1, 0, -2.5); g.quadraticCurveTo(3, -1, 0, 2); g.fill(); g.stroke(); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 2); g.lineTo(k * .9, -2); g.stroke(); } }
          else for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(k * 1.1, 0, .5, 1, 0, 0, TAU); g.stroke(); }
          g.restore();
        });
      }
    }), 3);
  }

  /* ============================================================
     GRASS, WILDFLOWERS AND CATTAILS
     ============================================================ */
  const GRASS = { spring: [[88, 148, 52], [150, 200, 90]], summer: [[76, 128, 44], [168, 186, 92]], autumn: [[150, 124, 64], [214, 190, 116]], winter: [[140, 128, 100], [196, 184, 150]] };
  function grassTuft(season, v) {
    return once('grass|' + season + '|' + v, () => {
      const R = mulberry32(300 + v * 17 + season.length), [lo, hi] = GRASS[season] || GRASS.summer;
      return bake(-12, -26, 12, 1.5, 8, (g) => {
        const n = 20 + v * 3;
        for (let i = 0; i < n; i++) {
          const x0 = (R() - .5) * 9, h = 7 + R() * 15 * (season === 'spring' ? .8 : 1), lean = (R() - .5) * 10, w = .35 + R() * .35, back = i < n * .4;
          const gg = g.createLinearGradient(0, 0, 0, -h);
          gg.addColorStop(0, css(mix(lo, [20, 26, 8], back ? .6 : .4))); gg.addColorStop(1, css(mul(mix(lo, hi, R()), back ? .78 : 1)));
          g.fillStyle = gg; g.beginPath(); g.moveTo(x0 - w, 0); g.quadraticCurveTo(x0 + lean * .3, -h * .6, x0 + lean, -h); g.quadraticCurveTo(x0 + lean * .3 + w * .3, -h * .6, x0 + w, 0); g.closePath(); g.fill();
          if (!back && R() < .5) { g.strokeStyle = 'rgba(255,255,220,.25)'; g.lineWidth = .15; g.beginPath(); g.moveTo(x0, -1); g.quadraticCurveTo(x0 + lean * .3, -h * .6, x0 + lean * .96, -h * .96); g.stroke(); }
          if (R() < .12 && season !== 'spring') { g.fillStyle = css(mix(hi, [130, 100, 60], .35)); for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x0 + lean + k * .15, -h - 1 - k * 1.1, .45, 1, lean * .05, 0, TAU); g.fill(); } }
        }
      });
    });
  }
  function drawGrass(ctx, x, y, s, season, sway, v) {
    const img = grassTuft(season, v % 6); if (!img) return false;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sway * .3, 1, 0, 0); ctx.scale(s, s); put(ctx, img); ctx.restore();
    return true;
  }
  /* the meadow's flowers, by species (keyed off the game's colours): black-eyed Susan, oxeye daisy,
     New England aster, butterfly weed, chicory, wild bergamot; goldenrod and seed heads in autumn */
  const SPECIES = { '#f2d043': 'susan', '#ffffff': 'daisy', '#c86ad8': 'aster', '#f08a3a': 'milkweed', '#7ab0f0': 'chicory', '#ff6a8a': 'bergamot' };
  function flowerBake(sp, autumn, v) {
    const R = mulberry32(900 + sp.length * 13 + v * 7 + (autumn ? 3 : 0));
    return bake(-9, -46, 9, 1, 8, (g) => {
      /* a stem with leaves; the head drawn at the top (the stem is 40 long; drawFlower scales it) */
      const H = 40, lean = (R() - .5) * 4;
      g.strokeStyle = autumn ? '#7a6a3a' : '#4a7a2a'; g.lineWidth = .7; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean * .2, -H * .5, lean, -H); g.stroke();
      for (let k = 0; k < 3; k++) { const t = .2 + k * .2, lx = lean * t * t, ly = -H * t, side = k % 2 ? 1 : -1; g.fillStyle = autumn ? 'rgba(130,110,60,.9)' : 'rgba(76,124,44,.95)'; g.beginPath(); g.ellipse(lx + side * 2.6, ly - 1, 3, .8, side * -.6, 0, TAU); g.fill(); }
      g.save(); g.translate(lean, -H);
      if (autumn) {
        if (sp === 'aster') { for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; g.strokeStyle = '#a890d8'; g.lineWidth = .5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 3.2, Math.sin(a) * 3.2 * .8); g.stroke(); } g.fillStyle = '#d8a030'; g.beginPath(); g.arc(0, 0, 1.1, 0, TAU); g.fill(); }
        else if (sp === 'susan' || sp === 'milkweed') { /* goldenrod plumes */ for (let i = 0; i < 40; i++) { const t = R(), a = -1.2 + t * 1.4; g.fillStyle = css(mix([240, 196, 40], [200, 150, 20], R())); g.beginPath(); g.arc(Math.cos(a) * 6 * t - 2, -Math.sin(a) * 3 - t * 7 + 4, .6 + R() * .4, 0, TAU); g.fill(); } }
        else { /* a dry seed head */ g.fillStyle = '#6a4a2a'; g.beginPath(); g.ellipse(0, 0, 1.6, 2.2, 0, 0, TAU); g.fill(); for (let i = 0; i < 12; i++) { const a = R() * TAU; g.strokeStyle = 'rgba(240,236,220,.6)'; g.lineWidth = .2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 3, Math.sin(a) * 3); g.stroke(); } }
      } else if (sp === 'susan' || sp === 'daisy') {
        const n = sp === 'susan' ? 13 : 22, col = sp === 'susan' ? [244, 190, 30] : [250, 250, 244], L = sp === 'susan' ? 4.4 : 4;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .1; g.save(); g.rotate(a); g.scale(1, .55 + .45 * Math.abs(Math.cos(a)));
          const pg = g.createLinearGradient(0, 0, L, 0); pg.addColorStop(0, css(mul(col, .85))); pg.addColorStop(1, css(col)); g.fillStyle = pg; g.beginPath(); g.ellipse(L * .55, 0, L * .5, sp === 'susan' ? .8 : .55, 0, 0, TAU); g.fill(); g.restore(); }
        const cg = g.createRadialGradient(-.4, -.4, 0, 0, 0, 1.8); cg.addColorStop(0, sp === 'susan' ? '#5a3418' : '#f8d040'); cg.addColorStop(1, sp === 'susan' ? '#24120a' : '#d89a20');
        g.fillStyle = cg; g.beginPath(); g.arc(0, 0, sp === 'susan' ? 1.8 : 1.4, 0, TAU); g.fill();
      } else if (sp === 'aster' || sp === 'chicory') {
        const n = sp === 'aster' ? 26 : 14, col = sp === 'aster' ? [150, 90, 210] : [120, 160, 236];
        for (let i = 0; i < n; i++) { const a = i / n * TAU; g.save(); g.rotate(a); g.scale(1, .6 + .4 * Math.abs(Math.cos(a))); g.fillStyle = css(mix(col, [255, 255, 255], R() * .2)); g.beginPath(); if (sp === 'chicory') { g.moveTo(.5, -.6); g.lineTo(4, -1); g.lineTo(4.3, 0); g.lineTo(4, 1); g.lineTo(.5, .6); } else g.ellipse(2.3, 0, 2, .35, 0, 0, TAU); g.fill(); g.restore(); }
        g.fillStyle = sp === 'aster' ? '#f0b830' : '#5a70b8'; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
      } else if (sp === 'milkweed') {
        /* butterfly weed: a flat umbel of little orange stars */
        for (let i = 0; i < 26; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 4.5; g.fillStyle = css(mix([250, 130, 30], [255, 180, 60], R())); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d * .45 - (4.5 - d) * .3, .75, 0, TAU); g.fill(); }
      } else {
        /* wild bergamot: a shaggy pink-lilac pompom */
        for (let i = 0; i < 30; i++) { const a = -Math.PI * R(), d = 1.5 + R() * 2.5; g.strokeStyle = css(mix([226, 130, 190], [250, 190, 220], R())); g.lineWidth = .5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * d, Math.sin(a) * d); g.stroke(); }
        g.fillStyle = '#9a5a8a'; g.beginPath(); g.arc(0, .3, 1.3, 0, TAU); g.fill();
      }
      g.restore();
    });
  }
  function drawFlower(ctx, f, y, season, sway) {
    const sp = SPECIES[f.col] || 'daisy', autumn = season === 'autumn', v = (f.ph * 3 | 0) % 3;
    const img = once(`flower|${sp}|${autumn ? 1 : 0}|${v}`, () => flowerBake(sp, autumn, v)); if (!img) return false;
    ctx.save(); ctx.translate(f.x, y); ctx.transform(1, 0, sway / Math.max(10, f.h), 1, 0, 0); ctx.scale(f.h / 40, f.h / 40); put(ctx, img); ctx.restore();
    return true;
  }
  function reedBake(season, v) {
    const R = mulberry32(1500 + v * 11 + season.length);
    return bake(-8, -104, 8, 6, 6, (g) => {
      const col = season === 'winter' ? [168, 150, 112] : season === 'autumn' ? [170, 160, 90] : [80, 128, 52];
      for (let i = 0; i < 4; i++) { const x0 = (R() - .5) * 4, h = 50 + R() * 45, lean = (R() - .5) * 10, w = .7 + R() * .4; const gg = g.createLinearGradient(-w, 0, w, 0); gg.addColorStop(0, css(mul(col, .7))); gg.addColorStop(.5, css(mix(col, [255, 255, 220], .15))); gg.addColorStop(1, css(mul(col, .75))); g.fillStyle = gg; g.beginPath(); g.moveTo(x0 - w, 6); g.quadraticCurveTo(x0 + lean * .2, -h * .5, x0 + lean, -h); g.quadraticCurveTo(x0 + lean * .2 + w * .2, -h * .5, x0 + w, 6); g.closePath(); g.fill(); }
      /* the stalk and the brown cattail spike, velvety, with its thin tip */
      g.strokeStyle = css(mul(col, .85)); g.lineWidth = .8; g.beginPath(); g.moveTo(0, 6); g.lineTo(.5, -98); g.stroke();
      const sg = g.createLinearGradient(-2.6, 0, 2.6, 0); sg.addColorStop(0, '#4a2e18'); sg.addColorStop(.4, '#8a5a32'); sg.addColorStop(1, '#3a2010');
      g.fillStyle = sg; g.beginPath(); g.ellipse(.4, -82, 2.6, 9, 0, 0, TAU); g.fill();
      if (season === 'winter') { for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(240,236,224,.8)'; g.beginPath(); g.arc(.4 + (R() - .5) * 6, -84 + (R() - .5) * 16, .8 + R(), 0, TAU); g.fill(); } }
      speckle(g, R, 40, -2, -90, 2.8, -74, [[40, 24, 12], [150, 110, 70]], .15, .35, .3, .6);
    });
  }
  function drawReed(ctx, r, y, season, sway) {
    const v = (r.ph * 4 | 0) % 4, img = once(`reed|${season}|${v}`, () => reedBake(season, v)); if (!img) return false;
    ctx.save(); ctx.translate(r.x, y); ctx.transform(1, 0, sway / Math.max(30, r.h), 1, 0, 0); ctx.scale(r.h / 95, r.h / 95); put(ctx, img); ctx.restore();
    return true;
  }

  /* ============================================================
     TREES: sugar maples and red oaks by season, eastern white pines
     ============================================================ */
  const LEAVES = { spring: [[150, 196, 90], [120, 176, 70], [184, 214, 120]], summer: [[64, 116, 44], [48, 96, 36], [92, 140, 56]],
    autumn: { maple: [[220, 80, 30], [236, 130, 34], [196, 46, 30], [244, 176, 50]], oak: [[150, 70, 34], [176, 96, 40], [120, 56, 30], [190, 120, 50]] } };
  function treeBake(T, season, snowy) {
    const R = mulberry32(T.seed), h = T.h, w = T.w, pine = T.kind === 'pine';
    return bake(-w * 1.15, -h * 1.04, w * 1.15, 6, 2, (g) => {
      const bark = (x0, y0, x1, y1, w0, w1) => {
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        const p = new Path2D(); p.moveTo(x0 + nx * w0, y0 + ny * w0); p.lineTo(x1 + nx * w1, y1 + ny * w1); p.lineTo(x1 - nx * w1, y1 - ny * w1); p.lineTo(x0 - nx * w0, y0 - ny * w0); p.closePath();
        const bg = g.createLinearGradient(x0 + nx * w0, y0 + ny * w0, x0 - nx * w0, y0 - ny * w0); bg.addColorStop(0, '#3a2c22'); bg.addColorStop(.35, pine ? '#6a5040' : '#6e665c'); bg.addColorStop(1, '#2a2018');
        g.fillStyle = bg; g.fill(p);
        g.save(); g.clip(p); g.strokeStyle = 'rgba(20,14,10,.45)'; g.lineWidth = .5;
        for (let i = 0; i < L / 3; i++) { const t = R(), s = (R() - .5) * 1.6, x = x0 + dx * t + nx * s * lerp(w0, w1, t), y = y0 + dy * t + ny * s * lerp(w0, w1, t); g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx / L * 5, y + dy / L * 5); g.stroke(); }
        g.restore();
      };
      if (pine) {
        /* an eastern white pine: a tall straight trunk, soft blue-green tiers held out sideways */
        bark(0, 4, 0, -h * .96, w * .07, w * .015);
        const tiers = 7 + (R() * 3 | 0);
        for (let k = 0; k < tiers; k++) {
          const ty = -h * (.26 + .7 * k / tiers), span = w * (1.25 - .85 * k / tiers) * (.75 + R() * .4), side = k % 2 ? 1 : -1;
          for (const sd of [side, -side * (R() < .6 ? 1 : 0)]) {
            if (!sd) continue;
            const ex = sd * span * .5, ey = ty - span * .06;
            g.strokeStyle = '#3a2a1e'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, ty + 4); g.quadraticCurveTo(ex * .5, ty, ex, ey); g.stroke();
            for (let i = 0; i < 230; i++) {
              const t = Math.sqrt(R()), cx = ex * t + (R() - .5) * 16, cy = ey + (R() - .65) * 24 * (1 - t * .5), a = (R() - .5) * 1.2 - Math.PI / 2 * .2;
              const lit = clamp(1.2 - (cy - ey + 8) / 16 * .6, .55, 1.25);
              g.strokeStyle = css(mul(mix([40, 78, 60], [90, 136, 106], R()), lit), .75); g.lineWidth = .7;
              for (let n = 0; n < 6; n++) { const aa = a + (n - 2.5) * .22; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(aa) * 5 * sd, cy + Math.sin(aa) * 2 - 1, cx + Math.cos(aa) * 9 * sd, cy + Math.sin(aa) * 4 + 1); g.stroke(); }
            }
            if (snowy) { g.fillStyle = 'rgba(248,251,255,.95)'; g.beginPath(); g.ellipse(ex * .55, ey - 7, Math.abs(ex) * .55, 3.4, 0, Math.PI, TAU); g.fill(); }
          }
        }
        return;
      }
      /* a maple or an oak: a trunk that forks into limbs, a crown of leaf clusters (or bare twigs in winter) */
      const oak = T.kind === 'oak', crownY = -h * .6, crownRx = w * .8, crownRy = h * .36;
      bark(0, 4, 0, -h * .36, w * .1, w * .07);
      const tips = [];
      const limb = (x, y, a, len, wd, depth) => {
        const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
        bark(x, y, x1, y1, wd, wd * .65);
        if (depth <= 0 || wd < .6) { tips.push([x1, y1]); return; }
        const n = depth > 2 ? 3 : 2;
        for (let i = 0; i < n; i++) limb(x1, y1, a + (i - (n - 1) / 2) * (oak ? .7 : .5) + (R() - .5) * .4, len * (.62 + R() * .15), wd * .62, depth - 1);
      };
      for (let i = 0; i < 3; i++) limb(0, -h * .34, -Math.PI / 2 + (i - 1) * (oak ? .62 : .42) + (R() - .5) * .2, h * .17, w * .06, season === 'winter' ? 4 : 3);
      if (season === 'winter') {
        if (snowy) { g.strokeStyle = 'rgba(250,252,255,.85)'; g.lineWidth = 1.2; for (const [x, y] of tips) { g.beginPath(); g.moveTo(x - 2, y + 1); g.lineTo(x + 2, y); g.stroke(); } }
        return;
      }
      const pal = season === 'autumn' ? LEAVES.autumn[oak ? 'oak' : 'maple'] : LEAVES[season] || LEAVES.summer;
      /* the crown: lobes of leaf clusters, darker inside and below, sunlit on the top left */
      const lobes = [];
      for (let i = 0; i < 12; i++) { const a = R() * TAU, d = Math.sqrt(R()) * .7; lobes.push([Math.cos(a) * crownRx * d, crownY + Math.sin(a) * crownRy * d * .85, crownRx * (.38 + R() * .18)]); }
      for (const pass of [0, 1]) for (const [lx, ly, lr] of lobes) {
        for (let i = 0; i < (pass ? 300 : 160); i++) {
          const a = R() * TAU, d = Math.sqrt(R()) * lr, x = lx + Math.cos(a) * d, y = ly + Math.sin(a) * d * .8;
          const light = clamp(.55 + (-(x - lx) / lr * .3 - (y - ly) / lr * .55) * (pass ? 1 : .4) + (pass ? .2 : -.15) - (y - crownY) / crownRy * .2, .35, 1.3);
          const col = mul(pal[(R() * pal.length) | 0], light);
          g.fillStyle = css(col, pass ? .95 : .9); g.beginPath(); g.ellipse(x, y, 2.2 + R() * 2, 1.4 + R() * 1.4, R() * TAU, 0, TAU); g.fill();
        }
      }
      /* a few gaps where the sky shows through, and some limbs showing */
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse((R() - .5) * crownRx * 1.6, crownY + (R() - .5) * crownRy * 1.4, 2 + R() * 4, 1.5 + R() * 3, R(), 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    });
  }
  function drawTree(ctx, T, gy, season, t, snow) {
    const snowy = snow > .1 ? 1 : 0, img = once(`tree|${T.seed}|${T.kind}|${season}|${snowy}|${Math.round(T.h)}|${Math.round(T.w)}`, () => treeBake(T, season, snowy));
    if (!img) return Sprites.drawTree(ctx, T, gy, season, t, snow);
    const sway = Math.sin(t * .6 + T.seed) * 2;
    ctx.save(); ctx.translate(T.x, gy); ctx.transform(1, 0, -sway / T.h, 1, 0, 0); put(ctx, img); ctx.restore();
  }

  /* ============================================================
     CRITTERS: a green frog, an earthworm, a grasshopper
     ============================================================ */
  function frogBake(hop) {
    const R = mulberry32(hop ? 41 : 40);
    return bake(-22, -16, 14, 3, 12, (g) => {
      const skin = [96, 140, 58], dark = [40, 70, 26], belly = [232, 230, 190];
      if (hop) {
        /* the long hind legs stretched out behind */
        g.strokeStyle = css(mix(skin, dark, .3)); g.lineWidth = 2.2; g.beginPath(); g.moveTo(-5, -4); g.lineTo(-13, 2); g.lineTo(-19, 1); g.stroke();
        g.strokeStyle = css(dark, .6); g.lineWidth = .4; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-9 - k * 2.5, -1.5 + k * 1.1); g.lineTo(-8.5 - k * 2.5, .2 + k * 1.1); g.stroke(); }
        g.fillStyle = css(dark); g.beginPath(); g.ellipse(-20, 1, 2.2, .8, 0, 0, TAU); g.fill();
      }
      const body = new Path2D(); body.ellipse(0, -5, 8, 5, hop ? -.4 : -.15, 0, TAU);
      const bg = g.createLinearGradient(0, -10, 0, 0); bg.addColorStop(0, css(mix(skin, [200, 220, 120], .2))); bg.addColorStop(.6, css(skin)); bg.addColorStop(1, css(mix(skin, belly, .5)));
      g.fillStyle = bg; g.fill(body);
      g.save(); g.clip(body);
      for (let i = 0; i < 9; i++) { g.fillStyle = css(dark, .55); g.beginPath(); g.ellipse(-6 + R() * 10, -8 + R() * 4, .8 + R() * 1.2, .6 + R() * .8, R(), 0, TAU); g.fill(); }
      g.fillStyle = css(belly, .85); g.beginPath(); g.ellipse(1, -.6, 7, 2.2, 0, 0, TAU); g.fill();
      g.restore();
      /* the ridge along its side, the sitting hind leg folded, the front leg */
      g.strokeStyle = 'rgba(210,220,150,.6)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-6, -7.5); g.quadraticCurveTo(0, -9.5, 5, -9); g.stroke();
      if (!hop) { const lg = g.createRadialGradient(-5, -3, .5, -4, -2, 5.5); lg.addColorStop(0, css(mix(skin, [220, 230, 140], .2))); lg.addColorStop(1, css(dark)); g.fillStyle = lg; g.beginPath(); g.ellipse(-4, -2, 5.2, 2.7, .3, 0, TAU); g.fill(); g.fillStyle = css(dark); g.beginPath(); g.ellipse(-1, .5, 3, .8, 0, 0, TAU); g.fill(); }
      g.strokeStyle = css(mix(skin, dark, .3)); g.lineWidth = 1.1; g.beginPath(); g.moveTo(4, -3); g.lineTo(5, 0); g.stroke();
      /* the head: a big gold eye, the round eardrum behind it, a pale upper lip */
      const hg = g.createRadialGradient(5, -9, .5, 5, -8, 5); hg.addColorStop(0, css(mix(skin, [210, 230, 120], .3))); hg.addColorStop(1, css(skin)); g.fillStyle = hg; g.beginPath(); g.ellipse(5, -8, 4.6, 3.5, .1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(230,236,180,.7)'; g.beginPath(); g.ellipse(7, -6.4, 2.6, .7, .2, 0, TAU); g.fill();
      g.fillStyle = css(mix(skin, [70, 60, 30], .4)); g.beginPath(); g.arc(2.4, -8, 1.6, 0, TAU); g.fill();
      const eg = g.createRadialGradient(5.6, -11, .2, 6, -10.5, 2.1); eg.addColorStop(0, '#f6e070'); eg.addColorStop(1, '#a87818'); g.fillStyle = eg; g.beginPath(); g.arc(6, -10.5, 2, 0, TAU); g.fill();
      g.fillStyle = '#100a04'; g.beginPath(); g.ellipse(6.2, -10.5, 1.1, .6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(5.6, -11.2, .4, 0, TAU); g.fill();
    });
  }
  function drawFrog(ctx, c, s = 1) {
    const hop = c.state === 'hop', img = once('frog|' + (hop ? 1 : 0), () => frogBake(hop));
    if (!img) return Sprites.drawFrog(ctx, c, s);
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale((c.face || 1) * s, s);
    ctx.fillStyle = 'rgba(10,8,4,.25)'; ctx.beginPath(); ctx.ellipse(0, .5, 8, 1.4, 0, 0, TAU); ctx.fill();
    put(ctx, img); ctx.restore();
  }
  function hopperBake() {
    return bake(-10, -10, 11, 2, 14, (g) => {
      const body = [118, 150, 60], dark = [70, 90, 34];
      /* the big hind leg: a muscled thigh with herringbone marks, a thin spiny shin */
      const th = g.createLinearGradient(0, -7, 0, -2); th.addColorStop(0, css(mix(body, [220, 220, 140], .2))); th.addColorStop(1, css(dark));
      g.fillStyle = th; g.beginPath(); g.ellipse(-2.5, -5, 4.2, 1.3, -.45, 0, TAU); g.fill();
      g.strokeStyle = css(dark, .7); g.lineWidth = .18; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-5 + k * 1.2, -4.2 + k * -.5); g.lineTo(-4.5 + k * 1.2, -5.6 + k * -.5); g.stroke(); }
      g.strokeStyle = css(dark); g.lineWidth = .45; g.beginPath(); g.moveTo(-5.8, -3.5); g.lineTo(-7, -.2); g.lineTo(-5, .2); g.stroke();
      /* the body: a long abdomen, the saddle-shaped thorax, folded wings */
      const bg = g.createLinearGradient(0, -6, 0, 0); bg.addColorStop(0, css(mix(body, [230, 230, 150], .25))); bg.addColorStop(1, css(mix(body, [200, 190, 120], .3)));
      g.fillStyle = bg; g.beginPath(); g.ellipse(-.5, -3, 6.2, 1.7, -.05, 0, TAU); g.fill();
      g.fillStyle = css(mix(body, [150, 120, 60], .45), .85); g.beginPath(); g.ellipse(-1.2, -3.9, 4.8, .9, -.08, 0, TAU); g.fill();
      g.fillStyle = css(body); g.beginPath(); g.ellipse(4.2, -3.6, 2.3, 1.9, 0, 0, TAU); g.fill();
      g.fillStyle = css(mix(body, [200, 210, 120], .3)); g.beginPath(); g.ellipse(6.4, -3.7, 1.6, 1.8, .2, 0, TAU); g.fill();
      g.fillStyle = '#3a2a14'; g.beginPath(); g.ellipse(6.6, -4.4, .55, .7, 0, 0, TAU); g.fill();
      g.strokeStyle = css(dark); g.lineWidth = .2; g.beginPath(); g.moveTo(7, -5); g.quadraticCurveTo(9, -9, 10.5, -8.5); g.stroke();
      g.lineWidth = .3; for (const lx of [3.2, 5]) { g.beginPath(); g.moveTo(lx, -2.2); g.lineTo(lx + .6, 0); g.stroke(); }
    });
  }
  function drawHopper(ctx, c) {
    const img = once('hopper', hopperBake); if (!img) return Sprites.drawHopper(ctx, c);
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.vx < 0 ? -1 : 1, 1); put(ctx, img); ctx.restore();
  }
  /* an earthworm peeping out: pink-brown, ringed, a paler saddle band, glistening */
  function drawWorm(ctx, w) {
    if (w.up <= 0) return;
    ctx.save(); ctx.translate(w.x, w.y);
    const h = 9 * w.up, pts = [];
    const cx = Math.sin(w.ph) * 4, ex = Math.sin(w.ph + 1) * 3;
    for (let i = 0; i <= 12; i++) { const t = i / 12, u = 1 - t; pts.push([2 * u * t * cx + t * t * ex, u * u * 1 + 2 * u * t * (-h * .5) + t * t * (-h)]); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
    ctx.strokeStyle = '#7a3a34'; ctx.lineWidth = 2.6; path(); ctx.stroke();
    ctx.strokeStyle = '#c87a72'; ctx.lineWidth = 2; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,210,.55)'; ctx.lineWidth = .6; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x - .45, y) : ctx.moveTo(x - .45, y)); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,50,46,.5)'; ctx.lineWidth = .25;
    for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i], [x2, y2] = pts[i + 1], dx = x2 - x, dy = y2 - y, d = Math.hypot(dx, dy) || 1; ctx.beginPath(); ctx.moveTo(x - dy / d, y + dx / d); ctx.lineTo(x + dy / d, y - dx / d); ctx.stroke(); }
    if (pts.length > 6) { const [x, y] = pts[7]; ctx.strokeStyle = 'rgba(232,150,130,.9)'; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x, y - .6); ctx.stroke(); }
    const mg = ctx.createRadialGradient(0, 1, .5, 0, 1, 5); mg.addColorStop(0, '#3a2414'); mg.addColorStop(1, 'rgba(90,60,36,.6)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(0, 1.2, 4.5, 1.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     VISITORS: the red-tailed hawk, the raccoon, the great blue heron, the scientist
     ============================================================ */
  function feather(g, x0, y0, x1, y1, w, col, edge) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w;
    g.fillStyle = css(col); g.beginPath(); g.moveTo(x0 + nx * .5, y0 + ny * .5); g.quadraticCurveTo(x0 + dx * .6 + nx, y0 + dy * .6 + ny, x1, y1); g.quadraticCurveTo(x0 + dx * .6 - nx, y0 + dy * .6 - ny, x0 - nx * .5, y0 - ny * .5); g.closePath(); g.fill();
    if (edge) { g.strokeStyle = css(edge, .5); g.lineWidth = .25; g.stroke(); }
    g.strokeStyle = css(mul(col, .7), .6); g.lineWidth = .2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * .9, y0 + dy * .9); g.stroke();
  }
  /* the hawk seen from below as it circles: pale underwings with the dark bar on the leading edge,
     dark wrist marks and fingertips, a streaked belly band, the rufous tail */
  function hawkWing() {
    const R = mulberry32(501);
    return bake(-2, -40, 64, 14, 6, (g) => {
      const cream = [236, 226, 204], buff = [214, 190, 150], dark = [70, 46, 30];
      /* primaries: separated fingers at the tip, dark tipped */
      for (let k = 0; k < 6; k++) { const bx = 40 + k * 2.2, by = -2 - k * 1.2, tx = 56 + k * 1.2 - k * k * .15, ty = -14 - k * 3.2; const fg = mix(cream, buff, R() * .4); feather(g, bx, by, tx, ty, 2.2, fg, dark); g.fillStyle = css(dark, .85); g.beginPath(); g.ellipse(tx - (tx - bx) * .08, ty - (ty - by) * .08, 1.6, 3, Math.atan2(ty - by, tx - bx) + Math.PI / 2, 0, TAU); g.fill(); }
      /* the secondaries: a broad trailing panel with fine bars and a dark edge */
      const sec = new Path2D(); sec.moveTo(4, 6); sec.quadraticCurveTo(24, 10, 44, 2); sec.lineTo(46, -4); sec.quadraticCurveTo(26, -10, 4, -6); sec.closePath();
      const sg = g.createLinearGradient(0, -8, 0, 9); sg.addColorStop(0, css(cream)); sg.addColorStop(1, css(mix(buff, cream, .3)));
      g.fillStyle = sg; g.fill(sec);
      g.save(); g.clip(sec);
      g.strokeStyle = 'rgba(120,90,60,.35)'; g.lineWidth = .35; for (let y = -6; y < 9; y += 2) { g.beginPath(); g.moveTo(2, y); g.quadraticCurveTo(24, y + 3, 46, y - 4); g.stroke(); }
      g.strokeStyle = 'rgba(90,60,36,.25)'; g.lineWidth = .3; for (let x = 6; x < 46; x += 2.6) { g.beginPath(); g.moveTo(x, -6); g.lineTo(x + 1, 9); g.stroke(); }
      g.restore();
      g.strokeStyle = css(dark, .75); g.lineWidth = 1.4; g.beginPath(); g.moveTo(4, 6.4); g.quadraticCurveTo(24, 10.4, 44, 2.4); g.stroke();
      /* the coverts and the leading edge: the dark patagial bar, then the dark wrist comma */
      const cov = new Path2D(); cov.moveTo(3, -7); cov.quadraticCurveTo(24, -13, 46, -4); cov.quadraticCurveTo(26, -4, 4, -1); cov.closePath();
      g.fillStyle = css(mix(cream, buff, .3)); g.fill(cov);
      g.strokeStyle = css(dark, .9); g.lineWidth = 2.4; g.beginPath(); g.moveTo(5, -7.5); g.quadraticCurveTo(14, -10.5, 22, -10); g.stroke();
      g.fillStyle = css(dark, .9); g.beginPath(); g.ellipse(41, -4.6, 3, 1.6, -.4, 0, TAU); g.fill();
      speckle(g, R, 60, 8, -9, 40, -3, [[150, 110, 70]], .2, .5, .3, .6);
    });
  }
  function hawkBody() {
    const R = mulberry32(502);
    return bake(-12, -22, 12, 30, 6, (g) => {
      const cream = [238, 228, 206], brown = [120, 78, 44], rufous = [196, 92, 48];
      /* the fanned rufous tail with a thin dark band near its tip */
      const tail = new Path2D(); tail.moveTo(-5, 11); tail.lineTo(-9, 27); tail.quadraticCurveTo(0, 30, 9, 27); tail.lineTo(5, 11); tail.closePath();
      const tg = g.createLinearGradient(0, 11, 0, 29); tg.addColorStop(0, css(mix(rufous, cream, .25))); tg.addColorStop(1, css(rufous)); g.fillStyle = tg; g.fill(tail);
      g.strokeStyle = 'rgba(80,30,10,.35)'; g.lineWidth = .3; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(k * .9, 11); g.lineTo(k * 2, 28); g.stroke(); }
      g.strokeStyle = 'rgba(40,20,10,.7)'; g.lineWidth = .8; g.beginPath(); g.moveTo(-8.4, 25); g.quadraticCurveTo(0, 27.5, 8.4, 25); g.stroke();
      /* the body: a pale breast, the streaked belly band, buff legs tucked up */
      const body = new Path2D(); body.ellipse(0, 2, 7.6, 13, 0, 0, TAU);
      const bg = g.createLinearGradient(-8, 0, 8, 0); bg.addColorStop(0, css(mix(cream, brown, .25))); bg.addColorStop(.45, css(cream)); bg.addColorStop(1, css(mix(cream, brown, .35))); g.fillStyle = bg; g.fill(body);
      g.save(); g.clip(body);
      for (let i = 0; i < 40; i++) { const y = 2 + R() * 5, x = (R() - .5) * 15; g.fillStyle = css(brown, .7); g.beginPath(); g.ellipse(x, y, .5, 1.5, (R() - .5) * .4, 0, TAU); g.fill(); }
      g.restore();
      /* the head: brown cap, pale throat, a hooked bill with a yellow cere, a dark eye */
      const hg = g.createRadialGradient(-1, -13, .5, 0, -11, 6.4); hg.addColorStop(0, '#8a5a34'); hg.addColorStop(1, '#4a2e1a'); g.fillStyle = hg; g.beginPath(); g.ellipse(0, -11, 5.6, 6, 0, 0, TAU); g.fill();
      g.fillStyle = css(cream); g.beginPath(); g.ellipse(0, -7.4, 3.2, 2.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8c040'; g.beginPath(); g.ellipse(0, -15, 1.5, 1, 0, 0, TAU); g.fill();
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(-1.1, -15.6); g.quadraticCurveTo(0, -19, 1.1, -15.6); g.closePath(); g.fill();
      for (const ex of [-2.6, 2.6]) { g.fillStyle = '#2a1a0a'; g.beginPath(); g.arc(ex, -12.4, .9, 0, TAU); g.fill(); }
    });
  }
  function drawHawk(ctx, h, t, s = 1) {
    const wing = once('hawkwing', hawkWing), body = once('hawkbody', hawkBody);
    if (!wing || !body) return Sprites.drawHawk(ctx, h, t, s);
    const dive = h.state === 'dive', flap = dive ? 0 : Math.sin(t * 3) * .25;
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(s, s);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1); ctx.translate(3, 0);
      if (dive) { ctx.rotate(.95); ctx.scale(.62, .8); } else { ctx.rotate(-flap * .7); ctx.scale(1, 1 - Math.abs(flap) * .5); }
      put(ctx, wing); ctx.restore();
    }
    put(ctx, body);
    ctx.restore();
  }
  /* the raccoon: grizzled grey fur, the black mask, a ringed bushy tail, dark hands and feet */
  function furPatch(g, R, path, box, n, base, tipLight, len, flow) {
    g.save(); g.clip(path);
    for (let i = 0; i < n; i++) {
      const x = lerp(box[0], box[2], R()), y = lerp(box[1], box[3], R()), [fx, fy] = flow(x, y), L = len * (.6 + R() * .8);
      const r = R(), c = r < .25 ? mix(base, [245, 242, 236], .5 * tipLight) : r > .8 ? mix(base, [10, 10, 10], .6) : mix(base, [0, 0, 0], (R() - .5) * .3);
      g.strokeStyle = css(c, .8); g.lineWidth = .25 + R() * .25; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + fx * L * .5 + (R() - .5) * .6, y + fy * L * .5, x + fx * L, y + fy * L); g.stroke();
    }
    g.restore();
  }
  function raccoonParts() {
    const R = mulberry32(611), grey = [128, 126, 124], dark = [40, 38, 38], pale = [226, 222, 214];
    const body = bake(-30, -40, 30, 2, 6, (g) => {
      const p = new Path2D(); p.moveTo(-21, -22); p.bezierCurveTo(-20, -36, 6, -38, 18, -30); p.bezierCurveTo(24, -26, 22, -14, 14, -11); p.bezierCurveTo(4, -9, -14, -9, -19, -13); p.closePath();
      const bg = g.createLinearGradient(0, -36, 0, -9); bg.addColorStop(0, css(mix(grey, [190, 186, 180], .3))); bg.addColorStop(.6, css(grey)); bg.addColorStop(1, css(mix(grey, dark, .45)));
      g.fillStyle = bg; g.fill(p);
      furPatch(g, R, p, [-24, -38, 24, -8], 1300, grey, 1, 3.2, (x, y) => [-.9, .35 + (y + 22) * .02]);
      const vg = g.createLinearGradient(0, -36, 0, -9); vg.addColorStop(0, 'rgba(255,255,250,.12)'); vg.addColorStop(1, 'rgba(0,0,0,.3)'); g.save(); g.clip(p); g.fillStyle = vg; g.fillRect(-30, -40, 60, 40); g.restore();
    });
    const head = bake(-12, -14, 18, 12, 8, (g) => {
      const p = new Path2D(); p.ellipse(3, 0, 10.5, 8.6, .1, 0, TAU);
      g.fillStyle = css(mix(grey, pale, .2)); g.fill(p);
      furPatch(g, R, p, [-8, -9, 14, 9], 500, mix(grey, pale, .25), 1, 2, () => [-.8, .3]);
      /* the white muzzle and brows, the black mask, the nose, the eye glinting in it */
      g.fillStyle = css(pale); g.beginPath(); g.ellipse(9.5, 3, 6.6, 4, .2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(4, -5.2, 6, 1.6, -.1, 0, TAU); g.fill();
      const mg = g.createLinearGradient(-4, 0, 12, 0); mg.addColorStop(0, 'rgba(20,18,18,.4)'); mg.addColorStop(.25, css(dark)); mg.addColorStop(1, css(dark));
      g.fillStyle = mg; g.beginPath(); g.moveTo(-4, -1); g.quadraticCurveTo(2, -5, 9, -3.4); g.quadraticCurveTo(13, -2.4, 12.5, .2); g.quadraticCurveTo(6, 1.8, 0, 2.4); g.quadraticCurveTo(-3, 1.6, -4, -1); g.fill();
      g.fillStyle = '#0e0c0c'; g.beginPath(); g.ellipse(14.5, 3.2, 2.1, 1.6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(14, 2.6, .5, 0, TAU); g.fill();
      g.fillStyle = '#1a0e08'; g.beginPath(); g.arc(6, -1.8, 1.4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(6.4, -2.3, .45, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,30,30,.6)'; g.lineWidth = .35; g.beginPath(); g.moveTo(14.4, 4.6); g.lineTo(10, 5.2); g.stroke();
      /* the ear, pale-rimmed */
      g.fillStyle = css(mix(grey, dark, .3)); g.beginPath(); g.moveTo(-5, -5); g.lineTo(-2.6, -13); g.lineTo(2.4, -6.5); g.closePath(); g.fill();
      g.strokeStyle = css(pale); g.lineWidth = .8; g.beginPath(); g.moveTo(-4.6, -5.6); g.lineTo(-2.6, -12.4); g.lineTo(1.8, -6.6); g.stroke();
    });
    const tail = bake(-30, -14, 4, 14, 6, (g) => {
      const p = new Path2D(); p.moveTo(2, -4); p.bezierCurveTo(-8, -9, -22, -4, -28, 4); p.quadraticCurveTo(-29, 9, -24, 8); p.bezierCurveTo(-16, 6, -6, 6, 2, 4); p.closePath();
      g.fillStyle = css(grey); g.fill(p);
      g.save(); g.clip(p);
      for (let k = 0; k < 6; k++) { const x = -3 - k * 4.6; g.fillStyle = css(dark, .92); g.beginPath(); g.ellipse(x - 1, 1 + k * .6, 1.9, 9, .5, 0, TAU); g.fill(); }
      g.restore();
      furPatch(g, R, p, [-30, -10, 3, 10], 500, mix(grey, pale, .1), 1, 2.4, () => [-1, .2]);
    });
    return { body, head, tail };
  }
  function drawRaccoon(ctx, r, s = 1) {
    const P = once('raccoon', raccoonParts); if (!P) return Sprites.drawRaccoon(ctx, r, s);
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale((r.state === 'leave' && r.musked ? -r.dir : r.dir) * s, s);
    const step = Math.sin(r.ph || 0) * 3;
    ctx.fillStyle = 'rgba(10,8,4,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 2.4, 0, 0, TAU); ctx.fill();
    /* legs: far pair darker, then the body, the tail, the near pair, the head */
    const leg = (lx, sw, far) => { const x = lx + sw; ctx.strokeStyle = far ? '#2a2826' : '#3e3a38'; ctx.lineCap = 'round'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(x, -2); ctx.stroke(); ctx.fillStyle = far ? '#1a1816' : '#24201e'; ctx.beginPath(); ctx.ellipse(x + 1.4, -.8, 3, 1.4, 0, 0, TAU); ctx.fill(); };
    leg(-14, -step * .3, true); leg(14, step * .3, true);
    ctx.save(); ctx.translate(-20, -22); ctx.rotate(.15 + Math.sin((r.ph || 0) * .5) * .06); put(ctx, P.tail); ctx.restore();
    put(ctx, P.body);
    leg(-10, step * .3, false); leg(17, -step * .3, false);
    const sniff = r.state === 'sniff' ? Math.sin((r.ph || 0) * 2) * 2 : 0;
    ctx.save(); ctx.translate(20, -26 + sniff + (r.state === 'sniff' ? 6 : 0)); put(ctx, P.head); ctx.restore();
    if (r.musked) { ctx.strokeStyle = 'rgba(150,180,60,.7)'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let y = 0; y < 20; y += 2) ctx.lineTo(30 + k * 8 + Math.sin(y * .5 + (r.ph || 0)) * 3, -40 - y); ctx.stroke(); } }
    ctx.restore();
  }
  /* the great blue heron: blue-grey plumage with long back plumes, a white face with a black crest
     stripe, a dagger bill; the neck is painted live along its S-curve */
  function heronParts() {
    const R = mulberry32(711), blue = [112, 126, 146], dark = [52, 58, 70], pale = [210, 214, 220];
    const body = bake(-26, -70, 24, -36, 6, (g) => {
      const p = new Path2D(); p.moveTo(-22, -46); p.bezierCurveTo(-18, -62, 6, -66, 16, -58); p.bezierCurveTo(20, -54, 16, -44, 8, -41); p.bezierCurveTo(-4, -38, -16, -40, -22, -46); p.closePath();
      const bg = g.createLinearGradient(0, -64, 0, -38); bg.addColorStop(0, css(mix(blue, pale, .25))); bg.addColorStop(1, css(mix(blue, dark, .4))); g.fillStyle = bg; g.fill(p);
      g.save(); g.clip(p);
      for (let i = 0; i < 60; i++) { const x = -20 + R() * 34, y = -62 + R() * 22; feather(g, x, y, x - 6 - R() * 5, y + 2 + R() * 2, 1.2, mix(blue, R() < .5 ? pale : dark, R() * .35)); }
      g.restore();
      /* the long plumes trailing over the tail, the dark shoulder patch, the rusty thigh */
      for (let k = 0; k < 9; k++) { g.strokeStyle = css(mix(pale, blue, R() * .5), .8); g.lineWidth = .5; g.beginPath(); g.moveTo(-10 + k, -50); g.quadraticCurveTo(-20 - k * .5, -46, -25 - R() * 2, -40 + R() * 2); g.stroke(); }
      g.fillStyle = css(dark, .85); g.beginPath(); g.ellipse(10, -55, 5, 3, -.3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(150,96,60,.9)'; g.beginPath(); g.ellipse(-1, -40, 3.5, 2, 0, 0, TAU); g.fill();
    });
    const head = bake(-6, -6, 26, 6, 12, (g) => {
      /* the white face, the black stripe to the crest plumes, a yellow eye, the long yellow bill */
      g.fillStyle = css(pale); g.beginPath(); g.ellipse(0, 0, 5, 4.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(1, .6, 4, 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#16181c'; g.beginPath(); g.moveTo(-4.6, -2.4); g.quadraticCurveTo(0, -4.4, 4, -2.4); g.lineTo(3.6, -1.6); g.quadraticCurveTo(0, -3, -4.6, -1.2); g.fill();
      g.strokeStyle = '#16181c'; g.lineWidth = .7; g.beginPath(); g.moveTo(-3.6, -2.2); g.quadraticCurveTo(-8, -3.6, -11, -2); g.stroke(); g.beginPath(); g.moveTo(-3, -1.6); g.quadraticCurveTo(-7, -2, -9.5, -.4); g.stroke();
      const bg = g.createLinearGradient(0, -1.6, 0, 1.6); bg.addColorStop(0, '#e8c050'); bg.addColorStop(1, '#a87a20');
      g.fillStyle = bg; g.beginPath(); g.moveTo(3.6, -1.6); g.lineTo(21, .2); g.lineTo(3.6, 1.6); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,50,10,.6)'; g.lineWidth = .25; g.beginPath(); g.moveTo(4, .1); g.lineTo(20, .2); g.stroke();
      g.fillStyle = '#f0d040'; g.beginPath(); g.arc(1.8, -.8, 1.1, 0, TAU); g.fill(); g.fillStyle = '#100a04'; g.beginPath(); g.arc(2, -.8, .55, 0, TAU); g.fill();
    });
    const wing = bake(-14, -46, 30, 6, 5, (g) => {
      /* flight feathers fanned along the trailing edge, the dark primaries at the tip, grey coverts over them */
      for (let k = 0; k < 14; k++) { const t = k / 13, bx = lerp(4, 10, t), by = lerp(0, -30, t), a = -Math.PI / 2 + lerp(.9, .1, t), L = lerp(16, 20, t); feather(g, bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, 2.6, t > .62 ? mix(dark, [20, 22, 28], .3) : mix(blue, pale, R() * .25), dark); }
      const cov = new Path2D(); cov.moveTo(-2, 4); cov.quadraticCurveTo(-6, -18, 6, -34); cov.quadraticCurveTo(14, -16, 12, 2); cov.closePath();
      const cg = g.createLinearGradient(-6, 0, 14, 0); cg.addColorStop(0, css(mix(blue, pale, .3))); cg.addColorStop(1, css(mix(blue, dark, .3))); g.fillStyle = cg; g.fill(cov);
      g.save(); g.clip(cov); for (let i = 0; i < 40; i++) { const x = -4 + R() * 16, y = -30 + R() * 32; feather(g, x, y, x + 3, y + 5, .9, mix(blue, R() < .5 ? pale : dark, .3)); } g.restore();
    });
    return { body, head, wing };
  }
  function drawHeron(ctx, h, t, s = 1) {
    const P = once('heron', heronParts); if (!P) return Sprites.drawHeron(ctx, h, t, s);
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale((h.face || 1) * s, s);
    const strike = h.state === 'strike' ? Math.sin(clamp(h.t / .45, 0, 1) * Math.PI) : 0, fly = h.state === 'fly' || h.state === 'leave';
    ctx.lineCap = 'round';
    if (!fly) {
      for (const [x0, x1, col] of [[-3, -4, '#5a5a4a'], [3, 4, '#76705a']]) { ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0, -40); ctx.lineTo(x0 + .5, -20); ctx.lineTo(x1, 0); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1 + 5, .3); ctx.moveTo(x1, 0); ctx.lineTo(x1 - 3, .4); ctx.stroke(); }
    } else { ctx.strokeStyle = '#5a5a4a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-14, -48); ctx.lineTo(-38, -44); ctx.stroke(); }
    if (fly) { const f = Math.sin(t * 6); ctx.save(); ctx.translate(-4, -56); ctx.rotate(-.3 + f * .5); ctx.scale(1, .7 + .3 * Math.abs(f)); put(ctx, P.wing); ctx.restore(); }
    put(ctx, P.body);
    /* the long neck: an S, straightening out for the strike (into the water, never at you) */
    const nx = 12 + strike * 34, ny = -78 + strike * 52;
    const cx = 22 - strike * 4, cy = -70 + strike * 10;
    const neck = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(10, -58); ctx.quadraticCurveTo(cx, cy, nx, ny); ctx.stroke(); };
    neck(6, '#5e6a7c'); neck(4.6, '#8a98aa'); neck(2, '#c8ced6');
    ctx.strokeStyle = 'rgba(40,44,56,.7)'; ctx.lineWidth = .6; ctx.setLineDash([1.4, 1.6]); ctx.beginPath(); ctx.moveTo(12, -58); ctx.quadraticCurveTo(cx + 1.5, cy, nx + 1.5, ny + 1); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(strike * .7); put(ctx, P.head); ctx.restore();
    if (fly) { const f = Math.sin(t * 6); ctx.save(); ctx.translate(2, -56); ctx.rotate(-.5 + f * .6); ctx.scale(1, .7 + .3 * Math.abs(f)); put(ctx, P.wing); ctx.restore(); }
    ctx.restore();
  }
  /* the snake scientist: a field shirt and trousers, boots, a brimmed sun hat, a real painted face */
  function sciParts() {
    const R = mulberry32(811), shirt = [104, 134, 88], shirtD = [60, 84, 50], skin = [214, 168, 132], hair = [70, 46, 30], hat = [196, 176, 120];
    const torso = bake(-12, -34, 12, 4, 8, (g) => {
      const p = new Path2D(); p.moveTo(-8, -30); p.quadraticCurveTo(0, -33, 8, -30); p.quadraticCurveTo(10, -14, 9, 2); p.quadraticCurveTo(0, 3.5, -9, 2); p.quadraticCurveTo(-10, -14, -8, -30); p.closePath();
      const sg = g.createLinearGradient(-9, 0, 9, 0); sg.addColorStop(0, css(mix(shirt, [255, 250, 230], .12))); sg.addColorStop(.6, css(shirt)); sg.addColorStop(1, css(shirtD)); g.fillStyle = sg; g.fill(p);
      g.save(); g.clip(p);
      for (let i = 0; i < 80; i++) { const x = -9 + R() * 18, y = -30 + R() * 32; g.strokeStyle = css(mix(shirt, R() < .5 ? shirtD : [230, 240, 210], .3), .3); g.lineWidth = .3 + R() * .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 2, y + 2 + R() * 3); g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(40,56,30,.6)'; g.lineWidth = .4; g.beginPath(); g.moveTo(0, -31); g.lineTo(0, 1); g.stroke();
      for (const px of [-6.5, 2.5]) { g.fillStyle = 'rgba(60,84,50,.6)'; g.fillRect(px, -24, 4, 4.4); g.strokeStyle = 'rgba(40,56,30,.6)'; g.lineWidth = .3; g.strokeRect(px, -24, 4, 4.4); }
      g.fillStyle = '#e8e0c8'; g.fillRect(3.2, -27, .6, 3);                    /* a pen in the pocket */
      g.fillStyle = 'rgba(70,50,30,.9)'; g.fillRect(-9, -1, 18, 2.4);           /* a belt */
    });
    const head = bake(-11, -15, 11, 9, 14, (g) => {
      /* hair behind, a neck, the face with soft shading, eyes with whites and irises, brows, a nose, a small closed smile */
      g.fillStyle = css(hair); g.beginPath(); g.ellipse(-1.2, 0, 7.8, 8.2, 0, 0, TAU); g.fill();
      g.fillStyle = css(mix(skin, [150, 100, 80], .25)); g.fillRect(-2.4, 6, 4.8, 3);
      const face = new Path2D(); face.ellipse(.4, .6, 6.4, 7.6, 0, 0, TAU);
      const fg = g.createRadialGradient(-1, -1.4, 1, .4, .6, 8.4); fg.addColorStop(0, css(mix(skin, [255, 232, 214], .3))); fg.addColorStop(.7, css(skin)); fg.addColorStop(1, css(mix(skin, [130, 80, 60], .35))); g.fillStyle = fg; g.fill(face);
      g.fillStyle = 'rgba(214,110,100,.18)'; g.beginPath(); g.ellipse(-2.6, 3.4, 1.8, 1.1, 0, 0, TAU); g.ellipse(3.8, 3.4, 1.8, 1.1, 0, 0, TAU); g.fill();
      for (const ex of [-2.2, 3]) {
        g.fillStyle = '#f6f2ec'; g.beginPath(); g.ellipse(ex, -.2, 1.35, .8, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a6a3a'; g.beginPath(); g.arc(ex + .25, -.2, .65, 0, TAU); g.fill(); g.fillStyle = '#100a06'; g.beginPath(); g.arc(ex + .25, -.2, .32, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(ex + .05, -.45, .16, 0, TAU); g.fill();
        g.strokeStyle = css(mix(hair, [0, 0, 0], .2)); g.lineWidth = .5; g.beginPath(); g.moveTo(ex - 1.4, -1.9); g.quadraticCurveTo(ex, -2.6, ex + 1.4, -2); g.stroke();
      }
      g.strokeStyle = 'rgba(140,90,70,.6)'; g.lineWidth = .4; g.beginPath(); g.moveTo(.9, .2); g.quadraticCurveTo(1.8, 2.4, .5, 2.7); g.stroke();
      g.strokeStyle = 'rgba(150,70,60,.85)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-1.2, 4.6); g.quadraticCurveTo(.6, 5.4, 2.4, 4.6); g.stroke();
      /* the sun hat: a crown with a band, a wide brim catching the light */
      g.fillStyle = css(mul(hat, .8)); g.beginPath(); g.ellipse(.2, -4.6, 10.4, 2.2, 0, 0, TAU); g.fill();
      const hg = g.createLinearGradient(0, -12, 0, -4); hg.addColorStop(0, css(mix(hat, [255, 250, 230], .2))); hg.addColorStop(1, css(mul(hat, .85)));
      g.fillStyle = hg; g.beginPath(); g.moveTo(-6, -5); g.quadraticCurveTo(-6, -12.6, .2, -12.8); g.quadraticCurveTo(6.4, -12.6, 6.4, -5); g.closePath(); g.fill();
      g.fillStyle = '#5a4a30'; g.fillRect(-6, -6.8, 12.4, 1.6);
      g.strokeStyle = 'rgba(120,100,60,.4)'; g.lineWidth = .25; for (let x = -9; x <= 9; x += 1.2) { g.beginPath(); g.moveTo(x, -5.2); g.lineTo(x * 1.08, -3.6); g.stroke(); }
    });
    return { torso, head };
  }
  function drawScientist(ctx, s, t, sc = 1) {
    const P = once('scientist', sciParts); if (!P) return Sprites.drawScientist(ctx, s, t, sc);
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale((s.face || 1) * sc, sc);
    const step = Math.sin(s.ph || 0) * 4, kneel = s.state === 'lift' || s.state === 'lay' || s.state === 'putback' || s.measuring;
    ctx.fillStyle = 'rgba(10,8,4,.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 2, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (pts, w, col, hi) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = w * .3; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x - w * .2, y) : ctx.moveTo(x - w * .2, y)); ctx.stroke(); } };
    const boot = (x, y) => { ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.moveTo(x - 4, y - 3.4); ctx.lineTo(x + 3, y - 3.4); ctx.quadraticCurveTo(x + 6, y - 2, x + 5.6, y); ctx.lineTo(x - 4.4, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1a120c'; ctx.fillRect(x - 4.4, y - .8, 10, .8); };
    if (kneel) { limb([[-3, -30], [-10, -12], [-22, -2]], 6, '#4a5a6e', 'rgba(255,255,255,.12)'); limb([[3, -30], [10, -14], [10, -2]], 6, '#56667a', 'rgba(255,255,255,.12)'); boot(-24, 0); boot(11, 0); }
    else { limb([[-3, -38], [-3 - step * .6, -18], [-3 - step, -3]], 6, '#4a5a6e', 'rgba(255,255,255,.12)'); limb([[3, -38], [3 + step * .6, -18], [3 + step, -3]], 6, '#56667a', 'rgba(255,255,255,.12)'); boot(-3 - step, 0); boot(3 + step, 0); }
    const by = kneel ? -26 : -38;
    ctx.save(); ctx.translate(0, by); put(ctx, P.torso); ctx.restore();
    ctx.save(); ctx.translate(0, by - 38); put(ctx, P.head); ctx.restore();
    /* arms (shirt sleeves, hands): holding the clipboard, the measuring tape, or the coverboard */
    const arm = (pts) => { limb(pts, 4.2, '#68865a', 'rgba(255,255,240,.15)'); const [x, y] = pts[pts.length - 1]; ctx.fillStyle = '#d6a884'; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, TAU); ctx.fill(); };
    if (s.measuring) {
      arm([[-6, by - 24], [-12, by - 15], [-16, by - 8]]); arm([[6, by - 24], [14, by - 15], [22, by - 8]]);
      const tg = ctx.createLinearGradient(0, by - 10, 0, by - 6); tg.addColorStop(0, '#f8e060'); tg.addColorStop(1, '#d0a820'); ctx.fillStyle = tg; ctx.fillRect(-18, by - 10, 42, 4);
      ctx.fillStyle = '#222'; for (let k = 0; k < 21; k++) ctx.fillRect(-17 + k * 2, by - 10, .3, k % 5 ? 1.2 : 2.2);
      ctx.fillStyle = '#c03a2a'; rr(ctx, 22, by - 12, 6, 7, 1.5); ctx.fill();
    } else if (s.holding) {
      arm([[6, by - 24], [12, by - 28], [18, by - 30]]);
      ctx.save(); ctx.translate(26, by - 30); ctx.rotate(-1.2); const bg = ctx.createLinearGradient(0, -3, 0, 3); bg.addColorStop(0, '#d0aa72'); bg.addColorStop(1, '#8a6a3c'); ctx.fillStyle = bg; ctx.fillRect(-30, -3, 60, 6); ctx.fillStyle = 'rgba(246,242,226,.9)'; ctx.font = `900 5px ${typeof UI_FONT !== 'undefined' ? UI_FONT : 'sans-serif'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CB 7', 0, .3); ctx.restore();
    } else {
      arm([[6, by - 24], [9, by - 18], [12, by - 13]]);
      ctx.fillStyle = '#8a6a3a'; rr(ctx, 9.6, by - 25, 11, 14, 1); ctx.fill(); ctx.fillStyle = '#f2ecd8'; ctx.fillRect(10.6, by - 23, 9, 11.4);
      ctx.strokeStyle = 'rgba(80,80,90,.5)'; ctx.lineWidth = .3; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(11.6, by - 21 + k * 2); ctx.lineTo(18.6, by - 21 + k * 2); ctx.stroke(); }
      ctx.fillStyle = '#9a9aa2'; ctx.fillRect(13, by - 26, 4, 2.4);
    }
    if (!s.measuring && !s.holding) arm([[-6, by - 24], [-8 + step * .3, by - 14], [-8 + step * .4, by - 6]]);
    ctx.restore();
  }

  /* butterflies by species (keyed off the game's colours): monarch, cabbage white, clouded sulphur, spring azure;
     one wing pair painted, drawn mirrored and folding with the flap */
  const BUTTERFLY = { '#f0a020': 'monarch', '#ffffff': 'white', '#f2d043': 'sulphur', '#7ab0f0': 'azure' };
  function wingBake(sp) {
    const R = mulberry32(1100 + sp.length);
    return bake(0, -7, 8, 4, 16, (g) => {
      const fore = new Path2D(); fore.moveTo(.2, -.6); fore.bezierCurveTo(1.5, -5.6, 5.8, -6.6, 7.2, -5); fore.bezierCurveTo(7.4, -3.2, 5, -1.2, .4, -.1); fore.closePath();
      const hind = new Path2D(); hind.moveTo(.3, -.2); hind.bezierCurveTo(4.2, -.8, 5.6, 1.4, 4.6, 3); hind.bezierCurveTo(3.2, 3.8, 1, 2.4, .2, .3); hind.closePath();
      const base = sp === 'monarch' ? [232, 120, 24] : sp === 'white' ? [246, 244, 236] : sp === 'sulphur' ? [240, 214, 70] : [136, 172, 232];
      for (const p of [hind, fore]) {
        const wg = g.createRadialGradient(0, 0, .2, 0, 0, 7); wg.addColorStop(0, css(mul(base, sp === 'azure' ? .7 : .9))); wg.addColorStop(1, css(mix(base, [255, 255, 255], .15)));
        g.fillStyle = wg; g.fill(p);
        g.save(); g.clip(p);
        if (sp === 'monarch') { g.strokeStyle = '#1a1006'; g.lineWidth = .28; for (let k = 0; k < 6; k++) { const a = -1.4 + k * .3; g.beginPath(); g.moveTo(.3, -.3); g.quadraticCurveTo(Math.cos(a) * 3.5, Math.sin(a) * 3.5, Math.cos(a) * 8, Math.sin(a) * 8); g.stroke(); } g.lineWidth = .9; g.stroke(p); g.fillStyle = '#fff'; for (let k = 0; k < 10; k++) { const a = -1.3 + k * .28; g.beginPath(); g.arc(Math.cos(a) * 6.1, Math.sin(a) * 5.6, .16, 0, TAU); g.fill(); } }
        else if (sp === 'white') { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(6.6, -5.4, 1.3, 0, TAU); g.fill(); if (p === fore) { g.beginPath(); g.arc(4.2, -3.4, .45, 0, TAU); g.fill(); } }
        else if (sp === 'sulphur') { g.strokeStyle = '#3a2a10'; g.lineWidth = .6; g.stroke(p); g.fillStyle = '#e88a30'; g.beginPath(); g.arc(3, 1.4, .35, 0, TAU); g.fill(); }
        else { g.strokeStyle = 'rgba(40,50,90,.6)'; g.lineWidth = .3; g.stroke(p); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, -7, 8, .4); }
        g.restore();
      }
    });
  }
  function drawButterfly(ctx, c, t) {
    const sp = BUTTERFLY[c.col] || 'white', img = once('wing|' + sp, () => wingBake(sp));
    if (!img) return Sprites.drawButterfly(ctx, c, t);
    const f = Math.abs(Math.sin(t * 14 + c.ph));
    ctx.save(); ctx.translate(c.x, c.y);
    for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd * (.15 + .85 * f), 1); put(ctx, img); ctx.restore(); }
    ctx.fillStyle = '#1e1810'; ctx.beginPath(); ctx.ellipse(0, -1, .55, 2.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1e1810'; ctx.lineWidth = .2; ctx.beginPath(); ctx.moveTo(-.2, -3.6); ctx.lineTo(-1, -5.6); ctx.moveTo(.2, -3.6); ctx.lineTo(1, -5.6); ctx.stroke();
    ctx.restore();
  }
  /* a dragonfly (a common green darner): a green thorax, a long blue abdomen with rings, clear veined wings that catch the light */
  function dragonBake() {
    return bake(-11, -6, 8, 6, 14, (g) => {
      for (const sd of [-1, 1]) for (const wx of [-.4, 1.8]) {
        const w = new Path2D(); w.ellipse(wx, sd * 2.8, 1.2, 3.2, sd * .25, 0, TAU);
        g.fillStyle = 'rgba(226,240,255,.45)'; g.fill(w); g.strokeStyle = 'rgba(80,100,120,.55)'; g.lineWidth = .1; g.stroke(w);
        g.save(); g.clip(w); g.strokeStyle = 'rgba(80,100,120,.3)'; for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(wx - 2, sd * 2.8 + k * .5); g.lineTo(wx + 2, sd * 2.8 + k * .5 + .3); g.stroke(); } g.restore();
        g.fillStyle = 'rgba(60,40,20,.6)'; g.beginPath(); g.ellipse(wx + sd * 0, sd * 5.6, .25, .35, 0, 0, TAU); g.fill();
      }
      const ab = g.createLinearGradient(0, -.6, 0, .6); ab.addColorStop(0, '#4a90d0'); ab.addColorStop(1, '#1a4a80'); g.fillStyle = ab; g.beginPath(); g.moveTo(-.3, -.5); g.lineTo(-10, -.25); g.lineTo(-10.4, .2); g.lineTo(-.3, .5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(10,20,40,.7)'; g.lineWidth = .12; for (let k = 1; k < 9; k++) { g.beginPath(); g.moveTo(-k * 1.15, -.45); g.lineTo(-k * 1.15, .45); g.stroke(); }
      const th = g.createRadialGradient(1, -.4, .1, 1, 0, 1.6); th.addColorStop(0, '#8ad050'); th.addColorStop(1, '#3a7a20'); g.fillStyle = th; g.beginPath(); g.ellipse(1, 0, 1.6, 1, 0, 0, TAU); g.fill();
      g.fillStyle = '#5a9a3a'; g.beginPath(); g.arc(3, 0, 1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(3.3, -.4, .3, 0, TAU); g.fill();
    });
  }
  function drawDragonfly(ctx, c, t) {
    const img = once('dragonfly', dragonBake); if (!img) return Sprites.drawDragonfly(ctx, c, t);
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 1 + Math.sin(t * 40) * .06); put(ctx, img); ctx.restore();
  }

  /* ============================================================
     THE POND: deep water with light bands and glints (ice in winter stays classic)
     ============================================================ */
  function drawPondWater(ctx, xs, L, waterY, time, night, season) {
    ctx.beginPath(); ctx.moveTo(xs[0], waterY); for (const x of xs) ctx.lineTo(x, waterY); for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], L.surfaceAt(xs[i]) + 1); ctx.closePath();
    const g = ctx.createLinearGradient(0, waterY, 0, waterY + 120);
    g.addColorStop(0, 'rgba(96,140,150,.62)'); g.addColorStop(.25, 'rgba(46,92,96,.74)'); g.addColorStop(1, 'rgba(14,40,38,.92)');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    /* sun-dappled light bands under the surface, a little murk of floating bits */
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const x = xs[0] + ((k * 131 + time * 5) % (xs[xs.length - 1] - xs[0])), wd = 14 + (k % 3) * 10;
      const lg = ctx.createLinearGradient(x, waterY, x - 30, waterY + 90); lg.addColorStop(0, `rgba(150,200,190,${.07 * (1 - night)})`); lg.addColorStop(1, 'rgba(150,200,190,0)');
      ctx.fillStyle = lg;
      ctx.save(); ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(x - wd * .2, waterY); ctx.lineTo(x + wd * .8, waterY); ctx.lineTo(x - 26 + wd * .4, waterY + 90); ctx.lineTo(x - 40, waterY + 90); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    /* the surface: a bright meniscus line and tapered glints that drift */
    ctx.strokeStyle = `rgba(220,240,245,${.7 - night * .35})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); xs.forEach((x, i) => { const y = waterY + Math.sin(x * .06 + time * 2) * .7; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    for (let k = 0; k < 16; k++) { const x = xs[0] + ((k * 53.7 + time * (8 + k % 3 * 3)) % (xs[xs.length - 1] - xs[0])), a = (.35 + .35 * Math.sin(time * 2 + k)) * (1 - night * .6); ctx.strokeStyle = `rgba(255,255,250,${a})`; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x - 5, waterY + 1.5); ctx.lineTo(x + 5, waterY + 1.5); ctx.stroke(); }
  }


  function cached() { return { pictures: cache.size, bakes: stat.n, bakeMs: Math.round(stat.ms) }; }
  return Object.assign({}, Sprites, { drawSnake, drawSac, drawExuvia, drawCover, drawTree, drawFrog, drawHopper, drawWorm, drawButterfly, drawDragonfly, drawHawk, drawRaccoon, drawHeron, drawScientist,
    drawGrass, drawFlower, drawReed, drawPondWater, soilPattern, rockPattern, beginFrame, cached, bodyWidth });
})();
