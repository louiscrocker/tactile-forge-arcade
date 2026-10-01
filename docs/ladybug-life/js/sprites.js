/* ============================================================
   sprites.js — everything that lives in the garden, drawn by hand
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

  /* Two-jointed insect leg. hip at (hx,hy); side = -1 (one flank) or +1.
     `swing` is -1..1 along the body axis (walk cycle). */
  function leg(ctx, hx, hy, side, len, swing, lift, col, thick) {
    const dx = swing * len * .45;
    const kx = hx + dx * .55, ky = hy + side * len * .55;
    const fx = hx + dx, fy = hy + side * len * (1.0 - lift * .25);
    ctx.strokeStyle = col;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    /* tiny foot */
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + (swing > 0 ? 1 : -1) * thick * 1.2, fy + side * thick * .8);
    ctx.stroke();
  }

  function antenna(ctx, x, y, side, len, col, thick, wave) {
    ctx.strokeStyle = col; ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * .6, y + side * len * .25 + wave * len * .1, x + len, y + side * len * .55 + wave * len * .2);
    ctx.stroke();
  }

  /* ============================================================
     LADYBUG LARVA — the little alligator
     ============================================================ */
  function drawLarva(ctx, o) {
    const s = o.s || 1, instar = o.instar || 1;
    const walk = o.walk || 0, chew = o.chew || 0;
    const pale = o.pale || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    const nSeg = 12;                       // head + 3 thorax + 8 abdomen
    const totalL = 64;
    const base = mixHex('#2d3446', '#c9c9c2', pale);
    const plate = mixHex('#414a62', '#e0e0d8', pale);
    const edge = mixHex('#141824', '#9d9d97', pale);
    const spotCol = mixHex('#ff9d2f', '#f0d9b0', pale);
    const spotCol2 = mixHex('#ffc23a', '#f0dfba', pale);
    const legCol = edge;

    /* segment positions: head at +x */
    const seg = [];
    for (let i = 0; i < nSeg; i++) {
      const u = i / (nSeg - 1);
      const x = totalL / 2 - u * totalL;
      /* width profile: narrow head, widest around thorax/abd 1-2, tapering tail */
      let w;
      if (i === 0) w = 6.2;
      else if (i < 4) w = 7.2 + i * .6;
      else w = lerp(9.4, 2.8, Math.pow((i - 4) / 7, 1.15));
      /* tail wiggles as it walks */
      const wig = Math.sin(walk * 2 - i * .55) * (i > 3 ? (i - 3) * .28 : 0);
      seg.push({ x, y: wig, w, len: totalL / nSeg * 1.15 });
    }

    /* legs first (underneath body) — 3 pairs on segments 1..3 */
    for (let i = 1; i <= 3; i++) {
      const sg = seg[i];
      const ph = walk + i * (TAU / 3);
      const swingA = Math.sin(ph), swingB = Math.sin(ph + Math.PI);
      const legLen = 11 + i * 1.2;
      leg(ctx, sg.x, sg.y + sg.w * .5, 1, legLen, swingA, Math.max(0, Math.cos(ph)), legCol, 1.5);
      leg(ctx, sg.x, sg.y - sg.w * .5, -1, legLen, swingB, Math.max(0, Math.cos(ph + Math.PI)), legCol, 1.5);
    }

    /* body plates, tail first so the head overlaps */
    for (let i = nSeg - 1; i >= 1; i--) {
      const sg = seg[i];
      /* tubercles: little side bumps / spines */
      if (i >= 1 && instar >= 2) {
        ctx.strokeStyle = edge; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        const sp = 2.2 + instar * .5;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sg.x, sg.y + side * sg.w * .8);
          ctx.lineTo(sg.x - 1.5, sg.y + side * (sg.w * .8 + sp));
          ctx.stroke();
          if (instar >= 3) {
            ctx.beginPath();
            ctx.moveTo(sg.x + 1.5, sg.y + side * sg.w * .7);
            ctx.lineTo(sg.x + 2.6, sg.y + side * (sg.w * .7 + sp * .8));
            ctx.stroke();
          }
        }
      }
      ellipse(ctx, sg.x, sg.y, sg.len * .62, sg.w);
      ctx.fillStyle = base;
      ctx.fill();
      ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
      ctx.stroke();
      /* raised plate highlight */
      ellipse(ctx, sg.x + .6, sg.y - sg.w * .2, sg.len * .42, sg.w * .55);
      ctx.fillStyle = plate;
      ctx.fill();
      /* a darker seam down the middle */
      ctx.fillStyle = withAlpha('#0d1019', .35 * (1 - pale));
      ellipse(ctx, sg.x, sg.y, sg.len * .25, sg.w * .28);
      ctx.fill();

      /* orange spots — thorax 1 and abdomen segs 1 & 4 (7-spot larva pattern) */
      const spotHere = (i === 1) || (i === 4) || (i === 7 && instar >= 2) || (i === 5 && instar >= 4);
      if (spotHere) {
        const r = (i === 1 ? 2.4 : 2.9) * (0.7 + instar * .1);
        for (const side of [-1, 1]) {
          ellipse(ctx, sg.x, sg.y + side * sg.w * .55, r * 1.1, r);
          ctx.fillStyle = i === 1 ? spotCol2 : spotCol;
          ctx.fill();
        }
      }
    }

    /* head */
    const hd = seg[0];
    ellipse(ctx, hd.x + 1, hd.y, 6.2, hd.w);
    ctx.fillStyle = edge; ctx.fill();
    ellipse(ctx, hd.x + .5, hd.y - 1, 4.2, hd.w * .6);
    ctx.fillStyle = mixHex('#2a3040', '#c5c5be', pale); ctx.fill();
    /* eyes */
    ctx.fillStyle = mixHex('#0a0c12', '#8e8e88', pale);
    ellipse(ctx, hd.x + 3.5, hd.y - 4.2, 1.3, 1.3); ctx.fill();
    ellipse(ctx, hd.x + 3.5, hd.y + 4.2, 1.3, 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ellipse(ctx, hd.x + 3.9, hd.y - 4.6, .5, .5); ctx.fill();
    ellipse(ctx, hd.x + 3.9, hd.y + 3.8, .5, .5); ctx.fill();
    /* mandibles, open by `chew` */
    const openA = .35 + chew * .9;
    ctx.strokeStyle = mixHex('#1a1f2b', '#a0a09a', pale); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hd.x + 5.5, hd.y + side * 2.2);
      ctx.quadraticCurveTo(hd.x + 9.5, hd.y + side * (2.2 + openA * 3), hd.x + 10.5, hd.y + side * (openA * 1.6));
      ctx.stroke();
    }
    /* antennae */
    antenna(ctx, hd.x + 5, hd.y - 3.5, -1, 7, edge, 1, Math.sin(walk * .7));
    antenna(ctx, hd.x + 5, hd.y + 3.5, 1, 7, edge, 1, Math.cos(walk * .7));

    ctx.restore();
  }

  /* ============================================================
     PUPA — hunched, glued down by its tail
     ============================================================
     Drawn with the attachment point (tail) at the origin, body
     extending to +x. `prog` 0..1 darkens it as it matures.
     ============================================================ */
  function drawPupa(ctx, o) {
    const s = o.s || 1, prog = o.prog || 0, twitch = o.twitch || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.rotate(twitch * .12);
    const base = mixHex('#f39a2b', '#c9611a', prog * .6);
    const dark = mixHex('#2a1f1b', '#0f0b0a', prog);
    const ring = mixHex('#c86c1a', '#7a3b0c', prog);

    /* body: fat teardrop; head end at +x */
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(6, -18, 34, -20, 44, -6);
    ctx.bezierCurveTo(50, 2, 44, 16, 30, 17);
    ctx.bezierCurveTo(16, 18, 4, 12, 0, 0);
    ctx.closePath();
    const g = ctx.createRadialGradient(24, -6, 2, 22, 0, 30);
    g.addColorStop(0, mixHex('#ffc266', '#e08a2a', prog * .6));
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.stroke();

    /* abdominal ring lines */
    ctx.strokeStyle = ring; ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const x = 4 + i * 6.2;
      ctx.beginPath();
      ctx.moveTo(x, -14 + Math.abs(i - 3) * 1.5);
      ctx.quadraticCurveTo(x - 2.5, 0, x, 13 - Math.abs(i - 3) * 1.4);
      ctx.stroke();
    }
    /* black spots */
    ctx.fillStyle = dark;
    const spots = [[12, -7, 2.4], [12, 7, 2.4], [22, -9, 2.6], [22, 8, 2.6], [31, -6, 2.2], [31, 6, 2.2], [40, -2, 1.8], [40, 3, 1.8]];
    for (const [x, y, r] of spots) { ellipse(ctx, x, y, r, r * .8); ctx.fill(); }
    /* head cap — future ladybug's face tucked under */
    ellipse(ctx, 43, 3, 6, 6.5);
    ctx.fillStyle = dark; ctx.fill();
    /* glossy highlight */
    ellipse(ctx, 20, -9, 12, 3.5, -.25);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
    /* the shed larval skin bunched at the tail */
    ctx.fillStyle = mixHex('#8e8e88', '#6d6d68', prog, .8);
    ellipse(ctx, -2, 2, 5, 4); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     ADULT LADYBUG
     ============================================================ */
  function drawAdult(ctx, o) {
    const s = o.s || 1, sp = o.species;
    const open = o.open || 0, wingPhase = o.wingPhase || 0, walk = o.walk || 0;
    const fresh = o.fresh || 0;               // 1 = just out of the pupa: pale, spotless
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    const bodyCol = mixHex(sp.color, '#f1d97c', fresh);
    const spotCol = sp.spotColor || '#151515';
    const black = mixHex('#141414', '#8a7c5a', fresh * .6);
    const L = 40, W = 32;                  // elytra half-length / half-width

    /* legs (under everything); tucked right in when playing dead or asleep */
    for (let i = 0; i < 3; i++) {
      const ph = walk + i * (TAU / 3);
      const hx = 6 - i * 7;
      const ll = o.tucked ? 5 : 14 + i * 2;
      leg(ctx, hx, 8, 1, ll, o.tucked ? 0 : Math.sin(ph), Math.max(0, Math.cos(ph)), black, 1.8);
      leg(ctx, hx, -8, -1, ll, o.tucked ? 0 : Math.sin(ph + Math.PI), Math.max(0, Math.cos(ph + Math.PI)), black, 1.8);
    }

    /* flight wings (translucent) when open */
    if (open > 0.05) {
      const beat = Math.sin(wingPhase) * .35;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(6, side * 6);
        ctx.rotate(side * (0.55 + beat * .6) * open);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-20, side * 16, -70 * open, side * 30 * open, -78 * open, side * 8 * open);
        ctx.bezierCurveTo(-60 * open, side * -4, -20, side * 2, 0, 0);
        ctx.fillStyle = 'rgba(210,225,240,.42)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,140,170,.45)'; ctx.lineWidth = .8; ctx.stroke();
        /* veins */
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60 * open, side * 12 * open); ctx.stroke();
        ctx.restore();
      }
    }

    /* abdomen visible under open elytra */
    if (open > 0.05) {
      ellipse(ctx, -4, 0, L * .8, W * .7);
      ctx.fillStyle = black; ctx.fill();
    }

    /* elytra: two halves hinged at the front centre */
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(L * .55, 0);
      ctx.rotate(side * open * 0.95);
      ctx.translate(-L * .55, 0);
      /* half-ellipse-ish shell shape, seam along y=0 */
      const shell = () => {
        ctx.beginPath();
        ctx.moveTo(L * .55, 0);
        ctx.bezierCurveTo(L * .55, side * W * .75, L * .05, side * W * 1.05, -L * .35, side * W * .85);
        ctx.bezierCurveTo(-L * .85, side * W * .55, -L * 1.0, side * W * .1, -L * .98, 0);
        ctx.closePath();
      };
      shell();
      const g = ctx.createRadialGradient(-2, side * -W * .35, 3, -4, side * W * .1, W * 1.5);
      g.addColorStop(0, shade(bodyCol.startsWith('#') ? bodyCol : sp.color, 1.25));
      g.addColorStop(.55, bodyCol);
      g.addColorStop(1, shade(sp.color, 0.55));
      ctx.fillStyle = mixHex(sp.color, '#f1d97c', fresh);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = g;
      ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (1 - fresh * .6);
      ctx.fill();
      ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
      /* spots, clipped to the shell */
      const sa = 1 - fresh;
      if (sa > 0.02) {
        ctx.fillStyle = withAlpha(spotCol, sa);
        for (const [sx, sy, r] of sp.spots) {
          if (sx === 0 && side === 1) continue;       // seam spot drawn once
          const px = -sy * L * .78;                   // sy: -1 front .. +1 rear
          const py = side * sx * W * .78;
          ellipse(ctx, px, sx === 0 ? 0 : py, r * W, r * W * .92);
          ctx.fill();
        }
      }
      /* glossy highlight */
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ellipse(ctx, -L * .05, side * -W * .38, L * .32, W * .17, side * .35);
      ctx.fill();
      ctx.restore();
      shell();
      ctx.strokeStyle = shade(sp.color, .45); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    }
    /* seam */
    if (open < .05) {
      ctx.strokeStyle = shade(sp.color, .4); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(L * .5, 0); ctx.lineTo(-L * .95, 0); ctx.stroke();
    }

    /* pronotum (shield behind the head) */
    ctx.beginPath();
    ctx.moveTo(L * .5, -W * .55);
    ctx.bezierCurveTo(L * .95, -W * .5, L * 1.05, W * .5, L * .5, W * .55);
    ctx.lineTo(L * .42, 0);
    ctx.closePath();
    ctx.fillStyle = black; ctx.fill();
    /* pronotum markings */
    if (sp.pronotum === 'patches') {
      ctx.fillStyle = withAlpha('#f4f1e6', 1 - fresh * .3);
      ellipse(ctx, L * .78, -W * .38, 4.5, 3.5); ctx.fill();
      ellipse(ctx, L * .78, W * .38, 4.5, 3.5); ctx.fill();
    } else if (sp.pronotum === 'converge') {
      ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(L * .62, -8); ctx.lineTo(L * .82, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * .62, 8); ctx.lineTo(L * .82, 3); ctx.stroke();
      ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(L * .55, -W * .5); ctx.quadraticCurveTo(L * .95, -W * .5, L * .95, -W * .1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * .55, W * .5); ctx.quadraticCurveTo(L * .95, W * .5, L * .95, W * .1); ctx.stroke();
    } else if (sp.pronotum === 'M') {
      ctx.fillStyle = '#f4f1e6';
      ctx.beginPath();
      ctx.moveTo(L * .5, -W * .5); ctx.lineTo(L * .95, -W * .45); ctx.lineTo(L * .95, W * .45); ctx.lineTo(L * .5, W * .5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = black;
      ctx.beginPath();
      ctx.moveTo(L * .55, -W * .3); ctx.lineTo(L * .9, -W * .22); ctx.lineTo(L * .72, 0); ctx.lineTo(L * .9, W * .22); ctx.lineTo(L * .55, W * .3); ctx.closePath(); ctx.fill();
    } else if (sp.pronotum === 'yellow') {
      ctx.fillStyle = mixHex(sp.color, '#f1d97c', fresh);
      ctx.beginPath();
      ctx.moveTo(L * .52, -W * .5); ctx.bezierCurveTo(L * .9, -W * .48, L * 1.0, W * .48, L * .52, W * .5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = black;
      for (const [x, y] of [[L * .68, -6], [L * .68, 6], [L * .85, 0]]) { ellipse(ctx, x, y, 2.4, 2.2); ctx.fill(); }
    }

    /* head */
    ellipse(ctx, L * 1.0, 0, 6.5, 7.5);
    ctx.fillStyle = black; ctx.fill();
    ctx.fillStyle = withAlpha('#f4f1e6', 1 - fresh * .3);
    ellipse(ctx, L * 1.02, -4.2, 2.2, 2.6); ctx.fill();
    ellipse(ctx, L * 1.02, 4.2, 2.2, 2.6); ctx.fill();
    /* eyes */
    ctx.fillStyle = '#000';
    ellipse(ctx, L * 1.1, -5.5, 1.5, 1.6); ctx.fill();
    ellipse(ctx, L * 1.1, 5.5, 1.5, 1.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ellipse(ctx, L * 1.13, -5.9, .6, .6); ctx.fill();
    ellipse(ctx, L * 1.13, 5.1, .6, .6); ctx.fill();
    /* antennae */
    if (!o.tucked) {
      antenna(ctx, L * 1.1, -3, -1, 9, black, 1.1, Math.sin(walk * .8));
      antenna(ctx, L * 1.1, 3, 1, 9, black, 1.1, Math.cos(walk * .8));
    }
    ctx.restore();
  }

  /* ============================================================
     APHID — a pear with legs
     ============================================================ */
  const APHID_COL = {
    green: { body: '#9bd45c', dark: '#5d8f2e', light: '#d7f0a8' },
    pink: { body: '#f0a6bd', dark: '#b8607e', light: '#ffd9e4' },
    black: { body: '#3c3a3f', dark: '#17161a', light: '#7a7680' },
    yellow: { body: '#e8d26a', dark: '#a89028', light: '#fff3b8' }
  };
  function drawAphid(ctx, o) {
    const s = o.s || 1, c = APHID_COL[o.variant || 'green'];
    const walk = o.walk || 0;
    const grow = o.grow === undefined ? 1 : o.grow;       // nymph → adult size
    ctx.save();
    ctx.scale(s * lerp(.55, 1, grow), s * lerp(.55, 1, grow));
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const legCol = shade(c.dark, .8);
    /* legs */
    for (let i = 0; i < 3; i++) {
      const ph = walk + i * TAU / 3;
      const hx = 3 - i * 3.2;
      leg(ctx, hx, 3, 1, 5.5 + i, Math.sin(ph) * .6, 0, legCol, .9);
      leg(ctx, hx, -3, -1, 5.5 + i, Math.sin(ph + Math.PI) * .6, 0, legCol, .9);
    }
    /* wings for alates */
    if (o.winged) {
      ctx.fillStyle = 'rgba(220,235,250,.55)';
      ctx.strokeStyle = 'rgba(110,130,160,.5)'; ctx.lineWidth = .5;
      for (const side of [-1, 1]) {
        ellipse(ctx, -6, side * 3, 9, 3, side * .18);
        ctx.fill(); ctx.stroke();
      }
    }
    /* body: pear, fat at the back */
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.bezierCurveTo(6, -4, 0, -6.5, -4, -6.2);
    ctx.bezierCurveTo(-9, -5.5, -9, 5.5, -4, 6.2);
    ctx.bezierCurveTo(0, 6.5, 6, 4, 6, 0);
    ctx.closePath();
    const g = ctx.createRadialGradient(-3, -2, 1, -3, 0, 8);
    g.addColorStop(0, c.light);
    g.addColorStop(.5, c.body);
    g.addColorStop(1, c.dark);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = withAlpha(c.dark, .8); ctx.lineWidth = .7; ctx.stroke();
    /* cornicles — the two little tail-pipes */
    ctx.strokeStyle = c.dark; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -2.5); ctx.lineTo(-10, -3.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 2.5); ctx.lineTo(-10, 3.5); ctx.stroke();
    /* cauda */
    ctx.beginPath(); ctx.moveTo(-8.5, 0); ctx.lineTo(-10.5, 0); ctx.stroke();
    /* head */
    ellipse(ctx, 6, 0, 2.6, 2.4);
    ctx.fillStyle = c.body; ctx.fill(); ctx.strokeStyle = withAlpha(c.dark, .8); ctx.lineWidth = .6; ctx.stroke();
    /* red eyes */
    ctx.fillStyle = '#b0271f';
    ellipse(ctx, 6.6, -1.9, .8, .8); ctx.fill();
    ellipse(ctx, 6.6, 1.9, .8, .8); ctx.fill();
    /* antennae — long, swept back */
    ctx.strokeStyle = legCol; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(7, -1.5); ctx.quadraticCurveTo(4, -7, -2, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, 1.5); ctx.quadraticCurveTo(4, 7, -2, 9); ctx.stroke();
    /* proboscis into the stem */
    ctx.strokeStyle = c.dark; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(6.5, 0); ctx.lineTo(3, 1.5); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     ANT — aphid bodyguard
     ============================================================ */
  function drawAnt(ctx, o) {
    const s = o.s || 1, walk = o.walk || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const body = '#3a2417', dark = '#1c100a', hi = '#6b4530';
    /* legs on thorax */
    for (let i = 0; i < 3; i++) {
      const ph = walk + i * TAU / 3;
      const hx = 4 - i * 3.5;
      leg(ctx, hx, 2.5, 1, 9 + i * 1.5, Math.sin(ph), Math.max(0, Math.cos(ph)), dark, 1.1);
      leg(ctx, hx, -2.5, -1, 9 + i * 1.5, Math.sin(ph + Math.PI), Math.max(0, Math.cos(ph + Math.PI)), dark, 1.1);
    }
    const seg = (x, rx, ry) => {
      ellipse(ctx, x, 0, rx, ry);
      const g = ctx.createRadialGradient(x - rx * .2, -ry * .35, .5, x, 0, rx * 1.3);
      g.addColorStop(0, hi); g.addColorStop(.6, body); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = .7; ctx.stroke();
    };
    seg(-11, 7.5, 5.2);        // gaster
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 0); ctx.stroke();   // petiole
    seg(2, 6, 3.4);            // thorax
    seg(11, 4.2, 4.0);         // head
    /* mandibles */
    ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    const op = .6 + (o.bite || 0) * .8;
    ctx.beginPath(); ctx.moveTo(14, -2); ctx.quadraticCurveTo(18, -3 * op, 18.5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, 2); ctx.quadraticCurveTo(18, 3 * op, 18.5, 0); ctx.stroke();
    /* eyes */
    ctx.fillStyle = '#000';
    ellipse(ctx, 12.5, -2.8, 1, 1); ctx.fill();
    ellipse(ctx, 12.5, 2.8, 1, 1); ctx.fill();
    /* elbowed antennae */
    ctx.strokeStyle = dark; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(13.5, -1.5); ctx.lineTo(17, -6); ctx.lineTo(22, -7 + Math.sin(walk) * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13.5, 1.5); ctx.lineTo(17, 6); ctx.lineTo(22, 7 + Math.cos(walk) * 1.5); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     EGGS — a cluster of tiny yellow footballs standing on end
     ============================================================ */
  function drawEggCluster(ctx, o) {
    const s = o.s || 1, n = o.count || 12;
    const hatched = o.hatched || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const rng = mulberry32(o.seed || 7);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 11;
      pts.push([Math.cos(a) * r * 1.3, Math.sin(a) * r, rng()]);
    }
    pts.sort((p, q) => p[1] - q[1]);
    for (const [x, y, k] of pts) {
      const isHatched = k < hatched;
      ellipse(ctx, x, y, 2.6, 4.2, (k - .5) * .5);
      if (isHatched) {
        ctx.fillStyle = 'rgba(240,235,215,.55)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,150,120,.6)'; ctx.lineWidth = .5; ctx.stroke();
      } else {
        const g = ctx.createRadialGradient(x - .8, y - 1.5, .3, x, y, 4.5);
        g.addColorStop(0, '#fff0a8');
        g.addColorStop(.6, '#f6c544');
        g.addColorStop(1, '#d9911c');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(170,110,20,.55)'; ctx.lineWidth = .5; ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ============================================================
     LEAF — cached as a sprite per leaf (veins are expensive)
     ============================================================
     Sprite frame: base of the leaf at the left, tip to the right.
     ============================================================ */
  const leafCache = new Map();
  const LEAF_PAL = [
    { base: '#3f8a2e', tip: '#8fd050', dark: '#2a5f1c', vein: '#c9e89a' },
    { base: '#4a9a34', tip: '#a3dc5c', dark: '#2e6a20', vein: '#d3ee9f' },
    { base: '#3a7f33', tip: '#7bc24a', dark: '#245a1c', vein: '#bfe28e' },
    { base: '#55a13a', tip: '#b7e36a', dark: '#357224', vein: '#dcf3a9' }
  ];
  const AUTUMN_PAL = ['#e0a030', '#d9742a', '#c94a2a', '#e8c040'];

  /* outline half-width at 0..1 along the leaf, per shape */
  function leafWidth(shape, u, Wd) {
    switch (shape) {
      case 'lance': return Wd * .62 * Math.sin(Math.PI * Math.pow(u, .95)) * (1 - u * .05);
      case 'heart': return Wd * 1.05 * Math.sin(Math.PI * Math.pow(u, .55)) * (1 - u * .15) * (u < .08 ? u / .08 : 1);
      default: return Wd * Math.sin(Math.PI * Math.pow(u, .85)) * (1 - u * .1);
    }
  }

  /* season: { key, tint: '#hex', amount: 0..1 } */
  function leafSprite(leaf, season) {
    season = season || { amount: 0 };
    const tb = Math.round((season.amount || 0) * 6);
    const key = `${leaf.shape || 'ovate'}|${leaf.variant}|${Math.round(leaf.size / 4)}|${Math.round(leaf.curl * 8)}|${season.key || ''}|${tb}|${Math.round((leaf.fall || 0) * 3)}`;
    let c = leafCache.get(key);
    if (c) return c;
    const S = 2.2;
    const shape = leaf.shape || 'ovate';
    const L = leaf.size, Wd = leaf.size * .5;
    const cw = Math.ceil((L + 10) * S), ch = Math.ceil((Wd * 2.3 + 12) * S);
    c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.scale(S, S);
    ctx.translate(4, Wd * 1.15 + 6);
    let pal = LEAF_PAL[leaf.variant % LEAF_PAL.length];
    if (season.amount > 0) {
      const tint = season.key === 'autumn' ? AUTUMN_PAL[leaf.variant % 4] : (season.tint || '#8a6a3a');
      const a = season.amount * (season.key === 'autumn' ? (0.5 + (leaf.fall || 0) * .7) : 1);
      pal = { base: mixHex(pal.base, tint, clamp(a, 0, 1)), tip: mixHex(pal.tip, tint, clamp(a * .9, 0, 1)), dark: mixHex(pal.dark, shade(tint, .6), clamp(a, 0, 1)), vein: mixHex(pal.vein, '#f4e0a0', clamp(a, 0, 1)) };
    }
    const curl = leaf.curl;
    const N = 26;
    const serr = shape === 'ovate';
    const outline = [], lower = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = u * L;
      const w = leafWidth(shape, u, Wd) + ((serr && i % 2) ? -Wd * .06 : 0) * (u > .1 && u < .95 ? 1 : 0);
      outline.push([x, -w + curl * x * .25 * u]);
      lower.unshift([x, w + curl * x * .25 * u]);
    }
    const tracePath = () => {
      ctx.beginPath();
      ctx.moveTo(outline[0][0], outline[0][1]);
      for (const p of outline) ctx.lineTo(p[0], p[1]);
      for (const p of lower) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    };
    tracePath();
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, pal.base);
    g.addColorStop(1, pal.tip);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const g2 = ctx.createLinearGradient(0, -Wd, 0, Wd);
    g2.addColorStop(0, 'rgba(255,255,255,.16)');
    g2.addColorStop(.5, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g2;
    ctx.fillRect(-5, -Wd * 1.2 - 8, L + 10, Wd * 2.4 + 16);
    /* veins */
    ctx.strokeStyle = withAlpha(pal.vein, .8);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * .5, curl * L * .08, L * .97, curl * L * .22);
    ctx.stroke();
    ctx.lineWidth = .9;
    const nv = shape === 'lance' ? 9 : 6;
    for (let i = 1; i <= nv; i++) {
      const u = i / (nv + 1);
      const x = u * L * .92;
      const my = curl * x * .25 * u * .5;
      const w = leafWidth(shape, u, Wd) * .9;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, my);
        const fwd = shape === 'lance' ? L * .06 : L * .1;
        ctx.quadraticCurveTo(x + fwd, my + side * w * .5, x + fwd * 1.6, my + side * w + curl * x * .25 * u * side * .5);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ellipse(ctx, L * .45, -Wd * .35, L * .28, Wd * .2, -.15);
    ctx.fill();
    ctx.restore();
    tracePath();
    ctx.strokeStyle = withAlpha(pal.dark, .8);
    ctx.lineWidth = 1;
    ctx.stroke();
    c._ox = 4 * S; c._oy = (Wd * 1.15 + 6) * S; c._S = S;
    leafCache.set(key, c);
    return c;
  }

  function drawLeaf(ctx, leaf, x, y, time, dropShadow, season) {
    const spr = leafSprite(leaf, season);
    const flutter = Math.sin(time * 1.6 + leaf.phase) * .04 + Math.sin(time * 3.1 + leaf.phase * 2) * .015;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(leaf.ang + flutter);
    /* petiole */
    ctx.strokeStyle = '#3f7a2c'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(leaf.petiole, 0); ctx.stroke();
    ctx.translate(leaf.petiole, 0);
    if (dropShadow) {
      ctx.save();
      ctx.globalAlpha = .18;
      ctx.translate(3, 5);
      ctx.drawImage(spr, -spr._ox / spr._S, -spr._oy / spr._S, spr.width / spr._S, spr.height / spr._S);
      ctx.restore();
    }
    ctx.drawImage(spr, -spr._ox / spr._S, -spr._oy / spr._S, spr.width / spr._S, spr.height / spr._S);
    ctx.restore();
  }

  /* ============================================================
     FLOWERS
     ============================================================ */
  function drawFlower(ctx, f, x, y, time) {
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.sin(time * 1.3 + f.phase) * .05;
    ctx.rotate(f.ang + bob);
    const pink = f.hue < .5 ? '#f27aa0' : (f.hue < .8 ? '#f6a2b6' : '#fff0f3');
    const deep = f.hue < .5 ? '#c93d6c' : (f.hue < .8 ? '#d86a8a' : '#f2b7c6');
    if (f.kind === 'umbel') {
      /* milkweed: a dome of tiny pink stars on thin stalks */
      ctx.translate(f.size * .6, 0);
      const rng = mulberry32((f.phase * 1000) | 0);
      ctx.strokeStyle = '#8fc06a'; ctx.lineWidth = 1.2;
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU, r = f.size * (.5 + rng() * .5);
        const px = Math.cos(a) * r * .9, py = Math.sin(a) * r * .75;
        pts.push([px, py, rng()]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(px, py); ctx.stroke();
      }
      for (const [px, py, k] of pts) {
        ctx.fillStyle = k < .5 ? '#f2a6c6' : '#fbd3e2';
        for (let j = 0; j < 5; j++) {
          const a = j / 5 * TAU;
          ellipse(ctx, px + Math.cos(a) * f.size * .11, py + Math.sin(a) * f.size * .11, f.size * .08, f.size * .05, a);
          ctx.fill();
        }
        ctx.fillStyle = '#e07ea6'; ellipse(ctx, px, py, f.size * .05, f.size * .05); ctx.fill();
      }
    } else if (f.kind === 'bean') {
      /* pea-style flower: a big back petal and a folded keel */
      ctx.translate(f.size * .5, 0);
      const purple = f.hue < .5 ? '#f4f0ff' : '#c9a6f0';
      ctx.fillStyle = shade(purple, .9);
      ellipse(ctx, f.size * .3, 0, f.size * .75, f.size * .55); ctx.fill();
      ctx.fillStyle = purple;
      ellipse(ctx, f.size * .5, -f.size * .15, f.size * .45, f.size * .3, -.3); ctx.fill();
      ellipse(ctx, f.size * .5, f.size * .15, f.size * .45, f.size * .3, .3); ctx.fill();
      ctx.fillStyle = '#e8d24a'; ellipse(ctx, f.size * .85, 0, f.size * .12, f.size * .1); ctx.fill();
      ctx.fillStyle = '#4c8536';
      ellipse(ctx, 0, 0, f.size * .2, f.size * .16); ctx.fill();
    } else if (f.kind === 'pod') {
      /* a hanging bean pod */
      ctx.rotate(.6);
      const g = ctx.createLinearGradient(0, -f.size * .3, 0, f.size * .3);
      g.addColorStop(0, '#a6d86a'); g.addColorStop(.5, '#6aa84a'); g.addColorStop(1, '#3f7a2c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(f.size * 1.2, -f.size * .5, f.size * 3.2, -f.size * .3, f.size * 3.6, f.size * .1);
      ctx.bezierCurveTo(f.size * 3.0, f.size * .5, f.size * 1.0, f.size * .5, 0, 0);
      ctx.fill();
      ctx.strokeStyle = '#3a6a28'; ctx.lineWidth = .8; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      for (let i = 1; i <= 4; i++) { ellipse(ctx, f.size * .7 * i, f.size * .05, f.size * .28, f.size * .2); ctx.fill(); }
    } else if (f.kind === 'bud') {
      /* sepals */
      ctx.fillStyle = '#3f8a2e';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(f.size * .8, i * f.size * .55, f.size * 1.4, i * f.size * .2);
        ctx.quadraticCurveTo(f.size * .8, i * f.size * .1, 0, 0);
        ctx.fill();
      }
      ellipse(ctx, f.size * .55, 0, f.size * .6, f.size * .42);
      const g = ctx.createRadialGradient(f.size * .4, -f.size * .15, 1, f.size * .55, 0, f.size * .8);
      g.addColorStop(0, '#9fd85a'); g.addColorStop(.7, '#5aa33a'); g.addColorStop(1, '#3a7a28');
      ctx.fillStyle = g; ctx.fill();
      ellipse(ctx, f.size * 1.0, 0, f.size * .28, f.size * .2);
      ctx.fillStyle = pink; ctx.fill();
    } else {
      /* rose: rings of petals around the tip */
      ctx.translate(f.size * .9, 0);
      const rings = [[f.size, 7, 0], [f.size * .7, 6, .4], [f.size * .42, 5, .9]];
      /* sepals peeking out behind */
      ctx.fillStyle = '#3a7f2c';
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * f.size * .55, Math.sin(a) * f.size * .55, f.size * .55, f.size * .18, a, 0, TAU);
        ctx.fill();
      }
      for (const [r, n, rot] of rings) {
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rot + time * 0.0;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(r * .1, 0);
          ctx.bezierCurveTo(r * .5, -r * .55, r * 1.05, -r * .35, r * .98, 0);
          ctx.bezierCurveTo(r * 1.05, r * .35, r * .5, r * .55, r * .1, 0);
          const g = ctx.createLinearGradient(0, 0, r, 0);
          g.addColorStop(0, deep); g.addColorStop(.6, pink); g.addColorStop(1, shade(pink, 1.1));
          ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = withAlpha(deep, .5); ctx.lineWidth = .8; ctx.stroke();
          ctx.restore();
        }
      }
      ellipse(ctx, 0, 0, f.size * .16, f.size * .16);
      ctx.fillStyle = '#f7d54a'; ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================
     BIRD — a shadow with wings, seen from below
     ============================================================ */
  function drawBird(ctx, o) {
    const s = o.s || 1, flap = Math.sin(o.phase || 0);
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.fillStyle = o.col || '#1d2530';
    ellipse(ctx, 0, 0, 26, 9); ctx.fill();
    ellipse(ctx, 26, -1, 8, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(32, -2); ctx.lineTo(42, 0); ctx.lineTo(32, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-44, -7); ctx.lineTo(-40, 0); ctx.lineTo(-44, 7); ctx.closePath(); ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-4, side * 4);
      ctx.bezierCurveTo(6, side * (30 + flap * 12), 22, side * (48 + flap * 16), 8, side * (52 + flap * 14));
      ctx.bezierCurveTo(-6, side * (54 + flap * 12), -22, side * 30, -16, side * 6);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* SCALE INSECT — a little brown limpet on a woody stem */
  function drawScale(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-1, -1.5, .5, 0, 0, 6);
    g.addColorStop(0, '#c99a6a'); g.addColorStop(.6, '#8a5a34'); g.addColorStop(1, '#4a2e18');
    ctx.fillStyle = g;
    ellipse(ctx, 0, 0, 6, 4.2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,.6)'; ctx.lineWidth = .6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ellipse(ctx, -1.5, -1.5, 2.2, 1.2); ctx.fill();
    ctx.restore();
  }

  /* HONEYDEW — an amber droplet */
  function drawHoneydew(ctx, r = 2.2) {
    const g = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(.6, '#f2c54a'); g.addColorStop(1, '#c98a1a');
    ctx.fillStyle = g;
    ellipse(ctx, 0, 0, r, r * 1.15); ctx.fill();
  }

  /* SNOW CAP on a stem point */
  function drawSnowCap(ctx, w) {
    ctx.fillStyle = 'rgba(245,250,255,.92)';
    ellipse(ctx, 0, -w * .35, w * .9, w * .38); ctx.fill();
  }

  /* ============================================================
     SHED SKIN (exuvia) — a pale ghost of the larva left behind
     ============================================================ */
  function drawExuvia(ctx, o) {
    drawLarva(ctx, { s: o.s, instar: o.instar, pale: 1, alpha: (o.alpha === undefined ? .8 : o.alpha), walk: 1.2, chew: .2 });
  }

  /* Little lifecycle icons for the HUD, rendered into small canvases. */
  function icon(kind, species, px = 44) {
    const c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.translate(px / 2, px / 2);
    switch (kind) {
      case 'egg': drawEggCluster(ctx, { s: px / 34, count: 9, seed: 3 }); break;
      case 'L1': ctx.rotate(-.5); drawLarva(ctx, { s: px / 130, instar: 1 }); break;
      case 'L2': ctx.rotate(-.5); drawLarva(ctx, { s: px / 115, instar: 2 }); break;
      case 'L3': ctx.rotate(-.5); drawLarva(ctx, { s: px / 100, instar: 3 }); break;
      case 'L4': ctx.rotate(-.5); drawLarva(ctx, { s: px / 88, instar: 4 }); break;
      case 'pupa': ctx.rotate(-1.2); ctx.translate(-px * .28, px * .1); drawPupa(ctx, { s: px / 78, prog: .5 }); break;
      case 'adult': ctx.rotate(-Math.PI / 2); drawAdult(ctx, { s: px / 105, species }); break;
    }
    return c;
  }

  return { drawLarva, drawPupa, drawAdult, drawAphid, drawAnt, drawEggCluster, drawLeaf, leafSprite, drawFlower, drawExuvia, drawBird, drawScale, drawHoneydew, drawSnowCap, icon, ellipse };
})();
