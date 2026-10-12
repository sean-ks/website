/* Sean Shiroma: an Arch Linux terminal running tmux.
   Files come from content.js (window.SITE), the fastfetch logo from renderer.js (window.GlyphRenderer) and the
   trading numbers from assets/novig-stats.js (window.NOVIG_STATS).
   A tmux client fills the window. Every pane is its own bash, with its own log, prompt, directory and history; the
   files, the theme and the one live logo renderer are shared. Outside tmux (after a detach or an exit) a plain
   shell fills the window. */
(() => {
'use strict';
const D = document, root = D.documentElement, S = window.SITE;
if (!S || !S.fs) { root.classList.remove('js'); return; }
// any startup error leaves the no-JS page (catch at the end), not an empty terminal
try {

const $ = id => D.getElementById(id);
const el = (tag, cls, txt) => { const e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const sp = (cls, txt) => el('span', cls, txt);
const attr = (e, o) => { for (const k in o) e.setAttribute(k, o[k]); return e; };
const mq = q => matchMedia(q);
const coarse = mq('(pointer: coarse)'), rmq = mq('(prefers-reduced-motion: reduce)'), lightq = mq('(prefers-color-scheme: light)');
const term = $('term'), scr = $('scr'), bar = $('status'), keys = $('keys'), note = $('note');
const USER = S.user, HOST = S.host, HOME = S.home, TZ = 'America/New_York', KERNEL = '7.2.1-arch1-1';
const RAMP = ' .:-=+*#%@';

/* filesystem */
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
let HOMEN = ROOT;
HOME.split('/').filter(Boolean).forEach((s, i, a) => {
  const n = i === a.length - 1 ? mk(s, S.fs, HOMEN) : { name: s, parent: HOMEN, t: 'd', kids: new Map(), sys: 1 };
  HOMEN.kids.set(s, n); HOMEN = n;
});

const coll = new Intl.Collator('en', { ignorePunctuation: true, sensitivity: 'base' });
const cmp = (a, b) => coll.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
const kids = (d, all) => [...d.kids.values()].filter(n => all || n.name[0] !== '.').sort((a, b) => cmp(a.name, b.name));
const pathOf = n => n === ROOT ? '/' : (n.parent === ROOT ? '' : pathOf(n.parent)) + '/' + n.name;
const tilde = n => { const p = pathOf(n); return p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p; };
const wname = p => p.cwd === HOMEN ? '~' : p.cwd.name;

// the shell running a command; commands print to P.out and resolve paths from P.cwd
let P = null;
function resolve(p, base) {
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
// how a clicked name is typed: relative to the current directory when possible
function rel(n, c) {
  if (n === c) return '.';
  if (n === c.parent && c !== ROOT) return '..';
  const p = pathOf(n), b = c === ROOT ? '/' : pathOf(c) + '/';
  return p.startsWith(b) ? p.slice(b.length) : tilde(n);
}
const quote = s => /^[\w.\/~+-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";

/* novig stats */
function stats() {
  const s = window.NOVIG_STATS;
  if (!s || typeof s !== 'object') return null;
  for (const k of ['profit', 'trades', 'volume_usd', 'return_pct', 'sharpe', 'days']) if (typeof s[k] !== 'number' || !isFinite(s[k])) return null;
  return typeof s.updated === 'string' && !isNaN(Date.parse(s.updated)) ? s : null;
}
function novigText() {
  const s = stats();
  if (!s) return null;
  const f = (n, o) => n.toLocaleString('en-US', o);
  const usd = n => f(n, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const src = typeof s.source === 'string' && /^https:\/\/\S+$/.test(s.source) ? s.source : 'https://www.lbtrading.com/stats/novig';
  return ['Novig market making · LbtradingLLC',
    'source   ' + src,
    'updated  ' + new Date(s.updated).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    '',
    'profit   ' + usd(s.profit),
    'trades   ' + f(s.trades),
    'volume   ' + usd(s.volume_usd),
    'return   ' + f(s.return_pct, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' }) + '%',
    'sharpe   ' + f(s.sharpe, { maximumFractionDigits: 2 }),
    'days     ' + f(s.days), ''].join('\n');
}

/* file metadata for ls -l */
const enc = new TextEncoder();
const DOC_TIME = (() => { const d = new Date(D.lastModified); return isNaN(d) ? new Date() : d; })();
const textOf = n => n.t === 'f' ? n.text : n.t === 'g' ? novigText() || '' : '';
const sizeOf = n => n.t === 'd' ? 4096 : n.t === 'l' ? (n.st && n.st.size) || 0 : enc.encode(textOf(n)).length;
const mtime = n => n.t === 'g' && stats() ? new Date(stats().updated) : n.t === 'l' && n.st && n.st.mt ? n.st.mt : DOC_TIME;
function statLink(n) {
  const o = { method: 'HEAD', cache: 'no-cache' };
  try { if (AbortSignal.timeout) o.signal = AbortSignal.timeout(4000); } catch (e) {}
  return fetch(n.href, o).then(r => {
    const lm = r.headers.get('last-modified');
    n.st = r.ok ? { size: +r.headers.get('content-length') || 0, mt: lm && !isNaN(Date.parse(lm)) ? new Date(lm) : null } : { size: 0 };
  }, () => { n.st = { size: 0 }; });
}
const dtf = o => new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, o));
const parts = (f, d) => Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
const LS_DATE = dtf({ month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function lsDate(d) {
  const p = parts(LS_DATE, d), age = Date.now() - d;
  return p.month + ' ' + p.day.padStart(2) + ' ' + (age < 15778476000 && age > -3600000 ? p.hour + ':' + p.minute : ' ' + p.year);
}
function human(b) {
  if (b < 1024) return String(b);
  let v = b, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < 3);
  return (v < 10 ? (Math.ceil(v * 10) / 10).toFixed(1) : String(Math.ceil(v))) + 'KMGT'[i];
}

/* output */
function L(...a) { const d = el('div', 'l'); d.append(...a.filter(x => x != null)); P.out.append(d); return d; }
const Ls = a => a.forEach(x => L(x));
function prompt(w) { const f = D.createDocumentFragment(); f.append('[', sp('u', USER + '@' + HOST), ' ' + w + ']$ '); return f; }
// a command line, wrapped as at the prompt
const echo = s => L(prompt(wname(P)), s).classList.add('pl');
// clickable names: spans with role=button (a <button> would not wrap like terminal text)
const btn = (cls, txt) => attr(sp(cls, txt), { role: 'button' });
function ent(n, label) {
  const b = btn('f' + (n.t === 'd' ? ' di' : ''), label == null ? n.name : label);
  b._n = n;
  return b;
}
// a command name: runs on click, or is typed into the prompt when it needs an argument or ends the shell
function cx(c, label) {
  const b = btn('x', label || c), m = /^(?:(cat|open|echo|cd|theme|tmux)|exit|logout)$/.exec(c);
  if (m) b.dataset.fill = m[1] ? c + ' ' : c; else b.dataset.run = c;
  return b;
}
const LINK = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])|([\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,})/gi;
function linkify(d, s) {
  let i = 0;
  for (const m of s.matchAll(LINK)) {
    d.append(s.slice(i, m.index));
    const a = el('a', '', m[0]);
    if (m[1]) { a.href = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; } else a.href = 'mailto:' + m[2];
    d.append(a); i = m.index + m[0].length;
  }
  d.append(s.slice(i));
}
function fileBox(text) {
  const box = el('div', 'file');
  for (const s of text.replace(/\n$/, '').split('\n')) {
    // bullets and "key   value" lines wrap under their text; a one-word value (a URL) wraps at any character
    const d = el('div', 'l'), m = /^\s*(?:[-*]|\d+\.) |^\S+ {2,}(?=\S)/.exec(s);
    if (m) { d.className = 'l li' + (/  $/.test(m[0]) && !/\s/.test(s.slice(m[0].length)) ? ' kv' : ''); d.style.setProperty('--i', m[0].length); }
    linkify(d, s); box.append(d);
  }
  return box;
}
// coreutils-style columns: as many columns as fit, filled top to bottom
function columns(items, W) {
  const n = items.length;
  if (!n) return;
  let rows = n, ws = [Math.max(...items.map(i => i.len))];
  for (let c = Math.min(n, Math.floor((W + 2) / 3)); c > 1; c--) {
    const r = Math.ceil(n / c), w = [];
    for (let k = 0; k * r < n; k++) w.push(Math.max(...items.slice(k * r, k * r + r).map(i => i.len)));
    if (w.reduce((a, b) => a + b + 2, -2) <= W) { rows = r; ws = w; break; }
  }
  for (let r = 0; r < rows; r++) {
    const d = L();
    for (let k = 0; k < ws.length; k++) {
      const it = items[k * rows + r];
      if (!it) break;
      d.append(it.el);
      if (k + 1 < ws.length && items[(k + 1) * rows + r]) d.append(' '.repeat(ws[k] - it.len + 2));
    }
  }
}
const termCols = () => P.sx;
const bottom = p => { p.el.scrollTop = p.el.scrollHeight; };

/* terminal metrics */
const cell = { w: 9, h: 21, font: '400 15px "Geist Mono", monospace' };
const probe = sp('', '0'.repeat(64)), probeBox = attr(el('div', 'probe'), { 'aria-hidden': 'true' });
probeBox.append(probe); term.append(probeBox);
function measure() {
  const w = probe.getBoundingClientRect().width / 64, cs = getComputedStyle(scr);
  if (w > 0) cell.w = w;
  cell.h = parseFloat(cs.lineHeight) || cell.h;
  cell.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
}

/* theme */
const BG = { dark: '#0d0e10', light: '#f6f5f0' };
const themeGet = () => root.getAttribute('data-theme') || 'auto';
const themeEff = () => { const t = themeGet(); return t !== 'auto' ? t : lightq.matches ? 'light' : 'dark'; };
function colors() {
  const cs = getComputedStyle(root), g = k => cs.getPropertyValue('--' + k).trim();
  return { bg: g('bg'), dim: g('dim'), fg: g('fg'), accent: g('accent'), bright: g('bright') };
}
function themeChanged() {
  const t = themeGet();
  for (const m of D.querySelectorAll('meta[name="theme-color"]')) m.content = t !== 'auto' ? BG[t] : /light/.test(m.media) ? BG.light : BG.dark;
  if (live) { live.th.textContent = themeEff(); if (live.inst) try { live.inst.setColors(colors()); } catch (e) {} }
}
function setTheme(t) {
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { if (t === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', t); } catch (e) {}
  themeChanged();
}

/* fastfetch */
let live = null, gpu;   // the one fastfetch block with a live renderer, in whichever pane printed it last
const upMins = () => Math.floor(performance.now() / 60000);
// "1 hour, 5 mins" (fastfetch) or "1 hour, 5 minutes" (uptime -p)
function upStr(m, unit = 'min') {
  const d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24, n = m % 60, p = [];
  if (d) p.push(d + (d > 1 ? ' days' : ' day'));
  if (h) p.push(h + (h > 1 ? ' hours' : ' hour'));
  if (n || !p.length) p.push(n + ' ' + unit + (n === 1 ? '' : 's'));
  return p.join(', ');
}
function browser() {
  const u = navigator.userAgent;
  const t = [[/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/SamsungBrowser\/(\d+)/, 'Samsung Internet'], [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/(?:Chrome|CriOS)\/(\d+)/, navigator.brave ? 'Brave' : 'Chrome'], [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, 'Safari']];
  for (const [r, name] of t) { const m = u.match(r); if (m) return name + ' ' + m[1]; }
  return 'unknown';
}
// asks the renderer's own context (getContext returns it again), so no second context is made
function gpuName(cv) {
  try {
    const gl = cv.getContext('webgl');
    let s = gl.getParameter(gl.RENDERER) || '';
    if (/^(WebKit WebGL|Mozilla)$/.test(s)) { const x = gl.getExtension('WEBGL_debug_renderer_info'); s = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; }
    return shortGPU(String(s || ''));
  } catch (e) { return ''; }
}
function shortGPU(s) {
  const m = /^ANGLE \((.*)\)$/.exec(s);
  if (m) { s = m[1]; const i = s.indexOf(', '); if (i > 0) s = s.slice(i + 2); }
  if (/SwiftShader/i.test(s)) return 'SwiftShader';
  s = s.replace(/^ANGLE Metal Renderer: /, '').replace(/, or similar$/, '');
  for (let p = ''; p !== s;) { p = s; s = s.replace(/\s*\([^()]*\)/g, ''); }
  s = s.split(/, | Direct3D| vs_| OpenGL| Vulkan|\//)[0].replace(/^Mesa /, '').replace(/\s+/g, ' ').trim();
  return s.length > 32 ? s.slice(0, 31) + '…' : s;
}
// static ASCII torus: the renderer's first frame (same pose, camera, light, sampling and glyph rule), so the canvas
// takes over without a jump. Shown before WebGL starts, without WebGL, and in old output.
let memo = {};
function torus(c, r) {
  const key = [c, r, cell.w, cell.h].join();
  if (memo.k === key) return memo.g;   // shared by all boxes of this size
  const X = c * 2, Y = r * 3, W = c * cell.w, H = r * cell.h, m = Math.min(W, H) * 1.85, z = new Float32Array(X * Y), li = new Float32Array(X * Y), g = new Uint8Array(c * r);
  const cy = Math.cos(-0.55), sy = Math.sin(-0.55), cx = Math.cos(0.45), sx = Math.sin(0.45), a1 = sx * sy, a2 = cx * sy, a3 = sx * cy, a4 = cx * cy;
  for (let t = 0; t < 6.2832; t += 0.05) {
    const ct = Math.cos(t), st = Math.sin(t), R = 0.92 + 0.4 * ct, q = 0.4 * st;
    for (let u = 0; u < 6.2832; u += 0.012) {
      const cu = Math.cos(u), su = Math.sin(u), a = R * cu, b = R * su, e = ct * cu, f = ct * su;
      // object -> world: the transpose of the renderer's rotation M
      const x = cy * a + a1 * b - a2 * q, y = cx * b + sx * q, d = sy * a - a3 * b + a4 * q + 6;
      const n0 = cy * e + a1 * f - a2 * st, n1 = cx * f + sx * st, n2 = sy * e - a3 * f + a4 * st;
      const v = (n0 * x + n1 * y + n2 * d) / Math.sqrt(x * x + y * y + d * d);
      if (v > 0) continue;   // facing away from the camera
      const i = Math.floor((W / 2 + m * x / d) / cell.w * 2), j = Math.floor((H / 2 - m * y / d) / cell.h * 3), k = j * X + i;
      if (i < 0 || j < 0 || i >= X || j >= Y || (z[k] && z[k] < d)) continue;
      const dif = Math.pow(Math.min(1, Math.max(0, (-0.36 * n0 + 0.72 * n1 - 0.59 * n2) * 0.5 + 0.5)), 1.6) + 0.12 * Math.max(0, 0.59 * n0 - 0.49 * n1 - 0.64 * n2);
      z[k] = d; li[k] = Math.min(1, 0.04 + 0.9 * dif + 0.1 * (1 + v) ** 3);
    }
  }
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
    let l = 0, h = 0;
    for (let b = 0; b < 3; b++) for (let a = 0; a < 2; a++) { const k = (j * 3 + b) * X + i * 2 + a; if (z[k]) { l += li[k]; h++; } }
    // low bits: glyph (thinned by coverage); high bits: colour (dim, accent or bright by light level)
    if (h) g[j * c + i] = 1 + Math.floor(Math.min(1, h < 6 ? l / 6 : l / h) * 8.99) | (l / h < 0.25 ? 16 : l / h < 0.75 ? 32 : 48);
  }
  memo = { k: key, g };
  return g;
}
function drawArt(f) {
  const { c, r, art } = f, g = torus(c, r);
  art.textContent = '';
  for (let j = 0; j < r; j++) {
    let run = '', k = -1;
    const flush = () => { if (run) art.append(k > 0 ? sp('g' + k, run) : run); run = ''; };
    for (let i = 0; i < c; i++) {
      const v = g[j * c + i], kk = v >> 4;
      if (kk !== k) { flush(); k = kk; }
      run += RAMP[v & 15];
    }
    flush();
    if (j < r - 1) art.append('\n');
  }
}
// sizes the logo boxes of one pane to its columns: reads, then writes, then one read
function layout(list) {
  for (const f of list) {
    const p = f.p, W = p.sx, H = p.sy + (p.y + p.sy >= GH ? kb : 0);   // rows hidden by an on-screen keyboard still count
    let c, r, g = 0;
    f.stack = W < 37 + f.iw;
    if (!f.stack) {
      // wide panes: a bigger logo (42 to 76 columns); always round on screen, and short panes leave rows for the
      // welcome line and prompt
      const wide = W >= 46 + f.iw;
      g = wide ? 4 : 3;
      c = wide ? Math.min(76, Math.max(42, Math.round(W * 0.42)), W - g - f.iw) : 34;
      r = Math.min(Math.round(c * cell.w / cell.h), Math.max(8, H - 3));
      c = Math.min(c, Math.round(r * cell.h / cell.w));
    } else {
      // phones: 8-13 rows, so the info, welcome, prompt and touch keys fit the first screen
      r = Math.max(8, Math.min(13, H - f.n - 5));
      c = Math.min(32, W, Math.round(r * cell.h / cell.w));
    }
    f.ff.classList.toggle('stack', f.stack);
    for (const [k, v] of [['c', c], ['r', r], ['g', g]]) f.ff.style.setProperty('--' + k, v);
    const key = [c, r, cell.w, cell.h, cell.font].join();
    if (key === f.key) continue;
    f.key = key; f.c = c; f.r = r;
    drawArt(f);
    if (f.inst) try { f.inst.resize(c, r, cell.w, cell.h, cell.font); } catch (e) {}
  }
  // one blank row after the block: the logo's own bottom row when it is the taller column, a margin otherwise
  const h = list.map(f => f.info.offsetHeight);
  list.forEach((f, i) => f.ff.classList.toggle('sp', f.stack || h[i] > (f.r - 1) * cell.h));
}
const ffs = p => [...p.out.querySelectorAll('.ff')].map(e => e._f);
const infoWidth = f => Math.max(...[...f.info.children].map(d => d.classList.contains('cb') ? 24 : d.textContent.length));
const LOGO = 'Logo: a torus drawn with text characters.';
function fastfetch() {
  killLive();
  const ff = el('div', 'ff'), logo = el('div', 'ff-logo'), art = el('pre', 'ff-art'), info = el('div', 'ff-info');
  // a labelled image: read aloud, never copied with the text
  attr(logo, { role: 'img', 'aria-label': LOGO }); art.setAttribute('aria-hidden', 'true');
  logo.append(art); ff.append(logo, info);
  const line = (...a) => { const d = el('div', 'l'); d.append(...a); info.append(d); return d; };
  const kv = (k, v, quiet) => { const s = sp('', v); if (quiet) s.setAttribute('aria-live', 'off'); line(sp('k', k), ': ', s); return s; };
  line(sp('k', USER), '@', sp('k', HOST));
  line('-'.repeat(USER.length + HOST.length + 1));
  kv('OS', 'Arch Linux x86_64');
  for (const [k, v] of S.fetch || []) kv(k, v);
  const f = { ff, logo, art, info, p: P };
  f.up = kv('Uptime', upStr(upMins()), 1);
  f.res = kv('Resolution', innerWidth + 'x' + innerHeight, 1);
  kv('Terminal', browser());
  // the GPU row waits, hidden, for mount()
  if (gpu !== '') { const s = kv('GPU', gpu || '', 1); if (!gpu) { s.parentNode.classList.add('pend'); f.gpu = s; } }
  kv('Locale', navigator.language || 'en-US');
  f.th = kv('Theme', themeEff(), 1);
  line();
  for (const b of [0, 8]) {
    const d = line();
    d.className = 'cb'; d.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 8; i++) { const s = el('span'); s.style.background = 'var(--c' + (b + i) + ')'; d.append(s); }
  }
  P.out.append(ff);
  ff._f = f; live = f;
  f.iw = infoWidth(f); f.n = info.childElementCount;   // counted before mount() drops a GPU row
  layout([f]);
  // the live renderer starts after first paint, so text never waits for WebGL
  requestAnimationFrame(() => setTimeout(() => fontsReady.then(() => { if (live === f) { measure(); refresh(); mount(f); } }), 0));
}
function mount(f) {
  const G = window.GlyphRenderer, cv = attr(el('canvas'), { 'aria-hidden': 'true' });
  let inst = null;
  if (G && typeof G.create === 'function') {
    f.logo.append(cv);
    try { inst = G.create(cv, { cols: f.c, rows: f.r, cellW: cell.w, cellH: cell.h, font: cell.font, colors: colors(), reducedMotion: rmq.matches }); } catch (e) {}
  }
  if (inst) {
    f.inst = inst; f.cv = cv;
    const say = name => f.logo.setAttribute('aria-label', 'Logo: a ' + (rmq.matches ? '' : 'rotating ') + (name || 'shape') + ' drawn with text characters.');
    say(inst.shape);
    inst.onshape = say;
    // static art until the canvas draws, and while its context is lost
    const show = on => { cv.style.visibility = on ? '' : 'hidden'; f.logo.classList.toggle('gl', on); };
    const later = () => requestAnimationFrame(() => requestAnimationFrame(() => { if (f.inst) show(true); }));
    cv.addEventListener('webglcontextlost', () => show(false));
    cv.addEventListener('webglcontextrestored', later);
    later();
  } else cv.remove();
  if (gpu === undefined) gpu = inst ? gpuName(cv) : '';
  if (f.gpu) {
    if (gpu) { f.gpu.textContent = gpu; f.gpu.parentNode.classList.remove('pend'); } else f.gpu.parentNode.remove();
    f.gpu = null; f.iw = infoWidth(f); layout([f]);
  }
}
function killLive() {
  const f = live;
  live = null;
  if (!f || !f.inst) return;
  try { f.inst.destroy(); } catch (e) {}
  f.inst = null; f.cv.remove();
  f.logo.classList.remove('gl');
  f.logo.setAttribute('aria-label', LOGO);
}
function clear() { if (live && live.p === P) killLive(); P.out.textContent = ''; }
function welcome() { L("Welcome! Type '", cx('help'), "' for commands, '", cx('ls'), "' to look around, or '", cx('view .'), "' to browse files."); }

/* commands */
const bad = (msg, c, st = 1) => { L(msg); L("Try '" + c + " --help' for more information."); return st; };
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
const CMDS = {
  help() {
    // GNU --help layout (descriptions at column 17, longer entries run on); narrow panes drop argument hints
    let w = 17;
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
      P = p;
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
    while (/^-[LP]+$/.test(args[0])) args.shift();   // bash's -L and -P change nothing here
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
    // a file opens its directory with the file selected
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
    return tc(args.length ? args : ['new-session'], { p: P, f: want(), err: m => (L(m), 1) });
  },
  // in a tmux pane the shell ends and its pane closes; the plain shell logs out and a new login starts
  exit() {
    if (P.w) { const f = want(); killPane(P); update(f); return 0; }
    L('logout');
    return login();
  },
  sudo(args) { L(args.length ? USER + ' is not in the sudoers file.' : 'usage: sudo -h | -K | -k | -V'); return 1; },
  pacman(args) { L(args.length ? 'error: you cannot perform this operation unless you are root.' : 'error: no operation specified (use -h for help)'); return 1; },
};
CMDS.neofetch = CMDS.fastfetch;
CMDS.logout = CMDS.exit;

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
  // a wrapped name is indented so it does not read as a heading
  for (const r of rows) L(r[0] + ' ' + r[1].padStart(wl) + ' ' + r[2].padEnd(wo) + ' ' + r[3].padEnd(wg) + ' ' + r[4].padStart(ws) + ' ' + r[5] + ' ', ent(r[6], r[7])).className = 'l li ll';
}
function newTab(href) {
  const a = el('a');
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.click();
}

/* shell */
function env() {
  const e = { HOME, USER, LOGNAME: USER, HOSTNAME: HOST, PWD: pathOf(P.cwd), OLDPWD: P.oldpwd ? pathOf(P.oldpwd) : '', SHELL: '/bin/bash',
    TERM: P.w ? 'tmux-256color' : 'xterm-256color', LANG: 'en_US.UTF-8', PATH: '/usr/local/sbin:/usr/local/bin:/usr/bin', PS1: '[\\u@\\h \\W]\\$ ', '?': String(P.status) };
  if (P.w) { e.TMUX = SOCK + ',' + server.pid + ',' + P.w.s.id; e.TMUX_PANE = '%' + P.tid; }
  return e;
}
// words with '...' and "..." quoting, backslash escapes, $VAR and a leading ~
function parse(s) {
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
// split a line into commands joined by ; && || (quote-aware, nothing expanded yet)
function split(s) {
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
// run one simple command; returns an exit status, or a promise of one
function run1(src) {
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
  const seq = split(line);
  if (seq.err) { L(seq.err); return 2; }
  const next = i => {
    for (; i < seq.list.length && !p.dead; i++) {
      const { src, op } = seq.list[i];
      if ((op === '&&' && p.status) || (op === '||' && !p.status)) continue;
      P = p;
      const r = run1(src);
      if (r && typeof r.then === 'function') return r.then(v => { p.status = v; return next(i + 1); });
      p.status = r;
    }
    return p.status;
  };
  return next(0);
}
function submit(p, line, quiet) {
  P = p;
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
function done(p, r) {
  p.status = typeof r === 'number' ? r : 0;
  p.busy = false; p.cmd.classList.remove('busy');
  if (!p.dead) { renderPrompt(p); bottom(p); }
}
// the label carries the directory (and pane) the aria-hidden prompt shows
function renderPrompt(p) {
  p.ps1.replaceChildren(prompt(wname(p)));
  const n = p.w && p.w.list.length > 1 ? ', pane ' + p.w.list.indexOf(p) : '';
  p.inp.setAttribute('aria-label', 'Terminal command' + n + ', in ' + (p.cwd === HOMEN ? 'home directory' : pathOf(p.cwd)));
}

/* panes: a log and a prompt line; a real input receives the keys and spans mirror it with a block cursor */
function mkPane(cwd) {
  const p = { cwd: cwd || HOMEN, oldpwd: null, status: 0, hist: [], hpos: 0, draft: '', busy: false, tabbed: false, last: '', rq: 0, stick: true, st: 0, x: 0, y: 0, sx: 80, sy: 24 };
  const e = p.el = el('div', 'pane'), typed = attr(sp('typed'), { 'aria-hidden': 'true' }), i = p.inp = el('input');
  p.out = attr(el('div', 'out'), { role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output' });
  p.cmd = attr(el('form', 'cmd'), { action: '#', autocomplete: 'off' });
  p.ps1 = attr(sp(), { 'aria-hidden': 'true' });
  p.pre = sp(); p.sel = sp('sel'); p.cur = sp('cur', ' '); p.post = sp();
  typed.append(p.pre, p.sel, p.cur, p.post);
  attr(i, { type: 'text', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go' });
  p.cmd.append(p.ps1, typed, i);
  e.append(p.out, p.cmd);
  e._p = p;
  i.addEventListener('keydown', ev => onKey(p, ev));
  // form submission covers mobile keyboards whose Enter is an IME keydown (keyCode 229)
  p.cmd.addEventListener('submit', ev => { ev.preventDefault(); if (!p.busy) enter(p); });
  i.addEventListener('input', () => { draw(p); if (p.cmd.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom) bottom(p); });
  // focus reaching a prompt (Tab, a click) selects its pane
  i.addEventListener('focus', () => { p.cmd.classList.add('on'); p.last = ''; draw(p); if (p.w && p.w.act !== p && client && client.s.cur === p.w) { pick(p); refresh(); } });
  i.addEventListener('blur', () => { p.cmd.classList.remove('on'); draw(p); });
  i.addEventListener('select', () => queueDraw(p));
  return p;
}

/* line editing */
const caret = p => p.inp.selectionStart == null ? p.inp.value.length : p.inp.selectionStart;
function setInput(p, v, pos) { p.inp.value = v; pos = pos == null ? v.length : pos; try { p.inp.setSelectionRange(pos, pos); } catch (e) {} draw(p); }
function draw(p) {
  const v = p.inp.value;
  let s = p.inp.selectionStart, e = p.inp.selectionEnd;
  if (s == null || D.activeElement !== p.inp) s = e = Math.min(s == null ? v.length : s, v.length);
  if (s !== e) {
    p.pre.textContent = v.slice(0, s); p.sel.textContent = v.slice(s, e); p.post.textContent = v.slice(e);
    p.cur.classList.add('off');
  } else {
    const n = (v.codePointAt(s) || 0) > 0xffff ? 2 : 1;
    p.pre.textContent = v.slice(0, s); p.sel.textContent = '';
    p.cur.textContent = s < v.length ? v.slice(s, s + n) : ' ';
    p.post.textContent = v.slice(s + n);
    p.cur.classList.remove('off');
  }
  const k = v + '\u0000' + s + ':' + e;
  if (k !== p.last) { p.last = k; p.cur.style.animation = 'none'; void p.cur.offsetWidth; p.cur.style.animation = ''; } // solid while typing, like a real terminal
}
const queueDraw = p => { if (!p.rq) p.rq = requestAnimationFrame(() => { p.rq = 0; draw(p); }); };
function histMove(p, d) {
  if (p.hpos === p.hist.length && d < 0) p.draft = p.inp.value;
  const n = Math.max(0, Math.min(p.hist.length, p.hpos + d));
  if (n === p.hpos) return;
  p.hpos = n; setInput(p, n === p.hist.length ? p.draft : p.hist[n]);
}
const lcp = a => a.reduce((p, s) => { let i = 0; while (i < p.length && p[i] === s[i]) i++; return p.slice(0, i); });
function complete(p) {
  const v = p.inp.value, c = caret(p), b = v.slice(0, c), ws = b.lastIndexOf(' ') + 1;
  const word = b.slice(ws), head = b.slice(0, ws).trim();
  const put = t => setInput(p, v.slice(0, ws) + t + v.slice(c), ws + t.length);
  let pre = '', base = word, list;
  P = p;
  if (!head && !word.includes('/') && word[0] !== '~' && word[0] !== '.') {
    list = Object.keys(CMDS).filter(k => k.startsWith(word)).sort().map(s => ({ s }));
  } else if (head === 'tmux') {
    list = Object.keys(TC).filter(k => k.startsWith(word)).map(s => ({ s }));
  } else {
    if (word === '~') return put('~/');
    const k = word.lastIndexOf('/');
    pre = word.slice(0, k + 1); base = word.slice(k + 1);
    let d = p.cwd;
    if (pre) { const r = resolve(pre.replace(/^~(?=\/)/, HOME)); if (r.err || r.n.t !== 'd') return; d = r.n; }
    const dirsOnly = head.split(/\s+/)[0] === 'cd';
    list = kids(d, base[0] === '.').filter(n => n.name.startsWith(base) && (!dirsOnly || n.t === 'd')).map(n => ({ s: n.name, d: n.t === 'd' }));
    if (base === '..') list = [{ s: '..', d: true }];
  }
  if (!list.length) return;
  if (list.length === 1) return put(pre + list[0].s + (list[0].d ? '/' : ' '));
  const l = lcp(list.map(x => x.s));
  // like bash: one Tab completes the common prefix, a second lists the candidates
  if (l.length > base.length) { put(pre + l); p.tabbed = true; return; }
  if (!p.tabbed) { p.tabbed = true; return; }
  echo(v);
  columns(list.map(x => { const t = x.s + (x.d ? '/' : ''); return { el: D.createTextNode(t), len: t.length }; }), termCols());
  bottom(p);
}
// readline's Ctrl keys; false lets the browser have the key
function ctl(p, k) {
  const v = p.inp.value, i = caret(p);
  if (k === 'c') {
    if (p.inp.selectionStart !== p.inp.selectionEnd) return false;   // copy
    P = p; echo(v + '^C'); setInput(p, ''); p.hpos = p.hist.length; p.status = 130; bottom(p);
  }
  else if (k === 'l') { P = p; clear(); p.el.scrollTop = 0; }
  else if (k === 'u') setInput(p, v.slice(i), 0);
  else if (k === 'k') setInput(p, v.slice(0, i));
  else if (k === 'w') { const b = v.slice(0, i).replace(/\S+\s*$|\s+$/, ''); setInput(p, b + v.slice(i), b.length); }
  else if (k === 'a') setInput(p, v, 0);
  else if (k === 'e') setInput(p, v);
  else if (k === 'b') setInput(p, v, Math.max(0, i - 1));
  // Ctrl+D: delete the character under the cursor, or end the shell on an empty line
  else if (k === 'd') { if (v) setInput(p, v.slice(0, i) + v.slice(i + 1), i); else submit(p, 'exit', 1); }
  else return false;
  return true;
}
function onKey(p, e) {
  const k = e.key;
  if (k !== 'Tab') p.tabbed = false;
  if (e.isComposing || e.keyCode === 229) return;
  if (p.busy) { if (k === 'Enter' || k === 'Tab') e.preventDefault(); return; }
  if (k === 'Enter') { e.preventDefault(); enter(p); }
  else if (k === 'Tab') { if (e.shiftKey || !p.inp.value) return; e.preventDefault(); complete(p); }
  else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); histMove(p, k === 'ArrowUp' ? -1 : 1); }
  else if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); p.el.scrollTop += (k === 'PageUp' ? -1 : 1) * Math.max(cell.h, p.el.clientHeight - cell.h); }
  else if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && /^[a-z]$/i.test(k) && ctl(p, k.toLowerCase())) e.preventDefault();
  else queueDraw(p);
}
function enter(p) { const v = p.inp.value; setInput(p, ''); submit(p, v); }
const cur = () => client ? client.s.cur.act : plain;
// where keys go in a pane: a tmux mode, else a program on the alternate screen, else the prompt
function focusP(p) {
  const t = p.mode ? p.mode.el : p.alt ? p.alt.f() : p.inp;
  if (D.activeElement !== t) try { t.focus({ preventScroll: true }); } catch (e) {}
}
// focus follows tmux commands, except on touch screens with the keyboard down (focusing would raise it)
const want = () => !coarse.matches || D.activeElement instanceof HTMLInputElement;

/* view: a two-column file browser on the pane's alternate screen, so the transcript keeps only the command line */
let vseq = 0;
function browse(p, dir, first) {
  return new Promise(res => {
    const e = el('div', 'view'), id = 'v' + ++vseq + '-', open = new Set();
    const t = attr(el('div', 'vt'), { role: 'tree', tabindex: '-1', 'aria-label': 'Files in ' + tilde(dir) + '; q quits' });
    const v = attr(el('div', 'vp'), { tabindex: '-1', role: 'document', 'aria-label': 'File' });
    const b = el('div', 'vb'), path = sp('vpath'), hint = sp('vh'), quit = btn('x', 'q quit');
    b.append(path, hint);
    e.append(t, el('div', 'vs'), v, b);
    let rows = [], sel = null, pf = 0;
    // the tree column fits the longest name when the pane allows
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
        const a = el('a', '', 'open ' + n.name), d = el('div', 'l', n.name + ': binary file (use: ');
        a.href = n.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        d.append(a, ')'); v.append(d);
      }
      // a directory shows what is in it; a click selects that entry in the tree
      else for (const k of kids(n)) { const d = el('div', 'l'), s = btn(k.t === 'd' ? 'f di' : 'f', k.name); s._k = k; d.append(s); v.append(d); }
    }
    const toggle = n => { if (open.has(n)) open.delete(n); else open.add(n); build(); select(n); };
    const side = f => { pf = f; e.classList.toggle('pf', !!f); fit(); focusP(p); };
    const fit = () => {
      const W = p.sx, wide = W >= 60;
      e.classList.toggle('stack', !wide);
      e.style.setProperty('--tw', Math.min(Math.floor(W * 0.4), Math.max(20, wmax + 2)));
      e.style.setProperty('--th', Math.max(4, Math.min(14, Math.floor((p.sy - 2) * 0.4))));
      hint.replaceChildren(quit, wide ? pf ? '  ↑↓ scroll  h back' : '  ↑↓ move  h/l fold/open  enter open' : '');
    };
    const close = () => {
      const had = e.contains(D.activeElement);
      e.remove(); p.alt = null; p.prog = '';
      p.el.classList.toggle('alt', !!p.mode);
      drawStatus();
      res(0);
      if (had) focusP(p);
    };
    function key(ev) {
      const k = ev.key, i = rows.findIndex(x => x.n === sel), n = sel, pg = Math.max(cell.h, v.clientHeight - cell.h);
      if (k === 'q' || k === 'Escape') close();
      else if (!n) return k.length === 1;
      else if (k === 'ArrowDown' || k === 'j') { if (pf) v.scrollTop += cell.h; else if (i < rows.length - 1) select(rows[i + 1].n); }
      else if (k === 'ArrowUp' || k === 'k') { if (pf) v.scrollTop -= cell.h; else if (i > 0) select(rows[i - 1].n); }
      else if (k === 'ArrowRight' || k === 'l' || k === 'Enter') {
        if (n.t === 'd') { if (!open.has(n) || k === 'Enter') toggle(n); else if (rows[i + 1] && rows[i + 1].n.parent === n) select(rows[i + 1].n); }
        else if (n.t === 'l' && k === 'Enter') newTab(n.href);
        else if (pf) v.scrollTop += pg; else side(1);
      }
      else if (k === 'ArrowLeft' || k === 'h') {
        if (pf) side(0);
        else if (n.t === 'd' && open.has(n)) toggle(n);
        else if (n.parent !== dir) select(n.parent);
      }
      else if (k === 'g' || k === 'Home') { if (pf) v.scrollTop = 0; else select(rows[0].n); }
      else if (k === 'G' || k === 'End') { if (pf) v.scrollTop = v.scrollHeight; else select(rows[rows.length - 1].n); }
      else if (k === 'PageDown' || k === ' ') v.scrollTop += pg;
      else if (k === 'PageUp') v.scrollTop -= pg;
      else if (k === 'Tab') {
        const a = [...v.querySelectorAll('a')], j = a.indexOf(D.activeElement);
        if (!pf) side(1); else if (ev.shiftKey ? j > 0 : j < a.length - 1) return false; else side(0);
      }
      else return k.length === 1;   // other characters do nothing (they never reach the prompt)
      return true;
    }
    e.addEventListener('click', ev => {
      const x = ev.target.closest('.vr, .f, .x');
      if (!x) return;
      if (x === quit) { const f = want(); close(); if (f) focusP(p); return; }
      if (x._k) { open.add(sel); build(); select(x._k); return; }
      if (!x._n) return;
      if (x._n.t === 'd') toggle(x._n); else select(x._n);
      side(0);
    });
    p.alt = { f: () => pf ? v : t, key, fit, close };
    p.prog = 'view';
    p.el.append(e); p.el.classList.add('alt');
    p.el.scrollTop = 0;
    build(); fit();
    select(first || (rows.find(r => r.n.t !== 'd') || rows[0] || {}).n);
    drawStatus();
    if (want()) focusP(p);
  });
}

/* tmux: sessions hold windows, a window holds a tree of panes (leaves {p, k} and splits {d, c, k}; k is the size in
   cells along the parent split). Every pane has its own shell; only the current window of the attached session is on screen. */
const SOCK = '/tmp/tmux-1000/default', MINW = 24, MINH = 5, NEST = 'sessions should be nested with care, unset $TMUX to force';
let server = null, client = null, GW = 80, GH = 24, kb = 0, useq = 0, shown = [];
const best = () => server && server.list.reduce((a, s) => s.used > a.used ? s : a);
const sfind = t => server && server.list.find(s => s.name === String(t).replace(/^=|:$/g, ''));
const name = w => w.act.prog || 'bash';   // automatic-rename: what runs in the active pane

function newSession(nm, cwd) {
  if (!server) server = { list: [], id: 0, pn: 0, pid: 2219 };
  const s = { id: server.id++, wins: [], created: new Date(), used: Date.now() };
  s.name = nm || String(s.id);
  server.list.push(s);
  newWindow(s, cwd);
  return s;
}
function newWindow(s, cwd) {
  let i = 0;
  while (s.wins.some(w => w.i === i)) i++;   // the lowest free index
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
  p.w = w; p.tid = server.pn++; p.used = ++useq;
  w.list.splice(at, 0, p);
  w.el.insertBefore(p.el, w.bd);
  renderPrompt(p); draw(p);
  return p;
}
// a pane's space is halved (the other panes keep their sizes): in its own split when that runs the same way, else in
// a new split
function splitw(w, h, cwd, a = w.act) {
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
  pick(p);
}
function pick(p) {
  const w = p.w;
  if (w.act !== p) { w.lastp = w.act; w.act = p; w.zoom = false; }
  p.used = ++useq;
}
function selw(w) { const s = w.s; if (s.cur !== w) { s.last = s.cur; s.cur = w; } }
function gone(p) { if (live && live.p === p) killLive(); p.dead = true; p.el.remove(); }
// a closed pane's space goes to the pane before it (after it, for the first)
function killPane(p) {
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
function killWindow(w) {
  const s = w.s, i = s.wins.indexOf(w);
  w.list.forEach(gone); w.el.remove();
  s.wins.splice(i, 1);
  if (!s.wins.length) return killSession(s);
  if (s.last === w) s.last = null;
  if (s.cur === w) { s.cur = s.last || s.wins[i ? i - 1 : 0]; s.last = null; }
}
function killSession(s, why) {
  s.wins.forEach(w => { w.list.forEach(gone); w.el.remove(); });
  server.list.splice(server.list.indexOf(s), 1);
  if (!server.list.length) server = null;
  if (client && client.s === s) leave(why || 'exited');
}
// the client ends: the plain shell's tmux command returns with tmux's last words
function leave(msg) {
  const c = client;
  client = null; pfx = 0; ask = null; hidePanes();
  P = plain; L('[' + msg + ']');
  c.res(0);
}
function attach(s) {
  return new Promise(res => { client = { s, res, msg: '' }; s.used = Date.now(); });
}
// a fresh login: the plain shell starts tmux, which shows fastfetch in its first pane
function login() {
  client = null;
  if (server) [...server.list].forEach(s => killSession(s));
  P = plain; P.out.textContent = ''; P.cwd = HOMEN; P.oldpwd = null; P.status = 0;
  const s = newSession(), r = attach(s);
  refresh();
  P = s.cur.act; fastfetch(); welcome();
  // the prompt, unless scrolling to it hides who this is (the Name row): then the top of the info, a swipe above it
  const e = P.el, i = P.out.querySelector('.ff-info');
  e.scrollTop = e.scrollHeight - e.clientHeight > i.children[3].offsetTop ? i.offsetTop : e.scrollHeight;
  if (want()) focusP(P);
  return r;
}

// cell geometry from the layout tree: borders take one cell; when the space changed, sizes are scaled (rounded
// cumulatively) and kept
function geom(w) {
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
// single-line borders on the cell grid, drawn through the middle of their cells so junctions join; the cells next to
// the active pane are green, and with exactly two panes only the half of the line nearer the active one (as tmux does)
function borders(w) {
  const B = w.bd, A = w.act, two = w.list.length === 2;
  B.textContent = '';
  if (w.zoom) return;
  const vx = c => Math.floor((c + 0.5) * cell.w), hy = r => Math.floor((r + 0.5) * cell.h);
  const on = (v, c, r) => two ? (v ? (A.x ? r > GH >> 1 : r <= GH >> 1) : (A.y ? c > GW >> 1 : c <= GW >> 1))
    : v ? (c === A.x - 1 || c === A.x + A.sx) && r >= A.y - 1 && r <= A.y + A.sy
      : (r === A.y - 1 || r === A.y + A.sy) && c >= A.x - 1 && c <= A.x + A.sx;
  const seg = (v, k, a, b) => {
    const at = i => on(v, v ? k : i, v ? i : k), u = v ? cell.h : cell.w, mid = v ? hy : vx;
    for (let s = a, i = a; i <= b; i++) {
      const o = at(i);
      if (i < b && at(i + 1) === o) continue;
      // the ends reach into the crossing line's cell, unless they are at the window's edge
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
function size(p) {
  const s = p.el.style;
  s.left = p.x * cell.w + 'px'; s.top = p.y * cell.h + 'px';
  s.width = p.sx * cell.w + 0.5 + 'px'; s.height = p.sy * cell.h + 'px';
}
// the client area in cells; the on-screen keyboard (visual viewport) is not part of it
function viewport() {
  const v = window.visualViewport;
  if (!v || v.scale > 1.01) return;   // pinch zoom keeps the layout
  term.style.height = v.height + 'px'; term.style.top = v.offsetTop + 'px';
}
function grid() {
  const r = scr.getBoundingClientRect();
  GW = Math.max(1, Math.floor(r.width / cell.w + 0.01));
  GH = Math.max(1, Math.floor(r.height / cell.h + 0.01));
  kb = Math.max(0, Math.round((probeBox.offsetHeight - term.offsetHeight) / cell.h));
}
// puts the visible window (or the plain shell) on screen; panes keep their scroll position, or stay at the bottom
function refresh() {
  for (const p of shown) if (!p.dead && p.el.clientHeight && !p.alt && !p.mode) { p.st = p.el.scrollTop; p.stick = p.st + p.el.clientHeight >= p.el.scrollHeight - 4; }
  const w = client && client.s.cur;
  bar.hidden = !client;
  hidePanes();
  grid();
  for (const e of scr.children) { e.hidden = e !== (w ? w.el : pwin); e.style.height = GH * cell.h + 'px'; }
  let ps = [plain];
  if (w) {
    geom(w);
    ps = w.list.filter(p => { const h = w.zoom && p !== w.act; p.el.hidden = h; p.el.classList.toggle('act', p === w.act); return !h; });
    borders(w);
  } else Object.assign(plain, { x: 0, y: 0, sx: GW, sy: GH });
  for (const p of ps) {
    size(p);
    const f = ffs(p);
    if (f.length) layout(f);
    if (p.alt) p.alt.fit();
    if (p.mode) p.mode.fit();
    p.el.scrollTop = p.alt || p.mode ? 0 : p.stick ? p.el.scrollHeight : p.st;
    renderPrompt(p);
  }
  shown = ps;
  drawStatus();
}
const update = f => { refresh(); if (f) focusP(cur()); };

/* status line: tmux's default, "[session] index:name flags ..." on the left, "pane title" time date on the right */
const CLK = dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: '2-digit', month: 'short', year: '2-digit' });
const CT = dtf({ weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', year: 'numeric' });
const ctime = d => { const p = parts(CT, d); return p.weekday + ' ' + p.month + ' ' + p.day.padStart(2) + ' ' + p.hour + ':' + p.minute + ':' + p.second + ' ' + p.year; };
function drawStatus() {
  if (!client) return;
  const s = client.s, m = client.msg, box = el('div', 'sb');
  box.style.width = GW * cell.w + 'px';
  bar.className = m ? 'status msg' : 'status';
  if (m) { box.append(m); if (ask) box.append(sp('cur', ' ')); }
  else {
    const c = parts(CLK, new Date()), right = '"' + HOST + '" ' + c.hour + ':' + c.minute + ' ' + c.day + '-' + c.month + '-' + c.year;
    const left = sp('', '[' + s.name + '] '), it = s.wins.map(w => {
      const f = (w === s.cur ? '*' : w === s.last ? '-' : '') + (w.zoom ? 'Z' : '');
      return { w, t: w.i + ':' + name(w) + (f || ' ') };
    });
    // a list too long for the line is cut around the current window and marked with < and >
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
let mt = 0;
// a message (display-time 750 ms) or a y/n prompt, over the whole status line
function message(m, yes) {
  if (!client) return;
  client.msg = m; ask = yes || null;
  note.textContent = m;
  drawStatus();
  clearTimeout(mt);
  if (!yes) mt = setTimeout(() => { if (client && client.msg === m && !ask) { client.msg = ''; drawStatus(); } }, 750);
}
const tick = () => { drawStatus(); setTimeout(tick, 60050 - Date.now() % 60000); };
D.addEventListener('visibilitychange', () => { pfx = rep = 0; if (!D.hidden) drawStatus(); });   // background tabs run timers late

/* key bindings (prefix Ctrl-A or Ctrl-B, as with prefix2) and tmux commands */
const PFX = 'C-a';
const BIND = [['C-a', 'send-prefix', 'Send the prefix key'], ['"', 'split-window', 'Split window vertically'], ['%', 'split-window -h', 'Split window horizontally'],
  ['&', 'confirm-before -p "kill-window #W? (y/n)" kill-window', 'Kill current window'],
  ...'0123456789'.split('').map(i => [i, 'select-window -t :=' + i, 'Select window ' + i]),
  [';', 'last-pane', 'Move to the previously active pane'], ['?', 'list-keys -N', 'List key bindings'], ['c', 'new-window', 'Create a new window'],
  ['d', 'detach-client', 'Detach the current client'], ['l', 'last-window', 'Select the previously current window'], ['n', 'next-window', 'Select the next window'],
  ['o', 'select-pane -t :.+', 'Select the next pane'], ['p', 'previous-window', 'Select the previous window'], ['q', 'display-panes', 'Display pane numbers'],
  ['x', 'confirm-before -p "kill-pane #P? (y/n)" kill-pane', 'Kill the active pane'], ['z', 'resize-pane -Z', 'Zoom the active pane'],
  ['Up', 'select-pane -U', 'Select the pane above the active pane', 1], ['Down', 'select-pane -D', 'Select the pane below the active pane', 1],
  ['Left', 'select-pane -L', 'Select the pane to the left of the active pane', 1], ['Right', 'select-pane -R', 'Select the pane to the right of the active pane', 1]];
// name: 'alias flags' (t, s and p take a value)
const TC = {
  'attach-session': 'attach t', 'confirm-before': 'confirm p', 'detach-client': 'detach', 'display-panes': 'displayp', 'kill-pane': 'killp',
  'kill-server': '', 'kill-session': ' t', 'kill-window': 'killw', 'last-pane': 'lastp', 'last-window': 'last', 'list-keys': 'lsk N',
  'list-sessions': 'ls', 'new-session': 'new ds', 'new-window': 'neww', 'next-window': 'next', 'previous-window': 'prev', 'resize-pane': 'resizep Z',
  'select-pane': 'selectp DLRUlt', 'select-window': 'selectw t', 'send-prefix': '', 'split-window': 'splitw hv',
};
function tc(a, x) {
  const all = Object.keys(TC), ex = all.find(k => k === a[0] || TC[k].split(' ')[0] === a[0]), pm = a[0] ? all.filter(k => k.startsWith(a[0])) : [];
  const c = a[0] && (ex || (pm.length === 1 && pm[0]));
  if (!c) return x.err(pm.length ? 'ambiguous command: ' + a[0] + ', could be: ' + pm.join(', ') : 'unknown command: ' + a[0]);
  const fl = TC[c].split(' ')[1] || '', f = {}, args = [];
  for (let i = 1; i < a.length; i++) {
    const s = a[i];
    if (s[0] !== '-' || s.length < 2 || args.length) { args.push(s); continue; }
    for (let j = 1; j < s.length; j++) {
      const ch = s[j];
      if (!fl.includes(ch)) return x.err('command ' + c + ': unknown flag -' + ch);
      if ('tsp'.includes(ch)) { f[ch] = s.slice(j + 1) || a[++i]; if (f[ch] == null) return x.err('command ' + c + ': -' + ch + ' expects an argument'); break; }
      f[ch] = 1;
    }
  }
  const r = go(c, f, args, x);
  update(x.f);
  return r;
}
function go(c, f, args, x) {
  const inside = !!(x.p && x.p.w), p = inside ? x.p : server && best().cur.act, w = p && p.w, s = w && w.s;
  if (c === 'new-session') {
    if (inside && !f.d) return x.err(NEST);
    if (f.s && sfind(f.s)) return x.err('duplicate session: ' + f.s);
    const n = newSession(f.s, x.p ? x.p.cwd : HOMEN);
    return f.d ? 0 : attach(n);
  }
  if (c === 'attach-session') {
    if (inside) return x.err(NEST);
    const t = f.t != null ? sfind(f.t) : best();
    return !server ? x.err('no sessions') : t ? attach(t) : x.err("can't find session: " + f.t);
  }
  if (c === 'list-keys') {
    if (f.N && x.key) return modeKeys(p), 0;
    BIND.forEach(b => L(f.N ? (PFX + ' ' + b[0]).padEnd(12) + b[2] : 'bind-key ' + (b[3] ? '-r' : '  ') + ' -T prefix ' + b[0].padEnd(6) + b[1]));
    return 0;
  }
  if (!server) return x.err('no server running on ' + SOCK);
  switch (c) {
    case 'kill-server': [...server.list].forEach(t => killSession(t, 'server exited')); return 0;
    case 'kill-session': { const t = f.t != null ? sfind(f.t) : s; if (!t) return x.err("can't find session: " + f.t); killSession(t); return 0; }
    case 'list-sessions':
      server.list.forEach(t => L(t.name + ': ' + t.wins.length + ' windows (created ' + ctime(t.created) + ')' + (client && client.s === t ? ' (attached)' : '')));
      return 0;
    case 'detach-client': if (!client) return x.err('no current client'); client.s.used = Date.now(); leave('detached (from session ' + client.s.name + ')'); return 0;
    case 'new-window': newWindow(s, p.cwd); return 0;
    case 'split-window': { const e = splitw(w, f.h && !f.v, p.cwd, p); return e ? x.err(e) : 0; }
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
      if (t) pick(t);
      return 0;
    }
    case 'last-pane': if (!w.lastp) return x.err('no last pane'); pick(w.lastp); return 0;
    case 'select-window': {
      const v = String(f.t == null ? '' : f.t).replace(/^:?=?/, ''), t = s.wins.find(q => String(q.i) === v);
      if (!t) return x.err("can't find window: " + v);
      selw(t); return 0;
    }
    case 'next-window': case 'previous-window': {
      const n = s.wins.length, i = s.wins.indexOf(w);
      if (n < 2) return x.err('no ' + c.slice(0, -7) + ' window');
      selw(s.wins[(i + (c[0] === 'n' ? 1 : n - 1)) % n]); return 0;
    }
    case 'last-window': if (!s.last) return x.err('no last window'); selw(s.last); return 0;
    case 'resize-pane': if (f.Z && w.list.length > 1) { pick(p); w.zoom = !w.zoom; } return 0;
    case 'display-panes': if (client) setTimeout(displayPanes); return 0;
    case 'send-prefix': if (!p.alt && !p.mode && !p.busy) ctl(p, 'a'); return 0;
    case 'confirm-before': {
      const q = (f.p || "Confirm '" + args.join(' ') + "'? (y/n)").replace(/#([WPSI])/g, (_, k) => ({ W: name(w), P: w.list.indexOf(p), S: s.name, I: w.i })[k]);
      if (client) message(q, () => tc(args, Object.assign({}, x, { f: want() })));
      return 0;
    }
  }
  return 0;
}
// the pane next to the active one in a direction (wrapping round, like tmux); the most recently used of several
function near(w, d) {
  const A = w.act, H = d === 'L' || d === 'R';
  return w.list.filter(p => p !== A && (H ? p.y < A.y + A.sy && A.y < p.y + p.sy : p.x < A.x + A.sx && A.x < p.x + p.sx) && (
    d === 'L' ? (A.x ? p.x + p.sx + 1 === A.x : p.x + p.sx === GW) :
    d === 'R' ? (A.x + A.sx < GW ? p.x === A.x + A.sx + 1 : p.x === 0) :
    d === 'U' ? (A.y ? p.y + p.sy + 1 === A.y : p.y + p.sy === GH) :
    (A.y + A.sy < GH ? p.y === A.y + A.sy + 1 : p.y === 0))).sort((a, b) => b.used - a.used)[0];
}

// prefix ?: the bindings in the pane, in tmux's view mode (q closes)
function modeKeys(p) {
  if (p.mode) return;
  const e = attr(el('div', 'mode'), { tabindex: '-1', role: 'document', 'aria-label': 'tmux key bindings; q closes' }), list = el('div', 'ml'), ind = sp('ind');
  for (const b of BIND) list.append(el('div', 'l', (PFX + ' ' + b[0]).padEnd(12) + b[2]));
  e.append(list, ind);
  const fit = () => { ind.textContent = '[' + Math.round(list.scrollTop / cell.h) + '/' + Math.max(0, Math.round((list.scrollHeight - list.clientHeight) / cell.h)) + ']'; };
  list.addEventListener('scroll', fit, { passive: true });
  const m = p.mode = { el: e, fit, close() {
    const had = e.contains(D.activeElement);
    e.remove(); p.mode = null; p.el.classList.remove('md'); p.el.classList.toggle('alt', !!p.alt);
    if (!p.alt) p.el.scrollTop = p.el.scrollHeight;
    if (had) focusP(p);
  } };
  m.key = ev => {
    const k = ev.key, pg = Math.max(cell.h, list.clientHeight - cell.h);
    if (k === 'q' || k === 'Escape') m.close();
    else if (k === 'ArrowDown' || k === 'j') list.scrollTop += cell.h;
    else if (k === 'ArrowUp' || k === 'k') list.scrollTop -= cell.h;
    else if (k === 'PageDown' || k === ' ') list.scrollTop += pg;
    else if (k === 'PageUp') list.scrollTop -= pg;
    else if (k === 'g' || k === 'Home') list.scrollTop = 0;
    else if (k === 'G' || k === 'End') list.scrollTop = list.scrollHeight;
    else return k.length === 1 || k === 'Tab';
    return true;
  };
  p.el.append(e); p.el.classList.add('alt', 'md');
  p.el.scrollTop = 0;
  fit();
  focusP(p);
}

// prefix q: each pane's index in the middle of it, in tmux's block digits (active red, others blue) for a second;
// pressing a digit meanwhile selects that pane
const BIG = 'vhhhv 11111 v1vgv v1v1v hhv11 vgv1v vgvhv v1111 vhvhv vhv1v'.split(' ');
let dpt = 0, dpOn = false;
function displayPanes() {
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
  dpOn = true; dpt = setTimeout(hidePanes, 1000);
}
function hidePanes() { clearTimeout(dpt); dpOn = false; for (const e of scr.querySelectorAll('.dp')) e.remove(); }

/* keys */
let pfx = 0, rep = 0, ask = null;
// capture phase: the prefix and its binding never reach a prompt or a program
D.addEventListener('keydown', e => {
  const k = e.key;
  if (!client || e.isComposing || e.keyCode === 229 || /^(Shift|Control|Alt|Meta|AltGraph|CapsLock|Fn|OS)$/.test(k)) return;
  const ctrl = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
  const pk = ctrl ? (/^[ab]$/i.test(k) ? k.toLowerCase() : /^Key[AB]$/.test(e.code) && !/^[a-z]$/i.test(k) ? e.code[3].toLowerCase() : '') : '';
  const eat = () => { e.preventDefault(); e.stopPropagation(); };
  if (dpOn) { hidePanes(); if (/^\d$/.test(k)) { eat(); const t = client.s.cur.list[k]; if (t) { pick(t); update(want()); } return; } }
  if (client.msg) {
    const yes = ask;
    ask = null; client.msg = ''; drawStatus();
    if (yes) { eat(); if (k === 'y' || k === 'Y') yes(); return; }
  }
  if (pfx) {
    pfx = 0;
    if (pk) { eat(); const p = cur(); if (!p.alt && !p.mode && !p.busy) ctl(p, pk); return; }   // the prefix twice sends it on
    // with Ctrl, Alt or Cmd it is another key, and none is bound (tmux has no C-c, C-d or C-x); Ctrl+Alt is AltGr
    const b = !(e.metaKey || e.ctrlKey !== e.altKey) && BIND.find(b => b[0] === k.replace(/^Arrow/, ''));
    if (b) { eat(); tc(parse(b[1]).words, { p: cur(), key: 1, f: want(), err: m => (message(m), 1) }); rep = b[3] ? performance.now() + 500 : 0; }
    // an unbound key does nothing, but the browser keeps its own shortcuts: Cmd keys, paste, copy, function keys
    else if (!(e.metaKey || /^F\d/.test(k) || e.ctrlKey && (/^v$/i.test(k) || /^[cx]$/i.test(k) && String(getSelection())))) eat();
    return;
  }
  if (pk) { pfx = 1; eat(); return; }
  // bindings made with -r (the arrows) repeat without the prefix for 500 ms
  if (rep > performance.now() && /^Arrow/.test(k) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    eat(); tc(['select-pane', '-' + k[5]], { p: cur(), key: 1, f: want(), err: m => (message(m), 1) }); rep = performance.now() + 500; return;
  }
  rep = 0;
}, true);
// bubble phase: keys for a program on the alternate screen, or the first character typed away from the prompt
D.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
  const p = cur(), m = p.mode || p.alt, t = e.target;
  if (m) {
    if ((e.key === 'Enter' || e.key === ' ') && t.closest && t.closest('a')) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && m.key(e)) e.preventDefault();
    return;
  }
  if (t === p.inp || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1 && e.key !== ' ') focusP(p);
});
const unarm = () => { pfx = 0; rep = 0; };
D.addEventListener('pointerdown', unarm, true);
addEventListener('blur', unarm);
D.addEventListener('selectionchange', () => { const a = D.activeElement, e = a && a.tagName === 'INPUT' && a.closest('.pane'); if (e) queueDraw(e._p); });

/* mouse and touch (tmux's mouse mode): pressing in a pane selects it; a window in the status line selects that window */
function act(b, p) {
  if (p.mode || p.alt) {
    if (!b.closest('.keys')) return;
    (p.mode || p.alt).close();
    return setTimeout(() => act(b, p));
  }
  if (p.busy) return;
  if (b.dataset.fill) { setInput(p, b.dataset.fill); focusP(p); return; }
  const n = b._n, list = n ? (n.t === 'd' ? ['cd ' + quote(rel(n, p.cwd)), 'ls'] : [(n.t === 'l' ? 'open ' : 'cat ') + quote(rel(n, p.cwd))]) : [b.dataset.run];
  list.reduce((q, c) => q.then(() => submit(p, c)), Promise.resolve());
}
term.addEventListener('mousedown', e => {
  const pe = e.target instanceof Element && e.target.closest('.pane');
  if (pe && pe._p.w && pe._p !== pe._p.w.act) { pick(pe._p); refresh(); }
});
// on the terminal, not document: iOS only delivers taps to elements with their own click listener
term.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t.closest('.view, .mode')) return;
  const selected = String(getSelection() || '') !== '', wi = t.closest('[data-w]');
  if (wi) { const w = client && client.s.wins.find(w => String(w.i) === wi.dataset.w); if (w) { const f = want(); selw(w); update(f); } return; }
  const pe = t.closest('.pane'), p = pe ? pe._p : cur(), b = t.closest('.f, .x, [data-run]');
  if (b) {
    if (selected && !b.closest('.keys')) return;
    e.preventDefault();
    act(b, p);
    if (!coarse.matches) focusP(p);
    return;
  }
  if (!selected && pe && !t.closest('a, canvas, .ff-logo')) focusP(p);
});
// keep the on-screen keyboard (and focus) where it is when a suggestion is tapped
keys.addEventListener('mousedown', e => e.preventDefault());

/* live values, resize, preferences */
const fontsReady = D.fonts && D.fonts.load
  ? Promise.race([D.fonts.load('400 15px "Geist Mono"'), new Promise(r => setTimeout(r, 3000))]).catch(() => {})
  : Promise.resolve();
setInterval(() => { if (live) { const s = upStr(upMins()); if (live.up.textContent !== s) live.up.textContent = s; } }, 5000);
let rz = 0;
const resized = () => { if (!rz) rz = requestAnimationFrame(() => { rz = 0; viewport(); measure(); refresh(); if (live) live.res.textContent = innerWidth + 'x' + innerHeight; }); };
addEventListener('resize', resized);
if (window.visualViewport) { visualViewport.addEventListener('resize', resized); visualViewport.addEventListener('scroll', resized); }
const onMQ = (m, f) => m.addEventListener ? m.addEventListener('change', f) : m.addListener(f);   // Safari < 14
onMQ(lightq, () => { if (themeGet() === 'auto') themeChanged(); });
onMQ(rmq, () => { if (live && live.inst) try { live.inst.setReducedMotion(rmq.matches); } catch (e) {} });

const pwin = el('div', 'win'), plain = mkPane(HOMEN);
plain.el.classList.add('act'); pwin.append(plain.el); scr.append(pwin);
P = plain;
renderPrompt(plain); draw(plain);
viewport(); measure();
// the plain shell waits for the tmux client started at login
plain.busy = true; plain.cmd.classList.add('busy');
login().then(v => done(plain, v));
themeChanged();
tick();
fontsReady.then(() => {
  measure(); refresh();
  if (D.fonts && D.fonts.load) D.fonts.load('400 15px "Geist Mono"', '─').catch(() => {});
});
} catch (e) {
  root.classList.remove('js');
  throw e;
}
})();
