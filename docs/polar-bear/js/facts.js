/* ============================================================
   facts.js — the bears, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the polar bear
   (Ursus maritimus, "the sea bear") on an Arctic coast where the
   sea ice melts away every summer (the way it does in Hudson Bay
   in Canada, and more and more in other places), simplified for
   play.  Each fact has a full version, a "little words" version
   and a link to see the real thing (a Wikipedia page, never a
   guessed video URL).
   ============================================================ */
'use strict';

/* Polar bears are all one kind of bear.  The coat looks different with
   the light, the season and the bear's age: bright white in a fresh
   coat, creamy in summer, golden in some older bears (oils from food
   and sunshine tint the clear hairs).  The skin underneath is black.
   fur / fur2 = coat light and shade, belly = the underside, mask = the
   face, nose = the black nose and lips */
const FORMS = {
  snow:  { name: 'Snow-white bear', short: 'White', latin: 'Ursus maritimus',
    fur: '#f6f7f2', fur2: '#c9cfd2', belly: '#eceee8', mask: '#fbfbf7', eye: '#2a1c14', nose: '#141012',
    blurb: 'A fresh new coat, as white as the snow. Each hair is really clear, not white: it scatters the light like snow does.',
    simple: 'White as snow!', power: 'Hard to see on the snow' },
  cream: { name: 'Creamy bear', short: 'Cream', latin: 'Ursus maritimus',
    fur: '#f3ead2', fur2: '#cfc1a0', belly: '#e9dcbc', mask: '#f8f0dc', eye: '#2a1c14', nose: '#141012',
    blurb: 'Lots of polar bears look creamy, especially in summer: sunshine and oils from their food tint the clear hairs a little yellow.',
    simple: 'A creamy coat, like vanilla ice cream!', power: 'The most common look in summer' },
  gold:  { name: 'Golden bear', short: 'Gold', latin: 'Ursus maritimus',
    fur: '#efdcae', fur2: '#c2a46e', belly: '#e2cc98', mask: '#f4e6c0', eye: '#2a1c14', nose: '#141012',
    blurb: 'Some bears, often older ones, look quite golden. It is the same kind of bear: just a well-worn coat full of oils.',
    simple: 'A golden coat!', power: 'Often an older bear\'s coat' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy bear', short: 'Boy', blurb: 'Boys grow huge: a big male can weigh over 500 kilograms. A grown male roams the sea ice and play-spars with other big males.', simple: 'He grows huge! He roams the ice.' },
  girl: { name: 'Girl bear', short: 'Girl', blurb: 'Girls are about half as heavy as the boys. A mother digs a snug den, has her cubs in midwinter and raises them for two and a half years.', simple: 'She digs a den and has cubs!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'newborn', name: 'Newborn cub', short: 'Newborn' },
  { key: 'cub', name: 'Cub', short: 'Cub' },
  { key: 'seacub', name: 'Cub on the ice', short: 'On the ice' },
  { key: 'yearling', name: 'Yearling', short: 'Yearling' },
  { key: 'young', name: 'Young bear', short: 'On my own' },
  { key: 'adult', name: 'Grown bear', short: 'Grown' },
  { key: 'parent', name: 'New cubs', short: 'New cubs' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much growing each step takes, per difficulty
   grow:   food to leave the den, to set off for the sea, to be a yearling, then a grown bear
   cold:   how fast a blizzard, icy water and the night use up a cub's warmth
   rival:  how hard the other bear pushes in a play-fight
   sniffs: good sniffs of the wind to find Mum in a whiteout (and to find a scent as a grown bear)
   still:  seconds of keeping still at a breathing hole before the seal comes up
   stalks: creeps up on a resting seal before Mum finds a meal
   look:   how often a resting seal lifts its head to look round (bigger = more often)
   nurses: feeds for the girl's own cubs · storms: blizzards come by themselves */
const DIFFICULTY = {
  easy:   { name: 'Little kid', grow: [10, 18, 44, 54], cold: .6, rival: .55, sniffs: 2, still: 3.5, stalks: 1, look: .7, nurses: 2, dig: 1.3, storms: false, swim: 1.25 },
  normal: { name: 'Big kid',    grow: [14, 26, 64, 76], cold: 1, rival: .8, sniffs: 3, still: 5, stalks: 1, look: 1, nurses: 3, dig: 1, storms: true, swim: 1 },
  hard:   { name: 'Scientist',  grow: [18, 34, 84, 96], cold: 1.3, rival: 1.05, sniffs: 4, still: 7, stalks: 2, look: 1.3, nurses: 3, dig: .85, storms: true, swim: .85 }
};
const BONUS = 1.3;      /* a grown bear may keep eating to 130 % of the grown-up threshold: a bigger bear */

/* how heavy a bear is, in kilograms, from its stage and its food
   (a newborn is about 600 grams, like a guinea pig; a big male can be 500 kg) */
function bearKG(age, food, th, sex) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  const boy = sex === 'boy';
  if (age <= 1) return lerp(.6, 11, t(0, th[0]));
  if (age === 2) return lerp(11, 15, t(th[0], th[1]));
  if (age === 3) return lerp(15, 60, t(th[1], th[2]));
  if (age === 4) return lerp(60, 150, t(th[2], th[3])) * (boy ? 1.15 : 1);
  return boy ? lerp(320, 480, t(th[3], th[3] * BONUS)) : lerp(170, 260, t(th[3], th[3] * BONUS));
}
/* a bear's drawn length (nose to tail) in world units, from its weight */
function bearUnits(kg) { return 10 + Math.pow(Math.max(.3, kg), .42) * 8; }

const FACTS = {
  den: { title: 'Born in a snow den', body: 'In autumn a mother polar bear digs a den deep in a snowdrift, or into a bank of peat, and the snow seals her in. Her cubs are born there in the middle of winter, in December or January.', simple: 'Cubs are born in a snow den in the middle of winter.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  blind: { title: 'Tiny and blind', body: 'A newborn polar bear cub weighs about 600 grams, like a guinea pig. Its eyes are shut, it has no teeth and its fur is thin and short. It can only wriggle, drink milk and sleep.', simple: 'A new cub is tiny. Its eyes are shut.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  twins: { title: 'Twins!', body: 'Most polar bear mothers have two cubs, twins. Sometimes there is one cub, and now and then three.', simple: 'Most mother bears have two cubs: twins!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  milk: { title: 'Rich milk', body: 'Polar bear milk is very rich: about a third of it is fat, much richer than a cow\'s. The cubs grow from 600 grams to about 10 kilograms before they ever leave the den.', simple: 'Bear milk is very rich. The cubs grow fast!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  hum: { title: 'Humming cubs', body: 'Bear cubs often make a soft, buzzing hum while they drink their mother\'s milk.', simple: 'Cubs hum while they drink. Mmmmm!', more: 'https://en.wikipedia.org/wiki/Bear' },
  fast: { title: 'Mum does not eat', body: 'All winter in the den the mother eats nothing and drinks nothing. She lives on her fat, sometimes for eight months, from the summer until she leads her cubs to the sea ice in spring.', simple: 'Mum eats nothing in the den. She lives on her fat.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  eyes: { title: 'Eyes open', body: 'A cub\'s eyes open at about one month old. By two months it can walk about inside the den.', simple: 'Cub eyes open after a month.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  out: { title: 'Out of the den', body: 'In March or April the mother breaks open the den. The cubs come out for the first time, weighing about ten to fifteen kilograms. For a week or two they stay near the den, getting used to the cold.', simple: 'In spring the cubs come out of the den for the first time.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  play: { title: 'Play is practice', body: 'Cubs wrestle, chase and roll in the snow. Play makes them strong, and it is how they learn to move, push and pounce.', simple: 'Cubs play all day. Play makes them strong.', more: 'https://en.wikipedia.org/wiki/Play_(activity)' },
  slide: { title: 'Snow slides', body: 'Polar bears, big and small, sometimes slide down snowy slopes on their bellies with their legs stretched out. It seems to be just for fun.', simple: 'Bears slide down snowy hills on their tummies!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  standup: { title: 'Stand up and sniff', body: 'A polar bear often stands up on its back legs, lifts its nose and sniffs the wind. Standing up tall helps it smell and see farther.', simple: 'Bears stand up tall to sniff the wind.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  nose: { title: 'A super nose', body: 'A polar bear can smell a seal nearly a kilometre away, even under a metre of snow. Its nose is one of the best in the animal world.', simple: 'A bear can smell a seal from very far away.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  fox: { title: 'The Arctic fox', body: 'Arctic foxes often follow polar bears across the sea ice, keeping a careful distance, like a little shadow. In winter the fox is white; in summer it turns brown and grey.', simple: 'An Arctic fox follows the bears. It is white in winter.', more: 'https://en.wikipedia.org/wiki/Arctic_fox' },
  tracks: { title: 'Reading tracks', body: 'A polar bear track can be 30 centimetres across, as wide as a dinner plate. An Arctic fox leaves neat little prints in a line, a hare\'s big back feet land in front of its front feet, and a ptarmigan leaves bird prints.', simple: 'Every animal leaves its own footprints in the snow.', more: 'https://en.wikipedia.org/wiki/Animal_track' },
  trek: { title: 'To the sea ice', body: 'After a week or two by the den, the mother leads her cubs on a long walk to the frozen sea. She has not eaten for months and is very hungry, so she stops often to let the cubs rest and drink.', simple: 'Mum leads the cubs on a long walk to the sea ice.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  blizzard: { title: 'Blizzards', body: 'In a blizzard, a polar bear lies down with its back to the wind, often in the lee of a rock or a ridge of ice, and lets the snow drift over it like a blanket.', simple: 'In a blizzard, bears curl up and let the snow cover them.', more: 'https://en.wikipedia.org/wiki/Blizzard' },
  caribou: { title: 'Caribou', body: 'Caribou cross the tundra in herds. Their wide hooves work like snowshoes and help them dig for food under the snow.', simple: 'Caribou walk across the snow in big herds.', more: 'https://en.wikipedia.org/wiki/Reindeer' },
  seaice: { title: 'The sea bear', body: 'The polar bear\'s Latin name, Ursus maritimus, means "sea bear". It needs the frozen sea: the sea ice is where it travels, rests and finds its food.', simple: 'Polar bears are sea bears. They need the sea ice.', more: 'https://en.wikipedia.org/wiki/Sea_ice' },
  holes: { title: 'Breathing holes', body: 'Seals swim under the sea ice all winter. They keep little breathing holes open by scratching at the ice with their claws, and come up to breathe now and then.', simple: 'Seals keep little holes in the ice to breathe.', more: 'https://en.wikipedia.org/wiki/Ringed_seal' },
  still: { title: 'Still-hunting', body: 'A polar bear can wait beside a breathing hole without moving, sometimes for hours. Most of the time the seal comes up somewhere else, or slips away, and the bear tries again another day.', simple: 'A bear waits very still by a seal hole. The seal mostly gets away.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  stalk: { title: 'The careful creep', body: 'In spring, seals lie on the ice in the sun and lift their heads to look around every little while. A bear creeps closer only while the seal\'s head is down, and freezes when it looks. Most of the time the seal slides back into its hole.', simple: 'Creep when the seal looks away. Freeze when it looks!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  meal: { title: 'Feast and famine', body: 'A polar bear may go days without a meal, then eat a huge amount at once. A mother shares her meals with her cubs, and then everyone sleeps it off.', simple: 'Bears eat a lot at once, then sleep it off.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  swim: { title: 'Strong swimmers', body: 'Polar bears paddle with their huge front paws and steer with their back legs. One mother bear was tracked swimming for nine days without stopping.', simple: 'Polar bears are great swimmers. They paddle with their front paws.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  ride: { title: 'A ride on Mum', body: 'Young cubs have little fat yet, and icy water chills them quickly. Sometimes a small cub rides on its mother\'s back as she swims.', simple: 'A little cub can ride on Mum\'s back in the water!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  lead: { title: 'Leads', body: 'A lead is a long crack of open water in the sea ice. The wind and the currents push the ice apart. Polar bears swim across them, and seals come up in them to breathe.', simple: 'A lead is a long crack of water in the ice.', more: 'https://en.wikipedia.org/wiki/Lead_(sea_ice)' },
  ridge: { title: 'Pressure ridges', body: 'Where the wind pushes slabs of sea ice together, they crack and pile up into long walls of ice blocks called pressure ridges. Snow drifts up behind them.', simple: 'Ice slabs push together and pile up into ice walls.', more: 'https://en.wikipedia.org/wiki/Pressure_ridge_(ice)' },
  fur: { title: 'Not really white', body: 'A polar bear\'s hairs are not white. Each long guard hair is clear, with a hollow-looking middle, and it scatters the light the way snow does, so the coat looks white.', simple: 'Each hair is clear, not white! It just looks white.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  skin: { title: 'Black skin', body: 'Under all that fur, a polar bear\'s skin is black. You can see it on its nose, its lips and the pads of its paws.', simple: 'Under the fur, a polar bear\'s skin is black!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  fat: { title: 'A coat of fat', body: 'Under the skin a grown polar bear has a layer of fat up to ten centimetres thick. Fat and fur keep it so warm that it is more likely to get too hot than too cold.', simple: 'A thick layer of fat keeps a bear warm.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  paws: { title: 'Snowshoe paws', body: 'A polar bear\'s paw can be 30 centimetres across. Big paws spread the bear\'s weight on thin ice and snow, paddle in the water, and have little bumps and fur on the soles so they do not slip.', simple: 'Huge paws for snow, ice and swimming.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  hot: { title: 'Too hot, not too cold', body: 'Polar bears get too hot more easily than too cold. They walk slowly, and on warm days they cool off with a swim or by lying flat on the ice.', simple: 'Polar bears can get too hot! They cool off in the water.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  breakup: { title: 'The ice melts', body: 'In summer the sea ice breaks into floes and melts. In some places, like Hudson Bay in Canada, it melts away completely, and the bears must swim to shore and wait on land until it freezes again.', simple: 'In summer the sea ice melts. The bears swim to land.', more: 'https://en.wikipedia.org/wiki/Sea_ice' },
  shore: { title: 'Waiting ashore', body: 'On land in summer, polar bears rest a lot and eat very little: maybe some kelp, grass or berries. They live on the fat they stored up on the ice. Scientists call it "walking hibernation".', simple: 'In summer the bears rest on land and wait for the ice.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  sun: { title: 'The midnight sun', body: 'Far in the north, in midsummer the sun never sets: it circles round the sky all night. In midwinter it does not rise at all for weeks: that is the polar night.', simple: 'In summer the sun shines all night!', more: 'https://en.wikipedia.org/wiki/Midnight_sun' },
  scientist: { title: 'Bear scientists', body: 'Scientists study polar bears from a safe distance, from helicopters and big tundra buggies. Some mother bears wear a radio collar so the scientists can follow where they go. Males cannot wear one: their necks are wider than their heads, so it would slip off!', simple: 'Scientists follow bears with radio collars, from a safe place.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  lemming: { title: 'Lemmings', body: 'Lemmings are small, round animals of the tundra. All winter they live in tunnels under the snow, and in summer they scurry between the grasses and dive into their burrows.', simple: 'Lemmings live in tunnels under the snow.', more: 'https://en.wikipedia.org/wiki/Lemming' },
  beluga: { title: 'White whales', body: 'Belugas are white whales. In summer thousands of them swim in the shallow water near the shore. They whistle, click and chirp so much that sailors called them sea canaries.', simple: 'Belugas are white whales that sing!', more: 'https://en.wikipedia.org/wiki/Beluga_whale' },
  aurora: { title: 'Northern lights', body: 'On dark autumn and winter nights, green curtains of light dance across the Arctic sky. They glow when tiny bits from the sun hit the air high above the Earth.', simple: 'The northern lights dance in the night sky.', more: 'https://en.wikipedia.org/wiki/Aurora' },
  freeze: { title: 'Freeze-up', body: 'In late autumn the sea starts to freeze again: first slush, then thin ice, then thick ice. Hungry bears wait at the edge of the shore and walk out onto the new ice as soon as it holds them.', simple: 'In autumn the sea freezes again. Back to the ice!', more: 'https://en.wikipedia.org/wiki/Sea_ice' },
  yearling: { title: 'Two and a half years', body: 'Polar bear cubs stay with their mother for about two and a half years. As yearlings they practise hunting next to her, and they still drink her milk.', simple: 'Cubs stay with Mum for two and a half years.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  leave: { title: 'On my own', body: 'In the spring when the cubs are about two and a half, the mother and her cubs go their separate ways. Each young bear wanders off to live on its own.', simple: 'At two and a half years old, a young bear goes off on its own.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  roam: { title: 'Wanderers of the ice', body: 'Grown polar bears mostly live alone and wander huge areas of sea ice, following the ice and the seals. Some walk thousands of kilometres in a year.', simple: 'Grown bears wander far and wide over the ice.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  spar: { title: 'Play-sparring', body: 'Young males and big males play-fight: they stand up on their back legs, push and wrestle with their mouths wide open. Nobody gets hurt. It is how they test their strength.', simple: 'Big boy bears stand up and play-fight. Nobody gets hurt.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  big: { title: 'The biggest bear', body: 'A big male polar bear can weigh 500 kilograms or more and stand three metres tall on his back legs. Polar bears and Kodiak brown bears are the biggest bears in the world.', simple: 'A big boy bear can be three metres tall!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  mate: { title: 'A walk together', body: 'In spring a male follows a female\'s scent trail across the ice. They walk together for a week or two, then each goes its own way. The mother raises the cubs on her own.', simple: 'In spring two grown bears walk together for a while.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  digden: { title: 'Digging the den', body: 'In autumn a mother-to-be goes ashore to dig her den: a tunnel and a round room, in a snowdrift or a bank of peat. Some dens in Canada have been used by bears for hundreds of years.', simple: 'A mother bear digs a den with a tunnel and a round room.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  home: { title: 'Back to the den hills', body: 'Mother bears often come back to dig their dens near the place where they were born.', simple: 'Mother bears often dig dens near where they were born.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  carry: { title: 'Carried home', body: 'If a tiny cub wanders off, a mother bear can pick it up very gently in her mouth and carry it back.', simple: 'Mum can carry a tiny cub in her mouth, very gently.', more: 'https://en.wikipedia.org/wiki/Bear' },
  teeth: { title: 'Forty-two teeth', body: 'A grown polar bear has 42 teeth. Cubs are born with none, and get their grown-up teeth during their first year.', simple: 'A grown polar bear has 42 teeth!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  nanuq: { title: 'Nanuq', body: 'The Inuit, who have lived in the Arctic for thousands of years, call the polar bear Nanuq. It is an animal of great respect in their stories.', simple: 'The Inuit call the polar bear Nanuq.', more: 'https://en.wikipedia.org/wiki/Inuit' },
  nosemyth: { title: 'Paw over the nose?', body: 'You may hear that a polar bear hides its black nose with a paw so seals cannot see it. Scientists have watched bears for many years and never seen it. It is just a story!', simple: 'Do bears hide their black noses? No, that is just a story!', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  warming: { title: 'Less ice', body: 'As the Arctic warms, the sea ice melts earlier in spring and freezes later in autumn, so polar bears have less time on the ice. Scientists and many people around the world are working to help them.', simple: 'The ice melts sooner now. People are working to help the bears.', more: 'https://en.wikipedia.org/wiki/Polar_bear' },
  lifecycle: { title: 'The whole life cycle', body: 'Newborn in a snow den, a cub sliding in the snow, a cub on the sea ice, a yearling, a young bear on its own, then a grown bear. A mother digs a den, and the story begins again. Polar bears can live for 25 years or more.', simple: 'Den, cub, sea ice, yearling, on my own, grown up, new cubs!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  born: ['You are a newborn polar bear cub in a snow den. You cannot see yet. Find your mum: she is warm.', 'I am a new cub. It is dark. Mum is warm.'],
  drink: ['Wriggle to your mum and press Space to drink her milk.', 'Go to Mum. Press Space to drink.'],
  eyes: ['Your eyes are open! Blue snow walls all round. Keep drinking and growing.', 'My eyes are open! Drink more.'],
  crawl: ['Wriggle with the arrows. Milk makes you grow. Hmmmm!', 'Wriggle! Drink milk!'],
  out: ['Spring! Mum has broken open the den. Climb up and out into the light.', 'Go out of the den!'],
  play: ['Your twin wants to play! Go to your twin and press Space.', 'Go and play!'],
  playfight: ['A play-fight! Tap Space to push. When the ring turns green, press E for a big push!', 'Tap Space! Green ring: E!'],
  won: ['You won the play-fight! A roll in the snow, nobody hurt.', 'I won! Roll, roll!'],
  lost: ['Rolled over in the snow! Up you get and play again.', 'Oops! Play again.'],
  sniffwind: ['Hold E to stand up on your back legs and sniff the wind.', 'Hold E to stand up and sniff!'],
  slide: ['A snowy slope! Face down the hill and press Space to slide on your tummy.', 'Press Space to slide!'],
  slid: ['Wheee! A belly slide all the way down.', 'Wheee!'],
  fox: ['An Arctic fox! It trots off when you come close. Foxes follow bears.', 'A fox! It trots away.'],
  nurse: ['Mum is lying down: time for milk! Go to her and press Space.', 'Mum is lying down. Drink!'],
  trek: ['Mum is leading you to the frozen sea. Follow her!', 'Follow Mum to the sea!'],
  follow: ['Keep up with Mum! Follow the arrow.', 'Follow the arrow!'],
  tracks: ['Footprints in the snow! Press Space to look. Who walked here?', 'Press Space to look!'],
  storm: ['A blizzard! Get into the lee of the big rock, out of the wind, and curl up.', 'A blizzard! Go to the rock!'],
  shelter: ['Snug in the lee of the rock. Let the snow drift over you like a blanket.', 'Snug and warm.'],
  cold: ['Brrr, you are getting cold! Snuggle up to Mum, or curl up and rest.', 'Cold! Curl up and rest.'],
  rest: ['You curled up tight with your nose tucked in until you were warm.', 'I had a warm rest.'],
  seaice: ['The sea ice! A whole frozen sea to walk on. Follow Mum out onto it.', 'The sea ice! Follow Mum.'],
  hole: ['A seal\'s breathing hole! Go next to it and press Space to wait.', 'A seal hole! Press Space to wait.'],
  still: ['Keep very still… do not press anything. The seal will come up to breathe.', 'Keep still! Do not move.'],
  shh: ['Shh! You moved. Keep very still.', 'Shh! Keep still.'],
  seal: ['Puff! The seal came up to breathe… and slipped away again. Seals are quick!', 'A seal! It got away.'],
  bask: ['A seal resting on the ice! Press Space to creep up on it.', 'A seal! Press Space to creep.'],
  creep: ['Creep closer while its head is down. Freeze when it looks up!', 'Creep! Stop when it looks!'],
  freezeNow: ['It is looking! Freeze!', 'Stop! It is looking!'],
  spotted: ['It saw you! Splash, it slid into its hole. Most hunts end like that.', 'It saw me! Splash!'],
  close: ['So close! But the seal slipped into its hole. Most hunts end like that.', 'So close! It got away.'],
  feast: ['Mum found a meal! Go and eat with her, then sleep it off.', 'Mum has a meal! Go and eat.'],
  ate: ['A big meal! You grew. Now a long sleep.', 'Yum! Now sleep.'],
  lostmum: ['A whiteout! Where is Mum? Hold E to stand up and sniff; let go when the ring is green.', 'Where is Mum? Hold E to sniff!'],
  found: ['You caught her scent! Mum chuffs and comes back for you.', 'I found Mum!'],
  breakup: ['Summer! The ice is breaking up. Follow Mum: swim from floe to floe to the shore.', 'Swim to the shore with Mum!'],
  swim: ['Swim! Paddle with your big front paws.', 'Swim, swim!'],
  lead: ['A lead: a long crack of water in the ice. Swim across!', 'Water! Swim across.'],
  shore: ['On the shore. The ice is gone, so the bears wait on land until it freezes again.', 'We wait on the land.'],
  scientist: ['Scientists in a tundra buggy! They watch bears from a safe place. Press Space to wave.', 'A buggy! Press Space to wave.'],
  pounce: ['A lemming! Creep up and press Space to pounce.', 'Press Space to pounce!'],
  away: ['It dived into its burrow! Most pounces miss. Try again.', 'It got away! Try again.'],
  sniff: ['A smell on the wind! Walk into it and press Space to sniff.', 'Press Space to sniff!'],
  aurora: ['Look up! The northern lights are dancing.', 'Look! The northern lights!'],
  freeze: ['The sea is freezing again! Soon the bears can walk out onto the ice.', 'The sea is freezing!'],
  yearling: ['One year old: a yearling. Back on the sea ice with Mum. Try it yourself now!', 'I am one! Back on the ice.'],
  solo: ['Find a breathing hole of your own and wait beside it, very still.', 'Find a hole and wait!'],
  practise: ['Now creep up on a resting seal, by yourself.', 'Creep up on a seal!'],
  mealtime: ['Mum found a meal! Go and eat.', 'Mum has a meal! Eat!'],
  leave: ['Two and a half years old. Mum walks off over the ice. You are big enough to go on your own.', 'Time to go on my own!'],
  alone: ['A young bear on your own. Head out across the ice, past the ice ridge.', 'Go on, over the ice!'],
  ridge: ['A pressure ridge: a wall of ice blocks. Climb over!', 'An ice wall! Climb over.'],
  sparring: ['Two young bears play-fighting! Go and join in: press Space.', 'Bears are playing! Press Space.'],
  grown: ['Years go by. You are a grown polar bear!', 'I am a big bear now!'],
  scent: ['Another bear\'s scent on the wind! Hold E to sniff, let go on green to follow it.', 'A smell! Hold E to sniff.'],
  meet: ['There is the other bear! Go and say hi: press Space.', 'A bear! Go and say hi.'],
  together: ['You walk together for a while across the ice.', 'We walk together.'],
  bigmale: ['A big male! Stand up and play-spar: press Space.', 'A big bear! Press Space to play.'],
  summer: ['Summer on the shore with the other big bears. Rest and wait for the ice.', 'Summer! Rest on the shore.'],
  denhill: ['Autumn. Go back to the den hills where you were born and dig a den in the bank.', 'Go to the hill! Dig a den.'],
  den: ['Push down on the soft peat bank to dig your den.', 'Dig a den! Push down.'],
  dig: ['Dig into the bank. A den needs a tunnel and a round room.', 'Dig, dig, dig!'],
  rock: ['Too hard to dig here! Find the soft peat bank.', 'Too hard! Dig in the soft bank.'],
  denready: ['Deep enough! Press Space to make the round room.', 'Press Space to make the den!'],
  outden: ['Push up to climb out of the den.', 'Push up to go out!'],
  inside: ['Midwinter. Your cubs are born! Tiny, blind and hungry. Press Space to feed them.', 'My cubs! Press Space to feed.'],
  nursecubs: ['Press Space to let the cubs drink.', 'Press Space to feed the cubs.'],
  wanderer: ['One cub wobbled up to the den mouth! Go and press Space to carry it back.', 'A cub got out! Go and get it.'],
  carrying: ['Carry the cub gently back to the round room.', 'Take the cub home.'],
  cubsout: ['Spring! You break open the den and the cubs tumble out into the light.', 'The cubs are out!'],
  firstsniff: ['Stand up with your cubs and hold E: their first sniff of the sea wind!', 'Hold E to sniff with the cubs!'],
  newcubs: ['New cubs in the snow! Newborn, cub, yearling, young bear, grown bear: the whole life of a polar bear.', 'New cubs! The whole life of a bear.'],
  toofar: ['Too far for a little cub! Stay near Mum.', 'Too far! Go back to Mum.'],
  twin: ['Your twin is here too.', 'My twin!'],
  night: ['Night. The stars are out over the snow.', 'Night! Look at the stars.']
};

/* ---------- the sky: polar night, ordinary days, the midnight sun ----------
   DAYLIGHT is set by the world's season: 'night' (midwinter: dark all day, a
   glow at noon), 'normal', 'midsun' (midsummer: the sun never sets). */
let DAYLIGHT = 'normal';
function setDaylight(mode) { DAYLIGHT = mode === 'night' || mode === 'midsun' ? mode : 'normal'; }
/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  let n;
  if (tod < .2) n = 1;
  else if (tod < .3) n = 1 - smoothstep(.2, .3, tod);
  else if (tod > .78) n = smoothstep(.78, .9, tod);
  else n = 0;
  if (DAYLIGHT === 'night') return clamp(.95 - .45 * Math.max(0, 1 - Math.abs(tod - .5) / .14), .5, 1);
  if (DAYLIGHT === 'midsun') return n * .14;
  return n;
}
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
const SEASONS = { spring: { name: 'Spring', emoji: '🌱' }, summer: { name: 'Summer', emoji: '☀️' }, autumn: { name: 'Autumn', emoji: '🍂' }, winter: { name: 'Winter', emoji: '❄️' } };
