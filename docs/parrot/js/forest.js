/* ============================================================
   forest.js — the rainforest, and everything a parrot can sit on
   ============================================================
   World: +x right, +y DOWN, the forest floor at y = 0.  Lowland
   rainforest by a river in the Amazon of south-east Peru, left to
   right: the old ironwood with your hollow · a small tree (the
   first branch you ever fly to) · the fig tree · the palms and a
   dead palm · the great kapok (the roost) · the river · the clay
   cliff (the clay lick) · two more big trees, one with a nest box.

   A parrot sits on a Line: a branch, a ledge of the cliff, the
   forest floor.  It flies through the open air between them:
   leaves and trunks are scenery, never walls.  HOLLOWS are holes
   in trunks with a perch by the door.  FOODS are figs, palm nuts
   and clay.  The birds and visitors are in flock.js.
   ============================================================ */
'use strict';

const WORLD = {
  left: -1900, right: 2060, top: -1150, bottom: 150,
  riverX0: 380, riverX1: 760,
  eggX: -1500, eggY: -528, nestX0: -1528, nestX1: -1474, nestY: -522, doorX: -1456, doorY: -548
};

class Line {
  constructor(pts, kind, o) {
    this.pts = pts; this.kind = kind; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
    if (o) Object.assign(this, o);
  }
  seg(s) { const c = this.cum; let i = 0; while (i < c.length - 2 && c[i + 1] < s) i++; return i; }
  at(s) {
    s = clamp(s, 0, this.len);
    const i = this.seg(s), a = this.pts[i], b = this.pts[i + 1], L = (this.cum[i + 1] - this.cum[i]) || 1, u = (s - this.cum[i]) / L;
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, tx: (b[0] - a[0]) / L, ty: (b[1] - a[1]) / L, i };
  }
  nearest(x, y) {
    let best = null;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), px = a[0] + dx * u, py = a[1] + dy * u, d = Math.hypot(x - px, y - py);
      if (!best || d < best.d) best = { d, s: this.cum[i] + Math.sqrt(L2) * u, x: px, y: py };
    }
    return best;
  }
}

/* the trees.  h: height of the trunk · w: its width at the bottom · crown: [x, y, r] of the leaves (a place to hide) */
const TREES = [
  { key: 'home', name: 'the old ironwood', kind: 'iron', x: -1500, h: 820, w: 96, crown: [-1500, -880, 250] },
  { key: 'step', name: 'the little tree', kind: 'tree', x: -1180, h: 520, w: 38, crown: [-1180, -560, 150] },
  { key: 'fig', name: 'the fig tree', kind: 'fig', x: -900, h: 500, w: 64, crown: [-900, -560, 215] },
  { key: 'palm', name: 'the palms', kind: 'palm', x: -470, h: 430, w: 24 },
  { key: 'palm2', name: 'the palms', kind: 'palm', x: -380, h: 380, w: 22 },
  { key: 'dead', name: 'the dead palm', kind: 'dead', x: -250, h: 400, w: 34 },
  { key: 'kapok', name: 'the kapok tree', kind: 'kapok', x: 60, h: 900, w: 120, crown: [60, -960, 310] },
  { key: 'east', name: 'the tall tree', kind: 'tree', x: 1580, h: 640, w: 76, crown: [1580, -700, 215] },
  { key: 'box', name: 'the tree with the box', kind: 'tree', x: 1850, h: 600, w: 58, crown: [1850, -650, 190] }
];

/* branches: [key, tree, from, to] */
const BRANCHES = [
  ['doorstep', 'home', [-1456, -548], [-1336, -570]],
  ['homehigh', 'home', [-1548, -690], [-1700, -722]],
  ['first', 'step', [-1300, -468], [-1140, -492]],
  ['steplow', 'step', [-1170, -380], [-1060, -396]],
  ['figa', 'fig', [-1050, -438], [-905, -470]],
  ['figb', 'fig', [-895, -520], [-750, -498]],
  ['figc', 'fig', [-880, -400], [-770, -382]],
  ['palma', 'palm', [-520, -436], [-420, -436]],
  ['palmb', 'palm2', [-420, -386], [-330, -386]],
  ['deadtop', 'dead', [-280, -404], [-222, -404]],
  ['roost', 'kapok', [-230, -802], [0, -846]],
  ['kapokr', 'kapok', [120, -770], [340, -738]],
  ['kapokdoor', 'kapok', [122, -592], [215, -604]],
  ['easta', 'east', [1430, -486], [1542, -500]],
  ['eastb', 'east', [1620, -600], [1770, -622]],
  ['boxa', 'box', [1722, -452], [1822, -464]],
  ['boxb', 'box', [1880, -540], [2000, -556]]
];

/* the lie of the land: [x, y] from left to right.  The river is flat water; the clay cliff climbs in three ledges. */
const TERRAIN = [[-1900, 0], [380, 0], [760, 0], [776, -112], [930, -112], [946, -202], [1090, -202], [1106, -292], [1240, -292], [1252, -340], [1300, -340], [1420, 0], [2060, 0]];
const FLATS = [['floorw', 0, 1], ['ledge1', 3, 4], ['ledge2', 5, 6], ['ledge3', 7, 8], ['clifftop', 9, 10], ['floore', 11, 12]];
function groundY(x) {
  const T = TERRAIN; if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) { const a = T[i - 1], b = T[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) || 1); }
  return T[T.length - 1][1];
}
const overWater = (x) => x > WORLD.riverX0 && x < WORLD.riverX1;

/* holes in trees.  who lives there is settled per world (Forest), except your parents' hollow */
const HOLLOW_DEFS = [
  { key: 'home', tree: 'home', door: [-1456, -548], perch: 'doorstep', s: 6, inside: [-1500, -522] },
  { key: 'kapok', tree: 'kapok', door: [122, -606], perch: 'kapokdoor', s: 6, inside: [84, -590] },
  { key: 'east', tree: 'east', door: [1542, -514], perch: 'easta', s: 106, inside: [1576, -496] },
  { key: 'dead', tree: 'dead', door: [-250, -392], perch: 'deadtop', s: 29, inside: [-250, -372] },
  { key: 'box', tree: 'box', door: [1822, -480], perch: 'boxa', s: 95, inside: [1840, -474] }
];

/* food: [kind, branch, how far along (0..1)] */
const FOOD_DEFS = [
  ['fig', 'figa', .2], ['fig', 'figa', .5], ['fig', 'figa', .8], ['fig', 'figb', .25], ['fig', 'figb', .55], ['fig', 'figb', .85], ['fig', 'figc', .3], ['fig', 'figc', .7],
  ['nut', 'palma', .3], ['nut', 'palma', .75], ['nut', 'palmb', .3], ['nut', 'palmb', .75],
  ['clay', 'ledge2', .25], ['clay', 'ledge2', .55], ['clay', 'ledge2', .85], ['clay', 'ledge3', .12], ['clay', 'ledge3', .88], ['clay', 'ledge1', .5]
];
/* where the family waits for each lesson: [branch, how far along] */
const STATIONS = { first: ['first', .55], fig: ['figb', .12], clay: ['ledge3', .5], nut: ['palma', .52], lost: ['figc', .5], roost: ['roost', .6], hide: ['kapokr', .4], mate: ['ledge2', .7] };

class Forest {
  constructor(G, seed) {
    this.G = G; this.seed = seed; this.rng = mulberry32((seed >>> 0) + 77); this.t = 0;
    this.bounds = { left: WORLD.left, right: WORLD.right, top: WORLD.top, bottom: WORLD.bottom };
    this.weather = { rain: 0, cloud: 0, gust: 0, fog: 0 };
    this.trees = TREES; this.lines = []; this.byKey = {};
    for (const [key, tree, a, b] of BRANCHES) this.addLine(new Line([a, b], 'branch', { key, tree }));
    for (const [key, i, j] of FLATS) this.addLine(new Line([TERRAIN[i], TERRAIN[j]], 'ground', { key }));
    /* who lives where: the kapok has toucans, the tall tree another pair; bees took either the dead palm or the box */
    const beesInBox = this.rng() < .5;
    const who = { home: 'home', kapok: 'toucan', east: 'pair', dead: beesInBox ? 'free' : 'bees', box: beesInBox ? 'bees' : 'free' };
    this.hollows = HOLLOW_DEFS.map(h => Object.assign({}, h, { who: who[h.key], line: this.byKey[h.perch], seen: false, pop: 0 }));
    this.foods = FOOD_DEFS.map(([kind, key, u]) => { const L = this.byKey[key], q = L.at(L.len * u); return { kind, line: L, s: L.len * u, x: q.x, y: q.y, n: 1, back: 0, bite: 0 }; });
    this.initFlock();
  }
  addLine(L) { L.id = this.lines.length; this.lines.push(L); this.byKey[L.key] = L; return L; }
  line(key) { return this.byKey[key]; }
  tree(key) { return this.trees.find(t => t.key === key); }
  hollow(key) { return this.hollows.find(h => h.key === key); }
  station(k) { const [key, u] = STATIONS[k], L = this.byKey[key], q = L.at(L.len * u); return { line: L, s: L.len * u, x: q.x, y: q.y }; }
  /* the nearest place to sit */
  locate(x, y, max = 1e9) {
    let best = null;
    for (const L of this.lines) { const q = L.nearest(x, y); if (q.d < max && (!best || q.d < best.d)) { best = q; best.line = L; } }
    return best;
  }
  /* in the leaves of a tree: a hawk can not see you there */
  inLeaves(x, y) { for (const t of this.trees) if (t.crown && Math.hypot(x - t.crown[0], y - t.crown[1]) < t.crown[2] * .82) return t; return null; }
  nearestCrown(x, y) { let b = null, bd = 1e9; for (const t of this.trees) if (t.crown) { const d = Math.hypot(x - t.crown[0], y - t.crown[1]); if (d < bd) { bd = d; b = t; } } return b; }
  /* food within reach of a sitting bird */
  foodNear(x, y, kind, r = 30) { let b = null, bd = r; for (const f of this.foods) if (f.n > 0 && (!kind || f.kind === kind)) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; b = f; } } return b; }
  nextFood(kind, x, y) { let b = null, bd = 1e9; for (const f of this.foods) if (f.n > 0 && f.kind === kind) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; b = f; } } return b; }
  take(f) { f.n = 0; f.back = f.kind === 'clay' ? 6 : 14; f.bite = 1; }
  updateFoods(dt) { for (const f of this.foods) { f.bite = Math.max(0, f.bite - dt * 2); if (f.n <= 0) { f.back -= dt; if (f.back <= 0) f.n = 1; } } for (const h of this.hollows) h.pop = Math.max(0, h.pop - dt * .5); }

  update(dt) {
    this.t += dt;
    this.weather.gust = .3 + .3 * Math.sin(this.t * .23) + .2 * Math.sin(this.t * .71);
    this.weather.fog += ((this.fogWanted ? 1 : 0) - this.weather.fog) * Math.min(1, dt * .8);
    this.updateFoods(dt); this.updateFlock(dt); this.updateVisitor(dt); this.updatePeople(dt);
  }
}
