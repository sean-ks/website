// Output in the running shell's pane: lines, prompts, clickable names, linked file text and ls-style columns.
import { D, el, sp, attr, USER, HOST } from './base.js';
import { P } from './state.js';
import { HOMEN, pathOf, wname } from './fs.js';

export function L(...a) { const d = el('div', 'l'); d.append(...a.filter(x => x != null)); P.out.append(d); return d; }
export const Ls = a => a.forEach(x => L(x));
export const bad = (msg, c, st = 1) => { L(msg); L("Try '" + c + " --help' for more information."); return st; };
function prompt(w) { const f = D.createDocumentFragment(); f.append('[', sp('u', USER + '@' + HOST), ' ' + w + ']$ '); return f; }
export const echo = s => L(prompt(wname(P)), s).classList.add('pl');
export function renderPrompt(p) {
  p.ps1.replaceChildren(prompt(wname(p)));
  const n = p.w && p.w.list.length > 1 ? ', pane ' + p.w.list.indexOf(p) : '';
  p.inp.setAttribute('aria-label', 'Terminal command' + n + ', in ' + (p.cwd === HOMEN ? 'home directory' : pathOf(p.cwd)));
}

export const btn = (cls, txt) => attr(sp(cls, txt), { role: 'button' });
export function ent(n, label) {
  const b = btn('f' + (n.t === 'd' ? ' di' : ''), label == null ? n.name : label);
  b._n = n;
  return b;
}
export function cx(c, label) {
  const b = btn('x', label || c), m = /^(?:(cat|open|echo|cd|theme|tmux)|exit|logout)$/.exec(c);
  if (m) b.dataset.fill = m[1] ? c + ' ' : c; else b.dataset.run = c;
  return b;
}
export function welcome() { L("Welcome! Type '", cx('help'), "' for commands, '", cx('ls'), "' to look around, or '", cx('view .'), "' to browse files."); }

const LINK = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])|([\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,})/gi;
function linkify(d, s) {
  let i = 0;
  for (const m of s.matchAll(LINK)) {
    d.append(s.slice(i, m.index));
    const a = el('a', '', m[0]);
    if (m[1]) { a.href = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; } else a.href = 'mailto:' + m[2];
    d.append(a); i = m.index + m[0].length;
  }
  d.append(s.slice(i));
}
export function fileBox(text) {
  const box = el('div', 'file');
  for (const s of text.replace(/\n$/, '').split('\n')) {
    const d = el('div', 'l'), hanging = /^\s*(?:[-*]|\d+\.) |^\S+ {2,}(?=\S)/.exec(s);
    if (hanging) { d.className = 'l li' + (/  $/.test(hanging[0]) && !/\s/.test(s.slice(hanging[0].length)) ? ' kv' : ''); d.style.setProperty('--i', hanging[0].length); }
    linkify(d, s); box.append(d);
  }
  return box;
}
export function columns(items, W) {
  const n = items.length;
  if (!n) return;
  let rows = n, ws = [Math.max(...items.map(i => i.len))];
  for (let c = Math.min(n, Math.floor((W + 2) / 3)); c > 1; c--) {
    const r = Math.ceil(n / c), w = [];
    for (let k = 0; k * r < n; k++) w.push(Math.max(...items.slice(k * r, k * r + r).map(i => i.len)));
    if (w.reduce((a, b) => a + b + 2, -2) <= W) { rows = r; ws = w; break; }
  }
  for (let r = 0; r < rows; r++) {
    const d = L();
    for (let k = 0; k < ws.length; k++) {
      const it = items[k * rows + r];
      if (!it) break;
      d.append(it.el);
      if (k + 1 < ws.length && items[(k + 1) * rows + r]) d.append(' '.repeat(ws[k] - it.len + 2));
    }
  }
}
export const termCols = () => P.sx;
export const bottom = p => { p.el.scrollTop = p.el.scrollHeight; };
