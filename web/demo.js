// Interactive demo card for one variant, used by the variant stage and the gallery tiles.
import { play, snapshot, morph, VARIANTS as ENGINE } from './engine/atlas.js';

import { IMG, FONT, cover } from './images.js';
import { item, pal, rr, text, rectOf, hide, show, isLight } from './showcase.js';

const ENTRANCES = ['gather', 'rain', 'print'];

/** Short action label shown in the gallery tile footer and on the stage. */
export const HINTS = {
  dust: 'Tap', sand: 'Tap', ember: 'Tap', pixel: 'Tap', vortex: 'Tap',
  snap: 'Tap anywhere', fling: 'Swipe', stream: 'Tap', gather: 'Tap to replay', rain: 'Tap to replay',
  print: 'Tap to replay', charge: 'Press and hold', peel: 'Drag any edge', melt: 'Tap', shatter: 'Tap where it breaks', morph: 'Tap to morph',
};

// Realistic notifications, one per variant: [app, title, body, painting]
export const COPY = {
  dust: ['Messages', 'Lina', 'Dinner at 8? I booked the terrace.', 'temple'],
  sand: ['Calendar', 'Design review', 'Moved to 4 pm, room two.', 'tuscany'],
  ember: ['Photos', 'Memories', 'Lisbon, three years ago today.', 'valley'],
  pixel: ['Arcade', 'Level complete', 'New high score, 12 480 points.', 'arch'],
  vortex: ['Reminders', 'Water the plants', 'Every Sunday at 10 am.', 'pines'],
  shatter: ['Wallet', 'Payment declined', 'Try another card for Studio Pro.', 'aqueduct'],
  stream: ['Files', 'Old_invoice.pdf', 'Tap to move it to the bin.', 'lake'],
  gather: ['Messages', 'Sam', 'Here are the refs for the hero.', 'cypress'],
  rain: ['Store', 'Your order shipped', 'Arrives Thursday before noon.', 'villa'],
  print: ['Receipts', 'Order 2048', 'Two prints, 48 €. Thank you!', 'arch'],
  snap: ['Mail', 'Weekly digest', 'This week in motion design.', 'lake'],
  fling: ['Messages', 'Camille', 'Sent you three photos from Rome.', 'pond'],
  charge: ['Settings', 'Delete project', 'Hold to confirm. This is final.', 'aqueduct'],
  morph: ['Updates', 'Downloading', 'Version 2.4, 68 MB left.', 'lake'],
  peel: ['Stickers', 'New sticker pack', 'Twelve paintings to stick anywhere.', 'arch'],
  melt: ['Weather', 'Heat wave', '38° today, stay in the shade.', 'tuscany'],
  morphB: ['Updates', 'Ready to install', 'Restart to finish the update.', 'pines'],
};

export function theme() {
  return document.documentElement.dataset.theme === 'light'
    ? { bg: '#FFFFFF', line: 'rgba(0,0,0,0.07)', meta: '#8E959F', title: '#12151A', body: '#5A616B' }
    : { bg: '#1F2125', line: 'rgba(255,255,255,0.06)', meta: '#858B94', title: '#F2F4F7', body: '#A9AFB8' };
}

export function drawCard(ctx, w, h, id) {
  const c = theme();
  const [app, title, body, img] = COPY[id] ?? COPY.dust;
  const s = h / 84, r = 20 * s;
  ctx.fillStyle = c.bg;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, r); ctx.fill();
  ctx.strokeStyle = c.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(0.5, 0.5, w - 1, h - 1, r - 0.5); ctx.stroke();
  const is = 48 * s, ix = 16 * s, iy = (h - is) / 2;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(ix, iy, is, is, 12 * s); ctx.clip();
  cover(ctx, IMG[img], ix, iy, is, is);
  ctx.restore();
  const tx = ix + is + 14 * s, right = w - 16 * s;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${11 * s}px ${FONT}`; ctx.fillStyle = c.meta;
  ctx.fillText(app, tx, h / 2 - 12 * s);
  ctx.textAlign = 'right';
  ctx.fillText('now', right, h / 2 - 12 * s);
  ctx.textAlign = 'left';
  ctx.font = `600 ${14.5 * s}px ${FONT}`; ctx.fillStyle = c.title;
  ctx.fillText(title, tx, h / 2 + 6 * s);
  ctx.font = `400 ${13.5 * s}px ${FONT}`; ctx.fillStyle = c.body;
  let b = body;
  while (b.length > 4 && ctx.measureText(b).width > right - tx) b = b.slice(0, -2).trimEnd() + '…';
  ctx.fillText(b.replace(/……$/, '…'), tx, h / 2 + 24 * s);
}

export const binSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 5.5l-.62 10.03c-.16 2.56-.24 3.84-.88 4.76a4 4 0 0 1-1.2 1.13C15.84 22 14.56 22 12 22c-2.57 0-3.86 0-4.82-.59a4 4 0 0 1-1.2-1.13c-.64-.92-.72-2.2-.87-4.77L4.5 5.5"/><path d="M3 5.5h18M16.06 5.5l-.69-1.41c-.45-.94-.68-1.4-1.07-1.7a2 2 0 0 0-.27-.17C13.59 2 13.07 2 12.03 2c-1.06 0-1.6 0-2.04.23a2 2 0 0 0-.28.18c-.4.3-.62.79-1.06 1.76L8.05 5.5M9.5 16.5v-6M14.5 16.5v-6"/></svg><span class="bin-count" hidden>0</span>';

/**
 * Mounts a demo into `host` (a positioned element). Returns { run } to trigger it.
 * size: 'lg' for the variant stage, 'sm' for gallery tiles.
 */
export function mountDemo(host, id, { size = 'lg', autoplay = true } = {}) {
  const slot = host.querySelector('.stage-slot') ?? host;
  const big = size === 'lg';
  const W = Math.max(200, Math.min(big ? 360 : 300, host.clientWidth - (big ? 48 : 28)));
  const H = big ? 84 : 72;
  const card = snapshot(W, H, (ctx) => drawCard(ctx, W, H, id));
  card.style.width = W + 'px';
  card.style.height = H + 'px';
  card.className = 'demo-card';
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${HINTS[id]} (${id})`);
  const nodes = [card];
  let bin = null;
  if (id === 'stream') {
    bin = document.createElement('span');
    bin.className = 'demo-bin';
    bin.innerHTML = binSvg;
    nodes.push(bin);
  }
  slot.replaceChildren(...nodes);

  let busy = false;
  if (id === 'morph') return mountMorph(host, card, W, H);
  if (id === 'peel') return mountPeel(host, card);
  const show = (fade = true) => {
    card.style.transition = fade ? '' : 'none';
    card.style.opacity = '1';
    card.style.transform = '';
  };
  const hide = () => { card.style.transition = 'none'; card.style.opacity = '0'; };
  const rectOf = () => { const r = card.getBoundingClientRect(); return { source: card, x: r.left, y: r.top, w: r.width, h: r.height }; };
  const finish = (delay = 600) => setTimeout(() => { show(); busy = false; }, delay);

  async function run(extra = {}) {
    if (busy) return;
    busy = true;
    const base = { ...rectOf(), preset: id, ...extra };
    if (id === 'stream' && bin) {
      const b = bin.getBoundingClientRect();
      base.target = { x: b.left, y: b.top, width: b.width, height: b.height };
    }
    hide();
    if (ENTRANCES.includes(id)) {
      await play(base).done;
      show(false);
      busy = false;
      return;
    }
    if (id === 'charge' && !extra.hold) {
      // Scripted hold: heat up for a second, then burst.
      const h = play({ ...base, hold: true });
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = (now) => {
          h.aux.a0 = Math.min(1, (now - t0) / 1000);
          h.aux.a1 = now - t0;
          if (h.aux.a0 < 1) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      h.release();
      await h.done;
      return finish(400);
    }
    if (id === 'stream' && bin) {
      play(base).done.then(() => finish(500));
      setTimeout(() => {
        const n = bin.querySelector('.bin-count');
        n.textContent = +n.textContent + 1; n.hidden = false;
        bin.classList.add('bump'); setTimeout(() => bin.classList.remove('bump'), 400);
      }, 1100);
      return;
    }
    await play(base).done;
    finish();
  }

  // Gestures
  if (id === 'fling') {
    attachFling(card, {
      canStart: () => !busy,
      onTap: () => run(),
      onFling: (velocity) => run({ velocity }),
    });
  } else if (id === 'charge') {
    const hold = holdController(card, () => ({
      onStart: () => { busy = true; },
      onCommit: () => finish(400),
      onCancel: () => { busy = false; },
    }));
    attachHold(card, hold, () => !busy);
  } else if (id === 'snap' || id === 'shatter') {
    card.addEventListener('click', (e) => {
      const r = card.getBoundingClientRect();
      run({ origin: { x: e.clientX - r.left, y: e.clientY - r.top } });
    });
  } else {
    card.addEventListener('click', () => run());
  }

  host.querySelector('[data-replay]')?.addEventListener('click', () => run());
  if (autoplay) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      setTimeout(() => run(), typeof autoplay === 'number' ? autoplay : 700);
    }, { threshold: 0.6 });
    io.observe(card);
  }
  return { run };
}

/* ---------- morph: notification A rearranges its grains into notification B, and back ---------- */
function mountMorph(host, cardA, W, H) {
  const cardB = snapshot(W, H, (ctx) => drawCard(ctx, W, H, 'morphB'));
  cardB.style.width = W + 'px'; cardB.style.height = H + 'px';
  cardB.className = 'demo-card demo-card-b';
  cardB.style.opacity = '0';
  const wrap = document.createElement('div');
  wrap.className = 'demo-pair';
  cardA.replaceWith(wrap);
  wrap.append(cardA, cardB);
  let busy = false, onB = false;
  const box = (c) => { const r = c.getBoundingClientRect(); return { source: c, x: r.left, y: r.top, w: r.width, h: r.height }; };
  const run = async () => {
    if (busy) return;
    busy = true;
    const from = onB ? cardB : cardA, to = onB ? cardA : cardB;
    const a = box(cardA), b = box(cardB);
    for (const c of [cardA, cardB]) { c.style.transition = 'none'; c.style.opacity = '0'; }
    await morph(a, b, { reverse: onB }).done;
    to.style.opacity = '1';
    onB = !onB;
    busy = false;
  };
  wrap.addEventListener('click', run);
  host.querySelector('[data-replay]')?.addEventListener('click', run);
  return { run };
}

/* ---------- peel by hand: grab near any corner or edge, that point follows the pointer (useDissolvePeel) ---------- */
function mountPeel(host, card) {
  card.classList.add('grab');
  host.querySelector('[data-replay]')?.remove(); // driven by hand, nothing to replay
  const ctrl = peelController(card, () => ({
    onCommit: () => setTimeout(() => { card.style.transition = ''; card.style.opacity = '1'; }, 500),
  }));
  attachPeel(card, ctrl);
  return { run() {} };
}

/* ---------- shared gesture controllers (playground, tiles, stage) ---------- */

const tween = (ms, ease, onStep) => new Promise((res) => {
  const t0 = performance.now();
  const f = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    onStep(ease(k));
    if (k < 1) requestAnimationFrame(f); else res();
  };
  requestAnimationFrame(f);
});
const easeOut = (k) => 1 - (1 - k) ** 3;
const box = (el) => { const r = el.getBoundingClientRect(); return { source: el, x: r.left, y: r.top, w: r.width, h: r.height }; };
const hideEl = (el) => { el.style.transition = 'none'; el.style.opacity = '0'; };
const showEl = (el) => { el.style.transition = 'none'; el.style.opacity = '1'; };

// Touch: the cards are touch-action: pan-y, so a vertical swipe scrolls the page and cancels the
// pointer. A drag becomes the card's own once it leaves the press sideways; from then on the page
// holds still. Mouse and pen drag at once.
const sideways = (e, x0, y0) => { const dx = Math.abs(e.clientX - x0); return dx > 6 && dx > Math.abs(e.clientY - y0); };
const holdPage = (el, isOwn) => el.addEventListener('touchmove', (e) => { if (isOwn() && e.cancelable) e.preventDefault(); }, { passive: false });
const TOUCH_HOLD_DELAY = 120; // a swipe cancels the pointer within this, before any charge shows

/** Drag to throw (fling). onFling(velocity) on a fast release, onTap() on a tap, springs back otherwise. */
export function attachFling(el, { canStart = () => true, onFling, onTap, minSpeed = 300 }) {
  let start = null, last = null;
  el.addEventListener('pointerdown', (e) => {
    if (!canStart()) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    start = { x: e.clientX, y: e.clientY, on: e.pointerType !== 'touch' };
    last = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
    el.style.transition = 'none';
  });
  holdPage(el, () => !!start?.on);
  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (!start.on) { if (!sideways(e, start.x, start.y)) return; start.on = true; }
    const now = performance.now(), dt = Math.max(1, now - last.t);
    last = { x: e.clientX, y: e.clientY, t: now, vx: ((e.clientX - last.x) / dt) * 1000, vy: ((e.clientY - last.y) / dt) * 1000 };
    el.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px) rotate(${(e.clientX - start.x) * 0.04}deg)`;
  });
  const up = (e) => {
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    start = null;
    if (moved < 8) { el.style.transform = ''; onTap?.(); return; }
    if (Math.hypot(last.vx, last.vy) < minSpeed) { el.style.transition = ''; el.style.transform = ''; return; }
    onFling({ x: Math.round(last.vx), y: Math.round(last.vy) });
  };
  el.addEventListener('pointerup', up);
  // Cancelled (the page took the swipe): spring back, never a tap or a throw.
  el.addEventListener('pointercancel', () => { if (!start) return; start = null; el.style.transition = ''; el.style.transform = ''; });
}

/**
 * Hold to charge (useDissolveHold): the charge climbs over holdMs, the view shakes and heats,
 * it bursts from the finger at 100%. Released early it cools down and comes back.
 * get(): { grain, duration, holdMs, onStart, onProgress(c), onCommit, onCancel }
 */
export function holdController(el, get) {
  let h = null, t0 = 0, o = null, gen = 0;
  const tick = (now) => {
    if (!h) return;
    const c = Math.min(1, (now - t0) / (o.holdMs ?? 1000));
    h.aux.a0 = c; h.aux.a1 = now - t0;
    o.onProgress?.(c);
    if (c >= 1) { const cur = h; h = null; cur.release(); cur.done.then(() => o.onCommit?.()); return; }
    requestAnimationFrame(tick);
  };
  return {
    get active() { return !!h; },
    start(origin) {
      if (h) return;
      o = get();
      const b = box(el);
      if (!(b.w > 0)) return;
      gen++;
      hideEl(el);
      h = play({ ...b, preset: 'charge', hold: true, grain: o.grain, duration: o.duration ?? 900, origin: origin ?? { x: b.w / 2, y: b.h / 2 } });
      t0 = performance.now();
      o.onStart?.();
      requestAnimationFrame(tick);
    },
    async stop() {
      if (!h) return;
      const cur = h, c0 = cur.aux.a0, my = gen;
      h = null;
      await tween(320, easeOut, (k) => { cur.aux.a0 = c0 * (1 - k); cur.aux.a1 += 16; o.onProgress?.(c0 * (1 - k)); });
      cur.cancel();
      if (my === gen) showEl(el);
      o.onCancel?.();
    },
    cancel() { if (h) { h.cancel(); h = null; } },
  };
}

export function attachHold(el, ctrl, canStart = () => true) {
  let wait = 0;
  el.addEventListener('pointerdown', (e) => {
    if (!canStart() || ctrl.active) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), at = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.pointerType !== 'touch') { ctrl.start(at); return; }
    clearTimeout(wait);
    wait = setTimeout(() => { wait = 0; if (canStart()) ctrl.start(at); }, TOUCH_HOLD_DELAY);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => { clearTimeout(wait); wait = 0; ctrl.stop(); });
}

/**
 * Peel by hand (useDissolvePeel, hand mode n: [1, ax, ay]). The grabbed anchor follows the
 * pointer, release past threshold x diagonal commits, otherwise it springs back.
 * get(): { grain, duration, threshold, onStart, onCommit, onCancel }
 */
export function peelController(el, get) {
  let h = null, o = null, x0 = 0, y0 = 0, w = 0, ht = 0, ax = 0, ay = 0, busy = false;
  const api = {
    get busy() { return busy; },
    grab(px, py) {
      if (busy) return false;
      const b = box(el);
      if (!(b.w > 0)) return false;
      busy = true;
      o = get();
      w = b.w; ht = b.h; x0 = px; y0 = py;
      // Anchor: nearest corner when grabbed close to one, else the nearest point of the closest edge.
      const sx = px - b.x, sy = py - b.y, dl = sx, dr = w - sx, dt = sy, db = ht - sy;
      if (Math.min(dl, dr) < w * 0.28 && Math.min(dt, db) < ht * 0.28) { ax = dl < dr ? 0 : w; ay = dt < db ? 0 : ht; }
      else {
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) { ax = 0; ay = sy; } else if (m === dr) { ax = w; ay = sy; } else if (m === dt) { ax = sx; ay = 0; } else { ax = sx; ay = ht; }
      }
      h = play({ ...b, preset: 'peel', n: [1, ax, ay], hold: true, grain: o.grain, duration: o.duration ?? 700 });
      h.aux.a0 = ax; h.aux.a1 = ay;
      hideEl(el);
      o.onStart?.();
      return true;
    },
    move(px, py) { if (h) { h.aux.a0 = ax + px - x0; h.aux.a1 = ay + py - y0; } },
    async drop() {
      if (!h) return;
      const cur = h; h = null;
      const dx = cur.aux.a0 - ax, dy = cur.aux.a1 - ay, dist = Math.hypot(dx, dy), diag = Math.hypot(w, ht);
      const sx = cur.aux.a0, sy = cur.aux.a1;
      if (dist / diag >= (o.threshold ?? 0.4)) {
        const ux = dx / dist, uy = dy / dist;
        cur.release();
        await tween(o.duration ?? 700, (k) => k * k, (k) => { cur.aux.a0 = sx + ux * diag * 2.4 * k; cur.aux.a1 = sy + uy * diag * 2.4 * k; });
        await cur.done;
        busy = false;
        o.onCommit?.();
      } else {
        await tween(320, easeOut, (k) => { cur.aux.a0 = sx + (ax - sx) * k; cur.aux.a1 = sy + (ay - sy) * k; });
        cur.cancel();
        showEl(el);
        busy = false;
        o.onCancel?.();
      }
    },
    /** Scripted pull from the bottom right corner (Play button). */
    async pull(amount = 0.62) {
      const b = box(el);
      if (!api.grab(b.x + b.w - 2, b.y + b.h - 2)) return;
      const tx = -b.w * amount, ty = -b.h * amount * 1.6;
      await tween(560, easeOut, (k) => api.move(b.x + b.w - 2 + tx * k, b.y + b.h - 2 + ty * k));
      await api.drop();
    },
    cancel() { if (h) { h.cancel(); h = null; } busy = false; },
  };
  return api;
}

export function attachPeel(el, ctrl, canStart = () => true) {
  let pend = null, on = false;
  const grab = (e, x, y) => {
    if (!ctrl.grab(x, y)) return;
    on = true;
    try { el.setPointerCapture(e.pointerId); } catch {}
  };
  el.addEventListener('pointerdown', (e) => {
    if (!canStart()) return;
    if (e.pointerType === 'touch') pend = { x: e.clientX, y: e.clientY };
    else grab(e, e.clientX, e.clientY);
  });
  holdPage(el, () => on);
  el.addEventListener('pointermove', (e) => {
    if (pend) {
      if (!sideways(e, pend.x, pend.y)) return;
      const p = pend; pend = null;
      grab(e, p.x, p.y);
    }
    if (on) ctrl.move(e.clientX, e.clientY);
  });
  const end = () => { pend = null; if (!on) return; on = false; ctrl.drop(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/**
 * Scrub (useDissolveScrub): drag along x, the wave starts from the edge the finger leaves and
 * follows it. Release past threshold (or a fast flick) commits, otherwise it rewinds.
 * get(): { preset, grain, duration, threshold, onStart, onCommit, onCancel, onTap }
 */
export function attachScrub(el, get, canStart = () => true) {
  let st = null;
  el.addEventListener('pointerdown', (e) => {
    if (!canStart()) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    st = { x0: e.clientX, y0: e.clientY, touch: e.pointerType === 'touch', last: e.clientX, t: performance.now(), v: 0, h: null, o: get(), b: box(el) };
  });
  holdPage(el, () => !!st?.h);
  el.addEventListener('pointermove', (e) => {
    if (!st) return;
    const now = performance.now(), dx = e.clientX - st.x0;
    st.v = ((e.clientX - st.last) / Math.max(1, now - st.t)) * 1000; st.last = e.clientX; st.t = now;
    if (!st.h) {
      if (Math.abs(dx) < 8 || (st.touch && !sideways(e, st.x0, st.y0))) return;
      st.right = dx > 0;
      st.h = play({ ...st.b, preset: st.o.preset, grain: st.o.grain, duration: st.o.duration, origin: st.right ? 'left' : 'right', hold: true });
      const v = ENGINE[st.o.preset];
      st.reach = (v.spread ?? 0.55) + (v.jitter ?? 0.08);
      // drag range: distance to the far edge, at least 40 percent of the view
      const sx = st.x0 - st.b.x;
      st.range = Math.max(st.b.w * 0.4, st.right ? st.b.w - sx : sx);
      hideEl(el);
      st.o.onStart?.();
    }
    st.frac = Math.max(0, Math.min(1, (st.right ? dx : -dx) / st.range));
    st.h.set(st.frac * st.reach);
  });
  const up = async (e) => {
    if (!st) return;
    const cur = st; st = null;
    if (!cur.h) { if (e.type === 'pointerup') cur.o.onTap?.(); return; }
    const along = cur.right ? cur.v : -cur.v;
    if (cur.frac >= (cur.o.threshold ?? 0.55) || along > 800) {
      cur.h.release();
      await cur.h.done;
      cur.o.onCommit?.();
    } else {
      const p0 = cur.frac * cur.reach;
      await tween(360, easeOut, (k) => cur.h.set(p0 * (1 - k)));
      cur.h.cancel();
      showEl(el);
      cur.o.onCancel?.();
    }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

/* ======================================================================================
   Demo tiles: two small real world scenes per variant page (small 1/3, wide 2/3).
   Everything dissolvable is a canvas, so the snapshot handed to the engine is exact.
   ====================================================================================== */

const div = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
const btn = (label, cls = '') => { const b = document.createElement('button'); b.className = 'chip tl-btn ' + cls; b.textContent = label; return b; };
const cv = (w, h, fn, cls = '') => item(Math.round(w), Math.round(h), fn, 'tl-item ' + cls);

function avatar(ctx, x, y, s, img, letter, color) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.clip();
  if (img) cover(ctx, IMG[img], x, y, s, s);
  else { ctx.fillStyle = color; ctx.fillRect(x, y, s, s); text(ctx, letter, x + s / 2, y + s / 2 + s * 0.17, { size: s * 0.45, weight: 600, color: '#fff', align: 'center' }); }
  ctx.restore();
}

/** List row: avatar or thumbnail, title, sub line, meta on the right. */
function drawRow(ctx, w, h, { img, letter, color, title, sub, meta, square = false, r = 14 }) {
  const p = pal();
  ctx.fillStyle = p.card; rr(ctx, 0, 0, w, h, r); ctx.fill();
  ctx.strokeStyle = p.line; rr(ctx, 0.5, 0.5, w - 1, h - 1, r); ctx.stroke();
  const s = Math.min(36, h - 16), ix = 10, iy = (h - s) / 2;
  if (square) { ctx.save(); rr(ctx, ix, iy, s, s, 8); ctx.clip(); cover(ctx, IMG[img], ix, iy, s, s); ctx.restore(); }
  else avatar(ctx, ix, iy, s, img, letter, color);
  const tx = ix + s + 10, right = w - 12;
  if (meta) text(ctx, meta, right, h / 2 - 3, { size: 11, color: p.muted, align: 'right' });
  ctx.font = `600 13px ${FONT}`;
  let t = title;
  const maxT = right - tx - (meta ? ctx.measureText(meta).width + 10 : 0);
  while (t.length > 3 && ctx.measureText(t).width > maxT) t = t.slice(0, -2) + '…';
  text(ctx, t, tx, sub ? h / 2 - 3 : h / 2 + 4, { size: 13, weight: 600, color: p.ink });
  if (sub) {
    ctx.font = `400 12px ${FONT}`;
    let b = sub;
    while (b.length > 3 && ctx.measureText(b).width > right - tx) b = b.slice(0, -2) + '…';
    text(ctx, b, tx, h / 2 + 13, { size: 12, color: p.text });
  }
}

function drawPill(ctx, w, h, label, { fill, color, stroke } = {}) {
  const p = pal();
  ctx.fillStyle = fill ?? p.card; rr(ctx, 0, 0, w, h, h / 2); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; rr(ctx, 0.5, 0.5, w - 1, h - 1, h / 2 - 0.5); ctx.stroke(); }
  text(ctx, label, w / 2, h / 2 + 4.5, { size: 13, weight: 600, color: color ?? p.ink, align: 'center' });
}

/** A slot whose height collapses smoothly once its item is gone. */
function slot(el, cls = 'tl-slot') { const s = div(cls); s.append(el); return s; }
async function collapse(s) {
  s.style.height = s.offsetHeight + 'px';
  void s.offsetHeight;
  s.classList.add('gone');
  await new Promise((r) => setTimeout(r, 320));
  s.remove();
}

const TILES = {};
const tile = (id, small, wide) => { TILES[id] = [small, wide]; };

/* -------- reusable scene builders -------- */

/** Vertical list: tap a row, it leaves with preset and the list closes up. Refills when empty. */
function listScene({ title, hint, rows, h = 52, preset, opts = {}, extra, touch = false, draw = drawRow, empty = 'All clear' }) {
  return {
    title, hint,
    mount(body, x) {
      const fill = () => {
        body.replaceChildren();
        const list = div('tl-list');
        rows.forEach((r) => {
          const el = cv(x.W, h, (c, w, hh) => draw(c, w, hh, r));
          const s = slot(el);
          el.addEventListener('click', async (e) => {
            if (el.dataset.busy) return;
            el.dataset.busy = '1';
            const b = rectOf(el);
            const o = { ...b, preset, ...opts };
            if (touch) o.origin = { x: e.clientX - b.x, y: e.clientY - b.y };
            if (extra) Object.assign(o, extra(el));
            hide(el);
            await x.track(play(o)).done;
            if (!x.alive()) return;
            await collapse(s);
            if (!list.querySelector('.tl-item')) {
              list.append(div('tl-empty', empty));
              x.later(fill, 1300);
            }
          });
          list.append(s);
        });
        body.append(list);
      };
      fill();
    },
  };
}

/** One object in the middle: tap it, it leaves with preset, then fades back. */
function oneScene({ title, hint, w = 1, h, draw, preset, opts = {}, touch = false, back = 700 }) {
  return {
    title, hint,
    mount(body, x) {
      const W = Math.min(x.W, typeof w === 'number' && w <= 1 ? x.W * w : w);
      const el = cv(W, h, draw);
      const c = div('tl-center');
      c.append(el);
      body.append(c);
      el.addEventListener('click', async (e) => {
        if (el.dataset.busy) return;
        el.dataset.busy = '1';
        const b = rectOf(el);
        const o = { ...b, preset, ...opts };
        if (touch) o.origin = { x: e.clientX - b.x, y: e.clientY - b.y };
        hide(el);
        await x.track(play(o)).done;
        x.later(() => { show(el); delete el.dataset.busy; }, back);
      });
    },
  };
}

/** Entrance: a button adds items that assemble with preset. */
function appearList({ title, hint, label, make, h = 52, preset, max = 3, stagger = 0, batch = 1, opts = {} }) {
  return {
    title, hint,
    mount(body, x) {
      const list = div('tl-list tl-list-end');
      const b = btn(label);
      let i = 0;
      body.append(list, div('tl-foot'));
      body.lastChild.append(b);
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        const els = [];
        for (let k = 0; k < batch; k++) {
          const r = make(i++);
          const el = cv(r.w ?? x.W, r.h ?? h, (c, w, hh) => r.draw(c, w, hh));
          el.style.opacity = '0';
          const s = slot(el, 'tl-slot' + (r.right ? ' tl-right' : ''));
          list.append(s);
          els.push(el);
        }
        while (list.children.length > max) list.firstChild.remove();
        await new Promise(requestAnimationFrame);
        await Promise.all(els.map((el, k) => new Promise((res) => x.later(async () => {
          await x.track(play({ ...rectOf(el), preset, direction: 'in', ...opts })).done;
          if (x.alive()) show(el, false);
          res();
        }, k * stagger))));
        b.disabled = false;
      });
      x.later(() => b.click(), 450);
    },
  };
}

/* -------- per variant scenes -------- */

const MAIL = [
  { img: 'temple', title: 'Lina Haddad', sub: 'Dinner at 8? I booked the terrace.', meta: '9:41' },
  { letter: 'S', color: '#3A6FE6', title: 'Stripe', sub: 'Your payout of 1 240 € is on its way.', meta: '9:12' },
  { img: 'lake', title: 'Hugo Martin', sub: 'Sent the new deck, page 4 is the one.', meta: '8:57' },
  { letter: 'F', color: '#E4572E', title: 'Figma', sub: 'Camille commented on Onboarding v3.', meta: 'Tue' },
];
const NOTIFS = [
  { letter: 'C', color: '#34A853', title: 'Calendar', sub: 'Design review in 10 minutes', meta: 'now' },
  { img: 'pond', title: 'Photos', sub: 'New memory: Rome, 2023', meta: '2m' },
  { letter: 'B', color: '#F59E0B', title: 'Bank', sub: 'Card ending 4402 was charged 12 €', meta: '5m' },
];

tile('dust',
  listScene({ title: 'Clear a notification', hint: 'Tap a notification', rows: NOTIFS, preset: 'dust', h: 50, empty: 'No new notifications' }),
  listScene({ title: 'Inbox', hint: 'Tap a mail to archive it', rows: MAIL.slice(0, 3), h: 50, preset: 'dust', opts: { grain: 2.5 }, empty: 'Inbox zero' }));

function drawPhoto(name, trash) {
  return (c, w, h) => {
    c.save(); rr(c, 0, 0, w, h, 14); c.clip(); cover(c, IMG[name], 0, 0, w, h); c.restore();
    if (trash) {
      c.fillStyle = 'rgba(0,0,0,0.45)'; rr(c, w - 40, h - 40, 30, 30, 15); c.fill();
      c.save(); c.translate(w - 34, h - 34); c.scale(0.75, 0.75); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.lineCap = 'round';
      c.stroke(new Path2D('M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6')); c.restore();
    }
  };
}
tile('sand',
  oneScene({ title: 'Delete a photo', hint: 'Tap the photo', w: 0.78, h: 180, draw: drawPhoto('villa', true), preset: 'sand', back: 900 }),
  {
    title: 'Photo grid', hint: 'Tap photos to delete them',
    mount(body, x) {
      const names = ['temple', 'lake', 'pines', 'arch', 'valley', 'pond', 'cypress', 'tuscany'];
      const cols = 4, gap = 6, sz = Math.floor((x.W - gap * (cols - 1)) / cols), hh = Math.min(sz, Math.floor((x.H - gap) / 2));
      const grid = div('tl-grid');
      grid.style.gridTemplateColumns = `repeat(${cols}, ${sz}px)`;
      const fill = () => {
        grid.replaceChildren();
        names.forEach((n) => {
          const el = cv(sz, hh, drawPhoto(n));
          el.addEventListener('click', async () => {
            if (el.dataset.busy) return;
            el.dataset.busy = '1';
            hide(el);
            await x.track(play({ ...rectOf(el), preset: 'sand', grain: 2.5, duration: 1300 })).done;
            if (!x.alive()) return;
            el.style.visibility = 'hidden';
            if (![...grid.children].some((c) => c.style.visibility !== 'hidden')) x.later(fill, 900);
          });
          grid.append(el);
        });
      };
      fill();
      body.append(grid);
    },
  });

tile('ember',
  oneScene({
    title: 'Burn after reading', hint: 'Tap to burn the note', w: 0.9, h: 150, preset: 'ember', back: 900,
    draw: (c, w, h) => {
      const p = pal();
      c.fillStyle = '#2A1C14'; rr(c, 0, 0, w, h, 16); c.fill();
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,140,60,0.35)'); g.addColorStop(1, 'rgba(255,60,40,0.05)');
      c.fillStyle = g; rr(c, 0, 0, w, h, 16); c.fill();
      text(c, 'SECRET', 16, 26, { size: 10.5, weight: 600, color: '#FFB27A', mono: true });
      text(c, 'The door code is', 16, 62, { size: 15, color: '#F7E6D8' });
      text(c, '4 0 2 7  #', 16, 92, { size: 24, weight: 600, color: '#FFFFFF', mono: true });
      text(c, 'Self destructs when read', 16, h - 16, { size: 11.5, color: 'rgba(247,230,216,0.6)' });
      void p;
    },
  }),
  listScene({
    title: 'Drafts', hint: 'Tap a draft to discard it', preset: 'ember', empty: 'No drafts',
    rows: [
      { letter: 'D', color: '#B45309', title: 'Re: Quarterly plan', sub: 'I think we should cut the second launch…', meta: 'Draft' },
      { letter: 'D', color: '#B45309', title: 'Offer letter, Sam', sub: 'Hi Sam, we are thrilled to offer you…', meta: 'Draft' },
      { letter: 'D', color: '#B45309', title: 'Angry reply to Kevin', sub: 'With all due respect, the build was…', meta: 'Draft' },
    ],
  }));

const INVADER = ['00100100', '00011000', '00111100', '01101110', '11111111', '10111101', '10100101', '00011000'];
function drawInvader(color, bg) {
  return (c, w, h) => {
    c.fillStyle = bg; rr(c, 0, 0, w, h, 12); c.fill();
    const px = Math.floor(Math.min(w, h) * 0.7 / 8), ox = (w - px * 8) / 2, oy = (h - px * 8) / 2;
    c.fillStyle = color;
    INVADER.forEach((row, y) => [...row].forEach((b, xx) => { if (b === '1') c.fillRect(ox + xx * px, oy + y * px, px, px); }));
  };
}
tile('pixel',
  oneScene({
    title: 'Coin collected', hint: 'Tap the coin', w: 120, h: 120, preset: 'pixel', back: 600,
    draw: (c, w, h) => {
      const px = 10, map = ['0011100', '0122210', '1223221', '1223221', '1223221', '0122210', '0011100'];
      const col = ['', '#B7791F', '#F6C343', '#FFF3C4'];
      const ox = (w - px * 7) / 2, oy = (h - px * 7) / 2;
      map.forEach((r, y) => [...r].forEach((v, xx) => { if (v !== '0') { c.fillStyle = col[+v]; c.fillRect(ox + xx * px, oy + y * px, px, px); } }));
    },
  }),
  {
    title: 'Arcade', hint: 'Tap the invaders',
    mount(body, x) {
      const score = div('tl-score', 'SCORE 0');
      const row = div('tl-row');
      const colors = ['#7CE38B', '#F472B6', '#60A5FA', '#FBBF24'];
      let pts = 0;
      const size = Math.min(110, Math.floor((x.W - 30) / 4));
      const fill = () => {
        row.replaceChildren();
        colors.forEach((col) => {
          const el = cv(size, size, drawInvader(col, isLight() ? '#1B1E24' : '#101114'));
          el.addEventListener('click', async () => {
            if (el.dataset.busy) return;
            el.dataset.busy = '1';
            hide(el);
            await x.track(play({ ...rectOf(el), preset: 'pixel', grain: 6, duration: 1000 })).done;
            if (!x.alive()) return;
            pts += 100; score.textContent = `SCORE ${pts}`;
            el.style.visibility = 'hidden';
            if (![...row.children].some((c) => c.style.visibility !== 'hidden')) x.later(fill, 700);
          });
          row.append(el);
        });
      };
      fill();
      body.append(score, row);
    },
  });

tile('vortex',
  {
    title: 'Clear all', hint: 'Press Clear all',
    mount(body, x) {
      const list = div('tl-list');
      const b = btn('Clear all');
      const fill = () => {
        list.replaceChildren(...NOTIFS.map((r) => slot(cv(x.W, 42, (c, w, h) => drawRow(c, w, h, r)))));
        b.disabled = false;
      };
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        const els = [...list.querySelectorAll('.tl-item')];
        await Promise.all(els.map((el, i) => new Promise((res) => x.later(async () => {
          hide(el);
          await x.track(play({ ...rectOf(el), preset: 'vortex', duration: 1100 })).done;
          res();
        }, i * 140))));
        if (!x.alive()) return;
        list.replaceChildren(div('tl-empty', 'No notifications'));
        x.later(fill, 1200);
      });
      fill();
      body.append(list, div('tl-foot'));
      body.lastChild.append(b);
    },
  },
  {
    title: 'Browser tabs', hint: 'Tap a tab to close it',
    mount(body, x) {
      const tabs = [['temple', 'Paestum, travel guide'], ['lake', 'Lakes of Lombardy'], ['pines', 'Pine forests, a field note'], ['arch', 'Roman arches'], ['valley', 'Val d’Orcia walks'], ['villa', 'Villa rentals']];
      const cols = 3, gap = 8, tw = Math.floor((x.W - gap * 2) / cols), th = Math.min(96, Math.floor((x.H - gap) / 2));
      const grid = div('tl-grid');
      grid.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
      const fill = () => {
        grid.replaceChildren(...tabs.map(([n, t]) => {
          const el = cv(tw, th, (c, w, h) => {
            const p = pal();
            c.fillStyle = p.card; rr(c, 0, 0, w, h, 12); c.fill();
            c.save(); rr(c, 0, 24, w, h - 24, [0, 0, 12, 12]); c.clip(); cover(c, IMG[n], 0, 24, w, h - 24); c.restore();
            c.font = `500 11px ${FONT}`;
            let s = t; while (s.length > 3 && c.measureText(s).width > w - 34) s = s.slice(0, -2) + '…';
            text(c, s, 10, 16, { size: 11, weight: 500, color: p.ink });
            text(c, '×', w - 12, 17, { size: 15, color: p.muted, align: 'center' });
          });
          el.addEventListener('click', async () => {
            if (el.dataset.busy) return;
            el.dataset.busy = '1';
            hide(el);
            await x.track(play({ ...rectOf(el), preset: 'vortex', duration: 1200 })).done;
            if (!x.alive()) return;
            el.style.visibility = 'hidden';
            if (![...grid.children].some((c) => c.style.visibility !== 'hidden')) x.later(fill, 800);
          });
          return el;
        }));
      };
      fill();
      body.append(grid);
    },
  });

tile('shatter',
  oneScene({
    title: 'Wrong passcode', hint: 'Tap where the glass breaks', w: 0.9, h: 160, preset: 'shatter', touch: true, opts: { n: [160] }, back: 800,
    draw: (c, w, h) => {
      const p = pal();
      c.save(); rr(c, 0, 0, w, h, 18); c.clip(); cover(c, IMG.aqueduct, 0, 0, w, h);
      c.fillStyle = 'rgba(10,12,16,0.55)'; c.fillRect(0, 0, w, h); c.restore();
      text(c, 'Enter passcode', w / 2, 40, { size: 14, weight: 600, color: '#fff', align: 'center' });
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(w / 2 - 33 + i * 22, 74, 6, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); }
      text(c, 'Wrong passcode, try again', w / 2, 118, { size: 12, color: '#FCA5A5', align: 'center' });
      void p;
    },
  }),
  {
    title: 'Framed paintings', hint: 'Tap a frame where it should crack',
    mount(body, x) {
      const names = ['villa', 'cypress', 'tuscany'];
      const gap = 10, fw = Math.floor((x.W - gap * 2) / 3), fh = Math.min(x.H - 10, Math.round(fw * 1.2));
      const row = div('tl-row');
      names.forEach((n) => {
        const el = cv(fw, fh, (c, w, h) => {
          c.fillStyle = isLight() ? '#3B2F25' : '#C9B79C'; rr(c, 0, 0, w, h, 6); c.fill();
          c.fillStyle = '#F5F0E6'; c.fillRect(8, 8, w - 16, h - 16);
          cover(c, IMG[n], 16, 16, w - 32, h - 32);
          const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.4, 'rgba(255,255,255,0)');
          c.fillStyle = g; c.fillRect(16, 16, w - 32, h - 32);
        });
        el.addEventListener('click', async (e) => {
          if (el.dataset.busy) return;
          el.dataset.busy = '1';
          const b = rectOf(el);
          hide(el);
          await x.track(play({ ...b, preset: 'shatter', origin: { x: e.clientX - b.x, y: e.clientY - b.y }, n: [200], duration: 1500 })).done;
          x.later(() => { show(el); delete el.dataset.busy; }, 700);
        });
        row.append(el);
      });
      body.append(row);
    },
  });

function folderTarget(label) {
  const t = div('tl-target', `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>${label}</span><span class="bin-count" hidden>0</span>`);
  t.bump = () => { const n = t.querySelector('.bin-count'); n.textContent = +n.textContent + 1; n.hidden = false; t.classList.add('bump'); setTimeout(() => t.classList.remove('bump'), 400); };
  return t;
}
const targetOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
const FILES = [
  { letter: 'P', color: '#E4572E', title: 'Invoice_0425.pdf', sub: '214 KB', meta: 'PDF' },
  { letter: 'K', color: '#3A6FE6', title: 'Pitch deck v7.key', sub: '18.2 MB', meta: 'Keynote' },
  { img: 'lake', square: true, title: 'IMG_2048.heic', sub: '3.1 MB', meta: 'Photo' },
];
tile('stream',
  {
    title: 'Move to folder', hint: 'Tap the file',
    mount(body, x) {
      const folder = folderTarget('Taxes');
      const el = cv(Math.min(x.W - 20, 200), 52, (c, w, h) => drawRow(c, w, h, FILES[0]));
      const wrap = div('tl-stream');
      wrap.append(el, folder);
      body.append(wrap);
      el.addEventListener('click', async () => {
        if (el.dataset.busy) return;
        el.dataset.busy = '1';
        hide(el);
        x.later(folder.bump, 900);
        await x.track(play({ ...rectOf(el), preset: 'stream', target: targetOf(folder), duration: 1400 })).done;
        x.later(() => { show(el); delete el.dataset.busy; }, 600);
      });
    },
  },
  {
    title: 'Downloads', hint: 'Tap a file, it flies to the bin',
    mount(body, x) {
      const bin = div('tl-target tl-bin', binSvg);
      bin.bump = () => { const n = bin.querySelector('.bin-count'); n.textContent = +n.textContent + 1; n.hidden = false; bin.classList.add('bump'); setTimeout(() => bin.classList.remove('bump'), 400); };
      const side = div('tl-side');
      const listHost = div('tl-grow');
      side.append(listHost, bin);
      body.append(side);
      listScene({
        rows: FILES, preset: 'stream', empty: 'Downloads is empty',
        extra: () => { x.later(bin.bump, 950); return { target: targetOf(bin), duration: 1400 }; },
      }).mount(listHost, { ...x, W: x.W - 64 });
    },
  });

tile('gather',
  appearList({
    title: 'New message', hint: 'Press Receive', label: 'Receive', preset: 'gather', max: 3, h: 44,
    make: (i) => {
      const t = ['Here are the refs for the hero.', 'Can you look at it tonight?', 'Love the second one!', 'Shipping Friday.'][i % 4];
      return { w: 220, h: 44, draw: (c, w, h) => bubble(c, w, h, t, false) };
    },
  }),
  {
    title: 'Chat', hint: 'Press Send',
    mount(body, x) {
      const lines = ['Did the build pass?', 'Yes, all green. Shipping now.', 'Perfect, thanks!', 'Drinks at 7 to celebrate?'];
      const thread = div('tl-list tl-list-end');
      const bar = div('tl-composer', '<span>Message</span>');
      const send = btn('Send', 'tl-send');
      bar.append(send);
      body.append(thread, bar);
      let i = 0;
      const add = async () => {
        if (send.disabled) return;
        send.disabled = true;
        const me = i % 2 === 0, t = lines[i++ % lines.length];
        const bw = Math.min(x.W * 0.7, 300);
        const el = cv(bw, 40, (c, w, h) => bubble(c, w, h, t, me));
        el.style.opacity = '0';
        thread.append(slot(el, 'tl-slot' + (me ? ' tl-right' : '')));
        while (thread.children.length > 3) thread.firstChild.remove();
        await new Promise(requestAnimationFrame);
        await x.track(play({ ...rectOf(el), preset: 'gather', direction: 'in', duration: 1000 })).done;
        if (x.alive()) show(el, false);
        send.disabled = false;
      };
      send.addEventListener('click', add);
      x.later(add, 500);
    },
  });

function bubble(c, w, h, t, me) {
  const p = pal();
  c.font = `400 13px ${FONT}`;
  const tw = Math.min(w, c.measureText(t).width + 28);
  const x0 = me ? w - tw : 0;
  c.fillStyle = me ? p.me : p.them; rr(c, x0, 0, tw, h, 18); c.fill();
  text(c, t, x0 + 14, h / 2 + 4.5, { size: 13, color: me ? p.meText : p.ink });
}

const FEED = [
  { img: 'cypress', title: 'Cypress alley at dawn', sub: '2.4k likes · Tuscany', meta: '1h' },
  { img: 'pond', title: 'Water lilies, study', sub: '980 likes · Giverny', meta: '3h' },
  { img: 'aqueduct', title: 'Old aqueduct', sub: '1.1k likes · Segovia', meta: '5h' },
];
tile('rain',
  appearList({
    title: 'Pull to refresh', hint: 'Press Refresh', label: 'Refresh', preset: 'rain', max: 3, batch: 3, stagger: 90, h: 46,
    make: (i) => ({ draw: (c, w, h) => drawRow(c, w, h, { ...FEED[i % 3], square: true }) }),
    opts: { duration: 1100 },
  }),
  {
    title: 'Products', hint: 'Press Load more',
    mount(body, x) {
      const items = [['villa', 'Linen shirt', '79 €'], ['temple', 'Clay vase', '45 €'], ['tuscany', 'Olive oil', '24 €'], ['pines', 'Pine candle', '32 €']];
      const cols = 4, gap = 8, pw = Math.floor((x.W - gap * 3) / cols), ph = Math.min(x.H - 48, Math.round(pw * 1.25));
      const grid = div('tl-grid');
      grid.style.gridTemplateColumns = `repeat(${cols}, ${pw}px)`;
      const b = btn('Load more');
      body.append(grid, div('tl-foot'));
      body.lastChild.append(b);
      let round = 0;
      const load = async () => {
        if (b.disabled) return;
        b.disabled = true;
        const shift = round++;
        const els = items.map((_, k) => {
          const [n, t, price] = items[(k + shift) % 4];
          const el = cv(pw, ph, (c, w, h) => {
            const p = pal();
            c.fillStyle = p.card; rr(c, 0, 0, w, h, 12); c.fill();
            c.save(); rr(c, 0, 0, w, h - 40, [12, 12, 0, 0]); c.clip(); cover(c, IMG[n], 0, 0, w, h - 40); c.restore();
            text(c, t, 8, h - 22, { size: 12, weight: 600, color: p.ink });
            text(c, price, 8, h - 7, { size: 11.5, color: p.text });
          });
          el.style.opacity = '0';
          return el;
        });
        grid.replaceChildren(...els);
        await new Promise(requestAnimationFrame);
        await Promise.all(els.map((el, k) => new Promise((res) => x.later(async () => {
          await x.track(play({ ...rectOf(el), preset: 'rain', direction: 'in', duration: 1100 })).done;
          if (x.alive()) show(el, false);
          res();
        }, k * 110))));
        b.disabled = false;
      };
      b.addEventListener('click', load);
      x.later(load, 450);
    },
  });

function drawReceipt(c, w, h) {
  const ink = '#1B1E24', soft = '#6B7280';
  c.fillStyle = '#FBFAF7';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h - 6);
  for (let xx = w; xx > 0; xx -= 10) { c.lineTo(xx - 5, h); c.lineTo(xx - 10, h - 6); }
  c.closePath(); c.fill();
  text(c, 'CAFÉ LUMEN', w / 2, 24, { size: 12, weight: 600, color: ink, align: 'center', mono: true });
  text(c, '12 rue des Arts, Paris', w / 2, 38, { size: 9.5, color: soft, align: 'center', mono: true });
  const rows = [['Flat white', '4.20'], ['Croissant', '2.80'], ['Granola', '8.50']];
  const step = Math.min(17, (h - 110) / 4), y0 = 62;
  rows.forEach(([a, b], i) => { text(c, a, 12, y0 + i * step, { size: 10.5, color: ink, mono: true }); text(c, b, w - 12, y0 + i * step, { size: 10.5, color: ink, mono: true, align: 'right' }); });
  const ly = y0 + 3 * step - 6;
  c.strokeStyle = '#D1D5DB'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(12, ly); c.lineTo(w - 12, ly); c.stroke(); c.setLineDash([]);
  text(c, 'TOTAL', 12, ly + 18, { size: 11, weight: 600, color: ink, mono: true });
  text(c, '15.50 €', w - 12, ly + 18, { size: 11, weight: 600, color: ink, mono: true, align: 'right' });
  text(c, 'Thank you!', w / 2, h - 18, { size: 10, color: soft, align: 'center', mono: true });
}
function drawPass(c, w, h) {
  const p = pal();
  c.fillStyle = p.card; rr(c, 0, 0, w, h, 16); c.fill();
  c.fillStyle = '#3A6FE6'; rr(c, 0, 0, w, 34, [16, 16, 0, 0]); c.fill();
  text(c, 'BOARDING PASS', 16, 22, { size: 11, weight: 600, color: '#fff', mono: true });
  text(c, 'AF 1234 · 14 NOV', w - 16, 22, { size: 11, color: 'rgba(255,255,255,0.85)', mono: true, align: 'right' });
  text(c, 'CDG', 16, 76, { size: 30, weight: 600, color: p.ink });
  text(c, 'Paris', 16, 93, { size: 11.5, color: p.muted });
  text(c, 'FCO', w * 0.42, 76, { size: 30, weight: 600, color: p.ink });
  text(c, 'Rome', w * 0.42, 93, { size: 11.5, color: p.muted });
  text(c, '→', w * 0.28, 72, { size: 18, color: p.muted });
  [['GATE', 'K42'], ['SEAT', '14A'], ['BOARDS', '09:15']].forEach(([k, v], i) => {
    const xx = 16 + i * Math.min(80, (w - 140) / 3);
    text(c, k, xx, h - 34, { size: 10, color: p.muted, mono: true });
    text(c, v, xx, h - 14, { size: 15, weight: 600, color: p.ink });
  });
  for (let i = 0; i < 20; i++) { c.fillStyle = p.ink; const bw = (i * 7) % 3 + 1; c.fillRect(w - 112 + i * 5, h - 60, bw, 46); }
}
tile('print',
  {
    title: 'Receipt', hint: 'Press Pay',
    mount(body, x) {
      const b = btn('Pay 15.50 €');
      const el = cv(Math.min(160, x.W - 100), Math.min(x.H - 4, 196), drawReceipt);
      el.style.opacity = '0';
      const row = div('tl-row tl-doc');
      row.append(el, b);
      body.append(row);
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        hide(el);
        await new Promise(requestAnimationFrame);
        await x.track(play({ ...rectOf(el), preset: 'print', direction: 'in', duration: 1600 })).done;
        if (x.alive()) show(el, false);
        b.disabled = false;
      });
      x.later(() => b.click(), 450);
    },
  },
  {
    title: 'Boarding pass', hint: 'Press Check in',
    mount(body, x) {
      const b = btn('Check in');
      const el = cv(Math.min(x.W - 110, 420), Math.min(x.H - 10, 168), drawPass);
      el.style.opacity = '0';
      const row = div('tl-row tl-doc');
      row.append(el, b);
      body.append(row);
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        hide(el);
        await new Promise(requestAnimationFrame);
        await x.track(play({ ...rectOf(el), preset: 'print', direction: 'in', duration: 1500 })).done;
        if (x.alive()) show(el, false);
        b.disabled = false;
      });
      x.later(() => b.click(), 450);
    },
  });

tile('snap',
  {
    title: 'Filter tags', hint: 'Tap a tag where you want it to pop',
    mount(body, x) {
      const tags = ['Design', 'Motion', 'iOS', 'Android', 'Web', 'Skia', 'Expo', 'Rust'];
      const wrap = div('tl-tags');
      const fill = () => {
        wrap.replaceChildren(...tags.map((t) => {
          const ctx0 = document.createElement('canvas').getContext('2d');
          ctx0.font = `600 13px ${FONT}`;
          const w = Math.ceil(ctx0.measureText(t).width + 30);
          const el = cv(w, 32, (c, ww, hh) => drawPill(c, ww, hh, t, { fill: isLight() ? '#EEF2FF' : '#232A3A', color: isLight() ? '#2457D6' : '#9DB8FF' }));
          el.addEventListener('click', async (e) => {
            if (el.dataset.busy) return;
            el.dataset.busy = '1';
            const b = rectOf(el);
            hide(el);
            await x.track(play({ ...b, preset: 'snap', origin: { x: e.clientX - b.x, y: e.clientY - b.y }, n: [0.7], duration: 1100 })).done;
            if (!x.alive()) return;
            el.remove();
            if (!wrap.children.length) x.later(fill, 600);
          });
          return el;
        }));
      };
      fill();
      body.append(wrap);
    },
  },
  listScene({
    title: 'Toasts', hint: 'Tap a toast to dismiss it', touch: true, preset: 'snap', opts: { n: [1.2] }, empty: 'Nothing left', h: 50,
    rows: [
      { letter: '✓', color: '#16A34A', title: 'Saved', sub: 'Your changes are live on the site.' },
      { letter: '!', color: '#D97706', title: 'Storage almost full', sub: '9.6 GB of 10 GB used.' },
      { letter: 'i', color: '#2563EB', title: 'New version', sub: 'Version 2.4 is ready to install.' },
    ],
  }));

tile('fling',
  {
    title: 'Swipe to triage', hint: 'Swipe the mail away',
    mount(body, x) {
      const el = cv(Math.min(x.W, 260), 60, (c, w, h) => drawRow(c, w, h, MAIL[2]));
      el.classList.add('grab');
      body.append(div('tl-center'));
      body.firstChild.append(el);
      let busy = false;
      const go = async (velocity) => {
        busy = true;
        hide(el);
        await x.track(play({ ...rectOf(el), preset: 'fling', velocity })).done;
        x.later(() => { show(el); busy = false; }, 500);
      };
      attachFling(el, { canStart: () => !busy, onTap: () => go({ x: 1800, y: -200 }), onFling: go });
    },
  },
  {
    title: 'Match deck', hint: 'Drag the top card left or right',
    mount(body, x) {
      const people = [['temple', 'Lina, 27', 'Architect · 2 km'], ['lake', 'Hugo, 31', 'Chef · 5 km'], ['cypress', 'Sam, 29', 'Photographer · 1 km']];
      const cw = Math.min(200, x.W * 0.45), ch = x.H - 52;
      const deck = div('tl-deck');
      const nope = btn('Pass'), like = btn('Like');
      const foot = div('tl-foot');
      foot.append(nope, like);
      body.append(deck, foot);
      let busy = false;
      const top = () => deck.lastElementChild;
      const fill = () => {
        deck.replaceChildren(...people.map(([n, name, sub]) => {
          const el = cv(cw, ch, (c, w, h) => {
            c.save(); rr(c, 0, 0, w, h, 16); c.clip(); cover(c, IMG[n], 0, 0, w, h);
            const g = c.createLinearGradient(0, h * 0.5, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
            c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
            text(c, name, 12, h - 28, { size: 15, weight: 600, color: '#fff' });
            text(c, sub, 12, h - 11, { size: 11.5, color: 'rgba(255,255,255,0.8)' });
          }, 'grab');
          attachFling(el, { canStart: () => !busy && el === top(), onFling: (v) => go(el, v) });
          return el;
        }));
      };
      const go = async (el, velocity) => {
        busy = true;
        hide(el);
        const h = play({ ...rectOf(el), preset: 'fling', velocity });
        x.later(() => { el.remove(); if (!deck.children.length) x.later(fill, 500); busy = false; }, 250);
        await x.track(h).done;
      };
      nope.addEventListener('click', () => { if (!busy && top()) go(top(), { x: -1600, y: -100 }); });
      like.addEventListener('click', () => { if (!busy && top()) go(top(), { x: 1600, y: -100 }); });
      fill();
    },
  });

function holdButton(x, el, label, holdMs, onDone) {
  const ctrl = holdController(el, () => ({
    holdMs, duration: 900,
    onProgress: (c) => { label.textContent = c > 0.02 && c < 1 ? `Keep holding, ${Math.round(c * 100)}%` : label.dataset.base; },
    onCommit: () => { label.textContent = label.dataset.base; onDone(); },
    onCancel: () => { label.textContent = label.dataset.base; },
  }));
  attachHold(el, ctrl, () => x.alive());
  return ctrl;
}
tile('charge',
  {
    title: 'Delete account', hint: 'Press and hold the button',
    mount(body, x) {
      const hint = x.hint;
      hint.dataset.base = hint.textContent;
      const el = cv(Math.min(x.W, 220), 44, (c, w, h) => drawPill(c, w, h, 'Hold to delete account', { fill: '#DC2626', color: '#fff' }));
      body.append(div('tl-center'));
      body.firstChild.append(el);
      holdButton(x, el, hint, 1200, () => x.later(() => show(el), 900));
    },
  },
  {
    title: 'Projects', hint: 'Hold a project to delete it',
    mount(body, x) {
      const hint = x.hint;
      hint.dataset.base = hint.textContent;
      const rows = [
        { img: 'pines', square: true, title: 'Forest rebrand', sub: '24 files · edited 2 days ago', meta: 'Hold' },
        { img: 'arch', square: true, title: 'Museum app', sub: '112 files · edited today', meta: 'Hold' },
        { img: 'pond', square: true, title: 'Old prototypes', sub: '7 files · edited last year', meta: 'Hold' },
      ];
      const list = div('tl-list');
      const fill = () => list.replaceChildren(...rows.map((r) => {
        const el = cv(x.W, 52, (c, w, h) => drawRow(c, w, h, r));
        const s = slot(el);
        holdButton(x, el, hint, 1000, async () => {
          await collapse(s);
          if (!list.children.length) { list.append(div('tl-empty', 'No projects')); x.later(fill, 1200); }
        });
        return s;
      }));
      fill();
      body.append(list);
    },
  });

function morphPair(body, x, wA, h, drawA, drawB, hint) {
  const a = cv(wA, h, drawA), b = cv(wA, h, drawB, 'demo-card-b');
  b.style.opacity = '0';
  const pair = div('demo-pair tl-morph');
  pair.append(a, b);
  let onB = false, busy = false;
  pair.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const ra = rectOf(a), rb = rectOf(b);
    hide(a); hide(b);
    await x.track(morph(ra, rb, { grain: 2, duration: 900, reverse: onB })).done;
    if (!x.alive()) return;
    show(onB ? a : b, false);
    onB = !onB;
    if (hint) hint(onB);
    busy = false;
  });
  return pair;
}
tile('morph',
  {
    title: 'Follow', hint: 'Tap Follow',
    mount(body, x) {
      const p = pal();
      const row = div('tl-profile');
      const av = cv(44, 44, (c) => avatar(c, 0, 0, 44, 'temple'));
      av.classList.add('tl-static');
      const info = div('tl-info', '<strong>Lina Haddad</strong><span>Architect, Lisbon</span>');
      const pair = morphPair(body, x, 96, 34,
        (c, w, h) => drawPill(c, w, h, 'Follow', { fill: isLight() ? '#12151A' : '#F2F4F7', color: isLight() ? '#fff' : '#12151A' }),
        (c, w, h) => drawPill(c, w, h, 'Following', { fill: p.card, color: p.ink, stroke: p.line }));
      row.append(av, info, pair);
      body.append(div('tl-center'));
      body.firstChild.append(row);
    },
  },
  {
    title: 'Add to cart', hint: 'Tap the button',
    mount(body, x) {
      const p = pal();
      const card = div('tl-product');
      const img = cv(84, 84, (c, w, h) => { c.save(); rr(c, 0, 0, w, h, 12); c.clip(); cover(c, IMG.villa, 0, 0, w, h); c.restore(); }, 'tl-static');
      const info = div('tl-info', '<strong>Linen shirt, sand</strong><span>Relaxed fit · 79 €</span>');
      const pair = morphPair(body, x, 132, 38,
        (c, w, h) => drawPill(c, w, h, 'Add to cart', { fill: p.me, color: '#fff' }),
        (c, w, h) => drawPill(c, w, h, '✓ In cart', { fill: isLight() ? '#DCFCE7' : '#173322', color: isLight() ? '#15803D' : '#86EFAC' }));
      info.append(pair);
      card.append(img, info);
      body.append(div('tl-center'));
      body.firstChild.append(card);
    },
  });

function drawSticker(name, shape) {
  return (c, w, h) => {
    c.save();
    if (shape === 'circle') { c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); }
    else rr(c, 0, 0, w, h, shape === 'pill' ? h / 2 : 14);
    c.fillStyle = '#FFFFFF'; c.fill(); c.clip();
    const inset = 6;
    c.beginPath();
    if (shape === 'circle') c.arc(w / 2, h / 2, Math.min(w, h) / 2 - inset, 0, Math.PI * 2);
    else c.roundRect(inset, inset, w - inset * 2, h - inset * 2, shape === 'pill' ? (h - inset * 2) / 2 : 9);
    c.clip();
    cover(c, IMG[name], 0, 0, w, h);
    c.restore();
  };
}
function peelSticker(x, el) {
  el.classList.add('grab');
  const ctrl = peelController(el, () => ({ onCommit: () => x.later(() => { el.style.transition = ''; el.style.opacity = '1'; }, 700) }));
  attachPeel(el, ctrl);
}
tile('peel',
  {
    title: 'Sticker', hint: 'Grab an edge and pull',
    mount(body, x) {
      const s = Math.min(130, x.H - 30);
      const el = cv(s, s, drawSticker('tuscany', 'circle'));
      body.append(div('tl-center'));
      body.firstChild.append(el);
      peelSticker(x, el);
    },
  },
  {
    title: 'Laptop lid', hint: 'Peel the stickers off by hand',
    mount(body, x) {
      const lid = div('tl-lid');
      const st = [['arch', 'round', 96, 96, 18, 22], ['lake', 'pill', 140, 52, 140, 40], ['pines', 'circle', 84, 84, 310, 60]];
      body.append(lid);
      const sc = Math.min(1, (x.W - 20) / 420);
      st.forEach(([n, shape, w, h, l, t]) => {
        const el = cv(w * sc, h * sc, drawSticker(n, shape));
        el.style.left = l * sc + 16 + 'px'; el.style.top = t * sc + 'px';
        lid.append(el);
        peelSticker(x, el);
      });
    },
  });

function drawIceCream(c, w, h) {
  const cx = w / 2;
  c.save();
  c.fillStyle = '#D9A066';
  c.beginPath(); c.moveTo(cx - 30, h * 0.48); c.lineTo(cx + 30, h * 0.48); c.lineTo(cx, h - 4); c.closePath(); c.fill(); c.clip();
  c.strokeStyle = 'rgba(120,70,30,0.45)'; c.lineWidth = 1.2;
  for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(cx + i * 9, h * 0.48); c.lineTo(cx + i * 9 + 40, h); c.stroke(); c.beginPath(); c.moveTo(cx + i * 9, h * 0.48); c.lineTo(cx + i * 9 - 40, h); c.stroke(); }
  c.restore();
  const scoop = (x0, y0, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x0, y0, r, 0, Math.PI * 2); c.fill(); };
  scoop(cx - 15, h * 0.44, 22, '#F9A8D4');
  scoop(cx + 15, h * 0.44, 22, '#A7F3D0');
  scoop(cx, h * 0.3, 24, '#FDE68A');
  scoop(cx + 4, h * 0.13, 6, '#DC2626');
}
function drawCandle(col) {
  return (c, w, h) => {
    const bw = w * 0.56, bx = (w - bw) / 2, top = h * 0.32;
    const g = c.createRadialGradient(w / 2, h * 0.16, 1, w / 2, h * 0.16, 18);
    g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.5, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h * 0.16, 9, 18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3F3F46'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, h * 0.24); c.lineTo(w / 2, top + 2); c.stroke();
    c.fillStyle = col; rr(c, bx, top, bw, h - top, [10, 10, 4, 4]); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(bx + 6, top + 8, 5, h - top - 16);
  };
}
tile('melt',
  oneScene({ title: 'Ice cream', hint: 'Tap the ice cream', w: 120, h: 160, draw: drawIceCream, preset: 'melt', opts: { duration: 2000 }, back: 900 }),
  {
    title: 'Candles', hint: 'Tap a candle to melt it',
    mount(body, x) {
      const row = div('tl-row');
      ['#F5E6D3', '#FBCFE8', '#BFDBFE'].forEach((col) => {
        const el = cv(70, Math.min(170, x.H - 10), drawCandle(col));
        el.addEventListener('click', async () => {
          if (el.dataset.busy) return;
          el.dataset.busy = '1';
          hide(el);
          await x.track(play({ ...rectOf(el), preset: 'melt', duration: 2200 })).done;
          x.later(() => { show(el); delete el.dataset.busy; }, 800);
        });
        row.append(el);
      });
      body.append(row);
    },
  });

/* -------- mount -------- */

export function tilesHTML(id) {
  const [a, b] = TILES[id];
  const t = (s, i) => `<div class="tile${i ? ' tile-wide' : ''}" data-tile="${i}">
    <div class="tile-head"><span class="tile-title">${s.title}</span><button class="icon-btn tile-reset" aria-label="Reset ${s.title}"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5v3h3"/></svg></button></div>
    <div class="tile-body"></div>
    <p class="tile-hint">${s.hint}</p>
  </div>`;
  return `<div class="tiles">${t(a, 0)}${t(b, 1)}</div>`;
}

/** Mounts both scenes of the variant page. Returns a dispose function. */
export function mountTiles(root, id) {
  const disposers = [];
  root.querySelectorAll('[data-tile]').forEach((el) => {
    const scene = TILES[id][+el.dataset.tile];
    const body = el.querySelector('.tile-body');
    let x = null;
    const mount = () => {
      x?.dispose();
      body.replaceChildren();
      body.className = 'tile-body';
      const timers = new Set(), handles = new Set(), extra = [];
      let alive = true;
      x = {
        W: body.clientWidth, H: body.clientHeight,
        hint: el.querySelector('.tile-hint'),
        alive: () => alive,
        track: (h) => { handles.add(h); h.done.then(() => handles.delete(h)); return h; },
        later: (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); },
        onDispose: (fn) => extra.push(fn),
        dispose: () => { alive = false; timers.forEach(clearTimeout); handles.forEach((h) => h.cancel()); extra.forEach((f) => f()); },
      };
      scene.mount(body, x);
    };
    el.querySelector('.tile-reset').addEventListener('click', mount);
    mount();
    disposers.push(() => x?.dispose());
  });
  return () => disposers.forEach((f) => f());
}
