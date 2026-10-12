/* ============================================================
   facts.js — the snakes, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the common garter
   snake (Thamnophis sirtalis), North America's most widespread
   snake, simplified for play.  Each fact has a full version, a
   "little words" version and a link to see the real thing (a
   Wikipedia page or a YouTube search, never a guessed video URL).
   Kid-safe: nothing is ever hurt.  What a snake eats is only ever
   "a snack" in play.
   ============================================================ */
'use strict';

/* Five real garter snakes.  back = the dark body between the stripes, stripe = the
   three long stripes, side = the bars or checks along the sides, belly, lip = the
   pale lip scales, eye */
const FORMS = {
  eastern: { name: 'Eastern garter snake', short: 'Eastern', latin: 'Thamnophis sirtalis sirtalis',
    back: '#3c4a2a', back2: '#232a18', stripe: '#f2d75a', side: '#1a1c12', check: '#14160e', belly: '#d8e0a0', lip: '#e8e2a8', eye: '#2a1c0c', iris: '#c8a040',
    blurb: 'The everyday garter snake of the eastern meadows: dark olive with three yellow stripes and a checkerboard of black spots.',
    simple: 'Three yellow stripes and black checks!', power: 'The most common snake in the east' },
  redsided: { name: 'Red-sided garter snake', short: 'Red-sided', latin: 'Thamnophis sirtalis parietalis',
    back: '#2a2e22', back2: '#16180f', stripe: '#e8d060', side: '#d8402a', check: '#121410', belly: '#c8d8b0', lip: '#e0dcb0', eye: '#1c120a', iris: '#c89040',
    blurb: 'Red bars run along its sides between the stripes. Red-sided garters live far north and meet in the biggest snake dens on Earth.',
    simple: 'Red bars on its sides! It lives far north.', power: 'The biggest dens on Earth' },
  blue: { name: 'Blue-striped garter snake', short: 'Blue-striped', latin: 'Thamnophis sirtalis similis',
    back: '#2c3a3e', back2: '#182226', stripe: '#7ab8e8', side: '#14202a', check: '#0e1418', belly: '#b8d0d8', lip: '#c8e0e8', eye: '#141a20', iris: '#a0b0b8',
    blurb: 'A rare garter snake from the Gulf coast of Florida, with pale blue stripes instead of yellow ones.',
    simple: 'Blue stripes! It lives in Florida.', power: 'Rare blue stripes' },
  black: { name: 'Black garter snake', short: 'Black', latin: 'Thamnophis sirtalis (melanistic)',
    back: '#1c1c1e', back2: '#0c0c0e', stripe: '#3a3a3e', side: '#141416', check: '#0a0a0c', belly: '#4a4a52', lip: '#e8e8e0', eye: '#0a0a0a', iris: '#8a8070',
    blurb: 'Some garter snakes near the Great Lakes are all black. Black skin soaks up sunshine fast, which helps in a cool place.',
    simple: 'All black! It warms up fast in the sun.', power: 'Warms up fastest' },
  sanfran: { name: 'San Francisco garter snake', short: 'San Francisco', latin: 'Thamnophis sirtalis tetrataenia',
    back: '#141414', back2: '#0a0a0a', stripe: '#3ad0d0', side: '#e0402a', check: '#0a0a0a', belly: '#9adada', lip: '#bfe8e8', eye: '#120a08', iris: '#d8603a',
    blurb: 'Turquoise, red and black: one of the most beautiful snakes in North America. It is very rare and protected by law.',
    simple: 'Blue-green, red and black! Very rare.', power: 'The rarest and most protected' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy garter snake', short: 'Boy', blurb: 'Boys are a little smaller, with a longer tail. In spring a boy follows a girl\'s scent trail to find her.', simple: 'Smaller, with a long tail. Follow the scent trail!' },
  girl: { name: 'Girl garter snake', short: 'Girl', blurb: 'Girls grow bigger. A girl carries her babies inside her all summer and gives birth to a whole litter.', simple: 'Bigger! She has a whole litter of babies.' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'newborn', name: 'Newborn', short: 'Newborn' },
  { key: 'baby', name: 'Baby snake', short: 'Baby' },
  { key: 'den', name: 'The winter den', short: 'Den' },
  { key: 'young', name: 'Young snake', short: 'Young' },
  { key: 'adult', name: 'Grown-up snake', short: 'Adult' },
  { key: 'parent', name: 'A new litter', short: 'Litter' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* per difficulty
   food:   snack to grow before each shed (first shed, second, third = grown up)
   cold:   how fast a snake cools down in the shade, at night and in the water
   blue:   how long the blue-eye days last before a shed (seconds hidden)
   rival:  how fast the other boys follow a girl's trail in the spring race
   pushes: good pushes for the girl's litter · visits: hawk, raccoon and heron come by
   board:  the scientist's coverboard · warm: the "just right" band of the warmth meter */
const DIFFICULTY = {
  easy:   { name: 'Little kid', food: [16, 40, 76], cold: .7, blue: 7, rival: .72, pushes: 3, visits: .5, board: false, warm: [.24, .9] },
  normal: { name: 'Big kid',    food: [24, 60, 110], cold: 1, blue: 9, rival: .86, pushes: 4, visits: 1, board: true, warm: [.3, .86] },
  hard:   { name: 'Scientist',  food: [32, 80, 140], cold: 1.25, blue: 11, rival: .98, pushes: 5, visits: 1.3, board: true, warm: [.34, .82] }
};
const BONUS = 1.5;      /* a grown-up snake may keep snacking to 150 % of the last threshold: a longer snake */

/* how long the snake is, in cm, from its sheds and its snacks.  A newborn garter snake
   is about 15–20 cm; grown-ups are about 50–65 cm, girls longer than boys. */
function snakeCM(instar, food, th, sex) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  const k = sex === 'girl' ? 1.08 : .94;
  if (instar <= 1) return lerp(17, 20, t(0, th[0]));
  if (instar === 2) return lerp(21, 31, t(th[0], th[1]));
  if (instar === 3) return lerp(33, 45, t(th[1], th[2])) * (1 + (k - 1) * .5);
  return lerp(48, 62, t(th[2], th[2] * BONUS)) * k;
}
/* a snake's drawn length in world units (stylised: a newborn is drawn bigger than life) */
function snakeUnits(cm) { return 30 + cm * 1.55; }

const FACTS = {
  born: { title: 'Born, not hatched', body: 'Garter snakes do not lay eggs. The mother carries her babies inside her all summer and gives birth to them in late summer, each one wrapped in a thin, clear bag.', simple: 'Baby garter snakes are born, not hatched!', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  litter: { title: 'A whole litter', body: 'A mother garter snake usually has about ten to forty babies at once. Big mothers can have even more. Every baby is a little snake, ready to go.', simple: 'Ten, twenty, even forty babies at once!', more: 'https://www.youtube.com/results?search_query=garter+snake+giving+birth' },
  own: { title: 'On their own from day one', body: 'Baby garter snakes look after themselves from the day they are born. Within minutes they wriggle out of their bags, flick their tongues and slither off into the grass.', simple: 'Baby snakes can look after themselves right away!', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  tongue: { title: 'Smelling with the tongue', body: 'A snake flicks its tongue to pick up tiny bits of smell from the air and the ground. It touches them to a special smelling place in the roof of its mouth, called the Jacobson\'s organ.', simple: 'A snake smells with its tongue!', more: 'https://en.wikipedia.org/wiki/Vomeronasal_organ' },
  fork: { title: 'Why the fork?', body: 'The two tips of the tongue pick up smells a little way apart. If one side smells stronger, the snake knows which way to turn. It is like smelling in stereo.', simple: 'Two tips tell it left from right!', more: 'https://en.wikipedia.org/wiki/Snake' },
  harmless: { title: 'A friendly snake', body: 'Garter snakes are harmless to people. A snake\'s tongue can not sting or hurt anybody: it is only for smelling. A garter snake would much rather slither away and hide.', simple: 'Garter snakes are harmless. The tongue only smells!', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  snack: { title: 'Snack time', body: 'In the wild, garter snakes eat small creatures such as earthworms and slugs, which they find by smell. In this game we just call it a snack.', simple: 'Snakes find their snacks by smell.', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  cold: { title: 'Cold-blooded', body: 'A snake can not make its own heat. Its body is as warm or as cool as the place it is in. So it moves into the sun to warm up, and into the shade to cool down.', simple: 'A snake warms up in the sun and cools down in the shade.', more: 'https://en.wikipedia.org/wiki/Ectotherm' },
  bask: { title: 'Basking', body: 'Snakes lie in the sun to warm up, which is called basking. A garter snake often flattens its body to catch more sunshine. A dark rock warms up fast and stays warm.', simple: 'Lying in the sun to warm up is called basking.', more: 'https://www.youtube.com/results?search_query=garter+snake+basking' },
  digest: { title: 'Warm tummy', body: 'A snake needs to be warm to turn its snacks into growing. After a snack, a garter snake spends more time basking.', simple: 'A snake must be warm to grow from its snacks.', more: 'https://en.wikipedia.org/wiki/Thermoregulation' },
  toohot: { title: 'Not too hot', body: 'Too much hot sun is not good for a snake either. On a hot afternoon a garter snake slides into the shade, or under a board or a log, to cool off.', simple: 'Too hot? Slide into the shade.', more: 'https://en.wikipedia.org/wiki/Thermoregulation' },
  cover: { title: 'Under boards and logs', body: 'Garter snakes love to hide under flat things: boards, logs, flat rocks and old sheets of metal. The sun warms the cover, and the snake stays snug and safe underneath.', simple: 'Snakes hide under boards, logs and rocks.', more: 'https://en.wikipedia.org/wiki/Cover_board' },
  eyelids: { title: 'No eyelids', body: 'Snakes have no eyelids. Each eye is covered by a clear scale called the spectacle, like a built-in pair of glasses. Snakes even sleep with their eyes open.', simple: 'No eyelids! A clear scale covers each eye.', more: 'https://en.wikipedia.org/wiki/Brille' },
  pupils: { title: 'Round pupils', body: 'Garter snakes have round pupils and good eyesight. They are out and about in the daytime, and are quick to spot something moving.', simple: 'Round pupils. They are out in the daytime.', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  blue: { title: 'Blue eyes', body: 'A few days before a shed, a milky liquid forms between the old skin and the new one. The snake\'s eyes go cloudy blue and it can not see well, so it hides until they clear.', simple: 'Before a shed, the eyes go cloudy blue!', more: 'https://en.wikipedia.org/wiki/Moulting' },
  shed: { title: 'Shedding the skin', body: 'A snake grows a new skin under the old one. It rubs its nose on something rough to split the old skin, then crawls out of it. The old skin peels off inside out, like pulling off a sock.', simple: 'The old skin peels off inside out, like a sock!', more: 'https://www.youtube.com/results?search_query=garter+snake+shedding+skin' },
  shedlength: { title: 'Longer than the snake', body: 'A shed skin is often longer than the snake that left it, because the thin skin stretches as it peels off.', simple: 'A shed skin is longer than the snake!', more: 'https://en.wikipedia.org/wiki/Moulting' },
  eyecaps: { title: 'Eye caps', body: 'Look at a shed skin closely and you can see the eye caps: the old clear spectacles came off with the skin. You can even see the shape of every scale.', simple: 'The old eye covers come off with the skin!', more: 'https://en.wikipedia.org/wiki/Brille' },
  often: { title: 'How often?', body: 'Young garter snakes grow fast and shed every few weeks. Grown-ups shed a few times a year. Snakes keep growing a little all their lives.', simple: 'Young snakes shed every few weeks!', more: 'https://en.wikipedia.org/wiki/Moulting' },
  scales: { title: 'Dry scales', body: 'A snake is covered in scales made of keratin, the same stuff as your fingernails. Snakes are dry and smooth to touch, not slimy. Each garter snake scale has a little ridge down the middle.', simple: 'Snake scales are dry, like your fingernails. Not slimy!', more: 'https://en.wikipedia.org/wiki/Snake_scale' },
  scutes: { title: 'Belly scales', body: 'Under its belly a snake has a row of wide scales called scutes. Their edges catch on the ground, which helps the snake push itself along.', simple: 'Wide belly scales help it grip the ground.', more: 'https://en.wikipedia.org/wiki/Ventral_scales' },
  slither: { title: 'How a snake slithers', body: 'A garter snake bends its body into wavy curves and pushes the curves against grass stems, stones and bumps. Each push sends it forwards. This is called serpentine movement.', simple: 'It wiggles its body into curves and pushes!', more: 'https://en.wikipedia.org/wiki/Undulatory_locomotion' },
  bones: { title: 'Hundreds of bones', body: 'A snake\'s backbone is made of hundreds of small bones, each with a pair of ribs. That is why it can bend and curl so easily.', simple: 'Hundreds of little backbones!', more: 'https://en.wikipedia.org/wiki/Snake_skeleton' },
  hearing: { title: 'Feeling sounds', body: 'Snakes have no outside ears. They feel vibrations through the ground with their bodies and jaws, so they know when footsteps are coming.', simple: 'No ears! Snakes feel footsteps through the ground.', more: 'https://en.wikipedia.org/wiki/Snake' },
  stripes: { title: 'Tricky stripes', body: 'Scientists think a garter snake\'s long stripes make it hard to tell how fast it is going, or whether it is moving at all. That can fool a hawk.', simple: 'Stripes make it hard to see how fast it goes!', more: 'https://en.wikipedia.org/wiki/Motion_dazzle' },
  name: { title: 'Why "garter"?', body: 'Long ago, people wore striped bands called garters to hold up their socks. The snake\'s stripes looked just like them.', simple: 'Its stripes look like old sock bands called garters!', more: 'https://en.wikipedia.org/wiki/Garter_snake' },
  widespread: { title: 'Everywhere!', body: 'The common garter snake lives in more of North America than any other snake, from Canada to Florida and from the Atlantic to the Pacific. It lives farther north than any other snake in North America.', simple: 'It lives all over North America!', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  musk: { title: 'Pee-yew!', body: 'When something grabs or bothers a garter snake, it can make a very stinky smell called musk. Most animals quickly leave it alone.', simple: 'A garter snake can make a stinky smell!', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  hawk: { title: 'Hawks', body: 'Red-tailed hawks circle high over fields with sharp eyes. When a snake sees a shadow pass over, it slips under cover and keeps still.', simple: 'A hawk circles high up. Hide and keep still!', more: 'https://en.wikipedia.org/wiki/Red-tailed_hawk' },
  raccoon: { title: 'Raccoons', body: 'Raccoons poke about at night with clever hands, looking for food in the grass and by ponds. A garter snake stays hidden, or makes its stinky musk.', simple: 'Raccoons poke about at night.', more: 'https://en.wikipedia.org/wiki/Raccoon' },
  heron: { title: 'The great blue heron', body: 'A great blue heron stands very still in shallow water, waiting. Snakes at the pond edge keep watch and slip away into the reeds.', simple: 'A tall bird stands still in the pond.', more: 'https://en.wikipedia.org/wiki/Great_blue_heron' },
  swim: { title: 'Good swimmers', body: 'Garter snakes swim well, with their heads held up above the water. They often live near ponds, streams and marshes.', simple: 'Garter snakes can swim!', more: 'https://www.youtube.com/results?search_query=garter+snake+swimming' },
  frogs: { title: 'Pond neighbours', body: 'Frogs, tadpoles, dragonflies and water striders all live around the pond. Frogs jump into the water with a plop when anything comes near.', simple: 'Frogs go plop into the pond!', more: 'https://en.wikipedia.org/wiki/Green_frog' },
  fireflies: { title: 'Fireflies', body: 'On summer nights, fireflies flash their lights to find each other. Each kind of firefly has its own flashing pattern.', simple: 'Fireflies flash to find each other.', more: 'https://en.wikipedia.org/wiki/Firefly' },
  scientist: { title: 'Snake scientists', body: 'Scientists who study reptiles are called herpetologists. They lay boards in fields, called coverboards, and check under them to count and measure the snakes. Then they let them go.', simple: 'Scientists count snakes under boards, then let them go.', more: 'https://en.wikipedia.org/wiki/Herpetology' },
  measure: { title: 'Measuring a snake', body: 'A scientist measures a snake from its nose to its vent, the opening under the tail where the tail begins. Weighing and measuring every year shows how fast snakes grow.', simple: 'Nose to tail, the scientist measures you!', more: 'https://en.wikipedia.org/wiki/Snout%E2%80%93vent_length' },
  trail: { title: 'Follow the trail', body: 'Snakes leave scent trails as they slither. In autumn, young garter snakes find the winter den by following the trails of older snakes.', simple: 'Young snakes follow scent trails to the winter den.', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  den: { title: 'The winter den', body: 'In autumn, garter snakes crawl into a deep crack in the rock, an old burrow or a hole under tree roots. A winter den is called a hibernaculum. Many snakes share one.', simple: 'Many snakes share a winter den deep in the rock.', more: 'https://en.wikipedia.org/wiki/Hibernaculum_(zoology)' },
  frost: { title: 'Below the frost line', body: 'In winter the top of the ground freezes. The den must reach below the frost line, deep down where it never freezes.', simple: 'Deep down, the ground never freezes.', more: 'https://en.wikipedia.org/wiki/Frost_line' },
  brumation: { title: 'The long winter rest', body: 'In the den, the snakes cool right down and hardly move. Their hearts beat very slowly, and they do not eat at all until spring. A reptile\'s winter rest is called brumation.', simple: 'All winter they rest and do not eat at all!', more: 'https://en.wikipedia.org/wiki/Brumation' },
  narcisse: { title: 'The biggest snake dens', body: 'At Narcisse, in Manitoba, Canada, tens of thousands of red-sided garter snakes share a few limestone dens. In spring the ground looks like it is moving!', simple: 'Tens of thousands of snakes in one place!', more: 'https://en.wikipedia.org/wiki/Narcisse_Snake_Dens' },
  emerge: { title: 'Spring!', body: 'When the spring sun warms the rocks, the garter snakes crawl out of the den and lie in the sunshine, often in big tangled heaps.', simple: 'In spring, the snakes come out to sunbathe.', more: 'https://www.youtube.com/results?search_query=garter+snakes+emerging+den+spring' },
  gathering: { title: 'The spring gathering', body: 'Boy garter snakes come out of the den first. When the girls come out, the boys follow their special scent. Sometimes dozens of boys gather around one girl!', simple: 'In spring, lots of boys follow a girl\'s scent.', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  sizes: { title: 'Big girls', body: 'Girl garter snakes grow bigger than boys. A big girl can be longer than your arm. Boys have longer tails for their size.', simple: 'Girls grow bigger than boys.', more: 'https://en.wikipedia.org/wiki/Sexual_dimorphism' },
  carry: { title: 'Carrying the babies', body: 'A mother garter snake carries her babies inside her for about two to three months. She basks a lot, because her warmth helps the babies grow.', simple: 'Mum basks in the sun to keep her babies warm.', more: 'https://en.wikipedia.org/wiki/Viviparity' },
  safeplace: { title: 'A safe place', body: 'When her babies are ready, a mother garter snake finds a hidden, sheltered spot, under a log or in thick grass, to give birth.', simple: 'Mum finds a hidden spot to have her babies.', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  grow: { title: 'Growing up', body: 'A garter snake is grown up after about two or three years, when it is big enough to have babies of its own.', simple: 'It takes two or three years to grow up.', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  colours: { title: 'Stripes of many colours', body: 'Common garter snakes come in many colours: yellow stripes, red sides, blue stripes, all black, or turquoise and red like the rare San Francisco garter snake.', simple: 'Yellow, red, blue, black or turquoise!', more: 'https://en.wikipedia.org/wiki/Common_garter_snake' },
  lips: { title: 'Lip scales', body: 'Look at a garter snake\'s face: the scales along its lips are pale, with little dark lines between them, like a smile.', simple: 'Pale lip scales, like a smile!', more: 'https://en.wikipedia.org/wiki/Snake_scale' },
  lifecycle: { title: 'The whole life cycle', body: 'Born in a clear bag in late summer, the first shed, the first winter in the den, two summers of growing and shedding, the spring gathering, and then a new litter in late summer.', simple: 'Born, shed, winter den, grow, a new litter… and again!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  newborn: ['You are a brand-new garter snake, curled up in a thin clear bag in the grass. Your mum just gave birth to you and your brothers and sisters!', 'I am a baby snake in a clear bag!'],
  wiggle: ['Push the arrows to wiggle and break out of your bag!', 'Wiggle! Break out!'],
  tongue: ['Press Space to flick your tongue. You smell with it! Snacks you smell will sparkle.', 'Press Space. Flick my tongue!'],
  smelled: ['You smelled a snack! Follow the sparkles and press Space to eat it.', 'A snack! Go and eat it.'],
  nothing: ['Nothing to smell here. Slither on and flick your tongue again.', 'Go on. Flick again!'],
  snack: ['Yum! A snack. Now bask in the sun so your warm tummy can turn it into growing.', 'Yum! Now get warm.'],
  belly: ['Your tummy is full. Warm up in the sun to grow from your snacks.', 'Full! Get warm in the sun.'],
  cold: ['Brr! You are cold and slow. Slither into the sunshine and bask.', 'Cold! Go in the sun.'],
  bask: ['Basking in the sun. Feel the warmth! A flat rock warms you fastest.', 'I bask in the sun. Warm!'],
  warm: ['Just right! Warm enough to slither fast and grow.', 'Just right!'],
  hot: ['Too hot! Slide into the shade, under a board or a log, to cool down.', 'Too hot! Go in the shade.'],
  chilled: ['Too cold to move! You curl up and wait for the warm sun.', 'Too cold. I curl up and wait.'],
  morning: ['The sun is up! Bask and warm up.', 'The sun! Warm up.'],
  hide: ['Push down at a board, log or rock to slide under it and hide.', 'Push down to hide under it!'],
  hidden: ['Safe and snug under cover.', 'I am hidden. Snug!'],
  out: ['Push left or right to slither out.', 'Go out!'],
  dash: ['Press E to dash! Your stripes make it hard to see how fast you go.', 'Press E to dash!'],
  hawk: ['A shadow! A hawk is circling. Hide under cover, or dash with E!', 'A hawk! Hide!'],
  missed: ['Whoosh! It missed. You are safe.', 'Whoosh! I am OK!'],
  dodged: ['Whoosh! Your stripes fooled it. Safe!', 'Whoosh! I got away!'],
  raccoon: ['A raccoon is poking about! Hide, or slither away.', 'A raccoon! Hide!'],
  musk: ['Pee-yew! You made a stinky smell. The raccoon walked away.', 'Pee-yew! It went away.'],
  heron: ['A heron is standing in the pond! Swim away or hide in the reeds.', 'A big bird! Swim away!'],
  pond: ['The pond! Swim with the arrows. The water is cool.', 'Swim! The water is cool.'],
  frog: ['Plop! The frog jumped into the pond.', 'Plop! A frog!'],
  tight: ['Your skin feels tight. You are growing! A new skin is coming.', 'My skin is tight!'],
  blue: ['Your eyes have gone cloudy blue! A new skin is coming. Hide under cover and rest until your eyes clear.', 'Blue eyes! Hide and rest.'],
  clear: ['Your eyes are clear again! Find something rough, a rock or a log, and press Space to rub your nose.', 'Rub my nose on a rock!'],
  rub: ['Rub, rub! Keep pressing Space to split the old skin at your nose.', 'Rub, rub, rub!'],
  peel: ['The old skin is loose! Slither forwards to crawl right out of it.', 'Slither out of my skin!'],
  shed: ['Out! You left your old skin behind, inside out. Look how bright your new colours are!', 'I am out! So bright!'],
  look: ['Your old skin! Press Space to look at it closely.', 'Look at my old skin!'],
  grow: ['Snack and bask to grow. Then you will shed again.', 'Eat and bask. Grow!'],
  autumn: ['Autumn! The days are cooler. Flick your tongue and follow the big snakes\' scent trail to the winter den on the rocky hill.', 'Autumn! Follow the trail to the den.'],
  trail: ['Follow the scent trail! Flick your tongue to see it.', 'Follow the trail!'],
  denmouth: ['The winter den! A deep crack in the rock. Push down to crawl in.', 'The den! Push down to go in.'],
  deeper: ['Crawl down, down, below the frost line where it never freezes.', 'Go down, down!'],
  winter: ['Winter. Rest in the den with all the other snakes until spring.', 'Winter. Rest…'],
  spring: ['Spring! The sun is warming the rocks. Crawl up and out of the den.', 'Spring! Go up and out!'],
  emerged: ['Out in the spring sunshine! Bask on the warm rocks, then go down to the meadow.', 'Out! Bask in the sun.'],
  meadow: ['Slither down to the meadow to find snacks.', 'Go to the meadow!'],
  board: ['A new board in the grass! It is warm under there. Push down to hide under it.', 'A new board! Hide under it.'],
  lifted: ['The board is lifted! A snake scientist counts you and measures you…', 'Up! She measures me.'],
  measured: ['Measured! She writes it down and puts you gently back. Thank you!', 'She puts me back!'],
  adult: ['You are grown up! Snack and bask, and wait for autumn.', 'I am grown up!'],
  gather: ['Spring! The boys came out of the den first. Wait for a girl to come out, then follow her scent trail. Keep flicking your tongue!', 'Wait for a girl. Follow her trail!'],
  race: ['Follow her trail! Flick your tongue with Space to stay on it, and slither fast.', 'Flick and follow!'],
  won: ['You found her first!', 'I found her!'],
  lost: ['Another boy found her first. Another girl is coming out. Try again!', 'Oh! Try again.'],
  girlout: ['Spring! The boys are waiting by the den. Go to one and press Space to say hello.', 'Go and say hi to a boy!'],
  meet: ['Press Space to say hello.', 'Say hi!'],
  carry: ['Babies are growing inside you! Go to the meadow and bask to keep them warm.', 'Bask! Keep my babies warm.'],
  carrywarm: ['Warm and cosy. The babies are growing.', 'Warm! The babies grow.'],
  ready: ['Late summer: your babies are ready! Find a log or board and push down to hide under it.', 'Find a log. Hide under it!'],
  birth: ['When the glow swells, press Space to push. Each push brings babies!', 'Glow! Press Space!'],
  babies: ['Your babies are wriggling out of their bags and slithering off into the grass. The cycle begins again!', 'My babies! Off they go!'],
  litterOut: ['Late summer… the girl you met has had her babies under a log! The cycle begins again.', 'Look! Little babies!'],
  done: ['Well done! You have seen a whole garter snake life.', 'All done!'],
  edge: ['That is the edge of the snakes\' world. Go back.', 'Go back!'],
  sibs: ['Your brothers and sisters are slithering off into the grass too.', 'Look! My brothers and sisters!'],
  notyet: ['Not yet! Snakes go into the winter den in autumn.', 'Not yet! The den is for winter.']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* how strong the sunshine is: 0 at night, 1 at noon */
function sunAmount(tod) { return clamp(Math.sin((tod - .25) / .55 * Math.PI), 0, 1); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
/* the seasons for the HUD: label, air temperature by day and by night (°C), sunshine strength */
const SEASON_INFO = { spring: ['🌱 Spring', 15, 3, .8], summer: ['☀️ Summer', 26, 15, 1], autumn: ['🍂 Autumn', 13, 2, .62], winter: ['❄️ Winter', -8, -18, .3] };
