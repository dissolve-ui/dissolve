/**
 * ReorderList for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (reorder-list.tsx) wraps it; it also runs on its own:
 *
 *   const list = createReorderList(box, { data: tasks, keyExtractor: (t) => t.id, onReorder: (next) => (tasks = next) });
 *   tasks.forEach((t) => (list.row(t.id).textContent = t.title));
 *   list.update({ data: tasks });
 *
 * A list you reorder by drag, like Reminders or Things. Long press a row (250 ms) or grab an
 * element marked data-reorder-handle: it lifts, grows a shadow, leans a little with the pointer's
 * sideways speed and follows it 1:1. The other rows slide out of the way on the calm curve, and
 * the list scrolls by itself near its edges. Release: the row settles critically damped, then
 * onReorder runs. A faint trail of grains stays at the slot it left, a small puff marks the one
 * it lands in. With onDelete, drag a row far to the side and release: it turns to dust. Alt and
 * the arrow keys move the focused row. Same timings and curves as the React Native version.
 *
 * Rows are absolutely positioned from their measured heights, so they can differ. Space them with
 * `gap`, not vertical margins. Give the host a height (or a max-height) to make the list scroll.
 * The lift shadow reads --dissolve-reorder-shadow (its opacity, default 0.18) and an inner ring
 * --dissolve-reorder-ring (a color, none by default).
 */
import { play } from './engine';
import { CALM, capture, clamp, el, injectStyle, propsOf, reducedMotion, scope, token, value, vibrate, type Value } from './kit';

export type ReorderListProps<T> = {
  /** The rows, in order. */
  data: T[];
  /** A stable key per row. Rows are positioned by key. */
  keyExtractor: (item: T, index: number) => string;
  /** Called once the dropped row has settled, with the reordered copy of data. */
  onReorder?: (data: T[], from: number, to: number) => void;
  /** Enables drag far to the side to delete: the row turns to dust, then this runs. */
  onDelete?: (item: T, index: number) => void;
  /** Exit used by onDelete, an engine preset. Default 'dust'. */
  preset?: string;
  /** Hold before a row lifts, ms. Default 250. */
  longPressDelay?: number;
  /** Drag only from a data-reorder-handle element inside the row. Default false: long press anywhere (a handle still lifts at once). */
  handle?: boolean;
  /** Space between rows, px. Default 0. */
  gap?: number;
  /** Short vibrations on lift, per slot and on drop, where the browser has them. Default true. */
  haptics?: boolean;
  /** Trail and puff of grains. Off with reduced motion. Default true. */
  grains?: boolean;
  /** Styles of the scroll content (padding...). Numbers are px. */
  contentContainerStyle?: Record<string, string | number>;
  /** Row surface classes (background, radius...). */
  itemClassName?: string;
  /** The key of the lifted row, then null once it has settled. */
  onDragChange?: (key: string | null) => void;
};

export type ReorderListInstance<T = unknown> = {
  /** The row of a key: put its content here. Created on first ask, placed once data has the key. */
  row: (key: string) => HTMLElement;
  /** Scrolls above the rows. */
  header: HTMLElement;
  /** Scrolls below the rows. */
  footer: HTMLElement;
  update: (props: Partial<ReorderListProps<T>>) => void;
  destroy: () => void;
};

const DEFAULTS = { preset: 'dust', longPressDelay: 250, handle: false, gap: 0, haptics: true, grains: true };

/** Rows making room. */
const SLIDE = 300;
/** Critically damped: lands without overshoot. */
const SETTLE = { stiffness: 420, damping: 41, mass: 1, eps: 0.05 };
const LIFT_SCALE = 0.03;
/** Lean of the lifted row, in degrees, at full sideways speed. */
const MAX_TILT = 3;
/** Auto scroll: band at the top and bottom of the list, and top speed in px/s. */
const EDGE = 56;
const MAX_SPEED = 900;
/** With onDelete: fraction of the width to drag sideways before a release deletes. */
const DELETE_AT = 0.42;
/** Grain pool. Per grain: x, y, vx, vy, born, life, size, alpha, delay. */
const GRAINS = 72;
/** Room around the list for the grains, so a puff at the first or last edge is not cut. */
const PAD = 18;
const UNITLESS = new Set(['opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'order', 'fontWeight', 'lineHeight']);

const IDLE = 0, DRAG = 1, DROP = 2, DELETE = 3;

const CSS = `
:where([data-dissolve="reorder-list"]) { position: relative; display: flex; flex-direction: column; }
:where(.dissolve-reorder-scroll) { position: relative; flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
:where(.dissolve-reorder-scroll)::-webkit-scrollbar { display: none; }
:where(.dissolve-reorder-list) { position: relative; }
:where([data-reorder-row]) {
  position: absolute; left: 0; right: 0; top: 0; box-sizing: border-box; background: var(--dissolve-background, rgb(255 255 255));
  cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; will-change: transform; outline: none;
}
:where([data-reorder-row]:focus-visible) { box-shadow: 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
:where([data-reorder-row][data-lifted]) { z-index: 10; cursor: grabbing; }
:where([data-reorder-handle]) { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 12px 8px; cursor: grab; }
:where(.dissolve-reorder-bar) { display: block; width: 18px; height: 2px; border-radius: 2px; background: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-reorder-grains) { position: absolute; pointer-events: none; }
`;

type Row = { key: string; el: HTMLElement; y: Value; at: number };

export function createReorderList<T>(host: HTMLElement, initial: ReorderListProps<T>): ReorderListInstance<T> {
  injectStyle('dissolve-reorder-list', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();

  host.dataset.dissolve = 'reorder-list';
  const scroller = el('div', 'dissolve-reorder-scroll');
  const header = el('div');
  const list = el('div', 'dissolve-reorder-list');
  list.setAttribute('role', 'list');
  const footer = el('div');
  scroller.append(header, list, footer);
  const cv = el('canvas', 'dissolve-reorder-grains');
  cv.setAttribute('aria-hidden', 'true');
  host.append(scroller, cv);
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = () => list.clientWidth;
  const sizeCanvas = () => {
    const w = host.clientWidth + PAD * 2, h = host.clientHeight + PAD * 2;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.cssText = `left:${-PAD}px;top:${-PAD}px;width:${w}px;height:${h}px`;
  };

  let applied: string[] = [];
  function containerStyle() {
    for (const k of applied) scroller.style.removeProperty(k);
    applied = [];
    for (const [k, v] of Object.entries(p().contentContainerStyle ?? {})) {
      const name = k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      scroller.style.setProperty(name, typeof v === 'number' && !UNITLESS.has(k) ? v + 'px' : String(v));
      applied.push(name);
    }
  }
  containerStyle();

  /* ---------- Rows ---------- */

  const rows = new Map<string, Row>();
  let order: string[] = [];
  const heights: Record<string, number> = {};
  let phase = IDLE, active: string | null = null, from = 0, target = 0, armed = 0, total = 0;
  const fx = { x: 0, y: 0, x0: 0, y0: 0, top0: 0, s0: 0, lastX: 0, vx: 0, s: 1 };
  let tilt = 0, shadeA = 0.18;
  const buzz = (ms: number) => { if (p().haptics) vibrate(ms); };

  const paintActive = () => {
    const r = active ? rows.get(active) : null;
    if (!r) return;
    const l = lift.v;
    const fade = p().onDelete ? Math.min(1, Math.abs(dx.v) / (W() * DELETE_AT)) : 0;
    r.el.style.transform = `translate3d(${dx.v.toFixed(2)}px,${top.v.toFixed(2)}px,0) scale(${(1 + LIFT_SCALE * l).toFixed(4)}) rotate(${tilt.toFixed(3)}deg)`;
    r.el.style.boxShadow = `inset 0 0 0 1px var(--dissolve-reorder-ring, transparent), 0 ${(2 + 8 * l).toFixed(1)}px ${(4 + 26 * l).toFixed(1)}px rgba(0,0,0,${(shadeA * l).toFixed(3)})`;
    r.el.style.opacity = (1 - 0.4 * fade).toFixed(3);
  };
  const top = value(sc, 0, paintActive);
  const dx = value(sc, 0, paintActive);
  const lift = value(sc, 0, paintActive);

  const ro = new ResizeObserver(() => measure());
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());

  function rowOf(key: string) {
    let r = rows.get(key);
    if (r) return r;
    const node = el('div');
    node.dataset.reorderRow = key;
    node.setAttribute('role', 'listitem');
    node.tabIndex = 0;
    const made: Row = { key, el: node, y: null as unknown as Value, at: -1 };
    made.y = value(sc, 0, () => { if (active !== key || phase === IDLE) node.style.transform = `translate3d(0,${made.y.v.toFixed(2)}px,0)`; });
    r = made;
    rows.set(key, r);
    itemClass(r);
    return r;
  }
  const itemClass = (r: Row) => { r.el.className = p().itemClassName ?? ''; };

  /** Tops in the committed order, and in the virtual one (the lifted row at its target). */
  function computeLayout() {
    const g = p().gap, base: Record<string, number> = {};
    let y = 0;
    for (const id of order) { base[id] = y; y += (heights[id] ?? 0) + g; }
    total = order.length ? y - g : 0;
    if (!active || phase === IDLE || base[active] === undefined) return { base, tops: base };
    const rest = order.filter((k) => k !== active);
    rest.splice(clamp(target, 0, rest.length), 0, active);
    const tops: Record<string, number> = {};
    y = 0;
    for (const id of rest) { tops[id] = y; y += (heights[id] ?? 0) + g; }
    return { base, tops };
  }
  let L: { base: Record<string, number>; tops: Record<string, number> } = { base: {}, tops: {} };

  /** Slides every resting row to its slot on the calm curve (or puts it there the first time). */
  let measured = false;
  function apply(animate = true) {
    // Rows that were never measured take their slot at once, with the rest of the first layout.
    if (!measured) animate = false;
    measured = order.every((id) => heights[id] !== undefined);
    L = computeLayout();
    list.style.height = total + 'px';
    for (const [id, r] of rows) {
      if (id === active && phase !== IDLE) continue;
      const t = L.tops[id];
      if (t === undefined || t === r.at) continue;
      if (r.at < 0 || !animate) r.y.set(t);
      else r.y.to(t, reducedMotion() ? 0 : SLIDE, CALM);
      r.at = t;
    }
  }

  function measure() {
    let changed = false;
    for (const id of order) {
      const h = rows.get(id)?.el.offsetHeight;
      if (h && heights[id] !== h) { heights[id] = h; changed = true; }
    }
    if (changed) apply(phase === IDLE);
    sizeCanvas();
  }

  /** Data from the owner: new keys get a row, gone keys lose theirs, the rest slide. */
  let synced: string | null = null;
  function sync() {
    const { data, keyExtractor } = p();
    const keys = data.map(keyExtractor);
    const sig = keys.join('\u0001');
    if (phase !== IDLE || sig === synced) return;
    synced = sig;
    const keep = new Set(keys);
    for (const [k, r] of rows) {
      if (keep.has(k)) continue;
      ro.unobserve(r.el);
      r.el.remove();
      rows.delete(k);
      delete heights[k];
    }
    for (const k of keys) {
      const r = rowOf(k);
      if (r.el.parentNode !== list) { list.append(r.el); ro.observe(r.el); }
    }
    order = keys;
    measure();
    apply();
  }

  /* ---------- Grains ---------- */

  const G = new Float32Array(GRAINS * 9);
  let cursor = 0, grainsAlive = false, ink = '0,0,0';
  function readInk() {
    const probe = token(host, 'foreground', 'rgb(28 28 30)');
    ctx.fillStyle = probe;
    const c = ctx.fillStyle;
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    ink = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : (/\d+\s*,\s*\d+\s*,\s*\d+/.exec(c)?.[0] ?? '28,28,30');
  }

  function emit(kind: 0 | 1, y0: number, h: number) {
    if (reducedMotion() || !p().grains) return;
    const n = kind === 0 ? 26 : 22, r = Math.random, w = W();
    for (let j = 0; j < n; j++) {
      const o = cursor * 9;
      cursor = (cursor + 1) % GRAINS;
      if (kind === 0) {
        const e = r();
        G[o] = r() * w;
        G[o + 1] = y0 + (r() < 0.5 ? e * e * h * 0.45 : h - e * e * h * 0.45);
        G[o + 2] = (r() - 0.5) * 14;
        G[o + 3] = (r() - 0.5) * 8 - 3;
        G[o + 5] = 650 + r() * 450;
        G[o + 6] = 1.3 + r() * 1.1;
        G[o + 7] = 0.22 + r() * 0.22;
        G[o + 8] = r() * 200;
      } else {
        const up = j % 2 === 0;
        G[o] = r() * w;
        G[o + 1] = up ? y0 : y0 + h;
        G[o + 2] = (r() - 0.5) * 36;
        G[o + 3] = (up ? -1 : 1) * (22 + r() * 48);
        G[o + 5] = 420 + r() * 280;
        G[o + 6] = 1.3 + r() * 1.3;
        G[o + 7] = 0.32 + r() * 0.25;
        G[o + 8] = 90 + r() * 60;
      }
      G[o + 4] = -1;
    }
    if (!grainsAlive) readInk();
    grainsAlive = true;
    wake();
  }

  function drawGrains(now: number, dt: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!grainsAlive) return;
    const ox = PAD + scroller.offsetLeft + list.offsetLeft;
    const oy = PAD + scroller.offsetTop + list.offsetTop - scroller.scrollTop, damp = Math.exp(-dt * 3.2);
    let any = false;
    for (let i = 0; i < GRAINS; i++) {
      const o = i * 9, life = G[o + 5];
      if (life <= 0) continue;
      any = true;
      if (G[o + 4] < 0) G[o + 4] = now + G[o + 8];
      const age = now - G[o + 4];
      if (age >= life) { G[o + 5] = 0; continue; }
      if (age < 0) continue;
      G[o] += G[o + 2] * dt;
      G[o + 1] += G[o + 3] * dt;
      G[o + 2] *= damp;
      G[o + 3] *= damp;
      const k = age / life;
      const a = G[o + 7] * (1 - k) * (1 - k) * Math.min(1, age / 60);
      ctx.fillStyle = `rgba(${ink},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(ox + G[o], oy + G[o + 1], G[o + 6] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    grainsAlive = any;
  }

  /* ---------- Frame loop: auto scroll, lean, grains ---------- */

  let raf = 0, last = 0;
  function wake() { if (!raf && sc.alive) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  sc.onDispose(() => cancelAnimationFrame(raf));
  function frame(now: number) {
    raf = 0;
    if (!sc.alive) return;
    const dt = Math.min(1 / 30, (now - last) / 1000) || 1 / 60;
    last = now;
    if (phase === DRAG) {
      const vr = scroller.getBoundingClientRect();
      const fy = fx.y - vr.top, band = Math.min(EDGE, vr.height / 4);
      const maxS = scroller.scrollHeight - scroller.clientHeight;
      let speed = 0;
      if (maxS > 0 && fy < band) speed = -MAX_SPEED * Math.min(1, (band - fy) / band) ** 2;
      else if (maxS > 0 && fy > vr.height - band) speed = MAX_SPEED * Math.min(1, (fy - (vr.height - band)) / band) ** 2;
      if (speed) scroller.scrollTop = clamp(scroller.scrollTop + speed * dt, 0, maxS);
      const inst = (fx.x - fx.lastX) / dt;
      fx.vx += (inst - fx.vx) * (1 - Math.exp(-dt * 14));
      fx.lastX = fx.x;
      follow();
      const want = reducedMotion() ? 0 : clamp(fx.vx / 700, -1, 1) * MAX_TILT;
      tilt += (want - tilt) * (1 - Math.exp(-dt * 12));
      paintActive();
    } else if (tilt !== 0) {
      tilt *= Math.exp(-dt * 14);
      if (Math.abs(tilt) < 0.01) tilt = 0;
      paintActive();
    }
    drawGrains(now, dt);
    if (phase === DRAG || grainsAlive || tilt !== 0) raf = requestAnimationFrame(frame);
  }

  /* ---------- Drag ---------- */

  function follow() {
    if (!active) return;
    const h = heights[active] ?? 0;
    let t0 = fx.top0 + (fx.y - fx.y0) / fx.s + (scroller.scrollTop - fx.s0);
    t0 = clamp(t0, -h / 2, total - h / 2);
    top.set(t0);
    const sx = (fx.x - fx.x0) / fx.s;
    dx.set(sx);
    const center = t0 + h / 2;
    let t = from;
    for (let i = from + 1; i < order.length; i++) {
      if (center > L.base[order[i]] + (heights[order[i]] ?? 0) / 2) t = i; else break;
    }
    if (t === from) {
      for (let i = from - 1; i >= 0; i--) {
        if (center < L.base[order[i]] + (heights[order[i]] ?? 0) / 2) t = i; else break;
      }
    }
    if (t !== target) { target = t; apply(); buzz(4); }
    const arm = p().onDelete && Math.abs(sx) > W() * DELETE_AT ? 1 : 0;
    if (arm !== armed) { armed = arm; buzz(arm ? 10 : 4); }
  }

  function begin(r: Row, x: number, y: number) {
    if (phase !== IDLE || !sc.alive) return false;
    const idx = order.indexOf(r.key);
    if (idx < 0) return false;
    active = r.key;
    from = target = idx;
    armed = 0;
    Object.assign(fx, { x, y, x0: x, y0: y, top0: L.base[r.key], s0: scroller.scrollTop, lastX: x, vx: 0, s: host.getBoundingClientRect().width / host.offsetWidth || 1 });
    tilt = 0;
    shadeA = parseFloat(token(host, 'reorder-shadow', '0.18')) || 0;
    top.set(L.base[r.key]);
    dx.set(0);
    phase = DRAG;
    r.el.dataset.lifted = '';
    lift.spring(1, SETTLE);
    buzz(12);
    emit(0, L.base[r.key], heights[r.key] ?? 0);
    p().onDragChange?.(r.key);
    wake();
    return true;
  }

  function moveTo(x: number, y: number) {
    if (phase !== DRAG) return;
    fx.x = x;
    fx.y = y;
    follow();
  }

  /** Back to rest: the row takes its slot, the list is handed back. */
  function rest(r: Row, at: number) {
    r.at = at;
    r.y.set(at);
    phase = IDLE;
    active = null;
    delete r.el.dataset.lifted;
    r.el.style.boxShadow = '';
    r.el.style.opacity = '';
    r.el.style.transform = `translate3d(0,${at.toFixed(2)}px,0)`;
  }

  /** Releases the lifted row. Resolves once it has settled (or turned to dust). */
  async function end() {
    if (phase !== DRAG || !active) return;
    follow();
    const id = active, r = rows.get(id)!;
    if (armed) return remove(r);
    phase = DROP;
    apply();
    const final = L.tops[id];
    lift.to(0, 260, CALM);
    dx.spring(0, SETTLE);
    emit(1, final, heights[id] ?? 0);
    sc.wait(110).then(() => buzz(6));
    await top.spring(final, SETTLE);
    if (!sc.alive || active !== id) return;
    const f = from, t = target;
    if (t !== f) { order.splice(f, 1); order.splice(t, 0, id); synced = order.join('\u0001'); }
    rest(r, final);
    apply();
    if (t !== f) reorder(f, t);
    p().onDragChange?.(null);
  }

  function reorder(f: number, t: number) {
    const next = p().data.slice();
    const [it] = next.splice(f, 1);
    next.splice(t, 0, it);
    p().onReorder?.(next, f, t);
  }

  /** Dragged far to the side: the row turns to dust, the list closes up behind it. */
  async function remove(r: Row) {
    phase = DELETE;
    lift.to(0, 140, CALM);
    // Let the lift settle back to scale 1 so the dust starts from the row as it rests.
    await sc.wait(150);
    if (!sc.alive) return;
    const idx = order.indexOf(r.key), item = p().data[idx];
    const shot = await capture(r.el);
    if (!sc.alive) return;
    r.el.style.visibility = 'hidden';
    const dust = sc.track(play({ ...shot, preset: p().preset }));
    await sc.wait(420);
    if (!sc.alive) return;
    order = order.filter((k) => k !== r.key);
    phase = IDLE;
    active = null;
    tilt = 0;
    ro.unobserve(r.el);
    r.el.remove();
    rows.delete(r.key);
    delete heights[r.key];
    apply();
    synced = order.join('\u0001');
    if (item !== undefined) p().onDelete?.(item, idx);
    p().onDragChange?.(null);
    await dust.done;
  }

  /** Keyboard: Alt and the arrows move the focused row one slot. */
  function nudge(id: string, by: number) {
    if (phase !== IDLE) return;
    const i = order.indexOf(id), t = i + by;
    if (i < 0 || t < 0 || t >= order.length) return;
    order.splice(i, 1);
    order.splice(t, 0, id);
    synced = order.join('\u0001');
    apply();
    buzz(4);
    reorder(i, t);
  }

  /* ---------- Pointer: press and hold, or a handle at once ---------- */

  const rowAt = (t: EventTarget | null) => {
    const n = (t as Element | null)?.closest?.('[data-reorder-row]') as HTMLElement | null;
    return n && n.parentNode === list ? rows.get(n.dataset.reorderRow ?? '') ?? null : null;
  };
  let press: { r: Row; id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> | undefined; on: boolean } | null = null;
  const capturePtr = (n: Element, id: number) => { try { n.setPointerCapture(id); } catch { /* synthetic pointers cannot be captured */ } };
  const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts: AddEventListenerOptions = {}) =>
    list.addEventListener(type, fn, { ...opts, signal: ac.signal });

  on('pointerdown', (e) => {
    const r = rowAt(e.target);
    if (!r || e.button > 0 || phase !== IDLE) return;
    const onHandle = !!(e.target as Element).closest('[data-reorder-handle]');
    if (p().handle && !onHandle) return;
    if (press) clearTimeout(press.timer);
    const pr = { r, id: e.pointerId, x: e.clientX, y: e.clientY, timer: undefined as ReturnType<typeof setTimeout> | undefined, on: false };
    press = pr;
    capturePtr(r.el, pr.id);
    const go = () => {
      if (press !== pr || !begin(r, pr.x, pr.y)) return;
      pr.on = true;
      capturePtr(r.el, pr.id);
    };
    if (onHandle) { e.preventDefault(); go(); }
    else pr.timer = setTimeout(go, p().longPressDelay);
  });
  on('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (!press.on) {
      // Moved before the hold completed: it is a scroll or a click, not a drag.
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { clearTimeout(press.timer); press = null; }
      else { press.x = e.clientX; press.y = e.clientY; }
      return;
    }
    moveTo(e.clientX, e.clientY);
  });
  const up = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const pr = press;
    press = null;
    clearTimeout(pr.timer);
    if (pr.on) end();
  };
  on('pointerup', up);
  on('pointercancel', up);
  on('lostpointercapture', up);
  on('contextmenu', (e) => { if (rowAt(e.target)) e.preventDefault(); });
  // Touch: once lifted, the finger drags the row instead of scrolling the page.
  on('touchmove', (e) => { if (phase === DRAG) e.preventDefault(); }, { passive: false });
  on('keydown', (e) => {
    const r = rowAt(e.target);
    if (!r || e.target !== r.el || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    nudge(r.key, e.key === 'ArrowUp' ? -1 : 1);
  });
  sc.onDispose(() => { if (press) clearTimeout(press.timer); });

  sync();
  apply(false);

  return {
    row: (key) => rowOf(key).el,
    header,
    footer,
    update(next) {
      const changed = props.update(next);
      if (changed.has('itemClassName')) rows.forEach(itemClass);
      if (changed.has('contentContainerStyle')) containerStyle();
      if (changed.has('gap')) apply();
      if (changed.has('data') || changed.has('keyExtractor')) sync();
    },
    destroy() {
      sc.dispose();
      ac.abort();
      scroller.remove();
      cv.remove();
      rows.clear();
      delete host.dataset.dissolve;
    },
  };
}
