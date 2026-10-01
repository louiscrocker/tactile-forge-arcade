/* ============================================================
   care.js — looking after the foal, decorating the stable,
             and the hair salon
   ============================================================
   Care: feed (apples), brush (drag across her — or tap left and
   right — until she sparkles), play, hug, dress up, and "come
   with me" / "stay home".  Every bit of care helps her grow.
   Home: paint, roof and decorations for the stable.
   Salon: mane and tail styles and colours.
   ============================================================ */
'use strict';

const FOAL_WEAR = ['bow', 'flowercrown', 'scarf', 'bell', 'blanket', 'boots'];

const Care = (function () {
  const $ = (id) => document.getElementById(id);
  let G = null, raf = 0, t = 0, mode = 'idle', strokes = 0, lastPX = null, brushX = 0, brushY = 0, appleAnim = 0, hugAnim = 0;
  const simple = () => G.settings.reading === 'simple';
  const foal = () => G.foal;

  function init(game) {
    G = game;
    $('careClose').addEventListener('click', close);
    $('careFeed').addEventListener('click', feed);
    $('careBrush').addEventListener('click', () => { mode = 'brush'; strokes = 0; say(simple() ? 'Rub her all over to make her shiny!' : 'Drag across her to brush her until she sparkles!'); refresh(); });
    $('carePlay').addEventListener('click', () => { foal().play(); AudioFX.giggle(); close(); if (typeof UI !== 'undefined') UI.hint(simple() ? `${foal().name} is playing!` : `${foal().name} is skipping and playing!`); });
    $('careHug').addEventListener('click', () => { foal().hug(); hugAnim = 1.5; AudioFX.giggle(); say(pick(['Aww!', 'A big hug!', 'She loves you!'])); refresh(); });
    $('careFollow').addEventListener('click', () => { const f = foal(); if (f.state === 'follow') { f.goHome(true); say(simple() ? `${f.name} will stay at home.` : `${f.name} will wait for you at the stable.`); } else { f.follow(G.player); if (f.state === 'home') f.state = 'follow'; say(simple() ? `${f.name} is coming with you!` : `${f.name} will follow you!`); } refresh(); });
    $('careHome').addEventListener('click', () => { close(); HomeUI.open(G); });
    $('careDress').addEventListener('click', () => { mode = mode === 'dress' ? 'idle' : 'dress'; refresh(); });
    const c = $('careCanvas');
    c.addEventListener('pointerdown', (e) => { lastPX = [e.offsetX, e.offsetY]; if (mode !== 'brush') { if (overFoal(e)) { foal().hug(); hugAnim = 1.2; AudioFX.giggle(); } } });
    c.addEventListener('pointermove', (e) => { brushX = e.offsetX; brushY = e.offsetY; if (mode === 'brush' && (e.buttons || e.pointerType === 'touch') && lastPX) { const d = Math.hypot(e.offsetX - lastPX[0], e.offsetY - lastPX[1]); if (d > 14 && overFoal(e)) { stroke(); lastPX = [e.offsetX, e.offsetY]; } } });
    c.addEventListener('pointerup', () => { lastPX = null; });
    addEventListener('keydown', (e) => { if (!isOpen() || mode !== 'brush') return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') { stroke(); e.preventDefault(); } });
  }
  function overFoal(e) { const c = $('careCanvas'), r = c.getBoundingClientRect(); const x = e.offsetX / r.width, y = e.offsetY / r.height; return x > .15 && x < .9 && y > .2 && y < .85; }
  function say(txt) { Voice.say(txt, { interrupt: true, force: true }); $('careTip').textContent = txt; }

  function stroke() {
    strokes++;
    AudioFX.brush && AudioFX.brush();
    if (strokes === 18) { foal().brushed(); mode = 'idle'; say(simple() ? 'So shiny! She loves it!' : `${foal().name} is all shiny and happy!`); Bus.emit('fact', 'brush'); refresh(); }
  }
  function feed() {
    const f = foal();
    if (G.apples <= 0) { say(simple() ? 'No apples! Shake the apple trees with magic.' : 'You have no apples. Shake the apple trees by the stable with your magic!'); return; }
    f.feed(); appleAnim = 1.2; AudioFX.munch && AudioFX.munch();
    say(pick(simple() ? ['Yum yum!', 'Crunch crunch!', 'She loves apples!'] : ['Crunch, crunch! Delicious!', 'Yum! Apples are her favourite.', 'Munch munch!']));
    Bus.emit('fact', 'foal');
    refresh();
  }

  function open(game) {
    G = game || G;
    const f = foal();
    if (!f || !f.adopted) return;
    mode = 'idle'; strokes = 0;
    refresh();
    $('care').hidden = false;
    AudioFX.foalNicker && AudioFX.foalNicker(f.babyK);
    say(simple() ? `Hi ${f.name}! What shall we do?` : `${f.name} is so happy to see you! What shall we do?`);
    cancelAnimationFrame(raf); const step = () => { raf = requestAnimationFrame(step); t += 1 / 60; draw(); }; step();
  }
  function close() { $('care').hidden = true; cancelAnimationFrame(raf); mode = 'idle'; }
  function isOpen() { return !$('care').hidden; }

  function refresh() {
    const f = foal();
    $('careName').textContent = f.name;
    $('careStage').textContent = ['Baby', 'Young', 'Grown up'][f.stage];
    const next = FOAL_GROW[Math.min(2, f.stage + 1)], prev = FOAL_GROW[f.stage];
    $('careGrow').style.width = f.stage >= 2 ? '100%' : (clamp((f.care - prev) / (next - prev), 0, 1) * 100) + '%';
    $('careGrowText').textContent = f.stage >= 2 ? (simple() ? 'All grown up!' : 'All grown up — she can fly!') : (simple() ? 'Growing…' : `Growing: ${Math.floor(f.care - prev)} / ${next - prev} ♥`);
    $('needFull').style.width = (f.full * 100) + '%'; $('needShiny').style.width = (f.shiny * 100) + '%'; $('needFun').style.width = (f.fun * 100) + '%';
    $('careFeed').querySelector('small').textContent = `🍎 ${G.apples}`;
    $('careFollow').querySelector('span').textContent = f.state === 'follow' ? (simple() ? 'Stay home' : 'Stay at home') : (simple() ? 'Come with me!' : 'Come with me!');
    $('careBrush').classList.toggle('on', mode === 'brush');
    $('careDress').classList.toggle('on', mode === 'dress');
    const dg = $('careWear'); dg.hidden = mode !== 'dress';
    if (mode === 'dress') {
      dg.innerHTML = '';
      for (const k of FOAL_WEAR) {
        const a = ACCESSORIES.find(x => x.key === k);
        const b = document.createElement('button'); b.className = 'chip' + ((f.look.wear || []).includes(k) ? ' on' : '');
        b.textContent = simple() ? a.simple : a.name;
        b.addEventListener('click', () => { f.look.wear = f.look.wear || []; if (f.look.wear.includes(k)) f.look.wear = f.look.wear.filter(x => x !== k); else { f.look.wear = f.look.wear.filter(x => { const y = ACCESSORIES.find(q => q.key === x); return !y || y.slot !== a.slot; }); f.look.wear.push(k); } AudioFX.click(); Bus.emit('foalDressed', f); refresh(); });
        dg.appendChild(b);
      }
    }
  }

  function draw() {
    const c = $('careCanvas'); const f = foal();
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(200, r.width | 0), h = Math.max(200, r.height | 0);
    if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* inside the stable: wooden wall, hay, a heart window */
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffe9d6'); g.addColorStop(1, '#f6d2b0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(160,110,70,.12)'; for (let x = 0; x < w; x += 34) ctx.fillRect(x, 0, 3, h * .75);
    ctx.fillStyle = '#8fd0ff'; heartPath(ctx, w * .82, h * .2, 22); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#f0c85a'; ctx.beginPath(); ctx.ellipse(w / 2, h * .9, w * .55, h * .14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0b040'; ctx.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = (i * 37) % w; ctx.beginPath(); ctx.moveTo(x, h * .82 + (i % 3) * 6); ctx.lineTo(x + 8, h * .8 + (i % 4) * 5); ctx.stroke(); }
    /* the foal */
    const sc = Math.min(w, h) / 175 * lerp(1.05, 1.3, f.babyK);
    ctx.save(); ctx.translate(w * .44, h * .6 + Math.sin(t * 2) * 2 - (hugAnim > 0 ? Math.abs(Math.sin(t * 8)) * 8 : 0)); ctx.scale(sc, sc);
    Sprites.drawAlicorn(ctx, { s: 1, look: f.look, baby: f.babyK, time: t, blink: (t % 3.5) > 3.35 ? 1 : 0, mouth: appleAnim > 0 ? .6 + .4 * Math.sin(t * 20) : hugAnim > 0 ? .5 : 0, walk: 0 });
    ctx.restore();
    /* sparkle overlay grows with shininess while brushing */
    if (mode === 'brush') {
      const k = strokes / 18;
      for (let i = 0; i < 18 * k; i++) { const a = i * 2.4 + t; const x = w * .46 + Math.cos(a) * w * .22 * ((i % 5) / 5 + .4), y = h * .5 + Math.sin(a * 1.3) * h * .16; ctx.fillStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(t * 5 + i)})`; starPath(ctx, x, y, 4 + (i % 3) * 2); ctx.fill(); }
      /* the brush follows the pointer */
      ctx.save(); ctx.translate(brushX || w * .6, brushY || h * .45); ctx.rotate(-.6);
      ctx.fillStyle = '#c9a5ff'; rr(ctx, -22, -8, 44, 16, 6); ctx.fill(); ctx.fillStyle = '#9b6cff'; for (let i = 0; i < 9; i++) ctx.fillRect(-20 + i * 4.8, 8, 2.4, 12);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(ctx, 12, 12, 150, 30, 15); ctx.fill(); ctx.fillStyle = '#9b6cff'; rr(ctx, 16, 16, 142 * k, 22, 11); ctx.fill();
    }
    if (appleAnim > 0) { appleAnim -= 1 / 60; const k = 1 - appleAnim / 1.2; ctx.save(); ctx.translate(lerp(w * .9, w * .62, Math.min(1, k * 2)), lerp(h * .2, h * .42, Math.min(1, k * 2))); ctx.scale(2, 2); if (k < .5) Sprites.drawApple(ctx, 8); ctx.restore(); }
    if (hugAnim > 0) { hugAnim -= 1 / 60; for (let i = 0; i < 5; i++) { ctx.fillStyle = '#ff6fa8'; ctx.globalAlpha = hugAnim / 1.5; heartPath(ctx, w * .3 + i * w * .1, h * .3 - (1.5 - hugAnim) * 60 - (i % 2) * 20, 10); ctx.fill(); } ctx.globalAlpha = 1; }
  }
  return { init, open, close, isOpen, refresh };
})();

/* ---------- decorating the stable ---------- */
const HomeUI = (function () {
  const $ = (id) => document.getElementById(id);
  let G = null, raf = 0, t = 0;
  const simple = () => G.settings.reading === 'simple';
  function init(game) { G = game; $('homeClose').addEventListener('click', close); }
  function open(game) {
    G = game || G; build(); $('home').hidden = false;
    cancelAnimationFrame(raf); const step = () => { raf = requestAnimationFrame(step); t += 1 / 60; draw(); }; step();
  }
  function close() { $('home').hidden = true; cancelAnimationFrame(raf); }
  function isOpen() { return !$('home').hidden; }
  function build() {
    const H = G.home;
    $('homeStars').textContent = `⭐ ${G.stars}`;
    const sw = (id, list, get, set) => { const el = $(id); el.innerHTML = ''; for (const c of list) { const b = document.createElement('button'); b.className = 'swatch' + (get() === c.key ? ' on' : ''); b.style.background = c.hex; b.title = c.name; b.addEventListener('click', () => { set(c.key); AudioFX.click(); Voice.say(c.name, { interrupt: true }); build(); }); el.appendChild(b); } };
    sw('homePaint', HOME_PAINTS, () => H.paint, k => H.paint = k);
    sw('homeRoof', HOME_ROOFS, () => H.roof, k => H.roof = k);
    const grid = $('homeItems'); grid.innerHTML = '';
    H.owned = H.owned || H.items.slice();
    for (const it of HOME_ITEMS) {
      const owned = H.owned.includes(it.key), on = H.items.includes(it.key);
      const d = document.createElement('div'); d.className = 'wardrobe-item' + (on ? ' on' : '');
      const nm = document.createElement('span'); nm.textContent = simple() ? it.simple : it.name; d.appendChild(nm);
      const pr = document.createElement('span'); pr.className = 'price'; pr.textContent = owned ? (on ? 'On my stable!' : 'Mine') : `⭐ ${it.cost}`; if (!owned && G.stars < it.cost) pr.classList.add('no'); d.appendChild(pr);
      const b = document.createElement('button'); b.className = 'btn' + (on ? ' off' : '');
      b.textContent = owned ? (on ? 'Take down' : 'Put up') : 'Buy'; b.disabled = !owned && G.stars < it.cost;
      b.addEventListener('click', () => {
        if (!owned) { if (G.stars < it.cost) return; G.stars -= it.cost; H.owned.push(it.key); H.items.push(it.key); AudioFX.buy(); Voice.say(`${it.name}!`, { interrupt: true, force: true }); Bus.emit('homeItem', H.items.length); }
        else { if (on) H.items = H.items.filter(k => k !== it.key); else H.items.push(it.key); AudioFX.click(); }
        build();
      });
      d.appendChild(b); grid.appendChild(d);
    }
  }
  function draw() {
    const c = $('homeCanvas'); const r = c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(200, r.width | 0), h = Math.max(200, r.height | 0);
    if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe3ff'); g.addColorStop(.75, '#e6f5ff'); g.addColorStop(.76, '#8fd06a'); g.addColorStop(1, '#6fb84a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h * .8); const s = Math.min(w / 520, h / 360); ctx.scale(s, s);
    Sprites.drawStable(ctx, G.home, t, 0, G.foal.adopted ? G.foal.name : '');
    ctx.save(); ctx.translate(150, 0); ctx.scale(-1, 1); Sprites.drawAlicorn(ctx, { s: G.foal.size, look: G.foal.look, baby: G.foal.babyK, time: t }); ctx.restore();
    ctx.restore();
  }
  return { init, open, close, isOpen };
})();

/* ---------- the hair salon ---------- */
const Salon = (function () {
  const $ = (id) => document.getElementById(id);
  let G = null, raf = 0, t = 0, who = 'me';
  const simple = () => G.settings.reading === 'simple';
  const look = () => who === 'foal' && G.foal && G.foal.adopted ? G.foal.look : G.player.look;
  function init(game) {
    G = game;
    $('salonClose').addEventListener('click', close);
    $('salonWho').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { who = b.dataset.who; AudioFX.click(); build(); }));
  }
  function open(game) {
    G = game || G; who = 'me'; build(); $('salon').hidden = false;
    Voice.say(simple() ? 'Welcome to the salon! Pick a new hairstyle.' : 'Welcome to the salon! Choose a mane style, a tail style and colours.', { interrupt: true, force: true });
    cancelAnimationFrame(raf); const step = () => { raf = requestAnimationFrame(step); t += 1 / 60; Creator.drawPreview($('salonCanvas'), look(), t, who === 'foal' ? G.foal.babyK : 0); }; step();
  }
  function close() { $('salon').hidden = true; cancelAnimationFrame(raf); Sprites.clearIcons(); Bus.emit('lookChanged'); }
  function isOpen() { return !$('salon').hidden; }
  function build() {
    const L = look();
    $('salonWho').hidden = !(G.foal && G.foal.adopted);
    $('salonWho').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.who === who); if (b.dataset.who === 'foal' && G.foal) b.textContent = G.foal.name; if (b.dataset.who === 'me') b.textContent = G.player.look.name; });
    const styles = (id, list, prefix, get, set) => {
      const el = $(id); el.innerHTML = '';
      for (const st of list) {
        const b = document.createElement('button'); b.classList.toggle('on', get() === st.key);
        b.appendChild(Sprites.iconEl(prefix + st.key, L, 64, 'salon|' + prefix + st.key + '|' + L.body + '|' + (L.mane || []).join(',')));
        const s = document.createElement('span'); s.textContent = st.name; b.appendChild(s);
        b.addEventListener('click', () => { set(st.key); AudioFX.brush ? AudioFX.brush() : AudioFX.click(); Voice.say(st.name, { interrupt: true }); Bus.emit('salon', st.key); build(); });
        el.appendChild(b);
      }
    };
    styles('salonMane', MANE_STYLES, 'mane-', () => L.maneStyle || 'flowing', k => L.maneStyle = k);
    styles('salonTail', TAIL_STYLES, 'tail-', () => L.tailStyle || 'flowing', k => L.tailStyle = k);
    const el = $('salonColours'); el.innerHTML = '';
    const unlocked = (k) => (G.player.look.unlocked || []).includes('mane:' + k);
    for (const c of MANE_COLORS) {
      const b = document.createElement('button'); b.className = 'swatch' + (c.hex === 'rainbow' ? ' rainbow' : ''); if (c.hex !== 'rainbow') b.style.background = c.hex;
      const locked = c.locked && !unlocked(c.key); if (locked) b.classList.add('locked');
      b.classList.toggle('on', (L.mane || []).includes(c.key));
      b.addEventListener('click', () => { if (locked) { Voice.say('That one is a prize for a quest!', { interrupt: true, force: true }); return; } if (L.mane.includes(c.key)) { if (L.mane.length > 1) L.mane = L.mane.filter(m => m !== c.key); } else { L.mane.push(c.key); if (L.mane.length > 2) L.mane.shift(); } AudioFX.click(); build(); });
      el.appendChild(b);
    }
  }
  return { init, open, close, isOpen };
})();
