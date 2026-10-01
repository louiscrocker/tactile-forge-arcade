/* ============================================================
   sprites.js — everything in the game, drawn by hand
   ============================================================
   Every creature is drawn in its own local frame: origin at the
   body centre, head pointing +x, seen from above.  Callers
   translate / rotate / scale first.  Sizes are in world units at
   scale 1 (roughly pixels at zoom 1).
   ============================================================ */
'use strict';

const Sprites = (function () {

  /* ---------- shared bits ---------- */
  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  }
  function leg(ctx, hx, hy, side, len, swing, lift, col, thick) {
    const dx = swing * len * .45;
    const kx = hx + dx * .55, ky = hy + side * len * .55;
    const fx = hx + dx, fy = hy + side * len * (1.0 - lift * .25);
    ctx.strokeStyle = col; ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  }
  function antenna(ctx, x, y, side, len, col, thick, wave, club) {
    ctx.strokeStyle = col; ctx.lineWidth = thick; ctx.lineCap = 'round';
    const ex = x + len, ey = y + side * len * .55 + wave * len * .2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * .6, y + side * len * .25 + wave * len * .1, ex, ey);
    ctx.stroke();
    if (club) { ctx.fillStyle = col; ellipse(ctx, ex, ey, thick * 1.4, thick * 1.1); ctx.fill(); }
  }

  /* ============================================================
     MONARCH CATERPILLAR — yellow, black and white bands
     ============================================================
     o: { s, instar 1..5, walk, chew, pale, curl (radians of hook
     toward the head, for the J), alpha }
     ============================================================ */
  function drawCaterpillar(ctx, o) {
    const s = o.s || 1, instar = o.instar || 1;
    const walk = o.walk || 0, chew = o.chew || 0, pale = o.pale || 0, curl = o.curl || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    const nSeg = 13;                     // head + 3 thorax + 9 abdomen
    const L = 70;
    const band = instar === 1 ? .25 : instar === 2 ? .7 : 1;      // how bold the stripes are
    const yellow = mixHex(mixHex('#d8dcb8', '#f2d43a', band), '#f0eee0', pale);
    const black = mixHex(mixHex('#8a8f7a', '#161410', band), '#d8d8cc', pale);
    const white = mixHex(mixHex('#e8ead8', '#f7f6ee', band), '#f4f4ee', pale);
    const edge = mixHex('#141210', '#b8b8b0', pale);

    /* centreline, built from the tail so a curl hooks the head */
    const pts = [];
    let px = -L / 2, py = 0, heading = 0;
    const step = L / (nSeg - 1);
    for (let i = nSeg - 1; i >= 0; i--) {
      const v = 1 - i / (nSeg - 1);                       // 0 at tail → 1 at head
      const wig = Math.sin(walk * 2 - i * .55) * (i > 3 ? (i - 3) * .22 : 0) * (curl ? 0 : 1);
      pts[i] = { x: px, y: py + wig, a: heading };
      heading += curl * (smoothstep(.3, 1, v + 1 / nSeg) - smoothstep(.3, 1, v));
      px += Math.cos(heading) * step; py += Math.sin(heading) * step;
    }
    const widthAt = (i) => {
      if (i === 0) return 5.2;
      if (i < 4) return 6.4 + i * .5;
      return lerp(8.4, 3.2, Math.pow((i - 4) / 8, 1.2));
    };

    /* legs: 3 true pairs on the thorax, prolegs on abdomen 3-6 and the tail */
    const legCol = edge;
    const legs = [[1, 8], [2, 8.5], [3, 9], [6, 6], [7, 6], [8, 6], [9, 6], [12, 5]];
    for (const [i, len] of legs) {
      const p = pts[i], w = widthAt(i);
      const ph = walk + i * (TAU / 3);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      const stubby = i >= 6;
      leg(ctx, 0, w * .5, 1, len * (stubby ? .6 : 1), stubby ? Math.sin(ph) * .4 : Math.sin(ph), Math.max(0, Math.cos(ph)), legCol, stubby ? 2.2 : 1.4);
      leg(ctx, 0, -w * .5, -1, len * (stubby ? .6 : 1), stubby ? Math.sin(ph + Math.PI) * .4 : Math.sin(ph + Math.PI), Math.max(0, Math.cos(ph + Math.PI)), legCol, stubby ? 2.2 : 1.4);
      ctx.restore();
    }

    /* tentacles (filaments): a long pair on thorax 2, a short pair on abdomen 8 */
    const tl = [0, 3, 6, 10, 14, 18][instar] || 14;
    const tentacle = (i, len, wave) => {
      const p = pts[i];
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.strokeStyle = black; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, side * 3);
        ctx.quadraticCurveTo(len * .4, side * (4 + len * .5) + wave * 2, len * .55 + wave, side * (4 + len) );
        ctx.stroke();
      }
      ctx.restore();
    };
    tentacle(2, tl, Math.sin(walk * .9) * 2);
    tentacle(11, tl * .45, Math.cos(walk * .8) * 1.5);

    /* body segments, tail first so the head overlaps */
    for (let i = nSeg - 1; i >= 1; i--) {
      const p = pts[i], w = widthAt(i), len = step * 1.12;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      /* base yellow capsule */
      rr(ctx, -len / 2, -w, len, w * 2, w * .9);
      ctx.fillStyle = yellow; ctx.fill();
      /* black band at the front of the segment and white band behind it */
      ctx.save();
      ctx.clip();
      ctx.fillStyle = black;
      ctx.fillRect(len * .18, -w - 1, len * .2, w * 2 + 2);
      ctx.fillRect(-len * .5, -w - 1, len * .16, w * 2 + 2);
      ctx.fillStyle = white;
      ctx.fillRect(-len * .34, -w - 1, len * .2, w * 2 + 2);
      /* belly shading */
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(-len, w * .5, len * 2, w);
      ctx.restore();
      ctx.strokeStyle = withAlpha('#141210', .55 * (1 - pale * .6)); ctx.lineWidth = .9;
      rr(ctx, -len / 2, -w, len, w * 2, w * .9); ctx.stroke();
      ctx.restore();
    }
    /* head: black with yellow/white stripes */
    const hd = pts[0];
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(hd.a);
    ellipse(ctx, 0, 0, 5.2, widthAt(0)); ctx.fillStyle = black; ctx.fill();
    ctx.strokeStyle = yellow; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-1, -4); ctx.quadraticCurveTo(3, 0, -1, 4); ctx.stroke();
    ctx.strokeStyle = white; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-3, -3.6); ctx.quadraticCurveTo(0, 0, -3, 3.6); ctx.stroke();
    /* mandibles */
    const openA = .3 + chew * .9;
    ctx.strokeStyle = mixHex('#2a2620', '#a0a09a', pale); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(4, side * 1.8);
      ctx.quadraticCurveTo(7.5, side * (1.8 + openA * 2.4), 8, side * openA * 1.2); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     CHRYSALIS — jade with a crown of gold
     ============================================================
     Attachment (cremaster) at the origin, body hangs to +y.
     o: { s, prog 0..1, clear 0..1 (going transparent), twitch,
          variant, split 0..1 (eclosion crack) }
     ============================================================ */
  function drawChrysalis(ctx, o) {
    const s = o.s || 1, prog = o.prog || 0, clear = o.clear || 0, twitch = o.twitch || 0, split = o.split || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    /* silk button and cremaster stalk */
    ctx.fillStyle = '#f2ead0';
    ellipse(ctx, 0, 0, 4, 2.2); ctx.fill();
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
    ctx.rotate(twitch * .12);
    ctx.translate(0, 5);
    /* body outline */
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(9, 1, 12, 8, 11.5, 16);
      ctx.bezierCurveTo(11, 26, 11, 36, 8, 43);
      ctx.bezierCurveTo(5, 50, -5, 50, -8, 43);
      ctx.bezierCurveTo(-11, 36, -11, 26, -11.5, 16);
      ctx.bezierCurveTo(-12, 8, -9, 1, 0, 0);
      ctx.closePath();
    };
    /* the butterfly inside, seen through the shell as it clears */
    if (clear > 0) {
      ctx.save(); body(); ctx.clip();
      const v = o.variant || VARIANTS.male;
      ctx.fillStyle = v.orange;
      ctx.fillRect(-12, 0, 24, 52);
      ctx.strokeStyle = v.vein; ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-3, 6 + i * 2); ctx.quadraticCurveTo(-9, 18 + i * 5, -6 - i, 40); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, 6 + i * 2); ctx.quadraticCurveTo(9, 18 + i * 5, 6 + i, 40); ctx.stroke();
      }
      ctx.fillStyle = v.vein; ctx.fillRect(-3, 4, 6, 40);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) { ellipse(ctx, -9.5 + (i % 2), 8 + i * 6, 1, 1); ctx.fill(); ellipse(ctx, 9.5 - (i % 2), 8 + i * 6, 1, 1); ctx.fill(); }
      ctx.restore();
    }
    /* jade shell */
    body();
    const g = ctx.createLinearGradient(-12, 0, 12, 0);
    const jade = mixHex('#8fd1a0', '#6fb987', prog * .5), jadeD = mixHex('#5aa374', '#3f8a5c', prog * .5);
    g.addColorStop(0, withAlpha('#4f9468', 1 - clear * .85));
    g.addColorStop(.35, rgbStr(hexToRgb('#8fd1a0').map((c, i) => lerp(c, hexToRgb('#6fb987')[i], prog * .5)), 1 - clear * .9));
    g.addColorStop(.7, rgbStr(hexToRgb('#7cc490'), 1 - clear * .9));
    g.addColorStop(1, withAlpha('#3f8a5c', 1 - clear * .85));
    ctx.fillStyle = g; ctx.fill();
    void jade; void jadeD;
    ctx.strokeStyle = withAlpha('#1f4a30', .7); ctx.lineWidth = 1.2; ctx.stroke();
    /* the abdomen ridges near the top */
    ctx.strokeStyle = withAlpha('#2f6a45', .35 * (1 - clear));
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9 + i * .5, 4 + i * 3); ctx.quadraticCurveTo(0, 6 + i * 3, 9 - i * .5, 4 + i * 3); ctx.stroke(); }
    /* gold crown: a dark line with gold beads, about a fifth of the way down */
    ctx.strokeStyle = withAlpha('#1a1410', .8 * (1 - clear * .5)); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-11.3, 15); ctx.quadraticCurveTo(0, 17.5, 11.3, 15); ctx.stroke();
    const gold = (x, y, r) => {
      const gg = ctx.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
      gg.addColorStop(0, '#fff3b0'); gg.addColorStop(.5, '#f2c22e'); gg.addColorStop(1, '#b8860b');
      ctx.fillStyle = gg; ellipse(ctx, x, y, r, r); ctx.fill();
    };
    for (let i = 0; i < 9; i++) { const u = i / 8; gold(lerp(-10.5, 10.5, u), 15 + Math.sin(u * Math.PI) * 2.2 - .6, 1.15); }
    /* scattered gold dots lower down */
    gold(-6, 27, 1.1); gold(6, 27, 1.1); gold(0, 34, 1.0); gold(-4, 41, .9); gold(4, 41, .9); gold(-9, 8, .8); gold(9, 8, .8);
    /* highlight */
    ctx.fillStyle = withAlpha('#ffffff', .22 * (1 - clear));
    ellipse(ctx, -5, 20, 2.6, 12, -.1); ctx.fill();
    /* eclosion crack */
    if (split > 0) {
      ctx.strokeStyle = withAlpha('#1a1410', .8); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-2, 14 * split); ctx.lineTo(1, 26 * split); ctx.stroke();
    }
    ctx.restore();
  }

  /* ============================================================
     MONARCH BUTTERFLY
     ============================================================
     Head at +x.  open 0 = wings folded (side profile), 1 = spread
     (top view).  flap 0..1 scales the spread wings across the body
     axis, faking a wing-beat.  crumple 1 = freshly emerged.
     o: { s, variant, open, flap, crumple, walk, alpha, tag }
     ============================================================ */
  function wingPath(ctx, side, fore) {
    ctx.beginPath();
    if (fore) {
      ctx.moveTo(3, side * 3);
      ctx.bezierCurveTo(12, side * 8, 26, side * 22, 30, side * 40);
      ctx.bezierCurveTo(24, side * 42, 12, side * 40, 2, side * 36);
      ctx.bezierCurveTo(-4, side * 30, -6, side * 16, -4, side * 6);
    } else {
      ctx.moveTo(-3, side * 5);
      ctx.bezierCurveTo(-2, side * 14, 0, side * 24, -8, side * 32);
      ctx.bezierCurveTo(-18, side * 36, -30, side * 30, -30, side * 20);
      ctx.bezierCurveTo(-30, side * 12, -22, side * 6, -12, side * 4);
    }
    ctx.closePath();
  }
  function wingArt(ctx, side, fore, v, fresh) {
    const orange = fresh ? mixHex(v.orange, '#ffd9a0', fresh * .35) : v.orange;
    wingPath(ctx, side, fore);
    const g = ctx.createLinearGradient(0, 0, fore ? 30 : -30, side * 36);
    g.addColorStop(0, v.deep); g.addColorStop(.35, orange); g.addColorStop(1, orange);
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    wingPath(ctx, side, fore); ctx.clip();
    /* veins from the base */
    ctx.strokeStyle = v.vein; ctx.lineWidth = v.veinW; ctx.lineCap = 'round';
    if (fore) {
      const tips = [[30, 40], [24, 42], [14, 41], [4, 37], [-3, 30], [16, 28]];
      for (const [tx, ty] of tips) { ctx.beginPath(); ctx.moveTo(2, side * 4); ctx.quadraticCurveTo(tx * .4, side * ty * .55, tx, side * ty); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(10, side * 16); ctx.quadraticCurveTo(16, side * 26, 22, side * 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, side * 22); ctx.lineTo(14, side * 34); ctx.stroke();
    } else {
      const tips = [[-6, 33], [-14, 37], [-22, 35], [-29, 27], [-30, 16], [-24, 8]];
      for (const [tx, ty] of tips) { ctx.beginPath(); ctx.moveTo(-6, side * 6); ctx.quadraticCurveTo(tx * .45, side * ty * .55, tx, side * ty); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-12, side * 18); ctx.quadraticCurveTo(-18, side * 26, -24, side * 26); ctx.stroke();
      if (v.pouch) { ctx.fillStyle = v.vein; ellipse(ctx, -15, side * 21, 2.2, 1.6, .5); ctx.fill(); }
    }
    /* black margin with two rows of white dots */
    ctx.lineWidth = 5; ctx.strokeStyle = v.vein;
    wingPath(ctx, side, fore); ctx.stroke();
    ctx.fillStyle = '#fff';
    if (fore) {
      const dots = [[29, 38], [26, 41], [20, 42], [14, 41], [8, 39], [3, 36], [-2, 32], [-4, 24], [-4, 14], [22, 33], [26, 29], [18, 22], [14, 27]];
      for (const [x, y] of dots) { ellipse(ctx, x, side * y, 1.1, 1.1); ctx.fill(); }
      /* the forewing tip is black with pale orange spots */
      ctx.fillStyle = v.vein;
      ctx.beginPath(); ctx.moveTo(18, side * 30); ctx.quadraticCurveTo(26, side * 32, 30, side * 40); ctx.quadraticCurveTo(24, side * 41, 16, side * 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mixHex(v.orange, '#fff', .35);
      ellipse(ctx, 22, side * 36, 1.6, 1.2); ctx.fill(); ellipse(ctx, 25, side * 38.5, 1.3, 1); ctx.fill();
    } else {
      const dots = [[-7, 31], [-12, 35], [-18, 36], [-24, 34], [-28, 29], [-29, 22], [-28, 15], [-25, 9]];
      for (const [x, y] of dots) { ellipse(ctx, x, side * y, 1.1, 1.1); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawMonarch(ctx, o) {
    const s = o.s || 1, v = o.variant || VARIANTS.male;
    const open = o.open === undefined ? 1 : o.open, flap = o.flap === undefined ? 1 : o.flap;
    const crumple = o.crumple || 0, walk = o.walk || 0, fresh = o.fresh || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    if (open < .5) {
      /* ---- folded: side profile, wings up over the back ---- */
      const k = 1 - open * 2;                                   // 1 fully folded
      const wingScale = lerp(.45, 1, 1 - crumple);
      /* legs */
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const lx = 6 - i * 5, sw = Math.sin(walk + i * 2) * 2;
        ctx.beginPath(); ctx.moveTo(lx, 2); ctx.lineTo(lx + sw, 8); ctx.lineTo(lx + sw + 2, 11); ctx.stroke();
      }
      /* the closed wing pair, seen from the side: paler underside */
      ctx.save();
      ctx.translate(-2, 0);
      ctx.scale(wingScale, wingScale * k);
      const under = mixHex(v.orange, '#f2c88a', .55);
      ctx.beginPath();
      ctx.moveTo(4, -2);
      ctx.bezierCurveTo(14, -14, 22, -30, 18, -44);        // forewing up and forward
      ctx.bezierCurveTo(10, -40, -2, -30, -8, -22);
      ctx.bezierCurveTo(-18, -26, -30, -22, -30, -12);     // hindwing rounder, behind
      ctx.bezierCurveTo(-28, -4, -16, -1, -6, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, -44);
      g.addColorStop(0, mixHex(under, '#b8862e', .25)); g.addColorStop(1, under);
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = v.vein; ctx.lineWidth = v.veinW * .9;
      for (const [tx, ty] of [[18, -44], [12, -38], [6, -30], [-8, -22], [-18, -25], [-28, -18], [-30, -12]]) { ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(tx * .4, ty * .6, tx, ty); ctx.stroke(); }
      ctx.lineWidth = 4.5; ctx.beginPath();
      ctx.moveTo(4, -2); ctx.bezierCurveTo(14, -14, 22, -30, 18, -44); ctx.bezierCurveTo(10, -40, -2, -30, -8, -22); ctx.bezierCurveTo(-18, -26, -30, -22, -30, -12); ctx.bezierCurveTo(-28, -4, -16, -1, -6, 0);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const [x, y] of [[17, -42], [14, -36], [9, -31], [2, -27], [-6, -22], [-14, -24], [-22, -23], [-28, -18], [-29, -12]]) { ellipse(ctx, x, y, 1, 1); ctx.fill(); }
      ctx.restore();
      ctx.restore();
      /* body: black with white speckles, seen from the side */
      ctx.fillStyle = '#1a1410';
      ellipse(ctx, -6, 1, 13, 3.2); ctx.fill();          // abdomen
      ellipse(ctx, 6, 0, 5, 4); ctx.fill();               // thorax
      ellipse(ctx, 12, -1, 3, 2.6); ctx.fill();           // head
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { ellipse(ctx, -14 + i * 4, 1 + (i % 2) * 1.5, .7, .7); ctx.fill(); }
      ellipse(ctx, 6, -2.5, .8, .8); ctx.fill(); ellipse(ctx, 8, 1.5, .7, .7); ctx.fill();
      antenna(ctx, 13, -2, -1, 14, '#1a1410', 1, 0, true);
      /* proboscis coiled */
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(14.5, 1.5, 1.4, 0, TAU * .8); ctx.stroke();
      if (o.tag) { ctx.fillStyle = '#fff'; ctx.fillRect(-14, -18, 6, 4); ctx.fillStyle = '#2a4a8a'; ctx.fillRect(-13, -17, 4, 1); }
    } else {
      /* ---- spread: top view, wings scaled across the body by flap ---- */
      const k = (open - .5) * 2;
      const wy = lerp(.15, 1, k) * lerp(.28, 1, flap) * lerp(.4, 1, 1 - crumple);
      const wx = lerp(.5, 1, 1 - crumple);
      const cr = crumple;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(wx, wy);
        if (cr > 0) { ctx.rotate(side * cr * .3); }
        wingArt(ctx, side, false, v, fresh);
        wingArt(ctx, side, true, v, fresh);
        ctx.restore();
      }
      /* body */
      ctx.fillStyle = '#1a1410';
      ellipse(ctx, -12, 0, 12, 3.2 * (1 + cr * .6)); ctx.fill();
      ellipse(ctx, 2, 0, 6, 4.4); ctx.fill();
      ellipse(ctx, 9.5, 0, 3, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) for (const side of [-1, 1]) { ellipse(ctx, -20 + i * 3.6, side * 1.6, .6, .6); ctx.fill(); }
      for (const side of [-1, 1]) { ellipse(ctx, 1, side * 2.6, .8, .8); ctx.fill(); ellipse(ctx, 4, side * 3, .6, .6); ctx.fill(); }
      /* legs */
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
        const lx = 5 - i * 3.5, sw = Math.sin(walk + i * 2.1) * 1.5;
        ctx.beginPath(); ctx.moveTo(lx, side * 3); ctx.lineTo(lx + sw + 2, side * 7.5); ctx.lineTo(lx + sw + 5, side * 8.5); ctx.stroke();
      }
      antenna(ctx, 11, -1.2, -1, 15, '#1a1410', 1.1, Math.sin(walk * .5) * .5, true);
      antenna(ctx, 11, 1.2, 1, 15, '#1a1410', 1.1, Math.cos(walk * .5) * .5, true);
      if (o.tag) { ctx.fillStyle = '#fff'; ctx.fillRect(-20, -26 * wy, 6, 4); ctx.fillStyle = '#2a4a8a'; ctx.fillRect(-19, -25 * wy, 4, 1); }
    }
    ctx.restore();
  }

  /* Cheap distant monarchs for flocks and roosts. */
  function drawMonarchTiny(ctx, x, y, s, flap, ang, col = '#f28c1e') {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    const wy = .3 + .7 * flap;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -12 * wy, 12, -14 * wy); ctx.quadraticCurveTo(2, -10 * wy, -10, -8 * wy); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, 12 * wy, 12, 14 * wy); ctx.quadraticCurveTo(2, 10 * wy, -10, 8 * wy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     EGG — a single ribbed cream egg, glued to a leaf
     ============================================================ */
  function drawEgg(ctx, o) {
    const s = o.s || 1, wob = o.wobble || 0, crack = o.crack || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.rotate(Math.sin(wob * 40) * .12 * (wob > 0 ? 1 : 0));
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(4.5, -5, 5, 2, 3.5, 4.5);
    ctx.bezierCurveTo(2, 6, -2, 6, -3.5, 4.5);
    ctx.bezierCurveTo(-5, 2, -4.5, -5, 0, -5);
    ctx.closePath();
    const g = ctx.createRadialGradient(-1.5, -2, 0, 0, 0, 6);
    g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#e8d9a0');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,50,.5)'; ctx.lineWidth = .5; ctx.stroke();
    /* ribs */
    ctx.strokeStyle = 'rgba(160,140,80,.5)'; ctx.lineWidth = .4;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * .9, -4.5); ctx.quadraticCurveTo(i * 1.4, 0, i * .9, 4.5); ctx.stroke(); }
    if (crack > 0) { ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(1, -2 + crack * 2); ctx.lineTo(-.5, 1 + crack * 2); ctx.stroke(); }
    ctx.restore();
  }

  /* ============================================================
     MILKWEED LEAF — a blade along its segment, with bites
     ============================================================ */
  function drawLeafBlade(ctx, plant, leaf, time, shadow, tint) {
    const seg = plant.segs[leaf.seg];
    const n = SEG_SAMPLES;
    const L = [], R = [], C = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = plant.posOn(seg, t);
      const nx = -p.ty, ny = p.tx;
      const flutter = Math.sin(time * 1.7 + leaf.phase + t * 2) * 1.6 * t;
      C.push([p.x, p.y + flutter]);
      const wl = leaf.skeleton ? 0 : plant.bittenWidth(leaf, t, -1);
      const wr = leaf.skeleton ? 0 : plant.bittenWidth(leaf, t, 1);
      L.push([p.x - nx * wl, p.y + flutter - ny * wl]);
      R.push([p.x + nx * wr, p.y + flutter + ny * wr]);
    }
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i <= n; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
    };
    const T = plant.type || { leaf: '#7fbf5c', leafD: '#4f8f3a' };
    const green = tint ? mixHex(T.leaf, tint[0], tint[1]) : T.leaf;
    const greenD = tint ? mixHex(T.leafD, tint[0], tint[1] * .8) : T.leafD;
    if (!leaf.skeleton) {
      if (shadow) { ctx.save(); ctx.globalAlpha = .16; ctx.translate(3, 6); ctx.fillStyle = '#000'; outline(); ctx.fill(); ctx.restore(); }
      outline();
      const g = ctx.createLinearGradient(C[0][0], C[0][1], C[n][0], C[n][1]);
      g.addColorStop(0, shade(greenD, 1.05 + leaf.hue * .01)); g.addColorStop(.5, green); g.addColorStop(1, shade(green, .92));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(30,70,20,.45)'; ctx.lineWidth = 1; ctx.stroke();
      /* lateral veins, clipped to the blade */
      ctx.save(); outline(); ctx.clip();
      ctx.strokeStyle = 'rgba(235,245,200,.55)'; ctx.lineWidth = 1.1;
      for (let i = 4; i < n; i += 3) {
        const p = plant.posOn(seg, i / n); const nx = -p.ty, ny = p.tx;
        const w = leaf.maxW * 1.3;
        for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(C[i][0], C[i][1]);
          ctx.quadraticCurveTo(C[i][0] + sd * nx * w * .5 + p.tx * w * .3, C[i][1] + sd * ny * w * .5 + p.ty * w * .3, C[i][0] + sd * nx * w + p.tx * w * .55, C[i][1] + sd * ny * w + p.ty * w * .55);
          ctx.stroke();
        }
      }
      ctx.restore();
      /* brown bite edges and fresh latex */
      for (const b of leaf.bites) {
        const p = plant.posOn(seg, b.t);
        const nx = -p.ty, ny = p.tx;
        const w = plant.bittenWidth(leaf, b.t, b.side);
        const bx = p.x + b.side * nx * w, by = p.y + b.side * ny * w;
        ctx.strokeStyle = 'rgba(120,80,30,.45)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(bx, by, Math.max(2, b.r * b.d * .5), 0, TAU); ctx.stroke();
        if (b.fresh > 0) {
          ctx.fillStyle = withAlpha('#ffffff', Math.min(1, b.fresh) * .9);
          ellipse(ctx, bx + Math.sin(b.t * 50) * 2, by + 1, 2.2, 1.6); ctx.fill();
        }
      }
    }
    /* midrib (also all that is left of a skeleton) */
    ctx.strokeStyle = leaf.skeleton ? '#8a7a4a' : 'rgba(215,235,170,.8)'; ctx.lineWidth = leaf.skeleton ? 2 : 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(C[0][0], C[0][1]); for (let i = 1; i <= n; i++) ctx.lineTo(C[i][0], C[i][1]); ctx.stroke();
    if (leaf.skeleton) {
      ctx.strokeStyle = 'rgba(138,122,74,.6)'; ctx.lineWidth = 1;
      for (let i = 4; i < n; i += 4) { const p = plant.posOn(seg, i / n); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(C[i][0], C[i][1]); ctx.lineTo(C[i][0] - sd * p.ty * 9 + p.tx * 5, C[i][1] + sd * p.tx * 9 + p.ty * 5); ctx.stroke(); } }
    }
  }

  /* ============================================================
     MILKWEED UMBEL — a ball of pink florets
     ============================================================ */
  function drawUmbel(ctx, f, x, y, time, glow, type) {
    const T = type || { flower: '#e9a2c8', flower2: '#c96a9d', crown: '#fbe8f2' };
    ctx.save();
    ctx.translate(x, y);
    const r = f.size;
    const rng = mulberry32((f.hue * 1e6) | 0);
    const n = 22 + (r / 2 | 0);
    /* pedicels */
    ctx.strokeStyle = '#8fbf6a'; ctx.lineWidth = 1.2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * r;
      const px = Math.cos(a) * d, py = Math.sin(a) * d * .75 - r * .2;
      pts.push([px, py, rng()]);
      ctx.beginPath(); ctx.moveTo(0, r * .3); ctx.lineTo(px, py); ctx.stroke();
    }
    if (glow) {
      ctx.globalAlpha = .35 + .2 * Math.sin(time * 4);
      const gg = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.8);
      gg.addColorStop(0, 'rgba(255,240,180,.9)'); gg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = gg; ellipse(ctx, 0, 0, r * 1.8, r * 1.8); ctx.fill();
      ctx.globalAlpha = 1;
    }
    /* florets: five reflexed pink petals with a pale crown */
    for (const [px, py, k] of pts) {
      const fr = 3.2 + k * 1.4;
      ctx.fillStyle = mixHex(T.flower, T.flower2, k);
      for (let j = 0; j < 5; j++) { const a = j / 5 * TAU + k; ellipse(ctx, px + Math.cos(a) * fr * .7, py + Math.sin(a) * fr * .7, fr * .5, fr * .32, a); ctx.fill(); }
      ctx.fillStyle = mixHex(T.crown, T.flower, k * .5);
      ellipse(ctx, px, py, fr * .42, fr * .42); ctx.fill();
    }
    ctx.restore();
  }

  function drawPod(ctx, pod, x, y, time = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(pod.ang * pod.side);
    ctx.scale(pod.side, 1);
    if (pod.burst) {
      /* split open: two brown halves and a puff of floss */
      ctx.fillStyle = '#b89a6a'; ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(12, -8, pod.size * .7, -18, pod.size, -10); ctx.bezierCurveTo(pod.size * .6, -6, 14, -2, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(12, 8, pod.size * .7, 16, pod.size, 8); ctx.bezierCurveTo(pod.size * .6, 4, 14, 2, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 6; i++) { ellipse(ctx, pod.size * .35 + i * 5 + Math.sin(time * 2 + i) * 2, -2 + Math.cos(time * 1.5 + i) * 3, 5, 3.5); ctx.fill(); }
      ctx.fillStyle = '#5a3a1a'; for (let i = 0; i < 5; i++) { ellipse(ctx, pod.size * .4 + i * 5, 0, 1.8, 1.2); ctx.fill(); }
      ctx.restore(); return;
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(12, -6, pod.size * .7, -14, pod.size, -4);
    ctx.bezierCurveTo(pod.size * .7, 6, 12, 8, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -12, 0, 8);
    g.addColorStop(0, '#a9d47a'); g.addColorStop(1, '#5f9a44');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(40,80,20,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let i = 0; i < 9; i++) { ellipse(ctx, 8 + i * pod.size * .09, -4 + Math.sin(i) * 3, 1.6, 1.2); ctx.fill(); }
    ctx.restore();
  }

  /* ============================================================
     OLEANDER APHID, ANT, PAPER WASP
     ============================================================ */
  function drawAphid(ctx, o) {
    const s = o.s || 1, walk = o.walk || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = .8; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const sw = Math.sin(walk + i * 2) * 1.2;
      ctx.beginPath(); ctx.moveTo(2 - i * 2, side * 2); ctx.lineTo(2 - i * 2 + sw, side * 4.5); ctx.stroke();
    }
    ellipse(ctx, -1, 0, 4.2, 3); ctx.fillStyle = '#f2c11e'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,.5)'; ctx.lineWidth = .6; ctx.stroke();
    ellipse(ctx, 3.2, 0, 1.6, 1.4); ctx.fillStyle = '#e8b20f'; ctx.fill();
    ctx.fillStyle = '#1a1410';
    ellipse(ctx, 3.8, -.9, .5, .5); ctx.fill(); ellipse(ctx, 3.8, .9, .5, .5); ctx.fill();
    /* cornicles: two black tubes at the back */
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-3.5, -1.5); ctx.lineTo(-5.5, -2.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3.5, 1.5); ctx.lineTo(-5.5, 2.5); ctx.stroke();
    ctx.restore();
  }
  function drawAnt(ctx, o) {
    const s = o.s || 1, walk = o.walk || 0, bite = o.bite || 0;
    ctx.save(); ctx.scale(s, s);
    const col = '#3a2418';
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const ph = walk + i * 2.1 + (side > 0 ? Math.PI : 0);
      leg(ctx, 3 - i * 3, side * 2, side, 7, Math.sin(ph), Math.max(0, Math.cos(ph)), col, 1.1);
    }
    ctx.fillStyle = col;
    ellipse(ctx, -7, 0, 6, 3.6); ctx.fill();             // gaster
    ellipse(ctx, 0, 0, 3.4, 2.4); ctx.fill();            // thorax
    ellipse(ctx, 6, 0, 3.4, 3); ctx.fill();              // head
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(8, side * 1.5); ctx.lineTo(11, side * (1.2 + bite * 1.5)); ctx.stroke();
      antenna(ctx, 7, side * 2, side, 6, col, .9, Math.sin(walk));
    }
    ctx.restore();
  }
  function drawWasp(ctx, o) {
    const s = o.s || 1, ph = o.phase || 0;
    ctx.save(); ctx.scale(s, s);
    /* wing blur */
    ctx.fillStyle = 'rgba(200,210,230,.45)';
    for (const side of [-1, 1]) { ellipse(ctx, -4, side * 7, 12, 3.5 + Math.sin(ph) * 2, side * .35); ctx.fill(); }
    /* legs dangling */
    ctx.strokeStyle = '#6a4a12'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(4 - i * 3, side * 2); ctx.lineTo(3 - i * 3, side * 7); ctx.stroke(); }
    /* abdomen: yellow with brown bands, narrow waist */
    ctx.fillStyle = '#e8b21e';
    ellipse(ctx, -11, 0, 9, 4); ctx.fill();
    ctx.fillStyle = '#5a3a10';
    for (let i = 0; i < 4; i++) { ctx.fillRect(-18 + i * 4, -3.6 + Math.abs(i - 1.5) * .6, 1.6, 7.2 - Math.abs(i - 1.5) * 1.2); }
    ellipse(ctx, -1, 0, 4.5, 3.4); ctx.fillStyle = '#6a4a12'; ctx.fill();
    ellipse(ctx, 5, 0, 3.2, 3); ctx.fillStyle = '#e8b21e'; ctx.fill();
    ctx.fillStyle = '#1a1410'; ellipse(ctx, 6, -1.6, 1.1, 1.3); ctx.fill(); ellipse(ctx, 6, 1.6, 1.1, 1.3); ctx.fill();
    antenna(ctx, 7, -1.5, -1, 7, '#3a2a10', 1, Math.sin(ph * .3));
    antenna(ctx, 7, 1.5, 1, 7, '#3a2a10', 1, Math.cos(ph * .3));
    ctx.restore();
  }

  /* ============================================================
     MIGRATION — trees, nectar patches, props
     ============================================================
     Trees are drawn with their base at (x, 0), growing into -y.
     tree: { kind, h, seed, roost (0..1 how many monarchs on it) }
     ============================================================ */
  const TREE_STYLE = {
    maple: { trunk: '#5a3a24', leaf: ['#e2552b', '#f28c1e', '#f2c21b'], shape: 'round' },
    oak: { trunk: '#4f3a26', leaf: ['#7a8a3a', '#a08a3a', '#6a7a2f'], shape: 'broad' },
    birch: { trunk: '#e8e6dc', leaf: ['#f2d23a', '#e6c02a', '#d9b020'], shape: 'tall' },
    cottonwood: { trunk: '#6a5a44', leaf: ['#f2cf3a', '#e6c030', '#c9a824'], shape: 'tall' },
    pecan: { trunk: '#5a4632', leaf: ['#8fa84a', '#b8a83a', '#7a9a3f'], shape: 'broad' },
    pine: { trunk: '#5a3a24', leaf: ['#3f6a3a', '#4a7a44', '#2f5a30'], shape: 'cone' },
    fir: { trunk: '#3a2a1e', leaf: ['#2f5a48', '#3a6a52', '#254a3c'], shape: 'fir' }
  };
  const treeCache = new Map();
  function treeSprite(tree) {
    const key = tree.kind + '|' + tree.seed + '|' + Math.round(tree.h);
    if (treeCache.has(key)) return treeCache.get(key);
    const st = TREE_STYLE[tree.kind] || TREE_STYLE.oak;
    const rng = mulberry32(tree.seed);
    const h = tree.h, w = st.shape === 'fir' ? h * .42 : st.shape === 'cone' ? h * .55 : st.shape === 'tall' ? h * .6 : h * .95;
    const S = 1.5;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + 40) * S); c.height = Math.ceil((h + 30) * S);
    const g = c.getContext('2d');
    g.scale(S, S);
    g.translate(c.width / S / 2, c.height / S - 10);
    /* trunk */
    g.strokeStyle = st.trunk; g.lineCap = 'round';
    g.lineWidth = Math.max(6, h * .07);
    g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(rng() * 10 - 5, -h * .3, (rng() - .5) * 12, -h * (st.shape === 'fir' || st.shape === 'cone' ? .9 : .55)); g.stroke();
    if (st.shape === 'round' || st.shape === 'broad' || st.shape === 'tall') {
      /* a few limbs */
      g.lineWidth = Math.max(3, h * .035);
      for (let i = 0; i < 4; i++) {
        const y0 = -h * (0.3 + rng() * .25), side = i % 2 ? 1 : -1;
        g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(side * w * .2, y0 - h * .1, side * w * (0.25 + rng() * .15), y0 - h * (0.15 + rng() * .15)); g.stroke();
      }
      /* crown: overlapping blobs */
      const cy = -h * (st.shape === 'tall' ? .62 : .6), rx = w * .5, ry = h * (st.shape === 'tall' ? .34 : .28);
      /* a soft dark mass, then many small leafy blobs over it */
      g.fillStyle = shade(st.leaf[2], .7);
      g.beginPath(); g.ellipse(0, cy, rx * .92, ry * .92, 0, 0, TAU); g.fill();
      const n = 70 + (rng() * 30 | 0);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng());
        const x = Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
        const r = h * (0.028 + rng() * .045);
        const col = st.leaf[(rng() * st.leaf.length) | 0];
        g.fillStyle = shade(col, .85 + rng() * .3 - Math.max(0, Math.sin(a)) * .15);
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    } else {
      /* conifer: stacked triangles */
      const tiers = st.shape === 'fir' ? 7 : 5;
      for (let i = 0; i < tiers; i++) {
        const u = i / tiers;
        const yTop = -h * (1 - u * .78) , yBot = -h * (1 - (u + 1 / tiers) * .78) + h * .06;
        const hw = w * (0.15 + u * .85) * .5;
        const col = st.leaf[i % st.leaf.length];
        g.fillStyle = shade(col, .95 + rng() * .15);
        g.beginPath(); g.moveTo(0, yTop); g.lineTo(hw, yBot); g.lineTo(-hw, yBot); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.08)';
        g.beginPath(); g.moveTo(0, yTop); g.lineTo(-hw, yBot); g.lineTo(-hw * .3, yBot); g.closePath(); g.fill();
      }
    }
    const spr = { img: c, S, w: c.width / S, h: c.height / S };
    treeCache.set(key, spr);
    return spr;
  }
  function drawTree(ctx, tree, x, y, time, opts = {}) {
    const spr = treeSprite(tree);
    const sway = Math.sin(time * .6 + tree.seed) * 1.2 * (opts.gust || 0) * 3;
    ctx.save();
    ctx.translate(x + sway, y);
    ctx.drawImage(spr.img, -spr.w / 2, -spr.h + 10, spr.w, spr.h);
    ctx.restore();
    /* monarchs clustered on it */
    if (tree.roost > 0) {
      const rng = mulberry32(tree.seed ^ 0x77);
      const n = Math.round(tree.roost * (tree.kind === 'fir' ? 160 : 60));
      const st = TREE_STYLE[tree.kind] || TREE_STYLE.oak;
      const cone = st.shape === 'fir' || st.shape === 'cone';
      for (let i = 0; i < n; i++) {
        const u = rng(), v = rng();
        let px, py;
        if (cone) { const yy = -tree.h * (0.25 + u * .7); const hw = tree.h * .42 * .5 * (0.15 + (1 - (yy / -tree.h - .2) / .8) * .85); px = (v - .5) * 2 * hw * .9; py = yy; }
        else { const a = rng() * TAU, d = Math.sqrt(rng()); px = Math.cos(a) * d * spr.w * .42; py = -tree.h * .6 + Math.sin(a) * d * tree.h * .26; }
        const flutter = rng() < .08 ? .5 + .5 * Math.sin(time * 9 + i) : 0;
        drawMonarchTiny(ctx, x + sway + px, y + py, .28 + rng() * .18, .15 + flutter * .8, -Math.PI / 2 + (rng() - .5) * .8, rng() < .8 ? '#f28c1e' : '#e8b06a');
      }
    }
  }

  /* Nectar patches: a clump of flower stems.  patch: { kind, seed, w } */
  function drawNectarPatch(ctx, patch, x, y, time, glow) {
    const def = NECTAR_PLANTS[patch.kind];
    const rng = mulberry32(patch.seed);
    const n = 5 + (patch.w / 22 | 0);
    if (glow) {
      ctx.globalAlpha = .28 + .18 * Math.sin(time * 4);
      const gg = ctx.createRadialGradient(x, y - def.h[1] * .5, 10, x, y - def.h[1] * .5, patch.w * .9);
      gg.addColorStop(0, 'rgba(255,245,180,.9)'); gg.addColorStop(1, 'rgba(255,245,180,0)');
      ctx.fillStyle = gg; ellipse(ctx, x, y - def.h[1] * .5, patch.w * .9, patch.w * .9); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < n; i++) {
      const sx = x + (rng() - .5) * patch.w, h = lerp(def.h[0], def.h[1], rng());
      const sw = Math.sin(time * 1.3 + rng() * 6) * 3;
      ctx.strokeStyle = '#5f9a44'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.quadraticCurveTo(sx + sw * .5, y - h * .5, sx + sw, y - h); ctx.stroke();
      /* a leaf or two */
      ctx.fillStyle = '#6faa4f';
      ellipse(ctx, sx + 6, y - h * .35, 7, 2.5, -.5); ctx.fill();
      const fx = sx + sw, fy = y - h;
      if (def.shape === 'plume') {
        ctx.fillStyle = def.col;
        for (let k = 0; k < 14; k++) { const a = -Math.PI / 2 + (rng() - .5) * 1.6, d = rng() * 16; ellipse(ctx, fx + Math.cos(a) * d, fy + Math.sin(a) * d * 1.2 + 6, 3, 2, a); ctx.fill(); }
        ctx.fillStyle = def.col2; ellipse(ctx, fx, fy + 4, 2, 5); ctx.fill();
      } else if (def.shape === 'daisy') {
        const r = patch.kind === 'sunflower' ? 13 : 7;
        ctx.fillStyle = def.col;
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ellipse(ctx, fx + Math.cos(a) * r * .8, fy + Math.sin(a) * r * .8, r * .5, r * .22, a); ctx.fill(); }
        ctx.fillStyle = def.col2; ellipse(ctx, fx, fy, r * .42, r * .42); ctx.fill();
      } else {
        ctx.fillStyle = def.col; ellipse(ctx, fx, fy, 7, 6); ctx.fill();
        ctx.fillStyle = def.col2;
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rng(); ellipse(ctx, fx + Math.cos(a) * 3.5, fy + Math.sin(a) * 3, 2, 1.4, a); ctx.fill(); }
      }
    }
  }

  /* Scenery props with their base at (x, 0). */
  function drawProp(ctx, prop, x, y, time) {
    ctx.save(); ctx.translate(x, y);
    const rng = mulberry32(prop.seed);
    switch (prop.kind) {
      case 'barn': {
        ctx.fillStyle = '#b8342a'; ctx.fillRect(-60, -70, 120, 70);
        ctx.fillStyle = '#7a2018'; ctx.beginPath(); ctx.moveTo(-66, -70); ctx.lineTo(-40, -100); ctx.lineTo(40, -100); ctx.lineTo(66, -70); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2ead0'; ctx.fillRect(-14, -50, 28, 50);
        ctx.strokeStyle = '#f2ead0'; ctx.lineWidth = 3; ctx.strokeRect(-50, -60, 24, 22); ctx.strokeRect(26, -60, 24, 22);
        /* silo */
        ctx.fillStyle = '#c9c4b4'; ctx.fillRect(74, -120, 34, 120);
        ctx.fillStyle = '#8a8a80'; ctx.beginPath(); ctx.arc(91, -120, 17, Math.PI, 0); ctx.fill();
        break;
      }
      case 'windmill': {
        ctx.strokeStyle = '#6a6a66'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-3, -110); ctx.lineTo(3, -110); ctx.lineTo(14, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9, -50); ctx.lineTo(9, -50); ctx.moveTo(-11, -30); ctx.lineTo(11, -30); ctx.stroke();
        ctx.save(); ctx.translate(0, -112); ctx.rotate(time * .8);
        ctx.fillStyle = '#c9c4b4';
        for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -22); ctx.lineTo(-4, -22); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        break;
      }
      case 'hay': {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = mixHex('#d9b85a', '#b8963a', rng()); ellipse(ctx, i * 70 - 70, -18, 24, 18); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,30,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(i * 70 - 70, -18, 11, 0, TAU); ctx.stroke(); }
        break;
      }
      case 'corn': {
        for (let i = 0; i < 26; i++) {
          const cx = i * 16 - 200, h = 60 + rng() * 25;
          ctx.strokeStyle = mixHex('#b8a840', '#8a8a30', rng()); ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.sin(time + i) * 2, -h); ctx.stroke();
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cx, -h * .5); ctx.quadraticCurveTo(cx + 12, -h * .55, cx + 18, -h * .35); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, -h * .7); ctx.quadraticCurveTo(cx - 12, -h * .75, cx - 18, -h * .55); ctx.stroke();
          ctx.fillStyle = '#d9c25a'; ellipse(ctx, cx, -h - 6, 2, 6); ctx.fill();
        }
        break;
      }
      case 'agave': {
        ctx.fillStyle = '#7fa88a';
        for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i - 5.5) * .27; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -40 - Math.abs(i - 5.5) * -3); ctx.lineTo(-6, -40 - Math.abs(i - 5.5) * -3); ctx.closePath(); ctx.fillStyle = mixHex('#7fa88a', '#5a8a6a', i % 2 ? .4 : 0); ctx.fill(); ctx.restore(); }
        if (rng() < .5) { ctx.strokeStyle = '#8a7a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -160); ctx.stroke(); ctx.fillStyle = '#e8d060'; for (let i = 0; i < 5; i++) { ellipse(ctx, (i % 2 ? 10 : -10), -100 - i * 12, 9, 5); ctx.fill(); } }
        break;
      }
      case 'cactus': {
        ctx.fillStyle = '#5f9a5a'; ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 2;
        rr(ctx, -9, -110, 18, 110, 9); ctx.fill(); ctx.stroke();
        rr(ctx, -34, -80, 14, 44, 7); ctx.fill(); ctx.stroke(); ctx.fillRect(-34, -48, 30, 12);
        rr(ctx, 20, -95, 14, 50, 7); ctx.fill(); ctx.stroke(); ctx.fillRect(4, -57, 30, 12);
        break;
      }
      case 'house': {
        ctx.fillStyle = '#e8c9a0'; ctx.fillRect(-55, -60, 110, 60);
        ctx.fillStyle = '#b8562a'; ctx.fillRect(-60, -68, 120, 10);
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(-12, -42, 24, 42);
        ctx.fillStyle = '#7ab0d8'; ctx.fillRect(-45, -45, 18, 16); ctx.fillRect(27, -45, 18, 16);
        /* marigolds along the wall for Día de Muertos */
        ctx.fillStyle = '#ff9a1f'; for (let i = 0; i < 8; i++) { ellipse(ctx, -50 + i * 14, -6, 5, 5); ctx.fill(); }
        ctx.fillStyle = '#e0641a'; for (let i = 0; i < 8; i++) { ellipse(ctx, -50 + i * 14, -6, 2, 2); ctx.fill(); }
        break;
      }
      case 'church': {
        ctx.fillStyle = '#e8dcc8'; ctx.fillRect(-40, -80, 80, 80); ctx.fillRect(-16, -140, 32, 60);
        ctx.fillStyle = '#b8562a'; ctx.beginPath(); ctx.moveTo(-18, -140); ctx.lineTo(0, -168); ctx.lineTo(18, -140); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(0, -30, 12, Math.PI, 0); ctx.fillRect(-12, -30, 24, 30); ctx.fill();
        ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(0, -118, 6, Math.PI, 0); ctx.fillRect(-6, -118, 12, 16); ctx.fill();
        break;
      }
      case 'fence': {
        ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * 30 - 105, 0); ctx.lineTo(i * 30 - 105, -26); ctx.stroke(); }
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-110, -10); ctx.lineTo(110, -10); ctx.moveTo(-110, -20); ctx.lineTo(110, -20); ctx.stroke();
        break;
      }
      case 'sign': {
        ctx.fillStyle = '#6a5a44'; ctx.fillRect(-3, -70, 6, 70);
        ctx.fillStyle = '#2f7a3a'; rr(ctx, -48, -96, 96, 30, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(prop.text || 'SOUTH', 0, -81);
        break;
      }
      case 'stream': {
        ctx.fillStyle = 'rgba(120,180,220,.7)'; ellipse(ctx, 0, 4, 90, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 5; i++) { ellipse(ctx, -60 + i * 30 + Math.sin(time * 2 + i) * 4, 3, 8, 1.5); ctx.fill(); }
        break;
      }
    }
    ctx.restore();
  }

  /* A hawk circling in a thermal, seen from below. */
  function drawHawk(ctx, x, y, s, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.fillStyle = '#3a2a1e';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -14, 24, -10); ctx.quadraticCurveTo(12, -6, 2, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, 14, 24, 10); ctx.quadraticCurveTo(12, 6, 2, -2); ctx.closePath(); ctx.fill();
    ellipse(ctx, 3, 0, 5, 2.2); ctx.fill();
    ctx.restore();
  }

  /* Little lifecycle icons for the HUD, rendered into small canvases. */
  function icon(kind, variant, px = 44) {
    const c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.translate(px / 2, px / 2);
    const inst = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 }[kind];
    switch (kind) {
      case 'egg': drawEgg(ctx, { s: px / 16 }); break;
      case 'chrysalis': ctx.translate(0, -px * .42); drawChrysalis(ctx, { s: px / 62, prog: .3, variant }); break;
      case 'adult': ctx.rotate(-Math.PI / 2); drawMonarch(ctx, { s: px / 88, variant, open: 1, flap: 1 }); break;
      case 'journey': {
        ctx.fillStyle = '#dfe9c8'; ellipse(ctx, 0, 0, px * .42, px * .42); ctx.fill();
        ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-px * .2, -px * .28); ctx.quadraticCurveTo(px * .1, 0, -px * .05, px * .3); ctx.stroke();
        ctx.fillStyle = '#e0392f'; ctx.beginPath(); ctx.moveTo(-px * .05, px * .36); ctx.lineTo(-px * .14, px * .2); ctx.lineTo(px * .04, px * .2); ctx.closePath(); ctx.fill();
        ctx.translate(px * .1, -px * .12); ctx.rotate(1.2); drawMonarch(ctx, { s: px / 150, variant, open: 1, flap: 1 });
        break;
      }
      case 'forest': {
        const t = { kind: 'fir', h: px * .8, seed: 5, roost: .6 };
        drawTree(ctx, t, 0, px * .42, 0);
        break;
      }
      default:
        if (inst) { ctx.rotate(-.4); drawCaterpillar(ctx, { s: px / [0, 150, 130, 115, 100, 88][inst], instar: inst }); }
    }
    return c;
  }

  /* ============================================================
     PREDATORS, PEOPLE, SEEDS, GARDEN
     ============================================================ */
  /* A praying mantis, side-on, facing +x, standing on a leaf at the origin. */
  function drawMantis(ctx, o) {
    const s = o.s || 1, strike = o.strike || 0, sway = o.sway || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.rotate(sway);
    const g = '#8fc95a', d = '#4f8a30';
    ctx.strokeStyle = d; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const [hx, hy] of [[-10, -6], [-2, -7]]) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 6, 2); ctx.lineTo(hx - 3, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 5, 3); ctx.lineTo(hx + 8, 8); ctx.stroke(); }
    ctx.fillStyle = g; ellipse(ctx, -14, -8, 16, 5, .05); ctx.fill();
    ctx.fillStyle = mixHex(g, '#ffffff', .25); ellipse(ctx, -12, -10, 14, 3, .08); ctx.fill();
    ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(10, -20); ctx.stroke();
    ctx.strokeStyle = d; ctx.lineWidth = 2.2;
    const open = strike * 1.2;
    for (const side of [0, 1]) {
      ctx.beginPath(); ctx.moveTo(8, -18 + side * 2);
      ctx.lineTo(14 + open * 8, -26 - side * 2 + open * 6); ctx.lineTo(12 + open * 16, -14 + side * 2 + open * 4); ctx.stroke();
    }
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(16, -27); ctx.lineTo(12, -18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a3a10'; ellipse(ctx, 14, -26, 1.8, 1.8); ctx.fill();
    antenna(ctx, 12, -27, -1, 10, d, 1, Math.sin(sway * 30));
    ctx.restore();
  }

  /* A bird in flight, heading +x. kind: oriole | grosbeak | kingbird */
  function drawBird(ctx, o) {
    const s = o.s || 1, ph = o.phase || 0, kind = o.kind || 'oriole';
    const cols = { oriole: ['#1a1410', '#f2a11e', '#f2a11e'], grosbeak: ['#1a1410', '#d9771e', '#f2d9a0'], kingbird: ['#3a3a40', '#f4f4f0', '#3a3a40'] }[kind] || ['#222222', '#cccccc', '#cccccc'];
    ctx.save(); ctx.scale(s, s);
    const flap = Math.sin(ph);
    ctx.fillStyle = cols[0];
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(4, side * 10 * (1 + flap * .3), -6 + flap * 4, side * 26);
      ctx.quadraticCurveTo(-12, side * 14, -12, side * 3); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = cols[1]; ellipse(ctx, 0, 0, 13, 5.5); ctx.fill();
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-22, -5); ctx.lineTo(-22, 5); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cols[2]; ellipse(ctx, 11, -1, 5, 4.5); ctx.fill();
    if (kind !== 'kingbird') { ctx.fillStyle = cols[0]; ellipse(ctx, 12, -2.5, 3.5, 2.2); ctx.fill(); }
    ctx.fillStyle = '#8a8a80'; ctx.beginPath(); ctx.moveTo(15, -1); ctx.lineTo(22, 0); ctx.lineTo(15, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111111'; ellipse(ctx, 13, -2, .9, .9); ctx.fill();
    ctx.restore();
  }

  /* A tagging volunteer with a butterfly net, feet at the origin. */
  function drawVolunteer(ctx, o) {
    const s = o.s || 1, swing = o.swing || 0, t = o.time || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#3a4a7a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-6, -34); ctx.moveTo(5, -2); ctx.lineTo(6, -34); ctx.stroke();
    ctx.fillStyle = '#6fa84a'; rr(ctx, -13, -70, 26, 38, 8); ctx.fill();
    ctx.fillStyle = '#f2c9a0'; ellipse(ctx, 0, -82, 9, 10); ctx.fill();
    ctx.fillStyle = '#e8d9a0'; ellipse(ctx, 0, -90, 15, 4); ctx.fill(); rr(ctx, -9, -100, 18, 11, 4); ctx.fill();
    ctx.fillStyle = '#111111'; ellipse(ctx, -3, -83, 1, 1.2); ctx.fill(); ellipse(ctx, 3, -83, 1, 1.2); ctx.fill();
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -79, 3, .2, Math.PI - .2); ctx.stroke();
    ctx.save(); ctx.translate(10, -62); ctx.rotate(-.9 + swing * 1.3 + Math.sin(t * 3) * .05);
    ctx.strokeStyle = '#f2c9a0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, -6); ctx.stroke();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(70, -30); ctx.stroke();
    ctx.strokeStyle = '#444444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(84, -36, 16, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(70, -28); ctx.quadraticCurveTo(84, 10, 100, -30); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* A seed with its floss parachute. */
  function drawSeed(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = .8;
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .22; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
    ctx.fillStyle = '#6a4a22'; ellipse(ctx, 0, 2, 2.2, 1.4); ctx.fill();
    ctx.restore();
  }

  /* A small background milkweed for the garden, base at the origin. */
  function drawMiniMilkweed(ctx, seed, h, time, type) {
    const rng = mulberry32(seed);
    const T = type || MILKWEEDS.swamp;
    ctx.save();
    const sway = Math.sin(time * .8 + seed) * 3;
    ctx.strokeStyle = T.stem; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * .5, -h * .5, sway, -h); ctx.stroke();
    ctx.fillStyle = T.leaf;
    const pairs = 3 + (rng() * 2 | 0);
    for (let i = 1; i <= pairs; i++) {
      const y = -h * i / (pairs + 1), lw = h * (0.16 - i * .015), lh = lw * T.leafW * 1.4;
      for (const side of [-1, 1]) { ellipse(ctx, sway * i / pairs + side * lw * .55, y - 3, lw * .6, lh, side * -.25); ctx.fill(); }
    }
    ctx.fillStyle = T.flower;
    for (let i = 0; i < 9; i++) { const a = rng() * TAU, d = rng() * 9; ellipse(ctx, sway + Math.cos(a) * d, -h - 4 + Math.sin(a) * d * .7, 3, 2.4); ctx.fill(); }
    ctx.restore();
  }

  return { drawCaterpillar, drawChrysalis, drawMonarch, drawMonarchTiny, drawEgg, drawLeafBlade, drawUmbel, drawPod, drawAphid, drawAnt, drawWasp, drawTree, treeSprite, drawNectarPatch, drawProp, drawHawk, drawMantis, drawBird, drawVolunteer, drawSeed, drawMiniMilkweed, icon, ellipse };
})();
