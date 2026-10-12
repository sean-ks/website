// tmux's server, sessions, windows and pane trees (leaves {p, k}, splits {d, c, k}), attaching, detaching and logging in.
import { el, scr } from './base.js';
import { P, setP, server, setServer, client, setClient, plain, setPrefixArmed, setConfirmYes, liveFetch } from './state.js';
import { HOMEN } from './fs.js';
import { L, welcome, renderPrompt } from './output.js';
import { mkPane, draw } from './pane.js';
import { geom, selectPane, markUsed, refresh, focusPane, mayFocus } from './screen.js';
import { hidePanes } from './status.js';
import { fastfetch, killLive } from './fastfetch.js';

const MINW = 24, MINH = 5;
export const recentSession = () => server && server.list.reduce((a, s) => s.used > a.used ? s : a);
export const findSession = t => server && server.list.find(s => s.name === String(t).replace(/^=|:$/g, ''));

export function newSession(nm, cwd) {
  if (!server) setServer({ list: [], id: 0, pn: 0, pid: 2219 });
  const s = { id: server.id++, wins: [], created: new Date(), used: Date.now() };
  s.name = nm || String(s.id);
  server.list.push(s);
  newWindow(s, cwd);
  return s;
}
export function newWindow(s, cwd) {
  let i = 0;
  while (s.wins.some(w => w.i === i)) i++;
  const w = { i, s, list: [], zoom: false, el: el('div', 'win'), bd: el('div', 'bd') };
  w.el.hidden = true; w.el.append(w.bd); scr.append(w.el);
  const p = addPane(w, cwd, 0);
  w.root = p.n = { p, k: 1 }; w.act = p;
  s.wins.push(w); s.wins.sort((a, b) => a.i - b.i);
  if (s.cur) s.last = s.cur;
  s.cur = w;
  return w;
}
function addPane(w, cwd, at) {
  const p = mkPane(cwd);
  p.w = w; p.tid = server.pn++; markUsed(p);
  w.list.splice(at, 0, p);
  w.el.insertBefore(p.el, w.bd);
  renderPrompt(p); draw(p);
  return p;
}
export function splitWindow(w, h, cwd, a = w.act) {
  w.zoom = false; geom(w);
  const n = a.n, up = n.up, d = h ? 'h' : 'v', z = h ? a.sx : a.sy;
  if (h ? z < 2 * MINW + 1 : z < 2 * MINH + 1) return 'no space for new pane';
  const p = addPane(w, cwd, w.list.indexOf(a) + 1), m = p.n = { p, k: (z - 1) >> 1 };
  if (up && up.d === d) { m.up = up; up.c.splice(up.c.indexOf(n) + 1, 0, m); }
  else {
    const c = { d, c: [n, m], k: n.k, up };
    if (up) up.c[up.c.indexOf(n)] = c; else w.root = c;
    n.up = m.up = c;
  }
  n.k = z - 1 - m.k;
  selectPane(p);
}
function gone(p) { if (liveFetch && liveFetch.p === p) killLive(); p.dead = true; p.el.remove(); }
export function killPane(p) {
  const w = p.w, n = p.n, up = n.up, i = w.list.indexOf(p);
  gone(p);
  w.list.splice(i, 1);
  if (!w.list.length) return killWindow(w);
  const j = up.c.indexOf(n);
  up.c[j ? j - 1 : 1].k += n.k + 1; up.c.splice(j, 1);
  if (up.c.length === 1) {
    const o = up.c[0];
    o.k = up.k; o.up = up.up;
    if (up.up) up.up.c[up.up.c.indexOf(up)] = o; else w.root = o;
  }
  w.zoom = false;
  if (w.lastp === p) w.lastp = null;
  if (w.act === p) { w.act = w.lastp || w.list[i ? i - 1 : 0]; w.lastp = null; }
}
export function killWindow(w) {
  const s = w.s, i = s.wins.indexOf(w);
  w.list.forEach(gone); w.el.remove();
  s.wins.splice(i, 1);
  if (!s.wins.length) return killSession(s);
  if (s.last === w) s.last = null;
  if (s.cur === w) { s.cur = s.last || s.wins[i ? i - 1 : 0]; s.last = null; }
}
export function killSession(s, why) {
  s.wins.forEach(w => { w.list.forEach(gone); w.el.remove(); });
  server.list.splice(server.list.indexOf(s), 1);
  if (!server.list.length) setServer(null);
  if (client && client.s === s) leave(why || 'exited');
}
export function leave(msg) {
  const c = client;
  setClient(null); setPrefixArmed(0); setConfirmYes(null); hidePanes();
  setP(plain); L('[' + msg + ']');
  c.res(0);
}
export function attach(s) {
  return new Promise(res => { setClient({ s, res, msg: '' }); s.used = Date.now(); });
}
export function login() {
  setClient(null);
  if (server) [...server.list].forEach(s => killSession(s));
  setP(plain); P.out.textContent = ''; P.cwd = HOMEN; P.oldpwd = null; P.status = 0;
  const s = newSession(), r = attach(s);
  refresh();
  setP(s.cur.act); fastfetch(); welcome();
  const e = P.el, i = P.out.querySelector('.ff-info');
  e.scrollTop = e.scrollHeight - e.clientHeight > i.children[3].offsetTop ? i.offsetTop : e.scrollHeight;
  if (mayFocus()) focusPane(P);
  return r;
}
