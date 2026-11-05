/**
 * ui.js — DOM overlay screens: menu, customization, goals, leaderboard and game over.
 * Presentation only: it renders HTML from saved data and reports button presses through one callback.
 */
import { SKINS, THEMES, GOALS } from './config.js';
import { progress } from './goals.js';

const root = document.getElementById('ui');   // overlay container declared in index.html

/** Escape text before it goes into innerHTML (saved data lives in localStorage, so it is user-editable). */
const esc = s => String(s).replace(/[&<>']/g, ch => `&#${ch.charCodeAt(0)};`);

/** Button markup; a click reports (act, arg) to the handler registered with bind(). */
const btn = (act, label, arg = '', cls = '') =>
  `<button class='${cls}' data-act='${act}' data-arg='${arg}'>${label}</button>`;
const back = btn('menu', '← Back');

/** A skin/theme is usable when it is free or the goal that unlocks it has been completed. */
const isUnlocked = (item, data) => !item.unlock || data.done.includes(item.unlock);
const goalText = id => GOALS.find(g => g.id === id)?.text ?? '';

/** One button per option; locked options are disabled and show the goal that unlocks them. */
const options = (items, selected, data, act, colour) => items.map(item =>
  isUnlocked(item, data)
    ? btn(act, `<i class='swatch' style='background:${colour(item)}'></i>${item.name}`, item.id, item.id === selected ? 'sel' : '')
    : `<button disabled>🔒 ${goalText(item.unlock)}</button>`
).join('');

/** Screen templates: (saved data, optional run summary) -> HTML. */
const screens = {
  menu: d => `
    <h1>Flappy Birds</h1><p>Best: ${d.best}</p>
    ${btn('play', 'Play')}${btn('skins', 'Customize')}${btn('goals', 'Goals')}${btn('scores', 'Leaderboard')}
    ${btn('mute', d.muted ? '🔇 Sound off' : '🔊 Sound on')}`,

  over: (d, run) => `
    <h2>Game Over</h2>
    <p>Score ${run.score}${run.isBest ? ' — new best!' : ''}</p><p>Best ${d.best}</p>
    ${run.fresh.map(g => `<p>★ Goal complete: ${g.text}</p>`).join('')}
    ${btn('play', 'Retry')}${btn('menu', 'Menu')}`,

  skins: d => `
    <h2>Customize</h2>
    <h3>Bird</h3>${options(SKINS, d.skin, d, 'skin', s => s.body)}
    <h3>World</h3>${options(THEMES, d.theme, d, 'theme', t => t.top)}
    ${back}`,

  goals: d => `
    <h2>Goals</h2>
    <ul>${progress(d).map(g => `
      <li class='${g.done ? 'done' : ''}'><span>${g.done ? '✓ ' : ''}${g.text}</span>
        <progress max='${g.target}' value='${Math.min(g.value, g.target)}'></progress></li>`).join('')}</ul>
    ${back}`,

  scores: d => `
    <h2>Leaderboard</h2>
    ${d.board.length
      ? `<ol>${d.board.map((e, i) => `<li><span>${i + 1}. ${Number(e.score)}</span><small>${esc(e.date)}</small></li>`).join('')}</ol>`
      : '<p>No runs yet — go set a score!</p>'}
    ${back}`,
};

/** Show a screen over the game. */
export function show(name, data, extra = {}) {
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
    if (b) handler(b.dataset.act, b.dataset.arg);
  });
}
