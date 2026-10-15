/* ============================================================
   microscope.js — plankton under the microscope
   ============================================================
   A big labelled drawing of whatever you pick: the egg, a nauplius,
   a copepodite, a diatom, a dinoflagellate, a boy copepod, a girl
   copepod.  Tap a label and it is read aloud.  "Look inside" shows
   the baby's eye in the egg, a gut full of diatoms, the oil sac
   and the heart, and a mother's ripe eggs.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'red';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';
  const cop = (c, o) => Sprites.drawCopepod(c, Object.assign({ s: 13, form: form(), step: 12, ph: 1, gut: cutaway ? 1 : .4, oil: cutaway ? .7 : .25 }, o));
  const PARTS = {
    egg: { k: 150, draw: (c) => Sprites.drawEgg(c, { s: 150, eye: cutaway }), parts: [
      { x: -.72, y: -.62, name: 'Egg skin', say: 'A Calanus egg is a tiny glassy ball, about 0.15 millimetres across: smaller than a grain of sand.', simple: 'A tiny ball, smaller than a grain of sand!' },
      { x: .1, y: .35, name: 'Yolk', say: 'The egg is full of yolk. The baby lives on it until its third stage, when it starts to eat.', simple: 'Yolk: food for the baby inside.' },
      { x: .35, y: -.15, name: 'Red eye', say: 'Just before it hatches, you can see the baby\'s one red eye inside.', simple: 'The baby\'s red eye!', needs: 'cutaway' }
    ] },
    nauplius: { k: 34, kx: 1, shift: 20, draw: (c) => Sprites.drawNauplius(c, { s: 34, form: form(), step: 3, ph: .8, gut: cutaway ? 1 : .3 }), parts: [
      { x: 2.3, y: -.7, name: 'One red eye', say: 'The nauplius has one simple eye that can tell light from dark.', simple: 'One red eye!' },
      { x: 3.7, y: -1.6, name: 'Antennules', say: 'The first pair of legs: short feelers at the front.', simple: 'Little feelers.' },
      { x: 4.4, y: 2.2, name: 'Rowing legs', say: 'The second pair, the antennae, have two branches with long bristles. They row it along in little hops.', simple: 'Hairy legs that row!' },
      { x: 1.6, y: 3.9, name: 'Mandibles', say: 'The third pair, the mandibles, help it swim now and chew food later.', simple: 'Legs that help it chew.' },
      { x: -4.3, y: .2, name: 'Tail spines', say: 'It has a little tail with two spines. They grow longer at every moult.', simple: 'Two little tail spines.' },
      { x: -.3, y: .3, name: 'Gut', say: 'Its gut turns green with the diatoms it has eaten.', simple: 'A tummy full of green diatoms.', needs: 'cutaway' }
    ] },
    copepodite: { k: 13, kx: .865, shift: 40, draw: (c) => cop(c, { step: 8, oil: 0 }), parts: [
      { x: 10, y: -.6, name: 'Red eye', say: 'Still one red eye at the front of its head.', simple: 'One red eye.' },
      { x: -3, y: -9.8, name: 'Long feelers', say: 'Now the feelers are long and hairy. They feel the tiniest movement in the water.', simple: 'Long hairy feelers.' },
      { x: 4.5, y: 5, name: 'Swimming legs', say: 'Copepodite II has three pairs of swimming legs. It gets one more pair at each moult, up to five.', simple: 'One more pair of legs at each moult!' },
      { x: -8, y: .3, name: 'Tail', say: 'A copepodite has a tail, the urosome. It gets longer at each moult too.', simple: 'A tail at last!' },
      { x: 2, y: .8, name: 'Gut', say: 'The gut runs the whole length of the body.', simple: 'Its tummy.', needs: 'cutaway' }
    ] },
    diatom: { k: 140, kx: 1, draw: (c) => { c.save(); c.scale(140, 140); Sprites.drawPlankton(c, { x: 0, y: 0, kind: 'diatom', rot: 0 }, 0, 0); c.restore(); }, parts: [
      { x: -.75, y: -.75, name: 'Glass case', say: 'A diatom lives inside a case of glass, made of silica. The case has two halves that fit together like a box and its lid.', simple: 'A tiny house made of glass!' },
      { x: .7, y: .2, name: 'Pattern', say: 'Each kind of diatom has its own pattern of tiny holes and ribs in its glass.', simple: 'A pretty pattern of tiny holes.' },
      { x: .3, y: -.2, name: 'Colour parts', say: 'Inside are the parts that catch sunlight to make food, like the green parts of a leaf.', simple: 'Parts that catch the sunshine.' }
    ] },
    dino: { k: 70, kx: 1, draw: (c) => { c.save(); c.scale(70, 70); Sprites.drawPlankton(c, { x: 0, y: 0, kind: 'dino', rot: 0, glow: cutaway ? 1 : 0 }, cutaway ? .8 : 0, 0); c.restore(); }, parts: [
      { x: -.6, y: -.5, name: 'Shell plates', say: 'A dinoflagellate is one tiny cell, often covered in little plates.', simple: 'One tiny cell with a shell.' },
      { x: .9, y: 0, name: 'Groove', say: 'One whip lies in a groove around its middle and makes it spin.', simple: 'A whip makes it spin.' },
      { x: .3, y: 2.3, name: 'Whip', say: 'A second whip trails behind and pushes it along.', simple: 'A whip pushes it along.' },
      { x: 0, y: 0, name: 'Blue light', say: 'Some dinoflagellates flash blue light when something bumps them. That is bioluminescence.', simple: 'It flashes blue when bumped!', needs: 'cutaway' }
    ] },
    boy: { k: 13, shift: 45, draw: (c) => cop(c, { sex: 'boy' }), parts: [
      { x: 10, y: -.6, name: 'Red eye', say: 'One simple red eye in the middle of the head. It tells light from dark.', simple: 'One red eye!' },
      { x: -6, y: -9.6, name: 'Hairy feelers', say: 'The antennules: a grown boy\'s are extra hairy. He can smell a girl\'s scent trail with them.', simple: 'He smells with his hairy feelers.' },
      { x: 4, y: -3.6, name: 'Hard skin', say: 'The front part of the body, the prosome, is covered by a hard outside skeleton. It moults to grow.', simple: 'A hard skin. It moults to grow.' },
      { x: 3, y: 5.4, name: 'Swimming legs', say: 'Five pairs of flat, hairy swimming legs. Kicked all at once, they make the great escape jump.', simple: 'Legs that kick for a big jump!' },
      { x: -6.4, y: 3.8, name: 'Fifth leg', say: 'A boy\'s fifth leg is long and special: it helps him pair up with a girl.', simple: 'A special leg.' },
      { x: 8.9, y: 3.8, name: 'Mouth legs', say: 'Little mouth legs wave fast to make a current that brings diatoms to the mouth.', simple: 'Little legs that pull food in.' },
      { x: -10, y: .4, name: 'Tail', say: 'The tail, the urosome, ends in long bristles that help it steer.', simple: 'A tail with long bristles.' },
      { x: 1, y: -1.4, name: 'Oil sac', say: 'The oil sac: food stored for hard times. It was full before the long sleep.', simple: 'Its stored oil.', needs: 'cutaway' },
      { x: 4, y: .8, name: 'Gut', say: 'The gut is green with the diatoms it ate.', simple: 'A tummy full of diatoms.', needs: 'cutaway' },
      { x: -1.5, y: -2.7, name: 'Heart', say: 'A tiny heart on its back pumps blood around its body.', simple: 'A tiny heart!', needs: 'cutaway' }
    ] },
    girl: { k: 13, shift: 45, draw: (c) => cop(c, { sex: 'girl', ripe: cutaway }), parts: [
      { x: 10, y: -.6, name: 'Red eye', say: 'One simple red eye, like a boy\'s.', simple: 'One red eye.' },
      { x: -6, y: -9.6, name: 'Feelers', say: 'Her feelers feel the water. As she swims, she leaves a scent trail behind her.', simple: 'Her feelers.' },
      { x: 3, y: 5.4, name: 'Swimming legs', say: 'Five pairs of swimming legs, for swimming and jumping.', simple: 'Legs for swimming.' },
      { x: -6.2, y: 1.6, name: 'Egg opening', say: 'Under the front of her tail is where her eggs come out. Calanus lets them go into the sea.', simple: 'Her eggs come out here.' },
      { x: -11, y: .4, name: 'Tail', say: 'Her tail has four parts; a boy\'s has five.', simple: 'Her tail.' },
      { x: 2, y: -2.5, name: 'Ripe eggs', say: 'When she has eaten plenty of diatoms, a row of eggs grows along her back. She can lay dozens a night.', simple: 'Her eggs are growing!', needs: 'cutaway' },
      { x: 1, y: -1.2, name: 'Oil sac', say: 'Her oil sac, smaller after the long sleep.', simple: 'Her stored oil.', needs: 'cutaway' }
    ] }
  };

  function pos(def, part) { return { x: part.x * def.k * (def.kx || 1.045), y: part.y * def.k }; }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.step === 0 ? 'egg' : p.step <= 6 ? 'nauplius' : p.step <= 11 ? 'copepodite' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide the eggs' : 'Show her eggs') : subject === 'dino' ? (cutaway ? 'Lights off' : 'Bump it!') : cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render, PARTS };
})();
