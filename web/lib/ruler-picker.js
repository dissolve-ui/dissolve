// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  createNumberTicker
} from "./chunks/chunk-O6B3NHPJ.js";
import {
  CALM,
  clamp,
  el,
  fontOf,
  injectStyle,
  onThemeChange,
  propsOf,
  reducedMotion,
  rr,
  scope,
  token,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/ruler-picker.core.ts
var DEFAULTS = { step: 1, majorEvery: 10, tickSpacing: 10, height: 76, showValue: true, fontSize: 56, haptics: true };
var RUBBER = 0.3;
var MINOR = 12;
var HALF = 18;
var MAJOR = 26;
var WAKE = 4;
var SIGMA = 24;
var TOP = 10;
var TICK_GAP = 25;
var CSS = `
:where([data-dissolve="ruler-picker"]) { display: flex; flex-direction: column; align-items: stretch; }
:where(.dissolve-ruler-head) { display: flex; align-items: flex-end; justify-content: center; gap: 6px; }
:where(.dissolve-ruler-value) { font-weight: 700; letter-spacing: -1px; }
:where(.dissolve-ruler-unit) { font-weight: 600; color: var(--dissolve-muted, rgb(142 142 147)); line-height: 1; }
:where(.dissolve-ruler-canvas) { display: block; cursor: grab; touch-action: pan-y; outline: none; border-radius: 8px; }
:where(.dissolve-ruler-canvas[data-dragging]) { cursor: grabbing; }
:where(.dissolve-ruler-canvas:focus-visible) { box-shadow: 0 0 0 2px color-mix(in srgb, var(--dissolve-accent, rgb(10 132 255)) 12%, transparent); }
`;
function decimalsOf(step) {
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}
function sample(list, x) {
  const now = performance.now();
  list.push([now, x]);
  while (list.length > 2 && now - list[0][0] > 80) list.shift();
}
function velocity(list) {
  if (list.length < 2) return 0;
  const a = list[0], b = list[list.length - 1], dt = (b[0] - a[0]) / 1e3;
  return dt > 0 ? (b[1] - a[1]) / dt : 0;
}
function createRulerPicker(host, initial) {
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "ruler-picker";
  const head = el("div", "dissolve-ruler-head");
  const unitEl = el("span", "dissolve-ruler-unit");
  head.append(unitEl);
  const cv = el("canvas", "dissolve-ruler-canvas");
  cv.tabIndex = 0;
  cv.setAttribute("role", "slider");
  host.append(head, cv);
  const ctx = cv.getContext("2d");
  let tk = null;
  let tkHost = null;
  let decimals = 0, count = 1, sp = 10, maxOff = 10, W = 0, H = 0, dpr = 1;
  const toValue = (i) => Number((p().min + i * p().step).toFixed(decimals));
  const toIndex = (v) => clamp(Math.round((v - p().min) / p().step), 0, count);
  const label = (v) => p().format ? p().format(v) : v.toFixed(decimals);
  let C = { ink: "", muted: "", needle: "" };
  const readColors = () => {
    C = { ink: token(host, "foreground", "rgb(28 28 30)"), muted: token(host, "muted", "rgb(142 142 147)"), needle: token(host, "primary", "rgb(28 28 30)") };
  };
  let emitted = p().value;
  let off = 0, vel = 0, wake = 0, lastOff = 0, last = 0, raf = 0;
  let mode = "idle";
  let live = false;
  let anim = null;
  let shown = 0, tkAt = 0, crossed = 0, edge = 0, lastTick = 0;
  function geometry() {
    const o = p();
    decimals = decimalsOf(o.step);
    count = Math.max(1, Math.round((o.max - o.min) / o.step));
    sp = o.tickSpacing;
    maxOff = count * sp;
    off = lastOff = toIndex(emitted) * sp;
    shown = crossed = toIndex(emitted);
    cv.setAttribute("aria-label", o.unit ? `Value in ${o.unit}` : "Value");
    cv.setAttribute("aria-valuemin", String(o.min));
    cv.setAttribute("aria-valuemax", String(o.max));
    aria();
  }
  function size() {
    const o = p();
    W = host.clientWidth;
    H = o.height;
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    cv.style.marginTop = o.showValue ? "12px" : "0";
  }
  function readoutEl() {
    const o = p();
    head.hidden = !o.showValue;
    unitEl.textContent = o.unit ?? "";
    unitEl.hidden = !o.unit;
    unitEl.style.fontSize = Math.round(o.fontSize * 0.36) + "px";
    unitEl.style.marginBottom = Math.round(o.fontSize * 0.2) + "px";
    tk?.destroy();
    tkHost?.remove();
    tkHost = el("span");
    head.prepend(tkHost);
    tk = createNumberTicker(tkHost, { value: toValue(shown), decimals, fontSize: o.fontSize, duration: 420, stagger: 18, separator: "", textClassName: valueClass() });
    injectStyle("dissolve-ruler-picker", CSS);
  }
  const valueClass = () => "dissolve-ruler-value" + (p().valueClassName ? " " + p().valueClassName : "");
  function aria() {
    const v = toValue(shown);
    cv.setAttribute("aria-valuenow", String(v));
    cv.setAttribute("aria-valuetext", `${label(v)}${p().unit ? ` ${p().unit}` : ""}`);
  }
  function draw() {
    if (!W) return;
    const { majorEvery } = p();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const first = Math.max(0, Math.floor((off - cx) / sp) - 1);
    const lastI = Math.min(count, Math.ceil((off + cx) / sp) + 1);
    const halfEvery = majorEvery % 2 === 0 ? majorEvery / 2 : 0;
    ctx.font = `500 12px ${fontOf(host)}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let i = first; i <= lastI; i++) {
      const x = cx + i * sp - off, d = x - cx;
      const e = Math.min(1, Math.abs(d) / cx);
      const fade = 1 - e * e * e;
      if (fade <= 0.01) continue;
      const major = i % majorEvery === 0, half = !major && halfEvery > 0 && i % halfEvery === 0;
      const len = (major ? MAJOR : half ? HALF : MINOR) + WAKE * wake * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      const tw = major ? 2 : 1.5;
      const px = Math.round((x - tw / 2) * dpr) / dpr;
      ctx.globalAlpha = fade * (major ? 1 : 0.8);
      ctx.fillStyle = major ? C.ink : C.muted;
      rr(ctx, px, TOP, tw, len, tw / 2);
      ctx.fill();
      if (major) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = C.muted;
        ctx.fillText(label(toValue(i)), Math.round(x * dpr) / dpr, TOP + MAJOR + WAKE + 18);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.needle;
    rr(ctx, Math.round((cx - 2) * dpr) / dpr, 0, 4, TOP + MAJOR + WAKE + 4, 2);
    ctx.fill();
  }
  function buzz(kind) {
    if (!p().haptics) return;
    const now = performance.now();
    if (kind !== "bound" && now - lastTick < TICK_GAP) return;
    lastTick = now;
    vibrate(kind === "bound" ? 12 : kind === "major" ? 8 : 4);
  }
  function track() {
    const i = clamp(Math.round(off / sp), 0, count);
    if (i !== crossed) {
      crossed = i;
      if (live) {
        p().onChanging?.(toValue(i));
        buzz(i % p().majorEvery === 0 ? "major" : "step");
      }
    }
    const e = off <= 0.01 ? -1 : off >= maxOff - 0.01 ? 1 : 0;
    if (e !== edge) {
      edge = e;
      if (e && live) buzz("bound");
    }
  }
  function readout(force) {
    const i = clamp(Math.round(off / sp), 0, count);
    if (i === shown && !force) return;
    const now = performance.now();
    if (!force && now - tkAt < 60) return;
    shown = i;
    tkAt = now;
    tk?.update({ value: toValue(i) });
    aria();
  }
  function commit() {
    live = false;
    const i = clamp(Math.round(off / sp), 0, count);
    const v = toValue(i);
    if (v !== emitted) {
      emitted = v;
      p().onChange?.(v);
    }
  }
  function tick(now) {
    raf = 0;
    if (!sc.alive) return;
    const dt = Math.max(1, Math.min(64, now - last));
    last = now;
    if (mode === "decay") {
      vel *= Math.pow(0.997, dt);
      off += vel * dt / 1e3;
      if (off <= 0 || off >= maxOff) {
        off = clamp(off, 0, maxOff);
        vel = 0;
      }
      if (Math.abs(vel) < 18) settle();
    } else if (mode === "anim" && anim) {
      const k = anim.ms > 0 ? clamp((now - anim.t0) / anim.ms) : 1;
      off = anim.from + (anim.to - anim.from) * CALM(k);
      if (k >= 1) {
        const a = anim;
        anim = null;
        mode = "idle";
        a.done?.();
      }
    }
    const speed = Math.abs(off - lastOff) / dt * 1e3;
    lastOff = off;
    const target = reducedMotion() ? 0 : Math.min(speed / 1500, 1);
    wake = target > wake ? target : Math.max(target, wake - dt / 300);
    track();
    draw();
    readout(mode === "idle");
    if (mode !== "idle" || wake > 0 || shown !== clamp(Math.round(off / sp), 0, count)) kick();
  }
  function kick() {
    if (!raf && sc.alive) {
      last = last || performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
  sc.onDispose(() => cancelAnimationFrame(raf));
  function animTo(to, ms, done) {
    mode = "anim";
    anim = { from: off, to, ms, t0: performance.now(), done };
    last = performance.now();
    kick();
  }
  function settle() {
    const i = clamp(Math.round(off / sp), 0, count);
    animTo(i * sp, reducedMotion() ? 150 : 300, commit);
  }
  function release(v) {
    if (off < 0 || off > maxOff) return animTo(off < 0 ? 0 : maxOff, reducedMotion() ? 150 : 420, commit);
    if (reducedMotion()) return settle();
    mode = "decay";
    vel = v;
    last = performance.now();
    kick();
  }
  const rubber = (x) => x < 0 ? x * RUBBER : x > maxOff ? maxOff + (x - maxOff) * RUBBER : x;
  const unrubber = (o) => o < 0 ? o / RUBBER : o > maxOff ? maxOff + (o - maxOff) / RUBBER : o;
  let g = null;
  const onDown = (e) => {
    if (e.button > 0) return;
    mode = "drag";
    anim = null;
    vel = 0;
    live = true;
    g = { x0: e.clientX, y0: e.clientY, px: e.clientX, raw: unrubber(off), on: false, samples: [] };
    sample(g.samples, e.clientX);
  };
  const onMove = (e) => {
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.on) {
      if (e.pointerType !== "mouse" && Math.abs(dy) > 12 && Math.abs(dx) <= 4) {
        g = null;
        settle();
        return;
      }
      if (Math.abs(dx) <= 4) return;
      g.on = true;
      g.px = e.clientX;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
      }
      cv.toggleAttribute("data-dragging", true);
    }
    sample(g.samples, e.clientX);
    g.raw -= e.clientX - g.px;
    g.px = e.clientX;
    off = rubber(g.raw);
    kick();
  };
  const onUp = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    cv.removeAttribute("data-dragging");
    if (!st.on || e.type === "pointercancel") return settle();
    sample(st.samples, e.clientX);
    release(clamp(-velocity(st.samples), -6e3, 6e3));
  };
  let wheelT;
  const onWheel = (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    e.preventDefault();
    mode = "drag";
    anim = null;
    live = true;
    off = clamp(off + d * (e.deltaMode === 1 ? 16 : 1), 0, maxOff);
    kick();
    clearTimeout(wheelT);
    wheelT = setTimeout(() => sc.alive && settle(), 140);
  };
  sc.onDispose(() => clearTimeout(wheelT));
  const onKey = (e) => {
    const k = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    live = false;
    const i = clamp(Math.round((anim ? anim.to : off) / sp) + k * (e.shiftKey ? p().majorEvery : 1), 0, count);
    animTo(i * sp, reducedMotion() ? 150 : 260, commit);
  };
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerup", onUp);
  cv.addEventListener("pointercancel", onUp);
  cv.addEventListener("wheel", onWheel, { passive: false });
  cv.addEventListener("keydown", onKey);
  onThemeChange(sc, () => {
    readColors();
    draw();
  });
  const ro = new ResizeObserver(() => {
    if (host.clientWidth === W) return;
    size();
    draw();
  });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());
  geometry();
  readColors();
  readoutEl();
  size();
  draw();
  return {
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      const has = (...keys) => keys.some((k) => changed.has(k));
      if (has("min", "max", "step", "tickSpacing")) {
        mode = "idle";
        anim = null;
        geometry();
      } else if (changed.has("value") && p().value !== emitted) {
        emitted = p().value;
        live = false;
        animTo(toIndex(emitted) * sp, reducedMotion() ? 150 : 420);
      }
      if (has("fontSize", "showValue", "unit", "min", "max", "step")) readoutEl();
      else if (changed.has("valueClassName")) tk?.update({ textClassName: valueClass() });
      if (has("format", "unit")) aria();
      if (has("height", "showValue")) size();
      draw();
    },
    destroy() {
      sc.dispose();
      g = null;
      tk?.destroy();
      head.remove();
      cv.remove();
      delete host.dataset.dissolve;
    }
  };
}
export {
  createRulerPicker
};
