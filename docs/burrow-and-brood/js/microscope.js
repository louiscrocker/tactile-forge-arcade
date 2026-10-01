/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: egg, larva,
   cocoon, worker, queen, aphid, ladybug larva.  Tap a label and it
   is read aloud.  "Look inside" shows the worker's two stomachs,
   the pupa inside its cocoon, and a winged queen.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'worker', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  const sp = () => (G_ref ? G_ref.speciesDef() : SPECIES.garden);

  /* parts: x,y in the drawing's own frame (multiplied by `k`) */
  const PARTS = {
    egg: { k: 16, draw: (c) => Sprites.drawEggs(c, { s: 16, count: 6, seed: 3 }), parts: [
      { x: 0, y: -1, name: 'Eggs', say: 'Ant eggs are tiny, white and a bit sticky, so the ants can carry a whole clump at once.', simple: 'Tiny sticky eggs, carried in a clump.' },
      { x: 2, y: 2, name: 'Shell', say: 'A soft shell. Nurses lick the eggs all the time to keep germs and mould away.', simple: 'Nurses lick the eggs to keep them clean.' }
    ] },
    larva: { k: 12, draw: (c) => Sprites.drawBroodLarva(c, { s: 12, grow: 1, fed: cutaway ? 1 : .3 }), parts: [
      { x: -7.5, y: -7, name: 'Head', say: 'A small head with mouthparts, but no eyes. The larva cannot see.', simple: 'A little head. No eyes!' },
      { x: 4, y: -3, name: 'Segments', say: 'The soft body is made of segments. It stretches as the larva grows.', simple: 'The body is made of pieces called segments.' },
      { x: 5, y: 5, name: 'No legs', say: 'Ant larvae have no legs, so they cannot move. The nurses carry them and feed them.', simple: 'No legs! The nurses carry them.' },
      { x: 0, y: 1, name: 'Gut', say: 'You can see the food inside. A larva does nothing but eat and grow.', simple: 'You can see the food inside.', needs: 'cutaway' }
    ] },
    pupa: { k: 11, draw: (c) => { Sprites.drawCocoon(c, { s: 11, prog: cutaway ? .95 : .2 }); }, parts: [
      { x: 0, y: -4, name: 'Silk cocoon', say: 'The larva spins this cocoon from silk made in its mouth.', simple: 'A cocoon made of silk.' },
      { x: -9.4, y: .8, name: 'Dark spot', say: 'The dark spot is the larva\'s last waste, pushed out before it changed.', simple: 'The dark spot is old waste.' },
      { x: 2, y: 0, name: 'Pupa inside', say: 'Inside, the larva is turning into an adult ant: legs, eyes, antennae and all.', simple: 'Inside, an ant is growing.', needs: 'cutaway' }
    ] },
    worker: { k: 9, draw: (c) => { c.translate(20, 0); Sprites.drawAnt(c, { s: 9, sp: sp(), walk: .8, crop: cutaway ? 1 : 0 }); if (cutaway) { c.fillStyle = 'rgba(255,190,60,.55)'; c.beginPath(); c.ellipse(-12 * 9, -3 * 9, 5 * 9, 3.4 * 9, .2, 0, TAU); c.fill(); c.fillStyle = 'rgba(200,90,70,.6)'; c.beginPath(); c.ellipse(-17 * 9, -1 * 9, 2.4 * 9, 2 * 9, 0, 0, TAU); c.fill(); } }, parts: [
      { x: 15.5, y: -5, name: 'Head', say: 'The head has the eyes, the antennae and the jaws.', simple: 'The head: eyes, feelers and jaws.' },
      { x: 21, y: -3, name: 'Mandibles', say: 'The jaws, called mandibles, dig, carry, cut and bite. They open sideways.', simple: 'Strong jaws for digging and carrying.' },
      { x: 17, y: -8, name: 'Eye', say: 'Compound eyes made of many little lenses. Many ants see only blurry shapes and rely on smell.', simple: 'Eyes made of lots of little parts.' },
      { x: 20, y: -13, name: 'Antennae', say: 'Elbowed antennae smell, taste and touch. Ants talk by tapping antennae and by smells called pheromones.', simple: 'Feelers that smell and touch.' },
      { x: 5, y: -7, name: 'Thorax', say: 'The middle part carries all six legs. It is packed with muscle.', simple: 'The middle part, with all six legs.' },
      { x: -1, y: -3.5, name: 'Waist', say: 'The narrow waist, called the petiole, lets the ant bend its body.', simple: 'A tiny waist so it can bend.' },
      { x: -10, y: 3, name: 'Gaster', say: 'The back part holds the stomachs. Some ants have a stinger at the tip.', simple: 'The back part holds the tummies.' },
      { x: 12, y: 8, name: 'Legs', say: 'Six legs with hooked feet, so ants can walk on walls and even upside down.', simple: 'Six legs with hooks. Ants can walk upside down!' },
      { x: -12, y: -3, name: 'Crop', say: 'The crop is the social stomach. Food carried home here is shared mouth to mouth with sisters and larvae.', simple: 'A tummy for sharing food.', needs: 'cutaway' },
      { x: -17, y: -1, name: 'Own stomach', say: 'Only a little food goes through to the ant\'s own stomach.', simple: 'Her own little tummy.', needs: 'cutaway' }
    ] },
    queen: { k: 7, draw: (c) => { c.translate(30, 0); Sprites.drawAnt(c, { s: 7 * 1.25, sp: sp(), caste: cutaway ? 'alate' : 'queen', walk: .8 }); }, parts: [
      { x: 20, y: -7, name: 'Head', say: 'The queen\'s head is like a worker\'s, with three extra little eyes on top called ocelli.', simple: 'Her head has three extra little eyes.' },
      { x: 9, y: -12, name: 'Wing scars', say: 'She broke off her own wings after her wedding flight. You can still see the scars.', simple: 'Where her wings used to be.' },
      { x: 3, y: -6, name: 'Big thorax', say: 'The big thorax held her flying muscles. She used them up as food for her first babies.', simple: 'Big muscles, now used for food.' },
      { x: -21, y: -2, name: 'Big gaster', say: 'Her huge gaster is full of eggs. A queen can lay eggs for twenty years or more.', simple: 'Full of eggs!' },
      { x: -20, y: -12, name: 'Wings', say: 'Before her flight she had four wings. Workers never have wings.', simple: 'Queens have wings at first. Workers never do.', needs: 'cutaway' }
    ] },
    aphid: { k: 14, draw: (c) => Sprites.drawAphid(c, { s: 14, variant: 'green', dew: cutaway ? 1 : 0 }), parts: [
      { x: 6, y: 0, name: 'Head', say: 'A tiny head with red eyes and long antennae swept back over the body.', simple: 'A tiny head with red eyes.' },
      { x: 4, y: 1.5, name: 'Beak', say: 'A needle mouth pushed into the stem to drink the sweet sap.', simple: 'A needle mouth for drinking sap.' },
      { x: -8.5, y: -3, name: 'Cornicles', say: 'Two little tail pipes that squirt an alarm liquid when danger comes.', simple: 'Two tail pipes for alarm goo.' },
      { x: -4, y: 3, name: 'Body', say: 'A soft body full of sap. It drinks more than it needs and squirts out the extra.', simple: 'A soft body full of juice.' },
      { x: -11.5, y: 0, name: 'Honeydew', say: 'The sweet drop is honeydew. Ants stroke the aphid to ask for it.', simple: 'Honeydew! Ants love it.', needs: 'cutaway' }
    ] },
    ladylarva: { k: 5, draw: (c) => Sprites.drawLadyLarva(c, { s: 5, instar: 4, chew: .3 }), parts: [
      { x: 34, y: 0, name: 'Head', say: 'Simple eyes that see only light and dark, so it hunts by bumping into aphids.', simple: 'It finds aphids by bumping into them.' },
      { x: 44, y: -4, name: 'Jaws', say: 'Strong jaws that grab an aphid and squeeze it.', simple: 'Strong jaws for aphids.' },
      { x: 8, y: -10, name: 'Orange spots', say: 'The bright spots warn birds that it tastes bad.', simple: 'Spots say: I taste bad!' },
      { x: -10, y: 12, name: 'Spines', say: 'Spiky bumps make it hard for ants to grab. The ants bite it anyway.', simple: 'Spikes! The ants bite it anyway.' },
      { x: 16, y: 14, name: 'Legs', say: 'Six legs with hooked feet for holding on to stems.', simple: 'Six legs with hooky feet.' }
    ] }
  };

  let G_ref = null;
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  function init() {
    canvas = $('scopeCanvas');
    if (!canvas) return;
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
    else { const p = G.players[0]; subject = p && p.caste === 'queen' ? 'queen' : 'worker'; }
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
    const def = PARTS[subject], cx = W * .4, cy = H * .5;
    const shift = subject === 'worker' ? 20 : subject === 'queen' ? 30 : 0;
    const items = [];
    def.parts.forEach((part, i) => {
      if (part.needs === 'cutaway' && !cutaway) return;
      items.push({ i, part, px: cx + shift + part.x * def.k, py: cy + part.y * def.k });
    });
    items.sort((a, b) => a.py - b.py);
    const n = items.length, lx = W * .8;
    items.forEach((it, k) => { it.lx = lx; it.ly = H * .1 + (H * .8) * (n === 1 ? .5 : k / (n - 1)); });
    return items;
  }
  function hitLabel(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    const items = layout();
    for (const it of items) if (Math.abs(x - it.lx - 50) < 70 && Math.abs(y - it.ly) < 16) return it.i;
    for (const it of items) if (Math.hypot(x - it.px, y - it.py) < 18) return it.i;
    return -1;
  }
  function render() {
    if (!ctx) return;
    const dpr = 2;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .4, H * .5, 20, W * .4, H * .5, H * .62);
    g.addColorStop(0, '#fbf6ec'); g.addColorStop(1, '#e8dcc4');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .47, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,100,80,.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * .4 - H * .45, H * .5); ctx.lineTo(W * .4 + H * .45, H * .5); ctx.moveTo(W * .4, H * .05); ctx.lineTo(W * .4, H * .95); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .46, 0, TAU); ctx.clip();
    ctx.translate(W * .4, H * .5);
    PARTS[subject].draw(ctx);
    ctx.restore();
    const items = layout();
    ctx.font = `800 15px ${UI_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const it of items) {
      const on = it.i === hover;
      ctx.strokeStyle = on ? '#c0501a' : 'rgba(90,70,50,.6)'; ctx.lineWidth = on ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.lx - 8, it.ly); ctx.stroke();
      ctx.fillStyle = on ? '#c0501a' : '#6a5a4a';
      ctx.beginPath(); ctx.arc(it.px, it.py, on ? 6 : 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? '#c0501a' : 'rgba(255,255,255,.92)';
      const w = ctx.measureText(it.part.name).width + 22;
      rr(ctx, it.lx - 6, it.ly - 14, w, 28, 14); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#2a2016';
      ctx.fillText(it.part.name, it.lx + 5, it.ly + 1);
    }
    $('scopeCut').hidden = !PARTS[subject].parts.some(p => p.needs === 'cutaway');
    $('scopeCut').textContent = subject === 'queen' ? (cutaway ? 'After the flight' : 'Before the flight') : (cutaway ? 'Outside view' : 'Look inside');
  }
  return { init, open, close, isOpen, render };
})();
