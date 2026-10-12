// Input routing: the tmux prefix and its bindings, keys for programs on the alternate screen, and mouse and touch on panes and names.
import { D, coarse, term, keys } from './base.js';
import { client, prefixArmed, setPrefixArmed, repeatUntil, setRepeatUntil, confirmYes, setConfirmYes } from './state.js';
import { quote, relativeName } from './fs.js';
import { parse, submit } from './shell.js';
import { lineCtrl, setInput, queueDraw } from './pane.js';
import { selectPane, selectWindow, refresh, update, activePane, focusPane, mayFocus } from './screen.js';
import { drawStatus, message, panesShown, hidePanes } from './status.js';
import { BIND } from './bindings.js';
import { runTmux } from './tmux-commands.js';

const REPEAT_MS = 500;
const bindingContext = () => ({ p: activePane(), key: 1, f: mayFocus(), err: m => (message(m), 1) });

function onPrefixKeyCapture(e) {
  const k = e.key;
  if (!client || e.isComposing || e.keyCode === 229 || /^(Shift|Control|Alt|Meta|AltGraph|CapsLock|Fn|OS)$/.test(k)) return;
  const ctrl = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
  const pk = ctrl ? (/^[ab]$/i.test(k) ? k.toLowerCase() : /^Key[AB]$/.test(e.code) && !/^[a-z]$/i.test(k) ? e.code[3].toLowerCase() : '') : '';
  const eat = () => { e.preventDefault(); e.stopPropagation(); };
  if (panesShown) { hidePanes(); if (/^\d$/.test(k)) { eat(); const t = client.s.cur.list[k]; if (t) { selectPane(t); update(mayFocus()); } return; } }
  if (client.msg) {
    const yes = confirmYes;
    setConfirmYes(null); client.msg = ''; drawStatus();
    if (yes) { eat(); if (k === 'y' || k === 'Y') yes(); return; }
  }
  if (prefixArmed) {
    setPrefixArmed(0);
    if (pk) { eat(); const p = activePane(); if (!p.alt && !p.mode && !p.busy) lineCtrl(p, pk); return; }
    const b = !(e.metaKey || e.ctrlKey !== e.altKey) && BIND.find(b => b[0] === k.replace(/^Arrow/, ''));
    if (b) { eat(); runTmux(parse(b[1]).words, bindingContext()); setRepeatUntil(b[3] ? performance.now() + REPEAT_MS : 0); }
    else if (!(e.metaKey || /^F\d/.test(k) || e.ctrlKey && (/^v$/i.test(k) || /^[cx]$/i.test(k) && String(getSelection())))) eat();
    return;
  }
  if (pk) { setPrefixArmed(1); eat(); return; }
  if (repeatUntil > performance.now() && /^Arrow/.test(k) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    eat(); runTmux(['select-pane', '-' + k[5]], bindingContext()); setRepeatUntil(performance.now() + REPEAT_MS); return;
  }
  setRepeatUntil(0);
}
function onProgramKey(e) {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
  const p = activePane(), m = p.mode || p.alt, t = e.target;
  if (m) {
    if ((e.key === 'Enter' || e.key === ' ') && t.closest && t.closest('a')) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && m.key(e)) e.preventDefault();
    return;
  }
  if (t === p.inp || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1 && e.key !== ' ') focusPane(p);
}
function activate(b, p) {
  if (p.mode || p.alt) {
    if (!b.closest('.keys')) return;
    (p.mode || p.alt).close();
    return setTimeout(() => activate(b, p));
  }
  if (p.busy) return;
  if (b.dataset.fill) { setInput(p, b.dataset.fill); focusPane(p); return; }
  const n = b._n, list = n ? (n.t === 'd' ? ['cd ' + quote(relativeName(n, p.cwd)), 'ls'] : [(n.t === 'l' ? 'open ' : 'cat ') + quote(relativeName(n, p.cwd))]) : [b.dataset.run];
  list.reduce((q, c) => q.then(() => submit(p, c)), Promise.resolve());
}
function onTermClickForIOSTaps(e) {
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t.closest('.view, .mode')) return;
  const selected = String(getSelection() || '') !== '', wi = t.closest('[data-w]');
  if (wi) { const w = client && client.s.wins.find(w => String(w.i) === wi.dataset.w); if (w) { const f = mayFocus(); selectWindow(w); update(f); } return; }
  const pe = t.closest('.pane'), p = pe ? pe._p : activePane(), b = t.closest('.f, .x, [data-run]');
  if (b) {
    if (selected && !b.closest('.keys')) return;
    e.preventDefault();
    activate(b, p);
    if (!coarse.matches) focusPane(p);
    return;
  }
  if (!selected && pe && !t.closest('a, canvas, .ff-logo')) focusPane(p);
}
const keepFocusAndKeyboardUp = e => e.preventDefault();

export function listen() {
  D.addEventListener('visibilitychange', () => { setPrefixArmed(0); setRepeatUntil(0); if (!D.hidden) drawStatus(); });
  D.addEventListener('keydown', onPrefixKeyCapture, true);
  D.addEventListener('keydown', onProgramKey);
  const unarm = () => { setPrefixArmed(0); setRepeatUntil(0); };
  D.addEventListener('pointerdown', unarm, true);
  addEventListener('blur', unarm);
  D.addEventListener('selectionchange', () => { const a = D.activeElement, e = a && a.tagName === 'INPUT' && a.closest('.pane'); if (e) queueDraw(e._p); });
  term.addEventListener('mousedown', e => {
    const pe = e.target instanceof Element && e.target.closest('.pane');
    if (pe && pe._p.w && pe._p !== pe._p.w.act) { selectPane(pe._p); refresh(); }
  });
  term.addEventListener('click', onTermClickForIOSTaps);
  keys.addEventListener('mousedown', keepFocusAndKeyboardUp);
}
