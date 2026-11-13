/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg sac, a
   spiderling, a striped young spider, the male, the female.  Tap
   a label and it is read aloud.  "Look inside" opens the egg sac
   and turns the female over to show the hourglass.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'female', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const simple = () => G_ref && G_ref.settings.reading === 'simple';
  const sp = (c, o) => { c.save(); c.rotate(-Math.PI / 2); Sprites.drawSpider(c, Object.assign({ ph: 1 }, o)); c.restore(); };

  /* parts: x,y in the drawing's own units (× k).  The spiders are drawn head up. */
  const PARTS = {
    sac: { k: 1, draw: (c) => { c.strokeStyle = '#cfd8e8'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -200); c.lineTo(0, -92); c.stroke(); Sprites.drawSac(c, 92, { crack: cutaway ? 1 : 0 }); if (cutaway) for (let k = 0; k < 14; k++) { c.save(); c.translate(Math.cos(k * 2.4) * (20 + k * 3.4), Math.sin(k * 2.4) * (18 + k * 3)); c.rotate(k); Sprites.drawSpider(c, { r: 7, instar: 0, ph: k }); c.restore(); } }, parts: [
      { x: 0, y: -140, name: 'Hanging thread', say: 'The sac hangs in the web on strong threads, close to the mother.', simple: 'It hangs in the web.' },
      { x: -70, y: -30, name: 'Silk wall', say: 'The wall of the sac is tough, papery silk. It keeps the eggs dry and safe.', simple: 'A wall of tough silk.' },
      { x: 60, y: 50, name: 'Round as a marble', say: 'A black widow egg sac is round and about as big as a marble.', simple: 'As big as a marble.' },
      { x: 10, y: 10, name: 'Spiderlings', say: 'A few hundred eggs hatch inside. The spiderlings shed their first skin in here before they come out.', simple: 'Lots of tiny spiders inside!', needs: 'cutaway' }
    ] },
    ling: { k: 1, draw: (c) => sp(c, { r: 62, instar: 0 }), parts: [
      { x: 0, y: -40, name: 'Head part', say: 'The front part holds the eyes, the mouth and all eight legs.', simple: 'Eyes, mouth and legs are here.' },
      { x: 0, y: 44, name: 'Abdomen', say: 'The round back part is the abdomen. It is pale now and will darken with each moult.', simple: 'Pale now. Dark later.' },
      { x: 96, y: -70, name: 'Eight legs', say: 'Eight legs: spiders are arachnids, not insects.', simple: 'Eight legs!' },
      { x: 0, y: 100, name: 'Spinnerets', say: 'Silk comes out of the spinnerets at the tip of the abdomen. A spiderling uses its first silk to sail away on the wind.', simple: 'Silk comes out here.' }
    ] },
    young: { k: 1, draw: (c) => sp(c, { r: 66, instar: 2, form: 'girl' }), parts: [
      { x: 30, y: 30, name: 'White stripes', say: 'A young widow has white stripes across its abdomen. They fade as it grows.', simple: 'White stripes.' },
      { x: 0, y: 60, name: 'Orange spots', say: 'A row of orange spots runs down the middle of the back.', simple: 'Orange spots.' },
      { x: 110, y: 40, name: 'Banded legs', say: 'The legs have light and dark bands.', simple: 'Stripy legs.' },
      { x: 0, y: -62, name: 'Palps', say: 'Two little feelers by the mouth are called palps. They taste and hold food.', simple: 'Little feelers by the mouth.' }
    ] },
    male: { k: 1, draw: (c) => sp(c, { r: 44, form: 'boy', adult: true }), parts: [
      { x: 8, y: -52, name: 'Big palps', say: 'A grown male has swollen palps, like a pair of boxing gloves. That is how you can tell he is a male.', simple: 'Big palps, like boxing gloves.' },
      { x: 0, y: 40, name: 'Slim, striped body', say: 'He keeps his stripes for life, and he is far smaller than a female.', simple: 'Small and striped.' },
      { x: 120, y: -80, name: 'Long legs', say: 'His legs are long for his body: good for walking far, and for plucking her web.', simple: 'Long legs for a long walk.' },
      { x: -100, y: 70, name: 'Leg tips', say: 'Fine hairs and slits on the legs feel shakes in the silk and smell the scent on it.', simple: 'His legs feel and smell.' }
    ] },
    female: { k: 1, shift: -10, draw: (c) => sp(c, { r: 62, form: 'girl', adult: true, belly: cutaway }), parts: [
      { x: 0, y: 40, name: 'Glossy abdomen', say: 'A grown female is glossy black. Her round abdomen is as big as a pea.', simple: 'Black and shiny.' },
      { x: 0, y: -30, name: 'Eight eyes', say: 'Eight small eyes in two rows. She sees poorly and finds her way by touch.', simple: 'Eight eyes. She does not see well.' },
      { x: 100, y: 90, name: 'Comb foot', say: 'Each back foot has a row of curved bristles, a comb, for flinging sticky silk. Widows are comb-footed spiders.', simple: 'A comb on her back foot.' },
      { x: 0, y: 106, name: 'Spinnerets', say: 'Silk comes out of the spinnerets as a liquid and sets into thread as she pulls it.', simple: 'Silk comes out here.' },
      { x: -100, y: -70, name: 'Feeling legs', say: 'Tiny slits at her leg joints feel the smallest shake in the web.', simple: 'Her legs feel the web shake.' },
      { x: 0, y: 34, name: 'Red hourglass', say: 'Under her body is a red mark shaped like an hourglass. Scientists think it warns birds to stay away.', simple: 'A red mark. It says: stay away!', needs: 'cutaway' }
    ] }
  };

  function pos(def, part) { return { x: part.x * def.k, y: part.y * def.k }; }
  function init() {
    canvas = $('scopeCanvas'); if (!canvas) return;
    ctx = canvas.getContext('2d');
    $('scopeClose').addEventListener('click', close);
    $('scopeCut').addEventListener('click', () => { cutaway = !cutaway; $('scopeCut').classList.toggle('on', cutaway); render(); });
    document.querySelectorAll('#scopePick button').forEach(b => b.addEventListener('click', () => { subject = b.dataset.subject; cutaway = false; $('scopeCut').classList.remove('on'); document.querySelectorAll('#scopePick button').forEach(x => x.classList.toggle('on', x === b)); render(); }));
    canvas.addEventListener('pointermove', (e) => { hover = hitLabel(e); render(); });
    canvas.addEventListener('pointerdown', (e) => {
      const i = hitLabel(e);
      if (i >= 0) { const part = PARTS[subject].parts[i]; hover = i; render(); $('scopeSay').textContent = simple() ? part.simple : part.say; Voice.say(simple() ? part.simple : part.say, { interrupt: true }); AudioFX.click(); }
    });
  }
  function open(G, what) {
    G_ref = G;
    if (what && PARTS[what]) subject = what;
    else { const p = G.players[0]; subject = !p || p.stage === 'adult' ? (p && p.male ? 'male' : 'female') : p.stage === 'sac' ? 'sac' : p.stage === 'ling' ? 'ling' : 'young'; }
    cutaway = false; $('scopeCut').classList.remove('on');
    document.querySelectorAll('#scopePick button').forEach(x => x.classList.toggle('on', x.dataset.subject === subject));
    $('microscope').hidden = false;
    $('scopeSay').textContent = simple() ? 'Tap a label to hear about it.' : 'Tap a label to hear what it is and what it does.';
    Bus.emit('microscope');
    render();
  }
  function close() { $('microscope').hidden = true; Voice.stop(); }
  function isOpen() { return !$('microscope').hidden; }
  function layout() {
    const def = PARTS[subject], cx = W * .4 + (def.shift || 0), cy = H * .5, items = [];
    def.parts.forEach((part, i) => { if (part.needs === 'cutaway' && !cutaway) return; const q = pos(def, part); items.push({ i, part, px: cx + q.x, py: cy + q.y }); });
    items.sort((a, b) => a.py - b.py);
    const n = items.length, lx = W * .8;
    items.forEach((it, k) => { it.lx = lx; it.ly = H * .1 + (H * .8) * (n === 1 ? .5 : k / (n - 1)); });
    return items;
  }
  function hitLabel(e) {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    const items = layout();
    for (const it of items) if (Math.abs(x - it.lx - 50) < 70 && Math.abs(y - it.ly) < 16) return it.i;
    for (const it of items) if (Math.hypot(x - it.px, y - it.py) < 18) return it.i;
    return -1;
  }
  function render() {
    if (!ctx) return;
    const dpr = 2;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .4, H * .5, 20, W * .4, H * .5, H * .62);
    g.addColorStop(0, '#fbf6ec'); g.addColorStop(1, '#e2d8bf');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .47, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4a6a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .46, 0, TAU); ctx.clip();
    const def = PARTS[subject];
    ctx.translate(W * .4 + (def.shift || 0), H * .5);
    def.draw(ctx);
    ctx.restore();
    ctx.font = `800 15px ${UI_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const it of layout()) {
      const on = it.i === hover;
      ctx.strokeStyle = on ? '#c0501a' : 'rgba(70,80,50,.6)'; ctx.lineWidth = on ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.lx - 8, it.ly); ctx.stroke();
      ctx.fillStyle = on ? '#c0501a' : '#4a5a3a'; ctx.beginPath(); ctx.arc(it.px, it.py, on ? 6 : 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? '#c0501a' : 'rgba(255,255,255,.92)';
      const w = ctx.measureText(it.part.name).width + 22;
      rr(ctx, it.lx - 6, it.ly - 14, w, 28, 14); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#2a2016'; ctx.fillText(it.part.name, it.lx + 5, it.ly + 1);
    }
    $('scopeCut').hidden = !def.parts.some(p => p.needs === 'cutaway');
    $('scopeCut').textContent = subject === 'female' ? (cutaway ? 'Her back' : 'Turn her over') : (cutaway ? 'Outside view' : 'Look inside');
  }
  return { init, open, close, isOpen, render };
})();
