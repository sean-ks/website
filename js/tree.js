const ROWS = 84, LINE_HEIGHT = 1.15, MIN_FONT = 3, MAX_DPR = 3, FRAME_MS = 25;
const STEP = 1.1 / ROWS, TAU = Math.PI * 2;
const IDLE_SPIN = 0.5, HOME_TILT = 0.24, MIN_TILT = -0.1, MAX_TILT = 1, CAMERA = 6.5, PIVOT_Y = 1.15;
const LIGHT_DIR = [-0.45, 0.55, -0.7];

const FOLIAGE = 0, MATTE = 1, BAUBLE = 2, TINSEL = 3, LIGHT = 4, STAR = 5, GLINT = 6, DUST = 7;
const DEPTH_BIAS = [0, 0, 0.05, 0.04, 0.07, 0, 0.06, 0];

const code = ch => ch.charCodeAt(0);
const codes = text => [...text].map(code);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

let randomState = 20261225;
function rand() {
  randomState = (randomState + 0x6d2b79f5) | 0;
  let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo, hi) => lo + (hi - lo) * rand();
const pick = items => items[Math.floor(rand() * items.length)];

const BARK = [150, 98, 58], GOLD = [250, 214, 96], CRANBERRY = [224, 50, 60], ICE = [228, 234, 246], SILVER = [196, 212, 236];
const BAUBLE_COLORS = [[232, 52, 62], [246, 190, 60], [76, 146, 255], [236, 84, 196], [214, 224, 238], [64, 208, 196]];
const LIGHT_COLORS = [[255, 92, 92], [255, 214, 92], [112, 190, 255], [255, 132, 230], [255, 255, 255], [255, 160, 64]];
const FOLIAGE_DARK = [10, 66, 38], FOLIAGE_LIT = [112, 226, 116];
const STAR_WARM = [255, 196, 48], STAR_HOT = [255, 246, 190], DUST_DIM = [255, 170, 60], DUST_BRIGHT = [255, 244, 190];

const FOLIAGE_RAMP = codes('.,:;!^%#');
const [AT, BIG_O, SMALL_O, ASTERISK, PLUS, DOT, TILDE, DASH, BAR, SLASH, BACKSLASH] = codes('@Oo*+.~-|/\\');
const RAYS = [[0, -1, BAR], [1, 0, DASH], [-1, 0, DASH], [0.7, -0.7, SLASH], [-0.7, -0.7, BACKSLASH], [0.7, 0.7, BACKSLASH], [-0.7, 0.7, SLASH]];
const SPARKLE = [[-1, 0, DASH, 0.85], [1, 0, DASH, 0.85], [0, -1, BAR, 0.8], [0, 1, BAR, 0.8], [-2, 0, DASH, 0.5], [2, 0, DASH, 0.5]];

const TIERS = [
  { y0: 0.42, r0: 0.96, y1: 1.08, r1: 0.34, boughs: 10 },
  { y0: 0.88, r0: 0.74, y1: 1.46, r1: 0.25, boughs: 9 },
  { y0: 1.28, r0: 0.54, y1: 1.8, r1: 0.15, boughs: 7 },
  { y0: 1.64, r0: 0.35, y1: 2.1, r1: 0, boughs: 6 },
];
const TREE_TOP = 2.1, TRUNK_RADIUS = 0.075, STAR_Y = TREE_TOP + 0.19, STAR_RADIUS = 0.23;
const PRESENTS = [
  { angle: 0.35, dist: 0.89, w: 0.36, h: 0.26, d: 0.3, turn: 0.4, paper: CRANBERRY, ribbon: GOLD, pattern: '#' },
  { angle: 1.45, dist: 1.04, w: 0.26, h: 0.2, d: 0.26, turn: -0.3, paper: [62, 124, 238], ribbon: ICE, pattern: '%' },
  { angle: 2.5, dist: 0.83, w: 0.3, h: 0.36, d: 0.28, turn: 0.9, paper: [240, 186, 60], ribbon: CRANBERRY, pattern: '=' },
  { angle: 3.55, dist: 1.05, w: 0.42, h: 0.18, d: 0.28, turn: 0.15, paper: [156, 90, 224], ribbon: GOLD, pattern: 'X' },
  { angle: 4.5, dist: 0.85, w: 0.25, h: 0.25, d: 0.25, turn: -0.7, paper: ICE, ribbon: CRANBERRY, pattern: '#' },
  { angle: 5.45, dist: 1.07, w: 0.3, h: 0.3, d: 0.24, turn: 0.5, paper: [48, 190, 180], ribbon: [255, 255, 255], pattern: 'H' },
];

const points = [], motes = [];

function add(kind, x, y, z, nx, ny, nz, color, glyph = 0, a = 0, seed = rand()) {
  const p = { kind, x, y, z, nx, ny, nz, color, glyph, a, seed };
  points.push(p);
  return p;
}

function sphere(count, visit) {
  for (let i = 0; i < count; i++) {
    const ny = 1 - (2 * (i + 0.5)) / count, ring = Math.sqrt(1 - ny * ny), angle = i * 2.399963229728653;
    visit(ring * Math.cos(angle), ny, ring * Math.sin(angle));
  }
}

function circle(radius, gap, visit) {
  const count = Math.max(4, Math.ceil((TAU * radius) / gap));
  for (let j = 0; j < count; j++) {
    const angle = ((j + rand()) / count) * TAU;
    visit(Math.cos(angle), Math.sin(angle), angle);
  }
}

const tierRadius = (tier, y) => lerp(tier.r0, tier.r1, (y - tier.y0) / (tier.y1 - tier.y0));
const surfaceRadius = y => TIERS.reduce((radius, tier) => (y >= tier.y0 && y <= tier.y1 ? Math.max(radius, tierRadius(tier, y)) : radius), 0);

function buildFoliage() {
  TIERS.forEach((tier, index) => {
    const rise = tier.y1 - tier.y0, run = tier.r0 - tier.r1, slant = Math.hypot(rise, run), rings = Math.ceil(slant / STEP);
    for (let i = 0; i < rings; i++) {
      const t = (i + rand()) / rings, radius = lerp(tier.r0, tier.r1, t), y = lerp(tier.y0, tier.y1, t);
      circle(radius, STEP, (cos, sin, angle) => {
        const bough = Math.sin(angle * tier.boughs + index * 1.9), r = radius * (1 + 0.09 * bough * (1 - t));
        const occlusion = (0.34 + 0.66 * Math.pow(1 - t, 1.1)) * (0.88 + 0.12 * bough) * (t < 0.07 ? 1.3 : 1);
        add(FOLIAGE, r * cos, y, r * sin, (rise / slant) * cos, run / slant, (rise / slant) * sin, null, 0, occlusion);
      });
    }
    const inner = index ? tierRadius(TIERS[index - 1], tier.y0) : TRUNK_RADIUS, gap = STEP * 1.25;
    for (let r = inner; r < tier.r0; r += gap) {
      circle(r, gap, (cos, sin) => add(FOLIAGE, r * cos, tier.y0, r * sin, 0, -1, 0, null, 0, 0.3));
    }
  });
}

function buildTrunk() {
  const bark = codes('||#!');
  for (let y = 0; y < 0.5; y += STEP) {
    circle(TRUNK_RADIUS, STEP, (cos, sin) => add(MATTE, cos * TRUNK_RADIUS, y, sin * TRUNK_RADIUS, cos, 0, sin, BARK, pick(bark)));
  }
}

function buildBaubles() {
  const rings = [[0, 0.1, 9], [0, 0.45, 5], [1, 0.12, 7], [1, 0.45, 4], [2, 0.14, 5], [3, 0.2, 3]];
  let n = 0;
  for (const [tierIndex, t, count] of rings) {
    const tier = TIERS[tierIndex], y = lerp(tier.y0, tier.y1, t), radius = lerp(tier.r0, tier.r1, t), offset = rand() * TAU;
    for (let j = 0; j < count; j++) {
      const angle = offset + ((j + between(-0.2, 0.2)) / count) * TAU, size = lerp(0.058, 0.042, y / TREE_TOP);
      const samples = Math.ceil(((4 * Math.PI * size * size) / (STEP * STEP)) * 1.2), flashPhase = rand() * TAU;
      const color = BAUBLE_COLORS[n++ % BAUBLE_COLORS.length];
      const cx = (radius + size * 0.6) * Math.cos(angle), cy = y - 0.02, cz = (radius + size * 0.6) * Math.sin(angle);
      sphere(samples, (nx, ny, nz) => add(BAUBLE, cx + nx * size, cy + ny * size, cz + nz * size, nx, ny, nz, color, 0, flashPhase));
    }
  }
}

function onSpiral(s, turns, start, lift) {
  const u = 1 - Math.sqrt(1 - 0.96 * s), y = lerp(0.47, 2.03, u), angle = start + u * turns * TAU, radius = surfaceRadius(y) + lift;
  return { u, x: radius * Math.cos(angle), y, z: radius * Math.sin(angle), nx: Math.cos(angle), nz: Math.sin(angle) };
}

function buildTinsel(start, color) {
  const steps = Math.ceil(13 / (STEP * 0.6));
  for (let i = 0; i < steps; i++) {
    const q = onSpiral(i / steps, 4.25, start, 0.03);
    add(TINSEL, q.x, q.y, q.z, q.nx, 0, q.nz, color, TILDE, q.u);
  }
}

function buildLights() {
  for (let i = 0; i < 84; i++) {
    const q = onSpiral((i + 0.5) / 84, -3.5, 1, 0.04), blinkSpeed = between(1.5, 5), blinkPhase = rand();
    const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
    sphere(8, (nx, ny, nz) => add(LIGHT, q.x + nx * 0.013, q.y + ny * 0.013, q.z + nz * 0.013, nx, ny, nz, color, 0, blinkSpeed, blinkPhase));
  }
}

function buildStar() {
  const inner = 0.095, thickness = 0.05, step = STEP * 0.55, sector = Math.PI / 5;
  for (let x = -STAR_RADIUS; x <= STAR_RADIUS; x += step) {
    for (let y = -STAR_RADIUS; y <= STAR_RADIUS; y += step) {
      let a = (Math.atan2(y, x) - Math.PI / 2) % (2 * sector);
      if (a < 0) a += 2 * sector;
      if (a > sector) a = 2 * sector - a;
      const edge = (STAR_RADIUS * inner * Math.sin(sector)) / (inner * Math.sin(sector - a) + STAR_RADIUS * Math.sin(a));
      const fromCentre = Math.hypot(x, y) / edge;
      if (fromCentre > 1) continue;
      const bulge = thickness * (1 - fromCentre) + 0.008, glyph = code(fromCentre > 0.62 ? '*' : '#');
      add(STAR, x, STAR_Y + y, bulge, 0, 0, 1, GOLD, glyph);
      add(STAR, x, STAR_Y + y, -bulge, 0, 0, -1, GOLD, glyph);
    }
  }
}

function buildPresent(box) {
  const cx = Math.cos(box.angle) * box.dist, cz = Math.sin(box.angle) * box.dist;
  const c = Math.cos(box.angle + box.turn), s = Math.sin(box.angle + box.turn);
  const hw = box.w / 2, hd = box.d / 2, band = 0.028, paper = code(box.pattern);
  const place = (lx, ly, lz, nx, ny, nz, color, glyph) =>
    add(MATTE, cx + lx * c - lz * s, ly, cz + lx * s + lz * c, nx * c - nz * s, ny, nx * s + nz * c, color, glyph);
  const wrapped = (lx, ly, lz, nx, ny, nz, onRibbon) =>
    place(lx, ly, lz, nx, ny, nz, onRibbon ? box.ribbon : box.paper, onRibbon ? (ny ? PLUS : BAR) : paper);
  for (const side of [-1, 1]) {
    for (let y = STEP / 2; y < box.h; y += STEP) {
      for (let u = -hw; u <= hw; u += STEP) wrapped(u, y, side * hd, 0, 0, side, Math.abs(u) < band);
      for (let v = -hd; v <= hd; v += STEP) wrapped(side * hw, y, v, side, 0, 0, Math.abs(v) < band);
    }
    sphere(70, (nx, ny, nz) => place(side * 0.04 + nx * 0.034, box.h + 0.03 + ny * 0.034, nz * 0.034, nx, ny, nz, box.ribbon, code('&')));
  }
  for (let u = -hw; u <= hw; u += STEP) {
    for (let v = -hd; v <= hd; v += STEP) wrapped(u, box.h, v, 0, 1, 0, Math.abs(u) < band || Math.abs(v) < band);
  }
}

function buildGround() {
  const snow = codes('..,_:');
  for (let i = 0; i < 1700; i++) {
    const radius = 1.5 * Math.sqrt(rand()), angle = rand() * TAU, shade = radius < 0.8 ? 0.55 : 1;
    add(MATTE, radius * Math.cos(angle), 0, radius * Math.sin(angle), 0, 1, 0, [170 * shade, 190 * shade, 225 * shade], pick(snow));
  }
}

function buildGlints() {
  const glint = (radius, y, color, slowest, fastest, angle = rand() * TAU) =>
    add(GLINT, radius * Math.cos(angle), y, radius * Math.sin(angle), 0, 1, 0, color, 0, between(slowest, fastest));
  for (let i = 0; i < 460; i++) {
    const tier = TIERS[pick([0, 0, 0, 0, 1, 1, 1, 2, 2, 3])], t = Math.pow(rand(), 2);
    glint(lerp(tier.r0, tier.r1, t) + 0.03, lerp(tier.y0, tier.y1, t), GOLD, 0.9, 3.2);
  }
  for (let i = 0; i < 44; i++) {
    const radius = between(0.3, 0.55), lift = between(-0.25, 1);
    glint(radius * Math.sqrt(1 - lift * lift), STAR_Y + radius * lift, GOLD, 1.4, 3.6);
  }
  for (let i = 0; i < 90; i++) glint(1.5 * Math.sqrt(rand()), 0.01, ICE, 0.9, 2.6);
}

function buildGlitter() {
  for (let i = 0; i < 170; i++) {
    const point = add(DUST, 0, 0, 0, 0, 1, 0, GOLD, 0, between(2.5, 6));
    motes.push({ point, angle: rand() * TAU, y: between(0.2, 2.6), offset: between(0.08, 0.34), orbit: between(0.2, 0.55), rise: between(0.04, 0.15) });
  }
}

function driftGlitter(dt) {
  for (const mote of motes) {
    mote.y = mote.y > 2.6 ? 0.2 : mote.y + mote.rise * dt;
    mote.angle -= mote.orbit * dt;
    const radius = lerp(1.08, 0.1, clamp(mote.y / 2.3, 0, 1)) + mote.offset;
    mote.point.x = radius * Math.cos(mote.angle);
    mote.point.y = mote.y;
    mote.point.z = radius * Math.sin(mote.angle);
  }
}

buildFoliage();
buildTrunk();
buildBaubles();
buildTinsel(0, GOLD);
buildTinsel(Math.PI, SILVER);
buildLights();
buildStar();
PRESENTS.forEach(buildPresent);
buildGround();
buildGlints();
buildGlitter();
driftGlitter(0);

let r = 0, g = 0, b = 0;
function tone(color, shade, white = 0) {
  r = lerp(color[0] * shade, 255, white);
  g = lerp(color[1] * shade, 255, white);
  b = lerp(color[2] * shade, 255, white);
}
function blend(from, to, t, shade = 1) {
  r = lerp(from[0], to[0], t) * shade;
  g = lerp(from[1], to[1], t) * shade;
  b = lerp(from[2], to[2], t) * shade;
}

export function createTree(canvas, width, height) {
  const ctx = canvas.getContext('2d'), family = getComputedStyle(canvas).fontFamily, bursts = [];
  let dpr, fontSize, cellW, cellH, cols, rows, originX, originY, colsPerUnit, rowsPerUnit, glyphs, depths, rgb;
  let yaw = 0.6, tilt = HOME_TILT, spin = IDLE_SPIN, tiltSpeed = 0, idleDirection = 1, pace = 1, clock = 0;
  let pointer = null, lastX = 0, lastY = 0, lastMove = 0, released = -Infinity, live = true, visible = true, lastFrame = 0;

  function resize(w, h) {
    width = w;
    height = h;
    dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    fontSize = Math.max(MIN_FONT, h / (ROWS * LINE_HEIGHT));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `bold ${fontSize}px ${family}`;
    ctx.textBaseline = 'top';
    cellW = ctx.measureText('M').width || fontSize * 0.6;
    cellH = fontSize * LINE_HEIGHT;
    cols = Math.max(1, Math.floor(w / cellW));
    rows = Math.max(1, Math.floor(h / cellH));
    originX = (w - cols * cellW) / 2;
    originY = (h - rows * cellH) / 2;
    rowsPerUnit = Math.min(rows / 3.3, (cols * cellW) / cellH / 2.8);
    colsPerUnit = (rowsPerUnit * cellH) / cellW;
    glyphs = new Uint16Array(cols * rows);
    depths = new Float32Array(cols * rows);
    rgb = new Uint8ClampedArray(cols * rows * 3);
    rasterize();
    paint();
  }

  function stamp(col, row, glyph, red, green, blue, over) {
    const cell = row * cols + col;
    if (col < 0 || col >= cols || row < 0 || row >= rows || (glyphs[cell] && !over)) return;
    glyphs[cell] = glyph;
    rgb[cell * 3] = red;
    rgb[cell * 3 + 1] = green;
    rgb[cell * 3 + 2] = blue;
  }

  function rasterize() {
    glyphs.fill(0);
    depths.fill(Infinity);
    bursts.length = 0;
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw), cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
    const midCol = cols / 2, midRow = rows * 0.485, starPulse = 0.5 + 0.5 * Math.sin(clock * 2.6);

    for (const p of points) {
      const x = p.x * cosYaw - p.z * sinYaw, zSpun = p.x * sinYaw + p.z * cosYaw, yLocal = p.y - PIVOT_Y;
      const y = yLocal * cosTilt + zSpun * sinTilt, z = zSpun * cosTilt - yLocal * sinTilt;
      const depth = CAMERA + z, scale = CAMERA / depth;
      const col = Math.floor(midCol + x * scale * colsPerUnit), row = Math.floor(midRow - y * scale * rowsPerUnit);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const cell = row * cols + col, biased = depth - DEPTH_BIAS[p.kind];
      if (biased >= depths[cell]) continue;

      const nx = p.nx * cosYaw - p.nz * sinYaw, nzSpun = p.nx * sinYaw + p.nz * cosYaw;
      const ny = p.ny * cosTilt + nzSpun * sinTilt, nz = nzSpun * cosTilt - p.ny * sinTilt;
      const facing = nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1] + nz * LIGHT_DIR[2], lit = Math.max(0, facing);
      let glyph = p.glyph, haze = p.kind >= LIGHT ? 1 : clamp(1 - 0.18 * z, 0.7, 1.2);

      if (p.kind === FOLIAGE) {
        const wrap = facing * 0.5 + 0.5, shade = clamp((0.15 + 0.85 * wrap * wrap) * p.a + (p.seed - 0.5) * 0.3, 0, 1);
        glyph = FOLIAGE_RAMP[Math.round(shade * (FOLIAGE_RAMP.length - 1))];
        blend(FOLIAGE_DARK, FOLIAGE_LIT, shade);
      } else if (p.kind === MATTE) {
        tone(p.color, 0.35 + 0.65 * lit);
      } else if (p.kind === BAUBLE) {
        const flare = lit > 0.86 && Math.sin(clock * 1.9 + p.a) > 0.5;
        glyph = flare ? ASTERISK : lit > 0.8 ? AT : lit > 0.2 ? BIG_O : SMALL_O;
        tone(p.color, 0.4 + 0.7 * lit, flare ? 1 : lit > 0.9 ? (lit - 0.9) * 6 : 0);
        if (flare) haze = 1;
      } else if (p.kind === TINSEL) {
        const shimmer = 0.5 + 0.5 * Math.sin(p.a * 140 - clock * 5 + p.seed * 2);
        glyph = shimmer > 0.9 ? ASTERISK : TILDE;
        tone(p.color, lerp(0.55, 1, shimmer), shimmer / 2);
      } else if (p.kind === STAR) {
        blend(STAR_WARM, STAR_HOT, starPulse * 0.75, 0.62 + 0.38 * Math.abs(nz));
      } else {
        const wave = Math.sin(clock * p.a + p.seed * TAU), glow = 0.5 + 0.5 * wave, flash = Math.pow(Math.max(0, wave), 14);
        if (p.kind === LIGHT) {
          glyph = glow > 0.66 ? ASTERISK : glow > 0.3 ? PLUS : DOT;
          tone(p.color, 0.3 + 0.7 * glow, glow > 0.85 ? (glow - 0.85) * 3 : 0);
        } else if (p.kind === GLINT) {
          if (flash < 0.2) continue;
          glyph = flash > 0.6 ? ASTERISK : PLUS;
          tone(p.color, 1, flash);
          if (flash > 0.78) bursts.push(cell, biased, flash);
        } else {
          if (glow < 0.3) continue;
          glyph = glow > 0.88 ? ASTERISK : glow > 0.6 ? PLUS : DOT;
          blend(DUST_DIM, DUST_BRIGHT, glow, 0.5 + 0.5 * glow);
        }
      }
      depths[cell] = biased;
      stamp(col, row, glyph, r * haze, g * haze, b * haze, true);
    }

    const reach = Math.round(starPulse * 4), starLocal = STAR_Y - PIVOT_Y, starScale = CAMERA / (CAMERA - starLocal * sinTilt);
    const starRow = Math.floor(midRow - starLocal * cosTilt * starScale * rowsPerUnit), clear = STAR_RADIUS * starScale * rowsPerUnit + 1;
    for (const [dx, dy, glyph] of RAYS) {
      for (let k = 0; k < reach; k++) {
        const fade = 1 - (0.75 * k) / reach, col = Math.floor(midCol) + Math.round((dx * (clear + k) * cellH) / cellW);
        stamp(col, starRow + Math.round(dy * (clear + k)), glyph, 255 * fade, 232 * fade, 150 * fade, false);
      }
    }

    for (let i = 0; i < bursts.length; i += 3) {
      const cell = bursts[i], col = cell % cols, row = (cell - col) / cols;
      if (depths[cell] !== Math.fround(bursts[i + 1])) continue;
      SPARKLE.forEach(([dx, dy, glyph, strength], arm) => {
        if (arm < 2 || bursts[i + 2] > 0.9) stamp(col + dx, row + dy, glyph, 255 * strength, 243 * strength, 213 * strength, true);
      });
    }
  }

  function paint() {
    ctx.clearRect(0, 0, width, height);
    const inset = (cellH - fontSize) / 2;
    let lastColor = -1;
    for (let cell = 0; cell < glyphs.length; cell++) {
      if (!glyphs[cell]) continue;
      const col = cell % cols, row = (cell - col) / cols, color = (rgb[cell * 3] << 16) | (rgb[cell * 3 + 1] << 8) | rgb[cell * 3 + 2];
      if (color !== lastColor) {
        ctx.fillStyle = `rgb(${rgb[cell * 3]},${rgb[cell * 3 + 1]},${rgb[cell * 3 + 2]})`;
        lastColor = color;
      }
      ctx.fillText(String.fromCharCode(glyphs[cell]), originX + col * cellW, originY + row * cellH + inset);
    }
  }

  function frame(now) {
    if (!live) return;
    requestAnimationFrame(frame);
    if (now - lastFrame < FRAME_MS) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    clock += dt * pace;
    if (pointer === null) {
      spin += (idleDirection * IDLE_SPIN * pace - spin) * (1 - Math.exp(-dt * 1.5));
      yaw += spin * dt;
      tiltSpeed *= Math.exp(-dt * 5);
      tilt = clamp(tilt + tiltSpeed * dt, MIN_TILT, MAX_TILT);
      if (now - released > 2000) tilt += (HOME_TILT - tilt) * (1 - Math.exp(-dt * 1.2));
    }
    driftGlitter(dt * pace);
    if (dpr !== Math.min(devicePixelRatio || 1, MAX_DPR)) resize(width, height);
    else if (visible) {
      rasterize();
      paint();
    }
  }

  function onDown(event) {
    if (!live || pointer !== null || event.button) return;
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    lastX = event.clientX;
    lastY = event.clientY;
    lastMove = event.timeStamp;
    spin = tiltSpeed = 0;
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
  }

  function onMove(event) {
    if (event.pointerId !== pointer) return;
    const dt = Math.max(0.001, (event.timeStamp - lastMove) / 1000), radiansPerPixel = 1 / (0.6 * colsPerUnit * cellW);
    const turned = (event.clientX - lastX) * radiansPerPixel, tipped = (event.clientY - lastY) * radiansPerPixel * 0.7;
    yaw += turned;
    tilt = clamp(tilt + tipped, MIN_TILT, MAX_TILT);
    spin = lerp(spin, turned / dt, 0.5);
    tiltSpeed = lerp(tiltSpeed, tipped / dt, 0.5);
    lastX = event.clientX;
    lastY = event.clientY;
    lastMove = event.timeStamp;
  }

  function onUp(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (event.timeStamp - lastMove > 90) spin = tiltSpeed = 0;
    spin = clamp(spin, -14, 14);
    tiltSpeed = clamp(tiltSpeed, -4, 4);
    if (Math.abs(spin) > 0.4) idleDirection = Math.sign(spin);
    released = event.timeStamp;
    canvas.style.cursor = live ? 'grab' : '';
  }

  const watcher = new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; });
  watcher.observe(canvas);
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  resize(width, height);
  requestAnimationFrame(frame);

  return {
    resize,
    calm(on) { pace = on ? 0.25 : 1; },
    stop() {
      live = false;
      watcher.disconnect();
      canvas.style.cursor = '';
    },
  };
}
