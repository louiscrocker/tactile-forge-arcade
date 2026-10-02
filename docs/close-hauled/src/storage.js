// =====================================================
// Tactile Forge — localStorage wrapper
// =====================================================

const KEY = 'tactile_forge_yacht_race_v1';

export function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch { return {}; }
}

export function save(patch) {
  const cur = loadAll();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
  return next;
}

export function loadStats() {
  const all = loadAll();
  return all.stats || { races: 0, wins: 0, podiums: 0, distance: 0, marksRounded: 0, eventsDrawn: 0 };
}

export function saveStats(stats) { save({ stats }); }

export function loadSettings() {
  const all = loadAll();
  return all.settings || { sfx: true, music: true, speed: 'normal', reduceMotion: false };
}

export function saveSettings(settings) { save({ settings }); }

export function loadProfile() {
  const all = loadAll();
  return all.profile || { name: '', colorIndex: 1 };
}

export function saveProfile(profile) { save({ profile }); }
