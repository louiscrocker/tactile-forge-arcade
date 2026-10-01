/* ============================================================
   facts.js — your monarch, the life stages, difficulty, the
   migration route and the biology
   ============================================================
   Every fact has a full `body` and a `simple` version in short
   words for a child who is just learning to read.
   ============================================================ */
'use strict';

/* ---------- who you are ---------- */
const VARIANTS = {
  male: {
    key: 'male', name: 'Male monarch', short: 'Male', latin: 'Danaus plexippus ♂',
    orange: '#f28c1e', deep: '#d9641a', vein: '#1a1410', veinW: 1.0, pouch: true,
    speed: 1.05, need: 1, glide: 1,
    power: 'A little faster in the air.',
    blurb: 'Boys have thinner black veins and a black dot on each back wing — a scent pouch for attracting a mate.',
    simple: 'A boy monarch. Look for the two black dots on the back wings.'
  },
  female: {
    key: 'female', name: 'Female monarch', short: 'Female', latin: 'Danaus plexippus ♀',
    orange: '#ec8218', deep: '#cf5c16', vein: '#15100c', veinW: 1.7, pouch: false,
    speed: 1, need: 1, glide: 1.1,
    power: 'Glides a little further on each flap.',
    blurb: 'Girls have thicker, darker black veins and no scent dots. In spring she will lay up to 500 eggs, one at a time, each on its own milkweed leaf.',
    simple: 'A girl monarch. Thicker black lines, no dots. She lays the eggs.'
  },
  white: {
    key: 'white', name: 'White monarch', short: 'White', latin: 'Danaus plexippus f. nivosus',
    orange: '#e9e2d2', deep: '#c9bfa8', vein: '#1a1410', veinW: 1.2, pouch: true,
    speed: 1, need: 1, glide: 1,
    power: 'Rare: the same butterfly in grey-white.',
    blurb: 'One monarch in ten thousand is born without orange. Called "nivosus" (snowy), they are most common in Hawaii, where there are fewer birds that hunt by colour.',
    simple: 'A very rare white monarch. Only one in ten thousand!'
  }
};

/* ---------- life stages ----------
   Monarch caterpillars have FIVE instars (ladybugs have four).
   `need` is leaf bites for larvae; for the adult it is nectar sips
   before it is strong enough to leave. */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg', need: 0, scale: 1, speed: 0 },
  { key: 'L1', name: 'Caterpillar · 1st instar', short: '1st', need: 4, scale: .34, speed: 60, reach: 10 },
  { key: 'L2', name: 'Caterpillar · 2nd instar', short: '2nd', need: 7, scale: .5, speed: 74, reach: 12 },
  { key: 'L3', name: 'Caterpillar · 3rd instar', short: '3rd', need: 11, scale: .68, speed: 88, reach: 14 },
  { key: 'L4', name: 'Caterpillar · 4th instar', short: '4th', need: 16, scale: .86, speed: 102, reach: 16 },
  { key: 'L5', name: 'Caterpillar · 5th instar', short: '5th', need: 24, scale: 1.1, speed: 116, reach: 19 },
  { key: 'chrysalis', name: 'Chrysalis', short: 'Pupa', need: 0, scale: 1, speed: 0 },
  { key: 'adult', name: 'Monarch butterfly', short: 'Adult', need: 4, scale: 1, speed: 140, reach: 22 }
];

const DIFFICULTY = {
  easy:   { label: 'Little kid', mult: .55, ants: false, wasp: false, pupaTime: 18, storms: .5, wind: .6, drain: .6, night: false, routeK: .55, lake: false },
  normal: { label: 'Big kid',    mult: 1,   ants: true,  wasp: true,  pupaTime: 26, storms: 1,  wind: 1,  drain: 1,  night: true,  routeK: 1,   lake: true },
  hard:   { label: 'Scientist',  mult: 1.5, ants: true,  wasp: true,  pupaTime: 32, storms: 1.5, wind: 1.4, drain: 1.35, night: true, routeK: 1.35, lake: true }
};

/* ---------- the route south ----------
   Fractions of the whole route.  Real monarchs from the Great
   Lakes fly about 3,000 miles to the mountains west of Mexico City. */
const ROUTE_MILES = 3000;
const ZONES = [
  { key: 'north',  from: 0,   to: .17, name: 'Northern meadows', place: 'Ontario & the Great Lakes', sky: ['#5f9fe0', '#dff1ff'], ground: '#7cb45a', far: '#6f9e6a', wind: .15, storm: .6,  nectar: ['goldenrod', 'aster', 'aster'], trees: ['maple', 'oak', 'birch'], nectarEvery: 1400, treeEvery: 1700, blurb: 'Late summer. The days are getting shorter — that is the signal.' },
  { key: 'lake',   from: .17, to: .27, name: 'The lake crossing', place: 'Lake Erie', sky: ['#5a97d6', '#e2f0ff'], ground: '#3f7fb8', far: '#7aa8cc', wind: .35, storm: .9, nectar: [], trees: [], nectarEvery: 0, treeEvery: 0, blurb: 'Open water. Nowhere to land — monarchs wait at the shore for a tailwind, then go for it.' },
  { key: 'farm',   from: .27, to: .52, name: 'The farm belt', place: 'Ohio, Indiana, Illinois, Missouri', sky: ['#5a9ee2', '#eef6ff'], ground: '#c9b85a', far: '#8fa860', wind: .25, storm: 1, nectar: ['aster', 'sunflower', 'goldenrod', 'clover'], trees: ['oak', 'cottonwood', 'maple'], nectarEvery: 1500, treeEvery: 1900, blurb: 'Corn and soybeans for miles. Nectar is harder to find here — look for the roadside flowers.' },
  { key: 'plains', from: .52, to: .74, name: 'The Texas funnel', place: 'Oklahoma & Texas', sky: ['#4f9be6', '#ffe9c4'], ground: '#c8a862', far: '#a48c5a', wind: .45, storm: 1.2, nectar: ['frostweed', 'sunflower', 'aster', 'goldenrod'], trees: ['pecan', 'oak', 'cottonwood'], nectarEvery: 1300, treeEvery: 1600, blurb: 'Every monarch east of the Rockies squeezes through Texas. Cold fronts from the north — "northers" — give a free ride.' },
  { key: 'mexico', from: .74, to: .92, name: 'The Mexican highlands', place: 'Coahuila, Nuevo León, Querétaro', sky: ['#4a8fe0', '#ffd9a8'], ground: '#b5915a', far: '#8f6f5a', wind: .3, storm: .7, nectar: ['marigold', 'frostweed', 'marigold', 'aster'], trees: ['pine', 'oak', 'pine'], nectarEvery: 1450, treeEvery: 1650, blurb: 'Climbing into the mountains. The monarchs arrive around the Day of the Dead, November 1st.' },
  { key: 'forest', from: .92, to: 1,   name: 'The oyamel forest', place: 'Sierra Madre, Michoacán', sky: ['#3f7fcf', '#dbe9ff'], ground: '#5a8a4e', far: '#3d6a4a', wind: .1, storm: 0, nectar: [], trees: ['fir'], nectarEvery: 0, treeEvery: 900, blurb: 'Ten thousand feet up. Cool, misty fir forest — the exact same few mountaintops every year.' }
];
function zoneAt(frac) { return ZONES.find(z => frac >= z.from && frac < z.to) || ZONES[ZONES.length - 1]; }

const NECTAR_PLANTS = {
  goldenrod: { name: 'Goldenrod', col: '#f2c21b', col2: '#d9a30f', h: [55, 95], shape: 'plume', nectar: .28 },
  aster:     { name: 'New England aster', col: '#9c6cd6', col2: '#f2d13a', h: [40, 70], shape: 'daisy', nectar: .22 },
  sunflower: { name: 'Sunflower', col: '#ffcf2e', col2: '#5a3a1a', h: [90, 150], shape: 'daisy', nectar: .34 },
  clover:    { name: 'Red clover', col: '#e07aa8', col2: '#c95a90', h: [26, 40], shape: 'ball', nectar: .16 },
  frostweed: { name: 'Frostweed', col: '#ffffff', col2: '#e8e8d0', h: [70, 120], shape: 'plume', nectar: .3 },
  marigold:  { name: 'Cempasúchil marigold', col: '#ff9a1f', col2: '#e0641a', h: [40, 65], shape: 'ball', nectar: .3 }
};

/* ---------- fact cards ---------- */
const YT = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const FACTS = {
  hatch: {
    title: 'Hatched!',
    body: 'A monarch egg is the size of a pinhead, cream-coloured and ribbed like a tiny football. Mum glues one egg to the underside of a milkweed leaf. The caterpillar that chews its way out is 2 mm long — and its first meal is its own eggshell.',
    simple: 'You hatched! You are tiny. Your first meal is your egg shell.',
    more: YT('monarch caterpillar hatching from egg')
  },
  milkweed: {
    title: 'Only milkweed',
    body: 'Monarch caterpillars eat milkweed and nothing else. Milkweed sap is full of poisons called cardenolides. The caterpillar stores them in its body, which makes it — and later the butterfly — taste terrible to birds. No milkweed, no monarchs.',
    simple: 'You only eat milkweed. It is poisonous, and that makes YOU taste bad to birds!',
    more: YT('monarch caterpillar eating milkweed')
  },
  trench: {
    title: 'The trick with the sap',
    body: 'Milkweed sap is sticky white latex that can glue a caterpillar’s mouth shut. So before it eats, a monarch caterpillar chews a little trench across the leaf vein. The sap drains out, and the leaf beyond the trench is safe to eat.',
    simple: 'Milkweed sap is sticky glue. You chew a little cut first so the sap drains out.',
    more: YT('monarch caterpillar cutting leaf vein latex')
  },
  molt1: {
    title: 'First molt!',
    body: 'A caterpillar wears its skeleton on the outside. To grow it must shed its skin. It spins a little silk mat, holds still, and the old skin splits behind the head. The new skin is soft and stretchy. Then it eats the old skin — waste not!',
    simple: 'You grew too big for your skin and shed it. Then you ate it. Yum?',
    more: YT('monarch caterpillar molting')
  },
  molt2: {
    title: 'Stripes!',
    body: 'Third instar now. The yellow, black and white bands are bold, and the black tentacles are longer. The bands are a warning sign: "I am full of milkweed poison — do not eat me."',
    simple: 'Look at your stripes! Yellow, black and white say "do not eat me" to birds.',
    more: YT('monarch caterpillar instars')
  },
  molt3: {
    title: 'Getting big',
    body: 'Fourth instar. You are 2,000 times heavier than when you hatched. The front tentacles are not antennae — they are feelers the caterpillar waves about to sense the world, since its eyes only tell light from dark.',
    simple: 'Fourth instar! Those long black wiggly things are feelers, not antennae.',
    more: YT('monarch caterpillar tentacles')
  },
  molt4: {
    title: 'Fifth and final instar',
    body: 'The biggest, hungriest stage. A fifth instar can eat a whole milkweed leaf in a day. When it is full it does something odd: it leaves the milkweed and wanders off — sometimes 10 metres — to find a safe, hidden place to hang.',
    simple: 'Last caterpillar stage. Eat a LOT. Then go find a good place to hang.',
    more: YT('monarch fifth instar caterpillar')
  },
  jhang: {
    title: 'The J',
    body: 'The caterpillar spins a silk button, hooks its back legs into it, and hangs upside-down in a J shape. It stays like that for about a day. Then it wriggles, the skin splits from the head, and the skin is pushed up and off like a sock.',
    simple: 'You are hanging in a J shape. Soon your skin will come off from the head down.',
    more: YT('monarch caterpillar J hang chrysalis')
  },
  chrysalis: {
    title: 'A jade jewel',
    body: 'The chrysalis is jade green with a band of gold dots. The green is camouflage; nobody is sure what the gold is for. Inside, the caterpillar dissolves almost completely and rebuilds itself as a butterfly. It takes about 10 days.',
    simple: 'You are a green chrysalis with gold dots. Inside, you are turning into a butterfly!',
    more: YT('monarch chrysalis time lapse')
  },
  clear: {
    title: 'The chrysalis goes clear',
    body: 'The day before the butterfly comes out, the chrysalis turns transparent. You can see the orange and black wings folded up inside. This is called "the chrysalis going dark".',
    simple: 'The chrysalis has gone see-through. You can see the orange wings inside!',
    more: YT('monarch chrysalis turning clear')
  },
  eclose: {
    title: 'A butterfly!',
    body: 'The chrysalis cracks and the butterfly pulls itself out with crumpled, wet wings and a fat body. It hangs upside down and pumps fluid from its body into the wing veins, and the wings unfold like a paper fan. They must dry for a few hours before it can fly.',
    simple: 'You are a butterfly! Your wings are wet and crumpled. Hang still while they unfold and dry.',
    more: YT('monarch butterfly emerging from chrysalis')
  },
  super: {
    title: 'You are the super generation',
    body: 'A summer monarch lives 2 to 6 weeks. But a monarch born in late August is different: shorter days and cooler nights switch off its urge to mate, it stores fat instead, and it can live EIGHT MONTHS. It flies 3,000 miles south, sleeps through winter, and flies north again in spring. Nobody taught it the way.',
    simple: 'Most monarchs live a few weeks. You will live 8 MONTHS and fly 3,000 miles. You are special.',
    more: YT('monarch super generation migration')
  },
  compass: {
    title: 'A compass in the antennae',
    body: 'Monarchs steer by the sun. A clock in their antennae tells them the time of day, so they can correct for the sun moving across the sky. On cloudy days they can even use the Earth’s magnetic field.',
    simple: 'You steer by the sun. A tiny clock in your antennae helps you keep going south.',
    more: YT('monarch butterfly sun compass')
  },
  glide: {
    title: 'Soaring, not flapping',
    body: 'Flapping is expensive. Migrating monarchs spend most of the trip gliding, riding rising columns of warm air called thermals — just like hawks. Ride a thermal up, glide down for miles, repeat. Look for the shimmer and the circling birds.',
    simple: 'Flapping is tiring. Find a warm rising thermal, ride it up, then glide!',
    more: YT('monarch butterflies soaring thermals')
  },
  wind: {
    title: 'Watch the wind',
    body: 'A tailwind can double your speed for free; a headwind can stop you dead. Monarchs wait for the right wind, and in a headwind they fly low where the air moves slower — sometimes just above the grass.',
    simple: 'Tailwind: fly high and go fast! Headwind: fly low, near the grass.',
    more: YT('monarch migration wind radar')
  },
  nectar: {
    title: 'Nectar is fuel',
    body: 'A monarch drinks nectar through a straw called a proboscis. During migration it turns the sugar into fat and gets HEAVIER as it goes, arriving in Mexico with enough fat stored to last five months of winter. Goldenrod, asters and frostweed are favourites.',
    simple: 'You drink nectar with a straw called a proboscis. It turns into fat for the winter.',
    more: YT('monarch drinking nectar proboscis')
  },
  roost: {
    title: 'Roosting together',
    body: 'Monarchs cannot fly when it is cold or dark, so each evening they gather in trees, sometimes thousands in one tree. Hanging together keeps them warmer and safer. In the morning, when the sun warms their wings, they set off again.',
    simple: 'At night monarchs sleep together in trees, sometimes thousands in one tree.',
    more: YT('monarch roost migration')
  },
  storm: {
    title: 'Storm!',
    body: 'Rain soaks wings and cold stops flight muscles working. Migrating monarchs hide from storms in trees and under leaves, sometimes for days. A strong cold front is actually good news afterwards: it brings a northerly tailwind.',
    simple: 'Rain and cold are dangerous. Hide in a tree until the storm passes.',
    more: YT('monarch butterflies in storm')
  },
  lake: {
    title: 'Crossing the lake',
    body: 'The Great Lakes are in the way. Monarchs pile up at points like Point Pelee and Long Point and wait, sometimes for days, for a tailwind. Then they cross 30 miles of open water in one go. Ships have seen them flying low over the waves.',
    simple: 'The lake is huge. Wait for a tailwind, then fly across without stopping!',
    more: YT('monarchs Point Pelee migration')
  },
  funnel: {
    title: 'The Texas funnel',
    body: 'Monarchs from all over the eastern half of North America converge on Texas. Millions pass through in October, and the sky can be full of them. That is why it is called the funnel.',
    simple: 'In Texas, monarchs from EVERYWHERE meet. Millions of them!',
    more: YT('monarch migration Texas funnel')
  },
  toxic: {
    title: 'Why the birds leave you alone',
    body: 'The orange and black pattern is a warning. A bird that eats one monarch is sick for hours and never tries again. Even so, in Mexico two birds — the black-backed oriole and the black-headed grosbeak — have learned to eat only the least poisonous parts.',
    simple: 'Birds know orange and black means "yuck". Most leave you alone.',
    more: YT('monarch butterfly toxic birds')
  },
  tag: {
    title: 'Tagged!',
    body: 'Every autumn, volunteers catch monarchs and stick a tiny paper tag on one wing. The tag weighs almost nothing. When a tagged monarch is found in Mexico, scientists learn exactly where it came from and how long it took. Tagged monarchs have flown 265 miles in a single day.',
    simple: 'Scientists put a tiny sticker on your wing to track you. It does not hurt.',
    more: YT('monarch watch tagging')
  },
  dia: {
    title: 'Day of the Dead',
    body: 'The monarchs reach central Mexico around November 1st and 2nd, the Día de Muertos. For hundreds of years people there have believed the butterflies are the returning souls of their ancestors, and marigolds are laid out to welcome them.',
    simple: 'In Mexico, monarchs arrive on the Day of the Dead. People say they are the spirits of family.',
    more: YT('monarch Day of the Dead Mexico')
  },
  arrive: {
    title: 'You made it!',
    body: 'Every eastern monarch spends winter on the same dozen mountaintops in Michoacán, in oyamel fir forests 10,000 feet up. Nobody knew where they went until 1975. The trees turn orange with butterflies — up to 15,000 on a single branch — and the sound of their wings is like rain.',
    simple: 'You are in the fir forest in Mexico with millions of monarchs. The trees are orange with butterflies!',
    more: YT('monarch overwintering forest Mexico')
  },
  winter: {
    title: 'Sleeping through winter',
    body: 'The forest is cool but not freezing — perfect for saving energy. The monarchs barely move for four months, living off the fat they stored. On sunny days they flutter down to drink at streams. In March, warmth wakes them up and they finally mate.',
    simple: 'You sleep all winter in the cool forest, living on your fat. In spring you wake up.',
    more: YT('monarch butterflies winter Mexico stream')
  },
  spring: {
    title: 'North again — the relay',
    body: 'The super generation flies north to Texas and lays eggs on the first spring milkweed, then dies. Their children fly to the Midwest and lay eggs; their grandchildren reach Canada. It takes three or four short-lived generations to get back north — and then a new super generation is born.',
    simple: 'In spring you fly north and lay eggs. Your great-grandchildren will fly south next year.',
    more: YT('monarch spring migration generations')
  },
  wasp: {
    title: 'A wasp!',
    body: 'Paper wasps hunt caterpillars to feed their grubs. Even a poisonous monarch caterpillar is not safe. Small caterpillars hide on the underside of leaves; bigger ones drop off the plant on a silk line and climb back up later.',
    simple: 'A wasp! Hide under the leaf. Hold DOWN to stay very still.',
    more: YT('paper wasp monarch caterpillar')
  },
  ants: {
    title: 'Ants on guard',
    body: 'The bright yellow oleander aphids on milkweed squirt out sweet honeydew, and ants farm them for it. Ants will shove a caterpillar off the stem to protect their herd. Go around.',
    simple: 'Ants guard the yellow aphids. Go around them on another leaf!',
    more: YT('ants aphids milkweed')
  },
  aphids: {
    title: 'Yellow aphids',
    body: 'Those little yellow bugs are oleander aphids. They drink milkweed sap too, and they are just as poisonous as you. Ladybugs eat them anyway. They are not your food — you only eat leaves.',
    simple: 'The yellow bugs are aphids. They are not food. You eat leaves!',
    more: YT('oleander aphids milkweed')
  },
  night: {
    title: 'Night on the milkweed',
    body: 'Caterpillars keep eating at night — they eat almost around the clock. A butterfly, though, needs sunshine to warm its flight muscles, so it sleeps under a leaf until morning. Listen for the crickets.',
    simple: 'It is night. Caterpillars keep eating. Butterflies sleep till the sun is up.',
    more: YT('milkweed at night')
  },
  exhausted: {
    title: 'Out of fuel',
    body: 'A monarch that runs out of energy cannot flap. It drops down and rests, and needs nectar before it can go on. Migrating monarchs plan for this — they stop to drink every day and fatten up as they go.',
    simple: 'You ran out of energy! Rest, then find flowers.',
    more: YT('monarch butterfly resting')
  }
};

/* ---------- on-screen hints, in two reading levels ---------- */
const HINTS = {
  egg: ['Press SPACE (or tap) again and again to chew out of your egg!', '🥚 Tap SPACE lots to hatch!'],
  crawl: ['Arrow keys or WASD to crawl. Get onto a leaf and press SPACE to bite it!', '🐛 Arrows to crawl. On a leaf, SPACE to bite!'],
  bite: ['Hold SPACE on a leaf to munch. When a leaf is eaten up, find another.', '🍃 Hold SPACE to munch!'],
  branch: ['At a fork, hold the arrow toward the leaf you want. Or click the plant to walk there.', '🌿 Hold the arrow toward a leaf. Or tap the plant!'],
  molt: ['You are growing… hold still!', '✨ Growing… hold still!'],
  readyHang: ['You are FULL. Find a glowing spot and press SPACE to hang up!', '🪝 You are FULL! Go to a glowing spot. Press SPACE.'],
  jhang: ['Hanging in a J… press SPACE to wriggle!', '🪝 Hanging… Press SPACE to wriggle!'],
  chrysalis: ['Metamorphosis in progress. Press SPACE to twitch — real chrysalises do it to scare predators!', '💚 Changing… Press SPACE to wiggle!'],
  drying: ['Your wings are wet. Hang still while they unfold and dry.', '🧡 Hang still. Your wings are drying.'],
  adult: ['SPACE to take off! Visit the milkweed flowers to drink nectar.', '🦋 SPACE to fly! Drink nectar at flowers.'],
  flying: ['Steer with the arrows. Near a flower or stem, press SPACE to land.', '✈️ Arrows to steer. SPACE to land.'],
  sip: ['Press SPACE at the flower to drink nectar.', '🌸 SPACE to drink!'],
  readyGo: ['You are strong and the days are getting short. Time to fly SOUTH!', '🧭 Time to fly SOUTH!'],
  migrate: ['Fly right, toward the south. Arrows steer, SPACE flaps. Glide to save energy!', '➡️ Fly right! Arrows steer, SPACE flaps.'],
  thermal: ['A thermal! Circle in the shimmer to rise for free.', '🌀 A thermal! Ride it up!'],
  headwind: ['Headwind! Fly low, the wind is weaker near the ground.', '💨 Headwind! Fly low!'],
  tailwind: ['Tailwind! Fly high and let it carry you.', '💨 Tailwind! Fly high!'],
  nectarNear: ['Flowers! Press SPACE to land and drink.', '🌼 Flowers! SPACE to drink.'],
  lowEnergy: ['Energy low! Find flowers and drink.', '🪫 Low energy! Find flowers!'],
  dusk: ['Getting dark. Find a glowing roost tree and press SPACE to sleep.', '🌙 Getting dark. Find a tree. SPACE to sleep.'],
  roosting: ['Zzz… roosting with hundreds of other monarchs until dawn.', '💤 Sleeping in the tree…'],
  stormWarn: ['A storm is coming! Get to a tree and press SPACE to shelter.', '⛈️ Storm! Get to a tree. SPACE to hide.'],
  storm: ['Rain! Get down and into a tree!', '🌧️ Rain! Into a tree!'],
  lake: ['Open water ahead — nowhere to land. Fill up, wait for a tailwind, then go!', '🌊 Water ahead! Fill up first, then go!'],
  exhausted: ['Out of energy… resting. Nectar will fix it.', '😮‍💨 Resting… find nectar soon.'],
  landHint: ['Get closer to a flower, a tree or the ground to land.', 'Get closer to land!'],
  wasp: ['A WASP! Hold DOWN to freeze, or hide under a leaf!', '🐝 WASP! Hold DOWN to freeze!'],
  frozen: ['Frozen still… the wasp cannot see you.', '🧊 Frozen! It cannot see you.'],
  safe: ['Phew! It flew off.', '😅 Phew! It went away.'],
  forest: ['The oyamel forest! Find a fir bough and press SPACE to join the cluster.', '🌲 The forest! SPACE at a fir tree to join!'],
  arrived: ['You made it. Rest with the others.', '🎉 You made it!'],
  winterFly: ['Sunny day! Flutter about, then land on a fir to rest again.', '☀️ Sunny! Fly about, then land on a fir.']
};
