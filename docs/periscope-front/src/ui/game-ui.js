// =====================================================
// Tactile Forge — Tank Battle · In-game HUD wiring
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
  const canvas = document.getElementById('game-canvas');
  engine = new Engine(canvas);

  // Phase banner (between waves / on respawn)
  const banner  = document.getElementById('phase-banner');
  const pbNum   = document.getElementById('pb-num');
  const pbName  = document.getElementById('pb-name');
  const pbSub   = document.getElementById('pb-sub');

  bus.on('phase', ({ num, name, sub }) => {
    pbNum.textContent  = String(num);
    pbName.textContent = name;
    pbSub.textContent  = sub;
    banner.hidden = false;
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
    setTimeout(() => { banner.hidden = true; }, 2200);
  });

  // HUD elements
  const barHull   = document.querySelector('#bar-hull .bar-fill');
  const barWrap   = document.getElementById('bar-hull');
  const valWave   = document.getElementById('val-wave');
  const valLives  = document.getElementById('val-lives');
  const valTargets = document.getElementById('val-targets');
  const valRange   = document.getElementById('val-range');
  const valScore  = document.getElementById('val-score');
  const valHigh   = document.getElementById('val-high');
  const valMult   = document.getElementById('val-mult');
  const valTime   = document.getElementById('val-time');
  const screenGame = document.querySelector('.screen-game');

  bus.on('hud', (h) => {
    barHull.style.transform = `scaleX(${Math.max(0, Math.min(1, h.hull))})`;
    if (h.hullLow) barWrap.classList.add('hud-bar-warn');
    else barWrap.classList.remove('hud-bar-warn');
    valWave.textContent  = String(h.wave).padStart(2, '0');
    valLives.textContent = h.lives;
    valLives.dataset.unsafe = h.lives <= 1 ? 'true' : 'false';
    valTargets.textContent = h.targets;
    valRange.textContent  = h.range == null ? '---' : `${h.range}m`;
    valScore.textContent = h.score.toLocaleString();
    valHigh.textContent  = h.high.toLocaleString();
    valMult.textContent  = h.mult;
    valTime.textContent  = fmtTime(h.time);
    if (h.hullLow) screenGame.classList.add('is-warning');
    else screenGame.classList.remove('is-warning');
  });

  // Player-hit flash
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

  // Wave-clear bonus toast (reuses .land-toast styling from sibling games)
  bus.on('bonus-toast', (t) => {
    const toast = document.createElement('div');
    toast.className = 'land-toast';
    toast.style.left = `50%`;
    toast.style.top  = `${Math.max(120, t.y || 220)}px`;
    toast.innerHTML = `
      <div class="lt-mult">WAVE ${String(t.wave).padStart(2, '0')} CLEAR · ×${t.mult}</div>
      <div class="lt-line"><span>Bonus</span><span>+${t.total.toLocaleString()}</span></div>
      <div class="lt-total">+${t.total.toLocaleString()}</div>
    `;
    screenGame.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  });

  // Pause
  const pausedVeil = document.getElementById('paused-veil');
  const menu = document.getElementById('game-menu');
  function pause(p) {
    engine.setPaused(p);
    pausedVeil.hidden = !p;
    if (!p) menu.hidden = true;
  }
  bus.on('pause-toggle', () => pause(!engine.paused));

  // Navigating away mid-sortie (top nav, brand mark) must not leave a live tank
  // driving — and audio droning — behind a screen nobody is looking at.
  bus.on('screen', (name) => {
    if (name !== 'game' && engine.running && !engine.paused) pause(true);
  });

  document.getElementById('game-menu-btn').addEventListener('click', () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    pause(opening);
  });
  document.getElementById('btn-resume').addEventListener('click', () => pause(false));
  document.getElementById('btn-quit').addEventListener('click', () => {
    engine.stop();
    pausedVeil.hidden = true;
    menu.hidden = true;
    gotoScreen('title');
  });

  // Mission launch from briefing or rematch
  document.body.addEventListener('mission:launch', () => {
    audio.unlock();
    audio.init({ sfx: state.settings.sfx, music: state.settings.music });
    engine.start({ difficulty: state.difficulty });
    pausedVeil.hidden = true;
    menu.hidden = true;
  });

  // Mission end → debrief
  bus.on('mission-end', () => {
    setTimeout(() => gotoScreen('finish'), 1400);
  });
}

export function getEngine() { return engine; }
