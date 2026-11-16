/* ============================================================
   facts.js — the parrots, the cousins, the visitors, the facts
   ============================================================
   Everything here is real natural history, simplified for play.
   The animal is the scarlet macaw, Ara macao, in the lowland
   rainforest of south-east Peru, by a river with a clay lick.
   Each fact has a full version, a "little words" version and
   sometimes a link to see the real thing (a Wikipedia page or a
   YouTube search, never a guessed video URL).
   Hints live in hints.js.  No apostrophes inside single quotes!
   ============================================================ */
'use strict';

/* Boy and girl scarlet macaws look the same.  What differs is the last chapter. */
const FORMS = {
  girl: { name: 'Girl scarlet macaw', short: 'Girl', latin: 'Ara macao', male: false,
    blurb: 'Red, yellow and blue, just like the boy. When she is grown she lays the eggs and keeps them warm in the hollow, while her mate brings food.',
    simple: 'Red, yellow and blue! She sits on the eggs.', power: 'Keeps the eggs warm' },
  boy: { name: 'Boy scarlet macaw', short: 'Boy', latin: 'Ara macao', male: true,
    blurb: 'Red, yellow and blue, just like the girl. When he is grown he flies out for food, again and again, and carries it home to his mate on the eggs.',
    simple: 'Red, yellow and blue! He brings the food.', power: 'Brings food home' }
};
const FORM_KEYS = Object.keys(FORMS);

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'egg', name: 'In the egg', short: 'Egg' },
  { key: 'chick', name: 'Chick in the hollow', short: 'Chick' },
  { key: 'fledge', name: 'First flights', short: 'Fly' },
  { key: 'young', name: 'Young macaw', short: 'Young' },
  { key: 'adult', name: 'Grown scarlet macaw', short: 'Grown' },
  { key: 'parent', name: 'A new generation', short: 'Eggs' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* feeds: meals to each new coat of feathers · feedGap: seconds between meals · flaps: at the door ·
   figs / clay / nuts: how many for a lesson · preens / window: making friends · eggs · sitFeeds: meals on the eggs ·
   trips / crop: his food runs, and figs to a full crop */
const DIFFICULTY = {
  easy:   { name: 'Little kid', feeds: [2, 2, 3], feedGap: 3, flaps: 4, figs: 2, clay: 2, nuts: 1, preens: 2, window: .5, eggs: 2, sitFeeds: 2, trips: 2, crop: 2, visitors: false },
  normal: { name: 'Big kid', feeds: [3, 3, 3], feedGap: 4, flaps: 6, figs: 3, clay: 3, nuts: 2, preens: 3, window: .4, eggs: 3, sitFeeds: 3, trips: 2, crop: 3, visitors: true },
  hard:   { name: 'Scientist', feeds: [3, 4, 4], feedGap: 5, flaps: 8, figs: 4, clay: 4, nuts: 3, preens: 4, window: .3, eggs: 3, sitFeeds: 3, trips: 3, crop: 3, visitors: true }
};

/* the card book: who came by, who shares the forest, and the parrots of the world (all real animals) */
const VISITORS = [
  { key: 'toucan', name: 'White-throated toucan', latin: 'Ramphastos tucanus', where: 'The Amazon', simple: 'A bird with a huge beak.', card: 'A big toucan with a beak like a banana. It eats fruit, and it looks into nest holes too. A loud squawk sends it on its way.' },
  { key: 'eagle', name: 'Ornate hawk-eagle', latin: 'Spizaetus ornatus', where: 'Central and South America', simple: 'A hunter with a crest.', card: 'A forest eagle with a tall crest. Eagles and hawks hunt parrots, so parrots watch the sky. When one bird sees a hunter, the whole flock goes up.' },
  { key: 'bees', name: 'Honey bees', latin: 'Apis mellifera', where: 'Hollows everywhere', simple: 'Bees! Bzzz!', card: 'Bees like a dry hollow too. A swarm that moves in keeps the hole. Macaws look for another one.' }
];
const COUSINS = [
  { key: 'scarlet', name: 'Scarlet macaw', latin: 'Ara macao', where: 'Mexico to the Amazon', look: 'scarlet', simple: 'That is you!', card: 'Red, with yellow and blue wings and a bare white face. One of the biggest parrots, almost a metre from beak to tail tip.' },
  { key: 'blueyellow', name: 'Blue-and-yellow macaw', latin: 'Ara ararauna', where: 'South America', look: 'blue', simple: 'Blue on top, yellow below.', card: 'Blue on top and gold underneath. It often nests in dead palm trees and comes to the same clay licks.' },
  { key: 'redgreen', name: 'Red-and-green macaw', latin: 'Ara chloropterus', where: 'South America', look: 'redgreen', simple: 'Red, with green on its wings.', card: 'Bigger than a scarlet macaw, with green on its wings where yours are yellow, and thin red lines on its face.' },
  { key: 'mealy', name: 'Mealy parrot', latin: 'Amazona farinosa', where: 'Central and South America', look: 'green', simple: 'A green parrot.', card: 'A big green parrot that looks dusted with flour. Flocks of them come to the clay lick early in the morning.' },
  { key: 'hyacinth', name: 'Hyacinth macaw', latin: 'Anodorhynchus hyacinthinus', where: 'Brazil', look: 'hyacinth', simple: 'The biggest! All blue.', card: 'The longest parrot in the world, deep blue all over, with a beak that can crack the hardest palm nuts.' },
  { key: 'kea', name: 'Kea', latin: 'Nestor notabilis', where: 'New Zealand', look: 'kea', simple: 'A parrot of the snow.', card: 'A clever green parrot of the mountains, with orange under its wings. It lives where it snows.' },
  { key: 'kakapo', name: 'Kakapo', latin: 'Strigops habroptila', where: 'New Zealand', look: 'kakapo', simple: 'It can not fly!', card: 'A fat, mossy green parrot that comes out at night and can not fly. It is the heaviest parrot, and very rare.' },
  { key: 'grey', name: 'Grey parrot', latin: 'Psittacus erithacus', where: 'Central Africa', look: 'grey', simple: 'Grey, with a red tail.', card: 'Grey with a red tail. It is famous for copying sounds and words.' },
  { key: 'cockatoo', name: 'Sulphur-crested cockatoo', latin: 'Cacatua galerita', where: 'Australia and New Guinea', look: 'cockatoo', simple: 'White, with a yellow crest.', card: 'White, with a yellow crest it can lift like a fan. Cockatoos are parrots too.' },
  { key: 'budgie', name: 'Budgerigar', latin: 'Melopsittacus undulatus', where: 'Australia', look: 'budgie', simple: 'A tiny green parrot.', card: 'A small green and yellow parrot of the dry grasslands. Wild budgerigars fly in huge flocks.' }
];

const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const wp = (t) => 'https://en.wikipedia.org/wiki/' + t;
const FACTS = {
  egg: { title: 'An egg in a hollow', body: 'Scarlet macaws nest in a hole high in a big tree. The mother lays her white eggs on the floor of the hollow and keeps them warm for about three and a half weeks.', simple: 'Mom laid a white egg in a hole in a tree.', more: wp('Scarlet_macaw') },
  chick: { title: 'A chick with no feathers', body: 'A macaw chick hatches pink and bare, with its eyes shut. It can not stand or see. It can only lift its head and beg.', simple: 'A new chick is pink. It has no feathers.' },
  crop: { title: 'Food from the crop', body: 'Parents carry food home in a pouch in the throat called a crop. At the nest they bring it back up, soft and warm, into the beak of the chick.', simple: 'Mom and Dad bring food in a pouch.' },
  name: { title: 'A name that is a call', body: 'Wild parrots have a call that works like a name. Scientists who filmed the nests of little green parrotlets found that each chick learns its own call from the calls its parents make. Scientists think macaws do something like it.', simple: 'A parrot has a name. It is a call!', more: wp('Green-rumped_parrotlet') },
  namecall: { title: 'Calling by name', body: 'Parrots use these calls to find each other in the thick forest. A bird can call to one friend by copying the call of that friend.', simple: 'Call, and your family can find you.' },
  pins: { title: 'Pin feathers', body: 'New feathers grow rolled up inside thin tubes, like little pins. The tubes flake away and the feathers open.', simple: 'New feathers look like pins.' },
  feathers: { title: 'Red, yellow and blue', body: 'A scarlet macaw is red, with a band of yellow and then blue on each wing, a long red tail, and a bare white face.', simple: 'Red, yellow and blue feathers!' },
  fledge: { title: 'Three months in the hollow', body: 'A macaw chick stays in the hollow for about three months. By then it is nearly as big as its parents.', simple: 'A chick stays in the hollow a long time.' },
  wings: { title: 'Wing practice', body: 'Before it ever flies, a chick stands and flaps hard inside the hollow and at the door. That makes its flying muscles strong.', simple: 'Flap, flap! It makes wings strong.' },
  firstflight: { title: 'Leaving the hollow', body: 'Leaving the nest is called fledging. The first flight is wobbly. The parents call from a branch close by, and the young bird flies to them.', simple: 'The first flight is wobbly!', more: yt('scarlet macaw chick fledging tambopata') },
  toucan: { title: 'The toucan', body: 'Toucans eat mostly fruit, but they also look into nest holes for eggs and small chicks. Macaw parents chase them away with a great deal of noise.', simple: 'A toucan looks in. Squawk!', more: wp('White-throated_toucan') },
  eagle: { title: 'Eyes on the sky', body: 'Forest eagles hunt parrots. So parrots stay in flocks, and every bird watches the sky.', simple: 'An eagle! The flock sees it.', more: wp('Ornate_hawk-eagle') },
  manyeyes: { title: 'Many eyes', body: 'At a clay lick one alarm call sends every bird into the air at once. Most alarms turn out to be nothing. It is safer to go up and look.', simple: 'One bird calls. They all fly up!' },
  green: { title: 'Hard to see in the leaves', body: 'A red bird sounds easy to spot. But in the top of a tree, among leaves, fruit and flecks of sunlight, a still macaw is very hard to see.', simple: 'In the leaves, you are hard to see.' },
  science: { title: 'Scientists who climb', body: 'In Peru, scientists climb ropes to macaw nests. They weigh and measure the chicks, then put them straight back. It shows them what macaws need.', simple: 'A scientist weighs the chick. Then puts it back.', more: yt('Tambopata Macaw Project nest climbing chick') },
  wild: { title: 'Wild parrots stay wild', body: 'People come a long way to watch the clay lick. They sit quietly, far off, and use binoculars. The birds are never touched or fed.', simple: 'We look from far away. We are quiet.' },
  pets: { title: 'Not from the forest', body: 'Taking parrots from the wild to sell as pets is one reason some kinds are now rare. A wild parrot belongs in the forest, with its flock.', simple: 'A wild parrot lives in the forest.' },
  fruit: { title: 'Fruit, seeds and nuts', body: 'Macaws eat fruit, seeds, nuts, flowers and leaves from many kinds of tree. Young birds learn what to eat by following their parents.', simple: 'Parrots eat fruit and seeds.' },
  seeds: { title: 'Messy eaters', body: 'A macaw drops a lot of what it picks. Seeds and bits of fruit fall to the forest floor, where other animals eat them.', simple: 'Parrots drop bits. Others eat them.' },
  beak: { title: 'A beak like a nutcracker', body: 'A macaw beak is curved and very strong. The top half is hinged, and the tongue is thick and dry. Together they can turn a nut and crack it open.', simple: 'A parrot beak can crack a nut.' },
  foot: { title: 'A foot like a hand', body: 'A parrot has two toes pointing forward and two back. It holds food in one foot and lifts it to its beak, the way you hold a sandwich.', simple: 'A parrot holds food in its foot.' },
  clay: { title: 'The clay lick', body: 'On some river banks in the Amazon, hundreds of parrots gather in the morning to eat clay. A place like this is called a clay lick.', simple: 'Parrots eat clay from the bank!', more: yt('Tambopata clay lick macaws') },
  lick: { title: 'Why eat clay?', body: 'The clay has salt in it, and salt is hard to find in the rainforest. Scientists think that is the main reason the birds come. It may also help with the bitter seeds they eat.', simple: 'The clay has salt in it.' },
  loud: { title: 'A very loud voice', body: 'The squawk of a macaw carries a long way over the treetops. That is the point: it has to reach the rest of the family.', simple: 'A macaw is very, very loud.' },
  contact: { title: 'Where are you?', body: 'Birds in a family call back and forth as they fly and feed. If one drops out of sight, it calls, and the others answer.', simple: 'I call. My family calls back.' },
  roost: { title: 'A tree for the night', body: 'In the evening, macaws fly to a tall tree and settle side by side for the night.', simple: 'At night, parrots sleep in a tall tree.' },
  grown: { title: 'Slow to grow up', body: 'A young macaw stays with its parents for a year or more. It is three or four years old before it starts a family of its own.', simple: 'It takes years to grow up.' },
  lone: { title: 'Looking for a friend', body: 'Young macaws without a mate gather in flocks. A clay lick is a good place to meet.', simple: 'A young macaw looks for a friend.' },
  preen: { title: 'Preening', body: 'A bird keeps its feathers clean and smooth with its beak. This is called preening. A pair of macaws preen each other, most of all on the head, where a bird can not reach by itself.', simple: 'Parrots clean feathers with a beak.' },
  pair: { title: 'A pair for life', body: 'Scarlet macaws that pair up usually stay together for life. They feed together, rest together and raise their chicks together.', simple: 'Two macaws stay friends for life.' },
  wingtowing: { title: 'Wing to wing', body: 'Look at a flock of macaws in the sky and you can pick out the pairs. They fly side by side, so close that their wings almost touch.', simple: 'A pair fly side by side.' },
  hollows: { title: 'Not enough holes', body: 'A macaw can not dig a hollow. It needs an old, giant tree with a hole already in it. There are never enough, and toucans, bees and other macaws want them too.', simple: 'Good holes are hard to find.' },
  nestbox: { title: 'A box for a nest', body: 'Scientists and local people hang nest boxes high in the trees. Macaws do move in and raise chicks in them.', simple: 'People put up a box. Macaws nest in it!' },
  deadpalm: { title: 'A dead palm', body: 'When a tall palm dies, its top rots away and leaves a tube. Macaws nest inside these dead palms, blue-and-yellow macaws most of all.', simple: 'A dead palm makes a good nest.' },
  eggs: { title: 'Two or three eggs', body: 'A scarlet macaw lays two to four round, white eggs. The mother does most of the sitting, for about three and a half weeks.', simple: 'She lays two or three white eggs.' },
  share: { title: 'One sits, one brings', body: 'While the mother keeps the eggs warm, the father flies out to feed and comes back to feed her at the nest.', simple: 'She sits. He brings the food.' },
  lifecycle: { title: 'The whole life', body: 'Egg, chick, first flight, a year of learning with the family, a mate, a hollow, and eggs again.', simple: 'Egg, chick, fly, grow up. Then it starts again.' },
  longlife: { title: 'A long life', body: 'A scarlet macaw can live for forty years or more. A pair stays together all that time.', simple: 'A macaw can live for forty years!' },
  cousins: { title: 'Parrots of the world', body: 'There are about four hundred kinds of parrot, from tiny pygmy parrots to the great macaws. Each one you meet goes in your card book.', simple: 'There are about 400 kinds of parrot!', more: wp('Parrot') }
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .74) return smoothstep(.74, .84, tod);
  return 0;
}
