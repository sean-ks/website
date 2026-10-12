// bash: the environment, quoting and $VAR expansion, ; && || lists, and running a line in a pane.
import { HOME, USER, HOST, SOCK } from './base.js';
import { P, setP, server } from './state.js';
import { pathOf, resolve } from './fs.js';
import { L, echo, bottom, renderPrompt } from './output.js';

export const CMDS = {};

function env() {
  const e = { HOME, USER, LOGNAME: USER, HOSTNAME: HOST, PWD: pathOf(P.cwd), OLDPWD: P.oldpwd ? pathOf(P.oldpwd) : '', SHELL: '/bin/bash',
    TERM: P.w ? 'tmux-256color' : 'xterm-256color', LANG: 'en_US.UTF-8', PATH: '/usr/local/sbin:/usr/local/bin:/usr/bin', PS1: '[\\u@\\h \\W]\\$ ', '?': String(P.status) };
  if (P.w) { e.TMUX = SOCK + ',' + server.pid + ',' + P.w.s.id; e.TMUX_PANE = '%' + P.tid; }
  return e;
}
export function parse(s) {
  const words = [], E = env();
  let w = '', has = false, q = '', i = 0;
  const vr = () => {
    const m = /^\$(\?|[A-Za-z_]\w*|\{(\?|[A-Za-z_]\w*)\})/.exec(s.slice(i));
    if (!m) return false;
    const v = E[m[2] || m[1]] || '';
    w += v; i += m[0].length;
    if (v) has = true;
    return true;
  };
  while (i < s.length) {
    const c = s[i];
    if (q === "'") { if (c === "'") q = ''; else w += c; i++; }
    else if (q === '"') {
      if (c === '"') { q = ''; i++; }
      else if (c === '\\' && '"\\$`'.includes(s[i + 1] || 'x')) { w += s[i + 1]; i += 2; }
      else if (!(c === '$' && vr())) { w += c; i++; }
    }
    else if (c === ' ' || c === '\t') { if (has) words.push(w); w = ''; has = false; i++; }
    else if (c === "'" || c === '"') { q = c; has = true; i++; }
    else if (c === '\\') { w += s[i + 1] || ''; has = true; i += 2; }
    else if (!(c === '$' && vr())) { w += c === '~' && !has && /^(\/|\s|)$/.test(s[i + 1] || '') ? HOME : c; has = true; i++; }
  }
  if (q) return { err: 'bash: unexpected EOF while looking for matching `' + q + "'" };
  if (has) words.push(w);
  return { words };
}
function splitList(s) {
  const list = [];
  let q = '', start = 0, op = '';
  const cut = (i, n, next) => {
    const src = s.slice(start, i);
    if (!src.trim()) return 'bash: syntax error near unexpected token `' + next + "'";
    list.push({ src, op }); op = next; start = i + n;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = ''; else if (c === '\\' && q === '"') i++; continue; }
    if (c === '\\') { i++; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    const two = s.substr(i, 2), e = two === '&&' || two === '||' ? cut(i, 2, two) : c === ';' ? cut(i, 1, ';') : 0;
    if (e) return { err: e };
    if (two === '&&' || two === '||') i++;
  }
  const tail = s.slice(start);
  if (tail.trim()) list.push({ src: tail, op });
  else if (op && op !== ';') return { err: 'bash: syntax error: unexpected end of file' };
  return { list };
}
function runSimple(src) {
  const p = parse(src);
  if (p.err) { L(p.err); return 2; }
  const a = p.words;
  if (!a.length) return P.status;
  const c = a.shift();
  if (Object.prototype.hasOwnProperty.call(CMDS, c)) return CMDS[c](a);
  if (c.includes('/')) { const r = resolve(c); L('bash: ' + c + ': ' + (r.err || (r.n.t === 'd' ? 'Is a directory' : 'Permission denied'))); return r.err ? 127 : 126; }
  L('bash: ' + c + ': command not found');
  return 127;
}
function exec(p, line) {
  const seq = splitList(line);
  if (seq.err) { L(seq.err); return 2; }
  const next = i => {
    for (; i < seq.list.length && !p.dead; i++) {
      const { src, op } = seq.list[i];
      if ((op === '&&' && p.status) || (op === '||' && !p.status)) continue;
      setP(p);
      const r = runSimple(src);
      if (r && typeof r.then === 'function') return r.then(v => { p.status = v; return next(i + 1); });
      p.status = r;
    }
    return p.status;
  };
  return next(0);
}
export function submit(p, line, quiet) {
  setP(p);
  echo(line);
  if (line.trim() && !quiet) p.hist.push(line);
  p.hpos = p.hist.length; p.draft = '';
  let r;
  try { r = exec(p, line); } catch (e) { r = 1; setTimeout(() => { throw e; }); }
  if (r && typeof r.then === 'function') {
    p.busy = true; p.cmd.classList.add('busy');
    return r.then(v => done(p, v), () => done(p, 1));
  }
  done(p, r);
}
export function done(p, r) {
  p.status = typeof r === 'number' ? r : 0;
  p.busy = false; p.cmd.classList.remove('busy');
  if (!p.dead) { renderPrompt(p); bottom(p); }
}
