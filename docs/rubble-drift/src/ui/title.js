// =====================================================
// Tactile Forge — Asteroids · Title + briefing bindings
// =====================================================

import { state, persist } from '../state.js';
import { gotoScreen } from './screens.js';

export function bindBriefing() {
  const pilot = document.getElementById('pilot-name');
  pilot.value = state.pilot;
  // Keep the field's raw text while editing — snapping an emptied field back to
  // the default mid-keystroke makes the call sign impossible to retype.
  pilot.addEventListener('input', () => {
    state.pilot = pilot.value.toUpperCase().slice(0, 14).trim() || 'ROGUE';
    persist();
  });
  pilot.addEventListener('focus', () => pilot.select());
  pilot.addEventListener('blur', () => {
    if (!pilot.value.trim()) pilot.value = state.pilot;
  });

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

  document.getElementById('btn-launch').addEventListener('click', () => {
    gotoScreen('game');
    document.body.dispatchEvent(new CustomEvent('mission:launch'));
  });
}
