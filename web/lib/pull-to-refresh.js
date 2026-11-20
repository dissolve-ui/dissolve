// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  play
} from "./chunks/chunk-R2UPSOGD.js";
import {
  CALM,
  capture,
  claimTouch,
  clamp,
  el,
  frame,
  hash,
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/pull-to-refresh.core.ts
var DEFAULTS = { threshold: 80, haptics: true, color: "foreground", rebuild: true };
var FALLBACK = {
  foreground: "rgb(28 28 30)",
  muted: "rgb(142 142 147)",
  primary: "rgb(28 28 30)",
  accent: "rgb(10 132 255)",
  success: "rgb(52 199 89)",
  "chart-1": "rgb(255 55 135)",
  "chart-2": "rgb(124 92 255)"
};
var N = 52;
var RADIUS = 13;
var DOT = 2.7;
var SPEED = Math.PI * 2;
var MIN_SPIN = 700;
var DUST = 820;
var SETTLE = 520;
var MOVE = 420;
var FLY = 240;
var FLY_STAGGER = 50;
var LAND = 90;
var GATHER = 820;
var TAU = Math.PI * 2;
var CALM_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";
var UNITLESS = /* @__PURE__ */ new Set(["opacity", "zIndex", "flex", "flexGrow", "flexShrink", "order", "fontWeight", "lineHeight"]);
var SEEDS = Array.from({ length: N }, (_, i) => {
  const side = hash(i, 2) < 0.5 ? -1 : 1;
  return [i / N * TAU, RADIUS + (hash(i, 1) - 0.5) * 3.2, side * (24 + hash(i, 3) * 120), (hash(i, 4) - 0.5) * 70, 0.72 * (i / N) + 0.28 * hash(i, 5), hash(i, 6)];
});
var CSS = `
:where([data-dissolve="pull-to-refresh"]) { position: relative; overflow: hidden; isolation: isolate; touch-action: pan-y; cursor: grab; outline: none; user-select: none; -webkit-user-select: none; }
:where([data-dissolve="pull-to-refresh"][data-pulling]) { cursor: grabbing; }
:where(.dissolve-pull-list) { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
:where(.dissolve-pull-grains) { position: absolute; left: 0; top: 0; pointer-events: none; }
`;
function createPullToRefresh(host, initial = {}) {
  injectStyle("dissolve-pull-to-refresh", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = (type, fn, opts = {}) => host.addEventListener(type, fn, { ...opts, signal: ac.signal });
  host.dataset.dissolve = "pull-to-refresh";
  const ownTab = !host.hasAttribute("tabindex");
  if (ownTab) host.tabIndex = 0;
  const list = el("div", "dissolve-pull-list");
  const cv = el("canvas", "dissolve-pull-grains");
  cv.setAttribute("aria-hidden", "true");
  host.append(list, cv);
  const ctx = cv.getContext("2d");
  let CW = 0, CH = 0, dpr = 1;
  const size = () => {
    CW = host.clientWidth;
    CH = host.clientHeight;
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(CW * dpr);
    cv.height = Math.round(CH * dpr);
    cv.style.width = CW + "px";
    cv.style.height = CH + "px";
    kick();
  };
  const ro = new ResizeObserver(size);
  ro.observe(host);
  let applied = [];
  function containerStyle() {
    for (const k of applied) list.style.removeProperty(k);
    applied = [];
    for (const [k, v] of Object.entries(p().contentContainerStyle ?? {})) {
      const name = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      list.style.setProperty(name, typeof v === "number" && !UNITLESS.has(k) ? v + "px" : String(v));
      applied.push(name);
    }
  }
  containerStyle();
  const T = () => Math.max(40, p().threshold);
  let ink = "";
  const readInk = () => {
    ink = token(host, p().color, FALLBACK[p().color] ?? FALLBACK.foreground);
  };
  const scale = () => host.getBoundingClientRect().width / host.offsetWidth || 1;
  let raw = 0, sy = 0, phase = "idle", phaseAt = 0, closeAt = -1e9, armed = false, rot = -Math.PI / 2, dustCy = 0, flying = false;
  let busy = null;
  const P = new Float32Array(N * 6);
  const AIM = new Float32Array(N * 2);
  const band = (d) => d < T() ? d : T() + (d - T()) * 0.5;
  const pull = value(sc, 0, () => {
    apply();
    kick();
  });
  const maxScroll = () => Math.max(0, list.offsetHeight - host.clientHeight);
  const apply = () => {
    list.style.transform = `translateY(${pull.v - sy}px)`;
  };
  const track = () => {
    if (phase !== "idle" || armed || pull.v < T()) return;
    armed = true;
    closeAt = performance.now();
    if (p().haptics) vibrate(8);
  };
  const setPhase = (ph) => {
    phase = ph;
    phaseAt = performance.now();
    if (ph === "done" && !flying) {
      const cx = CW / 2;
      for (let i = 0; i < N; i++) {
        const k = i * 6, dx = P[k] - cx, dy = P[k + 1] - dustCy, d = Math.hypot(dx, dy) || 1, push = 30 + SEEDS[i][5] * 90;
        P[k + 4] = dx / d * push + (hash(i, 7) - 0.5) * 40;
        P[k + 5] = dy / d * push - 50 - hash(i, 8) * 60;
      }
    }
    kick();
  };
  let raf = 0, last = 0;
  function kick() {
    if (raf || !sc.alive) return;
    readInk();
    last = performance.now();
    raf = requestAnimationFrame(paint);
  }
  sc.onDispose(() => cancelAnimationFrame(raf));
  function paint(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1e3);
    last = now;
    const reduced = reducedMotion();
    const Tv = T(), H = Math.round(Tv * 2.6);
    const vis = pull.v, since = now - phaseAt;
    const g = Math.min(1, vis / Tv);
    const cy = vis < Tv ? vis / 2 : vis - Tv / 2, cx = CW / 2;
    if (phase !== "done") dustCy = cy;
    if (phase === "idle") rot = -Math.PI / 2 + vis / Tv * 0.9;
    else if (phase === "spin" && !reduced) rot += SPEED * Math.min(1, since / 400) * dt;
    const sinceClose = now - closeAt;
    const pulse = !reduced && sinceClose < 300 ? 1 + 0.16 * Math.sin(Math.PI * sinceClose / 300) : 1;
    const spinMix = phase === "spin" && !reduced ? Math.min(1, since / 300) : 0;
    const fadeIn = Math.min(1, vis / 14), tSec = now / 1e3;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CW, phase !== "done" ? Math.max(0, vis) : flying ? CH : H);
    ctx.clip();
    ctx.fillStyle = ink;
    let visible = false;
    for (let i = 0; i < N; i++) {
      const S = SEEDS[i], k = i * 6;
      let x, y, a, size2 = DOT;
      if (phase === "done") {
        if (reduced) {
          x = P[k];
          y = P[k + 1];
          a = P[k + 2] * (1 - Math.min(1, since / 220));
        } else if (flying) {
          const delay = S[5] * FLY_STAGGER, run = FLY - FLY_STAGGER;
          const e = CALM(clamp((since - delay) / run));
          x = P[k] + (AIM[i * 2] - P[k]) * e;
          y = P[k + 1] + (AIM[i * 2 + 1] - P[k + 1]) * e;
          const f = clamp((since - delay - run) / LAND);
          a = (P[k + 2] + (0.95 - P[k + 2]) * e) * (1 - f);
          size2 = P[k + 3] * (1 - 0.4 * f);
        } else {
          const delay = S[5] * 110, t = Math.max(0, since - delay) / 1e3;
          x = P[k] + P[k + 4] * t;
          y = P[k + 1] + P[k + 5] * t + 0.5 * 980 * t * t;
          const q = clamp((since - delay) / (DUST - 110));
          a = P[k + 2] * (1 - q) * (1 - q);
          size2 = P[k + 3] * (1 - 0.45 * q);
        }
      } else {
        const ang = S[0] + rot;
        const r = S[1] * pulse + (phase === "spin" && !reduced ? Math.sin(tSec * 3.1 + i * 1.7) * 0.7 : 0);
        const rx = cx + Math.cos(ang) * r, ry = cy + Math.sin(ang) * r;
        if (reduced) {
          x = rx;
          y = ry;
          a = g * 0.9;
        } else {
          const gi = clamp((g - S[4] * 0.55) / 0.45), e = 1 - (1 - gi) ** 3, wob = (1 - e) * 3;
          const fx = cx + S[2] + Math.sin(tSec * 1.3 + i) * wob, fy = cy + S[3] + Math.cos(tSec * 1.1 + i * 0.7) * wob;
          x = fx + (rx - fx) * e;
          y = fy + (ry - fy) * e;
          a = (0.12 + 0.83 * e) * fadeIn;
          size2 = DOT * (0.55 + 0.45 * e);
          if (spinMix > 0) a = a * (1 - spinMix) + (0.22 + 0.78 * (S[0] / TAU) ** 1.6) * spinMix;
        }
        P[k] = x;
        P[k + 1] = y;
        P[k + 2] = a;
        P[k + 3] = size2;
      }
      if (a <= 3e-3) continue;
      visible = true;
      ctx.globalAlpha = Math.min(1, a);
      ctx.beginPath();
      ctx.arc(x, y, size2 / 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (visible || phase !== "idle" || vis > 0.01) raf = requestAnimationFrame(paint);
  }
  const items = () => [...list.querySelectorAll("[data-pull-item]")];
  const idOf = (n) => n.dataset.pullItem ?? "";
  let before = null;
  let hideNew = false;
  const fresh = /* @__PURE__ */ new Set();
  const was = /* @__PURE__ */ new Map();
  const posOf = (n, base) => {
    const r = n.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top };
  };
  const reveal = (n) => {
    n.style.opacity = "";
    fresh.delete(n);
  };
  function glide() {
    const live = [...was.keys()].filter((n) => n.isConnected);
    for (const n of live) {
      n.style.transition = "none";
      n.style.transform = "";
    }
    const base = list.getBoundingClientRect(), s = scale();
    const moved = [];
    for (const n of live) {
      const at = was.get(n), now = posOf(n, base);
      was.set(n, now);
      const dx = (at.x - now.x) / s, dy = (at.y - now.y) / s;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      n.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(n);
    }
    void list.offsetHeight;
    for (const n of moved) {
      n.style.transition = `transform ${MOVE}ms ${CALM_CSS}`;
      n.style.transform = "";
      n.addEventListener("transitionend", () => {
        n.style.transition = "";
      }, { once: true });
    }
  }
  const mo = new MutationObserver(() => {
    if (!before) return;
    for (const n of items()) {
      if (before.has(idOf(n)) || fresh.has(n) || was.has(n)) continue;
      if (hideNew) {
        n.style.opacity = "0";
        fresh.add(n);
      }
    }
    if (!reducedMotion()) glide();
  });
  mo.observe(list, { childList: true, subtree: true });
  sc.onDispose(() => mo.disconnect());
  async function findNew() {
    const hr = host.getBoundingClientRect(), s = scale();
    const lift = (pull.v - sy) * s;
    const out = [];
    for (const n of [...fresh]) {
      const r = n.getBoundingClientRect();
      const y = r.top - lift;
      if (!r.width || !r.height || y >= hr.bottom || y + r.height <= hr.top || r.right <= hr.left || r.left >= hr.right) {
        reveal(n);
        continue;
      }
      out.push({ n, shot: await capture(n) });
    }
    return out;
  }
  async function refresh() {
    setPhase("spin");
    raw = 0;
    pull.to(T(), reducedMotion() ? 120 : 320, CALM);
    const animate = p().rebuild && !reducedMotion();
    const base = list.getBoundingClientRect();
    before = new Set(items().map(idOf));
    hideNew = animate;
    was.clear();
    for (const n of items()) was.set(n, posOf(n, base));
    const t0 = performance.now();
    let ok = true;
    try {
      await p().onRefresh?.();
    } catch {
      ok = false;
    }
    const left = MIN_SPIN - (performance.now() - t0);
    if (left > 0) await sc.wait(left);
    if (!sc.alive) return;
    if (p().haptics) vibrate(ok ? 12 : [16, 60, 16]);
    await frame();
    await frame();
    if (!sc.alive) return;
    const targets = animate && ok ? await findNew() : [];
    if (!sc.alive) return;
    hideNew = false;
    [...fresh].forEach((n) => {
      if (!targets.some((t) => t.n === n)) reveal(n);
    });
    if (targets.length) {
      for (let i = 0; i < N; i++) {
        const r = 1.5 + hash(i, 11) * 3, a = hash(i, 12) * TAU;
        AIM[i * 2] = CW / 2 + Math.cos(a) * r;
        AIM[i * 2 + 1] = dustCy + Math.sin(a) * r;
      }
      flying = true;
      setPhase("done");
      const settle = pull.to(0, SETTLE, CALM);
      await sc.wait(FLY - LAND);
      if (!sc.alive) return;
      const hr = host.getBoundingClientRect(), s = scale();
      const knot = { x: hr.left + CW / 2 * s - 5, y: hr.top + dustCy * s - 5, width: 10, height: 10 };
      const landing = (n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left, y: r.top - (pull.v - sy) * s };
      };
      await Promise.all(targets.map(async ({ n, shot }) => {
        await sc.track(play({ ...shot, ...landing(n), preset: "stream", direction: "in", target: knot, duration: GATHER, grain: 2 })).done;
        if (sc.alive) reveal(n);
      }));
      if (!sc.alive) return;
      await settle;
      flying = false;
    } else {
      setPhase("done");
      const reduced = reducedMotion();
      if (!reduced) await sc.wait(DUST * 0.5);
      if (!sc.alive) return;
      await pull.to(0, reduced ? 200 : SETTLE, CALM);
    }
    before = null;
    setPhase("idle");
  }
  const start = () => {
    busy = refresh().finally(() => {
      busy = null;
    });
    return busy;
  };
  function release() {
    delete host.dataset.pulling;
    armed = false;
    if (phase !== "idle") return;
    if (pull.v >= T()) {
      start();
      return;
    }
    raw = 0;
    pull.to(0, reducedMotion() ? 200 : 380, CALM);
  }
  function move(d) {
    if (d > 0) {
      if (sy > 0) {
        const u = Math.min(sy, d);
        sy -= u;
        d -= u;
      }
      if (d > 0 && phase === "idle") raw += d;
    } else {
      if (raw > 0) {
        const u = Math.min(raw, -d);
        raw -= u;
        d += u;
      }
      if (d < 0) sy = clamp(sy - d, 0, maxScroll());
    }
    if (phase === "idle") pull.set(band(raw));
    else apply();
    track();
  }
  let ptr = null;
  on("pointerdown", (e) => {
    if (busy || e.button > 0) return;
    ptr = { id: e.pointerId, y: e.clientY, s: scale() };
    raw = pull.v < T() ? pull.v : T() + (pull.v - T()) * 2;
    armed = false;
    host.dataset.pulling = "";
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
    }
  });
  const claimed = claimTouch(host, (_dx, dy) => dy > 0 && !!ptr, ac.signal);
  on("pointermove", (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const d = (e.clientY - ptr.y) / ptr.s;
    ptr.y = e.clientY;
    if (e.pointerType === "touch" && !claimed()) return;
    move(d);
  });
  const up = (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    ptr = null;
    release();
  };
  on("pointerup", up);
  on("pointercancel", up);
  let wheelT;
  on("wheel", (e) => {
    if (busy || ptr) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const atTop = sy <= 0 && dy < 0, pulling = raw > 0;
    if (!atTop && !pulling && dy > 0 && sy >= maxScroll()) return;
    e.preventDefault();
    if (atTop || pulling) {
      if (!pulling) armed = false;
      raw = Math.max(0, raw - dy * 0.6);
      pull.set(band(raw));
      track();
      clearTimeout(wheelT);
      wheelT = setTimeout(() => {
        if (raw > 0 && !ptr) release();
      }, 160);
    } else {
      sy = clamp(sy + dy, 0, maxScroll());
      apply();
    }
  }, { passive: false });
  on("keydown", (e) => {
    if (e.target !== host || e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!busy && phase === "idle") {
      pull.set(T());
      start();
    }
  });
  size();
  apply();
  return {
    slot: list,
    update(next) {
      const changed = props.update(next);
      if (changed.has("contentContainerStyle")) containerStyle();
      if (changed.has("color")) {
        readInk();
        kick();
      }
    },
    destroy() {
      sc.dispose();
      ac.abort();
      ro.disconnect();
      clearTimeout(wheelT);
      list.remove();
      cv.remove();
      if (ownTab) host.removeAttribute("tabindex");
      delete host.dataset.pulling;
      delete host.dataset.dissolve;
    }
  };
}
export {
  createPullToRefresh
};
