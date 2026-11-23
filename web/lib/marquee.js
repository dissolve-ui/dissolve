// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  injectStyle,
  loop,
  propsOf,
  reducedMotion,
  scope
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/marquee.core.ts
var DEFAULTS = { speed: 40, direction: "left", pauseOnHover: true, pauseOnPress: true, draggable: true, fade: 48, gap: 12 };
var EASE = 5;
var COAST = 2.6;
var MAX_FLING = 3e3;
var SLOP = 5;
var CSS = `
:where([data-dissolve="marquee"]) { position: relative; overflow: hidden; touch-action: pan-y; -webkit-user-select: none; user-select: none; outline: none; }
:where([data-dissolve="marquee"][data-draggable]) { cursor: grab; }
:where([data-dissolve="marquee"][data-dragging]) { cursor: grabbing; }
:where(.dissolve-mq-track) { display: flex; width: max-content; will-change: transform; }
:where(.dissolve-mq-row) { display: flex; flex: none; align-items: center; }
:where(.dissolve-mq-row img) { -webkit-user-drag: none; }
`;
function createMarquee(host, initial = {}) {
  injectStyle("dissolve-marquee", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = (t, type, fn, opts = {}) => t.addEventListener(type, fn, { ...opts, signal: ac.signal });
  host.dataset.dissolve = "marquee";
  host.setAttribute("role", "region");
  const track = document.createElement("div");
  track.className = "dissolve-mq-track";
  const content = document.createElement("div");
  content.className = "dissolve-mq-row";
  track.append(content);
  host.append(track);
  let clones = [];
  let W = 0;
  let x = 0, v = 0;
  let hovered = false, pressed = false, focused = false, coasting = false;
  let drag = null;
  let last = 0;
  const look = () => {
    const { fade, gap, draggable, accessibilityLabel } = p();
    content.style.gap = `${gap}px`;
    content.style.paddingRight = `${gap}px`;
    const m = fade > 0 ? `linear-gradient(to right, transparent, #000 ${fade}px, #000 calc(100% - ${fade}px), transparent)` : "";
    host.style.maskImage = m;
    host.style.setProperty("-webkit-mask-image", m);
    if (draggable) host.dataset.draggable = "";
    else delete host.dataset.draggable;
    if (accessibilityLabel) host.setAttribute("aria-label", accessibilityLabel);
    else host.removeAttribute("aria-label");
  };
  const layout = () => {
    W = content.offsetWidth;
    const need = W ? Math.ceil(host.clientWidth / W) + 1 : 0;
    clones.forEach((c) => c.remove());
    clones = Array.from({ length: need }, () => {
      const c = content.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      c.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((n) => n.setAttribute("tabindex", "-1"));
      track.append(c);
      return c;
    });
    kick();
  };
  const cruise = () => {
    if (reducedMotion() || drag || hovered && p().pauseOnHover || pressed && p().pauseOnPress || focused) return 0;
    return p().direction === "right" ? -p().speed : p().speed;
  };
  const paint = () => {
    if (!W) return;
    const off = (x % W + W) % W;
    track.style.transform = `translate3d(${-off}px, 0, 0)`;
  };
  const { kick } = loop(sc, host, (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1e3) : 1 / 60;
    last = now;
    if (!drag) {
      const c = cruise();
      if (coasting && Math.abs(v - c) < Math.max(4, Math.abs(c) * 0.2)) coasting = false;
      v += (c - v) * (1 - Math.exp(-dt * (coasting ? COAST : EASE)));
      if (Math.abs(v) < 0.5 && c === 0) v = 0;
      x += v * dt;
    }
    paint();
  }, () => {
    const moving = !!drag || v !== 0 || cruise() !== 0;
    if (!moving) last = 0;
    return moving;
  });
  on(host, "pointerenter", (e) => {
    if (e.pointerType === "mouse") {
      hovered = true;
      kick();
    }
  });
  on(host, "pointerleave", (e) => {
    if (e.pointerType === "mouse") {
      hovered = false;
      kick();
    }
  });
  on(host, "focusin", () => {
    focused = true;
    kick();
  });
  on(host, "focusout", (e) => {
    if (!host.contains(e.relatedTarget)) {
      focused = false;
      kick();
    }
  });
  on(host, "pointerdown", (e) => {
    if (e.button !== 0) return;
    pressed = true;
    if (p().draggable) drag = { id: e.pointerId, x0: e.clientX + x, at: e.clientX, moved: false, samples: [[performance.now(), e.clientX]] };
    kick();
  });
  on(host, "pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.at) < SLOP) return;
      drag.moved = true;
      host.setPointerCapture(e.pointerId);
      host.dataset.dragging = "";
      drag.x0 = e.clientX + x;
      v = 0;
    }
    x = drag.x0 - e.clientX;
    const now = performance.now();
    drag.samples.push([now, e.clientX]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 100) drag.samples.shift();
    paint();
  });
  const release = (e) => {
    pressed = false;
    if (drag && e.pointerId === drag.id) {
      if (drag.moved) {
        const s = drag.samples, a = s[0], b = s[s.length - 1];
        const dt = (b[0] - a[0]) / 1e3;
        const vel = dt > 0 && performance.now() - b[0] < 80 ? -(b[1] - a[1]) / dt : 0;
        v = Math.max(-MAX_FLING, Math.min(MAX_FLING, vel));
        coasting = true;
        swallow = performance.now() + 60;
      }
      drag = null;
      delete host.dataset.dragging;
    }
    kick();
  };
  let swallow = 0;
  on(host, "click", (ev) => {
    if (performance.now() < swallow) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }, { capture: true });
  on(host, "pointerup", release);
  on(host, "pointercancel", release);
  const ro = new ResizeObserver(() => {
    if (content.offsetWidth !== W || clones.length !== (W ? Math.ceil(host.clientWidth / W) + 1 : 0)) layout();
  });
  ro.observe(host);
  ro.observe(content);
  const mo = new MutationObserver(() => layout());
  mo.observe(content, { childList: true, subtree: true, characterData: true, attributes: true });
  look();
  layout();
  return {
    content,
    update(next) {
      const changed = props.update(next);
      look();
      if (changed.has("gap")) layout();
      kick();
    },
    destroy() {
      sc.dispose();
      ac.abort();
      ro.disconnect();
      mo.disconnect();
      track.remove();
      for (const a of ["data-dissolve", "data-draggable", "data-dragging", "role", "aria-label"]) host.removeAttribute(a);
      host.style.maskImage = "";
      host.style.removeProperty("-webkit-mask-image");
    }
  };
}
export {
  createMarquee
};
