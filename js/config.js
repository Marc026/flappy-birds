/**
 * config.js — every tunable value lives here, so gameplay can be tweaked without touching logic.
 */

export const W = 320;      // logical game width (px)
export const H = 480;      // logical game height (px)
export const SCALE = 2;    // canvas backing-store multiplier (sharper on HiDPI screens)

/** Physics, applied once per fixed 1/60 s tick. */
export const PHYS = { gravity: 0.4, flap: -6.5 };

/** World layout and pacing (px and ticks). */
export const WORLD = {
  speed: 2,        // pipe/ground scroll speed per tick
  pipeW: 52,       // pipe width
  birdX: 80,       // the bird's fixed horizontal position
  birdR: 12,       // bird collision radius
  groundH: 40,     // ground strip height
  gap: 120,        // pipe opening at score 0 ...
  minGap: 96,      // ... shrinking toward this as the score rises
  decisionSpawn: 220,   // story: ticks between the last ordinary pipe and the decision pipe (empty sky = time to read the options)
  spawn: 110,      // ticks between pipe pairs
};

/** Bird skins. `unlock` = id of the goal that unlocks it (null = always available); `cost` = coin price, a second way to unlock. */
export const SKINS = [
  { id: 'sun',  name: 'Sunny', body: '#ffcc00', belly: '#fff2a8', wing: '#ff9900', unlock: null },
  { id: 'rose', name: 'Rosie', body: '#ff7aa8', belly: '#ffd6e5', wing: '#d63b78', unlock: 'score10', cost: 25 },
  { id: 'sky',  name: 'Azure', body: '#4da6ff', belly: '#d2e9ff', wing: '#1f6fcf', unlock: 'games10', cost: 40 },
  { id: 'coal', name: 'Shade', body: '#555a66', belly: '#a5abb8', wing: '#2b2f38', unlock: 'score25', cost: 60 },
];

/** Background themes (sky gradient, hills, clouds, optional stars). */
export const THEMES = [
  { id: 'day',   name: 'Day',   top: '#5ec8ff', bottom: '#c6f0ff', hill: '#8fd39a', cloud: '#ffffff', stars: false, unlock: null },
  { id: 'dusk',  name: 'Dusk',  top: '#ff8a5c', bottom: '#ffd29a', hill: '#c06a7a', cloud: '#ffe9d6', stars: false, unlock: 'total50', cost: 30 },
  { id: 'night', name: 'Night', top: '#0b1d4d', bottom: '#3c5a9a', hill: '#1f3b5c', cloud: '#7d8fb8', stars: true,  unlock: 'score15', cost: 50 },
];

/** Goals: reach `target` on a saved stat — 'best' (top score), 'games' (runs played) or 'total' (pipes passed). */
export const GOALS = [
  { id: 'score5',  text: 'Score 5 in one run',     stat: 'best',  target: 5 },
  { id: 'score10', text: 'Score 10 in one run',    stat: 'best',  target: 10 },
  { id: 'score15', text: 'Score 15 in one run',    stat: 'best',  target: 15 },
  { id: 'score25', text: 'Score 25 in one run',    stat: 'best',  target: 25 },
  { id: 'games10', text: 'Play 10 games',          stat: 'games', target: 10 },
  { id: 'total50', text: 'Pass 50 pipes in total', stat: 'total', target: 50 },
];

/** Score-driven difficulty: scroll speed grows with the score; pipes start swaying at `swayFrom` points. */
export const RAMP = { speedPerPoint: 0.04, maxExtraSpeed: 1.2, swayFrom: 15, swayAmp: 18 };

/** Medals shown on the game-over screen, best first. */
export const MEDALS = [
  { min: 30, name: 'Gold', c: '#ffd700' },
  { min: 20, name: 'Silver', c: '#c0c8d0' },
  { min: 10, name: 'Bronze', c: '#cd7f32' },
];

/** Chance that a pipe pair carries a coin in its opening. */
export const COIN_CHANCE = 0.5;

/**
 * Game modes: tuning presets chosen from the menu (add a mode by adding an entry).
 * gap/minGap = pipe opening in px (shrinks with score down to minGap), speed = base scroll speed,
 * ramp = multiplier on the score-driven speed-up (0 = none), sway = pipes may sway late-game,
 * ranked: false = practice mode (coins count, but score stats, leaderboard and goals do not).
 */
export const MODES = {
  classic: { name: 'Classic', gap: WORLD.gap, minGap: WORLD.minGap, speed: WORLD.speed, ramp: 1, sway: true },
  hard: { name: 'Hard', gap: 104, minGap: 84, speed: 2.4, ramp: 1.5, sway: true },
  zen: { name: 'Zen', gap: 150, minGap: 150, speed: 1.8, ramp: 0, sway: false, ranked: false },
};

/** Probability that a pipe pair carries a shield pickup (rolled before coins, see game.js). */
export const SHIELD_CHANCE = 0.1;

/** Backdrop for the story's storm chapter. Not a selectable theme, so it lives outside THEMES. */
export const STORM = { id: 'storm', name: 'Storm', top: '#121829', bottom: '#4a5575', hill: '#1b2539', cloud: '#2d354b', stars: false };
