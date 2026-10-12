// The glyph atlas: the luminance ramp and edge strokes drawn with the terminal font, one texture slot per glyph.
import { RAMP } from './pose.js';

const D = document;
const STROKES = ['|', '/', '\\', '_'];
export const GLYPHS = [...RAMP, ...STROKES];

function fontReady(font) {
  try { return !D.fonts || D.fonts.check(font); } catch (e) { return true; }
}
export function drawAtlas(r) {
  const { gl, font, dpr, sw, sh, cellH } = r;
  const key = font + '|' + dpr + '|' + sw + 'x' + sh + '|' + cellH + '|' + fontReady(font);
  if (key === r.atlasKey) return;
  r.atlasKey = key;
  const N = GLYPHS.length, cv = D.createElement('canvas');
  cv.width = N * sw; cv.height = sh;
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.font = font;
  x.fillStyle = '#fff';
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';
  const mt = x.measureText('M');
  let asc = mt.fontBoundingBoxAscent, desc = mt.fontBoundingBoxDescent;
  if (!(asc > 0) || !(desc >= 0)) { const px = parseFloat((/(\d*\.?\d+)px/.exec(font) || [0, '15'])[1]); asc = px * 0.8; desc = px * 0.2; }
  const cssLineBoxBaseline = (cellH - (asc + desc)) / 2 + asc, slot = sw / dpr;
  for (let i = 1; i < N; i++) {
    x.save();
    x.beginPath(); x.rect(i * slot, 0, slot, sh / dpr); x.clip();
    x.fillText(GLYPHS[i], i * slot, cssLineBoxBaseline);
    x.restore();
  }
  gl.bindTexture(gl.TEXTURE_2D, r.res.tAtlas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  r.dirty = true;
}
