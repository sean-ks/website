// fastfetch: the system summary beside the Christmas tree logo, which is live in whichever pane printed it last and frozen in the rest.
import { el, sp, attr, rmq, dtf, SITE, USER, HOST } from './base.js';
import { P, liveFetch, setLiveFetch } from './state.js';
import { DOC_TIME } from './fs.js';
import { cell, measure, themeEff, fontsReady } from './metrics.js';
import { sizeLogos } from './logo.js';
import { refresh } from './screen.js';

const treeLoaded = import('./tree.js').catch(e => { setTimeout(() => { throw e; }); return null; });
const UPDATED = dtf({ month: 'short', day: 'numeric', year: 'numeric' });

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
  kv('Last Updated', UPDATED.format(DOC_TIME));
  f.res = kv('Resolution', innerWidth + 'x' + innerHeight, 1);
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
  try { f.inst = tree.createTree(cv, f.c * cell.w, f.r * cell.h); f.inst.calm(rmq.matches); } catch (e) { cv.remove(); }
}
export function killLive() {
  const f = liveFetch;
  setLiveFetch(null);
  if (f && f.inst) f.inst.stop();
}
export function clear() { if (liveFetch && liveFetch.p === P) killLive(); P.out.textContent = ''; }
