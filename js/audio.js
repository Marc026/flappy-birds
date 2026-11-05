/**
 * audio.js — background music and sound effects, synthesised with the Web Audio API
 * (no audio files to ship). Browsers block audio until a user gesture, so call init() from a click.
 */

const MELODY = [523, 659, 784, 659, 440, 523, 659, 523, 349, 440, 523, 440, 392, 494, 587, 494];   // C-Am-F-G arpeggios (Hz)
const BASS = [131, 110, 87, 98];   // root note of each 4-step bar (Hz)
const STEP_MS = 230;               // music tempo: one note every 230 ms

let ctx = null;     // AudioContext, created lazily by init()
let timer = null;   // setInterval handle of the music sequencer
let step = 0;       // position in the melody
let muted = false;

/** Play one note: oscillator -> decaying gain -> speakers. `delay` is seconds from now. */
function tone(freq, dur, type, vol, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);   // fade out to avoid clicks
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/** Create/resume the audio context. Must be called from a user gesture (click or tap). */
export function init() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}

/** Start the looping background track (no-op if it is already playing). */
export function startMusic() {
  if (timer || !ctx) return;
  timer = setInterval(() => {
    tone(MELODY[step % MELODY.length], 0.35, 'triangle', 0.07);                  // lead note
    if (step % 4 === 0) tone(BASS[(step / 4) % 4], 0.9, 'sine', 0.1);            // bass at the start of each bar
    step += 1;
  }, STEP_MS);
}

/** Stop the background track. */
export function stopMusic() {
  clearInterval(timer);
  timer = null;
}

/** Mute/unmute everything (the music keeps its schedule, it is just silent). */
export function setMuted(value) {
  muted = value;
}

/** Sound effects used by the game. */
export const sfx = {
  flap: () => tone(520, 0.12, 'square', 0.04),
  score: () => { tone(880, 0.1, 'sine', 0.1); tone(1175, 0.15, 'sine', 0.1, 0.08); },
  hit: () => tone(110, 0.4, 'sawtooth', 0.15),
};
