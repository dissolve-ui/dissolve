// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  glProgram
} from "./chunks/chunk-OQW5JTMC.js";
import {
  DPR,
  play,
  snapshot
} from "./chunks/chunk-6TDGCXIW.js";
import {
  CALM,
  clamp,
  el,
  injectStyle,
  loop,
  onThemeChange,
  propsOf,
  rectOf,
  reducedMotion,
  rgbOf,
  rr,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/image-reveal.core.ts
var DEFAULTS = { duration: 1400, cells: 160, aspectRatio: 1, haptics: true };
var SHARPEN = 180;
var LAST = 0.3;
var FS = `#version 300 es
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
var CSS = `
:where([data-dissolve="image-reveal"]) {
  position: relative; display: block; width: 100%; overflow: hidden; border-radius: 20px;
  background: var(--dissolve-surface-2, rgb(229 229 234));
}
:where([data-dissolve="image-reveal"][data-gone]) { background: none; }
:where(.dissolve-reveal-canvas) { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
`;
var unit = (c) => {
  const [r, g, b] = rgbOf(c);
  return [r / 255, g / 255, b / 255];
};
function createImageReveal(host, initial = {}) {
  injectStyle("dissolve-image-reveal", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "image-reveal";
  host.setAttribute("role", "img");
  const cv = el("canvas", "dissolve-reveal-canvas");
  host.append(cv);
  const G = glProgram(sc, cv, FS);
  let W = 0, H = 0;
  let colors = null;
  let img = null, loaded = "", tex = null, aspect = 1, iw = 1;
  let t = 0, sharp = 0, time0 = performance.now(), frozen = null, run = 0, lastLevel = 0;
  let revealing = false, gone = false;
  const phase = () => p().status ?? (p().src ? "ready" : "pending");
  const maxLv = () => Math.max(0, Math.floor(Math.log2(Math.max(8, p().cells) / 8)));
  const badV = value(sc, 0, () => paint(performance.now()));
  const sharpV = value(sc, 0, () => {
    sharp = sharpV.v;
    paint(performance.now());
  });
  function uniforms(now) {
    const top = maxLv();
    const e = t * t * (3 - 2 * t), L = (top + LAST) * e;
    const level = Math.min(top, Math.floor(L));
    const lp = level === top ? clamp((L - top) / LAST) : L - level;
    const A = 8 * 2 ** level, B = A / 2;
    const lod = (n) => Math.log2(Math.max(1, iw / n));
    if (!colors) {
      colors = {
        c0: unit(token(host, "surface-2", "rgb(229 229 234)")),
        c1: unit(token(host, "muted", "rgb(142 142 147)")),
        bad: unit(token(host, "danger", "rgb(255 59 48)"))
      };
    }
    if (level > lastLevel && revealing && !reducedMotion() && p().haptics) vibrate(4);
    lastLevel = level;
    G.f("size", W, H);
    G.f("dpr", DPR);
    G.f("time", (frozen ?? now - time0) / 1e3);
    G.f("hasImage", tex && phase() !== "pending" ? 1 : 0);
    G.f("level", level);
    G.f("lp", t >= 1 ? 1 : lp);
    G.f("cellsA", A);
    G.f("cellsB", B);
    G.f("lodA", lod(A));
    G.f("lodB", lod(B));
    G.f("sharp", sharp);
    G.f("bad", badV.v);
    G.f("aspect", aspect);
    G.f("c0", ...colors.c0);
    G.f("c1", ...colors.c1);
    G.f("cBad", ...colors.bad);
  }
  function paint(now) {
    if (!G || !W || gone) return;
    uniforms(now);
    G.draw();
  }
  const { kick } = loop(sc, cv, paint, () => phase() === "pending" || revealing || phase() === "ready" && !tex);
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || w === W && h === H) return;
    W = w;
    H = h;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    paint(performance.now());
  });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());
  function setGone(on) {
    gone = on;
    host.toggleAttribute("data-gone", on);
    cv.style.visibility = on ? "hidden" : "";
  }
  function decorate() {
    const ph = phase();
    host.style.aspectRatio = String(p().aspectRatio);
    host.setAttribute("aria-label", ph === "pending" ? "Generating image" : ph === "error" ? "Generation failed" : "Generated image");
    host.toggleAttribute("aria-busy", ph === "pending" || revealing);
  }
  async function load(my) {
    const src = p().src;
    if (!src || !G) return;
    if (loaded !== src) {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = src;
      try {
        await im.decode();
      } catch {
        return;
      }
      if (my !== run || !sc.alive) return;
      img = im;
      loaded = src;
    }
    tex = G.texture(img, true, tex);
    aspect = img.naturalWidth / img.naturalHeight;
    iw = Math.min(img.naturalWidth, img.naturalHeight);
    reveal(my);
  }
  async function reveal(my) {
    if (reducedMotion()) {
      t = 1;
      sharpV.set(1);
      cv.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150 });
      done(my);
      return;
    }
    revealing = true;
    decorate();
    kick();
    const start = performance.now(), duration = p().duration;
    await new Promise((res) => {
      const f = (now) => {
        if (my !== run || !sc.alive) return res();
        t = clamp((now - start) / duration);
        if (t < 1) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    if (my !== run) return;
    revealing = false;
    if (await sharpV.to(1, SHARPEN, CALM)) done(my);
  }
  function done(my) {
    if (my !== run) return;
    decorate();
    if (p().haptics) vibrate([10, 40, 18]);
    p().onRevealed?.();
  }
  async function fail(my) {
    frozen = performance.now() - time0;
    revealing = false;
    if (!await badV.to(1, 200, CALM) || my !== run || !sc.alive) return;
    if (reducedMotion() || !G || !W) {
      setGone(true);
      p().onDismissed?.();
      return;
    }
    paint(performance.now());
    const r = rectOf(host), radius = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0;
    const source = snapshot(W, H, (x) => {
      rr(x, 0, 0, W, H, radius);
      x.clip();
      x.drawImage(cv, 0, 0, W, H);
    });
    setGone(true);
    await sc.track(play({ source, x: r.x, y: r.y, w: W, h: H, preset: "dust", duration: 1100 })).done;
    if (my === run && sc.alive) p().onDismissed?.();
  }
  function apply() {
    const my = ++run, ph = phase();
    if (ph === "pending") {
      t = 0;
      frozen = null;
      time0 = performance.now();
      revealing = false;
      lastLevel = 0;
      sharpV.set(0);
      badV.set(0);
      setGone(false);
      decorate();
      kick();
      return;
    }
    if (ph === "error") {
      decorate();
      fail(my);
      return;
    }
    t = 0;
    frozen = null;
    revealing = false;
    lastLevel = 0;
    sharpV.set(0);
    badV.set(0);
    setGone(false);
    decorate();
    kick();
    load(my);
  }
  onThemeChange(sc, () => {
    colors = null;
    paint(performance.now());
  });
  apply();
  return {
    update(next) {
      const before = phase(), src = p().src;
      const changed = props.update(next);
      if (!changed.size) return;
      if (phase() !== before || phase() === "ready" && p().src !== src) apply();
      else decorate();
    },
    destroy() {
      run++;
      sc.dispose();
      cv.remove();
      delete host.dataset.dissolve;
      for (const a of ["role", "aria-label", "aria-busy", "data-gone"]) host.removeAttribute(a);
      host.style.removeProperty("aspect-ratio");
    }
  };
}
export {
  createImageReveal
};
