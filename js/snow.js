// Snow drawn as text characters across the whole terminal, falling behind the command buttons and the status line.
import { snow, rmq } from './base.js';

const DENSITY = 0.012, FRAME_MS = 25, MAX_DPR = 3, FONT_SCALE = 0.45, LINE_HEIGHT = 1.15, TAU = Math.PI * 2;
const ICE = [228, 234, 246];
const flakes = Array.from({ length: 900 }, () => ({ x: Math.random(), y: Math.random(), fall: 3 + 6.7 * Math.random(), seed: Math.random(), glyph: ".'.*"[Math.floor(Math.random() * 4)] }));

export function startSnow() {
  const ctx = snow.getContext('2d'), style = getComputedStyle(snow);
  let last = 0;
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000, w = snow.clientWidth, h = snow.clientHeight, dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    last = now;
    if (!w || !h) return;
    if (snow.width !== Math.round(w * dpr)) snow.width = Math.round(w * dpr);
    if (snow.height !== Math.round(h * dpr)) snow.height = Math.round(h * dpr);
    const size = parseFloat(style.fontSize) * FONT_SCALE, cellH = size * LINE_HEIGHT;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `bold ${size}px ${style.fontFamily}`;
    ctx.textBaseline = 'top';
    const cellW = ctx.measureText('M').width || size * 0.6, count = rmq.matches ? 0 : Math.min(flakes.length, (w * h * DENSITY) / (cellW * cellH));
    for (let i = 0; i < count; i++) {
      const flake = flakes[i], shade = 0.55 + 0.3 * flake.seed + 0.15 * Math.sin(t * 3 + flake.seed * 40);
      flake.y = (flake.y + (flake.fall * cellH * dt) / h) % 1;
      const x = flake.x * w + 1.8 * cellH * Math.sin(t * 0.8 + flake.seed * TAU);
      ctx.fillStyle = `rgb(${ICE.map(channel => Math.round(channel * shade))})`;
      ctx.fillText(flake.glyph, Math.floor(x / cellW) * cellW, Math.floor((flake.y * h) / cellH) * cellH);
    }
  });
}
