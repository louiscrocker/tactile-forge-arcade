/* ============================================================
   facts.js — the beetles, the years, the rivals, the cousins
   ============================================================
   Everything here is real natural history, simplified for play.
   The animal is the European stag beetle, Lucanus cervus, in a
   family garden at a wood's edge in southern England.
   Each fact has a full version, a "little words" version and a
   link to see the real thing (a Wikipedia page or a YouTube
   search, never a guessed video URL).
   Hints live in hints.js.
   ============================================================ */
'use strict';

/* You choose at the start: a boy (antlers) or a girl (a digger). */
const FORMS = {
  boy: { name: 'Boy stag beetle', short: 'Boy', latin: 'Lucanus cervus', male: true,
    wing: '#8a3517', wing2: '#4d1a0b', wet: '#2c0f08', body: '#15100f',
    blurb: 'Great red-brown antlers for wrestling on the branches of the old oak. Flies at dusk, whirring and wobbling.',
    simple: 'Big antlers! He wrestles on the oak.', power: 'Big antlers' },
  girl: { name: 'Girl stag beetle', short: 'Girl', latin: 'Lucanus cervus', male: false,
    wing: '#5e2a16', wing2: '#33160c', wet: '#1e0d07', body: '#120e0d',
    blurb: 'Small, strong jaws that bite through bark and dig deep. She finds the rotting wood where the next grubs will live.',
    simple: 'Small, strong jaws! She digs deep.', power: 'Strong digger' }
};
const FORM_KEYS = Object.keys(FORMS);

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'grub1', name: 'Little grub', short: 'Grub' },
  { key: 'grub2', name: 'Bigger grub', short: 'Big' },
  { key: 'grub3', name: 'Giant grub', short: 'Giant' },
  { key: 'pupa', name: 'In the cocoon', short: 'Cocoon' },
  { key: 'beetle', name: 'Stag beetle', short: 'Beetle' },
  { key: 'champ', name: 'King of the oak', short: 'King' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* yearLen: seconds of one grub year · molt2/molt3/full: food to moult, and to be big enough for a cocoon ·
   rivals: evenings in the Antler Ring · eggs: how many she lays · window: seconds to answer a rival's move */
const DIFFICULTY = {
  easy:   { name: 'Little kid', yearLen: 60, molt2: 90, molt3: 260, full: 480, chew: 1.15, rivals: 3, rival: .6, window: 1.5, eggs: 3, chamber: 4, energy: .5, visitors: false },
  normal: { name: 'Big kid', yearLen: 75, molt2: 140, molt3: 400, full: 720, chew: .9, rivals: 4, rival: .85, window: 1.1, eggs: 4, chamber: 6, energy: 1, visitors: true },
  hard:   { name: 'Scientist', yearLen: 90, molt2: 190, molt3: 540, full: 960, chew: .75, rivals: 5, rival: 1.1, window: .8, eggs: 5, chamber: 8, energy: 1.3, visitors: true }
};
const FIRST_COCOON_YEAR = 3, LAST_YEAR = 7;

/* food units → grams of grub (a real grub can reach about 10 g) */
const BONUS = 1.6;          /* a grub may keep eating past "big enough": a bigger beetle, bigger antlers */
function grubGrams(food, full) { return .02 + Math.pow(clamp(food / full, 0, BONUS), 1.3) * 7; }
/* food → an adult's length: males 35–75 mm including the antlers, females 30–50 mm (the real ranges) */
function adultLength(food, full, form) {
  const k = clamp(food / (full * BONUS), 0, 1), male = !FORMS[form] || FORMS[form].male;
  return Math.round(male ? lerp(35, 75, k) : lerp(30, 50, k));
}
const SMALL_MALE_MM = 56;   /* below this the sneaky way is the smart way */

/* The seven years.  Each brings something new, below and above.  `above` is what the child is doing in the
   garden over your head; the child is 6 in Year 1. */
const YEARS = [
  null,
  { key: 'neighbour', title: 'Year 1: Hard wood', goal: 'Sing to a neighbour', simple: 'Press E. Sing!', above: 'sandpit' },
  { key: 'fungus', title: 'Year 2: The white threads', goal: 'Eat the white fungus wood', simple: 'Eat white wood!', above: 'swing' },
  { key: 'mole', title: 'Year 3: The mole', goal: 'Stay deep while the mole goes by', simple: 'A mole! Go deep!', above: 'snowman' },
  { key: 'song', title: 'Year 4: The grub choir', goal: 'Sing the song back', simple: 'Sing it back!', above: 'bike' },
  { key: 'rain', title: 'Year 5: The wet year', goal: 'Stay under the water', simple: 'Water! Go down!', above: 'treehouse' },
  { key: 'badger', title: 'Year 6: The badger', goal: 'Hide from the digging badger', simple: 'A badger! Hide!', above: 'kite' },
  { key: 'feast', title: 'Year 7: The great feast', goal: 'Eat the crumbling stump', simple: 'Eat, eat, eat!', above: 'guitar' }
];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const seasonOf = (yt) => clamp(Math.floor(yt * 4), 0, 3);

/* the Antler Ring.  moves: shove (block it) · charge (a big one) · feint (a gap that shuts) · rest (a free gap) */
const RIVALS = [
  { key: 'nip', name: 'Little Nip', len: 44, col: '#a4441c', power: 2, trick: 1, moves: ['shove'], card: 'Small and quick. He never stops shoving.', simple: 'Small and quick.' },
  { key: 'bramble', name: 'Bramble', len: 54, col: '#7c3016', power: 3, trick: 1, moves: ['shove', 'rest'], card: 'Big and slow. He has a nap in the middle of a fight.', simple: 'Big and slow. He naps!' },
  { key: 'rusty', name: 'Old Rusty', len: 60, col: '#b0521e', power: 3, trick: 3, moves: ['shove', 'feint'], card: 'An old trickster. He opens his jaws, then snaps them shut.', simple: 'He plays tricks.' },
  { key: 'thunder', name: 'Thunder', len: 66, col: '#5a2412', power: 4, trick: 2, moves: ['charge', 'shove'], card: 'He stamps, then charges along the branch like a train.', simple: 'He charges fast!' },
  { key: 'duke', name: 'The Duke', len: 74, col: '#3e170c', power: 5, trick: 4, moves: ['charge', 'feint', 'shove'], card: 'The king of the old oak. Nobody has ever flipped him.', simple: 'The king of the oak!' }
];

/* the card book: stag beetles of the world (real animals), plus one friend from the rainforest */
const COUSINS = [
  { key: 'stag', name: 'Stag beetle', latin: 'Lucanus cervus', where: 'Europe', col: '#8a3517', len: 75, jaw: 1, simple: 'That is you!', card: 'The biggest beetle in Britain. It spends up to seven years underground.' },
  { key: 'lesser', name: 'Lesser stag beetle', latin: 'Dorcus parallelipipedus', where: 'Europe', col: '#23201e', len: 32, jaw: .25, simple: 'Small and black.', card: 'Small, black and neat. It lives in very soft old wood, and in summer it rests in the sun on trees.' },
  { key: 'rhino', name: 'Rhinoceros stag', latin: 'Sinodendron cylindricum', where: 'Europe', col: '#191a22', len: 16, jaw: .1, horn: true, simple: 'One little horn.', card: 'A tiny shiny cousin with one little horn, in old beech and ash.' },
  { key: 'pinch', name: 'Giant stag beetle', latin: 'Lucanus elaphus', where: 'North America', col: '#a8501e', len: 60, jaw: 1.2, simple: 'Very long jaws!', card: 'A shiny red-brown cousin from North America with very long, thin jaws.' },
  { key: 'giraffe', name: 'Giraffe stag beetle', latin: 'Prosopocoilus giraffa', where: 'South-East Asia', col: '#17140f', len: 118, jaw: 1.7, simple: 'The longest jaws!', card: 'One of the longest stag beetles in the world, with very long jaws.' },
  { key: 'rainbow', name: 'Rainbow stag beetle', latin: 'Phalacrognathus muelleri', where: 'Australia', col: '#3a9a5a', col2: '#c04a8a', len: 70, jaw: .9, simple: 'All the colours!', card: 'It shines green, gold, purple and red. It lives in Queensland and New Guinea.' },
  { key: 'golden', name: 'Golden stag beetle', latin: 'Lamprima aurata', where: 'Australia', col: '#c8a02a', col2: '#3a9a5a', len: 25, jaw: .35, simple: 'A little jewel.', card: 'A small jewel of a beetle, gold or green, about 2.5 cm long.' },
  { key: 'darwin', name: "Darwin's beetle", latin: 'Chiasognathus grantii', where: 'Chile', col: '#7a6a2a', col2: '#3a7a5a', len: 90, jaw: 1.5, simple: 'Charles Darwin saw it!', card: 'Charles Darwin met this one in Chile. He wrote that it was bold, and that its jaws could not hurt his finger.' },
  { key: 'hercules', name: 'Hercules beetle', latin: 'Dynastes hercules', where: 'Rainforests of the Americas', col: '#b8a24a', len: 170, jaw: 0, horn: true, friend: true, simple: 'A friend, not a stag!', card: 'Not a stag at all: a rhinoceros beetle. But it wrestles on branches too. Say hello to your friend from the rainforest!' }
];

/* each rival wears his own colours */
for (const r of RIVALS) FORMS['r_' + r.key] = { name: r.name, short: r.name, latin: 'Lucanus cervus', male: true, wing: r.col, wing2: '#2c120a', wet: '#2c0f08', body: '#15100f' };

const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const wp = (t) => 'https://en.wikipedia.org/wiki/' + t;
const FACTS = {
  egg: { title: 'An egg by the old stump', body: 'A mother stag beetle digs down into the soil beside rotting wood and lays her eggs there.', simple: 'Mum dug down deep. She laid me here.', more: wp('Lucanus_cervus') },
  grub: { title: 'A grub, curled like a C', body: 'A stag beetle baby is called a larva, or a grub. It is soft and creamy white with an orange-brown head, six little legs and strong jaws, and it curls up like the letter C.', simple: 'A baby beetle is a grub. It curls up like a C.' },
  years: { title: 'Up to seven years', body: 'A stag beetle grub lives underground for three to seven years, longer than it takes a child to learn to ride a bike. As a beetle it lives only a few weeks or months of one summer.', simple: 'A grub lives for up to seven years!' },
  wood: { title: 'Eating dead wood', body: 'Stag beetle grubs eat rotting wood underground, mostly the old roots and stumps of oak and other broadleaved trees. They do not eat living trees.', simple: 'A grub eats old dead wood, not live trees.' },
  recycler: { title: 'Turning wood into soil', body: 'Grubs and fungi slowly turn dead wood back into soil, which feeds the next trees. Without them, dead wood would pile up.', simple: 'Grubs turn old wood into new soil.' },
  fungus: { title: 'Fungus makes wood soft', body: 'White threads of fungus spread through dead wood and soften it. Scientists think grubs need wood that fungi have already started to break down.', simple: 'White threads make the wood soft and good.' },
  rot: { title: 'A stump that changes', body: 'A dead stump does not stay the same. Year by year it gets softer and crumblier, until one day it falls into the soil.', simple: 'Year by year, the stump gets soft.' },
  sing: { title: 'Grubs can sing', body: 'Stag beetle grubs rub their back legs together to make a tiny creaking sound. This is called stridulation. Scientists think grubs may use it to tell each other where they are.', simple: 'Grubs rub their legs to make a little song.', more: wp('Stridulation') },
  molt: { title: 'Growing out of your skin', body: 'A grub\'s skin can\'t stretch forever. When it gets too tight the grub splits it and wriggles out in a bigger one. This is called moulting.', simple: 'When its skin is too tight, a grub gets a new one.' },
  instar: { title: 'Three sizes of grub', body: 'Stag beetle grubs have three sizes, called instars. The last one can grow as long as your finger.', simple: 'A big grub is as long as your finger.' },
  frost: { title: 'Below the frost', body: 'In winter the top of the ground freezes. Grubs stay deeper down, where it never freezes, and they slow right down until spring.', simple: 'Winter is cold on top. Deep down it is safe.' },
  mole: { title: 'The mole', body: 'Moles dig long tunnels and eat the worms that fall into them. A grub deep in hard wood is safe.', simple: 'A mole digs and digs. It looks for worms.', more: wp('European_mole') },
  centipede: { title: 'The centipede', body: 'Centipedes run through the soil hunting at night. Despite the name, most have far fewer than a hundred legs.', simple: 'A centipede has lots of legs and runs fast.' },
  woodlice: { title: 'Woodlice', body: 'Woodlice look like insects, but they are land crustaceans, cousins of crabs and lobsters. They love rotting wood as much as grubs do.', simple: 'Woodlice are little cousins of crabs!' },
  badger: { title: 'The badger', body: 'Badgers dig for worms and grubs with long, strong claws. They are real visitors at old stumps, and they leave crumbs of wood behind.', simple: 'A badger has big claws for digging.', more: wp('European_badger') },
  rainyear: { title: 'A wet year', body: 'Soft, damp wood is good for fungi. A wet year can make a stump rot much faster.', simple: 'Wet wood gets soft fast.' },
  cocoon: { title: 'A cocoon as big as an orange', body: 'At the end of its last summer the grub digs into the soil and builds a cocoon of earth about as big as an orange.', simple: 'The grub makes a room as big as an orange.' },
  pupa: { title: 'The pupa', body: 'In the cocoon the grub turns into a pupa. It looks still, but inside its body is being rebuilt into a beetle. This is called complete metamorphosis.', simple: 'In the room, a grub turns into a beetle!' },
  waiting: { title: 'A whole winter of waiting', body: 'The new beetle is finished by the autumn, but it stays underground all winter. It only digs up in late May, when the evenings are warm.', simple: 'The new beetle waits all winter.' },
  antlers: { title: 'Not really antlers', body: 'The "antlers" are huge jaws, called mandibles. They look like a stag\'s antlers, which is how the beetle got its name. They are too big to bite hard.', simple: 'The antlers are really very big jaws!', more: wp('Stag_beetle') },
  girljaws: { title: 'Small jaws, strong jaws', body: 'A female has small jaws, but she can use them. The huge jaws of a male are quite weak, while the small female can give a sharp nip.', simple: 'Her small jaws pinch hard!' },
  never: { title: 'If you find one', body: 'Stag beetles are gentle and rare. If you find one on a path, let it walk onto a leaf or a stick, and put it somewhere safe.', simple: 'If you find one, move it with a leaf.' },
  dusk: { title: 'Warm evenings', body: 'Stag beetles fly at dusk on warm evenings from May to August. On a good evening you can hear them before you see them.', simple: 'They fly on warm evenings in summer.' },
  whirr: { title: 'A flying tank', body: 'A male flies almost standing up, because his antlers are so heavy. He whirs along slowly and wobbles a lot, and he often bumps into things.', simple: 'He flies standing up! He wobbles and bumps.' },
  elytra: { title: 'Wing cases', body: 'A beetle\'s hard front wings are called elytra. They lift up like doors so that the thin flying wings can unfold.', simple: 'The hard wings lift up like doors.' },
  upside: { title: 'Stuck on its back', body: 'Big beetles often land on their backs after a clumsy flight. They rock from side to side and grab at anything until they flip over.', simple: 'A beetle can land on its back. It rocks to get up!' },
  sap: { title: 'Sweet sap', body: 'Adult stag beetles do not chew. They live mostly on the fat they stored as grubs, and they sip sweet tree sap and juice from soft fruit.', simple: 'A beetle sips sweet sap.' },
  tongue: { title: 'An orange brush', body: 'A stag beetle has a fuzzy orange tongue like a little brush, just right for mopping up sap.', simple: 'Its tongue is an orange brush!' },
  wrestle: { title: 'Jaw wrestling', body: 'Male stag beetles wrestle on branches. Each tries to get his jaws under the other, lift him up and flip him off. The loser just walks or flies away.', simple: 'Boys wrestle on branches. They flip each other off!', more: yt('stag beetles wrestling Lucanus cervus') },
  sizejaws: { title: 'Food makes the antlers', body: 'A beetle never grows after it comes out of the pupa. A well-fed grub makes a big beetle with big antlers. A hungry one makes a small beetle with small antlers.', simple: 'Eat lots as a grub. Get big antlers!' },
  sneaker: { title: 'The sneaky way', body: 'In many animals, small males don\'t fight big ones. They slip past while the big ones are busy. Scientists call them sneakers.', simple: 'A small boy can sneak past the big ones!' },
  biggest: { title: 'The biggest in Britain', body: 'A big male stag beetle can be about 7.5 cm long with his antlers, which makes it the biggest beetle in Britain and in Europe.', simple: 'It is the biggest beetle in Britain and Europe!' },
  bark: { title: 'Biting through bark', body: 'Scientists think female stag beetles bite into bark to make sap flow, and then males come to the sap. The big jaws of a male are not made for this.', simple: 'She bites the bark. Sweet sap comes out.' },
  scent: { title: 'Smelling with feelers', body: 'A beetle smells with its antennae, the little fans on its feelers. Females smell out rotting wood and males smell out females.', simple: 'A beetle smells with its feelers.' },
  dig: { title: 'A strong digger', body: 'The female has wide, spiky front legs for digging. She digs down into the soil to lay her eggs next to buried wood.', simple: 'She digs down deep with spiky legs.' },
  lay: { title: 'Eggs by the old wood', body: 'A female may lay as many as 30 eggs, in dead wood or the soil beside it. The eggs hatch after about three weeks.', simple: 'She lays her eggs by the old wood.' },
  logpile: { title: 'A home you can build', body: 'People help stag beetles by leaving old stumps in the ground, or by burying big logs upright to make a "log pile". Conservation groups ask people to report sightings too.', simple: 'You can help! Leave old logs in your garden.', more: 'https://stagbeetles.ptes.org/about-stag-beetles/' },
  rare: { title: 'A rare neighbour', body: 'Stag beetles have grown rare across Europe, because old stumps get tidied away. Many live in gardens in south-east England, even in London.', simple: 'They are rare. Many live in gardens.' },
  magpie: { title: 'Magpies', body: 'Magpies and crows look for stag beetles on the ground. A big male rears up and spreads his antlers to look scary.', simple: 'A magpie looks. He rears up to look big!' },
  fox: { title: 'Foxes', body: 'Foxes wander gardens at dusk, sniffing for anything interesting. They are curious about everything.', simple: 'A fox is curious. It sniffs at all things.' },
  cat: { title: 'The cat', body: 'Garden cats love to pat at anything that moves. A stag beetle in a hurry is very interesting to a cat, for a moment.', simple: 'The cat pats. Then it gets bored.' },
  bat: { title: 'Bats', body: 'Bats hunt flying insects at dusk by listening to echoes of their own squeaks. A heavy whirring beetle is easy to hear.', simple: 'Bats hunt at dusk. They listen with big ears.', more: wp('Common_pipistrelle') },
  moth: { title: 'Moths at the lamp', body: 'Scientists think moths steer by the light of the sky. A bright lamp confuses them, so they circle it round and round.', simple: 'Moths go round and round a lamp.' },
  lifecycle: { title: 'Complete metamorphosis', body: 'Egg, larva, pupa, adult. Up to seven years underground for one summer in the air. Then new eggs, and it all starts again.', simple: 'Egg, grub, pupa, beetle. Then it starts again.' },
  short: { title: 'One summer', body: 'An adult stag beetle lives for a few weeks, or a few months at most. It spends them finding a mate and laying eggs, so that new grubs can start their years in the wood.', simple: 'A beetle has just one summer.' },
  cousins: { title: 'Stag beetles of the world', body: 'Scientists have named about 1,800 kinds of stag beetle, from tiny black ones to rainbow ones. Each one you meet goes in your card book.', simple: 'There are over 1,000 kinds of stag beetle!' }
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
