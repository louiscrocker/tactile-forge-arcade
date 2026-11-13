/* ============================================================
   renderh.js — what is drawn over the scene (screen space)
   ============================================================
   the two bright dots of the next suggested thread · a pointer to
   where the story wants you, and to a hum that is off the screen ·
   the wrapping ring, the plucking ring, the turning arrow of the
   egg sac, the silk gauge of the balloon ride · what the people
   say · name tags
   ============================================================ */
'use strict';

const RenderHud = (function () {
  let ctx, W, H;
  function bigText(x, y, t, col, size = 26) { ctx.font = `900 ${Math.round(Math.min(size, W * .05))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); }
  function pointer(cam, x, y, col, always) {
    const [sx, sy] = cam.toScreen(x, y), inside = sx > 40 && sx < W - 40 && sy > 110 && sy < H - 60;
    if (inside && !always) return;
    const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 130, H - 80), a = inside ? Math.PI / 2 : Math.atan2(sy - cy, sx - cx);
    ctx.save(); ctx.translate(cx, cy - (inside ? 26 + Math.sin(performance.now() / 160) * 5 : 0)); ctx.rotate(a);
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function ring(x, y, S, closing, good, word) {
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, S, 0, TAU); ctx.stroke();
    ctx.strokeStyle = good ? '#7dff7a' : 'rgba(255,230,140,.9)'; ctx.lineWidth = good ? 10 : 5; ctx.beginPath(); ctx.arc(x, y, lerp(S * 2.6, S, closing), 0, TAU); ctx.stroke();
    if (word) bigText(x, y, word, good ? '#7dff7a' : '#fff3c0', S * .5);
  }
  const pips = (n, of) => '●'.repeat(clamp(n, 0, of)) + '○'.repeat(Math.max(0, of - n));
  function bubble(x, y, text) {
    ctx.font = `800 ${Math.round(clamp(W * .02, 14, 20))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 28, h = 38, bx = clamp(x - w / 2, 8, W - w - 8), by = Math.max(96, y - h - 14);
    ctx.fillStyle = 'rgba(255,253,244,.96)'; rr(ctx, bx, by, w, h, 16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 8, by + h - 1); ctx.lineTo(x, by + h + 12); ctx.lineTo(x + 8, by + h - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2016'; ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
  }
  function draw(c, G, w, h, night) {
    ctx = c; W = w; H = h;
    const p = G.player, cam = G.cam, Y = G.yard, t = G.time, pad = G.settings.pad, low = H - (pad ? 228 : 70);
    if (!G.started) return;
    /* the next suggested thread: two bright dots and a dotted line */
    const gd = Y.guide();
    if (gd && p.flags.settled && p.mode !== 'molt') {
      const [a, b] = gd.map(q => cam.toScreen(q[0], q[1])), from = p.silk ? b : a;
      ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(255,250,210,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      for (const q of [a, b]) { const on = q === from; ctx.fillStyle = on ? '#fff6c0' : 'rgba(255,246,192,.55)'; ctx.beginPath(); ctx.arc(q[0], q[1], on ? 9 + Math.sin(t * 6) * 3 : 6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,40,10,.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      pointer(cam, gd[p.silk ? 1 : 0][0], gd[p.silk ? 1 : 0][1], '#fff6c0');
    }
    const g = Story.goal(); if (g) pointer(cam, g.x, g.y, g.kind === 'her' ? '#ff9ad0' : '#ffd23f', g.kind !== 'away');
    const b = Y.stuck(); if (b && p.mode === 'walk') pointer(cam, b.x, b.y, b.leaf ? '#a8e0b8' : '#fff0a0');
    const m = Y.suitor; if (m && m.state === 'pluck' && !p.flags.met) pointer(cam, m.x, m.y, '#ff9ad0');
    const v = Y.visitor; if (v && v.state === 'look' && v.kind !== 'broom') { const [sx, sy] = cam.toScreen(v.x, v.y); bigText(sx, sy - 50, '👀', '#fff', 30); }
    /* the little games */
    if (b && b.state === 'stuck' && !b.leaf && p.context && p.context() === 'fling') { const [sx, sy] = cam.toScreen(b.x, b.y); bigText(sx, sy - 34, pips(b.flings, b.def.size + 1), '#fff3c0', 20); }
    if (p.mode === 'wrap' && p.wrap) { const [sx, sy] = cam.toScreen(p.wrap.b.x, p.wrap.b.y), good = p.wrapGood(); ring(sx, sy, 30, (p.wrap.t % .7) / .7, good); bigText(W / 2, low, (good ? 'WRAP!  ' : 'Wait for green…  ') + pips(Math.floor(p.wrap.n / 2), 3), good ? '#7dff7a' : '#fff3c0'); }
    if (p.mode === 'pluck' && p.pl) { const [sx, sy] = cam.toScreen(p.x, p.y), good = p.pluckGood(), st = p.flags.pluckStep || 0; ring(sx, sy - 70, 34, p.pl.t % 1, good, good ? 'PLUCK' : ''); bigText(W / 2, low, (p.pl.flash < 0 ? 'Too hard!  ' : good ? 'PLUCK!  ' : 'Soft and steady…  ') + pips(p.pl.good, G.diff().plucks) + '   ♥ ' + pips(st, 3), p.pl.flash < 0 ? '#ff8a7a' : good ? '#7dff7a' : '#fff3c0'); }
    if (p.mode === 'spin' && p.sp) { const [sx, sy] = cam.toScreen(p.x, p.y), A = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.spinWant()]; ctx.save(); ctx.translate(sx + Math.cos(A) * 74, sy + Math.sin(A) * 74); ctx.rotate(A); ctx.fillStyle = '#7dff7a'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-10, -20); ctx.lineTo(-10, -8); ctx.lineTo(-28, -8); ctx.lineTo(-28, 8); ctx.lineTo(-10, 8); ctx.lineTo(-10, 20); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); const bw = Math.min(320, W * .5); ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, W / 2 - bw / 2 - 6, low - 12, bw + 12, 24, 12); ctx.fill(); ctx.fillStyle = '#f4a6c0'; rr(ctx, W / 2 - bw / 2, low - 6, Math.max(12, bw * p.sp.n / p.sp.need), 12, 6); ctx.fill(); }
    if (p.mode === 'balloon' && p.bal) { const x = W - (pad ? 30 : 40), y0 = H * .3, hh = H * .36; ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(ctx, x - 10, y0 - 6, 20, hh + 12, 10); ctx.fill(); ctx.fillStyle = '#eaf6ff'; rr(ctx, x - 5, y0 + hh * (1 - p.bal.sl), 10, Math.max(8, hh * p.bal.sl), 5); ctx.fill(); bigText(x, y0 - 22, '▲', '#eaf6ff', 18); bigText(x, y0 + hh + 24, '▼', '#eaf6ff', 18); }
    if (p.flags.guard && !p.flags.hatchedOut && Y.sac) { const bw = Math.min(260, W * .4), k = clamp(p.guardT / G.diff().guard, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, W / 2 - bw / 2 - 6, low - 12, bw + 12, 24, 12); ctx.fill(); ctx.fillStyle = '#ffe9a0'; rr(ctx, W / 2 - bw / 2, low - 6, Math.max(12, bw * k), 12, 6); ctx.fill(); }
    if (p.tight > 0 && p.mode === 'walk' && Math.sin(t * 6) > 0) { const [sx, sy] = cam.toScreen(p.x, p.y); bigText(sx, sy - 40, 'Too tight!', '#ffd23f', 20); }
    const Q = Y.people; if (Q && Q.say) { const kid = Q.say.who === 'kid', [sx, sy] = cam.toScreen(kid ? Q.x : Q.x - Q.face * 46, kid ? -96 : -158); bubble(sx, sy, Q.say.text); }
    if (G.settings.labels) labels(G);
  }
  function labels(G) {
    const cam = G.cam, p = G.player, Y = G.yard;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    for (const [x, y, t] of [[-1560, -300, 'fence'], [-1190, -170, 'woodpile'], [-620, -300, 'shed'], [-285, -90, 'crate'], [-27, -120, 'flowerpot'], [170, -96, 'flowerpot'], [360, -150, 'old boot'], [745, -280, 'prickly pear'], [1190, -180, 'porch post'], [WORLD.lampX, WORLD.lampY + 30, 'porch light']]) tag(x, y, t);
    if (Y.home) tag(Y.home.retreat[0], Y.home.retreat[1] - 22, 'den');
    const gm = Y.gums()[0]; if (gm) tag(gm.pts[1][0] + 34, -12, 'gumfoot line');
    if (p.stage !== 'sac') tag(p.x, p.y - p.r * 2.4 - 14, STAGES[STAGE_INDEX[p.stageKey()]].name); else tag(WORLD.sacX, WORLD.sacY + 26, 'egg sac');
    const v = Y.visitor; if (v) tag(v.x, v.y - 60, { dauber: 'blue mud dauber', lizard: 'alligator lizard', bird: 'cactus wren', mantis: 'mantis', broom: 'broom' }[v.kind]);
    for (const b of Y.prey) if (b.state === 'stuck' && Math.hypot(b.x - p.x, b.y - p.y) < 70) tag(b.x, b.y + 20, b.def.name);
  }
  return { draw, bigText };
})();
