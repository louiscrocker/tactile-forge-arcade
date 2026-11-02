/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE SEA STAR is drawn lying on the rock, seen a little from above:
   a five-armed star squashed to `tilt` (0.5) so it reads as flat on
   the rock in the side-on view.  The origin is where its middle
   touches the rock; `w` is the width from arm tip to arm tip.  The
   upper side has the net of little white spines, a darker middle
   disc and the sieve plate; a red eyespot sits at each arm tip; tube
   feet show along the lower edge while it crawls.  It can stand tall
   on its arm tips (`arch`, for spawning), curl its arms in (`curl`,
   holding its water when dry), push its stomach out (`stomach`,
   eating a mussel) and have one arm short and regrowing (`short`).

   THE LARVA is a see-through bipinnaria with two bands of beating
   hairs and a green gut; at size three it has three little sticky
   arms at the front (a brachiolaria), with a tiny star showing inside.

   Then plankton, herring, the grey whale, comb jellies, the gull (in
   flight and standing), the sea otter, the red rock crab, the sunflower
   star, bull kelp, surfgrass and rockweed, food on the rocks (baby
   barnacles, barnacles, limpets, turban snails, chitons, mussels),
   empty shells, the new life of the keystone (anemones, barnacles,
   seaweed, limpets, chitons, goose barnacles, urchins, nudibranchs),
   the child tide-pooling, the scientist, and the icons for the HUD,
   the stickers and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);
  const RGB = (c, a) => rgbStr(c, a);

  /* ============================================================
     THE SEA STAR
     ============================================================ */
  /* the outline radius at angle th (in the star's own turn): five rounded arms */
  function starR(th, o, R) {
    const k = ((th % (TAU / 5)) + TAU / 5) % (TAU / 5) - TAU / 10;     /* angle from the nearest arm's middle */
    const arm = Math.round((th - k) / (TAU / 5));
    const c = Math.max(0, Math.cos(k * 2.5));
    const lobe = Math.pow(c, o.thin || 1.25);
    let len = 1 + Math.sin((o.walk || 0) * 2 + arm * 1.7) * (o.moving ? .05 : .015);
    if (o.short && ((arm % 5) + 5) % 5 === 1) len *= 1 - o.short * .45;
    len *= 1 - (o.curl || 0) * .3;
    const valley = .34 + (o.curl || 0) * .08;
    return R * (valley + (1 - valley) * lobe) * len;
  }
  function drawStar(ctx, o) {
    const F = FORMS[o.form] || FORMS.normal, R = (o.w || 40) / 2, tilt = o.face ? .92 : (o.tilt || .5);
    const arch = o.arch || 0, rot = (o.rot || 0) + .31, lift = R * (.08 + arch * .42);
    const pts = [], N = 90;
    for (let i = 0; i < N; i++) {
      const th = i / N * TAU, r = starR(th - rot, o, R), u = r / R;
      /* standing tall: the middle rises, the arm tips stay on the rock */
      const up = Math.pow(1 - u, 1.4) * lift * 1.8 + R * .02;
      pts.push([Math.cos(th) * r, Math.sin(th) * r * tilt - up]);
    }
    ctx.save();
    if (o.spin) ctx.rotate(o.spin);
    /* a soft shadow on the rock */
    if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, R * tilt * .15, R * .95, R * tilt * .45, 0, 0, TAU); ctx.fill(); }
    /* tube feet along the lower edge, reaching for the rock (more while crawling or standing tall) */
    const feetOn = o.feet !== false && (o.moving || arch > .1 || o.grip > .5);
    if (feetOn) {
      ctx.strokeStyle = F.feet; ctx.lineWidth = Math.max(.6, R * .035); ctx.lineCap = 'round';
      for (let i = 0; i < N; i += 3) {
        const [x, y] = pts[i]; if (y < -lift * .6) continue;
        const sw = Math.sin((o.walk || 0) * 6 + i) * R * .03, L = R * (.06 + arch * .03);
        ctx.beginPath(); ctx.moveTo(x * .92, y - R * .02); ctx.lineTo(x * .92 + sw, y + L); ctx.stroke();
        ctx.fillStyle = F.feet; ctx.beginPath(); ctx.arc(x * .92 + sw, y + L, ctx.lineWidth * .9, 0, TAU); ctx.fill();
      }
    }
    /* standing tall shows the pale tube-foot side underneath */
    if (arch > .05) {
      /* the hollow under the raised middle, with the pale tube-foot side showing */
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, R * .5, R * .1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = F.under; ctx.beginPath(); ctx.ellipse(0, -lift * .35, R * .32 * arch + 1, lift * .45, 0, 0, Math.PI); ctx.fill();
    }
    /* the body */
    const g = ctx.createRadialGradient(-R * .2, -lift - R * .15 * tilt, R * .05, 0, -lift * .6, R * 1.05);
    g.addColorStop(0, F.top); g.addColorStop(.55, F.top); g.addColorStop(1, F.top2);
    ctx.fillStyle = g;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(.5, R * .03); ctx.stroke();
    if (o.simple && R < 8) { ctx.restore(); return; }
    /* the raised middle of each arm (a ridge of light), the darker disc */
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = R * .16; ctx.lineCap = 'round';
    for (let a = 0; a < 5; a++) { const th = rot + a * TAU / 5, r = starR(th - rot + .001, o, R) * .82; ctx.beginPath(); ctx.moveTo(0, -lift * 1.6); ctx.lineTo(Math.cos(th) * r, Math.sin(th) * r * tilt - (1 - r / R) * lift * 1.6); ctx.stroke(); }
    ctx.fillStyle = RGB(C(F.top2), .45); ctx.beginPath(); ctx.ellipse(0, -lift * 1.6, R * .3, R * .3 * tilt, 0, 0, TAU); ctx.fill();
    /* the white spines in a net: rows along each arm and rings across them */
    if (R > 5) {
      const rnd = mulberry32(o.seed || 7), dot = Math.max(.5, R * .042);
      ctx.fillStyle = F.spines;
      for (let a = 0; a < 5; a++) {
        const th0 = rot + a * TAU / 5;
        for (let j = 1; j <= 7; j++) {
          const u = j / 8;
          for (const side of [-1, 0, 1]) {
            const th = th0 + side * (.42 - u * .3), r = starR(th0 - rot + .001, o, R) * u;
            if (side && j > 6) continue;
            const x = Math.cos(th) * r, y = Math.sin(th) * r * tilt - (1 - r / R) * lift * 1.6 - lift * .2;
            ctx.globalAlpha = .55 + rnd() * .45;
            ctx.beginPath(); ctx.arc(x + (rnd() - .5) * dot, y + (rnd() - .5) * dot, dot * (.8 + rnd() * .5), 0, TAU); ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      /* the sieve plate, a little off the middle */
      ctx.fillStyle = '#f0b060'; ctx.beginPath(); ctx.ellipse(R * .14, -lift * 1.6 - R * .08 * tilt, R * .06, R * .06 * tilt, 0, 0, TAU); ctx.fill();
    }
    /* a sheen of wet light */
    if (o.wet === undefined || o.wet > .3) { ctx.fillStyle = `rgba(255,255,255,${.12 * (o.wet === undefined ? 1 : o.wet)})`; ctx.beginPath(); ctx.ellipse(-R * .2, -lift * 1.4 - R * .2 * tilt, R * .45, R * .16 * tilt, -.3, 0, TAU); ctx.fill(); }
    /* dry: a dull, chalky look */
    if (o.wet !== undefined && o.wet < .5) { ctx.fillStyle = `rgba(230,220,210,${(.5 - o.wet) * .5})`; ctx.fillRect(-R * 1.2, -R * 1.5, R * 2.4, R * 2.4); }
    ctx.restore();
    /* the eyespots at the arm tips */
    if (R > 6) for (let a = 0; a < 5; a++) {
      const th = rot + a * TAU / 5, r = starR(th - rot + .001, o, R) * .97;
      const x = Math.cos(th) * r, y = Math.sin(th) * r * tilt - (1 - r / R) * lift * 1.6 - lift * .2;
      ctx.fillStyle = F.eye; ctx.beginPath(); ctx.arc(x, y, Math.max(.6, R * .035), 0, TAU); ctx.fill();
    }
    /* the stomach pushed out, into a mussel's shell in front */
    if (o.stomach > .02) {
      const sx = R * .55 * (o.dir || 1), sy = R * tilt * .2;
      const sg = ctx.createRadialGradient(sx, sy, 1, sx, sy, R * .32);
      sg.addColorStop(0, `rgba(255,236,214,${.85 * o.stomach})`); sg.addColorStop(1, `rgba(240,190,160,${.3 * o.stomach})`);
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(sx, sy, R * .3 * o.stomach, R * .18 * o.stomach, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /* the swimming larva: a see-through lobed body with two bands of beating hairs and a green gut.
     z 1–2: bipinnaria; z 3: brachiolaria, with three sticky arms at the front (and a tiny star inside) */
  function drawLarva(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, z = o.z || 1;
    ctx.save(); ctx.scale(s, s);
    const body = new Path2D();
    body.moveTo(0, -2.2);
    body.bezierCurveTo(1.6, -2.4, 2.2, -1, 1.6, 0); body.bezierCurveTo(2.4, .8, 1.8, 2.4, 0, 2.2);
    body.bezierCurveTo(-1.8, 2.4, -2.4, .8, -1.6, 0); body.bezierCurveTo(-2.2, -1, -1.6, -2.4, 0, -2.2);
    ctx.fillStyle = 'rgba(220,240,255,.42)'; ctx.fill(body);
    ctx.strokeStyle = 'rgba(240,250,255,.8)'; ctx.lineWidth = .12; ctx.stroke(body);
    /* the beating hair bands: two loops that shimmer */
    for (const k of [1, -1]) {
      ctx.strokeStyle = `rgba(255,255,255,${.5 + .4 * Math.sin(ph * 8 + k)})`; ctx.lineWidth = .14;
      ctx.beginPath(); ctx.ellipse(0, k * .7, 1.9, .8, 0, 0, TAU); ctx.stroke();
    }
    /* the gut: a green-gold tummy full of tiny plants */
    ctx.fillStyle = 'rgba(150,190,80,.85)'; ctx.beginPath(); ctx.ellipse(0, .3, .8, .95, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,220,120,.8)'; ctx.beginPath(); ctx.arc(-.2, 0, .3, 0, TAU); ctx.fill();
    if (z >= 3) {
      /* three little sticky arms at the front, and a tiny star growing inside */
      ctx.strokeStyle = 'rgba(240,250,255,.85)'; ctx.lineWidth = .35; ctx.lineCap = 'round';
      for (const a of [-.5, 0, .5]) { ctx.beginPath(); ctx.moveTo(a * 1.2, -2.1); ctx.lineTo(a * 2 + Math.sin(ph * 3 + a) * .2, -3.3); ctx.stroke(); ctx.fillStyle = 'rgba(255,240,200,.9)'; ctx.beginPath(); ctx.arc(a * 2 + Math.sin(ph * 3 + a) * .2, -3.3, .25, 0, TAU); ctx.fill(); }
      if (o.star) { ctx.save(); ctx.translate(0, .6); ctx.globalAlpha = .75 * o.star; drawStar(ctx, { w: 2.6, form: o.form, face: true, noShadow: true, simple: true, feet: false }); ctx.restore(); }
    }
    ctx.restore();
  }
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-.3, -.4, .1, 0, 0, 1.2);
    g.addColorStop(0, 'rgba(255,250,236,.95)'); g.addColorStop(.6, 'rgba(250,214,170,.9)'); g.addColorStop(1, 'rgba(230,170,120,.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,110,80,.45)'; ctx.lineWidth = .08; ctx.stroke();
    if (o.eye) { ctx.fillStyle = 'rgba(160,190,90,.6)'; ctx.beginPath(); ctx.ellipse(0, .15, .45, .38, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-.35, -.45, .18, .26, .3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     PLANKTON AND THE SEA'S VISITORS
     ============================================================ */
  function drawPlankton(ctx, q, night, t) {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + t * .2);
    switch (q.kind) {
      case 'diatom': {
        /* a little glass pillbox */
        ctx.fillStyle = 'rgba(200,220,140,.85)'; ctx.strokeStyle = 'rgba(240,250,210,.9)'; ctx.lineWidth = .15;
        ctx.beginPath(); ctx.ellipse(0, 0, 1.6, .9, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.lineTo(1.6, 0); ctx.stroke();
        ctx.fillStyle = 'rgba(160,130,40,.8)'; ctx.beginPath(); ctx.arc(-.5, -.2, .3, 0, TAU); ctx.arc(.6, .25, .3, 0, TAU); ctx.fill();
        break;
      }
      case 'algae': {
        /* a round green cell with two little whips */
        ctx.fillStyle = 'rgba(110,190,90,.9)'; ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(200,255,170,.6)'; ctx.beginPath(); ctx.arc(-.4, -.4, .5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(160,220,140,.8)'; ctx.lineWidth = .15; ctx.beginPath(); ctx.moveTo(1.2, -.4); ctx.quadraticCurveTo(2.4, -1.4 + Math.sin(q.ph * 6) * .4, 3, -.4); ctx.moveTo(1.2, .4); ctx.quadraticCurveTo(2.4, 1.4 - Math.sin(q.ph * 6) * .4, 3, .4); ctx.stroke();
        break;
      }
      case 'chain': {
        /* a chain of diatoms */
        for (let k = -2; k <= 2; k++) {
          ctx.fillStyle = 'rgba(200,210,120,.85)'; ctx.beginPath(); ctx.rect(k * 1.3 - .55, -.8, 1.1, 1.6); ctx.fill();
          ctx.strokeStyle = 'rgba(240,250,210,.8)'; ctx.lineWidth = .12; ctx.stroke();
          ctx.fillStyle = 'rgba(150,120,30,.8)'; ctx.beginPath(); ctx.arc(k * 1.3, 0, .28, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'dino': {
        const glow = night * .4 + q.glow;
        if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,220,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(200,170,110,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 1, .8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,170,110,.7)'; ctx.lineWidth = .15; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.moveTo(0, .8); ctx.quadraticCurveTo(.8, 1.8, 0, 2.6); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
  /* a herring or a little bottom fish (side-on, facing +x), canonical 34 long */
  function drawFish(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, col = o.col || '#c8d8e8', col2 = o.col2 || '#3a5a7a';
    ctx.save(); ctx.scale(s, s);
    const tail = Math.sin(ph) * 3;
    const g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, col2); g.addColorStop(.5, col); g.addColorStop(1, '#f4f8ff');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.quadraticCurveTo(10, -7, -6, -5); ctx.lineTo(-13, 0); ctx.lineTo(-6, 5); ctx.quadraticCurveTo(10, 7, 17, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-19, -6 + tail); ctx.lineTo(-17, 0); ctx.lineTo(-19, 6 + tail); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col2; ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(2, -9); ctx.lineTo(6, -5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -.5); ctx.lineTo(-10, -.5); ctx.stroke();
    ctx.fillStyle = '#101820'; ctx.beginPath(); ctx.arc(11, -1.5, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10.6, -2, .5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the grey whale, facing +x, canonical length 1000: mottled grey, barnacle patches, a knobbly back, broad flukes */
  function drawWhale(ctx, o) {
    const s = o.s || 1, t = o.t || 0, blow = o.blow || 0;
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * .9) * 26;
    /* the flukes */
    ctx.fillStyle = '#4a4e52';
    ctx.beginPath(); ctx.moveTo(-430, -6); ctx.quadraticCurveTo(-500, -30 + sw * .3, -560, -90 + sw); ctx.quadraticCurveTo(-520, -20, -500, 0); ctx.quadraticCurveTo(-520, 20, -560, 90 + sw * .7); ctx.quadraticCurveTo(-500, 30 + sw * .2, -430, 14); ctx.fill();
    const g = ctx.createLinearGradient(0, -90, 0, 90);
    g.addColorStop(0, '#50565c'); g.addColorStop(.55, '#7a8088'); g.addColorStop(.75, '#a0a4a8'); g.addColorStop(1, '#c4c6c8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(470, -20); ctx.quadraticCurveTo(430, -80, 300, -92); ctx.quadraticCurveTo(0, -110, -300, -60); ctx.quadraticCurveTo(-420, -30, -440, -6);
    ctx.lineTo(-440, 14); ctx.quadraticCurveTo(-300, 50, 0, 78); ctx.quadraticCurveTo(300, 90, 440, 50); ctx.quadraticCurveTo(486, 20, 470, -20);
    ctx.fill();
    /* the knuckles along the back where a fin would be, mottling and barnacle patches */
    ctx.fillStyle = '#44484c'; for (let k = 0; k < 7; k++) { const x = -40 - k * 46, y = -84 + k * 6; ctx.beginPath(); ctx.ellipse(x, y, 14, 7, 0, Math.PI, TAU); ctx.fill(); }
    const R = mulberry32(21);
    ctx.fillStyle = 'rgba(230,228,220,.55)'; for (let k = 0; k < 90; k++) { ctx.beginPath(); ctx.ellipse(lerp(-400, 420, R()), lerp(-80, 60, R()), 3 + R() * 12, 2 + R() * 7, R() * 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(60,62,66,.4)'; for (let k = 0; k < 50; k++) { ctx.beginPath(); ctx.arc(lerp(-400, 420, R()), lerp(-80, 60, R()), 2 + R() * 7, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(240,220,180,.75)'; for (const [x, y, r] of [[380, -60, 26], [300, -80, 18], [430, -10, 14], [150, -90, 14]]) { for (let k = 0; k < 14; k++) { const a = R() * TAU, d = Math.sqrt(R()) * r; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .6, 1.5 + R() * 2.5, 0, TAU); ctx.fill(); } }
    /* the long mouth line, the eye, the flipper */
    ctx.strokeStyle = 'rgba(30,32,36,.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(470, 10); ctx.quadraticCurveTo(380, 44, 240, 50); ctx.stroke();
    ctx.fillStyle = '#4a4e52'; ctx.beginPath(); ctx.moveTo(240, 60); ctx.quadraticCurveTo(170, 170, 90, 190 + Math.sin(t) * 10); ctx.quadraticCurveTo(140, 110, 150, 70); ctx.fill();
    ctx.fillStyle = '#0a1018'; ctx.beginPath(); ctx.arc(362, 8, 7, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(360, 5, 2.4, 0, TAU); ctx.fill();
    /* the blow: a heart-shaped puff from the two blowholes when it is near the top */
    if (blow > 0) { ctx.fillStyle = `rgba(230,240,255,${blow * .5})`; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(300 + (k - 4) * 14 * (1.2 - blow), -100 - (1.2 - blow) * 90 - Math.abs(k - 4) * 6, 14 + (1.2 - blow) * 18, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }
  /* a comb jelly: a see-through oval with eight rows of beating comb plates shimmering like a rainbow */
  function drawCombJelly(ctx, j, t) {
    const r = j.r;
    ctx.save(); ctx.translate(j.x, j.y);
    const g = ctx.createRadialGradient(-r * .3, -r * .4, 1, 0, 0, r * 1.3);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(.7, 'rgba(210,235,255,.22)'); g.addColorStop(1, 'rgba(200,230,255,.08)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(230,245,255,.6)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.ellipse(0, 0, r * .8, r * 1.25, Math.sin(j.ph * .3) * .2, 0, TAU); ctx.fill(); ctx.stroke();
    for (let row = 0; row < 4; row++) {
      const a = (row - 1.5) * .55 + Math.sin(j.ph * .3) * .2;
      for (let k = 0; k < 9; k++) {
        const u = k / 8, hue = ((u * 2 + t * 1.6 + row * .3) % 1) * 360;
        const x = Math.sin(a) * r * .7 * Math.sin(u * Math.PI), y = (u - .5) * r * 2.2;
        ctx.fillStyle = `hsla(${hue},100%,70%,${.55 + .4 * Math.sin(t * 6 - k)})`;
        ctx.beginPath(); ctx.arc(x, y, r * .09, 0, TAU); ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(230,245,255,.5)'; ctx.lineWidth = .6;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * r * .3, r * 1.1); ctx.quadraticCurveTo(k * r * .6 + Math.sin(t + k) * 6, r * 2, k * r * .2 + Math.sin(t * .7 + k) * 10, r * 3); ctx.stroke(); }
    ctx.restore();
  }
  /* a gull: white and grey, black wing tips, a yellow bill; canonical span 200 */
  function drawGull(ctx, o) {
    const s = o.s || 1, flap = Math.sin(o.ph || 0) * .3;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#b8bcc4';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -26 - flap * 60, -100, -14 - flap * 70); ctx.quadraticCurveTo(-50, -2, -8, 6); ctx.quadraticCurveTo(50, -2, 100, -14 - flap * 70); ctx.quadraticCurveTo(30, -26 - flap * 60, 0, 0); ctx.fill();
    ctx.fillStyle = '#2a2a30'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 100, -14 - flap * 70); ctx.lineTo(k * 78, -12 - flap * 58); ctx.lineTo(k * 84, -6 - flap * 56); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#f6f6f8'; ctx.beginPath(); ctx.ellipse(2, 6, 20, 7, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-40, 12); ctx.lineTo(-40, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(22, 2, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b020'; ctx.beginPath(); ctx.moveTo(27, 2); ctx.lineTo(42, 5); ctx.lineTo(27, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(23, 0, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawOtter(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, kick = Math.sin(ph) * 6;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#3a2a1e'); g.addColorStop(.6, '#5a4030'); g.addColorStop(1, '#7a6048');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(48, -4); ctx.quadraticCurveTo(40, -14, 16, -14); ctx.quadraticCurveTo(-14, -14, -34, -8); ctx.quadraticCurveTo(-46, -4, -50, 0); ctx.quadraticCurveTo(-46, 6, -34, 9); ctx.quadraticCurveTo(-14, 14, 16, 13); ctx.quadraticCurveTo(40, 12, 48, 4); ctx.closePath(); ctx.fill();
    /* the hind feet, big webbed paddles, and the tail */
    ctx.fillStyle = '#2e2016'; ctx.beginPath(); ctx.moveTo(-40, 4); ctx.lineTo(-58, 2 + kick); ctx.lineTo(-62, 10 + kick); ctx.lineTo(-46, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-40, -2); ctx.lineTo(-58, -8 - kick); ctx.lineTo(-62, -1 - kick); ctx.lineTo(-46, 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.quadraticCurveTo(-64, 2, -70, 6 + kick * .3); ctx.quadraticCurveTo(-62, 1, -48, 2); ctx.fill();
    ctx.fillStyle = '#4a3424'; ctx.beginPath(); ctx.ellipse(10, 12, 7, 4, .3, 0, TAU); ctx.fill();
    /* the pale face, dark nose, whiskers, little ears */
    ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.ellipse(40, -3, 10, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.arc(30, -12, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(49, 0, 3, 2.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c0c12'; ctx.beginPath(); ctx.arc(41, -5, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(40.3, -6, .9, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .6; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(46, 1 + k); ctx.lineTo(58, 2 + k * 4); ctx.stroke(); }
    ctx.restore();
  }
  /* the crab boat seen from the side on the surface, canonical length 240, waterline at y = 0 */
  function drawKelp(ctx, k, t, ground) {
    const sw = Math.sin(t * .6 + k.ph) * 10 + Math.sin(t * 1.3 + k.ph * 2) * 4;
    ctx.save(); ctx.translate(k.x, ground);
    ctx.fillStyle = '#3a3018'; ctx.beginPath(); ctx.ellipse(0, 1, 6, 2.5, 0, 0, TAU); ctx.fill();
    const topX = sw * 1.2, topY = -k.h;
    ctx.strokeStyle = '#6a5a22'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * .3, -k.h * .5, topX, topY); ctx.stroke();
    /* the float: a dark olive bulb at the top */
    ctx.fillStyle = '#5a5a1e'; ctx.beginPath(); ctx.ellipse(topX, topY - 3, 3.4 + k.w * .25, 4.5 + k.w * .3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.25)'; ctx.beginPath(); ctx.ellipse(topX - 1, topY - 5, 1.2, 2, 0, 0, TAU); ctx.fill();
    /* the blades: several long ribbons streaming from the bulb with the current */
    const g = ctx.createLinearGradient(0, topY - 10, 0, topY + k.h * .5); g.addColorStop(0, '#8a7a2a'); g.addColorStop(.5, '#6a7a2a'); g.addColorStop(1, '#3a5a22');
    ctx.fillStyle = g; ctx.globalAlpha = .85;
    for (let b = 0; b < 4; b++) {
      const L = k.h * (.35 + b * .08), dir = (b % 2 ? 1 : -1), ph = k.ph + b;
      ctx.beginPath(); ctx.moveTo(topX, topY);
      for (let i = 0; i <= 8; i++) { const u = i / 8, x = topX + dir * (u * 10 + Math.sin(u * 7 + t * 1.5 + ph) * k.w * .7) + sw * u * .5, y = topY + u * L; ctx.lineTo(x + k.w * .45 * (1 - u * .4), y); }
      for (let i = 8; i >= 0; i--) { const u = i / 8, x = topX + dir * (u * 10 + Math.sin(u * 7 + t * 1.5 + ph) * k.w * .7) + sw * u * .5, y = topY + u * L; ctx.lineTo(x - k.w * .45 * (1 - u * .4), y); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  /* a tuft of eelgrass on the flats */
  function drawSunStar(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, n = 18;
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 14); g.addColorStop(0, '#f0a060'); g.addColorStop(.6, '#c86a4a'); g.addColorStop(1, '#8a4a70');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * TAU, r = k % 2 ? 7 : 14 + Math.sin(ph * 2 + k) * .8; const x = Math.cos(a) * r, y = Math.sin(a) * r * .5; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,.6)'; for (let k = 0; k < n; k++) { const a = k / n * TAU; for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.arc(Math.cos(a) * j * 3.6, Math.sin(a) * j * 1.8, .45, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }
  /* a rockfish: a stout, spiny fish hanging in the gloom, big eyes; canonical 40 long facing +x */
  /* a gull standing on the rock, facing +x, canonical 60 tall (feet at y = 0) */
  function drawGullStand(ctx, o) {
    const s = o.s || 1, peck = o.peck || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#e0a070'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-2, -14); ctx.moveTo(4, 0); ctx.lineTo(2, -14); ctx.stroke();
    ctx.fillStyle = '#f4f4f6'; ctx.beginPath(); ctx.ellipse(0, -24, 16, 12, -.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8bcc4'; ctx.beginPath(); ctx.ellipse(-4, -28, 16, 8, -.25, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.moveTo(-18, -26); ctx.lineTo(-30, -20); ctx.lineTo(-17, -22); ctx.fill();
    ctx.save(); ctx.translate(12, -36); ctx.rotate(peck * .9);
    ctx.fillStyle = '#f6f6f8'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b020'; ctx.beginPath(); ctx.moveTo(6, -1); ctx.lineTo(18, 2); ctx.lineTo(6, 3); ctx.fill();
    ctx.fillStyle = '#d83020'; ctx.beginPath(); ctx.arc(14, 2, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(2, -2, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  /* the red rock crab, side-on facing +x, canonical 40 wide, legs on the rock at y = 0 */
  function drawCrab(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#8a2a1a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const x = -12 + k * 7, sw = Math.sin(ph * 2 + k) * 2; ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x - 4 + sw, -3); ctx.lineTo(x - 6 + sw, 0); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -20, 0, -6); g.addColorStop(0, '#d8483a'); g.addColorStop(1, '#8a2418');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -11, 18, 8, 0, Math.PI, TAU); ctx.lineTo(18, -9); ctx.quadraticCurveTo(0, -5, -18, -9); ctx.fill();
    /* the big claws, black-tipped */
    ctx.fillStyle = '#c03a2a'; ctx.beginPath(); ctx.ellipse(20, -12, 8, 5, -.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1010'; ctx.beginPath(); ctx.moveTo(26, -16); ctx.lineTo(31, -13 + Math.sin(ph * 3) * 1.5); ctx.lineTo(26, -11); ctx.fill();
    ctx.fillStyle = '#101010'; ctx.beginPath(); ctx.arc(10, -20, 1.6, 0, TAU); ctx.arc(14, -19, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* surfgrass on the low shore and rockweed on the high shore */
  function drawGrass(ctx, g, t, ground, wet) {
    ctx.save(); ctx.translate(g.x, ground);
    ctx.lineCap = 'round';
    if (g.kind === 'rockweed') {
      /* in the air it lies flat over the rock; under water it floats up on its air bubbles */
      const up = wet ? 1 : .25;
      for (let k = 0; k < g.n; k++) {
        const sw = Math.sin(t * .9 + g.ph + k) * 4 * up, x0 = (k - (g.n - 1) / 2) * 2, h = g.h * (.7 + (k % 3) * .15), dir = k % 2 ? 1 : -1;
        const ex = x0 + sw + dir * h * (1 - up) * .9, ey = -h * up - 1;
        ctx.strokeStyle = k % 2 ? '#7a6a2a' : '#8a7a34'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(x0, 1); ctx.quadraticCurveTo(x0 + dir * h * .3 * (1 - up) + sw * .4, -h * .5 * up, ex, ey); ctx.stroke();
        ctx.fillStyle = '#a8963a'; ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, TAU); ctx.arc((x0 + ex) / 2 + sw * .2, ey * .55, 1.2, 0, TAU); ctx.fill();
      }
    } else {
      for (let k = 0; k < g.n; k++) {
        const sw = Math.sin(t * 1.1 + g.ph + k) * 5, x0 = (k - (g.n - 1) / 2) * 1.6, h = g.h * (.75 + (k % 2) * .25);
        ctx.strokeStyle = k % 2 ? '#2a8a4a' : '#3aa060'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x0, 1); ctx.quadraticCurveTo(x0 + sw * .4, -h * .5, x0 + sw, -h); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---------- food on the rocks (origin on the rock, y up is negative) ---------- */
  function drawFood(ctx, it, t, wet) {
    ctx.save(); ctx.translate(it.x, it.y + 1); ctx.rotate((it.rot || 0) * .25 + (it.roll ? it.rot : 0));
    const k = it.kind, shade = it.col || 0;
    if (k === 'spat' || k === 'barnacle') {
      const r = k === 'spat' ? 1.4 : 3.4;
      ctx.fillStyle = '#ece6da'; ctx.strokeStyle = '#9a9286'; ctx.lineWidth = .35;
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * .45, -r * 1.1); ctx.lineTo(r * .45, -r * 1.1); ctx.lineTo(r, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * .2, -r * .1); ctx.lineTo(-r * .3, -r * 1.05); ctx.moveTo(r * .2, -r * .1); ctx.lineTo(r * .3, -r * 1.05); ctx.stroke();
      ctx.fillStyle = '#6a6458'; ctx.beginPath(); ctx.ellipse(0, -r * 1.1, r * .4, r * .15, 0, 0, TAU); ctx.fill();
      /* under water the feathery legs kick out for food */
      if (wet && k === 'barnacle') { const u = (Math.sin(t * 4 + it.x) + 1) / 2; ctx.strokeStyle = 'rgba(240,220,190,.85)'; ctx.lineWidth = .3; for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(j * 1.2, -r * 1.1 - 3 * u, j * 1.6, -r * 1.1 - 2 * u - 1.2); ctx.stroke(); } }
    } else if (k === 'limpet') {
      const g = ctx.createLinearGradient(0, -5, 0, 0); g.addColorStop(0, '#d8c8a0'); g.addColorStop(1, '#6a5038');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-4.4, 0); ctx.quadraticCurveTo(-1.5, -5, 0, -5.2); ctx.quadraticCurveTo(1.5, -5, 4.4, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,24,.5)'; ctx.lineWidth = .3; for (let j = -3; j <= 3; j++) { ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(j * 1.4, 0); ctx.stroke(); }
    } else if (k === 'snail') {
      ctx.fillStyle = '#26222a'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-4.5, -4, -1, -6); ctx.quadraticCurveTo(3.5, -6, 4, -1.5); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6a6070'; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(-.2, -3, 2, Math.PI * .8, Math.PI * 2.4); ctx.stroke();
      ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.ellipse(1.5, -.5, 1.4, .8, 0, 0, TAU); ctx.fill();
    } else if (k === 'chiton') {
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(0, -1.4, 5.4, 2.2, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#2a7a6a'; for (let j = 0; j < 8; j++) { ctx.beginPath(); ctx.ellipse(-4.2 + j * 1.2, -2.2, .7, 1.3, 0, Math.PI, TAU); ctx.fill(); }
    } else if (k === 'mussel') {
      /* a California mussel standing point-up in the bed, blue-black, the growth lines showing */
      ctx.rotate(-.5 + shade * 1); ctx.scale(.62, .62);
      const g = ctx.createLinearGradient(-3, 0, 3, 0); g.addColorStop(0, '#1e2434'); g.addColorStop(.55, '#4a5878'); g.addColorStop(1, '#1a1e2a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -11); ctx.bezierCurveTo(5.5, -9, 5, -1, 3, 0); ctx.lineTo(-3, 0); ctx.bezierCurveTo(-5, -1, -5.5, -9, 0, -11); ctx.fill();
      ctx.fillStyle = 'rgba(200,215,240,.35)'; ctx.beginPath(); ctx.ellipse(-1.2, -6.5, .9, 3, -.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,170,190,.45)'; ctx.lineWidth = .35; for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(-3.3 + j * .4, -j * 2.4); ctx.quadraticCurveTo(0, -j * 2.4 - 1, 3.3 - j * .4, -j * 2.4); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,120,80,.35)'; ctx.beginPath(); ctx.ellipse(0, -.6, 2.6, .8, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /* an empty shell left after a meal */
  function drawMiddenShell(ctx, m, t) {
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot * .4);
    if (m.kind === 'mussel') {
      /* the two halves, open, pearly blue inside */
      for (const k of [-1, 1]) { ctx.save(); ctx.rotate(k * .5); ctx.fillStyle = '#1e2430'; ctx.beginPath(); ctx.ellipse(k * 3, -1.4, 4.6, 1.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(190,210,235,.75)'; ctx.beginPath(); ctx.ellipse(k * 3, -1.6, 3.6, 1.1, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    } else if (m.kind === 'limpet') { ctx.fillStyle = '#e8dcc4'; ctx.beginPath(); ctx.ellipse(0, -1, 4, 1.6, 0, 0, TAU); ctx.fill(); }
    else if (m.kind === 'chiton') { ctx.fillStyle = '#2a7a6a'; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(-3 + j * 2, -.8, .8, 1.2, j, 0, TAU); ctx.fill(); } }
    else { ctx.fillStyle = '#3a3640'; ctx.beginPath(); ctx.arc(0, -2, 2.8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a8090'; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(0, -2, 1.5, 0, Math.PI * 1.6); ctx.stroke(); }
    ctx.restore();
  }
  /* the new life that moves into bare rock (the keystone), canonical about 10 across, on the rock at y = 0 */
  function drawLife(ctx, l, t, wet) {
    const s = (l.s || 1) * Math.min(1, (l.t === undefined ? 9 : l.t) / 3 + .2);
    ctx.save(); ctx.translate(l.x, l.y + 1); ctx.scale(s, s);
    const ph = l.ph || 0;
    switch (l.kind) {
      case 'anemone': {
        ctx.fillStyle = '#4a8a5a'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-3.4, -6); ctx.lineTo(3.4, -6); ctx.lineTo(4, 0); ctx.fill();
        if (wet) { ctx.strokeStyle = '#8ae0a0'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; for (let j = 0; j < 9; j++) { const a = -Math.PI + j / 8 * Math.PI, sw = Math.sin(t * 1.5 + ph + j) * .6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2.6, -6); ctx.quadraticCurveTo(Math.cos(a) * 4, -6 + Math.sin(a) * 3, Math.cos(a) * 5 + sw, -6 + Math.sin(a) * 4.5); ctx.stroke(); } }
        else { ctx.fillStyle = '#6aa070'; ctx.beginPath(); ctx.ellipse(0, -6, 3.6, 1.6, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'barnacles': for (const [x, r] of [[-4, 1.8], [-1, 2.4], [2.5, 2], [5, 1.4], [.8, 1.3]]) { ctx.fillStyle = '#ece6da'; ctx.beginPath(); ctx.moveTo(x - r, 0); ctx.lineTo(x - r * .4, -r * 1.1); ctx.lineTo(x + r * .4, -r * 1.1); ctx.lineTo(x + r, 0); ctx.fill(); ctx.fillStyle = '#6a6458'; ctx.beginPath(); ctx.ellipse(x, -r * 1.1, r * .4, r * .15, 0, 0, TAU); ctx.fill(); } break;
      case 'weed': { ctx.lineCap = 'round'; for (let j = 0; j < 5; j++) { const sw = Math.sin(t + ph + j) * (wet ? 2 : .5); ctx.strokeStyle = j % 2 ? '#b83a4a' : '#d85a5a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo((j - 2) * .8, 0); ctx.quadraticCurveTo((j - 2) * 2 + sw, -5, (j - 2) * 2.6 + sw * 1.5, -9 - (j % 2) * 2); ctx.stroke(); } break; }
      case 'limpet': drawFood(ctx, { kind: 'limpet', x: 0, y: -1, rot: 0 }, t, wet); break;
      case 'chiton': drawFood(ctx, { kind: 'chiton', x: 0, y: -1, rot: 0 }, t, wet); break;
      case 'goose': { for (let j = 0; j < 5; j++) { const x = (j - 2) * 2, h = 5 + (j % 2) * 2, a = (j - 2) * .12; ctx.save(); ctx.translate(x, 0); ctx.rotate(a); ctx.fillStyle = '#4a3a34'; ctx.fillRect(-.7, -h, 1.4, h); ctx.fillStyle = '#f0ece4'; ctx.beginPath(); ctx.moveTo(0, -h - 4); ctx.lineTo(1.6, -h); ctx.lineTo(-1.6, -h); ctx.closePath(); ctx.fill(); ctx.restore(); } break; }
      case 'urchin': { ctx.strokeStyle = '#7a2a8a'; ctx.lineWidth = .6; for (let j = 0; j < 18; j++) { const a = Math.PI + j / 17 * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3, -3 + Math.sin(a) * 3); ctx.lineTo(Math.cos(a) * 6.2, -3 + Math.sin(a) * 6.2); ctx.stroke(); } ctx.fillStyle = '#6a1a7a'; ctx.beginPath(); ctx.ellipse(0, -3, 3.6, 3.2, 0, 0, TAU); ctx.fill(); break; }
      case 'nudibranch': { ctx.fillStyle = '#f4f0ea'; ctx.beginPath(); ctx.ellipse(0, -1.4, 5, 1.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff8a2a'; for (let j = 0; j < 7; j++) { ctx.beginPath(); ctx.ellipse(-3.6 + j * 1.2, -3, .5, 1.6 + Math.sin(t * 2 + j) * .2, 0, 0, TAU); ctx.fill(); } ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(5.2, -4); ctx.moveTo(4.4, -2); ctx.lineTo(6, -3.4); ctx.stroke(); break; }
    }
    ctx.restore();
  }
  /* a patch of pink coralline crust on the rock, where a larva can settle */
  function drawPink(ctx, sh, t) {
    ctx.save(); ctx.translate(sh.x, sh.y + 1);
    const R = mulberry32((sh.x * 7) | 0);
    for (let k = 0; k < 9; k++) { ctx.fillStyle = `rgba(${226 + R() * 20 | 0},${120 + R() * 40 | 0},${150 + R() * 30 | 0},${.55 + R() * .35})`; ctx.beginPath(); ctx.ellipse((R() - .5) * sh.w * .9, -R() * 2, 2 + R() * 4, 1 + R() * 1.5, 0, 0, TAU); ctx.fill(); }
    if (sh.taken && !sh.mine) {
      /* crowded: mussels packed in */
      for (let k = 0; k < 5; k++) drawFood(ctx, { kind: 'mussel', x: (k - 2) * 6, y: -1, rot: (k - 2) * .2, col: k / 5 }, t, true);
    }
    ctx.restore();
  }
  function drawCrack(ctx, sh) {
    ctx.save(); ctx.translate(sh.x, sh.y);
    ctx.fillStyle = 'rgba(8,8,10,.75)'; ctx.beginPath(); ctx.moveTo(-sh.w * .5, 1); ctx.quadraticCurveTo(0, -4, sh.w * .5, 1); ctx.quadraticCurveTo(0, 6, -sh.w * .5, 1); ctx.fill();
    ctx.restore();
  }
  /* the child tide-pooling: a raincoat and boots, crouched to look; canonical 100 tall, feet at y = 0, facing −x.
     hand 0..1 reaches down, 1..2 lifts up to look */
  function drawKid(ctx, o) {
    const s = o.s || 1, hand = o.hand || 0, walk = o.walk || 0, crouch = Math.min(1, hand) * .35;
    ctx.save(); ctx.scale(s, s);
    ctx.scale(o.face > 0 ? -1 : 1, 1);
    const legY = -30 * (1 - crouch);
    ctx.strokeStyle = '#3a6ad0'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const k of [-1, 1]) { const sw = Math.sin(walk + (k > 0 ? Math.PI : 0)) * 6 * (hand ? 0 : 1); ctx.beginPath(); ctx.moveTo(k * 4, legY); ctx.lineTo(k * 4 + sw, -6); ctx.stroke(); }
    ctx.fillStyle = '#ffd23f'; for (const k of [-1, 1]) { const sw = Math.sin(walk + (k > 0 ? Math.PI : 0)) * 6 * (hand ? 0 : 1); ctx.fillRect(k * 4 + sw - 5, -10, 10, 10); }
    /* the raincoat */
    ctx.fillStyle = '#e84a3a'; ctx.beginPath(); ctx.moveTo(-12, legY + 2); ctx.lineTo(-9, legY - 34); ctx.quadraticCurveTo(0, legY - 40, 9, legY - 34); ctx.lineTo(12, legY + 2); ctx.closePath(); ctx.fill();
    /* the arm reaching down, then up holding you */
    const ax = -18 - Math.min(1, hand) * 6, ay = legY - 26 + Math.min(1, hand) * 30 - Math.max(0, hand - 1) * 38;
    ctx.strokeStyle = '#e84a3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-6, legY - 28); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, TAU); ctx.fill();
    /* the head in a hood, looking down */
    ctx.fillStyle = '#e84a3a'; ctx.beginPath(); ctx.arc(-2, legY - 46, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(-5, legY - 44, 8.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(-9, legY - 45, 1.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a05040'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-8, legY - 41, 2.4, .2, Math.PI - .4); ctx.stroke();
    ctx.restore();
  }
  /* the scientist with a clipboard and a square frame for counting; canonical 120 tall, feet at y = 0, facing −x */
  function drawScientist(ctx, o) {
    const s = o.s || 1, walk = o.walk || 0, counting = o.counting || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.scale(o.face > 0 ? -1 : 1, 1);
    ctx.strokeStyle = '#3a4a3a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (const k of [-1, 1]) { const sw = Math.sin(walk + (k > 0 ? Math.PI : 0)) * 7 * (o.moving ? 1 : 0); ctx.beginPath(); ctx.moveTo(k * 5, -44); ctx.lineTo(k * 5 + sw, -6); ctx.stroke(); }
    ctx.fillStyle = '#2a2a2a'; for (const k of [-1, 1]) ctx.fillRect(k * 5 - 6, -10, 12, 10);
    ctx.fillStyle = '#2a7a8a'; ctx.beginPath(); ctx.moveTo(-14, -42); ctx.lineTo(-11, -88); ctx.quadraticCurveTo(0, -94, 11, -88); ctx.lineTo(14, -42); ctx.closePath(); ctx.fill();
    /* the clipboard, and the arm writing */
    ctx.fillStyle = '#c8a070'; ctx.fillRect(-26, -76, 14, 18); ctx.fillStyle = '#fff'; ctx.fillRect(-24, -73, 10, 13);
    ctx.strokeStyle = '#2a7a8a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-6, -82); ctx.lineTo(-18, -68 + Math.sin(counting * 20) * 2); ctx.stroke();
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(0, -102, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.arc(0, -105, 10, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.ellipse(0, -110, 14, 4, 0, 0, TAU); ctx.fill(); ctx.fillRect(-9, -118, 18, 8);
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(-5, -102, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the quadrat: a square frame laid on the rock around the star being counted */
  function drawQuadrat(ctx, x, y, w) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2, -1); ctx.lineTo(-w / 2 + w * .15, -w * .18); ctx.lineTo(w / 2 + w * .15, -w * .18); ctx.lineTo(w / 2, -1); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     ICONS (100 × 100 units, centred)
     ============================================================ */
  function rockIcon(ctx, pool) {
    const g = ctx.createLinearGradient(0, 4, 0, 46); g.addColorStop(0, '#6a6664'); g.addColorStop(1, '#2e2c2c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-48, 46); ctx.lineTo(-48, 14); ctx.quadraticCurveTo(0, 2, 48, 12); ctx.lineTo(48, 46); ctx.closePath(); ctx.fill();
    if (pool) { const w = ctx.createLinearGradient(0, 8, 0, 36); w.addColorStop(0, 'rgba(90,190,210,.9)'); w.addColorStop(1, 'rgba(20,90,120,.95)'); ctx.fillStyle = w; ctx.beginPath(); ctx.ellipse(0, 18, 34, 14, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 12, 26, 4, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  }
  function waterDrop(ctx) { const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, '#bfe8f8'); g.addColorStop(1, '#3a8ac0'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill(); }
  function iconStar(ctx, form, extra = {}) { drawStar(ctx, Object.assign({ w: 78, form, face: true, rot: 0, seed: 5 }, extra)); }
  function drawIcon(ctx, key, px, form) {
    form = form || 'normal';
    if (['egg', 'larva', 'postlarva', 'baby', 'plankton', 'diatom', 'combjelly', 'cloud'].includes(key)) waterDrop(ctx);
    switch (key) {
      case 'egg': for (const [x, y] of [[-10, -8], [10, -6], [0, 10], [-16, 12], [16, 12], [0, -18]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: 8, eye: true }); ctx.restore(); } break;
      case 'eggs': { rockIcon(ctx); ctx.save(); ctx.translate(0, 20); iconStar(ctx, form, { w: 60, face: false, tilt: .5, arch: 1 }); ctx.restore(); for (let k = 0; k < 30; k++) { const a = -Math.PI / 2 + Math.sin(k * 7.1) * 1.1, d = 14 + (k * 37 % 30); ctx.save(); ctx.translate(Math.cos(a) * d, -14 + Math.sin(a) * d * .8); drawEgg(ctx, { s: 2.6 }); ctx.restore(); } break; }
      case 'cloud': { ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y, r] of [[-10, -6, 14], [8, -10, 16], [14, 6, 12], [-6, 10, 12]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } break; }
      case 'larva': case 'baby': drawLarva(ctx, { s: 11, ph: .8, z: 1 }); break;
      case 'postlarva': drawLarva(ctx, { s: 9, ph: .8, z: 3, star: 1, form }); break;
      case 'juvenile': { rockIcon(ctx); ctx.save(); ctx.translate(-4, 18); iconStar(ctx, form, { w: 30, face: false, tilt: .55 }); ctx.restore(); drawFood(ctx, { kind: 'spat', x: 20, y: 14, rot: 0 }, 0); drawFood(ctx, { kind: 'spat', x: 28, y: 15, rot: 0 }, 0); break; }
      case 'young': { rockIcon(ctx, true); ctx.save(); ctx.translate(0, 18); iconStar(ctx, form, { w: 50, face: false, tilt: .55 }); ctx.restore(); break; }
      case 'star': case 'adult': case 'boy': case 'starfish': iconStar(ctx, form); break;
      case 'girl': case 'mate': { iconStar(ctx, form, { w: 70 }); ctx.fillStyle = '#ff6a9a'; ctx.font = '900 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', 30, -26); break; }
      case 'spawn': { ctx.save(); ctx.translate(0, 26); iconStar(ctx, form, { w: 70, face: false, tilt: .5, arch: 1 }); ctx.restore(); ctx.fillStyle = 'rgba(255,220,170,.9)'; for (let k = 0; k < 16; k++) { ctx.beginPath(); ctx.arc(Math.sin(k * 3.3) * 22, -10 - (k * 13 % 34), 2, 0, TAU); ctx.fill(); } break; }
      case 'arm': { iconStar(ctx, form, { short: .9 }); ctx.strokeStyle = '#3fbf6a'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(26, 26, 14, 0, TAU); ctx.stroke(); ctx.setLineDash([]); break; }
      case 'eye': { iconStar(ctx, form, { w: 60 }); ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -29, 9, 0, TAU); ctx.stroke(); break; }
      case 'feet': { ctx.save(); ctx.translate(0, 10); iconStar(ctx, form, { w: 80, face: false, tilt: .4, arch: .5, moving: true, walk: 1 }); ctx.restore(); break; }
      case 'stomach': case 'eat': { rockIcon(ctx); drawFood(ctx, { kind: 'mussel', x: 22, y: 14, rot: 0 }, 0); ctx.save(); ctx.translate(-6, 18); iconStar(ctx, form, { w: 54, face: false, tilt: .5, stomach: 1, dir: 1 }); ctx.restore(); break; }
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'diatom', rot: 0 }, { x: 14, y: -14, kind: 'algae', rot: .4 }, { x: 0, y: 12, kind: 'chain', rot: .3 }, { x: -18, y: 16, kind: 'dino', rot: 0, glow: .6 }, { x: 18, y: 14, kind: 'diatom', rot: .5 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(6, 6); drawPlankton(ctx, Object.assign({ glow: 0, ph: 0 }, q, { x: 0, y: 0 }), .3, 0); ctx.restore(); } break;
      case 'diatom': ctx.scale(12, 12); drawPlankton(ctx, { x: 0, y: 0, kind: 'chain', rot: .3, ph: 0 }, 0, 0); break;
      case 'combjelly': drawCombJelly(ctx, { x: 0, y: -4, r: 26, ph: 1.2 }, 1); break;
      case 'whale': ctx.translate(4, 8); drawWhale(ctx, { s: .082, t: 0, blow: 0 }); break;
      case 'herring': case 'fish': drawFish(ctx, { s: 2.2, col: '#c8d8e8', col2: '#3a5a7a' }); break;
      case 'gull': case 'bird': ctx.translate(0, 34); drawGullStand(ctx, { s: 1.15 }); break;
      case 'otter': drawOtter(ctx, { s: .7, ph: 1 }); break;
      case 'crab': ctx.translate(-4, 22); drawCrab(ctx, { s: 1.9, ph: 1 }); break;
      case 'sunflower': case 'sunstar': ctx.translate(0, 6); drawSunStar(ctx, { s: 3, ph: 0 }); break;
      case 'mussel': ctx.translate(0, 30); ctx.scale(4.2, 4.2); for (const [x, r] of [[-4, -.3], [0, 0], [4, .3]]) drawFood(ctx, { kind: 'mussel', x, y: 0, rot: r, col: .5 }, 0); break;
      case 'barnacle': case 'spat': ctx.translate(0, 26); ctx.scale(5, 5); for (const x of [-5, 0, 5]) drawFood(ctx, { kind: 'barnacle', x, y: 0, rot: 0 }, 1, true); break;
      case 'limpet': ctx.translate(0, 14); ctx.scale(7, 7); drawFood(ctx, { kind: 'limpet', x: 0, y: 0, rot: 0 }, 0); break;
      case 'snail': ctx.translate(0, 16); ctx.scale(6.5, 6.5); drawFood(ctx, { kind: 'snail', x: 0, y: 0, rot: 0 }, 0); break;
      case 'chiton': ctx.translate(0, 10); ctx.scale(7, 7); drawFood(ctx, { kind: 'chiton', x: 0, y: 0, rot: 0 }, 0); break;
      case 'shell': { rockIcon(ctx); ctx.scale(3.4, 3.4); for (const [x, y, k, r] of [[-6, 6, 'mussel', 0], [5, 7, 'limpet', .4], [-1, 4, 'snail', -.3], [8, 4, 'mussel', 1]]) drawMiddenShell(ctx, { x, y, kind: k, rot: r }, 0); break; }
      case 'anemone': ctx.translate(0, 30); ctx.scale(5, 5); drawLife(ctx, { kind: 'anemone', x: 0, y: 0, ph: 0 }, 0, true); break;
      case 'urchin': ctx.translate(0, 26); ctx.scale(5, 5); drawLife(ctx, { kind: 'urchin', x: 0, y: 0, ph: 0 }, 0, true); break;
      case 'keystone': case 'newlife': { rockIcon(ctx); ctx.save(); ctx.translate(0, 8); ctx.scale(2.4, 2.4); for (const [x, k] of [[-12, 'anemone'], [-3, 'weed'], [5, 'barnacles'], [12, 'limpet']]) drawLife(ctx, { kind: k, x, y: 0, ph: x }, 1, true); ctx.restore(); break; }
      case 'pool': case 'rest': { rockIcon(ctx, true); ctx.save(); ctx.translate(0, 22); iconStar(ctx, form, { w: 36, face: false, tilt: .5 }); ctx.restore(); if (key === 'rest') { ctx.fillStyle = '#fff'; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', 26, -10); ctx.font = '900 14px sans-serif'; ctx.fillText('z', 36, -22); } break; }
      case 'rock': case 'pink': { rockIcon(ctx); ctx.fillStyle = 'rgba(236,130,160,.85)'; ctx.beginPath(); ctx.ellipse(-4, 10, 26, 6, 0, 0, TAU); ctx.fill(); break; }
      case 'wave': case 'hold': case 'storm': {
        if (key === 'storm') { ctx.fillStyle = '#4a5260'; ctx.fillRect(-48, -48, 96, 96); }
        rockIcon(ctx);
        ctx.fillStyle = '#3a9ad0'; ctx.beginPath(); ctx.moveTo(-48, 30); ctx.quadraticCurveTo(-40, -30, 0, -34); ctx.quadraticCurveTo(26, -34, 22, -14); ctx.quadraticCurveTo(10, -24, 0, -10); ctx.quadraticCurveTo(-10, 10, -6, 30); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-36, -10); ctx.quadraticCurveTo(-20, -34, 4, -32); ctx.quadraticCurveTo(22, -30, 20, -16); ctx.stroke();
        ctx.save(); ctx.translate(18, 14); iconStar(ctx, form, { w: 34, face: false, tilt: .5, grip: 1, moving: key === 'hold' }); ctx.restore();
        break;
      }
      case 'dry': case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'tide': case 'sea': case 'water': {
        rockIcon(ctx);
        ctx.fillStyle = 'rgba(63,160,230,.85)'; ctx.beginPath(); ctx.moveTo(-48, 46); ctx.lineTo(-48, -2); for (let x = -48; x <= 48; x += 4) ctx.lineTo(x, -6 + Math.sin(x * .14) * 5); ctx.lineTo(48, 46); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -44; x <= 44; x += 4) ctx.lineTo(x, -8 + Math.sin(x * .14) * 5); ctx.stroke();
        if (key === 'tide') { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(30, -42); ctx.lineTo(20, -26); ctx.lineTo(27, -26); ctx.lineTo(27, -14); ctx.lineTo(33, -14); ctx.lineTo(33, -26); ctx.lineTo(40, -26); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'kelp': { ctx.fillStyle = '#2a6a9a'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip(); for (const k of [{ x: -22, h: 70, ph: 0, w: 7 }, { x: 6, h: 84, ph: 2, w: 8 }, { x: 30, h: 60, ph: 4, w: 6 }]) drawKelp(ctx, k, 1, 44); ctx.restore(); break; }
      case 'rockweed': rockIcon(ctx); drawGrass(ctx, { x: -14, h: 30, ph: 0, n: 6, kind: 'rockweed' }, 0, 12, true); drawGrass(ctx, { x: 14, h: 26, ph: 1, n: 5, kind: 'rockweed' }, 0, 12, true); break;
      case 'kid': ctx.translate(14, 48); drawKid(ctx, { s: .85, hand: .8, face: -1 }); break;
      case 'scientist': ctx.translate(0, 50); drawScientist(ctx, { s: .8, face: -1 }); break;
      case 'spring': { ctx.fillStyle = '#7ad07a'; ctx.beginPath(); ctx.ellipse(-10, 0, 14, 28, -.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#4aa04a'; ctx.beginPath(); ctx.ellipse(12, 4, 12, 24, .5, 0, TAU); ctx.fill(); break; }
      case 'winter': { ctx.fillStyle = '#d8e4ec'; for (const [x, y, r] of [[-12, -8, 16], [8, -14, 18], [22, -4, 12]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } ctx.strokeStyle = '#3a9ad0'; ctx.lineWidth = 3; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-20 + k * 8, 14); ctx.lineTo(-24 + k * 8, 30); ctx.stroke(); } break; }
      default: iconStar(ctx, form);
    }
  }
  function icon(key, px, form) {
    form = form || (window.G && window.G.form) || 'normal';
    const k = `${key}|${px}|${form}`;
    let c = iconCache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = px * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2); ctx.scale(px / 100, px / 100);
      drawIcon(ctx, key, px, form);
      iconCache.set(k, c);
    }
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }

  return { drawStar, starR, drawLarva, drawEgg, drawPlankton, drawFish, drawWhale, drawCombJelly, drawGull, drawGullStand, drawOtter, drawCrab, drawSunStar, drawKelp, drawGrass, drawFood, drawMiddenShell, drawLife, drawPink, drawCrack, drawKid, drawScientist, drawQuadrat, drawIcon, icon };
})();
