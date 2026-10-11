/* ============================================================
   facts.js — the wolves, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the gray wolf
   (Canis lupus) as it lives in a northern-Rockies valley like
   Yellowstone, simplified for play.  Each fact has a full
   version, a "little words" version and a link to see the real
   thing (a Wikipedia page or a YouTube search, never a guessed
   video URL).
   ============================================================ */
'use strict';

/* Three colours of wolf.  Most are gray; in Yellowstone about half are
   black (a colour that came from dogs long ago); white wolves are rare
   in the valley and common in the Arctic.
   fur / fur2 = coat light and dark, belly = the pale underside, mask =
   the face markings, eye = a grown-up's amber eye, pupEye = a pup's blue */
const FORMS = {
  gray:  { name: 'Gray wolf', short: 'Gray', latin: 'Canis lupus',
    fur: '#8f8a7e', fur2: '#4e493f', belly: '#e8e2d2', mask: '#d8d2c2', eye: '#e0a428', pupEye: '#6aa8d8', nose: '#1a1612',
    blurb: 'The classic gray wolf: a grizzled coat of gray, tan and black, with a pale face and belly.',
    simple: 'Gray and tan, like a shadow in the trees!', power: 'The most common colour' },
  black: { name: 'Black wolf', short: 'Black', latin: 'Canis lupus (black phase)',
    fur: '#3a3632', fur2: '#17150f', belly: '#5c5650', mask: '#4c4640', eye: '#e0a428', pupEye: '#6aa8d8', nose: '#0a0806',
    blurb: 'About half the wolves in Yellowstone are black. The black colour came from dogs, thousands of years ago.',
    simple: 'A black wolf! Lots of valley wolves are black.', power: 'Common in the valley' },
  white: { name: 'White wolf', short: 'White', latin: 'Canis lupus (white phase)',
    fur: '#f0ece2', fur2: '#b8b2a4', belly: '#fffdf6', mask: '#f8f5ee', eye: '#e0a428', pupEye: '#6aa8d8', nose: '#2a2420',
    blurb: 'Rare in the valley, common in the far north: a white wolf is hard to see against the snow.',
    simple: 'A rare white wolf!', power: 'The rarest colour here' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy wolf', short: 'Boy', blurb: 'Boys grow a little bigger and heavier. As a father he brings food to the den and guards it.', simple: 'A bit bigger! He brings food to the den.' },
  girl: { name: 'Girl wolf', short: 'Girl', blurb: 'Girls are a little lighter. As a mother she has the pups in the den and feeds them milk.', simple: 'She has the pups in the den!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'newborn', name: 'Newborn pup', short: 'Newborn' },
  { key: 'pup', name: 'Pup', short: 'Pup' },
  { key: 'bigpup', name: 'Big pup', short: 'Big pup' },
  { key: 'yearling', name: 'Yearling', short: 'Yearling' },
  { key: 'lone', name: 'Lone wolf', short: 'Lone' },
  { key: 'adult', name: 'Adult wolf', short: 'Adult' },
  { key: 'parent', name: 'A new pack', short: 'Parent' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much growing each step takes, per difficulty
   grow: food to become a pup, a big pup, a yearling, then an adult
   cold: how fast the snow, the river and the night use up your warmth
   rival: how hard a litter-mate pushes in a play-fight
   howls: good howls to find the pack when you are lost (and to howl with your mate)
   chases: chases before the pack finds a meal · marks: scent posts to claim a territory
   meals: meals to bring to the den (boy) · nurses: feeds for the new pups (girl)
   storms: thunderstorms come · herds: the herds run when tested */
const DIFFICULTY = {
  easy:   { name: 'Little kid', grow: [10, 18, 44, 54], cold: .6, rival: .55, howls: 2, chases: 1, marks: 2, meals: 2, nurses: 2, dig: 1.3, storms: false, stamina: 1.4 },
  normal: { name: 'Big kid',    grow: [14, 26, 64, 76], cold: 1, rival: .8, howls: 3, chases: 2, marks: 3, meals: 3, nurses: 3, dig: 1, storms: true, stamina: 1 },
  hard:   { name: 'Scientist',  grow: [18, 34, 84, 96], cold: 1.3, rival: 1.05, howls: 4, chases: 2, marks: 3, meals: 3, nurses: 3, dig: .85, storms: true, stamina: .8 }
};
const BONUS = 1.3;      /* an adult may keep eating to 130 % of the adult threshold: a bigger wolf */

/* how heavy a wolf is, in kilograms, from its stage and its food
   (a newborn is about half a kilo; a big valley male about 50 kg) */
function wolfKG(age, food, th, sex) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  let kg;
  if (age <= 1) kg = lerp(.5, 2.4, t(0, th[0]));
  else if (age === 2) kg = lerp(2.6, 6, t(th[0], th[1]));
  else if (age === 3) kg = lerp(6, 26, t(th[1], th[2]));
  else if (age === 4) kg = lerp(27, 38, t(th[2], th[3]));
  else kg = lerp(38, 50, t(th[3], th[3] * BONUS));
  if (sex === 'boy' && age >= 3) kg *= 1.1;
  return kg;
}
/* a wolf's drawn length (nose to rump) in world units, from its weight */
function wolfUnits(kg) { return 12 + Math.sqrt(Math.max(.3, kg)) * 7.2; }

const FACTS = {
  den: { title: 'Born in a den', body: 'Wolf pups are born in a den: a tunnel dug into a hillside, often used for years. In the valley, most litters are born in April. A litter is usually four to six pups.', simple: 'Pups are born in a den dug into a hill.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  blind: { title: 'Blind and deaf', body: 'A newborn wolf pup weighs about half a kilogram. It is born blind and deaf, with dark fuzzy fur, and it can only wriggle, drink milk and sleep.', simple: 'A new pup can not see or hear yet. It drinks milk and sleeps.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  eyes: { title: 'Blue eyes', body: 'A pup\'s eyes open after about two weeks. They are blue at first and slowly turn amber or yellow over the next weeks.', simple: 'Pup eyes open after two weeks. They are blue, then they turn gold!', more: 'https://en.wikipedia.org/wiki/Wolf' },
  mum: { title: 'The mother', body: 'For the first weeks the mother hardly leaves the den. The father and the older brothers and sisters bring her food so she can stay with the pups.', simple: 'Mum stays with the pups. Dad brings her food.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  pack: { title: 'A pack is a family', body: 'A wolf pack is a family: the mother and father and their pups from this year and the last few years. Scientists used to talk about "alpha" wolves fighting to be boss, but that was from wolves kept together in pens. In the wild, the leaders are simply the parents.', simple: 'A pack is a family: mum, dad and the pups.', more: 'https://en.wikipedia.org/wiki/Pack_(canine)' },
  out: { title: 'Out of the den', body: 'At about three weeks the pups wobble out of the den for the first time. They play, pounce on each other and explore, but never far from the den mouth.', simple: 'At three weeks the pups come out to play.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  play: { title: 'Play is practice', body: 'Pups play tag, tug and pounce all day. Play is how they learn to run, chase and work together. A wolf asking to play drops its front legs down in a "play bow".', simple: 'Pups play all day. Play is how they learn.', more: 'https://en.wikipedia.org/wiki/Play_(activity)' },
  meal: { title: 'A meal brought home', body: 'Grown-up wolves carry food home for the pups inside themselves. When the pups lick the grown-up\'s mouth, it brings the meal back up for them. It is how wolf pups get their first meals after milk.', simple: 'The grown-ups bring a meal home for the pups.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  howl: { title: 'The howl', body: 'Wolves howl to find each other, to gather the pack, to say "this is our place" to other packs, and sometimes just because the others are howling. A pup\'s first howls are tiny yips.', simple: 'Wolves howl to find each other. Pups go yip!', more: 'https://en.wikipedia.org/wiki/Wolf_communication' },
  moon: { title: 'Not at the moon', body: 'Wolves do not really howl at the moon. They howl to each other, mostly at dusk, at dawn and at night, because that is when they are awake and on the move. A moon just happens to be up.', simple: 'Wolves howl to each other, not at the moon.', more: 'https://en.wikipedia.org/wiki/Wolf_communication' },
  raven: { title: 'Wolf birds', body: 'Ravens follow wolves everywhere. They even play with the pups, hopping just out of reach. Some people call ravens "wolf birds".', simple: 'Ravens follow wolves. They like to play with the pups!', more: 'https://en.wikipedia.org/wiki/Common_raven' },
  rendezvous: { title: 'The rendezvous site', body: 'At about eight weeks the pack moves the pups from the den to a rendezvous site: a meadow where the pups wait and play while the grown-ups go off to find food. A yearling often stays to babysit.', simple: 'In summer the pups wait in a meadow while the grown-ups find food.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  pounce: { title: 'Pounce!', body: 'Big pups practise on grasshoppers, voles and mice. They stalk, leap and pounce. Most of the time the little animal gets away, but every pounce is practice.', simple: 'Pups pounce on grasshoppers. Most of them hop away!', more: 'https://en.wikipedia.org/wiki/Wolf' },
  storm: { title: 'Summer storms', body: 'In the mountains, thunderstorms build up on hot summer afternoons. Wolves wait them out under the trees, then shake the rain off.', simple: 'Summer storms come in the afternoon. Wait under a tree!', more: 'https://en.wikipedia.org/wiki/Thunderstorm' },
  nose: { title: 'A nose that reads', body: 'A wolf\'s nose is far better than ours. A wolf can tell which animal walked by, how long ago, and whether it knows them, all from a sniff.', simple: 'A wolf can smell who walked by!', more: 'https://en.wikipedia.org/wiki/Olfaction' },
  tracks: { title: 'Reading tracks', body: 'Wolves and trackers read footprints. A wolf track is about as long as your hand, with four toes and claw marks. Elk and bison leave two-part hoof prints, a hare leaves big back feet in front of little front feet, and an otter leaves a slide in the snow.', simple: 'Every animal leaves its own footprints.', more: 'https://en.wikipedia.org/wiki/Animal_track' },
  travel: { title: 'On the move', body: 'By autumn the pups are nearly as big as the grown-ups and travel with the pack. A pack can walk 30 kilometres in a day, trotting one behind another.', simple: 'By autumn the pups travel with the pack, one behind another.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  river: { title: 'Wolves can swim', body: 'Wolves are good swimmers. They wade and swim across rivers, then shake themselves dry. In winter the rivers freeze and the pack walks across the ice.', simple: 'Wolves can swim across a river!', more: 'https://en.wikipedia.org/wiki/Wolf' },
  territory: { title: 'Our place', body: 'Each pack has a territory, often bigger than a whole city. The parents mark its edges with scent on rocks, logs and bushes, and howl to tell other packs to keep out.', simple: 'Each pack has its own place. They mark the edges with scent.', more: 'https://en.wikipedia.org/wiki/Territory_(animal)' },
  sound: { title: 'A howl travels', body: 'A howl can be heard from many kilometres away across open country. That is how a lost wolf finds its pack, and how two packs stay apart.', simple: 'A howl can be heard from far, far away.', more: 'https://en.wikipedia.org/wiki/Wolf_communication' },
  paws: { title: 'Snowshoe paws', body: 'A wolf\'s paws are big and its toes spread out, like snowshoes, so it does not sink as deep as a deer. Warm blood keeps its paws from freezing.', simple: 'Big paws spread out on the snow like snowshoes.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  trail: { title: 'Breaking trail', body: 'In deep snow a pack walks single file. The wolf in front breaks the trail, and the others step in its footprints to save energy. They take turns in front.', simple: 'In deep snow the pack walks in a line. The first wolf makes the trail.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  coat: { title: 'A winter coat', body: 'A wolf\'s winter coat has two layers: long guard hairs that shed snow, and thick soft underfur. A wolf can sleep curled up in the snow with its tail over its nose at forty degrees below zero.', simple: 'A thick winter coat keeps a wolf warm in the snow.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  elk: { title: 'Elk and bison', body: 'Elk and bison share the valley with the wolves. A bull elk weighs about 300 kilograms. A bison bull can weigh 900 kilograms: the biggest land animal in North America.', simple: 'Elk and bison are much bigger than a wolf.', more: 'https://en.wikipedia.org/wiki/Elk' },
  chase: { title: 'Most chases fail', body: 'The pack tests a herd by running at it. Healthy elk and bison are fast and strong, and most chases end with the herd getting away. The wolves try again another day.', simple: 'The pack runs at the herd. Most of the time the herd gets away.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  fast: { title: 'Fast and far', body: 'A wolf can sprint at up to about 60 kilometres an hour for a short burst, and trot for hours. A pack may travel 30 kilometres or more in a day.', simple: 'A wolf can run very fast, and trot all day.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  feast: { title: 'Feast and famine', body: 'Wolves may go days without a meal, then eat a huge amount at once. After a feast the whole pack sleeps it off, bellies full.', simple: 'Wolves eat a lot at once, then sleep it off.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  teeth: { title: 'Forty-two teeth', body: 'A grown wolf has 42 teeth. Pups are born without teeth and get their milk teeth in their first weeks, then their grown-up teeth by about six months old. You get yours much later, from about six years old.', simple: 'A grown-up wolf has 42 teeth!', more: 'https://en.wikipedia.org/wiki/Wolf' },
  biologist: { title: 'Wolf watchers', body: 'Scientists in the valley put radio collars on some wolves. With a big antenna they can hear which way a collared wolf is, and follow the packs without going near them.', simple: 'Scientists listen to radio collars to find the wolves.', more: 'https://en.wikipedia.org/wiki/Wildlife_radio_telemetry' },
  yellowstone: { title: 'Wolves came back', body: 'Wolves had been gone from Yellowstone for about 70 years. In 1995 and 1996, 31 wolves from Canada were brought to the park and set free. Today their great-great-grandpups live there.', simple: 'In 1995 wolves came back to Yellowstone.', more: 'https://en.wikipedia.org/wiki/History_of_wolves_in_Yellowstone' },
  yearling: { title: 'A yearling', body: 'A one-year-old wolf is a yearling. Yearlings help raise the next litter: they babysit the new pups, bring them food and play with them.', simple: 'A one-year-old wolf helps look after the new pups.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  disperse: { title: 'Leaving home', body: 'Most young wolves leave their family between one and three years old. A lone wolf may travel hundreds of kilometres to find a mate and an empty territory of its own.', simple: 'Young wolves leave home to find a mate and a place of their own.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  underpass: { title: 'A tunnel for animals', body: 'Roads cut through wild country. In some places people build tunnels under the road, or bridges over it, so that wolves, elk and bears can cross safely. Wolves learn to use them.', simple: 'People build tunnels under roads for animals.', more: 'https://en.wikipedia.org/wiki/Wildlife_crossing' },
  mate: { title: 'A pair for life', body: 'When two lone wolves meet and get on, they may stay together for life. They find a territory, mark it and howl together. The next spring they will be the parents of a brand-new pack.', simple: 'Two lone wolves meet. Now they are a pair!', more: 'https://en.wikipedia.org/wiki/Wolf' },
  tail: { title: 'Talking with tails', body: 'Wolves talk with their bodies. A tail held high means confident, a wagging tail means happy, a tucked tail means scared or sorry, and flat ears mean "I don\'t like this".', simple: 'A wag means happy. A tucked tail means sorry.', more: 'https://en.wikipedia.org/wiki/Wolf_communication' },
  digden: { title: 'Digging the den', body: 'In spring the pair digs a den into a dry hillside, or fixes up an old one. The tunnel can be several metres long, with a round room at the end just big enough for the mother and her pups.', simple: 'The pair digs a den into a hill, with a room at the end.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  father: { title: 'The father', body: 'While the mother stays in the den with the newborn pups, the father finds food, brings it back, and stands guard. Later he plays with the pups and teaches them everything they need to know.', simple: 'Dad brings food and keeps watch.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  milk: { title: 'Milk first', body: 'Newborn pups drink only milk for about three weeks. The mother lies in the den and the pups find her by smell and touch, since they cannot see yet.', simple: 'New pups drink milk. They find mum by smell.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  carry: { title: 'Carried home', body: 'If a pup wanders, the mother picks it up gently by the loose skin on its neck and carries it back. The pup goes still and lets her.', simple: 'Mum carries a pup by its neck, very gently.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  colour: { title: 'Gray, black or white', body: 'Wolves come in gray, black and white, and all the shades between. In Yellowstone about half are black. A pup\'s colour comes from its parents, and many wolves get paler as they get old.', simple: 'Wolves can be gray, black or white.', more: 'https://en.wikipedia.org/wiki/Wolf' },
  aspen: { title: 'Wolves and trees', body: 'After wolves came back to the valley there were fewer elk, and in some places young willows and aspens grew taller. Scientists still argue about how much of that was thanks to the wolves.', simple: 'Since the wolves came back, some young trees have grown taller.', more: 'https://en.wikipedia.org/wiki/History_of_wolves_in_Yellowstone' },
  lifecycle: { title: 'The whole life cycle', body: 'Newborn, pup, big pup, yearling, lone wolf, a pair with a territory, then parents with a den full of pups. A wild wolf may live more than ten years, and the pack it starts can last much longer.', simple: 'Pup, big pup, yearling, lone wolf, then a parent with new pups!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  born: ['You are a newborn wolf pup in a dark den. You cannot see yet. Find your mum by smell: she is warm.', 'I am a new pup. It is dark. Mum is warm.'],
  drink: ['Wriggle to your mum and press Space to drink her milk.', 'Go to Mum. Press Space to drink.'],
  eyes: ['Your eyes are open! Everything is blue and blurry. Keep drinking and growing.', 'My eyes are open! Drink more.'],
  crawl: ['Wriggle with the arrows. Milk makes you grow.', 'Wriggle! Drink milk!'],
  out: ['Three weeks old! Wobble out of the den into the light.', 'Go out of the den!'],
  play: ['Your brothers and sisters! Go to one and press Space to play.', 'Go and play!'],
  playfight: ['A play-fight! Tap Space to push. When the ring turns green, press E for a big pounce!', 'Tap Space! Green ring: E!'],
  won: ['You won the play-fight! Tails wagging, nobody hurt.', 'I won! Wag, wag!'],
  lost: ['Bowled over! Up you get and play again.', 'Oops! Play again.'],
  howl: ['Hold E to howl. Your first howl is only a tiny yip!', 'Hold E to howl!'],
  raven: ['A raven! It hops just out of reach. Ravens love wolves.', 'A raven! It hops away.'],
  meal: ['A grown-up is home with a meal! Go to it and press Space to eat.', 'Food is home! Press Space to eat.'],
  rendezvous: ['The pack moved you to a summer meadow. Pounce on grasshoppers and sniff everything!', 'A new place! Pounce and sniff!'],
  pounce: ['A grasshopper! Creep up and press Space to pounce.', 'Press Space to pounce!'],
  away: ['It hopped away! Most pounces miss. Try again.', 'It got away! Try again.'],
  sniff: ['A smell on the breeze! Walk into it and press Space to sniff.', 'Press Space to sniff!'],
  storm: ['Thunder! A summer storm. Get under a tree with the babysitter.', 'A storm! Go under a tree!'],
  shelter: ['Snug and dry under the branches.', 'Snug and dry.'],
  travel: ['Autumn. The pack is on the move: follow them, one behind another.', 'Follow the pack!'],
  follow: ['Keep up with the pack! Follow the arrow.', 'Follow the arrow!'],
  tracks: ['Footprints! Press Space to look at them. Who walked here?', 'Press Space to look!'],
  river: ['The river! Walk in and swim across. Shake when you get out.', 'Swim across the river!'],
  cold: ['Brrr, you are getting cold! Keep moving, or curl up and rest.', 'Cold! Curl up and rest.'],
  rest: ['You curled up with your tail over your nose until you were warm.', 'I had a warm rest.'],
  post: ['A scent post! The pack marks the edge of its territory here. Press Space to sniff it.', 'Press Space to sniff!'],
  mark: ['Press Space to leave your own scent. This is your place now.', 'Press Space to mark!'],
  lostpack: ['Where is the pack? Hold E to howl, and let go when the ring is green to match the chorus!', 'Lost! Hold E to howl!'],
  found: ['They answered! The pack is coming back for you.', 'They heard me!'],
  winter: ['Winter! Deep snow. Walk in the trail the lead wolf breaks.', 'Snow! Walk in the trail.'],
  trail: ['Off the trail the snow is deep and slow. Step in the pack\'s footprints.', 'Deep snow! Use the trail.'],
  herd: ['A herd! Go to the pack and press Space to test the herd.', 'Press Space to run at the herd!'],
  chase: ['Run! Hold right to chase. Watch your puff: let go to catch your breath.', 'Run, run, run!'],
  gotaway: ['They got away! Most chases do. The pack will try again another day.', 'They got away. Try again!'],
  feast: ['The pack found a meal. Everyone eats, then sleeps it off. You grew!', 'A feast! Eat and sleep.'],
  biologist: ['A wolf scientist with a radio antenna! She is listening for collared wolves. Press Space to say hi.', 'A scientist! Say hi!'],
  yearling: ['Spring! You are one year old: a yearling. There are new pups at the den.', 'I am one! New pups!'],
  babysit: ['Babysit the new pups: play with them and stay near the den.', 'Play with the pups!'],
  guard: ['Stay by the den while the grown-ups are away. Press Space at the den mouth to keep watch.', 'Press Space to keep watch.'],
  disperse: ['You are grown. It is time to leave the pack and find a place of your own. Head east, past the scent posts.', 'Time to go! Go this way.'],
  lone: ['A lone wolf now. Travel far: over the ridge and past the road.', 'Go far! Over the hill.'],
  road: ['A road! Never cross on top. Find the tunnel under it.', 'A road! Find the tunnel.'],
  underpass: ['The tunnel under the road: made just for animals like you.', 'A tunnel for animals!'],
  mate: ['Another lone wolf! Go to it and press Space to say hi.', 'A wolf! Go and say hi.'],
  pair: ['You are a pair! Find a territory: mark the scent posts in the new valley.', 'We are a pair! Mark the posts.'],
  duet: ['Howl together! Hold E and let go on green.', 'Howl together! Hold E.'],
  claimed: ['This valley is yours. Winter is coming: rest, and in spring, dig a den.', 'Our valley! Sleep till spring.'],
  den: ['Spring! Dig a den into the soft hillside: push down.', 'Dig a den! Push down.'],
  dig: ['Dig into the hill. A den needs a long tunnel and a round room.', 'Dig, dig, dig!'],
  rock: ['Too hard to dig here! Find soft soil.', 'Too hard! Dig in the soil.'],
  deeper: ['Dig a little deeper for the pups\' room.', 'Dig more!'],
  denready: ['Deep enough! Press Space to finish the den.', 'Press Space to finish the den!'],
  outden: ['Push up to climb out of the den.', 'Push up to go out!'],
  bring: ['Your mate is in the den with the pups. Bring food home: follow the arrow, press Space to pick it up.', 'Bring food! Follow the arrow.'],
  carry: ['Carry it back to the den and press Space to give it.', 'Take it to the den!'],
  given: ['Given! She ate it up. More, please.', 'Yum! More, please.'],
  guardden: ['A raven at the den mouth! Go there and press Space to bark it away.', 'A raven! Bark!'],
  shooed: ['It flapped off, quite unhurt. The den is safe.', 'It flew away.'],
  pupsout: ['The first pups are coming out of the den! Your pack is a family now.', 'The pups are out!'],
  inside: ['Your pups are born! Blind, deaf and hungry. Press Space to feed them milk.', 'My pups! Press Space to feed.'],
  nurse: ['Press Space to let the pups drink.', 'Press Space to feed the pups.'],
  wanderer: ['One pup wobbled out to the den mouth! Go and press Space to carry it back.', 'A pup got out! Go and get it.'],
  carrying: ['Carry the pup gently back to the den and press Space to put it down.', 'Take the pup home.'],
  firsthowl: ['Come out with the pups and hold E. Their first howl!', 'Hold E to howl with the pups!'],
  newpack: ['A new pack is born! Pup, big pup, yearling, lone wolf, parent: the whole life of a wolf.', 'A new pack! The whole life of a wolf.'],
  toodeep: ['The river is deep here! Swim straight across.', 'Deep! Swim across.'],
  friend: ['Your brothers and sisters are here too.', 'My brothers and sisters!'],
  toofar: ['Too far for a little pup! Stay near the den.', 'Too far! Go back to the den.'],
  toofar: ['Too far for a little pup! Stay near the den.', 'Too far! Go back to the den.'],
  night: ['Night. Wolves are wide awake at night.', 'Night! Wolves are up at night.']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
const SEASONS = { spring: { name: 'Spring', emoji: '🌱' }, summer: { name: 'Summer', emoji: '☀️' }, autumn: { name: 'Autumn', emoji: '🍂' }, winter: { name: 'Winter', emoji: '❄️' } };
