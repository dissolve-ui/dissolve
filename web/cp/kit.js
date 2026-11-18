// Shared kit for the web ports of the ready-made components and the demo pages: curves, springs,
// a disposal scope, theme and canvas primitives, small DOM helpers. Every module of the site builds on it.
import { play, snapshot, DPR } from '../engine/atlas.js';
import { IMG, FONT, cover } from '../images.js';
import { PKG } from '../variants-content.js';

export { play, snapshot, DPR, IMG, FONT, cover, PKG };

/* ======================================================================================
   Theme and canvas primitives.
   ====================================================================================== */

export const isLight = () => document.documentElement.dataset.theme === 'light';
export const pal = () => isLight()
  ? { card: '#FFFFFF', ink: '#12151A', text: '#535A64', muted: '#8E959F', line: 'rgba(0,0,0,0.08)', them: '#EEF0F3', me: '#2F63E0', meText: '#FFFFFF' }
  : { card: '#1E2024', ink: '#F2F4F7', text: '#A9AFB8', muted: '#858B94', line: 'rgba(255,255,255,0.07)', them: '#26292E', me: '#3A6FE6', meText: '#FFFFFF' };

/** Calls fn whenever the site theme flips. Stops with the scope (if any) or the returned function. */
export function onTheme(sc, fn) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const off = () => mo.disconnect();
  sc?.onDispose(off);
  return off;
}

/** Draws fn(ctx) again, in place, into a canvas made by snapshot() (a theme switch). */
export function redraw(c, fn) {
  const x = c.getContext('2d');
  x.reset();
  x.scale(DPR, DPR);
  fn(x);
}

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function text(ctx, str, x, y, { size = 14, weight = 400, color, align = 'left', mono = false } = {}) {
  ctx.font = `${weight} ${size}px ${mono ? "'Geist Mono', monospace" : FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

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

/* ======================================================================================
   Content helpers: props tables and usage snippets of the component pages.
   ====================================================================================== */

export const DIR = '@/components/dissolve';
export const prop = (name, type, def, desc) => ({ name, type, def, desc });
/** A usage snippet: the add command, the import, then the usage. */
export const add = (id, name, usage) => `// npx ${PKG} add ${id}
import { ${name} } from '${DIR}/${id}';

${usage}`;

/* ======================================================================================
   DOM and canvas helpers.
   ====================================================================================== */

export const el = (tag, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
export const rectOf = (node) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
/** rectOf with the node itself as the source: what play() takes for a canvas already on screen. */
export const boxOf = (node) => ({ source: node, ...rectOf(node) });
export const hide = (node) => { node.style.transition = 'none'; node.style.opacity = '0'; };
export const show = (node, fade = true) => { node.style.transition = fade ? '' : 'none'; node.style.opacity = '1'; };
export const frame = () => new Promise(requestAnimationFrame);

/** Width of a tile body inside its padding. */
export function availW(body) {
  const cs = getComputedStyle(body);
  return body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/** Scales a node of natural size (w, h) down to fit the tile body. */
export function fitTile(body, node, w, h) {
  const cs = getComputedStyle(body);
  const ah = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const s = Math.min(1, availW(body) / w, ah / h);
  const box = el('div', 'cp-fit');
  box.style.width = w * s + 'px';
  box.style.height = h * s + 'px';
  node.style.transform = `scale(${s})`;
  node.style.transformOrigin = '0 0';
  box.append(node);
  return box;
}

/** Tracks whether node is on screen. on: the current state; shown() resolves once it is. */
export function onScreen(sc, node, onChange) {
  let waiting = [];
  const st = {
    on: true,
    shown: () => (st.on ? Promise.resolve() : new Promise((res) => waiting.push(res))),
  };
  const io = new IntersectionObserver(([e]) => {
    st.on = e.isIntersecting;
    if (st.on) { waiting.forEach((res) => res()); waiting = []; }
    onChange?.(st.on);
  });
  io.observe(node);
  sc.onDispose(() => io.disconnect());
  return st;
}

/**
 * Calls fn once the node's width has settled at least `min` px away from the width it had at the
 * last call (or at the start). A hidden node (width 0) is ignored. Stops with the scope or the
 * returned function.
 */
export function onWidth(sc, node, fn, { min = 40, delay = 250 } = {}) {
  let w = node.clientWidth, t = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      const now = node.clientWidth;
      if (!now || Math.abs(now - w) < min) return;
      w = now;
      fn();
    }, delay);
  });
  ro.observe(node);
  const off = () => { ro.disconnect(); clearTimeout(t); };
  sc?.onDispose(off);
  return off;
}

/** rAF loop that sleeps while the node is off screen or while active() is false. kick() wakes it. */
export function loop(sc, node, fn, active = () => true) {
  let raf = 0;
  const tick = (now) => {
    raf = 0;
    if (!sc.alive) return;
    fn(now);
    if (seen.on && active()) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && sc.alive) raf = requestAnimationFrame(tick); };
  const seen = onScreen(sc, node, (on) => on && kick());
  kick();
  sc.onDispose(() => cancelAnimationFrame(raf));
  return { kick };
}

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

/**
 * Canvas replica of a node as it looks right now, for the dust. Each part is drawn where it sits,
 * relative to root, in layout units (a tile scaled down by fitTile is drawn at its on screen size):
 *   { node, fill: true, radius }      the node's background color, rounded ('pill' for h / 2)
 *   { node, text, align, fit }        a line in the node's font and color, vertically centered;
 *                                     text defaults to the node's own, fit: true ends it with an ellipsis
 *   { node, draw(ctx, box, node) }    anything else, box = { x, y, w, h }
 * size: { w, h } of the canvas in layout units, the root's own by default. scale: on screen size
 * over layout size, measured on the root by default (pass 1 for a root that is only lifted or tilted).
 */
export function snapNode(root, parts, { size, scale } = {}) {
  const r = root.getBoundingClientRect(), s = scale ?? (r.width / root.offsetWidth || 1);
  const W = size?.w ?? r.width / s, H = size?.h ?? r.height / s;
  return snapshot(W * s, H * s, (ctx) => {
    ctx.scale(s, s);
    for (const p of parts) {
      if (!p?.node) continue;
      const b = p.node.getBoundingClientRect(), cs = getComputedStyle(p.node);
      const box = { x: (b.left - r.left) / s, y: (b.top - r.top) / s, w: b.width / s, h: b.height / s };
      if (p.fill) {
        rr(ctx, box.x, box.y, box.w, box.h, p.radius === 'pill' ? box.h / 2 : p.radius ?? 0);
        ctx.fillStyle = cs.backgroundColor;
        ctx.fill();
      }
      if (p.text !== undefined || (!p.fill && !p.draw)) {
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${FONT}`;
        ctx.fillStyle = cs.color;
        ctx.textAlign = p.align ?? 'left';
        ctx.textBaseline = 'middle';
        const str = p.text ?? p.node.textContent;
        const x = p.align === 'right' ? box.x + box.w : p.align === 'center' ? box.x + box.w / 2 : box.x;
        ctx.fillText(p.fit ? fit(ctx, str, box.w + 1) : str, x, box.y + box.h / 2 + 0.5);
        ctx.textAlign = 'left';
      }
      p.draw?.(ctx, box, p.node);
    }
  });
}

export function label(ctx, str, x, y, size, weight, color, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

