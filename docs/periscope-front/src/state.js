// =====================================================
// Tactile Forge — Tank Battle · Global state + event bus
// =====================================================

const LS_KEY = 'tf-tank-battle-v1';

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
// Sanitisers. Nothing arriving from localStorage can be trusted to have the
// right shape — a career missing `kills`, or holding a string where a number
// belongs, throws while rendering the Crew Log and takes the whole boot with
// it, leaving no UI to clear the bad blob.
// (Tank Battle has no Import button today; if one is added, this is already
//  the guard it needs.)
// ---------------------------------------------------------------
const DEFAULT_CAREER = {
  sorties:      0,    // total engagements played
  wavesCleared: 0,    // sum across all sorties
  kills:        0,    // total enemies destroyed (tanks + saucers)
  saucerKills:  0,
  superKills:   0,
  shellsFired:  0,
  bestScore:    0,
  bestWave:     0,
};

const bool  = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, allowed, d) => (allowed.includes(v) ? v : d);
const count = (v) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

function sanitizeCareer(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const out = {};
  for (const key of Object.keys(DEFAULT_CAREER)) out[key] = count(src[key]);
  return out;
}

function sanitizeSettings(raw) {
  const s = (raw && typeof raw === 'object') ? raw : {};
  return {
    sfx:      bool(s.sfx, true),
    music:    bool(s.music, true),
    crt:      bool(s.crt, true),
    phosphor: oneOf(s.phosphor, ['green', 'amber', 'cyan'], 'green'),
    bloom:    oneOf(s.bloom, ['off', 'soft', 'hot'], 'soft'),
    curve:    bool(s.curve, true),          // CRT barrel + chroma
    reduceMotion: bool(s.reduceMotion, false),
  };
}

const stored = loadStored() || {};

export const state = {
  pilot:      String(stored.pilot ?? 'GUNNER').toUpperCase().slice(0, 14) || 'GUNNER',
  difficulty: oneOf(stored.difficulty, ['cadet', 'defender', 'ace'], 'defender'),
  settings:   sanitizeSettings(stored.settings),
  career:     sanitizeCareer(stored.career),
  // Last completed sortie summary (for finish screen)
  lastSortie: null,
};

export function persist() {
  saveStored({
    pilot: state.pilot,
    difficulty: state.difficulty,
    settings: state.settings,
    career: state.career,
  });
}

/** Reset the career log to its zero state. */
export function resetCareer() {
  state.career = sanitizeCareer(null);
  persist();
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
