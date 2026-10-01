// =====================================================
// Tactile Forge — Lunar Lander · In-game HUD wiring
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

  // Phase banner
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
    // Restart the timer, so a quick second site can't be hidden by the
    // previous banner's pending timeout.
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 2200);
  });

  // HUD elements
  const barFuel  = document.querySelector('#bar-fuel .bar-fill');
  const valFuel  = document.getElementById('val-fuel');
  const valAlt   = document.getElementById('val-alt');
  const valHvel  = document.getElementById('val-hvel');
  const valVvel  = document.getElementById('val-vvel');
  const valScore = document.getElementById('val-score');
  const valSite  = document.getElementById('val-site');
  const valLands = document.getElementById('val-lands');
  const valTime  = document.getElementById('val-time');
  const barFuelWrap = document.getElementById('bar-fuel');
  const screenGame = document.querySelector('.screen-game');

  bus.on('hud', (h) => {
    const ff = Math.max(0, Math.min(1, h.fuel / h.fuelMax));
    barFuel.style.transform = `scaleX(${ff})`;
    barFuelWrap.classList.toggle('hud-bar-warn', h.lowFuel);
    valFuel.textContent  = Math.round(h.fuel);
    valAlt.textContent   = h.alt + ' m';
    // Color hints — red when unsafe
    valVvel.textContent  = (h.vvel >= 0 ? '+' : '') + Math.round(h.vvel) + ' m/s';
    valHvel.textContent  = (h.hvel >= 0 ? '+' : '') + Math.round(h.hvel) + ' m/s';
    valVvel.dataset.unsafe = h.vSafe ? 'false' : 'true';
    valHvel.dataset.unsafe = h.hSafe ? 'false' : 'true';
    valScore.textContent = h.score.toLocaleString();
    valSite.textContent  = String(h.site).padStart(2, '0');
    valLands.textContent = h.lands;
    valTime.textContent  = fmtTime(h.time);
    screenGame.classList.toggle('is-warning', h.lowFuel);
  });

  // Hit / crash flash
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

  // Landing toast — transient floating score readout
  bus.on('landing-toast', (t) => {
    const toast = document.createElement('div');
    toast.className = 'land-toast';
    toast.style.left = `${t.x}px`;
    toast.style.top  = `${Math.max(80, t.y)}px`;
    toast.innerHTML = `
      <div class="lt-mult">×${t.mult} PAD</div>
      <div class="lt-line"><span>Touchdown</span><span>+${t.base}</span></div>
      <div class="lt-line"><span>Fuel bonus</span><span>+${t.fuelBonus}</span></div>
      ${t.streakBonus > 0 ? `<div class="lt-line"><span>Streak</span><span>+${t.streakBonus}</span></div>` : ''}
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

  document.getElementById('game-menu-btn').addEventListener('click', () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    pause(opening);
  });
  document.getElementById('btn-resume').addEventListener('click', () => pause(false));
  document.getElementById('btn-quit').addEventListener('click', () => gotoScreen('title'));

  // Any route away from the game screen ends the mission. Without this, using
  // the top bar mid-flight left the render loop and the engine drone running
  // behind the menu.
  bus.on('screen', (name) => {
    if (name === 'game') return;
    if (engine.running) engine.stop();
    pausedVeil.hidden = true;
    menu.hidden = true;
    screenGame.classList.remove('is-warning');
  });

  // Renderer switched in settings — the engine replaces its canvas element.
  bus.on('renderer', (pref) => engine.setRenderer(pref));

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
