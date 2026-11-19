// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  morph
} from "./chunks/chunk-6TDGCXIW.js";
import {
  CALM,
  capture,
  clamp,
  el,
  frame,
  injectStyle,
  loop,
  propsOf,
  reducedMotion,
  scope,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/skeleton.core.ts
var DEFAULTS = { shimmer: true, color: "surface", stagger: 70, duration: 600, grain: 3, haptics: true };
var BLOCK_DEFAULTS = { shape: "line", lines: 1 };
var WAVE_MS = 1800;
var WAVE_SPAN = 520;
var DEPTH = 0.42;
var SETTLE = 180;
var TOTAL = 900;
var FADE = 240;
var MAX_GRAINS = 2500;
var CALM_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";
var CSS = `
:where([data-dissolve="skeleton-block"]) { position: relative; }
:where(.dissolve-skeleton-ph) { display: flex; flex-direction: column; justify-content: center; pointer-events: none; }
:where(.dissolve-skeleton-line) { display: flex; align-items: center; flex: none; }
:where(.dissolve-skeleton-bar) { display: block; flex: none; background: var(--dissolve-surface, rgb(242 242 247)); }
:where([data-dissolve="skeleton"][data-fill="surface-2"] .dissolve-skeleton-bar) { background: var(--dissolve-surface-2, rgb(229 229 234)); }
:where([data-dissolve="skeleton"][data-fill="border"] .dissolve-skeleton-bar) { background: var(--dissolve-border, rgb(60 60 67 / 0.12)); }
`;
var px = (v) => typeof v === "number" ? v + "px" : v;
function createSkeleton(host, initial) {
  injectStyle("dissolve-skeleton", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const blocks = /* @__PURE__ */ new Set();
  host.dataset.dissolve = "skeleton";
  host.dataset.fill = p().color;
  let wave = 0, waveFrom = 0, waveTo = 0, waveAt = 0, waveMs = 0, dirty = true, run = 0;
  const waving = () => p().loading && p().shimmer;
  const setWave = (to, ms) => {
    waveFrom = wave;
    waveTo = to;
    waveAt = performance.now();
    waveMs = ms;
    lp.kick();
  };
  function phases() {
    const r = host.getBoundingClientRect(), s = r.width / host.offsetWidth || 1;
    for (const b of blocks) {
      if (b.state !== "loading") continue;
      const q = b.ph.getBoundingClientRect();
      b.phase = ((q.top - r.top) / s + (q.left - r.left) / s * 0.5) / WAVE_SPAN;
    }
    dirty = false;
  }
  const lp = loop(sc, host, (now) => {
    if (dirty) phases();
    const k = waveMs > 0 ? clamp((now - waveAt) / waveMs) : 1;
    wave = waveFrom + (waveTo - waveFrom) * CALM(k);
    const c = now % WAVE_MS / WAVE_MS;
    const w = reducedMotion() ? 0 : wave;
    for (const b of blocks) {
      const dip = w > 0 ? DEPTH * w * (0.5 + 0.5 * Math.cos(2 * Math.PI * (c - b.phase))) : 0;
      b.ph.style.opacity = String(b.vis * (1 - dip));
    }
  }, () => waving() || wave > 1e-3 || waveTo > 0);
  const ro = new ResizeObserver(() => {
    dirty = true;
    lp.kick();
  });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());
  function handing(b) {
    const w = b.ph.offsetWidth, h = b.ph.offsetHeight;
    Object.assign(b.ph.style, { position: "absolute", left: "0", top: "0", width: w + "px", height: h + "px" });
    b.slot.style.transition = "none";
    b.slot.style.opacity = "0";
    b.slot.style.display = "";
    b.state = "handing";
  }
  function land(b, fade) {
    if (fade) void b.slot.offsetHeight;
    b.slot.style.transition = fade ? `opacity ${fade}ms ${CALM_CSS}` : "none";
    b.slot.style.opacity = "";
    b.vis = 0;
    b.state = "done";
    lp.kick();
  }
  function layoutDone(b) {
    b.ph.style.display = "none";
    b.vis = 0;
    b.slot.style.display = "";
    b.state = "done";
  }
  async function handoff() {
    const id = ++run;
    const live = () => sc.alive && run === id;
    const list = [...blocks].filter((b) => b.state === "loading");
    if (!list.length) return p().onReveal?.();
    list.forEach(handing);
    if (reducedMotion()) {
      wave = waveTo = 0;
      list.forEach((b) => land(b, FADE));
      await sc.wait(FADE);
      if (!live()) return;
      list.forEach(layoutDone);
      return p().onReveal?.();
    }
    setWave(0, SETTLE);
    await sc.wait(SETTLE);
    await frame();
    await frame();
    if (!live()) return;
    const shots = await Promise.all(list.map((b) => Promise.all([capture(b.ph), capture(b.slot)])));
    if (!live()) return;
    const jobs = list.map((b, k) => ({ b, from: shots[k][0], to: shots[k][1] }));
    jobs.sort((x, y) => Math.abs(x.from.y - y.from.y) > 6 ? x.from.y - y.from.y : x.from.x - y.from.x);
    const { stagger, duration, grain, haptics } = p();
    const step = jobs.length > 1 ? Math.max(0, Math.min(stagger, (TOTAL - duration) / (jobs.length - 1))) : 0;
    if (haptics) sc.wait(duration * 0.45).then(() => {
      if (live()) vibrate(10);
    });
    await Promise.all(jobs.map(async ({ b, from, to }, i) => {
      if (i) await sc.wait(i * step);
      if (!live()) return;
      if (!from.w || !from.h || !to.w || !to.h) {
        land(b, FADE);
        return sc.wait(FADE);
      }
      const g = Math.max(grain, Math.sqrt(from.w * from.h / MAX_GRAINS), Math.sqrt(to.w * to.h / MAX_GRAINS));
      const h = morph(from, to, { grain: g, duration });
      frame().then(frame).then(() => {
        if (live()) {
          b.vis = 0;
          lp.kick();
        }
      });
      await h.done;
      if (live()) land(b, 0);
    }));
    if (!live()) return;
    list.forEach(layoutDone);
    p().onReveal?.();
  }
  async function toLoading() {
    const id = ++run;
    const list = [...blocks].filter((b) => b.state !== "loading");
    for (const b of list) {
      b.ph.style.display = "";
      for (const k of ["position", "left", "top"]) b.ph.style[k] = "";
      b.shape();
      b.vis = 0;
      b.state = "loading";
      Object.assign(b.slot.style, { position: "absolute", left: "0", top: "0", transition: `opacity ${FADE}ms ${CALM_CSS}`, opacity: "0" });
    }
    dirty = true;
    if (waving()) setWave(1, 400);
    const t0 = performance.now();
    await new Promise((done) => {
      const f = (now) => {
        if (!sc.alive || run !== id) return done();
        const e = CALM(clamp((now - t0) / FADE));
        list.forEach((b) => {
          b.vis = e;
        });
        lp.kick();
        if (e < 1) requestAnimationFrame(f);
        else done();
      };
      requestAnimationFrame(f);
    });
    if (run !== id) return;
    for (const b of list) {
      b.slot.style.display = "none";
      for (const k of ["position", "left", "top", "transition", "opacity"]) b.slot.style[k] = "";
    }
  }
  function block(bhost, init = {}) {
    const bp = propsOf(BLOCK_DEFAULTS, init);
    bhost.dataset.dissolve = "skeleton-block";
    const ph = el("div", "dissolve-skeleton-ph");
    ph.setAttribute("aria-hidden", "true");
    const slot = el("div");
    bhost.append(slot, ph);
    const b = { ph, slot, vis: 1, phase: 0, state: "loading", shape };
    if (p().loading) slot.style.display = "none";
    else layoutDone(b);
    blocks.add(b);
    lp.kick();
    function shape() {
      const { shape: kind, width, height, size, radius, lines, className } = bp.current;
      const bar = (w, h, r) => {
        const i = el("i", "dissolve-skeleton-bar" + (className ? " " + className : ""));
        Object.assign(i.style, { width: w, height: h + "px", borderRadius: r + "px" });
        return i;
      };
      ph.replaceChildren();
      if (kind === "circle") {
        const d = size ?? height ?? 40;
        Object.assign(ph.style, { width: d + "px", height: d + "px" });
        ph.append(bar(d + "px", d, radius ?? d / 2));
      } else if (kind === "rect") {
        const h = height ?? 120;
        Object.assign(ph.style, { width: px(width ?? "100%"), height: h + "px" });
        ph.append(bar("100%", h, radius ?? 12));
      } else {
        const lh = height ?? 20, h = Math.max(6, Math.round(lh * 0.6)), n = Math.max(1, Math.round(lines));
        Object.assign(ph.style, { width: px(width ?? "100%"), height: lh * n + "px" });
        for (let i = 0; i < n; i++) {
          const line = el("div", "dissolve-skeleton-line");
          line.style.height = lh + "px";
          line.append(bar(n > 1 && i === n - 1 ? "60%" : "100%", h, radius ?? h / 2));
          ph.append(line);
        }
      }
      dirty = true;
    }
    shape();
    return {
      slot,
      update(next) {
        if (bp.update(next).size && b.state === "loading") shape();
      },
      destroy() {
        blocks.delete(b);
        ph.remove();
        slot.remove();
        delete bhost.dataset.dissolve;
      }
    };
  }
  if (waving()) setWave(1, 400);
  return {
    block,
    update(next) {
      const was = p().loading;
      const changed = props.update(next);
      if (changed.has("color")) host.dataset.fill = p().color;
      if (changed.has("loading")) {
        if (p().loading) toLoading();
        else if (was) handoff();
      } else if (changed.has("shimmer") && p().loading) setWave(p().shimmer ? 1 : 0, 400);
    },
    destroy() {
      run++;
      sc.dispose();
      for (const b of blocks) {
        b.ph.remove();
        b.slot.remove();
      }
      blocks.clear();
      delete host.dataset.dissolve;
      delete host.dataset.fill;
    }
  };
}
export {
  createSkeleton
};
