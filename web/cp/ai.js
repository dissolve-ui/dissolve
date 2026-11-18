// AI components: ThinkingOrb, ImageReveal, SweepTransition, UploadTile, TaskCheck (registry/*.tsx),
// ported to the web. Same geometry, timings and curves as the native sources. Shown raw, centered.
import { CALM, value, el, clamp, play, snapshot, IMG, FONT, cover, frame, rr, DPR, PKG, DIR, prop, onTheme, loop } from './kit.js';
import { ready } from '../images.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const CALM_CSS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle
const cmd = (id) => `// npx ${PKG} add ${id}`;
const imp = (name, id) => `import { ${name} } from '${DIR}/${id}';`;

/* ======================================================================================
   Shared helpers
   ====================================================================================== */

/** Theme tokens of the ports (ai.css maps them on the site variables). Refreshed on theme change. */
function themed(sc, node, onChange) {
  const T = {};
  // Tokens are global (theme vars), read them off a hidden probe that is always in the document.
  if (!tokenProbe.isConnected) document.body.append(tokenProbe);
  const read = () => {
    const cs = getComputedStyle(tokenProbe);
    for (const k of ['fg', 'muted', 'surface', 'surface-2', 'line', 'accent', 'success', 'danger', 'primary', 'primary-fg']) {
      T[k] = cs.getPropertyValue(`--ai-${k}`).trim() || '#888';
    }
    T.rgb = (k) => rgb(T[k]);
  };
  read();
  onTheme(sc, () => { read(); onChange?.(); });
  return T;
}

const tokenProbe = el('span', 'cp-ai cp-ai-probe');
const probe = document.createElement('canvas').getContext('2d');
/** Any CSS color to [r, g, b] in 0..1. */
function rgb(css) {
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  const s = probe.fillStyle;
  if (s[0] === '#') return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  return s.match(/[\d.]+/g).slice(0, 3).map((v) => v / 255);
}
const css = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function hidpi(cv, w, h) {
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
}

/** A small segmented row of options under a demo. */
function chips(options, current, onPick, label) {
  const row = el('div', options.length === 6 ? 'cp-ai-chips cp-ai-chips-6' : 'cp-ai-chips');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', label);
  const btns = options.map(([v, text]) => {
    const b = el('button', 'cp-ai-chip', text);
    b.type = 'button';
    b.addEventListener('click', () => onPick(v));
    row.append(b);
    return [v, b];
  });
  const set = (v) => btns.forEach(([k, b]) => { b.classList.toggle('on', k === v); b.setAttribute('aria-pressed', String(k === v)); });
  set(current);
  return { node: row, set };
}

/** Minimal WebGL2 full screen program. Returns null without WebGL2. */
function glProgram(sc, cv, fs) {
  const gl = cv.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  const u = (n) => (n in U ? U[n] : (U[n] = gl.getUniformLocation(prog, n)));
  sc.onDispose(() => gl.getExtension('WEBGL_lose_context')?.loseContext());
  return {
    gl,
    f(n, ...v) { gl[`uniform${v.length}f`](u(n), ...v); },
    texture(src, mip, old) {
      const t = old ?? gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    },
    draw() {
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/* ======================================================================================
   ThinkingOrb (thinking-orb.tsx): a sphere of dots whose motion shows the agent state.
   ====================================================================================== */

const ORB_STATES = [['idle', 'Idle'], ['thinking', 'Thinking'], ['searching', 'Searching'], ['listening', 'Listening'], ['done', 'Done'], ['error', 'Error']];
const RING_SPD = [0.0021, -0.0016, 0.0012], RING_TZ = [0, 1.05, -1.05];
// Checkmark, unit space, y down.
const CHECK = [[-0.52, 0.02], [-0.16, 0.38], [0.56, -0.36]];

function mountOrb(body, { sc, mode }) {
  const tile = mode === 'tile';
  const S = tile ? 118 : mode === 'stage' ? 220 : 150;
  const N = 180, R = S * 0.4, DOT = Math.max(1.25, S * 0.0105); // dot radius
  const root = el('div', 'cp-ai cp-orb');
  const cv = el('canvas', 'cp-orb-cv');
  hidpi(cv, S, S);
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Agent idle');
  root.append(cv);
  const T = themed(sc, root, () => { colors = null; });
  let colors = null;
  const ctx = cv.getContext('2d');

  // Per dot randoms and the Fibonacci sphere.
  const r1 = new Float32Array(N), r2 = new Float32Array(N), fib = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    r1[i] = Math.random(); r2[i] = Math.random();
    const y = 1 - ((i + 0.5) / N) * 2, r = Math.sqrt(1 - y * y), th = i * GA;
    fib[i * 3] = Math.cos(th) * r; fib[i * 3 + 1] = y; fib[i * 3 + 2] = Math.sin(th) * r;
  }
  // Check path samples, by arc length.
  const segs = [], tot = (() => { let L = 0; for (let k = 0; k < 2; k++) { const a = CHECK[k], b = CHECK[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, l]); L += l; } return L; })();
  const check = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let s = ((i + 0.5) / N) * tot, k = 0;
    while (k < 1 && s > segs[k][2]) { s -= segs[k][2]; k++; }
    const [a, b, l] = segs[k], u = s / l, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, j = (r1[i] - 0.5) * 0.11;
    check[i * 3] = a[0] + (b[0] - a[0]) * u + nx * j;
    check[i * 3 + 1] = a[1] + (b[1] - a[1]) * u + ny * j;
    check[i * 3 + 2] = (r2[i] - 0.5) * 0.5;
  }

  const cur = new Float32Array(N * 4), from = new Float32Array(N * 4), tg = new Float32Array(4);
  const vel = new Float32Array(N * 2), off = new Float32Array(N * 2), offV = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { cur[i * 4] = fib[i * 3]; cur[i * 4 + 1] = fib[i * 3 + 1]; cur[i * 4 + 2] = fib[i * 3 + 2]; cur[i * 4 + 3] = 1; }
  let state = 'idle', t0 = -1e9, fallUntil = 0, level = 0, last = performance.now();
  const epoch = performance.now();
  const ok = value(sc, 0, () => {}), bad = value(sc, 0, () => {});
  let ptr = null;

  function target(st, i, tm, o) {
    let x, y, z, a = 1;
    if (st === 'thinking') {
      const r = i % 3, ang = ((i / 3) | 0) / (N / 3) * Math.PI * 2 + tm * RING_SPD[r];
      const x0 = Math.cos(ang) * 0.95, z0 = Math.sin(ang) * 0.95;
      // tilt about x, then about z per ring
      const y1 = -z0 * Math.sin(0.45), z1 = z0 * Math.cos(0.45);
      const c2 = Math.cos(RING_TZ[r]), s2 = Math.sin(RING_TZ[r]);
      x = x0 * c2 - y1 * s2; y = x0 * s2 + y1 * c2; z = z1;
    } else if (st === 'searching') {
      const rr_ = 0.95 * Math.sqrt((i + 0.5) / N), th = i * GA;
      x = Math.cos(th) * rr_; y = Math.sin(th) * rr_;
      const sw = (tm / 1000) * Math.PI * 2;
      let d = (sw - th) % (Math.PI * 2); if (d < 0) d += Math.PI * 2;
      a = 0.3 + 0.7 * Math.exp(-d * 1.4);
      z = a * 0.6 - 0.3;
    } else if (st === 'done') {
      x = check[i * 3]; y = check[i * 3 + 1]; z = check[i * 3 + 2];
    } else {
      // idle and listening: the rotating sphere
      x = fib[i * 3]; y = fib[i * 3 + 1]; z = fib[i * 3 + 2];
      let s = 0.98 + 0.02 * Math.sin((tm / 2400) * Math.PI * 2);
      if (st === 'listening') s = (0.84 + level * 0.2) * (1 + 0.06 * level * Math.sin(y * 5 - tm * 0.012));
      x *= s; y *= s; z *= s;
    }
    if (st !== 'done') {
      const ra = tm * 0.0004, c = Math.cos(ra), sn = Math.sin(ra);
      const xr = x * c + z * sn, zr = -x * sn + z * c;
      if (st === 'searching' || st === 'thinking') { o[0] = x; o[1] = y; o[2] = z; o[3] = a; return; }
      const tb = 0.3, cb = Math.cos(tb), sb = Math.sin(tb);
      x = xr; z = y * sb + zr * cb; y = y * cb - zr * sb;
    }
    o[0] = x; o[1] = y; o[2] = z; o[3] = a;
  }

  function go(next) {
    if (next === state && next !== 'error') return;
    from.set(cur);
    state = next;
    t0 = performance.now();
    picker?.set(next);
    cv.setAttribute('aria-label', `Agent ${next}`);
    ok.to(next === 'done' ? 1 : 0, 600, CALM);
    if (next === 'error') {
      bad.to(1, 150, CALM);
      for (let i = 0; i < N; i++) { vel[i * 2] = (r1[i] - 0.5) * 0.7; vel[i * 2 + 1] = -r2[i] * 0.6; }
      fallUntil = t0 + (REDUCED.matches ? 0 : 900);
    } else bad.to(0, 500, CALM);
  }

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const red = REDUCED.matches, tm = red ? 0 : now - epoch;
    const dur = red ? 150 : 600, stg = red ? 0 : 1.5;
    // a synthetic voice level for the listening state
    const raw = clamp(0.3 + 0.35 * Math.sin(tm * 0.0047) * Math.sin(tm * 0.0013 + 1) + 0.3 * Math.abs(Math.sin(tm * 0.011)));
    level += (raw - level) * 0.15;
    if (state === 'error' && now >= fallUntil && fallUntil) { fallUntil = 0; go('idle'); }
    if (!colors) colors = { fg: T.rgb('fg'), ok: T.rgb('success'), bad: T.rgb('danger') };
    const col = lerp3(lerp3(colors.fg, colors.ok, ok.v), colors.bad, bad.v);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = css(col);
    const falling = state === 'error' && fallUntil;
    for (let i = 0; i < N; i++) {
      const k4 = i * 4;
      if (falling) {
        vel[i * 2 + 1] += 4.2 * dt;
        cur[k4] += vel[i * 2] * dt;
        cur[k4 + 1] += vel[i * 2 + 1] * dt;
        if (cur[k4 + 1] > 1.05) { cur[k4 + 1] = 1.05; vel[i * 2 + 1] *= -0.28; vel[i * 2] *= 0.7; }
      } else {
        target(state, i, tm, tg);
        const e = CALM(clamp((now - t0 - i * stg) / dur));
        for (let c = 0; c < 4; c++) cur[k4 + c] = from[k4 + c] + (tg[c] - from[k4 + c]) * e;
      }
      let px = S / 2 + cur[k4] * R, py = S / 2 + cur[k4 + 1] * R;
      // interactive: flee the pointer within 40 px, crisp spring back
      let gx = 0, gy = 0;
      if (ptr && !red) {
        const dx = px - ptr.x, dy = py - ptr.y, d = Math.hypot(dx, dy);
        if (d < 40 && d > 0.01) { gx = (dx / d) * (40 - d) * 0.8; gy = (dy / d) * (40 - d) * 0.8; }
      }
      for (let c = 0; c < 2; c++) {
        const j = i * 2 + c, tgt = c ? gy : gx;
        offV[j] += (260 * (tgt - off[j]) - 22 * offV[j]) * dt;
        off[j] += offV[j] * dt;
      }
      px += off[i * 2]; py += off[i * 2 + 1];
      const d = clamp((cur[k4 + 2] + 1) / 2);
      ctx.globalAlpha = (0.38 + 0.62 * d) * cur[k4 + 3];
      ctx.beginPath();
      ctx.arc(px, py, DOT * (0.8 + 0.4 * d), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  loop(sc, cv, draw);

  const local = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  cv.addEventListener('pointermove', (e) => { ptr = local(e); });
  cv.addEventListener('pointerdown', (e) => { ptr = local(e); });
  cv.addEventListener('pointerleave', () => { ptr = null; });
  cv.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') ptr = null; });
  const CYCLE = ['thinking', 'searching', 'done', 'idle'];
  cv.addEventListener('click', () => go(CYCLE[(CYCLE.indexOf(state) + 1) % CYCLE.length]));
  cv.tabIndex = 0;
  cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cv.click(); } });

  let picker = null;
  if (!tile) { picker = chips(ORB_STATES, 'idle', go, 'Orb state'); root.append(picker.node); }
  body.append(root);
  go('idle');

  return {
    async run() {
      go('thinking'); await sc.wait(2200);
      go('searching'); await sc.wait(2000);
      go('done'); await sc.wait(1600);
      go('idle'); await sc.wait(700);
    },
  };
}

/* ======================================================================================
   ImageReveal (image-reveal.tsx): thinking mosaic, coarse to fine, crossfade to sharp.
   ====================================================================================== */

const REVEAL_FS = `#version 300 es
precision highp float;
uniform vec2 size; uniform float dpr, time, hasImage, level, lp, cellsA, cellsB, lodA, lodB, sharp, bad, aspect;
uniform vec3 c0, c1, cBad;
uniform sampler2D img;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cov(vec2 uv){
  float fa = size.x / size.y;
  if (aspect > fa) uv.x = 0.5 + (uv.x - 0.5) * fa / aspect; else uv.y = 0.5 + (uv.y - 0.5) * aspect / fa;
  return uv;
}
vec3 pend(vec2 uv){
  vec2 g = floor(uv * 12.), f = fract(uv * 12.);
  float n = h(g);
  float wave = pow(0.5 + 0.5 * cos(6.28318 * (time / 1.6 - (g.x + g.y) / 22.)), 3.);
  float pulse = 0.5 + 0.5 * sin(time * (1.2 + n * 1.8) + n * 6.28);
  float m = (0.16 + 0.3 * pulse + 0.54 * wave) * 0.62;
  float cell = size.x / 12.;
  vec2 q = abs(f - 0.5) * cell;
  float inside = step(max(q.x, q.y), cell * 0.5 - 0.9);
  return mix(c0, mix(c0, c1, m), inside);
}
void main(){
  vec2 uv = vec2(gl_FragCoord.x / (size.x * dpr), 1. - gl_FragCoord.y / (size.y * dpr));
  vec3 col = pend(uv);
  if (hasImage > 0.5) {
    vec2 ga = floor(uv * cellsA);
    vec3 a = textureLod(img, cov((ga + 0.5) / cellsA), lodA).rgb;
    vec3 b = col;
    if (level > 0.5) { vec2 gb = floor(uv * cellsB); b = textureLod(img, cov((gb + 0.5) / cellsB), lodB).rgb; }
    col = h(ga + level * 17.31) < lp ? a : b;
    if (sharp > 0.) col = mix(col, texture(img, cov(uv)).rgb, sharp);
  }
  col = mix(col, cBad, bad * 0.55);
  o = vec4(col, 1.);
}`;
const REVEAL_IMGS = ['lake', 'temple', 'valley', 'villa', 'pines', 'cypress'];

function mountReveal(body, { sc, mode }) {
  const tile = mode === 'tile';
  const S = tile ? 140 : mode === 'stage' ? 260 : 172;
  const DURATION = 1400, SHARPEN = 180; // same as image-reveal.tsx
  const root = el('div', 'cp-ai cp-rv');
  const frameEl = el('div', 'cp-rv-frame');
  frameEl.style.width = frameEl.style.height = S + 'px';
  frameEl.tabIndex = 0;
  frameEl.setAttribute('role', 'button');
  frameEl.setAttribute('aria-label', 'Generate an image');
  const empty = el('span', 'cp-rv-empty', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg><span>Tap to generate</span>');
  const cv = el('canvas', 'cp-rv-cv');
  hidpi(cv, S, S);
  frameEl.append(empty, cv);
  root.append(frameEl);
  const T = themed(sc, root, () => paint(performance.now()));
  const G = glProgram(sc, cv, REVEAL_FS);

  let status = 'empty', run = 0, imgName = null, tex = null, aspect = 1, iw = 1;
  let t = 0, time0 = performance.now(), frozen = null, sharp = 0;
  const badV = value(sc, 0, () => paint(performance.now()));
  const show = (on) => { cv.style.opacity = on ? '1' : '0'; empty.style.opacity = on ? '0' : '1'; };
  show(false);

  function uniforms(now) {
    const e = t * t * (3 - 2 * t), L = 4.3 * e; // even steps, so every doubling reads
    const level = Math.min(4, Math.floor(L));
    const lp = level === 4 ? clamp((L - 4) / 0.3) : L - level;
    const A = 8 * 2 ** level, B = A / 2;
    const lod = (n) => Math.log2(Math.max(1, iw / n));
    G.f('size', S, S); G.f('dpr', DPR);
    G.f('time', (frozen ?? now - time0) / 1000);
    G.f('hasImage', tex && status !== 'pending' ? 1 : 0);
    G.f('level', level); G.f('lp', t >= 1 ? 1 : lp);
    G.f('cellsA', A); G.f('cellsB', B); G.f('lodA', lod(A)); G.f('lodB', lod(B));
    G.f('sharp', sharp); G.f('bad', badV.v); G.f('aspect', aspect);
    G.f('c0', ...T.rgb('surface-2')); G.f('c1', ...T.rgb('muted')); G.f('cBad', ...T.rgb('danger'));
  }
  function paint(now) { if (!G || status === 'empty') return; uniforms(now); G.draw(); }
  const lp_ = loop(sc, cv, paint, () => status === 'pending' || status === 'revealing');

  async function generate(fail = false) {
    const my = ++run;
    await ready;
    if (my !== run || !sc.alive) return;
    imgName = REVEAL_IMGS[(REVEAL_IMGS.indexOf(imgName) + 1) % REVEAL_IMGS.length];
    status = 'pending'; t = 0; sharp = 0; frozen = null; time0 = performance.now();
    badV.set(0);
    show(true);
    cv.style.visibility = '';
    frameEl.setAttribute('aria-busy', 'true');
    lp_.kick();
    if (!G) { await sc.wait(600); status = 'ready'; return; }
    await sc.wait(fail ? 1500 : 1300); // the model is thinking
    if (my !== run) return;
    if (fail) return error(my);
    const im = IMG[imgName];
    tex = G.texture(im, true, tex);
    aspect = im.naturalWidth / im.naturalHeight;
    iw = Math.min(im.naturalWidth, im.naturalHeight);
    if (REDUCED.matches) {
      sharp = 1; status = 'ready'; paint(performance.now());
      cv.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150 });
      frameEl.removeAttribute('aria-busy');
      return;
    }
    status = 'revealing';
    lp_.kick();
    const start = performance.now();
    await new Promise((res) => {
      const f = (now) => {
        if (my !== run || !sc.alive) return res();
        t = clamp((now - start) / DURATION);
        if (t < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    if (my !== run) return;
    // t = 1: the finest mosaic crossfades into the sharp image, nothing else.
    status = 'ready';
    const sv = value(sc, 0, () => { if (my === run) { sharp = sv.v; paint(performance.now()); } });
    await sv.to(1, SHARPEN, CALM);
    if (my !== run) return;
    frameEl.removeAttribute('aria-busy');
  }

  async function error(my) {
    status = 'error';
    frozen = performance.now() - time0;
    await badV.to(1, 200, CALM);
    if (my !== run || !sc.alive) return;
    paint(performance.now());
    const r = frameEl.getBoundingClientRect();
    const src = snapshot(S, S, (x) => { rr(x, 0, 0, S, S, tile ? 16 : 20); x.clip(); x.drawImage(cv, 0, 0, S, S); });
    cv.style.visibility = 'hidden';
    await sc.track(play({ source: src, x: r.left, y: r.top, w: S, h: S, preset: 'dust', duration: 1100 })).done;
    if (my !== run) return;
    status = 'empty';
    show(false);
    frameEl.removeAttribute('aria-busy');
  }

  frameEl.addEventListener('click', () => generate(false));
  frameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); generate(false); } });
  if (!tile) {
    const row = el('div', 'cp-ai-chips');
    for (const [text, fail] of [['Generate', false], ['Fail', true]]) {
      const b = el('button', 'cp-ai-chip', text);
      b.type = 'button';
      b.addEventListener('click', () => generate(fail));
      row.append(b);
    }
    root.append(row);
  }
  body.append(root);

  return {
    async run() {
      await generate(false);
      await sc.wait(1400);
    },
  };
}

/* ======================================================================================
   SweepTransition (sweep-transition.tsx): a crisp light band leaves the new state behind it.
   ====================================================================================== */

const SWEEP_FS = `#version 300 es
precision highp float;
uniform sampler2D old;
uniform vec2 size, origin; uniform float dpr, p, band, mode; uniform vec3 rim;
out vec4 o;
vec4 S(vec2 px){ return texture(old, clamp(px / size, 0., 1.)); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, size.y * dpr - gl_FragCoord.y) / dpr;
  float d; vec2 n;
  if (mode < 0.5) { float fy = size.y - p * (size.y + band); d = fy - px.y; n = vec2(0., -1.); }
  else if (mode < 1.5) { float fx = p * (size.x + band); d = px.x - fx; n = vec2(1., 0.); }
  else {
    float m = max(max(length(origin), length(origin - vec2(size.x, 0.))), max(length(origin - vec2(0., size.y)), length(origin - size)));
    vec2 v = px - origin; float L = length(v);
    d = L - p * (m + band); n = L > 0.001 ? v / L : vec2(0., -1.);
  }
  if (d < 0.) { o = vec4(0.); return; }
  if (d < band) {
    float k = d / band;
    vec2 q = px - n * sin(3.14159 * k) * 6.;
    vec4 c = S(q);
    c.r = S(q + n * 1.5).r; c.b = S(q - n * 1.5).b;
    float rimA = (1. - smoothstep(0.5, 1.5, d)) * 0.6;
    o = mix(c, vec4(rim, 1.), rimA);
    return;
  }
  o = S(px);
}`;
const SWEEP_CARDS = [
  { img: 'lake', title: 'Lake', sub: 'Morning, 7:40' },
  { img: 'temple', title: 'Temple', sub: 'Noon, 12:10' },
  { img: 'valley', title: 'Valley', sub: 'Dusk, 19:55' },
  { img: 'arch', title: 'Arch', sub: 'Night, 22:30' },
];

function mountSweep(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 200 : mode === 'stage' ? 320 : 260, H = Math.round(W * 0.66);
  const DUR = 720, BAND = 28;
  const root = el('div', 'cp-ai cp-sw');
  const view = el('div', 'cp-sw-view');
  view.style.width = W + 'px';
  view.style.height = H + 'px';
  view.tabIndex = 0;
  view.setAttribute('role', 'button');
  view.setAttribute('aria-label', 'Sweep to the next card');
  const content = el('canvas', 'cp-sw-content');
  const over = el('canvas', 'cp-sw-over');
  hidpi(content, W, H);
  hidpi(over, W, H);
  view.append(content, over);
  root.append(view);
  const T = themed(sc, root);
  const G = glProgram(sc, over, SWEEP_FS);
  const cx = content.getContext('2d');
  let idx = 0, busy = false, sweepMode = 'vertical', origin = [W / 2, H / 2], prev = 0, tex = null;

  function drawContent() {
    const c = SWEEP_CARDS[idx];
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cover(cx, IMG[c.img], 0, 0, W, H);
    const g = cx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#fff';
    cx.font = `600 ${tile ? 16 : 20}px ${FONT}`;
    cx.fillText(c.title, 16, H - (tile ? 30 : 36));
    cx.globalAlpha = 0.8;
    cx.font = `500 ${tile ? 11 : 13}px ${FONT}`;
    cx.fillText(c.sub, 16, H - (tile ? 13 : 16));
    cx.globalAlpha = 1;
  }
  ready.then(() => sc.alive && drawContent());
  drawContent();

  const P = value(sc, 0, () => render());
  function render() {
    if (!G) return;
    G.f('size', W, H); G.f('dpr', DPR); G.f('p', P.v); G.f('band', BAND);
    G.f('mode', sweepMode === 'vertical' ? 0 : sweepMode === 'horizontal' ? 1 : 2);
    G.f('origin', origin[0], origin[1]); G.f('rim', ...T.rgb('accent'));
    G.draw();
  }

  async function sweep(next = (idx + 1) % SWEEP_CARDS.length) {
    if (busy) return cancel();
    busy = true;
    prev = idx;
    if (!G || REDUCED.matches) {
      const old = snapshot(W, H, (x) => x.drawImage(content, 0, 0, W, H));
      const oc = over.getContext('2d') ?? null;
      idx = next; drawContent();
      if (!oc) {
        content.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 150 });
      } else {
        oc.setTransform(DPR, 0, 0, DPR, 0, 0); oc.drawImage(old, 0, 0, W, H);
        over.style.opacity = '1';
        await over.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.catch(() => {});
        over.style.opacity = '0';
      }
      busy = false;
      return;
    }
    tex = G.texture(content, false, tex); // old snapshot
    P.set(0);
    over.style.opacity = '1';
    await frame(); await frame(); // two frames before the state change, no flash
    if (!sc.alive) return;
    idx = next;
    drawContent();
    const ok = await P.to(1, DUR, CALM);
    if (!ok) return;
    over.style.opacity = '0';
    busy = false;
  }
  async function cancel() {
    if (!busy) return;
    const ok = await P.to(0, 300, CALM);
    if (!ok) return;
    idx = prev;
    drawContent();
    over.style.opacity = '0';
    busy = false;
  }

  view.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const b = view.getBoundingClientRect();
    if (!busy) origin = [e.clientX - b.left, e.clientY - b.top];
    sweep();
  });
  view.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); origin = [W / 2, H / 2]; sweep(); }
    else if (e.key === 'Escape') cancel();
  });
  if (!tile) {
    const pick = chips([['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['radial', 'Radial']], sweepMode, (m) => { sweepMode = m; pick.set(m); }, 'Sweep mode');
    root.append(pick.node);
  }
  body.append(root);

  return {
    async run() {
      origin = [W * 0.5, H * 0.75];
      await sweep();
      await sc.wait(900);
    },
  };
}

/* ======================================================================================
   UploadTile (upload-tile.tsx): grains land as the upload runs, the × shows once it is whole.
   ====================================================================================== */

const MB = 1024 * 1024;
const FILES = [
  { name: 'lake.jpg', size: 2.4 * MB, img: 'lake' },
  { name: 'brief.pdf', size: 0.8 * MB },
  { name: 'footage.mov', size: 48 * MB },
  { name: 'villa.jpg', size: 3.1 * MB, img: 'villa' },
  { name: 'assets.zip', size: 31 * MB },
];
const MAX_SIZE = 25 * MB, TILE = 72, MAX_TILES = 3;
const X_ICON = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/></svg>';
// Same assembly as upload-tile.tsx: grain side, landing window, start drift, timings.
const UP_PAD = 6, UP_GRAIN = 2, UP_WINDOW = 0.18, UP_DRIFT = 10, UP_CHASE = 240, UP_INTRO = 420, UP_CROSS_IN = 220;
const upHash = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
/** Per grain: home x, y, landing start, drift dx, dy. The front runs left to right with noise. */
function upField(size) {
  const n = Math.floor(size / UP_GRAIN), data = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, lx = (c + 0.5) * UP_GRAIN, ly = (r + 0.5) * UP_GRAIN;
    data.push(lx, ly, (0.78 * (lx / size) + 0.22 * upHash(i, 1)) * (1 - UP_WINDOW), (upHash(i, 2) - 0.5) * 2 * UP_DRIFT, (upHash(i, 3) - 0.5) * 2 * UP_DRIFT);
  }
  return { n, data };
}

/** The demo upload: progress in steps, aborts on signal. */
async function fakeUpload(sc, file, onProgress, signal) {
  let p = 0;
  await sc.wait(160);
  while (p < 1) {
    if (signal.aborted || !sc.alive) throw new Error('aborted');
    p = Math.min(1, p + 0.07 + Math.random() * 0.12);
    onProgress(p);
    await sc.wait(110 + Math.random() * 110);
  }
  if (signal.aborted) throw new Error('aborted');
}

function mountUpload(body, { sc, mode }) {
  const tile = mode === 'tile';
  const root = el('div', 'cp-ai cp-up');
  const tray = el('div', 'cp-up-tray');
  tray.setAttribute('role', 'list');
  tray.setAttribute('aria-label', 'Attachments');
  const addBtn = el('button', 'cp-up-add', '<span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>');
  addBtn.type = 'button';
  addBtn.setAttribute('aria-label', 'Add a file');
  tray.append(addBtn);
  root.append(tray);
  if (!tile) root.append(el('p', 'cp-up-cap', 'Max 25 MB. Videos over it are rejected.'));
  const T = themed(sc, root);
  body.append(root);
  let next = 0;
  const tiles = new Set();
  const sync = () => { addBtn.disabled = tiles.size >= MAX_TILES; };

  const fmt = (n) => (n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  function drawFace(x, f, bad) {
    x.save();
    rr(x, 0, 0, TILE, TILE, 16);
    x.clip();
    if (f.img) cover(x, IMG[f.img], 0, 0, TILE, TILE);
    else {
      x.fillStyle = T['surface-2'];
      x.fillRect(0, 0, TILE, TILE);
      // doc glyph and extension, top left; name and size, bottom
      x.strokeStyle = T.muted; x.lineWidth = 1.4; x.lineJoin = 'round';
      x.save(); x.translate(8, 8); x.scale(20 / 24, 20 / 24); x.stroke(new Path2D('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5')); x.restore();
      x.fillStyle = T.muted;
      x.font = `700 9px ${FONT}`;
      x.fillText(f.name.split('.').pop().toUpperCase(), 31, 21.5);
      const fit = (str) => { while (x.measureText(str).width > TILE - 16 && str.length > 3) str = str.slice(0, -2) + '…'; return str; };
      x.fillStyle = T.fg;
      x.font = `600 11px ${FONT}`;
      x.fillText(fit(f.name), 8, TILE - 20);
      x.fillStyle = T.muted;
      x.font = `400 10px ${FONT}`;
      x.fillText(fmt(f.size), 8, TILE - 8);
    }
    if (bad) {
      x.fillStyle = T.danger; x.globalAlpha = 0.16; x.fillRect(0, 0, TILE, TILE); x.globalAlpha = 1;
      x.strokeStyle = T.danger; x.lineWidth = 1.5; rr(x, 0.75, 0.75, TILE - 1.5, TILE - 1.5, 15.25); x.stroke();
      x.font = `700 9px ${FONT}`;
      const w = x.measureText('Too large').width + 12;
      x.fillStyle = T.danger; rr(x, (TILE - w) / 2, TILE - 6 - 15, w, 15, 7.5); x.fill();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('Too large', TILE / 2, TILE - 6 - 4.5); x.textAlign = 'left';
    }
    x.restore();
  }

  function addFile(f = FILES[next++ % FILES.length]) {
    if (tiles.size >= MAX_TILES) return Promise.resolve();
    const OUT = TILE + UP_PAD * 2;
    const slot = el('div', 'cp-up-slot');
    slot.setAttribute('role', 'listitem');
    const box = el('div', 'cp-up-tile');
    box.setAttribute('aria-label', f.name);
    const face = el('canvas', 'cp-up-face');
    hidpi(face, TILE, TILE);
    const fctx = face.getContext('2d');
    const paintFace = (bad) => { fctx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.clearRect(0, 0, TILE, TILE); drawFace(fctx, f, bad); };
    paintFace(false);
    // the tile drawn as grains of its own face, placed by the upload progress
    const asm = el('canvas', 'cp-up-asm');
    hidpi(asm, OUT, OUT);
    const actx = asm.getContext('2d');
    const x = el('button', 'cp-up-x', X_ICON);
    x.type = 'button';
    x.tabIndex = -1;
    x.setAttribute('aria-label', `Remove ${f.name}`);
    box.append(face, asm, x);
    slot.append(box);
    tray.append(slot);
    const me = { slot };
    tiles.add(me);
    sync();

    const plain = REDUCED.matches;
    const g = upField(TILE);
    const G = UP_GRAIN * DPR;
    function drawAsm(P) {
      actx.setTransform(DPR, 0, 0, DPR, 0, 0);
      actx.clearRect(0, 0, OUT, OUT);
      for (let i = 0, d = g.data; i < g.n * g.n; i++) {
        const k = i * 5;
        const t = clamp((P - d[k + 2]) / UP_WINDOW);
        if (t <= 0) continue;
        const e = 1 - (1 - t) ** 3, w = e * UP_GRAIN;
        const cx = UP_PAD + d[k] + d[k + 3] * (1 - e), cy = UP_PAD + d[k + 1] + d[k + 4] * (1 - e);
        const c = i % g.n, r = (i / g.n) | 0;
        actx.drawImage(face, c * G, r * G, G, G, cx - w / 2, cy - w / 2, w, w);
      }
    }
    const prog = value(sc, 0, () => {
      if (plain) face.style.opacity = (0.15 + 0.85 * prog.v).toFixed(3);
      else drawAsm(prog.v);
    });
    const crossIn = value(sc, 0, () => {
      x.style.opacity = crossIn.v.toFixed(3);
      x.style.transform = plain ? '' : `scale(${(0.6 + 0.4 * crossIn.v).toFixed(3)})`;
    });
    face.style.opacity = plain ? '0.15' : '0';
    const ctrl = new AbortController();
    let phase = 'enter', whole = false;

    /** Runs the assembly to 1 in ms, then shows the real tile. */
    async function complete(ms) {
      await prog.to(1, plain ? 150 : ms, CALM);
      whole = true;
      box.classList.add('whole');
      face.style.opacity = '1';
      asm.style.visibility = 'hidden';
    }
    async function close() {
      slot.classList.add('gone');
      tiles.delete(me);
      sync();
      await sc.wait(REDUCED.matches ? 150 : 300);
      slot.remove();
    }
    async function leave(preset, origin) {
      const r = box.getBoundingClientRect();
      // whole: the face leaves; mid upload: only the grains that have landed
      const src = whole
        ? snapshot(OUT, OUT, (c) => c.drawImage(face, UP_PAD, UP_PAD, TILE, TILE))
        : snapshot(OUT, OUT, (c) => c.drawImage(asm, 0, 0, OUT, OUT));
      box.style.visibility = 'hidden';
      await sc.track(play({ source: src, x: r.left, y: r.top, w: OUT, h: OUT, preset, origin, duration: preset === 'snap' ? 900 : 1100, grain: 2 })).done;
      await close();
    }
    function cancel(origin) {
      if (phase !== 'uploading') return;
      ctrl.abort();
      phase = 'gone';
      box.classList.remove('busy');
      leave('snap', origin);
    }

    // while it uploads, the whole tile is the cancel button
    box.addEventListener('click', (e) => {
      const r = box.getBoundingClientRect();
      cancel({ x: clamp(e.clientX - r.left, 0, OUT), y: clamp(e.clientY - r.top, 0, OUT) });
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cancel({ x: OUT / 2, y: OUT / 2 }); }
    });
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      if (phase !== 'done') return;
      phase = 'gone';
      leave('snap', { x: OUT - 10, y: 10 }); // snaps away from the × itself
    });

    return (async () => {
      // the row opens, then the grains land as the upload runs
      await frame();
      slot.classList.add('in');
      await sc.wait(260);
      if (!sc.alive) return;
      if (f.size > MAX_SIZE) {
        // reject: assemble, three shakes of 6 px in 240 ms, danger tint, then dust
        phase = 'gone';
        await complete(UP_INTRO);
        if (!sc.alive) return;
        box.classList.add('bad');
        paintFace(true);
        await box.animate([0, 6, -6, 6, -6, 6, 0].map((v) => ({ transform: `translateX(${v}px)` })), { duration: REDUCED.matches ? 1 : 240 }).finished.catch(() => {});
        await sc.wait(260);
        return leave('dust');
      }
      phase = 'uploading';
      box.classList.add('busy');
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-label', `Uploading ${f.name}, press to cancel`);
      try {
        await fakeUpload(sc, f, (p) => prog.to(Math.max(prog.v, p), UP_CHASE, CALM), ctrl.signal);
      } catch { return; }
      if (phase !== 'uploading') return;
      await complete(UP_CHASE);
      if (phase !== 'uploading' || !sc.alive) return;
      phase = 'done';
      box.classList.remove('busy');
      box.removeAttribute('role');
      box.tabIndex = -1;
      box.setAttribute('aria-label', f.name);
      x.tabIndex = 0;
      crossIn.to(1, REDUCED.matches ? 150 : UP_CROSS_IN, CALM);
    })();
  }

  addBtn.addEventListener('click', () => addFile());
  sync();

  return {
    async run() {
      for (const t of [...tiles]) { t.slot.remove(); tiles.delete(t); }
      sync();
      await addFile(FILES[0]);
      await sc.wait(500);
      await addFile(FILES[2]);
      await sc.wait(500);
      next = 1;
    },
  };
}

/* ======================================================================================
   TaskCheck (task-check.tsx): box fills, check draws, text strikes, then move or dissolve.
   ====================================================================================== */

const TASKS = ['Draft the launch post', 'Review the onboarding flow', 'Export the app icons', 'Book the demo room'];
const BOX_CHECK = '<svg width="24" height="24" viewBox="0 0 22 22" aria-hidden="true"><path d="M6.2 11.4l3.2 3.2 6.6-7" fill="none" stroke="var(--ai-primary-fg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>';

function mountTasks(body, { sc, mode }) {
  const tile = mode === 'tile';
  const SETTLE = 900;
  const root = el('div', 'cp-ai cp-tc');
  if (tile) root.classList.add('compact');
  const todoHead = el('div', 'cp-tc-head', 'To do');
  const todo = el('div', 'cp-tc-list');
  const doneHead = el('div', 'cp-tc-head', 'Done');
  const done = el('div', 'cp-tc-list');
  const emptyRow = el('div', 'cp-tc-empty', '<span>All done</span>');
  const reset = el('button', 'cp-ai-chip', 'Reset');
  reset.type = 'button';
  emptyRow.append(reset);
  root.append(todoHead, todo, doneHead, done);
  let after = 'move';
  const T = themed(sc, root);
  const rows = new Set();

  const flip = (mutate, ms = 380) => {
    const nodes = [...root.querySelectorAll('.cp-tc-row, .cp-tc-head, .cp-tc-empty, .cp-ai-chips')];
    const first = new Map(nodes.map((n) => [n, n.getBoundingClientRect().top]));
    mutate();
    if (REDUCED.matches) return;
    for (const [n, top] of first) {
      if (!n.isConnected) continue;
      const dy = top - n.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: ms, easing: CALM_CSS });
    }
  };
  const syncEmpty = () => {
    const pending = [...todo.children].some((n) => n.classList.contains('cp-tc-row'));
    if (!pending && !emptyRow.isConnected) todo.append(emptyRow);
    if (pending && emptyRow.isConnected) emptyRow.remove();
    const hasDone = done.children.length > 0;
    doneHead.hidden = after !== 'move' && !hasDone;
  };

  function makeRow(label) {
    const row = el('button', 'cp-tc-row');
    row.type = 'button';
    row.setAttribute('role', 'checkbox');
    row.setAttribute('aria-checked', 'false');
    const box = el('span', 'cp-tc-box', BOX_CHECK);
    const fill = el('i', 'cp-tc-fill');
    box.prepend(fill);
    const path = box.querySelector('path');
    const text = el('span', 'cp-tc-text');
    text.textContent = label;
    const strikes = el('span', 'cp-tc-strikes');
    text.append(strikes);
    row.append(box, text);
    let checked = false, timer = 0, lines = [];

    const measure = () => {
      strikes.textContent = '';
      const range = document.createRange();
      range.selectNodeContents(text.firstChild);
      const base = text.getBoundingClientRect();
      lines = [...range.getClientRects()].map((r) => {
        const s = el('i', 'cp-tc-strike');
        s.style.cssText = `left:${r.left - base.left}px;top:${r.top - base.top + r.height / 2}px;width:${r.width}px`;
        strikes.append(s);
        return { s, x: r.left - base.left, y: r.top - base.top + r.height / 2, w: r.width };
      });
    };
    // One driver, 320 ms: check drawn over 220 ms, strike over 260 ms starting at 60 ms.
    const prog = value(sc, 0, () => {
      const ms = prog.v * 320;
      const c = CALM(clamp(ms / 220)), s = CALM(clamp((ms - 60) / 260));
      path.setAttribute('stroke-dashoffset', (1 - c).toFixed(3));
      fill.style.opacity = CALM(clamp(ms / 180)).toFixed(3);
      lines.forEach((l) => { l.s.style.transform = `scaleX(${s.toFixed(4)})`; });
      text.style.color = `color-mix(in srgb, var(--ai-muted) ${(s * 100).toFixed(1)}%, var(--ai-fg))`;
    });
    const pop = value(sc, 1, () => { box.style.transform = `scale(${pop.v.toFixed(4)})`; });

    async function settle() {
      if (!checked || !row.isConnected) return;
      if (after === 'move') {
        await row.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear' }).finished.catch(() => {});
        if (!checked) return;
        row.style.opacity = '0';
        flip(() => { done.prepend(row); syncEmpty(); });
        await row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140, easing: 'linear', fill: 'backwards' }).finished.catch(() => {});
        row.style.opacity = '';
      } else if (after === 'dissolve') {
        const r = row.getBoundingClientRect(), b = box.getBoundingClientRect(), tr = text.getBoundingClientRect();
        const cs = getComputedStyle(text);
        const src = snapshot(r.width, r.height, (x) => {
          x.fillStyle = T.primary;
          rr(x, b.left - r.left, b.top - r.top, b.width, b.height, 7); x.fill();
          x.strokeStyle = T['primary-fg']; x.lineWidth = 2; x.lineCap = x.lineJoin = 'round';
          x.save(); x.translate(b.left - r.left, b.top - r.top); x.scale(b.width / 22, b.height / 22); x.stroke(new Path2D('M6.2 11.4l3.2 3.2 6.6-7')); x.restore();
          x.font = `${cs.fontWeight} ${cs.fontSize} ${FONT}`;
          x.fillStyle = T.muted; x.textBaseline = 'middle';
          lines.forEach((l, k) => { if (k === 0) x.fillText(label, tr.left - r.left + l.x, tr.top - r.top + l.y); });
          x.fillStyle = T.muted;
          lines.forEach((l) => x.fillRect(tr.left - r.left + l.x, tr.top - r.top + l.y - 0.75, l.w, 1.5));
        });
        row.style.visibility = 'hidden';
        await sc.track(play({ source: src, x: r.left, y: r.top, w: r.width, h: r.height, preset: 'dust', origin: 'left', duration: 1100, grain: 2 })).done;
        if (!sc.alive) return;
        rows.delete(row);
        flip(() => { row.remove(); syncEmpty(); });
      }
    }

    async function toggle() {
      clearTimeout(timer);
      if (!checked) {
        checked = true;
        row.setAttribute('aria-checked', 'true');
        row.classList.add('on');
        measure();
        if (REDUCED.matches) prog.to(1, 150, (t) => t); else { pop.to(0.85, 90, CALM).then((ok) => ok && pop.spring(1, { stiffness: 340, damping: 13, mass: 0.8 })); prog.to(1, 320, (t) => t); }
        const inDone = row.parentNode === done;
        if (!inDone) timer = setTimeout(() => sc.alive && settle(), SETTLE);
      } else {
        checked = false;
        row.setAttribute('aria-checked', 'false');
        row.classList.remove('on');
        pop.to(1, 160, CALM);
        await prog.to(0, REDUCED.matches ? 150 : 160, (t) => t);
        if (!checked && row.parentNode === done) {
          row.style.opacity = '0';
          flip(() => { todo.prepend(row); syncEmpty(); });
          await row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140, easing: 'linear', fill: 'backwards' }).finished.catch(() => {});
          row.style.opacity = '';
        }
      }
    }
    sc.onDispose(() => clearTimeout(timer));
    row.addEventListener('click', toggle);
    row._toggle = toggle;
    rows.add(row);
    return row;
  }

  function fill() {
    rows.clear();
    todo.textContent = '';
    done.textContent = '';
    (tile ? TASKS.slice(0, 3) : TASKS).forEach((l) => todo.append(makeRow(l)));
    syncEmpty();
  }
  reset.addEventListener('click', () => { fill(); todo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); });

  let pick = null;
  if (!tile) {
    pick = chips([['move', 'Move'], ['dissolve', 'Dissolve']], after, (m) => { after = m; pick.set(m); syncEmpty(); }, 'After checking');
    root.append(pick.node);
  }
  fill();
  body.append(root);

  return {
    async run() {
      const pending = () => [...todo.querySelectorAll('.cp-tc-row')];
      if (pending().length < 2 || done.children.length > 1) fill();
      for (let k = 0; k < 2; k++) {
        const row = pending()[0];
        if (!row) break;
        row._toggle();
        await sc.wait(SETTLE + 1100);
      }
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'thinking-orb': {
    title: 'ThinkingOrb',
    note: 'A sphere of dots that shows what the agent is doing.',
    desc: 'An agent status indicator made of 180 dots. Idle, it breathes as a sphere; thinking, the dots split into three tilted rings; searching, the sphere flattens into a disc swept by a radar arc; listening, it pulses with the voice level; done, the dots fly into a checkmark; error, they fall and reform. Every state change moves each dot from where it is to its new place on the calm curve, staggered, never instant. With interactive on, dots flee the finger and spring back.',
    hint: 'Pick a state, or tap the orb. Hover to push the dots',
    tileHint: 'Tap the orb',
    mount: mountOrb,
    code: `${cmd('thinking-orb')}
${imp('ThinkingOrb', 'thinking-orb')}

<ThinkingOrb
  state={agent.status} // 'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'
  size={96}
  level={micLevel}
  interactive
/>`,
    props: [
      prop('state', `'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'`, `'idle'`, 'What the agent is doing. Each change moves every dot to its new place in 600 ms, staggered.'),
      prop('size', 'number', '64', 'Diameter of the orb.'),
      prop('dots', 'number', '180', 'Number of dots.'),
      prop('dotSize', 'number', '2.5', 'Dot diameter in points.'),
      prop('level', 'SharedValue&lt;number&gt;', '', 'Voice level 0 to 1 that drives the listening pulse.'),
      prop('interactive', 'boolean', 'false', 'Dots flee the finger within 40 pt and spring back.'),
      prop('haptics', 'boolean', 'true', 'Light impact on done, warning on error.'),
      prop('className', 'string', '', 'Classes of the container. Dots use the foreground token, done the success token, error the danger token.'),
    ],
  },
  'image-reveal': {
    title: 'ImageReveal',
    note: 'A generation loader that resolves coarse to fine.',
    desc: 'A loader for generated images. While pending, a 12 by 12 mosaic pulses with a slow diagonal wave. When the image arrives, it resolves from 8 to 128 cells in 1.4 s on a smoothstep, one even step per doubling, each cell switching to the real color past its own random threshold, then the finest mosaic crossfades into the sharp image in 180 ms. On error, the mosaic freezes, tints red and leaves as dust. The mosaic is one shader, no view per cell.',
    hint: 'Tap the frame to generate, Fail to see the error',
    tileHint: 'Tap to generate',
    mount: mountReveal,
    code: `${cmd('image-reveal')}
${imp('ImageReveal', 'image-reveal')}

<ImageReveal
  src={result?.uri}
  status={failed ? 'error' : result ? 'ready' : 'pending'}
  onRevealed={() => setShowActions(true)}
  onDismissed={retry}
  className="rounded-[20px]"
/>`,
    props: [
      prop('src', 'DataSourceParam', '', 'The generated image (require(...) or a uri). Reveals once loaded and status is ready.'),
      prop('status', `'pending' | 'ready' | 'error'`, `src ? 'ready' : 'pending'`, 'Pending shows the thinking mosaic, error sends it away as dust.'),
      prop('duration', 'number', '1400', 'Coarse to fine resolve, in ms. A 180 ms crossfade to the sharp image follows.'),
      prop('cells', 'number', '160', 'Finest mosaic across the width before the sharp image (8, 16, 32, 64, 128).'),
      prop('aspectRatio', 'number', '1', 'Width / height of the frame.'),
      prop('onRevealed', '() =&gt; void', '', 'Called once the sharp image is fully shown.'),
      prop('onDismissed', '() =&gt; void', '', 'Error: called once the mosaic has left as dust.'),
      prop('haptics', 'boolean', 'true', 'A tick at each resolution doubling, success at the end.'),
      prop('className', 'string', '', 'Classes of the frame: size, radius.'),
    ],
  },
  'sweep-transition': {
    title: 'SweepTransition',
    note: 'A crisp band sweeps across and leaves the new state.',
    desc: 'Wrap any view and call run() with your state change. The current view is captured, the new state mounts under it, and a 28 pt band sweeps across the capture, bending what it passes with a light refraction, a hint of RGB split and a 1 pt accent rim. Vertical, horizontal, or a circle growing from a touch point. cancel() sends the band back and restores the old state. No blur.',
    hint: 'Tap the card to sweep, tap again mid sweep to cancel',
    tileHint: 'Tap the card',
    mount: mountSweep,
    code: `${cmd('sweep-transition')}
import { useRef } from 'react';
import { SweepTransition, type SweepTransitionHandle } from '@/components/dissolve/sweep-transition';

const sweep = useRef<SweepTransitionHandle>(null);

<SweepTransition ref={sweep} mode="vertical" className="rounded-3xl">
  <PlanCard plan={plan} />
</SweepTransition>

sweep.current?.run(() => setPlan('pro'), { revert: () => setPlan('free') });`,
    props: [
      prop('mode', `'vertical' | 'horizontal' | 'radial'`, `'vertical'`, 'Bottom to top, left to right, or a circle from the origin.'),
      prop('duration', 'number', '720', 'Sweep length in ms, calm curve.'),
      prop('bandWidth', 'number', '28', 'Width of the refractive band.'),
      prop('ref.run', '(apply, { origin?, mode?, revert? }) =&gt; Promise&lt;void&gt;', '', 'Captures the view, runs apply under the capture, then sweeps it away. origin is the radial center in local points.'),
      prop('ref.cancel', '() =&gt; void', '', 'Sends the front back in 300 ms, then calls the run revert to put the old state back.'),
      prop('ref.running', '() =&gt; boolean', '', 'True while a sweep is on screen.'),
      prop('haptics', 'boolean', 'true', 'Light at start, soft when the front passes half.'),
      prop('className', 'string', '', 'Classes of the wrapper.'),
      prop('children', 'ReactNode', 'required', 'The view that changes.'),
    ],
  },
  'upload-tile': {
    title: 'UploadTile',
    note: 'Attachments that assemble from grains as they upload.',
    desc: 'An attachment tile for chat composers. The upload progress is the tile itself: from 0 to 1, its grains land one by one, a front running left to right, and at 1 the tile is whole. Only then the remove cross fades in. No ring, no badge. A file over maxSize, or an upload that rejects, completes, shakes three times, turns red and leaves as dust while the row closes up. Tap the tile during the upload to abort: the grains that have landed snap away from your finger. No picker dependency, you pass the files.',
    hint: 'Add files. Tap one while it uploads to cancel',
    tileHint: 'Add a file',
    mount: mountUpload,
    code: `${cmd('upload-tile')}
${imp('UploadTray', 'upload-tile')}

<UploadTray
  files={files}
  upload={(file, onProgress, signal) => api.upload(file, { onProgress, signal })}
  maxSize={25 * 1024 * 1024}
  onAdd={pickFiles}
  onRemove={(file) => setFiles((all) => all.filter((f) => f.id !== file.id))}
/>`,
    props: [
      prop('file', '{ id?, name, size, uri?, source? }', 'required', 'The file. An image uri or source shows as a thumbnail, anything else as a file icon, name and size.'),
      prop('upload', '(file, onProgress, signal) =&gt; Promise&lt;void&gt;', 'required', 'Your upload. Report progress 0 to 1: it drives how many grains have landed. Stop when the signal aborts (a tap on the tile aborts it), reject to show the error state.'),
      prop('maxSize', 'number', '', 'Bytes. A bigger file is rejected without starting the upload.'),
      prop('size', 'number', '72', 'Tile side. 6 pt of room are kept around it for the cross and the grains.'),
      prop('spacing', 'number', '0', 'Space after the tile in a row. It closes up with the tile.'),
      prop('onDone', '(file) =&gt; void', '', 'Called once the upload resolved and the tile is whole, as the cross appears.'),
      prop('onRemove', `(file, reason: 'rejected' | 'cancelled' | 'removed') =&gt; void`, '', 'Called once the tile has gone and its space has closed: drop the file here.'),
      prop('haptics', 'boolean', 'true', 'Success when whole, error on reject, light impact on cancel and remove.'),
      prop('className', 'string', '', 'Outer wrapper classes (margins).'),
      prop('tileClassName', 'string', '', 'Tile classes (background, radius).'),
    ],
  },
  'task-check': {
    title: 'TaskCheck',
    note: 'Check a task: box fills, text strikes, then it moves or dissolves.',
    desc: 'A to do row. Tap it: the box fills with a small spring, the check draws in 220 ms, the strike runs across each real line of text and the label goes muted. After a short delay the task moves to Done, or dissolves into dust from the left and the list closes up. Tap again before the delay to undo.',
    hint: 'Tap a task. Tap again quickly to undo',
    tileHint: 'Tap a task',
    mount: mountTasks,
    code: `${cmd('task-check')}
${imp('TaskCheck', 'task-check')}

<TaskCheck
  label={task.title}
  checked={task.done}
  onCheckedChange={(done) => update(task.id, { done })}
  after="move"
  onSettled={() => moveToDone(task.id)}
/>`,
    props: [
      prop('label', 'string', 'required', 'The task. The strike follows each line it wraps to.'),
      prop('checked', 'boolean', 'required', 'Checked state.'),
      prop('onCheckedChange', '(checked: boolean) =&gt; void', 'required', 'Called on tap.'),
      prop('after', `'stay' | 'move' | 'dissolve'`, `'stay'`, 'Once checked: nothing, onSettled so you move it to Done, or dust from the left, the gap closes, then onSettled.'),
      prop('settleDelay', 'number', '900', 'Pause before the task settles. A tap within it undoes.'),
      prop('onSettled', '() =&gt; void', '', 'Called when the task settles: move it, or drop it after the dust.'),
      prop('boxSize', 'number', '24', 'Checkbox side.'),
      prop('disabled', 'boolean', 'false', 'Turns the tap off.'),
      prop('haptics', 'boolean', 'true', 'Light impact on check.'),
      prop('className', 'string', '', 'Outer wrapper classes (margins, separators). This is the part that closes up.'),
      prop('rowClassName', 'string', '', 'Row classes (padding, gap).'),
      prop('labelClassName', 'string', '', 'Label classes (size, weight). The color is animated from the tokens.'),
    ],
  },
};
