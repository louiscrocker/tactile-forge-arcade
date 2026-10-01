/* ============================================================
   data.js — everything you can pick, everyone you can meet,
             and the facts and hints in two reading levels
   ============================================================
   Every fact has a full `body` and a `simple` version in short
   words.  Every hint is [full, simple].  `more` links go to a
   YouTube search or Wikipedia — never a specific video.
   ============================================================ */
'use strict';

/* ---------- alicorn looks ---------- */
const BODY_COLORS = [
  { key: 'snow', name: 'Snow white', hex: '#fbfaff' },
  { key: 'blush', name: 'Blush pink', hex: '#ffc6da' },
  { key: 'lavender', name: 'Lavender', hex: '#d6c4ff' },
  { key: 'sky', name: 'Sky blue', hex: '#bfe3ff' },
  { key: 'mint', name: 'Mint', hex: '#c2f2dc' },
  { key: 'butter', name: 'Buttercup', hex: '#fff0a8' },
  { key: 'peach', name: 'Peach', hex: '#ffd6b3' },
  { key: 'lilac', name: 'Lilac', hex: '#e9c6f5' },
  { key: 'midnight', name: 'Midnight', hex: '#4a4a8c' },
  { key: 'rose', name: 'Rose', hex: '#f79ab8' },
  { key: 'sea', name: 'Seafoam', hex: '#9fe0e8' },
  { key: 'caramel', name: 'Caramel', hex: '#d9a672' }
];
const MANE_COLORS = [
  { key: 'pink', name: 'Pink', hex: '#ff7ab6' },
  { key: 'purple', name: 'Purple', hex: '#9b6cff' },
  { key: 'blue', name: 'Blue', hex: '#4fb0ff' },
  { key: 'teal', name: 'Teal', hex: '#3fd1c4' },
  { key: 'green', name: 'Spring green', hex: '#7fdc6a' },
  { key: 'gold', name: 'Gold', hex: '#ffcf3f' },
  { key: 'orange', name: 'Orange', hex: '#ff9a4d' },
  { key: 'red', name: 'Cherry', hex: '#ff5a6e' },
  { key: 'white', name: 'Cloud white', hex: '#ffffff' },
  { key: 'silver', name: 'Silver', hex: '#c9d2e0' },
  { key: 'navy', name: 'Night blue', hex: '#3c4a9c' },
  { key: 'rainbow', name: 'Rainbow', hex: 'rainbow', locked: true }
];
const HORNS = [
  { key: 'gold', name: 'Gold', hex: '#ffd24a', hex2: '#fff1a8' },
  { key: 'silver', name: 'Silver', hex: '#cfd8e6', hex2: '#ffffff' },
  { key: 'rosegold', name: 'Rose gold', hex: '#f4b0a0', hex2: '#ffe0d6' },
  { key: 'pearl', name: 'Pearl', hex: '#f3ecff', hex2: '#ffffff' },
  { key: 'crystal', name: 'Crystal', hex: '#8fe3ff', hex2: '#e8fbff', locked: true },
  { key: 'rainbow', name: 'Rainbow', hex: 'rainbow', hex2: '#ffffff', locked: true }
];
const EYE_COLORS = [
  { key: 'blue', name: 'Blue', hex: '#3f8fff' },
  { key: 'violet', name: 'Violet', hex: '#9a5cff' },
  { key: 'green', name: 'Green', hex: '#3fbf6a' },
  { key: 'brown', name: 'Brown', hex: '#8a5a3a' },
  { key: 'pink', name: 'Pink', hex: '#ff5fa8' },
  { key: 'gold', name: 'Gold', hex: '#e8a828' }
];
const WING_STYLES = [
  { key: 'feather', name: 'Feathers' },
  { key: 'glitter', name: 'Glitter feathers', locked: true }
];
const MARKS = [
  { key: 'star', name: 'Star' }, { key: 'heart', name: 'Heart' }, { key: 'flower', name: 'Flower' },
  { key: 'moon', name: 'Moon' }, { key: 'rainbow', name: 'Rainbow' }, { key: 'butterfly', name: 'Butterfly' },
  { key: 'bolt', name: 'Lightning' }, { key: 'note', name: 'Music note' }, { key: 'crown', name: 'Crown' },
  { key: 'snow', name: 'Snowflake' }, { key: 'sun', name: 'Sun' }, { key: 'cloud', name: 'Cloud' },
  { key: 'custom', name: 'My own!' }
];
const MANE_STYLES = [
  { key: 'flowing', name: 'Flowing' }, { key: 'curly', name: 'Curly' }, { key: 'braided', name: 'Braids' }, { key: 'long', name: 'Super long' }, { key: 'flowers', name: 'Flowers' }
];
const TAIL_STYLES = [
  { key: 'flowing', name: 'Flowing' }, { key: 'curly', name: 'Curly' }, { key: 'braided', name: 'Braid' }, { key: 'long', name: 'Super long' }
];
const NAMES = ['Starlight', 'Luna', 'Rosie', 'Sparkle', 'Skye', 'Twinkle', 'Aurora', 'Pippa', 'Bluebell', 'Daisy', 'Willow', 'Celeste', 'Misty', 'Rainbow', 'Snowdrop', 'Honey'];

/* accessories: `slot` is where it sits; `cost` in stars, or `quest` to unlock */
const ACCESSORIES = [
  { key: 'bow', name: 'Pink bow', simple: 'A pink bow', slot: 'head', cost: 10 },
  { key: 'garland', name: 'Flower garland', simple: 'Flowers for my neck', slot: 'neck', quest: 'flowers' },
  { key: 'tiara', name: 'Sparkle tiara', simple: 'A sparkly tiara', slot: 'head', cost: 30 },
  { key: 'starcrown', name: 'Star crown', simple: 'A crown of stars', slot: 'head', quest: 'fallen' },
  { key: 'scarf', name: 'Cosy scarf', simple: 'A warm scarf', slot: 'neck', cost: 15 },
  { key: 'bell', name: 'Silver bell', simple: 'A little bell', slot: 'neck', cost: 8 },
  { key: 'necklace', name: 'Moon necklace', simple: 'A moon necklace', slot: 'neck', quest: 'moon' },
  { key: 'blanket', name: 'Rainbow blanket', simple: 'A rainbow blanket', slot: 'back', cost: 12 },
  { key: 'ribbon', name: 'Tail ribbon', simple: 'A ribbon on my tail', slot: 'tail', cost: 10 },
  { key: 'boots', name: 'Glitter hooves', simple: 'Sparkly hooves', slot: 'legs', cost: 15 },
  { key: 'glitter', name: 'Sparkle trail', simple: 'I leave sparkles!', slot: 'magic', cost: 20 },
  { key: 'queencrown', name: 'Queen crown', simple: 'The Queen crown!', slot: 'head', quest: 'party' },
  { key: 'flowercrown', name: 'Flower crown', simple: 'A crown of flowers', slot: 'head', cost: 18 },
  { key: 'shelltiara', name: 'Seashell tiara', simple: 'A seashell tiara', slot: 'head', quest: 'mermaid' },
  { key: 'pearls', name: 'Pearl necklace', simple: 'Pearls!', slot: 'neck', cost: 25 },
  { key: 'earmuffs', name: 'Fluffy earmuffs', simple: 'Warm earmuffs', slot: 'head', cost: 12 },
  { key: 'medal', name: 'Gold medal', simple: 'A gold medal!', slot: 'neck', quest: 'race' }
];

/* the foal's stable: paint, roof and decorations bought with stars */
const HOME_PAINTS = [
  { key: 'pink', name: 'Pink', hex: '#ffd6ea' }, { key: 'lilac', name: 'Lilac', hex: '#e6d6ff' }, { key: 'mint', name: 'Mint', hex: '#d2f5e4' },
  { key: 'sky', name: 'Sky', hex: '#d6ecff' }, { key: 'butter', name: 'Butter', hex: '#fff3c2' }, { key: 'cream', name: 'Cream', hex: '#fff8ee' }
];
const HOME_ROOFS = [
  { key: 'lilac', name: 'Lilac', hex: '#b48cff' }, { key: 'rose', name: 'Rose', hex: '#ff7ab6' }, { key: 'teal', name: 'Teal', hex: '#3fc1b8' }, { key: 'sun', name: 'Sunny', hex: '#ffb02e' }
];
const HOME_ITEMS = [
  { key: 'flowerbox', name: 'Flower boxes', simple: 'Flowers in the windows', cost: 6 },
  { key: 'bunting', name: 'Rainbow bunting', simple: 'Rainbow flags', cost: 8 },
  { key: 'lanterns', name: 'Lanterns', simple: 'Glowing lanterns', cost: 10 },
  { key: 'garden', name: 'Flower garden', simple: 'A little garden', cost: 10 },
  { key: 'wreath', name: 'Star wreath', simple: 'A star wreath', cost: 8 },
  { key: 'fairylights', name: 'Fairy lights', simple: 'Twinkly lights', cost: 14 },
  { key: 'weathervane', name: 'Alicorn weathervane', simple: 'A gold weathervane', cost: 16 },
  { key: 'mailbox', name: 'Heart mailbox', simple: 'A heart mailbox', cost: 6 },
  { key: 'trough', name: 'Apple trough', simple: 'An apple snack box', cost: 8 }
];

/* who is playing: flight assist, magic range, whether storm clouds visit */
const DIFFICULTY = {
  easy: { label: 'Little kid', assist: true, magicRange: 240, storms: false, fall: 220 },
  normal: { label: 'Big kid', assist: false, magicRange: 175, storms: true, fall: 380 },
  hard: { label: 'Explorer', assist: false, magicRange: 150, storms: true, fall: 420 }
};

const DEFAULT_LOOK = { name: 'Starlight', body: 'blush', mane: ['pink', 'purple'], horn: 'gold', eyes: 'blue', wings: 'feather', mark: 'star', wear: [], owned: [], maneStyle: 'flowing', tailStyle: 'flowing' };
const FOAL_NAMES = ['Moonbeam', 'Button', 'Pipsqueak', 'Twinkle', 'Cupcake', 'Dewdrop', 'Petal', 'Sprinkles', 'Pebble', 'Clover', 'Bubbles', 'Jellybean'];

/* ---------- the land ---------- */
const ZONES = [
  { key: 'woods', name: 'Whispering Woods', simple: 'the Woods', x0: -7000, x1: -2200, sky: '#7fb6d9', hill: '#4e8a5c', grass: '#4f9c4a' },
  { key: 'meadow', name: 'Flower Meadow', simple: 'the Meadow', x0: -2200, x1: 2200, sky: '#8fd0ff', hill: '#7cc46a', grass: '#79c352' },
  { key: 'lake', name: 'Crystal Lake', simple: 'the Lake', x0: 2200, x1: 5000, sky: '#9ad8ff', hill: '#7bbfa0', grass: '#86c86a' },
  { key: 'mountain', name: 'Rainbow Mountain', simple: 'the Mountain', x0: 5000, x1: 7000, sky: '#a9c8ff', hill: '#9a86c8', grass: '#8fb86a' }
];
const SKY_ZONES = [
  { key: 'sky', name: 'the open sky', y0: -1500, y1: -500 },
  { key: 'clouds', name: 'Cloud Kingdom', y0: -2900, y1: -1500 },
  { key: 'stars', name: 'the Star Sky', y0: -5000, y1: -2900 }
];

/* the race: rings looping over the meadow from the rainbow arch and back */
const RACE_COURSE = [[1000, -260], [1400, -460], [1800, -700], [2050, -1000], [1700, -1250], [1150, -1380], [600, -1250], [150, -1000], [-350, -760], [-800, -520], [-450, -300], [250, -220]];

/* ---------- friends ---------- */
const FRIENDS = {
  bramble: { key: 'bramble', name: 'Bramble', kind: 'bunny', zone: 'meadow', x: 420, home: 'ground', blurb: 'a bouncy bunny who lives by the castle', col: '#e9d8c4' },
  hazel: { key: 'hazel', name: 'Hazel', kind: 'fox', zone: 'woods', x: -3300, home: 'ground', blurb: 'a clever fox who knows every path in the woods', col: '#f08c3a' },
  hoot: { key: 'hoot', name: 'Professor Hoot', kind: 'owl', zone: 'woods', x: -4600, home: 'branch', blurb: 'a wise owl who watches the stars', col: '#a8825a' },
  fern: { key: 'fern', name: 'Fern', kind: 'deer', zone: 'woods', x: -2700, home: 'ground', blurb: 'a shy fawn with white spots', col: '#c9915a' },
  lily: { key: 'lily', name: 'Lily', kind: 'frog', zone: 'lake', x: 3100, home: 'pad', blurb: 'a frog who loves parties', col: '#6fcf5a' },
  pearl: { key: 'pearl', name: 'Pearl', kind: 'swan', zone: 'lake', x: 4000, home: 'water', blurb: 'a graceful swan', col: '#ffffff' },
  cloudia: { key: 'cloudia', name: 'Cloudia', kind: 'sheep', zone: 'clouds', x: 80, home: 'cloudcastle', blurb: 'a cloud sheep from the Cloud Kingdom', col: '#ffffff' },
  puff: { key: 'puff', name: 'Puff', kind: 'lamb', zone: 'meadow', x: -1500, home: 'ground', hidden: true, blurb: 'Cloudia\'s little lamb', col: '#ffffff' },
  ember: { key: 'ember', name: 'Ember', kind: 'dragon', zone: 'mountain', x: 5460, home: 'cave', blurb: 'a baby dragon who is learning to fly', col: '#ff7a5c' },
  marina: { key: 'marina', name: 'Marina', kind: 'mermaid', zone: 'lake', x: 3650, home: 'grotto', blurb: 'a mermaid who lives under Crystal Lake', col: '#7fe0e8' }
};

/* ---------- fact cards ---------- */
const YT = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const FACTS = {
  alicorn: {
    title: 'What is an alicorn?',
    body: 'A unicorn has a horn. A pegasus has wings. An alicorn has both! People have told stories about winged horses for thousands of years — Pegasus was a flying horse in Greek myths who carried thunder and lightning for Zeus.',
    simple: 'A unicorn has a horn. A pegasus has wings. An alicorn has BOTH! People told stories about flying horses long, long ago.',
    more: 'https://en.wikipedia.org/wiki/Winged_unicorn'
  },
  gallop: {
    title: 'Gallop!',
    body: 'When a real horse gallops, there is a moment in every stride when all four hooves are off the ground at once. A racehorse can run about 70 km/h — as fast as a car on a town road.',
    simple: 'When a horse gallops, all four feet leave the ground at once! Horses can run as fast as a car.',
    more: YT('horse gallop slow motion')
  },
  hooves: {
    title: 'Hooves are like fingernails',
    body: 'A horse\'s hoof is made of keratin, the same stuff as your fingernails. It keeps growing all its life, about a centimetre a month, so it wears down as the horse walks.',
    simple: 'A hoof is made of the same stuff as your fingernails, and it keeps growing!',
    more: YT('horse hoof anatomy for kids')
  },
  sleep: {
    title: 'Sleeping standing up',
    body: 'Horses can doze standing up. Their legs have a special locking trick so they do not fall over. For deep sleep, though, they lie down — but only for a little while.',
    simple: 'Horses can sleep standing up! Their legs lock so they do not fall over.',
    more: YT('horses sleep standing up')
  },
  foal: {
    title: 'Baby horses stand fast',
    body: 'A baby horse is called a foal. Most foals can stand up within an hour of being born, and they can run by the next day. Being quick keeps them safe.',
    simple: 'A baby horse is a foal. It can stand up when it is only one hour old!',
    more: YT('foal standing first time')
  },
  rainbow: {
    title: 'How a rainbow is made',
    body: 'Sunlight looks white, but it is really every colour mixed together. When light goes through raindrops, each drop bends it and splits it into red, orange, yellow, green, blue, indigo and violet. You need the sun behind you and rain in front to see one.',
    simple: 'Sunlight is all the colours mixed up. Raindrops split it into seven colours. That is a rainbow!',
    more: YT('how rainbows form for kids')
  },
  clouds: {
    title: 'What clouds are made of',
    body: 'A cloud is millions of tiny water droplets floating in the air, each smaller than a speck of dust. They look solid and fluffy, but if you flew into one you would just feel cool, wet fog.',
    simple: 'A cloud is made of tiny, tiny drops of water floating in the air. It feels like cool fog.',
    more: YT('what are clouds made of for kids')
  },
  stars: {
    title: 'Stars are faraway suns',
    body: 'Every star in the night sky is a giant ball of burning gas, like our sun, but so far away that it looks like a tiny dot. The light from some stars took hundreds of years to reach your eyes.',
    simple: 'Stars are suns that are very, very far away. Their light takes a long time to reach us.',
    more: YT('what are stars for kids')
  },
  moon: {
    title: 'The Moon',
    body: 'The Moon does not make its own light — it reflects sunlight, like a mirror. Its dark patches are huge old lava plains and its round dents are craters made by space rocks. Twelve people have walked on it.',
    simple: 'The Moon shines because the sun lights it up. The round dents are craters. Twelve people have walked on the Moon!',
    more: YT('the moon for kids')
  },
  constellation: {
    title: 'Pictures in the stars',
    body: 'A constellation is a group of stars that people joined up with imaginary lines to make a picture: a bear, a hunter, a swan. There is even a unicorn — Monoceros — next to Orion.',
    simple: 'People join stars up like dot-to-dot to make pictures. There is a real unicorn in the stars!',
    more: 'https://en.wikipedia.org/wiki/Monoceros'
  },
  fireflies: {
    title: 'Fireflies glow without heat',
    body: 'Fireflies are beetles that make light inside their bodies with a chemical trick. The light is cold — no heat at all. They blink in patterns to find each other in the dark.',
    simple: 'Fireflies are beetles that make their own light. The light is not hot at all!',
    more: YT('fireflies at night')
  },
  owl: {
    title: 'Owls fly in silence',
    body: 'An owl\'s wing feathers have soft, comb-like edges that hush the sound of flying, so mice never hear it coming. An owl can also turn its head almost all the way round — 270 degrees.',
    simple: 'Owls fly so quietly you cannot hear them. They can turn their heads nearly all the way round!',
    more: YT('owl silent flight')
  },
  butterfly: {
    title: 'Butterflies taste with their feet',
    body: 'A butterfly has taste sensors on its feet. When it lands on a flower it knows straight away whether the nectar is good. It drinks through a long curly straw called a proboscis.',
    simple: 'Butterflies taste with their FEET. They drink flower juice through a curly straw.',
    more: YT('butterfly proboscis close up')
  },
  flowers: {
    title: 'Why flowers close at night',
    body: 'Some flowers, like daisies and tulips, fold their petals up at night and open again in the morning. It keeps the pollen dry and warm, ready for bees when the sun comes back.',
    simple: 'Some flowers close up at night to keep warm. They open again in the morning.',
    more: YT('flowers opening time lapse')
  },
  bees: {
    title: 'Flowers and bees are a team',
    body: 'Flowers make sweet nectar so bees will visit. While a bee drinks, yellow pollen sticks to it and gets carried to the next flower. That is how flowers make seeds.',
    simple: 'Bees drink from flowers. Pollen sticks to them and they carry it to the next flower. That helps flowers make seeds.',
    more: YT('pollination for kids')
  },
  frog: {
    title: 'Frogs drink through their skin',
    body: 'Frogs do not drink with their mouths. Water soaks straight in through their thin skin, so they always stay near ponds and damp places. They sing loudest on warm wet nights.',
    simple: 'Frogs do not drink with their mouths. Water goes in through their skin!',
    more: YT('frog facts for kids')
  },
  swan: {
    title: 'Swans stay together',
    body: 'Swans often stay with the same partner for their whole lives. Their babies are called cygnets and they ride on their parents\' backs when they get tired.',
    simple: 'Baby swans are called cygnets. They ride on their mum\'s back when they are tired!',
    more: YT('cygnets riding on swan back')
  },
  crystal: {
    title: 'Crystals grow',
    body: 'Crystals are not carved — they grow, very slowly, as tiny building blocks stack up in a neat pattern. That is why quartz has such flat, straight sides. Snowflakes are crystals too.',
    simple: 'Crystals grow slowly, block by block, in a neat pattern. Snowflakes are crystals too!',
    more: YT('how crystals grow time lapse')
  },
  dragonfly: {
    title: 'Dragons and lizards',
    body: 'Dragons live in stories, but some real lizards come close: the flying dragon lizard of Asia spreads out flaps of skin and glides from tree to tree, and the Komodo dragon is a lizard as long as a car.',
    simple: 'Dragons are in stories. But a real lizard called the flying dragon can glide from tree to tree!',
    more: YT('flying dragon lizard gliding')
  },
  sunset: {
    title: 'Why sunsets are orange',
    body: 'At sunset the sunlight travels through a lot more air to reach you. The air scatters the blue light away, so mostly the reds and oranges get through. The sky turns gold, pink and purple.',
    simple: 'At sunset, the light goes through lots of air. The blue gets lost and the orange and pink shine through.',
    more: YT('why is the sunset orange for kids')
  },
  narwhal: {
    title: 'The unicorn of the sea',
    body: 'Long ago, people found long spiral tusks and believed they came from unicorns. They really came from narwhals — small Arctic whales with one long twisted tooth that can grow as long as a person.',
    simple: 'A narwhal is a whale with one long, twisty tooth. Long ago people thought the tooth was a unicorn horn!',
    more: YT('narwhal tusk')
  },
  foal: {
    title: 'Baby horses drink milk',
    body: 'A foal drinks its mother\'s milk for its first months, then slowly learns to eat grass, hay and treats like apples. Foals play a lot — racing, bucking and kicking up their heels. Playing makes their legs strong.',
    simple: 'Baby horses drink milk first. Then they learn to eat grass and apples. They play a LOT!',
    more: YT('foal playing in field')
  },
  brush: {
    title: 'Horses love a brush',
    body: 'Brushing a horse is called grooming. It gets out mud and loose hair, and horses often lean into the brush because it feels nice. In a herd, horses groom each other with their teeth to show they are friends.',
    simple: 'Brushing a horse is called grooming. Horses love it! Horse friends groom each other.',
    more: YT('horse grooming for kids')
  },
  apples: {
    title: 'Apples come from blossom',
    body: 'Every apple starts as a flower. In spring, bees carry pollen between apple blossoms, and each flower that gets pollen swells into a little apple over the summer. Apples are ready to pick in autumn.',
    simple: 'Every apple starts as a flower in spring. Bees help. By autumn the apples are ready!',
    more: YT('apple blossom to apple time lapse')
  },
  seasons: {
    title: 'Why we have seasons',
    body: 'The Earth is tilted. For half the year your part of the world leans toward the sun — long warm days: summer. For the other half it leans away — short cold days: winter. Spring and autumn are in between.',
    simple: 'The Earth is tipped over a little. When our side leans to the sun, it is summer. When it leans away, it is winter.',
    more: YT('why do we have seasons for kids')
  },
  leaves: {
    title: 'Why leaves change colour',
    body: 'Leaves are green because of chlorophyll, which makes food from sunlight. In autumn the tree stops making it, the green fades, and the yellows and oranges that were hiding underneath show through. Then the leaves fall.',
    simple: 'Leaves have yellow and orange hiding under the green. In autumn the green goes away and the colours show!',
    more: YT('why do leaves change color for kids')
  },
  snowflakes: {
    title: 'Every snowflake has six arms',
    body: 'A snowflake is an ice crystal. Water freezes in a six-sided pattern, so snowflakes nearly always have six arms. Each one tumbles through different air on the way down, so no two look exactly the same.',
    simple: 'A snowflake is made of ice. It always has six arms. No two snowflakes are the same!',
    more: YT('snowflake forming close up')
  },
  ice: {
    title: 'Ice floats',
    body: 'Most things shrink when they freeze, but water grows. That makes ice lighter than water, so it floats on top of a lake like a lid. The water underneath stays liquid, and the fish stay safe all winter.',
    simple: 'Ice floats on top of the lake like a lid. The fish stay safe in the water underneath!',
    more: YT('why does ice float for kids')
  },
  fish: {
    title: 'Fish breathe water',
    body: 'Fish have gills instead of lungs. Water flows in through the mouth and out over the gills, which take the oxygen out of the water. That is why fish open and close their mouths all the time.',
    simple: 'Fish have gills. They take air out of the water! That is why fish open and close their mouths.',
    more: YT('how do fish breathe for kids')
  },
  pearls: {
    title: 'How a pearl is made',
    body: 'A pearl grows inside a shellfish like an oyster. If a tiny grain gets in, the oyster covers it with smooth, shiny layers, over and over, for years. Slowly it becomes a round, glowing pearl.',
    simple: 'A pearl grows inside a shell. The shellfish wraps a tiny grain in shiny layers, again and again.',
    more: YT('how pearls are formed')
  },
  mermaid: {
    title: 'Real mermaids?',
    body: 'Long ago, sailors saw big gentle sea animals called manatees and dugongs and told stories of mermaids. Manatees are cousins of elephants! They swim slowly and eat sea grass.',
    simple: 'Long ago, sailors saw manatees and thought they were mermaids! Manatees are cousins of elephants.',
    more: YT('manatee for kids')
  },
  jellyfish: {
    title: 'Jellyfish have no brain',
    body: 'Jellyfish are about 95 percent water and have no brain, no heart and no bones. They have been floating in the oceans for more than 500 million years — longer than dinosaurs.',
    simple: 'Jellyfish have no brain and no bones. They are mostly water! They were here before dinosaurs.',
    more: YT('jellyfish for kids')
  },
  race: {
    title: 'The fastest birds',
    body: 'The peregrine falcon is the fastest animal in the world. When it dives it can go over 300 km/h — faster than a racing car. Its nose has little bumps that stop the wind rushing into its lungs.',
    simple: 'The fastest animal is a bird: the peregrine falcon. It dives faster than a racing car!',
    more: YT('peregrine falcon dive slow motion')
  },
  letters: {
    title: 'Letters make sounds',
    body: 'Every letter makes a sound. When you put the sounds together in order, they make a word. That is called blending, and it is how everyone learns to read — one sound at a time.',
    simple: 'Every letter makes a sound. Put the sounds together and you get a word!',
    more: YT('phonics song for kids')
  },
  wind: {
    title: 'Why the wind blows',
    body: 'The sun warms some parts of the ground more than others. Warm air rises, cooler air rushes in to take its place, and that rushing air is the wind. Big birds ride rising warm air to soar without flapping.',
    simple: 'The sun warms the air. Warm air goes up, cool air rushes in. That rushing air is the wind!',
    more: YT('what causes wind for kids')
  }
};

/* ---------- hints: [full, simple] ---------- */
const HINTS = {
  start: ['Use the arrows to walk. Hold the arrow to gallop! Press SPACE to fly.', 'Arrows to walk. Hold to gallop! SPACE to fly.'],
  walk: ['Walk with the arrows. Hold to gallop!', 'Arrows to walk. Hold to gallop!'],
  fly: ['Hold SPACE (or the FLY button) to flap your wings. Let go to glide down.', 'Hold SPACE to fly up. Let go to glide.'],
  land: ['Come down gently to land. DOWN dives faster.', 'Come down to land.'],
  magic: ['Press E (or MAGIC) to use your horn. It wakes flowers, lights crystals, and cheers up grumpy clouds.', 'Press E for horn magic! It wakes flowers and lights crystals.'],
  talk: ['Walk up to a friend and press E to talk.', 'Walk up to a friend to talk.'],
  dash: ['Press SHIFT (or DASH) for a rainbow dash! It uses your sparkle meter.', 'SHIFT is a rainbow dash!'],
  stars: ['Fly through the floating stars to collect them. Stars buy things in the wardrobe.', 'Catch the stars! They buy pretty things.'],
  quest: ['Follow the big arrow to your next quest.', 'Follow the big arrow!'],
  clouds: ['You can land on the clouds! They are soft.', 'You can stand on clouds!'],
  water: ['Alicorns can tiptoe on water. Try walking across the lake!', 'You can walk on the water!'],
  night: ['It is night. Look up — the stars are out.', 'It is night. Look at the stars!'],
  storm: ['A grumpy storm cloud! Fly close and press E to cheer it up.', 'A grumpy cloud! Press E near it to cheer it up.'],
  ring: ['Fly through the rainbow rings!', 'Fly through the rings!'],
  wardrobe: ['You have enough stars for something new! Open the wardrobe.', 'You can buy something new! Open the wardrobe.'],
  map: ['Open the map to see the whole land. Tap a place and you fly there!', 'Open the map. Tap a place to fly there!'],
  sit: ['Hold DOWN while standing still to sit and rest.', 'Hold DOWN to sit down.'],
  moon: ['You are standing on the Moon!', 'You are on the Moon!'],
  p2: ['Player 2 joined! IJKL to move, U to fly, O for magic.', 'Player 2 is here! IJKL to move, U to fly, O for magic.'],
  foal: ['Your foal lives at the stable. Visit to feed her apples, brush her, play and dress her up.', 'Visit your baby at the stable! Feed, brush and play.'],
  apples: ['Use magic on an apple tree to shake the apples down, then walk over them.', 'Magic on the apple tree! Then pick up the apples.'],
  swim: ['Hold DOWN on the water to dive under. Swim with the arrows. Go up to come out.', 'Hold DOWN on the water to dive!'],
  skate: ['The lake is frozen! Gallop onto the ice and slide.', 'The lake is ice! Slide on it!'],
  salon: ['Open the salon to change your mane and tail styles.', 'Try the salon! New hair!'],
  race: ['Walk under the rainbow arch to start a race.', 'Go under the rainbow arch to race!'],
  free: ['The whole land is yours. Collect stars, dress up, take photos, visit your friends!', 'Explore! Catch stars, dress up, take photos, visit friends!']
};
