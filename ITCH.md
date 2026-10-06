# Putting the games on itch.io

itch.io hosts browser games for free. It gives each game its own page, a
discovery feed, view and play counts, comments and ratings. Players still get
the same files as on the arcade site.

## Build the uploads

```sh
node tools/itch-zips.mjs                 # itch/<slug>.zip, index.html at the root
node tools/thumbs.mjs shots-raw --itch   # itch/art/<slug>-cover.png (630×500) + -1/-2.png screenshots
```

Both outputs land in `itch/`, which git ignores. Rebuild them after republishing a game.

## Order

1. **The five arcade games first:** Last Silo, Soft Touchdown, Rubble Drift,
   Periscope Front and Lightwake. They are aimed at general audiences and are
   ready now.
2. **The six nature and reading games after HQ's kids-privacy task is done:**
   on-device voices, plus a grown-ups gate in front of the microphone and the
   outbound links. Also read itch.io's terms on content aimed at children
   before listing them. Unlike the arcade site, itch's own pages carry its
   cookies and analytics.

## Page settings (same for every game unless noted)

| Setting | Value |
|---|---|
| Kind of project | HTML |
| Upload | `itch/<slug>.zip`, tick **This file will be played in the browser** |
| Embed options | Embed in page · viewport **1280 × 800** · tick **Fullscreen button** · tick **Click to launch in fullscreen** on phones only if offered |
| Mobile friendly | **Off** for the keyboard or mouse games (Soft Touchdown, Rubble Drift, Periscope Front, Lightwake, Trenchfire, Monarch Journey). **On** for Last Silo, Close-Hauled and the touch-capable nature games |
| SharedArrayBuffer | Off (no game needs it) |
| Pricing | **No payments** (or "Donate" if you want a tip jar) |
| Classification | Games |
| Release status | Released |
| Cover image | `itch/art/<slug>-cover.png` |
| Screenshots | `itch/art/<slug>-1.png`, `<slug>-2.png` |
| Community | Comments **on** (this is your feedback channel) |
| Visibility | Draft → check the page plays → Public |

The project URL slug should match ours (for example `last-silo`).

## Page text

Copy the tagline and description from `docs/assets/games.js`. Add one line at the end:
*"Also playable with the rest of the collection at https://louiscrocker.github.io/tactile-forge-arcade/"*.

| Game | Genre | Tags (itch allows 10) |
|---|---|---|
| Last Silo | Action | arcade, retro, vector, missile-defense, webgl, shooter, singleplayer, high-score, neon, browser |
| Soft Touchdown | Simulation | arcade, retro, vector, lander, physics, space, webgl, singleplayer, high-score, browser |
| Rubble Drift | Shooter | arcade, retro, vector, space, asteroids-like, webgl, singleplayer, high-score, neon, browser |
| Periscope Front | Shooter | arcade, retro, vector, tanks, first-person, wireframe, 3d, webgl, singleplayer, browser |
| Lightwake | Action | arcade, retro, neon, racing, snake-like, webgl, singleplayer, high-score, light-bikes, browser |
| Trenchfire | Shooter | arcade, retro, vector, space, rail-shooter, wireframe, webassembly, singleplayer, high-score, browser |
| Close-Hauled | Board game | sailing, dice, racing, turn-based, hot-seat, local-multiplayer, family-friendly, strategy, browser, singleplayer |
| Frog Pond | Educational | kids, reading, nature, frogs, life-cycle, educational, cute, family-friendly, browser, singleplayer |
| Ladybug Life | Educational | kids, reading, nature, insects, life-cycle, educational, cute, family-friendly, browser, singleplayer |
| Monarch Journey | Educational | kids, reading, nature, butterflies, migration, educational, local-co-op, family-friendly, browser, cute |
| Alicorn Skies | Adventure | kids, reading, unicorn, fantasy, cute, family-friendly, educational, exploration, browser, singleplayer |
| Burrow & Brood | Simulation | kids, ants, colony-sim, nature, educational, reading, family-friendly, sandbox, browser, singleplayer |
| Hercules: Rainforest Giant | Adventure | kids, beetles, insects, life-cycle, nature, educational, reading, family-friendly, browser, singleplayer |
| Red Crab: The Great March | Adventure | kids, crabs, ocean, migration, life-cycle, nature, educational, reading, family-friendly, browser |
| Storm Lab | Educational | weather, tornado, science, simulation, educational, kids, stem, webgl, radar, browser |

Tag names must not mention the original arcade titles. "asteroids-like" and
"snake-like" are itch's standard genre-family tags; drop them if you'd prefer to
avoid any echo of the originals.

## Uploading with butler (optional)

butler is itch.io's command-line uploader. Install it, run `butler login` once,
then:

```sh
butler push itch/last-silo.zip <your-itch-name>/last-silo:html5
```

Create each game's page on the itch website first; butler only uploads files.
Pushing again replaces the build and keeps the page, comments and stats.

## Reading the numbers and feedback

For each game, itch's dashboard has an **Analytics** tab with views, plays and
referrers. The page's **comments** sit under the game. Ask in a session to "go
through the feedback": the GitHub issues (label `feedback`) and the itch comments
get triaged into HQ tasks, fixed, checked and republished.
