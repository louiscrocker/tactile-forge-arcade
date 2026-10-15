/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE COPEPOD (copepodite and grown-up) is drawn side-on, facing
   +x (the caller flips it with scale(face, 1)): a canonical body
   about 23 units long at s = 1, from the tail's bristles (x = −16)
   to the round head (x = +11), the origin in the middle of the big
   front part (the prosome).  Glassy and see-through, with one red
   eye, long hairy feelers (antennules) swept back over the body,
   swimming legs in pairs under it (more pairs at each copepodite
   stage), a green gut, the amber oil sac, red pigment at the
   feeler tips and the tail.  The feelers fold back flat for a jump
   and in sleep.  Boys have hairier feelers and a long fifth leg; a
   girl's tail has a swelling at the front and, when her eggs are
   ripe, a dark band of eggs along her back.

   THE NAUPLIUS is a round little swimmer about 6 units long: one
   red eye, three pairs of bristly legs rowing in turn, and from
   stage III on a short tail with two spines.

   THE EGG is a glassy amber bead full of yolk.

   Then diatoms (lone and in chains), dinoflagellates, herring, the
   basking shark, the North Atlantic right whale, comb jellies, and
   the icons for the HUD, the stickers and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const F = (form) => FORMS[form] || FORMS.red;
  const rgba = (hex, a) => withAlpha(hex, a);

  /* ============================================================
     THE COPEPOD
     ============================================================ */
  /* how many pairs of swimming legs at each step: copepodite I has two, one more each stage, five from stage IV */
  const legPairs = (step) => clamp(step - 5, 2, 5);
  /* the urosome (tail) segments: fewer in the young stages */
  const tailSegs = (step, sex) => (step >= 12 ? (sex === 'boy' ? 5 : 4) : clamp(step - 7, 1, 4));
  function prosomePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(11, -.4);
    ctx.bezierCurveTo(11.2, -2.6, 9.4, -3.6, 7, -3.6);
    ctx.lineTo(-2.6, -3.3);
    ctx.bezierCurveTo(-5, -3.1, -6, -1.6, -6, 0);
    ctx.bezierCurveTo(-6, 1.6, -4.6, 2.5, -2.6, 2.6);
    ctx.lineTo(6.4, 2.6);
    ctx.bezierCurveTo(9.4, 2.5, 10.9, 1.4, 11, -.4);
    ctx.closePath();
  }
  /* one antennule: a long, slightly curved feeler with fine bristles and a red tip */
  function antennule(ctx, o, C, far, fold) {
    const x0 = 9.4, y0 = -2.6;
    const ex = lerp(-12 - (o.step >= 12 ? 3 : 0), -9, fold), ey = lerp(-10.5 + (far ? 1.4 : 0) + Math.sin((o.ph || 0) * .3) * .4, -3.6, fold);
    const cx = lerp(1, 1, fold), cy = lerp(-10.5, -4.4, fold);
    ctx.strokeStyle = rgba(C.edge, far ? .55 : .85); ctx.lineWidth = far ? .32 : .42; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
    if (o.simple) return;
    /* bristles along it (a boy's are thicker) */
    const n = o.step >= 12 && o.sex === 'boy' ? 22 : 14;
    ctx.strokeStyle = rgba(C.edge, far ? .3 : .5); ctx.lineWidth = .1;
    for (let k = 1; k < n; k++) {
      const t = k / n, px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * ey;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - .5, py - 1.1 + fold * .8); ctx.stroke();
    }
    ctx.fillStyle = rgba(C.pig, far ? .6 : .9); ctx.beginPath(); ctx.arc(ex, ey, .45, 0, TAU); ctx.fill();
  }
  function drawCopepod(ctx, o) {
    const C = F(o.form), s = o.s || 1, step = clamp(o.step || 12, 7, 12), ph = o.ph || 0;
    const jump = o.jump || 0, sleep = !!o.sleep, fold = Math.max(jump, sleep ? 1 : 0);
    ctx.save(); ctx.scale(s, s);
    /* stage I and II are shorter in front and behind */
    const kx = .82 + (step - 7) * .045; ctx.scale(kx, 1);
    antennule(ctx, o, C, true, fold);
    /* the tail (urosome) with its segments, and the bristles (caudal setae) at the end */
    const nSeg = tailSegs(step, o.sex), tl = 5.2 + nSeg * 1.1, tailBend = Math.sin(ph * 1.3) * .06 * (sleep ? 0 : 1) - jump * .1;
    ctx.save(); ctx.translate(-5.6, .2); ctx.rotate(tailBend);
    ctx.fillStyle = rgba(C.body, .55); ctx.strokeStyle = rgba(C.edge, .9); ctx.lineWidth = .18;
    ctx.beginPath(); ctx.moveTo(.4, -1.1); ctx.lineTo(-tl, -.6); ctx.lineTo(-tl, .6); ctx.lineTo(.4, 1.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let k = 1; k < nSeg; k++) { const x = -k * tl / nSeg; ctx.beginPath(); ctx.moveTo(x, -1 + k * .08); ctx.lineTo(x, 1 - k * .08); ctx.stroke(); }
    if (step >= 12 && o.sex === 'girl') { ctx.fillStyle = rgba(C.body, .8); ctx.beginPath(); ctx.ellipse(-.6, .7, 1.2, 1, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    /* the caudal rami and their long bristles, fanned */
    ctx.strokeStyle = rgba(C.edge, .8); ctx.lineWidth = .14;
    for (let k = 0; k < 5; k++) { const a = Math.PI + (k - 2) * .12 + Math.sin(ph + k) * .03; ctx.beginPath(); ctx.moveTo(-tl, (k - 2) * .2); ctx.lineTo(-tl + Math.cos(a) * 4.6, (k - 2) * .2 + Math.sin(a) * 4.6); ctx.stroke(); }
    ctx.fillStyle = rgba(C.pig, .75); ctx.beginPath(); ctx.ellipse(-tl + .2, 0, .7, .5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    /* swimming legs under the body, beating in a wave (swept back in a jump, still in sleep) */
    const nLeg = legPairs(step);
    ctx.lineCap = 'round';
    for (let k = 0; k < nLeg; k++) {
      const x0 = 5.6 - k * 1.9, a = sleep ? .4 : jump > .2 ? 1.25 : .55 + Math.sin(ph * 2 - k * .9) * .35;
      const L = 3.4, x1 = x0 - Math.sin(a) * L, y1 = 2.5 + Math.cos(a) * L;
      ctx.strokeStyle = rgba(C.edge, .75); ctx.lineWidth = .32; ctx.beginPath(); ctx.moveTo(x0, 2.4); ctx.lineTo(x1, y1); ctx.stroke();
      if (!o.simple) { ctx.lineWidth = .08; for (let j = 1; j <= 4; j++) { const t = j / 5, px = lerp(x0, x1, t), py = lerp(2.4, y1, t); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - .8, py + .5); ctx.stroke(); } }
    }
    /* a boy's long fifth leg */
    if (step >= 12 && o.sex === 'boy') { ctx.strokeStyle = rgba(C.edge, .85); ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(-3.4, 2.3); ctx.quadraticCurveTo(-5.2, 4.2, -6.6, 3.6); ctx.stroke(); }
    /* the little mouth legs fanning a feeding current */
    if (!sleep) { ctx.strokeStyle = rgba(C.pig, .6); ctx.lineWidth = .22; for (let k = 0; k < 3; k++) { const a = .5 + Math.sin(ph * 5 + k * 1.7) * .5; ctx.beginPath(); ctx.moveTo(8.4 - k * .9, 2.3); ctx.lineTo(8.4 - k * .9 + Math.sin(a) * 1.2, 2.3 + Math.cos(a) * 2); ctx.stroke(); } }
    /* the glassy body */
    prosomePath(ctx);
    const g = ctx.createRadialGradient(3, -1.6, .5, 2.5, -.4, 9);
    g.addColorStop(0, rgba(C.body, .32)); g.addColorStop(.7, rgba(C.body, .5)); g.addColorStop(1, rgba(C.edge, .75));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(C.edge, .95); ctx.lineWidth = .22; ctx.stroke();
    /* inside: the gut (greener when fed), the oil sac, ripe eggs along a mother's back */
    ctx.save(); prosomePath(ctx); ctx.clip();
    const gut = clamp(o.gut === undefined ? .5 : o.gut, 0, 1);
    ctx.strokeStyle = `rgba(${lerp(170, 90, gut) | 0},${lerp(150, 150, gut) | 0},${lerp(110, 50, gut) | 0},.7)`; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(8.6, .3); ctx.quadraticCurveTo(2, 1.1, -6, .4); ctx.stroke();
    const oil = clamp(o.oil || 0, 0, 1);
    if (oil > .02) {
      const og = ctx.createLinearGradient(0, -2.8, 0, .4); og.addColorStop(0, rgba(C.oil, .95)); og.addColorStop(1, rgba(C.oil, .55));
      ctx.fillStyle = og; ctx.beginPath(); ctx.ellipse(1.5 - (1 - oil) * 1.5, -1.2, 1.2 + oil * 5.6, .45 + oil * 1.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,.6)'; ctx.beginPath(); ctx.ellipse(1 - (1 - oil), -2 + (1 - oil) * .5, .6 + oil * 2.4, .22, 0, 0, TAU); ctx.fill();
    }
    if (o.ripe) { ctx.fillStyle = 'rgba(80,60,90,.55)'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(6 - k * 1.2, -2.5 + Math.sin(k) * .3, .55, 0, TAU); ctx.fill(); } }
    /* segment lines on the back */
    ctx.strokeStyle = rgba(C.edge, .45); ctx.lineWidth = .14;
    for (const x of [5.4, 2.8, .4, -2]) { ctx.beginPath(); ctx.moveTo(x, -3.7); ctx.quadraticCurveTo(x - .5, -2.4, x - .2, -1.4); ctx.stroke(); }
    ctx.restore();
    /* the pigment by the mouth, the red eye, a highlight */
    ctx.fillStyle = rgba(C.pig, .55); ctx.beginPath(); ctx.ellipse(8.6, 1.6, 1.3, .6, -.3, 0, TAU); ctx.fill();
    ctx.fillStyle = C.eye; ctx.beginPath(); ctx.arc(10, -.6, .62, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(9.8, -.85, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(3, -2.7, 4.6, .45, -.03, 0, TAU); ctx.fill();
    antennule(ctx, o, C, false, fold);
    ctx.restore();
  }

  /* ============================================================
     THE NAUPLIUS: about 6 units long at s = 1, facing +x
     ============================================================ */
  function drawNauplius(ctx, o) {
    const C = F(o.form), s = o.s || 1, step = clamp(o.step || 1, 1, 6), ph = o.ph || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.lineCap = 'round';
    /* three pairs of legs rowing one after another: antennules (front), antennae and mandibles (both with two branches) */
    const limb = (x0, y0, base, L, two, k) => {
      const a = base + Math.sin(ph * 2.2 - k * 1.3) * .55;
      const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
      ctx.strokeStyle = rgba(C.edge, .85); ctx.lineWidth = .26; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (two) { const x2 = x0 + Math.cos(a + .5) * L * .8, y2 = y0 + Math.sin(a + .5) * L * .8; ctx.beginPath(); ctx.moveTo(x0 + Math.cos(a) * L * .3, y0 + Math.sin(a) * L * .3); ctx.lineTo(x2, y2); ctx.stroke(); }
      if (o.simple) return;
      ctx.lineWidth = .08; ctx.strokeStyle = rgba(C.edge, .55);
      for (let j = 0; j < 4; j++) { const b = a - .9 + j * .25; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(b) * 1.8, y1 + Math.sin(b) * 1.8); ctx.stroke(); }
    };
    const grow = 1 + (step - 1) * .06;
    limb(2, -1, -.9, 2.4 * grow, false, 0);
    limb(1.6, .7, .3, 3.2 * grow, true, 1);
    limb(.3, 1.6, 1.1, 2.6 * grow, true, 2);
    /* from stage III, a short tail with two spines; longer at every moult */
    if (step >= 2) {
      const t = (step - 1) * .55;
      ctx.fillStyle = rgba(C.body, .5); ctx.strokeStyle = rgba(C.edge, .85); ctx.lineWidth = .16;
      ctx.beginPath(); ctx.moveTo(-2.2, -1); ctx.lineTo(-2.6 - t, -.45); ctx.lineTo(-2.6 - t, .45); ctx.lineTo(-2.2, 1.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(C.edge, .75); ctx.lineWidth = .12;
      for (const sy of [-.35, .35]) { ctx.beginPath(); ctx.moveTo(-2.6 - t, sy); ctx.lineTo(-4 - t * 1.4, sy * 2.6); ctx.stroke(); }
    }
    /* the pear-shaped glassy body */
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.bezierCurveTo(3, -2.4, .4, -2.6, -1, -2.2); ctx.bezierCurveTo(-2.8, -1.6, -3, 1.6, -1, 2.2); ctx.bezierCurveTo(.4, 2.6, 3, 2.4, 3, 0); ctx.closePath();
    const g = ctx.createRadialGradient(.4, -.8, .2, 0, 0, 3.2);
    g.addColorStop(0, rgba(C.body, .35)); g.addColorStop(.75, rgba(C.body, .55)); g.addColorStop(1, rgba(C.edge, .8));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(C.edge, .95); ctx.lineWidth = .18; ctx.stroke();
    /* inside: yolk for the first two stages, a green gut after */
    if (step <= 2) { ctx.fillStyle = 'rgba(240,200,110,.55)'; for (const [x, y, r] of [[-.4, .3, .7], [.4, -.4, .6], [-1.1, -.6, .5], [.6, .8, .5], [-.8, 1, .4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } }
    else { const gut = clamp(o.gut === undefined ? .5 : o.gut, 0, 1); ctx.fillStyle = `rgba(${lerp(170, 90, gut) | 0},${lerp(160, 160, gut) | 0},${lerp(100, 50, gut) | 0},.6)`; ctx.beginPath(); ctx.ellipse(-.3, .3, 1.4, .8, .1, 0, TAU); ctx.fill(); }
    ctx.fillStyle = rgba(C.pig, .5); ctx.beginPath(); ctx.ellipse(1.8, 1.3, .7, .35, -.4, 0, TAU); ctx.fill();
    ctx.fillStyle = C.eye; ctx.beginPath(); ctx.arc(2.3, -.7, .5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(2.15, -.9, .16, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(0, -1.6, 1.6, .3, -.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- the egg: a glassy amber bead full of yolk (an eye shows near hatching) ---------- */
  function drawEgg(ctx, o = {}) {
    const s = o.s || 1;
    ctx.save(); ctx.scale(s, s);
    if (o.crack) ctx.rotate(Math.sin((o.ph || 0) * 9) * o.crack * .4);
    const g = ctx.createRadialGradient(-.35, -.4, .1, 0, 0, 1.1);
    g.addColorStop(0, 'rgba(255,248,220,.95)'); g.addColorStop(.5, 'rgba(230,200,130,.85)'); g.addColorStop(1, 'rgba(170,140,80,.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .08; ctx.stroke();
    ctx.fillStyle = 'rgba(210,160,70,.45)'; for (const [x, y, r] of [[-.2, .2, .3], [.3, -.1, .25], [-.1, -.35, .2], [.25, .4, .2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    if (o.eye) { ctx.fillStyle = '#c01818'; ctx.beginPath(); ctx.arc(.35, -.15, .16, 0, TAU); ctx.fill(); }
    if (o.crack > .3) { ctx.strokeStyle = 'rgba(120,80,30,.7)'; ctx.lineWidth = .08; ctx.beginPath(); ctx.moveTo(-.6, -.6); ctx.lineTo(-.2, -.2); ctx.lineTo(-.4, .1); ctx.lineTo(0, .4); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(-.38, -.42, .18, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* an old skin, shed after a moult: a ghost of the body */
  function drawExuvia(ctx, o) {
    ctx.save(); ctx.globalAlpha *= .6;
    if ((o.step || 1) <= 6) drawNauplius(ctx, { s: o.s, form: 'clear', step: o.step, ph: 0, simple: true, gut: 0 });
    else drawCopepod(ctx, { s: o.s, form: 'clear', step: o.step, simple: true, gut: 0, sleep: true });
    ctx.restore();
  }

  /* ============================================================
     PLANKTON AND THE SEA'S VISITORS
     ============================================================ */
  function drawPlankton(ctx, q, night, t) {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + t * .2);
    switch (q.kind) {
      case 'diatom': {
        ctx.fillStyle = 'rgba(150,200,90,.85)'; ctx.strokeStyle = 'rgba(230,255,210,.9)'; ctx.lineWidth = .16;
        ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, TAU); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 1.1, Math.sin(a) * 1.1); ctx.stroke(); }
        ctx.fillStyle = 'rgba(120,90,30,.6)'; ctx.beginPath(); ctx.arc(.3, -.2, .25, 0, TAU); ctx.fill();
        break;
      }
      case 'chain': {
        ctx.fillStyle = 'rgba(160,200,80,.85)'; ctx.strokeStyle = 'rgba(230,255,200,.85)'; ctx.lineWidth = .14;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(k * .8 - .36, -.46, .72, .92, .2) : ctx.rect(k * .8 - .36, -.46, .72, .92); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-2, -.5); ctx.lineTo(-2.7, -1.7); ctx.moveTo(2, .5); ctx.lineTo(2.7, 1.7); ctx.moveTo(-2, .5); ctx.lineTo(-2.6, 1.5); ctx.moveTo(2, -.5); ctx.lineTo(2.6, -1.5); ctx.stroke();
        break;
      }
      case 'dino': {
        const glow = night * .35 + (q.glow || 0);
        if (glow > .05) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, `rgba(120,220,255,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(120,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(214,180,116,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 1, .82, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(214,180,116,.75)'; ctx.lineWidth = .14; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.moveTo(0, .8); ctx.quadraticCurveTo(.8, 1.8, 0, 2.6); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
  /* a herring (side-on, facing +x), canonical 34 long */
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
  /* the basking shark, facing +x, canonical length 1000; the cavernous mouth at the front */
  function drawBaskingShark(ctx, o) {
    const s = o.s || 1, t = o.t || 0, gulp = o.gulp || 0;
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * 1.1) * 22;
    ctx.fillStyle = '#4a4a44';
    ctx.beginPath(); ctx.moveTo(-430, -6); ctx.quadraticCurveTo(-520, -40 + sw * .3, -560, -170 + sw); ctx.quadraticCurveTo(-540, -50, -500, 0); ctx.quadraticCurveTo(-540, 40, -555, 120 + sw * .7); ctx.quadraticCurveTo(-500, 30 + sw * .2, -430, 14); ctx.fill();
    const g = ctx.createLinearGradient(0, -90, 0, 90);
    g.addColorStop(0, '#3e3e38'); g.addColorStop(.55, '#6a665c'); g.addColorStop(.62, '#b8b4a8'); g.addColorStop(1, '#dcd8cc');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(470, -30); ctx.quadraticCurveTo(440, -90, 300, -100); ctx.quadraticCurveTo(0, -116, -300, -62); ctx.quadraticCurveTo(-420, -30, -440, -6);
    ctx.lineTo(-440, 14); ctx.quadraticCurveTo(-300, 56, 0, 86); ctx.quadraticCurveTo(300, 94, 440, 60 + gulp * 20); ctx.quadraticCurveTo(480, 30, 470, -30);
    ctx.fill();
    ctx.fillStyle = '#1e1a1c';
    ctx.beginPath(); ctx.moveTo(470, -30); ctx.quadraticCurveTo(440, 20 + gulp * 30, 400, 40 + gulp * 26); ctx.quadraticCurveTo(430, 30, 440, 60 + gulp * 20); ctx.quadraticCurveTo(480, 30, 470, -30); ctx.fill();
    ctx.strokeStyle = 'rgba(220,210,200,.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(430 - k * 5, -10 + k * 6); ctx.lineTo(412 - k * 5, 30 + gulp * 20 + k * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(20,18,22,.7)'; ctx.lineWidth = 5;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(330 - k * 22, -70); ctx.quadraticCurveTo(312 - k * 22, 0, 330 - k * 22, 70); ctx.stroke(); }
    ctx.fillStyle = '#3e3e38';
    ctx.beginPath(); ctx.moveTo(60, -108); ctx.quadraticCurveTo(-10, -230, -90, -240); ctx.quadraticCurveTo(-70, -150, -110, -94); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-300, -70); ctx.quadraticCurveTo(-330, -110, -360, -112); ctx.quadraticCurveTo(-345, -80, -370, -58); ctx.fill();
    ctx.beginPath(); ctx.moveTo(230, 66); ctx.quadraticCurveTo(150, 200, 60, 240 + Math.sin(t) * 10); ctx.quadraticCurveTo(120, 140, 130, 76); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.ellipse(0, -60, 300, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a1018'; ctx.beginPath(); ctx.arc(420, -44, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(418, -46, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* the North Atlantic right whale, facing +x, canonical length 1000: black, no fin on its back,
     a huge arched mouth with long baleen, pale bumps (callosities) on its head, broad flippers */
  function whaleBody(ctx) {
    ctx.beginPath();
    ctx.moveTo(480, -10);
    ctx.bezierCurveTo(470, -120, 320, -150, 120, -140);
    ctx.bezierCurveTo(-120, -130, -330, -90, -440, -24);
    ctx.lineTo(-450, 6);
    ctx.bezierCurveTo(-330, 70, -100, 120, 120, 120);
    ctx.bezierCurveTo(330, 118, 450, 80, 480, -10);
    ctx.closePath();
  }
  function drawWhale(ctx, o) {
    const s = o.s || 1, t = o.t || 0, open = clamp(o.open || 0, 0, 1);
    ctx.save(); ctx.scale(s, s);
    const sw = Math.sin(t * .9) * 26;
    /* the flukes, beating up and down */
    ctx.fillStyle = '#16181c';
    ctx.save(); ctx.translate(-440, -8); ctx.rotate(sw / 300);
    ctx.beginPath(); ctx.moveTo(10, -14); ctx.quadraticCurveTo(-60, -20, -150, -110 + sw * .4); ctx.quadraticCurveTo(-120, -20, -170, 10); ctx.quadraticCurveTo(-120, 30, -150, 120 + sw * .4); ctx.quadraticCurveTo(-60, 30, 10, 18); ctx.closePath(); ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(0, -150, 0, 130); g.addColorStop(0, '#24282e'); g.addColorStop(.6, '#15181c'); g.addColorStop(1, '#2a2e34');
    whaleBody(ctx); ctx.fillStyle = g; ctx.fill();
    /* the white belly patch some right whales have */
    ctx.fillStyle = 'rgba(220,220,214,.5)'; ctx.beginPath(); ctx.ellipse(40, 96, 110, 18, .03, 0, TAU); ctx.fill();
    /* the open mouth: the great arched lip, the baleen hanging from the upper jaw */
    ctx.fillStyle = '#0c0a0c';
    ctx.beginPath(); ctx.moveTo(470, -30); ctx.bezierCurveTo(400, -90, 240, -70, 150, -10); ctx.lineTo(150, 10 + open * 60); ctx.bezierCurveTo(260, 40 + open * 50, 420, 30 + open * 30, 476, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,64,58,.95)'; ctx.lineWidth = 6;
    for (let k = 0; k < 18; k++) { const u = k / 17, x = lerp(445, 170, u), y0 = lerp(-40, -20, Math.sin(u * Math.PI)) - Math.sin(u * Math.PI) * 30; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - 6, y0 + 40 + open * 50 * Math.sin(u * Math.PI * .9 + .2)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,190,170,.35)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 18; k++) { const u = k / 17, x = lerp(445, 170, u) - 8, y = lerp(-40, -20, Math.sin(u * Math.PI)) - Math.sin(u * Math.PI) * 30 + 40 + open * 50 * Math.sin(u * Math.PI * .9 + .2); ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 2, y + 6); ctx.stroke(); }
    /* the lower lip */
    ctx.strokeStyle = '#2a2e34'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(150, 14 + open * 60); ctx.bezierCurveTo(260, 46 + open * 50, 420, 36 + open * 30, 476, 12); ctx.stroke();
    /* callosities: rough pale patches on the head */
    ctx.fillStyle = 'rgba(222,216,196,.85)';
    for (const [x, y, r] of [[430, -70, 14], [404, -92, 10], [372, -106, 9], [300, -120, 12], [270, -126, 7], [458, -38, 9], [330, -60, 8]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * .7, .3, 0, TAU); ctx.fill(); }
    /* the broad paddle flipper */
    ctx.fillStyle = '#121418'; ctx.save(); ctx.translate(90, 70); ctx.rotate(.5 + Math.sin(t * .7) * .1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, 90, -10, 140); ctx.quadraticCurveTo(30, 120, 40, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.ellipse(0, -110, 300, 18, -.05, 0, TAU); ctx.fill();
    ctx.fillStyle = '#05060a'; ctx.beginPath(); ctx.arc(200, 6 + open * 30, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(198, 4 + open * 30, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a comb jelly: a see-through oval with rows of beating comb plates shimmering like a rainbow */
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

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  const DROP = ['egg', 'eggs', 'nauplius', 'copepod', 'copepodite', 'stage5', 'adult', 'boy', 'girl', 'plankton', 'diatom', 'chain', 'dino', 'combjelly', 'oil', 'eye', 'tail', 'feelers', 'trail', 'skin'];
  function waterDrop(ctx, dark) {
    const g = ctx.createRadialGradient(-10, -14, 4, 0, 0, 48); g.addColorStop(0, dark ? '#3a6aa8' : '#bfe8f8'); g.addColorStop(1, dark ? '#0a1e3e' : '#3a8ac0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
  }
  function cop(ctx, form, o) { drawCopepod(ctx, Object.assign({ s: 2.9, form, step: 12, sex: 'girl', ph: 1, gut: .6, oil: .3 }, o)); }
  function drawIcon(ctx, key, px, form) {
    form = FORMS[form] ? form : 'red';
    if (DROP.includes(key)) waterDrop(ctx, key === 'trail');
    if (['deep', 'mud', 'sleep', 'bloom', 'whale', 'basking', 'snow'].includes(key)) { ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip(); }
    switch (key) {
      case 'egg': ctx.translate(0, 2); drawEgg(ctx, { s: 26, eye: true }); break;
      case 'eggs': for (const [x, y] of [[-14, -12], [10, -16], [0, 6], [-20, 14], [20, 10], [6, 26], [-6, -30], [26, -6]]) { ctx.save(); ctx.translate(x, y); drawEgg(ctx, { s: 9 }); ctx.restore(); } break;
      case 'nauplius': ctx.translate(4, 0); drawNauplius(ctx, { s: 10, form, step: 3, ph: .6, gut: .5 }); break;
      case 'copepod': case 'adult': ctx.translate(4, 8); cop(ctx, form, {}); break;
      case 'copepodite': ctx.translate(4, 8); cop(ctx, form, { step: 8, s: 3.1, oil: 0 }); break;
      case 'stage5': ctx.translate(4, 8); cop(ctx, form, { step: 11, oil: 1 }); break;
      case 'oil': ctx.translate(4, 8); cop(ctx, 'gold', { step: 11, oil: 1, s: 3.2 }); break;
      case 'boy': ctx.translate(4, 8); cop(ctx, form, { sex: 'boy' }); break;
      case 'girl': ctx.translate(4, 8); cop(ctx, form, { sex: 'girl', ripe: true }); break;
      case 'sleep': { const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, '#0e2a50'); g.addColorStop(1, '#03080f'); ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = '#4a4438'; ctx.fillRect(-46, 30, 92, 20); ctx.translate(2, 10); cop(ctx, form, { step: 11, oil: 1, sleep: true, s: 2.6 }); ctx.fillStyle = '#e8f0ff'; ctx.font = '900 16px sans-serif'; ctx.fillText('z', 22, -20); ctx.font = '900 11px sans-serif'; ctx.fillText('z', 32, -30); for (const [x, y] of [[-30, -30], [-14, -36], [8, -24], [30, 4], [-34, 0]]) { ctx.fillStyle = 'rgba(230,240,255,.7)'; ctx.fillRect(x, y, 2, 2); } break; }
      case 'tail': ctx.translate(26, 4); ctx.scale(1.4, 1.4); cop(ctx, form, { s: 3 }); break;
      case 'eye': ctx.scale(2.2, 2.2); ctx.translate(-12, 4); cop(ctx, form, { s: 3 }); break;
      case 'feelers': ctx.translate(14, 20); cop(ctx, form, { s: 2.6, sex: 'boy' }); break;
      case 'skin': ctx.translate(4, 8); ctx.globalAlpha = .9; drawExuvia(ctx, { s: 2.9, step: 9 }); break;
      case 'trail': { ctx.fillStyle = 'rgba(255,150,210,.8)'; for (let k = 0; k < 9; k++) { const x = -36 + k * 8, y = Math.sin(k * .9) * 10 - 4; ctx.beginPath(); ctx.arc(x, y, 2.4 - k * .1, 0, TAU); ctx.fill(); } ctx.translate(26, 14); cop(ctx, form, { s: 1.6 }); break; }
      case 'plankton': for (const q of [{ x: -16, y: -10, kind: 'diatom', rot: 0 }, { x: 14, y: -14, kind: 'chain', rot: .4 }, { x: -18, y: 16, kind: 'dino', rot: 0, glow: .6 }, { x: 18, y: 14, kind: 'diatom', rot: .5 }, { x: 0, y: 2, kind: 'diatom', rot: 1 }]) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(7, 7); ctx.translate(-q.x, -q.y); drawPlankton(ctx, Object.assign({ glow: q.glow || 0 }, q), .3, 0); ctx.restore(); } break;
      case 'diatom': ctx.scale(26, 26); drawPlankton(ctx, { x: 0, y: 0, kind: 'diatom', rot: 0 }, 0, 0); break;
      case 'chain': ctx.scale(13, 13); drawPlankton(ctx, { x: 0, y: 0, kind: 'chain', rot: -.3 }, 0, 0); break;
      case 'dino': ctx.scale(14, 14); ctx.translate(0, -.6); drawPlankton(ctx, { x: 0, y: 0, kind: 'dino', rot: 0, glow: .8 }, .5, 0); break;
      case 'bloom': { ctx.fillStyle = '#4aa86a'; ctx.fillRect(-46, -46, 92, 92); const R = mulberry32(5); for (let k = 0; k < 40; k++) { const x = (R() - .5) * 86, y = (R() - .5) * 86; ctx.save(); ctx.translate(x, y); ctx.scale(4, 4); drawPlankton(ctx, { x: 0, y: 0, kind: R() < .3 ? 'chain' : 'diatom', rot: R() * 6 }, 0, 0); ctx.restore(); } ctx.fillStyle = 'rgba(255,255,200,.25)'; ctx.fillRect(-46, -46, 92, 20); break; }
      case 'combjelly': drawCombJelly(ctx, { x: 0, y: -4, r: 26, ph: 1.2 }, 1); break;
      case 'basking': { ctx.fillStyle = '#3a86c0'; ctx.fillRect(-46, -46, 92, 92); ctx.translate(-14, 4); drawBaskingShark(ctx, { s: .11, t: 0, gulp: .7 }); break; }
      case 'whale': { ctx.fillStyle = '#2a76b0'; ctx.fillRect(-46, -46, 92, 92); ctx.translate(-16, 6); drawWhale(ctx, { s: .115, t: 0, open: .8 }); break; }
      case 'herring': case 'fish': drawFish(ctx, { s: 2.2, col: '#c8d8e8', col2: '#3a5a7a' }); break;
      case 'moon': {
        ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        break;
      }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'snow': { const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, '#16406e'); g.addColorStop(1, '#061428'); ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92); const R = mulberry32(9); for (let k = 0; k < 34; k++) { ctx.fillStyle = `rgba(235,245,255,${.5 + R() * .5})`; const r = 1 + R() * 2.6; ctx.beginPath(); ctx.ellipse((R() - .5) * 86, (R() - .5) * 86, r, r * .7, R() * 3, 0, TAU); ctx.fill(); } break; }
      case 'mud': { ctx.fillStyle = '#123050'; ctx.fillRect(-46, -46, 92, 46); ctx.fillStyle = '#5a5244'; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(0, -10, 46, 2); ctx.lineTo(46, 46); ctx.lineTo(-46, 46); ctx.fill(); ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.ellipse(-16, 6, 10, 5, 0, Math.PI, TAU); ctx.fill(); break; }
      case 'deep': { const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, '#5ab0e0'); g.addColorStop(.5, '#1a5a98'); g.addColorStop(1, '#030c1c'); ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92); ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.moveTo(-6, -36); ctx.lineTo(-18, -16); ctx.lineTo(-10, -16); ctx.lineTo(-10, 4); ctx.lineTo(-2, 4); ctx.lineTo(-2, -16); ctx.lineTo(6, -16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#9ad8ff'; ctx.beginPath(); ctx.moveTo(18, 38); ctx.lineTo(6, 18); ctx.lineTo(14, 18); ctx.lineTo(14, -2); ctx.lineTo(22, -2); ctx.lineTo(22, 18); ctx.lineTo(30, 18); ctx.closePath(); ctx.fill(); break; }
      case 'sea': case 'water': {
        ctx.fillStyle = '#3fa0e6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a6ab0'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 6); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 8 - 4); ctx.stroke();
        break;
      }
      default: ctx.translate(4, 8); cop(ctx, form, {});
    }
  }
  function icon(key, px, form) {
    form = FORMS[form] ? form : (typeof window !== 'undefined' && window.G && window.G.form) || 'red';
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

  return { drawCopepod, drawNauplius, drawEgg, drawExuvia, drawPlankton, drawFish, drawBaskingShark, drawWhale, drawCombJelly, drawIcon, icon, ICON_KEYS: ['egg', 'eggs', 'nauplius', 'copepod', 'copepodite', 'stage5', 'sleep', 'adult', 'boy', 'girl', 'oil', 'eye', 'tail', 'feelers', 'trail', 'skin', 'plankton', 'diatom', 'chain', 'dino', 'bloom', 'combjelly', 'basking', 'whale', 'herring', 'fish', 'moon', 'sun', 'snow', 'mud', 'deep', 'sea', 'water'] };
})();
