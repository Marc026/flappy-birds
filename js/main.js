/**
 * main.js — application entry point. Wires state, input, audio, rendering and UI together and
 * runs a fixed-timestep loop: 60 simulation ticks per second regardless of display refresh rate.
 */
import { W, H, SCALE, SKINS, THEMES } from './config.js';
import { Game, STATUS } from './game.js';
import { draw } from './renderer.js';
import { claim } from './goals.js';
import { load, save } from './storage.js';
import * as audio from './audio.js';
import * as ui from './ui.js';

const STEP = 1000 / 60;   // milliseconds per simulation tick

// --- Setup -------------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W * SCALE;
canvas.height = H * SCALE;
ctx.scale(SCALE, SCALE);   // draw in logical units; the extra pixels just make it sharper

const data = load();       // persisted progress and settings (see storage.js)
const game = new Game();   // rules and state of the current run
let scroll = 0;            // ticks elapsed: drives parallax scrolling and animations
let last = performance.now();
let acc = 0;               // simulated-time debt carried between frames

/** Selected visual style; falls back to the defaults if a saved id no longer exists. */
const look = () => ({
  skin: SKINS.find(s => s.id === data.skin) ?? SKINS[0],
  theme: THEMES.find(t => t.id === data.theme) ?? THEMES[0],
});

// --- Game loop ---------------------------------------------------------------------------
/** One animation frame: run as many fixed ticks as elapsed time requires, then draw. */
function frame(now) {
  acc += Math.min(now - last, 100);   // clamp so a backgrounded tab does not trigger a huge catch-up
  last = now;
  for (; acc >= STEP; acc -= STEP) tick();
  draw(ctx, game, look(), scroll);
  requestAnimationFrame(frame);
}

/** Advance the simulation one tick and react to what happened. */
function tick() {
  if (game.status !== STATUS.OVER) scroll += 1;   // the world freezes after a crash
  for (const event of game.update()) {
    if (event === 'score') audio.sfx.score();
    else if (event === 'hit') endRun();
  }
}

/** Record the finished run (stats, leaderboard, goals), persist it, then show the game-over screen. */
function endRun() {
  audio.sfx.hit();
  const isBest = game.score > data.best;
  data.best = Math.max(data.best, game.score);
  data.games += 1;
  data.total += game.score;
  if (game.score > 0) {   // zero-point runs would only clutter the leaderboard
    data.board = [...data.board, { score: game.score, date: new Date().toLocaleDateString() }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);       // keep the top 10
  }
  const fresh = claim(data);   // goals completed by this run
  save(data);
  ui.show('over', data, { score: game.score, isBest, fresh });
}

// --- Input -------------------------------------------------------------------------------
/** Flap (the first flap starts the run). Ignored while a menu is open or after a crash. */
function flap() {
  if (ui.isOpen()) return;
  if (game.flap()) audio.sfx.flap();
}

canvas.addEventListener('pointerdown', flap);
addEventListener('keydown', e => {
  if (ui.isOpen() || e.repeat || !['Space', 'ArrowUp'].includes(e.code)) return;
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
    case 'play':   // audio may only start from a user gesture, and a click on Play is one
      audio.init();
      audio.startMusic();
      game.reset();
      ui.hide();
      break;
    case 'menu':
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
