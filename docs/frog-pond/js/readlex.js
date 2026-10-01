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

/* new words at each level; a level may use its own words and every earlier level's */
const LEVEL_NEW = {
  A: 'a an i see the can look at is my like go me we up am in it to eat hop no yes down sleep sing',
  B: 'and here you big little come said not on he she get swim sit hide out have two three four one what this fast run jump play all will are for with night black green red brown cold air kick want of they do has too',
  C: 'bites read word words into went was now some where there that then back under away dive snap lay from time day warm wet new good help find rest grow grew gone puff other top wake wiggle put dots be wants by over our',
  D: 'spring hungry when again so after just very could about make came saw off soon first last long open stay know feel deep safe slow tiny keeps hiding its jaw shoots toes as front smaller every climb lily buzzes throat balloon song hatch did short covers dig soft until must days gets sits next hop up',
  E: 'goes lid still stiff singing them eating your tongue because through around before while something tickles webbed well gills close lungs gulp shrinking push stuck ball dot waiting flick zoom like spring winter every quiet other bright wakes hungry warmer melts sunny fills'
};
const LEVEL_WORDS = (function () {
  const out = {}; let acc = new Set();
  for (const L of READ_LEVELS) { for (const w of LEVEL_NEW[L].split(/\s+/)) if (w) acc.add(w); out[L] = new Set(acc); }
  return out;
})();

/* nouns a child can read from the picture; value = picture key */
const PIC_NOUNS = {
  frog: 'frog', frogs: 'frog', egg: 'egg', eggs: 'egg', jelly: 'egg', tadpole: 'tadpole', tadpoles: 'tadpole',
  fish: 'fish', fly: 'fly', flies: 'fly', bug: 'bug', bugs: 'bug', log: 'log', pad: 'pad', pads: 'pad',
  sun: 'sun', moon: 'moon', mud: 'mud', tail: 'tail', legs: 'legs', leg: 'legs', bird: 'bird', snake: 'snake',
  turtle: 'turtle', snail: 'snail', fuzz: 'fuzz', pond: 'pond', water: 'water', ice: 'ice', rock: 'rock', rocks: 'rock',
  weeds: 'weed', weed: 'weed', nymph: 'bug', dragonfly: 'dragonfly'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  go:    { A: 'go',    B: 'go',    C: 'wiggle', D: 'wiggle out',      E: 'Wiggle out of the egg.' },
  eat:   { A: 'eat',   B: 'eat',   C: 'eat',    D: 'eat the fuzz',    E: 'Eat the green fuzz.' },
  swim:  { A: 'go',    B: 'swim',  C: 'swim',   D: 'swim away',       E: 'Swim away fast!' },
  up:    { A: 'up',    B: 'up',    C: 'swim up', D: 'swim up for air', E: 'Swim up to get air.' },
  hide:  { A: 'down',  B: 'hide',  C: 'dive',   D: 'dive down deep',  E: 'Dive down deep to hide!' },
  snap:  { A: 'eat',   B: 'get',   C: 'snap',   D: 'snap the fly',    E: 'Snap up the fly!' },
  hop:   { A: 'hop',   B: 'hop',   C: 'hop',    D: 'hop to a pad',    E: 'Hop to the next pad.' },
  sleep: { A: 'sleep', B: 'sleep', C: 'sleep',  D: 'sleep in the mud', E: 'Sleep in the mud until spring.' },
  sing:  { A: 'sing',  B: 'sing',  C: 'sing',   D: 'sing a song',     E: 'Sing to the other frogs.' },
  eggs:  { A: 'eggs',  B: 'eggs',  C: 'lay eggs', D: 'lay my eggs',   E: 'Lay my eggs in the jelly.' }
};
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ---------- */
const READ_CHAPTERS = {
  egg: { pic: 'egg', gate: false,
    A: ['I am in an egg.', 'I am in the jelly.', 'I can go!'],
    B: ['I am a little egg.', 'I am in the big jelly.', 'Here I come!'],
    C: ['I am a little black egg.', 'I am in the jelly.', 'The sun is warm.', 'Now I will wiggle out!'],
    D: ['I am a tiny black egg in the jelly.', 'The sun keeps me warm.', 'Soon I will wiggle out and swim away.'],
    E: ['I am a tiny black dot in a ball of jelly.', 'The sun keeps me warm.', 'Every day I grow.', 'Soon I will wiggle out and swim!'],
    yesno: [['Am I in the jelly?', true], ['Can I hop?', false]] },
  bottom: { pic: 'bug', gate: false,
    A: ['I see a bug.', 'It is a bug!', 'I go up.'],
    B: ['I see a big bug.', 'It is on the mud.', 'Swim, swim, swim!'],
    C: ['Look! A big bug is on the mud.', 'It wants to get me.', 'I swim away fast!'],
    D: ['A big bug is hiding in the mud.', 'Its jaw shoots out!', 'I kick my tail and swim away fast.'],
    E: ['Down in the mud a nymph is waiting.', 'Its jaw shoots out like a spring!', 'I flick my tail and zoom away.'],
    yesno: [['Is the bug big?', true], ['Is the bug little?', false]] },
  legs: { pic: 'legs', gate: true,
    A: ['I see my legs.', 'I like my legs!'],
    B: ['Look at me!', 'I have two little legs.', 'I can kick!'],
    C: ['Look at me!', 'Two little legs grew by my tail.', 'Now I can kick and swim.'],
    D: ['Two little legs grew by my tail.', 'They have toes!', 'Now I can kick as I swim.'],
    E: ['Something tickles by my tail.', 'Two little legs grow, with webbed toes.', 'Now I can kick as well as wiggle.'],
    yesno: [['Do I have legs?', true], ['Do I have a tail?', true], ['Can I sing?', false]] },
  air: { pic: 'tail', gate: true,
    A: ['I go up.', 'I go up, up, up!'],
    B: ['I have four legs.', 'I go up, up, up.', 'I want air!'],
    C: ['Now I have four legs.', 'I swim up to get air.', 'My tail is little now.'],
    D: ['My front legs came out.', 'Now I must swim up for air.', 'My tail gets smaller every day.'],
    E: ['My front legs push out.', 'My gills close and my lungs open.', 'I swim up and gulp the air.', 'My tail is shrinking.'],
    yesno: [['Do I go up for air?', true], ['Is my tail big now?', false]] },
  out: { pic: 'froglet', gate: true,
    A: ['Look at me!', 'I am a frog.', 'I can see a fly.'],
    B: ['My tail is not here!', 'I am a little frog.', 'I sit on a pad.', 'I see a fly!'],
    C: ['My tail is gone!', 'I am a little frog now.', 'I sit on a pad in the sun.', 'I see a fly.', 'Snap!'],
    D: ['My tail is gone.', 'I climb out on a lily pad.', 'I feel the warm sun.', 'A fly buzzes by.', 'Snap!'],
    E: ['My tail is gone, so I climb out on a lily pad.', 'The sun is warm and bright.', 'A fly buzzes by.', 'Snap!'],
    yesno: [['Is my tail here?', false], ['Am I a frog now?', true]] },
  song: { pic: 'frog', gate: true,
    A: ['I can sing.', 'We can sing.', 'We like to sing!'],
    B: ['I am a big frog.', 'I sing at night.', 'The frogs sing with me!'],
    C: ['I am a big frog now.', 'At night I puff up and sing.', 'The other frogs sing back to me!'],
    D: ['At night I puff up my throat like a balloon.', 'I sing my song.', 'The frogs on the log sing back.'],
    E: ['When the sun goes down, I puff up my throat like a balloon.', 'I sing my song to the pond.', 'The other frogs sing back to me.'],
    yesno: [['Do I sing at night?', true], ['Do frogs sing?', true], ['Can a frog fly?', false]] },
  eggs: { pic: 'egg', gate: false,
    A: ['I see my eggs.', 'I like my eggs!'],
    B: ['Here are my eggs.', 'They are in the jelly.', 'They are little.'],
    C: ['I put my eggs in the jelly.', 'They are little black dots.', 'They will be tadpoles.'],
    D: ['I lay my eggs in the warm water.', 'Soon they will hatch.', 'They will be tadpoles, like I was.'],
    E: ['I lay my eggs in the warm water by the weeds.', 'Soon they will hatch into tadpoles.', 'They will grow, just like I did.'],
    yesno: [['Are my eggs in the jelly?', true], ['Are the eggs big?', false]] },
  ice: { pic: 'ice', gate: false,
    A: ['I see the ice.', 'I am in the mud.', 'I sleep.'],
    B: ['It is cold.', 'Ice is on the pond.', 'I sleep in the mud.'],
    C: ['It is cold now.', 'Ice is on top of the pond.', 'I go down into the mud to sleep.'],
    D: ['The days get short and cold.', 'Ice covers the pond.', 'I dig into the soft mud and sleep until spring.'],
    E: ['The days are short and cold.', 'Ice covers the pond like a lid.', 'I dig into the soft mud and sleep, quiet and still, until spring.'],
    yesno: [['Is it cold?', true], ['Do I sleep in the mud?', true], ['Is it warm?', false]] },
  spring: { pic: 'frog', gate: false,
    A: ['I see the sun!', 'I am up!'],
    B: ['The ice is not here.', 'I see the sun.', 'I am up, and I want to eat!'],
    C: ['The ice is gone!', 'The sun is warm.', 'I wake up and I want to eat bugs.'],
    D: ['The ice is gone and the sun is warm.', 'I wake up in the mud.', 'I am very hungry!'],
    E: ['The ice melts and the sun fills the pond.', 'I wake up, stiff and hungry.', 'The other frogs are singing. Spring is here!'],
    yesno: [['Is the ice here?', false], ['Do I want to eat?', true]] }
};

/* ---------- read-and-do missions ---------- */
const MISSIONS = [
  { key: 'log', who: 'any', A: 'Go to the log.', B: 'Go to the big log.', C: 'Swim to the log.', D: 'Swim over to the big log.', E: 'Swim over to the log where the turtle sits.', words: 'log' },
  { key: 'up', who: 'water', A: 'Go up, up, up!', B: 'Go up, up, up!', C: 'Swim up to the top.', D: 'Swim up to the top of the pond.', E: 'Swim up to the top of the water.' },
  { key: 'mud', who: 'water', A: 'Go down to the mud.', B: 'Go down to the mud.', C: 'Swim down to the mud.', D: 'Swim down deep to the mud.', E: 'Swim down deep to the soft mud.' },
  { key: 'fish', who: 'water', A: 'Look at the fish.', B: 'Go to the little fish.', C: 'Find the little fish.', D: 'Swim over to the little fish.', E: 'Find the little fish and swim with them.' },
  { key: 'snail', who: 'water', A: 'Look at the snail.', B: 'Go to the snail.', C: 'Find the snail on the mud.', D: 'Find the snail on the mud.', E: 'Find the snail that is eating the fuzz.' },
  { key: 'rock', who: 'water', A: 'Go to a rock.', B: 'Go to a big rock.', C: 'Swim to a big rock.', D: 'Swim over to a big rock.', E: 'Swim over to a big rock on the mud.' },
  { key: 'eat3', who: 'tadpole', A: 'Eat, eat, eat!', B: 'Eat the green fuzz.', C: 'Eat three bites of fuzz.', D: 'Eat three bites of the green fuzz.', E: 'Eat three bites of the green fuzz on the rocks.' },
  { key: 'pad', who: 'frog', A: 'Go to a pad.', B: 'Sit on a pad.', C: 'Hop up on a pad.', D: 'Climb up and sit on a lily pad.', E: 'Climb up and sit on a lily pad in the sun.' },
  { key: 'bug2', who: 'frog', A: 'Eat a fly.', B: 'Get two flies.', C: 'Snap two flies.', D: 'Snap up two flies.', E: 'Snap up two flies with your tongue.', extra: 'tongue your with' },
  { key: 'turtle', who: 'any', A: 'Look at the turtle.', B: 'Go to the turtle.', C: 'Find the turtle.', D: 'Find the turtle on the log.', E: 'Find the turtle that sits on the log.' },
  { key: 'sing', who: 'night', A: 'Sing!', B: 'Sing at night.', C: 'Sing to the frogs.', D: 'Sing a song to the frogs.', E: 'Sing a song to the other frogs.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'Go! Go! Go!', B: 'Go! Come out!', C: 'Read the word to wiggle out.', D: 'Read the words to wiggle out of the egg.', E: 'Read the words to wiggle out of your egg.' },
  swim: { A: 'Eat the fuzz.', B: 'Swim to the green fuzz.', C: 'Swim to the green fuzz and eat.', D: 'Swim to the green fuzz on the rocks.', E: 'Swim to the green fuzz on the rocks and eat it.' },
  algae: { A: 'Eat the fuzz.', B: 'Eat the green fuzz.', C: 'Eat the green fuzz.', D: 'Eat the green fuzz on the rocks.', E: 'Eat the green fuzz on the rocks.' },
  legs: { A: 'I see my legs!', B: 'I have two legs!', C: 'I have two legs now!', D: 'Two legs grew by my tail!', E: 'Two legs grew by my tail!' },
  breathe: { A: 'Go up, up, up!', B: 'Go up for air!', C: 'Swim up to get air!', D: 'Swim up to the top for air.', E: 'Swim up to the top to gulp air.' },
  froglet: { A: 'I am a frog!', B: 'Sit on a pad.', C: 'Hop up on a pad.', D: 'Climb up on a lily pad.', E: 'Climb up on a lily pad and look for flies.' },
  hop: { A: 'Hop, hop, hop!', B: 'Hop to a pad.', C: 'Hop to a pad and get a fly.', D: 'Hop to a pad and snap a fly.', E: 'Hop from pad to pad and snap the flies.' },
  snap: { A: 'Eat the fly!', B: 'Get the fly!', C: 'Snap the fly!', D: 'Snap the fly!', E: 'Snap up the fly!' },
  heron: { A: 'A bird! Go down!', B: 'A big bird! Hide!', C: 'A big bird! Dive down!', D: 'A big bird! Dive down deep!', E: 'A big bird is here! Dive down deep to hide!' },
  frog: { A: 'I am a frog!', B: 'I am a big frog!', C: 'I am a big frog now!', D: 'I am a big frog now. Eat bugs!', E: 'I am a big frog now. Snap up the bugs!' },
  night: { A: 'Sing!', B: 'Sing at night!', C: 'It is night. Sing!', D: 'It is night. Sing a song!', E: 'It is night. Sing to the other frogs!' },
  readyEggs: { A: 'I see my eggs!', B: 'Go to the weeds.', C: 'Swim to the weeds to lay eggs.', D: 'Swim to the weeds and lay my eggs.', E: 'Swim over to the weeds and lay my eggs.' },
  winter: { A: 'I sleep in the mud.', B: 'It is cold! Go to the mud.', C: 'It is cold. Go down to the mud.', D: 'It is cold. Dig into the mud and sleep.', E: 'It is cold. Dig into the soft mud and sleep.' },
  spring: { A: 'I see the sun!', B: 'I am up! I want to eat!', C: 'The ice is gone! Eat!', D: 'The ice is gone. Time to eat!', E: 'The ice melts. Time to eat!' }
};
