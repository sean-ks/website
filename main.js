/* Sean Shiroma / field lines - v26.10. Progressive enhancement; one rAF loop; layout reads on resize only. */
(() => {
'use strict';
const d = document, root = d.documentElement, win = window, perf = performance;
const $ = (s, c) => (c || d).querySelector(s), $$ = (s, c) => (c || d).querySelectorAll(s);
const mq = (q) => win.matchMedia(q);
const onMQ = (m, fn) => (m.addEventListener ? m.addEventListener('change', fn) : m.addListener(fn));
const txt = (n, s) => { if (n && n.textContent !== s) n.textContent = s; };
const pad = (n, k) => String(n).padStart(k, '0');
const c01 = (x) => Math.min(1, Math.max(0, x));
const mqReduce = mq('(prefers-reduced-motion:reduce)'), mqDark = mq('(prefers-color-scheme:dark)'), mqPhone = mq('(max-width:640px)');
let reduced = mqReduce.matches;
const DPR = () => win.devicePixelRatio || 1;
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : mqDark.matches);

/* one rAF loop */
const tasks = new Set();
let raf = 0, last = 0;
const kick = () => { if (!raf && !d.hidden) raf = requestAnimationFrame(frame); };
function frame(now) {
	raf = 0;
	const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
	last = now;
	let again = false;
	for (const t of tasks) { if (t(now, dt)) again = true; else tasks.delete(t); }
	if (again) kick(); else last = 0;
}
const run = (t) => { tasks.add(t); kick(); };

/* event log: real events, mm:ss.cs */
const logEl = $('#log'), flog = $('#flog'), evn = $('#evn'), led = $('.led');
const lines = [];
let nEv = 0, booted = false;
const stamp = (ms) => {
	const cs = Math.floor(ms / 10);
	return pad(Math.floor(cs / 6000) % 100, 2) + ':' + pad(Math.floor(cs / 100) % 60, 2) + '.' + pad(cs % 100, 2);
};
const showLog = () => txt(logEl, lines.slice(mqPhone.matches ? -2 : -4).join('\n'));
function log(s) {
	const l = stamp(perf.now()) + ' ' + s;
	lines.push(l);
	if (lines.length > 4) lines.shift();
	showLog(); txt(flog, l); txt(evn, pad(++nEv % 1000, 3));
	if (!reduced && led && led.animate) led.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
}
onMQ(mqPhone, showLog);
const say = $('#say');

/* theme */
let field = null;
const metas = $$('meta[name="theme-color"]');
const syncMeta = () => {
	if (root.dataset.theme) metas.forEach((m) => m.setAttribute('content', root.dataset.theme === 'dark' ? '#0b0c0d' : '#ecebe5'));
};
const thB = $('#theme'), thL = () => thB.setAttribute('aria-label', 'Switch to ' + (isDark() ? 'light' : 'dark') + ' theme');
const toggleTheme = () => {
	const t = isDark() ? 'light' : 'dark';
	root.dataset.theme = t;
	try { localStorage.setItem('theme', t); } catch (e) {}
	syncMeta(); thL(); log('theme ' + t);
	if (field) field.recolor();
};
syncMeta(); thL();
thB.addEventListener('click', toggleTheme);
onMQ(mqDark, () => {
	if (root.dataset.theme) return;
	thL(); log('theme ' + (mqDark.matches ? 'dark' : 'light') + ' (system)');
	if (field) field.recolor();
});

/* clock (New York) */
const clockEl = $('#clock');
let fmt = null;
try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); } catch (e) {}
(function tick() {
	if (fmt && !d.hidden) txt(clockEl, fmt.format(new Date()));
	setTimeout(tick, 1005 - (Date.now() % 1000));
})();

/* scramble-decode (decorative labels) */
const GL = '01/\\<>[]#+=_:';
function scramble(el, fin, dur) {
	const n = fin.length;
	let t0 = 0;
	if (el._sc) tasks.delete(el._sc);
	const sc = (now) => {
		if (!t0) t0 = now;
		const p = Math.min((now - t0) / dur, 1), k = Math.floor(p * p * n);
		let s = fin.slice(0, k);
		for (let i = k; i < n; i++) s += fin[i] === ' ' ? ' ' : GL[(Math.random() * GL.length) | 0];
		txt(el, p < 1 ? s : fin);
		return p < 1;
	};
	el._sc = sc; run(sc);
}

/* corner brackets follow the hovered item */
function Brackets(box) {
	const items = [...box.children], sec = box.closest('.sec'), sel = $('.sel', sec);
	const b = d.createElement('div');
	b.className = 'brk'; b.innerHTML = '<i></i><i></i><i></i><i></i>';
	sec.appendChild(b);
	const cs = b.children, S = 12, I = 5;
	let geo = [], cur = -1, shown = false;
	const tr = (e, x, y) => { e.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; };
	function place(i, instant) {
		const g = geo[i];
		if (!g) return;
		const x0 = g[0] + I, y0 = g[1] + I, x1 = g[0] + g[2] - I - S, y1 = g[1] + g[3] - I - S;
		const jump = instant || !shown || reduced;
		if (jump) b.classList.add('jump');
		tr(cs[0], x0, y0); tr(cs[1], x1, y0); tr(cs[2], x0, y1); tr(cs[3], x1, y1);
		if (jump) { getComputedStyle(cs[0]).transform; b.classList.remove('jump'); }
		b.classList.add('on'); shown = true; cur = i;
		txt(sel, ' / sel ' + pad(i + 1, 2));
	}
	function hide() { b.classList.remove('on'); shown = false; cur = -1; txt(sel, ''); }
	box.addEventListener('pointerover', (e) => {
		const i = items.findIndex((it) => it.contains(e.target));
		if (i >= 0 && i !== cur) place(i);
	});
	box.addEventListener('pointerleave', hide);
	return {
		measure() {
			geo = items.map((e) => [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight]);
			if (cur >= 0) place(cur, true);
		}
	};
}
const brk = [...$$('[data-brk]')].map(Brackets);

/* in view = below the sticky header */
const vis = [];
let ioM = '0px', ios = [];
function reIO() {
	ios.forEach((o) => o.disconnect());
	ios = vis.map((v) => { const o = new IntersectionObserver(v[1], { rootMargin: ioM + ' 0px 0px' }); v[0].forEach((e) => o.observe(e)); return o; });
}
const onVis = (els, fn) => { if (win.IntersectionObserver) { vis.push([els, fn]); reIO(); } };

/* rulers, scroll readout, section tracker */
const mkX = $('.fr-t .mk'), mkY = $('.fr-l .mk'), th = $('.fr-l .th');
const spEl = $('#sp'), snEl = $('#sn'), slEl = $('#sl'), navA = $$('.nav a'), secs = [...$$('[data-sec]')];
let mx = 0, my = 0, sy = win.scrollY, mDirty = false, sDirty = true, ptrShown = false, thK = 0, thF = 0, maxS = 1, vh = 1, tops = [];
let curSec = null;
function setSec(s) {
	if (!s || s === curSec) return;
	const first = !curSec, parts = s.dataset.sec.split(' '), n = parts[0], name = parts.slice(1).join(' ');
	curSec = s;
	txt(snEl, n);
	if (first || reduced) txt(slEl, name); else scramble(slEl, name, 320);
	navA.forEach((a, i) => (i === +n - 1 ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
	if (!first && booted) log('sec ' + n + ' ' + name.toLowerCase());
}
function ui() {
	if (mDirty) {
		mkX.style.transform = 'translate3d(' + mx + 'px,0,0)';
		mkY.style.transform = 'translate3d(0,' + my + 'px,0)';
		if (!ptrShown) { root.classList.add('ptr'); ptrShown = true; }
		mDirty = false;
	}
	if (sDirty) {
		const p = c01(sy / maxS);
		txt(spEl, pad(Math.round(p * 100), 3) + '%');
		if (thK) th.style.transform = 'translate3d(0,' + (thF + sy * thK).toFixed(1) + 'px,0)';
		const ln = sy >= maxS - 2 ? Infinity : sy + vh * 0.3;
		let k = 0;
		tops.forEach((t, i) => { if (t <= ln) k = i; });
		setSec(secs[k]);
		sDirty = false;
	}
	return false;
}
function measure() {
	const cs = getComputedStyle(root), dh = root.scrollHeight;
	vh = win.innerHeight; sy = win.scrollY;
	maxS = Math.max(1, dh - vh);
	tops = secs.map((s) => s.getBoundingClientRect().top + sy);
	thF = parseFloat(cs.getPropertyValue('--f')) || 0;
	const m = -Math.round(thF + (parseFloat(cs.getPropertyValue('--hh')) || 0) + 1) + 'px';
	if (m !== ioM) { ioM = m; reIO(); }
	thK = (vh - 2 * thF) / Math.max(dh, 1);
	th.style.height = (vh * thK).toFixed(1) + 'px';
	if (field) field.place();
	brk.forEach((b) => b.measure());
	sDirty = true; run(ui);
}
win.addEventListener('pointermove', (e) => {
	if (e.pointerType !== 'mouse') return;
	mx = e.clientX; my = e.clientY; mDirty = true; run(ui);
}, { passive: true });
d.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { root.classList.remove('ptr'); ptrShown = false; } });
win.addEventListener('scroll', () => { sy = win.scrollY; sDirty = true; run(ui); }, { passive: true });
win.addEventListener('resize', measure);
win.addEventListener('load', measure);
if (d.fonts && d.fonts.ready) d.fonts.ready.then(measure);
if ('ResizeObserver' in win) new ResizeObserver(measure).observe(d.body);
else measure();

/* tickers + ambient motion run only in view */
$$('.tk-in').forEach((t) => t.appendChild(t.firstElementChild.cloneNode(true)));
onVis([...$$('.tk,[data-brk]')], (es) => { for (const e of es) { e.target.classList.toggle('off', !e.isIntersecting); e.target.classList.toggle('live', e.isIntersecting); } });
if (win.IntersectionObserver) {
	const io = new IntersectionObserver((es) => {
		for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); if (!reduced) scramble(e.target, e.target.textContent, 600); }
	}, { rootMargin: '0px 0px -10% 0px' });
	$$('[data-scramble],.rows .i,.card-t>span:first-child').forEach((el) => io.observe(el));
}

/* photo slot */
const img = $('.photo img');
if (img) {
	const on = () => { if (img.naturalWidth) { img.classList.remove('err'); img.classList.add('on'); } };
	if (img.complete) { if (img.naturalWidth) on(); else img.classList.add('err'); }
	img.addEventListener('load', on);
	img.addEventListener('error', () => img.classList.add('err'));
}

/* copy email */
d.addEventListener('click', (e) => {
	const b = e.target.closest && e.target.closest('[data-copy]');
	if (!b) return;
	const s = b.dataset.copy;
	const done = (ok) => {
		b.textContent = ok ? 'Copied' : 'Selected'; b.classList.toggle('ok', ok);
		if (!ok) { const r = d.createRange(), g = getSelection(); r.selectNodeContents(b.previousElementSibling.lastChild); g.removeAllRanges(); g.addRange(r); }
		txt(say, ok ? 'Email address copied' : 'Address selected');
		log('copy email ' + (ok ? 'ok' : 'blocked · selected'));
		clearTimeout(b._t);
		b._t = setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('ok'); txt(say, ''); }, 1600);
	};
	const fallback = () => {
		const ta = d.createElement('textarea');
		ta.value = s; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
		d.body.appendChild(ta); ta.select();
		let ok = false;
		try { ok = d.execCommand('copy'); } catch (err) {}
		ta.remove(); b.focus(); done(ok);
	};
	if (navigator.clipboard && win.isSecureContext) navigator.clipboard.writeText(s).then(() => done(true), fallback);
	else fallback();
});

/* shortcuts (can be switched off) + visibility */
const kb = $('#keys');
let keys = true;
try { keys = localStorage.getItem('keys') !== '0'; } catch (e) {}
kb.setAttribute('aria-pressed', keys);
kb.addEventListener('click', () => {
	kb.setAttribute('aria-pressed', keys = !keys);
	try { localStorage.setItem('keys', +keys); } catch (e) {}
	log('keys ' + (keys ? 'on' : 'off'));
});
d.addEventListener('keydown', (e) => {
	if (!keys || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
	const t = e.target;
	if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
	const k = (e.key || '').toLowerCase();
	if (k === 't') toggleTheme();
	else if (k === 'p' && field) field.flip();
});
let hidAt = 0;
d.addEventListener('visibilitychange', () => {
	last = 0;
	if (d.hidden) { hidAt = perf.now(); return; }
	if (hidAt) log('resume · hidden ' + ((perf.now() - hidAt) / 1000).toFixed(1) + 's');
	hidAt = 0; kick();
});

/* FIELD: WebGL lines, spring lens, membrane sim */
const SN = `vec3 perm(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float sn(vec2 v){
const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
vec3 p=perm(perm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 a0=x-floor(x+.5);
m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}`;
const VS = (sim) => `precision highp float;
attribute vec3 a;
uniform vec2 uRes;
uniform float uT,uAmp,uSR;
uniform vec4 uLens;
${sim ? 'uniform sampler2D uSim;' : ''}
varying float vT,vM,vX,vL,vH;
varying vec2 vP;
${SN}
void main(){
vec2 p=a.xy;
float A=clamp(uRes.y*.05,12.,32.)*uAmp;
float n1=sn(vec2(p.x*.0021+uT*.045,p.y*.0031-uT*.028));
float n2=sn(vec2(p.x*.0066-uT*.07,p.y*.009+uT*.05+4.7));
p+=vec2(n2*A*.3,(n1+.32*n2)*A);
vec2 s=vec2(0.);
${sim ? 'vec4 tx=texture2D(uSim,clamp(p/uRes,0.,1.));s=(vec2(tx.r,tx.a)*255.-128.)*(uSR/127.);p+=s;' : ''}
vec2 v=p-uLens.xy;float r=max(length(v),.001);float R=uLens.z,q=uLens.w;
float g=q>=0.?(sqrt(r*r+q*q*R*R)-r)/r:q*.86*R*R/(r*r+R*R);
float w=1.-smoothstep(R*1.5,R*4.,r);
vH=smoothstep(.1,.32,r/(R*max(q,.001)));
p+=v*g*w;
vT=clamp(length(s)/15.+smoothstep(.05,.55,abs(g)*w),0.,1.);
vM=step(mod(a.z,8.),.5);
vX=a.x;vL=a.z;vP=p;
vec2 c=p/uRes*2.-1.;
gl_Position=vec4(c.x,-c.y,0.,1.);
}`;
const FS = `precision mediump float;
uniform vec3 uInk,uSig,uA,uHole;
uniform float uFront;
varying float vT,vM,vX,vL,vH;
varying vec2 vP;
void main(){
if(vX+vL*8.>uFront)discard;
float a=mix(uA.x,uA.y,vM)*(1.+vT*uA.z)*vH*smoothstep(uHole.z*.86,uHole.z*.96,length(vP-uHole.xy));
gl_FragColor=vec4(mix(uInk,uSig,vT),min(a,1.));
}`;
const VR = `precision highp float;
attribute vec3 a;
uniform vec2 uRes,uRot;
uniform vec3 uC;
void main(){
vec2 q=a.xy;
float ang=a.z<.5?uRot.y:(a.z<1.5?uRot.x:0.);
float c=cos(ang),s=sin(ang);
q=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
vec2 p=uC.xy+q*(a.z>1.5?min(uC.z,60.):uC.z);
vec2 k=p/uRes*2.-1.;
gl_Position=vec4(k.x,-k.y,0.,1.);
}`;
const FR = 'precision mediump float;uniform vec4 uCol;void main(){gl_FragColor=uCol;}';

/* simplex noise on the CPU (fallback) */
const md289 = (x) => x - 289 * Math.floor(x / 289);
const perm = (x) => md289((x * 34 + 1) * x);
const fract = (x) => x - Math.floor(x);
const corner = (p, ax, ay, m) => {
	if (m <= 0) return 0;
	m *= m; m *= m;
	const x = 2 * fract(p * 0.024390243902439) - 1, h = Math.abs(x) - 0.5, a0 = x - Math.floor(x + 0.5);
	return m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h)) * (a0 * ax + h * ay);
};
function sn(vx, vy) {
	const C0 = 0.211324865405187, C1 = 0.366025403784439, C2 = -0.577350269189626;
	let ix = Math.floor(vx + (vx + vy) * C1), iy = Math.floor(vy + (vx + vy) * C1);
	const x0 = vx - ix + (ix + iy) * C0, y0 = vy - iy + (ix + iy) * C0, i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
	const x1 = x0 + C0 - i1, y1 = y0 + C0 - j1, x2 = x0 + C2, y2 = y0 + C2;
	ix = md289(ix); iy = md289(iy);
	return 130 * (corner(perm(perm(iy) + ix), x0, y0, 0.5 - x0 * x0 - y0 * y0) +
		corner(perm(perm(iy + j1) + ix + i1), x1, y1, 0.5 - x1 * x1 - y1 * y1) +
		corner(perm(perm(iy + 1) + ix + 1), x2, y2, 0.5 - x2 * x2 - y2 * y2));
}
/* reticle: dashed ring 0, ticks 1, crosshair 2 */
const RET = [];
for (let i = 0; i < 40; i++) { const a = i / 40 * 6.2832, b = a + 0.0864; RET.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0); }
for (let i = 0; i < 72; i++) { const a = i / 72 * 6.2832, c = Math.cos(a), s = Math.sin(a), o = i % 6 ? 1.2 : 1.3; RET.push(c * 1.13, s * 1.13, 1, c * o, s * o, 1); }
RET.push(-0.42, 0, 2, -0.16, 0, 2, 0.16, 0, 2, 0.42, 0, 2, 0, -0.42, 2, 0, -0.16, 2, 0, 0.16, 2, 0, 0.42, 2);
const CUE = 162;
const sstep = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function Field(wrap) { // a module: its body is not indented
const cv = $('#gl', wrap), el = (id) => d.getElementById(id);
const E = {};
for (const k of ['px', 'py', 'pq', 'pm', 'cpu', 'spark', 'polv', 'axl', 'mxy', 'bits']) E[k] = el(k);
const axm = $('.axm', wrap), ring = $('.ring', wrap), mark = el('mark'), mmx = $('.mx', mark), mmy = $('.my', mark), mmd = $('.md', mark);
const noGL = /[?&]gl=0\b/.test(location.search);
const mqBits = mq('(min-width:1181px)'), mqCue = mq('(min-width:901px)');
let gl = null, ok = false, vtf = false, P = null, Q = null, vb, ib, rb, tex, nIdx = 0, nRet = 0, c2 = null, kx = null, pp = null;
let W = 0, H = 0, dpr = 1, small = false, nLines = 0, ox = 0, oy = 0;
let GX = 0, GY = 0, sdx, sdy, svx, svy, sb, maxd = 0, energy = 0, texDirty = true;
const SR = 40;
const L = { x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, q: 1, vq: 0, tq: 1, rot: 0 };
const ptr = { on: false, x: 0, y: 0, type: 'mouse', hold: 0 };
let visible = true, tStart = 0, simT = 0, hudT = 0, cpuMs = 0, fc = 0, acc = 0, prevNow = 0, fx = '', fy = '';
const LV = [[1, 0, 1, 2], [1.3, 3, 1, 2], [1.7, 6, 1, 2], [1.7, 6, 2, 2], [1.7, 6, 2, 1]];
let lvl = 0, gS = 0, gSum = 0, gN = 0, gMin = 1e3, base = 16.7, bad = 0, good = 0, holdUp = 0, backoff = 4000, lastUp = -1e9;
const hist = new Float32Array(32);
let hi = 0, hmax = 30;
const f32 = new Float32Array(2), u32 = new Uint32Array(f32.buffer);
let bctx = null, bitsK = '', pr = 1;
let col = { bg: [0, 0, 0], ink: [1, 1, 1], sig: [0.5, 0.55, 1], s: {} }, dark = true;

const hex = (s) => { const n = parseInt(s.trim().slice(1, 7), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
function readColors() {
	const cs = getComputedStyle(root), g = (k) => cs.getPropertyValue(k).trim(), s = { bg: g('--bg'), ink: g('--ink'), sig: g('--sig'), mute: g('--mute'), off: g('--rule2') };
	col = { bg: hex(s.bg), ink: hex(s.ink), sig: hex(s.sig), s };
	dark = isDark(); bitsK = '';
}

/* compile + link here; status is read in a later task (no forced sync) */
function prog(vs, fs) {
	const p = gl.createProgram();
	[[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach((t) => { const s = gl.createShader(t[0]); gl.shaderSource(s, t[1]); gl.compileShader(s); gl.attachShader(p, s); });
	gl.bindAttribLocation(p, 0, 'a');
	gl.linkProgram(p);
	return p;
}
function linked(p, names) {
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
	const u = {};
	names.forEach((n) => { u[n] = gl.getUniformLocation(p, n); });
	return { p, u };
}
function begin() {
	if (noGL) return false;
	try {
		gl = gl || cv.getContext('webgl', { antialias: DPR() < 1.5, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'default' });
	} catch (e) { gl = null; }
	if (!gl || gl.isContextLost()) return false;
	vtf = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0;
	kx = gl.getExtension('KHR_parallel_shader_compile');
	pp = [prog(VS(vtf), FS), prog(VR, FR)];
	return true;
}
const ready = () => !kx || pp.every((p) => gl.getProgramParameter(p, kx.COMPLETION_STATUS_KHR));
function finish() {
	const U = ['uRes', 'uT', 'uAmp', 'uSR', 'uLens', 'uSim', 'uInk', 'uSig', 'uA', 'uFront', 'uHole'];
	let pr = linked(pp[0], U);
	if (!pr && vtf) { vtf = false; pr = linked(prog(VS(false), FS), U); }
	const rq = linked(pp[1], ['uRes', 'uC', 'uRot', 'uCol']);
	if (!pr || !rq) return false;
	P = pr; Q = rq;
	vb = gl.createBuffer(); ib = gl.createBuffer(); rb = gl.createBuffer();
	nRet = RET.length / 3;
	gl.bindBuffer(gl.ARRAY_BUFFER, rb);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(RET), gl.STATIC_DRAW);
	if (vtf) {
		tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		[[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach((t) => gl.texParameteri(gl.TEXTURE_2D, t[0], t[1]));
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	}
	gl.disable(gl.DEPTH_TEST);
	gl.enableVertexAttribArray(0);
	return true;
}

/* geometry + sim grid */
function build() {
	const q = LV[lvl][0], sp = (small ? 6 : 4.5) * q, pd = 48;
	let seg = Math.round((small ? 7 : 4) * q);
	const ny = Math.ceil((H + 2 * pd) / sp) + 1;
	let nx = Math.ceil((W + 2 * pd) / seg) + 1;
	while (nx * ny > 65000) { seg += 1; nx = Math.ceil((W + 2 * pd) / seg) + 1; }
	const v = new Float32Array(nx * ny * 3), ix = new Uint16Array((nx - 1) * ny * 2);
	let k = 0, m = 0;
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { v[k++] = -pd + i * seg; v[k++] = -pd + j * sp; v[k++] = j; }
	for (let j = 0; j < ny; j++) for (let i = 0, b = j * nx; i < nx - 1; i++) { ix[m++] = b + i; ix[m++] = b + i + 1; }
	nIdx = m; nLines = ny;
	gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
	if (vtf) {
		const cell = (small ? 18 : 15) + LV[lvl][1];
		GX = Math.max(8, Math.round(W / cell)); GY = Math.max(6, Math.round(H / cell));
		const n = GX * GY;
		sdx = new Float32Array(n); sdy = new Float32Array(n); svx = new Float32Array(n); svy = new Float32Array(n);
		sb = new Uint8Array(n * 2).fill(128);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, GX, GY, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, sb);
		texDirty = false; maxd = 0;
	}
}
function axis() {
	let h = '<span style="left:0">0000</span>';
	for (let x = 100, e = W - (mqCue.matches ? CUE : 30); x < e; x += 100) h += '<span style="left:' + x + 'px">' + pad(x, 4) + '</span>';
	E.axl.innerHTML = h;
}
function resize(w, h) {
	W = Math.max(2, Math.round(w)); H = Math.max(2, Math.round(h));
	small = W < 640 || mq('(pointer: coarse)').matches;
	dpr = Math.min(DPR(), LV[lvl][3]);
	mark.style.setProperty('--fa', (W / H).toFixed(3));
	axis();
	if (E.bits) {
		const k = Math.min(DPR(), 2);
		E.bits.width = 131 * k; E.bits.height = 7 * k;
		bctx = E.bits.getContext('2d');
		if (bctx) bctx.setTransform(k, 0, 0, k, 0, 0);
		bitsK = '';
	}
	if (!ok) { if (c2) cpuDraw(); return; }
	cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
	build();
	if (!tStart) { const a = auto(9); L.x = a.x; L.y = a.y; L.r = baseR(); }
	if (reduced || !visible) still();
}
const baseR = () => Math.max(40, Math.min(118, Math.min(W, H) * 0.17));
const auto = (t) => ({
	x: W * (0.52 + 0.3 * Math.sin(t * 0.13 + 1.1) + 0.07 * Math.sin(t * 0.37)),
	y: H * (0.5 + 0.25 * Math.sin(t * 0.19 + 0.3) + 0.07 * Math.sin(t * 0.53 + 2))
});

function lensStep(h, t, now) {
	let tx, ty, tr;
	if (ptr.on || now < ptr.hold) { tx = ptr.x; ty = ptr.y; tr = baseR() * 1.12; } else { const a = auto(t); tx = a.x; ty = a.y; tr = baseR(); }
	L.vx += (70 * (tx - L.x) - 11 * L.vx) * h; L.vy += (70 * (ty - L.y) - 11 * L.vy) * h;
	L.x += L.vx * h; L.y += L.vy * h;
	L.vr += (90 * (tr - L.r) - 9 * L.vr) * h; L.r += L.vr * h;
	L.vq += (110 * (L.tq - L.q) - 8 * L.vq) * h; L.q += L.vq * h;
	if (L.q > 1.25) { L.q = 1.25; L.vq = 0; } else if (L.q < -1.25) { L.q = -1.25; L.vq = 0; }
}
function simStep(h) {
	const K = 16, C = 240, D = 2.3, n = GX * GY, cw = W / GX, ch = H / GY, sp = Math.hypot(L.vx, L.vy);
	if (sp > 6) {
		const rho = Math.max(L.r * 0.95, 36), r2m = rho * rho, gain = 1.6 * sp / (sp + 420) * h;
		const cl = Math.min(1, 1400 / sp), vx = L.vx * cl, vy = L.vy * cl;
		const i0 = Math.max(0, ((L.x - rho) / cw) | 0), i1 = Math.min(GX - 1, Math.ceil((L.x + rho) / cw));
		const j0 = Math.max(0, ((L.y - rho) / ch) | 0), j1 = Math.min(GY - 1, Math.ceil((L.y + rho) / ch));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const x = (i + 0.5) * cw - L.x, y = (j + 0.5) * ch - L.y, r2 = x * x + y * y;
			if (r2 < r2m) { const w = 1 - r2 / r2m, f = w * w * gain, k = j * GX + i; svx[k] += vx * f; svy[k] += vy * f; }
		}
	}
	for (let j = 0; j < GY; j++) {
		const up = j > 0 ? -GX : 0, dn = j < GY - 1 ? GX : 0;
		for (let i = 0; i < GX; i++) {
			const k = j * GX + i, l = i > 0 ? k - 1 : k, r = i < GX - 1 ? k + 1 : k, x = sdx[k], y = sdy[k];
			svx[k] += (C * (sdx[l] + sdx[r] + sdx[k + up] + sdx[k + dn] - 4 * x) - K * x - D * svx[k]) * h;
			svy[k] += (C * (sdy[l] + sdy[r] + sdy[k + up] + sdy[k + dn] - 4 * y) - K * y - D * svy[k]) * h;
		}
	}
	let e = 0, m = 0;
	for (let k = 0; k < n; k++) {
		const a = svx[k], b = svy[k];
		sdx[k] += a * h; sdy[k] += b * h; e += a * a + b * b;
		const ax = Math.abs(sdx[k]), ay = Math.abs(sdy[k]);
		if (ax > m) m = ax;
		if (ay > m) m = ay;
	}
	energy = e / n; maxd = m;
}
function shock(sign, cx, cy) {
	if (!vtf || !sdx) return;
	const cw = W / GX, ch = H / GY, R0 = L.r * 0.8, s = L.r * 0.5, amp = Math.min(cw, ch) * 40 * sign;
	for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
		const x = (i + 0.5) * cw - cx, y = (j + 0.5) * ch - cy, r = Math.hypot(x, y) || 1, z = (r - R0) / s;
		const w = Math.exp(-z * z) * amp / r, k = j * GX + i;
		svx[k] += x * w; svy[k] += y * w;
	}
}
function upload() {
	const s = 127 / SR, n = GX * GY;
	for (let k = 0, o = 0; k < n; k++, o += 2) {
		const a = 128 + sdx[k] * s, b = 128 + sdy[k] * s;
		sb[o] = a < 0 ? 0 : a > 255 ? 255 : a + 0.5;
		sb[o + 1] = b < 0 ? 0 : b > 255 ? 255 : b + 0.5;
	}
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GX, GY, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, sb);
}

function draw(t, amp, front) {
	gl.viewport(0, 0, cv.width, cv.height);
	gl.clearColor(col.bg[0], col.bg[1], col.bg[2], 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.BLEND);
	if (dark) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	const u = P.u, hi2 = dpr > 1.3;
	gl.useProgram(P.p);
	gl.bindBuffer(gl.ARRAY_BUFFER, vb);
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
	gl.uniform2f(u.uRes, W, H);
	gl.uniform1f(u.uT, t);
	gl.uniform1f(u.uAmp, amp);
	gl.uniform1f(u.uSR, SR);
	gl.uniform4f(u.uLens, L.x, L.y, Math.max(L.r, 1), L.q);
	gl.uniform3f(u.uHole, L.x, L.y, Math.max(L.r * L.q, 0.001));
	gl.uniform3fv(u.uInk, col.ink);
	gl.uniform3fv(u.uSig, col.sig);
	if (dark) gl.uniform3f(u.uA, hi2 ? 0.5 : 0.36, hi2 ? 1 : 0.8, 0.9);
	else gl.uniform3f(u.uA, hi2 ? 0.7 : 0.5, 1, 0.5);
	gl.uniform1f(u.uFront, front);
	if (vtf) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u.uSim, 0); }
	gl.drawElements(gl.LINES, nIdx, gl.UNSIGNED_SHORT, 0);
	const v = Q.u, rr = L.r * (0.62 + 0.36 * Math.max(L.q, 0) + 0.12 * Math.max(-L.q, 0));
	gl.useProgram(Q.p);
	gl.bindBuffer(gl.ARRAY_BUFFER, rb);
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
	gl.uniform2f(v.uRes, W, H);
	gl.uniform3f(v.uC, L.x, L.y, rr);
	gl.uniform2f(v.uRot, L.rot, -L.rot * 0.6);
	gl.uniform4f(v.uCol, col.sig[0], col.sig[1], col.sig[2], Math.min(1, amp) * 0.95);
	gl.drawArrays(gl.LINES, 0, Math.round(nRet * c01(front / (W * 1.4))) & ~1);
}
/* minimap + axis marker */
function follow() {
	const sx = (c01(L.x / W) * 100).toFixed(1), sy2 = (c01(L.y / H) * 100).toFixed(1);
	if (sx !== fx || sy2 !== fy) {
		fx = sx; fy = sy2;
		mmx.style.transform = 'translate3d(' + sx + '%,0,0)';
		mmy.style.transform = 'translate3d(0,' + sy2 + '%,0)';
		mmd.style.transform = 'translate3d(' + sx + '%,' + sy2 + '%,0)';
	}
	axm.style.transform = 'translate3d(' + L.x.toFixed(1) + 'px,0,0)';
}
function bits() {
	if (!bctx || !mqBits.matches) return;
	f32[0] = L.x; f32[1] = L.y;
	const k = u32[0] + ':' + u32[1];
	if (k === bitsK) return;
	bitsK = k;
	const c = bctx, s = col.s;
	c.clearRect(0, 0, 131, 7);
	for (let r = 0; r < 2; r++) for (let b = 0; b < 32; b++) {
		c.fillStyle = (u32[r] >>> (31 - b)) & 1 ? (b ? (b < 9 ? s.ink : s.mute) : s.sig) : s.off;
		c.fillRect(b * 4 + (b > 0) + (b > 8), r * 4, 3, 3);
	}
}
function hud() {
	const x = pad(Math.max(0, Math.round(L.x)), 4), y = pad(Math.max(0, Math.round(L.y)), 4);
	txt(E.px, x); txt(E.py, y);
	if (E.mxy.dataset.xy !== x + ',' + y) E.mxy.dataset.xy = x + ',' + y;
	txt(E.pq, (L.q < 0 ? '−' : '+') + Math.abs(L.q).toFixed(2));
	txt(E.pm, ptr.on ? (ptr.type === 'mouse' ? 'Pointer' : 'Touch') : reduced ? 'Still' : 'Auto');
	if (DPR() !== pr) onDpr();
	bits();
	if (reduced) { txt(E.cpu, '-.--'); return; }
	txt(E.cpu, cpuMs.toFixed(2));
	hist[hi] = Math.sqrt(energy) + Math.hypot(L.vx, L.vy) * 0.05; hi = (hi + 1) % hist.length;
	let m = 24;
	for (let i = 0; i < hist.length; i++) if (hist[i] > m) m = hist[i];
	hmax += (m - hmax) * 0.2;
	let s = '';
	for (let i = 0; i < hist.length; i++) s += (i * 64 / (hist.length - 1)).toFixed(1) + ',' + (13 - Math.min(1, hist[(hi + i) % hist.length] / hmax) * 12).toFixed(1) + ' ';
	E.spark.setAttribute('points', s);
}

/* governor. LV: [line spacing, sim cell +px, frame skip, dpr cap]. Thresholds are relative
   to the best interval per window (vsync, or a 30 Hz low-power rAF cap) */
function setLvl(n, avg) {
	const up = n < lvl, k = Math.min(DPR(), LV[n][3]);
	lvl = n;
	if (k !== dpr) { dpr = k; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
	build();
	log('gov L' + n + (up ? ' ↑ ' : ' ↓ ') + avg.toFixed(0) + 'ms · ' + nLines + ' lines' + (LV[n][2] > 1 ? ' · 1/' + LV[n][2] : '') + (LV[n][3] < 2 ? ' · dpr ' + dpr.toFixed(1) : ''));
}
function govern(now, iv) {
	if (now - tStart < 1500 || iv > 250) return;
	if (!gS) gS = now;
	gSum += iv; gN++;
	if (iv < gMin) gMin = iv;
	if (now - gS < 1000) return;
	const avg = gSum / gN;
	base = gMin;
	gS = now; gSum = gN = 0; gMin = 1e3;
	if (avg > Math.max(base * 1.45, 20)) {
		good = 0;
		if (++bad >= 2 && lvl < (base > 25 ? 2 : LV.length - 1)) {
			if (now - lastUp < 8000) backoff = Math.min(backoff * 2, 64000);
			bad = 0; holdUp = now + backoff; setLvl(lvl + 1, avg);
		}
	} else if (avg < Math.max(base * 1.12, 18.5)) {
		bad = 0;
		if (++good >= 4 && lvl > 0 && now > holdUp) { good = 0; lastUp = now; holdUp = now + 3000; setLvl(lvl - 1, avg); }
	} else bad = good = 0;
}

function step(now, dt) {
	if (!ok || !visible || reduced) return false;
	if (!tStart) tStart = now;
	if (prevNow) govern(now, now - prevNow);
	prevNow = now; acc += dt;
	if (++fc % LV[lvl][2]) return true;
	const t0 = perf.now(), el = (now - tStart) / 1000;
	let rem = Math.min(acc, 0.1);
	acc = 0;
	while (rem > 1e-4) {
		const h = Math.min(rem, 1 / 90);
		simT += h; lensStep(h, simT, now);
		if (vtf) simStep(h);
		rem -= h;
	}
	L.rot += dt * LV[lvl][2] * (0.25 + Math.abs(L.vq) * 0.08);
	if (vtf && (maxd > 0.02 || texDirty)) { upload(); texDirty = maxd > 0.02; }
	const e = Math.min(1, el / 1.2), amp = 0.25 + 0.75 * (1 - Math.pow(1 - e, 3));
	draw(simT, amp, (el - 0.1) * 4000);
	follow();
	cpuMs += (perf.now() - t0 - cpuMs) * 0.05;
	if (now - hudT > 100) { hudT = now; hud(); }
	return true;
}
function still() {
	if (!ok || gl.isContextLost()) return;
	if (ptr.on || perf.now() < ptr.hold) { L.x = ptr.x; L.y = ptr.y; } else { const a = auto(9); L.x = a.x; L.y = a.y; }
	L.r = baseR(); L.q = L.tq; L.vx = L.vy = 0;
	draw(simT || 9, 1, 1e6); follow(); hud();
}
const stillTask = () => { still(); return false; };
function start() {
	prevNow = gS = gSum = gN = 0; gMin = 1e3;
	if (!ok) return;
	run(reduced || !visible ? stillTask : step);
}

/* no WebGL: one static 2D frame */
function cpuDraw() {
	const k = Math.min(DPR(), 2), c = c2.getContext('2d');
	if (!c) return;
	c2.width = Math.round(W * k); c2.height = Math.round(H * k);
	c.setTransform(k, 0, 0, k, 0, 0);
	const s = col.s, a = auto(9), R = baseR(), q = L.tq, T = 9, A = Math.min(32, Math.max(12, H * 0.05));
	const sp = small ? 6 : 4.5, sg = 5, pd = 48, paths = [new Path2D(), new Path2D(), new Path2D()];
	L.x = a.x; L.y = a.y; L.r = R;
	c.fillStyle = s.bg; c.fillRect(0, 0, W, H);
	for (let j = 0, y = -pd; y < H + pd; j++, y += sp) {
		const p = paths[j % 8 ? 0 : 1];
		let pen = -1, lx = 0, ly = 0;
		for (let x = -pd; x < W + pd; x += sg) {
			const n1 = sn(x * 0.0021 + T * 0.045, y * 0.0031 - T * 0.028), n2 = sn(x * 0.0066 - T * 0.07, y * 0.009 + T * 0.05 + 4.7);
			let px = x + n2 * A * 0.3, py = y + (n1 + 0.32 * n2) * A;
			const vx = px - a.x, vy = py - a.y, r = Math.max(Math.hypot(vx, vy), 0.001);
			const g = q >= 0 ? (Math.sqrt(r * r + q * q * R * R) - r) / r : q * 0.86 * R * R / (r * r + R * R);
			const w = 1 - sstep(R * 1.5, R * 4, r), vis = sstep(0.1, 0.32, r / (R * Math.max(q, 0.001))), tint = sstep(0.05, 0.55, Math.abs(g) * w);
			px += vx * g * w; py += vy * g * w;
			const kind = vis < 0.5 ? -1 : tint > 0.3 ? 2 : 0, path = kind === 2 ? paths[2] : p;
			if (kind >= 0) {
				if (pen < 0) path.moveTo(px, py);
				else if (Math.hypot((lx + px) / 2 - a.x, (ly + py) / 2 - a.y) < R * q * 0.9) path.moveTo(px, py);
				else { if (pen !== kind) path.moveTo(lx, ly); path.lineTo(px, py); }
			}
			pen = kind; lx = px; ly = py;
		}
	}
	c.lineWidth = 1;
	c.strokeStyle = s.ink;
	c.globalAlpha = dark ? 0.36 : 0.5; c.stroke(paths[0]);
	c.globalAlpha = dark ? 0.8 : 1; c.stroke(paths[1]);
	c.strokeStyle = s.sig; c.globalAlpha = 0.9; c.stroke(paths[2]);
	const rr = R * (0.62 + 0.36 * Math.max(q, 0) + 0.12 * Math.max(-q, 0));
	c.globalAlpha = 0.95; c.beginPath();
	for (let i = 0; i < RET.length; i += 6) {
		const z = RET[i + 2] > 1 ? Math.min(rr, 60) : rr;
		c.moveTo(a.x + RET[i] * z, a.y + RET[i + 1] * z); c.lineTo(a.x + RET[i + 3] * z, a.y + RET[i + 4] * z);
	}
	c.stroke(); c.globalAlpha = 1;
	follow(); hud();
}
function cpuMode() {
	if (!c2) {
		c2 = gl ? d.createElement('canvas') : cv;
		if (c2 !== cv) { c2.className = 'c2'; c2.setAttribute('aria-hidden', 'true'); cv.after(c2); }
	}
	wrap.classList.add('cpu');
	readColors(); cpuDraw();
}
function cpuOff() {
	if (c2 && c2 !== cv) c2.remove();
	c2 = null; wrap.classList.remove('cpu');
}

function boot() {
	const rows = ok
		? ['gl ' + (vtf ? 'webgl + vtf' : 'webgl'), 'grid ' + nLines + ' lines · sim ' + (vtf ? GX + 'x' + GY : 'off'), 'view ' + W + 'x' + H + ' @' + dpr.toFixed(1) + 'x', reduced ? 'ok · reduced motion, still' : 'ok · autopilot']
		: ['gl unavailable', 'cpu frame ' + W + 'x' + H, 'ok · static'];
	if (reduced) { rows.forEach(log); booted = true; return; }
	let i = 0;
	(function next() { log(rows[i++]); if (i < rows.length) setTimeout(next, 110); else booted = true; })();
}

function place() {
	const r = cv.getBoundingClientRect();
	ox = r.left + win.scrollX; oy = r.top + win.scrollY;
}
const setPtr = (e) => { ptr.x = e.pageX - ox; ptr.y = e.pageY - oy; ptr.type = e.pointerType; ptr.on = true; if (reduced) run(stillTask); };
cv.addEventListener('pointermove', setPtr, { passive: true });
cv.addEventListener('pointerdown', setPtr, { passive: true });
const off = (e) => {
	if (e.pointerType !== 'mouse') ptr.hold = perf.now() + 1400;
	ptr.on = false;
	if (reduced) run(stillTask);
};
cv.addEventListener('pointerleave', off);
cv.addEventListener('pointercancel', off);
cv.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') off(e); });
cv.addEventListener('click', (e) => { if (ok) flip(e.pageX - ox, e.pageY - oy); });
el('pol').addEventListener('click', () => flip());
function flip(x, y) {
	L.tq = -L.tq;
	const sg = L.tq > 0 ? '+' : '−', px = x == null ? L.x : x, py = y == null ? L.y : y;
	txt(E.polv, sg);
	mark.classList.toggle('neg', L.tq < 0);
	log('flip ' + sg + ' @ ' + pad(Math.max(0, Math.round(px)), 4) + ',' + pad(Math.max(0, Math.round(py)), 4));
	if (!ok) { if (c2) cpuDraw(); return; }
	if (reduced) { run(stillTask); return; }
	shock(L.tq > 0 ? 1 : -1, px, py);
	texDirty = true;
	if (ring.animate) {
		const t = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) ';
		const z = (L.r * 2.6 / 200).toFixed(3);
		ring.animate([{ transform: t + 'scale(.08)', opacity: 1 }, { transform: t + 'scale(' + z * 0.7 + ')', opacity: 0.9, offset: 0.45 }, { transform: t + 'scale(' + z + ')', opacity: 0 }], { duration: 950, easing: 'cubic-bezier(.2,.6,.3,1)' });
	}
	kick();
}
cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ok = false; log('gl context lost'); cpuMode(); }, false);
cv.addEventListener('webglcontextrestored', () => {
	ok = begin() && finish();
	log(ok ? 'gl context restored' : 'gl restore failed');
	if (ok) { cpuOff(); readColors(); resize(W, H); start(); }
}, false);
let dq = null;
const onDpr = () => { watchDpr(); resize(W, H); log('dpr ' + DPR().toFixed(2) + ' · rebuild ' + (c2 || cv).width + 'x' + (c2 || cv).height); start(); };
function watchDpr() {
	if (dq) (dq.removeEventListener ? dq.removeEventListener('change', onDpr) : dq.removeListener(onDpr));
	pr = DPR();
	dq = mq('(resolution: ' + pr + 'dppx)');
	onMQ(dq, onDpr);
}

// context + compile now, go() in a later task; hidden until then (undrawn GL = black)
cv.style.visibility = 'hidden';
const pend = begin();
readColors(); place(); watchDpr();
function go() {
	try {
		ok = pend && finish();
		cv.style.visibility = '';
		const r = cv.getBoundingClientRect();
		resize(r.width, r.height);
		if (!ok) cpuMode();
		if ('ResizeObserver' in win) {
			new ResizeObserver((es) => {
				const c = es[0].contentRect;
				if (Math.round(c.width) !== W || Math.round(c.height) !== H) { resize(c.width, c.height); place(); start(); }
			}).observe(cv);
		}
		onVis([wrap], (es) => {
			visible = es[es.length - 1].isIntersecting;
			wrap.classList.toggle('off', !visible);
			if (visible) start();
		});
		onMQ(mqReduce, () => { reduced = mqReduce.matches; log(reduced ? 'motion reduced · still' : 'motion on · autopilot'); start(); });
		boot();
		start();
	} catch (e) { fail(); }
}
if (pend) run(() => { if (!ready()) return true; setTimeout(go); return false; });
else go();
return {
	recolor() { readColors(); if (c2) cpuDraw(); else if (reduced || !visible) run(stillTask); },
	flip, place
};
}

const fw = $('#field');
function fail() { fw.classList.add('cpu', 'err'); field = null; booted = true; log('field error · static'); }
if (fw) {
	requestAnimationFrame(() => setTimeout(() => {
		try { field = Field(fw); } catch (e) { fail(); }
		measure();
	}, 0));
}
})();
