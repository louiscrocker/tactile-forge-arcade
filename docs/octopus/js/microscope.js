/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg, the
   paralarva, the settler, a boy octopus, a girl octopus.  Tap a label
   and it is read aloud.  "Look inside" shows the baby inside the egg,
   the paralarva's gut, an octopus's three hearts, gills, blue blood
   and ink sac, and a mother with her egg strings.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'normal';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  /* the inside of an octopus, under a see-through mantle (coordinates in body units) */
  function insides(c) {
    c.save(); c.translate(-16, -12); c.rotate(-.32);
    c.fillStyle = 'rgba(255,245,235,.5)'; c.beginPath(); c.ellipse(0, 0, 24, 16, 0, 0, TAU); c.fill();
    /* the two feathery gills, one each side */
    c.strokeStyle = 'rgba(230,150,150,.9)'; c.lineWidth = .7;
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) { const x = sx * 9 + k * .8 * sx, y = -6 + k * 2.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * 7, y + 1); c.stroke(); }
    /* three hearts: two small gill hearts and the big one in the middle */
    c.fillStyle = 'rgba(200,215,255,.95)'; for (const [x, y, r] of [[-2, 2, 3.2], [-10, 4, 2], [6, 4, 2]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    /* the ink sac and the stomach */
    c.fillStyle = 'rgba(30,20,40,.9)'; c.beginPath(); c.ellipse(-8, -6, 4, 2.6, .4, 0, TAU); c.fill();
    c.fillStyle = 'rgba(240,200,140,.9)'; c.beginPath(); c.ellipse(8, -5, 5, 3.6, 0, 0, TAU); c.fill();
    /* blue blood vessels */
    c.strokeStyle = 'rgba(100,150,240,.85)'; c.lineWidth = .8; c.beginPath(); c.moveTo(-2, 2); c.quadraticCurveTo(-14, 6, -22, -2); c.moveTo(-2, 2); c.quadraticCurveTo(10, 8, 20, 2); c.stroke();
    c.restore();
  }
  const PARTS = {
    egg: { k: 60, draw: (c) => { Sprites.drawEgg(c, { s: 60, eye: cutaway }); if (cutaway) { c.strokeStyle = 'rgba(200,120,100,.5)'; c.lineWidth = 2; for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(-6, 10); c.lineTo(-6 + Math.cos(k) * 22, 10 + Math.sin(k) * 24); c.stroke(); } } }, parts: [
      { x: -.5, y: -.8, name: 'Egg', say: 'An octopus egg is the size and shape of a grain of rice, pale and see-through. A mother lays about fifty thousand of them.', simple: 'A tiny egg like a grain of rice. Mum has thousands!' },
      { x: .3, y: -1.2, name: 'Stalk', say: 'Each egg has a little stalk, and the mother braids the stalks together into strings that hang from the roof of her den.', simple: 'Hung in strings from the roof of the den.' },
      { x: .2, y: -.3, name: 'Eyes', say: 'Inside, a baby octopus is growing. You can see its two dark eyes. The baby turns round and round inside the egg.', simple: 'A baby octopus is inside. See its eyes?', needs: 'cutaway' },
      { x: -.1, y: .5, name: 'Arms', say: 'Eight tiny arms are curled up inside the egg, ready to jet away the night it hatches.', simple: 'Eight tiny arms, all curled up.', needs: 'cutaway' }
    ] },
    larva: { k: 18, shift: 30, draw: (c) => { Sprites.drawParalarva(c, { s: 18, ph: .8, form: form(), instar: 2 }); if (cutaway) { c.fillStyle = 'rgba(200,120,70,.5)'; c.beginPath(); c.ellipse(0, 4, 36, 14, .2, 0, TAU); c.fill(); for (let k = 0; k < 7; k++) { c.fillStyle = '#e0b090'; c.beginPath(); c.arc(-20 + k * 6, 3 + Math.sin(k) * 5, 3, 0, TAU); c.fill(); } } }, parts: [
      { x: 4.2, y: -1.8, name: 'Big eyes', say: 'A paralarva has two big eyes for its size, to see the light and the food around it.', simple: 'Big eyes!' },
      { x: 1, y: -3.4, name: 'Mantle', say: 'The round bag is the mantle. It squeezes water out through the siphon to jet along.', simple: 'The round bag squeezes to jet!' },
      { x: 1.2, y: 1.6, name: 'Colour cells', say: 'The red-brown dots are chromatophores, tiny bags of colour. Even a baby can flash them open and shut.', simple: 'Little dots of colour!' },
      { x: -6, y: 1, name: 'Eight arms', say: 'Eight short arms trail behind as it swims. They have suckers already, to grab a copepod.', simple: 'Eight little arms.' },
      { x: 2.2, y: 2.6, name: 'Siphon', say: 'The siphon is a tube under the head. Water squirts out of it to push the baby along.', simple: 'Water squirts out of the tube to zoom.' },
      { x: 0, y: .2, name: 'Full tummy', say: 'Its gut is full of the copepods and krill it has eaten.', simple: 'Its tummy is full of tiny shrimps.', needs: 'cutaway' }
    ] },
    postlarva: { k: 2.6, shift: -30, draw: (c) => Sprites.drawOctopus(c, { s: 2.6, form: form(), swim: .8, simple: true, seed: 2, calm: .2 }), parts: [
      { x: 10, y: -13, name: 'Eye', say: 'Now its eyes have a bar-shaped pupil, like a grown octopus.', simple: 'Eyes with a bar pupil!' },
      { x: -22, y: -16, name: 'Mantle', say: 'The mantle is still round and small. The settler is only the size of a pea.', simple: 'As small as a pea!' },
      { x: 36, y: 10, name: 'Arms', say: 'The arms are longer now, with two rows of suckers. They are ready to crawl on the reef.', simple: 'Longer arms, ready to crawl.' },
      { x: -14, y: 10, name: 'Siphon', say: 'The siphon squirts water to jet, and blows sand away to dig.', simple: 'A tube to jet and to dig.' }
    ] },
    boy: { k: 2.6, shift: -30, draw: (c) => { Sprites.drawOctopus(c, { s: 2.6, form: form(), sex: 'boy', seed: 3, favArm: 'right', up: .05 }); if (cutaway) { c.save(); c.scale(2.6, 2.6); insides(c); c.restore(); } }, parts: [
      { x: -22, y: -18, name: 'Mantle', say: 'The mantle is the bag behind the head. It holds the gills, the hearts and the stomach, and it pumps the water the octopus breathes.', simple: 'The bag behind the head. It breathes with it.' },
      { x: 10, y: -13, name: 'Eye', say: 'Big eyes with a bar-shaped pupil that stays level however the octopus tilts. It sees very well in dim light.', simple: 'Big eyes with a bar pupil!' },
      { x: -16, y: 10, name: 'Siphon', say: 'The siphon is a tube under the head. Water squirts out of it to breathe, to jet backwards, to blow sand away and to puff ink.', simple: 'A tube that squirts water to zoom.' },
      { x: 50, y: 14, name: 'Arm', say: 'Eight arms, each with two rows of suckers and a brain of its own. The third arm on the right is a boy\'s special arm, with a spoon-shaped tip for the gift.', simple: 'Eight arms, each with its own little brain!' },
      { x: 30, y: 18, name: 'Suckers', say: 'More than two hundred suckers on each arm. Each one grips, and each one tastes.', simple: 'Suckers that grip and taste!' },
      { x: 16, y: 8, name: 'Beak', say: 'In the middle, under the arms, is a hard beak like a parrot\'s, for opening crabs. It is the only hard part of an octopus.', simple: 'A beak like a parrot, under the arms.' },
      { x: 2, y: -3, name: 'Skin', say: 'The skin is full of chromatophores, tiny bags of colour, and bumps called papillae. The octopus changes colour and texture in a blink.', simple: 'Skin that changes colour in a blink!' },
      { x: -24, y: -10, name: 'Gills', say: 'Two feathery gills inside the mantle take oxygen from the water.', simple: 'Two gills to breathe in water.', needs: 'cutaway' },
      { x: -18, y: -8, name: 'Three hearts', say: 'Three hearts: two pump blood through the gills, and one pumps it round the body.', simple: 'Three hearts!', needs: 'cutaway' },
      { x: -30, y: -2, name: 'Blue blood', say: 'Octopus blood is blue. It carries oxygen with copper instead of iron.', simple: 'Blue blood!', needs: 'cutaway' },
      { x: -26, y: -20, name: 'Ink sac', say: 'The ink sac holds the dark ink that an octopus squirts to hide behind.', simple: 'A bag of ink for hiding!', needs: 'cutaway' }
    ] },
    girl: { k: 2.4, shift: -30, draw: (c) => Sprites.drawOctopus(c, { s: 2.4, form: form(), sex: 'girl', eggs: cutaway ? 1 : 0, seed: 5, favArm: 'right', calm: .3, tuck: .15 }), parts: [
      { x: -22, y: -18, name: 'Mantle', say: 'A girl looks much like a boy. Inside her mantle grow the fifty thousand eggs she will lay.', simple: 'Her eggs grow inside her mantle.' },
      { x: 50, y: 14, name: 'Arms', say: 'A girl has eight arms the same, with no special arm. She uses them to braid her eggs into strings and stroke them clean.', simple: 'Eight arms to look after her eggs.' },
      { x: -16, y: 10, name: 'Siphon', say: 'With her siphon she blows fresh water over her eggs for months so they can breathe.', simple: 'She blows water on her eggs with it.' },
      { x: -10, y: -40, name: 'Egg strings', say: 'She glues her eggs into strings and hangs them from the roof of her den, like bunches of tiny grapes. About fifty thousand of them.', simple: 'Thousands of eggs, hung like grapes!', needs: 'cutaway' }
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
