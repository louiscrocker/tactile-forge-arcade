/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: egg, grub, pupa,
   male, female, or the wing cases (dry and damp).  Tap a label
   and it is read aloud.  "Look inside" shows the grub's gut full
   of wood, the beetle inside the pupa, the flying wings under
   the wing cases, and the wing cases gone black in damp air.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'male', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'hercules';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';
  const GR = 56, grubPts = () => Sprites.grubShape(GR, .85, 0);

  /* parts: x,y in the drawing's own units (× k), or at() for computed spots */
  const PARTS = {
    egg: { k: 14, draw: (c) => { c.scale(14, 14); Sprites.drawEgg(c, { grow: cutaway ? 1 : .2 }); }, parts: [
      { x: 0, y: -3, name: 'Egg', say: 'A Hercules beetle egg is white and roughly the size of a pea. It swells as the grub grows inside.', simple: 'A white egg, as big as a pea.' },
      { x: 3, y: 2, name: 'Rotting wood', say: 'The mother lays each egg in soft, rotting wood or soil, so the grub has food the moment it hatches.', simple: 'Laid in rotting wood: food is ready!' },
      { x: -1, y: 0, name: 'Grub inside', say: 'Inside, a tiny curled grub is growing. When it is ready it chews its way out.', simple: 'A tiny grub is growing inside.', needs: 'cutaway' }
    ] },
    grub: { k: 1, draw: (c) => { c.translate(0, -10); Sprites.drawGrub(c, grubPts(), GR, { instar: 3 }); if (cutaway) { const p = grubPts(); c.fillStyle = 'rgba(120,80,40,.55)'; c.beginPath(); for (let k = 5; k <= 16; k++) c.lineTo(p[k].x, p[k].y); for (let k = 16; k >= 5; k--) c.lineTo(p[k].x * .82, p[k].y * .82 + 6); c.fill(); } }, parts: [
      { at: () => grubPts()[0], name: 'Hard head', say: 'The head is hard and brown, with no eyes to speak of. It lives in the dark.', simple: 'A hard brown head.' },
      { at: () => { const p = grubPts()[0]; return { x: p.x + 40, y: p.y + 8 }; }, name: 'Jaws', say: 'Strong jaws, called mandibles, shred rotting wood into tiny bits.', simple: 'Strong jaws for chewing wood.' },
      { at: () => { const p = grubPts()[3]; return { x: p.x + 30, y: p.y + 30 }; }, name: 'Six legs', say: 'Six short legs near the head. A grub mostly moves by wriggling.', simple: 'Six little legs.' },
      { at: () => { const p = grubPts()[9]; return { x: p.x - 16, y: p.y - 4 }; }, name: 'Spiracles', say: 'The brown dots along the side are spiracles: holes for breathing.', simple: 'Holes for breathing!' },
      { at: () => grubPts()[15], name: 'Dark rear', say: 'The back end looks grey because the gut inside is full of wood.', simple: 'Grey because it is full of wood.' },
      { at: () => { const p = grubPts()[11]; return { x: p.x * .9, y: p.y * .9 }; }, name: 'Gut', say: 'A long gut full of chewed wood. Microbes living in it help to break the wood down.', simple: 'A tummy full of wood, and tiny helpers.', needs: 'cutaway' }
    ] },
    pupa: { k: 3.3, shift: 20, draw: (c) => { Sprites.drawPupa(c, { s: 3.3, lengthMM: 160, progress: cutaway ? .9 : .2 }); }, parts: [
      { x: 30, y: -24, name: 'Horn case', say: 'A male pupa already shows the shape of his long horn, in a soft case.', simple: 'His horn is already there!' },
      { x: 4, y: 16, name: 'Folded legs', say: 'The legs are folded against the body, waiting.', simple: 'Legs folded up.' },
      { x: -2, y: 4, name: 'Wing pads', say: 'Wing pads: the wings and wing cases grow here.', simple: 'The wings grow here.' },
      { x: -40, y: -4, name: 'Abdomen', say: 'The rings of the abdomen can wiggle a little if the pupa is disturbed.', simple: 'It can wiggle a little.' },
      { x: 10, y: -6, name: 'Darkening', say: 'Near the end the pupa turns brown as the beetle inside gets ready.', simple: 'It goes brown when it is nearly ready.', needs: 'cutaway' }
    ] },
    male: { k: 2.2, shift: -40, draw: (c) => Sprites.drawBeetle(c, { s: 2.2, form: form(), wet: 0, lengthMM: 165, seed: 3, open: cutaway ? 1 : 0, flap: .5 }), parts: [
      { x: 118, y: -20, name: 'Thorax horn', say: 'The long top horn grows from the thorax, the beetle\'s chest. It can be longer than the rest of the body.', simple: 'The big top horn grows from its chest.' },
      { x: 86, y: -22, name: 'Head horn', say: 'The shorter horn grows from the head and curves up. Together the horns work like pincers.', simple: 'The head horn. The horns pinch like a claw.' },
      { x: 72, y: -14, name: 'Golden hair', say: 'A fringe of golden hair grows under the top horn. Nobody is sure exactly what it is for.', simple: 'Golden hair under the horn!' },
      { x: 20, y: -18, name: 'Pronotum', say: 'The shiny black shield behind the head is the pronotum. The big horn grows out of it.', simple: 'A shiny black shield.' },
      { x: 44, y: 1, name: 'Eye', say: 'Compound eyes made of many tiny lenses. Hercules beetles see well in the dark.', simple: 'Eyes for seeing in the dark.' },
      { x: 52, y: 12, name: 'Mouth brush', say: 'Brushy mouthparts lap up fruit juice. Adults do not chew wood any more.', simple: 'A brush for licking fruit juice.' },
      { x: -28, y: -24, name: 'Wing cases', say: 'The hard wing cases, called elytra, protect the flying wings. They are olive or yellow when dry.', simple: 'Hard wing cases.' },
      { x: 62, y: 28, name: 'Legs and claws', say: 'Six strong legs with spines and hooked claws for gripping bark.', simple: 'Six legs with hooks for holding on.' },
      { x: -60, y: -50, name: 'Flying wings', say: 'Thin flying wings fold up under the wing cases. They unfold to fly.', simple: 'Thin wings fold up underneath.', needs: 'cutaway' }
    ] },
    female: { k: 2.6, shift: -10, draw: (c) => Sprites.drawBeetle(c, { s: 2.6, male: false, form: form(), wet: .2, lengthMM: 65, seed: 5 }), parts: [
      { x: 30, y: -14, name: 'No horns', say: 'Female Hercules beetles have no horns. They do not wrestle.', simple: 'Girls have no horns.' },
      { x: -28, y: -22, name: 'Hairy wing cases', say: 'Her wing cases are usually brown or black and a little hairy.', simple: 'Brown, a little bit hairy.' },
      { x: -40, y: 0, name: 'Egg layer', say: 'She lays her eggs in rotting logs and soil, where her grubs will find food.', simple: 'She lays the eggs in rotting logs.' },
      { x: 50, y: 24, name: 'Strong legs', say: 'Strong front legs for digging down into wood and soil to lay her eggs.', simple: 'Digging legs.' }
    ] },
    wings: { k: 2.6, shift: 70, draw: (c) => { c.translate(30, 0); Sprites.drawBeetle(c, { s: 2.6, form: form(), wet: cutaway ? 1 : 0, lengthMM: 150, seed: 4 }); }, parts: [
      { x: -26, y: -26, name: 'Wing case', say: 'In dry air the wing cases are olive or yellow, with black spots on many beetles.', simple: 'Dry air: yellow wings.' },
      { x: -50, y: -10, name: 'Spots', say: 'The spots are part of the black layer underneath, showing through.', simple: 'Black spots.' },
      { x: -26, y: -26, name: 'Black in the damp', say: 'When the air is damp, water soaks into a spongy layer and the case turns black. When it dries, it turns yellow again.', simple: 'Wet air: black wings!', needs: 'cutaway' }
    ] }
  };

  function pos(def, part) { if (part.at) { const q = part.at(); return { x: q.x, y: q.y - 10 }; } return { x: part.x * def.k, y: part.y * def.k }; }
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
    else { const p = G.players[0]; subject = !p || p.stage === 'adult' ? 'male' : p.stage === 'egg' ? 'egg' : p.stage === 'pupa' ? 'pupa' : 'grub'; }
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
    def.parts.forEach((part, i) => { if (part.needs === 'cutaway' && !cutaway) return; if (part.needs !== 'cutaway' && cutaway && subject === 'wings' && i === 0) return; const q = pos(def, part); items.push({ i, part, px: cx + q.x, py: cy + q.y }); });
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
    ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 10; ctx.stroke();
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
    $('scopeCut').textContent = subject === 'wings' ? (cutaway ? 'Dry air' : 'Damp air') : subject === 'male' ? (cutaway ? 'Wings closed' : 'Open the wings') : (cutaway ? 'Outside view' : 'Look inside');
  }
  return { init, open, close, isOpen, render };
})();
