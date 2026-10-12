// Lays out the current tmux window (or the plain shell) on the cell grid, tracks the active pane and moves focus.
import { D, el, coarse, bar, scr } from './base.js';
import { client, plain, plainWin } from './state.js';
import { cell, grid, GW, GH } from './metrics.js';
import { sizeLogos, fetchBlocks } from './logo.js';
import { drawStatus, hidePanes } from './status.js';
import { renderPrompt } from './output.js';

let useq = 0, shown = [];
export const markUsed = p => { p.used = ++useq; };
export function selectPane(p) {
  const w = p.w;
  if (w.act !== p) { w.lastp = w.act; w.act = p; w.zoom = false; }
  markUsed(p);
}
export function selectWindow(w) { const s = w.s; if (s.cur !== w) { s.last = s.cur; s.cur = w; } }

export function geom(w) {
  const go = (n, x, y, sx, sy) => {
    Object.assign(n, { x, y, sx, sy });
    if (n.p) return Object.assign(n.p, { x, y, sx, sy });
    const h = n.d === 'h', all = (h ? sx : sy) - n.c.length + 1, K = n.c.reduce((a, c) => a + c.k, 0);
    let pos = h ? x : y, end = 0, acc = 0;
    n.c.forEach((c, i) => {
      acc += c.k;
      const e = i === n.c.length - 1 ? all : K === all ? acc : Math.round(all * acc / K), z = Math.max(1, e - end);
      end += z; c.k = z;
      if (h) go(c, pos, y, z, sy); else go(c, x, pos, sx, z);
      pos += z + 1;
    });
  };
  go(w.root, 0, 0, GW, GH);
  if (w.zoom) Object.assign(w.act, { x: 0, y: 0, sx: GW, sy: GH });
}
function borders(w) {
  const B = w.bd, A = w.act, two = w.list.length === 2;
  B.textContent = '';
  if (w.zoom) return;
  const vx = c => Math.floor((c + 0.5) * cell.w), hy = r => Math.floor((r + 0.5) * cell.h);
  const nearActive = (v, c, r) => two ? (v ? (A.x ? r > GH >> 1 : r <= GH >> 1) : (A.y ? c > GW >> 1 : c <= GW >> 1))
    : v ? (c === A.x - 1 || c === A.x + A.sx) && r >= A.y - 1 && r <= A.y + A.sy
      : (r === A.y - 1 || r === A.y + A.sy) && c >= A.x - 1 && c <= A.x + A.sx;
  const seg = (v, k, a, b) => {
    const at = i => nearActive(v, v ? k : i, v ? i : k), u = v ? cell.h : cell.w, mid = v ? hy : vx;
    for (let s = a, i = a; i <= b; i++) {
      const o = at(i);
      if (i < b && at(i + 1) === o) continue;
      const lo = s === a && a > 0 ? mid(s - 1) : Math.round(s * u), hi = i === b && b < (v ? GH : GW) - 1 ? mid(i + 1) + 1 : Math.round((i + 1) * u);
      const d = el('i', o ? 'on' : '');
      d.style.cssText = v ? `left:${vx(k)}px;top:${lo}px;width:1px;height:${hi - lo}px` : `top:${hy(k)}px;left:${lo}px;height:1px;width:${hi - lo}px`;
      B.append(d);
      s = i + 1;
    }
  };
  const walk = n => n.c && n.c.forEach((c, i) => {
    if (i) { if (n.d === 'h') seg(1, c.x - 1, n.y, n.y + n.sy - 1); else seg(0, c.y - 1, n.x, n.x + n.sx - 1); }
    walk(c);
  });
  walk(w.root);
}
export function near(w, d) {
  const A = w.act, H = d === 'L' || d === 'R';
  return w.list.filter(p => p !== A && (H ? p.y < A.y + A.sy && A.y < p.y + p.sy : p.x < A.x + A.sx && A.x < p.x + p.sx) && (
    d === 'L' ? (A.x ? p.x + p.sx + 1 === A.x : p.x + p.sx === GW) :
    d === 'R' ? (A.x + A.sx < GW ? p.x === A.x + A.sx + 1 : p.x === 0) :
    d === 'U' ? (A.y ? p.y + p.sy + 1 === A.y : p.y + p.sy === GH) :
    (A.y + A.sy < GH ? p.y === A.y + A.sy + 1 : p.y === 0))).sort((a, b) => b.used - a.used)[0];
}

function size(p) {
  const s = p.el.style;
  s.left = p.x * cell.w + 'px'; s.top = p.y * cell.h + 'px';
  s.width = p.sx * cell.w + 0.5 + 'px'; s.height = p.sy * cell.h + 'px';
}
export function refresh() {
  for (const p of shown) if (!p.dead && p.el.clientHeight && !p.alt && !p.mode) { p.st = p.el.scrollTop; p.stick = p.st + p.el.clientHeight >= p.el.scrollHeight - 4; }
  const w = client && client.s.cur;
  bar.hidden = !client;
  hidePanes();
  grid();
  for (const e of scr.children) { e.hidden = e !== (w ? w.el : plainWin); e.style.height = GH * cell.h + 'px'; }
  let ps = [plain];
  if (w) {
    geom(w);
    ps = w.list.filter(p => { const h = w.zoom && p !== w.act; p.el.hidden = h; p.el.classList.toggle('act', p === w.act); return !h; });
    borders(w);
  } else Object.assign(plain, { x: 0, y: 0, sx: GW, sy: GH });
  for (const p of ps) {
    size(p);
    const f = fetchBlocks(p);
    if (f.length) sizeLogos(f);
    if (p.alt) p.alt.fit();
    if (p.mode) p.mode.fit();
    p.el.scrollTop = p.alt || p.mode ? 0 : p.stick ? p.el.scrollHeight : p.st;
    renderPrompt(p);
  }
  shown = ps;
  drawStatus();
}

export const activePane = () => client ? client.s.cur.act : plain;
export function focusPane(p) {
  const t = p.mode ? p.mode.el : p.alt ? p.alt.f() : p.inp;
  if (D.activeElement !== t) try { t.focus({ preventScroll: true }); } catch (e) {}
}
export const mayFocus = () => !coarse.matches || D.activeElement instanceof HTMLInputElement;
export const update = f => { refresh(); if (f) focusPane(activePane()); };
