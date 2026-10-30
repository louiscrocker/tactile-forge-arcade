/* ============================================================
   levels.js — the street, its levels, the unlockables
   ============================================================
   World units: one CELL is 40 units, +x right, +y DOWN.  Every
   level is ROWS cells tall; the street (the ground) is at
   y = ROWS * CELL.  Row ROWS-1 is the lowest row of blocks.

   SMASH levels: an old, EMPTY building drawn as ASCII art, top
   row first.  Legend:
     B brick   K crumbly brick   S stone   X steel girder
     G boarded-up window   L the old bell (clangs)
     N a pigeon nesting in a window   C a cat napping in a window
   (the animals hop out when Mungo knocks; nobody else is inside,
   ever: the building is empty before the crew arrives).

   MEND levels: a lived-in house with scaffolding.  Storey s (0 is
   the ground floor) stands on the platform at row ROWS - 3s; the
   top platform (s = storeys) is the roof walk.  Ladders are
   drainpipes Pip climbs.  Things to fix, by column c (0 = the
   house's left edge) and storey s:
     window · shutter (on a window) · pipe (on a ladder column)
     shingle (roof, no s) · gutter (roof edge, no s)
   ============================================================ */
'use strict';

const CELL = 40, ROWS = 18, GROUND_Y = ROWS * CELL;
const UI_FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';

/* materials of the old buildings: hit points by difficulty */
const MAT = {
  B: { key: 'brick', hp: [1, 1, 1], color: '#c4643e' },
  K: { key: 'crumbly', hp: [1, 1, 1], color: '#b88a5a' },
  S: { key: 'stone', hp: [1, 2, 2], color: '#a9a294' },
  X: { key: 'steel', hp: [1, 2, 3], color: '#6f8796' },
  G: { key: 'window', hp: [1, 1, 1], color: '#5a4a3a' },
  L: { key: 'bell', hp: [1, 2, 2], color: '#d8a640' },
  N: { key: 'nest', hp: [1, 1, 1], color: '#5a4a3a', critter: 'pigeon' },
  C: { key: 'catnap', hp: [1, 1, 1], color: '#5a4a3a', critter: 'cat' }
};
const MAT_CODES = Object.keys(MAT);           // index + 1 is the grid code
const matCode = (ch) => MAT_CODES.indexOf(ch) + 1;
const matOf = (code) => MAT[MAT_CODES[code - 1]];

const DIFF = {
  easy:   { i: 0, name: 'Easy',   kid: 'Little helper', timer: false, failOnTime: false, hazard: .5,  fall: .6, dizzy: .7, fixTaps: 1, rebreak: 0,   markers: true,  gust: .4, ballPump: .5, chunkBonk: false },
  normal: { i: 1, name: 'Normal', kid: 'Big helper',    timer: true,  failOnTime: false, hazard: 1,   fall: 1,  dizzy: 1.1, fixTaps: 2, rebreak: .25, markers: true,  gust: .8, ballPump: 1,  chunkBonk: true },
  hard:   { i: 2, name: 'Hard',   kid: 'Super crew',    timer: true,  failOnTime: true,  hazard: 1.55, fall: 1.25, dizzy: 1.4, fixTaps: 3, rebreak: .5, markers: false, gust: 1.2, ballPump: 1.4, chunkBonk: true }
};
const DIFF_KEYS = Object.keys(DIFF);

/* the time-of-day palettes the painter uses */
const SKIES = {
  morning: { top: '#7cc4f0', mid: '#bfe4f5', low: '#ffe9c4', sun: '#fff1b0', hill: ['#8fc27a', '#79b066', '#5f9a52'], light: 1 },
  noon:    { top: '#4aa2e8', mid: '#9fd2f5', low: '#e2f4ff', sun: '#fffbe0', hill: ['#86c06e', '#6eaa5a', '#56924a'], light: 1 },
  sunset:  { top: '#4a5ab0', mid: '#e88a7a', low: '#ffd08a', sun: '#ffd27a', hill: ['#8a7a8a', '#6a6a7a', '#4a5a5a'], light: .92 },
  storm:   { top: '#141c34', mid: '#2a3656', low: '#46506e', sun: '#c8d4f0', hill: ['#2a3a44', '#22323a', '#1a2830'], light: .55, night: true }
};

const LEVELS = [
  {
    id: 'shed', kind: 'smash', name: 'The Wobbly Shed', street: 'Bramble Lane', tod: 'morning', cols: 36, bx: 15,
    plan: [
      'KBBBBK',
      'BGBBGB',
      'BBBBBB',
      'BKBBKB',
      'BBBBBB'
    ],
    par: 40, tidy: 14,
    say: 'Smash the old shed! Punch the bricks. Start at the top to keep it tidy.',
    sayLong: 'This old shed is empty and wobbly. The town wants a new one. Punch the bricks with X, climb by pushing into a wall and pressing up. Smashing from the top down keeps the dust off the neighbours.'
  },
  {
    id: 'cottage', kind: 'mend', name: 'Granny Oak\'s Cottage', street: 'Bramble Lane', tod: 'morning', cols: 26, hx: 9, hw: 8, storeys: 2,
    color: '#f2d7a6', trim: '#7a9a5a', roofColor: '#a8553a', ladders: [0, 7],
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'window', c: 5, s: 1 }, { t: 'shingle', c: 3 }, { t: 'pipe', c: 7, s: 1 }],
    folk: [{ c: 5, s: 0, who: 'granny' }, { c: 2, s: 1, who: 'cat' }],
    hazards: { rate: .18, kinds: ['acorn'], from: ['tree'] },
    par: 45,
    say: 'Fix Granny Oak\'s house! Climb the drainpipes and fix the sparkly broken things.',
    sayLong: 'Granny Oak lives here and her house needs some love. Climb the drainpipes with up and down, walk to a broken thing and press X to fix it. Hold down to lift your bucket and catch falling acorns.'
  },
  {
    id: 'mill', kind: 'smash', name: 'The Crumbly Mill', street: 'Bramble Lane', tod: 'noon', cols: 40, bx: 16,
    plan: [
      '..SSSS..',
      '.BBBBBB.',
      'BBGBBNBB',
      'BBBBBBBB',
      'BGBBBBGB',
      'BBBKKBBB',
      'BBBBBBBB',
      'BGBBBBGB',
      'SSSSSSSS'
    ],
    par: 70, tidy: 22,
    say: 'A pigeon is napping in the mill! Knock on its window first, then smash.',
    sayLong: 'The old mill is empty, except for one sleepy pigeon. Knock on its window and it will fly off to a new home. Then smash the mill to the ground.'
  },
  {
    id: 'number9', kind: 'mend', name: 'Number 9, Puddle Row', street: 'Puddle Row', tod: 'noon', cols: 28, hx: 9, hw: 10, storeys: 3,
    color: '#a8cfe8', trim: '#ffffff', roofColor: '#4a5a7a', ladders: [0, 5, 9],
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'shutter', c: 7, s: 0 }, { t: 'window', c: 3, s: 1 }, { t: 'pipe', c: 9, s: 1 }, { t: 'window', c: 7, s: 2 }, { t: 'shingle', c: 2 }, { t: 'gutter', c: 8 }],
    folk: [{ c: 7, s: 1, who: 'dad' }, { c: 2, s: 2, who: 'baby' }, { c: 3, s: 0, who: 'dog' }],
    hazards: { rate: .32, kinds: ['twig', 'feather'], from: ['pigeon'] },
    par: 70,
    say: 'Pigeons are dropping twigs! Catch them in your bucket, and fix the house.',
    sayLong: 'The Puddle Row pigeons are building nests, and they keep dropping twigs. Hold down to catch them in your bucket. Fix every broken window, pipe and shingle.'
  },
  {
    id: 'ball', kind: 'smash', name: 'The Runaway Wrecking Ball', street: 'Crane Corner', tod: 'sunset', cols: 46, bx: 16, boss: 'ball', lotPad: 7,
    plan: [
      'SSBBBBBBSS',
      'BGBBGGBBGB',
      'BBBBBBBBBB',
      'BGBBNBBBGB',
      'BBBBBBBBBB',
      'BKBBGGBBKB',
      'BBBBBBBBBB',
      'BGBBBBBBGB',
      'BBBBBBBBBB',
      'SSSSSSSSSS'
    ],
    par: 95, tidy: 34,
    say: 'Uh oh! The wrecking ball came loose! Punch it back at the building!',
    sayLong: 'The crane\'s brake has slipped and its wrecking ball is swinging all by itself. When it swings at you, punch it! It flies back and smashes the building. Do not let it bump the neighbour\'s fence too often.'
  },
  {
    id: 'storm', kind: 'mend', name: 'Storm Night', street: 'Crane Corner', tod: 'storm', cols: 30, hx: 10, hw: 10, storeys: 3, boss: 'storm',
    color: '#e8b8a0', trim: '#5a3a2a', roofColor: '#3a4a5a', ladders: [0, 4, 9],
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'window', c: 7, s: 0 }, { t: 'shutter', c: 2, s: 1 }, { t: 'pipe', c: 4, s: 1 }, { t: 'window', c: 7, s: 1 }, { t: 'window', c: 2, s: 2 }, { t: 'pipe', c: 9, s: 2 }, { t: 'shingle', c: 3 }, { t: 'shingle', c: 6 }, { t: 'gutter', c: 1 }],
    folk: [{ c: 7, s: 2, who: 'kid' }, { c: 7, s: 0, who: 'granny' }, { c: 2, s: 1, who: 'cat' }],
    hazards: { rate: .5, kinds: ['pot', 'twig', 'leafball', 'bucket'], from: ['storm'] },
    par: 100,
    say: 'A storm! Hold on tight in the wind, catch what falls, and keep the house cosy.',
    sayLong: 'It is a wild, windy night. Gusts push you about, and the wind knocks things off windowsills. Catch them in your bucket and fix the house before the storm blows over. Everyone inside is warm and safe.'
  },
  {
    id: 'tower', kind: 'smash', name: 'The Old Clock Tower', street: 'Market Square', tod: 'noon', cols: 36, bx: 15,
    plan: [
      '..LL..',
      '.XXXX.',
      'XXXXXX',
      'SGSSGS',
      'SSSSSS',
      'SSCSSS',
      'SSSSSS',
      'BGBBGB',
      'BBBBBB',
      'BBKKBB',
      'BGBBGB',
      'BBBBBB',
      'BBBBBB',
      'SSSSSS'
    ],
    par: 100, tidy: 26,
    say: 'The old clock tower is very tall! Climb to the top and ring the bell.',
    sayLong: 'The market\'s new clock is ready, so the old tower comes down. It is tall: climb up the side and work from the top. A cat is napping halfway up. Knock first!'
  },
  {
    id: 'flats', kind: 'mend', name: 'The Flats on Kettle Street', street: 'Kettle Street', tod: 'noon', cols: 32, hx: 10, hw: 11, storeys: 4,
    color: '#d8c8e8', trim: '#5a4a7a', roofColor: '#7a3a3a', ladders: [0, 5, 10], crane: true,
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'window', c: 8, s: 0 }, { t: 'shutter', c: 3, s: 1 }, { t: 'pipe', c: 5, s: 1 }, { t: 'window', c: 8, s: 1 }, { t: 'window', c: 2, s: 2 }, { t: 'pipe', c: 10, s: 2 }, { t: 'window', c: 8, s: 3 }, { t: 'shutter', c: 3, s: 3 }, { t: 'shingle', c: 4 }, { t: 'gutter', c: 9 }],
    folk: [{ c: 8, s: 2, who: 'dad' }, { c: 2, s: 3, who: 'kid' }, { c: 3, s: 0, who: 'granny' }, { c: 8, s: 1, who: 'dog' }],
    hazards: { rate: .42, kinds: ['paint', 'bolt', 'sandbag'], from: ['crane'] },
    par: 110,
    say: 'The cheeky crane next door keeps dropping things. Watch the hook!',
    sayLong: 'Next door they are building something new, and the crane is a bit clumsy. It drops paint pots and bolts. Watch where the hook is, catch what falls, and fix all the flats.'
  },
  {
    id: 'factory', kind: 'smash', name: 'The Big Old Factory', street: 'Kettle Street', tod: 'sunset', cols: 50, bx: 18,
    plan: [
      '..XX..........',
      '..SS..........',
      '..SS..........',
      '..SS......XX..',
      'XXXXXXXXXXXXXX',
      'BGBBGBNBBGBBGB',
      'BBBBBBBBBBBBBB',
      'BKBBXXBBXXBBKB',
      'BGBBBBBBBBCBGB',
      'BBBBGBBBBGBBBB',
      'BBBBBBBBBBBBBB',
      'SSSSSSSSSSSSSS'
    ],
    par: 130, tidy: 40,
    say: 'The biggest job yet! A pigeon and a cat are inside. Knock, then smash!',
    sayLong: 'The old factory is huge and its steel beams are tough: hit them more than once, or jump and press down to stomp. A pigeon and a cat are napping in two windows. Knock on their windows first.'
  },
  {
    id: 'bigblow', kind: 'mend', name: 'The Big Blow', street: 'Market Square', tod: 'storm', cols: 34, hx: 11, hw: 12, storeys: 4, boss: 'storm', crane: true,
    color: '#f0e0a0', trim: '#3a6a8a', roofColor: '#3a3a4a', ladders: [0, 4, 8, 11],
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'window', c: 6, s: 0 }, { t: 'window', c: 10, s: 0 }, { t: 'pipe', c: 4, s: 1 }, { t: 'shutter', c: 6, s: 1 }, { t: 'window', c: 10, s: 1 }, { t: 'window', c: 2, s: 2 }, { t: 'pipe', c: 8, s: 2 }, { t: 'window', c: 10, s: 3 }, { t: 'shutter', c: 6, s: 3 }, { t: 'shingle', c: 3 }, { t: 'shingle', c: 8 }, { t: 'gutter', c: 1 }],
    folk: [{ c: 2, s: 3, who: 'granny' }, { c: 10, s: 2, who: 'baby' }, { c: 6, s: 2, who: 'kid' }, { c: 2, s: 1, who: 'dad' }, { c: 6, s: 0, who: 'dog' }],
    hazards: { rate: .55, kinds: ['pot', 'paint', 'twig', 'leafball', 'bucket'], from: ['storm', 'crane', 'pigeon'] },
    par: 140,
    say: 'The Big Blow! The biggest storm of all. Fix everything and keep the whole house cosy!',
    sayLong: 'The biggest storm of the year has come to Market Square. The wind is wild, the crane is swinging and the pigeons are all in a flap. Fix every broken thing on the big house. You can do it!'
  }
];

/* couch co-op: Mungo smashes the old building next door, Pip keeps the house beside it safe */
const COOP_LEVELS = [
  {
    id: 'sidebyside', kind: 'coop', name: 'Side by Side', street: 'Bramble Lane', tod: 'morning', cols: 44, bx: 8,
    plan: [
      'KBBBBBK',
      'BGBBBGB',
      'BBBBBBB',
      'BGBNBGB',
      'BBBBBBB',
      'BKBBBKB',
      'SSSSSSS'
    ],
    hx: 25, hw: 9, storeys: 2, color: '#f6c8c8', trim: '#5a7a9a', roofColor: '#5a6a3a', ladders: [0, 4, 8],
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'window', c: 6, s: 1 }, { t: 'shingle', c: 5 }],
    folk: [{ c: 6, s: 0, who: 'dad' }, { c: 2, s: 1, who: 'baby' }],
    hazards: { rate: .08, kinds: ['acorn'], from: ['tree'] },
    par: 90, tidy: 999,
    say: 'Team job! Mungo smashes the old building. Pip keeps the house next door fixed.',
    sayLong: 'Two players! Mungo smashes the empty building on the left, and every bit of rubble that flies can crack a window next door. Pip climbs the house on the right and fixes it. Finish both jobs together!'
  },
  {
    id: 'bigteam', kind: 'coop', name: 'The Big Team Job', street: 'Kettle Street', tod: 'sunset', cols: 52, bx: 8,
    plan: [
      '...SSSS...',
      'BBBBBBBBBB',
      'BGBBGBBGBB',
      'BBBBBBBBBB',
      'BGBXXXXBGB',
      'BBBBCBBBBB',
      'BKBBBBBBKB',
      'BGBBGBBGBB',
      'SSSSSSSSSS'
    ],
    hx: 30, hw: 11, storeys: 3, color: '#c8e8c0', trim: '#6a4a2a', roofColor: '#8a3a2a', ladders: [0, 5, 10],
    fixes: [{ t: 'window', c: 2, s: 0 }, { t: 'shutter', c: 8, s: 0 }, { t: 'window', c: 2, s: 1 }, { t: 'pipe', c: 5, s: 1 }, { t: 'window', c: 8, s: 2 }, { t: 'shingle', c: 3 }],
    folk: [{ c: 8, s: 1, who: 'granny' }, { c: 2, s: 2, who: 'kid' }, { c: 2, s: 0, who: 'cat' }],
    hazards: { rate: .12, kinds: ['twig'], from: ['pigeon'] },
    par: 140, tidy: 999,
    say: 'The big team job! Smash the old works and keep the house safe together.',
    sayLong: 'A big old works building comes down beside a big family house. Mungo smashes, Pip mends. Talk to each other: smashing carefully from the top keeps the house safer!'
  }
];

const ALL_LEVELS = LEVELS.concat(COOP_LEVELS);
const levelById = (id) => ALL_LEVELS.find(l => l.id === id) || null;

/* ---------- unlockables ---------- */
const HATS = {
  mungo: [
    { key: 'hardhat', name: 'Hard hat', stars: 0 },
    { key: 'bobble', name: 'Bobble hat', stars: 3 },
    { key: 'flowers', name: 'Flower crown', stars: 7 },
    { key: 'cowboy', name: 'Big cowboy hat', stars: 12 },
    { key: 'party', name: 'Party hat', stars: 17 },
    { key: 'viking', name: 'Horned helmet', stars: 23 }
  ],
  pip: [
    { key: 'beanie', name: 'Pompom beanie', stars: 0 },
    { key: 'cap', name: 'Backwards cap', stars: 2 },
    { key: 'bow', name: 'Big bow', stars: 5 },
    { key: 'propeller', name: 'Propeller hat', stars: 10 },
    { key: 'helmet', name: 'Bike helmet', stars: 15 },
    { key: 'paper', name: 'Paper crown', stars: 20 }
  ]
};
const BUCKETS = [
  { key: 'blue', name: 'Blue bucket', color: '#3a8ad8', stars: 0 },
  { key: 'red', name: 'Red bucket', color: '#d84a3a', stars: 4 },
  { key: 'spotty', name: 'Spotty bucket', color: '#f0c040', stars: 9 },
  { key: 'rainbow', name: 'Rainbow bucket', color: '#a050d0', stars: 14 }
];
/* what goes up where an old building came down (chosen on the results card) */
const STYLES = [
  { key: 'bakery', name: 'Bakery', level: null },
  { key: 'playground', name: 'Playground', level: null },
  { key: 'library', name: 'Library', level: 'mill' },
  { key: 'garden', name: 'Flower garden', level: 'mill' },
  { key: 'pool', name: 'Paddling pool', level: 'ball' },
  { key: 'firestation', name: 'Fire station', level: 'tower' },
  { key: 'cinema', name: 'Cinema', level: 'factory' },
  { key: 'school', name: 'School', level: 'factory' }
];

/* the town map: where each stop sits along the street (in map units) */
const MAP_X = { shed: 0, cottage: 1, mill: 2, number9: 3, ball: 4, storm: 5, tower: 6, flats: 7, factory: 8, bigblow: 9 };

