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
/* words only Octopus needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'dig jet hi big swim go in out home mum hide yum push blow grab pop blue boss puff',
  B: 'hatch so skin yum lots now wiggle pop off mum shade top catch wait mine again him win say away find by over into day whoosh ok good grow food way deep back went gone dots eat them us glow dark under her comes lights its mouth open dips snap old crawl winter rest spring wants dive bits that some your float taken try got use his done squeeze still blend ink puff blow grab reach babies boss hunt eight suckers arm arms colour match pale best blows curl door full grew grows hang hard keep keeps long sink squirt swims tip',
  C: 'mum food takes land old years live glows soil sky another won girl lose ten bits jumpy made people bus come comes did more bump swims as eats does boy safe jumps others cool hid had full try best his when stone stones den stay keep bait man bigger smell side sides each uses most floor mud sand crawl crawls swam reef bed fight guard many tiny taken tree fly grown summer float free shine ride backwards makes thin splits autumn hill hot ever wave push clean bit times lives shoot came kept still past job shot rainbow things change changes vanish tip grows nobody tastes taste wiggles flat whip float hole door sinks sink dreams dreaming while eggs string strings hang hangs roof months clever crack cracks bottle giant lid tips smelled smells roll eye eyes bag empty shells pile biggest climb favourite just let or pounce shed spread very woke wolf wrestle mum\'s',
  D: 'carries touch salty spike half shrimp crawl onto pea small took nine cool damp place hand wide moment right flash light school biggest world mouth opens drifts along free sharp breathe dries split inside huge season millions leave built male who ready female carry twelve fallen pretty sweet grown her helps walk around sink dash or tumbled but follow arrow deeper enough give heave pushed growing brothers sisters teeth tummy bones strong backwards forwards hunters rule autumn storms calm deeper rests ice crabber pot stay nobody second weeks smaller stronger taste hairs bottom holes hides year snails quick comb shining sting drifters hovers snatch seals hunt zoom often which breaks tears becomes pull hidden goes shallow stormy offshore stays warms drift crack spiky dinner something drifted tucked hunter left behind decided swells backed settling walking blink whole thousands rice grain parachute pounce beak parrot brain brains hearts three blue blood copper arms sucker suckers rows siphon tube cloud squirts jets colours camouflage mantle floats bulb blades grass dens wrestle spread loser otter lingcod wolf shark gill six special gift packet paralarva settler krill larva larvae bar pupils cat level tilt diver photo camera lifts anyway favourite slips months groom grooms tends stroke strokes clouds fifty fourth mind blowing called clear coming dream drop drops flickers going grabs grey ground hold holds hurt jetted lets matches meals midden month north outside own puffs rocky same settle shove take tall through tumbles turn visit',
  E: 'mother dawn stands edge shakes once grain rice body spikes stretch wriggle walking swimming thousands together five across turn baby reach fully each hatches touches quarter starts month own called bioluminescence shining sweeps past swallow sucks mouthfuls visit straight shady places lives alone pump myself weigh much looking signal pour great begins people build low guide safely soak salt boys fight shove gives hurt strongest part hundred thousand munch ripe chase drifts makes than year their bumps sharks near coming towards seabird digging cross rival hello job done marching nursery restricted beating rows rainbow straining centimetres hovers snatch surface nobody choose decided grinding stomach offshore temperature changes curious fronds forest kelp shelter crevice remember rarely dominant nine fanned float frees glued mated glue stalks fastest muscles tall dives looks young whatever life eight animals slowly gulf especially ones moves beside different rounded breaking slim edges hauls shallows less few degrees inshore return dens loser backs nibble practise escape arrows dipping let far urchins chromatophores muscles papillae bumpy sand rock matching matches vanishes almost blink boneless anything hardest grasps grips tastes everything trail midden divers neighbours neighbour puget sound washington salish islands gentle gently carefully drop-off ledge boulder boulders cephalopod hectocotylus plankton metres weighs grown-up measures lets whale bus tumbles wake wave gull plankton herring jelly settle den crabs clams scallops shrimps lingcod eel otters sixgill seal skin flickers mood excited cross flushes pale ate blended curled else fresh grip hanging hatching holding hunter\'s if lobster longer love meal mother\'s moult muddles never nose nothing octopus\'s pacific passing pulls send settles size sleeps slept spends sunflower trick were whales',
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
  octopus: 'octopus', octopuses: 'octopus', egg: 'egg', eggs: 'eggs', baby: 'larva', babies: 'larva', paralarva: 'larva',
  sea: 'sea', ocean: 'sea', water: 'water', plankton: 'plankton', copepod: 'copepod', copepods: 'copepod', krill: 'krill',
  jelly: 'combjelly', whale: 'whale', whales: 'whale', fish: 'herring', herring: 'herring', bird: 'gull', gull: 'gull', seal: 'seal', otter: 'otter', shark: 'sixgill', eel: 'wolfeel',
  rock: 'cobble', rocks: 'cobble', stone: 'cobble', stones: 'cobble', boulder: 'cobble', boulders: 'cobble',
  den: 'den', hole: 'den', crack: 'den', bottle: 'bottle', arm: 'arm', arms: 'arm', sucker: 'arm', suckers: 'arm', ink: 'ink',
  crab: 'crab', crabs: 'crab', clam: 'clam', clams: 'clam', scallop: 'scallop', snail: 'snail', shrimp: 'shrimp', shrimps: 'shrimp', shell: 'shell', shells: 'shell', kelp: 'kelp', seaweed: 'kelp',
  pot: 'trap', bait: 'trap', crabber: 'crabber', boat: 'boat', diver: 'diver', star: 'sunstar', moon: 'moon', sun: 'sun', mud: 'mud', deep: 'deep', snow: 'snow'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:    { A: 'eat',    B: 'eat it',      C: 'eat it up',              D: 'pounce and eat this food',   E: 'Pounce on it and eat it up. Yum!' },
  settle: { A: 'in',     B: 'go in',       C: 'squeeze into the den',   D: 'squeeze in and stay',        E: 'Squeeze in. This den is my home.' },
  sleep:  { A: 'sleep',  B: 'go to sleep', C: 'sleep in my den',        D: 'curl up and sleep to grow',  E: 'Curl up in my den and sleep. I grow while I sleep.' },
  puff:   { A: 'puff',   B: 'puff it',     C: 'puff the star away',     D: 'blow the star away',         E: 'Puff water and blow the star away from my eggs.' },
  bait:   { A: 'go',     B: 'go in it',    C: 'go in the pot',          D: 'squeeze in the pot for bait', E: 'Squeeze into the crab pot and eat the bait.' },
  box:    { A: 'push',   B: 'push him',    C: 'wrestle the octopus',    D: 'push him with my arms',      E: 'Wrestle him away from my den!' },
  meet:   { A: 'hi',     B: 'say hi',      C: 'go and say hi',          D: 'say hi to the octopus',      E: 'Go and say hello.' },
  shake:  { A: 'hi',     B: 'reach out',   C: 'reach out an arm',       D: 'reach an arm to the diver',  E: 'Reach out an arm and say hi to the diver.' },
  fan:    { A: 'blow',   B: 'blow them',   C: 'blow the babies out',    D: 'blow the babies free',       E: 'Blow water and send the babies out of the den.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'crab', settle: 'den', sleep: 'sleep', puff: 'sunstar', bait: 'trap', box: 'rival', meet: 'octopus', shake: 'diver', fan: 'eggs' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the octopus's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'An egg in her den', pic: 'eggs', gate: false,
    A: ['I am an egg.', 'I am in the sea.', 'I see my mum.'],
    B: ['I am a little egg.', 'Mum has lots of eggs.', 'They hang in her den.'],
    C: ['I am a little egg.', 'My mum has lots and lots of eggs.', 'They hang in strings from the roof of her den.'],
    D: ['My mum hangs her eggs from the roof of her den.', 'She keeps them clean for six months.', 'Soon a spring night will come.'],
    E: ['A mother octopus hangs thousands of eggs in strings from the roof of her den.', 'She strokes them clean and blows water over them for six months.', 'On a spring night the babies will hatch.'],
    yesno: [['Am I an egg?', true], ['Am I a big octopus?', false]] },
  hatch: { title: 'Pop out!', pic: 'larva', gate: true,
    A: ['I am out!', 'I am a baby.', 'I can swim.'],
    B: ['Mum blows the water.', 'Pop! I hatch out.', 'I am a little baby.'],
    C: ['It is night. Mum blows water over the eggs.', 'Pop! I hatch out of my egg.', 'Now I am a baby. I jet up!'],
    D: ['On a spring night, Mum puffs water over the eggs.', 'I hatch and float free.', 'I am a tiny paralarva. I jet up to the light.'],
    E: ['On a spring night my mother blows water over her eggs.', 'I hatch and float free, as small as a grain of rice.', 'I jet up to the surface, where the plankton is.'],
    yesno: [['Am I in the sea?', true], ['Am I a big octopus now?', false]] },
  larva2: { title: 'Bigger!', pic: 'larva', gate: true,
    A: ['I am a baby.', 'I eat, eat, eat.'],
    B: ['I eat the little shrimps.', 'I grow and grow!', 'Now I am big.'],
    C: ['I eat lots of little shrimps.', 'I have no shell to shed.', 'I just grow. Now I am big!'],
    D: ['A crab must shed its shell to grow.', 'An octopus has no shell at all.', 'I just keep growing as I eat.'],
    E: ['A crab or a lobster must moult to grow, but an octopus has no shell.', 'I keep growing a little every day, as long as I eat.', 'My arms get longer and my eyes get bigger.'],
    yesno: [['Do I grow when I eat?', true], ['Do I have a shell?', false]] },
  grow: { title: 'Bigger and bigger', pic: 'plankton', gate: false,
    A: ['I eat, eat, eat.', 'I am a big baby!'],
    B: ['I eat the little shrimps.', 'I am a big baby now.'],
    C: ['I grow again.', 'I eat lots and grow big.'],
    D: ['I eat and eat and get bigger.', 'Soon I will sink down to the rocks.'],
    E: ['Every meal makes me a little bigger.', 'A baby octopus spends a month or two in the plankton before it settles.'],
    yesno: [['Do I eat plankton?', true], ['Do I eat rocks?', false]] },
  postlarva: { title: 'Time to settle!', pic: 'postlarva', gate: true,
    A: ['Look at me!', 'I am an octopus.'],
    B: ['Look at me now!', 'I have eight little arms.', 'I look like an octopus!'],
    C: ['I am big now.', 'I look like a little octopus.', 'I want to go down to the rocks.'],
    D: ['After a month in the plankton I am big enough to settle.', 'I look like a little octopus with eight arms.', 'Now I must sink to the bottom.'],
    E: ['The settler is a little octopus the size of a pea.', 'It has eight arms, two big eyes and a siphon to jet with.', 'It is time to sink down and find a den.'],
    yesno: [['Do I have eight arms?', true], ['Am I a fish?', false]] },
  settle: { title: 'A den of my own', pic: 'den', gate: true,
    A: ['I see a crack.', 'I go in!'],
    B: ['Here is a rock.', 'Here is a crack.', 'I squeeze in. It is mine!'],
    C: ['I look under the rocks.', 'This crack is taken. That one is not!', 'I squeeze in. It is my home!'],
    D: ['I sink down to the reef and look for a den.', 'Many cracks are taken by other little octopuses.', 'At last I find a free one. It is my home.'],
    E: ['The settler sinks down to the rocky reef.', 'It looks under rock after rock for a crack that nobody is in.', 'An old bottle will do, if nothing else is free.'],
    yesno: [['Do I live in a crack?', true], ['Do I live in a tree?', false]] },
  nursery: { title: 'In my den', pic: 'cobble', gate: false,
    A: ['I hide.', 'I eat.', 'I am in my den.'],
    B: ['I hide in my den.', 'A shrimp comes by.', 'I grab it!'],
    C: ['I stay in my den for a long time.', 'I grab the shrimps that come by.', 'I grow and grow.'],
    D: ['A little octopus hides in its den for months.', 'It grabs what comes past the door and grows a little every day.'],
    E: ['A little octopus stays close to its den while it is small.', 'It grabs the shrimps and baby crabs that drift past the door.', 'It drops the empty shells outside: a pile called a midden.'],
    yesno: [['Do I hide in a den?', true], ['Do I fly?', false]] },
  forage: { title: 'Out at night', pic: 'crab', gate: true,
    A: ['I go out.', 'I eat, eat, eat!', 'Yum!'],
    B: ['It is night. I go out.', 'I find a crab.', 'Yum, yum, yum!'],
    C: ['I am bigger now.', 'At night I go out to hunt.', 'A crab! Pounce! Yum.'],
    D: ['Now I am big enough to go out at night.', 'I find crabs, clams and snails on the sea floor.', 'By day I hide in my den again.'],
    E: ['Octopuses hide by day and come out at night to hunt.', 'I taste crabs and clams with my suckers and find them in the dark.', 'Before the sun comes up I go back to my den.'],
    yesno: [['Do I go out at night?', true], ['Do I eat the sun?', false]] },
  adult: { title: 'A giant!', pic: 'adult', gate: true,
    A: ['I am big!', 'Look at my arms!'],
    B: ['Look at me!', 'I am a big octopus now.', 'Look at my long arms!'],
    C: ['I sleep in my den.', 'I wake up big.', 'I am a giant now!'],
    D: ['It took years for me to grow up.', 'My arms are as long as a grown-up is tall.', 'Soon autumn will come.'],
    E: ['I ate and slept and grew, and now I am a giant Pacific octopus.', 'My arms reach four metres from tip to tip.', 'Now I wait for the cold of autumn.'],
    yesno: [['Am I a big octopus?', true], ['Am I an egg?', false]] },
  larvae: { title: 'Pop, pop, pop!', pic: 'eggs', gate: true,
    A: ['I blow the water.', 'Go, go, go!'],
    B: ['It is night.', 'Blow, blow, blow!', 'The babies go.'],
    C: ['It is a spring night.', 'I blow water on the eggs.', 'The babies pop out and jet away!'],
    D: ['On a spring night the eggs hatch.', 'I blow water over them and the babies jet free.', 'They swim up to the top of the sea.'],
    E: ['On a spring night the eggs are ready.', 'The mother blows water over them and thousands of babies jet out of the den.', 'They swim up to the surface, and it all starts again.'],
    yesno: [['Do the babies go free?', true], ['Do the babies go up a tree?', false]] },
  glow: { title: 'The glowing sea', pic: 'plankton', gate: false,
    A: ['I see it!', 'It is blue!'],
    B: ['It is night.', 'Look! Blue dots!', 'They glow.'],
    C: ['It is night in the sea.', 'I bump some plankton and it glows blue!'],
    D: ['At night, some tiny plankton flash blue.', 'They light up when I bump them.'],
    E: ['Some plankton make their own light.', 'When something bumps them, they flash bright blue.', 'This is called bioluminescence.'],
    yesno: [['Do some plankton glow?', true], ['Is the glow red?', false]] },
  herring: { title: 'Herring!', pic: 'herring', gate: false,
    A: ['I see fish!', 'Go, go, go!'],
    B: ['Look at all the fish!', 'They want to eat.', 'I jet away fast!'],
    C: ['Lots of herring swim by.', 'They eat plankton.', 'I jet away from them.'],
    D: ['A school of herring comes by.', 'They eat plankton as they swim.', 'My quick jet keeps me safe.'],
    E: ['A shining school of herring sweeps past.', 'Herring gulp plankton, so I dive deep and jet away.', 'I am see-through, so I am hard to see.'],
    yesno: [['Do herring eat plankton?', true], ['Am I a fish?', false]] },
  combjelly: { title: 'The comb jelly', pic: 'combjelly', gate: false,
    A: ['I see a jelly.', 'No, no, no!'],
    B: ['Look at the jelly!', 'It has lights.', 'I swim away!'],
    C: ['A jelly comes by.', 'It glows like a rainbow.', 'It eats little things, so I swim away.'],
    D: ['A comb jelly drifts by, shining like a rainbow.', 'It has no sting, but it eats tiny drifters.', 'I keep away from it.'],
    E: ['A comb jelly has eight rows of beating hairs that shine like a rainbow.', 'It can not sting, but it eats tiny animals in the plankton.', 'I keep well away.'],
    yesno: [['Does the jelly shine?', true], ['Is the jelly a rock?', false]] },
  whale: { title: 'The grey whale', pic: 'whale', gate: false,
    A: ['I see a whale!', 'It is big!'],
    B: ['Look! A big, big whale!', 'It swims by.', 'I swim away!'],
    C: ['A big whale swims by.', 'It is as big as a bus!', 'It eats tiny shrimps, not octopuses.'],
    D: ['A grey whale comes by on its long swim north.', 'It is as long as a bus and eats tiny shrimps from the mud.', 'Its wave tumbles me about.'],
    E: ['Grey whales visit Puget Sound every spring on their way north.', 'This one is as long as a bus, and eats tiny shrimps it sucks out of the mud.', 'The wave it makes tumbles the plankton, and me with it.'],
    yesno: [['Is the whale big?', true], ['Does it eat rocks?', false]] },
  gull: { title: 'A bird!', pic: 'gull', gate: false,
    A: ['I see a bird.', 'I go down!'],
    B: ['Look at the bird!', 'It dips at the top.', 'I go down, down.'],
    C: ['A bird dips at the top of the sea.', 'I swim down, away from it.'],
    D: ['A gull hovers over the water and dips to snatch tiny things.', 'I dive a little deeper.'],
    E: ['A gull hovers over the sea and dips to snatch tiny things from the surface.', 'Deeper down, nobody can see me.'],
    yesno: [['Do I swim down?', true], ['Do I fly up?', false]] },
  hide: { title: 'Hide!', pic: 'cobble', gate: false,
    A: ['I see a fish.', 'I hide!'],
    B: ['A big fish is here.', 'I keep still.', 'I match the rock!'],
    C: ['A big fish swims by.', 'I keep still and change colour.', 'Now I look like a rock!'],
    D: ['Big fish and seals hunt little octopuses by day.', 'So I keep still and match the colour of the rock, or hide in my den.'],
    E: ['Lingcod, seals and otters look for octopuses, especially small ones.', 'I keep still and my skin changes to match the rock, so I almost vanish.'],
    yesno: [['Do I hide from the fish?', true], ['Do I ride the fish?', false]] },
  flip: { title: 'Ink and jet', pic: 'ink', gate: false,
    A: ['I jet!', 'I go, go, go!'],
    B: ['Puff! I squirt ink.', 'I jet back, back, back!'],
    C: ['A fish comes at me.', 'Puff! I squirt ink and jet away.', 'It did not get me!'],
    D: ['When a hunter comes, I squirt a cloud of dark ink.', 'Then I jet backwards and vanish behind it.'],
    E: ['Ink is an octopus\'s trick.', 'The dark cloud hides me and muddles the hunter\'s nose, and my siphon shoots me backwards out of reach.'],
    yesno: [['Do I squirt ink?', true], ['Do I fly?', false]] },
  midden: { title: 'My midden', pic: 'shell', gate: false,
    A: ['I see my shells.', 'My shells! Look!'],
    B: ['My shells are by my door.', 'Lots and lots of shells!'],
    C: ['I eat a crab.', 'I put the shell by my door.', 'The shells pile up!'],
    D: ['An octopus drops the empty shells of its meals outside its den.', 'The pile is called a midden.'],
    E: ['After I eat a crab, I drop the empty shell outside my door.', 'The pile of shells is called a midden.', 'Divers find octopus dens by looking for one.'],
    yesno: [['Do I pile up shells?', true], ['Do I eat the shells?', false]] },
  arms: { title: 'My favourite arm', pic: 'arm', gate: false,
    A: ['Look at my arms!', 'I like my arms.'],
    B: ['I have eight arms.', 'I like this one best.'],
    C: ['I have eight arms.', 'I reach with one arm most.', 'It is my favourite!'],
    D: ['I have eight arms with two rows of suckers.', 'I reach out with the same arm first every time.', 'It is my favourite arm.'],
    E: ['Every sucker on my eight arms can grip and taste.', 'I reach out with the same arm first, every time, the way you use your favourite hand.'],
    yesno: [['Do I have eight arms?', true], ['Do I have ten arms?', false]] },
  sleep: { title: 'Dreaming in colour', pic: 'sleep', gate: false,
    A: ['I am in my den.', 'I sleep.'],
    B: ['I am full.', 'I curl up and sleep!'],
    C: ['I hide in my den.', 'I curl up and sleep.', 'My skin changes colour. I grow!'],
    D: ['I curl up in my den and sleep.', 'My skin flickers pale and dark while I dream.', 'When I wake up I am bigger.'],
    E: ['An octopus sleeps curled up in its den.', 'While it sleeps its skin flickers through colours, as if it were dreaming.', 'It grows while it sleeps.'],
    yesno: [['Do I sleep in my den?', true], ['Do I sleep in a tree?', false]] },
  trap: { title: 'The crab pot', pic: 'trap', gate: false,
    A: ['I see a pot.', 'I go in!'],
    B: ['Here is a pot.', 'It has food in it.', 'I squeeze in!'],
    C: ['A pot comes down.', 'It has bait in it. Yum!', 'I squeeze in and eat.'],
    D: ['A crabber lets his pot down to the sea floor.', 'It smells of fish, so I squeeze in to eat the bait.', 'Up, up it goes!'],
    E: ['A crabber pulls up his pot and lifts the lid.', 'I am not a crab, so he tips me back into the sea.', 'I jet away with a full tummy.'],
    yesno: [['Do I go in the pot?', true], ['Do I stay on the boat?', false]] },
  diver: { title: 'A diver', pic: 'diver', gate: false,
    A: ['I see a diver.', 'Hi, hi!'],
    B: ['A diver is here.', 'She keeps still.', 'I say hi with an arm.'],
    C: ['A diver comes by.', 'She keeps very still.', 'I reach out an arm and say hi.'],
    D: ['A diver comes to visit the reef.', 'She holds very still, so I reach out an arm.', 'My suckers taste her hand.'],
    E: ['Divers in Puget Sound love to visit giant octopuses.', 'This one holds very still, so I reach out an arm and taste her hand with my suckers.', 'Then she takes my photo.'],
    yesno: [['Do I say hi to the diver?', true], ['Do I eat the diver?', false]] },
  armtip: { title: 'It grows back', pic: 'arm', gate: false,
    A: ['Look at my arm.', 'I like it!'],
    B: ['My arm tip is gone.', 'It grows back!'],
    C: ['The wolf eel got my arm tip.', 'I let it go.', 'It grows back!'],
    D: ['A wolf eel got hold of the tip of my arm.', 'I let it go, and it does not hurt.', 'The tip will grow back.'],
    E: ['A wolf eel got hold of an arm tip, so I let it go.', 'It does not hurt an octopus much.', 'The tip grows back over a few months, suckers and all.'],
    yesno: [['Does my arm grow back?', true], ['Do I have no arms?', false]] },
  autumn: { title: 'Autumn', pic: 'deep', gate: false,
    A: ['I go down.', 'Go, go, go!'],
    B: ['The sea is cold now.', 'I crawl to the deep.'],
    C: ['It is autumn. The sea is cold.', 'The octopuses go down to the deep.', 'I crawl down too.'],
    D: ['In autumn the shallow water gets cold and stormy.', 'The octopuses crawl down the drop-off to the deep.', 'It is a long way down.'],
    E: ['In autumn the shallows get cold and stormy.', 'Octopuses crawl down the drop-off to deep water, where it is calm and the temperature changes less.'],
    yesno: [['Do I go to the deep?', true], ['Do I crawl up a hill?', false]] },
  winter: { title: 'Winter in the deep', pic: 'mud', gate: false,
    A: ['I dig a den.', 'I sleep.'],
    B: ['It is winter.', 'I dig a den and rest.'],
    C: ['It is winter.', 'I dig a den in the mud.', 'I rest and wait for spring.'],
    D: ['In winter I dig a den under a stone in the deep.', 'The deep water stays calm.', 'I rest until spring.'],
    E: ['Deep water stays calm and keeps its temperature all winter.', 'I dig a den under a stone and rest, eating very little, until spring.'],
    yesno: [['Do I rest in winter?', true], ['Is the deep water hot?', false]] },
  spring: { title: 'Back home', pic: 'cobble', gate: false,
    A: ['I see my home.', 'I go home!'],
    B: ['Spring is here!', 'I crawl back home.'],
    C: ['It is spring. The sea is warm again.', 'I crawl back up to the reef.'],
    D: ['In spring the sea warms up again.', 'I crawl all the way back up to the reef.', 'It is my home.'],
    E: ['When the sea warms in spring, the octopuses climb back up the drop-off.', 'I return to the reef where I grew up.'],
    yesno: [['Do I go back home?', true], ['Do I stay in the deep for ever?', false]] },
  rival: { title: 'My den!', pic: 'rival', gate: false,
    A: ['I see an octopus.', 'Push, push, push!'],
    B: ['A big octopus is here.', 'He wants my den.', 'I will push him!'],
    C: ['Another boy octopus wants my den.', 'We spread our arms.', 'We push and wrestle.'],
    D: ['Another male wants my den.', 'We spread our arms wide and turn dark.', 'Who will win?'],
    E: ['Boy octopuses wrestle to keep the best dens.', 'We spread our arms, turn dark and push until one gives up.', 'The loser backs away and jets off. Nobody is hurt.'],
    yesno: [['Do we wrestle?', true], ['Do we sing?', false]] },
  boss: { title: 'The biggest on the reef', pic: 'boss', gate: false,
    A: ['I am the boss!', 'Look at me!'],
    B: ['I win, I win!', 'This den is mine.'],
    C: ['I won! My den is safe.', 'Now a girl octopus can find me.'],
    D: ['I won every wrestle.', 'Now my den is ready for a female.'],
    E: ['I am the biggest octopus on this part of the reef.', 'A female will come to my den soon.'],
    yesno: [['Did I win?', true], ['Did I lose my den?', false]] },
  brood: { title: 'Eggs in my den', pic: 'female', gate: false,
    A: ['I see my eggs.', 'I am in my den.'],
    B: ['I have lots of eggs.', 'They hang in my den.', 'I wait and wait.'],
    C: ['I have lots and lots of eggs.', 'They hang from the roof.', 'I keep them clean and blow water on them.'],
    D: ['I hang my eggs in strings from the roof of my den.', 'I stroke them clean and blow water over them for six months.'],
    E: ['I hang thousands of eggs in strings from the roof of my den.', 'For six months I stroke them clean and blow fresh water over them.', 'I never leave them.'],
    yesno: [['Do I have eggs?', true], ['Do I go up a tree?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', larva3: 'grow', glow: 'glow', herring: 'herring', combJelly: 'combjelly', whale: 'whale', gullDip: 'gull', settled: 'nursery', predator: 'hide', flipped: 'flip', middenGrew: 'midden', favArm: 'arms', sleeping: 'sleep', trapDown: 'trap', diverArrived: 'diver', armTip: 'armtip', migrate: 'autumn', winterStart: 'winter', winterDone: 'spring', rivalArrived: 'rival', boss: 'boss', brooding: 'brood' };

/* ---------- read-and-do missions ----------
   who: larva · swim (paralarva or settler) · post (settler near the bottom) · juvenile (in its den)
        · forage (a young or adult octopus out crawling) · walk (on the way down to the deep) · rival (a rival is here)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'plankton', who: 'larva', A: 'Eat, eat, eat!', B: 'Eat lots of little shrimps.', C: 'Eat ten bits of plankton.', D: 'Eat ten bits of plankton.', E: 'Swim around and eat ten bits of plankton.' },
  { key: 'deep', who: 'swim', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark.' },
  { key: 'top', who: 'swim', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'copepod', who: 'larva', from: 'B', A: 'Eat the crab!', B: 'Catch a baby crab!', C: 'Catch a jumpy baby crab.', D: 'Catch a baby crab. It is fast!', E: 'Chase a jumpy baby crab and catch it.' },
  { key: 'bottom', who: 'post', A: 'Go to the rocks.', B: 'Dive to the rocks.', C: 'Dive down to the reef.', D: 'Sink down to the rocky reef.', E: 'Sink all the way down to the rocky reef.' },
  { key: 'drift', who: 'juvenile', A: 'Eat, eat, eat!', B: 'Grab the shrimps.', C: 'Grab three shrimps.', D: 'Grab three shrimps that drift by.', E: 'Grab three shrimps that drift past your den.' },
  { key: 'clam', who: 'forage', A: 'Eat a clam.', B: 'Find a clam.', C: 'Find a clam and eat it.', D: 'Find a clam and open it.', E: 'Find a clam on the sea floor and eat it.' },
  { key: 'scallop', who: 'forage', from: 'B', A: 'Eat a scallop.', B: 'Find a scallop.', C: 'Find a scallop and eat it.', D: 'Find a scallop to eat.', E: 'Find a scallop and open it with your beak.' },
  { key: 'crab', who: 'forage', A: 'Eat a crab.', B: 'Catch a crab.', C: 'Catch a crab and eat it.', D: 'Catch a crab for dinner.', E: 'Pounce on a crab and eat it up.' },
  { key: 'snail', who: 'forage', A: 'Eat a snail.', B: 'Find a snail.', C: 'Find a snail to eat.', D: 'Find a snail and eat it.', E: 'Find a snail and pull it out of its shell.' },
  { key: 'flip', who: 'forage', A: 'Jet, jet, jet!', B: 'Squirt ink and jet.', C: 'Squirt ink three times.', D: 'Squirt ink and jet away.', E: 'Squirt ink three times to practise your escape.' },
  { key: 'dig', who: 'forage', A: 'Dig, dig, dig!', B: 'Dig a hole.', C: 'Dig a den under a stone.', D: 'Dig a deep den under a boulder.', E: 'Dig a den in the sand under a boulder.' },
  { key: 'hide', who: 'forage', A: 'Go to a rock.', B: 'Hide by a rock.', C: 'Hide in a crack.', D: 'Find a crack to hide in.', E: 'Find a crack or some kelp and hide.' },
  { key: 'blend', who: 'forage', from: 'B', A: 'Sit still.', B: 'Sit still and blend.', C: 'Keep still and match the rock.', D: 'Keep still until you match the ground.', E: 'Keep very still until your skin matches the ground.' },
  { key: 'offshore', who: 'walk', from: 'B', A: 'Go to the deep.', B: 'Crawl to the deep!', C: 'Crawl down to the deep.', D: 'Crawl all the way down to the deep.', E: 'Crawl down the drop-off all the way to the deep.' },
  { key: 'rival', who: 'rival', A: 'Push the octopus!', B: 'Push the big octopus!', C: 'Go and wrestle the other octopus.', D: 'Wrestle the other octopus away.', E: 'Wrestle the other octopus away from your den.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am an egg in my mum\'s den.', D: 'I am an egg. Soon a spring night will come.', E: 'I am an egg hanging in my mother\'s den.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle! Pop out!', C: 'Mum blows the water. Wiggle!', D: 'Mum is blowing water over the eggs. Wiggle free!', E: 'Push the arrows to wiggle free and jet up.' },
  swim: { A: 'Swim! Eat!', B: 'Swim and eat the little shrimps.', C: 'Swim and eat the little shrimps.', D: 'Swim around and eat the plankton.', E: 'Swim around and eat the tiny copepods.' },
  copepod: { A: 'Eat the crab!', B: 'Catch the baby crab!', C: 'It jumps! Catch it.', D: 'A baby crab! It jumps away fast.', E: 'A baby crab! Chase it and catch it.' },
  grow: { A: 'I am big!', B: 'I grew! I am big.', C: 'I grew! No shell to shed.', D: 'I grew! An octopus has no shell to shed.', E: 'I grew! An octopus has no shell, so it just keeps growing.' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more plankton to grow.', E: 'Eat more plankton to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Food is at the top.', D: 'At night the plankton swim up to the top.', E: 'At night the plankton swim up near the top.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Food is down deep.', D: 'In the day the plankton sink down deep.', E: 'In the day the plankton sink down where it is dark.' },
  flick: { A: 'Jet, jet!', B: 'Jet fast!', C: 'Push water out to jet.', D: 'Squirt water out of my siphon to jet.', E: 'Squirt water out of my siphon to jet away.' },
  herring: { A: 'Fish! Go, go!', B: 'Fish! Jet away!', C: 'Fish! Jet away from them.', D: 'Herring! Jet away or dive deep.', E: 'Herring are coming! Jet away or dive deep.' },
  missed: { A: 'I am up!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  jelly: { A: 'A jelly! Go!', B: 'A jelly! Swim away!', C: 'A jelly! Keep away from it.', D: 'A comb jelly! Keep away from it.', E: 'A comb jelly! Keep well away from it.' },
  whale: { A: 'A whale! Go, go!', B: 'A big whale! Swim away!', C: 'A big whale! Swim away from it.', D: 'A grey whale! Swim clear of its wave.', E: 'A grey whale is passing! Swim clear of the wave it makes.' },
  gull: { A: 'A bird! Go down!', B: 'A bird! Swim down!', C: 'A bird! Swim down a bit.', D: 'A gull! Dive a little deeper.', E: 'A gull is dipping at the surface! Dive a little deeper.' },
  postlarva: { A: 'Go down!', B: 'Sink to the rocks!', C: 'Sink down to the reef.', D: 'Follow the arrow and sink to the reef.', E: 'Follow the arrow and sink down to the rocky reef.' },
  search: { A: 'Look! A crack!', B: 'Find a crack. Go in!', C: 'Find a crack that is not taken.', D: 'Find a crack under a rock that nobody is in.', E: 'Look under the rocks for a crack that nobody is in. A bottle will do!' },
  taken: { A: 'No! Go, go!', B: 'Taken! Try again.', C: 'An octopus lives here. Try another.', D: 'Taken! A little octopus lives here. Try another.', E: 'Taken! Another little octopus lives here. Try another rock.' },
  settle: { A: 'Go in!', B: 'Squeeze in! It is mine.', C: 'A free den! Squeeze in.', D: 'A free den! Squeeze in and make it my home.', E: 'A free den under a rock! Squeeze in and make it my home.' },
  juvenile: { A: 'Grab!', B: 'Grab the shrimps!', C: 'Grab the shrimps that come by.', D: 'Stay in my den and grab what drifts by.', E: 'Stay hidden in my den and grab what drifts past the door.' },
  drift: { A: 'I see it! Grab!', B: 'A shrimp! Grab it!', C: 'A shrimp came by! Grab it.', D: 'A shrimp drifted by! Grab it.', E: 'A shrimp drifted past my door! Grab it.' },
  hide: { A: 'Hide!', B: 'Hide! Sit still!', C: 'Hide! Keep still or get in a crack!', D: 'Hide! Keep still and blend, or get in a crack.', E: 'Hide! Keep still and blend in, or get into a crack or the kelp.' },
  hidden: { A: 'Yes!', B: 'I hide. Good!', C: 'I am safe in here.', D: 'I am safe and hidden.', E: 'I am safe and hidden.' },
  tucked: { A: 'I sleep.', B: 'I hide and wait.', C: 'I hid and kept still.', D: 'I went flat and kept still until it was safe.', E: 'I went flat and blended in until it was safe.' },
  blend: { A: 'I am a rock!', B: 'Sit still. I blend!', C: 'Keep still. I match the rock!', D: 'Keep still and my skin matches the ground.', E: 'Keep still and my skin matches the ground. I almost vanish!' },
  predator: { A: 'A fish! Jet!', B: 'A big fish! Jet!', C: 'A big fish! Ink and jet!', D: 'A hunter! Ink and jet, or keep still.', E: 'A hunter is coming! Ink and jet away, or keep still and blend.' },
  dodged: { A: 'I am up!', B: 'Whoosh! I got away!', C: 'Whoosh! It did not get me.', D: 'Whoosh! My ink cloud left it behind.', E: 'Whoosh! My ink cloud and my jet left it far behind.' },
  forage: { A: 'Go. Eat!', B: 'Night! Go out and hunt.', C: 'Night! Go out and find food.', D: 'It is night. Go out and hunt.', E: 'It is night. Go out and find crabs, clams and snails.' },
  eat: { A: 'Eat it!', B: 'Food! Go and eat it.', C: 'Go to the food and pounce.', D: 'There is food. Go and pounce on it.', E: 'There is food on the sea floor. Go and pounce on it.' },
  sniff: { A: 'Go, go, go!', B: 'Go this way! Eat!', C: 'Go this way to find food.', D: 'Follow the arrow to find more food.', E: 'Follow the arrow to find more food. My suckers taste it.' },
  arm: { A: 'My arm!', B: 'Use my arm!', C: 'Use one arm most.', D: 'The arm I use most is my favourite.', E: 'The arm I use most becomes my favourite arm.' },
  favarm: { A: 'My arm!', B: 'My best arm!', C: 'My favourite arm!', D: 'My favourite arm is decided!', E: 'My favourite arm is decided! I reach with it first.' },
  full: { A: 'Dig! Go down!', B: 'Dig under a rock!', C: 'I am full. Dig under a rock.', D: 'I am full. Dig a den under a boulder.', E: 'I am full. Push down to dig a den under a boulder.' },
  dig: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down into the sand.', D: 'Blow the sand away, under the boulder.', E: 'Blow the sand away and dig under the boulder.' },
  rock: { A: 'No! It is a rock.', B: 'Too hard! Dig here?', C: 'Too hard! Find sand.', D: 'Too hard to dig here. Find sand or mud.', E: 'This is too hard to dig. Find some sand or mud.' },
  deeper: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down some more.', D: 'Dig a little deeper.', E: 'Keep digging. My den must be deep.' },
  cover: { A: 'Go in!', B: 'Go under the rock!', C: 'Dig under the rock.', D: 'Dig to the side, under the boulder.', E: 'Dig to the side, right under the boulder.' },
  sleep: { A: 'Sleep!', B: 'Go to sleep!', C: 'Curl up and sleep.', D: 'Hidden! Curl up and sleep to grow.', E: 'Hidden and full! Curl up and sleep. I grow while I sleep.' },
  sleeping: { A: 'I sleep.', B: 'I sleep and grow.', C: 'I sleep. My skin changes colour.', D: 'I sleep and dream. My skin flickers.', E: 'I sleep and dream, my skin flickers with colours, and I grow.' },
  awake: { A: 'I am big!', B: 'I am big! Go out!', C: 'I woke up big. Go out!', D: 'I woke up bigger. Out I go!', E: 'I woke up bigger than before. Out I go!' },
  out: { A: 'Go up!', B: 'Go up and out!', C: 'Climb up and out.', D: 'Climb up and out of my den.', E: 'Push up to climb out of my den.' },
  daytime: { A: 'I hide. I sleep.', B: 'It is day. I hide.', C: 'It is day. I hide and wait.', D: 'It is day. Octopuses hide by day.', E: 'It is day. Octopuses hide by day and come out at night.' },
  midden: { A: 'My shells!', B: 'Shells by my door!', C: 'My shells pile up by my door.', D: 'My empty shells pile up by my door.', E: 'My empty shells pile up by my door: a midden.' },
  trap: { A: 'A pot! Go in!', B: 'A pot! Go in and eat!', C: 'A pot with bait! Squeeze in.', D: 'A pot! It smells of fish. Squeeze in.', E: 'A crab pot! It smells of fish. Squeeze in and eat the bait.' },
  hauled: { A: 'Up, up!', B: 'Up, up I go!', C: 'Up I go to the boat!', D: 'Up I go! The crabber lifts the lid.', E: 'Up I go! The crabber lifts the lid and looks at me.' },
  measured: { A: 'In I go!', B: 'Not a crab! Back in!', C: 'Not a crab! Back in the sea.', D: 'Not a crab! Back into the sea I go.', E: 'I am not a crab! Back into the sea I go.' },
  adult: { A: 'I am big!', B: 'I am big! Eat and wait.', C: 'I am a giant. Eat and wait.', D: 'I am a giant. Eat and wait for autumn.', E: 'I am a giant. Eat and wait for the cold of autumn.' },
  diver: { A: 'A diver! Hi!', B: 'A diver! Go say hi!', C: 'A diver! Go and say hi.', D: 'A diver! She keeps still. Go and say hi.', E: 'A diver! She is holding very still. Go and say hi with an arm.' },
  shake: { A: 'Hi! Hi!', B: 'Reach out an arm!', C: 'Reach out an arm.', D: 'Reach out an arm to say hi.', E: 'Reach out an arm and taste her hand.' },
  armtip: { A: 'My arm!', B: 'My arm tip! It grows back.', C: 'It got my arm tip. It grows back!', D: 'It got my arm tip. I let it go. It grows back.', E: 'The wolf eel got my arm tip. I let it go. It will grow back.' },
  autumn: { A: 'Go down!', B: 'Cold! Go to the deep!', C: 'It is cold. Crawl to the deep!', D: 'Autumn! Crawl down to the deep.', E: 'Autumn! The sea is cold. Crawl down the drop-off to the deep.' },
  deep: { A: 'Go to the deep!', B: 'Go to the deep!', C: 'Go this way to the deep.', D: 'Follow the arrow to the deep.', E: 'Follow the arrow all the way down to the deep.' },
  kelpwalk: { A: 'Go, go, go!', B: 'Crawl on!', C: 'Crawl on past the kelp.', D: 'Crawl on through the kelp.', E: 'Crawl on through the kelp forest.' },
  arrived: { A: 'Dig!', B: 'Dig a den!', C: 'The deep! Dig a den in the mud.', D: 'The deep! Dig a den under a stone for winter.', E: 'The deep! Push down to dig a den under a stone for winter.' },
  winter: { A: 'I sleep.', B: 'It is winter. I rest.', C: 'It is winter. I rest in my den.', D: 'It is winter. I rest in my deep den.', E: 'It is winter. I rest in my deep den, where it is calm.' },
  spring: { A: 'Go home!', B: 'Spring! Go home!', C: 'It is spring. Go back home!', D: 'Spring! Climb out and crawl back home.', E: 'Spring! Climb out and crawl back up to the reef.' },
  home: { A: 'Go home!', B: 'Go home!', C: 'Go this way to go home.', D: 'Follow the arrow back home.', E: 'Follow the arrow back home to the reef.' },
  site: { A: 'Dig, dig, dig!', B: 'Dig a den here!', C: 'Dig a den under a big rock.', D: 'Home! Dig a den under a big boulder.', E: 'Home! Push down to dig a den under a big boulder.' },
  rival: { A: 'An octopus! Push!', B: 'A big octopus! Push him!', C: 'Another octopus! Go and wrestle him.', D: 'Another male! Go and wrestle him.', E: 'A rival male wants my den! Wrestle him.' },
  box: { A: 'Push, push, push!', B: 'Push, push, push!', C: 'Push! Then a big push!', D: 'Push! When it is green, give a big shove!', E: 'Push him, then give a big shove!' },
  won: { A: 'Yes, yes, yes!', B: 'I win! He is gone.', C: 'I won! He went away.', D: 'I won! He jetted away.', E: 'I won! He jetted away, and my den is safe.' },
  lost: { A: 'No! Push, push!', B: 'No! Play again.', C: 'He won. Try again.', D: 'He pushed me back. Try again.', E: 'He pushed me back! Try again.' },
  boss: { A: 'I am the boss!', B: 'I win, I win!', C: 'I am the biggest here!', D: 'I am the biggest octopus on the reef!', E: 'I am the biggest octopus on the reef!' },
  female: { A: 'I see an octopus!', B: 'Go and say hi!', C: 'A girl octopus! Go and say hi.', D: 'A female octopus! Go and say hi.', E: 'A female octopus! Go and say hello.' },
  findmale: { A: 'Go to an octopus!', B: 'Find a big octopus!', C: 'Find a boy octopus at his den.', D: 'Find a male octopus at his den.', E: 'Find a male octopus waiting at his den.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the octopus.', E: 'Go and say hello to the octopus.' },
  nest: { A: 'Look at me!', B: 'I go in my den.', C: 'I go in my den. I lay my eggs.', D: 'I take a den of my own and hang my eggs.', E: 'I take a den of my own next door and hang my eggs from the roof.' },
  brood: { A: 'I see my eggs.', B: 'My eggs! I wait.', C: 'My eggs grow. I blow water on them.', D: 'My eggs hang from the roof. I keep them clean.', E: 'My eggs hang from the roof. I stroke them clean and blow water over them.' },
  puff: { A: 'A star! Puff!', B: 'A star! Puff it!', C: 'A star is here! Puff it away.', D: 'A star is coming for the eggs! Puff it away.', E: 'A sunflower star is coming for the eggs! Puff water at it.' },
  puffed: { A: 'Puff! Yes!', B: 'Puff! It went away.', C: 'Puff! It went away. My eggs are safe.', D: 'Puff! It tumbled away. The eggs are safe.', E: 'Puff! It tumbled away. The eggs are safe.' },
  moonready: { A: 'Blow!', B: 'Night! Blow them out!', C: 'A spring night! Blow the babies out.', D: 'A spring night! The eggs hatch. Blow the babies out.', E: 'A spring night! The eggs are hatching. Blow the babies out of the den.' },
  release: { A: 'Blow, blow, blow!', B: 'Wait for the glow!', C: 'When it glows, blow!', D: 'When the glow swells, blow the babies out!', E: 'When the glow swells, blow water and send the babies out!' },
  larvae: { A: 'I see babies!', B: 'The babies swim up!', C: 'The babies jet up to the top!', D: 'The babies jet up to the top of the sea.', E: 'The babies jet up to the surface, and it all starts again.' },
  done: { A: 'I sleep.', B: 'All done! I rest.', C: 'My job is done. I rest.', D: 'My job is done. I rest in my den.', E: 'My job is done. I rest in my den.' },
  friend: { A: 'I see octopuses!', B: 'Look! Little octopuses!', C: 'Lots of little octopuses live here too.', D: 'Other little octopuses are settling here too.', E: 'Other little octopuses are settling on the reef too.' },
  flipped: { A: 'Ink! I go!', B: 'Ink! I went back!', C: 'Ink! I shot backwards.', D: 'Ink! My jet shot me backwards.', E: 'Ink and jet! A dark cloud, and I shot backwards.' },
  cold: { A: 'Go down!', B: 'Cold! Go down!', C: 'It is cold up here. Go down.', D: 'The water is cold up here. Keep going down.', E: 'The water is cold up here. Keep going down to the deep.' }
};
