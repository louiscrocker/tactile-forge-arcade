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
/* words only the garter snake needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'flick hi in out go rub push mum yum big hide swim blue warm cold sit hot pee yew',
  B: 'wiggle pop lots smell slow under make head plop rest nose now old long winter spring puts looks blink so find her say grow off hill full good whoosh ok got went new back wait try again glow done away',
  C: 'thin had eggs after myself hurt finds need lie makes when slide safe snug sky its shadow comes stinky goes hold cool sits sees jumps tall stands tight well every scale autumn days follow their crack ground deep lifts writes summer shed grown boys stay together growing inside bask keep them bags times or bit woods just right dash did made jumped more thank found first another ready glows way brothers sisters egg does sting ears own heat tree fly live sea take home meet',
  D: 'curled clear splits picks smells special place mouth how tummy helps own heat called basking shade slither boards flat warms going round pokes garter swimming across held near great still slip reeds cloudy rough split crawl pulling sock longer than because stretched caps scent many never freezes count measure lets us nights flash each meet ways lot warmth late born rocky sparkles nothing best enough move curl side stripes missed fooled sent arrows rubbing forwards left behind counts cosy swells whole life end yet',
  E: 'mother does mine itself flicks tips tell which coming sting anybody food blooded flatten body catch moves slowly sunshine quick love cover underneath stays tailed circles high passes bothers musk wrinkles walks heads above live ponds streams tadpoles dragonflies anything waits shallow watch few milky liquid grows often stretches peels print young following trails older hibernaculum below frost line share hardly moving hearts beat scientists who study fields lift let lights kind pattern summers shedding lives carries months basks litter free starts use practise escape sitting closely newborn nearby smelled fastest hard circling poking feels measures gently hello bring met seen edge world tangled heaps warming'
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
  snake: 'snake', snakes: 'snake', baby: 'baby', babies: 'babies', bag: 'sac', skin: 'shed', tongue: 'tongue',
  eye: 'eye', eyes: 'eye', sun: 'sun', moon: 'moon', snow: 'snow', rock: 'rock', rocks: 'rock', stone: 'rock', stones: 'rock',
  board: 'board', log: 'log', logs: 'log', den: 'den', hole: 'den', pond: 'pond', water: 'pond', frog: 'frog', frogs: 'frog',
  hawk: 'hawk', bird: 'hawk', raccoon: 'raccoon', heron: 'heron', scientist: 'scientist', snack: 'snack', snacks: 'snack',
  leaf: 'leaf', leaves: 'leaf', flower: 'flower', flowers: 'flower', grass: 'grass', meadow: 'meadow', firefly: 'firefly', fireflies: 'firefly',
  trail: 'trail', mum: 'mum', boy: 'boy', girl: 'girl', scales: 'scales'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  flick: { A: 'flick',  B: 'flick it',    C: 'flick my tongue',    D: 'flick my tongue out',     E: 'Flick my tongue and smell.' },
  eat:   { A: 'eat',    B: 'eat it',      C: 'eat the snack',      D: 'eat this snack',          E: 'Eat the snack. Yum!' },
  look:  { A: 'look',   B: 'look at it',  C: 'look at my skin',    D: 'look at my old skin',     E: 'Look closely at my old skin.' },
  rub:   { A: 'rub',    B: 'rub my nose', C: 'rub my nose on it',  D: 'rub my nose on the rock', E: 'Rub my nose to split my old skin.' },
  meet:  { A: 'hi',     B: 'say hi',      C: 'go and say hi',      D: 'say hi to the snake',     E: 'Go and say hello.' },
  den:   { A: 'in',     B: 'go in',       C: 'go into the den',    D: 'go down into the den',    E: 'Crawl down into the winter den.' },
  birth: { A: 'push',   B: 'push now',    C: 'have my babies',     D: 'have my babies here',     E: 'Have my babies in this safe place.' }
};
/* the picture on each action card */
const ACTION_PIC = { flick: 'tongue', eat: 'snack', look: 'shed', rub: 'rock', meet: 'snake', den: 'den', birth: 'babies' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the snake's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  bag: { title: 'In a little bag', pic: 'sac', gate: false,
    A: ['I am a snake.', 'I am in a bag.', 'I see my mum.'],
    B: ['I am a little snake.', 'I am in a bag.', 'Mum has lots of babies.'],
    C: ['I am a baby snake.', 'I am in a thin bag.', 'Mum had lots of babies, not eggs!'],
    D: ['My mum did not lay eggs.', 'She had lots of babies, and I am one.', 'I am curled up in a thin, clear bag.'],
    E: ['A mother garter snake does not lay eggs.', 'Her babies are born in late summer, each one in a thin, clear bag.', 'I am curled up in mine, ready to wiggle out.'],
    yesno: [['Am I a snake?', true], ['Am I a frog?', false]] },
  born: { title: 'Hello, world!', pic: 'baby', gate: true,
    A: ['I am out!', 'I can go.', 'Hi, hi, hi!'],
    B: ['I wiggle and wiggle.', 'Pop! I am out of my bag.', 'Hi, hi, hi!'],
    C: ['I wiggle out of my thin bag.', 'Now I am out in the grass.', 'I can look after myself!'],
    D: ['I wiggle and push until my bag splits.', 'Out I come, into the warm grass.', 'I can look after myself from the first day.'],
    E: ['I push my way out of the thin bag.', 'A baby garter snake can look after itself from the day it is born.', 'My brothers and sisters slither off into the grass too.'],
    yesno: [['Did I get out of my bag?', true], ['Did I come out of an egg?', false]] },
  tongue: { title: 'My tongue smells', pic: 'tongue', gate: false,
    A: ['Look at my tongue.', 'Flick, flick, flick!'],
    B: ['I flick my tongue.', 'I can smell with it!', 'Flick, flick, flick.'],
    C: ['I flick my tongue out and in.', 'I smell with my tongue!', 'It can not hurt you.'],
    D: ['My tongue picks up smells from the air.', 'I put them in a special place in my mouth.', 'That is how I smell.'],
    E: ['A snake flicks its tongue to smell the air and the ground.', 'The two tips tell it which way a smell is coming from.', 'A snake tongue can not sting or hurt anybody.'],
    yesno: [['Do I smell with my tongue?', true], ['Does my tongue sting?', false]] },
  snack: { title: 'Snack time', pic: 'snack', gate: false,
    A: ['I see a snack.', 'I eat it.', 'Yum!'],
    B: ['I smell a snack.', 'I go to it.', 'Yum, yum, yum!'],
    C: ['My tongue finds a snack.', 'I eat it up.', 'Now I need to get warm.'],
    D: ['I find snacks with my tongue.', 'After a snack, I lie in the sun.', 'My warm tummy helps me grow.'],
    E: ['I find my snacks by smell, with my tongue.', 'Then I bask in the sun, because a snake must be warm to grow from its food.'],
    yesno: [['Do I find snacks with my tongue?', true], ['Do I find snacks with my ears?', false]] },
  sun: { title: 'In the sun', pic: 'sun', gate: false,
    A: ['I see the sun.', 'I am warm!'],
    B: ['I sit in the sun.', 'I get warm.', 'I like the sun!'],
    C: ['I lie on a warm rock.', 'The sun makes me warm.', 'Now I can go fast!'],
    D: ['A snake can not make its own heat.', 'So I lie in the sun on a warm rock.', 'This is called basking.'],
    E: ['I am cold-blooded: I am as warm as the place I am in.', 'So I bask on a flat rock, and flatten my body to catch the sun.'],
    yesno: [['Does the sun make me warm?', true], ['Do I make my own heat?', false]] },
  cold: { title: 'Brr!', pic: 'snow', gate: false,
    A: ['I am cold.', 'I go in the sun.'],
    B: ['I am cold!', 'I am slow.', 'I go to the sun.'],
    C: ['When I am cold, I am slow.', 'I go back into the sun to get warm.'],
    D: ['When the shade or the water makes me cold, I get slow.', 'I slither back into the sun to warm up.'],
    E: ['A cold snake moves slowly, because its body is as cool as the air.', 'I slither into the sunshine and soon I am quick again.'],
    yesno: [['Am I slow when I am cold?', true], ['Am I fast when I am cold?', false]] },
  hide: { title: 'Under the board', pic: 'board', gate: false,
    A: ['I see a board.', 'I go in!', 'I hide.'],
    B: ['I hide under a board.', 'It is warm in here.', 'No one can see me.'],
    C: ['I slide under a board.', 'The sun makes it warm.', 'I am safe and snug.'],
    D: ['Snakes like to hide under boards, logs and flat rocks.', 'The sun warms them up, and I stay safe.'],
    E: ['Garter snakes love to hide under boards, logs and flat rocks.', 'The sun warms the cover, and the snake underneath stays snug and safe.'],
    yesno: [['Do I hide under a board?', true], ['Do I hide in a tree?', false]] },
  hawk: { title: 'A hawk!', pic: 'hawk', gate: false,
    A: ['I see a bird.', 'I hide!'],
    B: ['A big bird is up in the air.', 'I see the bird.', 'I hide!'],
    C: ['A hawk is up in the sky.', 'I see its shadow on the grass.', 'I hide under a log.'],
    D: ['A hawk is going round and round up in the sky.', 'When I see its shadow, I hide and keep still.'],
    E: ['A red-tailed hawk circles high over the meadow.', 'When its shadow passes over, I slip under cover and keep very still.'],
    yesno: [['Do I hide from the hawk?', true], ['Do I fly with the hawk?', false]] },
  stinky: { title: 'Pee-yew!', pic: 'raccoon', gate: false,
    A: ['I see a raccoon.', 'No, no, no!'],
    B: ['A raccoon is here.', 'Pee-yew! I smell!', 'It will run away.'],
    C: ['A raccoon comes at night.', 'I make a stinky smell.', 'Pee-yew! It goes away.'],
    D: ['A raccoon pokes about in the grass at night.', 'I make a stinky smell, and it goes away fast.'],
    E: ['When something bothers a garter snake, it makes a stinky smell called musk.', 'The raccoon wrinkles its nose and walks away.'],
    yesno: [['Did the raccoon go away?', true], ['Do I smell like a flower?', false]] },
  swim: { title: 'In the pond', pic: 'pond', gate: false,
    A: ['I am in the pond.', 'I can swim!'],
    B: ['I swim in the pond.', 'My head is up.', 'The water is cold.'],
    C: ['I can swim!', 'I hold my head up out of the water.', 'The pond is cool.'],
    D: ['Garter snakes are good at swimming.', 'I wiggle across the pond with my head held up.'],
    E: ['Garter snakes swim well, with their heads held up above the water.', 'Many of them live near ponds and streams.'],
    yesno: [['Can I swim?', true], ['Do I live in the sea?', false]] },
  frog: { title: 'Plop!', pic: 'frog', gate: false,
    A: ['I see a frog.', 'It can hop!'],
    B: ['Look! A frog!', 'Hop, hop, plop!', 'It is in the pond.'],
    C: ['A green frog sits by the pond.', 'It sees me and jumps in.', 'Plop!'],
    D: ['Frogs sit by the pond in the sun.', 'When I come near, they jump into the water.'],
    E: ['Frogs, tadpoles and dragonflies live around the pond.', 'A frog jumps into the water with a plop when anything comes near.'],
    yesno: [['Did the frog jump in?', true], ['Did the frog fly away?', false]] },
  heron: { title: 'The heron', pic: 'heron', gate: false,
    A: ['I see a big bird.', 'I go!'],
    B: ['A big bird is in the pond.', 'It looks at me.', 'I swim away!'],
    C: ['A tall bird stands in the pond.', 'It is a heron.', 'I swim away fast.'],
    D: ['A great blue heron stands very still in the water.', 'I slip away into the reeds.'],
    E: ['A great blue heron waits very still in the shallow water.', 'I keep watch and slip away into the reeds.'],
    yesno: [['Is the heron tall?', true], ['Is the heron a frog?', false]] },
  blue: { title: 'Blue eyes', pic: 'blueeye', gate: false,
    A: ['Look at my eye.', 'My eye is blue!'],
    B: ['My eyes are blue.', 'I can not see.', 'I hide and rest.'],
    C: ['My skin is tight.', 'My eyes go blue and I can not see well.', 'I hide and rest.'],
    D: ['A new skin is growing under my old one.', 'My eyes go cloudy and blue.', 'I hide until they clear.'],
    E: ['A few days before a shed, a milky liquid makes my eyes cloudy blue.', 'I can not see well, so I hide and rest until they clear.'],
    yesno: [['Did my eyes go blue?', true], ['Can I see well now?', false]] },
  shed: { title: 'My first shed', pic: 'shed', gate: true,
    A: ['I rub, rub, rub.', 'I go out!'],
    B: ['My skin is too little.', 'I rub my nose.', 'Now I go out of my skin!'],
    C: ['My skin is too tight.', 'I rub my nose on a rock.', 'I wiggle out of my old skin!'],
    D: ['I rub my nose on a rough rock to split my old skin.', 'Then I crawl out of it, like pulling off a sock.'],
    E: ['A snake grows a new skin under the old one.', 'I rub my nose to split the old skin, then crawl right out of it.', 'It comes off inside out, like a sock.'],
    yesno: [['Do I get out of my old skin?', true], ['Do I keep my old skin on?', false]] },
  skin: { title: 'My old skin', pic: 'shed', gate: false,
    A: ['Look at my skin.', 'It is big!'],
    B: ['Look at my old skin.', 'It is long!', 'I see my eye in it.'],
    C: ['My old skin is in the grass.', 'It is long and thin.', 'I can see every scale.'],
    D: ['My old skin is longer than I am, because it stretched.', 'Look! There are little caps from my eyes.'],
    E: ['A shed skin is often longer than the snake, because it stretches as it peels off.', 'You can see the clear eye caps and the print of every scale.'],
    yesno: [['Is my old skin long?', true], ['Is my old skin a leaf?', false]] },
  autumn: { title: 'Autumn', pic: 'leaf', gate: false,
    A: ['I see a leaf.', 'I go to the den.'],
    B: ['It is cold now.', 'I see the trail.', 'I go to the den.'],
    C: ['It is autumn and the days are cold.', 'Big snakes go to the den.', 'I follow their trail.'],
    D: ['In autumn the days get cool.', 'I follow the scent trail of the big snakes.', 'It goes to the winter den on the hill.'],
    E: ['In autumn, young garter snakes find the winter den by following the scent trails of older snakes.', 'I flick my tongue to find the trail.'],
    yesno: [['Do I follow the trail?', true], ['Do I go to the pond for winter?', false]] },
  den: { title: 'The winter den', pic: 'den', gate: true,
    A: ['I see the den.', 'I go in!'],
    B: ['Here is the den.', 'It is a hole in the rock.', 'I go in!'],
    C: ['The den is a crack in the rock.', 'Lots of snakes go in.', 'I go in too!'],
    D: ['The winter den is a deep crack in the rock.', 'Many snakes go down into it.', 'It never freezes deep down.'],
    E: ['A winter den is called a hibernaculum.', 'It goes down below the frost line, where the ground never freezes.', 'Many snakes share it.'],
    yesno: [['Is the den in the rock?', true], ['Is the den in the pond?', false]] },
  winter: { title: 'Winter', pic: 'winter', gate: false,
    A: ['I sleep.', 'I see snakes.'],
    B: ['It is winter.', 'I sleep in the den.', 'Lots of snakes sleep too.'],
    C: ['It is winter.', 'Snow is on the ground.', 'Deep in the den, we all rest.'],
    D: ['All winter we rest deep in the den.', 'We are cold and very still.', 'We do not eat at all.'],
    E: ['All winter the snakes rest deep in the den, hardly moving.', 'Their hearts beat very slowly, and they do not eat until spring.'],
    yesno: [['Do we rest all winter?', true], ['Do we play in the snow?', false]] },
  spring: { title: 'Spring!', pic: 'sun', gate: true,
    A: ['I am up!', 'I see the sun.'],
    B: ['It is spring!', 'I go up and out.', 'I see the sun.'],
    C: ['It is spring!', 'I go up and out of the den.', 'The sun is warm on the rocks.'],
    D: ['Spring is here, and the sun warms the rocks.', 'I crawl up out of the den and bask.'],
    E: ['When the spring sun warms the rocks, the garter snakes crawl out of the den.', 'We lie in the sunshine in big tangled heaps.'],
    yesno: [['Is it spring?', true], ['Is it winter now?', false]] },
  scientist: { title: 'The snake scientist', pic: 'scientist', gate: false,
    A: ['I see a scientist.', 'Hi!'],
    B: ['A scientist is here.', 'She puts down a board.', 'She looks at me.'],
    C: ['A scientist lifts the board.', 'She looks at me and writes it down.', 'Then she puts me back.'],
    D: ['A snake scientist puts boards in the meadow.', 'She lifts them up to count and measure snakes.', 'Then she lets us go.'],
    E: ['Scientists who study snakes put boards in fields.', 'They lift them to count and measure the snakes, then let them go.'],
    yesno: [['Did she put me back?', true], ['Did she take me home?', false]] },
  fireflies: { title: 'Fireflies', pic: 'firefly', gate: false,
    A: ['I see the moon.', 'I see fireflies!'],
    B: ['It is night.', 'Look at the fireflies!', 'Blink, blink, blink.'],
    C: ['It is a summer night.', 'Fireflies blink in the grass.', 'I rest under my log.'],
    D: ['On summer nights the fireflies blink.', 'They flash to find each other.'],
    E: ['On warm summer nights, fireflies flash their lights to find each other.', 'Each kind has its own pattern.'],
    yesno: [['Do fireflies blink?', true], ['Do fireflies swim?', false]] },
  adult: { title: 'Grown up!', pic: 'snake', gate: true,
    A: ['I am big!', 'Look at me!'],
    B: ['Look at me!', 'I am a big snake now.', 'I am so long!'],
    C: ['I shed my skin again.', 'Now I am a big snake.', 'I am grown up!'],
    D: ['I have grown and shed again and again.', 'Now I am a grown up garter snake.', 'Soon it will be autumn.'],
    E: ['After two summers of eating, basking and shedding, I am grown up.', 'Snakes keep growing a little all their lives.'],
    yesno: [['Am I grown up?', true], ['Am I in my bag?', false]] },
  race: { title: 'Follow her trail', pic: 'trail', gate: false,
    A: ['I see a girl.', 'Go, go, go!'],
    B: ['A girl snake is out.', 'I flick my tongue.', 'I find her trail!'],
    C: ['A girl snake comes out of the den.', 'I flick my tongue to find her trail.', 'Other boys come too!'],
    D: ['In spring, the boys come out first and wait.', 'When a girl comes out, we follow her scent trail.'],
    E: ['A girl snake leaves a special scent trail.', 'I flick my tongue to stay on it, and slither as fast as I can.'],
    yesno: [['Do I follow her trail?', true], ['Do I follow a frog?', false]] },
  meet: { title: 'Hello!', pic: 'snake', gate: false,
    A: ['I see a snake.', 'Hi!'],
    B: ['I find a snake.', 'We say hi.'],
    C: ['I find a snake.', 'We say hi and stay together.'],
    D: ['In spring, boy and girl snakes meet by the den.', 'Then they go their own ways.'],
    E: ['Boy and girl garter snakes meet in spring by the den.', 'Then the girl goes off to the summer meadow.'],
    yesno: [['Did we meet?', true], ['Did we sleep in the snow?', false]] },
  carry: { title: 'Babies inside', pic: 'girl', gate: false,
    A: ['I am a mum.', 'I sit in the sun.'],
    B: ['I have babies in me.', 'I sit in the sun.', 'They grow and grow.'],
    C: ['Babies are growing inside me.', 'I bask in the sun to keep them warm.'],
    D: ['All summer the babies grow inside me.', 'I bask a lot, because my warmth helps them grow.'],
    E: ['A mother garter snake carries her babies for about three months.', 'She basks a lot, because her warmth helps them grow.'],
    yesno: [['Do I keep my babies warm?', true], ['Do I lay eggs?', false]] },
  babies: { title: 'A new litter', pic: 'babies', gate: true,
    A: ['Look at my babies!', 'Go, go, go!'],
    B: ['I have my babies.', 'Lots and lots of babies!', 'Off they go.'],
    C: ['My babies are here!', 'They wiggle out of their bags.', 'Off they go into the grass.'],
    D: ['In late summer my babies are born under a log.', 'They wiggle out of their bags and slither off.'],
    E: ['In late summer, a whole litter is born, each one in a thin, clear bag.', 'They wiggle free and slither off, and it all starts again.'],
    yesno: [['Are there lots of babies?', true], ['Did the babies come out of eggs?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per game; see Reading.init */
const STORY_TRIGGERS = { started: 'bag', flicked: 'tongue', ateSnack: 'snack', basking: 'sun', cold: 'cold', hid: 'hide', hawk: 'hawk', musk: 'stinky', swimStart: 'swim', frogPlop: 'frog', heron: 'heron', blue: 'blue', lookedShed: 'skin', autumn: 'autumn', winterStart: 'winter', lifted: 'scientist', fireflies: 'fireflies', girlOut: 'race', met: 'meet', babiesReady: 'carry' };

/* ---------- read-and-do missions ----------
   who: crawl (out and about) · pond (near or in the pond) · autumn (on the way to the den) · spring (coming out of the den)
   from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'flick', who: 'crawl', A: 'Flick, flick, flick!', B: 'Flick my tongue.', C: 'Flick my tongue three times.', D: 'Flick my tongue out three times.', E: 'Flick my tongue three times to smell the air.' },
  { key: 'snack', who: 'crawl', A: 'Eat a snack.', B: 'Find a snack.', C: 'Find a snack and eat it.', D: 'Smell a snack and eat it.', E: 'Use my tongue to find a snack, then eat it.' },
  { key: 'bask', who: 'crawl', A: 'Sit in the sun.', B: 'Get warm on a rock.', C: 'Rest on a rock in the sun.', D: 'Lie on a warm rock in the sun.', E: 'Bask on a flat rock until I feel warm.' },
  { key: 'hide', who: 'crawl', A: 'Hide!', B: 'Hide under a log.', C: 'Hide under a log or a board.', D: 'Find a log or a board to hide under.', E: 'Find a board, a log or a rock and slide under it.' },
  { key: 'dash', who: 'crawl', from: 'B', A: 'Go, go, go!', B: 'Go fast!', C: 'Go fast three times.', D: 'Dash away three times.', E: 'Dash three times to practise my escape.' },
  { key: 'swim', who: 'pond', A: 'Swim!', B: 'Swim in the pond.', C: 'Swim in the pond for a bit.', D: 'Swim across the pond.', E: 'Swim across the pond with my head held up.' },
  { key: 'frog', who: 'pond', A: 'See a frog.', B: 'Find a frog.', C: 'Go and find a frog.', D: 'Find a frog by the pond.', E: 'Find a frog sitting by the pond.' },
  { key: 'hill', who: 'crawl', A: 'Go up!', B: 'Go up the hill.', C: 'Go up to the top of the hill.', D: 'Climb up to the top of the rocky hill.', E: 'Climb all the way up the rocky hill.' },
  { key: 'woods', who: 'crawl', from: 'C', A: 'Go to the trees.', B: 'Go to the big trees.', C: 'Go to the woods.', D: 'Go all the way to the woods.', E: 'Slither all the way to the woods.' },
  { key: 'look', who: 'crawl', A: 'Look at my skin.', B: 'Look at my old skin.', C: 'Go and look at my old skin.', D: 'Go back and look at my old skin.', E: 'Go back and look closely at my old skin.' },
  { key: 'den', who: 'autumn', A: 'Go to the den.', B: 'Find the den.', C: 'Follow the trail to the den.', D: 'Follow the scent trail to the den.', E: 'Follow the scent trail all the way to the winter den.' },
  { key: 'meadow', who: 'spring', A: 'Go down!', B: 'Go down to the grass.', C: 'Go down to the meadow.', D: 'Slither down the hill to the meadow.', E: 'Slither down the rocky hill to the summer meadow.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  newborn: { A: 'I am in a bag.', B: 'I am a baby snake in a bag.', C: 'I am a baby snake in a thin bag.', D: 'I am a baby snake, curled up in a thin bag.', E: 'I am a newborn garter snake, curled up in a thin, clear bag.' },
  wiggle: { A: 'Go, go, go!', B: 'Wiggle! Get out!', C: 'Wiggle out of my bag!', D: 'Wiggle and push out of my bag!', E: 'Push the arrows to wiggle out of my bag.' },
  tongue: { A: 'Flick!', B: 'Flick my tongue!', C: 'Flick my tongue to smell.', D: 'Flick my tongue to smell for snacks.', E: 'Flick my tongue to smell for snacks nearby.' },
  smelled: { A: 'A snack! Eat!', B: 'A snack! Go and eat it.', C: 'I smell a snack! Go to it.', D: 'I smell a snack! Follow the sparkles.', E: 'I smelled a snack! Follow the sparkles to it.' },
  nothing: { A: 'No. Go, go!', B: 'No snack here. Go on.', C: 'No snack here. Go on and flick again.', D: 'Nothing here. Slither on and flick again.', E: 'Nothing to smell here. Slither on and flick again.' },
  snack: { A: 'Yum! Sit in the sun.', B: 'Yum! Now get warm.', C: 'Yum! Now get warm in the sun.', D: 'Yum! Now bask in the sun to grow.', E: 'Yum! Now bask in the sun so my warm tummy can grow me.' },
  belly: { A: 'Yum! Sit in the sun.', B: 'I am full! Get warm.', C: 'I am full. Get warm in the sun.', D: 'My tummy is full. Warm up to grow.', E: 'My tummy is full. Warm up in the sun to grow from my snacks.' },
  cold: { A: 'I am cold!', B: 'Cold! Go in the sun.', C: 'I am cold and slow. Go in the sun.', D: 'I am cold and slow. Slither into the sun.', E: 'I am cold and slow. Slither into the sunshine and bask.' },
  bask: { A: 'I am warm!', B: 'I sit in the sun. Warm!', C: 'I bask in the sun. So warm!', D: 'Basking in the sun. A warm rock is best.', E: 'Basking in the sun. A flat rock warms me fastest.' },
  warm: { A: 'Yes!', B: 'Good! I am warm.', C: 'I am just right!', D: 'Just right! Warm enough to grow.', E: 'Just right! Warm enough to slither fast and grow.' },
  hot: { A: 'I am hot!', B: 'Too hot! Hide!', C: 'Too hot! Go under a log.', D: 'Too hot! Slide into the shade.', E: 'Too hot! Slide into the shade, under a board or a log.' },
  chilled: { A: 'I sleep.', B: 'Too cold. I rest.', C: 'Too cold to go. I rest.', D: 'Too cold to move. I curl up and wait.', E: 'Too cold to move. I curl up and wait for the warm sun.' },
  morning: { A: 'I see the sun!', B: 'The sun is up!', C: 'The sun is up! Get warm.', D: 'The sun is up! Bask and warm up.', E: 'The sun is up! Bask and warm up.' },
  hide: { A: 'Go down! Hide!', B: 'Go down to hide!', C: 'Push down to hide under it.', D: 'Push down to slide under it and hide.', E: 'Push down at a board, log or rock to slide under it.' },
  hidden: { A: 'I hide.', B: 'I hide. Good!', C: 'I am safe under here.', D: 'I am safe and snug under here.', E: 'I am safe and snug under cover.' },
  out: { A: 'Go out!', B: 'Go out!', C: 'Go out of here.', D: 'Slither out to the side.', E: 'Push left or right to slither out.' },
  dash: { A: 'Go, go, go!', B: 'Go fast!', C: 'Dash away fast!', D: 'Dash! My stripes help me get away.', E: 'Dash! My stripes make it hard to see how fast I go.' },
  hawk: { A: 'A bird! Hide!', B: 'A big bird! Hide!', C: 'A hawk! Hide under a log!', D: 'A hawk is going round! Hide or dash!', E: 'A hawk is circling! Hide under cover, or dash away.' },
  missed: { A: 'I can go!', B: 'Whoosh! I am OK!', C: 'Whoosh! It did not get me.', D: 'Whoosh! It missed. I am safe.', E: 'Whoosh! It missed. I am safe.' },
  dodged: { A: 'Yes! I can go!', B: 'Whoosh! I got away!', C: 'Whoosh! It did not get me.', D: 'Whoosh! My stripes fooled it.', E: 'Whoosh! My stripes fooled it. I am safe.' },
  raccoon: { A: 'A raccoon! Hide!', B: 'A raccoon! Hide!', C: 'A raccoon! Hide or go away.', D: 'A raccoon is here! Hide or slither away.', E: 'A raccoon is poking about! Hide, or slither away.' },
  musk: { A: 'Pee-yew! Go, go!', B: 'Pee-yew! It went away.', C: 'Pee-yew! I made a stinky smell.', D: 'Pee-yew! My stinky smell sent it away.', E: 'Pee-yew! My stinky musk sent the raccoon away.' },
  heron: { A: 'A big bird! Go!', B: 'A big bird! Swim away!', C: 'A heron! Swim away from it.', D: 'A heron! Swim away or hide.', E: 'A heron is in the pond! Swim away or hide in the reeds.' },
  pond: { A: 'I swim!', B: 'I swim in the pond!', C: 'I can swim! The water is cool.', D: 'The pond! Swim with the arrows.', E: 'The pond! Swim with the arrows. The water is cool.' },
  frog: { A: 'A frog! Hop!', B: 'Plop! A frog!', C: 'Plop! The frog jumped in.', D: 'Plop! The frog jumped into the pond.', E: 'Plop! The frog jumped into the pond.' },
  tight: { A: 'Look at me!', B: 'My skin is too little!', C: 'My skin is tight!', D: 'My skin is too tight. I am growing!', E: 'My skin feels tight. A new skin is coming.' },
  blue: { A: 'My eye is blue!', B: 'Blue eyes! Hide!', C: 'My eyes are blue. Hide and rest.', D: 'My eyes are cloudy blue. Hide and rest.', E: 'My eyes are cloudy blue. Hide under cover until they clear.' },
  clear: { A: 'Rub, rub!', B: 'Rub my nose on a rock!', C: 'I can see! Rub my nose on a rock.', D: 'My eyes are clear! Rub my nose on a rock.', E: 'My eyes are clear! Rub my nose on a rock or a log.' },
  rub: { A: 'Rub, rub, rub!', B: 'Rub, rub, rub!', C: 'Rub my nose some more.', D: 'Keep rubbing my nose.', E: 'Keep rubbing to split the old skin.' },
  peel: { A: 'Go, go, go!', B: 'Go out of my skin!', C: 'Wiggle out of my old skin!', D: 'Crawl forwards out of my old skin.', E: 'Slither forwards to crawl right out of my old skin.' },
  shed: { A: 'I am out!', B: 'I am out! Look at me!', C: 'I am out of my old skin!', D: 'I left my old skin behind!', E: 'I left my old skin behind, inside out.' },
  look: { A: 'Look at my skin!', B: 'Look at my old skin!', C: 'Look at my old skin.', D: 'Go back and look at my old skin.', E: 'Go back and look at my old skin closely.' },
  grow: { A: 'Eat! Sit in the sun!', B: 'Eat and get warm.', C: 'Eat and bask to grow.', D: 'Snack and bask to grow.', E: 'Snack and bask to grow, then shed again.' },
  autumn: { A: 'Go to the den!', B: 'Cold! Go to the den!', C: 'It is cold. Follow the trail to the den.', D: 'Autumn! Follow the scent trail to the den.', E: 'Autumn! Follow the scent trail to the winter den on the hill.' },
  trail: { A: 'Flick! Go!', B: 'Flick and go!', C: 'Flick my tongue to see the trail.', D: 'Flick my tongue and follow the trail.', E: 'Flick my tongue and follow the scent trail.' },
  denmouth: { A: 'Go in!', B: 'The den! Go in!', C: 'The den! Go down into it.', D: 'The den! Push down to crawl in.', E: 'The winter den! Push down to crawl in.' },
  deeper: { A: 'Go down!', B: 'Go down, down!', C: 'Go down, down, down.', D: 'Go down deep, where it is safe.', E: 'Go down below the frost line, where it never freezes.' },
  winter: { A: 'I sleep.', B: 'It is winter. I rest.', C: 'It is winter. We all rest.', D: 'It is winter. We rest deep in the den.', E: 'It is winter. We rest deep in the den until spring.' },
  spring: { A: 'Go up!', B: 'Spring! Go up!', C: 'It is spring! Go up and out.', D: 'Spring! Crawl up and out of the den.', E: 'Spring! The sun is warming the rocks. Crawl up and out.' },
  emerged: { A: 'I see the sun!', B: 'I am out! Get warm.', C: 'I am out! Bask on the rocks.', D: 'I am out! Bask, then go to the meadow.', E: 'I am out in the sunshine! Bask, then slither down to the meadow.' },
  meadow: { A: 'Go down!', B: 'Go to the grass!', C: 'Go to the meadow.', D: 'Slither down to the meadow.', E: 'Slither down to the meadow to find snacks.' },
  board: { A: 'A board! Hide!', B: 'A new board! Hide!', C: 'A new board! Hide under it.', D: 'A new board! It is warm under there.', E: 'A new board in the grass! Push down to hide under it.' },
  lifted: { A: 'Up I go!', B: 'Up I go! Hi!', C: 'Up! She looks at me.', D: 'Up! The scientist counts me.', E: 'Up! The scientist counts and measures me.' },
  measured: { A: 'Down I go!', B: 'She puts me back!', C: 'She puts me back. Thank you!', D: 'She writes it down and puts me back.', E: 'She writes it down and puts me back gently.' },
  adult: { A: 'I am big!', B: 'I am big now!', C: 'I am grown up!', D: 'I am grown up! Eat and wait for autumn.', E: 'I am grown up! Snack, bask and wait for autumn.' },
  gather: { A: 'I look, look, look.', B: 'Wait for a girl!', C: 'Wait for a girl. Then follow her.', D: 'Wait for a girl, then follow her trail.', E: 'Wait for a girl to come out, then follow her scent trail.' },
  race: { A: 'Flick! Go, go!', B: 'Flick and go fast!', C: 'Flick my tongue and follow her!', D: 'Flick my tongue to stay on her trail!', E: 'Flick my tongue to stay on her trail, and slither fast!' },
  won: { A: 'Yes, yes, yes!', B: 'I find her!', C: 'I found her first!', D: 'I found her first!', E: 'I found her first!' },
  lost: { A: 'No! Go, go!', B: 'No! Try again.', C: 'Another boy got there. Try again.', D: 'Another boy found her first. Try again.', E: 'Another boy found her first. Another girl is coming out!' },
  girlout: { A: 'I see a snake!', B: 'Go and say hi!', C: 'Go and say hi to a boy.', D: 'Go to a boy and say hi.', E: 'The boys are waiting. Go to one and say hello.' },
  meet: { A: 'Hi! Hi!', B: 'Say hi!', C: 'Go and say hi.', D: 'Go and say hi to the snake.', E: 'Go and say hello to the snake.' },
  carry: { A: 'Sit in the sun!', B: 'Get warm for my babies!', C: 'My babies grow! Bask in the sun.', D: 'Babies are growing in me. Bask to keep them warm.', E: 'Babies are growing inside me. Bask to keep them warm.' },
  carrywarm: { A: 'Warm!', B: 'Warm! They grow.', C: 'Warm! My babies grow.', D: 'Warm and cosy. My babies grow.', E: 'Warm and cosy. My babies are growing.' },
  ready: { A: 'Go to a log!', B: 'Hide under a log!', C: 'My babies are ready! Hide under a log.', D: 'My babies are ready! Find a log to hide under.', E: 'My babies are ready! Find a log or a board and hide under it.' },
  birth: { A: 'Push!', B: 'Glow! Push!', C: 'When it glows, push!', D: 'When the glow swells, push!', E: 'When the glow swells, push to bring my babies.' },
  babies: { A: 'My babies! Go!', B: 'My babies! Off they go!', C: 'My babies wiggle out and go!', D: 'My babies wiggle out of their bags and go.', E: 'My babies wiggle out of their bags and slither off. It all starts again!' },
  litterOut: { A: 'Look! Babies!', B: 'Look! Little babies!', C: 'Look! Lots of little babies!', D: 'Look! The girl had her babies under a log.', E: 'Late summer! The girl I met had her babies under a log.' },
  done: { A: 'Yes, yes, yes!', B: 'All done!', C: 'I did it all!', D: 'I did a whole snake life!', E: 'I have seen a whole garter snake life!' },
  edge: { A: 'No, no, no!', B: 'Go back!', C: 'Go back this way.', D: 'That is the end. Go back.', E: 'That is the edge of my world. Go back.' },
  sibs: { A: 'I see snakes!', B: 'Look! Lots of little snakes!', C: 'My brothers and sisters go too.', D: 'My brothers and sisters slither off too.', E: 'My brothers and sisters slither off into the grass too.' },
  notyet: { A: 'No, no!', B: 'Not now!', C: 'Not now. The den is for winter.', D: 'Not yet! The den is for winter.', E: 'Not yet! The den is for the winter.' }
};
