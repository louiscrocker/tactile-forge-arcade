/* ============================================================
   renderh.js — what is drawn over the scene (screen space)
   ============================================================
   a pointer to where the story wants you · the notes of the name
   game · the biting ring, the preening ring · the flap bar at the
   door · pips for what you have eaten or carried · a "?" over each
   hollow you have not looked into · what the people say · your own
   name, top left · name tags
   ============================================================ */
'use strict';

const RenderHud = (function () {
  let ctx, W, H;
  function bigText(x, y, t, col, size = 26) { ctx.font = `900 ${Math.round(Math.min(size, W * .05))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); }
  function pointer(cam, x, y, col, always) {
    const [sx, sy] = cam.toScreen(x, y), inside = sx > 40 && sx < W - 40 && sy > 110 && sy < H - 60;
    if (inside && !always) return;
    const cx = clamp(sx, 50, W - 50), cy = clamp(sy, 130, H - 80), a = inside ? Math.PI / 2 : Math.atan2(sy - cy, sx - cx);
    ctx.save(); ctx.translate(cx, cy - (inside ? 30 + Math.sin(performance.now() / 160) * 5 : 0)); ctx.rotate(a);
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
  function bar(y, k, col, label) { const bw = Math.min(300, W * .5); ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, W / 2 - bw / 2 - 6, y - 12, bw + 12, 24, 12); ctx.fill(); ctx.fillStyle = col; rr(ctx, W / 2 - bw / 2, y - 6, Math.max(12, bw * clamp(k, 0, 1)), 12, 6); ctx.fill(); if (label) bigText(W / 2, y - 32, label, '#fff3c0', 22); }
  function bubble(x, y, text) {
    ctx.font = `800 ${Math.round(clamp(W * .02, 14, 20))}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 28, h = 38, bx = clamp(x - w / 2, 8, W - w - 8), by = Math.max(96, y - h - 14);
    ctx.fillStyle = 'rgba(255,253,244,.96)'; rr(ctx, bx, by, w, h, 16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 8, by + h - 1); ctx.lineTo(x, by + h + 12); ctx.lineTo(x + 8, by + h - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2016'; ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
  }
  /* a row of notes, centred on (x, y): done ones bright, the rest faint; hi = the one that pulses */
  function notes(x, y, seq, done, s, hi = -1) {
    const gap = s * 2.6, x0 = x - (seq.length - 1) * gap / 2;
    seq.forEach((n, i) => { ctx.save(); ctx.translate(x0 + i * gap, y); const big = i === hi ? 1.25 + Math.sin(performance.now() / 90) * .08 : 1; ctx.scale(big, big); if (n) Sprites.drawNote(ctx, n, s, i < done || i === hi ? 1 : .32); else { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } ctx.restore(); });
  }
  function draw(c, G, w, h, night) {
    ctx = c; W = w; H = h;
    const p = G.player, cam = G.cam, F = G.forest, t = G.time, pad = G.settings.pad, low = H - (pad ? 228 : 70), fl = p.flags, D = G.diff();
    if (!G.started) return;
    const g = Story.goal(); if (g) pointer(cam, g.x, g.y - (g.kind === 'up' ? 0 : 18), g.kind === 'mate' || g.kind === 'family' ? '#ff9ad0' : g.kind === 'hide' ? '#9be37a' : '#ffd23f', true);
    const v = F.visitor; if (v && v.state === 'look') { const [sx, sy] = cam.toScreen(v.x, v.y); bigText(sx, sy - 56, '👀', '#fff', 30); }
    if (v && v.state !== 'leave') pointer(cam, v.x, v.y, '#ff8a7a');
    /* hollows you have not looked into */
    if (p.stage === 'adult' && fl.paired && !fl.nest) for (const hh of F.hollows) if (hh.key !== 'home' && !hh.seen) { const [sx, sy] = cam.toScreen(hh.door[0], hh.door[1]); if (sx > 0 && sx < W && sy > 100 && sy < H) bigText(sx, sy - 44 + Math.sin(t * 4) * 4, '?', '#ffd23f', 34); }
    /* the name game */
    if (p.mode === 'echo' && p.ec) {
      const e = p.ec, s = clamp(W * .028, 18, 30), cy = low - s * 1.5;
      ctx.fillStyle = 'rgba(20,14,8,.5)'; rr(ctx, W / 2 - s * 6, cy - s * 1.9, s * 12, s * 4.6, 22); ctx.fill();
      if (e.kind === 'give') { notes(W / 2, cy, [0, 1, 2].map(i => e.got[i] || null), e.got.length, s); bigText(W / 2, cy + s * 1.9, 'Press three arrows!', '#fff3c0', 22); }
      else if (p.echoShowing()) { const i = Math.floor((e.t - .15) / .6); notes(W / 2, cy, e.seq.map((n, k) => k <= i ? n : null), 9, s, i); bigText(W / 2, cy + s * 1.9, 'Listen…', '#ff9ad0', 22); }
      else { notes(W / 2, cy, e.seq, e.i, s, e.i); bigText(W / 2, cy + s * 1.9, 'Your turn! Press the arrows.', '#7dff7a', 22); }
    }
    /* the little games */
    if (p.mode === 'crack' && p.cr) { const [sx, sy] = cam.toScreen(p.cr.f.x, p.cr.f.y + 14), good = p.crackGood(); ring(sx, sy, 30, (p.cr.t % .8) / .8, good); bigText(W / 2, low, (good ? 'BITE!  ' : 'Wait for green…  ') + pips(Math.floor(p.cr.n / 2), 3), good ? '#7dff7a' : '#fff3c0'); }
    if (p.mode === 'preen' && p.pr && F.mate) { const [sx, sy] = cam.toScreen(F.mate.x, F.mate.y - 40), good = p.preenGood(); ring(sx, sy, 34, p.pr.t % 1, good, good ? '♥' : ''); bigText(W / 2, low, (p.pr.flash < 0 ? 'Too soon!  ' : good ? 'PREEN!  ' : 'Gently…  ') + pips(p.pr.good, D.preens), p.pr.flash < 0 ? '#ff8a7a' : good ? '#7dff7a' : '#fff3c0'); }
    if (p.stage === 'chick' && p.mode === 'perch' && !fl.strong) bar(low, p.flapN / D.flaps, '#ffd23f', 'FLAP!');
    const head = () => { const [sx, sy] = cam.toScreen(p.x, p.y - p.r * 2.6 - 16); return [sx, Math.max(120, sy)]; };
    if (p.stage === 'chick' && p.mode === 'nest' && p.instar < 3) { const [sx, sy] = head(); bigText(sx, sy - 6, pips(p.food, p.need), '#ffd23f', 16); }
    if (LESSON_FOOD[fl.ls] && (fl.ln | 0) > 0) { const [sx, sy] = head(); bigText(sx, sy, pips(fl.ln | 0, { fig: D.figs, clay: D.clay, nut: D.nuts }[fl.ls]), '#ffd23f', 16); }
    if (p.stage === 'adult' && fl.laid && !fl.hatched) { const [sx, sy] = head(); if (p.male) bigText(sx, sy, pips(p.crop, D.crop) + '   ♥ ' + pips(p.stats.trips, D.trips), '#ffd23f', 16); else bigText(sx, sy, '♥ ' + pips(fl.sitFed | 0, D.sitFeeds), '#ffd23f', 16); }
    if (p.stage === 'adult' && p.mode === 'nest' && !fl.laid) { const [sx, sy] = head(); bigText(sx, sy, pips(p.eggsN, D.eggs), '#fff', 16); }
    const Q = F.people; if (Q && Q.say) { const kid = Q.say.who === 'kid', [sx, sy] = Q.kind === 'climber' ? cam.toScreen(Q.x + 8, Q.y - 62) : cam.toScreen(Q.x + (kid ? 18 : -34), Q.y - (kid ? 84 : 104)); bubble(sx, sy, Q.say.text); }
    /* your name, once you have one */
    if (fl.name && !document.body.classList.contains('cine')) { const s = 9, x = 22, y = H - (pad ? 250 : 26); ctx.fillStyle = 'rgba(20,14,8,.4)'; rr(ctx, x - 14, y - 15, 3 * s * 2.6 + 12, 30, 15); ctx.fill(); notes(x + s * 2.6, y, p.name(), 9, s); }
    if (G.settings.labels) labels(G);
  }
  function labels(G) {
    const cam = G.cam, p = G.player, F = G.forest;
    ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, t) => { const [sx, sy] = cam.toScreen(x, y); if (sx < 0 || sx > W || sy < 100 || sy > H) return; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(255,252,240,.85)'; rr(ctx, sx - w / 2, sy - 11, w, 22, 11); ctx.fill(); ctx.fillStyle = '#2a2016'; ctx.fillText(t, sx, sy); };
    for (const tr of F.trees) if (tr.key !== 'palm2') tag(tr.x, -tr.h * .45, { home: 'ironwood', step: 'young tree', fig: 'fig tree', palm: 'palms', dead: 'dead palm', kapok: 'kapok tree', east: 'tall tree', box: 'tall tree' }[tr.key]);
    tag(570, 40, 'river'); tag(1010, -240, 'clay lick'); tag(F.hollow('box').door[0] + 30, F.hollow('box').door[1] - 44, 'nest box');
    for (const h of F.hollows) if (h.key !== 'box') tag(h.door[0], h.door[1] - 26, 'hollow');
    for (const f of F.foods) if (f.n > 0 && Math.hypot(f.x - p.x, f.y - p.y) < 90) tag(f.x, f.y + 34, { fig: 'fig', nut: 'palm nuts', clay: 'clay' }[f.kind]);
    tag(p.x, p.y - p.r * 2.6 - 34, STAGES[STAGE_INDEX[p.stageKey()]].name);
    const v = F.visitor; if (v) tag(v.x, v.y - 70, { toucan: 'toucan', eagle: 'hawk-eagle' }[v.kind]);
    for (const b of F.others) if (Math.hypot(b.x - p.x, b.y - p.y) < 260) tag(b.x, b.y + 16, { blue: 'blue-and-yellow macaw', redgreen: 'red-and-green macaw', green: 'mealy parrot', scarlet: 'scarlet macaw' }[b.look]);
  }
  return { draw, bigText };
})();
