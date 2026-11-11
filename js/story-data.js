/**
 * story-data.js — all story content as plain data: cast, backdrops, the scene graph and the endings.
 * Dialogue can be edited here without touching any game code. Node types:
 *   scene — a cutscene: dialogue `lines` of [speakerId, text], then `next`. Optional `anim` ('bob' | 'fly' | 'shake')
 *           animates the emoji art; optional `ambient` ('rain' | 'storm' | 'fireflies' | 'stars') adds moving scenery.
 *   fly   — a flight segment: `pipes` ordinary pipes, then ONE decision pipe with two openings labelled
 *           by `labels`; the opening the bird flies through picks options[0] or options[1].
 *           Optional: `theme` (time of day), `rain`, `level` (music intensity), `tune(state)` -> difficulty.
 *   end   — the finale; the ending shown is chosen from the final state (see story.js).
 * An option's `fx` changes the story state: { time: minutes, love: hearts, flag: 'name' }.
 */

export const START_TIME = 40;          // minutes between clocking out (7:50 PM) and bedtime
export const BEDTIME = 20 * 60 + 30;   // 8:30 PM, in minutes after midnight

/** Who can speak: display name and an emoji "portrait" (no image assets to ship). */
export const CAST = {
  narrator: { name: 'Narrator', emoji: '📖' },
  pip: { name: 'Pip', emoji: '🐦' },
  mallard: { name: 'Boss Mallard', emoji: '🦆' },
  dot: { name: 'Dot', emoji: '🧁' },
  chick: { name: 'Lost chick', emoji: '🐣' },
  hoot: { name: 'Mrs. Hoot', emoji: '🦉' },
  robin: { name: 'Robin', emoji: '🐥' },
  finch: { name: 'Finch', emoji: '🐤' },
};

/** Cutscene backdrops (static CSS gradients, so they cost nothing per frame). */
const BG = {
  office: 'linear-gradient(#ffd29a, #c97b4a)',
  dusk: 'linear-gradient(#ff8a5c, #6b4a8f)',
  night: 'linear-gradient(#0b1d4d, #3c5a9a)',
  storm: 'linear-gradient(#2b3350, #0b1020)',
  home: 'linear-gradient(#ffd29a, #ff8a5c)',
};

/** Difficulty presets a segment can return from `tune`: faster, with pipes that sway from the first one. */
const WINDY = { speed: 2.5, sway: true, swayFrom: 0 };

export const NODES = {
  // --- Prologue ---
  intro: { type: 'scene', bg: BG.office, art: '🏢🕗', next: 'seg1', lines: [
    ['narrator', '7:50 PM. Pip’s shift at Mallard & Co. Seed Mill is finally over.'],
    ['mallard', 'Pip! One more crate before you go?'],
    ['pip', 'Bedtime is at 8:30. Robin and Finch are waiting up.'],
    ['mallard', '…Go on, then. Don’t be late!'],
    ['narrator', 'Tap to flap. Every pipe costs a minute and a stumble costs two. At a pipe with two openings, fly through A or B to choose your path.'],
  ] },

  // --- Chapter 1: Skyway or Park? ---
  seg1: { type: 'fly', title: 'Chapter 1 · Downtown', theme: 'dusk', pipes: 4,
    labels: ['Skyway: fast, windy', 'Park: calm, slow'],
    options: [{ next: 'sky', fx: { flag: 'windy' } }, { next: 'park', fx: { time: -5 } }] },
  sky: { type: 'scene', anim: 'fly', bg: BG.dusk, art: '🌬️🏙️', next: 'seg2', lines: [
    ['narrator', 'The Skyway whistles between the towers. It’s the fastest way home, and the wildest.'],
    ['pip', 'Hold on, little wings!'],
  ] },
  park: { type: 'scene', ambient: 'fireflies', bg: BG.dusk, art: '🌳✨', next: 'seg2', lines: [
    ['narrator', 'The park is peaceful. Fireflies drift past like tiny lanterns.'],
    ['pip', 'Too pretty to rush… but I really should rush.'],
  ] },

  // --- Chapter 2: the bakery ---
  seg2: { type: 'fly', title: 'Chapter 2 · Old Town', theme: 'dusk', pipes: 4,
    labels: ['Bakery: seed cake', 'Skip it: no time'],
    tune: s => (s.flags.windy ? WINDY : { speed: 2 }),
    options: [{ next: 'bakery', fx: { time: -4, love: 2, flag: 'cake' } }, { next: 'skip', fx: {} }] },
  bakery: { type: 'scene', bg: BG.dusk, art: '🧁🥐', next: 'seg3', lines: [
    ['dot', 'Last seed cake of the night, Pip! For the little ones?'],
    ['pip', 'They’ll love it. Thank you, Dot!'],
    ['dot', 'Now scoot. Bedtime waits for no bird!'],
  ] },
  skip: { type: 'scene', bg: BG.dusk, art: '🏮🚪', next: 'seg3', lines: [
    ['pip', 'Tomorrow, kiddos. I promise.'],
    ['narrator', 'The bakery lights shrink behind you.'],
  ] },

  // --- Chapter 3: the lost chick ---
  seg3: { type: 'fly', title: 'Chapter 3 · Quiet Street', theme: 'night', pipes: 4,
    labels: ['Help the lost chick', 'Keep flying'],
    options: [{ next: 'help', fx: { time: -6, love: 1, flag: 'helped' } }, { next: 'ignore', fx: { flag: 'ignored' } }] },
  help: { type: 'scene', ambient: 'stars', bg: BG.night, art: '🐣🌙', next: 'seg4', lines: [
    ['chick', 'I can’t find my nest!'],
    ['pip', 'Hop on. We’ll find it together.'],
    ['narrator', 'Two streets over, a porch light flicks on. Mrs. Hoot opens her door.'],
    ['hoot', 'Bless you, Pip! Go on, I’ll tell your kids you’re coming.'],
  ] },
  ignore: { type: 'scene', ambient: 'stars', bg: BG.night, art: '🌙💨', next: 'seg4', lines: [
    ['narrator', 'A tiny chirp echoes behind you. Pip keeps flying.'],
    ['pip', 'Someone else will help… right?'],
  ] },

  // --- Chapter 4: the storm ---
  seg4: { type: 'fly', title: 'Chapter 4 · The Storm', theme: 'night', rain: true, level: 2, pipes: 5,
    labels: ['Fly through the storm', 'Wait under the bridge'],
    tune: () => ({ speed: 2.3 }),
    options: [{ next: 'storm', fx: { flag: 'soaked' } }, { next: 'bridge', fx: { time: -5 } }] },
  storm: { type: 'scene', anim: 'shake', ambient: 'storm', bg: BG.storm, art: '⛈️🐦', next: 'seg5', lines: [
    ['narrator', 'Thunder cracks. Pip’s feathers are soaked, but home is close.'],
    ['pip', 'Almost there…'],
  ] },
  bridge: { type: 'scene', ambient: 'rain', bg: BG.storm, art: '🌉🌧️', next: 'seg5', lines: [
    ['narrator', 'Under the bridge, rain drums softly on the stones.'],
    ['pip', 'Five minutes. Just five minutes.'],
  ] },

  // --- Chapter 5: home stretch ---
  seg5: { type: 'fly', title: 'Chapter 5 · Home Stretch', theme: 'night', level: 1, pipes: 3,
    labels: ['Kids’ window', 'Front door'],
    tune: s => (s.flags.soaked ? WINDY : { speed: 2 }),
    options: [{ next: 'finale', fx: { love: 1, flag: 'window' } }, { next: 'finale', fx: { time: -1 } }] },
  finale: { type: 'end' },
};

/** Endings: `lines(state)` builds the closing scene from the flags the player earned. */
export const ENDINGS = {
  tucked: { title: 'Tucked In', bg: BG.home, art: '🏠🐥🐤', lines: s => [
    ['narrator', 'Pip lands on the windowsill with time to spare.'],
    ['robin', 'You made it!'],
    ['finch', 'Story time! Story time!'],
    ...(s.flags.window ? [['finch', 'You flew right to our window!']] : []),
    ...(s.flags.cake ? [['pip', 'And I brought seed cake from Dot’s.'], ['finch', 'Best. Day. Ever.']] : []),
    ...(s.flags.helped ? [['robin', 'Mrs. Hoot says you helped a lost chick tonight.'], ['pip', 'Someone had to.']] : []),
    ['pip', 'Teeth brushed? Then let me tell you about the longest flight of my life.'],
    ['narrator', 'Two chicks asleep by the last page. One very happy bird.'],
  ] },
  justintime: { title: 'Just in Time', ambient: 'stars', bg: BG.home, art: '🏠🌙', lines: s => [
    ['narrator', 'The last light is still on when Pip slips inside.'],
    ['robin', 'Pip… you’re just in time.'],
    ['finch', 'Five more minutes?'],
    ['pip', 'Five. Then dreams.'],
    ...(s.flags.ignored ? [['narrator', 'Pip can’t stop thinking about that tiny chirp. Tomorrow, Pip decides, I’ll listen.']] : []),
    ['narrator', 'Two sleepy goodnights. Made it, barely.'],
  ] },
  late_helped: { title: 'A Kind Neighbor', ambient: 'stars', bg: BG.night, art: '🏠🦉', lines: () => [
    ['narrator', 'The house is dark, but a lantern glows by the door.'],
    ['hoot', 'I tucked them in, Pip. You helped one of mine tonight, so I helped yours.'],
    ['pip', 'Thank you. I’m so sorry I’m late.'],
    ['narrator', 'Pip sits between two sleeping beds until the stars come out.'],
  ] },
  late: { title: 'Tomorrow, I Promise', ambient: 'stars', bg: BG.night, art: '🏠💤', lines: () => [
    ['narrator', 'Both chicks are fast asleep. Pip whispers an apology to the dark.'],
    ['narrator', 'A drawing waits on the pillow: “Dear Pip, we waited. Story time tomorrow?”'],
    ['pip', 'Tomorrow. I promise.'],
  ] },
};
