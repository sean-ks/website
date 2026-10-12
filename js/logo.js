// The fastfetch logo: a static ASCII torus in the renderer's first pose, and sizing each logo box to its pane.
import { sp } from './base.js';
import { cell, GH, keyboardRows } from './metrics.js';
import { RAMP, YAW0, PITCH0 } from './renderer/pose.js';

let memo = {};
function torus(c, r) {
  const key = [c, r, cell.w, cell.h].join();
  if (memo.k === key) return memo.g;
  const X = c * 2, Y = r * 3, W = c * cell.w, H = r * cell.h, m = Math.min(W, H) * 1.85, z = new Float32Array(X * Y), li = new Float32Array(X * Y), g = new Uint8Array(c * r);
  const cy = Math.cos(YAW0), sy = Math.sin(YAW0), cx = Math.cos(PITCH0), sx = Math.sin(PITCH0), a1 = sx * sy, a2 = cx * sy, a3 = sx * cy, a4 = cx * cy;
  for (let t = 0; t < 6.2832; t += 0.05) {
    const ct = Math.cos(t), st = Math.sin(t), R = 0.92 + 0.4 * ct, q = 0.4 * st;
    for (let u = 0; u < 6.2832; u += 0.012) {
      const cu = Math.cos(u), su = Math.sin(u), a = R * cu, b = R * su, e = ct * cu, f = ct * su;
      const x = cy * a + a1 * b - a2 * q, y = cx * b + sx * q, d = sy * a - a3 * b + a4 * q + 6;
      const n0 = cy * e + a1 * f - a2 * st, n1 = cx * f + sx * st, n2 = sy * e - a3 * f + a4 * st;
      const facing = (n0 * x + n1 * y + n2 * d) / Math.sqrt(x * x + y * y + d * d);
      if (facing > 0) continue;
      const i = Math.floor((W / 2 + m * x / d) / cell.w * 2), j = Math.floor((H / 2 - m * y / d) / cell.h * 3), k = j * X + i;
      if (i < 0 || j < 0 || i >= X || j >= Y || (z[k] && z[k] < d)) continue;
      const dif = Math.pow(Math.min(1, Math.max(0, (-0.36 * n0 + 0.72 * n1 - 0.59 * n2) * 0.5 + 0.5)), 1.6) + 0.12 * Math.max(0, 0.59 * n0 - 0.49 * n1 - 0.64 * n2);
      z[k] = d; li[k] = Math.min(1, 0.04 + 0.9 * dif + 0.1 * (1 + facing) ** 3);
    }
  }
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
    let l = 0, h = 0;
    for (let b = 0; b < 3; b++) for (let a = 0; a < 2; a++) { const k = (j * 3 + b) * X + i * 2 + a; if (z[k]) { l += li[k]; h++; } }
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
      const v = g[j * c + i], colour = v >> 4;
      if (colour !== k) { flush(); k = colour; }
      run += RAMP[v & 15];
    }
    flush();
    if (j < r - 1) art.append('\n');
  }
}
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
    drawArt(f);
    if (f.inst) try { f.inst.resize(c, r, cell.w, cell.h, cell.font); } catch (e) {}
  }
  const h = list.map(f => f.info.offsetHeight);
  list.forEach((f, i) => f.ff.classList.toggle('sp', f.stack || h[i] > (f.r - 1) * cell.h));
}
export const fetchBlocks = p => [...p.out.querySelectorAll('.ff')].map(e => e._f);
