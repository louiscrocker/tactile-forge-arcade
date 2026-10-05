# Tactile Forge Arcade

Free browser games, published as a static site with GitHub Pages from `docs/`.

- **The Arcade:** vector-tube games such as Last Silo, Soft Touchdown and Rubble Drift.
- **Nature & Reading:** adventures for young readers, such as Frog Pond and Ladybug Life.

Each game lives in its own folder under `docs/<slug>/`, packaged from the committed
`HEAD` of that game's own (private) repository. `docs/<slug>/build.json` records
the source commit and a SHA-256 for every file. The site loads nothing from any
other website: fonts are self-hosted, and there are no analytics, ads or cookies.

## Updating a game

```sh
node tools/selfhost-fonts.mjs <gameRepo>       # once per game, then commit in that repo
node tools/package-game.mjs <gameRepo> <slug>  # copies its committed files into docs/<slug>/
node tools/server.js --root docs --port 5190   # preview at http://127.0.0.1:5190/
node tools/probe.mjs http://127.0.0.1:5190/<slug>/ size:1440x900 wait:4000 shot:shots-raw/<slug>-title.png
node tools/thumbs.mjs shots-raw                # PNG screenshots → docs/assets/shots/*.webp
```

`probe.mjs` exits non-zero if a page has a failed request, any third-party
request, or a console error. Commit and push `main`, and Pages republishes
within a couple of minutes.

The game list and card text live in `docs/assets/games.js`.

## Audit

`pwsh tools/audit.ps1` compares every live game with its repo's latest commit, lists game folders that
aren't published, probes every live page for failed or third-party requests, and reports
Cabinet Edition download counts and open feedback issues. Run it before and after an update.

## Feedback and itch.io

- **Feedback:** players send it through the **Game feedback** issue form
  (`.github/ISSUE_TEMPLATE/feedback.yml`). Each card's "Feedback" link opens
  that form with the game already chosen. Issues are labelled `feedback`.
- **itch.io:** to publish the games there as well, see [ITCH.md](ITCH.md).

## Rights

© 2026 Tactile Forge. All rights reserved. The games are free to play, but the
code and art are not licensed for reuse. The bundled fonts (Orbitron, Inter,
VT323 and the others in each game's `fonts/` folder) are under the SIL Open Font
License; each licence sits beside its font files.
