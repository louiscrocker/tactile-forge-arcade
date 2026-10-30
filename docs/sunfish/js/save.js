/* ============================================================
   save.js — save and resume a sunfish's life
   ============================================================
   The coast regrows from the seed (nobody digs here), so a save is
   the sunfish, the clock, the moon, the season, the weather, what
   the boat and the net have done, and the journal's growth log.
   Saved every few seconds and when the tab hides.  Anything
   malformed is refused rather than trusted: a bad save falls back
   to a new egg.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'sunfish.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && Number.isFinite(o.seed) && o.player && typeof o.player === 'object' ? o : null;
    } catch (e) { return null; }
  },

  write(G) {
    if (!G.started || !G.world) return false;
    const Wd = G.world;
    const o = {
      version: this.VERSION, when: Date.now(), seed: Wd.seed, form: G.form, sex: G.sex,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation, moon: G.moon, year: G.year,
      season: Wd.season, weather: { state: Wd.weather.state, timer: Wd.weather.timer },
      player: G.player.serialize(),
      boatDone: Wd.boat.done | 0, netDone: !!Wd.net.done,
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
      G.sex = o.sex === 'girl' ? 'girl' : 'boy';
      makeWorld(o.seed);
      const Wd = G.world;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .3, 0, 1); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .5; G.year = Math.max(0, o.year | 0);
      Wd.season = SEASON_INFO[o.season] ? o.season : 'summer'; Wd.temp = SEASON_INFO[Wd.season][1];
      Object.assign(Wd.weather, { state: ['calm', 'cloudy', 'storm', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'calm', timer: 20 });
      Wd.boat.done = clamp(o.boatDone | 0, 0, 9); Wd.net.done = !!o.netDone;
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
