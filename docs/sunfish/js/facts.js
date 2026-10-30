/* ============================================================
   facts.js — the sunfish, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the ocean sunfish
   (Mola mola) off California (Monterey Bay and the open Pacific),
   simplified for play.  Each fact has a full version, a "little
   words" version and a link to see the real thing (a Wikipedia page
   or a YouTube search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Four looks of an ocean sunfish.  A sunfish can change shade (pale to dark, and
   mottled when it is excited or being cleaned), but each one has a usual look.
   body / body2 = side light and dark, belly, fin, spots, eye */
const FORMS = {
  normal: { name: 'Silver sunfish', short: 'Silver', latin: 'Mola mola',
    body: '#a9b7c2', body2: '#5f6f7c', belly: '#e6ecef', fin: '#7f8f9b', spots: '#ffffff', eye: '#141a20',
    blurb: 'Most ocean sunfish are silvery grey, darker on the back and pale on the belly, like the sea itself.',
    simple: 'Silver grey, like the sea!', power: 'The most common look' },
  slate: { name: 'Slate sunfish', short: 'Slate', latin: 'Mola mola (dark)',
    body: '#77838e', body2: '#363f48', belly: '#c4ccd2', fin: '#4e5862', eye: '#0c1014', spots: '#d8e0e6',
    blurb: 'Some sunfish are a deep slate grey-brown. A sunfish can go darker in a blink when something surprises it.',
    simple: 'Dark slate grey!', power: 'Hard to see from above' },
  spotted: { name: 'Spotted sunfish', short: 'Spotted', latin: 'Mola mola (mottled)',
    body: '#b4bcc0', body2: '#6a7278', belly: '#eef0f0', fin: '#868e94', eye: '#141a20', spots: '#f8fbff',
    blurb: 'A sunfish can show pale spots and blotches all over, especially while little fish clean it.',
    simple: 'Grey with white spots!', power: 'Spotty when excited' },
  pearl: { name: 'Pearl sunfish', short: 'Pearl', latin: 'Mola mola (pale)',
    body: '#dfe5e6', body2: '#98a3a8', belly: '#fbfcfc', fin: '#b9c3c7', eye: '#1a2024', spots: '#ffffff',
    blurb: 'A pale, pearly sunfish, almost white. Basking flat at the top, it shines in the sun.',
    simple: 'Pale like a pearl!', power: 'Shines in the sun' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy: { name: 'Boy sunfish', short: 'Boy', blurb: 'A boy grows big, swims out to the warm sea and finds a girl, then lets a milky cloud go beside her so her eggs can grow.', simple: 'Swim to the warm sea and find a girl!' },
  girl: { name: 'Girl sunfish', short: 'Girl', blurb: 'A girl grows big, swims out to the warm sea and lets her eggs go: hundreds of millions of them, more than any other animal with a backbone.', simple: 'Let three hundred million eggs go!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'larva', name: 'Hatchling', short: 'Hatchling' },
  { key: 'star', name: 'Spiky star', short: 'Star' },
  { key: 'juvenile', name: 'Young sunfish', short: 'Young' },
  { key: 'mola', name: 'Sunfish', short: 'Sunfish' },
  { key: 'giant', name: 'Giant sunfish', short: 'Giant' },
  { key: 'spawn', name: 'The warm sea', short: 'Warm sea' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much food each step takes, per difficulty
   larva: plankton to grow into a spiky star, a bigger star, then a young sunfish
   juv:   krill and little jellies to grow, then to become a real sunfish
   grow:  jellies to grow from a sunfish to a big one, then a giant, then ready for the warm sea
   cold:  how fast the deep cools you · itch: how fast sea lice build up
   net:   the fishing net comes (once) · blows: good pushes to let the eggs go
   fish:  the visitors come (easy: fewer) */
const DIFFICULTY = {
  easy:   { name: 'Little kid', larva: [14, 32, 54], juv: [30, 70], grow: [36, 90, 160], cold: .6, itch: .7, net: false, blows: 3, fish: false },
  normal: { name: 'Big kid',    larva: [20, 46, 76], juv: [55, 120], grow: [54, 130, 220], cold: 1, itch: 1, net: true, blows: 4, fish: true },
  hard:   { name: 'Scientist',  larva: [26, 58, 96], juv: [60, 130], grow: [70, 165, 280], cold: 1.25, itch: 1.25, net: true, blows: 5, fish: true }
};

/* how long a sunfish is, in cm, from its stage, its growth step and its food.
   A hatchling is about 2.5 mm; a big grown-up is two metres long and as tall again
   from fin tip to fin tip. */
function molaCM(p) {
  const D = p.D, t = (a, b) => clamp((p.food - a) / Math.max(1, b - a), 0, 1);
  if (p.stage === 'egg') return .13;
  if (p.stage === 'larva') { const th = [0, ...D.larva], i = p.zinstar; return [0, lerp(.25, .35, t(th[0], th[1])), lerp(.4, .8, t(th[1], th[2])), lerp(.8, 1.5, t(th[2], th[3]))][i]; }
  if (p.stage === 'juvenile') { const th = [0, ...D.juv], i = p.jsize; return i === 1 ? lerp(2, 9, t(th[0], th[1])) : lerp(10, 35, t(th[1], th[2])); }
  const th = [0, ...D.grow], i = Math.min(3, p.size);
  return [0, lerp(45, 95, t(th[0], th[1])), lerp(100, 160, t(th[1], th[2])), lerp(170, 230, t(th[2], th[3]))][i];
}
/* the drawn body length in world units (stylised: small sunfish are drawn far bigger than
   life, so a child can see the spikes; a giant is drawn huge so the growth is felt) */
function molaUnits(cm) { return 2.6 + Math.pow(cm, .62) * 2.7; }
/* a rough weight in kg for a length in cm (about a tonne at 2 m) */
function molaKG(cm) { return 1.3e-4 * cm * cm * cm; }
/* the water temperature (°C) at a depth (world units; 2 units = 1 m) */
function seaTempAt(y, base) { return 6 + (base - 6) * Math.exp(-Math.max(0, y) / 190); }
const DEPTH_M = (y) => Math.max(0, Math.round(y / 2));

const W_ = 'https://en.wikipedia.org/wiki/', Y_ = 'https://www.youtube.com/results?search_query=';
const FACTS = {
  egg: { title: 'Three hundred million eggs', body: 'One big female ocean sunfish was found carrying about three hundred million eggs, more than any other animal with a backbone. Each egg is about the size of a pinhead.', simple: 'One mum can have 300 million eggs!', more: W_ + 'Ocean_sunfish' },
  drift: { title: 'Drifting free', body: 'Sunfish do not build nests or look after their eggs. The eggs and babies drift on their own in the open ocean, with the plankton.', simple: 'The eggs float in the sea on their own.', more: W_ + 'Ocean_sunfish' },
  hatch: { title: 'A tiny hatchling', body: 'A baby sunfish hatches out smaller than a grain of rice. It is see-through, with big eyes and a round belly of yolk to live on at first.', simple: 'A baby sunfish is smaller than a grain of rice!', more: W_ + 'Ocean_sunfish' },
  plankton: { title: 'Plankton', body: 'Plankton are the tiny living things that drift in the sea. A baby sunfish eats the tiniest of them: copepods, krill babies and other little drifters.', simple: 'Tiny drifting animals. Yum!', more: W_ + 'Plankton' },
  copepod: { title: 'Copepods', body: 'Copepods are tiny shrimp-like animals with one red eye. They are some of the most common animals on Earth, and almost every baby fish eats them.', simple: 'Tiny shrimps with one red eye!', more: W_ + 'Copepod' },
  krill: { title: 'Krill', body: 'Krill are little see-through shrimps that swarm in the cold Pacific off California. Fish, birds, whales and young sunfish all eat them.', simple: 'Little see-through shrimps. Everybody eats them!', more: W_ + 'Krill' },
  star: { title: 'A spiky star', body: 'A baby sunfish grows spikes all over its body, so it looks like a tiny star. Scientists think the spikes make it hard for a fish to swallow.', simple: 'Spikes all over, like a tiny star!', more: Y_ + 'ocean+sunfish+larva' },
  puffer: { title: 'Cousin of the pufferfish', body: 'Sunfish are cousins of pufferfish and boxfish. A spiky baby sunfish looks very like a tiny pufferfish.', simple: 'A cousin of the pufferfish!', more: W_ + 'Tetraodontiformes' },
  updown: { title: 'Up at night, down by day', body: 'Every night, plankton all over the world rise towards the surface to feed, and every morning they sink back down where it is darker. Jellies do it too.', simple: 'Plankton swim up at night and down in the day!', more: W_ + 'Diel_vertical_migration' },
  glow: { title: 'Glowing sea', body: 'Some plankton flash blue light when something bumps them. This is called bioluminescence. On dark nights the sea can sparkle with it.', simple: 'Some plankton glow blue when you bump them!', more: W_ + 'Bioluminescence' },
  anchovy: { title: 'Anchovies', body: 'Northern anchovies swim in huge silver schools off California and eat plankton. A tiny sunfish is too small and spiky to be worth the bother.', simple: 'Silver fish in a big school!', more: W_ + 'Northern_anchovy' },
  combjelly: { title: 'Comb jellies', body: 'A comb jelly is a see-through blob with eight rows of tiny beating hairs that shimmer like a rainbow. It eats tiny drifters, so a baby keeps away. A grown sunfish eats comb jellies!', simple: 'A see-through blob with rainbow lights!', more: W_ + 'Ctenophora' },
  gull: { title: 'Western gulls', body: 'Western gulls live all along the California coast. They dip at the top of the sea to snatch small things, so tiny babies are safer a little deeper down.', simple: 'A gull dips at the top of the sea.', more: W_ + 'Western_gull' },
  notail: { title: 'No tail!', body: 'A sunfish never grows a proper tail. As the baby grows, the back edges of its top and bottom fins join into a stiff, frilly rudder called the clavus.', simple: 'No tail! It grows a frilly rudder instead.', more: W_ + 'Ocean_sunfish' },
  spines: { title: 'Spikes fade away', body: 'As the young sunfish grows, its spikes shrink and its body grows tall and round, like a disc.', simple: 'The spikes go away as it grows.', more: W_ + 'Ocean_sunfish' },
  school: { title: 'Swimming in a school', body: 'Young sunfish often swim together in small schools. Grown-ups usually swim alone.', simple: 'Young sunfish swim together!', more: W_ + 'Shoaling_and_schooling' },
  dorado: { title: 'Mahi-mahi', body: 'The mahi-mahi, or dorado, is a fast, shining green-and-gold fish of warm seas. It is one of the few fish quick enough to chase a young sunfish.', simple: 'A fast gold and green fish!', more: W_ + 'Mahi-mahi' },
  tuna: { title: 'Tuna', body: 'Bluefin tuna are some of the fastest fish in the sea. They hunt young sunfish, but a young sunfish in a school is hard to catch.', simple: 'A very fast fish!', more: W_ + 'Pacific_bluefin_tuna' },
  mola: { title: 'Mola means millstone', body: 'The sunfish\'s science name, Mola mola, comes from the Latin word for a millstone: a big, round, grey stone for grinding grain.', simple: 'Mola means a big round stone!', more: W_ + 'Ocean_sunfish' },
  head: { title: 'A swimming head', body: 'A sunfish looks like a huge fish head with fins. In German it is called the swimming head, and in Polish the moonfish.', simple: 'It looks like a swimming head!', more: W_ + 'Ocean_sunfish' },
  heavy: { title: 'The heaviest bony fish', body: 'The ocean sunfish is one of the heaviest bony fish in the world. A big one weighs about as much as a car.', simple: 'As heavy as a car!', more: W_ + 'Ocean_sunfish' },
  growth: { title: '60 million times bigger', body: 'From a tiny hatchling to a giant, a sunfish can get about sixty million times heavier. No other animal with a backbone grows so much.', simple: 'It grows 60 million times heavier!', more: W_ + 'Ocean_sunfish' },
  fast: { title: 'Growing fast', body: 'A young sunfish at Monterey Bay Aquarium grew by about 370 kilograms in just over a year: almost a kilogram a day!', simple: 'It can grow almost a kilo a day!', more: W_ + 'Ocean_sunfish' },
  fins: { title: 'Wings under water', body: 'A sunfish swims by flapping its tall top fin and bottom fin from side to side together, like wings. Its clavus steers.', simple: 'It flaps its fins like wings!', more: Y_ + 'ocean+sunfish+swimming' },
  jellies: { title: 'Jelly eater', body: 'Sunfish eat lots of jellies, salps and comb jellies, and also small fish, squid and shrimps. Jellies are mostly water, so a sunfish must eat a lot of them.', simple: 'It eats lots and lots of jellies!', more: W_ + 'Ocean_sunfish' },
  salp: { title: 'Salps', body: 'A salp is a see-through barrel that pumps water through itself. Salps join up in long chains that drift in the open sea. Sunfish slurp them up.', simple: 'See-through barrels in a long chain!', more: W_ + 'Salp' },
  beak: { title: 'A beak, not teeth', body: 'A sunfish\'s teeth are joined into a hard beak, like a parrot\'s. More teeth in its throat help shred its jelly meals.', simple: 'A beak like a parrot!', more: W_ + 'Ocean_sunfish' },
  moonjelly: { title: 'Moon jellies', body: 'Moon jellies drift in huge groups off California. They are a favourite sunfish meal: soft, slow and easy to slurp.', simple: 'A soft jelly. A sunfish snack!', more: W_ + 'Aurelia_aurita' },
  nettle: { title: 'Sea nettles', body: 'The Pacific sea nettle is a golden jelly with long frilly arms. Its sting hurts people, but a sunfish\'s thick skin does not mind.', simple: 'A gold jelly with long arms!', more: W_ + 'Chrysaora_fuscescens' },
  dive: { title: 'A deep diver', body: 'Sunfish dive hundreds of metres down into the cold, dark water to find jellies. One was tracked diving more than a kilometre deep!', simple: 'It dives deep, deep down for jellies!', more: Y_ + 'ocean+sunfish+deep+dive' },
  cold: { title: 'Cold and dark', body: 'Deep down the water is as cold as a fridge. A sunfish cools down while it hunts there, so it cannot stay down for ever.', simple: 'Deep down it is cold, like a fridge!', more: W_ + 'Thermocline' },
  bask: { title: 'Sunbathing', body: 'After a cold dive, a sunfish often lies flat on its side at the top of the sea, in the sun. Scientists think it is warming up. That is how it got the name sunfish.', simple: 'It lies flat in the sun to warm up!', more: Y_ + 'ocean+sunfish+basking' },
  lice: { title: 'Hitchhikers', body: 'Sunfish carry lots of parasites: tiny animals that ride on their skin and in their gills. Scientists have found more than forty kinds on sunfish.', simple: 'Tiny bugs ride on its skin. Itchy!', more: W_ + 'Ocean_sunfish' },
  gullclean: { title: 'Bird helpers', body: 'While a sunfish basks, gulls and other seabirds may land and peck the parasites off its skin. The birds get a snack and the sunfish gets clean.', simple: 'Gulls peck the bugs off. Thank you!', more: Y_ + 'gull+cleaning+ocean+sunfish' },
  station: { title: 'The cleaning station', body: 'In the kelp forests of California, sunfish visit places where little fish clean them. The sunfish tilts on its side and holds very still while the fish pick it clean.', simple: 'Little fish clean the sunfish in the kelp!', more: Y_ + 'ocean+sunfish+cleaning+station+kelp' },
  senorita: { title: 'Señoritas', body: 'The señorita is a slim yellow fish of California\'s kelp forests. It picks parasites off bigger fish, sunfish included.', simple: 'A little yellow cleaner fish!', more: W_ + 'Señorita_(fish)' },
  halfmoon: { title: 'Halfmoon fish', body: 'The halfmoon is a blue-grey fish of the kelp forest with a tail shaped like a half moon. It helps clean visiting sunfish too.', simple: 'A blue fish that helps clean!', more: W_ + 'Medialuna_californiensis' },
  kelp: { title: 'Giant kelp', body: 'Giant kelp is a seaweed that can grow more than half a metre in a day. Gas-filled floats hold it up towards the light, making forests full of fish.', simple: 'A seaweed that grows as tall as a tree!', more: W_ + 'Macrocystis_pyrifera' },
  breach: { title: 'Jumping out', body: 'Sunfish sometimes leap right out of the sea and land with a splash. Scientists think this may help shake parasites off.', simple: 'It can jump out of the sea! Splash!', more: Y_ + 'ocean+sunfish+breaching' },
  sealion: { title: 'California sea lions', body: 'California sea lions are fast, playful swimmers. They are one of the very few animals big enough to bother a grown-up sunfish.', simple: 'A fast, playful sea lion!', more: W_ + 'California_sea_lion' },
  orca: { title: 'Orcas', body: 'Orcas, or killer whales, are the biggest dolphins. They travel in family groups called pods and pass by Monterey Bay.', simple: 'Orcas are big black and white dolphins!', more: W_ + 'Orca' },
  shark: { title: 'Blue sharks', body: 'Blue sharks are long, slim, bright blue sharks of the open ocean. Big sharks, sea lions and orcas are almost the only animals that bother a big sunfish.', simple: 'A long blue shark!', more: W_ + 'Blue_shark' },
  skin: { title: 'Thick skin', body: 'A sunfish\'s skin can be thicker than your hand. It is rough like sandpaper and coated in slime.', simple: 'Its skin is thick and rough!', more: W_ + 'Ocean_sunfish' },
  shade: { title: 'Changing shade', body: 'A sunfish can turn from pale to dark, and show pale spots and blotches, especially when it is excited or being cleaned.', simple: 'It can change from pale to dark!', more: W_ + 'Ocean_sunfish' },
  bones: { title: 'Light bones', body: 'Much of a sunfish\'s skeleton is soft and light, like gristle, and it has no air bag (swim bladder) inside. That helps such a big fish float without much effort.', simple: 'Its bones are light and soft.', more: W_ + 'Ocean_sunfish' },
  finshark: { title: 'Is that a shark?', body: 'When a sunfish swims at the top, its tall fin sticks out of the water and flops from side to side. People sometimes think it is a shark!', simple: 'Its fin looks like a shark fin!', more: Y_ + 'ocean+sunfish+fin+surface' },
  boat: { title: 'Look out for fins', body: 'A sunfish basking at the top is hard to see, so a careful skipper slows down when a fin flops by.', simple: 'Boats go slow when they see a sunfish.', more: W_ + 'Ocean_sunfish' },
  net: { title: 'Caught by mistake', body: 'Nets set for other fish sometimes catch sunfish by mistake. Careful fishers lift them out and let them go.', simple: 'Fishers let the sunfish go!', more: W_ + 'Bycatch' },
  turtle: { title: 'Leatherback turtles', body: 'The leatherback is the biggest turtle in the world, and it eats jellies too. It swims across the whole Pacific to feed off California.', simple: 'A huge turtle that eats jellies too!', more: W_ + 'Leatherback_sea_turtle' },
  monterey: { title: 'Monterey Bay', body: 'Monterey Bay in California has a deep canyon close to the shore, kelp forests and lots of jellies. Sunfish visit in summer and autumn.', simple: 'A bay in California with kelp and sunfish.', more: W_ + 'Monterey_Bay' },
  warmsea: { title: 'The warm sea', body: 'Nobody has seen much of how sunfish have babies. Scientists think they swim to warm parts of the ocean to let their eggs go.', simple: 'They go to the warm sea to have babies.', more: W_ + 'Ocean_sunfish' },
  spawn: { title: 'Eggs and a little cloud', body: 'A girl sunfish lets her eggs go into the water, and a boy lets a milky cloud go. When the cloud meets the eggs, babies start to grow inside them.', simple: 'The eggs and the cloud meet in the sea.', more: W_ + 'Spawn_(biology)' },
  life: { title: 'A long life', body: 'Nobody knows for sure how long sunfish live. Scientists think it may be twenty years or more.', simple: 'A sunfish may live twenty years!', more: W_ + 'Ocean_sunfish' },
  moon: { title: 'Moon and tide', body: 'The moon pulls the sea into tides. Twice a day the water rises and falls along the coast.', simple: 'The moon moves the tides.', more: W_ + 'Tide' },
  babies: { title: 'Millions of babies', body: 'Out of hundreds of millions of eggs, only a few grow up. Each of those can let hundreds of millions of eggs go of its own.', simple: 'Millions of eggs float away!', more: W_ + 'Ocean_sunfish' },
  lifecycle: { title: 'The whole life cycle', body: 'Egg, tiny hatchling, spiky star, young sunfish in a school, a sunfish diving for jellies, a giant, the warm sea, and then eggs again.', simple: 'Egg, baby, star, young, sunfish, giant… then eggs again!', more: W_ + 'Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are one of millions of tiny eggs drifting in the warm open ocean…', 'I am an egg in the sea. Wait…'],
  hatch: ['Your egg is ready! Wiggle with the arrows to hatch.', 'Wiggle! Hatch out!'],
  swim: ['You hatched! Swim with the arrows and bump into the little copepods to eat them.', 'Swim! Eat the little shrimps.'],
  grow: ['You grew!', 'I grew!'],
  bigger: ['Bigger! Keep eating.', 'Eat more! Get big!'],
  night: ['Night: the plankton rise to the top. Swim up to eat.', 'Night! Food is at the top.'],
  day: ['Day: the plankton sink down. Dive down to find them.', 'Day! Food is down deep.'],
  flick: ['Press E for a quick dash!', 'Press E to dash!'],
  anchovy: ['A school of anchovies! Dash away, or dive a little.', 'Fish! Dash away!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  jelly: ['A comb jelly! Keep away from it while you are tiny.', 'A jelly blob! Keep away!'],
  gull: ['A gull is dipping at the top! Swim down a little.', 'A bird! Go down!'],
  star: ['Spikes! You are a spiky little star now. Keep eating.', 'I am a spiky star!'],
  spikes: ['Something big? Press E: spikes out and dash!', 'Press E! Spikes out!'],
  juvenile: ['Your spikes are fading and a frilly rudder grows where a tail would be. Join the other young sunfish!', 'Swim with the other little sunfish!'],
  friends: ['Swim with your school and eat the krill and little salps near the top.', 'Stay with my friends. Eat!'],
  far: ['Your school is over there! Swim back to your friends.', 'Go back to my friends!'],
  juvfood: ['Krill and salps! Bump into them to eat.', 'Eat the krill!'],
  dorado: ['A mahi-mahi! Stay in the school, or press E to dash!', 'A fast fish! Dash!'],
  dodged: ['Whoosh! It missed you and swam off.', 'Whoosh! It missed me!'],
  mola: ['You are a real sunfish now! Dive down deep to find jellies. Flap with the arrows.', 'Dive deep for jellies!'],
  dive: ['Jellies live deep down by day. Swim down into the dark.', 'Go down, down for jellies!'],
  eat: ['A jelly! Swim to it and press Space to slurp it up.', 'Press Space to eat!'],
  cold: ['Brr! The deep is cold. Watch your warm meter. Swim up to warm up.', 'Cold! Go up to warm up.'],
  chilly: ['Too cold! You float up to the sunny top to warm up.', 'Too cold! Up I go.'],
  bask: ['You are at the top! Press Space to lie flat in the sun and warm up.', 'Press Space to lie in the sun!'],
  basking: ['Lying flat in the sun… warming up.', 'Warm sun. Ahh…'],
  warm: ['Warm again! Dive down for more jellies.', 'Warm! Dive again!'],
  gulls: ['A gull landed on you! It is pecking off the itchy sea lice.', 'A gull pecks the bugs off!'],
  itchy: ['You are itchy with sea lice! Go to the cleaning station in the kelp: follow the arrow.', 'Itchy! Go to the kelp!'],
  station: ['The cleaning station! Little fish clean sunfish here. Press Space and hold still.', 'Press Space. Keep still!'],
  clean: ['Press Space to hold still for the cleaner fish.', 'Press Space! Keep still!'],
  cleaning: ['Little señoritas and halfmoon fish are picking you clean…', 'Little fish clean me…'],
  cleaned: ['All clean! Back out to the open sea to find jellies.', 'All clean! Go eat!'],
  grew: ['You grew bigger! Look how big you are now.', 'I grew big!'],
  full: ['You could grow, but you are too itchy. Get cleaned at the kelp station first.', 'Get clean first!'],
  sealion: ['A sea lion! It is fast and curious. Flap away with E!', 'A sea lion! Press E!'],
  orca: ['Orcas! A big flap with E and they swim on by.', 'Orcas! Press E!'],
  shark: ['A blue shark! Press E for a big flap away.', 'A shark! Press E!'],
  boat: ['A boat! Dive down a little and let it pass.', 'A boat! Go down!'],
  net: ['Oops! A fishing net. Wait: the fishers will lift you out and let you go.', 'A net! Wait…'],
  freed: ['Back into the sea you go! The fishers let you go.', 'Back in the sea!'],
  breach: ['Itchy again! Swim up to the top and press E to jump right out!', 'Swim up and press E!'],
  jumped: ['SPLASH! You jumped clean out of the sea and shook the lice off.', 'Splash! I jumped!'],
  journey: ['You are a giant! Summer is here: swim out to the warm sea. Follow the arrow.', 'Swim to the warm sea!'],
  arrived: ['The warm sea! Other sunfish are here.', 'The warm sea!'],
  findgirl: ['Find the girl sunfish with the hearts and swim beside her.', 'Find a girl sunfish!'],
  findboy: ['Find a boy sunfish with the hearts and swim beside him.', 'Find a boy sunfish!'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  cloud: ['Swim beside her and press Space to let your little cloud go.', 'Press Space by her!'],
  release: ['When the glow swells, press Space to let your eggs go!', 'Glow! Press Space!'],
  larvae: ['Millions of new eggs drift in the warm sea. The cycle begins again!', 'New eggs in the sea!'],
  done: ['Your job is done. Swim on in the warm sea.', 'All done!'],
  turtle: ['A leatherback turtle! It eats jellies too.', 'A big turtle!']
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
/* the seasons, for the HUD, and the surface temperature off California (°C) */
const SEASON_INFO = { spring: ['🌱 Spring', 14], summer: ['☀️ Summer', 17], autumn: ['🍂 Autumn', 16], winter: ['❄️ Winter', 13] };
