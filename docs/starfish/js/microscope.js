/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg, the swimming
   larva, the larva with sticky arms, a tiny star, a boy sea star, a
   girl sea star.  Tap a label and it is read aloud.  "Look inside"
   shows the baby in the egg, and a sea star's water tubes, stomach,
   food store and the sacs where the eggs or the milky cloud grow.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'normal';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  /* the inside of a sea star, seen from above through its back (body units: the star is 260 across) */
  const ARM_ANGLES = [0, 1, 2, 3, 4].map(k => .31 + k * TAU / 5);
  function insides(c, girl) {
    const tip = (a, u) => [Math.cos(a) * 118 * u, Math.sin(a) * 118 * u * .92 - 10];
    /* digestive glands down each arm (green-brown), and the gonads at the base of each arm */
    for (const a of ARM_ANGLES) {
      for (const side of [-1, 1]) {
        c.fillStyle = 'rgba(120,130,60,.75)'; c.beginPath();
        for (let k = 0; k <= 10; k++) { const u = .25 + k / 10 * .6, [x, y] = tip(a + side * .1 * (1 - u), u); k ? c.lineTo(x, y) : c.moveTo(x, y); }
        for (let k = 10; k >= 0; k--) { const u = .25 + k / 10 * .6, [x, y] = tip(a + side * .02, u); c.lineTo(x, y); }
        c.closePath(); c.fill();
        const [gx, gy] = tip(a + side * .2, .3);
        c.fillStyle = girl ? 'rgba(255,170,90,.95)' : 'rgba(250,248,240,.95)'; c.beginPath(); c.ellipse(gx, gy, 8, 6, a, 0, TAU); c.fill();
      }
    }
    /* the water tubes: the ring round the mouth and a canal down each arm, to the tube feet */
    c.strokeStyle = 'rgba(70,150,240,.95)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, -10, 22, 20, 0, 0, TAU); c.stroke();
    for (const a of ARM_ANGLES) { const [x0, y0] = tip(a, .19), [x1, y1] = tip(a, .95); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); for (let k = 1; k < 9; k++) { const [x, y] = tip(a, .2 + k * .085); c.fillStyle = 'rgba(120,190,255,.9)'; c.beginPath(); c.arc(x + Math.cos(a + 1.57) * 5, y + Math.sin(a + 1.57) * 5, 2.4, 0, TAU); c.arc(x - Math.cos(a + 1.57) * 5, y - Math.sin(a + 1.57) * 5, 2.4, 0, TAU); c.fill(); } }
    /* the stone canal up to the sieve plate */
    c.strokeStyle = 'rgba(240,170,80,.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, -18); c.lineTo(20, -26); c.stroke();
    /* the stomach in the middle */
    c.fillStyle = 'rgba(255,228,206,.92)'; c.beginPath(); c.ellipse(0, -10, 16, 14, 0, 0, TAU); c.fill();
  }
  const STAR = (extra) => (c) => Sprites.drawStar(c, Object.assign({ w: 260, form: form(), face: true, rot: 0, seed: 5, noShadow: true }, extra));
  const PARTS = {
    egg: { k: 60, draw: (c) => { Sprites.drawEgg(c, { s: 60, eye: cutaway }); }, parts: [
      { x: -.5, y: -.8, name: 'Egg', say: 'A sea star egg is a tiny round ball, smaller than a grain of sand. A big mother lets millions of them go into the sea.', simple: 'A tiny round egg. Mum lets millions go!' },
      { x: .7, y: .5, name: 'Yolk', say: 'The egg is full of yolk, food for the baby until it can eat for itself.', simple: 'Food inside for the baby.' },
      { x: .1, y: .15, name: 'Baby', say: 'Inside, the cells split again and again, and in a day or two a tiny swimming larva is ready to hatch.', simple: 'A baby is growing inside!', needs: 'cutaway' }
    ] },
    larva: { k: 40, draw: (c) => { Sprites.drawLarva(c, { s: 40, ph: .8, z: 1 }); }, parts: [
      { x: 0, y: -2.3, name: 'See-through body', say: 'The larva is see-through, like a tiny glass bell. It looks nothing like a star yet. This one is called a bipinnaria.', simple: 'See-through, like glass! Not a star yet.' },
      { x: 1.9, y: -.7, name: 'Hair bands', say: 'Two bands of tiny beating hairs, called cilia, row it through the water and sweep food to its mouth.', simple: 'Tiny hairs beat to swim and eat.' },
      { x: 0, y: .3, name: 'Tummy', say: 'Its stomach is green-gold, full of the diatoms and tiny plant cells it has eaten.', simple: 'A green tummy full of tiny plants.' },
      { x: -1.9, y: .9, name: 'Mouth', say: 'The hairs sweep food into its mouth, on the front of its body.', simple: 'Food goes in its mouth here.' }
    ] },
    postlarva: { k: 34, draw: (c) => { Sprites.drawLarva(c, { s: 34, ph: .8, z: 3, star: 1, form: form() }); }, parts: [
      { x: 0, y: -3.4, name: 'Sticky arms', say: 'Three little sticky arms grow at the front. The larva touches rocks with them to find a good place, then holds on. Now it is called a brachiolaria.', simple: 'Three sticky arms to hold on!' },
      { x: .9, y: .6, name: 'Tiny star', say: 'A tiny five-armed star is already growing inside the larva. When it settles, the star grows out and the rest of the larva is used up.', simple: 'A tiny star is growing inside!' },
      { x: 1.9, y: -.7, name: 'Hair bands', say: 'It still swims with its bands of beating hairs.', simple: 'Still swimming with tiny hairs.' }
    ] },
    juvenile: { k: 1, draw: STAR({ w: 220 }), parts: [
      { x: 0, y: -10, name: 'Five arms', say: 'A new sea star has five short arms and is less than a millimetre across. It hides in cracks while it grows.', simple: 'Five little arms! Tiny, tiny.' },
      { x: 100, y: 30, name: 'Eyespot', say: 'Even a tiny star has a red eyespot at the end of each arm.', simple: 'An eye at the end of each arm!' },
      { x: -40, y: -60, name: 'Soft skin', say: 'Its skin is soft at first. The spines and the hard little plates grow in as it gets bigger.', simple: 'Soft skin at first.' }
    ] },
    boy: { k: 1, draw: (c) => { STAR({})(c); if (cutaway) insides(c, false); }, parts: [
      { x: 124, y: 27, name: 'Arm', say: 'Five arms, each one able to bend and twist. If one gets stuck, the sea star can let it go and grow a new one.', simple: 'Five arms. A lost arm grows back!' },
      { x: 120, y: 33, name: 'Eyespot', say: 'At the tip of each arm is a red eyespot. It sees light and dark and big shapes like rocks.', simple: 'An eye at the end of each arm!' },
      { x: -40, y: -50, name: 'Spines', say: 'The back is covered with little white spines in a net pattern. The skin is tough and rough.', simple: 'White spines in a net!' },
      { x: 18, y: -28, name: 'Sieve plate', say: 'This little orange dot is the sieve plate, the madreporite. Sea water goes in here to work the tube feet.', simple: 'Water goes in this little dot!' },
      { x: 0, y: -10, name: 'Middle', say: 'The mouth is underneath, right in the middle. A sea star has no head and no brain: a ring of nerves goes round the mouth and down each arm.', simple: 'No head and no brain!' },
      { x: 0, y: 80, name: 'Tube feet', say: 'Under each arm are rows of tube feet with suckers, hundreds of them. They walk, hold on, and pull mussels open.', simple: 'Hundreds of tiny feet underneath!' },
      { x: 22, y: -2, name: 'Water tubes', say: 'Inside, water runs round a ring and down a tube in each arm to every tube foot. Sea water does the work blood does in us.', simple: 'Water tubes, not blood!', needs: 'cutaway' },
      { x: 0, y: -10, name: 'Stomach', say: 'The stomach can be pushed right out of the mouth, into a mussel\'s shell, to eat it there.', simple: 'A stomach that comes out!', needs: 'cutaway' },
      { x: 70, y: 16, name: 'Food store', say: 'Long green-brown glands down each arm store food, so a sea star can go weeks without eating.', simple: 'Food stored in its arms.', needs: 'cutaway' },
      { x: 38, y: 24, name: 'Milk sacs', say: 'A boy keeps the milky cloud he will let go in spring in little sacs at the base of each arm.', simple: 'His milky cloud is kept here.', needs: 'cutaway' }
    ] },
    girl: { k: 1, draw: (c) => { STAR({})(c); if (cutaway) insides(c, true); }, parts: [
      { x: 124, y: 27, name: 'Arm', say: 'A girl looks just like a boy from outside. You can only tell them apart in spring, when they spawn.', simple: 'A girl looks just like a boy!' },
      { x: 0, y: 80, name: 'Tube feet', say: 'In spring she climbs up on her arm tips, standing tall, so her eggs float off into the water.', simple: 'She stands tall on her arm tips.' },
      { x: 18, y: -28, name: 'Sieve plate', say: 'The sieve plate lets sea water in to work her tube feet.', simple: 'Water goes in this little dot!' },
      { x: 38, y: 24, name: 'Egg sacs', say: 'At the base of each arm, two orange sacs fill with eggs: tens of millions of them, let go through tiny holes between the arms.', simple: 'Millions of eggs, kept in her arms!', needs: 'cutaway' }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.stage === 'egg' ? 'egg' : p.stage === 'larva' ? 'larva' : p.stage === 'postlarva' ? 'postlarva' : p.instar <= 1 ? 'juvenile' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    $('scopeCut').textContent = cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render };
})();
