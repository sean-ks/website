// The renderer's frame loop (spin, shape morphs and the three draw passes, running only while something changes) and its pointer drag.
import { RAYS_X, RAYS_Y } from './shaders.js';
import { GLYPHS } from './atlas.js';
import { PITCH0 } from './pose.js';

const W = window, D = document;
export const SHAPES = ['torus', 'cube', 'octahedron', 'cylinder', 'pyramid'];
const SPIN = 0.3, TAU = Math.PI * 2;
const MORPH_MS = 650, NEXT_SHAPE_IDLE_MS = 12000, SPIN_FRAME_MS = 25, CLICK_MAX_MOVE = 6;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function kick(r) { if (!r.raf && r.ok && !r.dead) r.raf = W.requestAnimationFrame(r.onFrame); }
const spinning = r => !r.reduced && r.visible && !D.hidden;

export function setShape(r, i) {
  const n = SHAPES.length, next = ((i % n) + n) % n;
  if (next === r.cur) return;
  r.prev = r.cur; r.cur = next;
  r.morphT = r.reduced ? -1e9 : performance.now();
  r.idle = 0;
  r.dirty = true;
  kick(r);
  const f = r.api.onshape;
  if (typeof f === 'function') {
    try { f(SHAPES[r.cur]); } catch (e) { setTimeout(() => { throw e; }, 0); }
  }
}

export function frame(r, t) {
  r.raf = 0;
  if (!r.ok || r.dead) return;
  const moving = spinning(r), input = r.accX !== 0 || r.accY !== 0, morphing = t - r.morphT < MORPH_MS;
  if (!r.dirty && !input && !morphing && !(moving && !r.drag)) {
    if (moving) r.raf = W.requestAnimationFrame(r.onFrame); else r.lastT = 0;
    return;
  }
  if (!r.dirty && !input && t - r.lastDraw < SPIN_FRAME_MS) { r.raf = W.requestAnimationFrame(r.onFrame); return; }
  const dt = r.lastT ? Math.min(0.1, (t - r.lastT) / 1000) : 1 / 30;
  r.lastT = t;
  advance(r, t, dt, moving);
  draw(r, t);
  r.lastDraw = t;
  r.dirty = false;
  if (moving || t - r.morphT < MORPH_MS) r.raf = W.requestAnimationFrame(r.onFrame);
  else r.lastT = 0;
}

export function advance(r, t, dt, moving) {
  if (r.accX || r.accY) {
    const ay = r.accX * 0.01, ap = r.accY * 0.007;
    r.yaw += ay;
    r.pitch = clamp(r.pitch + ap, -1.25, 1.25);
    if (moving) { r.vy = ay / Math.max(dt, 0.008); r.vp = ap / Math.max(dt, 0.008); }
    r.accX = r.accY = 0;
  } else if (moving && !r.drag) {
    r.yaw += (SPIN + r.vy) * dt;
    r.pitch = clamp(r.pitch + r.vp * dt, -1.25, 1.25);
    const k = Math.exp(-dt * 2.4);
    r.vy *= k; r.vp *= k;
    r.pitch += (PITCH0 + Math.sin(t * 0.00027) * 0.16 - r.pitch) * (1 - Math.exp(-dt * 0.6));
    r.idle += dt * 1000;
    if (r.idle > NEXT_SHAPE_IDLE_MS) setShape(r, r.cur + 1);
  }
  r.yaw %= TAU;
  const M = r.rotation, cy = Math.cos(r.yaw), sy = Math.sin(r.yaw), cx = Math.cos(r.pitch), sx = Math.sin(r.pitch);
  M[0] = cy; M[1] = sx * sy; M[2] = -cx * sy;
  M[3] = 0; M[4] = cx; M[5] = sx;
  M[6] = sy; M[7] = -sx * cy; M[8] = cx * cy;
}

function draw(r, t) {
  const { gl, res, cols, rows, cellW, cellH, w, h } = r, m = clamp((t - r.morphT) / MORPH_MS, 0, 1);
  let p = res.scene;
  gl.bindFramebuffer(gl.FRAMEBUFFER, res.fScene);
  gl.viewport(0, 0, cols * RAYS_X, rows * RAYS_Y);
  gl.useProgram(p.p);
  gl.uniform2f(p.samplePx, cellW / RAYS_X, cellH / RAYS_Y);
  gl.uniform2f(p.boxPx, cols * cellW, rows * cellH);
  gl.uniformMatrix3fv(p.rotation, false, r.rotation);
  gl.uniform3f(p.shapeMorph, r.cur, r.prev, m);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  p = res.glyph;
  gl.bindFramebuffer(gl.FRAMEBUFFER, res.fGlyph);
  gl.viewport(0, 0, cols, rows);
  gl.useProgram(p.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, res.tScene);
  gl.uniform1i(p.scene, 0);
  gl.uniform2f(p.sampleGrid, cols * RAYS_X, rows * RAYS_Y);
  gl.uniform2f(p.cellGrid, cols, rows);
  gl.uniform2f(p.cellPx, cellW, cellH);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  p = res.comp;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(p.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, res.tGlyph);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, res.tAtlas);
  gl.uniform1i(p.glyphs, 0); gl.uniform1i(p.atlas, 1);
  gl.uniform2f(p.cellGrid, cols, rows);
  gl.uniform2f(p.cellDevicePx, w / cols, h / rows);
  gl.uniform2f(p.slotPx, r.sw, r.sh);
  gl.uniform1f(p.canvasH, h);
  gl.uniform1f(p.glyphCount, GLYPHS.length);
  gl.uniform3f(p.dimColor, r.dim[0], r.dim[1], r.dim[2]);
  gl.uniform3f(p.accentColor, r.accent[0], r.accent[1], r.accent[2]);
  gl.uniform3f(p.brightColor, r.bright[0], r.bright[1], r.bright[2]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function onDown(r, e) {
  if (r.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  r.drag = true; r.dragId = e.pointerId; r.moved = 0;
  r.dragMouse = e.pointerType === 'mouse';
  r.lx = e.clientX; r.ly = e.clientY; r.vy = r.vp = 0; r.idle = 0;
  if (r.dragMouse) e.preventDefault();
  try { r.canvas.setPointerCapture(e.pointerId); } catch (err) {}
  r.canvas.style.cursor = 'grabbing';
}
export function onMove(r, e) {
  if (!r.drag || e.pointerId !== r.dragId) return;
  const dx = e.clientX - r.lx, dy = e.clientY - r.ly;
  r.lx = e.clientX; r.ly = e.clientY;
  r.moved += Math.abs(dx) + Math.abs(dy);
  r.accX += dx;
  if (r.dragMouse) r.accY += dy;
  r.idle = 0;
  kick(r);
}
export function onUp(r, e) {
  if (!r.drag || e.pointerId !== r.dragId) return;
  const click = e.type === 'pointerup' && r.moved < CLICK_MAX_MOVE;
  r.drag = false; r.dragId = -1;
  r.canvas.style.cursor = 'grab';
  try { r.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  r.idle = 0;
  if (click) setShape(r, r.cur + 1);
  kick(r);
}
