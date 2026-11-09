/**
 * storage.js — persistence layer. The rest of the app never touches localStorage directly,
 * so moving to a server-backed store later only means changing this file.
 */

const KEY = 'flappy-birds:v1';   // versioned key: bump the suffix if the data shape changes

/** Shape of the saved record; doubles as the first-launch defaults. */
const DEFAULTS = {
  best: 0,          // highest score in a single run
  games: 0,         // runs played
  total: 0,         // pipes passed across all runs
  board: [],        // top-10 runs: { score, date }, best first
  done: [],         // ids of completed goals (see config.js GOALS)
  skin: 'sun',      // selected bird skin id
  theme: 'day',     // selected background theme id
  muted: false,     // sound off?
  coins: 0,         // coins collected and not yet spent
  bought: [],       // ids of skins/themes bought with coins
  daily: { date: 0, best: 0, streak: 0 },   // daily challenge: last day played (YYYYMMDD), that day's best, streak
};

/** Load saved data merged over the defaults; tolerates blocked storage and corrupt JSON. */
export function load() {
  try {
    return { ...structuredClone(DEFAULTS), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

/** Persist the whole record. Failure (private mode, quota) is non-fatal: progress just is not kept. */
export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore: the game keeps working without persistence */
  }
}
