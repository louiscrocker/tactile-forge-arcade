/* ============================================================
   facts.js — the crabs, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the Christmas
   Island red crab (Gecarcoidea natalis), simplified for play.
   Each fact has a full version, a "little words" version and a
   link to see the real thing (a Wikipedia page or a YouTube
   search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Three colours of red crab.  Most are bright red; a few are orange,
   and a very few are purple (all three are real colour forms).
   shell / shell2 = carapace light and dark, claw = claw tips, leg = legs */
const FORMS = {
  red:    { name: 'Red crab', short: 'Red', latin: 'Gecarcoidea natalis',
    shell: '#e2321e', shell2: '#9c1a0e', claw: '#ffd9c8', leg: '#c8281a', eye: '#1a0a06',
    blurb: 'The classic Christmas Island red crab: bright scarlet from claw to toe.',
    simple: 'Bright red, like a fire engine!', power: 'The most common colour' },
  orange: { name: 'Orange crab', short: 'Orange', latin: 'Gecarcoidea natalis (orange form)',
    shell: '#f07a1a', shell2: '#b0480a', claw: '#ffe6c8', leg: '#e0661a', eye: '#1a0a06',
    blurb: 'A few red crabs are orange instead. Same crab, sunnier colour.',
    simple: 'An orange one! A few crabs are orange.', power: 'Hard to spot in the leaves' },
  purple: { name: 'Purple crab', short: 'Purple', latin: 'Gecarcoidea natalis (purple form)',
    shell: '#7a3a9a', shell2: '#4a1a66', claw: '#f0d8ff', leg: '#6a2a88', eye: '#140a1a',
    blurb: 'Very rare: only a few red crabs out of thousands are purple.',
    simple: 'A rare purple crab!', power: 'The rarest colour' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy crab', short: 'Boy', blurb: 'Boys have bigger claws. At the sea they dig a burrow and push rivals away.', simple: 'Big claws! Dig a burrow and push!' },
  girl: { name: 'Girl crab', short: 'Girl', blurb: 'Girls have a wide tummy flap. At the sea they carry the eggs and shake them into the waves.', simple: 'She carries the eggs to the sea!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'zoea', name: 'Zoea larva', short: 'Zoea' },
  { key: 'megalopa', name: 'Megalopa', short: 'Megalopa' },
  { key: 'baby', name: 'Baby crab', short: 'Baby' },
  { key: 'young', name: 'Young crab', short: 'Young' },
  { key: 'adult', name: 'Adult crab', short: 'Adult' },
  { key: 'march', name: 'The great march', short: 'March' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much food each step takes, per difficulty
   zoea: plankton to moult to zoea II, zoea III, then megalopa
   crab: forest food to moult to young crab, bigger young crab, then adult
   dry:  how fast the sun dries a crab's gills out
   rival: how hard a rival male pushes · robber: the robber crab visits
   wins: rivals beaten to be king of the terrace · shakes: good shakes to release the eggs */
const DIFFICULTY = {
  easy:   { name: 'Little kid', zoea: [20, 46, 80], crab: [30, 80, 160], dry: .5, rival: .55, robber: false, wins: 1, shakes: 3, dig: 1.3, fish: false },
  normal: { name: 'Big kid',    zoea: [30, 70, 120], crab: [50, 130, 250], dry: 1, rival: .8, robber: true, wins: 2, shakes: 4, dig: 1, fish: true },
  hard:   { name: 'Scientist',  zoea: [40, 90, 150], crab: [70, 170, 320], dry: 1.3, rival: 1.05, robber: true, wins: 3, shakes: 5, dig: .85, fish: true }
};
const BONUS = 1.5;      /* an adult may keep eating to 150 % of the adult threshold: a bigger crab */

/* how wide a crab's shell is, in cm, from its moult and its food (a real
   adult red crab is up to about 11.6 cm across) */
function crabCM(instar, food, th) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  if (instar <= 1) return lerp(.5, 1.2, t(0, th[0]));
  if (instar === 2) return lerp(1.6, 3.2, t(th[0], th[1]));
  if (instar === 3) return lerp(3.6, 6.2, t(th[1], th[2]));
  return lerp(7, 11.6, t(th[2], th[2] * BONUS));
}
/* a crab's drawn width in world units (stylised: a baby crab is never drawn smaller than 6 units, so you can see it) */
function crabUnits(cm) { return Math.max(6, cm * 4); }

const FACTS = {
  egg: { title: 'Eggs for the sea', body: 'A mother red crab carries up to 100,000 eggs under her tummy flap. Before dawn, when the high tide turns, she stands at the edge of the sea and shakes them into the waves.', simple: 'Mum shakes her eggs into the sea!', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  hatch: { title: 'Hatching in a splash', body: 'Red crab eggs hatch the moment they touch the salty sea water. Out pops a tiny larva called a zoea, smaller than a grain of rice.', simple: 'The eggs hatch the moment they touch the sea!', more: 'https://www.youtube.com/results?search_query=christmas+island+red+crab+spawning' },
  zoea: { title: 'The zoea', body: 'A crab larva looks nothing like a crab. A zoea is see-through, with two huge eyes, a long spine and feathery legs for swimming. It is part of the plankton: the tiny drifters of the sea.', simple: 'A baby crab larva is called a zoea. It is see-through, with big eyes!', more: 'https://en.wikipedia.org/wiki/Zoea' },
  plankton: { title: 'Plankton', body: 'Plankton are the tiny living things that drift in the sea. Some are tiny plants called diatoms. They make a big part of the oxygen we breathe, and they are food for almost everything else in the sea.', simple: 'Tiny drifting plants and animals. Food for the whole sea!', more: 'https://en.wikipedia.org/wiki/Plankton' },
  diatom: { title: 'Glass houses', body: 'Diatoms are tiny plants that live in little cases made of glass. They come in circles, boats, stars and chains.', simple: 'Diatoms are tiny plants in glass cases!', more: 'https://en.wikipedia.org/wiki/Diatom' },
  seamoult: { title: 'Growing at sea', body: 'A zoea grows by moulting: it climbs out of its old skin in a new, bigger one. Red crab larvae moult again and again in the open ocean for about a month.', simple: 'The zoea moults to get bigger!', more: 'https://en.wikipedia.org/wiki/Ecdysis' },
  updown: { title: 'Up at night, down by day', body: 'Every night, plankton all over the world swim up to the surface to feed, and every morning they sink back down where it is dark and safe. It is the biggest daily journey of animals on Earth.', simple: 'Plankton swim up at night and down in the day!', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  glow: { title: 'Glowing sea', body: 'Some plankton flash blue light when something bumps them. This is called bioluminescence. On dark nights, waves can sparkle with it.', simple: 'Some plankton glow blue when you bump them!', more: 'https://en.wikipedia.org/wiki/Bioluminescence' },
  copepod: { title: 'Copepods', body: 'Copepods are tiny shrimp-like animals with one red eye. They are some of the most common animals on Earth, and they can jump away fast.', simple: 'Tiny jumpy shrimps. Fast!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  fish: { title: 'Fish eat plankton', body: 'Little fish swim through the plankton with their mouths open. A zoea\'s long spines make it harder to swallow.', simple: 'Little fish eat plankton. The zoea has spikes!', more: 'https://en.wikipedia.org/wiki/Forage_fish' },
  whaleshark: { title: 'The whale shark', body: 'The whale shark is the biggest fish in the world, as long as a bus. It has no sharp teeth: it gulps huge mouthfuls of plankton. Whale sharks visit Christmas Island at crab spawning time.', simple: 'The biggest fish in the world! It eats tiny plankton.', more: 'https://en.wikipedia.org/wiki/Whale_shark' },
  manta: { title: 'Manta rays', body: 'Manta rays fly through the water on wide wings, scooping up plankton. A big manta can be wider than a car.', simple: 'A manta ray flies under the water!', more: 'https://en.wikipedia.org/wiki/Manta_ray' },
  megalopa: { title: 'The megalopa', body: 'After its last zoea moult the larva becomes a megalopa: half crab, half shrimp, with little claws and a swimming tail. Now it swims back to find the island.', simple: 'Now it has claws and a tail. It swims back to the island!', more: 'https://en.wikipedia.org/wiki/Megalopa' },
  jelly: { title: 'Jellyfish taxi', body: 'Some crab larvae ride on jellyfish. The jellyfish drifts along, and the little crab gets a free ride and somewhere to hide.', simple: 'Baby crabs can ride on jellyfish!', more: 'https://www.youtube.com/results?search_query=crab+larva+riding+jellyfish' },
  smell: { title: 'Finding home', body: 'Larvae can smell and hear the reef. The sound of waves and reef animals helps them swim back towards land.', simple: 'They follow the smell and sounds of the reef.', more: 'https://en.wikipedia.org/wiki/Coral_reef' },
  ashore: { title: 'Out of the sea', body: 'About a month after the eggs hatched, the megalopae gather in the shallows. Then they crawl out onto the rocks and moult into tiny crabs, just 5 millimetres across.', simple: 'The megalopa crawls out and turns into a tiny crab!', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  carpet: { title: 'A red carpet', body: 'In a good year, so many baby crabs come out of the sea that the rocks and roads near the shore turn red. They march up into the forest together.', simple: 'So many baby crabs that the rocks turn red!', more: 'https://www.youtube.com/results?search_query=baby+red+crabs+christmas+island' },
  gills: { title: 'Wet gills', body: 'Crabs breathe with gills, like fish. A land crab keeps its gills damp. Hot sun dries them out, so red crabs hide in the shade, in burrows and under leaves, and come out when it is damp.', simple: 'Crabs breathe with wet gills. The sun dries them, so they hide in the shade.', more: 'https://en.wikipedia.org/wiki/Gill' },
  bird: { title: 'Birds of the island', body: 'Christmas Island is home to amazing birds, like frigatebirds with red throat balloons and Abbott\'s booby, which nests only here. Little crabs keep under cover when birds fly over.', simple: 'Big seabirds fly over the island.', more: 'https://en.wikipedia.org/wiki/Christmas_frigatebird' },
  cliff: { title: 'Cliff climbers', body: 'Christmas Island is the top of an old volcano with limestone cliffs. Red crabs climb straight up and down them with the sharp tips of their legs.', simple: 'Crabs can climb cliffs!', more: 'https://en.wikipedia.org/wiki/Christmas_Island' },
  sideways: { title: 'Walking sideways', body: 'A crab\'s legs bend best from side to side, so it scuttles sideways. It can walk forwards, but sideways is faster.', simple: 'Crab legs bend sideways, so crabs walk sideways!', more: 'https://en.wikipedia.org/wiki/Crab' },
  tenlegs: { title: 'Ten legs', body: 'Crabs are decapods, which means "ten legs": eight walking legs and two claws.', simple: 'Eight legs and two claws. That makes ten!', more: 'https://en.wikipedia.org/wiki/Decapoda' },
  forest: { title: 'Gardeners of the forest', body: 'Tens of millions of red crabs live in the rainforest. They eat fallen leaves, flowers, fruit and seedlings, and clear the forest floor. That changes which plants grow, so the crabs shape the whole forest.', simple: 'The crabs clean up the forest floor and help it grow.', more: 'https://en.wikipedia.org/wiki/Keystone_species' },
  burrow: { title: 'A burrow of its own', body: 'Each red crab lives alone in its own burrow in the forest floor. It keeps the crab cool and damp, and safe while it moults.', simple: 'Each crab has its own burrow.', more: 'https://en.wikipedia.org/wiki/Burrow' },
  crabmoult: { title: 'A crab moult', body: 'A crab\'s shell can\'t grow, so it moults. It hides in its burrow, splits out of the old shell, and pumps itself up with water while the new soft shell hardens. Then it often eats the old shell, which is full of calcium.', simple: 'The crab climbs out of its old shell, then eats it!', more: 'https://www.youtube.com/results?search_query=crab+moulting' },
  dryseason: { title: 'The dry season', body: 'From about May to October it hardly rains on Christmas Island. Red crabs block their burrow doors with leaves to keep the damp in, and wait.', simple: 'In the dry season, crabs shut the door with leaves and wait.', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  years: { title: 'Growing up slowly', body: 'Young red crabs moult several times a year; grown-ups about once a year. It takes four or five years to grow up, and a red crab may live 12 years or more.', simple: 'It takes 4 or 5 years to grow up!', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  robber: { title: 'The robber crab', body: 'The robber crab, or coconut crab, is the biggest crab that lives on land. It can weigh 4 kilograms, climb trees and crack coconuts with its claws. Christmas Island has the most robber crabs in the world.', simple: 'The biggest land crab in the world! It can climb trees.', more: 'https://en.wikipedia.org/wiki/Coconut_crab' },
  rain: { title: 'The first rains', body: 'When the first big rains of the wet season come, around October to December, the forest floor gets damp. That is the signal: it is time to march to the sea.', simple: 'The first big rain says: go to the sea!', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  migration: { title: 'The great migration', body: 'Every year, millions of red crabs leave the forest and march to the sea to breed. It is one of the most amazing animal migrations on Earth, and it takes them about a week.', simple: 'Millions of crabs march to the sea!', more: 'https://www.youtube.com/results?search_query=red+crab+migration+christmas+island' },
  bridge: { title: 'Crab bridges', body: 'People on Christmas Island help the crabs. Rangers close roads, build low fences that steer crabs to tunnels under the road, and even built a crab bridge over one road.', simple: 'People built a bridge just for crabs!', more: 'https://www.youtube.com/results?search_query=christmas+island+crab+bridge' },
  ants: { title: 'Yellow crazy ants', body: 'Yellow crazy ants came to Christmas Island by accident. They are a big danger to red crabs, so rangers work hard to keep them away from the crabs.', simple: 'Rangers keep the crazy ants away from the crabs.', more: 'https://en.wikipedia.org/wiki/Yellow_crazy_ant' },
  dip: { title: 'A dip in the sea', body: 'After the long march, the crabs dip into the sea to soak up water and salt. Males go first, then dig burrows on the terrace by the shore.', simple: 'After the march, crabs dip into the sea!', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  males: { title: 'Burrows by the sea', body: 'Males dig burrows on the shore terrace and push other males away to keep them. Boy red crabs are bigger and have bigger claws.', simple: 'Boy crabs dig burrows and push to keep them.', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  female: { title: 'The female', body: 'A female has a wide, round tummy flap to hold her eggs. After mating she stays in the burrow for about 12 days while the eggs grow.', simple: 'She keeps her eggs under her wide tummy flap.', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  moon: { title: 'The moon tells the time', body: 'The eggs go into the sea at the last quarter of the moon, just before dawn, as the high tide turns. Then the sea between high and low tide changes the least.', simple: 'The moon tells the crabs when to let the eggs go.', more: 'https://en.wikipedia.org/wiki/Lunar_phase' },
  colour: { title: 'Red, orange or purple', body: 'Most red crabs are bright red, some are orange, and a very few are purple. Nobody is sure why.', simple: 'Most are red. Some are orange or even purple!', more: 'https://en.wikipedia.org/wiki/Christmas_Island_red_crab' },
  eyes: { title: 'Eyes on stalks', body: 'A crab\'s eyes sit on stalks, so it can see all around, and fold them down into grooves to keep them safe.', simple: 'Crab eyes are on stalks!', more: 'https://en.wikipedia.org/wiki/Compound_eye' },
  island: { title: 'Christmas Island', body: 'Christmas Island is a small island in the Indian Ocean. Most of it is a national park: rainforest on top, cliffs around the edge, and a coral reef in the deep blue sea.', simple: 'A small island in the Indian Ocean, covered in rainforest.', more: 'https://en.wikipedia.org/wiki/Christmas_Island_National_Park' },
  lifecycle: { title: 'The whole life cycle', body: 'Egg, zoea, megalopa, baby crab, young crab, adult, then eggs again. Half of a red crab\'s life story happens in the sea and half on land.', simple: 'Egg, zoea, megalopa, crab… then eggs again!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are one of thousands of eggs under your mum. She is at the edge of the sea…', 'I am an egg on Mum. Wait…'],
  hatch: ['A wave is coming! Wiggle with the arrows to go into the sea.', 'Wiggle into the sea!'],
  swim: ['You are a zoea! Swim with the arrows and eat the green plankton.', 'Swim! Eat the green dots.'],
  copepod: ['A copepod! It jumps away. Chase it!', 'Chase the little shrimp!'],
  tight: ['Your skin is tight! Time to moult.', 'My skin is tight!'],
  bigger: ['Bigger! Keep eating plankton.', 'Eat more! Get big!'],
  night: ['Night: the plankton swim up to the top. Swim up to eat.', 'Night! Food is at the top.'],
  day: ['Day: the plankton sink down deep. Dive down to find them.', 'Day! Food is down deep.'],
  flick: ['Press E to flick your tail and dash!', 'Press E to dash!'],
  fish: ['Fish! Swim away, or dive deep!', 'Fish! Swim away!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  whale: ['A whale shark! It is gulping plankton. Swim away from its mouth!', 'A big shark! Swim away!'],
  megalopa: ['You are a megalopa, with claws! Follow the arrow back to the island.', 'Swim back to the island!'],
  jelly: ['A jellyfish! Press Space next to it to ride it home.', 'Ride the jellyfish!'],
  riding: ['Riding the jellyfish! Press Space to hop off.', 'I ride the jelly!'],
  surf: ['The waves are pushing you in. Swim to the rocks!', 'Swim to the rocks!'],
  ashore: ['Climb up out of the water onto the rocks!', 'Climb out!'],
  march: ['You are a tiny crab! March up to the forest with all the others.', 'Go up to the forest!'],
  climb: ['Climb up the cliff! Rest in the cracks.', 'Climb up the cliff!'],
  dry: ['Your gills are drying out! Get into the shade.', 'Too dry! Go to the shade!'],
  shade: ['Lovely and damp in the shade.', 'Damp and cool. Ahh.'],
  rested: ['Too dry! You hid in the shade until evening.', 'I hid until night.'],
  bird: ['A bird! Hide under a rock!', 'A bird! Hide!'],
  forest: ['The rainforest! Eat leaves, flowers and fruit to grow.', 'Eat and grow!'],
  eat: ['Food! Go to it and press Space to eat.', 'Press Space to eat!'],
  sniff: ['Follow the arrow to more food.', 'Follow the arrow!'],
  full: ['You are full! Dig a burrow: push down on soft soil.', 'Dig a burrow! Push down.'],
  dig: ['Dig down into the soft soil.', 'Dig down!'],
  rock: ['Too hard to dig here! Find soft soil.', 'Too hard! Dig in the soil.'],
  toodeep: ['Too deep! A land crab can\'t swim. Stay where the waves are small.', 'Too deep! Go back.'],
  deeper: ['Dig a little deeper.', 'Dig down more!'],
  moult: ['Deep enough! Press Space to close the door with leaves and moult.', 'Press Space to moult!'],
  soft: ['A new soft shell! Wait while it gets hard.', 'I am soft. Wait…'],
  dryseason: ['The dry season. Wait in your burrow until the rain comes back.', 'It is dry. Wait…'],
  wetseason: ['The wet season! Dig up and out. You are bigger!', 'The rain is back! Go up!'],
  out: ['Push up to dig out of the burrow.', 'Push up to go out!'],
  robber: ['A robber crab! It is the biggest land crab. Hide in your burrow!', 'A big robber crab! Hide!'],
  safe: ['The robber crab wandered off.', 'It went away.'],
  adult: ['You are grown up! Eat and wait for the first big rain.', 'I am big! Wait for the rain.'],
  rain: ['The first big rain! It is time to march to the sea!', 'Rain! Go to the sea!'],
  sea: ['Follow the arrow to the sea!', 'Go to the sea!'],
  bridge: ['A road! Walk up the crab bridge to cross it.', 'Go over the crab bridge!'],
  fence: ['A crab fence. Follow it to the bridge.', 'Go to the bridge!'],
  dip: ['The sea! Walk into the water and press Space for a dip.', 'Press Space to dip in the sea!'],
  burrowsite: ['Dig a burrow here on the terrace: push down on the soft ground.', 'Dig a burrow here!'],
  rival: ['A rival wants your burrow! Go to him and press Space to push.', 'A crab! Push him!'],
  shove: ['Tap Space to push! When the ring turns green, press E for a big shove!', 'Tap Space! Green ring: E!'],
  won: ['You won! He scuttled off. The burrow is yours.', 'I won! He went away.'],
  lost: ['He pushed you away! Try again.', 'Oops! Try again.'],
  king: ['King of the terrace! Listen… someone is coming.', 'I am the king!'],
  female: ['A female crab! Go to her and press Space.', 'Go and say hi!'],
  findmale: ['The boys have dug burrows. Go to one and press Space.', 'Find a boy crab!'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  brood: ['Your eggs are growing under your tummy flap. Wait in the burrow.', 'My eggs are growing!'],
  moonready: ['The last quarter moon! Go to the edge of the sea before dawn.', 'Go to the sea!'],
  release: ['When a wave washes over you, press Space to shake your eggs into the sea!', 'Wave! Press Space!'],
  eggs: ['The eggs are in the sea. They hatch the moment they touch the water!', 'The eggs hatch in the sea!'],
  home: ['Your job is done. March home to the forest!', 'Go home to the forest!'],
  friend: ['Another little crab! Your brothers and sisters are marching too.', 'Lots of crab friends!'],
  ants: ['Yellow crazy ants! Keep away from them.', 'Ants! Go away from them.']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* the tide: high a little before dawn and again in the afternoon (−1 low … 1 high) */
function tideAt(tod) { return Math.cos((tod - .21) * TAU * 2); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
