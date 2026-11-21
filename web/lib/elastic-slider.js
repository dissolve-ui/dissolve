// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  el,
  injectStyle,
  onThemeChange,
  propsOf,
  reducedMotion,
  rgbOf,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/elastic-slider.core.ts
var ELASTIC_SLIDER_SIZES = {
  sm: { height: 32, font: 13, pad: 14 },
  md: { height: 44, font: 15, pad: 16 },
  lg: { height: 56, font: 17, pad: 20 }
};
var DEFAULTS = { min: 0, max: 100, step: 1, showValue: true, size: "md", haptics: true, disabled: false };
var REACH = 46;
var THIN = 0.16;
var BOUNCE = { stiffness: 240, damping: 9, mass: 0.7 };
var SETTLE = { stiffness: 260, damping: 22 };
var PRESS = 0.08;
var TAP = 6;
var rubber = (x) => Math.sign(x) * REACH * (1 - 1 / (Math.abs(x) / REACH + 1));
var CSS = `
:where([data-dissolve="elastic-slider"]) { position: relative; display: block; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="elastic-slider"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 3px; border-radius: 14px; }
:where(.dissolve-es-track) { position: absolute; inset: 0; overflow: hidden; will-change: transform; }
:where(.dissolve-es-fill) { position: absolute; inset: 0; will-change: transform; }
:where(.dissolve-es-text) {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between;
  font-weight: 600; letter-spacing: -0.012em; white-space: nowrap; pointer-events: none;
}
:where(.dissolve-es-text) > * { will-change: transform; }
:where(.dissolve-es-clip) { position: absolute; top: 0; bottom: 0; overflow: hidden; pointer-events: none; will-change: transform; }
:where(.dissolve-es-clip) > .dissolve-es-text { inset: 0 auto 0 auto; will-change: transform; }
:where(.dissolve-es-left) { display: inline-flex; align-items: center; min-width: 0; }
:where(.dissolve-es-left) > span { overflow: hidden; text-overflow: ellipsis; }
:where(.dissolve-es-icon) { display: block; flex: none; }
:where(.dissolve-es-icon:empty) { display: none; }
:where(.dissolve-es-icon) svg { display: block; width: 100%; height: 100%; }
:where(.dissolve-es-value) { display: inline-flex; overflow: hidden; font-variant-numeric: tabular-nums; }
:where(.dissolve-es-digit) { display: inline-block; overflow: hidden; }
:where(.dissolve-es-digit) > span { display: flex; flex-direction: column; transition: transform .26s cubic-bezier(0.22, 1, 0.36, 1); }
`;
var DIGITS = Array.from({ length: 10 }, (_, i) => `<span>${i}</span>`).join("");
function createElasticSlider(host, initial = {}) {
  injectStyle("dissolve-elastic-slider", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "elastic-slider";
  host.setAttribute("role", "slider");
  host.tabIndex = p().disabled ? -1 : 0;
  Object.assign(host.style, { touchAction: "pan-y", cursor: "pointer" });
  const track = el("div", "dissolve-es-track");
  const fill = el("div", "dissolve-es-fill");
  track.append(fill);
  const mkText = () => {
    const t = el("div", "dissolve-es-text"), left = el("span", "dissolve-es-left"), icon = el("i", "dissolve-es-icon"), label = el("span");
    const val = el("span", "dissolve-es-value");
    icon.setAttribute("aria-hidden", "true");
    left.append(icon, label);
    t.append(left, val);
    return { t, left, icon, label, val };
  };
  const base = mkText();
  const clip = el("div", "dissolve-es-clip");
  const inked = mkText();
  clip.append(inked.t);
  host.append(track, base.t, clip);
  const snap = (v) => {
    const { min, max, step } = p();
    return Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  };
  const span = () => Math.max(1e-9, p().max - p().min);
  let inner = snap(p().defaultValue ?? p().min);
  const shown = () => p().value !== void 0 ? snap(p().value) : inner;
  let last = shown();
  let W = 0;
  const render = () => {
    const o = over.v, q = fillP.v, pr = press.v;
    const side = q > 0.5 ? 1 : -1, e = side * o;
    const k = Math.max(-0.5, Math.min(1, e / REACH));
    track.style.transform = `translateX(${o / 2}px) scale(${1 + e / Math.max(1, W) + 0.012 * pr}, ${(1 - THIN * k) * (1 + PRESS * pr)})`;
    fill.style.transform = `translateX(${-(1 - q) * W}px)`;
    for (const x of [base, inked]) {
      x.left.style.transform = `translateX(${side < 0 ? o : 0}px)`;
      x.val.style.transform = `translateX(${side > 0 ? o : 0}px)`;
    }
    const shift = q * W + o - W - REACH;
    clip.style.left = -REACH + "px";
    clip.style.width = W + REACH * 2 + "px";
    clip.style.transform = `translateX(${shift}px)`;
    inked.t.style.left = REACH + "px";
    inked.t.style.width = W + "px";
    inked.t.style.transform = `translateX(${-shift}px)`;
  };
  const fillP = value(sc, (last - p().min) / span(), render);
  const over = value(sc, 0, render);
  const press = value(sc, 0, render);
  function writeValue() {
    const o = p(), v = shown();
    const text = o.formatValue ? o.formatValue(v) : String(v);
    const s = ELASTIC_SLIDER_SIZES[o.size] ?? ELASTIC_SLIDER_SIZES.md;
    const line = Math.round(s.font * 1.25);
    for (const x of [base, inked]) {
      x.val.hidden = !o.showValue;
      x.val.style.height = line + "px";
      const chars = text.split("");
      const nodes = Array.from(x.val.children);
      const shape = chars.map((c) => /\d/.test(c) ? "d" : c).join("");
      if (x.val.dataset.shape !== shape) {
        x.val.dataset.shape = shape;
        x.val.replaceChildren(...chars.map((c) => {
          if (!/\d/.test(c)) return el("span", "", c);
          const d = el("span", "dissolve-es-digit");
          d.style.height = line + "px";
          d.innerHTML = `<span>${DIGITS}</span>`;
          const col = d.firstElementChild;
          col.style.transition = "none";
          col.style.transform = `translateY(${-Number(c) * line}px)`;
          requestAnimationFrame(() => {
            col.style.transition = "";
          });
          return d;
        }));
      } else {
        chars.forEach((c, i) => {
          const n = nodes[i];
          if (/\d/.test(c)) {
            const col = n.firstElementChild;
            col.style.transform = `translateY(${-Number(c) * line}px)`;
            if (reducedMotion()) col.style.transition = "none";
          } else n.textContent = c;
        });
      }
      for (const span2 of Array.from(x.val.querySelectorAll(".dissolve-es-digit > span > span"))) span2.style.height = span2.style.lineHeight = line + "px";
    }
    host.setAttribute("aria-valuenow", String(v));
    host.setAttribute("aria-valuetext", text);
  }
  function paint() {
    const o = p();
    const bg = token(host, "background", "rgb(255 255 255)"), fg = token(host, "foreground", "rgb(28 28 30)");
    const b = rgbOf(bg), f = rgbOf(fg);
    const dark = (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]) / 255 < 0.5;
    track.style.background = o.trackColor ?? `rgba(${f[0]}, ${f[1]}, ${f[2]}, ${dark ? 0.14 : 0.08})`;
    fill.style.background = o.fillColor ?? fg;
    base.t.style.color = fg;
    inked.t.style.color = bg;
  }
  function layout() {
    const o = p(), s = ELASTIC_SLIDER_SIZES[o.size] ?? ELASTIC_SLIDER_SIZES.md;
    host.style.height = s.height + "px";
    track.style.borderRadius = s.height * 0.42 + "px";
    for (const x of [base, inked]) {
      x.t.style.padding = `0 ${s.pad}px`;
      x.t.style.fontSize = s.font + "px";
      x.label.textContent = o.label ?? "";
      x.left.style.gap = Math.round(s.font * 0.55) + "px";
      x.icon.style.width = x.icon.style.height = Math.round(s.font * 1.2) + "px";
    }
    host.setAttribute("aria-valuemin", String(o.min));
    host.setAttribute("aria-valuemax", String(o.max));
    if (o.label) host.setAttribute("aria-label", o.label);
    else host.removeAttribute("aria-label");
    W = host.clientWidth;
    writeValue();
    render();
  }
  const steps = () => span() / p().step;
  function emit(v) {
    if (v === last) return;
    last = v;
    const o = p();
    if (o.haptics && (v === o.min || v === o.max || steps() <= 20)) vibrate(4);
    if (o.value === void 0) inner = v;
    o.onValueChange?.(v);
    writeValue();
  }
  const settle = () => {
    const to = (last - p().min) / span();
    if (reducedMotion()) fillP.set(to);
    else fillP.spring(to, SETTLE);
  };
  let ptr = null;
  const onDown = (e) => {
    if (e.button > 0 || p().disabled) return;
    W = host.clientWidth;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, q0: fillP.v, drag: false };
    if (reducedMotion()) press.set(1);
    else press.spring(1, SETTLE);
  };
  const onMove = (e) => {
    if (!ptr || ptr.id !== e.pointerId || W <= 0) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (!ptr.drag) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) return end(e, false);
      if (Math.abs(dx) < 4) return;
      ptr.drag = true;
      try {
        host.setPointerCapture(e.pointerId);
      } catch {
      }
      host.style.cursor = "grabbing";
    }
    const raw = ptr.q0 + dx / W, q = Math.min(1, Math.max(0, raw));
    fillP.set(q);
    over.set(reducedMotion() ? 0 : rubber((raw - q) * W));
    emit(snap(p().min + q * span()));
  };
  function end(e, commit = true) {
    if (!ptr || ptr.id !== e.pointerId) return;
    const wasTap = !ptr.drag && Math.abs(e.clientX - ptr.x) < TAP && Math.abs(e.clientY - ptr.y) < TAP;
    if (commit && wasTap && e.type === "pointerup") {
      const r = host.getBoundingClientRect();
      emit(snap(p().min + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * span()));
    }
    ptr = null;
    host.style.cursor = "pointer";
    settle();
    if (reducedMotion()) {
      over.set(0);
      press.set(0);
    } else {
      over.spring(0, BOUNCE);
      press.spring(0, SETTLE);
    }
    if (commit) p().onSlidingComplete?.(last);
  }
  const onEnd = (e) => end(e, e.type === "pointerup");
  const onKey = (e) => {
    if (p().disabled) return;
    const o = p(), big = Math.max(o.step, (o.max - o.min) / 10);
    const d = { ArrowRight: o.step, ArrowUp: o.step, ArrowLeft: -o.step, ArrowDown: -o.step, PageUp: big, PageDown: -big };
    let v = null;
    if (e.key in d) v = snap(last + d[e.key]);
    else if (e.key === "Home") v = o.min;
    else if (e.key === "End") v = o.max;
    if (v === null) return;
    e.preventDefault();
    emit(v);
    settle();
    o.onSlidingComplete?.(v);
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onEnd);
  host.addEventListener("pointercancel", onEnd);
  host.addEventListener("keydown", onKey);
  const ro = new ResizeObserver(() => {
    if (host.clientWidth !== W) {
      W = host.clientWidth;
      render();
    }
  });
  ro.observe(host);
  onThemeChange(sc, paint);
  const disable = () => {
    host.style.opacity = p().disabled ? "0.5" : "";
    host.setAttribute("aria-disabled", String(p().disabled));
    host.tabIndex = p().disabled ? -1 : 0;
  };
  paint();
  disable();
  layout();
  return {
    icon: (on) => (on ? inked : base).icon,
    update(next) {
      const changed = props.update(next);
      if (["size", "label", "min", "max", "step", "showValue", "formatValue"].some((k) => changed.has(k))) layout();
      if (changed.has("value") && p().value !== void 0 && !ptr) {
        const v = shown();
        if (v !== last) {
          last = v;
          writeValue();
          settle();
        }
      }
      if (changed.has("fillColor") || changed.has("trackColor")) paint();
      if (changed.has("disabled")) disable();
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onEnd);
      host.removeEventListener("pointercancel", onEnd);
      host.removeEventListener("keydown", onKey);
      track.remove();
      base.t.remove();
      clip.remove();
      for (const k of ["touch-action", "cursor", "height", "opacity"]) host.style.removeProperty(k);
      for (const a of ["role", "tabindex", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext", "aria-label", "aria-disabled", "data-dissolve"]) host.removeAttribute(a);
    }
  };
}
export {
  ELASTIC_SLIDER_SIZES,
  createElasticSlider
};
