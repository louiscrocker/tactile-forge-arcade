/* ============================================================
   save.js — save and resume a sea star's life
   ============================================================
   The shore regrows from the seed (its cells are still saved as a
   run-length list, the family's format).  Plus the sea star, the
   food on the rocks, the empty shells, the bare rock and the new
   life of the keystone, the child and the scientist, the clock, the
   moon, the season and the weather.  Saved every few seconds and when the tab hides.
   Anything malformed is ignored rather than trusted: a bad save
   falls back to a new egg.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'starfish.save',
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
      items: Wd.items.filter(it => !it.eaten).map(it => [it.kind, num(it.x), 1, +it.col.toFixed(2)]),
      midden: Wd.midden.map(m => [num(m.x), num(m.y), m.kind, +m.rot.toFixed(2)]),
      bare: Wd.bare.map(b => num(b.x)), life: Wd.life.map(l => [num(l.x), l.kind, +l.s.toFixed(2)]), keystone: Wd.keystone,
      kidDone: Wd.kid.done, sciDone: Wd.sci.done,
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
      Wd.season = SEASON_INFO[o.season] ? o.season : 'summer';
      Object.assign(Wd.weather, { state: ['calm', 'cloudy', 'storm', 'clearing'].includes(o.weather && o.weather.state) ? o.weather.state : 'calm', timer: 20 });
      if (!Wd.ground.restore(o.ground)) return false;
      const ok = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(v => typeof v === 'string' || Number.isFinite(v));
      Wd.items = [];
      for (const it of (o.items || []).slice(0, 400)) if (ok(it, 4) && FOOD_KINDS[it[0]]) { const f = Wd.spawnItem(it[1], it[0]); f.col = clamp(+it[3], 0, .999); }
      Wd.midden = (o.midden || []).filter(m => ok(m, 2) && FOOD_KINDS[m[2]]).slice(0, 90).map(m => ({ x: m[0], y: m[1], kind: m[2], rot: clamp(+m[3] || 0, -2, 2), t: 9 }));
      Wd.bare = (Array.isArray(o.bare) ? o.bare : []).filter(Number.isFinite).slice(0, 200).map(x => ({ x, t: 9 }));
      Wd.life = (Array.isArray(o.life) ? o.life : []).filter(l => ok(l, 2) && LIFE_KINDS.includes(l[1])).slice(0, 200).map(l => ({ x: l[0], y: Wd.ground.topAt(l[0]), kind: l[1], s: clamp(+l[2] || 1, .5, 1.5), t: 9, ph: Math.random() * TAU }));
      for (let k = 0; k < Wd.life.length && k < Wd.bare.length; k++) Wd.bare[k].filled = true;
      Wd.keystone = Math.max(0, o.keystone | 0); Wd.kid.done = !!o.kidDone; Wd.sci.done = !!o.sciDone;
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
