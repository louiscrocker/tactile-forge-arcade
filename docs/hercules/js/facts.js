/* ============================================================
   facts.js — the beetles, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history, simplified for play.
   Each fact has a full version, a "little words" version and a
   link to see the real thing (a Wikipedia page or a YouTube
   search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Four forms of the Hercules beetle (Dynastes hercules subspecies).
   wing  = elytra colour when dry, wet = when damp (they really change),
   spots = black spots on dry elytra, horn = how long the horns grow */
const FORMS = {
  hercules: { name: 'Island Hercules', short: 'Island', latin: 'Dynastes hercules hercules',
    wing: '#b8a24a', wing2: '#8e7a2a', wet: '#17140f', spots: true, horn: 1.12, body: '#141210',
    blurb: 'From the rainforest islands of Guadeloupe and Dominica. The biggest horns of all.',
    simple: 'From the islands. The biggest horns!', power: 'Longest horn' },
  lichyi: { name: 'Mountain Hercules', short: 'Mountain', latin: 'Dynastes hercules lichyi',
    wing: '#a9a77a', wing2: '#7e7c55', wet: '#1a1915', spots: false, horn: 1.0, body: '#18160f',
    blurb: 'From the misty cloud forests of the Andes. Pale, plain wing cases.',
    simple: 'From misty mountains. Pale wings.', power: 'Tough in the cold' },
  ecuatorianus: { name: 'Amazon Hercules', short: 'Amazon', latin: 'Dynastes hercules ecuatorianus',
    wing: '#c7a640', wing2: '#9a7c22', wet: '#15120c', spots: true, horn: .95, body: '#120f0b',
    blurb: 'From the lowland Amazon rainforest. Golden with bold black spots.',
    simple: 'From the Amazon. Gold with spots!', power: 'Fast grower' },
  septentrionalis: { name: 'Northern Hercules', short: 'Northern', latin: 'Dynastes hercules septentrionalis',
    wing: '#9aa05a', wing2: '#70763a', wet: '#141510', spots: true, horn: .98, body: '#141310',
    blurb: 'From the forests of Central America. Olive green, freckled with black.',
    simple: 'From Central America. Olive green!', power: 'Strong flyer' }
};
const FORM_KEYS = Object.keys(FORMS);

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'grub1', name: 'Little grub', short: 'Grub' },
  { key: 'grub2', name: 'Bigger grub', short: 'Big' },
  { key: 'grub3', name: 'Giant grub', short: 'Giant' },
  { key: 'pupa', name: 'Pupa', short: 'Pupa' },
  { key: 'beetle', name: 'Beetle', short: 'Beetle' },
  { key: 'champ', name: 'Champion', short: 'Champ' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much a grub must eat (food units) to reach each moult, per difficulty */
const DIFFICULTY = {
  easy:   { name: 'Little kid', molt2: 130, molt3: 420, full: 1050, chew: .9, rival: .55, coati: false, energy: .5, chamber: 4 },
  normal: { name: 'Big kid', molt2: 220, molt3: 700, full: 1800, chew: .7, rival: .8, coati: true, energy: 1, chamber: 6 },
  hard:   { name: 'Scientist', molt2: 280, molt3: 880, full: 2100, chew: .6, rival: 1.05, coati: true, energy: 1.3, chamber: 8 }
};

/* food units → grams of grub (a real final-instar Hercules grub can pass 100 g) */
function grubGrams(food, full) { return .05 + Math.pow(clamp(food / full, 0, BONUS), 1.35) * 85; }
const BONUS = 1.3;          /* a full-grown grub may keep eating up to 130 %: a bigger beetle, a longer horn */
/* grams of grub → the adult male's length in mm (horn included); real range ~50–175 mm */
function adultLength(grams, form) { return Math.round(clamp(50 + grams * (FORMS[form] || FORMS.hercules).horn, 50, 176)); }

const FACTS = {
  egg: { title: 'Laid in a rotting log', body: 'A mother Hercules beetle lays her eggs one by one in the soft, rotting wood of a fallen tree. The eggs are white and about the size of a pea.', simple: 'Mum lays her eggs in an old, soft log.', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  grub: { title: 'A grub, not a worm', body: 'A beetle baby is called a larva, or a grub. It is soft and white with a hard brown head, six little legs and strong jaws for chewing wood.', simple: 'A baby beetle is a grub. It has six little legs and strong jaws.', more: 'https://www.youtube.com/results?search_query=hercules+beetle+larva' },
  wood: { title: 'Eating wood', body: 'Wood is hard to digest. Grubs get help from tiny microbes living in their gut that break the wood down. The grub turns old wood into soil, so it is a forest recycler.', simple: 'Tiny helpers in the grub\'s tummy break the wood down.', more: 'https://en.wikipedia.org/wiki/Decomposer' },
  fungus: { title: 'Fungus makes wood tasty', body: 'White threads of fungus soften rotting wood and fill it with goodness. Grubs grow faster in wood that fungus has been working on.', simple: 'White fungus makes the wood soft and tasty.', more: 'https://en.wikipedia.org/wiki/Wood-decay_fungus' },
  molt: { title: 'Growing out of your skin', body: 'An insect\'s skin can\'t stretch forever. When it gets too tight, the grub splits it open and wriggles out in a new, bigger skin. This is called moulting. A Hercules grub moults twice.', simple: 'When the skin gets too tight, the grub wriggles out of it!', more: 'https://en.wikipedia.org/wiki/Ecdysis' },
  instar: { title: 'Three sizes of grub', body: 'Between moults a grub is called an instar. Hercules grubs have three: the first is tiny, the third is a giant that can weigh more than 100 grams, heavier than a mouse.', simple: 'The last grub is a giant. It can be heavier than a mouse!', more: 'https://en.wikipedia.org/wiki/Instar' },
  years: { title: 'Two years as a grub', body: 'In the wild a Hercules beetle spends up to two years as a grub, eating rotting wood all that time. In this game it is a lot quicker!', simple: 'A real grub eats wood for up to two years!', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  spiracles: { title: 'Breathing through holes', body: 'Insects have no nose. The little dots along a grub\'s sides are spiracles: holes that let air into tubes all through its body.', simple: 'The dots on its sides are holes for breathing!', more: 'https://en.wikipedia.org/wiki/Spiracle_(arthropods)' },
  horndepends: { title: 'Food makes the horn', body: 'How big a Hercules beetle grows is set while it is a grub. Once it is an adult it never grows again. A well-fed grub becomes a big beetle with a huge horn.', simple: 'The more the grub eats, the bigger the horn!', more: 'https://en.wikipedia.org/wiki/Rhinoceros_beetle' },
  chamber: { title: 'The pupal chamber', body: 'A full-grown grub digs down into the soil and presses the earth into a smooth, hollow room the shape of an egg. Inside it, the grub will change into a beetle.', simple: 'The grub makes a little room in the dirt to change in.', more: 'https://www.youtube.com/results?search_query=hercules+beetle+pupal+chamber' },
  pupa: { title: 'The pupa', body: 'A pupa looks still, but inside it the grub\'s body is being rebuilt into a beetle: legs, wings, eyes and horns. This is called complete metamorphosis.', simple: 'Inside the pupa, the grub turns into a beetle.', more: 'https://en.wikipedia.org/wiki/Holometabolism' },
  soft: { title: 'Soft and pale at first', body: 'A new beetle comes out of the pupa soft and pale. It waits in its chamber while its shell hardens and darkens, which can take days.', simple: 'A new beetle is soft. It waits to get hard.', more: 'https://en.wikipedia.org/wiki/Teneral' },
  horns: { title: 'Two horns', body: 'The long top horn grows from the beetle\'s thorax (its chest). The shorter bottom horn grows from its head. Together they work like pincers.', simple: 'The top horn is on its chest. The bottom horn is on its head.', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  longest: { title: 'One of the longest beetles', body: 'A big male Hercules beetle can be about 17 cm long, horn included: longer than your hand. Only the females lay eggs, and they have no horns.', simple: 'A big one is longer than your hand!', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  colour: { title: 'Wings that change colour', body: 'Hercules beetles have olive or yellow wing cases when the air is dry. When it is damp, water soaks into a spongy layer and they turn black. Scientists have studied this to make colour-changing materials.', simple: 'Dry air: yellow. Wet air: black! The wings change colour.', more: 'https://www.youtube.com/results?search_query=hercules+beetle+colour+change+humidity' },
  elytra: { title: 'Wing cases', body: 'A beetle\'s hard front wings are called elytra. They don\'t flap. They lift up like doors so the thin flying wings underneath can unfold.', simple: 'The hard wings are doors. Thin wings fold under them.', more: 'https://en.wikipedia.org/wiki/Elytron' },
  fly: { title: 'A heavy flyer', body: 'Even though they are so big, Hercules beetles can fly. They hold their wing cases up out of the way and buzz loudly with their thin back wings.', simple: 'They are big, but they can fly! Buzzzz!', more: 'https://www.youtube.com/results?search_query=hercules+beetle+flying' },
  night: { title: 'Out at night', body: 'Hercules beetles are nocturnal. They come out at night to look for food and for each other, and rest under leaves in the day.', simple: 'They come out at night.', more: 'https://en.wikipedia.org/wiki/Nocturnality' },
  fruit: { title: 'Fruit eaters', body: 'Adult Hercules beetles eat fruit, especially soft, ripe fruit that has fallen to the forest floor. They lap up the juice with brushy mouthparts.', simple: 'Grown-up beetles eat soft, sweet fruit.', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  strong: { title: 'Super strong', body: 'Rhinoceros beetles are some of the strongest animals for their size. Scientists measured one walking with 30 times its own weight on its back. That is like you carrying a car!', simple: 'A rhinoceros beetle can carry 30 times its weight!', more: 'https://www.youtube.com/results?search_query=rhinoceros+beetle+strength' },
  wrestle: { title: 'Horn wrestling', body: 'Male Hercules beetles fight over food and mates. They grab each other between their horns, lift, and try to throw the other beetle off the branch. They are rarely hurt.', simple: 'Males push and lift with their horns. Nobody gets hurt.', more: 'https://www.youtube.com/results?search_query=hercules+beetle+fight' },
  female: { title: 'The female', body: 'Females have no horns. Their wing cases are often brown or black and a little hairy. After mating, a female lays her eggs in rotting wood, and the life cycle starts again.', simple: 'Females have no horns. They lay the eggs.', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  scarab: { title: 'A rhinoceros beetle', body: 'Hercules beetles are rhinoceros beetles, part of the scarab family. There are about 400,000 kinds of beetle: more than any other kind of animal.', simple: 'There are more kinds of beetle than any other animal!', more: 'https://en.wikipedia.org/wiki/Dynastinae' },
  rainforest: { title: 'Rainforest home', body: 'Hercules beetles live in the rainforests of Central and South America and some Caribbean islands, where it is warm and wet all year.', simple: 'They live in warm, wet rainforests.', more: 'https://en.wikipedia.org/wiki/Hercules_beetle' },
  coati: { title: 'The coati', body: 'Coatis are raccoon cousins with long, wiggly noses. They sniff out grubs in rotting logs. A grub deep inside the wood is hard to find.', simple: 'A coati has a long nose for sniffing out grubs.', more: 'https://en.wikipedia.org/wiki/Coati' },
  huff: { title: 'Huff!', body: 'When a Hercules beetle is bothered it can make a loud huffing sound by rubbing its body against its wing cases.', simple: 'An upset beetle goes HUFF!', more: 'https://www.youtube.com/results?search_query=hercules+beetle+sound' },
  glow: { title: 'Glowing fungus', body: 'Some rainforest fungi glow in the dark. This is called bioluminescence. Nobody is completely sure why, but it may attract insects that spread the fungus.', simple: 'Some fungus glows in the dark!', more: 'https://en.wikipedia.org/wiki/Foxfire' },
  recycler: { title: 'Forest recyclers', body: 'Fallen trees would pile up forever without decomposers. Grubs, termites, fungi and bacteria turn dead wood back into soil, which feeds new trees.', simple: 'Grubs turn old logs into new soil!', more: 'https://en.wikipedia.org/wiki/Decomposition' },
  lifecycle: { title: 'Complete metamorphosis', body: 'Egg, larva, pupa, adult. Beetles, butterflies, ants and flies all change completely like this. The grub and the beetle look like two different animals.', simple: 'Egg, grub, pupa, beetle. Then eggs again!', more: 'https://en.wikipedia.org/wiki/Holometabolism' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are an egg, deep in a rotting log. Wait for it…', 'I am an egg. Wait…'],
  hatch: ['Wiggle! Push the arrows to break out of the egg.', 'Wiggle out of the egg!'],
  eat: ['Push into the soft wood to chew it. Every bite makes you bigger.', 'Push into the wood to eat it!'],
  fungus: ['White, glowing wood has fungus in it. It is extra tasty!', 'Eat the white wood. Yum!'],
  hard: ['That dark wood is still too hard. Find softer wood.', 'Too hard! Find soft wood.'],
  rock: ['A stone! Grubs can\'t chew stone. Go around.', 'A stone! Go around.'],
  outside: ['Stay inside the log: the bark keeps you safe.', 'Stay in the log!'],
  tight: ['Your skin is tight! Time to moult.', 'My skin is tight!'],
  bigger: ['Keep eating! A big grub makes a big beetle with a big horn.', 'Eat more! Get big!'],
  dig: ['Full-grown! Dig down out of the log into the soil, or keep eating to grow an even bigger horn.', 'Dig down into the dirt! Or eat more for a big horn.'],
  deeper: ['A little deeper. The chamber must be safe underground.', 'Dig down more!'],
  build: ['Deep enough! Press Space to press the soil into a smooth room.', 'Make a room! Press Space.'],
  building: ['Keep pressing the walls smooth…', 'Push, push, push!'],
  pupa: ['You are a pupa. Something amazing is happening inside…', 'I am a pupa. Wait…'],
  harden: ['A beetle! Wait for your shell to get hard and dark.', 'I am soft. Wait…'],
  digup: ['Your shell is hard! Dig up, up, up to the forest floor.', 'Dig up, up, up!'],
  night: ['It is night: beetle time! Look for fruit.', 'Night! Find fruit!'],
  fruit: ['Fruit! Go to it and press Space to eat.', 'Fruit! Press Space to eat.'],
  fly: ['Press E to open your wings and fly. Press E again to land.', 'Press E to fly!'],
  tired: ['You are tired. Eat some fruit to get your energy back.', 'Eat fruit to fly again!'],
  climb: ['Push up at a tree trunk to climb it.', 'Push up to climb the tree!'],
  lift: ['That is heavy! Press Space to lift it with your horns.', 'Lift it with my horn!'],
  rival: ['Another male! Go to him and press Space to wrestle.', 'A beetle! Push him!'],
  wrestle: ['Tap Space to push! When the ring turns green, press E to LIFT!', 'Tap Space! Green ring: E!'],
  won: ['You won! He flew away, and the fruit is yours.', 'I won! He flew away.'],
  lost: ['He flipped you! Eat fruit to get stronger, then try again.', 'Oops! Eat and try again.'],
  champion: ['Champion of the forest! Listen… someone is coming.', 'I am the best!'],
  female: ['A female beetle! Go to her and press Space.', 'Go and say hi!'],
  eggs: ['She is laying eggs in the log. A new generation!', 'Eggs! A new grub!'],
  coati: ['A coati is sniffing at the log! Go deep inside to hide.', 'A coati! Go deep!'],
  safe: ['The coati gave up and wandered off.', 'The coati went away.'],
  rain: ['Rain! Watch your wing cases turn black in the damp.', 'Rain! My wings go black!'],
  day: ['Daytime. Beetles rest. Press F to wait for night.', 'It is day. Rest. Press F.'],
  friend: ['Another grub! Your brother or sister, eating too.', 'A grub friend!'],
  sniff: ['Sniff, sniff… Follow the arrow to more good wood!', 'Follow the arrow to more wood!'],
  soil: ['Soil is not food for a growing grub. Go back to the wood!', 'Soil is not food! Go to the wood.']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
