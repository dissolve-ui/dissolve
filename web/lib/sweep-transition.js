// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  glProgram
} from "./chunks/chunk-OQW5JTMC.js";
import {
  DPR
} from "./chunks/chunk-R2UPSOGD.js";
import {
  CALM,
  el,
  frame,
  injectStyle,
  propsOf,
  reducedMotion,
  rgbOf,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/sweep-transition.core.ts
var DEFAULTS = { mode: "vertical", duration: 720, bandWidth: 28, haptics: true };
var MODE_INDEX = { vertical: 0, horizontal: 1, radial: 2 };
var FS = `#version 300 es
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
var CSS = `
:where([data-dissolve="sweep-transition"]) { position: relative; display: block; overflow: hidden; isolation: isolate; }
:where(.dissolve-sweep-over, .dissolve-sweep-shot) { position: absolute; left: 0; top: 0; display: block; pointer-events: none; }
:where(.dissolve-sweep-over) { opacity: 0; }
`;
var radii = (cs) => [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((r) => parseFloat(r) || 0);
function rasterize(root, w, h) {
  const c = document.createElement("canvas");
  c.width = Math.round(w * DPR);
  c.height = Math.round(h * DPR);
  const x = c.getContext("2d");
  const R = root.getBoundingClientRect(), s = R.width / root.offsetWidth || 1;
  x.setTransform(DPR / s, 0, 0, DPR / s, -R.left * DPR / s, -R.top * DPR / s);
  const range = document.createRange();
  const visit = (node, alpha) => {
    const cs = getComputedStyle(node);
    if (cs.display === "none") return;
    const a = alpha * (parseFloat(cs.opacity) || 0);
    if (a <= 0) return;
    const visible = cs.visibility !== "hidden";
    const b = node.getBoundingClientRect();
    x.globalAlpha = a;
    if (visible) {
      const bg = rgbOf(cs.backgroundColor);
      const bw = parseFloat(cs.borderTopWidth) || 0;
      if (bg[3] > 0 || bw > 0 && cs.borderTopStyle !== "none") {
        x.beginPath();
        x.roundRect(b.left, b.top, b.width, b.height, radii(cs));
        if (bg[3] > 0) {
          x.fillStyle = cs.backgroundColor;
          x.fill();
        }
        if (bw > 0 && cs.borderTopStyle !== "none") {
          x.beginPath();
          x.roundRect(b.left + bw / 2, b.top + bw / 2, b.width - bw, b.height - bw, radii(cs).map((r) => Math.max(0, r - bw / 2)));
          x.lineWidth = bw;
          x.strokeStyle = cs.borderTopColor;
          x.stroke();
        }
      }
      if (node instanceof HTMLImageElement || node instanceof HTMLCanvasElement || node instanceof HTMLVideoElement) {
        x.save();
        x.beginPath();
        x.roundRect(b.left, b.top, b.width, b.height, radii(cs));
        x.clip();
        try {
          x.drawImage(node, b.left, b.top, b.width, b.height);
        } catch {
        }
        x.restore();
      }
    }
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) visit(child, a);
      else if (visible && child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        x.globalAlpha = a;
        x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        x.fillStyle = cs.color;
        x.textBaseline = "middle";
        const text = child.textContent;
        for (const m of text.matchAll(/\S+/g)) {
          range.setStart(child, m.index);
          range.setEnd(child, m.index + m[0].length);
          const r = range.getBoundingClientRect();
          if (r.width) x.fillText(m[0], r.left, r.top + r.height / 2);
        }
      }
    }
  };
  visit(root, 1);
  return c;
}
function createSweepTransition(host, initial = {}) {
  injectStyle("dissolve-sweep-transition", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "sweep-transition";
  const slot = el("div");
  const over = el("canvas", "dissolve-sweep-over");
  host.append(slot, over);
  const G = glProgram(sc, over, FS);
  let W = 0, H = 0, busy = false, forward = false, half = false;
  let mode = "vertical", origin = { x: 0, y: 0 };
  let tex = null, shot = null;
  let revert, settle = null;
  const P = value(sc, 0, () => {
    render();
    if (forward && !half && P.v >= 0.5) {
      half = true;
      if (p().haptics) vibrate(3);
    }
  });
  function render() {
    if (!G || !tex) return;
    G.f("size", W, H);
    G.f("dpr", DPR);
    G.f("p", P.v);
    G.f("band", p().bandWidth);
    G.f("mode", MODE_INDEX[mode] ?? 0);
    G.f("origin", origin.x, origin.y);
    const [r, g, b] = rgbOf(token(host, "accent", "rgb(10 132 255)"));
    G.f("rim", r / 255, g / 255, b / 255);
    G.draw();
  }
  async function finish(restore) {
    if (restore) {
      revert?.();
      await frame();
      await frame();
    }
    over.style.opacity = "0";
    shot?.remove();
    shot = null;
    busy = false;
    forward = false;
    const done = settle;
    settle = null;
    done?.();
  }
  function cancel() {
    if (!busy || shot) return;
    forward = false;
    P.to(0, 300, CALM).then((ok) => {
      if (ok && sc.alive) finish(true);
    });
  }
  async function run(apply, options = {}) {
    if (busy) return cancel();
    W = host.clientWidth;
    H = host.clientHeight;
    if (!W || !H) {
      apply();
      return;
    }
    const capture = rasterize(host, W, H);
    busy = true;
    revert = options.revert;
    mode = options.mode ?? p().mode;
    origin = options.origin ?? { x: W / 2, y: H / 2 };
    forward = false;
    half = false;
    const ended = new Promise((res) => settle = res);
    let gl = !!G && !reducedMotion();
    if (gl) {
      try {
        tex = G.texture(capture, false, tex);
      } catch {
        gl = false;
      }
    }
    if (!gl) {
      shot = capture;
      shot.className = "dissolve-sweep-shot";
      Object.assign(shot.style, { width: W + "px", height: H + "px" });
      host.append(shot);
      await frame();
      await frame();
      if (!sc.alive) return;
      apply();
      await frame();
      await frame();
      await shot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.catch(() => {
      });
      if (sc.alive) finish(false);
      return ended;
    }
    over.width = Math.round(W * DPR);
    over.height = Math.round(H * DPR);
    Object.assign(over.style, { width: W + "px", height: H + "px" });
    P.set(0);
    over.style.opacity = "1";
    await frame();
    await frame();
    if (!sc.alive) return;
    apply();
    if (p().haptics) vibrate(6);
    forward = true;
    if (await P.to(1, p().duration, CALM)) finish(false);
    return ended;
  }
  return {
    slot,
    run,
    cancel,
    running: () => busy,
    update(next) {
      props.update(next);
    },
    destroy() {
      sc.dispose();
      settle?.();
      slot.remove();
      over.remove();
      shot?.remove();
      delete host.dataset.dissolve;
    }
  };
}
export {
  createSweepTransition
};
