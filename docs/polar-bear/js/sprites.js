/* ============================================================
   sprites.js — every living thing, drawn with paths
   ============================================================
   THE POLAR BEAR is drawn side-on, facing +x: 100 units from nose
   to tail at s = 1 (`s` scales it), its middle at the origin and
   its paws on the ground at y = +33·s.  An `age` from 0 (newborn)
   to 1 (grown) blends the proportions: a cub has a big round
   head, a short muzzle, round ears and short legs; a grown bear
   has a long neck, a small head with a long "Roman" nose and
   high hindquarters.  Black nose, lips and eyes; white-to-cream
   fur that scatters the light.  Poses: walk, run, sit, lie, curl
   up, stand up on the back legs (sniffing the wind), sniff the
   ground, swim (paddling with the front paws), belly-slide,
   still-hunt (flat by a hole), creep, play-spar, carry a cub.

   Then the ringed seal (resting, looking, a head at its hole), the
   Arctic fox, lemmings and snow buntings, belugas, caribou, the
   scientists' tundra buggy, tracks, the meal, milk, and the icons
   for the HUD, the stickers and the reading pictures.
   ============================================================ */
'use strict';

const Sprites = (function () {
  const iconCache = new Map();
  const C = (hex) => hexToRgb(hex);

  /* the coat colours of a form; a newborn's thin fur shows pink skin underneath */
  function bearCols(form, age) {
    const F = FORMS[form] || FORMS.cream, pink = clamp(1 - age * 6, 0, 1) * .35;
    const m = (c, k) => rgbStr(mixRgb(C(c), C('#f2cfc4'), k));
    return { fur: m(F.fur, pink), fur2: m(F.fur2, pink * .8), belly: m(F.belly, pink), mask: m(F.mask, pink), eye: F.eye, nose: F.nose, line: 'rgba(70,78,92,.55)', lineHex: shade(F.fur2, .45) };
  }
  /* a thick limb: hip → knee → paw, a stroke with a darker outline and a big paw */
  function limb(ctx, pts, w, col, lineCol, paw = 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = lineCol; ctx.lineWidth = w + 2.2; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
    if (!paw) return;
    const [px, py] = pts[pts.length - 1];
    ctx.fillStyle = col; ctx.strokeStyle = lineCol; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(px + w * .2, py + .4, w * .78, w * .4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,26,24,.7)'; ctx.lineWidth = .7;
    for (let k = 0; k < 3; k++) { const cx = px + w * .55 + k * .9, cy = py + .2 + k * .4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 1.6, cy + .6); ctx.stroke(); }
  }

  /* ============================================================
     THE POLAR BEAR
     o: { s, form, age (0..1), sex, walk (phase), moving, run, sit, lie, curl, stand (0..1, up on the back legs),
          sniff (0..1 nose down), swim, slide, still (flat by a hole), crouch (0..1 creeping), spar (0..1),
          carry ('cub'|null), carryForm, eyes (0 shut .. 1 open), snow (0..1), wet, collar, seed, t, mouth (0..1) }
     ============================================================ */
  function drawBear(ctx, o) {
    const s = o.s || 1, a = clamp(o.age === undefined ? 1 : o.age, 0, 1), cols = bearCols(o.form, a);
    const boy = o.sex !== 'girl', walk = o.walk || 0, moving = !!o.moving, run = !!o.run;
    const stand = clamp(Math.max(o.stand || 0, (o.spar || 0) * .75), 0, 1), crouch = clamp(o.crouch || 0, 0, 1), sniff = clamp(o.sniff || 0, 0, 1);
    const sit = !!o.sit, lie = !!o.lie || !!o.still, curl = !!o.curl, swim = !!o.swim, slide = !!o.slide;
    const eyes = o.eyes === undefined ? (a < .06 ? 0 : 1) : o.eyes;
    ctx.save(); ctx.scale(s, s);
    /* proportions by age */
    const ground = 33;
    const hr = lerp(13.5, 8.6, a) * (boy && a > .8 ? 1.06 : 1), muz = lerp(4.5, 12, a), earR = lerp(4.4, 3, a);
    const hx = lerp(-22, -30, a), sx = lerp(10, 15, a);
    const ryC = lerp(17, 17.5, a) * (boy && a > .8 ? 1.06 : 1), ryH = lerp(16, 18, a), cy = lerp(-1, -5, a) + crouch * 7;
    const neckL = lerp(5, 16, a), legW = lerp(10, 13.5, a);
    const fur = cols.fur, dark = cols.fur2, belly = cols.belly, line = cols.line;
    const furFar = rgbStr(mixRgb(hexToRgbAny(fur), [60, 70, 90], .2));
    /* the whole body sinks for lying, sliding, still-hunting */
    let drop = 0;
    if (lie || curl) drop = ground - (cy + ryC) - 1;
    if (slide) drop = ground * .55 - (cy + ryC) + 18;
    ctx.translate(0, drop);
    /* leg swing */
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
    /* ---- the standing pose: hind legs straight down from the hip; the rest of the bear pivots up round the hip ---- */
    const hipY = cy + ryH * .35;
    const pivot = [hx + 2, hipY];
    const rot = -stand * 1.15 + (sit ? -.3 : 0), sitExtra = sit ? (sx - pivot[0]) * Math.sin(.3) : 0;
    /* --- far hind leg (never rotated when standing) --- */
    const hindFar = stand > .05 ? [[hx + 6, hipY], [hx + 7, (hipY + ground) / 2], [hx + 9, ground]] : legPts(hx + 6, hipY, 1, true);
    limb(ctx, hindFar, legW, furFar, line);
    /* --- the near hind leg comes after the body, but the rump's tail first --- */
    ctx.save();
    ctx.translate(pivot[0], pivot[1]); ctx.rotate(rot); ctx.translate(-pivot[0], -pivot[1]);
    /* the tail: a little stub */
    ctx.fillStyle = fur; ctx.strokeStyle = line; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(hx - ryH - 1, cy - ryH * .35, 3.6 + a * 1.5, 3 + a, -.5, 0, TAU); ctx.fill(); ctx.stroke();
    /* far front leg */
    const frontFar = stand > .05 ? [[sx + 2, cy + 6], [sx + 9, cy + 15], [sx + 11, cy + 22]] : legPts(sx + 2, cy + 5, 0, false, sitExtra);
    if (!curl) limb(ctx, frontFar, legW * .95, furFar, line);
    /* --- the body: high hindquarters, a long back, a deep chest, a furry belly fringe --- */
    const bodyG = ctx.createLinearGradient(0, cy - ryH - 4, 0, cy + ryC + 4);
    bodyG.addColorStop(0, fur); bodyG.addColorStop(.55, fur); bodyG.addColorStop(1, dark);
    ctx.fillStyle = bodyG; ctx.strokeStyle = line; ctx.lineWidth = 2;
    const rumpTop = cy - ryH - (a > .3 ? 2.5 : 0);
    ctx.beginPath();
    ctx.moveTo(hx - 4, rumpTop);
    ctx.bezierCurveTo(hx * .4, rumpTop + 1, sx * .3, cy - ryC - .5, sx, cy - ryC + 1);                 /* along the back to the withers */
    ctx.bezierCurveTo(sx + ryC * .7, cy - ryC + 3, sx + ryC * .95, cy - 2, sx + ryC * .8, cy + ryC * .5); /* the chest */
    ctx.bezierCurveTo(sx + ryC * .55, cy + ryC + 2, sx - 2, cy + ryC + 1, sx - 6, cy + ryC);               /* under the chest */
    for (let k = 0; k <= 6; k++) { const u = k / 6, x = lerp(sx - 6, hx + 6, u), y = cy + lerp(ryC, ryH, u) + 1.2 + (k % 2 ? 1.6 : 0); ctx.lineTo(x, y); }  /* a shaggy belly fringe */
    ctx.bezierCurveTo(hx - ryH * .5, cy + ryH + 1, hx - ryH - 3, cy + ryH * .4, hx - ryH - 2, cy - ryH * .3); /* the rump */
    ctx.bezierCurveTo(hx - ryH - 1, rumpTop + 4, hx - 9, rumpTop, hx - 4, rumpTop);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* soft light on the back, and fur texture */
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.ellipse((hx + sx) / 2 - 4, cy - (ryC + ryH) * .38, (sx - hx) * .42, 4, 0, 0, TAU); ctx.fill();
    const RB = mulberry32(o.seed || 3);
    ctx.strokeStyle = 'rgba(120,130,150,.22)'; ctx.lineWidth = .8;
    for (let k = 0; k < 16; k++) { const x = lerp(hx - 6, sx + 6, RB()), y = cy - ryC * .6 + RB() * ryC * 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 2, y + 2, x - 3 - RB() * 2, y + 4); ctx.stroke(); }
    /* snow on the back; wet fur clings and drips */
    if (o.snow > 0) { ctx.fillStyle = `rgba(255,255,255,${.7 * o.snow})`; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(lerp(hx, sx, k / 4), cy - ryC - 1 + Math.sin(k * 2) * 1.5, 2.6, 0, TAU); ctx.fill(); } }
    if (o.wet > 0) { ctx.fillStyle = `rgba(150,180,200,${.22 * o.wet})`; ctx.beginPath(); ctx.ellipse((hx + sx) / 2, cy + 4, (sx - hx) * .55, ryC * .8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(170,210,235,${.6 * o.wet})`; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(hx + 6 + k * 9, cy + ryC + 3 + (k % 2) * 2, 1.1, 2.2, 0, 0, TAU); ctx.fill(); } }
    /* near front leg */
    const frontNear = stand > .05 ? [[sx, cy + 6], [sx + 7 + Math.sin((o.t || 0) * 3) * 2 * (o.spar ? 1 : 0), cy + 16], [sx + 6 + (o.spar ? 10 : 0), cy + 24 - (o.spar ? 8 : 0)]] : legPts(sx, cy + 5, 1, false, sitExtra);
    if (!curl) limb(ctx, frontNear, legW, fur, line);
    /* --- the neck and head --- */
    let headA = sniff * .7 + (lie && !o.still ? -.1 : 0) + (o.still ? .55 : 0) + crouch * .35 + (swim ? -.28 : 0) + (slide ? -.2 : 0) - stand * .55 + (sit ? .2 : 0);
    if (stand > .05) headA += stand * 1.05;    /* keep the nose level-ish when up on the back legs, lifted to sniff */
    if (curl) headA = .9;
    const nx = sx + ryC * .5, ny = cy - ryC * .45;
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(headA);
    /* the long neck */
    ctx.fillStyle = fur; ctx.strokeStyle = line; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-12, -ryC * .55); ctx.quadraticCurveTo(neckL * .6, -ryC * .62 - 1, neckL + 3, -hr * .6); ctx.lineTo(neckL + 4, hr * .7); ctx.quadraticCurveTo(neckL * .4, ryC * .55, -10, ryC * .75); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -ryC * .58); ctx.quadraticCurveTo(neckL * .6, -ryC * .62 - 1, neckL + 3, -hr * .6); ctx.moveTo(neckL + 4, hr * .7); ctx.quadraticCurveTo(neckL * .4, ryC * .55, -2, ryC * .7); ctx.stroke();
    ctx.translate(neckL + hr * .55, -1);
    if (curl) ctx.translate(-10, 9);
    /* the skull */
    const hg = ctx.createRadialGradient(-hr * .2, -hr * .4, 1, 0, 0, hr * 1.2); hg.addColorStop(0, fur); hg.addColorStop(1, dark);
    ctx.fillStyle = hg; ctx.strokeStyle = line; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(0, 0, hr * 1.02, hr * .84, 0, 0, TAU); ctx.fill(); ctx.stroke();
    /* the round little ear */
    ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(-hr * .35, -hr * .78, earR, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(60,50,50,.35)'; ctx.beginPath(); ctx.arc(-hr * .3, -hr * .74, earR * .5, 0, TAU); ctx.fill();
    /* the long muzzle with its gently curved ("Roman") nose */
    const mo = clamp(o.mouth || 0, 0, 1) + (o.spar ? .5 + .3 * Math.sin((o.t || 0) * 6) : 0);
    ctx.fillStyle = cols.mask; ctx.strokeStyle = line; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hr * .2, -hr * .72);
    ctx.quadraticCurveTo(hr * .7 + muz * .5, -hr * .82, hr * .78 + muz, -hr * .22);
    ctx.lineTo(hr * .78 + muz, hr * .08 + mo * 2);
    ctx.quadraticCurveTo(hr * .6 + muz * .6, hr * .62 + mo * 5, hr * .1, hr * .68 + mo * 4);
    ctx.lineTo(hr * .2, hr * .2); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* the black lips, the open mouth (play-sparring), the black nose */
    if (mo > .08) { ctx.fillStyle = '#3a1a20'; ctx.beginPath(); ctx.moveTo(hr * .5 + muz * .3, hr * .22); ctx.lineTo(hr * .78 + muz - 1, hr * .14); ctx.lineTo(hr * .5 + muz * .5, hr * .3 + mo * 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a3050'; ctx.beginPath(); ctx.ellipse(hr * .55 + muz * .5, hr * .3 + mo * 3, 2.2, 1.2, .3, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = '#1e1a1c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hr * .4 + muz * .25, hr * .26); ctx.quadraticCurveTo(hr * .6 + muz * .6, hr * .22, hr * .78 + muz - 1, hr * .1); ctx.stroke(); }
    ctx.fillStyle = cols.nose; ctx.beginPath(); ctx.ellipse(hr * .74 + muz, -hr * .14, 3 + a * .6, 2.5 + a * .4, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(hr * .74 + muz - .8, -hr * .24, .8, 0, TAU); ctx.fill();
    /* the small dark eye (shut for a newborn or a sleeper) */
    const ex = hr * .3, ey = -hr * .3;
    if (eyes > .2) {
      ctx.fillStyle = cols.eye; ctx.beginPath(); ctx.ellipse(ex, ey, 1.9 + (1 - a) * .9, (1.9 + (1 - a) * .9) * eyes, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(ex - .5, ey - .6, .6, 0, TAU); ctx.fill();
    } else { ctx.strokeStyle = '#2a2224'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex - 2.4, ey + .4); ctx.quadraticCurveTo(ex, ey + 2, ex + 2.4, ey + .4); ctx.stroke(); }
    /* a cub carried very gently in the mouth */
    if (o.carry === 'cub') { ctx.save(); ctx.translate(hr * .7 + muz + 3, hr * .7); ctx.rotate(.5); drawBear(ctx, { s: .22, form: o.carryForm || o.form, age: .02, lie: true, eyes: 0, seed: 9 }); ctx.restore(); }
    ctx.restore();
    /* the radio collar (mothers only: a male's neck is wider than his head) */
    if (o.collar) { ctx.save(); ctx.translate(nx + neckL * .15, ny + 1); ctx.rotate(headA * .6 - .35); ctx.strokeStyle = '#2a3038'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, ryC * .62, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#e8b030'; rr(ctx, -3, ryC * .5, 6, 5, 1.5); ctx.fill(); ctx.restore(); }
    ctx.restore();   /* end of the part that tilts up when standing */
    /* near hind leg, last, so it sits in front of the belly */
    const hindNear = stand > .05 ? [[hx, hipY], [hx + 1, (hipY + ground) / 2], [hx + 3, ground]] : legPts(hx, hipY, 0, true);
    if (!curl) limb(ctx, hindNear, legW * 1.05, fur, line);
    else { /* curled up: a big round haunch, the paws tucked */ ctx.fillStyle = fur; ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(hx + 2, cy + ryH * .3, ryH * .8, ryH * .75, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  /* hex or rgba() into [r,g,b] */
  function hexToRgbAny(c) { if (c[0] === '#') return hexToRgb(c); const m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [230, 230, 230]; }

  /* ============================================================
     THE OTHER ANIMALS
     ============================================================ */
  /* a ringed seal lying on the ice (facing +x), canonical 60 long, belly on the ice at y = 0.
     o: { s, look (0..1 head up), head (only the head, at a hole), alpha } */
  function drawSeal(ctx, o) {
    const s = o.s || 1, look = clamp(o.look || 0, 0, 1);
    ctx.save(); ctx.scale(s, s); ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
    const body = '#7f8c96', dark = '#4e5a64', pale = '#b8c4cc';
    if (o.head) {
      /* just the round head poking up out of the water at a breathing hole */
      ctx.fillStyle = body; ctx.strokeStyle = dark; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(0, -6, 8, 9, 0, Math.PI, TAU); ctx.lineTo(8, 2); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0e1418'; ctx.beginPath(); ctx.arc(-3.2, -8, 2, 0, TAU); ctx.arc(3.2, -8, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3.6, -8.6, .6, 0, TAU); ctx.arc(2.8, -8.6, .6, 0, TAU); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-1.2, -3.6, .9, .6, 0, 0, TAU); ctx.ellipse(1.2, -3.6, .9, .6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(240,240,240,.85)'; ctx.lineWidth = .5; for (const d of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(d * 2, -3 + k * .6); ctx.lineTo(d * 8, -4 + k * 1.4); ctx.stroke(); }
      ctx.restore(); return;
    }
    /* the spindle-shaped body with its pale rings */
    const g = ctx.createLinearGradient(0, -14, 0, 0); g.addColorStop(0, dark); g.addColorStop(.6, body); g.addColorStop(1, pale);
    ctx.fillStyle = g; ctx.strokeStyle = '#3a444c'; ctx.lineWidth = 1.2;
    const hx = 22, hy = -9 - look * 9;
    ctx.beginPath(); ctx.moveTo(-30, -3); ctx.quadraticCurveTo(-26, -9, -14, -12); ctx.quadraticCurveTo(4, -15, 16, -10 - look * 4); ctx.lineTo(hx - 2, hy + 4); ctx.lineTo(hx, hy + 9); ctx.quadraticCurveTo(10, 0, 0, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,220,226,.55)'; ctx.lineWidth = .9;
    const R = mulberry32(5); for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse(-20 + R() * 34, -9 + R() * 6, 2 + R() * 1.4, 1.3, 0, 0, TAU); ctx.stroke(); }
    /* back flippers */
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-28, -3); ctx.lineTo(-38, -7); ctx.lineTo(-36, -1); ctx.lineTo(-38, 3); ctx.closePath(); ctx.fill();
    /* front flipper */
    ctx.beginPath(); ctx.ellipse(10, -2, 5, 2, .4, 0, TAU); ctx.fill();
    /* the head: round, big dark eyes, whiskers */
    ctx.fillStyle = body; ctx.strokeStyle = '#3a444c'; ctx.beginPath(); ctx.ellipse(hx, hy, 7, 6, -look * .3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0e1418'; ctx.beginPath(); ctx.arc(hx + 2, hy - 1.5, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 1.6, hy - 2.1, .5, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(hx + 6.4, hy + .8, .9, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(240,240,240,.8)'; ctx.lineWidth = .5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hx + 6, hy + 1.5 + k * .5); ctx.lineTo(hx + 12, hy + k * 1.4); ctx.stroke(); }
    ctx.restore();
  }
  /* an Arctic fox, side on, facing +x, canonical 50 long, paws at y = +15.
     o: { s, ph, state ('sit'|'trot'|'run'), summer } */
  function drawFox(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, summer = !!o.summer, moving = o.state === 'trot' || o.state === 'run';
    ctx.save(); ctx.scale(s, s);
    const fur = summer ? '#8a7a66' : '#f4f6f8', fur2 = summer ? '#5a4c3e' : '#cfd6de', line = 'rgba(70,74,84,.6)', belly = summer ? '#d8c8a8' : '#ffffff';
    const amp = moving ? (o.state === 'run' ? 8 : 5) : 0;
    const legs = (k, x) => { const sw = Math.cos(ph + k * Math.PI) * amp; return [[x, 2], [x + sw * .4, 9], [x + sw, 15]]; };
    ctx.lineCap = 'round';
    for (const [k, x, far] of [[1, -12, true], [0, 9, true], [0, -14, false], [1, 7, false]]) { const p = legs(k, x + (far ? 2 : 0)); if (o.state === 'sit' && x < 0) continue; ctx.strokeStyle = line; ctx.lineWidth = 4.4; ctx.beginPath(); p.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke(); ctx.strokeStyle = far ? fur2 : fur; ctx.lineWidth = 3; ctx.beginPath(); p.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke(); }
    const sitTilt = o.state === 'sit' ? -.4 : 0;
    ctx.save(); ctx.translate(9, 2); ctx.rotate(sitTilt); ctx.translate(-9, -2);
    /* the big bushy tail */
    ctx.fillStyle = fur; ctx.strokeStyle = line; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-16, -2); ctx.quadraticCurveTo(-30, -6 + Math.sin(ph * .5) * 2, -36, 4); ctx.quadraticCurveTo(-28, 10, -16, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* body */
    const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, fur); g.addColorStop(1, belly);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-2, 0, 16, 7.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (o.state === 'sit') { ctx.beginPath(); ctx.ellipse(-12, 6, 8, 7, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    /* head: round, short muzzle, small rounded ears */
    ctx.beginPath(); ctx.arc(15, -6, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -9); ctx.lineTo(26, -5); ctx.lineTo(19, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const dx of [-2, 3]) { ctx.beginPath(); ctx.moveTo(11 + dx, -10); ctx.quadraticCurveTo(12 + dx, -16, 15 + dx, -11); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#1a1416'; ctx.beginPath(); ctx.arc(25.6, -5, 1.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(17.5, -8, 1.1, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  /* a lemming (round, brown and orange) or a snow bunting (a little white-and-black bird) */
  function drawHopper(ctx, h, t) {
    if (h.hidden > 0) return;
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.dir, 1);
    if (h.kind === 'lemming') {
      ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.ellipse(0, -2.8, 4.6, 2.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d89850'; ctx.beginPath(); ctx.ellipse(-.6, -1.5, 3.6, 1.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.ellipse(-.5, -4.6, 3, 1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#100c0a'; ctx.beginPath(); ctx.arc(3.2, -3.4, .55, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8a8a0'; ctx.beginPath(); ctx.arc(4.5, -2.6, .5, 0, TAU); ctx.fill();
    } else {
      const flap = h.air > 0 ? Math.sin(t * 40) : 0;
      ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.ellipse(0, -3, 3.6, 2.4, -.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.moveTo(-1, -4); ctx.lineTo(-5, -4 - flap * 4); ctx.lineTo(-4, -1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, -2.6); ctx.lineTo(-6, -2); ctx.lineTo(-3, -1.8); ctx.fill();
      ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(3, -5, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8a050'; ctx.beginPath(); ctx.moveTo(4.6, -5.2); ctx.lineTo(6.4, -4.8); ctx.lineTo(4.6, -4.3); ctx.fill();
      ctx.fillStyle = '#100c0a'; ctx.beginPath(); ctx.arc(3.6, -5.4, .45, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 0); ctx.moveTo(1.4, -1); ctx.lineTo(1.4, 0); ctx.stroke();
    }
    ctx.restore();
  }
  /* a beluga: a white whale arching up out of the sea (u 0..1 across its roll) */
  function drawBeluga(ctx, o) {
    const s = o.s || 1, u = clamp(o.u || 0, 0, 1);
    ctx.save(); ctx.scale(s * (o.dir || 1), s);
    const rise = Math.sin(u * Math.PI);
    ctx.translate(lerp(-20, 20, u), 0);
    ctx.fillStyle = '#eef4f6'; ctx.strokeStyle = 'rgba(120,150,170,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-30, 6); ctx.quadraticCurveTo(-8, -18 * rise - 2, 18, -10 * rise + 2); ctx.quadraticCurveTo(28, -10 * rise + 4, 30, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (u < .6) { ctx.fillStyle = '#eef4f6'; ctx.beginPath(); ctx.ellipse(20, -9 * rise, 9, 6 * rise + 1, .2, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a2228'; ctx.beginPath(); ctx.arc(22, -9 * rise - 1, 1, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  /* a caribou, side on, facing +x; canonical 100 long at the shoulder, hooves at y = +60 */
  function drawCaribou(ctx, o) {
    const s = o.s || 1, ph = o.ph || 0, moving = Math.abs(o.vx || 0) > 4;
    ctx.save(); ctx.scale(s, s);
    const amp = moving ? 12 : 0, line = '#3a3026', body = '#8a7a66', dark = '#5a4c3e', pale = '#ece6da';
    const legs = (k, hx, hy) => { const sw = Math.cos(ph + k * Math.PI) * amp, up = moving ? Math.max(0, Math.sin(ph + k * Math.PI)) * 7 : 0; return [[hx, hy], [hx + sw * .4 - 2, hy + 30 - up * .5], [hx + sw, hy + 58 - up]]; };
    for (const [k, hx, hy, far] of [[1, -30, 2, true], [0, 20, 4, true], [0, -30, 2, false], [1, 20, 4, false]]) {
      const pts = legs(k, hx + (far ? 4 : 0), hy);
      ctx.lineCap = 'round'; ctx.strokeStyle = line; ctx.lineWidth = 9; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.strokeStyle = far ? '#4a4034' : dark; ctx.lineWidth = 6.5; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.ellipse(pts[2][0] + 2, pts[2][1] + 1, 6, 3, 0, 0, TAU); ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -24, 0, 20); g.addColorStop(0, dark); g.addColorStop(.45, body); g.addColorStop(1, pale);
    ctx.fillStyle = g; ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -18); ctx.bezierCurveTo(10, -28, -30, -26, -46, -10); ctx.bezierCurveTo(-52, 6, -40, 18, -24, 18); ctx.lineTo(20, 20); ctx.bezierCurveTo(34, 18, 38, 2, 30, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pale; ctx.beginPath(); ctx.ellipse(-44, 0, 7, 9, 0, 0, TAU); ctx.fill();
    /* the pale shaggy neck and the head */
    ctx.fillStyle = pale; ctx.beginPath(); ctx.moveTo(26, -16); ctx.quadraticCurveTo(44, -34, 52, -46); ctx.lineTo(60, -40); ctx.quadraticCurveTo(48, -18, 38, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(60, -46, 11, 7.5, .35, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(60, -50, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(69, -41, 4.5, 3.5, .3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d8ccb4'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    const big = o.bull ? 1 : .6;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(54 + side * 2, -54); ctx.quadraticCurveTo(40 + side * 4, -80 * big, 52 + side * 5, -100 * big); ctx.moveTo(46 + side * 3, -70 * big); ctx.lineTo(56 + side * 3, -78 * big); ctx.moveTo(48 + side * 4, -90 * big); ctx.lineTo(58 + side * 4, -94 * big); ctx.moveTo(56, -58); ctx.lineTo(64, -66); ctx.stroke(); }
    ctx.restore();
  }
  /* the scientists' tundra buggy: a big bus on huge tyres, a scientist leaning out with an H antenna; canonical 160 long, tyres on y = 0 */
  function drawBuggy(ctx, o) {
    const s = o.s || 1, wave = o.wave || 0;
    ctx.save(); ctx.scale(s, s);
    /* huge tyres */
    for (const x of [-50, 46]) { ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.arc(x, -22, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#5a5a60'; ctx.beginPath(); ctx.arc(x, -22, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2e2e34'; ctx.lineWidth = 3; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 17, -22 + Math.sin(a) * 17); ctx.lineTo(x + Math.cos(a) * 22, -22 + Math.sin(a) * 22); ctx.stroke(); } }
    /* the body of the buggy */
    ctx.fillStyle = '#e8ecee'; ctx.strokeStyle = '#6a7278'; ctx.lineWidth = 2;
    rr(ctx, -84, -104, 168, 62, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c84a2a'; ctx.fillRect(-84, -56, 168, 8);
    ctx.fillStyle = '#6aa8d0'; for (let k = 0; k < 6; k++) { rr(ctx, -74 + k * 25, -96, 18, 22, 3); ctx.fill(); }
    ctx.fillStyle = '#4a4e54'; ctx.fillRect(-60, -42, 120, 6);
    /* the back deck with a railing, and a scientist with the antenna */
    ctx.strokeStyle = '#6a7278'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(84, -104); ctx.lineTo(84, -76); ctx.moveTo(84, -96); ctx.lineTo(110, -96); ctx.moveTo(110, -104); ctx.lineTo(110, -62); ctx.moveTo(84, -62); ctx.lineTo(112, -62); ctx.stroke();
    ctx.save(); ctx.translate(98, -64);
    ctx.fillStyle = '#c84a2a'; rr(ctx, -7, -30, 14, 22, 5); ctx.fill();
    ctx.fillStyle = '#c8a07a'; ctx.beginPath(); ctx.arc(0, -36, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a6ab0'; ctx.beginPath(); ctx.arc(0, -38, 6.4, Math.PI, TAU); ctx.fill(); ctx.fillRect(-6.4, -39, 12.8, 2.5);
    ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.arc(-2, -36, .9, 0, TAU); ctx.arc(2, -36, .9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c84a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(5, -26); ctx.lineTo(12, -36); ctx.stroke();
    const a = -2.3 + Math.sin(wave * 3) * .5; ctx.beginPath(); ctx.moveTo(-5, -26); ctx.lineTo(-5 + Math.cos(a) * 12, -26 + Math.sin(a) * 12); ctx.stroke();
    ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(12, -36); ctx.lineTo(12, -56); ctx.moveTo(3, -56); ctx.lineTo(21, -56); ctx.moveTo(4, -50); ctx.lineTo(20, -50); ctx.moveTo(5, -44); ctx.lineTo(19, -44); ctx.stroke();
    const k = (wave * .7) % 1; ctx.strokeStyle = `rgba(255,230,140,${.8 * (1 - k)})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(12, -60, 5 + k * 18, -2.4, -.7); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  /* tracks: a little set of prints on the snow, canonical 40 long */
  function drawTracks(ctx, kind, dir = 1, col = 'rgba(80,100,130,.55)') {
    ctx.save(); ctx.scale(dir, 1); ctx.fillStyle = col; ctx.strokeStyle = col;
    const toe = (x, y, r) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.3, 0, 0, TAU); ctx.fill(); };
    const print = (x, y, k) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      if (kind === 'bear') { ctx.beginPath(); ctx.ellipse(0, 1.6, 3.8, 3, 0, 0, TAU); ctx.fill(); for (let t = 0; t < 5; t++) { const tx = -3.4 + t * 1.7, ty = -2.4 - Math.sin(t / 4 * Math.PI) * .8; toe(tx, ty, .75); } }
      else if (kind === 'fox' || kind === 'wolf') { const z = kind === 'wolf' ? 1.25 : .8; ctx.beginPath(); ctx.ellipse(0, 1.4 * z, 1.8 * z, 1.5 * z, 0, 0, TAU); ctx.fill(); for (const [tx, ty] of [[-1.8, -1], [-.7, -2.3], [.7, -2.3], [1.8, -1]]) toe(tx * z, ty * z, .65 * z); }
      else if (kind === 'caribou') { ctx.beginPath(); ctx.arc(-1.4, 0, 2.2, Math.PI * .5, Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(1.4, 0, 2.2, -Math.PI * .5, Math.PI * .5); ctx.closePath(); ctx.fill(); }
      else if (kind === 'hare') { ctx.beginPath(); ctx.ellipse(-1.5, 0, 1.1, 3.2, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(1.5, 0, 1.1, 3.2, 0, 0, TAU); ctx.fill(); toe(-.6, 5, .7); toe(.8, 6.5, .7); }
      else if (kind === 'ptarmigan') { ctx.lineWidth = .9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -2.5); ctx.moveTo(0, 1); ctx.lineTo(-2, -2); ctx.moveTo(0, 1); ctx.lineTo(2, -2); ctx.moveTo(0, 2); ctx.lineTo(0, 3.2); ctx.stroke(); }
      else if (kind === 'lemming') { toe(-.5, 0, .45); toe(.5, .3, .45); }
      ctx.restore();
    };
    if (kind === 'lemming') for (let k = 0; k < 7; k++) print(-18 + k * 6, k % 2 ? .5 : -.5, 1.4);
    else for (let k = 0; k < 4; k++) print(-18 + k * 12, (k % 2 ? 2 : -2), kind === 'bear' ? 1.25 : 1);
    ctx.restore();
  }
  /* a meal Mum found: a tidy bundle on the snow (what it is stays off screen) */
  function drawMeal(ctx, s = 1) {
    ctx.save(); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 12); g.addColorStop(0, '#c89a6a'); g.addColorStop(1, '#6a4a30');
    ctx.fillStyle = g; ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, -.15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-7, -3); ctx.quadraticCurveTo(0, -8, 7, -3); ctx.stroke();
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
  /* a big grey boulder (shelter), canonical w × h, ground at 0 */
  function drawRock(ctx, r) {
    const R = mulberry32(r.seed || 3), w = r.w, h = r.h;
    const g = ctx.createLinearGradient(0, -h, 0, 4); g.addColorStop(0, '#a8a6a2'); g.addColorStop(1, '#5a5c60');
    ctx.fillStyle = g; ctx.strokeStyle = '#3e4044'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w * .5, 4);
    const n = 9; for (let k = 0; k <= n; k++) { const u = k / n, a = Math.PI * (1 - u); ctx.lineTo(Math.cos(a) * w * .5 * (.9 + R() * .15), -Math.sin(a) * h * (.85 + R() * .2)); }
    ctx.lineTo(w * .5, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-w * .15, -h * .7, w * .2, h * .12, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(150,170,110,.35)'; ctx.beginPath(); ctx.ellipse(w * .1, -h * .5, w * .12, h * .06, .3, 0, TAU); ctx.fill();
  }
  /* the seal hole as a picture: a round dark hole in the snow, with a ring of frost */
  function drawHolePic(ctx, s = 1, head) {
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#eef4fa'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a3a5a'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 4.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,190,220,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, TAU); ctx.stroke();
    if (head) { ctx.save(); ctx.translate(0, 2); drawSeal(ctx, { s: 1.2, head: true }); ctx.restore(); }
    ctx.restore();
  }

  /* ============================================================
     ICONS (HUD, life wheel, stickers, reading pictures): drawn in
     a 100×100 box centred on 0,0
     ============================================================ */
  function snowFloor(ctx, y = 30) { const g = ctx.createLinearGradient(0, y - 6, 0, 50); g.addColorStop(0, '#f4f8ff'); g.addColorStop(1, '#c8d8ea'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-50, 50); ctx.lineTo(-50, y); ctx.quadraticCurveTo(0, y - 8, 50, y); ctx.lineTo(50, 50); ctx.closePath(); ctx.fill(); }
  function iconBear(ctx, form, extra = {}) { ctx.translate(-4, 6); drawBear(ctx, Object.assign({ s: .74, form, age: 1, sex: 'boy', seed: 3 }, extra)); }
  function drawIcon(ctx, key, px, form) {
    form = form || 'cream';
    switch (key) {
      case 'bear': case 'adult': case 'boy': case 'male': iconBear(ctx, form); break;
      case 'girl': iconBear(ctx, form, { sex: 'girl' }); break;
      case 'newborn': snowFloor(ctx, 28); ctx.translate(2, 4); drawBear(ctx, { s: 1.15, form, age: 0, lie: true, eyes: 0, seed: 3 }); break;
      case 'cub': ctx.translate(0, 6); drawBear(ctx, { s: .92, form, age: .22, seed: 3, sit: false }); break;
      case 'cubs': case 'twins': { snowFloor(ctx, 34); for (const [x, y, a, f] of [[-20, 10, .22, form], [22, 12, .2, 'snow']]) { ctx.save(); ctx.translate(x, y); if (x > 0) ctx.scale(-1, 1); drawBear(ctx, { s: .6, form: f, age: a, seed: 3, sit: x > 0 }); ctx.restore(); } break; }
      case 'seacub': ctx.translate(-2, 6); drawBear(ctx, { s: .74, form, age: .5, seed: 3, moving: true, walk: 1 }); break;
      case 'yearling': ctx.translate(-3, 8); drawBear(ctx, { s: .72, form, age: .82, seed: 3, sit: true }); break;
      case 'young': case 'alone': { ctx.fillStyle = '#cfe0f2'; ctx.fillRect(-50, 20, 100, 30); ctx.fillStyle = '#eef6ff'; ctx.beginPath(); ctx.moveTo(-50, 22); ctx.lineTo(-10, 18); ctx.lineTo(50, 24); ctx.lineTo(50, 30); ctx.lineTo(-50, 30); ctx.fill(); ctx.translate(-4, -2); drawBear(ctx, { s: .66, form, age: .95, seed: 3, moving: true, walk: 2 }); break; }
      case 'parent': case 'mother': { snowFloor(ctx, 36); ctx.translate(-10, 2); drawBear(ctx, { s: .62, form, age: 1, sex: 'girl', seed: 3 }); for (const [x, y, f] of [[16, 18, form], [32, 16, 'snow']]) { ctx.save(); ctx.translate(x, y); drawBear(ctx, { s: .3, form: f, age: .2, seed: 3 }); ctx.restore(); } break; }
      case 'mum': ctx.translate(-4, 8); drawBear(ctx, { s: .66, form: form === 'gold' ? 'gold' : 'cream', age: 1, sex: 'girl', lie: true, collar: true, seed: 5 }); break;
      case 'twin': ctx.translate(0, 6); drawBear(ctx, { s: .88, form: 'snow', age: .3, seed: 7, sit: true }); break;
      case 'mate': { ctx.save(); ctx.translate(-22, 10); drawBear(ctx, { s: .5, form, age: 1, seed: 3 }); ctx.restore(); ctx.save(); ctx.translate(26, 10); ctx.scale(-1, 1); drawBear(ctx, { s: .48, form: form === 'snow' ? 'cream' : 'snow', age: 1, sex: 'girl', seed: 3 }); ctx.restore(); ctx.fillStyle = '#ff7aa8'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', 2, -22); break; }
      case 'spar': { ctx.save(); ctx.translate(-16, 4); drawBear(ctx, { s: .5, form, age: 1, spar: 1, t: 1, seed: 3 }); ctx.restore(); ctx.save(); ctx.translate(18, 4); ctx.scale(-1, 1); drawBear(ctx, { s: .5, form: 'snow', age: 1, spar: 1, t: 2, seed: 4 }); ctx.restore(); break; }
      case 'sniff': case 'stand': { snowFloor(ctx, 38); ctx.translate(-8, 4); drawBear(ctx, { s: .66, form, age: .9, stand: 1, seed: 3 }); ctx.strokeStyle = 'rgba(120,170,220,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(44 - k * 6, -40 + k * 10); ctx.quadraticCurveTo(30 - k * 6, -36 + k * 10, 24 - k * 4, -40 + k * 10); ctx.stroke(); } break; }
      case 'slide': { ctx.fillStyle = '#eef4ff'; ctx.beginPath(); ctx.moveTo(-50, -10); ctx.lineTo(50, 40); ctx.lineTo(-50, 50); ctx.closePath(); ctx.fill(); ctx.save(); ctx.translate(-6, 2); ctx.rotate(.45); drawBear(ctx, { s: .7, form, age: .25, slide: true, seed: 3 }); ctx.restore(); ctx.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(-34 + k * 6, -6 + k * 3, 2.4, 0, TAU); ctx.fill(); } break; }
      case 'swim': case 'sea': case 'water': { ctx.fillStyle = '#2f6c9a'; ctx.fillRect(-50, 4, 100, 46); ctx.save(); ctx.translate(-2, 2); drawBear(ctx, { s: .66, form, age: .7, swim: true, walk: 1, seed: 3 }); ctx.restore(); ctx.fillStyle = 'rgba(40,110,160,.7)'; ctx.fillRect(-50, 8, 100, 42); ctx.strokeStyle = '#e8f4ff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -50; x <= 50; x += 5) ctx.lineTo(x, 6 + Math.sin(x * .2) * 2); ctx.stroke(); break; }
      case 'den': {
        ctx.fillStyle = '#e8f0fa'; ctx.beginPath(); ctx.moveTo(-50, 44); ctx.lineTo(-50, 4); ctx.quadraticCurveTo(-10, -44, 50, -6); ctx.lineTo(50, 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-50, 4); ctx.quadraticCurveTo(-10, -44, 50, -6); ctx.lineTo(50, 2); ctx.quadraticCurveTo(-10, -34, -50, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a3a52'; ctx.beginPath(); ctx.ellipse(6, 20, 18, 12, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(10, 22); drawBear(ctx, { s: .26, form, age: .25, seed: 3 }); ctx.restore();
        break;
      }
      case 'milk': drawMilk(ctx, 2.6); break;
      case 'meal': snowFloor(ctx, 20); ctx.translate(0, 10); drawMeal(ctx, 2.8); break;
      case 'seal': { ctx.fillStyle = '#eef4fa'; ctx.fillRect(-50, 16, 100, 34); ctx.translate(0, 18); drawSeal(ctx, { s: 1.25, look: .6 }); break; }
      case 'hole': drawHolePic(ctx, 1.4, true); break;
      case 'fox': snowFloor(ctx, 30); ctx.translate(2, 14); drawFox(ctx, { s: 1.5, state: 'sit', summer: false }); break;
      case 'lemming': ctx.save(); ctx.scale(7, 7); ctx.translate(0, 3); drawHopper(ctx, { x: 0, y: 0, kind: 'lemming', dir: 1, air: 0, hidden: 0 }, 0); ctx.restore(); break;
      case 'bird': case 'bunting': ctx.save(); ctx.scale(7, 7); ctx.translate(0, 4); drawHopper(ctx, { x: 0, y: 0, kind: 'bunting', dir: 1, air: 0, hidden: 0 }, 0); ctx.restore(); break;
      case 'whale': case 'beluga': { ctx.fillStyle = '#2f6c9a'; ctx.fillRect(-50, 6, 100, 44); ctx.translate(0, 8); drawBeluga(ctx, { s: 1.4, u: .45, dir: 1 }); ctx.fillStyle = 'rgba(40,110,160,.55)'; ctx.fillRect(-50, 0, 100, 42); break; }
      case 'caribou': ctx.translate(-6, 6); drawCaribou(ctx, { s: .52, bull: true }); break;
      case 'tracks': { ctx.fillStyle = '#eef4fa'; ctx.fillRect(-46, -46, 92, 92); ctx.save(); ctx.scale(2.2, 2.2); drawTracks(ctx, 'bear', 1, 'rgba(70,100,140,.75)'); ctx.restore(); break; }
      case 'paw': { ctx.fillStyle = '#f2f0ea'; ctx.beginPath(); ctx.ellipse(0, 6, 34, 30, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1e1a1c'; ctx.beginPath(); ctx.ellipse(0, 14, 18, 12, 0, 0, TAU); ctx.fill(); for (let t = 0; t < 5; t++) { const x = -18 + t * 9, y = -10 - Math.sin(t / 4 * Math.PI) * 6; ctx.beginPath(); ctx.ellipse(x, y, 4.6, 5.6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 1.6, y - 5); ctx.lineTo(x, y - 12); ctx.lineTo(x + 1.6, y - 5); ctx.fill(); } break; }
      case 'scent': case 'wind': { for (let k = 0; k < 3; k++) { ctx.strokeStyle = ['#9ab4c8', '#c8a070', '#bfe4f0'][k]; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-20 + k * 20, 30); ctx.bezierCurveTo(-34 + k * 20, 10, -6 + k * 20, -4, -20 + k * 20, -24); ctx.stroke(); } ctx.fillStyle = '#141012'; ctx.beginPath(); ctx.ellipse(-6, 34, 8, 6, 0, 0, TAU); ctx.fill(); break; }
      case 'snow': { ctx.fillStyle = '#eef4ff'; ctx.beginPath(); ctx.moveTo(-46, 44); ctx.quadraticCurveTo(-20, 6, 10, 14); ctx.quadraticCurveTo(30, 18, 46, 6); ctx.lineTo(46, 44); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const [x, y] of [[-20, -24], [16, -30], [30, -6]]) { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.stroke(); } } break; }
      case 'ice': case 'floe': { ctx.fillStyle = '#2f6c9a'; ctx.fillRect(-50, 10, 100, 40); for (const [x, w] of [[-44, 40], [6, 34]]) { ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x + 4, 2); ctx.lineTo(x + w - 2, 0); ctx.lineTo(x + w, 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#9cc8e4'; ctx.fillRect(x + 1, 12, w - 2, 6); } break; }
      case 'ridge': { ctx.fillStyle = '#eaf6ff'; ctx.fillRect(-50, 24, 100, 26); ctx.fillStyle = '#cfe6f6'; ctx.strokeStyle = '#8ab8d8'; ctx.lineWidth = 2; for (const [x, y, w, h, a] of [[-24, 14, 22, 18, .3], [-4, 4, 24, 26, -.2], [16, 10, 22, 20, .4], [-14, 0, 16, 14, -.5]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore(); } break; }
      case 'lead': { ctx.fillStyle = '#eaf6ff'; ctx.fillRect(-50, -10, 100, 60); ctx.fillStyle = '#1e5a8a'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(8, -10); ctx.lineTo(14, 50); ctx.lineTo(-16, 50); ctx.closePath(); ctx.fill(); break; }
      case 'rock': ctx.translate(0, 34); drawRock(ctx, { w: 80, h: 56, seed: 7 }); break;
      case 'hill': case 'land': { ctx.fillStyle = '#8a9a6a'; ctx.beginPath(); ctx.moveTo(-48, 40); ctx.quadraticCurveTo(-10, -30, 48, 30); ctx.lineTo(48, 40); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c8a050'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(-30 + k * 9, 30 - Math.sin(k) * 6, 3, 0, TAU); ctx.fill(); } break; }
      case 'shore': { ctx.fillStyle = '#2f6c9a'; ctx.fillRect(-50, 6, 100, 44); ctx.fillStyle = '#a8a294'; ctx.beginPath(); ctx.moveTo(-50, 50); ctx.lineTo(-50, 0); ctx.quadraticCurveTo(-10, -4, 20, 50); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#8a9a6a'; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(-30, -12, -6, 6); ctx.lineTo(-50, 8); ctx.fill(); break; }
      case 'moon': { ctx.fillStyle = '#f5e8a0'; ctx.strokeStyle = '#c9b860'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
      case 'sun': { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, '#fff5b0'); g.addColorStop(1, '#f5b820'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f5b820'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); } break; }
      case 'lights': case 'aurora': { ctx.fillStyle = '#0c1630'; ctx.fillRect(-50, -50, 100, 100); for (let k = 0; k < 4; k++) { const g = ctx.createLinearGradient(0, -40, 0, 30); g.addColorStop(0, 'rgba(120,255,180,0)'); g.addColorStop(.5, k % 2 ? 'rgba(120,255,190,.75)' : 'rgba(170,120,255,.6)'); g.addColorStop(1, 'rgba(120,255,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-50 + k * 22, 30); ctx.bezierCurveTo(-40 + k * 22, -10, -20 + k * 22, -30, -10 + k * 26, -44); ctx.lineTo(4 + k * 26, -44); ctx.bezierCurveTo(-6 + k * 22, -20, -26 + k * 22, 0, -36 + k * 22, 30); ctx.closePath(); ctx.fill(); } ctx.fillStyle = '#e8f0fa'; ctx.fillRect(-50, 34, 100, 16); ctx.fillStyle = '#fff'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(-44 + k * 11, -36 + (k * 37) % 30, 1, 0, TAU); ctx.fill(); } break; }
      case 'rain': ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(-12, -8, 16, 0, TAU); ctx.arc(8, -14, 18, 0, TAU); ctx.arc(22, -4, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3f9be6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const x of [-16, -2, 12]) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x - 5, 32); ctx.stroke(); } break;
      case 'storm': case 'blizzard': { ctx.fillStyle = '#9aa8b8'; ctx.beginPath(); ctx.arc(-12, -14, 16, 0, TAU); ctx.arc(8, -20, 18, 0, TAU); ctx.arc(22, -10, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let k = 0; k < 12; k++) { const x = -36 + (k * 23) % 72, y = 6 + (k * 13) % 36; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 4); ctx.stroke(); } break; }
      case 'scientist': case 'buggy': ctx.translate(-8, 44); drawBuggy(ctx, { s: .46 }); break;
      case 'antenna': { ctx.strokeStyle = '#6a6a70'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(0, -30); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.moveTo(-26, -12); ctx.lineTo(26, -12); ctx.moveTo(-22, 6); ctx.lineTo(22, 6); ctx.stroke(); ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 3; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(0, -36, k * 9, -2.4, -.7); ctx.stroke(); } break; }
      case 'collar': { ctx.strokeStyle = '#2a3038'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#e8b030'; rr(ctx, -10, 14, 20, 14, 3); ctx.fill(); break; }
      case 'nose': { ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(28, -14); ctx.lineTo(30, 14); ctx.lineTo(-40, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#141012'; ctx.beginPath(); ctx.ellipse(30, -2, 14, 12, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(26, -8, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9ab4c8'; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-20 + k * 14, 30); ctx.quadraticCurveTo(-26 + k * 14, 42, -14 + k * 14, 46); ctx.stroke(); } break; }
      case 'ears': { ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.arc(0, 14, 32, 0, TAU); ctx.fill(); for (const side of [-1, 1]) { ctx.fillStyle = '#f2efe6'; ctx.strokeStyle = '#a8a8a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(side * 24, -12, 11, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5a5050'; ctx.beginPath(); ctx.arc(side * 24, -11, 5, 0, TAU); ctx.fill(); } ctx.fillStyle = '#141012'; ctx.beginPath(); ctx.arc(-10, 8, 3, 0, TAU); ctx.arc(10, 8, 3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 26, 7, 5, 0, 0, TAU); ctx.fill(); break; }
      case 'eyes': { for (const x of [-18, 18]) { ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.ellipse(x, 0, 16, 12, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.arc(x + 1, 0, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 1, -3, 2.2, 0, TAU); ctx.fill(); } break; }
      case 'fur': case 'skin': { ctx.fillStyle = '#1e1a1c'; ctx.fillRect(-40, 14, 80, 12); ctx.fillStyle = '#fff6dc'; ctx.fillRect(-40, 26, 80, 16); ctx.strokeStyle = 'rgba(200,220,235,.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let k = 0; k < 9; k++) { const x = -34 + k * 8.5; ctx.beginPath(); ctx.moveTo(x, 14); ctx.quadraticCurveTo(x + 4, -10, x + 8, -36); ctx.stroke(); } break; }
      case 'tail': { ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.ellipse(10, 6, 34, 28, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b8b8b0'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.ellipse(-26, -6, 9, 7, -.5, 0, TAU); ctx.fill(); ctx.stroke(); break; }
      case 'star': ctx.fillStyle = '#f0b020'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 30, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      default: iconBear(ctx, form);
    }
  }
  function icon(key, px, form) {
    form = form || (window.G && window.G.form) || 'cream';
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

  /* the age blend (0 newborn … 1 grown) for a bear of this weight */
  function ageOf(kg) { return clamp(Math.sqrt(Math.max(0, kg - .5) / 150), 0, 1); }

  return { drawBear, drawSeal, drawFox, drawHopper, drawBeluga, drawCaribou, drawBuggy, drawTracks, drawMeal, drawMilk, drawRock, drawHolePic, drawIcon, icon, bearCols, ageOf };
})();
