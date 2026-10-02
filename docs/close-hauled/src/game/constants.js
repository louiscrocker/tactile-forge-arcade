// =====================================================
// Tactile Forge — Constants (wind, sail, classes, courses, events)
// =====================================================

export const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const WIND_ANGLES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
export const WIND_STRENGTHS = ['calm', 'light', 'moderate', 'fresh', 'strong', 'gale'];
export const WIND_SPEED_MULTIPLIERS = { calm: 0.3, light: 0.6, moderate: 1.0, fresh: 1.3, strong: 1.5, gale: 0.7 };

export const POINTS_OF_SAIL = {
  'In Irons':     { minAngle: 0,   maxAngle: 30,  modifier: -2, color: '#cc3333', tone: 'bad'  },
  'Close Hauled': { minAngle: 30,  maxAngle: 60,  modifier: 0,  color: '#e67e22', tone: 'ok'   },
  'Close Reach':  { minAngle: 60,  maxAngle: 80,  modifier: 1,  color: '#f1c40f', tone: 'ok'   },
  'Beam Reach':   { minAngle: 80,  maxAngle: 110, modifier: 2,  color: '#2ecc71', tone: 'best' },
  'Broad Reach':  { minAngle: 110, maxAngle: 150, modifier: 3,  color: '#27ae60', tone: 'best' },
  'Running':      { minAngle: 150, maxAngle: 181, modifier: 2,  color: '#3498db', tone: 'best' }
};

export const YACHT_COLORS = [
  { name: 'Crimson',    hex: '#e74c3c', deep: '#7d1d12' },
  { name: 'Royal Blue', hex: '#3498db', deep: '#1c4f73' },
  { name: 'Emerald',    hex: '#2ecc71', deep: '#176638' },
  { name: 'Gold',       hex: '#f1c40f', deep: '#7a6202' },
  { name: 'Pearl',      hex: '#ecf0f1', deep: '#7e8587' },
  { name: 'Slate',      hex: '#7f8c8d', deep: '#374647' },
  { name: 'Violet',     hex: '#9b59b6', deep: '#4d2762' },
  { name: 'Teal',       hex: '#1abc9c', deep: '#0a5d4d' },
  { name: 'Tangerine',  hex: '#e67e22', deep: '#7a3f08' },
  { name: 'Onyx',       hex: '#2c2c54', deep: '#0f0f29' },
  { name: 'Coral',      hex: '#fab1a0', deep: '#8a4d40' },
  { name: 'Sky',        hex: '#85c1e9', deep: '#3e617a' },
  { name: 'Burgundy',   hex: '#8e44ad', deep: '#48205c' },
  { name: 'Steel',      hex: '#b2bec3', deep: '#52595c' }
];

export const DEFAULT_NAMES = ['Endeavour', 'Britannia', 'Columbia', 'Intrepid', 'Gretel', 'Sovereign'];

export const YACHT_CLASSES = {
  allrounder: { key: 'allrounder', name: 'All-Rounder', short: 'AR',
    description: 'Balanced in every condition.',
    speedModifier: 0, stormModifier: 0, tacking: 1.0, staminaCost: 1.0, handicap: 0, hullScale: 1.0 },
  racer: { key: 'racer', name: 'Racer', short: 'RA',
    description: 'Fast but fragile in heavy weather.',
    speedModifier: 1, stormModifier: -1, tacking: 1.2, staminaCost: 1.2, handicap: 0, hullScale: 0.9 },
  cruiser: { key: 'cruiser', name: 'Cruiser', short: 'CR',
    description: 'Steady; thrives in storms.',
    speedModifier: -1, stormModifier: 1, tacking: 0.8, staminaCost: 0.8, handicap: 1, hullScale: 1.15 }
};

export const COURSES = {
  coastal: {
    key: 'coastal', name: 'Coastal Classic',
    marks: [
      { x: 0.5,  y: 0.12, type: 'start', label: 'Start/Finish', side: 'port' },
      { x: 0.82, y: 0.28, type: 'red',   label: 'Mark 1', side: 'port' },
      { x: 0.88, y: 0.65, type: 'green', label: 'Mark 2', side: 'starboard' },
      { x: 0.55, y: 0.85, type: 'red',   label: 'Mark 3', side: 'port' },
      { x: 0.18, y: 0.72, type: 'green', label: 'Mark 4', side: 'starboard' },
      { x: 0.12, y: 0.35, type: 'red',   label: 'Mark 5', side: 'port' }
    ],
    islands: [
      { x: 0.35, y: 0.5,  rx: 0.06, ry: 0.08, rotation: 20 },
      { x: 0.68, y: 0.48, rx: 0.04, ry: 0.05, rotation: -15 }
    ],
    shallows: [
      { x: 0.42, y: 0.38, r: 0.06 },
      { x: 0.75, y: 0.55, r: 0.04 }
    ],
    currentField: [
      { x: 0.5, y: 0.5, dx: 0.003,  dy: -0.001, strength: 1.0 },
      { x: 0.2, y: 0.6, dx: -0.002, dy: 0.002,  strength: 0.7 }
    ],
    lighthouses: [{ x: 0.35, y: 0.44 }],
    startAngle: 90
  },
  island: {
    key: 'island', name: 'Island Circuit',
    marks: [
      { x: 0.5,  y: 0.1,  type: 'start', label: 'Start/Finish', side: 'port' },
      { x: 0.85, y: 0.3,  type: 'red',   label: 'Mark 1', side: 'port' },
      { x: 0.78, y: 0.7,  type: 'green', label: 'Mark 2', side: 'starboard' },
      { x: 0.5,  y: 0.88, type: 'red',   label: 'Mark 3', side: 'port' },
      { x: 0.22, y: 0.7,  type: 'green', label: 'Mark 4', side: 'starboard' },
      { x: 0.15, y: 0.3,  type: 'red',   label: 'Mark 5', side: 'port' }
    ],
    islands: [
      { x: 0.5, y: 0.5,   rx: 0.12, ry: 0.14, rotation: 0 },
      { x: 0.3, y: 0.25,  rx: 0.03, ry: 0.04, rotation: 30 },
      { x: 0.72, y: 0.82, rx: 0.03, ry: 0.025, rotation: -20 }
    ],
    shallows: [
      { x: 0.5, y: 0.35, r: 0.05 },
      { x: 0.5, y: 0.65, r: 0.05 }
    ],
    currentField: [{ x: 0.5, y: 0.5, dx: 0.002, dy: 0.002, strength: 0.8 }],
    lighthouses: [{ x: 0.5, y: 0.42 }],
    startAngle: 90
  },
  regatta: {
    key: 'regatta', name: 'Open Regatta',
    marks: [
      { x: 0.5,  y: 0.88, type: 'start', label: 'Start/Finish', side: 'port' },
      { x: 0.5,  y: 0.15, type: 'red',   label: 'Windward', side: 'port' },
      { x: 0.82, y: 0.55, type: 'green', label: 'Wing',     side: 'starboard' },
      { x: 0.18, y: 0.55, type: 'red',   label: 'Leeward',  side: 'port' }
    ],
    islands: [],
    shallows: [{ x: 0.65, y: 0.35, r: 0.04 }],
    currentField: [{ x: 0.5, y: 0.5, dx: 0, dy: -0.003, strength: 0.6 }],
    lighthouses: [],
    startAngle: 0
  }
};

export const EVENT_CARDS = [
  { id: 'favorable_current', title: 'Favorable Current!', text: 'A strong current pushes you along — ride it!',
    icon: '🌊', effect: '+3 spaces', type: 'positive',
    apply: (p) => { p.bonusMove = 3; } },
  { id: 'wind_shift_cw', title: 'Wind Shift!', text: 'The wind veers clockwise. Trim your sails!',
    icon: '💨', effect: 'Wind +45°', type: 'neutral',
    apply: (_p, g) => g.shiftWind(1) },
  { id: 'wind_shift_ccw', title: 'Wind Backs!', text: 'The wind backs counter-clockwise.',
    icon: '💨', effect: 'Wind -45°', type: 'neutral',
    apply: (_p, g) => g.shiftWind(-1) },
  { id: 'broken_halyard', title: 'Broken Halyard!', text: 'A halyard snaps — crew scrambles to repair.',
    icon: '🔧', effect: 'Lose next turn', type: 'negative',
    apply: (p) => { p.skipNextTurn = true; } },
  { id: 'crew_overboard', title: 'Crew Overboard!', text: 'A crew member is in the water — all stop!',
    icon: '🏊', effect: '−2 spaces', type: 'negative',
    apply: (p) => { p.bonusMove = -2; } },
  { id: 'spinnaker', title: 'Spinnaker Run!', text: 'The crew hoists the spinnaker — maximum downwind speed!',
    icon: '⛵', effect: 'Double movement', type: 'positive',
    apply: (p) => { p.doubleMove = true; } },
  { id: 'calm_pocket', title: 'Calm Pocket', text: 'You\'ve drifted into windless water. Sails go limp.',
    icon: '😶‍🌫️', effect: 'Half movement', type: 'negative',
    apply: (p) => { p.halfMove = true; } },
  { id: 'dolphins', title: 'Dolphins!', text: 'A pod escorts you through the best channel!',
    icon: '🐬', effect: '+4 spaces', type: 'positive',
    apply: (p) => { p.bonusMove = 4; } },
  { id: 'fog_bank', title: 'Fog Bank!', text: 'Thick fog rolls in. Navigation becomes treacherous.',
    icon: '🌫️', effect: 'Half move next turn', type: 'negative',
    apply: (p, g) => { p.foggedNextTurn = true; g.weatherState = 'fog'; g.weatherTimer = 3; } },
  { id: 'tide_change', title: 'Tide Change!', text: 'The tide turns — every boat shifts.',
    icon: '🌙', effect: 'All boats drift', type: 'neutral',
    apply: (_p, g) => g.tideShift() },
  { id: 'gust', title: 'Strong Gust!', text: 'A powerful gust fills your sails — hold tight!',
    icon: '🌬️', effect: '+5 spaces', type: 'positive',
    apply: (p) => { p.bonusMove = 5; } },
  { id: 'seaweed', title: 'Seaweed Tangle!', text: 'Weed wraps around your rudder.',
    icon: '🌿', effect: '−3 spaces', type: 'negative',
    apply: (p) => { p.bonusMove = -3; } },
  { id: 'expert_crew', title: 'Expert Crew Work!', text: 'Your crew executes a flawless tack!',
    icon: '🎩', effect: 'Snap to next mark', type: 'positive',
    apply: (p) => { p.advanceToMark = true; } },
  { id: 'squall', title: 'Sudden Squall!', text: 'A squall hits without warning — all hands!',
    icon: '⛈️', effect: 'Storm: −2 to all', type: 'negative',
    apply: (_p, g) => { g.squall(); g.weatherState = 'rain'; g.weatherTimer = 3; } },
  { id: 'lucky_wind', title: 'Fair Winds!', text: 'The wind perfectly favors your course.',
    icon: '🍀', effect: '+4 spaces', type: 'positive',
    apply: (p) => { p.bonusMove = 4; } },
  { id: 'barnacles', title: 'Barnacle Drag!', text: 'Your hull is fouled — she\'s sluggish.',
    icon: '🐚', effect: '−1 for 2 turns', type: 'negative',
    apply: (p) => { p.barnacles = 2; } }
];
