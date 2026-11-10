# Flappy Birds

A dependency-free Flappy Bird clone with detailed canvas art, procedural music, unlockable skins and themes, goals and a local leaderboard.

## Run

ES modules need http(s), so serve the folder instead of opening `index.html` directly:

    npx serve .        # or: python3 -m http.server

Or publish it with GitHub Pages (Settings → Pages → deploy from `main`).

## Controls

Tap, click, Space or ↑ to flap.

## Project layout

| Path | Responsibility |
| --- | --- |
| `index.html`, `css/style.css` | Page shell, layout and menu styling |
| `js/main.js` | Entry point: input, fixed-timestep loop, wiring |
| `js/game.js` | Pure game rules (physics, pipes, scoring), no DOM |
| `js/renderer.js` | All canvas drawing |
| `js/audio.js` | Procedural music and sound effects (Web Audio) |
| `js/ui.js` | Menu, customization, goals and leaderboard overlays |
| `js/goals.js` | Goal progress and completion |
| `js/storage.js` | localStorage persistence |
| `js/fx.js` | Pooled particles, shake, flash and score pop (reduced-motion aware) |
| `js/rng.js` | Seeded random numbers and the daily-challenge seed |
| `js/daily.js` | The three daily goals (seeded by date, paid in coins) |
| `js/story-data.js` | Story content: cast, chapters, dialogue, decisions, endings |
| `js/story.js` | Story state machine (clock, hearts, flags, endings), pure logic |
| `js/config.js` | Tunable constants, skins, themes and goals |
| `tests/` | Unit tests for the game rules |

## Extending

- **Skin or theme:** add an entry in `js/config.js`; set `unlock` to a goal id, or `null` for always available.
- **Goal:** add to `GOALS` using the stat `best`, `games` or `total`.
- **Mode:** add an entry to `MODES` in `js/config.js` (`ranked: false` makes it practice-only).

## Tests

    npm test    # Node 20+

## Notes

The leaderboard is stored per browser (localStorage). A shared one would need a backend.

## Story mode

"Home Before Lights-Out": Pip clocks out at 7:50 PM and has until 8:30 PM to reach Robin and Finch. Five chapters with cutscenes and dialogue; at the end of each flight a pipe with two openings (A or B) lets you choose the path by flying through one. Every pipe costs a minute and a stumble costs two (a crash never ends the run), so your choices and your flying decide which of four endings you earn. Content lives in `js/story-data.js`, the engine in `js/story.js`.
