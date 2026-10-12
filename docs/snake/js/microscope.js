/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: a newborn in its
   bag, scales and belly scutes (inside: the backbone and ribs), a
   shed skin, the tongue (inside: the Jacobson's organ), the eye
   and its clear spectacle (inside: the milky layer before a shed),
   a boy (inside: heart, long lung, backbone) and a girl (inside:
   her babies growing).  Tap a label and it is read aloud.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'eastern';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';
  const F = () => FORMS[form()] || FORMS.eastern;

  function bigSnake(c, len, th, opts = {}) {
    const P = Sprites.posePts('crawl', len, th).map(q => ({ x: q.x, y: q.y, z: q.z * .7, c: 0 }));
    Sprites.drawSnake(c, P, Object.assign({ thick: th, form: form(), shadow: false, tongue: .5 }, opts));
    return P;
  }
  function scales(c) {
    const f = F();
    c.fillStyle = f.back2; c.fillRect(-260, -180, 520, 360);
    for (let r = -6; r <= 3; r++) for (let k = -10; k <= 10; k++) {
      const x = k * 30 + (r % 2 ? 15 : 0), y = r * 24;
      c.fillStyle = r === -2 ? f.stripe : r === 2 ? f.stripe : (k + r) % 3 === 0 ? f.check : f.back;
      c.beginPath(); c.moveTo(x - 15, y); c.quadraticCurveTo(x, y - 16, x + 15, y); c.quadraticCurveTo(x, y + 16, x - 15, y); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.stroke();
    }
    for (let k = -6; k <= 6; k++) { const x = k * 44; c.fillStyle = f.belly; c.fillRect(x - 21, 100, 42, 70); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.5; c.strokeRect(x - 21, 100, 42, 70); }
    if (cutaway) {
      c.fillStyle = 'rgba(255,248,236,.85)'; c.fillRect(-260, -60, 520, 130);
      for (let k = -7; k <= 7; k++) { const x = k * 36; c.fillStyle = '#e8e0c8'; c.strokeStyle = '#a89878'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, 0, 15, 12, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x, -12); c.lineTo(x + 4, -26); c.stroke(); c.strokeStyle = '#d8ccb0'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 10); c.quadraticCurveTo(x + 14, 40, x + 8, 64); c.stroke(); }
    }
  }
  function headClose(c) {
    c.save(); c.scale(12, 12); c.translate(-16, 2);
    const P = Sprites.posePts('straight', 40, 8).map(q => ({ x: q.x, y: q.y, z: 0, c: 0 }));
    Sprites.drawSnake(c, P, { thick: 8, form: form(), tongue: subject === 'tongue' ? .5 : 0, shadow: false, blue: subject === 'eye' && cutaway ? 1 : 0 });
    c.restore();
    if (subject === 'tongue' && cutaway) { c.fillStyle = 'rgba(255,150,180,.85)'; for (const dx of [0, 22]) { c.beginPath(); c.ellipse(112 + dx, 4, 16, 8, 0, 0, TAU); c.fill(); } c.strokeStyle = 'rgba(200,60,80,.8)'; c.lineWidth = 4; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(250, 26); c.quadraticCurveTo(190, 20, 140, 8); c.stroke(); c.setLineDash([]); }
  }
  function bigEye(c) {
    const f = F();
    c.fillStyle = f.back; c.fillRect(-300, -220, 600, 440);
    c.fillStyle = f.iris; c.beginPath(); c.arc(0, 0, 130, 0, TAU); c.fill();
    c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(0, 0, 62, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(40, -46, 22, 0, TAU); c.fill();
    if (cutaway) { c.fillStyle = 'rgba(178,206,232,.75)'; c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(230,245,255,.9)'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, cutaway ? 160 : 142, -2.6, -.9); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, cutaway ? 160 : 142, 0, TAU); c.stroke();
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(Math.cos(a) * 200, Math.sin(a) * 200, 34, 0, TAU); c.stroke(); }
  }
  function insides(c, len, th, girl) {
    c.fillStyle = 'rgba(255,245,235,.6)'; c.beginPath(); c.ellipse(-10, 0, len * .36, th * .36, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(200,190,170,.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(len * .4, -th * .22); c.lineTo(-len * .5, -th * .2); c.stroke();
    for (let x = -len * .5; x < len * .4; x += 8) { c.beginPath(); c.moveTo(x, -th * .22); c.lineTo(x + 3, -th * .32); c.stroke(); }
    c.fillStyle = 'rgba(220,60,70,.9)'; c.beginPath(); c.ellipse(len * .26, 2, 9, 7, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,170,180,.75)'; c.beginPath(); c.ellipse(len * .02, 0, len * .2, th * .2, 0, 0, TAU); c.fill();
    if (girl) for (let k = 0; k < 6; k++) { c.save(); c.translate(-len * .1 - k * 26, 6 + (k % 2) * 6); Sprites.drawSac(c, 0, 10, 1.5, 0, 0, form()); c.restore(); }
  }
  const PARTS = {
    newborn: { k: 1, shift: 0, draw: (c) => { c.save(); c.translate(0, 120); Sprites.drawSac(c, 0, 0, 14, 0, 0, form()); c.restore(); }, parts: [
      { x: -150, y: -40, name: 'Clear bag', say: 'A garter snake is born in a thin, clear bag. Within minutes it pushes its way out.', simple: 'A thin clear bag!' },
      { x: 10, y: -10, name: 'Coiled baby', say: 'The baby lies curled up inside, about as long as a pencil when it stretches out.', simple: 'A baby snake, curled up.' },
      { x: 60, y: -120, name: 'Ready to go', say: 'A newborn garter snake can flick its tongue, slither and look after itself from its very first day.', simple: 'It can look after itself!' }
    ] },
    scales: { k: 1, shift: 40, draw: scales, parts: [
      { x: 30, y: -96, name: 'Keeled scale', say: 'Each back scale has a little ridge down the middle, called a keel. Garter snakes have keeled scales.', simple: 'A ridge on every scale.' },
      { x: 120, y: -48, name: 'Stripe', say: 'The long pale stripes run from the neck to the tail: one down the back and one along each side.', simple: 'A long stripe.' },
      { x: -90, y: -120, name: 'Checks', say: 'Between the stripes, dark spots make a checkerboard pattern.', simple: 'Dark checks.' },
      { x: 0, y: 130, name: 'Belly scutes', say: 'Under the belly are wide scales called scutes. Their edges catch on the ground to push the snake along.', simple: 'Wide belly scales grip the ground.' },
      { x: -144, y: 0, name: 'Backbone', say: 'Under the skin, the backbone is made of hundreds of small bones, so a snake can bend and curl.', simple: 'Hundreds of little backbones!', needs: 'cutaway' },
      { x: 30, y: 52, name: 'Ribs', say: 'Every backbone has a pair of ribs. A snake has hundreds of ribs.', simple: 'Lots and lots of ribs!', needs: 'cutaway' }
    ] },
    shed: { k: 1, shift: 20, draw: (c) => Sprites.drawExuvia(c, { x: 0, y: 20, len: 440, thick: 72, face: 1, seed: 2, looked: true }), parts: [
      { x: 256, y: 6, name: 'Eye cap', say: 'The old clear spectacle comes off with the skin. You can see the eye cap in a shed skin.', simple: 'The old eye cover!' },
      { x: 60, y: 6, name: 'Scale prints', say: 'Every scale leaves its print, so you can tell what kind of snake left the skin.', simple: 'The print of every scale.' },
      { x: -40, y: -20, name: 'Inside out', say: 'The skin peels off from the nose backwards and turns inside out, like pulling off a sock.', simple: 'Inside out, like a sock!' },
      { x: -190, y: 18, name: 'Tail tip', say: 'A shed skin is often longer than the snake, because it stretches as it comes off.', simple: 'Longer than the snake!' }
    ] },
    tongue: { k: 1, shift: -90, draw: headClose, parts: [
      { x: 236, y: 22, name: 'Forked tongue', say: 'The snake flicks its tongue out and in to pick up smells. It can not sting or hurt anybody.', simple: 'It smells with its tongue!' },
      { x: 326, y: 14, name: 'Two tips', say: 'The two tips pick up smells a little way apart, so the snake can tell which way a smell is coming from.', simple: 'Two tips: left and right.' },
      { x: 152, y: -10, name: 'Nostril', say: 'Snakes smell with their noses too, but the tongue does most of the smelling.', simple: 'A little nose hole.' },
      { x: 80, y: 22, name: 'Lip scales', say: 'Pale lip scales with little dark lines between them.', simple: 'Pale lip scales.' },
      { x: 124, y: 4, name: "Jacobson's organ", say: "The tongue touches its tips to the Jacobson's organ in the roof of the mouth, which reads the smells.", simple: 'The smelling place in its mouth!', needs: 'cutaway' }
    ] },
    eye: { k: 1, shift: 0, draw: bigEye, parts: [
      { x: -100, y: -120, name: 'Spectacle', say: 'Snakes have no eyelids. A clear scale called the spectacle covers each eye, like built-in glasses.', simple: 'A clear cover. No eyelids!' },
      { x: 0, y: 0, name: 'Round pupil', say: 'Garter snakes have round pupils. They are out in the daytime and see movement well.', simple: 'A round pupil.' },
      { x: 90, y: 80, name: 'Iris', say: 'The coloured ring around the pupil is the iris.', simple: 'The coloured ring.' },
      { x: -130, y: 60, name: 'Milky layer', say: 'Before a shed, a milky liquid forms under the old spectacle and the eye looks cloudy blue.', simple: 'Cloudy blue before a shed!', needs: 'cutaway' }
    ] },
    boy: { k: 1, sx: 1.24, sy: 1.6, shift: -10, draw: (c) => { bigSnake(c, 520, 54); if (cutaway) insides(c, 520, 54, false); }, parts: [
      { x: 205, y: -10, name: 'Eye', say: 'Big round eyes with no eyelids.', simple: 'Big round eyes.' },
      { x: 262, y: 6, name: 'Tongue', say: 'The forked tongue flicks out to smell.', simple: 'A forked tongue.' },
      { x: 60, y: -14, name: 'Back stripe', say: 'A pale stripe runs down the middle of the back.', simple: 'A stripe on the back.' },
      { x: -40, y: 8, name: 'Side stripe', say: 'Another stripe runs along each side.', simple: 'A stripe on the side.' },
      { x: 20, y: 14, name: 'Belly', say: 'The belly is pale, with wide scutes for gripping.', simple: 'A pale belly.' },
      { x: -170, y: 4, name: 'Long tail', say: 'The tail starts at the vent. Boys have longer tails than girls for their size.', simple: 'Boys have long tails.' },
      { x: 110, y: 2, name: 'Heart', say: 'The heart is about a third of the way down the body.', simple: 'Its heart.', needs: 'cutaway' },
      { x: 10, y: 0, name: 'Long lung', say: 'A snake has one long lung that stretches down much of its body.', simple: 'One long lung!', needs: 'cutaway' },
      { x: -100, y: -8, name: 'Backbone', say: 'Hundreds of small backbones, each with two ribs.', simple: 'Hundreds of bones.', needs: 'cutaway' }
    ] },
    girl: { k: 1, sx: 1.22, sy: 1.6, shift: -10, draw: (c) => { bigSnake(c, 560, 64, { tongue: 0 }); if (cutaway) insides(c, 560, 64, true); }, parts: [
      { x: 222, y: -12, name: 'Eye', say: 'Big round eyes with no eyelids.', simple: 'Big round eyes.' },
      { x: 60, y: -16, name: 'Bigger body', say: 'Girl garter snakes grow longer and heavier than boys.', simple: 'Girls grow bigger!' },
      { x: -160, y: 8, name: 'Shorter tail', say: 'A girl has a shorter tail for her size than a boy.', simple: 'A shorter tail.' },
      { x: -80, y: 8, name: 'Babies growing', say: 'A mother carries her babies inside her for about two to three months, each one in its own thin bag.', simple: 'Her babies grow inside!', needs: 'cutaway' }
    ] }
  };

  function pos(def, part) { return { x: part.x * def.k * (def.sx || 1), y: part.y * def.k * (def.sy || 1) }; }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.stage === 'sac' || p.instar <= 1 ? 'newborn' : p.shed === 'blue' ? 'eye' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    def.parts.forEach((part, i) => { if (part.needs === 'cutaway' && !cutaway) return; const q = pos(def, part); items.push({ i, part, px: cx + q.x * .62, py: cy + q.y * .62 }); });
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
    g.addColorStop(0, '#f4fbe8'); g.addColorStop(1, '#c8e0b0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .47, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(W * .4, H * .5, H * .46, 0, TAU); ctx.clip();
    const def = PARTS[subject];
    ctx.translate(W * .4 + (def.shift || 0), H * .5); ctx.scale(.62, .62);
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
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide her babies' : 'Show her babies') : subject === 'eye' ? (cutaway ? 'Clear eye' : 'Before a shed') : cutaway ? 'Outside view' : 'Look inside';
  }
  return { init, open, close, isOpen, render, PARTS };
})();
