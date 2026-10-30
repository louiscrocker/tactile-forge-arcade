/* ============================================================
   main.js — settings, the game state, and the flow between
   screens: title → town map → intro card → play → results.
   boot.js (loaded last) runs the loop and wires up the buttons.
   ============================================================ */
'use strict';

const params = new URLSearchParams(location.search);
const DEFAULTS = { diff: 'normal', sound: true, music: true, voice: true, shake: true, slow: false, touch: 'auto' };
const ENUMS = { diff: DIFF_KEYS, touch: ['auto', 'on', 'off'] };
function loadSettings() {
  const s = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem('smash.settings') || '{}');
    if (raw && typeof raw === 'object') for (const k in DEFAULTS) { if (!(k in raw)) continue; if (ENUMS[k]) { if (ENUMS[k].includes(raw[k])) s[k] = raw[k]; } else if (typeof raw[k] === typeof DEFAULTS[k]) s[k] = raw[k]; }
  } catch (e) { /* defaults */ }
  return s;
}
const G = {
  settings: loadSettings(), mode: 'title', level: null, def: null, coop: false, cam: new Camera(), particles: new Particles(), t: 0,
  hats: { mungo: 'hardhat', pip: 'beanie' }, bucketColor: '#3a8ad8', sel: 0, paused: false, acc: 0, newBuilding: null, result: null,
  attract: null, attractBots: null, attractN: 0, seed: params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0, plays: 0
};
window.G = G;
function saveSettings() { try { localStorage.setItem('smash.settings', JSON.stringify(G.settings)); } catch (e) { /* private mode */ } }
function applySettings() {
  const S = G.settings;
  AudioFX.music = S.music; if (AudioFX.ready || S.sound) AudioFX.setEnabled(S.sound && G.audioUnlocked);
  Voice.setEnabled(S.voice);
  UI.syncToggles(S); saveSettings();
}
function wardrobeToG() {
  const D = SaveGame.data;
  G.hats.mungo = SaveGame.hatUnlocked('mungo', D.hats.mungo) ? D.hats.mungo : 'hardhat';
  G.hats.pip = SaveGame.hatUnlocked('pip', D.hats.pip) ? D.hats.pip : 'beanie';
  G.bucketColor = (BUCKETS.find(b => b.key === D.bucket && SaveGame.bucketUnlocked(b.key)) || BUCKETS[0]).color;
}
const insets = () => {
  const hud = $('hud'), pad = $('pad');
  return { top: hud && !hud.hidden ? hud.offsetHeight + 16 : 16, bottom: pad && !pad.hidden ? Math.max(120, pad.offsetHeight) : 20 };
};
function touchWanted() { const t = G.settings.touch; return t === 'on' || (t === 'auto' && (matchMedia('(pointer: coarse)').matches || params.has('pad'))); }

/* ---------- screens ---------- */
function toTitle() {
  G.mode = 'title'; G.level = null; Input.enabled = false; Input.reset(); UI.closeAll();
  UI.refreshTitle(SaveGame.hasProgress()); UI.setScreen('title'); startAttract();
}
function toMap(sel) {
  G.mode = 'map'; G.level = null; G.newBuilding = null; Input.enabled = false; Input.reset(); UI.closeAll();
  if (sel === undefined) { sel = 0; for (let i = 0; i < LEVELS.length; i++) if (SaveGame.unlocked(LEVELS[i].id)) sel = i; for (let i = 0; i < LEVELS.length; i++) if (SaveGame.unlocked(LEVELS[i].id) && !SaveGame.data.stars[LEVELS[i].id]) { sel = i; break; } }
  G.sel = clamp(sel, 0, LEVELS.length - 1); MapView.camX = MapView.stopX(G.sel) - innerWidth / 2 / MapView.layout(innerWidth, innerHeight).s;
  wardrobeToG(); UI.setScreen('map'); UI.refreshMap(G.sel);
}
function startLevel(def, opts = {}) {
  UI.closeAll();
  G.def = def; G.coop = def.kind === 'coop'; G.mode = 'play'; G.result = null; G.newBuilding = null; G.paused = true; G.acc = 0; G.plays++;
  G.level = new Level(def, { diff: G.settings.diff, seed: G.seed + G.plays });
  G.particles = new Particles(); Director.reset(); wardrobeToG();
  UI.setScreen('play'); $('hint').hidden = true; $('hintText').textContent = '';
  $('hudName').textContent = def.name; $('hudStreet').textContent = (G.coop ? 'Team job · ' : '') + def.street + ' · ' + DIFF[G.settings.diff].kid;
  const pad = touchWanted(); UI.show('pad', pad); $('pad').classList.toggle('two', G.coop); UI.show('pad1', G.coop);
  $('act0').textContent = def.kind === 'mend' ? 'FIX' : 'PUNCH';
  Render.frameCamera(G.cam, G.level, insets(), true);
  if (opts.noIntro) beginPlay(); else { UI.intro(def, G.coop); sayIntro(); }
}
function sayIntro() { if (G.settings.voice && G.def) Voice.say(G.def.say, { interrupt: true, force: true }); }
function beginPlay() {
  UI.show('intro', false); G.paused = false; Input.reset(); Input.enabled = true; G.acc = 0;
  if (!Director.once.has('start')) { Director.once.add('start'); UI.hint(G.def.say, 6); }
}
function pauseGame(p) {
  if (G.mode !== 'play' || G.result || !$('intro').hidden) return;
  G.paused = p; Input.enabled = !p; Input.reset(); UI.show('pause', p); AudioFX.pause(p); if (p) Voice.stop();
}
function finishLevel(res) {
  Input.enabled = false; Input.reset(); G.result = res;
  const news = SaveGame.record(res); wardrobeToG();
  const i = LEVELS.findIndex(l => l.id === res.id), next = i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null;
  const nextOpen = !!next && SaveGame.unlocked(next.id);
  if (res.outOfTime) AudioFX.play('fail');
  if (!res.outOfTime && G.def.kind === 'smash' && !SaveGame.data.styles[res.id]) pickStyle(SaveGame.data.styles[res.id] || 'bakery', false);
  UI.results(res, G.def, news, nextOpen, (style) => pickStyle(style, true));
  if (G.settings.voice) Voice.say(res.outOfTime ? 'Out of time! Have another go.' : `${res.stars} star${res.stars === 1 ? '' : 's'}! Well done!`, { interrupt: true });
}
function pickStyle(style, user) {
  SaveGame.data.styles[G.def.id] = style; SaveGame.write();
  G.newBuilding = { style, t: 0 };
  if (user) { AudioFX.play('fixed'); const s = STYLES.find(x => x.key === style); if (s && G.settings.voice) Voice.say(`A new ${s.name.toLowerCase()} goes up!`, { interrupt: true }); }
}
function resultNext() {
  const res = G.result; if (!res) return;
  if (res.outOfTime) { startLevel(G.def); return; }
  if (G.coop) { toMap(); return; }
  const i = LEVELS.findIndex(l => l.id === res.id), next = LEVELS[i + 1];
  if (next && SaveGame.unlocked(next.id)) startLevel(next); else toMap(i);
}

/* ---------- the title's attract mode: the bots play behind the card ---------- */
function startAttract() {
  const pool = [LEVELS[2], LEVELS[3], LEVELS[0], LEVELS[1]], def = pool[G.attractN++ % pool.length];
  G.attract = new Level(def, { diff: 'normal', seed: 7 + G.attractN });
  G.attractBots = G.attract.players.map(a => Bot.make(a.type)); G.particles = new Particles();
  Render.frameCamera(G.cam, G.attract, { top: 20, bottom: 20 }, true);
  if (innerWidth > 1000) { G.cam.tx -= innerWidth * .33 / G.cam.tzoom; G.cam.snap(); }
}
