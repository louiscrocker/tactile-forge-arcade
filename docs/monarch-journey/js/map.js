/* ============================================================
   map.js — a kid's map of North America
   ============================================================
   A coarse hand-traced outline (longitude, latitude), the Great
   Lakes, the borders, and the routes: your flight south, the
   real tagged monarchs, and the spring relay north.
   ============================================================ */
'use strict';

const MapView = (function () {
  /* mainland outline, roughly clockwise from the Pacific Northwest */
  const OUTLINE = [
    [-124, 48.5], [-124.5, 45], [-124, 42], [-123, 38.5], [-121, 35], [-118, 33.8], [-117, 32.5], [-115, 31], [-113, 29.5], [-112, 28], [-110, 25.5], [-109.5, 23], [-110.5, 23.5], [-112, 26.5], [-114, 29], [-113, 30.5], [-110, 28.5], [-108, 26], [-106, 23.5], [-105, 21], [-103, 18.5], [-100, 17], [-97, 16], [-94, 15.8], [-92, 14.8], [-90, 14], [-88, 15.8], [-88.5, 18], [-87.5, 21.5], [-90, 21.2], [-91.5, 19], [-94, 18.2], [-96, 19.5], [-97.5, 22.5], [-97.3, 26], [-96, 28.5], [-94, 29.5], [-91, 29.2], [-89.5, 29], [-88, 30.3], [-85, 29.8], [-83, 29.2], [-82, 26.5], [-81, 25.2], [-80.2, 27], [-81, 30.5], [-79, 33], [-76.5, 35], [-75.5, 37.5], [-74, 40], [-71.5, 41.3], [-70, 42.5], [-70.5, 43.8], [-67, 44.8], [-65.5, 45.5], [-63.5, 46.5], [-61, 47.5], [-64.5, 49], [-68, 49.5], [-64.5, 51], [-58.5, 51.5], [-56, 53], [-60, 55.5], [-63, 58.5], [-65, 60.5], [-70, 61.5], [-78, 62.5], [-86, 63], [-92, 62.5], [-95, 61], [-102, 61], [-110, 61], [-120, 60.5], [-128, 59], [-132, 56], [-130, 54], [-127, 51], [-124, 48.5]
  ];
  const HUDSON = [[-94, 59], [-88, 56.5], [-82, 52.5], [-79, 55], [-77, 58], [-78, 61], [-85, 62], [-92, 61.5]];
  const LAKES = [[-87.5, 47.5, 4.2, 1.6, .15], [-87, 44, 1.5, 3.2, .05], [-82.2, 44.8, 2.6, 2.2, -.4], [-81, 42.2, 2.7, 1.1, .35], [-77.6, 43.7, 1.9, .7, .1]];
  const ROUTE = [[-82.5, 42.0], [-82.4, 41.5], [-84, 40.6], [-89, 40], [-92, 38], [-97, 35.5], [-98, 30.5], [-100.5, 27], [-100, 24.5], [-100.5, 21], [-100.3, 19.6]];
  const RESERVE = [-100.3, 19.6];
  const LABELS = [['CANADA', -105, 55, 15], ['UNITED STATES', -100, 40, 15], ['MÉXICO', -104, 24, 14], ['Gulf of\nMexico', -90, 24.5, 11], ['Pacific\nOcean', -122, 27, 11], ['Atlantic\nOcean', -68, 35, 11], ['Hudson Bay', -85, 58, 9]];

  let W = 1, H = 1, ox = 0, oy = 0, sc = 1;
  function fit(w, h) {
    W = w; H = h;
    const lonSpan = 130 - 55, latSpan = 64 - 13;
    sc = Math.min(w / lonSpan, h / latSpan) * .96;
    ox = (w - lonSpan * sc) / 2; oy = (h - latSpan * sc) / 2;
  }
  const px = (lon) => ox + (lon + 130) * sc;
  const py = (lat) => oy + (64 - lat) * sc;

  function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([lo, la], i) => i ? ctx.lineTo(px(lo), py(la)) : ctx.moveTo(px(lo), py(la))); ctx.closePath(); }

  /* opts: { progress 0..1 along the south route, showReal, hops: [[lon,lat],[lon,lat]] (spring leg), hopT 0..1,
            you: [lon,lat], tags: [{lon,lat,from}], time } */
  function draw(ctx, w, h, opts = {}) {
    fit(w, h);
    const t = opts.time || 0;
    ctx.save();
    ctx.fillStyle = '#9fd0ee'; ctx.fillRect(0, 0, w, h);
    /* land */
    poly(ctx, OUTLINE);
    ctx.fillStyle = '#e8dfb8'; ctx.fill();
    ctx.strokeStyle = '#8a7a4a'; ctx.lineWidth = 1.5; ctx.stroke();
    /* a gentle green tint for the east, dry tint for the southwest */
    ctx.save(); poly(ctx, OUTLINE); ctx.clip();
    const g = ctx.createLinearGradient(px(-125), py(45), px(-70), py(30));
    g.addColorStop(0, 'rgba(200,180,110,.45)'); g.addColorStop(.5, 'rgba(160,200,120,.35)'); g.addColorStop(1, 'rgba(120,180,110,.4)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9fd0ee';
    poly(ctx, HUDSON); ctx.fill();
    for (const [lo, la, rx, ry, rot] of LAKES) { ctx.beginPath(); ctx.ellipse(px(lo), py(la), rx * sc, ry * sc, rot, 0, TAU); ctx.fill(); }
    /* borders */
    ctx.strokeStyle = 'rgba(90,70,40,.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px(-124), py(49)); ctx.lineTo(px(-95), py(49)); ctx.lineTo(px(-90), py(48)); ctx.lineTo(px(-84), py(46.5)); ctx.lineTo(px(-82), py(43)); ctx.lineTo(px(-79), py(43.5)); ctx.lineTo(px(-75), py(45)); ctx.lineTo(px(-71), py(45)); ctx.lineTo(px(-67.5), py(47)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(-117), py(32.5)); ctx.lineTo(px(-111), py(31.3)); ctx.lineTo(px(-108), py(31.3)); ctx.lineTo(px(-106.5), py(31.8)); ctx.lineTo(px(-103), py(29)); ctx.lineTo(px(-100), py(28)); ctx.lineTo(px(-97.3), py(26)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    /* labels */
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [txt, lo, la, size] of LABELS) {
      ctx.font = `${size > 12 ? 900 : 700} ${Math.max(9, size * sc / 9)}px ${UI_FONT}`;
      ctx.fillStyle = size > 12 ? 'rgba(80,60,30,.55)' : 'rgba(30,70,110,.7)';
      txt.split('\n').forEach((line, i) => ctx.fillText(line, px(lo), py(la) + i * size * sc / 8));
    }
    /* real tagged monarchs */
    if (opts.showReal) {
      ctx.strokeStyle = 'rgba(60,60,80,.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]);
      for (const r of REAL_TAGS) {
        ctx.beginPath(); ctx.moveTo(px(r.lon), py(r.lat));
        ctx.quadraticCurveTo(px((r.lon + RESERVE[0]) / 2 - 3), py((r.lat + RESERVE[1]) / 2), px(RESERVE[0]), py(RESERVE[1])); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#3a3a50'; ctx.beginPath(); ctx.arc(px(r.lon), py(r.lat), 3.5, 0, TAU); ctx.fill();
        ctx.font = `700 ${Math.max(9, sc * 1.1)}px ${UI_FONT}`; ctx.fillStyle = '#3a3a50'; ctx.textAlign = 'left';
        ctx.fillText(`${r.from} · ${r.days} days`, px(r.lon) + 6, py(r.lat) - 6);
        ctx.setLineDash([3, 4]);
      }
      ctx.setLineDash([]);
    }
    /* your route south */
    const prog = opts.progress === undefined ? 1 : clamp(opts.progress, 0, 1);
    const pts = ROUTE.map(([lo, la]) => [px(lo), py(la)]);
    const total = pts.reduce((s, p, i) => i ? s + dist(p[0], p[1], pts[i - 1][0], pts[i - 1][1]) : 0, 0);
    ctx.strokeStyle = 'rgba(242,140,30,.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    let left = total * prog, you = pts[0];
    ctx.strokeStyle = '#e0641a'; ctx.lineWidth = 3.5; ctx.setLineDash([9, 6]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const d = dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]);
      if (d <= left) { ctx.lineTo(pts[i][0], pts[i][1]); left -= d; you = pts[i]; }
      else { const k = left / d; you = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; ctx.lineTo(you[0], you[1]); left = 0; }
    }
    ctx.stroke(); ctx.setLineDash([]);
    /* the spring relay */
    if (opts.hops) {
      ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 3; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -t * 20;
      for (const [a, b] of opts.hops) {
        ctx.beginPath(); ctx.moveTo(px(a[0]), py(a[1])); ctx.quadraticCurveTo(px((a[0] + b[0]) / 2 + 4), py((a[1] + b[1]) / 2), px(b[0]), py(b[1])); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (opts.hop) {
        const [a, b] = opts.hop, k = clamp(opts.hopT || 0, 0, 1);
        const cx = (a[0] + b[0]) / 2 + 4, cy = (a[1] + b[1]) / 2;
        const u = 1 - k;
        you = [px(u * u * a[0] + 2 * u * k * cx + k * k * b[0]), py(u * u * a[1] + 2 * u * k * cy + k * k * b[1])];
      }
    }
    /* stops */
    const stops = [[RESERVE, 'El Rosario, Michoacán'], [[-82.5, 42.0], 'Point Pelee'], [[-98.5, 30.3], 'Texas'], [[-96.5, 38.5], 'Kansas']];
    ctx.font = `800 ${Math.max(9, sc * 1.2)}px ${UI_FONT}`; ctx.textAlign = 'left';
    for (const [[lo, la], name] of stops) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(lo), py(la), 4.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e0641a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#4a3a20'; ctx.fillText(name, px(lo) + 8, py(la) + 4);
    }
    /* you */
    if (opts.you) you = [px(opts.you[0]), py(opts.you[1])];
    if (you) {
      ctx.save(); ctx.translate(you[0], you[1]); ctx.rotate(-Math.PI / 2 + Math.sin(t * 2) * .1);
      Sprites.drawMonarch(ctx, { s: Math.max(.35, sc * .09), variant: opts.variant || VARIANTS.male, open: 1, flap: .5 + .5 * Math.abs(Math.cos(t * 9)) });
      ctx.restore();
    }
    ctx.restore();
  }

  return { draw, ROUTE, RESERVE };
})();
