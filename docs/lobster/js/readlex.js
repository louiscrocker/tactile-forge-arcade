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
/* words only Lobster needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'dig flip fan box hi big blue swim go in out hole home mum hide boss yum',
  B: 'hatch so skin yum lots now wiggle pop off mum shade top catch wait mine again him win say away find by over into day whoosh ok good grow food way hard deep back soft went gone dots eat them us glow dark under her fans comes lights its mouth open dips snap old walk winter rest spring wants dive bits that some your float taken try got use moult his done',
  C: 'mum food takes tail land moult shell old years live glows soil sky another won girl lose ten bits jumpy made people shark bus come comes tight did more bump swims as eats does boy safe jumps others cool hid had full try best his when stone stones den stay keep bait man bigger legs feet smell nose side sides each uses stronger most cut floor mud sand walk walks swam cobble bed fight guard many tiny taken tree fly grown summer float free shine ride backwards makes crusher thin cutter splits autumn hill hot ever wave push clean bit times lives shoot came kept still past job shot rainbow things',
  D: 'carries paddles touch salty eyes spike half shrimp crawl onto pea small took nine cool damp place hand wide moment right flash light school biggest world mouth opens drifts along free sharp tips breathe dries split inside huge season millions leave march built male who ready female carry twelve fallen pretty sweet grown her helps walk around sink dash or tumbled but follow arrow deeper enough give heave pushed growing brothers sisters crusher cutter claw claws teeth tummy bones strong snaps backwards forwards hunters gauge measures lets rule autumn storms calm walked deeper rests ice lobsterman trap stay nobody second weeks months smaller stronger flipped taste hairs antennae fans summer stage iv bottom holes hides moults year snails quick comb shining sting drifters basking hovers snatch seals hunt zoom often calcium which breaks shells tears becomes pull hidden smells goes shallow stormy offshore stays warmer warms drift crack spiky dinner fanning something drifted tucked hunter left behind decided through swells backed settling walking',
  E: 'mother dawn stands edge shakes once grain rice body spikes stretch wriggle walking swimming thousands together five across turn baby reach moulted fully each hatches touches quarter starts larva month moults own called bioluminescence shining sweeps past swallow sucks mouthfuls visit larvae straight shady places lives alone pump myself hardens calcium weigh much cat looking signal pour great begins people build low guide safely soak salt boys fight shove gives hurt strongest part hundred thousand munch ripe chase drifts makes than year their bumps sharks near coming towards seabird digging cross rival hello job done marching postlarva superlobster nursery cobbles restricted beating rows rainbow basking straining centimetres hovers snatch surface nobody choose decided grinding stomach copper offshore temperature changes curious fronds forest kelp shelter crevice remember rarely dominant berried nine fanned float frees glued mated glue stalks fastest muscles tall dives looks young whatever moulting life eight animals slowly gulf maine cod especially ones moves beside harden faster different rounded breaking slim edges hauls shallows less few degrees inshore return dens loser backs nibble practise escape arrows dipping let far urchins'
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
  lobster: 'lobster', lobsters: 'lobster', egg: 'egg', eggs: 'eggs', larva: 'larva', larvae: 'larva',
  sea: 'sea', ocean: 'sea', water: 'water', plankton: 'plankton', copepod: 'copepod',
  jelly: 'combjelly', shark: 'basking', fish: 'herring', herring: 'herring', bird: 'tern', tern: 'tern', seal: 'seal',
  cobble: 'cobble', cobbles: 'cobble', stone: 'cobble', stones: 'cobble', rock: 'cobble', rocks: 'cobble',
  den: 'den', hole: 'den', shell: 'shell', claw: 'claw', claws: 'claw', tail: 'tail',
  mussel: 'mussel', mussels: 'mussel', crab: 'crab', crabs: 'crab', urchin: 'urchin', snail: 'snail', kelp: 'kelp', seaweed: 'kelp',
  trap: 'trap', bait: 'trap', lobsterman: 'lobsterman', boat: 'boat', moon: 'moon', sun: 'sun', mud: 'mud', deep: 'deep', snow: 'snow'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  eat:    { A: 'eat',    B: 'eat it',     C: 'eat it up',            D: 'eat this food',            E: 'Eat it up. Yum!' },
  settle: { A: 'in',     B: 'go in',      C: 'go into the hole',     D: 'go in and stay',           E: 'Go in. This hole is my home.' },
  moult:  { A: 'out',    B: 'get out',    C: 'get out of my shell',  D: 'back out of my old shell', E: 'Back out of my old shell and moult.' },
  shell:  { A: 'yum',    B: 'eat shell',  C: 'eat my old shell',     D: 'eat my old shell up',      E: 'Eat my old shell. It makes me strong.' },
  bait:   { A: 'go',     B: 'go in it',   C: 'go in the trap',       D: 'go in the trap for bait',  E: 'Walk into the trap and eat the bait.' },
  box:    { A: 'box',    B: 'box him',    C: 'box the lobster',      D: 'box him with my claws',    E: 'Box him away from my den!' },
  meet:   { A: 'hi',     B: 'say hi',     C: 'go and say hi',        D: 'say hi to the lobster',    E: 'Go and say hello.' },
  fan:    { A: 'fan',    B: 'fan them',   C: 'fan my tail',          D: 'fan the larvae free',      E: 'Fan my tail and let the larvae go.' }
};
/* the picture on each action card */
const ACTION_PIC = { eat: 'mussel', settle: 'den', moult: 'shell', shell: 'shell', bait: 'trap', box: 'rival', meet: 'lobster', fan: 'eggs' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the lobster's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'An egg under her tail', pic: 'eggs', gate: false,
    A: ['I am an egg.', 'I am in the sea.', 'I see my mum.'],
    B: ['I am a little egg.', 'Mum has lots of eggs.', 'They are under her tail.'],
    C: ['I am a little egg.', 'My mum has lots and lots of eggs.', 'They are under her tail, in her den.'],
    D: ['My mum carries her eggs under her tail.', 'She keeps them for nine months.', 'Soon a summer night will come.'],
    E: ['A mother lobster carries thousands of eggs under her tail.', 'She keeps them clean for nine months.', 'On a summer night she will fan the larvae free.'],
    yesno: [['Am I an egg?', true], ['Am I a big lobster?', false]] },
  hatch: { title: 'Float free!', pic: 'larva', gate: true,
    A: ['I am out!', 'I am a larva.', 'I can swim.'],
    B: ['Mum fans her tail.', 'Pop! I hatch out.', 'I am a little larva.'],
    C: ['It is night. Mum fans her tail.', 'Pop! I hatch out of my egg.', 'Now I am a larva. I swim up!'],
    D: ['On a summer night, Mum fans her tail paddles.', 'I hatch and float free.', 'I am a tiny larva. I swim up to the light.'],
    E: ['On a summer night my mother stands tall and fans her tail.', 'I hatch and float free, as small as a grain of rice.', 'I swim up to the surface, where the plankton is.'],
    yesno: [['Am I in the sea?', true], ['Am I a big lobster now?', false]] },
  larva2: { title: 'Too tight!', pic: 'larva', gate: true,
    A: ['I am a larva.', 'I eat, eat, eat.'],
    B: ['My skin is too little.', 'I wiggle out of it!', 'Now I am big.'],
    C: ['I eat lots of green plankton.', 'My skin is too tight.', 'I wiggle out of it. Now I am big!'],
    D: ['When my skin gets too tight, I must get out of it.', 'I moult and come out bigger.', 'Now I am a bigger larva.'],
    E: ['A larva can not stretch its skin, so it must moult.', 'I split my old skin and wriggle out.', 'My new skin is soft and bigger.'],
    yesno: [['Did I get out of my skin?', true], ['Am I a fish now?', false]] },
  grow: { title: 'Bigger and bigger', pic: 'plankton', gate: false,
    A: ['I eat, eat, eat.', 'I am a big larva!'],
    B: ['I eat the green plankton.', 'I am a big larva now.'],
    C: ['I moult again.', 'I eat lots and grow big.'],
    D: ['I moult again and get bigger.', 'Soon I will look like a lobster.'],
    E: ['Every moult makes me a little bigger.', 'A lobster larva moults three times in the plankton.'],
    yesno: [['Do I eat plankton?', true], ['Do I eat rocks?', false]] },
  postlarva: { title: 'Stage IV!', pic: 'postlarva', gate: true,
    A: ['Look at me!', 'I am a lobster.'],
    B: ['Look at me now!', 'I have two little claws.', 'I look like a lobster!'],
    C: ['I moult one more time.', 'Now I look like a tiny lobster.', 'I swim with my tail. I want to go down.'],
    D: ['After my last moult I am stage IV.', 'I look like a tiny lobster and swim forwards with my tail.', 'Now I must dive to the bottom.'],
    E: ['Stage IV is called the postlarva, or the superlobster.', 'It has claws, legs and a tail fan, and swims forwards.', 'It is time to dive down and find the cobbles.'],
    yesno: [['Do I have claws?', true], ['Am I a fish?', false]] },
  settle: { title: 'A hole of my own', pic: 'den', gate: true,
    A: ['I see a hole.', 'I go in!'],
    B: ['Here is a stone.', 'Here is a hole.', 'I go in. It is mine!'],
    C: ['I look under the stones.', 'This hole is taken. That one is not!', 'I go in. It is my home!'],
    D: ['I dive down to the cobbles and look for a hole.', 'Many holes are taken by other little lobsters.', 'At last I find a free one. It is my home.'],
    E: ['The postlarva dives down to the cobble bed.', 'It looks under stone after stone for a hole that nobody is in.', 'A free hole is hard to find, so it stays in the first free one.'],
    yesno: [['Do I live under a stone?', true], ['Do I live in a tree?', false]] },
  nursery: { title: 'Under my stone', pic: 'cobble', gate: false,
    A: ['I hide.', 'I eat.', 'I am in my hole.'],
    B: ['I hide under my stone.', 'Food comes in.', 'I eat it.'],
    C: ['I stay under my stone for years.', 'I eat the bits that come in.', 'I moult and moult and grow.'],
    D: ['A little lobster hides under its stone for years.', 'It eats what drifts in and moults about ten times in its first year.'],
    E: ['A young lobster is shelter restricted: it stays under its cobble for years.', 'It eats whatever drifts in, and moults about ten times in its first year.', 'The cobble bed is the lobster nursery.'],
    yesno: [['Do I hide under a stone?', true], ['Do I fly?', false]] },
  forage: { title: 'Out at night', pic: 'mussel', gate: true,
    A: ['I go out.', 'I eat, eat, eat!', 'Yum!'],
    B: ['It is night. I go out.', 'I find a mussel.', 'Yum, yum, yum!'],
    C: ['I am bigger now.', 'At night I go out to find food.', 'A mussel! Snap! Yum.'],
    D: ['Now I am big enough to go out at night.', 'I find mussels, crabs and snails on the sea floor.', 'By day I hide under my stone again.'],
    E: ['Lobsters hide by day and come out at night to eat.', 'I smell mussels, crabs and urchins and find them in the dark.', 'Before the sun comes up I go back under my cobble.'],
    yesno: [['Do I go out at night?', true], ['Do I eat the sun?', false]] },
  adult: { title: 'Grown up!', pic: 'adult', gate: true,
    A: ['I am big!', 'Look at my claws!'],
    B: ['Look at me!', 'I am a big lobster now.', 'Look at my big claws!'],
    C: ['I moult under my stone.', 'Now I am a big lobster.', 'I am grown up!'],
    D: ['It took years for me to grow up.', 'My shell is as long as a hand.', 'Soon autumn will come.'],
    E: ['I moulted again and again, and now I am fully grown.', 'A big lobster keeps on moulting and growing all its life.', 'Now I wait for the cold of autumn.'],
    yesno: [['Am I a big lobster?', true], ['Am I an egg?', false]] },
  larvae: { title: 'Float free', pic: 'eggs', gate: true,
    A: ['I fan my tail.', 'Go, go, go!'],
    B: ['It is night.', 'Fan, fan, fan!', 'The larvae go.'],
    C: ['It is a summer night.', 'I fan my tail.', 'The larvae float free!'],
    D: ['On a summer night I climb onto my stone.', 'I fan my tail paddles and the larvae float free.', 'They swim up to the top of the sea.'],
    E: ['On a summer night the eggs are ready.', 'The mother fans her tail and thousands of larvae float free.', 'They swim up to the surface, and it all starts again.'],
    yesno: [['Do the larvae go free?', true], ['Do the larvae go up a tree?', false]] },
  glow: { title: 'The glowing sea', pic: 'plankton', gate: false,
    A: ['I see it!', 'It is blue!'],
    B: ['It is night.', 'Look! Blue dots!', 'They glow.'],
    C: ['It is night in the sea.', 'I bump some plankton and it glows blue!'],
    D: ['At night, some tiny plankton flash blue.', 'They light up when I bump them.'],
    E: ['Some plankton make their own light.', 'When something bumps them, they flash bright blue.', 'This is called bioluminescence.'],
    yesno: [['Do some plankton glow?', true], ['Is the glow red?', false]] },
  herring: { title: 'Herring!', pic: 'herring', gate: false,
    A: ['I see fish!', 'Go, go, go!'],
    B: ['Look at all the fish!', 'They want to eat.', 'I swim away fast!'],
    C: ['Lots of herring swim by.', 'They eat plankton.', 'I swim away from them.'],
    D: ['A school of herring comes by.', 'They eat plankton as they swim.', 'My quick tail keeps me safe.'],
    E: ['A shining school of herring sweeps past.', 'Herring gulp plankton, so I dive deep and swim away.', 'My spikes and my quick tail make me hard to catch.'],
    yesno: [['Do herring eat plankton?', true], ['Am I a fish?', false]] },
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
    C: ['A big shark swims by.', 'It is as big as a bus!', 'It eats plankton, not lobsters.'],
    D: ['The basking shark is the second biggest fish in the world.', 'It opens its huge mouth to eat plankton.', 'I swim away from its mouth.'],
    E: ['The basking shark is as long as a bus, but it has no sharp teeth.', 'It swims slowly with its mouth open, straining plankton from the sea.', 'Basking sharks visit the Gulf of Maine every summer.'],
    yesno: [['Is the shark big?', true], ['Does it eat rocks?', false]] },
  tern: { title: 'A bird!', pic: 'tern', gate: false,
    A: ['I see a bird.', 'I go down!'],
    B: ['Look at the bird!', 'It dips at the top.', 'I go down, down.'],
    C: ['A bird dips at the top of the sea.', 'I swim down, away from it.'],
    D: ['A tern hovers over the water and dips to snatch tiny things.', 'I dive a little deeper.'],
    E: ['A tern hovers over the sea and dips to snatch tiny things from the surface.', 'Deeper down, nobody can see me.'],
    yesno: [['Do I swim down?', true], ['Do I fly up?', false]] },
  hide: { title: 'Hide!', pic: 'cobble', gate: false,
    A: ['I see a fish.', 'I hide!'],
    B: ['A big fish is here.', 'I hide under my stone.'],
    C: ['A big fish swims by.', 'I hide under a stone and keep still.'],
    D: ['Big fish and seals hunt little lobsters by day.', 'So I hide under a stone and come out at night.'],
    E: ['Cod, seals and other hunters look for lobsters, especially soft ones.', 'I hide under a cobble by day, and keep my tail ready to flip.'],
    yesno: [['Do I hide from the fish?', true], ['Do I ride the fish?', false]] },
  flip: { title: 'The tail flip', pic: 'tail', gate: false,
    A: ['I flip my tail.', 'I go, go, go!'],
    B: ['Snap! I flip my tail.', 'I go back, back, back!'],
    C: ['A fish comes at me.', 'Snap! I flip my tail and shoot back.', 'It did not get me!'],
    D: ['A lobster walks forwards but swims backwards.', 'Snap! I flip my tail and zoom away from the fish.'],
    E: ['The tail flip is one of the fastest moves in the sea.', 'Big muscles snap my tail under my body, and I shoot backwards out of reach.'],
    yesno: [['Do I go backwards?', true], ['Do I fly?', false]] },
  shellmeal: { title: 'My old shell', pic: 'shell', gate: false,
    A: ['I see my shell.', 'I eat it!'],
    B: ['My old shell is here.', 'I eat it up. Yum!'],
    C: ['I get out of my old shell.', 'Then I eat it!', 'It makes my new shell hard.'],
    D: ['A lobster often eats its old shell after a moult.', 'The shell is full of calcium, which makes the new shell strong.'],
    E: ['After I moult, my old shell is still beside me.', 'I eat it, because it is full of calcium.', 'That helps my soft new shell harden faster.'],
    yesno: [['Do I eat my old shell?', true], ['Is my old shell a fish?', false]] },
  claws: { title: 'Crusher and cutter', pic: 'claw', gate: false,
    A: ['Look at my claws!', 'It is big!'],
    B: ['I have two claws.', 'One is big.', 'One is little.'],
    C: ['One claw is big. It is the crusher.', 'One claw is thin. It is the cutter.', 'I use the big one most!'],
    D: ['I have a crusher claw and a cutter claw.', 'The crusher breaks shells. The cutter tears food.', 'The claw I use most becomes the crusher.'],
    E: ['A lobster has two different claws.', 'The big crusher has rounded teeth for breaking shells, and the slim cutter has sharp edges.', 'Which side becomes the crusher is decided by the claw a young lobster uses most.'],
    yesno: [['Is one claw big?', true], ['Do I have ten claws?', false]] },
  moult: { title: 'Out of my shell', pic: 'shell', gate: false,
    A: ['I am in my hole.', 'Look at me!'],
    B: ['My shell is too little.', 'I get out of it!'],
    C: ['I hide under my stone.', 'My shell splits on my back.', 'I back out of it. Now I am big!'],
    D: ['My old shell splits along my back.', 'I back out of it and pull my claws free.', 'My new shell is soft, so I stay hidden until it gets hard.'],
    E: ['A lobster must moult to grow, because its shell can not stretch.', 'The old shell splits along the back, and I back out and pull my claws free.', 'Then I pump myself up with water and hide while the new shell hardens.'],
    yesno: [['Do I get out of my old shell?', true], ['Is my new shell hard?', false]] },
  trap: { title: 'The trap', pic: 'trap', gate: false,
    A: ['I see a trap.', 'I go in!'],
    B: ['Here is a trap.', 'It has food in it.', 'I go in!'],
    C: ['A trap comes down.', 'It has bait in it. Yum!', 'I go in and eat.'],
    D: ['A lobsterman lets his trap down to the sea floor.', 'It smells of fish, so I walk in to eat the bait.', 'Up, up it goes!'],
    E: ['A lobsterman hauls up his trap and measures me with a gauge.', 'I am too small, so he lets me go.', 'That is the rule in Maine: small lobsters go straight back.'],
    yesno: [['Do I go in the trap?', true], ['Do I stay on the boat?', false]] },
  autumn: { title: 'Autumn', pic: 'deep', gate: false,
    A: ['I go down.', 'Go, go, go!'],
    B: ['The sea is cold now.', 'I walk to the deep.'],
    C: ['It is autumn. The sea is cold.', 'All the lobsters walk out to the deep.', 'I walk too.'],
    D: ['In autumn the shallow water gets cold and stormy.', 'The lobsters walk offshore to the deep.', 'It is a long walk.'],
    E: ['In autumn the shallows get cold and stormy.', 'Lobsters walk offshore to deep water, where it is calm and the temperature changes less.', 'Some walk a very long way.'],
    yesno: [['Do I walk to the deep?', true], ['Do I walk up a hill?', false]] },
  winter: { title: 'Winter in the deep', pic: 'mud', gate: false,
    A: ['I dig in the mud.', 'I sleep.'],
    B: ['It is winter.', 'I dig in the mud and rest.'],
    C: ['It is winter.', 'I dig into the mud.', 'I rest and wait for spring.'],
    D: ['In winter I dig into the soft mud of the deep.', 'The deep water stays a little warmer.', 'I rest until spring.'],
    E: ['Deep water stays a few degrees warmer than the surface in winter.', 'I dig into the mud and rest, eating very little, until spring.'],
    yesno: [['Do I rest in winter?', true], ['Is the deep water hot?', false]] },
  spring: { title: 'Back home', pic: 'cobble', gate: false,
    A: ['I see my home.', 'I go home!'],
    B: ['Spring is here!', 'I walk back home.'],
    C: ['It is spring. The sea is warm again.', 'I walk back to the cobble bed.'],
    D: ['In spring the sea warms up again.', 'I walk all the way back to the cobble bed.', 'It is my home.'],
    E: ['When the sea warms in spring, the lobsters walk back inshore.', 'I return to the cobble bed where I grew up.'],
    yesno: [['Do I go back home?', true], ['Do I stay in the deep for ever?', false]] },
  rival: { title: 'My den!', pic: 'rival', gate: false,
    A: ['I see a lobster.', 'Box, box, box!'],
    B: ['A big lobster is here.', 'He wants my den.', 'I will box him!'],
    C: ['Another boy lobster wants my den.', 'We wave our claws.', 'We push and box.'],
    D: ['Another male wants my den.', 'We wave our claws and push.', 'Who will win?'],
    E: ['Boy lobsters fight to keep the best dens.', 'We wave our claws, push and box until one gives up.', 'The loser backs away. Nobody is hurt.'],
    yesno: [['Do we box?', true], ['Do we sing?', false]] },
  boss: { title: 'Boss of the cobble bed', pic: 'boss', gate: false,
    A: ['I am the boss!', 'Look at me!'],
    B: ['I win, I win!', 'This den is mine.'],
    C: ['I won! My den is safe.', 'Now a girl lobster can find me.'],
    D: ['I won every fight.', 'Now my den is ready for a female.'],
    E: ['I am the strongest lobster on this part of the cobble bed.', 'A female will come to my den soon, to moult where it is safe.'],
    yesno: [['Did I win?', true], ['Did I lose my den?', false]] },
  brood: { title: 'Eggs under my tail', pic: 'female', gate: false,
    A: ['I see my eggs.', 'I sleep.'],
    B: ['I have lots of eggs.', 'They are under my tail.', 'I wait and wait.'],
    C: ['I have lots and lots of eggs.', 'They are under my tail.', 'I keep them clean and fan them.'],
    D: ['I carry my eggs under my tail.', 'I fan them and keep them clean for nine months.'],
    E: ['I carry thousands of eggs under my tail, glued to my tail paddles.', 'For nine months I keep them clean and fan water over them.'],
    yesno: [['Do I have eggs?', true], ['Do I go up a tree?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'egg', larva3: 'grow', glow: 'glow', herring: 'herring', combJelly: 'combjelly', basking: 'basking', ternDip: 'tern', settled: 'nursery', predator: 'hide', flipped: 'flip', exuviaReady: 'shellmeal', crusher: 'claws', lobMolted: 'moult', trapDown: 'trap', migrate: 'autumn', winterStart: 'winter', winterDone: 'spring', rivalArrived: 'rival', boss: 'boss', brooding: 'brood' };

/* ---------- read-and-do missions ----------
   who: larva · swim (larva or postlarva) · post (postlarva near the bottom) · juvenile (in its nursery hole)
        · forage (a young or adult lobster out walking) · walk (on the long walk) · rival (a rival is here)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'plankton', who: 'larva', A: 'Eat, eat, eat!', B: 'Eat lots of green plankton.', C: 'Eat ten bits of plankton.', D: 'Eat ten bits of green plankton.', E: 'Swim around and eat ten bits of plankton.' },
  { key: 'deep', who: 'swim', A: 'Go down, down!', B: 'Swim down, down, down.', C: 'Dive down to the dark water.', D: 'Dive down deep into the dark sea.', E: 'Dive down deep where the water is dark.' },
  { key: 'top', who: 'swim', A: 'Go up, up!', B: 'Swim up to the top.', C: 'Swim up to the top of the sea.', D: 'Swim up to the top of the water.', E: 'Swim up until you can see the sky.' },
  { key: 'copepod', who: 'larva', from: 'B', A: 'Eat the copepod!', B: 'Catch a copepod!', C: 'Catch a jumpy copepod.', D: 'Catch a copepod. It is fast!', E: 'Chase a jumpy copepod and catch it.' },
  { key: 'bottom', who: 'post', A: 'Go to the stones.', B: 'Dive to the stones.', C: 'Dive down to the cobbles.', D: 'Dive down to the cobble bed.', E: 'Dive all the way down to the cobble bed.' },
  { key: 'drift', who: 'juvenile', A: 'Eat, eat, eat!', B: 'Eat the bits that come in.', C: 'Eat three bits of food.', D: 'Eat three bits that drift in.', E: 'Eat three bits of food that drift into your hole.' },
  { key: 'mussel', who: 'forage', A: 'Eat a mussel.', B: 'Find a mussel.', C: 'Find a mussel and eat it.', D: 'Find a mussel and crack it open.', E: 'Find a mussel on the sea floor and eat it.' },
  { key: 'urchin', who: 'forage', from: 'B', A: 'Eat an urchin.', B: 'Find an urchin.', C: 'Find an urchin and eat it.', D: 'Find a spiky urchin to eat.', E: 'Find a green urchin and flip it over.' },
  { key: 'crab', who: 'forage', A: 'Eat a crab.', B: 'Catch a crab.', C: 'Catch a crab and eat it.', D: 'Catch a little crab for dinner.', E: 'Catch a little crab and eat it up.' },
  { key: 'kelp', who: 'forage', A: 'Eat kelp.', B: 'Find some kelp.', C: 'Find a bit of kelp to eat.', D: 'Find a bit of kelp and eat it.', E: 'Find a bit of fallen kelp and nibble it.' },
  { key: 'flip', who: 'forage', A: 'Flip, flip, flip!', B: 'Flip your tail.', C: 'Flip your tail three times.', D: 'Snap your tail and shoot backwards.', E: 'Flip your tail three times to practise your escape.' },
  { key: 'dig', who: 'forage', A: 'Dig, dig, dig!', B: 'Dig a hole.', C: 'Dig a den under a stone.', D: 'Dig a deep den under a cobble.', E: 'Dig a den in the sand under a cobble.' },
  { key: 'hide', who: 'forage', A: 'Go to a stone.', B: 'Hide by a stone.', C: 'Hide under a stone.', D: 'Find a stone to hide under.', E: 'Find a cobble or some kelp and hide.' },
  { key: 'offshore', who: 'walk', from: 'B', A: 'Go to the deep.', B: 'Walk to the deep!', C: 'Walk out to the deep.', D: 'Walk all the way out to the deep.', E: 'Walk offshore all the way to the deep.' },
  { key: 'rival', who: 'rival', A: 'Box the lobster!', B: 'Box the big lobster!', C: 'Go and box the other lobster.', D: 'Box the other lobster away.', E: 'Box the other lobster away from your den.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  egg: { A: 'I am an egg.', B: 'I am an egg. Wait.', C: 'I am an egg under my mum.', D: 'I am an egg. Soon a summer night will come.', E: 'I am an egg under my mother, in her den.' },
  hatch: { A: 'Go, go, go!', B: 'Wiggle! Float away!', C: 'Mum fans her tail. Wiggle!', D: 'Mum is fanning her tail. Wiggle free!', E: 'Push the arrows to wiggle free and float up.' },
  swim: { A: 'Swim! Eat!', B: 'Swim and eat the green dots.', C: 'Swim and eat the green plankton.', D: 'Swim around and eat the plankton.', E: 'Swim around and eat the tiny plankton.' },
  copepod: { A: 'Eat the copepod!', B: 'Catch the copepod!', C: 'It jumps! Catch it.', D: 'A copepod! It jumps away fast.', E: 'A copepod! Chase it and catch it.' },
  tight: { A: 'Look at me!', B: 'My skin is too little!', C: 'My skin is tight!', D: 'My skin is too tight!', E: 'My skin is too tight. Time to moult!' },
  bigger: { A: 'Eat, eat, eat!', B: 'Eat lots! Get big!', C: 'Eat more. Grow big!', D: 'Eat more plankton to grow.', E: 'Eat more plankton to grow bigger.' },
  night: { A: 'Go up!', B: 'Night! Swim up to the top.', C: 'It is night. Food is at the top.', D: 'At night the plankton swim up to the top.', E: 'At night the plankton swim up near the top.' },
  day: { A: 'Go down!', B: 'Day! Swim down.', C: 'It is day. Food is down deep.', D: 'In the day the plankton sink down deep.', E: 'In the day the plankton sink down where it is dark.' },
  flick: { A: 'Go, go!', B: 'Swim fast!', C: 'Snap my tail to go fast.', D: 'Snap my tail to dash.', E: 'Snap my tail to dash away.' },
  herring: { A: 'Fish! Go, go!', B: 'Fish! Swim away!', C: 'Fish! Swim away from them.', D: 'Herring! Swim away or dive deep.', E: 'Herring are coming! Swim away or dive deep.' },
  missed: { A: 'I am up!', B: 'Whoosh! I am OK!', C: 'Whoosh! I am OK.', D: 'Whoosh! I tumbled, but I am safe.', E: 'Whoosh! I tumbled away, but I am safe.' },
  jelly: { A: 'A jelly! Go!', B: 'A jelly! Swim away!', C: 'A jelly! Keep away from it.', D: 'A comb jelly! Keep away from it.', E: 'A comb jelly! Keep well away from it.' },
  basking: { A: 'A shark! Go, go!', B: 'A big shark! Swim away!', C: 'A big shark! Swim away from it.', D: 'A basking shark! Swim away from its mouth.', E: 'A basking shark is eating plankton! Swim away from its mouth.' },
  tern: { A: 'A bird! Go down!', B: 'A bird! Swim down!', C: 'A bird! Swim down a bit.', D: 'A tern! Dive a little deeper.', E: 'A tern is dipping at the surface! Dive a little deeper.' },
  postlarva: { A: 'Go down!', B: 'Dive to the stones!', C: 'Dive down to the cobbles.', D: 'Follow the arrow and dive to the cobble bed.', E: 'Follow the arrow and dive down to the cobble bed.' },
  search: { A: 'Look! A hole!', B: 'Find a hole. Go in!', C: 'Find a hole that is not taken.', D: 'Find a hole under a stone that nobody is in.', E: 'Look under the cobbles for a hole that nobody is in.' },
  taken: { A: 'No! Go, go!', B: 'Taken! Try again.', C: 'A lobster lives here. Try another.', D: 'Taken! A little lobster lives here. Try another.', E: 'Taken! Another little lobster lives here. Try another cobble.' },
  settle: { A: 'Go in!', B: 'Go in! It is mine.', C: 'A free hole! Go in.', D: 'A free hole! Go in and make it my home.', E: 'A free hole under a stone! Go in and make it my home.' },
  juvenile: { A: 'Eat!', B: 'Eat the bits!', C: 'Eat the bits that come in.', D: 'Stay hidden and eat what drifts in.', E: 'Stay hidden in my hole and eat what drifts in.' },
  drift: { A: 'I see it! Eat!', B: 'Food! Eat it!', C: 'Food came in! Eat it.', D: 'Something drifted in! Eat it.', E: 'Something drifted into my hole! Eat it.' },
  hide: { A: 'Hide!', B: 'Hide! Go to a stone!', C: 'Hide under a stone!', D: 'Hide! Get under a stone or in the kelp.', E: 'Hide! Get under a cobble or into the kelp.' },
  hidden: { A: 'Yes!', B: 'I hide. Good!', C: 'I am safe under here.', D: 'I am safe and hidden.', E: 'I am safe and hidden.' },
  tucked: { A: 'I sleep.', B: 'I hide and wait.', C: 'I hid and kept still.', D: 'I tucked in and kept still until it was safe.', E: 'I tucked in and kept still until it was safe.' },
  predator: { A: 'A fish! Flip!', B: 'A big fish! Flip!', C: 'A big fish! Flip my tail!', D: 'A hunter! Flip my tail or hide.', E: 'A hunter is coming! Flip my tail or hide.' },
  dodged: { A: 'I am up!', B: 'Whoosh! I got away!', C: 'Whoosh! It did not get me.', D: 'Whoosh! My tail flip left it behind.', E: 'Whoosh! My tail flip left it far behind.' },
  forage: { A: 'Go. Eat!', B: 'Night! Go out and eat.', C: 'Night! Go out and find food.', D: 'It is night. Go out and find food.', E: 'It is night. Go out and find mussels, crabs and urchins.' },
  eat: { A: 'Eat it!', B: 'Food! Go and eat it.', C: 'Go to the food and eat it.', D: 'There is food. Go and eat it.', E: 'There is food on the sea floor. Go and eat it.' },
  sniff: { A: 'Go, go, go!', B: 'Go this way! Eat!', C: 'Go this way to find food.', D: 'Follow the arrow to find more food.', E: 'Follow the arrow to find more food.' },
  claw: { A: 'My claw!', B: 'Use my big claw!', C: 'Use one claw most.', D: 'The claw I use most gets big.', E: 'The claw I use most becomes my crusher.' },
  crusher: { A: 'A big claw!', B: 'My big claw!', C: 'My big crusher claw!', D: 'My crusher claw is decided!', E: 'My crusher claw is decided! The other is my cutter.' },
  full: { A: 'Dig! Go down!', B: 'Dig under a stone!', C: 'I am full. Dig under a stone.', D: 'I am full. Dig a den under a stone.', E: 'I am full. Push down to dig a den under a cobble.' },
  dig: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down into the sand.', D: 'Dig down into the sand, under the stone.', E: 'Dig down into the sand and under the cobble.' },
  rock: { A: 'No! It is a rock.', B: 'Too hard! Dig here?', C: 'Too hard! Find sand.', D: 'Too hard to dig here. Find sand or mud.', E: 'This is too hard to dig. Find some sand or mud.' },
  deeper: { A: 'Dig down!', B: 'Dig down, down!', C: 'Dig down some more.', D: 'Dig a little deeper.', E: 'Keep digging. My den must be deep.' },
  cover: { A: 'Go in!', B: 'Go under the stone!', C: 'Dig under the stone.', D: 'Dig to the side, under the stone.', E: 'Dig to the side, right under the cobble.' },
  moult: { A: 'Go out!', B: 'Get out of my shell!', C: 'Get out of my old shell.', D: 'Hidden! Back out of my old shell.', E: 'Hidden and full! Back out of my old shell.' },
  soft: { A: 'Look at me!', B: 'I am soft. Hide.', C: 'My new shell is soft. Hide.', D: 'My new shell is soft. I hide until it gets hard.', E: 'My new shell is soft. I hide while it hardens.' },
  shellmeal: { A: 'Eat it!', B: 'Eat my old shell!', C: 'Eat my old shell. Yum!', D: 'Eat my old shell. It makes me strong.', E: 'Eat my old shell. It is full of calcium.' },
  hard: { A: 'I am big!', B: 'I am hard! Go out!', C: 'I am hard again. Go out!', D: 'My shell is hard again. Out I go!', E: 'My shell is hard again, and I am bigger. Out I go!' },
  out: { A: 'Go up!', B: 'Go up and out!', C: 'Dig up and out.', D: 'Dig up and out of my den.', E: 'Push up to dig out of my den.' },
  daytime: { A: 'I hide. I sleep.', B: 'It is day. I hide.', C: 'It is day. I hide and wait.', D: 'It is day. Lobsters hide by day.', E: 'It is day. Lobsters hide by day and come out at night.' },
  trap: { A: 'A trap! Go in!', B: 'A trap! Go in and eat!', C: 'A trap with bait! Go in.', D: 'A trap! It smells of fish. Go in.', E: 'A trap! It smells of fish. Go in and eat the bait.' },
  hauled: { A: 'Up, up!', B: 'Up, up I go!', C: 'Up I go to the boat!', D: 'Up I go! The lobsterman measures me.', E: 'Up I go! The lobsterman measures me with his gauge.' },
  measured: { A: 'In I go!', B: 'Too little! Back in!', C: 'Too little! Back in the sea.', D: 'Too small! Back into the sea I go.', E: 'Too small! Back into the sea I go. That is the rule.' },
  adult: { A: 'I am big!', B: 'I am big! Eat and wait.', C: 'I am big. Eat and wait.', D: 'I am grown up. Eat and wait for autumn.', E: 'I am grown up. Eat and wait for the cold of autumn.' },
  autumn: { A: 'Go down!', B: 'Cold! Go to the deep!', C: 'It is cold. Walk to the deep!', D: 'Autumn! Walk out to the deep.', E: 'Autumn! The sea is cold. Walk offshore to the deep.' },
  deep: { A: 'Go to the deep!', B: 'Go to the deep!', C: 'Go this way to the deep.', D: 'Follow the arrow to the deep.', E: 'Follow the arrow all the way to the deep.' },
  kelpwalk: { A: 'Go, go, go!', B: 'Walk on!', C: 'Walk on past the kelp.', D: 'Walk on through the kelp.', E: 'Walk on through the kelp forest.' },
  arrived: { A: 'Dig!', B: 'Dig in the mud!', C: 'The deep! Dig into the mud.', D: 'The deep! Dig into the mud for winter.', E: 'The deep! Push down to dig into the mud for winter.' },
  winter: { A: 'I sleep.', B: 'It is winter. I rest.', C: 'It is winter. I rest in the mud.', D: 'It is winter. I rest in the mud.', E: 'It is winter. I rest in the mud, where it is warmer.' },
  spring: { A: 'Go home!', B: 'Spring! Go home!', C: 'It is spring. Go back home!', D: 'Spring! Dig out and walk back home.', E: 'Spring! Dig out and walk back to the cobble bed.' },
  home: { A: 'Go home!', B: 'Go home!', C: 'Go this way to go home.', D: 'Follow the arrow back home.', E: 'Follow the arrow back home to the cobble bed.' },
  site: { A: 'Dig, dig, dig!', B: 'Dig a den here!', C: 'Dig a den under a big stone.', D: 'Home! Dig a den under a big stone.', E: 'Home! Push down to dig a den under a big cobble.' },
  rival: { A: 'A lobster! Box!', B: 'A big lobster! Box him!', C: 'Another lobster! Go and box him.', D: 'Another male! Go and box him.', E: 'A rival male wants my den! Box him.' },
  box: { A: 'Box, box, box!', B: 'Box, box, box!', C: 'Push! Then a big push!', D: 'Push! When it is green, give a big heave!', E: 'Push him, then give a big heave!' },
  won: { A: 'Yes, yes, yes!', B: 'I win! He is gone.', C: 'I won! He went away.', D: 'I won! He backed away.', E: 'I won! He backed away, and my den is safe.' },
  lost: { A: 'No! Box, box!', B: 'No! Play again.', C: 'He won. Try again.', D: 'He pushed me back. Try again.', E: 'He pushed me back! Try again.' },
  boss: { A: 'I am the boss!', B: 'I win, I win!', C: 'I am the best lobster here!', D: 'I am the boss of the cobble bed!', E: 'I am the boss of the cobble bed!' },
  female: { A: 'I see a lobster!', B: 'Go and say hi!', C: 'A girl lobster! Go and say hi.', D: 'A female lobster! Go and say hi.', E: 'A female lobster! Go and say hello.' },
  findmale: { A: 'Go to a lobster!', B: 'Find a big lobster!', C: 'Find a boy lobster at his den.', D: 'Find a male lobster at his den.', E: 'Find a male lobster waiting at his den.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the lobster.', E: 'Go and say hello to the lobster.' },
  hermoult: { A: 'Look at me!', B: 'I moult in his den.', C: 'I moult in his den. I am safe.', D: 'I moult in his den, where it is safe.', E: 'I moult in his den, where it is safe, and wait to harden.' },
  brood: { A: 'I see my eggs.', B: 'My eggs! I wait.', C: 'My eggs grow. I fan them.', D: 'My eggs are under my tail. I fan them.', E: 'My eggs are under my tail. I keep them clean and fan them.' },
  moonready: { A: 'Go up!', B: 'Night! Go up!', C: 'A summer night! Go up on my stone.', D: 'A summer night! Climb onto my stone.', E: 'A summer night! Climb onto my cobble and let the larvae go.' },
  release: { A: 'Fan, fan, fan!', B: 'Wait for the glow!', C: 'When it glows, fan!', D: 'When the glow swells, fan my tail!', E: 'When the glow swells, fan my tail and let the larvae go!' },
  larvae: { A: 'I see larvae!', B: 'The larvae swim up!', C: 'The larvae swim up to the top!', D: 'The larvae swim up to the top of the sea.', E: 'The larvae swim up to the surface, and it all starts again.' },
  done: { A: 'I sleep.', B: 'All done! I rest.', C: 'My job is done. I rest.', D: 'My job is done. I rest in my den.', E: 'My job is done. I rest in my den.' },
  friend: { A: 'I see lobsters!', B: 'Look! Little lobsters!', C: 'Lots of little lobsters live here too.', D: 'Other little lobsters are settling here too.', E: 'Other little lobsters are settling on the cobble bed too.' },
  flipped: { A: 'Flip! I go!', B: 'Snap! I went back!', C: 'Snap! I shot backwards.', D: 'Snap! My tail flip shot me backwards.', E: 'Snap! My tail flip shot me backwards.' },
  cold: { A: 'Go down!', B: 'Cold! Go down!', C: 'It is cold up here. Go down.', D: 'The water is cold up here. Keep walking down.', E: 'The water is cold up here. Keep walking down to the deep.' }
};
