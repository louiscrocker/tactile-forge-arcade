/* ============================================================
   readlex.js — the leveled words and texts for Read to Play
   ============================================================
   Levels follow guided-reading levels A–E (Fountas & Pinnell):
     A  one short line, a repeated pattern, a handful of sight words
     B  one or two lines, the pattern changes at the end
     C  two to five lines, more sight words, simple verbs
     D  longer sentences, less repetition
     E  several sentences, more varied words
   Every word a child meets must be in LEVEL_WORDS for that level
   (cumulative) or be a picture noun (PIC_NOUNS), which at A and B
   is drawn with a little picture next to it, like a rebus book.
   smoke.js checks every text below against these lists.

   READ_LEVELS, LEVEL_INFO and LEVEL_NEW are shared with Frog Pond
   and Ladybug Life (see Frog Pond's READING_DESIGN.md) so a level
   means the same thing in every Tactile Forge game.  Words only
   this game needs are in LEVEL_EXTRA, on purpose, one level at a
   time.
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
const LEVEL_NEW = {
  A: 'a an i see the can look at is my like go me we up am in it to eat hop no yes down sleep sing',
  B: 'and here you big little come said not on he she get swim sit hide out have two three four one what this fast run jump play all will are for with night black green red brown cold air kick want of they do has too',
  C: 'bites read word words into went was now some where there that then back under away dive snap lay from time day warm wet new good help find rest grow grew gone puff other top wake wiggle put dots be wants by over our',
  D: 'spring hungry when again so after just very could about make came saw off soon first last long open stay know feel deep safe slow tiny keeps hiding its jaw shoots toes as front smaller every climb lily buzzes throat balloon song hatch did short covers dig soft until must days gets sits next hop up',
  E: 'goes lid still stiff singing them eating your tongue because through around before while something tickles webbed well gills close lungs gulp shrinking push stuck ball dot waiting flick zoom like spring winter every quiet other bright wakes hungry warmer melts sunny fills'
};
/* words only Red Crab needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'dig push hi ride dip shut shake big blue king go swim',
  B: 'hatch so skin yum lots now wiggle splash pop off mum hot shade hole home glow spots top catch wait mine again him win say away find by over into day whoosh ok good grow food way hard deep back door soft went gone dots ants',
  C: 'mum food takes tail land moult shell door old years live glows island soil sky another won girl lose dark ten bits jumpy shakes made people whale bus come comes tight did more bump them swims as eats does us boy safe jumps flick others dry cool hid had full try best his when',
  D: 'carries tummy walked touch salty eyes spike bigger half shrimp crawl onto pea small took nine cool damp place hand wide moment right shaken flash light school biggest world mouth opens drifts along free steep sharp tips legs gills breathe dries floor split inside hard huge walks crack coconuts season millions leave march rangers built fences male who win ready female carry flap twelve fallen pretty sweet grown her helps keep walk around sink dash or tumbled but follow arrow cracks drying deeper enough fence give shove pushed terrace growing brothers sisters crazy',
  E: 'mother wide flap dawn stands edge shakes once grain rice body huge spikes stretch split old wriggle walking swimming megalopae thousands together five millimetres across turn baby reach rainforest shade moulted fully season each hatches touches quarter starts larva month moults own called bioluminescence shining sweeps past swallow teeth sucks mouthfuls visit larvae taxi straight walk millions shady places lives alone pump myself hardens full calcium weigh much cat looking rains signal pour great begins people build bridges low guide tunnels safely soak salt boys terrace fight shove gives nobody hurt strongest part hundred thousand munch ripe chase sharp drifts makes than year their bumps sharks roads arrows near coming towards seabird digging cross rival hello washes job done marching yellow'
};
const LEVEL_WORDS = (function () {
  const out = {}; let acc = new Set();
  for (const L of READ_LEVELS) {
    for (const w of (LEVEL_NEW[L] + ' ' + LEVEL_EXTRA[L]).split(/\s+/)) if (w) acc.add(w);
    out[L] = new Set(acc);
  }
  return out;
})();

/* nouns a child can read from the picture; value = picture key (see Reading.picture) */
const PIC_NOUNS = {
  crab: 'crab', crabs: 'crab', egg: 'egg', eggs: 'eggs', zoea: 'zoea', megalopa: 'megalopa',
  sea: 'sea', ocean: 'sea', wave: 'sea', waves: 'sea', water: 'water', plankton: 'plankton',
  jelly: 'jelly', jellyfish: 'jelly', shark: 'whaleshark', fish: 'fish', reef: 'reef', turtle: 'turtle',
  rock: 'rock', rocks: 'rock', cliff: 'cliff', forest: 'forest', tree: 'tree', trees: 'tree',
  leaf: 'leaf', leaves: 'leaf', flower: 'flower', flowers: 'flower', fruit: 'fruit', fig: 'fruit',
  seedling: 'seedling', burrow: 'burrow', burrows: 'burrow', claw: 'claw', claws: 'claw', shell: 'shell',
  moon: 'moon', sun: 'sun', rain: 'rain', road: 'bridge', bridge: 'bridge', bird: 'bird', birds: 'bird',
  ranger: 'ranger', rangers: 'ranger', copepod: 'copepod', robber: 'robber', manta: 'manta'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:   { A: 'eat',   B: 'eat',     C: 'eat it',          D: 'eat this food',          E: 'Eat it up. Yum!' },
  ride:  { A: 'ride',  B: 'ride it', C: 'ride the jelly',  D: 'get on the jellyfish',   E: 'Ride the jellyfish home.' },
  hop:   { A: 'hop',   B: 'hop off', C: 'hop off it',      D: 'hop off the jelly',      E: 'Hop off the jellyfish.' },
  dip:   { A: 'dip',   B: 'dip in',  C: 'go in the sea',   D: 'dip in the sea',         E: 'Dip into the salty sea.' },
  push:  { A: 'push',  B: 'push',    C: 'push him',        D: 'push the crab',          E: 'Push him away!' },
  meet:  { A: 'hi',    B: 'say hi',  C: 'go and say hi',   D: 'say hi to the crab',     E: 'Go and say hello.' },
  moult: { A: 'shut',  B: 'shut it', C: 'shut the door',   D: 'shut the door and moult', E: 'Shut the door with leaves and moult.' },
  shake: { A: 'shake', B: 'shake',   C: 'shake them',      D: 'shake out my eggs',      E: 'Shake my eggs into the sea.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'leaf', ride: 'jelly', hop: 'megalopa', dip: 'sea', push: 'rival', meet: 'crab', moult: 'shell', shake: 'eggs' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the crab's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'An egg by the sea', pic: 'eggs', gate: false,
    A: ['I am an egg.', 'I see the sea.', 'I go in the sea!'],
    B: ['I am a little egg.', 'Mum has lots of eggs.', 'We will go in the sea!'],
    C: ['I am a little egg.', 'My mum has lots and lots of eggs.', 'She is at the sea now.'],
    D: ['My mum carries her eggs under her tummy.', 'She walked down to the sea.', 'Soon a wave will come.'],
    E: ['A mother crab carries her eggs under a wide flap.', 'Before dawn she stands at the edge of the sea.', 'When a wave comes, she shakes her eggs into the water.'],
    yesno: [['Am I an egg?', true], ['Am I a big crab?', false]] },
  hatch: { title: 'Splash!', pic: 'zoea', gate: true,
    A: ['I go in the sea!', 'I am a zoea.', 'I can swim.'],
    B: ['Splash! I go in the sea.', 'Pop! I hatch out.', 'I am a little zoea.'],
    C: ['A wave takes me into the sea.', 'Pop! I hatch out of my egg.', 'Now I am a zoea. I can swim!'],
    D: ['I hatch as soon as I touch the salty sea.', 'I am a tiny zoea with big eyes.', 'I have a long spike on my back.'],
    E: ['The salty water makes my egg pop open at once.', 'I am a zoea, smaller than a grain of rice.', 'My see-through body has huge black eyes and long spikes.'],
    yesno: [['Am I in the sea?', true], ['Am I a big crab now?', false]] },
  zoea2: { title: 'Too tight!', pic: 'zoea', gate: true,
    A: ['I am a zoea.', 'I eat, eat, eat.'],
    B: ['My skin is too little.', 'I wiggle out of it!', 'Now I am big.'],
    C: ['I eat lots of green plankton.', 'My skin is too tight.', 'I wiggle out of it. Now I am big!'],
    D: ['When my skin gets too tight, I must get out of it.', 'I moult and come out bigger.', 'Now I am a bigger zoea.'],
    E: ['A zoea can not stretch its skin, so it must moult.', 'I split my old skin and wriggle out.', 'My new skin is soft and bigger.'],
    yesno: [['Did I get out of my skin?', true], ['Am I a fish now?', false]] },
  grow: { title: 'Bigger and bigger', pic: 'plankton', gate: false,
    A: ['I eat, eat, eat.', 'I am a big zoea!'],
    B: ['I eat the green plankton.', 'I am a big zoea now.'],
    C: ['I moult again.', 'I eat lots and grow big.'],
    D: ['I moult again and get bigger.', 'Soon I will have claws.'],
    E: ['Every moult makes me a little bigger.', 'A red crab larva moults again and again for about a month.'],
    yesno: [['Do I eat plankton?', true], ['Do I eat rocks?', false]] },
  megalopa: { title: 'A megalopa!', pic: 'megalopa', gate: true,
    A: ['I am a megalopa.', 'I can swim up!'],
    B: ['Look at me now!', 'I have two little claws.', 'I am a megalopa.'],
    C: ['I moult one more time in the sea.', 'Now I have claws and a tail.', 'I want to go back to land.'],
    D: ['After my last moult, I am a megalopa.', 'I am half crab and half shrimp.', 'Now I must swim back to the island.'],
    E: ['A megalopa is half crab and half shrimp.', 'It has small claws, legs for walking and a tail for swimming.', 'It is time to find the island again.'],
    yesno: [['Do I have claws?', true], ['Am I a fish?', false]] },
  ashore: { title: 'Out of the sea', pic: 'baby', gate: true,
    A: ['I go up the rocks.', 'I am a crab!'],
    B: ['I swim to the rocks.', 'I come out of the sea.', 'I am a little red crab!'],
    C: ['The waves push me to the rocks.', 'I come out of the sea.', 'I moult. Now I am a little crab!'],
    D: ['I crawl out of the sea and onto the rocks.', 'I moult one more time.', 'Now I am a tiny red crab, as small as a pea.'],
    E: ['Thousands of megalopae crawl out of the sea together.', 'We moult into tiny crabs, just five millimetres across.', 'The rocks turn red with baby crabs!'],
    yesno: [['Am I a crab now?', true], ['Do I live in the sea now?', false]] },
  forest: { title: 'Into the forest', pic: 'forest', gate: true,
    A: ['I go up, up, up.', 'I see the forest!'],
    B: ['Up and up I go.', 'Here is the big forest.', 'I like it here.'],
    C: ['I go up the cliff.', 'At the top is the forest.', 'It is wet and green.'],
    D: ['It took me nine days to climb up here.', 'The forest is cool and damp.', 'It is a safe place to grow.'],
    E: ['After a long march up the cliff, I reach the rainforest.', 'The shade keeps my gills damp.', 'Here I will grow up.'],
    yesno: [['Is the forest green?', true], ['Is the forest in the sea?', false]] },
  adult: { title: 'Grown up!', pic: 'adult', gate: true,
    A: ['I am big!', 'Look at my claws!'],
    B: ['Look at me!', 'I am a big red crab now.', 'Look at my big claws!'],
    C: ['I shut my door and moult.', 'Now I am a big crab.', 'I am four years old!'],
    D: ['It took four years for me to grow up.', 'My shell is as wide as a hand.', 'Soon the rain will come.'],
    E: ['I moulted every year, and now I am fully grown.', 'My shell is about as wide as your hand.', 'Now I wait for the first big rain of the wet season.'],
    yesno: [['Am I a big crab?', true], ['Am I an egg?', false]] },
  eggs: { title: 'Into the sea', pic: 'eggs', gate: true,
    A: ['I see eggs!', 'Eggs go in the sea.'],
    B: ['Here is the sea.', 'Shake, shake, shake!', 'The eggs go in.'],
    C: ['A big wave comes.', 'The eggs go into the sea.', 'Pop! They hatch!'],
    D: ['The moon is just right.', 'When a wave comes, the eggs are shaken into the sea.', 'They hatch the moment they touch the water.'],
    E: ['At the last quarter of the moon, just before dawn, the eggs go into the sea.', 'Each egg hatches the moment it touches the salty water.', 'Tiny zoea swim away, and it all starts again.'],
    yesno: [['Do the eggs go in the sea?', true], ['Do the eggs go up a tree?', false]] },
  glow: { title: 'The glowing sea', pic: 'plankton', gate: false,
    A: ['I see it!', 'It is blue!'],
    B: ['It is night.', 'Look! Blue dots!', 'They glow.'],
    C: ['It is night in the sea.', 'I bump some plankton and it glows blue!'],
    D: ['At night, some tiny plankton flash blue.', 'They light up when I bump them.'],
    E: ['Some plankton make their own light.', 'When something bumps them, they flash bright blue.', 'This is called bioluminescence.'],
    yesno: [['Do some plankton glow?', true], ['Is the glow red?', false]] },
  fish: { title: 'Fish!', pic: 'fish', gate: false,
    A: ['I see fish!', 'Go, go, go!'],
    B: ['Look at all the fish!', 'They want to eat.', 'I swim away fast!'],
    C: ['Lots of little fish swim by.', 'They eat plankton.', 'I swim away from them.'],
    D: ['A school of tiny fish comes by.', 'They eat plankton as they swim.', 'My long spike helps keep me safe.'],
    E: ['A shining school of fish sweeps past.', 'Fish gulp plankton, so I dive deep and swim away.', 'My spikes make me hard to swallow.'],
    yesno: [['Do fish eat plankton?', true], ['Am I a fish?', false]] },
  whale: { title: 'The whale shark', pic: 'whaleshark', gate: false,
    A: ['I see a shark!', 'It is big!'],
    B: ['Look! A big, big shark!', 'It has spots.', 'I swim away!'],
    C: ['A whale shark swims by.', 'It is as big as a bus!', 'It eats plankton, not crabs.'],
    D: ['The whale shark is the biggest fish in the world.', 'It opens its mouth wide to eat plankton.', 'I swim away from its mouth.'],
    E: ['The whale shark is as long as a bus, but it has no sharp teeth.', 'It sucks in huge mouthfuls of plankton.', 'Whale sharks visit the island when the crab eggs hatch.'],
    yesno: [['Is the whale shark big?', true], ['Does it eat rocks?', false]] },
  jelly: { title: 'A jellyfish taxi', pic: 'jelly', gate: false,
    A: ['I see a jelly.', 'I ride it!'],
    B: ['Look at the jellyfish!', 'I sit on it.', 'Here we go!'],
    C: ['I hop on a jellyfish.', 'It takes me back to the island.'],
    D: ['I climb on top of a jellyfish.', 'It drifts along, and I get a free ride.'],
    E: ['Some crab larvae ride on jellyfish.', 'The jellyfish drifts with the sea, and I hide on top.', 'It is a jellyfish taxi!'],
    yesno: [['Can I ride a jellyfish?', true], ['Is the jellyfish a rock?', false]] },
  cliff: { title: 'Up the cliff', pic: 'cliff', gate: false,
    A: ['I see the cliff.', 'I go up it.'],
    B: ['Look at the big cliff!', 'Up, up, up I go.'],
    C: ['All the little crabs go up the cliff.', 'I go up too.'],
    D: ['The cliff is very steep.', 'I climb it with the sharp tips of my legs.'],
    E: ['Millions of baby crabs climb the steep cliff.', 'Crabs can walk straight up rock with their sharp toes.'],
    yesno: [['Can a crab go up a cliff?', true], ['Is the cliff in the sea?', false]] },
  dry: { title: 'Too dry!', pic: 'sun', gate: false,
    A: ['I see the sun.', 'No, no, no!'],
    B: ['The sun is hot.', 'I hide in the shade.'],
    C: ['The sun is hot on my back.', 'I go under a rock to rest.'],
    D: ['My gills must stay wet so I can breathe.', 'The hot sun dries them out, so I hide in the shade.'],
    E: ['Crabs breathe with gills, and gills must stay damp.', 'When the sun is hot, I hide in shady places.', 'I come out again when it is cool or wet.'],
    yesno: [['Do I hide from the sun?', true], ['Do I like the hot sun?', false]] },
  burrow: { title: 'My burrow', pic: 'burrow', gate: false,
    A: ['I dig.', 'I dig down, down.'],
    B: ['I dig a hole.', 'It is my home.'],
    C: ['I dig a burrow in the soft soil.', 'It is my home now.'],
    D: ['I dig a deep burrow in the forest floor.', 'It keeps me cool and damp.'],
    E: ['Each red crab lives alone in its own burrow.', 'It keeps the crab cool, damp and safe while it moults.'],
    yesno: [['Do I have a burrow?', true], ['Is my burrow in the sky?', false]] },
  moult: { title: 'Out of my shell', pic: 'shell', gate: false,
    A: ['I am in my burrow.', 'Look at me!'],
    B: ['My shell is too little.', 'I get out of it!'],
    C: ['I shut the door with leaves.', 'I get out of my old shell.', 'Now I am big!'],
    D: ['I shut my door with leaves.', 'I split out of my old shell.', 'My new shell is soft, so I stay inside until it gets hard.'],
    E: ['A crab must moult to grow, because its shell can not stretch.', 'I pump myself up with water while my new shell hardens.', 'Then I eat my old shell. It is full of calcium!'],
    yesno: [['Do I get out of my old shell?', true], ['Is my new shell hard?', false]] },
  robber: { title: 'The robber crab', pic: 'robber', gate: false,
    A: ['I see a big crab!', 'I go down!'],
    B: ['Look at the big crab!', 'I hide in my hole.'],
    C: ['A robber crab comes by.', 'It is so big!', 'I go down into my burrow.'],
    D: ['A huge robber crab walks by.', 'It can climb trees and crack coconuts.', 'I stay safe in my burrow.'],
    E: ['The robber crab is the biggest crab that lives on land.', 'It can weigh as much as a cat.', 'It is looking for fruit, so I wait in my burrow.'],
    yesno: [['Is the robber crab big?', true], ['Is it a fish?', false]] },
  rain: { title: 'The first big rain', pic: 'rain', gate: false,
    A: ['I see rain!', 'Go, go, go!'],
    B: ['Here is the rain!', 'We all go to the sea!'],
    C: ['The big rain is here.', 'All the crabs come out.', 'It is time to go to the sea!'],
    D: ['The first big rain of the wet season comes.', 'Millions of crabs leave the forest.', 'We march to the sea.'],
    E: ['The first rains of the wet season are the signal.', 'Millions of red crabs pour out of the forest.', 'The great march to the sea begins!'],
    yesno: [['Do we go to the sea?', true], ['Do we go to sleep?', false]] },
  bridge: { title: 'The crab bridge', pic: 'bridge', gate: false,
    A: ['I see a road.', 'I go up!'],
    B: ['Here is a road.', 'I go on the bridge.'],
    C: ['People made a bridge for us.', 'I go up and over the road.'],
    D: ['The rangers built a bridge just for crabs.', 'Crab fences keep us off the road.'],
    E: ['People on the island close roads and build bridges for crabs.', 'Low fences guide us to the bridge and the tunnels.', 'They want every crab to get to the sea safely.'],
    yesno: [['Is the bridge for crabs?', true], ['Do the crabs go on the road?', false]] },
  dip: { title: 'A dip in the sea', pic: 'sea', gate: false,
    A: ['I see the sea!', 'In I go!'],
    B: ['Here is the sea!', 'I dip in the water.'],
    C: ['We are at the sea now.', 'I go into the water for a dip.'],
    D: ['After the long march, I dip in the sea.', 'The salty water is good for me.'],
    E: ['After the long march, the crabs dip in the sea.', 'They soak up water and salt.', 'Then the boys dig burrows on the terrace.'],
    yesno: [['Do I dip in the sea?', true], ['Is the sea hot?', false]] },
  rival: { title: 'My burrow!', pic: 'rival', gate: false,
    A: ['I see a crab.', 'Push, push, push!'],
    B: ['A big crab is here.', 'He is at my hole.', 'I will push him!'],
    C: ['Another boy crab wants my burrow.', 'We push and push.'],
    D: ['Another male wants my burrow.', 'We push with our claws.', 'Who will win?'],
    E: ['Boy crabs fight to keep their burrows by the sea.', 'We shove with our big claws until one gives up.', 'Nobody gets hurt.'],
    yesno: [['Do we push?', true], ['Do we sing?', false]] },
  king: { title: 'King of the terrace', pic: 'king', gate: false,
    A: ['I am the king!', 'Look at me!'],
    B: ['I win, I win!', 'This hole is mine.'],
    C: ['I won! My burrow is safe.', 'Now a girl crab can find me.'],
    D: ['I won every push.', 'Now my burrow is ready for a female.'],
    E: ['I am the strongest crab on this part of the terrace.', 'A female will come to my burrow soon.'],
    yesno: [['Did I win?', true], ['Did I lose my burrow?', false]] },
  brood: { title: 'Eggs to keep safe', pic: 'female', gate: false,
    A: ['I see my eggs.', 'I sleep.'],
    B: ['I have lots of eggs.', 'I sit in my hole.', 'I wait and wait.'],
    C: ['I have lots and lots of eggs.', 'They are under me in my burrow.'],
    D: ['I carry my eggs under my tummy flap.', 'I stay in the burrow for twelve days.'],
    E: ['I carry up to one hundred thousand eggs.', 'For about twelve days I wait in the damp burrow while they grow.'],
    yesno: [['Do I have eggs?', true], ['Do I go up a tree?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', zoea3: 'grow', glow: 'glow', fishSchool: 'fish', whaleShark: 'whale', ride: 'jelly', cliff: 'cliff', drying: 'dry', digStart: 'burrow', crabMolted: 'moult', robber: 'robber', migrate: 'rain', bridge: 'bridge', dipped: 'dip', rivalArrived: 'rival', king: 'king', brooding: 'brood' };

/* ---------- read-and-do missions ----------
   who: zoea · swim (zoea or megalopa) · mega · baby (a baby crab on the shore or cliff)
        · forest (a crab in the forest) · march (on the great march) · rival (a rival is here)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'plankton', who: 'zoea', A: 'Eat, eat, eat!', B: 'Eat lots of green plankton.', C: 'Eat ten bits of plankton.', D: 'Eat ten bits of green plankton.', E: 'Swim around and eat ten bits of plankton.' },
  { key: 'deep', who: 'swim', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark.' },
  { key: 'top', who: 'swim', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'copepod', who: 'zoea', from: 'B', A: 'Eat the copepod!', B: 'Catch a copepod!', C: 'Catch a jumpy copepod.', D: 'Catch a copepod. It is fast!', E: 'Chase a jumpy copepod and catch it.' },
  { key: 'jelly', who: 'mega', A: 'Go to the jelly.', B: 'Find a jellyfish.', C: 'Find a jellyfish to ride.', D: 'Find a jellyfish and ride it.', E: 'Find a jellyfish and ride it home.' },
  { key: 'reef', who: 'mega', A: 'Go to the rocks.', B: 'Swim to the rocks.', C: 'Swim to the reef.', D: 'Swim back to the reef.', E: 'Swim all the way back to the reef.' },
  { key: 'shade', who: 'baby', A: 'Go to a rock.', B: 'Hide by a rock.', C: 'Hide under a rock.', D: 'Find some shade under a rock.', E: 'Find a shady rock and hide under it.' },
  { key: 'cliff', who: 'baby', A: 'Go up, up!', B: 'Go up the cliff.', C: 'Go to the top of the cliff.', D: 'Climb to the top of the cliff.', E: 'Climb all the way up the cliff.' },
  { key: 'leaf', who: 'forest', A: 'Eat a leaf.', B: 'Eat a big leaf.', C: 'Find a leaf and eat it.', D: 'Find a fallen leaf and eat it.', E: 'Find a fallen leaf and munch it.' },
  { key: 'flower', who: 'forest', A: 'Eat a flower.', B: 'Find a flower.', C: 'Find a flower and eat it.', D: 'Find a pretty flower to eat.', E: 'Find a bright flower and eat it.' },
  { key: 'fruit', who: 'forest', from: 'B', A: 'Eat a fig.', B: 'Find a fig to eat.', C: 'Find a fig and eat it.', D: 'Find a sweet fig and eat it.', E: 'Find a ripe fig on the forest floor.' },
  { key: 'dig', who: 'forest', A: 'Dig, dig, dig!', B: 'Dig a hole.', C: 'Dig a burrow.', D: 'Dig a deep burrow.', E: 'Dig a burrow in the soft soil.' },
  { key: 'bridge', who: 'march', A: 'Go up the bridge.', B: 'Go over the bridge.', C: 'Go over the crab bridge.', D: 'Walk over the crab bridge.', E: 'Walk over the bridge that rangers built.' },
  { key: 'sea', who: 'march', from: 'B', A: 'Go to the sea.', B: 'Go to the sea!', C: 'Go down to the sea.', D: 'March down to the sea.', E: 'March all the way down to the sea.' },
  { key: 'rival', who: 'rival', A: 'Push the crab!', B: 'Push the big crab!', C: 'Go and push the other crab.', D: 'Push the other crab away.', E: 'Push the other crab away from your burrow.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am an egg on my mum.', D: 'I am an egg. Soon a wave will come.', E: 'I am an egg under my mother, by the sea.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle into the sea!', C: 'Wiggle into the sea.', D: 'A wave! Wiggle into the sea.', E: 'Push the arrows to wiggle into the sea.' },
  swim: { A: 'Swim! Eat!', B: 'Swim and eat the green dots.', C: 'Swim and eat the green plankton.', D: 'Swim around and eat the plankton.', E: 'Swim around and eat the tiny plankton.' },
  copepod: { A: 'Eat the copepod!', B: 'Catch the copepod!', C: 'It jumps! Catch it.', D: 'A copepod! It jumps away fast.', E: 'A copepod! Chase it and catch it.' },
  tight: { A: 'Look at me!', B: 'My skin is too little!', C: 'My skin is tight!', D: 'My skin is too tight!', E: 'My skin is too tight. Time to moult!' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more plankton to grow.', E: 'Eat more plankton to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Food is at the top.', D: 'At night the plankton swim up to the top.', E: 'At night the plankton swim up near the top.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Food is down deep.', D: 'In the day the plankton sink down deep.', E: 'In the day the plankton sink down where it is dark.' },
  flick: { A: 'Go, go!', B: 'Swim fast!', C: 'Flick my tail to go fast.', D: 'Flick my tail to dash.', E: 'Flick my tail to dash away.' },
  fish: { A: 'Fish! Go, go!', B: 'Fish! Swim away!', C: 'Fish! Swim away from them.', D: 'Fish! Swim away or dive deep.', E: 'Fish are coming! Swim away or dive deep.' },
  missed: { A: 'I am up!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  whale: { A: 'A shark! Go, go!', B: 'A big shark! Swim away!', C: 'A whale shark! Swim away from it.', D: 'A whale shark! Swim away from its mouth.', E: 'A whale shark is eating plankton! Swim away from its mouth.' },
  megalopa: { A: 'Go to the rocks!', B: 'Swim to the rocks!', C: 'Swim back to the island.', D: 'Follow the arrow back to the island.', E: 'Follow the arrow back to the island.' },
  jelly: { A: 'Ride the jelly!', B: 'Ride the jellyfish!', C: 'Ride the jellyfish home.', D: 'Get on the jellyfish for a free ride.', E: 'Ride the jellyfish back to the island.' },
  riding: { A: 'I ride!', B: 'I ride the jellyfish!', C: 'I ride the jellyfish home.', D: 'I ride along on the jellyfish.', E: 'I ride along on the jellyfish taxi.' },
  surf: { A: 'Go to the rocks!', B: 'Swim to the rocks!', C: 'The waves push me in.', D: 'The waves push me to the rocks.', E: 'The waves push me in towards the rocks.' },
  ashore: { A: 'Go up!', B: 'Come out of the sea!', C: 'Come up out of the sea.', D: 'Crawl out of the sea onto the rocks.', E: 'Crawl out of the sea onto the rocks.' },
  march: { A: 'Go up, up!', B: 'Go up to the forest!', C: 'Go up to the forest with the others.', D: 'March up to the forest with the others.', E: 'March up to the rainforest with all the others.' },
  climb: { A: 'Go up the cliff!', B: 'Go up the cliff!', C: 'Go up the cliff. Rest in the shade.', D: 'Climb the cliff. Rest in the cracks.', E: 'Climb the cliff, and rest in the shady places.' },
  dry: { A: 'No! Go to a rock!', B: 'Too hot! Hide in the shade!', C: 'Too dry! Go to the shade.', D: 'My gills are drying out! Find shade.', E: 'My gills are drying out! Find some shade.' },
  shade: { A: 'Yes!', B: 'In the shade. Good!', C: 'It is cool in the shade.', D: 'It is cool and damp in the shade.', E: 'It is cool and damp in the shade.' },
  rested: { A: 'I sleep.', B: 'I hide and wait.', C: 'I hid and had a rest.', D: 'I hid in the shade until night.', E: 'I hid in the shade until it was cool.' },
  bird: { A: 'A bird! Go down!', B: 'A bird! Hide by a rock!', C: 'A bird! Hide under a rock.', D: 'A big bird! Hide under a rock.', E: 'A seabird is coming! Hide under a rock.' },
  forest: { A: 'Eat a leaf!', B: 'Eat and grow big!', C: 'Eat leaves and flowers to grow.', D: 'Eat leaves, flowers and fruit to grow.', E: 'Eat fallen leaves, flowers and fruit to grow.' },
  eat: { A: 'Eat it!', B: 'Food! Go and eat it.', C: 'Go to the food and eat it.', D: 'There is food. Go and eat it.', E: 'There is food on the floor. Go and eat it.' },
  sniff: { A: 'Go, go, go!', B: 'Go this way! Eat!', C: 'Go this way to find food.', D: 'Follow the arrow to find more food.', E: 'Follow the arrow to find more food.' },
  full: { A: 'Dig! Go down!', B: 'Dig a hole! Go down.', C: 'I am full. Dig a burrow.', D: 'I am full. Dig a burrow in the soft soil.', E: 'I am full. Push down to dig a burrow.' },
  dig: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down into the soil.', D: 'Dig down into the soft soil.', E: 'Dig down into the soft soil.' },
  rock: { A: 'No! It is a rock.', B: 'Too hard! Dig here?', C: 'Too hard! Find soft soil.', D: 'Too hard to dig here. Find soft soil.', E: 'This is too hard to dig. Find some soft soil.' },
  toodeep: { A: 'No! Go up!', B: 'Too deep! Go back.', C: 'Too deep! I can not swim now.', D: 'Too deep! Crabs on land can not swim.', E: 'It is too deep! A land crab can not swim.' },
  deeper: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down some more.', D: 'Dig a little deeper.', E: 'Keep digging. My burrow must be deep.' },
  moult: { A: 'Shut it!', B: 'Shut the door!', C: 'Shut the door and moult.', D: 'Deep enough! Shut the door and moult.', E: 'Deep enough! Shut the door with leaves and moult.' },
  soft: { A: 'Look at me!', B: 'I am soft. Wait.', C: 'My new shell is soft. Wait.', D: 'My new shell is soft. I wait for it to get hard.', E: 'My new shell is soft. I wait while it hardens.' },
  dryseason: { A: 'I sleep.', B: 'It is hot. I wait.', C: 'It is dry. I rest in my burrow.', D: 'It is the dry season. I stay in my burrow.', E: 'It is the dry season. I wait in my damp burrow.' },
  wetseason: { A: 'Go up!', B: 'Rain! Go up and out!', C: 'The rain is back. Dig up and out!', D: 'The wet season is back. Dig up and out!', E: 'The wet season is back! Dig up and out of my burrow.' },
  out: { A: 'Go up!', B: 'Go up and out!', C: 'Dig up and out.', D: 'Dig up and out of my burrow.', E: 'Push up to dig out of my burrow.' },
  robber: { A: 'A big crab! Go down!', B: 'A big crab! Hide in my hole!', C: 'A robber crab! Go down into my burrow.', D: 'A robber crab! Hide deep in my burrow.', E: 'A robber crab is coming! Hide deep in my burrow.' },
  safe: { A: 'I can go up!', B: 'It went away.', C: 'The robber crab went away.', D: 'The robber crab walked away.', E: 'The robber crab walked away to find fruit.' },
  adult: { A: 'I am big!', B: 'I am big! Eat and wait.', C: 'I am big. Eat and wait for the rain.', D: 'I am grown up. Eat and wait for the rain.', E: 'I am grown up. Eat and wait for the first big rain.' },
  rain: { A: 'Go, go, go!', B: 'Rain! Go to the sea!', C: 'The big rain! Go to the sea!', D: 'The first big rain! March to the sea!', E: 'The first big rain! Time to march to the sea!' },
  sea: { A: 'Go to the sea!', B: 'Go to the sea!', C: 'Go this way to the sea.', D: 'Follow the arrow to the sea.', E: 'Follow the arrow all the way to the sea.' },
  bridge: { A: 'Go up!', B: 'Go on the bridge!', C: 'Go up and over the bridge.', D: 'Walk over the crab bridge.', E: 'Walk over the crab bridge to cross the road.' },
  fence: { A: 'Go up!', B: 'Go to the bridge!', C: 'Go to the bridge.', D: 'Follow the fence to the bridge.', E: 'Follow the crab fence to the bridge.' },
  dip: { A: 'Dip!', B: 'Dip in the sea!', C: 'Go into the sea for a dip.', D: 'Walk into the water for a dip.', E: 'Walk into the water and dip in the sea.' },
  burrowsite: { A: 'Dig, dig, dig!', B: 'Dig a hole here!', C: 'Dig a burrow here.', D: 'Dig a burrow here by the sea.', E: 'Push down to dig a burrow on the terrace.' },
  rival: { A: 'A crab! Push!', B: 'A big crab! Push him!', C: 'Another crab! Go and push him.', D: 'Another male! Go and push him.', E: 'A rival male wants my burrow! Push him.' },
  shove: { A: 'Push, push, push!', B: 'Push, push, push!', C: 'Push! Then a big push!', D: 'Push! When it is green, give a big shove!', E: 'Push him, then give a big shove!' },
  won: { A: 'Yes, yes, yes!', B: 'I win! He is gone.', C: 'I won! He went away.', D: 'I won! He walked away.', E: 'I won! He walked away, and my burrow is safe.' },
  lost: { A: 'No! Push, push!', B: 'No! Play again.', C: 'He won. Try again.', D: 'He pushed me away. Try again.', E: 'He pushed me away! Try again.' },
  king: { A: 'I am the king!', B: 'I win, I win!', C: 'I am the best crab here!', D: 'I am the king of the terrace!', E: 'I am the king of the terrace!' },
  female: { A: 'I see a crab!', B: 'Go and say hi!', C: 'A girl crab! Go and say hi.', D: 'A female crab! Go and say hi.', E: 'A female crab! Go and say hello.' },
  findmale: { A: 'Go to a crab!', B: 'Find a big crab!', C: 'Find a boy crab at his burrow.', D: 'Find a male crab at his burrow.', E: 'Find a male crab waiting at his burrow.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the crab.', E: 'Go and say hello to the crab.' },
  brood: { A: 'I see my eggs.', B: 'My eggs! I wait.', C: 'My eggs grow. I wait.', D: 'My eggs are growing. I wait in the burrow.', E: 'My eggs are growing under my flap.' },
  moonready: { A: 'Go to the sea!', B: 'The moon! Go to the sea!', C: 'Go to the sea now.', D: 'The moon is right! Go to the sea.', E: 'The last quarter moon! Go to the edge of the sea.' },
  release: { A: 'A wave! Shake!', B: 'Wait for a wave!', C: 'When a wave comes, shake!', D: 'When a wave comes, shake my eggs out!', E: 'When a wave washes over me, shake my eggs out!' },
  eggs: { A: 'I see eggs!', B: 'Eggs in the sea!', C: 'The eggs hatch in the sea!', D: 'The eggs hatch as soon as they touch the sea.', E: 'The eggs hatch the moment they touch the sea.' },
  home: { A: 'Go up!', B: 'Go home!', C: 'Go back up to the forest.', D: 'March back home to the forest.', E: 'My job is done. March home to the forest.' },
  friend: { A: 'I see crabs!', B: 'Look! Lots of crabs!', C: 'Lots of little crabs go up too.', D: 'My brothers and sisters march too.', E: 'My brothers and sisters are marching too.' },
  ants: { A: 'No, no, no!', B: 'Ants! Go back!', C: 'Ants! Go away from them.', D: 'Crazy ants! Keep away from them.', E: 'Yellow crazy ants! Keep away from them.' }
};
