// Sizes each fastfetch logo box, where the Christmas tree is drawn, to its pane.
import { cell, GH, keyboardRows } from './metrics.js';

export function sizeLogos(list) {
  for (const f of list) {
    const p = f.p, W = p.sx, H = p.sy + (p.y + p.sy >= GH ? keyboardRows : 0);
    let c, r, g = 0;
    f.stack = W < 37 + f.iw;
    if (!f.stack) {
      const wide = W >= 46 + f.iw;
      g = wide ? 4 : 3;
      c = wide ? Math.min(76, Math.max(42, Math.round(W * 0.42)), W - g - f.iw) : 34;
      r = Math.min(Math.round(c * cell.w / cell.h), Math.max(8, H - 3));
      c = Math.min(c, Math.round(r * cell.h / cell.w));
    } else {
      r = Math.max(8, Math.min(13, H - f.n - 5));
      c = Math.min(32, W, Math.round(r * cell.h / cell.w));
    }
    f.ff.classList.toggle('stack', f.stack);
    for (const [k, v] of [['c', c], ['r', r], ['g', g]]) f.ff.style.setProperty('--' + k, v);
    const key = [c, r, cell.w, cell.h, cell.font].join();
    if (key === f.key) continue;
    f.key = key; f.c = c; f.r = r;
    if (f.inst) f.inst.resize(c * cell.w, r * cell.h);
  }
  const h = list.map(f => f.info.offsetHeight);
  list.forEach((f, i) => f.ff.classList.toggle('sp', f.stack || h[i] > (f.r - 1) * cell.h));
}
export const fetchBlocks = p => [...p.out.querySelectorAll('.ff')].map(e => e._f);
