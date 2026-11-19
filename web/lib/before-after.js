// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  CALM,
  clamp,
  el,
  injectStyle,
  propsOf,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/before-after.core.ts
var DEFAULTS = { initial: 0.5, height: 320, beforeLabel: "Before", afterLabel: "After", labels: true, haptics: true };
var KNOB = 40;
var ARROWS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 7.5L5 12l4.5 4.5M14.5 7.5L19 12l-4.5 4.5"/></svg>';
var CSS = `
:where([data-dissolve="before-after"]) {
  border-radius: 20px; background: var(--dissolve-surface-2, rgb(229 229 234));
  cursor: ew-resize; touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
}
:where([data-dissolve="before-after"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 3px; }
:where(.dissolve-before-after-after) { position: absolute; inset: 0; pointer-events: none; }
:where(.dissolve-before-after-clip) { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; overflow: hidden; pointer-events: none; will-change: transform; }
:where(.dissolve-before-after-before) { position: absolute; left: 0; top: 0; bottom: 0; will-change: transform; }
:where(.dissolve-before-after-pill) { position: absolute; top: 14px; padding: 5px 10px; border-radius: 999px; background: rgba(0, 0, 0, 0.38); pointer-events: none; }
:where(.dissolve-before-after-pill > span) { display: block; color: #fff; font-size: 12px; font-weight: 600; letter-spacing: 0.008em; line-height: 1.2; }
:where(.dissolve-before-after-divider) {
  position: absolute; left: 0; top: 0; bottom: 0; width: 2px; pointer-events: none; will-change: transform;
  background: var(--dissolve-background, rgb(255 255 255)); box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
}
:where(.dissolve-before-after-handle) {
  position: absolute; left: 0; width: ${KNOB}px; height: ${KNOB}px; border-radius: 50%; display: grid; place-items: center;
  pointer-events: none; will-change: transform; background: var(--dissolve-background, rgb(255 255 255));
  color: var(--dissolve-foreground, rgb(28 28 30)); box-shadow: 0 3px 20px rgba(0, 0, 0, 0.22);
}
:where(.dissolve-before-after-handle) svg { display: block; }
`;
function createBeforeAfter(host, initial = {}) {
  injectStyle("dissolve-before-after", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "before-after";
  Object.assign(host.style, { position: "relative", overflow: "hidden", isolation: "isolate" });
  host.tabIndex = 0;
  host.setAttribute("role", "slider");
  host.setAttribute("aria-valuemin", "0");
  host.setAttribute("aria-valuemax", "100");
  const after = el("div", "dissolve-before-after-after");
  const win = el("div", "dissolve-before-after-clip");
  const before = el("div", "dissolve-before-after-before");
  win.append(before);
  const pill = (side) => {
    const box = el("span"), text = el("span");
    box.style[side] = "14px";
    box.append(text);
    return { box, text };
  };
  const pillB = pill("left"), pillA = pill("right");
  const line = el("i");
  const knob = el("span", "", ARROWS);
  host.append(after, win, pillB.box, pillA.box, line, knob);
  let w = 0, armed = false, last = -1;
  const render = () => {
    const x = pos.v * w;
    win.style.transform = `translate3d(${(x - w).toFixed(2)}px,0,0)`;
    before.style.transform = `translate3d(${(w - x).toFixed(2)}px,0,0)`;
    line.style.transform = `translate3d(${(x - 1).toFixed(2)}px,0,0)`;
    knob.style.transform = `translate3d(${(x - KNOB / 2).toFixed(2)}px,0,0) scale(${(1 + grab.v * 0.08).toFixed(4)})`;
    if (p().labels) {
      const bw = pillB.box.offsetWidth || 64, aw = pillA.box.offsetWidth || 56;
      pillB.box.style.opacity = clamp((x - (14 + bw)) / 44).toFixed(3);
      pillA.box.style.opacity = (1 - clamp((x - (w - 14 - aw - 44)) / 44)).toFixed(3);
    }
    host.setAttribute("aria-valuenow", String(Math.round(pos.v * 100)));
    if (armed && last >= 0 && p().haptics) {
      const v = pos.v, edge = (u) => u <= 1e-3 || u >= 0.999;
      if ((last - 0.5) * (v - 0.5) < 0 || v === 0.5 && last !== 0.5) vibrate(4);
      if (edge(v) && !edge(last)) vibrate(8);
    }
    last = pos.v;
  };
  const pos = value(sc, clamp(p().initial), render);
  const grab = value(sc, 0, render);
  const settle = (v) => p().onChange?.(v);
  const glide = (to, ms) => pos.to(clamp(to), ms, CALM).then((done) => done && settle(pos.v));
  function chrome() {
    const o = p();
    pillB.box.className = pillA.box.className = "dissolve-before-after-pill" + (o.pillClassName ? " " + o.pillClassName : "");
    pillB.text.className = pillA.text.className = o.pillTextClassName ?? "";
    pillB.text.textContent = o.beforeLabel;
    pillA.text.textContent = o.afterLabel;
    pillB.box.hidden = pillA.box.hidden = !o.labels;
    line.className = "dissolve-before-after-divider" + (o.dividerClassName ? " " + o.dividerClassName : "");
    knob.className = "dissolve-before-after-handle" + (o.handleClassName ? " " + o.handleClassName : "");
    host.setAttribute("aria-label", `${o.beforeLabel} and ${o.afterLabel} comparison`);
  }
  function resize() {
    const h = p().height;
    host.style.height = h + "px";
    knob.style.top = h / 2 - KNOB / 2 + "px";
    w = host.clientWidth;
    before.style.width = w + "px";
    render();
    if (w) p().onResize?.({ width: w, height: h });
  }
  let g = null;
  const onDown = (e) => {
    if (e.button > 0) return;
    const r = host.getBoundingClientRect();
    g = { x0: e.clientX, y0: e.clientY, t0: performance.now(), left: r.left, scale: r.width || 1, start: pos.v, base: e.clientX, on: false, failed: false };
    grab.to(1, 180, CALM);
  };
  const onMove = (e) => {
    if (!g || g.failed) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dy) > 14 && Math.abs(dx) <= 4) {
        g.failed = true;
        grab.to(0, 320, CALM);
        return;
      }
      if (Math.abs(dx) <= 4) return;
      g.on = true;
      g.start = pos.v;
      g.base = e.clientX;
      try {
        host.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    pos.set(clamp(g.start + (e.clientX - g.base) / g.scale));
  };
  const onEnd = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    grab.to(0, 320, CALM);
    if (st.on) settle(pos.v);
    else if (e.type === "pointerup" && !st.failed && performance.now() - st.t0 <= 400) glide((e.clientX - st.left) / st.scale, 560);
  };
  const onKey = (e) => {
    const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (k) {
      e.preventDefault();
      glide(pos.v + 0.1 * k, 360);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      glide(e.key === "Home" ? 0 : 1, 560);
    }
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onEnd);
  host.addEventListener("pointercancel", onEnd);
  host.addEventListener("keydown", onKey);
  const ro = new ResizeObserver(() => {
    if (host.clientWidth !== w) resize();
  });
  ro.observe(host);
  chrome();
  resize();
  armed = true;
  return {
    before,
    after,
    update(next) {
      const changed = props.update(next);
      if (["beforeLabel", "afterLabel", "labels", "handleClassName", "dividerClassName", "pillClassName", "pillTextClassName"].some((k) => changed.has(k))) {
        chrome();
        render();
      }
      if (changed.has("height")) resize();
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onEnd);
      host.removeEventListener("pointercancel", onEnd);
      host.removeEventListener("keydown", onKey);
      for (const node of [after, win, pillB.box, pillA.box, line, knob]) node.remove();
      for (const k of ["position", "overflow", "isolation", "height"]) host.style.removeProperty(k);
      for (const a of ["tabindex", "role", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-label", "data-dissolve"]) host.removeAttribute(a);
    }
  };
}
export {
  createBeforeAfter
};
