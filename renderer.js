/*
 * renderer.js: the glyph renderer in the fastfetch logo box, a raymarched 3D shape drawn live as terminal glyphs.
 *   GlyphRenderer.create(canvas, { cols, rows, cellW, cellH, font, colors: { bg, dim, fg, accent, bright }, reducedMotion })
 *   -> null without WebGL, else { resize(cols, rows, cellW, cellH, font), setColors, setReducedMotion, next(step), shape, onshape, destroy }
 * Three passes per frame; only the last runs at full resolution:
 *   1. scene      2 x 3 rays per character cell -> light, depth, highlight, hit
 *   2. glyph      one fragment per cell -> glyph index + colour level
 *   3. composite  every pixel: stamp the glyph from an atlas drawn with the terminal font
 */
(function () {
  'use strict';

  const W = window, D = document;

  const SHAPES = ['torus', 'cube', 'octahedron', 'cylinder', 'pyramid'];
  // atlas order: 0-9 luminance ramp, 10-13 edge strokes ('-' at 3 doubles as a stroke)
  const GLYPHS = [...' .:-=+*#%@', '|', '/', '\\', '_'];
  const SX = 2, SY = 3, NS = SX * SY;   // rays per cell; cells are ~2.3x taller than wide
  const MORPH_MS = 650;                 // shape change blend
  const AUTO_MS = 12000;                // next shape after this long without input
  const FRAME_MS = 25;                  // ~30 Hz while spinning; every frame while dragging
  const YAW0 = -0.55, PITCH0 = 0.45, SPIN = 0.3;
  const TAU = Math.PI * 2;

  const PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  // pass 1: one ray per sub-cell sample -> (light, depth / 16, highlight, hit)
  const FS_SCENE = PREC + `
uniform vec2 K, B;     // CSS px per sample, CSS px of the box
uniform mat3 M;        // object rotation
uniform vec3 S;        // shape, previous shape, morph 0..1
const vec3 L = vec3(-.36, .72, -.59);     // key light, upper left, toward the viewer
const vec3 L2 = vec3(.59, -.49, -.64);    // weak fill, lower right
float torus(vec3 p, vec2 t) { return length(vec2(length(p.xz) - t.x, p.y)) - t.y; }
float rbox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float octa(vec3 p, float s) { p = abs(p); return (p.x + p.y + p.z - s) * .57735027; }
float cyl(vec3 p, float r, float h, float e) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h) + e; return min(max(d.x, d.y), 0.) + length(max(d, 0.)) - e; }
// square pyramid: apex at y = a, base half-width b at y = -c
float pyr(vec3 p, float a, float b, float c) {
  vec2 n = normalize(vec2(a + c, b)), q = abs(p.xz);
  return max(max(dot(vec2(q.x, p.y - a), n), dot(vec2(q.y, p.y - a), n)), -p.y - c);
}
// every shape fits a bounding radius of ~1.36, so any pose stays inside the box
float shape(float i, vec3 p) {
  if (i < .5) return torus(p.xzy, vec2(.92, .4));
  if (i < 1.5) return rbox(p, vec3(.78), .07);
  if (i < 2.5) return octa(p, 1.36);
  if (i < 3.5) return cyl(p, 1., .5, .06);
  return pyr(p, 1.05, .85, .6);
}
float obj(vec3 p) {
  vec3 q = M * p;
  float a = shape(S.x, q);
  if (S.z < 1.) a = mix(shape(S.y, q), a, S.z * S.z * (3. - 2. * S.z));
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
  vec2 uv = (gl_FragCoord.xy * K - .5 * B) / min(B.x, B.y);
  vec3 ro = vec3(0., 0., -6.), rd = normalize(vec3(uv, 1.85));
  vec4 o = vec4(0., 1., 0., 0.);
  float b = dot(ro, rd), h = b * b - 36. + 2.1;   // bounding sphere, radius sqrt(2.1)
  if (h > 0.) {
    h = sqrt(h);
    float t = max(-b - h, 0.), te = -b + h, hit = 0.;
    for (int i = 0; i < 64; i++) {
      float d = obj(ro + rd * t);
      if (d < .0015) { hit = 1.; break; }
      t += d;
      if (t > te) break;
    }
    if (hit > .5) {
      vec3 p = ro + rd * t, n = normal(p);
      float nl = dot(n, L);
      float sh = nl > 0. ? shadow(p + n * .02, L) : 0.;
      float dif = pow(clamp(nl * .5 + .5, 0., 1.), 1.6) * (.45 + .55 * sh) + .12 * max(dot(n, L2), 0.);
      float fre = pow(1. - max(dot(n, -rd), 0.), 3.);
      float spe = pow(max(dot(n, normalize(L - rd)), 0.), 40.) * sh;
      float ao = clamp(obj(p + n * .16) / .16, 0., 1.) * .4 + .6;
      o = vec4(clamp((.04 + .9 * dif) * ao + .1 * fre, 0., 1.), t / 16., spe, 1.);
    }
  }
  gl_FragColor = o;
}`;

  // pass 2: one glyph per cell: a ramp glyph by light, or on an outline (silhouette, near side of an occlusion) a
  // stroke oriented by a Sobel gradient of sub-cell coverage. Output: (glyph / 255, colour level, highlight, 1).
  const FS_GLYPH = PREC + `
uniform sampler2D X;
uniform vec2 RS, RC, CW;    // sample grid size, cell grid size, CSS px per cell
vec4 tap(vec2 c, int i, int j) { return texture2D(X, (c * vec2(${SX}., ${SY}.) + vec2(float(i), float(j)) + .5) / RS); }
bool outside(vec2 c) { return c.x < 0. || c.y < 0. || c.x >= RC.x || c.y >= RC.y; }
// (sum of light over hits, nearest depth, max highlight, hits)
vec4 cell(vec2 c) {
  float l = 0., z = 1., s = 0., n = 0.;
  if (outside(c)) return vec4(0., 1., 0., 0.);
  for (int j = 0; j < ${SY}; j++) for (int i = 0; i < ${SX}; i++) {
    vec4 v = tap(c, i, j);
    if (v.a > .5) { l += v.r; z = min(z, v.g); s = max(s, v.b); n += 1.; }
  }
  return vec4(l, z, s, n);
}
// fraction of the cell covered by surface nearer than zr
float near(vec2 c, float zr) {
  float n = 0.;
  if (outside(c)) return 0.;
  for (int j = 0; j < ${SY}; j++) for (int i = 0; i < ${SX}; i++) {
    vec4 v = tap(c, i, j);
    if (v.a > .5 && v.g < zr) n += 1.;
  }
  return n / ${NS}.;
}
bool partial(float hits) { return hits > .5 && hits < ${NS - 0.5}; }
// occlusion toward neighbour a (at c + e): a is full and a real step farther, and the surface beyond a does not
// keep that slope (as a face seen almost edge-on at a crease would)
bool occl(vec2 c, vec2 e, vec4 a, float z) { float s = a.y - z; return a.w > ${NS - 0.5} && s > .02 && s > 2. * abs(cell(c + e + e).y - a.y); }
void main() {
  vec2 c = floor(gl_FragCoord.xy);
  vec4 v = cell(c);
  if (v.w < .5) { gl_FragColor = vec4(0.); return; }
  float cov = v.w / ${NS}., I = v.x / v.w, z = v.y;
  bool part = cov < .99;
  // partly covered cells are thinned by their coverage
  float g = 1. + floor(clamp(part ? I * cov : I, 0., 1.) * 8.99);
  vec4 l = cell(c + vec2(-1., 0.)), r = cell(c + vec2(1., 0.)), u = cell(c + vec2(0., 1.)), d = cell(c + vec2(0., -1.));
  // silhouette: the outline crosses the middle of this cell, or runs along its border
  bool sil = part ? cov > .2 && cov < .8 : min(min(l.w, r.w), min(u.w, d.w)) < .5;
  // occlusion: the near side of a depth step
  bool occ = !part && !sil && (occl(c, vec2(-1., 0.), l, z) || occl(c, vec2(1., 0.), r, z) || occl(c, vec2(0., 1.), u, z) || occl(c, vec2(0., -1.), d, z));
  if (sil || occ) {
    float zr = sil ? 2. : z + .02;
    float a0 = near(c + vec2(-1., -1.), zr), a1 = near(c + vec2(0., -1.), zr), a2 = near(c + vec2(1., -1.), zr);
    float a3 = near(c + vec2(-1., 0.), zr), a4 = near(c, zr), a5 = near(c + vec2(1., 0.), zr);
    float a6 = near(c + vec2(-1., 1.), zr), a7 = near(c + vec2(0., 1.), zr), a8 = near(c + vec2(1., 1.), zr);
    // gradient points into the surface, per CSS px so the tall cells are accounted for
    float gx = (a2 + 2. * a5 + a8 - a0 - 2. * a3 - a6) / CW.x;
    float gy = (a6 + 2. * a7 + a8 - a0 - 2. * a1 - a2) / CW.y;
    float ax = abs(gx), ay = abs(gy);
    // in a run of partial cells only the one crossed nearest its middle is stroked; a full cell open only above or
    // below is stroked only for a flat edge (a slanted one is stroked in its row's partial cells)
    bool horiz = ax <= .4 * ay;
    float n1 = horiz ? u.w : l.w, n2 = horiz ? d.w : r.w, m = abs(cov - .5);
    bool yields = part ? (partial(n1) && abs(n1 / ${NS}. - .5) < m) || (partial(n2) && abs(n2 / ${NS}. - .5) <= m) : sil && !horiz && min(l.w, r.w) > .5;
    if (ax + ay > .01 && !yields) {
      if (ax > 2.48 * ay) g = 10.;                          // |
      else if (!horiz) g = gx * gy > 0. ? 12. : 11.;        // \\ or /
      else g = (gy < 0.) == (a4 < .5) ? 13. : 3.;           // _ low in the cell, - higher up
      I = max(I, .6);
    }
  }
  gl_FragColor = vec4(g / 255., I, v.z > .3 ? 1. : 0., 1.);
}`;

  // pass 3: full resolution; stamp each cell's glyph from the atlas onto a transparent canvas
  const FS_COMP = PREC + `
uniform sampler2D G, F;
uniform vec2 RC, Z, SL;     // cells, device px per cell, atlas slot size
uniform float H, N;         // canvas height, glyphs in the atlas
uniform vec3 C0, C1, C2;    // dim, accent, bright
void main() {
  vec2 f = vec2(gl_FragCoord.x, H - gl_FragCoord.y);
  vec2 c = min(floor(f / Z), RC - 1.);
  vec4 g = texture2D(G, vec2(c.x + .5, RC.y - c.y - .5) / RC);
  float i = floor(g.r * 255. + .5);
  if (i < .5) { gl_FragColor = vec4(0.); return; }
  vec2 l = f - c * Z;
  float a = texture2D(F, vec2((i * SL.x + l.x) / (N * SL.x), l.y / SL.y)).a;
  float I = g.b > .5 ? 1. : g.g;
  vec3 col = I < .5 ? mix(C0, C1, I * 2.) : mix(C1, C2, I * 2. - 1.);
  gl_FragColor = vec4(col * a, a);
}`;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // phones are 3x; only the cheap composite pass runs per device pixel
  const ratio = () => Math.min(W.devicePixelRatio || 1, 3);

  // '#rrggbb' -> [r, g, b] in 0..1, or fb for anything else
  function rgb(s, fb) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(s || '').trim()), n = m && parseInt(m[1], 16);
    return m ? [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] : fb;
  }
  const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // keep every ramp colour readable on the page background by pulling weak ones toward the text colour
  function legible(c, bg, fg, min) {
    let t = 0, out = c;
    while (contrast(out, bg) < min && t < 1) { t += 0.1; out = mix3(c, fg, t); }
    return out;
  }

  function create(canvas, opts) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    try { return build(canvas, opts || {}); } catch (e) { return null; }
  }

  function build(canvas, opts) {
    const attrs = { antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };   // alpha, premultiplied: defaults
    let gl = null;
    try { gl = canvas.getContext('webgl', attrs); } catch (e) { gl = null; }
    // a lost context (e.g. released by an earlier destroy()): the caller shows its fallback
    if (!gl || gl.isContextLost()) return null;

    let cols = Math.max(1, opts.cols | 0 || 40), rows = Math.max(1, opts.rows | 0 || 19);
    let cellW = opts.cellW > 0 ? +opts.cellW : 9, cellH = opts.cellH > 0 ? +opts.cellH : 21;
    let font = opts.font ? String(opts.font) : '400 15px monospace';
    let reduced = !!opts.reducedMotion;
    let dpr = 1, w = 1, h = 1, sw = 1, sh = 1;            // canvas px, atlas slot px
    let res = null, ok = false, dead = false, atlasKey = '';
    let C0 = [0.2, 0.33, 0.42], C1 = [0.09, 0.58, 0.82], C2 = [0.62, 0.85, 0.96];
    let raf = 0, dirty = true, visible = true, lastDraw = 0, lastT = 0;
    let cur = 0, prev = 0, morphT = -1e9, idle = 0;
    let yaw = YAW0, pitch = PITCH0, vy = 0, vp = 0, accX = 0, accY = 0;
    let drag = false, dragId = -1, moved = 0, lx = 0, ly = 0, dragMouse = false;
    let mqDpr = null, io = null;
    const Mx = new Float32Array(9);
    // listeners added at init and removed by destroy()
    const ons = [[canvas, 'pointerdown', onDown], [canvas, 'pointermove', onMove], [canvas, 'pointerup', onUp], [canvas, 'pointercancel', onUp],
      [canvas, 'lostpointercapture', onUp], [canvas, 'webglcontextlost', onLost], [canvas, 'webglcontextrestored', onRestored],
      [D, 'visibilitychange', onVisibility], [W, 'resize', onResize]];

    /* ---- GL resources: everything goes into `res` as it is made, so a failure half way can still be freed ---- */
    // compile and link all programs before asking for any status, so the driver can work on them in parallel
    function programs(list) {
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
    function texture() {
      const t = gl.createTexture();
      res.textures.push(t);
      gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t;
    }
    function framebuffer() { const f = gl.createFramebuffer(); res.fbs.push(f); return f; }
    function target(t, f, tw, th) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return complete;
    }
    function setupGL() {
      res = { shaders: [], programs: [], textures: [], fbs: [], buffer: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, res.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      [res.scene, res.glyph, res.comp] = programs([
        [FS_SCENE, 'K B M S'],
        [FS_GLYPH, 'X RS RC CW'],
        [FS_COMP, 'G F RC Z SL H N C0 C1 C2'],
      ]);
      res.tScene = texture(); res.tGlyph = texture(); res.tAtlas = texture();
      res.fScene = framebuffer(); res.fGlyph = framebuffer();
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      atlasKey = '';
      if (gl.isContextLost()) throw new Error('lost');
    }
    function freeGL() {
      if (!res) return;
      if (!gl.isContextLost()) {
        res.programs.forEach(p => gl.deleteProgram(p));
        res.shaders.forEach(s => gl.deleteShader(s));
        res.textures.forEach(t => gl.deleteTexture(t));
        res.fbs.forEach(f => gl.deleteFramebuffer(f));
        gl.deleteBuffer(res.buffer);
      }
      res = null;
    }

    /* ---- glyph atlas: the glyphs drawn with the terminal font, one slot per glyph ---- */
    function fontReady() {
      try { return !D.fonts || D.fonts.check(font); } catch (e) { return true; }
    }
    function atlas() {
      const key = font + '|' + dpr + '|' + sw + 'x' + sh + '|' + cellH + '|' + fontReady();
      if (key === atlasKey) return;
      atlasKey = key;
      const N = GLYPHS.length, cv = D.createElement('canvas');
      cv.width = N * sw; cv.height = sh;
      const x = cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.font = font;
      x.fillStyle = '#fff';
      x.textAlign = 'left';
      x.textBaseline = 'alphabetic';
      // put the baseline where a CSS line box of height cellH puts it, so glyphs match the terminal text
      const mt = x.measureText('M');
      let asc = mt.fontBoundingBoxAscent, desc = mt.fontBoundingBoxDescent;
      if (!(asc > 0) || !(desc >= 0)) { const px = parseFloat((/(\d*\.?\d+)px/.exec(font) || [0, '15'])[1]); asc = px * 0.8; desc = px * 0.2; }
      const base = (cellH - (asc + desc)) / 2 + asc, slot = sw / dpr;
      for (let i = 1; i < N; i++) {
        x.save();
        x.beginPath(); x.rect(i * slot, 0, slot, sh / dpr); x.clip();
        x.fillText(GLYPHS[i], i * slot, base);
        x.restore();
      }
      gl.bindTexture(gl.TEXTURE_2D, res.tAtlas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      dirty = true;
    }

    /* ---- sizing: the canvas sits exactly on the terminal grid ---- */
    function layout() {
      dpr = ratio();
      const cssW = cols * cellW, cssH = rows * cellH;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      w = Math.max(1, Math.round(cssW * dpr));
      h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      sw = Math.ceil(w / cols); sh = Math.ceil(h / rows);
      if (!ok) return true;
      const complete = target(res.tScene, res.fScene, cols * SX, rows * SY) && target(res.tGlyph, res.fGlyph, cols, rows);
      atlas();
      dirty = true;
      kick();
      return complete;
    }
    function watchDpr() {
      if (mqDpr) mqDpr.removeEventListener('change', onDpr);
      mqDpr = null;
      try { mqDpr = W.matchMedia('(resolution: ' + (W.devicePixelRatio || 1) + 'dppx)'); mqDpr.addEventListener('change', onDpr); } catch (e) { mqDpr = null; }
    }
    function onDpr() {
      if (ratio() !== dpr) layout();
      watchDpr();
    }
    function onResize() { if (ratio() !== dpr) onDpr(); }

    function setColors(c) {
      c = c || {};
      const bg = rgb(c.bg, [0.05, 0.07, 0.09]), fg = rgb(c.fg, [0.82, 0.84, 0.87]);
      C0 = legible(rgb(c.dim, C0), bg, fg, 2.2);
      C1 = legible(rgb(c.accent, C1), bg, fg, 3);
      C2 = legible(rgb(c.bright, C2), bg, fg, 3);
      dirty = true;
      kick();
    }

    /* ---- frame loop: runs only while something changes on screen ---- */
    function kick() { if (!raf && ok && !dead) raf = W.requestAnimationFrame(frame); }
    function live() { return !reduced && visible && !D.hidden; }

    function setShape(i) {
      const n = SHAPES.length, next = ((i % n) + n) % n;
      if (next === cur) return;
      prev = cur; cur = next;
      morphT = reduced ? -1e9 : performance.now();
      idle = 0;
      dirty = true;
      kick();
      const f = api.onshape;
      if (typeof f === 'function') {
        try { f(SHAPES[cur]); } catch (e) { setTimeout(() => { throw e; }, 0); }
      }
    }

    function frame(t) {
      raf = 0;
      if (!ok || dead) return;
      const moving = live(), input = accX !== 0 || accY !== 0, morphing = t - morphT < MORPH_MS;
      if (!dirty && !input && !morphing && !(moving && !drag)) {
        // nothing to draw: idle under reduced motion or offscreen, or a drag held still
        if (moving) raf = W.requestAnimationFrame(frame); else lastT = 0;
        return;
      }
      if (!dirty && !input && t - lastDraw < FRAME_MS) { raf = W.requestAnimationFrame(frame); return; }
      const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 1 / 30;
      lastT = t;
      update(t, dt, moving);
      draw(t);
      lastDraw = t;
      dirty = false;
      if (moving || t - morphT < MORPH_MS) raf = W.requestAnimationFrame(frame);
      else lastT = 0;
    }

    function update(t, dt, moving) {
      if (accX || accY) {
        const ay = accX * 0.01, ap = accY * 0.007;
        yaw += ay;
        pitch = clamp(pitch + ap, -1.25, 1.25);
        if (moving) { vy = ay / Math.max(dt, 0.008); vp = ap / Math.max(dt, 0.008); }
        accX = accY = 0;
      } else if (moving && !drag) {
        yaw += (SPIN + vy) * dt;
        pitch = clamp(pitch + vp * dt, -1.25, 1.25);
        const k = Math.exp(-dt * 2.4);
        vy *= k; vp *= k;
        pitch += (PITCH0 + Math.sin(t * 0.00027) * 0.16 - pitch) * (1 - Math.exp(-dt * 0.6));
        idle += dt * 1000;
        if (idle > AUTO_MS) setShape(cur + 1);
      }
      yaw %= TAU;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
      Mx[0] = cy; Mx[1] = sx * sy; Mx[2] = -cx * sy;
      Mx[3] = 0; Mx[4] = cx; Mx[5] = sx;
      Mx[6] = sy; Mx[7] = -sx * cy; Mx[8] = cx * cy;
    }

    function draw(t) {
      const m = clamp((t - morphT) / MORPH_MS, 0, 1);
      let p = res.scene;
      gl.bindFramebuffer(gl.FRAMEBUFFER, res.fScene);
      gl.viewport(0, 0, cols * SX, rows * SY);
      gl.useProgram(p.p);
      gl.uniform2f(p.K, cellW / SX, cellH / SY);
      gl.uniform2f(p.B, cols * cellW, rows * cellH);
      gl.uniformMatrix3fv(p.M, false, Mx);
      gl.uniform3f(p.S, cur, prev, m);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      p = res.glyph;
      gl.bindFramebuffer(gl.FRAMEBUFFER, res.fGlyph);
      gl.viewport(0, 0, cols, rows);
      gl.useProgram(p.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, res.tScene);
      gl.uniform1i(p.X, 0);
      gl.uniform2f(p.RS, cols * SX, rows * SY);
      gl.uniform2f(p.RC, cols, rows);
      gl.uniform2f(p.CW, cellW, cellH);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      p = res.comp;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(p.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, res.tGlyph);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, res.tAtlas);
      gl.uniform1i(p.G, 0); gl.uniform1i(p.F, 1);
      gl.uniform2f(p.RC, cols, rows);
      gl.uniform2f(p.Z, w / cols, h / rows);
      gl.uniform2f(p.SL, sw, sh);
      gl.uniform1f(p.H, h);
      gl.uniform1f(p.N, GLYPHS.length);
      gl.uniform3f(p.C0, C0[0], C0[1], C0[2]);
      gl.uniform3f(p.C1, C1[0], C1[1], C1[2]);
      gl.uniform3f(p.C2, C2[0], C2[1], C2[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* ---- input: mouse drag turns both axes, touch drag only turns (vertical swipes scroll the page) ---- */
    function onDown(e) {
      if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = true; dragId = e.pointerId; moved = 0;
      dragMouse = e.pointerType === 'mouse';
      lx = e.clientX; ly = e.clientY; vy = vp = 0; idle = 0;
      if (dragMouse) e.preventDefault();   // no text selection while dragging
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      canvas.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (!drag || e.pointerId !== dragId) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      accX += dx;
      if (dragMouse) accY += dy;
      idle = 0;
      kick();
    }
    function onUp(e) {
      if (!drag || e.pointerId !== dragId) return;
      const click = e.type === 'pointerup' && moved < 6;
      drag = false; dragId = -1;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
      idle = 0;
      if (click) setShape(cur + 1);
      kick();
    }
    function onVisibility() { lastT = 0; if (!D.hidden) kick(); }
    function onLost(e) {
      e.preventDefault();
      ok = false; res = null;
      if (raf) { W.cancelAnimationFrame(raf); raf = 0; }
    }
    function onRestored() {
      if (dead) return;
      try {
        setupGL();
        ok = true;
        if (!layout()) throw new Error('fbo');
      } catch (err) { ok = false; freeGL(); }
    }
    function onFonts() { if (ok && !dead) { atlas(); kick(); } }

    const api = {
      resize(c, r, cw, ch, f) {
        if (dead) return;
        if (c > 0) cols = c | 0 || cols;
        if (r > 0) rows = r | 0 || rows;
        if (cw > 0) cellW = +cw;
        if (ch > 0) cellH = +ch;
        if (f) font = String(f);
        layout();
        if (f && D.fonts) { try { D.fonts.load(font).then(onFonts, () => {}); } catch (e) { /* invalid font string */ } }
      },
      setColors(c) { if (!dead) setColors(c); },
      setReducedMotion(v) {
        reduced = !!v;
        if (reduced) { vy = vp = 0; morphT = -1e9; }
        lastT = 0; dirty = true; kick();
      },
      next(step) {
        if (dead) return;
        idle = 0;
        setShape(cur + (step === undefined ? 1 : step | 0));
      },
      get shape() { return SHAPES[cur]; },
      onshape: null,
      destroy() {
        if (dead) return;
        dead = true;
        if (raf) W.cancelAnimationFrame(raf);
        raf = 0;
        for (const [t, e, f] of ons) t.removeEventListener(e, f);
        if (mqDpr) mqDpr.removeEventListener('change', onDpr);
        if (D.fonts) D.fonts.removeEventListener('loadingdone', onFonts);
        if (io) io.disconnect();
        canvas.style.cursor = '';
        if (ok && !gl.isContextLost()) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        freeGL();
        ok = false;
        // release the context now, not at garbage collection: browsers cap live contexts (about 16)
        const ext = gl.isContextLost() ? null : gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      },
    };

    /* ---- init ---- */
    try {
      setupGL();
      ok = true;
      setColors(opts.colors);
      if (!layout()) throw new Error('fbo');
    } catch (e) {
      ok = false;
      freeGL();
      throw e;
    }
    update(0, 0, false);

    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    for (const [t, e, f] of ons) t.addEventListener(e, f);
    watchDpr();
    if (D.fonts) {
      // the atlas is redrawn once the terminal font has loaded
      D.fonts.addEventListener('loadingdone', onFonts);
      try { D.fonts.load(font).then(onFonts, () => {}); } catch (e) { /* invalid font string */ }
    }
    if (W.IntersectionObserver) {
      io = new IntersectionObserver(es => {
        const v = es[es.length - 1].isIntersecting;
        if (v !== visible) { visible = v; lastT = 0; if (v) { dirty = true; kick(); } }
      });
      io.observe(canvas);
    }
    dirty = true;
    kick();
    return api;
  }

  W.GlyphRenderer = { create };
})();
