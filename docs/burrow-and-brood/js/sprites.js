/* ============================================================
   sprites.js — everything in the kingdom, drawn by hand in code
   ============================================================
   ANTS are drawn from the SIDE, like an ant farm seen through the
   glass: local frame with the head toward +x, the back toward -y
   and the feet on the ground at about y = +9 (scale 1).  Callers
   translate to the ant's body centre and rotate to its heading.

   The aphid, the ladybug larva, the adult ladybug, leaves and
   flowers are the same drawings as Ladybug Life (seen from above,
   head +x), so the two games share one garden.
   ============================================================ */
'use strict';

const Sprites = (function () {

  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU);
  }

  /* ============================================================
     THE ANT (side view)
     ============================================================
     o: { s, sp (species), caste: 'worker'|'queen'|'alate'|'male',
          walk (phase), bite 0..1, carry (kind|null), crop 0..1,
          callow 0..1 (pale when new), wings 0..1, flap, tilt, alpha,
          job (colour ring), dig 0..1 (head bobbing) } */
  function drawAnt(ctx, o) {
    const sp = o.sp || SPECIES.garden;
    const caste = o.caste || 'worker';
    const s = (o.s || 1) * (sp.size || 1);
    const walk = o.walk || 0, callow = o.callow || 0;
    const queen = caste === 'queen' || caste === 'alate', male = caste === 'male';
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const pale = (c) => callow > .01 ? mixHex(c, '#d8b27a', callow * .8) : c;
    const head = pale(sp.head), gaster = pale(sp.gaster), legs = pale(sp.legs), hi = pale(sp.hi);
    const dark = shade(sp.legs.startsWith('#') ? sp.legs : '#1a1413', .6);

    /* proportions per caste */
    const G = queen ? { x: -17, y: -2, rx: 15, ry: 10.5, rot: .18 } : male ? { x: -12, y: -3, rx: 8.5, ry: 5.2, rot: .2 } : { x: -12, y: -2.5, rx: 9 + (o.crop || 0) * 2.4, ry: 7 + (o.crop || 0) * 2, rot: .22 };
    const T = queen ? { x0: -4, x1: 11, top: -10, bot: 1.5 } : male ? { x0: -3, x1: 9, top: -8.5, bot: .5 } : { x0: -3, x1: 9.5, top: -7.5, bot: .5 };
    const H = { x: queen ? 16 : 13.5, y: queen ? -6 : -5, rx: (sp.bigHead && !male ? 6.4 : 5.2) * (male ? .78 : 1), ry: (sp.bigHead && !male ? 5.4 : 4.4) * (male ? .8 : 1) };
    const legLen = queen ? 11 : male ? 9 : 9.5;
    const footY = legLen;

    /* wings (alates and males), behind the body */
    const wings = o.wings !== undefined ? o.wings : (caste === 'alate' || male) ? 1 : 0;
    const drawWings = (front) => {
      if (wings < .02) return;
      const flap = o.flap || 0;
      ctx.save();
      ctx.globalAlpha *= wings;
      ctx.translate(T.x0 + 5, T.top + 1);
      ctx.rotate(-.18 + Math.sin(flap) * .9 * (o.flying ? 1 : 0) + (front ? 0 : -.12));
      const L = queen ? 40 : 30;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-L * .3, -L * .22, -L * .85, -L * .2, -L, -L * .05);
      ctx.bezierCurveTo(-L * .9, L * .08, -L * .4, L * .08, 0, 0);
      ctx.fillStyle = front ? 'rgba(225,235,250,.42)' : 'rgba(200,210,230,.32)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,150,.55)'; ctx.lineWidth = .5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-L * .7, -L * .12); ctx.moveTo(-L * .3, -L * .08); ctx.lineTo(-L * .55, L * .02); ctx.stroke();
      ctx.fillStyle = 'rgba(90,70,50,.5)'; ellipse(ctx, -L * .42, -L * .13, 1.2, .8); ctx.fill();
      ctx.restore();
    };
    drawWings(false);

    /* one leg: hip → knee → foot; far-side legs are drawn behind the body, darker */
    const leg = (hx, kneeX, footX, phase, far) => {
      const sw = Math.sin(phase), lift = Math.max(0, Math.cos(phase));
      const kx = hx + kneeX + sw * 2.2, ky = -1.5 - lift * 1.5 + (far ? -.5 : 0);
      const fx = hx + footX + sw * 5.5, fy = footY - lift * 2.6;
      ctx.strokeStyle = far ? shade(legs.startsWith('#') ? legs : '#1a1413', .7) : legs;
      ctx.lineWidth = far ? 1.1 : 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(hx, T.bot - 1); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      /* tarsus: a little foot pointing back */
      ctx.lineWidth = far ? .8 : 1;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 2.2, fy + .6); ctx.stroke();
    };
    const hips = [T.x1 - 2, (T.x0 + T.x1) / 2, T.x0 + 1.5];
    const knees = [4.5, 0, -4.5], feet = [6.5, -.5, -7.5];
    /* tripod gait: near front+hind with far middle, then the other three */
    for (let k = 0; k < 3; k++) leg(hips[k], knees[k] * (queen ? 1.2 : 1), feet[k] * (queen ? 1.25 : 1), walk + (k === 1 ? Math.PI : 0) + Math.PI, true);

    /* the far antenna, behind the head */
    const antenna = (far) => {
      /* elbowed: the long scape goes up and forward from the face, then the
         feeler (funiculus) bends down in front of the jaws */
      const wav = Math.sin(walk * .6 + (far ? 1.3 : 0)) * 1.4 + (o.tap ? Math.sin(o.tap * 30) * 2.2 : 0);
      const bx = H.x + H.rx * .35, by = H.y - H.ry * .55;
      const ex = bx + (male ? 3 : 4.2) + (far ? -.8 : 0), ey = by - (male ? 5 : 6.5);
      const tx = ex + (male ? 6 : 7.5), ty = ey + (male ? 6 : 8.5) + wav;
      ctx.strokeStyle = far ? dark : legs; ctx.lineWidth = far ? .8 : 1.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.quadraticCurveTo(ex + 4.5, ey + 1 + wav * .3, tx, ty); ctx.stroke();
      ctx.fillStyle = far ? dark : legs; ellipse(ctx, tx, ty, 1.1, .8, .5); ctx.fill();
    };
    antenna(true);

    /* GASTER */
    const g = ctx.createRadialGradient(G.x + G.rx * .1, G.y - G.ry * .45, 1, G.x, G.y, G.rx * 1.2);
    g.addColorStop(0, hi); g.addColorStop(.45, gaster); g.addColorStop(1, shade(gaster.startsWith('#') ? gaster : '#231c1a', .55));
    ellipse(ctx, G.x, G.y, G.rx, G.ry, G.rot);
    ctx.fillStyle = g; ctx.fill();
    /* crop full of honeydew: amber windows between the plates */
    if ((o.crop || 0) > .05 && !queen) {
      /* a replete glow: the stretched skin between the plates lets the honey show */
      const rg = ctx.createRadialGradient(G.x - G.rx * .1, G.y + G.ry * .15, 1, G.x, G.y, G.rx);
      rg.addColorStop(0, `rgba(255,200,80,${.55 * o.crop})`); rg.addColorStop(1, 'rgba(255,170,40,0)');
      ellipse(ctx, G.x, G.y, G.rx, G.ry, G.rot); ctx.fillStyle = rg; ctx.fill();
    }
    /* segment bands */
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = .7;
    for (let k = 1; k <= 3; k++) {
      const bx = G.x + G.rx * (.55 - k * .32);
      ctx.beginPath(); ctx.ellipse(bx, G.y, G.rx * .18, G.ry * .92, G.rot, -Math.PI / 2 - .2, Math.PI / 2 + .2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ellipse(ctx, G.x + G.rx * .15, G.y - G.ry * .5, G.rx * .45, G.ry * .18, G.rot - .1); ctx.fill();
    if (sp.spines && !queen) { ctx.strokeStyle = gaster; ctx.lineWidth = .8; for (const k of [-.3, .2]) { ctx.beginPath(); ctx.moveTo(G.x + G.rx * k, G.y - G.ry * .9); ctx.lineTo(G.x + G.rx * k - 1, G.y - G.ry * 1.25); ctx.stroke(); } }

    /* PETIOLE (the waist) */
    ctx.fillStyle = head;
    ellipse(ctx, T.x0 - 1.8, -3.4, 2.1, 2.9); ctx.fill();
    ctx.fillStyle = hi; ellipse(ctx, T.x0 - 2.2, -4.6, .9, 1.1); ctx.fill();

    /* THORAX (mesosoma) */
    ctx.beginPath();
    ctx.moveTo(T.x0, T.bot - 1.5);
    ctx.bezierCurveTo(T.x0 - .5, T.top * .45, T.x0 + 2, T.top * .75, T.x0 + (T.x1 - T.x0) * .45, T.top * .8);
    ctx.bezierCurveTo(T.x0 + (T.x1 - T.x0) * .7, T.top * 1.08, T.x1 - .5, T.top * 1.02, T.x1 + .6, T.top * .5);
    ctx.bezierCurveTo(T.x1 + 1, T.top * .15, T.x1 - .5, T.bot, T.x1 - 2, T.bot);
    ctx.lineTo(T.x0 + 1, T.bot);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, T.top, 0, T.bot);
    tg.addColorStop(0, hi); tg.addColorStop(.4, head); tg.addColorStop(1, shade(head.startsWith('#') ? head : '#2b2220', .6));
    ctx.fillStyle = tg; ctx.fill();
    if (sp.spines && !queen && !male) { ctx.strokeStyle = head; ctx.lineWidth = 1; for (const [x, a] of [[T.x0 + 3, -2.2], [T.x1 - 2, -1.2]]) { ctx.beginPath(); ctx.moveTo(x, T.top * .75); ctx.lineTo(x + Math.cos(a) * 3.5, T.top * .75 + Math.sin(a) * 3.5); ctx.stroke(); } }
    if (queen && wings < .5) {       /* wing scars where she snapped them off */
      ctx.fillStyle = 'rgba(40,25,15,.7)';
      ellipse(ctx, T.x0 + 5, T.top * .85, 1.3, .9); ctx.fill(); ellipse(ctx, T.x0 + 8.5, T.top * .95, 1.2, .8); ctx.fill();
    }

    /* HEAD */
    ctx.save();
    ctx.translate(H.x, H.y); ctx.rotate(-.28 + (o.dig || 0) * .35 * Math.sin(walk * 3));
    const hg = ctx.createRadialGradient(-H.rx * .2, -H.ry * .5, .5, 0, 0, H.rx * 1.3);
    hg.addColorStop(0, hi); hg.addColorStop(.5, head); hg.addColorStop(1, shade(head.startsWith('#') ? head : '#2b2220', .55));
    ellipse(ctx, 0, 0, H.rx, H.ry); ctx.fillStyle = hg; ctx.fill();
    /* mandibles: two curved blades, open when biting or carrying */
    const open = clamp((o.bite || 0) + (o.carry ? .45 : 0), 0, 1.2);
    ctx.fillStyle = shade(head.startsWith('#') ? head : '#2b2220', .75); ctx.strokeStyle = dark; ctx.lineWidth = .5;
    for (const k of [1, -1]) {
      ctx.save(); ctx.translate(H.rx * .75, H.ry * .45); ctx.rotate(k * open * .45 + .15);
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(4.5, -1.6, 5.6, 1.4); ctx.quadraticCurveTo(3.8, .4, 0, 1.2); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    /* eye */
    const eyeR = male ? 2.3 : queen ? 1.6 : 1.35;
    ctx.fillStyle = '#0c0a09'; ellipse(ctx, H.rx * .3, -H.ry * .25, eyeR * 1.1, eyeR); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ellipse(ctx, H.rx * .3 + .4, -H.ry * .25 - .5, eyeR * .35, eyeR * .3); ctx.fill();
    if (queen || male) { ctx.fillStyle = '#0c0a09'; for (const [x, y] of [[-.5, -H.ry * .85], [.8, -H.ry * .9], [1.9, -H.ry * .8]]) { ellipse(ctx, x, y, .5, .5); ctx.fill(); } }
    ctx.restore();

    /* the thing in her jaws */
    if (o.carry) drawCarried(ctx, o.carry, H.x + H.rx + 3.5, H.y + H.ry * .9, o);

    /* near-side legs and antenna, over the body */
    for (let k = 0; k < 3; k++) leg(hips[k] + .3, knees[k] * (queen ? 1.2 : 1), feet[k] * (queen ? 1.25 : 1), walk + (k === 1 ? Math.PI : 0), false);
    antenna(false);
    drawWings(true);
    ctx.restore();
  }

  /* what an ant can hold in her mandibles */
  function drawCarried(ctx, kind, x, y, o) {
    ctx.save(); ctx.translate(x, y);
    switch (kind) {
      case 'soil': case 'sand': case 'clay': {
        const col = kind === 'sand' ? '#d8b878' : kind === 'clay' ? '#a8604a' : '#7a5234';
        const g = ctx.createRadialGradient(-1.5, -1.5, .5, 0, 0, 5.5);
        g.addColorStop(0, shade(col, 1.35)); g.addColorStop(1, shade(col, .7));
        ctx.fillStyle = g; ellipse(ctx, 1.5, 0, 5.2, 4.6); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)'; for (const [a, b] of [[0, -1], [3, 1.5], [1, 2.2]]) { ellipse(ctx, a, b, .6, .6); ctx.fill(); }
        break;
      }
      case 'seed': ctx.rotate(.4); drawSeed(ctx, { s: .8 }); break;
      case 'crumb': drawCrumb(ctx, { s: .7 }); break;
      case 'leaf': ctx.translate(-2, -10); ctx.rotate(-.5); drawLeafBit(ctx, { s: .9 }); break;
      case 'bug': ctx.translate(4, 1); drawDeadBug(ctx, { s: .35 }); break;
      case 'egg': drawEggs(ctx, { s: .9, count: 4, seed: 5 }); break;
      case 'larva': ctx.translate(3, 1); drawBroodLarva(ctx, { s: .55, grow: .6 }); break;
      case 'pupa': ctx.translate(5, 1); ctx.rotate(.2); drawCocoon(ctx, { s: .55 }); break;
      case 'aphid': ctx.translate(3, 0); ctx.rotate(-.6); drawAphid(ctx, { s: .75, variant: (o && o.aphidVariant) || 'green' }); break;
      case 'queen': break;
    }
    ctx.restore();
  }

  /* ============================================================
     BROOD — eggs, larvae (grubs) and cocoons
     ============================================================ */
  function drawEggs(ctx, o) {
    const s = o.s || 1, n = o.count || 5;
    ctx.save(); ctx.scale(s, s);
    const rng = mulberry32(o.seed || 3);
    const pts = [];
    for (let i = 0; i < n; i++) { const a = rng() * TAU, r = Math.sqrt(rng()) * 3.2; pts.push([Math.cos(a) * r * 1.3, Math.sin(a) * r * .8, rng()]); }
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, k] of pts) {
      const g = ctx.createRadialGradient(x - .6, y - .6, .2, x, y, 2.6);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#f4efe0'); g.addColorStop(1, '#d8cfb4');
      ctx.fillStyle = g; ellipse(ctx, x, y, 1.6, 2.3, (k - .5) * 1.2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,130,90,.45)'; ctx.lineWidth = .3; ctx.stroke();
    }
    ctx.restore();
  }
  /* a legless white grub, curled in a C; grow 0..1 */
  function drawBroodLarva(ctx, o) {
    const s = (o.s || 1) * lerp(.55, 1.15, clamp(o.grow || 0, 0, 1));
    ctx.save(); ctx.scale(s, s);
    const wig = Math.sin((o.t || 0) * 3) * .08;
    const N = 9, pts = [];
    for (let i = 0; i < N; i++) {
      const a = lerp(-2.3, .55, i / (N - 1)) + wig * i / N;
      const r = 6;
      pts.push([Math.cos(a) * r, Math.sin(a) * r * .85 + 1, lerp(2.2, 4.4, Math.sin(Math.PI * i / (N - 1)) * .8 + .2 * (i / N))]);
    }
    /* body segments, tail first */
    for (let i = 0; i < N; i++) {
      const [x, y, w] = pts[i];
      const g = ctx.createRadialGradient(x - w * .3, y - w * .4, .2, x, y, w * 1.2);
      g.addColorStop(0, '#fffdf6'); g.addColorStop(.6, '#f2ead6'); g.addColorStop(1, '#cfc2a0');
      ctx.fillStyle = g; ellipse(ctx, x, y, w, w * .92); ctx.fill();
    }
    /* food inside the gut shows through */
    if (o.fed > 0) { ctx.fillStyle = `rgba(150,110,40,${.25 * clamp(o.fed, 0, 1)})`; for (let i = 2; i < N - 2; i++) { ellipse(ctx, pts[i][0], pts[i][1], pts[i][2] * .45, pts[i][2] * .35); ctx.fill(); } }
    const [hx, hy] = pts[0];
    ctx.fillStyle = '#e8d8b0'; ellipse(ctx, hx - .8, hy - 1, 2, 1.8); ctx.fill();
    ctx.fillStyle = '#a07a40'; ellipse(ctx, hx - 1.8, hy - 1.4, .5, .5); ctx.fill();
    ctx.restore();
  }
  /* a silk cocoon; near the end the pupa inside shows as a shadow */
  function drawCocoon(ctx, o) {
    const s = o.s || 1, prog = o.prog || 0;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, '#f2dfb2'); g.addColorStop(.5, '#dcbd84'); g.addColorStop(1, '#a88450');
    ctx.fillStyle = g; ellipse(ctx, 0, 0, 10, 5.2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = .5;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(k * 3.2, 0, 1.2, 5, 0, 0, TAU); ctx.stroke(); }
    if (prog > .4) { ctx.globalAlpha *= (prog - .4) * .8; ctx.fillStyle = '#4a3020'; ellipse(ctx, 2, 0, 5.5, 2.4); ctx.fill(); ellipse(ctx, -4, .5, 3.4, 2.6); ctx.fill(); ctx.globalAlpha /= Math.max(.01, (prog - .4) * .8); }
    ctx.fillStyle = '#3a2618'; ellipse(ctx, -9.4, .8, 1.3, 1.6); ctx.fill();   /* the dark spot at the end */
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ellipse(ctx, 1, -2.6, 6, 1.2); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     FOOD
     ============================================================ */
  function drawSeed(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.bezierCurveTo(-6, -5, 4, -5.5, 7, 0); ctx.bezierCurveTo(4, 5.5, -6, 5, -7, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#5a4636'); g.addColorStop(.5, '#3a2c22'); g.addColorStop(1, '#241a14');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(235,225,200,.8)'; ctx.lineWidth = .9;
    for (const y of [-2.6, 0, 2.6]) { ctx.beginPath(); ctx.moveTo(-7, y * .6); ctx.quadraticCurveTo(0, y * 1.1, 7, y * .2); ctx.stroke(); }
    ctx.restore();
    /* the ant snack (elaiosome) */
    ctx.fillStyle = '#f2e6b8'; ellipse(ctx, -7.2, 0, 1.8, 1.6); ctx.fill();
    ctx.restore();
  }
  function drawCrumb(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-6, -4); ctx.lineTo(1, -6); ctx.lineTo(7, -2); ctx.lineTo(8, 4); ctx.lineTo(0, 6); ctx.closePath();
    const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#f0c47a'); g.addColorStop(1, '#b8803e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,20,.5)'; ctx.lineWidth = .6; ctx.stroke();
    ctx.fillStyle = '#4a2a14'; for (const [x, y, r] of [[-3, 0, 1.6], [3, -2, 1.3], [2.5, 3, 1.1]]) { ellipse(ctx, x, y, r, r * .85); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (const [x, y] of [[-4, -2], [5, 1]]) { ellipse(ctx, x, y, .6, .6); ctx.fill(); }
    ctx.restore();
  }
  function drawLeafBit(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-6, 2); ctx.quadraticCurveTo(-7, -6, -1, -10); ctx.lineTo(6, -6); ctx.quadraticCurveTo(8, 2, 0, 8); ctx.closePath();
    const g = ctx.createLinearGradient(-6, -8, 6, 8); g.addColorStop(0, '#a3dc5c'); g.addColorStop(1, '#3f8a2e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#d3ee9f'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, -8); ctx.stroke();
    ctx.restore();
  }
  /* a dead beetle, on its back: too big for one ant */
  function drawDeadBug(ctx, o) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const [x, a] of [[-12, -1.9], [0, -1.6], [12, -1.2]]) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x + Math.cos(a) * 10, -8 + Math.sin(a) * 12); ctx.lineTo(x + Math.cos(a) * 10 + 5, -8 + Math.sin(a) * 12 - 4); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -14, 0, 12);
    g.addColorStop(0, '#5a7a9a'); g.addColorStop(.5, '#2a3a5a'); g.addColorStop(1, '#141a2a');
    ctx.fillStyle = g; ellipse(ctx, 0, 0, 24, 12); ctx.fill();
    ctx.fillStyle = '#1a2030'; ellipse(ctx, 25, 2, 7, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(160,200,230,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-20, -2); ctx.quadraticCurveTo(0, -12, 20, -3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ellipse(ctx, -4, -6, 10, 2.5, -.1); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     THE GARDEN BITS (same drawings as Ladybug Life)
     ============================================================ */
  function topLeg(ctx, hx, hy, side, len, swing, lift, col, thick) {
    const dx = swing * len * .45;
    const kx = hx + dx * .55, ky = hy + side * len * .55;
    const fx = hx + dx, fy = hy + side * len * (1.0 - lift * .25);
    ctx.strokeStyle = col; ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + (swing > 0 ? 1 : -1) * thick * 1.2, fy + side * thick * .8); ctx.stroke();
  }
  function topAntenna(ctx, x, y, side, len, col, thick, wave) {
    ctx.strokeStyle = col; ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * .6, y + side * len * .25 + wave * len * .1, x + len, y + side * len * .55 + wave * len * .2);
    ctx.stroke();
  }

  const APHID_COL = {
    green: { body: '#9bd45c', dark: '#5d8f2e', light: '#d7f0a8' },
    pink: { body: '#f0a6bd', dark: '#b8607e', light: '#ffd9e4' },
    black: { body: '#3c3a3f', dark: '#17161a', light: '#7a7680' },
    yellow: { body: '#e8d26a', dark: '#a89028', light: '#fff3b8' }
  };
  function drawAphid(ctx, o) {
    const s = o.s || 1, c = APHID_COL[o.variant || 'green'];
    const walk = o.walk || 0;
    const grow = o.grow === undefined ? 1 : o.grow;
    ctx.save();
    ctx.scale(s * lerp(.55, 1, grow), s * lerp(.55, 1, grow));
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const legCol = shade(c.dark, .8);
    for (let i = 0; i < 3; i++) {
      const ph = walk + i * TAU / 3, hx = 3 - i * 3.2;
      topLeg(ctx, hx, 3, 1, 5.5 + i, Math.sin(ph) * .6, 0, legCol, .9);
      topLeg(ctx, hx, -3, -1, 5.5 + i, Math.sin(ph + Math.PI) * .6, 0, legCol, .9);
    }
    if (o.winged) {
      ctx.fillStyle = 'rgba(220,235,250,.55)'; ctx.strokeStyle = 'rgba(110,130,160,.5)'; ctx.lineWidth = .5;
      for (const side of [-1, 1]) { ellipse(ctx, -6, side * 3, 9, 3, side * .18); ctx.fill(); ctx.stroke(); }
    }
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.bezierCurveTo(6, -4, 0, -6.5, -4, -6.2);
    ctx.bezierCurveTo(-9, -5.5, -9, 5.5, -4, 6.2);
    ctx.bezierCurveTo(0, 6.5, 6, 4, 6, 0);
    ctx.closePath();
    const g = ctx.createRadialGradient(-3, -2, 1, -3, 0, 8);
    g.addColorStop(0, c.light); g.addColorStop(.5, c.body); g.addColorStop(1, c.dark);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = withAlpha(c.dark, .8); ctx.lineWidth = .7; ctx.stroke();
    ctx.strokeStyle = c.dark; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -2.5); ctx.lineTo(-10, -3.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 2.5); ctx.lineTo(-10, 3.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8.5, 0); ctx.lineTo(-10.5, 0); ctx.stroke();
    ellipse(ctx, 6, 0, 2.6, 2.4);
    ctx.fillStyle = c.body; ctx.fill(); ctx.strokeStyle = withAlpha(c.dark, .8); ctx.lineWidth = .6; ctx.stroke();
    ctx.fillStyle = '#b0271f';
    ellipse(ctx, 6.6, -1.9, .8, .8); ctx.fill();
    ellipse(ctx, 6.6, 1.9, .8, .8); ctx.fill();
    ctx.strokeStyle = legCol; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(7, -1.5); ctx.quadraticCurveTo(4, -7, -2, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, 1.5); ctx.quadraticCurveTo(4, 7, -2, 9); ctx.stroke();
    ctx.strokeStyle = c.dark; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(6.5, 0); ctx.lineTo(3, 1.5); ctx.stroke();
    /* a honeydew drop waiting at the tail */
    if (o.dew > .5) { ctx.save(); ctx.translate(-11.5, 0); drawHoneydew(ctx, 1.4 + (o.dew - .5) * 2.2); ctx.restore(); }
    ctx.restore();
  }

  /* LADYBUG LARVA — the little alligator (Ladybug Life's hero, the ants' pest) */
  function drawLadyLarva(ctx, o) {
    const s = o.s || 1, instar = o.instar || 3;
    const walk = o.walk || 0, chew = o.chew || 0;
    ctx.save();
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const nSeg = 12, totalL = 64;
    const base = '#2d3446', plate = '#414a62', edge = '#141824', spotCol = '#ff9d2f', spotCol2 = '#ffc23a';
    const seg = [];
    for (let i = 0; i < nSeg; i++) {
      const u = i / (nSeg - 1), x = totalL / 2 - u * totalL;
      let w;
      if (i === 0) w = 6.2; else if (i < 4) w = 7.2 + i * .6; else w = lerp(9.4, 2.8, Math.pow((i - 4) / 7, 1.15));
      const wig = Math.sin(walk * 2 - i * .55) * (i > 3 ? (i - 3) * .28 : 0);
      seg.push({ x, y: wig, w, len: totalL / nSeg * 1.15 });
    }
    for (let i = 1; i <= 3; i++) {
      const sg = seg[i], ph = walk + i * (TAU / 3);
      const legLen = 11 + i * 1.2;
      topLeg(ctx, sg.x, sg.y + sg.w * .5, 1, legLen, Math.sin(ph), Math.max(0, Math.cos(ph)), edge, 1.5);
      topLeg(ctx, sg.x, sg.y - sg.w * .5, -1, legLen, Math.sin(ph + Math.PI), Math.max(0, Math.cos(ph + Math.PI)), edge, 1.5);
    }
    for (let i = nSeg - 1; i >= 1; i--) {
      const sg = seg[i];
      ctx.strokeStyle = edge; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      const sp = 2.2 + instar * .5;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sg.x, sg.y + side * sg.w * .8); ctx.lineTo(sg.x - 1.5, sg.y + side * (sg.w * .8 + sp)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sg.x + 1.5, sg.y + side * sg.w * .7); ctx.lineTo(sg.x + 2.6, sg.y + side * (sg.w * .7 + sp * .8)); ctx.stroke();
      }
      ellipse(ctx, sg.x, sg.y, sg.len * .62, sg.w); ctx.fillStyle = base; ctx.fill();
      ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke();
      ellipse(ctx, sg.x + .6, sg.y - sg.w * .2, sg.len * .42, sg.w * .55); ctx.fillStyle = plate; ctx.fill();
      ctx.fillStyle = 'rgba(13,16,25,.35)'; ellipse(ctx, sg.x, sg.y, sg.len * .25, sg.w * .28); ctx.fill();
      const spotHere = (i === 1) || (i === 4) || (i === 7) || (i === 5 && instar >= 4);
      if (spotHere) {
        const r = (i === 1 ? 2.4 : 2.9) * (0.7 + instar * .1);
        for (const side of [-1, 1]) { ellipse(ctx, sg.x, sg.y + side * sg.w * .55, r * 1.1, r); ctx.fillStyle = i === 1 ? spotCol2 : spotCol; ctx.fill(); }
      }
    }
    const hd = seg[0];
    ellipse(ctx, hd.x + 1, hd.y, 6.2, hd.w); ctx.fillStyle = edge; ctx.fill();
    ellipse(ctx, hd.x + .5, hd.y - 1, 4.2, hd.w * .6); ctx.fillStyle = '#2a3040'; ctx.fill();
    ctx.fillStyle = '#0a0c12';
    ellipse(ctx, hd.x + 3.5, hd.y - 4.2, 1.3, 1.3); ctx.fill();
    ellipse(ctx, hd.x + 3.5, hd.y + 4.2, 1.3, 1.3); ctx.fill();
    const openA = .35 + chew * .9;
    ctx.strokeStyle = '#1a1f2b'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hd.x + 5.5, hd.y + side * 2.2); ctx.quadraticCurveTo(hd.x + 9.5, hd.y + side * (2.2 + openA * 3), hd.x + 10.5, hd.y + side * (openA * 1.6)); ctx.stroke(); }
    topAntenna(ctx, hd.x + 5, hd.y - 3.5, -1, 7, edge, 1, Math.sin(walk * .7));
    topAntenna(ctx, hd.x + 5, hd.y + 3.5, 1, 7, edge, 1, Math.cos(walk * .7));
    ctx.restore();
  }

  /* ADULT LADYBUG (a seven-spot, seen from above) — she visits and lays eggs */
  const SEVEN = { color: '#d92c2c', spotColor: '#151515', spots: [[0, -0.72, .13], [.55, -.35, .15], [.78, .28, .14], [.32, .62, .13]] };
  function drawLadybug(ctx, o) {
    const s = o.s || 1, sp = SEVEN, open = o.open || 0, wingPhase = o.wingPhase || 0, walk = o.walk || 0;
    ctx.save(); ctx.scale(s, s);
    const L = 40, W = 32, black = '#141414';
    for (let i = 0; i < 3; i++) {
      const ph = walk + i * (TAU / 3), hx = 6 - i * 7;
      topLeg(ctx, hx, 8, 1, 14 + i * 2, Math.sin(ph), Math.max(0, Math.cos(ph)), black, 1.8);
      topLeg(ctx, hx, -8, -1, 14 + i * 2, Math.sin(ph + Math.PI), Math.max(0, Math.cos(ph + Math.PI)), black, 1.8);
    }
    if (open > .05) {
      const beat = Math.sin(wingPhase) * .35;
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(6, side * 6); ctx.rotate(side * (0.55 + beat * .6) * open);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-20, side * 16, -70 * open, side * 30 * open, -78 * open, side * 8 * open);
        ctx.bezierCurveTo(-60 * open, side * -4, -20, side * 2, 0, 0);
        ctx.fillStyle = 'rgba(210,225,240,.42)'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,140,170,.45)'; ctx.lineWidth = .8; ctx.stroke();
        ctx.restore();
      }
      ellipse(ctx, -4, 0, L * .8, W * .7); ctx.fillStyle = black; ctx.fill();
    }
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(L * .55, 0); ctx.rotate(side * open * 0.95); ctx.translate(-L * .55, 0);
      const shell = () => { ctx.beginPath(); ctx.moveTo(L * .55, 0); ctx.bezierCurveTo(L * .55, side * W * .75, L * .05, side * W * 1.05, -L * .35, side * W * .85); ctx.bezierCurveTo(-L * .85, side * W * .55, -L * 1.0, side * W * .1, -L * .98, 0); ctx.closePath(); };
      shell();
      const g = ctx.createRadialGradient(-2, side * -W * .35, 3, -4, side * W * .1, W * 1.5);
      g.addColorStop(0, shade(sp.color, 1.25)); g.addColorStop(.55, sp.color); g.addColorStop(1, shade(sp.color, .55));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = sp.spotColor;
      for (const [sx, sy, r] of sp.spots) { if (sx === 0 && side === 1) continue; ellipse(ctx, -sy * L * .78, sx === 0 ? 0 : side * sx * W * .78, r * W, r * W * .92); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ellipse(ctx, -L * .05, side * -W * .38, L * .32, W * .17, side * .35); ctx.fill();
      ctx.restore();
      shell(); ctx.strokeStyle = shade(sp.color, .45); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(L * .5, -W * .55); ctx.bezierCurveTo(L * .95, -W * .5, L * 1.05, W * .5, L * .5, W * .55); ctx.lineTo(L * .42, 0); ctx.closePath();
    ctx.fillStyle = black; ctx.fill();
    ctx.fillStyle = '#f4f1e6'; ellipse(ctx, L * .78, -W * .38, 4.5, 3.5); ctx.fill(); ellipse(ctx, L * .78, W * .38, 4.5, 3.5); ctx.fill();
    ellipse(ctx, L * 1.0, 0, 6.5, 7.5); ctx.fillStyle = black; ctx.fill();
    ctx.restore();
  }

  function drawHoneydew(ctx, r = 2.2) {
    const g = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(.6, '#f2c54a'); g.addColorStop(1, '#c98a1a');
    ctx.fillStyle = g;
    ellipse(ctx, 0, 0, r, r * 1.15); ctx.fill();
  }

  /* ---------- leaves (cached sprites) and flowers: from Ladybug Life ---------- */
  const leafCache = new Map();
  const LEAF_PAL = [
    { base: '#3f8a2e', tip: '#8fd050', dark: '#2a5f1c', vein: '#c9e89a' },
    { base: '#4a9a34', tip: '#a3dc5c', dark: '#2e6a20', vein: '#d3ee9f' },
    { base: '#3a7f33', tip: '#7bc24a', dark: '#245a1c', vein: '#bfe28e' },
    { base: '#55a13a', tip: '#b7e36a', dark: '#357224', vein: '#dcf3a9' }
  ];
  const AUTUMN_PAL = ['#e0a030', '#d9742a', '#c94a2a', '#e8c040'];
  function leafWidth(shape, u, Wd) {
    switch (shape) {
      case 'lance': return Wd * .62 * Math.sin(Math.PI * Math.pow(u, .95)) * (1 - u * .05);
      case 'heart': return Wd * 1.05 * Math.sin(Math.PI * Math.pow(u, .55)) * (1 - u * .15) * (u < .08 ? u / .08 : 1);
      default: return Wd * Math.sin(Math.PI * Math.pow(u, .85)) * (1 - u * .1);
    }
  }
  function leafSprite(leaf, season) {
    season = season || { amount: 0 };
    const tb = Math.round((season.amount || 0) * 6);
    const key = `${leaf.shape || 'ovate'}|${leaf.variant}|${Math.round(leaf.size / 4)}|${Math.round(leaf.curl * 8)}|${season.key || ''}|${tb}|${Math.round((leaf.fall || 0) * 3)}|${leaf.bites || 0}`;
    let c = leafCache.get(key);
    if (c) return c;
    const S = 2.2, shape = leaf.shape || 'ovate';
    const L = leaf.size, Wd = leaf.size * .5;
    const cw = Math.ceil((L + 10) * S), ch = Math.ceil((Wd * 2.3 + 12) * S);
    c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.scale(S, S); ctx.translate(4, Wd * 1.15 + 6);
    let pal = LEAF_PAL[leaf.variant % LEAF_PAL.length];
    if (season.amount > 0) {
      const tint = season.key === 'autumn' ? AUTUMN_PAL[leaf.variant % 4] : (season.tint || '#8a6a3a');
      const a = season.amount * (season.key === 'autumn' ? (0.5 + (leaf.fall || 0) * .7) : 1);
      pal = { base: mixHex(pal.base, tint, clamp(a, 0, 1)), tip: mixHex(pal.tip, tint, clamp(a * .9, 0, 1)), dark: mixHex(pal.dark, shade(tint, .6), clamp(a, 0, 1)), vein: mixHex(pal.vein, '#f4e0a0', clamp(a, 0, 1)) };
    }
    const curl = leaf.curl, N = 26, serr = shape === 'ovate';
    const outline = [], lower = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = u * L;
      const w = leafWidth(shape, u, Wd) + ((serr && i % 2) ? -Wd * .06 : 0) * (u > .1 && u < .95 ? 1 : 0);
      outline.push([x, -w + curl * x * .25 * u]);
      lower.unshift([x, w + curl * x * .25 * u]);
    }
    const tracePath = () => { ctx.beginPath(); ctx.moveTo(outline[0][0], outline[0][1]); for (const p of outline) ctx.lineTo(p[0], p[1]); for (const p of lower) ctx.lineTo(p[0], p[1]); ctx.closePath(); };
    tracePath();
    const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, pal.base); g.addColorStop(1, pal.tip);
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const g2 = ctx.createLinearGradient(0, -Wd, 0, Wd);
    g2.addColorStop(0, 'rgba(255,255,255,.16)'); g2.addColorStop(.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g2; ctx.fillRect(-5, -Wd * 1.2 - 8, L + 10, Wd * 2.4 + 16);
    ctx.strokeStyle = withAlpha(pal.vein, .8); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * .5, curl * L * .08, L * .97, curl * L * .22); ctx.stroke();
    ctx.lineWidth = .9;
    const nv = shape === 'lance' ? 9 : 6;
    for (let i = 1; i <= nv; i++) {
      const u = i / (nv + 1), x = u * L * .92, my = curl * x * .25 * u * .5, w = leafWidth(shape, u, Wd) * .9;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, my); const fwd = shape === 'lance' ? L * .06 : L * .1; ctx.quadraticCurveTo(x + fwd, my + side * w * .5, x + fwd * 1.6, my + side * w + curl * x * .25 * u * side * .5); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ellipse(ctx, L * .45, -Wd * .35, L * .28, Wd * .2, -.15); ctx.fill();
    ctx.restore();
    tracePath(); ctx.strokeStyle = withAlpha(pal.dark, .8); ctx.lineWidth = 1; ctx.stroke();
    /* half-moon bites taken by leafcutter ants */
    if (leaf.bites) {
      ctx.globalCompositeOperation = 'destination-out';
      const rng = mulberry32(leaf.id * 31 + 7);
      for (let b = 0; b < leaf.bites; b++) { const u = .35 + rng() * .55, side = rng() < .5 ? -1 : 1; ctx.beginPath(); ctx.arc(u * L, side * leafWidth(shape, u, Wd) * .9, Wd * .32, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    c._ox = 4 * S; c._oy = (Wd * 1.15 + 6) * S; c._S = S;
    leafCache.set(key, c);
    return c;
  }
  function drawLeaf(ctx, leaf, x, y, time, dropShadow, season) {
    const spr = leafSprite(leaf, season);
    const flutter = Math.sin(time * 1.6 + leaf.phase) * .04 + Math.sin(time * 3.1 + leaf.phase * 2) * .015;
    ctx.save(); ctx.translate(x, y); ctx.rotate(leaf.ang + flutter);
    ctx.strokeStyle = '#3f7a2c'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(leaf.petiole, 0); ctx.stroke();
    ctx.translate(leaf.petiole, 0);
    if (dropShadow) { ctx.save(); ctx.globalAlpha = .18; ctx.translate(3, 5); ctx.drawImage(spr, -spr._ox / spr._S, -spr._oy / spr._S, spr.width / spr._S, spr.height / spr._S); ctx.restore(); }
    ctx.drawImage(spr, -spr._ox / spr._S, -spr._oy / spr._S, spr.width / spr._S, spr.height / spr._S);
    ctx.restore();
  }
  function drawFlower(ctx, f, x, y, time) {
    ctx.save(); ctx.translate(x, y);
    ctx.rotate(f.ang + Math.sin(time * 1.3 + f.phase) * .05);
    if (f.kind === 'umbel') {
      ctx.translate(f.size * .6, 0);
      const rng = mulberry32((f.phase * 1000) | 0);
      ctx.strokeStyle = '#8fc06a'; ctx.lineWidth = 1.2;
      const pts = [];
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, r = f.size * (.5 + rng() * .5); const px = Math.cos(a) * r * .9, py = Math.sin(a) * r * .75; pts.push([px, py, rng()]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(px, py); ctx.stroke(); }
      for (const [px, py, k] of pts) {
        ctx.fillStyle = k < .5 ? '#f2a6c6' : '#fbd3e2';
        for (let j = 0; j < 5; j++) { const a = j / 5 * TAU; ellipse(ctx, px + Math.cos(a) * f.size * .11, py + Math.sin(a) * f.size * .11, f.size * .08, f.size * .05, a); ctx.fill(); }
        ctx.fillStyle = '#e07ea6'; ellipse(ctx, px, py, f.size * .05, f.size * .05); ctx.fill();
      }
    } else if (f.kind === 'bean') {
      ctx.translate(f.size * .5, 0);
      const purple = f.hue < .5 ? '#f4f0ff' : '#c9a6f0';
      ctx.fillStyle = shade(purple, .9); ellipse(ctx, f.size * .3, 0, f.size * .75, f.size * .55); ctx.fill();
      ctx.fillStyle = purple;
      ellipse(ctx, f.size * .5, -f.size * .15, f.size * .45, f.size * .3, -.3); ctx.fill();
      ellipse(ctx, f.size * .5, f.size * .15, f.size * .45, f.size * .3, .3); ctx.fill();
      ctx.fillStyle = '#e8d24a'; ellipse(ctx, f.size * .85, 0, f.size * .12, f.size * .1); ctx.fill();
      ctx.fillStyle = '#4c8536'; ellipse(ctx, 0, 0, f.size * .2, f.size * .16); ctx.fill();
    } else if (f.kind === 'pod') {
      ctx.rotate(.6);
      const g = ctx.createLinearGradient(0, -f.size * .3, 0, f.size * .3);
      g.addColorStop(0, '#a6d86a'); g.addColorStop(.5, '#6aa84a'); g.addColorStop(1, '#3f7a2c');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(f.size * 1.2, -f.size * .5, f.size * 3.2, -f.size * .3, f.size * 3.6, f.size * .1);
      ctx.bezierCurveTo(f.size * 3.0, f.size * .5, f.size * 1.0, f.size * .5, 0, 0);
      ctx.fill(); ctx.strokeStyle = '#3a6a28'; ctx.lineWidth = .8; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      for (let i = 1; i <= 4; i++) { ellipse(ctx, f.size * .7 * i, f.size * .05, f.size * .28, f.size * .2); ctx.fill(); }
    } else {
      /* bud */
      const pink = f.hue < .5 ? '#f27aa0' : '#f6a2b6';
      ctx.fillStyle = '#3f8a2e';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(f.size * .8, i * f.size * .55, f.size * 1.4, i * f.size * .2); ctx.quadraticCurveTo(f.size * .8, i * f.size * .1, 0, 0); ctx.fill(); }
      ellipse(ctx, f.size * .55, 0, f.size * .6, f.size * .42);
      const g = ctx.createRadialGradient(f.size * .4, -f.size * .15, 1, f.size * .55, 0, f.size * .8);
      g.addColorStop(0, '#9fd85a'); g.addColorStop(.7, '#5aa33a'); g.addColorStop(1, '#3a7a28');
      ctx.fillStyle = g; ctx.fill();
      ellipse(ctx, f.size * 1.0, 0, f.size * .28, f.size * .2); ctx.fillStyle = pink; ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================
     THE EARTHWORM — a pink tube through its own burrow
     ============================================================ */
  function drawWorm(ctx, pts, t) {
    if (pts.length < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col] of [[9, '#9a4a52'], [7.4, '#d98a8a'], [3, 'rgba(255,220,220,.55)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + (w === 3 ? -1.5 : 0));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1] + (w === 3 ? -1.5 : 0));
      ctx.stroke();
    }
    /* rings and the saddle (clitellum) */
    ctx.strokeStyle = 'rgba(120,50,60,.35)'; ctx.lineWidth = 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [x2, y2] = pts[i + 1];
      const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6); ctx.lineTo(x - Math.cos(a) * 3.6, y - Math.sin(a) * 3.6); ctx.stroke();
    }
    const k = Math.floor(pts.length * .3);
    if (pts[k + 2]) { ctx.strokeStyle = '#c0606a'; ctx.lineWidth = 9.4; ctx.beginPath(); ctx.moveTo(pts[k][0], pts[k][1]); ctx.lineTo(pts[k + 1][0], pts[k + 1][1]); ctx.lineTo(pts[k + 2][0], pts[k + 2][1]); ctx.stroke(); }
  }

  /* ============================================================
     ICONS for the HUD, stickers, reading pictures (fresh canvases)
     ============================================================ */
  function icon(kind, sp, px = 44) {
    const c = document.createElement('canvas');
    c.width = c.height = px * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.translate(px / 2, px / 2);
    drawIcon(ctx, kind, sp || SPECIES.garden, px);
    return c;
  }
  function drawIcon(ctx, kind, sp, px) {
    const k = px / 44;
    switch (kind) {
      case 'queen': ctx.translate(2 * k, 2 * k); drawAnt(ctx, { s: .98 * k, sp, caste: 'queen', walk: 1 }); break;
      case 'alate': ctx.translate(4 * k, 4 * k); drawAnt(ctx, { s: .85 * k, sp, caste: 'alate', walk: 1 }); break;
      case 'male': ctx.translate(2 * k, 2 * k); drawAnt(ctx, { s: 1 * k, sp, caste: 'male', walk: 1 }); break;
      case 'worker': case 'first': ctx.translate(-1 * k, 0); drawAnt(ctx, { s: 1.08 * k, sp, walk: 1 }); break;
      case 'ten': for (const [x, y, s] of [[-8, -8, .6], [9, -4, .6], [-2, 9, .66]]) { ctx.save(); ctx.translate(x * k, y * k); drawAnt(ctx, { s: s * k, sp, walk: x }); ctx.restore(); } break;
      case 'hundred': for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(((i % 3) - 1) * 13 * k, (((i / 3) | 0) - 1) * 12 * k); ctx.scale(i % 2 ? -1 : 1, 1); drawAnt(ctx, { s: .4 * k, sp, walk: i }); ctx.restore(); } break;
      case 'thousand': {
        ctx.fillStyle = '#9a6a42'; ctx.beginPath(); ctx.moveTo(-20 * k, 14 * k); ctx.quadraticCurveTo(0, -24 * k, 20 * k, 14 * k); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a2416'; ellipse(ctx, 0, -2 * k, 3 * k, 2.2 * k); ctx.fill();
        for (let i = 0; i < 7; i++) { ctx.save(); ctx.translate((-14 + i * 4.6) * k, (8 - Math.sin(i / 6 * Math.PI) * 14) * k); drawAnt(ctx, { s: .22 * k, sp, walk: i }); ctx.restore(); }
        break;
      }
      case 'kingdom': {
        ctx.fillStyle = '#f5c531'; ctx.beginPath(); ctx.moveTo(-14 * k, -4 * k); ctx.lineTo(-14 * k, -16 * k); ctx.lineTo(-7 * k, -9 * k); ctx.lineTo(0, -18 * k); ctx.lineTo(7 * k, -9 * k); ctx.lineTo(14 * k, -16 * k); ctx.lineTo(14 * k, -4 * k); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.translate(2 * k, 8 * k); drawAnt(ctx, { s: .7 * k, sp, caste: 'alate', walk: 1 }); ctx.restore();
        break;
      }
      case 'egg': drawEggs(ctx, { s: 3.4 * k, count: 6, seed: 3 }); break;
      case 'larva': drawBroodLarva(ctx, { s: 2.3 * k, grow: .8, fed: .5 }); break;
      case 'pupa': ctx.rotate(-.3); drawCocoon(ctx, { s: 1.8 * k, prog: .6 }); break;
      case 'aphid': ctx.rotate(-.5); drawAphid(ctx, { s: 1.9 * k, variant: 'green', dew: .9 }); break;
      case 'ladylarva': ctx.rotate(-.5); drawLadyLarva(ctx, { s: .55 * k, instar: 3 }); break;
      case 'ladybug': ctx.rotate(-Math.PI / 2); drawLadybug(ctx, { s: .45 * k }); break;
      case 'seed': ctx.rotate(-.4); drawSeed(ctx, { s: 2.2 * k }); break;
      case 'crumb': drawCrumb(ctx, { s: 2 * k }); break;
      case 'bug': drawDeadBug(ctx, { s: .6 * k }); break;
      case 'leafbit': drawLeafBit(ctx, { s: 1.8 * k }); break;
      case 'honeydew': drawHoneydew(ctx, 8 * k); break;
      case 'worm': { const pts = []; for (let i = 0; i < 12; i++) pts.push([-18 + i * 3.4, Math.sin(i * .7) * 6]); ctx.scale(k * .9, k * .9); drawWorm(ctx, pts, 0); break; }
      case 'dirt': ctx.scale(2.6 * k, 2.6 * k); drawCarried(ctx, 'soil', -1.5, 0, {}); break;
    }
  }

  return { drawAnt, drawCarried, drawEggs, drawBroodLarva, drawCocoon, drawSeed, drawCrumb, drawLeafBit, drawDeadBug, drawAphid, drawLadyLarva, drawLadybug, drawHoneydew, drawLeaf, leafSprite, drawFlower, drawWorm, icon, drawIcon, ellipse };
})();
