/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: the egg, the spiky
   star, a young sunfish, a boy sunfish, a girl sunfish.  Tap a
   label and it is read aloud.  "Look inside" shows the baby inside
   the egg, the star's full tummy, a grown sunfish's tiny brain, long
   gut, light bones and throat teeth, and a girl's millions of eggs.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'normal';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  /* the inside of a grown sunfish, under see-through skin (canonical body units) */
  function insides(c, girl) {
    c.save();
    c.fillStyle = 'rgba(255,245,235,.45)'; Sprites.bodyPath(c, 1); c.fill();
    c.strokeStyle = 'rgba(230,220,200,.9)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(34, -10); c.quadraticCurveTo(0, -16, -30, -6); c.stroke();
    for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(24 - k * 6, -13); c.lineTo(22 - k * 6, -24 + (k % 2) * 3); c.moveTo(24 - k * 6, -13); c.lineTo(22 - k * 6, -2); c.stroke(); }
    c.fillStyle = 'rgba(240,190,200,.95)'; c.beginPath(); c.ellipse(31, -13, 2.6, 1.8, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(200,120,90,.9)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(42, 4); c.bezierCurveTo(30, 16, 20, 2, 12, 14); c.bezierCurveTo(4, 26, -6, 8, 2, 4); c.bezierCurveTo(10, 0, 14, 22, -4, 22); c.stroke();
    c.fillStyle = 'rgba(220,60,70,.9)'; c.beginPath(); c.arc(26, 12, 2.6, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(230,140,150,.9)'; c.lineWidth = .8; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(22, -2 + k * 2); c.lineTo(17, -1 + k * 2); c.stroke(); }
    c.fillStyle = 'rgba(250,250,245,.95)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(42 + k * .6, 1 + k); c.lineTo(45, 2 + k); c.lineTo(42, 3 + k); c.fill(); }
    if (girl) { c.fillStyle = 'rgba(255,200,120,.85)'; c.beginPath(); c.ellipse(-8, 10, 13, 9, -.2, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,240,200,.95)'; const R = mulberry32(4); for (let k = 0; k < 90; k++) { const a = R() * TAU, r = Math.sqrt(R()); c.beginPath(); c.arc(-8 + Math.cos(a) * r * 12, 10 + Math.sin(a) * r * 8, .7, 0, TAU); c.fill(); } }
    c.restore();
  }
  const mola = (k, extra) => (c) => { Sprites.drawSunfish(c, Object.assign({ s: k, form: form(), stage: 'mola', flap: .9, seed: 3 }, extra)); };
  const OUT = [
    { x: -24, y: -72, name: 'Top fin', say: 'The tall top fin is called the dorsal fin. The sunfish flaps it from side to side, together with the bottom fin, like a bird\'s wings.', simple: 'A tall fin that flaps like a wing!' },
    { x: -24, y: 72, name: 'Bottom fin', say: 'The bottom fin, the anal fin, flaps together with the top fin. These two fins do almost all the swimming.', simple: 'The bottom fin flaps too.' },
    { x: -44, y: 18, name: 'Clavus', say: 'A sunfish has no tail. This frilly rudder, the clavus, grew from the back edges of the top and bottom fins. It steers.', simple: 'No tail! A frilly rudder steers.' },
    { x: 13, y: 9, name: 'Little fin', say: 'The small fin on the side is the pectoral fin. It helps keep the sunfish steady.', simple: 'A little side fin keeps it steady.' },
    { x: 36, y: -7, name: 'Eye', say: 'Sunfish have good eyes for seeing jellies against the light, even in dim, deep water.', simple: 'Eyes to spot jellies!' },
    { x: 50, y: 3, name: 'Beak', say: 'A sunfish\'s teeth are joined into a hard beak, like a parrot\'s. Its small round mouth is always a little open.', simple: 'A beak like a parrot!' },
    { x: 0, y: -24, name: 'Thick skin', say: 'The skin can be thicker than your hand, rough like sandpaper, and coated in slime.', simple: 'Thick, rough skin!' }
  ];
  const IN = [
    { x: 31, y: -13, name: 'Tiny brain', say: 'For such a huge fish, a sunfish has a tiny brain, smaller than a walnut.', simple: 'A very tiny brain!', needs: 'cutaway' },
    { x: 6, y: 18, name: 'Long gut', say: 'A long, coiled gut takes in the little food there is in all those jellies.', simple: 'A long tummy tube for jellies.', needs: 'cutaway' },
    { x: -14, y: -8, name: 'Light bones', say: 'Much of the skeleton is soft and light, like gristle. There is no air bag (swim bladder) at all.', simple: 'Light, soft bones. No air bag!', needs: 'cutaway' },
    { x: 43, y: 6, name: 'Throat teeth', say: 'Teeth in the throat shred the jellies before they are swallowed.', simple: 'Teeth in its throat!', needs: 'cutaway' },
    { x: 26, y: 12, name: 'Heart', say: 'The heart pumps blood through the gills, where the sunfish breathes.', simple: 'Its heart.', needs: 'cutaway' }
  ];
  const PARTS = {
    egg: { k: 12, draw: (c) => Sprites.drawEgg(c, { s: 12, eye: cutaway }), parts: [
      { x: -7, y: -7, name: 'Egg', say: 'A sunfish egg is tiny, about the size of a pinhead, and see-through. One mother can have three hundred million.', simple: 'A tiny egg. Mum has millions!' },
      { x: 3, y: 3, name: 'Oil drop', say: 'A golden drop of oil helps the egg float in the open sea.', simple: 'A drop of oil helps it float.' },
      { x: -3.5, y: -2, name: 'Baby', say: 'A tiny baby sunfish is curled up inside, with a big dark eye.', simple: 'A baby is curled up inside!', needs: 'cutaway' }
    ] },
    star: { k: 3, draw: (c) => { Sprites.drawSunfish(c, { s: 3, stage: 'star', flap: .5 }); if (cutaway) { c.fillStyle = 'rgba(230,150,90,.6)'; c.beginPath(); c.ellipse(0, 24, 42, 24, 0, 0, TAU); c.fill(); } }, parts: [
      { x: 40, y: -36, name: 'Spikes', say: 'Spikes all over make the baby look like a tiny star. They may make it hard for a fish to swallow.', simple: 'Spikes like a star!' },
      { x: 14, y: -8, name: 'Big eye', say: 'A big eye to find food in the plankton.', simple: 'A big eye!' },
      { x: 27, y: 4, name: 'Mouth', say: 'A tiny mouth for gulping copepods.', simple: 'A tiny mouth for tiny food.' },
      { x: -10, y: 8, name: 'Body', say: 'The body is round and a little see-through. It looks very like a baby pufferfish, its cousin.', simple: 'Round, like a baby pufferfish!' },
      { x: 0, y: 24, name: 'Full tummy', say: 'Its tummy is full of copepods and krill.', simple: 'A tummy full of tiny shrimps.', needs: 'cutaway' }
    ] },
    juvenile: { k: 3, draw: (c) => Sprites.drawSunfish(c, { s: 3, form: form(), stage: 'juvenile', flap: .9, spiky: .5, seed: 3 }), parts: [
      { x: 10, y: -40, name: 'Fading spikes', say: 'The spikes shrink away as the young sunfish grows.', simple: 'The spikes go away.' },
      { x: -44, y: 10, name: 'Clavus', say: 'Where a tail would be, a frilly rudder called the clavus is growing.', simple: 'A rudder grows, not a tail!' },
      { x: -24, y: -60, name: 'Top fin', say: 'The top and bottom fins grow tall for flapping.', simple: 'Tall fins for flapping.' },
      { x: 36, y: -7, name: 'Eye', say: 'A young sunfish keeps watch for krill and for its friends in the school.', simple: 'Eyes to find friends and food.' }
    ] },
    boy: { k: 2.5, draw: (c) => { mola(2.5)(c); if (cutaway) { c.save(); c.scale(2.5, 2.5); insides(c, false); c.restore(); } }, parts: OUT.concat(IN) },
    girl: { k: 2.5, draw: (c) => { mola(2.5, { form: form() })(c); if (cutaway) { c.save(); c.scale(2.5, 2.5); insides(c, true); c.restore(); } }, parts: OUT.slice(0, 6).concat([{ x: -8, y: 10, name: 'Eggs', say: 'A big girl sunfish carries hundreds of millions of tiny eggs: more than any other animal with a backbone.', simple: 'Millions and millions of eggs!', needs: 'cutaway' }]) }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.stage === 'egg' ? 'egg' : p.stage === 'larva' ? 'star' : p.stage === 'juvenile' ? 'juvenile' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
