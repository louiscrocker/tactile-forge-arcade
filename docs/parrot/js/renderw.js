/* ============================================================
   renderw.js — everyone in the forest, in world coordinates
   ============================================================
   creatures   the food on the branches · the flock at the clay
               lick · your family, your mate · the chicks in a
               hollow · the toucan, the eagle · the scientist on
               the rope, the boat on the river
   player      you: egg, chick (by instar), sitting, flying,
               asleep; a little tilt with the climb and the dive
   rings       a call you can see: rings, and the notes of a name
   glows       what still shows at night: the rings
   ============================================================ */
'use strict';

const RenderWorld = (function () {
  const bean = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };

  function bird(ctx, b, G) {
    if (b.gone) return;
    const p = G.player, t = G.time;
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.mode === 'nest') {
      ctx.scale(b.face, 1);
      if (b.kind === 'sib') { const i = p.stage === 'chick' ? p.instar : 3; if (i < 3) Sprites.drawChick(ctx, { r: SIZE.chick[i] * .92, instar: i, ph: t + 2, beg: G.forest.feed.state === 'offer' ? 1 : 0 }); else Sprites.drawParrot(ctx, { r: 12, young: true, tailK: .4 }); }
      else Sprites.drawParrot(ctx, { r: 13, tailK: .3, look: b.look });
    } else if (b.mode === 'fly') {
      ctx.scale(b.face * b.size, b.size); ctx.rotate(clamp((b.ty - b.y) / 300, -.35, .35));
      Sprites.drawParrot(ctx, { r: 16, pose: 'fly', ph: b.ph, look: b.look, young: b.kind === 'sib', tailK: b.kind === 'sib' ? .75 : 1 });
    } else {
      ctx.scale(b.face * b.size, b.size);
      const sleep = p.mode === 'sleep' && b.kind !== 'other';
      Sprites.drawParrot(ctx, { r: 16, look: b.look, open: b.callT > 0, bob: b.bob, sleep, young: b.kind === 'sib', tailK: b.kind === 'sib' ? .75 : 1, lean: b.kind === 'other' ? Math.max(0, Math.sin(t * 1.3 + b.ph)) * .5 : 0 });
    }
    ctx.restore();
  }
  function foods(ctx, G, view) {
    for (const f of G.forest.foods) { if (f.x < view.l || f.x > view.r) continue; ctx.save(); ctx.translate(f.x, f.y + (f.kind === 'clay' ? 0 : 4)); Sprites.drawFood(ctx, f.kind, { n: f.n, bite: f.bite }); ctx.restore(); }
  }
  function visitor(ctx, G) {
    const v = G.forest.visitor; if (!v) return;
    ctx.save(); ctx.translate(v.x, v.y);
    if (v.kind === 'toucan') { ctx.scale(v.state === 'leave' ? 1 : v.face || -1, 1); if (v.state === 'look') Critters.toucan(ctx, 1.15, G.time); else { ctx.rotate(-.3 + Math.sin(G.time * 14) * .12); ctx.translate(0, 14); Critters.toucan(ctx, 1.15, G.time * 4); } }
    else { ctx.scale(v.side > 0 && v.state !== 'leave' ? -1.5 : 1.5 * (v.state === 'leave' ? v.side : 1), 1.5); Critters.eagle(ctx, 1, G.time); }
    ctx.restore();
  }
  function people(ctx, G) {
    const Q = G.forest.people; if (!Q) return;
    ctx.save(); ctx.translate(Q.x, Q.y);
    if (Q.kind === 'climber') Critters.climber(ctx, G.time, Q.state === 'look'); else Critters.boat(ctx, G.time, Q.state === 'look');
    ctx.restore();
  }
  function creatures(ctx, G, night) {
    const F = G.forest, view = G.cam.viewRect(160), p = G.player;
    foods(ctx, G, view);
    for (const b of F.others) if (b.x > view.l && b.x < view.r) bird(ctx, b, G);
    for (const c of F.chicks) { ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.x < F.hollow(p.flags.nest).inside[0] ? 1 : -1, 1); const k = clamp(c.t / 1.2, 0, 1); ctx.scale(k, k); Sprites.drawChick(ctx, { r: 5, instar: 0, ph: G.time + c.x, beg: p.ec || p.flags.chickName ? 1 : 0 }); ctx.restore(); }
    for (const b of F.birds()) bird(ctx, b, G);
    visitor(ctx, G); people(ctx, G);
  }

  function player(ctx, G) {
    const p = G.player, F = G.forest, t = G.time, m = p.mode;
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.stage === 'egg') { ctx.translate(0, -7); Sprites.drawEgg(ctx, 7.5, { crack: p.crack, wob: p.crack > 0 && (p.input.x || p.input.y) ? Math.sin(t * 22) : Math.sin(t * 2) * .2 }); ctx.restore(); return; }
    /* the eggs you sit on */
    if (p.stage === 'adult' && m === 'nest') for (let k = 0; k < p.eggsN && !p.flags.hatched; k++) { ctx.save(); ctx.translate(-10 + k * 9, -4); Sprites.drawEgg(ctx, 4.4); ctx.restore(); }
    ctx.scale(p.face, 1);
    const inNest = m === 'nest' || (m === 'echo' && p.backTo === 'nest');
    if (p.stage === 'chick' && p.instar < 3) Sprites.drawChick(ctx, { r: p.r, instar: p.instar, ph: t, beg: F.feed.state === 'offer' || p.ec ? 1 : 0 });
    else if (m === 'fly') {
      ctx.rotate(clamp(p.vy / 420, -.5, .5));
      Sprites.drawParrot(ctx, { r: p.r, pose: 'fly', ph: p.flapPh, young: p.stage !== 'adult', tailK: p.stage === 'adult' ? 1 : .75, open: p.callT > 0 });
    } else {
      const flap = p.flapping > 0 && m === 'perch';
      Sprites.drawParrot(ctx, {
        r: p.r, young: p.stage !== 'adult', tailK: inNest ? .3 : p.stage === 'chick' ? .45 : p.stage === 'adult' ? 1 : .75,
        open: p.callT > 0 || p.busyKind === 'eat' && Math.sin(t * 18) > 0, sleep: m === 'sleep', flap, ph: t * 22,
        lean: m === 'crack' ? .6 + Math.sin(t * 9) * .2 : m === 'preen' ? .5 + (p.pr && p.pr.flash > 0 ? .5 : 0) : p.busyKind ? .7 : p.moving ? Math.sin(p.walkPh) * .25 : 0,
        carry: p.male && p.flags.laid && !p.flags.hatched && p.crop >= G.diff().crop
      });
    }
    ctx.restore();
  }

  /* a call: rings from the caller, and the notes of the name */
  function rings(ctx, G) {
    for (const r of G.forest.rings) {
      const k = r.t / 1.6, col = r.kind === 'me' ? '255,214,90' : '255,150,200';
      ctx.lineWidth = 3;
      for (let j = 0; j < 3; j++) { const u = k - j * .14; if (u <= 0) continue; ctx.strokeStyle = `rgba(${col},${(1 - u) * .8})`; ctx.beginPath(); ctx.arc(r.x, r.y, 12 + u * 90, 0, TAU); ctx.stroke(); }
      if (r.seq && r.seq.length) { ctx.save(); ctx.translate(r.x - (r.seq.length - 1) * 11, r.y - 34 - k * 26); r.seq.forEach((n, i) => { const on = clamp(r.t * 3 - i * .8, 0, 1); if (on > 0) { ctx.save(); ctx.translate(i * 22, 0); Sprites.drawNote(ctx, n, 8.5 * (.6 + .4 * on), Math.min(1, (1.6 - r.t) * 2)); ctx.restore(); } }); ctx.restore(); }
    }
  }
  function glows(ctx, G, night) { rings(ctx, G); }
  return { creatures, player, rings, glows, bird };
})();
