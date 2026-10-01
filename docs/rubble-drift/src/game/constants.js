// =====================================================
// Tactile Forge — Asteroids · Constants
// World units: 1000 wide × 750 tall, origin top-left, +y down (CSS convention).
// The play field wraps on all four edges (toroidal topology, like the cabinet).
// =====================================================

export const WORLD_W = 1000;
export const WORLD_H = 750;

// ----- Ship -----
export const SHIP = {
  radius:      14,           // collision radius (world units)
  drawScale:   1.0,
  thrust:     260,            // world units/sec² when thrusting
  rotRate:    Math.PI * 1.6,  // rad/sec
  friction:   0.40,           // velocity exponential decay per second (~simulated drag)
  maxSpeed:   480,            // hard cap
  fireCooldown: 0.18,         // seconds between shots
  bulletSpeed: 560,           // world units/sec
  bulletTTL:   0.78,          // seconds before bullet expires
  bulletMax:   4,             // simultaneous player bullets (cabinet was 4)
  respawnDelay: 1.6,          // delay between death and respawn
  invulnTime:   2.4,          // seconds of post-respawn invulnerability
  hyperspaceCooldown: 0.6,    // shortest interval between hyperspace jumps
  hyperspaceMishap:  0.18,    // chance the jump kills you (cabinet had ~1/16 ≈ 0.06; we soften)
  startLives:  3,
};

// ----- Asteroid sizes (large=2, medium=1, small=0) -----
export const ASTEROID = {
  // radii by tier (large/medium/small)
  radii:  [16, 28, 50],
  // base draw line widths
  lineWidth: [1.8, 2.2, 2.6],
  // base speed by tier — smalls move faster than larges
  baseSpeed: [70, 50, 30],
  // jitter added to base
  speedJit:  [40, 30, 22],
  // angular tumble rate range
  tumble:    [0.6, 0.45, 0.3],
  // points awarded by tier (small/medium/large)
  points:    [100, 50, 20],
  // 4 vertex jaggedness templates (per the cabinet's 4 rock shapes)
  shapesPerSize: 4,
  // number of vertices on the polygon
  verts:    12,
};

// ----- Saucer (UFO) -----
export const SAUCER = {
  large: {
    radius:    18,
    speed:     90,
    fireEvery: 1.4,
    bulletSpeed: 380,
    bulletTTL:   1.4,
    aimJitter: 0.45,    // radians of random aim error (sloppy big saucer)
    points:    200,
  },
  small: {
    radius:    14,
    speed:    120,
    fireEvery: 1.0,
    bulletSpeed: 420,
    bulletTTL:   1.4,
    aimJitter: 0.06,    // tight aim
    points:    1000,
  },
  // Wave to start spawning small saucers (mostly large early)
  smallStartWave: 4,
  smallProb: (wave) => Math.min(0.85, 0.10 * (wave - 3)),
  // Spawn timing — first saucer per wave delayed, subsequent shorter
  firstSpawnDelay:  [10, 18],   // [min, max] seconds after wave start (random)
  respawnDelay:     [11, 22],   // between saucers within a wave
  // Direction-change cadence — saucer zigzags
  zigzagEvery:      [1.4, 2.6],
};

// ----- Wave shape -----
export const WAVE = {
  startRocks:   4,           // wave 1 starts with 4 large
  perWaveStep:  2,           // each wave adds 2 more rocks (cap at maxRocks)
  maxRocks:    11,           // cabinet capped here
  betweenDelay: 2.2,         // seconds between wave clear and next spawn
};

// ----- Scoring -----
export const SCORE = {
  EXTRA_LIFE_AT: 10000,      // bonus ship every N points
};

// ----- Difficulty tiers (scale several knobs) -----
export const DIFFICULTY = {
  cadet: {
    rockSpeedMult: 0.80,
    saucerSpeedMult: 0.85,
    saucerFireMult: 0.75,
    smallStartWave: 5,
    saucerSmallProbMult: 0.7,
    bulletTTLMult: 1.05,
    fireCooldownMult: 0.92,
  },
  pilot: {
    rockSpeedMult: 1.00,
    saucerSpeedMult: 1.00,
    saucerFireMult: 1.00,
    smallStartWave: 4,
    saucerSmallProbMult: 1.0,
    bulletTTLMult: 1.0,
    fireCooldownMult: 1.0,
  },
  ace: {
    rockSpeedMult: 1.25,
    saucerSpeedMult: 1.20,
    saucerFireMult: 1.30,
    smallStartWave: 3,
    saucerSmallProbMult: 1.4,
    bulletTTLMult: 0.9,
    fireCooldownMult: 1.1,
  },
};

// ----- Beat (the iconic alternating low/high pulse that quickens with the wave) -----
export const BEAT = {
  startInterval: 1.05,   // seconds between beats at start of wave
  minInterval:   0.30,   // floor
  decayPerWave:  0.05,   // each wave subtracts this from the start interval
  // Within a wave the interval also shortens as rocks are cleared:
  emptyShrink:   0.25,
};

// ----- Rank thresholds -----
export const RANK = (score) => {
  if (score >= 60000) return 'ADMIRAL';
  if (score >= 30000) return 'COMMANDER';
  if (score >= 15000) return 'PILOT';
  if (score >=  6000) return 'AVIATOR';
  if (score >=  2000) return 'CADET';
  if (score >=   500) return 'TRAINEE';
  return 'GREENHORN';
};

// ----- Phosphor color → CSS color mapping for canvas drawing -----
export const PHOSPHOR = {
  green: { line: '#00d878', hot: '#d8ffe9' },
  amber: { line: '#ffb24a', hot: '#ffe9a8' },
  cyan:  { line: '#4ad8ff', hot: '#c8f2ff' },
};

// ----- Saucer trail color (slightly pink for visibility against any phosphor) -----
export const SAUCER_COLOR = {
  large: { line: '#ff6a8a', hot: '#ffd4dc' },
  small: { line: '#ff3a8a', hot: '#ffd1e6' },
  bullet: { line: '#ffe04a', hot: '#fff7c8' },
};

// ----- Per-wave background tint cycle -----
export const WAVE_PALETTE = [
  { bg0: '#000604', bg1: '#001209' },
  { bg0: '#000a0a', bg1: '#001a16' },
  { bg0: '#04060d', bg1: '#080d18' },
  { bg0: '#080308', bg1: '#120410' },
  { bg0: '#0a0602', bg1: '#160c04' },
  { bg0: '#020a06', bg1: '#021b0e' },
];

// ----- Flight-deck chatter -----
export const COMMS = {
  // '{pilot}' is replaced with the current call sign when the line is queued.
  open: [
    '{pilot}, you have the helm.',
    'Throttle up — keep it steady.',
    'Belt is hot. Pick your shots.',
    'Long-range scope is yours.',
  ],
  saucer: [
    'Saucer on scope.',
    'Bogey inbound — eyes up.',
    'Bandit at the edge of the belt.',
  ],
  saucerSmall: [
    'Pinpoint saucer — it shoots straight.',
    'Small bandit. Don\'t fly straight lines.',
  ],
  hyperspace: [
    'Hyperspace engaged.',
    'Translating — back in a flash.',
  ],
  death: [
    'Hull breach. Reform on the next.',
    'Ship lost. Steady on.',
    'We have you. Ship gone.',
  ],
  extraShip: [
    'Reserve ship online.',
    'Bonus hull deployed.',
  ],
  waveClear: [
    'Belt clear. Rocks reforming.',
    'Sector quiet. Stand by for next field.',
    'Beautiful flying. Hold position.',
  ],
  wave: [
    'New field — eyes wide.',
    'Belt thicker than the last.',
    'More rocks. Don\'t bunch them.',
  ],
  gameOver: [
    'No reserves left. Patrol ends.',
    'You flew it down to dust.',
    'All ships lost. We\'ll remember.',
  ],
};
