// =====================================================
// Tactile Forge — Shared app state + tiny event bus
// =====================================================

import { loadSettings } from './storage.js';

const listeners = new Map();

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
  emit(event, payload) {
    listeners.get(event)?.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }
};

export const state = {
  screen: 'title',
  setup: {
    playerCount: 3,
    course: 'coastal',
    laps: 2,
    difficulty: 'normal',
    players: [
      { name: 'You',    colorIndex: 0, yachtClass: 'allrounder', isAI: false },
      { name: 'Britannia', colorIndex: 1, yachtClass: 'racer', isAI: true },
      { name: 'Columbia',  colorIndex: 2, yachtClass: 'cruiser', isAI: true }
    ]
  },
  settings: loadSettings(),
  engine: null,
  net: null,
  online: false,
  myNetId: null,
  hostNetId: null
};
