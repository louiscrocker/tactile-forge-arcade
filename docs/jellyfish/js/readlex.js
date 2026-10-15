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
/* words only Jellyfish needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: "and back big blob blue brr cold done fast find get hi hide lick lots make ok on out pop spot stick swim wait yum",
  B: "again arm away bigger bits by catch comes dark day did dips dots drift drifts free glow goes got grow grows happen her into lean let lets lights likes long many mine missed more mum's now off ones open pecks pull pulse ride round say side so something squeeze star sticks stretch taken ten that tight times top try turn under went whoosh wiggle winter zoom",
  C: "about along another as bell bit bump but caught comb crawls deep does eats eight end fill filled five fly give glows grown had hang hot how hundred job jumps jumpy keep legs live lives miss misses myself pile pulses push rainbow ready river safe shine sixteen split starts sticky summer swims teeth tells them thin things tiny together tree turns upside very walk way when young your",
  D: "around arrow bay beat between biggest boys called carries clone clouds coming covered crawled cup currents deeper each edge eggs exact fed filling flash fold follow gaps gulls hairs hovers leatherback letting light looks meet mouth near or peck pecking pink place pushes right school shady shining signal sink slides slime snatch splits spots springs squeezing strong stuck swells swimmer thousands took true tumbled turning us weeks well whole world",
  E: "across already animals arrows beating becomes begins best bioluminescence bottom budding bumped bumps call carpet carried catches changes chase clear clones crawl crawling cycle dipping drifters energy even favourite few floating foods frilly fringe gather gathering grain growing hangs hard head hello helps huge hurt ledges life looking makes middle millimetres mostly mother's move nobody oars only past pops practise pushed reach rivers rocky rows safer sand savers scientists seabirds shape show sky slugs smack sperm spread stalk stays strobila surface swarm sweeps swimming than tides underside watch wind"
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
  jelly: 'jelly', jellies: 'jelly', jellyfish: 'jelly', medusa: 'medusa',
  planula: 'planula', planulae: 'planulae', baby: 'planula', babies: 'planulae',
  polyp: 'polyp', polyps: 'polyp', ephyra: 'ephyra', ephyrae: 'ephyra',
  pouch: 'pouch', pouches: 'pouch', stack: 'strobila', disc: 'strobila', discs: 'strobila', plates: 'strobila',
  bud: 'bud', buds: 'bud', copy: 'bud', tentacles: 'tentacles', tentacle: 'tentacles', rings: 'rings', arms: 'arms',
  mum: 'mum', mother: 'mum', boy: 'boy', girl: 'girl', bloom: 'bloom', heart: 'heart', cloud: 'cloud', current: 'current',
  plankton: 'plankton', copepod: 'copepod', diatom: 'diatom', food: 'plankton', snack: 'plankton',
  fish: 'fish', herring: 'herring', bird: 'bird', tern: 'tern', gull: 'gull', turtle: 'turtle', sunfish: 'sunfish', slug: 'slug',
  rock: 'rock', rocks: 'rock', ledge: 'ledge', dock: 'dock', kelp: 'kelp',
  sea: 'sea', ocean: 'sea', water: 'water', moon: 'moon', sun: 'sun', snow: 'snow', sparkles: 'sparkle'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  settle: { A: 'stick',  B: 'stick on',   C: 'stick on here',     D: 'stick on under the rock',   E: 'Stick on and hang upside down.' },
  eat:    { A: 'eat',    B: 'eat it',     C: 'eat it up',         D: 'put the food in my mouth',  E: 'Fold the food into my mouth.' },
  bud:    { A: 'bud',    B: 'make a bud', C: 'make a copy of me', D: 'grow a bud on my side',     E: 'Grow a bud. It is a copy of me!' },
  lick:   { A: 'lick',   B: 'lick it',    C: 'lick my bell',      D: 'lick the food off my bell', E: 'Lick the sticky food off my bell.' },
  meet:   { A: 'hi',     B: 'say hi',     C: 'go and say hi',     D: 'say hi to the jelly',       E: 'Swim close and say hello.' },
  fan:    { A: 'go',     B: 'let go',     C: 'let them go',       D: 'let my babies go free',     E: 'Let my babies swim free.' }
};
/* the picture on each action card */
const ACTION_PIC = { settle: 'ledge', eat: 'tentacles', bud: 'bud', lick: 'arms', meet: 'heart', fan: 'planulae' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the jelly's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'A baby on Mum\'s arm', pic: 'pouch', gate: false,
    A: ['I am a baby.', 'I am in a pouch.', 'I see my mum.'],
    B: ['I am a little baby jelly.', 'I am in a pouch.', 'The pouch is on Mum\'s arm.'],
    C: ['I am a tiny baby jelly.', 'My mum has lots of babies.', 'We ride in pouches on her arms.'],
    D: ['My mum is a moon jelly.', 'She keeps her babies in little pouches on her four arms.', 'Soon she will let us go.'],
    E: ['A mother moon jelly carries her babies in pouches on her frilly arms.', 'Each baby is a planula, smaller than a grain of sand.', 'Soon she will let them swim free.'],
    yesno: [['Am I a baby jelly?', true], ['Am I a big fish?', false]] },
  hatch: { title: 'Swim free!', pic: 'planula', gate: true,
    A: ['I am out!', 'I can swim.', 'Go, go, go!'],
    B: ['Mum lets me go.', 'I wiggle out.', 'I am a planula!'],
    C: ['Mum lets her babies go.', 'I wiggle out of my pouch.', 'Now I am a planula. I swim!'],
    D: ['Mum lets her babies go into the sea.', 'I am a planula, a tiny swimmer covered in hairs.', 'My hairs beat to push me along.'],
    E: ['My mother lets her babies go, and I swim free.', 'I am a planula, covered in tiny hairs that beat like oars.', 'I do not eat. I look for a place to stick on.'],
    yesno: [['Can I swim?', true], ['Am I a big jelly now?', false]] },
  settle: { title: 'Upside down', pic: 'ledge', gate: true,
    A: ['I see a rock.', 'I stick on!'],
    B: ['Here is a rock.', 'It is dark under it.', 'I stick on. It is mine!'],
    C: ['I look under the rocks.', 'This spot is taken. That one is not!', 'I stick on and hang upside down.'],
    D: ['I swim down to a shady rock ledge.', 'Lots of spots are taken by other little things.', 'At last I find a free one and stick on.'],
    E: ['The planula looks for a hard, shady place, like the underside of a rock.', 'It sticks on by its front end and hangs upside down.', 'Now it will turn into a polyp.'],
    yesno: [['Do I hang upside down?', true], ['Do I live in a tree?', false]] },
  catch: { title: 'Catch!', pic: 'polyp', gate: false,
    A: ['I am a polyp.', 'I see food.', 'I eat it!'],
    B: ['I am a polyp.', 'Food drifts by.', 'My tentacles catch it!'],
    C: ['I am a polyp now.', 'Tiny food drifts by me.', 'It sticks to my tentacles, and I eat it.'],
    D: ['A polyp is a tiny cup with tentacles all around its mouth.', 'When food drifts by, it sticks to my tentacles.', 'Then I fold it into my mouth.'],
    E: ['A polyp hangs under its rock with its tentacles spread out.', 'Tiny animals that drift by stick to the tentacles.', 'The tentacles fold them into the mouth in the middle.'],
    yesno: [['Do I catch food?', true], ['Do I swim away?', false]] },
  tentacles: { title: 'More tentacles', pic: 'tentacles', gate: false,
    A: ['Look at me!', 'I am big!'],
    B: ['I eat and eat.', 'I get more tentacles!'],
    C: ['I had four tentacles.', 'Now I have eight!', 'Then I will have sixteen.'],
    D: ['A new polyp has four tentacles.', 'As it eats and grows, it gets eight, and then sixteen.'],
    E: ['A moon jelly polyp starts with four tentacles.', 'As it eats and grows it makes eight, and then sixteen.', 'More tentacles catch more food.'],
    yesno: [['Do I get more tentacles?', true], ['Do I have a hundred legs?', false]] },
  bud: { title: 'A copy of me', pic: 'bud', gate: false,
    A: ['I see a bud.', 'It is me!'],
    B: ['A bud grows on me.', 'It is a little polyp.', 'It is a copy of me!'],
    C: ['A bump grows on my side.', 'It turns into a new polyp.', 'It is a copy of me!'],
    D: ['A well fed polyp can grow a bud.', 'The bud turns into a whole new polyp.', 'It is a clone, an exact copy.'],
    E: ['A polyp can grow a bud on its side that becomes a whole new polyp.', 'This is called budding, and the new polyp is a clone.', 'One polyp can make a whole carpet of clones.'],
    yesno: [['Is the bud a copy of me?', true], ['Is the bud a fish?', false]] },
  slug: { title: 'A sea slug!', pic: 'slug', gate: false,
    A: ['I see a slug.', 'I hide!'],
    B: ['A slug comes by.', 'I pull in my tentacles.', 'It goes away.'],
    C: ['A sea slug crawls by.', 'I pull in tight.', 'It crawls on, and I am safe.'],
    D: ['A sea slug crawls under the rocks.', 'I pull my tentacles in tight.', 'It slides right by me.'],
    E: ['Some sea slugs crawl about under rocks looking for polyps.', 'I pull my tentacles in tight and keep still.', 'The slug crawls on past. Nobody is hurt.'],
    yesno: [['Do I pull in tight?', true], ['Do I swim up to the sun?', false]] },
  winter: { title: 'Brr! Winter', pic: 'snow', gate: false,
    A: ['It is cold.', 'Brr!'],
    B: ['It is winter.', 'The sea is cold.', 'Something will happen!'],
    C: ['It is winter now.', 'The sea is very cold.', 'The cold tells me it is time.'],
    D: ['In winter the sea gets cold.', 'The cold water is a signal for the polyp.', 'It is time to make baby jellies.'],
    E: ['When the sea gets cold in winter, the polyp changes.', 'The cold water tells it that it is time to make baby jellyfish.'],
    yesno: [['Is the sea cold?', true], ['Is it hot in winter?', false]] },
  strobila: { title: 'A stack of plates', pic: 'strobila', gate: true,
    A: ['Look at me!', 'I am a stack.'],
    B: ['I grow long.', 'I am a stack of discs.', 'Look at me!'],
    C: ['I grow long and thin.', 'I split into a stack of discs.', 'I look like a pile of plates!'],
    D: ['The polyp grows long and splits into a stack of discs.', 'It looks like a pile of little plates.', 'Each disc will be a baby jelly.'],
    E: ['In winter the polyp grows long and splits into a stack of discs.', 'Scientists call this a strobila.', 'Each disc will pop off and swim away as a baby jellyfish.'],
    yesno: [['Am I a stack of discs?', true], ['Am I a rock?', false]] },
  ephyra: { title: 'Pop!', pic: 'ephyra', gate: true,
    A: ['Pop!', 'I am out!', 'I can swim.'],
    B: ['Pop! I am free!', 'I am a baby jelly.', 'I look like a star.'],
    C: ['Pop! I pop off the stack.', 'Now I am a baby jelly.', 'I look like a little star with eight arms.'],
    D: ['I pulse and pop off the stack.', 'I am an ephyra, a baby jellyfish.', 'I look like a tiny star with eight arms.'],
    E: ['The bottom disc pulses and pops off the stack.', 'It is an ephyra, a baby jellyfish only a few millimetres across.', 'The polyp stays on its rock and will grow back.'],
    yesno: [['Am I a baby jelly?', true], ['Do I have ten legs?', false]] },
  pulse: { title: 'Pulse, pulse', pic: 'ephyra', gate: false,
    A: ['I swim.', 'Go, go, go!'],
    B: ['I squeeze.', 'I open.', 'I go!'],
    C: ['I squeeze my bell.', 'Then I open it.', 'Pulse, pulse! That is how I swim.'],
    D: ['A jelly swims by squeezing its bell.', 'Then the bell springs open again.', 'Every pulse pushes me along.'],
    E: ['A jellyfish swims by squeezing its bell and letting it spring open again.', 'Every pulse pushes it along.', 'Moon jellies are some of the best energy savers in the sea.'],
    yesno: [['Do I pulse to swim?', true], ['Do I have legs to walk?', false]] },
  grow: { title: 'Bigger and bigger', pic: 'ephyra', gate: false,
    A: ['I eat.', 'I am big!'],
    B: ['I eat the plankton.', 'I am big now.'],
    C: ['I eat lots of plankton.', 'My arms fill in.', 'I grow big!'],
    D: ['I eat plankton and grow.', 'The gaps between my arms fill in.', 'Soon I will be round.'],
    E: ['Every bit of plankton helps me grow.', 'The gaps between my eight arms fill in.', 'Soon I will be a round young jelly.'],
    yesno: [['Do I eat plankton?', true], ['Do I eat rocks?', false]] },
  medusa: { title: 'A young jelly', pic: 'medusa', gate: true,
    A: ['Look at me!', 'I am a jelly.'],
    B: ['Look at me now!', 'I am round.', 'I am a jelly!'],
    C: ['My arms filled in.', 'Now I am round.', 'I am a young moon jelly!'],
    D: ['Now my bell is round.', 'I am a young moon jelly.', 'Food sticks to my bell as I swim.'],
    E: ['The ephyra has grown into a young moon jelly.', 'Its bell is round, with a fringe of little tentacles.', 'Scientists call the swimming shape a medusa.'],
    yesno: [['Am I a jelly?', true], ['Am I a polyp now?', false]] },
  mucus: { title: 'A sticky bell', pic: 'arms', gate: false,
    A: ['I see food.', 'It is on me!'],
    B: ['Food sticks to me.', 'I lick it off.', 'Yum!'],
    C: ['My bell is sticky.', 'Food sticks to it as I swim.', 'I lick it off with my arms.'],
    D: ['My bell is covered in sticky slime.', 'Tiny plankton stick to it.', 'My four arms lick the food off.'],
    E: ['A moon jelly catches its food with sticky slime on its bell.', 'Tiny hairs move the food to the edge.', 'Then its four frilly arms lick it off.'],
    yesno: [['Is my bell sticky?', true], ['Do I eat with teeth?', false]] },
  adult: { title: 'Four rings', pic: 'rings', gate: true,
    A: ['Look at me!', 'I see rings.'],
    B: ['Look at me!', 'I have four rings.', 'I am big now.'],
    C: ['I am a big moon jelly now.', 'Look in my bell.', 'I have four rings!'],
    D: ['I am a grown moon jelly.', 'You can see four rings in my bell.', 'That is where the eggs grow.'],
    E: ['The young jelly has grown into a grown moon jelly.', 'Four rings show through its clear bell.', 'They are where its eggs or sperm grow.'],
    yesno: [['Do I have four rings?', true], ['Am I a baby now?', false]] },
  current: { title: 'Ride the current', pic: 'current', gate: false,
    A: ['I go!', 'Go, go, go!'],
    B: ['The sea is fast here.', 'I ride it!'],
    C: ['This is a current.', 'It is like a river in the sea.', 'I ride along with it.'],
    D: ['A current is like a river in the sea.', 'Jellies drift along with the currents.', 'I ride it a long way.'],
    E: ['Currents are rivers in the sea, pushed by the wind and the tides.', 'Jellies can swim, but they mostly drift.', 'That makes them plankton.'],
    yesno: [['Can I ride the current?', true], ['Is the current a tree?', false]] },
  bloom: { title: 'The bloom', pic: 'bloom', gate: false,
    A: ['I see jellies!', 'Lots and lots!'],
    B: ['Look at all the jellies!', 'We are a bloom.'],
    C: ['So many jellies!', 'We all swim here together.', 'This is a bloom.'],
    D: ['Thousands of moon jellies come here.', 'We swim together where two currents meet.', 'It is called a bloom.'],
    E: ['When there is lots of food, thousands of moon jellies gather together.', 'This is called a bloom, a swarm, or even a smack!'],
    yesno: [['Are there lots of jellies?', true], ['Am I all by myself?', false]] },
  brood: { title: 'Babies on my arms', pic: 'pouch', gate: false,
    A: ['I see babies.', 'I wait.'],
    B: ['I have babies.', 'They are on my arms.', 'I wait and wait.'],
    C: ['I have lots of babies.', 'They grow in pouches on my arms.', 'I keep them safe.'],
    D: ['My babies grow in pouches on my four arms.', 'I keep them safe for weeks.', 'Soon they can swim.'],
    E: ['A mother moon jelly carries her growing babies in pouches on her arms.', 'They grow into planulae, ready to swim free.'],
    yesno: [['Are my babies on my arms?', true], ['Are my babies in a tree?', false]] },
  larvae: { title: 'Swim free, little ones', pic: 'planulae', gate: true,
    A: ['Go, go, go!', 'I see babies.'],
    B: ['The babies go.', 'They swim down.', 'Go, little ones!'],
    C: ['The babies swim away.', 'They go down to the rocks.', 'It all starts again!'],
    D: ['The planulae swim free into the sea.', 'They go down to find a shady rock.', 'Then it all starts again.'],
    E: ['Thousands of new planulae swim free into the sea.', 'Each one will look for a shady rock and stick on.', 'The moon jelly life cycle begins again.'],
    yesno: [['Do the babies swim free?', true], ['Do the babies fly up to the sun?', false]] },
  glow: { title: 'A sparkling sea', pic: 'sparkle', gate: false,
    A: ['I see it!', 'It is blue!'],
    B: ['It is night.', 'Look! Blue dots!', 'They glow.'],
    C: ['It is night in the sea.', 'I bump some plankton and it glows blue!'],
    D: ['At night, some tiny plankton flash blue.', 'They light up when I bump them.'],
    E: ['Moon jellies do not glow, but some plankton do.', 'When something bumps them, they flash bright blue.', 'This is called bioluminescence.'],
    yesno: [['Do some plankton glow?', true], ['Is the glow red?', false]] },
  combjelly: { title: 'The comb jelly', pic: 'combjelly', gate: false,
    A: ['I see a blob.', 'No, no, no!'],
    B: ['Look at the blob!', 'It has lights.', 'I swim away!'],
    C: ['A comb jelly comes by.', 'It glows like a rainbow.', 'It eats little things, so I swim away.'],
    D: ['A comb jelly drifts by, shining like a rainbow.', 'It is not a true jellyfish.', 'I keep away from it.'],
    E: ['A comb jelly has eight rows of beating hairs that shine like a rainbow.', 'It is not a true jellyfish, and it eats tiny drifters.', 'I keep well away.'],
    yesno: [['Does the comb jelly shine?', true], ['Is the comb jelly a rock?', false]] },
  herring: { title: 'Fish!', pic: 'herring', gate: false,
    A: ['I see fish!', 'Go, go, go!'],
    B: ['Look at all the fish!', 'They swim fast.', 'I swim away!'],
    C: ['Lots of herring swim by.', 'They bump me about.', 'I swim away from them.'],
    D: ['A school of herring comes by.', 'They eat plankton as they swim.', 'I pulse away from them.'],
    E: ['A shining school of herring sweeps past.', 'A tiny ephyra can get bumped about, so I pulse away.'],
    yesno: [['Do I swim away from the fish?', true], ['Am I a fish?', false]] },
  tern: { title: 'A bird!', pic: 'tern', gate: false,
    A: ['I see a bird.', 'I go down!'],
    B: ['Look at the bird!', 'It dips at the top.', 'I go down, down.'],
    C: ['A bird dips at the top of the sea.', 'I swim down, away from it.'],
    D: ['A tern hovers over the water and dips to snatch tiny things.', 'I dive a little deeper.'],
    E: ['A tern hovers over the sea and dips to snatch tiny things from the surface.', 'Deeper down, it can not reach me.'],
    yesno: [['Do I swim down?', true], ['Do I fly up?', false]] },
  turtle: { title: 'A turtle!', pic: 'turtle', gate: false,
    A: ['I see a turtle.', 'Go, go, go!'],
    B: ['A big turtle is here.', 'It likes jellies.', 'I pulse away!'],
    C: ['A big sea turtle swims by.', 'It wants a jelly snack.', 'I pulse away fast. It misses!'],
    D: ['The leatherback is the biggest turtle in the world.', 'It eats lots of jellies.', 'I pulse away, and it misses.'],
    E: ['The leatherback turtle is the biggest turtle in the world.', 'It swims a very long way to find jellies to eat.', 'I give a big pulse, and it misses me.'],
    yesno: [['Did the turtle miss?', true], ['Is the turtle little?', false]] },
  sunfish: { title: 'The sunfish', pic: 'sunfish', gate: false,
    A: ['I see a fish.', 'It is big!'],
    B: ['Look at the big fish!', 'It is round.', 'I swim away!'],
    C: ['A big round fish swims by.', 'It is a sunfish.', 'It likes jellies, but it misses me!'],
    D: ['An ocean sunfish swims by.', 'It is one of the biggest fish in the world.', 'It wants a jelly snack, but I pulse away.'],
    E: ['The ocean sunfish looks like a huge swimming head.', 'Jellies are one of its favourite foods.', 'I give a big pulse, and it misses me.'],
    yesno: [['Is the sunfish big?', true], ['Did the sunfish get me?', false]] },
  gull: { title: 'A gull!', pic: 'gull', gate: false,
    A: ['I see a bird.', 'I go down!'],
    B: ['A gull is here.', 'It pecks at the top.', 'I go down, down.'],
    C: ['A gull pecks at the top of the sea.', 'I swim down deep.', 'It can not get me.'],
    D: ['Gulls peck at jellies near the top of the sea.', 'I dive down deeper, where it is safe.'],
    E: ['Gulls and other seabirds peck at jellies floating near the surface.', 'A jelly is safer a little deeper down.'],
    yesno: [['Do I go down deep?', true], ['Do I fly with the gull?', false]] },
  dodge: { title: 'It missed!', pic: 'jelly', gate: false,
    A: ['Go, go, go!', 'I am OK!'],
    B: ['Whoosh! I go fast.', 'It did not get me!'],
    C: ['I give a big pulse.', 'Whoosh! I zoom away.', 'It did not get me!'],
    D: ['A big pulse pushes me away fast.', 'It missed me. I am safe.'],
    E: ['One big, strong pulse shoots me through the water.', 'It missed me, and I drift on, safe.'],
    yesno: [['Am I safe?', true], ['Did it get me?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', caught: 'catch', tentacles: 'tentacles', budded: 'bud', slug: 'slug', strobila: 'winter', popFree: 'pulse', grew: 'grow', glow: 'glow', combJelly: 'combjelly', fishSchool: 'herring', ternDip: 'tern', turtle: 'turtle', sunfish: 'sunfish', gullDip: 'gull', dodged: 'dodge', stuck: 'mucus', ride: 'current', inBloom: 'bloom', brooding: 'brood' };

/* ---------- read-and-do missions ----------
   who: planula (swimming) · polyp (hanging, catching) · ephyra (the baby jelly) · jelly (ephyra or young jelly)
        · medusa (the young or grown jelly) · grown (big enough: off to the bloom) · bloom (in the bloom, looking for a mate)
   sex: only for a boy or a girl · from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'down', who: 'planula', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Swim down to the rocks.', D: 'Swim down deep to the rocks.', E: 'Swim down deep, where the rocks are.' },
  { key: 'taken', who: 'planula', from: 'B', A: 'Find a spot.', B: 'Find a spot that is taken.', C: 'Find a spot that is taken.', D: 'Find a spot under a rock that is taken.', E: 'Find a spot under a rock that is already taken.' },
  { key: 'catch', who: 'polyp', A: 'Eat, eat, eat!', B: 'Catch three bits of food.', C: 'Catch three bits of food.', D: 'Catch three bits of food that drift by.', E: 'Catch three bits of food with your tentacles.' },
  { key: 'stretch', who: 'polyp', A: 'Go down!', B: 'Stretch down long.', C: 'Stretch down long.', D: 'Stretch down as long as you can.', E: 'Stretch your stalk down as long as you can.' },
  { key: 'pullin', who: 'polyp', A: 'Go up!', B: 'Pull in tight.', C: 'Pull up in tight.', D: 'Pull your tentacles up in tight.', E: 'Pull your tentacles up in tight, like a slug is near.' },
  { key: 'lean', who: 'polyp', from: 'B', A: 'Go to this side.', B: 'Lean to one side.', C: 'Lean all the way to one side.', D: 'Lean all the way over to one side.', E: 'Lean all the way over to one side.' },
  { key: 'plankton', who: 'ephyra', A: 'Eat, eat, eat!', B: 'Eat lots of green dots.', C: 'Eat ten bits of plankton.', D: 'Eat ten bits of green plankton.', E: 'Swim around and eat ten bits of plankton.' },
  { key: 'copepod', who: 'ephyra', from: 'B', A: 'Eat the copepod!', B: 'Catch a copepod!', C: 'Catch a jumpy copepod.', D: 'Catch a copepod. It is fast!', E: 'Chase a jumpy copepod and catch it.' },
  { key: 'top', who: 'jelly', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'deep', who: 'jelly', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark.' },
  { key: 'pulse', who: 'jelly', A: 'Swim, swim, swim!', B: 'Pulse ten times.', C: 'Pulse and swim ten times.', D: 'Squeeze your bell and pulse ten times.', E: 'Squeeze your bell and swim ten pulses.' },
  { key: 'zoom', who: 'jelly', from: 'B', A: 'Go fast!', B: 'Zoom three times!', C: 'Give three big pulses.', D: 'Give three big, strong pulses.', E: 'Give three big, strong pulses to practise.' },
  { key: 'sticky', who: 'medusa', A: 'Get food!', B: 'Get lots of food on you.', C: 'Get five bits of food on your bell.', D: 'Swim until five bits stick to your bell.', E: 'Swim through the plankton until five bits stick to your bell.' },
  { key: 'lick', who: 'medusa', A: 'Lick, lick, lick!', B: 'Lick the food off.', C: 'Lick food off your bell three times.', D: 'Lick the food off your bell three times.', E: 'Lick the sticky food off your bell three times.' },
  { key: 'ride', who: 'medusa', from: 'B', A: 'Go with the current!', B: 'Ride the current.', C: 'Ride the current for a bit.', D: 'Find the current and ride it.', E: 'Find the current and ride along with it.' },
  { key: 'bloomgo', who: 'grown', A: 'Go to the bloom!', B: 'Swim to the bloom!', C: 'Swim out to the bloom.', D: 'Swim all the way out to the bloom.', E: 'Follow the arrow all the way out to the bloom.' },
  { key: 'girl', who: 'bloom', sex: 'boy', A: 'Go to the girl!', B: 'Find a girl jelly.', C: 'Find a girl jelly and say hi.', D: 'Find a girl jelly with a heart.', E: 'Find a girl jelly with a pink heart and say hello.' },
  { key: 'cloud', who: 'bloom', sex: 'girl', A: 'Go to the cloud!', B: 'Find a little cloud.', C: 'Swim to a little cloud.', D: 'Swim into a little cloud from a boy.', E: 'Swim into a little cloud that a boy let go.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am a baby.', B: 'I am on Mum\'s arm. Wait.', C: 'I am a baby in a pouch on Mum\'s arm.', D: 'I am a baby in a pouch. Soon Mum will let me go.', E: 'I am a baby in a pouch on my mother\'s arm.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle! Swim free!', C: 'Mum lets me go. Wiggle!', D: 'Mum is letting her babies go. Wiggle free!', E: 'Push the arrows to wiggle free and swim.' },
  swimfree: { A: 'Swim! Find a rock!', B: 'Swim! Find a rock!', C: 'Swim and find a dark rock.', D: 'Swim and find a shady place under a rock.', E: 'Swim down and find a shady place under a rock ledge.' },
  reef: { A: 'Go to the rocks!', B: 'Go down to the rocks!', C: 'Go this way to the rocks.', D: 'Follow the arrow down to the rocks.', E: 'Follow the arrow down to the rocky ledges.' },
  search: { A: 'Look! A spot!', B: 'Find a spot. Stick on!', C: 'Find a spot under a rock.', D: 'Find a free spot under a rock ledge.', E: 'Look under the ledges for a spot that is free.' },
  taken: { A: 'No! Go, go!', B: 'Taken! Try again.', C: 'Something lives here. Try another.', D: 'Taken! Something lives here. Try another.', E: 'Taken! Something lives here already. Try another spot.' },
  settle: { A: 'Stick on!', B: 'Stick on! It is mine.', C: 'A free spot! Stick on.', D: 'A free spot! Stick on and hang upside down.', E: 'A free spot! Stick on and hang upside down.' },
  polyp: { A: 'Eat, eat, eat!', B: 'Catch the food!', C: 'Catch the food that drifts by.', D: 'Lean and catch the food that drifts by.', E: 'Lean and stretch to catch the food that drifts by.' },
  caught: { A: 'Eat it!', B: 'I got it! Eat it!', C: 'I caught some food. Eat it!', D: 'I caught some food. Put it in my mouth!', E: 'I caught some food. Fold it into my mouth!' },
  stretch: { A: 'Go up! Go down!', B: 'Down is long. Up is in.', C: 'Push down to get long.', D: 'Push down to stretch. Push up to pull in.', E: 'Push down to stretch out. Push up to pull in tight.' },
  tentacles: { A: 'Look at me!', B: 'More tentacles!', C: 'I have more tentacles now!', D: 'More tentacles! Now I can catch more food.', E: 'More tentacles! Now I can catch more food.' },
  bud: { A: 'Make a bud!', B: 'I am big! Make a bud!', C: 'I am big. Make a copy of me!', D: 'I am big and strong. Grow a bud!', E: 'I am big and strong. Grow a bud, a copy of me!' },
  budded: { A: 'It is me!', B: 'A copy of me!', C: 'A new polyp! It is a copy of me.', D: 'A new polyp! It is a clone of me.', E: 'A new polyp grew! It is a clone of me.' },
  morebuds: { A: 'Eat, eat, eat!', B: 'Eat more!', C: 'Eat more, then make a bud.', D: 'Eat some more, then grow a bud again.', E: 'Eat some more, then grow another bud.' },
  slug: { A: 'A slug! Go up!', B: 'A slug! Pull in tight!', C: 'A sea slug! Pull in tight!', D: 'A sea slug is coming! Pull in tight.', E: 'A sea slug is crawling this way! Pull in tight.' },
  slugpast: { A: 'I am OK!', B: 'It went away!', C: 'The slug went by. I am OK.', D: 'The sea slug crawled on by.', E: 'The sea slug crawled on by. Nobody is hurt.' },
  cold: { A: 'It is cold!', B: 'Brr! It is cold!', C: 'Brr! It is winter now.', D: 'Brr! Winter is here. The sea is cold.', E: 'Brr! Winter is here. The cold water is a signal.' },
  stack: { A: 'Look at me!', B: 'I am a stack!', C: 'I am a stack of discs. Wait.', D: 'I am turning into a stack of discs. Wait.', E: 'I am turning into a stack of discs. Wait and watch.' },
  pop: { A: 'Pop, pop, pop!', B: 'Wait for the glow!', C: 'When it glows, pulse!', D: 'When the glow swells, pulse to pop free!', E: 'When the glow swells, pulse and pop free!' },
  free: { A: 'Pop! I am out!', B: 'I am a baby jelly! Swim!', C: 'Pop! I am a baby jelly. Swim!', D: 'Pop! I am an ephyra, a baby jelly. Swim!', E: 'Pop! I am an ephyra, a baby jellyfish. Pulse to swim!' },
  eatplankton: { A: 'Eat!', B: 'Eat the green dots!', C: 'Swim into the green dots.', D: 'Swim into the plankton to eat it.', E: 'Swim into the plankton to eat it.' },
  copepod: { A: 'Eat the copepod!', B: 'Catch the copepod!', C: 'It jumps! Catch it.', D: 'A copepod! It jumps away fast.', E: 'A copepod! Chase it and catch it.' },
  dash: { A: 'Go fast!', B: 'Zoom! Go fast!', C: 'Give a big pulse to go fast.', D: 'Give a big, strong pulse.', E: 'Give a big, strong pulse to zoom along.' },
  grew: { A: 'I am big!', B: 'I am bigger!', C: 'Bigger! My arms fill in.', D: 'Bigger! My arms are filling in.', E: 'Bigger! The gaps between my arms are filling in.' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more plankton to grow.', E: 'Eat more plankton to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Food is at the top.', D: 'At night the plankton swim up to the top.', E: 'At night the plankton swim up near the top.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Food is down deep.', D: 'In the day the plankton sink down deep.', E: 'In the day the plankton sink down where it is dark.' },
  jelly: { A: 'A blob! Go!', B: 'A blob! Swim away!', C: 'A comb jelly! Keep away from it.', D: 'A comb jelly! Keep away from it.', E: 'A comb jelly! Keep well away from it.' },
  fish: { A: 'Fish! Go, go!', B: 'Fish! Swim away!', C: 'Fish! Swim away from them.', D: 'Fish! Pulse away from them.', E: 'Fish are coming! Pulse away, or give a big pulse.' },
  missed: { A: 'I am OK!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  tern: { A: 'A bird! Go down!', B: 'A bird! Swim down!', C: 'A bird! Swim down a bit.', D: 'A tern! Dive a little deeper.', E: 'A tern is dipping at the surface! Dive a little deeper.' },
  medusa: { A: 'Swim! Eat!', B: 'Swim into the food!', C: 'Swim into the food. It sticks!', D: 'I am a young jelly. Swim into the food.', E: 'I am a young moon jelly. Swim through the plankton.' },
  stuck: { A: 'Lick it!', B: 'Food on me! Lick it!', C: 'Food is on my bell. Lick it off!', D: 'Food is stuck on my bell. Lick it off!', E: 'Food is stuck on my sticky bell. Lick it off!' },
  licked: { A: 'Yum!', B: 'Yum, yum!', C: 'Yum! My arms got the food.', D: 'Yum! My arms took the food to my mouth.', E: 'Yum! My arms carried the food to my mouth.' },
  current: { A: 'Go, go, go!', B: 'Ride it! Go fast!', C: 'A current! Ride along with it.', D: 'A current! It carries me along.', E: 'A current! Ride it. It carries me along.' },
  turtle: { A: 'A turtle! Go!', B: 'A turtle! Zoom away!', C: 'A turtle! Give a big pulse!', D: 'A sea turtle! Give a big pulse, or dive.', E: 'A sea turtle! Give a big pulse, or dive away.' },
  sunfish: { A: 'A fish! Go!', B: 'A big fish! Zoom away!', C: 'A sunfish! Give a big pulse!', D: 'An ocean sunfish! Give a big pulse away.', E: 'An ocean sunfish! Give a big pulse away.' },
  gull: { A: 'A bird! Go down!', B: 'A bird! Swim down!', C: 'A gull! Swim down deep.', D: 'A gull is pecking at the top! Dive down.', E: 'A gull is pecking at the top! Dive down deeper.' },
  dodged: { A: 'I am OK!', B: 'Whoosh! It missed!', C: 'Whoosh! It did not get me.', D: 'Whoosh! My big pulse took me away.', E: 'Whoosh! My big pulse took me away. It missed!' },
  adult: { A: 'Look at me!', B: 'Four rings! I am big!', C: 'I have four rings. I am grown up!', D: 'Four rings in my bell! I am grown up.', E: 'Four rings in my bell! I am a grown moon jelly.' },
  grow: { A: 'Eat, eat, eat!', B: 'Eat more!', C: 'Eat more to grow big.', D: 'Eat more to grow big for the bloom.', E: 'Eat more to grow big for the summer bloom.' },
  bloom: { A: 'Go to the bloom!', B: 'Swim to the bloom!', C: 'It is summer. Go to the bloom!', D: 'Summer! Follow the arrow to the bloom.', E: 'Summer! The moon jellies are gathering. Follow the arrow.' },
  inbloom: { A: 'I see jellies!', B: 'So many jellies!', C: 'I am in the bloom!', D: 'I am in the bloom, with lots of jellies.', E: 'I am in the bloom, with thousands of moon jellies.' },
  findgirl: { A: 'Go to the girl!', B: 'Find a girl jelly!', C: 'Find a girl jelly with a heart.', D: 'Find a girl jelly with a pink heart.', E: 'Find a girl jelly with a pink heart and swim to her.' },
  findcloud: { A: 'Go to the cloud!', B: 'Find a little cloud!', C: 'Swim to a little cloud.', D: 'The boys let little clouds go. Swim to one.', E: 'The boys let little clouds go. Swim to a cloud.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the jelly.', E: 'Go and say hello to the jelly.' },
  shared: { A: 'Go, cloud!', B: 'My cloud goes to her!', C: 'My little cloud drifts to her.', D: 'I let my little cloud go. It drifts to her.', E: 'I let my little cloud go, and it drifts to her.' },
  brood: { A: 'I see babies.', B: 'My babies! I wait.', C: 'My babies grow on my arms.', D: 'My babies grow in the pouches on my arms.', E: 'My babies grow in the pouches on my arms. Weeks go by.' },
  release: { A: 'Go, go, go!', B: 'Wait for the glow!', C: 'When it glows, let them go!', D: 'When the glow swells, let my babies go!', E: 'When the glow swells, let my babies swim free!' },
  ready: { A: 'Go, babies!', B: 'Let my babies go!', C: 'My babies are ready. Let them go!', D: 'My babies are ready to swim free!', E: 'My babies are ready. Let them swim free!' },
  larvae: { A: 'I see babies!', B: 'The babies swim down!', C: 'The babies swim down to the rocks!', D: 'The planulae swim down to find a rock.', E: 'The planulae swim down to find a rock, and it all starts again.' },
  done: { A: 'I am done!', B: 'All done! I drift.', C: 'My job is done. I drift.', D: 'My job is done. I drift with the bloom.', E: 'My job is done. I drift along with the bloom.' },
  friend: { A: 'I see polyps!', B: 'Look! Polyps!', C: 'Lots of polyps live here too.', D: 'Other polyps live under the rocks too.', E: 'Other polyps live under the ledges too.' },
  sparkle: { A: 'I see sparkles!', B: 'Look! It sparkles!', C: 'The sea sparkles when I pulse!', D: 'At night the sea sparkles when I pulse.', E: 'At night the sea sparkles every time I pulse.' },
  edge: { A: 'Go back!', B: 'Turn back!', C: 'This is the end. Turn back.', D: 'This is the edge of the bay. Turn back.', E: 'This is the edge of the bay. Turn back.' }
};
