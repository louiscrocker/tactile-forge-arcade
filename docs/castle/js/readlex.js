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

   READ_LEVELS, LEVEL_INFO and LEVEL_NEW are shared with the whole
   Tactile Forge family (see Frog Pond's READING_DESIGN.md) so a
   level means the same thing in every game.  Words only this game
   needs are in LEVEL_EXTRA, on purpose, one level at a time.
   ============================================================ */
'use strict';
/* ---- shared with the whole family: do not edit the 15 lines below (md5 b52a90ecec889a06584f321d42559f80) ---- */

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
/* words only the castle needs, added to a level on purpose */
const LEVEL_EXTRA = {
  A: 'room build wall top tall home put make dig stone stones name tap moat yum pop and big cold comes dark day do goes guard he here high kind likes more not on out ride run swim this try two wet white yet thing drag snap saved teeth arrow',
  B: 'knight horse castle king queen door window gate roof floor tower bridge bed table chair fire water grass sky sun moon star snow rain cloud day dark light rooms knights horses coins coin flag flags swan swans pigeon dog cat mouse tree hay well ride walk high low under over into inside outside by them us her him his my your our new old warm cold wet dry round long short full empty open shut off white gold blue another bow brave brush coming does done eats enough falls first fit five friendly from glow goes guards hall happy kitchen lives nobody or sits stables that things traders undo who',
  C: 'hot add again apple arrows bits burn buzz every fires free front furnish gatehouse give ground its lies loves made needs page pick pinch redo royal runs scroll sent so spade spot take taller their tool until zoom stairs climb climbs sleep sleeps eats cook cooks cooked feast dinner bread soup bake bakes read reads book books harp music sing sings dance dances guard guards patrol train trains joust lance shield shields bow bows tap taps points nobody hurt kind brave safe strong proud happy dragon friendly puff puffs sparkles smoke wing wings flies fly lands sits waits visit visits carriage visitor trader traders market stall stalls torch torches candle candles glow glows shine shines lit night nights morning evening winter spring summer autumn season fell falls melts ice icy edge drawbridge chain chains lifts lift lower lowers across shall sometimes once upon time lived lives place places people grooms groom brush brushes feeds feed oats stable stables blocks block hammer anvil forge smith baker oven loaf cheese cellar library nursery cradle toy toys land whole each other side than everybody comes goes going red green trays tray fish ribbons gave know what hole fills swim pointed step steps steps out welcome who thing things something different wall walls hall great',
  D: 'ago along around bar bedchamber belonged belongs bottom bring brushed castles cells changed check choose chronicle ditch dragons everyone far faster fed fill finish furniture gardens getting got had hand hooting knight\'s let liked live mind moats own opens portrait promised ripples rode room\'s sat say set shows sold starts tables thousand together tried type wait were wore battlements merlons crenels portcullis slides grooves gatekeeper tournament practise quintain sandbag bops destrier mews falconer hawk jester juggles bells tapestry tapestries woven keeps keep stories masons chisels mortar quarry years built building builder plans plan treasury quests quest reward rewards village villagers farmers rent grain sacks stained glass coloured pieces lead strips expensive richest paint paints painted colours colour arrow slit slits narrow wider bigger strongest highest tallest clouds fireworks flowers invented china weddings victories chandelier candlelit candlelight lamp lamps lanterns wake wakes asleep awake dawn dusk midnight twilight shadow shadows frost frosty icicles drifts drift snowman ceiling finished yet closed except through job jobs eating cooking sleeping solar morning stone soldier loyal protect courtyard pies fruit tricks blunt lances good end electricity most people bed indoors fires fireplace burned burned white servants shown held roofs drips gutters furs cloth pots square straw groom every strong real kept ladder ladders cross middle herbs apple fountain pond ducks cost farm straw blocks spring river sparkles fire',
  E: 'above anybody ate became began behind biggest both boy button buy called carry catalogue covered cut edges feasts filled floors flying friends homes iron itself lady lord many meant months much nothing only other\'s piece ran rises sell send show slept small start took visitors year thousand hundred twenty fourteen seven squire page pages promised promise spiral staircase wound winding garderobe moths clothes hung smell curtains rushes rugs oil electric homing dovecote message messages marzipan spiced puddings musicians jugglers stalls gatehouse keepers mason stonemason architect drawbridges battlement crenel merlon moats ditch ditches dug digging raised lowered pulled winch sliding meaning french belonged everybody platform together dancing roasted roast spit separate caught catch catching flames chimney chimneys hearth hearths cauldron cauldrons carved carving sculpture statue statues banner banners coat arms family families identify identified identical harmed breathe breathes sparkle sparkling perch perched perches puffed puffing enemy corners knock inside faster glue thick car long shut galloped rail cheered bowed treasure brave princesses princes landed meat played juggled sweetest shaped holders walked stars stoked shutters steep spouts animals arrived own servants finishing countries allowed else nobody walled wind honey spring pile hammer chisel shaped mine shut surrounded'
};
const LEVEL_WORDS = (function () {
  const out = {}; let acc = new Set();
  for (const L of READ_LEVELS) {
    for (const w of (LEVEL_NEW[L] + ' ' + LEVEL_EXTRA[L]).split(/\s+/)) if (w) acc.add(w);
    out[L] = new Set(acc);
  }
  return out;
})();

/* nouns a child can read from the picture; value = picture key (Sprites.icon) */
const PIC_NOUNS = (function () {
  const p = {
    castle: 'room', stone: 'stone', stones: 'stone', block: 'stone', blocks: 'stone', wall: 'stone', walls: 'stone', tower: 'tower', towers: 'tower', spire: 'cone', roof: 'roof', roofs: 'roof',
    battlements: 'battlement', door: 'door', doors: 'door', gate: 'gate', window: 'arch', windows: 'arch', glass: 'stained', slit: 'slit', stairs: 'stair', floor: 'floor', wood: 'wood',
    moat: 'moat', water: 'moat', bridge: 'bridge', drawbridge: 'drawbridge', room: 'room', rooms: 'room',
    knight: 'knight', knights: 'knight', horse: 'horse', horses: 'horse', princess: 'princess', prince: 'prince', king: 'crown', queen: 'crown', crown: 'crown', dragon: 'dragon', cook: 'cook', jester: 'jester',
    dog: 'dog', dogs: 'dog', cat: 'cat', cats: 'cat', swan: 'swan', swans: 'swan', pigeon: 'pigeon', pigeons: 'pigeon', owl: 'owl', mouse: 'mouse', carriage: 'carriage', coins: 'coins', coin: 'coins', gold: 'coins',
    sun: 'sun', moon: 'moon', star: 'night', stars: 'night', night: 'night', snow: 'snow', rain: 'rain', fireworks: 'fireworks', feast: 'feast', joust: 'joust', market: 'market', village: 'village', quest: 'quest', flag: 'flag', flags: 'flag',
    throne: 'throne', bed: 'canopybed', beds: 'bed', table: 'longtable', chair: 'stool', fire: 'fireplace', hearth: 'hearth', books: 'bookshelf', book: 'bookshelf', harp: 'harp', torch: 'torch', torches: 'torch', candle: 'candle', light: 'chandelier', tapestry: 'tapestry', banner: 'banner', carpet: 'carpet', rug: 'rug', mirror: 'mirror', wardrobe: 'wardrobe',
    stall: 'stall', hay: 'hay', kennel: 'kennel', anvil: 'anvil', forge: 'forgefire', oven: 'oven', bread: 'breadshelf', cheese: 'cheese', barrel: 'barrel', chest: 'chest', armour: 'armour', shields: 'shields', lances: 'lancerack', telescope: 'telescope', globe: 'globe', bell: 'bell', cradle: 'cradle', toy: 'rockinghorse', toys: 'toychest',
    tree: 'appletree', trees: 'appletree', well: 'well', fountain: 'fountain', roses: 'rosebush', flowers: 'rosebush', hedge: 'hedge', garden: 'rosebush', pond: 'pond', quintain: 'quintain', tent: 'tent', bees: 'beehive', lamp: 'lamppost', swing: 'swing', cart: 'cart', bench: 'gbench', stand: 'stand', lookout: 'telescope', bottles: 'winerack', camera: 'camera', picture: 'camera'
  };
  /* every item's and tile's word is a picture word for its own picture */
  for (const k of ITEM_KEYS) { const w = ITEMS[k].word; if (!p[w]) p[w] = k; }
  for (const k in TILE_INFO) { const w = TILE_INFO[k].word; if (TILE_INFO[k].icon && !p[w]) p[w] = TILE_INFO[k].icon; }
  return p;
})();

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
/* words that are not allowed at a level (used by smoke.js and by the level check) */
function offLevel(text, L) { return tokenize(text).filter(w => !LEVEL_WORDS[L].has(w) && !PIC_NOUNS[w]); }

/* ---------- the words on the build cards ("Read to Build") ---------- */
const PLURAL_WORDS = new Set(['bees', 'roses', 'coins', 'lances', 'books', 'toys', 'shields', 'battlements', 'stairs', 'bottles', 'tools', 'crates', 'scrolls', 'herbs', 'pots', 'saddles', 'pigeons', 'stones', 'helmets', 'flowers']);
function buildText(word, L) {
  const an = /^[aeiou]/.test(word) ? 'an' : 'a', plural = PLURAL_WORDS.has(word);
  switch (L) {
    case 'A': return word;
    case 'B': return plural ? `the ${word}` : `${an} ${word}`;
    case 'C': return plural ? `put the ${word} here` : `put ${an} ${word} here`;
    case 'D': return `put the ${word} in here`;
    default: return `Put the ${word} here, in this room.`;
  }
}
/* the question on the card, spoken aloud (it is an instruction, not the test) */
const CARD_PROMPT = { A: 'What will you build?', B: 'What will you build?', C: 'What will you build?', D: 'Read and tap what to build.', E: 'Read and tap what to build.' };

/* ---------- leveled story pages ----------
   gate: true pages wait before a big moment (the first horse, the first feast, the joust, the dragon);
   the others open once when their moment comes (see STORY_TRIGGERS). */
const READ_CHAPTERS = {
  start: { title: 'My castle', pic: 'room', gate: false,
    A: ['I see my castle.', 'It is my home.'],
    B: ['Look at my castle!', 'It is big.', 'It is my home.'],
    C: ['This is my castle.', 'I will build it up, stone by stone.', 'It is my home!'],
    D: ['This is my castle. It is not finished yet.', 'I will build it up, stone by stone, room by room.', 'Every castle starts with a plan.'],
    E: ['Every castle starts with a plan and a pile of stones.', 'Masons shaped each block with a hammer and a chisel.', 'A big castle took twenty years to build. Mine will be faster!'],
    yesno: [['Is this my castle?', true], ['Is my castle a tree?', false]] },
  stone: { title: 'Stone by stone', pic: 'stone', gate: false,
    A: ['I put a stone.', 'I put a stone.', 'Look! A wall!'],
    B: ['One stone, two stones.', 'Up and up they go.', 'Look at my wall!'],
    C: ['I put the stones one on top of the other.', 'Up and up they go.', 'Now I have a wall!'],
    D: ['Castle walls are made of blocks of stone.', 'I put them one on top of the other, up and up.', 'Soon my wall will be tall and strong.'],
    E: ['Real castle walls were built from stone cut in a quarry.', 'The masons stuck the blocks together with mortar, like glue.', 'Some castle walls are as thick as a car is long.'],
    yesno: [['Is my wall made of stone?', true], ['Is my wall made of cheese?', false]] },
  room: { title: 'A room!', pic: 'room', gate: false,
    A: ['I see a room.', 'It is my room.'],
    B: ['Look! A room!', 'It has a wall here.', 'It has a wall here too.'],
    C: ['Walls on this side and that side.', 'A floor under and a roof on top.', 'Now I have a room!'],
    D: ['A room has walls all round, a floor and a ceiling.', 'When the last stone goes in, the room is closed in.', 'What will this room be for?'],
    E: ['A room is closed in when nothing can get out except through the door.', 'The keep of a castle had many rooms, one on top of the other.', 'Tap the room to say what it is for.'],
    yesno: [['Does a room have walls?', true], ['Is a room open to the sky?', false]] },
  name: { title: 'What is it for?', pic: 'nametag', gate: false,
    A: ['I name my room.', 'It is a big room!'],
    B: ['This room has a name.', 'What is it for?', 'I will put things in it.'],
    C: ['I gave my room a name.', 'Now I know what it is for.', 'I can put things in it!'],
    D: ['Every room in a castle had a job.', 'The great hall was for eating, the kitchen for cooking, the solar for sleeping.', 'My room has a job now too.'],
    E: ['In a real castle every room had its own job.', 'The great hall was for feasts, the kitchen for cooking, and the lord slept in the solar high in the keep.', 'Now that my room has a name, its furniture page is open.'],
    yesno: [['Does my room have a name?', true], ['Is the kitchen for sleeping?', false]] },
  moat: { title: 'The moat', pic: 'moat', gate: false,
    A: ['I dig.', 'I dig.', 'I see water!'],
    B: ['I dig and dig.', 'Water comes in.', 'It is a moat!'],
    C: ['I dig a big hole in front of the castle.', 'Water fills it up.', 'It is a moat! Swans can swim in it.'],
    D: ['A moat is a ditch full of water round a castle.', 'It kept people from getting up to the walls.', 'Fish and swans lived in it.'],
    E: ['A moat is a deep ditch around a castle, filled with water from a river or a spring.', 'Nobody could dig under the walls or push a ladder up to them.', 'Some moats had fish, ducks and swans.'],
    yesno: [['Is the moat full of water?', true], ['Is the moat full of hay?', false]] },
  bridge: { title: 'The drawbridge', pic: 'drawbridge', gate: false,
    A: ['I see a bridge.', 'It goes up.', 'It goes down.'],
    B: ['Here is my bridge.', 'It goes up at night.', 'It comes down in the day.'],
    C: ['The drawbridge goes over the moat.', 'At night it goes up on its chains.', 'In the morning it comes down again.'],
    D: ['A drawbridge is a bridge that lifts up on chains.', 'When it was up, nobody could cross the moat.', 'The gatekeeper let it down every morning.'],
    E: ['The drawbridge lifts on chains pulled by a winch inside the gatehouse.', 'With the bridge up and the portcullis down, the castle was shut for the night.', 'Mine comes down by itself when the sun comes up.'],
    yesno: [['Does the bridge go up at night?', true], ['Does the bridge fly?', false]] },
  tower: { title: 'A tall tower', pic: 'cone', gate: false,
    A: ['Up, up, up!', 'My tower is tall.'],
    B: ['Look up!', 'My tower is tall.', 'It has a red flag on top.'],
    C: ['My tower goes up and up.', 'It has a pointed roof on top.', 'From up there I can see the whole land!'],
    D: ['Towers let the guards see far across the land.', 'A pointed roof keeps the rain and snow off.', 'A flag on the top shows I am at home.'],
    E: ['Castle towers were round so that there were no corners for an enemy to knock down.', 'Inside, a spiral staircase wound up to the roof.', 'A flag flying from the highest tower meant the lord or lady was at home.'],
    yesno: [['Is my tower tall?', true], ['Is my tower under the moat?', false]] },
  knight: { title: 'The knights', pic: 'knight', gate: false,
    A: ['I see a knight.', 'He can ride.', 'He can guard.'],
    B: ['A knight is here!', 'He guards my castle.', 'He is big and brave.'],
    C: ['The knights have come.', 'They walk on top of the walls and look out.', 'They are brave and kind.'],
    D: ['A knight was a soldier on a horse who promised to be brave, loyal and kind.', 'My knights guard the battlements and train in the courtyard.'],
    E: ['A boy began as a page at seven, became a squire at fourteen and was made a knight at about twenty-one.', 'Knights promised to be brave, loyal and kind, and to protect everyone in the castle.'],
    yesno: [['Do the knights guard my castle?', true], ['Do the knights live in the moat?', false]] },
  horse: { title: 'A horse!', pic: 'horse', gate: true,
    A: ['I see a horse.', 'It can run.', 'It likes hay.'],
    B: ['A horse is here!', 'It lives in the stall.', 'It eats hay.'],
    C: ['A horse comes to my stables.', 'It lives in a stall and eats hay.', 'I can brush it!'],
    D: ['A knight\'s horse was big and strong.', 'It lived in the stables, in a stall with straw on the floor.', 'The grooms fed it and brushed it every day.'],
    E: ['A knight\'s horse was called a destrier, and it cost as much as a small farm.', 'It lived in the stables with its own groom, who fed it oats and hay and brushed it every morning.'],
    yesno: [['Does the horse eat hay?', true], ['Does the horse eat stones?', false]] },
  feast: { title: 'The feast', pic: 'feast', gate: true,
    A: ['We eat.', 'We eat and eat.', 'Yum!'],
    B: ['It is night.', 'We all sit at the big table.', 'We eat and eat!'],
    C: ['The sun goes down.', 'Everybody comes to the great hall.', 'We sit at the long table and eat a feast!'],
    D: ['At a feast the cooks bring pies, bread, fish and fruit.', 'Everybody eats together at long tables in the great hall.', 'The jester does tricks.'],
    E: ['A castle feast had roast meat, pies, fish, fruit and spiced puddings.', 'Everybody ate together in the great hall while musicians played and the jester juggled.', 'The sweetest thing was marzipan shaped like a castle.'],
    yesno: [['Do we eat at the feast?', true], ['Do we sleep at the feast?', false]] },
  joust: { title: 'The joust', pic: 'joust', gate: true,
    A: ['I see two knights.', 'Go, go, go!', 'Tap!'],
    B: ['Two knights ride.', 'Tap! They tap shields.', 'They bow.'],
    C: ['Two knights get on their horses.', 'They ride at each other and tap shields.', 'Then they bow. Nobody is hurt!'],
    D: ['At a tournament two knights rode at each other with long blunt lances.', 'They tried to tap the other knight\'s shield.', 'Points for a good tap, and a bow at the end.'],
    E: ['The joust was the biggest show of the year.', 'Two knights galloped at each other along a rail and tried to tap the other\'s shield with a blunt lance.', 'Everybody cheered, and both knights bowed.'],
    yesno: [['Do the knights tap shields?', true], ['Does anybody get hurt?', false]] },
  dragon: { title: 'A dragon!', pic: 'dragon', gate: true,
    A: ['I see a dragon!', 'It is big.', 'It likes me.'],
    B: ['A dragon is here!', 'It sits on my tower.', 'It is a kind dragon.'],
    C: ['A big green dragon lands on my tower.', 'It is friendly.', 'It puffs sparkles, not fire!'],
    D: ['My tower was so tall that a dragon came to sit on it.', 'Dragons live in stories, and this one is friendly.', 'Tap it and it puffs sparkles.'],
    E: ['Dragons live in stories, where they guard treasure and make friends with brave princesses and princes.', 'This dragon liked my tall tower so much that it landed on top.', 'It only breathes sparkles.'],
    yesno: [['Is the dragon friendly?', true], ['Does the dragon breathe fire?', false]] },
  night: { title: 'Night falls', pic: 'night', gate: false,
    A: ['It is dark.', 'I see the moon.', 'I see a light.'],
    B: ['It is night.', 'The torches glow.', 'The bridge goes up.'],
    C: ['The sun goes down.', 'The torches light up in the rooms.', 'The drawbridge goes up until morning.'],
    D: ['There was no electricity in a castle.', 'At night it was lit by candles and torches on the walls.', 'Most people went to bed when it got dark.'],
    E: ['A castle at night was lit by candles, oil lamps and torches in iron holders.', 'The drawbridge went up, the gate came down, and the guards walked the walls under the stars.'],
    yesno: [['Do the torches glow at night?', true], ['Is the sun up at night?', false]] },
  snow: { title: 'Snow', pic: 'snow', gate: false,
    A: ['I see snow.', 'It is cold.', 'It is white.'],
    B: ['Snow falls.', 'It is on the wall.', 'It is cold!'],
    C: ['It is winter.', 'Snow falls on the castle.', 'Fires burn in every room.'],
    D: ['Castles were cold in winter.', 'Snow lay on the battlements, and fires burned in every fireplace.', 'People wore furs indoors.'],
    E: ['In winter the stone walls were cold, so fires burned in every hearth and the floors were covered with rugs and rushes.', 'Snow lay on the battlements for months.'],
    yesno: [['Is snow cold?', true], ['Is snow hot?', false]] },
  rain: { title: 'Rain', pic: 'rain', gate: false,
    A: ['It is wet.', 'Run in!'],
    B: ['Rain, rain!', 'Run inside!', 'It is wet out.'],
    C: ['Rain falls on the castle.', 'The moat fills up.', 'Everybody runs inside.'],
    D: ['Rain runs off the pointed roofs and drips from the battlements.', 'Everyone runs indoors to the fires.'],
    E: ['Rain ran off the steep roofs into stone gutters and spouts shaped like animals.', 'Inside, the fires were stoked and the shutters were closed.'],
    yesno: [['Do people run inside?', true], ['Is the rain dry?', false]] },
  visitor: { title: 'A royal visit', pic: 'carriage', gate: false,
    A: ['I see a carriage.', 'It comes to me.'],
    B: ['A carriage comes!', 'It comes over the bridge.', 'Who is in it?'],
    C: ['A carriage comes over the drawbridge.', 'A royal visitor steps out.', 'Welcome to my castle!'],
    D: ['A carriage with white horses comes over the drawbridge.', 'A royal visitor has come to see the castle.', 'The visitor will want to see the throne room!'],
    E: ['Royal visitors arrived in a carriage with their own horses and servants.', 'They were shown the great hall and the throne room, and a feast was held for them.'],
    yesno: [['Does the carriage come over the bridge?', true], ['Does the carriage swim?', false]] },
  market: { title: 'Market day', pic: 'market', gate: false,
    A: ['I see a stall.', 'I see bread.'],
    B: ['It is market day!', 'Here are the traders.', 'They have bread and cheese.'],
    C: ['It is market day.', 'Traders come into the castle with trays.', 'Bread, cheese, ribbons and toys!'],
    D: ['On market day traders set up stalls in the courtyard.', 'They sold bread, cheese, cloth, pots, ribbons and toys.'],
    E: ['On market day traders set up stalls in the courtyard and the village square.', 'Jugglers and musicians came too, and everybody came to buy and sell.'],
    yesno: [['Do the traders have bread?', true], ['Do the traders sell dragons?', false]] },
  fireworks: { title: 'Fireworks', pic: 'fireworks', gate: false,
    A: ['I see a light.', 'Pop! Pop!'],
    B: ['Look up!', 'Pop! Red and gold.', 'Fireworks!'],
    C: ['It is night.', 'Pop! Fireworks go up over the castle.', 'Red, gold and blue!'],
    D: ['Fireworks were invented in China more than a thousand years ago.', 'They came to castles for royal weddings and victories.'],
    E: ['Fireworks were called fire flowers when they were invented in China.', 'Castles set them off for royal weddings and victories, and now for finishing a quest.'],
    yesno: [['Are fireworks at night?', true], ['Are fireworks quiet?', false]] },
  swan: { title: 'Swans', pic: 'swan', gate: false,
    A: ['I see a swan.', 'It can swim.'],
    B: ['Swans swim on my moat.', 'They are white.', 'They are big.'],
    C: ['Two swans swim on the moat.', 'They are white and big.', 'Fish swim under them.'],
    D: ['Swans and ducks liked castle moats.', 'In some lands all the swans belonged to the king and queen.'],
    E: ['Swans and ducks made their homes on castle moats.', 'In some countries every swan belonged to the king and queen, so nobody else was allowed to keep them.'],
    yesno: [['Do swans swim?', true], ['Do swans live in the kitchen?', false]] },
  garden: { title: 'The garden', pic: 'rosebush', gate: false,
    A: ['I see roses.', 'I see a tree.'],
    B: ['My garden has roses.', 'It has a tree.', 'Bees come to it.'],
    C: ['I made a garden by the castle.', 'Roses and an apple tree grow in it.', 'Bees buzz round the flowers.'],
    D: ['Castle gardens had roses, herbs for the kitchen and apple trees.', 'A fountain or a pond sat in the middle.'],
    E: ['A castle garden was walled to keep the wind off, with herbs for the kitchen, roses, apple trees and a fountain in the middle.', 'Bees were kept for honey.'],
    yesno: [['Do roses grow in my garden?', true], ['Do stones grow in my garden?', false]] }
};
/* when each non-gate page opens (Bus event → page), once per castle; see Reading.init */
const STORY_TRIGGERS = { castleStarted: 'start', firstStone: 'stone', roomMade: 'room', roomNamed: 'name', firstWater: 'moat', firstDrawbridge: 'bridge', tower6: 'tower', knightCame: 'knight', nightFall: 'night', snowfall: 'snow', rain: 'rain', visitor: 'visitor', market: 'market', fireworks: 'fireworks', swan: 'swan', firstGarden: 'garden' };

/* ---------- read-and-build missions ----------
   key: what the mission checks (Reading.checkMission); from: the lowest level it is offered at */
const MISSIONS = [
  { key: 'stones', A: 'Put 5 stones.', B: 'Put down five stones.', C: 'Put down five stones.', D: 'Lay five stones on the castle.', E: 'Lay five more stones on the castle walls.' },
  { key: 'door', A: 'Make a door.', B: 'Put in a door.', C: 'Put a door in a wall.', D: 'Put a door in one of the walls.', E: 'Put a door in a wall so people can come in.' },
  { key: 'window', A: 'Make a window.', B: 'Put in a window.', C: 'Put a window in a wall.', D: 'Put a window in a wall to let the light in.', E: 'Put a window in a wall to let the light in.' },
  { key: 'tower', A: 'Build up, up!', B: 'Build a tower up high.', C: 'Make a tower two blocks taller.', D: 'Make your tallest tower two blocks taller.', E: 'Make your tallest tower two blocks taller.' },
  { key: 'moat', A: 'Dig the moat.', B: 'Dig the moat. Dig, dig!', C: 'Dig three bits of moat.', D: 'Dig three more cells of moat.', E: 'Dig three more cells of moat for the swans.' },
  { key: 'item', A: 'Put a thing in.', B: 'Put a thing in a room.', C: 'Put something in a room.', D: 'Put a new thing in one of the rooms.', E: 'Put a new piece of furniture in one of the rooms.' },
  { key: 'bed', from: 'B', A: 'Put a bed in.', B: 'Put a bed in a room.', C: 'Put a bed in a room.', D: 'Put a bed in the bedchamber.', E: 'Put a bed in a bedchamber for the night.' },
  { key: 'table', from: 'B', A: 'Put a table in.', B: 'Put a table in a room.', C: 'Put a table in a room.', D: 'Put a table in one of the rooms.', E: 'Put a table in one of the rooms.' },
  { key: 'flag', from: 'B', A: 'Put up a flag.', B: 'Put a flag on top.', C: 'Put a flag on top of a wall.', D: 'Fly a flag from a wall or a tower.', E: 'Fly a flag from the top of a wall or a tower.' },
  { key: 'brush', from: 'B', A: 'Tap a horse.', B: 'Tap a horse. Brush it!', C: 'Tap a horse to brush it.', D: 'Tap a horse to brush and feed it.', E: 'Tap one of the horses to brush it and make it happy.' },
  { key: 'name', A: 'Name a room.', B: 'Tap a room. Name it.', C: 'Tap a room and give it a name.', D: 'Tap a room and say what it is for.', E: 'Tap a room with the name tool and say what it is for.' },
  { key: 'garden', from: 'B', A: 'Put a tree out.', B: 'Put a tree or roses out.', C: 'Put a tree or roses in the garden.', D: 'Put something in the garden outside the walls.', E: 'Put a tree, roses or a bench in the garden.' },
  { key: 'photo', from: 'C', A: 'Tap the camera.', B: 'Tap the camera!', C: 'Tap the camera to take a picture.', D: 'Take a picture of your castle with the camera.', E: 'Take a picture of your castle with the camera button.' },
  { key: 'stairs', from: 'C', A: 'Put stairs in.', B: 'Put in some stairs.', C: 'Put stairs in to go up.', D: 'Put stairs in so people can climb up.', E: 'Put stairs through a floor so people can climb to the room above.' }
];

/* ---------- leveled hints for Read to Play (shown, not read aloud until help) ---------- */
const READ_HINTS = {
  welcome: { A: 'Tap a stone. Build!', B: 'Tap a stone. Tap the grass. Build!', C: 'Pick a stone and tap the ground to build.', D: 'Pick a stone in the Build bar and tap the ground.', E: 'Pick a stone in the Build bar and tap the ground to start building.' },
  stone: { A: 'Put a stone.', B: 'Tap to put a stone.', C: 'Tap or drag to put stones.', D: 'Tap or drag to lay stones in a wall.', E: 'Tap or drag to lay stones. Build walls up and a floor across.' },
  room: { A: 'A room! Tap it.', B: 'A room! Tap it to name it.', C: 'A room! Tap it with the name tool.', D: 'A room! Tap it with the name tool to say what it is for.', E: 'A room! Tap it with the name tool to say what it is for.' },
  nameRoom: { A: 'Tap a room.', B: 'Tap a room. What is it?', C: 'Tap a room and pick what it is for.', D: 'Tap a room and choose what it is for.', E: 'Tap a room and choose what it is for: a throne room, a kitchen, stables.' },
  furnish: { A: 'Put a thing in.', B: 'Put a thing in the room.', C: 'Open Furnish and tap things into the room.', D: 'Open Furnish and tap things into your room.', E: 'Open Furnish and tap things into your room. Each room has its own page.' },
  moat: { A: 'Dig! Dig!', B: 'Dig the moat.', C: 'Pick the spade and dig the moat.', D: 'Pick the spade and tap the ground to dig the moat.', E: 'Pick the moat spade and tap the ground in front of the castle.' },
  bridge: { A: 'Put a bridge.', B: 'Put a bridge on the moat.', C: 'Put a drawbridge over the moat.', D: 'Put a drawbridge over the moat by the gate.', E: 'Put a drawbridge over the moat so visitors can come in.' },
  stable: { A: 'Make a stall.', B: 'Make stables. Put a stall.', C: 'Name a room stables and put a stall in.', D: 'Name a room on the ground floor stables, then add a stall.', E: 'Name a ground floor room stables, then add stalls. A horse comes to each one.' },
  horse: { A: 'A horse! Tap it.', B: 'A horse! Tap it to brush it.', C: 'A horse! Tap it to brush it.', D: 'A horse! Tap it to brush and feed it.', E: 'A horse! Tap it to brush and feed it. Knights ride the horses when they joust.' },
  knight: { A: 'I see knights!', B: 'The knights are here!', C: 'The knights have come to guard the castle.', D: 'Knights have come to guard the walls and train.', E: 'Knights have come to guard the battlements and train at the quintain.' },
  feast: { A: 'We eat!', B: 'A feast in the hall!', C: 'Night! A feast in the great hall.', D: 'Evening! Everyone comes to the great hall to feast.', E: 'Evening! Everyone comes to the great hall to feast.' },
  joust: { A: 'Tap! Tap!', B: 'The knights joust!', C: 'The knights joust! Tap, tap, bow.', D: 'Tournament day! The knights joust and tap shields.', E: 'Tournament day! Two knights joust in the courtyard. Nobody is hurt.' },
  night: { A: 'It is night.', B: 'Night! The torches glow.', C: 'Night falls. The torches glow.', D: 'Night falls. The torches light and the bridge goes up.', E: 'Night falls. The torches light up and the drawbridge rises until morning.' },
  quest: { A: 'A quest! Tap it.', B: 'A new quest! Tap it.', C: 'A new quest! Tap the scroll to read it.', D: 'A new royal quest! Tap the scroll to read it.', E: 'A new royal quest! Tap the scroll to read it. Quests give coins.' },
  questDone: { A: 'Yes! Coins!', B: 'Quest done! Coins!', C: 'Quest done! Coins for you.', D: 'Quest done! Coins for the treasury.', E: 'Quest done! Coins for the treasury and a new page in the catalogue.' },
  coins: { A: 'Coins!', B: 'Coins from the village!', C: 'The village sent coins.', D: 'The village sent coins this morning.', E: 'The village sent coins this morning.' },
  poor: { A: 'No coins yet.', B: 'Not enough coins yet.', C: 'Not enough coins. Do a quest!', D: 'Not enough coins. Finish a quest or wait for more.', E: 'Not enough coins. Finish a quest, or wait for the village to send more.' },
  locked: { A: 'Do a quest.', B: 'Do a quest to open this.', C: 'Do a quest to open this page.', D: 'That page opens with a quest. Keep building!', E: 'That page opens with a quest. Keep building!' },
  noRoom: { A: 'Make a room.', B: 'Make a room first.', C: 'Make a room first. Walls all round!', D: 'Furniture goes in a closed room. Build walls round and a floor over.', E: 'Furniture goes inside a closed room. Build walls round and a floor over, then try again.' },
  noFloor: { A: 'Put it on the floor.', B: 'Put it on a floor.', C: 'It needs a floor under it.', D: 'It needs a floor under it.', E: 'It needs a floor under it.' },
  noFit: { A: 'No. Try here.', B: 'It does not fit here.', C: 'It does not fit here. Try a free spot.', D: 'It does not fit there. Try a bigger room or a free spot.', E: 'It does not fit there. Try a bigger room, or a free spot.' },
  outside: { A: 'Put it out.', B: 'Put it outside.', C: 'Put it outside on the grass.', D: 'Garden things go outside on the grass.', E: 'Garden things go outside on the grass or in the courtyard.' },
  wrongRoom: { A: 'Not this room.', B: 'That goes in another room.', C: 'That goes in a different room.', D: 'That belongs in a different room. Check the room\'s name.', E: 'That belongs in a different room. Check the room\'s name.' },
  undo: { A: 'Tap the arrow.', B: 'Tap the arrow to undo.', C: 'Tap the arrows to undo and redo.', D: 'Changed your mind? The arrows at the bottom undo and redo.', E: 'Changed your mind? Undo and redo are the arrows at the bottom.' },
  dragon: { A: 'A dragon! It is kind.', B: 'A dragon! It is friendly!', C: 'A dragon! It is friendly. Tap it!', D: 'A friendly dragon has come to sit on your tall tower.', E: 'Your tower is so tall that a friendly dragon has come to sit on it.' },
  snow: { A: 'Snow!', B: 'Snow on the castle!', C: 'Snow lies on the castle walls.', D: 'Winter. Snow lies on the battlements.', E: 'Winter. Snow lies on the battlements and the moat gets icy edges.' },
  rain: { A: 'Rain! Run in!', B: 'Rain! Run inside!', C: 'Rain! Everybody runs inside.', D: 'Rain! The moat ripples and everyone runs indoors.', E: 'Rain! The moat ripples and everyone runs indoors.' },
  visitor: { A: 'A carriage!', B: 'A carriage is coming!', C: 'A carriage is coming over the bridge!', D: 'A royal carriage is coming over the drawbridge!', E: 'A royal carriage is coming over the drawbridge!' },
  market: { A: 'Market day!', B: 'Market day!', C: 'Market day! Traders are here.', D: 'Market day! Traders fill the courtyard.', E: 'Market day! Traders fill the courtyard with their trays.' },
  fireworks: { A: 'Fireworks!', B: 'Fireworks!', C: 'Fireworks over the castle!', D: 'Fireworks over the castle!', E: 'Fireworks over the castle!' },
  photo: { A: 'Snap!', B: 'Snap! A picture.', C: 'Snap! Your castle picture is saved.', D: 'Snap! Your castle portrait is in the chronicle.', E: 'Snap! Your castle portrait is in the chronicle.' },
  stairs: { A: 'Put stairs in.', B: 'Put stairs in to go up.', C: 'Put stairs in so they can go up.', D: 'Put stairs through a floor so people can climb up.', E: 'Put stairs through a floor so people can climb to the room above.' },
  unreachable: { A: 'Make a door!', B: 'Nobody can get in. Make a door!', C: 'Nobody can get in. Add a door or stairs.', D: 'Nobody can get into that room. Add a door or stairs.', E: 'Nobody can get into that room. Add a door or stairs.' },
  tower: { A: 'Build up high!', B: 'Build a tall tower!', C: 'Build a tower high with a spire on top.', D: 'Build a tower high, with a pointed roof and a flag.', E: 'Build a tower high, with a pointed roof and a flag on top.' },
  battlements: { A: 'Put teeth on top.', B: 'Put teeth on the wall top.', C: 'Put battlements on top of the wall.', D: 'Put battlements along the top of the wall for the knights.', E: 'Put battlements along the top of the wall for the knights to walk behind.' },
  pan: { A: 'Drag to look.', B: 'Drag to look round.', C: 'Drag to look round. Pinch to zoom.', D: 'Drag with the hand to look around. Pinch or scroll to zoom.', E: 'Drag with the hand to look around. Pinch or scroll to zoom.' },
  saved: { A: 'Saved!', B: 'Saved!', C: 'Saved!', D: 'Saved!', E: 'Saved!' },
  gate: { A: 'Put a gate in.', B: 'Put a gate in!', C: 'A gatehouse needs a gate.', D: 'A gatehouse needs a gate: the portcullis slides up and down.', E: 'A gatehouse needs a gate: the portcullis slides up and down.' },
  brushed: { A: 'The horse likes it!', B: 'The horse is happy!', C: 'The horse loves it!', D: 'The horse loves it! Happy horses ride faster.', E: 'The horse loves it! Happy horses carry the knights faster.' },
  owl: { A: 'An owl!', B: 'An owl on the tower!', C: 'An owl is on the tower.', D: 'An owl is hooting on the tower.', E: 'An owl is hooting on the tower.' },
  rooms: { A: 'Make more rooms.', B: 'Try a kitchen!', C: 'Try a kitchen or a library!', D: 'Each room type has its own furniture page. Try a kitchen or a library.', E: 'Each room type has its own furniture page. Try a kitchen, a library or a music room.' }
};
