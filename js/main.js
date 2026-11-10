/**
 * main.js — application entry point. Wires state, input, audio, effects, rendering and UI together
 * and runs a fixed-timestep loop: 60 simulation ticks per second regardless of display refresh rate.
 */
import { W, H, SCALE, WORLD, SKINS, THEMES, MODES } from './config.js';
import { Game, STATUS } from './game.js';
import { draw } from './renderer.js';
import { claim } from './goals.js';
import * as daily from './daily.js';
import * as Story from './story.js';
import { load, save } from './storage.js';
import { dailySeed } from './rng.js';
import * as fx from './fx.js';
import * as audio from './audio.js';
import * as ui from './ui.js';

const STEP = 1000 / 60;    // milliseconds per simulation tick
const LOCKOUT_MS = 300;    // after a crash, restart input is ignored briefly so a panic tap cannot skip the score screen
const params = new URLSearchParams(location.search);   // shared challenge link: ?seed=123&mode=hard
const urlMode = params.get('mode');
const urlSeed = Number(params.get('seed')) || null;   // shared challenge link: ?seed=123

// --- Setup -------------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });   // opaque canvas: cheaper to composite
canvas.width = W * SCALE;
canvas.height = H * SCALE;
ctx.scale(SCALE, SCALE);   // draw in logical units; the extra pixels just make it sharper

const data = load();       // persisted progress and settings (see storage.js)
const game = new Game();   // rules and state of the current run
let scroll = 0;            // animation clock: advances with game speed (parallax, ground, wing flaps)
let last = performance.now();
let acc = 0;               // simulated-time debt carried between frames
let mode = 'classic';      // 'classic' = random pipes, 'daily' = today's shared seed
let story = null;          // story-mode state (null outside story mode), see story.js
let sceneTheme = null;     // time-of-day theme forced by the current story segment
let scene = null;          // cutscene on screen: { bg, art, lines, after }
let lineIdx = 0;           // current dialogue line within the cutscene
let overAt = 0;            // timestamp of the last crash (restart lockout)

/** Selected visual style; falls back to the defaults if a saved id no longer exists. */
const look = () => ({
  skin: SKINS.find(s => s.id === data.skin) ?? SKINS[0],
  theme: THEMES.find(t => t.id === (sceneTheme ?? data.theme)) ?? THEMES[0],   // story segments set their own time of day
});

// --- Game loop ---------------------------------------------------------------------------
/** One animation frame: run as many fixed ticks as elapsed time requires, then draw. */
function frame(now) {
  acc += Math.min(now - last, 100);   // clamp so a backgrounded tab does not trigger a huge catch-up
  last = now;
  for (; acc >= STEP; acc -= STEP) tick();
  draw(ctx, game, look(), scroll, {
    best: data.best,
    coins: data.coins,
    story: story && { clock: Story.clock(story), left: story.time, love: story.love },   // HUD data in story mode
  });
  requestAnimationFrame(frame);
}

/** Advance the simulation one tick and react to what happened. */
function tick() {
  if (game.status !== STATUS.OVER) scroll += game.speed / WORLD.speed;   // the world freezes after a crash
  fx.step();
  for (const event of game.update()) {
    if (event === 'score') onScore();
    else if (event === 'coin') onCoin();
    else if (event === 'shield') onShield();
    else if (event === 'break') onBreak();
    else if (event === 'stumble') onStumble();
    else if (event === 'choice') onChoice();
    else if (event === 'hit') endRun();
  }
}

/** A point landed: rising-pitch ding, HUD pop, music intensity, and a flash when you pass your best. */
function onScore() {
  audio.sfx.score(game.score);
  fx.pop();
  if (story) {   // story mode: every pipe costs a minute; no score streak extras
    Story.apply(story, { time: -1 });
    return;
  }
  audio.setLevel(Math.min(3, Math.floor(game.score / 10)));   // faster, fuller music as you climb
  if (data.best > 0 && game.score === data.best + 1) fx.flash(0.6);
}

/** Coin collected: chime plus a small golden burst. */
function onCoin() {
  audio.sfx.coin();
  fx.emit(WORLD.birdX + 10, game.bird.y, 5, '#ffd700', 1.5);
}

// --- Story mode ----------------------------------------------------------------------------
/** Start the story from the beginning. */
function startStory() {
  audio.init();
  audio.startMusic();
  mode = 'story';
  story = Story.newStory();
  playNode();
}

/** Enter the current story node: a cutscene, a flight segment or the finale. */
function playNode() {
  const n = Story.node(story);
  if (n.type === 'fly') startSegment(n);
  else if (n.type === 'end') playEnding();
  else showScene(n, () => { Story.next(story); playNode(); });
}

/** Show a cutscene; `after` runs when its last line is dismissed. */
function showScene(s, after) {
  scene = { ...s, after };
  lineIdx = 0;
  showLine();
}

/** Render the current dialogue line over the cutscene backdrop. */
function showLine() {
  const [who, text] = scene.lines[lineIdx];
  const c = Story.CAST[who] ?? Story.CAST.narrator;
  ui.show('scene', data, { bg: scene.bg, art: scene.art, who: c.name, emoji: c.emoji, text, last: lineIdx === scene.lines.length - 1 });
}

/** Advance the dialogue (tap, Space/Enter or the Next button). */
function advanceScene() {
  if (lineIdx < scene.lines.length - 1) {
    lineIdx += 1;
    showLine();
  } else {
    scene.after();
  }
}

/** Begin a flight segment: set the time of day, music and difficulty, then let the player fly. */
function startSegment(n) {
  const tune = n.tune ? n.tune(story) : {};
  const preset = { name: 'Story', gap: 120, minGap: 120, speed: 2, ramp: 0, sway: false, ranked: false, ...tune };
  sceneTheme = n.theme;
  audio.setLevel(n.level ?? 0);
  game.reset(undefined, preset, { left: n.pipes, labels: n.labels, rain: n.rain, title: n.title });
  ui.hide();
}

/** The bird flew through one of the two openings: bank coins, apply the decision, cut to the next scene. */
function onChoice() {
  game.status = STATUS.SCENE;      // freeze the world while the story reacts
  data.coins += game.coins;
  save(data);
  audio.sfx.shield();              // chime: a decision was made
  fx.flash(0.5);
  Story.choose(story, game.choice);
  playNode();
}

/** Story-mode crash: a two-minute delay, never game over. */
function onStumble() {
  Story.apply(story, { time: -2 });
  audio.sfx.crack();
  fx.hit(0.5);
  fx.emit(WORLD.birdX, game.bird.y, 8, look().skin.body, 2.5);
  navigator.vibrate?.(20);
}

/** Play the earned ending, remember it, then show the summary screen. */
function playEnding() {
  const e = Story.ending(story);
  showScene(e, () => {
    if (!data.endings.includes(e.id)) data.endings.push(e.id);
    save(data);
    ui.show('ending', data, { title: e.title, clock: Story.clock(story), love: story.love });
  });
}

/** Shield picked up: chime plus a cyan burst. */
function onShield() {
  audio.sfx.shield();
  fx.emit(WORLD.birdX, game.bird.y, 6, '#7fe9ff', 1.5);
}

/** The shield absorbed a crash: crack sound, a lighter shake and a shard burst. */
function onBreak() {
  audio.sfx.crack();
  fx.hit(0.5);
  fx.emit(WORLD.birdX, game.bird.y, 8, '#7fe9ff', 2.5);
  navigator.vibrate?.(20);
}

/** Record the finished run (stats, coins, leaderboard, daily streak, goals), persist, show game over. */
function endRun() {
  overAt = performance.now();
  audio.sfx.hit();
  fx.hit();
  fx.emit(WORLD.birdX, game.bird.y, 12, look().skin.body, 3);   // feather burst
  navigator.vibrate?.(40);                                       // haptics where supported (Android)
  const m = MODES[modeKey()];
  const ranked = m.ranked !== false;   // practice modes (Zen): coins count, but score stats, leaderboard and goals do not
  const isBest = ranked && game.score > data.best;
  data.coins += game.coins;
  let fresh = [];       // lifetime goals completed by this run
  let dailyDone = [];   // daily goals completed by this run
  if (ranked) {
    data.best = Math.max(data.best, game.score);
    data.games += 1;
    data.total += game.score;
    if (game.score > 0) {   // zero-point runs would only clutter the leaderboard
      data.board = [...data.board, { score: game.score, date: new Date().toLocaleDateString(), mode: m.name }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);       // keep the top 10
    }
    if (mode === 'daily') recordDaily();
    fresh = claim(data);
    dailyDone = daily.record(data, { score: game.score, coins: game.coins });   // pays bonus coins for new daily goals
  }
  save(data);
  ui.show('over', data, { score: game.score, isBest, fresh, coins: game.coins, mode: m.name, ranked, daily: dailyDone });
}

/** Daily challenge bookkeeping: the streak grows on consecutive days and resets after a gap. */
function recordDaily() {
  const today = dailySeed();
  const yesterday = dailySeed(new Date(Date.now() - 864e5));
  const d = data.daily;
  if (d.date !== today) {
    d.streak = d.date === yesterday ? d.streak + 1 : 1;
    d.date = today;
    d.best = 0;
  }
  d.best = Math.max(d.best, game.score);
}

// --- Input -------------------------------------------------------------------------------
/** Flap (the first flap starts the run). Ignored while a menu is open or after a crash. */
function flap() {
  if (ui.isOpen()) return;
  if (game.flap()) {
    audio.sfx.flap();
    fx.emit(WORLD.birdX - 12, game.bird.y + 6, 3, '#ffffff', 1.2);   // wing puff
  }
}

/** Key of the active tuning preset: the daily challenge is always Classic, a shared link carries its own mode. */
const modeKey = () => (mode === 'daily' ? 'classic' : urlSeed && MODES[urlMode] ? urlMode : MODES[data.mode] ? data.mode : 'classic');

/** Begin a run in the current mode (seeded for daily/shared links). Respects the post-crash lockout. */
function startRun() {
  if (ui.screen() === 'over' && performance.now() - overAt < LOCKOUT_MS) return;
  audio.init();           // audio may only start from a user gesture; every caller is one
  audio.startMusic();
  audio.setLevel(0);
  story = null;           // a normal run leaves story mode
  sceneTheme = null;
  game.reset(mode === 'daily' ? dailySeed() : urlSeed ?? undefined, MODES[modeKey()]);
  ui.hide();
}

/** Share a link that replays the same pipes, via the Web Share API or the clipboard. */
function share() {
  const url = new URL(location.href);
  url.search = `?seed=${game.seed}&mode=${modeKey()}`;
  const text = `I scored ${game.score} in Flappy Birds. Beat me on the same pipes!`;
  if (navigator.share) navigator.share({ text, url: url.href }).catch(() => {});
  else navigator.clipboard?.writeText(`${text} ${url.href}`);
}

canvas.addEventListener('pointerdown', flap);
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (ui.screen() === 'scene' && (e.code === 'Space' || e.code === 'Enter')) {   // skip through dialogue from the keyboard
    e.preventDefault();
    advanceScene();
    return;
  }
  if (ui.screen() === 'over' && (e.code === 'Space' || e.code === 'Enter')) {   // instant retry from the keyboard
    e.preventDefault();
    startRun();
    return;
  }
  if (ui.isOpen() || !['Space', 'ArrowUp'].includes(e.code)) return;
  e.preventDefault();   // stop Space from scrolling the page
  flap();
});

// --- Menu actions ------------------------------------------------------------------------
/** Save, then re-render a screen (used after a setting changes). */
function refresh(screen) {
  save(data);
  ui.show(screen, data);
}

ui.bind((action, arg) => {
  switch (action) {
    case 'play':
      mode = 'classic';
      startRun();
      break;
    case 'mode': {   // cycle Classic -> Hard -> Zen
      const keys = Object.keys(MODES);
      data.mode = keys[(keys.indexOf(data.mode) + 1) % keys.length];
      refresh('menu');
      break;
    }
    case 'daily':
      mode = 'daily';
      startRun();
      break;
    case 'retry':
      startRun();   // keeps the current mode
      break;
    case 'tap':     // tapping empty space on the game-over screen also retries
      if (ui.screen() === 'over') startRun();
      else if (ui.screen() === 'scene') advanceScene();   // tap anywhere to advance dialogue
      break;
    case 'story':
      startStory();
      break;
    case 'next':
      advanceScene();
      break;
    case 'share':
      share();
      break;
    case 'menu':
      story = null;       // leave story mode if we were in it
      sceneTheme = null;
      mode = 'classic';
      game.reset();
      ui.show('menu', data);
      break;
    case 'skins':
    case 'goals':
    case 'scores':
      ui.show(action, data);
      break;
    case 'skin':
      data.skin = arg;
      refresh('skins');
      break;
    case 'theme':
      data.theme = arg;
      refresh('skins');
      break;
    case 'buy': {   // spend coins on a locked skin/theme
      const item = [...SKINS, ...THEMES].find(i => i.id === arg);
      if (item && data.coins >= item.cost && !data.bought.includes(arg)) {
        data.coins -= item.cost;
        data.bought.push(arg);
      }
      refresh('skins');
      break;
    }
    case 'mute':
      data.muted = !data.muted;
      audio.setMuted(data.muted);
      refresh('menu');
      break;
  }
});

// --- Boot --------------------------------------------------------------------------------
audio.setMuted(data.muted);
ui.show('menu', data);
requestAnimationFrame(frame);
