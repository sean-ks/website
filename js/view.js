// view: a two-column file browser on a pane's alternate screen, so the transcript keeps only the command line.
import { D, el, sp, attr, newTab } from './base.js';
import { kids, tilde } from './fs.js';
import { novigText } from './novig.js';
import { btn, fileBox } from './output.js';
import { cell } from './metrics.js';
import { focusPane, mayFocus } from './screen.js';
import { drawStatus } from './status.js';

let vseq = 0;
export function browse(p, dir, first) {
  return new Promise(res => {
    const e = el('div', 'view'), id = 'v' + ++vseq + '-', open = new Set();
    const t = attr(el('div', 'vt'), { role: 'tree', tabindex: '-1', 'aria-label': 'Files in ' + tilde(dir) + '; q quits' });
    const v = attr(el('div', 'vp'), { tabindex: '-1', role: 'document', 'aria-label': 'File' });
    const b = el('div', 'vb'), path = sp('vpath'), hint = sp('vh'), quit = btn('x', 'q quit');
    b.append(path, hint);
    e.append(t, el('div', 'vs'), v, b);
    let rows = [], sel = null, onFile = 0;
    const widest = (d, k) => kids(d).reduce((m, n) => Math.max(m, k * 4 + 4 + n.name.length, n.t === 'd' ? widest(n, k + 1) : 0), 0);
    const wmax = widest(dir, 0);
    function build() {
      rows = [];
      const walk = (d, pre) => kids(d).forEach((n, i, arr) => {
        const last = i === arr.length - 1;
        rows.push({ n, t: pre + (last ? '└── ' : '├── '), l: pre.length / 4 + 1 });
        if (n.t === 'd' && open.has(n)) walk(n, pre + (last ? '    ' : '│   '));
      });
      walk(dir, '');
      t.replaceChildren(attr(el('div', 'vr di', tilde(dir)), { 'aria-hidden': 'true' }));
      rows.forEach((r, i) => {
        const d = r.el = attr(el('div', 'vr'), { id: id + i, role: 'treeitem', 'aria-level': r.l, 'aria-selected': 'false' });
        if (r.n.t === 'd') d.setAttribute('aria-expanded', open.has(r.n));
        d.append(attr(sp('vg', r.t), { 'aria-hidden': 'true' }), sp(r.n.t === 'd' ? 'di' : '', r.n.name));
        d._n = r.n;
        t.append(d);
      });
    }
    function select(n) {
      if (!n) return;
      sel = n;
      let r = null;
      for (const x of rows) { const on = x.n === n; x.el.classList.toggle('on', on); x.el.setAttribute('aria-selected', on); if (on) r = x.el; }
      if (r) {
        t.setAttribute('aria-activedescendant', r.id);
        const top = r === rows[0].el ? 0 : r.offsetTop, h = t.clientHeight;
        if (top < t.scrollTop) t.scrollTop = top; else if (r.offsetTop + cell.h > t.scrollTop + h) t.scrollTop = r.offsetTop + cell.h - h;
      }
      path.textContent = tilde(n);
      v.textContent = ''; v.scrollTop = 0;
      if (n.t === 'f') v.append(fileBox(n.text));
      else if (n.t === 'g') { const s = novigText(); v.append(s ? fileBox(s) : el('div', 'l', n.name + ': snapshot unavailable')); }
      else if (n.t === 'l') {
        if (n.img) v.append(attr(el('img', 'vimg'), { src: n.href, alt: n.img }));
        const a = el('a', '', 'open ' + n.name), d = el('div', 'l', n.name + ': ' + (n.img ? 'image' : 'binary file') + ' (use: ');
        a.href = n.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        d.append(a, ')'); v.append(d);
      }
      else for (const k of kids(n)) { const d = el('div', 'l'), s = btn(k.t === 'd' ? 'f di' : 'f', k.name); s._k = k; d.append(s); v.append(d); }
    }
    const toggle = n => { if (open.has(n)) open.delete(n); else open.add(n); build(); select(n); };
    const side = f => { onFile = f; e.classList.toggle('pf', !!f); fit(); focusPane(p); };
    const fit = () => {
      const W = p.sx, wide = W >= 60;
      e.classList.toggle('stack', !wide);
      e.style.setProperty('--tw', Math.min(Math.floor(W * 0.4), Math.max(20, wmax + 2)));
      e.style.setProperty('--th', Math.max(4, Math.min(14, Math.floor((p.sy - 2) * 0.4))));
      hint.replaceChildren(quit, wide ? onFile ? '  ↑↓ scroll  h back' : '  ↑↓ move  h/l fold/open  enter open' : '');
    };
    const close = () => {
      const had = e.contains(D.activeElement);
      e.remove(); p.alt = null; p.prog = '';
      p.el.classList.toggle('alt', !!p.mode);
      drawStatus();
      res(0);
      if (had) focusPane(p);
    };
    function key(ev) {
      const k = ev.key, i = rows.findIndex(x => x.n === sel), n = sel, pg = Math.max(cell.h, v.clientHeight - cell.h);
      if (k === 'q' || k === 'Escape') close();
      else if (!n) return k.length === 1;
      else if (k === 'ArrowDown' || k === 'j') { if (onFile) v.scrollTop += cell.h; else if (i < rows.length - 1) select(rows[i + 1].n); }
      else if (k === 'ArrowUp' || k === 'k') { if (onFile) v.scrollTop -= cell.h; else if (i > 0) select(rows[i - 1].n); }
      else if (k === 'ArrowRight' || k === 'l' || k === 'Enter') {
        if (n.t === 'd') { if (!open.has(n) || k === 'Enter') toggle(n); else if (rows[i + 1] && rows[i + 1].n.parent === n) select(rows[i + 1].n); }
        else if (n.t === 'l' && k === 'Enter') newTab(n.href);
        else if (onFile) v.scrollTop += pg; else side(1);
      }
      else if (k === 'ArrowLeft' || k === 'h') {
        if (onFile) side(0);
        else if (n.t === 'd' && open.has(n)) toggle(n);
        else if (n.parent !== dir) select(n.parent);
      }
      else if (k === 'g' || k === 'Home') { if (onFile) v.scrollTop = 0; else select(rows[0].n); }
      else if (k === 'G' || k === 'End') { if (onFile) v.scrollTop = v.scrollHeight; else select(rows[rows.length - 1].n); }
      else if (k === 'PageDown' || k === ' ') v.scrollTop += pg;
      else if (k === 'PageUp') v.scrollTop -= pg;
      else if (k === 'Tab') {
        const a = [...v.querySelectorAll('a')], j = a.indexOf(D.activeElement);
        if (!onFile) side(1); else if (ev.shiftKey ? j > 0 : j < a.length - 1) return false; else side(0);
      }
      else return k.length === 1;
      return true;
    }
    e.addEventListener('click', ev => {
      const x = ev.target.closest('.vr, .f, .x');
      if (!x) return;
      if (x === quit) { const f = mayFocus(); close(); if (f) focusPane(p); return; }
      if (x._k) { open.add(sel); build(); select(x._k); return; }
      if (!x._n) return;
      if (x._n.t === 'd') toggle(x._n); else select(x._n);
      side(0);
    });
    p.alt = { f: () => onFile ? v : t, key, fit, close };
    p.prog = 'view';
    p.el.append(e); p.el.classList.add('alt');
    p.el.scrollTop = 0;
    build(); fit();
    select(first || (rows.find(r => r.n.t !== 'd') || rows[0] || {}).n);
    drawStatus();
    if (mayFocus()) focusPane(p);
  });
}
