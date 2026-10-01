// =====================================================
// Tactile Forge — Asteroids · Global state + event bus
// =====================================================

const LS_KEY = 'tf-asteroids-v1';
const HS_MAX = 10;

function loadStored() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveStored(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

// ---------------------------------------------------------------
// Sanitisers. This blob arrives from localStorage AND from the Settings
// screen's Import button, so nothing here can be trusted to have the right
// shape — a career missing `hits`, or `scores` holding a string, would throw
// while rendering the Pilot Log. Worse, Import writes then reloads, so an
// unguarded crash would brick every subsequent load with no UI left to fix it.
// ---------------------------------------------------------------
const DEFAULT_CAREER = {
  patrols:          0,   // total sorties
  wavesCleared:     0,
  asteroidsBlasted: 0,
  saucersDowned:    0,
  shotsFired:       0,
  hits:             0,
  bestScore:        0,
  bestWave:         0,
};

/** YYYY-MM-DD in the player's own timezone — toISOString() would stamp UTC,
 *  dating an evening run to tomorrow for anyone west of Greenwich. */
export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const bool  = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, allowed, d) => (allowed.includes(v) ? v : d);
const count = (v) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

function sanitizeCareer(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const out = {};
  for (const key of Object.keys(DEFAULT_CAREER)) out[key] = count(src[key]);
  return out;
}

function sanitizeScores(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(e => e && typeof e === 'object' && Number.isFinite(e.score))
    // The Pilot Log renders these through innerHTML, and an imported file is
    // arbitrary text — keep initials to cabinet-legal characters and the date
    // to a literal YYYY-MM-DD so no markup can ride along.
    .map(e => ({
      name:  (String(e.name ?? 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA'),
      score: count(e.score),
      wave:  Math.max(1, count(e.wave) || 1),
      date:  /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, HS_MAX);
}

function sanitizeSettings(raw) {
  const s = (raw && typeof raw === 'object') ? raw : {};
  return {
    sfx:      bool(s.sfx, true),
    music:    bool(s.music, true),        // the pulse beat
    crt:      bool(s.crt, true),
    phosphor: oneOf(s.phosphor, ['green', 'amber', 'cyan'], 'green'),
    bloom:    oneOf(s.bloom, ['off', 'soft', 'hot'], 'soft'),
    curve:    bool(s.curve, true),        // CRT barrel + chroma
    reduceMotion: bool(s.reduceMotion, false),
  };
}

const stored = loadStored() || {};

export const state = {
  pilot:      String(stored.pilot ?? 'ROGUE').toUpperCase().slice(0, 14) || 'ROGUE',
  difficulty: oneOf(stored.difficulty, ['cadet', 'pilot', 'ace'], 'pilot'),
  settings:   sanitizeSettings(stored.settings),
  career:     sanitizeCareer(stored.career),
  // Top-10 high-score table: [{ name, score, wave, date }]
  scores:     sanitizeScores(stored.scores),
  // Last completed sortie summary (for the finish screen)
  lastSortie: null,
};

export function persist() {
  saveStored({
    pilot: state.pilot,
    difficulty: state.difficulty,
    settings: state.settings,
    career: state.career,
    scores: state.scores,
  });
}

/** Reset the career log and high-score table to their zero state. */
export function resetCareer() {
  state.career = sanitizeCareer(null);
  state.scores = [];
  persist();
}

/** Returns true if `score` would land in the top-10. */
export function qualifiesForHighScore(score) {
  if (score <= 0) return false;
  if (state.scores.length < HS_MAX) return true;
  return score > state.scores[state.scores.length - 1].score;
}

/** Insert a new high score, keep list sorted desc and capped to HS_MAX. */
export function addHighScore({ name, score, wave }) {
  const entry = {
    name: (name || 'AAA').toUpperCase().slice(0, 3),
    score,
    wave,
    date: today(),
  };
  state.scores.push(entry);
  state.scores.sort((a, b) => b.score - a.score);
  if (state.scores.length > HS_MAX) state.scores.length = HS_MAX;
  persist();
  return entry;
}

// ===== Event bus =====
const listeners = new Map();
export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
  emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.error(`[bus:${event}]`, e); }
    }
  }
};
