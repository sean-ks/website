// System and session commands for the shell: clear, fastfetch, uname, date, uptime, echo, history, theme, tmux and exit.
import { USER, HOST, KERNEL, dtf, parts } from './base.js';
import { P } from './state.js';
import { themeGet, themeEff, setTheme } from './metrics.js';
import { L, Ls, bad } from './output.js';
import { update, mayFocus } from './screen.js';
import { fastfetch, clear, upMins, upStr } from './fastfetch.js';
import { killPane, login } from './tmux.js';
import { runTmux } from './tmux-commands.js';

export const SYSTEM_COMMANDS = {
  clear() { clear(); return 0; },
  fastfetch() { fastfetch(); return 0; },
  whoami() { L(USER); return 0; },
  hostname() { L(HOST); return 0; },
  uname(args) {
    const v = { s: 'Linux', n: HOST, r: KERNEL, v: '#1 SMP PREEMPT_DYNAMIC', m: 'x86_64', o: 'GNU/Linux' };
    let f = '';
    for (const a of args) {
      if (a === '--help') { Ls(['Usage: uname [OPTION]...', 'Print certain system information.  With no OPTION, same as -s.', '', '  -a  print all information',
        '  -s  print the kernel name', '  -n  print the network node hostname', '  -r  print the kernel release', '  -m  print the machine hardware name']); return 0; }
      if (a.startsWith('--')) return bad("uname: unrecognized option '" + a + "'", 'uname');
      if (!/^-\w+$/.test(a)) return bad("uname: extra operand '" + a + "'", 'uname');
      for (const c of a.slice(1)) { if (c === 'a') f += 'snrvmo'; else if ('snrvmo'.includes(c)) f += c; else return bad("uname: invalid option -- '" + c + "'", 'uname'); }
    }
    L([...'snrvmo'].filter(c => (f || 's').includes(c)).map(c => v[c]).join(' '));
    return 0;
  },
  date() {
    const p = parts(dtf({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' }), new Date());
    L(p.weekday + ' ' + p.month + ' ' + p.day.padStart(2) + ' ' + p.hour + ':' + p.minute + ':' + p.second + ' ' + p.dayPeriod + ' ' + p.timeZoneName + ' ' + p.year);
    return 0;
  },
  uptime(args) {
    const m = upMins(), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24, n = m % 60;
    if (args[0] === '-p' || args[0] === '--pretty') { L('up ' + upStr(m, 'minute')); return 0; }
    const t = parts(dtf({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), new Date());
    L(' ' + t.hour + ':' + t.minute + ':' + t.second + ' up ' + (d ? d + (d > 1 ? ' days, ' : ' day, ') : '') +
      (h ? String(h).padStart(2) + ':' + String(n).padStart(2, '0') : n + ' min') + ',  1 user,  load average: 0.00, 0.00, 0.00');
    return 0;
  },
  echo(args) {
    while (/^-[neE]+$/.test(args[0])) args.shift();
    L(args.join(' '));
    return 0;
  },
  history(args) {
    const hist = P.hist;
    if (args[0] === '-c') { hist.length = 0; P.hpos = 0; return 0; }
    const n = args[0] === undefined ? hist.length : Number(args[0]);
    if (!(n >= 0) || n % 1) { L('bash: history: ' + args[0] + ': numeric argument required'); return 1; }
    hist.forEach((c, i) => { if (i >= hist.length - n) L(String(i + 1).padStart(5) + '  ' + c); });
    return 0;
  },
  theme(args) {
    const t = args[0];
    if (t === undefined) { L(themeEff() + (themeGet() === 'auto' ? ' (auto)' : '')); L('usage: theme [dark|light|auto]'); return 0; }
    if (args.length > 1 || !/^(dark|light|auto)$/.test(t)) { L(args.length > 1 ? 'theme: too many arguments' : "theme: invalid argument '" + t + "'"); L('usage: theme [dark|light|auto]'); return 2; }
    setTheme(t);
    return 0;
  },
  tmux(args) {
    if (args[0] === '-V') { L('tmux 3.5a'); return 0; }
    return runTmux(args.length ? args : ['new-session'], { p: P, f: mayFocus(), err: m => (L(m), 1) });
  },
  exit() {
    if (P.w) { const f = mayFocus(); killPane(P); update(f); return 0; }
    L('logout');
    return login();
  },
  sudo(args) { L(args.length ? USER + ' is not in the sudoers file.' : 'usage: sudo -h | -K | -k | -V'); return 1; },
  pacman(args) { L(args.length ? 'error: you cannot perform this operation unless you are root.' : 'error: no operation specified (use -h for help)'); return 1; },
};
SYSTEM_COMMANDS.neofetch = SYSTEM_COMMANDS.fastfetch;
SYSTEM_COMMANDS.logout = SYSTEM_COMMANDS.exit;
