// =====================================================
// Tactile Forge — Lunar Lander · Title + briefing bindings
// =====================================================

import { state, persist } from '../state.js';
import { gotoScreen } from './screens.js';

export function bindBriefing() {
  // Pilot name
  const pilot = document.getElementById('pilot-name');
  pilot.value = state.pilot;
  pilot.addEventListener('input', () => {
    state.pilot = (pilot.value || '').toUpperCase().slice(0, 14) || 'EAGLE';
    persist();
  });
  pilot.addEventListener('blur', () => {
    pilot.value = state.pilot;
  });

  // Difficulty seg
  const diffRow = document.getElementById('difficulty');
  diffRow.querySelectorAll('.seg').forEach(b => {
    b.classList.toggle('is-active', b.dataset.value === state.difficulty);
    b.addEventListener('click', () => {
      diffRow.querySelectorAll('.seg').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      state.difficulty = b.dataset.value;
      persist();
    });
  });

  // Launch
  document.getElementById('btn-launch').addEventListener('click', () => {
    gotoScreen('game');
    document.body.dispatchEvent(new CustomEvent('mission:launch'));
  });
}
