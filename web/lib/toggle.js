// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  CALM,
  bezier,
  clamp,
  el,
  hash,
  injectStyle,
  loop,
  onThemeChange,
  propsOf,
  reducedMotion,
  rgbOf,
  scope,
  token,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/toggle.core.ts
var TOGGLE_SIZES = {
  sm: { width: 42, height: 26, inset: 2 },
  md: { width: 51, height: 31, inset: 2 },
  lg: { width: 60, height: 36, inset: 2.5 }
};
var DEFAULTS = { defaultValue: false, size: "md", haptics: true, disabled: false };
var STAGGER = 90;
var RUN = 260;
var GHOST_OUT = 80;
var THUMB_AT = 250;
var THUMB_IN = 90;
var FADE_AT = 300;
var FADE = 80;
var END = FADE_AT + FADE;
var TRACK = 300;
var SLIDE = 240;
var SHRINK = 0.5;
var SCATTER = 4;
var ARC = 5;
var MAX_GRAINS = 80;
var PITCH = 0.15;
var OVERLAP = 1.25;
var SWIPE = 8;
var PAD = 10;
var SHADOW = "0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 0.5px rgba(0, 0, 0, 0.04)";
var FLOW = bezier(0.42, 0, 0.12, 1);
function grainGrid(d) {
  let pitch = Math.max(3, d * PITCH);
  for (; ; ) {
    const cols = Math.max(3, Math.round(d / pitch)), p = d / cols, r = d / 2, out = [];
    for (let j = 0; j < cols; j++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * p, y = (j + 0.5) * p;
      if ((x - r) ** 2 + (y - r) ** 2 > (r - p * 0.3) ** 2) continue;
      const k = out.length;
      out.push([x, y, (y - r) / r * 0.8 + (hash(k, 3) - 0.5) * 0.7, hash(k, 4)]);
    }
    if (out.length <= MAX_GRAINS) return { grid: out, dot: p * OVERLAP };
    pitch *= 1.15;
  }
}
var CSS = `
:where([data-dissolve="toggle"]) { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="toggle"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 2px; }
:where(.dissolve-toggle-on) { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
:where(.dissolve-toggle-thumb) { position: absolute; left: 0; border-radius: 50%; will-change: transform, opacity; pointer-events: none; }
:where(.dissolve-toggle-grains) { position: absolute; pointer-events: none; }
`;
function createToggle(host, initial = {}) {
  injectStyle("dissolve-toggle", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "toggle";
  host.setAttribute("role", "switch");
  if (!host.hasAttribute("tabindex") && !(host instanceof HTMLButtonElement)) host.tabIndex = 0;
  Object.assign(host.style, { position: "relative", display: "block", flex: "none", border: "0", padding: "0", margin: "0", touchAction: "pan-y", cursor: "pointer", boxSizing: "border-box" });
  const onLayer = el("div", "dissolve-toggle-on");
  const ghost = el("div", "dissolve-toggle-thumb"), thumb = el("div", "dissolve-toggle-thumb");
  const cv = el("canvas", "dissolve-toggle-grains");
  const ctx = cv.getContext("2d");
  host.append(onLayer, ghost, thumb, cv);
  let W = 0, H = 0, d = 0, inset = 0, offX = 0, onX = 0, dpr = 1;
  let grid = [], dot = 0, N = 0;
  let D = new Float32Array(0), F = new Float32Array(0);
  let target = p().value ?? p().defaultValue ? 1 : 0;
  let req = false, flying = false, startAt = 0;
  let thumbX = 0, thumbA = 1, ghostX = 0, ghostA = 0, ghostA0 = 0, slideFrom = 0, onA = target, onFrom = 0;
  let thumbColor = "#fff";
  const apply = () => {
    thumb.style.transform = `translateX(${thumbX}px)`;
    thumb.style.opacity = String(thumbA);
    ghost.style.transform = `translateX(${ghostX}px)`;
    ghost.style.opacity = String(ghostA);
    onLayer.style.opacity = String(onA);
  };
  function paint() {
    const o = p();
    const bg = rgbOf(token(host, "background", "rgb(255 255 255)")), fg = rgbOf(token(host, "foreground", "rgb(28 28 30)"));
    const dark = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255 < 0.5;
    host.style.background = o.offColor ?? `rgba(${fg[0]}, ${fg[1]}, ${fg[2]}, ${dark ? 0.2 : 0.1})`;
    onLayer.style.background = o.onColor ?? token(host, "success", "rgb(52 199 89)");
    thumbColor = o.thumbColor ?? "rgb(255, 255, 255)";
    ghost.style.background = thumb.style.background = thumbColor;
    ghost.style.boxShadow = thumb.style.boxShadow = SHADOW;
  }
  function layout() {
    const s = TOGGLE_SIZES[p().size] ?? TOGGLE_SIZES.md;
    W = s.width;
    H = s.height;
    inset = s.inset;
    d = H - inset * 2;
    offX = inset;
    onX = W - inset - d;
    Object.assign(host.style, { width: W + "px", height: H + "px", borderRadius: H / 2 + "px" });
    for (const t of [ghost, thumb]) Object.assign(t.style, { width: d + "px", height: d + "px", top: inset + "px" });
    ({ grid, dot } = grainGrid(d));
    N = grid.length;
    D = new Float32Array(N * 4);
    F = new Float32Array(N * 4);
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round((W + PAD * 2) * dpr);
    cv.height = Math.round((H + PAD * 2) * dpr);
    cv.style.cssText = `left:${-PAD}px;top:${-PAD}px;width:${W + PAD * 2}px;height:${H + PAD * 2}px`;
    flying = req = false;
    thumbX = target ? onX : offX;
    thumbA = 1;
    ghostA = 0;
    onA = target;
    ctx.clearRect(0, 0, cv.width, cv.height);
    apply();
  }
  function frame(now) {
    if (!req && !flying) return;
    const reduced = reducedMotion(), toX = target ? onX : offX, CW = W + PAD * 2, CH = H + PAD * 2;
    if (req) {
      req = false;
      onFrom = onA;
      if (flying && !reduced) F.set(D);
      else for (let i = 0; i < N; i++) {
        F[i * 4] = thumbX + grid[i][0];
        F[i * 4 + 1] = inset + grid[i][1];
        F[i * 4 + 2] = 1;
        F[i * 4 + 3] = 1;
      }
      ghostX = thumbX;
      ghostA0 = thumbA;
      slideFrom = thumbX;
      startAt = now;
      flying = true;
      if (!reduced) {
        thumbX = toX;
        thumbA = 0;
      }
    }
    const since = now - startAt;
    onA = onFrom + (target - onFrom) * FLOW(clamp(since / (reduced ? SLIDE : TRACK)));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    if (reduced) {
      thumbX = slideFrom + (toX - slideFrom) * CALM(clamp(since / SLIDE));
      thumbA = 1;
      ghostA = 0;
      if (since >= SLIDE) flying = false;
      return apply();
    }
    const dir = toX >= ghostX ? 1 : -1;
    const out = clamp((since - FADE_AT) / FADE);
    ctx.fillStyle = thumbColor;
    for (let i = 0; i < N; i++) {
      const g = grid[i], o = i * 4;
      const u = g[0] / d, lead = dir > 0 ? u : 1 - u;
      const delay = (1 - lead) * STAGGER * 0.6 + g[3] * STAGGER * 0.4;
      const run = RUN * (0.85 + 0.3 * hash(i, 9));
      const e = FLOW(clamp((since - delay) / run)), bump = Math.sin(Math.PI * e);
      D[o] = F[o] + (toX + g[0] - F[o]) * e + (hash(i, 5) - 0.5) * SCATTER * bump;
      D[o + 1] = F[o + 1] + (inset + g[1] - F[o + 1]) * e + g[2] * ARC * bump;
      D[o + 2] = (F[o + 2] + (1 - F[o + 2]) * clamp(since / 50)) * (1 - out);
      D[o + 3] = (F[o + 3] + (1 - F[o + 3]) * e) * (1 - SHRINK * bump);
      if (D[o + 2] <= 3e-3) continue;
      ctx.globalAlpha = D[o + 2];
      ctx.beginPath();
      ctx.arc(D[o] + PAD, D[o + 1] + PAD, dot * D[o + 3] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ghostA = ghostA0 * (1 - clamp(since / GHOST_OUT));
    thumbA = clamp((since - THUMB_AT) / THUMB_IN);
    if (since >= END) {
      flying = false;
      for (let i = 0; i < N; i++) D[i * 4 + 2] = 0;
      ctx.clearRect(0, 0, CW, CH);
      thumbA = 1;
      ghostA = 0;
    }
    apply();
  }
  const { kick } = loop(sc, host, frame, () => req || flying);
  const syncAria = () => host.setAttribute("aria-checked", String(target === 1));
  function set(t, user = true) {
    if (user && p().disabled) return;
    if (t === target) return;
    target = t;
    req = true;
    syncAria();
    kick();
    if (!user) return;
    if (p().haptics) vibrate(4);
    p().onValueChange?.(t === 1);
  }
  let ptr = null;
  const onDown = (e) => {
    if (e.button > 0 || p().disabled) return;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
  };
  const onMove = (e) => {
    if (!ptr || ptr.id !== e.pointerId || ptr.drag) return;
    const dx = Math.abs(e.clientX - ptr.x), dy = Math.abs(e.clientY - ptr.y);
    if (dy > 12 && dy > dx) {
      ptr = null;
      return;
    }
    if (dx < 6) return;
    ptr.drag = true;
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
    }
  };
  const onEnd = (e) => {
    if (!ptr || ptr.id !== e.pointerId) return;
    const dx = e.clientX - ptr.x;
    if (e.type === "pointerup") {
      if (ptr.drag) {
        if (dx > SWIPE) set(1);
        else if (dx < -SWIPE) set(0);
      } else set(1 - target);
    }
    ptr = null;
  };
  const onClick = (e) => {
    if (e.detail === 0) set(1 - target);
  };
  const onKey = (e) => {
    if (host instanceof HTMLButtonElement) return;
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    set(1 - target);
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onEnd);
  host.addEventListener("pointercancel", onEnd);
  host.addEventListener("click", onClick);
  host.addEventListener("keydown", onKey);
  onThemeChange(sc, () => {
    paint();
    kick();
  });
  const disable = () => {
    host.style.opacity = p().disabled ? "0.5" : "";
    host.setAttribute("aria-disabled", String(p().disabled));
  };
  const label = () => {
    if (p().accessibilityLabel) host.setAttribute("aria-label", p().accessibilityLabel);
    else host.removeAttribute("aria-label");
  };
  syncAria();
  paint();
  disable();
  label();
  layout();
  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("size")) layout();
      if (changed.has("value") && p().value !== void 0) set(p().value ? 1 : 0, false);
      if (changed.has("onColor") || changed.has("offColor") || changed.has("thumbColor")) {
        paint();
        kick();
      }
      if (changed.has("disabled")) disable();
      if (changed.has("accessibilityLabel")) label();
    },
    destroy() {
      sc.dispose();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onEnd);
      host.removeEventListener("pointercancel", onEnd);
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
      onLayer.remove();
      ghost.remove();
      thumb.remove();
      cv.remove();
      for (const k of ["position", "display", "flex", "border", "padding", "margin", "touch-action", "cursor", "box-sizing", "background", "width", "height", "border-radius", "opacity"]) host.style.removeProperty(k);
      for (const a of ["role", "aria-checked", "aria-disabled", "aria-label", "data-dissolve"]) host.removeAttribute(a);
      if (!(host instanceof HTMLButtonElement)) host.removeAttribute("tabindex");
    }
  };
}
export {
  TOGGLE_SIZES,
  createToggle
};
