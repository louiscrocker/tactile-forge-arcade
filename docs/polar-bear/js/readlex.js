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

/* words only Polar Bear needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: "out play roll stand sniff slide wheee fast with on sit wait and creep looks stop has find swim gone hi pounce smell green cold big far push dig drink little do not yum one feed carry home night",
  B: "dark yet open spring day back legs wind snowy tummy white sits runs away from hungry walk prints hare went by brr move found lots then where summer into its tell sky now again year old time wall over your some new wiggle win oops hold e warm good rest had still shh saw so close grow across say got hard make them stars",
  C: "shut month walls blue digs bright did how learns tall tells fly arctic when near eaten winter behind step after line round foxes leave blows curl covers us blanket hot frozen finds food comes keep very head splash shout last shares off everything her cracked paddle front melts lot huge wheels watch safe place radio hear goes grass dives try who nights dance northern late autumn falls freezes myself half years own ways live made climb pressure tree young wrestle but hurt join follow another together while long way room born begins times lie next yourself more won fell lying or curled looking breaking crack freezing playing soft bank deep enough let whole life",
  D: "middle heavy guinea pig rich inside march breaks blink chase pushes makes strong their high much farther best world slides follows careful distance shadow turns weeks set leads stops often animal leaves neat polar wide dinner plate howls flies drifts shows slips closer months full whiteout blowing hides mum's great swimmers steer shake fat stored study wears boy wear necks wider than heads slowly burrow practice better yours different curtains light called starts freeze slush thin thick holds onto mother walks slabs pile blocks male fight mouths nobody test strength trail meet grown tunnel cover were does catch wave drinking growing arrows rolled face leading arrow walked snug getting tucked moved slipped coming dived dancing fighting needs wobbled mouth gently",
  E: "december january weighs six hundred grams teeth only drinks sleeps grows opens glow april weighing ten kilograms week used learn stands standing helps nearly kilometre small slopes bellies stretch seems fun if grey thirty centimetres feet ptarmigan reading lies lee storm bear's latin name means travels rests breathing scratching claws waits beside without moving sometimes hours most tries lift creeps may amount once meals everyone even answers chuff swam nine stopping ride mother's places completely living helicopters tundra buggies cannot his neck tunnels scurry between grasses burrows pounces always smells letters book bits hit above earth edge yearlings practise family separate each wanders mostly alone wander areas ridges dens males female's raise ashore snowdrift peat canada been hundreds eats nothing lives break start right work resting icy hello broke game ring give slope belly trots snuggle tight breathe hunts end chuffs lead miss past spar midwinter blind tumble finish pick"
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
  bear: 'bear', bears: 'bear', cub: 'cub', cubs: 'cubs', twin: 'twin', newborn: 'newborn', yearling: 'yearling', mum: 'mum', mate: 'mate',
  den: 'den', milk: 'milk', meal: 'meal', seal: 'seal', seals: 'seal', hole: 'hole', holes: 'hole', fox: 'fox', lemming: 'lemming', lemmings: 'lemming',
  tracks: 'tracks', track: 'tracks', footprints: 'tracks', scent: 'scent', snow: 'snow', ice: 'ice', sea: 'sea', water: 'water', sun: 'sun', moon: 'moon', rain: 'rain',
  blizzard: 'blizzard', rock: 'rock', hill: 'hill', hills: 'hill', land: 'land', shore: 'shore', buggy: 'buggy', scientist: 'scientist', scientists: 'scientist',
  antenna: 'antenna', collar: 'collar', nose: 'nose', paw: 'paw', paws: 'paw', ears: 'ears', eyes: 'eyes', eye: 'eyes', fur: 'fur', skin: 'fur', tail: 'tail',
  whale: 'whale', whales: 'whale', beluga: 'whale', belugas: 'whale', caribou: 'caribou', bird: 'bird', birds: 'bird', floe: 'floe', floes: 'floe', ridge: 'ridge', lights: 'lights'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  drink:  { A: 'drink',  B: 'drink milk',   C: 'drink the milk',        D: 'drink milk from Mum',        E: 'Drink the warm milk.' },
  eat:    { A: 'eat',    B: 'eat',          C: 'eat the meal',          D: 'eat the meal Mum found',     E: 'Eat the meal with Mum. Yum!' },
  play:   { A: 'play',   B: 'play',         C: 'play in the snow',      D: 'play with the other bear',   E: 'Push and roll in a play-fight.' },
  pounce: { A: 'pounce', B: 'pounce',       C: 'pounce on it',          D: 'creep up and pounce',        E: 'Creep up slowly and pounce!' },
  sniff:  { A: 'sniff',  B: 'sniff it',     C: 'sniff the smell',       D: 'sniff the wind',             E: 'Sniff the scent on the wind.' },
  look:   { A: 'look',   B: 'look at it',   C: 'look at the tracks',    D: 'look at the footprints',     E: 'Look at the tracks. Who went by?' },
  wait:   { A: 'wait',   B: 'sit still',    C: 'wait by the hole',      D: 'wait very still by the hole', E: 'Wait by the hole and keep very still.' },
  creep:  { A: 'creep',  B: 'creep up',     C: 'creep up on it',        D: 'creep up on the seal',       E: 'Creep up while its head is down.' },
  slide:  { A: 'slide',  B: 'slide down',   C: 'slide down the hill',   D: 'slide down on my tummy',     E: 'Slide down the snowy hill. Wheee!' },
  hello:  { A: 'hi',     B: 'say hi',       C: 'say hi to them',        D: 'wave to the scientists',     E: 'Wave hello to the scientists.' },
  meet:   { A: 'hi',     B: 'say hi',       C: 'go and say hi',         D: 'say hi to the other bear',   E: 'Go and say hello, nose to nose.' },
  dig:    { A: 'dig',    B: 'dig the den',  C: 'make the den',          D: 'make the den room',          E: 'Finish the round room for the cubs.' },
  carry:  { A: 'carry',  B: 'carry it',     C: 'carry the cub home',    D: 'carry the cub to the den',   E: 'Pick up the cub and carry it home.' },
  feed:   { A: 'feed',   B: 'feed them',    C: 'feed the cubs',         D: 'feed the cubs my milk',      E: 'Let the cubs drink my milk.' }
};
/* the picture on each action card */
const ACTION_PIC = { drink: 'milk', eat: 'meal', play: 'twin', pounce: 'lemming', sniff: 'scent', look: 'tracks', wait: 'hole', creep: 'seal', slide: 'slide', hello: 'buggy', meet: 'mate', dig: 'den', carry: 'cub', feed: 'cubs' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the bear's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  born: { title: 'Born in a snow den', pic: 'den', gate: false,
    A: ['I am a cub.', 'I am in the den.', 'I like my mum.'],
    B: ['I am a little cub.', 'It is dark in the den.', 'I can not see yet.'],
    C: ['I am a new cub in a snow den.', 'My eyes are shut. I can not see.', 'I find my mum. She is warm.'],
    D: ['I was born in a den under the snow, in the middle of winter.', 'I am tiny, about as heavy as a guinea pig.', 'My mum is warm, and her milk is rich.'],
    E: ['A polar bear cub is born in a snow den in December or January.', 'It weighs about six hundred grams, its eyes are shut and it has no teeth.', 'For three months it only drinks milk, sleeps and grows.'],
    yesno: [['Am I a cub?', true], ['Am I a big bear?', false]] },
  eyes: { title: 'My eyes open', pic: 'eyes', gate: true,
    A: ['Look at my eyes!', 'I see my mum.', 'I see the den.'],
    B: ['My eyes are open!', 'I see Mum.', 'I see my twin.'],
    C: ['My eyes open at one month.', 'I can see now!', 'The snow walls are blue.'],
    D: ['After a month my eyes open.', 'I can see Mum, my twin and the snow walls.', 'Soon I can walk about inside the den.'],
    E: ['A cub opens its eyes at about one month old.', 'By two months it can walk about inside the den.', 'The light comes through the snow, so the walls glow blue.'],
    yesno: [['Are my eyes open?', true], ['Are my eyes red?', false]] },
  out: { title: 'Out into the light', pic: 'cub', gate: true,
    A: ['I am a cub.', 'I go out!', 'I see the sun.'],
    B: ['It is spring.', 'Out I go!', 'I see the sun and the snow.'],
    C: ['Mum digs the den open.', 'I go up and out into the snow.', 'The sun is so bright!'],
    D: ['In March, Mum breaks open the den.', 'My twin and I climb out for the first time.', 'The snow is so bright that I blink.'],
    E: ['In March or April the mother breaks open the den.', 'The cubs come out for the first time, weighing about ten kilograms.', 'For a week or two they stay near the den and get used to the cold.'],
    yesno: [['Did I go out of the den?', true], ['Is the den in the sea?', false]] },
  play: { title: 'Let us play!', pic: 'twin', gate: false,
    A: ['I see my twin.', 'We play!', 'Roll, roll, roll!'],
    B: ['Here is my twin.', 'We push and roll.', 'We play all day!'],
    C: ['My twin wants to play.', 'We push and roll in the snow.', 'Play is how a cub learns.'],
    D: ['We wrestle, chase and roll in the snow.', 'I push my twin over and my twin pushes me.', 'Play makes us strong.'],
    E: ['Polar bear cubs wrestle, chase and roll in the snow.', 'Play makes them strong, and it is how they learn to push and pounce.', 'Nobody gets hurt in a play-fight.'],
    yesno: [['Do cubs play?', true], ['Do cubs sleep all day?', false]] },
  sniffwind: { title: 'Sniff the wind', pic: 'sniff', gate: false,
    A: ['I stand up.', 'I sniff!', 'Sniff, sniff, sniff!'],
    B: ['I stand up on my back legs.', 'I sniff the wind.', 'What can I smell?'],
    C: ['I stand up tall on my back legs.', 'I put my nose up and sniff the wind.', 'My nose tells me what is out there.'],
    D: ['Bears stand up on their back legs to sniff the wind.', 'Up high, I can smell and see much farther.', 'My nose will be one of the best in the world.'],
    E: ['A polar bear often stands up on its back legs to sniff the wind.', 'Standing up tall helps it smell and see farther.', 'It can smell a seal nearly a kilometre away.'],
    yesno: [['Can I stand up?', true], ['Can I fly?', false]] },
  slide: { title: 'Wheee!', pic: 'slide', gate: false,
    A: ['I see the hill.', 'I slide!', 'Wheee!'],
    B: ['Here is a big snowy hill.', 'I slide down on my tummy.', 'Wheee!'],
    C: ['I go to the top of the hill.', 'I slide down on my tummy.', 'Wheee! Again, again!'],
    D: ['I slide down the snowy hill with my legs out.', 'My twin slides after me.', 'Then we climb up and slide again.'],
    E: ['Polar bears, big and small, slide down snowy slopes on their bellies.', 'They stretch their legs out and zoom down.', 'It seems to be just for fun.'],
    yesno: [['Do I slide down the hill?', true], ['Do I slide up the hill?', false]] },
  fox: { title: 'The Arctic fox', pic: 'fox', gate: false,
    A: ['I see a fox.', 'Hop, hop!', 'It can go fast.'],
    B: ['Look! A little white fox.', 'It sits in the snow.', 'It runs away from me.'],
    C: ['A little white fox sits in the snow.', 'It is an Arctic fox.', 'When I come near, it runs away.'],
    D: ['An Arctic fox follows us across the snow.', 'It keeps a careful distance, like a little shadow.', 'In summer its fur turns brown.'],
    E: ['Arctic foxes often follow polar bears across the sea ice.', 'They keep a careful distance and run off if a bear comes close.', 'In winter the fox is white; in summer it is brown and grey.'],
    yesno: [['Is the fox white?', true], ['Is the fox big?', false]] },
  trek: { title: 'To the sea ice', pic: 'mum', gate: true,
    A: ['We go, go, go!', 'I see Mum.', 'I go with Mum.'],
    B: ['Mum is hungry.', 'We go to the sea.', 'I walk with Mum.'],
    C: ['Mum has not eaten all winter.', 'Now we walk to the sea ice.', 'I walk behind Mum, one step after the other.'],
    D: ['After two weeks by the den, we set off.', 'Mum leads us on a long walk to the frozen sea.', 'She stops often so we can rest and drink.'],
    E: ['The mother has not eaten for months, so she is very hungry.', 'She leads her cubs on a long walk across the snow to the sea ice.', 'She stops often to let the cubs rest and drink her milk.'],
    yesno: [['Do we go to the sea?', true], ['Do we go to sleep?', false]] },
  tracks: { title: 'Footprints', pic: 'tracks', gate: false,
    A: ['I see tracks.', 'Look at the tracks!', 'Fox tracks!'],
    B: ['Look! Tracks in the snow.', 'Little prints. A fox!', 'Hop, hop! A hare went by.'],
    C: ['Tracks in the snow!', 'Little prints in a line: a fox went by.', 'Big round prints: a bear like me.'],
    D: ['Every animal leaves its own tracks in the snow.', 'A fox leaves neat little prints in a line.', 'A polar bear track is as wide as a dinner plate.'],
    E: ['A polar bear track can be thirty centimetres across.', 'An Arctic fox leaves neat little prints, a hare leaves big back feet in front of little front feet, and a ptarmigan leaves bird prints.', 'Reading tracks tells you who walked by.'],
    yesno: [['Do foxes leave tracks?', true], ['Do tracks go up in the sky?', false]] },
  blizzard: { title: 'A blizzard', pic: 'blizzard', gate: false,
    A: ['I see snow.', 'Go to the rock!', 'I am in.'],
    B: ['Brr! A big blizzard.', 'We go to the big rock.', 'We hide with Mum.'],
    C: ['The wind blows hard. It is a blizzard.', 'We curl up behind the big rock.', 'The snow covers us like a blanket.'],
    D: ['In a blizzard the wind howls and the snow flies.', 'We lie down behind the big rock, out of the wind.', 'The snow drifts over us, and we stay warm.'],
    E: ['In a blizzard a polar bear lies down with its back to the wind.', 'It finds the lee of a rock or a ridge of ice.', 'The snow drifts over it like a blanket until the storm blows over.'],
    yesno: [['Is it a blizzard?', true], ['Is it hot?', false]] },
  seaice: { title: 'The sea ice', pic: 'ice', gate: false,
    A: ['I see the ice.', 'It is the sea!', 'I go on it.'],
    B: ['Look! The sea is ice.', 'I can walk on it.', 'It is big and white.'],
    C: ['The sea is frozen into ice.', 'We can walk on the sea!', 'This is where Mum finds food.'],
    D: ['Polar bears are sea bears.', 'We walk, rest and find our food out on the sea ice.', 'Under the ice the sea is deep and cold.'],
    E: ['The polar bear\'s Latin name means sea bear.', 'It needs the frozen sea: the ice is where it travels, rests and finds its food.', 'Seals swim under the ice all winter.'],
    yesno: [['Can we walk on the ice?', true], ['Is the ice hot?', false]] },
  wait: { title: 'Keep still', pic: 'hole', gate: false,
    A: ['I see a hole.', 'I sit.', 'I wait and wait.'],
    B: ['Here is a seal hole.', 'I sit by it.', 'I do not move.'],
    C: ['A seal comes up here to get air.', 'I wait by the hole. I keep very still.', 'Puff! A seal! Then it is gone.'],
    D: ['Seals keep little holes in the ice so they can come up for air.', 'Mum shows me how to wait by a hole, very still.', 'The seal comes up, then slips away again.'],
    E: ['Seals keep breathing holes open by scratching at the ice with their claws.', 'A polar bear waits beside a hole without moving, sometimes for hours.', 'Most of the time the seal slips away, and the bear tries again.'],
    yesno: [['Do I keep still?', true], ['Do I jump up and down?', false]] },
  stalk: { title: 'Creep, creep', pic: 'seal', gate: false,
    A: ['I see a seal.', 'I creep.', 'It looks! I stop.'],
    B: ['A seal is on the ice.', 'I creep up.', 'It looks at me. I stop!'],
    C: ['A seal sits on the ice in the sun.', 'When its head is down, I creep.', 'When it looks up, I stop. Splash! It is gone.'],
    D: ['In spring, seals rest on the ice in the sun.', 'I creep closer while its head is down, and I stop when it looks.', 'Splash! The seal slides back into its hole.'],
    E: ['Seals rest on the ice and lift their heads to look around every little while.', 'A polar bear creeps closer only while the head is down, and freezes when it looks.', 'Most of the time the seal slides back into its hole.'],
    yesno: [['Do I stop when it looks?', true], ['Do I run and shout?', false]] },
  meal: { title: 'A feast', pic: 'meal', gate: false,
    A: ['Mum has a meal.', 'We eat.', 'I sleep.'],
    B: ['Mum found a meal!', 'We all eat lots.', 'Then we sleep and sleep.'],
    C: ['Mum found a meal at last.', 'She shares it with us.', 'Then we sleep it off.'],
    D: ['Mum had not eaten for months, and now she has a meal.', 'She shares it with my twin and me.', 'We eat until we are full, then sleep for a long time.'],
    E: ['A polar bear may go days without a meal, then eat a huge amount at once.', 'A mother shares her meals with her cubs.', 'Then everyone sleeps it off on the ice.'],
    yesno: [['Did we eat?', true], ['Did we eat the ice?', false]] },
  lost: { title: 'Where is Mum?', pic: 'sniff', gate: false,
    A: ['I see no mum.', 'I sniff!', 'I find Mum!'],
    B: ['It is all white.', 'Where is Mum?', 'I sniff and sniff.'],
    C: ['The snow blows. Everything is white.', 'Where is Mum? I stand up and sniff.', 'I smell her! There she is!'],
    D: ['A whiteout! The blowing snow hides everything.', 'I stand up and sniff the wind for Mum\'s smell.', 'I find her scent, and Mum comes back for me.'],
    E: ['In a whiteout, blowing snow hides everything, even the sky.', 'A cub can find its mother by her scent on the wind.', 'The mother answers with a soft chuff and comes back.'],
    yesno: [['Did I find Mum?', true], ['Did I go to sleep?', false]] },
  swim: { title: 'Swim!', pic: 'swim', gate: false,
    A: ['I see water.', 'I go in.', 'I can swim!'],
    B: ['Here is the water.', 'It is cold.', 'I swim, swim, swim!'],
    C: ['The ice has cracked. There is water.', 'I go in and swim.', 'I paddle with my big front paws.'],
    D: ['Polar bears are great swimmers.', 'I paddle with my big front paws and steer with my back legs.', 'Then I climb out and shake.'],
    E: ['Polar bears paddle with their huge front paws and steer with their back legs.', 'One mother bear swam for nine days without stopping.', 'Little cubs get cold fast, and sometimes ride on their mother\'s back.'],
    yesno: [['Can a bear swim?', true], ['Is the water hot?', false]] },
  shore: { title: 'Summer on land', pic: 'shore', gate: true,
    A: ['I see the land.', 'The ice is gone.', 'We go up.'],
    B: ['It is summer.', 'The ice is gone.', 'We wait on the land.'],
    C: ['In summer the sea ice melts.', 'We swim to the land and wait.', 'We rest a lot. The sun is up all night!'],
    D: ['In summer the sea ice breaks up and melts away.', 'We swim to the shore and wait on the land.', 'We rest, and live on the fat we stored up on the ice.'],
    E: ['In some places the sea ice melts away completely in summer.', 'The bears swim to land and wait there until the sea freezes again.', 'They rest and eat very little, living on their fat.'],
    yesno: [['Is the ice gone?', true], ['Is it winter?', false]] },
  scientist: { title: 'The scientists', pic: 'buggy', gate: false,
    A: ['I see a buggy.', 'Hi! Hi!', 'I see a scientist.'],
    B: ['Look! A big buggy.', 'A scientist is in it.', 'She has an antenna.'],
    C: ['A big buggy with huge wheels!', 'The scientists watch bears from a safe place.', 'Mum has a radio collar. They can hear where she goes.'],
    D: ['Scientists study polar bears from a safe place.', 'Mum wears a radio collar, so they can follow where she goes.', 'Boy bears can not wear one: their necks are wider than their heads!'],
    E: ['Scientists study polar bears from helicopters and big tundra buggies.', 'Some mother bears wear a radio collar so the scientists can follow them.', 'A male cannot wear one, because his neck is wider than his head.'],
    yesno: [['Is the scientist in a buggy?', true], ['Is the scientist a bear?', false]] },
  pounce: { title: 'Pounce!', pic: 'lemming', gate: false,
    A: ['I see a lemming.', 'I pounce!', 'It is gone.'],
    B: ['A little lemming!', 'I jump on it.', 'It went into its hole.'],
    C: ['A lemming sits in the grass.', 'I creep up and pounce!', 'It dives into its hole. I try again.'],
    D: ['A lemming is a little round animal.', 'I creep up slowly and pounce.', 'It dives into its burrow, but every pounce is practice.'],
    E: ['Lemmings live in tunnels under the snow all winter.', 'In summer they scurry between the grasses and dive into their burrows.', 'A young bear pounces, and the lemming always gets away.'],
    yesno: [['Did it get away?', true], ['Did I eat it?', false]] },
  nose: { title: 'A super nose', pic: 'nose', gate: false,
    A: ['I sniff.', 'Sniff, sniff, sniff!', 'I can smell a whale.'],
    B: ['Sniff! What is this?', 'A whale went by.', 'My nose can tell.'],
    C: ['I sniff the air. Who went by?', 'A fox! And a whale in the sea!', 'My nose can tell who it was.'],
    D: ['A polar bear nose is much better than yours.', 'I can smell a seal from very far away.', 'Fox, caribou, whale: every smell is different.'],
    E: ['A polar bear can smell a seal nearly a kilometre away, even under deep snow.', 'Every animal has its own smell.', 'A bear learns the smells of the Arctic the way you learn the letters of a book.'],
    yesno: [['Can I smell a fox?', true], ['Can I smell the moon?', false]] },
  aurora: { title: 'Northern lights', pic: 'lights', gate: false,
    A: ['I see lights!', 'Look up!', 'Green, green, green!'],
    B: ['It is night.', 'Look! Green lights in the sky.', 'They go up and down.'],
    C: ['The nights are dark again.', 'Green lights dance in the sky.', 'They are the northern lights.'],
    D: ['In autumn the dark nights come back.', 'Green curtains of light dance across the sky.', 'They are called the northern lights.'],
    E: ['On dark autumn and winter nights, green curtains of light dance across the Arctic sky.', 'They glow when tiny bits from the sun hit the air high above the Earth.', 'They are called the northern lights.'],
    yesno: [['Are the lights green?', true], ['Are the lights in the sea?', false]] },
  freeze: { title: 'The sea freezes', pic: 'ice', gate: false,
    A: ['It is cold.', 'I see ice!', 'We go on it.'],
    B: ['It is cold now.', 'The sea is ice again.', 'Back on the ice we go!'],
    C: ['It is late autumn. Snow falls.', 'The sea freezes again.', 'Back to the ice we go!'],
    D: ['In late autumn the sea starts to freeze again.', 'First slush, then thin ice, then thick ice.', 'When it holds us, we walk out onto it.'],
    E: ['In late autumn the sea freezes: first slush, then thin ice, then thick ice.', 'Hungry bears wait at the edge of the shore.', 'As soon as the ice holds them, they walk out onto it.'],
    yesno: [['Is the sea ice again?', true], ['Is it hot?', false]] },
  yearling: { title: 'One year old', pic: 'yearling', gate: true,
    A: ['I am a yearling!', 'I am big!', 'I see the ice.'],
    B: ['I am one year old!', 'I am a yearling now.', 'I go on the ice with Mum.'],
    C: ['It is spring again. I am one year old.', 'I am back on the sea ice with Mum.', 'Now I can try it by myself.'],
    D: ['Spring is back, and I am one year old: a yearling.', 'I still stay with Mum, and I still drink her milk.', 'Now I wait by my own seal hole.'],
    E: ['Polar bear cubs stay with their mother for about two and a half years.', 'As yearlings they practise next to her, and they still drink her milk.', 'Every try is practice for when they are on their own.'],
    yesno: [['Am I one year old?', true], ['Am I a newborn cub?', false]] },
  leave: { title: 'On my own', pic: 'young', gate: true,
    A: ['I am a big bear.', 'I go, go, go.', 'I go far.'],
    B: ['I am big now.', 'It is time to go.', 'I go far, far away.'],
    C: ['I am two and a half years old.', 'Mum and I go our own ways.', 'Now I live on my own.'],
    D: ['When cubs are two and a half years old, they leave their mother.', 'Mum walks off over the ice, and so do I.', 'I am a young bear on my own now.'],
    E: ['In the spring when the cubs are about two and a half, the family goes its separate ways.', 'Each young bear wanders off to live on its own.', 'Grown polar bears mostly live alone and wander huge areas of ice.'],
    yesno: [['Am I on my own now?', true], ['Am I a cub?', false]] },
  ridge: { title: 'The ice wall', pic: 'ridge', gate: false,
    A: ['I see ice.', 'I go up.', 'Up, up, up!'],
    B: ['A big wall of ice!', 'I go up and over.', 'Down I go.'],
    C: ['The ice has made a big wall.', 'I climb up and over it.', 'It is a pressure ridge.'],
    D: ['The wind pushes slabs of ice together.', 'They crack and pile up into a long wall of ice blocks.', 'It is called a pressure ridge.'],
    E: ['Where the wind pushes slabs of sea ice together, they crack and pile up.', 'The long walls of ice blocks are called pressure ridges.', 'Snow drifts up behind them, and seals sometimes make dens there.'],
    yesno: [['Is it a wall of ice?', true], ['Is it a tree?', false]] },
  spar: { title: 'Play-sparring', pic: 'spar', gate: false,
    A: ['I see bears.', 'We play!', 'Push, push, push!'],
    B: ['Two big bears play.', 'They stand up and push.', 'I play too!'],
    C: ['Two young bears stand up tall.', 'They push and wrestle, but they do not get hurt.', 'I join in!'],
    D: ['Young male bears play-fight on the ice.', 'They stand up on their back legs and push with their mouths open wide.', 'Nobody gets hurt: it is how they test their strength.'],
    E: ['Young males and big males play-fight: they stand up, push and wrestle.', 'Their mouths are wide open, but nobody gets hurt.', 'It is how they test their strength.'],
    yesno: [['Do the bears play?', true], ['Do the bears get hurt?', false]] },
  mate: { title: 'A walk together', pic: 'mate', gate: false,
    A: ['I see a bear!', 'Hi! Hi!', 'We go, go, go.'],
    B: ['Look! A bear like me.', 'Hi! We sniff.', 'We go on the ice.'],
    C: ['I follow a smell across the ice.', 'I find another bear.', 'We walk together for a while.'],
    D: ['In spring I follow a scent trail across the ice.', 'I meet another grown bear, nose to nose.', 'We walk together for a while, then go our own ways.'],
    E: ['In spring a male follows a female\'s scent trail across the ice.', 'They walk together for a week or two, then each goes its own way.', 'The mother will raise the cubs on her own.'],
    yesno: [['Did I find a bear?', true], ['Did I find a whale?', false]] },
  den: { title: 'Digging the den', pic: 'den', gate: false,
    A: ['I dig.', 'I dig, dig, dig.', 'I dig a den.'],
    B: ['I dig into the hill.', 'Dig, dig, dig!', 'It is a den for my cubs.'],
    C: ['It is autumn. I dig a den into the hill.', 'A long way in, and a round room.', 'My cubs will be born here.'],
    D: ['In autumn I go back to the hills where I was born.', 'I dig a tunnel and a round room into the soft bank.', 'Snow will cover it all winter.'],
    E: ['In autumn a mother-to-be goes ashore to dig her den.', 'She digs a tunnel and a round room in a snowdrift or a bank of peat.', 'Some dens in Canada have been used for hundreds of years.'],
    yesno: [['Do I dig a den?', true], ['Is the den in a tree?', false]] },
  nurse: { title: 'Milk', pic: 'milk', gate: false,
    A: ['My cubs drink.', 'Drink, drink, drink.'],
    B: ['My cubs are little.', 'They drink my milk.', 'Then they sleep.'],
    C: ['My cubs can not see yet.', 'They find me and drink my milk.', 'Then they sleep on my warm fur.'],
    D: ['My cubs were born in the middle of winter.', 'They are tiny, and they can not see yet.', 'I stay in the den with them, day and night.'],
    E: ['All winter in the den, the mother eats nothing.', 'She lives on her fat and makes rich milk for her cubs.', 'In spring she will break open the den.'],
    yesno: [['Do the cubs drink milk?', true], ['Do the cubs eat grass?', false]] },
  cubs: { title: 'New cubs', pic: 'cubs', gate: true,
    A: ['I see cubs!', 'Little cubs!', 'We sniff.'],
    B: ['The cubs are here!', 'Two little cubs.', 'They come out of the den.'],
    C: ['It is spring. The den is open.', 'Two little cubs come out into the snow.', 'It all begins again!'],
    D: ['Two cubs come out of a snow den into the spring sun.', 'They are tiny, just like I was.', 'Soon they will play, slide and sniff the wind.'],
    E: ['In spring two new cubs come out of a den into the bright snow.', 'Newborn, cub, yearling, young bear, grown bear: that is the whole life of a polar bear.', 'And now it all begins again.'],
    yesno: [['Are the cubs little?', true], ['Are the cubs big bears?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'born', firstPlay: 'play', firstWindSniff: 'sniffwind', slideStart: 'slide', foxNear: 'fox', firstTrack: 'tracks', storm: 'blizzard', onIce: 'seaice', stillStart: 'wait', stalkStart: 'stalk', feast: 'meal', lostMum: 'lost', swimStart: 'swim', scientistMet: 'scientist', firstPounce: 'pounce', firstSniff: 'nose', aurora: 'aurora', freezeUp: 'freeze', ridge: 'ridge', sparStart: 'spar', met: 'mate', digStart: 'den', firstNurse: 'nurse' };

/* ---------- read-and-do missions ----------
   who: newborn · cub (by the den) · trek (the walk to the sea) · ice (the spring sea ice) · shore (summer on land)
        · yearling (back on the ice with Mum) · alone (on your own) · den (a grown girl digging her den)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'drink', who: 'newborn', A: 'Drink, drink, drink!', B: 'Drink milk from Mum.', C: 'Drink milk three times.', D: 'Go to Mum and drink three times.', E: 'Find your mum and drink her milk three times.' },
  { key: 'play', who: 'cub', A: 'Play!', B: 'Play with your twin.', C: 'Play with your twin in the snow.', D: 'Find your twin and play.', E: 'Find your twin and start a play-fight.' },
  { key: 'sniffwind', who: 'cub', from: 'B', A: 'Sniff!', B: 'Stand up and sniff!', C: 'Stand up and sniff the wind.', D: 'Stand up on your back legs and sniff.', E: 'Stand up on your back legs and sniff the wind.' },
  { key: 'slide', who: 'cub', A: 'Slide!', B: 'Slide down the hill.', C: 'Slide down the snowy hill.', D: 'Go up and slide down the hill.', E: 'Slide down the snowy hill on your tummy.' },
  { key: 'fox', who: 'cub', A: 'Go to the fox.', B: 'Go and see the fox.', C: 'Go up to the fox.', D: 'Walk up to the fox and see what it does.', E: 'Creep up to the Arctic fox and watch it run off.' },
  { key: 'follow', who: 'trek', A: 'Go to Mum.', B: 'Run to Mum.', C: 'Go and walk with Mum.', D: 'Catch up with Mum and walk behind her.', E: 'Catch up with Mum and walk right behind her.' },
  { key: 'track', who: 'trek', from: 'B', A: 'Look at tracks.', B: 'Find some tracks.', C: 'Find tracks and look at them.', D: 'Find some tracks and read them.', E: 'Find a set of tracks and work out who made them.' },
  { key: 'rock', who: 'trek', A: 'Go to the rock.', B: 'Go to the big rock.', C: 'Go and lie down by the rock.', D: 'Find the big rock and get out of the wind.', E: 'Find the big rock and curl up out of the wind.' },
  { key: 'wait', who: 'ice', A: 'Wait!', B: 'Sit by the hole.', C: 'Wait by the seal hole.', D: 'Wait very still by the seal hole.', E: 'Wait by a breathing hole and keep very still.' },
  { key: 'creep', who: 'ice', A: 'Creep!', B: 'Creep up on the seal.', C: 'Creep up on the seal. Stop when it looks!', D: 'Creep up on the seal while its head is down.', E: 'Creep up on the resting seal, and freeze when it looks.' },
  { key: 'swim', who: 'ice', A: 'Swim!', B: 'Swim in the water.', C: 'Swim to the next ice.', D: 'Jump in and swim across the water.', E: 'Swim all the way across the icy water.' },
  { key: 'pounce', who: 'shore', A: 'Pounce!', B: 'Pounce on a lemming.', C: 'Pounce on a lemming. Hop!', D: 'Creep up to a lemming and pounce.', E: 'Creep up to a lemming and pounce. It will get away!' },
  { key: 'sniff', who: 'shore', A: 'Sniff!', B: 'Sniff a smell.', C: 'Sniff a smell.', D: 'Find a scent on the wind and sniff it.', E: 'Walk into a scent on the wind and sniff it to learn who went by.' },
  { key: 'wave', who: 'shore', A: 'Hi!', B: 'Go to the buggy.', C: 'Go and say hi to the buggy.', D: 'Find the scientists in the buggy and wave.', E: 'Find the scientists in their tundra buggy and wave hello.' },
  { key: 'solo', who: 'yearling', A: 'Wait!', B: 'Wait by a hole.', C: 'Wait by a hole by yourself.', D: 'Find your own seal hole and wait.', E: 'Find a breathing hole of your own and wait beside it.' },
  { key: 'spar', who: 'alone', A: 'Play!', B: 'Play with the big bears.', C: 'Go and play with the young bears.', D: 'Find the young bears and play-fight.', E: 'Find the young males on the ice and join in.' },
  { key: 'dig', who: 'den', A: 'Dig, dig, dig!', B: 'Dig a den.', C: 'Dig a den in the hill.', D: 'Dig a den into the soft bank.', E: 'Dig a den into the soft bank for your cubs.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  born: { A: 'I am a cub.', B: 'I am a new cub. It is dark.', C: 'I am a new cub. It is dark. Mum is warm.', D: 'I am a newborn cub. It is dark. Mum is warm.', E: 'I am a newborn cub in a snow den. My mum is warm.' },
  drink: { A: 'Drink the milk!', B: 'Go to Mum. Drink the milk!', C: 'Go to Mum and drink her milk.', D: 'Wiggle to Mum and drink her milk.', E: 'Wiggle to your mum and drink her milk.' },
  eyes: { A: 'I see!', B: 'My eyes are open!', C: 'My eyes are open! Drink more.', D: 'My eyes are open! Keep drinking and growing.', E: 'My eyes are open! Blue snow walls. Keep drinking and growing.' },
  crawl: { A: 'Drink milk!', B: 'Wiggle! Drink milk!', C: 'Wiggle to Mum and drink.', D: 'Wiggle with the arrows. Milk makes me grow.', E: 'Wiggle with the arrows. Milk makes me grow.' },
  out: { A: 'Go up! Go out!', B: 'Go out of the den!', C: 'Go up and out of the den.', D: 'Spring! Climb up and out of the den.', E: 'Spring! Mum broke open the den. Climb out into the light.' },
  play: { A: 'Play!', B: 'Go and play!', C: 'Go to my twin and play.', D: 'Go to my twin and play.', E: 'My twin wants to play! Go and start a game.' },
  playfight: { A: 'Push, push, push!', B: 'Push, push, push!', C: 'Push! Then a big push!', D: 'Push! When it is green, push hard!', E: 'Push, and when the ring is green, give a big push!' },
  won: { A: 'Yes, yes, yes!', B: 'I win! Roll, roll!', C: 'I won! Roll in the snow!', D: 'I won the play-fight! Nobody got hurt.', E: 'I won the play-fight! A roll in the snow, nobody hurt.' },
  lost: { A: 'No! Play, play!', B: 'Oops! Play again.', C: 'I fell over. Play again!', D: 'I rolled over in the snow. Up I get!', E: 'I rolled over in the snow. Up I get, and play again!' },
  sniffwind: { A: 'Sniff!', B: 'Hold E to sniff!', C: 'Hold E to stand up and sniff.', D: 'Hold E to stand up and sniff the wind.', E: 'Hold E to stand up on my back legs and sniff the wind.' },
  slide: { A: 'Slide!', B: 'Slide down!', C: 'A snowy hill! Slide down.', D: 'A snowy hill! Face down it and slide.', E: 'A snowy slope! Face down the hill and slide on my tummy.' },
  slid: { A: 'Wheee!', B: 'Wheee!', C: 'Wheee! All the way down.', D: 'Wheee! A tummy slide all the way down.', E: 'Wheee! A belly slide all the way down.' },
  fox: { A: 'A fox!', B: 'A fox! It runs.', C: 'A fox! It runs away.', D: 'An Arctic fox! It runs off when I come near.', E: 'An Arctic fox! It trots off when I come close.' },
  nurse: { A: 'Drink!', B: 'Mum is down. Drink!', C: 'Mum is lying down. Drink!', D: 'Mum is lying down. Go and drink her milk.', E: 'Mum is lying down: time for milk! Go to her and drink.' },
  trek: { A: 'Go with Mum!', B: 'Go with Mum to the sea!', C: 'Follow Mum to the sea ice.', D: 'Mum is leading us to the sea ice. Follow her.', E: 'Mum is leading us to the frozen sea. Follow her!' },
  follow: { A: 'Go, go, go!', B: 'Go to Mum!', C: 'Go this way to Mum.', D: 'Follow the arrow to Mum.', E: 'Keep up with Mum! Follow the arrow.' },
  tracks: { A: 'Look!', B: 'Look at the tracks!', C: 'Tracks! Look at them.', D: 'Tracks! Look at them. Who walked here?', E: 'Footprints in the snow! Look at them. Who walked here?' },
  storm: { A: 'Go to the rock!', B: 'A blizzard! Go to the rock!', C: 'A blizzard! Go to the big rock.', D: 'A blizzard! Get out of the wind by the big rock.', E: 'A blizzard! Get out of the wind behind the big rock and curl up.' },
  shelter: { A: 'Yes!', B: 'Warm here. Good!', C: 'Warm by the rock.', D: 'Snug behind the rock, out of the wind.', E: 'Snug behind the rock. The snow drifts over me like a blanket.' },
  cold: { A: 'Cold! Sleep.', B: 'Brr! Cold! Sit and rest.', C: 'Brr! I am cold. Go to Mum or rest.', D: 'Brr! I am getting cold. Go to Mum, or curl up and rest.', E: 'Brr! I am getting cold. Snuggle up to Mum, or curl up and rest.' },
  rest: { A: 'I sleep.', B: 'I had a warm rest.', C: 'I curled up and had a warm rest.', D: 'I curled up with my nose tucked in.', E: 'I curled up tight with my nose tucked in until I was warm.' },
  seaice: { A: 'I see the ice!', B: 'The sea is ice! Go with Mum.', C: 'The sea ice! Follow Mum.', D: 'The sea ice! Follow Mum out onto it.', E: 'The sea ice! A whole frozen sea. Follow Mum out onto it.' },
  hole: { A: 'A hole! Wait!', B: 'A seal hole! Wait by it.', C: 'A seal hole! Go and wait by it.', D: 'A seal hole! Go next to it and wait.', E: 'A breathing hole! Go next to it and wait.' },
  still: { A: 'Sit! Do not go!', B: 'Sit still. Do not move.', C: 'Keep still. Do not move.', D: 'Keep very still. The seal will come up.', E: 'Keep very still. The seal will come up to breathe.' },
  shh: { A: 'No! Sit!', B: 'Shh! Sit still.', C: 'Shh! Keep still.', D: 'Shh! I moved. Keep still.', E: 'Shh! I moved. Keep very still.' },
  seal: { A: 'A seal! It is gone.', B: 'A seal! It went away.', C: 'A seal! Then it went away.', D: 'Puff! A seal came up, then it slipped away.', E: 'Puff! The seal came up to breathe, then slipped away again.' },
  bask: { A: 'A seal! Creep!', B: 'A seal! Creep up!', C: 'A seal on the ice! Creep up.', D: 'A seal on the ice! Go and creep up on it.', E: 'A seal resting on the ice! Creep up on it.' },
  creep: { A: 'Creep! Stop!', B: 'Creep! It looks? Stop!', C: 'Creep when its head is down.', D: 'Creep when its head is down. Stop when it looks!', E: 'Creep closer while its head is down. Freeze when it looks up!' },
  freezeNow: { A: 'Stop!', B: 'Stop! It looks!', C: 'Stop! It is looking!', D: 'It is looking! Stop!', E: 'It is looking! Freeze!' },
  spotted: { A: 'No! It is gone.', B: 'It saw me! It went away.', C: 'It saw me! Splash!', D: 'It saw me! Splash! It went into its hole.', E: 'It saw me! Splash! Most hunts end like that.' },
  close: { A: 'Yes! It is gone.', B: 'So close! It went away.', C: 'So close! Then splash!', D: 'So close! But the seal slipped into its hole.', E: 'So close! But the seal slipped into its hole. Most hunts end like that.' },
  feast: { A: 'Eat!', B: 'Mum has a meal! Eat!', C: 'Mum found a meal. Go and eat.', D: 'Mum found a meal! Go and eat with her.', E: 'Mum found a meal! Go and eat with her, then sleep it off.' },
  ate: { A: 'Yum! Sleep.', B: 'Yum! I grow.', C: 'Yum! I grew. Now I sleep.', D: 'A big meal! I grew. Now a long sleep.', E: 'A big meal! I grew. Now a long sleep.' },
  lostmum: { A: 'Sniff!', B: 'Where is Mum? Hold E!', C: 'Where is Mum? Hold E to sniff!', D: 'Where is Mum? Hold E to sniff, let go on green!', E: 'A whiteout! Hold E to sniff, and let go when the ring is green!' },
  found: { A: 'Yes! Mum!', B: 'I found Mum!', C: 'I found Mum! She comes back.', D: 'I found her scent! Mum is coming back.', E: 'I found her scent! Mum chuffs and comes back for me.' },
  breakup: { A: 'Swim! Go to the land!', B: 'Go with Mum to the land!', C: 'The ice is breaking! Swim to the land.', D: 'Summer! The ice is breaking up. Follow Mum to the shore.', E: 'Summer! The ice is breaking up. Swim from floe to floe to the shore.' },
  swim: { A: 'Swim!', B: 'Swim, swim!', C: 'Swim! Paddle, paddle!', D: 'Swim! Paddle with my big front paws.', E: 'Swim! Paddle with my big front paws.' },
  lead: { A: 'Water! Swim!', B: 'Water! Swim across.', C: 'A crack in the ice! Swim across.', D: 'A long crack of water in the ice. Swim across!', E: 'A lead: a long crack of water in the ice. Swim across!' },
  shore: { A: 'I see the land.', B: 'We wait on the land.', C: 'The ice is gone. We wait on the land.', D: 'On the shore. We wait here until the sea freezes.', E: 'On the shore. The ice is gone, so we wait on land until it freezes again.' },
  scientist: { A: 'A buggy! Hi!', B: 'A buggy! Say hi!', C: 'A buggy! Go and say hi.', D: 'Scientists in a buggy! Go and wave.', E: 'Scientists in a tundra buggy! They watch from a safe place. Go and wave.' },
  pounce: { A: 'Pounce!', B: 'A lemming! Pounce!', C: 'A lemming! Creep up and pounce.', D: 'A lemming! Creep up slowly and pounce.', E: 'A lemming! Creep up slowly and pounce.' },
  away: { A: 'No! It is gone.', B: 'It got away! Again!', C: 'It got away! Try again.', D: 'It dived into its hole! Try again.', E: 'It dived into its burrow! Most pounces miss. Try again.' },
  sniff: { A: 'Sniff!', B: 'Sniff it!', C: 'A smell! Sniff it.', D: 'A smell on the wind! Walk into it and sniff.', E: 'A smell on the wind! Walk into it and sniff.' },
  aurora: { A: 'Look up!', B: 'Look up! Lights!', C: 'Look up! The northern lights!', D: 'Look up! The northern lights are dancing.', E: 'Look up! The northern lights are dancing.' },
  freeze: { A: 'Ice!', B: 'The sea is ice again!', C: 'The sea is freezing again!', D: 'The sea is freezing! Soon we can go on the ice.', E: 'The sea is freezing again! Soon we can walk out onto the ice.' },
  yearling: { A: 'I am one!', B: 'I am one! Back on the ice.', C: 'I am one year old! Back on the ice.', D: 'A yearling! Back on the ice with Mum. Try it myself!', E: 'One year old: a yearling. Back on the sea ice with Mum. Try it myself now!' },
  solo: { A: 'Wait!', B: 'Find a hole and wait!', C: 'Find a hole and wait by it.', D: 'Find my own seal hole and wait, very still.', E: 'Find a breathing hole of my own and wait beside it, very still.' },
  practise: { A: 'Creep!', B: 'Creep up on a seal!', C: 'Now creep up on a seal.', D: 'Now creep up on a seal by myself.', E: 'Now creep up on a resting seal, by myself.' },
  mealtime: { A: 'Eat!', B: 'Mum has a meal! Eat!', C: 'Mum found a meal! Eat!', D: 'Mum found a meal! Go and eat.', E: 'Mum found a meal! Go and eat.' },
  leave: { A: 'Go far!', B: 'Time to go! Go far.', C: 'Time to go on my own.', D: 'I am grown. Time to go on my own.', E: 'Two and a half years old. Mum walks off. I am big enough to go on my own.' },
  alone: { A: 'Go far!', B: 'Go far on the ice!', C: 'On my own now. Go far on the ice.', D: 'A young bear on my own. Go over the ice.', E: 'A young bear on my own. Head out across the ice, past the ice wall.' },
  ridge: { A: 'Go up!', B: 'An ice wall! Go up.', C: 'A wall of ice! Climb over.', D: 'A pressure ridge! Climb over it.', E: 'A pressure ridge: a wall of ice blocks. Climb over!' },
  sparring: { A: 'Bears! Play!', B: 'Two bears play! Go and play.', C: 'Two bears are playing! Go and join in.', D: 'Two young bears play-fighting! Go and join in.', E: 'Two young bears play-fighting! Go and join in.' },
  grown: { A: 'I am big!', B: 'I am a big bear now!', C: 'Years go by. I am a big bear!', D: 'Years go by. I am a grown polar bear!', E: 'Years go by. I am a grown polar bear!' },
  scent: { A: 'Sniff!', B: 'A smell! Hold E!', C: 'A bear smell! Hold E to sniff.', D: 'A bear smell on the wind! Hold E, let go on green.', E: 'Another bear\'s scent on the wind! Hold E to sniff, let go on green.' },
  meet: { A: 'A bear! Hi!', B: 'A bear! Go and say hi.', C: 'There is the bear! Go and say hi.', D: 'There is the other bear! Go and say hi.', E: 'There is the other bear! Go and say hello.' },
  together: { A: 'We go!', B: 'We go on the ice.', C: 'We walk together.', D: 'We walk together for a while.', E: 'We walk together for a while across the ice.' },
  bigmale: { A: 'A big bear! Play!', B: 'A big bear! Play!', C: 'A big bear! Stand up and play.', D: 'A big male! Stand up and play-fight.', E: 'A big male! Stand up and play-spar.' },
  summer: { A: 'I see the land.', B: 'Summer! Rest on the land.', C: 'Summer on the shore. Rest and wait.', D: 'Summer on the shore. Rest and wait for the ice.', E: 'Summer on the shore with the other big bears. Rest and wait for the ice.' },
  denhill: { A: 'Go to the hill!', B: 'Go to the hill! Dig a den.', C: 'Go back to the hill and dig a den.', D: 'Autumn. Go back to the hills and dig a den.', E: 'Autumn. Go back to the hills where I was born and dig a den.' },
  den: { A: 'Dig!', B: 'Dig a den! Go down.', C: 'Dig a den. Push down.', D: 'Push down on the soft bank to dig a den.', E: 'Push down on the soft bank to dig my den.' },
  dig: { A: 'Dig, dig, dig!', B: 'Dig into the hill!', C: 'Dig into the hill.', D: 'Dig into the bank. A den needs a tunnel.', E: 'Dig into the bank. A den needs a tunnel and a round room.' },
  rock: { A: 'No! It is a rock.', B: 'Too hard! Dig here?', C: 'Too hard! Find the soft bank.', D: 'Too hard to dig here. Find the soft bank.', E: 'This is too hard to dig. Find the soft bank.' },
  denready: { A: 'Dig!', B: 'Make the den!', C: 'Deep enough! Make the den.', D: 'Deep enough! Make the den room.', E: 'Deep enough! Make the round room.' },
  outden: { A: 'Go up!', B: 'Go up and out!', C: 'Go up and out of the den.', D: 'Push up to climb out of the den.', E: 'Push up to climb out of the den.' },
  inside: { A: 'Cubs! Feed!', B: 'My cubs! Feed them.', C: 'My cubs are born! Feed them milk.', D: 'My cubs are born! Tiny and hungry. Feed them milk.', E: 'Midwinter. My cubs are born! Tiny, blind and hungry. Feed them.' },
  nursecubs: { A: 'Feed!', B: 'Feed the cubs.', C: 'Let the cubs drink.', D: 'Let the cubs drink my milk.', E: 'Let the cubs drink my milk.' },
  wanderer: { A: 'A cub! Go!', B: 'A cub got out! Go and get it.', C: 'A cub got out! Go and carry it back.', D: 'A cub wobbled up to the den mouth! Carry it back.', E: 'One cub wobbled up to the den mouth! Go and carry it back.' },
  carrying: { A: 'Carry it home!', B: 'Carry the cub home!', C: 'Carry the cub back to the den.', D: 'Carry the cub gently back to the den.', E: 'Carry the cub gently back to the round room.' },
  cubsout: { A: 'Cubs!', B: 'The cubs are out!', C: 'The cubs come out of the den!', D: 'Spring! The cubs come out into the light.', E: 'Spring! I break open the den and the cubs tumble out.' },
  firstsniff: { A: 'Sniff!', B: 'Sniff with the cubs!', C: 'Stand up and sniff with the cubs!', D: 'Stand up with my cubs and hold E. Their first sniff!', E: 'Stand up with my cubs and hold E: their first sniff of the sea wind!' },
  newcubs: { A: 'Cubs!', B: 'New cubs!', C: 'New cubs! The whole life of a bear.', D: 'New cubs in the snow! The whole life of a polar bear.', E: 'New cubs! Newborn, cub, yearling, young bear, grown bear: the whole life of a polar bear.' },
  toofar: { A: 'No! Go to Mum.', B: 'Too far! Go back to Mum.', C: 'Too far! Go back to Mum.', D: 'Too far! Stay near Mum.', E: 'Too far for a little cub! Stay near Mum.' },
  twin: { A: 'I see my twin!', B: 'My twin!', C: 'My twin is here too.', D: 'My twin is here too.', E: 'My twin is here too.' },
  night: { A: 'Night!', B: 'Night! Look at the stars.', C: 'Night. Look at the stars.', D: 'Night. The stars are out over the snow.', E: 'Night. The stars are out over the snow.' }
};
