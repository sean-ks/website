// Character cell size, the client area in cells, the colour theme and the terminal font.
import { D, root, el, sp, attr, term, scr, lightq } from './base.js';
import { liveFetch } from './state.js';

export const cell = { w: 9, h: 21, font: '400 15px "Geist Mono", monospace' };
const probe = sp('', '0'.repeat(64)), probeBox = attr(el('div', 'probe'), { 'aria-hidden': 'true' });
export function mountProbe() { probeBox.append(probe); term.append(probeBox); }
export function measure() {
  const w = probe.getBoundingClientRect().width / 64, cs = getComputedStyle(scr);
  if (w > 0) cell.w = w;
  cell.h = parseFloat(cs.lineHeight) || cell.h;
  cell.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
}

export let GW = 80, GH = 24, keyboardRows = 0;
export function viewport() {
  const v = window.visualViewport;
  if (!v || v.scale > 1.01) return;
  term.style.height = v.height + 'px'; term.style.top = v.offsetTop + 'px';
}
export function grid() {
  const r = scr.getBoundingClientRect();
  GW = Math.max(1, Math.floor(r.width / cell.w + 0.01));
  GH = Math.max(1, Math.floor(r.height / cell.h + 0.01));
  keyboardRows = Math.max(0, Math.round((probeBox.offsetHeight - term.offsetHeight) / cell.h));
}

const BG = { dark: '#0d0e10', light: '#f6f5f0' };
export const themeGet = () => root.getAttribute('data-theme') || 'auto';
export const themeEff = () => { const t = themeGet(); return t !== 'auto' ? t : lightq.matches ? 'light' : 'dark'; };
export function colors() {
  const cs = getComputedStyle(root), g = k => cs.getPropertyValue('--' + k).trim();
  return { bg: g('bg'), dim: g('dim'), fg: g('fg'), accent: g('accent'), bright: g('bright') };
}
export function themeChanged() {
  const t = themeGet();
  for (const m of D.querySelectorAll('meta[name="theme-color"]')) m.content = t !== 'auto' ? BG[t] : /light/.test(m.media) ? BG.light : BG.dark;
  if (liveFetch) { liveFetch.th.textContent = themeEff(); if (liveFetch.inst) try { liveFetch.inst.setColors(colors()); } catch (e) {} }
}
export function setTheme(t) {
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { if (t === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', t); } catch (e) {}
  themeChanged();
}

export const fontsReady = D.fonts && D.fonts.load
  ? Promise.race([D.fonts.load('400 15px "Geist Mono"'), new Promise(r => setTimeout(r, 3000))]).catch(() => {})
  : Promise.resolve();
