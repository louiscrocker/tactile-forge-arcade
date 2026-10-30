/* ============================================================
   ui.js — the DOM side: title, town map card, HUD, hints, the
   intro / pause / results cards, hats and buckets, co-op,
   settings, help and the grown-ups page.  main.js owns the game;
   this file only shows things and calls back.
   ============================================================ */
'use strict';

const $ = (id) => document.getElementById(id);
const UI = {
  cb: {}, hintT: 0,
  show(id, on = true) { const el = $(id); if (el) el.hidden = !on; },
  anyModal() { return ['intro', 'pause', 'results', 'wardrobe', 'coop', 'help', 'grownups'].some(id => !$(id).hidden) || !$('drawer').hidden || !!document.querySelector('.gu-veil'); },
  closeAll() { for (const id of ['intro', 'pause', 'results', 'wardrobe', 'coop', 'help', 'grownups', 'drawer']) $(id).hidden = true; },
  closeTopModal() { for (const id of ['help', 'grownups', 'wardrobe', 'coop']) if (!$(id).hidden) { $(id).hidden = true; return true; } if (!$('drawer').hidden) { $('drawer').hidden = true; return true; } return false; },
  setScreen(mode) {
    this.show('title', mode === 'title'); this.show('mapui', mode === 'map'); this.show('hud', mode === 'play'); this.show('hint', mode === 'play' && !!$('hintText').textContent);
    document.body.classList.toggle('playing', mode === 'play');
    if (mode !== 'play') { this.show('pad', false); this.show('combo', false); }
  },

  /* ---------- toggles (sound, music, voice, shake, slow, difficulty) ---------- */
  syncToggles(S) {
    for (const id of ['tgSound', 'tgSoundT', 'tgSoundD']) $(id).classList.toggle('on', S.sound);
    for (const id of ['tgMusic', 'tgMusicD']) $(id).classList.toggle('on', S.music);
    for (const id of ['tgVoice', 'tgVoiceT', 'tgVoiceD']) $(id).classList.toggle('on', S.voice);
    $('tgShake').classList.toggle('on', S.shake); $('tgSlow').classList.toggle('on', S.slow);
    $('selTouch').value = S.touch;
    for (const seg of ['diffTitle', 'diffDrawer']) $(seg).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.diff === S.diff));
  },

  /* ---------- the title ---------- */
  refreshTitle(hasProgress) { this.show('btnContinue', hasProgress); $('btnStart').textContent = hasProgress ? 'Start the street again' : 'Play! 🔨'; $('btnStart').classList.toggle('ghostly', hasProgress); },

  /* ---------- the map card ---------- */
  refreshMap(sel) {
    const L = LEVELS[sel], D = SaveGame.data, open = SaveGame.unlocked(L.id), b = D.best[L.id];
    $('mapStars').textContent = SaveGame.totalStars();
    $('mcStreet').textContent = `${L.street} · stop ${sel + 1} of ${LEVELS.length}`;
    $('mcName').textContent = L.name;
    const k = $('mcKind'); k.textContent = (L.kind === 'smash' ? '🔨 SMASH with Mungo' : '🔧 MEND with Pip') + (L.boss ? ' · a big one!' : ''); k.classList.toggle('mend', L.kind === 'mend');
    $('mcBest').textContent = !open ? '🔒 Finish the stop before to open this one' : b ? `${'★'.repeat(D.stars[L.id] || 0)}${'☆'.repeat(3 - (D.stars[L.id] || 0))} · best ${fmtTime(b.time)} · ${b.score} points` : 'Not played yet';
    $('mcPlay').disabled = !open;
    $('mapPrev').disabled = sel === 0; $('mapNext').disabled = sel === LEVELS.length - 1;
  },

  /* ---------- the HUD ---------- */
  hud(L) {
    const p = L.progress();
    $('progBar').style.width = (p * 100).toFixed(1) + '%';
    $('progText').textContent = L.kind === 'smash' ? `${Math.round(p * 100)}% smashed` : L.kind === 'mend' ? `${L.house.fixes.length - L.fixesLeft()} of ${L.house.fixes.length} fixed` : `${Math.round((1 - L.remaining() / L.initial) * 100)}% smashed · ${L.house.fixes.length - L.fixesLeft()}/${L.house.fixes.length} fixed`;
    const tl = L.limit ? Math.max(0, L.limit - L.time) : 0;
    $('roTime').textContent = L.limit && L.diff.failOnTime ? fmtTime(tl) : fmtTime(L.time);
    $('roTime').classList.toggle('late', !!(L.limit && L.diff.failOnTime && tl < 15));
    $('roScore').textContent = fmtInt(L.score);
    if (L.kind === 'smash') { $('roTidyK').textContent = '🧹 Dust'; $('roTidy').textContent = `${L.mess}/${L.def.tidy}`; }
    else { $('roTidyK').textContent = '🪣 Caught'; $('roTidy').textContent = L.catches; }
    const c = $('combo');
    if (L.combo >= 2) { if (c.hidden || $('comboN').textContent !== 'x' + L.combo) { c.hidden = false; $('comboN').textContent = 'x' + L.combo; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } }
    else c.hidden = true;
  },
  hint(text, secs = 4) { if (!text) return; $('hintText').textContent = text; const h = $('hint'); h.hidden = false; h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); this.hintT = secs; },
  tick(dt) { if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) $('hint').hidden = true; } },

  /* ---------- intro card ---------- */
  intro(def, coop) {
    $('introKind').textContent = coop ? '👫 TEAM JOB' : def.kind === 'smash' ? '🔨 SMASH with Mungo' : '🔧 MEND with Pip';
    $('introTitle').textContent = def.name;
    $('introText').textContent = def.say;
    const keys = coop ? ['P1 Mungo: A D move · W jump/climb · S stomp · F punch', 'P2 Pip: ← → move · ↑ jump/climb · ↓ bucket · L fix']
      : def.kind === 'smash' ? ['← → walk · X punch · Space jump', 'Walk into the wall and hold ↑ to climb', 'Jump, then ↓ to STOMP'] : ['← → walk · ↑ ↓ climb the drainpipes', 'X fixes the sparkly broken things', 'Hold ↓ to catch with your bucket'];
    $('introKeys').innerHTML = ''; for (const k of keys) { const li = document.createElement('li'); li.textContent = k; $('introKeys').appendChild(li); }
    const g = $('introPic').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 240, 160);
    const grd = g.createLinearGradient(0, 0, 0, 160); grd.addColorStop(0, SKIES[def.tod].top); grd.addColorStop(1, SKIES[def.tod].low); g.fillStyle = grd; g.fillRect(0, 0, 240, 160);
    g.fillStyle = '#7ab85a'; g.fillRect(0, 140, 240, 20);
    g.save(); g.translate(0, 140 - GROUND_Y);
    const who = (type, x, face) => { const a = new Actor(type, x, GROUND_Y); a.face = face; a.anim = 1; return a; };
    if (def.kind !== 'mend') { g.save(); g.translate(def.kind === 'coop' ? 60 : 70, GROUND_Y); g.scale(.8, .8); MapView.miniOld(g, def); g.restore(); }
    if (def.kind !== 'smash') { g.save(); g.translate(170, GROUND_Y); g.scale(.8, .8); MapView.miniHouse(g, def, false, 0); g.restore(); }
    g.restore();
    g.save(); g.translate(0, 140 - GROUND_Y);
    if (def.kind !== 'mend') Chars.mungo(g, who('mungo', 120, 1), { hat: SaveGame.data.hats.mungo, happy: true });
    if (def.kind !== 'smash') Chars.pip(g, who('pip', def.kind === 'coop' ? 150 : 70, 1), { hat: SaveGame.data.hats.pip });
    g.restore();
    this.show('intro', true);
  },

  /* ---------- results ---------- */
  results(res, def, news, nextOpen, onStyle) {
    const ok = !res.outOfTime;
    $('resTitle').textContent = !ok ? '⏰ Out of time! Try again?' : def.kind === 'smash' ? (res.stars === 3 ? '🔨 Smashed it, super tidy!' : '🔨 Smashed it!') : def.kind === 'mend' ? (res.stars === 3 ? '🔧 All fixed, perfect!' : '🔧 All fixed!') : '👫 Team job done!';
    const st = $('resStars'); st.innerHTML = '';
    for (let k = 0; k < 3; k++) { const s = document.createElement('span'); s.textContent = '★'; st.appendChild(s); setTimeout(() => { s.classList.add('shown'); if (k < res.stars) { s.classList.add('on'); AudioFX.play('star', 1 + k * .12); } }, 300 + k * 350); }
    const stats = [['Time', fmtTime(res.time), res.time <= res.par], ['Score', fmtInt(res.score), false]];
    if (def.kind === 'smash') { stats.push(['Dust next door', `${res.mess} (${res.mess <= res.tidy ? 'tidy!' : 'max ' + res.tidy})`, res.mess <= res.tidy]); stats.push(['Best combo', 'x' + res.bestCombo, false]); }
    else { stats.push(['Bumps', String(res.bonks), res.bonks <= 2]); stats.push(['Caught', String(res.catches), false]); }
    if (ok && res.time > res.par) stats[0][1] += ` (quick is ${fmtTime(res.par)})`;
    $('resStats').innerHTML = ''; for (const [k, v, yes] of stats) { const d = document.createElement('div'); if (yes) d.className = 'yes'; d.textContent = k; const b = document.createElement('b'); b.textContent = v; d.appendChild(b); $('resStats').appendChild(d); }
    $('resNew').innerHTML = ''; for (const n of news) { const s = document.createElement('span'); s.textContent = (n.kind === 'level' ? '🔓 ' : n.kind === 'hat' ? '🎩 ' : n.kind === 'bucket' ? '🪣 ' : '🏗 ') + 'New: ' + n.name; $('resNew').appendChild(s); }
    const box = $('resStyleBox'); box.hidden = !(ok && def.kind === 'smash');
    if (!box.hidden) this.styleGrid($('resStyles'), SaveGame.data.styles[def.id] || null, onStyle);
    $('resNext').textContent = ok ? (nextOpen ? 'Next stop ➜' : 'To the map ➜') : 'Try again ➜';
    this.show('results', true);
  },
  styleGrid(root, current, onPick) {
    root.innerHTML = '';
    for (const s of STYLES) {
      const b = document.createElement('button'), cv = document.createElement('canvas'); cv.width = 144; cv.height = 120;
      const g = cv.getContext('2d'); g.fillStyle = '#bfe4f5'; g.fillRect(0, 0, 144, 120); g.fillStyle = '#7ab85a'; g.fillRect(0, 108, 144, 12);
      g.save(); g.translate(0, 108); g.scale(.4, .4); g.translate(0, -GROUND_Y); Scene.newBuilding(g, s.key, 20, 340, 1, false); g.restore();
      b.appendChild(cv); b.appendChild(document.createTextNode(s.name));
      const open = SaveGame.styleUnlocked(s.key); b.disabled = !open; if (!open) b.title = 'Finish ' + (levelById(s.level) || {}).name + ' to unlock';
      b.classList.toggle('on', s.key === current);
      b.onclick = () => { root.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(s.key); };
      root.appendChild(b);
    }
  },

  /* ---------- hats and buckets ---------- */
  wardrobe(onChange) {
    const D = SaveGame.data, total = SaveGame.totalStars();
    const make = (root, items, isOn, unlocked, draw, pick) => {
      root.innerHTML = '';
      for (const it of items) {
        const b = document.createElement('button'), cv = document.createElement('canvas'); cv.width = 144; cv.height = 120; draw(cv.getContext('2d'), it);
        b.appendChild(cv); b.appendChild(document.createTextNode(unlocked(it) ? it.name : `🔒 ${it.stars} ★`));
        b.disabled = !unlocked(it); b.classList.toggle('on', isOn(it)); b.onclick = () => { pick(it); onChange(); this.wardrobe(onChange); };
        root.appendChild(b);
      }
    };
    const actor = (type) => { const a = new Actor(type, 0, 0); a.anim = 1; return a; };
    make($('wardMungo'), HATS.mungo, h => D.hats.mungo === h.key, h => total >= h.stars, (g, h) => { g.translate(72, 117); g.scale(.8, .8); Chars.mungo(g, actor('mungo'), { hat: h.key, noShadow: true }); }, h => { D.hats.mungo = h.key; });
    make($('wardPip'), HATS.pip, h => D.hats.pip === h.key, h => total >= h.stars, (g, h) => { g.translate(72, 116); g.scale(1.5, 1.5); Chars.pip(g, actor('pip'), { hat: h.key, noShadow: true }); }, h => { D.hats.pip = h.key; });
    make($('wardBucket'), BUCKETS, b => D.bucket === b.key, b => total >= b.stars, (g, b) => { g.translate(72, 66); g.scale(2.6, 2.6); Chars.bucket(g, 0, 0, b.color); }, b => { D.bucket = b.key; });
    this.show('wardrobe', true);
  },
  coop(onPick) {
    const root = $('coopGrid'); root.innerHTML = '';
    for (const L of COOP_LEVELS) {
      const b = document.createElement('button'), open = SaveGame.unlocked(L.id), st = SaveGame.data.stars[L.id] || 0;
      b.textContent = `${L.name} ${'★'.repeat(st)}${'☆'.repeat(3 - st)}`; b.disabled = !open; b.onclick = () => onPick(L);
      root.appendChild(b);
    }
    $('coopLocked').textContent = SaveGame.unlocked('sidebyside') ? '' : '🔒 Finish stop 2 (Granny Oak\'s Cottage) to open the team jobs.';
    this.show('coop', true);
  }
};
function fmtTime(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
