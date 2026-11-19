// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  CALM,
  QUAD,
  bezier,
  claimTouch,
  el,
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/card-stack.core.ts
var DEFAULTS = { keys: [], peek: 60, haptics: true };
var FOCUS_MS = 560;
var CYCLE_MS = 420;
var REDUCED_MS = 150;
var MINI = 9;
var MINI_GAP = 22;
var MINI_TAIL = 30;
var EXIT = bezier(0.4, 0, 1, 1);
var CSS = `
:where(.dissolve-card-stack-clip) { position: absolute; inset: 0; overflow: hidden; }
:where(.dissolve-card-stack-item) {
  position: absolute; left: 0; right: 0; top: 0; overflow: hidden; cursor: pointer; touch-action: pan-y;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; will-change: transform, opacity;
}
:where(.dissolve-card-stack-item[aria-pressed="true"]) { cursor: grab; }
:where(.dissolve-card-stack-item[data-dragging]) { cursor: grabbing; }
:where(.dissolve-card-stack-item:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 3px; }
/* Upward shadow: each card shades the strip of the card it overlaps. */
:where(.dissolve-card-stack-card) { border-radius: 20px; box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.12); }
`;
function velocity(samples) {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const a = samples[0], b = samples[samples.length - 1], dt = (b[0] - a[0]) / 1e3;
  return dt > 0 ? { vx: (b[1] - a[1]) / dt, vy: (b[2] - a[2]) / dt } : { vx: 0, vy: 0 };
}
function sample(list, e) {
  const now = performance.now();
  list.push([now, e.clientX, e.clientY]);
  while (list.length > 2 && now - list[0][0] > 80) list.shift();
}
function createCardStack(host, initial = {}) {
  injectStyle("dissolve-card-stack", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "card-stack";
  host.setAttribute("role", "group");
  host.style.position = "relative";
  const clip = el("div", "dissolve-card-stack-clip");
  host.append(clip);
  const byKey = /* @__PURE__ */ new Map();
  let cards = [];
  let focus = null;
  let W = 0, H = 0;
  const n = () => cards.length;
  const off = () => W + 24;
  const target = (i) => {
    const peek = p().peek;
    if (focus === null) return { y: i * peek, scale: 1, delay: i * 18 };
    if (i === focus) return { y: 0, scale: 1, delay: 0 };
    const k = i < focus ? i : i - 1;
    const m = Math.max(1, n() - 2);
    const s = 0.92 + 0.04 * (k / m);
    return { y: H + MINI_GAP + k * MINI - H * (1 - s) / 2, scale: s, delay: 40 + k * 22 };
  };
  const chrome = (node) => {
    node.className = `dissolve-card-stack-item ${p().cardClassName ?? "dissolve-card-stack-card"}`;
  };
  function make(key) {
    const node = el("div");
    chrome(node);
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    const render = () => {
      const away = W ? Math.min(1, Math.abs(c.tx.v) / W) : 0;
      node.style.opacity = (c.op.v * (1 - away * 0.6)).toFixed(3);
      node.style.transform = `translate3d(${c.tx.v.toFixed(2)}px,${c.ty.v.toFixed(2)}px,0) scale(${(c.sc.v * (1 - 0.015 * c.press.v)).toFixed(4)})`;
    };
    const c = { key, i: 0, node, ty: value(sc, 0, render), tx: value(sc, 0, render), sc: value(sc, 1, render), op: value(sc, 1, render), press: value(sc, 0, render) };
    gestures(c);
    byKey.set(key, c);
    return c;
  }
  const sync = () => cards.forEach((c) => {
    c.node.style.zIndex = String(focus === c.i ? n() + 10 : c.i);
    c.node.setAttribute("aria-pressed", String(focus === c.i));
  });
  const snap = (c) => {
    const t = target(c.i);
    c.ty.set(t.y);
    c.sc.set(t.scale);
    c.tx.set(0);
    c.op.set(1);
  };
  const move = (c) => {
    const t = target(c.i), reduced = reducedMotion(), ms = reduced ? REDUCED_MS : FOCUS_MS, lag = reduced ? 0 : t.delay;
    c.ty.to(t.y, ms, CALM, lag);
    c.sc.to(t.scale, ms, CALM, lag);
    c.tx.to(0, ms, CALM);
    c.op.to(1, 200, QUAD);
  };
  function go(next) {
    focus = next;
    sync();
    cards.forEach(move);
    p().onFocus?.(next);
  }
  function cycle(dir) {
    if (focus === null || n() < 2) return;
    const from = focus, to = (focus + dir + n()) % n(), reduced = reducedMotion();
    if (p().haptics) vibrate(4);
    focus = to;
    sync();
    cards.forEach((c) => {
      const t = target(c.i);
      if (c.i === to) {
        c.ty.set(t.y);
        c.sc.set(t.scale);
        if (reduced) {
          c.tx.set(0);
          c.op.set(0);
          c.op.to(1, REDUCED_MS, QUAD);
          return;
        }
        c.op.set(1);
        c.tx.set(dir * off());
        c.tx.to(0, CYCLE_MS, CALM);
      } else if (c.i === from) {
        c.tx.set(0);
        c.ty.set(t.y);
        c.sc.set(t.scale);
        c.op.set(0);
        if (reduced) c.op.to(1, REDUCED_MS, QUAD);
        else c.op.to(1, 320, CALM, 80);
      } else move(c);
    });
    p().onFocus?.(to);
  }
  function onTap(i) {
    if (focus === null) {
      if (p().haptics) vibrate(8);
      go(i);
    } else if (i !== focus) {
      if (p().haptics) vibrate(6);
      go(null);
    }
  }
  const dismiss = () => {
    if (p().haptics) vibrate(6);
    go(null);
  };
  const swipeAway = (c, next) => c.tx.to(-next * off(), 260, EXIT).then((ok) => ok && cycle(next));
  function gestures(c) {
    const node = c.node;
    let g = null;
    const claimed = claimTouch(node, (_dx, dy) => !!g && focus === c.i && dy > 0);
    node.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      g = { x0: e.clientX, y0: e.clientY, t0: performance.now(), axis: 0, samples: [] };
      sample(g.samples, e);
      c.press.to(1, 120, QUAD);
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
      }
    });
    node.addEventListener("pointermove", (e) => {
      if (!g) return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      sample(g.samples, e);
      if (!g.axis) {
        if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return;
        if (focus !== c.i) {
          g.moved = true;
          c.press.to(0, 260, CALM);
          return;
        }
        g.axis = n() > 1 && Math.abs(dx) > Math.abs(dy) ? 1 : 2;
        c.press.to(0, 260, CALM);
        if (g.axis === 2 && e.pointerType === "touch" && !claimed()) {
          g = null;
          return;
        }
        node.dataset.dragging = "";
      }
      if (g.axis === 1) {
        c.tx.set(dx);
        return;
      }
      c.ty.set(dy > 0 ? dy * 0.9 : -Math.sqrt(-dy) * 3);
      c.sc.set(1 - Math.min(1, Math.max(0, dy) / 400) * 0.05);
    });
    const end = (e) => {
      if (!g) return;
      const st = g;
      g = null;
      delete node.dataset.dragging;
      c.press.to(0, 260, CALM);
      if (e.type !== "pointerup" && !st.axis) return;
      const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
      const { vx, vy } = velocity(st.samples);
      if (st.axis === 1) {
        if (Math.abs(dx) > W * 0.28 || Math.abs(vx) > 700) swipeAway(c, dx < 0 ? 1 : -1);
        else c.tx.to(0, 380, CALM);
        return;
      }
      if (st.axis === 2) {
        if (dy > 90 || vy > 800) dismiss();
        else {
          c.ty.to(0, 380, CALM);
          c.sc.to(1, 380, CALM);
        }
        return;
      }
      if (!st.moved && performance.now() - st.t0 <= 400) onTap(c.i);
    };
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
    node.addEventListener("keydown", (e) => {
      if (e.target !== node) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onTap(c.i);
      } else if (e.key === "Escape" && focus !== null) dismiss();
      else if (focus === c.i && n() > 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) swipeAway(c, e.key === "ArrowRight" ? 1 : -1);
    });
  }
  function size() {
    W = host.clientWidth;
    H = p().cardHeight ?? Math.round(W / 1.586);
    const stackH = Math.max(0, n() - 1) * p().peek + H;
    const focusH = H + MINI_GAP + Math.max(0, n() - 2) * MINI + MINI_TAIL;
    host.style.height = W ? Math.max(stackH, focusH) + "px" : "";
    clip.hidden = !W;
    for (const c of cards) c.node.style.height = H + "px";
  }
  function setKeys() {
    const keys = p().keys;
    const next = keys.map((k) => byKey.get(k) ?? make(k));
    for (const c of cards) if (!next.includes(c)) {
      c.node.remove();
      byKey.delete(c.key);
    }
    const fresh = next.filter((c) => !cards.includes(c));
    cards = next;
    cards.forEach((c, i) => {
      c.i = i;
      clip.append(c.node);
    });
    size();
    fresh.forEach(snap);
    if (focus !== null && focus >= n()) go(null);
    else {
      sync();
      cards.filter((c) => !fresh.includes(c)).forEach(move);
    }
  }
  setKeys();
  const ro = new ResizeObserver(() => {
    if (host.clientWidth === W) return;
    size();
    cards.forEach(snap);
  });
  ro.observe(host);
  return {
    slot: (key) => (byKey.get(key) ?? make(key)).node,
    update(next) {
      const changed = props.update(next);
      if (changed.has("keys") && p().keys.join("\n") !== cards.map((c) => c.key).join("\n")) setKeys();
      else if (changed.has("cardHeight") || changed.has("peek")) {
        size();
        cards.forEach(move);
      }
      if (changed.has("cardClassName")) byKey.forEach((c) => chrome(c.node));
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      clip.remove();
      host.style.removeProperty("position");
      host.style.removeProperty("height");
      host.removeAttribute("role");
      delete host.dataset.dissolve;
    }
  };
}
export {
  createCardStack
};
