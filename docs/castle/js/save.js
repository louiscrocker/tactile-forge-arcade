/* ============================================================
   save.js — three castles, saved and resumed
   ============================================================
   Three save slots (keys `castle.save.1` … `.3`) plus the slot
   in play, which autosaves every few seconds and when the tab
   hides.  A save holds the grid (run-length), the furniture, the
   rooms' names, the treasury, the quests, the clock and the
   calendar, the weather and the royal.  Anything malformed is
   refused rather than trusted: a bad save starts a new castle.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'castle.save.',
  SLOTS: 3,
  VERSION: 1,
  slot: 1,

  keyFor(slot) { return this.KEY + (slot || this.slot); },
  /* the saved object for a slot, or null */
  exists(slot) {
    try {
      const s = localStorage.getItem(this.keyFor(slot)); if (!s) return null;
      const o = JSON.parse(s);
      return o && o.version === this.VERSION && o.castle && typeof o.castle === 'object' && typeof o.castle.grid === 'string' ? o : null;
    } catch (e) { return null; }
  },
  /* a short description for the title screen's slot buttons */
  describe(slot) {
    const o = this.exists(slot); if (!o) return null;
    const S = o.summary || {};
    return { name: o.castleName || 'A castle', sex: o.sex, look: o.look, day: o.day || 1, stones: S.stones || 0, rooms: S.rooms || 0, when: o.when || 0, thumb: o.thumb || null };
  },

  write(G, slot) {
    if (!G.started || !G.castle) return false;
    const C = G.castle, Wd = G.world;
    let thumb = null;
    try { if (G.thumbnail) thumb = G.thumbnail(); } catch (e) { thumb = null; }
    const o = {
      version: this.VERSION, when: Date.now(), seed: Wd.seed, sex: G.sex, look: G.look, castleName: G.castleName, blueprint: G.blueprint,
      time: G.time, tod: G.tod, day: G.day, moon: G.moon,
      castle: C.serialize(), world: Wd.serialize(), summary: { stones: C.stats.stones, rooms: C.rooms().filter(r => !r.tiny).length },
      journal: Journal.serialize(), thumb
    };
    const json = JSON.stringify(o);
    try { localStorage.setItem(this.keyFor(slot), json); return true; }
    catch (e) { delete o.thumb; Journal.dropPhotos(); try { localStorage.setItem(this.keyFor(slot), JSON.stringify(o)); return true; } catch (e2) { return false; } }
  },

  /* rebuild the game from a save; returns false if anything is off */
  read(G, o, makeWorld) {
    try {
      G.sex = ROYALS[o.sex] ? o.sex : 'princess';
      G.look = royalLook(G.sex, o.look).key;
      G.castleName = typeof o.castleName === 'string' ? o.castleName.slice(0, 40) : 'My Castle';
      G.blueprint = BLUEPRINTS[o.blueprint] ? o.blueprint : 'plot';
      makeWorld(Number.isFinite(o.seed) ? o.seed : 1);
      if (!G.castle.restore(o.castle)) return false;
      G.time = +o.time || 0; G.tod = clamp(+o.tod || .35, 0, 1); G.day = Math.max(1, o.day | 0); G.moon = Number.isFinite(o.moon) ? ((o.moon % 1) + 1) % 1 : .5;
      G.world.restore(o.world);
      Journal.restore(o.journal);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear(slot) { try { localStorage.removeItem(this.keyFor(slot)); } catch (e) { /* fine */ } }
};
