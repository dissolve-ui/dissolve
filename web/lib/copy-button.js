// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  bezier,
  clamp,
  hash,
  injectStyle,
  loop,
  propsOf,
  reducedMotion,
  scope,
  token,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/copy-button.core.ts
var COPY_BUTTON_SIZES = {
  sm: { box: 32, icon: 16, radius: 9 },
  md: { box: 36, icon: 18, radius: 10 },
  lg: { box: 44, icon: 20, radius: 12 }
};
var DEFAULTS = { text: "", timeout: 1500, copiedLabel: "Copied", size: "md", effects: "accent", haptics: true, disabled: false, accessibilityLabel: "Copy" };
var GRAINS = 14;
var STAGGER = 80;
var RUN = 240;
var COPY_OUT = 80;
var CHECK_AT = 290;
var CHECK_IN = 90;
var FADE_AT = 320;
var FADE = 80;
var END = FADE_AT + FADE;
var POP = 0.14;
var POP_AT = 240;
var POP_LEN = 240;
var SWAP = 140;
var BACK = 160;
var TIP_IN = 160;
var TIP_OUT = 140;
var ARC = 3;
var PAD = 8;
var FLOW = bezier(0.42, 0, 0.12, 1);
function along(pts, n) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(l);
    total += l;
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    let d = total * k / (n - 1);
    let i = 0;
    while (i < segs.length - 1 && d > segs[i]) d -= segs[i++];
    const u = segs[i] ? Math.min(1, d / segs[i]) : 0;
    out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]);
  }
  return out;
}
var FROM = [
  ...along([[8, 8], [22, 8], [22, 22], [8, 22], [8, 8]], 10),
  ...along([[2, 15], [2, 2], [15, 2]], 4)
].sort((a, b) => a[0] - b[0]);
var TO = along([[4, 12], [9, 17], [20, 6]], GRAINS);
var GRID = FROM.map((f, i) => [f[0], f[1], TO[i][0], TO[i][1], hash(i, 4), hash(i, 5) - 0.5]);
var COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="14" height="14" rx="2.5"/><path d="M2 15V4.5A2.5 2.5 0 0 1 4.5 2H15"/></svg>';
var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>';
var CSS = `
:where([data-dissolve="copy-button"]) { -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="copy-button"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 2px; }
:where(.dissolve-copy-bg) { position: absolute; inset: 0; border-radius: inherit; background: var(--dissolve-surface, rgb(242 242 247)); opacity: 0; transition: opacity 160ms; pointer-events: none; }
:where([data-dissolve="copy-button"]:hover:not(:disabled) .dissolve-copy-bg) { opacity: 0.7; }
:where([data-dissolve="copy-button"]:active:not(:disabled) .dissolve-copy-bg) { opacity: 1; transition-duration: 90ms; }
:where(.dissolve-copy-icon) { position: relative; display: block; pointer-events: none; }
:where(.dissolve-copy-icon svg) { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
:where(.dissolve-copy-copy) { color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-copy-check) { color: var(--dissolve-foreground, rgb(28 28 30)); }
:where(.dissolve-copy-grains) { position: absolute; pointer-events: none; }
:where(.dissolve-copy-tip) { position: absolute; left: 50%; bottom: calc(100% + 6px); padding: 5px 9px; border-radius: 8px; white-space: nowrap; font: 600 12px/16px system-ui, -apple-system, sans-serif; background: var(--dissolve-foreground, rgb(28 28 30)); color: var(--dissolve-background, rgb(255 255 255)); pointer-events: none; opacity: 0; transform: translate(-50%, 4px) scale(0.96); transition: opacity ${TIP_OUT}ms, transform ${TIP_OUT}ms; }
:where(.dissolve-copy-tip[data-shown]) { opacity: 1; transform: translate(-50%, 0) scale(1); transition: opacity ${TIP_IN}ms cubic-bezier(0.32, 0.72, 0, 1), transform ${TIP_IN}ms cubic-bezier(0.32, 0.72, 0, 1); }
:where(.dissolve-copy-live) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
async function writeClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0" });
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
}
function createCopyButton(host, initial = {}) {
  injectStyle("dissolve-copy-button", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "copy-button";
  if (!(host instanceof HTMLButtonElement)) {
    host.setAttribute("role", "button");
    if (!host.hasAttribute("tabindex")) host.tabIndex = 0;
  }
  Object.assign(host.style, { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", border: "0", padding: "0", margin: "0", background: "none", cursor: "pointer", boxSizing: "border-box", verticalAlign: "middle" });
  const bgLayer = document.createElement("span");
  bgLayer.className = "dissolve-copy-bg";
  const icon = document.createElement("span");
  icon.className = "dissolve-copy-icon";
  const copyIcon = document.createElement("span");
  copyIcon.className = "dissolve-copy-copy";
  copyIcon.innerHTML = COPY_SVG;
  const checkIcon = document.createElement("span");
  checkIcon.className = "dissolve-copy-check";
  checkIcon.innerHTML = CHECK_SVG;
  for (const n of [copyIcon, checkIcon]) Object.assign(n.style, { position: "absolute", inset: "0" });
  const cv = document.createElement("canvas");
  cv.className = "dissolve-copy-grains";
  const ctx = cv.getContext("2d");
  icon.append(copyIcon, checkIcon, cv);
  const tip = document.createElement("span");
  tip.className = "dissolve-copy-tip";
  tip.setAttribute("aria-hidden", "true");
  const live = document.createElement("span");
  live.className = "dissolve-copy-live";
  live.setAttribute("role", "status");
  host.append(bgLayer, icon, tip);
  document.body.append(live);
  let S = 0, k = 1, dpr = 1;
  let startAt = -1, t = END, back = 1, backFrom = 1, backAt = -1, plain = false;
  let muted = "", fg = "";
  let timer;
  function layout() {
    const s = COPY_BUTTON_SIZES[p().size] ?? COPY_BUTTON_SIZES.md;
    S = s.icon;
    k = S / 24;
    Object.assign(host.style, { width: s.box + "px", height: s.box + "px", borderRadius: s.radius + "px" });
    Object.assign(icon.style, { width: S + "px", height: S + "px" });
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round((S + PAD * 2) * dpr);
    cv.height = Math.round((S + PAD * 2) * dpr);
    cv.style.cssText = `left:${-PAD}px;top:${-PAD}px;width:${S + PAD * 2}px;height:${S + PAD * 2}px`;
  }
  const animating = () => startAt >= 0 || backAt >= 0;
  function frame(now) {
    if (startAt >= 0) {
      t = Math.min(now - startAt, plain ? SWAP : END);
      if (t >= (plain ? SWAP : END)) startAt = -1;
    }
    if (backAt >= 0) {
      back = backFrom + (1 - backFrom) * clamp((now - backAt) / BACK);
      if (back >= 1) backAt = -1;
    }
    const reduced = reducedMotion();
    const copyA = back > 0 ? back : 1 - clamp(t / (plain ? SWAP : COPY_OUT));
    const checkA = (plain ? clamp(t / SWAP) : clamp((t - CHECK_AT) / CHECK_IN)) * (1 - back);
    copyIcon.style.opacity = String(copyA);
    checkIcon.style.opacity = String(checkA);
    const at = plain ? clamp(t / (SWAP * 1.7)) : clamp((t - POP_AT) / POP_LEN);
    const pop = reduced || back > 0 ? 0 : Math.sin(Math.PI * at) * (plain ? POP * 0.7 : POP);
    icon.style.transform = pop ? `scale(${1 + pop})` : "";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S + PAD * 2, S + PAD * 2);
    if (plain || back > 0) return;
    const dot = 2 * k * 1.25;
    for (const g of GRID) {
      const delay = g[0] / 24 * STAGGER * 0.6 + g[4] * STAGGER * 0.4;
      const e = FLOW(clamp((t - delay) / RUN));
      const bump = Math.sin(Math.PI * e);
      const x = (g[0] + (g[2] - g[0]) * e + g[5] * ARC * 2 * bump) * k;
      const y = (g[1] + (g[3] - g[1]) * e - ARC * bump) * k;
      const a = clamp(t / 40) * (1 - clamp((t - FADE_AT) / FADE));
      if (a <= 3e-3) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = e < 0.5 ? muted : fg;
      ctx.beginPath();
      ctx.arc(x + PAD, y + PAD, dot * (1 - 0.35 * bump) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const { kick } = loop(sc, host, frame, animating);
  async function copy() {
    if (p().disabled) return;
    const raw = p().text;
    const value = typeof raw === "function" ? raw() : raw;
    try {
      await writeClipboard(value);
    } catch {
      return;
    }
    if (!sc.alive) return;
    if (p().haptics) vibrate(8);
    p().onCopy?.(value);
    showCopied();
  }
  function showCopied() {
    live.textContent = "";
    live.textContent = p().copiedLabel;
    if (back !== 0 || backAt >= 0) {
      plain = p().effects === "none" || reducedMotion();
      muted = token(host, "muted", "rgb(142 142 147)");
      fg = token(host, "foreground", "rgb(28 28 30)");
      back = 0;
      backAt = -1;
      t = 0;
      startAt = performance.now();
      tip.textContent = p().copiedLabel;
      tip.setAttribute("data-shown", "");
      kick();
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      backFrom = back;
      backAt = performance.now();
      tip.removeAttribute("data-shown");
      kick();
    }, p().timeout);
  }
  const onClick = () => {
    void copy();
  };
  const onKey = (e) => {
    if (host instanceof HTMLButtonElement || e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    void copy();
  };
  host.addEventListener("click", onClick);
  host.addEventListener("keydown", onKey);
  const disable = () => {
    host.style.opacity = p().disabled ? "0.4" : "";
    host.style.cursor = p().disabled ? "default" : "pointer";
    if (host instanceof HTMLButtonElement) host.disabled = p().disabled;
    else host.setAttribute("aria-disabled", String(p().disabled));
  };
  const label = () => host.setAttribute("aria-label", p().accessibilityLabel);
  layout();
  disable();
  label();
  frame(performance.now());
  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("size")) {
        layout();
        kick();
      }
      if (changed.has("disabled")) disable();
      if (changed.has("accessibilityLabel")) label();
    },
    copy,
    showCopied,
    destroy() {
      sc.dispose();
      clearTimeout(timer);
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
      bgLayer.remove();
      icon.remove();
      tip.remove();
      live.remove();
      for (const k2 of ["position", "display", "align-items", "justify-content", "flex", "border", "padding", "margin", "background", "cursor", "box-sizing", "vertical-align", "width", "height", "border-radius", "opacity"]) host.style.removeProperty(k2);
      for (const a of ["role", "aria-label", "aria-disabled", "data-dissolve"]) host.removeAttribute(a);
      if (host instanceof HTMLButtonElement) host.disabled = false;
      else host.removeAttribute("tabindex");
    }
  };
}
export {
  COPY_BUTTON_SIZES,
  createCopyButton
};
