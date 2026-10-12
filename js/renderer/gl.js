// WebGL resources for the renderer, recorded in r.res as they are made so a half-built set can still be freed.
import { VS, FS_SCENE, FS_GLYPH, FS_COMP } from './shaders.js';

function linkAllThenCheck(r, list) {
  const { gl, res } = r;
  const vs = gl.createShader(gl.VERTEX_SHADER);
  res.shaders.push(vs);
  gl.shaderSource(vs, VS);
  gl.compileShader(vs);
  const made = list.map(([src]) => {
    const p = gl.createProgram(), fs = gl.createShader(gl.FRAGMENT_SHADER);
    res.programs.push(p); res.shaders.push(fs);
    gl.shaderSource(fs, src);
    gl.compileShader(fs);
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    return p;
  });
  return made.map((p, i) => {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
    const u = { p };
    list[i][1].split(' ').forEach(n => { u[n] = gl.getUniformLocation(p, n); });
    return u;
  });
}
function texture(r) {
  const gl = r.gl, t = gl.createTexture();
  r.res.textures.push(t);
  gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}
function framebuffer(r) { const f = r.gl.createFramebuffer(); r.res.fbs.push(f); return f; }
export function target(gl, t, f, tw, th) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return complete;
}
export function setupGL(r) {
  const gl = r.gl, res = r.res = { shaders: [], programs: [], textures: [], fbs: [], buffer: gl.createBuffer() };
  gl.bindBuffer(gl.ARRAY_BUFFER, res.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  [res.scene, res.glyph, res.comp] = linkAllThenCheck(r, [
    [FS_SCENE, 'samplePx boxPx rotation shapeMorph'],
    [FS_GLYPH, 'scene sampleGrid cellGrid cellPx'],
    [FS_COMP, 'glyphs atlas cellGrid cellDevicePx slotPx canvasH glyphCount dimColor accentColor brightColor'],
  ]);
  res.tScene = texture(r); res.tGlyph = texture(r); res.tAtlas = texture(r);
  res.fScene = framebuffer(r); res.fGlyph = framebuffer(r);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  r.atlasKey = '';
  if (gl.isContextLost()) throw new Error('lost');
}
export function freeGL(r) {
  const { gl, res } = r;
  if (!res) return;
  if (!gl.isContextLost()) {
    res.programs.forEach(p => gl.deleteProgram(p));
    res.shaders.forEach(s => gl.deleteShader(s));
    res.textures.forEach(t => gl.deleteTexture(t));
    res.fbs.forEach(f => gl.deleteFramebuffer(f));
    gl.deleteBuffer(res.buffer);
  }
  r.res = null;
}
