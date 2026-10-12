/* ============================================================
   save.js — save and resume a polar bear's life
   ============================================================
   The coast regrows from the seed; every den anybody dug, every
   footprint in the snow, the snow itself and the sea ice (or the
   floes) are saved as a run-length list of cells, and whether the
   old drift has melted.  Plus the bear, the story's phase, the
   clock, the moon, the season and the weather, the tracks already
   read, the new den, the meal and the scientists met.  Saved
   every few seconds and when the tab hides.  Anything malformed
   is ignored rather than trusted: a bad save falls back to a
   newborn cub.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'polarbear.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && Array.isArray(o.ground) && o.player && typeof o.player === 'object' ? o : null;
    } catch (e) { return null; }
  },

  write(G) {
    if (!G.started || !G.world) return false;
    const Wd = G.world, num = (v) => +(+v).toFixed(1);
    const o = {
      version: this.VERSION, when: Date.now(), seed: Wd.seed, form: G.form, sex: G.sex,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation, moon: G.moon, year: G.year,
      season: Wd.season, phase: Wd.phase, weather: { state: Wd.weather.state, timer: Wd.weather.timer },
      ground: Wd.ground.serialize(),
      player: G.player.serialize(),
      driftGone: !!Wd.ground.driftGone, iceMode: Wd.ground.iceMode || null, aurora: !!Wd.auroraSeen,
      tracks: Wd.tracks.map(t => t.seen ? 1 : 0),
      newDen: Wd.newDen ? { x: num(Wd.newDen.x), y: num(Wd.newDen.y), cx: num(Wd.newDen.cx), cy: num(Wd.newDen.cy), dir: Wd.newDen.dir } : null,
      meal: Wd.meal && !Wd.meal.taken ? num(Wd.meal.x) : null,
      buggyMet: !!(Wd.buggy && Wd.buggy.met) || !!Wd.buggyMetSaved,
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
      G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .2; G.year = Math.max(0, o.year | 0);
      Wd.setSeason(SEASONS[o.season] ? o.season : 'winter');
      Wd.phase = ['den', 'outside', 'trek', 'ice', 'breakup', 'shore', 'ice2', 'alone', 'adult', 'shore2', 'parent'].includes(o.phase) ? o.phase : 'den';
      Object.assign(Wd.weather, { state: ['clear', 'cloudy', 'rain', 'snowfall'].includes(o.weather && o.weather.state) ? o.weather.state : 'clear', timer: 20 });
      if (!Wd.ground.restore(o.ground, !!o.driftGone)) return false;
      Wd.ground.iceMode = Wd.ground.iceOn ? (['solid', 'young', 'floes'].includes(o.iceMode) ? o.iceMode : 'solid') : null;
      if (Wd.ground.iceMode === 'floes') Wd.ground.floeMap();
      Wd.auroraSeen = !!o.aurora;
      if (Array.isArray(o.tracks)) Wd.tracks.forEach((t, i) => { t.seen = !!o.tracks[i]; });
      const nd = o.newDen;
      Wd.newDen = nd && [nd.x, nd.y, nd.cx, nd.cy].every(Number.isFinite) ? { x: nd.x, y: nd.y, cx: nd.cx, cy: nd.cy, dir: nd.dir === -1 ? -1 : 1 } : null;
      Wd.meal = Number.isFinite(o.meal) ? { x: clamp(o.meal, WORLD.left + 40, WORLD.right - 40), y: Wd.ground.walkTop(o.meal, 4) - 3, taken: false, t: 0 } : null;
      Wd.buggyMetSaved = !!o.buggyMet;
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
