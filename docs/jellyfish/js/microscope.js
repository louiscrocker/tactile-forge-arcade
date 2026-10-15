/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the planula, the
   polyp, the ephyra, a boy moon jelly, a girl moon jelly.  Tap a
   label and it is read aloud.  "Look inside" shows the planula's
   food store, the food in a polyp's stomach, the ephyra's canals,
   a jelly's stomach pouches and canals, and a mother's babies in
   the pouches on her arms.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'pink';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';
  const F = () => FORMS[form()] || FORMS.pink;

  /* inside a jelly's bell: the four stomach pouches with food in them, and the canals running out to the edge */
  function jellyInsides(c, r, oy) {
    c.save(); c.translate(0, oy);
    c.strokeStyle = 'rgba(200,150,190,.75)'; c.lineWidth = 1.6;
    for (let k = 0; k < 9; k++) { const x = -r * .9 + k * r * .225; c.beginPath(); c.moveTo(x * .25, -r * .3); c.quadraticCurveTo(x * .7, -r * .42, x, -r * .08); c.stroke(); }
    for (const sx of [-1, 1]) {
      c.fillStyle = 'rgba(255,220,180,.6)'; c.beginPath(); c.ellipse(sx * r * .28, -r * .3, r * .2, r * .1, 0, 0, TAU); c.fill();
      c.fillStyle = '#9ac86a'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(sx * r * .28 + (k - 2) * r * .06, -r * .3 + Math.sin(k * 2) * r * .04, r * .025, 0, TAU); c.fill(); }
    }
    c.restore();
  }
  const JELLY_OY = -50;
  const PARTS = {
    planula: { k: 1.7, draw: (c) => { c.save(); c.rotate(-Math.PI / 2); Sprites.drawPlanula(c, { s: 46, t: 1 }); c.restore(); if (cutaway) { c.fillStyle = 'rgba(255,210,120,.65)'; c.beginPath(); c.ellipse(-8, 0, 36, 18, 0, 0, TAU); c.fill(); } }, parts: [
      { x: -10, y: -42, name: 'Tiny hairs', say: 'A planula is covered in tiny hairs called cilia. They beat together like hundreds of oars and push it through the water.', simple: 'Tiny hairs row it along!' },
      { x: 58, y: 0, name: 'Front end', say: 'The planula swims front end first. When it finds a shady rock, it sticks on by this end and hangs upside down.', simple: 'It sticks on with this end.' },
      { x: -60, y: 8, name: 'Body', say: 'The whole planula is smaller than a grain of sand. It is a baby moon jelly.', simple: 'Smaller than a grain of sand!' },
      { x: -8, y: 4, name: 'Food store', say: 'A planula does not eat. It lives on the food its mother gave it while it looks for a home.', simple: 'It does not eat. Mum gave it food.', needs: 'cutaway' }
    ] },
    polyp: { k: 1.15, draw: (c) => {
      c.fillStyle = '#7a7266'; c.fillRect(-200, -150, 400, 46); c.fillStyle = '#5a544a'; c.fillRect(-200, -108, 400, 6);
      c.save(); c.translate(0, -102); c.scale(6.5, 6.5); Sprites.drawPolyp(c, { len: 22, tentacles: 16, stretch: .8, lean: 0, t: 1, form: form() }); c.restore();
      c.save(); c.translate(-90, -102); c.scale(3.6, 3.6); Sprites.drawPolyp(c, { len: 14, tentacles: 4, stretch: .5, lean: .3, t: 2, form: form() }); c.restore();
      if (cutaway) { c.fillStyle = 'rgba(255,220,180,.6)'; c.beginPath(); c.ellipse(0, 10, 22, 26, 0, 0, TAU); c.fill(); c.fillStyle = '#9ac86a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(-10 + k * 4, 6 + Math.sin(k * 2) * 8, 3, 0, TAU); c.fill(); } }
    }, parts: [
      { x: 0, y: -100, name: 'Foot', say: 'The polyp is stuck on by its foot, under a rock or a dock, hanging upside down.', simple: 'Stuck on under the rock.' },
      { x: 4, y: -55, name: 'Stalk', say: 'A thin stalk holds the cup. The polyp can stretch it out long or pull it in tight.', simple: 'It stretches long or pulls in.' },
      { x: 0, y: 40, name: 'Mouth', say: 'The mouth is in the middle of the tentacles. Food goes in, and leftovers come back out the same way.', simple: 'The mouth is in the middle.' },
      { x: 60, y: 48, name: 'Tentacles', say: 'A polyp starts with four tentacles, then grows eight, then sixteen. Food that drifts by sticks to them.', simple: 'Tentacles catch the food.' },
      { x: -90, y: -70, name: 'Bud', say: 'A well fed polyp grows a bud on its side. The bud becomes a whole new polyp: a clone, an exact copy.', simple: 'A bud: a copy of the polyp!' },
      { x: 0, y: 10, name: 'Tummy', say: 'Inside, the food is broken down in the polyp\'s stomach.', simple: 'Food in its tummy.', needs: 'cutaway' }
    ] },
    ephyra: { k: 1.25, draw: (c) => { Sprites.drawEphyra(c, { r: 120, fill: .25, pulse: .2, t: 1, form: form() }); if (cutaway) { c.strokeStyle = 'rgba(200,150,190,.8)'; c.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); c.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); c.stroke(); } c.fillStyle = 'rgba(255,220,180,.65)'; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); c.fillStyle = '#9ac86a'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(Math.cos(k * 1.3) * 12, Math.sin(k * 1.3) * 12, 4, 0, TAU); c.fill(); } } }, parts: [
      { x: 0, y: 0, name: 'Mouth', say: 'In the middle is the mouth. An ephyra eats tiny plankton as soon as it pops free.', simple: 'Its mouth is in the middle.' },
      { x: 84, y: -34, name: 'Arm', say: 'An ephyra has eight arms, like a little star. As it grows, the gaps between them fill in.', simple: 'Eight arms, like a star!' },
      { x: -110, y: -18, name: 'Lappets', say: 'Each arm ends in two little flaps called lappets. They push the water when the ephyra pulses.', simple: 'Little flaps to swim.' },
      { x: 0, y: 115, name: 'Sense organ', say: 'Between the lappets at the end of each arm is a tiny sense organ. It feels which way is up, and light from dark.', simple: 'It feels which way is up.' },
      { x: 60, y: 50, name: 'Canals', say: 'Canals carry food from the stomach out to the arms.', simple: 'Little tubes carry food.', needs: 'cutaway' }
    ] },
    boy: { k: 1.45, draw: (c) => { c.save(); c.translate(0, JELLY_OY); Sprites.drawJelly(c, { r: 100, form: form(), sex: 'boy', pulse: .15, rings: 1, eggs: 0, t: 1 }); c.restore(); if (cutaway) jellyInsides(c, 100, JELLY_OY); }, parts: [
      { x: -30, y: -100, name: 'Bell', say: 'The clear bell is about 95 percent water. The jelly squeezes it to swim, and sticky slime on it catches food.', simple: 'A clear bell, nearly all water!' },
      { x: 26, y: -78, name: 'Four rings', say: 'The four rings are where a boy\'s sperm or a girl\'s eggs grow. They can be pink, purple, blue or white.', simple: 'Four rings. That is where the eggs grow.' },
      { x: -96, y: -44, name: 'Fringe', say: 'Hundreds of short, fine tentacles hang all round the edge, like a fringe on a lampshade.', simple: 'Lots of little tentacles round the edge.' },
      { x: 98, y: -50, name: 'Sense organs', say: 'Eight tiny sense organs sit around the edge. They feel which way is up and tell light from dark. A jelly has no brain!', simple: 'They feel which way is up. No brain!' },
      { x: 0, y: -42, name: 'Mouth', say: 'The mouth is under the middle of the bell. A jellyfish eats and gets rid of leftovers through the same opening.', simple: 'One hole to eat and poop!' },
      { x: 18, y: 60, name: 'Four frilly arms', say: 'Four long, frilly arms hang under the bell. They lick the food off the bell and carry it to the mouth.', simple: 'Frilly arms carry food to the mouth.' },
      { x: -28, y: -80, name: 'Stomach pouches', say: 'Food goes into four stomach pouches in the middle of the bell.', simple: 'Its tummy has four pouches.', needs: 'cutaway' },
      { x: -72, y: -60, name: 'Canals', say: 'Thin canals carry the food all the way out to the edge of the bell.', simple: 'Tubes carry food to the edge.', needs: 'cutaway' }
    ] },
    girl: { k: 1.45, draw: (c) => { c.save(); c.translate(0, JELLY_OY); Sprites.drawJelly(c, { r: 100, form: form(), sex: 'girl', pulse: .15, rings: 1, eggs: cutaway ? 1 : 0, t: 1 }); c.restore(); if (cutaway) { c.fillStyle = 'rgba(255,240,200,.95)'; for (let k = 0; k < 40; k++) { const a = k * 2.4, d = 10 + (k % 7) * 4; c.beginPath(); c.arc(Math.cos(a) * d * .9 + (k % 2 ? 20 : -20), 30 + Math.sin(a) * d * .6 + (k % 5) * 6, 2.4, 0, TAU); c.fill(); } } }, parts: [
      { x: 26, y: -78, name: 'Four rings', say: 'In a girl, the four rings are where her eggs grow.', simple: 'Her eggs grow in the rings.' },
      { x: -30, y: -100, name: 'Bell', say: 'A girl moon jelly looks just like a boy from the outside.', simple: 'Girls and boys look the same!' },
      { x: 18, y: 60, name: 'Four frilly arms', say: 'Her four arms carry food, and in summer they carry her babies too.', simple: 'Arms for food, and for babies.' },
      { x: -20, y: 40, name: 'Brood pouches', say: 'After a boy\'s little cloud reaches her eggs, the babies grow in pouches along her arms until they can swim free as planulae.', simple: 'Her babies grow in pouches on her arms!', needs: 'cutaway' }
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
    if (what === 'egg') what = 'planula';
    if (what && PARTS[what]) subject = what;
    else { const p = G.players[0]; subject = !p ? 'boy' : p.stage === 'egg' || p.stage === 'planula' ? 'planula' : p.stage === 'polyp' ? 'polyp' : p.stage === 'ephyra' ? 'ephyra' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    ctx.scale(def.k, def.k);
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
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide the babies' : 'Show her babies') : cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render };
})();
