/* ============================================================
   readlex.js — the leveled words and texts for Read to Play
   ============================================================
   Ported from Frog Pond (see its READING_DESIGN.md).  Levels
   follow guided-reading levels A–E (Fountas & Pinnell):
     A  one short line, a repeated pattern, a handful of sight words
     B  one or two lines, the pattern changes at the end
     C  two to five lines, more sight words, simple verbs
     D  longer sentences, less repetition
     E  several sentences, more varied words
   READ_LEVELS, LEVEL_INFO and LEVEL_NEW are shared with the other
   Tactile Forge games, word for word, so a level means the same
   everywhere.  GAME_NEW holds the few words this game adds on
   purpose (a monarch has to fly, hang and drink).  Every word a
   child meets must be in LEVEL_WORDS for that level (cumulative)
   or be a picture noun (PIC_NOUNS), which at A and B is drawn
   with a little picture next to it, like a rebus book.
   smoke.js checks every text below against these lists.
   ============================================================ */
'use strict';

const READ_LEVELS = ['A', 'B', 'C', 'D', 'E'];
const LEVEL_INFO = {
  A: { name: 'Level A', choices: 2, window: 10, help: 6, buildMax: 4, rebus: true, tasks: ['match'], about: 'One short line. A few sight words. Pictures help.' },
  B: { name: 'Level B', choices: 3, window: 8, help: 9, buildMax: 6, rebus: true, tasks: ['build'], about: 'One or two lines. The pattern changes at the end.' },
  C: { name: 'Level C', choices: 3, window: 7, help: 12, buildMax: 7, rebus: false, tasks: ['build', 'yesno'], about: 'Two to five lines. More sight words and action words.' },
  D: { name: 'Level D', choices: 3, window: 6, help: 15, buildMax: 8, rebus: false, tasks: ['fill', 'yesno'], about: 'Longer sentences with less repeating.' },
  E: { name: 'Level E', choices: 3, window: 6, help: 18, buildMax: 9, rebus: false, tasks: ['fill', 'yesno'], about: 'Several sentences, more varied words.' }
};

/* new words at each level; a level may use its own words and every earlier level's (shared, do not edit here) */
const LEVEL_NEW = {
  A: 'a an i see the can look at is my like go me we up am in it to eat hop no yes down sleep sing',
  B: 'and here you big little come said not on he she get swim sit hide out have two three four one what this fast run jump play all will are for with night black green red brown cold air kick want of they do has too',
  C: 'bites read word words into went was now some where there that then back under away dive snap lay from time day warm wet new good help find rest grow grew gone puff other top wake wiggle put dots be wants by over our',
  D: 'spring hungry when again so after just very could about make came saw off soon first last long open stay know feel deep safe slow tiny keeps hiding its jaw shoots toes as front smaller every climb lily buzzes throat balloon song hatch did short covers dig soft until must days gets sits next hop up',
  E: 'goes lid still stiff singing them eating your tongue because through around before while something tickles webbed well gills close lungs gulp shrinking push stuck ball dot waiting flick zoom like spring winter every quiet other bright wakes hungry warmer melts sunny fills'
};
/* words this game adds, on purpose (a monarch flies, hangs, drinks and goes south) */
const GAME_NEW = {
  A: 'fly hang drink pop',
  B: 'land yellow white orange',
  C: 'chew wind gold',
  D: 'south north',
  E: 'sap sticky cut'
};
const LEVEL_WORDS = (function () {
  const out = {}; let acc = new Set();
  for (const L of READ_LEVELS) { for (const w of (LEVEL_NEW[L] + ' ' + GAME_NEW[L]).split(/\s+/)) if (w) acc.add(w); out[L] = new Set(acc); }
  return out;
})();

/* nouns a child can read from the picture; value = picture key (see Reading.picture) */
const PIC_NOUNS = {
  egg: 'egg', eggs: 'egg', caterpillar: 'caterpillar', caterpillars: 'caterpillar', stripes: 'caterpillar', skin: 'skin',
  j: 'jhang', chrysalis: 'chrysalis', butterfly: 'monarch', butterflies: 'monarch', monarch: 'monarch', monarchs: 'monarch', wings: 'wings', wing: 'wings',
  leaf: 'leaf', leaves: 'leaf', milkweed: 'milkweed', flower: 'flower', flowers: 'flower', nectar: 'flower', pod: 'pod', pods: 'pod', seeds: 'seed', seed: 'seed',
  tree: 'tree', trees: 'tree', fir: 'fir', forest: 'fir', sun: 'sun', moon: 'moon', rain: 'rain', storm: 'rain', lake: 'water', water: 'water',
  bird: 'bird', birds: 'bird', wasp: 'wasp', ant: 'ant', ants: 'ant', bug: 'aphid', bugs: 'aphid', mantis: 'mantis',
  mexico: 'map', texas: 'map', map: 'map', net: 'net', tag: 'tag'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  chew:    { A: 'go',    B: 'out',   C: 'chew',    D: 'chew out',           E: 'Chew out of the egg.' },
  eat:     { A: 'eat',   B: 'eat',   C: 'eat',     D: 'eat the leaf',       E: 'Eat the green leaf.' },
  hide:    { A: 'down',  B: 'hide',  C: 'hide',    D: 'stay down',          E: 'Stay very still!' },
  hang:    { A: 'hang',  B: 'hang',  C: 'hang up', D: 'hang in a J',        E: 'Hang down in a J.' },
  wiggle:  { A: 'go',    B: 'go',    C: 'wiggle',  D: 'wiggle and grow',    E: 'Wiggle so the birds stay away.' },
  fly:     { A: 'fly',   B: 'fly',   C: 'fly',     D: 'fly up and away',    E: 'Fly up into the air.' },
  drink:   { A: 'drink', B: 'drink', C: 'drink',   D: 'drink the nectar',   E: 'Drink nectar from the flower.' },
  land:    { A: 'down',  B: 'land',  C: 'land',    D: 'land on the milkweed', E: 'Land on the milkweed.' },
  pop:     { A: 'pop',   B: 'pop',   C: 'pop it',  D: 'pop the pod',        E: 'Pop the pod and get the seeds.' },
  lay:     { A: 'eggs',  B: 'eggs',  C: 'lay eggs', D: 'lay an egg',        E: 'Lay an egg under the leaf.' },
  mate:    { A: 'go',    B: 'come',  C: 'come with me', D: 'fly to the monarch', E: 'Fly after the other monarch.' },
  dive:    { A: 'down',  B: 'down',  C: 'dive',    D: 'dive down fast',     E: 'Dive down fast to get away!' },
  sleep:   { A: 'sleep', B: 'sleep', C: 'sleep',   D: 'sleep in the tree',  E: 'Sleep in the tree for the night.' },
  shelter: { A: 'down',  B: 'hide',  C: 'hide',    D: 'hide in the tree',   E: 'Hide in the tree from the rain.' },
  rest:    { A: 'down',  B: 'sit',   C: 'rest',    D: 'sit down and rest',  E: 'Sit down and rest a little.' },
  south:   { A: 'go',    B: 'go',    C: 'fly on',  D: 'fly south',          E: 'Fly on to Mexico!' }
};
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are read before the monarch can grow on (the
   wrapped growth methods in reading.js, or a journey button). */
const READ_CHAPTERS = {
  egg: { title: 'An egg', pic: 'egg', gate: false,
    A: ['I am in an egg.', 'I see a leaf.', 'I can eat!'],
    B: ['I am a little egg.', 'I am on a big green leaf.', 'Here I come!'],
    C: ['I am a little egg.', 'My egg is under a leaf.', 'The leaf is milkweed.', 'Now I will chew out!'],
    D: ['I am a tiny egg under a milkweed leaf.', 'The leaf keeps me safe.', 'Soon I will hatch and eat the leaf.'],
    E: ['I am a tiny egg, like a little dot.', 'I am stuck under a milkweed leaf.', 'Soon I will chew out of my egg and eat it!'],
    yesno: [['Am I on a leaf?', true], ['Can I fly?', false]] },
  instar2: { title: 'Too big!', pic: 'caterpillar', gate: true,
    A: ['I eat the leaf.', 'I eat, eat, eat.', 'Look at me!'],
    B: ['I eat and eat.', 'I am too big for my skin!', 'Out I come!'],
    C: ['I eat and eat.', 'Now I am too big for my skin.', 'I wiggle out of it.', 'Then I eat my skin!'],
    D: ['I eat until I am too big for my skin.', 'I wiggle out of it, and I am new!', 'Then I eat the skin I came out of.'],
    E: ['I eat until I am too big for my skin.', 'I push and wiggle until I am out.', 'My new skin is soft. Then I eat the skin I came out of!'],
    yesno: [['Do I eat my skin?', true], ['Am I a bird?', false]] },
  instar3: { title: 'Stripes', pic: 'caterpillar', gate: true,
    A: ['I see my stripes.', 'I like my stripes!'],
    B: ['Look at me!', 'I have black and yellow stripes.', 'Birds, do not eat me!'],
    C: ['Look at my stripes!', 'They are black, yellow and white.', 'The birds see my stripes and go away.'],
    D: ['I have black, yellow and white stripes.', 'I eat milkweed, so I am not good to eat.', 'The birds know it, and they stay away.'],
    E: ['My stripes are black, yellow and white.', 'Because I eat milkweed, I am not good to eat.', 'The birds see my bright stripes and stay away.'],
    yesno: [['Do I have stripes?', true], ['Do birds like to eat me?', false]] },
  instar4: { title: 'Only milkweed', pic: 'milkweed', gate: true,
    A: ['I eat the milkweed.', 'I like milkweed!'],
    B: ['I am big!', 'I eat the milkweed leaf.', 'It is all I want!'],
    C: ['I am big now.', 'I eat milkweed and no other leaf.', 'Milkweed is all I want to eat.'],
    D: ['I am big now, and I eat very fast.', 'I eat milkweed and no other leaf.', 'Milkweed is all I want to eat.'],
    E: ['I am big now, and I eat day and night.', 'Milkweed sap is sticky, so I cut the leaf first.', 'The sap goes out, and then I eat.'],
    yesno: [['Do I eat milkweed?', true], ['Do I eat all the other leaves?', false]] },
  instar5: { title: 'So big!', pic: 'caterpillar', gate: true,
    A: ['Look at me!', 'I eat a leaf.', 'I eat a leaf, a leaf!'],
    B: ['I am big, big, big!', 'I eat all the leaves.', 'I want to hang.'],
    C: ['Now I am big!', 'I eat and eat and eat.', 'Then I will find a good leaf to hang from.'],
    D: ['This is my last skin, and I am very big.', 'I can eat a big leaf in one day!', 'Then I will look for a safe leaf to hang from.'],
    E: ['This is my last skin, and I am very big.', 'I can eat a big leaf in one day.', 'Before long, I will climb off to find a safe leaf to hang from.'],
    yesno: [['Am I big now?', true], ['Am I a little egg?', false]] },
  hang: { title: 'The J', pic: 'jhang', gate: true,
    A: ['I can hang.', 'I hang down in a J!'],
    B: ['I hang down.', 'I look like a J.', 'Look at me!'],
    C: ['I hang down from a leaf.', 'I look like a J.', 'Now I will wiggle out of my skin.'],
    D: ['I hang down from the leaf in a J.', 'I stay like this for a day.', 'Then I will wiggle out of my last skin.'],
    E: ['I hang down from the leaf like a J.', 'I stay very still for one day.', 'Then I push and wiggle until my last skin is gone.'],
    yesno: [['Do I hang down?', true], ['Do I look like a J?', true], ['Can I fly now?', false]] },
  chrysalis: { title: 'A chrysalis', pic: 'chrysalis', gate: false,
    A: ['I am in a chrysalis.', 'I sleep, sleep, sleep.'],
    B: ['I am a green chrysalis.', 'I hang here and sleep.', 'I will have wings!'],
    C: ['I am a green chrysalis now.', 'I have little gold dots.', 'I will grow wings in here!'],
    D: ['I am a green chrysalis with gold dots.', 'I do not eat, and I stay here.', 'Soon I will have wings!'],
    E: ['I am a green chrysalis with bright gold dots.', 'I do not eat. I hang quiet and still.', 'In here, my wings grow.'],
    yesno: [['Am I green?', true], ['Do I eat now?', false]] },
  butterfly: { title: 'A butterfly!', pic: 'monarch', gate: true,
    A: ['I am a butterfly!', 'I can fly!'],
    B: ['Look at me!', 'I am a butterfly.', 'I have big wings!'],
    C: ['I am out of my chrysalis!', 'I am a butterfly now.', 'My wings are wet.', 'Then I will fly!'],
    D: ['I climb out of my chrysalis.', 'My wings are wet and soft.', 'I must hang here, and then I can fly.'],
    E: ['I push out of my chrysalis, wet and soft.', 'I hang very still while my wings open.', 'Soon I will fly away!'],
    yesno: [['Do I have wings?', true], ['Am I a caterpillar now?', false]] },
  south: { title: 'Fly south', pic: 'map', gate: true,
    A: ['I can fly.', 'I go to Mexico!'],
    B: ['It is cold at night.', 'I will fly to Mexico.', 'Here I go!'],
    C: ['It is cold at night now.', 'I will fly to Mexico.', 'I have to go now!'],
    D: ['The days are short and it is cold at night.', 'I will fly south to Mexico.', 'I know where to go!'],
    E: ['The days are short, and the air is cold.', 'I will fly south to Mexico.', 'The sun will help me find where to go.'],
    yesno: [['Do I fly to Mexico?', true], ['Is it warm at night?', false]] },
  forest: { title: 'The forest', pic: 'fir', gate: true,
    A: ['I see the trees.', 'I see the monarchs!', 'I sleep.'],
    B: ['I am in Mexico!', 'Look at all the monarchs!', 'We sleep in the trees.'],
    C: ['I am in Mexico now!', 'There are monarchs on all the trees.', 'We sleep here in the cold.'],
    D: ['I am in Mexico at last!', 'Monarchs hang on every tree.', 'We will stay here and sleep until spring.'],
    E: ['At last, I am in the fir forest in Mexico!', 'The trees are orange with monarchs.', 'We will sleep, quiet and still, until spring.'],
    yesno: [['Am I in Mexico?', true], ['Are there other monarchs here?', true], ['Am I a caterpillar?', false]] },
  spring: { title: 'Spring', pic: 'sun', gate: true,
    A: ['I see the sun!', 'I am up!', 'I go up, up, up!'],
    B: ['The sun is out!', 'I am up.', 'I will fly to the milkweed.'],
    C: ['The sun is warm now.', 'I wake up and fly away.', 'I will find new milkweed and lay eggs.'],
    D: ['Spring is here, and the sun is warm.', 'I fly north to find the first milkweed.', 'There I will lay my eggs.'],
    E: ['Spring is here, and the forest wakes up.', 'I fly north to Texas, where the new milkweed is up.', 'I will lay my eggs, and the monarchs will go on.'],
    yesno: [['Is the sun out?', true], ['Do I sleep now?', false]] },
  eggs: { title: 'My eggs', pic: 'egg', gate: true,
    A: ['I see a leaf.', 'I see my egg!', 'I see my eggs!'],
    B: ['Here is my egg.', 'It is on a leaf.', 'One, two, three eggs!'],
    C: ['I put my eggs under three leaves.', 'They are little white eggs.', 'They will be caterpillars!'],
    D: ['I lay one egg under every leaf.', 'So every caterpillar will have a leaf to eat.', 'Soon they will hatch.'],
    E: ['I lay one egg under every leaf.', 'Every caterpillar will have a leaf to eat.', 'They will fly north, and the monarchs will go on.'],
    yesno: [['Did I lay eggs?', true], ['Are my eggs on a leaf?', true], ['Are the eggs on a tree?', false]] },
  mate: { title: 'A friend', pic: 'monarch', gate: true,
    A: ['I see a monarch.', 'We fly.', 'We fly up, up, up!'],
    B: ['I see a monarch.', 'She is here!', 'We fly and play.'],
    C: ['I see a monarch.', 'We fly up and down.', 'Now she can lay eggs.'],
    D: ['I saw a monarch by the milkweed.', 'We fly up and down in the sun.', 'Soon she will lay eggs on the leaves.'],
    E: ['I saw a monarch by the milkweed.', 'We fly around and around in the sun.', 'Soon she will lay eggs, and the monarchs will go on.'],
    yesno: [['Did I see a monarch?', true], ['Is she a monarch?', true], ['Will she lay eggs?', true], ['Is she a bird?', false]] }
};

/* ---------- read-and-do missions ----------
   who: larva | plant (an adult on the milkweed) | flying (in the air
   over the milkweed) | pods | route (flying south) | nectar | thermal |
   dusk.  min: the lowest level the mission is offered at. */
const MISSIONS = [
  { key: 'leaf', who: 'larva', A: 'Go to a leaf.', B: 'Go to a big leaf.', C: 'Find a new leaf.', D: 'Find a new leaf to eat.', E: 'Find a new green leaf to eat.' },
  { key: 'eat3', who: 'larva', A: 'Eat, eat, eat!', B: 'Eat the green leaf.', C: 'Eat three bites.', D: 'Eat three bites of the leaf.', E: 'Eat three bites of a green leaf.' },
  { key: 'down', who: 'larva', A: 'Go down, down, down.', B: 'Go down, down, down!', C: 'Go down the milkweed.', D: 'Climb down the milkweed.', E: 'Climb down the milkweed, down, down!' },
  { key: 'up', who: 'larva', A: 'Go up, up, up!', B: 'Go up the milkweed.', C: 'Go up to the top.', D: 'Climb up to the top of the milkweed.', E: 'Climb up to the flowers at the top.' },
  { key: 'ants', who: 'larva', A: 'Look at the ants.', B: 'Go to the ants.', C: 'Find the ants.', D: 'Find the ants by the little bugs.', E: 'Find the ants and the little bugs.' },
  { key: 'bugs', who: 'larva', A: 'Look at the bugs.', B: 'Look at the little bugs.', C: 'Find the yellow bugs.', D: 'Find the little yellow bugs.', E: 'Find the yellow bugs on the milkweed.' },
  { key: 'still', who: 'larva', min: 'B', A: '', B: 'Sit on a leaf.', C: 'Sit on a leaf and hide.', D: 'Hide on a leaf and stay down.', E: 'Hide on a leaf and stay very still.' },
  { key: 'drink', who: 'plant', A: 'Drink at a flower.', B: 'Drink at a flower.', C: 'Drink from the flowers.', D: 'Fly to a flower and drink.', E: 'Fly to a flower and drink the nectar.' },
  { key: 'pod', who: 'pods', A: 'Pop a pod.', B: 'Pop a pod.', C: 'Find a pod and pop it.', D: 'Find a pod and pop it.', E: 'Pop a pod to get the seeds.' },
  { key: 'top', who: 'flying', A: 'Fly up, up, up!', B: 'Fly up, up, up!', C: 'Fly up over the milkweed.', D: 'Fly up over the top of the milkweed.', E: 'Fly up over the flowers at the top.' },
  { key: 'land', who: 'flying', A: 'Go down to a leaf.', B: 'Land on a leaf.', C: 'Land on a leaf.', D: 'Land on a big green leaf.', E: 'Land on a leaf and sit in the sun.' },
  { key: 'high', who: 'route', A: 'Go up, up, up!', B: 'Fly up, up, up!', C: 'Fly up over the trees.', D: 'Fly up over the trees.', E: 'Fly up into the cold air.' },
  { key: 'low', who: 'route', A: 'Go down, down, down.', B: 'Fly down, down, down.', C: 'Fly down by the flowers.', D: 'Fly down by the flowers.', E: 'Fly down, just over the flowers.' },
  { key: 'nectar', who: 'nectar', A: 'Drink at a flower.', B: 'Drink at the flowers.', C: 'Find flowers and drink.', D: 'Find flowers and drink nectar.', E: 'Find flowers and drink the nectar.' },
  { key: 'thermal', who: 'thermal', min: 'C', A: '', B: '', C: 'Go up in the warm air.', D: 'Go up in the warm air.', E: 'Go up in the warm air, around and around.' },
  { key: 'flock', who: 'route', A: 'Look at the monarchs.', B: 'Fly with the monarchs.', C: 'Fly with the other monarchs.', D: 'Fly with the other monarchs.', E: 'Fly next to the other monarchs.' },
  { key: 'tree', who: 'dusk', A: 'Sleep in a tree.', B: 'Sleep in a tree.', C: 'Find a tree to sleep in.', D: 'Find a tree and sleep for the night.', E: 'Find a tree and sleep there for the night.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'Go! Go! Go!', B: 'Go! Come out!', C: 'Read the word to chew out.', D: 'Read the words to chew out of the egg.', E: 'Read the words to chew out of your egg.' },
  crawl: { A: 'Go to a leaf.', B: 'Go to a leaf and eat.', C: 'Go to a leaf and eat.', D: 'Go to a green leaf and eat.', E: 'Go to a green leaf and eat it.' },
  bite: { A: 'Eat the leaf.', B: 'Eat the green leaf.', C: 'Eat the leaf. Then find a new one.', D: 'Eat the leaf, then find a new one.', E: 'Eat the leaf. When it is gone, find a new one.' },
  branch: { A: 'Go to a leaf.', B: 'Go to a big leaf.', C: 'Find a new leaf.', D: 'Find a new leaf to eat.', E: 'Find a new green leaf to eat.' },
  molt: { A: 'Look at me!', B: 'Look at me!', C: 'Now I grow!', D: 'I am too big for my skin!', E: 'I am too big for my skin!' },
  readyHang: { A: 'I can hang!', B: 'I want to hang!', C: 'Find where to hang.', D: 'Find a safe leaf to hang from.', E: 'Find a safe, bright leaf to hang from.' },
  jhang: { A: 'I hang in a J.', B: 'I hang like a J.', C: 'I hang like a J. Wiggle!', D: 'I hang like a J. Wiggle and grow!', E: 'I hang like a J. Wiggle so the birds stay away!' },
  chrysalis: { A: 'I sleep, sleep, sleep.', B: 'I am a green chrysalis.', C: 'I will grow wings.', D: 'In here, I grow wings.', E: 'In here, my wings grow.' },
  drying: { A: 'I see my wings.', B: 'My wings are big!', C: 'My wings are wet.', D: 'I stay here until I can fly.', E: 'I hang very still until I can fly.' },
  adult: { A: 'Fly to a flower.', B: 'Fly to a flower and drink.', C: 'Fly to a flower and drink.', D: 'Fly to a flower and drink.', E: 'Fly to the flowers and drink the nectar.' },
  summerAdult: { A: 'Fly to a flower.', B: 'Fly to a flower and drink.', C: 'Fly to a flower and drink.', D: 'Fly to a flower and drink.', E: 'Fly to the flowers and drink the nectar.' },
  flying: { A: 'Fly to a flower.', B: 'Fly to a flower.', C: 'Fly to a flower and land.', D: 'Fly to a flower and land on it.', E: 'Fly to a flower and land on it.' },
  sip: { A: 'Drink!', B: 'Drink at the flower!', C: 'Drink at the flower!', D: 'Drink the nectar!', E: 'Drink the nectar from the flower!' },
  readyGo: { A: 'Go to Mexico!', B: 'I will fly to Mexico!', C: 'It is time to fly to Mexico!', D: 'It is time to fly south!', E: 'The days are short. Time to fly south!' },
  migrate: { A: 'Fly! Go, go, go!', B: 'Fly to Mexico!', C: 'Fly on to Mexico.', D: 'Fly south to Mexico.', E: 'Fly south, and rest your wings in the wind.' },
  thermal: { A: 'Go up, up, up!', B: 'Go up in the air!', C: 'Warm air! Go up!', D: 'Warm air! Go up with it.', E: 'Go up in the warm air!' },
  lowEnergy: { A: 'Drink at a flower!', B: 'Drink at a flower!', C: 'Find flowers and drink!', D: 'Find flowers and drink nectar!', E: 'Find flowers and drink the nectar!' },
  dusk: { A: 'Sleep in a tree.', B: 'It is night. Sleep in a tree.', C: 'It is night. Sleep in a tree.', D: 'It will soon be night. Find a tree.', E: 'The sun goes down. Find a tree to sleep in.' },
  roosting: { A: 'I sleep in the tree.', B: 'We sleep in the tree.', C: 'We sleep in the tree.', D: 'We sleep in the tree until it is day.', E: 'We sleep in the tree until the sun is up.' },
  stormWarn: { A: 'Rain! Go to a tree.', B: 'Rain! Hide in a tree!', C: 'Rain! Hide in a tree!', D: 'Rain! Hide in a tree, fast!', E: 'A storm! Hide in a tree, fast!' },
  storm: { A: 'Rain! Go to a tree.', B: 'Rain! Hide in a tree!', C: 'Rain! Hide in a tree!', D: 'Rain! Hide in a tree, fast!', E: 'A storm! Hide in a tree, fast!' },
  lake: { A: 'I see the lake!', B: 'Look at the big lake!', C: 'Drink, then fly over the lake.', D: 'Drink first, then fly over the lake.', E: 'Drink first, then fly over the lake with the wind.' },
  exhausted: { A: 'I am down. I sleep.', B: 'I sit down.', C: 'I rest. Then I drink.', D: 'I must rest. Then I will find flowers.', E: 'I must rest. Then I will find flowers to drink from.' },
  wasp: { A: 'A wasp! Go down!', B: 'A wasp! Hide!', C: 'A wasp! Hide on a leaf!', D: 'A wasp! Stay down and hide!', E: 'A wasp! Stay very still!' },
  safe: { A: 'No wasp!', B: 'It is not here!', C: 'It went away!', D: 'It went away. I am safe.', E: 'It went away. I am safe now.' },
  mantisNear: { A: 'A mantis! Go down!', B: 'A mantis! Hide!', C: 'A mantis! Go back!', D: 'Stay away from the mantis!', E: 'A mantis is on that leaf. Stay away!' },
  fell: { A: 'Go up, up, up!', B: 'Go up, up, up!', C: 'Go back up!', D: 'Climb back up to the leaf!', E: 'Climb back up to the leaf!' },
  pod: { A: 'Pop the pod!', B: 'Pop the pod!', C: 'Pop the pod and get the seeds!', D: 'Pop the pod and get the seeds!', E: 'Pop the pod and get the seeds!' },
  laying: { A: 'Eggs! Go to a leaf.', B: 'Eggs! Go to a leaf.', C: 'Lay an egg under a leaf.', D: 'Lay an egg under every leaf.', E: 'Lay one egg under every leaf.' },
  mate: { A: 'I see a monarch!', B: 'Go to the monarch.', C: 'Fly to the other monarch.', D: 'Fly to the other monarch.', E: 'Find the other monarch and fly with it.' },
  bird: { A: 'A bird! Go down!', B: 'A bird! Go down fast!', C: 'A bird! Dive!', D: 'A bird! Dive down fast!', E: 'A bird! Dive down fast to get away!' },
  spat: { A: 'Yes! I can go!', B: 'Birds do not like me!', C: 'Birds do not like me!', D: 'The bird did not like me!', E: 'The bird did not like me. Milkweed is in me!' },
  tagged: { A: 'I see a net!', B: 'Look! A net!', C: 'A tag for my wing!', D: 'A tag is on my wing. It is safe.', E: 'A tag goes on my wing. It is safe.' },
  forecast: { A: 'I sleep in the tree.', B: 'Will I fly? Will I sleep?', C: 'Look at the wind. Will I fly?', D: 'Look at the wind. Will I fly? Will I stay?', E: 'Look at the wind. Is it good to fly?' },
  waiting: { A: 'I sleep.', B: 'I sleep in the tree.', C: 'I rest here for a day.', D: 'I stay here for one day.', E: 'I stay here and rest for a day.' },
  forest: { A: 'Sleep in a fir.', B: 'Sleep in a fir tree.', C: 'Find a fir tree and sleep.', D: 'Find a fir tree and sleep.', E: 'Find a fir tree and sleep with the other monarchs.' },
  arrived: { A: 'I am in Mexico!', B: 'We are here!', C: 'I am in Mexico!', D: 'I am in Mexico at last!', E: 'At last, I am in Mexico!' },
  winterFly: { A: 'Fly in the sun.', B: 'Fly in the sun!', C: 'Fly in the sun, then sleep in a fir.', D: 'Fly in the sun, then sleep in a fir.', E: 'Fly in the sun, then sleep in a fir tree.' },
  landHint: { A: 'Go down to a leaf.', B: 'Go to a leaf and land.', C: 'Get by a leaf, then land.', D: 'Get by a leaf, then land.', E: 'Get by a leaf, then land on it.' }
};
