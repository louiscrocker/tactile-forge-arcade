// =====================================================
// Tactile Forge — Lunar Lander · Global state + event bus
// =====================================================

const LS_KEY = 'tf-lunar-lander-v1';

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

const stored = loadStored() || {};

/** A career record with every counter present and zeroed. */
export function emptyCareer() {
  return {
    sorties: 0,
    landings: 0,
    crashes: 0,
    bestScore: 0,
    bestStreak: 0,         // most consecutive landings in one sortie
  };
}

/**
 * Merge a stored career over the defaults, coercing each counter to a finite
 * number. Saves written by an older build (or a hand-edited localStorage entry)
 * can be missing keys, and a missing counter used to crash the Pilot Log.
 */
function readCareer(raw) {
  const career = emptyCareer();
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(career)) {
      const n = Number(raw[k]);
      if (Number.isFinite(n) && n >= 0) career[k] = n;
    }
  }
  return career;
}

const DIFFICULTIES = new Set(['cadet', 'pilot', 'ace']);
const PHOSPHORS    = new Set(['green', 'amber', 'cyan']);
const RENDERERS    = new Set(['auto', 'webgl', 'canvas']);
const oneOf = (value, allowed, fallback) => (allowed.has(value) ? value : fallback);
const bool  = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export const state = {
  pilot:    (typeof stored.pilot === 'string' && stored.pilot.trim())
              ? stored.pilot.trim().toUpperCase().slice(0, 14)
              : 'EAGLE',
  difficulty: oneOf(stored.difficulty, DIFFICULTIES, 'pilot'),
  settings: {
    sfx:   bool(stored.settings?.sfx,   true),
    music: bool(stored.settings?.music, true),
    crt:   bool(stored.settings?.crt,   true),
    phosphor: oneOf(stored.settings?.phosphor, PHOSPHORS, 'green'),
    renderer: oneOf(stored.settings?.renderer, RENDERERS, 'auto'),
    reduceMotion: bool(stored.settings?.reduceMotion, false),
  },
  career: readCareer(stored.career),
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
