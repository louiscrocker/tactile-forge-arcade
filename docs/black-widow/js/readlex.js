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
/* words only Black Widow needs, added to a level on purpose (tools/fill-words.mjs keeps this in step) */
const LEVEL_EXTRA = {
  A: "grow get red hi hide not and big sit black he little her on",
  B: "let fix new fling cut show say pluck fold spin mom top wet hot now make dot boy hums know made them ground drop more push arrows wiggle climb roof arrow high press space hold warm find your walk then again bit try spot swing sticky snaps wait feel which hum wrap yum got away just snip tight hang onto stripes bigger darker grown small striped webs day rest blue or e curl keep still mark sees went saw goes curled side some gone fine mend lines oops people coming looked did touch soft slow hello folds round stay by first off plucks back going knows hard thinks spins time",
  C: "soon white takes wings came so home lift does well but legs chew something last looks",
  D: "softly many others pale stand tall dry glue bottom runs lets lifts even shake neat sip pull orange looking comes close seed hand shy took smooth upside male tell him closer their starts porch way",
  E: "tiptoe shed old mother spun laid hundreds us hatched inside already bite hole baby called climbs highest place strand stream moving call ballooning likes corner things foot stays stretched walking bumps free pulled reach eight eyes hardly use quick shakes mean ones feet combs turn drink meal everything lands food swings slowly drops skeleton stretch split myself underneath fight lose interest frightened lies most hunters move chase anyone person sick sweep tonight moult full glossy faces his stops building catching follows smell female birds hunt clearly scientists think warning insects steadily who bursts apart steady beat always eats rare cup tough guard sail each somewhere begin middle thing another follow brothers sisters edge rise land live dark fixed further snags gumfoot along ring wrapped sipped broke only loose sway need room getting legged build any far across yard low travels rests mud dauber hunts alligator poking watches sight lost backed footsteps plucked carefully start turns begins gently leaves own wandering leave traveller"
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
  spider: 'spider', spiders: 'spider', spiderling: 'ling', spiderlings: 'ling', widow: 'spider',
  web: 'web', thread: 'thread', threads: 'thread', silk: 'thread', line: 'thread', sac: 'sac', egg: 'sac', eggs: 'sac',
  bug: 'fly', bugs: 'fly', moth: 'moth', ant: 'ant', leaf: 'leaf', parcel: 'parcel', snack: 'parcel', skin: 'skin',
  wasp: 'wasp', lizard: 'lizard', bird: 'bird', mantis: 'mantis', broom: 'broom', child: 'kid', torch: 'torch', light: 'torch',
  moon: 'moon', sun: 'sun', wind: 'wind', den: 'den', pot: 'pot', boot: 'boot', hourglass: 'hourglass'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  balloon: { A: 'go up', B: 'let go',   C: 'let out silk',   D: 'let out my silk',     E: 'Stand on tiptoe and let go.' },
  fix:     { A: 'silk',  B: 'fix it',   C: 'fix my silk',    D: 'fix my silk here',    E: 'Fix the thread here.' },
  molt:    { A: 'grow',  B: 'new skin', C: 'get a new skin', D: 'get out of my skin',  E: 'Shed my old skin.' },
  fling:   { A: 'get it', B: 'fling',   C: 'fling silk',     D: 'fling silk at it',    E: 'Fling sticky silk at the bug.' },
  cut:     { A: 'no',    B: 'cut',      C: 'cut it out',     D: 'cut the leaf out',    E: 'Cut the leaf out of my web.' },
  show:    { A: 'red',   B: 'show red', C: 'show my red',    D: 'show my red mark',    E: 'Hang upside down and show red.' },
  answer:  { A: 'hi',    B: 'say hi',   C: 'pluck back',     D: 'pluck the web back',  E: 'Pluck back to say hello.' },
  pluck:   { A: 'hi',    B: 'pluck',    C: 'pluck her web',  D: 'pluck her web softly', E: 'Pluck her web, soft and slow.' },
  bundle:  { A: 'silk',  B: 'fold',     C: 'fold her web',   D: 'fold up her web',     E: 'Fold up a bit of her web.' },
  spin:    { A: 'eggs',  B: 'spin',     C: 'spin a sac',     D: 'spin an egg sac',     E: 'Spin a round egg sac.' },
  hide:    { A: 'hide',  B: 'hide',     C: 'drop and hide',  D: 'drop and curl up',    E: 'Drop on my line and curl up.' }
};
/* the picture on each action card */
const ACTION_PIC = { balloon: 'wind', fix: 'thread', molt: 'skin', fling: 'fly', cut: 'leaf', show: 'hourglass', answer: 'heart', pluck: 'heart', bundle: 'web', spin: 'sac', hide: 'curl' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the spider's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  sac: { title: 'In the egg sac', pic: 'sac', gate: false,
    A: ['I am in a sac.', 'I see a spider.', 'We sleep.'],
    B: ['I am in a little sac.', 'It is my mom, the big spider.', 'I want to get out!'],
    C: ['I am a little spider in a sac.', 'My mom made it from silk.', 'Soon I will wiggle out.'],
    D: ['My mom made this round sac from her silk.', 'I am one of very many tiny spiders in it.', 'Soon we will all climb out.'],
    E: ['A mother black widow spun this round sac and laid her eggs in it.', 'Hundreds of us hatched inside.', 'I have shed one skin already.'],
    yesno: [['Am I in a sac?', true], ['Am I a big bird?', false]] },
  hatch: { title: 'Out of the sac', pic: 'ling', gate: true,
    A: ['I am a spider.', 'I can go up.', 'Look at me!'],
    B: ['Look! I am out.', 'I am a little spider.', 'I go up, up, up.'],
    C: ['I wiggle out of the sac.', 'I am a little white spider.', 'I have to go up to the top.'],
    D: ['I climb out of the sac with all the others.', 'We are tiny and pale, not black like our mom.', 'We all climb up as high as we can.'],
    E: ['I bite a hole in the silk and climb out.', 'A baby spider is called a spiderling.', 'Every one of us climbs for the highest place we can find.'],
    yesno: [['Am I a little spider?', true], ['Am I black now?', false]] },
  balloon: { title: 'Up and away', pic: 'wind', gate: true,
    A: ['I see the wind.', 'I go up!', 'Look at me go!'],
    B: ['I am up on the top.', 'I let out my silk.', 'The wind will get me!'],
    C: ['I am up at the top now.', 'I let out some silk.', 'The wind takes it, and I go too!'],
    D: ['I stand up tall and let out a long thread of silk.', 'When the wind takes the silk, it takes me too.', 'I do not know where I will come down.'],
    E: ['I stand on tiptoe and let a strand of silk stream out.', 'The moving air lifts the silk, and I let go.', 'People call this ballooning.'],
    yesno: [['Do I let out silk?', true], ['Do I have wings?', false]] },
  den: { title: 'A new home', pic: 'den', gate: false,
    A: ['I see a den.', 'I like it.', 'I go in.'],
    B: ['Here is a little den.', 'It is not wet. It is not hot.', 'I will sit in it.'],
    C: ['I came down here, so this is my home.', 'I find a den to hide in.', 'Now I can make a web.'],
    D: ['Where I come down is where I will stay.', 'I find a dry den where I can hide by day.', 'Next I must make my first web.'],
    E: ['A widow likes a dry corner close to the ground.', 'From my den I will run threads out to the things around me.', 'One foot stays on the web, to feel it.'],
    yesno: [['Is the den my home?', true], ['Is my den wet?', false]] },
  gum: { title: 'Sticky feet', pic: 'gum', gate: false,
    A: ['I see my silk.', 'It can go down.', 'I like it!'],
    B: ['My silk can go down.', 'It will get a bug for me!', 'Up it will go.'],
    C: ['This thread goes down to the ground.', 'A bug will run into it.', 'Snap! The thread will lift the bug up.'],
    D: ['The threads that go down have glue at the bottom.', 'When a bug runs into one, the thread lets go of the ground.', 'It lifts the bug up into the air.'],
    E: ['The lines to the ground are stretched tight, with sticky glue at the foot.', 'A walking bug bumps one, it snaps free, and the bug is pulled up.', 'Now its legs can not reach the ground.'],
    yesno: [['Does the thread go down?', true], ['Will the bug like it?', false]] },
  hum: { title: 'The web hums', pic: 'web', gate: false,
    A: ['I can not see it.', 'I go to it.', 'I see a bug!'],
    B: ['It is night. I can not see.', 'What is on my web?', 'I run and look.'],
    C: ['It is night, and I can not see well.', 'But my web hums by my legs.', 'I run to where it hums.'],
    D: ['I can not see very well, even by day.', 'When a bug is in my web, I can feel the threads shake.', 'So I know just where to run.'],
    E: ['I have eight eyes, but I hardly use them.', 'My legs feel every shake of the silk.', 'Quick shakes mean a bug, and slow ones mean a leaf.'],
    yesno: [['Can I feel my web?', true], ['Can I see well at night?', false]] },
  wrap: { title: 'A parcel', pic: 'parcel', gate: false,
    A: ['I see a bug.', 'I get it.', 'I can eat!'],
    B: ['I get the bug with my silk.', 'It is a little parcel!', 'I can eat now.'],
    C: ['I fling silk at the bug.', 'Then I wrap it up.', 'Now it is a parcel for me.'],
    D: ['First I fling sticky silk with my back legs.', 'Then I wrap the bug up into a neat parcel.', 'I can not chew, so I sip my snack.'],
    E: ['My back feet have little combs that fling sticky silk.', 'I turn the bug round and round until it is a parcel.', 'A spider can not chew, so I drink my meal.'],
    yesno: [['Do I wrap the bug?', true], ['Do I chew my snack?', false]] },
  leaf: { title: 'Just a leaf', pic: 'leaf', gate: false,
    A: ['I see a leaf.', 'I can not eat it.', 'No, no, no!'],
    B: ['What is on my web?', 'It is a leaf!', 'It is not a bug.'],
    C: ['The web hums, but it hums slow.', 'It is a leaf, not a bug.', 'I cut it out of my web.'],
    D: ['Something slow is in my web.', 'It is just a leaf that came on the wind.', 'I cut it out and let it go.'],
    E: ['Not everything that lands in a web is food.', 'A leaf swings slowly and does not kick.', 'I cut the threads around it and it drops.'],
    yesno: [['Is it a leaf?', true], ['Can I eat a leaf?', false]] },
  molt1: { title: 'A new skin', pic: 'skin', gate: true,
    A: ['I eat and eat.', 'I am big.', 'Look at me!'],
    B: ['My skin is too little.', 'I get out of it!', 'Now I am big.'],
    C: ['My skin is too tight now.', 'I hang by a thread and wiggle out.', 'My new skin has stripes!'],
    D: ['When my skin gets too tight, I must get out of it.', 'I hang from a thread and pull my legs out.', 'Now I am bigger, with white and orange stripes.'],
    E: ['My skin is my skeleton, and it can not stretch.', 'So I hang from a thread, split it, and pull myself out.', 'Underneath I am bigger, and striped white and orange.'],
    yesno: [['Do I have a new skin?', true], ['Am I little now?', false]] },
  visitor: { title: 'Who is that?', pic: 'wasp', gate: false,
    A: ['I see a wasp.', 'I hide.', 'I sit.'],
    B: ['Look! A big wasp.', 'I will hide.', 'I do not run.'],
    C: ['Something has come to look at me.', 'I hide in my den, or I drop down.', 'Then it will go away.'],
    D: ['A wasp is looking for spiders by day.', 'I stay deep in my den, or I drop and keep very still.', 'Soon it will go away again.'],
    E: ['The blue wasp, the lizard and the mantis all look for spiders.', 'I do not fight. I hide in my den, or drop and curl up.', 'When I keep still, they soon lose interest.'],
    yesno: [['Do I hide?', true], ['Do I run at the wasp?', false]] },
  curl: { title: 'Like a little seed', pic: 'curl', gate: false,
    A: ['I go down.', 'I sit.', 'I hide.'],
    B: ['I go down on my silk.', 'I sit and I do not run.', 'It can not see me.'],
    C: ['I drop down on my thread.', 'I put my legs in and rest.', 'I look like a little black dot.'],
    D: ['When something comes too close, I drop on my line.', 'I pull my legs in and keep very still.', 'It thinks I am a seed, so it goes away.'],
    E: ['A frightened widow drops out of her web on a thread.', 'She folds her legs and lies as still as a seed.', 'Most hunters look for things that move.'],
    yesno: [['Do I drop down?', true], ['Do I run fast?', false]] },
  people: { title: 'Look, do not touch', pic: 'kid', gate: false,
    A: ['I see a child.', 'I see a light.', 'Look, look!'],
    B: ['A child will look at me.', 'They do not get me.', 'They look and go.'],
    C: ['A child and a grown-up come with a torch.', 'They look at me. They do not touch me.', 'That is good for them and good for me.'],
    D: ['Two people came with a light to look at my web.', 'They did not touch, and they did not put a hand in.', 'I am shy, so I just stay still.'],
    E: ['A black widow is shy and will not chase anyone.', 'But her bite can make a person very sick.', 'So people look, do not touch, and tell a grown-up.'],
    yesno: [['Do they look at me?', true], ['Do they touch me?', false]] },
  broom: { title: 'The broom', pic: 'broom', gate: false,
    A: ['I see a broom.', 'I go up.', 'I sit in my den.'],
    B: ['Look! A big broom.', 'I hide up in my den.', 'I will make a new web.'],
    C: ['A broom takes some of my web away.', 'I am up in my den.', 'I will make new threads at night.'],
    D: ['The broom took the threads that went down to the ground.', 'I stay in my den until it has gone.', 'Then I make them all again.'],
    E: ['People sweep webs away, and that is fine.', 'I wait in my den, where the broom can not reach.', 'Tonight I will drop new lines to the ground.'],
    yesno: [['Is my web gone?', true], ['Am I gone too?', false]] },
  grown: { title: 'Black and red', pic: 'adult', gate: true,
    A: ['I am big.', 'I am black.', 'I see red!'],
    B: ['I am a big black spider.', 'Look! I have a red dot.', 'I am not little now.'],
    C: ['This is my last new skin.', 'Now I am all black.', 'I have a red hourglass under me.'],
    D: ['I get out of my skin one last time.', 'Now I am smooth and black all over.', 'Under me there is a red mark, like an hourglass.'],
    E: ['This is my last moult, and now I am full grown.', 'I am glossy black, with a red hourglass underneath.', 'I hang upside down, so the red faces up.'],
    yesno: [['Am I black now?', true], ['Do I have stripes now?', false]] },
  grownboy: { title: 'A grown-up boy', pic: 'boy', gate: true,
    A: ['I am big.', 'I can go.', 'Look at me!'],
    B: ['I am a big boy now.', 'I am not black.', 'I want to go and look for her.'],
    C: ['This is my last new skin.', 'I am not big, and I am not black.', 'Now I will go and find her web.'],
    D: ['I get out of my skin one last time.', 'I am still small, with stripes and very long legs.', 'Now I will go away from my web.'],
    E: ['A full-grown male stays small and keeps his stripes.', 'He leaves his own web and goes wandering.', 'He follows the smell of silk to find a female.'],
    yesno: [['Am I a boy spider?', true], ['Am I big and black?', false]] },
  red: { title: 'Red means stop', pic: 'hourglass', gate: false,
    A: ['I see a bird.', 'I am red.', 'No, no, bird!'],
    B: ['Look! A big bird.', 'I am black and red.', 'The bird will not get me.'],
    C: ['A bird looks at me.', 'I hang and it can see my red.', 'The bird goes away.'],
    D: ['A bird can see red very well.', 'I hang upside down so that it can see my red mark.', 'It knows to stay away from me.'],
    E: ['Birds hunt with their eyes, and they see red clearly.', 'Scientists think the hourglass is a warning to them.', 'Most insects can hardly see it at all.'],
    yesno: [['Can the bird see red?', true], ['Will the bird eat me?', false]] },
  male: { title: 'A soft hum', pic: 'heart', gate: false,
    A: ['I see a spider.', 'He is little.', 'Hi, hi, hi!'],
    B: ['My web hums.', 'It is not a bug!', 'It is a little boy spider.'],
    C: ['My web hums, but it hums soft and slow.', 'That is not a bug.', 'A boy spider has come to say hi.'],
    D: ['This hum is soft and slow, not fast like a bug.', 'A male has come and he plucks my web.', 'I pluck back to tell him I know.'],
    E: ['A male plucks the web softly and steadily to say who he is.', 'A stuck bug shakes it in quick, hard bursts.', 'I can tell the two apart with my feet.'],
    yesno: [['Is it a boy spider?', true], ['Is it a bug?', false]] },
  pluck: { title: 'Soft and slow', pic: 'heart', gate: false,
    A: ['I see her web.', 'I go to it.', 'Hi, hi, hi!'],
    B: ['Here is her web.', 'I pluck it. Not too fast!', 'She will know it is me.'],
    C: ['I am on her web now.', 'I pluck it soft and slow.', 'Then she knows I am not a bug.'],
    D: ['I must not shake her web like a bug.', 'I pluck it softly, again and again.', 'When she plucks back, I can come closer.'],
    E: ['A male must tell the female that he is not her next meal.', 'He plucks and shakes her threads in a soft, steady beat.', 'People say she always eats him, but that is rare.'],
    yesno: [['Do I pluck her web?', true], ['Do I pluck it fast?', false]] },
  sacspin: { title: 'Round and round', pic: 'sac', gate: false,
    A: ['I see a sac.', 'It is my sac.', 'I like it.'],
    B: ['I made a little sac.', 'My eggs are in it.', 'I sit with it.'],
    C: ['I spin round and round.', 'Now my eggs are in a sac of silk.', 'I will stay by it.'],
    D: ['I lay my eggs and then I spin round and round them.', 'Soon they are safe in a round sac of silk.', 'I stay very close to it.'],
    E: ['I lay hundreds of eggs into a small cup of silk.', 'Then I spin around it until the sac is round and tough.', 'I will guard it in my web until they hatch.'],
    yesno: [['Are my eggs in the sac?', true], ['Do I go away now?', false]] },
  eggs: { title: 'New spiderlings', pic: 'parent', gate: true,
    A: ['I see the sac.', 'I see a little spider!', 'We go up.'],
    B: ['Look! Little spiders.', 'They go up, up, up.', 'The wind will get them.'],
    C: ['The little spiders come out of the sac.', 'They go up to the top.', 'Then the wind takes them away.'],
    D: ['The tiny spiders climb out of the sac, just as I did.', 'They climb up high and let out their silk.', 'It all starts again.'],
    E: ['The spiderlings bite their way out and climb for the highest place.', 'One by one they let out their silk and sail away.', 'Each one will come down somewhere new and begin again.'],
    yesno: [['Do they come out of the sac?', true], ['Do they stay in the sac?', false]] }
};
const STORY_TRIGGERS = { started: 'sac', settled: 'den', firstGum: 'gum', caught: 'hum', parcel: 'wrap', cutLeaf: 'leaf', visitor: 'visitor', curled: 'curl', peopleLook: 'people', swept: 'broom', showed: 'red', suitorCame: 'male', pluckStart: 'pluck', sacDone: 'sacspin' };

/* ---------- read-and-do missions ----------
   who: ling (the climb on the porch) · web (at home, with a web).  from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'roof', who: 'ling', A: 'Go up, up!', B: 'Go up to the top.', C: 'Go up to the top of the roof.', D: 'Climb up to the top of the roof.', E: 'Climb to the highest place you can find.' },
  { key: 'lamp', who: 'ling', from: 'C', A: 'Go to the light.', B: 'Go to the big light.', C: 'Go and look at the light.', D: 'Go and look at the porch light.', E: 'Walk under the roof to the porch light.' },
  { key: 'den', who: 'web', A: 'Go to my den.', B: 'Go and sit in the den.', C: 'Go and rest in your den.', D: 'Go back and rest in your den.', E: 'Walk back to your den and wait there.' },
  { key: 'ground', who: 'web', A: 'Go down, down!', B: 'Go down to the ground.', C: 'Go down to the ground.', D: 'Climb all the way down to the ground.', E: 'Find a way down and stand on the ground.' },
  { key: 'thread', who: 'web', A: 'Go on the silk.', B: 'Go and sit on the thread.', C: 'Go out on a thread.', D: 'Walk out onto one of your threads.', E: 'Walk out to the middle of a thread.' },
  { key: 'drop', who: 'web', A: 'Go down on silk.', B: 'Drop down on the silk.', C: 'Drop down on a line.', D: 'Drop down on a line of silk.', E: 'Let go and hang on a line of silk.' },
  { key: 'silk', who: 'web', from: 'B', A: 'Go and get silk.', B: 'Fix one more thread.', C: 'Fix a new thread.', D: 'Fix a new thread in your web.', E: 'Fix a new thread from one thing to another.' },
  { key: 'gum', who: 'web', from: 'C', A: 'Go down.', B: 'Go down on silk.', C: 'Make a thread down to the ground.', D: 'Make a new thread down to the ground.', E: 'Drop a new sticky line down to the ground.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const HINT_A = { sac: 'I am in a sac.', wiggle: 'Go, go, go!', climb: 'Go up!', tiptoe: 'Go up! Look!', balloon: 'Up! Up! Down!', warmair: 'I go up!', landed: 'I am down. Go!', build1: 'Go to it!', build2: 'Go to it!', silkgo: 'Go, go!', dropnow: 'Go down!', hang: 'Down! Up!', gumfoot: 'Look at it!', wait: 'I sit. I look.', feelit: 'Go to it!', hum: 'Go to it!', fling: 'Get it!', wrap: 'Get it!', yum: 'I can eat!', tight: 'Look at me!', dauber: 'I see a wasp! Hide!', lizard: 'I see a lizard! Hide!', mantis: 'I see a mantis! Hide!', bird: 'I see a bird!', broom: 'I see a broom! Go up!', hide: 'Hide!', people: 'I see a light!', eggs: 'I see the sac!', spin: 'Go, go, go!', guard: 'Sit!', day: 'I sleep.', pluck: 'Hi! Hi!', walkaway: 'Go!', gofind: 'Go to it!' };
const READ_HINTS = Object.fromEntries(Object.keys(HINTS).map(k => [k, { A: HINT_A[k] || 'Look!', B: HINTS[k][1], C: HINTS[k][1], D: HINTS[k][1], E: HINTS[k][0] }]));
