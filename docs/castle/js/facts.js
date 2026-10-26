/* ============================================================
   facts.js — who you are, the castle's calendar, the real facts,
              and every hint the game can say
   ============================================================ */
'use strict';

/* the royal: a prince or a princess, each in a few looks (hair · skin · robe · trim) */
const ROYALS = {
  princess: {
    name: 'Princess', short: 'Princess', emoji: '👸',
    blurb: 'The princess rules the castle: she draws the plans, chooses every room and rides with the knights.',
    simple: 'I am the princess. This is my castle!',
    looks: [
      { key: 'rose', name: 'Rose', hair: '#5a2a12', skin: '#f2c9a8', robe: '#d8486a', trim: '#ffd77a' },
      { key: 'sky', name: 'Sky', hair: '#2a1a12', skin: '#8a5a3a', robe: '#4a7ad8', trim: '#ffe9a0' },
      { key: 'sun', name: 'Sun', hair: '#e8c060', skin: '#f6d8c0', robe: '#8a3ad0', trim: '#ffd27a' },
      { key: 'leaf', name: 'Leaf', hair: '#c0402a', skin: '#e8b890', robe: '#2a9a6a', trim: '#fff0b0' }
    ]
  },
  prince: {
    name: 'Prince', short: 'Prince', emoji: '🤴',
    blurb: 'The prince rules the castle: he draws the plans, chooses every room and rides with the knights.',
    simple: 'I am the prince. This is my castle!',
    looks: [
      { key: 'oak', name: 'Oak', hair: '#4a2a12', skin: '#f2c9a8', robe: '#2a5ad0', trim: '#ffd77a' },
      { key: 'ember', name: 'Ember', hair: '#1a1210', skin: '#7a4a2a', robe: '#c03a3a', trim: '#ffe9a0' },
      { key: 'gold', name: 'Gold', hair: '#e8c060', skin: '#f6d8c0', robe: '#2a8a5a', trim: '#ffd27a' },
      { key: 'storm', name: 'Storm', hair: '#c0402a', skin: '#e8b890', robe: '#5a3aa0', trim: '#fff0b0' }
    ]
  }
};
const ROYAL_KEYS = Object.keys(ROYALS);
function royalLook(sex, key) { const r = ROYALS[sex] || ROYALS.princess; return r.looks.find(l => l.key === key) || r.looks[0]; }

/* castle names: a child picks a first part and a second part, or types one */
const NAME_PARTS = {
  first: ['Sun', 'Moon', 'Star', 'Rose', 'Dragon', 'Swan', 'Oak', 'Snow', 'Golden', 'Silver', 'Thunder', 'Rainbow', 'Apple', 'Honey', 'Cloud', 'River'],
  second: ['stone Castle', 'bridge Castle', 'crest Keep', 'brook Castle', 'fell Castle', 'hollow Castle', 'tower', 'wood Castle', 'haven', 'rock Castle', 'gate Castle', 'hill Castle']
};

/* who is playing: coins, how fast they come, how patient the quests are */
const DIFFICULTY = {
  easy:   { name: 'Little builder', coins: 400, daily: 80, questK: 1.6, unlockAll: true,  visitors: true },
  normal: { name: 'Big builder',    coins: 250, daily: 50, questK: 1.0, unlockAll: false, visitors: true },
  hard:   { name: 'Master builder', coins: 150, daily: 30, questK: 0.7, unlockAll: false, visitors: true }
};

/* the calendar: a day is DAY_LENGTH seconds; three days a season */
const DAYS_PER_SEASON = 3;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_INFO = { spring: ['🌱 Spring', 8], summer: ['☀️ Summer', 14], autumn: ['🍂 Autumn', 11], winter: ['❄️ Winter', 4] };
function seasonOfDay(day) { return SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % 4]; }
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }

/* ---------- real castle facts (body: full · simple: little words) ---------- */
const FACTS = {
  stone:      { title: 'Castles are made of stone', body: 'Real castles were built from blocks of stone cut in a quarry. Masons shaped each block with hammers and chisels, and stuck them together with lime mortar. A big castle took ten years or more to build.', simple: 'Castles are made of stone blocks. It took many years to build one!' },
  keep:       { title: 'The keep', body: 'The strong tower in the middle of a castle is the keep. The lord\'s family lived at the top, where it was safest and the view was best. The stores were kept at the bottom.', simple: 'The big tower in the middle is the keep. The family lives at the top.' },
  moat:       { title: 'The moat', body: 'A moat is a ditch full of water around a castle. It stopped anyone from digging under the walls or pushing a ladder up to them. Some moats had fish and ducks, and some were only dry ditches.', simple: 'A moat is a ring of water around the castle. Fish and ducks live in it!' },
  drawbridge: { title: 'The drawbridge', body: 'The drawbridge is a bridge that lifts up on chains. When it was up, nobody could cross the moat. The gatekeeper let it down in the morning and pulled it up at night.', simple: 'The drawbridge lifts up on chains at night. In the morning it comes down.' },
  portcullis: { title: 'The portcullis', body: 'The gate with the big grid is the portcullis. It slid up and down in grooves in the stone, pulled by a winch. "Portcullis" means "sliding door" in old French.', simple: 'The gate with the grid slides up and down. It is the portcullis.' },
  battlement: { title: 'Battlements', body: 'The tooth-shaped top of a castle wall is the battlements. The high parts are merlons and the gaps are crenels. Guards walked along the wall behind them and looked out over the land.', simple: 'The tooth shapes on top of the wall are battlements. Guards walk behind them.' },
  slit:       { title: 'Arrow slits', body: 'The tall thin windows are arrow slits. They are narrow on the outside so the wall stays strong, and wider inside so a guard could see out and get lots of light.', simple: 'The thin windows are arrow slits. They are narrow outside and wide inside.' },
  stained:    { title: 'Stained glass', body: 'Coloured glass windows were made from small pieces of glass joined with strips of lead. The sun shining through them painted the floor with colours. They were very expensive, so only the richest castles had them.', simple: 'Coloured glass windows paint the floor with colours when the sun shines.' },
  hall:       { title: 'The great hall', body: 'The great hall was the biggest room in the castle. Everybody ate there together at long tables, with the lord\'s family on a raised platform at one end. There were feasts, music and dancing.', simple: 'Everybody ate together in the great hall. There were feasts and music!' },
  tapestry:   { title: 'Tapestries', body: 'Stone walls are cold. Big woven pictures called tapestries were hung on the walls to keep the rooms warm and to show stories of knights, hunts and gardens.', simple: 'Tapestries are big woven pictures. They keep the cold walls warm.' },
  kitchen:    { title: 'The kitchen', body: 'Castle kitchens had huge fireplaces where whole animals could roast on a spit. The kitchen was often a separate building, so that if it caught fire the castle would not burn.', simple: 'The kitchen had a huge fire. It was kept away from the castle in case of fire.' },
  bakery:     { title: 'The bakehouse', body: 'Bread was baked every day in a stone oven. A fire was lit inside the oven, then raked out, and the loaves were slid in on a long wooden paddle called a peel.', simple: 'Bread was baked every day in a stone oven, slid in on a long paddle.' },
  well:       { title: 'The well', body: 'Every castle needed its own well inside the walls, so there was always water to drink and to put out fires. Some castle wells were dug more than 100 metres deep.', simple: 'Every castle has a well for water. Some wells were very, very deep.' },
  stairs:     { title: 'Spiral stairs', body: 'Castle towers had narrow spiral staircases that wound round and round. They took up very little room and let people climb from the cellar to the roof.', simple: 'Towers had stairs that go round and round, all the way to the roof.' },
  garderobe:  { title: 'The castle toilet', body: 'A castle toilet was called a garderobe: a tiny room that stuck out from the wall with a hole in the seat. Everything fell straight down into the moat. Clothes were hung in there too, because the smell kept moths away!', simple: 'The castle toilet was a little room that stuck out of the wall!' },
  chamber:    { title: 'The bedchamber', body: 'The lord\'s family slept in the solar, a warm room high in the keep. Beds had curtains all round to keep out the cold, and a fire burned all night in winter.', simple: 'The family slept in a warm room high up. The beds had curtains to keep warm.' },
  library:    { title: 'Books by hand', body: 'Before printing, every book was written by hand and painted with tiny pictures. One book could take a year to make, so a castle with many books was very rich.', simple: 'Every book was written by hand. One book could take a whole year!' },
  knight:     { title: 'Knights', body: 'A knight was a soldier on horseback who promised to be brave, loyal and kind. A boy started as a page at seven, became a squire at fourteen, and was made a knight at about twenty-one.', simple: 'A knight rides a horse and promises to be brave and kind.' },
  armour:     { title: 'A suit of armour', body: 'A full suit of plate armour weighed about 25 kilograms, like carrying a big dog. A knight could still run, jump and climb onto a horse in it, because the weight was spread all over.', simple: 'Armour is heavy, but a knight could still run and jump in it!' },
  quintain:   { title: 'The quintain', body: 'Knights practised with a quintain: a post with a shield on one arm and a sandbag on the other. Hit the shield in the middle and ride on; hit it wrong and the sandbag swung round and bopped you.', simple: 'Knights practise on a post with a shield. Hit it right or the bag bops you!' },
  joust:      { title: 'Jousting', body: 'At a tournament two knights on horses rode at each other and tried to tap the other\'s shield with a long blunt lance. Points were given for a good hit. It was the biggest show of the year.', simple: 'In a joust two knights ride at each other and tap shields. It is a big show!' },
  horse:      { title: 'The knight\'s horse', body: 'A knight\'s big strong horse was called a destrier. It was trained from a foal, ate oats and hay, and had its own groom. A good horse cost as much as a small farm.', simple: 'A knight\'s horse is big and strong. It eats hay and oats.' },
  stables:    { title: 'The stables', body: 'Horses lived in the stables, in stalls with straw on the floor. Grooms fed them, brushed them, cleaned their hooves and mucked out the straw every day.', simple: 'Horses live in the stables. Grooms feed them and brush them every day.' },
  banner:     { title: 'Banners and coats of arms', body: 'Every noble family had its own picture, called a coat of arms, painted on shields and sewn on banners. Knights in armour all look the same, so the picture showed who was who.', simple: 'Every family had its own picture on flags and shields.' },
  falcon:     { title: 'Falconry', body: 'Lords and ladies kept trained hawks and falcons. The falconer looked after them in a building called the mews, and the birds flew from a gloved hand.', simple: 'Hawks were trained to fly from a glove. The falconer looked after them.' },
  jester:     { title: 'The jester', body: 'A jester told jokes, sang, juggled and did tricks to make the castle laugh. He wore bright patched clothes and a hat with bells.', simple: 'The jester tells jokes and does tricks. His hat has bells on it!' },
  smith:      { title: 'The blacksmith', body: 'The smith heated iron in a forge until it glowed orange, then hammered it on an anvil into horseshoes, hinges, nails and tools. The bellows blew air to make the fire hotter.', simple: 'The smith makes the iron hot and hammers it into shoes for horses.' },
  torch:      { title: 'Light in the dark', body: 'There was no electricity. At night the castle was lit by candles, oil lamps and torches in iron holders on the walls. Most people went to bed when it got dark.', simple: 'At night the castle was lit by candles and torches on the walls.' },
  winter:     { title: 'A castle in winter', body: 'Castles were cold in winter. Fires burned in every fireplace, floors were covered with rushes and rugs, and people wore furs indoors. Snow lay on the battlements for months.', simple: 'Castles are cold in winter. Fires burn and people wear furs inside.' },
  dragon:     { title: 'Dragons', body: 'Dragons live in stories, not in real castles. In old tales a dragon guards a treasure, and a brave knight or a clever princess makes friends with it. This one is friendly and only breathes sparkles.', simple: 'Dragons are in stories. This one is friendly and breathes sparkles!' },
  hill:       { title: 'Castles on hills', body: 'Castles were built on hills, by rivers or on rocks so that they could be seen from far away and so that it was hard to climb up to them.', simple: 'Castles were built on hills so you can see them from far away.' },
  village:    { title: 'The village', body: 'A village grew up outside the castle gates. Farmers brought food to the castle and paid rent in coins or in sacks of grain, and on market day everyone came to sell and buy.', simple: 'A village is outside the gate. The farmers bring food and coins.' },
  feast:      { title: 'A feast', body: 'At a feast the cooks served roast meat, pies, fish, fruit and spiced puddings. Musicians played, the jester did tricks, and the sweetest thing of all was marzipan shaped like castles.', simple: 'At a feast there are pies, music and tricks. Yum!' },
  swan:       { title: 'Swans on the moat', body: 'Swans and ducks liked castle moats. In some countries all the swans belonged to the king and queen, so nobody else was allowed to keep them.', simple: 'Swans live on the moat. In some places all swans belonged to the king and queen.' },
  cat:        { title: 'Castle cats', body: 'Cats were important in castles: they kept the mice and rats out of the stores. Dogs guarded the gates and went hunting with the lord.', simple: 'Castle cats chase the mice away from the food stores.' },
  pigeon:     { title: 'Pigeons', body: 'Castles kept pigeons in a dovecote. Pigeons were eaten in winter, and homing pigeons carried messages home from far away.', simple: 'Pigeons lived on the castle roofs. Some carried messages!' },
  market:     { title: 'Market day', body: 'On market day traders set up stalls in the courtyard or the village square: bread, cheese, cloth, pots, ribbons and toys. Jugglers and musicians came too.', simple: 'On market day there are stalls with bread, cheese and toys.' },
  fireworks:  { title: 'Fireworks', body: 'Fireworks were invented in China more than a thousand years ago and came to castles in Europe for royal weddings and victories. They were called "fire flowers".', simple: 'Fireworks are very old. They were called fire flowers!' },
  flag:       { title: 'The flag on the tower', body: 'A flag flying from the highest tower showed that the lord or lady was at home. When they went away, the flag came down.', simple: 'A flag on the tower means the prince or princess is at home.' }
};

/* ---------- hints: [full, little words] or a single string ---------- */
const HINTS = {
  welcome:   ['Welcome to your castle! Pick a brick in the Build bar and tap the ground to start building.', 'Pick a brick. Tap the ground. Build!'],
  stone:     ['Tap or drag to lay stone. Build walls up, then a floor across to make a room.', 'Tap to put stone. Drag to make a wall!'],
  room:      ['A room! It is closed in on every side. Tap the room with the 🏷️ Name tool to say what it is for.', 'A room! Tap it with 🏷️ to name it.'],
  nameRoom:  ['Tap a room to choose what it is: throne room, kitchen, bedchamber, stables…', 'Tap a room. What is it for?'],
  furnish:   ['Open Furnish and tap things into your room. Chairs, beds, tables: each room has its own.', 'Open Furnish. Tap a thing into the room!'],
  moat:      ['Pick the Moat spade and tap the ground in front of the castle. Water will fill the ditch.', 'Pick the spade. Dig the moat!'],
  bridge:    ['Put a drawbridge over the moat by the gate, so visitors can come in.', 'Put a drawbridge over the moat!'],
  stable:    ['Name a ground-floor room "Stables", then add stalls. A horse comes to every stall!', 'Name a room Stables. Add a stall. A horse comes!'],
  horse:     ['A horse! Tap it to brush and feed it. Knights ride the horses when they joust.', 'A horse! Tap it to brush it.'],
  knight:    ['Knights have come to guard your castle. They patrol the battlements and train at the quintain.', 'Knights are here! They guard the castle.'],
  feast:     ['Evening! Everyone comes to the great hall to feast.', 'A feast in the hall!'],
  joust:     ['Tournament day! Two knights joust in the courtyard. Nobody gets hurt: they tap shields and bow.', 'The knights joust! Tap, tap, bow.'],
  night:     ['Night falls. The torches light up and the drawbridge rises until morning.', 'Night! The torches glow.'],
  quest:     ['A new royal quest! Tap 📜 to read it. Quests give coins and open new pages.', 'A new quest! Tap 📜.'],
  questDone: ['Quest done! Coins for the treasury, and a new page in the catalogue.', 'Quest done! Coins!'],
  coins:     ['The village sent coins this morning.', 'Coins from the village!'],
  poor:      ['Not enough coins. Finish a quest, or wait for the village to send more.', 'Not enough coins yet. Do a quest!'],
  locked:    ['That page opens with a quest. Keep building!', 'Do a quest to open this.'],
  noRoom:    ['Furniture goes inside a closed room. Build walls round and a floor over, then try again.', 'Make a room first. Walls all round!'],
  noFloor:   ['It needs a floor under it.', 'Put it on a floor.'],
  noFit:     ['It does not fit there. Try a bigger room, or a free spot.', 'It does not fit here.'],
  outside:   ['Garden things go outside on the grass or in the courtyard.', 'Put it outside on the grass.'],
  wrongRoom: ['That belongs in a different room. Check the room\'s name.', 'That goes in another room.'],
  undo:      ['Changed your mind? Undo and redo are the arrows at the bottom.', 'Press the arrows to undo.'],
  dragon:    ['A dragon! Your tower is so tall that a friendly dragon has come to sit on it.', 'A dragon! It is friendly!'],
  snow:      ['Winter. Snow lies on the battlements and the moat gets icy edges.', 'Snow on the castle!'],
  rain:      ['Rain! The moat ripples and everyone runs indoors.', 'Rain! Run inside!'],
  visitor:   ['A royal carriage is coming over the drawbridge!', 'A carriage is coming!'],
  market:    ['Market day! Stalls fill the courtyard.', 'Market day!'],
  fireworks: ['Fireworks over the castle!', 'Fireworks!'],
  photo:     ['📷 Snap! Your castle portrait is in the chronicle.', '📷 Snap!'],
  stairs:    ['Put stairs through a floor so people can climb to the room above.', 'Put stairs in so they can go up.'],
  unreachable: ['Nobody can get into that room. Add a door or stairs.', 'Nobody can get in. Add a door or stairs!'],
  tower:     ['Build a tower high, with a pointed roof and a flag on top.', 'Build a tall tower!'],
  battlements: ['Put battlements along the top of the wall for the knights to walk behind.', 'Put teeth on top of the wall!'],
  pan:       ['Drag with the ✋ hand to look around. Pinch or scroll to zoom.', 'Drag to look. Pinch to zoom.'],
  saved:     ['Saved!', 'Saved!'],
  gate:      ['A gatehouse needs a gate: the portcullis slides up and down.', 'Put a gate in!'],
  brushed:   ['The horse loves it! Happy horses carry the knights faster.', 'The horse is happy!'],
  owl:       ['An owl is hooting on the tower.', 'An owl!'],
  rooms:     ['Each room type has its own furniture page. Try a kitchen, a library or a music room.', 'Try a kitchen or a library!']
};
