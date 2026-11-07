/* ============================================================
   save.js — save and resume a beetle's life
   ============================================================
   The stump and the soil regrow from the seed; what changed (what
   was eaten, what rotted, what crumbled) is saved as a run-length
   list of cells, so every tunnel survives.  Plus the beetle, the
   clock (year, season, evening), the grubs, shed skins, the log
   pile, her eggs.  Saved every few seconds and when the tab hides.
   Anything malformed is ignored rather than trusted: a bad save
   falls back to a new egg.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'stag.save',
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
      year: G.year, yt: G.yt, yearsAll: G.yearsAll, evening: G.evening,
      wood: F.wood.serialize(),
      player: G.player.serialize(),
      grubs: F.grubs.map(g => [num(g.x), num(g.y), num(g.r), num(g.ang)]),
      exuviae: (F.exuviae || []).map(e => [num(e.x), num(e.y), num(e.r), num(e.ang)]),
      pile: F.pile, kidDone: F.kid.done, sapOn: !!F.sap.on, eggs: F.eggs.map(e => [num(e.x), num(e.y)]), tried: F.sites.map(q => !!q.tried),
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
      G.year = clamp(o.year | 0, 1, 9); G.yt = clamp(+o.yt || 0, 0, .999); G.yearsAll = clamp(o.yearsAll | 0, 1, 999); G.evening = clamp(o.evening | 0, 0, 9);
      F.wood.year = G.year;
      if (!F.wood.restore(o.wood)) return false;
      const ok = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(v => typeof v === 'string' || Number.isFinite(v));
      (o.grubs || []).forEach((g, i) => { if (ok(g, 4) && F.grubs[i]) Object.assign(F.grubs[i], { x: g[0], y: g[1], r: clamp(g[2], 3, 9), ang: g[3] }); });
      F.exuviae = (o.exuviae || []).filter(e => ok(e, 4)).map(e => ({ x: e[0], y: e[1], r: e[2], ang: e[3] }));
      F.pile = clamp(o.pile | 0, 0, 6); F.kid.done = !!o.kidDone; F.sap.on = !!o.sapOn; F.sap.flow = F.sap.on ? 1 : 0; if (Array.isArray(o.tried)) o.tried.forEach((t, i) => { if (F.sites[i]) F.sites[i].tried = !!t; });
      F.eggs = (o.eggs || []).filter(e => ok(e, 2)).map(e => ({ x: e[0], y: e[1] }));
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
