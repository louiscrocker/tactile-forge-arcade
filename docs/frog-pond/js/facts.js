/* ============================================================
   facts.js — species, life stages, difficulty and the biology
   ============================================================
   Every fact has a full `body` and a `simple` version in short
   words for a child who is just learning to read.  Every hint is
   [full, simple].  Nothing here is aspirational: each key is
   used by the game.
   ============================================================ */
'use strict';

const SPECIES = {
  green: {
    key: 'green', name: 'Green Frog', short: 'Green frog', latin: 'Lithobates clamitans',
    body: '#5f9a3a', belly: '#e9f0c8', dark: '#2f5a22', accent: '#8ec95a', eye: '#d9a12e', pattern: 'ridges', mask: false,
    speed: 1, need: 1, size: 1, reach: 1, jump: 1, special: 'balanced', call: 'twang',
    power: 'All-rounder: steady swimmer, steady hopper, steady appetite.',
    blurb: 'The classic pond frog with ridges down its back and a call like a plucked banjo string. Sits at the edge and waits for bugs.',
    simple: 'The classic pond frog. Its call sounds like a banjo twang!',
    wiki: 'https://en.wikipedia.org/wiki/Green_frog'
  },
  bullfrog: {
    key: 'bullfrog', name: 'American Bullfrog', short: 'Bullfrog', latin: 'Lithobates catesbeianus',
    body: '#6b8f3a', belly: '#e6e9c2', dark: '#3a5820', accent: '#a5bf55', eye: '#c98a2a', pattern: 'mottle', mask: false,
    speed: .9, need: 1.3, size: 1.25, reach: 1.35, jump: 1.15, special: 'big', call: 'jug',
    power: 'Huge: needs more food, but has a LONG tongue and a booming "jug-o-rum" call.',
    blurb: 'The biggest frog in North America, as long as your hand. Its tadpoles can take two whole years to grow up. Eats anything that fits in its mouth.',
    simple: 'The biggest frog. Its call goes JUG-O-RUM. Long tongue!',
    wiki: 'https://en.wikipedia.org/wiki/American_bullfrog'
  },
  leopard: {
    key: 'leopard', name: 'Northern Leopard Frog', short: 'Leopard frog', latin: 'Lithobates pipiens',
    body: '#6e9c40', belly: '#f0f2d8', dark: '#2e4a1e', accent: '#c9d98a', eye: '#d9b23a', pattern: 'spots', mask: false,
    speed: 1.25, need: 1, size: .95, reach: 1, jump: 1.3, special: 'fast', call: 'snore',
    power: 'Speedy: swims 25% faster and jumps 30% farther.',
    blurb: 'Green with dark leopard spots ringed in pale lines. A champion jumper that zig-zags away from anything that chases it.',
    simple: 'Spotty like a leopard. It zig-zag jumps super far!',
    wiki: 'https://en.wikipedia.org/wiki/Northern_leopard_frog'
  },
  woodfrog: {
    key: 'woodfrog', name: 'Wood Frog', short: 'Wood frog', latin: 'Lithobates sylvaticus',
    body: '#a3703c', belly: '#f2e6cc', dark: '#4a2e14', accent: '#d9a86a', eye: '#c98a2a', pattern: 'plain', mask: true,
    speed: 1, need: .9, size: .9, reach: 1, jump: 1.1, special: 'freeze', call: 'quack',
    power: 'Frogsicle: in winter it hops to the leaf litter and freezes SOLID, then thaws in spring.',
    blurb: 'Brown with a dark robber mask across its eyes. The only frog found north of the Arctic Circle: it can freeze solid all winter, heart stopped, and hop away in spring.',
    simple: 'Brown with a robber mask. It can freeze solid in winter and wake up in spring!',
    wiki: 'https://en.wikipedia.org/wiki/Wood_frog'
  },
  peeper: {
    key: 'peeper', name: 'Spring Peeper', short: 'Peeper', latin: 'Pseudacris crucifer',
    body: '#b58a4c', belly: '#f4e9d0', dark: '#5a3c1a', accent: '#e0b874', eye: '#d9a12e', pattern: 'cross', mask: false,
    speed: 1.1, need: .7, size: .7, reach: .85, jump: 1, special: 'small', call: 'peep',
    power: 'Tiny: needs 30% less food. Its high PEEP carries a mile on spring nights.',
    blurb: 'Smaller than your thumb, with a dark X on its back. Hundreds peep together on spring nights like sleigh bells. Has sticky toe pads for climbing.',
    simple: 'Tiny, with an X on its back. It PEEPS loudly at night.',
    wiki: 'https://en.wikipedia.org/wiki/Spring_peeper'
  },
  treefrog: {
    key: 'treefrog', name: 'Gray Treefrog', short: 'Treefrog', latin: 'Dryophytes versicolor',
    body: '#8a9a7a', belly: '#f0f0e0', dark: '#4a5a3e', accent: '#c4cfa8', eye: '#d9a12e', pattern: 'lichen', mask: false,
    speed: 1, need: .85, size: .85, reach: 1, jump: 1.05, special: 'cling', call: 'trill',
    power: 'Sticky toes: can cling to reeds above the water, where the heron cannot reach.',
    blurb: 'Bumpy grey-green skin like lichen, and it can change colour to match. Big sticky toe pads let it climb glass. Bright yellow under the legs.',
    simple: 'Bumpy and grey like tree bark. Sticky toes for climbing!',
    wiki: 'https://en.wikipedia.org/wiki/Gray_treefrog'
  },
  toad: {
    key: 'toad', name: 'American Toad', short: 'Toad', latin: 'Anaxyrus americanus',
    body: '#8a7048', belly: '#e8dcc0', dark: '#4a3820', accent: '#c9a870', eye: '#d9a12e', pattern: 'warts', mask: false, tadpole: '#1a1a14', eggs: 'string',
    speed: .85, need: 1, size: 1.05, reach: 1, jump: .8, special: 'toad', call: 'toad',
    power: 'Bumpy and bitter: the raccoon spits you out. Short hops, but nothing much wants to eat you.',
    blurb: 'Dry, warty skin and a long musical trill. Lays eggs in long strings, not a clump. Toad tadpoles are jet black and swim in crowds. Glands behind the eyes taste awful to anything that bites.',
    simple: 'Bumpy and brown. Its eggs are long strings. It tastes yucky to raccoons!',
    wiki: 'https://en.wikipedia.org/wiki/American_toad'
  }
};

/* Life stages.  `need` is what it takes to leave the stage:
   algae bites for tadpoles, bugs for froglets and frogs. */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg', need: 0, scale: 1, speed: 0, food: 'none' },
  { key: 'tadpole', name: 'Tadpole', short: 'Tadpole', need: 9, scale: .8, speed: 150, food: 'algae' },
  { key: 'legs', name: 'Tadpole · legs sprouting', short: 'Legs', need: 14, scale: 1, speed: 165, food: 'algae' },
  { key: 'tail', name: 'Tadpole · tail shrinking', short: 'Tail', need: 0, scale: 1.1, speed: 120, food: 'none' },
  { key: 'froglet', name: 'Froglet', short: 'Froglet', need: 8, scale: .72, speed: 140, food: 'bugs' },
  { key: 'frog', name: 'Frog', short: 'Frog', need: 14, scale: 1, speed: 170, food: 'bugs' }
];

const DIFFICULTY = {
  easy: { label: 'Little kid', mult: .55, heron: false, nymphs: false, hazards: false, tailTime: 16, nymphRange: 70, bugSpeed: .8, wrigglerFear: .3, herons: 0 },
  normal: { label: 'Big kid', mult: 1, heron: true, nymphs: true, hazards: true, tailTime: 24, nymphRange: 95, bugSpeed: 1, wrigglerFear: .6, herons: 1 },
  hard: { label: 'Scientist', mult: 1.6, heron: true, nymphs: true, hazards: true, tailTime: 30, nymphRange: 120, bugSpeed: 1.25, wrigglerFear: 1, herons: 1 }
};

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const DAYS_PER_SEASON = 4;
const SEASON_INFO = {
  spring: { name: 'Spring', blurb: 'The pond wakes up. Frogs sing, eggs float in the shallows and the lily pads unfurl.', bugs: .9, algae: 1.1, wrigglers: 1, pads: 'grow', tint: '#b8e07a', warm: true, chorus: 1.2 },
  summer: { name: 'Summer', blurb: 'Warm water, buzzing air. Dragonflies patrol the pond and the lilies bloom.', bugs: 1.3, algae: 1.3, wrigglers: 1.3, pads: 'bloom', tint: '#7ec850', warm: true, chorus: 1 },
  autumn: { name: 'Autumn', blurb: 'Leaves drift onto the water. Bugs get scarce and the lily pads turn brown and sink.', bugs: .55, algae: .6, wrigglers: .4, pads: 'wither', tint: '#d9a24a', warm: false, chorus: .3 },
  winter: { name: 'Winter', blurb: 'The pond freezes over. Frogs sleep in the mud below the ice until spring.', bugs: 0, algae: .15, wrigglers: 0, pads: 'gone', tint: '#a9c8d9', warm: false, chorus: 0 }
};

/* ---------- fact cards ----------
   `more` is a real-world link shown as "See the real thing". */
const YT = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const FACTS = {
  hatch: {
    title: 'Hatched!',
    body: 'Frog eggs float in a clump of clear jelly, hundreds at a time. Each black dot slowly turns into a comma, then a tadpole that wriggles free. The jelly keeps the eggs warm and safe from being eaten.',
    simple: 'You hatched from a black dot in a ball of jelly! Now you are a tadpole.',
    more: YT('frog eggs hatching tadpoles time lapse')
  },
  tadpole: {
    title: 'Meet the tadpole',
    body: 'A tadpole is basically a head with a tail. It breathes water through gills, like a fish, and has a tiny beak-like mouth with rows of scraping teeth for rasping algae off rocks and weeds. It has no legs at all yet.',
    simple: 'A tadpole is a head with a tail. It breathes like a fish and scrapes algae to eat.',
    more: YT('tadpole eating algae close up')
  },
  algae: {
    title: 'Pond salad',
    body: 'The green fuzz on rocks and weeds is algae: millions of tiny plants that make food from sunlight. Algae grows back fastest in sunny, warm water, so a summer pond can feed a LOT of tadpoles.',
    simple: 'The green fuzz on rocks is algae. It is tadpole food, and it grows back in the sun.',
    more: YT('pond algae under microscope')
  },
  wriggler: {
    title: 'Wrigglers',
    body: 'Those wriggly things hanging from the surface are mosquito larvae. They breathe air through a little snorkel on their tail, so they hang upside down at the top. When something comes close they wriggle down to escape. Tadpoles and frogs love to eat them.',
    simple: 'Wrigglers are baby mosquitoes. They hang from the top and breathe through a snorkel. Yum!',
    more: YT('mosquito larvae wrigglers pond')
  },
  burst: {
    title: 'Tail power',
    body: 'A tadpole\'s tail is a big muscle with a thin fin along both edges. A quick flick of the tail is how it dodges a hungry dragonfly nymph. Press SPACE for a burst of speed.',
    simple: 'Your tail is a big muscle. Press SPACE to zoom away from danger!',
    more: YT('tadpole swimming slow motion')
  },
  legs: {
    title: 'Legs first, back ones!',
    body: 'Back legs always sprout first: two tiny buds at the base of the tail that grow into kicking legs with webbed toes. The tadpole keeps swimming with its tail but starts to kick too.',
    simple: 'Your back legs came first! They have webbed toes for kicking.',
    more: YT('tadpole growing legs time lapse')
  },
  arms: {
    title: 'Front legs pop out',
    body: 'The front legs grow hidden inside the gill chamber, then pop out through the skin, usually the left one first. Now the tadpole has lungs too, so it has to swim up and gulp air at the surface.',
    simple: 'Your front legs popped out! Now you have lungs. Swim up and gulp air.',
    more: YT('tadpole front legs emerging metamorphosis')
  },
  tail: {
    title: 'Where does the tail go?',
    body: 'The tail is not dropped. It is slowly absorbed back into the body and used as food, because a tadpole in mid-change cannot eat. Its mouth is being rebuilt from a scraping beak into a wide frog mouth.',
    simple: 'Your tail shrinks INTO your body. You eat your own tail from the inside! Your mouth is getting bigger too.',
    more: YT('tadpole tail absorption metamorphosis')
  },
  froglet: {
    title: 'A froglet!',
    body: 'The tail is gone and the gills are closed: you are a froglet, a tiny frog with a bit of a bump where the tail was. Froglets climb out onto lily pads and the bank and start hunting bugs. Many are smaller than a fingernail.',
    simple: 'You are a froglet! A tiny frog. Hop onto a lily pad and catch bugs.',
    more: YT('froglet leaving pond')
  },
  tongue: {
    title: 'Sticky tongue',
    body: 'A frog\'s tongue is attached at the FRONT of its mouth, so it flips out like a whip. It hits the bug in a few hundredths of a second and is covered in spit that goes sticky on impact, then soft again to let the bug slide down.',
    simple: 'Your tongue is stuck at the front of your mouth. It flips out super fast and is sticky!',
    more: YT('frog tongue slow motion')
  },
  eyes: {
    title: 'Blink to swallow',
    body: 'Frogs cannot chew. When a frog swallows, it blinks hard and pulls its eyeballs down into its head to push the food down its throat. That is why a frog\'s eyes bulge: they have room to sink in.',
    simple: 'Frogs use their EYEBALLS to push food down. That is why they blink when they swallow!',
    more: YT('frog swallowing with eyes')
  },
  skin: {
    title: 'Breathing through skin',
    body: 'A frog breathes with lungs, but it also breathes through its thin, wet skin, especially underwater and all winter long. That is why it must stay moist and why it can sit on the bottom of a pond for months.',
    simple: 'Frogs breathe through their wet skin, so they can stay underwater a long time.',
    more: YT('how frogs breathe through skin')
  },
  frog: {
    title: 'A grown frog',
    body: 'Long back legs for jumping, a wide mouth, big eyes on top of the head so it can see while floating, and an eardrum you can see: the round patch behind each eye. Most frogs live at the pond edge all summer, eating bugs.',
    simple: 'You are a grown frog! Big legs, big mouth, and eyes on top of your head.',
    more: YT('green frog pond behavior')
  },
  heron: {
    title: 'The heron',
    body: 'A great blue heron stands as still as a statue in the shallows, then stabs down faster than you can blink. Frogs escape by diving deep, hiding under a lily pad, or staying perfectly still: a heron hunts by spotting movement.',
    simple: 'A heron stands very still, then stabs down. Dive deep, hide under a lily pad, or freeze!',
    more: YT('great blue heron hunting frogs')
  },
  nymph: {
    title: 'The monster on the bottom',
    body: 'A dragonfly starts life underwater as a nymph: a brown, six-legged hunter with a hinged jaw called a mask that shoots out to grab tadpoles. It can jet through the water by squirting water out of its back end.',
    simple: 'A dragonfly nymph lives on the bottom. Its jaw shoots out to grab tadpoles! Burst away.',
    more: YT('dragonfly nymph catching tadpole')
  },
  dragonfly: {
    title: 'Dragonfly!',
    body: 'When the nymph is ready it climbs a reed, its skin splits, and out crawls a dragonfly with crumpled wings that dry in the sun. It flies at up to 30 miles an hour. A frog with a long tongue can still catch one.',
    simple: 'The nymph climbed a reed and became a dragonfly! They fly fast, but a frog can catch one.',
    more: YT('dragonfly emerging from nymph time lapse')
  },
  lilypad: {
    title: 'Lily pads',
    body: 'A lily pad is a leaf with air spaces inside so it floats, and a waxy top that sheds water. A big one can hold a frog. Frogs sit on pads to hunt and hide under them from herons. The flowers open by day and close at night.',
    simple: 'Lily pads float because they are full of air. Sit on top, or hide under one!',
    more: YT('water lily pad frog')
  },
  chorus: {
    title: 'The night chorus',
    body: 'On warm nights the males sing to call the females. A frog fills a stretchy throat sac like a balloon and pushes air back and forth over its voice box. Each species has its own call, so you can tell who is at the pond with your eyes closed.',
    simple: 'At night the boy frogs sing to find a friend. They blow up their throats like balloons!',
    more: YT('frog chorus night pond vocal sac')
  },
  sing: {
    title: 'Your own song',
    body: 'Press E to call. Green frogs twang like a banjo, bullfrogs boom jug-o-rum, peepers peep, wood frogs quack, treefrogs trill and leopard frogs snore. Listen for the others to answer.',
    simple: 'Press E to sing! Listen: the other frogs answer you.',
    more: YT('frog calls of north america')
  },
  night: {
    title: 'The pond at night',
    body: 'Night is when the pond gets busy. Frogs sing, mosquitoes hover over the water, fireflies blink on the bank and the water reflects the moon. Frogs hunt best at night because most of their prey is out then.',
    simple: 'At night the pond is busy! Frogs sing, fireflies blink and lots of bugs come out.',
    more: YT('pond at night frogs fireflies')
  },
  rain: {
    title: 'Rain on the pond',
    body: 'Frogs love rain. Wet skin means they can travel over land, and the drops fill up puddles where mosquitoes lay eggs, which means more wrigglers next week. Watch the raindrops make rings on the water.',
    simple: 'Frogs love rain! Wet skin is happy skin. Watch the rings on the water.',
    more: YT('rain on pond frogs')
  },
  spring: {
    title: 'Spring',
    body: 'The ice melts, the water warms and the frogs come up from the mud. The first warm rainy night is a big party: hundreds of frogs travel to the pond to sing and lay eggs. Wood frogs and peepers are the earliest.',
    simple: 'Spring! The ice melts and the frogs wake up and sing.',
    more: YT('spring frog migration pond')
  },
  summer: {
    title: 'Summer',
    body: 'Warm water grows algae fast, so tadpoles grow fast. Dragonflies patrol the pond, lilies open, and the surface buzzes with flies and mosquitoes. Long days mean lots of hunting.',
    simple: 'Summer! Lots of bugs, lots of algae, and the lilies bloom.',
    more: YT('summer pond life')
  },
  autumn: {
    title: 'Autumn',
    body: 'Leaves fall on the water and slowly sink. The lily pads turn brown and sag. Bugs get scarce, so frogs eat as much as they can and go quiet, ready for winter.',
    simple: 'Autumn! Leaves fall on the pond. Bugs are hard to find. Eat up before winter.',
    more: YT('pond in autumn')
  },
  winter: {
    title: 'Winter under the ice',
    body: 'The top of the pond freezes but the bottom stays just above freezing. Frogs sink to the mud and go still: their heart slows to a few beats a minute and they breathe through their skin. This winter sleep is called brumation.',
    simple: 'The top of the pond turns to ice. Frogs sleep in the mud at the bottom until spring.',
    more: YT('how frogs survive winter under ice')
  },
  frogsicle: {
    title: 'The frog that freezes solid',
    body: 'A wood frog does not hide in the mud. It hops into the leaf litter on the bank and freezes SOLID. Its heart stops. Its blood stops. Sugar in its cells stops them shattering. When spring thaws it, the heart starts up again and off it hops.',
    simple: 'A wood frog freezes solid all winter. Its heart stops! In spring it thaws and hops away.',
    more: YT('wood frog freezes solid')
  },
  eggs: {
    title: 'Spawn',
    body: 'A female frog can lay a thousand eggs or more in one jelly clump, attached to a water weed in the shallows where the sun keeps it warm. Only a few will grow up to be frogs; the rest feed the pond. That is why there are so many.',
    simple: 'You laid hundreds of eggs in jelly in the warm shallows. A few will become frogs.',
    more: YT('frog spawn pond')
  },
  ice: {
    title: 'Ice on top, water below',
    body: 'Ice floats, so a pond freezes from the top down and the water underneath stays liquid all winter. The ice even acts like a blanket. That is what lets frogs, fish and nymphs live through the cold.',
    simple: 'Ice floats on top like a lid. The water under it stays wet all winter.',
    more: YT('why does ice float pond')
  },
  minnows: {
    title: 'Minnows',
    body: 'Little fish share the pond with the tadpoles. They eat mosquito larvae too, and some eat tadpoles, so tadpoles stay near the weeds. Together the fish, frogs, bugs and plants make a food web.',
    simple: 'Little fish live here too. Everyone in the pond eats something and is food for something else.',
    more: YT('pond food web for kids')
  },
  turtle: {
    title: 'The painted turtle',
    body: 'Painted turtles climb onto logs to warm up in the sun, which is called basking. They are shy: come close and they slide off with a plop and wait underwater until you leave. They eat plants, bugs and, yes, tadpoles.',
    simple: 'The turtle sits on the log to get warm. Come close and it slides off. Plop!',
    more: YT('painted turtle basking slides off log')
  },
  strider: {
    title: 'Walking on water',
    body: 'Water striders stand on the surface without sinking. Their legs are covered in tiny waxy hairs that trap air, and the water\'s skin, called surface tension, holds them up. They row with the middle legs and steer with the back ones.',
    simple: 'Striders walk on top of the water! Hairy legs keep them from sinking.',
    more: YT('water strider surface tension')
  },
  caddis: {
    title: 'A house of stones',
    body: 'A caddisfly larva builds a tube around itself out of sand grains, tiny stones or bits of leaf, glued with silk it makes in its mouth. It drags the house everywhere. Clean ponds have lots of them.',
    simple: 'This bug built its own house out of tiny stones and carries it around.',
    more: YT('caddisfly larva case building')
  },
  boatman: {
    title: 'The water boatman',
    body: 'It rows with two long oar-shaped legs and carries a silver bubble of air on its belly to breathe from, like a scuba tank. When the bubble runs low it pops up to the surface for a new one.',
    simple: 'It rows with two oar legs and carries a bubble of air to breathe.',
    more: YT('water boatman swimming')
  },
  newt: {
    title: 'The newt',
    body: 'A newt is a salamander that lives in the water. It breathes air, so it swims up for a gulp now and then, just like you did. Its red spots warn that its skin is poisonous to eat. Young newts, called efts, live on land for a few years first.',
    simple: 'A newt is a swimming salamander. Its red spots say: do not eat me.',
    more: YT('eastern newt swimming pond')
  },
  leech: {
    title: 'The leech',
    body: 'A leech is a worm with a sucker at each end. Most pond leeches eat snails and worms, not people. It stretches out long to swim and scrunches up short to rest. Gross, harmless, and very good at finding you.',
    simple: 'A leech is a stretchy worm with a sucker at each end. Gross but harmless!',
    more: YT('leech swimming pond')
  },
  snake: {
    title: 'The garter snake',
    body: 'A garter snake hunts frogs in the grass by the water, following the smell with its flicking tongue. It cannot hear you, and it has trouble seeing something that holds still. Freeze, or hop into the water: it rarely follows.',
    simple: 'A snake hunts by smell with its tongue. Hold still, or hop into the water.',
    more: YT('garter snake hunting frog pond')
  },
  raccoon: {
    title: 'The raccoon',
    body: 'Raccoons come to the pond at night and feel for food in the shallows with their clever paws. They love frogs but hate toads: a toad\'s skin glands taste so bad the raccoon spits it out and wipes its mouth. Deep water is out of its reach.',
    simple: 'At night the raccoon pats the shallow water for frogs. Go deep! Toads taste yucky to it.',
    more: YT('raccoon hunting in pond at night')
  },
  fish: {
    title: 'The big fish',
    body: 'A bass hunts at dusk in the deep, open water. It swallows tadpoles and froglets whole. Tadpoles stay safe in the shallows and among the weeds, where a big fish cannot go. So: deep is safe from the heron by day, but the shallows are safe from the fish at dusk.',
    simple: 'A big fish hunts deep water at dusk. Swim UP to the shallows where it cannot go.',
    more: YT('largemouth bass eating frog')
  },
  toad: {
    title: 'Toads are frogs too',
    body: 'A toad is a kind of frog with dry, bumpy skin and short legs for hopping instead of leaping. It lays eggs in long strings. Its tadpoles are black and swim in crowds. The bumps behind its eyes make a bitter milk that most animals spit out.',
    simple: 'A toad is a bumpy frog. It hops, and it tastes yucky to raccoons.',
    more: YT('american toad calling trill')
  },
  parade: {
    title: 'The toadlet parade',
    body: 'Toadlets all finish growing at the same time and leave the pond together, usually on the first rainy day. Thousands of toads the size of a fingernail hop away from the water at once. People sometimes think it rained toads.',
    simple: 'All the baby toads leave the pond together on a rainy day. It looks like it rained toads!',
    more: YT('toadlets leaving pond mass migration')
  },
  dryspell: {
    title: 'The pond shrinks',
    body: 'In a hot dry summer the water level drops. The edge turns to cracked mud, lily pads get stranded, and the shallows disappear, so everyone crowds into the middle. Rain fills the pond back up.',
    simple: 'The sun dried some of the water away. The pond got smaller. Rain fills it up again.',
    more: YT('pond drying up summer')
  },
  wildhatch: {
    title: 'The eggs hatched',
    body: 'Every jelly mass in the pond becomes a crowd of tadpoles. They school together for safety and grow all summer. Only a few will make it to frog, which is why so many eggs are laid.',
    simple: 'The eggs hatched into lots of tadpoles! They swim in a crowd to stay safe.',
    more: YT('tadpoles schooling pond')
  },
  mayfly: {
    title: 'The mayfly hatch',
    body: 'Mayfly nymphs live underwater for a year. Then on one summer evening they all hatch together and rise from the water in a cloud. The adults cannot even eat; they live just a day to mate and lay eggs. It is a feast for every frog, fish and bird.',
    simple: 'The mayflies are hatching! They all come out on the same night. Snap, snap, snap!',
    more: YT('mayfly hatch swarm')
  },
  bignight: {
    title: 'The big night',
    body: 'On the first warm rainy night of spring, frogs and salamanders all over the woods wake up and walk to their ponds at the same time. People call it the Big Night. The chorus can be so loud you have to shout.',
    simple: 'It is the big night! Frogs come from everywhere to sing. Listen to them all!',
    more: YT('big night amphibian migration')
  },
  frost: {
    title: 'First frost',
    body: 'On a clear autumn night the air gets cold enough to freeze the dew into frost. It is a sign: the frogs will soon go down to the mud to sleep. Cold-blooded animals slow down as they cool.',
    simple: 'Jack Frost came! Everything sparkles. Winter is coming soon.',
    more: YT('first frost morning time lapse')
  },
  ladybug: {
    title: 'A visitor from the garden',
    body: 'A ladybug flew over from the garden. Frogs will not eat ladybugs: when grabbed, a ladybug leaks bitter yellow blood from its knees, and its bright red says "I taste terrible". Bright colours that warn predators are called warning colours.',
    simple: 'A ladybug came from the garden! Frogs do not eat ladybugs. They taste yucky.',
    more: YT('ladybug reflex bleeding')
  },
  culvert: {
    title: 'The culvert',
    body: 'A culvert is a pipe that lets water run under a road or a path. Frogs, fish and turtles use them as tunnels between ponds and streams. Swim into the dark pipe in the right bank to go through.',
    simple: 'That pipe goes under the path to the stream. Swim into it to go through!',
    more: YT('culvert wildlife crossing frogs')
  },
  stream: {
    title: 'The stream',
    body: 'In a stream the water is always moving, so everything here has to hold on or hide. The current is slowest down by the bottom and behind big rocks, which is where fish and nymphs wait. Swim against it and you get nowhere; hide behind a rock and rest.',
    simple: 'The water here moves! It pushes you along. Hide behind a rock to rest.',
    more: YT('stream ecosystem underwater')
  },
  marsh: {
    title: 'The marsh',
    body: 'A marsh is a wide, shallow wetland packed with cattails and grasses. It is full of insects, so it is full of frogs, and red-winged blackbirds nest in the cattails and sing konk-la-reee from the tops.',
    simple: 'A marsh is shallow and full of cattails. Listen for the blackbird singing!',
    more: YT('red winged blackbird marsh song')
  },
  bog: {
    title: 'The bog',
    body: 'A bog is a wetland with no stream flowing in, so the water is acid and stained brown like tea. Floating sphagnum moss grows into mats you can almost walk on, and pitcher plants catch insects in water-filled trumpets because the soil has so little food.',
    simple: 'Bog water is brown like tea. The pitcher plants eat bugs!',
    more: YT('pitcher plant bog catching insects')
  },
  garden: {
    title: 'A garden pond',
    body: 'People build garden ponds, and frogs find them fast. Even a small pond with plants and a gentle edge becomes a home for frogs, toads, dragonflies and snails. Goldfish are pretty, but they eat tadpoles, so frogs like fish-free ponds best.',
    simple: 'People made this pond. Frogs and toads found it fast! The goldfish eat tadpoles though.',
    more: YT('wildlife garden pond frogs')
  },
  migrate: {
    title: 'Frogs on the move',
    body: 'On warm, rainy nights frogs travel over land between ponds. Wet ground keeps their skin damp, and darkness hides them. In some towns people close roads on those nights so the frogs can cross safely.',
    simple: 'On rainy nights frogs hop over land to other ponds. Wet ground keeps their skin damp.',
    more: YT('frog migration rainy night road crossing')
  },
  pond: {
    title: 'The whole pond',
    body: 'A pond is a world: sunlight grows algae, tadpoles eat algae, nymphs eat tadpoles, frogs eat nymphs and flies, herons eat frogs, and everything that dies becomes mud that feeds the weeds. Zoom out and look at all of it.',
    simple: 'The pond is a whole world. Sun makes algae, tadpoles eat algae, frogs eat bugs, herons eat frogs.',
    more: YT('pond ecosystem cross section')
  }
};

/* ---------- hints: [full, simple] ---------- */
const HINTS = {
  egg: ['Press SPACE again and again to wriggle out of your egg!', 'Tap SPACE lots of times to hatch!'],
  swim: ['Arrow keys swim. Find the green fuzzy algae on the rocks and hold SPACE to scrape it.', 'Arrows to swim. Find green fuzz. Hold SPACE to eat it.'],
  algae: ['Hold SPACE next to the green algae to scrape it off. Mash it to eat faster!', 'Hold SPACE by the green fuzz to eat!'],
  burst: ['That dragonfly nymph is hunting! Tap SPACE for a burst of speed to get away.', 'A nymph! Tap SPACE to zoom away!'],
  wriggler: ['You can eat the wrigglers hanging from the surface now. Sneak up slowly: they dive if you rush.', 'Eat the wrigglers at the top. Go slow so they do not dive.'],
  legs: ['Back legs! Keep eating algae. The green fuzz grows back in the sun.', 'You have back legs! Keep eating green fuzz.'],
  breathe: ['You have lungs now! Swim UP to the surface to gulp air. Your tail shrinks faster when you breathe.', 'You have lungs! Swim UP to the top to breathe.'],
  froglet: ['You are a froglet! Swim to a lily pad or the bank and you will climb out. Press SPACE when a bug glows to snap it.', 'A froglet! Swim to a lily pad to climb on. When a bug glows, press SPACE.'],
  hop: ['LEFT and RIGHT hop. UP is a big jump. SPACE snaps a glowing bug, or leaps if nothing is near.', 'LEFT and RIGHT hop. UP jumps high. SPACE snaps a bug.'],
  snap: ['A bug is glowing! Press SPACE to flick your tongue.', 'A bug is glowing! Press SPACE!'],
  heron: ['HERON! Dive deep, hide under a lily pad, or hold DOWN to stay perfectly still.', 'HERON! Dive down deep, or hold DOWN to freeze!'],
  heronScared: ['Eek! Next time dive deep, hide under a lily pad, or hold DOWN to freeze.', 'Eek! Next time dive deep, or hold DOWN to freeze.'],
  nymphScared: ['Ouch! The nymph got you. Tap SPACE to burst away next time, or stay away from the bottom.', 'Ouch! Tap SPACE to zoom away from nymphs.'],
  frog: ['You are a frog! Eat bugs until you are full. Press E to sing.', 'A frog! Eat bugs. Press E to sing.'],
  night: ['It is night. Press E to sing and the other frogs will answer!', 'Night time! Press E to sing!'],
  readyEggs: ['You are full of eggs! Swim to the glowing weed in the shallows and press E.', 'Full of eggs! Swim to the glowing weed and press E.'],
  laying: ['Laying eggs in the jelly…', 'Laying eggs…'],
  winter: ['Winter! The pond is freezing. Dive to the glowing mud at the bottom and press SPACE to sleep.', 'Winter! Dive to the glowing mud and press SPACE to sleep.'],
  winterWood: ['Winter! Wood frogs freeze solid. Hop to the glowing leaf pile on the bank and press SPACE.', 'Winter! Hop to the glowing leaves and press SPACE.'],
  hibernating: ['Sleeping in the mud under the ice. Spring will come…', 'Sleeping under the ice. Zzz…'],
  spring: ['Spring! The ice has melted. Time to eat and sing.', 'Spring! The ice melted. Eat and sing!'],
  rain: ['Rain! Watch the rings on the water. More wrigglers will hatch soon.', 'Rain! See the rings on the water.'],
  pad: ['You are on a lily pad. Hop to the next one, or wait for a fly to glow.', 'On a lily pad! Wait for a bug to glow.'],
  deep: ['You are deep down where the heron cannot reach.', 'Deep down. The heron cannot reach you here.'],
  autumnHint: ['Autumn. Bugs are getting scarce, so eat up. The pads are sinking.', 'Autumn. Not many bugs. Eat up!'],
  dive: ['Hold DOWN to dive. Hold UP to float to the surface.', 'DOWN dives. UP floats up.'],
  climb: ['Swim into the bank or a lily pad at the surface to climb out.', 'Swim to a pad to climb out.'],
  cling: ['Treefrog toes! Hop onto a reed and you can cling there, out of the heron\'s reach.', 'Sticky toes! Hop onto a reed to cling.'],
  snake: ['SNAKE! Hold DOWN to freeze, or hop into the water.', 'SNAKE! Hold DOWN to freeze, or hop in the water!'],
  snakeScared: ['Eek, the snake! Next time freeze, or hop into the water.', 'Eek! Next time freeze or hop in the water.'],
  raccoon: ['A raccoon is patting the shallows! Dive deep or get under a lily pad.', 'A raccoon! Dive down deep!'],
  raccoonScared: ['The raccoon got you! At night, stay deep or under a pad.', 'The raccoon got you! Stay deep at night.'],
  yuck: ['The raccoon spat you out! Toads taste terrible.', 'Yuck! Toads taste bad. It spat you out!'],
  fish: ['A big fish! Swim UP to the shallows where it cannot go.', 'A big fish! Swim UP to the shallow water!'],
  fishScared: ['The fish got you! At dusk, stay in the shallows and the weeds.', 'The fish got you! Stay in shallow water at dusk.'],
  fishSafe: ['Safe in the shallows. The fish cannot follow you there.', 'Safe! The fish cannot come this shallow.'],
  dry: ['The pond is shrinking in the heat. Look at the mud at the edges.', 'The pond is getting smaller. See the mud!'],
  parade: ['Rain! All the toadlets are leaving the pond together. A toadlet parade!', 'Rain! All the baby toads are hopping away together!'],
  travelRain: ['Frogs travel over land on rainy nights, when the ground is wet. Wait for rain after dark, or turn on Travel any time in settings.', 'Frogs go over land on rainy nights. Wait for rain in the dark!'],
  culvert: ['That pipe in the bank is a culvert. Swim into it to go to the stream!', 'Swim into the pipe to go to the stream!'],
  plop: ['The turtle slid off the log. Plop! It will come back when you leave.', 'The turtle went plop! It will come back.']
};
