// Controls: QuantityStepper, RulerPicker, BarChart, MiniPlayer (registry/*.tsx), ported raw.
// Same geometry, timings and curves as the native sources. Only the component, centered.
import { CALM, value, el, clamp, rectOf, play, IMG, FONT, cover, rr, claimTouch, isLight, onTheme, onScreen, availW, fitTile, snapNode, prop, add } from './kit.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
/** Durations collapse with reduced motion. */
const D = (ms, floor = 0) => (RM.matches ? floor : ms);

function sample(list, e) {
  const now = performance.now();
  list.push([now, e.clientX, e.clientY]);
  while (list.length > 2 && now - list[0][0] > 80) list.shift();
}
function velocity(list) {
  if (list.length < 2) return { vx: 0, vy: 0 };
  const a = list[0], b = list[list.length - 1], dt = (b[0] - a[0]) / 1000;
  return dt > 0 ? { vx: (b[1] - a[1]) / dt, vy: (b[2] - a[2]) / dt } : { vx: 0, vy: 0 };
}

const fmtInt = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ======================================================================================
   A small NumberTicker (registry/number-ticker.tsx): clipped digit wheels keyed by place,
   rolling right to left on the calm curve; added digits open in, removed ones fold out.
   Wheels roll like an odometer, the way the number moves (9 to 10 is one step forward), and a
   new value mid roll carries on from where the wheel is: fast changes never flash stale digits.
   ====================================================================================== */

const DIG = '0123456789'.split('');
/** Two turns plus a closing 0, so a wheel can roll either way from any digit. */
const WHEEL = Array.from({ length: 21 }, (_, i) => DIG[i % 10]);

function ticker(sc, { size, decimals = 0, duration = 420, stagger = 18, cls = '' }) {
  const lh = Math.round(size * 1.16);
  const wrap = el('span', `cc-tk ${cls}`);
  wrap.style.cssText = `font-size:${size}px;height:${lh}px;line-height:${lh}px;letter-spacing:${(-size * 0.02).toFixed(2)}px`;
  wrap.setAttribute('role', 'text');
  const cols = new Map();
  let dw = 0, sw = 0, cur = null;

  function measure() {
    if (!wrap.isConnected) return false;
    const p = el('span', 'cc-tk-probe');
    wrap.append(p);
    dw = 0;
    for (const d of DIG) { p.textContent = d; dw = Math.max(dw, p.getBoundingClientRect().width); }
    p.textContent = '.';
    sw = p.getBoundingClientRect().width;
    p.remove();
    return dw > 0;
  }

  function cells(v) {
    const fixed = Math.abs(v).toFixed(decimals);
    const [int, frac = ''] = fixed.split('.');
    const out = [];
    for (let i = 0; i < int.length; i++) { const place = int.length - 1 - i; out.push({ key: 'i' + place, ch: int[i], digit: true, order: -place }); }
    if (decimals) {
      out.push({ key: 'dec', ch: '.', digit: false, order: 0.5 });
      for (let i = 0; i < frac.length; i++) out.push({ key: 'f' + i, ch: frac[i], digit: true, order: 1 + i });
    }
    return out;
  }

  function sizeCells(col) {
    col.cw = col.c.digit ? dw : sw;
    for (const s of col.roll.children) s.style.width = col.cw + 'px';
  }

  function make(c, fresh) {
    const node = el('span', 'cc-tk-col');
    node.style.height = lh + 'px';
    const roll = el('span', 'cc-tk-roll');
    (c.digit ? WHEEL : [c.ch]).forEach((g) => { const s = el('span', 'cc-tk-cell'); s.textContent = g; s.style.height = lh + 'px'; roll.append(s); });
    node.append(roll);
    const col = { node, roll, c };
    sizeCells(col);
    const draw = () => {
      roll.style.transform = `translate3d(0,${col.y.v.toFixed(2)}px,0)`;
      node.style.width = Math.max(0, col.w.v).toFixed(2) + 'px';
      node.style.opacity = clamp(col.o.v).toFixed(3);
    };
    const shown = c.digit ? +c.ch : 0;
    col.y = value(sc, fresh ? 0 : -shown * lh, draw);
    col.w = value(sc, fresh ? 0 : col.cw, draw);
    col.o = value(sc, fresh ? 0 : 1, draw);
    draw();
    return col;
  }

  function set(v, { instant = false, duration: dur } = {}) {
    const up = cur === null || Math.abs(v) >= Math.abs(cur);
    cur = v;
    if (!dw && !measure()) return;
    const list = cells(v);
    const keys = new Set(list.map((c) => c.key));
    const first = cols.size === 0;
    const items = list.map((c) => ({ ...c, present: true }));
    for (const [key, col] of cols) if (!keys.has(key)) items.push({ ...col.c, present: false });
    items.sort((a, b) => a.order - b.order);
    const delays = {};
    let rank = 0;
    for (let i = items.length - 1; i >= 0; i--) { delays[items[i].key] = Math.min(rank, 6) * stagger; if (items[i].digit) rank++; }
    const ms = instant ? 0 : D(dur ?? duration);
    for (const it of items) {
      let col = cols.get(it.key);
      if (!col) { col = make(it, !first && !instant); cols.set(it.key, col); }
      if (it.present) col.c = it;
      wrap.append(col.node);
      const dl = ms ? delays[it.key] : 0;
      const shown = it.present && it.digit ? +it.ch : 0;
      // Re-base the wheel on the turn that leaves room in the direction of travel (same digit on
      // screen), then roll the short way that way.
      let c = (-col.y.v / lh) % 10;
      if (!up) c += 10;
      col.y.set(-c * lh);
      const to = up ? (shown >= c - 0.5 ? shown : shown + 10) : shown + 10 <= c + 0.5 ? shown + 10 : shown;
      col.y.to(-to * lh, ms, CALM, dl);
      col.w.to(it.present ? col.cw : 0, ms, CALM, it.present ? 0 : dl);
      col.o.to(it.present ? 1 : 0, ms * 0.6, CALM, it.present ? dl : 0);
      if (!it.present && !col.leaving) {
        col.leaving = true;
        sc.wait(ms + 300).then(() => { if (cols.get(it.key) === col && col.leaving) { col.node.remove(); cols.delete(it.key); } });
      } else if (it.present) col.leaving = false;
    }
    wrap.setAttribute('aria-label', Math.abs(v).toFixed(decimals));
  }

  // Webfonts can land after the first measure: refit the columns once they are ready.
  document.fonts?.ready.then(() => {
    if (!sc.alive || !measure()) return;
    for (const col of cols.values()) { sizeCells(col); if (!col.leaving) col.w.set(col.cw); }
    if (cur !== null && !cols.size) set(cur, { instant: true });
  });

  return { node: wrap, set, get value() { return cur; } };
}

/* ======================================================================================
   QuantityStepper (quantity-stepper.tsx)
   ====================================================================================== */

const P_MINUS = 'M6 12h12';
const P_PLUS = 'M12 6v12M6 12h12';
const P_TRASH = 'M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7M10.2 10.8v5.8M13.8 10.8v5.8';
const QS_SIZES = { sm: { h: 30, btn: 32, icon: 14, font: 13, stroke: 2.2 }, md: { h: 36, btn: 38, icon: 16, font: 15, stroke: 2.2 } };
const REPEAT_FROM = 380, REPEAT_TO = 60, REPEAT_RAMP = 1500;
/** Roll of a single step and the shortest one while repeating; trash arming delay. */
const ROLL = 360, ROLL_FAST = 140, TRASH_ARM = 320;
/** Stroke in px whatever the icon size, like the native Skia icon. */
const svgIcon = (d, size, stroke) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${((stroke * 24) / size).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

function strokeIcon(ctx, d, cx, cy, size, color, stroke) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = (stroke * 24) / size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(d));
  ctx.restore();
}

function stepper(sc, { initial = 1, min = 1, max = 99, size = 'md', onRemove, onChange }) {
  const m = QS_SIZES[size];
  const root = el('div', `cc-qs cc-qs-${size}`);
  root.style.height = m.h + 'px';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Quantity');
  const minus = el('button', 'cc-qs-btn');
  minus.type = 'button';
  minus.style.width = m.btn + 'px';
  const ico = el('span', 'cc-qs-ico');
  const mi = el('span', 'cc-qs-ic', svgIcon(P_MINUS, m.icon, m.stroke));
  const tr = el('span', 'cc-qs-ic cc-qs-trash', svgIcon(P_TRASH, m.icon, m.stroke * 0.85));
  ico.append(mi, tr);
  minus.append(ico);
  const plus = el('button', 'cc-qs-btn', `<span class="cc-qs-ico"><span class="cc-qs-ic">${svgIcon(P_PLUS, m.icon, m.stroke)}</span></span>`);
  plus.type = 'button';
  plus.style.width = m.btn + 'px';
  plus.setAttribute('aria-label', 'Increase');
  const tk = ticker(sc, { size: m.font, duration: 360, stagger: 18, cls: 'cc-qs-num' });
  tk.node.style.minWidth = m.font * 0.9 + 'px';
  root.append(minus, tk.node, plus);

  let q = initial;
  const trash = value(sc, 0, () => {
    const t = trash.v, rot = !RM.matches;
    mi.style.opacity = (1 - t).toFixed(3);
    mi.style.transform = rot ? `rotate(${(90 * t).toFixed(1)}deg)` : '';
    tr.style.opacity = t.toFixed(3);
    tr.style.transform = rot ? `rotate(${(90 * (t - 1)).toFixed(1)}deg)` : '';
  });
  const shake = value(sc, 0, () => { root.style.transform = shake.v ? `translate3d(${shake.v.toFixed(2)}px,0,0)` : ''; });
  const pressOf = (b) => {
    const k = value(sc, 1, () => { b.firstChild.style.transform = k.v !== 1 ? `scale(${k.v.toFixed(4)})` : ''; });
    return k;
  };
  const pm = pressOf(minus), pp = pressOf(plus);

  const isTrash = () => q <= min && !!onRemove;
  function sync(instant) {
    const t = isTrash() ? 1 : 0;
    instant ? trash.set(t) : trash.to(t, D(160, 150), CALM);
    minus.classList.toggle('dim', q <= min && !onRemove);
    minus.setAttribute('aria-label', t ? 'Remove' : 'Decrease');
    plus.classList.toggle('dim', q >= max);
    root.setAttribute('aria-valuenow', String(q));
  }
  function set(v, { instant = false, roll = ROLL } = {}) {
    q = clamp(v, min, max);
    tk.set(q, { instant, duration: roll });
    sync(instant);
  }
  async function bump() {
    if (RM.matches) return;
    const SIN = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
    for (const to of [-4, 4, -4, 4, 0]) if (!(await shake.to(to, 45, SIN))) return;
  }
  let lastStep = 0;
  /** One step. False when blocked, which also ends a hold. `pace` is the hold interval. */
  function step(dir, pace) {
    const next = q + dir;
    if (next > max || next < min) { if (pace === undefined || dir > 0) bump(); return false; }
    lastStep = performance.now();
    // The roll lasts about one and a half steps of the pace, so the digits never lag behind.
    set(next, { roll: pace === undefined ? ROLL : clamp(pace * 1.5, ROLL_FAST, ROLL) });
    onChange?.(q);
    return true;
  }
  // The trash arms once its morph is done: a fast double tap on minus stops at the minimum.
  const tapMinus = () => {
    if (!isTrash()) return step(-1);
    if (performance.now() - lastStep < TRASH_ARM) return;
    onRemove();
  };

  // Press in shrinks to 0.9; a tap steps on release; holding 380 ms repeats, accelerating to 60 ms over 1.5 s.
  let hold = null;
  function pressIn(btn, k, dir) {
    release(false);
    k.to(0.9, 90, CALM);
    const h = { btn, k, dir, long: false, alive: true };
    hold = h;
    sc.wait(REPEAT_FROM).then(async () => {
      if (hold !== h || !h.alive) return;
      h.long = true;
      if (dir < 0 && isTrash()) { tapMinus(); return; }
      const t0 = performance.now();
      while (h.alive && sc.alive) {
        const e = clamp((performance.now() - t0) / REPEAT_RAMP);
        const pace = REPEAT_FROM - (REPEAT_FROM - REPEAT_TO) * (1 - (1 - e) * (1 - e));
        if (!step(dir, pace)) break;
        await sc.wait(pace);
      }
    });
  }
  function release(tap) {
    if (!hold) return;
    const h = hold;
    hold = null;
    h.alive = false;
    h.k.spring(1, { stiffness: 380, damping: 15, mass: 0.7, eps: 0.002 });
    if (tap && !h.long) h.dir < 0 ? tapMinus() : step(1);
  }
  for (const [btn, dir, k] of [[minus, -1, pm], [plus, 1, pp]]) {
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch {}
      pressIn(btn, k, dir);
    });
    btn.addEventListener('pointerup', (e) => {
      const r = btn.getBoundingClientRect();
      const inside = e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6;
      release(inside);
    });
    btn.addEventListener('pointercancel', () => release(false));
    btn.addEventListener('click', (e) => {
      if (e.detail !== 0) return; // keyboard only, pointers are handled above
      dir < 0 ? tapMinus() : step(1);
    });
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  set(q, { instant: true });

  // Scripted presses for the autoplay.
  async function tap(btn) {
    const k = btn === minus ? pm : pp;
    await k.to(0.9, 90, CALM);
    await sc.wait(40);
    k.spring(1, { stiffness: 380, damping: 15, mass: 0.7, eps: 0.002 });
    btn === minus ? tapMinus() : step(1);
  }

  return { node: root, minus, plus, ticker: tk, set, tap, m, get value() { return q; } };
}

function mountStepper(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = Math.round(Math.min(tile ? 300 : 360, availW(body) || 340));
  const row = el('div', 'cc cc-qs-row');
  row.style.width = W + 'px';
  const art = el('span', 'cc-qs-art');
  art.style.backgroundImage = 'url(assets/paintings/tuscany.jpg)';
  if (tile) { art.style.width = art.style.height = '40px'; row.style.gap = '10px'; }
  const text = el('span', 'cc-qs-text', '<span class="cc-qs-title">Tuscany print</span><span class="cc-qs-sub">A3 matte, 24 €</span>');
  let busy = false;
  const st = stepper(sc, { initial: 1, min: 1, max: 99, size: tile ? 'sm' : 'md', onRemove: () => remove() });
  row.append(art, text, st.node);
  body.append(row);
  st.set(1, { instant: true });

  // The row exactly as drawn, for the dust.
  const snapRow = () => snapNode(row, [
    { node: row, fill: true, radius: 18 },
    { node: art, draw: (ctx, a) => { ctx.save(); rr(ctx, a.x, a.y, a.w, a.h, 12); ctx.clip(); cover(ctx, IMG.tuscany, a.x, a.y, a.w, a.h); ctx.restore(); } },
    ...[...text.children].map((node) => ({ node })),
    { node: st.node, fill: true, radius: 'pill' },
    { node: st.minus, draw: (ctx, m) => strokeIcon(ctx, P_TRASH, m.x + m.w / 2, m.y + m.h / 2, st.m.icon, getComputedStyle(st.minus.querySelector('.cc-qs-trash')).color, st.m.stroke * 0.85) },
    { node: st.plus, draw: (ctx, p, n) => strokeIcon(ctx, P_PLUS, p.x + p.w / 2, p.y + p.h / 2, st.m.icon, getComputedStyle(n).color, st.m.stroke) },
    { node: st.ticker.node, text: String(st.value), align: 'center' },
  ]);

  async function remove() {
    if (busy) return;
    busy = true;
    const src = snapRow();
    const r = rectOf(row);
    row.style.opacity = '0';
    row.inert = true;
    await sc.track(play({ source: src, ...r, preset: 'sand' })).done;
    if (!sc.alive) return;
    await sc.wait(900);
    // Back for another go: the row gathers in again.
    st.set(1, { instant: true });
    const back = snapRow();
    await sc.track(play({ source: back, ...rectOf(row), preset: 'gather', direction: 'in', duration: 800 })).done;
    if (!sc.alive) return;
    row.style.opacity = '';
    row.inert = false;
    busy = false;
  }

  return {
    async run() {
      if (busy) return;
      if (st.value > 3) { st.set(1); await sc.wait(500); }
      for (let i = 0; i < 4; i++) { await st.tap(st.plus); await sc.wait(260); }
      await sc.wait(500);
      while (st.value > 1 && sc.alive) { await st.tap(st.minus); await sc.wait(220); }
      await sc.wait(700);
      await st.tap(st.minus);
      while (busy && sc.alive) await sc.wait(100);
    },
  };
}

/* ======================================================================================
   RulerPicker (ruler-picker.tsx)
   ====================================================================================== */

const R_RUBBER = 0.3, R_MINOR = 12, R_HALF = 18, R_MAJOR = 26, R_WAKE = 4, R_SIGMA = 24, R_TOP = 10;

function mountRuler(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = Math.round(Math.min(tile ? 300 : 380, availW(body) || 340));
  const min = 30, max = 200, step = 0.1, majorEvery = 10, sp = 10, H = tile ? 64 : 76;
  const count = Math.round((max - min) / step), maxOff = count * sp;
  const toValue = (i) => Number((min + i * step).toFixed(1));
  const fontSize = tile ? 40 : mode === 'stage' ? 56 : 48;

  const root = el('div', 'cc cc-ru');
  root.style.width = W + 'px';
  const head = el('div', 'cc-ru-head');
  const tk = ticker(sc, { size: fontSize, decimals: 1, duration: 420, stagger: 18, cls: 'cc-ru-val' });
  const unit = el('span', 'cc-ru-unit', 'kg');
  unit.style.cssText = `font-size:${Math.round(fontSize * 0.36)}px;margin-bottom:${Math.round(fontSize * 0.2)}px`;
  head.append(tk.node, unit);
  const cv = el('canvas', 'cc-ru-canvas');
  cv.tabIndex = 0;
  cv.setAttribute('role', 'slider');
  cv.setAttribute('aria-label', 'Value in kg');
  cv.setAttribute('aria-valuemin', String(min));
  cv.setAttribute('aria-valuemax', String(max));
  root.append(head, cv);
  body.append(root);

  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');

  let C = {};
  const readColors = () => { const s = getComputedStyle(root); C = { ink: s.getPropertyValue('--text').trim(), muted: s.getPropertyValue('--muted').trim() }; };
  readColors();

  let off = Math.round((72.4 - min) / step) * sp;
  let vel = 0, wake = 0, lastOff = off, mode_ = 'idle', anim = null, raf = 0, last = 0;
  let shown = Math.round(off / sp), tkAt = 0;
  tk.set(toValue(shown), { instant: true });

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const first = Math.max(0, Math.floor((off - cx) / sp) - 1);
    const lastI = Math.min(count, Math.ceil((off + cx) / sp) + 1);
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let i = first; i <= lastI; i++) {
      const x = cx + i * sp - off, d = x - cx;
      const edge = Math.min(1, Math.abs(d) / cx);
      const fade = 1 - edge * edge * edge;
      if (fade <= 0.01) continue;
      const major = i % majorEvery === 0, half = !major && i % (majorEvery / 2) === 0;
      const len = (major ? R_MAJOR : half ? R_HALF : R_MINOR) + R_WAKE * wake * Math.exp(-(d * d) / (2 * R_SIGMA * R_SIGMA));
      const tw = major ? 2 : 1.5;
      const px = Math.round((x - tw / 2) * dpr) / dpr;
      ctx.globalAlpha = fade * (major ? 1 : 0.8);
      ctx.fillStyle = major ? C.ink : C.muted;
      rr(ctx, px, R_TOP, tw, len, tw / 2);
      ctx.fill();
      if (major) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = C.muted;
        ctx.fillText(String(Math.round(toValue(i))), Math.round(x * dpr) / dpr, R_TOP + R_MAJOR + R_WAKE + 18);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ink;
    rr(ctx, Math.round((cx - 2) * dpr) / dpr, 0, 4, R_TOP + R_MAJOR + R_WAKE + 4, 2);
    ctx.fill();
  }

  function readout(force) {
    const i = clamp(Math.round(off / sp), 0, count);
    if (i === shown && !force) return;
    const now = performance.now();
    if (!force && now - tkAt < 60) return; // coalesce fast flings, the last value always lands
    shown = i;
    tkAt = now;
    tk.set(toValue(i));
    cv.setAttribute('aria-valuenow', String(toValue(i)));
    cv.setAttribute('aria-valuetext', `${toValue(i)} kg`);
  }

  function tick(now) {
    raf = 0;
    if (!sc.alive) return;
    const dt = Math.max(1, Math.min(64, now - last));
    last = now;
    if (mode_ === 'decay') {
      vel *= Math.pow(0.997, dt);
      off += (vel * dt) / 1000;
      if (off <= 0 || off >= maxOff) { off = clamp(off, 0, maxOff); vel = 0; }
      if (Math.abs(vel) < 18) settle();
    } else if (mode_ === 'anim' && anim) {
      const k = anim.ms > 0 ? clamp((now - anim.t0) / anim.ms) : 1;
      off = anim.from + (anim.to - anim.from) * CALM(k);
      if (k >= 1) { const a = anim; anim = null; mode_ = 'idle'; a.done?.(); }
    }
    const speed = (Math.abs(off - lastOff) / dt) * 1000;
    lastOff = off;
    const target = RM.matches ? 0 : Math.min(speed / 1500, 1);
    wake = target > wake ? target : Math.max(target, wake - dt / 300);
    draw();
    readout(mode_ === 'idle');
    if (mode_ !== 'idle' || wake > 0 || shown !== clamp(Math.round(off / sp), 0, count)) kick();
  }
  function kick() { if (!raf && sc.alive) { last = last || performance.now(); raf = requestAnimationFrame(tick); } }
  sc.onDispose(() => cancelAnimationFrame(raf));

  function animTo(to, ms, done) {
    mode_ = 'anim';
    anim = { from: off, to, ms, t0: performance.now(), done };
    last = performance.now();
    kick();
  }
  function settle() {
    const i = clamp(Math.round(off / sp), 0, count);
    animTo(i * sp, D(300, 150));
  }
  function release(v) {
    if (off < 0 || off > maxOff) return animTo(off < 0 ? 0 : maxOff, D(420, 150));
    if (RM.matches) return settle();
    mode_ = 'decay';
    vel = v;
    last = performance.now();
    kick();
  }
  const rubber = (x) => (x < 0 ? x * R_RUBBER : x > maxOff ? maxOff + (x - maxOff) * R_RUBBER : x);
  const unrubber = (o) => (o < 0 ? o / R_RUBBER : o > maxOff ? maxOff + (o - maxOff) / R_RUBBER : o);

  // Pan: 1:1, rubber band past the bounds, momentum on release, then a calm snap.
  let g = null;
  cv.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    mode_ = 'drag';
    anim = null;
    vel = 0;
    g = { x0: e.clientX, y0: e.clientY, px: e.clientX, raw: unrubber(off), on: false, samples: [] };
    sample(g.samples, e);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.on) {
      if (e.pointerType !== 'mouse' && Math.abs(dy) > 12 && Math.abs(dx) <= 4) { g = null; settle(); return; }
      if (Math.abs(dx) <= 4) return;
      g.on = true;
      g.px = e.clientX;
      try { cv.setPointerCapture(e.pointerId); } catch {}
      cv.classList.add('dragging');
    }
    sample(g.samples, e);
    g.raw -= e.clientX - g.px;
    g.px = e.clientX;
    off = rubber(g.raw);
    kick();
  });
  const end = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    cv.classList.remove('dragging');
    if (!st.on || e.type === 'pointercancel') return settle();
    sample(st.samples, e);
    release(clamp(-velocity(st.samples).vx, -6000, 6000));
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  // Wheel and trackpad: the dominant axis scrolls the ruler, a snap follows once it rests.
  let wheelT = 0;
  cv.addEventListener('wheel', (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    e.preventDefault();
    mode_ = 'drag';
    anim = null;
    off = clamp(off + d * (e.deltaMode === 1 ? 16 : 1), 0, maxOff);
    kick();
    clearTimeout(wheelT);
    wheelT = setTimeout(() => sc.alive && settle(), 140);
  }, { passive: false });
  sc.onDispose(() => clearTimeout(wheelT));
  cv.addEventListener('keydown', (e) => {
    const k = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    const i = clamp(Math.round((anim ? anim.to : off) / sp) + k * (e.shiftKey ? majorEvery : 1), 0, count);
    animTo(i * sp, D(260, 150));
  });
  onTheme(sc, () => { readColors(); draw(); });
  draw();
  cv.setAttribute('aria-valuenow', String(toValue(shown)));

  const idle = async () => { while (sc.alive && mode_ !== 'idle') await sc.wait(60); };
  return {
    async run() {
      release(2300);
      await idle();
      await sc.wait(700);
      release(-1700);
      await idle();
      await sc.wait(400);
    },
  };
}

/* ======================================================================================
   BarChart (bar-chart.tsx)
   ====================================================================================== */

const WEEK = {
  format: (v) => `${fmtInt(v)} steps`,
  data: [['Mon', 6420], ['Tue', 8912], ['Wed', 7310], ['Thu', 10240], ['Fri', 5480], ['Sat', 12650], ['Sun', 9030]].map(([label, value]) => ({ label, value })),
};
const YEAR = {
  format: (v) => `${fmtInt(v)} h`,
  stacked: true,
  data: [
    ['Jan', [42, 18, 30]], ['Feb', [38, 22, 26]], ['Mar', [51, 25, 28]], ['Apr', [47, 31, 24]], ['May', [58, 34, 22]], ['Jun', [62, 40, 20]],
    ['Jul', [55, 46, 26]], ['Aug', [40, 38, 34]], ['Sep', [60, 30, 22]], ['Oct', [66, 28, 24]], ['Nov', [57, 24, 30]], ['Dec', [44, 20, 38]],
  ].map(([label, values]) => ({ label, values })),
};
const BC = {
  ENTER: 640, CHANGE: 820, REDUCED: 150, LANE: 46, AXIS: 34, HEAD: 8, DIM: 0.65,
  MIN_PITCH: 4.4, DOT_FILL: 0.7, MAX_DOT: 5, DOTS: 1400, FLEE: 44, PUSH: 20, K: 260, DAMP: 24,
};
const compact = (v) => {
  const a = Math.abs(v), trim = (n) => String(Math.round(n * 10) / 10);
  return a >= 1e6 ? `${trim(v / 1e6)}M` : a >= 1e3 ? `${trim(v / 1e3)}k` : trim(v);
};
const segmentsOf = (d, stacked) => {
  const raw = (d.values ?? [d.value ?? 0]).map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  return stacked ? raw : [raw.reduce((a, b) => a + b, 0)];
};
const totalOf = (d) => segmentsOf(d, false)[0];
/** Deterministic 0..1 noise, the same as hash() in bar-chart.tsx. */
const bcHash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Bars, round gridlines and their labels, like build() in bar-chart.tsx. */
function buildShown(data, stacked) {
  const vals = data.map((d) => segmentsOf(d, stacked));
  const max = Math.max(0, ...vals.map((s) => s.reduce((a, b) => a + b, 0)));
  if (!max) return { vals, top: 1, ticks: [0], tickText: ['0'] };
  const raw = max / 3, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { vals, top, ticks, tickText: ticks.map(compact) };
}

/** The dots of every bar, like layoutDots() in bar-chart.tsx: x, y, segment, bar, delay per dot. */
function layoutDots(s, plotW, height, gap, barRadius, budget, enter) {
  const n = s.vals.length, to = [];
  if (!n || plotW <= 0) return { to, count: 0, dot: 3 };
  const base = height - 1, scale = (height - 1 - BC.HEAD) / s.top, slot = plotW / n;
  const bw = Math.max(1.5, slot - Math.min(gap, slot * 0.4));
  const sums = s.vals.map((sg) => sg.reduce((a, b) => a + b, 0));
  const area = sums.reduce((a, v) => a + v * scale * bw, 0);
  let pitch = Math.max(BC.MIN_PITCH, Math.sqrt(area / budget));
  for (let tries = 0; tries < 12; tries++) {
    to.length = 0;
    const cols = Math.max(bw >= 5.5 ? 2 : 1, Math.round(bw / pitch)), cp = bw / cols;
    const dot = Math.min(BC.MAX_DOT, Math.max(1.8, Math.min(cp, pitch) * BC.DOT_FILL));
    const r = Math.min(barRadius, bw / 2);
    let maxRows = 1;
    for (let i = 0; i < n; i++) maxRows = Math.max(maxRows, Math.round((sums[i] * scale) / pitch));
    for (let i = 0; i < n; i++) {
      const h = sums[i] * scale;
      if (h < 1) continue;
      const rows = Math.max(1, Math.round(h / pitch)), rp = h / rows;
      const x0 = i * slot + (slot - bw) / 2, yt = base - h, rr_ = Math.min(r, h / 2), seg = s.vals[i];
      for (let k = 0; k < rows; k++) {
        const y = base - rp * (k + 0.5), v = ((k + 0.5) / rows) * sums[i];
        let acc = 0, sg = 0;
        for (let q = 0; q < seg.length; q++) { acc += seg[q]; sg = q; if (v <= acc) break; }
        for (let c = 0; c < cols; c++) {
          const x = x0 + cp * (c + 0.5);
          if (y - yt < rr_) {
            const ccx = x < x0 + rr_ ? x0 + rr_ : x > x0 + bw - rr_ ? x0 + bw - rr_ : x;
            if (Math.hypot(x - ccx, y - (yt + rr_)) + dot / 2 > rr_ + 0.25) continue;
          }
          const j = to.length / 5;
          const delay = enter ? (i / n) * 300 + (k / maxRows) * 220 + bcHash(j, 3) * 80 : (i / n) * 260 + bcHash(j, 3) * 140;
          to.push(x + (bcHash(j, 1) - 0.5) * cp * 0.22, y + (bcHash(j, 2) - 0.5) * rp * 0.22, sg, i, delay);
        }
      }
    }
    if (to.length / 5 <= budget) return { to, count: to.length / 5, dot };
    pitch *= 1.06;
  }
  to.length = Math.min(to.length, budget * 5);
  return { to, count: to.length / 5, dot: Math.max(1.8, pitch * BC.DOT_FILL) };
}

/** Any css color to 0..255 channels. */
function bcRGB(ctx, c) {
  ctx.fillStyle = '#000';
  ctx.fillStyle = c;
  const s = ctx.fillStyle;
  if (s[0] === '#') return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const m = s.match(/[\d.]+/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2]];
}

function mountChart(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = Math.round(Math.min(tile ? 300 : 420, availW(body) || 340));
  const height = tile ? 92 : mode === 'stage' ? 180 : 150;
  const lane = tile ? 40 : BC.LANE, gap = 6, barRadius = 6, plotW = W - BC.AXIS;
  const CAP = 1600;

  const root = el('div', 'cc cc-bc');
  root.style.width = W + 'px';
  const seg = el('div', 'cc-seg');
  seg.setAttribute('role', 'tablist');
  const tabs = [['Week', WEEK], ['Year', YEAR]].map(([name, set]) => {
    const b = el('button', 'cc-seg-btn', name);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => change(set));
    seg.append(b);
    return { b, set };
  });
  const laneEl = el('div', 'cc-bc-lane');
  laneEl.style.height = lane + 'px';
  const bubble = el('div', 'cc-bc-bubble', '<b></b><span></span>');
  laneEl.append(bubble);
  const plot = el('div', 'cc-bc-plot');
  plot.tabIndex = 0;
  plot.setAttribute('role', 'img');
  const cv = el('canvas');
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(height * dpr);
  cv.style.cssText = `display:block;width:${W}px;height:${height}px`;
  plot.append(cv);
  const labelsEl = el('div', 'cc-bc-labels');
  labelsEl.style.width = plotW + 'px';
  if (!tile) root.append(seg);
  root.append(laneEl, plot, labelsEl);
  body.append(root);
  const ctx = cv.getContext('2d');

  let C = {};
  const readColors = () => {
    const s = getComputedStyle(root), v = (n) => s.getPropertyValue(n).trim();
    C = { ink: v('--text'), muted: v('--muted'), border: v('--line-2'), accent: v('--accent'), success: v('--cc-success') };
    C.rgb = { ink: bcRGB(ctx, C.ink), accent: bcRGB(ctx, C.accent), success: bcRGB(ctx, C.success), muted: bcRGB(ctx, C.muted) };
    // Stacks: one ink in three strengths, mixed toward the panel behind the chart.
    let el = root, bg = '';
    while (el && (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(el).backgroundColor; el = el.parentElement; }
    const back = bcRGB(ctx, bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : v('--bg'));
    const mix = (t) => C.rgb.ink.map((c, i) => Math.round(c + (back[i] - c) * t));
    C.rgb.ink2 = mix(0.5); C.rgb.ink3 = mix(0.74);
    const light = isLight();
    C.rgb.c1 = light ? [255, 55, 135] : [255, 79, 152];
    C.rgb.c2 = light ? [124, 92, 255] : [142, 114, 255];
    C.rgb.c3 = light ? [255, 196, 0] : [255, 210, 51];
  };
  readColors();

  // Per dot state: pose and frozen pose (x, y, alpha, diameter, r, g, b), control point, repulsion.
  const P = new Float32Array(CAP * 7), F = new Float32Array(CAP * 7), Q = new Float32Array(CAP * 2), O = new Float32Array(CAP * 4);
  const RND = new Float32Array(CAP * 6);
  for (let j = 0; j < RND.length; j++) RND[j] = bcHash(Math.floor(j / 6), 10 + (j % 6));
  let pl = { enter: 1, count: 0, to: [], dot: 3 }, live = 0, t0 = 0, tEnd = 0, moving = 0;
  let ptr = null;

  let set = WEEK, shown = buildShown(set.data, !!set.stacked), prevShown = shown, active = -1, busy = false, raf = 0;
  const draw = () => { if (!raf && sc.alive) raf = requestAnimationFrame(paint); };
  sc.onDispose(() => cancelAnimationFrame(raf));
  const scrub = value(sc, 0, draw), pos = value(sc, 0, draw), gridMix = value(sc, 1, draw);
  const bx = value(sc, 0, () => placeBubble());
  let bubbleW = 0, last = performance.now();

  const palette = () => (set.stacked ? [C.rgb.c1, C.rgb.c2, C.rgb.c3] : [C.rgb.ink]);

  /** New layout: freeze the dots where they are and plan their path to the new bars. */
  function plan(enter) {
    const lay = layoutDots(shown, plotW, height, gap, barRadius, BC.DOTS, enter);
    const pc = palette(), base = height - 1, was = live, red = RM.matches;
    pl = { enter: enter ? 1 : 0, count: lay.count, to: lay.to, dot: lay.dot };
    F.set(P);
    for (let i = 0; i < Math.max(lay.count, was); i++) {
      const p = i * 7, q = i * 6, t = i * 5;
      if (i < lay.count) {
        const tx = lay.to[t], ty = lay.to[t + 1], col = pc[lay.to[t + 2] % pc.length];
        if (enter || i >= was) {
          // Born under the bar, scattered, transparent and small.
          F[p] = tx + (RND[q + 1] - 0.5) * 44; F[p + 1] = base - RND[q + 2] * 26; F[p + 2] = 0; F[p + 3] = lay.dot * 0.3;
          F[p + 4] = col[0]; F[p + 5] = col[1]; F[p + 6] = col[2];
          Q[i * 2] = (F[p] + tx) / 2 + (RND[q + 4] - 0.5) * 24; Q[i * 2 + 1] = (F[p + 1] + ty) / 2;
        } else {
          // Falls toward the floor on the way to its new bar.
          Q[i * 2] = (F[p] + tx) / 2 + (RND[q + 1] - 0.5) * 64;
          Q[i * 2 + 1] = Math.min(base - 2, Math.max(F[p + 1], ty) + 30 + RND[q + 2] * 60);
        }
      } else {
        // Leaves: falls to the floor and fades.
        Q[i * 2] = F[p] + (RND[q + 1] - 0.5) * 50; Q[i * 2 + 1] = Math.min(base - 2, F[p + 1] + 40);
      }
      if (red) { Q[i * 2] = F[p]; Q[i * 2 + 1] = F[p + 1]; }
    }
    live = Math.max(lay.count, was);
    t0 = performance.now();
    tEnd = t0 + (red ? BC.REDUCED : enter ? BC.ENTER : BC.CHANGE) + 600;
    draw();
    return sc.wait((red ? BC.REDUCED : enter ? BC.ENTER : BC.CHANGE) + 300);
  }

  function placeBubble() {
    const x = clamp(bx.v - bubbleW / 2, 0, Math.max(0, W - bubbleW));
    const s = scrub.v;
    bubble.style.opacity = s.toFixed(3);
    bubble.style.transform = `translate3d(${x.toFixed(2)}px,${((1 - s) * 4).toFixed(2)}px,0) scale(${(0.92 + 0.08 * s).toFixed(4)})`;
  }

  function labels() {
    labelsEl.textContent = '';
    const n = set.data.length, every = n <= 12 ? 1 : Math.ceil(n / 6);
    set.data.forEach((d, i) => { const l = el('span', 'cc-bc-label'); l.textContent = i % every === 0 ? d.label : ''; labelsEl.append(l); });
    tabs.forEach((t) => { t.b.classList.toggle('on', t.set === set); t.b.setAttribute('aria-selected', String(t.set === set)); });
    plot.setAttribute('aria-label', set.data.map((d) => `${d.label} ${set.format(totalOf(d))}`).join(', '));
  }

  function paint(now) {
    raf = 0;
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    const red = RM.matches, base = height - 1, hair = 1 / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, height);

    // Gridlines and axis, the old ones fading out under the new ones.
    ctx.font = `500 10px ${FONT}`;
    ctx.textAlign = 'left';
    const grid = (g, alpha) => {
      if (alpha <= 0.01) return;
      const scale = (height - 1 - BC.HEAD) / g.top;
      ctx.globalAlpha = alpha;
      for (let k = 0; k < g.ticks.length; k++) {
        const y = Math.round((base - g.ticks[k] * scale) * dpr) / dpr;
        if (k) { ctx.fillStyle = C.border; ctx.fillRect(0, y, plotW, hair); }
        ctx.fillStyle = C.muted;
        ctx.fillText(g.tickText[k], plotW + 6, k ? Math.min(base, Math.max(9, y + 3.5)) : base);
      }
    };
    grid(prevShown, 1 - gridMix.v);
    grid(shown, gridMix.v);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.border;
    ctx.fillRect(0, base, plotW, 1);

    const scv = scrub.v, ps = pos.v, n = shown.vals.length;
    if (scv > 0.01 && n) {
      const scale = (height - 1 - BC.HEAD) / shown.top, slot = plotW / n;
      const i0 = clamp(Math.floor(ps), 0, n - 1), i1 = Math.min(n - 1, i0 + 1), f = clamp(ps - i0);
      const sum = (i) => shown.vals[i].reduce((a, b) => a + b, 0);
      const h = (sum(i0) * (1 - f) + sum(i1) * f) * scale, cx = ps * slot + slot / 2;
      ctx.globalAlpha = scv * 0.5;
      ctx.fillStyle = C.muted;
      ctx.fillRect(Math.round(cx * dpr) / dpr - 0.5, 0, 1, Math.max(0, base - h - 6));
    }

    // Dots.
    const pc = palette(), dur = red ? BC.REDUCED : pl.enter ? BC.ENTER : BC.CHANGE, since = now - t0, dot = pl.dot;
    const fon = ptr && !red;
    moving = 0;
    for (let i = 0; i < live; i++) {
      const p = i * 7, t = i * 5, q = i * 6, z = RND[q], inPlan = i < pl.count;
      let tx, ty, ta = 0, ts = dot * 0.3, tr = F[p + 4], tg = F[p + 5], tb = F[p + 6], bar = -9, delay = RND[q + 5] * 140;
      if (inPlan) {
        tx = pl.to[t]; ty = pl.to[t + 1];
        const col = pc[pl.to[t + 2] % pc.length];
        tr = col[0]; tg = col[1]; tb = col[2];
        bar = pl.to[t + 3];
        delay = red ? 0 : pl.to[t + 4];
        ta = 0.8 + 0.2 * z;
        ts = dot * (0.86 + 0.28 * z);
      } else { tx = Q[i * 2]; ty = base - 2; }
      const k = clamp((since - delay) / dur), e = k === 1 ? 1 : CALM(k), u = 1 - e;
      const x = u * u * F[p] + 2 * u * e * Q[i * 2] + e * e * tx;
      const y = u * u * F[p + 1] + 2 * u * e * Q[i * 2 + 1] + e * e * ty;
      let a = F[p + 2] + (ta - F[p + 2]) * e;
      if (!pl.enter && e > 0 && e < 1) a *= 1 - 0.35 * Math.sin(Math.PI * e);
      const s = F[p + 3] + (ts - F[p + 3]) * e;
      const r = F[p + 4] + (tr - F[p + 4]) * e, g = F[p + 5] + (tg - F[p + 5]) * e, b = F[p + 6] + (tb - F[p + 6]) * e;
      P[p] = x; P[p + 1] = y; P[p + 2] = a; P[p + 3] = s; P[p + 4] = r; P[p + 5] = g; P[p + 6] = b;

      // Pointer repulsion with a little random spread, a spring brings the dot back.
      const o = i * 4;
      let gx = 0, gy = 0;
      if (fon) {
        const dx = x - ptr.x, dy = y - ptr.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < BC.FLEE) {
          const push = (1 - d / BC.FLEE) * BC.PUSH * (0.6 + 0.8 * RND[q + 3]);
          const ang = (d > 0.01 ? Math.atan2(dy, dx) : RND[q + 4] * 6.283) + (RND[q + 4] - 0.5) * 0.9;
          gx = Math.cos(ang) * push; gy = Math.sin(ang) * push;
        }
      }
      O[o + 2] += (BC.K * (gx - O[o]) - BC.DAMP * O[o + 2]) * dt;
      O[o + 3] += (BC.K * (gy - O[o + 1]) - BC.DAMP * O[o + 3]) * dt;
      O[o] += O[o + 2] * dt;
      O[o + 1] += O[o + 3] * dt;
      if (Math.abs(O[o]) + Math.abs(O[o + 1]) + Math.abs(O[o + 2]) + Math.abs(O[o + 3]) > 0.05) moving = 1;
      else if (!fon) O.fill(0, o, o + 4);

      const near = bar < 0 ? 1 : Math.max(0, 1 - Math.abs(bar - ps));
      const alpha = clamp(a * (1 - scv * BC.DIM * (1 - near)));
      if (alpha < 0.004 || s < 0.1) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.beginPath();
      ctx.arc(x + O[o], y + O[o + 1], s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (now > tEnd && live > pl.count) live = pl.count;

    // Labels far from the pointer step back while scrubbing.
    [...labelsEl.children].forEach((l, i) => { l.style.opacity = (1 - scv * 0.5 * (1 - Math.max(0, 1 - Math.abs(i - ps)))).toFixed(3); });
    placeBubble();
    if (fon || moving || now < tEnd) draw();
  }

  async function change(next) {
    if (busy || next === set) return;
    busy = true;
    releaseScrub();
    set = next;
    prevShown = shown;
    shown = buildShown(set.data, !!set.stacked);
    labels();
    gridMix.set(0);
    gridMix.to(1, D(420, 150), CALM);
    await plan(false);
    busy = false;
  }

  const SPRING = { stiffness: 260, damping: 22, eps: 0.002 };
  function select(i) {
    const n = shown.vals.length;
    i = clamp(i, 0, n - 1);
    if (i === active) return;
    const jump = active < 0 && scrub.v < 0.05;
    active = i;
    const cx = i * (plotW / n) + plotW / n / 2;
    const d = set.data[i];
    bubble.firstChild.textContent = set.format(totalOf(d));
    bubble.lastChild.textContent = d.label;
    bubbleW = bubble.offsetWidth;
    if (jump || RM.matches) { pos.set(i); bx.set(cx); }
    else { pos.spring(i, SPRING); bx.spring(cx, { ...SPRING, eps: 0.05 }); }
    scrub.to(1, D(160, 150), CALM);
  }
  function releaseScrub() {
    ptr = null;
    draw();
    if (active < 0) return;
    active = -1;
    scrub.to(0, D(250, 150), CALM);
  }
  const local = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const indexAt = (clientX) => Math.floor((clientX - cv.getBoundingClientRect().left) / (plotW / shown.vals.length));
  const touch = (e) => { ptr = local(e); draw(); select(indexAt(e.clientX)); };

  // Mouse scrubs on hover. Touch: a sideways pan right away, or a 120 ms press and hold.
  let g = null;
  plot.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { if (!busy) touch(e); return; }
    const st = { x0: e.clientX, y0: e.clientY, e, on: false, id: e.pointerId };
    g = st;
    sc.wait(120).then(() => { if (g === st && !st.on && !busy) { st.on = true; try { plot.setPointerCapture(st.id); } catch {} touch(st.e); } });
  });
  plot.addEventListener('pointermove', (e) => {
    if (busy) return;
    if (e.pointerType === 'mouse') { touch(e); return; }
    if (!g) return;
    if (!g.on) {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.abs(dy) > 10 && Math.abs(dx) < 6) { g = null; return; }
      if (Math.abs(dx) < 6) return;
      g.on = true;
      try { plot.setPointerCapture(e.pointerId); } catch {}
    }
    touch(e);
  });
  const end = (e) => { if (e.pointerType === 'mouse' && e.type !== 'pointerleave') return; g = null; releaseScrub(); };
  plot.addEventListener('pointerup', end);
  plot.addEventListener('pointercancel', end);
  plot.addEventListener('pointerleave', end);
  plot.addEventListener('keydown', (e) => {
    const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (k) { e.preventDefault(); select(active < 0 ? 0 : active + k); }
    else if (e.key === 'Escape') releaseScrub();
  });
  plot.addEventListener('blur', releaseScrub);
  onTheme(sc, () => {
    readColors();
    draw();
  });

  labels();
  plan(true);

  // Scripted pointer for the autoplay: a real mouse pass. It glides across the bars with a soft
  // vertical wave, the bar under it lights up and the dots scatter around it, then it leaves.
  const sweep = (x0, x1, ms) => new Promise((done) => {
    const t0 = performance.now(), n = shown.vals.length;
    const step = (now) => {
      if (!sc.alive) return done();
      const t = Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = x0 + (x1 - x0) * e;
      ptr = { x, y: height * (0.55 + 0.22 * Math.sin(t * Math.PI * 3)) };
      select(Math.max(0, Math.min(n - 1, Math.floor(x / (plotW / n)))));
      draw();
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  return {
    async run() {
      if (busy) return;
      busy = true;
      await plan(true);
      busy = false;
      // Let the dots land before the pointer arrives.
      await sc.wait(BC.ENTER + 900);
      await sweep(plotW * 0.04, plotW * 0.96, 2600);
      await sc.wait(250);
      await sweep(plotW * 0.96, plotW * 0.45, 1300);
      await sc.wait(600);
      ptr = null;
      releaseScrub();
      draw();
      await sc.wait(700);
      await change(set === WEEK ? YEAR : WEEK);
      await sc.wait(BC.CHANGE + 400);
      await sweep(plotW * 0.1, plotW * 0.9, 2200);
      ptr = null;
      releaseScrub();
      draw();
      await sc.wait(400);
    },
  };
}

/* ======================================================================================
   MiniPlayer (mini-player.tsx)
   ====================================================================================== */

const TRACKS = [
  { img: 'lake', title: 'Still Water', artist: 'Mara Lind' },
  { img: 'tuscany', title: 'Golden Hours', artist: 'The Olive Rows' },
  { img: 'cypress', title: 'Night Garden', artist: 'Ines Vale' },
];
// Six covers: the last row runs under the pill, so the glass has something to blur.
const LIBRARY = [['pond', 'Low Tide'], ['temple', 'Old Light'], ['valley', 'Wide Open'], ['villa', 'Summer Rooms'], ['tuscany', 'Golden Hours'], ['cypress', 'Night Garden']];
const fill = (d) => `<svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
const I_PLAY = fill('M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z');
const I_PAUSE = fill('M6.6 4h3.2a1.1 1.1 0 0 1 1.1 1.1v13.8a1.1 1.1 0 0 1-1.1 1.1H6.6a1.1 1.1 0 0 1-1.1-1.1V5.1A1.1 1.1 0 0 1 6.6 4zm7.6 0h3.2a1.1 1.1 0 0 1 1.1 1.1v13.8a1.1 1.1 0 0 1-1.1 1.1h-3.2a1.1 1.1 0 0 1-1.1-1.1V5.1A1.1 1.1 0 0 1 14.2 4z');
const I_NEXT = fill('M2.5 6.6v10.8a.9.9 0 0 0 1.4.74L11.5 13v4.4a.9.9 0 0 0 1.4.74l8.4-5.4a.9.9 0 0 0 0-1.5l-8.4-5.4a.9.9 0 0 0-1.4.74V11L3.9 5.86a.9.9 0 0 0-1.4.74z');
const I_PREV = I_NEXT.replace('<svg ', '<svg style="transform:scaleX(-1)" ');
const stroke = (d) => `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const EXTRAS = [
  [stroke('M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8.5 9.5v2.2M8.5 9.5h1.6M13.5 9.5v2.2M13.5 9.5h1.6'), 'Lyrics'],
  [stroke('M7 17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M12 15l5 6H7z'), 'AirPlay'],
  [stroke('M8.5 6.5h12M8.5 12h12M8.5 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01'), 'Up next'],
];
const MP = { PILL_H: 64, ART_C: 40, TITLE: 22, TITLE_C: 15, SKIP: 24, LEN: 214, TEXT_X: 64, CTRL_W: 92, TEXT_GAP: 12, TITLE_LH: 28, SUB_LH: 17, SUB_GAP: 1 };
const POP = { stiffness: 420, damping: 15, mass: 0.6, eps: 0.002 };
const fmtT = (s) => { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function mountPlayer(body, { sc, mode }) {
  const tile = mode === 'tile';
  const CW = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(330, availW(body) || 320));
  const CH = tile ? 480 : mode === 'stage' ? 580 : 520;
  const bottom = 24, topInset = 48;
  const { PILL_H, ART_C, TITLE, TITLE_C, SKIP, TEXT_X, CTRL_W, TEXT_GAP, TITLE_LH, SUB_LH, SUB_GAP } = MP;

  // Geometry, all in frame pixels (mini-player.tsx). Everything is an explicit interpolation of `o`.
  const Wc = Math.round(CW * 0.92), Hx = Math.max(PILL_H, CH - topInset), range = Math.max(1, Hx - PILL_H - bottom);
  const A = Math.max(120, Math.min(CW - 64, Hx - 48 - 300 - bottom));
  const artX1 = (CW - A) / 2, artY1 = 48, scC = TITLE_C / TITLE;
  // Pill text column: beside the artwork, TEXT_GAP before the controls; title and subtitle
  // vertically centered as one block. The title width comes from a probe (natural width).
  const availC = Math.max(40, Wc - TEXT_X - CTRL_W - TEXT_GAP), fullMax = Math.max(40, CW - 64);
  const titleY0 = (PILL_H - (TITLE_LH * scC + SUB_GAP + SUB_LH)) / 2, subY0 = titleY0 + TITLE_LH * scC + SUB_GAP;
  const titleY1 = artY1 + A + 24, blockTop = titleY1 + 34, blockH = Math.max(0, Hx - blockTop - bottom);

  const frame = el('div', 'cc cc-mp');
  frame.style.width = CW + 'px';
  frame.style.height = CH + 'px';
  // What sits behind the player in the frame: a small library grid.
  const lib = el('div', 'cc-mp-lib', `<p class="cc-mp-lib-h">Library</p><div class="cc-mp-grid">${LIBRARY.map(([img, t]) => `<div><i style="background-image:url(assets/paintings/${img}.jpg)"></i><span>${t}</span></div>`).join('')}</div>`);
  const backdrop = el('div', 'cc-mp-backdrop');
  const sheet = el('div', 'cc-mp-sheet');
  const hit = el('button', 'cc-mp-hit');
  const art = el('div', 'cc-mp-art');
  art.style.width = art.style.height = A + 'px';
  const titleEl = el('span', 'cc-mp-title');
  const probe = el('span', 'cc-mp-title cc-mp-probe');
  probe.setAttribute('aria-hidden', 'true');
  const sub = el('span', 'cc-mp-sub');
  sub.style.width = availC + 'px';
  sub.style.top = subY0.toFixed(2) + 'px';
  const pbtns = el('div', 'cc-mp-pbtns');
  const ringSvg = `<svg class="cc-mp-ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="var(--line-2)" stroke-width="2"/><circle class="cc-mp-ring-fill" cx="20" cy="20" r="18" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" transform="rotate(-90 20 20)" pathLength="1" stroke-dasharray="1 1"/></svg>`;
  const glyph = (size) => `<span class="cc-mp-glyph" style="width:${size}px;height:${size}px"><span class="g-play">${I_PLAY}</span><span class="g-pause">${I_PAUSE}</span></span>`;
  const pPlay = el('button', 'cc-mp-btn', ringSvg + glyph(17));
  const pNext = el('button', 'cc-mp-btn', `<span class="cc-mp-ic" style="width:20px;height:20px">${I_NEXT}</span>`);
  pNext.setAttribute('aria-label', 'Next track');
  pbtns.append(pPlay, pNext);
  const grab = el('button', 'cc-mp-grab', '<i></i>');
  grab.setAttribute('aria-label', 'Close player');
  const block = el('div', 'cc-mp-block');
  block.style.cssText = `top:${blockTop}px;width:${CW}px;height:${blockH}px`;
  const bsub = el('p', 'cc-mp-bsub');
  const barW = CW - 64;
  const bar = el('div', 'cc-mp-bar', `<svg width="${barW}" height="14" viewBox="0 0 ${barW} 14" aria-hidden="true"><path d="M2 7H${Math.max(3, barW - 2)}" stroke="var(--line-2)" stroke-width="4" stroke-linecap="round"/><path class="cc-mp-bar-fill" d="M2 7H${Math.max(3, barW - 2)}" stroke="var(--text)" stroke-width="4" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/></svg>`);
  const times = el('div', 'cc-mp-times', '<span></span><span></span>');
  const ctr = el('div', 'cc-mp-ctr');
  const fPrev = el('button', 'cc-mp-btn', `<span class="cc-mp-ic" style="width:30px;height:30px">${I_PREV}</span>`);
  const fPlay = el('button', 'cc-mp-btn', glyph(42));
  const fNext = el('button', 'cc-mp-btn', `<span class="cc-mp-ic" style="width:30px;height:30px">${I_NEXT}</span>`);
  fPrev.style.cssText = fNext.style.cssText = 'width:64px;height:64px';
  fPlay.style.cssText = 'width:76px;height:76px';
  fPrev.setAttribute('aria-label', 'Previous track');
  fNext.setAttribute('aria-label', 'Next track');
  ctr.append(fPrev, fPlay, fNext);
  const extras = el('div', 'cc-mp-extras');
  EXTRAS.forEach(([icon, label]) => { const b = el('button', 'cc-mp-btn', `<span class="cc-mp-ic" style="width:20px;height:20px">${icon}</span>`); b.setAttribute('aria-label', label); b.style.cssText = 'width:44px;height:44px;color:var(--muted)'; extras.append(b); });
  block.append(bsub, bar, times, ctr, el('div', 'cc-mp-spacer'), extras);
  sheet.append(hit, probe, art, titleEl, sub, pbtns, grab, block);
  frame.append(lib, backdrop, sheet);
  const buttons = [hit, pPlay, pNext, grab, fPrev, fPlay, fNext, ...extras.children];
  buttons.forEach((b) => { b.type = 'button'; });
  body.append(tile ? fitTile(body, frame, CW, CH) : frame);

  let idx = 0, playing = false, progress = 0.32, opened = false, natW = 0;

  const render = () => {
    const v = clamp(o.v), sw = swipe.v;
    const w = Wc + (CW - Wc) * v;
    sheet.style.width = w.toFixed(2) + 'px';
    sheet.style.height = (PILL_H + (Hx - PILL_H) * v).toFixed(2) + 'px';
    sheet.style.transform = `translate3d(${((CW - w) / 2).toFixed(2)}px,${(CH - bottom * (1 - v) - (PILL_H + (Hx - PILL_H) * v)).toFixed(2)}px,0)`;
    sheet.style.borderRadius = (PILL_H / 2 + (38 - PILL_H / 2) * v).toFixed(2) + 'px';
    backdrop.style.opacity = (v * 0.8).toFixed(3);
    backdrop.style.pointerEvents = opened ? 'auto' : 'none';
    // Artwork: laid out at its open size and scaled. Y leads X, so it arcs into place.
    const vy = 1 - (1 - v) * (1 - v), size = ART_C + (A - ART_C) * v, k = size / A;
    const fadeSw = 1 - (Math.abs(sw) / SKIP) * 0.75 * (1 - v);
    art.style.borderRadius = ((8 + 6 * v) / k).toFixed(2) + 'px';
    art.style.opacity = fadeSw.toFixed(3);
    art.style.transform = `translate3d(${(12 + (artX1 - 12) * v + sw * (1 - v)).toFixed(2)}px,${(12 + (artY1 - 12) * vy).toFixed(2)}px,0) scale(${k.toFixed(4)})`;
    // The title travels from beside the artwork to centered below it. Its box is sized from the
    // measured natural width (truncated before the controls in the pill), and Y leads X like the
    // artwork, so it drops below the growing artwork instead of crossing it.
    const w0 = Math.min(natW, availC / scC), w1 = Math.min(natW, fullMax);
    titleEl.style.width = (w0 + (w1 - w0) * v).toFixed(2) + 'px';
    titleEl.style.opacity = natW ? fadeSw.toFixed(3) : '0';
    titleEl.style.transform = `translate3d(${(TEXT_X + ((CW - w1) / 2 - TEXT_X) * v + sw * 0.5 * (1 - v)).toFixed(2)}px,${(titleY0 + (titleY1 - titleY0) * vy).toFixed(2)}px,0) scale(${(scC + (1 - scC) * v).toFixed(4)})`;
    const kp = clamp(v / 0.35);
    pbtns.style.opacity = (1 - kp).toFixed(3);
    pbtns.style.transform = `scale(${(1 - 0.04 * kp).toFixed(4)})`;
    pbtns.style.visibility = kp < 1 ? 'visible' : 'hidden';
    sub.style.opacity = ((1 - kp) * (1 - (Math.abs(sw) / SKIP) * 0.75)).toFixed(3);
    sub.style.transform = `translate3d(${(sw * 0.5).toFixed(2)}px,0,0)`;
    const kb = clamp((v - 0.5) / 0.5);
    block.style.left = (-(CW - w) / 2).toFixed(2) + 'px';
    block.style.opacity = kb.toFixed(3);
    block.style.transform = `scale(${(0.96 + 0.04 * kb).toFixed(4)})`;
    block.style.visibility = kb > 0 ? 'visible' : 'hidden';
    grab.style.opacity = kb.toFixed(3);
    grab.style.visibility = kb > 0 ? 'visible' : 'hidden';
  };
  const o = value(sc, 0, render), swipe = value(sc, 0, render);

  const glyphs = [...frame.querySelectorAll('.cc-mp-glyph')];
  const pg = value(sc, 0, () => {
    const p = clamp(pg.v, -0.2, 1.2);
    glyphs.forEach((gl) => {
      gl.firstChild.style.opacity = clamp(1 - p).toFixed(3);
      gl.firstChild.style.transform = `scale(${(0.6 + 0.4 * (1 - p)).toFixed(4)})`;
      gl.lastChild.style.opacity = clamp(p).toFixed(3);
      gl.lastChild.style.transform = `scale(${(0.6 + 0.4 * p).toFixed(4)})`;
    });
  });
  pg.set(0);

  const ringFill = frame.querySelector('.cc-mp-ring-fill'), barFill = frame.querySelector('.cc-mp-bar-fill');
  function showProgress() {
    ringFill.style.strokeDashoffset = (1 - progress).toFixed(4);
    barFill.style.strokeDashoffset = (1 - progress).toFixed(4);
    times.firstChild.textContent = fmtT(progress * MP.LEN);
    times.lastChild.textContent = '-' + fmtT((1 - progress) * MP.LEN);
  }
  function showTrack() {
    const tr = TRACKS[idx];
    art.style.backgroundImage = `url(assets/paintings/${tr.img}.jpg)`;
    titleEl.textContent = probe.textContent = tr.title;
    sub.textContent = bsub.textContent = tr.artist;
    natW = Math.ceil(probe.getBoundingClientRect().width);
    hit.setAttribute('aria-label', `${tr.title}, ${tr.artist}. Opens the player`);
    showProgress();
    render();
  }
  function showPlay() {
    RM.matches ? pg.set(playing ? 1 : 0) : pg.spring(playing ? 1 : 0, POP);
    [pPlay, fPlay].forEach((b) => b.setAttribute('aria-label', playing ? 'Pause' : 'Play'));
  }
  const togglePlay = () => { playing = !playing; showPlay(); };
  // Playback clock, 4 Hz, asleep while the player is off screen.
  const seen = onScreen(sc, body);
  (async () => {
    while (sc.alive) {
      await sc.wait(250);
      if (!seen.on) await seen.shown();
      if (playing) { progress = (progress + 0.25 / MP.LEN) % 1; showProgress(); }
    }
  })();

  function request(t, ms = 500) {
    opened = t === 1;
    frame.classList.toggle('open', opened);
    hit.hidden = opened;
    sheet.setAttribute('aria-expanded', String(opened));
    render();
    return o.to(t, D(ms, 220), CALM);
  }
  function skip(dir) {
    // dir < 0: swiped left, next track.
    idx = (idx + (dir < 0 ? 1 : -1) + TRACKS.length) % TRACKS.length;
    progress = 0.02;
    showTrack();
  }
  async function swipeOut(dir) {
    const d = RM.matches ? 0 : SKIP;
    if (!(await swipe.to(dir * d, 110, CALM))) return;
    skip(dir);
    swipe.set(-dir * d);
    await swipe.to(0, D(320), CALM);
  }

  [pPlay, fPlay].forEach((b) => b.addEventListener('click', togglePlay));
  pNext.addEventListener('click', () => swipeOut(-1));
  fNext.addEventListener('click', () => skip(-1));
  fPrev.addEventListener('click', () => skip(1));
  grab.addEventListener('click', () => request(0));
  backdrop.addEventListener('click', () => request(0));
  hit.addEventListener('click', (e) => { if (e.detail === 0 && !opened) request(1); });
  const controls = [pPlay, pNext, grab, fPrev, fPlay, fNext, ...extras.children];
  controls.forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.classList.add('down'); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => b.classList.remove('down'));
  });

  // Vertical pan drives `o` 1:1 (open or closed); a sideways pan on the closed pill skips.
  let g = null;
  // Touch: up opens the pill, down closes the sheet; the other way scrolls the page.
  const claimed = claimTouch(sheet, (dx, dy) => !!g && (opened ? dy > 0 : dy < 0));
  sheet.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    g = { x0: e.clientX, y0: e.clientY, axis: 0, start: o.v, side: o.v > 0.5, samples: [], t0: performance.now() };
    sample(g.samples, e);
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!g) return;
    sample(g.samples, e);
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.axis) {
      if (!opened && Math.abs(dx) > 12 && Math.abs(dy) <= 10) g.axis = 1;
      else if (Math.abs(dy) > 8 && Math.abs(dx) <= 24) {
        if (e.pointerType === 'touch' && !claimed()) { g = null; return; }
        g.axis = 2;
      } else if (Math.abs(dx) > 24) { g = null; return; }
      else return;
      try { sheet.setPointerCapture(e.pointerId); } catch {}
      sheet.classList.add('dragging');
      if (g.axis === 2) opened = g.start > 0.5;
    }
    if (g.axis === 1) swipe.set(clamp(dx * 0.5, -SKIP, SKIP));
    else o.set(clamp(g.start - dy / range));
  });
  const end = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    sheet.classList.remove('dragging');
    const { vx, vy } = velocity(st.samples);
    if (st.axis === 1) {
      const dx = e.clientX - st.x0;
      if (e.type === 'pointerup' && (Math.abs(dx) > 56 || Math.abs(vx) > 500)) swipeOut((dx || vx) < 0 ? -1 : 1);
      else swipe.to(0, D(260), CALM);
      return;
    }
    if (st.axis === 2) {
      const t = Math.abs(vy) > 600 ? (vy < 0 ? 1 : 0) : o.v > 0.5 ? 1 : 0;
      request(t, 420);
      return;
    }
    if (e.type === 'pointerup' && !opened && performance.now() - st.t0 < 500) request(1);
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && opened) { e.preventDefault(); request(0); hit.focus({ preventScroll: true }); }
  });

  showTrack();
  document.fonts?.ready.then(() => { if (sc.alive) { natW = Math.ceil(probe.getBoundingClientRect().width); render(); } });

  return {
    async run() {
      if (opened) await request(0);
      await sc.wait(250);
      await request(1);
      await sc.wait(400);
      togglePlay();
      await sc.wait(1600);
      await request(0);
      await sc.wait(600);
      await swipeOut(-1);
      await sc.wait(700);
      if (playing) togglePlay();
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'quantity-stepper': {
    title: 'QuantityStepper',
    note: 'Digits roll; at one the minus becomes a trash.',
    desc: 'A minus and plus stepper with rolling digits. A tap steps once; hold a button and it repeats from 380 ms down to 60 ms over 1.5 s, the digits rolling like an odometer and always in sync. At the minimum the minus turns into a trash, armed once its morph is done so a fast double tap never removes the row; tap it and the whole row falls away as sand. At the maximum the pill shakes.',
    hint: 'Tap or hold the buttons, go down to the trash',
    tileHint: 'Tap the buttons',
    mount: mountStepper,
    code: add('quantity-stepper', 'QuantityStepper', `const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <QuantityStepper
    value={qty}
    onChange={setQty}
    onRemove={async () => {
      await dissolve({ preset: 'sand' });
      removeFromCart(item.id);
    }}
  />
</View>`),
    props: [
      prop('value', 'number', 'required', 'The quantity. Digits roll whenever it changes.'),
      prop('onChange', '(value: number) =&gt; void', 'required', 'Called on every step: once per tap (on release), then at 380 ms on hold, accelerating to 60 ms.'),
      prop('min', 'number', '1', 'Lowest value. With onRemove the minus turns into a trash there.'),
      prop('max', 'number', '99', 'Highest value. Going past it shakes the pill.'),
      prop('onRemove', '() =&gt; void', '', 'When set, the minus becomes a trash at the minimum and calls this on tap (ignored for 320 ms after reaching it). Dissolve your row here.'),
      prop('size', `'sm' | 'md'`, `'md'`, 'Pill height, 30 or 36.'),
      prop('haptics', 'boolean', 'true', 'A tick per step, medium on remove, warning at max.'),
      prop('className', 'string', '', 'Pill classes (background, radius, margins...).'),
      prop('textClassName', 'string', '', 'Count classes (weight, color...).'),
    ],
  },
  'ruler-picker': {
    title: 'RulerPicker',
    note: 'Fling the ruler, it glides and snaps.',
    desc: 'A horizontal ruler you drag under a center needle: 1:1 pan, momentum, then a calm snap on the nearest step. The value rolls above it. Graduations near the needle stretch with speed, and a haptic tick lands on every step.',
    hint: 'Drag or fling the ruler, or scroll over it',
    tileHint: 'Fling the ruler',
    mount: mountRuler,
    code: add('ruler-picker', 'RulerPicker', `<RulerPicker
  value={kg}
  onChange={setKg}
  min={30}
  max={200}
  step={0.1}
  unit="kg"
/>`),
    props: [
      prop('value', 'number', 'required', 'Current value. An outside change glides the ruler to it.'),
      prop('onChange', '(value: number) =&gt; void', '', 'Called once the ruler is at rest on a new value.'),
      prop('onChanging', '(value: number) =&gt; void', '', 'Called on every step crossed while dragging or gliding.'),
      prop('min / max', 'number', 'required', 'Bounds. Past them the ruler follows with a 0.3 rubber band.'),
      prop('step', 'number', '1', 'Value between two graduations.'),
      prop('majorEvery', 'number', '10', 'A labelled major graduation every N steps.'),
      prop('unit', 'string', '', `Unit next to the value, e.g. 'kg'.`),
      prop('format', '(value: number) =&gt; string', '', 'Formats the labels and the accessibility value.'),
      prop('tickSpacing', 'number', '10', 'Distance between two graduations, pt.'),
      prop('height', 'number', '76', 'Ruler height.'),
      prop('showValue', 'boolean', 'true', 'Shows the rolling value above the ruler.'),
      prop('fontSize', 'number', '56', 'Value size.'),
      prop('haptics', 'boolean', 'true', 'A tick per step, light on majors, rigid at the bounds.'),
      prop('className', 'string', '', 'Root classes (margins, width...).'),
      prop('valueClassName', 'string', '', 'Value classes, passed to NumberTicker.'),
    ],
  },
  'bar-chart': {
    title: 'BarChart',
    note: 'Bars made of dots, scrub them and they scatter.',
    desc: 'A bar chart built from small round dots, a slightly jittered grid with a rounded top per bar. The dots fly in and assemble the bars with a short stagger. Scrub with a finger: the bar under it stays lit while the others step back, a bubble with the value slides along, and the dots near the finger scatter away, then spring back. New data sends the dots falling from the old bars and gathers them into the new ones. Stacked series use the chart tokens: pink, violet and yellow.',
    hint: 'Hover or drag across the bars, switch the period',
    tileHint: 'Scrub the bars',
    mount: mountChart,
    code: add('bar-chart', 'BarChart', `<BarChart
  data={[{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }]}
  formatValue={(v) => \`\${v.toLocaleString()} steps\`}
  onSelect={(i) => setDay(i)}
/>

<BarChart stacked maxDots={1000} data={[{ label: 'Jan', values: [42, 18, 30] }]} />`),
    props: [
      prop('data', '{ label, value?, values? }[]', 'required', 'One bar per item. values are segments, bottom to top. Pass a stable array: new data replays the gather.'),
      prop('height', 'number', '180', 'Plot height. The bubble lane and labels come on top.'),
      prop('formatValue', '(value: number) =&gt; string', 'grouped', 'Text of the bubble.'),
      prop('formatAxis', '(value: number) =&gt; string', 'compact', 'Axis labels, e.g. 1.2k.'),
      prop('onSelect', '(index: number | null, datum?) =&gt; void', '', 'Bar under the finger, then null on release.'),
      prop('stacked', 'boolean', 'false', 'Draws values as stacked segments.'),
      prop('colors', 'BarToken[]', `['primary']`, `Segment colors as theme tokens. ['chart-1', 'chart-2', 'chart-3'] (pink, violet, yellow) when stacked.`),
      prop('barRadius', 'number', '6', 'Rounding of the top of each dot column.'),
      prop('maxDots', 'number', '1400', 'Dot budget for the whole chart, the grid gets coarser past it. At most 1600.'),
      prop('gap', 'number', '6', 'Space between bars, shrinks on dense charts.'),
      prop('labelEvery', 'number', '', 'One label every N bars. Default: all up to 12 bars.'),
      prop('axis', 'boolean', 'true', 'Value axis on the right.'),
      prop('haptics', 'boolean', 'true', 'A tick per bar change while scrubbing.'),
      prop('className', 'string', '', 'Root classes (margins, padding...).'),
      prop('bubbleClassName', 'string', '', 'Bubble classes (background, radius...).'),
    ],
  },
  'mini-player': {
    title: 'MiniPlayer',
    note: 'The now playing pill opens into the player.',
    desc: 'A now playing bar in liquid glass that opens into the full player as one object, then folds back. Width, height, radius, artwork and the glass surface all follow one value, the artwork arcs into place, and a vertical drag drives it 1:1. In the pill the title sits centered beside the artwork and truncates before the controls. Swipe the closed pill sideways to skip.',
    hint: 'Tap the pill, drag it up or down, swipe it sideways',
    tileHint: 'Tap the pill',
    mount: mountPlayer,
    code: add('mini-player', 'MiniPlayer', `// Liquid glass surface: npx expo install expo-glass-effect
// Last child of a full screen container: it covers it when open.
<MiniPlayer
  title="Night Swim"
  subtitle="Low Tide"
  artwork={cover}
  progress={0.3}
  duration={214}
  playing={playing}
  onPlayPause={toggle}
  onNext={next}
  onPrev={prev}
/>`),
    props: [
      prop('title', 'string', 'required', 'Track title. Centered beside the artwork and truncated before the controls in the pill, it travels to centered below the artwork.'),
      prop('subtitle', 'string', '', 'Artist or album.'),
      prop('artwork', 'ImageSource', 'required', 'Cover, grows from 40 pt to the player width.'),
      prop('progress', 'number', '0', 'Track progress, 0 to 1.'),
      prop('duration', 'number', '', 'Track length in seconds. Shows the elapsed and remaining times.'),
      prop('playing', 'boolean', 'required', 'Play or pause glyph.'),
      prop('onPlayPause', '() =&gt; void', 'required', 'Play and pause buttons.'),
      prop('onNext / onPrev', '() =&gt; void', '', 'Skip buttons and the sideways swipe on the pill.'),
      prop('expanded', 'boolean', '', 'Controlled open state.'),
      prop('onExpandedChange', '(expanded: boolean) =&gt; void', '', 'Called when it opens or folds back.'),
      prop('renderExpanded', '(api: { close }) =&gt; ReactNode', '', 'Replaces the bottom row of the open player (lyrics, AirPlay, queue).'),
      prop('bottom', 'number', '24', 'Gap under the closed pill, and bottom padding when open.'),
      prop('topInset', 'number', '60', 'Gap left above the open player.'),
      prop('haptics', 'boolean', 'true', 'Rigid when it locks open, light on close, a tick crossing halfway.'),
      prop('glass', 'boolean', 'true', 'Liquid glass surface (expo-glass-effect, iOS 26+). Falls back to the surface token with a hairline border.'),
      prop('className', 'string', '', 'Player surface classes (background, border) for the fallback surface.'),
    ],
  },
};
