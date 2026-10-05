/* ============================================================
   save.js — save and resume a beetle's life
   ============================================================
   The log, the trees and the soil regrow from the seed; what the
   grubs ate is saved as a run-length list of cells, so every
   tunnel survives.  Plus the beetle, the fruit, the sticks, the
   sibling grubs, shed skins and the clock.  Saved every few
   seconds and when the tab hides.  Anything malformed is ignored
   rather than trusted: a bad save falls back to a new egg.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'hercules.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && Array.isArray(o.wood) && o.player && typeof o.player === 'object' ? o : null;
    } catch (e) { return null; }
  },

  write(G) {
    if (!G.started || !G.forest) return false;
    const F = G.forest, num = (v) => +(+v).toFixed(1);
    const o = {
      version: this.VERSION, when: Date.now(), seed: F.seed, form: G.form,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation,
      weather: { state: F.weather.state, timer: F.weather.timer },
      wood: F.wood.serialize(),
      player: G.player.serialize(),
      fruits: F.fruits.filter(f => !f.hanging && !f.falling && f.bites > 0).map(f => [f.kind, num(f.x), f.bites]),
      sticks: F.sticks.map(s => [num(s.x), s.flipped ? 1 : 0]),
      grubs: F.grubs.map(g => [num(g.x), num(g.y), num(g.r), num(g.ang)]),
      exuviae: (F.exuviae || []).map(e => [num(e.x), num(e.y), num(e.r), num(e.ang)]),
      coatiDone: F.coati.done, rivalsSent: F.rivalsSent,
      journal: Journal.serialize()
    };
    const json = JSON.stringify(o);
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) { Journal.dropPhotos(); try { localStorage.setItem(this.KEY, json); return true; } catch (e2) { return false; } }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayer) {
    try {
      if (FORMS[o.form]) G.form = o.form;
      makeWorld(o.seed);
      const F = G.forest;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .8, 0, 1); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      Object.assign(F.weather, { state: ['clear', 'cloudy', 'rain', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'clear', timer: 20 });
      if (!F.wood.restore(o.wood)) return false;
      const ok = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(v => typeof v === 'string' || Number.isFinite(v));
      F.fruits = F.fruits.filter(f => f.hanging);
      for (const f of o.fruits || []) if (ok(f, 3) && FRUIT_KINDS[f[0]]) { const fr = F.dropFruit(f[0], f[1], true); fr.bites = clamp(f[2] | 0, 1, FRUIT_KINDS[f[0]].bites); }
      (o.sticks || []).forEach((s, i) => { if (ok(s, 2) && F.sticks[i]) F.sticks[i].flipped = !!s[1]; });
      (o.grubs || []).forEach((g, i) => { if (ok(g, 4) && F.grubs[i]) Object.assign(F.grubs[i], { x: g[0], y: g[1], r: clamp(g[2], 3, 9), ang: g[3] }); });
      F.exuviae = (o.exuviae || []).filter(e => ok(e, 4)).map(e => ({ x: e[0], y: e[1], r: e[2], ang: e[3] }));
      F.coati.done = !!o.coatiDone; F.rivalsSent = o.rivalsSent | 0;
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
