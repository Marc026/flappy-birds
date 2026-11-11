/**
 * renderer.js — all canvas drawing. It only reads game state and never changes it.
 * Guardrails: each frame draws only rects, circles and ellipses (no per-frame gradients or filters;
 * every sky gradient is rendered ONCE into an offscreen canvas), and particles come from fx.js's fixed pool.
 * Layers, back to front: sky -> far hills -> clouds -> near hills -> rain -> pipes/coins -> ground
 *                         -> particles -> bird -> HUD -> flash.
 */
import { W, H, WORLD, THEMES, STORM } from './config.js';
import { STATUS } from './game.js';
import * as fx from './fx.js';
import { lightning, glow } from './storm.js';

const TAU = Math.PI * 2;                 // full circle in radians
const GROUND_Y = H - WORLD.groundH;      // y of the ground's top edge
const CAP_H = 18;                        // pipe cap (lip) height
const CAP_OVER = 4;                      // how far a cap sticks out past the pipe body
const CLOUDS = [[40, 90, 1], [210, 140, 0.8], [130, 50, 0.6]];   // [x, y, scale]; smaller = farther = slower
const FONT = 'Trebuchet MS, sans-serif';

/**
 * Draw one complete frame.
 * @param c       2D context (already scaled to logical units)
 * @param game    current Game state
 * @param look    { skin, theme } chosen in the customization menu
 * @param scroll  animation clock (advances with game speed)
 * @param info    { best, coins }: saved stats for the HUD
 */
export function draw(c, game, look, scroll, info) {
  // Score-driven world: from the chosen theme, blend toward the next one every 10 points.
  const storm = Boolean(game.plan?.rain);   // story chapter 4: a full thunderstorm backdrop
  const pos = Math.min(THEMES.indexOf(look.theme) + (game.plan ? 0 : game.score / 10), THEMES.length - 1);   // story: time of day is scripted
  const i = Math.floor(pos);
  const a = storm ? STORM : THEMES[i];
  const b = storm ? STORM : THEMES[Math.min(i + 1, THEMES.length - 1)];
  const th = pos - i < 0.5 ? a : b;      // theme that drives hill/cloud colours

  c.save();
  c.translate((Math.random() - 0.5) * fx.state.shake, (Math.random() - 0.5) * fx.state.shake);   // crash shake
  sky(c, a, b, pos - i);
  hills(c, th.hill, scroll, 0.2, 70, 20, 0.5);   // far layer: slower and faded
  if (storm) {
    stormClouds(c, scroll);
    lightningLayer(c, scroll);
  } else {
    clouds(c, th, scroll);
  }
  hills(c, th.hill, scroll, 0.6, 35, 22, 1);     // near layer: faster and solid
  if (game.plan ? game.plan.rain : pos >= 1.5) rain(c, scroll, storm ? 44 : 18);               // late-game weather
  game.pipes.forEach(p => pipe(c, p, scroll));
  ground(c, scroll);
  particles(c);
  bird(c, game, look.skin, scroll);
  hud(c, game, info);
  c.restore();
  flash(c);
}

/** Pre-rendered sky per theme (built lazily, once): one drawImage per frame instead of a gradient. */
const skies = new Map();
function skyFor(th) {
  if (!skies.has(th.id)) {
    const cv = document.createElement('canvas');   // offscreen; 4 px wide is enough, it is stretched when drawn
    cv.width = 4;
    cv.height = GROUND_Y;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, th.top);
    grad.addColorStop(1, th.bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, GROUND_Y);
    skies.set(th.id, cv);
  }
  return skies.get(th.id);
}

/** Cross-fade sky `a` into sky `b` by factor f (0..1), with stars fading in for night. */
function sky(c, a, b, f) {
  c.drawImage(skyFor(a), 0, 0, W, GROUND_Y + 1);
  if (b !== a && f > 0.01) {
    c.globalAlpha = f;
    c.drawImage(skyFor(b), 0, 0, W, GROUND_Y + 1);
  }
  const stars = a.stars ? 1 : b.stars ? f : 0;
  if (stars > 0) {
    c.globalAlpha = stars;
    c.fillStyle = '#fff';
    for (let i = 0; i < 24; i++) c.fillRect((i * 97) % W, (i * 53) % 220, 2, 2);   // fixed pseudo-random spots
  }
  c.globalAlpha = 1;
}

/** A hill silhouette (sine wave) scrolling at `speed` x the clock: slower = farther away. */
function hills(c, color, s, speed, base, amp, alpha) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) c.lineTo(x, GROUND_Y - base - amp * Math.sin((x + s * speed) / 40));
  c.lineTo(W, H);
  c.fill();
  c.globalAlpha = 1;
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

/** Night rain: 18 streaks whose positions are pure functions of the clock (no state, no allocation). */
function rain(c, s, n = 18) {
  if (fx.reduced) return;
  c.fillStyle = 'rgba(200, 220, 255, 0.5)';
  for (let i = 0; i < n; i++) {
    const y = (i * 53 + s * (6 + (i % 3) * 2)) % GROUND_Y;   // three fall speeds give depth
    c.fillRect((i * 37 + y * 0.25) % W, y, 1.5, 9);
  }
}

/** One pipe pair (bodies + caps around the current opening) and its spinning coin, if any. */
function pipe(c, p, s) {
  if (p.cy2 !== undefined) return decisionPipe(c, p);   // two-opening story pipe
  const w = WORLD.pipeW;
  const top = p.cy - p.gap / 2;   // bottom edge of the upper pipe
  const bot = p.cy + p.gap / 2;   // top edge of the lower pipe
  c.strokeStyle = '#1d4d1d';
  c.lineWidth = 2;
  block(c, p.x, -2, w, top - CAP_H + 2);                              // upper body
  block(c, p.x - CAP_OVER, top - CAP_H, w + 2 * CAP_OVER, CAP_H);     // upper cap
  block(c, p.x - CAP_OVER, bot, w + 2 * CAP_OVER, CAP_H);             // lower cap
  block(c, p.x, bot + CAP_H, w, GROUND_Y - bot - CAP_H + 2);          // lower body (tucked under the ground)
  if (p.coin) {                                                       // coin "spins": its width oscillates
    c.fillStyle = '#ffd700';
    c.beginPath();
    c.ellipse(p.x + w / 2, p.cy, 2 + 6 * Math.abs(Math.cos(s * 0.08)), 8, 0, 0, TAU);
    c.fill();
    c.stroke();
  }
  if (p.shield) {                                                     // shield pickup: a pulsing cyan bubble
    c.fillStyle = '#7fe9ff';
    c.beginPath();
    c.arc(p.x + w / 2, p.cy, 9 + Math.sin(s * 0.15) * 1.5, 0, TAU);
    c.fill();
    c.stroke();
  }
}

/** Pipe segment shaded with flat bands (base, highlight, shadow) instead of a gradient. */
function block(c, x, y, w, h) {
  c.fillStyle = '#4fb83a';
  c.fillRect(x, y, w, h);                    // base
  c.fillStyle = '#8bea6a';
  c.fillRect(x + w * 0.15, y, w * 0.25, h);  // highlight band
  c.fillStyle = '#2a7a2a';
  c.fillRect(x + w * 0.78, y, w * 0.22, h);  // shadow band
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

/** Live particles from the fixed pool (feathers, puffs, coin sparkles), drawn as small squares. */
function particles(c) {
  for (const p of fx.pool) {
    if (!p.on) continue;
    c.fillStyle = p.c;
    c.fillRect(p.x, p.y, p.r, p.r);
  }
}

/** The bird: tilts with its speed, flaps its wing, bobs while idle, blinks, and widens its eyes near a pipe. */
function bird(c, game, skin, s) {
  const b = game.bird;
  const idle = game.status === STATUS.READY;
  const near = game.pipes.some(p => p.x + WORLD.pipeW > WORLD.birdX && p.x - WORLD.birdX < 70);   // pipe close ahead
  const blink = s % 200 < 6;                                                                       // ~every 3 s
  c.save();
  c.translate(WORLD.birdX, b.y + (idle ? Math.sin(s * 0.12) * 4 : 0));   // idle bob is visual only
  if (game.grace > 0 && game.grace % 8 < 4) c.globalAlpha = 0.45;       // flicker while invulnerable (restored below)
  c.rotate(Math.max(-0.45, Math.min(1.1, b.v / 9)));                      // nose up when rising, dive when falling
  c.lineWidth = 2;
  c.strokeStyle = '#3a2a1a';
  oval(c, 0, 0, 15, 12, skin.body);                            // body
  oval(c, 3, 5, 9, 5, skin.belly, false);                      // belly
  oval(c, -6, 2 + Math.sin(s * 0.5) * 5, 8, 5, skin.wing);     // wing (flapping)
  if (blink) {
    c.beginPath();                                             // closed eye: a short line
    c.moveTo(3, -4);
    c.lineTo(11, -4);
    c.stroke();
  } else {
    oval(c, 7, -4, near ? 6.5 : 5, near ? 6.5 : 5, '#fff');          // eye (bigger when alarmed)
    oval(c, 9, -4, near ? 3 : 2, near ? 3 : 2, '#111', false);       // pupil
  }
  c.fillStyle = '#ff7a1a';                                     // beak
  c.beginPath();
  c.moveTo(11, -1);
  c.lineTo(22, 3);
  c.lineTo(11, 7);
  c.closePath();
  c.fill();
  c.stroke();
  if (game.shield) {                                           // shield bubble around the bird
    c.strokeStyle = '#7fe9ff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 21, 0, TAU);
    c.stroke();
  }
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

/** HUD: popping score, "NEW BEST!" tag, start hint, coin count and best score. */
function hud(c, game, info) {
  if (info.story) return storyHud(c, game, info.story);   // story mode has its own HUD
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = 6;
  c.strokeStyle = '#3a2a1a';
  c.fillStyle = '#fff';
  if (game.status === STATUS.READY) {
    c.font = `bold 22px ${FONT}`;
    outlined(c, 'Tap / Space to flap', W / 2, 150);
  } else {
    c.save();
    c.translate(W / 2, 80);
    const k = 1 + fx.state.pop * 0.35;   // score "pop" when a point lands
    c.scale(k, k);
    c.font = `bold 44px ${FONT}`;
    outlined(c, String(game.score), 0, 0);
    c.restore();
    if (info.best > 0 && game.score > info.best) {
      c.font = `bold 16px ${FONT}`;
      c.lineWidth = 4;
      outlined(c, 'NEW BEST!', W / 2, 108);
    }
  }
  c.font = `bold 14px ${FONT}`;
  c.lineWidth = 4;
  c.textAlign = 'left';
  outlined(c, `🪙 ${info.coins + game.coins}`, 8, 20);
  c.textAlign = 'right';
  outlined(c, `BEST ${info.best}`, W - 8, 20);
}

/** Text with a dark outline so it stays readable on any background. */
function outlined(c, text, x, y) {
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
}

/** White screen flash (crash, passing your best); drawn after the shake is undone. */
function flash(c) {
  if (fx.state.flash < 0.02) return;
  c.globalAlpha = fx.state.flash * 0.6;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 1;
}

/** Story decision pipe: three bodies, two openings (A above, B below), each labelled to the pipe's left. */
function decisionPipe(c, p) {
  const w = WORLD.pipeW;
  const h = p.gap / 2;
  const [a, b] = [p.cy, p.cy2];                       // centres of opening A and opening B
  const wide = w + 2 * CAP_OVER;
  c.strokeStyle = '#1d4d1d';
  c.lineWidth = 2;
  block(c, p.x, -2, w, a - h - CAP_H + 2);                                  // top body
  block(c, p.x - CAP_OVER, a - h - CAP_H, wide, CAP_H);                     // cap above A
  block(c, p.x - CAP_OVER, a + h, wide, CAP_H);                             // cap below A
  block(c, p.x, a + h + CAP_H, w, b - h - CAP_H - (a + h + CAP_H));         // wall between the openings
  block(c, p.x - CAP_OVER, b - h - CAP_H, wide, CAP_H);                     // cap above B
  block(c, p.x - CAP_OVER, b + h, wide, CAP_H);                             // cap below B
  block(c, p.x, b + h + CAP_H, w, GROUND_Y - (b + h + CAP_H) + 2);          // bottom body
  c.font = `bold 13px ${FONT}`;                       // option labels, right-aligned against the pipe
  c.textAlign = 'right';
  c.lineJoin = 'round';
  c.lineWidth = 4;
  c.fillStyle = '#fff';
  c.strokeStyle = '#3a2a1a';
  outlined(c, `A · ${p.labels[0]}`, p.x - 8, a + 5);
  outlined(c, `B · ${p.labels[1]}`, p.x - 8, b + 5);
}

/** Story HUD: bedtime clock (turns red once late), hearts, and the chapter title before the first flap. */
function storyHud(c, game, s) {
  c.lineJoin = 'round';
  c.lineWidth = 4;
  c.strokeStyle = '#3a2a1a';
  c.font = `bold 15px ${FONT}`;
  c.fillStyle = s.left > 0 ? '#fff' : '#ff8a8a';
  c.textAlign = 'left';
  outlined(c, `🕗 ${s.clock}`, 8, 22);
  c.font = `bold 11px ${FONT}`;
  outlined(c, 'bedtime 8:30 PM', 8, 38);
  c.font = `bold 15px ${FONT}`;
  c.fillStyle = '#fff';
  c.textAlign = 'right';
  outlined(c, `💛 ${s.love}`, W - 8, 22);
  if (game.status === STATUS.READY) {
    c.textAlign = 'center';
    c.lineWidth = 5;
    c.font = `bold 20px ${FONT}`;
    outlined(c, game.plan?.title ?? '', W / 2, 120);
    c.font = `bold 16px ${FONT}`;
    outlined(c, 'Tap / Space to fly', W / 2, 150);
  }
  // Choice banner: once the last ordinary pipe is behind us, spell out both options (A above, B below)
  // so they can be read before the decision pipe even enters the frame.
  const plan = game.plan;
  if (plan && plan.left === 0 && game.status === STATUS.PLAYING && game.pipes.every(q => q.cy2 !== undefined || q.passed)) {
    c.textAlign = 'center';
    c.lineWidth = 4;
    c.font = `bold 14px ${FONT}`;
    c.fillStyle = '#fff';
    outlined(c, `▲ A · ${plan.labels[0]}`, W / 2, 62);
    outlined(c, `▼ B · ${plan.labels[1]}`, W / 2, 82);
  }
}

/** Storm cloud banks: a solid band plus two layers of big dark circles drifting left at different speeds. */
function stormClouds(c, s) {
  const span = W + 160;                                  // wrap-around distance
  c.fillStyle = '#262d42';
  c.fillRect(0, 0, W, 44);                               // no sky peeks through at the very top
  for (const [layer, speed, y, r, color] of [[0, 0.25, 40, 34, '#262d42'], [1, 0.5, 62, 28, '#3a4360']]) {
    c.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      const x = ((((i * 61 + layer * 30) - s * speed) % span) + span) % span - 40;
      c.beginPath();
      c.arc(x, y + ((i * 17) % 20), r + ((i * 7) % 12), 0, TAU);
      c.fill();
    }
  }
}

/** Lightning: the whole sky flashes (timing from storm.js) and a zig-zag bolt of thin rects strikes. Skipped for reduced motion. */
function lightningLayer(c, s) {
  if (fx.reduced) return;
  const l = lightning(s);
  if (!l) return;
  c.globalAlpha = glow(l.t) * 0.4;
  c.fillStyle = '#dfe8ff';
  c.fillRect(0, 0, W, GROUND_Y);                         // sky flash
  if (l.t < 9) {                                         // the bolt itself, a different shape each strike
    c.globalAlpha = 1;
    c.fillStyle = '#fff';
    let x = 50 + ((l.k * 97) % 220);
    for (let i = 0; i < 7; i++) {
      x += ((l.k * 31 + i * 53) % 25) - 12;
      c.fillRect(x, 60 + i * 34, 4, 38);
    }
  }
  c.globalAlpha = 1;
}
