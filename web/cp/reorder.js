// ReorderList (registry/reorder-list.tsx), ported raw. Same timings and curves as the native source:
// long press (250 ms) or the handle lifts a row, the others slide on the calm curve, the row follows
// 1:1 and leans with sideways speed, the list scrolls near its edges, the drop settles critically
// damped. Grains: a faint trail at the slot it left, a puff at the edges of the one it lands in.
import { CALM, IN_OUT_CUBIC, value, el, clamp, play, snapshot, FONT, rr } from './kit.js';

const PKG = 'react-native-dissolve';
const prop = (name, type, def, desc) => ({ name, type, def, desc });
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const MONO = "'Geist Mono', ui-monospace, monospace";

const HOLD = 250;
const SLIDE = 300;
const SETTLE = { stiffness: 420, damping: 41, mass: 1, eps: 0.05 };
const LIFT_SCALE = 0.03;
const MAX_TILT = 3;
const EDGE = 56;
const MAX_SPEED = 900;
const DELETE_AT = 0.42;
const GAP = 0;
const GRAINS = 72;

const IDLE = 0, DRAG = 1, DROP = 2, DELETE = 3;

const stroke = (d) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  brush: 'M18.4 3.6a2 2 0 0 1 2.8 2.8L13 14.6 9.4 11zM9 12.4 12.4 15.8c-.6 2.8-2.6 4.6-6.4 4.6H3.6c1.4-1 1.6-2.4 1.6-3.8 0-2.4 1.6-4.2 3.8-4.2z',
  phone: 'M6.2 3.5h2.9l1.5 4.2-2 1.4a11.5 11.5 0 0 0 6.3 6.3l1.4-2 4.2 1.5v2.9a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.2 5.6a2 2 0 0 1 2-2.1z',
  plane: 'M10.2 20.5 12 14 5 11.5V9.8l7.3 1.5 1.5-7.3h1.7l-.3 7.8 5.8 1.6v1.8l-5.9-.9-1.3 6.2z',
  bubble: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8.5L6 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5zM8 9h8M8 12.2h5',
  card: 'M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5zM7 10h4.5M7 14h7.5',
  run: 'M14.5 5.2a1.6 1.6 0 1 0 0-.1M8 20.5l2.6-5.4 3 2.4v3M6 11.5l3.2-3.2h4.2l2.2 3.4h3.2M10.6 15.1l1.6-4.6',
  book: 'M4 5.5c2.8-1 5.4-1 8 .8 2.6-1.8 5.2-1.8 8-.8v13c-2.8-1-5.4-1-8 .8-2.6-1.8-5.2-1.8-8-.8zM12 6.3v13',
};
const TASKS = [
  { id: 'a', title: 'Ship the onboarding', meta: 'Thursday · Design', icon: 'brush', tone: ['#7C5CFF', '#8E72FF'] },
  { id: 'b', title: 'Call the landlord', meta: 'Today · Home', icon: 'phone', tone: ['#0A84FF', '#0A84FF'] },
  { id: 'c', title: 'Book the flights', meta: 'Friday · Team', icon: 'plane', tone: ['#F5B700', '#FFD233'] },
  { id: 'd', title: 'Review the pull request', meta: 'Today · Work', icon: 'bubble', tone: ['#34C759', '#30D158'] },
  { id: 'e', title: 'Renew the passport', meta: 'This month · Admin', icon: 'card', tone: ['#FF3787', '#FF4F98'] },
  { id: 'f', title: 'Plan the long run', meta: 'Sunday · Health', icon: 'run', tone: ['#FF3B30', '#FF453A'] },
  { id: 'g', title: 'Read two chapters', meta: 'Anytime · Me', icon: 'book', tone: ['#8E8E93', '#98989D'] },
];

const CSS = `
.cp-ro { position: relative; --ro-lift: var(--raised); --ro-shade: 0, 0, 0; --ro-shade-a: 0.42; }
[data-theme='light'] .cp-ro { --ro-lift: #FFFFFF; --ro-shade-a: 0.16; }
.cp-ro-view { position: relative; }
.cp-ro-scroll { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
.cp-ro-scroll::-webkit-scrollbar { display: none; }
@media (pointer: coarse) { .cp-ro-scroll { overscroll-behavior: auto; } }
.cp-ro-list { position: relative; }
.cp-ro-scroll:not(.cp-ro-scrolls) { overflow: visible; }
.cp-ro-row {
  position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; min-height: 56px; box-sizing: border-box;
  border-radius: 12px; cursor: grab; touch-action: pan-y;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; will-change: transform; outline: none;
}
.cp-ro-row::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 0.5px; background: var(--line); }
.cp-ro-row:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
.cp-ro-row.lifted { cursor: grabbing; z-index: 10; background: var(--ro-lift); padding: 0 16px; margin: 0 -16px; }
.cp-ro-row.lifted::after { display: none; }
.cp-ro-icon, .cp-ro-meta { display: none; }
.cp-ro-row { gap: 12px; }
.cp-ro-rank { flex: none; width: 20px; font-size: 17px; line-height: 22px; color: var(--muted); font-variant-numeric: tabular-nums; }
.cp-ro-grip { flex: none; display: flex; flex-direction: column; gap: 3px; padding: 12px 0 12px 8px; cursor: grab; }
.cp-ro-grip i { display: block; width: 18px; height: 2px; border-radius: 2px; background: var(--muted); }
.cp-ro-text { flex: 1; min-width: 0; }
.cp-ro-title { font-size: 17px; line-height: 22px; letter-spacing: -0.025em; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-ro-canvas { position: absolute; pointer-events: none; }
.cp-ro-foot { display: none; }
.cp-mode-tile .cp-ro-row { min-height: 44px; }
.cp-mode-tile .cp-ro-title { font-size: 15px; }
`;

function injectCSS() {
  if (document.getElementById('cp-ro-css')) return;
  const s = document.createElement('style');
  s.id = 'cp-ro-css';
  s.textContent = CSS;
  document.head.append(s);
}

function availW(body) {
  const cs = getComputedStyle(body);
  return body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

const light = () => document.documentElement.dataset.theme === 'light';

/** Damped spring toward `to` as a promise, on a kit value (critically damped by default). */
const settle = (v, to) => v.spring(to, SETTLE);

function mountReorder(body, { sc, mode }) {
  injectCSS();
  const tile = mode === 'tile';
  const stage = mode === 'stage';
  const W = Math.round(Math.min(tile ? 300 : 400, availW(body) || 340));
  const data = TASKS.slice(0, tile ? 4 : stage ? 7 : 5);
  const viewH = stage ? 372 : 0; // the stage scrolls, so the edges auto scroll

  const root = el('div', 'cp-ro');
  root.style.width = W + 'px';
  const view = el('div', 'cp-ro-view');
  const scroller = el('div', 'cp-ro-scroll');
  // The stage scrolls: room around the rows for the lift and its shadow, edges fading out.
  if (viewH) scroller.classList.add('cp-ro-scrolls'), (scroller.style.maxHeight = viewH + 'px');
  const list = el('div', 'cp-ro-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Priorities. Press and hold a row, then drag it. Alt and the arrow keys move the focused row.');
  scroller.append(list);
  const cv = el('canvas', 'cp-ro-canvas');
  const PAD = 18;
  view.append(scroller, cv);
  root.append(view);
  const foot = el('div', 'cp-ro-foot');
  const reset = el('button', 'cp-reset', 'Reset');
  reset.type = 'button';
  reset.hidden = true;
  const hint = el('span', 'cp-ro-hint', 'Touch and hold a row, then drag it.');
  foot.append(reset, hint);
  if (!tile) root.append(foot);
  body.append(root);

  // Grain canvas: the viewport plus a margin, so a puff at the first or last edge is not cut.
  const dpr = Math.min(2, devicePixelRatio || 1);
  const ctx = cv.getContext('2d');
  const sizeCanvas = () => {
    const w = W + PAD * 2, h = (scroller.clientHeight || 0) + PAD * 2;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.cssText = `left:${-PAD}px;top:${-PAD}px;width:${w}px;height:${h}px`;
  };

  /* ---------- Rows ---------- */

  const rows = new Map();
  let order = data.map((t) => t.id);
  let heights = {};
  let phase = IDLE, active = null, from = 0, target = 0, armed = 0;
  let total = 0;
  let busy = false;
  const fx = { x: 0, y: 0, x0: 0, y0: 0, top0: 0, s0: 0, lastX: 0, vx: 0 };
  let tilt = 0;
  const reduce = () => RM.matches;

  const paintActive = () => {
    const r = active && rows.get(active);
    if (!r) return;
    const l = lift.v;
    const fade = Math.min(1, Math.abs(dx.v) / (W * DELETE_AT));
    const a = getComputedStyle(root).getPropertyValue('--ro-shade-a').trim() || 0.3;
    r.el.style.transform = `translate3d(${dx.v.toFixed(2)}px,${top.v.toFixed(2)}px,0) scale(${(1 + LIFT_SCALE * l).toFixed(4)}) rotate(${tilt.toFixed(3)}deg)`;
    r.el.style.boxShadow = `inset 0 0 0 1px var(--line), 0 ${(2 + 8 * l).toFixed(1)}px ${(4 + 26 * l).toFixed(1)}px rgba(0,0,0,${(a * l).toFixed(3)})`;
    r.el.style.opacity = (1 - 0.4 * fade).toFixed(3);
  };
  const top = value(sc, 0, paintActive);
  const dx = value(sc, 0, paintActive);
  const lift = value(sc, 0, paintActive);

  function makeRow(t) {
    const row = el('div', 'cp-ro-row');
    row.setAttribute('role', 'listitem');
    row.tabIndex = 0;
    const rank = el('span', 'cp-ro-rank');
    const icon = el('span', 'cp-ro-icon', stroke(ICON[t.icon]));
    const text = el('span', 'cp-ro-text');
    const title = el('span', 'cp-ro-title');
    title.textContent = t.title;
    const meta = el('span', 'cp-ro-meta');
    meta.textContent = t.meta;
    text.append(title, meta);
    const grip = el('span', 'cp-ro-grip', '<i></i><i></i><i></i>');
    grip.setAttribute('aria-hidden', 'true');
    row.append(rank, icon, text, grip);
    const r = { t, el: row, rank, icon, y: null, at: -1 };
    r.y = value(sc, 0, () => { if (active !== t.id || phase === IDLE) row.style.transform = `translate3d(0,${r.y.v.toFixed(2)}px,0)`; });
    row.addEventListener('pointerdown', (e) => onDown(r, e));
    row.addEventListener('contextmenu', (e) => e.preventDefault());
    row.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      nudge(t.id, e.key === 'ArrowUp' ? -1 : 1);
    });
    return r;
  }

  const tone = (r) => r.t.tone[light() ? 0 : 1];
  const paintTones = () => rows.forEach((r) => { r.icon.style.background = tone(r); });

  /** Tops in the committed order, and in the virtual one (the lifted row at its target). */
  function computeLayout() {
    const base = {};
    let y = 0;
    for (const id of order) { base[id] = y; y += (heights[id] ?? 0) + GAP; }
    total = order.length ? y - GAP : 0;
    if (!active || phase === IDLE || base[active] === undefined) return { base, tops: base };
    const rest = order.filter((k) => k !== active);
    rest.splice(clamp(target, 0, rest.length), 0, active);
    const tops = {};
    y = 0;
    for (const id of rest) { tops[id] = y; y += (heights[id] ?? 0) + GAP; }
    return { base, tops };
  }
  let L = { base: {}, tops: {} };

  /** Slides every resting row to its slot on the calm curve (or jumps there the first time). */
  function apply(animate = true) {
    L = computeLayout();
    list.style.height = total + 'px';
    for (const [id, r] of rows) {
      if (id === active && phase !== IDLE) continue;
      const t = L.tops[id];
      if (t === undefined || t === r.at) continue;
      if (r.at < 0 || !animate) r.y.set(t);
      else r.y.to(t, reduce() ? 0 : SLIDE, CALM);
      r.at = t;
    }
    order.forEach((id, i) => { const r = rows.get(id); if (r) r.rank.textContent = String(i + 1); });
    reset.hidden = order.length === data.length && order.every((id, i) => id === data[i].id);
  }

  function measure() {
    let changed = false;
    for (const [id, r] of rows) {
      const h = r.el.offsetHeight;
      if (h && heights[id] !== h) { heights[id] = h; changed = true; }
    }
    if (changed) { apply(phase === IDLE); sizeCanvas(); }
  }
  const ro = new ResizeObserver(() => measure());
  sc.onDispose(() => ro.disconnect());

  function addRow(t) {
    const r = makeRow(t);
    rows.set(t.id, r);
    list.append(r.el);
    r.icon.style.background = tone(r);
    ro.observe(r.el);
    return r;
  }
  data.forEach(addRow);
  measure();
  apply(false);
  sizeCanvas();
  paintTones();
  const mo = new MutationObserver(() => { paintTones(); readInk(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  sc.onDispose(() => mo.disconnect());

  /* ---------- Grains ---------- */

  const G = new Float32Array(GRAINS * 9); // x, y, vx, vy, born, life, size, alpha, delay
  let cursor = 0, alive = false, ink = [242, 244, 247];
  function readInk() {
    const c = getComputedStyle(root).getPropertyValue('--text').trim();
    const m = c.match(/^#([0-9a-f]{6})$/i);
    ink = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : light() ? [18, 21, 26] : [242, 244, 247];
  }
  readInk();

  function emit(kind, y0, h) {
    if (reduce()) return;
    const n = kind === 0 ? 26 : 22, r = Math.random;
    for (let j = 0; j < n; j++) {
      const o = cursor * 9;
      cursor = (cursor + 1) % GRAINS;
      if (kind === 0) {
        const e = r();
        G[o] = r() * W;
        G[o + 1] = y0 + (r() < 0.5 ? e * e * h * 0.45 : h - e * e * h * 0.45);
        G[o + 2] = (r() - 0.5) * 14;
        G[o + 3] = (r() - 0.5) * 8 - 3;
        G[o + 5] = 650 + r() * 450;
        G[o + 6] = 1.3 + r() * 1.1;
        G[o + 7] = 0.22 + r() * 0.22;
        G[o + 8] = r() * 200;
      } else {
        const up = j % 2 === 0;
        G[o] = r() * W;
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
    alive = true;
    wake();
  }

  function drawGrains(now, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!alive) return;
    const oy = PAD - scroller.scrollTop, damp = Math.exp(-dt * 3.2);
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
      ctx.fillStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(PAD + G[o], oy + G[o + 1], G[o + 6] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    alive = any;
  }

  /* ---------- Frame loop: auto scroll, lean, grains ---------- */

  let raf = 0, last = 0;
  function wake() { if (!raf && sc.alive) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  sc.onDispose(() => cancelAnimationFrame(raf));
  function frame(now) {
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
      const want = reduce() ? 0 : clamp(fx.vx / 700, -1, 1) * MAX_TILT;
      tilt += (want - tilt) * (1 - Math.exp(-dt * 12));
      paintActive();
    } else if (tilt !== 0) {
      tilt *= Math.exp(-dt * 14);
      if (Math.abs(tilt) < 0.01) tilt = 0;
      paintActive();
    }
    drawGrains(now, dt);
    if (phase === DRAG || alive || tilt !== 0) raf = requestAnimationFrame(frame);
  }

  /* ---------- Drag ---------- */

  function follow() {
    const h = heights[active] ?? 0;
    let t0 = fx.top0 + (fx.y - fx.y0) + (scroller.scrollTop - fx.s0);
    t0 = clamp(t0, -h / 2, total - h / 2);
    top.set(t0);
    const sx = fx.x - fx.x0;
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
    if (t !== target) { target = t; apply(); }
    armed = Math.abs(sx) > W * DELETE_AT ? 1 : 0;
  }

  function begin(r, x, y) {
    if (phase !== IDLE || !sc.alive) return false;
    const id = r.t.id;
    const idx = order.indexOf(id);
    if (idx < 0) return false;
    active = id;
    from = target = idx;
    armed = 0;
    Object.assign(fx, { x, y, x0: x, y0: y, top0: L.base[id], s0: scroller.scrollTop, lastX: x, vx: 0 });
    tilt = 0;
    top.set(L.base[id]);
    dx.set(0);
    phase = DRAG;
    r.el.classList.add('lifted');
    lift.spring(1, SETTLE);
    emit(0, L.base[id], heights[id] ?? 0);
    wake();
    return true;
  }

  function moveTo(x, y) {
    if (phase !== DRAG) return;
    fx.x = x;
    fx.y = y;
    follow();
  }

  /** Releases the lifted row. Resolves once it has settled (or turned to dust). */
  async function end() {
    if (phase !== DRAG) return;
    follow();
    const id = active, r = rows.get(id);
    if (armed) return remove(r);
    phase = DROP;
    apply();
    const final = L.tops[id];
    lift.to(0, 260, CALM);
    settle(dx, 0);
    emit(1, final, heights[id] ?? 0);
    await settle(top, final);
    if (!sc.alive || active !== id) return;
    if (target !== from) { order.splice(from, 1); order.splice(target, 0, id); }
    r.at = final;
    r.y.set(final);
    phase = IDLE;
    active = null;
    r.el.classList.remove('lifted');
    r.el.style.boxShadow = '';
    r.el.style.opacity = '';
    r.el.style.transform = `translate3d(0,${final.toFixed(2)}px,0)`;
    apply();
  }

  /** Dragged far to the side: the row turns to dust, the list closes up behind it. */
  async function remove(r) {
    phase = DELETE;
    lift.to(0, 140, CALM);
    await sc.wait(150);
    if (!sc.alive) return;
    const lr = list.getBoundingClientRect();
    const h = heights[r.t.id], x = dx.v, y = top.v;
    const src = snapshot(W, h, (c) => drawRow(c, r, W, h));
    r.el.style.visibility = 'hidden';
    const dust = sc.track(play({ source: src, x: lr.left + x, y: lr.top + y, w: W, h, preset: 'dust', duration: 1300 }));
    await sc.wait(420);
    if (!sc.alive) return;
    order = order.filter((k) => k !== r.t.id);
    phase = IDLE;
    active = null;
    tilt = 0;
    r.el.remove();
    rows.delete(r.t.id);
    delete heights[r.t.id];
    apply();
    await dust.done;
  }

  /** Canvas replica of a row, for the dust. */
  function drawRow(c, r, w, h) {
    const re = r.el.getBoundingClientRect();
    c.textBaseline = 'middle';
    for (const n of [r.rank, r.el.querySelector('.cp-ro-title')]) {
      const st = getComputedStyle(n), b = n.getBoundingClientRect();
      c.font = `${st.fontWeight} ${st.fontSize} ${FONT}`;
      c.fillStyle = st.color;
      c.fillText(n.textContent, b.left - re.left, h / 2);
    }
    const grip = r.el.querySelector('.cp-ro-grip i');
    if (grip) {
      const g = grip.getBoundingClientRect();
      c.fillStyle = getComputedStyle(grip).backgroundColor;
      for (let k = -1; k <= 1; k++) { rr(c, g.left - re.left, h / 2 + k * 5 - 1, g.width, 2, 1); c.fill(); }
    }
  }

  /** Keyboard: Alt + arrows move the focused row one slot. */
  function nudge(id, by) {
    if (phase !== IDLE) return;
    const i = order.indexOf(id), t = i + by;
    if (i < 0 || t < 0 || t >= order.length) return;
    order.splice(i, 1);
    order.splice(t, 0, id);
    apply();
  }

  /* ---------- Pointer: press and hold, or the handle at once ---------- */

  let press = null;
  function onDown(r, e) {
    if (e.button > 0 || phase !== IDLE || busy) return;
    const onGrip = !!e.target.closest('.cp-ro-grip');
    press = { r, id: e.pointerId, x: e.clientX, y: e.clientY, timer: 0, on: false };
    const p = press;
    try { r.el.setPointerCapture(p.id); } catch {}
    const go = () => {
      if (press !== p || !begin(r, p.x, p.y)) return;
      p.on = true;
      try { r.el.setPointerCapture(p.id); } catch {}
    };
    if (onGrip) { e.preventDefault(); go(); }
    else p.timer = setTimeout(go, HOLD);
  }
  const onMove = (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (!press.on) {
      // Moved before the hold completed: it is a scroll or a click, not a drag.
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { clearTimeout(press.timer); press = null; }
      else { press.x = e.clientX; press.y = e.clientY; }
      return;
    }
    moveTo(e.clientX, e.clientY);
  };
  const onUp = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    clearTimeout(p.timer);
    if (p.on) end();
  };
  list.addEventListener('pointermove', onMove);
  list.addEventListener('pointerup', onUp);
  list.addEventListener('pointercancel', onUp);
  list.addEventListener('lostpointercapture', onUp);
  // Touch: once lifted, the finger drags the row instead of scrolling the page.
  const noScroll = (e) => { if (phase === DRAG) e.preventDefault(); };
  list.addEventListener('touchmove', noScroll, { passive: false });
  sc.onDispose(() => { if (press) clearTimeout(press.timer); });

  reset.addEventListener('click', () => {
    if (phase !== IDLE) return;
    for (const t of data) if (!rows.has(t.id)) {
      const r = addRow(t);
      r.el.style.opacity = '0';
      r.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 120, easing: 'linear', fill: 'forwards' }).finished.then(() => { r.el.style.opacity = ''; }).catch(() => {});
    }
    order = data.map((t) => t.id);
    measure();
    apply();
  });

  /* ---------- Autoplay: hold a row, carry it two slots, drop it; the next run brings it back ---------- */

  let down = true;
  return {
    async run() {
      if (busy || phase !== IDLE || press) return;
      if (order.length < 3) { reset.click(); await sc.wait(900); return; }
      busy = true;
      const fi = down ? 0 : 2, ti = down ? 2 : 0;
      down = !down;
      const id = order[fi], r = rows.get(id);
      const br = r.el.getBoundingClientRect();
      const x0 = br.left + br.width * 0.62, y0 = br.top + br.height / 2;
      // The hold.
      await sc.wait(HOLD);
      if (!sc.alive || !begin(r, x0, y0)) { busy = false; return; }
      await sc.wait(260);
      // Where the row lands, from the committed tops.
      const toId = order[ti];
      const dy = ti > fi ? L.base[toId] + heights[toId] - heights[id] - L.base[id] : L.base[toId] - L.base[id];
      const dur = 1050;
      await new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          if (!sc.alive) return res();
          const k = clamp((now - t0) / dur);
          const e = IN_OUT_CUBIC(k);
          moveTo(x0 + Math.sin(k * Math.PI) * 26 * (ti > fi ? 1 : -1), y0 + dy * e);
          if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      await sc.wait(220);
      await end();
      busy = false;
      await sc.wait(500);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

const add = (usage) => `// npx ${PKG} add reorder-list
import { ReorderList, ReorderHandle } from '@/components/dissolve/reorder-list';

${usage}`;

export const ENTRIES = {
  'reorder-list': {
    title: 'ReorderList',
    note: 'Hold a row, drag it to a new place.',
    desc: 'A list you reorder by drag, like Reminders or Things. Long press a row (250 ms) or grab its handle: it lifts with a medium tick, grows a shadow and leans a little with the sideways speed of the finger, which it follows 1:1. The other rows slide out of the way on the calm curve, a selection tick lands on every new slot, and the list scrolls by itself near its edges. On release the row settles critically damped, then onReorder runs. A faint trail of grains stays at the slot it left, a small puff marks the one it lands in. With onDelete, drag a row far to the side to turn it to dust. Rows can have different heights, everything runs on the UI thread.',
    hint: 'Press and hold a row, then drag it',
    tileHint: 'Hold and drag',
    mount: mountReorder,
    glyph: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="15" height="4.5" rx="2" opacity=".55"/><rect x="5" y="8.8" width="15" height="4.5" rx="2"/><rect x="2.5" y="15" width="15" height="4.5" rx="2" opacity=".55"/><path d="M9 11h6" opacity=".55"/></svg>',
    code: add(`<ReorderList
  data={tasks}
  keyExtractor={(t) => t.id}
  onReorder={(next) => setTasks(next)}
  onDelete={(t) => remove(t.id)}
  gap={8}
  itemClassName="rounded-[18px] bg-dissolve-surface"
  renderItem={({ item, index }) => (
    <TaskRow task={item} rank={index + 1}>
      <ReorderHandle />
    </TaskRow>
  )}
/>`),
    props: [
      prop('data', 'T[]', 'required', 'The rows, in order.'),
      prop('keyExtractor', '(item: T, index: number) =&gt; string', 'required', 'A stable key per row. Rows are positioned by key.'),
      prop('renderItem', '({ item, index, dragging }) =&gt; ReactNode', 'required', 'A row. dragging is true while it is lifted (one render on lift, one on drop).'),
      prop('onReorder', '(data: T[], from: number, to: number) =&gt; void', 'required', 'Called once the dropped row has settled, with the reordered copy of data.'),
      prop('onDelete', '(item: T, index: number) =&gt; void', '', 'Enables the delete: drag a row past 42 percent of the width to the side and release, it turns to dust and the list closes up.'),
      prop('preset', 'VariantName', `'dust'`, 'Exit used by onDelete.'),
      prop('longPressDelay', 'number', '250', 'Hold before a row lifts, ms. Moving earlier scrolls the list instead.'),
      prop('handle', 'boolean', 'false', 'Drag only from a <code>&lt;ReorderHandle&gt;</code> inside the row, which lifts at once.'),
      prop('gap', 'number', '0', 'Space between rows. Use it instead of vertical margins.'),
      prop('haptics', 'boolean', 'true', 'Medium on lift, a selection tick per slot, light on drop.'),
      prop('grains', 'boolean', 'true', 'Trail and puff of grains. Off with reduced motion, as is the lean.'),
      prop('header / footer', 'ReactNode', '', 'Scroll above and below the rows.'),
      prop('className', 'string', `'flex-1'`, 'Root classes. Give the list a height: it scrolls by itself.'),
      prop('contentContainerStyle', 'StyleProp&lt;ViewStyle&gt;', '', 'Scroll content padding.'),
      prop('itemClassName', 'string', `'bg-dissolve-background'`, 'Row surface classes (background, radius). The lift shadow follows it.'),
    ],
  },
};
