/* ============================================================
   facts.js — the sea stars, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the ochre sea star
   (Pisaster ochraceus) on the rocky outer coast of Washington
   (the Olympic coast), simplified for play.  Each fact has a full
   version, a "little words" version and a link to see the real
   thing (a Wikipedia page or a YouTube search, never a guessed
   video URL).
   ============================================================ */
'use strict';

/* Five looks of an ochre sea star.  The same kind of star comes in purple, orange,
   ochre yellow, brick red and brown; nobody is quite sure why.
   top / top2 = the upper side light and dark, under = the tube-foot side,
   spines = the little white spines in a net pattern, feet = tube feet, eye = the arm-tip eyespot */
const FORMS = {
  normal: { name: 'Purple star', short: 'Purple', latin: 'Pisaster ochraceus',
    top: '#8a3f9c', top2: '#4a1a5c', under: '#e8b88a', spines: '#f2e6f4', feet: '#f4c890', eye: '#ff5a3a',
    blurb: 'Most ochre stars on the outer coast are a deep purple, dotted with little white spines in a net pattern.',
    simple: 'Purple, with white dots!', power: 'The most common look' },
  orange: { name: 'Orange star', short: 'Orange', latin: 'Pisaster ochraceus (orange)',
    top: '#e8742a', top2: '#9a3a10', under: '#f4cc98', spines: '#fff0d8', feet: '#f8d8a8', eye: '#c81e10',
    blurb: 'About one ochre star in ten or so is bright orange. On the same rock you can find purple and orange side by side.',
    simple: 'Bright orange!', power: 'Easy to spot' },
  ochre: { name: 'Ochre star', short: 'Ochre', latin: 'Pisaster ochraceus (yellow)',
    top: '#d8a030', top2: '#8a5a10', under: '#f4dca8', spines: '#fff6dc', feet: '#f8e0b0', eye: '#c82a10',
    blurb: 'Ochre is a yellow-brown earth colour. The ochre star got its name from stars this colour.',
    simple: 'Yellow-brown, like ochre!', power: 'The star\'s own name' },
  brick: { name: 'Brick star', short: 'Brick', latin: 'Pisaster ochraceus (red)',
    top: '#b8382c', top2: '#6a1410', under: '#eeb898', spines: '#ffe4dc', feet: '#f4c4a8', eye: '#ffd040',
    blurb: 'Some ochre stars are a deep brick red, like a red rock in the sun.',
    simple: 'Deep brick red!', power: 'Red like a rock' },
  brown: { name: 'Brown star', short: 'Brown', latin: 'Pisaster ochraceus (brown)',
    top: '#7a5434', top2: '#3e2814', under: '#e0c098', spines: '#f4e8d8', feet: '#ecd0a8', eye: '#ff6a3a',
    blurb: 'A brown ochre star is hard to see on dark rock and mussel shells.',
    simple: 'Brown, like the rocks!', power: 'Hides on dark rock' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy: { name: 'Boy sea star', short: 'Boy', blurb: 'A boy grows big on the mussel bed. In spring he climbs up high on his arm tips and lets a milky cloud go into the sea, beside the girls.', simple: 'Stand tall and let a milky cloud go!' },
  girl: { name: 'Girl sea star', short: 'Girl', blurb: 'A girl grows big on the mussel bed. In spring she climbs up high on her arm tips and lets her eggs go into the sea: millions of them.', simple: 'Stand tall and let millions of eggs go!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'larva', name: 'Swimming larva', short: 'Larva' },
  { key: 'postlarva', name: 'Settler', short: 'Settler' },
  { key: 'juvenile', name: 'Tiny star', short: 'Tiny' },
  { key: 'young', name: 'Young star', short: 'Young' },
  { key: 'adult', name: 'Big sea star', short: 'Big' },
  { key: 'spawn', name: 'Spring', short: 'Spring' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much food each step takes, per difficulty
   larva: plankton to grow a bigger larva, a sticky-armed larva, then to settle
   grow:  food on the rocks to grow (a rest in a pool or a crack) into a young star, a bigger one, then a big one
   dry:   how fast a star out of the water dries (a tide pool or wet seaweed stops it)
   risk:  how easily a wave, a gull or an otter knocks you off (holding tight stops it)
   keystone: mussels a big star eats before the shore fills with new life
   kid:   the tidepool visitor comes (once) · blows: good pushes to let the eggs go
   storm: waves to hold on through in the winter storm */
const DIFFICULTY = {
  easy:   { name: 'Little kid', larva: [20, 46, 80], grow: [24, 90, 200], dry: .6, risk: .6, keystone: 4, kid: true, blows: 3, storm: 3 },
  normal: { name: 'Big kid',    larva: [30, 70, 120], grow: [36, 140, 300], dry: 1, risk: 1, keystone: 6, kid: true, blows: 4, storm: 4 },
  hard:   { name: 'Scientist',  larva: [40, 90, 150], grow: [46, 170, 360], dry: 1.3, risk: 1.25, keystone: 8, kid: true, blows: 5, storm: 5 }
};
const BONUS = 1.5;      /* a big star may keep eating to 150 % of the last threshold: a bigger star */

/* how wide a sea star is, arm tip to arm tip, in cm, from its growth step and its food.
   It settles less than a millimetre across and grows to about 25 cm (big ones 50 cm). */
function starCM(instar, food, th) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  if (instar <= 1) return lerp(.1, 1, t(0, th[0]));
  if (instar === 2) return lerp(1.2, 5, t(th[0], th[1]));
  if (instar === 3) return lerp(5.5, 14, t(th[1], th[2]));
  return lerp(16, 30, t(th[2], th[2] * BONUS));
}
/* the drawn width in world units (stylised: tiny stars are drawn far bigger than life so a
   child can see the five arms; a big one is drawn big so the growth is felt) */
function starUnits(cm) { return 12 + cm * 2; }
/* a rough weight in grams for a width in cm (a 25 cm star is about half a kilo) */
function starGrams(cm) { return .035 * cm * cm * cm; }
/* the world's scale: 30 units = 1 m */
const UNITS_PER_M = 30;

const W_ = 'https://en.wikipedia.org/wiki/', Y_ = 'https://www.youtube.com/results?search_query=';
const FACTS = {
  egg: { title: 'Millions of eggs', body: 'A big girl ochre star can let tens of millions of eggs go in one spring. The eggs float away in the sea, each smaller than a grain of sand.', simple: 'One mum lets millions of eggs go!', more: W_ + 'Pisaster_ochraceus' },
  drift: { title: 'Drifting free', body: 'Sea stars do not build nests or look after their eggs. The eggs drift away on the tide, out into the open sea with the plankton.', simple: 'The eggs float away in the sea.', more: W_ + 'Pisaster_ochraceus' },
  hatch: { title: 'A swimming larva', body: 'A baby sea star looks nothing like a star. It is a see-through larva that swims with bands of tiny beating hairs.', simple: 'A baby sea star does not look like a star!', more: W_ + 'Starfish#Larval_development' },
  bipinnaria: { title: 'Bipinnaria', body: 'The first larva is called a bipinnaria. It has two bands of tiny hairs that beat to swim and to sweep food into its mouth.', simple: 'Tiny hairs beat to swim and eat!', more: Y_ + 'sea+star+bipinnaria+larva' },
  plankton: { title: 'Plankton', body: 'Plankton are the tiny living things that drift in the sea. A sea star larva eats tiny plants of the sea: diatoms and other algae cells.', simple: 'Tiny drifting things. Yum!', more: W_ + 'Plankton' },
  diatom: { title: 'Diatoms', body: 'Diatoms are tiny one-celled plants that live in glass shells. They make much of the air we breathe!', simple: 'Tiny plants in glass shells!', more: W_ + 'Diatom' },
  updown: { title: 'Up at night, down by day', body: 'Every night, plankton all over the world rise towards the surface, and every morning they sink back down where it is darker.', simple: 'Plankton go up at night and down in the day!', more: W_ + 'Diel_vertical_migration' },
  glow: { title: 'Glowing sea', body: 'Some plankton flash blue light when something bumps them. On dark nights the sea can sparkle with it. This is called bioluminescence.', simple: 'Some plankton glow blue when you bump them!', more: W_ + 'Bioluminescence' },
  weeks: { title: 'Weeks at sea', body: 'An ochre star larva drifts and swims in the open sea for weeks, maybe two months or more, before it is ready to settle.', simple: 'The baby swims in the sea for weeks!', more: W_ + 'Pisaster_ochraceus' },
  herring: { title: 'Pacific herring', body: 'Herring swim in huge silver schools and eat plankton. A tiny larva gets tumbled about, but the herring never notice it.', simple: 'Silver fish in a big school!', more: W_ + 'Pacific_herring' },
  combjelly: { title: 'Comb jellies', body: 'A comb jelly is a see-through blob with eight rows of tiny beating hairs that shimmer like a rainbow. It eats tiny drifters, so a larva keeps away.', simple: 'A see-through blob with rainbow lights!', more: W_ + 'Ctenophora' },
  whale: { title: 'Grey whales', body: 'Grey whales swim past the Washington coast every spring on their way north. Some stay all summer to feed.', simple: 'A huge whale swims by!', more: W_ + 'Gray_whale' },
  gull: { title: 'Glaucous-winged gulls', body: 'Glaucous-winged gulls patrol the shore at low tide. They will snap up a small sea star if they can pull it off the rock.', simple: 'A gull looks for food at low tide.', more: W_ + 'Glaucous-winged_gull' },
  brachiolaria: { title: 'Sticky arms', body: 'The older larva, the brachiolaria, grows three little sticky arms at the front. It uses them to hold on when it touches down on a rock.', simple: 'Three sticky arms to hold on!', more: W_ + 'Starfish#Larval_development' },
  settle: { title: 'Choosing a rock', body: 'A larva ready to settle sinks down and feels the rocks. It likes a rock covered in pink crust, a seaweed called coralline algae.', simple: 'The baby looks for a good pink rock.', more: W_ + 'Coralline_algae' },
  change: { title: 'A star inside', body: 'Once it holds on, the larva changes completely. A tiny five-armed star grows inside it, and the rest of the larva is used up.', simple: 'A tiny star grows inside the baby!', more: Y_ + 'sea+star+larva+metamorphosis' },
  tiny: { title: 'Smaller than a pinhead', body: 'A brand-new sea star is less than a millimetre across. It hides in cracks and under rocks while it grows.', simple: 'A new sea star is tiny, tiny!', more: W_ + 'Pisaster_ochraceus' },
  tubefeet: { title: 'Hundreds of tube feet', body: 'Under each arm are rows of tube feet: soft little tubes with suckers. A sea star walks on hundreds of them at once.', simple: 'Hundreds of tiny feet with suckers!', more: W_ + 'Tube_feet' },
  water: { title: 'Water power', body: 'A sea star pumps sea water through tubes inside its body to work its tube feet. It sucks the water in through a little sieve plate on its back.', simple: 'Its feet work with water!', more: W_ + 'Water_vascular_system' },
  barnacle: { title: 'Barnacles', body: 'A barnacle is a little animal in a shell glued to the rock, head down, kicking food into its mouth with its feathery legs. Young sea stars eat them.', simple: 'A tiny animal in a shell on the rock!', more: W_ + 'Barnacle' },
  limpet: { title: 'Limpets', body: 'A limpet is a snail with a hat-shaped shell. It clamps down tight on the rock when the tide goes out.', simple: 'A snail with a hat!', more: W_ + 'Limpet' },
  snail: { title: 'Turban snails', body: 'The black turban snail grazes seaweed on the rocks. When it smells a sea star coming, it lets go and tumbles away!', simple: 'A snail that tumbles away!', more: W_ + 'Tegula_funebralis' },
  chiton: { title: 'Chitons', body: 'A chiton has eight shell plates on its back, like a little suit of armour. It can roll up like a pill bug.', simple: 'Eight plates, like armour!', more: W_ + 'Chiton' },
  mussel: { title: 'California mussels', body: 'California mussels grow in huge beds on the rocks, packed tight. They are the ochre star\'s favourite food.', simple: 'Mussels! The sea star\'s best food.', more: W_ + 'Mytilus_californianus' },
  stomach: { title: 'A stomach outside!', body: 'A sea star pulls a mussel\'s shell open just a tiny crack with its tube feet. Then it pushes its own stomach out of its mouth, into the shell, and eats the mussel right there.', simple: 'It pushes its tummy out to eat!', more: Y_ + 'sea+star+eating+mussel' },
  pull: { title: 'Patient pulling', body: 'A mussel holds its shell shut tight, but a sea star pulls and pulls with hundreds of tube feet. In the end the mussel gets tired first.', simple: 'Pull, pull, pull! The mussel gets tired.', more: W_ + 'Pisaster_ochraceus' },
  tide: { title: 'The tide', body: 'Twice a day the sea rises up the shore and falls back down again. These are the tides, pulled by the moon.', simple: 'The sea goes up and down twice a day.', more: W_ + 'Tide' },
  hightide: { title: 'Eating at high tide', body: 'Ochre stars do most of their eating when the tide is in. Under water they can crawl up into the mussel bed.', simple: 'Sea stars eat when the sea is in.', more: W_ + 'Pisaster_ochraceus' },
  lowtide: { title: 'Low tide', body: 'When the tide goes out, a sea star on the rocks is in the air. It holds on, holds its water in, and waits for the sea to come back.', simple: 'When the sea goes out, hold on and wait.', more: W_ + 'Intertidal_zone' },
  pool: { title: 'Tide pools', body: 'Tide pools are dips in the rock that stay full of sea water when the tide goes out. They are little worlds of their own.', simple: 'Pools of sea left on the rocks!', more: W_ + 'Tide_pool' },
  dry: { title: 'Drying out', body: 'In the sun and wind a sea star slowly dries. Ochre stars can stand hours in the air, but a cool pool or wet seaweed helps.', simple: 'The sun and wind dry a sea star out.', more: W_ + 'Pisaster_ochraceus' },
  rockweed: { title: 'Rockweed', body: 'Rockweed is a brown seaweed with little air bubbles that floats when the tide is in and lies over the rocks like a wet blanket when it is out.', simple: 'A wet seaweed blanket!', more: W_ + 'Fucus' },
  hold: { title: 'Holding on', body: 'Waves crash on the outer coast all year. A sea star holds the rock so tight with its tube feet that a person can hardly pull it off.', simple: 'It holds on so tight!', more: W_ + 'Pisaster_ochraceus' },
  waves: { title: 'Big waves', body: 'The outer coast faces the open Pacific. Waves there can hit the rocks harder than a hurricane wind.', simple: 'The waves crash hard!', more: W_ + 'Wind_wave' },
  otter: { title: 'Sea otters', body: 'Sea otters live along the Olympic coast again. They float on their backs and eat urchins, crabs and clams, and now and then a sea star.', simple: 'An otter floats on its back!', more: W_ + 'Sea_otter' },
  sunflower: { title: 'The sunflower star', body: 'The sunflower star is a huge, fast sea star with up to 24 arms. Other sea stars and snails run away when they smell it coming!', simple: 'A huge fast star with lots of arms!', more: W_ + 'Sunflower_sea_star' },
  run: { title: 'Run away!', body: 'When an ochre star smells a sunflower star, it hurries away as fast as its tube feet can carry it.', simple: 'Hurry away from the big star!', more: Y_ + 'sunflower+star+chase' },
  crab: { title: 'Red rock crabs', body: 'Red rock crabs hide under rocks and come out at high tide to look for food.', simple: 'A red crab with big claws!', more: W_ + 'Cancer_productus' },
  anemone: { title: 'Sea anemones', body: 'The giant green anemone is an animal, not a flower. It waits with its tentacles open for food to wash in.', simple: 'It looks like a flower, but it is an animal!', more: W_ + 'Anthopleura_xanthogrammica' },
  urchin: { title: 'Sea urchins', body: 'A purple sea urchin is a cousin of the sea star, covered in spines. It eats kelp.', simple: 'A spiky cousin of the sea star!', more: W_ + 'Strongylocentrotus_purpuratus' },
  cousins: { title: 'Star cousins', body: 'Sea stars, sea urchins, sand dollars and sea cucumbers are all cousins: echinoderms, which means spiny skin.', simple: 'Spiny skin cousins!', more: W_ + 'Echinoderm' },
  notfish: { title: 'Not a fish!', body: 'A starfish is not a fish at all. That is why many people call it a sea star.', simple: 'A starfish is not a fish!', more: W_ + 'Starfish' },
  noblood: { title: 'No blood, no brain', body: 'A sea star has no blood and no brain. Sea water does the work of blood, and a ring of nerves runs round its mouth and down each arm.', simple: 'No blood and no brain!', more: W_ + 'Starfish' },
  eyes: { title: 'Eyes on its arms', body: 'At the tip of each arm is a tiny red eyespot. It sees light and dark and big shapes, like the rocks.', simple: 'It has an eye at the end of each arm!', more: W_ + 'Starfish#Sensory_systems' },
  spines: { title: 'Spines in a net', body: 'The ochre star\'s back is covered with little white spines in a net pattern. The rough skin is tough and hard to bite.', simple: 'White spines in a net on its back!', more: W_ + 'Pisaster_ochraceus' },
  colour: { title: 'Purple or orange?', body: 'Ochre stars can be purple, orange, yellow, red or brown. Nobody is sure why. On the outer coast most are purple.', simple: 'Purple, orange, yellow, red or brown!', more: W_ + 'Pisaster_ochraceus' },
  regrow: { title: 'Growing back', body: 'A sea star can let an arm tip go if it is stuck, and grow a new one. It takes many months.', simple: 'It can grow a new arm!', more: W_ + 'Starfish#Regeneration' },
  keystone: { title: 'The keystone', body: 'In the 1960s a scientist, Robert Paine, took the ochre stars off one stretch of Washington shore. The mussels took over and the other animals were crowded out. With the stars there, there is room for everyone.', simple: 'Sea stars make room for everyone!', more: W_ + 'Keystone_species' },
  room: { title: 'Room for everyone', body: 'Where a sea star eats the mussels, bare rock opens up. Barnacles, seaweed, anemones, limpets and chitons move in.', simple: 'Bare rock means room for new life!', more: W_ + 'Keystone_species' },
  kids: { title: 'Look with your eyes', body: 'Tide-poolers look closely, touch gently with one finger, and put every rock and every animal back just where they found it.', simple: 'Look gently and put it back!', more: W_ + 'Tide_pool' },
  scientist: { title: 'Counting sea stars', body: 'Scientists and volunteers count and measure sea stars on the same shores every year, to check how they are doing.', simple: 'Scientists count the sea stars.', more: W_ + 'Pisaster_ochraceus' },
  winter: { title: 'Winter storms', body: 'Winter brings the biggest storms. Ochre stars eat less in winter and hold on tight to the rock.', simple: 'Winter storms! Hold on tight.', more: W_ + 'Pisaster_ochraceus' },
  old: { title: 'A long life', body: 'Ochre stars can live twenty years or more, maybe much longer.', simple: 'A sea star may live twenty years!', more: W_ + 'Pisaster_ochraceus' },
  spring: { title: 'Spring spawning', body: 'In spring, when the sea warms and the plankton bloom, the ochre stars let their eggs and milky clouds go.', simple: 'In spring the sea stars have babies.', more: W_ + 'Pisaster_ochraceus' },
  arch: { title: 'Standing tall', body: 'To spawn, a sea star lifts its middle up high on its arm tips, so the eggs or the cloud float off into the water.', simple: 'It stands up tall on its arms!', more: Y_ + 'sea+star+spawning' },
  spawn: { title: 'Eggs and a little cloud', body: 'A girl sea star lets her eggs go into the water, and a boy lets a milky cloud go. When the cloud meets the eggs, babies start to grow inside them.', simple: 'The eggs and the cloud meet in the sea.', more: W_ + 'Spawn_(biology)' },
  babies: { title: 'Millions of babies', body: 'Out of millions of eggs only a few grow up. Each of those can let millions of eggs go of its own.', simple: 'Millions of eggs float away!', more: W_ + 'Pisaster_ochraceus' },
  moon: { title: 'Moon and tide', body: 'The moon pulls the sea into tides. At full moon and new moon the tides are biggest: the lowest low tides, the best for tide-pooling.', simple: 'The moon moves the tides.', more: W_ + 'Tide' },
  olympic: { title: 'The Olympic coast', body: 'The outer coast of Washington has rocky shores, sea stacks, kelp forests and some of the richest tide pools in the world.', simple: 'A wild rocky coast in Washington.', more: W_ + 'Olympic_Coast_National_Marine_Sanctuary' },
  lifecycle: { title: 'The whole life cycle', body: 'Egg, swimming larva, a larva with sticky arms, a tiny star in a crack, a young star, a big star on the mussel bed, spring, and then eggs again.', simple: 'Egg, larva, tiny star, big star… then eggs again!', more: W_ + 'Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are one of millions of tiny eggs drifting out on the spring tide…', 'I am an egg in the sea. Wait…'],
  hatch: ['Your egg is ready! Wiggle with the arrows to hatch.', 'Wiggle! Hatch out!'],
  swim: ['You hatched! You are a swimming larva. Swim with the arrows and bump into the little green plants to eat them.', 'Swim! Eat the little plants.'],
  grow: ['You grew!', 'I grew!'],
  bigger: ['Bigger! Keep eating.', 'Eat more! Get big!'],
  night: ['Night: the plankton rise to the top. Swim up to eat.', 'Night! Food is at the top.'],
  day: ['Day: the plankton sink a little. Look lower down.', 'Day! Food is down low.'],
  flick: ['Press E for a quick swim!', 'Press E to swim fast!'],
  herring: ['A school of herring! Press E to swim out of the way.', 'Fish! Swim away!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  jelly: ['A comb jelly! Keep away from it while you are tiny.', 'A jelly blob! Keep away!'],
  gull: ['A gull is dipping at the top! Swim down a little.', 'A bird! Go down!'],
  whale: ['A grey whale! Its wave will push you along.', 'A big whale!'],
  sticky: ['Three little sticky arms are growing. Soon you can hold on to a rock!', 'Sticky arms! I can hold on!'],
  postlarva: ['You are ready to settle! Swim to the rocky shore: follow the arrow.', 'Swim to the rocks!'],
  search: ['Look for a pink rock with nobody on it. Go down to it and press Space to hold on.', 'Find a pink rock. Press Space!'],
  taken: ['Mussels are packed in here. No room! Look for another pink rock.', 'No room! Find another rock.'],
  settle: ['A good pink rock! Press Space to hold on.', 'Press Space to hold on!'],
  juvenile: ['You are a tiny sea star! Crawl with the arrows and eat the baby barnacles. Press Space by one to eat.', 'I am a tiny star! Eat!'],
  eat: ['Something to eat! Press Space.', 'Press Space to eat!'],
  full: ['You are full! Go into a tide pool or a crack and press Space to rest and grow.', 'Full! Rest in a pool to grow.'],
  rest: ['Press Space to rest and grow.', 'Press Space to rest!'],
  resting: ['Resting… growing bigger…', 'Rest… grow…'],
  awake: ['You grew! Look how big you are now.', 'I grew big!'],
  young: ['You are a young sea star! When the tide is in, crawl up the rocks to find food.', 'Crawl up! Find food!'],
  tidein: ['The tide is coming in! Food is up on the rocks. Crawl up!', 'The sea is in! Go up!'],
  tideout: ['The tide is going out! Get into a tide pool, or under wet seaweed, before you dry.', 'The sea goes out! Find a pool!'],
  dry: ['You are drying out! Crawl into a tide pool. Follow the arrow.', 'Dry! Go to a pool!'],
  wet: ['Ahh, a cool pool. You are wet again.', 'Wet again! Ahh.'],
  curl: ['Too dry! You hold your water in and wait for a wave.', 'Too dry! Wait for a wave.'],
  splash: ['SPLASH! A wave washed over you. Wet again!', 'Splash! Wet again!'],
  toodry: ['The mussels are shut tight in the air. Wait for the tide to come in.', 'Wait for the sea!'],
  mussel: ['A mussel! Press Space to pull its shell open.', 'Press Space! Pull!'],
  pulling: ['Pull, pull, pull… the mussel is getting tired…', 'Pull, pull, pull…'],
  stomach: ['It opened! You push your stomach in to eat. Yum!', 'Yum! I ate it!'],
  hold: ['A big wave is coming! Press E to hold on tight.', 'A wave! Press E!'],
  held: ['You held on! The wave rolled right over you.', 'I held on!'],
  rolled: ['Whoosh! The wave rolled you off. Nothing is hurt.', 'Whoosh! I am OK!'],
  gulllow: ['A gull! Hold on tight with E, or get into a pool.', 'A gull! Press E!'],
  otter: ['A sea otter! Hold on tight with E.', 'An otter! Press E!'],
  sunflower: ['A sunflower star! It is big and fast. Crawl away!', 'A big star! Crawl away!'],
  escaped: ['It went the other way. You are safe.', 'Safe!'],
  crab: ['A red rock crab is looking around. Hold on tight with E.', 'A crab! Press E!'],
  dodged: ['It could not budge you. You held on tight!', 'I held on!'],
  kid: ['A child is tide-pooling! She looks gently and will put you back.', 'A child is looking at me!'],
  lifted: ['Lifted up to look at… gently, gently…', 'Up I go! Gently.'],
  putback: ['Put back right where she found you. Thank you!', 'Back in my pool!'],
  keystone: ['You ate lots of mussels. Look: bare rock, and new life moving in!', 'Look! Room for new life!'],
  adult: ['You are a big sea star! Eat mussels and make room on the shore for new life.', 'I am big! Eat mussels!'],
  scientist: ['A scientist is counting sea stars. Press Space to hold still.', 'Press Space! Hold still!'],
  counted: ['Counted and measured! Now the scientists know you are here.', 'I was counted!'],
  winter: ['Winter! Big storm waves are coming. Hold on with E each time a wave comes.', 'Winter waves! Press E!'],
  armtip: ['A wave wedged an arm tip under a rock, so you let it go. It does not hurt, and a new one grows.', 'My arm tip let go. It will grow back!'],
  regrown: ['Your arm has grown back!', 'My arm grew back!'],
  spring: ['Spring! The sea is warm and green. Other sea stars are gathering on the rocks.', 'Spring! Stars are here!'],
  findgirl: ['Crawl to the girl sea stars by the hearts.', 'Find the girls!'],
  findboy: ['Crawl to the boy sea stars by the hearts.', 'Find the boys!'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  arch: ['Stand tall! Press Space when the wave glows to let your eggs go.', 'Glow! Press Space!'],
  cloud: ['The girls are standing tall. Press Space to stand tall and let your cloud go.', 'Press Space! Let my cloud go!'],
  larvae: ['Millions of new eggs drift out on the tide. The cycle begins again!', 'New eggs in the sea!'],
  done: ['Your job is done. Rest on the rocks.', 'All done!'],
  stuck: ['That rock is too steep. Try another way.', 'Too steep! Go back.'],
  home: ['Find a tide pool or a crack to rest in. Follow the arrow.', 'Find a pool!'],
  storm: ['A storm! Hold on tight with E when a wave comes.', 'A storm! Press E!']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* the tide: two highs a day (−1 low … 1 high): high at midday and midnight, low just after sunrise and just before sunset */
function tideAt(tod) { return Math.cos((tod - .02) * TAU * 2); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
/* the seasons, for the HUD, and the sea temperature off the Olympic coast (°C) */
const SEASON_INFO = { spring: ['🌱 Spring', 10], summer: ['☀️ Summer', 13], autumn: ['🍂 Autumn', 12], winter: ['❄️ Winter', 8] };
