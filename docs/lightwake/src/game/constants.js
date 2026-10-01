// =====================================================
// Tactile Forge — TRON · Constants
// World units: a grid of GRID_W cols × GRID_H rows.
// Each cycle moves cell-by-cell at TICKS_PER_SEC ticks per second.
// Trails (light walls) are recorded into a 2D occupancy array.
// World coordinates are CSS-style: +x right, +y down.
// =====================================================

export const GRID_W = 120;        // grid cells horizontal
export const GRID_H = 80;         // grid cells vertical

// Logical "world" units (1 unit per cell).
export const WORLD_W = GRID_W;
export const WORLD_H = GRID_H;

// ----- Cycle base movement -----
export const BASE_TICKS_PER_SEC = 14;   // cells per second at round 1
export const TICKS_PER_ROUND_BUMP = 0.6;

// ----- Boost (player-only) -----
export const BOOST = {
  max:        2.0,    // seconds of fuel
  refillRate: 0.30,   // fuel per second when not boosting
  burnRate:   1.0,    // fuel per second when boosting
  speedMult:  1.7,    // tick rate multiplier while active
};

// ----- Lives / round shaping -----
export const LIVES_START = 3;

/** Number of AI opponents present in a given round. */
export function foesForRound(round) {
  if (round <= 1) return 1;
  if (round <= 3) return 2;
  if (round <= 6) return 3;
  return 3;             // capped — earlier rounds are about speed/AI
}

// ----- Spawn placements (column, row, direction) -----
// Programs spawn near the four edges, facing inward.
// dir: 0=right, 1=down, 2=left, 3=up (rotation matches CSS quadrants)
export const SPAWN_SLOTS = [
  { id: 'player', col: 6,           row: GRID_H - 6,  dir: 0 },   // bottom-left, facing right
  { id: 'foe1',   col: GRID_W - 7,  row: 5,           dir: 2 },   // top-right, facing left
  { id: 'foe2',   col: 6,           row: 5,           dir: 1 },   // top-left, facing down
  { id: 'foe3',   col: GRID_W - 7,  row: GRID_H - 6,  dir: 3 },   // bottom-right, facing up
];

// ----- Difficulty tiers -----
// `aiDepth`  is the lookahead distance the AI uses to compare directions.
// `aiNoise`  is the probability per decision tick of picking a sub-optimal turn.
// `tickMult` scales speed on top of the per-round bump.
export const DIFFICULTY = {
  cadet:    { aiDepth: 6,  aiNoise: 0.35, tickMult: 0.85, livesBonus: +1, label: 'Conscript' },
  defender: { aiDepth: 12, aiNoise: 0.18, tickMult: 1.00, livesBonus:  0, label: 'Warrior'   },
  ace:      { aiDepth: 22, aiNoise: 0.06, tickMult: 1.18, livesBonus: -1, label: 'Champion'  },
};

// ----- Scoring -----
export const SCORE = {
  DEREZ:           300,    // per AI cycle taken out (multiplied by round)
  ROUND_CLEAR:     500,    // base round-win bonus
  ROUND_PER_FOE:   200,    // bonus per foe defeated this round
  SURVIVAL_PER_S:    5,    // tiny per-second drip
  LAST_STAND:     1000,    // bonus when you derez the LAST foe in a round
};

// ----- Rank thresholds -----
export const RANK = (score) => {
  if (score >= 60000) return 'LEGEND';
  if (score >= 32000) return 'CHAMPION';
  if (score >= 16000) return 'WARRIOR';
  if (score >=  8000) return 'RIDER';
  if (score >=  3000) return 'CONSCRIPT';
  if (score >=   800) return 'SPARK';
  return 'GLITCH';
};

// ----- Phosphor color → CSS color mapping (player cycle/walls) -----
export const PHOSPHOR = {
  green: { line: '#00d878', hot: '#d8ffe9' },
  amber: { line: '#ffb24a', hot: '#ffe9a8' },
  cyan:  { line: '#4ad8ff', hot: '#c8f2ff' },
};

// ----- AI cycle factions (fixed regardless of phosphor) -----
// Inspired by the cabinet's red/yellow opponents — three distinct factions.
export const FOE_COLORS = [
  { line: '#ffd84a', hot: '#fff5b8', name: 'VOLT'  },   // yellow (lieutenant)
  { line: '#ff5a64', hot: '#ffd4d8', name: 'RAZOR' },   // red    (champion)
  { line: '#c065ff', hot: '#ecd2ff', name: 'HEX'   },   // magenta(boss-tier)
];

// ----- Arena announcer lines -----
export const COMMS = {
  open: [
    'Riders ready. Engage.',
    'The arena is sealed. Ride.',
    'Riders at the gate. Go.',
    'Into the arena. Begin.',
  ],
  roundStart: [
    'Combatants in the arena.',
    'Bikes primed. Light walls hot.',
    'Watch your perimeter.',
  ],
  derez: [
    'Takedown confirmed.',
    'Bike down.',
    'One less rider.',
    'Clean cut.',
  ],
  death: [
    'You hit the wall.',
    'Wrecked.',
    'The wall took you.',
    'Ride over.',
  ],
  lastFoe: [
    'Final opponent. Box them.',
    'One left. Cut tight.',
    'Bring the wall down on them.',
  ],
  roundClear: [
    'Round secured. Power up.',
    'The arena is yours.',
    'You stand. Good — for now.',
  ],
  gameOver: [
    'Out of bikes.',
    'The arena keeps your bike.',
    'No more lives. Ride over.',
  ],
  boost: [
    'Boost.',
    'Surge!',
  ],
};
