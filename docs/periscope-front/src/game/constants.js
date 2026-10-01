// =====================================================
// Tactile Forge — Tank Battle · Constants
// World is a flat plain on the XZ ground plane (Y up).
// Player tank navigates from a first-person periscope view.
// Coordinates: +X right, +Z forward (into the screen, down-range).
// All units are in "metres" of the battlefield.
// =====================================================

// ----- World extents: tank wraps around at edges (toroidal) -----
export const WORLD_R = 320;       // half-extent on X and Z (world is 640m square)

// ----- Player tank dimensions (also enemy tanks) -----
export const TANK = {
  hullW:    3.6,
  hullL:    5.4,
  hullH:    1.4,
  turretR:  1.6,
  turretH:  0.9,
  barrelL:  3.6,
  barrelR:  0.18,
  treadW:   0.8,
};

// ----- Player tank kinematics -----
export const PLAYER = {
  driveSpeed:  18,        // m/s forward
  reverseSpeed: 9,
  turnRate:    1.4,       // rad/s hull rotation
  shellSpeed:  90,        // shell m/s
  shellLife:   2.4,       // seconds before fizzling
  fireCooldown: 0.55,     // seconds between shots
  hullMax:     100,
};

// ----- Camera / projection (first-person) -----
export const CAMERA = {
  fov:      Math.PI / 2.6,    // ~70°
  near:     0.6,
  far:      WORLD_R * 1.6,
  eyeY:     1.7,              // periscope eye height
  pitch:    -0.05,            // slight nose-down
  horizonY: 0.5,              // 0..1 fraction of viewport
};

// ----- Obstacles (decorative + cover) -----
// Procedurally placed each engagement; constants here just shape generation.
export const OBSTACLES = {
  pyramidCount: 7,
  cubeCount:    5,
  pyramidR:     5.2,
  cubeR:        4.0,
  minSpawnDist: 28,    // don't spawn within this radius of player
};

// ----- Enemies -----
export const ENEMY = {
  tank: {
    drive:    9.5,
    turn:     0.9,
    shellSpeed: 70,
    fireCooldown: 1.6,
    sightR:   140,
    fireR:    100,
    points:   1000,
    hullMax:  1,        // one shell kills
  },
  // Heavier "super tank" — appears later. Faster, sharper.
  super: {
    drive:    14,
    turn:     1.2,
    shellSpeed: 95,
    fireCooldown: 1.1,
    sightR:   200,
    fireR:    140,
    points:   3000,
    hullMax:  1,
  },
  // Saucer flies above terrain; doesn't shoot but worth points and rare.
  saucer: {
    drive:    20,
    points:   5000,
    altitude: 12,
    radius:   2.6,
    hullMax:  1,
  },
};

// ----- Spawning shape -----
export function waveCount(wave)         { return 3 + Math.floor(wave * 1.4); }
export function waveMult(wave)          { return Math.ceil(wave / 2); }

// ----- Difficulty tiers -----
// (cadet/defender/ace mirror sibling games — labels in UI map to Rookie/Gunner/Commander)
export const DIFFICULTY = {
  cadet: {
    enemySpeedMult:   0.85,
    enemyFireRate:    1.3,    // multiplier on cooldown (higher = slower)
    enemyAccuracy:    0.55,   // 0..1 — chance shell aims true vs jitter
    superStartWave:   5,
    superProb:        w => Math.min(0.40, 0.06 * (w - 4)),
    saucerStartWave:  3,
    saucerProb:       w => Math.min(0.25, 0.04 * (w - 2)),
    maxConcurrent:    2,
    startingTanks:    4,
  },
  defender: {
    enemySpeedMult:   1.0,
    enemyFireRate:    1.0,
    enemyAccuracy:    0.75,
    superStartWave:   3,
    superProb:        w => Math.min(0.55, 0.08 * (w - 2)),
    saucerStartWave:  2,
    saucerProb:       w => Math.min(0.35, 0.05 * (w - 1)),
    maxConcurrent:    3,
    startingTanks:    3,
  },
  ace: {
    enemySpeedMult:   1.18,
    enemyFireRate:    0.75,
    enemyAccuracy:    0.92,
    superStartWave:   2,
    superProb:        w => Math.min(0.70, 0.10 * (w - 1)),
    saucerStartWave:  2,
    saucerProb:       w => Math.min(0.45, 0.06 * w),
    maxConcurrent:    4,
    startingTanks:    2,
  },
};

// ----- Scoring -----
export const SCORE = {
  TANK_KILL:    1000,
  SUPER_KILL:   3000,
  SAUCER_KILL:  5000,
  WAVE_BONUS:   500,    // per wave cleared (× wave)
  EXTRA_TANK:  20000,   // every N points = bonus motor-pool tank
};

// ----- Rank thresholds -----
export const RANK = (score) => {
  if (score >= 100000) return 'GENERAL';
  if (score >=  50000) return 'COLONEL';
  if (score >=  25000) return 'COMMANDER';
  if (score >=  12000) return 'GUNNER';
  if (score >=   5000) return 'CORPORAL';
  if (score >=   1500) return 'PRIVATE';
  return 'RECRUIT';
};

// ----- Phosphor color → CSS color mapping for canvas drawing -----
export const PHOSPHOR = {
  green: { line: '#00d878', hot: '#d8ffe9' },
  amber: { line: '#ffb24a', hot: '#ffe9a8' },
  cyan:  { line: '#4ad8ff', hot: '#c8f2ff' },
};

// ----- Threat colors (radar + wireframe accents) -----
export const ENEMY_COLOR = {
  tank:   { line: '#ff5a64', hot: '#ffd4d8' },
  super:  { line: '#ff3a8a', hot: '#ffd1e6' },
  saucer: { line: '#c065ff', hot: '#ecd2ff' },
};

// ----- Comm chatter -----
export const COMMS = {
  open: [
    'Gunner, you have command.',
    'Periscope hot, weapons free.',
    'Battlefield is yours.',
    'CMD reads no contacts — yet.',
  ],
  inbound: [
    'Tracking armor — multiple bearings.',
    'Contacts on the radar. Light them up.',
    'Heads up, Gunner — they brought friends.',
  ],
  super: [
    'Super tank inbound. It will move.',
    'Heavy on the boards. Lead it.',
    'Heat signature on a heavy — bracket it.',
  ],
  saucer: [
    'Saucer overhead — no return fire, but worth the trophy.',
    'Anomalous contact, high altitude. Five thousand if you tag it.',
  ],
  hit: [
    'We took one. Hull integrity dropping.',
    'Stay sharp, we just took a hit.',
    'Patch that hull, Gunner!',
  ],
  tankLost: [
    'Tank down. Spinning up the next.',
    'We lost her. New driver in the pool.',
    'That one\'s scrap. Roll out the spare.',
  ],
  bonusTank: [
    'Motor pool sends a fresh tank — earn it.',
    'Bonus armor delivered. Don\'t waste it.',
  ],
  waveClear: [
    'Sector clear. Reloading.',
    'Stand down — fresh waves on the way.',
    'Beautiful work. Reload.',
  ],
  gameOver: [
    'All tanks down. CMD signing off.',
    'Motor pool is empty, Gunner.',
    'Engagement lost. Stand down.',
  ],
};
