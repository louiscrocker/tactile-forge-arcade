/* ============================================================
   save.js — save and resume an adventure
   ============================================================
   The land regrows from its seed, so a save holds the seed, the
   clock, the star count, every player (with her look), what has
   been collected or lit, the quest state and where the friends
   are.  Saved every few seconds and whenever the tab hides.
   ============================================================ */
'use strict';

const SaveGame = {
  KEY: 'alicorn.save',
  VERSION: 1,

  exists() { try { const s = localStorage.getItem(this.KEY); if (!s) return null; const o = JSON.parse(s); return o.version === this.VERSION ? o : null; } catch (e) { return null; } },

  write(G) {
    if (!G.started) return false;
    const o = {
      version: this.VERSION, when: Date.now(),
      seed: G.world.seed, time: G.time, tod: G.tod, day: G.day, stars: G.stars,
      players: G.players.map(p => p.serialize()),
      world: G.world.serialize(),
      quests: Quests.serialize(),
      friends: G.friends.serialize(),
      journal: Journal.serialize(),
      foal: G.foal ? G.foal.serialize() : null, home: G.home ? G.home.serialize() : null, apples: G.apples || 0,
      games: typeof Games !== 'undefined' ? Games.serialize() : null, race: typeof Race !== 'undefined' ? Race.serialize() : null
    };
    try { localStorage.setItem(this.KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  },

  /* Rebuild everything from a save. Returns false if anything is off. */
  read(G, o, makeWorld, makePlayers) {
    try {
      makeWorld(o.seed);
      G.time = o.time || 0; G.tod = o.tod === undefined ? .36 : o.tod; G.day = o.day || 1; G.stars = o.stars || 0;
      G.world.restore(o.world);
      makePlayers(o.players || []);
      Quests.restore(o.quests);
      G.friends.restore(o.friends, G.players);
      Journal.restore(o.journal);
      G.apples = o.apples || 0;
      if (G.home) G.home.restore(o.home);
      if (G.foal) G.foal.restore(o.foal, G.players);
      if (typeof Games !== 'undefined') Games.restore(o.games);
      if (typeof Race !== 'undefined') Race.restore(o.race);
      return true;
    } catch (e) { console.warn('Could not restore save', e); return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* fine */ } }
};
