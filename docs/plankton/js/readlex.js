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
/* words only Plankton needs, added to a level on purpose (every text below was checked against them) */
const LEVEL_EXTRA = {
  A: 'mum out swim jump blue big hi green glow hide',
  B: 'lets her float pop hatch yet yolk bigger now long body day away dots lights its mouth open fill falls wake winter girl was smell follow boy find say spring lay lots top times bump dot dark wait wiggle good got whoosh ok gone glows full ready done rest back',
  C: 'tiny let live moult yum rocks tight smaller more wings legs comes rainbow eats things so does shine rock swims as bus wide just again stage five sac fills sand tree bits fall hot last grown left feet leave follows fly each soon meet feast starts ten your make bright safe did keep way pink found them when job turn',
  D: 'than grain pairs through stages glass houses stretch old six move morning school light once flash comb drifts shining sting but drifters basking second biggest world opens huge right giant teeth store inside food sink months going year round leaves scent smells longer turns dozens drift glowing something wiggles dim jumped tumbled swam bumped flashed ring goes',
  E: 'mother or hatches swimmer tell hatched third sweep plants cases wears skeleton outside climbs moults eleven life change hairy evening daily journey earth sweeps coming their own bumps called bioluminescence eight rows beating hairs animals slowly straining sharks visit gulf maine summer rarest whales strained baleen stores fat much fuel ahead hardly moving diapause marine droppings sinking looks snowstorm sleeping eleventh become ups towards many his zig zag finds babies cycle hello sky practise escape drifting arrows missed sparkles clutch falling swimming'
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
  copepod: 'copepod', copepods: 'copepod', copepodite: 'copepodite', egg: 'egg', eggs: 'eggs', nauplius: 'nauplius', nauplii: 'nauplius',
  sea: 'sea', ocean: 'sea', water: 'water', plankton: 'plankton', diatom: 'diatom', diatoms: 'diatom', chain: 'chain', dinoflagellate: 'dino',
  jelly: 'combjelly', shark: 'basking', whale: 'whale', fish: 'herring', herring: 'herring', moon: 'moon', sun: 'sun', snow: 'snow', deep: 'deep',
  oil: 'oil', eye: 'eye', tail: 'tail', feelers: 'feelers', trail: 'trail', skin: 'skin', bloom: 'bloom', mud: 'mud'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  moult: { A: 'out',   B: 'get out',     C: 'get out of my skin',  D: 'climb out of my old skin', E: 'Climb out of my old skin and moult.' },
  sleep: { A: 'sleep', B: 'go to sleep', C: 'sleep in the deep',   D: 'sleep here in the deep',   E: 'Sleep in the deep until winter.' },
  meet:  { A: 'hi',    B: 'say hi',      C: 'go and say hi',       D: 'say hi to the copepod',    E: 'Go and say hello.' },
  lay:   { A: 'eggs',  B: 'lay eggs',    C: 'lay my eggs',         D: 'let my eggs go',           E: 'Let my eggs go into the sea.' }
};
/* the picture on each action card */
const ACTION_PIC = { moult: 'skin', sleep: 'sleep', meet: 'copepod', lay: 'eggs' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the copepod's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'A tiny egg', pic: 'egg', gate: false,
    A: ['I am an egg.', 'I am in the sea.', 'I see my mum.'],
    B: ['I am a little egg.', 'Mum lets her eggs go.', 'We float in the sea.'],
    C: ['I am a tiny egg.', 'My mum let lots of eggs go into the sea.', 'Now I float in the green water.'],
    D: ['My mum let her eggs go into the sea.', 'I am smaller than a grain of sand.', 'Soon I will hatch.'],
    E: ['A copepod mother does not keep her eggs.', 'She lets dozens of them go into the sea at night.', 'Each egg is smaller than a grain of sand.'],
    yesno: [['Am I an egg?', true], ['Am I a big fish?', false]] },
  hatch: { title: 'Hatch!', pic: 'nauplius', gate: true,
    A: ['I am out!', 'I can swim.'],
    B: ['Pop! I hatch out.', 'I am a nauplius.', 'I have one red eye.'],
    C: ['I wiggle and wiggle.', 'Pop! I hatch out of my egg.', 'Now I am a nauplius with one red eye.'],
    D: ['I hatch out of my egg.', 'I am a nauplius, with three pairs of legs and one red eye.', 'I hop through the water.'],
    E: ['After a day or two the egg hatches.', 'Out comes a nauplius: a tiny round swimmer with three pairs of legs.', 'Its one red eye can tell light from dark.'],
    yesno: [['Do I have one red eye?', true], ['Am I a big whale?', false]] },
  yolk: { title: 'Not yet!', pic: 'nauplius', gate: false,
    A: ['I swim, swim, swim.', 'I can swim!'],
    B: ['I can not eat yet.', 'I have my yolk.', 'I swim and swim.'],
    C: ['I can not eat yet.', 'I live on my yolk.', 'I swim and grow.'],
    D: ['The first two nauplius stages do not eat.', 'I live on the yolk from my egg.'],
    E: ['The first two nauplius stages of a copepod do not eat at all.', 'They live on the yolk they hatched with.'],
    yesno: [['Can I eat yet?', false], ['Do I have yolk?', true]] },
  feed: { title: 'Now I can eat!', pic: 'diatom', gate: true,
    A: ['I can eat!', 'I eat, eat, eat.'],
    B: ['I am bigger now.', 'I can eat!', 'I eat the green diatoms.'],
    C: ['I moult and get bigger.', 'Now I can eat!', 'I eat the green diatoms. Yum!'],
    D: ['My yolk is gone, so now I must eat.', 'I eat tiny green diatoms.', 'They live in little glass houses.'],
    E: ['From the third nauplius stage on, I can eat.', 'I sweep tiny diatoms into my mouth.', 'Diatoms are plants in little glass cases.'],
    yesno: [['Do I eat diatoms?', true], ['Do I eat rocks?', false]] },
  moult: { title: 'Out of my skin', pic: 'skin', gate: false,
    A: ['I am out!', 'Look at me!'],
    B: ['My skin is too little.', 'I get out of it!'],
    C: ['My skin is too tight.', 'I wiggle out of it.', 'Now I am big!'],
    D: ['My skin can not stretch, so I must moult.', 'I climb out of my old skin and I am bigger.'],
    E: ['A copepod wears its skeleton on the outside.', 'To grow, it climbs out of the old one.', 'A copepod moults eleven times in its life.'],
    yesno: [['Do I get out of my skin?', true], ['Do I get smaller?', false]] },
  copepodite: { title: 'A copepod at last', pic: 'copepodite', gate: true,
    A: ['Look at me!', 'Look at my tail!'],
    B: ['Look at me now!', 'I have a long body.', 'I have a tail!'],
    C: ['I moult one more time.', 'Now I look like a copepod!', 'I have a long body, a tail and long feelers.'],
    D: ['After six nauplius stages, I moult into a copepodite.', 'Now I have a long body and a tail.', 'My long feelers can feel the water move.'],
    E: ['The copepodite is a big change.', 'It has a long body, a tail and long hairy feelers.', 'There are five copepodite stages before it is grown up.'],
    yesno: [['Do I have a tail?', true], ['Do I have wings?', false]] },
  updown: { title: 'Up and down', pic: 'deep', gate: false,
    A: ['I go up.', 'I go down.'],
    B: ['At night I swim up.', 'In the day I go down.'],
    C: ['At night I swim up to eat.', 'In the day I swim down to the dark.', 'The fish can not see me there.'],
    D: ['Every night I swim up to the top to eat.', 'Every morning I swim down into the dark.', 'Fish can not see me in the dark.'],
    E: ['Every evening copepods swim up to the top to eat.', 'Every morning they swim back down into the dark, where fish can not see them.', 'It is the biggest daily journey on Earth.'],
    yesno: [['Do I go down in the day?', true], ['Do I go down at night?', false]] },
  herring: { title: 'Herring!', pic: 'herring', gate: false,
    A: ['I see fish!', 'Jump, jump, jump!'],
    B: ['Look at all the fish!', 'I jump away fast!'],
    C: ['Lots of herring swim by.', 'They look for plankton.', 'I kick my legs and jump away!'],
    D: ['A school of herring comes by in the light.', 'I kick all my legs at once and jump away.'],
    E: ['A shining school of herring sweeps through the light.', 'I feel them coming with my feelers, and I kick all my legs to jump away.'],
    yesno: [['Do I jump away?', true], ['Am I a fish?', false]] },
  glow: { title: 'The glowing sea', pic: 'dino', gate: false,
    A: ['I see it!', 'It is blue!'],
    B: ['It is night.', 'Look! Blue dots!', 'They glow.'],
    C: ['It is night in the sea.', 'I bump some plankton and it glows blue!'],
    D: ['At night, some tiny plankton flash blue.', 'They light up when I bump them.'],
    E: ['Some plankton make their own light.', 'When something bumps them, they flash bright blue.', 'This is called bioluminescence.'],
    yesno: [['Do some plankton glow?', true], ['Is the glow red?', false]] },
  combjelly: { title: 'The comb jelly', pic: 'combjelly', gate: false,
    A: ['I see a jelly.', 'No, no, no!'],
    B: ['Look at the jelly!', 'It has lights.', 'I swim away!'],
    C: ['A jelly comes by.', 'It glows like a rainbow.', 'It eats little things, so I swim away.'],
    D: ['A comb jelly drifts by, shining like a rainbow.', 'It has no sting, but it eats tiny drifters.', 'I keep away from it.'],
    E: ['A comb jelly has eight rows of beating hairs that shine like a rainbow.', 'It can not sting, but it eats tiny animals in the plankton.', 'I keep well away.'],
    yesno: [['Does the jelly shine?', true], ['Is the jelly a rock?', false]] },
  basking: { title: 'The basking shark', pic: 'basking', gate: false,
    A: ['I see a shark!', 'It is big!'],
    B: ['Look! A big, big shark!', 'Its mouth is open.', 'I swim away!'],
    C: ['A big shark swims by.', 'It is as big as a bus!', 'It eats plankton.'],
    D: ['The basking shark is the second biggest fish in the world.', 'It opens its huge mouth to eat plankton.', 'I swim away from its mouth.'],
    E: ['The basking shark is as long as a bus, but it has no big teeth.', 'It swims slowly with its mouth open, straining plankton from the sea.', 'Basking sharks visit the Gulf of Maine in summer.'],
    yesno: [['Is the shark big?', true], ['Does it eat rocks?', false]] },
  whale: { title: 'The right whale', pic: 'whale', gate: false,
    A: ['I see a whale!', 'It is big!'],
    B: ['Look! A big, big whale!', 'Its mouth is open.', 'I jump away!'],
    C: ['A big whale swims by.', 'Its mouth is open wide.', 'I jump away just in time!'],
    D: ['A right whale swims through the copepods with its mouth open.', 'It has a giant comb in its mouth, not teeth.', 'I kick and jump away.'],
    E: ['The right whale is one of the rarest whales on Earth.', 'Its food is copepods, strained through its baleen.', 'I jump out of the way just in time.'],
    yesno: [['Is the whale big?', true], ['Is the whale tiny?', false]] },
  stage5: { title: 'Full of oil', pic: 'oil', gate: true,
    A: ['I eat, eat, eat.', 'I am big!'],
    B: ['I am big now.', 'I eat and eat.', 'I fill up with oil.'],
    C: ['I moult again. I am stage five.', 'I eat lots and lots.', 'My oil sac fills up.'],
    D: ['Now I am stage five.', 'I eat and store oil in a long sac inside me.', 'The oil is food for a long sleep.'],
    E: ['A stage five copepod stores fat in a long oil sac.', 'When it is full, the oil fills much of its body.', 'It is fuel for the long sleep ahead.'],
    yesno: [['Do I fill up with oil?', true], ['Do I fill up with sand?', false]] },
  sleep: { title: 'The long sleep', pic: 'sleep', gate: true,
    A: ['I go down.', 'I sleep.'],
    B: ['I go down, down, down.', 'I sleep in the deep.'],
    C: ['I swim down to the deep.', 'It is cold and dark.', 'I sleep and sleep.'],
    D: ['I sink down to the deep, dark water.', 'I will sleep there for months.', 'My oil keeps me going.'],
    E: ['In summer the fat copepods sink into the deep.', 'They rest for months, hardly moving, until winter.', 'This long rest is called diapause.'],
    yesno: [['Do I sleep in the deep?', true], ['Do I sleep in a tree?', false]] },
  snow: { title: 'Snow in the sea', pic: 'snow', gate: false,
    A: ['I see snow!', 'It is in the sea.'],
    B: ['Look! Snow in the sea!', 'It falls down, down.'],
    C: ['Little bits fall down like snow.', 'It is snow in the sea!'],
    D: ['Bits of old plankton sink down like snow.', 'It falls all year round.'],
    E: ['Marine snow is bits of old plankton and droppings sinking slowly down.', 'In the deep it looks like a snowstorm.'],
    yesno: [['Is there snow in the sea?', true], ['Is the snow hot?', false]] },
  adult: { title: 'Grown up!', pic: 'adult', gate: true,
    A: ['I am big!', 'Look at me!'],
    B: ['Wake up! It is winter.', 'I get out of my skin.', 'I am big now!'],
    C: ['It is winter. I wake up.', 'I moult one last time.', 'Now I am a grown copepod!'],
    D: ['In winter I wake up in the deep.', 'I moult for the last time.', 'Now I am grown up.'],
    E: ['In winter the sleeping copepods wake up.', 'They moult for the eleventh time and become grown-ups.', 'Then they swim back up towards the light.'],
    yesno: [['Am I grown up?', true], ['Am I an egg?', false]] },
  trail: { title: 'A scent trail', pic: 'trail', gate: false,
    A: ['I see a trail.', 'I go, go, go!'],
    B: ['A girl was here.', 'I can smell her trail.', 'I follow it!'],
    C: ['I smell a trail in the water.', 'A girl left it.', 'I follow it to find her.'],
    D: ['A girl copepod leaves a trail of scent as she swims.', 'I smell it with my feelers and follow it.'],
    E: ['In many copepods a girl leaves a scent trail in the water.', 'A boy smells it with his feelers and follows it, zig-zag, to find her.'],
    yesno: [['Do I follow the trail?', true], ['Do I see with my feet?', false]] },
  wait: { title: 'He is coming', pic: 'trail', gate: false,
    A: ['I swim.', 'I see a copepod!'],
    B: ['I swim and swim.', 'A boy can smell my trail.', 'He will find me.'],
    C: ['I leave a trail as I swim.', 'A boy can smell it.', 'He follows it to find me.'],
    D: ['As I swim, I leave a trail of scent.', 'A boy smells it and comes to find me.'],
    E: ['A girl copepod leaves a scent trail as she swims.', 'A boy follows it, zig-zag, until he finds her.'],
    yesno: [['Will a boy find me?', true], ['Do I fly away?', false]] },
  met: { title: 'Hello!', pic: 'copepod', gate: false,
    A: ['I see a copepod.', 'Hi!'],
    B: ['I find a copepod.', 'We say hi.'],
    C: ['At last we find each other.', 'We say hi.', 'Soon there will be eggs.'],
    D: ['At last we find each other in the dark.', 'Soon there will be eggs in the sea.'],
    E: ['The two copepods meet in the deep water.', 'Soon the girl will lay her eggs into the spring bloom.'],
    yesno: [['Do we meet?', true], ['Do we go to sleep?', false]] },
  bloom: { title: 'The spring bloom', pic: 'bloom', gate: false,
    A: ['The sea is green!', 'I eat, eat, eat.'],
    B: ['It is spring!', 'The sea is green with diatoms.'],
    C: ['It is spring again.', 'The sea is green with diatoms.', 'It is a feast for all the copepods!'],
    D: ['Every spring the days get longer.', 'The sea turns green with a big bloom of diatoms.', 'It is a feast for the copepods.'],
    E: ['When the days get longer in spring, the sea turns green with diatoms.', 'This is the spring bloom, a feast for copepods and their babies.'],
    yesno: [['Is the sea green?', true], ['Is it winter?', false]] },
  eggs: { title: 'Eggs again!', pic: 'eggs', gate: true,
    A: ['Eggs!', 'Go, go, go!'],
    B: ['Look at the eggs!', 'They float in the sea.'],
    C: ['Lots of eggs float in the sea.', 'Soon they will hatch.', 'It all starts again!'],
    D: ['Dozens of eggs drift in the green sea.', 'Soon each one will hatch into a nauplius.', 'It all starts again.'],
    E: ['A mother copepod lets dozens of eggs go each night.', 'They drift in the spring bloom and hatch into nauplii.', 'The life cycle starts again.'],
    yesno: [['Are there eggs?', true], ['Do the eggs fly?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', yolkBump: 'yolk', molted: 'moult', exposed: 'updown', herring: 'herring', glow: 'glow', combJelly: 'combjelly', basking: 'basking', whale: 'whale', sleepStart: 'snow', girlTrail: 'trail', boyComing: 'wait', met: 'met', bloomTime: 'bloom' };

/* ---------- read-and-do missions ----------
   who: swim (any swimmer) · eater (can eat now) · night · day (a copepodite by day) · trail (a boy on a trail)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'eat', who: 'eater', A: 'Eat, eat, eat!', B: 'Eat lots of green diatoms.', C: 'Eat ten green diatoms.', D: 'Eat ten tiny green diatoms.', E: 'Swim around and eat ten diatoms.' },
  { key: 'chain', who: 'eater', from: 'B', A: 'Eat a chain!', B: 'Eat a diatom chain.', C: 'Find a chain of diatoms and eat it.', D: 'Find a long chain of diatoms and eat it.', E: 'Find a chain of diatoms and eat it up.' },
  { key: 'deep', who: 'swim', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark.' },
  { key: 'top', who: 'swim', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'jump', who: 'swim', A: 'Jump, jump, jump!', B: 'Jump three times.', C: 'Kick your legs and jump three times.', D: 'Kick all your legs and jump three times.', E: 'Practise your escape: jump three times.' },
  { key: 'glow', who: 'night', A: 'It can glow!', B: 'Bump a blue dot.', C: 'Bump a dot and make it glow.', D: 'Find a glowing dot and bump it.', E: 'Bump a dinoflagellate at night and make it glow.' },
  { key: 'hide', who: 'day', A: 'Go down!', B: 'Hide in the dark.', C: 'Swim down to hide in the dark.', D: 'Swim down where the fish can not see you.', E: 'Swim down into the dim water where fish can not see you.' },
  { key: 'trail', who: 'trail', A: 'Go, go, go!', B: 'Follow the trail!', C: 'Follow the trail to find her.', D: 'Follow her scent trail and find her.', E: 'Follow her scent trail, zig-zag, and find her.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am a tiny egg in the sea.', D: 'I am an egg. Soon I will hatch.', E: 'I am a tiny egg, drifting in the spring sea.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle! Hatch out!', C: 'Wiggle and hatch out!', D: 'Something wiggles inside. Hatch out!', E: 'Push the arrows to wiggle and hatch.' },
  yolk: { A: 'Swim!', B: 'Swim! I have my yolk.', C: 'Swim! I live on my yolk.', D: 'Swim about. I live on my yolk for now.', E: 'Swim about. I live on my yolk for now.' },
  tight: { A: 'Look at me!', B: 'My skin is too little!', C: 'My skin is tight!', D: 'My skin is too tight! Moult!', E: 'My skin is too tight. Time to moult!' },
  bigger: { A: 'I am big!', B: 'I am bigger!', C: 'I got out. I am bigger!', D: 'Out of my old skin, and bigger!', E: 'Out of my old skin, and bigger!' },
  eat: { A: 'Eat!', B: 'I can eat! Eat the green dots.', C: 'Now I can eat the green diatoms.', D: 'Now I can eat. Bump into the diatoms.', E: 'Now I can eat. Bump into the green diatoms.' },
  more: { A: 'Eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more diatoms to grow.', E: 'Eat more diatoms to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Swim up and eat.', D: 'Night! Swim up to the top to eat.', E: 'Night! The fish can not see. Swim up to eat.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Swim down to the dark.', D: 'Morning! Swim down into the dark.', E: 'Morning! Swim down where fish can not see me.' },
  seen: { A: 'Go down!', B: 'Go down! Fish can see me!', C: 'Too bright! Swim down.', D: 'Too bright up here! Swim down.', E: 'Too bright up here! Fish can see me. Swim down.' },
  hidden: { A: 'Yes!', B: 'I hide. Good!', C: 'I am safe down here.', D: 'I am safe in the dim water.', E: 'I am safe in the dim water.' },
  daywait: { A: 'I hide.', B: 'I hide and wait.', C: 'I wait here for night.', D: 'I wait in the dark for night.', E: 'I wait in the dark until night comes.' },
  herring: { A: 'Fish! Jump!', B: 'Fish! Jump away!', C: 'Fish! Kick and jump away.', D: 'Herring! Kick my legs and jump!', E: 'Herring are coming! Kick my legs and jump away!' },
  dodged: { A: 'I am up!', B: 'Jump! I got away!', C: 'Jump! It did not get me.', D: 'Kick! I jumped away in time.', E: 'Kick! I jumped away, and it missed me.' },
  missed: { A: 'I am up!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  jump: { A: 'Jump!', B: 'Jump, jump!', C: 'Kick my legs to jump.', D: 'Kick all my legs to jump.', E: 'Kick all my legs at once to jump.' },
  jelly: { A: 'A jelly! Go!', B: 'A jelly! Swim away!', C: 'A jelly! Keep away from it.', D: 'A comb jelly! Keep away from it.', E: 'A comb jelly! Keep well away from it.' },
  basking: { A: 'A shark! Go, go!', B: 'A big shark! Swim away!', C: 'A big shark! Swim away from it.', D: 'A basking shark! Swim away from its mouth.', E: 'A basking shark is eating plankton! Swim away from its mouth.' },
  whale: { A: 'A whale! Jump!', B: 'A big whale! Jump away!', C: 'A whale! Jump out of the way!', D: 'A right whale! Kick and jump away!', E: 'A right whale with its mouth open! Jump out of the way!' },
  whalemiss: { A: 'I am up!', B: 'The whale is gone!', C: 'The whale went by. I am OK!', D: 'The whale swam by. I jumped in time!', E: 'The whale swam by. I jumped out just in time!' },
  glow: { A: 'It is blue!', B: 'Look! It glows!', C: 'I bump it and it glows blue!', D: 'I bumped a dot and it flashed blue!', E: 'I bumped a dinoflagellate and it flashed blue!' },
  copepodite: { A: 'Look at me!', B: 'I have a tail!', C: 'I look like a copepod now!', D: 'Now I have a long body and a tail!', E: 'I look like a copepod now: a long body and a tail!' },
  oil: { A: 'Eat, eat!', B: 'Eat and fill up!', C: 'Eat lots to fill my oil sac.', D: 'Eat to fill my oil sac for the long sleep.', E: 'Stage five! Eat to fill my oil sac for the long sleep.' },
  oilfull: { A: 'Go down!', B: 'I am full! Go down, down!', C: 'I am full! Swim down to the deep.', D: 'My oil sac is full! Swim down to the deep.', E: 'My oil sac is full! Swim down, down, down to the deep.' },
  sleepnow: { A: 'Sleep!', B: 'Go to sleep!', C: 'The deep! Go to sleep.', D: 'The deep! Now I can sleep.', E: 'The deep, at last! Now I can sleep.' },
  sleep: { A: 'I sleep.', B: 'I sleep and sleep.', C: 'I sleep in the deep.', D: 'I sleep in the deep for months.', E: 'I sleep in the deep while the months go by.' },
  wake: { A: 'Up, up!', B: 'Wake up! Get out!', C: 'It is winter. Wake up and moult!', D: 'Winter! Wake up and moult one last time.', E: 'Winter! Wake up and moult into a grown-up.' },
  adult: { A: 'I am big!', B: 'I am big now!', C: 'I am a grown copepod!', D: 'I am grown up!', E: 'I am grown up at last!' },
  trail: { A: 'Go, go, go!', B: 'Follow the trail!', C: 'Follow the pink trail!', D: 'Follow her pink scent trail.', E: 'A girl left a scent trail. Follow the pink sparkles.' },
  wait: { A: 'I swim.', B: 'Swim. A boy will come.', C: 'Swim. A boy will find me.', D: 'Swim about. A boy will smell my trail.', E: 'Swim about. A boy will smell my trail and find me.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the copepod.', E: 'Go and say hello to the copepod.' },
  met: { A: 'Hi!', B: 'We say hi!', C: 'We found each other!', D: 'At last we found each other!', E: 'At last we found each other in the dark!' },
  rise: { A: 'Go up!', B: 'Swim up to the top!', C: 'Swim up to the green top.', D: 'Spring is here! Swim up to the top.', E: 'Spring is coming! Swim up to the spring bloom.' },
  eggfood: { A: 'Eat, eat!', B: 'Eat lots for my eggs!', C: 'Eat lots to make my eggs.', D: 'Eat lots of diatoms to make my eggs.', E: 'Eat lots of diatoms to make my eggs.' },
  ready: { A: 'Eggs!', B: 'My eggs are ready!', C: 'My eggs are ready! Lay them.', D: 'My eggs are ready! Let them go.', E: 'My eggs are ready! Let them go into the sea.' },
  lay: { A: 'Go, go, go!', B: 'Wait for the green!', C: 'When it is green, lay eggs!', D: 'When the ring is green, let the eggs go!', E: 'When the ring turns green, let a clutch of eggs go!' },
  laid: { A: 'I see eggs!', B: 'My eggs float away!', C: 'My eggs float in the sea!', D: 'My eggs drift in the sea. Soon they will hatch.', E: 'My eggs drift in the sea, and soon they will hatch.' },
  nextspring: { A: 'I see eggs!', B: 'It is spring! Eggs!', C: 'It is spring. Her eggs float in the sea!', D: 'The next spring, her eggs drift in the sea.', E: 'The next spring, her eggs drift in the green sea.' },
  done: { A: 'I sleep.', B: 'All done! I rest.', C: 'My job is done. I rest.', D: 'My job is done. I rest in the sea.', E: 'My job is done. I rest in the sea.' },
  tooFar: { A: 'No, no, no!', B: 'Go back!', C: 'Turn back. The sea is big!', D: 'The sea goes on and on. Turn back.', E: 'The sea goes on and on. Turn back.' },
  snow: { A: 'I see snow!', B: 'Look! Snow in the sea!', C: 'Little bits fall like snow.', D: 'Bits of old plankton fall like snow.', E: 'Marine snow is falling into the deep.' },
  friends: { A: 'I see copepods!', B: 'Look! Lots of copepods!', C: 'Lots of copepods swim with me.', D: 'Lots of other copepods swim with me.', E: 'Lots of other copepods are swimming with me.' }
};
