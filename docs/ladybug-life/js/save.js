/* ============================================================
   save.js — save and resume a garden
   ============================================================
   Plants regrow from their seeds, so a save holds the seeds, the
   calendar, the weather, every player, and the lists of living
   things.  Saved every few seconds and whenever the tab hides.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'ladybug.save',
  VERSION: 3,

  exists() { try { const s = localStorage.getItem(this.KEY); if (!s) return null; const o = JSON.parse(s); return o.version === this.VERSION ? o : null; } catch (e) { return null; } },

  write(G) {
    if (!G.started) return;
    const g = G.garden;
    const o = {
      version: this.VERSION, when: Date.now(),
      seed: g.seed, layout: g.plants.map(p => ({ type: p.type.key, x: p.ox })),
      time: G.time, tod: G.tod, day: G.day, generation: G.generation,
      dayOfYear: g.dayOfYear, year: g.year,
      weather: { state: g.weather.state, timer: g.weather.timer, rain: g.weather.rain, cloud: g.weather.cloud, snow: g.weather.snow },
      players: G.players.map(p => p.serialize()),
      plants: g.plants.map(p => ({
        aphids: p.aphids.list.map(a => [a.seg, +a.t.toFixed(4), a.variant, +a.grow.toFixed(2), a.winged ? 1 : 0, +a.off.toFixed(2)]),
        scales: p.aphids.scales.map(s => [s.seg, +s.t.toFixed(3), +s.off.toFixed(2)]),
        ants: p.ants.list.map(a => [a.seg, +a.t.toFixed(3), a.dir]),
        npcs: (p.npcs.list || []).map(w => [w.seg, +w.t.toFixed(3), w.dir, w.instar])
      })),
      exuviae: G.exuviae.slice(-40),
      eggClusters: G.eggClusters.slice(-20),
      journal: Journal.serialize(),
      lastCluster: G.lastCluster || null
    };
    try { localStorage.setItem(this.KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeGarden, makePlayers) {
    try {
      makeGarden(o.seed, o.layout);
      const g = G.garden;
      G.time = o.time || 0; G.tod = o.tod; G.day = o.day || 1; G.generation = o.generation || 1;
      g.dayOfYear = o.dayOfYear || 1; g.year = o.year || 1; g.updateSeason(); g.seasonChanged = false;
      Object.assign(g.weather, o.weather || {});
      g.plants.forEach((p, i) => {
        const s = o.plants[i]; if (!s) return;
        p.aphids.list.length = 0;
        for (const [seg, t, variant, grow, winged, off] of s.aphids) { if (p.segs[seg]) { const a = p.aphids.add(seg, t, variant, grow); a.winged = !!winged; a.off = off; } }
        p.aphids.scales = (s.scales || []).filter(([seg]) => p.segs[seg]).map(([seg, t, off]) => ({ seg, t, off, x: 0, y: 0, ang: 0 }));
        p.ants.list.length = 0;
        for (const [seg, t, dir] of s.ants) if (p.segs[seg]) p.ants.list.push({ seg, t, dir, walk: 0, x: 0, y: 0, ang: 0, pause: 0, bite: 0, cooldown: 0, drinking: 0 });
        if (p.npcs.list) { p.npcs.list.length = 0; for (const [seg, t, dir, instar] of (s.npcs || [])) if (p.segs[seg]) p.npcs.list.push({ seg, t, dir, instar, walk: 0, x: 0, y: 0, ang: 0, pause: 0, chew: 0, eatClock: rnd(6, 14), id: Math.random() }); }
      });
      G.exuviae = (o.exuviae || []).filter(e => g.plantAt(e.plant || 0).segs[e.seg]);
      G.eggClusters = (o.eggClusters || []).filter(c => g.plantAt(c.plant || 0).segs[c.seg]);
      G.lastCluster = o.lastCluster || null;
      makePlayers(o.players);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
