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
| `js/config.js` | Tunable constants, skins, themes and goals |
| `tests/` | Unit tests for the game rules |

## Extending

- **Skin or theme:** add an entry in `js/config.js`; set `unlock` to a goal id, or `null` for always available.
- **Goal:** add to `GOALS` using the stat `best`, `games` or `total`.

## Tests

    npm test    # Node 20+

## Notes

The leaderboard is stored per browser (localStorage). A shared one would need a backend.
