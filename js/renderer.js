/**
 * renderer.js — all canvas drawing. It only reads game state and never changes it.
 * Layers, back to front: sky -> stars -> hills -> clouds -> pipes -> ground -> bird -> HUD.
 */
import { W, H, WORLD } from './config.js';
import { STATUS } from './game.js';

const TAU = Math.PI * 2;                 // full circle in radians
const GROUND_Y = H - WORLD.groundH;      // y of the ground's top edge
const CAP_H = 18;                        // pipe cap (lip) height
const CAP_OVER = 4;                      // how far a cap sticks out past the pipe body
const CLOUDS = [[40, 90, 1], [210, 140, 0.8], [130, 50, 0.6]];   // [x, y, scale]; smaller = farther = slower

/**
 * Draw one complete frame.
 * @param c       2D context (already scaled to logical units)
 * @param game    current Game state
 * @param look    { skin, theme } chosen in the customization menu
 * @param scroll  ticks elapsed: the clock for parallax and animation
 */
export function draw(c, game, look, scroll) {
  sky(c, look.theme);
  hills(c, look.theme, scroll);
  clouds(c, look.theme, scroll);
  game.pipes.forEach(p => pipe(c, p));
  ground(c, scroll);
  bird(c, game.bird, look.skin, scroll);
  hud(c, game);
}

/** Vertical sky gradient, plus stars on night themes. */
function sky(c, th) {
  const g = c.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, th.top);
  g.addColorStop(1, th.bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  if (th.stars) {
    c.fillStyle = '#fff';
    for (let i = 0; i < 24; i++) c.fillRect((i * 97) % W, (i * 53) % 220, 2, 2);   // fixed pseudo-random spots
  }
}

/** Distant hills: a sine-wave silhouette that scrolls slowly (parallax). */
function hills(c, th, s) {
  c.fillStyle = th.hill;
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) c.lineTo(x, GROUND_Y - 40 - 25 * Math.sin((x + s * 0.4) / 40));
  c.lineTo(W, H);
  c.fill();
}

/** Clouds drifting left at different speeds; each is three overlapping circles. */
function clouds(c, th, s) {
  const span = W + 120;   // distance after which a cloud wraps around
  c.fillStyle = th.cloud;
  for (const [x, y, k] of CLOUDS) {
    const cx = ((((x - s * 0.3 * k) % span) + span) % span) - 60;
    for (const [dx, dy, r] of [[0, 0, 18], [18, 5, 14], [-18, 6, 12]]) {
      c.beginPath();
      c.arc(cx + dx * k, y + dy * k, r * k, 0, TAU);
      c.fill();
    }
  }
}

/** One pipe pair: shaded bodies with wider caps around the opening. */
function pipe(c, p) {
  const w = WORLD.pipeW;
  const top = p.gy - p.gap / 2;   // bottom edge of the upper pipe
  const bot = p.gy + p.gap / 2;   // top edge of the lower pipe
  const g = c.createLinearGradient(p.x, 0, p.x + w, 0);   // left-to-right shading = cylinder look
  g.addColorStop(0, '#2f8a2f');
  g.addColorStop(0.35, '#7ee35a');
  g.addColorStop(1, '#2a7a2a');
  c.fillStyle = g;
  c.strokeStyle = '#1d4d1d';
  c.lineWidth = 2;
  block(c, p.x, -2, w, top - CAP_H + 2);                              // upper body
  block(c, p.x - CAP_OVER, top - CAP_H, w + 2 * CAP_OVER, CAP_H);     // upper cap
  block(c, p.x - CAP_OVER, bot, w + 2 * CAP_OVER, CAP_H);             // lower cap
  block(c, p.x, bot + CAP_H, w, GROUND_Y - bot - CAP_H + 2);          // lower body (tucked under the ground)
}

/** Filled and outlined rectangle. */
function block(c, x, y, w, h) {
  c.fillRect(x, y, w, h);
  c.strokeRect(x, y, w, h);
}

/** Scrolling ground: dirt, a grass strip and moving stripes that match the pipe speed. */
function ground(c, s) {
  c.fillStyle = '#dcd18a';
  c.fillRect(0, GROUND_Y, W, WORLD.groundH);    // dirt
  c.fillStyle = '#6fbf2e';
  c.fillRect(0, GROUND_Y, W, 10);               // grass
  c.fillStyle = '#92dd4a';
  for (let x = -((s * WORLD.speed) % 24); x < W; x += 24) c.fillRect(x, GROUND_Y, 12, 5);   // stripes
  c.fillStyle = '#b5a85e';
  c.fillRect(0, GROUND_Y + 10, W, 2);           // grass/dirt seam
}

/** The bird: tilts with its vertical speed and flaps its wing with the animation clock. */
function bird(c, b, skin, s) {
  c.save();
  c.translate(WORLD.birdX, b.y);
  c.rotate(Math.max(-0.45, Math.min(1.1, b.v / 9)));   // nose up when rising, dive when falling
  c.lineWidth = 2;
  c.strokeStyle = '#3a2a1a';
  oval(c, 0, 0, 15, 12, skin.body);                            // body
  oval(c, 3, 5, 9, 5, skin.belly, false);                      // belly
  oval(c, -6, 2 + Math.sin(s * 0.5) * 5, 8, 5, skin.wing);     // wing (flapping)
  oval(c, 7, -4, 5, 5, '#fff');                                // eye
  oval(c, 9, -4, 2, 2, '#111', false);                         // pupil
  c.fillStyle = '#ff7a1a';                                     // beak
  c.beginPath();
  c.moveTo(11, -1);
  c.lineTo(22, 3);
  c.lineTo(11, 7);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

/** Filled ellipse, optionally outlined: the bird's building block. */
function oval(c, x, y, rx, ry, fill, outline = true) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
  if (outline) c.stroke();
}

/** Heads-up display: the score while playing, a hint while waiting for the first flap. */
function hud(c, game) {
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = 6;
  c.strokeStyle = '#3a2a1a';
  c.fillStyle = '#fff';
  if (game.status === STATUS.READY) {
    c.font = 'bold 22px Trebuchet MS, sans-serif';
    outlined(c, 'Tap / Space to flap', W / 2, 150);
  } else {
    c.font = 'bold 44px Trebuchet MS, sans-serif';
    outlined(c, String(game.score), W / 2, 80);
  }
}

/** Text with a dark outline so it stays readable on any background. */
function outlined(c, text, x, y) {
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
}
