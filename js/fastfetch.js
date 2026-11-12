// fastfetch: the system summary beside the Christmas tree logo, which is live in whichever pane printed it last and frozen in the rest.
import { el, sp, attr, rmq, snow, SITE, USER, HOST } from './base.js';
import { P, liveFetch, setLiveFetch } from './state.js';
import { cell, measure, themeEff, fontsReady } from './metrics.js';
import { sizeLogos } from './logo.js';
import { refresh } from './screen.js';

const treeLoaded = import('./tree.js').catch(e => { setTimeout(() => { throw e; }); return null; });
let gpu;
export const upMins = () => Math.floor(performance.now() / 60000);
export function upStr(m, unit = 'min') {
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
function gpuName() {
  try {
    const gl = el('canvas').getContext('webgl'), lose = gl.getExtension('WEBGL_lose_context');
    let s = gl.getParameter(gl.RENDERER) || '';
    if (/^(WebKit WebGL|Mozilla)$/.test(s)) { const x = gl.getExtension('WEBGL_debug_renderer_info'); s = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; }
    if (lose) lose.loseContext();
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

const infoWidth = f => Math.max(...[...f.info.children].map(d => d.classList.contains('cb') ? 24 : d.textContent.length));
const PHOTO_ROWS = 8;
export function fastfetch() {
  killLive();
  const ff = el('div', 'ff'), logo = attr(el('div', 'ff-logo'), { role: 'img', 'aria-label': 'Logo: a Christmas tree drawn with text characters.' }), info = el('div', 'ff-info');
  ff.append(logo, info);
  const line = (...a) => { const d = el('div', 'l'); d.append(...a); info.append(d); return d; };
  const kv = (k, v, quiet) => { const s = sp('', v); if (quiet) s.setAttribute('aria-live', 'off'); line(sp('k', k), ': ', s); return s; };
  line(sp('k', USER), '@', sp('k', HOST));
  line('-'.repeat(USER.length + HOST.length + 1));
  kv('OS', 'Arch Linux x86_64');
  for (const [k, v] of SITE.fetch || []) kv(k, v);
  const f = { ff, logo, info, p: P };
  f.up = kv('Uptime', upStr(upMins()), 1);
  f.res = kv('Resolution', innerWidth + 'x' + innerHeight, 1);
  kv('Terminal', browser());
  if (gpu !== '') { const s = kv('GPU', gpu || '', 1); if (!gpu) { s.parentNode.classList.add('pend'); f.gpu = s; } }
  kv('Locale', navigator.language || 'en-US');
  f.th = kv('Theme', themeEff(), 1);
  const pic = Object.values(SITE.fs).find(v => v && v.image);
  if (pic) info.append(f.photo = attr(el('img', 'ff-photo'), { src: pic.link, alt: pic.image }));
  line();
  for (const b of [0, 8]) {
    const d = line();
    d.className = 'cb'; d.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 8; i++) { const s = el('span'); s.style.background = 'var(--c' + (b + i) + ')'; d.append(s); }
  }
  P.out.append(ff);
  ff._f = f; setLiveFetch(f);
  f.iw = infoWidth(f); f.n = info.childElementCount + (f.photo ? PHOTO_ROWS - 1 : 0);
  sizeLogos([f]);
  requestAnimationFrame(() => setTimeout(() => Promise.all([fontsReady, treeLoaded]).then(([, tree]) => { if (liveFetch === f) { measure(); refresh(); mountTree(f, tree); } }), 0));
}
function mountTree(f, tree) {
  const cv = attr(el('canvas'), { 'aria-hidden': 'true' });
  f.logo.append(cv);
  try { f.inst = tree.createTree(cv, snow, f.c * cell.w, f.r * cell.h); f.inst.calm(rmq.matches); } catch (e) { cv.remove(); }
  if (gpu === undefined) gpu = gpuName();
  if (f.gpu) {
    if (gpu) { f.gpu.textContent = gpu; f.gpu.parentNode.classList.remove('pend'); } else f.gpu.parentNode.remove();
    f.gpu = null; f.iw = infoWidth(f); sizeLogos([f]);
  }
}
export function killLive() {
  const f = liveFetch;
  setLiveFetch(null);
  if (f && f.inst) f.inst.stop();
}
export function clear() { if (liveFetch && liveFetch.p === P) killLive(); P.out.textContent = ''; }
