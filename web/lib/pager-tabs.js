// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  clamp,
  el,
  injectStyle,
  plainButton,
  propsOf,
  reducedMotion,
  scope,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/pager-tabs.core.ts
var DEFAULTS = { tabs: [], initialIndex: 0, scrollable: true, haptics: true };
var ROW = 44;
var INSET = 14;
var PILL = 34;
var FLICK = 0.35;
var CSS = `
:where([data-dissolve="pager-tabs"]) { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--dissolve-background, rgb(255 255 255)); color: var(--dissolve-foreground, rgb(28 28 30)); }
:where(.dissolve-pt-row) { flex: none; padding: 7px 0 8px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
:where(.dissolve-pt-row)::-webkit-scrollbar { display: none; }
:where(.dissolve-pt-track) { position: relative; display: flex; gap: 4px; width: max-content; min-width: 100%; box-sizing: border-box; padding: 0 12px; height: ${ROW}px; }
:where(.dissolve-pt-tab) { position: relative; flex: 1 0 auto; min-width: 44px; height: ${ROW}px; padding: 0 ${INSET}px !important; font-size: 15px !important; font-weight: 600 !important; letter-spacing: -0.016em; white-space: nowrap; color: var(--dissolve-muted, rgb(142 142 147)) !important; border-radius: ${PILL / 2}px !important; outline: none; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
:where(.dissolve-pt-tab:focus-visible) { box-shadow: 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
:where(.dissolve-pt-ind) { position: absolute; left: 0; top: ${(ROW - PILL) / 2}px; height: ${PILL}px; width: 0; border-radius: ${PILL / 2}px; background: var(--dissolve-surface, rgb(242 242 247)); pointer-events: none; will-change: transform, width; }
:where(.dissolve-pt-pages) { flex: 1; min-height: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; outline: none; }
:where(.dissolve-pt-pages)::-webkit-scrollbar { display: none; }
:where(.dissolve-pt-pages[data-drag]) { scroll-snap-type: none; cursor: grabbing; user-select: none; -webkit-user-select: none; }
:where(.dissolve-pt-page) { flex: 0 0 100%; min-width: 0; height: 100%; overflow-y: auto; scroll-snap-align: start; scroll-snap-stop: always; overscroll-behavior-y: contain; outline: none; }
:where(.dissolve-pt-page:focus-visible) { box-shadow: inset 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
`;
var uid = 0;
function createPagerTabs(host, initial = {}) {
  injectStyle("dissolve-pager-tabs", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const id = `dissolve-pt-${++uid}`;
  host.dataset.dissolve = "pager-tabs";
  const row = el("div", "dissolve-pt-row");
  const track = el("div", "dissolve-pt-track");
  track.setAttribute("role", "tablist");
  const ind = el("div", "dissolve-pt-ind");
  row.append(track);
  const pagesEl = el("div", "dissolve-pt-pages");
  host.append(row, pagesEl);
  let tabEls = [];
  let pages = [];
  let index = clamp(p().initialIndex, 0, Math.max(0, p().tabs.length - 1));
  let boxes = [];
  const width = () => pagesEl.clientWidth || 1;
  const progress = () => pagesEl.scrollLeft / width();
  function build() {
    const tabs = p().tabs;
    track.replaceChildren();
    pagesEl.replaceChildren();
    tabEls = tabs.map((label, i) => {
      const b = plainButton("dissolve-pt-tab");
      b.textContent = label;
      b.id = `${id}-tab-${i}`;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", `${id}-page-${i}`);
      b.addEventListener("click", () => select(i), on);
      track.append(b);
      return b;
    });
    track.prepend(ind);
    pages = tabs.map((_, i) => {
      const pg = el("div", "dissolve-pt-page");
      pg.id = `${id}-page-${i}`;
      pg.setAttribute("role", "tabpanel");
      pg.setAttribute("aria-labelledby", `${id}-tab-${i}`);
      pg.tabIndex = 0;
      pagesEl.append(pg);
      return pg;
    });
    index = clamp(index, 0, Math.max(0, tabs.length - 1));
    measure();
    pagesEl.scrollLeft = index * width();
    mark();
    render();
  }
  function measure() {
    boxes = tabEls.map((t) => ({ x: t.offsetLeft, w: t.offsetWidth }));
  }
  function at(pr) {
    const n = boxes.length;
    if (!n) return { x: 0, w: 0 };
    const i = clamp(Math.floor(pr), 0, n - 1), j = Math.min(n - 1, i + 1), t = clamp(pr - i);
    return { x: boxes[i].x + (boxes[j].x - boxes[i].x) * t, w: boxes[i].w + (boxes[j].w - boxes[i].w) * t };
  }
  function render() {
    const pr = progress();
    const b = at(pr);
    ind.style.width = b.w + "px";
    ind.style.transform = `translateX(${b.x.toFixed(2)}px)`;
    tabEls.forEach((t, i) => {
      const d = clamp(Math.abs(pr - i));
      t.style.setProperty("color", d >= 1 ? "" : `color-mix(in srgb, var(--dissolve-muted, rgb(142 142 147)) ${(d * 100).toFixed(1)}%, var(--dissolve-foreground, rgb(28 28 30)))`, "important");
    });
    if (p().scrollable && !rowTouched) row.scrollLeft = b.x + b.w / 2 - row.clientWidth / 2;
    const now = clamp(Math.round(pr), 0, Math.max(0, tabEls.length - 1));
    if (now !== index) {
      index = now;
      mark();
      if (p().haptics) vibrate(4);
      p().onIndexChange?.(now);
    }
  }
  function mark() {
    tabEls.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === index));
      t.tabIndex = i === index ? 0 : -1;
    });
    pages.forEach((pg, i) => {
      pg.inert = i !== index && !dragging;
    });
  }
  function select(i, animated = !reducedMotion()) {
    const to = clamp(i, 0, Math.max(0, tabEls.length - 1));
    rowTouched = false;
    pages.forEach((pg) => pg.inert = false);
    pagesEl.scrollTo({ left: to * width(), behavior: animated ? "smooth" : "auto" });
    if (!animated) render();
  }
  pagesEl.addEventListener("scroll", () => render(), { passive: true, ...on });
  pagesEl.addEventListener("scrollend", () => mark(), on);
  pagesEl.addEventListener("touchstart", () => pages.forEach((pg) => pg.inert = false), { passive: true, ...on });
  let rowTouched = false;
  row.addEventListener("wheel", () => rowTouched = true, { passive: true, ...on });
  row.addEventListener("touchstart", () => rowTouched = true, { passive: true, ...on });
  pagesEl.addEventListener("wheel", () => rowTouched = false, { passive: true, ...on });
  pagesEl.addEventListener("touchstart", () => rowTouched = false, { passive: true, ...on });
  track.addEventListener("keydown", (e) => {
    const k = e.key;
    const to = k === "ArrowRight" ? index + 1 : k === "ArrowLeft" ? index - 1 : k === "Home" ? 0 : k === "End" ? tabEls.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const i = clamp(to, 0, tabEls.length - 1);
    select(i);
    tabEls[i]?.focus({ preventScroll: true });
  }, on);
  let dragging = false;
  let drag = null;
  pagesEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, left: pagesEl.scrollLeft, vx: 0, lastX: e.clientX, lastT: performance.now() };
  }, on);
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      dragging = true;
      rowTouched = false;
      pagesEl.dataset.drag = "";
      pages.forEach((pg) => pg.inert = false);
    }
    const now = performance.now(), dt = now - drag.lastT;
    if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = now;
    pagesEl.scrollLeft = drag.left - dx;
  }, on);
  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!dragging) return;
    dragging = false;
    if (performance.now() - d.lastT > 80) d.vx = 0;
    const pr = progress(), from = d.left / width();
    let to = Math.round(pr);
    if (Math.abs(d.vx) > FLICK) to = d.vx < 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
    to = clamp(to, Math.floor(from) - 1, Math.ceil(from) + 1);
    const target = clamp(to, 0, tabEls.length - 1) * width();
    pagesEl.scrollTo({ left: target, behavior: reducedMotion() ? "auto" : "smooth" });
    const restore = () => {
      if (!dragging) delete pagesEl.dataset.drag;
      mark();
    };
    if ("onscrollend" in window && Math.abs(pagesEl.scrollLeft - target) > 1) pagesEl.addEventListener("scrollend", restore, { once: true, signal: ac.signal });
    else restore();
  };
  addEventListener("pointerup", endDrag, on);
  addEventListener("pointercancel", endDrag, on);
  pagesEl.addEventListener("click", (e) => {
    if (pagesEl.dataset.drag !== void 0) e.stopPropagation();
  }, { capture: true, ...on });
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const w = width();
    measure();
    if (w !== lastW) {
      lastW = w;
      pagesEl.scrollLeft = index * w;
    }
    render();
  });
  ro.observe(pagesEl);
  ro.observe(track);
  sc.onDispose(() => ro.disconnect());
  document.fonts?.ready.then(() => {
    if (sc.alive) {
      measure();
      render();
    }
  });
  function apply(changed) {
    if (!changed || changed.has("tabs")) build();
    row.style.overflowX = p().scrollable ? "auto" : "hidden";
  }
  apply();
  return {
    get pages() {
      return pages;
    },
    get index() {
      return index;
    },
    select,
    update(next) {
      const changed = props.update(next);
      if (changed.size) apply(changed);
    },
    destroy() {
      sc.dispose();
      ac.abort();
      row.remove();
      pagesEl.remove();
      delete host.dataset.dissolve;
    }
  };
}
export {
  createPagerTabs
};
