// A pane: its log and a prompt line whose hidden input is mirrored with a block cursor, readline keys, history and Tab completion.
import { D, el, sp, attr, HOME } from './base.js';
import { setP, client } from './state.js';
import { HOMEN, resolve, kids } from './fs.js';
import { cell } from './metrics.js';
import { echo, columns, termCols, bottom } from './output.js';
import { selectPane, refresh } from './screen.js';
import { CMDS, submit } from './shell.js';
import { clear } from './fastfetch.js';
import { TMUX_COMMANDS } from './bindings.js';

export function mkPane(cwd) {
  const p = { cwd: cwd || HOMEN, oldpwd: null, status: 0, hist: [], hpos: 0, draft: '', busy: false, tabbed: false, last: '', rq: 0, stick: true, st: 0, x: 0, y: 0, sx: 80, sy: 24 };
  const e = p.el = el('div', 'pane'), typed = attr(sp('typed'), { 'aria-hidden': 'true' }), i = p.inp = el('input');
  p.out = attr(el('div', 'out'), { role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output' });
  p.cmd = attr(el('form', 'cmd'), { action: '#', autocomplete: 'off' });
  p.ps1 = attr(sp(), { 'aria-hidden': 'true' });
  p.pre = sp(); p.sel = sp('sel'); p.cur = sp('cur', ' '); p.post = sp();
  typed.append(p.pre, p.sel, p.cur, p.post);
  attr(i, { type: 'text', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go' });
  p.cmd.append(p.ps1, typed, i);
  e.append(p.out, p.cmd);
  e._p = p;
  i.addEventListener('keydown', ev => onKey(p, ev));
  p.cmd.addEventListener('submit', function onSubmitForImeEnter(ev) { ev.preventDefault(); if (!p.busy) enter(p); });
  i.addEventListener('input', () => { draw(p); if (p.cmd.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom) bottom(p); });
  i.addEventListener('focus', () => { p.cmd.classList.add('on'); p.last = ''; draw(p); if (p.w && p.w.act !== p && client && client.s.cur === p.w) { selectPane(p); refresh(); } });
  i.addEventListener('blur', () => { p.cmd.classList.remove('on'); draw(p); });
  i.addEventListener('select', () => queueDraw(p));
  return p;
}

const caret = p => p.inp.selectionStart == null ? p.inp.value.length : p.inp.selectionStart;
export function setInput(p, v, pos) { p.inp.value = v; pos = pos == null ? v.length : pos; try { p.inp.setSelectionRange(pos, pos); } catch (e) {} draw(p); }
export function draw(p) {
  const v = p.inp.value;
  let s = p.inp.selectionStart, e = p.inp.selectionEnd;
  if (s == null || D.activeElement !== p.inp) s = e = Math.min(s == null ? v.length : s, v.length);
  if (s !== e) {
    p.pre.textContent = v.slice(0, s); p.sel.textContent = v.slice(s, e); p.post.textContent = v.slice(e);
    p.cur.classList.add('off');
  } else {
    const n = (v.codePointAt(s) || 0) > 0xffff ? 2 : 1;
    p.pre.textContent = v.slice(0, s); p.sel.textContent = '';
    p.cur.textContent = s < v.length ? v.slice(s, s + n) : ' ';
    p.post.textContent = v.slice(s + n);
    p.cur.classList.remove('off');
  }
  const k = v + '\u0000' + s + ':' + e;
  if (k !== p.last) { p.last = k; p.cur.style.animation = 'none'; void p.cur.offsetWidth; p.cur.style.animation = ''; }
}
export const queueDraw = p => { if (!p.rq) p.rq = requestAnimationFrame(() => { p.rq = 0; draw(p); }); };
function histMove(p, d) {
  if (p.hpos === p.hist.length && d < 0) p.draft = p.inp.value;
  const n = Math.max(0, Math.min(p.hist.length, p.hpos + d));
  if (n === p.hpos) return;
  p.hpos = n; setInput(p, n === p.hist.length ? p.draft : p.hist[n]);
}
const lcp = a => a.reduce((p, s) => { let i = 0; while (i < p.length && p[i] === s[i]) i++; return p.slice(0, i); });
function complete(p) {
  const v = p.inp.value, c = caret(p), b = v.slice(0, c), ws = b.lastIndexOf(' ') + 1;
  const word = b.slice(ws), head = b.slice(0, ws).trim();
  const put = t => setInput(p, v.slice(0, ws) + t + v.slice(c), ws + t.length);
  let pre = '', base = word, list;
  setP(p);
  if (!head && !word.includes('/') && word[0] !== '~' && word[0] !== '.') {
    list = Object.keys(CMDS).filter(k => k.startsWith(word)).sort().map(s => ({ s }));
  } else if (head === 'tmux') {
    list = Object.keys(TMUX_COMMANDS).filter(k => k.startsWith(word)).map(s => ({ s }));
  } else {
    if (word === '~') return put('~/');
    const k = word.lastIndexOf('/');
    pre = word.slice(0, k + 1); base = word.slice(k + 1);
    let d = p.cwd;
    if (pre) { const r = resolve(pre.replace(/^~(?=\/)/, HOME)); if (r.err || r.n.t !== 'd') return; d = r.n; }
    const dirsOnly = head.split(/\s+/)[0] === 'cd';
    list = kids(d, base[0] === '.').filter(n => n.name.startsWith(base) && (!dirsOnly || n.t === 'd')).map(n => ({ s: n.name, d: n.t === 'd' }));
    if (base === '..') list = [{ s: '..', d: true }];
  }
  if (!list.length) return;
  if (list.length === 1) return put(pre + list[0].s + (list[0].d ? '/' : ' '));
  const l = lcp(list.map(x => x.s));
  if (l.length > base.length) { put(pre + l); p.tabbed = true; return; }
  if (!p.tabbed) { p.tabbed = true; return; }
  echo(v);
  columns(list.map(x => { const t = x.s + (x.d ? '/' : ''); return { el: D.createTextNode(t), len: t.length }; }), termCols());
  bottom(p);
}
export function lineCtrl(p, k) {
  const v = p.inp.value, i = caret(p);
  if (k === 'c') {
    if (p.inp.selectionStart !== p.inp.selectionEnd) return false;
    setP(p); echo(v + '^C'); setInput(p, ''); p.hpos = p.hist.length; p.status = 130; bottom(p);
  }
  else if (k === 'l') { setP(p); clear(); p.el.scrollTop = 0; }
  else if (k === 'u') setInput(p, v.slice(i), 0);
  else if (k === 'k') setInput(p, v.slice(0, i));
  else if (k === 'w') { const b = v.slice(0, i).replace(/\S+\s*$|\s+$/, ''); setInput(p, b + v.slice(i), b.length); }
  else if (k === 'a') setInput(p, v, 0);
  else if (k === 'e') setInput(p, v);
  else if (k === 'b') setInput(p, v, Math.max(0, i - 1));
  else if (k === 'd') { if (v) setInput(p, v.slice(0, i) + v.slice(i + 1), i); else submit(p, 'exit', 1); }
  else return false;
  return true;
}
function onKey(p, e) {
  const k = e.key;
  if (k !== 'Tab') p.tabbed = false;
  if (e.isComposing || e.keyCode === 229) return;
  if (p.busy) { if (k === 'Enter' || k === 'Tab') e.preventDefault(); return; }
  if (k === 'Enter') { e.preventDefault(); enter(p); }
  else if (k === 'Tab') { if (e.shiftKey || !p.inp.value) return; e.preventDefault(); complete(p); }
  else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); histMove(p, k === 'ArrowUp' ? -1 : 1); }
  else if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); p.el.scrollTop += (k === 'PageUp' ? -1 : 1) * Math.max(cell.h, p.el.clientHeight - cell.h); }
  else if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && /^[a-z]$/i.test(k) && lineCtrl(p, k.toLowerCase())) e.preventDefault();
  else queueDraw(p);
}
function enter(p) { const v = p.inp.value; setInput(p, ''); submit(p, v); }
