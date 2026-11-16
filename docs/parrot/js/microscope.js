/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg, a chick,
   the head and beak, a wing, the whole bird.  Tap a label and it
   is read aloud.  "Look inside" opens the egg.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'adult', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const simple = () => G_ref && G_ref.settings.reading === 'simple';
  /* parts: x,y in the drawing's own units (× k) */
  const PARTS = {
    egg: { k: 1, draw: (c) => { c.fillStyle = '#8a6a44'; c.beginPath(); c.ellipse(0, 130, 170, 30, 0, 0, TAU); c.fill(); Sprites.drawEgg(c, 104); if (cutaway) { c.save(); c.globalAlpha = .92; c.translate(-14, 60); c.rotate(-.5); Sprites.drawChick(c, { r: 46, instar: 0 }); c.restore(); } }, parts: [
      { x: -60, y: -80, name: 'White shell', say: 'A macaw egg is plain white. Eggs laid in a dark hole do not need colours to hide them.', simple: 'A white egg.' },
      { x: 70, y: 40, name: 'A little smaller than a hen egg', say: 'A scarlet macaw egg is a little under five centimetres long, a little smaller than a hen egg.', simple: 'A bit smaller than a hen egg.' },
      { x: 0, y: 132, name: 'Wood chips', say: 'There is no nest of twigs. The eggs lie on a bed of wood chips at the bottom of the hollow.', simple: 'A bed of wood chips.' },
      { x: 20, y: 0, name: 'Chick', say: 'The chick grows inside for about three and a half weeks, kept warm by its mother.', simple: 'A chick is inside!', needs: 'cutaway' }
    ] },
    chick: { k: .8, shift: -10, draw: (c) => { c.translate(-10, 100); Sprites.drawChick(c, { r: 72, instar: 1 }); }, parts: [
      { x: 110, y: -40, name: 'Big beak', say: 'Even a new chick has a hooked beak. It opens it wide to be fed.', simple: 'A big beak, open wide.' },
      { x: 66, y: -30, name: 'Eyes', say: 'The eyes are shut at first. They open after about two weeks.', simple: 'The eyes open after two weeks.' },
      { x: -40, y: 40, name: 'Pin feathers', say: 'New feathers grow rolled up in thin tubes, like pins. The tubes flake off and the feathers open.', simple: 'New feathers look like pins.' },
      { x: -90, y: 20, name: 'Wing', say: 'This stub will be a wing as long as your arm.', simple: 'This will be a big wing.' },
      { x: 10, y: 90, name: 'Crop', say: 'Food is stored in a pouch called the crop before it goes down to the stomach. On a bare chick you can see it bulge.', simple: 'Food goes in a pouch.' }
    ] },
    head: { k: .82, shift: -20, draw: (c) => { c.translate(-34, 8); Sprites.head(c, 124, PAL.scarlet, {}); }, parts: [
      { x: 150, y: -20, name: 'Top beak', say: 'The top half of the beak is hinged where it joins the skull, so it can move up as well as down.', simple: 'The top beak can move.' },
      { x: 60, y: 120, name: 'Bottom beak', say: 'The bottom half is short and dark. It slides against the top like a chisel on a block.', simple: 'The bottom beak is dark.' },
      { x: 20, y: 30, name: 'Bare face', say: 'The white skin of the face is nearly bare. It has only a few tiny white feathers.', simple: 'A white face with no feathers.' },
      { x: 6, y: -16, name: 'Eye', say: 'A grown scarlet macaw has pale yellow eyes. A young one has dark eyes.', simple: 'A pale yellow eye.' },
      { x: -110, y: -40, name: 'Red feathers', say: 'The red comes from colours that only parrots make. Scientists named them after parrots: psittacofulvins.', simple: 'Only parrots make this red.' }
    ] },
    wing: { k: .84, shift: 10, draw: (c) => { c.translate(50, 94); Sprites.wing(c, 4.5, .72, PAL.scarlet); }, parts: [
      { x: 60, y: 70, name: 'Shoulder', say: 'The feathers nearest the body are red.', simple: 'Red by the body.' },
      { x: 10, y: -10, name: 'Yellow band', say: 'A band of yellow feathers, often tipped with green. It is how you tell a scarlet macaw from a red-and-green macaw.', simple: 'Then a yellow band.' },
      { x: -70, y: -110, name: 'Flight feathers', say: 'The long, stiff feathers at the end of the wing are blue. They push against the air.', simple: 'Long blue feathers to fly.' },
      { x: 90, y: -40, name: 'Leading edge', say: 'The front edge of the wing is smooth and strong. It cuts through the air.', simple: 'The front of the wing.' }
    ] },
    adult: { k: .88, shift: 0, draw: (c) => { c.translate(12, 84); c.scale(3.7, 3.7); Sprites.drawParrot(c, { r: 16 }); }, parts: [
      { x: 60, y: -80, name: 'Beak', say: 'Strong enough to crack a palm nut, and gentle enough to preen a chick.', simple: 'A very strong beak.' },
      { x: -30, y: -20, name: 'Wing', say: 'Red, then yellow, then blue. With its wings spread, a scarlet macaw is about a metre wide.', simple: 'Red, yellow and blue.' },
      { x: 10, y: 60, name: 'Foot', say: 'Two toes point forward and two point back. It can grip a branch, or hold food like a hand.', simple: 'Two toes front, two toes back.' },
      { x: -70, y: 170, name: 'Tail', say: 'The tail is up to half the length of the whole bird.', simple: 'A very long tail.' },
      { x: 20, y: -30, name: 'Crop', say: 'Under the feathers of the chest is the crop, a pouch for carrying food home.', simple: 'A pouch for food.' }
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
    else { const p = G.players[0]; subject = !p || p.stage === 'adult' ? 'adult' : p.stage === 'egg' ? 'egg' : p.stage === 'chick' ? 'chick' : 'wing'; }
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
    $('scopeCut').textContent = cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render };
})();
