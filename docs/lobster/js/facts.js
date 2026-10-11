/* ============================================================
   facts.js — the lobsters, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the American
   lobster (Homarus americanus) in the Gulf of Maine, simplified
   for play.  Each fact has a full version, a "little words"
   version and a link to see the real thing (a Wikipedia page or
   a YouTube search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Five colours of lobster.  Almost all are a mottled greenish brown; about one in
   two million is blue; orange, calico and the half-and-half "split" are rarer still
   (all real colour forms).  shell / shell2 = carapace light and dark, belly = the
   underside and the joints, claw = claw tips, eye */
const FORMS = {
  normal: { name: 'Mottled lobster', short: 'Mottled', latin: 'Homarus americanus',
    shell: '#4e5a3a', shell2: '#2a2e1c', belly: '#c89a5a', claw: '#d8c08a', leg: '#6a5a38', eye: '#120c08', spots: '#8a3a2a',
    blurb: 'The everyday Gulf of Maine lobster: greenish brown with dark speckles, so it hides on the sea floor.',
    simple: 'Green-brown, like the sea floor!', power: 'The most common colour' },
  blue:   { name: 'Blue lobster', short: 'Blue', latin: 'Homarus americanus (blue)',
    shell: '#2a6ad0', shell2: '#143a8a', belly: '#9ac0f0', claw: '#d0e4ff', leg: '#2a56b0', eye: '#0a0c18', spots: '#1a2a6a',
    blurb: 'About one lobster in two million is bright blue: its shell makes too much of one blue protein.',
    simple: 'A bright blue one! One in two million.', power: 'One in two million' },
  orange: { name: 'Orange lobster', short: 'Orange', latin: 'Homarus americanus (orange)',
    shell: '#e8862a', shell2: '#9a4a10', belly: '#ffd8a0', claw: '#ffe8c0', leg: '#d06a1a', eye: '#1a0a06', spots: '#b0401a',
    blurb: 'Very rare: only about one lobster in thirty million is orange or yellow.',
    simple: 'Orange, like a carrot! Very rare.', power: 'Rarer than blue' },
  calico: { name: 'Calico lobster', short: 'Calico', latin: 'Homarus americanus (calico)',
    shell: '#e0a040', shell2: '#2a2018', belly: '#f0d0a0', claw: '#f0e0b0', leg: '#7a5a2a', eye: '#120c08', spots: '#1a1410',
    blurb: 'Calico lobsters are orange-yellow with black speckles, like a tortoiseshell cat.',
    simple: 'Spotty, like a tortoiseshell cat!', power: 'Very rare' },
  split:  { name: 'Split lobster', short: 'Split', latin: 'Homarus americanus (half-and-half)',
    shell: '#e8862a', shell2: '#143a8a', belly: '#d0c0a0', claw: '#e0e0ff', leg: '#7a5a2a', eye: '#120c08', spots: '#2a2e1c',
    blurb: 'The rarest of all: one side one colour, the other side another, split neatly down the middle.',
    simple: 'Half one colour, half another!', power: 'The rarest of all' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy lobster', short: 'Boy', blurb: 'Boys grow bigger claws. A boy fights claw to claw for the best shelter on the cobble bed.', simple: 'Big claws! Box for the best den.' },
  girl: { name: 'Girl lobster', short: 'Girl', blurb: 'Girls have a wider tail. A girl carries her eggs under it for almost a year, then fans the larvae free.', simple: 'She carries the eggs under her tail!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'larva', name: 'Larva', short: 'Larva' },
  { key: 'postlarva', name: 'Stage IV', short: 'Stage IV' },
  { key: 'juvenile', name: 'Shelter years', short: 'Juvenile' },
  { key: 'young', name: 'Young lobster', short: 'Young' },
  { key: 'adult', name: 'Adult lobster', short: 'Adult' },
  { key: 'walk', name: 'The long walk', short: 'Walk' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much food each step takes, per difficulty
   larva: plankton to moult to stage II, stage III, then stage IV
   lob:   bottom food to moult to a young lobster, a bigger young lobster, then an adult
   risk:  how fast an exposed lobster's hiding meter drains (soft shells drain faster)
   rival: how hard a rival pushes in a claw contest · trap: the lobsterman's trap visits
   wins: rivals beaten to be the boss of the cobble bed · fans: good fans to let the larvae go
   dig: digging power · fish: the predators come (easy: fewer) */
const DIFFICULTY = {
  easy:   { name: 'Little kid', larva: [20, 46, 80], lob: [30, 80, 160], risk: .5, rival: .55, trap: false, wins: 1, fans: 3, dig: 1.3, fish: false },
  normal: { name: 'Big kid',    larva: [30, 70, 120], lob: [50, 130, 250], risk: 1, rival: .8, trap: true, wins: 2, fans: 4, dig: 1, fish: true },
  hard:   { name: 'Scientist',  larva: [40, 90, 150], lob: [70, 170, 320], risk: 1.3, rival: 1.05, trap: true, wins: 3, fans: 5, dig: .85, fish: true }
};
const BONUS = 1.5;      /* an adult may keep eating to 150 % of the adult threshold: a bigger lobster */

/* how long a lobster's carapace (the head-shield) is, in cm, from its moult and its
   food.  A new juvenile is about half a centimetre; a lobster is "legal size" in
   Maine at 8.3 cm; the biggest grow to well over 12 cm. */
function lobCM(instar, food, th) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  if (instar <= 1) return lerp(.5, 1.2, t(0, th[0]));
  if (instar === 2) return lerp(1.6, 3.2, t(th[0], th[1]));
  if (instar === 3) return lerp(3.6, 6.2, t(th[1], th[2]));
  return lerp(7, 12.4, t(th[2], th[2] * BONUS));
}
/* a lobster's drawn length in world units, tail fan to rostrum (stylised: a tiny
   juvenile is drawn bigger than life, so a child can see it under its cobble) */
function lobUnits(cm) { return 10 + cm * 4; }
/* carapace length → the whole body, as a rough real-world figure (cm) */
function lobTotalCM(cm) { return cm * 2.9; }

const FACTS = {
  egg: { title: 'Eggs under her tail', body: 'A mother lobster glues her eggs to the little paddles under her tail, where she carries them for nine to twelve months. A lobster with eggs is called "berried", because the eggs look like a bunch of tiny dark berries.', simple: 'Mum keeps her eggs under her tail for almost a year!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  hatch: { title: 'Hatching at night', body: 'The eggs hatch on summer nights. The mother stands tall on her legs and fans her tail paddles, and the larvae float free a few at a time, night after night.', simple: 'Mum fans her tail and the larvae float away!', more: 'https://www.youtube.com/results?search_query=lobster+larvae+hatching' },
  larva: { title: 'A lobster larva', body: 'A newly hatched lobster larva is about 8 millimetres long and looks like a tiny shrimp. It drifts and swims near the surface of the sea, part of the plankton.', simple: 'A baby lobster looks like a tiny shrimp!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  plankton: { title: 'Plankton', body: 'Plankton are the tiny living things that drift in the sea. Some are tiny plants called diatoms, which make much of the oxygen we breathe, and they are food for almost everything else in the sea.', simple: 'Tiny drifting plants and animals. Food for the whole sea!', more: 'https://en.wikipedia.org/wiki/Plankton' },
  diatom: { title: 'Glass houses', body: 'Diatoms are tiny plants that live in little cases made of glass. The cold Gulf of Maine is full of them in spring.', simple: 'Diatoms are tiny plants in glass cases!', more: 'https://en.wikipedia.org/wiki/Diatom' },
  seamoult: { title: 'Growing in the plankton', body: 'A larva grows by moulting: it climbs out of its old skin in a new, bigger one. A lobster larva moults three times in the plankton, over a few weeks.', simple: 'The larva moults to get bigger!', more: 'https://en.wikipedia.org/wiki/Ecdysis' },
  updown: { title: 'Up at night, down by day', body: 'Every night, plankton all over the world rise towards the surface to feed, and every morning they sink back down where it is darker. It is the biggest daily journey of animals on Earth.', simple: 'Plankton swim up at night and down in the day!', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  glow: { title: 'Glowing sea', body: 'Some plankton flash blue light when something bumps them. This is called bioluminescence. On dark nights a boat\'s wake can sparkle with it.', simple: 'Some plankton glow blue when you bump them!', more: 'https://en.wikipedia.org/wiki/Bioluminescence' },
  copepod: { title: 'Copepods', body: 'Copepods are tiny shrimp-like animals with one red eye. They are some of the most common animals on Earth, and lobster larvae love to eat them.', simple: 'Tiny jumpy shrimps. Yum!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  herring: { title: 'Herring', body: 'Atlantic herring swim in huge silver schools and eat plankton. A lobster larva\'s spines and quick tail make it hard to catch.', simple: 'Silver fish that eat plankton. Swim away!', more: 'https://en.wikipedia.org/wiki/Atlantic_herring' },
  combjelly: { title: 'Comb jellies', body: 'A comb jelly is a see-through blob with eight rows of tiny beating hairs that shimmer like a rainbow. It has no sting, but it eats tiny drifting animals, so a larva keeps away.', simple: 'A see-through blob with rainbow lights. Keep away!', more: 'https://en.wikipedia.org/wiki/Ctenophora' },
  basking: { title: 'The basking shark', body: 'The basking shark is the second biggest fish in the world, as long as a bus. It has no sharp teeth: it swims slowly with its huge mouth open, straining plankton out of the water. Basking sharks visit the Gulf of Maine every summer.', simple: 'The second biggest fish in the world! It eats tiny plankton.', more: 'https://en.wikipedia.org/wiki/Basking_shark' },
  tern: { title: 'Terns', body: 'Terns are slim seabirds that hover and dip to snatch tiny things from the top of the sea. Larvae are safer a little deeper down.', simple: 'A seabird dips at the top of the sea.', more: 'https://en.wikipedia.org/wiki/Common_tern' },
  postlarva: { title: 'Stage IV: a superlobster', body: 'After its third moult the larva becomes stage IV, the postlarva. Now it looks like a tiny lobster, 1.5 centimetres long, and it swims forwards with its tail fan. Scientists nicknamed it the "superlobster".', simple: 'Now it looks like a tiny lobster and swims with its tail fan!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  settle: { title: 'Finding a home', body: 'The postlarva dives to the sea floor and looks for a hole under a cobble. If it can\'t find a free one, it swims up and tries somewhere else. Shallow cobble beds are the lobster\'s nursery.', simple: 'It dives down and looks for a hole under a stone.', more: 'https://www.youtube.com/results?search_query=lobster+postlarva+settlement+cobble' },
  nursery: { title: 'The shelter years', body: 'A young lobster hides under its cobble for the first years of its life, eating what drifts in. Scientists call it "shelter-restricted". Only when it is bigger does it start going out at night.', simple: 'A little lobster hides under a stone for years!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  firstyear: { title: 'Ten moults', body: 'A lobster moults about ten times in its first year, and grows about 15 percent longer each time. Later it moults less often: a big adult only every year or two.', simple: 'It moults about ten times in its first year!', more: 'https://en.wikipedia.org/wiki/Ecdysis' },
  eatshell: { title: 'Eating the old shell', body: 'After a moult a lobster often eats its old shell. The shell is full of calcium, which helps the new shell harden faster.', simple: 'It eats its old shell to get strong again!', more: 'https://www.youtube.com/results?search_query=lobster+molting' },
  soft: { title: 'Soft shell', body: 'A lobster that has just moulted is soft and wrinkly. It pumps itself up with water, hides, and waits weeks while the new shell hardens.', simple: 'After a moult it is soft, so it hides.', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  mill: { title: 'Teeth in its tummy', body: 'A lobster has no teeth in its mouth. It has three grinding teeth in its stomach, called the gastric mill, which chew up the food it swallows.', simple: 'A lobster\'s teeth are in its tummy!', more: 'https://en.wikipedia.org/wiki/Gastric_mill' },
  blood: { title: 'Blue-ish blood', body: 'Lobster blood is clear with a blue-ish tint, because it carries oxygen with copper instead of the iron that makes our blood red.', simple: 'Lobster blood is blue-ish!', more: 'https://en.wikipedia.org/wiki/Hemocyanin' },
  taste: { title: 'Tasting with its feet', body: 'A lobster tastes with tiny hairs on its legs and feet. It smells with its two small antennules, and feels with its two long antennae.', simple: 'It tastes with its feet and smells with its little feelers!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  eyes: { title: 'Eyes on stalks', body: 'A lobster\'s eyes sit on stalks and are made of thousands of tiny square tubes. They are good at seeing movement in dim light, but a lobster lives mostly by smell and touch.', simple: 'Eyes on stalks, made of thousands of tiny tubes!', more: 'https://en.wikipedia.org/wiki/Compound_eye' },
  walkswim: { title: 'Forwards and backwards', body: 'A lobster walks forwards on its eight walking legs. To escape, it snaps its tail and shoots backwards through the water. That is called the tail flip.', simple: 'It walks forwards and swims backwards!', more: 'https://en.wikipedia.org/wiki/Caridoid_escape_reaction' },
  tailflip: { title: 'The tail flip', body: 'The tail flip is one of the fastest moves in the sea. Big muscles snap the tail under the body, and the lobster zooms backwards, out of reach.', simple: 'Snap! The tail flip zooms it backwards.', more: 'https://en.wikipedia.org/wiki/Caridoid_escape_reaction' },
  claws: { title: 'Crusher and cutter', body: 'A lobster has two different claws: a big crusher with rounded teeth for breaking shells, and a slim cutter with sharp edges for tearing. Which side becomes the crusher is decided while the lobster is small: the claw it uses more.', simple: 'One big crusher claw, one slim cutter claw!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  regrow: { title: 'A claw grows back', body: 'If a lobster loses a claw or a leg, it can let it go and grow a new one over its next few moults.', simple: 'A lost claw grows back!', more: 'https://en.wikipedia.org/wiki/Autotomy' },
  food: { title: 'What lobsters eat', body: 'Lobsters eat mussels, clams, crabs, sea urchins, snails, worms and bits of fish, and nibble on seaweed too. They hunt at night and find food mostly by smell.', simple: 'Mussels, crabs, urchins, snails and bits of seaweed!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  night: { title: 'Out at night', body: 'Lobsters hide by day and come out to feed at night. In the dark, fewer things can see them.', simple: 'Lobsters hide by day and eat at night.', more: 'https://en.wikipedia.org/wiki/Nocturnality' },
  urchin: { title: 'Sea urchins', body: 'Green sea urchins are spiny balls that graze on kelp. A lobster can flip one over and get at the soft underside.', simple: 'A spiny ball! Lobsters flip them over.', more: 'https://en.wikipedia.org/wiki/Strongylocentrotus_droebachiensis' },
  predators: { title: 'Who hunts lobsters', body: 'Cod, sculpins, striped bass, skates and seals all hunt lobsters, especially small or soft ones. That is why a lobster hides by day and keeps its tail ready to flip.', simple: 'Big fish and seals look for lobsters, so lobsters hide.', more: 'https://en.wikipedia.org/wiki/Atlantic_cod' },
  seal: { title: 'Harbour seals', body: 'Harbour seals live all along the coast of Maine. They are curious, dive for fish and lobsters, and rest on the rocks at low tide.', simple: 'A seal! It swims and rests on the rocks.', more: 'https://en.wikipedia.org/wiki/Harbor_seal' },
  trap: { title: 'The lobsterman\'s gauge', body: 'A lobsterman hauls up his trap and measures every lobster with a gauge. In Maine, a lobster that is too small, or too big, must go straight back into the sea.', simple: 'He measures you with a gauge and lets you go!', more: 'https://en.wikipedia.org/wiki/Lobster_fishing' },
  vnotch: { title: 'The V-notch', body: 'A mother lobster carrying eggs is always put back. Maine lobstermen cut a tiny V into her tail fan so that everyone knows to let her go, for years to come.', simple: 'A mum with eggs always goes back in the sea.', more: 'https://en.wikipedia.org/wiki/Lobster_fishing' },
  colour: { title: 'Blue, orange, calico and split', body: 'Almost all lobsters are mottled greenish brown. About one in two million is blue, and orange, calico and the half-and-half "split" lobsters are rarer still.', simple: 'Most are green-brown. One in two million is blue!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  bluewhy: { title: 'Why blue?', body: 'A lobster\'s shell colour comes from a red pigment wrapped in blue proteins. A blue lobster makes far too much of the blue protein, so it looks blue all over.', simple: 'A blue lobster makes too much blue!', more: 'https://en.wikipedia.org/wiki/Crustacyanin' },
  migration: { title: 'The long walk', body: 'In autumn the shallow water gets cold and stormy, so lobsters walk offshore to deeper water, where it is calmer and the temperature changes less. In spring they walk back inshore. Some walk a very long way.', simple: 'In autumn, lobsters walk out to deep water. In spring, they walk back.', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  winter: { title: 'Winter in the deep', body: 'Deep water stays a few degrees warmer than the surface in winter. A lobster digs into the mud or finds a crevice, and eats and moves very little until spring.', simple: 'In winter it rests in the deep, where it is warmer.', more: 'https://en.wikipedia.org/wiki/Gulf_of_Maine' },
  contest: { title: 'Claw to claw', body: 'Two lobsters who want the same shelter face each other, wave their claws, and push and box. The bigger one usually wins, and the loser backs away. Lobsters remember who won, so they rarely fight twice.', simple: 'They wave their claws and box. The loser backs away.', more: 'https://www.youtube.com/results?search_query=lobster+fight+dominance' },
  boss: { title: 'The boss of the cobble bed', body: 'The biggest, strongest male gets the best shelter. Females come to his den, and he guards them while they moult.', simple: 'The boss lobster gets the best den.', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  female: { title: 'A female moults in his den', body: 'A female moves into the male\'s shelter and moults there, so he can guard her while she is soft. Only then can they mate. She stays about a week until her new shell is hard.', simple: 'She moults in his den, where it is safe.', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  eggs: { title: 'Thousands of eggs', body: 'A mother lobster carries thousands of eggs under her tail: a small female about eight thousand, a very big one up to a hundred thousand. She keeps them clean and fans water over them for nine to twelve months.', simple: 'Thousands of eggs under her tail for almost a year!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  moon: { title: 'Moon and tide', body: 'The moon pulls the sea into tides. Twice a day the water rises and falls along the Maine coast, and the currents that come with it carry the larvae along.', simple: 'The moon moves the tides, and the tides carry the larvae.', more: 'https://en.wikipedia.org/wiki/Tide' },
  age: { title: 'Fifty years and more', body: 'Lobsters keep moulting and growing all their lives. A lobster can live more than fifty years, and the biggest ever caught weighed about twenty kilograms.', simple: 'A lobster can live more than fifty years!', more: 'https://en.wikipedia.org/wiki/American_lobster' },
  kelp: { title: 'Kelp forests', body: 'Kelp is a big brown seaweed that grows in forests on rocky sea floors in the Gulf of Maine. Fish, urchins, snails and lobsters all live among its fronds.', simple: 'Kelp is a big seaweed forest under the sea.', more: 'https://en.wikipedia.org/wiki/Kelp_forest' },
  gulf: { title: 'The Gulf of Maine', body: 'The Gulf of Maine is the cold, rich sea between Cape Cod and Nova Scotia. It is one of the best places in the world for lobsters.', simple: 'A cold sea full of lobsters, off the coast of Maine.', more: 'https://en.wikipedia.org/wiki/Gulf_of_Maine' },
  antennae: { title: 'Two long feelers', body: 'A lobster\'s two long antennae are longer than its body. It sweeps them about to feel what is around it in the dark.', simple: 'Long feelers to feel in the dark!', more: 'https://en.wikipedia.org/wiki/Antenna_(biology)' },
  swimmerets: { title: 'Tail paddles', body: 'Under the tail are little paddles called swimmerets. A mother uses them to hold her eggs and fan water over them.', simple: 'Little paddles under the tail hold the eggs.', more: 'https://en.wikipedia.org/wiki/Pleopod' },
  lifecycle: { title: 'The whole life cycle', body: 'Egg, three larval stages, the stage IV postlarva, years under a cobble, a young lobster, an adult, and then eggs again. A lobster\'s life starts near the surface and is lived on the sea floor.', simple: 'Egg, larva, stage IV, juvenile, adult… then eggs again!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are one of thousands of eggs under your mum\'s tail, in her den on the cobble bed…', 'I am an egg under Mum\'s tail. Wait…'],
  hatch: ['A summer night! Mum is fanning her tail. Wiggle with the arrows to float free.', 'Wiggle! Float free!'],
  swim: ['You are a larva! Swim with the arrows and eat the green plankton.', 'Swim! Eat the green dots.'],
  copepod: ['A copepod! It jumps away. Chase it!', 'Chase the little shrimp!'],
  tight: ['Your skin is tight! Time to moult.', 'My skin is tight!'],
  bigger: ['Bigger! Keep eating plankton.', 'Eat more! Get big!'],
  night: ['Night: the plankton rise to the top. Swim up to eat.', 'Night! Food is at the top.'],
  day: ['Day: the plankton sink down. Dive down to find them.', 'Day! Food is down deep.'],
  flick: ['Press E to snap your tail and dash!', 'Press E to dash!'],
  herring: ['Herring! Swim away, or dive deep!', 'Fish! Swim away!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  jelly: ['A comb jelly! Keep away from its shimmering blob.', 'A jelly blob! Keep away!'],
  basking: ['A basking shark! It is straining plankton. Swim away from its huge mouth!', 'A big shark! Swim away!'],
  tern: ['A tern is dipping at the top! Swim down a little.', 'A bird! Go down!'],
  postlarva: ['You are stage IV, a tiny lobster! Follow the arrow to the cobble bed and dive to the bottom.', 'Dive down to the stones!'],
  search: ['Find a hole under a cobble that nobody is in. Walk into it and press Space.', 'Find an empty hole!'],
  taken: ['Taken! A little lobster lives here already. Try another cobble.', 'Taken! Try another one.'],
  settle: ['An empty hole! Press Space to make it your home.', 'Press Space to go in!'],
  juvenile: ['Home! Stay hidden and eat what drifts in. Press Space to grab a drifter.', 'Eat the drifters!'],
  drift: ['Something drifted in! Press Space to eat it.', 'Food! Press Space!'],
  hide: ['Your hiding meter is low! Get under a cobble or into kelp.', 'Hide! Get under a stone!'],
  hidden: ['Safe and hidden.', 'I am hidden. Ahh.'],
  tucked: ['You tucked in tight until it was safe. Nothing found you.', 'I hid until it was safe.'],
  predator: ['A hunter is coming! Press E to flip your tail and dash backwards, or hide!', 'A big fish! Press E!'],
  dodged: ['Whoosh! Your tail flip left it far behind.', 'Whoosh! I got away!'],
  forage: ['Night time! Go out and find food: mussels, crabs, urchins, snails and kelp.', 'Go out and eat!'],
  eat: ['Food! Go to it and press Space to eat.', 'Press Space to eat!'],
  sniff: ['Follow the arrow to more food. Lobsters smell food from far away.', 'Follow the arrow!'],
  claw: ['You crack shells with the claw on the side you face. The claw you use most becomes your crusher!', 'Use one claw most!'],
  crusher: ['Your crusher claw is decided! Big and strong, with a slim cutter on the other side.', 'My big crusher claw!'],
  full: ['You are full! Find a cobble and push down to dig a den under it.', 'Dig under a stone! Push down.'],
  dig: ['Dig down into the sand, then under the cobble.', 'Dig down!'],
  rock: ['Too hard to dig here! Find sand or mud.', 'Too hard! Dig in the sand.'],
  deeper: ['Dig a little deeper, right under the stone.', 'Dig down more!'],
  cover: ['Deep enough, but nothing over you! Dig sideways under a cobble.', 'Go under the stone!'],
  moult: ['Hidden and full! Press Space to back out of your old shell.', 'Press Space to moult!'],
  soft: ['A new soft shell! Stay hidden while it gets hard. Eat your old shell for calcium!', 'I am soft. Hide and wait…'],
  shellmeal: ['Your old shell! Press Space to eat it: it is full of calcium.', 'Eat my old shell!'],
  hard: ['Hard again, and bigger! Out you go.', 'I am hard again! Go out!'],
  out: ['Push up to dig out of your den.', 'Push up to go out!'],
  daytime: ['It is day. Lobsters hide by day. Press F to hurry the time along.', 'Day. Hide and wait, or press F.'],
  trap: ['A trap! It smells of fish. Go in and press Space to eat the bait.', 'A trap! Go in and eat!'],
  hauled: ['Up you go! The lobsterman measures you with his gauge…', 'Up, up! He measures me…'],
  measured: ['Too small! Back into the sea you go. That is the rule.', 'Too small! Back in the sea!'],
  adult: ['You are grown up! Eat and wait for autumn.', 'I am big! Eat and wait.'],
  autumn: ['Autumn! The shallows are getting cold and stormy. Walk offshore to the deep water.', 'Cold! Walk to the deep!'],
  deep: ['Follow the arrow out to the deep.', 'Go to the deep!'],
  kelpwalk: ['Walk on through the kelp forest.', 'Walk on!'],
  arrived: ['The deep! Dig into the soft mud for the winter: push down.', 'Dig into the mud!'],
  winter: ['Winter. Rest in the mud. The deep water stays warm.', 'Winter. Rest…'],
  spring: ['Spring! Dig out and walk back inshore to the cobble bed.', 'Spring! Go back home!'],
  home: ['Follow the arrow home to the cobble bed.', 'Go home!'],
  site: ['Home! Find a big cobble and dig a den under it: push down.', 'Dig a den under a big stone!'],
  rival: ['A rival wants your den! Go to him and press Space to box.', 'A lobster! Box him!'],
  box: ['Tap Space to push! When the ring turns green, press E for a big heave!', 'Tap Space! Green ring: E!'],
  won: ['You won! He backed off. The den is yours.', 'I won! He went away.'],
  lost: ['He pushed you back! Try again.', 'Oops! Try again.'],
  boss: ['Boss of the cobble bed! Listen… someone is coming.', 'I am the boss!'],
  female: ['A female! Go to her and press Space.', 'Go and say hi!'],
  findmale: ['The boys have dug dens. Go to one and press Space.', 'Find a boy lobster!'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  hermoult: ['Safe in his den, you moult. Wait while your new shell hardens.', 'I moult in his den.'],
  brood: ['Your eggs are under your tail. Keep them clean and fan them. Months go by…', 'My eggs! Fan them…'],
  moonready: ['A summer night! Climb onto your cobble and let the larvae go.', 'Night! Let the larvae go!'],
  release: ['When the glow swells, press Space to fan your larvae free!', 'Glow! Press Space!'],
  larvae: ['Your larvae are swimming up to the surface. The cycle begins again!', 'The larvae swim up!'],
  done: ['Your job is done. Rest in your den.', 'All done. Rest!'],
  friend: ['Other little lobsters are settling on the cobble bed too.', 'Lots of lobster friends!'],
  flipped: ['A tail flip! Snap, and you shot backwards.', 'Snap! I went backwards!'],
  cold: ['Brr, the water is cold up here. Keep walking down to the deep.', 'Cold! Go down!']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* the tide: two highs a day on the Maine coast (−1 low … 1 high) */
function tideAt(tod) { return Math.cos((tod - .21) * TAU * 2); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
/* the seasons of the Gulf of Maine, for the HUD */
const SEASON_INFO = { spring: ['🌱 Spring', 8], summer: ['☀️ Summer', 14], autumn: ['🍂 Autumn', 11], winter: ['❄️ Winter', 4] };
