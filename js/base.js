// Page elements, media queries, DOM helpers and the machine's fixed names.
export const D = document, root = D.documentElement, SITE = window.SITE || {};
const $ = id => D.getElementById(id);
export const el = (tag, cls, txt) => { const e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
export const sp = (cls, txt) => el('span', cls, txt);
export const attr = (e, o) => { for (const k in o) e.setAttribute(k, o[k]); return e; };
const mq = q => matchMedia(q);
export const coarse = mq('(pointer: coarse)'), rmq = mq('(prefers-reduced-motion: reduce)'), lightq = mq('(prefers-color-scheme: light)');
export const onMQ = (m, f) => m.addEventListener ? m.addEventListener('change', f) : m.addListener(f);
export const term = $('term'), scr = $('scr'), bar = $('status'), keys = $('keys'), note = $('note');
export const USER = SITE.user, HOST = SITE.host, HOME = SITE.home, KERNEL = '7.2.1-arch1-1';
const TZ = 'America/New_York';
export const SOCK = '/tmp/tmux-1000/default';
export const dtf = o => new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, o));
export const parts = (f, d) => Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
export function newTab(href) {
  const a = el('a');
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.click();
}
