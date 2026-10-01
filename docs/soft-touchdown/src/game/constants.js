// =====================================================
// Tactile Forge — Lunar Lander · Constants
// World units are meters. y is positive upward.
// =====================================================

// World extent. The visible window is one world-width wide; the lander
// wraps horizontally at the edges (Atari-style).
export const WORLD_W = 600;     // meters (matches one viewport width)

// Vertical span the camera shows, from ground reference y=0 to the top edge.
export const VIEW_H  = 720;     // meters of sky visible on screen

// Ceiling the lander is clamped to. Must stay below VIEW_H, otherwise the
// player can thrust the lander off the top of the screen and fly blind.
export const WORLD_H = VIEW_H - 24;

// Lander spawn
export const SPAWN = {
  x: 220,
  y: 620,
  vx: 18,        // initial drift to the right
  vy: 0,
  angle: 0,
};

// Physics constants
export const THRUST_ACCEL = 4.5;     // m/s² at full throttle
export const ROT_RATE     = 1.8;     // rad/s
export const FUEL_BURN    = 25;      // fuel units per second at full throttle

export const LANDER = {
  bodyW:    18,         // hull width  (m)
  bodyH:    14,         // hull height (m)
  legSpan:  26,         // outermost leg-foot width (m)
  legDrop:   8,         // leg foot drop below hull base (m)
  bellDrop:  4,         // engine bell drop below hull base (m)
};

// Difficulty tiers
export const DIFFICULTY = {
  cadet: {
    gravity:   1.4,
    fuelInit:  1500,
    vMax:      18,        // m/s — max safe descent rate
    hMax:      12,        // m/s — max safe lateral
    tiltMax:   0.30,      // rad — max safe tilt from vertical
    padScale:  1.20,      // pad widths multiplier
    terrainAmp: 0.85,     // mountain amplitude multiplier
  },
  pilot: {
    gravity:   1.8,
    fuelInit:  1000,
    vMax:      15,
    hMax:      8,
    tiltMax:   0.21,
    padScale:  1.0,
    terrainAmp: 1.0,
  },
  ace: {
    gravity:   2.4,
    fuelInit:   750,
    vMax:      12,
    hMax:      6,
    tiltMax:   0.16,
    padScale:  0.78,
    terrainAmp: 1.18,
  },
};

// Scoring
export const SCORE = {
  LAND_BASE:    50,    // multiplied by pad multiplier
  FUEL_BONUS:    1,    // per remaining fuel unit, awarded per landing
  STREAK_BONUS: 100,   // per consecutive landing in current sortie
};

// Rank thresholds
export const RANK = (score) => {
  if (score >= 14000) return 'MOON CAPTAIN';
  if (score >=  8000) return 'STAR PILOT';
  if (score >=  4000) return 'COMMANDER';
  if (score >=  1500) return 'PILOT';
  if (score >=   500) return 'CADET';
  return 'TRAINEE';
};

// Phosphor color → CSS color mapping for canvas drawing
// `bg0`/`bg1` are the top and bottom of the canvas backdrop gradient, so the
// screen behind the vectors matches the selected tube as well.
export const PHOSPHOR = {
  green: { line: '#00d878', hot: '#d8ffe9', bg0: '#000a06', bg1: '#001209' },
  amber: { line: '#ffb24a', hot: '#ffe9a8', bg0: '#0a0600', bg1: '#120c02' },
  cyan:  { line: '#4ad8ff', hot: '#c8f2ff', bg0: '#00070a', bg1: '#000f12' },
};

// CapCom chatter pool
export const COMMS = {
  approach: [
    'Eagle, you are GO for descent.',
    'Watch your altitude, Houston standing by.',
    'Slow her down, plenty of time.',
    'Find a flat spot, copy?',
  ],
  hover: [
    'Throttle up, you\'re sinking too fast.',
    'Easy on the rotation, Eagle.',
    'You\'re right above a bonus pad.',
    'Steady — looking good.',
  ],
  lowFuel: [
    'Caution: 30 seconds.',
    'Fuel critical, Eagle.',
    'Set her down — we\'re running out.',
  ],
  landed: [
    'The Eagle has landed!',
    'Tranquility Base, copy.',
    'Beautiful, just beautiful.',
    'Good show, Eagle.',
  ],
  crash: [
    'Eagle, Eagle — do you read?',
    'We\'ve lost telemetry.',
    'Mission control standing by…',
  ],
};
