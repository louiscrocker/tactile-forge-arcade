// =====================================================
// Tactile Forge — Missile Attack · Constants
// World units: 1000 wide × 700 tall, origin top-left, +y down (CSS convention).
// The skyline (ground) sits at y = GROUND_Y. Cities and batteries plant on it.
// =====================================================

export const WORLD_W   = 1000;
export const WORLD_H   = 700;
export const GROUND_Y  = 600;        // y-coordinate of the ground baseline
export const SKY_TOP   = 0;          // ICBMs spawn here

// ----- Battery placements (3 silos along the skyline) -----
export const BATTERIES = [
  { id: 0, label: 'α', x:  90 },
  { id: 1, label: 'β', x: 500 },
  { id: 2, label: 'γ', x: 910 },
];

// ----- City placements (6 cities, two clusters of 3 between the silos) -----
export const CITIES = [
  { id: 0, x: 195 },
  { id: 1, x: 290 },
  { id: 2, x: 385 },
  { id: 3, x: 615 },
  { id: 4, x: 710 },
  { id: 5, x: 805 },
];

// ----- Sizes -----
export const CITY = {
  w: 64, h: 36,        // bounding box
  spires: 4,           // building wireframe count
};
export const BATTERY = {
  w: 56, h: 36,
};

// ----- Counter-missile (player) -----
export const COUNTER = {
  speed:        420,    // world units per second (fast)
  trailFade:    0.6,    // alpha decay coefficient
};

// ----- Blast (your explosion) -----
export const BLAST = {
  growTime:   0.30,     // seconds expanding
  holdTime:   0.40,     // seconds at maxR
  fadeTime:   0.45,     // seconds shrinking
};

// ----- Spawn rate / wave shape -----
export function waveCount(wave)         { return 8 + Math.floor(wave * 2.2); }
export function waveDuration(wave)      { return Math.max(14, 32 - wave * 1.8); }
export function waveMult(wave)          { return Math.ceil(wave / 2); }

// ----- Difficulty tiers -----
export const DIFFICULTY = {
  cadet: {
    icbmSpeed:    52,    // pixels/sec downward (avg, varies +/- 12)
    icbmSpeedJit: 12,
    blastMaxR:    62,
    ammoPerBat:   12,
    mirvStartWave:5,
    mirvProb:     w => Math.min(0.45, 0.05 * (w - 4)),  // active w ≥ 5
    smartStartWave: 7,
    smartProb:    w => Math.min(0.25, 0.04 * (w - 6)),
  },
  defender: {
    icbmSpeed:    78,
    icbmSpeedJit: 16,
    blastMaxR:    52,
    ammoPerBat:   10,
    mirvStartWave:3,
    mirvProb:     w => Math.min(0.55, 0.07 * (w - 2)),
    smartStartWave: 5,
    smartProb:    w => Math.min(0.30, 0.05 * (w - 4)),
  },
  ace: {
    icbmSpeed:   110,
    icbmSpeedJit: 22,
    blastMaxR:    44,
    ammoPerBat:    8,
    mirvStartWave: 2,
    mirvProb:     w => Math.min(0.65, 0.10 * (w - 1)),
    smartStartWave: 4,
    smartProb:    w => Math.min(0.38, 0.07 * (w - 3)),
  },
};

// ----- MIRV: at this y, split into 3-4 children -----
export const MIRV = {
  splitYMin: 230,
  splitYMax: 360,
  splitMin:    3,
  splitMax:    4,
};

// ----- Scoring -----
export const SCORE = {
  ICBM_HIT:        25,    // multiplied by wave mult
  SMART_HIT:      125,    // ditto
  BOMBER_HIT:     200,    // bomber sprite
  SAT_HIT:        250,    // killer satellite
  CITY_END_BONUS: 100,    // per surviving city × wave
  AMMO_END_BONUS:   5,    // per remaining missile × wave
  BONUS_CITY_AT: 10000,   // award a bonus city every N points
};

// ----- Per-wave background tint cycle (subtle so phosphor stays readable) -----
export const WAVE_PALETTE = [
  { bg0: '#0a0303', bg1: '#160505' },   // red    (wave 1)
  { bg0: '#03050d', bg1: '#070b18' },   // blue   (wave 2)
  { bg0: '#020a06', bg1: '#021b0e' },   // green  (wave 3, "default")
  { bg0: '#0b0a02', bg1: '#161204' },   // yellow (wave 4)
  { bg0: '#0a0210', bg1: '#160520' },   // magenta(wave 5)
  { bg0: '#02080a', bg1: '#03161a' },   // cyan   (wave 6)
];

// ----- Killer satellites + bombers (waves ≥ 11) -----
export const KILLER = {
  satStartWave:    11,
  bomberStartWave: 11,
  satProb:    w => Math.min(0.35, 0.05 * (w - 10)),
  bomberProb: w => Math.min(0.40, 0.06 * (w - 10)),
  satY:    80,           // altitude
  bomberY: 180,
  satSpeed:    70,
  bomberSpeed: 95,
  satDropEvery:    2.5,  // seconds between drops
  bomberDropEvery: 1.6,
  bomberDropBurst: 3,    // ICBMs per pass
};

// ----- Rank thresholds -----
export const RANK = (score) => {
  if (score >= 50000) return 'GENERAL';
  if (score >= 28000) return 'COLONEL';
  if (score >= 14000) return 'COMMANDER';
  if (score >=  6000) return 'DEFENDER';
  if (score >=  2000) return 'WATCHMAN';
  if (score >=   500) return 'CADET';
  return 'TRAINEE';
};

// ----- Phosphor color → CSS color mapping for canvas drawing -----
// `mid` sits between line and hot (the title intro's sweep and second line);
// `glow` is the RGB of tokens.css's --c-line-glow for the same phosphor.
export const PHOSPHOR = {
  green: { line: '#00d878', hot: '#d8ffe9', mid: '#5cffaa', glow: '#3cffa0' },
  amber: { line: '#ffb24a', hot: '#ffe9a8', mid: '#ffd57a', glow: '#ffb24a' },
  cyan:  { line: '#4ad8ff', hot: '#c8f2ff', mid: '#8ae6ff', glow: '#4ad8ff' },
};

// ----- Threat-trail color (enemy missiles) -----
export const ENEMY_COLOR = {
  icbm:   { line: '#ff5a64', hot: '#ffd4d8' },
  mirv:   { line: '#ff7a3a', hot: '#ffe2c8' },
  smart:  { line: '#ff3a8a', hot: '#ffd1e6' },
  sat:    { line: '#c065ff', hot: '#ecd2ff' },
  bomber: { line: '#65d8ff', hot: '#d2ecff' },
};

// ----- NORAD chatter -----
export const COMMS = {
  open: [
    'Watchman, you have command.',
    'Boards are clear — heads up.',
    'Console hot, you are weapons free.',
    'NORAD sees nothing — yet.',
  ],
  inbound: [
    'Tracking inbound — multiple bogeys.',
    'Sirens up. Take the shot.',
    'Lead them, Watchman, lead them.',
    'Cluster munitions detected.',
  ],
  mirv: [
    'MIRV on the boards! Split warheads inbound.',
    'Multiple re-entry — fan out the blasts.',
    'Cluster spread, conserve ammo.',
  ],
  smart: [
    'Smart bomb. It will dodge — bracket it.',
    'Evader inbound, lead it twice.',
  ],
  cityLost: [
    'We lost one. Keep firing.',
    'Funeral bell, stay on console.',
    'City down. Don\'t look at the screen, look at the boards.',
  ],
  bonusCity: [
    'Refugees relocated. New city online.',
    'Grateful citizens send a sister city.',
    'Bonus city deployed — keep her safe.',
  ],
  satellite: [
    'Killer satellite in orbit. Track it.',
    'Sat overhead, dropping ordnance.',
  ],
  bomber: [
    'Bomber inbound, mid-altitude.',
    'Stratofortress on scope — bracket the run.',
  ],
  batteryLost: [
    'Silo offline! Shift to the other batteries.',
    'We are blind in that sector — pick up the slack.',
  ],
  lowAmmo: [
    'Caution: ammunition critical.',
    'Down to last rounds. Conserve.',
  ],
  waveClear: [
    'Skies clear. Reloading silos.',
    'Stand down — fresh waves on the way.',
    'Beautiful work. Reload.',
  ],
  gameOver: [
    'All cities lost. Console cold.',
    'Watchman, NORAD is offline.',
    'It is over. The coast burns.',
  ],
};
