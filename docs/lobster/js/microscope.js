/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg, the
   larva, stage IV, a boy lobster, a girl lobster.  Tap a label and
   it is read aloud.  "Look inside" shows the larva inside the egg,
   the larva's gut full of green plankton, a lobster's gills, heart
   and the teeth in its stomach, and a mother's eggs under her tail.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'normal';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  /* the inside of a lobster, under a see-through carapace (coordinates in body units) */
  function insides(c) {
    c.fillStyle = 'rgba(255,245,235,.55)'; c.beginPath(); c.ellipse(12, -2, 24, 11, 0, 0, TAU); c.fill();
    /* gills: feathery plumes along the side */
    c.strokeStyle = 'rgba(230,140,140,.9)'; c.lineWidth = .6;
    for (let k = 0; k < 7; k++) { const x = -6 + k * 4; c.beginPath(); c.moveTo(x, 6); c.lineTo(x + 1, -4); c.stroke(); for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x + .5, 4 - j * 2.4); c.lineTo(x + 2.2, 3 - j * 2.4); c.stroke(); } }
    /* the heart, and the stomach with its three grinding teeth */
    c.fillStyle = 'rgba(200,220,255,.9)'; c.beginPath(); c.ellipse(2, -8, 4, 2.4, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(240,200,140,.9)'; c.beginPath(); c.ellipse(26, -5, 6, 4.6, 0, 0, TAU); c.fill();
    c.fillStyle = '#8a6a3a'; for (const [x, y] of [[24, -6], [27, -7], [27, -3]]) { c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); }
    /* the blue-ish blood vessel running back */
    c.strokeStyle = 'rgba(140,180,240,.8)'; c.lineWidth = .8; c.beginPath(); c.moveTo(2, -8); c.quadraticCurveTo(-20, -9, -50, -4); c.stroke();
  }
  const PARTS = {
    egg: { k: 60, draw: (c) => { Sprites.drawEgg(c, { s: 60, eye: cutaway }); if (cutaway) { c.strokeStyle = 'rgba(255,220,200,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(-6, 6, 26, -.5, 2.6); c.stroke(); } }, parts: [
      { x: -.6, y: -.6, name: 'Egg', say: 'A lobster egg is dark and round, about a millimetre and a half across. A mother carries thousands of them.', simple: 'A tiny dark egg. Mum has thousands!' },
      { x: .6, y: .5, name: 'Glue', say: 'Each egg is glued to the little paddles under the mother\'s tail, where she fans water over it for nine to twelve months.', simple: 'Stuck under Mum\'s tail.' },
      { x: .3, y: -.1, name: 'Eye spot', say: 'Inside, a larva is growing. You can see its dark eye. The eyes show up months before it hatches.', simple: 'A baby larva is inside. See its eye?', needs: 'cutaway' }
    ] },
    larva: { k: 18, shift: 30, draw: (c) => { Sprites.drawLarva(c, { s: 18, ph: .8, form: form(), instar: 2 }); if (cutaway) { c.fillStyle = 'rgba(80,200,60,.55)'; c.beginPath(); c.ellipse(0, 4, 40, 14, .2, 0, TAU); c.fill(); for (let k = 0; k < 9; k++) { c.fillStyle = '#9ae070'; c.beginPath(); c.arc(-24 + k * 6, 3 + Math.sin(k) * 5, 3, 0, TAU); c.fill(); } } }, parts: [
      { x: 4.2, y: -1.8, name: 'Big eye', say: 'A lobster larva has big eyes for its size, to see the light and the food around it.', simple: 'Big eyes!' },
      { x: 7.2, y: -2.2, name: 'Rostrum', say: 'A long spike points forward from its head: the rostrum.', simple: 'A spike at the front.' },
      { x: -1, y: -5.4, name: 'Spines', say: 'Spines on its back make it harder for little fish to swallow.', simple: 'Spiky back!' },
      { x: -.4, y: 6, name: 'Swimming legs', say: 'Its legs have feathery branches that beat like oars to swim.', simple: 'Feathery legs for swimming.' },
      { x: -13, y: 2, name: 'Tail fan', say: 'A little tail. Snap it and the larva darts away.', simple: 'Snap! The tail helps it dash.' },
      { x: 0, y: .2, name: 'Full tummy', say: 'Its gut is green with the plankton it has eaten.', simple: 'Its tummy is full of green plankton.', needs: 'cutaway' }
    ] },
    postlarva: { k: 2.2, shift: -40, draw: (c) => Sprites.drawLobster(c, { s: 2.2, form: form(), swim: .8, simple: true, seed: 2, up: .15 }), parts: [
      { x: 36, y: -11, name: 'Eyes on stalks', say: 'Now its eyes are on stalks, like a grown lobster\'s.', simple: 'Eyes on stalks!' },
      { x: 78, y: 4, name: 'Little claws', say: 'Stage IV has two little claws. They are the same size for now.', simple: 'Little claws!' },
      { x: 10, y: 18, name: 'Walking legs', say: 'Eight walking legs, tucked up while it swims.', simple: 'Legs for walking.' },
      { x: -24, y: 12, name: 'Swimmerets', say: 'Little paddles under the tail beat fast, so stage IV swims forwards.', simple: 'Paddles for swimming.' },
      { x: -58, y: -2, name: 'Tail fan', say: 'A tail fan. From now on, the tail flip shoots it backwards to escape.', simple: 'A tail fan.' }
    ] },
    boy: { k: 2.1, shift: -40, draw: (c) => { Sprites.drawLobster(c, { s: 2.1, form: form(), sex: 'boy', seed: 3, crusher: 'right', up: .1 }); if (cutaway) { c.save(); c.scale(2.1, 2.1); insides(c); c.restore(); } }, parts: [
      { x: 10, y: -13, name: 'Carapace', say: 'The hard shell over the head and body is the carapace. It can not grow, so the lobster moults to get bigger.', simple: 'A hard shell. It moults to grow.' },
      { x: 42, y: -8, name: 'Rostrum', say: 'The pointed spike between the eyes is the rostrum.', simple: 'A spike between the eyes.' },
      { x: 36, y: -11, name: 'Eyes on stalks', say: 'The eyes are on stalks, made of thousands of tiny square tubes. They see movement in dim light.', simple: 'Eyes on stalks!' },
      { x: 92, y: -30, name: 'Antennae', say: 'Two long antennae feel all around in the dark.', simple: 'Long feelers to feel.' },
      { x: 50, y: -14, name: 'Antennules', say: 'Two short antennules smell the water. A lobster finds its food mostly by smell.', simple: 'Little feelers to smell.' },
      { x: 84, y: 6, name: 'Crusher claw', say: 'The big crusher claw has rounded teeth for breaking shells. Boys have bigger claws than girls.', simple: 'A big crusher claw for shells.' },
      { x: 10, y: 19, name: 'Walking legs', say: 'Eight walking legs. A lobster tastes with tiny hairs on its legs and feet.', simple: 'It tastes with its feet!' },
      { x: -30, y: 0, name: 'Tail', say: 'The big muscle in the tail snaps it under the body for the tail flip, one of the fastest moves in the sea.', simple: 'The tail snaps for a flip.' },
      { x: -60, y: -2, name: 'Tail fan', say: 'The tail fan spreads wide to push the water.', simple: 'A tail fan.' },
      { x: -2, y: 0, name: 'Gills', say: 'Feathery gills along the sides take oxygen from the water.', simple: 'Gills to breathe in water.', needs: 'cutaway' },
      { x: 2, y: -8, name: 'Heart', say: 'The heart pumps clear, blue-ish blood. It carries oxygen with copper instead of iron.', simple: 'Blue-ish blood!', needs: 'cutaway' },
      { x: 26, y: -5, name: 'Stomach teeth', say: 'In the stomach are three grinding teeth, the gastric mill. A lobster chews its food in its tummy.', simple: 'Teeth in its tummy!', needs: 'cutaway' }
    ] },
    girl: { k: 2.1, shift: -40, draw: (c) => Sprites.drawLobster(c, { s: 2.1, form: form(), sex: 'girl', eggs: cutaway ? 1 : 0, seed: 5, crusher: 'right' }), parts: [
      { x: 80, y: 6, name: 'Smaller claws', say: 'Girls have smaller claws than boys of the same size.', simple: 'Smaller claws.' },
      { x: -30, y: -12, name: 'Wider tail', say: 'A girl\'s tail is wider than a boy\'s, to hold her eggs.', simple: 'A wide tail for eggs.' },
      { x: -22, y: 12, name: 'Swimmerets', say: 'She glues her eggs to the swimmerets, the little paddles under her tail, and fans water over them.', simple: 'Paddles to hold the eggs.' },
      { x: -16, y: 16, name: 'Eggs', say: 'She carries thousands of dark eggs under her tail for nine to twelve months. A lobster with eggs is called berried.', simple: 'Thousands of eggs!', needs: 'cutaway' }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.stage === 'egg' ? 'egg' : p.stage === 'larva' ? 'larva' : p.stage === 'postlarva' ? 'postlarva' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    const n = items.length, lx = W * .78;
    items.forEach((it, k) => { it.lx = lx; it.ly = H * .07 + (H * .86) * (n === 1 ? .5 : k / (n - 1)); });
    return items;
  }
  function hitLabel(e) {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    const items = layout();
    for (const it of items) if (Math.abs(x - it.lx - 50) < 70 && Math.abs(y - it.ly) < 15) return it.i;
    for (const it of items) if (Math.hypot(x - it.px, y - it.py) < 18) return it.i;
    return -1;
  }
  function render() {
    if (!ctx) return;
    const dpr = 2;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .4, H * .5, 20, W * .4, H * .5, H * .62);
    g.addColorStop(0, '#eaf8fc'); g.addColorStop(1, '#b0d4e4');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .47, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .46, 0, TAU); ctx.clip();
    const def = PARTS[subject];
    ctx.translate(W * .4 + (def.shift || 0), H * .5);
    def.draw(ctx);
    ctx.restore();
    ctx.font = `800 14px ${UI_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const it of layout()) {
      const on = it.i === hover;
      ctx.strokeStyle = on ? '#c0501a' : 'rgba(50,60,70,.6)'; ctx.lineWidth = on ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.lx - 8, it.ly); ctx.stroke();
      ctx.fillStyle = on ? '#c0501a' : '#3a4a5a'; ctx.beginPath(); ctx.arc(it.px, it.py, on ? 6 : 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? '#c0501a' : 'rgba(255,255,255,.92)';
      const w = ctx.measureText(it.part.name).width + 22;
      rr(ctx, it.lx - 6, it.ly - 13, w, 26, 13); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#2a2016'; ctx.fillText(it.part.name, it.lx + 5, it.ly + 1);
    }
    $('scopeCut').hidden = !def.parts.some(p => p.needs === 'cutaway');
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide the eggs' : 'Show her eggs') : cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render };
})();
