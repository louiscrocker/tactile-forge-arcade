/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: egg, larva, pupa,
   ladybug, aphid, ant.  Tap a label and it is read aloud.  The
   pupa has a cutaway that shows the adult forming inside.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'larva', species = null, cutaway = false, hover = -1, t0 = 0;
  const $ = (id) => document.getElementById(id);

  /* parts: x,y in the sprite's local frame (head +x), with a label and what to say */
  const PARTS = {
    egg: {
      draw: (c) => Sprites.drawEggCluster(c, { s: 9, count: 12, seed: 11 }),
      parts: [
        { x: 0, y: -12, name: 'Eggs', say: 'Ladybug eggs are tiny yellow ovals, laid standing up in a cluster of ten to fifty.', simple: 'Tiny yellow eggs, standing up in a group.' },
        { x: 10, y: 8, name: 'Egg shell', say: 'The shell is thin. When the larva hatches, it often eats the shell as its first meal.', simple: 'The baby eats its shell first!' }
      ]
    },
    larva: {
      draw: (c) => Sprites.drawLarva(c, { s: 5.2, instar: 4, chew: .3 }),
      parts: [
        { x: 34, y: 0, name: 'Head', say: 'The head has simple eyes that see only light and dark, so the larva hunts by touch.', simple: 'The head. Its eyes are weak, so it feels for food.' },
        { x: 44, y: -4, name: 'Mandibles', say: 'Two strong jaws called mandibles grab the aphid and squeeze its juice out.', simple: 'Strong jaws for grabbing aphids.' },
        { x: 40, y: -9, name: 'Antennae', say: 'Short antennae smell and feel the way ahead.', simple: 'Antennae smell and feel.' },
        { x: 16, y: 14, name: 'Legs', say: 'Six legs on the front three segments. The feet have hooks for gripping the stem.', simple: 'Six legs with hooky feet.' },
        { x: 8, y: -10, name: 'Orange spots', say: 'The bright spots are a warning: I taste bad. Each species has its own pattern.', simple: 'Orange spots say: I taste bad!' },
        { x: -10, y: 12, name: 'Spines', say: 'Little spiky bumps called tubercles make the larva hard to grab.', simple: 'Spiky bumps so nothing can grab it.' },
        { x: -18, y: 0, name: 'Segments', say: 'The body is built from segments. Between each pair is soft skin that stretches as the larva grows.', simple: 'The body is made of pieces called segments.' },
        { x: -30, y: 0, name: 'Tail end', say: 'The larva uses a sticky pad at its tail to glue itself down when it is ready to pupate.', simple: 'The tail glues down when it is time to be a pupa.' }
      ]
    },
    pupa: {
      draw: (c) => { c.translate(-100, 0); Sprites.drawPupa(c, { s: 5, prog: .5 }); },
      parts: [
        { x: -100, y: 0, name: 'Attachment', say: 'The tail is glued to the leaf with a sticky pad, and the old larval skin is bunched up around it.', simple: 'The tail is glued to the leaf.' },
        { x: 10, y: -14, name: 'Abdomen rings', say: 'You can still see the abdomen rings. Inside, the body is being taken apart and rebuilt.', simple: 'Inside, the body is being rebuilt.' },
        { x: 40, y: 8, name: 'Wing buds', say: 'Under the shell, wings are forming from small pads called wing buds.', simple: 'Wings are growing inside.' },
        { x: 115, y: 14, name: 'Head cap', say: 'The head of the future ladybug is tucked under here.', simple: 'The new head is tucked in here.' },
        { x: 40, y: -32, name: 'Spots', say: 'A pupa is orange and black, another warning to birds. If touched it flicks upright.', simple: 'Orange and black says: leave me alone!' }
      ]
    },
    adult: {
      draw: (c) => Sprites.drawAdult(c, { s: 4.2, species, open: cutaway ? .9 : 0, wingPhase: 1 }),
      parts: [
        { x: 40, y: 0, name: 'Head', say: 'Compound eyes, short antennae and chewing jaws. Ladybugs are beetles, so they chew, not suck.', simple: 'The head, with eyes and jaws.' },
        { x: 28, y: -12, name: 'Pronotum', say: 'The shield behind the head is the pronotum. Its white patches help tell species apart.', simple: 'The shield behind the head.' },
        { x: -6, y: -16, name: 'Elytra', say: 'The hard spotted shells are the elytra: the front wings, turned into armour. They lift up for flying.', simple: 'The spotted shells are hard front wings.' },
        { x: -8, y: 0, name: 'Seam', say: 'The two shells meet in a straight line down the back.', simple: 'The line where the two shells meet.' },
        { x: -14, y: 14, name: 'Spots', say: 'The spots do not tell you the age. Each species has its own number and pattern.', simple: 'Spots do not tell the age. Each kind has its own.' },
        { x: 4, y: 20, name: 'Legs', say: 'Six short legs. The knees can leak bitter yellow blood to put off attackers.', simple: 'Six legs. The knees can leak yucky yellow blood!' },
        { x: -40, y: -8, name: 'Flight wings', say: 'The real flight wings are thin and fold up under the elytra like origami.', simple: 'Thin wings fold up under the shells.', needs: 'cutaway' }
      ]
    },
    aphid: {
      draw: (c) => Sprites.drawAphid(c, { s: 14, variant: 'green', winged: cutaway }),
      parts: [
        { x: 6, y: 0, name: 'Head', say: 'A tiny head with red eyes and long antennae swept back over the body.', simple: 'A tiny head with red eyes.' },
        { x: 4, y: 1.5, name: 'Proboscis', say: 'A needle-like mouth is pushed into the stem to suck the sweet sap.', simple: 'A needle mouth for drinking plant juice.' },
        { x: -8.5, y: -3, name: 'Cornicles', say: 'The two little pipes at the back are cornicles. They squirt a waxy alarm fluid when the aphid is attacked.', simple: 'Two little tail pipes that squirt alarm goo.' },
        { x: -9.5, y: 0, name: 'Cauda', say: 'The tail flicks honeydew drops away from the body.', simple: 'The tail flicks honeydew away.' },
        { x: -4, y: 3, name: 'Body', say: 'A soft, pear-shaped body full of sap. That is why ladybugs love them.', simple: 'A soft body full of juice. Yum!' },
        { x: -6, y: -5, name: 'Wings', say: 'Some aphids grow wings when the colony is crowded and fly off to start a new one.', simple: 'Some aphids grow wings and fly away.', needs: 'cutaway' }
      ]
    },
    ant: {
      draw: (c) => Sprites.drawAnt(c, { s: 6.5, walk: 0 }),
      parts: [
        { x: 11, y: 0, name: 'Head', say: 'Big jaws and elbowed antennae. Ants talk by touching antennae and by smell.', simple: 'Big jaws. Ants talk by touching antennae.' },
        { x: 16, y: -3, name: 'Mandibles', say: 'The jaws carry food, dig, and pinch anything that threatens the aphids.', simple: 'Jaws for carrying and pinching.' },
        { x: 2, y: 0, name: 'Thorax', say: 'The middle section carries all six legs.', simple: 'The middle. All six legs are here.' },
        { x: -3, y: -1, name: 'Waist', say: 'The narrow waist lets the ant bend to sting or to reach a drop of honeydew.', simple: 'A tiny waist so it can bend.' },
        { x: -11, y: 0, name: 'Gaster', say: 'The back section stores food. An ant can carry honeydew home to feed the whole nest.', simple: 'The back part stores food to take home.' }
      ]
    }
  };

  function init() {
    canvas = $('scopeCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    $('scopeClose').addEventListener('click', close);
    $('scopeCut').addEventListener('click', () => { cutaway = !cutaway; $('scopeCut').classList.toggle('on', cutaway); render(); });
    document.querySelectorAll('#scopePick button').forEach(b => b.addEventListener('click', () => { subject = b.dataset.subject; document.querySelectorAll('#scopePick button').forEach(x => x.classList.toggle('on', x === b)); render(); }));
    canvas.addEventListener('pointermove', (e) => { hover = hitLabel(e); render(); });
    canvas.addEventListener('pointerdown', (e) => {
      const i = hitLabel(e);
      if (i >= 0) { const part = PARTS[subject].parts[i]; hover = i; render(); $('scopeSay').textContent = G_simple() ? part.simple : part.say; Voice.say(G_simple() ? part.simple : part.say, { interrupt: true }); AudioFX.click(); }
    });
  }

  let G_ref = null;
  function G_simple() { return G_ref && G_ref.settings.reading === 'simple'; }

  function open(G, what) {
    G_ref = G;
    species = G.players[0].species;
    if (what) subject = what;
    else {
      const p = G.players[0];
      subject = p.state === 'egg' ? 'egg' : p.stage <= 4 ? 'larva' : p.stage === 5 ? 'pupa' : 'adult';
    }
    document.querySelectorAll('#scopePick button').forEach(x => x.classList.toggle('on', x.dataset.subject === subject));
    $('microscope').hidden = false;
    $('scopeSay').textContent = G_simple() ? 'Tap a label to hear about it.' : 'Tap a label to hear what it is and what it does.';
    t0 = performance.now();
    Bus.emit('microscope');
    render();
  }
  function close() { $('microscope').hidden = true; Voice.stop(); }
  function isOpen() { return !$('microscope').hidden; }

  /* label positions in canvas space */
  function layout() {
    const def = PARTS[subject];
    const cx = W * .42, cy = H * .5;
    const sc = subject === 'aphid' ? 1 : 1;
    const items = [];
    def.parts.forEach((part, i) => {
      if (part.needs === 'cutaway' && !cutaway) return;
      const px = cx + part.x * (subject === 'aphid' ? 14 : subject === 'ant' ? 6.5 : subject === 'egg' ? 9 : subject === 'pupa' ? 5 : subject === 'adult' ? 4.2 : 5.2) * sc;
      const py = cy + part.y * (subject === 'aphid' ? 14 : subject === 'ant' ? 6.5 : subject === 'egg' ? 9 : subject === 'pupa' ? 5 : subject === 'adult' ? 4.2 : 5.2) * sc;
      items.push({ i, part, px, py });
    });
    /* labels down the right side, sorted by y */
    items.sort((a, b) => a.py - b.py);
    const n = items.length, lx = W * .8;
    items.forEach((it, k) => { it.lx = lx; it.ly = H * .12 + (H * .76) * (n === 1 ? .5 : k / (n - 1)); });
    return items;
  }

  function hitLabel(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    const items = layout();
    for (const it of items) if (Math.abs(x - it.lx) < 90 && Math.abs(y - it.ly) < 16) return it.i;
    for (const it of items) if (Math.hypot(x - it.px, y - it.py) < 18) return it.i;
    return -1;
  }

  function render() {
    if (!ctx) return;
    const dpr = 2;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* round lens */
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .42, H * .5, 20, W * .42, H * .5, H * .62);
    g.addColorStop(0, '#f6fbff'); g.addColorStop(1, '#cfe3f3');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(W * .42, H * .5, H * .47, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a6a7a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
    /* reticle */
    ctx.strokeStyle = 'rgba(80,110,140,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * .42 - H * .45, H * .5); ctx.lineTo(W * .42 + H * .45, H * .5); ctx.moveTo(W * .42, H * .05); ctx.lineTo(W * .42, H * .95); ctx.stroke();
    /* subject */
    ctx.save();
    ctx.beginPath(); ctx.arc(W * .42, H * .5, H * .46, 0, TAU); ctx.clip();
    ctx.translate(W * .42, H * .5);
    if (subject === 'pupa' && cutaway) {
      /* the adult forming inside, faint */
      ctx.save(); ctx.globalAlpha = .55; ctx.translate(10, 0); Sprites.drawAdult(ctx, { s: 3.2, species, fresh: .7 }); ctx.restore();
      ctx.globalAlpha = .55;
    }
    PARTS[subject].draw(ctx);
    ctx.restore();
    /* labels */
    const items = layout();
    ctx.font = `800 15px ${UI_FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const it of items) {
      const on = it.i === hover;
      ctx.strokeStyle = on ? '#e0392f' : 'rgba(60,80,100,.6)'; ctx.lineWidth = on ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.lx - 8, it.ly); ctx.stroke();
      ctx.fillStyle = on ? '#e0392f' : '#5a6a7a';
      ctx.beginPath(); ctx.arc(it.px, it.py, on ? 6 : 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? '#e0392f' : 'rgba(255,255,255,.9)';
      const w = ctx.measureText(it.part.name).width + 22;
      rr(ctx, it.lx - 6, it.ly - 14, w, 28, 14); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#23301f';
      ctx.fillText(it.part.name, it.lx + 5, it.ly + 1);
    }
    $('scopeCut').hidden = !(subject === 'adult' || subject === 'pupa' || subject === 'aphid');
    $('scopeCut').textContent = subject === 'adult' ? (cutaway ? 'Close the shells' : 'Lift the shells') : subject === 'pupa' ? (cutaway ? 'Outside view' : 'Look inside') : (cutaway ? 'Without wings' : 'With wings');
  }

  return { init, open, close, isOpen, render };
})();
