/* ============================================================
   renderw.js — the web, everyone in it, and you (world space)
   ============================================================
   web()       every thread; a thread that hums is brighter, and
               bright beads (pulses) run along it from whatever
               shook it.  Gumfoot lines have sticky drops at the foot.
   creatures() shed skins, the egg sac, your mother, the others,
               the bugs (at night you only see a bug when you are
               close: the web tells you where it is), visitors,
               the people and their torch
   player()    you, in every mode
   glows()     what shines in the dark: the silk, the pulses, the
               porch light, the torch, the red hourglass
   ============================================================ */
'use strict';

const RenderWorld = (function () {
  const PULSE = { bug: '255,244,170', leaf: '170,230,190', male: '255,170,215', her: '255,120,150' };
  const bean = (ctx, x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };
  const P = (G) => G.player;

  function web(ctx, G, night, glow) {
    const Y = G.yard, t = G.time;
    for (const T of Y.net.threads) {
      const [a, b] = T.pts, k = T.born === undefined ? 1 : T.born, hum = T.hum || 0;
      const bx = lerp(a[0], b[0], k), by = lerp(a[1], b[1], k);
      const sh = hum > 0 ? Math.sin(t * 60) * hum * 1.6 : 0, mx = (a[0] + bx) / 2 - (by - a[1]) / (T.len || 1) * sh, my = (a[1] + by) / 2 + (bx - a[0]) / (T.len || 1) * sh;
      const base = glow ? (.3 + night * .4 + hum * .5) * (T.hers || T.mother ? .7 : 1) : lerp(.75, .34, night) + hum * .3;
      ctx.strokeStyle = glow ? `rgba(${hum > .05 ? PULSE[T.humKind] || '225,238,255' : '215,232,255'},${clamp(base, 0, 1)})` : `rgba(240,246,255,${clamp(base, 0, 1)})`;
      ctx.lineWidth = glow ? 1.8 + hum * 2 : .9 + hum * .8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
      if (T.gum && k >= 1) { const g = T.a.line === Y.net.ground ? a : b, o = g === a ? b : a, L = T.len; ctx.fillStyle = glow ? `rgba(255,236,160,${.35 + night * .4})` : 'rgba(255,240,180,.85)'; for (let q = 0; q < 4; q++) { const u = (4 + q * 5.5) / L; if (u < .6) bean(ctx, lerp(g[0], o[0], u), lerp(g[1], o[1], u), 1.5, 1.9); } }
      if (!glow) for (const e of [a, b]) { ctx.fillStyle = 'rgba(245,250,255,.7)'; bean(ctx, e[0], e[1], 1.5, 1.5); }
    }
    for (const u of Y.pulses) { const q = u.T.at(u.s), al = clamp(u.life / 1.6, 0, 1), c = PULSE[u.kind] || PULSE.bug; ctx.fillStyle = `rgba(${c},${al})`; bean(ctx, q.x, q.y, glow ? 4.4 : 2.6, glow ? 4.4 : 2.6); if (glow) { ctx.fillStyle = `rgba(${c},${al * .3})`; bean(ctx, q.x, q.y, 10, 10); } }
  }
  function spiderAt(ctx, x, y, ang, face, o) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(face < 0 ? -1 : 1, 1); Sprites.drawSpider(ctx, o); ctx.restore(); }

  function creatures(ctx, G, night) {
    const Y = G.yard, p = P(G), t = G.time;
    /* the den: a dark nook */
    if (Y.home) { const [x, y] = Y.home.retreat; ctx.fillStyle = 'rgba(20,12,8,.55)'; bean(ctx, x, y, 11, 8); }
    for (const e of Y.exuviae) { ctx.save(); ctx.translate(e.x, e.y); ctx.strokeStyle = 'rgba(235,242,255,.6)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(0, -e.r * 2.2); ctx.lineTo(0, -e.r); ctx.stroke(); Sprites.drawExuvia(ctx, e.r); ctx.restore(); }
    /* the egg sac you came from, and your mother beside it */
    ctx.strokeStyle = 'rgba(235,242,255,.7)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(WORLD.sacX, -320); ctx.lineTo(WORLD.sacX, WORLD.sacY - 11); ctx.stroke();
    ctx.save(); ctx.translate(WORLD.sacX + (p.stage === 'sac' && p.flags.sacReady ? Math.sin(t * 20) * p.crack * 1.5 : 0), WORLD.sacY); Sprites.drawSac(ctx, 12, { crack: p.stage === 'sac' ? p.crack * .6 : 1 }); ctx.restore();
    spiderAt(ctx, Y.mother.x, Y.mother.y, Math.PI * .8, 1, { r: 11, form: 'girl', adult: true, belly: true, ph: t * .3 });
    if (Y.sac) { ctx.save(); ctx.translate(Y.sac.x, Y.sac.y); ctx.strokeStyle = 'rgba(235,242,255,.7)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -8); ctx.stroke(); Sprites.drawSac(ctx, 10, { crack: Y.babies.length ? 1 : 0 }); ctx.restore(); }
    if (Y.her) { const h = Y.her, L = h.lunge; spiderAt(ctx, h.x + (p.x - h.x) * L * .25, h.y + (p.y - h.y) * L * .25 + 6, Math.atan2(p.y - h.y, p.x - h.x), 1, { r: 11, form: 'girl', adult: true, belly: true, ph: t * (L > 0 ? 9 : .4), moving: L > 0 }); }
    if (Y.suitor) { const m = Y.suitor; spiderAt(ctx, m.x, m.y - (m.y > -1 ? 4 : 0), m.y > -1 ? (m.state === 'leave' ? (m.side > 0 ? 0 : Math.PI) : (m.tx > m.x ? 0 : Math.PI)) : -Math.PI / 2, 1, { r: 5.2, form: 'boy', adult: true, ph: t * 8, moving: m.state !== 'pluck' }); }
    for (const b of Y.sibs) spiderAt(ctx, b.x, b.y, b.fly ? Math.sin(t * 2 + b.k * 9) * .4 : Math.PI, 1, { r: 2.2, instar: 0, ph: t * 9 + b.k * 9, moving: !b.fly, spread: b.fly });
    for (const b of Y.sibs) if (b.fly) silkStrand(ctx, b.x, b.y, 26, t + b.k * 5);
    for (const b of Y.babies) if (b.t > b.wait) { spiderAt(ctx, b.x, b.y, -Math.PI / 2, 1, { r: 1.8, instar: 0, ph: t * 9 + b.k * 9, moving: true, spread: b.y < b.top }); if (b.y < b.top) silkStrand(ctx, b.x, b.y, 20, t + b.k * 5); }
    /* the bugs: by night you see one only when you are close */
    for (const b of Y.prey) {
      const near = clamp(1.6 - Math.hypot(b.x - p.x, b.y - p.y) / 60, 0, 1), vis = b.state === 'in' ? Math.max(1 - night, .25) : Math.max(1 - night, near);
      ctx.save(); ctx.translate(b.x, b.y);
      if (b.state === 'stuck' && vis < .5) { ctx.fillStyle = `rgba(255,244,170,${.5 + .4 * Math.sin(t * 12)})`; bean(ctx, 0, 0, 2.6, 2.6); }
      ctx.globalAlpha = vis;
      const s = b.leaf ? 1 : .7 + b.def.size * .28, jig = b.state === 'stuck' && !b.leaf ? Math.sin(b.ph * 2.4) * .35 : 0;
      if (b.state === 'held' || b.state === 'parcel') { ctx.rotate(t * 3 * (b.state === 'held' ? 1 : 0)); if (b.wraps < .7) { ctx.save(); ctx.globalAlpha = vis * (1 - b.wraps); Sprites.drawPrey(ctx, b.kind, { ph: b.ph, s }); ctx.restore(); } Sprites.drawParcel(ctx, 4 + b.def.size * 1.6, b.wraps, t * 2); }
      else { ctx.rotate(jig); ctx.scale(b.state === 'in' ? (b.tx > b.x ? 1 : -1) : b.side, 1); Sprites.drawPrey(ctx, b.kind, { ph: b.state === 'stuck' ? b.ph * 2 : b.ph, s }); }
      ctx.restore();
    }
    /* moths at the porch light */
    if (night > .3) for (let k = 0; k < 5; k++) { const a = t * (1.1 + k * .23) + k * 1.9, rr2 = 16 + k * 7 + Math.sin(t * .7 + k) * 6; ctx.save(); ctx.translate(WORLD.lampX + Math.cos(a) * rr2, WORLD.lampY + 6 + Math.sin(a * 1.3) * rr2 * .6); ctx.globalAlpha = night; Critters.moth(ctx, .8, t * 18 + k); ctx.restore(); }
    const v = Y.visitor;
    if (v) { ctx.save(); ctx.translate(v.x, v.y); const dir = v.state === 'leave' ? v.side : (p.x > v.x ? 1 : -1);
      if (v.kind === 'dauber') Critters.dauber(ctx, 1.25, dir, v.ph); else if (v.kind === 'lizard') Critters.lizard(ctx, 1.05, dir, v.state === 'look' ? 0 : v.ph);
      else if (v.kind === 'bird') Critters.wren(ctx, 1.9, dir, v.ph); else if (v.kind === 'mantis') Critters.mantis(ctx, 1.8, dir, v.ph); else if (v.kind === 'broom') Critters.broom(ctx, 1, v.ph);
      ctx.restore(); }
    const Q = Y.people;
    if (Q) { const walk = Q.state !== 'look', dir = Q.state === 'go' ? -Q.face : Q.face;
      ctx.save(); ctx.translate(Q.x - Q.face * 46, 0); Critters.grownup(ctx, { pose: walk ? 'walk' : 'look', t, dir }); ctx.restore();
      ctx.save(); ctx.translate(Q.x, 0); Critters.child(ctx, 8, { h: 150, pose: walk ? 'walk' : 'look', t: t + .4, dir }); ctx.restore(); }
  }
  function silkStrand(ctx, x, y, len, t) { ctx.strokeStyle = 'rgba(240,248,255,.85)'; if (ctx.lineWidth > 1.5 || ctx.lineWidth < .7) ctx.lineWidth = Math.max(.7, ctx.lineWidth); else ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 1; k <= 8; k++) ctx.lineTo(x + k * len / 8 * .35 + Math.sin(t * 2 + k * .9) * 3, y - k * len / 8); ctx.stroke(); }
  /* where the torch is, and where it points */
  function torch(G) { const Q = G.yard.people, p = P(G); if (!Q || Q.state !== 'look') return null; const x = Q.x - Q.face * 46 + Q.face * 36, y = -92; return { x, y, a: Math.atan2(p.y - y, p.x - x), len: Math.hypot(p.x - x, p.y - y) + 60 }; }

  function player(ctx, G) {
    const p = P(G), t = G.time, m = p.mode, girl = !p.male, o = { r: p.r, form: p.form, instar: p.instar, adult: p.stage === 'adult', ph: p.walkPh, moving: p.moving };
    if (p.stage === 'sac') return;
    if (p.silk && (m === 'walk') && p.foot) { const s = p.silk, f = p.foot, d = Math.hypot(f.x - s.x, f.y - s.y); ctx.strokeStyle = 'rgba(240,248,255,.85)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo((s.x + f.x) / 2, (s.y + f.y) / 2 + Math.min(18, d * .12), f.x, f.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; bean(ctx, s.x, s.y, 2.4 + Math.sin(t * 6) * .6, 2.4 + Math.sin(t * 6) * .6); }
    if (m === 'hang' && p.rope) { ctx.strokeStyle = 'rgba(240,248,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.rope.ax, p.rope.ay); ctx.lineTo(p.x, p.y); ctx.stroke(); spiderAt(ctx, p.x, p.y, Math.PI / 2 - p.rope.th, 1, Object.assign(o, { belly: girl, ph: t * 6, moving: p.moving })); return; }
    if (m === 'balloon') { ctx.save(); ctx.lineWidth = 1.6; silkStrand(ctx, p.x, p.y, 40 + p.bal.sl * 110, t); ctx.restore(); spiderAt(ctx, p.x, p.y, -Math.PI / 2 + p.ang, 1, Object.assign(o, { r: p.r * 2.6, spread: true, ph: t * 3, moving: true })); return; }
    if (m === 'molt') { const k = 1 - p.molting / MOLT_T, x = p.x, y = p.y + p.r * .6; ctx.strokeStyle = 'rgba(240,248,255,.9)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y - p.r * 2); ctx.lineTo(x, y); ctx.stroke(); ctx.save(); ctx.translate(x, y); Sprites.drawExuvia(ctx, p.r); ctx.restore(); ctx.save(); ctx.globalAlpha = clamp(k * 1.6, 0, 1); spiderAt(ctx, x, y + p.r * (.4 + k * 2.6), Math.PI / 2, 1, Object.assign(o, { instar: p.instar + 1, adult: p.instar + 1 >= p.last, r: SIZE[p.form][p.instar + 1] * lerp(.8, 1, k), soft: 1 - k, ph: t * 5, moving: true })); ctx.restore(); return; }
    if (m === 'curl') { spiderAt(ctx, p.x, p.y + p.r * .15, Math.PI * .5, 1, Object.assign(o, { curl: true, belly: false })); return; }
    if (m === 'show') { ctx.strokeStyle = 'rgba(240,248,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r * 2); ctx.lineTo(p.x, p.y); ctx.stroke(); spiderAt(ctx, p.x, p.y, Math.PI / 2, 1, Object.assign(o, { belly: true, ph: t * 2 })); return; }
    if (m === 'fall') { spiderAt(ctx, p.x, p.y, Math.PI / 2, 1, Object.assign(o, { spread: true })); return; }
    const up = p.up, off = p.r * .45, onT = p.line && p.line.kind === 'thread';
    spiderAt(ctx, p.x - up.nx * off, p.y - up.ny * off, p.ang, p.face, Object.assign(o, { belly: girl && onT, moving: p.moving || m === 'wrap' || m === 'spin' || p.busy > 0, ph: p.moving ? p.walkPh : t * 7 }));
    if (m === 'spin' && p.sp) { ctx.save(); ctx.translate(p.x, p.y + p.r * 1.5); Sprites.drawSac(ctx, 3 + 7 * p.sp.n / p.sp.need, { turn: p.sp.n * .8 }); ctx.restore(); }
  }
  function glows(ctx, G, night) {
    const p = P(G), Y = G.yard, t = G.time;
    Scene.glow(ctx, night);
    web(ctx, G, night, true);
    /* what she can feel close by is lit a little: herself, a visitor, another spider */
    const pool = (x, y, R, a) => { const g = ctx.createRadialGradient(x, y, 2, x, y, R); g.addColorStop(0, `rgba(200,214,255,${a * night})`); g.addColorStop(1, 'rgba(200,214,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2); };
    if (p.stage !== 'sac') pool(p.x, p.y, 60 + p.r * 4, .55);
    if (Y.visitor && Y.visitor.kind !== 'broom') pool(Y.visitor.x, Y.visitor.y - 14, 90, .42);
    if (Y.suitor) pool(Y.suitor.x, Y.suitor.y, 40, .35);
    if (Y.her) pool(Y.her.x, Y.her.y + 6, 60, .35);
    if (Y.sac) pool(Y.sac.x, Y.sac.y, 40, .3);
    if (p.mode === 'show') { ctx.fillStyle = `rgba(255,60,40,${.5 + .3 * Math.sin(t * 10)})`; bean(ctx, p.x, p.y, p.r * 1.3, p.r * 1.3); }
    const T = torch(G); if (T) { ctx.save(); ctx.translate(T.x, T.y); Critters.beam(ctx, T.a, T.len, .32); ctx.restore(); }
    const gd = Y.guide(); if (gd && p.flags.settled) for (const q of gd) { ctx.fillStyle = `rgba(255,250,200,${.5 + .4 * Math.sin(t * 5)})`; bean(ctx, q[0], q[1], 5, 5); }
  }
  return { web, creatures, player, glows, torch, bean };
})();
