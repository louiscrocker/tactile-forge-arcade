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
/* words only Stag Beetle needs, added to a level on purpose (tools/fill-words.mjs keeps this in step) */
const LEVEL_EXTRA = {
  A: "fly dig lift push hi lay white cold big he little sit",
  B: "sneak say bite smell by hatch skin wiggle now so again giant rub legs sings good digs back wet day there made warm sky whirr oops fell wants him flies away under old did best new find bottom top friend lots song gold puff ground wait into yum hard soft around stay food tight more follow arrow winter coming spring press e listen then claws low turn worms centipede many woodlice deep went make or grow time stop space whirrr hold that way puffs lifts high tired land rest bonk splash pond upside sweet ring boys ones orange won flew off try when keep still got past them who pile apple her lays first done",
  C: "mom soon six smaller another does mouth threads through makes myself much comes dry year if eating as flying last snowing thin garden well hurt tongue friends opens his fine small know saw but strong bark feelers home digging king starts climb",
  D: "stand tall dug rotting head bigger hears spread stays tunnel singing rained shake enough smooth round inside body changing pale those years before heavy standing landed rock side lick brush male along lock goes busy pushing path knew grown runs right spiky life lie beside start your street",
  E: "hello huge mother laid growing chew curl letter c insect stretch moult split wriggle third finger their together creaking scientists think may tell slowly dead soften frost creeps below moles tunnels catch shakes full songs carefully each soaks damp rots faster badgers heap crumbs behind underground evenings early summer dark evening only count cases doors beneath wobble often backs roll hardly mop fuzzy wrestle branches tries flip falls unhurt males need fight slip underneath gentle hands fans buried own hole seven someone spend begins brothers sisters golden moths fold walk trunk arrows break softer flint can't sniff falling creeping line answer spreading above crumbling counts story note heard lovely longer looking races moment parade love soaking lower pressing walls amazing happening shell were whirrrr warming plan ahead free lot leave alone either swoops far skip bounced times yourself mmm mops turns running sip smelled rival wrestling block hook shove closes guard trick whoops getting creep looks spotted foot shoos never even noticed moving tonight place seen bikes set safely rear curious sniffing bored wandered end fence smells paint rot somewhere else smelly deeper root needs yet generation"
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
  beetle: 'beetle', beetles: 'beetle', stag: 'beetle', grub: 'grub', grubs: 'grub', larva: 'grub',
  egg: 'egg', eggs: 'egg', pupa: 'pupa', cocoon: 'room', antler: 'antler', antlers: 'antler', jaws: 'antler',
  stump: 'wood', log: 'pile', logs: 'pile', wood: 'wood', dirt: 'dirt', soil: 'dirt', room: 'room',
  sap: 'sap', tree: 'tree', trees: 'tree', oak: 'tree', branch: 'branch', leaf: 'leaf', leaves: 'leaf',
  stone: 'stone', stones: 'stone', wings: 'wings', wing: 'wings', fungus: 'fungus',
  moon: 'moon', sun: 'sun', rain: 'rain', water: 'rain', snow: 'rain', mole: 'mole', badger: 'badger', magpie: 'magpie', cat: 'cat', fox: 'fox', bat: 'bat', moth: 'moth', lamp: 'lamp', bike: 'bike', child: 'kid', girl: 'kid', boy: 'kid'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:   { A: 'eat',  B: 'eat',     C: 'eat it',        D: 'eat the sap',       E: 'Eat the sweet sap.' },
  push:  { A: 'push', B: 'push',    C: 'push him',      D: 'push the beetle',   E: 'Push him away!' },
  sneak: { A: 'go',   B: 'sneak',   C: 'sneak by',      D: 'sneak under them',  E: 'Sneak under the branch.' },
  fly:   { A: 'fly',  B: 'fly',     C: 'fly up',        D: 'open my wings',     E: 'Open my wings and fly.' },
  sing:  { A: 'sing', B: 'sing',    C: 'sing a song',   D: 'rub my legs',       E: 'Rub my legs and sing.' },
  build: { A: 'dig',  B: 'dig',     C: 'make a room',   D: 'make my room',      E: 'Make a smooth room.' },
  hi:    { A: 'hi',   B: 'say hi',  C: 'go and say hi', D: 'say hi to them',    E: 'Go and say hello.' },
  bite:  { A: 'eat',  B: 'bite',    C: 'bite it',       D: 'bite the bark',     E: 'Bite through the bark.' },
  sniff: { A: 'look', B: 'smell',   C: 'smell it',      D: 'smell the wood',    E: 'Smell if it is good.' },
  rear:  { A: 'up',   B: 'look big', C: 'look big',     D: 'stand up tall',     E: 'Stand up and look huge.' },
  dig:   { A: 'dig',  B: 'dig',     C: 'dig down',      D: 'dig down deep',     E: 'Dig down to the wood.' },
  lay:   { A: 'lay',  B: 'lay',     C: 'lay an egg',    D: 'lay an egg here',   E: 'Lay an egg here.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'sap', push: 'rival', sneak: 'beetle', fly: 'wings', sing: 'grub', build: 'room', hi: 'female', bite: 'sap', sniff: 'wood', rear: 'antler', dig: 'dirt', lay: 'egg' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the beetle's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'An egg by the stump', pic: 'egg', gate: false,
    A: ['I am an egg.', 'I see the stump.', 'I sleep.'],
    B: ['I am a little egg.', 'I am by a big stump.', 'I will hatch!'],
    C: ['I am a little white egg.', 'My mom put me by the old stump.', 'Soon I will hatch.'],
    D: ['My mom dug down deep to lay me here.', 'I am a tiny egg by a rotting stump.', 'Soon I will hatch.'],
    E: ['A mother beetle dug down beside this old oak stump.', 'She laid me here, a small white egg.', 'Inside me, a tiny grub is growing.'],
    yesno: [['Am I by a stump?', true], ['Am I a big beetle?', false]] },
  hatch: { title: 'Out of the egg', pic: 'grub', gate: true,
    A: ['I see a grub.', 'I am a grub!', 'I can eat.'],
    B: ['Look! I am out of my egg.', 'I am a little grub.', 'I want to eat.'],
    C: ['I wiggle out of my egg.', 'Now I am a little grub.', 'I have six legs and big jaws.'],
    D: ['I hatch out of my egg.', 'I am a tiny white grub with a brown head.', 'I am very hungry, so I eat the soft wood.'],
    E: ['I chew my way out of the egg.', 'I am a grub: soft and white, with a hard brown head.', 'I curl up like the letter C.'],
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
    B: ['I am so big!', 'I wiggle out again.', 'I am a giant grub.'],
    C: ['I am so big now!', 'My skin is tight again.', 'I wiggle out. Now I am a giant grub!'],
    D: ['My skin is too tight again.', 'This is the last time I will get out of it.', 'Now I am a giant grub.'],
    E: ['This is my third skin, and my last as a grub.', 'I am as long as a finger now.', 'The more I eat, the bigger my jaws will be.'],
    yesno: [['Am I a giant grub?', true], ['Do I have wings?', false]] },
  sing: { title: 'I can sing', pic: 'grub', gate: false,
    A: ['I can sing.', 'I sing to a grub.'],
    B: ['I rub my legs.', 'I can sing!', 'A grub sings to me.'],
    C: ['I rub my legs to sing.', 'Who is there?', 'Another grub sings back!'],
    D: ['I rub my back legs to make a little song.', 'Another grub hears me.', 'It sings back through the wood.'],
    E: ['Grubs rub their legs together to make a creaking song.', 'Scientists think it may tell other grubs where we are.'],
    yesno: [['Can a grub sing?', true], ['Does a grub sing with a mouth?', false]] },
  fungus: { title: 'White threads', pic: 'fungus', gate: false,
    A: ['I see fungus.', 'I eat it!'],
    B: ['Look at the white wood!', 'It is good to eat.'],
    C: ['White threads go through the wood.', 'It is fungus.', 'It makes the wood soft.'],
    D: ['White threads of fungus spread through the stump.', 'They make the hard wood soft.'],
    E: ['Fungus threads spread slowly through dead wood.', 'They soften it, so a grub can chew it.'],
    yesno: [['Is fungus white?', true], ['Does fungus make wood hard?', false]] },
  winter: { title: 'Below the frost', pic: 'moon', gate: false,
    A: ['It is cold.', 'I go down.', 'I sleep.'],
    B: ['It is cold up here.', 'I go down, down, down.', 'I sleep.'],
    C: ['Winter is here.', 'It is too cold at the top.', 'I go down deep and rest.'],
    D: ['In winter the top of the ground gets cold and hard.', 'I go down deep, where it stays safe.'],
    E: ['Frost creeps down into the ground in winter.', 'Grubs sleep below it, until spring comes again.'],
    yesno: [['Is it cold at the top?', true], ['Do I go up in winter?', false]] },
  mole: { title: 'The mole', pic: 'mole', gate: false,
    A: ['I see a mole.', 'It can dig.'],
    B: ['Look! A big mole.', 'It digs and digs.', 'I go down.'],
    C: ['A mole digs by me.', 'I stay in the hard wood.', 'It went away.'],
    D: ['A mole is digging a long tunnel.', 'I keep very still until it has gone.'],
    E: ['Moles dig long tunnels to catch worms.', 'The ground shakes when one goes by.'],
    yesno: [['Can a mole dig?', true], ['Does a mole fly?', false]] },
  song: { title: 'The grub choir', pic: 'grub', gate: false,
    A: ['We can sing.', 'I can sing!'],
    B: ['The grubs sing to me.', 'I sing it back.'],
    C: ['The grubs sing a song.', 'I listen.', 'Then I sing it back.'],
    D: ['All the grubs in the stump are singing.', 'I listen, and then I sing it back.'],
    E: ['The stump is full of little creaking songs.', 'I listen carefully and sing each one back.'],
    yesno: [['Do grubs sing?', true], ['Am I by myself?', false]] },
  rain: { title: 'The wet year', pic: 'rain', gate: false,
    A: ['I see the rain.', 'I go down.'],
    B: ['It is a wet, wet day.', 'I go down.'],
    C: ['So much rain!', 'The water comes down into the wood.', 'I go down.'],
    D: ['It rained and rained this year.', 'The wet wood gets soft fast.'],
    E: ['Rain soaks down through the old stump.', 'Damp wood is good for fungus, so the stump rots faster.'],
    yesno: [['Does rain make wood wet?', true], ['Is it a dry year?', false]] },
  badger: { title: 'The badger', pic: 'badger', gate: false,
    A: ['I see a badger.', 'It can dig.'],
    B: ['A big badger is up there!', 'I go down.'],
    C: ['A badger digs at the stump.', 'I go down deep.', 'It went away.'],
    D: ['A badger is digging at the top of the stump.', 'Its big claws shake the wood.'],
    E: ['Badgers have long, strong claws for digging.', 'This one leaves a heap of crumbs behind.'],
    yesno: [['Does a badger have claws?', true], ['Is a badger little?', false]] },
  chamber: { title: 'Time to go', pic: 'room', gate: false,
    A: ['I am big.', 'I dig.', 'I dig down.'],
    B: ['I am a big grub.', 'I go down, down, down.', 'I dig in the dirt.'],
    C: ['I can go now, or stay and eat.', 'If I eat, my jaws will grow.'],
    D: ['I am big enough now.', 'I can dig a room in the soil, or stay one more year.'],
    E: ['I could dig my cocoon now, or stay another year.', 'A bigger grub makes a bigger beetle.'],
    yesno: [['Can I stay and eat?', true], ['Will I stop eating now?', false]] },
  pupa: { title: 'As big as an orange', pic: 'pupa', gate: true,
    A: ['I am a pupa.', 'I sleep, sleep, sleep.'],
    B: ['I made a little room.', 'I am a pupa.', 'I sleep.'],
    C: ['I made a room in the dirt.', 'It is as big as an orange.', 'Now I am a pupa.'],
    D: ['I press the soil into a smooth, round room.', 'Inside, my body is changing.'],
    E: ['My cocoon is as big as an orange.', 'I look still, but inside I am changing into a beetle.'],
    yesno: [['Am I a pupa?', true], ['Am I flying?', false]] },
  emerge: { title: 'A beetle!', pic: 'beetle', gate: true,
    A: ['I am a beetle!', 'Look at me!'],
    B: ['I am not a grub!', 'I am a big beetle.', 'I have wings.'],
    C: ['I am a beetle now!', 'I am soft and white.', 'Soon I will be hard.'],
    D: ['I come out of the pupa, soft and pale.', 'I wait all winter under the ground.'],
    E: ['A new beetle stays underground all winter.', 'I wait for the warm evenings of early summer.'],
    yesno: [['Am I a beetle now?', true], ['Am I a grub now?', false]] },
  out: { title: 'A warm evening', pic: 'moon', gate: false,
    A: ['I go up, up, up.', 'I see the moon.'],
    B: ['I dig up and out.', 'It is a warm night.', 'I see the sky.'],
    C: ['I dig up, up, up.', 'It is warm now.', 'I can see the sky at last!'],
    D: ['After all those years, I push up through the soil.', 'The air is warm and I can see the sky.'],
    E: ['After years in the dark, I push out into a warm evening.', 'I have only one summer, so I must make it count.'],
    yesno: [['Is it warm?', true], ['Is it snowing?', false]] },
  fly: { title: 'Whirr!', pic: 'wings', gate: false,
    A: ['I can fly!', 'I fly up.'],
    B: ['My wings go up.', 'I fly!', 'I fly with a whirr.'],
    C: ['My hard wings go up.', 'My thin wings come out.', 'I fly over the garden!'],
    D: ['I must warm my wings before I can fly.', 'I am heavy, so I fly standing up.'],
    E: ['My hard wing cases open like doors.', 'The thin wings beneath them whirr, and I wobble into the air.'],
    yesno: [['Can a stag beetle fly?', true], ['Do I fly fast and well?', false]] },
  upside: { title: 'Upside down', pic: 'beetle', gate: false,
    A: ['I am down.', 'I can go up!'],
    B: ['Oops! I fell.', 'My legs are up.', 'I get up.'],
    C: ['Oops! I am on my back.', 'I wiggle and wiggle.', 'Now I am up.'],
    D: ['I landed on my back again.', 'I rock from side to side until I can get up.'],
    E: ['Big beetles often land on their backs.', 'I rock and kick until I roll over.'],
    yesno: [['Did I land on my back?', true], ['Did I get hurt?', false]] },
  sap: { title: 'Sweet sap', pic: 'sap', gate: false,
    A: ['I see sap.', 'I can eat it.'],
    B: ['Look at the sap!', 'It is good to eat.'],
    C: ['Sap comes out of the tree.', 'It is sweet.', 'My tongue is orange!'],
    D: ['I find the sweet sap and lick it up.', 'My orange tongue is like a little brush.'],
    E: ['Grown beetles hardly eat at all.', 'I mop up sweet sap with my fuzzy orange tongue.'],
    yesno: [['Is sap sweet?', true], ['Is my tongue green?', false]] },
  rival: { title: 'Another beetle', pic: 'rival', gate: false,
    A: ['I see a beetle.', 'I can push!', 'Push, push, push!'],
    B: ['Look at the big beetle!', 'He wants the sap.', 'I push him.'],
    C: ['Another beetle is on the branch.', 'He wants this sap too.', 'I will push him off.'],
    D: ['Another male comes along the branch.', 'We lock our jaws and push.'],
    E: ['Male stag beetles wrestle on branches.', 'Each one tries to lift the other and flip him off.'],
    yesno: [['Is he a beetle?', true], ['Are we friends?', false]] },
  won: { title: 'He flew away', pic: 'beetle', gate: false,
    A: ['I can lift!', 'He can fly.'],
    B: ['I lift him up!', 'He flies away.'],
    C: ['I lift him up and over.', 'He opens his wings and flies away.', 'He is fine.'],
    D: ['I get my jaws under him and lift.', 'Off he goes, and he is not hurt.'],
    E: ['My antlers are too big to bite, but they lift well.', 'He falls, opens his wings and flies away unhurt.'],
    yesno: [['Did he fly away?', true], ['Was he hurt?', false]] },
  sneak: { title: 'The sneaky way', pic: 'beetle', gate: false,
    A: ['I am little.', 'I can go!'],
    B: ['I am a little beetle.', 'They are big.', 'I go under.'],
    C: ['They are big, and I am not.', 'I go under the branch.', 'They do not see me.'],
    D: ['Two big beetles are busy pushing.', 'I am small, so I sneak under them.'],
    E: ['Small males do not need to fight.', 'While the big ones wrestle, I slip past underneath.'],
    yesno: [['Can a small beetle sneak?', true], ['Do they see me?', false]] },
  kid: { title: 'Gentle hands', pic: 'kid', gate: false,
    A: ['I see a girl.', 'I see a boy.', 'Look at me!'],
    B: ['Look! I see a big bike.', 'It is the child.', 'Up I go!'],
    C: ['I know this child.', 'I saw them play when I was a grub.', 'Now they lift me up.'],
    D: ['I was on the path and a bike was coming.', 'The child I knew has grown so tall.'],
    E: ['All those years, a child grew up over my head.', 'Now gentle hands lift me off the path on a leaf.'],
    yesno: [['Did the child help me?', true], ['Did the child hurt me?', false]] },
  bite: { title: 'Sharp little jaws', pic: 'female', gate: false,
    A: ['I am a beetle.', 'I can eat it.'],
    B: ['My jaws are little.', 'I bite and bite.', 'Here is the sap!'],
    C: ['My jaws are not big.', 'But they are strong.', 'I bite the bark and sap comes out.'],
    D: ['I bite through the bark with my small jaws.', 'Sweet sap runs out of the tree.'],
    E: ['A big male can not bite through bark.', 'My small, strong jaws can, and then the sap runs.'],
    yesno: [['Can I bite bark?', true], ['Are my jaws big?', false]] },
  smell: { title: 'The right wood', pic: 'wood', gate: false,
    A: ['I can look.', 'I see wood.'],
    B: ['I smell, smell, smell.', 'I want old wood.'],
    C: ['I smell with my feelers.', 'I want old, soft wood.', 'It is a home for eggs.'],
    D: ['My feelers smell the air.', 'New wood is no good. Old wood is just right.'],
    E: ['The fans on my feelers can smell rotting wood.', 'My eggs need old, soft, damp oak.'],
    yesno: [['Do I want old wood?', true], ['Do I want new wood?', false]] },
  dig: { title: 'Down, down, down', pic: 'dirt', gate: false,
    A: ['I can dig.', 'I dig down.'],
    B: ['I dig and dig.', 'I go down, down, down.'],
    C: ['My legs are good for digging.', 'I go down to the old wood.'],
    D: ['I dig down deep with my spiky legs.', 'My eggs must be right by the old wood.'],
    E: ['I dig down beside the buried wood.', 'Each egg goes in the soil by the old wood.'],
    yesno: [['Do I dig down?', true], ['Do I dig with my wings?', false]] },
  champion: { title: 'King of the oak', pic: 'antler', gate: false,
    A: ['I am big.', 'I can lift!'],
    B: ['I did it!', 'I am the best.'],
    C: ['I did it!', 'I am the king of the old oak.'],
    D: ['No beetle on the branch can push me now.', 'This is the best night of my life.'],
    E: ['Seven years in the dark, for this one summer.', 'Now someone is coming along the branch.'],
    yesno: [['Did I do it?', true], ['Am I a grub?', false]] },
  eggs: { title: 'New eggs', pic: 'egg', gate: true,
    A: ['I see eggs.', 'I see a grub!'],
    B: ['Look! Little eggs.', 'New grubs will come.'],
    C: ['The eggs are by the old wood.', 'New grubs will hatch.', 'It all starts again.'],
    D: ['The eggs lie safe beside the old wood.', 'Soon new grubs will hatch and start to eat.'],
    E: ['One summer is over, and the eggs are safe under the logs.', 'A new grub will spend its years here, and it all begins again.'],
    yesno: [['Will new grubs hatch?', true], ['Will the eggs fly?', false]] }
};
const STORY_TRIGGERS = { started: 'egg', answered: 'sing', ateFungus: 'fungus', firstWinter: 'winter', moleCame: 'mole', songStart: 'song', rainCame: 'rain', badgerCame: 'badger', fullGrown: 'chamber', surfaced: 'out', firstFlight: 'fly', flipped: 'upside', ateSap: 'sap', rivalSeen: 'rival', ringOver: 'won', sneakStart: 'sneak', kidStopped: 'kid', biteStart: 'bite', smellNight: 'smell', digDown: 'dig', champion: 'champion' };

/* ---------- read-and-do missions ----------
   who: grub · beetle (on foot) · flying.  from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'fungus', who: 'grub', A: 'Eat the white wood.', B: 'Find the white wood.', C: 'Find wood with fungus in it.', D: 'Find some white fungus and eat it.', E: 'Find the white fungus threads and eat them.' },
  { key: 'bottom', who: 'grub', A: 'Go down, down!', B: 'Go down to the bottom.', C: 'Go to the bottom of the stump.', D: 'Go down to the bottom of the stump.', E: 'Chew your way to the bottom of the stump.' },
  { key: 'top', who: 'grub', A: 'Go up, up!', B: 'Go up to the top.', C: 'Go up to the top of the stump.', D: 'Climb up to the top of the stump.', E: 'Chew your way up to the top of the stump.' },
  { key: 'friend', who: 'grub', A: 'Go to a grub.', B: 'Find a grub friend.', C: 'Find another grub.', D: 'Find another grub in the wood.', E: 'Find one of your brothers or sisters.' },
  { key: 'eat', who: 'grub', A: 'Eat, eat, eat!', B: 'Eat lots of wood.', C: 'Eat lots and lots of wood.', D: 'Eat lots of wood and grow.', E: 'Eat lots of wood to grow bigger jaws.' },
  { key: 'sing', who: 'grub', A: 'Sing to a grub.', B: 'Sing a song.', C: 'Sing to the other grubs.', D: 'Rub your legs and sing.', E: 'Rub your legs together and sing.' },
  { key: 'puff', who: 'flying', A: 'Fly to the sap.', B: 'Fly to a gold puff.', C: 'Fly to a gold puff.', D: 'Fly through a gold puff.', E: 'Fly through one of the golden puffs.' },
  { key: 'lamp', who: 'flying', from: 'C', A: 'Go to the lamp.', B: 'Fly to the lamp.', C: 'Fly to the lamp.', D: 'Fly over to the street lamp.', E: 'Fly close to the moths at the street lamp.' },
  { key: 'high', who: 'flying', A: 'Go up, up!', B: 'Fly up, up, up!', C: 'Fly up high.', D: 'Fly up as high as you can.', E: 'Hold on and fly up very high.' },
  { key: 'ground', who: 'flying', A: 'Go down.', B: 'Go down to the ground.', C: 'Land on the ground.', D: 'Land down on the ground.', E: 'Fold your wings and land on the ground.' },
  { key: 'tree', who: 'beetle', A: 'Go to the tree.', B: 'Go up the tree.', C: 'Climb up a tree.', D: 'Climb up a big tree.', E: 'Walk to a tree and climb up the trunk.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const HINT_A = { egg: 'I am an egg.', hatch: 'Go, go, go!', eat: 'Eat the wood!', fungus: 'Eat the white wood!', hard: 'No! Go down.', rock: 'No! Go down.', outside: 'No! Go down.', soil: 'Go up! Eat wood!', tight: 'Look at me!', bigger: 'Eat!', sniff: 'Go to the wood!', frost: 'It is cold! Go down.', sleep: 'I sleep.', year_neighbour: 'I can sing!', year_fungus: 'Eat the white wood!', year_mole: 'I see a mole!', year_song: 'I can sing!', year_rain: 'I see the rain! Go down.', year_badger: 'I see a badger! Go down.', year_feast: 'Eat, eat, eat!', mole: 'I see a mole!', badgerdig: 'I see a badger!', build: 'Dig!', pupa: 'I am a pupa.', digup: 'Go up!', flynow: 'Fly!', flying: 'Fly up!', bonk: 'Look at me!', flipped: 'Go up!', onbranch: 'Eat the sap!', sapyum: 'I like sap!', rival: 'A beetle! Push!', ring: 'Push!', won: 'I can lift!', sneak: 'Go!', sneakstop: 'No! Sit.', kid: 'Look!', magpie: 'I see a magpie!', cat: 'I see a cat!', fox: 'I see a fox!', bat: 'I see a bat!', eggs: 'I see eggs!', digdown: 'Dig down!', layone: 'I see an egg!' };
const READ_HINTS = Object.fromEntries(Object.keys(HINTS).map(k => [k, { A: HINT_A[k] || 'Look!', B: HINTS[k][1], C: HINTS[k][1], D: HINTS[k][1], E: HINTS[k][0] }]));
