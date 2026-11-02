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

/* words only Starfish needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'hi big swim hold on out mum yum pull have little glow blue lots of rainbow tight she man he will grow spring ok wet wait safe held back sit still boys rest',
  B: 'hatch so yum lots now wiggle off mum top wait again say away find by over into day whoosh ok good grow food way back eat them glow dark under her comes its mouth open dips crawl rest spring tight stand tall wet dry full grew lets sticky pink goes new things bump glows lights from swims gone looks puts counts tip stuck let winter room try splash ate went gently was counted done steep',
  C: 'food old live glows another girl boy more bump swims as eats does safe others cool full try his when stay keep bigger each most tiny taken grown float free ride makes autumn wave push clean bit times came kept job rainbow things change changes tip grows nobody wiggles flat eggs pink pools pool hold holds tall stands crawls crawled gold soon fly ten legs young hurt hard opens animals make flash school tumble but comb drifts grey long bus pushes lifts take home count gets crash hot milky low hairs ah opened rolled thank life hearts drift or',
  D: 'carries touch salty spike half crawl onto small took place hand wide moment right flash light school world drifts along free inside huge season millions leave ready carry around follow arrow enough growing tummy strong storms calm weeks smaller stronger hairs bottom holes quick comb shining drifters often goes shallow stays drift spiky dinner something drifted behind whole thousands grain sand three sticky cloud clouds tall settle hold holds lets same take through tumbles turn visit gently clear glass beat use rocky shore five hundreds tube work twice wind rolls shut tired many bare move everyone ochre plate bed their own bumps nights sparkle rushes past even rows beating shine north deeper flies otters give pooling scientists year square wedges brings biggest crashes warmer together tips meet bits sink your before arrows tumbled going drying made coming sunflower looking gentle found moves counting measured got',
  E: 'mother stands edge once body stretch wriggle swimming thousands together five across baby reach each hatches touches starts own called bioluminescence sweeps past places pump looking begins people low salt hurt hundred hundreds munch chase drifts than year their bumps near coming towards seabird hello job done beating rows surface choose decided stomach temperature curious forest kelp shelter crevice remember eight animals slowly especially moves beside different slim edges few return let far urchins gentle gently carefully plankton metres measures whale wave gull herring jelly settle grip holding if longer meal never nothing pacific pulls size were whales bands sweep older armed completely used pinhead walks pumps tubes foot sucker end much falls leaves waits worlds left outer coast hardly pushed may twenty years silver schools blob shimmer washington summer feed dip snatch safer almost impossible poolers closely animal helpers measure shores check how doing takes months less warms bloom gather meets start sky catch plates drifting dipping passing packed washed getting press budge lifted moving wedged gathering standing'
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
  star: 'star', stars: 'star', starfish: 'star', egg: 'egg', eggs: 'eggs', baby: 'larva', babies: 'larva', larva: 'larva', larvae: 'larva',
  sea: 'sea', ocean: 'sea', water: 'water', tide: 'tide', wave: 'wave', waves: 'wave', storm: 'storm', plankton: 'plankton', plant: 'diatom', plants: 'diatom', diatom: 'diatom', diatoms: 'diatom',
  jelly: 'combjelly', whale: 'whale', fish: 'herring', herring: 'herring', bird: 'gull', gull: 'gull', gulls: 'gull', otter: 'otter',
  rock: 'rock', rocks: 'rock', pool: 'pool', pools: 'pool', crack: 'rest', kelp: 'kelp', seaweed: 'rockweed', rockweed: 'rockweed',
  crab: 'crab', crabs: 'crab', mussel: 'mussel', mussels: 'mussel', barnacle: 'barnacle', barnacles: 'barnacle', limpet: 'limpet', limpets: 'limpet',
  snail: 'snail', snails: 'snail', chiton: 'chiton', chitons: 'chiton', shell: 'shell', shells: 'shell', anemone: 'anemone', anemones: 'anemone', urchin: 'urchin', urchins: 'urchin',
  arm: 'arm', arms: 'arm', feet: 'feet', eye: 'eye', eyes: 'eye', stomach: 'stomach', sun: 'sun', moon: 'moon', cloud: 'cloud',
  child: 'kid', kid: 'kid', scientist: 'scientist', girl: 'girl', girls: 'girl'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:    { A: 'eat',     B: 'eat it',        C: 'eat it up',             D: 'pull it open and eat',       E: 'Pull it open and eat it. Yum!' },
  settle: { A: 'hold on', B: 'hold on here',  C: 'hold on to the rock',   D: 'hold on to the pink rock',   E: 'Hold on to the pink rock. This is my home.' },
  rest:   { A: 'sleep',   B: 'rest',          C: 'rest and grow',         D: 'rest in the pool to grow',   E: 'Rest here where it is safe, and grow.' },
  count:  { A: 'sit',     B: 'sit still',     C: 'keep still',            D: 'keep still to be counted',   E: 'Keep still so the scientist can count me.' },
  meet:   { A: 'hi',      B: 'say hi',        C: 'go and say hi',         D: 'say hi to the sea stars',    E: 'Crawl over and say hello.' },
  arch:   { A: 'up',      B: 'stand tall',    C: 'stand up tall',         D: 'stand tall on my arms',      E: 'Stand tall on my arm tips and let them go.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'mussel', settle: 'pink', rest: 'rest', count: 'scientist', meet: 'mate', arch: 'spawn' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the sea star's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'An egg in the sea', pic: 'eggs', gate: false,
    A: ['I am an egg.', 'I am in the sea.', 'I see my mum.'],
    B: ['I am a little egg.', 'Mum has lots of eggs.', 'She lets them go in the sea.'],
    C: ['I am a little egg.', 'My mum stands tall on a rock.', 'She lets lots and lots of eggs go in the sea.'],
    D: ['My mum is a big sea star.', 'In spring she stands tall on her arms.', 'Millions of eggs drift away on the tide.'],
    E: ['A mother sea star stands tall on her arm tips in spring.', 'She lets millions of eggs go into the sea.', 'Each egg is smaller than a grain of sand.'],
    yesno: [['Am I an egg?', true], ['Am I a big star?', false]] },
  hatch: { title: 'Hatch!', pic: 'larva', gate: true,
    A: ['I am out!', 'I am a baby.', 'I can swim.'],
    B: ['I wiggle and wiggle.', 'I hatch out!', 'I am a little baby.'],
    C: ['I wiggle and hatch out of my egg.', 'I do not look like a star.', 'I am a baby that can swim!'],
    D: ['I hatch out of my egg.', 'I am a tiny larva, as clear as glass.', 'I swim with little hairs that beat and beat.'],
    E: ['A baby sea star does not look like a star at all.', 'It is a see-through larva that swims with bands of tiny beating hairs.', 'It drifts out to sea with the plankton.'],
    yesno: [['Can I swim?', true], ['Do I look like a star?', false]] },
  larva2: { title: 'Bigger!', pic: 'plankton', gate: true,
    A: ['I eat, eat, eat.', 'I am big!'],
    B: ['I eat the little plants.', 'I grow and grow!', 'Now I am big.'],
    C: ['I eat lots of tiny plants.', 'They are green and gold.', 'I grow big!'],
    D: ['I eat diatoms, tiny plants with glass shells.', 'My tummy gets green and full.', 'I grow bigger and bigger.'],
    E: ['A sea star larva eats the tiny plants of the plankton.', 'The beating hairs sweep the food into its mouth.', 'It swims and eats for weeks.'],
    yesno: [['Do I eat plants?', true], ['Do I eat rocks?', false]] },
  larva3: { title: 'Sticky arms', pic: 'postlarva', gate: true,
    A: ['Look at me!', 'I have arms.'],
    B: ['Look at me now!', 'I have three little arms.', 'They are sticky!'],
    C: ['Three little arms grow on me.', 'They are sticky.', 'Soon I can hold on to a rock.'],
    D: ['Three sticky arms grow at my front.', 'I will use them to hold on to a rock.', 'A tiny star grows inside me!'],
    E: ['The older larva grows three little sticky arms at its front.', 'It will use them to hold on when it touches a rock.', 'A tiny five armed star is growing inside it.'],
    yesno: [['Do I have sticky arms?', true], ['Am I a fish?', false]] },
  postlarva: { title: 'Back to the rocks', pic: 'postlarva', gate: true,
    A: ['Go to the rocks!', 'Go, go, go!'],
    B: ['I am big now.', 'I swim back to the rocks.'],
    C: ['I am big now.', 'I want to go back to the rocks.', 'I swim and swim.'],
    D: ['After weeks at sea, I am ready to settle.', 'I swim back to the rocky shore.', 'I must find a good rock.'],
    E: ['After weeks in the plankton, the larva is ready to settle.', 'It swims back towards the rocky shore.', 'It is looking for a good pink rock.'],
    yesno: [['Do I go to the rocks?', true], ['Do I fly to the sun?', false]] },
  settle: { title: 'A tiny star', pic: 'juvenile', gate: true,
    A: ['I see a rock.', 'I hold on!', 'I am a star!'],
    B: ['Here is a pink rock.', 'I hold on tight.', 'Now I am a little star!'],
    C: ['I find a pink rock.', 'I hold on with my sticky arms.', 'I change. I am a tiny star!'],
    D: ['I find a pink rock that nobody is on.', 'I hold on with my sticky arms and change.', 'Now I am a tiny star with five arms.'],
    E: ['The larva holds on to a pink rock and changes completely.', 'The tiny star inside grows out, and the rest is used up.', 'The new sea star is smaller than a pinhead.'],
    yesno: [['Am I a star now?', true], ['Do I have ten arms?', false]] },
  tiny: { title: 'My little feet', pic: 'feet', gate: false,
    A: ['I am little.', 'I go, go, go.'],
    B: ['I have lots of little feet.', 'I crawl on the rock.'],
    C: ['I have lots of tiny feet.', 'They hold on to the rock.', 'I crawl to find food.'],
    D: ['Under my arms are hundreds of tube feet.', 'They work with sea water.', 'I crawl and hold on with them.'],
    E: ['A sea star walks on hundreds of tube feet at once.', 'Sea water pumps through tubes inside its body to work them.', 'Each foot has a little sucker at the end.'],
    yesno: [['Do I have lots of feet?', true], ['Do I have two legs?', false]] },
  young: { title: 'A young star', pic: 'young', gate: true,
    A: ['I am big!', 'I can eat.'],
    B: ['I rest and grow.', 'Now I am a big star.', 'I can go up the rocks!'],
    C: ['I rest in a pool and grow.', 'Now I am a young sea star.', 'I go up the rocks to eat.'],
    D: ['I rest in a safe place and grow.', 'Now I am a young sea star.', 'When the sea comes in, I crawl up to eat.'],
    E: ['The young sea star has grown much bigger.', 'Now it crawls up the rocks when the tide comes in.', 'It eats barnacles, limpets and snails.'],
    yesno: [['Am I bigger now?', true], ['Am I an egg?', false]] },
  lowtide: { title: 'The tide goes out', pic: 'pool', gate: false,
    A: ['The sea is out.', 'I go in a pool.'],
    B: ['The sea goes out.', 'I get dry!', 'I go in a pool.'],
    C: ['Two times a day the sea goes out.', 'The rocks get dry.', 'I hide in a pool to stay wet.'],
    D: ['Twice a day the tide goes out.', 'The sun and wind can dry me out.', 'A tide pool keeps me cool and wet.'],
    E: ['Twice a day the tide falls and leaves the rocks in the air.', 'A sea star holds its water in and waits.', 'Tide pools are little worlds of sea water left behind.'],
    yesno: [['Does the sea go out?', true], ['Is a pool dry?', false]] },
  waves: { title: 'Hold on!', pic: 'wave', gate: false,
    A: ['A big wave!', 'I hold on.'],
    B: ['Here comes a big wave!', 'I hold on tight.', 'I am OK!'],
    C: ['A big wave comes in.', 'I hold on with all my feet.', 'The wave goes over me.'],
    D: ['Big waves crash on the rocks.', 'I hold on tight with all my tube feet.', 'The wave rolls right over me.'],
    E: ['Waves crash hard on the outer coast.', 'A sea star holds on so tight that people can hardly pull it off.', 'The wave rolls right over it.'],
    yesno: [['Do I hold on?', true], ['Do waves hurt me?', false]] },
  mussel: { title: 'Pull, pull, pull', pic: 'mussel', gate: false,
    A: ['I see a mussel.', 'Pull, pull, pull!'],
    B: ['Here is a mussel.', 'I pull and pull.', 'It is open! Yum!'],
    C: ['A mussel has a hard shell.', 'I pull and pull with my feet.', 'It opens a bit. I eat it!'],
    D: ['A mussel holds its shell shut.', 'I pull and pull with my tube feet until it gets tired.', 'Then I push my tummy in and eat!'],
    E: ['The sea star pulls the mussel open just a tiny crack.', 'Then it pushes its own stomach out, into the shell.', 'It eats the mussel right there.'],
    yesno: [['Do I eat mussels?', true], ['Do I eat the shell?', false]] },
  keystone: { title: 'Room for everyone', pic: 'keystone', gate: false,
    A: ['I eat. I eat.', 'Look at the rock!'],
    B: ['I eat lots of mussels.', 'Look! New things grow.'],
    C: ['I eat lots of mussels.', 'Now there is room on the rock.', 'New plants and animals come to live here.'],
    D: ['I eat so many mussels that bare rock opens up.', 'Anemones, barnacles and seaweed move in.', 'Sea stars make room for everyone.'],
    E: ['A scientist took the sea stars away from one shore.', 'The mussels took over and pushed the other animals out.', 'With the sea stars there, there is room for everyone.'],
    yesno: [['Do I make room for others?', true], ['Do I eat the rocks?', false]] },
  adult: { title: 'A big sea star', pic: 'adult', gate: true,
    A: ['I am big!', 'I am a star!'],
    B: ['I rest and grow.', 'Now I am a big star!', 'I eat the mussels.'],
    C: ['I am a big sea star now.', 'I live on the rocks with the mussels.', 'I eat and eat.'],
    D: ['Now I am a big ochre sea star.', 'I am as wide as a big plate.', 'The mussel bed is my home.'],
    E: ['A big ochre sea star can grow as wide as a dinner plate.', 'It may live for twenty years or more.', 'It eats mussels, barnacles, limpets and snails.'],
    yesno: [['Am I a big star?', true], ['Am I a baby?', false]] },
  glow: { title: 'Glowing sea', pic: 'plankton', gate: false,
    A: ['I see it glow!', 'It is blue.'],
    B: ['It is night.', 'I bump a plant.', 'It glows blue!'],
    C: ['At night some plankton glow.', 'I bump them and they flash blue.', 'The sea has little lights!'],
    D: ['Some plankton make their own light.', 'When something bumps them, they flash blue.', 'On dark nights the sea can sparkle.'],
    E: ['Some plankton flash blue light when something bumps them.', 'This is called bioluminescence.', 'On dark nights the whole sea can sparkle with it.'],
    yesno: [['Do some plankton glow?', true], ['Is the glow red?', false]] },
  herring: { title: 'Fish!', pic: 'herring', gate: false,
    A: ['Fish!', 'I see lots of fish.'],
    B: ['Here come the fish!', 'They swim fast.', 'Whoosh! I am OK!'],
    C: ['A big school of fish swims by.', 'They push me away.', 'I tumble, but I am OK.'],
    D: ['A school of herring rushes past.', 'The fish do not even see me.', 'I tumble along, but I am safe.'],
    E: ['Pacific herring swim in huge silver schools and eat plankton.', 'A tiny larva gets tumbled about by them.', 'Nothing is hurt.'],
    yesno: [['Are there lots of fish?', true], ['Do the fish eat me?', false]] },
  combjelly: { title: 'A rainbow jelly', pic: 'combjelly', gate: false,
    A: ['A jelly!', 'It is a rainbow.'],
    B: ['I see a jelly.', 'It has rainbow lights.', 'I swim away from it.'],
    C: ['A comb jelly drifts by.', 'It has little rainbow lights.', 'I keep away from it.'],
    D: ['A comb jelly has rows of tiny beating hairs.', 'They shine like a rainbow.', 'It eats drifters, so I keep away.'],
    E: ['A comb jelly is a see-through blob with eight rows of beating hairs.', 'They shimmer like a rainbow.', 'It eats tiny drifters, so a larva keeps away.'],
    yesno: [['Does the jelly have rainbow lights?', true], ['Is the jelly a fish?', false]] },
  whale: { title: 'A grey whale', pic: 'whale', gate: false,
    A: ['A whale!', 'It is big, big, big.'],
    B: ['Look at the big whale!', 'It swims by me.', 'Whoosh!'],
    C: ['A big grey whale swims by.', 'It is as long as a bus.', 'Its wave pushes me away.'],
    D: ['A grey whale swims past on its way north.', 'It is as long as a bus.', 'The wave it makes tumbles me over.'],
    E: ['Grey whales swim past the Washington coast every spring.', 'Some stay all summer to feed.', 'The wave it makes tumbles the tiny larva over and over.'],
    yesno: [['Is the whale big?', true], ['Is the whale little?', false]] },
  gull: { title: 'A gull', pic: 'gull', gate: false,
    A: ['A bird!', 'I go down.'],
    B: ['A bird dips down.', 'I swim down.', 'It is gone!'],
    C: ['A gull dips down to the top of the sea.', 'I swim down a bit.', 'It does not get me.'],
    D: ['A gull dips down at the top of the sea.', 'I swim a little deeper.', 'It flies away.'],
    E: ['Gulls dip at the top of the sea to snatch small things.', 'A tiny larva is safer a little deeper down.'],
    yesno: [['Can a gull fly?', true], ['Does the gull get me?', false]] },
  visitors: { title: 'Visitors', pic: 'hold', gate: false,
    A: ['I hold on.', 'I hold on tight!'],
    B: ['Here comes a crab.', 'I hold on tight.', 'It goes away.'],
    C: ['A gull, an otter and a crab come by.', 'I hold on tight to the rock.', 'They can not pull me off.'],
    D: ['Gulls, otters and crabs come to look at me.', 'I hold on tight with all my tube feet.', 'They give up and go away.'],
    E: ['A gull, a sea otter or a crab may try to pull a sea star off the rock.', 'A sea star holding tight is almost impossible to move.', 'They give up and go away.'],
    yesno: [['Do I hold on tight?', true], ['Do they hurt me?', false]] },
  kid: { title: 'A tide pooler', pic: 'kid', gate: false,
    A: ['I see a girl.', 'She can see me.'],
    B: ['A girl comes to the pool.', 'She looks at me.', 'She puts me back!'],
    C: ['A girl comes to look in the pool.', 'She lifts me up and looks at me.', 'Then she puts me back.'],
    D: ['A child comes tide pooling at low tide.', 'She lifts me up very gently to look.', 'Then she puts me back just where I was.'],
    E: ['Good tide poolers look closely and touch gently.', 'They put every animal back just where they found it.'],
    yesno: [['Does she put me back?', true], ['Does she take me home?', false]] },
  scientist: { title: 'Counting stars', pic: 'scientist', gate: false,
    A: ['I see a man.', 'He can see me.'],
    B: ['Here is a scientist.', 'He looks at me.', 'He counts the stars.'],
    C: ['A scientist comes to the rocks.', 'He counts all the sea stars.', 'I keep still.'],
    D: ['Scientists count the sea stars every year.', 'They put a square on the rock and count.', 'They want to know the stars are OK.'],
    E: ['Scientists and helpers count and measure sea stars on the same shores every year.', 'They check how the sea stars are doing.'],
    yesno: [['Does he count the stars?', true], ['Does he eat the stars?', false]] },
  armtip: { title: 'A new arm', pic: 'arm', gate: false,
    A: ['My arm!', 'It will grow.'],
    B: ['My arm tip is stuck.', 'I let it go.', 'It will grow back!'],
    C: ['A wave gets my arm tip stuck.', 'I let it go. It does not hurt.', 'A new tip will grow back.'],
    D: ['A big wave wedges my arm tip under a rock.', 'I let it go. It does not hurt a sea star.', 'A new arm tip will grow back.'],
    E: ['A sea star can let an arm tip go if it is stuck.', 'It does not hurt, and a new one grows back.', 'It takes many months.'],
    yesno: [['Will my arm grow back?', true], ['Does it hurt?', false]] },
  winter: { title: 'Winter storms', pic: 'storm', gate: false,
    A: ['Big waves!', 'I hold on.'],
    B: ['It is winter.', 'Big waves come.', 'I hold on tight.'],
    C: ['It is cold winter.', 'Big storm waves crash on the rocks.', 'I hold on and hold on.'],
    D: ['Winter brings the biggest storms.', 'Wave after wave crashes on the rocks.', 'I hold on tight each time.'],
    E: ['Winter brings the biggest storms of the year.', 'Sea stars eat less in winter and hold on tight to the rock.'],
    yesno: [['Do big waves come?', true], ['Is it hot?', false]] },
  spring: { title: 'Spring!', pic: 'spring', gate: false,
    A: ['It is spring!', 'I see stars.'],
    B: ['It is spring.', 'Lots of stars come.', 'I see them.'],
    C: ['It is spring. The sea is green.', 'Lots of sea stars come to the rocks.', 'It is time for eggs!'],
    D: ['In spring the sea gets warmer and green.', 'The sea stars come together on the rocks.', 'It is time for eggs.'],
    E: ['In spring the sea warms and the plankton bloom.', 'The ochre stars gather on the rocks.', 'It is time to let the eggs go.'],
    yesno: [['Is it spring?', true], ['Is it winter?', false]] },
  larvae: { title: 'Millions of eggs', pic: 'spawn', gate: true,
    A: ['I see eggs!', 'Eggs, eggs, eggs!'],
    B: ['I stand tall.', 'The eggs go in the sea.', 'Lots and lots of eggs!'],
    C: ['I stand up tall on my arms.', 'The eggs and a milky cloud go in the sea.', 'Babies will grow!'],
    D: ['I stand tall on my arm tips.', 'Millions of eggs and a milky cloud drift away.', 'When they meet, babies grow.'],
    E: ['The girls let their eggs go and the boys let a milky cloud go.', 'When the cloud meets the eggs, babies start to grow.', 'And so it all begins again.'],
    yesno: [['Do the eggs go in the sea?', true], ['Do I keep the eggs?', false]] }
};

const STORY_TRIGGERS = { started: 'egg', settled: 'tiny', glow: 'glow', herring: 'herring', combJelly: 'combjelly', whale: 'whale', gullDip: 'gull', outOfSea: 'lowtide', held: 'waves', rolled: 'waves', pulling: 'mussel', keystone: 'keystone', predator: 'visitors', kidArrived: 'kid', sciArrived: 'scientist', armTip: 'armtip', winter: 'winter', spring: 'spring' };

/* ---------- read-and-do missions ----------
   who: larva · swim (larva or settler) · post (settler near the bottom) · juvenile (a tiny star)
        · forage (a young or big star crawling) · big (a star big enough for mussels) · low (out of the sea)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'plankton', who: 'larva', A: 'Eat, eat, eat!', B: 'Eat lots of little plants.', C: 'Eat ten tiny plants.', D: 'Eat ten bits of plankton.', E: 'Swim around and eat ten bits of plankton.' },
  { key: 'deep', who: 'swim', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark.' },
  { key: 'top', who: 'swim', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'bottom', who: 'post', A: 'Go to the rocks.', B: 'Swim down to the rocks.', C: 'Dive down to the rocks.', D: 'Sink down to the rocky shore.', E: 'Sink all the way down to the rocky shore.' },
  { key: 'barnacle', who: 'juvenile', A: 'Eat, eat, eat!', B: 'Eat the barnacles.', C: 'Eat three barnacles.', D: 'Find three barnacles and eat them.', E: 'Crawl around and eat three barnacles.' },
  { key: 'crawl', who: 'forage', A: 'Go, go, go!', B: 'Crawl on the rocks.', C: 'Crawl a long way.', D: 'Crawl a long way on your tube feet.', E: 'Crawl a long way across the rocks on your tube feet.' },
  { key: 'limpet', who: 'forage', from: 'B', A: 'Eat a limpet.', B: 'Find a limpet.', C: 'Find a limpet and eat it.', D: 'Find a limpet and pull it off.', E: 'Find a limpet on the rocks and eat it.' },
  { key: 'snail', who: 'forage', A: 'Eat a snail.', B: 'Find a snail.', C: 'Find a snail to eat.', D: 'Find a snail before it rolls away.', E: 'Catch a snail before it lets go and tumbles away.' },
  { key: 'chiton', who: 'forage', from: 'B', A: 'Eat a chiton.', B: 'Find a chiton.', C: 'Find a chiton and eat it.', D: 'Find a chiton to eat.', E: 'Find a chiton with eight plates and eat it.' },
  { key: 'mussel', who: 'big', A: 'Eat a mussel.', B: 'Pull a mussel open.', C: 'Pull a mussel open and eat it.', D: 'Pull a mussel open with your feet.', E: 'Pull a mussel open and push your stomach in.' },
  { key: 'up', who: 'forage', A: 'Go up, up!', B: 'Crawl up the rocks.', C: 'Crawl up the rocks to find food.', D: 'The sea is in. Crawl up the rocks.', E: 'While the tide is in, crawl up the rocks to find food.' },
  { key: 'hold', who: 'forage', A: 'Hold on!', B: 'Hold on tight!', C: 'Hold on tight to the rock.', D: 'Hold on tight with your tube feet.', E: 'Hold on tight with all your tube feet.' },
  { key: 'pool', who: 'low', A: 'Go in a pool.', B: 'Find a pool!', C: 'Find a pool to stay wet.', D: 'Crawl into a tide pool to stay wet.', E: 'Crawl into a tide pool before you dry out.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am an egg in the sea.', D: 'I am an egg. I drift on the tide.', E: 'I am an egg drifting out on the spring tide.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle! Hatch out!', C: 'Wiggle and hatch out!', D: 'Wiggle with the arrows to hatch.', E: 'Push the arrows to wiggle and hatch.' },
  swim: { A: 'Swim! Eat!', B: 'Swim and eat the little plants.', C: 'Swim and eat the tiny plants.', D: 'Swim around and eat the plankton.', E: 'Swim around and eat the tiny diatoms.' },
  grow: { A: 'I am big!', B: 'I grew! I am big.', C: 'I grew bigger!', D: 'I grew! I am a bigger larva now.', E: 'I grew! I am a bigger larva now.' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more plankton to grow.', E: 'Eat more plankton to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Food is at the top.', D: 'At night the plankton swim up to the top.', E: 'At night the plankton swim up near the top.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Food is down low.', D: 'In the day the plankton sink a little.', E: 'In the day the plankton sink a little deeper.' },
  flick: { A: 'Swim, swim!', B: 'Swim fast!', C: 'Swim fast with my hairs.', D: 'My little hairs beat fast to swim.', E: 'My little hairs beat fast to swim away.' },
  herring: { A: 'Fish! Go, go!', B: 'Fish! Swim away!', C: 'Fish! Swim away from them.', D: 'Herring! Swim out of the way.', E: 'Herring are coming! Swim out of the way.' },
  missed: { A: 'I am OK!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  jelly: { A: 'A jelly! Go!', B: 'A jelly! Swim away!', C: 'A jelly! Keep away from it.', D: 'A comb jelly! Keep away from it.', E: 'A comb jelly! Keep well away from it.' },
  gull: { A: 'A bird! Go down!', B: 'A bird! Swim down!', C: 'A bird! Swim down a bit.', D: 'A gull! Dive a little deeper.', E: 'A gull is dipping at the surface! Dive a little deeper.' },
  whale: { A: 'A whale!', B: 'A big whale!', C: 'A big whale! Its wave will push me.', D: 'A grey whale! Its wave will push me along.', E: 'A grey whale is passing! Its wave will push me along.' },
  sticky: { A: 'My arms!', B: 'Sticky arms!', C: 'I have sticky arms!', D: 'Three sticky arms are growing!', E: 'Three sticky arms are growing. Soon I can hold on to a rock.' },
  postlarva: { A: 'Go to the rocks!', B: 'Swim to the rocks!', C: 'Swim back to the rocks.', D: 'Follow the arrow back to the rocks.', E: 'Follow the arrow back to the rocky shore.' },
  search: { A: 'Look! A rock!', B: 'Find a pink rock!', C: 'Find a pink rock. Hold on!', D: 'Find a pink rock that nobody is on.', E: 'Look for a pink rock that nobody is on, and hold on.' },
  taken: { A: 'No! Go, go!', B: 'No room! Try again.', C: 'Mussels are here. Try another.', D: 'No room! Mussels are here. Try another rock.', E: 'No room here! Mussels are packed in. Try another rock.' },
  settle: { A: 'Hold on!', B: 'Hold on here!', C: 'A good rock! Hold on.', D: 'A good pink rock! Hold on to it.', E: 'A good pink rock! Hold on and make it my home.' },
  juvenile: { A: 'I am a star!', B: 'I am a little star! Eat!', C: 'I am a tiny star. Eat the barnacles!', D: 'I am a tiny star. Crawl and eat the barnacles.', E: 'I am a tiny star! Crawl around and eat the baby barnacles.' },
  eat: { A: 'Eat it!', B: 'Food! Eat it!', C: 'Go to the food and eat it.', D: 'There is food. Go and eat it.', E: 'There is food on the rocks. Go and eat it.' },
  full: { A: 'Go to a pool!', B: 'Full! Rest in a pool.', C: 'I am full. Rest in a pool.', D: 'I am full. Rest in a pool or a crack.', E: 'I am full. Crawl into a pool or a crack and rest.' },
  rest: { A: 'Sleep!', B: 'Rest!', C: 'Rest and grow.', D: 'Rest here and grow.', E: 'This is a safe place. Rest and grow.' },
  resting: { A: 'I sleep.', B: 'I rest and grow.', C: 'I rest. I grow.', D: 'I rest and grow bigger.', E: 'I rest in a safe place and grow bigger.' },
  awake: { A: 'I am big!', B: 'I grew big!', C: 'I grew big! Go and eat.', D: 'I grew bigger. Go and find food.', E: 'I grew bigger than before. Go and find food.' },
  young: { A: 'Go up!', B: 'Crawl up! Eat!', C: 'The sea is in. Crawl up to eat.', D: 'When the sea is in, crawl up to eat.', E: 'When the tide is in, crawl up the rocks to find food.' },
  tidein: { A: 'Go up!', B: 'The sea is in! Go up!', C: 'The sea is in! Crawl up to eat.', D: 'The tide is in! Crawl up to the food.', E: 'The tide is coming in! Crawl up the rocks to the food.' },
  tideout: { A: 'Go in a pool!', B: 'The sea goes out! Find a pool!', C: 'The sea goes out. Find a pool!', D: 'The tide is going out. Find a pool or wet seaweed.', E: 'The tide is going out! Find a pool or wet seaweed before you dry.' },
  dry: { A: 'Go in a pool!', B: 'Dry! Go to a pool!', C: 'I am dry! Go to a pool.', D: 'I am drying out! Follow the arrow to a pool.', E: 'I am drying out! Follow the arrow to a tide pool.' },
  wet: { A: 'Yes! Wet!', B: 'Wet again!', C: 'Ah, a cool pool. Wet again.', D: 'Ah, a cool pool. I am wet again.', E: 'Ah, a cool tide pool. I am wet again.' },
  curl: { A: 'I wait.', B: 'Too dry! I wait.', C: 'Too dry! I wait for a wave.', D: 'Too dry! I hold my water in and wait.', E: 'Too dry! I hold my water in and wait for a wave.' },
  splash: { A: 'Wet!', B: 'Splash! Wet again!', C: 'Splash! A wave! I am wet.', D: 'Splash! A wave made me wet again.', E: 'Splash! A wave washed over me. Wet again!' },
  toodry: { A: 'Wait!', B: 'Wait for the sea!', C: 'Wait for the sea to come in.', D: 'The mussels are shut. Wait for the tide.', E: 'The mussels are shut tight in the air. Wait for the tide.' },
  mussel: { A: 'Pull!', B: 'A mussel! Pull!', C: 'A mussel! Pull it open.', D: 'A mussel! Pull its shell open.', E: 'A mussel! Pull its shell open with my tube feet.' },
  pulling: { A: 'Pull, pull!', B: 'Pull, pull, pull!', C: 'Pull and pull and pull.', D: 'Pull and pull. The mussel gets tired.', E: 'Pull, pull, pull. The mussel is getting tired.' },
  stomach: { A: 'Yum!', B: 'Yum! I ate it!', C: 'It opened! Yum!', D: 'It opened! I push my tummy in. Yum!', E: 'It opened! I push my stomach in to eat. Yum!' },
  hold: { A: 'Hold on!', B: 'A wave! Hold on!', C: 'A big wave! Hold on tight.', D: 'A big wave is coming! Hold on tight.', E: 'A big wave is coming! Press to hold on tight.' },
  held: { A: 'Yes! I am OK!', B: 'I held on!', C: 'I held on! The wave went over me.', D: 'I held on! The wave rolled right over me.', E: 'I held on! The wave rolled right over me.' },
  rolled: { A: 'I am OK!', B: 'Whoosh! I am OK!', C: 'Whoosh! I rolled. I am OK.', D: 'Whoosh! I rolled down, but I am OK.', E: 'Whoosh! The wave rolled me off. Nothing is hurt.' },
  gulllow: { A: 'A bird! Hold on!', B: 'A bird! Hold on tight!', C: 'A gull! Hold on tight.', D: 'A gull! Hold on tight or get in a pool.', E: 'A gull! Hold on tight, or get into a pool.' },
  otter: { A: 'An otter! Hold on!', B: 'An otter! Hold on tight!', C: 'An otter! Hold on tight.', D: 'A sea otter! Hold on tight to the rock.', E: 'A sea otter! Hold on tight to the rock.' },
  sunflower: { A: 'A big star! Go!', B: 'A big star! Go away!', C: 'A big star! Crawl away fast.', D: 'A sunflower star! Crawl away fast.', E: 'A sunflower star! It is big and fast. Crawl away!' },
  escaped: { A: 'I am safe!', B: 'Safe! It went away.', C: 'It went the other way. Safe!', D: 'It went the other way. I am safe.', E: 'It went the other way. I am safe.' },
  crab: { A: 'A crab! Hold on!', B: 'A crab! Hold on tight!', C: 'A crab! Hold on tight.', D: 'A crab is looking around. Hold on tight.', E: 'A red rock crab is looking around. Hold on tight.' },
  dodged: { A: 'I held on!', B: 'I held on tight!', C: 'It can not pull me off!', D: 'It could not pull me off the rock!', E: 'It could not budge me. I held on tight!' },
  kid: { A: 'A girl! Hi!', B: 'A girl looks at me!', C: 'A girl looks in the pool.', D: 'A child is tide pooling. She will be gentle.', E: 'A child is tide pooling! She looks gently and will put me back.' },
  lifted: { A: 'Up I go!', B: 'Up I go! Gently.', C: 'She lifts me up to look.', D: 'She lifts me up very gently to look.', E: 'Lifted up to look at, gently, gently.' },
  putback: { A: 'I am back!', B: 'Back in my pool!', C: 'She put me back. Thank you!', D: 'She put me back where she found me.', E: 'Put back right where she found me. Thank you!' },
  keystone: { A: 'Look at the rock!', B: 'Look! New things!', C: 'Look! There is room for new life.', D: 'I ate lots of mussels. New life moves in!', E: 'I ate lots of mussels. Look: bare rock, and new life moving in!' },
  adult: { A: 'I am big!', B: 'I am big! Eat mussels!', C: 'I am a big star. Eat mussels.', D: 'I am a big sea star. Eat the mussels.', E: 'I am a big sea star! Eat mussels and make room for new life.' },
  scientist: { A: 'Sit still!', B: 'A scientist! Sit still!', C: 'A scientist! Keep still.', D: 'A scientist is counting. Keep still.', E: 'A scientist is counting sea stars. Keep still.' },
  counted: { A: 'Yes!', B: 'I was counted!', C: 'He counted me!', D: 'Counted and measured!', E: 'Counted and measured! Now the scientists know I am here.' },
  winter: { A: 'Hold on!', B: 'Winter! Hold on!', C: 'Winter waves! Hold on each time.', D: 'Winter storm! Hold on each time a wave comes.', E: 'Winter! Big storm waves are coming. Hold on each time.' },
  armtip: { A: 'My arm!', B: 'My arm tip! It will grow back.', C: 'My arm tip let go. It will grow back.', D: 'A wave got my arm tip stuck. I let it go.', E: 'A wave wedged my arm tip, so I let it go. It will grow back.' },
  regrown: { A: 'My arm!', B: 'My arm is back!', C: 'My arm grew back!', D: 'My arm has grown back!', E: 'My arm has grown back, good as new.' },
  spring: { A: 'Spring! Stars!', B: 'Spring! Stars are here!', C: 'It is spring! The sea stars come.', D: 'Spring! The sea stars are coming together.', E: 'Spring! The sea is warm and green. Sea stars are gathering.' },
  findgirl: { A: 'Go to the girls!', B: 'Find the girls!', C: 'Crawl to the girls with hearts.', D: 'Crawl to the girl sea stars by the hearts.', E: 'Crawl over to the girl sea stars by the hearts.' },
  findboy: { A: 'Go to the boys!', B: 'Find the boys!', C: 'Crawl to the boys with hearts.', D: 'Crawl to the boy sea stars by the hearts.', E: 'Crawl over to the boy sea stars by the hearts.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the sea stars.', E: 'Go and say hello to the sea stars.' },
  arch: { A: 'Up! Up!', B: 'Stand tall!', C: 'Stand tall when it glows!', D: 'Stand tall when the wave glows.', E: 'Stand tall when the wave glows, and let my eggs go.' },
  cloud: { A: 'Up! Up!', B: 'Stand tall!', C: 'Stand tall. Let my cloud go!', D: 'Stand tall and let my milky cloud go.', E: 'The girls are standing tall. Stand tall and let my cloud go.' },
  larvae: { A: 'I see eggs!', B: 'Eggs in the sea!', C: 'New eggs drift in the sea!', D: 'Millions of new eggs drift away on the tide.', E: 'Millions of new eggs drift away on the tide, and it all begins again.' },
  done: { A: 'I rest.', B: 'All done! I rest.', C: 'My job is done. I rest.', D: 'My job is done. I rest on the rocks.', E: 'My job is done. I rest on the rocks.' },
  stuck: { A: 'No! Go back.', B: 'Too steep! Go back.', C: 'Too steep! Try another way.', D: 'That rock is too steep. Try another way.', E: 'That rock is too steep. Try another way.' },
  home: { A: 'Go to a pool!', B: 'Find a pool!', C: 'Find a pool or a crack.', D: 'Follow the arrow to a pool or a crack.', E: 'Follow the arrow to a tide pool or a crack.' },
  storm: { A: 'Hold on!', B: 'A storm! Hold on!', C: 'A storm wave! Hold on tight.', D: 'A storm wave! Hold on tight.', E: 'A storm wave is coming! Hold on tight.' }
};
