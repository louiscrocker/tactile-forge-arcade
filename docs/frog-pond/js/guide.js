/* ============================================================
   guide.js — the field guide
   ============================================================
   Forty pond creatures and plants.  Each one fills in the first
   time you get close to it (Bus 'seen').  A card has a picture,
   a "Little words" line, a full line, a size you can picture,
   and for the frogs, their call.  Unseen ones are dark shapes
   to hunt for.
   ============================================================ */
'use strict';

const GUIDE = (function () {
  const sp = (k) => (c) => { c.translate(0, 8); Sprites.drawFrog(c, { s: 1.15, species: SPECIES[k], pose: 'sit' }); };
  const G = {
    green: { name: 'Green frog', group: 'Frogs', size: 'as long as your hand', cm: 9, draw: sp('green'), call: 'twang', simple: 'The banjo frog. Twang!', body: 'Green frogs sit at the water\'s edge and call with a single plucked-banjo note. Males have a big eardrum and a yellow throat.' },
    bullfrog: { name: 'Bullfrog', group: 'Frogs', size: 'as long as a grown-up\'s hand', cm: 15, draw: sp('bullfrog'), call: 'jug', simple: 'The biggest frog. Jug-o-rum!', body: 'The largest frog in North America. It eats almost anything that fits in its mouth, even other frogs.' },
    leopard: { name: 'Leopard frog', group: 'Frogs', size: 'as long as a crayon', cm: 9, draw: sp('leopard'), call: 'snore', simple: 'Spotty and a great jumper.', body: 'Round dark spots ringed in pale lines. In summer leopard frogs hunt in wet meadows far from water.' },
    woodfrog: { name: 'Wood frog', group: 'Frogs', size: 'as long as your thumb', cm: 6, draw: sp('woodfrog'), call: 'quack', simple: 'The frog that freezes solid.', body: 'A brown frog with a robber\'s mask. It lives in the woods, breeds in early spring, and freezes solid all winter.' },
    peeper: { name: 'Spring peeper', group: 'Frogs', size: 'as small as a paperclip', cm: 3, draw: sp('peeper'), call: 'peep', simple: 'Tiny, with an X. Peep!', body: 'One of the smallest frogs, with a dark X on its back. On spring nights hundreds peep like sleigh bells.' },
    treefrog: { name: 'Gray treefrog', group: 'Frogs', size: 'as long as your thumb', cm: 5, draw: sp('treefrog'), call: 'trill', simple: 'Sticky toes for climbing.', body: 'Grey and bumpy like bark, with big sticky toe pads and bright yellow under its legs.' },
    toad: { name: 'American toad', group: 'Frogs', size: 'as long as your hand', cm: 8, draw: sp('toad'), call: 'toad', simple: 'A bumpy frog. Tastes yucky.', body: 'Dry warty skin, short hops, eggs in long strings. Bitter glands behind the eyes keep raccoons away.' },
    spawn: { name: 'Frog spawn', group: 'Frogs', size: 'as big as a baseball', cm: 8, draw: (c) => Sprites.drawEggMass(c, { s: 1.4, count: 14, seed: 4, dev: .4 }), simple: 'Eggs in a ball of jelly.', body: 'A frog lays hundreds of eggs in one clump of clear jelly, stuck to weeds in warm, shallow water.' },
    toadspawn: { name: 'Toad spawn', group: 'Frogs', size: 'as long as a skipping rope', cm: 300, draw: (c) => Sprites.drawEggString(c, { s: .8, seed: 5, dev: .2 }), simple: 'Toad eggs come in long strings.', body: 'Toads lay their eggs in two long strings of jelly, wound around plants. One string can hold thousands.' },
    wildtadpole: { name: 'Tadpoles', group: 'Frogs', size: 'as long as a fingernail', cm: 1.5, draw: (c) => { c.rotate(-.2); Sprites.drawTadpole(c, { s: 1, species: SPECIES.green, kick: 1, swim: .5 }); }, simple: 'Baby frogs with tails.', body: 'Tadpoles swim together in a crowd. It is safer: a hunter has a hard time picking just one.' },
    turtle: { name: 'Painted turtle', group: 'Reptiles', size: 'as big as a dinner plate', cm: 20, draw: (c) => { c.scale(.8, .8); Sprites.drawTurtle(c, { s: 1, pose: 'bask' }); }, simple: 'Sits on the log in the sun.', body: 'Red and yellow stripes on its neck and shell edge. It basks to warm up, and slides off with a plop if you come near.' },
    snake: { name: 'Garter snake', group: 'Reptiles', size: 'as long as your arm', cm: 60, draw: (c) => { c.translate(30, 0); c.scale(.7, .7); Sprites.drawSnake(c, { s: 1, pose: 'slither', tongue: 1 }); }, simple: 'Hunts frogs in the grass.', body: 'A striped snake that loves frogs and toads. It smells with its tongue. It is harmless to people.' },
    newt: { name: 'Eastern newt', group: 'Amphibians', size: 'as long as your finger', cm: 9, draw: (c) => { c.scale(1.8, 1.8); Sprites.drawNewt(c, { s: 1, ph: 1 }); }, simple: 'A salamander that swims.', body: 'An amphibian like a frog, but it keeps its tail. The red spots warn that its skin is poisonous.' },
    heron: { name: 'Great blue heron', group: 'Birds', size: 'as tall as a 5-year-old', cm: 115, draw: (c) => { c.translate(-6, 10); c.scale(.4, .4); Sprites.drawHeron(c, { s: 1, pose: 'stand' }); }, simple: 'Tall bird that stabs fish and frogs.', body: 'It stands still as a statue, then spears its prey. It flies with its neck folded into an S.' },
    blackbird: { name: 'Red-winged blackbird', group: 'Birds', size: 'as long as a banana', cm: 20, draw: (c) => { c.scale(2, 2); Sprites.drawBlackbird(c, { s: 1, sing: .6 }); }, simple: 'Sings konk-la-reee in the marsh.', body: 'Males flash red shoulder patches while they sing from the top of a cattail to claim their patch of marsh.' },
    raccoon: { name: 'Raccoon', group: 'Mammals', size: 'as big as a cat', cm: 60, draw: (c) => { c.scale(.7, .7); Sprites.drawRaccoon(c, { s: 1, pose: 'walk' }); }, simple: 'Masked night visitor.', body: 'Raccoons feel for food in shallow water with their clever hands. They hunt frogs at night but spit out toads.' },
    fish: { name: 'Largemouth bass', group: 'Fish', size: 'as long as your arm', cm: 40, draw: (c) => { c.scale(.8, .8); Sprites.drawFish(c, { s: 1, ph: 1 }); }, simple: 'Big fish that hunts at dusk.', body: 'A big hunting fish with a huge mouth. It hides in deep water and eats tadpoles, froglets and minnows.' },
    minnow: { name: 'Minnows', group: 'Fish', size: 'as long as your little finger', cm: 5, draw: (c) => { c.scale(3, 3); Sprites.drawMinnow(c, { s: 1, ph: 1 }); }, simple: 'Little silver fish.', body: 'Small fish that school together. They eat mosquito larvae, so they help keep mosquitoes down.' },
    goldfish: { name: 'Goldfish', group: 'Fish', size: 'as long as your finger', cm: 8, draw: (c) => { c.scale(2.2, 2.2); Sprites.drawMinnow(c, { s: 1, ph: 1, gold: true }); }, simple: 'Orange fish people keep.', body: 'Goldfish are pets, not wild pond fish. They eat tadpoles, which is why frogs prefer ponds without fish.' },
    nymph: { name: 'Dragonfly nymph', group: 'Bugs', size: 'as long as a paperclip', cm: 4, draw: (c) => { c.scale(1.5, 1.5); Sprites.drawNymph(c, { s: 1, jaw: .3 }); }, simple: 'Baby dragonfly with a shooting jaw.', body: 'It lives underwater for up to four years, catching tadpoles with a hinged jaw called a mask.' },
    dragonfly: { name: 'Dragonfly', group: 'Bugs', size: 'as long as your finger', cm: 7, draw: (c) => { c.translate(10, 0); c.scale(1.6, 1.6); Sprites.drawDragonfly(c, { s: 1, wing: 1 }); }, simple: 'Fast flier with four wings.', body: 'One of the fastest insects. It catches other bugs in the air with its legs, like a basket.' },
    fly: { name: 'House fly', group: 'Bugs', size: 'as small as a pea', cm: .7, draw: (c) => { c.scale(4, 4); Sprites.drawFly(c, { s: 1, wing: 1 }); }, simple: 'Frog snack!', body: 'Flies buzz low over the water. A frog snaps them from the air with its sticky tongue.' },
    mosquito: { name: 'Mosquito', group: 'Bugs', size: 'as small as a grain of rice', cm: .6, draw: (c) => { c.scale(3.5, 3.5); Sprites.drawMosquito(c, { s: 1, wing: 1 }); }, simple: 'Bitey bug. Frogs eat them.', body: 'Only females bite; they need blood to make eggs. They lay the eggs on still water.' },
    wriggler: { name: 'Wrigglers', group: 'Bugs', size: 'as small as an ant', cm: .8, draw: (c) => { c.translate(0, -20); c.scale(2.6, 2.6); Sprites.drawWriggler(c, { s: 1 }); }, simple: 'Baby mosquitoes.', body: 'Mosquito larvae hang from the surface, breathing through a snorkel on their tail.' },
    mayfly: { name: 'Mayfly', group: 'Bugs', size: 'as long as a fingernail', cm: 1.5, draw: (c) => { c.scale(3, 3); Sprites.drawMayfly(c, { s: 1, ph: 1 }); }, simple: 'Lives one day as an adult.', body: 'Mayflies live underwater for a year, then hatch all at once and live only a day or two as flying adults.' },
    strider: { name: 'Water strider', group: 'Bugs', size: 'as long as a paperclip', cm: 2, draw: (c) => { c.scale(3, 3); Sprites.drawStrider(c, { s: 1, ph: 1 }); }, simple: 'Walks on water.', body: 'Its hairy, waxy feet dimple the surface without breaking it. It feels ripples to find food.' },
    boatman: { name: 'Water boatman', group: 'Bugs', size: 'as small as a pea', cm: 1, draw: (c) => { c.scale(3.5, 3.5); Sprites.drawBoatman(c, { s: 1, ph: 1 }); }, simple: 'Rows with oar legs.', body: 'It carries a bubble of air to breathe underwater, like a tiny scuba diver.' },
    caddis: { name: 'Caddisfly larva', group: 'Bugs', size: 'as long as a fingernail', cm: 2, draw: (c) => { c.scale(2.4, 2.4); Sprites.drawCaddis(c, { s: 1 }); }, simple: 'Lives in a house of stones.', body: 'It glues sand and pebbles into a tube with silk and carries its house wherever it goes.' },
    snail: { name: 'Pond snail', group: 'Others', size: 'as small as a pea', cm: 1.5, draw: (c) => { c.scale(3, 3); Sprites.drawSnail(c, { s: 1 }); }, simple: 'Eats algae, like a tadpole.', body: 'Snails scrape algae with a tongue covered in tiny teeth, called a radula.' },
    leech: { name: 'Leech', group: 'Others', size: 'as long as your finger', cm: 5, draw: (c) => { c.translate(-10, 6); c.scale(2.6, 2.6); Sprites.drawLeech(c, { s: 1, ph: 1 }); }, simple: 'Stretchy worm. Gross!', body: 'Most pond leeches eat snails and worms. They swim by rippling like a ribbon.' },
    ladybug: { name: 'Ladybug', group: 'Bugs', size: 'as small as a pea', cm: .7, draw: (c) => { c.scale(2.6, 2.6); Sprites.drawLadybug(c, { s: 1 }); }, simple: 'A visitor from the garden.', body: 'Ladybugs eat aphids in gardens. Frogs spit them out: ladybugs ooze bitter yellow blood from their knees.' },
    algae: { name: 'Algae', group: 'Plants', size: 'too small to see one', cm: .001, draw: (c) => Sprites.drawAlgae(c, { x: 0, y: 0, r: 34 }, 1, 0), simple: 'Green fuzz. Tadpole food.', body: 'Millions of tiny plants that make food from sunlight. They grow fastest in warm, sunny water.' },
    lilypad: { name: 'Water lily', group: 'Plants', size: 'as big as a dinner plate', cm: 25, draw: (c) => Sprites.drawLilyPad(c, { r: 34, bloom: 1, hue: .3, notch: .8 }), simple: 'A floating leaf with a flower.', body: 'Its leaves float because they are full of air pockets. Long stems reach all the way down to the mud.' },
    cattail: { name: 'Cattail', group: 'Plants', size: 'taller than a grown-up', cm: 200, draw: (c) => { c.translate(0, 40); c.scale(.3, .3); Sprites.drawReed(c, { kind: 'cattail', h: 240, w: 5, lean: 0, ph: 0, side: 1 }, 0, 0, 'summer'); }, simple: 'Tall reed with a brown sausage.', body: 'The brown sausage is packed with thousands of seeds, each on a fluffy parachute.' },
    pitcher: { name: 'Pitcher plant', group: 'Plants', size: 'as tall as a mug', cm: 15, draw: (c) => { c.translate(0, 26); c.scale(1.2, 1.2); Sprites.drawPitcher(c, { h: 36 }); }, simple: 'A plant that eats bugs!', body: 'Bugs slip into its water-filled trumpets and drown. The plant gets food the bog soil cannot give it.' },
    sphagnum: { name: 'Sphagnum moss', group: 'Plants', size: 'mats bigger than a bed', cm: 200, draw: (c) => { const r = mulberry32(3); for (let i = 0; i < 14; i++) { c.fillStyle = mixHex('#6a8a3a', '#a8a050', r()); c.beginPath(); c.ellipse((r() - .5) * 60, (r() - .5) * 20, 10 + r() * 8, 5 + r() * 3, 0, 0, TAU); c.fill(); } }, simple: 'Spongy moss that floats in bogs.', body: 'Sphagnum holds twenty times its weight in water and makes the bog water acid and brown.' },
    log: { name: 'Old log', group: 'Places', size: 'as long as a car', cm: 400, draw: (c) => { c.fillStyle = '#6a4a2a'; rr(c, -40, -10, 80, 20, 9); c.fill(); c.fillStyle = '#c9a56a'; c.beginPath(); c.ellipse(40, 0, 5, 10, 0, 0, TAU); c.fill(); }, simple: 'A perch for frogs and turtles.', body: 'Fallen logs give turtles a place to bask and frogs a place to sit. Underneath, they shelter nymphs and snails.' }
  };
  for (const k in G) G[k].key = k;
  return G;
})();
const GUIDE_ORDER = Object.keys(GUIDE);

const FieldGuide = (function () {
  const $ = (id) => document.getElementById(id);
  let seen = new Set(), current = null, Gm = null;
  const load = () => { try { seen = new Set(JSON.parse(localStorage.getItem(pkey('guide')) || '[]')); } catch (e) { seen = new Set(); } };
  const save = () => { try { localStorage.setItem(pkey('guide'), JSON.stringify([...seen])); } catch (e) { /* fine */ } };

  function init(game) {
    Gm = game; load();
    Bus.on('seen', (k) => { if (GUIDE[k] && !seen.has(k)) { seen.add(k); save(); Bus.emit('guideNew', k, seen.size); } });
    if (!$('guide')) return;
    $('guideClose').addEventListener('click', () => { $('guide').hidden = true; });
    $('guideSay').addEventListener('click', () => sayCurrent(true));
  }
  function picture(k, px, locked) {
    const c = document.createElement('canvas'); c.width = c.height = px * 2;
    const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(px / 2, px / 2);
    const s = px / 100; ctx.scale(s, s);
    try { GUIDE[k].draw(ctx); } catch (e) { /* a sprite that needs more options */ }
    if (locked) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#34464a'; ctx.fillRect(0, 0, c.width, c.height); }
    c.style.width = c.style.height = px + 'px';
    return c;
  }
  function open() {
    AudioFX.click && AudioFX.click();
    const grid = $('guideGrid'); grid.innerHTML = '';
    let group = null;
    for (const k of GUIDE_ORDER) {
      const e = GUIDE[k], has = seen.has(k);
      if (e.group !== group) { group = e.group; const h = document.createElement('h4'); h.className = 'guide-group'; h.textContent = group; grid.appendChild(h); }
      const b = document.createElement('button'); b.className = 'gcard' + (has ? '' : ' locked');
      b.appendChild(picture(k, 72, !has));
      const s = document.createElement('span'); s.textContent = has ? e.name : '?'; b.appendChild(s);
      b.addEventListener('click', () => show(k));
      grid.appendChild(b);
    }
    $('guideCount').textContent = `${seen.size} / ${GUIDE_ORDER.length}`;
    $('guideDetail').hidden = true;
    $('guide').hidden = false;
  }
  function sizeText(cm) { return cm < 1 ? `${Math.round(cm * 10)} mm` : cm < 100 ? `${cm} cm` : `${(cm / 100).toFixed(1)} m`; }
  function show(k) {
    const e = GUIDE[k], has = seen.has(k);
    current = k;
    const d = $('guideDetail'); d.hidden = false;
    const pic = $('guidePic'); pic.innerHTML = ''; pic.appendChild(picture(k, 150, !has));
    $('guideName').textContent = has ? e.name : 'Not found yet';
    const simple = Gm.settings.reading === 'simple';
    $('guideText').textContent = has ? (simple ? e.simple : e.body) : `Keep exploring. It lives with the ${e.group.toLowerCase()}.`;
    $('guideSize').textContent = has ? `Size: ${e.size} (about ${sizeText(e.cm)})` : '';
    const bar = $('guideRuler'); bar.style.width = has ? `${clamp(Math.log10(e.cm * 10 + 1) / 3.7, .04, 1) * 100}%` : '0';
    $('guideCall').hidden = !(has && e.call);
    $('guideCall').onclick = () => AudioFX.ribbit && AudioFX.ribbit(e.call, 1);
    sayCurrent(false);
  }
  function sayCurrent(force) {
    if (!current) return;
    const e = GUIDE[current]; if (!seen.has(current)) { Voice.say('Not found yet. Keep exploring!', { interrupt: true, force }); return; }
    Voice.say(`${e.name}. ${Gm.settings.reading === 'simple' ? e.simple : e.body} It is ${e.size}.`, { interrupt: true, force, key: 'guide:' + current });
  }
  return { init, open, count: () => seen.size, has: (k) => seen.has(k), total: () => GUIDE_ORDER.length, picture };
})();
