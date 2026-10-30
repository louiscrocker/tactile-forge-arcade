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
/* words only Sunfish needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'hi big swim go in out mum yum pop blue sun clean flap jump splash brr warm itchy dive glow friends dark cold on helps bugs little they lots sit still get let',
  B: 'hatch so yum lots now wiggle pop off mum top catch wait again say away find by over into day whoosh ok good grow food deep back went gone eat them us glow dark under her comes its open dips snap old rest spring wants bits that some your float try got his done still blow babies dash lie flat friends spiky spikes let tiny bump glows lights from stay sits picks thank skin swims eats sees goes slow oops summer grew missed ahh first girl boy',
  C: 'mum food takes old live glows sky another girl ten bits made come comes did more bump swims as eats does boy safe others cool hid had full try best his when stay keep side sides each uses most bigger tiny grown summer float free shine ride makes thin wave push clean bit times came kept still past job shot things change changes slurp slurps warms sunny sunshine fast little pick picks itch bugs side hold holds own school silver rainbow flies fly legs tail frilly rudder grows near real bottom long hot soft beak must ever floor lands hurt make white give misses huge likes swam people pull ate giant right fall far last alone millions soon just way five flaps forest ready press e how jumped',
  D: 'carries touch salty spike half small took cool place wide moment right flash light school biggest world mouth opens drifts along free sharp breathe inside huge millions leave male who ready female carry pretty grown helps around sink dash or tumbled but follow arrow deeper enough give pushed growing brothers sisters teeth bones strong hunters calm rests nobody second weeks smaller stronger hides heavy fridge flaps rudder tail wings skin peck pecks cleaners cleaner fishers pin head through eyes bumped sparkles sweeps comb rows body hard swallow fade tall round never would young often together safer mahi fastest grey stone mostly cannot while both win animals yellow tilt curious family close leatherback sticks flops fishing mistake lift car sixty million heavier than leap land shake chain quick something fading pass shook beside swells'
  ,
  E: 'mother stands edge shakes once grain rice body spikes stretch wriggle swimming thousands together five across turn baby reach fully each hatches touches starts own called bioluminescence shining past swallow visit lives alone myself weigh much looking great begins people low safely salt gives hurt part hundred thousand chase drifts than year their bumps sharks near coming towards seabird hello job done million sixty heavier pufferfish cousin parasites tilts milky any animal backbone drift northern schools eight beating hairs western snatch looks cousins shrink edges join clavus surface usually tuna name means millstone steers hundreds metres joined parrot cools hunts lies basks snack forty kinds halfmoon visiting california lions playful swimmers dolphins travel groups slim almost only bother whole sometimes think careful slows nets set scientists may parts life began gathering mate cycle dashes row shore drifting arrows dipping landed him'
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
  sunfish: 'sunfish', mola: 'sunfish', egg: 'egg', eggs: 'eggs', baby: 'larva', babies: 'larva', hatchling: 'larva',
  star: 'starlarva', stars: 'starlarva',
  sea: 'sea', ocean: 'sea', water: 'water', plankton: 'plankton', copepod: 'copepod', copepods: 'copepod', krill: 'krill', shrimp: 'krill', shrimps: 'krill',
  jelly: 'jelly', jellies: 'jelly', salp: 'salp', salps: 'salp', fish: 'anchovy', anchovy: 'anchovy', anchovies: 'anchovy',
  bird: 'gull', birds: 'gull', gull: 'gull', gulls: 'gull', lion: 'sealion', orca: 'orca', orcas: 'orca', whale: 'orca', whales: 'orca', shark: 'shark', turtle: 'turtle',
  boat: 'boat', net: 'net', kelp: 'kelp', seaweed: 'kelp', sun: 'sun', moon: 'moon', fin: 'fin', fins: 'fin', lice: 'lice', cleaner: 'cleaner',
  deep: 'deep', cloud: 'cloud', heart: 'heart', hearts: 'heart', rock: 'rock', rocks: 'rock'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:   { A: 'eat',   B: 'eat it',      C: 'eat the jelly',          D: 'slurp up the jelly',            E: 'Slurp up the jelly. Yum!' },
  bask:  { A: 'sun',   B: 'lie in the sun', C: 'lie flat in the sun', D: 'lie flat and warm up',          E: 'Lie flat on my side in the warm sun.' },
  clean: { A: 'clean', B: 'sit still',   C: 'hold still to get clean', D: 'hold still for the little fish', E: 'Hold very still so the little fish can clean me.' },
  meet:  { A: 'hi',    B: 'say hi',      C: 'go and say hi',          D: 'say hi to the sunfish',         E: 'Swim up close and say hello.' },
  cloud: { A: 'cloud', B: 'let it go',   C: 'let my cloud go',        D: 'let my little cloud go',        E: 'Let my milky cloud go beside her.' },
  eggs:  { A: 'eggs',  B: 'let them go', C: 'let my eggs go',         D: 'let all my eggs go',            E: 'Let my eggs go into the warm sea.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'jelly', bask: 'sun', clean: 'cleaner', meet: 'sunfish', cloud: 'cloud', eggs: 'eggs' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the sunfish's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'A tiny egg', pic: 'eggs', gate: false,
    A: ['I am an egg.', 'I am in the sea.'],
    B: ['I am a little egg.', 'Mum let lots of eggs go.', 'We float in the sea.'],
    C: ['I am a tiny egg in the warm sea.', 'My mum let lots and lots of eggs go.', 'Now we float on our own.'],
    D: ['My mum let millions of eggs go into the warm sea.', 'Each egg is as small as a pin head.', 'We float with the plankton.'],
    E: ['A mother sunfish can let three hundred million eggs go.', 'That is more than any other animal with a backbone.', 'The eggs drift on their own in the warm sea.'],
    yesno: [['Am I an egg?', true], ['Am I a big sunfish?', false]] },
  hatch: { title: 'Hatch!', pic: 'larva', gate: true,
    A: ['I am out!', 'I am a baby.', 'I can swim.'],
    B: ['Pop! I hatch out.', 'I am a little baby.', 'I can swim and eat.'],
    C: ['Pop! I hatch out of my egg.', 'I am a tiny baby sunfish.', 'I can see the plankton. Yum!'],
    D: ['I hatch out of my egg.', 'I am a tiny see-through baby with big eyes.', 'I swim and look for plankton to eat.'],
    E: ['A baby sunfish hatches out smaller than a grain of rice.', 'It is see-through, with big eyes.', 'It swims in the plankton and eats tiny copepods.'],
    yesno: [['Am I in the sea?', true], ['Am I a big sunfish now?', false]] },
  glow: { title: 'A glowing sea', pic: 'plankton', gate: false,
    A: ['I see it glow!', 'It is blue.'],
    B: ['It is night.', 'I bump the plankton.', 'It glows blue!'],
    C: ['It is dark at night.', 'I bump some plankton and it glows blue.'],
    D: ['Some plankton flash blue when they are bumped.', 'The dark sea sparkles all around me.'],
    E: ['Some plankton make their own light when something bumps them.', 'It is called bioluminescence.'],
    yesno: [['Can plankton glow?', true], ['Is the glow red?', false]] },
  anchovy: { title: 'A school of fish', pic: 'anchovy', gate: false,
    A: ['I see a fish.', 'I see the fish go.'],
    B: ['Here come the fish.', 'They swim fast.', 'Whoosh! I dash away.'],
    C: ['A big school of fish comes by.', 'They swim fast and they are silver.', 'I dash away from them.'],
    D: ['A school of silver anchovies sweeps past.', 'They eat plankton, so I dash out of the way.'],
    E: ['Northern anchovies swim in huge silver schools.', 'I am small and spiky, so I dash away and they swim on.'],
    yesno: [['Did the fish swim fast?', true], ['Did the fish eat me?', false]] },
  combjelly: { title: 'A rainbow jelly', pic: 'jelly', gate: false,
    A: ['I see a jelly.', 'Go, go, go!'],
    B: ['A jelly comes by.', 'It has lights.', 'I swim away from it.'],
    C: ['A jelly comes by with rainbow lights.', 'It eats tiny things, so I keep away.'],
    D: ['A comb jelly drifts by with rows of rainbow lights.', 'I keep away now, but one day I will eat comb jellies!'],
    E: ['A comb jelly has eight rows of tiny beating hairs that shine like a rainbow.', 'One day I will be big enough to eat it.'],
    yesno: [['Does the jelly have lights?', true], ['Is the jelly a fish?', false]] },
  gull: { title: 'A bird', pic: 'gull', gate: false,
    A: ['I see a bird.', 'I go down.'],
    B: ['A bird dips at the top.', 'I swim down.', 'It is gone.'],
    C: ['A gull dips down to the top of the sea.', 'I swim down, and it flies away.'],
    D: ['A gull dips at the top of the sea to catch little things.', 'I dive a little deeper, so I am safe.'],
    E: ['Western gulls snatch small things from the top of the sea.', 'A tiny sunfish is safer a little deeper down.'],
    yesno: [['Can a gull fly?', true], ['Does the gull swim deep?', false]] },
  star: { title: 'A spiky star!', pic: 'starlarva', gate: true,
    A: ['Look at me!', 'I am a star.'],
    B: ['Look at me now!', 'I have spikes.', 'I am a spiky star!'],
    C: ['I eat and I grow.', 'Now I have spikes all over.', 'I look like a little star!'],
    D: ['I grow spikes all over my body.', 'I look like a tiny star.', 'The spikes make me hard to swallow.'],
    E: ['A baby sunfish grows spikes all over its body.', 'It looks like a tiny star, or a tiny pufferfish.', 'Sunfish and pufferfish are cousins.'],
    yesno: [['Do I have spikes?', true], ['Do I have legs?', false]] },
  juvenile: { title: 'Spikes go, a rudder grows', pic: 'juvenile', gate: true,
    A: ['Look at me!', 'I am a sunfish.'],
    B: ['My spikes are gone.', 'I have big fins.', 'Now I look like a sunfish!'],
    C: ['My spikes go away as I grow.', 'I do not have a tail.', 'A frilly rudder grows at my back.'],
    D: ['My spikes fade away and my body grows tall and round.', 'A sunfish never grows a tail.', 'A frilly rudder grows where a tail would be.'],
    E: ['As a young sunfish grows, its spikes shrink away.', 'The back edges of its top and bottom fins join into a stiff rudder called the clavus.', 'It is a sunfish now, just small!'],
    yesno: [['Do I have a tail?', false], ['Do I have fins?', true]] },
  school: { title: 'My school', pic: 'juvenile', gate: false,
    A: ['I see my friends.', 'We swim.'],
    B: ['I have friends.', 'We swim and eat.', 'We stay up at the top.'],
    C: ['I swim with other little sunfish.', 'We stay near the top and eat krill.'],
    D: ['Young sunfish often swim together in a school.', 'It is safer to stay with my friends.'],
    E: ['Young sunfish swim together in small schools near the surface.', 'Grown-up sunfish usually swim alone.'],
    yesno: [['Do I swim with friends?', true], ['Do we swim in the sky?', false]] },
  dorado: { title: 'A fast fish', pic: 'anchovy', gate: false,
    A: ['A big fish!', 'Go, go, go!'],
    B: ['A big fish comes.', 'It is fast.', 'I dash away!'],
    C: ['A big fast fish comes by.', 'I stay with my friends and dash away.'],
    D: ['A mahi-mahi is one of the fastest fish in the sea.', 'It misses me, and swims off.'],
    E: ['Mahi-mahi and tuna are fast enough to chase a young sunfish.', 'In my school it is hard to catch me.'],
    yesno: [['Was the fish fast?', true], ['Did it get me?', false]] },
  mola: { title: 'A real sunfish', pic: 'sunfish', gate: true,
    A: ['I am a sunfish!', 'I am big.'],
    B: ['I am big now.', 'I flap my fins.', 'I am a sunfish!'],
    C: ['Now I am a real sunfish.', 'I flap my top fin and my bottom fin.', 'I swim on my own.'],
    D: ['Now I am a real sunfish, round and flat like a big grey stone.', 'I flap my tall fins like wings.'],
    E: ['My name, Mola mola, means millstone: a big round stone.', 'I flap my tall top and bottom fins like wings, and my rudder steers.'],
    yesno: [['Am I a sunfish?', true], ['Do I have a long tail?', false]] },
  dive: { title: 'Down, down, down', pic: 'deep', gate: false,
    A: ['I go down.', 'It is dark.'],
    B: ['I dive down deep.', 'It is dark and cold.', 'I look for jellies.'],
    C: ['I dive down into the dark sea.', 'The jellies are down there in the day.'],
    D: ['I dive deep down where it is dark and cold.', 'In the day the jellies are deep.'],
    E: ['Sunfish dive hundreds of metres down to find jellies.', 'In the day the jellies stay deep, where it is dark.'],
    yesno: [['Is it dark down deep?', true], ['Is it hot down deep?', false]] },
  jellies: { title: 'Jelly snacks', pic: 'jelly', gate: false,
    A: ['I see a jelly.', 'Yum, yum!'],
    B: ['I see a jelly.', 'I eat it up.', 'Yum!'],
    C: ['I eat lots of jellies.', 'Jellies are soft, and I have a beak.'],
    D: ['I slurp up jellies, salps and comb jellies.', 'Jellies are mostly water, so I must eat lots of them.'],
    E: ['A sunfish eats lots of jellies, because jellies are mostly water.', 'Its teeth are joined into a beak, like a parrot.'],
    yesno: [['Do I eat jellies?', true], ['Do I eat rocks?', false]] },
  cold: { title: 'Brr!', pic: 'deep', gate: false,
    A: ['Brr! I am cold.', 'I go up.'],
    B: ['Brr! It is cold down here.', 'I swim up to the sun.'],
    C: ['It is so cold down deep.', 'I must swim up to the top to get warm.'],
    D: ['Deep down the water is as cold as a fridge.', 'I cannot stay down there for long.'],
    E: ['The deep water is as cold as a fridge.', 'A sunfish cools down while it hunts, so it must come up to warm up.'],
    yesno: [['Is the deep cold?', true], ['Can I stay deep for ever?', false]] },
  bask: { title: 'Sunbathing', pic: 'sun', gate: false,
    A: ['I see the sun.', 'I am warm.'],
    B: ['I go up to the top.', 'I lie flat in the sun.', 'I get warm.'],
    C: ['I lie flat on my side at the top.', 'The sun warms me up. Ahh!'],
    D: ['I lie flat on my side at the top of the sea.', 'The sun warms me after my cold dive.'],
    E: ['After a cold dive, a sunfish lies flat on its side in the sun.', 'That is how it got the name sunfish.'],
    yesno: [['Do I lie in the sun?', true], ['Do I lie on the sea floor?', false]] },
  gulls: { title: 'A bird helps', pic: 'gull', gate: false,
    A: ['A bird is on me!', 'It helps me.'],
    B: ['A gull sits on me.', 'It picks off the bugs.', 'Thank you!'],
    C: ['A gull lands on my side.', 'It picks the itchy bugs off my skin.'],
    D: ['A gull lands on me while I lie in the sun.', 'It pecks the sea lice off my skin. We both win!'],
    E: ['While a sunfish basks, gulls land and peck the sea lice off its skin.', 'The bird gets a snack and the sunfish gets clean.'],
    yesno: [['Does the gull help me?', true], ['Does the gull hurt me?', false]] },
  itchy: { title: 'Itchy!', pic: 'lice', gate: false,
    A: ['I am itchy!', 'I see bugs.'],
    B: ['I am itchy!', 'Little bugs are on my skin.', 'I want to get clean.'],
    C: ['Tiny bugs ride on my skin.', 'They make me itchy. I want to get clean!'],
    D: ['Sea lice and other tiny animals ride on my skin.', 'I swim to the kelp to get clean.'],
    E: ['Sunfish carry lots of parasites: more than forty kinds.', 'I swim to the kelp forest, where little fish clean sunfish.'],
    yesno: [['Am I itchy?', true], ['Do I like the bugs?', false]] },
  station: { title: 'The cleaning station', pic: 'cleaner', gate: false,
    A: ['I see little fish.', 'They clean me.'],
    B: ['Here is the kelp.', 'Little fish come.', 'I sit still. They clean me!'],
    C: ['I come to the kelp.', 'I hold still on my side.', 'Little fish pick the bugs off me.'],
    D: ['Little yellow fish and blue fish come to clean me.', 'I tilt on my side and hold very still.'],
    E: ['In the kelp forest, little yellow fish and halfmoon fish clean visiting sunfish.', 'The sunfish tilts on its side and holds very still.'],
    yesno: [['Do the little fish clean me?', true], ['Do I eat the little fish?', false]] },
  sealion: { title: 'A sea lion', pic: 'sealion', gate: false,
    A: ['I see a sea lion.', 'Go, go, go!'],
    B: ['A sea lion comes.', 'It is fast.', 'I flap away!'],
    C: ['A sea lion swims up to me.', 'It is fast and it wants to play.', 'I flap away and it swims off.'],
    D: ['A curious sea lion swims round and round me.', 'I give a big flap, and it swims away.'],
    E: ['California sea lions are fast, playful swimmers.', 'This one comes for a look, then swims away.'],
    yesno: [['Is the sea lion fast?', true], ['Did it get me?', false]] },
  orca: { title: 'Orcas!', pic: 'orca', gate: false,
    A: ['I see orcas!', 'Go, go!'],
    B: ['Here come the orcas.', 'They are big.', 'They swim on by.'],
    C: ['Some orcas swim past me.', 'They are big and black and white.', 'I flap away. They go on.'],
    D: ['A family of orcas swims past.', 'I give a big flap, and they swim on by.'],
    E: ['Orcas are the biggest dolphins, and they travel in family groups.', 'They swim on by and leave me be.'],
    yesno: [['Are orcas big?', true], ['Did the orcas get me?', false]] },
  shark: { title: 'A blue shark', pic: 'shark', gate: false,
    A: ['I see a shark.', 'Go, go, go!'],
    B: ['A shark comes.', 'It is blue.', 'I flap away!'],
    C: ['A long blue shark comes by.', 'I give a big flap and it misses me.'],
    D: ['A blue shark comes close.', 'I give a big flap of my fins, and it swims off.'],
    E: ['Blue sharks are long and slim and bright blue.', 'Big sharks, sea lions and orcas are almost the only animals that bother a big sunfish.'],
    yesno: [['Is the shark blue?', true], ['Did the shark get me?', false]] },
  turtle: { title: 'A big turtle', pic: 'turtle', gate: false,
    A: ['I see a turtle.', 'It is big.'],
    B: ['A big turtle swims by.', 'It eats jellies too!'],
    C: ['A huge turtle swims by.', 'It likes to eat jellies too.'],
    D: ['A leatherback turtle swims by.', 'It is the biggest turtle in the world, and it eats jellies too.'],
    E: ['The leatherback is the biggest turtle in the world.', 'It swims across the whole sea to eat jellies.'],
    yesno: [['Does the turtle eat jellies?', true], ['Is the turtle little?', false]] },
  boat: { title: 'A boat', pic: 'boat', gate: false,
    A: ['I see a boat.', 'I go down.'],
    B: ['A boat comes by.', 'It sees my fin.', 'It goes slow.'],
    C: ['A boat comes over the top.', 'It sees my fin and goes slow.'],
    D: ['My tall fin sticks out of the water and flops from side to side.', 'The boat sees it and goes slow.'],
    E: ['People sometimes think a sunfish fin is a shark fin!', 'A careful boat slows down when it sees one.'],
    yesno: [['Did the boat go slow?', true], ['Is my fin a shark fin?', false]] },
  net: { title: 'In a net', pic: 'net', gate: false,
    A: ['I am in a net!', 'Up I go.'],
    B: ['Oops! A net.', 'Up, up I go.', 'They let me go!'],
    C: ['Oops! I swam into a net.', 'The people pull me up and let me go.'],
    D: ['I swam into a fishing net by mistake.', 'The fishers lift me out and let me go back in the sea.'],
    E: ['Nets set for other fish sometimes catch sunfish by mistake.', 'Careful fishers lift them out and let them go.'],
    yesno: [['Did they let me go?', true], ['Do I stay in the net?', false]] },
  giant: { title: 'A giant!', pic: 'sunfish', gate: true,
    A: ['I am big, big, big!'],
    B: ['I eat and eat.', 'Now I am big, big, big!'],
    C: ['I ate lots and lots of jellies.', 'Now I am a giant sunfish!'],
    D: ['I am as heavy as a car now!', 'I grew sixty million times heavier than a baby.'],
    E: ['From a tiny hatchling, a sunfish can grow sixty million times heavier.', 'No other animal with a backbone grows so much.'],
    yesno: [['Am I big now?', true], ['Am I still a tiny baby?', false]] },
  breach: { title: 'Splash!', pic: 'sunfish', gate: false,
    A: ['I jump up!', 'Splash!'],
    B: ['I swim up fast.', 'I jump out of the sea!', 'Splash!'],
    C: ['I swim up fast and jump right out.', 'Splash! The itchy bugs fall off.'],
    D: ['I swim up fast and leap out of the sea.', 'I land with a big splash, and the lice shake off.'],
    E: ['Sunfish sometimes leap right out of the sea.', 'Scientists think it may help shake parasites off.'],
    yesno: [['Did I jump out?', true], ['Can I fly away?', false]] },
  journey: { title: 'To the warm sea', pic: 'sea', gate: false,
    A: ['I go to the sea.', 'Go, go, go!'],
    B: ['It is summer.', 'I swim and swim.', 'I go to the warm sea.'],
    C: ['It is summer now.', 'I swim out to the warm sea, far away.'],
    D: ['I am a grown-up sunfish now.', 'I swim far out to the warm sea, where I was an egg.'],
    E: ['Scientists think sunfish swim to warm parts of the sea to have babies.', 'I swim back out to where my life began.'],
    yesno: [['Do I swim to the warm sea?', true], ['Do I swim to the sky?', false]] },
  warmsea: { title: 'The warm sea', pic: 'heart', gate: true,
    A: ['I see a sunfish!', 'Hi, hi!'],
    B: ['Here is the warm sea.', 'I see a big sunfish.', 'Hi!'],
    C: ['I am in the warm sea at last.', 'Other big sunfish are here too.'],
    D: ['At last I am back in the warm sea.', 'I look for a sunfish with hearts all around.'],
    E: ['Back in the warm sea, other grown sunfish are gathering.', 'I look for a mate with hearts all around.'],
    yesno: [['Is the sea warm?', true], ['Am I all alone?', false]] },
  larvae: { title: 'Millions of eggs', pic: 'eggs', gate: true,
    A: ['I see eggs!', 'I see lots!'],
    B: ['Look at the eggs!', 'They float up.', 'Lots and lots!'],
    C: ['Millions of eggs float in the warm sea.', 'Soon they will hatch, just like I did.'],
    D: ['Millions of tiny eggs float in the warm sea.', 'Soon each one will hatch into a tiny baby sunfish.'],
    E: ['Hundreds of millions of eggs drift in the warm sea.', 'Each one may hatch and grow, and the life cycle starts again.'],
    yesno: [['Are there lots of eggs?', true], ['Is there one egg?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', glow: 'glow', anchovy: 'anchovy', combJelly: 'combjelly', gullDip: 'gull', schoolMade: 'school', dorado: 'dorado', tuna: 'dorado', dived: 'dive', ateJelly: 'jellies', chilly: 'cold', basking: 'bask', gullLand: 'gulls', itchy: 'itchy', cleaning: 'station', sealion: 'sealion', orca: 'orca', shark: 'shark', turtle: 'turtle', boat: 'boat', netted: 'net', jumped: 'breach', journey: 'journey' };

/* ---------- read-and-do missions ----------
   who: larva (a hatchling or a star) · juvenile (in the school) · mola (a grown sunfish, not on the journey)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'plankton', who: 'larva', A: 'Eat, eat, eat!', B: 'Eat lots of little shrimps.', C: 'Eat ten bits of plankton.', D: 'Eat ten bits of plankton.', E: 'Swim around and eat ten bits of plankton.' },
  { key: 'down', who: 'larva', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down a little way.', D: 'Dive down a little deeper.', E: 'Dive down a little deeper into the sea.' },
  { key: 'top', who: 'larva', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'dash', who: 'larva', from: 'B', A: 'Go, go, go!', B: 'Dash! Dash! Dash!', C: 'Dash three times.', D: 'Dash away three times.', E: 'Give three quick dashes.' },
  { key: 'krill', who: 'juvenile', A: 'Eat, eat, eat!', B: 'Eat the krill.', C: 'Eat five krill.', D: 'Eat five krill near the top.', E: 'Swim with your school and eat five krill.' },
  { key: 'friends', who: 'juvenile', A: 'Go to my friends.', B: 'Swim with my friends.', C: 'Stay with your school.', D: 'Stay close to your school.', E: 'Stay close to your school for a while.' },
  { key: 'dive', who: 'mola', A: 'Go down, down!', B: 'Dive down deep!', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark and cold.' },
  { key: 'jelly', who: 'mola', A: 'Eat a jelly.', B: 'Eat a jelly!', C: 'Find a jelly and eat it.', D: 'Find a jelly and slurp it up.', E: 'Dive down, find a jelly and slurp it up.' },
  { key: 'jellies', who: 'mola', from: 'B', A: 'Eat, eat, eat!', B: 'Eat three jellies.', C: 'Eat three jellies.', D: 'Slurp up three jellies.', E: 'Slurp up three jellies in a row.' },
  { key: 'salp', who: 'mola', from: 'C', A: 'Eat a salp.', B: 'Eat a salp.', C: 'Find a long salp and eat it.', D: 'Find a long chain of salps and eat it.', E: 'Find a long chain of salps deep down and eat it.' },
  { key: 'bask', who: 'mola', A: 'Go up to the sun.', B: 'Lie in the sun.', C: 'Lie flat in the sun.', D: 'Swim up and lie flat in the sun.', E: 'Swim up to the top and lie flat in the warm sun.' },
  { key: 'flap', who: 'mola', from: 'B', A: 'Flap, flap!', B: 'Flap my fins!', C: 'Give three big flaps.', D: 'Give three big flaps of your fins.', E: 'Give three big flaps of your tall fins.' },
  { key: 'up', who: 'mola', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until your fin sticks out.' },
  { key: 'kelp', who: 'mola', from: 'B', A: 'Go to the kelp.', B: 'Swim to the kelp.', C: 'Swim to the kelp forest.', D: 'Swim all the way to the kelp forest.', E: 'Swim to the kelp forest near the shore.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am an egg in the warm sea.', D: 'I am a tiny egg. Soon I will hatch.', E: 'I am a tiny egg drifting in the warm sea.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle! Hatch out!', C: 'My egg is ready. Wiggle!', D: 'My egg is ready. Wiggle to hatch out.', E: 'Push the arrows to wiggle out of my egg.' },
  swim: { A: 'Swim! Eat!', B: 'Swim and eat the little shrimps.', C: 'Swim and eat the little shrimps.', D: 'Swim around and eat the plankton.', E: 'Swim around and eat the tiny copepods.' },
  grow: { A: 'I am big!', B: 'I grew! I am big.', C: 'I grew!', D: 'I grew bigger!', E: 'I grew bigger again!' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more plankton to grow.', E: 'Eat more plankton to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Food is at the top.', D: 'At night the plankton swim up to the top.', E: 'At night the plankton swim up near the top.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Food is down deep.', D: 'In the day the plankton sink down deep.', E: 'In the day the plankton sink down where it is dark.' },
  flick: { A: 'Go, go!', B: 'Dash fast!', C: 'Press E to dash.', D: 'Press E for a quick dash.', E: 'Press E for a quick dash away.' },
  anchovy: { A: 'Fish! Go, go!', B: 'Fish! Dash away!', C: 'Fish! Dash away from them.', D: 'Anchovies! Dash away or dive.', E: 'A school of anchovies! Dash away or dive a little.' },
  missed: { A: 'I am up!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  jelly: { A: 'A jelly! Go!', B: 'A jelly! Swim away!', C: 'A jelly! Keep away from it.', D: 'A comb jelly! Keep away from it.', E: 'A comb jelly! Keep away while I am tiny.' },
  gull: { A: 'A bird! Go down!', B: 'A bird! Swim down!', C: 'A bird! Swim down a bit.', D: 'A gull! Dive a little deeper.', E: 'A gull is dipping at the top! Dive a little deeper.' },
  star: { A: 'I am a star!', B: 'I have spikes!', C: 'Spikes! I am a spiky star.', D: 'I am a spiky little star now.', E: 'I am a spiky little star now. Keep eating.' },
  spikes: { A: 'Go, go!', B: 'Spikes out! Dash!', C: 'Press E. Spikes out and dash!', D: 'Something big? Press E to dash.', E: 'Something big? Press E: spikes out and dash!' },
  juvenile: { A: 'I see my friends!', B: 'Swim with my friends!', C: 'Swim with the other little sunfish.', D: 'My spikes are fading. Swim with the school.', E: 'A rudder grows where a tail would be. Join the other young sunfish!' },
  friends: { A: 'Eat! Eat!', B: 'Stay with my friends. Eat!', C: 'Stay with my friends and eat krill.', D: 'Stay with the school and eat krill near the top.', E: 'Swim with my school and eat krill and little salps.' },
  far: { A: 'Go to my friends!', B: 'Go back to my friends!', C: 'My friends are over there. Go back!', D: 'My school is over there. Swim back.', E: 'My school is over there. Swim back to my friends.' },
  juvfood: { A: 'Eat it!', B: 'Eat the krill!', C: 'Krill! Bump them to eat.', D: 'Krill and salps! Bump into them to eat.', E: 'Krill and little salps! Swim into them to eat them.' },
  dorado: { A: 'A fish! Go!', B: 'A fast fish! Dash!', C: 'A fast fish! Stay with my friends.', D: 'A fast fish! Stay in the school or dash.', E: 'A fast fish! Stay in my school, or press E to dash.' },
  dodged: { A: 'I am up!', B: 'Whoosh! It missed me!', C: 'Whoosh! It did not get me.', D: 'Whoosh! It missed me and swam off.', E: 'Whoosh! It missed me and swam away.' },
  mola: { A: 'Go down!', B: 'Dive deep for jellies!', C: 'Dive down deep to find jellies.', D: 'I am a sunfish! Dive deep for jellies.', E: 'I am a real sunfish now! Dive deep to find jellies.' },
  dive: { A: 'Go down, down!', B: 'Go down, down for jellies!', C: 'The jellies are down deep. Dive!', D: 'In the day the jellies are deep. Dive down.', E: 'Jellies live deep down in the day. Swim down into the dark.' },
  eat: { A: 'Eat it!', B: 'A jelly! Eat it!', C: 'A jelly! Go to it and eat it.', D: 'A jelly! Swim to it and slurp it up.', E: 'A jelly! Swim up to it and slurp it up.' },
  cold: { A: 'Brr! Go up!', B: 'Cold! Swim up!', C: 'It is cold. Swim up to get warm.', D: 'Brr! The deep is cold. Swim up to warm up.', E: 'Brr! The deep is cold. Swim up to the sun to warm up.' },
  chilly: { A: 'Up I go!', B: 'Too cold! Up I go.', C: 'Too cold! I float up to the top.', D: 'Too cold! I float up to the sunny top.', E: 'Too cold! I float up to the sunny top to warm up.' },
  bask: { A: 'Sun!', B: 'Lie in the sun!', C: 'Lie flat in the sun to get warm.', D: 'At the top! Lie flat in the sun.', E: 'At the top! Lie flat on my side in the sun to warm up.' },
  basking: { A: 'I am warm.', B: 'Warm sun. Ahh!', C: 'I lie in the sun. I get warm.', D: 'I lie flat in the sun and warm up.', E: 'I lie flat in the sun and warm up after my dive.' },
  warm: { A: 'Go down!', B: 'Warm! Dive again!', C: 'I am warm. Dive down again!', D: 'Warm again! Dive down for more jellies.', E: 'Warm again! Dive down for more jellies.' },
  gulls: { A: 'A bird! It helps.', B: 'A gull picks the bugs off!', C: 'A gull picks the bugs off my skin.', D: 'A gull lands on me and pecks the sea lice off.', E: 'A gull landed on me! It pecks off the itchy sea lice.' },
  itchy: { A: 'I am itchy!', B: 'Itchy! Go to the kelp!', C: 'Itchy! Swim to the kelp to get clean.', D: 'I am itchy! Follow the arrow to the kelp.', E: 'I am itchy with sea lice! Follow the arrow to the kelp forest.' },
  station: { A: 'Sit still!', B: 'Sit still! Get clean.', C: 'Little fish clean me here. Hold still!', D: 'Little fish clean sunfish here. Hold still.', E: 'Little fish clean sunfish here. Hold very still.' },
  clean: { A: 'Sit still!', B: 'Sit still!', C: 'Hold still for the little fish.', D: 'Hold still for the cleaner fish.', E: 'Hold very still for the cleaner fish.' },
  cleaning: { A: 'I get clean.', B: 'Little fish clean me.', C: 'Little fish pick the bugs off me.', D: 'Little fish pick the sea lice off me.', E: 'Little yellow and blue fish pick me clean.' },
  cleaned: { A: 'I am clean!', B: 'All clean! Go eat!', C: 'All clean! Go and find jellies.', D: 'All clean! Back out to sea for jellies.', E: 'All clean! Back out to the open sea to find jellies.' },
  grew: { A: 'I am big!', B: 'I grew big!', C: 'I grew! Look how big I am.', D: 'I grew bigger! Look at me now.', E: 'I grew bigger! Look how big I am now.' },
  full: { A: 'I am itchy!', B: 'Get clean first!', C: 'I am too itchy. Get clean first.', D: 'I am too itchy to grow. Get clean first.', E: 'I am too itchy to grow. Get clean at the kelp first.' },
  sealion: { A: 'Go, go!', B: 'A sea lion! Flap away!', C: 'A sea lion! Flap away from it.', D: 'A sea lion! Give a big flap away.', E: 'A curious sea lion! Give a big flap away.' },
  orca: { A: 'Go, go!', B: 'Orcas! Flap away!', C: 'Orcas! Give a big flap.', D: 'Orcas! Give a big flap and they go on by.', E: 'Orcas! Give a big flap and they swim on by.' },
  shark: { A: 'Go, go!', B: 'A shark! Flap away!', C: 'A shark! Give a big flap.', D: 'A blue shark! Give a big flap away.', E: 'A blue shark! Give a big flap away.' },
  boat: { A: 'A boat! Go down!', B: 'A boat! Swim down!', C: 'A boat! Dive down a bit.', D: 'A boat! Dive down and let it pass.', E: 'A boat! Dive down a little and let it pass.' },
  net: { A: 'Up I go!', B: 'A net! Wait.', C: 'Oops! A net. Wait for them.', D: 'Oops! A net. The fishers will let me go.', E: 'Oops! A fishing net. The fishers will lift me out and let me go.' },
  freed: { A: 'In I go!', B: 'Back in the sea!', C: 'They let me go! Back in the sea.', D: 'The fishers let me go back in the sea.', E: 'The fishers let me go. Back into the sea I go!' },
  breach: { A: 'Jump!', B: 'Swim up fast. Jump!', C: 'Swim up fast and jump out!', D: 'Swim up fast and jump right out of the sea!', E: 'Swim up to the top and press E to jump right out!' },
  jumped: { A: 'Splash!', B: 'Splash! I jump!', C: 'Splash! I jumped out of the sea!', D: 'Splash! The lice shook off.', E: 'Splash! I jumped out of the sea and shook the lice off.' },
  journey: { A: 'Go, go, go!', B: 'Go to the warm sea!', C: 'Swim to the warm sea far away.', D: 'Follow the arrow to the warm sea.', E: 'Summer is here! Follow the arrow out to the warm sea.' },
  arrived: { A: 'I see the sea!', B: 'The warm sea!', C: 'I am in the warm sea!', D: 'The warm sea! Other sunfish are here.', E: 'The warm sea! Other grown sunfish are here.' },
  findgirl: { A: 'Go to a sunfish!', B: 'Find a girl sunfish!', C: 'Find the girl sunfish with hearts.', D: 'Find the girl sunfish with the hearts.', E: 'Find the girl sunfish with the hearts and swim beside her.' },
  findboy: { A: 'Go to a sunfish!', B: 'Find a boy sunfish!', C: 'Find the boy sunfish with hearts.', D: 'Find the boy sunfish with the hearts.', E: 'Find the boy sunfish with the hearts and swim beside him.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the sunfish.', E: 'Go and say hello to the sunfish.' },
  cloud: { A: 'Let it go!', B: 'Let my cloud go!', C: 'Swim by her. Let my cloud go.', D: 'Swim beside her and let my cloud go.', E: 'Swim beside her and let my little cloud go.' },
  release: { A: 'Go, go, go!', B: 'Wait for the glow!', C: 'When it glows, let the eggs go!', D: 'When the glow swells, let my eggs go!', E: 'When the glow swells, let my eggs go into the sea!' },
  larvae: { A: 'I see eggs!', B: 'Look at the eggs!', C: 'Lots of new eggs float in the sea!', D: 'Millions of new eggs float in the warm sea.', E: 'Millions of new eggs drift in the warm sea, and it all starts again.' },
  done: { A: 'Yes!', B: 'All done!', C: 'My job is done!', D: 'My job is done. I swim on.', E: 'My job is done. I swim on in the warm sea.' },
  turtle: { A: 'A turtle!', B: 'A big turtle!', C: 'A big turtle! It eats jellies too.', D: 'A leatherback turtle! It eats jellies too.', E: 'A leatherback turtle! It eats jellies, just like me.' }
};
