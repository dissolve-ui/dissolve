// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  bezier,
  clamp,
  el,
  hash,
  injectStyle,
  loop,
  onThemeChange,
  propsOf,
  reducedMotion,
  rgbOf,
  scope,
  token,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/progress-steps.core.ts
var PROGRESS_STEPS_SIZES = {
  sm: { disc: 20, line: 2, font: 11, label: 12, ring: 3 },
  md: { disc: 26, line: 3, font: 12, label: 13, ring: 4 },
  lg: { disc: 32, line: 3, font: 14, label: 14, ring: 5 }
};
var DEFAULTS = { steps: 3, current: 0, size: "md", haptics: true };
var STAGGER = 120;
var RUN = 300;
var HOP = 110;
var LAND = 110;
var FADE = 90;
var WINDOW = 0.18;
var PLAIN = 280;
var FLATTEN = 0.85;
var SHRINK = 0.45;
var MAX_GRAINS = 90;
var PITCH = 0.14;
var OVERLAP = 1.25;
var GAP = 4;
var PAD = 8;
var SF = 3;
var FLOW = bezier(0.42, 0, 0.12, 1);
function grainGrid(d) {
  let pitch = Math.max(3, d * PITCH);
  for (; ; ) {
    const cols = Math.max(3, Math.round(d / pitch)), p = d / cols, r = d / 2, out = [];
    for (let j = 0; j < cols; j++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * p - r, y = (j + 0.5) * p - r;
      if (x * x + y * y > (r - p * 0.3) ** 2) continue;
      const k = out.length;
      out.push([x, y, hash(k, 4), hash(k, 6)]);
    }
    if (out.length <= MAX_GRAINS) return { grid: out, dot: p * OVERLAP };
    pitch *= 1.15;
  }
}
function levelsFor(n, cur) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i <= cur ? 1 : 0, i < cur ? 1 : 0, i === cur ? 1 : 0);
  for (let k = 0; k < n - 1; k++) out.push(k < cur ? 1 : 0);
  return out;
}
var CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 8.4 6.6 11.3 12.4 4.9"/></svg>';
var CSS = `
:where([data-dissolve="progress-steps"]) { position: relative; -webkit-user-select: none; user-select: none; }
:where(.dissolve-steps-row) { position: relative; }
:where(.dissolve-steps-row) > * { position: absolute; }
:where(.dissolve-steps-line) { border-radius: 999px; }
:where(.dissolve-steps-fill) { transform-origin: left center; will-change: transform; }
:where(.dissolve-steps-disc) { display: flex; align-items: center; justify-content: center; border-radius: 50%; box-sizing: border-box; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; }
:where(.dissolve-steps-hollow) { color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-steps-solid) { will-change: transform, opacity; font-weight: 700; }
:where(.dissolve-steps-solid) > * { position: absolute; }
:where(.dissolve-steps-check) { width: 58%; height: 58%; }
:where(.dissolve-steps-check) svg { display: block; width: 100%; height: 100%; }
:where(.dissolve-steps-ring) { border-radius: 50%; will-change: transform, opacity; }
:where(.dissolve-steps-grains) { pointer-events: none; }
:where(.dissolve-steps-labels) { display: flex; margin-top: 8px; }
:where(.dissolve-steps-label) {
  flex: 1; min-width: 0; padding: 0 2px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.006em; color: var(--dissolve-muted, rgb(142 142 147)); font-weight: 500;
}
:where(.dissolve-steps-label.is-reached) { color: var(--dissolve-foreground, rgb(28 28 30)); }
:where(.dissolve-steps-label.is-current) { font-weight: 600; }
:where(.dissolve-steps-hit) { position: absolute; top: 0; bottom: 0; }
:where(.dissolve-steps-hit:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: -2px; border-radius: 8px; }
`;
var BUTTON = { border: "0", padding: "0", margin: "0", background: "none", cursor: "pointer", font: "inherit", color: "inherit" };
function createProgressSteps(host, initial = {}) {
  injectStyle("dissolve-progress-steps", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "progress-steps";
  host.setAttribute("role", "progressbar");
  const row = el("div", "dissolve-steps-row");
  const cv = el("canvas", "dissolve-steps-grains");
  const ctx = cv.getContext("2d");
  const labelsRow = el("div", "dissolve-steps-labels");
  const hits = el("div");
  hits.style.cssText = "position:absolute;inset:0;pointer-events:none";
  host.append(row, labelsRow, hits);
  let n = 2, labels = null;
  let W = 0, rowH = 0, s = PROGRESS_STEPS_SIZES.md, dpr = 1;
  let X = [];
  let nodes = [], fills = [], texts = [];
  let grid = [], dot = 0, M = 0;
  let D = new Float32Array(0), F = new Float32Array(0);
  let L = [], LF = [];
  let target = 0, origin = 0, req = false, flying = false, startAt = 0;
  let active = "#000", ink = "#fff";
  const clampCur = (c) => Math.max(0, Math.min(n, Math.round(c ?? 0)));
  function paint() {
    const o = p();
    const bg = rgbOf(token(host, "background", "rgb(255 255 255)")), fg = rgbOf(token(host, "foreground", "rgb(28 28 30)"));
    const dark = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255 < 0.5;
    active = o.activeColor ?? token(host, "primary", "rgb(28 28 30)");
    ink = token(host, "primary-foreground", "rgb(255 255 255)");
    const track = o.trackColor ?? `rgba(${fg[0]}, ${fg[1]}, ${fg[2]}, ${dark ? 0.22 : 0.13})`;
    const a = rgbOf(active);
    for (const t of nodes) {
      t.hollow.style.borderColor = track;
      t.solid.style.background = active;
      t.solid.style.color = ink;
      t.ring.style.background = `rgba(${a[0]}, ${a[1]}, ${a[2]}, 0.2)`;
    }
    row.querySelectorAll(".dissolve-steps-track").forEach((x) => {
      x.style.background = track;
    });
    for (const f of fills) f.style.background = active;
  }
  function build() {
    const o = p();
    s = PROGRESS_STEPS_SIZES[o.size] ?? PROGRESS_STEPS_SIZES.md;
    labels = typeof o.steps === "number" ? null : o.steps;
    n = Math.max(2, typeof o.steps === "number" ? Math.floor(o.steps) : o.steps.length);
    rowH = s.disc + s.ring * 2;
    row.replaceChildren();
    nodes = [];
    fills = [];
    for (let k = 0; k < n - 1; k++) {
      const track = el("div", "dissolve-steps-line dissolve-steps-track"), fill = el("div", "dissolve-steps-line dissolve-steps-fill");
      row.append(track, fill);
      fills.push(fill);
    }
    for (let i = 0; i < n; i++) {
      const ring = el("div", "dissolve-steps-ring");
      const hollow = el("div", "dissolve-steps-disc dissolve-steps-hollow", String(i + 1));
      const solid = el("div", "dissolve-steps-disc dissolve-steps-solid");
      const num = el("span", "", String(i + 1)), check = el("span", "dissolve-steps-check", CHECK);
      solid.append(num, check);
      row.append(ring, hollow, solid);
      nodes.push({ ring, hollow, solid, num, check });
    }
    row.append(cv);
    row.style.height = rowH + "px";
    labelsRow.replaceChildren();
    texts = [];
    labelsRow.hidden = !labels;
    if (labels) {
      for (const text of labels) {
        const t = el("span", `dissolve-steps-label ${o.labelClassName ?? ""}`.trim());
        t.textContent = text;
        t.style.fontSize = s.label + "px";
        labelsRow.append(t);
        texts.push(t);
      }
    }
    buildHits();
    ({ grid, dot } = grainGrid(s.disc));
    M = grid.length;
    D = new Float32Array(M * 4);
    F = new Float32Array(M * 4);
    host.setAttribute("aria-valuemin", "0");
    host.setAttribute("aria-valuemax", String(n));
  }
  function buildHits() {
    hits.replaceChildren();
    if (!p().onStepPress) return;
    for (let i = 0; i < n; i++) {
      const b = el("button", "dissolve-steps-hit");
      b.type = "button";
      Object.assign(b.style, BUTTON, { left: `${i / n * 100}%`, width: `${100 / n}%`, pointerEvents: "auto" });
      b.setAttribute("aria-label", labels?.[i] ?? `Step ${i + 1}`);
      b.addEventListener("click", () => p().onStepPress?.(i));
      hits.append(b);
    }
  }
  function layout() {
    W = host.clientWidth;
    if (W <= 0) return;
    const col = W / n, d = s.disc, outer = d + s.ring * 2, cy = rowH / 2;
    X = Array.from({ length: n }, (_, i) => (i + 0.5) * col);
    const box = (node, x, size) => Object.assign(node.style, { left: x - size / 2 + "px", top: cy - size / 2 + "px", width: size + "px", height: size + "px" });
    nodes.forEach((t, i) => {
      box(t.ring, X[i], outer);
      box(t.hollow, X[i], d);
      box(t.solid, X[i], d);
      t.hollow.style.borderWidth = Math.max(1.5, d * 0.07) + "px";
      t.hollow.style.borderStyle = "solid";
      t.hollow.style.fontSize = t.solid.style.fontSize = s.font + "px";
    });
    const lines = row.querySelectorAll(".dissolve-steps-line");
    for (let k = 0; k < n - 1; k++) {
      const x0 = X[k] + d / 2 + GAP, w = Math.max(0, col - d - GAP * 2);
      for (const l of [lines[k * 2], lines[k * 2 + 1]]) Object.assign(l.style, { left: x0 + "px", top: cy - s.line / 2 + "px", width: w + "px", height: s.line + "px" });
    }
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round((rowH + PAD * 2) * dpr);
    cv.style.cssText = `left:0;top:${-PAD}px;width:${W}px;height:${rowH + PAD * 2}px`;
    flying = req = false;
    origin = target;
    L = levelsFor(n, target);
    LF = L.slice();
    ctx.clearRect(0, 0, cv.width, cv.height);
    apply();
  }
  function apply() {
    nodes.forEach((t, i) => {
      const fill = L[i * SF] ?? 0, check = L[i * SF + 1] ?? 0, ring = L[i * SF + 2] ?? 0;
      t.solid.style.opacity = String(fill);
      t.solid.style.transform = `scale(${0.6 + 0.4 * fill})`;
      t.num.style.opacity = String(1 - check);
      t.check.style.opacity = String(check);
      t.check.style.transform = `scale(${0.5 + 0.5 * check})`;
      t.ring.style.opacity = String(ring);
      t.ring.style.transform = `scale(${0.7 + 0.3 * ring})`;
    });
    fills.forEach((f, k) => {
      f.style.transform = `scaleX(${Math.max(1e-4, L[n * SF + k] ?? 0)})`;
    });
  }
  function syncLabels() {
    texts.forEach((t, i) => {
      t.classList.toggle("is-reached", i <= target);
      t.classList.toggle("is-current", i === target);
    });
    host.setAttribute("aria-valuenow", String(target));
    if (labels?.[target]) host.setAttribute("aria-valuetext", labels[target]);
    else host.removeAttribute("aria-valuetext");
  }
  function frame(now) {
    if (!req && !flying) return;
    if (X.length !== n) {
      req = flying = false;
      return;
    }
    const reduced = reducedMotion(), b = target, cy = rowH / 2 + PAD;
    if (req) {
      req = false;
      LF = L.slice();
      if (flying && !reduced) {
        F.set(D);
        let cx = 0;
        for (let i = 0; i < M; i++) cx += D[i * 4];
        cx /= Math.max(1, M);
        origin = X.reduce((best, x, i) => Math.abs(x - cx) < Math.abs(X[best] - cx) ? i : best, 0);
      } else {
        const ax0 = X[Math.min(n - 1, origin)];
        for (let i = 0; i < M; i++) {
          F[i * 4] = ax0 + grid[i][0];
          F[i * 4 + 1] = grid[i][1];
          F[i * 4 + 2] = origin < n ? 1 : 0;
          F[i * 4 + 3] = 1;
        }
      }
      startAt = now;
      flying = true;
    }
    const a = origin, ax = X[Math.min(n - 1, a)], bx = X[Math.min(n - 1, b)];
    const run = RUN + HOP * (Math.max(1, Math.abs(b - a)) - 1);
    const total = STAGGER + run * 1.15 + FADE;
    const since = now - startAt;
    const goal = levelsFor(n, b);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, rowH + PAD * 2);
    if (reduced || b >= n || a >= n) {
      const k = FLOW(clamp(since / PLAIN));
      for (let i = 0; i < L.length; i++) L[i] = LF[i] + (goal[i] - LF[i]) * k;
      if (since >= PLAIN) {
        flying = false;
        origin = b;
      }
      return apply();
    }
    const pk = FLOW(clamp(since / (STAGGER * 0.5 + run)));
    const front = ax + (bx - ax) * pk;
    const dir = bx >= ax ? 1 : -1;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (i >= lo && i <= hi) {
        const at = Math.abs(X[i] - ax) / (Math.abs(bx - ax) + 1e-3);
        k = i === b ? clamp((since - (STAGGER * 0.5 + run - LAND)) / LAND) : clamp((pk - at * (1 - WINDOW)) / WINDOW);
      }
      for (let f = 0; f < SF; f++) L[i * SF + f] = LF[i * SF + f] + (goal[i * SF + f] - LF[i * SF + f]) * k;
    }
    for (let k = 0; k < n - 1; k++) {
      const o = n * SF + k;
      if (k < lo || k >= hi) {
        L[o] = goal[o];
        continue;
      }
      const x0 = X[k] + s.disc / 2 + GAP, x1 = X[k + 1] - s.disc / 2 - GAP;
      L[o] = clamp((front - x0) / (x1 - x0 + 1e-3));
    }
    const out = clamp((since - (total - FADE)) / FADE);
    ctx.fillStyle = active;
    for (let i = 0; i < M; i++) {
      const g = grid[i], o = i * 4;
      const u = (g[0] / s.disc + 0.5) * dir;
      const delay = (0.5 - u * 0.5) * STAGGER * 0.6 + g[2] * STAGGER * 0.4;
      const e = FLOW(clamp((since - delay) / (run * (0.85 + 0.3 * hash(i, 9))))), bump = Math.sin(Math.PI * e);
      D[o] = F[o] + (bx + g[0] - F[o]) * e;
      D[o + 1] = (F[o + 1] + (g[1] - F[o + 1]) * e) * (1 - FLATTEN * bump) + (g[3] - 0.5) * s.line * bump;
      D[o + 2] = (F[o + 2] + (1 - F[o + 2]) * clamp(since / 60)) * (1 - out);
      D[o + 3] = (F[o + 3] + (1 - F[o + 3]) * e) * (1 - SHRINK * bump);
      if (D[o + 2] <= 3e-3) continue;
      ctx.globalAlpha = D[o + 2];
      ctx.beginPath();
      ctx.arc(D[o], D[o + 1] + cy, dot * D[o + 3] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (since >= total) {
      flying = false;
      origin = b;
      for (let i = 0; i < M; i++) D[i * 4 + 2] = 0;
      ctx.clearRect(0, 0, W, rowH + PAD * 2);
      L = goal;
    }
    apply();
  }
  const { kick } = loop(sc, host, frame, () => req || flying);
  function go(c) {
    if (c === target) return;
    target = c;
    req = true;
    syncLabels();
    kick();
    if (p().haptics) vibrate(4);
  }
  const ro = new ResizeObserver(() => {
    if (host.clientWidth !== W) layout();
  });
  ro.observe(host);
  onThemeChange(sc, () => {
    paint();
    kick();
  });
  build();
  target = origin = clampCur(p().current);
  syncLabels();
  paint();
  layout();
  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("steps") || changed.has("size") || changed.has("labelClassName")) {
        const same = !changed.has("size") && !changed.has("labelClassName") && JSON.stringify(p().steps) === JSON.stringify(labels ?? n);
        if (!same) {
          build();
          target = origin = clampCur(p().current);
          syncLabels();
          paint();
          layout();
        }
      }
      if (changed.has("onStepPress") && !!p().onStepPress !== hits.childElementCount > 0) buildHits();
      if (changed.has("current")) go(clampCur(p().current));
      if (changed.has("activeColor") || changed.has("trackColor")) {
        paint();
        kick();
      }
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      row.remove();
      labelsRow.remove();
      hits.remove();
      for (const a of ["role", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext", "data-dissolve"]) host.removeAttribute(a);
    }
  };
}
export {
  PROGRESS_STEPS_SIZES,
  createProgressSteps
};
