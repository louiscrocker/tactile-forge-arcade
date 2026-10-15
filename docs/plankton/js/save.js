/* ============================================================
   save.js — save and resume a copepod's life
   ============================================================
   The sea and its floor regrow from the seed.  Saved: the copepod,
   the clock, the moon, the season, the bloom, the weather and the
   growth log.  Saved every few seconds and when the tab hides.
   Anything malformed is ignored rather than trusted: a save of the
   wrong shape is refused and a new egg starts instead.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'plankton.save',
  VERSION: 1,

  /* the shape a save must have before anything in it is used */
  valid(o) {
    if (!o || typeof o !== 'object' || o.version !== this.VERSION) return false;
    if (!Number.isFinite(o.seed) || !Number.isFinite(o.time) || !Number.isFinite(o.tod) || !Number.isFinite(o.day)) return false;
    const p = o.player;
    if (!p || typeof p !== 'object' || !Number.isFinite(p.step) || p.step < 0 || p.step > 12 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    if (p.stats !== undefined && (typeof p.stats !== 'object' || p.stats === null || Array.isArray(p.stats))) return false;
    if (p.flags !== undefined && (typeof p.flags !== 'object' || p.flags === null || Array.isArray(p.flags))) return false;
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
      season: Wd.season, bloom: Wd.bloom, weather: { state: Wd.weather.state, timer: Wd.weather.timer },
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
      G.time = Math.max(0, +o.time || 0); G.tod = clamp(+o.tod || .3, 0, 1); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .5; G.year = Math.max(0, o.year | 0);
      Wd.setSeason(SEASON_INFO[o.season] ? o.season : 'spring');
      if (Number.isFinite(o.bloom)) Wd.bloom = clamp(o.bloom, .1, 1);
      Object.assign(Wd.weather, { state: ['calm', 'cloudy', 'storm', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'calm', timer: 20 });
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
