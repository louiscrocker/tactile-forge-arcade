/* ============================================================
   facts.js — the spiders, the cousins, the visitors, the facts
   ============================================================
   Everything here is real natural history, simplified for play.
   The animal is the western black widow, Latrodectus hesperus, in
   a dry back yard in the American Southwest.
   Each fact has a full version, a "little words" version and
   sometimes a link to see the real thing (a Wikipedia page or a
   YouTube search, never a guessed video URL).
   Hints live in hints.js.  No apostrophes inside single quotes!
   ============================================================ */
'use strict';

/* You choose at the start: a girl (black and red, the web builder) or a boy (small, striped, the traveller). */
const FORMS = {
  girl: { name: 'Girl black widow', short: 'Girl', latin: 'Latrodectus hesperus', male: false,
    blurb: 'She grows big, glossy black, with a red hourglass under her body. She builds a strong web, feels every hum in it, and spins a round egg sac.',
    simple: 'Black and red! She builds the big web.', power: 'The red hourglass' },
  boy: { name: 'Boy black widow', short: 'Boy', latin: 'Latrodectus hesperus', male: true,
    blurb: 'He stays small and striped, with long legs. When he is grown he leaves his web, follows a scent across the yard, and plucks her web gently to say hello.',
    simple: 'Small and striped! He walks far to find her.', power: 'The gentle pluck' }
};
const FORM_KEYS = Object.keys(FORMS);

/* the life wheel along the top of the screen */
const STAGES = [
  { key: 'sac', name: 'In the egg sac', short: 'Sac' },
  { key: 'ling', name: 'Spiderling', short: 'Tiny' },
  { key: 'young1', name: 'Striped young spider', short: 'Striped' },
  { key: 'young2', name: 'Dark young spider', short: 'Dark' },
  { key: 'adult', name: 'Grown black widow', short: 'Grown' },
  { key: 'parent', name: 'A new generation', short: 'Eggs' }
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/* molts: meals to each moult · preyGap: seconds between bugs · struggle: how long a bug stays stuck ·
   plucks / window: his courtship · spin: turns of the egg sac · guard: seconds by the sac · nightLen: seconds */
const DIFFICULTY = {
  easy:   { name: 'Little kid', molts: { girl: [2, 3, 3, 4, 5], boy: [2, 3, 3] }, preyGap: 5, struggle: 34, plucks: 2, window: .5, spin: 8, guard: 7, eggs: 200, nightLen: 70, visitors: false },
  normal: { name: 'Big kid', molts: { girl: [3, 4, 5, 6, 7], boy: [3, 4, 5] }, preyGap: 6, struggle: 25, plucks: 3, window: .4, spin: 12, guard: 9, eggs: 250, nightLen: 80, visitors: true },
  hard:   { name: 'Scientist', molts: { girl: [4, 5, 6, 8, 9], boy: [4, 5, 6] }, preyGap: 7, struggle: 18, plucks: 3, window: .3, spin: 16, guard: 11, eggs: 300, nightLen: 90, visitors: true }
};

/* the card book: who came by, and the widow spiders of the world (real animals), plus one that only looks like one */
const VISITORS = [
  { key: 'dauber', name: 'Blue mud dauber', latin: 'Chalybion californicum', where: 'North America', simple: 'A shiny blue wasp.', card: 'A shiny blue wasp that hunts spiders by day, black widows most of all. Stay in your den and it flies on.' },
  { key: 'lizard', name: 'Alligator lizard', latin: 'Elgaria multicarinata', where: 'Western North America', simple: 'A lizard with a long tail.', card: 'A long, slow lizard of western yards. Widow venom does not trouble it much. Curl up and keep still.' },
  { key: 'bird', name: 'Cactus wren', latin: 'Campylorhynchus brunneicapillus', where: 'The Southwest', simple: 'A bird of the cactus.', card: 'A bold bird of the desert. Birds see red very well, and scientists found they often leave a red hourglass alone.' },
  { key: 'mantis', name: 'Praying mantis', latin: 'Stagmomantis', where: 'North America', simple: 'It sits and waits.', card: 'It sits as still as a twig and watches for anything that moves. So do not move.' }
];
const COUSINS = [
  { key: 'western', name: 'Western black widow', latin: 'Latrodectus hesperus', where: 'Western North America', look: 'black', simple: 'That is you!', card: 'Glossy black with a red hourglass underneath. She lives in woodpiles, sheds and dry corners all over the West.' },
  { key: 'southern', name: 'Southern black widow', latin: 'Latrodectus mactans', where: 'South-eastern North America', look: 'black', simple: 'A cousin in the south.', card: 'So like the western black widow that only an expert can tell them apart.' },
  { key: 'northern', name: 'Northern black widow', latin: 'Latrodectus variolus', where: 'Eastern North America', look: 'split', simple: 'Her hourglass is in two bits.', card: 'Her hourglass is often broken into two red marks, and she keeps a row of red spots on her back.' },
  { key: 'brown', name: 'Brown widow', latin: 'Latrodectus geometricus', where: 'Warm places around the world', look: 'brown', simple: 'Brown, with an orange mark.', card: 'Tan and brown, with an orange hourglass. Her egg sacs are covered in little spikes.' },
  { key: 'redback', name: 'Redback', latin: 'Latrodectus hasselti', where: 'Australia', look: 'redback', simple: 'A red stripe on her back.', card: 'The widow of Australia. She wears her red on top: a stripe down her back.' },
  { key: 'katipo', name: 'Katipo', latin: 'Latrodectus katipo', where: 'New Zealand', look: 'redback', simple: 'She lives on the beach.', card: 'A rare cousin of the redback that lives only in the sand dunes of New Zealand.' },
  { key: 'med', name: 'Mediterranean black widow', latin: 'Latrodectus tredecimguttatus', where: 'Southern Europe to Central Asia', look: 'spots', simple: 'Black with red spots.', card: 'Black with red spots on her back. Her science name means thirteen spots.' },
  { key: 'false', name: 'False widow', latin: 'Steatoda grossa', where: 'Houses around the world', look: 'false', friend: true, simple: 'Not a widow at all!', card: 'Not a widow at all: a cousin from the same family that only looks like one. No red hourglass.' }
];

const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const wp = (t) => 'https://en.wikipedia.org/wiki/' + t;
const FACTS = {
  sac: { title: 'A round egg sac', body: 'A mother black widow spins a round, papery egg sac about as big as a marble and hangs it in her web. A few hundred eggs may be inside.', simple: 'Mum made a round silk sac. We are inside.', more: wp('Latrodectus_hesperus') },
  ling: { title: 'Spiderlings', body: 'Baby spiders are called spiderlings. Black widow spiderlings are tiny and pale, nothing like their black mother.', simple: 'A baby spider is a spiderling. It is tiny and pale.' },
  firstmolt: { title: 'One skin already', body: 'A widow spiderling sheds its first skin while it is still inside the egg sac. Then it bites a way out through the silk.', simple: 'I shed one skin inside the sac!' },
  balloon: { title: 'Ballooning', body: 'A spiderling climbs up high, stands on tiptoe and lets out a strand of silk. The moving air lifts the silk, and the spiderling goes with it. This is called ballooning.', simple: 'A spiderling lets out silk. The wind lifts it!', more: wp('Ballooning_(spider)') },
  thermal: { title: 'Warm air goes up', body: 'Sunny ground warms the air above it, and warm air rises. A ballooning spiderling in rising air goes up with it.', simple: 'Warm air goes up. So do you!' },
  home: { title: 'A dry, dark corner', body: 'Black widows like dry, sheltered places close to the ground: woodpiles, sheds, flowerpots, an old boot, the corner of a porch.', simple: 'Widows like dry, dark corners.' },
  web: { title: 'A tangle on purpose', body: 'A widow web looks like a messy tangle, but it has parts. There is a den to hide in, strong threads to hold it up, and sticky lines that run down to the ground.', simple: 'Her web looks messy. It is not!', more: wp('Spider_web') },
  silk: { title: 'Silk from spinnerets', body: 'Silk comes out as a liquid from little spouts at the end of her body, called spinnerets. It sets into a thread as she pulls it out.', simple: 'Silk comes from the end of her body.' },
  dragline: { title: 'A safety line', body: 'A spider trails a strong thread behind it, called a dragline. If it drops, it hangs on the line and can climb back up.', simple: 'A spider drops on a line. It can climb back up.' },
  strongsilk: { title: 'Stronger than steel?', body: 'Weight for weight, a spider dragline is stronger than steel. Scientists study black widow silk to learn how to make strong, stretchy threads.', simple: 'Her silk is very, very strong.', more: wp('Spider_silk') },
  gumfoot: { title: 'Gumfoot lines', body: 'The lines that run down to the ground have sticky drops of glue at the bottom. They are called gumfoot lines, and they are stretched tight.', simple: 'The lines to the ground have sticky feet.' },
  gumsnap: { title: 'Snap!', body: 'When a walking bug bumps a gumfoot line, the line lets go of the ground and springs back up, with the bug stuck to it. Now its feet can not reach the ground.', simple: 'A bug bumps the line. Snap! Up it goes.', more: yt('black widow gumfoot line prey capture') },
  feel: { title: 'She sees with her feet', body: 'A black widow has eight eyes, but she sees poorly. She feels. Her legs pick up the smallest shake in the silk, and that tells her what is in her web and where.', simple: 'She can not see well. She feels the web shake.' },
  pulse: { title: 'What the web says', body: 'A stuck bug shakes the web in quick bursts. A leaf swings slowly. A courting male plucks in a soft, steady beat. She can tell them apart.', simple: 'Quick shakes mean a bug!' },
  comb: { title: 'Comb feet', body: 'Widows belong to the comb-footed spiders. A row of curved bristles on each back foot combs out sticky silk and flings it over a bug.', simple: 'Her back feet have combs. They fling silk!', more: wp('Theridiidae') },
  snack: { title: 'A drink, not a bite', body: 'A spider can not chew. She wraps her meal in silk, and later she sips it like a drink.', simple: 'A spider can not chew. She sips.' },
  drink: { title: 'A patient hunter', body: 'A black widow can go a long time between meals. She waits in her den, with one foot on the web.', simple: 'She waits, and waits, and feels.' },
  leaf: { title: 'Not everything is food', body: 'Leaves and bits of dry grass blow into webs all the time. A spider cuts them loose and lets them drop.', simple: 'A leaf! She cuts it out.' },
  molt: { title: 'Growing out of your skin', body: 'A spider wears its skeleton on the outside, and it can not stretch. To grow, she hangs from a thread, splits her old skin and pulls herself out of it. This is called moulting.', simple: 'Her skin is too tight. She gets a new one.' },
  colours: { title: 'Not black yet', body: 'Young black widows are not black. They are pale, then striped in white, orange and brown. They get darker with each moult.', simple: 'Young ones are striped, not black.' },
  eightlegs: { title: 'Eight legs', body: 'Spiders are not insects. They have eight legs, not six, and two body parts, not three. They are arachnids, like scorpions.', simple: 'Eight legs! A spider is not an insect.' },
  eyes: { title: 'Eight eyes', body: 'A black widow has eight small eyes in two rows. Even so, she finds her way mostly by touch.', simple: 'Eight eyes. But she feels her way.' },
  hourglass: { title: 'The red hourglass', body: 'A grown female is glossy black, with a red mark shaped like an hourglass under her body. She hangs upside down in her web, so the red faces up.', simple: 'Black, with a red mark underneath.' },
  warning: { title: 'Red means stay away', body: 'In a study, wild birds were about three times less likely to peck a model widow that had a red hourglass. Scientists think the red is a warning that birds see well and insects hardly see at all.', simple: 'Birds see the red. They stay away.' },
  bigweb: { title: 'A bigger web', body: 'A grown female builds a wide, strong web and may use the same one for a long time, mending it every night.', simple: 'She mends her web every night.' },
  boy: { title: 'A very different boy', body: 'A grown male black widow is far smaller than a female. He keeps his stripes and has long legs.', simple: 'A boy stays small and striped.' },
  scent: { title: 'A scent on the silk', body: 'A female leaves a scent on her silk. A grown male leaves his own web and wanders off to find a web that smells right.', simple: 'He smells her silk. He goes to find her.' },
  courtship: { title: 'Plucking hello', body: 'A male plucks and shakes the female web to say who he is. His shakes are soft and steady, very different from the quick jerks of a stuck bug.', simple: 'He plucks her web, soft and slow.', more: yt('black widow male courtship web vibration') },
  careful: { title: 'Soft and steady', body: 'Scientists played shakes into widow webs. Soft ones did not make the females attack. So a careful male is a safe male.', simple: 'Soft plucks keep him safe.' },
  bundle: { title: 'Folding up her web', body: 'A male western black widow often cuts bits of the female web and bundles them up in his own silk. Scientists think this helps to keep her calm.', simple: 'He folds up a bit of her web.' },
  malelife: { title: 'He walks away', body: 'People say the female always eats the male. In western black widows that is rare. Most males simply walk away.', simple: 'He says goodbye and walks away.' },
  eggs: { title: 'Hundreds of eggs', body: 'She lays her eggs into a little silk cup, then spins round and round until it is a tough, round sac. She guards it in her web.', simple: 'She spins and spins. A round egg sac!' },
  sacs: { title: 'More than one', body: 'A female can make several egg sacs in one summer, and she may live for a year or more as a grown spider. A grown male lives only a few weeks or months.', simple: 'She can make more egg sacs.' },
  lifecycle: { title: 'The whole life', body: 'Egg sac, spiderling, moult after moult, a grown spider, and a new egg sac. Spiders do not have a pupa: they just grow, one skin at a time.', simple: 'Sac, spiderling, moults, grown-up. Then it starts again.' },
  dauber: { title: 'The blue mud dauber', body: 'This shiny blue wasp hunts spiders by day to feed its young, and black widows are its favourite. A widow deep in her den is hard to reach.', simple: 'A blue wasp looks for spiders by day.', more: wp('Chalybion_californicum') },
  lizard: { title: 'The alligator lizard', body: 'Alligator lizards poke about in woodpiles and under pots. Scientists found that widow venom hardly troubles them.', simple: 'A lizard pokes about in the yard.', more: wp('Southern_alligator_lizard') },
  bird: { title: 'A bird at dawn', body: 'Birds hunt by sight. A black spider hanging upside down, showing a bright red mark, is easy to see, and easy to leave alone.', simple: 'A bird! Show it your red mark.' },
  mantis: { title: 'The mantis', body: 'A praying mantis hunts by watching for movement. Anything that keeps still is hard for it to notice.', simple: 'A mantis looks for things that move.' },
  playdead: { title: 'Drop and curl', body: 'A frightened widow often drops out of her web on a line, pulls in her legs and lies still, like a little dark seed.', simple: 'She drops, curls up and keeps still.' },
  broom: { title: 'Webs can be mended', body: 'People sweep webs away. A widow that is safe in her den just waits, and spins again that night.', simple: 'The web is gone. She spins it again.' },
  never: { title: 'Look. Do not touch.', body: 'A black widow is shy. She does not chase people. She bites only if she is pressed or squeezed. But her bite can make a person very sick. So look, and do not touch. Do not put your hand where you can not see. If you see one, tell a grown-up.', simple: 'Look. Do not touch. Tell a grown-up.', more: wp('Latrodectus') },
  shy: { title: 'A shy spider', body: 'A widow in the light of a torch usually runs for her den or drops and curls up. She would much rather hide than bite.', simple: 'She is shy. She hides.' },
  cousins: { title: 'Widows of the world', body: 'Scientists have named about thirty kinds of widow spider, on every continent except Antarctica. Each one you meet goes in your card book.', simple: 'There are about 30 kinds of widow spider!' }
};

/* 0 by day, 1 at night (tod: 0 = midnight, .25 sunrise, .5 noon, .8 sunset) */
function nightAmount(tod) {
  if (tod < .2) return 1;
  if (tod < .3) return 1 - smoothstep(.2, .3, tod);
  if (tod > .74) return smoothstep(.74, .84, tod);
  return 0;
}
