/* ============================================================
   facts.js — ant species, colony stages, jobs, difficulty,
              seasons and the biology
   ============================================================
   Every fact has a full `body` and a `simple` version in short
   words for a child who is just learning to read, and a `more`
   link (a YouTube search or Wikipedia, never a guessed video).
   ============================================================ */
'use strict';

/* body colours for the side-view ant: head+thorax, gaster, legs, highlight */
const SPECIES = {
  garden: {
    key: 'garden', name: 'Black garden ant', short: 'Garden ant', latin: 'Lasius niger',
    head: '#2b2220', gaster: '#231c1a', legs: '#1a1413', hi: '#6a5a50', size: 1, spines: false, bigHead: false,
    special: 'farmer', power: 'Aphid farmer: every aphid gives you extra honeydew.',
    blurb: 'The little black ant of gardens and pavements. It is famous for farming aphids, and a queen can live for almost 30 years.',
    simple: 'The little black ant from the garden. It loves to farm aphids.',
    wiki: 'https://en.wikipedia.org/wiki/Lasius_niger'
  },
  wood: {
    key: 'wood', name: 'Red wood ant', short: 'Wood ant', latin: 'Formica rufa',
    head: '#9a3e1e', gaster: '#1f1715', legs: '#3a1e14', hi: '#d77a4a', size: 1.12, spines: false, bigHead: false,
    special: 'builder', power: 'Builder and fighter: digs faster and bites harder.',
    blurb: 'Builds huge mounds of pine needles in the forest, some taller than a grown-up. It squirts stinging formic acid at enemies.',
    simple: 'It builds giant ant hills in the woods and digs fast.',
    wiki: 'https://en.wikipedia.org/wiki/Formica_rufa'
  },
  leafcutter: {
    key: 'leafcutter', name: 'Leafcutter ant', short: 'Leafcutter', latin: 'Atta cephalotes',
    head: '#8e4a22', gaster: '#7a3f1d', legs: '#5a2e16', hi: '#d08a52', size: 1.05, spines: true, bigHead: true,
    special: 'gardener', power: 'Gardener: cut bits of leaf and carry them home as food.',
    blurb: 'From the rainforest. It cuts leaves, carries them home like little flags and feeds them to a fungus garden, then eats the fungus.',
    simple: 'It cuts leaves and grows a garden underground!',
    wiki: 'https://en.wikipedia.org/wiki/Leafcutter_ant'
  },
  harvester: {
    key: 'harvester', name: 'Red harvester ant', short: 'Harvester', latin: 'Pogonomyrmex barbatus',
    head: '#a2371f', gaster: '#8a2e1a', legs: '#5a1e12', hi: '#e07a5a', size: 1.1, spines: false, bigHead: true,
    special: 'seeds', power: 'Seed collector: seeds are worth twice as much.',
    blurb: 'Lives in deserts and grasslands and stores seeds underground in granaries, like a farmer\'s barn.',
    simple: 'It keeps seeds in a store room, like a farm barn.',
    wiki: 'https://en.wikipedia.org/wiki/Red_harvester_ant'
  },
  fire: {
    key: 'fire', name: 'Fire ant', short: 'Fire ant', latin: 'Solenopsis invicta',
    head: '#b8522a', gaster: '#3a1c12', legs: '#6a2e18', hi: '#f09060', size: .92, spines: false, bigHead: false,
    special: 'raft', power: 'Rafter: water does not slow you down.',
    blurb: 'Small, red and quick. In a flood, fire ants hold on to each other and float as a living raft. They sting, so never touch them!',
    simple: 'Small and red. In a flood they hold on and float like a raft!',
    wiki: 'https://en.wikipedia.org/wiki/Red_imported_fire_ant'
  }
};

/* the colony's life cycle (the wheel in the HUD); `at` is the number of workers */
const COLONY_STAGES = [
  { key: 'queen', name: 'A queen alone', short: 'Queen', at: 0 },
  { key: 'first', name: 'The first workers', short: 'First', at: 1 },
  { key: 'ten', name: 'Ten ants', short: '10', at: 10 },
  { key: 'hundred', name: 'One hundred ants', short: '100', at: 100 },
  { key: 'thousand', name: 'One thousand ants', short: '1,000', at: 1000 },
  { key: 'kingdom', name: 'An ant kingdom', short: '5,000', at: 5000 }
];

/* the division of labour */
const JOBS = {
  nurse: { key: 'nurse', name: 'Nurse', simple: 'Baby carer', emoji: '🍼', col: '#f7a8c4', blurb: 'Nurses feed the larvae, lick the eggs clean and carry the babies to the best room. Young ants start as nurses.', say: 'Nurses look after the babies.' },
  digger: { key: 'digger', name: 'Digger', simple: 'Digger', emoji: '⛏️', col: '#d9a86a', blurb: 'Diggers make the tunnels and rooms and carry every ball of dirt up to the ant hill.', say: 'Diggers make the tunnels.' },
  forager: { key: 'forager', name: 'Forager', simple: 'Food finder', emoji: '🌾', col: '#8fd75f', blurb: 'Foragers go outside to find seeds, crumbs and bugs and bring them home.', say: 'Foragers find food.' },
  farmer: { key: 'farmer', name: 'Farmer', simple: 'Aphid farmer', emoji: '🍯', col: '#ffd23f', blurb: 'Farmers look after the aphids on the plants and bring home sweet honeydew.', say: 'Farmers look after the aphids.' },
  guard: { key: 'guard', name: 'Guard', simple: 'Guard', emoji: '🛡️', col: '#ff7a6a', blurb: 'Guards watch the door and chase away the ladybug larva.', say: 'Guards keep the nest safe.' }
};
const JOB_KEYS = ['nurse', 'digger', 'forager', 'farmer', 'guard'];

const DIFFICULTY = {
  easy: { label: 'Little kid', dig: 1.7, pellets: false, enemy: false, enemyEvery: [160, 240], bites: 1, flood: .45, growth: 1.35, broodT: .7 },
  normal: { label: 'Big kid', dig: 1, pellets: true, enemy: true, enemyEvery: [90, 160], bites: 1, flood: 1, growth: 1, broodT: 1 },
  hard: { label: 'Scientist', dig: .78, pellets: true, enemy: true, enemyEvery: [55, 110], bites: 2, flood: 1.3, growth: .8, broodT: 1.2 }
};

/* the calendar: 4 days a season; a new kingdom starts in summer (flying-ant day) */
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const DAYS_PER_SEASON = 4;
const SEASON_INFO = {
  spring: { name: 'Spring', leafTint: ['#a8e07a', .35], rain: .45, food: 1, aphid: 1.2, lay: 1, blurb: 'The ants wake up, open the doors and the queen starts laying again.' },
  summer: { name: 'Summer', leafTint: ['#3f8a2e', 0], rain: .25, food: 1.2, aphid: 1, lay: 1.2, blurb: 'Warm days. The colony grows fast, and winged ants may fly.' },
  autumn: { name: 'Autumn', leafTint: ['#e0a030', .55], rain: .35, food: 1.3, aphid: .5, lay: .5, blurb: 'Seeds fall everywhere. The ants fill their food rooms before the cold.' },
  winter: { name: 'Winter', leafTint: ['#8a6a3a', .8], rain: 0, food: 0, aphid: 0, lay: 0, blurb: 'Too cold to go out. The whole colony rests deep underground until spring.' }
};

/* ---------- fact cards ---------- */
const YT = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const FACTS = {
  flight: {
    title: 'The wedding flight',
    body: 'On a warm, still day, often just after rain, young queens and males with wings fly out of their nests all at the same time. People call it flying-ant day. After the flight, each new queen lands and looks for a place to start a brand-new colony.',
    simple: 'On a warm day, young queens with wings fly out. Each one looks for a place to start a new home.',
    more: YT('flying ant day nuptial flight')
  },
  wings: {
    title: 'Off come the wings',
    body: 'A queen never flies again, so she snaps off her own wings. Her big flying muscles are not wasted: while she raises her first babies alone, her body slowly turns them into food.',
    simple: 'The queen pulls off her wings. She will never fly again. Her strong wing muscles become food for her babies.',
    more: YT('ant queen removing wings')
  },
  founding: {
    title: 'Digging in',
    body: 'The new queen digs a little room, seals the door behind her and stays inside for weeks without going out to eat. Scientists call this claustral founding. It keeps her safe while she is alone.',
    simple: 'The queen digs a little room and shuts the door. She stays inside for weeks!',
    more: YT('ant queen founding chamber')
  },
  eggs: {
    title: 'Ant eggs',
    body: 'Ant eggs are tiny, white and a little sticky, so the ants can carry a whole clump at once. A black garden ant queen can live for almost 30 years and lay a huge number of eggs.',
    simple: 'Ant eggs are tiny and sticky. A queen can live for almost 30 years!',
    more: YT('ant queen laying eggs')
  },
  larvae: {
    title: 'Ant babies',
    body: 'Ant larvae have no legs and no eyes. They look like little white grubs and they cannot do anything except eat and grow, so the adults feed them mouth to mouth.',
    simple: 'Ant babies are white grubs with no legs. The big ants feed them.',
    more: YT('ant larvae being fed')
  },
  cocoon: {
    title: 'The cocoon',
    body: 'When a larva is big enough, it spins a silk cocoon and changes inside, just like a caterpillar becomes a butterfly. The "ant eggs" sold as fish food are really these cocoons.',
    simple: 'The larva spins a cocoon and changes inside, like a butterfly does.',
    more: YT('ant pupa cocoon hatching')
  },
  nanitics: {
    title: 'The first workers',
    body: 'The very first workers are extra small, because the queen had only her own body to feed them. They are called nanitics, and they get straight to work finding food so the queen can lay more eggs.',
    simple: 'The first ants are tiny. They get right to work finding food!',
    more: YT('ant colony first workers nanitics')
  },
  sisters: {
    title: 'All sisters',
    body: 'Every worker in the colony is a daughter of the queen, so they are all sisters. Workers do not lay eggs of their own. Instead they work together to raise more sisters.',
    simple: 'All the worker ants are sisters. The queen is their mom.',
    more: 'https://en.wikipedia.org/wiki/Ant_colony'
  },
  jobs: {
    title: 'Everyone has a job',
    body: 'Ants share out the work. Young ants stay inside as nurses; older ants dig, guard and go out to forage. When the colony needs something, ants switch jobs. Nobody gives orders, not even the queen. This is called division of labour.',
    simple: 'Every ant has a job. Young ants look after the babies. Older ants go outside. Nobody is the boss!',
    more: YT('ant division of labor')
  },
  queen: {
    title: 'The queen is not a boss',
    body: 'The queen does not give orders. Her one job is laying eggs. The workers feed her, clean her and even carry her to safety if the nest floods.',
    simple: 'The queen does not boss anyone. Her job is to lay eggs.',
    more: YT('ant queen and workers')
  },
  honeydew: {
    title: 'Ant farmers',
    body: 'Aphids drink so much sugary sap that they squirt the extra out as sweet drops called honeydew. Ants stroke an aphid with their antennae to ask for a drop, like milking a cow, and in return they guard the aphids from ladybugs.',
    simple: 'Ants tap the aphids and get a sweet drop called honeydew. Then the ants keep the aphids safe.',
    more: YT('ants milking aphids honeydew')
  },
  crop: {
    title: 'A tummy for sharing',
    body: 'An ant has two stomachs. One is for itself. The other, the crop, is a shared stomach: ants carry food home in it and pass it mouth to mouth to their sisters. This is called trophallaxis.',
    simple: 'Ants have two tummies. One is for sharing! They pass food mouth to mouth.',
    more: YT('ant trophallaxis')
  },
  ladybug: {
    title: 'The ladybug larva',
    body: 'It looks like a tiny spiky alligator, and it eats aphids, about 400 before it grows up. Ants chase it away to protect their herds. (If you have played Ladybug Life, you have been that larva!)',
    simple: 'The ladybug larva eats aphids. The ants chase it away to keep their aphids safe.',
    more: YT('ants protecting aphids from ladybug')
  },
  pheromones: {
    title: 'Smell trails',
    body: 'Ants talk with smells called pheromones. A forager that finds food lays a scent trail on the way home, and her sisters follow it. The more ants use a trail, the stronger it smells.',
    simple: 'Ants talk with smells. They leave a smell trail to the food so others can follow.',
    more: YT('ant pheromone trail experiment')
  },
  teamwork: {
    title: 'Carrying together',
    body: 'One ant can lift many times its own weight, but a big beetle is too heavy even for an ant. So ants call their sisters and carry it together, pulling the same way. Scientists call this cooperative transport.',
    simple: 'Ants are super strong. For big food, they carry it together!',
    more: YT('ants carrying food together')
  },
  digging: {
    title: 'Ant engineers',
    body: 'Ants dig by biting out tiny balls of soil and carrying them up to the surface. The pile they make is the ant hill. They press the tunnel walls with their heads and spit so they do not fall in.',
    simple: 'Ants dig out little balls of dirt and carry them up. That makes the ant hill!',
    more: YT('ant farm digging tunnels time lapse')
  },
  sand: {
    title: 'Slippery sand',
    body: 'Dry sand grains roll and slide until a pile has a steady slope called the angle of repose. That is why dry sand castles fall down, and why ants pack their walls. Damp sand holds together much better.',
    simple: 'Dry sand slides and falls. Ants pat the walls to make them strong.',
    more: YT('angle of repose sand experiment')
  },
  clay: {
    title: 'Sticky clay',
    body: 'Clay is made of tiny flat grains that stick together. It is hard to dig, but tunnels in clay stay up for years, and water cannot soak through it, so puddles sit on top.',
    simple: 'Clay is hard to dig, but it is strong. Water can not go through it.',
    more: YT('clay vs sand water drainage experiment')
  },
  rain: {
    title: 'Rain in the nest!',
    body: 'Rain soaks into the soil and trickles down the tunnels. Water runs through sand fast but sits on clay. Ants carry the eggs and babies to dry rooms, and fire ants can even hold on to each other and float as a living raft.',
    simple: 'Rain! Water comes in. The ants carry the babies to a dry room.',
    more: YT('fire ant raft')
  },
  warmth: {
    title: 'Warm rooms, cool rooms',
    body: 'Rooms near the top warm up in the sun; deep rooms stay cool. Nurses carry the brood up and down during the day to keep the babies at just the right temperature.',
    simple: 'The top rooms are warm and the deep rooms are cool. Ants move the babies to the best room.',
    more: YT('ants moving brood')
  },
  mound: {
    title: 'The ant hill',
    body: 'Every single grain in an ant hill was carried up by an ant. Red wood ants build domes of pine needles taller than a person, with warm rooms inside.',
    simple: 'Every bit of the ant hill was carried up by an ant!',
    more: YT('red wood ant mound')
  },
  strong: {
    title: 'Super strong',
    body: 'Small animals are strong for their size, because their muscles are big compared with how heavy they are. That is why an ant can carry a seed bigger than its own head.',
    simple: 'Ants are super strong! They can carry a seed bigger than their head.',
    more: YT('ant carrying heavy object')
  },
  count: {
    title: 'How many ants?',
    body: 'A black garden ant colony can have 15,000 workers, and a leafcutter colony can have millions. Scientists think there are about 20 quadrillion ants on Earth: about 2 million ants for every person!',
    simple: 'There are about 2 million ants for every person on Earth!',
    more: 'https://en.wikipedia.org/wiki/Ant'
  },
  kingdom: {
    title: 'New queens',
    body: 'A big, grown-up colony starts raising winged princesses and males. On a warm day they fly away to start new colonies of their own, and the old colony carries on. Some colonies live for decades.',
    simple: 'A big colony makes new queens with wings. They fly away to make new kingdoms!',
    more: YT('winged ants leaving nest')
  },
  leafcutter: {
    title: 'Ant gardeners',
    body: 'Leafcutter ants do not eat leaves. They chew them up to feed a fungus garden underground, then eat the fungus. They were farmers millions of years before people.',
    simple: 'Leafcutter ants grow a garden! They feed leaves to a fungus, then eat the fungus.',
    more: YT('leafcutter ants fungus garden')
  },
  seeds: {
    title: 'Ants plant seeds',
    body: 'Some seeds carry a tasty snack called an elaiosome. Ants carry the seed home, eat the snack and throw the seed on their rubbish heap, where it can sprout. Harvester ants keep whole seeds in store rooms called granaries.',
    simple: 'Some seeds have a snack on them. Ants eat the snack and the seed can grow!',
    more: YT('ants carrying seeds elaiosome')
  },
  navigation: {
    title: 'Finding the way home',
    body: 'Some ants count their steps, and many use the sun like a compass. Desert ants can walk far from home and then march straight back.',
    simple: 'Some ants count their steps to find the way home!',
    more: YT('desert ant navigation step counting')
  },
  worm: {
    title: 'The earthworm',
    body: 'Earthworms tunnel through the soil eating dead leaves and dirt. Their tunnels let air and water in, which helps plants grow. They are harmless to ants and very good for the garden.',
    simple: 'Worms dig too! Their tunnels help the plants grow.',
    more: YT('earthworm tunnels soil')
  },
  winter: {
    title: 'Winter underground',
    body: 'In winter ants stop going out and gather deep underground, where the soil does not freeze. They slow right down and wait for spring, living on the food they stored.',
    simple: 'In winter ants go deep down where it is not so cold, and wait for spring.',
    more: YT('ants in winter underground')
  },
  spring: {
    title: 'Spring',
    body: 'The soil warms up, the ants wake, open the doors and go out for the first food of the year. The queen starts laying again.',
    simple: 'Spring! The ants wake up and the queen lays eggs again.',
    more: YT('ants spring nest')
  },
  summer: {
    title: 'Summer',
    body: 'Warm weather makes everything faster. The brood grows quickly, the aphids make lots of honeydew, and a big colony may send out winged ants.',
    simple: 'Summer! Everything grows fast.',
    more: YT('ant colony growth time lapse')
  },
  autumn: {
    title: 'Autumn',
    body: 'Seeds fall from the plants and the ants stock up their food rooms. The aphids lay tough eggs that will last through the winter.',
    simple: 'Autumn! Seeds fall. The ants fill up their food rooms.',
    more: YT('ants collecting seeds autumn')
  }
};

/* ---------- on-screen hints, in two reading levels: [full, simple] ---------- */
const HINTS = {
  dig: ['You are a new queen! Hold an arrow into the dirt (or tap the dirt) to dig a little room.', '⬇️ Push into the dirt to dig!'],
  deeper: ['Keep digging down. The room for your eggs must be deep and safe.', '⬇️ Dig deeper!'],
  layEggs: ['This is a good deep room. Press SPACE to lay your first eggs!', '🥚 Press SPACE to lay eggs!'],
  tend: ['Stay with your eggs and lick them clean with SPACE. They will hatch soon.', '🥚 Stay with your eggs.'],
  feedLarva: ['A larva is hungry! Go close and press SPACE to feed it.', '🍼 Feed the baby! Press SPACE.'],
  cocoon: ['The larvae are spinning cocoons. Your first workers are on the way!', '⏳ Wait… ants are coming!'],
  worker: ['You are now a worker ant! Climb up the tunnel and find food outside.', '🐜 You are a worker! Go up and find food.'],
  forage: ['Look for seeds and crumbs on the ground. Press SPACE to pick one up.', '🌾 Find food! Press SPACE to pick it up.'],
  carryHome: ['Carry it home: down the hole to the food room.', '🏠 Take it home!'],
  store: ['Press SPACE to put the food in the food room.', '🏠 Press SPACE to put it down.'],
  aphids: ['Climb the plant. Press SPACE next to an aphid to get sweet honeydew.', '🍯 Climb up! SPACE by an aphid.'],
  cropFull: ['Your crop is full of honeydew! Take it home and share it with a larva or the queen.', '🍯 Full! Take it home.'],
  enemy: ['A ladybug larva is eating your aphids! Go and press SPACE to bite it away.', '🐞 A larva! Go and bite it away!'],
  shooed: ['It ran away! The aphids are safe again.', '😅 It ran away!'],
  bigFood: ['That is too big for one ant. Press E to call your sisters to help!', '📣 Too big! Press E for help!'],
  dirt: ['Your jaws are full of dirt. Carry it up and out to the ant hill.', '⬆️ Take the dirt up and out!'],
  rain: ['Rain! Water is trickling in. Carry the babies to a dry room.', '🌧️ Rain! Save the babies!'],
  winter: ['Winter is here. The ants go deep down and rest until spring.', '❄️ Winter! Go deep down.'],
  sleeping: ['Zzz… the colony rests until spring.', '💤 Resting until spring…'],
  spring: ['Spring! The doors are open. Time to find food again.', '🌸 Spring! Go find food.'],
  summer: ['Summer! Lots of food and lots of honeydew.', '☀️ Summer! Lots of food.'],
  autumn: ['Autumn! Seeds are falling. Fill the food room before winter.', '🍂 Autumn! Get the seeds.'],
  room: ['The nest is full! Dig new rooms so the colony can grow.', '⛏️ We need room! Dig!'],
  hungry: ['The larvae are hungry. The colony needs food!', '🌾 We need food!'],
  help: ['Your sisters are coming to help!', '📣 Help is coming!'],
  kingdom: ['Your colony makes princesses with wings. Watch them fly!', '👑 New queens! Watch them fly!']
};
