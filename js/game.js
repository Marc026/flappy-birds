/**
 * game.js — pure game rules: physics, pipe spawning, scoring and collisions.
 * It contains NO DOM or canvas code, so it can be unit-tested in Node (see tests/).
 */
import { W, H, PHYS, WORLD } from './config.js';

/** Lifecycle of a run. */
export const STATUS = Object.freeze({ READY: 'ready', PLAYING: 'playing', OVER: 'over' });

export class Game {
  constructor() {
    this.reset();
  }

  /** Start a fresh run: bird hovering mid-screen, no pipes, score 0. */
  reset() {
    this.status = STATUS.READY;
    this.bird = { y: H / 2 - 40, v: 0 };   // y = centre (px), v = vertical speed (px per tick, + is down)
    this.pipes = [];                        // each pipe: { x, gy (gap centre), gap (opening height), passed }
    this.score = 0;
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
      const gy = margin + Math.random() * (H - WORLD.groundH - 2 * margin);
      this.pipes.push({ x: W, gy, gap, passed: false });
    }

    // Scroll pipes left; award a point once a pipe is fully behind the bird.
    for (const p of this.pipes) {
      p.x -= WORLD.speed;
      if (!p.passed && p.x + WORLD.pipeW < WORLD.birdX) {
        p.passed = true;
        this.score += 1;
        events.push('score');
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
      Math.abs(y - p.gy) > p.gap / 2 - r);                              // ...and is outside the opening
  }
}
