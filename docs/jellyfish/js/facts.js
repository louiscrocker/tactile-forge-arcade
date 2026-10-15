/* ============================================================
   facts.js — the moon jellies, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the moon jellyfish
   (Aurelia aurita) in a sheltered harbour bay, simplified for
   play.  Each fact has a full version, a "little words" version
   and a link to see the real thing (a Wikipedia page or a YouTube
   search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Four colours of moon jelly.  The bell is always clear; what changes is the colour
   of the four rings (the gonads) seen through it: pink, purple, blue or milky white
   are all common.  bell / bell2 = the bell's tint light and edge, ring / ring2 = the
   rings light and dark, arm = the frilly oral arms, fringe = the edge tentacles */
const FORMS = {
  pink:   { name: 'Pink-ringed moon jelly', short: 'Pink', latin: 'Aurelia aurita',
    bell: '#e4eef8', bell2: '#a9c4e4', ring: '#f58fbe', ring2: '#c8467e', arm: '#f6d2e2', fringe: '#f2e6f0', glow: '#ffc8e4',
    blurb: 'Lots of moon jellies have four pink rings showing through their clear bell, like a four-leaf clover.',
    simple: 'Four pink rings, like a clover!', power: 'A common colour' },
  violet: { name: 'Purple-ringed moon jelly', short: 'Purple', latin: 'Aurelia aurita',
    bell: '#e6e8f8', bell2: '#b0b4e8', ring: '#b07ef0', ring2: '#6a3ab8', arm: '#e2d4f8', fringe: '#ece6fa', glow: '#d8c4ff',
    blurb: 'Some moon jellies have purple rings. From above they look like a glowing four-leaf clover.',
    simple: 'Purple rings, like a flower!', power: 'A common colour' },
  blue:   { name: 'Blue-ringed moon jelly', short: 'Blue', latin: 'Aurelia aurita',
    bell: '#e2f0fa', bell2: '#9cc8ec', ring: '#6ab4f4', ring2: '#2a6ab8', arm: '#d2e6f8', fringe: '#e6f2fa', glow: '#bfe6ff',
    blurb: 'A moon jelly with pale blue rings is almost invisible in the sea, which helps it hide.',
    simple: 'Blue rings. Almost see-through!', power: 'Hard to see' },
  white:  { name: 'Milky-ringed moon jelly', short: 'Milky', latin: 'Aurelia aurita',
    bell: '#eef2f4', bell2: '#c4ccd8', ring: '#f6f4ee', ring2: '#b8b4c4', arm: '#f2f0ec', fringe: '#f4f4f2', glow: '#fffbe8',
    blurb: 'Some moon jellies have milky white rings, so the whole jelly shines like the full moon.',
    simple: 'White rings, like the moon!', power: 'Shines like the moon' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy jelly', short: 'Boy', blurb: 'Moon jellies are boys or girls. In the summer bloom a boy lets a little cloud drift to the girls.', simple: 'Find the girls in the bloom!' },
  girl: { name: 'Girl jelly', short: 'Girl', blurb: 'A girl moon jelly keeps her babies in little pouches on her arms, then lets them swim free.', simple: 'Keeps the babies on her arms!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'planula', name: 'Planula', short: 'Planula' },
  { key: 'polyp', name: 'Polyp', short: 'Polyp' },
  { key: 'strobila', name: 'Stack of discs', short: 'Stack' },
  { key: 'ephyra', name: 'Ephyra', short: 'Ephyra' },
  { key: 'medusa', name: 'Young jelly', short: 'Young' },
  { key: 'adult', name: 'Moon jelly', short: 'Adult' },
  { key: 'bloom', name: 'The bloom', short: 'Bloom' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much each step takes, per difficulty
   polyp:  food the polyp catches to grow 8 tentacles, 16 tentacles, then to be full and strong
   buds:   clone polyps to bud before winter · discs: discs in the winter stack · pops: good pulses to pop free
   ephyra: plankton for the ephyra's arms to fill in, again, then to be a young jelly
   medusa: food (licked off the bell) to be a grown moon jelly, then to be big enough for the bloom
   risk:   how often visitors come · fish: the fish, the turtle and the sunfish visit (easy: fewer) · slug: the sea slug visits the polyp
   fans:   good pulses to let the planulae go · taken: how many hiding places are already taken */
const DIFFICULTY = {
  easy:   { name: 'Little kid', polyp: [6, 14, 22], buds: 1, discs: 5, pops: 3, ephyra: [12, 28, 48], medusa: [36, 72], risk: .5, fish: false, slug: false, fans: 3, taken: .45 },
  normal: { name: 'Big kid',    polyp: [8, 18, 30], buds: 2, discs: 6, pops: 4, ephyra: [18, 40, 66], medusa: [50, 100], risk: 1, fish: true, slug: true, fans: 4, taken: .55 },
  hard:   { name: 'Scientist',  polyp: [10, 24, 38], buds: 3, discs: 7, pops: 5, ephyra: [24, 54, 88], medusa: [64, 128], risk: 1.3, fish: true, slug: true, fans: 5, taken: .65 }
};

/* how big the jelly really is, in centimetres across (the bell, or the polyp's height) */
function jellyCM(p) {
  if (p.stage === 'egg') return .02;
  if (p.stage === 'planula') return .025;
  if (p.stage === 'polyp') return lerp(.1, .4, (p.pinst - 1) / 2 + clamp(p.pfood / Math.max(1, p.D.polyp[2]), 0, 1) * .1);
  if (p.stage === 'ephyra') { const th = [0, ...p.D.ephyra], i = p.einst, t = clamp((p.efood - th[i - 1]) / Math.max(1, th[i] - th[i - 1]), 0, 1); return [0, .3, .6, 1.2][i] + t * [0, .3, .6, 1.3][i]; }
  const th = p.D.medusa, t = p.minst === 1 ? clamp(p.mfood / th[0], 0, 1) : clamp((p.mfood - th[0]) / (th[1] - th[0]), 0, 1);
  return p.minst === 1 ? lerp(2.5, 12, t) : lerp(14, 30, t);
}
/* the drawn bell radius in world units (small jellies are drawn bigger than life, so a child can see them) */
function bellUnits(cm) { return 4 + Math.sqrt(cm) * 4.2; }

const FACTS = {
  brood: { title: 'Babies on her arms', body: 'A mother moon jelly keeps her babies in little pouches on her four frilly arms. They grow there as tiny larvae called planulae until they are ready to swim away.', simple: 'Mum keeps her babies on her arms!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  planula: { title: 'A planula', body: 'A baby moon jelly starts as a planula: a tiny oval larva, smaller than a grain of sand, covered in hairs that beat like oars to swim.', simple: 'A tiny baby jelly, smaller than a grain of sand!', more: 'https://en.wikipedia.org/wiki/Planula' },
  cilia: { title: 'Hairs that row', body: 'A planula is covered in tiny hairs called cilia. They beat together, like hundreds of oars, and push it through the water.', simple: 'Tiny hairs row it along!', more: 'https://en.wikipedia.org/wiki/Cilium' },
  noeat: { title: 'No lunch yet', body: 'A planula does not eat at all. It lives on the food its mother gave it while it looks for a place to settle, for a day or a few days.', simple: 'A planula does not eat. It looks for a home.', more: 'https://en.wikipedia.org/wiki/Planula' },
  settle: { title: 'Upside down', body: 'A planula looks for a hard, shady place, like the underside of a rock ledge, a shell or a dock. It sticks there by its front end and hangs upside down.', simple: 'It sticks under a rock and hangs upside down!', more: 'https://www.youtube.com/results?search_query=aurelia+planula+settlement+polyp' },
  polyp: { title: 'A polyp', body: 'Once it settles, the planula turns into a polyp: a tiny cup a few millimetres tall, with a mouth in the middle and tentacles all around it. It looks like a little sea anemone.', simple: 'A tiny cup with tentacles. Like a little flower!', more: 'https://en.wikipedia.org/wiki/Polyp_(zoology)' },
  tentacles: { title: 'Four, eight, sixteen', body: 'A new moon jelly polyp has four tentacles. As it eats and grows it makes eight, and then sixteen.', simple: 'Four tentacles, then eight, then sixteen!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  catch: { title: 'Catching a snack', body: 'A polyp holds its tentacles out into the water. When a tiny drifting animal touches them it sticks, and the tentacles fold it into the mouth.', simple: 'Food sticks to the tentacles. Into the mouth!', more: 'https://en.wikipedia.org/wiki/Polyp_(zoology)' },
  bud: { title: 'Budding', body: 'A well-fed polyp can grow a little bump on its side that becomes a whole new polyp. This is called budding, and the new polyp is a clone: an exact copy.', simple: 'A polyp can grow a copy of itself!', more: 'https://en.wikipedia.org/wiki/Budding' },
  clones: { title: 'A family of clones', body: 'By budding again and again, one polyp can turn into a whole carpet of polyps under a rock or a dock, all of them clones.', simple: 'One polyp can make a whole carpet of copies!', more: 'https://en.wikipedia.org/wiki/Clone_(biology)' },
  years: { title: 'Polyps can live for years', body: 'A moon jelly polyp can live for years under its rock, eating, budding and waiting. The swimming jellyfish only lives about a year.', simple: 'A polyp can live for years!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  cold: { title: 'Cold water is a signal', body: 'When the sea gets cold in winter, it tells the polyp that it is time to make baby jellyfish.', simple: 'Cold water tells the polyp: make baby jellies!', more: 'https://en.wikipedia.org/wiki/Strobilation' },
  strobila: { title: 'A stack of plates', body: 'The polyp grows long and splits into a stack of discs, like a pile of little plates. Scientists call this a strobila.', simple: 'The polyp turns into a stack of plates!', more: 'https://en.wikipedia.org/wiki/Strobilation' },
  ephyrae: { title: 'Lots of babies from one polyp', body: 'Each disc in the stack pops off and swims away as a baby jellyfish. One polyp can make up to about twenty.', simple: 'Every plate becomes a baby jelly!', more: 'https://www.youtube.com/results?search_query=moon+jelly+strobilation+ephyrae' },
  regrow: { title: 'The polyp stays', body: 'After the discs have popped off, the polyp is still there. It grows its tentacles back and can make more baby jellies next winter.', simple: 'The polyp grows back and does it again!', more: 'https://en.wikipedia.org/wiki/Strobilation' },
  ephyra: { title: 'An ephyra', body: 'A baby jellyfish is called an ephyra. It looks like a tiny clear star with eight arms, only a few millimetres across.', simple: 'A baby jelly looks like a tiny star!', more: 'https://en.wikipedia.org/wiki/Ephyra' },
  pulse: { title: 'Pulse, pulse, pulse', body: 'A jellyfish swims by squeezing its bell and letting it spring open again. Every pulse pushes it along. Moon jellies are some of the most energy-saving swimmers in the sea.', simple: 'Squeeze and open. That is how a jelly swims!', more: 'https://www.youtube.com/results?search_query=moon+jellyfish+swimming' },
  nobrain: { title: 'No brain!', body: 'A jellyfish has no brain. It has a net of nerves all through its body, and little sense organs around the edge of the bell.', simple: 'A jellyfish has no brain!', more: 'https://en.wikipedia.org/wiki/Nerve_net' },
  rhopalia: { title: 'Which way is up?', body: 'Around the edge of the bell are eight tiny sense organs. They feel which way is up, and they can tell light from dark.', simple: 'Little bumps on the edge feel which way is up!', more: 'https://en.wikipedia.org/wiki/Rhopalium' },
  water: { title: 'Made of water', body: 'A moon jelly is about 95 percent water. Take it out of the sea and it would be almost nothing at all.', simple: 'A jelly is nearly all water!', more: 'https://en.wikipedia.org/wiki/Jellyfish' },
  nobones: { title: 'No bones, no heart', body: 'A jellyfish has no bones, no heart and no blood. The sea water holds it up, and its thin body takes oxygen straight from the water.', simple: 'No bones, no heart, no blood!', more: 'https://en.wikipedia.org/wiki/Jellyfish' },
  mucus: { title: 'A sticky bell', body: 'A moon jelly catches its food with sticky slime on its bell. Tiny plankton stick to it as it swims, and tiny hairs move the food to the edge, where the arms lick it off.', simple: 'Food sticks to its bell. Then it licks it off!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  arms: { title: 'Four frilly arms', body: 'Under the bell hang four long, frilly arms around the mouth. They collect food and carry it in.', simple: 'Four frilly arms carry food to the mouth.', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  onehole: { title: 'One opening', body: 'A jellyfish has only one opening. It eats through it, and the leftovers come back out the same way!', simple: 'It eats and poops through the same hole!', more: 'https://en.wikipedia.org/wiki/Jellyfish' },
  rings: { title: 'Four rings', body: 'The four rings you can see through a moon jelly\'s bell are where its eggs or sperm grow. They can be pink, purple, blue or white.', simple: 'The four rings are where the eggs grow.', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  fringe: { title: 'A fringe of tentacles', body: 'All around the edge of the bell are hundreds of short, fine tentacles, like a fringe on a lampshade.', simple: 'Lots of little tentacles all round the edge!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  size: { title: 'As big as a dinner plate', body: 'A grown moon jelly can be as wide as a dinner plate, up to about 40 centimetres across. It grows from a few millimetres in just a few months.', simple: 'It grows as big as a dinner plate!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  shrink: { title: 'Getting smaller', body: 'When there is not enough food, a moon jelly can get smaller, and then grow big again when food comes back.', simple: 'A hungry jelly can shrink, then grow again!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  everywhere: { title: 'All over the world', body: 'Moon jellies live in coastal seas all over the world, in bays, harbours and along the shore.', simple: 'Moon jellies live all over the world!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  notfish: { title: 'Not a fish!', body: 'A jellyfish is not a fish at all. Its family are the corals and the sea anemones.', simple: 'A jellyfish is not a fish! Its family are the corals.', more: 'https://en.wikipedia.org/wiki/Cnidaria' },
  old: { title: 'Older than dinosaurs', body: 'Jellyfish have been drifting in the sea for more than 500 million years, long before the dinosaurs.', simple: 'Jellies are older than the dinosaurs!', more: 'https://en.wikipedia.org/wiki/Jellyfish' },
  medusaname: { title: 'Why "medusa"?', body: 'Scientists call the swimming jellyfish shape a medusa, after a monster in old Greek stories who had snakes for hair, because the tentacles hang down like hair.', simple: 'A swimming jelly is called a medusa!', more: 'https://en.wikipedia.org/wiki/Medusa_(biology)' },
  twoshapes: { title: 'Two shapes', body: 'A moon jelly has two body shapes in its life: a polyp that sits still under a rock, and a medusa that swims. Its babies start all over again as polyps.', simple: 'First a polyp that sits, then a jelly that swims!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' },
  drift: { title: 'Drifters', body: 'Jellyfish can swim, but they mostly drift wherever the currents take them. That makes them plankton: the word means "drifter".', simple: 'Jellies drift with the sea. They are plankton!', more: 'https://en.wikipedia.org/wiki/Plankton' },
  plankton: { title: 'Plankton', body: 'Plankton are the tiny living things that drift in the sea: tiny plants, tiny animals and the eggs and babies of bigger ones. They are food for almost everything in the sea.', simple: 'Tiny drifting plants and animals. Food for the whole sea!', more: 'https://en.wikipedia.org/wiki/Plankton' },
  diatom: { title: 'Glass houses', body: 'Diatoms are tiny plants that live in little cases made of glass. They make much of the oxygen we breathe.', simple: 'Diatoms are tiny plants in glass cases!', more: 'https://en.wikipedia.org/wiki/Diatom' },
  copepod: { title: 'Copepods', body: 'Copepods are tiny shrimp-like animals with one red eye. They are some of the most common animals on Earth, and moon jellies love to eat them.', simple: 'Tiny jumpy shrimps. Yum!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  updown: { title: 'Up at night, down by day', body: 'Every night, plankton all over the world rise towards the surface to feed, and every morning they sink back down where it is darker. It is the biggest daily journey of animals on Earth.', simple: 'Plankton swim up at night and down in the day!', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  glow: { title: 'A sparkling sea', body: 'Moon jellies do not glow, but some plankton flash blue light when something bumps them. On a dark night a pulsing jelly can leave a trail of sparkles.', simple: 'Some plankton flash blue when you bump them!', more: 'https://en.wikipedia.org/wiki/Bioluminescence' },
  combjelly: { title: 'Comb jellies', body: 'A comb jelly is not a true jellyfish. It has eight rows of tiny beating hairs that shimmer like a rainbow. It has no sting, but it eats tiny drifting animals, even baby jellies, so keep away.', simple: 'A see-through blob with rainbow lights. Keep away!', more: 'https://en.wikipedia.org/wiki/Ctenophora' },
  slug: { title: 'A sea slug', body: 'Some sea slugs, called nudibranchs, crawl about under rocks looking for polyps to nibble. A polyp pulls its tentacles in tight when one comes by.', simple: 'A sea slug crawls by. Pull in tight!', more: 'https://en.wikipedia.org/wiki/Nudibranch' },
  turtle: { title: 'The leatherback turtle', body: 'The leatherback is the biggest turtle in the world, and it eats mostly jellyfish. It swims thousands of kilometres to find them. In this game it always misses.', simple: 'The biggest turtle loves jellies. It misses!', more: 'https://en.wikipedia.org/wiki/Leatherback_sea_turtle' },
  sunfish: { title: 'The ocean sunfish', body: 'The ocean sunfish, or mola, is one of the heaviest fish in the world, shaped like a huge swimming head. Jellies are one of its favourite foods.', simple: 'A giant round fish that likes jellies!', more: 'https://en.wikipedia.org/wiki/Ocean_sunfish' },
  gull: { title: 'Seabirds', body: 'Gulls and other seabirds peck at jellies floating near the surface. A jelly is safer a little deeper down.', simple: 'Birds peck at the top of the sea. Go deeper!', more: 'https://en.wikipedia.org/wiki/Gull' },
  tern: { title: 'Terns', body: 'Terns are slim seabirds that hover and dip to snatch tiny things from the top of the sea.', simple: 'A seabird dips at the top of the sea.', more: 'https://en.wikipedia.org/wiki/Common_tern' },
  herring: { title: 'Herring', body: 'Atlantic herring swim in huge silver schools and eat plankton. A tiny ephyra can get bumped about when a school sweeps past.', simple: 'Silver fish swim by in a big school!', more: 'https://en.wikipedia.org/wiki/Atlantic_herring' },
  bloom: { title: 'A bloom', body: 'When there is lots of food, thousands of moon jellies can gather in one place, often where two currents meet. This is called a bloom.', simple: 'Thousands of jellies together: a bloom!', more: 'https://www.youtube.com/results?search_query=moon+jellyfish+bloom' },
  smack: { title: 'A smack of jellyfish', body: 'A group of jellyfish has funny names: a bloom, a swarm, or a smack!', simple: 'A group of jellies is called a smack!', more: 'https://en.wikipedia.org/wiki/Jellyfish_bloom' },
  currents: { title: 'Riding the currents', body: 'Currents are rivers in the sea. Wind and tides push the water along, and the jellies ride along with it.', simple: 'Currents are rivers in the sea. Ride along!', more: 'https://en.wikipedia.org/wiki/Ocean_current' },
  spawn: { title: 'Boys and girls', body: 'Moon jellies are boys or girls. In summer the boys let sperm drift into the water, and the girls catch it, so their eggs can start to grow into planulae.', simple: 'Boy jellies and girl jellies make the babies together.', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  pouches: { title: 'Brood pouches', body: 'A girl moon jelly carries her growing babies in pouches along her four arms, keeping them safe until they can swim.', simple: 'Babies ride in pouches on Mum\'s arms.', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  touch: { title: 'Look, don\'t touch', body: 'Moon jellies have tiny stingers on their tentacles, but they are so weak that most people cannot feel them. Still, the best thing to do with any jelly on the beach is to look and not touch.', simple: 'Look at jellies, but do not touch!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  dock: { title: 'Under the dock', body: 'Moon jelly polyps love the shady undersides of docks, piers, boats and rocks in quiet harbours.', simple: 'Polyps love to live under docks!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  moon: { title: 'Why "moon" jelly?', body: 'Seen from above, a moon jelly is round, pale and glowing, like the full moon, with four rings in the middle.', simple: 'Round and pale, like the moon!', more: 'https://en.wikipedia.org/wiki/Aurelia_aurita' },
  lifecycle: { title: 'The whole life cycle', body: 'Planula, polyp, a stack of discs, ephyra, young jelly, grown moon jelly, the bloom, and then new planulae again. The moon jelly lives two lives: one sitting still and one swimming.', simple: 'Planula, polyp, ephyra, jelly… then planulae again!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are a tiny baby in a pouch on your mum\'s arm. Mum is a moon jelly…', 'I am on Mum\'s arm. Wait…'],
  hatch: ['Mum is letting her babies go! Wiggle with the arrows to swim free.', 'Wiggle! Swim free!'],
  swimfree: ['You are a planula! Swim with the arrows. Find a shady place under a rock ledge.', 'Swim! Find a rock!'],
  reef: ['Follow the arrow down to the rocky ledges.', 'Go down to the rocks!'],
  search: ['Look under the ledges for a free spot. Swim up under it and press Space.', 'Find a free spot under a rock!'],
  taken: ['Taken! Something lives here already. Try another spot.', 'Taken! Try another one.'],
  settle: ['A free spot! Press Space to stick on and hang upside down.', 'Press Space to stick on!'],
  polyp: ['You are a polyp! Lean with the arrows and catch the food drifting by in your tentacles.', 'Catch the food!'],
  caught: ['You caught something! Press Space to fold it into your mouth.', 'Press Space to eat!'],
  stretch: ['Push down to stretch out. Push up to pull in tight.', 'Down: stretch. Up: pull in.'],
  tentacles: ['More tentacles! Now you can catch more food.', 'More tentacles!'],
  bud: ['You are big and strong! Press Space to bud a copy of yourself.', 'Press Space to make a copy!'],
  budded: ['A new polyp! It is a clone of you.', 'A copy of me!'],
  morebuds: ['Eat some more, then bud again.', 'Eat more!'],
  slug: ['A sea slug is crawling this way! Push up to pull in tight.', 'A slug! Pull in tight!'],
  slugpast: ['The sea slug crawled on by. Nothing is hurt.', 'It went away!'],
  cold: ['Brr! Winter is here. The cold water is a signal…', 'Brr! Cold!'],
  stack: ['You are turning into a stack of discs! Wait and watch…', 'I am a stack of plates!'],
  pop: ['When the glow swells, press Space to pulse and pop free!', 'Glow! Press Space!'],
  free: ['Pop! You are an ephyra, a baby jellyfish! Hold an arrow to pulse that way.', 'I am a baby jelly! Swim!'],
  eatplankton: ['Swim into the plankton to eat it. Look for the green dots.', 'Eat the green dots!'],
  copepod: ['A copepod! It jumps away. Chase it!', 'Chase the little shrimp!'],
  dash: ['Press E for a big, strong pulse!', 'Press E to zoom!'],
  grew: ['Bigger! Your arms are filling in.', 'Bigger!'],
  bigger: ['Keep eating to grow.', 'Eat more! Get big!'],
  night: ['Night: the plankton rise to the top. Swim up to eat.', 'Night! Food is at the top.'],
  day: ['Day: the plankton sink down. Swim down to find them.', 'Day! Food is down deep.'],
  jelly: ['A comb jelly! Keep away from its shimmering blob.', 'A rainbow blob! Keep away!'],
  fish: ['Fish! Pulse away, or press E for a big pulse!', 'Fish! Swim away!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  tern: ['A bird is dipping at the top! Swim down a little.', 'A bird! Go down!'],
  medusa: ['You are a young moon jelly! Swim through the plankton: it sticks to your bell.', 'Swim through the food!'],
  stuck: ['Food is stuck on your sticky bell! Press Space to lick it off with your arms.', 'Press Space to lick!'],
  licked: ['Yum! Your arms carried the food to your mouth.', 'Yum!'],
  current: ['A current! Ride it. It carries you along.', 'Ride the current!'],
  turtle: ['A sea turtle! Press E for a big pulse, or dive away!', 'A turtle! Press E!'],
  sunfish: ['An ocean sunfish! Press E for a big pulse away!', 'A big fish! Press E!'],
  gull: ['A gull is pecking at the top! Dive down deeper.', 'A bird! Go down!'],
  dodged: ['Whoosh! Your big pulse took you away. It missed!', 'Whoosh! It missed!'],
  adult: ['Look! Four rings in your bell. You are a grown moon jelly!', 'Four rings! I am grown up!'],
  grow: ['Eat more to grow big for the summer bloom.', 'Eat more!'],
  bloom: ['Summer! The moon jellies are gathering. Follow the arrow to the bloom!', 'Go to the bloom!'],
  inbloom: ['You are in the bloom! Thousands of moon jellies, all together.', 'So many jellies!'],
  findgirl: ['Find a girl jelly with a pink heart. Swim to her and press Space.', 'Find a girl jelly!'],
  findcloud: ['The boys are letting little clouds go. Swim to a cloud and press Space.', 'Find a little cloud!'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  shared: ['You let your little cloud go. It drifts to her.', 'My cloud drifts to her!'],
  brood: ['Your babies are growing in the pouches on your arms. Weeks go by…', 'My babies grow…'],
  release: ['Your planulae are ready! Press Space each time the glow swells to let them go.', 'Glow! Press Space!'],
  ready: ['Your babies are ready! Press Space to let them swim free.', 'Press Space! Let them go!'],
  larvae: ['Your planulae are swimming down to find a rock. The cycle begins again!', 'The babies swim down!'],
  done: ['Your job is done. Drift with the bloom.', 'All done. Drift!'],
  friend: ['Other polyps live under the ledges too.', 'Lots of polyps!'],
  sparkle: ['The sea sparkles when you pulse at night!', 'Sparkles!'],
  edge: ['That is the edge of the bay. Turn back.', 'Turn back!']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* the tide: two highs a day (−1 low … 1 high) */
function tideAt(tod) { return Math.cos((tod - .21) * TAU * 2); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
/* the seasons of the bay, for the HUD (label, water temperature °C) */
const SEASON_INFO = { spring: ['🌱 Spring', 9], summer: ['☀️ Summer', 17], autumn: ['🍂 Autumn', 12], winter: ['❄️ Winter', 5] };
