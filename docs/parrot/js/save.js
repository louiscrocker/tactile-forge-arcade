/* ============================================================
   save.js — save and resume a parrot's life
   ============================================================
   The forest is always the same (who lives in which hollow comes
   from the seed); what is saved is you: how old, where, your name,
   what you have learned, the clock.  Saved every few seconds and
   when the tab hides.  Anything malformed is ignored rather than
   trusted: a bad save falls back to a new egg.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'parrot.save',
  VERSION: 1,

  exists() {
    try {
      const s = localStorage.getItem(this.KEY); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && o.player && typeof o.player === 'object' ? o : null;
    } catch (e) { return null; }
  },

  snapshot(G) {
    const F = G.forest;
    return {
      version: this.VERSION, when: Date.now(), seed: F.seed, form: G.form,
      time: G.time, tod: G.tod, day: G.day, generation: G.generation,
      player: G.player.serialize(), people: F.peopleSeen,
      journal: typeof Journal !== 'undefined' ? Journal.serialize() : null
    };
  },
  write(G) {
    if (!G.started || !G.forest) return false;
    const json = JSON.stringify(this.snapshot(G));
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) { Journal.dropPhotos(); try { localStorage.setItem(this.KEY, json); return true; } catch (e2) { return false; } }
  },

  /* Rebuild the world from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayer) {
    try {
      if (!o || typeof o !== 'object' || !Number.isFinite(o.seed)) return false;
      if (FORMS[o.form]) G.form = o.form;
      makeWorld(o.seed);
      const F = G.forest;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .4, 0, .999); G.day = Math.max(1, o.day | 0); G.generation = Math.max(1, o.generation | 0);
      F.peopleSeen = clamp(o.people | 0, 0, 9);
      makePlayer(o.player);
      if (typeof Journal !== 'undefined') Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save: ' + (e && e.message)); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
