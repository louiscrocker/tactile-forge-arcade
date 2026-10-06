/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg, the
   zoea, the megalopa, a boy crab, a girl crab.  Tap a label and
   it is read aloud.  "Look inside" shows the baby inside the egg,
   the zoea's gut full of green plankton, a crab's gills under its
   shell, and a mother's eggs under her tummy flap.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'red';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  function gills(c, k) {
    /* the gill chambers each side, under a see-through shell */
    for (const side of [-1, 1]) {
      c.save(); c.translate(side * 30 * k, -8 * k);
      c.fillStyle = 'rgba(255,220,200,.35)'; c.beginPath(); c.ellipse(0, 0, 16 * k, 14 * k, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(230,120,120,.9)'; c.lineWidth = 1.2;
      for (let j = 0; j < 7; j++) { const y = (-10 + j * 3.3) * k; c.beginPath(); c.moveTo(-side * 12 * k, y); for (let x = 0; x <= 24; x += 3) c.lineTo(-side * 12 * k + side * x * k, y + Math.sin(x * .9) * 1.4 * k); c.stroke(); }
      c.restore();
    }
  }
  const PARTS = {
    egg: { k: 60, draw: (c) => { Sprites.drawEgg(c, { s: 60, eye: cutaway }); if (cutaway) { c.strokeStyle = 'rgba(255,220,200,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(-6, 6, 26, -.5, 2.6); c.stroke(); } }, parts: [
      { x: -.6, y: -.6, name: 'Egg', say: 'A red crab egg is dark and round, less than a millimetre across. A mother can carry 100,000 of them.', simple: 'A tiny dark egg. Mum has lots and lots!' },
      { x: .6, y: .5, name: 'Sticky glue', say: 'The eggs are glued to little hairs under the mother\'s tummy flap until she shakes them into the sea.', simple: 'Stuck under Mum\'s tummy.' },
      { x: .3, y: -.1, name: 'Eye spot', say: 'Inside, a zoea is ready to hatch. You can see its dark eye. It hatches the moment the egg touches the sea.', simple: 'A baby zoea is inside. See its eye?', needs: 'cutaway' }
    ] },
    zoea: { k: 17, shift: 30, draw: (c) => { Sprites.drawZoea(c, { s: 17, ph: .8, form: form(), instar: 3 }); if (cutaway) { c.fillStyle = 'rgba(80,200,60,.55)'; c.beginPath(); c.ellipse(-17, 7, 30, 16, .3, 0, TAU); c.fill(); for (let k = 0; k < 9; k++) { c.fillStyle = '#9ae070'; c.beginPath(); c.arc(-30 + k * 6, 4 + Math.sin(k) * 6, 3, 0, TAU); c.fill(); } } }, parts: [
      { x: 2.6, y: -.9, name: 'Huge eye', say: 'A zoea has two huge eyes for its size, to see food and danger in the sea.', simple: 'Huge eyes!' },
      { x: -2.6, y: -12, name: 'Top spike', say: 'A long spike on top. Spikes make a zoea hard for little fish to swallow, and help it float.', simple: 'A long spike on top.' },
      { x: 5, y: 8.2, name: 'Front spike', say: 'Another spike points down at the front.', simple: 'A spike at the front too.' },
      { x: -1.4, y: 1.8, name: 'See-through body', say: 'The body is almost clear, so it is hard to spot in the water. The red dots are colour cells.', simple: 'You can see through it!' },
      { x: -.4, y: 7, name: 'Swimming legs', say: 'Feathery legs beat like oars to swim.', simple: 'Feathery legs for swimming.' },
      { x: -10, y: 8.5, name: 'Tail', say: 'The tail flicks to dash away.', simple: 'Flick! The tail helps it dash.' },
      { x: -1, y: .4, name: 'Full tummy', say: 'Its gut is green with the plankton it has eaten.', simple: 'Its tummy is full of green plankton.', needs: 'cutaway' }
    ] },
    megalopa: { k: 15, shift: 40, draw: (c) => Sprites.drawMegalopa(c, { s: 15, ph: .8, form: form() }), parts: [
      { x: 7.6, y: -3, name: 'Eyes on stalks', say: 'Now its eyes are on stalks, like a crab\'s.', simple: 'Eyes on stalks!' },
      { x: 9.4, y: 3, name: 'Little claws', say: 'Its first little claws.', simple: 'Little claws!' },
      { x: 2, y: 5.4, name: 'Walking legs', say: 'Eight walking legs, folded up while it swims.', simple: 'Legs for walking.' },
      { x: -7, y: 4.6, name: 'Swimmerets', say: 'Little paddles under the tail beat to swim.', simple: 'Paddles for swimming.' },
      { x: -14.6, y: 2, name: 'Tail fan', say: 'A tail fan. Once it is a crab, the tail tucks up under the body for ever.', simple: 'A tail fan.' }
    ] },
    boy: { k: 2.1, draw: (c) => { Sprites.drawCrab(c, { s: 2.1, form: form(), sex: 'boy', seed: 3 }); if (cutaway) { c.save(); c.scale(2.1, 2.1); c.fillStyle = 'rgba(255,240,230,.55)'; c.beginPath(); c.ellipse(0, -8, 48, 24, 0, 0, TAU); c.fill(); gills(c, 1); c.restore(); } }, parts: [
      { x: 0, y: -24, name: 'Shell', say: 'The hard shell on top is the carapace. It can not grow, so the crab moults to get bigger.', simple: 'A hard shell. It moults to grow.' },
      { x: 16, y: -2, name: 'Eyes on stalks', say: 'The eyes are on stalks and can fold down into grooves to stay safe.', simple: 'Eyes on stalks. They fold down!' },
      { x: 24, y: 32, name: 'Big claw', say: 'Boys have bigger claws than girls. They use them to push rivals away from their burrows.', simple: 'Boys have big claws for pushing.' },
      { x: 0, y: 20, name: 'Mouth', say: 'Mouthparts work like little plates to shred leaves, flowers and fruit.', simple: 'A mouth for munching leaves.' },
      { x: 84, y: 28, name: 'Walking legs', say: 'Eight walking legs, four each side. Crabs walk sideways because their legs bend best that way.', simple: 'Eight legs. Crabs walk sideways!' },
      { x: -92, y: 42, name: 'Sharp tips', say: 'Sharp leg tips grip rock and bark, so red crabs can climb cliffs.', simple: 'Sharp tips for climbing.' },
      { x: 30, y: -8, name: 'Gills', say: 'Under the shell are the gills. A land crab keeps them damp to breathe, so it hides from the hot sun.', simple: 'Gills! They must stay damp.', needs: 'cutaway' }
    ] },
    girl: { k: 2.1, draw: (c) => Sprites.drawCrab(c, { s: 2.1, form: form(), sex: 'girl', eggs: cutaway ? 1 : 0, seed: 5 }), parts: [
      { x: 18, y: 30, name: 'Smaller claws', say: 'Girls have smaller claws than boys.', simple: 'Smaller claws.' },
      { x: 0, y: -24, name: 'Smaller shell', say: 'Girl red crabs are a little smaller than boys.', simple: 'A bit smaller than a boy.' },
      { x: -30, y: 30, name: 'Wide tummy flap', say: 'Underneath, a girl has a wide, round tummy flap to hold her eggs. A boy\'s flap is thin.', simple: 'A wide tummy flap for eggs.' },
      { x: 0, y: 36, name: 'Eggs', say: 'She carries up to 100,000 dark eggs under the flap for about twelve days, then shakes them into the sea.', simple: 'Lots and lots of eggs!', needs: 'cutaway' }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.stage === 'egg' ? 'egg' : p.stage === 'zoea' ? 'zoea' : p.stage === 'megalopa' ? 'megalopa' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    const sea = subject === 'zoea' || subject === 'megalopa' || subject === 'egg';
    const g = ctx.createRadialGradient(W * .4, H * .5, 20, W * .4, H * .5, H * .62);
    g.addColorStop(0, sea ? '#eaf8fc' : '#fbf6ec'); g.addColorStop(1, sea ? '#b8dcea' : '#e2d8bf');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .47, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .46, 0, TAU); ctx.clip();
    const def = PARTS[subject];
    ctx.translate(W * .4 + (def.shift || 0), H * .5);
    def.draw(ctx);
    ctx.restore();
    ctx.font = `800 15px ${UI_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const it of layout()) {
      const on = it.i === hover;
      ctx.strokeStyle = on ? '#c0301a' : 'rgba(50,60,70,.6)'; ctx.lineWidth = on ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.lx - 8, it.ly); ctx.stroke();
      ctx.fillStyle = on ? '#c0301a' : '#3a4a5a'; ctx.beginPath(); ctx.arc(it.px, it.py, on ? 6 : 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? '#c0301a' : 'rgba(255,255,255,.92)';
      const w = ctx.measureText(it.part.name).width + 22;
      rr(ctx, it.lx - 6, it.ly - 14, w, 28, 14); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#2a2016'; ctx.fillText(it.part.name, it.lx + 5, it.ly + 1);
    }
    $('scopeCut').hidden = !def.parts.some(p => p.needs === 'cutaway');
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide the eggs' : 'Show her eggs') : cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render };
})();
