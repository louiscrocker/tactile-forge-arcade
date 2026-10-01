/* ============================================================
   readlex.js — the leveled words and texts for Read to Play
   ============================================================
   Copied from Frog Pond (see READING_DESIGN.md).  READ_LEVELS,
   LEVEL_INFO and LEVEL_NEW are SHARED across the Tactile Forge
   games so a level means the same everywhere — change them in
   every game or in none.  Alicorn Skies adds its own words on
   purpose in LEVEL_GAME (merged into the same levels).
   Levels follow guided-reading levels A–E (Fountas & Pinnell):
     A  one short line, a repeated pattern, a handful of sight words
     B  one or two lines, the pattern changes at the end
     C  two to five lines, more sight words, simple verbs
     D  longer sentences, less repetition
     E  several sentences, more varied words
   Every word a child meets must be in LEVEL_WORDS for that level
   (cumulative) or be a picture noun (PIC_NOUNS), which at A and B
   is drawn with a little picture next to it, like a rebus book.
   {me} and {foal} are replaced with the alicorn's and the foal's
   names.  smoke.js checks every text below against these lists.
   ============================================================ */
'use strict';

/* ---------- shared across the games ---------- */
const READ_LEVELS = ['A', 'B', 'C', 'D', 'E'];
const LEVEL_INFO = {
  A: { name: 'Level A', choices: 2, window: 10, help: 6, buildMax: 4, rebus: true, tasks: ['match'], about: 'One short line. A few sight words. Pictures help.' },
  B: { name: 'Level B', choices: 3, window: 8, help: 9, buildMax: 6, rebus: true, tasks: ['build'], about: 'One or two lines. The pattern changes at the end.' },
  C: { name: 'Level C', choices: 3, window: 7, help: 12, buildMax: 7, rebus: false, tasks: ['build', 'yesno'], about: 'Two to five lines. More sight words and action words.' },
  D: { name: 'Level D', choices: 3, window: 6, help: 15, buildMax: 8, rebus: false, tasks: ['fill', 'yesno'], about: 'Longer sentences with less repeating.' },
  E: { name: 'Level E', choices: 3, window: 6, help: 18, buildMax: 9, rebus: false, tasks: ['fill', 'yesno'], about: 'Several sentences, more varied words.' }
};
/* new words at each level; a level may use its own words and every earlier level's */
const LEVEL_NEW = {
  A: 'a an i see the can look at is my like go me we up am in it to eat hop no yes down sleep sing',
  B: 'and here you big little come said not on he she get swim sit hide out have two three four one what this fast run jump play all will are for with night black green red brown cold air kick want of they do has too',
  C: 'bites read word words into went was now some where there that then back under away dive snap lay from time day warm wet new good help find rest grow grew gone puff other top wake wiggle put dots be wants by over our',
  D: 'spring hungry when again so after just very could about make came saw off soon first last long open stay know feel deep safe slow tiny keeps hiding its jaw shoots toes as front smaller every climb lily buzzes throat balloon song hatch did short covers dig soft until must days gets sits next hop up',
  E: 'goes lid still stiff singing them eating your tongue because through around before while something tickles webbed well gills close lungs gulp shrinking push stuck ball dot waiting flick zoom like spring winter every quiet other bright wakes hungry warmer melts sunny fills'
};
/* ---------- this game's own words, added to the levels on purpose ---------- */
const LEVEL_GAME = {
  A: 'fly hi hug smile magic glow arrow',
  B: 'fun happy pink blue walk dash yay',
  C: 'friend friends light lift cheer shake race home sky high lost pretty talk land',
  D: 'shiny sparkle grumpy fell brave',
  E: 'gentle sleepy glowing flies gives give comes'
};
const LEVEL_WORDS = (function () {
  const out = {}; let acc = new Set();
  for (const L of READ_LEVELS) {
    for (const w of (LEVEL_NEW[L] + ' ' + LEVEL_GAME[L]).split(/\s+/)) if (w) acc.add(w);
    out[L] = new Set(acc);
  }
  return out;
})();

/* nouns a child can read from the picture; value = picture key */
const PIC_NOUNS = {
  alicorn: 'alicorn', alicorns: 'alicorn', unicorn: 'alicorn', horn: 'horn', wings: 'wings', wing: 'wings',
  castle: 'castle', princess: 'crown', crown: 'crown', star: 'star', stars: 'star', sun: 'sun', moon: 'moon',
  cloud: 'cloud', clouds: 'cloud', rainbow: 'rainbow', flower: 'flower', flowers: 'flower', apple: 'apple', apples: 'apple',
  gem: 'gem', gems: 'gem', crystal: 'crystal', crystals: 'crystal', ring: 'ring', rings: 'ring',
  bunny: 'bunny', fox: 'fox', owl: 'owl', deer: 'deer', frog: 'frog', frogs: 'frog', swan: 'swan', sheep: 'sheep',
  lamb: 'lamb', dragon: 'dragon', mermaid: 'mermaid', fish: 'fish', shell: 'shell', shells: 'shell', pearl: 'pearl', pearls: 'pearl',
  stable: 'stable', foal: 'foal', baby: 'foal', tree: 'tree', trees: 'tree', woods: 'tree', lake: 'water', water: 'water',
  ice: 'ice', snow: 'snow', snowman: 'snowman', butterfly: 'butterfly', bird: 'bird', cake: 'party', party: 'party',
  medal: 'trophy', mountain: 'mountain', map: 'map', bow: 'bow', heart: 'heart', lily: 'frog',
  /* the friends' names read from their pictures too */
  bramble: 'bunny', hoot: 'owl', hazel: 'fox', fern: 'deer', cloudia: 'sheep', ember: 'dragon', marina: 'mermaid', puff: 'lamb'
};
/* names that clash with ordinary words: the capitalised one is the friend */
const NAME_PICS = { Pearl: 'swan', Lily: 'frog' };

const tokenize = (s) => String(s).replace(/\{\w+\}/g, ' ').toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  fly:    { A: 'fly',   B: 'fly',   C: 'fly up',   D: 'fly up high',      E: 'Fly up into the sky!' },
  magic:  { A: 'magic', B: 'magic', C: 'magic',    D: 'make magic',       E: 'Make magic with my horn.' },
  talk:   { A: 'hi',    B: 'hi',    C: 'talk',     D: 'talk to my friend', E: 'Talk to my friend.' },
  wake:   { A: 'up',    B: 'up',    C: 'wake up',  D: 'wake the flower',  E: 'Wake up the sleepy flower.' },
  glow:   { A: 'glow',  B: 'glow',  C: 'light',    D: 'light it up',      E: 'Make the crystal glow.' },
  lift:   { A: 'fly',   B: 'fly',   C: 'lift',     D: 'lift the star',    E: 'Lift the star back up.' },
  cheer:  { A: 'smile', B: 'smile', C: 'cheer up', D: 'cheer up the cloud', E: 'Cheer up the grumpy cloud.' },
  open:   { A: 'look',  B: 'look',  C: 'look in',  D: 'open the shell',   E: 'Open the shell to find a pearl.' },
  apples: { A: 'apples', B: 'get',  C: 'shake',    D: 'shake the tree',   E: 'Shake the apples down.' },
  dash:   { A: 'go',    B: 'fast',  C: 'dash',     D: 'dash away',        E: 'Dash away like a rainbow!' },
  dive:   { A: 'down',  B: 'down',  C: 'dive',     D: 'dive down deep',   E: 'Dive down under the water.' },
  hug:    { A: 'hug',   B: 'hug',   C: 'hug',      D: 'hug my foal',      E: 'Go and hug my little foal.' }
};
/* the picture shown on each card */
const ACTION_PIC = { fly: 'wings', magic: 'horn', talk: 'bunny', wake: 'flower', glow: 'crystal', lift: 'star', cheer: 'cloud', open: 'shell', apples: 'apple', dash: 'rainbow', dive: 'water', hug: 'foal' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled pages: one per quest (read to finish it), the foal growing, the seasons ---------- */
const READ_CHAPTERS = {
  start: { pic: 'alicorn', gate: false, title: 'Hello!',
    A: ['I am an alicorn.', 'I can fly!', 'I can see the castle.'],
    B: ['I am a little alicorn.', 'I have a horn and wings.', 'Here I come!'],
    C: ['I am a new alicorn.', 'I have a horn and two wings.', 'This is my new home.', 'Now I will find some friends!'],
    D: ['I am a new alicorn with a horn and two wings.', 'The castle is my new home.', 'Soon I will make some friends.'],
    E: ['I am a new alicorn with a shiny horn and two wings.', 'The castle is my home.', 'Something good is waiting for me.'],
    yesno: [['Do I have wings?', true], ['Can I fly?', true], ['Am I a fish?', false]] },
  hello: { pic: 'bunny', gate: true, title: 'A new friend',
    A: ['I see Bramble.', 'Hi, Bramble!', 'I like Bramble.'],
    B: ['Here is Bramble.', 'Bramble is a little bunny.', 'We will play!'],
    C: ['Bramble is a little bunny.', 'She is my new friend.', 'We will play in the flowers.'],
    D: ['Bramble is a little bunny by the castle.', 'She is my very first friend.', 'We will play in the flowers every day.'],
    E: ['Bramble the bunny comes to see me.', 'She is my very first friend.', 'We will play in the flowers every day.'],
    yesno: [['Is Bramble a bunny?', true], ['Is Bramble a fish?', false]] },
  flowers: { pic: 'flower', gate: true, title: 'Wake up, flowers!',
    A: ['I see a flower.', 'Up, flower, up!', 'I like it!'],
    B: ['The flowers sleep.', 'Up, up, up!', 'Look! Pink and red!'],
    C: ['The flowers want to sleep.', 'My magic can wake the flowers.', 'Now they are up and happy!'],
    D: ['The flowers by the castle did not wake up.', 'I make magic with my horn.', 'Now every flower is open!'],
    E: ['The flowers by the castle are still sleepy.', 'I make magic with my horn.', 'Now every flower is open and bright.'],
    yesno: [['Did the flowers wake up?', true], ['Are the flowers black?', false], ['Can I make magic?', true]] },
  fly: { pic: 'ring', gate: true, title: 'I can fly!',
    A: ['I can fly.', 'I fly up, up, up!', 'I fly in the ring.'],
    B: ['Look at me!', 'I can fly!', 'I fly in the rings.'],
    C: ['I went up into the sky.', 'I went over the flowers.', 'I can fly now!'],
    D: ['I fly up high into the sky.', 'I fly over the castle and the trees.', 'Now I know I can fly!'],
    E: ['I zoom up high through the rings.', 'I fly over the castle and the trees.', 'Now I know I can fly!'],
    yesno: [['Can I fly?', true], ['Did I go in the rings?', true], ['Is the sky green?', false]] },
  foal: { pic: 'foal', gate: true, title: 'A baby alicorn',
    A: ['I see a foal.', 'I hug the foal.', 'We go to the stable.'],
    B: ['Here is a little foal.', 'She is not big.', 'Come with me, little foal!'],
    C: ['A little foal was lost in the woods.', 'Now she has a new home.', 'I will help the foal grow.'],
    D: ['A tiny foal was hiding in the woods.', 'Now she is safe in the stable.', 'I will help the foal grow up.'],
    E: ['A tiny foal was hiding in the woods, lost and quiet.', 'Now she is safe and warm in the stable.', 'I will look after the foal until she is big.'],
    yesno: [['Is the foal big?', false], ['Is the foal in the stable?', true]] },
  lamb: { pic: 'lamb', gate: true, title: 'The lost lamb',
    A: ['I see a lamb.', 'I fly up.', 'I go up to Cloudia.'],
    B: ['Here is a little lamb.', 'He will come with me.', 'We fly up to Cloudia!'],
    C: ['Puff the lamb was lost.', 'He went on my back.', 'We went up to the clouds.'],
    D: ['Puff the lamb fell off the clouds.', 'He came up on my back.', 'Cloudia was so happy!'],
    E: ['Puff the lamb fell off the clouds and was lost.', 'He came up on my back, through the clouds.', 'Cloudia was so happy!'],
    yesno: [['Is Puff a lamb?', true], ['Did Puff go on my back?', true], ['Is Puff a fish?', false]] },
  fallen: { pic: 'star', gate: true, title: 'The fallen stars',
    A: ['I see a star.', 'Up, star, up!', 'I see the stars go up.'],
    B: ['Here is a little star.', 'Up, star, up!', 'The stars are up!'],
    C: ['Some stars went down into the woods.', 'My magic put the stars back.', 'Now they are up in the sky.'],
    D: ['Some tiny stars fell down into the woods.', 'I make magic with my horn.', 'The stars go back up into the sky.'],
    E: ['Some tiny stars fell down into the woods.', 'I lift them with my magic.', 'Now they are bright in the sky again.'],
    yesno: [['Did the stars go up?', true], ['Are the stars in the lake?', false]] },
  crystals: { pic: 'crystal', gate: true, title: 'Lights for the lake',
    A: ['I see a crystal.', 'It can glow.', 'I like it!'],
    B: ['Look at the crystals.', 'They glow for Lily!', 'Lily is happy.'],
    C: ['Lily wants the crystals to glow.', 'I light the crystals with magic.', 'Now the frogs can have a party!'],
    D: ['Lily the frog wants a party at the lake.', 'I light every crystal with my magic.', 'Now the lake can glow at night.'],
    E: ['Lily the frog wants a party at the lake.', 'I walk on the water and light every crystal.', 'Now the lake is glowing and bright.'],
    yesno: [['Do the crystals glow?', true], ['Is Lily a frog?', true], ['Is Lily a bird?', false]] },
  mermaid: { pic: 'mermaid', gate: true, title: 'The mermaid\'s pearls',
    A: ['I see a fish.', 'I go down.', 'I see a mermaid!'],
    B: ['I go down in the water.', 'Here is a mermaid.', 'She has a shell for me!'],
    C: ['I went down under the water.', 'I put my magic on the shells.', 'Marina the mermaid has the pearls now!'],
    D: ['I dive down deep into the lake.', 'I open every shell and find a pearl.', 'Marina the mermaid is so happy!'],
    E: ['I dive down deep into the lake.', 'I open the shells, one by one, and find the pearls.', 'Marina the mermaid gives me a shell crown.'],
    yesno: [['Did I go under the water?', true], ['Is Marina a mermaid?', true], ['Is Marina a bunny?', false]] },
  ember: { pic: 'dragon', gate: true, title: 'Ember can fly',
    A: ['I see a dragon.', 'We fly up.', 'We fly up, up, up!'],
    B: ['Here is Ember.', 'He is a little dragon.', 'He can fly with me!'],
    C: ['Ember is a little dragon.', 'He went up with me into the sky.', 'Now he can fly!'],
    D: ['Ember is a tiny dragon.', 'He did not know he could fly.', 'We fly up the mountain.', 'Now he can fly with me.'],
    E: ['Ember is a tiny dragon.', 'He did not know he could fly.', 'We zoom up the mountain through the rings.', 'Now he flies with me.'],
    yesno: [['Is Ember a dragon?', true], ['Can Ember fly now?', true], ['Is Ember a fish?', false]] },
  race: { pic: 'trophy', gate: true, title: 'The race',
    A: ['I fly in the rings.', 'I go up.', 'Go, go, go!'],
    B: ['Ember and I fly fast.', 'We go in all the rings.', 'Here I come!'],
    C: ['Ember and I race in the sky.', 'We fly into the rings.', 'What fun!'],
    D: ['Ember and I race over the flowers.', 'We fly into every ring, first to last.', 'That was very fast!'],
    E: ['Ember and I race over the flowers and up to the clouds.', 'We zoom through every ring.', 'Now I have a shiny medal.'],
    yesno: [['Is Ember a dragon?', true], ['Did I race Ember?', true], ['Did we fly in rings?', true], ['Did we swim?', false]] },
  rainbow: { pic: 'rainbow', gate: true, title: 'The rainbow is back',
    A: ['I see a rainbow.', 'I like the rainbow!'],
    B: ['Here are the gems.', 'Red, green and blue!', 'Look at the big rainbow!'],
    C: ['I put the gems on the mountain.', 'The rainbow is back!', 'Now it is back for good!'],
    D: ['I find the gems, one by one.', 'I fly to the top of the mountain.', 'The rainbow is back again!'],
    E: ['I find the gems, one by one.', 'I fly up to the top of the mountain.', 'The rainbow comes back, bright and new!'],
    yesno: [['Is the rainbow back?', true], ['Is the rainbow black?', false]] },
  moon: { pic: 'star', gate: true, title: 'Stars in the sky',
    A: ['I see the stars.', 'I go up to the stars.'],
    B: ['I fly up at night.', 'I see the stars.', 'One, two, three, four!'],
    C: ['I went up over the clouds.', 'I put my magic on the stars.', 'Now the stars are a unicorn!'],
    D: ['I fly up high over the clouds.', 'I go to every star.', 'The stars make a unicorn in the sky!'],
    E: ['I fly up high over the clouds, into the night sky.', 'I go to every star, one by one.', 'Now the stars make a bright unicorn!'],
    yesno: [['Is it night?', true], ['Is it day?', false], ['Did I fly to the stars?', true], ['Did the stars make a fish?', false]] },
  party: { pic: 'party', gate: true, title: 'The big party',
    A: ['We sing.', 'We eat cake.', 'We like the party!'],
    B: ['We have a party!', 'Look! It is night.', 'We sing and play.'],
    C: ['All my friends are here.', 'We have a big party at the castle.', 'We sing and play all night!'],
    D: ['All my friends came to the castle.', 'We have a party with cake and stars.', 'This is a very good day!'],
    E: ['All my friends came to the castle for a party.', 'We sing and play under the bright stars.', 'Now I am a princess!'],
    yesno: [['Is it a party?', true], ['Did we have a party?', true], ['Did all my friends come?', true], ['Did we eat fish?', false]] },
  foalYoung: { pic: 'foal', gate: true, title: 'My foal grew!',
    A: ['Look at my foal!', 'My foal can fly!'],
    B: ['My foal is not little.', 'She can fly a little!'],
    C: ['My foal grew!', 'Now she can fly a little.', 'She will come with me.'],
    D: ['My foal grew up a little.', 'Now she can fly next to me.', 'She is not so tiny now.'],
    E: ['My foal grew up a little.', 'Now she can fly next to me, not too high.', 'She wants apples every day.'],
    yesno: [['Did my foal grow?', true], ['Can my foal fly?', true], ['Is my foal a fish?', false]] },
  foalGrown: { pic: 'foal', gate: true, title: 'All grown up',
    A: ['I see my foal fly!', 'We fly up, up, up!'],
    B: ['My foal is big!', 'We fly and play.'],
    C: ['My foal grew up!', 'Now we can fly to the top of the sky.', 'We will be friends for all time.'],
    D: ['My little foal is big now, just like me.', 'We can fly over the clouds.', 'We will be friends for every day.'],
    E: ['My little foal is big now, just like me.', 'We can fly over the clouds and through the stars.', 'We will be friends for all time.'],
    yesno: [['Is my foal big now?', true], ['Can we fly?', true], ['Is my foal a fish?', false]] },
  winter: { pic: 'snowman', gate: false, title: 'Snow!',
    A: ['I see the snow.', 'I like the snow!'],
    B: ['It is cold.', 'Look at the snow!', 'The lake is ice.'],
    C: ['It is cold now.', 'Snow is on the trees.', 'I can walk on the ice!'],
    D: ['The days are short and cold.', 'Snow covers the trees.', 'The lake is ice, so I can walk on it.'],
    E: ['The days are short and cold.', 'Snow covers the trees and the castle.', 'The lake is ice, so I can walk on it.'],
    yesno: [['Is it cold?', true], ['Is the lake ice?', true], ['Is it warm?', false]] },
  spring: { pic: 'flower', gate: false, title: 'Spring!',
    A: ['I see the sun.', 'I see a flower!'],
    B: ['The snow is not here.', 'Look! A flower!', 'I see the sun.'],
    C: ['The snow is gone!', 'The sun is warm.', 'The flowers grow back.'],
    D: ['The snow is gone and the sun is warm.', 'New flowers open by the castle.', 'Spring is here!'],
    E: ['The snow melts and the sun fills the sky.', 'New flowers open by the castle.', 'Spring is here!'],
    yesno: [['Is the snow gone?', true], ['Is the snow here?', false]] }
};

/* ---------- what to do next, written on the quest card (read, not heard) ---------- */
/* offered: go and find the friend with the quest; {who} is their name */
const QUEST_OFFER = { A: 'Go to {who}.', B: 'Go to {who}.', C: 'Go and find {who}.', D: 'Go and talk to {who}.', E: 'Go and talk to {who}.' };
const QUEST_READ = {
  flowers: [{ A: 'Up, flowers, up!', B: 'Get the flowers up.', C: 'Wake up the flowers.', D: 'Wake up the flowers with magic.', E: 'Wake up the sleepy flowers with magic.' }],
  fly: [{ A: 'Fly in the rings.', B: 'Fly in the rings.', C: 'Fly into the rings.', D: 'Fly into all three rings.', E: 'Fly through all three rings.' }],
  foal: [{ A: 'Go to the woods.', B: 'Go to the woods. Look!', C: 'Find the foal in the woods.', D: 'Find the lost foal in the woods.', E: 'Find the lost foal and be gentle.' },
    { A: 'Go to the stable.', B: 'Walk to the stable.', C: 'Walk home to the stable.', D: 'Walk the foal to the stable.', E: 'Walk the foal home. She can not fly.' }],
  lamb: [{ A: 'Go to the lamb.', B: 'Get the little lamb.', C: 'Find Puff in the flowers.', D: 'Find Puff the lamb by the castle.', E: 'Find Puff the lamb in the flowers.' },
    { A: 'Go up to Cloudia.', B: 'Fly up to Cloudia.', C: 'Fly Puff up to Cloudia.', D: 'Fly Puff up to Cloudia in the clouds.', E: 'Fly Puff back up to Cloudia on the clouds.' }],
  fallen: [{ A: 'Go to the stars.', B: 'Get the stars up.', C: 'Find the stars in the woods.', D: 'Find the tiny stars in the woods.', E: 'Find the tiny stars and lift them up.' }],
  crystals: [{ A: 'Glow, crystals, glow!', B: 'Look at the crystals.', C: 'Light the crystals.', D: 'Light every crystal in the lake.', E: 'Walk on the lake and light every crystal.' }],
  mermaid: [{ A: 'Go down in the water.', B: 'Go down and get pearls.', C: 'Dive down and find the pearls.', D: 'Dive down deep and open the shells.', E: 'Dive down deep and open the shells to find pearls.' },
    { A: 'Go to Marina.', B: 'Go to Marina.', C: 'Swim to Marina.', D: 'Swim down to Marina.', E: 'Swim down and give the pearls to Marina.' }],
  ember: [{ A: 'Fly in the rings.', B: 'Fly with Ember.', C: 'Fly into the rings with Ember.', D: 'Fly up the mountain with Ember.', E: 'Fly through the rings up the mountain.' }],
  race: [{ A: 'Go to the rainbow.', B: 'Go to the rainbow.', C: 'Race Ember in the rings.', D: 'Go under the rainbow to race.', E: 'Walk under the rainbow to race Ember.' }],
  rainbow: [{ A: 'See the gems.', B: 'Get the gems.', C: 'Find all the gems.', D: 'Find every gem, one by one.', E: 'Find every gem, one by one.' },
    { A: 'Go up the mountain.', B: 'Fly up the mountain.', C: 'Fly to the top of the mountain.', D: 'Fly to the very top of the mountain.', E: 'Fly up to the very top of the mountain.' }],
  moon: [{ A: 'Go up to the stars.', B: 'Fly up to the stars.', C: 'Fly up high to the stars.', D: 'Fly up to every star, one by one.', E: 'Fly up high and go to every star, one by one.' }],
  party: [{ A: 'Go to {who}.', B: 'Go to {who}.', C: 'Go and find {who}.', D: 'Go and talk to {who}.', E: 'Go and talk to {who} about the party.' },
    { A: 'Go to Bramble.', B: 'Come to Bramble.', C: 'Go back to Bramble.', D: 'Fly back to Bramble.', E: 'Fly back to Bramble for the party.' }]
};
/* when every quest is done */
const FREE_READ = { A: 'Go! Fly! Sing!', B: 'Go and play!', C: 'Now go and play!', D: 'Now go and play with my friends!', E: 'Now go and play with all my friends!' };

/* ---------- read-and-do missions ---------- */
const MISSIONS = [
  { key: 'castle', A: 'Go to the castle.', B: 'Go to the big castle.', C: 'Fly to the castle.', D: 'Fly over to the castle.', E: 'Fly over to the pink castle.' },
  { key: 'cloud', A: 'Go up to a cloud.', B: 'Sit on a cloud.', C: 'Fly up to the top of a cloud.', D: 'Fly up high and sit on a cloud.', E: 'Fly up high and sit on top of a cloud.' },
  { key: 'lake', A: 'Go to the water.', B: 'Walk on the water.', C: 'Walk on the lake.', D: 'Walk over the water on the lake.', E: 'Walk over the water like magic.' },
  { key: 'butterfly', A: 'Look at a butterfly.', B: 'Hug a butterfly.', C: 'Find a butterfly.', D: 'Fly to a butterfly.', E: 'Fly over to a pretty butterfly.' },
  { key: 'stars', A: 'Go to a star.', B: 'Get two stars.', C: 'Get three stars.', D: 'Get three stars in the sky.', E: 'Get three stars from the sky.' },
  { key: 'tree', A: 'Go to a tree.', B: 'Go to a big tree.', C: 'Find a big tree.', D: 'Fly over to a big tree.', E: 'Fly over to a big tree in the woods.' },
  { key: 'hop', A: 'Hop, hop, hop!', B: 'Jump up and down.', C: 'Jump, jump, jump!', D: 'Jump up and down: one, two, three!', E: 'Jump up and down: one, two, three!' },
  { key: 'sit', B: 'Sit down.', C: 'Sit down and rest.', D: 'Sit down and rest a little.', E: 'Sit down and rest for a little while.' },
  { key: 'arch', A: 'Go to the rainbow.', B: 'Go to the rainbow.', C: 'Find the rainbow by the castle.', D: 'Go over to the rainbow.', E: 'Go over to the rainbow by the castle.' },
  { key: 'flower', A: 'Magic! See a flower!', B: 'Magic for a flower!', C: 'Put magic on a flower.', D: 'Make magic on a flower.', E: 'Make a flower sparkle with magic.' },
  { key: 'bramble', A: 'Go to Bramble.', B: 'Go to Bramble the bunny.', C: 'Go and find Bramble.', D: 'Go and talk to Bramble.', E: 'Go and talk to Bramble the bunny.' },
  { key: 'stable', need: 'foal', A: 'Go to the stable.', B: 'Go to the stable.', C: 'Go back home to the stable.', D: 'Go and see my foal at the stable.', E: 'Go and see my foal in the stable.' },
  { key: 'apple', need: 'foal', B: 'Get an apple.', C: 'Shake a tree and get an apple.', D: 'Shake a tree and get an apple.', E: 'Shake a tree and get an apple.' }
];

/* ---------- leveled hints for Read to Play (shown, only read aloud as help) ---------- */
const READ_HINTS = {
  start: { A: 'I can go. I can fly!', B: 'Walk, run and fly!', C: 'Walk, run and fly. Find my friends!', D: 'Walk and run, then fly up into the sky.', E: 'Walk and run, then fly up high into the sky.' },
  walk: { A: 'Go, go, go!', B: 'Walk and run!', C: 'Walk and run!', D: 'Walk and run fast!', E: 'Walk and run fast!' },
  fly: { A: 'Fly up, up, up!', B: 'Fly up! Come down.', C: 'Fly up. Then come back down.', D: 'Fly up high, then come down slow.', E: 'Fly up high, then come down slow.' },
  magic: { A: 'Magic! Look!', B: 'Magic for the flowers!', C: 'Put magic on the flowers.', D: 'Make magic by the flowers.', E: 'Make magic by the flowers to wake them.' },
  talk: { A: 'Hi! Hi!', B: 'Come and play!', C: 'Talk to my friends.', D: 'Go and talk to my friends.', E: 'Go and talk to all my friends.' },
  dash: { A: 'Go, go, go!', B: 'Dash! Go fast!', C: 'Dash like a rainbow!', D: 'Dash away fast like a rainbow!', E: 'Dash away as fast as a rainbow!' },
  stars: { A: 'I see stars.', B: 'Get the stars!', C: 'Get the stars in the sky.', D: 'Get the stars in the sky.', E: 'Get all the stars you can find.' },
  clouds: { A: 'I see a cloud.', B: 'Sit on a cloud!', C: 'I can sit on the clouds!', D: 'I can sit on top of the clouds!', E: 'I can sit on top of the soft clouds!' },
  water: { A: 'I see the water.', B: 'Walk on the water!', C: 'I can walk on the water!', D: 'I can walk on top of the water!', E: 'I can walk on top of the water, like magic!' },
  night: { A: 'I see the moon.', B: 'It is night.', C: 'It is night. Look at the stars!', D: 'It is night. Look up at the stars!', E: 'It is night. Look up at the bright stars!' },
  storm: { A: 'A cloud! Smile!', B: 'A cloud! Magic!', C: 'Cheer up the cloud with magic!', D: 'A grumpy cloud! Cheer it up!', E: 'A grumpy cloud! Cheer it up with magic!' },
  sit: { A: 'Sleep.', B: 'Sit down.', C: 'Sit down and rest.', D: 'Sit down to rest.', E: 'Sit down to rest. At night I sleep.' },
  free: FREE_READ,
  foal: { A: 'I see my foal.', B: 'Go to my foal.', C: 'Go see my foal at home.', D: 'Go and see my foal at the stable.', E: 'Go and see my foal. She wants apples!' },
  apples: { A: 'I see apples.', B: 'Get the apples!', C: 'Shake the tree to get apples.', D: 'Shake the tree to get the apples.', E: 'Shake the tree with magic to get apples.' },
  swim: { A: 'Go down!', B: 'Go down, down!', C: 'Dive down under the water!', D: 'Dive down deep under the water!', E: 'Dive down deep under the water!' },
  skate: { A: 'I see the ice!', B: 'Run on the ice!', C: 'Run fast on the ice!', D: 'Run fast on the ice!', E: 'Run fast on the ice!' },
  race: { A: 'Go to the rainbow!', B: 'Go to the rainbow!', C: 'Go under the rainbow to race!', D: 'Go under the rainbow to race!', E: 'Walk under the rainbow to race!' },
  map: { A: 'Look at the map.', B: 'Look at the map.', C: 'Look at the map!', D: 'Look at the map!', E: 'Look at the map!' },
  wardrobe: { A: 'Look! A bow!', B: 'Get a bow!', C: 'Get a pretty bow!', D: 'Get a pretty bow with my stars!', E: 'Get a pretty bow with my stars!' },
  land: { A: 'Down, down, down.', B: 'Come down, down!', C: 'Come down to land.', D: 'Come down slow to land.', E: 'Come down slow to land on a cloud.' },
  quest: { A: 'Look at the arrow.', B: 'Go with the arrow!', C: 'Go where the arrow is.', D: 'Fly where the arrow is.', E: 'Fly over to where the arrow is.' },
  ring: { A: 'Fly in the ring.', B: 'Fly in the rings!', C: 'Fly into the rings!', D: 'Fly into every ring!', E: 'Fly through every ring!' },
  moon: { A: 'I can see the moon!', B: 'I am on the moon!', C: 'I am up on the moon!', D: 'I am up on the moon!', E: 'I am up on the moon!' }
};
