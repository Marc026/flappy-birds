/**
 * game.js — pure game rules: physics, pipe spawning, scoring and collisions.
 * It contains NO DOM or canvas code, so it can be unit-tested in Node (see tests/).
 */
import { W, H, PHYS, WORLD, RAMP, COIN_CHANCE } from './config.js';
import { makeRng } from './rng.js';

/** Lifecycle of a run. */
export const STATUS = Object.freeze({ READY: 'ready', PLAYING: 'playing', OVER: 'over' });

export class Game {
  /** @param {number} [seed] seeds the pipe layout: the same seed always produces the same pipes */
  constructor(seed) {
    this.reset(seed);
  }

  /** Start a fresh run: bird hovering mid-screen, no pipes, score 0. */
  reset(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.status = STATUS.READY;
    this.bird = { y: H / 2 - 40, v: 0 };   // y = centre (px), v = vertical speed (px per tick, + is down)
    this.pipes = [];                        // each pipe: { x, gy (gap centre), gap (opening height), passed }
    this.score = 0;
    this.seed = seed;                       // kept so a run can be shared or replayed
    this.rng = makeRng(seed);               // seeded random source for the pipe layout
    this.speed = WORLD.speed;               // current scroll speed (grows with the score)
    this.coins = 0;                         // coins collected this run
    this.ticks = 0;                         // ticks simulated this run (paces pipe spawning)
  }

  /**
   * Player input. The first flap starts the run; every flap gives the bird an upward impulse.
   * @returns {boolean} false if the run is already over and the input was ignored
   */
  flap() {
    if (this.status === STATUS.OVER) return false;
    this.status = STATUS.PLAYING;
    this.bird.v = PHYS.flap;
    return true;
  }

  /**
   * Advance the simulation by one fixed tick (1/60 s).
   * @returns {string[]} events from this tick: 'score' and/or 'hit'
   */
  update() {
    const events = [];
    if (this.status !== STATUS.PLAYING) return events;   // nothing moves while waiting or after a crash

    // Gravity: accelerate downward, then move.
    this.bird.v += PHYS.gravity;
    this.bird.y += this.bird.v;

    // Spawn a pipe pair at a fixed interval; the opening narrows as the score rises (difficulty ramp).
    if (this.ticks++ % WORLD.spawn === 0) {
      const gap = Math.max(WORLD.minGap, WORLD.gap - this.score * 2);
      const margin = gap / 2 + 40;   // keep the opening clear of the screen edges
      const gy = margin + this.rng() * (H - WORLD.groundH - 2 * margin);   // seeded, so identical for the same seed
      this.pipes.push({
        x: W, gy, cy: gy, gap, passed: false,
        amp: this.score >= RAMP.swayFrom ? RAMP.swayAmp : 0,   // late-game pipes sway up and down
        ph: this.rng() * 6.28,                                  // sway phase
        coin: this.rng() < COIN_CHANCE,                         // a coin floats in the opening?
      });
    }

    // Scroll pipes left; award a point once a pipe is fully behind the bird.
    this.speed = WORLD.speed + Math.min(this.score * RAMP.speedPerPoint, RAMP.maxExtraSpeed);   // faster as you score
    for (const p of this.pipes) {
      p.x -= this.speed;
      p.cy = p.gy + (p.amp || 0) * Math.sin(this.ticks / 35 + (p.ph || 0));   // current opening centre
      if (!p.passed && p.x + WORLD.pipeW < WORLD.birdX) {
        p.passed = true;
        this.score += 1;
        events.push('score');
      }
      // Coin pickup: the bird touches the coin floating in the middle of the opening.
      if (p.coin && Math.hypot(p.x + WORLD.pipeW / 2 - WORLD.birdX, p.cy - this.bird.y) < WORLD.birdR + 8) {
        p.coin = false;
        this.coins += 1;
        events.push('coin');
      }
    }
    this.pipes = this.pipes.filter(p => p.x > -WORLD.pipeW);   // drop pipes that left the screen

    if (this.collides()) {
      this.status = STATUS.OVER;
      events.push('hit');
    }
    return events;
  }

  /** True if the bird touches the ceiling, the ground or a pipe. */
  collides() {
    const { y } = this.bird;
    const r = WORLD.birdR;
    if (y - r < 0 || y + r > H - WORLD.groundH) return true;
    return this.pipes.some(p =>
      p.x < WORLD.birdX + r && p.x + WORLD.pipeW > WORLD.birdX - r &&   // overlaps the pipe column
      Math.abs(y - p.cy) > p.gap / 2 - r);                              // ...and is outside the opening
  }
}
