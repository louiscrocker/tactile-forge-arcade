/* ============================================================
   save.js — save and resume a kingdom
   ============================================================
   The plants regrow from their seed, and the soil is saved as a
   run-length list of cells (so every tunnel you dug survives).
   Plus the colony, the players, the aphids, the calendar and the
   journal graph.  Saved every few seconds and when the tab hides.
   Anything malformed is ignored rather than trusted: a bad save
   falls back to a new kingdom instead of bricking the game.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'antkingdom.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && Array.isArray(o.soil) && o.colony && Array.isArray(o.players) ? o : null;
    } catch (e) { return null; }
  },

  write(G) {
    if (!G.started || !G.world) return false;
    const w = G.world;
    const o = {
      version: this.VERSION, when: Date.now(), seed: w.seed, species: G.species,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation,
      dayOfYear: w.dayOfYear, year: w.year,
      weather: { state: w.weather.state, timer: w.weather.timer },
      soil: w.soil.serialize(),
      colony: G.colony.serialize(),
      players: G.players.map(p => p.serialize()),
      herds: w.plants.map(P => P.herd.serialize()),
      leaves: w.plants.map(P => P.leaves.map(l => l.bites || 0)),
      foods: w.foods.list.filter(f => !f.falling).map(f => [f.kind, +f.x.toFixed(1), f.value]),
      journal: Journal.serialize()
    };
    const json = JSON.stringify(o);
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) {
      /* storage is full: the journal's photo thumbnails are the big things; let them go and try again */
      Journal.dropPhotos();
      try { localStorage.setItem(this.KEY, json); return true; } catch (e2) { return false; }
    }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayers) {
    try {
      if (SPECIES[o.species]) G.species = o.species;
      makeWorld(o.seed);
      const w = G.world;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .35, 0, 1); G.day = o.day || 1; G.generation = o.generation || 1;
      w.dayOfYear = clamp(o.dayOfYear || 5, 1, 16); w.year = o.year || 1; w.updateSeason(); w.seasonChanged = false;
      Object.assign(w.weather, { state: ['clear', 'cloudy', 'rain', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'clear', timer: 20 });
      if (!w.soil.restore(o.soil)) return false;
      G.colony.restore(o.colony);
      (o.herds || []).forEach((h, i) => w.plants[i] && w.plants[i].herd.restore(h));
      (o.leaves || []).forEach((arr, i) => { const P = w.plants[i]; if (P) arr.forEach((b, k) => { if (P.leaves[k]) P.leaves[k].bites = b; }); });
      w.foods.list.length = 0;
      for (const [kind, x, value] of o.foods || []) if (FOOD_KINDS[kind] && Number.isFinite(x)) { const f = w.foods.add(kind, x, w.soil.surfaceAt(x) - FOOD_KINDS[kind].r * .6, false); f.value = value; }
      makePlayers(o.players);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
