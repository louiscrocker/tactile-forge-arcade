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
/* words only Hercules needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'fly dig lift push hi lay white',
  B: 'hatch so skin yum lots bottom end wiggle now good open strong him win find top friend back ground wait hard way soft gone new day again say make',
  C: 'mom white soon six legs done full dry when jaws tight did smaller giant first moult change forest food sweet thin flap goes weak another comes won times best does sniffs long nose deep turn eating helps old land stay safe more smooth tired try her',
  D: 'follow arrow laid rotting pea head bigger grown stop their size male lock who heavier than made keep still inside changing split pale shell lap juice buzz loudly heavy champion female females lays sniffing reach gives makes yellow brother or sister far enough deeper making flew gave',
  E: 'next throws mother growing chew strong chewing insect stretch wriggle stops digs shape lie whole body break dark hercules smells ripe falls brushy mouth energy cases doors flying unfold underneath but rhinoceros strongest animals slide flips rival lands grab each between winner lifts wrestling matches row knows starts pokes wanders soak damp dries bump hatched same plenty us threads soften quickly brothers sisters tallest high treetops flip visit floor wrestle arrows softer digging pressing walls mine flipped hello wandered'
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
  beetle: 'beetle', beetles: 'beetle', grub: 'grub', grubs: 'grub', larva: 'grub',
  egg: 'egg', eggs: 'egg', pupa: 'pupa', horn: 'horn', horns: 'horn',
  log: 'log', logs: 'log', wood: 'wood', dirt: 'dirt', soil: 'dirt', room: 'room',
  fruit: 'fruit', mango: 'fruit', fig: 'fruit', tree: 'tree', trees: 'tree', branch: 'branch',
  leaf: 'leaf', leaves: 'leaf', stick: 'stick', stone: 'stone', stones: 'stone',
  wings: 'wings', wing: 'wings', fungus: 'fungus', coati: 'coati',
  moon: 'moon', sun: 'sun', rain: 'rain', water: 'rain', mouse: 'mouse'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:   { A: 'eat',  B: 'eat',    C: 'eat it',      D: 'eat the fruit',   E: 'Eat the sweet fruit.' },
  lift:  { A: 'lift', B: 'lift',   C: 'lift it',     D: 'lift it up',      E: 'Lift it with my horn.' },
  push:  { A: 'push', B: 'push',   C: 'push him',    D: 'push the beetle', E: 'Push him away!' },
  fly:   { A: 'fly',  B: 'fly',    C: 'fly up',      D: 'open my wings',   E: 'Open my wings and fly.' },
  build: { A: 'dig',  B: 'dig',    C: 'make a room', D: 'make my room',    E: 'Make a smooth room.' },
  meet:  { A: 'hi',   B: 'say hi', C: 'go to her',   D: 'say hi to her',   E: 'Go and say hello.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'fruit', lift: 'stick', push: 'rival', fly: 'wings', build: 'room', meet: 'female' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the beetle's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'An egg in a log', pic: 'egg', gate: false,
    A: ['I am an egg.', 'I am in a log.', 'I sleep.'],
    B: ['I am a little egg.', 'I am in a big log.', 'I will hatch!'],
    C: ['I am a little white egg.', 'My mom put me in a log.', 'Soon I will hatch.'],
    D: ['My mom laid me in a soft, rotting log.', 'I am a tiny egg, as big as a pea.', 'Soon I will hatch.'],
    E: ['A mother beetle laid me deep inside a rotting log.', 'I am a white egg, about as big as a pea.', 'Inside me, a tiny grub is growing.'],
    yesno: [['Am I in a log?', true], ['Am I a big beetle?', false]] },
  hatch: { title: 'Out of the egg', pic: 'grub', gate: true,
    A: ['I see a grub.', 'I am a grub!', 'I can eat.'],
    B: ['Look! I am out of my egg.', 'I am a little grub.', 'I want to eat.'],
    C: ['I wiggle out of my egg.', 'Now I am a little grub.', 'I have six legs and big jaws.'],
    D: ['I hatch out of my egg.', 'I am a tiny white grub with a brown head.', 'I am very hungry, so I eat the soft wood.'],
    E: ['I chew my way out of the egg.', 'I am a grub: soft and white, with a hard brown head.', 'My strong jaws are made for chewing wood.'],
    yesno: [['Am I a grub?', true], ['Can I fly now?', false]] },
  molt2: { title: 'Too tight!', pic: 'grub', gate: true,
    A: ['I eat, eat, eat.', 'Look at me!'],
    B: ['My skin is too little.', 'I wiggle out of it!', 'Now I am big.'],
    C: ['My skin is too tight now.', 'I wiggle and wiggle out of it.', 'Now I have new, big skin.'],
    D: ['When my skin gets too tight, I must get out of it.', 'I wiggle out of my old skin.', 'Now I am a bigger grub.'],
    E: ['An insect skin can not stretch, so I must moult.', 'I split my old skin and wriggle out.', 'My new skin is soft and bigger.'],
    yesno: [['Did I get out of my skin?', true], ['Am I smaller now?', false]] },
  molt3: { title: 'A giant grub', pic: 'grub', gate: true,
    A: ['I am a grub.', 'I eat wood.', 'Look at me!'],
    B: ['Look at me!', 'I am a big, big grub.', 'I am too big for my skin!'],
    C: ['I am so big now!', 'My skin is tight again.', 'I wiggle out. Now I am a giant grub!'],
    D: ['I moult for the last time.', 'Now I am a giant grub.', 'I am heavier than a mouse!'],
    E: ['This is my last moult.', 'I am a giant grub now, heavier than a mouse.', 'The more I eat, the bigger my horn will be.'],
    yesno: [['Am I a giant grub?', true], ['Is this my first moult?', false]] },
  chamber: { title: 'Down into the dirt', pic: 'dirt', gate: false,
    A: ['I go down.', 'I go in the dirt.', 'I dig.'],
    B: ['I am a big grub.', 'I go down, down, down.', 'I dig in the dirt.'],
    C: ['I am full now.', 'I go down into the dirt.', 'I will make a room there.'],
    D: ['I am full grown, so I stop eating.', 'I dig down out of the log into the soil.', 'There I will make a safe room.'],
    E: ['When a grub is full grown, it stops eating.', 'It digs down into the soil under the log.', 'There it makes a smooth room the shape of an egg.'],
    yesno: [['Do I dig in the dirt?', true], ['Do I go up?', false]] },
  pupa: { title: 'The pupa', pic: 'pupa', gate: true,
    A: ['I am a pupa.', 'I sleep, sleep, sleep.'],
    B: ['I am in my room.', 'I am a pupa now.', 'I do not eat. I sleep.'],
    C: ['My room is done.', 'Now I am a pupa.', 'I rest and change in here.'],
    D: ['I made a safe room in the soil.', 'Now I am a pupa. I keep very still.', 'Inside, I am changing into a beetle.'],
    E: ['I lie very still in my smooth room.', 'Inside the pupa, my whole body is changing.', 'Legs, wings and horns are growing.'],
    yesno: [['Am I a pupa?', true], ['Do I eat now?', false]] },
  emerge: { title: 'A beetle!', pic: 'beetle', gate: true,
    A: ['I am a beetle!', 'Look at my horn!'],
    B: ['Look at me!', 'I am a big beetle!', 'I have a horn.'],
    C: ['I come out of the pupa.', 'I am a beetle now!', 'I have two big horns.'],
    D: ['I split out of the pupa.', 'I am a beetle! I am soft and pale.', 'I wait for my shell to get hard.'],
    E: ['I break out of the pupa as a soft, pale beetle.', 'I wait in my room while my shell gets hard and dark.', 'Then I will dig up to the forest.'],
    yesno: [['Am I a beetle now?', true], ['Am I a grub now?', false]] },
  out: { title: 'Night in the forest', pic: 'moon', gate: false,
    A: ['I go up!', 'I see the moon.'],
    B: ['I dig up, up, up!', 'Here is the night.', 'I see the moon.'],
    C: ['I dig up and out of the dirt.', 'It is night in the forest.', 'Now I can find food.'],
    D: ['I dig up out of the soil.', 'It is night, the time when beetles come out.', 'I am hungry for fruit.'],
    E: ['I push up through the soil and out into the night.', 'Hercules beetles come out after dark to find food.', 'The forest smells of ripe fruit.'],
    yesno: [['Is it night?', true], ['Am I in the egg?', false]] },
  fruit: { title: 'Sweet fruit', pic: 'fruit', gate: false,
    A: ['I see a fruit.', 'I eat it!', 'I like it!'],
    B: ['Look at the fruit!', 'I eat and eat.', 'It is so good!'],
    C: ['I find a fruit on the ground.', 'It is soft and sweet.', 'I eat it up!'],
    D: ['I find a soft fruit on the ground.', 'I lap up the sweet juice.', 'Now I feel strong.'],
    E: ['Ripe fruit falls from the trees at night.', 'I lap up its sweet juice with my brushy mouth.', 'Fruit gives me the energy to fly.'],
    yesno: [['Do I eat fruit?', true], ['Do I eat stones?', false]] },
  fly: { title: 'I can fly!', pic: 'wings', gate: false,
    A: ['I can fly!', 'Up, up, up!'],
    B: ['I open my wings.', 'I fly up!', 'Look at me go!'],
    C: ['My hard wings go up.', 'My thin wings come out.', 'I fly over the forest!'],
    D: ['I lift my hard wing covers.', 'My thin wings open, and I fly.', 'I buzz loudly over the trees.'],
    E: ['My hard wing cases lift up like doors.', 'My thin flying wings unfold underneath.', 'I am heavy, but I can fly!'],
    yesno: [['Can I fly?', true], ['Do my hard wings flap?', false]] },
  lift: { title: 'So strong!', pic: 'stick', gate: false,
    A: ['I see a stick.', 'I can lift it!'],
    B: ['Look at the big stick.', 'I lift it up!', 'I am strong.'],
    C: ['A big stick is in my way.', 'I put my horn under it and lift.', 'Up it goes!'],
    D: ['A heavy stick is in my way.', 'I push my horn under it and lift.', 'Beetles are very strong for their size.'],
    E: ['Rhinoceros beetles are some of the strongest animals for their size.', 'I slide my horn under the stick and lift.', 'It flips over!'],
    yesno: [['Can I lift the stick?', true], ['Am I a weak beetle?', false]] },
  rival: { title: 'Horn to horn', pic: 'rival', gate: false,
    A: ['I see a beetle.', 'I can push!', 'Push, push, push!'],
    B: ['Look! A big beetle.', 'He is on my fruit.', 'I will push him!'],
    C: ['Another beetle comes to my fruit.', 'He has a big horn too.', 'We push and push!'],
    D: ['Another male beetle wants my fruit.', 'We lock horns and push.', 'Who will win?'],
    E: ['A rival male lands next to my fruit.', 'We grab each other between our horns and push.', 'The winner lifts the other one up and throws him away.'],
    yesno: [['Do we push?', true], ['Do we sing?', false]] },
  champion: { title: 'Champion!', pic: 'beetle', gate: false,
    A: ['Look at me!', 'I am up, up, up!'],
    B: ['I win, I win, I win!', 'I am the big one here.'],
    C: ['I won three times!', 'I am the best beetle in the forest.'],
    D: ['I won every push.', 'Now I am the champion of the forest.'],
    E: ['I have won three wrestling matches in a row.', 'Every beetle in the forest knows I am the champion.'],
    yesno: [['Did I win?', true], ['Am I a grub?', false]] },
  eggs: { title: 'A new generation', pic: 'female', gate: true,
    A: ['I see a beetle.', 'I see eggs!'],
    B: ['Here she is!', 'She has no horn.', 'She will lay eggs.'],
    C: ['A beetle with no horn comes to me.', 'She is a mom beetle.', 'She will lay eggs in a log.'],
    D: ['A female beetle came to find me.', 'Females have no horns.', 'She lays her eggs in the soft, rotting log.'],
    E: ['A female beetle has no horns, and her wing cases are brown.', 'She lays her eggs one by one in the rotting log.', 'Soon new grubs will hatch, and it all starts again.'],
    yesno: [['Does she have a horn?', false], ['Will she lay eggs?', true]] },
  coati: { title: 'The coati', pic: 'coati', gate: false,
    A: ['I see a coati.', 'I go down!'],
    B: ['A coati is here!', 'I hide in the log.', 'Go down, down, down!'],
    C: ['A coati sniffs at the log.', 'It has a long nose.', 'I go deep, deep into the wood.'],
    D: ['A coati is sniffing for grubs.', 'I hide deep inside the log where it can not reach.', 'Soon it gives up and goes away.'],
    E: ['A coati pokes its long nose into the rotting wood.', 'I keep very still, deep inside the log.', 'After a while it gives up and wanders away.'],
    yesno: [['Do I hide?', true], ['Do I go to the coati?', false]] },
  rain: { title: 'Black in the rain', pic: 'rain', gate: false,
    A: ['I see rain.', 'Look at my wings!'],
    B: ['Here is the rain.', 'My wings go black!'],
    C: ['It is wet now.', 'My wings are black now!', 'When it is dry, they are green.'],
    D: ['When the air is wet, my wing covers turn black.', 'When the air is dry, they turn yellow and green.'],
    E: ['My wing cases soak up water from the damp air.', 'That makes them turn black.', 'When the air dries, they change back to yellow.'],
    yesno: [['Do my wings go black in the rain?', true], ['Do I turn red?', false]] },
  friend: { title: 'Another grub', pic: 'grub', gate: false,
    A: ['I see a grub.', 'Hi, grub!'],
    B: ['Look! Here is a grub.', 'It is like me.'],
    C: ['I find another grub.', 'It is eating wood too.'],
    D: ['I find another grub in the log.', 'It is my brother or sister.'],
    E: ['I bump into another grub in the log.', 'We hatched from the same mother.', 'There is plenty of wood for us all.'],
    yesno: [['Is it a grub?', true], ['Is it a coati?', false]] },
  fungus: { title: 'Fungus', pic: 'fungus', gate: false,
    A: ['I see fungus.', 'I eat it!'],
    B: ['Look at the white wood.', 'It has fungus.', 'Yum!'],
    C: ['This wood is white and soft.', 'It has fungus in it.', 'It helps me grow big.'],
    D: ['Fungus makes the wood soft.', 'It is very good to eat.', 'I grow fast when I eat it.'],
    E: ['White threads of fungus soften the rotting wood.', 'Wood like this helps a grub grow quickly.'],
    yesno: [['Is the wood white?', true], ['Is the fungus a stone?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', fullGrown: 'chamber', surfaced: 'out', firstFruit: 'fruit', firstFlight: 'fly', firstLift: 'lift', rivalSeen: 'rival', champion: 'champion', coati: 'coati', wetWings: 'rain', metGrub: 'friend', ateFungus: 'fungus' };

/* ---------- read-and-do missions ----------
   who: grub (a grub in the log) · beetle (a grown beetle) · flying · rival (a rival is here)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'fungus', who: 'grub', A: 'Eat the white wood.', B: 'Find the white wood.', C: 'Find wood with fungus in it.', D: 'Find some white fungus and eat it.', E: 'Find the white fungus threads and eat them.' },
  { key: 'bottom', who: 'grub', A: 'Go down, down!', B: 'Go down to the bottom.', C: 'Go to the bottom of the log.', D: 'Go down to the bottom of the log.', E: 'Chew your way to the bottom of the log.' },
  { key: 'top', who: 'grub', A: 'Go up, up!', B: 'Go up to the top.', C: 'Go up to the top of the log.', D: 'Climb up to the top of the log.', E: 'Chew your way up to the top of the log.' },
  { key: 'end', who: 'grub', from: 'B', A: 'Go to the end.', B: 'Go to the end of the log.', C: 'Go to the other end of the log.', D: 'Go to the far end of the log.', E: 'Chew your way to the far end of the log.' },
  { key: 'friend', who: 'grub', A: 'Go to a grub.', B: 'Find a grub friend.', C: 'Find another grub.', D: 'Find another grub in the log.', E: 'Find one of your brothers or sisters.' },
  { key: 'eat', who: 'grub', A: 'Eat, eat, eat!', B: 'Eat lots of wood.', C: 'Eat lots and lots of wood.', D: 'Eat lots of wood and grow.', E: 'Eat lots of wood to grow bigger.' },
  { key: 'fruit', who: 'beetle', A: 'Eat a fruit.', B: 'Find a fruit to eat.', C: 'Find a fruit and eat it.', D: 'Find some fruit on the ground.', E: 'Find some ripe fruit and eat it.' },
  { key: 'climb', who: 'beetle', A: 'Go up the tree.', B: 'Go up the big tree.', C: 'Go up to the top of a tree.', D: 'Climb to the top of the big tree.', E: 'Climb all the way to the top of the tallest tree.' },
  { key: 'flyhigh', who: 'beetle', A: 'Fly up, up, up!', B: 'Fly up to the moon!', C: 'Fly up over the trees.', D: 'Fly up over the top of the trees.', E: 'Fly high over the treetops.' },
  { key: 'lift', who: 'beetle', A: 'Lift a stick.', B: 'Lift a big stick.', C: 'Find a stick and lift it.', D: 'Find a heavy stick and lift it.', E: 'Find a heavy stick and flip it over.' },
  { key: 'log', who: 'beetle', A: 'Go to the log.', B: 'Go back to the log.', C: 'Go back to the old log.', D: 'Go back to the log where you grew up.', E: 'Visit the log where you grew up.' },
  { key: 'ground', who: 'flying', A: 'Go down.', B: 'Fly down to the ground.', C: 'Land on the ground.', D: 'Fly down and land on the ground.', E: 'Fly down and land on the forest floor.' },
  { key: 'branch', who: 'flying', from: 'B', A: 'Go to a branch.', B: 'Fly to a branch.', C: 'Land on a branch.', D: 'Fly over and land on a branch.', E: 'Land on a branch high in a tree.' },
  { key: 'rival', who: 'rival', A: 'Push the beetle!', B: 'Push the big beetle!', C: 'Go and push the other beetle.', D: 'Push the other beetle off.', E: 'Wrestle the other beetle away from the fruit.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am an egg. Wait for it.', D: 'I am an egg. Soon I will hatch.', E: 'I am an egg, deep inside a log.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle out!', C: 'Wiggle out of the egg.', D: 'Wiggle out of the egg.', E: 'Push the arrows to wiggle out.' },
  eat: { A: 'Eat the wood!', B: 'Eat the wood!', C: 'Push into the wood to eat it.', D: 'Push into the soft wood to eat it.', E: 'Push into the soft wood to chew it.' },
  fungus: { A: 'Eat the white wood!', B: 'Eat the white wood. Yum!', C: 'The white wood is good to eat.', D: 'The white wood has fungus. Eat it!', E: 'White wood has fungus in it. It helps me grow.' },
  hard: { A: 'No! Go down.', B: 'Too hard! Go this way.', C: 'Too hard! Find soft wood.', D: 'That wood is too hard. Find soft wood.', E: 'That wood is too hard to chew. Find softer wood.' },
  rock: { A: 'No! Go down.', B: 'A stone! Go this way.', C: 'A stone! Go a new way.', D: 'I can not eat a stone. Find a new way.', E: 'Grubs can not chew stone. Go around it.' },
  outside: { A: 'Go in the log!', B: 'Go in the log!', C: 'Stay in the log. It is safe.', D: 'Stay inside the log where it is safe.', E: 'Stay inside the log, where it is safe.' },
  tight: { A: 'Look at me!', B: 'My skin is too little!', C: 'My skin is tight!', D: 'My skin is too tight!', E: 'My skin is too tight. Time to moult!' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more to make a big horn.', E: 'A big grub makes a big beetle with a big horn.' },
  dig: { A: 'Go down! Dig!', B: 'Dig down in the dirt!', C: 'Dig down into the dirt.', D: 'Dig down out of the log into the soil.', E: 'I am full grown. Dig down into the soil.' },
  deeper: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down some more.', D: 'Dig a little deeper.', E: 'Keep digging. The room must be deep and safe.' },
  build: { A: 'Dig a room!', B: 'Make a room!', C: 'Make a room here.', D: 'This is deep enough. Make my room.', E: 'This is deep enough. Make a smooth room.' },
  building: { A: 'Dig, dig, dig!', B: 'Dig, dig, dig!', C: 'Make it smooth!', D: 'Keep making my room.', E: 'Keep pressing the walls smooth.' },
  pupa: { A: 'I am a pupa.', B: 'I am a pupa. I sleep.', C: 'I am a pupa. Wait and see.', D: 'I am a pupa. I am changing inside.', E: 'I am a pupa. Something is changing inside.' },
  harden: { A: 'I am a beetle!', B: 'I am soft. Wait.', C: 'I am soft. Wait to get hard.', D: 'I wait for my shell to get hard.', E: 'I wait for my shell to get hard and dark.' },
  digup: { A: 'Go up! Dig!', B: 'Dig up, up, up!', C: 'Dig up and out of the dirt.', D: 'Dig up to the forest.', E: 'My shell is hard. Dig up to the forest floor.' },
  night: { A: 'I see the moon!', B: 'It is night! Find fruit.', C: 'It is night. Find some fruit.', D: 'It is night, beetle time! Find fruit.', E: 'Night is beetle time. Look for ripe fruit.' },
  fruit: { A: 'Eat the fruit!', B: 'Fruit! Go and eat it.', C: 'Go to the fruit and eat it.', D: 'There is fruit. Go and eat it.', E: 'There is ripe fruit. Go and eat it.' },
  fly: { A: 'I can fly!', B: 'I can fly up!', C: 'I can fly. Open my wings.', D: 'Open my wings to fly.', E: 'Open my wings to fly, then land.' },
  tired: { A: 'Eat a fruit!', B: 'Eat fruit to fly!', C: 'I am tired. Eat some fruit.', D: 'I am tired. Eat fruit to fly again.', E: 'I am tired. Fruit gives me energy to fly.' },
  climb: { A: 'Go up the tree!', B: 'Go up the big tree!', C: 'Go up the tree. Push up.', D: 'Push up to climb the tree.', E: 'Push up at the tree to climb it.' },
  lift: { A: 'Lift it!', B: 'Lift the stick!', C: 'Lift it with my horn.', D: 'That stick is heavy. Lift it up.', E: 'That stick is heavy. Lift it with my horn.' },
  rival: { A: 'A beetle! Push!', B: 'A big beetle! Push him!', C: 'Another beetle! Go and push him.', D: 'Another male! Go and push him.', E: 'A rival male! Go and wrestle him.' },
  wrestle: { A: 'Push, push, push!', B: 'Push, push, push!', C: 'Push! Then lift him up!', D: 'Push him! Then lift him up!', E: 'Push him, then lift him up high!' },
  won: { A: 'Yes, yes, yes!', B: 'I win! He is gone.', C: 'I won! He went away.', D: 'I won! He flew away.', E: 'I won! He flew away, and the fruit is mine.' },
  lost: { A: 'No! Eat a fruit.', B: 'No! Eat and play again.', C: 'He won. Eat fruit and try again.', D: 'He won. Eat fruit to get strong again.', E: 'He flipped me! Eat fruit to get strong, then try again.' },
  champion: { A: 'Look at me!', B: 'I win, I win!', C: 'I am the best beetle!', D: 'I am the champion!', E: 'I am the champion of the forest!' },
  female: { A: 'I see a beetle!', B: 'Go and say hi!', C: 'Go to her and say hi.', D: 'A female beetle! Go and say hi.', E: 'A female beetle! Go and say hello.' },
  eggs: { A: 'I see eggs!', B: 'Eggs! A new grub!', C: 'She will lay eggs in the log.', D: 'She lays her eggs in the log.', E: 'She lays her eggs, and it all starts again.' },
  coati: { A: 'A coati! Go down!', B: 'A coati! Hide!', C: 'A coati! Go deep into the wood.', D: 'A coati! Hide deep inside the log.', E: 'A coati is sniffing for grubs! Go deep inside.' },
  safe: { A: 'No coati!', B: 'The coati is gone.', C: 'The coati went away.', D: 'The coati gave up and went away.', E: 'The coati gave up and wandered away.' },
  rain: { A: 'Rain! Look at my wings!', B: 'Rain! My wings go black!', C: 'It is wet. My wings go black!', D: 'It is wet. My wing covers turn black.', E: 'Damp air makes my wing cases turn black.' },
  day: { A: 'I see the sun. I sleep.', B: 'It is day. I sleep.', C: 'It is day. I rest.', D: 'It is day. Beetles rest until night.', E: 'It is day. Beetles rest until it gets dark.' },
  sniff: { A: 'Go, go, go!', B: 'Go this way! Eat!', C: 'Go this way to find wood.', D: 'Follow the arrow to find more wood.', E: 'Follow the arrow to find more soft wood.' },
  soil: { A: 'Go up! Eat wood!', B: 'No! Go back to the wood.', C: 'This is dirt. Go back to the wood.', D: 'Dirt is not food. Go back to the wood.', E: 'Soil is not food for a grub. Go back to the wood.' },
  friend: { A: 'I see a grub!', B: 'Look! A grub!', C: 'I find another grub!', D: 'Another grub! It is like me.', E: 'Another grub! We hatched from the same mother.' }
};
