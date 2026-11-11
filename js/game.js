/**
 * game.js — pure game rules: physics, pipe spawning, scoring and collisions.
 * It contains NO DOM or canvas code, so it can be unit-tested in Node (see tests/).
 */
import { W, H, PHYS, WORLD, RAMP, COIN_CHANCE, SHIELD_CHANCE, MODES } from './config.js';
import { makeRng } from './rng.js';

/** Lifecycle of a run (SCENE = a story cutscene is on screen and the world is frozen). */
export const STATUS = Object.freeze({ READY: 'ready', PLAYING: 'playing', OVER: 'over', SCENE: 'scene' });

export class Game {
  /**
   * @param {number} [seed] seeds the pipe layout: the same seed always produces the same pipes
   * @param {object} [mode] tuning preset from MODES (defaults to Classic)
   * @param {object} [plan] story segment plan { left, labels, rain, title }; null outside story mode
   */
  constructor(seed, mode, plan) {
    this.reset(seed, mode, plan);
  }

  /** Start a fresh run: bird hovering mid-screen, no pipes, score 0. */
  reset(seed = (Math.random() * 2 ** 32) >>> 0, mode = MODES.classic, plan = null) {
    this.status = STATUS.READY;
    this.bird = { y: H / 2 - 40, v: 0 };   // y = centre (px), v = vertical speed (px per tick, + is down)
    this.pipes = [];                        // each pipe: { x, gy (gap centre), gap (opening height), passed }
    this.score = 0;
    this.seed = seed;                       // kept so a run can be shared or replayed
    this.rng = makeRng(seed);               // seeded random source for the pipe layout
    this.plan = plan && { ...plan };        // story segment plan (copied because `left` counts down); null outside story mode
    this.choice = -1;                       // opening picked at the decision pipe: 0 or 1 (-1 = not yet)
    this.mode = mode;                       // tuning preset for this run (see MODES in config.js)
    this.shield = false;                    // holding a shield? it absorbs one crash
    this.grace = 0;                         // ticks of pipe-invulnerability left after a shield breaks
    this.speed = mode.speed;               // current scroll speed (grows with the score)
    this.coins = 0;                         // coins collected this run
    this.nextSpawn = 0;                     // tick at which the next pipe spawns
    this.ticks = 0;                         // ticks simulated this run (paces pipe spawning)
  }

  /**
   * Player input. The first flap starts the run; every flap gives the bird an upward impulse.
   * @returns {boolean} false if the run is already over and the input was ignored
   */
  flap() {
    if (this.status === STATUS.OVER || this.status === STATUS.SCENE) return false;
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
    if (this.ticks++ === this.nextSpawn && !(this.plan && this.plan.done)) {
      this.nextSpawn += WORLD.spawn;
      const gap = Math.max(this.mode.minGap, this.mode.gap - this.score * 2);
      const margin = gap / 2 + 40;   // keep the opening clear of the screen edges
      const gy = margin + this.rng() * (H - WORLD.groundH - 2 * margin);   // seeded, so identical for the same seed
      const roll = this.rng();   // one draw decides the pickup (shield, coin or nothing) so seeds stay deterministic
      this.pipes.push({
        x: W, gy, cy: gy, gap, passed: false,
        amp: this.mode.sway && this.score >= (this.mode.swayFrom ?? RAMP.swayFrom) ? RAMP.swayAmp : 0,   // late-game pipes sway up and down
        ph: this.rng() * 6.28,                                  // sway phase
        shield: roll < SHIELD_CHANCE,                              // rare one-hit shield pickup
        coin: roll >= SHIELD_CHANCE && roll < SHIELD_CHANCE + COIN_CHANCE,                         // a coin floats in the opening?
      });
      if (this.plan) {   // story segment: N ordinary pipes, then ONE decision pipe with two openings, then no more spawns
        const p = this.pipes[this.pipes.length - 1];
        if (this.plan.left > 0) {
          this.plan.left -= 1;
          if (this.plan.left === 0) this.nextSpawn += WORLD.decisionSpawn - WORLD.spawn;   // empty stretch before the decision pipe
        } else {
          Object.assign(p, { gy: 135, cy: 135, cy2: 345, gap: 110, amp: 0, coin: false, shield: false, choice: -1, labels: this.plan.labels });
          this.plan.done = true;
        }
      }
    }

    // Scroll pipes left; award a point once a pipe is fully behind the bird.
    this.speed = this.mode.speed + Math.min(this.score * RAMP.speedPerPoint, RAMP.maxExtraSpeed) * this.mode.ramp;   // faster as you score
    for (const p of this.pipes) {
      p.x -= this.speed;
      p.cy = p.gy + (p.amp || 0) * Math.sin(this.ticks / 35 + (p.ph || 0));   // current opening centre
      if (!p.passed && p.x + WORLD.pipeW < WORLD.birdX) {
        p.passed = true;
        this.score += 1;
        events.push('score');
      }
      // Decision pipe: note which opening the bird is in as the pipe's centre passes it.
      if (p.cy2 !== undefined && p.choice < 0 && p.x + WORLD.pipeW / 2 < WORLD.birdX) {
        p.choice = Math.abs(this.bird.y - p.cy) <= Math.abs(this.bird.y - p.cy2) ? 0 : 1;
        this.choice = p.choice;
        events.push('choice');
      }
      // Coin pickup: the bird touches the coin floating in the middle of the opening.
      if (p.coin && Math.hypot(p.x + WORLD.pipeW / 2 - WORLD.birdX, p.cy - this.bird.y) < WORLD.birdR + 8) {
        p.coin = false;
        this.coins += 1;
        events.push('coin');
      }
      // Shield pickup works the same way and arms a one-hit shield.
      if (p.shield && Math.hypot(p.x + WORLD.pipeW / 2 - WORLD.birdX, p.cy - this.bird.y) < WORLD.birdR + 8) {
        p.shield = false;
        this.shield = true;
        events.push('shield');
      }
    }
    this.pipes = this.pipes.filter(p => p.x > -WORLD.pipeW);   // drop pipes that left the screen

    if (this.grace > 0) this.grace -= 1;
    if (this.collides()) {
      if (this.shield || this.plan) {   // a shield, or any crash in story mode (a stumble), is absorbed: bounce clear, ignore pipes briefly
        const hadShield = this.shield;
        this.shield = false;
        this.grace = 60;
        const r = WORLD.birdR;
        this.bird.y = Math.min(Math.max(this.bird.y, r + 1), H - WORLD.groundH - r - 1);   // back inside the playfield
        this.bird.v = this.bird.y < H / 2 ? 2 : PHYS.flap;                                 // away from the edge that was hit
        events.push(hadShield ? 'break' : 'stumble');   // story crashes cost time, never the run
      } else {
        this.status = STATUS.OVER;
        events.push('hit');
      }
    }
    return events;
  }

  /** True if the bird touches the ceiling, the ground or a pipe. */
  collides() {
    const { y } = this.bird;
    const r = WORLD.birdR;
    if (y - r < 0 || y + r > H - WORLD.groundH) return true;
    if (this.grace > 0) return false;   // just after a shield broke: pipes are ignored
    return this.pipes.some(p =>
      p.x < WORLD.birdX + r && p.x + WORLD.pipeW > WORLD.birdX - r &&   // overlaps the pipe column
      Math.abs(y - p.cy) > p.gap / 2 - r && (p.cy2 === undefined || Math.abs(y - p.cy2) > p.gap / 2 - r));                              // ...and is outside the opening
  }
}
