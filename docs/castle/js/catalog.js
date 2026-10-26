/* ============================================================
   catalog.js — rooms, furniture, build tools, quests, blueprints
   ============================================================
   Everything a child can put in the castle is described here as
   data; sprites.js draws it, builder.js places it, world.js lets
   the people use it.

   An item: key · name · word (the Read to Play word, one noun)
     rooms: which room types it belongs in ('any' = any named or
            unnamed room, 'outdoor' = on the grass or in the
            courtyard, 'top' = on top of a wall, roof or tower)
     w, h:  footprint in cells; mount: floor | wall | ceiling | rug
     cost:  coins; use: what a person does there; light: glows at
            night; spawn: horse | dog arrives when it is placed.
   ============================================================ */
'use strict';

const ROOM_TYPES = {
  empty:    { name: 'Empty room', word: 'room', icon: 'room', wall: '#d9c9a8', floor: '#8a6a44', emoji: '🚪' },
  throne:   { name: 'Throne room', word: 'throne', icon: 'throne', wall: '#e2c9b8', floor: '#9a3a3a', emoji: '👑' },
  hall:     { name: 'Great hall', word: 'hall', icon: 'longtable', wall: '#d8c4a0', floor: '#8a6a44', emoji: '🍗' },
  kitchen:  { name: 'Kitchen', word: 'kitchen', icon: 'hearth', wall: '#e8dcc0', floor: '#9a8a70', emoji: '🍲' },
  bedroom:  { name: 'Bedchamber', word: 'bed', icon: 'canopybed', wall: '#d8c8e8', floor: '#8a6a50', emoji: '🛏️' },
  nursery:  { name: 'Nursery', word: 'nursery', icon: 'cradle', wall: '#f4e0c8', floor: '#9a7a5a', emoji: '🧸' },
  library:  { name: 'Library', word: 'books', icon: 'bookshelf', wall: '#d8d0b0', floor: '#7a5a3a', emoji: '📚' },
  music:    { name: 'Music room', word: 'music', icon: 'harp', wall: '#e0d0e8', floor: '#8a6a50', emoji: '🎵' },
  armoury:  { name: 'Armoury', word: 'armour', icon: 'armourstand', wall: '#c8c8c8', floor: '#6a6a6a', emoji: '🛡️' },
  treasury: { name: 'Treasury', word: 'gold', icon: 'chest', wall: '#d8c890', floor: '#6a5a3a', emoji: '💰' },
  stables:  { name: 'Stables', word: 'horse', icon: 'stall', wall: '#d8c8a0', floor: '#a08a5a', emoji: '🐴', groundOnly: true },
  kennels:  { name: 'Kennels', word: 'dog', icon: 'kennel', wall: '#d0c8b0', floor: '#9a8a6a', emoji: '🐕', groundOnly: true },
  forge:    { name: 'Forge', word: 'forge', icon: 'anvil', wall: '#b8b0a8', floor: '#5a5250', emoji: '🔨', groundOnly: true },
  bakery:   { name: 'Bakery', word: 'bread', icon: 'oven', wall: '#ecdcb8', floor: '#9a7a5a', emoji: '🍞' },
  lookout:  { name: 'Tower lookout', word: 'lookout', icon: 'telescope', wall: '#c8c8d0', floor: '#7a7a80', emoji: '🔭' },
  cellar:   { name: 'Cellar', word: 'cellar', icon: 'barrel', wall: '#a8a098', floor: '#5a5048', emoji: '🧀' },
  store:    { name: 'Storeroom', word: 'store', icon: 'barrel', wall: '#cfc4a8', floor: '#8a7a5a', emoji: '📦' }
};
const ROOM_KEYS = Object.keys(ROOM_TYPES).filter(k => k !== 'empty');

const ITEMS = {
  /* throne room */
  throne:      { name: 'Throne', word: 'throne', rooms: ['throne'], w: 2, h: 2, mount: 'floor', cost: 40, use: 'sit', royal: true },
  carpet:      { name: 'Red carpet', word: 'carpet', rooms: ['throne', 'hall'], w: 3, h: 1, mount: 'rug', cost: 15 },
  banner:      { name: 'Banner', word: 'banner', rooms: ['throne', 'hall', 'armoury', 'lookout'], w: 1, h: 2, mount: 'wall', cost: 10 },
  chandelier:  { name: 'Chandelier', word: 'light', rooms: ['throne', 'hall', 'bedroom', 'music', 'library'], w: 2, h: 1, mount: 'ceiling', cost: 30, light: 1.2 },
  pillar:      { name: 'Pillar', word: 'pillar', rooms: ['any'], w: 1, h: 2, mount: 'floor', cost: 8 },
  armour:      { name: 'Suit of armour', word: 'armour', rooms: ['throne', 'hall', 'armoury'], w: 1, h: 2, mount: 'floor', cost: 25 },
  torch:       { name: 'Wall torch', word: 'torch', rooms: ['any'], w: 1, h: 1, mount: 'wall', cost: 5, light: .8 },
  /* great hall */
  longtable:   { name: 'Long table', word: 'table', rooms: ['hall'], w: 4, h: 1, mount: 'floor', cost: 30, use: 'eat', feast: true },
  bench:       { name: 'Bench', word: 'bench', rooms: ['hall', 'kitchen', 'any'], w: 2, h: 1, mount: 'floor', cost: 10, use: 'sit' },
  fireplace:   { name: 'Fireplace', word: 'fire', rooms: ['hall', 'bedroom', 'throne', 'library', 'nursery'], w: 2, h: 2, mount: 'floor', cost: 35, light: 1.0, fire: true, use: 'warm' },
  tapestry:    { name: 'Tapestry', word: 'tapestry', rooms: ['hall', 'throne', 'bedroom', 'library'], w: 2, h: 2, mount: 'wall', cost: 20 },
  barrel:      { name: 'Barrel', word: 'barrel', rooms: ['any'], w: 1, h: 1, mount: 'floor', cost: 5 },
  /* kitchen */
  hearth:      { name: 'Kitchen hearth', word: 'hearth', rooms: ['kitchen'], w: 2, h: 2, mount: 'floor', cost: 35, light: .9, fire: true, use: 'cook' },
  potrack:     { name: 'Pots and pans', word: 'pots', rooms: ['kitchen'], w: 2, h: 1, mount: 'wall', cost: 10 },
  herbs:       { name: 'Hanging herbs', word: 'herbs', rooms: ['kitchen', 'bakery'], w: 2, h: 1, mount: 'ceiling', cost: 6 },
  kitchentable:{ name: 'Kitchen table', word: 'table', rooms: ['kitchen', 'bakery'], w: 2, h: 1, mount: 'floor', cost: 15, use: 'cook' },
  cauldron:    { name: 'Cauldron', word: 'pot', rooms: ['kitchen'], w: 1, h: 1, mount: 'floor', cost: 12, light: .3, use: 'cook' },
  breadshelf:  { name: 'Bread shelf', word: 'bread', rooms: ['kitchen', 'bakery'], w: 1, h: 2, mount: 'floor', cost: 10 },
  /* bedchamber and nursery */
  canopybed:   { name: 'Canopy bed', word: 'bed', rooms: ['bedroom'], w: 3, h: 2, mount: 'floor', cost: 45, use: 'sleep', royal: true },
  bed:         { name: 'Bed', word: 'bed', rooms: ['bedroom', 'nursery', 'any'], w: 2, h: 1, mount: 'floor', cost: 20, use: 'sleep' },
  wardrobe:    { name: 'Wardrobe', word: 'wardrobe', rooms: ['bedroom', 'nursery'], w: 1, h: 2, mount: 'floor', cost: 18 },
  mirror:      { name: 'Mirror', word: 'mirror', rooms: ['bedroom', 'throne'], w: 1, h: 2, mount: 'wall', cost: 15 },
  rug:         { name: 'Rug', word: 'rug', rooms: ['any'], w: 2, h: 1, mount: 'rug', cost: 8 },
  candle:      { name: 'Candle table', word: 'candle', rooms: ['bedroom', 'nursery', 'library', 'any'], w: 1, h: 1, mount: 'floor', cost: 8, light: .5 },
  cradle:      { name: 'Cradle', word: 'cradle', rooms: ['nursery'], w: 1, h: 1, mount: 'floor', cost: 15, use: 'rock' },
  rockinghorse:{ name: 'Rocking horse', word: 'toy', rooms: ['nursery'], w: 1, h: 1, mount: 'floor', cost: 12, use: 'play' },
  toychest:    { name: 'Toy chest', word: 'toys', rooms: ['nursery', 'bedroom'], w: 1, h: 1, mount: 'floor', cost: 10 },
  dollhouse:   { name: 'Doll\'s castle', word: 'castle', rooms: ['nursery'], w: 1, h: 2, mount: 'floor', cost: 20, use: 'play' },
  /* library and lookout */
  bookshelf:   { name: 'Bookshelf', word: 'books', rooms: ['library', 'any'], w: 2, h: 2, mount: 'floor', cost: 25, use: 'read' },
  desk:        { name: 'Writing desk', word: 'desk', rooms: ['library', 'bedroom'], w: 2, h: 1, mount: 'floor', cost: 18, use: 'read' },
  globe:       { name: 'Globe', word: 'globe', rooms: ['library', 'lookout'], w: 1, h: 1, mount: 'floor', cost: 12 },
  telescope:   { name: 'Telescope', word: 'telescope', rooms: ['library', 'lookout'], w: 1, h: 2, mount: 'floor', cost: 25, use: 'look' },
  scrolls:     { name: 'Scroll rack', word: 'scrolls', rooms: ['library'], w: 1, h: 2, mount: 'wall', cost: 10 },
  brazier:     { name: 'Brazier', word: 'fire', rooms: ['lookout', 'armoury', 'forge'], w: 1, h: 1, mount: 'floor', cost: 12, light: .7, fire: true },
  bell:        { name: 'Bell', word: 'bell', rooms: ['lookout'], w: 1, h: 1, mount: 'ceiling', cost: 20, bell: true },
  /* music room */
  harp:        { name: 'Harp', word: 'harp', rooms: ['music', 'throne'], w: 1, h: 2, mount: 'floor', cost: 30, use: 'play' },
  lute:        { name: 'Lute', word: 'lute', rooms: ['music', 'hall'], w: 1, h: 1, mount: 'floor', cost: 15, use: 'play' },
  drum:        { name: 'Drum', word: 'drum', rooms: ['music', 'hall'], w: 1, h: 1, mount: 'floor', cost: 12, use: 'play' },
  /* armoury (training only) */
  armourstand: { name: 'Armour stand', word: 'armour', rooms: ['armoury'], w: 1, h: 2, mount: 'floor', cost: 20 },
  shields:     { name: 'Shields', word: 'shields', rooms: ['armoury', 'hall'], w: 2, h: 1, mount: 'wall', cost: 12 },
  lancerack:   { name: 'Practice lances', word: 'lances', rooms: ['armoury', 'stables'], w: 2, h: 2, mount: 'floor', cost: 20 },
  helmets:     { name: 'Helmet shelf', word: 'helmets', rooms: ['armoury'], w: 2, h: 1, mount: 'wall', cost: 12 },
  /* treasury */
  chest:       { name: 'Treasure chest', word: 'chest', rooms: ['treasury', 'bedroom', 'store'], w: 1, h: 1, mount: 'floor', cost: 20 },
  coins:       { name: 'Pile of coins', word: 'coins', rooms: ['treasury'], w: 2, h: 1, mount: 'floor', cost: 30 },
  crownstand:  { name: 'Crown stand', word: 'crown', rooms: ['treasury', 'throne'], w: 1, h: 2, mount: 'floor', cost: 35 },
  /* stables and kennels */
  stall:       { name: 'Horse stall', word: 'stall', rooms: ['stables'], w: 2, h: 2, mount: 'floor', cost: 40, spawn: 'horse', use: 'stall' },
  hay:         { name: 'Hay bale', word: 'hay', rooms: ['stables', 'outdoor'], w: 1, h: 1, mount: 'floor', cost: 5, use: 'hay' },
  trough:      { name: 'Water trough', word: 'water', rooms: ['stables', 'outdoor'], w: 2, h: 1, mount: 'floor', cost: 10, use: 'drink' },
  saddles:     { name: 'Saddle rack', word: 'saddle', rooms: ['stables'], w: 1, h: 2, mount: 'wall', cost: 12 },
  lantern:     { name: 'Lantern', word: 'lantern', rooms: ['any'], w: 1, h: 1, mount: 'wall', cost: 6, light: .6 },
  kennel:      { name: 'Dog kennel', word: 'kennel', rooms: ['kennels', 'outdoor'], w: 2, h: 1, mount: 'floor', cost: 20, spawn: 'dog', use: 'kennel' },
  bowl:        { name: 'Dog bowl', word: 'bowl', rooms: ['kennels', 'kitchen'], w: 1, h: 1, mount: 'floor', cost: 4 },
  /* forge and bakery */
  anvil:       { name: 'Anvil', word: 'anvil', rooms: ['forge'], w: 1, h: 1, mount: 'floor', cost: 20, use: 'hammer' },
  forgefire:   { name: 'Forge fire', word: 'fire', rooms: ['forge'], w: 2, h: 2, mount: 'floor', cost: 35, light: 1.1, fire: true, sparks: true },
  bellows:     { name: 'Bellows', word: 'bellows', rooms: ['forge'], w: 1, h: 1, mount: 'floor', cost: 10 },
  tools:       { name: 'Tool wall', word: 'tools', rooms: ['forge', 'stables'], w: 2, h: 1, mount: 'wall', cost: 10 },
  oven:        { name: 'Bread oven', word: 'oven', rooms: ['bakery', 'kitchen'], w: 2, h: 2, mount: 'floor', cost: 35, light: .7, fire: true, use: 'bake' },
  flour:       { name: 'Flour sacks', word: 'flour', rooms: ['bakery', 'kitchen', 'store'], w: 1, h: 1, mount: 'floor', cost: 6 },
  /* cellar and store */
  cheese:      { name: 'Cheese wheels', word: 'cheese', rooms: ['cellar', 'kitchen', 'store'], w: 1, h: 1, mount: 'floor', cost: 8 },
  winerack:    { name: 'Bottle rack', word: 'bottles', rooms: ['cellar'], w: 2, h: 2, mount: 'floor', cost: 18 },
  crates:      { name: 'Crates', word: 'crates', rooms: ['store', 'cellar', 'stables'], w: 1, h: 1, mount: 'floor', cost: 5 },
  /* anywhere indoors */
  painting:    { name: 'Painting', word: 'picture', rooms: ['any'], w: 1, h: 1, mount: 'wall', cost: 10 },
  plant:       { name: 'Potted plant', word: 'plant', rooms: ['any', 'outdoor'], w: 1, h: 1, mount: 'floor', cost: 6 },
  stool:       { name: 'Stool', word: 'stool', rooms: ['any'], w: 1, h: 1, mount: 'floor', cost: 5, use: 'sit' },
  table:       { name: 'Small table', word: 'table', rooms: ['any'], w: 1, h: 1, mount: 'floor', cost: 8 },
  /* the garden and the courtyard */
  fountain:    { name: 'Fountain', word: 'fountain', rooms: ['outdoor'], w: 3, h: 2, mount: 'floor', cost: 60, use: 'look', water: true },
  rosebush:    { name: 'Rose bush', word: 'roses', rooms: ['outdoor'], w: 1, h: 1, mount: 'floor', cost: 6 },
  hedge:       { name: 'Hedge', word: 'hedge', rooms: ['outdoor'], w: 1, h: 1, mount: 'floor', cost: 4 },
  hedgearch:   { name: 'Hedge arch', word: 'arch', rooms: ['outdoor'], w: 1, h: 2, mount: 'floor', cost: 10 },
  appletree:   { name: 'Apple tree', word: 'tree', rooms: ['outdoor'], w: 2, h: 3, mount: 'floor', cost: 25 },
  well:        { name: 'Well', word: 'well', rooms: ['outdoor'], w: 1, h: 2, mount: 'floor', cost: 20, use: 'drink' },
  pond:        { name: 'Lily pond', word: 'pond', rooms: ['outdoor'], w: 3, h: 1, mount: 'rug', cost: 20, water: true },
  quintain:    { name: 'Quintain', word: 'quintain', rooms: ['outdoor'], w: 1, h: 2, mount: 'floor', cost: 25, use: 'train' },
  tiltrail:    { name: 'Jousting rail', word: 'joust', rooms: ['outdoor'], w: 4, h: 1, mount: 'rug', cost: 50, joust: true },
  stand:       { name: 'Royal stand', word: 'stand', rooms: ['outdoor'], w: 2, h: 2, mount: 'floor', cost: 40, use: 'sit', royal: true },
  flag:        { name: 'Flag', word: 'flag', rooms: ['top'], w: 1, h: 2, mount: 'top', cost: 8 },
  tent:        { name: 'Striped tent', word: 'tent', rooms: ['outdoor'], w: 3, h: 2, mount: 'floor', cost: 25 },
  marketstall: { name: 'Market stall', word: 'stall', rooms: ['outdoor'], w: 2, h: 2, mount: 'floor', cost: 20, use: 'look' },
  gbench:      { name: 'Garden bench', word: 'bench', rooms: ['outdoor'], w: 2, h: 1, mount: 'floor', cost: 10, use: 'sit' },
  lamppost:    { name: 'Lamp post', word: 'lamp', rooms: ['outdoor'], w: 1, h: 2, mount: 'floor', cost: 12, light: .7 },
  swing:       { name: 'Swing', word: 'swing', rooms: ['outdoor'], w: 2, h: 2, mount: 'floor', cost: 20, use: 'play' },
  beehive:     { name: 'Beehive', word: 'bees', rooms: ['outdoor'], w: 1, h: 1, mount: 'floor', cost: 8 },
  birdbath:    { name: 'Bird bath', word: 'bath', rooms: ['outdoor'], w: 1, h: 1, mount: 'floor', cost: 8, water: true },
  cart:        { name: 'Hay cart', word: 'cart', rooms: ['outdoor'], w: 2, h: 1, mount: 'floor', cost: 15 },
  haystack:    { name: 'Haystack', word: 'hay', rooms: ['outdoor'], w: 2, h: 2, mount: 'floor', cost: 10, use: 'hay' },
  dovecote:    { name: 'Dovecote', word: 'pigeons', rooms: ['top', 'outdoor'], w: 1, h: 2, mount: 'top', cost: 20, pigeons: true },
  sundial:     { name: 'Sundial', word: 'sundial', rooms: ['outdoor'], w: 1, h: 1, mount: 'floor', cost: 10 },
  topiary:     { name: 'Topiary', word: 'bush', rooms: ['outdoor'], w: 1, h: 2, mount: 'floor', cost: 10 },
  perch:       { name: 'Dragon perch', word: 'dragon', rooms: ['top'], w: 2, h: 1, mount: 'top', cost: 80, quest: 'tower10' },
  fireworks:   { name: 'Fireworks box', word: 'fireworks', rooms: ['outdoor', 'top'], w: 1, h: 1, mount: 'floor', cost: 30, quest: 'tower6', fireworks: true }
};
const ITEM_KEYS = Object.keys(ITEMS);
for (const k of ITEM_KEYS) ITEMS[k].key = k;
/* which items belong to a room type's page */
function itemsForRoom(type) { return ITEM_KEYS.filter(k => ITEMS[k].rooms.includes(type)); }
function itemFits(item, roomType) { const r = item.rooms; return r.includes('any') || r.includes(roomType); }

/* the Build page: tiles, in the order they are shown */
const BUILD_TOOLS = ['stone', 'floor', 'tower', 'roof', 'cone', 'battlement', 'wood', 'door', 'gate', 'stair', 'slit', 'arch', 'stained', 'water', 'drawbridge', 'bridge'];
/* pages of the catalogue (Furnish shows the pages of the rooms you have named; Garden is always open) */
const GARDEN_ITEMS = ['rosebush', 'hedge', 'hedgearch', 'topiary', 'appletree', 'gbench', 'well', 'fountain', 'pond', 'birdbath', 'lamppost', 'swing', 'beehive', 'sundial', 'hay', 'haystack', 'cart', 'trough', 'kennel', 'tent', 'marketstall', 'quintain', 'tiltrail', 'stand', 'flag', 'dovecote', 'plant', 'fireworks', 'perch'];

/* ---------- royal quests ----------
   check(S) looks at a summary of the castle (builder.summary()).  reward: coins.  unlock: an item or page. */
const QUESTS = [
  { key: 'stones10', title: 'Lay the first stones', text: 'Lay ten stones.', simple: 'Put down ten stones.', icon: 'stone', reward: 30, check: (S) => S.stones >= 10 },
  { key: 'door', title: 'A way in', text: 'Put a door in a wall.', simple: 'Make a door.', icon: 'door', reward: 20, check: (S) => S.doors >= 1 },
  { key: 'room', title: 'The first room', text: 'Close in a room: walls on both sides, a floor below and a ceiling above.', simple: 'Make a room with walls all round.', icon: 'room', reward: 40, check: (S) => S.rooms >= 1 },
  { key: 'nameRoom', title: 'What is this room?', text: 'Tap a room with the Name tool and choose what it is for.', simple: 'Name a room.', icon: 'nametag', reward: 20, check: (S) => S.named >= 1 },
  { key: 'window', title: 'Let the light in', text: 'Put in three windows.', simple: 'Make three windows.', icon: 'arch', reward: 30, check: (S) => S.windows >= 3 },
  { key: 'throne', title: 'A throne for the ruler', text: 'Make a throne room and put a throne in it.', simple: 'Make a throne room. Put a throne in it.', icon: 'throne', reward: 60, check: (S) => S.items.throne >= 1 && S.roomTypes.throne >= 1 },
  { key: 'tower6', title: 'A tall tower', text: 'Build a tower six blocks high with a pointed roof.', simple: 'Build a tower six high with a spire.', icon: 'cone', reward: 60, unlock: 'fireworks', check: (S) => S.tallest >= 6 && S.cones >= 1 },
  { key: 'battlements', title: 'Walls for the knights', text: 'Put five battlements along the top of your walls. Knights will come to guard them.', simple: 'Put five teeth on the wall top.', icon: 'battlement', reward: 30, check: (S) => S.battlements >= 5 },
  { key: 'moat', title: 'Dig the moat', text: 'Dig a moat six cells wide in front of the castle.', simple: 'Dig a moat six wide.', icon: 'moat', reward: 50, check: (S) => S.water >= 6 },
  { key: 'drawbridge', title: 'The drawbridge', text: 'Put a drawbridge over the moat.', simple: 'Put a drawbridge on the moat.', icon: 'drawbridge', reward: 50, check: (S) => S.drawbridges >= 1 },
  { key: 'gate', title: 'The portcullis', text: 'Put a gate in your gatehouse.', simple: 'Make a gate.', icon: 'gate', reward: 20, check: (S) => S.gates >= 1 },
  { key: 'stairs', title: 'Up the stairs', text: 'Put stairs through a floor so people can climb to the room above.', simple: 'Put stairs in to go up.', icon: 'stair', reward: 40, check: (S) => S.stairsUp >= 1 },
  { key: 'kitchen', title: 'Something is cooking', text: 'Make a kitchen with a hearth.', simple: 'Make a kitchen with a fire.', icon: 'hearth', reward: 40, check: (S) => S.items.hearth >= 1 && S.roomTypes.kitchen >= 1 },
  { key: 'bedroom', title: 'Sweet dreams', text: 'Make a bedchamber with a bed in it.', simple: 'Make a bedroom with a bed.', icon: 'canopybed', reward: 40, check: (S) => S.roomTypes.bedroom >= 1 && (S.items.canopybed + S.items.bed) >= 1 },
  { key: 'hall', title: 'Time for a feast', text: 'Make a great hall with a long table. Everyone will come to feast in the evening.', simple: 'Make a hall with a long table.', icon: 'longtable', reward: 60, check: (S) => S.roomTypes.hall >= 1 && S.items.longtable >= 1 },
  { key: 'stables', title: 'Horses!', text: 'Make stables on the ground floor with two stalls. A horse comes to every stall.', simple: 'Make stables with two stalls.', icon: 'stall', reward: 80, check: (S) => S.items.stall >= 2 && S.roomTypes.stables >= 1 },
  { key: 'quintain', title: 'Knight school', text: 'Put a quintain in the courtyard for the knights to train.', simple: 'Put a quintain outside.', icon: 'quintain', reward: 40, check: (S) => S.items.quintain >= 1 },
  { key: 'library', title: 'A room full of books', text: 'Make a library with a bookshelf.', simple: 'Make a library with books.', icon: 'bookshelf', reward: 40, check: (S) => S.roomTypes.library >= 1 && S.items.bookshelf >= 1 },
  { key: 'flags3', title: 'Flying the flag', text: 'Fly three flags from your towers and walls.', simple: 'Put up three flags.', icon: 'flag', reward: 30, check: (S) => S.items.flag >= 3 },
  { key: 'joust', title: 'Tournament day', text: 'Lay a jousting rail in the courtyard and have two horses ready. The knights will joust!', simple: 'Put a jousting rail outside. Get two horses.', icon: 'tiltrail', reward: 80, check: (S) => S.items.tiltrail >= 1 && S.horses >= 2 },
  { key: 'moatAround', title: 'Water all the way round', text: 'Dig the moat on both sides of the castle.', simple: 'Dig water on both sides.', icon: 'moat', reward: 80, check: (S) => S.moatAround },
  { key: 'nursery', title: 'Room for the little ones', text: 'Make a nursery with a cradle.', simple: 'Make a nursery with a cradle.', icon: 'cradle', reward: 40, check: (S) => S.roomTypes.nursery >= 1 && S.items.cradle >= 1 },
  { key: 'forge', title: 'Ring the anvil', text: 'Make a forge with a fire and an anvil.', simple: 'Make a forge with a fire and an anvil.', icon: 'anvil', reward: 40, check: (S) => S.roomTypes.forge >= 1 && S.items.anvil >= 1 && S.items.forgefire >= 1 },
  { key: 'garden', title: 'The castle garden', text: 'Plant and place five things in the garden.', simple: 'Put five things in the garden.', icon: 'rosebush', reward: 40, check: (S) => S.garden >= 5 },
  { key: 'rooms6', title: 'A real castle', text: 'Have six named rooms.', simple: 'Name six rooms.', icon: 'room', reward: 100, check: (S) => S.named >= 6 },
  { key: 'furniture20', title: 'Fully furnished', text: 'Furnish the castle with twenty things.', simple: 'Put in twenty things.', icon: 'chest', reward: 80, check: (S) => S.furniture >= 20 },
  { key: 'brush', title: 'Happy horses', text: 'Brush and feed the horses five times.', simple: 'Brush the horses five times.', icon: 'horse', reward: 40, check: (S) => S.brushed >= 5 },
  { key: 'tower10', title: 'Touch the clouds', text: 'Build a tower ten blocks high. Something may come to visit…', simple: 'Build a tower ten high!', icon: 'dragon', reward: 150, unlock: 'perch', check: (S) => S.tallest >= 10 }
];
const QUEST_BY_KEY = {}; for (const q of QUESTS) QUEST_BY_KEY[q.key] = q;

/* ---------- blueprints: what the plot looks like at the start ----------
   build(b) uses the helpers: b.rect(x0,y0,x1,y1,tile) b.set(x,y,tile) b.room(x,y,type) b.item(key,x,y)
   (x,y in cells; y is the world row; GROUND-1 is the ground floor's standing row) */
const BLUEPRINTS = {
  plot: { name: 'An empty plot', blurb: 'Grass, a hill and the sky. Build it all yourself.', simple: 'Build it all yourself!', build() {} },
  keep: {
    name: 'A little keep', blurb: 'One small tower with two rooms and a door. Add to it.', simple: 'A little keep to add to.',
    build(b) {
      const ox = 30, g = GROUND - 1;                      /* 10 wide: walls at ox and ox+9 */
      b.rect(ox, g - 7, ox, g, T.STONE); b.rect(ox + 9, g - 7, ox + 9, g, T.STONE);
      b.rect(ox + 1, g - 3, ox + 8, g - 3, T.FLOOR);        /* the floor between the two storeys */
      b.rect(ox, g - 8, ox + 9, g - 8, T.STONE);            /* the roof slab */
      b.rect(ox, g - 9, ox + 9, g - 9, T.BATTLEMENT);
      b.set(ox + 9, g, T.DOOR); b.set(ox, g - 5, T.WIN_ARCH); b.set(ox + 9, g - 5, T.WIN_ARCH); b.set(ox, g - 1, T.WIN_SLIT);
      b.rect(ox + 8, g - 3, ox + 8, g, T.STAIR);            /* stairs up through the floor */
      /* a round tower on the right with a spire */
      b.rect(ox + 11, g - 12, ox + 11, g, T.TOWER); b.rect(ox + 13, g - 12, ox + 13, g, T.TOWER);
      b.rect(ox + 12, g - 9, ox + 12, g, T.STAIR); b.rect(ox + 11, g - 13, ox + 13, g - 13, T.TOWER);
      b.rect(ox + 11, g - 16, ox + 13, g - 14, T.CONE); b.set(ox + 11, g - 10, T.WIN_SLIT); b.set(ox + 13, g - 6, T.WIN_SLIT);
      b.set(ox + 11, g, T.DOOR);
      b.item('torch', ox + 2, g - 1); b.item('bench', ox + 3, g); b.item('flag', ox + 4, g - 9);
    }
  },
  castle: {
    name: 'A grand castle', blurb: 'Towers, a keep with six rooms, stables, a courtyard, a gatehouse, a moat and a drawbridge. Decorate it, or change it all.', simple: 'A big castle, ready to decorate.',
    build(b) {
      const ox = 14, g = GROUND - 1;
      /* the moat on both sides */
      for (let x = ox - 4; x <= ox - 1; x++) for (let y = GROUND; y < GROUND + MOAT_DEPTH; y++) b.set(x, y, T.WATER);
      for (let x = ox + 40; x <= ox + 42; x++) for (let y = GROUND; y < GROUND + MOAT_DEPTH; y++) b.set(x, y, T.WATER);
      b.set(ox + 39, GROUND, T.DRAWBRIDGE); for (let y = GROUND + 1; y < GROUND + MOAT_DEPTH; y++) b.set(ox + 39, y, T.WATER);
      /* the left tower with its spiral stair */
      b.rect(ox, g - 13, ox, g, T.TOWER); b.rect(ox + 2, g - 13, ox + 2, g, T.TOWER);
      b.rect(ox + 1, g - 11, ox + 1, g, T.STAIR); b.rect(ox, g - 14, ox + 2, g - 14, T.TOWER);
      b.rect(ox, g - 17, ox + 2, g - 15, T.CONE);
      b.set(ox, g - 5, T.WIN_SLIT); b.set(ox, g - 9, T.WIN_SLIT); b.set(ox, g - 13, T.WIN_SLIT);
      b.set(ox + 2, g, T.DOOR); b.set(ox + 2, g - 4, T.DOOR); b.set(ox + 2, g - 8, T.DOOR);
      /* the keep: three storeys, two rooms each */
      b.rect(ox + 19, g - 11, ox + 19, g, T.STONE);         /* right wall */
      b.rect(ox + 3, g - 3, ox + 18, g - 3, T.FLOOR); b.rect(ox + 3, g - 7, ox + 18, g - 7, T.FLOOR);
      b.rect(ox + 3, g - 11, ox + 19, g - 11, T.STONE);     /* roof slab */
      b.rect(ox + 3, g - 12, ox + 19, g - 12, T.BATTLEMENT);
      b.rect(ox + 12, g - 10, ox + 12, g, T.STONE); b.set(ox + 12, g, T.DOOR); b.set(ox + 12, g - 4, T.DOOR); b.set(ox + 12, g - 8, T.DOOR);
      b.set(ox + 19, g - 1, T.WIN_ARCH); b.set(ox + 19, g - 5, T.WIN_STAINED); b.set(ox + 19, g - 9, T.WIN_ARCH); b.set(ox + 19, g - 6, T.WIN_ARCH);
      b.set(ox + 19, g, T.DOOR);
      b.room(ox + 5, g, 'hall'); b.room(ox + 14, g, 'kitchen'); b.room(ox + 5, g - 4, 'throne'); b.room(ox + 14, g - 4, 'library'); b.room(ox + 5, g - 8, 'bedroom'); b.room(ox + 14, g - 8, 'nursery');
      /* the stables, leaning on the keep */
      b.rect(ox + 26, g - 2, ox + 26, g, T.STONE); b.rect(ox + 20, g - 3, ox + 26, g - 3, T.ROOF); b.set(ox + 26, g, T.DOOR);
      b.room(ox + 21, g, 'stables');
      /* the gatehouse */
      b.rect(ox + 34, g - 7, ox + 34, g, T.STONE); b.rect(ox + 38, g - 7, ox + 38, g, T.STONE);
      b.set(ox + 34, g, T.GATE); b.set(ox + 38, g, T.GATE);
      b.rect(ox + 36, g - 3, ox + 37, g - 3, T.FLOOR); b.rect(ox + 35, g - 3, ox + 35, g, T.STAIR);
      b.rect(ox + 34, g - 7, ox + 38, g - 7, T.STONE); b.rect(ox + 34, g - 8, ox + 38, g - 8, T.BATTLEMENT);
      b.set(ox + 38, g - 1, T.WIN_SLIT); b.set(ox + 38, g - 5, T.WIN_SLIT); b.set(ox + 34, g - 5, T.WIN_SLIT);
      b.room(ox + 36, g - 4, 'armoury');
      /* furniture */
      b.item('longtable', ox + 4, g); b.item('bench', ox + 9, g); b.item('fireplace', ox + 10, g); b.item('tapestry', ox + 7, g - 1); b.item('torch', ox + 4, g - 1); b.item('carpet', ox + 4, g);
      b.item('hearth', ox + 13, g); b.item('kitchentable', ox + 16, g); b.item('herbs', ox + 15, g - 2); b.item('potrack', ox + 16, g - 1); b.item('cauldron', ox + 18, g);
      b.item('throne', ox + 7, g - 4); b.item('carpet', ox + 4, g - 4); b.item('chandelier', ox + 8, g - 6); b.item('banner', ox + 4, g - 5); b.item('banner', ox + 11, g - 5); b.item('armour', ox + 10, g - 4);
      b.item('bookshelf', ox + 13, g - 4); b.item('desk', ox + 16, g - 4); b.item('globe', ox + 18, g - 4); b.item('scrolls', ox + 15, g - 5);
      b.item('canopybed', ox + 4, g - 8); b.item('wardrobe', ox + 8, g - 8); b.item('rug', ox + 9, g - 8); b.item('mirror', ox + 11, g - 9); b.item('candle', ox + 7, g - 8);
      b.item('cradle', ox + 14, g - 8); b.item('rockinghorse', ox + 16, g - 8); b.item('toychest', ox + 17, g - 8); b.item('dollhouse', ox + 13, g - 8);
      b.item('stall', ox + 20, g); b.item('stall', ox + 22, g); b.item('hay', ox + 24, g); b.item('lantern', ox + 25, g - 1); b.item('saddles', ox + 24, g - 1);
      b.item('armourstand', ox + 35, g - 4); b.item('shields', ox + 36, g - 5); b.item('brazier', ox + 37, g - 4);
      b.item('fountain', ox + 28, g); b.item('quintain', ox + 32, g); b.item('rosebush', ox + 27, g); b.item('rosebush', ox + 31, g); b.item('appletree', ox + 44, g); b.item('well', ox - 7, g);
      b.item('flag', ox + 10, g - 12); b.item('flag', ox + 36, g - 8); b.item('torch', ox + 17, g - 9);
    }
  }
};
