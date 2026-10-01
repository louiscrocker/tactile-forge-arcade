/* ============================================================
   keeper.js — pond keeper mode
   ============================================================
   After the first winter (or any time, if a grown-up switches
   it on) the child can shape the pond: plant lilies and weeds,
   add rock piles, move the log, pull plants out.  Each change
   is saved per place and replayed whenever that place is built.
   The science graph shows what the change did: more weeds and
   rocks mean more algae, and more algae means more tadpole food.
   ============================================================ */
'use strict';

const KEEPER_TOOLS = {
  lily: { icon: '🌸', name: 'Plant a lily', simple: 'Lily', tip: 'Lily pads give frogs a place to sit and hide, and shade the water.' },
  weed: { icon: '🌿', name: 'Plant a water weed', simple: 'Weed', tip: 'Weeds grow algae for tadpoles and give them places to hide.' },
  rocks: { icon: '🪨', name: 'Add a rock pile', simple: 'Rocks', tip: 'Rocks grow algae and give nymphs and snails a home.' },
  log: { icon: '🪵', name: 'Move the log', simple: 'Log', tip: 'The log is where turtles bask and frogs sit.' },
  pull: { icon: '✋', name: 'Pull out a plant', simple: 'Pull', tip: 'Too many plants can crowd the pond. Pulling some opens it up.' }
};

const Keeper = (function () {
  const $ = (id) => document.getElementById(id);
  let Gm = null, tool = null, active = false;

  /* apply one edit to a pond (and to the live algae, if the world exists) */
  function apply(pond, e, live) {
    const rng = mulberry32((e.x * 13 + e.y * 7) | 0);
    const inWater = Math.abs(e.x) < pond.W - 40;
    switch (e.op) {
      case 'lily': {
        if (!inWater) return false;
        const p = { x: e.x, r: 40 + rng() * 34, y: 0, tilt: 0, sink: 0, weight: 0, ph: rng() * TAU, notch: rng() * TAU, flower: true, bloom: 0, size: 1, health: 1, hue: rng(), vx: 0 };
        pond.pads.push(p); pond.pads.sort((a, b) => a.x - b.x);
        const site = { x: p.x, y: 14, r: p.r * .7, kind: 'pad', pad: p }; pond.algaeSites.push(site);
        if (live) live.patches.push({ site, amount: .2, x: site.x, y: site.y });
        return true;
      }
      case 'weed': {
        if (!inWater) return false;
        const base = pond.bedY(e.x);
        const w = { x: e.x, base, h: Math.max(20, Math.min(base - 30, 90 + rng() * 150)), ph: rng() * TAU, kind: rng() < .5 ? 'elodea' : 'hornwort', sway: .8, tint: rng() };
        pond.weeds.push(w);
        const site = { x: w.x, y: w.base - w.h * .5, r: 22, kind: 'weed', weed: w }; pond.algaeSites.push(site);
        if (live) live.patches.push({ site, amount: .15, x: site.x, y: site.y });
        return true;
      }
      case 'rocks': {
        if (!inWater) return false;
        for (let i = 0; i < 3; i++) {
          const x = e.x + (i - 1) * 34 + (rng() - .5) * 10, rx = 20 + rng() * 22, ry = rx * .55;
          const r = { x, y: pond.bedY(x) + ry * .35, rx, ry, k: rng(), tilt: (rng() - .5) * .4 };
          pond.rocks.push(r);
          const site = { x: r.x, y: r.y - r.ry * .8, r: r.rx * .8, kind: 'rock' }; pond.algaeSites.push(site);
          if (live) live.patches.push({ site, amount: .1, x: site.x, y: site.y });
        }
        return true;
      }
      case 'log': {
        if (!inWater) return false;
        pond.log.x = clamp(e.x, -pond.W + pond.log.len / 2 + 60, pond.W - pond.log.len / 2 - 60);
        return true;
      }
      case 'pull': {
        let best = null, bd = 90, kind = null;
        for (const w of pond.weeds) { const d = Math.abs(w.x - e.x); if (d < bd) { bd = d; best = w; kind = 'weed'; } }
        for (const p of pond.pads) { const d = Math.abs(p.x - e.x); if (d < bd && e.y < 60) { bd = d; best = p; kind = 'pad'; } }
        if (!best) return false;
        const list = kind === 'weed' ? pond.weeds : pond.pads;
        list.splice(list.indexOf(best), 1);
        const si = pond.algaeSites.findIndex(s => s.weed === best || s.pad === best);
        if (si >= 0) { const site = pond.algaeSites[si]; pond.algaeSites.splice(si, 1); if (live) { const pi = live.patches.findIndex(q => q.site === site); if (pi >= 0) live.patches.splice(pi, 1); } }
        return true;
      }
    }
    return false;
  }
  function edits(G, place) { if (!G.keeperEdits) G.keeperEdits = {}; return G.keeperEdits[place] || (G.keeperEdits[place] = []); }
  /* replay a place's edits onto a freshly built pond */
  function replay(G, pond) { for (const e of edits(G, pond.place.key)) apply(pond, e, null); }

  function unlocked(G) { return G.pond.year >= 2 || G.settings.keeperAny || G.settings.difficulty === 'easy'; }
  function init(game) {
    Gm = game;
    if (!$('keeperBar')) return;
    $('keeperBar').querySelectorAll('button[data-tool]').forEach(b => b.addEventListener('click', () => { tool = b.dataset.tool; refresh(); Voice.say(KEEPER_TOOLS[tool].name + '. ' + KEEPER_TOOLS[tool].tip, { interrupt: true }); AudioFX.click(); }));
    $('keeperDone').addEventListener('click', () => toggle(false));
  }
  function toggle(on) {
    if (on && !unlocked(Gm)) { UI.hint(Gm.settings.reading === 'simple' ? 'Pond keeper opens after your first winter.' : 'Pond keeper mode unlocks after your first winter (or switch on "Keeper any time" in settings).'); return; }
    active = on; tool = on ? (tool || 'lily') : null;
    $('keeperBar').hidden = !on;
    document.body.classList.toggle('keeping', on);
    refresh();
    if (on) { Gm.userZoom = Math.min(Gm.userZoom, .55); Voice.say(Gm.settings.reading === 'simple' ? 'Pond keeper! Pick a tool, then tap the pond.' : 'Pond keeper. Pick a tool, then tap the pond where you want it. Watch the science graph to see what changes.', { interrupt: true }); Bus.emit('keeperOn'); }
    else Gm.userZoom = 1;
  }
  function refresh() { if (!$('keeperBar')) return; $('keeperBar').querySelectorAll('button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool)); if (tool) $('keeperTip').textContent = KEEPER_TOOLS[tool].tip; }
  /* a tap on the pond while keeping */
  function tap(wx, wy) {
    if (!active || !tool) return false;
    const e = { op: tool, x: Math.round(wx), y: Math.round(wy) };
    const ok = apply(Gm.pond, e, Gm.algae);
    if (ok) {
      edits(Gm, Gm.pond.place.key).push(e);
      Gm.particles.sparkle(wx, Math.min(wy, Gm.pond.bedY(wx) - 10), 18, '#dff6c8', 20);
      if (Gm.pond.inWater(wx, Math.max(wy, 10))) Gm.particles.bubbles(wx, Math.max(wy, 20), 6, 1);
      AudioFX.bubble && AudioFX.bubble(1, .08, wx);
      Bus.emit('keeperEdit', e, edits(Gm, Gm.pond.place.key).length);
    } else UI.hint(Gm.settings.reading === 'simple' ? 'Tap in the water.' : 'Tap somewhere in the water for that.');
    return true;
  }
  return { init, toggle, tap, replay, active: () => active, unlocked };
})();
