/* ============================================================
   save.js — save and resume a wolf's life
   ============================================================
   The valley regrows from the seed; every den anybody dug, every
   trail broken through the snow and the snow itself are saved as
   a run-length list of cells.  Plus the wolf, the pack's phase,
   the clock, the moon, the season and the weather, the scent
   posts, the tracks already read, the new den and the meal.
   Saved every few seconds and when the tab hides.  Anything
   malformed is ignored rather than trusted: a bad save falls
   back to a newborn pup.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'wolf.save',
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
      posts: Wd.posts.map(q => q.marked ? 1 : 0),
      tracks: Wd.tracks.map(t => t.seen ? 1 : 0),
      newDen: Wd.newDen ? { x: num(Wd.newDen.x), y: num(Wd.newDen.y), cx: num(Wd.newDen.cx), cy: num(Wd.newDen.cy), dir: Wd.newDen.dir } : null,
      meal: Wd.meal && !Wd.meal.taken ? num(Wd.meal.x) : null,
      bioMet: !!(Wd.biologist && Wd.biologist.met),
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
      Wd.season = SEASONS[o.season] ? o.season : 'spring';
      Wd.phase = ['den', 'outside', 'rendezvous', 'travel', 'winter', 'home2', 'lone', 'parent'].includes(o.phase) ? o.phase : 'den';
      Object.assign(Wd.weather, { state: ['clear', 'cloudy', 'rain', 'snowfall', 'storm'].includes(o.weather && o.weather.state) ? o.weather.state : 'clear', timer: 20 });
      if (!Wd.ground.restore(o.ground)) return false;
      if (Wd.ground.snowOn) for (const T of Wd.trees) T.snow = 1;
      if (Array.isArray(o.posts)) Wd.posts.forEach((q, i) => { q.marked = !!o.posts[i]; });
      if (Array.isArray(o.tracks)) Wd.tracks.forEach((t, i) => { t.seen = !!o.tracks[i]; });
      const nd = o.newDen;
      Wd.newDen = nd && [nd.x, nd.y, nd.cx, nd.cy].every(Number.isFinite) ? { x: nd.x, y: nd.y, cx: nd.cx, cy: nd.cy, dir: nd.dir === -1 ? -1 : 1 } : null;
      Wd.meal = Number.isFinite(o.meal) ? { x: clamp(o.meal, WORLD.left + 40, WORLD.right - 40), y: Wd.ground.walkTop(o.meal, 4) - 3, taken: false, t: 0 } : null;
      Wd.bioMetSaved = !!o.bioMet;
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
