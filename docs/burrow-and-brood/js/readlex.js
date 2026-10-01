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
/* words only Ant Kingdom needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'fly dig sip feed get bite help',
  B: 'land white legs ten hundred thousand drop drops yum hole full',
  C: 'her home homes high drink take tap mom crawl eyes spins sisters lots bottom sky dry lays call more way dead',
  D: 'young start starts keep clean sticky pale inside changing silk us job farmer bit carried falls walks sap called gives but carry together runs doors deepest visit push deeper chase fell pick crop summer coming makes sweet',
  E: 'never door behind kingdom kingdoms own floor lick enough small work whole grown diggers nurses farmers bring sweet grain reach live their ground each five princesses much squirt stroke antennae ask return spiky hunting lets tumbles another garden soaks soil trickles sand clay gather freeze does melts warms march laying heavy far squeak smell trail running pull walking same wait jaws quietly share need fill everywhere royal nursery different brand outside nobody boss older body digging give right leave fall'
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
  ant: 'worker', ants: 'ants', worker: 'worker', workers: 'ants', colony: 'ants',
  queen: 'queen', queens: 'queen', princess: 'alate', princesses: 'alate',
  egg: 'egg', eggs: 'egg', larva: 'larva', larvae: 'larva', baby: 'larva', babies: 'larva',
  cocoon: 'pupa', cocoons: 'pupa', pupa: 'pupa',
  aphid: 'aphid', aphids: 'aphid', ladybug: 'ladybug', beetle: 'bug', bug: 'bug', bugs: 'bug',
  food: 'seed', seed: 'seed', seeds: 'seed', crumb: 'crumb', crumbs: 'crumb', honeydew: 'honeydew',
  dirt: 'dirt', hill: 'hill', tunnel: 'tunnel', tunnels: 'tunnel', room: 'room', rooms: 'room', nest: 'room', nests: 'room',
  plant: 'plant', plants: 'plant', leaf: 'leaf', leaves: 'leaf', grass: 'grass',
  sun: 'sun', moon: 'moon', rain: 'rain', water: 'rain', snow: 'snow',
  wings: 'wings', wing: 'wings', worm: 'worm'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eggs:  { A: 'eggs', B: 'eggs', C: 'lay eggs',    D: 'lay my eggs',      E: 'Lay my first eggs here.' },
  feed:  { A: 'feed', B: 'feed', C: 'feed it',     D: 'feed the larva',   E: 'Feed the hungry larva.' },
  feedq: { A: 'feed', B: 'feed', C: 'feed her',    D: 'feed the queen',   E: 'Give the queen some food.' },
  milk:  { A: 'sip',  B: 'sip',  C: 'drink',       D: 'tap the aphid',    E: 'Tap the aphid for honeydew.' },
  take:  { A: 'get',  B: 'get',  C: 'take it',     D: 'take it home',     E: 'Pick it up and take it home.' },
  drop:  { A: 'down', B: 'drop', C: 'put it down', D: 'put it down here', E: 'Put it down right here.' },
  bite:  { A: 'bite', B: 'bite', C: 'bite it',     D: 'bite the larva',   E: 'Bite the ladybug larva away!' },
  help:  { A: 'help', B: 'help', C: 'help me',     D: 'come and help me', E: 'Come and help me, sisters!' }
};
/* the picture on each action card */
const ACTION_PIC = { eggs: 'egg', feed: 'larva', feedq: 'queen', milk: 'aphid', take: 'seed', drop: 'dirt', bite: 'ladylarva', help: 'ants' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the colony's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  flight: { title: 'The queen', pic: 'alate', gate: false,
    A: ['I am a queen.', 'I can fly!', 'I go down.'],
    B: ['I am a little queen.', 'I fly up and down.', 'Here I come!'],
    C: ['I am a new queen with wings.', 'I fly away from my home.', 'Now I will find a new home.'],
    D: ['I am a new queen with wings.', 'I fly up high in the warm air.', 'Soon I will land and make a new home.'],
    E: ['On a warm day, young queens fly out of their nests.', 'I fly high, then land on the soft ground.', 'Now I will start a kingdom of my own.'],
    yesno: [['Can the queen fly?', true], ['Is the queen a ladybug?', false]] },
  dig: { title: 'Off come my wings', pic: 'queen', gate: false,
    A: ['I am down.', 'I dig, dig, dig.', 'I dig a room.'],
    B: ['I do not want my wings.', 'I dig down, down, down.', 'Here is my little room.'],
    C: ['I put my wings down.', 'Now I dig into the dirt.', 'I dig a little room for my eggs.'],
    D: ['My wings come off. I will not fly again.', 'I dig down into the soft dirt.', 'I make a safe room for my eggs.'],
    E: ['I snap off my wings, because I will never fly again.', 'I dig deep into the dirt and close the door behind me.', 'This little room is where my kingdom starts.'],
    yesno: [['Do I dig a room?', true], ['Do I have wings now?', false]] },
  eggs: { title: 'My first eggs', pic: 'egg', gate: true,
    A: ['I see my eggs.', 'I like my eggs!'],
    B: ['Here are my eggs.', 'They are little and white.', 'I will not go out.'],
    C: ['I lay some eggs in my room.', 'They are little and white.', 'I will sit here with my eggs.'],
    D: ['I lay my first eggs in the safe room.', 'They are tiny, white and sticky.', 'I stay here and keep my eggs clean.'],
    E: ['I lay my first eggs on the floor of my room.', 'They are tiny, white and a little bit sticky.', 'I lick them clean and keep them safe.'],
    yesno: [['Are my eggs white?', true], ['Are my eggs big?', false]] },
  larvae: { title: 'Ant babies', pic: 'larva', gate: true,
    A: ['I see a larva.', 'It can eat.', 'I feed it.'],
    B: ['Look at the little larva!', 'It has no legs.', 'I feed it and feed it.'],
    C: ['The eggs are gone. Now I see larvae!', 'A larva has no legs and no eyes.', 'I feed my babies.'],
    D: ['My first eggs hatch into larvae.', 'They have no legs and no eyes.', 'They are very hungry, so I must feed my babies.'],
    E: ['My first eggs hatch into tiny white larvae.', 'They have no legs, so they can not get food.', 'I feed them from my own body.'],
    yesno: [['Do larvae have legs?', false], ['Can I feed the larva?', true]] },
  cocoon: { title: 'The cocoon', pic: 'pupa', gate: true,
    A: ['I see a cocoon.', 'It is a pupa.', 'It can sleep.'],
    B: ['The larva is big.', 'It is in a cocoon.', 'It will come out an ant!'],
    C: ['The big larva spins a cocoon.', 'It will rest in there.', 'It will come out an ant!'],
    D: ['When a larva is big, it spins a silk cocoon.', 'Inside, it is changing.', 'Soon it will come out as an ant.'],
    E: ['When a larva is big enough, it spins a silk cocoon.', 'Inside the cocoon, its body is changing into an ant.', 'I lick the cocoon and keep it safe.'],
    yesno: [['Is the larva in a cocoon?', true], ['Can the cocoon run?', false]] },
  worker: { title: 'My first worker', pic: 'worker', gate: true,
    A: ['Look at me!', 'I am an ant!', 'I can go up.'],
    B: ['I come out of my cocoon.', 'I am a little ant.', 'I will help the queen!'],
    C: ['I come out of the cocoon.', 'I am a worker ant now!', 'I will find food for my mom, the queen.'],
    D: ['I crawl out of my cocoon, pale and soft.', 'I am the first worker ant!', 'My mom, the queen, will lay more eggs, and I will find food.'],
    E: ['I push out of my cocoon, pale and soft.', 'I am one of the very first workers, and I am small.', 'Now I work for the whole colony.'],
    yesno: [['Am I an ant now?', true], ['Am I the queen?', false]] },
  ten: { title: 'Ten ants', pic: 'ants', gate: true,
    A: ['I see ants.', 'We can dig.', 'We can eat.'],
    B: ['Look at all the ants!', 'We are ten ants.', 'We dig and play.'],
    C: ['Now we are ten ants.', 'Some ants dig. Some ants find food.', 'We all help.'],
    D: ['Now there are ten of us.', 'Every ant has a job to do.', 'Some dig, some feed the babies, and some find food.'],
    E: ['There are ten of us now, and every ant has a job.', 'Young ants look after the babies, and older ants go outside.', 'Nobody is the boss. We just help each other.'],
    yesno: [['Are there ten ants?', true], ['Do the ants all sleep?', false]] },
  hundred: { title: 'One hundred ants', pic: 'ants', gate: true,
    A: ['I see ants!', 'We go up.', 'We go down.'],
    B: ['Look! One hundred ants!', 'We run in and out.', 'We have a big nest.'],
    C: ['Now we are one hundred ants!', 'We dig new rooms.', 'Some ants go to the aphids.'],
    D: ['Our colony has one hundred ants.', 'We dig new rooms for the babies.', 'Farmer ants look after the aphids on the plant.'],
    E: ['Our colony has grown to one hundred ants.', 'Diggers make new rooms, and nurses look after the babies.', 'Farmers bring sweet honeydew home from the aphids.'],
    yesno: [['Are there one hundred ants?', true], ['Is the nest little?', false]] },
  thousand: { title: 'A thousand ants', pic: 'hill', gate: true,
    A: ['Look at the ant hill!', 'We go up.', 'We go down.'],
    B: ['We are one thousand ants!', 'Look at the big ant hill!', 'Ants run in and out, in and out.'],
    C: ['Now we are one thousand ants!', 'We put the dirt on top of the hill.', 'Our nest has lots of rooms.'],
    D: ['Our colony has one thousand ants!', 'Every bit of dirt on the hill was carried up by an ant.', 'The nest is deep under the grass.'],
    E: ['One thousand ants live in our colony now.', 'Every grain of dirt in the ant hill was carried up by an ant.', 'The tunnels reach deep under the ground.'],
    yesno: [['Is the ant hill big?', true], ['Is the nest in the sky?', false]] },
  kingdom: { title: 'An ant kingdom', pic: 'alate', gate: true,
    A: ['I see a queen.', 'A queen can fly!', 'Up, up, up!'],
    B: ['Look! Little queens with wings!', 'They fly up, up, up!', 'Here they go!'],
    C: ['Now we are a big, big nest.', 'New queens with wings come out.', 'They fly away to find new homes.'],
    D: ['Our colony is so big that it makes new queens.', 'The young queens have wings.', 'On a warm day, they fly off to start new nests.'],
    E: ['Our kingdom has five thousand ants, and it is time for new queens.', 'On a warm, still day, the princesses fly out with their wings.', 'Each one will start a kingdom of her own.'],
    yesno: [['Can the new queens fly?', true], ['Is the colony little?', false]] },
  honeydew: { title: 'Sweet honeydew', pic: 'aphid', gate: false,
    A: ['I see an aphid.', 'I sip, sip, sip!', 'I like it!'],
    B: ['Look at the green aphid.', 'It has a little drop.', 'I sip it. Yum!'],
    C: ['The aphid has a drop for me.', 'I tap it and get the drop.', 'I take the drop home.'],
    D: ['Aphids drink sap from the plant.', 'They make sweet drops called honeydew.', 'I tap the aphid, and it gives me a drop.'],
    E: ['Aphids drink so much sap that they squirt out sweet honeydew.', 'I stroke the aphid with my antennae to ask for a drop.', 'In return, we ants keep the aphids safe.'],
    yesno: [['Is the drop for me?', true], ['Is the aphid a ladybug?', false]] },
  ladybug: { title: 'The ladybug larva', pic: 'ladylarva', gate: false,
    A: ['I see a larva.', 'It can eat my aphids!', 'I bite!'],
    B: ['Look! A ladybug larva!', 'It will eat the aphids.', 'I bite it. Go, go, go!'],
    C: ['A ladybug larva is on the plant.', 'It wants to eat our aphids!', 'I bite it. Then it is gone!'],
    D: ['A ladybug larva came to eat our aphids.', 'I bite it, and my sisters come to help.', 'It falls off the plant and walks away.'],
    E: ['A spiky ladybug larva is hunting our aphids.', 'We bite it until it lets go of the plant.', 'It tumbles off and goes to find another garden.'],
    yesno: [['Is the larva on the plant?', true], ['Do I help the larva?', false]] },
  rain: { title: 'Rain!', pic: 'rain', gate: false,
    A: ['I see the rain.', 'It is in my nest!', 'Go up, up!'],
    B: ['Look! Rain is in the nest!', 'We get the babies.', 'We run up and hide.'],
    C: ['Rain went down into our tunnels.', 'Now some rooms are wet.', 'We take the babies to a dry room.'],
    D: ['Rain runs down into our tunnels.', 'Some rooms get wet and cold.', 'We carry the babies up to a dry room.'],
    E: ['Rain soaks into the soil and trickles down our tunnels.', 'Water runs through sand fast, but it sits on top of clay.', 'We carry the eggs and babies to a dry room.'],
    yesno: [['Is the rain wet?', true], ['Do we sleep in the water?', false]] },
  help: { title: 'Better together', pic: 'bug', gate: false,
    A: ['I see a bug.', 'Help me!', 'We go, go, go!'],
    B: ['Look at the big bug!', 'It is too big for one ant.', 'Come and help!'],
    C: ['I find a big dead bug.', 'It is too big for me.', 'My sisters come to help, and we all take it home.'],
    D: ['I find a beetle, but it is too big to carry.', 'I call my sisters to come and help.', 'We carry it home together.'],
    E: ['A beetle is far too heavy for one ant.', 'I squeak and leave a smell trail, and my sisters come running.', 'Together we pull it home, all walking the same way.'],
    yesno: [['Is the bug big?', true], ['Can one ant take it home?', false]] },
  winter: { title: 'Winter', pic: 'snow', gate: false,
    A: ['I see snow.', 'We go down.', 'We sleep.'],
    B: ['It is cold.', 'We go down, down, down.', 'We sleep here.'],
    C: ['It is cold now.', 'We go down to the bottom room.', 'We all rest there.'],
    D: ['The days get short and cold.', 'We go deep down where it is warm.', 'We rest there until spring.'],
    E: ['Snow covers the ground and the soil is cold.', 'We gather deep down where the ground does not freeze.', 'We rest there, quiet and still, until spring.'],
    yesno: [['Is it cold?', true], ['Do we go up?', false]] },
  spring: { title: 'Spring!', pic: 'sun', gate: false,
    A: ['I see the sun!', 'We go up!'],
    B: ['The snow is not here.', 'We come out!', 'We want to eat.'],
    C: ['The snow is gone!', 'We wake up and go out.', 'The queen will lay new eggs.'],
    D: ['The snow is gone and the sun is warm.', 'We open the doors and go out.', 'The queen starts to lay eggs again.'],
    E: ['The snow melts and the sun warms the soil.', 'We open the doors and march out to find food.', 'The queen starts laying eggs again.'],
    yesno: [['Is the snow gone?', true], ['Do we sleep now?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per session; see Reading.init for the rest */
const STORY_TRIGGERS = { landed: 'dig', enemy: 'ladybug', bigGrab: 'help', colonyWinter: 'winter', colonySpring: 'spring' };

/* ---------- read-and-do missions ----------
   who: queen (founding) · worker (any worker) · nest (underground) · outside (above ground) · plant (on a plant)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'qdig', who: 'queen', A: 'Dig down, down!', B: 'Dig down, down, down!', C: 'Dig down into the dirt.', D: 'Dig down deep into the dirt.', E: 'Dig a deep, safe room for your eggs.' },
  { key: 'outside', who: 'nest', A: 'Go up to the sun.', B: 'Go out of the nest.', C: 'Go out to find food.', D: 'Go out of the nest and look for food.', E: 'Climb out of the nest and look for food.' },
  { key: 'seed', who: 'worker', A: 'Get the food!', B: 'Get food for the nest.', C: 'Take some food home.', D: 'Take some food home to the nest.', E: 'Find some food and carry it home.' },
  { key: 'top', who: 'plant', A: 'Go up, up, up!', B: 'Go up, up, up!', C: 'Go up to the top of the plant.', D: 'Climb up to the top of the plant.', E: 'Climb all the way up to the top of the plant.' },
  { key: 'aphid2', who: 'plant', A: 'Sip, sip!', B: 'Sip two drops.', C: 'Get two drops from the aphids.', D: 'Tap two aphids for honeydew.', E: 'Get honeydew from two different aphids.' },
  { key: 'deep', who: 'nest', A: 'Go down, down, down!', B: 'Go down, down, down!', C: 'Go down to the bottom of the nest.', D: 'Go down to the deepest room.', E: 'Find the deepest room in the nest.' },
  { key: 'queen', who: 'nest', A: 'Go to the queen.', B: 'Go and see the queen.', C: 'Find the queen in her room.', D: 'Go and visit the queen in her room.', E: 'Visit the queen in her royal room.' },
  { key: 'nursery', who: 'nest', A: 'Go to the babies.', B: 'Go and see the babies.', C: 'Find the room with the babies.', D: 'Find the room where the babies are.', E: 'Find the nursery where the babies live.' },
  { key: 'dig', who: 'nest', A: 'Dig, dig, dig!', B: 'Dig a big hole.', C: 'Dig a new tunnel.', D: 'Dig a new tunnel in the dirt.', E: 'Dig a brand new tunnel for the colony.' },
  { key: 'hill', who: 'worker', from: 'C', A: 'Go up to the hill.', B: 'Go up to the hill.', C: 'Put some dirt on the ant hill.', D: 'Carry some dirt up to the ant hill.', E: 'Carry dirt up and drop it on the ant hill.' },
  { key: 'larva', who: 'worker', A: 'Bite the larva!', B: 'Bite the ladybug larva!', C: 'Find the larva and bite it.', D: 'Chase the ladybug larva away.', E: 'Chase the ladybug larva off our aphids.' },
  { key: 'feed', who: 'worker', A: 'Feed a baby.', B: 'Feed a little larva.', C: 'Find a larva and feed it.', D: 'Feed a hungry larva.', E: 'Find a hungry larva and feed it.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  dig: { A: 'Dig, dig, dig!', B: 'Dig down, down, down!', C: 'Dig down into the dirt.', D: 'Push into the dirt to dig.', E: 'Push into the dirt to dig a room.' },
  deeper: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down some more.', D: 'Dig a little deeper.', E: 'Keep digging. The room must be deep.' },
  layEggs: { A: 'I see my room!', B: 'Here is my room. Eggs!', C: 'Lay my eggs here.', D: 'This room is deep and safe. Lay my eggs.', E: 'This room is deep and safe. Lay my first eggs.' },
  tend: { A: 'I see my eggs.', B: 'I sit with my eggs.', C: 'I sit with my eggs.', D: 'I stay with my eggs until they hatch.', E: 'I stay with my eggs and lick them clean.' },
  feedLarva: { A: 'Feed the larva!', B: 'Feed the little larva!', C: 'A larva wants food. Feed it.', D: 'A larva is hungry. Feed it!', E: 'A larva is hungry. Go and feed it.' },
  cocoon: { A: 'I see a cocoon.', B: 'Look! A cocoon!', C: 'An ant will come out of the cocoon.', D: 'Soon an ant will come out.', E: 'Wait for the first worker to come out.' },
  worker: { A: 'I am an ant! Go up!', B: 'I am a worker. Go up!', C: 'I am a worker. Go and find food.', D: 'I am a worker ant. Go out and find food.', E: 'I am a worker now. Climb up and find food.' },
  forage: { A: 'Get the food!', B: 'Get the food!', C: 'Find food and take it.', D: 'Find food and pick it up.', E: 'Look for seeds and crumbs, then pick one up.' },
  carryHome: { A: 'Go down!', B: 'Go down to the nest!', C: 'Take it home to the nest.', D: 'Take it down to the food room.', E: 'Carry it down the tunnel to the food room.' },
  store: { A: 'Down, down!', B: 'Drop it here.', C: 'Put it down here.', D: 'Put the food down here.', E: 'Put the food down in the food room.' },
  aphids: { A: 'Go up! Sip!', B: 'Go up and sip.', C: 'Go up the plant and drink.', D: 'Climb the plant and tap an aphid.', E: 'Climb the plant and tap an aphid for honeydew.' },
  cropFull: { A: 'Go down!', B: 'I am full! Go down.', C: 'I am full. Take it home.', D: 'My crop is full. Take it home.', E: 'My crop is full. Share it with a larva.' },
  enemy: { A: 'A larva! Bite!', B: 'A larva! Go and bite!', C: 'A ladybug larva! Go and bite it.', D: 'A ladybug larva wants our aphids!', E: 'A ladybug larva is eating our aphids. Bite it!' },
  shooed: { A: 'No larva!', B: 'The larva is not here.', C: 'The larva is gone!', D: 'It fell off the plant!', E: 'It fell off, and the aphids are safe.' },
  bigFood: { A: 'Help! Help!', B: 'Too big! Help!', C: 'It is too big. Call for help.', D: 'It is too big. Call my sisters to help.', E: 'It is too big for one ant. Call for help!' },
  dirt: { A: 'Go up!', B: 'Go up and out!', C: 'Take the dirt up and out.', D: 'Carry the dirt up to the ant hill.', E: 'My jaws are full. Carry the dirt up to the ant hill.' },
  rain: { A: 'Rain! Go up!', B: 'Rain! Get the babies!', C: 'Rain! Take the babies to a dry room.', D: 'Rain! Carry the babies to a dry room.', E: 'Water is coming in! Carry the babies to a dry room.' },
  winter: { A: 'Snow! Go down.', B: 'It is cold. Go down.', C: 'It is cold. We all go down.', D: 'It is cold. Go deep down in the nest.', E: 'Winter is here. Go deep down where it is warm.' },
  sleeping: { A: 'We sleep.', B: 'We sleep here.', C: 'We rest here.', D: 'We rest until spring.', E: 'We rest quietly until spring.' },
  spring: { A: 'I see the sun!', B: 'We go out! Eat!', C: 'The snow is gone! Go out.', D: 'Spring is here. Go and find food.', E: 'Spring is here! Time to find food again.' },
  summer: { A: 'I see the sun!', B: 'The sun is out!', C: 'It is warm. Lots of food!', D: 'Summer is here! Lots of food.', E: 'Summer! There is lots of food and honeydew.' },
  autumn: { A: 'I see a leaf.', B: 'The leaves come down.', C: 'The seeds come down now.', D: 'Seeds come down. Get lots of food.', E: 'Seeds fall everywhere. Fill the food room before winter.' },
  room: { A: 'Dig, dig!', B: 'Dig a big room!', C: 'The nest is full. Dig new rooms.', D: 'The nest is full. Dig new rooms.', E: 'The nest is too full. Dig new rooms so we can grow.' },
  hungry: { A: 'Get food!', B: 'Get food! Get food!', C: 'The babies want food.', D: 'The babies are hungry. Get food!', E: 'The larvae are hungry. We need more food.' },
  help: { A: 'We help!', B: 'They come to help!', C: 'My sisters come to help.', D: 'My sisters are coming to help.', E: 'My sisters are coming to help me.' },
  kingdom: { A: 'Up, up, up!', B: 'Look! Queens with wings!', C: 'New queens fly away.', D: 'The young queens fly off.', E: 'The young queens fly off to start new kingdoms.' }
};
