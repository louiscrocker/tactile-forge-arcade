/* ============================================================
   facts.js — the copepods, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of Calanus
   finmarchicus, the copepod at the heart of the Gulf of Maine's
   food web, simplified for play.  Each fact has a full version, a
   "little words" version and a link to see the real thing (a
   Wikipedia page or a YouTube search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Four looks.  Calanus is glassy with red-orange pigment (astaxanthin, made from
   what it eats); a well-fed stage V glows gold with its oil; some surface copepods
   (not Calanus) are bright blue.  body = the glassy body tint, edge = its outline,
   pig = the pigment at the feeler tips, mouth and tail, oil = the oil sac, eye */
const FORMS = {
  red:   { name: 'Red copepod', short: 'Red', latin: 'Calanus finmarchicus',
    body: '#f2d8c8', edge: '#e0a890', pig: '#d8322a', oil: '#f0a040', eye: '#c01010',
    blurb: 'The everyday Calanus: glassy, with red tips on its feelers and tail. The red comes from its food.',
    simple: 'Red tips on its feelers!', power: 'The most common look' },
  clear: { name: 'Glassy copepod', short: 'Glassy', latin: 'Calanus finmarchicus (pale)',
    body: '#e8f2f4', edge: '#a8c8d0', pig: '#e8a0a0', oil: '#f4d080', eye: '#b01818',
    blurb: 'Almost see-through, so a fish can hardly spot it. You can see its gut and its oil inside.',
    simple: 'See-through, like glass!', power: 'Hard to spot' },
  gold:  { name: 'Golden copepod', short: 'Golden', latin: 'Calanus finmarchicus (oily)',
    body: '#f6e6c0', edge: '#d8b070', pig: '#e06a2a', oil: '#ffb020', eye: '#c01010',
    blurb: 'A big oil sac shines gold through its glassy body: food for the long sleep.',
    simple: 'Its oil shines like gold!', power: 'Full of oil' },
  blue:  { name: 'Blue copepod', short: 'Blue', latin: 'like Anomalocera, a blue surface copepod',
    body: '#bcd8f4', edge: '#5a8ad0', pig: '#2a5ad8', oil: '#9ad0f0', eye: '#101850',
    blurb: 'Not every copepod is red: some that live near the surface are bright blue.',
    simple: 'Bright blue, like the sky!', power: 'Like a surface copepod' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy copepod', short: 'Boy', blurb: 'A boy follows a girl\'s scent trail through the dark water to find her.', simple: 'Follow her trail in the dark!' },
  girl: { name: 'Girl copepod', short: 'Girl', blurb: 'A girl eats the spring diatoms and lets dozens of eggs go into the sea, night after night.', simple: 'She lays eggs in the spring!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'nauplius', name: 'Nauplius', short: 'Nauplius' },
  { key: 'copepodite', name: 'Copepodite', short: 'Copepodite' },
  { key: 'stage5', name: 'Stage V', short: 'Stage V' },
  { key: 'sleep', name: 'The long sleep', short: 'Sleep' },
  { key: 'adult', name: 'Grown up', short: 'Adult' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* step: 0 egg · 1–6 nauplius I–VI · 7–11 copepodite I–V · 12 adult */
const STEP_NAME = ['Egg', 'Nauplius I', 'Nauplius II', 'Nauplius III', 'Nauplius IV', 'Nauplius V', 'Nauplius VI', 'Copepodite I', 'Copepodite II', 'Copepodite III', 'Copepodite IV', 'Stage V', 'Grown up'];

/* how much each step takes, per difficulty
   yolk:  seconds of swimming for nauplius I and II, which live on their yolk
   naup:  diatoms to moult from nauplius III, IV, V and VI
   cop:   food to moult from copepodite I, II, III and IV
   oil:   food a stage V needs to fill its oil sac · eggs: food a mother needs for her eggs
   risk:  how fast the "hidden" meter drops in the light · fish: herring come when you are seen
   lays:  good lays to let all the eggs go · jump: how long after a jump a fish still misses */
const DIFFICULTY = {
  easy:   { name: 'Little kid', yolk: 6, naup: [8, 10, 12, 14], cop: [12, 14, 16, 18], oil: 22, eggs: 16, risk: .5, fish: false, lays: 3, jump: 2.2, wide: .3 },
  normal: { name: 'Big kid',    yolk: 7, naup: [10, 13, 16, 19], cop: [14, 18, 22, 26], oil: 26, eggs: 20, risk: 1, fish: true, lays: 4, jump: 1.6, wide: .2 },
  hard:   { name: 'Scientist',  yolk: 8, naup: [12, 16, 20, 24], cop: [18, 24, 30, 36], oil: 34, eggs: 26, risk: 1.3, fish: true, lays: 5, jump: 1.2, wide: .14 }
};
/* the food a step needs (0 for steps that do not eat to grow) */
function stepNeed(D, step) {
  if (step >= 3 && step <= 6) return D.naup[step - 3];
  if (step >= 7 && step <= 10) return D.cop[step - 7];
  if (step === 11) return D.oil;
  return 0;
}
/* real body length in mm, from the step and how far through it you are */
const STEP_MM = [0.15, 0.2, 0.24, 0.3, 0.36, 0.44, 0.52, 0.7, 0.95, 1.3, 1.75, 2.3, 2.7, 2.9];
function copMM(step, frac) { step = clamp(step | 0, 0, 12); return lerp(STEP_MM[step], STEP_MM[step + 1], clamp(frac || 0, 0, 1) * .5); }
/* drawn radius in world units: small stages are drawn bigger than life (a nauplius would be a speck) */
function copR(step, frac) {
  const f = clamp(frac || 0, 0, 1) * .5;
  if (step <= 0) return 1.1;
  if (step <= 6) return 1.3 + (step - 1 + f) * .17;
  if (step <= 11) return 2.6 + (step - 7 + f) * .45;
  return 4.9;
}
/* how much daylight reaches a depth (1 at the top at noon, almost 0 in the dark) */
function lightAt(y, tod, cloud = 0) { return (1 - nightAmount(tod)) * Math.exp(-Math.max(0, y) / 150) * (1 - cloud * .35); }

const FACTS = {
  egg: { title: 'Let go in the sea', body: 'A Calanus mother does not keep her eggs. She lets them go into the sea, a few dozen at a time, often at night. Each egg is about 0.15 millimetres across, smaller than a grain of sand.', simple: 'Mum lets her eggs go in the sea. Each one is tinier than a grain of sand!', more: 'https://en.wikipedia.org/wiki/Calanus_finmarchicus' },
  hatch: { title: 'A nauplius hatches', body: 'In a day or two the egg hatches into a nauplius (say NOR-plee-us): a tiny round swimmer with three pairs of legs and one red eye.', simple: 'Out pops a nauplius: three pairs of legs and one red eye!', more: 'https://en.wikipedia.org/wiki/Nauplius_(larva)' },
  yolk: { title: 'Living on yolk', body: 'The first two nauplius stages of Calanus do not eat at all. They live on the yolk they hatched with. From the third stage on, they start eating tiny plants.', simple: 'The first two stages do not eat. They live on yolk!', more: 'https://en.wikipedia.org/wiki/Calanus_finmarchicus' },
  nauplius: { title: 'Six nauplius stages', body: 'A copepod is a nauplius for six stages. Each time it moults it gets a little bigger and grows new legs.', simple: 'It moults and grows new legs, again and again!', more: 'https://en.wikipedia.org/wiki/Nauplius_(larva)' },
  moult: { title: 'Moulting', body: 'A copepod wears its skeleton on the outside, like a suit of armour that cannot stretch. To grow, it climbs out of the old one. A Calanus moults eleven times in its life.', simple: 'It climbs out of its old skin to grow. Eleven times!', more: 'https://en.wikipedia.org/wiki/Ecdysis' },
  diatom: { title: 'Glass houses', body: 'Diatoms are tiny plants that live in little cases made of glass. Some float alone and some join up in chains. They are a copepod\'s favourite food.', simple: 'Diatoms are tiny plants in glass cases. Yum!', more: 'https://en.wikipedia.org/wiki/Diatom' },
  bloom: { title: 'The spring bloom', body: 'Every spring, when the days get longer, the Gulf of Maine turns green with a huge bloom of diatoms. Calanus lays its eggs so the babies hatch into this feast.', simple: 'In spring the sea turns green with diatoms. A feast!', more: 'https://en.wikipedia.org/wiki/Spring_bloom' },
  oxygen: { title: 'Plants of the sea', body: 'Tiny sea plants like diatoms make about half of all the oxygen made on Earth each year. Every other breath you take, thank the plankton!', simple: 'Tiny sea plants make half of the oxygen we breathe!', more: 'https://en.wikipedia.org/wiki/Phytoplankton' },
  feeding: { title: 'A current for food', body: 'A copepod waves its little mouth legs to make a current in the water. Diatoms are carried right to its mouth, and it picks the ones it wants.', simple: 'It waves its little legs to pull food in!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  copepod: { title: 'Oar-feet', body: 'Copepod means "oar-feet": copepods row through the water with their legs. They may be the most common animals on Earth.', simple: 'Copepod means oar-feet. There are more of them than almost any animal!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  copepodite: { title: 'The copepodite', body: 'After the sixth nauplius stage comes a big change. The copepodite has a long body and a tail, like a grown copepod. There are five copepodite stages before it is grown up.', simple: 'Now it has a long body and a tail!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  eye: { title: 'One red eye', body: 'A copepod has one simple eye in the middle of its head. It can not see shapes well, but it can tell light from dark. The copepod Cyclops is named after the one-eyed giant.', simple: 'One red eye that can tell light from dark!', more: 'https://en.wikipedia.org/wiki/Naupliar_eye' },
  antennae: { title: 'Hairy feelers', body: 'A copepod\'s long front feelers are covered in tiny hairs that feel the smallest movement in the water. They warn it when something big is coming.', simple: 'Its long feelers feel when something is coming!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  jump: { title: 'The great jump', body: 'When a copepod feels danger it kicks all its legs at once and jumps away. It can move hundreds of times its own length in one second: one of the fastest escapes of any animal.', simple: 'Kick! It jumps away super fast!', more: 'https://www.youtube.com/results?search_query=copepod+escape+jump+slow+motion' },
  updown: { title: 'Up at night, down by day', body: 'Every evening copepods swim up to the top to eat, and every morning they swim back down into the dark. It is the biggest daily journey of animals on Earth.', simple: 'Up at night to eat, down in the day to hide!', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  dark: { title: 'Hiding in the dark', body: 'Herring and other fish hunt by sight. Near the top, in the light, a copepod is easy to see. Down in the dim water it is hard to spot, so it waits there all day.', simple: 'Fish look with their eyes. In the dark, they can not see me!', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  moon: { title: 'Bright moon', body: 'On bright moonlit nights some copepods stay a little deeper, because moonlight can make them easier to see.', simple: 'On a bright moon night, they stay a bit deeper.', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  glow: { title: 'Sparkling sea', body: 'Some tiny plankton called dinoflagellates flash blue when something bumps them. Scientists think it may work like a burglar alarm, making whatever bumped them easy to see.', simple: 'Some plankton flash blue when you bump them!', more: 'https://en.wikipedia.org/wiki/Bioluminescence' },
  metridia: { title: 'A glowing copepod', body: 'One copepod in the Gulf of Maine, Metridia lucens, can glow too: it puffs out a little cloud of blue light to surprise a hunter.', simple: 'One copepod can puff out blue light!', more: 'https://en.wikipedia.org/wiki/Metridia_lucens' },
  herring: { title: 'Herring', body: 'Atlantic herring swim in huge silver schools and eat plankton, especially copepods. That is why copepods hide in the dark by day.', simple: 'Silver fish that look for plankton. Jump away!', more: 'https://en.wikipedia.org/wiki/Atlantic_herring' },
  combjelly: { title: 'Comb jellies', body: 'A comb jelly is a see-through blob with eight rows of tiny beating hairs that shimmer like a rainbow. It has no sting, but it eats tiny drifting animals, so a copepod keeps away.', simple: 'A see-through blob with rainbow lights. Keep away!', more: 'https://en.wikipedia.org/wiki/Ctenophora' },
  basking: { title: 'The basking shark', body: 'The basking shark is the second biggest fish in the world, as long as a bus. It has no big teeth: it swims slowly with its huge mouth open, straining plankton from the water. Basking sharks visit the Gulf of Maine in summer.', simple: 'The second biggest fish in the world! It eats tiny plankton.', more: 'https://en.wikipedia.org/wiki/Basking_shark' },
  rightwhale: { title: 'The right whale', body: 'The North Atlantic right whale is one of the rarest whales on Earth, with only a few hundred left. Its main food is Calanus: it swims with its mouth open through thick clouds of copepods.', simple: 'A rare, huge whale. Its food is tiny copepods!', more: 'https://en.wikipedia.org/wiki/North_Atlantic_right_whale' },
  baleen: { title: 'Baleen', body: 'Instead of teeth, a right whale has baleen: long plates made of the same stuff as your fingernails. They hang in its mouth like a giant comb and strain copepods from the water.', simple: 'Instead of teeth, a giant comb!', more: 'https://en.wikipedia.org/wiki/Baleen' },
  whalefood: { title: 'Millions for lunch', body: 'A right whale needs millions of copepods every day, so it looks for the thickest clouds of them. Copepods are big food for big animals.', simple: 'A whale needs millions of copepods a day!', more: 'https://en.wikipedia.org/wiki/North_Atlantic_right_whale' },
  oil: { title: 'The oil sac', body: 'A stage V copepod stores fat in a long oil sac inside its body. When it is full, the oil can fill much of its body. It is the fuel for its long sleep.', simple: 'It fills up with oil, like a lunch box for its long sleep!', more: 'https://en.wikipedia.org/wiki/Calanus_finmarchicus' },
  omega: { title: 'Healthy oil', body: 'The oil copepods make is rich in omega-3 fats. Herring and other fish get their healthy oils by eating plankton like copepods.', simple: 'Copepod oil is the healthy oil in fish!', more: 'https://en.wikipedia.org/wiki/Omega-3_fatty_acid' },
  diapause: { title: 'The long sleep', body: 'In summer the fat stage V copepods sink into the deep and rest for months. This rest is called diapause. They hardly move and do not eat until winter.', simple: 'It sleeps in the deep for months!', more: 'https://en.wikipedia.org/wiki/Diapause' },
  deepcold: { title: 'Cold and dark', body: 'Deep down the water is cold, dark and still. A sleeping copepod burns its oil very slowly there, and fewer hunters find it.', simple: 'Deep down it is cold and dark. A good place to sleep.', more: 'https://en.wikipedia.org/wiki/Gulf_of_Maine' },
  snow: { title: 'Marine snow', body: 'Marine snow is bits of old plankton, droppings and dust sinking slowly down, all year round. In the deep it looks like a snowstorm.', simple: 'Little bits sink down like snow, all year!', more: 'https://en.wikipedia.org/wiki/Marine_snow' },
  poop: { title: 'Sinking droppings', body: 'Copepod droppings are tiny pellets that sink fast into the deep. They carry carbon down with them, which helps the ocean store carbon.', simple: 'Copepod poops sink down and help the sea!', more: 'https://en.wikipedia.org/wiki/Biological_pump' },
  wake: { title: 'Wake up!', body: 'In winter the sleeping copepods wake, moult into grown-ups and swim back up to the top, just in time for the spring bloom.', simple: 'In winter they wake up and swim back up!', more: 'https://en.wikipedia.org/wiki/Calanus_finmarchicus' },
  boygirl: { title: 'Boys and girls', body: 'Grown-up boy and girl copepods look a little different. A boy has longer, hairier feelers and a special back leg that helps him pair up with a girl.', simple: 'Boys have special feelers and a special leg.', more: 'https://en.wikipedia.org/wiki/Copepod' },
  trail: { title: 'A scent trail', body: 'In many copepods a girl leaves a trail of scent in the water as she swims. A boy smells it with his feelers and follows it, zig-zag, to find her.', simple: 'He smells her trail and follows it!', more: 'https://www.youtube.com/results?search_query=copepod+mate+tracking+pheromone+trail' },
  eggs: { title: 'Dozens a night', body: 'A girl Calanus can lay dozens of eggs a day, and many hundreds in her life, if she has plenty of diatoms to eat.', simple: 'She can lay dozens of eggs a night!', more: 'https://en.wikipedia.org/wiki/Calanus_finmarchicus' },
  foodweb: { title: 'The food web', body: 'Copepods are a key link in the sea: they eat tiny plants, and fish, seabirds and whales eat them. Without copepods, much of the sea would go hungry.', simple: 'Copepods eat tiny plants, and big animals eat copepods!', more: 'https://en.wikipedia.org/wiki/Marine_food_web' },
  size: { title: 'Small and big', body: 'A Calanus egg is about 0.15 millimetres across. A grown-up is about 3 millimetres long, a bit smaller than a grain of rice: about twenty times longer than the egg.', simple: 'Grown-ups are about as long as a grain of rice is wide.', more: 'https://en.wikipedia.org/wiki/Calanus_finmarchicus' },
  red: { title: 'Why red?', body: 'Many copepods look red or orange. The colour comes from their food: they turn a yellow pigment from diatoms into a red one called astaxanthin, the same colour that makes salmon pink.', simple: 'The red comes from their food. It makes salmon pink too!', more: 'https://en.wikipedia.org/wiki/Astaxanthin' },
  clear: { title: 'See-through', body: 'Most of a copepod is see-through, which makes it hard to spot in the water. You can see its gut and its oil sac inside.', simple: 'You can see right through it!', more: 'https://en.wikipedia.org/wiki/Transparency_and_translucency' },
  blue: { title: 'Blue copepods', body: 'Some copepods that live right at the surface are bright blue. Scientists think the colour may help hide them or shade them from strong sunlight.', simple: 'Some surface copepods are bright blue!', more: 'https://en.wikipedia.org/wiki/Pontellidae' },
  gulf: { title: 'The Gulf of Maine', body: 'The Gulf of Maine is the cold, rich sea between Cape Cod and Nova Scotia. Its deep basins are where Calanus sleeps through autumn.', simple: 'A cold sea full of copepods, off the coast of Maine.', more: 'https://en.wikipedia.org/wiki/Gulf_of_Maine' },
  scientists: { title: 'Counting copepods', body: 'Scientists catch copepods in very fine nets and count them under a microscope, to see how well the sea is doing and where the whales will find food.', simple: 'Scientists count copepods with a microscope.', more: 'https://en.wikipedia.org/wiki/Plankton_net' },
  legs: { title: 'Swimming legs', body: 'Under its body a copepod has pairs of flat swimming legs, fringed with hairs. They beat together like the oars of a rowing boat.', simple: 'Its legs beat together like oars!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  lifecycle: { title: 'The whole life cycle', body: 'Egg, six nauplius stages, five copepodite stages, the long sleep, then a grown-up, and eggs again. In the Gulf of Maine most Calanus live about a year.', simple: 'Egg, nauplius, copepodite, sleep, grown-up… then eggs again!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are a tiny copepod egg, drifting in the spring sea…', 'I am an egg. Wait…'],
  hatch: ['Something is wiggling inside! Push the arrows to hatch.', 'Wiggle! Hatch out!'],
  yolk: ['You are a nauplius! You live on your yolk for now. Swim with the arrows.', 'Swim! I live on my yolk.'],
  tight: ['Your skin is too tight! Press Space to moult.', 'Too tight! Press Space!'],
  bigger: ['Out of the old skin, and bigger!', 'I am bigger!'],
  eat: ['Now you can eat! Bump into the green diatoms.', 'Eat the green dots!'],
  more: ['Keep eating diatoms to grow.', 'Eat more!'],
  night: ['Night! The fish can not see. Swim up to the top to eat.', 'Night! Swim up and eat.'],
  day: ['Morning! Swim down into the dark, where fish can not see you.', 'Day! Swim down to the dark.'],
  seen: ['Too bright up here! Fish can see you. Swim down!', 'Too bright! Go down!'],
  hidden: ['Safe in the dim water.', 'I am safe down here.'],
  daywait: ['Wait in the dark until night. Press F to hurry the time.', 'Wait for night, or press F.'],
  herring: ['Herring! Press E to jump away!', 'Fish! Press E to jump!'],
  dodged: ['Kick! You jumped away. It missed!', 'Jump! It missed me!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  jump: ['Press E to kick all your legs and jump!', 'Press E to jump!'],
  jelly: ['A comb jelly! Keep away from its shimmering blob.', 'A jelly! Keep away!'],
  basking: ['A basking shark is straining plankton! Swim away from its huge mouth.', 'A big shark! Swim away!'],
  whale: ['A right whale! Its mouth is open. Press E to jump out of the way!', 'A whale! Press E to jump!'],
  whalemiss: ['The whale swam by. You jumped out just in time!', 'The whale missed me!'],
  glow: ['You bumped a dinoflagellate and it flashed blue!', 'It glows blue!'],
  copepodite: ['You look like a copepod now: a long body and a tail!', 'I look like a copepod!'],
  oil: ['Stage V! Eat to fill your oil sac for the long sleep.', 'Eat! Fill my oil sac.'],
  oilfull: ['Your oil sac is full! Swim down, down, down to the deep.', 'Full! Swim down deep.'],
  sleepnow: ['The deep! Press Space to go to sleep.', 'Press Space to sleep.'],
  sleep: ['Sleeping in the deep… months go by.', 'Sleep…'],
  wake: ['Winter! Wake up. Press Space to moult into a grown-up.', 'Wake up! Press Space.'],
  adult: ['You are grown up!', 'I am grown up!'],
  trail: ['A girl left a scent trail! Follow the pink sparkles.', 'Follow the pink trail!'],
  wait: ['Swim about. A boy will smell your trail and find you.', 'Swim. A boy will find me.'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  met: ['You found each other!', 'We met!'],
  rise: ['Spring is coming! Swim up to the top, to the bloom.', 'Swim up to the top!'],
  eggfood: ['Eat lots of diatoms to make your eggs.', 'Eat to make eggs!'],
  ready: ['Your eggs are ready! Press Space to lay them.', 'Press Space to lay eggs!'],
  lay: ['When the ring turns green, press Space to let a clutch of eggs go!', 'Green? Press Space!'],
  laid: ['Your eggs drift in the sea. Soon they will hatch!', 'My eggs drift away!'],
  nextspring: ['The next spring: her eggs drift in the green sea!', 'Her eggs drift in the sea!'],
  done: ['Your job is done. Rest in the sea.', 'All done. Rest!'],
  tooFar: ['The sea goes on and on. Turn back.', 'Turn back!'],
  snow: ['Marine snow is falling into the deep.', 'Look! Sea snow.'],
  friends: ['Lots of other copepods are swimming with you.', 'Lots of copepods!']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* the tide: two highs a day (−1 low … 1 high); offshore it only lifts the sea a little */
function tideAt(tod) { return Math.cos((tod - .21) * TAU * 2); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
/* the seasons of the Gulf of Maine, for the HUD: [label, surface temperature °C] */
const SEASON_INFO = { spring: ['🌱 Spring', 6], summer: ['☀️ Summer', 15], autumn: ['🍂 Autumn', 11], winter: ['❄️ Winter', 4] };
