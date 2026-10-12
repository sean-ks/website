// File commands for the shell: help, ls, cd, pwd, cat, view, tree and open.
import { D, sp, coarse, USER, newTab } from './base.js';
import { P, setP } from './state.js';
import { HOMEN, cmp, kids, pathOf, resolve, quote, sizeOf, mtime, statLink, lsDate, human } from './fs.js';
import { novigText } from './novig.js';
import { L, Ls, bad, ent, cx, fileBox, columns, termCols } from './output.js';
import { browse } from './view.js';

const HELP = [
  ['help', '', 'show this list'],
  ['ls', ' [-la] [path]', 'list a directory (directories are blue)'],
  ['cd', ' [dir]', 'change directory; cd .. goes up, cd goes home'],
  ['pwd', '', 'print the current directory'],
  ['cat', ' file...', 'print files'],
  ['view', ' [dir]', 'browse files: the tree on the left, the text on the right'],
  ['tree', ' [dir]', 'show the directory tree'],
  ['open', ' file|url', 'open resume.pdf or a link in a new tab'],
  ['clear', '', 'clear the screen (Ctrl+L)'],
  ['fastfetch', '', 'print the system summary again'],
  ['history', '', 'list previous commands'],
  ['theme', ' [dark|light|auto]', 'switch colours'],
  ['tmux', ' [command]', 'split-window, new-window, ls, attach, kill-pane, ...'],
  ['exit', '', 'close this pane (outside tmux: log out)'],
];
const TMUX_KEYS = [['%', 'split left/right'], ['"', 'split top/bottom'], ['o', 'next pane'], ['z', 'zoom pane'], ['x', 'kill pane'],
  ['c', 'new window'], ['n', 'next window'], ['p', 'previous window'], ['d', 'detach'], ['?', 'all keys']];
const GNU_HELP_COLUMN = 17;

function long(list, h, dir) {
  if (dir) {
    const blocks = list.reduce((s, e) => s + (e.n.t === 'd' ? 4 : Math.ceil(sizeOf(e.n) / 4096) * 4), 0);
    L('total ' + (h ? human(blocks * 1024) : blocks));
  }
  const rows = list.map(({ n, name }) => {
    const own = n.sys ? 'root' : USER, size = sizeOf(n);
    return [n.t === 'd' ? 'drwxr-xr-x' : '-rw-r--r--', String(n.t === 'd' ? 2 + [...n.kids.values()].filter(k => k.t === 'd').length : 1),
      own, own, h ? human(size) : String(size), lsDate(mtime(n)), n, name];
  });
  const w = i => Math.max(...rows.map(r => r[i].length));
  const wl = w(1), wo = w(2), wg = w(3), ws = w(4);
  for (const r of rows) L(r[0] + ' ' + r[1].padStart(wl) + ' ' + r[2].padEnd(wo) + ' ' + r[3].padEnd(wg) + ' ' + r[4].padStart(ws) + ' ' + r[5] + ' ', ent(r[6], r[7])).className = 'l li ll';
}

export const FILE_COMMANDS = {
  help() {
    let w = GNU_HELP_COLUMN;
    const narrow = termCols() < w + 30;
    if (narrow) w = Math.max(...HELP.map(h => h[0].length)) + 2;
    for (let [c, a, d] of HELP) {
      if (narrow) a = '';
      if (c.length + a.length > w - 2) { L(cx(c), a + '  ' + d); continue; }
      const r = L(), s = sp('hc');
      r.className = 'l hr'; r.style.setProperty('--w', w);
      s.append(cx(c), a); r.append(s, sp('hd', d));
    }
    L();
    const also = L('also: ');
    ['whoami', 'hostname', 'uname', 'date', 'uptime', 'echo'].forEach((c, i) => { if (i) also.append(', '); also.append(cx(c)); });
    L();
    L('tmux: press Ctrl-A (or Ctrl-B), then');
    columns(TMUX_KEYS.map(([k, d]) => ({ el: D.createTextNode('  ' + k + '  ' + d), len: d.length + 5 })), termCols());
    if (coarse.matches) { L(); L('On a touch screen, tap ', cx('tmux split-window'), ' or ', cx('tmux new-window'), ', and tap a pane or a window in the status line to switch.'); }
    L();
    L(coarse.matches ? 'Tap a name in ls or tree output to open it.' : 'Click a name in ls or tree output to open it. Tab completes; Up and Down recall history.');
    return 0;
  },
  ls(args) {
    let a = 0, l = 0, h = 0, opts = true, st = 0;
    const ps = [];
    for (const s of args) {
      if (opts && s === '--') { opts = false; continue; }
      if (opts && s.startsWith('--')) {
        if (s === '--all') a = 1; else if (s === '--human-readable') h = 1;
        else if (s === '--help') { Ls(['Usage: ls [OPTION]... [FILE]...', 'List information about the FILEs (the current directory by default).', '',
          '  -a  do not ignore entries starting with .', '  -h  with -l, print sizes like 1K 234M 2G etc.', '  -l  use a long listing format']); return 0; }
        else if (!/^--colou?r(=\w+)?$/.test(s)) return bad("ls: unrecognized option '" + s + "'", 'ls', 2);
        continue;
      }
      if (opts && s[0] === '-' && s.length > 1) {
        for (const c of s.slice(1)) {
          if (c === 'a') a = 1; else if (c === 'l') l = 1; else if (c === 'h') h = 1;
          else return bad("ls: invalid option -- '" + c + "'", 'ls', 2);
        }
        continue;
      }
      ps.push(s);
    }
    const multi = ps.length > 1, files = [], dirs = [], p = P;
    if (!ps.length) ps.push('.');
    for (const s of ps) {
      const r = resolve(s);
      if (r.err) { L("ls: cannot access '" + s + "': " + r.err); st = 2; } else (r.n.t === 'd' ? dirs : files).push({ n: r.n, name: s });
    }
    files.sort((x, y) => cmp(x.name, y.name)); dirs.sort((x, y) => cmp(x.name, y.name));
    const show = (list, dir) => l ? long(list, h, dir) : columns(list.map(e => ({ el: ent(e.n, e.name), len: [...e.name].length })), termCols());
    const run = () => {
      setP(p);
      if (files.length) show(files);
      dirs.forEach((d, i) => {
        if (files.length || i) L();
        if (multi || files.length || st) L(d.name + ':');
        const list = kids(d.n, a).map(n => ({ n, name: n.name }));
        if (a) list.unshift({ n: d.n, name: '.' }, { n: d.n.parent, name: '..' });
        show(list, d.n);
      });
      return st;
    };
    const need = l ? files.map(e => e.n).concat(...dirs.map(d => [...d.n.kids.values()])).filter(n => n.t === 'l' && !n.st) : [];
    return need.length ? Promise.all(need.map(statLink)).then(run) : run();
  },
  cd(args) {
    while (/^-[LP]+$/.test(args[0])) args.shift();
    if (args.length > 1) { L('bash: cd: too many arguments'); return 1; }
    const p = args[0];
    let n = HOMEN;
    if (p === '-') {
      if (!P.oldpwd) { L('bash: cd: OLDPWD not set'); return 1; }
      n = P.oldpwd; L(pathOf(n));
    } else if (p === '') return 0;
    else if (p !== undefined) {
      const r = resolve(p);
      if (r.err) { L('bash: cd: ' + p + ': ' + r.err); return 1; }
      if (r.n.t !== 'd') { L('bash: cd: ' + p + ': Not a directory'); return 1; }
      n = r.n;
    }
    P.oldpwd = P.cwd; P.cwd = n;
    return 0;
  },
  pwd() { L(pathOf(P.cwd)); return 0; },
  cat(args) {
    let st = 0, opts = true;
    const ps = [];
    for (const p of args) {
      if (opts && p === '--') opts = false;
      else if (opts && p === '--help') { Ls(['Usage: cat [FILE]...', 'Concatenate FILE(s) to standard output.']); return 0; }
      else if (opts && /^-./.test(p)) return bad(p[1] === '-' ? "cat: unrecognized option '" + p + "'" : "cat: invalid option -- '" + p[1] + "'", 'cat');
      else ps.push(p);
    }
    for (const p of ps) {
      const r = resolve(p), n = r.n;
      if (r.err) { L('cat: ' + p + ': ' + r.err); st = 1; }
      else if (n.t === 'd') { L('cat: ' + p + ': Is a directory'); st = 1; }
      else if (n.t === 'l') { const c = 'open ' + quote(p); L('cat: ' + p + ': binary file (use: ', cx(c, c), ')'); }
      else if (n.t === 'g') { const t = novigText(); if (t == null) { L('cat: ' + p + ': snapshot unavailable'); st = 1; } else P.out.append(fileBox(t)); }
      else P.out.append(fileBox(n.text));
    }
    return st;
  },
  view(args) {
    const ps = [];
    for (const s of args) {
      if (s === '--help') { Ls(['Usage: view [DIR]', 'Browse DIR (the current directory by default): the tree on the left, the selected file on the right.', '',
        '  Up Down, j k      move', '  Right, l, Enter   open a directory, or go to the file', '  Left, h           close a directory, or go back to the tree',
        '  PgUp PgDn         scroll the file', '  q, Esc            quit']); return 0; }
      if (/^-./.test(s)) return bad(s[1] === '-' ? "view: unrecognized option '" + s + "'" : "view: invalid option -- '" + s[1] + "'", 'view');
      ps.push(s);
    }
    if (ps.length > 1) { L('view: too many arguments'); return 1; }
    const r = resolve(ps[0] || '.');
    if (r.err) { L('view: ' + ps[0] + ': ' + r.err); return 1; }
    return browse(P, r.n.t === 'd' ? r.n : r.n.parent, r.n.t === 'd' ? null : r.n);
  },
  tree(args) {
    let all = false, nd = 0, nf = 0;
    const ps = [];
    const usage = 'usage: tree [-a] [directory ...]';
    for (const s of args) {
      if (s === '--help') { Ls([usage, '  -a  All files are listed.']); return 0; }
      if (s.startsWith('--')) { Ls(['tree: Invalid argument `' + s + "'.", usage]); return 2; }
      if (s[0] === '-' && s.length > 1) {
        for (const c of s.slice(1)) if (c === 'a') all = true; else { Ls(['tree: Invalid argument -`' + c + "'.", usage]); return 2; }
      } else ps.push(s);
    }
    const walk = (d, pre) => kids(d, all).forEach((k, i, arr) => {
      const last = i === arr.length - 1;
      L(sp('tg', pre + (last ? '└── ' : '├── ')), ent(k));
      if (k.t === 'd') { nd++; walk(k, pre + (last ? '    ' : '│   ')); } else nf++;
    });
    for (const p of ps.length ? ps : ['.']) {
      const r = resolve(p);
      if (r.err) L(p + '  [error opening dir]');
      else if (r.n.t !== 'd') { L(ent(r.n, p)); nf++; }
      else { L(ent(r.n, p)); walk(r.n, ''); }
    }
    L(); L(nd + (nd === 1 ? ' directory, ' : ' directories, ') + nf + (nf === 1 ? ' file' : ' files'));
    return 0;
  },
  open(args) {
    if (!args.length) { L('open: missing file or URL'); return 1; }
    let st = 0;
    for (const p of args) {
      if (/^https?:\/\/\S+$/i.test(p)) { newTab(p); continue; }
      if (/^(mailto:)?[\w.+-]+@[\w-]+(\.[\w-]+)+$/i.test(p)) { location.href = /^mailto:/i.test(p) ? p : 'mailto:' + p; continue; }
      const r = resolve(p), n = r.n;
      if (r.err) { L('open: ' + p + ': ' + r.err); st = 1; }
      else if (n.t === 'd') { L('open: ' + p + ': Is a directory'); st = 1; }
      else if (n.t === 'l') newTab(n.href);
      else { const c = 'cat ' + quote(p); L('open: ' + p + ' is a text file (use: ', cx(c, c), ')'); }
    }
    return st;
  },
};
