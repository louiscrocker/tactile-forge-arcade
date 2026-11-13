/* ============================================================
   save.js — save and resume a spider's life
   ============================================================
   The yard is always the same; what you made of it is saved:
   every thread you fixed (as its two ends), the spider, the
   clock (night, time of day), shed skins, the egg sac, where
   home is.  Saved every few seconds and when the tab hides.
   Anything malformed is ignored rather than trusted: a bad save
   falls back to a new egg sac.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'widow.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && Array.isArray(o.threads) && o.player && typeof o.player === 'object' ? o : null;
    } catch (e) { return null; }
  },

  snapshot(G) {
    const Y = G.yard, num = (v) => +(+v).toFixed(1);
    return {
      version: this.VERSION, when: Date.now(), seed: Y.seed, form: G.form,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation,
      threads: Y.own().map(t => [num(t.pts[0][0]), num(t.pts[0][1]), num(t.pts[1][0]), num(t.pts[1][1])]),
      player: G.player.serialize(),
      exuviae: Y.exuviae.map(e => [num(e.x), num(e.y), num(e.r)]),
      sac: Y.sac ? [num(Y.sac.x), num(Y.sac.y)] : null, people: Y.peopleSeen, caught: Y.caught,
      journal: typeof Journal !== 'undefined' ? Journal.serialize() : null
    };
  },
  write(G) {
    if (!G.started || !G.yard) return false;
    const json = JSON.stringify(this.snapshot(G));
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) { Journal.dropPhotos(); try { localStorage.setItem(this.KEY, json); return true; } catch (e2) { return false; } }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayer) {
    try {
      if (FORMS[o.form]) G.form = o.form;
      makeWorld(o.seed);
      const Y = G.yard;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .8, 0, .999); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      const ok = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(v => Number.isFinite(v));
      if (!Array.isArray(o.threads) || o.threads.length > 60 || !o.threads.every(t => ok(t, 4))) return false;
      /* a thread may hang from another: fix them in the order they were made */
      for (const t of o.threads) Y.net.addThread(t[0], t[1], t[2], t[3], { force: true });
      Y.exuviae = (o.exuviae || []).filter(e => ok(e, 3)).slice(-8).map(e => ({ x: e[0], y: e[1], r: clamp(e[2], 1, 14), ang: 0 }));
      Y.sac = ok(o.sac, 2) ? { x: o.sac[0], y: o.sac[1], t: 0 } : null;
      Y.peopleSeen = clamp(o.people | 0, 0, 9); Y.caught = Math.max(0, o.caught | 0);
      makePlayer(o.player);
      if (typeof Journal !== 'undefined') Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save: ' + (e && e.message)); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
