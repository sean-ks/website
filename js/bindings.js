// tmux's prefix key bindings, its command names with their aliases and flags, and the list-keys mode.
import { D, el, sp, attr } from './base.js';
import { cell } from './metrics.js';
import { focusPane } from './screen.js';

export const PFX = 'C-a';
export const BIND = [['C-a', 'send-prefix', 'Send the prefix key'], ['"', 'split-window', 'Split window vertically'], ['%', 'split-window -h', 'Split window horizontally'],
  ['&', 'confirm-before -p "kill-window #W? (y/n)" kill-window', 'Kill current window'],
  ...'0123456789'.split('').map(i => [i, 'select-window -t :=' + i, 'Select window ' + i]),
  [';', 'last-pane', 'Move to the previously active pane'], ['?', 'list-keys -N', 'List key bindings'], ['c', 'new-window', 'Create a new window'],
  ['d', 'detach-client', 'Detach the current client'], ['l', 'last-window', 'Select the previously current window'], ['n', 'next-window', 'Select the next window'],
  ['o', 'select-pane -t :.+', 'Select the next pane'], ['p', 'previous-window', 'Select the previous window'], ['q', 'display-panes', 'Display pane numbers'],
  ['x', 'confirm-before -p "kill-pane #P? (y/n)" kill-pane', 'Kill the active pane'], ['z', 'resize-pane -Z', 'Zoom the active pane'],
  ['Up', 'select-pane -U', 'Select the pane above the active pane', 1], ['Down', 'select-pane -D', 'Select the pane below the active pane', 1],
  ['Left', 'select-pane -L', 'Select the pane to the left of the active pane', 1], ['Right', 'select-pane -R', 'Select the pane to the right of the active pane', 1]];
export const VALUE_FLAGS = 'tsp';
export const TMUX_COMMANDS = {
  'attach-session': 'attach t', 'confirm-before': 'confirm p', 'detach-client': 'detach', 'display-panes': 'displayp', 'kill-pane': 'killp',
  'kill-server': '', 'kill-session': ' t', 'kill-window': 'killw', 'last-pane': 'lastp', 'last-window': 'last', 'list-keys': 'lsk N',
  'list-sessions': 'ls', 'new-session': 'new ds', 'new-window': 'neww', 'next-window': 'next', 'previous-window': 'prev', 'resize-pane': 'resizep Z',
  'select-pane': 'selectp DLRUlt', 'select-window': 'selectw t', 'send-prefix': '', 'split-window': 'splitw hv',
};

export function listKeysMode(p) {
  if (p.mode) return;
  const e = attr(el('div', 'mode'), { tabindex: '-1', role: 'document', 'aria-label': 'tmux key bindings; q closes' }), list = el('div', 'ml'), ind = sp('ind');
  for (const b of BIND) list.append(el('div', 'l', (PFX + ' ' + b[0]).padEnd(12) + b[2]));
  e.append(list, ind);
  const fit = () => { ind.textContent = '[' + Math.round(list.scrollTop / cell.h) + '/' + Math.max(0, Math.round((list.scrollHeight - list.clientHeight) / cell.h)) + ']'; };
  list.addEventListener('scroll', fit, { passive: true });
  const m = p.mode = { el: e, fit, close() {
    const had = e.contains(D.activeElement);
    e.remove(); p.mode = null; p.el.classList.remove('md'); p.el.classList.toggle('alt', !!p.alt);
    if (!p.alt) p.el.scrollTop = p.el.scrollHeight;
    if (had) focusPane(p);
  } };
  m.key = ev => {
    const k = ev.key, pg = Math.max(cell.h, list.clientHeight - cell.h);
    if (k === 'q' || k === 'Escape') m.close();
    else if (k === 'ArrowDown' || k === 'j') list.scrollTop += cell.h;
    else if (k === 'ArrowUp' || k === 'k') list.scrollTop -= cell.h;
    else if (k === 'PageDown' || k === ' ') list.scrollTop += pg;
    else if (k === 'PageUp') list.scrollTop -= pg;
    else if (k === 'g' || k === 'Home') list.scrollTop = 0;
    else if (k === 'G' || k === 'End') list.scrollTop = list.scrollHeight;
    else return k.length === 1 || k === 'Tab';
    return true;
  };
  p.el.append(e); p.el.classList.add('alt', 'md');
  p.el.scrollTop = 0;
  fit();
  focusPane(p);
}
