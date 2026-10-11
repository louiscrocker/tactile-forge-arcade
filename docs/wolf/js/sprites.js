/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE WOLF is drawn side-on, facing +x: chest at the origin,
   100 units from nose to rump at s = 1 (`s` scales it), paws on
   the ground at y = +40·s.  An `age` from 0 (newborn) to 1
   (grown) blends the proportions: a pup has a big round head, a
   short muzzle, floppy ears, short legs and a stubby tail; a
   newborn's eyes are shut.  Pup eyes are blue, a grown-up's are
   amber.  Poses: walk, run, sit, lie, curl up, howl, pounce,
   play bow, carry something, pant, wag.

   Then the elk and the bison, the raven, grasshoppers and
   voles, the biologist, tracks, scent posts, the meal, and the
   icons for the HUD, the stickers and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);

  /* the coat colours of a form; a newborn is darker and fuzzier */
  function wolfCols(form, age) {
    const F = FORMS[form] || FORMS.gray, dark = clamp(1 - age * 2.5, 0, 1) * .55;
    const m = (c, k) => rgbStr(mixRgb(C(c), C(F.fur2), k));
    const eye = age < .55 ? mixHex(F.pupEye, F.eye, smoothstep(.25, .55, age)) : F.eye;
    return { fur: m(F.fur, dark), fur2: F.fur2, belly: m(F.belly, dark * .8), mask: m(F.mask, dark * .8), eye, nose: F.nose, line: shade(F.fur2, .55) };
  }
  /* a leg: hip → knee → hock/paw, a stroke with a darker outline and a paw blob */
  function leg(ctx, pts, w, col, lineCol, pawCol) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = lineCol; ctx.lineWidth = w + 2.4; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
    const [px, py] = pts[pts.length - 1];
    ctx.fillStyle = pawCol; ctx.beginPath(); ctx.ellipse(px + 1.5, py + .5, w * .62, w * .36, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = lineCol; ctx.lineWidth = 1; ctx.stroke();
  }

  /* ============================================================
     THE WOLF
     o: { s, form, age (0..1), sex, walk (phase), moving, run, sit, lie, curl, howl (0..1),
          pounce (0..1), bow (0..1), carry ('meal'|'pup'|null), pant, wag (0..1), tuck (0..1),
          eyes (0 shut .. 1 open), snow (0..1), wet, collar, swim, sniff (0..1), seed, dig }
     ============================================================ */
  function drawWolf(ctx, o) {
    const s = o.s || 1, age = clamp(o.age === undefined ? 1 : o.age, 0, 1), cols = wolfCols(o.form, age);
    const boy = o.sex !== 'girl', walk = o.walk || 0, moving = !!o.moving, run = !!o.run;
    const howl = clamp(o.howl || 0, 0, 1), pounce = clamp(o.pounce || 0, 0, 1), bow = clamp(o.bow || 0, 0, 1), eyes = o.eyes === undefined ? (age < .08 ? 0 : 1) : o.eyes;
    const sit = !!o.sit, lie = !!o.lie, curl = !!o.curl, swim = !!o.swim;
    ctx.save(); ctx.scale(s, s);
    /* proportions by age */
    const headR = lerp(13.5, 10.5, age) * (boy ? 1.04 : 1), muz = lerp(7, 22, age), earH = lerp(6, 13, age), flop = clamp(1 - age * 3, 0, 1);
    const legL = lerp(17, 40, age), bodyRy = lerp(19, 16.5, age) * (boy ? 1.05 : 1), hipX = lerp(-24, -34, age), tailL = lerp(12, 36, age), neckL = lerp(9, 17, age);
    const legW = lerp(6.5, 7.2, age), ground = 40;
    const chR = lerp(19, 20, age) * (boy ? 1.05 : 1), hipR = lerp(16, 17, age);
    const furS = cols.fur, darkS = rgbStr(C(cols.fur2)), bellyS = cols.belly, lineS = cols.line, pawS = rgbStr(mixRgb(C(cols.fur2), [0, 0, 0], .2));
    /* body tilt for a pounce / bow / howl / sitting */
    let tilt = -pounce * .35 + bow * .3 - (sit ? .3 : 0) + (lie ? 0 : 0);
    if (swim) tilt = -.08;
    const lift = pounce * 10 + (sit ? 6 : 0);
    ctx.translate(0, -lift);
    ctx.rotate(tilt);
    /* leg motion */
    const amp = moving ? (run ? 15 : 9) : 0, spd = walk;
    const legPhase = (k) => spd + k * Math.PI;
    const legPts = (hx, hy, k, back) => {
      const ph = legPhase(k), swing = Math.cos(ph) * amp * (run ? 1.3 : 1), up = moving ? Math.max(0, Math.sin(ph)) * (run ? 9 : 5) : 0;
      let px = hx + swing, py = hy + legL - up;
      if (sit && back) return [[hx, hy], [hx - 6, hy + legL * .55], [hx + 10, hy + legL * .62]];
      if (lie || curl) return [[hx, hy], [hx + (back ? -4 : 8), hy + legL * .32], [hx + (back ? 6 : 16), hy + legL * .36]];
      if (pounce > 0) { px += back ? -pounce * 10 : pounce * 12; py -= back ? 0 : pounce * 8; }
      if (bow > 0 && !back) { py = hy + legL * .55; px = hx + 8; }
      if (swim) { py = hy + legL * .6 + Math.sin(ph) * 5; px = hx + Math.cos(ph) * 6; }
      const kx = back ? hx - 5 + swing * .4 : hx + 2 + swing * .5, ky = hy + legL * (back ? .5 : .55) - up * .5;
      return [[hx, hy], [kx, ky], [px, py]];
    };
    const farShade = (c) => rgbStr(mixRgb(C(c), [0, 0, 0], .28));
    /* --- the tail --- */
    if (curl) {
      /* curled up asleep: the tail wraps forward round the paws, over the nose */
      const tx = hipX - 12, ty = 0, w0 = lerp(7, 11, age);
      const path = () => { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.bezierCurveTo(tx - 16, ty + bodyRy * 1.1, chR * .4, bodyRy * 1.6, chR + 14, bodyRy * .9); };
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineS; ctx.lineWidth = w0 + 2; path(); ctx.stroke();
      ctx.strokeStyle = furS; ctx.lineWidth = w0; path(); ctx.stroke();
      ctx.strokeStyle = darkS; ctx.lineWidth = w0 * .4; ctx.beginPath(); ctx.moveTo(chR * .2, bodyRy * 1.35); ctx.quadraticCurveTo(chR * .7, bodyRy * 1.3, chR + 13, bodyRy * .85); ctx.stroke();
    } else {
      const wag = (o.wag || 0) * Math.sin(walk * 2.2 + (o.t || 0) * 14) * .6, tuck = o.tuck || 0;
      const tx = hipX - 14, ty = -2;
      let a = curl ? -2.9 : tuck ? 1.3 : (o.tailUp || 0) > 0 ? -1.1 : (moving ? .35 : .55);     /* angle from the rump: down-back */
      a += wag;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.PI + a * (curl ? 1 : 1) * -1);
      const L = tailL * (curl ? 1.4 : 1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineS; ctx.lineWidth = lerp(7, 11, age) + 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * .5, (curl ? -L * .5 : L * .18), L, curl ? -L * .9 : L * .22); ctx.stroke();
      ctx.strokeStyle = furS; ctx.lineWidth = lerp(7, 11, age); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * .5, (curl ? -L * .5 : L * .18), L, curl ? -L * .9 : L * .22); ctx.stroke();
      ctx.strokeStyle = darkS; ctx.lineWidth = lerp(3, 4.5, age); ctx.beginPath(); ctx.moveTo(L * .3, (curl ? -L * .2 : L * .05) - 2); ctx.quadraticCurveTo(L * .65, (curl ? -L * .55 : L * .2) - 2, L * .98, (curl ? -L * .9 : L * .22) - 1); ctx.stroke();
      ctx.restore();
    }
    /* --- far legs --- */
    leg(ctx, legPts(hipX + 2, 6, 1, true).map(([x, y]) => [x + 4, y]), legW, farShade(cols.fur), lineS, farShade(pawS));
    leg(ctx, legPts(6, 8, 0, false).map(([x, y]) => [x + 4, y]), legW, farShade(cols.fur), lineS, farShade(pawS));
    /* --- the body: chest and hips joined by the back and belly --- */
    const bodyG = ctx.createLinearGradient(0, -bodyRy, 0, bodyRy);
    bodyG.addColorStop(0, darkS); bodyG.addColorStop(.45, furS); bodyG.addColorStop(1, bellyS);
    ctx.fillStyle = bodyG; ctx.strokeStyle = lineS; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chR * .2, -bodyRy);
    ctx.bezierCurveTo(chR * .9, -bodyRy - 2, chR + 4, -bodyRy * .5, chR + 3, 2);          /* chest front */
    ctx.bezierCurveTo(chR + 2, bodyRy * .7, chR * .4, bodyRy + 1, 0, bodyRy);             /* down to the belly */
    ctx.bezierCurveTo(hipX * .5, bodyRy + 2, hipX + 4, bodyRy - 1, hipX - hipR * .6, bodyRy * .55);  /* belly back to the hips */
    ctx.bezierCurveTo(hipX - hipR - 4, bodyRy * .3, hipX - hipR - 4, -bodyRy * .6, hipX - hipR * .5, -bodyRy * .9);  /* the rump */
    ctx.bezierCurveTo(hipX * .6, -bodyRy - 4, -6, -bodyRy - 3, chR * .2, -bodyRy);        /* the back, with a slight saddle */
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the darker saddle along the back, and the fur texture */
    ctx.fillStyle = withAlpha(cols.fur2, .35);
    ctx.beginPath(); ctx.moveTo(chR * .2, -bodyRy + 1); ctx.quadraticCurveTo(-8, -bodyRy - 2, hipX - hipR * .5, -bodyRy * .9 + 1); ctx.quadraticCurveTo(hipX * .5, -bodyRy * .3, chR * .2, -bodyRy * .35); ctx.closePath(); ctx.fill();
    const RB = mulberry32(o.seed || 3);
    ctx.strokeStyle = withAlpha(cols.fur2, .3); ctx.lineWidth = .8;
    for (let k = 0; k < 14; k++) { const x = lerp(hipX - 8, chR - 4, RB()), y = -bodyRy * .9 + RB() * bodyRy * 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3 - RB() * 3, y + 2 + RB() * 3); ctx.stroke(); }
    /* snow on the back, wet drips */
    if (o.snow > 0) { ctx.fillStyle = `rgba(255,255,255,${.55 * o.snow})`; ctx.beginPath(); ctx.moveTo(chR * .1, -bodyRy); ctx.quadraticCurveTo(-8, -bodyRy - 4, hipX - hipR * .4, -bodyRy * .9); ctx.quadraticCurveTo(-8, -bodyRy + 2, chR * .1, -bodyRy); ctx.fill(); }
    if (o.wet > 0) { ctx.fillStyle = `rgba(160,200,230,${.5 * o.wet})`; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(hipX + k * 12, bodyRy + 2, 1.2, 2.2, 0, 0, TAU); ctx.fill(); } }
    /* --- near legs --- */
    leg(ctx, legPts(hipX + 2, 6, 0, true), legW, furS, lineS, pawS);
    leg(ctx, legPts(6, 8, 1, false), legW, furS, lineS, pawS);
    if (sit) { ctx.fillStyle = furS; ctx.strokeStyle = lineS; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(hipX - 2, 16, hipR * .9, 14, .2, 0, TAU); ctx.fill(); ctx.stroke(); }
    /* --- the neck and the head --- */
    const headA = -howl * 1.15 + pounce * .25 - bow * .15 + (lie && !curl ? .35 : 0) + (curl ? .9 : 0) + (o.sniff || 0) * .55 + (swim ? -.25 : 0);
    const nx = chR * .55, ny = -bodyRy * .55;
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(headA);
    /* the neck ruff */
    ctx.fillStyle = furS; ctx.strokeStyle = lineS; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(neckL * .5, -12 - neckL * .2, neckL + 4, -neckL * .55 - 6); ctx.lineTo(neckL + 8, -neckL * .3 + 6); ctx.quadraticCurveTo(neckL * .4, 10, -4, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.translate(neckL + 6, -neckL * .45 - 2);
    if (curl) ctx.translate(-8, 10);
    /* skull */
    const hg = ctx.createRadialGradient(-2, -5, 2, 0, 0, headR + 4); hg.addColorStop(0, furS); hg.addColorStop(1, darkS);
    ctx.fillStyle = hg; ctx.strokeStyle = lineS; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, headR, headR * .92, 0, 0, TAU); ctx.fill(); ctx.stroke();
    /* the ear(s): pricked for a grown-up, folded for a baby */
    for (const dx of [-4, 3]) {
      ctx.save(); ctx.translate(dx - 2, -headR * .75); ctx.rotate(-.25 + flop * 1.4 + (o.earsBack || 0) * .9);
      ctx.fillStyle = dx < 0 ? farShade(cols.fur) : furS; ctx.strokeStyle = lineS; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(0, -earH); ctx.lineTo(5, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (dx >= 0) { ctx.fillStyle = withAlpha(FORMS[o.form] ? FORMS[o.form].belly : '#e8e2d2', .5); ctx.beginPath(); ctx.moveTo(-1.5, 1); ctx.lineTo(0, -earH * .6); ctx.lineTo(2.5, 1); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    /* the muzzle */
    const mouthOpen = howl * .5 + (o.pant || 0) * .35 + (o.carry ? .25 : 0);
    ctx.fillStyle = cols.mask; ctx.strokeStyle = lineS; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(headR * .5, -headR * .35); ctx.quadraticCurveTo(headR * .5 + muz * .6, -headR * .45, headR * .4 + muz, -headR * .12); ctx.lineTo(headR * .4 + muz, headR * .12 + mouthOpen * 2); ctx.quadraticCurveTo(headR * .5 + muz * .4, headR * .5 + mouthOpen * 5, headR * .2, headR * .6 + mouthOpen * 6); ctx.lineTo(headR * .5, headR * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the top of the muzzle in the coat colour, the pale cheek and chin */
    ctx.fillStyle = furS; ctx.beginPath(); ctx.moveTo(headR * .45, -headR * .4); ctx.quadraticCurveTo(headR * .5 + muz * .6, -headR * .5, headR * .4 + muz, -headR * .12); ctx.lineTo(headR * .4 + muz, headR * .02); ctx.quadraticCurveTo(headR * .5 + muz * .5, -headR * .15, headR * .45, -headR * .05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = withAlpha(FORMS[o.form] ? FORMS[o.form].mask : '#d8d2c2', .7); ctx.beginPath(); ctx.ellipse(headR * .1, headR * .3, headR * .55, headR * .4, .2, 0, TAU); ctx.fill();
    /* the mouth line, the tongue when panting, the lower jaw when howling */
    if (mouthOpen > .05) { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.moveTo(headR * .45 + muz * .35, headR * .1); ctx.lineTo(headR * .4 + muz, headR * .1); ctx.lineTo(headR * .3 + muz * .5, headR * .35 + mouthOpen * 6); ctx.closePath(); ctx.fill(); if (o.pant) { ctx.fillStyle = '#ff8a9a'; ctx.beginPath(); ctx.ellipse(headR * .4 + muz * .7, headR * .25 + mouthOpen * 5, 3, 2, .3, 0, TAU); ctx.fill(); } }
    else { ctx.strokeStyle = lineS; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(headR * .5 + muz * .3, headR * .12); ctx.lineTo(headR * .4 + muz - 1, headR * .1); ctx.stroke(); }
    /* the nose */
    ctx.fillStyle = cols.nose; ctx.beginPath(); ctx.ellipse(headR * .4 + muz, -headR * .1, 3.2, 2.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(headR * .4 + muz - 1, -headR * .18, .9, 0, TAU); ctx.fill();
    /* the eye: amber (or blue for a pup); shut for a newborn or a sleeper */
    const ex = headR * .42, ey = -headR * .25;
    if (eyes > .2) {
      ctx.fillStyle = '#fff8ea'; ctx.beginPath(); ctx.ellipse(ex, ey, 3.6, 3 * eyes, .15, 0, TAU); ctx.fill();
      ctx.fillStyle = cols.eye; ctx.beginPath(); ctx.ellipse(ex + .6, ey, 2.5, 2.5 * eyes, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(ex + .9, ey, 1.2, 1.4 * eyes, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(ex + .2, ey - 1, .7, 0, TAU); ctx.fill();
      ctx.strokeStyle = lineS; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(ex, ey, 3.6, 3 * eyes, .15, 0, TAU); ctx.stroke();
    } else { ctx.strokeStyle = lineS; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ex - 3, ey + .5); ctx.quadraticCurveTo(ex, ey + 2.2, ex + 3, ey + .5); ctx.stroke(); }
    /* something carried in the mouth */
    if (o.carry === 'meal') { ctx.save(); ctx.translate(headR * .4 + muz + 2, headR * .25); drawMeal(ctx, .55); ctx.restore(); }
    else if (o.carry === 'pup') { ctx.save(); ctx.translate(headR * .4 + muz + 4, headR * .5); ctx.rotate(.4); ctx.scale(.3, .3); drawWolf(ctx, { form: o.carryForm || o.form, age: .02, lie: true, eyes: 0, seed: 9 }); ctx.restore(); }
    /* the radio collar */
    ctx.restore();
    if (o.collar) { ctx.save(); ctx.translate(nx + neckL * .55, ny - neckL * .2); ctx.rotate(headA * .5 - .4); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, 0, 5, 8.5, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#4a4a52'; ctx.fillRect(-3, 6, 6, 4); ctx.restore(); }
    ctx.restore();
  }

  /* ============================================================
     THE OTHER ANIMALS
     ============================================================ */
  /* an elk, side on, facing +x; canonical 100 long at the shoulder, hooves at y = +60 */
  function drawElk(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, moving = Math.abs(o.vx || 0) > 5;
    ctx.save(); ctx.scale(s, s);
    const amp = moving ? 16 : 0, line = '#3a2a1a', body = '#9a7a56', dark = '#5a4030', pale = '#d8c8a8';
    const legs = (k, hx, hy) => { const sw = Math.cos(ph + k * Math.PI) * amp, up = moving ? Math.max(0, Math.sin(ph + k * Math.PI)) * 8 : 0; return [[hx, hy], [hx + sw * .4 - 2, hy + 30 - up * .5], [hx + sw, hy + 58 - up]]; };
    for (const [k, hx, hy, far] of [[1, -30, 2, true], [0, 20, 4, true], [0, -30, 2, false], [1, 20, 4, false]]) {
      const pts = legs(k, hx + (far ? 4 : 0), hy);
      ctx.lineCap = 'round'; ctx.strokeStyle = line; ctx.lineWidth = 9; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.strokeStyle = far ? '#4a3626' : dark; ctx.lineWidth = 6.5; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(pts[2][0] + 1, pts[2][1] + 1, 4, 2.5, 0, 0, TAU); ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -24, 0, 20); g.addColorStop(0, dark); g.addColorStop(.4, body); g.addColorStop(1, pale);
    ctx.fillStyle = g; ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -18); ctx.bezierCurveTo(10, -28, -30, -26, -46, -10); ctx.bezierCurveTo(-52, 6, -40, 18, -24, 18); ctx.lineTo(20, 20); ctx.bezierCurveTo(34, 18, 38, 2, 30, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pale; ctx.beginPath(); ctx.ellipse(-42, 2, 8, 10, 0, 0, TAU); ctx.fill();          /* the pale rump patch */
    /* neck and head */
    ctx.fillStyle = '#6a4a34'; ctx.beginPath(); ctx.moveTo(26, -16); ctx.quadraticCurveTo(44, -36, 52, -52); ctx.lineTo(60, -44); ctx.quadraticCurveTo(48, -22, 36, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(58, -52, 11, 7.5, -.35, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(68, -48, 6, 4, -.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(60, -55, 1.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(50, -58); ctx.lineTo(44, -66); ctx.moveTo(54, -60); ctx.lineTo(52, -68); ctx.stroke();
    if (o.bull) { ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(52 + side * 2, -60); ctx.quadraticCurveTo(40 + side * 3, -84, 30 + side * 4, -98); ctx.moveTo(46 + side * 2, -72); ctx.lineTo(54 + side * 2, -84); ctx.moveTo(40 + side * 3, -82); ctx.lineTo(48 + side * 3, -94); ctx.moveTo(34 + side * 3, -90); ctx.lineTo(40 + side * 4, -100); ctx.stroke(); } }
    ctx.restore();
  }
  /* a bison, side on, facing +x; canonical 110 long, hooves at y = +52 */
  function drawBison(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, moving = Math.abs(o.vx || 0) > 5;
    ctx.save(); ctx.scale(s, s);
    const amp = moving ? 12 : 0, line = '#1a1008', body = '#4a3220', dark = '#2a1a0e', shag = '#6a4a2a';
    for (const [k, hx, far] of [[1, -34, true], [0, 18, true], [0, -34, false], [1, 18, false]]) {
      const sw = Math.cos(ph + k * Math.PI) * amp, up = moving ? Math.max(0, Math.sin(ph + k * Math.PI)) * 6 : 0;
      const pts = [[hx + (far ? 5 : 0), 8], [hx + (far ? 5 : 0) + sw * .4, 30 - up * .5], [hx + (far ? 5 : 0) + sw, 50 - up]];
      ctx.lineCap = 'round'; ctx.strokeStyle = line; ctx.lineWidth = 11; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.strokeStyle = far ? dark : body; ctx.lineWidth = 8; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(pts[2][0] + 1, pts[2][1] + 1, 5, 3, 0, 0, TAU); ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -40, 0, 20); g.addColorStop(0, shag); g.addColorStop(.5, body); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -10); ctx.bezierCurveTo(28, -34, 10, -46, -6, -42); ctx.bezierCurveTo(-26, -40, -46, -22, -50, -6); ctx.bezierCurveTo(-54, 10, -36, 20, -20, 20); ctx.lineTo(24, 20); ctx.bezierCurveTo(36, 18, 38, 4, 30, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the shaggy hump and beard, the big low head */
    ctx.strokeStyle = shag; ctx.lineWidth = 1.2; for (let k = 0; k < 12; k++) { const x = -20 + k * 4; ctx.beginPath(); ctx.moveTo(x, -40 + Math.abs(k - 6)); ctx.lineTo(x - 3, -30 + Math.abs(k - 6)); ctx.stroke(); }
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(40, -4, 16, 13, .3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(52, 4, 9, 7, .3, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(40, 8); ctx.lineTo(38, 20); ctx.moveTo(46, 10); ctx.lineTo(45, 22); ctx.stroke();
    ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(46, -8, 1.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(36, -14); ctx.quadraticCurveTo(30, -26, 36, -30); ctx.stroke();
    ctx.restore();
  }
  /* a raven on the ground (facing +x) or flying; canonical 30 long */
  function drawRaven(ctx, o) {
    const s = o.s || 1, fly = !!o.fly, flap = Math.sin(o.ph || 0);
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#16141a'; ctx.strokeStyle = '#2a2838';
    if (fly) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, -14 - flap * 18, -34, -6 - flap * 16); ctx.quadraticCurveTo(-18, 2, -6, 5); ctx.quadraticCurveTo(18, 2, 34, -6 - flap * 16); ctx.quadraticCurveTo(10, -14 - flap * 18, 0, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 2, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(16, 2); ctx.lineTo(8, 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(-18, -1); ctx.lineTo(-17, 5); ctx.lineTo(-8, 4); ctx.fill();
    } else {
      const hop = o.hop || 0;
      ctx.translate(0, -hop * 6);
      ctx.beginPath(); ctx.ellipse(-2, -7, 11, 6, -.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-22, -3 + hop * 4); ctx.lineTo(-20, 0); ctx.lineTo(-8, -3); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -14, 4.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(11, -15); ctx.lineTo(20, -12); ctx.lineTo(11, -11); ctx.fill();
      ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.arc(9, -15, 1.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(1, 0); ctx.moveTo(4, -2); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = '#3a3848'; ctx.beginPath(); ctx.ellipse(-3, -9, 8, 3.5, -.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawHopper(ctx, h, t) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.dir, 1);
    if (h.kind === 'vole') {
      ctx.fillStyle = '#6a5a48'; ctx.beginPath(); ctx.ellipse(0, -2.4, 4.2, 2.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(3, -3, .5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-7, -2 + Math.sin(t * 3) , -8, -1); ctx.stroke();
      ctx.fillStyle = '#8a7a68'; ctx.beginPath(); ctx.arc(1.5, -4.2, 1, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#7aa040'; ctx.beginPath(); ctx.ellipse(0, -2, 4.4, 1.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9ac050'; ctx.beginPath(); ctx.arc(4, -2.6, 1.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1a10'; ctx.beginPath(); ctx.arc(4.6, -3, .45, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5a8030'; ctx.lineWidth = .7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(-4, -5 + (h.air > 0 ? 2 : 0)); ctx.lineTo(-6, 0); ctx.moveTo(2, -1); ctx.lineTo(3, 0); ctx.moveTo(0, -1); ctx.lineTo(-1, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4.5, -3.5); ctx.lineTo(8, -6); ctx.moveTo(4.5, -3.5); ctx.lineTo(7, -7); ctx.stroke();
    }
    ctx.restore();
  }
  /* the wolf biologist with a hand-held radio antenna; canonical height 90, feet at 0 */
  function drawBiologist(ctx, o) {
    const s = o.s || 1, wave = o.wave || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#3a4a3a'; rr(ctx, -12, -36, 9, 36, 3); ctx.fill(); rr(ctx, 2, -36, 9, 36, 3); ctx.fill();
    ctx.fillStyle = '#c84a2a'; rr(ctx, -15, -68, 30, 36, 8); ctx.fill();                 /* a red jacket */
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6, -38, 12, 4);
    ctx.fillStyle = '#c8a07a'; ctx.beginPath(); ctx.arc(0, -78, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(0, -82, 10.5, Math.PI, TAU); ctx.fill(); ctx.fillRect(-10.5, -82, 5, 14);
    ctx.fillStyle = '#4a7ab0'; ctx.beginPath(); ctx.ellipse(0, -88, 14, 4, 0, 0, TAU); ctx.fill(); rr(ctx, -8, -97, 16, 10, 5); ctx.fill();   /* a wool hat */
    ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.arc(-3.5, -79, 1.3, 0, TAU); ctx.arc(3.5, -79, 1.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -75, 4, .3, Math.PI - .3); ctx.stroke();
    /* the arm holding the antenna up, the other waving */
    ctx.strokeStyle = '#c84a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -62); ctx.lineTo(22, -74); ctx.stroke();
    const a = -2.2 + Math.sin(wave * 3) * .5;
    ctx.beginPath(); ctx.moveTo(-10, -62); ctx.lineTo(-10 + Math.cos(a) * 20, -62 + Math.sin(a) * 20); ctx.stroke();
    ctx.fillStyle = '#c8a07a'; ctx.beginPath(); ctx.arc(-10 + Math.cos(a) * 22, -62 + Math.sin(a) * 22, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(23, -76, 4, 0, TAU); ctx.fill();
    /* the H antenna */
    ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(23, -78); ctx.lineTo(23, -108); ctx.moveTo(10, -108); ctx.lineTo(36, -108); ctx.moveTo(8, -100); ctx.lineTo(38, -100); ctx.moveTo(6, -92); ctx.lineTo(40, -92); ctx.stroke();
    ctx.fillStyle = '#2a2a30'; rr(ctx, 14, -66, 10, 8, 2); ctx.fill();                    /* the receiver */
    /* a little radio wave from the antenna */
    const k = (wave * .7) % 1; ctx.strokeStyle = `rgba(255,230,140,${.8 * (1 - k)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(23, -112, 6 + k * 24, -2.4, -.7); ctx.stroke();
    ctx.restore();
  }
  /* tracks: a little set of prints on the ground, canonical 40 long */
  function drawTracks(ctx, kind, dir = 1, col = 'rgba(40,28,16,.55)') {
    ctx.save(); ctx.scale(dir, 1); ctx.fillStyle = col;
    const toe = (x, y, r) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.4, 0, 0, TAU); ctx.fill(); };
    const print = (x, y, k) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      if (kind === 'elk' || kind === 'deer' || kind === 'bison') { const w = kind === 'bison' ? 3.6 : kind === 'elk' ? 2.6 : 1.8; ctx.beginPath(); ctx.ellipse(-w * .55, 0, w * .5, w * 1.1, -.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(w * .55, 0, w * .5, w * 1.1, .2, 0, TAU); ctx.fill(); }
      else if (kind === 'wolf') { ctx.beginPath(); ctx.ellipse(0, 1.5, 2.2, 1.8, 0, 0, TAU); ctx.fill(); for (const [tx, ty] of [[-2.2, -1.2], [-.8, -2.6], [.8, -2.6], [2.2, -1.2]]) { toe(tx, ty, .8); ctx.beginPath(); ctx.moveTo(tx, ty - 1.4); ctx.lineTo(tx, ty - 2.2); ctx.lineWidth = .5; ctx.strokeStyle = col; ctx.stroke(); } }
      else if (kind === 'bear') { ctx.beginPath(); ctx.ellipse(0, 2, 3.4, 2.4, 0, 0, TAU); ctx.fill(); for (let t = 0; t < 5; t++) { const tx = -3.2 + t * 1.6; toe(tx, -1.6, .7); ctx.beginPath(); ctx.moveTo(tx, -2.6); ctx.lineTo(tx, -3.8); ctx.lineWidth = .5; ctx.strokeStyle = col; ctx.stroke(); } }
      else if (kind === 'hare') { ctx.beginPath(); ctx.ellipse(-1.5, 0, 1, 3, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(1.5, 0, 1, 3, 0, 0, TAU); ctx.fill(); toe(-.6, 5, .6); toe(.8, 6.5, .6); }
      else if (kind === 'otter') { ctx.beginPath(); ctx.ellipse(0, 1, 2.4, 1.8, 0, 0, TAU); ctx.fill(); for (let t = 0; t < 5; t++) toe(-2.4 + t * 1.2, -1.8, .55); }
      ctx.restore();
    };
    if (kind === 'otter') { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 18, 2.2, 0, 0, TAU); ctx.fill(); print(-14, -1, 1); print(12, 1, 1); }
    else for (let k = 0; k < 4; k++) print(-18 + k * 12, (k % 2 ? 2 : -2), kind === 'bison' ? 1.3 : 1);
    ctx.restore();
  }
  /* a scent post: a rock, a log or a stump, canonical ~30 wide, ground at 0 */
  function drawPost(ctx, p, time) {
    ctx.save();
    if (p.kind === 'rock') { const g = ctx.createLinearGradient(0, -22, 0, 2); g.addColorStop(0, '#c8c2b4'); g.addColorStop(1, '#6e6860'); ctx.fillStyle = g; ctx.strokeStyle = '#4a443c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(-14, -12); ctx.lineTo(-4, -22); ctx.lineTo(8, -20); ctx.lineTo(16, -8); ctx.lineTo(15, 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(110,150,80,.5)'; ctx.beginPath(); ctx.ellipse(-6, -16, 6, 2.5, -.4, 0, TAU); ctx.fill(); }
    else if (p.kind === 'log') { const g = ctx.createLinearGradient(0, -14, 0, 2); g.addColorStop(0, '#8a6a46'); g.addColorStop(1, '#3a2a1a'); ctx.fillStyle = g; rr(ctx, -24, -14, 48, 15, 7); ctx.fill(); ctx.fillStyle = '#c8a070'; ctx.beginPath(); ctx.ellipse(24, -7, 4, 7, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a6a46'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(24, -7, 2, 4, 0, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = '#6a4a2e'; rr(ctx, -9, -24, 18, 26, 3); ctx.fill(); ctx.fillStyle = '#d8b888'; ctx.beginPath(); ctx.ellipse(0, -24, 10, 3.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a88858'; ctx.lineWidth = .8; for (let k = 2; k < 9; k += 2.4) { ctx.beginPath(); ctx.ellipse(0, -24, k, k * .35, 0, 0, TAU); ctx.stroke(); } }
    /* the scent on it: little rising wisps when it has been marked */
    if (p.marked || p.home) { ctx.strokeStyle = 'rgba(255,220,120,.55)'; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { const u = ((time * .4 + k * .33) % 1); ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.moveTo(-6 + k * 6, -10 - u * 22); ctx.quadraticCurveTo(-2 + k * 6, -16 - u * 22, -6 + k * 6, -20 - u * 22); ctx.stroke(); } ctx.globalAlpha = 1; }
    ctx.restore();
  }
  /* a meal to carry home: a tidy brown bundle (what it is stays off screen) */
  function drawMeal(ctx, s = 1) {
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 11); g.addColorStop(0, '#b8865a'); g.addColorStop(1, '#5a3a22');
    ctx.fillStyle = g; ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, -.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,180,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-7, -3); ctx.quadraticCurveTo(0, -8, 7, -3); ctx.stroke();
    ctx.fillStyle = '#e8d8a0'; ctx.beginPath(); ctx.arc(5, 1, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* a drop of milk */
  function drawMilk(ctx, s = 1) {
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.bezierCurveTo(8, -3, 10, 2, 10, 5); ctx.arc(0, 5, 10, 0, Math.PI); ctx.bezierCurveTo(-10, 2, -8, -3, 0, -14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(-4, 3, 2, 3.5, -.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawLeaf(ctx, len, ang, col) {
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * .3, -len * .28, len * .75, -len * .22, len, 0); ctx.bezierCurveTo(len * .75, len * .22, len * .3, len * .28, 0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(.4, len * .03); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * .95, 0); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  function iconWolf(ctx, form, extra = {}) { ctx.translate(-4, 6); drawWolf(ctx, Object.assign({ s: .62, form, age: 1, sex: 'boy', seed: 3 }, extra)); }
  function treeIcon(ctx, kind) {
    if (kind === 'pine') { ctx.fillStyle = '#5a3a22'; ctx.fillRect(-4, 10, 8, 32); ctx.fillStyle = '#2f6a3e'; for (const [y, w] of [[12, 40], [-8, 32], [-26, 22]]) { ctx.beginPath(); ctx.moveTo(0, y - 22); ctx.lineTo(w, y); ctx.lineTo(-w, y); ctx.closePath(); ctx.fill(); } }
    else { ctx.fillStyle = '#e8e4d8'; ctx.fillRect(-3, 0, 6, 42); ctx.fillStyle = '#2a2016'; ctx.fillRect(-3, 12, 3, 2); ctx.fillRect(0, 28, 3, 2); for (const [x, y, r, c] of [[-16, -14, 16, '#e0b030'], [14, -18, 18, '#f0c840'], [0, -32, 18, '#f8d850'], [-4, -6, 14, '#d8a828']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } }
  }
  function drawIcon(ctx, key, px, form) {
    form = form || 'gray';
    switch (key) {
      case 'wolf': case 'adult': case 'boy': iconWolf(ctx, form); break;
      case 'girl': iconWolf(ctx, form, { sex: 'girl' }); break;
      case 'newborn': ctx.translate(2, 8); drawWolf(ctx, { s: 1.05, form, age: 0, lie: true, curl: false, eyes: 0, seed: 3 }); break;
      case 'pup': ctx.translate(0, 8); drawWolf(ctx, { s: .8, form, age: .25, seed: 3, wag: .4 }); break;
      case 'pups': { for (const [x, y, a] of [[-24, 14, .2], [22, 12, .28], [-2, 22, .24]]) { ctx.save(); ctx.translate(x, y); drawWolf(ctx, { s: .48, form: a > .25 ? 'black' : form, age: a, seed: 3, sit: x > 0 }); ctx.restore(); } break; }
      case 'bigpup': ctx.translate(-2, 6); drawWolf(ctx, { s: .62, form, age: .62, seed: 3, moving: true, walk: 1 }); break;
      case 'yearling': ctx.translate(-3, 6); drawWolf(ctx, { s: .6, form, age: .9, seed: 3, sit: true }); break;
      case 'lone': { ctx.fillStyle = '#5a6a8a'; ctx.beginPath(); ctx.moveTo(-50, 34); ctx.lineTo(-20, -4); ctx.lineTo(0, 12); ctx.lineTo(24, -16); ctx.lineTo(50, 34); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f0f4ff'; ctx.beginPath(); ctx.moveTo(24, -16); ctx.lineTo(16, -4); ctx.lineTo(34, -2); ctx.closePath(); ctx.fill(); ctx.translate(-6, 10); drawWolf(ctx, { s: .5, form, age: 1, howl: 1, seed: 3 }); break; }
      case 'parent': { ctx.translate(-8, 2); drawWolf(ctx, { s: .52, form, age: 1, sex: 'girl', seed: 3 }); for (const [x, y] of [[14, 24], [30, 22]]) { ctx.save(); ctx.translate(x, y); drawWolf(ctx, { s: .3, form: x > 20 ? 'black' : form, age: .2, seed: 3 }); ctx.restore(); } break; }
      case 'mate': { ctx.save(); ctx.translate(-20, 8); drawWolf(ctx, { s: .46, form, age: 1, seed: 3, wag: .5 }); ctx.restore(); ctx.save(); ctx.translate(28, 8); ctx.scale(-1, 1); drawWolf(ctx, { s: .44, form: form === 'black' ? 'gray' : 'black', age: 1, sex: 'girl', seed: 3, wag: .5 }); ctx.restore(); ctx.fillStyle = '#ff7aa8'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', 4, -26); break; }
      case 'pack': { for (const [x, y, s, f] of [[-34, 14, .34, 'black'], [-10, 10, .4, form], [20, 14, .34, 'gray'], [40, 20, .26, form]]) { ctx.save(); ctx.translate(x, y); drawWolf(ctx, { s, form: f, age: s > .3 ? 1 : .6, seed: 3, moving: true, walk: x }); ctx.restore(); } break; }
      case 'mum': ctx.translate(-4, 8); drawWolf(ctx, { s: .56, form: form === 'white' ? 'white' : 'gray', age: 1, sex: 'girl', lie: true, seed: 5 }); break;
      case 'dad': ctx.translate(-4, 6); drawWolf(ctx, { s: .6, form: form === 'black' ? 'black' : 'gray', age: 1, sex: 'boy', seed: 3, carry: 'meal' }); break;
      case 'den': {
        ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(-50, 44); ctx.lineTo(-50, 10); ctx.quadraticCurveTo(-10, -40, 50, -10); ctx.lineTo(50, 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4f8a3a'; ctx.beginPath(); ctx.moveTo(-50, 10); ctx.quadraticCurveTo(-10, -40, 50, -10); ctx.lineTo(50, -2); ctx.quadraticCurveTo(-10, -30, -50, 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a0e06'; ctx.beginPath(); ctx.ellipse(-12, 20, 20, 14, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(-6, 22); drawWolf(ctx, { s: .26, form, age: .3, seed: 3 }); ctx.restore();
        break;
      }
      case 'milk': drawMilk(ctx, 2.6); break;
      case 'meal': drawMeal(ctx, 3.2); break;
      case 'raven': ctx.translate(0, 14); drawRaven(ctx, { s: 2.4, ph: 0, hop: 0 }); break;
      case 'grasshopper': drawHopper(ctx, { x: 0, y: 14, kind: 'grasshopper', dir: 1, air: 0 }, 0); ctx.save(); ctx.scale(6, 6); ctx.translate(0, 2); drawHopper(ctx, { x: 0, y: 0, kind: 'grasshopper', dir: 1, air: 0 }, 0); ctx.restore(); break;
      case 'vole': ctx.save(); ctx.scale(6, 6); ctx.translate(0, 3); drawHopper(ctx, { x: 0, y: 0, kind: 'vole', dir: 1, air: 0 }, 0); ctx.restore(); break;
      case 'elk': ctx.translate(-4, 6); drawElk(ctx, { s: .6, bull: true }); break;
      case 'bison': ctx.translate(0, 8); drawBison(ctx, { s: .66 }); break;
      case 'deer': { ctx.translate(-2, 8); ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.ellipse(-6, 0, 24, 14, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-18, -8, 6, 16]) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 32); ctx.stroke(); } ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(26, -32); ctx.lineTo(36, -30); ctx.lineTo(24, -2); ctx.fill(); ctx.beginPath(); ctx.ellipse(32, -32, 9, 6, -.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-28, 2, 5, 7, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(28, -38); ctx.lineTo(22, -48); ctx.moveTo(34, -38); ctx.lineTo(38, -48); ctx.stroke(); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(36, -34, 1.5, 0, TAU); ctx.fill(); break; }
      case 'hare': { ctx.translate(0, 10); ctx.fillStyle = '#c8b8a0'; ctx.beginPath(); ctx.ellipse(-4, 4, 24, 16, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(20, -8, 11, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(14, -30, 4.5, 14, -.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(24, -30, 4.5, 14, .1, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-28, 2, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(24, -10, 1.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#e8d8c8'; ctx.beginPath(); ctx.ellipse(-2, 20, 16, 5, 0, 0, TAU); ctx.fill(); break; }
      case 'otter': { ctx.translate(0, 6); ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.ellipse(-6, 6, 30, 12, .1, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(26, -2, 9, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-34, 8); ctx.quadraticCurveTo(-48, 10, -50, 24); ctx.lineTo(-40, 24); ctx.quadraticCurveTo(-40, 14, -30, 14); ctx.fill(); ctx.fillStyle = '#b89a78'; ctx.beginPath(); ctx.ellipse(30, 2, 6, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(28, -5, 1.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(35, 1, 1.6, 0, TAU); ctx.fill(); break; }
      case 'bear': { ctx.translate(0, 8); ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.ellipse(-4, 0, 30, 20, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(-8, -18, 16, 12, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(26, -8, 12, 0, TAU); ctx.fill(); for (const x of [-22, -10, 8, 18]) { ctx.fillRect(x, 12, 9, 22); } ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.ellipse(34, -4, 7, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.arc(20, -18, 4, 0, TAU); ctx.arc(30, -18, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(39, -6, 2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(28, -10, 1.5, 0, TAU); ctx.fill(); break; }
      case 'tracks': { ctx.fillStyle = '#c8b898'; ctx.fillRect(-46, -46, 92, 92); ctx.save(); ctx.scale(2.2, 2.2); drawTracks(ctx, 'wolf', 1, 'rgba(60,40,20,.75)'); ctx.restore(); break; }
      case 'paw': { ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(0, 12, 20, 16, 0, 0, TAU); ctx.fill(); for (const [x, y] of [[-24, -10], [-9, -22], [9, -22], [24, -10]]) { ctx.beginPath(); ctx.ellipse(x, y, 7, 9, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 2, y - 8); ctx.lineTo(x, y - 15); ctx.lineTo(x + 2, y - 8); ctx.fill(); } break; }
      case 'scent': { for (let k = 0; k < 3; k++) { ctx.strokeStyle = ['#d8a860', '#c88a50', '#e8e0c8'][k]; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-20 + k * 20, 30); ctx.bezierCurveTo(-34 + k * 20, 10, -6 + k * 20, -4, -20 + k * 20, -24); ctx.stroke(); } ctx.save(); ctx.translate(-6, 30); ctx.scale(.9, .9); ctx.fillStyle = '#1a1612'; ctx.beginPath(); ctx.ellipse(0, 4, 8, 6, 0, 0, TAU); ctx.fill(); ctx.restore(); break; }
      case 'river': { ctx.fillStyle = '#3f8fd6'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 0); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 6 - 2); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1a5aa0'; ctx.beginPath(); ctx.moveTo(-46, 40); ctx.lineTo(-46, 14); for (let x = -46; x <= 46; x += 4) ctx.lineTo(x, 14 + Math.sin(x * .12 + 2) * 5); ctx.lineTo(46, 40); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -40; x <= 40; x += 4) ctx.lineTo(x, Math.sin(x * .14) * 6 - 4); ctx.stroke(); ctx.fillStyle = '#8a8a80'; for (const [x, y] of [[-30, -22], [20, -26], [36, -14]]) { ctx.beginPath(); ctx.ellipse(x, y, 10, 6, 0, 0, TAU); ctx.fill(); } break; }
      case 'snow': { ctx.fillStyle = '#eef4ff'; ctx.beginPath(); ctx.moveTo(-46, 44); ctx.quadraticCurveTo(-20, 6, 10, 14); ctx.quadraticCurveTo(30, 18, 46, 6); ctx.lineTo(46, 44); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const [x, y] of [[-20, -24], [16, -30], [30, -6]]) { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.stroke(); } } break; }
      case 'tree': case 'forest': treeIcon(ctx, 'pine'); break;
      case 'meadow': { ctx.fillStyle = '#7ab84a'; ctx.beginPath(); ctx.ellipse(0, 24, 48, 20, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4a8a2a'; ctx.lineWidth = 2; for (let k = -40; k <= 40; k += 8) { ctx.beginPath(); ctx.moveTo(k, 22); ctx.lineTo(k + 3, 8); ctx.stroke(); } for (const [x, c] of [[-24, '#ffd23f'], [-2, '#ff7a9a'], [26, '#b48aff']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 4, 5, 0, TAU); ctx.fill(); } ctx.save(); ctx.translate(0, -18); ctx.scale(.55, .55); treeIcon(ctx, 'pine'); ctx.restore(); break; }
      case 'hill': case 'valley': case 'mountain': { ctx.fillStyle = key === 'mountain' ? '#5a6a8a' : '#4f8a3a'; ctx.beginPath(); ctx.moveTo(-48, 40); ctx.lineTo(-14, -20); ctx.lineTo(6, 0); ctx.lineTo(30, -34); ctx.lineTo(48, 40); ctx.closePath(); ctx.fill(); if (key === 'mountain') { ctx.fillStyle = '#f0f4ff'; ctx.beginPath(); ctx.moveTo(30, -34); ctx.lineTo(20, -18); ctx.lineTo(42, -14); ctx.closePath(); ctx.fill(); } if (key === 'valley') { ctx.fillStyle = '#3f8fd6'; ctx.beginPath(); ctx.moveTo(-10, 40); ctx.quadraticCurveTo(0, 20, 14, 40); ctx.fill(); } if (key === 'hill') { ctx.fillStyle = '#1a0e06'; ctx.beginPath(); ctx.ellipse(-16, 22, 9, 6, 0, 0, TAU); ctx.fill(); } break; }
      case 'moon': { ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(200,190,140,.6)'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2); ctx.stroke(); break; }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'rain': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x - 5, 32); ctx.stroke(); } break;
      case 'storm': ctx.fillStyle = '#5a6a7a'; ctx.beginPath(); ctx.arc(-12, -10, 16, 0, TAU); ctx.arc(8, -16, 18, 0, TAU); ctx.arc(22, -6, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(-8, 22); ctx.lineTo(0, 22); ctx.lineTo(-6, 40); ctx.lineTo(12, 16); ctx.lineTo(4, 16); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill(); break;
      case 'road': case 'tunnel': { ctx.fillStyle = '#6a6a62'; ctx.fillRect(-46, -30, 92, 24); ctx.strokeStyle = '#f0e8c0'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-44, -18); ctx.lineTo(44, -18); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#8a7a5a'; ctx.fillRect(-46, -6, 92, 50); ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.moveTo(-22, 44); ctx.lineTo(-22, 10); ctx.arc(0, 10, 22, Math.PI, TAU); ctx.lineTo(22, 44); ctx.closePath(); ctx.fill(); ctx.save(); ctx.translate(-2, 30); drawWolf(ctx, { s: .22, form, age: 1, moving: true, walk: 1, seed: 3 }); ctx.restore(); break; }
      case 'scientist': ctx.translate(-4, 44); drawBiologist(ctx, { s: .82 }); break;
      case 'antenna': { ctx.strokeStyle = '#6a6a70'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(0, -30); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.moveTo(-26, -12); ctx.lineTo(26, -12); ctx.moveTo(-22, 6); ctx.lineTo(22, 6); ctx.stroke(); ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 3; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(0, -36, k * 9, -2.4, -.7); ctx.stroke(); } break; }
      case 'collar': { ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#4a4a52'; rr(ctx, -10, 14, 20, 14, 3); ctx.fill(); ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -4); ctx.stroke(); break; }
      case 'post': ctx.translate(0, 22); ctx.scale(2, 2); drawPost(ctx, { kind: 'rock', marked: true }, .3); break;
      case 'tail': { ctx.save(); ctx.translate(-30, 10); ctx.rotate(-.5); const g = ctx.createLinearGradient(0, -10, 0, 10); g.addColorStop(0, '#4e493f'); g.addColorStop(1, '#8f8a7e'); ctx.strokeStyle = g; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -10, 60, 6); ctx.stroke(); ctx.restore(); ctx.fillStyle = '#8f8a7e'; ctx.beginPath(); ctx.ellipse(-38, 0, 16, 22, 0, 0, TAU); ctx.fill(); break; }
      case 'nose': { ctx.fillStyle = '#8f8a7e'; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(30, -16); ctx.lineTo(30, 14); ctx.lineTo(-40, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1a1612'; ctx.beginPath(); ctx.ellipse(30, -2, 14, 12, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(26, -8, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d8a860'; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-20 + k * 14, 30); ctx.quadraticCurveTo(-26 + k * 14, 42, -14 + k * 14, 46); ctx.stroke(); } break; }
      case 'ears': { ctx.fillStyle = '#8f8a7e'; ctx.beginPath(); ctx.arc(0, 16, 30, 0, TAU); ctx.fill(); for (const side of [-1, 1]) { ctx.fillStyle = '#8f8a7e'; ctx.strokeStyle = '#4e493f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(side * 8, -4); ctx.lineTo(side * 22, -42); ctx.lineTo(side * 34, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8d8d0'; ctx.beginPath(); ctx.moveTo(side * 14, -8); ctx.lineTo(side * 22, -30); ctx.lineTo(side * 28, -8); ctx.closePath(); ctx.fill(); } break; }
      case 'eyes': { for (const x of [-18, 18]) { ctx.fillStyle = '#fff8ea'; ctx.beginPath(); ctx.ellipse(x, 0, 14, 11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = form === 'pup' ? '#6aa8d8' : '#6aa8d8'; ctx.beginPath(); ctx.arc(x + 2, 0, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(x + 3, 0, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, -3, 2.2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4e493f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, 0, 14, 11, 0, 0, TAU); ctx.stroke(); } break; }
      case 'howl': { ctx.translate(-8, 12); drawWolf(ctx, { s: .56, form, age: 1, howl: 1, seed: 3 }); ctx.strokeStyle = 'rgba(255,240,180,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(30, -34, k * 9, -1.6, -.2); ctx.stroke(); } break; }
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      default: iconWolf(ctx, form);
    }
  }
  function icon(key, px, form) {
    form = form || (window.G && window.G.form) || 'gray';
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

  /* the age blend (0 newborn … 1 grown) for a wolf of this weight */
  function ageOf(kg) { return clamp(Math.sqrt(Math.max(0, kg - .4) / 42), 0, 1); }

  return { drawWolf, drawElk, drawBison, drawRaven, drawHopper, drawBiologist, drawTracks, drawPost, drawMeal, drawMilk, drawLeaf, drawIcon, icon, wolfCols, ageOf };
})();
