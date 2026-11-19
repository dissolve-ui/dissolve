// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  play,
  snapshot
} from "./chunks/chunk-6TDGCXIW.js";
import {
  CALM,
  clamp,
  el,
  injectStyle,
  propsOf,
  reducedMotion,
  rr,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/task-check.core.ts
var DEFAULTS = { after: "stay", settleDelay: 900, boxSize: 24, disabled: false, haptics: true };
var CHECK = "M6.2 11.4l3.2 3.2 6.6-7";
var CLOSE = 380;
var CSS = `
:where(.dissolve-task-row) {
  display: flex; align-items: center; gap: 12px; padding: 12px 0; text-align: left; cursor: pointer;
  color: var(--dissolve-foreground, rgb(28 28 30)); -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none;
}
:where(.dissolve-task-row[aria-disabled="true"]) { cursor: default; }
:where(.dissolve-task-row:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 2px; }
:where(.dissolve-task-box) { position: relative; flex: none; box-shadow: inset 0 0 0 1.5px var(--dissolve-border, rgb(60 60 67 / 0.12)); }
:where(.dissolve-task-fill) { position: absolute; inset: 0; border-radius: inherit; background: var(--dissolve-primary, rgb(28 28 30)); opacity: 0; }
:where(.dissolve-task-box) svg { position: absolute; inset: 0; display: block; }
:where(.dissolve-task-label) { position: relative; min-width: 0; font-size: 16px; letter-spacing: -0.2px; }
:where(.dissolve-task-strikes) { position: absolute; inset: 0; pointer-events: none; }
:where(.dissolve-task-strike) {
  position: absolute; height: 1.5px; margin-top: -0.75px; background: var(--dissolve-muted, rgb(142 142 147));
  transform: scaleX(0); transform-origin: 0 50%;
}
`;
function createTaskCheck(host, initial) {
  injectStyle("dissolve-task-check", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "task-check";
  const row = el("div");
  row.setAttribute("role", "checkbox");
  const box = el("span", "dissolve-task-box");
  const fill = el("i", "dissolve-task-fill");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 22 22");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  for (const [k, v] of Object.entries({
    d: CHECK,
    fill: "none",
    stroke: "var(--dissolve-primary-foreground, rgb(255 255 255))",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    pathLength: "1",
    "stroke-dasharray": "1",
    "stroke-dashoffset": "1"
  })) path.setAttribute(k, v);
  svg.append(path);
  box.append(fill, svg);
  const text = el("span");
  const words = document.createTextNode("");
  const strikes = el("span", "dissolve-task-strikes");
  text.append(words, strikes);
  row.append(box, text);
  host.append(row);
  let checked = false, timer, busy = false;
  let lines = [];
  function measure() {
    strikes.textContent = "";
    const range = document.createRange();
    range.selectNodeContents(words);
    const base = text.getBoundingClientRect();
    lines = [...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => {
      const s = el("i", "dissolve-task-strike");
      const x = r.left - base.left, y = r.top - base.top + r.height / 2;
      s.style.cssText = `left:${x}px;top:${y}px;width:${r.width}px`;
      strikes.append(s);
      return { s, x, y, w: r.width };
    });
  }
  const prog = value(sc, 0, () => {
    const ms = prog.v * 320;
    const c = CALM(clamp(ms / 220)), s = CALM(clamp((ms - 60) / 260));
    path.setAttribute("stroke-dashoffset", (1 - c).toFixed(3));
    fill.style.opacity = CALM(clamp(ms / 180)).toFixed(3);
    lines.forEach((l) => {
      l.s.style.transform = `scaleX(${s.toFixed(4)})`;
    });
    text.style.color = `color-mix(in srgb, var(--dissolve-muted, rgb(142 142 147)) ${(s * 100).toFixed(1)}%, var(--dissolve-foreground, rgb(28 28 30)))`;
  });
  const pop = value(sc, 1, () => {
    box.style.transform = `scale(${pop.v.toFixed(4)})`;
  });
  function decorate() {
    const { label, boxSize, disabled, rowClassName, labelClassName } = p();
    row.className = "dissolve-task-row" + (rowClassName ? " " + rowClassName : "");
    text.className = "dissolve-task-label" + (labelClassName ? " " + labelClassName : "");
    if (words.data !== label) {
      words.data = label;
      if (checked) measure();
    }
    row.setAttribute("aria-label", label);
    row.setAttribute("aria-disabled", String(disabled));
    row.tabIndex = disabled ? -1 : 0;
    Object.assign(box.style, { width: boxSize + "px", height: boxSize + "px", borderRadius: Math.round(boxSize * 0.3) + "px" });
    svg.setAttribute("width", String(boxSize));
    svg.setAttribute("height", String(boxSize));
  }
  function set(on, animate) {
    clearTimeout(timer);
    checked = on;
    row.setAttribute("aria-checked", String(on));
    if (on) {
      measure();
      if (!animate) prog.set(1);
      else if (reducedMotion()) prog.to(1, 150, (t) => t);
      else {
        pop.to(0.85, 90, CALM).then((ok) => ok && pop.spring(1, { stiffness: 340, damping: 13, mass: 0.8 }));
        prog.to(1, 320, (t) => t);
      }
      if (animate && p().after !== "stay") timer = setTimeout(() => sc.alive && settle(), p().settleDelay);
    } else if (!animate) prog.set(0);
    else {
      pop.to(1, 160, CALM);
      prog.to(0, reducedMotion() ? 150 : 160, (t) => t);
    }
  }
  async function settle() {
    if (!checked || !host.isConnected) return;
    if (p().after === "move") return p().onSettled?.();
    if (p().after !== "dissolve" || busy) return;
    busy = true;
    if (!reducedMotion()) {
      const r = row.getBoundingClientRect(), b = box.getBoundingClientRect(), tr = text.getBoundingClientRect();
      const cs = getComputedStyle(text);
      const muted = token(host, "muted", "rgb(142 142 147)");
      const src = snapshot(r.width, r.height, (x) => {
        x.fillStyle = token(host, "primary", "rgb(28 28 30)");
        rr(x, b.left - r.left, b.top - r.top, b.width, b.height, parseFloat(box.style.borderRadius));
        x.fill();
        x.strokeStyle = token(host, "primary-foreground", "rgb(255 255 255)");
        x.lineWidth = 2;
        x.lineCap = x.lineJoin = "round";
        x.save();
        x.translate(b.left - r.left, b.top - r.top);
        x.scale(b.width / 22, b.height / 22);
        x.stroke(new Path2D(CHECK));
        x.restore();
        x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        x.fillStyle = muted;
        x.textBaseline = "middle";
        if (lines[0]) x.fillText(p().label, tr.left - r.left + lines[0].x, tr.top - r.top + lines[0].y);
        lines.forEach((l) => x.fillRect(tr.left - r.left + l.x, tr.top - r.top + l.y - 0.75, l.w, 1.5));
      });
      row.style.visibility = "hidden";
      await sc.track(play({ source: src, x: r.left, y: r.top, w: r.width, h: r.height, preset: "dust", origin: "left", duration: 1100, grain: 2 })).done;
      if (!sc.alive) return;
    } else row.style.visibility = "hidden";
    host.style.overflow = "hidden";
    host.style.height = host.offsetHeight + "px";
    await host.animate([{ height: host.style.height }, { height: "0px" }], { duration: reducedMotion() ? 150 : CLOSE, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }).finished.catch(() => {
    });
    if (!sc.alive) return;
    host.style.height = "0px";
    p().onSettled?.();
  }
  const press = () => {
    if (busy || p().disabled) return;
    if (p().haptics) vibrate(checked ? 3 : 6);
    p().onCheckedChange(!checked);
  };
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      press();
    }
  };
  row.addEventListener("click", press);
  row.addEventListener("keydown", onKey);
  sc.onDispose(() => clearTimeout(timer));
  decorate();
  set(p().checked, false);
  return {
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      decorate();
      if (changed.has("checked") && p().checked !== checked) set(p().checked, true);
    },
    destroy() {
      sc.dispose();
      row.remove();
      delete host.dataset.dissolve;
      for (const k of ["overflow", "height"]) host.style.removeProperty(k);
    }
  };
}
export {
  createTaskCheck
};
