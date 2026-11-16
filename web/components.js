// Ready-made components (src/dissolve/components/*), ported to the web on the same engine.
// Each port follows its native source: same timings, curves, thresholds and geometry.
// Anything that turns into grains is drawn on a canvas, so the snapshot handed to the engine is exact.
import { play, snapshot, IMG, FONT, cover, pal, rr, isLight, bezier, CALM, SPLIT, QUAD, IN_OUT_CUBIC, OUT_CUBIC, scope, value, el, clamp, mix, rectOf, frame, fit, label } from './cp/kit.js';
import { ENTRIES as INPUTS } from './cp/inputs.js';
import { ENTRIES as MESSAGES } from './cp/messages.js';
import { ENTRIES as SURFACES } from './cp/surfaces.js';
import { ENTRIES as AI } from './cp/ai.js';
import { ENTRIES as CONTROLS } from './cp/controls.js';

export { bezier, scope };

/* ======================================================================================
   Toast (Toast.tsx): arrives with gather, leaves as dust, max 3, optional action.
   ====================================================================================== */

const DOT = { default: '#8E8E93', success: '#34C759', error: '#FF3B30' };
const TOAST_BG = '#1C1C1E';

function toastLayout(w, o) {
  const m = document.createElement('canvas').getContext('2d');
  const h = o.message ? 62 : 46;
  let action = null;
  if (o.action) {
    m.font = `600 14px ${FONT}`;
    const aw = Math.ceil(m.measureText(o.action.label).width) + 24, ah = 32;
    action = { x: w - 14 - aw, y: (h - ah) / 2, w: aw, h: ah };
  }
  return { w, h, action };
}

function drawToast(ctx, L, o) {
  const { w, h, action } = L;
  ctx.fillStyle = TOAST_BG;
  rr(ctx, 0, 0, w, h, 18); ctx.fill();
  if (!isLight()) { ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; rr(ctx, 0.5, 0.5, w - 1, h - 1, 17.5); ctx.stroke(); }
  ctx.fillStyle = DOT[o.tone ?? 'default'];
  ctx.beginPath(); ctx.arc(18, h / 2, 4, 0, Math.PI * 2); ctx.fill();
  const tx = 34, right = (action ? action.x - 12 : w - 14) - tx;
  ctx.font = `600 15px ${FONT}`;
  label(ctx, fit(ctx, o.title, right), tx, o.message ? h / 2 - 3 : h / 2 + 5.5, 15, 600, '#fff');
  if (o.message) {
    ctx.font = `400 13px ${FONT}`;
    label(ctx, fit(ctx, o.message, right), tx, h / 2 + 15, 13, 400, 'rgba(255,255,255,0.7)');
  }
  if (action) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(ctx, action.x, action.y, action.w, action.h, action.h / 2); ctx.fill();
    label(ctx, o.action.label, action.x + action.w / 2, action.y + 21, 14, 600, '#fff', 'center');
  }
}

/**
 * A toast stack. fixed: true pins it to the top of the viewport (the page wide host);
 * otherwise it fills `container` (a positioned element) from the top, used by the gallery tile.
 */
export function toastHost(container, { fixed = false, max = 3 } = {}) {
  const host = el('div', 'cp-toasts' + (fixed ? ' cp-toasts-fixed' : ''));
  host.setAttribute('aria-live', 'polite');
  container.append(host);
  const items = [];
  let alive = true;

  function show(o) {
    if (!alive) return null;
    const w = Math.round(host.clientWidth);
    const L = toastLayout(w, o);
    const card = snapshot(w, L.h, (ctx) => drawToast(ctx, L, o));
    card.className = 'cp-toast';
    card.style.width = w + 'px';
    card.style.height = L.h + 'px';
    card.style.opacity = '0';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-label', [o.title, o.message, o.action ? `${o.action.label} available` : ''].filter(Boolean).join('. '));
    const slot = el('div', 'cp-toast-slot');
    slot.append(card);
    host.append(slot);
    const it = { o, slot, card, gone: false, timer: 0 };
    items.push(it);

    const leave = async () => {
      if (it.gone) return;
      it.gone = true;
      clearTimeout(it.timer);
      const r = rectOf(card);
      card.style.opacity = '0';
      await play({ source: card, ...r, preset: o.exit ?? 'dust', duration: 1100, fixed }).done;
      // The stack closes up (LinearTransition 320 ms on the native side).
      slot.style.height = slot.offsetHeight + 'px';
      void slot.offsetHeight;
      slot.classList.add('gone');
      setTimeout(() => { slot.remove(); items.splice(items.indexOf(it), 1); }, 330);
    };
    it.leave = leave;
    card.addEventListener('click', (e) => {
      const b = card.getBoundingClientRect();
      const x = e.clientX - b.left, y = e.clientY - b.top, a = L.action;
      if (a && x >= a.x - 8 && x <= a.x + a.w + 8 && y >= a.y - 8 && y <= a.y + a.h + 8) o.action.onPress();
      leave();
    });

    // Over the limit, the oldest leaves as dust instead of vanishing.
    const live = items.filter((x) => !x.gone);
    live.slice(0, Math.max(0, live.length - max)).forEach((x) => x.leave());

    (async () => {
      await frame();
      const r = rectOf(card);
      await play({ source: card, ...r, preset: o.enter ?? 'gather', direction: 'in', duration: 900, fixed }).done;
      if (!it.gone) card.style.opacity = '1';
      const ms = o.duration ?? 3200;
      if (ms && !it.gone) it.timer = setTimeout(leave, ms);
    })();
    return it;
  }

  return {
    show,
    clear() { alive = false; items.forEach((x) => clearTimeout(x.timer)); host.remove(); },
  };
}

let pageToasts = null;
/** The page wide host, at the top of the viewport. */
export function toasts() {
  if (!pageToasts) pageToasts = toastHost(document.body, { fixed: true });
  return pageToasts;
}
/** Drops every page toast (route change). */
export function clearToasts() { pageToasts?.clear(); pageToasts = null; }

const TOAST_DEMOS = (t) => [
  { label: 'Saved', run: () => t.show({ title: 'Changes saved', tone: 'success' }) },
  { label: 'Undo', run: () => t.show({ title: 'Photo deleted', message: 'Lisbon, 3 years ago', action: { label: 'Undo', onPress: () => setTimeout(() => t.show({ title: 'Photo restored', tone: 'success' }), 120) } }) },
  { label: 'Error', run: () => t.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' }) },
];

function mountToastDemo(body, { sc, mode }) {
  // The tile keeps its toasts inside itself; the panel and the page use the viewport host.
  const t = mode === 'tile' ? toastHost(body, { max: 2 }) : toasts();
  if (mode === 'tile') sc.onDispose(() => t.clear());
  const demos = TOAST_DEMOS(t);
  // One trigger, raw: each press shows the next kind (plain, with an action, error).
  const b = el('button', 'cp-btn');
  b.type = 'button';
  b.textContent = 'Show toast';
  let n = 0;
  const next = () => demos[n++ % demos.length].run();
  b.addEventListener('click', next);
  body.append(b);
  return {
    async run() {
      next();
      await sc.wait(1500);
    },
  };
}

/* ======================================================================================
   SwipeToDelete (SwipeToDelete.tsx)
   ====================================================================================== */

const MAILS = [
  { id: 'a', title: 'Swipe me to the left' },
  { id: 'b', title: 'Past the line, I turn to dust' },
  { id: 'c', title: 'Or flick me away' },
];

const ROW_H = 56, RADIUS = 18, THRESHOLD = 0.4, ACTION = '#FF3B30';

// The native icon is built from Views: handle, lid, a can open at the top, two lines.
const TRASH = {
  handle: 'M7.5 0h5a1 1 0 0 1 1 1v1.5h-7V1a1 1 0 0 1 1-1z',
  lid: 'M1.25 3.5h17.5a1.25 1.25 0 0 1 0 2.5H1.25a1.25 1.25 0 0 1 0-2.5z',
  can: 'M3.5 8v11a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3V8',
  lines: 'M7.9 11v8M12.1 11v8',
};
const TRASH_SVG = `<svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden="true"><path d="${TRASH.handle}" fill="#fff"/><path d="${TRASH.lid}" fill="#fff"/><path d="${TRASH.can}" stroke="#fff" stroke-width="2"/><path d="${TRASH.lines}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function drawTrash(ctx, cx, cy, s, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-10, -12);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  ctx.fill(new Path2D(TRASH.handle));
  ctx.fill(new Path2D(TRASH.lid));
  ctx.lineWidth = 2; ctx.stroke(new Path2D(TRASH.can));
  ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke(new Path2D(TRASH.lines));
  ctx.restore();
}

// A plain row: one line of text on the card color, nothing around it.
function drawMailRow(ctx, w, h, m) {
  const c = pal();
  ctx.fillStyle = c.card;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `500 15px ${FONT}`;
  label(ctx, fit(ctx, m.title, w - 36), 18, h / 2 + 5.5, 15, 500, c.ink);
}

function mountSwipe(body, { sc, mode }) {
  const tile = mode === 'tile';
  const data = tile ? MAILS.slice(0, 2) : MAILS;
  const list = el('div', 'cp-inbox');
  const reset = el('button', 'cp-reset');
  reset.textContent = 'Reset';
  body.append(list);
  if (!tile) body.append(reset);
  const rows = new Map();
  const W = () => Math.round(list.clientWidth);

  const syncReset = () => { reset.hidden = rows.size >= data.length; };

  function makeRow(m) {
    const w = W();
    const outer = el('div', 'cp-swipe');
    const clip = el('div', 'cp-swipe-clip');
    const action = el('div', 'cp-swipe-action');
    const icon = el('span', 'cp-trash', TRASH_SVG);
    action.append(icon);
    const row = snapshot(w, ROW_H, (ctx) => drawMailRow(ctx, w, ROW_H, m));
    row.className = 'cp-swipe-row';
    row.style.width = w + 'px';
    row.style.height = ROW_H + 'px';
    clip.append(action, row);
    clip.setAttribute('aria-label', `${m.title}. Swipe left to delete.`);
    outer.append(clip);

    let busy = false;
    const iconState = (tx) => {
      const p = clamp(-tx / (w * THRESHOLD), 0, 1);
      const op = p < 0.4 ? (p / 0.4) * 0.6 : 0.6 + ((p - 0.4) / 0.6) * 0.4;
      return { op, s: 0.6 + p * 0.48 };
    };
    const tx = value(sc, 0, () => {
      const x = tx.v;
      row.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      const st = iconState(x);
      icon.style.opacity = st.op.toFixed(3);
      icon.style.transform = `scale(${st.s.toFixed(3)})`;
      action.style.visibility = x < -0.5 ? 'visible' : 'hidden';
    });
    tx.set(0);

    async function commit() {
      busy = true;
      await tx.to(-w * 0.45, 160, CALM);
      // The native ref wraps the action and the row: the snapshot is what you see right now.
      const x = tx.v, st = iconState(x);
      const src = snapshot(w, ROW_H, (ctx) => {
        rr(ctx, 0, 0, w, ROW_H, RADIUS); ctx.clip();
        ctx.fillStyle = ACTION; ctx.fillRect(0, 0, w, ROW_H);
        drawTrash(ctx, w - 26 - 10, ROW_H / 2, st.s, st.op);
        ctx.drawImage(row, x, 0, w, ROW_H);
      });
      const r = rectOf(clip);
      clip.style.opacity = '0';
      await sc.track(play({ source: src, ...r, preset: 'dust' })).done;
      if (!sc.alive) return;
      // Then the list closes up: height to 0 in 280 ms, calm curve, no bounce.
      outer.style.height = outer.offsetHeight + 'px';
      void outer.offsetHeight;
      outer.classList.add('gone');
      await sc.wait(290);
      outer.remove();
      rows.delete(m.id);
      syncReset();
      onDelete(m);
    }

    // Pan: activates past 12 px sideways, fails past 10 px vertically (activeOffsetX / failOffsetY).
    let g = null;
    clip.addEventListener('pointerdown', (e) => {
      if (busy || e.button > 0) return;
      g = { x0: e.clientX, y0: e.clientY, on: false, base: 0, start: tx.v, samples: [] };
    });
    clip.addEventListener('pointermove', (e) => {
      if (!g) return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (!g.on) {
        if (Math.abs(dy) > 10 && Math.abs(dx) <= 12) { g = null; return; }
        if (Math.abs(dx) <= 12) return;
        g.on = true;
        g.base = e.clientX;
        g.start = tx.v;
        try { clip.setPointerCapture(e.pointerId); } catch {}
        clip.classList.add('dragging');
      }
      const next = g.start + (e.clientX - g.base);
      // Free to the left, a little rubber band to the right.
      tx.set(next > 0 ? next * 0.25 : next);
      const now = performance.now();
      g.samples.push([now, e.clientX]);
      while (g.samples.length > 2 && now - g.samples[0][0] > 80) g.samples.shift();
    });
    const end = () => {
      if (!g) return;
      const on = g.on, s = g.samples;
      g = null;
      clip.classList.remove('dragging');
      if (!on) return;
      let vx = 0;
      if (s.length > 1) { const [t0, x0] = s[0], [t1, x1] = s[s.length - 1]; vx = t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0; }
      if (-tx.v > w * THRESHOLD || vx < -900) commit();
      else tx.to(0, 300, CALM);
    };
    clip.addEventListener('pointerup', end);
    clip.addEventListener('pointercancel', end);
    clip.addEventListener('lostpointercapture', end);

    return {
      m, outer, clip, row,
      busy: () => busy,
      // Scripted swipe for the autoplay: a calm drag past the line, then release.
      async demo() {
        busy = true;
        await tx.to(-w * 0.52, 560, IN_OUT_CUBIC);
        await sc.wait(140);
        await commit();
      },
    };
  }

  // Back in its place in the list, sorted by id like the native demo.
  function insert(r) {
    r.outer.dataset.id = r.m.id;
    const next = [...list.children].find((x) => x.dataset.id > r.m.id);
    list.insertBefore(r.outer, next ?? null);
    rows.set(r.m.id, r);
  }

  async function restore(m, { animate = true } = {}) {
    if (rows.has(m.id) || !sc.alive) return;
    const r = makeRow(m);
    if (!animate) { insert(r); syncReset(); return; }
    r.outer.classList.add('gone');
    r.clip.style.opacity = '0';
    insert(r);
    syncReset();
    void r.outer.offsetHeight;
    r.outer.style.height = ROW_H + 'px';
    r.outer.classList.remove('gone');
    await sc.wait(330);
    r.outer.style.height = '';
    await sc.track(play({ source: r.row, ...rectOf(r.row), preset: 'gather', direction: 'in', duration: 800 })).done;
    if (sc.alive) r.clip.style.opacity = '1';
  }

  function onDelete(m) {
    if (tile && rows.size === 0) sc.wait(700).then(() => data.forEach((x, i) => sc.wait(i * 120).then(() => restore(x))));
  }

  data.forEach((m) => restore(m, { animate: false }));
  reset.addEventListener('click', () => data.forEach((m, i) => sc.wait(i * 90).then(() => restore(m))));

  return {
    async run() {
      const r = [...rows.values()].find((x) => !x.busy());
      if (!r) { data.forEach((m) => restore(m)); return sc.wait(1200); }
      await r.demo();
      if (!tile && rows.size <= 1) data.forEach((m, i) => sc.wait(600 + i * 90).then(() => restore(m)));
    },
  };
}

/* ======================================================================================
   LikeButton (LikeButton.tsx)
   ====================================================================================== */

const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const SPARKS = 10;
const PALETTE = ['#FF2D55', '#FF9F0A', '#5E5CE6', '#34C759', '#64D2FF'];
const LIKE = '#FF2D55', IDLE = '#8E8E93';

function likeButton(sc, { size = 26, count = 128 } = {}) {
  const btn = el('button', 'cp-like');
  btn.type = 'button';
  const box = el('span', 'cp-heart');
  box.style.width = box.style.height = size + 'px';
  const d = Math.max(4, size * 0.16);
  const sparks = Array.from({ length: SPARKS }, (_, i) => {
    const s = el('span', 'cp-spark');
    s.style.cssText = `width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;background:${PALETTE[i % PALETTE.length]};opacity:0`;
    box.append(s);
    return s;
  });
  const pop = el('span', 'cp-heart-pop');
  const outline = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART}" fill="none" stroke="${IDLE}" stroke-width="${(1.8 * 24) / size}"/></svg>`;
  const idle = el('span', 'cp-heart-idle', outline);
  const filled = snapshot(size, size, (ctx) => { ctx.scale(size / 24, size / 24); ctx.fillStyle = LIKE; ctx.fill(new Path2D(HEART)); });
  filled.className = 'cp-heart-fill';
  filled.style.width = filled.style.height = size + 'px';
  pop.append(idle, filled);
  // While the filled heart turns to grains, the outline is already back underneath.
  const under = el('span', 'cp-heart-under', outline);
  box.append(pop, under);
  const num = el('span', 'cp-count');
  btn.append(box, num);

  let liked = false, busy = false, n = count;
  const render = () => {
    idle.hidden = liked;
    filled.hidden = !liked;
    num.textContent = n;
    num.style.color = liked ? LIKE : IDLE;
    btn.setAttribute('aria-pressed', String(liked));
    btn.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
  };
  render();

  const scale = value(sc, 1, () => { pop.style.transform = `scale(${scale.v.toFixed(4)})`; });
  const burst = value(sc, 0, () => {
    const p = burst.v;
    sparks.forEach((s, i) => {
      const a = (i / SPARKS) * Math.PI * 2 - Math.PI / 2, r = size * 0.35 + p * size * 0.75;
      s.style.opacity = p === 0 ? '0' : (1 - p).toFixed(3);
      s.style.transform = `translate(${(Math.cos(a) * r).toFixed(2)}px,${(Math.sin(a) * r).toFixed(2)}px) scale(${(1 - p * 0.6).toFixed(3)})`;
    });
  });

  async function press() {
    if (busy) return;
    if (!liked) {
      liked = true; n += 1; render();
      // A small, calm pop: 0.86 in 70 ms, back to 1 on a near critical spring (about 2 % overshoot).
      scale.to(0.86, 70, QUAD).then((ok) => ok && scale.spring(1, { stiffness: 550, damping: 35, eps: 0.001 }));
      burst.set(0);
      burst.to(1, 560, OUT_CUBIC).then((ok) => ok && burst.set(0));
      return;
    }
    busy = true;
    under.style.opacity = '1';
    const r = rectOf(filled);
    filled.style.opacity = '0';
    await sc.track(play({ source: filled, ...r, preset: 'snap', origin: { x: size / 2, y: size / 2 }, duration: 800, grain: Math.max(1.5, size / 14) })).done;
    if (!sc.alive) return;
    liked = false; n -= 1;
    filled.style.opacity = '';
    under.style.opacity = '0';
    render();
    busy = false;
  }
  btn.addEventListener('click', press);
  return {
    btn,
    async run() {
      if (busy) return;
      if (liked) { await press(); await sc.wait(500); }
      await press();
      await sc.wait(1300);
      await press();
    },
  };
}

function mountLike(body, { sc, mode }) {
  // Raw: the heart and its count, a little larger than the 26 pt default so it reads on a stage.
  const like = likeButton(sc, { size: mode === 'tile' ? 36 : 40 });
  like.btn.classList.add('cp-like-lg');
  body.append(like.btn);
  return like;
}

/* ======================================================================================
   MorphButton (MorphButton.tsx): Dynamic Island style, crisp pill, critically damped width.
   ====================================================================================== */

const MORPH_SPRING = { stiffness: 260, damping: 31, mass: 1, eps: 0.05 };
const CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';

function mountMorph(body, { sc, label = 'Pay 42 €', doneLabel = 'Paid' }) {
  const H = 52;
  // Native default is a #1C1C1E pill; on the dark site it is inverted so it still reads.
  const color = isLight() ? '#1C1C1E' : '#F2F4F7';
  const ink = isLight() ? '#FFFFFF' : '#12151A';
  const doneColor = '#34C759';
  const wrap = el('div', 'cp-morph');
  wrap.setAttribute('role', 'button');
  wrap.tabIndex = 0;
  wrap.style.height = H + 'px';
  const pill = el('div', 'cp-morph-pill');
  pill.style.height = H + 'px';
  pill.style.borderRadius = H / 2 + 'px';
  const lab = el('span', 'cp-morph-layer cp-morph-label');
  lab.textContent = label;
  lab.style.color = ink;
  const spin = el('span', 'cp-morph-layer');
  const ring = el('i', 'cp-spinner');
  ring.style.borderColor = ink;
  ring.style.borderTopColor = 'transparent';
  spin.append(ring);
  const done = el('span', 'cp-morph-layer cp-morph-done', `${CHECK}<span>${doneLabel}</span>`);
  done.style.color = '#fff';
  pill.append(lab, spin, done);
  wrap.append(pill);
  body.append(wrap);

  const W = Math.round(wrap.clientWidth);
  let phase = 'idle', angle = 0, spinning = false, fromDone = false;
  const render = () => {
    const w = width.v;
    pill.style.width = w.toFixed(2) + 'px';
    pill.style.left = ((W - w) / 2).toFixed(2) + 'px';
    pill.style.background = mix(color, doneColor, tone.v);
    const layer = (node, at, k = 0.18, rot = '') => {
      const d = Math.min(1, Math.abs(show.v - at));
      node.style.opacity = (1 - d).toFixed(3);
      node.style.transform = `scale(${(1 - k * d).toFixed(3)})${rot}`;
    };
    layer(lab, 0);
    layer(spin, 1, 0.3, ` rotate(${angle.toFixed(1)}deg)`);
    // Done back to idle crosses the spinner slot: keep it out of that cross-fade.
    if (phase === 'idle' && fromDone) spin.style.opacity = '0';
    layer(done, 2);
  };
  const width = value(sc, W, render);
  const tone = value(sc, 0, render);
  const show = value(sc, 0, render);
  render();

  const spinLoop = () => {
    let last = performance.now();
    const f = (now) => {
      if (!spinning || !sc.alive) return;
      angle = (angle + ((now - last) / 900) * 360) % 360;
      last = now;
      render();
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };

  const go = (next) => {
    fromDone = phase === 'done' && next === 'idle';
    phase = next;
    wrap.setAttribute('aria-busy', String(next === 'loading'));
    width.spring(next === 'loading' ? H : W, MORPH_SPRING);
    tone.to(next === 'done' ? 1 : 0, 380, CALM);
    show.to(next === 'idle' ? 0 : next === 'loading' ? 1 : 2, 300, CALM);
    if (next === 'loading' && !spinning) { spinning = true; spinLoop(); }
    if (next !== 'loading') spinning = false;
  };

  async function press() {
    if (phase !== 'idle') return;
    go('loading');
    await sc.wait(1400); // onPress: a 1.4 s payment
    go('done');
    await sc.wait(1800); // resetAfter
    go('idle');
    await sc.wait(500);
  }
  wrap.addEventListener('click', press);
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(); } });
  return { run: press };
}

/* ======================================================================================
   SplitButton (SplitButton.tsx): two half pills pulled apart, a vector neck that pinches and snaps.
   ====================================================================================== */

function mountSplit(body, { sc, label = 'Delete project', cancelLabel = 'Cancel', confirmLabel = 'Delete' }) {
  const H = 52, R = H / 2, cy = R, GAP = 28, DURATION = 620;
  const color = '#FF3B30', confirmColor = '#FF3B30';
  const cancelColor = isLight() ? '#E9E9EB' : '#2C2C2E';
  const cancelText = isLight() ? '#1C1C1E' : '#F2F4F7';
  const snapAt = GAP * 0.8;

  const wrap = el('div', 'cp-split');
  wrap.style.height = H + 'px';
  body.append(wrap);
  const W = Math.round(wrap.clientWidth);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('cp-split-svg');
  const left = document.createElementNS(NS, 'rect');
  const right = document.createElementNS(NS, 'rect');
  const bridge = document.createElementNS(NS, 'path');
  [left, right].forEach((r) => { r.setAttribute('y', 0); r.setAttribute('height', H); r.setAttribute('rx', R); r.setAttribute('ry', R); });
  bridge.setAttribute('fill', color);
  svg.append(left, right, bridge);

  const closed = el('button', 'cp-split-closed');
  closed.type = 'button';
  closed.innerHTML = `<span>${label}</span>`;
  const cancel = el('button', 'cp-split-half');
  cancel.type = 'button';
  cancel.innerHTML = `<span style="color:${cancelText}">${cancelLabel}</span>`;
  const confirm = el('button', 'cp-split-half cp-split-right');
  confirm.type = 'button';
  confirm.innerHTML = `<span>${confirmLabel}</span>`;
  wrap.append(svg, closed, cancel, confirm);
  const closedLabel = closed.firstChild, openLabels = [cancel.firstChild, confirm.firstChild];

  let open = false;
  const render = () => {
    const g = GAP * p.v;
    const width = (W - g) / 2, rightX = W - width;
    left.setAttribute('x', 0); left.setAttribute('width', width.toFixed(3));
    right.setAttribute('x', rightX.toFixed(3)); right.setAttribute('width', width.toFixed(3));
    // Both halves stay one liquid color while joined; the left one turns into Cancel after.
    left.setAttribute('fill', mix(color, cancelColor, tone.v));
    right.setAttribute('fill', mix(color, confirmColor, tone.v));
    if (g >= snapAt) bridge.setAttribute('d', '');
    else {
      const t = g / snapAt; // 0 touching, 1 about to snap
      // Waist half height: full while fused, thins fast near the snap, like surface tension.
      const n = R * (1 - 0.86 * Math.pow(t, 0.8));
      const c1 = width - R, c2 = rightX + R;
      // The neck leaves each cap from its very top while fused (no seam), lower as it stretches.
      const phi = ((90 - 35 * t) * Math.PI) / 180;
      const ax = c1 + R * Math.cos(phi), bx = c2 - R * Math.cos(phi), ay = R * Math.sin(phi);
      const k = Math.max(4, (bx - ax) * 0.42);
      const f = (v) => v.toFixed(3);
      bridge.setAttribute('d', `M${f(ax)} ${f(cy - ay)}C${f(ax + k)} ${f(cy - n)} ${f(bx - k)} ${f(cy - n)} ${f(bx)} ${f(cy - ay)}L${f(bx)} ${f(cy + ay)}C${f(bx - k)} ${f(cy + n)} ${f(ax + k)} ${f(cy + n)} ${f(ax)} ${f(cy + ay)}Z`);
    }
    const ct = Math.min(1, p.v * 3);
    closedLabel.style.opacity = (1 - ct).toFixed(3);
    closedLabel.style.transform = `scale(${(1 - 0.12 * ct).toFixed(3)})`;
    openLabels.forEach((s) => { s.style.opacity = tone.v.toFixed(3); s.style.transform = `scale(${(0.88 + 0.12 * tone.v).toFixed(3)})`; });
    cancel.style.width = confirm.style.width = width.toFixed(2) + 'px';
  };
  const p = value(sc, 0, render);
  const tone = value(sc, 0, render);
  render();

  const setOpen = (next) => {
    open = next;
    wrap.classList.toggle('open', open);
    closed.tabIndex = open ? -1 : 0;
    cancel.tabIndex = confirm.tabIndex = open ? 0 : -1;
    const run = p.to(open ? 1 : 0, DURATION, SPLIT);
    // Colors and labels only change once the drop has actually split.
    if (open) tone.to(1, 220, QUAD, DURATION * 0.78); else tone.to(0, 180, QUAD);
    return run;
  };
  setOpen(false);
  closed.addEventListener('click', () => setOpen(true));
  cancel.addEventListener('click', () => setOpen(false));
  confirm.addEventListener('click', () => setOpen(false));

  return {
    async run() {
      if (open) return;
      await setOpen(true);
      await sc.wait(1300);
      await setOpen(false);
      await sc.wait(200);
    },
    // Exposed for checks: the bridge path and the halves at a given progress.
    _set(v) { p.set(v); tone.set(v >= 0.999 ? 1 : 0); },
  };
}

/* ======================================================================================
   GooeyMenu (GooeyMenu.tsx): drops pour out along an arc, through an SVG goo filter.
   ====================================================================================== */

const GOO_ICONS = {
  Camera: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M9.2 4h5.6l1.6 2.2H19a2.5 2.5 0 0 1 2.5 2.5v8.8A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5V8.7A2.5 2.5 0 0 1 5 6.2h2.6z"/><circle cx="12" cy="12.9" r="3.6" fill="#1C1C1E"/></svg>',
  Photo: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="3" fill="#fff"/><path d="M4.5 18l5-5.5 3.5 3.5 2.5-2.5 4 4.5z" fill="#1C1C1E"/><circle cx="16" cy="8.8" r="1.8" fill="#1C1C1E"/></svg>',
  Voice: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12.5" rx="3.5" fill="#fff"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
};
const GOO_ITEMS = [['Camera', 'Camera'], ['Photo', 'Photo library'], ['Voice', 'Voice memo']];
let gooId = 0;

function mountGooey(body, { sc, size = 56, distance = 92, startAngle = -90, endAngle = -180 }) {
  // Native default is #1C1C1E with white icons; on the dark site it is inverted so it still reads.
  const PAD = 16, light = isLight(), color = light ? '#1C1C1E' : '#F2F4F7', ink = light ? '#FFFFFF' : '#12151A';
  const stage = el('div', 'cp-goo-stage');
  stage.style.setProperty('--goo-ink', ink);
  body.append(stage);
  const box = distance + size + PAD * 2;
  const c = { x: box - PAD - size / 2, y: box - PAD - size / 2 };
  const R = size / 2, itemSize = size * 0.82, r = itemSize / 2, n = GOO_ITEMS.length;
  const menu = el('div', 'cp-goo');
  menu.style.width = menu.style.height = box + 'px';
  const id = `cp-goo-${++gooId}`;
  // Same recipe as the Skia goo layer: blur 9, then alpha * 20 - 9.
  menu.innerHTML = `<svg class="cp-goo-svg" width="${box}" height="${box}" aria-hidden="true">
    <defs><filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${box}" height="${box}" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="9"/>
      <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/>
    </filter></defs>
    <g filter="url(#${id})" fill="${color}"><circle cx="${c.x}" cy="${c.y}" r="${R}"/></g>
  </svg>`;
  const g = menu.querySelector('g');
  const NS = 'http://www.w3.org/2000/svg';
  const dirs = GOO_ITEMS.map((_, i) => {
    const a = ((startAngle + ((endAngle - startAngle) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
  const blobs = dirs.map(() => {
    const strand = document.createElementNS(NS, 'circle'), drop = document.createElementNS(NS, 'circle');
    g.append(strand, drop);
    return { strand, drop };
  });
  const actions = GOO_ITEMS.map(([key, name]) => {
    const b = el('button', 'cp-goo-action', GOO_ICONS[key].replaceAll('#fff', ink).replaceAll('#1C1C1E', color));
    b.type = 'button';
    b.setAttribute('aria-label', name);
    b.style.width = b.style.height = itemSize + 'px';
    b.addEventListener('click', () => toggle(false));
    menu.append(b);
    return b;
  });
  const main = el('button', 'cp-goo-main', '<span></span><span></span>');
  main.type = 'button';
  main.setAttribute('aria-label', 'Actions');
  main.style.cssText = `left:${c.x - R}px;top:${c.y - R}px;width:${size}px;height:${size}px`;
  menu.append(main);
  stage.append(menu);

  const local = (v, i) => {
    const step = 0.14, t = (v - i * step) / Math.max(0.0001, 1 - step * (n - 1));
    return clamp(t);
  };
  let open = false;
  const render = () => {
    dirs.forEach((d, i) => {
      const t = local(p.v, i), b = blobs[i];
      b.drop.setAttribute('cx', (c.x + d.x * distance * t).toFixed(2));
      b.drop.setAttribute('cy', (c.y + d.y * distance * t).toFixed(2));
      b.drop.setAttribute('r', (r * (0.5 + 0.5 * Math.min(1, t * 1.6))).toFixed(2));
      // A strand from the button to the drop that thins out and breaks around two thirds.
      b.strand.setAttribute('cx', (c.x + d.x * distance * t * 0.5).toFixed(2));
      b.strand.setAttribute('cy', (c.y + d.y * distance * t * 0.5).toFixed(2));
      b.strand.setAttribute('r', (t > 0.7 ? 0 : r * 0.55 * (1 - t / 0.7)).toFixed(2));
      const a = actions[i];
      a.style.opacity = (t < 0.55 ? 0 : (t - 0.55) / 0.45).toFixed(3);
      a.style.transform = `translate(${(c.x + d.x * distance * t - itemSize / 2).toFixed(2)}px,${(c.y + d.y * distance * t - itemSize / 2).toFixed(2)}px)`;
    });
    main.style.transform = `rotate(${(p.v * 45).toFixed(2)}deg)`;
  };
  const p = value(sc, 0, render);
  render();

  function toggle(next = !open) {
    open = next;
    menu.classList.toggle('open', open);
    main.setAttribute('aria-expanded', String(open));
    actions.forEach((a) => (a.tabIndex = open ? 0 : -1));
    return p.to(open ? 1 : 0, open ? 1000 : 820, IN_OUT_CUBIC);
  }
  toggle(false);
  main.addEventListener('click', () => toggle());
  return {
    async run() {
      if (open) return;
      await toggle(true);
      await sc.wait(1100);
      await toggle(false);
    },
  };
}

/* ======================================================================================
   Content: titles, notes, usage code and props, straight from the native source.
   ====================================================================================== */

const PKG = 'react-native-dissolve';
const DIR = '@/components/dissolve';
const prop = (name, type, def, desc) => ({ name, type, def, desc });

export const COMPONENTS = {
  'swipe-to-delete': {
    title: 'SwipeToDelete',
    note: 'Swipe a row left. Past the line, it turns to dust.',
    desc: 'A row you swipe left to delete, like Mail or WhatsApp. Past 40 percent, or with a quick flick, the row dissolves, the list closes up behind it, then onDelete runs.',
    hint: 'Drag a row to the left',
    tileHint: 'Drag left',
    mount: mountSwipe,
    code: `// npx ${PKG} add swipe-to-delete toast
import { useState } from 'react';
import { SwipeToDelete } from '${DIR}/swipe-to-delete';
import { useToast } from '${DIR}/toast';

export function Inbox() {
  const [mails, setMails] = useState(MAILS);
  const toast = useToast();

  return mails.map((m) => (
    <SwipeToDelete
      key={m.id}
      rowClassName="rounded-[18px]"
      onDelete={() => {
        setMails((l) => l.filter((x) => x.id !== m.id));
        toast.show({
          title: 'Conversation deleted',
          message: m.from,
          action: { label: 'Undo', onPress: () => restore(m) },
        });
      }}
    >
      <MailRow mail={m} />
    </SwipeToDelete>
  ));
}`,
    props: [
      prop('children', 'ReactNode', 'required', 'The row. It slides with your finger over the delete action.'),
      prop('onDelete', '() => void', 'required', 'Called once the row has dissolved and collapsed: remove the item from your data here.'),
      prop('preset', 'VariantName', `'dust'`, 'Exit used when the row goes.'),
      prop('threshold', 'number', '0.4', 'Fraction of the row width to drag before release deletes. A flick faster than 900 pt/s deletes too.'),
      prop('disabled', 'boolean', 'false', 'Turns the pan gesture off.'),
      prop('className', 'string', '', 'Outer wrapper (margins, layout). This is the part that collapses.'),
      prop('rowClassName', 'string', `'overflow-hidden'`, 'Clipping row. Corner radius goes here (<code>rounded-2xl</code>), the action follows it.'),
      prop('actionClassName', 'string', `'bg-dissolve-danger'`, 'Delete action revealed behind the row.'),
    ],
  },
  toast: {
    title: 'Toast',
    note: 'Arrives in grains, leaves as dust. Tap to dismiss.',
    desc: 'Toasts that arrive in grains and leave as dust. A provider holds the stack at the top of the screen, three at most: over the limit the oldest one leaves as dust instead of vanishing.',
    hint: 'Show a toast, tap it to dismiss',
    tileHint: 'Show a toast',
    mount: mountToastDemo,
    code: `// npx ${PKG} add toast
import { ToastProvider, useToast } from '${DIR}/toast';

// app/_layout.tsx, inside <DissolveProvider>
<ToastProvider top={insets.top + 8}>
  <Stack />
</ToastProvider>

// any screen
const toast = useToast();

toast.show({ title: 'Changes saved', tone: 'success' });
toast.show({
  title: 'Photo deleted',
  message: 'Lisbon, 3 years ago',
  action: { label: 'Undo', onPress: restore },
});
toast.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' });`,
    props: [
      prop('title', 'string', 'required', 'First line, one line.'),
      prop('message', 'string', '', 'Second line, up to two lines.'),
      prop('tone', `'default' | 'success' | 'error'`, `'default'`, 'Color of the dot: gray, green or red.'),
      prop('action', '{ label, onPress }', '', 'A single action, typically Undo. The toast leaves after it runs.'),
      prop('duration', 'number', '3200', 'Time on screen before it leaves on its own, ms. 0 keeps it until tapped.'),
      prop('enter', 'VariantName', `'gather'`, 'Entrance.'),
      prop('exit', 'VariantName', `'dust'`, 'Exit.'),
      prop('&lt;ToastProvider top&gt;', 'number', '56', 'Distance from the top of the screen.'),
      prop('&lt;ToastProvider max&gt;', 'number', '3', 'Toasts on screen at once.'),
      prop('&lt;ToastProvider className&gt;', 'string', `'left-3 right-3 gap-2'`, 'Stack: side insets, gap.'),
      prop('&lt;ToastProvider cardClassName&gt;', 'string', `'bg-dissolve-primary rounded-[18px]'`, 'Every card: background, radius, padding.'),
    ],
  },
  'like-button': {
    title: 'LikeButton',
    note: 'Sparks on like, the heart snaps away on unlike.',
    desc: 'Like: the heart pops and ten sparks burst around it. Unlike: the filled heart snaps away into grains from its center and the outline is back.',
    hint: 'Tap the heart, tap again to unlike',
    tileHint: 'Tap the heart',
    mount: mountLike,
    code: `// npx ${PKG} add like-button
import { useState } from 'react';
import { LikeButton } from '${DIR}/like-button';

export function PostActions() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);

  return (
    <LikeButton
      liked={liked}
      count={likes}
      onChange={(v) => {
        setLiked(v);
        setLikes((n) => n + (v ? 1 : -1));
      }}
    />
  );
}`,
    props: [
      prop('liked', 'boolean', 'required', 'Controlled state.'),
      prop('onChange', '(liked: boolean) => void', 'required', 'Called with true right away on like, with false once the heart has snapped away.'),
      prop('size', 'number', '26', 'Heart size in points.'),
      prop('color', 'string', `'#FF2D55'`, 'Filled heart and counter when liked.'),
      prop('idleColor', 'string', 'muted token', 'Outline and counter when not liked.'),
      prop('count', 'number', '', 'Optional counter shown next to the heart.'),
      prop('haptics', 'boolean', 'true', 'Light impact on like, the snap ticks on unlike.'),
      prop('className', 'string', `'flex-row items-center gap-1.5'`, 'Row: gap, padding, margins.'),
      prop('countClassName', 'string', `'text-[15px] font-semibold'`, 'Counter text: size, weight.'),
    ],
  },
  'morph-button': {
    title: 'MorphButton',
    note: 'Folds into a loader, opens back up as done.',
    desc: 'A button that morphs like the Dynamic Island: the pill folds into a round loader, then opens back up as the done state. Crisp shape, a critically damped spring, content that cross-fades and scales.',
    hint: 'Tap to pay',
    tileHint: 'Tap to pay',
    mount: mountMorph,
    code: `// npx ${PKG} add morph-button
import { MorphButton } from '${DIR}/morph-button';

<MorphButton
  label="Pay 42 €"
  doneLabel="Paid"
  onPress={() => pay(order)} // stays loading until the promise settles
/>`,
    props: [
      prop('label', 'string', 'required', 'Idle label.'),
      prop('doneLabel', 'string', `'Done'`, 'Label next to the check once the promise resolves.'),
      prop('onPress', '() => Promise | void', 'required', 'Runs on press. The button stays in its loading state until the promise settles; a rejection goes back to idle.'),
      prop('height', 'number', '52', 'Pill height, also the loader diameter.'),
      prop('resetAfter', 'number', '1800', 'Time spent on the done state before going back, ms. 0 stays done.'),
      prop('haptics', 'boolean', 'true', 'Light impact on press, success when done.'),
      prop('className', 'string', '', 'Outer box (width, margins). The pill is centered inside it.'),
      prop('labelClassName', 'string', `'text-base font-semibold text-dissolve-primary-foreground'`, 'Label and done label: size, weight, color. The pill reads the primary and success tokens.'),
    ],
  },
  'split-button': {
    title: 'SplitButton',
    note: 'Divides in the middle like a drop of liquid metal.',
    desc: 'A button that divides in the middle like a drop of liquid metal: the two halves pull apart, a neck between them thins into a waist, then snaps. Cancel fuses them back. Vector edges, no blur, so it stays crisp.',
    hint: 'Tap to split, Cancel fuses it back',
    tileHint: 'Tap to split',
    mount: mountSplit,
    code: `// npx ${PKG} add split-button
import { SplitButton } from '${DIR}/split-button';
import { useToast } from '${DIR}/toast';

const toast = useToast();

<SplitButton
  label="Delete project"
  confirmLabel="Delete"
  onConfirm={() => toast.show({ title: 'Project deleted', tone: 'error' })}
/>`,
    props: [
      prop('label', 'string', 'required', 'Label of the whole button.'),
      prop('cancelLabel', 'string', `'Cancel'`, 'Left half once split.'),
      prop('confirmLabel', 'string', `'Confirm'`, 'Right half once split.'),
      prop('onConfirm', '() => void', 'required', 'Runs on the right half, then the halves fuse back.'),
      prop('height', 'number', '52', 'Button height.'),
      prop('gap', 'number', '28', 'Space between the two halves once split. The neck snaps at 80 percent of it.'),
      prop('duration', 'number', '620', 'Split duration, ms.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on taps, warning on confirm.'),
      prop('className', 'string', '', 'Root: margins, width. The drop reads the danger tokens, the Cancel half surface-2.'),
      prop('labelClassName', 'string', `'text-base font-semibold'`, 'Every label: size, weight.'),
      prop('cancelLabelClassName', 'string', `'text-dissolve-foreground'`, 'Cancel label, its color.'),
    ],
  },
  'gooey-menu': {
    title: 'GooeyMenu',
    note: 'Actions pour out of the button as drops.',
    desc: 'A floating button whose actions pour out of it as drops along an arc and melt back in when it closes. Place it absolutely: it reserves room for the arc above and to the left of the button.',
    hint: 'Tap the button, then an action',
    tileHint: 'Tap the button',
    mount: mountGooey,
    code: `// npx ${PKG} add gooey-menu
import { GooeyMenu } from '${DIR}/gooey-menu';

<GooeyMenu
  className="absolute bottom-2 right-2"
  items={[
    { icon: <Icon name="camera" />, label: 'Camera', onPress: openCamera },
    { icon: <Icon name="photo" />, label: 'Photo', onPress: openLibrary },
    { icon: <Icon name="mic" />, label: 'Voice', onPress: record },
  ]}
/>`,
    props: [
      prop('items', 'GooeyMenuItem[]', 'required', '<code>{ icon, onPress, label? }</code>. The menu closes after an action runs.'),
      prop('size', 'number', '56', 'Diameter of the main button. Actions are 82 percent of it.'),
      prop('distance', 'number', '92', 'Distance from the main button to the actions.'),
      prop('startAngle', 'number', '-90', 'Arc start in degrees, 0 = right, -90 = up.'),
      prop('endAngle', 'number', '-180', 'Arc end in degrees, -180 = left.'),
      prop('haptics', 'boolean', 'true', 'Light impact on toggle.'),
      prop('className', 'string', '', 'Root: position it here. Button and drops read the primary token.'),
      prop('iconClassName', 'string', `'bg-dissolve-primary-foreground'`, 'The two bars of the plus, their color.'),
    ],
  },
};

// The ports in cp/*.js carry their own glyph next to their content.
Object.assign(COMPONENTS, INPUTS, MESSAGES, SURFACES, AI, CONTROLS);

export const COMPONENT_ORDER = Object.keys(COMPONENTS);

export const COMPONENT_GLYPH = {
  'swipe-to-delete': '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="12" height="10" rx="3"/><path d="M17 8.5v5M19.5 8.5v5" opacity=".55"/></svg>',
  toast: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2.5" y="4" width="17" height="7" rx="3.5"/><circle cx="6.5" cy="7.5" r="1" fill="currentColor"/><path d="M5 15h1M8.5 15h1M12 15h1M6.5 18h1M10 18h1" opacity=".55"/></svg>',
  'like-button': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${HEART}" transform="translate(3.6 3.8) scale(.7)"/><path d="M12 1.5v1.6M3.5 5l1.1 1.1M20.5 5l-1.1 1.1" stroke-linecap="round" opacity=".55"/></svg>`,
  'morph-button': '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="7" width="12" height="8" rx="4"/><circle cx="17.5" cy="11" r="3"/></svg>',
  'split-button': '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5 7h3.5c1.5 0 2 2.4 2.5 2.4S12 7 13.5 7H17a4 4 0 0 1 0 8h-3.5c-1.5 0-2-2.4-2.5-2.4S10 15 8.5 15H5a4 4 0 0 1 0-8z"/></svg>',
  'gooey-menu': '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="15" cy="15" r="4"/><circle cx="15" cy="5" r="2.2"/><circle cx="5" cy="15" r="2.2"/><circle cx="7.9" cy="7.9" r="2.2"/><path d="M15 13.6v2.8M13.6 15h2.8"/></svg>',
};
for (const [id, c] of Object.entries(COMPONENTS)) if (c.glyph) COMPONENT_GLYPH[id] = c.glyph;

/**
 * Mounts one component demo into `body`. mode: 'panel' (gallery section), 'stage' (its page),
 * 'tile' (Every variant grid). Returns { run, dispose }: run() plays the demo once by itself.
 */
export function mountComponent(id, body, { mode = 'panel' } = {}) {
  const sc = scope();
  body.classList.add('cp-body', `cp-mode-${mode}`, `cp-is-${id}`);
  const api = COMPONENTS[id].mount(body, { sc, mode });
  // One run at a time: Play demo during an autoplay (or the reverse) joins the run in flight.
  let current = null;
  const run = () => {
    if (!sc.alive) return Promise.resolve();
    current ??= Promise.resolve(api.run()).finally(() => { current = null; });
    return current;
  };
  return { run, dispose: sc.dispose, _api: api };
}

/* ======================================================================================
   Gallery section + component pages
   ====================================================================================== */

const arrowR = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

export function componentsSectionHTML(head) {
  return `${head('08', 'Components', `Ready-made components built on the dissolve engine. All ${COMPONENT_ORDER.length} are live, try them.`)}
  <div class="cp-grid">
    ${COMPONENT_ORDER.map((id) => `<section class="cp-panel" aria-label="${COMPONENTS[id].title}">
      <a class="cp-panel-head" href="#/${id}">
        <span class="cp-panel-text"><span class="cp-name">${COMPONENTS[id].title}</span><span class="cp-note">${COMPONENTS[id].note}</span></span>
        <span class="cp-go">${arrowR}</span>
      </a>
      <div class="cp-panel-body" data-cp="${id}"></div>
    </section>`).join('')}
  </div>`;
}

/** Mounts every panel of the gallery section. Returns a dispose function. */
/**
 * Autoplay, one demo at a time. Every mounted demo registers here; a single conductor walks the
 * visible ones in page order, plays one, waits a beat, then moves to the next. A touch, click or
 * key inside a demo hands it to the visitor until it has been idle a few seconds. Reduced motion
 * turns it off.
 */
const AUTO = { list: [], i: 0, timer: 0, playing: false, BEAT: 1800, IDLE: 7000 };

function conduct() {
  clearTimeout(AUTO.timer);
  if (AUTO.playing) return;
  const now = performance.now();
  const ready = AUTO.list
    .filter((d) => d.visible && now - d.touched > AUTO.IDLE)
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  if (!ready.length) { if (AUTO.list.some((d) => d.visible)) AUTO.timer = setTimeout(conduct, 1000); return; }
  const next = ready.find((d) => d.order > AUTO.last) ?? ready[0];
  AUTO.last = next.order;
  AUTO.playing = true;
  // A demo disposed mid run (route change) may never settle: cap a run at 25 s.
  Promise.race([Promise.resolve(next.demo.run()), new Promise((r) => setTimeout(r, 25000))]).catch(() => {}).finally(() => {
    AUTO.playing = false;
    AUTO.timer = setTimeout(conduct, AUTO.BEAT);
  });
}

let ORDER_SEQ = 0;
export function autoplay(el, demo, { threshold = 0.6 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const d = { el, demo, visible: false, touched: -1e9, order: ++ORDER_SEQ };
  AUTO.list.push(d);
  AUTO.last ??= 0;
  const io = new IntersectionObserver(([en]) => {
    d.visible = en.isIntersecting && en.intersectionRatio >= threshold;
    if (d.visible && !AUTO.playing) { clearTimeout(AUTO.timer); AUTO.timer = setTimeout(conduct, 500); }
  }, { threshold: [0, threshold, 1] });
  io.observe(el);
  const hand = () => { d.touched = performance.now(); };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) el.addEventListener(ev, hand, { passive: true });
  return () => {
    io.disconnect();
    AUTO.list = AUTO.list.filter((x) => x !== d);
    if (!AUTO.list.length) { AUTO.playing = false; clearTimeout(AUTO.timer); }
  };
}

export function mountComponentsSection(root) {
  const mounted = [...root.querySelectorAll('[data-cp]')].map((b) => {
    const m = mountComponent(b.dataset.cp, b, { mode: 'panel' });
    const stop = autoplay(b, m);
    return { dispose: () => { stop(); m.dispose(); } };
  });
  return () => mounted.forEach((m) => m.dispose());
}

export function propsTable(id) {
  return `<div class="dc-table-wrap">
    <table class="dc-table opt-table">
      <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
      <tbody>${COMPONENTS[id].props.map((o) => `<tr><td><code>${o.name}</code></td><td><code class="opt-type">${o.type}</code></td><td>${o.def ? `<code>${o.def}</code>` : ''}</td><td>${o.desc}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

export function componentPrompt(id) {
  const c = COMPONENTS[id];
  return `Add the ${c.title} component from dissolve to this React Native / Expo app. ${c.desc}
Install the engine: npx expo install ${PKG} @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
Wrap the root layout once in <DissolveProvider> from ${PKG} (above the navigator)${id === 'toast' || id === 'swipe-to-delete' || id === 'split-button' ? `, and in <ToastProvider> from ${DIR}/toast inside it` : ''}.
The component is not exported by the package: copy it into the project with npx ${PKG} add ${id} (it runs init the first time: tw.tsx primitives and --dissolve-* theme tokens in global.css). It needs NativeWind v5 (Tailwind v4, react-native-css) and tailwind-merge; if they are missing, set them up first.
Restyle it with className and the part classNames (later classes win), or with the --dissolve-* tokens in global.css.
Usage:

${c.code}`;
}
