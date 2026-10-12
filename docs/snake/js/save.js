/* ============================================================
   save.js — save and resume a snake's life
   ============================================================
   The meadow regrows from the seed.  Saved on top: the snake, the
   snacks it has smelled, its shed skins, a coverboard left in the
   grass, the clock, the moon, the year, the season and the weather.
   Saved every few seconds and when the tab hides.  Anything
   malformed is ignored rather than trusted: a bad save falls back
   to a newborn in its bag.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'snake.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && Number.isFinite(o.seed) && o.player && typeof o.player === 'object' && Array.isArray(o.snacks) ? o : null;
    } catch (e) { return null; }
  },

  write(G) {
    if (!G.started || !G.world) return false;
    const Wd = G.world, num = (v) => +(+v).toFixed(1);
    const o = {
      version: this.VERSION, when: Date.now(), seed: Wd.seed, form: G.form, sex: G.sex,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation, moon: G.moon, year: G.year,
      season: Wd.season, weather: { state: Wd.weather.state, timer: Wd.weather.timer, snowCover: Wd.weather.snowCover },
      player: G.player.serialize(),
      snacks: Wd.snacks.map(s => [num(s.x), s.val, s.seen ? 1 : 0]),
      exuviae: Wd.exuviae.map(e => [num(e.x), num(e.y), num(e.len), +e.thick.toFixed(2), e.form, e.face, e.looked ? 1 : 0]),
      boards: Wd.serializeCovers(), boardDone: Wd.boardDone, denCrowd: Wd.denCrowd,
      journal: Journal.serialize()
    };
    const json = JSON.stringify(o);
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) { Journal.dropPhotos(); try { localStorage.setItem(this.KEY, json); return true; } catch (e2) { return false; } }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayer) {
    try {
      if (!Number.isFinite(o.seed) || !Array.isArray(o.snacks) || !o.player || typeof o.player !== 'object' || !['sac', 'snake'].includes(o.player.stage)) return false;
      if (FORMS[o.form]) G.form = o.form;
      G.sex = o.sex === 'girl' ? 'girl' : 'boy';
      makeWorld(o.seed);
      const Wd = G.world;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .4, 0, 1); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .5; G.year = Math.max(0, o.year | 0);
      Wd.season = SEASON_INFO[o.season] ? o.season : 'summer';
      const w = o.weather || {};
      Object.assign(Wd.weather, { state: ['sun', 'cloud', 'rain', 'snow'].includes(w.state) ? w.state : 'sun', timer: 20, snowCover: clamp(+w.snowCover || 0, 0, 1) });
      const ok = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(v => typeof v === 'string' || Number.isFinite(v));
      Wd.snacks = (o.snacks || []).filter(s => ok(s, 3)).slice(0, 40).map(s => ({ x: clamp(s[0], WORLD.walkL, WORLD.walkR), y: Wd.land.walkY(s[0]), val: clamp(s[1] | 0, 1, 8), seen: !!s[2], t: 1, glint: Math.random() * TAU }));
      Wd.exuviae = (o.exuviae || []).filter(e => ok(e, 5)).slice(0, 20).map(e => ({ x: e[0], y: e[1], len: clamp(e[2], 20, 200), thick: clamp(e[3], 1, 20), form: FORMS[e[4]] ? e[4] : 'eastern', face: e[5] === -1 ? -1 : 1, looked: !!e[6], seed: 1, t: 0 }));
      for (const x of (Array.isArray(o.boards) ? o.boards : []).filter(Number.isFinite).slice(0, 2)) { const c = Object.assign({ kind: 'coverboard', x, id: Wd.covers.length }, COVER_KINDS.coverboard); Wd.placeCover(c); Wd.covers.push(c); }
      Wd.boardDone = !!o.boardDone; Wd.denCrowd = clamp(o.denCrowd | 0, 0, 12);
      makePlayer(o.player);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
