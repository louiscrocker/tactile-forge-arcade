/* ============================================================
   microscope.js — look closer
   ============================================================
   A big labelled drawing of whatever you pick: a newborn, a pup,
   a boy wolf, a girl wolf, a paw.  Tap a label and it is read
   aloud.  "Look inside" shows a pup's milk teeth, a grown wolf's
   42 teeth, a mother's two-layer winter coat, and a paw print
   spread wide in the snow.
   ============================================================ */
'use strict';

const Microscope = (function () {
  let canvas, ctx, W = 720, H = 460, subject = 'boy', cutaway = false, hover = -1;
  const $ = (id) => document.getElementById(id);
  let G_ref = null;
  const form = () => (G_ref && G_ref.form) || 'gray';
  const simple = () => G_ref && G_ref.settings.reading === 'simple';

  /* a wolf's open jaw, side on: the long canines, the little front teeth, the shearing teeth at the back */
  function jaw(c, k, milk) {
    c.save(); c.translate(45 * k, 34 * k); c.scale(k * .8, k * .8);
    c.fillStyle = 'rgba(255,255,255,.92)'; c.strokeStyle = '#8a8070'; c.lineWidth = 1.2; c.beginPath(); c.arc(14, 8, 30, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#5a3a3a'; c.beginPath(); c.moveTo(-20, 0); c.lineTo(48, -4); c.lineTo(48, 14); c.lineTo(-20, 18); c.closePath(); c.fill();
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#b8a890'; c.lineWidth = .7;
    const n = milk ? 5 : 7;
    for (let i = 0; i < n; i++) { const x = -14 + i * (58 / n), h = i === n - 2 ? (milk ? 10 : 16) : i >= n - 3 ? 5 : 8; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 3, h); c.lineTo(x + 6, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x, 16); c.lineTo(x + 3, 16 - h * .8); c.lineTo(x + 6, 16); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  function furPatch(c, k) {
    c.save(); c.translate(-10 * k, -12 * k); c.scale(k * .5, k * .5);
    c.fillStyle = 'rgba(255,250,240,.85)'; c.beginPath(); c.ellipse(0, 0, 40, 26, 0, 0, TAU); c.fill(); c.strokeStyle = '#8a8070'; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = '#c8c0b0'; c.lineWidth = .8; for (let i = 0; i < 60; i++) { const x = -30 + (i % 20) * 3, y = 6 + (i / 20 | 0) * 4; c.beginPath(); c.moveTo(x, y + 8); c.quadraticCurveTo(x + 2, y + 2, x + 4 * Math.sin(i), y - 4); c.stroke(); }
    c.strokeStyle = '#5a5048'; c.lineWidth = 1.4; for (let i = 0; i < 9; i++) { const x = -32 + i * 8; c.beginPath(); c.moveTo(x, 18); c.quadraticCurveTo(x + 3, -2, x + 5, -22); c.stroke(); }
    c.restore();
  }
  function pawPrint(c, k, snow) {
    c.save(); c.scale(k, k);
    if (snow) { c.fillStyle = '#eef4ff'; c.beginPath(); c.ellipse(0, 4, 60, 48, 0, 0, TAU); c.fill(); }
    const spread = snow ? 1.25 : 1;
    c.fillStyle = snow ? 'rgba(160,185,220,.9)' : '#3a2a1a';
    c.beginPath(); c.ellipse(0, 12, 20, 16, 0, 0, TAU); c.fill();
    for (const [x, y] of [[-24, -10], [-9, -22], [9, -22], [24, -10]]) { c.beginPath(); c.ellipse(x * spread, y, 7, 9, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x * spread - 2, y - 8); c.lineTo(x * spread, y - 16); c.lineTo(x * spread + 2, y - 8); c.fill(); }
    c.restore();
  }
  const PARTS = {
    newborn: { k: 3.4, shift: -30, draw: (c) => { Sprites.drawWolf(c, { s: 3.4, form: form(), age: 0, lie: true, eyes: 0, seed: 3 }); }, parts: [
      { x: 33, y: -12, name: 'Shut eyes', say: 'A newborn pup is born with its eyes shut. They open after about two weeks, and they are blue.', simple: 'Its eyes are shut for two weeks.' },
      { x: -12, y: -16, name: 'Fuzzy dark fur', say: 'Newborn pups have short, dark, fuzzy fur, even the ones that will be gray or white later.', simple: 'Dark fuzzy fur.' },
      { x: 22, y: -26, name: 'Folded ears', say: 'The ears are small and folded flat. They cannot hear yet.', simple: 'Little folded ears. It can not hear yet.' },
      { x: 40, y: -9, name: 'Nose', say: 'A newborn finds its mother by smell and warmth. The nose works from the very first day.', simple: 'Its nose works from day one!' },
      { x: -6, y: 14, name: 'Round tummy', say: 'Half a kilo at birth, and full of milk. It grows fast on milk.', simple: 'Full of milk. It grows fast!' }
    ] },
    pup: { k: 3.2, shift: 0, draw: (c) => { Sprites.drawWolf(c, { s: 3.2, form: form(), age: .3, seed: 3 }); if (cutaway) jaw(c, 3.2, true); }, parts: [
      { x: 33, y: -20, name: 'Blue eyes', say: 'A pup\'s eyes are blue. They slowly turn amber over the summer.', simple: 'Blue eyes that will turn gold.' },
      { x: 25, y: -33, name: 'Ears pricking up', say: 'The floppy ears stand up during the pup\'s first month. Wolves can turn each ear on its own to listen.', simple: 'The ears stand up and listen.' },
      { x: 42, y: -16, name: 'Short muzzle', say: 'A pup has a short round muzzle. It grows longer as the pup grows up.', simple: 'A short little nose.' },
      { x: 9, y: 32, name: 'Big paws', say: 'A pup\'s paws look too big for it. It grows into them.', simple: 'Big paws to grow into!' },
      { x: -48, y: 4, name: 'Stubby tail', say: 'A short tail now, a long bushy one later. Wolves talk with their tails.', simple: 'A little stubby tail.' },
      { x: 45, y: 34, name: 'Milk teeth', say: 'Pups get 28 small milk teeth in their first weeks, then 42 grown-up teeth at about six months.', simple: 'Little milk teeth first.', needs: 'cutaway' }
    ] },
    boy: { k: 2.3, shift: 0, draw: (c) => { Sprites.drawWolf(c, { s: 2.3, form: form(), age: 1, sex: 'boy', seed: 3 }); if (cutaway) jaw(c, 2.3, false); }, parts: [
      { x: 39, y: -22, name: 'Amber eyes', say: 'A grown wolf has amber or yellow eyes, and it sees well in the dark.', simple: 'Gold eyes that see in the dark.' },
      { x: 33, y: -34, name: 'Ears', say: 'A wolf can hear a howl from many kilometres away, and turn each ear towards a sound.', simple: 'Ears that hear from far away.' },
      { x: 61, y: -20, name: 'Nose', say: 'A wolf\'s nose is far better than ours. It can tell who walked by and how long ago.', simple: 'A super nose!' },
      { x: 14, y: -12, name: 'Thick ruff', say: 'The fur is thickest round the neck and shoulders. In winter the coat has two layers.', simple: 'Thick fur round the neck.' },
      { x: 8, y: 34, name: 'Long legs', say: 'Long legs for trotting all day and sprinting at up to about 60 kilometres an hour.', simple: 'Long legs for running.' },
      { x: -70, y: 6, name: 'Bushy tail', say: 'The tail says how a wolf feels: high means confident, tucked means sorry, wagging means happy.', simple: 'A bushy tail that talks.' },
      { x: 45, y: 34, name: '42 teeth', say: 'A grown wolf has 42 teeth: long canines at the front and sharp shearing teeth at the back.', simple: 'Forty-two teeth!', needs: 'cutaway' }
    ] },
    girl: { k: 2.3, shift: 0, draw: (c) => { Sprites.drawWolf(c, { s: 2.3, form: form(), age: 1, sex: 'girl', seed: 5 }); if (cutaway) furPatch(c, 2.3); }, parts: [
      { x: -14, y: -14, name: 'A little lighter', say: 'A female wolf is a little lighter than a male, about 40 kilograms in the valley.', simple: 'A bit lighter than a boy.' },
      { x: 52, y: -19, name: 'Narrower muzzle', say: 'Her muzzle and head are a little narrower.', simple: 'A slimmer nose.' },
      { x: -8, y: 15, name: 'Milk', say: 'Underneath, a mother has milk for her pups. For three weeks that is all they drink.', simple: 'Milk for the pups.' },
      { x: -70, y: 6, name: 'Tail', say: 'She holds her tail high as a leader, and wags it when the pups come out to play.', simple: 'A tail held high.' },
      { x: -10, y: -12, name: 'Winter coat', say: 'Two layers: long guard hairs that shed snow and rain, and thick soft underfur. In spring she sheds it in clumps.', simple: 'Two layers of fur. Warm!', needs: 'cutaway' }
    ] },
    paw: { k: 1.6, draw: (c) => pawPrint(c, 1.6, cutaway), parts: [
      { x: 0, y: 12, name: 'Pad', say: 'The big pad takes the wolf\'s weight. A wolf track is about as long as your hand.', simple: 'The big pad.' },
      { x: -24, y: -10, name: 'Four toes', say: 'Four toes show in the print, two in front and two at the sides. A fifth toe sits higher up the front legs.', simple: 'Four toes.' },
      { x: 9, y: -36, name: 'Claw marks', say: 'A wolf\'s claws do not pull in like a cat\'s, so claw marks show in the track.', simple: 'The claws show in the track.' },
      { x: 30, y: -10, name: 'Spread toes', say: 'On snow the toes spread wide, like snowshoes, so the wolf does not sink as deep as a deer.', simple: 'The toes spread out on snow.', needs: 'cutaway' }
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
    else { const p = G.players[0]; subject = !p ? 'boy' : p.age <= 1 ? 'newborn' : p.age <= 3 ? 'pup' : p.sex === 'girl' ? 'girl' : 'boy'; }
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
    const snowy = subject === 'paw';
    const g = ctx.createRadialGradient(W * .4, H * .5, 20, W * .4, H * .5, H * .62);
    g.addColorStop(0, snowy ? '#f4f8ff' : '#fbf6ec'); g.addColorStop(1, snowy ? '#c8d8ea' : '#dcd4bf');
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
    $('scopeCut').textContent = subject === 'girl' ? (cutaway ? 'Hide the fur' : 'Show her winter coat') : subject === 'paw' ? (cutaway ? 'On earth' : 'In the snow') : cutaway ? 'Close the mouth' : 'Show the teeth';
  }
  return { init, open, close, isOpen, render };
})();
