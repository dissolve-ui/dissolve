// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  DPR
} from "./chunks/chunk-R2UPSOGD.js";
import {
  CALM,
  clamp,
  el,
  injectStyle,
  loop,
  onThemeChange,
  propsOf,
  reducedMotion,
  rgbOf,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/thinking-orb.core.ts
var DEFAULTS = { state: "idle", size: 64, dots: 180, interactive: false, haptics: true };
var TAU = Math.PI * 2;
var GA = Math.PI * (3 - Math.sqrt(5));
var MORPH = 600;
var STAGGER = 1.5;
var FALL = 900;
var FLEE = 40;
var RING_SPD = [21e-4, -16e-4, 12e-4];
var RING_TZ = [0, 1.05, -1.05];
var CHECK = [[-0.52, 0.02], [-0.16, 0.38], [0.56, -0.36]];
var CSS = `
:where([data-dissolve="thinking-orb"]) { position: relative; display: block; flex: none; -webkit-tap-highlight-color: transparent; }
:where(.dissolve-orb-canvas) { display: block; }
`;
var lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
var unit = (c) => {
  const [r, g, b] = rgbOf(c);
  return [r / 255, g / 255, b / 255];
};
function createThinkingOrb(host, initial = {}) {
  injectStyle("dissolve-thinking-orb", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "thinking-orb";
  host.setAttribute("role", "img");
  const cv = el("canvas", "dissolve-orb-canvas");
  host.append(cv);
  const ctx = cv.getContext("2d");
  let S = 0, N = 0, R = 0, DOT = 0;
  let r1 = new Float32Array(0), r2 = new Float32Array(0), fib = new Float32Array(0), check = new Float32Array(0);
  let cur = new Float32Array(0), from = new Float32Array(0), vel = new Float32Array(0), off = new Float32Array(0), offV = new Float32Array(0);
  const tg = new Float32Array(4);
  let colors = null;
  let shape = "idle";
  let t0 = -1e9, fallUntil = 0, level = 0, last = performance.now();
  const epoch = performance.now();
  const ok = value(sc, 0, () => {
  }), bad = value(sc, 0, () => {
  });
  let ptr = null;
  function layout() {
    S = p().size;
    R = S * 0.4;
    DOT = p().dotSize != null ? p().dotSize / 2 : Math.max(1.25, S * 0.0105);
    cv.width = Math.round(S * DPR);
    cv.height = Math.round(S * DPR);
    cv.style.width = cv.style.height = S + "px";
    host.style.width = host.style.height = S + "px";
  }
  function seed() {
    N = Math.max(1, Math.round(p().dots));
    r1 = new Float32Array(N);
    r2 = new Float32Array(N);
    fib = new Float32Array(N * 3);
    check = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      r1[i] = Math.random();
      r2[i] = Math.random();
      const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = i * GA;
      fib[i * 3] = Math.cos(th) * r;
      fib[i * 3 + 1] = y;
      fib[i * 3 + 2] = Math.sin(th) * r;
    }
    const segs = [];
    let tot = 0;
    for (let k = 0; k < 2; k++) {
      const a = CHECK[k], b = CHECK[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push([a, b, l]);
      tot += l;
    }
    for (let i = 0; i < N; i++) {
      let s = (i + 0.5) / N * tot, k = 0;
      while (k < 1 && s > segs[k][2]) {
        s -= segs[k][2];
        k++;
      }
      const [a, b, l] = segs[k], u = s / l, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, j = (r1[i] - 0.5) * 0.11;
      check[i * 3] = a[0] + (b[0] - a[0]) * u + nx * j;
      check[i * 3 + 1] = a[1] + (b[1] - a[1]) * u + ny * j;
      check[i * 3 + 2] = (r2[i] - 0.5) * 0.5;
    }
    cur = new Float32Array(N * 4);
    from = new Float32Array(N * 4);
    vel = new Float32Array(N * 2);
    off = new Float32Array(N * 2);
    offV = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      cur[i * 4] = fib[i * 3];
      cur[i * 4 + 1] = fib[i * 3 + 1];
      cur[i * 4 + 2] = fib[i * 3 + 2];
      cur[i * 4 + 3] = 1;
    }
    from.set(cur);
  }
  function target(st, i, tm, o) {
    let x, y, z, a = 1;
    if (st === "thinking") {
      const r = i % 3, ang = (i / 3 | 0) / (N / 3) * TAU + tm * RING_SPD[r];
      const x0 = Math.cos(ang) * 0.95, z0 = Math.sin(ang) * 0.95;
      const y1 = -z0 * Math.sin(0.45), z1 = z0 * Math.cos(0.45);
      const c2 = Math.cos(RING_TZ[r]), s2 = Math.sin(RING_TZ[r]);
      x = x0 * c2 - y1 * s2;
      y = x0 * s2 + y1 * c2;
      z = z1;
    } else if (st === "searching") {
      const rd = 0.95 * Math.sqrt((i + 0.5) / N), th = i * GA;
      x = Math.cos(th) * rd;
      y = Math.sin(th) * rd;
      let d = (tm / 1e3 * TAU - th) % TAU;
      if (d < 0) d += TAU;
      a = 0.3 + 0.7 * Math.exp(-d * 1.4);
      z = a * 0.6 - 0.3;
    } else if (st === "done") {
      x = check[i * 3];
      y = check[i * 3 + 1];
      z = check[i * 3 + 2];
    } else {
      x = fib[i * 3];
      y = fib[i * 3 + 1];
      z = fib[i * 3 + 2];
      let s = 0.98 + 0.02 * Math.sin(tm / 2400 * TAU);
      if (st === "listening") s = (0.84 + level * 0.2) * (1 + 0.06 * level * Math.sin(y * 5 - tm * 0.012));
      x *= s;
      y *= s;
      z *= s;
    }
    if (st !== "done" && st !== "searching" && st !== "thinking") {
      const ra = tm * 4e-4, c = Math.cos(ra), sn = Math.sin(ra);
      const xr = x * c + z * sn, zr = -x * sn + z * c;
      const cb = Math.cos(0.3), sb = Math.sin(0.3);
      x = xr;
      z = y * sb + zr * cb;
      y = y * cb - zr * sb;
    }
    o[0] = x;
    o[1] = y;
    o[2] = z;
    o[3] = a;
  }
  function go(next) {
    if (next === shape && next !== "error") return;
    from.set(cur);
    shape = next;
    t0 = performance.now();
    ok.to(next === "done" ? 1 : 0, 600, CALM);
    if (next === "error") {
      bad.to(1, 150, CALM);
      for (let i = 0; i < N; i++) {
        vel[i * 2] = (r1[i] - 0.5) * 0.7;
        vel[i * 2 + 1] = -r2[i] * 0.6;
      }
      fallUntil = t0 + (reducedMotion() ? 0 : FALL);
    } else bad.to(0, 500, CALM);
  }
  function inputLevel(tm) {
    const l = p().level;
    if (l == null) return clamp(0.3 + 0.35 * Math.sin(tm * 47e-4) * Math.sin(tm * 13e-4 + 1) + 0.3 * Math.abs(Math.sin(tm * 0.011)));
    return clamp(typeof l === "number" ? l : l.value);
  }
  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1e3);
    last = now;
    const red = reducedMotion(), tm = red ? 0 : now - epoch;
    const dur = red ? 150 : MORPH, stg = red ? 0 : STAGGER;
    level += (inputLevel(tm) - level) * 0.15;
    if (shape === "error" && fallUntil && now >= fallUntil) {
      fallUntil = 0;
      go("idle");
    }
    if (!colors) {
      colors = {
        fg: unit(p().color ?? token(host, "foreground", "rgb(28 28 30)")),
        ok: unit(token(host, "success", "rgb(52 199 89)")),
        bad: unit(token(host, "danger", "rgb(255 59 48)"))
      };
    }
    const col = lerp3(lerp3(colors.fg, colors.ok, ok.v), colors.bad, bad.v);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = `rgb(${col.map((v) => Math.round(v * 255)).join(",")})`;
    const falling = shape === "error" && fallUntil;
    const flee = ptr && !red && p().interactive ? ptr : null;
    for (let i = 0; i < N; i++) {
      const k4 = i * 4;
      if (falling) {
        vel[i * 2 + 1] += 4.2 * dt;
        cur[k4] += vel[i * 2] * dt;
        cur[k4 + 1] += vel[i * 2 + 1] * dt;
        if (cur[k4 + 1] > 1.05) {
          cur[k4 + 1] = 1.05;
          vel[i * 2 + 1] *= -0.28;
          vel[i * 2] *= 0.7;
        }
      } else {
        target(shape, i, tm, tg);
        const e = CALM(clamp((now - t0 - i * stg) / dur));
        for (let c = 0; c < 4; c++) cur[k4 + c] = from[k4 + c] + (tg[c] - from[k4 + c]) * e;
      }
      let px = S / 2 + cur[k4] * R, py = S / 2 + cur[k4 + 1] * R;
      let gx = 0, gy = 0;
      if (flee) {
        const dx = px - flee.x, dy = py - flee.y, d2 = Math.hypot(dx, dy);
        if (d2 < FLEE && d2 > 0.01) {
          gx = dx / d2 * (FLEE - d2) * 0.8;
          gy = dy / d2 * (FLEE - d2) * 0.8;
        }
      }
      for (let c = 0; c < 2; c++) {
        const j = i * 2 + c, to = c ? gy : gx;
        offV[j] += (260 * (to - off[j]) - 22 * offV[j]) * dt;
        off[j] += offV[j] * dt;
      }
      px += off[i * 2];
      py += off[i * 2 + 1];
      const d = clamp((cur[k4 + 2] + 1) / 2);
      ctx.globalAlpha = (0.38 + 0.62 * d) * cur[k4 + 3];
      ctx.beginPath();
      ctx.arc(px, py, DOT * (0.8 + 0.4 * d), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const local = (e) => {
    const b = cv.getBoundingClientRect(), s = b.width / S || 1;
    return { x: (e.clientX - b.left) / s, y: (e.clientY - b.top) / s };
  };
  const onMove = (e) => {
    ptr = local(e);
  };
  const onLeave = () => {
    ptr = null;
  };
  const onUp = (e) => {
    if (e.pointerType !== "mouse") ptr = null;
  };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerdown", onMove);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onLeave);
  function decorate() {
    host.setAttribute("aria-label", `Assistant ${p().state}`);
    host.style.touchAction = p().interactive ? "pan-y" : "";
  }
  onThemeChange(sc, () => {
    colors = null;
  });
  layout();
  seed();
  decorate();
  shape = p().state;
  if (shape === "done") ok.set(1);
  loop(sc, cv, draw);
  return {
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      if (changed.has("size") || changed.has("dotSize")) layout();
      if (changed.has("dots")) {
        seed();
        t0 = -1e9;
      }
      if (changed.has("color")) colors = null;
      if (changed.has("state")) {
        const st = p().state;
        if (p().haptics && st === "done") vibrate(10);
        if (p().haptics && st === "error") vibrate([20, 60, 20]);
        go(st);
      }
      decorate();
    },
    destroy() {
      sc.dispose();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onLeave);
      cv.remove();
      delete host.dataset.dissolve;
      host.removeAttribute("role");
      host.removeAttribute("aria-label");
      for (const k of ["width", "height", "touch-action"]) host.style.removeProperty(k);
    }
  };
}
export {
  createThinkingOrb
};
