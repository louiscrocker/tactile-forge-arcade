/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: a newborn cub, a
   cub, a boy bear, a girl bear, a paw.  Tap a label and it is read
   aloud.  "Look inside" shows a big male's 42 teeth, a mother's
   clear hairs, black skin and thick fat, a cub's double coat, and
   the underside of a paw (black pads, furry soles, little bumps).
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'cream';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  /* a bear's open jaw, side on: big canines, small front teeth, flat chewing teeth at the back */
  function jaw(c, k) {
    c.save(); c.translate(52 * k, 0); c.scale(k * .75, k * .75);
    c.fillStyle = 'rgba(255,255,255,.94)'; c.strokeStyle = '#8a8070'; c.lineWidth = 1.2; c.beginPath(); c.arc(14, 8, 32, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#4a2a34'; c.beginPath(); c.moveTo(-20, 0); c.lineTo(48, -4); c.lineTo(48, 14); c.lineTo(-20, 18); c.closePath(); c.fill();
    c.fillStyle = '#3a3050'; c.beginPath(); c.ellipse(10, 12, 16, 4, 0, 0, TAU); c.fill();
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#b8a890'; c.lineWidth = .7;
    for (let i = 0; i < 7; i++) { const x = -14 + i * 8.3, h = i === 5 ? 15 : i === 6 ? 6 : 6; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 3, h); c.lineTo(x + 6, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x, 16); c.lineTo(x + 3, 16 - h * .8); c.lineTo(x + 6, 16); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  /* a slice through a polar bear's side: clear hollow-looking guard hairs, soft underfur, black skin, thick fat */
  function layers(c, k) {
    c.save(); c.translate(-24 * k, -6 * k); c.scale(k * .5, k * .5);
    c.fillStyle = 'rgba(255,255,255,.95)'; c.strokeStyle = '#8a8070'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, 0, 46, 40, 0, 0, TAU); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.ellipse(0, 0, 45, 39, 0, 0, TAU); c.clip();
    c.fillStyle = '#ffe9b8'; c.fillRect(-46, 10, 92, 34);                 /* fat */
    c.fillStyle = '#1e1a1c'; c.fillRect(-46, 4, 92, 7);                    /* black skin */
    c.strokeStyle = '#e8e2d8'; c.lineWidth = 1; for (let i = 0; i < 40; i++) { const x = -44 + i * 2.2; c.beginPath(); c.moveTo(x, 4); c.quadraticCurveTo(x + 2, -2, x + 1 + Math.sin(i) * 2, -8); c.stroke(); }   /* underfur */
    c.strokeStyle = 'rgba(190,215,235,.95)'; c.lineWidth = 2.2; for (let i = 0; i < 11; i++) { const x = -42 + i * 8; c.beginPath(); c.moveTo(x, 4); c.quadraticCurveTo(x + 4, -16, x + 8, -34); c.stroke(); }   /* clear guard hairs */
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = .7; for (let i = 0; i < 11; i++) { const x = -42 + i * 8; c.beginPath(); c.moveTo(x + 1, 0); c.quadraticCurveTo(x + 4.5, -16, x + 8, -30); c.stroke(); }   /* their hollow middles */
    c.restore(); c.restore();
  }
  function paw(c, k, under) {
    c.save(); c.scale(k, k);
    if (!under) {
      c.fillStyle = '#eef4ff'; c.beginPath(); c.ellipse(0, 4, 64, 52, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(150,180,215,.9)';
      c.beginPath(); c.ellipse(0, 14, 26, 18, 0, 0, TAU); c.fill();
      for (let t = 0; t < 5; t++) { const x = -26 + t * 13, y = -14 - Math.sin(t / 4 * Math.PI) * 8; c.beginPath(); c.ellipse(x, y, 6, 7.5, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 2, y - 7); c.lineTo(x, y - 15); c.lineTo(x + 2, y - 7); c.fill(); }
    } else {
      c.fillStyle = '#f2efe6'; c.beginPath(); c.ellipse(0, 2, 60, 54, 0, 0, TAU); c.fill(); c.strokeStyle = '#c8c4b8'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#1e1a1c'; c.beginPath(); c.ellipse(0, 14, 24, 15, 0, 0, TAU); c.fill();
      for (let t = 0; t < 5; t++) { const x = -26 + t * 13, y = -16 - Math.sin(t / 4 * Math.PI) * 8; c.beginPath(); c.ellipse(x, y, 6, 7, 0, 0, TAU); c.fill(); c.fillStyle = '#3a3430'; c.beginPath(); c.moveTo(x - 2, y - 7); c.lineTo(x, y - 16); c.lineTo(x + 2, y - 7); c.fill(); c.fillStyle = '#1e1a1c'; }
      c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(-18 + (i % 6) * 7, 8 + ((i / 6) | 0) * 3.5, .9, 0, TAU); c.fill(); }   /* little bumps that grip the ice */
      c.strokeStyle = '#d8d2c4'; c.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 30, 14 + Math.sin(a) * 20); c.lineTo(Math.cos(a) * 38, 14 + Math.sin(a) * 26); c.stroke(); }   /* fur between the pads */
    }
    c.restore();
  }
  const PARTS = {
    newborn: { k: 3.6, shift: -10, draw: (c) => { Sprites.drawBear(c, { s: 3.6, form: form(), age: 0, lie: true, eyes: 0, seed: 3 }); }, parts: [
      { x: 30, y: -14, name: 'Shut eyes', say: 'A newborn cub\'s eyes are shut. They open when it is about one month old.', simple: 'Its eyes are shut for a month.' },
      { x: -10, y: -16, name: 'Thin fur', say: 'A newborn has only short, thin fur, so its pink skin shows through. It needs its mother\'s warmth.', simple: 'Thin fur. It needs Mum to keep warm.' },
      { x: 16, y: -26, name: 'Little ears', say: 'Small round ears, close to the head.', simple: 'Little round ears.' },
      { x: 42, y: -10, name: 'Nose', say: 'A newborn finds its mother by smell and warmth. Its nose works from the very first day.', simple: 'Its nose works from day one!' },
      { x: -4, y: 12, name: 'Round tummy', say: 'About 600 grams at birth, like a guinea pig, and full of rich milk.', simple: 'Full of milk. It grows fast!' }
    ] },
    cub: { k: 3.2, shift: 0, draw: (c) => { Sprites.drawBear(c, { s: 3.2, form: form(), age: .26, seed: 3 }); if (cutaway) layers(c, 3.2); }, parts: [
      { x: 25, y: -26, name: 'Dark eyes', say: 'Bright dark eyes. A cub watches everything its mother does.', simple: 'Dark eyes that watch Mum.' },
      { x: 12, y: -36, name: 'Round ears', say: 'A cub\'s ears look big and round. They are small and furry, so they lose little heat.', simple: 'Round furry ears.' },
      { x: 40, y: -18, name: 'Short nose', say: 'A cub has a short nose. It grows longer as the cub grows up.', simple: 'A short little nose.' },
      { x: 18, y: 32, name: 'Big paws', say: 'A cub\'s paws look too big for it. They are snowshoes and paddles.', simple: 'Big paws to grow into!' },
      { x: -40, y: -6, name: 'Fluffy coat', say: 'By spring the cub has a thick, fluffy coat, ready for the cold walk to the sea.', simple: 'A thick fluffy coat.' },
      { x: -18, y: -10, name: 'Two kinds of fur', say: 'Soft underfur close to the skin, and long clear guard hairs on top.', simple: 'Soft fur, and long hairs on top.', needs: 'cutaway' }
    ] },
    boy: { k: 3, shift: -45, draw: (c) => { Sprites.drawBear(c, { s: 3, form: form(), age: 1, sex: 'boy', seed: 3 }); if (cutaway) jaw(c, 3); }, parts: [
      { x: 25, y: -20, name: 'Small eyes', say: 'Small dark eyes. A polar bear sees well, but it trusts its nose most.', simple: 'Small dark eyes.' },
      { x: 18, y: -26, name: 'Small ears', say: 'Small round ears lose less heat than big ones.', simple: 'Small round ears.' },
      { x: 46, y: -18, name: 'Black nose', say: 'A polar bear can smell a seal nearly a kilometre away, even under deep snow.', simple: 'A super nose!' },
      { x: 4, y: -24, name: 'Long neck', say: 'A long neck and a narrow head help a polar bear reach into breathing holes and swim.', simple: 'A long neck.' },
      { x: -30, y: -22, name: 'High hips', say: 'A polar bear\'s back end is often higher than its shoulders.', simple: 'High hips.' },
      { x: 18, y: 30, name: 'Huge paws', say: 'Paws up to 30 centimetres across: snowshoes on the ice and paddles in the sea.', simple: 'Huge paws for snow and swimming.' },
      { x: 60, y: 6, name: '42 teeth', say: 'A grown polar bear has 42 teeth: big pointed canines and sharp teeth for eating, and its tongue is blue-black.', simple: 'Forty-two teeth!', needs: 'cutaway' }
    ] },
    girl: { k: 3.1, shift: -45, draw: (c) => { Sprites.drawBear(c, { s: 3.1, form: form(), age: 1, sex: 'girl', collar: true, seed: 5 }); if (cutaway) layers(c, 3.1); }, parts: [
      { x: -12, y: -22, name: 'Smaller', say: 'A female is about half as heavy as a big male: often 150 to 250 kilograms.', simple: 'About half as big as a boy.' },
      { x: 22, y: -2, name: 'Radio collar', say: 'Scientists put radio collars on some mother bears to follow them. Males cannot wear one: their necks are wider than their heads.', simple: 'A radio collar.' },
      { x: -2, y: 10, name: 'Milk', say: 'A mother makes very rich milk for her cubs, about a third fat.', simple: 'Rich milk for the cubs.' },
      { x: -26, y: -18, name: 'Clear hairs', say: 'Each long hair is clear, with a hollow-looking middle. It scatters the light, so the coat looks white.', simple: 'The hairs are clear, not white!', needs: 'cutaway' },
      { x: -26, y: -6, name: 'Black skin', say: 'Under the fur, a polar bear\'s skin is black.', simple: 'Black skin under the fur!', needs: 'cutaway' },
      { x: -22, y: 6, name: 'Thick fat', say: 'A layer of fat up to ten centimetres thick keeps her warm and feeds her all winter in the den.', simple: 'Thick fat keeps her warm.', needs: 'cutaway' }
    ] },
    paw: { k: 2.5, draw: (c) => paw(c, 2.5, cutaway), parts: [
      { x: 0, y: 14, name: 'Big pad', say: 'The big pad takes the bear\'s weight. A polar bear\'s track can be as wide as a dinner plate.', simple: 'The big pad.' },
      { x: -26, y: -14, name: 'Five toes', say: 'Five toes, each with a pad, in a gentle curve.', simple: 'Five toes.' },
      { x: 13, y: -38, name: 'Claws', say: 'Short, thick, curved claws grip the ice and do not pull in.', simple: 'Claws grip the ice.' },
      { x: 34, y: 18, name: 'Furry sole', say: 'Fur grows between the pads, keeping the paw warm and stopping it from slipping.', simple: 'Fur on the bottom of the paw!', needs: 'cutaway' },
      { x: -8, y: 18, name: 'Little bumps', say: 'The black pads are covered in tiny bumps that grip the ice like the sole of a boot.', simple: 'Tiny bumps grip the ice.', needs: 'cutaway' }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.age <= 1 ? 'newborn' : p.age <= 3 ? 'cub' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    g.addColorStop(0, '#f4f8ff'); g.addColorStop(1, '#b8cce0');
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
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide the slice' : 'Look under her fur') : subject === 'cub' ? (cutaway ? 'Hide the slice' : 'Look at the fur') : subject === 'paw' ? (cutaway ? 'In the snow' : 'Turn it over') : cutaway ? 'Close the mouth' : 'Show the teeth';
  }
  return { init, open, close, isOpen, render };
})();
