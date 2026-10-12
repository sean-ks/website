// tmux commands: resolving names, aliases and prefixes, parsing flags, and running them against the server.
import { SOCK, dtf, parts } from './base.js';
import { server, client } from './state.js';
import { HOMEN } from './fs.js';
import { L } from './output.js';
import { geom, near, selectPane, selectWindow, update, mayFocus } from './screen.js';
import { message, displayPanes, winName } from './status.js';
import { BIND, PFX, TMUX_COMMANDS, VALUE_FLAGS, listKeysMode } from './bindings.js';
import { lineCtrl } from './pane.js';
import { recentSession, findSession, newSession, newWindow, splitWindow, killPane, killWindow, killSession, leave, attach } from './tmux.js';

const NEST = 'sessions should be nested with care, unset $TMUX to force';
const CT = dtf({ weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', year: 'numeric' });
const ctime = d => { const p = parts(CT, d); return p.weekday + ' ' + p.month + ' ' + p.day.padStart(2) + ' ' + p.hour + ':' + p.minute + ':' + p.second + ' ' + p.year; };

export function runTmux(a, x) {
  const all = Object.keys(TMUX_COMMANDS), ex = all.find(k => k === a[0] || TMUX_COMMANDS[k].split(' ')[0] === a[0]), pm = a[0] ? all.filter(k => k.startsWith(a[0])) : [];
  const c = a[0] && (ex || (pm.length === 1 && pm[0]));
  if (!c) return x.err(pm.length ? 'ambiguous command: ' + a[0] + ', could be: ' + pm.join(', ') : 'unknown command: ' + a[0]);
  const fl = TMUX_COMMANDS[c].split(' ')[1] || '', f = {}, args = [];
  for (let i = 1; i < a.length; i++) {
    const s = a[i];
    if (s[0] !== '-' || s.length < 2 || args.length) { args.push(s); continue; }
    for (let j = 1; j < s.length; j++) {
      const ch = s[j];
      if (!fl.includes(ch)) return x.err('command ' + c + ': unknown flag -' + ch);
      if (VALUE_FLAGS.includes(ch)) { f[ch] = s.slice(j + 1) || a[++i]; if (f[ch] == null) return x.err('command ' + c + ': -' + ch + ' expects an argument'); break; }
      f[ch] = 1;
    }
  }
  const r = run(c, f, args, x);
  update(x.f);
  return r;
}
function run(c, f, args, x) {
  const inside = !!(x.p && x.p.w), p = inside ? x.p : server && recentSession().cur.act, w = p && p.w, s = w && w.s;
  if (c === 'new-session') {
    if (inside && !f.d) return x.err(NEST);
    if (f.s && findSession(f.s)) return x.err('duplicate session: ' + f.s);
    const n = newSession(f.s, x.p ? x.p.cwd : HOMEN);
    return f.d ? 0 : attach(n);
  }
  if (c === 'attach-session') {
    if (inside) return x.err(NEST);
    const t = f.t != null ? findSession(f.t) : recentSession();
    return !server ? x.err('no sessions') : t ? attach(t) : x.err("can't find session: " + f.t);
  }
  if (c === 'list-keys') {
    if (f.N && x.key) return listKeysMode(p), 0;
    BIND.forEach(b => L(f.N ? (PFX + ' ' + b[0]).padEnd(12) + b[2] : 'bind-key ' + (b[3] ? '-r' : '  ') + ' -T prefix ' + b[0].padEnd(6) + b[1]));
    return 0;
  }
  if (!server) return x.err('no server running on ' + SOCK);
  switch (c) {
    case 'kill-server': [...server.list].forEach(t => killSession(t, 'server exited')); return 0;
    case 'kill-session': { const t = f.t != null ? findSession(f.t) : s; if (!t) return x.err("can't find session: " + f.t); killSession(t); return 0; }
    case 'list-sessions':
      server.list.forEach(t => L(t.name + ': ' + t.wins.length + ' windows (created ' + ctime(t.created) + ')' + (client && client.s === t ? ' (attached)' : '')));
      return 0;
    case 'detach-client': if (!client) return x.err('no current client'); client.s.used = Date.now(); leave('detached (from session ' + client.s.name + ')'); return 0;
    case 'new-window': newWindow(s, p.cwd); return 0;
    case 'split-window': { const e = splitWindow(w, f.h && !f.v, p.cwd, p); return e ? x.err(e) : 0; }
    case 'kill-pane': killPane(p); return 0;
    case 'kill-window': killWindow(w); return 0;
    case 'select-pane': {
      let t = f.l ? w.lastp : null;
      for (const d of 'LRUD') if (f[d]) { w.zoom = false; geom(w); t = near(w, d) || w.act; }
      if (f.t != null) {
        const v = String(f.t).replace(/^:?\.?/, ''), i = w.list.indexOf(w.act), n = w.list.length;
        t = v === '+' ? w.list[(i + 1) % n] : v === '-' ? w.list[(i + n - 1) % n] : /^%\d+$/.test(v) ? w.list.find(q => '%' + q.tid === v) : /^\d+$/.test(v) ? w.list[v] : null;
        if (!t) return x.err("can't find pane: " + f.t);
      }
      if (t) selectPane(t);
      return 0;
    }
    case 'last-pane': if (!w.lastp) return x.err('no last pane'); selectPane(w.lastp); return 0;
    case 'select-window': {
      const v = String(f.t == null ? '' : f.t).replace(/^:?=?/, ''), t = s.wins.find(q => String(q.i) === v);
      if (!t) return x.err("can't find window: " + v);
      selectWindow(t); return 0;
    }
    case 'next-window': case 'previous-window': {
      const n = s.wins.length, i = s.wins.indexOf(w);
      if (n < 2) return x.err('no ' + c.slice(0, -7) + ' window');
      selectWindow(s.wins[(i + (c[0] === 'n' ? 1 : n - 1)) % n]); return 0;
    }
    case 'last-window': if (!s.last) return x.err('no last window'); selectWindow(s.last); return 0;
    case 'resize-pane': if (f.Z && w.list.length > 1) { selectPane(p); w.zoom = !w.zoom; } return 0;
    case 'display-panes': if (client) setTimeout(displayPanes); return 0;
    case 'send-prefix': if (!p.alt && !p.mode && !p.busy) lineCtrl(p, 'a'); return 0;
    case 'confirm-before': {
      const q = (f.p || "Confirm '" + args.join(' ') + "'? (y/n)").replace(/#([WPSI])/g, (_, k) => ({ W: winName(w), P: w.list.indexOf(p), S: s.name, I: w.i })[k]);
      if (client) message(q, () => runTmux(args, Object.assign({}, x, { f: mayFocus() })));
      return 0;
    }
  }
  return 0;
}
