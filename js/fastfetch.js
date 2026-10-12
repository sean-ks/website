// fastfetch: the system summary beside the logo, and the one live glyph renderer, in whichever pane printed it last.
import { el, sp, attr, rmq, SITE, USER, HOST } from './base.js';
import { P, liveFetch, setLiveFetch } from './state.js';
import { cell, measure, colors, themeEff, fontsReady } from './metrics.js';
import { sizeLogos } from './logo.js';
import { refresh } from './screen.js';

const rendererLoaded = import('./renderer/index.js').catch(e => { setTimeout(() => { throw e; }); return null; });
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
function gpuNameFromRendererContext(cv) {
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

const LOGO = 'Logo: a torus drawn with text characters.';
const infoWidth = f => Math.max(...[...f.info.children].map(d => d.classList.contains('cb') ? 24 : d.textContent.length));
export function fastfetch() {
  killLive();
  const ff = el('div', 'ff'), logo = el('div', 'ff-logo'), art = el('pre', 'ff-art'), info = el('div', 'ff-info');
  attr(logo, { role: 'img', 'aria-label': LOGO }); art.setAttribute('aria-hidden', 'true');
  logo.append(art); ff.append(logo, info);
  const line = (...a) => { const d = el('div', 'l'); d.append(...a); info.append(d); return d; };
  const kv = (k, v, quiet) => { const s = sp('', v); if (quiet) s.setAttribute('aria-live', 'off'); line(sp('k', k), ': ', s); return s; };
  line(sp('k', USER), '@', sp('k', HOST));
  line('-'.repeat(USER.length + HOST.length + 1));
  kv('OS', 'Arch Linux x86_64');
  for (const [k, v] of SITE.fetch || []) kv(k, v);
  const f = { ff, logo, art, info, p: P };
  f.up = kv('Uptime', upStr(upMins()), 1);
  f.res = kv('Resolution', innerWidth + 'x' + innerHeight, 1);
  kv('Terminal', browser());
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
  ff._f = f; setLiveFetch(f);
  f.iw = infoWidth(f); f.n = info.childElementCount;
  sizeLogos([f]);
  requestAnimationFrame(() => setTimeout(() => Promise.all([fontsReady, rendererLoaded]).then(([, GlyphRenderer]) => { if (liveFetch === f) { measure(); refresh(); mountRenderer(f, GlyphRenderer); } }), 0));
}
function mountRenderer(f, GlyphRenderer) {
  const cv = attr(el('canvas'), { 'aria-hidden': 'true' });
  let inst = null;
  if (GlyphRenderer) {
    f.logo.append(cv);
    try { inst = GlyphRenderer.create(cv, { cols: f.c, rows: f.r, cellW: cell.w, cellH: cell.h, font: cell.font, colors: colors(), reducedMotion: rmq.matches }); } catch (e) {}
  }
  if (inst) {
    f.inst = inst; f.cv = cv;
    const say = name => f.logo.setAttribute('aria-label', 'Logo: a ' + (rmq.matches ? '' : 'rotating ') + (name || 'shape') + ' drawn with text characters.');
    say(inst.shape);
    inst.onshape = say;
    const show = on => { cv.style.visibility = on ? '' : 'hidden'; f.logo.classList.toggle('gl', on); };
    const showAfterTwoFrames = () => requestAnimationFrame(() => requestAnimationFrame(() => { if (f.inst) show(true); }));
    cv.addEventListener('webglcontextlost', () => show(false));
    cv.addEventListener('webglcontextrestored', showAfterTwoFrames);
    showAfterTwoFrames();
  } else cv.remove();
  if (gpu === undefined) gpu = inst ? gpuNameFromRendererContext(cv) : '';
  if (f.gpu) {
    if (gpu) { f.gpu.textContent = gpu; f.gpu.parentNode.classList.remove('pend'); } else f.gpu.parentNode.remove();
    f.gpu = null; f.iw = infoWidth(f); sizeLogos([f]);
  }
}
export function killLive() {
  const f = liveFetch;
  setLiveFetch(null);
  if (!f || !f.inst) return;
  try { f.inst.destroy(); } catch (e) {}
  f.inst = null; f.cv.remove();
  f.logo.classList.remove('gl');
  f.logo.setAttribute('aria-label', LOGO);
}
export function clear() { if (liveFetch && liveFetch.p === P) killLive(); P.out.textContent = ''; }
