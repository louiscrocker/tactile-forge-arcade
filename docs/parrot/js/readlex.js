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
/* words only Parrot needs, added to a level on purpose (tools/fill-words.mjs keeps this in step) */
const LEVEL_EXTRA = {
  A: "hi food here air not big red hide sit",
  B: "flap say her call over now its them old push arrows wiggle wait press space beg yum grow keep warm your same oops again e eyes open climb small coming squawk went away comes family someone people us looked first fly arrow land did good more know goes tall morning splash fright off safe back palms find crack found into how grown preen pair toucans try new live yours lay bring stay home full listen starts",
  C: "take give sits does myself sings looks wild make strong so bank many sees calls bite soft when much itself or eats ground",
  D: "pick white loud high way but wide carry still close landing bad hard hold hand cracks called row took own had sat made head neat each touch who even far something nothing gives",
  E: "mate brings ripe palm scrape lives floor feed hear scarlet lays kept weeks inside ready pink bare shut stand lift parents pouch meal works scientists learns life fruit holes straight noise travel watch never belongs forest flock months holding feet makes flying muscles leaving fledging branch flight wobbly worse seeds kinds young which ones following drop lot animals gather lick salt think why eagles hunt watches sky alarm sends whole together most alarms turn holds turns curved nutcracker few thick moment forth flies feeds if sight answer evening roost settles side move light stays years clean smooth their beaks preening friends reach usually almost needs enough others sometimes hanging boxes mother father carries his crop voices across higher than tallest great kapok hatched among ledge parent quite any squawking yet calling follow going sleeps beside today ring gently another already bzzz empty takes happening learn"
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
  parrot: 'parrot', parrots: 'parrot', macaw: 'parrot', macaws: 'parrot', bird: 'parrot', birds: 'parrot', mom: 'parrot', dad: 'parrot',
  chick: 'chick', chicks: 'chick', egg: 'egg', eggs: 'egg', tree: 'tree', trees: 'tree', hole: 'hollow', hollow: 'hollow', nest: 'hollow', door: 'hollow', box: 'box',
  fig: 'fig', figs: 'fig', nut: 'nut', nuts: 'nut', clay: 'clay', river: 'river', toucan: 'toucan', eagle: 'eagle', hawk: 'eagle', boat: 'boat', child: 'kid',
  wing: 'wing', wings: 'wing', feather: 'feather', feathers: 'feather', beak: 'beak', foot: 'foot', leaf: 'leaf', leaves: 'leaf', sun: 'sun', moon: 'moon',
  bee: 'bee', bees: 'bee', friend: 'pair', name: 'call', mist: 'mist', rope: 'rope'
};

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the action cards ---------- */
const ACTION_TEXT = {
  beg:   { A: 'eat',    B: 'I want it',  C: 'beg for food',     D: 'beg for my food',        E: 'Beg for the food at the door.' },
  take:  { A: 'eat',    B: 'get it',     C: 'take the food',    D: 'take the food he has',   E: 'Take the food my mate brings.' },
  flap:  { A: 'go',     B: 'flap',       C: 'flap my wings',    D: 'flap my wings fast',     E: 'Flap to make my wings strong.' },
  eat:   { A: 'eat',    B: 'eat a fig',  C: 'eat the fig',      D: 'pick a fig and eat',     E: 'Pick a ripe fig and eat it.' },
  crack: { A: 'nut',    B: 'get a nut',  C: 'crack the nut',    D: 'crack the nut open',     E: 'Crack the palm nut with my beak.' },
  lick:  { A: 'clay',   B: 'eat clay',   C: 'eat some clay',    D: 'bite off some clay',     E: 'Scrape some clay from the bank.' },
  preen: { A: 'hi',     B: 'say hi',     C: 'preen my friend',  D: 'preen its feathers',     E: 'Preen the feathers on its head.' },
  peek:  { A: 'look',   B: 'look in',    C: 'look in the hole', D: 'look into the hollow',   E: 'Look to see who lives here.' },
  enter: { A: 'go in',  B: 'go in',      C: 'go into the hole', D: 'go into my hollow',      E: 'Climb into my own hollow.' },
  lay:   { A: 'egg',    B: 'an egg',     C: 'lay an egg',       D: 'lay a white egg',        E: 'Lay an egg on the hollow floor.' },
  feed:  { A: 'food',   B: 'food for her', C: 'give her food',  D: 'give her the food',      E: 'Feed my mate at the door.' },
  call:  { A: 'sing',   B: 'call',       C: 'call my name',     D: 'call out loud',          E: 'Call so my family can hear.' }
};
/* the picture on each action card */
const ACTION_PIC = { beg: 'chick', take: 'fig', flap: 'wing', eat: 'fig', crack: 'nut', lick: 'clay', preen: 'pair', peek: 'hollow', enter: 'hollow', lay: 'egg', feed: 'fig', call: 'call' };
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you do?', B: 'What will you do?', C: 'What will you do?', D: 'Read and tap what to do.', E: 'Read and tap what to do.' };

/* ---------- leveled story pages ----------
   gate: true pages are "read to grow": the parrot's next step waits for them.
   The others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  egg: { title: 'In the egg', pic: 'egg', gate: false,
    A: ['I am in an egg.', 'I see a nest.', 'I sleep.'],
    B: ['I am in a little egg.', 'It is in a hole in a big tree.', 'I want to get out!'],
    C: ['I am in an egg, in a hole in a tree.', 'My mom sits on me and I am warm.', 'Now I will wiggle out.'],
    D: ['My egg is in a hollow, very high up in an old tree.', 'My mom sits on it to keep it warm.', 'Soon I will push my way out.'],
    E: ['A scarlet macaw lays her eggs on the floor of a hollow tree.', 'She has kept this one warm for more than three weeks.', 'Now the chick inside is ready to hatch.'],
    yesno: [['Am I in an egg?', true], ['Is my egg in the river?', false]] },
  hatch: { title: 'Out of the egg', pic: 'chick', gate: true,
    A: ['I am a chick.', 'I can eat.', 'Look at me!'],
    B: ['Look! I am out.', 'I am a little chick.', 'I can not see. I want to eat!'],
    C: ['I wiggle out of the egg.', 'I am a little chick, and I can not see.', 'I have no feathers at all!'],
    D: ['I push and push until the egg comes open.', 'I am tiny, and I have no feathers.', 'I can not see, but I can open my beak very wide.'],
    E: ['A new macaw chick is pink and bare, and its eyes are shut.', 'It can not stand up or keep itself warm.', 'All it can do is lift its head and beg.'],
    yesno: [['Am I a little chick?', true], ['Do I have red feathers now?', false]] },
  food: { title: 'Food at the door', pic: 'parrot', gate: false,
    A: ['I see my mom.', 'I can eat.', 'I like it!'],
    B: ['Mom and Dad come to me.', 'They have food for me.', 'I eat and eat.'],
    C: ['Mom comes to the door of the hole.', 'She has food for me in her beak.', 'I eat, and then I grow.'],
    D: ['Mom and Dad fly out to find food, again and again.', 'They carry it home to the hollow for me.', 'Every time I eat, I grow a little.'],
    E: ['My parents carry food home in a pouch in the throat.', 'At the door they bring it up, soft and warm, into my beak.', 'With every meal my feathers grow a little more.'],
    yesno: [['Does Mom have food?', true], ['Do I get the food by myself?', false]] },
  name: { title: 'My name', pic: 'call', gate: false,
    A: ['I see my dad.', 'I sing to my dad.', 'I sing my name!'],
    B: ['Dad will sing to me.', 'It is my name!', 'I can sing it too.'],
    C: ['Dad sings a little call to me.', 'That call is my name.', 'Now I can sing my name back.'],
    D: ['Mom and Dad make a call just for me.', 'It is my name, and I sing it back to them.', 'When I call it, they will know it is me.'],
    E: ['A wild parrot has a call of its own that works like a name.', 'Scientists found that young parrots learn their call from their parents.', 'The chick learns it, and keeps it for life.'],
    yesno: [['Is the call my name?', true], ['Is my name a fig?', false]] },
  toucan: { title: 'Who looks in?', pic: 'toucan', gate: false,
    A: ['I see a toucan.', 'I sing!', 'It can go.'],
    B: ['Look! A toucan.', 'It has a big, big beak.', 'I call for Mom and Dad!'],
    C: ['A toucan looks into my hole.', 'I call and call for Mom and Dad.', 'They come, and the toucan goes away.'],
    D: ['A toucan with a very long beak looks in at the door.', 'I call as loud as I can.', 'Mom and Dad fly back fast, and off it goes.'],
    E: ['Toucans eat fruit, but they look into nest holes too.', 'A loud call brings my parents straight back.', 'They make so much noise that the toucan gives up.'],
    yesno: [['Do I call for Mom and Dad?', true], ['Do I go out to the toucan?', false]] },
  people: { title: 'Wild and free', pic: 'kid', gate: false,
    A: ['I see a child.', 'We look.', 'I am up here.'],
    B: ['They come to look at me.', 'They do not get me.', 'They look, and they go.'],
    C: ['Some people come to look at us.', 'They look, and then they go away.', 'I am a wild parrot. I live here.'],
    D: ['People come to look at the parrots.', 'They are very still, and they do not come too close.', 'A wild parrot must stay with its family.'],
    E: ['People travel a long way to watch wild macaws.', 'They keep still, stay far back, and never feed us.', 'A wild parrot belongs in the forest with its flock.'],
    yesno: [['Do they look at me?', true], ['Do they take me away?', false]] },
  door: { title: 'At the door', pic: 'wing', gate: false,
    A: ['I am up.', 'I see a tree.', 'I go, go, go!'],
    B: ['I am at the door.', 'I see all the trees!', 'I flap and flap.'],
    C: ['I come up to the door of my hole.', 'I can see over the trees.', 'I flap my wings to make them good and strong.'],
    D: ['Now I have all my feathers, so I climb up to the door.', 'I can see a long way over the trees.', 'I flap my wings again and again to make them strong.'],
    E: ['After three months I am as big as my parents.', 'I stand at the door and flap hard, holding on with my feet.', 'It makes my flying muscles strong.'],
    yesno: [['Do I flap my wings?', true], ['Am I a little chick now?', false]] },
  fledge: { title: 'My first flight', pic: 'fledge', gate: true,
    A: ['I go up.', 'I am in the air!', 'Look at me go!'],
    B: ['I jump out of the hole.', 'I am in the air!', 'I can go to Mom and Dad.'],
    C: ['Mom and Dad call me from a tree.', 'I jump out into the air.', 'I flap and flap, and I am over there!'],
    D: ['Mom and Dad call my name from the next tree.', 'I jump, and I flap as fast as I can.', 'It is not a good landing, but I did it!'],
    E: ['Leaving the nest for the first time is called fledging.', 'My parents call from a branch close by, and I jump.', 'My first flight is wobbly, and my landing is worse.'],
    yesno: [['Can I fly now?', true], ['Do I stay in the hole?', false]] },
  figs: { title: 'Figs', pic: 'fig', gate: false,
    A: ['I see a fig.', 'I eat it.', 'I like figs!'],
    B: ['Mom and Dad eat figs.', 'I eat a fig too.', 'I like it!'],
    C: ['We fly to a big tree with figs on it.', 'Mom and Dad eat, so I eat too.', 'Now I know that figs are good.'],
    D: ['I do not know what is good to eat.', 'So I go where Mom and Dad go, and eat what they eat.', 'Now I know about figs.'],
    E: ['Macaws eat fruit, seeds and nuts from many kinds of tree.', 'A young bird learns which ones by following its parents.', 'We drop a lot, and animals on the ground eat that.'],
    yesno: [['Do I eat figs?', true], ['Do I eat the tree?', false]] },
  clay: { title: 'The clay lick', pic: 'clay', gate: false,
    A: ['I see clay.', 'We eat it.', 'I see a parrot!'],
    B: ['We go over the river.', 'Here they all eat clay!', 'I eat clay too.'],
    C: ['We fly over the river to a big red bank.', 'So many parrots are there!', 'They eat the clay, so I eat some too.'],
    D: ['By the river there is a bank of red clay.', 'Every day so many parrots come here to eat it.', 'I bite some off. It is not bad!'],
    E: ['A bank where parrots gather to eat clay is called a clay lick.', 'The clay has salt in it, which is hard to find in the forest.', 'Scientists think that is why we come.'],
    yesno: [['Do parrots eat clay?', true], ['Is the clay in a tree?', false]] },
  eagle: { title: 'Up, up, up!', pic: 'eagle', gate: false,
    A: ['I see an eagle.', 'We go up!', 'Up, up, up!'],
    B: ['Look! An eagle.', 'We all go up in the air.', 'It can not get me.'],
    C: ['One parrot sees an eagle and calls.', 'Then all the parrots fly up.', 'The eagle goes away.'],
    D: ['When one bird sees an eagle, it calls out loud.', 'Then every bird at the clay goes up at the same time.', 'With so many of us, the eagle can not get one.'],
    E: ['Forest eagles hunt parrots, so every bird watches the sky.', 'One alarm call sends the whole flock into the air together.', 'Most alarms turn out to be nothing at all.'],
    yesno: [['Do we all fly up?', true], ['Do I sit and look at the eagle?', false]] },
  nut: { title: 'A hard nut', pic: 'nut', gate: false,
    A: ['I see a nut.', 'I can eat it.', 'I like nuts!'],
    B: ['Here is a big nut.', 'I get it with my foot.', 'I will eat it!'],
    C: ['A nut is good to eat.', 'I put it in my foot, and then I bite.', 'Snap! Now I can eat it.'],
    D: ['This nut is very hard.', 'I hold it in one foot, just like a hand.', 'Then I bite down until it cracks open.'],
    E: ['A macaw holds a nut in one foot and turns it with its tongue.', 'Its beak is curved and very strong, like a nutcracker.', 'It can open nuts that few other animals can.'],
    yesno: [['Do I crack the nut?', true], ['Is the nut soft?', false]] },
  lost: { title: 'Where are you?', pic: 'mist', gate: false,
    A: ['I can not see.', 'I sing.', 'I see my mom!'],
    B: ['I can not see Mom and Dad!', 'I call my name.', 'They call it too. Here they are!'],
    C: ['There is mist, and I can not find Mom and Dad.', 'I call my name.', 'They call back, so I know where to go.'],
    D: ['The mist came down and I could not see my family.', 'I called my name as loud as I could.', 'They called back, and I just went to the call.'],
    E: ['The forest is thick, and mist can hide a bird in a moment.', 'So a family calls back and forth while it flies and feeds.', 'If I drop out of sight I call, and they answer.'],
    yesno: [['Do they call back?', true], ['Do I hide from Mom and Dad?', false]] },
  roost: { title: 'Good night', pic: 'moon', gate: false,
    A: ['I see the moon.', 'I see my mom.', 'We sleep.'],
    B: ['The sun will go down.', 'We go to a big tree.', 'We sit and we sleep.'],
    C: ['When the sun goes down, we fly to a big tree.', 'I sit by Mom and Dad.', 'Good night!'],
    D: ['Every night we fly to the very same tall tree.', 'We sit close, all in a row.', 'It is safe up here, so we can sleep.'],
    E: ['In the evening, macaws fly to a tall tree to roost.', 'The family settles side by side on a high branch.', 'They will not move again until first light.'],
    yesno: [['Do we sleep in a tree?', true], ['Do we sleep in the river?', false]] },
  grown: { title: 'All grown up', pic: 'adult', gate: true,
    A: ['I am big.', 'I am red.', 'Look at me!'],
    B: ['I am big now.', 'I can go and play.', 'I want a friend.'],
    C: ['Now I am big, and I know so much.', 'Mom and Dad stay in the old tree.', 'I will go and find a friend.'],
    D: ['It took a very long time, but now I am all grown up.', 'I know where to eat, where to hide and where to sleep.', 'Now I must find a friend of my own.'],
    E: ['A young macaw stays with its parents for many months.', 'It is three or four years old before it starts a family.', 'First it has to find a mate.'],
    yesno: [['Am I big now?', true], ['Am I a little chick?', false]] },
  preen: { title: 'A friend', pic: 'pair', gate: false,
    A: ['I see a parrot.', 'I like it.', 'Hi, hi, hi!'],
    B: ['Here is a parrot.', 'I sit with it.', 'I will look at its feathers.'],
    C: ['A parrot sits by the clay, all by itself.', 'I go and sit with it.', 'I preen its feathers with my beak.'],
    D: ['I saw a parrot that had no friend.', 'I sat down next to it and did not go too fast.', 'Then I made the feathers on its head all neat.'],
    E: ['Birds clean and smooth their feathers with their beaks.', 'This is called preening.', 'Friends preen each other on the head, where no bird can reach.'],
    yesno: [['Do I sit with the parrot?', true], ['Do I bite the parrot?', false]] },
  pair: { title: 'Wing to wing', pic: 'pair', gate: true,
    A: ['We go up.', 'We like it.', 'We go, go, go!'],
    B: ['Now we are two.', 'We go up in the air.', 'My friend is here with me!'],
    C: ['Now I have a friend.', 'We fly wing to wing.', 'Where I go, my friend comes too.'],
    D: ['My friend and I will stay with each other from now on.', 'When we fly, we are so close that our wings could touch.', 'You can see who is a pair, even from far away.'],
    E: ['Scarlet macaws that pair up usually stay together for life.', 'They feed together, rest together and fly side by side.', 'Their wings almost touch.'],
    yesno: [['Do we fly wing to wing?', true], ['Do I fly away from my friend?', false]] },
  hollow: { title: 'A hole of our own', pic: 'hollow', gate: false,
    A: ['I see a hole.', 'I look in.', 'No, no, no!'],
    B: ['We want a hole.', 'I look in this one. A toucan!', 'Here is one for me!'],
    C: ['We look for a hole in a tree.', 'Some have bees or toucans in them.', 'Then we find a good one. It is our hole now!'],
    D: ['We can not make a hollow, so we must find one.', 'Every one we look in has something in it.', 'At last we find one with nothing in it at all!'],
    E: ['A macaw can not dig. It needs an old tree with a hole in it.', 'There are never enough, and others want them too.', 'Sometimes people help by hanging up nest boxes.'],
    yesno: [['Do we find a hole?', true], ['Do we make a hole?', false]] },
  sit: { title: 'One sits, one brings', pic: 'egg', gate: false,
    A: ['I see an egg.', 'I see my friend.', 'We like it.'],
    B: ['Here are the eggs.', 'She will sit on them.', 'He will get the food.'],
    C: ['She sits on the eggs so they are warm.', 'He goes to find food.', 'Then he comes back and she eats.'],
    D: ['The eggs must stay warm, so she can not go out.', 'He goes out, eats, and comes back to the door.', 'He gives her the food, and off he goes again.'],
    E: ['The mother keeps the eggs warm for more than three weeks.', 'The father flies out to feed and carries food back in his crop.', 'He feeds her at the door of the hollow.'],
    yesno: [['Does she sit on the eggs?', true], ['Do the eggs get cold?', false]] },
  eggs: { title: 'A new chick', pic: 'parent', gate: true,
    A: ['I see an egg.', 'I see a chick!', 'I sing to it.'],
    B: ['Look! A little chick.', 'It can not see me.', 'I sing a name for it.'],
    C: ['A little chick comes out of the egg.', 'I sing a new call for it.', 'That is its name. Now it can sing too!'],
    D: ['Our chick came out of its egg, just as I did.', 'I make a new call for it, and that is its name.', 'It all starts again.'],
    E: ['The eggs hatch, and the hollow is full of tiny voices.', 'I give each chick a call of its own.', 'One day they will stand at this door and fly.'],
    yesno: [['Do I sing a name for the chick?', true], ['Is the chick big?', false]] }
};
const STORY_TRIGGERS = { started: 'egg', fed: 'food', named: 'name', toucanCame: 'toucan', peopleLook: 'people', atDoor: 'door', lesson_fig: 'figs', lesson_clay: 'clay', flockUp: 'eagle', lesson_nut: 'nut', lesson_call: 'lost', sleeping: 'roost', preenStart: 'preen', nestFound: 'hollow', laid: 'sit' };

/* ---------- read-and-do missions ----------
   who: fly (a bird that can fly, with nothing else to do).  from: the lowest level the mission is offered at */
const MISSIONS = [
  { key: 'ground', who: 'fly', A: 'Go down, down!', B: 'Go down and sit.', C: 'Fly down to the ground.', D: 'Fly all the way down to the ground.', E: 'Land on the forest floor.' },
  { key: 'river', who: 'fly', A: 'Go to the river.', B: 'Go over the river.', C: 'Fly over the river.', D: 'Fly out over the river.', E: 'Fly out across the wide river.' },
  { key: 'top', who: 'fly', A: 'Go up, up!', B: 'Go up, up, up!', C: 'Fly up over the trees.', D: 'Fly up high, over all the trees.', E: 'Fly higher than the tallest tree.' },
  { key: 'roost', who: 'fly', from: 'B', A: 'Go to the big tree.', B: 'Sit in the big, big tree.', C: 'Fly to the top of the big tree.', D: 'Land in the very tall tree.', E: 'Land in the great kapok tree.' },
  { key: 'home', who: 'fly', from: 'C', A: 'Go to my tree.', B: 'Go to the old hole.', C: 'Fly back to the old hole.', D: 'Fly back to the tree where you came from.', E: 'Land on the old tree where you hatched.' },
  { key: 'leaves', who: 'fly', A: 'Hide in the leaves.', B: 'Hide in the leaves.', C: 'Fly into the leaves and hide.', D: 'Hide in the leaves of a tree.', E: 'Hide among the leaves at the top of a tree.' },
  { key: 'cliff', who: 'fly', from: 'B', A: 'Go to the clay.', B: 'Go and sit on the clay.', C: 'Fly to the clay and sit.', D: 'Land on the bank of clay.', E: 'Land on a ledge of the clay lick.' },
  { key: 'call', who: 'fly', A: 'Sing!', B: 'Call, call, call!', C: 'Call your name.', D: 'Call your name out loud.', E: 'Call out, and listen for an answer.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const HINT_A = { egg: 'I am in an egg.', wiggle: 'Go, go, go!', hatched: 'I am a chick!', beg: 'I can eat!', take: 'I can eat!', yum: 'I like it!', name: 'Look at it!', named: 'My name!', climb: 'Go up!', toucan: 'I see a toucan!', squawk: 'Sing!', flap: 'Go, go, go!', jump: 'Go up!', firstflight: 'Go! Go down.', gofig: 'Go to the fig!', goclay: 'Go to the clay!', lick: 'Eat the clay!', eagle: 'I see an eagle! Up!', hawk: 'I see an eagle!', flyup: 'Go up!', gonut: 'Go to the nut!', crack: 'Eat the nut!', lost: 'Sing!', heard: 'Go to it!', theycall: 'Go to it!', hideleaves: 'Go to the leaves!', roost: 'Go to the tree!', gomeet: 'Go to the parrot!', preen: 'Hi!', findhollow: 'Go to the hole!', enter: 'Go in!', lay: 'An egg!', sit: 'I sit.', bringfood: 'Go to the fig!', cropfull: 'Go to the hole!', namechick: 'Sing to it!', newgen: 'I see a chick!', climber: 'Look up!', boat: 'I see a boat!' };
const READ_HINTS = Object.fromEntries(Object.keys(HINTS).map(k => [k, { A: HINT_A[k] || 'Look!', B: HINTS[k][1], C: HINTS[k][1], D: HINTS[k][1], E: HINTS[k][0] }]));
