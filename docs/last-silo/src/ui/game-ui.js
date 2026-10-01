// =====================================================
// Tactile Forge — Missile Attack · In-game HUD wiring
// =====================================================

import { state, bus } from '../state.js';
import { gotoScreen } from './screens.js';
import { Engine } from '../game/engine.js';
import * as audio from '../audio/audio.js';

let engine = null;

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function initGame() {
  // The engine owns the canvas element (it replaces it when the renderer
  // changes); it anchors input and layout to the stable stage wrapper.
  engine = new Engine(document.getElementById('game-stage'));

  // Renderer switched in settings.
  bus.on('renderer', (pref) => engine.setRenderer(pref));

  // Phase banner (between waves)
  const banner  = document.getElementById('phase-banner');
  const pbNum   = document.getElementById('pb-num');
  const pbName  = document.getElementById('pb-name');
  const pbSub   = document.getElementById('pb-sub');

  let bannerTimer = null;
  bus.on('phase', ({ num, name, sub }) => {
    pbNum.textContent  = String(num);
    pbName.textContent = name;
    pbSub.textContent  = sub;
    banner.hidden = false;
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
    // A second banner within 2.2s must not be cut short by the first timer.
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 2200);
  });

  // HUD elements
  const barAmmo  = document.querySelector('#bar-ammo .bar-fill');
  const valWave  = document.getElementById('val-wave');
  const valCities = document.getElementById('val-cities');
  const valBA    = document.getElementById('val-bA');
  const valBB    = document.getElementById('val-bB');
  const valBC    = document.getElementById('val-bC');
  const valScore = document.getElementById('val-score');
  const valHigh  = document.getElementById('val-high');
  const valMult  = document.getElementById('val-mult');
  const valTime  = document.getElementById('val-time');
  const screenGame = document.querySelector('.screen-game');

  bus.on('hud', (h) => {
    const totalAmmo = h.batteryAmmo.reduce((a, b) => a + b, 0);
    const ammoFrac  = Math.max(0, Math.min(1, totalAmmo / h.ammoMax));
    barAmmo.style.transform = `scaleX(${ammoFrac})`;
    valWave.textContent  = String(h.wave).padStart(2, '0');
    valCities.textContent = h.cities;
    valBA.textContent = h.batteryAmmo[0];
    valBB.textContent = h.batteryAmmo[1];
    valBC.textContent = h.batteryAmmo[2];
    // Mark dead/empty batteries
    valBA.dataset.unsafe = (h.batteryAmmo[0] === 0 || !h.batteryAlive[0]) ? 'true' : 'false';
    valBB.dataset.unsafe = (h.batteryAmmo[1] === 0 || !h.batteryAlive[1]) ? 'true' : 'false';
    valBC.dataset.unsafe = (h.batteryAmmo[2] === 0 || !h.batteryAlive[2]) ? 'true' : 'false';
    valScore.textContent = h.score.toLocaleString();
    valHigh.textContent  = h.high.toLocaleString();
    valMult.textContent  = h.mult;
    valTime.textContent  = fmtTime(h.time);
    screenGame.classList.toggle('is-warning', h.lowAmmo);
    barAmmo.parentElement.classList.toggle('hud-bar-warn', h.lowAmmo);
  });

  // Hit / city-loss flash
  bus.on('hit', () => {
    screenGame.classList.add('is-hit');
    setTimeout(() => screenGame.classList.remove('is-hit'), 400);
  });

  // Comm
  const commText = document.getElementById('comm-text');
  const commWrap = document.getElementById('comm');
  let commTimer = null;
  bus.on('comm', (text) => {
    commText.textContent = text;
    commWrap.classList.remove('is-hidden');
    clearTimeout(commTimer);
    commTimer = setTimeout(() => commWrap.classList.add('is-hidden'), 3200);
  });

  // Wave-clear bonus toast (reuses the .land-toast styling)
  bus.on('bonus-toast', (t) => {
    const toast = document.createElement('div');
    toast.className = 'land-toast';
    toast.style.left = `50%`;
    toast.style.top  = `${Math.max(120, t.y || 220)}px`;
    toast.innerHTML = `
      <div class="lt-mult">WAVE ${String(t.wave).padStart(2, '0')} CLEAR · ×${t.mult}</div>
      <div class="lt-line"><span>Cities</span><span>+${t.cityBonus}</span></div>
      <div class="lt-line"><span>Ammo</span><span>+${t.ammoBonus}</span></div>
      <div class="lt-total">+${t.total.toLocaleString()}</div>
    `;
    screenGame.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  });

  // Pause
  const pausedVeil = document.getElementById('paused-veil');
  const menu = document.getElementById('game-menu');
  const resumeChip = document.getElementById('chip-resume');

  function pause(p) {
    engine.setPaused(p);
    pausedVeil.hidden = !p;
    if (!p) menu.hidden = true;
  }
  // The topnav only offers a way back into a sortie that is still live AND
  // currently off-screen; on the game screen itself it would be noise.
  let currentScreen = 'title';
  function syncResumeChip() {
    if (resumeChip) {
      resumeChip.hidden = !(engine.inProgress() && currentScreen !== 'game');
    }
  }
  bus.on('pause-toggle', () => pause(!engine.paused));

  document.getElementById('game-menu-btn').addEventListener('click', () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    pause(opening);
  });
  document.getElementById('btn-resume').addEventListener('click', () => pause(false));
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    engine.restartWave();
    pause(false);
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    // Stand down banks the sortie to the career log and shows the debrief,
    // rather than silently discarding everything the player just flew.
    menu.hidden = true;
    pausedVeil.hidden = true;
    engine.setPaused(false);
    engine.quit();
    syncResumeChip();
  });

  // Leaving the game screen mid-sortie used to leave the simulation running
  // invisibly — cities kept dying while the player read the settings panel,
  // with no route back into the round. Auto-pause, and offer a way back.
  bus.on('screen', (name) => {
    currentScreen = name;
    if (name === 'game') {
      engine.input.setEnabled(engine.inProgress());
    } else {
      if (engine.inProgress() && !engine.paused) pause(true);
      engine.input.setEnabled(false);
    }
    syncResumeChip();
  });

  // Mission launch from briefing or rematch
  document.body.addEventListener('mission:launch', () => {
    audio.unlock();
    audio.init({ sfx: state.settings.sfx, music: state.settings.music });
    engine.start({ difficulty: state.difficulty });
    pausedVeil.hidden = true;
    menu.hidden = true;
    syncResumeChip();
  });

  // Mission end → debrief
  bus.on('mission-end', () => {
    pausedVeil.hidden = true;
    menu.hidden = true;
    syncResumeChip();
    setTimeout(() => gotoScreen('finish'), 1400);
  });
}

export function getEngine() { return engine; }
