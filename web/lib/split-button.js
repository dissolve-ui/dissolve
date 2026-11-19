// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  QUAD,
  SPLIT,
  el,
  injectStyle,
  plainButton,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/split-button.core.ts
var DEFAULTS = { label: "", cancelLabel: "Cancel", confirmLabel: "Confirm", height: 52, gap: 28, duration: 620, haptics: true };
var REDUCED_MS = 150;
var NS = "http://www.w3.org/2000/svg";
var DANGER = "var(--dissolve-danger, rgb(255 59 48))";
var SURFACE_2 = "var(--dissolve-surface-2, rgb(229 229 234))";
var CSS = `
:where([data-dissolve="split-button"]) { position: relative; user-select: none; -webkit-user-select: none; }
:where(.dissolve-split-svg) { position: absolute; inset: 0; display: block; overflow: visible; pointer-events: none; }
:where(.dissolve-split-closed, .dissolve-split-half) { position: absolute; top: 0; bottom: 0; display: grid; place-items: center; -webkit-tap-highlight-color: transparent; }
:where(.dissolve-split-closed) { left: 0; right: 0; }
:where(.dissolve-split-cancel) { left: 0; }
:where(.dissolve-split-confirm) { right: 0; }
:where(.dissolve-split-label) { display: inline-block; white-space: nowrap; font-size: 16px; font-weight: 600; color: var(--dissolve-danger-foreground, rgb(255 255 255)); }
:where(.dissolve-split-cancel .dissolve-split-label) { color: var(--dissolve-foreground, rgb(28 28 30)); }
`;
var mixColor = (a, b, t) => t <= 0 ? a : t >= 1 ? b : `color-mix(in srgb, ${a} ${((1 - t) * 100).toFixed(2)}%, ${b})`;
function createSplitButton(host, initial = {}) {
  injectStyle("dissolve-split-button", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "split-button";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("dissolve-split-svg");
  const left = document.createElementNS(NS, "rect");
  const right = document.createElementNS(NS, "rect");
  const bridge = document.createElementNS(NS, "path");
  bridge.style.fill = DANGER;
  svg.append(left, right, bridge);
  const button = (cls) => {
    const b = plainButton(cls);
    const s = el("span");
    b.append(s);
    return [b, s];
  };
  const [closed, closedLabel] = button("dissolve-split-closed");
  const [cancel, cancelText] = button("dissolve-split-half dissolve-split-cancel");
  const [confirm, confirmText] = button("dissolve-split-half dissolve-split-confirm");
  host.append(svg, closed, cancel, confirm);
  let W = Math.round(host.clientWidth);
  let open = false;
  const render = () => {
    const { height: H, gap } = p();
    const R = H / 2, cy = R, snapAt = gap * 0.8;
    const g = gap * pr.v;
    const width = Math.max(0, (W - g) / 2), rightX = W - width;
    left.setAttribute("x", "0");
    left.setAttribute("width", width.toFixed(3));
    right.setAttribute("x", rightX.toFixed(3));
    right.setAttribute("width", width.toFixed(3));
    left.style.fill = mixColor(DANGER, SURFACE_2, tone.v);
    right.style.fill = DANGER;
    if (g >= snapAt || !W) bridge.setAttribute("d", "");
    else {
      const t = g / snapAt;
      const n = R * (1 - 0.86 * Math.pow(t, 0.8));
      const c1 = width - R, c2 = rightX + R;
      const phi = (90 - 35 * t) * Math.PI / 180;
      const ax = c1 + R * Math.cos(phi), bx = c2 - R * Math.cos(phi), ay = R * Math.sin(phi);
      const k = Math.max(4, (bx - ax) * 0.42);
      const f = (v) => v.toFixed(3);
      bridge.setAttribute("d", `M${f(ax)} ${f(cy - ay)}C${f(ax + k)} ${f(cy - n)} ${f(bx - k)} ${f(cy - n)} ${f(bx)} ${f(cy - ay)}L${f(bx)} ${f(cy + ay)}C${f(bx - k)} ${f(cy + n)} ${f(ax + k)} ${f(cy + n)} ${f(ax)} ${f(cy + ay)}Z`);
    }
    const ct = Math.min(1, pr.v * 3);
    closedLabel.style.opacity = (1 - ct).toFixed(3);
    closedLabel.style.transform = `scale(${(1 - 0.12 * ct).toFixed(3)})`;
    for (const s of [cancelText, confirmText]) {
      s.style.opacity = tone.v.toFixed(3);
      s.style.transform = `scale(${(0.88 + 0.12 * tone.v).toFixed(3)})`;
    }
    cancel.style.width = confirm.style.width = width.toFixed(2) + "px";
  };
  const pr = value(sc, 0, render);
  const tone = value(sc, 0, render);
  function apply() {
    const { label, cancelLabel, confirmLabel, height: H, labelClassName, cancelLabelClassName } = p();
    host.style.height = H + "px";
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    for (const r of [left, right]) {
      r.setAttribute("y", "0");
      r.setAttribute("height", String(H));
      r.setAttribute("rx", String(H / 2));
      r.setAttribute("ry", String(H / 2));
    }
    for (const b of [closed, cancel, confirm]) b.style.borderRadius = H / 2 + "px";
    const cls = "dissolve-split-label" + (labelClassName ? " " + labelClassName : "");
    closedLabel.className = confirmText.className = cls;
    cancelText.className = cls + (cancelLabelClassName ? " " + cancelLabelClassName : "");
    closedLabel.textContent = label;
    cancelText.textContent = cancelLabel;
    confirmText.textContent = confirmLabel;
    render();
  }
  const setOpen = (next) => {
    open = next;
    host.toggleAttribute("data-open", open);
    closed.tabIndex = open ? -1 : 0;
    cancel.tabIndex = confirm.tabIndex = open ? 0 : -1;
    closed.style.pointerEvents = open ? "none" : "";
    cancel.style.pointerEvents = confirm.style.pointerEvents = open ? "" : "none";
    const reduced = reducedMotion(), d = reduced ? REDUCED_MS : p().duration;
    const run = pr.to(open ? 1 : 0, d, SPLIT);
    if (open) tone.to(1, reduced ? REDUCED_MS : 220, QUAD, d * 0.78);
    else tone.to(0, 180, QUAD);
    return run;
  };
  const tick = () => {
    if (p().haptics) vibrate(4);
  };
  const onClosed = () => {
    tick();
    setOpen(true);
  };
  const onCancel = () => {
    tick();
    setOpen(false);
  };
  const onConfirm = () => {
    if (p().haptics) vibrate([12, 60, 12]);
    p().onConfirm?.();
    setOpen(false);
  };
  closed.addEventListener("click", onClosed);
  cancel.addEventListener("click", onCancel);
  confirm.addEventListener("click", onConfirm);
  const ro = new ResizeObserver(() => {
    const next = Math.round(host.clientWidth);
    if (next === W) return;
    W = next;
    apply();
  });
  ro.observe(host);
  apply();
  setOpen(false);
  return {
    update(next) {
      if (props.update(next).size) apply();
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      svg.remove();
      closed.remove();
      cancel.remove();
      confirm.remove();
      host.style.removeProperty("height");
      host.removeAttribute("data-open");
      delete host.dataset.dissolve;
    }
  };
}
export {
  createSplitButton
};
