/* ============================================================
   save.js — save and resume a crab's life
   ============================================================
   The island regrows from the seed; every burrow anybody dug is
   saved as a run-length list of cells.  Plus the crab, the food
   on the forest floor, shed shells, the clock, the moon, the
   season and the weather.  Saved every few seconds and when the
   tab hides.  Anything malformed is ignored rather than trusted:
   a bad save falls back to a new egg.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'redcrab.save',
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
      season: Wd.season, weather: { state: Wd.weather.state, timer: Wd.weather.timer },
      ground: Wd.ground.serialize(),
      player: G.player.serialize(),
      items: Wd.items.filter(it => it.bites > 0 && it.fy === null).map(it => [it.kind, num(it.x), it.bites, +it.col.toFixed(2)]),
      exuviae: Wd.exuviae.map(e => [num(e.x), num(e.y), +e.s.toFixed(3), e.form]),
      robberDone: Wd.robber.done, rivalsSent: Wd.rivalsSent || 0,
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
      G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .75; G.year = Math.max(0, o.year | 0);
      Wd.season = o.season === 'dry' ? 'dry' : 'wet';
      Object.assign(Wd.weather, { state: ['clear', 'cloudy', 'rain', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'clear', timer: 20 });
      if (!Wd.ground.restore(o.ground)) return false;
      const ok = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(v => typeof v === 'string' || Number.isFinite(v));
      Wd.items = [];
      for (const it of o.items || []) if (ok(it, 4) && FOOD_KINDS[it[0]]) { const f = Wd.spawnItem(it[1], it[0]); f.bites = clamp(it[2] | 0, 1, FOOD_KINDS[it[0]].bites); f.col = clamp(+it[3], 0, .999); f.x = clamp(it[1], 960, WORLD.right - 40); f.y = Wd.ground.walkTop(f.x, 4) - 1; }
      Wd.exuviae = (o.exuviae || []).filter(e => ok(e, 3)).map(e => ({ x: e[0], y: e[1], s: clamp(e[2], .02, .5), form: FORMS[e[3]] ? e[3] : 'red' }));
      Wd.robber.done = !!o.robberDone; Wd.rivalsSent = o.rivalsSent | 0;
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
