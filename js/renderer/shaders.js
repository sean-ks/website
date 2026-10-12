// GLSL for the renderer's three passes: rays per sub-cell sample, one glyph per cell, and the full-resolution composite from the atlas.
import { GLYPHS } from './atlas.js';

export const RAYS_X = 2, RAYS_Y = 3;
const RAYS_PER_CELL = RAYS_X * RAYS_Y;

const PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
export const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

export const FS_SCENE = PREC + `
uniform vec2 samplePx, boxPx;
uniform mat3 rotation;
uniform vec3 shapeMorph;
const vec3 KEY_LIGHT = vec3(-.36, .72, -.59);
const vec3 FILL_LIGHT = vec3(.59, -.49, -.64);
float torus(vec3 p, vec2 t) { return length(vec2(length(p.xz) - t.x, p.y)) - t.y; }
float rbox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float octa(vec3 p, float s) { p = abs(p); return (p.x + p.y + p.z - s) * .57735027; }
float cyl(vec3 p, float r, float h, float e) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h) + e; return min(max(d.x, d.y), 0.) + length(max(d, 0.)) - e; }
float pyramid(vec3 p, float apexY, float baseHalfWidth, float baseDepth) {
  vec2 n = normalize(vec2(apexY + baseDepth, baseHalfWidth)), q = abs(p.xz);
  return max(max(dot(vec2(q.x, p.y - apexY), n), dot(vec2(q.y, p.y - apexY), n)), -p.y - baseDepth);
}
float shape(float i, vec3 p) {
  if (i < .5) return torus(p.xzy, vec2(.92, .4));
  if (i < 1.5) return rbox(p, vec3(.78), .07);
  if (i < 2.5) return octa(p, 1.36);
  if (i < 3.5) return cyl(p, 1., .5, .06);
  return pyramid(p, 1.05, .85, .6);
}
float obj(vec3 p) {
  vec3 q = rotation * p;
  float a = shape(shapeMorph.x, q);
  if (shapeMorph.z < 1.) a = mix(shape(shapeMorph.y, q), a, shapeMorph.z * shapeMorph.z * (3. - 2. * shapeMorph.z));
  return a;
}
vec3 normal(vec3 p) {
  vec2 e = vec2(.004, -.004);
  return normalize(e.xyy * obj(p + e.xyy) + e.yyx * obj(p + e.yyx) + e.yxy * obj(p + e.yxy) + e.xxx * obj(p + e.xxx));
}
float shadow(vec3 o, vec3 d) {
  float r = 1., t = .04;
  for (int i = 0; i < 14; i++) {
    float h = obj(o + d * t);
    r = min(r, 8. * h / t);
    t += clamp(h, .05, .3);
    if (r < .02 || t > 3.) break;
  }
  return clamp(r, 0., 1.);
}
void main() {
  vec2 uv = (gl_FragCoord.xy * samplePx - .5 * boxPx) / min(boxPx.x, boxPx.y);
  vec3 ro = vec3(0., 0., -6.), rd = normalize(vec3(uv, 1.85));
  vec4 o = vec4(0., 1., 0., 0.);
  float b = dot(ro, rd), boundingSphere = b * b - 36. + 2.1;
  if (boundingSphere > 0.) {
    float h = sqrt(boundingSphere);
    float t = max(-b - h, 0.), te = -b + h, hit = 0.;
    for (int i = 0; i < 64; i++) {
      float d = obj(ro + rd * t);
      if (d < .0015) { hit = 1.; break; }
      t += d;
      if (t > te) break;
    }
    if (hit > .5) {
      vec3 p = ro + rd * t, n = normal(p);
      float nl = dot(n, KEY_LIGHT);
      float sh = nl > 0. ? shadow(p + n * .02, KEY_LIGHT) : 0.;
      float dif = pow(clamp(nl * .5 + .5, 0., 1.), 1.6) * (.45 + .55 * sh) + .12 * max(dot(n, FILL_LIGHT), 0.);
      float fre = pow(1. - max(dot(n, -rd), 0.), 3.);
      float spe = pow(max(dot(n, normalize(KEY_LIGHT - rd)), 0.), 40.) * sh;
      float ao = clamp(obj(p + n * .16) / .16, 0., 1.) * .4 + .6;
      o = vec4(clamp((.04 + .9 * dif) * ao + .1 * fre, 0., 1.), t / 16., spe, 1.);
    }
  }
  gl_FragColor = o;
}`;

export const FS_GLYPH = PREC + `
uniform sampler2D scene;
uniform vec2 sampleGrid, cellGrid, cellPx;
const float BAR = ${GLYPHS.indexOf('|')}., SLASH = ${GLYPHS.indexOf('/')}., BACKSLASH = ${GLYPHS.indexOf('\\')}., UNDERSCORE = ${GLYPHS.indexOf('_')}., DASH = ${GLYPHS.indexOf('-')}.;
vec4 tap(vec2 c, int i, int j) { return texture2D(scene, (c * vec2(${RAYS_X}., ${RAYS_Y}.) + vec2(float(i), float(j)) + .5) / sampleGrid); }
bool outside(vec2 c) { return c.x < 0. || c.y < 0. || c.x >= cellGrid.x || c.y >= cellGrid.y; }
vec4 lightDepthHighlightHits(vec2 c) {
  float l = 0., z = 1., s = 0., n = 0.;
  if (outside(c)) return vec4(0., 1., 0., 0.);
  for (int j = 0; j < ${RAYS_Y}; j++) for (int i = 0; i < ${RAYS_X}; i++) {
    vec4 v = tap(c, i, j);
    if (v.a > .5) { l += v.r; z = min(z, v.g); s = max(s, v.b); n += 1.; }
  }
  return vec4(l, z, s, n);
}
float coverageNearerThan(vec2 c, float zr) {
  float n = 0.;
  if (outside(c)) return 0.;
  for (int j = 0; j < ${RAYS_Y}; j++) for (int i = 0; i < ${RAYS_X}; i++) {
    vec4 v = tap(c, i, j);
    if (v.a > .5 && v.g < zr) n += 1.;
  }
  return n / ${RAYS_PER_CELL}.;
}
bool partial(float hits) { return hits > .5 && hits < ${RAYS_PER_CELL - 0.5}; }
bool occludesToward(vec2 c, vec2 e, vec4 a, float z) { float s = a.y - z; return a.w > ${RAYS_PER_CELL - 0.5} && s > .02 && s > 2. * abs(lightDepthHighlightHits(c + e + e).y - a.y); }
void main() {
  vec2 c = floor(gl_FragCoord.xy);
  vec4 v = lightDepthHighlightHits(c);
  if (v.w < .5) { gl_FragColor = vec4(0.); return; }
  float cov = v.w / ${RAYS_PER_CELL}., I = v.x / v.w, z = v.y;
  bool part = cov < .99;
  float g = 1. + floor(clamp(part ? I * cov : I, 0., 1.) * 8.99);
  vec4 l = lightDepthHighlightHits(c + vec2(-1., 0.)), r = lightDepthHighlightHits(c + vec2(1., 0.)), u = lightDepthHighlightHits(c + vec2(0., 1.)), d = lightDepthHighlightHits(c + vec2(0., -1.));
  bool silhouette = part ? cov > .2 && cov < .8 : min(min(l.w, r.w), min(u.w, d.w)) < .5;
  bool occlusion = !part && !silhouette && (occludesToward(c, vec2(-1., 0.), l, z) || occludesToward(c, vec2(1., 0.), r, z) || occludesToward(c, vec2(0., 1.), u, z) || occludesToward(c, vec2(0., -1.), d, z));
  if (silhouette || occlusion) {
    float zr = silhouette ? 2. : z + .02;
    float a0 = coverageNearerThan(c + vec2(-1., -1.), zr), a1 = coverageNearerThan(c + vec2(0., -1.), zr), a2 = coverageNearerThan(c + vec2(1., -1.), zr);
    float a3 = coverageNearerThan(c + vec2(-1., 0.), zr), a4 = coverageNearerThan(c, zr), a5 = coverageNearerThan(c + vec2(1., 0.), zr);
    float a6 = coverageNearerThan(c + vec2(-1., 1.), zr), a7 = coverageNearerThan(c + vec2(0., 1.), zr), a8 = coverageNearerThan(c + vec2(1., 1.), zr);
    float gx = (a2 + 2. * a5 + a8 - a0 - 2. * a3 - a6) / cellPx.x;
    float gy = (a6 + 2. * a7 + a8 - a0 - 2. * a1 - a2) / cellPx.y;
    float ax = abs(gx), ay = abs(gy);
    bool horiz = ax <= .4 * ay;
    float n1 = horiz ? u.w : l.w, n2 = horiz ? d.w : r.w, m = abs(cov - .5);
    bool yields = part ? (partial(n1) && abs(n1 / ${RAYS_PER_CELL}. - .5) < m) || (partial(n2) && abs(n2 / ${RAYS_PER_CELL}. - .5) <= m) : silhouette && !horiz && min(l.w, r.w) > .5;
    if (ax + ay > .01 && !yields) {
      if (ax > 2.48 * ay) g = BAR;
      else if (!horiz) g = gx * gy > 0. ? BACKSLASH : SLASH;
      else g = (gy < 0.) == (a4 < .5) ? UNDERSCORE : DASH;
      I = max(I, .6);
    }
  }
  gl_FragColor = vec4(g / 255., I, v.z > .3 ? 1. : 0., 1.);
}`;

export const FS_COMP = PREC + `
uniform sampler2D glyphs, atlas;
uniform vec2 cellGrid, cellDevicePx, slotPx;
uniform float canvasH, glyphCount;
uniform vec3 dimColor, accentColor, brightColor;
void main() {
  vec2 f = vec2(gl_FragCoord.x, canvasH - gl_FragCoord.y);
  vec2 c = min(floor(f / cellDevicePx), cellGrid - 1.);
  vec4 g = texture2D(glyphs, vec2(c.x + .5, cellGrid.y - c.y - .5) / cellGrid);
  float i = floor(g.r * 255. + .5);
  if (i < .5) { gl_FragColor = vec4(0.); return; }
  vec2 l = f - c * cellDevicePx;
  float a = texture2D(atlas, vec2((i * slotPx.x + l.x) / (glyphCount * slotPx.x), l.y / slotPx.y)).a;
  float I = g.b > .5 ? 1. : g.g;
  vec3 col = I < .5 ? mix(dimColor, accentColor, I * 2.) : mix(accentColor, brightColor, I * 2. - 1.);
  gl_FragColor = vec4(col * a, a);
}`;
