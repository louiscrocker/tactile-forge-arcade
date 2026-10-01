/* ============================================================
   creator.js — make your alicorn, and the wardrobe
   ============================================================
   The creator edits a `look` object live (a preview animates
   while you pick).  The wardrobe buys and wears accessories.
   ============================================================ */
'use strict';

const Creator = (function () {
  const $ = (id) => document.getElementById(id);
  let look = null, onDone = null, raf = 0, t = 0, mode = 'create';
  let G = null;

  function unlocked(kind, key) {
    if (!look) return false;
    const u = look.unlocked || [];
    return u.includes(kind + ':' + key);
  }

  function open(game, l, opts = {}) {
    G = game; look = l; onDone = opts.onDone; mode = opts.mode || 'create';
    look.mane = look.mane && look.mane.length ? look.mane.slice(0, 2) : ['pink'];
    build();
    $('creatorClose').hidden = mode === 'create';
    $('creatorDone').textContent = mode === 'create' ? "Let's go! ✨" : mode === 'foal' ? 'Welcome home! 🏡' : 'Done ✨';
    $('creatorTitle').textContent = mode === 'foal' ? '🍼 Your baby alicorn' : '🦄 Make your alicorn';
    $('markH').hidden = $('markPick').hidden = mode === 'foal';
    if (mode === 'foal') $('creatorClose').hidden = true;
    $('creator').hidden = false;
    animate();
  }
  function close() { $('creator').hidden = true; cancelAnimationFrame(raf); raf = 0; }
  function isOpen() { return !$('creator').hidden; }

  function build() {
    /* names */
    const ng = $('namePick'); ng.innerHTML = '';
    for (const n of (mode === 'foal' ? FOAL_NAMES : NAMES)) { const b = document.createElement('button'); b.textContent = n; b.classList.toggle('on', look.name === n); b.addEventListener('click', () => { look.name = n; $('nameInput').value = ''; AudioFX.click(); Voice.say(n, { interrupt: true, force: true }); build(); }); ng.appendChild(b); }
    const ni = $('nameInput'); ni.value = (mode === 'foal' ? FOAL_NAMES : NAMES).includes(look.name) ? '' : look.name;
    ni.oninput = () => { const v = ni.value.trim(); if (v) { look.name = v.slice(0, 14); ng.querySelectorAll('button').forEach(b => b.classList.remove('on')); } };
    /* swatches */
    const swatches = (id, list, get, set, kind) => {
      const el = $(id); el.innerHTML = '';
      for (const c of list) {
        const b = document.createElement('button'); b.className = 'swatch'; b.title = c.name;
        if (c.hex === 'rainbow') b.classList.add('rainbow'); else b.style.background = c.hex;
        const locked = c.locked && !unlocked(kind, c.key);
        if (locked) b.classList.add('locked');
        b.classList.toggle('on', get(c.key));
        b.addEventListener('click', () => { if (locked) { Voice.say('That one is a prize for a quest!', { interrupt: true, force: true }); return; } set(c.key); AudioFX.click(); Voice.say(c.name, { interrupt: true }); build(); });
        el.appendChild(b);
      }
    };
    swatches('bodyPick', BODY_COLORS, k => look.body === k, k => { look.body = k; }, 'body');
    swatches('manePick', MANE_COLORS, k => look.mane.includes(k), k => {
      if (look.mane.includes(k)) { if (look.mane.length > 1) look.mane = look.mane.filter(m => m !== k); }
      else { look.mane.push(k); if (look.mane.length > 2) look.mane.shift(); }
    }, 'mane');
    swatches('hornPick', HORNS, k => look.horn === k, k => { look.horn = k; }, 'horn');
    swatches('eyePick', EYE_COLORS, k => look.eyes === k, k => { look.eyes = k; }, 'eyes');
    const wp = $('wingPick'); wp.innerHTML = '';
    for (const w of WING_STYLES) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = w.name + (w.locked && !unlocked('wings', w.key) ? ' 🔒' : ''); b.classList.toggle('on', look.wings === w.key); b.classList.toggle('locked', !!(w.locked && !unlocked('wings', w.key))); b.addEventListener('click', () => { if (w.locked && !unlocked('wings', w.key)) { Voice.say('Sparkle wings are a prize for a quest!', { interrupt: true, force: true }); return; } look.wings = w.key; AudioFX.click(); build(); }); wp.appendChild(b); }
    const mg = $('markPick'); mg.innerHTML = '';
    for (const m of MARKS) {
      const b = document.createElement('button');
      if (m.key === 'custom') { const c = document.createElement('canvas'); c.width = c.height = 80; c.style.width = c.style.height = '40px'; const x = c.getContext('2d'); x.scale(2, 2); x.translate(20, 20); if (look.markImg) Sprites.drawMark(x, 'custom', 14, '#ff7ab6', '#c9a5ff', look.markImg); else Sprites.icon && x.drawImage(Sprites.icon('paint', look, 40), -20, -20, 40, 40); b.appendChild(c); }
      else b.appendChild(Sprites.iconEl(m.key, look, 40, 'mark'));
      const s = document.createElement('span'); s.textContent = m.key === 'custom' ? (look.markImg ? 'My own!' : 'Paint one!') : m.name; b.appendChild(s);
      b.classList.toggle('on', look.mark === m.key);
      b.addEventListener('click', () => {
        AudioFX.click();
        if (m.key === 'custom') { Paint.open(G, look, { onDone: () => build() }); return; }
        look.mark = m.key; Voice.say(m.name, { interrupt: true }); build();
      });
      mg.appendChild(b);
    }
  }

  function random() {
    look.body = pick(BODY_COLORS).key;
    const manes = MANE_COLORS.filter(m => !m.locked || unlocked('mane', m.key));
    look.mane = chance(.5) ? [pick(manes).key] : [pick(manes).key, pick(manes).key].filter((v, i, a) => a.indexOf(v) === i);
    look.horn = pick(HORNS.filter(h => !h.locked || unlocked('horn', h.key))).key;
    look.eyes = pick(EYE_COLORS).key;
    if (mode !== 'foal') look.mark = pick(MARKS.filter(m => m.key !== 'custom')).key;
    if (mode === 'create') look.name = pick(NAMES);
    if (mode === 'foal') look.name = pick(FOAL_NAMES);
    build();
  }

  function animate() {
    cancelAnimationFrame(raf);
    const c = $('creatorCanvas');
    const step = () => {
      raf = requestAnimationFrame(step);
      t += 1 / 60;
      drawPreview(c, look, t, mode === 'foal' ? 1 : 0);
    };
    step();
  }
  function drawPreview(c, l, time, baby = 0) {
    const px = 600;
    if (c.width !== px) { c.width = px; c.height = px; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, px, px);
    /* a few flowers and the sun */
    ctx.save();
    for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(40 + i * 66, px * .78 + (i % 2) * 6); ctx.scale(1.4, 1.4); Sprites.drawFlower(ctx, { s: 1, kind: ['daisy', 'tulip', 'poppy', 'bluebell'][i % 4], col: (i * .37) % 1, bloom: 1, ph: i, magicT: 0 }, time, 0); ctx.restore(); }
    ctx.restore();
    ctx.save();
    ctx.translate(px * .53, px * .56 + Math.sin(time * 2) * 6);
    ctx.scale(3.0 * lerp(1, 1.25, baby), 3.0 * lerp(1, 1.25, baby));
    if (baby) ctx.translate(0, 8);
    Sprites.drawAlicorn(ctx, { s: 1, look: l, baby, time, walk: 0, open: .35 + .25 * Math.sin(time * 1.5), flap: time * 2, blink: (time % 4) > 3.8 ? 1 : 0, mouth: 0 });
    ctx.restore();
    ctx.font = `900 34px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = '#3a2a55';
    ctx.strokeText(l.name, px / 2, px * .12); ctx.fillText(l.name, px / 2, px * .12);
  }

  function init() {
    $('creatorRandom').addEventListener('click', () => { AudioFX.click(); random(); Voice.say(look.name + '!', { interrupt: true, force: true }); });
    $('creatorDone').addEventListener('click', () => { const v = $('nameInput').value.trim(); if (v) look.name = v.slice(0, 14); close(); AudioFX.buy(); if (onDone) onDone(look); });
    $('creatorClose').addEventListener('click', () => { close(); if (onDone) onDone(look); });
  }
  return { init, open, close, isOpen, drawPreview };
})();

/* ---------- the wardrobe ---------- */
const Wardrobe = (function () {
  const $ = (id) => document.getElementById(id);
  let G = null, raf = 0, t = 0;

  function open(game) {
    G = game;
    build();
    $('wardrobe').hidden = false;
    animate();
  }
  function close() { $('wardrobe').hidden = true; cancelAnimationFrame(raf); raf = 0; }
  function isOpen() { return !$('wardrobe').hidden; }

  function build() {
    const look = G.player.look;
    look.owned = look.owned || []; look.wear = look.wear || [];
    $('wardrobeStars').textContent = `⭐ ${G.stars}`;
    const grid = $('wardrobeGrid'); grid.innerHTML = '';
    const simple = G.settings.reading === 'simple';
    for (const a of ACCESSORIES) {
      const owned = look.owned.includes(a.key), worn = look.wear.includes(a.key);
      const item = document.createElement('div'); item.className = 'wardrobe-item' + (worn ? ' on' : '') + (!owned && a.quest ? ' locked' : '');
      item.appendChild(Sprites.iconEl(a.key, look, 76, 'acc|' + look.body + '|' + look.mane.join(',') + '|' + look.horn));
      const name = document.createElement('span'); name.textContent = simple ? a.simple : a.name; item.appendChild(name);
      const price = document.createElement('span'); price.className = 'price';
      const btn = document.createElement('button'); btn.className = 'btn';
      if (owned) { price.textContent = worn ? 'Wearing it!' : 'Mine'; btn.textContent = worn ? 'Take off' : 'Wear'; btn.classList.toggle('off', worn); btn.addEventListener('click', (e) => { e.stopPropagation(); toggleWear(a.key); }); item.addEventListener('click', () => toggleWear(a.key)); }
      else if (a.quest) { const q = QUESTS.find(q => q.key === a.quest); price.textContent = 'Quest prize'; price.classList.add('no'); btn.textContent = '🔒'; btn.disabled = true; item.addEventListener('click', () => Voice.say(`${a.name} is a prize for the quest: ${q ? q.title : ''}.`, { interrupt: true, force: true })); }
      else { price.textContent = `⭐ ${a.cost}`; if (G.stars < a.cost) price.classList.add('no'); btn.textContent = 'Buy'; btn.disabled = G.stars < a.cost; btn.addEventListener('click', (e) => { e.stopPropagation(); buy(a); }); item.addEventListener('click', () => { if (G.stars >= a.cost) buy(a); else Voice.say(simple ? `You need ${a.cost} stars for that.` : `${a.name} costs ${a.cost} stars. You have ${G.stars}.`, { interrupt: true, force: true }); }); }
      item.appendChild(price); item.appendChild(btn);
      grid.appendChild(item);
    }
  }
  function buy(a) {
    const look = G.player.look;
    if (G.stars < a.cost) return;
    G.stars -= a.cost; look.owned.push(a.key);
    AudioFX.buy(); Voice.say(`You got the ${a.name}!`, { interrupt: true, force: true });
    toggleWear(a.key, true);
  }
  function toggleWear(key, on) {
    const look = G.player.look;
    const a = ACCESSORIES.find(x => x.key === key);
    const wearing = look.wear.includes(key);
    if (on === undefined) on = !wearing;
    if (on) {
      /* one thing per slot, except magic */
      look.wear = look.wear.filter(k => { const b = ACCESSORIES.find(x => x.key === k); return !b || b.slot !== a.slot || a.slot === 'magic'; });
      look.wear.push(key);
    } else look.wear = look.wear.filter(k => k !== key);
    Bus.emit('wear', look.wear.length);
    AudioFX.click();
    Sprites.clearIcons();
    build();
    Bus.emit('lookChanged');
  }
  function animate() {
    cancelAnimationFrame(raf);
    const c = $('wardrobeCanvas');
    const step = () => { raf = requestAnimationFrame(step); t += 1 / 60; Creator.drawPreview(c, G.player.look, t); };
    step();
  }
  function init() { $('wardrobeClose').addEventListener('click', close); }
  return { init, open, close, isOpen, build };
})();
