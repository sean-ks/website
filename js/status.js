// tmux's status line, its messages and y/n prompts, and the display-panes overlay.
import { el, sp, attr, bar, note, scr, HOST, dtf, parts } from './base.js';
import { client, confirmYes, setConfirmYes } from './state.js';
import { cell, GW } from './metrics.js';

export const winName = w => w.act.prog || 'bash';
const CLK = dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: '2-digit', month: 'short', year: '2-digit' });
export function drawStatus() {
  if (!client) return;
  const s = client.s, m = client.msg, box = el('div', 'sb');
  box.style.width = GW * cell.w + 'px';
  bar.className = m ? 'status msg' : 'status';
  if (m) { box.append(m); if (confirmYes) box.append(sp('cur', ' ')); }
  else {
    const c = parts(CLK, new Date()), right = '"' + HOST + '" ' + c.hour + ':' + c.minute + ' ' + c.day + '-' + c.month + '-' + c.year;
    const left = sp('', '[' + s.name + '] '), it = s.wins.map(w => {
      const f = (w === s.cur ? '*' : w === s.last ? '-' : '') + (w.zoom ? 'Z' : '');
      return { w, t: w.i + ':' + winName(w) + (f || ' ') };
    });
    let a = 0, b = it.length;
    const ci = it.findIndex(i => i.w === s.cur), room = GW - left.textContent.length - right.length - 1;
    const len = () => it.slice(a, b).reduce((n, i) => n + i.t.length + 1, -1) + (a ? 1 : 0) + (b < it.length ? 1 : 0);
    while (len() > room && b - a > 1) { if (ci - a > b - 1 - ci) a++; else b--; }
    if (a) left.append('<');
    it.slice(a, b).forEach((i, k) => { if (k) left.append(' '); const e = sp('w', i.t); e.dataset.w = i.w.i; left.append(e); });
    if (b < it.length) left.append('>');
    box.append(left, sp('', right));
  }
  bar.replaceChildren(box);
}
const DISPLAY_TIME = 750;
let mt = 0;
export function message(m, yes) {
  if (!client) return;
  client.msg = m; setConfirmYes(yes || null);
  note.textContent = m;
  drawStatus();
  clearTimeout(mt);
  if (!yes) mt = setTimeout(() => { if (client && client.msg === m && !confirmYes) { client.msg = ''; drawStatus(); } }, DISPLAY_TIME);
}
export const tick = () => { drawStatus(); setTimeout(tick, 60050 - Date.now() % 60000); };

const BIG = 'vhhhv 11111 v1vgv v1v1v hhv11 vgv1v vgvhv v1111 vhvhv vhv1v'.split(' ');
let dpt = 0;
export let panesShown = false;
export function displayPanes() {
  if (!client) return;
  const w = client.s.cur;
  hidePanes();
  w.list.forEach((p, i) => {
    if (p.el.hidden) return;
    const t = String(i), wd = t.length * 6 - 1, big = p.sx >= wd && p.sy >= 5, o = attr(el('div', 'dp' + (p === w.act ? ' on' : '')), { 'aria-hidden': 'true' });
    if (big) for (let j = 0; j < 5; j++) {
      const r = el('div');
      for (const ch of t) { if (r.firstChild) r.append(' '); for (let k = 0; k < 5; k++) r.append(parseInt(BIG[ch][j], 32) >> (4 - k) & 1 ? el('b', '', ' ') : ' '); }
      o.append(r);
    } else o.append(t);
    o.style.left = (p.x + ((p.sx - (big ? wd : t.length)) >> 1)) * cell.w + 'px';
    o.style.top = (p.y + ((p.sy - (big ? 5 : 1)) >> 1)) * cell.h + 'px';
    w.el.append(o);
    const z = p.sx + 'x' + p.sy;
    if (big && p.sy > 6 && p.sx >= z.length) {
      const r = attr(el('div', o.className, z), { 'aria-hidden': 'true' });
      r.style.cssText = 'left:' + (p.x + p.sx - z.length) * cell.w + 'px;top:' + p.y * cell.h + 'px';
      w.el.append(r);
    }
  });
  panesShown = true; dpt = setTimeout(hidePanes, 1000);
}
export function hidePanes() { clearTimeout(dpt); panesShown = false; for (const e of scr.querySelectorAll('.dp')) e.remove(); }
