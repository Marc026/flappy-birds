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
let level = 0;     // music intensity 0-3: faster tempo and an extra layer as the score climbs

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
    if (level >= 2 && step % 2 === 0) tone(MELODY[step % MELODY.length] * 2, 0.12, 'sine', 0.03);   // extra high layer
    step += 1;
  }, Math.max(130, STEP_MS - level * 30));   // tempo rises with intensity
}

/** Stop the background track. */
export function stopMusic() {
  clearInterval(timer);
  timer = null;
}

/** Set music intensity (0-3); restarts the sequencer so the new tempo applies immediately. */
export function setLevel(l) {
  if (l === level) return;
  level = l;
  if (timer) {
    stopMusic();
    startMusic();
  }
}

/** Mute/unmute everything (the music keeps its schedule, it is just silent). */
export function setMuted(value) {
  muted = value;
}

/** Sound effects used by the game. */
export const sfx = {
  flap: () => tone(520, 0.12, 'square', 0.04),
  score: (n = 0) => {   // pitch rises one semitone per point (capped at an octave) and resets each run
    const k = 2 ** (Math.min(n, 12) / 12);
    tone(880 * k, 0.1, 'sine', 0.1);
    tone(1175 * k, 0.15, 'sine', 0.1, 0.08);
  },
  coin: () => tone(1568, 0.08, 'square', 0.05),
  shield: () => { tone(660, 0.1, 'triangle', 0.08); tone(990, 0.18, 'triangle', 0.08, 0.08); },   // pickup: rising two-note chime
  thunder: () => { tone(70, 1.2, 'sawtooth', 0.1, 0.3); tone(48, 1.6, 'sine', 0.14, 0.3); },   // distant rumble after the flash
  crack: () => tone(180, 0.25, 'square', 0.1),                                                      // shield absorbed a crash
  hit: () => tone(110, 0.4, 'sawtooth', 0.15),
};
