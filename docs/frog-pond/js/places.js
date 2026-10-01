/* ============================================================
   places.js — the home pond, the stream, and the other ponds
   ============================================================
   Every place is the same kind of cross-section with its own
   size, depth, water colour, plants and frogs.  The home pond has
   a culvert in its right bank that leads into a stream with a
   real current; the stream runs out into the marsh.  On rainy
   nights a frog can also walk overland off either end of the
   bank to the next pond, as real frogs do.

     home ─culvert─ stream ─→ marsh
       └── overland (rainy night) ── marsh ── bog ── garden ── home
   ============================================================ */
'use strict';

const PLACES = {
  home: {
    key: 'home', name: 'Home pond', simple: 'Home pond', salt: 0,
    W: 1500, depth: 560, pads: 1, reeds: 1, weeds: 46, rocks: 26, current: 0,
    water: ['#6fb8c8', '#0f3f44'], soil: ['#7a5a34', '#5e4326', '#2e2114'],
    culvert: 1, chorus: null, log: 'log',
    blurb: 'Your pond. Lily pads, a log, a culvert pipe in the right bank.'
  },
  stream: {
    key: 'stream', name: 'The stream', simple: 'The stream', salt: 0x51,
    W: 2200, depth: 210, pads: 0, reeds: .6, weeds: 22, rocks: 60, current: 110,
    water: ['#9ad0cc', '#2f5f58'], soil: ['#8a7050', '#6a5236', '#3a2a18'],
    culvert: -1, chorus: ['green', 'leopard'], log: 'log',
    blurb: 'Moving water! The current pushes you downstream. Hide behind rocks where it is slow.'
  },
  marsh: {
    key: 'marsh', name: 'The marsh', simple: 'The marsh', salt: 0x6a,
    W: 1800, depth: 260, pads: .6, reeds: 2.4, weeds: 60, rocks: 10, current: 0,
    water: ['#8cb89a', '#28463a'], soil: ['#6a5a36', '#4e4226', '#2a2414'],
    culvert: 0, chorus: ['leopard', 'green', 'treefrog', 'peeper'], log: 'log', blackbird: true,
    blurb: 'Wide and shallow, full of cattails. Red-winged blackbirds sing from the stalks.'
  },
  bog: {
    key: 'bog', name: 'The bog', simple: 'The bog', salt: 0x7b,
    W: 1200, depth: 380, pads: .35, reeds: .7, weeds: 20, rocks: 6, current: 0,
    water: ['#b0864a', '#3a2410'], soil: ['#5a4a34', '#3e3222', '#1e1810'],
    culvert: 0, chorus: ['peeper', 'woodfrog', 'woodfrog', 'green'], log: 'log', moss: true, pitcher: true,
    blurb: 'Tea-brown water, floating moss and meat-eating pitcher plants. Peepers love it here.'
  },
  garden: {
    key: 'garden', name: 'The garden pond', simple: 'Garden pond', salt: 0x8c,
    W: 900, depth: 300, pads: 1.5, reeds: .35, weeds: 18, rocks: 14, current: 0,
    water: ['#7ac2dc', '#184a6a'], soil: ['#7a6a50', '#5a4a36', '#2a2218'],
    culvert: 0, chorus: ['green', 'toad', 'toad'], log: 'stone', stone: true, fountain: true, goldfish: true,
    blurb: 'A pond someone built, with a stone edge, a fountain and goldfish. Toads come to sing.'
  }
};
const OVERLAND = ['home', 'marsh', 'bog', 'garden'];

const Places = {
  /* neighbours of a place in each direction: { kind, how } or null */
  exit(place, side) {
    if (place === 'home' && side === 1) return null;              // the culvert handles the right side in the water; overland below
    if (place === 'stream') return side === -1 ? { kind: 'home', how: 'culvert', enter: 1 } : { kind: 'marsh', how: 'stream', enter: -1 };
    const i = OVERLAND.indexOf(place);
    const j = (i + side + OVERLAND.length) % OVERLAND.length;
    return { kind: OVERLAND[j], how: 'overland', enter: -side };
  },
  overland(place, side) {
    if (place === 'stream') return null;
    const i = OVERLAND.indexOf(place);
    const j = (i + side + OVERLAND.length) % OVERLAND.length;
    return { kind: OVERLAND[j], how: 'overland', enter: -side };
  },

  /* build every living thing for a place.  baseSeed is the player's pond seed. */
  build(G, baseSeed, place = 'home') {
    G.place = place;
    G.pond = new Pond(G, baseSeed, place);
    if (typeof Keeper !== 'undefined') Keeper.replay(G, G.pond);
    G.particles = new Particles();
    G.algae = new Algae(G.pond);
    G.wrigglers = new Wrigglers(G.pond);
    G.bugs = new Bugs(G.pond);
    G.nymphs = new Nymphs(G.pond, G);
    G.minnows = new Minnows(G.pond);
    G.snails = new Snails(G.pond);
    G.heron = new Heron(G);
    G.chorus = new Chorus(G);
    G.neighbours = new Neighbours(G);
    G.hazards = new Hazards(G);
    const prevDone = G.events ? G.events.done : null;
    G.events = new PondEvents(G); if (prevDone) G.events.done = prevDone;
    if (!G.eggStore) G.eggStore = {};
    G.eggMasses = G.eggStore[place] || (G.eggStore[place] = []);
  },

  /* move the players to another place.  how: culvert | stream | overland */
  travel(G, kind, enter, how, after) {
    const old = G.pond, wx = old.weather;
    const keep = { dayOfYear: old.dayOfYear, year: old.year, weather: { state: wx.state, timer: wx.timer, rain: wx.rain, cloud: wx.cloud, snow: wx.snow, ice: wx.ice, dry: wx.dry, rainbow: wx.rainbow } };
    const players = G.players;
    const lastMass = G.lastMass;
    Places.build(G, old.baseSeed, kind);
    const g = G.pond;
    g.dayOfYear = keep.dayOfYear; g.year = keep.year; g.updateSeason(); g.seasonChanged = false;
    Object.assign(g.weather, keep.weather);
    g.level = g.weather.dry * 46; g.updateWet();
    for (let i = 0; i < 30; i++) g.update(1 / 30, G.tod, G.night);
    G.lastMass = lastMass;
    players.forEach((p, i) => {
      p.goal = null; p.travelCd = 5; p.vx = p.vy = 0; p.tongue.active = false; p.target = null; p.perch = null; p.cling = null;
      if (how === 'overland') {
        p.x = enter * (g.W + 470 + i * 40); p.dir = -enter;
        p.mode = 'perch'; p.perch = { kind: 'land', y: g.bedY(p.x) }; p.y = g.bedY(p.x);
      } else {
        p.x = enter * (g.wetW() - 90 - i * 30); p.y = Math.min(60, g.bedY(p.x) - 20); p.dir = -enter; p.ang = enter > 0 ? Math.PI : 0;
        if (p.isFrogLike()) p.mode = 'water';
      }
    });
    Bus.emit('travel', kind, how);
    if (after) after();
  }
};
