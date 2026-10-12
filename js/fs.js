// The file tree built from window.SITE, path resolution from the running shell's directory, and each file's ls -l size and date.
import { D, SITE, HOME, dtf, parts } from './base.js';
import { P } from './state.js';
import { stats, novigText } from './novig.js';

const mk = (name, v, parent) => {
  const n = { name, parent };
  if (typeof v === 'string') { n.t = 'f'; n.text = v; }
  else if (v.link) { n.t = 'l'; n.href = v.link; }
  else if (v.generated) n.t = 'g';
  else { n.t = 'd'; n.kids = new Map(); for (const k of Object.keys(v)) n.kids.set(k, mk(k, v[k], n)); }
  return n;
};
const ROOT = { name: '/', t: 'd', kids: new Map(), sys: 1 };
ROOT.parent = ROOT;
export let HOMEN = ROOT;
export function mountHome() {
  HOME.split('/').filter(Boolean).forEach((s, i, a) => {
    const n = i === a.length - 1 ? mk(s, SITE.fs, HOMEN) : { name: s, parent: HOMEN, t: 'd', kids: new Map(), sys: 1 };
    HOMEN.kids.set(s, n); HOMEN = n;
  });
}

const coll = new Intl.Collator('en', { ignorePunctuation: true, sensitivity: 'base' });
export const cmp = (a, b) => coll.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
export const kids = (d, all) => [...d.kids.values()].filter(n => all || n.name[0] !== '.').sort((a, b) => cmp(a.name, b.name));
export const pathOf = n => n === ROOT ? '/' : (n.parent === ROOT ? '' : pathOf(n.parent)) + '/' + n.name;
export const tilde = n => { const p = pathOf(n); return p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p; };
export const wname = p => p.cwd === HOMEN ? '~' : p.cwd.name;

export function resolve(p, base) {
  if (p === '') return { err: 'No such file or directory' };
  let n = p[0] === '/' ? ROOT : base || P.cwd;
  for (const s of p.split('/')) {
    if (n.t !== 'd') return { err: 'Not a directory' };
    if (s === '' || s === '.') continue;
    if (s === '..') { n = n.parent; continue; }
    const c = n.kids.get(s);
    if (!c) return { err: 'No such file or directory' };
    n = c;
  }
  return { n };
}
export function relativeName(n, c) {
  if (n === c) return '.';
  if (n === c.parent && c !== ROOT) return '..';
  const p = pathOf(n), b = c === ROOT ? '/' : pathOf(c) + '/';
  return p.startsWith(b) ? p.slice(b.length) : tilde(n);
}
export const quote = s => /^[\w.\/~+-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";

const enc = new TextEncoder();
const DOC_TIME = (() => { const d = new Date(D.lastModified); return isNaN(d) ? new Date() : d; })();
const textOf = n => n.t === 'f' ? n.text : n.t === 'g' ? novigText() || '' : '';
export const sizeOf = n => n.t === 'd' ? 4096 : n.t === 'l' ? (n.st && n.st.size) || 0 : enc.encode(textOf(n)).length;
export const mtime = n => n.t === 'g' && stats() ? new Date(stats().updated) : n.t === 'l' && n.st && n.st.mt ? n.st.mt : DOC_TIME;
export function statLink(n) {
  const o = { method: 'HEAD', cache: 'no-cache' };
  try { if (AbortSignal.timeout) o.signal = AbortSignal.timeout(4000); } catch (e) {}
  return fetch(n.href, o).then(r => {
    const lm = r.headers.get('last-modified');
    n.st = r.ok ? { size: +r.headers.get('content-length') || 0, mt: lm && !isNaN(Date.parse(lm)) ? new Date(lm) : null } : { size: 0 };
  }, () => { n.st = { size: 0 }; });
}
const LS_DATE = dtf({ month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function lsDate(d) {
  const p = parts(LS_DATE, d), age = Date.now() - d;
  return p.month + ' ' + p.day.padStart(2) + ' ' + (age < 15778476000 && age > -3600000 ? p.hour + ':' + p.minute : ' ' + p.year);
}
export function human(b) {
  if (b < 1024) return String(b);
  let v = b, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < 3);
  return (v < 10 ? (Math.ceil(v * 10) / 10).toFixed(1) : String(Math.ceil(v))) + 'KMGT'[i];
}
