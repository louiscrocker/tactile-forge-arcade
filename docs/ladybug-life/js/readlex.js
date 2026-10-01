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
   (see its READING_DESIGN.md) so a level means the same thing in
   every Tactile Forge game.  Words only this game needs are in
   LEVEL_EXTRA, on purpose, one level at a time.
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

/* new words at each level; a level may use its own words and every earlier level's (shared with Frog Pond) */
const LEVEL_NEW = {
  A: 'a an i see the can look at is my like go me we up am in it to eat hop no yes down sleep sing',
  B: 'and here you big little come said not on he she get swim sit hide out have two three four one what this fast run jump play all will are for with night black green red brown cold air kick want of they do has too',
  C: 'bites read word words into went was now some where there that then back under away dive snap lay from time day warm wet new good help find rest grow grew gone puff other top wake wiggle put dots be wants by over our',
  D: 'spring hungry when again so after just very could about make came saw off soon first last long open stay know feel deep safe slow tiny keeps hiding its jaw shoots toes as front smaller every climb lily buzzes throat balloon song hatch did short covers dig soft until must days gets sits next hop up',
  E: 'goes lid still stiff singing them eating your tongue because through around before while something tickles webbed well gills close lungs gulp shrinking push stuck ball dot waiting flick zoom like spring winter every quiet other bright wakes hungry warmer melts sunny fills'
};
/* words only Ladybug needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'fly stop',
  B: 'land pink yellow eek',
  C: 'stick freeze crawl let bottom high sky lots shell glowing way or tap',
  D: 'tight leave bigger biggest orange glue myself hard inside changing thin unfold opens more near full watch hold flies phew flew sweet drops wild molt change splits keep summer',
  E: 'pale behind called molting fourth stage body growing swoops garden also taste bad lift doors buzz neat cluster few cycle starts squeeze huddle guard guards farmer cows give honeydew sneak another hunting different gobble above guarding scare second spiky hunt along show warms mother life many shy everywhere turn fall together'
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
  ladybug: 'adult', ladybugs: 'adult', bug: 'adult', bugs: 'adult', egg: 'egg', eggs: 'egg',
  larva: 'larva', larvae: 'larva', pupa: 'pupa', aphid: 'aphid', aphids: 'aphid',
  ant: 'ant', ants: 'ant', bird: 'bird', birds: 'bird', leaf: 'leaf', leaves: 'leaf',
  plant: 'plant', plants: 'plant', stem: 'plant', stems: 'plant', branch: 'plant',
  wall: 'wall', crack: 'wall', sun: 'sun', moon: 'moon', rain: 'rain', snow: 'snow',
  wings: 'wings', wing: 'wings', spots: 'spots', spot: 'spots', skin: 'skin',
  flower: 'flower', flowers: 'flower', grass: 'grass'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  go:     { A: 'go',    B: 'go',    C: 'wiggle', D: 'wiggle out',       E: 'Wiggle out of the egg.' },
  eat:    { A: 'eat',   B: 'eat',   C: 'eat',    D: 'eat the aphid',    E: 'Eat the green aphid.' },
  pupate: { A: 'stop',  B: 'stop',  C: 'stick',  D: 'stick to the leaf', E: 'Stick to the leaf and change.' },
  twitch: { A: 'go',    B: 'kick',  C: 'wiggle', D: 'wiggle and kick',  E: 'Wiggle to scare the ants!' },
  fly:    { A: 'fly',   B: 'fly',   C: 'fly',    D: 'fly away',         E: 'Open my wings and fly away!' },
  land:   { A: 'down',  B: 'land',  C: 'land',   D: 'land on the plant', E: 'Land on the green plant.' },
  sleep:  { A: 'sleep', B: 'sleep', C: 'sleep',  D: 'sleep in the wall', E: 'Sleep in the wall until spring.' },
  eggs:   { A: 'eggs',  B: 'eggs',  C: 'lay eggs', D: 'lay my eggs',    E: 'Lay my eggs by the aphids.' },
  hide:   { A: 'stop',  B: 'hide',  C: 'freeze', D: 'freeze and hide',  E: 'Freeze so the bird will not see me!' }
};
/* the picture on each action card */
const ACTION_PIC = { go: 'egg', eat: 'aphid', pupate: 'pupa', twitch: 'pupa', fly: 'wings', land: 'plant', sleep: 'wall', eggs: 'egg', hide: 'bird' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the change waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'A tiny egg', pic: 'egg', gate: false,
    A: ['I am in an egg.', 'I see a leaf.', 'I can go!'],
    B: ['I am a little egg.', 'I am on a big leaf.', 'Here I come!'],
    C: ['I am a little yellow egg.', 'I am on a leaf by the aphids.', 'Now I will wiggle out!'],
    D: ['I am a tiny yellow egg on a leaf.', 'There are aphids on this plant.', 'Soon I will wiggle out and eat!'],
    E: ['I am a tiny yellow egg on a leaf.', 'My mother put me near the aphids.', 'Soon I will wiggle out, very hungry!'],
    yesno: [['Am I on a leaf?', true], ['Can I fly?', false]] },
  skin: { title: 'Out of my skin', pic: 'skin', gate: true,
    A: ['I eat an aphid.', 'I eat an aphid.', 'I see my skin!'],
    B: ['I eat the aphids.', 'My skin is too little.', 'Look! I get out of my skin!'],
    C: ['I eat and eat.', 'Now my skin is too little.', 'I wiggle out and grow!'],
    D: ['My skin gets too tight.', 'It splits down my back.', 'I crawl out and leave it on the plant.'],
    E: ['My skin is too tight, so it splits down my back.', 'I wiggle out, soft and pale, and leave my skin behind.', 'This is called molting.'],
    yesno: [['Is my skin too little?', true], ['Can I fly now?', false]] },
  grow: { title: 'Bigger again', pic: 'L3', gate: true,
    A: ['Look at me!', 'I see my skin.', 'I like my spots!'],
    B: ['Look at me!', 'Here is my little skin.', 'I am big and fast!'],
    C: ['I grew and grew!', 'I have spots on my back.', 'Now I can eat big aphids.'],
    D: ['I molt again and come out bigger.', 'Now I have orange spots on my back.', 'I am very hungry!'],
    E: ['I molt for the second time.', 'Bright orange spots show on my spiky back.', 'I hunt aphids all day long.'],
    yesno: [['Do I have spots?', true], ['Am I an egg?', false]] },
  big: { title: 'The biggest larva', pic: 'L4', gate: true,
    A: ['I eat, eat, eat!', 'Look at me!', 'I am a larva!'],
    B: ['Look at me!', 'I am a big, big larva.', 'I can eat and eat!'],
    C: ['Now I am a big larva.', 'I eat and eat and eat.', 'Then I will be a pupa.'],
    D: ['This is my last and biggest skin.', 'I eat and eat.', 'Soon I will stop and change.'],
    E: ['This is my fourth and last stage as a larva.', 'I eat as fast as I can.', 'Soon I will stop and change into something new.'],
    yesno: [['Am I a big larva?', true], ['Am I an egg?', false]] },
  pupa: { title: 'The pupa', pic: 'pupa', gate: true,
    A: ['I stop.', 'I stop.', 'I am a pupa!'],
    B: ['I stop on a big leaf.', 'I am not a larva.', 'I am a pupa!'],
    C: ['I stick to a leaf.', 'I am a pupa now.', 'I rest. I do not eat.', 'I will be a ladybug!'],
    D: ['I glue myself to a leaf.', 'My skin gets hard, like a shell.', 'Inside, I am changing.', 'Soon I will be a ladybug!'],
    E: ['I glue myself to a leaf and stay very still.', 'Inside my hard shell, my body is changing.', 'I am growing wings for a ladybug!'],
    yesno: [['Am I a pupa?', true], ['Do I eat now?', false]] },
  ladybug: { title: 'A ladybug!', pic: 'adult', gate: true,
    A: ['Look at me!', 'I am a ladybug!'],
    B: ['Look at me!', 'I am a ladybug.', 'I have wings!'],
    C: ['I come out of the pupa.', 'I am a ladybug now!', 'My wings are wet.'],
    D: ['I crawl out of the pupa.', 'I am yellow and soft, with no spots.', 'Soon my spots will come!'],
    E: ['I push out of the pupa, pale yellow and soft.', 'My shell gets hard and red.', 'Then my black spots show up, one by one!'],
    yesno: [['Am I a ladybug?', true], ['Am I a larva?', false], ['Do I have wings?', true]] },
  fly: { title: 'First flight', pic: 'wings', gate: false,
    A: ['I can fly!', 'I fly up, up, up!'],
    B: ['Look at my wings!', 'Up, up I go.', 'I can fly!'],
    C: ['My wings are under my red shell.', 'Up go my wings!', 'Now I can fly!'],
    D: ['My hard red shell opens up.', 'My thin wings unfold.', 'I fly off to find more aphids.'],
    E: ['I lift my hard red shell like two little doors.', 'My thin wings unfold, and I buzz into the air.', 'I fly off to find more aphids.'],
    yesno: [['Can I fly?', true], ['Are my wings under my shell?', true]] },
  bird: { title: 'A big bird', pic: 'bird', gate: false,
    A: ['I see a bird!', 'I go down.', 'I stop.'],
    B: ['I see a big bird.', 'I stop and sit.', 'It can not see me!'],
    C: ['A big bird is here!', 'I freeze. I do not wiggle.', 'The bird is gone!'],
    D: ['A hungry bird flies over the plant.', 'I freeze and do not wiggle.', 'It can not see me, so it flies away.'],
    E: ['A hungry bird swoops over the garden.', 'I freeze and stay still, or hide under a leaf.', 'Birds also know that red bugs taste bad!'],
    yesno: [['Is the bird big?', true], ['Do I wiggle?', false]] },
  ants: { title: 'The ants', pic: 'ant', gate: false,
    A: ['I see an ant.', 'I see the aphids.', 'I go up!'],
    B: ['Look at the ant!', 'It is with the aphids.', 'It said, "Go, go, go!"'],
    C: ['The ant is with the aphids.', 'It will not let me eat.', 'I go back and find a new way.'],
    D: ['Ants keep the aphids safe.', 'The aphids make sweet drops for the ants.', 'I must find a new way to the aphids.'],
    E: ['Ants guard the aphids like a farmer guards cows.', 'The aphids give them sweet honeydew.', 'I sneak around by another branch.'],
    yesno: [['Is the ant with the aphids?', true], ['Will the ant let me eat?', false]] },
  eggs: { title: 'My eggs', pic: 'egg', gate: false,
    A: ['I see my eggs.', 'I like my eggs!'],
    B: ['Here are my eggs.', 'They are on a leaf.', 'They are little and yellow.'],
    C: ['I put my eggs on a leaf.', 'Aphids are on this plant, too.', 'My eggs will be larvae.'],
    D: ['I lay my eggs on a leaf near the aphids.', 'Soon they will hatch.', 'The larvae will be hungry, just like I was.'],
    E: ['I lay a neat cluster of yellow eggs near the aphids.', 'In a few days they will hatch.', 'Then the life cycle starts all over again!'],
    yesno: [['Are my eggs on a leaf?', true], ['Are the eggs big?', false]] },
  winter: { title: 'Winter sleep', pic: 'wall', gate: false,
    A: ['I see the snow.', 'I go in.', 'I sleep.'],
    B: ['It is cold.', 'I go in the wall.', 'We sleep here.'],
    C: ['It is cold now.', 'I go into a crack in the wall.', 'Other ladybugs sleep here with me.'],
    D: ['The days get short and cold.', 'I crawl into a warm crack in the wall.', 'We all sleep in the wall until spring.'],
    E: ['The days are short and cold, and snow covers the garden.', 'I squeeze into a crack in the wall with many other ladybugs.', 'We huddle together and sleep until spring.'],
    yesno: [['Is it cold?', true], ['Do I sleep in the wall?', true], ['Is it warm?', false]] },
  spring: { title: 'Spring!', pic: 'sun', gate: false,
    A: ['I see the sun!', 'I am up!'],
    B: ['The snow is not here.', 'I see the sun.', 'I am up, and I want to eat!'],
    C: ['The snow is gone!', 'The sun is warm.', 'I wake up and I want to eat aphids.'],
    D: ['The snow is gone and the sun is warm.', 'I crawl out of the wall.', 'I am very hungry!'],
    E: ['The snow melts and the sun warms the garden.', 'I crawl out, stiff and hungry.', 'The aphids are back. Spring is here!'],
    yesno: [['Is the snow here?', false], ['Do I want to eat?', true]] }
};
/* when each non-gate page opens (Bus event → page), once per session */
const STORY_TRIGGERS = { takeoff: 'fly', birdSafe: 'bird', birdScare: 'bird', shoved: 'ants', eggsLaid: 'eggs', hibernate: 'winter', wake: 'spring' };

/* ---------- read-and-do missions ----------
   who: branch (crawling on a plant) · eater (can eat now) · flyer (a dry adult) · flying
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'top', who: 'branch', A: 'Go up, up, up!', B: 'Go up, up, up!', C: 'Crawl up to the top.', D: 'Crawl up to the top of the plant.', E: 'Crawl all the way up to the top of the plant.' },
  { key: 'bottom', who: 'branch', A: 'Go down, down, down!', B: 'Go down, down, down!', C: 'Crawl down to the bottom.', D: 'Crawl down to the bottom of the plant.', E: 'Crawl all the way down to the bottom of the stem.' },
  { key: 'flower', who: 'branch', A: 'Go to a flower.', B: 'Go to a big flower.', C: 'Crawl up to a flower.', D: 'Crawl over to a flower.', E: 'Crawl along the stem to a flower.' },
  { key: 'eat3', who: 'eater', A: 'Eat, eat, eat!', B: 'Eat three aphids.', C: 'Find and eat three aphids.', D: 'Find three aphids to eat.', E: 'Find three aphids and gobble them up.' },
  { key: 'ant', who: 'branch', A: 'Look at the ant.', B: 'Go to an ant.', C: 'Find an ant.', D: 'Find an ant on the plant.', E: 'Find an ant guarding the aphids.' },
  { key: 'larva', who: 'branch', A: 'Look at the larva.', B: 'Go to a larva.', C: 'Find the other larva.', D: 'Find a wild larva on the plant.', E: 'Find a wild larva hunting aphids.' },
  { key: 'plant', who: 'flyer', A: 'Fly to a plant.', B: 'Fly to a plant.', C: 'Fly over to a new plant.', D: 'Fly over to a new plant and land.', E: 'Fly over to a different plant and land.' },
  { key: 'high', who: 'flying', A: 'Fly up, up, up!', B: 'Fly up, up, up!', C: 'Fly up high in the sky.', D: 'Fly up high over the plants.', E: 'Fly up high above the garden.' }
].concat(['green', 'pink', 'black', 'yellow'].map(c => ({
  key: 'eat_' + c, who: 'eater', color: c, from: 'B',
  A: `Eat a ${c} aphid.`, B: `Eat a ${c} aphid.`, C: `Find a ${c} aphid and eat it.`, D: `Find a ${c} aphid and eat it up.`, E: `Look for a ${c} aphid and gobble it up.`
})));

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'Go! Go! Go!', B: 'Go! Come out!', C: 'Read the word to wiggle out.', D: 'Read the words to wiggle out of the egg.', E: 'Read the words to wiggle out of your egg.' },
  crawl: { A: 'Go to an aphid.', B: 'Go to the aphids and eat.', C: 'Crawl to the aphids and eat.', D: 'Crawl up the plant to find aphids.', E: 'Crawl along the stems and eat the aphids.' },
  branch: { A: 'Go up to the aphids.', B: 'Go up to the aphids.', C: 'Tap the plant to go there.', D: 'Tap the plant to crawl there.', E: 'Tap the plant to crawl over there.' },
  molt: { A: 'Look at me!', B: 'I get big!', C: 'I grow! I sit.', D: 'I grow. Stay here and rest.', E: 'I am growing. Sit very still.' },
  biggest: { A: 'Look at me!', B: 'I am a big larva!', C: 'Now I am a big larva. Eat!', D: 'I am the biggest larva now. Eat up!', E: 'I am the biggest larva now. Eat lots of aphids!' },
  readyPupa: { A: 'Go to a leaf.', B: 'Go to the leaf.', C: 'Go to a glowing leaf.', D: 'I am full. Go to a glowing leaf.', E: 'I am full. Crawl to a glowing leaf to change.' },
  pupa: { A: 'I am a pupa.', B: 'I am a pupa. Kick!', C: 'I am a pupa. Wiggle!', D: 'I am changing. Wiggle and kick!', E: 'I am changing inside. Wiggle to scare the ants!' },
  fresh: { A: 'Look at me!', B: 'Look at my spots!', C: 'My spots will come.', D: 'My shell is soft. Watch my spots come.', E: 'My shell is soft and pale. Watch my spots show up.' },
  adult: { A: 'I can fly!', B: 'I can fly! Eat!', C: 'Fly and eat aphids.', D: 'Eat more aphids so I can lay eggs.', E: 'Eat lots of aphids so I can lay my eggs.' },
  flying: { A: 'Go down to a plant.', B: 'Land on a plant.', C: 'Fly to a plant and land.', D: 'Fly near a plant, then land.', E: 'Fly close to a branch, then land.' },
  readyEggs: { A: 'Go to a leaf.', B: 'Eggs! Go to a leaf.', C: 'Go to a glowing leaf to lay eggs.', D: 'Go to a glowing leaf to lay my eggs.', E: 'Crawl to a glowing leaf and lay my eggs.' },
  landHint: { A: 'Go to a plant.', B: 'Go to the plant.', C: 'Go to the plant to land.', D: 'Fly near the plant to land.', E: 'Fly close to a branch to land.' },
  bird: { A: 'A bird! Stop!', B: 'A big bird! Hide!', C: 'A big bird! Freeze!', D: 'A big bird! Freeze and hide!', E: 'A big bird is here! Freeze or hide under a leaf!' },
  birdAdult: { A: 'A bird! Stop!', B: 'A big bird! Hide!', C: 'A big bird! Freeze!', D: 'A big bird! Hold down to freeze!', E: 'A big bird is here! Hold down to freeze!' },
  birdScare: { A: 'A bird! Go down!', B: 'Eek! Hide, hide!', C: 'Eek! Freeze and hide.', D: 'Eek! Next time, hold down to freeze.', E: 'Eek! Next time, hold down to freeze.' },
  rain: { A: 'I see rain.', B: 'Rain! Look for aphids.', C: 'Rain! Some aphids hide.', D: 'Rain! Some aphids hide under the leaves.', E: 'Rain! The shy aphids hide under the leaves.' },
  winter: { A: 'Go to the wall.', B: 'It is cold! Go to the wall.', C: 'It is cold. Fly to the wall.', D: 'It is cold. Fly to the crack in the wall.', E: 'It is cold. Fly to the warm crack in the wall to sleep.' },
  hibernating: { A: 'I sleep.', B: 'I sleep in the wall.', C: 'I sleep in the warm wall.', D: 'I sleep until spring.', E: 'I sleep, quiet and still, until spring.' },
  spring: { A: 'I see the sun!', B: 'I am up! I want to eat!', C: 'The snow is gone! Eat!', D: 'The snow is gone. Time to eat!', E: 'Spring is here. Time to eat!' },
  summer: { A: 'I see the sun!', B: 'I see the sun! Eat, eat, eat!', C: 'The sun is warm. Lots of aphids!', D: 'Summer is here! There are lots of aphids.', E: 'Summer! The aphids are everywhere.' },
  autumn: { A: 'I see a leaf.', B: 'The leaves come down.', C: 'The leaves come down now.', D: 'The leaves come off the plants.', E: 'The leaves turn orange and fall.' },
  otherPlant: { A: 'Fly to a plant.', B: 'Fly to a big plant.', C: 'Fly to a new plant for aphids.', D: 'Fly to a new plant to find more aphids.', E: 'Fly to a different plant to find more aphids.' },
  frozen: { A: 'I stop.', B: 'I sit. It can not see me.', C: 'I freeze. The bird can not see me.', D: 'I freeze. The bird can not see me.', E: 'I freeze. The bird can not see me.' },
  safe: { A: 'No bird!', B: 'The bird is not here.', C: 'The bird is gone!', D: 'Phew! The bird flew away.', E: 'Phew! The bird flew away.' }
};
