/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: egg, tadpole,
   froglet, frog, wriggler, dragonfly nymph.  Tap a label and it
   is read aloud.  "Look inside" shows the legs forming in the
   tadpole, the tongue rooted at the front of the frog's mouth,
   and the nymph's jaw shot out.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'tadpole', species = null, cutaway = false, hover = -1, t0 = 0, open = false, raf = 0;
  const $ = (id) => document.getElementById(id);

  const PARTS = {
    egg: {
      draw: (c) => Sprites.drawEggMass(c, { s: 6.5, count: 14, seed: 11, dev: cutaway ? 1 : .2 }),
      parts: [
        { x: 0, y: -20, name: 'Jelly', say: 'Each egg sits in a ball of clear jelly. The jelly protects it, holds it together with hundreds of others, and keeps it a little warmer.', simple: 'Clear jelly keeps the eggs safe and warm.' },
        { x: 12, y: 6, name: 'Egg', say: 'The black dot is the embryo. Dark colours soak up sunlight so it develops faster.', simple: 'The black dot is the baby. Dark colours stay warm in the sun.' },
        { x: -14, y: 10, name: 'Tail forming', say: 'After a week the dot stretches into a comma. That is the tail forming. Soon it wriggles free.', simple: 'The dot turns into a comma. That is the tail!', needs: 'cutaway' }
      ]
    },
    tadpole: {
      draw: (c) => Sprites.drawTadpole(c, { s: 5.5, species, kick: 1, swim: .4, legs: cutaway ? .7 : 0, arms: 0 }),
      parts: [
        { x: 12, y: -4, name: 'Eye', say: 'Small eyes on the sides of the head, good for spotting shadows from above.', simple: 'Little eyes on the sides.' },
        { x: 14, y: 4, name: 'Mouth', say: 'A tiny beak with rows of scraping teeth, made for rasping algae off rocks and weeds.', simple: 'A tiny scraping mouth for eating algae.' },
        { x: 4, y: 8, name: 'Belly', say: 'A long coiled gut inside, because plants take a lot of digesting. It shortens when the tadpole turns into a bug-eating frog.', simple: 'A big belly with a long, coiled gut inside.' },
        { x: -4, y: -6, name: 'Gills', say: 'Water goes in the mouth and out over gills hidden inside the body, through a little hole called the spiracle.', simple: 'Gills inside breathe water, like a fish.' },
        { x: -30, y: 0, name: 'Tail', say: 'A big muscle with a thin see-through fin. Later it is absorbed back into the body.', simple: 'A strong tail with a see-through fin.' },
        { x: -8, y: 12, name: 'Leg buds', say: 'Two tiny buds at the root of the tail become the back legs.', simple: 'Tiny bumps that turn into back legs.', needs: 'cutaway' }
      ]
    },
    froglet: {
      draw: (c) => Sprites.drawFrog(c, { s: 5, species, pose: 'sit', tail: cutaway ? .6 : .25 }),
      parts: [
        { x: -30, y: 0, name: 'Tail stub', say: 'The last bit of tail, still being absorbed. It disappears within days.', simple: 'The last bit of tail. It is almost gone.' },
        { x: -22, y: 6, name: 'Back legs', say: 'Long folded legs with webbed toes: a spring for jumping and a paddle for swimming.', simple: 'Long legs with webbed toes.' },
        { x: 14, y: -13, name: 'Eyes', say: 'Now on top of the head, so a froglet can float with just its eyes above the water.', simple: 'Eyes on top, to peek out of the water.' },
        { x: 20, y: 2, name: 'Wide mouth', say: 'The scraping beak is gone. This mouth is wide for catching bugs.', simple: 'A wide mouth for bugs.' },
        { x: 2, y: -12, name: 'Skin', say: 'Thin, wet skin that breathes. It must stay damp.', simple: 'Wet skin that breathes.' }
      ]
    },
    frog: {
      draw: (c) => Sprites.drawFrog(c, { s: 5, species, pose: 'sit', tongue: cutaway ? .6 : 0, tongueLen: 40, tongueDy: -10, throat: cutaway ? 0 : .3 }),
      parts: [
        { x: 14, y: -13, name: 'Eye', say: 'Big bulging eyes see almost all the way round. When a frog swallows, it pulls its eyes down to push the food.', simple: 'Big eyes that help push food down!' },
        { x: 6, y: -5, name: 'Eardrum', say: 'The round patch behind the eye is the tympanum, the eardrum. Frogs hear the chorus with it.', simple: 'The round patch is the ear.' },
        { x: -12, y: -12, name: 'Back', say: 'Each species has its own colours and pattern: ridges, spots, a mask, or an X.', simple: 'Every kind of frog has its own pattern.' },
        { x: -24, y: 6, name: 'Back legs', say: 'Huge leg muscles. Some frogs jump twenty times their body length.', simple: 'Huge legs for huge jumps.' },
        { x: 14, y: 12, name: 'Front legs', say: 'Short front legs with four fingers and no webbing, for landing and pushing food in.', simple: 'Short arms with four fingers.' },
        { x: 12, y: 8, name: 'Throat sac', say: 'The stretchy vocal sac fills like a balloon to make the call loud.', simple: 'The throat blows up like a balloon to sing.' },
        { x: 48, y: -6, name: 'Tongue', say: 'The tongue is fixed at the front of the mouth and flips out. Its spit turns sticky on impact.', simple: 'The tongue is stuck at the front and flips out.', needs: 'cutaway' }
      ]
    },
    wriggler: {
      draw: (c) => { c.translate(0, -60); Sprites.drawWriggler(c, { s: 8, ph: 1, wriggle: cutaway ? 0 : 1 }); },
      parts: [
        { x: -2, y: -4, name: 'Siphon', say: 'A little breathing tube at the tail end. The wriggler hangs from the surface by it to take in air.', simple: 'A snorkel on its tail to breathe.' },
        { x: 6, y: 8, name: 'Body', say: 'Segments with tufts of hair. Wriggling the whole body is how it dives.', simple: 'A wriggly body with hairs.' },
        { x: 6, y: 17, name: 'Head', say: 'Brush-like mouthparts sweep tiny bits of food out of the water.', simple: 'A head with little brushes for eating.' },
        { x: 0, y: 12, name: 'Pupa next', say: 'After a week it becomes a comma-shaped pupa, then climbs out of the water as an adult mosquito.', simple: 'Soon it becomes a mosquito and flies away.', needs: 'cutaway' }
      ]
    },
    nymph: {
      draw: (c) => Sprites.drawNymph(c, { s: 5.5, jaw: cutaway ? 1 : .05 }),
      parts: [
        { x: 13, y: -3, name: 'Eyes', say: 'Big compound eyes that see movement well. Nymphs hunt by sight.', simple: 'Big eyes for spotting tadpoles.' },
        { x: 4, y: 8, name: 'Legs', say: 'Six legs for creeping along the bottom. It also jets by squirting water from its rear end.', simple: 'Six legs for creeping. It can jet too!' },
        { x: -14, y: 0, name: 'Abdomen', say: 'The abdomen has gills inside it. Water is pumped in and out to breathe.', simple: 'It breathes with gills inside its tail end.' },
        { x: -12, y: -10, name: 'Wing pads', say: 'Small pads on the back where the dragonfly wings are growing.', simple: 'Little bumps where wings are growing.' },
        { x: 34, y: 2, name: 'Mask', say: 'The hinged lower lip, called the mask, shoots forward in a fraction of a second and grabs prey with hooks.', simple: 'The jaw shoots out and grabs!', needs: 'cutaway' }
      ]
    }
  };
  const NAMES = { egg: 'Egg', tadpole: 'Tadpole', froglet: 'Froglet', frog: 'Frog', wriggler: 'Wriggler', nymph: 'Nymph' };

  function init() {
    canvas = $('scopeCanvas'); if (!canvas) return;
    ctx = canvas.getContext('2d');
    $('scopeClose').addEventListener('click', close);
    $('scopePick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { subject = b.dataset.subject; cutaway = false; refreshButtons(); AudioFX.click(); Voice.say(NAMES[subject], { interrupt: true }); }));
    $('scopeCut').addEventListener('click', () => { cutaway = !cutaway; refreshButtons(); AudioFX.click(); });
    canvas.addEventListener('pointermove', (e) => { hover = hitLabel(e); canvas.style.cursor = hover >= 0 ? 'pointer' : 'default'; });
    canvas.addEventListener('pointerdown', (e) => { const i = hitLabel(e); if (i >= 0) sayPart(i); });
  }
  function refreshButtons() {
    $('scopePick').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.subject === subject));
    $('scopeCut').classList.toggle('on', cutaway);
    $('scopeCut').textContent = { egg: 'A week later', tadpole: 'Look inside', froglet: 'Earlier', frog: 'Open mouth', wriggler: 'Hold still', nymph: 'Strike!' }[subject] || 'Look inside';
  }
  function sayPart(i) {
    const G = window.G;
    const part = layout()[i];
    const simple = G && G.settings.reading === 'simple';
    $('scopeSay').textContent = `${part.name}: ${simple ? part.simple : part.say}`;
    Voice.say(`${part.name}. ${simple ? part.simple : part.say}`, { interrupt: true, force: true });
    AudioFX.click();
  }
  function visibleParts() { return PARTS[subject].parts.filter(p => !p.needs || (p.needs === 'cutaway' && cutaway)); }
  /* label positions: alternate left / right of the drawing */
  function layout() {
    const parts = visibleParts();
    const cx = W * .5, cy = H * .52;
    const out = [];
    const left = parts.filter((p, i) => i % 2 === 0), right = parts.filter((p, i) => i % 2 === 1);
    left.forEach((p, i) => out.push(Object.assign({}, p, { lx: 90, ly: 70 + i * (H - 120) / Math.max(1, left.length - 1 || 1), ax: cx + p.x * scaleOf(), ay: cy + p.y * scaleOf(), side: -1 })));
    right.forEach((p, i) => out.push(Object.assign({}, p, { lx: W - 90, ly: 70 + i * (H - 120) / Math.max(1, right.length - 1 || 1), ax: cx + p.x * scaleOf(), ay: cy + p.y * scaleOf(), side: 1 })));
    return out;
  }
  function scaleOf() { return { egg: 6.5, tadpole: 5.5, froglet: 5, frog: 5, wriggler: 8, nymph: 5.5 }[subject]; }
  function hitLabel(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    const L = layout();
    for (let i = 0; i < L.length; i++) { const p = L[i]; if (Math.abs(x - p.lx) < 70 && Math.abs(y - p.ly) < 16) return i; }
    return -1;
  }

  function draw() {
    if (!open) return;
    const dpr = 2;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = (performance.now() - t0) / 1000;
    /* dish */
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .6);
    g.addColorStop(0, '#f2f8fb'); g.addColorStop(1, '#d4e3ea');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(40,80,90,.12)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(40,80,90,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * .47, 0, TAU); ctx.stroke();
    /* subject */
    ctx.save(); ctx.translate(W / 2, H * .52);
    ctx.translate(0, Math.sin(t * 1.2) * 3);
    PARTS[subject].draw(ctx);
    ctx.restore();
    /* labels */
    const L = layout();
    ctx.font = `800 14px ${UI_FONT}`; ctx.textBaseline = 'middle';
    L.forEach((p, i) => {
      const hot = i === hover;
      ctx.strokeStyle = hot ? '#e0392f' : 'rgba(40,60,70,.55)'; ctx.lineWidth = hot ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(p.lx + p.side * -62, p.ly); ctx.lineTo(p.ax, p.ay); ctx.stroke();
      ctx.fillStyle = hot ? '#e0392f' : '#2a4a55'; ctx.beginPath(); ctx.arc(p.ax, p.ay, hot ? 5 : 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = hot ? '#e0392f' : 'rgba(255,255,255,.92)';
      rr(ctx, p.lx - 66, p.ly - 14, 132, 28, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(40,60,70,.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = hot ? '#fff' : '#1f3a44'; ctx.textAlign = 'center'; ctx.fillText(p.name, p.lx, p.ly);
    });
    raf = requestAnimationFrame(draw);
  }

  function openScope(G, subj) {
    if (!canvas) return;
    species = G.speciesDef();
    if (subj) subject = subj;
    cutaway = false; hover = -1; t0 = performance.now(); open = true;
    refreshButtons();
    $('scopeSay').textContent = 'Tap a label to hear what it is and what it does.';
    $('microscope').hidden = false;
    cancelAnimationFrame(raf); draw();
    Bus.emit('microscope', subject);
    Voice.say(`${NAMES[subject]} under the microscope. Tap a label to hear about it.`, { interrupt: true });
  }
  function close() { open = false; cancelAnimationFrame(raf); if ($('microscope')) $('microscope').hidden = true; }
  function isOpen() { return open; }

  return { init, open: openScope, close, isOpen };
})();
