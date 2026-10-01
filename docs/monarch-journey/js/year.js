/* ============================================================
   year.js — the relay of generations, the milkweeds, the
   journal stickers, the regions, and the second batch of facts
   ============================================================ */
'use strict';

/* ---------- where each generation is born ---------- */
const RELAY = [
  { key: 'ontario', name: 'Ontario meadow', place: 'Point Pelee, Ontario', season: 'Late summer', plant: 'swamp', super: true, lon: -82.5, lat: 42.0,
    palette: { hills: ['#8ec279', '#6fae62', '#57984f'], soil: ['#6a4a2c', '#4a3320', '#2c1d12'], grass: ['#4f9a3a', '#5fae43', '#3f8a2e', '#74c24f'], far: '#3d7a4a', far2: '#8fbf72', flowerA: '#e9a2c8', flowerB: '#f2c21b' },
    blurb: 'Born in late August, when the days are getting short. This is the super generation.' },
  { key: 'texas', name: 'Texas hill country', place: 'Hill Country, Texas', season: 'Early spring', plant: 'antelope', super: false, lon: -98.5, lat: 30.3,
    palette: { hills: ['#c9b46a', '#a89654', '#8a7a48'], soil: ['#8a6a3a', '#6a4e2a', '#3e2c18'], grass: ['#a9a84a', '#8fa040', '#c0b050', '#7a8a3a'], far: '#8a7a48', far2: '#c9b46a', flowerA: '#4a6fd8', flowerB: '#e0442a' },
    blurb: 'The first milkweed of the year pokes up in March. The super generation lays its eggs here and dies.' },
  { key: 'kansas', name: 'Kansas prairie', place: 'Flint Hills, Kansas', season: 'Early summer', plant: 'common', super: false, lon: -96.5, lat: 38.5,
    palette: { hills: ['#9fc45f', '#84ad4c', '#6a9640'], soil: ['#5a4630', '#3f3020', '#241a10'], grass: ['#7ab04a', '#94c458', '#5f9a3a', '#a8d060'], far: '#5a8a4a', far2: '#a8d060', flowerA: '#9c6cd6', flowerB: '#ffcf2e' },
    blurb: 'Their children fly on to the prairies and lay eggs on common milkweed. Their grandchildren will reach Canada.' }
];

const MILKWEEDS = {
  swamp:    { key: 'swamp', name: 'Swamp milkweed', latin: 'Asclepias incarnata', height: 1250, leafW: .26, leafSize: [95, 150], flower: '#e88ab8', flower2: '#c96a9d', crown: '#fbe8f2', stem: '#7fb85a', leaf: '#7fbf5c', leafD: '#4f8f3a', fact: 'swampmilkweed', blurb: 'Narrow leaves, rose-pink flowers, loves wet meadows. Monarchs adore it.' },
  antelope: { key: 'antelope', name: 'Antelope-horns milkweed', latin: 'Asclepias asperula', height: 950, leafW: .18, leafSize: [80, 125], flower: '#cfe0b0', flower2: '#8fae70', crown: '#f4f8e8', stem: '#8fb86a', leaf: '#8fbf6c', leafD: '#5f8f44', fact: 'texasmilkweed', blurb: 'A low, sprawling Texas milkweed with greenish-white flowers that curl like antelope horns. The first food of the year.' },
  common:   { key: 'common', name: 'Common milkweed', latin: 'Asclepias syriaca', height: 1300, leafW: .36, leafSize: [125, 185], flower: '#d8a0c0', flower2: '#b07a9a', crown: '#f6e6ee', stem: '#7fb85a', leaf: '#74b356', leafD: '#478236', fact: 'commonmilkweed', blurb: 'Big, broad, velvety leaves and dusty-pink flower balls that smell of honey. The classic prairie milkweed.' }
};

/* ---------- journal stickers ---------- */
const MILESTONES = [
  ['hatched', '🥚', 'Hatched'], ['molt1', '🐛', 'First molt'], ['molt4', '🐛', 'Fifth instar'], ['jhang', '🪝', 'Hung the J'],
  ['chrysalis', '💚', 'Chrysalis'], ['eclosed', '🦋', 'Emerged'], ['flight', '✈️', 'First flight'], ['super', '⭐', 'Super generation'],
  ['thermal', '🌀', 'Rode a thermal'], ['storm', '⛈️', 'Weathered a storm'], ['lake', '🌊', 'Crossed the lake'], ['roost', '🌙', 'Roosted'],
  ['tagged', '🏷️', 'Got tagged'], ['funnel', '🌪️', 'The Texas funnel'], ['arrived', '🌲', 'Reached the forest'], ['winter', '❄️', 'Survived winter'],
  ['spring', '🌸', 'Flew north'], ['eggs', '🥚', 'Laid eggs'], ['mate', '💞', 'Found a mate'], ['pod', '🌾', 'Burst a seed pod'],
  ['garden', '🌱', 'Planted milkweed'], ['escaped', '🐦', 'Escaped a bird'], ['mantis', '🦗', 'Dodged the mantis'], ['waited', '⏳', 'Waited out bad weather'],
  ['coop', '👯', 'Flew with a friend'], ['relay', '🔁', 'A whole year'],
  ['reader', '📖', 'Read a page'], ['mission', '🌟', 'Read it and did it'], ['aloud', '🎤', 'Read out loud']
];
const TREE_NAMES = { maple: 'Sugar maple', oak: 'Bur oak', birch: 'Paper birch', cottonwood: 'Cottonwood', pecan: 'Pecan', pine: 'Mexican pine', fir: 'Oyamel fir' };

/* ---------- when the monarchs pass, by region ---------- */
const REGIONS = [
  { key: 'ontario', name: 'Ontario & the Great Lakes', spring: 'Late May to June: the grandchildren arrive and lay eggs.', fall: 'Late August to mid September: the super generation leaves. Huge roosts at Point Pelee and Long Point.' },
  { key: 'northeast', name: 'New England & New York', spring: 'June: monarchs arrive on the first milkweed.', fall: 'September: the coastal flyway, with roosts at Cape May.' },
  { key: 'midwest', name: 'Midwest (Ohio to Iowa)', spring: 'May: the second generation arrives and lays eggs.', fall: 'Mid September to early October: peak migration overhead.' },
  { key: 'plains', name: 'Kansas, Oklahoma & Missouri', spring: 'April to May: the first generation from Texas arrives.', fall: 'Late September to mid October: the funnel fills.' },
  { key: 'texas', name: 'Texas', spring: 'March to April: the super generation arrives from Mexico and lays eggs.', fall: 'October: millions pass through, with roosts of thousands in pecan trees.' },
  { key: 'south', name: 'Florida & the Gulf coast', spring: 'Year round: some monarchs here never migrate.', fall: 'October to November: stragglers along the coast.' },
  { key: 'mexico', name: 'Central Mexico', spring: 'March: the colonies break up and head north.', fall: 'Early November: arrival at the oyamel forests, around Día de Muertos.' },
  { key: 'west', name: 'West of the Rockies', spring: 'March: they leave the California coast.', fall: 'October to November: western monarchs cluster in California groves such as Pismo Beach.' }
];

/* ---------- real recoveries, approximate, for the map ---------- */
const REAL_TAGS = [
  { from: 'Guelph, Ontario', lon: -80.2, lat: 43.5, days: 62 },
  { from: 'Minneapolis, Minnesota', lon: -93.3, lat: 45.0, days: 55 },
  { from: 'Lawrence, Kansas', lon: -95.2, lat: 38.9, days: 34 },
  { from: 'Cape May, New Jersey', lon: -74.9, lat: 38.9, days: 71 }
];

/* ---------- the second batch of facts ---------- */
Object.assign(FACTS, {
  tagged: {
    title: 'You have been tagged!',
    body: 'A volunteer caught you in a soft net and pressed a tiny round sticker onto your hindwing. It weighs less than a fortieth of your body. The code on it is yours alone. If someone finds you in Mexico and reports the code, scientists learn exactly where you came from and how fast you flew.',
    simple: 'A scientist put a tiny sticker with a code on your wing. It does not hurt. Now people can find out where you came from!',
    more: YT('monarch watch tagging')
  },
  recovery: {
    title: 'A recovery!',
    body: 'When a tagged monarch is found, that is called a recovery. Only about one tag in a hundred is ever found, so every one matters. The record is a monarch that flew 265 miles in a single day, with a strong tailwind.',
    simple: 'Your tag was found! Only one in a hundred is. You are a record for science.',
    more: YT('monarch tag recovery Mexico')
  },
  pod: {
    title: 'Seed pods',
    body: 'In autumn a milkweed pod dries, splits, and hundreds of flat brown seeds spill out, each with a parachute of silky fluff called floss. The wind carries them for miles. During the Second World War, children collected milkweed floss to stuff life jackets.',
    simple: 'The pod pops open and fluffy seeds fly away on the wind. Catch them and plant them!',
    more: YT('milkweed seed pod bursting')
  },
  garden: {
    title: 'Plant milkweed, get monarchs',
    body: 'The single biggest reason there are fewer monarchs than there used to be is that there is less milkweed. Every milkweed plant in a garden can feed a caterpillar. Plant native milkweed, skip the pesticides, and monarchs will find it.',
    simple: 'Monarchs need milkweed. If you plant milkweed, more monarchs can grow up.',
    more: YT('planting milkweed for monarchs')
  },
  forecast: {
    title: 'Reading the weather',
    body: 'Monarchs do not fly every day. They wait for tailwinds and sit out headwinds, rain and cold. At Point Pelee, thousands pile up for days until the wind turns north. Waiting is not laziness: a good day can be worth five bad ones.',
    simple: 'Monarchs wait for a good wind. A good day is worth five bad days!',
    more: YT('monarchs waiting for tailwind Point Pelee')
  },
  toxic2: {
    title: 'Spat out!',
    body: 'The bird grabbed you and let go straight away. Your body is full of the milkweed poison you ate as a caterpillar, and it tastes horrible. A bird that tries one monarch remembers the orange and black pattern and never tries again.',
    simple: 'The bird spat you out! You taste terrible because of the milkweed. It will not try again.',
    more: YT('bird eats monarch spits out')
  },
  oriole: {
    title: 'The oriole and the grosbeak',
    body: 'Two Mexican birds have found a way round the poison. The black-backed oriole slits a monarch open and eats only the inside, and the black-headed grosbeak can stomach a few a day. Between them they eat millions of monarchs each winter, but the colonies are so big it barely shows.',
    simple: 'Two clever birds in Mexico can eat monarchs anyway. Watch out in the forest!',
    more: YT('black-backed oriole eating monarchs')
  },
  mantis: {
    title: 'A praying mantis',
    body: 'A mantis sits perfectly still on a leaf, and when a caterpillar walks past its front legs snap shut faster than you can blink. It is not bothered by the milkweed poison. Watch which leaf it is on, and use the other side of the plant.',
    simple: 'A mantis sits very still and grabs caterpillars that walk past. Use a different leaf!',
    more: YT('praying mantis catches caterpillar')
  },
  silk: {
    title: 'The silk lifeline',
    body: 'A frightened caterpillar can let go of the leaf and drop, paying out a silk thread behind it like a climber on a rope. When the danger has passed it climbs back up the thread. You just did that.',
    simple: 'You dropped on a silk rope to escape! Now climb back up.',
    more: YT('caterpillar drops on silk thread')
  },
  summer: {
    title: 'A summer monarch',
    body: 'You are not the super generation. A monarch born in spring or early summer lives just two to six weeks. It drinks nectar, finds a mate within days, lays its eggs on milkweed further north, and dies. Its job is to carry the relay one more leg.',
    simple: 'You are a summer monarch. You live a few weeks, lay eggs, and pass the journey on.',
    more: YT('monarch butterfly mating laying eggs')
  },
  mate: {
    title: 'Courtship',
    body: 'A male monarch spots a female, chases her in a spiral, and the pair sometimes flutter to the ground together. They may stay paired for hours. His scent pouches, the black dots on the hindwings, are thought to help, though monarchs use them less than their relatives do.',
    simple: 'The boy monarch chases the girl in a spiral. Then she can lay eggs.',
    more: YT('monarch butterflies mating')
  },
  eggs: {
    title: 'One egg per leaf',
    body: 'A female monarch tastes a leaf with her feet to make sure it is milkweed, then curls her body under it and glues a single egg to the underside. One egg per leaf, so each caterpillar has a leaf to itself. She can lay 300 to 500 eggs in her short life.',
    simple: 'Mum tastes the leaf with her feet, then sticks one egg under it. One egg per leaf!',
    more: YT('monarch laying egg on milkweed')
  },
  relay: {
    title: 'The relay',
    body: 'It takes three or four generations to get from Mexico back to Canada. Each summer generation flies a few hundred miles north, lays eggs and dies. The monarch that arrives in Ontario in June is the grandchild of one that left Mexico in March. And the one born there in August will fly the whole way back.',
    simple: 'It takes three or four monarch lives to get back north. Then a super generation flies all the way south again.',
    more: YT('monarch migration generations map')
  },
  texasmilkweed: {
    title: 'Antelope horns',
    body: 'The first milkweed a returning monarch finds is antelope-horns milkweed, a low sprawling plant of the Texas hills with greenish-white flowers that curl like horns. Its leaves are narrow and tough. Without it, the relay could not begin.',
    simple: 'This Texas milkweed has flowers like little horns. It is the first food of spring.',
    more: YT('antelope horns milkweed')
  },
  commonmilkweed: {
    title: 'Common milkweed',
    body: 'The big soft-leaved milkweed of the prairies and roadsides, with pink flower balls that smell of honey. Its leaves are wide enough for a fifth instar to sit on. Farmers used to pull it up; now many plant it on purpose.',
    simple: 'This milkweed has huge soft leaves and pink flower balls that smell sweet.',
    more: YT('common milkweed flowers')
  },
  swampmilkweed: {
    title: 'Swamp milkweed',
    body: 'Narrow leaves, rose-pink flowers, and it loves wet ground. Monarch mothers often prefer it to other milkweeds. It is the milkweed of the Great Lakes marshes where the super generation is born.',
    simple: 'This milkweed has pink flowers and grows near water. Monarch mums love it.',
    more: YT('swamp milkweed monarch')
  },
  coop: {
    title: 'Flying together',
    body: 'Monarchs do not fly in flocks the way geese do, but they do drift south in loose streams and gather in the same roosts each evening. Two monarchs leaving the same meadow often end up on the same mountain.',
    simple: 'Monarchs fly south near each other and sleep in the same trees.',
    more: YT('monarch migration swarm')
  },
  citizen: {
    title: 'You can help for real',
    body: 'Anyone can report monarchs they see to Journey North, tag monarchs with Monarch Watch, or count them in winter with the Western Monarch Count. And anyone with a pot of soil can plant milkweed.',
    simple: 'Real kids help scientists by counting monarchs and planting milkweed.',
    more: 'https://journeynorth.org/monarchs'
  }
});

Object.assign(HINTS, {
  tagged: ['A volunteer with a net! Hold still… it does not hurt.', '🏷️ Hold still for the scientist!'],
  pod: ['A ripe seed pod! Press SPACE next to it to burst it and catch the seeds.', '🌾 A seed pod! SPACE to pop it!'],
  laying: ['Time to lay eggs! Find a glowing leaf and press SPACE.', '🥚 Lay eggs! Go to a glowing leaf. Press SPACE.'],
  mate: ['Find the other monarch and press SPACE when you are close!', '💞 Find the other monarch! SPACE when close.'],
  summerAdult: ['SPACE to fly. Drink nectar, then find a mate.', '🦋 SPACE to fly! Drink nectar.'],
  bird: ['A BIRD! Dive, or get into a tree!', '🐦 BIRD! Dive or hide in a tree!'],
  spat: ['Spat out! You taste terrible. Keep going.', '🤢 Spat out! Keep going.'],
  mantisNear: ['A mantis on that leaf! Go the other way.', '🦗 Mantis! Go the other way.'],
  forecast: ['Roosting. Check tomorrow’s forecast, then fly at dawn or wait a day.', '🌤️ Check the forecast!'],
  waiting: ['Waiting for better weather… a day passes.', '⏳ Waiting a day…'],
  coopBehind: ['Player 2 is catching up!', '👋 Player 2 is catching up!'],
  fell: ['Dropped on a silk line! Crawl back up.', '🧵 Dropped on silk! Crawl back up.']
});
