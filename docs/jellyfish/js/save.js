/* ============================================================
   save.js — save and resume a moon jelly's life
   ============================================================
   The bay regrows from the seed.  Saved: the jelly, which spots
   under the ledges your clone buds took, the clock, the day, the
   moon, the season and the weather, and the growth graph.  Saved
   every few seconds and when the tab hides.  Anything malformed
   is ignored rather than trusted: a bad save starts a new baby.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'jellyfish.save',
  VERSION: 1,

  /* the shape a save must have before anything in it is believed */
  valid(o) {
    if (!o || typeof o !== 'object' || o.version !== this.VERSION) return false;
    if (!Number.isFinite(o.seed) || !o.player || typeof o.player !== 'object' || Array.isArray(o.player)) return false;
    if (!['egg', 'planula', 'polyp', 'ephyra', 'medusa'].includes(o.player.stage)) return false;
    if (!Array.isArray(o.buds) || !o.buds.every(b => Array.isArray(b) && b.length === 2 && b.every(Number.isFinite))) return false;
    for (const k of ['time', 'tod', 'day']) if (!Number.isFinite(o[k])) return false;
    return true;
  },
  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return this.valid(o) ? o : null;
    } catch (e) { return null; }
  },

  write(G) {
    if (!G.started || !G.world) return false;
    const Wd = G.world;
    const o = {
      version: this.VERSION, when: Date.now(), seed: Wd.seed, form: G.form, sex: G.sex,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation, moon: G.moon, year: G.year,
      season: Wd.season, weather: { state: Wd.weather.state, timer: Wd.weather.timer },
      buds: Wd.sites.filter(s => s.bud).map(s => [+s.x.toFixed(1), +s.y.toFixed(1)]),
      player: G.player.serialize(),
      journal: Journal.serialize()
    };
    const json = JSON.stringify(o);
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) { Journal.dropPhotos(); try { localStorage.setItem(this.KEY, json); return true; } catch (e2) { return false; } }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayer) {
    try {
      if (!this.valid(o)) return false;
      if (FORMS[o.form]) G.form = o.form;
      G.sex = o.sex === 'girl' ? 'girl' : 'boy';
      makeWorld(o.seed);
      const Wd = G.world;
      G.time = Math.max(0, o.time); G.tod = clamp(o.tod, 0, 1); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .5; G.year = Math.max(0, o.year | 0);
      Wd.season = SEASON_INFO[o.season] ? o.season : 'summer'; Wd.temp = SEASON_INFO[Wd.season][1];
      Object.assign(Wd.weather, { state: ['calm', 'cloudy', 'storm', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'calm', timer: 20 });
      for (const [x, y] of o.buds.slice(0, 12)) {
        let s = Wd.sites.find(q => Math.abs(q.x - x) < 2 && Math.abs(q.y - y) < 3);
        if (!s) { if (!Wd.ground.solidAt(x, y - 3) || Wd.ground.solidAt(x, y + 4)) continue; s = { x, y, kind: x > WORLD.harbourL ? 'dock' : 'ledge', mine: false, ph: 0, extra: true }; Wd.sites.push(s); }
        s.taken = null; s.bud = true; s.form = G.form;
      }
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
