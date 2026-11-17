// Shared kit for the web ports of the ready-made components: curves, springs, a disposal scope,
// small DOM and canvas helpers. Every component module (components.js, cp/*.js) builds on it.
import { play, snapshot } from '../engine/atlas.js';
import { IMG, FONT, cover } from '../images.js';
import { pal, rr, isLight } from '../showcase.js';

export { play, snapshot, IMG, FONT, cover, pal, rr, isLight };

/* ======================================================================================
   Motion helpers: cubic bezier, springs, a scope that stops everything on page change.
   ====================================================================================== */

export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-4) {
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return Y(t);
  };
}

export const CALM = bezier(0.32, 0.72, 0, 1); // iOS sheet curve
export const SPLIT = bezier(0.45, 0, 0.2, 1); // SplitButton SOFT
export const QUAD = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2); // Reanimated withTiming default
export const IN_OUT_CUBIC = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const OUT_CUBIC = (t) => 1 - (1 - t) ** 3;

/** Timers, frames and bursts of one mounted demo. dispose() stops all of it. */
export function scope() {
  const timers = new Set(), handles = new Set(), fns = [];
  const sc = {
    alive: true,
    wait: (ms) => new Promise((res) => {
      const t = setTimeout(() => { timers.delete(t); if (sc.alive) res(); }, ms);
      timers.add(t);
    }),
    track(h) { handles.add(h); h.done.then(() => handles.delete(h)); return h; },
    onDispose(fn) { fns.push(fn); },
    dispose() {
      sc.alive = false;
      timers.forEach(clearTimeout);
      handles.forEach((h) => h.cancel());
      fns.forEach((f) => f());
    },
  };
  return sc;
}

/**
 * An animated number. to() runs a timed curve, spring() a damped spring (semi implicit Euler,
 * small fixed steps). A newer animation supersedes the running one, whose promise resolves false.
 */
export function value(sc, v0, onChange) {
  let id = 0;
  const a = {
    v: v0, vel: 0,
    set(x) { id++; a.v = x; a.vel = 0; onChange(); },
    to(to, ms, ease = CALM, delay = 0) {
      const my = ++id, from = a.v;
      return new Promise((res) => {
        const t0 = performance.now() + delay;
        let lastT = t0;
        const f = (now) => {
          if (my !== id) return res(false);
          if (!sc.alive) return;
          if (now < t0) return requestAnimationFrame(f);
          const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
          const prev = a.v;
          a.v = from + (to - from) * ease(k);
          const dt = (now - lastT) / 1000;
          a.vel = dt > 0 ? (a.v - prev) / dt : 0;
          lastT = now;
          onChange();
          if (k < 1) requestAnimationFrame(f);
          else { a.vel = 0; res(true); }
        };
        requestAnimationFrame(f);
      });
    },
    spring(to, { stiffness = 260, damping = 31, mass = 1, eps = 0.02 } = {}) {
      const my = ++id;
      return new Promise((res) => {
        let last = performance.now();
        const f = (now) => {
          if (my !== id) return res(false);
          if (!sc.alive) return;
          let dt = Math.min(0.064, (now - last) / 1000);
          last = now;
          while (dt > 0) {
            const h = Math.min(1 / 480, dt);
            a.vel += ((-stiffness * (a.v - to) - damping * a.vel) / mass) * h;
            a.v += a.vel * h;
            dt -= h;
          }
          if (Math.abs(a.v - to) < eps && Math.abs(a.vel) < eps * 10) { a.v = to; a.vel = 0; onChange(); return res(true); }
          onChange();
          requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      });
    },
  };
  return a;
}

export const el = (tag, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
export const rectOf = (node) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
export const frame = () => new Promise(requestAnimationFrame);

/**
 * Touch on a `touch-action: pan-y` surface: a vertical swipe scrolls the page unless
 * want(dx, dy) claims it on its first move. A claimed touch keeps the page still to its end.
 * Returns () => whether the touch in progress is claimed.
 */
export function claimTouch(node, want) {
  let t = null;
  node.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    t = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, on: null } : null;
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (!t) return;
    if (t.on === null) {
      const p = e.touches[0], dx = p.clientX - t.x, dy = p.clientY - t.y;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      t.on = Math.abs(dy) >= Math.abs(dx) && !!want(dx, dy);
    }
    if (t.on && e.cancelable) e.preventDefault();
  }, { passive: false });
  const off = () => { t = null; };
  node.addEventListener('touchend', off);
  node.addEventListener('touchcancel', off);
  return () => !!t?.on;
}

export function fit(ctx, str, maxW) {
  if (ctx.measureText(str).width <= maxW) return str;
  let out = str;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

export function label(ctx, str, x, y, size, weight, color, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

