/**
 * ui.js — DOM overlay screens: menu, customization, goals, leaderboard and game over.
 * Presentation only: it renders HTML from saved data and reports button presses through one callback.
 */
import { SKINS, THEMES, GOALS, MEDALS, MODES } from './config.js';
import { progress, closest } from './goals.js';
import * as daily from './daily.js';

const root = document.getElementById('ui');   // overlay container declared in index.html

/** Escape text before it goes into innerHTML (saved data lives in localStorage, so it is user-editable). */
const esc = s => String(s).replace(/[&<>']/g, ch => `&#${ch.charCodeAt(0)};`);

/** Button markup; a click reports (act, arg) to the handler registered with bind(). */
const btn = (act, label, arg = '', cls = '') =>
  `<button class='${cls}' data-act='${act}' data-arg='${arg}'>${label}</button>`;
const back = btn('menu', '← Back');

/** A skin/theme is usable when it is free or the goal that unlocks it has been completed. */
const isUnlocked = (item, data) => !item.unlock || data.done.includes(item.unlock) || data.bought.includes(item.id);
const goalText = id => GOALS.find(g => g.id === id)?.text ?? '';

/** One button per option; locked options are disabled and show the goal that unlocks them. */
const options = (items, selected, data, act, colour) => items.map(item =>
  isUnlocked(item, data)
    ? btn(act, `<i class='swatch' style='background:${colour(item)}'></i>${item.name}`, item.id, item.id === selected ? 'sel' : '')
    : data.coins >= item.cost
      ? btn('buy', `🪙 Buy ${item.name} (${item.cost})`, item.id)   // second unlock path: spend coins
      : `<button disabled>🔒 ${goalText(item.unlock)} or 🪙 ${item.cost}</button>`
).join('');

/** One goal row: text plus a progress bar (used for lifetime and daily goals alike). */
const goalRow = g => `
      <li class='${g.done ? 'done' : ''}'><span>${g.done ? '✓ ' : ''}${g.text}</span>
        <progress max='${g.target}' value='${Math.min(g.value, g.target)}'></progress></li>`;

/** Screen templates: (saved data, optional run summary) -> HTML. */
const screens = {
  menu: d => `
    <h1>Flappy Birds</h1><p>Best: ${d.best} · 🪙 ${d.coins}</p>
    ${btn('play', 'Play')}${btn('mode', `Mode: ${(MODES[d.mode] ?? MODES.classic).name}`)}${btn('daily', `Daily challenge · 🔥 ${d.daily.streak}`)}${btn('skins', 'Customize')}${btn('goals', 'Goals')}${btn('scores', 'Leaderboard')}
    ${btn('mute', d.muted ? '🔇 Sound off' : '🔊 Sound on')}`,

  over: (d, run) => {
    const medal = MEDALS.find(m => run.score >= m.min);   // best medal earned this run
    const gap = d.best - run.score;                       // distance to your personal best
    const goal = closest(d);                              // nearest unfinished goal: a "one more try" nudge
    return `
    <h2>Game Over</h2>
    <small>${run.mode}${run.ranked ? '' : ' · practice, not ranked'}</small>
    ${medal ? `<p style='color:${medal.c}'>● ${medal.name} medal</p>` : ''}
    <p>Score ${run.score}${run.isBest ? ' — new best!' : ''}${run.coins ? ` · 🪙 +${run.coins}` : ''}</p>
    <p>${run.ranked && !run.isBest && gap > 0 && gap <= 5 ? `Only ${gap} from your best! ` : ''}Best ${d.best}</p>
    ${run.fresh.map(g => `<p>★ Goal complete: ${g.text}</p>`).join('')}
    ${run.daily.map(g => `<p>★ Daily goal: ${g.text} (+${daily.REWARD} 🪙)</p>`).join('')}
    ${goal ? `<p>Next: ${goal.text}</p><progress max='${goal.target}' value='${Math.min(goal.value, goal.target)}'></progress>` : ''}
    ${btn('retry', 'Retry')}${btn('share', 'Share score')}${btn('menu', 'Menu')}`;
  },

  skins: d => `
    <h2>Customize</h2>
    <h3>Bird</h3>${options(SKINS, d.skin, d, 'skin', s => s.body)}
    <h3>World</h3>${options(THEMES, d.theme, d, 'theme', t => t.top)}
    ${back}`,

  goals: d => `
    <h2>Goals</h2>
    <h3>Today · +${daily.REWARD} 🪙 each</h3>
    <ul>${daily.progress(d).map(goalRow).join('')}</ul>
    <h3>Lifetime</h3>
    <ul>${progress(d).map(goalRow).join('')}</ul>
    ${back}`,

  scores: d => `
    <h2>Leaderboard</h2>
    ${d.board.length
      ? `<ol>${d.board.map((e, i) => `<li><span>${i + 1}. ${Number(e.score)}</span><small>${esc(e.mode ?? 'Classic')} · ${esc(e.date)}</small></li>`).join('')}</ol>`
      : '<p>No runs yet — go set a score!</p>'}
    ${back}`,
};

/** Name of the screen on display (null while hidden). */
let current = null;
export const screen = () => (root.hidden ? null : current);

/** Show a screen over the game. */
export function show(name, data, extra = {}) {
  current = name;
  root.innerHTML = screens[name](data, extra);
  root.hidden = false;
}

/** Hide the overlay so the game receives input. */
export function hide() {
  root.hidden = true;
}

/** True while a menu covers the game. */
export const isOpen = () => !root.hidden;

/** Register the single callback that receives (action, argument) for every button press. */
export function bind(handler) {
  root.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    handler(b ? b.dataset.act : 'tap', b?.dataset.arg);   // a tap on empty overlay space is reported as 'tap'
  });
}
