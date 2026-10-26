/* ============================================================
   facts.js — the octopuses, the life stages, the facts, the hints
   ============================================================
   Everything here is real natural history of the giant Pacific
   octopus (Enteroctopus dofleini) in the Salish Sea (Puget Sound),
   simplified for play.  Each fact has a full version, a "little
   words" version and a link to see the real thing (a Wikipedia page
   or a YouTube search, never a guessed video URL).
   ============================================================ */
'use strict';

/* Five resting looks of a giant Pacific octopus.  An octopus can change colour in a
   blink, but each one has a colour it rests in: the everyday rust red-brown, a deep
   brick red, a dusky maroon, a pale pearl (an octopus resting calm and pale), and a
   tan freckled with dark spots.  skin / skin2 = mantle light and dark, under = the
   sucker side of the arms, sucker = the sucker rims, arm = arm tone, eye, spots */
const FORMS = {
  normal:  { name: 'Rust octopus', short: 'Rust', latin: 'Enteroctopus dofleini',
    skin: '#a8502c', skin2: '#5a2412', under: '#d8b088', sucker: '#f0d8b8', arm: '#9a4a2a', eye: '#120c08', spots: '#3a1a10',
    blurb: 'The everyday giant Pacific octopus rests a warm rust red-brown, the colour of the rocks it lives among.',
    simple: 'Rust red, like the rocks!', power: 'The most common look' },
  brick:   { name: 'Brick octopus', short: 'Brick', latin: 'Enteroctopus dofleini (brick red)',
    skin: '#b83a28', skin2: '#5a1410', under: '#e0a888', sucker: '#f4d0b0', arm: '#a8301e', eye: '#120c08', spots: '#4a1208',
    blurb: 'Some octopuses rest a deep brick red. Red looks black in deep water, so it is a good colour for hiding.',
    simple: 'Deep brick red!', power: 'Dark in deep water' },
  dusk:    { name: 'Dusk octopus', short: 'Dusk', latin: 'Enteroctopus dofleini (maroon)',
    skin: '#6a2a3a', skin2: '#2a0e18', under: '#b89098', sucker: '#e8d0d0', arm: '#5a2232', eye: '#0a0a14', spots: '#1a0810',
    blurb: 'A dusky maroon octopus, almost purple, the colour of the reef at dusk.',
    simple: 'Dark like dusk!', power: 'Hard to see at night' },
  pearl:   { name: 'Pearl octopus', short: 'Pearl', latin: 'Enteroctopus dofleini (pale)',
    skin: '#e8c8b8', skin2: '#a87868', under: '#f8ece0', sucker: '#fff4ea', arm: '#d8b0a0', eye: '#1a1410', spots: '#b06858',
    blurb: 'A calm octopus turns pale, almost white. This one rests pearl pink, and flushes dark when it is excited.',
    simple: 'Pale like a pearl!', power: 'Calm and pale' },
  freckle: { name: 'Freckle octopus', short: 'Freckle', latin: 'Enteroctopus dofleini (mottled)',
    skin: '#c8905a', skin2: '#5a3018', under: '#ecd0a8', sucker: '#f8e8d0', arm: '#b07a48', eye: '#120c08', spots: '#3a1c10',
    blurb: 'A tan octopus freckled with dark spots, like a sandy sea floor with pebbles on it.',
    simple: 'Tan with freckles!', power: 'Hides on sand' }
};
const FORM_KEYS = Object.keys(FORMS);
const SEXES = {
  boy:  { name: 'Boy octopus', short: 'Boy', blurb: 'A boy has one special arm with a spoon-shaped tip, to hand over the gift. A boy wrestles arm to arm for the best den on the reef.', simple: 'A special arm! Wrestle for the best den.' },
  girl: { name: 'Girl octopus', short: 'Girl', blurb: 'A girl lays thousands of eggs in strings in her den and tends them for months, grooming them and blowing fresh water over them.', simple: 'She hangs her eggs in her den and looks after them!' }
};

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'Egg', short: 'Egg' },
  { key: 'larva', name: 'Paralarva', short: 'Paralarva' },
  { key: 'postlarva', name: 'Settler', short: 'Settler' },
  { key: 'juvenile', name: 'Den years', short: 'Little' },
  { key: 'young', name: 'Young octopus', short: 'Young' },
  { key: 'adult', name: 'Giant octopus', short: 'Giant' },
  { key: 'walk', name: 'Down to the deep', short: 'Deep' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* how much food each step takes, per difficulty
   larva: plankton to grow to paralarva II, III, then to settle
   grow:  bottom food to grow (a sleep in the den) into a young octopus, a bigger one, then a giant
   risk:  how fast an exposed octopus's hiding meter drains (blending in slows it)
   rival: how hard a rival pushes in a wrestle · pot: the crabber's pot visits
   wins: rivals beaten to be the big octopus of the reef · blows: good blows to send the babies off
   dig: digging power · fish: the hunters come (easy: fewer) */
const DIFFICULTY = {
  easy:   { name: 'Little kid', larva: [20, 46, 80], grow: [30, 80, 160], risk: .5, rival: .55, pot: false, wins: 1, blows: 3, dig: 1.3, fish: false },
  normal: { name: 'Big kid',    larva: [30, 70, 120], grow: [50, 130, 250], risk: 1, rival: .8, pot: true, wins: 2, blows: 4, dig: 1, fish: true },
  hard:   { name: 'Scientist',  larva: [40, 90, 150], grow: [70, 170, 320], risk: 1.3, rival: 1.05, pot: true, wins: 3, blows: 5, dig: .85, fish: true }
};
const BONUS = 1.5;      /* a giant may keep eating to 150 % of the adult threshold: a bigger octopus */

/* how long an octopus's mantle (the body bag behind the head) is, in cm, from its growth
   step and its food.  A new settler is about half a centimetre; a giant Pacific octopus
   grows to a mantle of 40 cm and more, with arms spanning 4 metres. */
function octCM(instar, food, th) {
  const t = (a, b) => clamp((food - a) / Math.max(1, b - a), 0, 1);
  if (instar <= 1) return lerp(.5, 1.6, t(0, th[0]));
  if (instar === 2) return lerp(2.2, 6.5, t(th[0], th[1]));
  if (instar === 3) return lerp(8, 18, t(th[1], th[2]));
  return lerp(22, 46, t(th[2], th[2] * BONUS));
}
/* an octopus's drawn reach in world units, arm tips to the back of the mantle (stylised: a
   tiny settler is drawn bigger than life, so a child can see it beside its boulder) */
function octUnits(cm) { return 14 + cm * 1.55; }
/* mantle length → arm span, as a rough real-world figure (cm) */
function armSpanCM(cm) { return cm * 8.5; }

const FACTS = {
  egg: { title: 'Eggs in strings', body: 'A mother octopus lays about fifty thousand eggs, each the size of a grain of rice, and glues them into strings that hang from the roof of her den like bunches of tiny grapes.', simple: 'Mum hangs thousands of eggs in her den, like tiny grapes!', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  tend: { title: 'Tending the eggs', body: 'For about six months the mother never leaves her eggs. She strokes them clean with her suckers and blows fresh water over them with her siphon so they can breathe.', simple: 'Mum cleans her eggs and blows water on them for months!', more: 'https://www.youtube.com/results?search_query=giant+pacific+octopus+mother+eggs+den' },
  hatch: { title: 'Hatching at night', body: 'The eggs hatch at night, a few at a time, night after night. The mother puffs water over them and the babies jet up towards the surface.', simple: 'At night the babies hatch and jet up!', more: 'https://www.youtube.com/results?search_query=octopus+eggs+hatching' },
  larva: { title: 'A paralarva', body: 'A newly hatched octopus is a paralarva: a see-through baby the size of a grain of rice, with eight tiny arms and big eyes. It drifts near the surface as part of the plankton.', simple: 'A baby octopus is tiny and see-through!', more: 'https://en.wikipedia.org/wiki/Paralarva' },
  plankton: { title: 'Plankton', body: 'Plankton are the tiny living things that drift in the sea. A baby octopus is a hunter even now: it eats copepods, krill and the larvae of crabs.', simple: 'Tiny drifting animals. A baby octopus hunts them!', more: 'https://en.wikipedia.org/wiki/Plankton' },
  copepod: { title: 'Copepods', body: 'Copepods are tiny shrimp-like animals with one red eye. They are some of the most common animals on Earth, and baby octopuses love to eat them.', simple: 'Tiny jumpy shrimps. Yum!', more: 'https://en.wikipedia.org/wiki/Copepod' },
  krill: { title: 'Krill', body: 'Krill are little see-through shrimps that swarm in the cold water of Puget Sound. Fish, birds and whales eat them, and so do baby octopuses.', simple: 'Little see-through shrimps. Everybody eats them!', more: 'https://en.wikipedia.org/wiki/Krill' },
  zoea: { title: 'Baby crabs', body: 'A crab larva is called a zoea. It has a spike on its head and jumps away when something comes near. It is a bigger meal than a copepod, if you can catch it.', simple: 'A baby crab! It jumps. Catch it!', more: 'https://en.wikipedia.org/wiki/Crab_larva' },
  nogrow: { title: 'No shell to shed', body: 'A crab or a lobster must moult to grow, but an octopus has no shell at all. It just keeps growing, a little every day, as long as it eats.', simple: 'An octopus has no shell. It just grows and grows!', more: 'https://en.wikipedia.org/wiki/Octopus' },
  updown: { title: 'Up at night, down by day', body: 'Every night, plankton all over the world rise towards the surface to feed, and every morning they sink back down where it is darker. It is the biggest daily journey of animals on Earth.', simple: 'Plankton swim up at night and down in the day!', more: 'https://en.wikipedia.org/wiki/Diel_vertical_migration' },
  glow: { title: 'Glowing sea', body: 'Some plankton flash blue light when something bumps them. This is called bioluminescence. On dark nights in Puget Sound a paddle or a boat\'s wake can sparkle with it.', simple: 'Some plankton glow blue when you bump them!', more: 'https://en.wikipedia.org/wiki/Bioluminescence' },
  herring: { title: 'Herring', body: 'Pacific herring swim in huge silver schools and eat plankton. A baby octopus jets away and blends with the water, so it is hard to catch.', simple: 'Silver fish that eat plankton. Jet away!', more: 'https://en.wikipedia.org/wiki/Pacific_herring' },
  combjelly: { title: 'Comb jellies', body: 'A comb jelly is a see-through blob with eight rows of tiny beating hairs that shimmer like a rainbow. It has no sting, but it eats tiny drifting animals, so a paralarva keeps away.', simple: 'A see-through blob with rainbow lights. Keep away!', more: 'https://en.wikipedia.org/wiki/Ctenophora' },
  whale: { title: 'The grey whale', body: 'Grey whales visit Puget Sound every spring on their long journey north. They are as long as a bus and eat tiny shrimp from the mud. One passing by makes a wave that tumbles the plankton.', simple: 'A whale as long as a bus! It eats tiny shrimp.', more: 'https://en.wikipedia.org/wiki/Gray_whale' },
  gull: { title: 'Gulls', body: 'Gulls dip at the top of the sea to snatch tiny things. Baby octopuses are safer a little deeper down.', simple: 'A gull dips at the top of the sea.', more: 'https://en.wikipedia.org/wiki/Glaucous-winged_gull' },
  settle: { title: 'Time to settle', body: 'After a month or two in the plankton the little octopus is big enough to sink to the sea floor and find a den: a crack in the rock, a space under a boulder, even an old bottle.', simple: 'It sinks down and looks for a crack to live in.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  den: { title: 'A den', body: 'An octopus lives in a den: a hole just big enough for it, with one small door it can watch from. It keeps its den clean and pulls stones over the door when it rests.', simple: 'An octopus lives in a hole with a little door.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  bottle: { title: 'A bottle for a home', body: 'Little octopuses are not fussy about their dens. A real octopus will happily live in an old bottle, a jar or a tin can lying on the sea floor.', simple: 'A little octopus can live in a bottle!', more: 'https://www.youtube.com/results?search_query=octopus+living+in+bottle' },
  midden: { title: 'The midden', body: 'An octopus drops the empty shells of its meals outside its door. The pile is called a midden, and divers find octopus dens by looking for it.', simple: 'The shells by the door show where an octopus lives.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  camo: { title: 'Changing colour', body: 'Octopus skin is full of tiny bags of colour called chromatophores. Muscles pull them open or shut in a blink, so the octopus can match the rock or sand it sits on and almost vanish.', simple: 'It changes colour to match the rocks, in a blink!', more: 'https://en.wikipedia.org/wiki/Chromatophore' },
  papillae: { title: 'Bumpy skin', body: 'An octopus can also change the shape of its skin, raising little bumps called papillae so it looks as rough as a rock or as smooth as sand.', simple: 'It can make its skin bumpy like a rock!', more: 'https://www.youtube.com/results?search_query=octopus+camouflage+papillae' },
  mood: { title: 'Colours of feeling', body: 'An octopus turns pale when it is calm or asleep, and flushes dark red when it is excited or cross. You can read its mood on its skin.', simple: 'Pale when calm, red when excited!', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  ink: { title: 'Ink!', body: 'When something frightens it, an octopus squirts a cloud of dark ink and jets away. The ink hides it and muddles the hunter\'s sense of smell.', simple: 'Squirt ink and jet away!', more: 'https://en.wikipedia.org/wiki/Cephalopod_ink' },
  jet: { title: 'The siphon', body: 'An octopus breathes by pulling water into its mantle and pushing it out through a tube called the siphon. Push hard, and it jets backwards through the water.', simple: 'It squirts water out of a tube to zoom!', more: 'https://en.wikipedia.org/wiki/Siphon_(mollusc)' },
  suckers: { title: 'Tasting with suckers', body: 'Each arm has two rows of suckers, more than two hundred on each arm. Every sucker can grip, and every sucker can taste what it touches.', simple: 'Its suckers can taste! More than two hundred on each arm.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  squeeze: { title: 'No bones at all', body: 'An octopus has no bones. The only hard part is its beak, so it can squeeze through any gap its beak fits through, no bigger than its eye.', simple: 'No bones! It can squeeze through a tiny gap.', more: 'https://www.youtube.com/results?search_query=octopus+squeezes+through+hole' },
  hearts: { title: 'Three hearts', body: 'An octopus has three hearts: two pump blood through the gills, and one pumps it round the body.', simple: 'Three hearts!', more: 'https://en.wikipedia.org/wiki/Octopus' },
  blood: { title: 'Blue blood', body: 'Octopus blood is blue. It carries oxygen with copper instead of the iron that makes our blood red, which works better in cold water.', simple: 'Octopus blood is blue!', more: 'https://en.wikipedia.org/wiki/Hemocyanin' },
  brains: { title: 'Nine brains', body: 'An octopus has a brain in its head and a smaller one in each of its eight arms. The arms can feel, taste and move by themselves.', simple: 'A brain in its head and one in each arm!', more: 'https://en.wikipedia.org/wiki/Cephalopod_intelligence' },
  eyes: { title: 'Eyes like a cat', body: 'An octopus has big eyes with a pupil shaped like a bar, which stays level however the octopus tilts. It sees very well in dim light.', simple: 'Big eyes with bar-shaped pupils!', more: 'https://en.wikipedia.org/wiki/Cephalopod_eye' },
  beak: { title: 'The beak', body: 'Under the arms, in the middle, is a hard beak like a parrot\'s. The octopus uses it to open crabs and clams.', simple: 'A beak like a parrot, for opening crabs!', more: 'https://en.wikipedia.org/wiki/Cephalopod_beak' },
  food: { title: 'What octopuses eat', body: 'Octopuses eat crabs, clams, scallops, snails, shrimp and fish. They hunt mostly at night, pouncing with their arms spread like a parachute.', simple: 'Crabs, clams, snails and shrimp!', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  night: { title: 'Out at night', body: 'Octopuses rest in their dens by day and come out to hunt at night. In the dark, fewer things can see them.', simple: 'Octopuses hide by day and hunt at night.', more: 'https://en.wikipedia.org/wiki/Nocturnality' },
  crab: { title: 'Red rock crabs', body: 'Red rock crabs and Dungeness crabs are an octopus\'s favourite food. The octopus wraps the crab in its arms and opens it with its beak.', simple: 'Crabs are its favourite food!', more: 'https://en.wikipedia.org/wiki/Cancer_productus' },
  predators: { title: 'Who hunts octopuses', body: 'Lingcod, wolf eels, harbour seals, sea otters and sixgill sharks all hunt octopuses, especially small ones. That is why an octopus hides by day, blends in, and keeps its ink ready.', simple: 'Big fish, seals and otters look for octopuses, so they hide.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  lingcod: { title: 'Lingcod', body: 'The lingcod is a big spotted fish with a huge mouth that lives on the rocky reefs of Puget Sound. It lies still, then lunges.', simple: 'A big spotted fish with a huge mouth!', more: 'https://en.wikipedia.org/wiki/Lingcod' },
  wolfeel: { title: 'Wolf eels', body: 'A wolf eel is a long fish with a big wrinkled face and strong jaws for crunching crabs and urchins. Wolf eels live in the same cracks octopuses like, and the two often argue over them.', simple: 'A long fish with a wrinkly face. It wants your crack!', more: 'https://en.wikipedia.org/wiki/Wolf_eel' },
  seal: { title: 'Harbour seals', body: 'Harbour seals live all over Puget Sound. They are curious, dive for fish and octopuses, and rest on the rocks and docks.', simple: 'A seal! It swims and rests on the rocks.', more: 'https://en.wikipedia.org/wiki/Harbor_seal' },
  otter: { title: 'Sea otters', body: 'Sea otters float on their backs in the kelp and crack open crabs and urchins on their chests. They love octopus too, and dive down to look for them.', simple: 'An otter floats in the kelp and eats crabs!', more: 'https://en.wikipedia.org/wiki/Sea_otter' },
  sixgill: { title: 'The sixgill shark', body: 'Deep in Puget Sound lives the bluntnose sixgill shark, as long as a car, with six gill slits instead of five. It swims slowly in the dark and only comes up at night.', simple: 'A big slow shark lives in the deep!', more: 'https://en.wikipedia.org/wiki/Bluntnose_sixgill_shark' },
  pot: { title: 'The crab pot', body: 'Crabbers lower pots full of bait to catch crabs. An octopus smells the bait and squeezes in. When the crabber pulls the pot up, he lifts the lid and tips the octopus back into the sea: it is not what he is fishing for.', simple: 'He lifts the lid and lets you go!', more: 'https://en.wikipedia.org/wiki/Crab_trap' },
  diver: { title: 'Divers', body: 'Divers in Puget Sound love to visit giant Pacific octopuses. A curious octopus may reach out an arm to taste a diver\'s hand, and the diver holds very still.', simple: 'A diver! Say hi with an arm.', more: 'https://www.youtube.com/results?search_query=giant+pacific+octopus+diver+puget+sound' },
  regrow: { title: 'An arm grows back', body: 'If an octopus loses the tip of an arm, it does not hurt it much, and the arm grows back over a few months, suckers and all.', simple: 'A lost arm tip grows back!', more: 'https://en.wikipedia.org/wiki/Octopus' },
  favarm: { title: 'A favourite arm', body: 'Octopuses have favourite arms. Each one reaches out with the same arm first, the way you use your favourite hand.', simple: 'An octopus has a favourite arm, like your favourite hand!', more: 'https://en.wikipedia.org/wiki/Cephalopod_intelligence' },
  gift: { title: 'The special arm', body: 'A boy octopus has one special arm, the third on the right, with a spoon-shaped tip. He uses it to hand a packet to the girl so her eggs can grow.', simple: 'The boy gives a gift with his special arm.', more: 'https://en.wikipedia.org/wiki/Hectocotylus' },
  size: { title: 'The biggest octopus', body: 'The giant Pacific octopus is the biggest octopus in the world. A big one has arms stretching four metres and weighs as much as a grown-up. Its mantle alone can be half a metre long.', simple: 'The biggest octopus in the world! Arms four metres wide.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  smart: { title: 'A clever animal', body: 'Octopuses are very clever. They open jars, solve puzzles, remember people, and some carry coconut shells to hide in.', simple: 'Octopuses can open jars and solve puzzles!', more: 'https://en.wikipedia.org/wiki/Cephalopod_intelligence' },
  sleep: { title: 'Dreaming in colour', body: 'An octopus sleeps in its den. While it sleeps, its skin flickers through colours, pale and dark and spotted, as if it were dreaming.', simple: 'When it sleeps, its skin flickers with colours!', more: 'https://www.youtube.com/results?search_query=octopus+changing+color+while+sleeping' },
  seasons: { title: 'Up and down the reef', body: 'In spring and summer the octopuses of Puget Sound live up on the shallow reefs. In autumn many move down the drop-off to deeper water, and in spring they climb back up.', simple: 'In autumn it goes down to the deep. In spring it comes back.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  winter: { title: 'Winter in the deep', body: 'Deep water stays calm and keeps its temperature all winter. An octopus finds a den down there and rests, eating little, until spring.', simple: 'In winter it rests in a deep den.', more: 'https://en.wikipedia.org/wiki/Puget_Sound' },
  contest: { title: 'Arm to arm', body: 'Two octopuses who want the same den face each other, spread their arms wide and turn dark, and push. The bigger one usually wins, and the loser backs away and jets off.', simple: 'They spread their arms and push. The loser jets away.', more: 'https://www.youtube.com/results?search_query=octopus+fight+den' },
  boss: { title: 'The big octopus of the reef', body: 'The biggest octopus gets the best den under the ledge. A girl octopus comes to find him there.', simple: 'The biggest octopus gets the best den.', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  moon: { title: 'Moon and tide', body: 'The moon pulls the sea into tides. Twice a day the water rises and falls in Puget Sound, and the currents that come with it carry the baby octopuses along.', simple: 'The moon moves the tides, and the tides carry the babies.', more: 'https://en.wikipedia.org/wiki/Tide' },
  life: { title: 'A short, busy life', body: 'A giant Pacific octopus lives about four years, and grows from a grain of rice to a giant in that time. It does everything in its life once, and does it well.', simple: 'From a grain of rice to a giant in four years!', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  kelp: { title: 'Bull kelp', body: 'Bull kelp grows in forests along the rocky shores of Puget Sound. Each one is a long whip with a floating bulb at the top and a crown of long blades. Fish, crabs and octopuses all live among it.', simple: 'Bull kelp is a long whip with a float at the top!', more: 'https://en.wikipedia.org/wiki/Nereocystis' },
  eelgrass: { title: 'Eelgrass', body: 'Eelgrass is a grass that grows under the sea on sandy flats. Baby crabs, shrimps and little fish hide in it, so an octopus hunts there at night.', simple: 'Grass under the sea! Crabs and shrimps hide in it.', more: 'https://en.wikipedia.org/wiki/Zostera_marina' },
  sound: { title: 'Puget Sound', body: 'Puget Sound is a deep, cold arm of the sea in Washington State, full of islands, rocky reefs and kelp. It is part of the Salish Sea, and it is one of the best places in the world for giant Pacific octopuses.', simple: 'A cold deep sea full of octopuses, in Washington.', more: 'https://en.wikipedia.org/wiki/Puget_Sound' },
  star: { title: 'The sunflower star', body: 'The sunflower star is the biggest sea star in the world, with up to twenty-four arms, and it is always hungry. A mother octopus blows it away from her eggs.', simple: 'A huge sea star with lots of arms! Blow it away.', more: 'https://en.wikipedia.org/wiki/Pycnopodia' },
  rockfish: { title: 'Rockfish', body: 'Rockfish hang about the reef in the gloom with big eyes and spiny fins. One would gladly nibble an egg string if the mother let it.', simple: 'A spiny fish that wants the eggs. Puff it away!', more: 'https://en.wikipedia.org/wiki/Sebastes' },
  babies: { title: 'Fifty thousand babies', body: 'When the eggs hatch, the mother blows the babies out of the den in clouds, and they jet up to the surface to join the plankton. Only a few will grow up, and each of those will have fifty thousand babies of its own.', simple: 'Thousands of babies jet up to the top of the sea!', more: 'https://en.wikipedia.org/wiki/Giant_Pacific_octopus' },
  lifecycle: { title: 'The whole life cycle', body: 'Egg, paralarva in the plankton, a settler on the reef, years in a den, a young octopus, a giant, down to the deep and back, and then eggs again. An octopus\'s life starts near the surface and is lived on the sea floor.', simple: 'Egg, paralarva, settler, little, young, giant… then eggs again!', more: 'https://en.wikipedia.org/wiki/Biological_life_cycle' }
};

/* hints: [full, little words]; every key also has a READ_HINTS entry for Read to Play */
const HINTS = {
  egg: ['You are one of thousands of eggs hanging in strings from the roof of your mum\'s den…', 'I am an egg in Mum\'s den. Wait…'],
  hatch: ['A spring night! Mum is puffing water over the eggs. Wiggle with the arrows to pop out.', 'Wiggle! Pop out!'],
  swim: ['You are a paralarva! Swim with the arrows and eat the little copepods.', 'Swim! Eat the little shrimps.'],
  copepod: ['A baby crab! It jumps away. Chase it!', 'Chase the baby crab!'],
  grow: ['You grew! No shell to shed: an octopus just keeps growing.', 'I grew!'],
  bigger: ['Bigger! Keep eating.', 'Eat more! Get big!'],
  night: ['Night: the plankton rise to the top. Swim up to eat.', 'Night! Food is at the top.'],
  day: ['Day: the plankton sink down. Dive down to find them.', 'Day! Food is down deep.'],
  flick: ['Press E to jet!', 'Press E to jet!'],
  herring: ['Herring! Jet away, or dive deep!', 'Fish! Jet away!'],
  missed: ['Whoosh! You tumbled away. Nothing is hurt.', 'Whoosh! I am OK!'],
  jelly: ['A comb jelly! Keep away from its shimmering blob.', 'A jelly blob! Keep away!'],
  whale: ['A grey whale! Its wave will tumble you. Swim clear!', 'A big whale! Swim away!'],
  gull: ['A gull is dipping at the top! Swim down a little.', 'A bird! Go down!'],
  postlarva: ['You are big enough to settle! Follow the arrow to the reef and sink to the bottom.', 'Sink down to the rocks!'],
  search: ['Find a crack under a boulder, or a bottle, that nobody is in. Go to it and press Space.', 'Find an empty crack!'],
  taken: ['Taken! A little octopus lives here already. Try another one.', 'Taken! Try another one.'],
  settle: ['An empty den! Press Space to squeeze in and make it your home.', 'Press Space to squeeze in!'],
  juvenile: ['Home! Stay in your den and grab the little shrimps that drift past. Press Space to pounce.', 'Grab the shrimps!'],
  drift: ['A shrimp drifted by! Press Space to pounce.', 'A shrimp! Press Space!'],
  hide: ['Your hiding meter is low! Keep still to blend in, or get into a crack or the kelp.', 'Hide! Keep still or get in a crack!'],
  hidden: ['Safe and hidden.', 'I am hidden. Ahh.'],
  tucked: ['You flattened out and blended in until it was safe. Nothing found you.', 'I hid until it was safe.'],
  blend: ['Keep still and your skin matches the ground. Look: you are vanishing!', 'Keep still. I vanish!'],
  predator: ['A hunter is coming! Press E to ink and jet away, or keep still and blend in!', 'A hunter! Press E!'],
  dodged: ['Whoosh! Your ink cloud and your jet left it far behind.', 'Whoosh! I got away!'],
  forage: ['Night time! Go out and hunt: crabs, clams, scallops, snails and shrimps.', 'Go out and hunt!'],
  eat: ['Food! Go to it and press Space to pounce.', 'Press Space to eat!'],
  sniff: ['Follow the arrow to more food. Your suckers taste it in the water.', 'Follow the arrow!'],
  arm: ['You reach out with the arm on the side you face. The arm you use most becomes your favourite!', 'Use one arm most!'],
  favarm: ['Your favourite arm is decided! You reach with it first, every time.', 'My favourite arm!'],
  full: ['You are full! Find a boulder and push down to dig a den under it with your siphon.', 'Dig under a boulder! Push down.'],
  dig: ['Blow the sand away: dig down, then under the boulder.', 'Dig down!'],
  rock: ['Too hard to dig here! Find sand or mud.', 'Too hard! Dig in the sand.'],
  deeper: ['Dig a little deeper, right under the boulder.', 'Dig down more!'],
  cover: ['Deep enough, but nothing over you! Dig sideways under a boulder.', 'Go under the boulder!'],
  sleep: ['Hidden and full! Press Space to curl up and sleep. You grow while you sleep.', 'Press Space to sleep!'],
  sleeping: ['Zzz… your skin flickers with colours while you dream, and you grow.', 'Zzz… I am growing.'],
  awake: ['Awake, and bigger! Out you go.', 'I woke up bigger! Go out!'],
  out: ['Push up to climb out of your den.', 'Push up to go out!'],
  daytime: ['It is day. Octopuses hide by day. Press F to hurry the time along.', 'Day. Hide and wait, or press F.'],
  midden: ['Your empty shells pile up by your door: a midden. Divers find dens by them!', 'My shells pile up by my door!'],
  trap: ['A crab pot! It smells of fish. Squeeze in and press Space to eat the bait.', 'A pot! Squeeze in and eat!'],
  hauled: ['Up you go! The crabber lifts the lid and looks at you…', 'Up, up! He looks at me…'],
  measured: ['Not a crab! Back into the sea you go.', 'Not a crab! Back in the sea!'],
  adult: ['You are a giant! Eat and wait for autumn.', 'I am a giant! Eat and wait.'],
  diver: ['A diver! She is holding very still. Go to her and press Space to say hi with an arm.', 'A diver! Say hi!'],
  shake: ['Press Space to reach out an arm.', 'Reach out an arm!'],
  armtip: ['The wolf eel got hold of an arm tip. You let it go: it will grow back, suckers and all!', 'It got my arm tip. It grows back!'],
  autumn: ['Autumn! The shallows are getting cold and stormy. Crawl down the drop-off to the deep.', 'Cold! Go down to the deep!'],
  deep: ['Follow the arrow down to the deep.', 'Go to the deep!'],
  kelpwalk: ['Crawl on through the kelp forest.', 'Crawl on!'],
  arrived: ['The deep! Find a stone and dig a winter den under it: push down.', 'Dig a den in the mud!'],
  winter: ['Winter. Rest in your deep den. The deep water stays calm.', 'Winter. Rest…'],
  spring: ['Spring! Climb out and crawl back up to the reef.', 'Spring! Go back home!'],
  home: ['Follow the arrow home to the reef.', 'Go home!'],
  site: ['Home! Find a big boulder and dig a den under it: push down.', 'Dig a den under a big boulder!'],
  rival: ['A rival wants your den! Go to him and press Space to wrestle.', 'An octopus! Wrestle him!'],
  box: ['Tap Space to push! When the ring turns green, press E for a big shove!', 'Tap Space! Green ring: E!'],
  won: ['You won! He jetted off. The den is yours.', 'I won! He went away.'],
  lost: ['He pushed you back! Try again.', 'Oops! Try again.'],
  boss: ['The big octopus of the reef! Listen… someone is coming.', 'I am the biggest!'],
  female: ['A girl octopus! Go to her and press Space.', 'Go and say hi!'],
  findmale: ['The boys are at their den doors. Go to one and press Space.', 'Find a boy octopus!'],
  meet: ['Press Space to say hi.', 'Say hi!'],
  nest: ['You take a den of your own next door and hang your eggs from the roof.', 'I hang my eggs in my den.'],
  brood: ['Your eggs hang from the roof. Stroke them clean and blow water over them. Months go by…', 'My eggs! Look after them…'],
  puff: ['A sunflower star is creeping towards the eggs! Press Space to puff it away.', 'A star! Press Space to puff!'],
  puffed: ['Puff! It tumbled away. The eggs are safe.', 'Puff! It went away.'],
  moonready: ['A spring night! The eggs are hatching. Blow the babies out of the den.', 'Night! Blow the babies out!'],
  release: ['When the glow swells, press Space to blow the babies free!', 'Glow! Press Space!'],
  larvae: ['Your babies are jetting up to the surface. The cycle begins again!', 'The babies swim up!'],
  done: ['Your job is done. Rest in your den.', 'All done. Rest!'],
  friend: ['Other little octopuses are settling on the reef too.', 'Lots of octopus friends!'],
  flipped: ['Ink and jet! A dark cloud, and you shot backwards.', 'Ink! I shot backwards!'],
  cold: ['Brr, the water is cold up here. Keep going down to the deep.', 'Cold! Go down!']
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .78) return smoothstep(.78, .9, tod);
  return 0;
}
/* the tide: two highs a day in Puget Sound (−1 low … 1 high) */
function tideAt(tod) { return Math.cos((tod - .21) * TAU * 2); }
/* moon phase 0..1: 0 new, .25 first quarter, .5 full, .75 last quarter */
function moonName(m) { m = ((m % 1) + 1) % 1; return m < .03 || m > .97 ? 'New moon' : m < .22 ? 'Growing moon' : m < .28 ? 'First quarter' : m < .47 ? 'Growing moon' : m < .53 ? 'Full moon' : m < .72 ? 'Shrinking moon' : m < .78 ? 'Last quarter' : 'Shrinking moon'; }
/* the seasons of Puget Sound, for the HUD (the water stays cold all year) */
const SEASON_INFO = { spring: ['🌱 Spring', 9], summer: ['☀️ Summer', 13], autumn: ['🍂 Autumn', 11], winter: ['❄️ Winter', 8] };
