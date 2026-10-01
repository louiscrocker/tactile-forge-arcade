/* ============================================================
   save.js — save and resume a pond
   ============================================================
   The pond rebuilds from its seed, so a save holds the seed, the
   calendar, the weather and ice, every player, and the lists of
   living things.  Saved every few seconds and whenever the tab
   hides.
   ============================================================ */
'use strict';

const SaveGame = {
  get KEY() { return pkey('save'); },
  VERSION: 1,

  exists() { try { const s = localStorage.getItem(this.KEY); if (!s) return null; const o = JSON.parse(s); return o.version === this.VERSION ? o : null; } catch (e) { return null; } },

  write(G) {
    if (!G.started) return false;
    const g = G.pond;
    const o = {
      version: this.VERSION, when: Date.now(),
      seed: g.baseSeed, place: G.place || 'home',
      time: G.time, tod: G.tod, day: G.day, generation: G.generation,
      dayOfYear: g.dayOfYear, year: g.year,
      weather: { state: g.weather.state, timer: g.weather.timer, rain: g.weather.rain, cloud: g.weather.cloud, snow: g.weather.snow, ice: g.weather.ice },
      players: G.players.map(p => p.serialize()),
      algae: G.algae.patches.map(p => +p.amount.toFixed(2)),
      wrigglers: G.wrigglers.list.filter(w => !w.caught).map(w => [+w.x.toFixed(0), +w.depth.toFixed(1)]),
      bugs: G.bugs.list.filter(b => !b.caught).map(b => [b.kind, +b.x.toFixed(0), +b.y.toFixed(0)]),
      nymphs: G.nymphs.list.map(n => [+n.x.toFixed(0), n.dir]),
      eggMasses: G.eggMasses.slice(-12),
      lastMass: G.lastMass || null,
      neighbours: G.neighbours ? G.neighbours.serialize() : null,
      dry: g.weather.dry,
      events: G.events ? G.events.serialize() : null,
      keeper: G.keeperEdits || {},
      eggStore: Object.fromEntries(Object.entries(G.eggStore || {}).map(([k, v]) => [k, v.slice(-12)])),
      journal: Journal.serialize()
    };
    try { localStorage.setItem(this.KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makePond, makePlayers) {
    try {
      G.keeperEdits = o.keeper || {};
      makePond(o.seed, o.place || 'home');
      const g = G.pond;
      G.time = o.time || 0; G.tod = o.tod; G.day = o.day || 1; G.generation = o.generation || 1;
      g.dayOfYear = o.dayOfYear || 1; g.year = o.year || 1; g.updateSeason(); g.seasonChanged = false;
      Object.assign(g.weather, o.weather || {});
      if (g.season === 'winter') { for (const p of g.pads) { p.health = 0; p.size = .3; } }
      if (g.season === 'autumn') { for (const p of g.pads) p.health = 1 - smoothstep(.2, 1, g.seasonT); }
      (o.algae || []).forEach((a, i) => { if (G.algae.patches[i]) G.algae.patches[i].amount = a; });
      G.wrigglers.list.length = 0;
      for (const [x, depth] of (o.wrigglers || [])) { const w = G.wrigglers.add(x); w.depth = depth; }
      G.bugs.list.length = 0;
      for (const [kind, x, y] of (o.bugs || [])) if (BUG_KINDS[kind]) G.bugs.add(kind, x, y);
      (o.nymphs || []).forEach(([x, dir], i) => { const n = G.nymphs.list[i]; if (n) { n.x = x; n.dir = dir; n.y = g.bedY(x) - 8; n.tx = x; } });
      G.eggMasses = o.eggMasses || [];
      G.lastMass = o.lastMass || null;
      if (G.neighbours) G.neighbours.restore(o.neighbours);
      if (G.events) G.events.restore(o.events);
      if (o.eggStore) { G.eggStore = o.eggStore; G.eggStore[G.place] = G.eggMasses; }
      g.weather.dry = o.dry || 0; g.level = g.weather.dry * 46; g.updateWet();
      makePlayers(o.players);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
