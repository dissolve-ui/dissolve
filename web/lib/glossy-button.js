// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  clamp,
  el,
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/glossy-button.core.ts
var GLOSSY_SIZES = {
  sm: { height: 36, padding: 14, font: 14, icon: 14, gap: 6 },
  md: { height: 44, padding: 18, font: 15, icon: 16, gap: 7 },
  lg: { height: 52, padding: 22, font: 17, icon: 18, gap: 8 }
};
var DEFAULTS = {
  color: "#296FF0",
  labelColor: "#FFFFFF",
  radius: 999,
  size: "md",
  fullWidth: false,
  strokeOpacity: 0.4,
  innerOpacity: 0.24,
  innerBlur: 6,
  innerSpread: 2,
  shadowOpacity: 0.2,
  shadowY: 3,
  shadowBlur: 6,
  ringSpread: 1,
  disabled: false,
  haptics: true
};
var SPRING = { stiffness: 260, damping: 22, eps: 2e-3 };
var PRESSED_SCALE = 0.97;
var PRESSED_LIGHT = 0.55;
var PILL = {
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  boxSizing: "border-box",
  height: "var(--glossy-h)",
  padding: "0 var(--glossy-pad)",
  gap: "var(--glossy-gap)",
  border: "0",
  borderRadius: "var(--glossy-r)",
  background: "var(--glossy-bg, var(--glossy-fill))",
  color: "var(--glossy-label)",
  fontFamily: "inherit",
  fontSize: "var(--glossy-font)",
  fontWeight: "600",
  lineHeight: "1",
  letterSpacing: "-0.013em",
  whiteSpace: "nowrap",
  boxShadow: "0 var(--glossy-sh-y) var(--glossy-sh-b) rgba(0, 0, 0, var(--glossy-sh-o)), 0 0 0 var(--glossy-ring) var(--glossy-fill), var(--glossy-glow, 0 0 #0000)",
  transform: "scale(var(--glossy-scale, 1))",
  willChange: "transform",
  touchAction: "manipulation"
};
var CSS = `
:where([data-dissolve="glossy-button"]) { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="glossy-button"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 4px; }
:where([data-dissolve="glossy-button"])::before, :where([data-dissolve="glossy-button"])::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
:where([data-dissolve="glossy-button"])::before {
  padding: 1px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, var(--glossy-stroke)), rgba(255, 255, 255, 0));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
:where([data-dissolve="glossy-button"])::after { box-shadow: inset 0 0 var(--glossy-in-b) var(--glossy-in-s) rgba(255, 255, 255, var(--glossy-in-o)); opacity: var(--glossy-light, 1); }
/* A light fill (a white button on a dark page): white light would vanish into it and a black shadow into the
   page, so the gloss turns around: a soft grey gradient, a dark rim lit from below, a bright top edge and a
   faint white halo that reads on dark backgrounds. */
:where([data-dissolve="glossy-button"][data-light])::before { background: linear-gradient(to top, rgba(0, 0, 0, calc(var(--glossy-stroke) * 0.45)), rgba(0, 0, 0, 0) 70%); }
:where([data-dissolve="glossy-button"][data-light])::after { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(0, 0, 0, calc(var(--glossy-in-o) * 0.5)); }
:where(.dissolve-glossy-icon, .dissolve-glossy-label) { position: relative; }
:where(.dissolve-glossy-icon) { display: inline-flex; }
:where(.dissolve-glossy-icon:empty, .dissolve-glossy-label:empty) { display: none; }
:where(.dissolve-glossy-icon) svg { flex: none; }
`;
function luminance(c) {
  let r = 0, g = 0, b = 0;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = c.match(/[\d.]+/g);
    if (!m || !/^rgb/i.test(c.trim())) return 0;
    [r, g, b] = m.slice(0, 3).map(Number);
  }
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function createGlossyButton(host, initial = {}) {
  injectStyle("dissolve-glossy-button", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const isButton = host instanceof HTMLButtonElement;
  host.dataset.dissolve = "glossy-button";
  Object.assign(host.style, PILL);
  let full = false;
  if (isButton) host.type = "button";
  else host.setAttribute("role", "button");
  const icon = el("span", "dissolve-glossy-icon");
  icon.setAttribute("aria-hidden", "true");
  const slot = el("span");
  const text = document.createTextNode("");
  slot.append(text);
  host.append(icon, slot);
  const pressed = value(sc, 0, () => {
    const k = clamp(pressed.v, -0.2, 1.2);
    host.style.setProperty("--glossy-scale", (1 - (1 - PRESSED_SCALE) * (reducedMotion() ? 0 : k)).toFixed(4));
    host.style.setProperty("--glossy-light", (1 - (1 - PRESSED_LIGHT) * clamp(k)).toFixed(3));
  });
  const press = (to) => reducedMotion() ? pressed.set(to) : pressed.spring(to, SPRING);
  function apply() {
    const o = p();
    const s = GLOSSY_SIZES[o.size] ?? GLOSSY_SIZES.md;
    const vars = {
      fill: o.color,
      label: o.labelColor,
      r: Math.min(o.radius, s.height / 2) + "px",
      stroke: o.strokeOpacity,
      "in-o": o.innerOpacity,
      "in-b": o.innerBlur + "px",
      "in-s": o.innerSpread + "px",
      "sh-o": o.shadowOpacity,
      "sh-y": o.shadowY + "px",
      "sh-b": o.shadowBlur + "px",
      ring: o.ringSpread + "px",
      h: s.height + "px",
      pad: s.padding + "px",
      gap: s.gap + "px",
      font: s.font + "px"
    };
    for (const [k, v] of Object.entries(vars)) host.style.setProperty(`--glossy-${k}`, String(v));
    const light = luminance(o.color) > 0.72;
    host.toggleAttribute("data-light", light);
    host.style.setProperty("--glossy-bg", light ? `linear-gradient(to bottom, ${o.color}, color-mix(in srgb, ${o.color} 86%, #8a8a94))` : "");
    host.style.setProperty("--glossy-glow", light ? "0 0 18px rgba(255, 255, 255, 0.18), 0 0 1px rgba(255, 255, 255, 0.6)" : "");
    host.style.display = o.fullWidth ? "flex" : "inline-flex";
    if (o.fullWidth !== full) host.style.width = o.fullWidth ? "100%" : "";
    full = o.fullWidth;
    host.toggleAttribute("data-full", o.fullWidth);
    host.style.opacity = o.disabled ? "0.5" : "";
    host.style.cursor = o.disabled ? "default" : "pointer";
    if (isButton) host.disabled = o.disabled;
    else host.setAttribute("aria-disabled", String(o.disabled));
    slot.className = "dissolve-glossy-label" + (o.labelClassName ? " " + o.labelClassName : "");
    text.data = o.label ?? "";
    if (o.disabled) press(0);
  }
  const onDown = (e) => {
    if (e.button !== 0 || p().disabled) return;
    if (p().haptics) vibrate(6);
    press(1);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
  };
  const offWindow = () => {
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
  };
  const onUp = () => {
    press(0);
    offWindow();
  };
  const onKeyDown = (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && !p().disabled) press(1);
  };
  const onKeyUp = (e) => {
    if (e.key === " " || e.key === "Enter") press(0);
  };
  const onBlur = () => press(0);
  const onClick = () => {
    if (!p().disabled) p().onPress?.();
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("keydown", onKeyDown);
  host.addEventListener("keyup", onKeyUp);
  host.addEventListener("blur", onBlur);
  host.addEventListener("click", onClick);
  apply();
  return {
    slot,
    icon,
    update(next) {
      if (props.update(next).size) apply();
    },
    destroy() {
      sc.dispose();
      offWindow();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("keyup", onKeyUp);
      host.removeEventListener("blur", onBlur);
      host.removeEventListener("click", onClick);
      icon.remove();
      slot.remove();
      for (const name of [...host.style]) if (name.startsWith("--glossy-")) host.style.removeProperty(name);
      for (const key of [...Object.keys(PILL), "display", "opacity", "cursor", ...full ? ["width"] : []]) host.style.removeProperty(key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
      host.removeAttribute("data-full");
      if (!isButton) host.removeAttribute("role");
      delete host.dataset.dissolve;
    }
  };
}
export {
  GLOSSY_SIZES,
  createGlossyButton
};
