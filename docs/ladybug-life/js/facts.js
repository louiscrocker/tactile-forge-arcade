/* ============================================================
   facts.js — species, life stages, difficulty and the biology
   ============================================================
   Every fact has a full `body` and a `simple` version in short
   words for a child who is just learning to read.  Spots are per
   half-shell as [x, y, r] (x 0..1 from the seam, y -1 front..+1
   rear, r as a fraction of the shell half-width).
   ============================================================ */
'use strict';

const SPECIES = {
  sevenspot: {
    key: 'sevenspot', name: 'Seven-spot Ladybird', short: 'Seven-spot', latin: 'Coccinella septempunctata',
    color: '#d92c2c', spotColor: '#151515', pronotum: 'patches',
    spots: [[0, -0.72, .13], [.55, -.35, .15], [.78, .28, .14], [.32, .62, .13]],
    speed: 1, need: 1, size: 1, special: 'balanced',
    power: 'All-rounder: steady speed, steady appetite.',
    blurb: 'The classic. Europe\'s most common ladybird and a champion aphid eater — an adult can munch 50 aphids a day.',
    simple: 'The classic red ladybug with seven spots. It eats LOTS of aphids.',
    wiki: 'https://en.wikipedia.org/wiki/Coccinella_septempunctata'
  },
  twospot: {
    key: 'twospot', name: 'Two-spot Ladybird', short: 'Two-spot', latin: 'Adalia bipunctata',
    color: '#e8372a', spotColor: '#151515', pronotum: 'patches',
    spots: [[.5, .0, .2]],
    speed: 1.25, need: 1, size: .9, special: 'fast',
    power: 'Speedy: crawls and flies 25% faster.',
    blurb: 'Small and speedy, with one big spot on each side. Loves gardens and will happily live on a rose bush.',
    simple: 'Small and fast. One big spot on each side.',
    wiki: 'https://en.wikipedia.org/wiki/Adalia_bipunctata'
  },
  convergent: {
    key: 'convergent', name: 'Convergent Lady Beetle', short: 'Convergent', latin: 'Hippodamia convergens',
    color: '#f0741f', spotColor: '#151515', pronotum: 'converge',
    spots: [[0, -0.7, .1], [.45, -.45, .1], [.8, -.1, .1], [.35, .1, .1], [.7, .45, .1], [.3, .7, .1]],
    speed: 1.05, need: 1, size: 1, special: 'sneaky',
    power: 'Sneaky: aphids notice you later and drop less.',
    blurb: 'North America\'s favourite. Named for the two white lines that converge on its neck shield. Sold by the bag to gardeners.',
    simple: 'Orange, with two white lines on its neck. Gardeners buy bags of them!',
    wiki: 'https://en.wikipedia.org/wiki/Hippodamia_convergens'
  },
  harlequin: {
    key: 'harlequin', name: 'Harlequin Ladybird', short: 'Harlequin', latin: 'Harmonia axyridis',
    color: '#e8622a', spotColor: '#151515', pronotum: 'M',
    spots: [[.35, -.6, .11], [.75, -.4, .11], [.45, -.1, .11], [.85, .15, .1], [.3, .3, .11], [.65, .55, .11], [.25, .75, .1], [0, -.05, .1], [0, .45, .09]],
    speed: .95, need: 1.25, size: 1.15, special: 'cannibal',
    power: 'Big appetite: needs more food, but can eat smaller wild larvae (worth 3 aphids).',
    blurb: 'Big, bold and comes in dozens of patterns. It has an "M" on its neck. Eats a LOT — sometimes even other ladybugs.',
    simple: 'Big and bold with an M on its neck. It eats a LOT.',
    wiki: 'https://en.wikipedia.org/wiki/Harmonia_axyridis'
  },
  fourteenspot: {
    key: 'fourteenspot', name: 'Fourteen-spot Ladybird', short: 'Fourteen-spot', latin: 'Propylea quattuordecimpunctata',
    color: '#f2cf3a', spotColor: '#1a1a1a', pronotum: 'yellow',
    spots: [[.3, -.6, .13], [.75, -.55, .12], [.55, -.15, .14], [.2, .1, .12], [.8, .15, .12], [.45, .5, .13], [.25, .8, .1]],
    speed: 1.1, need: .7, size: .8, special: 'small',
    power: 'Tiny: needs 30% fewer aphids to grow.',
    blurb: 'Yellow with squarish black spots that often join up like a checkerboard. Tiny, but eats aphids like everyone else.',
    simple: 'Yellow with square black spots. Tiny!',
    wiki: 'https://en.wikipedia.org/wiki/Propylea_quattuordecimpunctata'
  },
  twicestabbed: {
    key: 'twicestabbed', name: 'Twice-stabbed Lady Beetle', short: 'Twice-stabbed', latin: 'Chilocorus stigma',
    color: '#1a1a1e', spotColor: '#e0322a', pronotum: 'none',
    spots: [[.5, -.05, .2]],
    speed: 1, need: 1, size: 1, special: 'scale',
    power: 'Scale eater: can also eat the brown scale insects on woody stems (worth 2 aphids).',
    blurb: 'Shiny black with two blood-red spots, like it was poked twice. A tree-dweller that also eats scale insects.',
    simple: 'Shiny black with two red spots. It eats scale bugs too.',
    wiki: 'https://en.wikipedia.org/wiki/Chilocorus_stigma'
  }
};

const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg', need: 0, scale: 1, speed: 0 },
  { key: 'L1', name: 'Larva · 1st instar', short: '1st', need: 6, scale: .5, speed: 78, reach: 12 },
  { key: 'L2', name: 'Larva · 2nd instar', short: '2nd', need: 11, scale: .68, speed: 92, reach: 14 },
  { key: 'L3', name: 'Larva · 3rd instar', short: '3rd', need: 18, scale: .88, speed: 108, reach: 16 },
  { key: 'L4', name: 'Larva · 4th instar', short: '4th', need: 28, scale: 1.12, speed: 122, reach: 19 },
  { key: 'pupa', name: 'Pupa', short: 'Pupa', need: 0, scale: 1, speed: 0 },
  { key: 'adult', name: 'Adult ladybug', short: 'Adult', need: 16, scale: 1, speed: 150, reach: 22 }
];

const DIFFICULTY = {
  easy: { label: 'Little kid', mult: .55, ants: false, drop: .08, flee: .3, pupaTime: 16, antSpeed: 40, bird: false },
  normal: { label: 'Big kid', mult: 1, ants: true, drop: .22, flee: .6, pupaTime: 24, antSpeed: 55, bird: true },
  hard: { label: 'Scientist', mult: 1.6, ants: true, drop: .4, flee: 1, pupaTime: 30, antSpeed: 75, bird: true }
};

/* ---------- fact cards ----------
   `more` is a real-world link shown as "See the real thing". */
const YT = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const FACTS = {
  hatch: {
    title: 'Hatched!',
    body: 'Ladybug eggs are laid in clusters of 10 to 50 on the underside of a leaf, right next to an aphid colony. The larva that pops out is hungry from its very first second — and its first meal is often its own egg shell.',
    simple: 'You hatched! Baby ladybugs are hungry right away. Some even eat their egg shell.',
    more: YT('ladybug eggs hatching')
  },
  larva: {
    title: 'Meet the larva',
    body: 'It looks like a tiny alligator: long, spiky and dark with orange spots. People often squish them thinking they are pests — but a single larva eats around 400 aphids before it becomes a pupa.',
    simple: 'A ladybug larva looks like a tiny alligator. It eats about 400 aphids!',
    more: YT('ladybug larva eating aphids')
  },
  molt1: {
    title: 'First molt!',
    body: 'Insects wear their skeleton on the outside, so to grow they have to shed it. The old skin splits along the back and the larva wriggles out, bigger and softer. The empty skin left behind is called an exuvia. Each stage between molts is an instar.',
    simple: 'You grew too big for your skin, so you shed it! The old skin stays on the branch.',
    more: YT('ladybug larva molting')
  },
  molt2: {
    title: 'Second molt!',
    body: 'Third instar now. The spots are bolder and the spikes are longer. Larvae hunt by bumping into aphids — their eyesight is poor — and they grab them with strong jaws called mandibles.',
    simple: 'You are bigger and spikier. Larvae find aphids by bumping into them.',
    more: YT('ladybug larva close up')
  },
  molt3: {
    title: 'Third molt!',
    body: 'Fourth and final instar — the biggest and hungriest stage. About half of everything a larva eats in its whole life is eaten now. Once it is full it stops, finds a sheltered leaf and glues its tail down.',
    simple: 'This is the biggest, hungriest stage. Eat up! Then find a leaf.',
    more: YT('ladybug fourth instar larva')
  },
  pupate: {
    title: 'Pupa time',
    body: 'The larva sheds one last time and becomes a pupa. It cannot walk or eat. Inside, its whole body is being rebuilt — legs, wings, everything. It looks still, but if you touch it, it flicks up to scare you off. Try pressing SPACE!',
    simple: 'You are a pupa now. You cannot walk or eat. Inside, you are changing into a ladybug!',
    more: YT('ladybug pupa')
  },
  eclose: {
    title: 'A ladybug!',
    body: 'The pupa case splits and out crawls the adult — but it is pale yellow with NO spots. Its shell is still soft. Over the next hours it pumps blood into its wings to unfold them, and its colour and spots slowly darken. Watch it happen!',
    simple: 'You are a ladybug! New ladybugs are yellow with no spots. Watch your spots appear!',
    more: YT('ladybug emerging from pupa')
  },
  fly: {
    title: 'Wings dry — you can fly!',
    body: 'Ladybugs have two sets of wings. The hard spotted shells are the elytra: they lift up out of the way. Underneath are the real flight wings, which are thin and fold up like origami. A ladybug beats them about 85 times a second.',
    simple: 'Your wings are dry! The spotted shells open, and the thin wings underneath flap super fast.',
    more: YT('ladybug taking off slow motion')
  },
  eggs: {
    title: 'Eggs laid!',
    body: 'A female ladybug lays her eggs near food so the babies can start eating immediately. She can lay over a thousand eggs in her life. And now the whole cycle starts again — egg, larva, pupa, ladybug.',
    simple: 'You laid eggs next to the aphids so the babies can eat. Now it starts again!',
    more: YT('ladybug laying eggs')
  },
  ants: {
    title: 'Ants on guard!',
    body: 'Aphids drink sap and squirt out a sugary liquid called honeydew. Ants love it, so they protect aphid colonies like farmers guarding cows — and they will shove a ladybug larva off the branch. Go around by another branch!',
    simple: 'Ants guard the aphids because aphids make sweet honeydew. Go around on another branch!',
    more: YT('ants protecting aphids from ladybug')
  },
  drop: {
    title: 'The aphids are dropping!',
    body: 'When an aphid senses danger it may simply let go and fall off the plant. Some aphids even release an alarm scent that tells their neighbours to drop too. Sneak up fast!',
    simple: 'Scared aphids let go and fall off! Sneak up fast.',
    more: YT('aphids dropping off plant ladybug')
  },
  winged: {
    title: 'A flying aphid arrived',
    body: 'When a colony gets crowded or the plant runs low, aphids start being born with wings. These "alates" fly off to start a brand-new colony somewhere else. That is why the aphids never really run out.',
    simple: 'Some aphids grow wings and fly to a new plant to start a new colony.',
    more: YT('winged aphid')
  },
  birth: {
    title: 'Aphids are born, not laid',
    body: 'In summer, aphid mothers give birth to live babies without needing a father — and the babies are already pregnant. One aphid could become thousands in a few weeks. That is why gardeners love ladybugs.',
    simple: 'Aphid mums have live babies, lots and lots of them. That is why gardeners love ladybugs!',
    more: YT('aphid giving birth')
  },
  night: {
    title: 'Night in the garden',
    body: 'Ladybug larvae keep hunting at night and rest when it gets cold. Adults tuck their legs and antennae in and sleep under a leaf. Listen for the crickets.',
    simple: 'It is night. Larvae keep hunting. Ladybugs sleep under a leaf. Listen for crickets!',
    more: YT('garden at night crickets fireflies')
  },
  rain: {
    title: 'Rain!',
    body: 'Insects are so small that a raindrop is like a bucket of water to them. Aphids tuck in under the leaves, and ladybugs shelter too. When the sun comes back, the wet leaves make a great place to drink.',
    simple: 'Rain! To a tiny bug a raindrop is huge. The aphids are hiding under leaves.',
    more: YT('insects in the rain macro')
  },
  gust: {
    title: 'Whoosh!',
    body: 'A gust of wind shakes the whole plant. Aphids hold on with tiny claws but some get blown right off. Ladybug larvae have strong hooked feet and just hang on.',
    simple: 'Wind! Hold on tight. Some aphids get blown away.',
    more: YT('insects wind plant')
  },
  bird: {
    title: 'A bird!',
    body: 'Birds eat insects, but ladybugs are bitter and can squeeze smelly yellow blood from their knees — reflex bleeding. Their bright colours are a warning: "I taste awful!" Larvae have no colours, so they freeze or hide under a leaf.',
    simple: 'A bird! Ladybugs taste awful, so birds spit them out. Larvae freeze and hide.',
    more: YT('ladybug reflex bleeding')
  },
  honeydew: {
    title: 'Honeydew',
    body: 'Aphids drink so much sugary sap that they squirt the extra out of their back end as sweet droplets called honeydew. Ants tap the aphids with their antennae to ask for a drink, like milking a cow.',
    simple: 'Aphids make sweet drops called honeydew. Ants love to drink it.',
    more: YT('ants milking aphids honeydew')
  },
  spring: {
    title: 'Spring',
    body: 'New leaves unfold and the first aphids hatch from eggs that survived the winter. Ladybugs wake up from hibernation starving and go hunting.',
    simple: 'Spring! New leaves, new aphids. The ladybugs wake up hungry.',
    more: YT('spring garden time lapse')
  },
  summer: {
    title: 'Summer',
    body: 'Warm weather makes everything faster. Aphid colonies explode, larvae grow in two or three weeks, and there can be several ladybug generations before autumn.',
    simple: 'Summer! Everything grows fast. Lots of aphids, lots of ladybugs.',
    more: YT('ladybug life cycle time lapse')
  },
  autumn: {
    title: 'Autumn',
    body: 'Leaves turn yellow and red because the plant pulls the green chlorophyll back in before dropping them. Aphids lay tough eggs that can survive frost. Ladybugs eat as much as they can to fatten up.',
    simple: 'Autumn! Leaves turn yellow and fall. Ladybugs eat up before the cold.',
    more: YT('autumn leaves changing colour')
  },
  winter: {
    title: 'Winter',
    body: 'It is too cold to fly, and there is nothing to eat. Ladybugs squeeze into a sheltered crack — a wall, a log, a window frame — often hundreds together, and sleep until spring. This is called overwintering.',
    simple: 'Winter! Too cold. Ladybugs sleep together in a warm crack until spring.',
    more: YT('ladybugs hibernating cluster')
  },
  hibernate: {
    title: 'Sleeping through winter',
    body: 'Your body slows right down and runs on the fat you stored in autumn. A ladybug can sleep for months like this. Hundreds huddle in the same crack for warmth, and gardeners sometimes find them behind shutters.',
    simple: 'You are sleeping through winter with lots of other ladybugs. See you in spring!',
    more: YT('ladybug overwintering')
  },
  wild: {
    title: 'Wild larvae',
    body: 'You are not the only larva in the garden. Other ladybugs laid eggs here too, and their larvae are hunting the same aphids. When food runs low, big larvae will even eat small ones.',
    simple: 'Other larvae live here too. They eat the same aphids!',
    more: YT('ladybug larvae competing')
  },
  scale: {
    title: 'Scale insects',
    body: 'Those little brown bumps on the woody stem are scale insects: relatives of aphids that glue themselves down under a waxy shield and never move again. Twice-stabbed lady beetles are one of the few things that eat them.',
    simple: 'The brown bumps on the stem are scale bugs. Only some ladybugs can eat them.',
    more: YT('scale insects on plant')
  },
  milkweed: {
    title: 'Poison plant, poison aphids',
    body: 'Milkweed sap is full of poisons called cardenolides. Oleander aphids drink it anyway and become poisonous themselves, which is why they are bright yellow — a warning colour. Ladybugs still eat them, carefully.',
    simple: 'Milkweed is poisonous. The yellow aphids on it are poisonous too!',
    more: YT('oleander aphids milkweed')
  },
  plants: {
    title: 'A whole garden',
    body: 'A real garden has many plants and each one has its own aphids: green ones on roses, black ones on beans, yellow ones on milkweed. An adult ladybug flies from plant to plant looking for the biggest colony.',
    simple: 'There are three plants here. Each one has different aphids. Fly between them!',
    more: YT('ladybug flying between plants')
  }
};

/* ---------- on-screen hints, in two reading levels ---------- */
const HINTS = {
  egg: ['Press SPACE (or tap) again and again to wriggle out of your egg!', '🥚 Tap SPACE lots to hatch!'],
  crawl: ['Arrow keys or WASD to crawl. Bump into an aphid to munch it!', '🐛 Arrows to crawl. Bump an aphid to eat it!'],
  branch: ['At a fork, hold the arrow toward the branch you want. Or click the plant to walk there.', '🌿 Hold the arrow toward a branch. Or tap the plant!'],
  molt: ['You are growing… hold still!', '✨ Growing… hold still!'],
  biggest: ['Last larval stage! Eat up — then find a leaf.', '🐛 Biggest larva! Eat up, then find a leaf.'],
  readyPupa: ['You are FULL. Find a glowing leaf and press SPACE to become a pupa!', '🍃 You are FULL! Go to a glowing leaf. Press SPACE.'],
  pupa: ['Metamorphosis in progress. Press SPACE to twitch and scare off predators!', '🟠 Changing… Press SPACE to wiggle!'],
  fresh: ['Your shell is soft and pale. Crawl around while it dries and your spots appear.', '🟡 Your shell is soft. Watch your spots appear!'],
  adult: ['SPACE to take off and fly! Eat aphids to get ready to lay eggs.', '🐞 SPACE to fly! Eat aphids to make eggs.'],
  flying: ['Steer with the arrows. Get close to a branch and press SPACE to land.', '✈️ Arrows to steer. Near a branch, SPACE to land.'],
  readyEggs: ['Time to lay eggs! Find a glowing leaf and press E.', '🥚 Lay eggs! Go to a glowing leaf. Press E.'],
  landHint: ['Get closer to a branch to land.', 'Get closer to a branch!'],
  bird: ['A BIRD! Hold DOWN to freeze, or hide under a leaf!', '🐦 BIRD! Hold DOWN to freeze!'],
  birdAdult: ['A BIRD! Hold DOWN to play dead!', '🐦 BIRD! Hold DOWN to play dead!'],
  birdScare: ['Eek! Next time hold DOWN to freeze, or hide under a leaf.', '😮 Eek! Next time hold DOWN to freeze.'],
  rain: ['Rain! Shy aphids are hiding under leaves. The bold ones are still out.', '🌧️ Rain! Some aphids are hiding.'],
  winter: ['Winter is coming! Fly to the garden wall and press SPACE at the warm crack to hibernate.', '❄️ Cold! Fly to the wall. Press SPACE at the crack to sleep.'],
  hibernating: ['Zzz… sleeping until spring.', '💤 Sleeping until spring…'],
  spring: ['Spring! Fly out and find breakfast.', '🌸 Spring! Go find breakfast.'],
  otherPlant: ['Fly to another plant to find more aphids!', '✈️ Fly to another plant!'],
  frozen: ['Frozen still… the bird cannot see you.', '🧊 Frozen! The bird cannot see you.'],
  safe: ['Phew! It flew off.', '😅 Phew! It went away.']
};
