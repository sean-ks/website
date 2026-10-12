// GlyphRenderer: create(canvas, { cols, rows, cellW, cellH, font, colors, reducedMotion }) draws a raymarched 3D shape as live terminal glyphs, or returns null without WebGL.
import { RAYS_X, RAYS_Y } from './shaders.js';
import { setupGL, freeGL, target } from './gl.js';
import { drawAtlas } from './atlas.js';
import { SHAPES, kick, setShape, frame, advance, onDown, onMove, onUp } from './loop.js';
import { YAW0, PITCH0 } from './pose.js';

const W = window, D = document;
const MAX_DPR = 3;
const ratio = () => Math.min(W.devicePixelRatio || 1, MAX_DPR);

function rgb(s, fb) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(s || '').trim()), n = m && parseInt(m[1], 16);
  return m ? [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] : fb;
}
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function legibleOn(c, bg, fg, min) {
  let t = 0, out = c;
  while (contrast(out, bg) < min && t < 1) { t += 0.1; out = mix3(c, fg, t); }
  return out;
}

export function create(canvas, opts) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  try { return build(canvas, opts || {}); } catch (e) { return null; }
}

function build(canvas, opts) {
  const attrs = { antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
  let gl = null;
  try { gl = canvas.getContext('webgl', attrs); } catch (e) { gl = null; }
  if (!gl || gl.isContextLost()) return null;

  const r = {
    canvas, gl, api: null, onFrame: null,
    cols: Math.max(1, opts.cols | 0 || 40), rows: Math.max(1, opts.rows | 0 || 19),
    cellW: opts.cellW > 0 ? +opts.cellW : 9, cellH: opts.cellH > 0 ? +opts.cellH : 21,
    font: opts.font ? String(opts.font) : '400 15px monospace',
    reduced: !!opts.reducedMotion,
    dpr: 1, w: 1, h: 1, sw: 1, sh: 1,
    res: null, ok: false, dead: false, atlasKey: '',
    dim: [0.2, 0.33, 0.42], accent: [0.09, 0.58, 0.82], bright: [0.62, 0.85, 0.96],
    raf: 0, dirty: true, visible: true, lastDraw: 0, lastT: 0,
    cur: 0, prev: 0, morphT: -1e9, idle: 0,
    yaw: YAW0, pitch: PITCH0, vy: 0, vp: 0, accX: 0, accY: 0,
    drag: false, dragId: -1, moved: 0, lx: 0, ly: 0, dragMouse: false,
    rotation: new Float32Array(9),
  };
  r.onFrame = t => frame(r, t);
  let mqDpr = null, io = null;
  const down = e => onDown(r, e), move = e => onMove(r, e), up = e => onUp(r, e);
  const ons = [[canvas, 'pointerdown', down], [canvas, 'pointermove', move], [canvas, 'pointerup', up], [canvas, 'pointercancel', up],
    [canvas, 'lostpointercapture', up], [canvas, 'webglcontextlost', onLost], [canvas, 'webglcontextrestored', onRestored],
    [D, 'visibilitychange', onVisibility], [W, 'resize', onResize]];

  function layoutOnGrid() {
    r.dpr = ratio();
    const cssW = r.cols * r.cellW, cssH = r.rows * r.cellH;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    r.w = Math.max(1, Math.round(cssW * r.dpr));
    r.h = Math.max(1, Math.round(cssH * r.dpr));
    if (canvas.width !== r.w) canvas.width = r.w;
    if (canvas.height !== r.h) canvas.height = r.h;
    r.sw = Math.ceil(r.w / r.cols); r.sh = Math.ceil(r.h / r.rows);
    if (!r.ok) return true;
    const complete = target(gl, r.res.tScene, r.res.fScene, r.cols * RAYS_X, r.rows * RAYS_Y) && target(gl, r.res.tGlyph, r.res.fGlyph, r.cols, r.rows);
    drawAtlas(r);
    r.dirty = true;
    kick(r);
    return complete;
  }
  function watchDpr() {
    if (mqDpr) mqDpr.removeEventListener('change', onDpr);
    mqDpr = null;
    try { mqDpr = W.matchMedia('(resolution: ' + (W.devicePixelRatio || 1) + 'dppx)'); mqDpr.addEventListener('change', onDpr); } catch (e) { mqDpr = null; }
  }
  function onDpr() {
    if (ratio() !== r.dpr) layoutOnGrid();
    watchDpr();
  }
  function onResize() { if (ratio() !== r.dpr) onDpr(); }
  function setColors(c) {
    c = c || {};
    const bg = rgb(c.bg, [0.05, 0.07, 0.09]), fg = rgb(c.fg, [0.82, 0.84, 0.87]);
    r.dim = legibleOn(rgb(c.dim, r.dim), bg, fg, 2.2);
    r.accent = legibleOn(rgb(c.accent, r.accent), bg, fg, 3);
    r.bright = legibleOn(rgb(c.bright, r.bright), bg, fg, 3);
    r.dirty = true;
    kick(r);
  }
  function onVisibility() { r.lastT = 0; if (!D.hidden) kick(r); }
  function onLost(e) {
    e.preventDefault();
    r.ok = false; r.res = null;
    if (r.raf) { W.cancelAnimationFrame(r.raf); r.raf = 0; }
  }
  function onRestored() {
    if (r.dead) return;
    try {
      setupGL(r);
      r.ok = true;
      if (!layoutOnGrid()) throw new Error('fbo');
    } catch (err) { r.ok = false; freeGL(r); }
  }
  function onFonts() { if (r.ok && !r.dead) { drawAtlas(r); kick(r); } }

  const api = r.api = {
    resize(c, rw, cw, ch, f) {
      if (r.dead) return;
      if (c > 0) r.cols = c | 0 || r.cols;
      if (rw > 0) r.rows = rw | 0 || r.rows;
      if (cw > 0) r.cellW = +cw;
      if (ch > 0) r.cellH = +ch;
      if (f) r.font = String(f);
      layoutOnGrid();
      if (f && D.fonts) { try { D.fonts.load(r.font).then(onFonts, () => {}); } catch (e) {} }
    },
    setColors(c) { if (!r.dead) setColors(c); },
    setReducedMotion(v) {
      r.reduced = !!v;
      if (r.reduced) { r.vy = r.vp = 0; r.morphT = -1e9; }
      r.lastT = 0; r.dirty = true; kick(r);
    },
    next(step) {
      if (r.dead) return;
      r.idle = 0;
      setShape(r, r.cur + (step === undefined ? 1 : step | 0));
    },
    get shape() { return SHAPES[r.cur]; },
    onshape: null,
    destroy() {
      if (r.dead) return;
      r.dead = true;
      if (r.raf) W.cancelAnimationFrame(r.raf);
      r.raf = 0;
      for (const [t, e, f] of ons) t.removeEventListener(e, f);
      if (mqDpr) mqDpr.removeEventListener('change', onDpr);
      if (D.fonts) D.fonts.removeEventListener('loadingdone', onFonts);
      if (io) io.disconnect();
      canvas.style.cursor = '';
      if (r.ok && !gl.isContextLost()) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      freeGL(r);
      r.ok = false;
      const releaseNowNotAtGC = gl.isContextLost() ? null : gl.getExtension('WEBGL_lose_context');
      if (releaseNowNotAtGC) releaseNowNotAtGC.loseContext();
    },
  };

  try {
    setupGL(r);
    r.ok = true;
    setColors(opts.colors);
    if (!layoutOnGrid()) throw new Error('fbo');
  } catch (e) {
    r.ok = false;
    freeGL(r);
    throw e;
  }
  advance(r, 0, 0, false);

  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  for (const [t, e, f] of ons) t.addEventListener(e, f);
  watchDpr();
  if (D.fonts) {
    D.fonts.addEventListener('loadingdone', onFonts);
    try { D.fonts.load(r.font).then(onFonts, () => {}); } catch (e) {}
  }
  if (W.IntersectionObserver) {
    io = new IntersectionObserver(es => {
      const v = es[es.length - 1].isIntersecting;
      if (v !== r.visible) { r.visible = v; r.lastT = 0; if (v) { r.dirty = true; kick(r); } }
    });
    io.observe(canvas);
  }
  r.dirty = true;
  kick(r);
  return api;
}
