// Interactive demo card for one variant, used by the variant stage and the gallery tiles.
import { play, snapshot, PORTED, Heap, morph } from './engine/atlas.js';

import { IMG, FONT, cover } from './images.js';

const ENTRANCES = ['gather', 'rain', 'print'];

/** Short action label shown in the gallery tile footer and on the stage. */
export const HINTS = {
  dust: 'Tap', sand: 'Tap', ember: 'Tap', pixel: 'Tap', vortex: 'Tap',
  snap: 'Tap anywhere', fling: 'Swipe', stream: 'Tap', gather: 'Tap to replay', rain: 'Tap to replay',
  print: 'Tap to replay', charge: 'Press and hold', peel: 'Drag any edge', melt: 'Tap', shatter: 'Web soon', pile: 'Tap, it piles up', morph: 'Tap to morph',
};

// Realistic notifications, one per variant: [app, title, body, painting]
const COPY = {
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
  pile: ['Mail', 'Promo', 'Last chance, 40% off everything.', 'tuscany'],
  morph: ['Updates', 'Downloading', 'Version 2.4, 68 MB left.', 'lake'],
  peel: ['Stickers', 'New sticker pack', 'Twelve paintings to stick anywhere.', 'arch'],
  melt: ['Weather', 'Heat wave', '38° this afternoon, stay in the shade.', 'tuscany'],
  morphB: ['Updates', 'Ready to install', 'Restart to finish the update.', 'pines'],
};

function theme() {
  return document.documentElement.dataset.theme === 'light'
    ? { bg: '#FFFFFF', line: 'rgba(0,0,0,0.07)', meta: '#8E959F', title: '#12151A', body: '#5A616B' }
    : { bg: '#1F2125', line: 'rgba(255,255,255,0.06)', meta: '#858B94', title: '#F2F4F7', body: '#A9AFB8' };
}

function drawCard(ctx, w, h, id) {
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

const binSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 5.5l-.62 10.03c-.16 2.56-.24 3.84-.88 4.76a4 4 0 0 1-1.2 1.13C15.84 22 14.56 22 12 22c-2.57 0-3.86 0-4.82-.59a4 4 0 0 1-1.2-1.13c-.64-.92-.72-2.2-.87-4.77L4.5 5.5"/><path d="M3 5.5h18M16.06 5.5l-.69-1.41c-.45-.94-.68-1.4-1.07-1.7a2 2 0 0 0-.27-.17C13.59 2 13.07 2 12.03 2c-1.06 0-1.6 0-2.04.23a2 2 0 0 0-.28.18c-.4.3-.62.79-1.06 1.76L8.05 5.5M9.5 16.5v-6M14.5 16.5v-6"/></svg><span class="bin-count" hidden>0</span>';

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
  if (!PORTED.includes(id)) {
    card.classList.add('demo-static');
    return { run() {} };
  }

  let busy = false;
  if (id === 'pile') return mountPile(host, card);
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
    let start = null, last = null;
    card.addEventListener('pointerdown', (e) => {
      if (busy) return;
      try { card.setPointerCapture(e.pointerId); } catch {}
      start = { x: e.clientX, y: e.clientY };
      last = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', (e) => {
      if (!start) return;
      const now = performance.now(), dt = Math.max(1, now - last.t);
      last = { x: e.clientX, y: e.clientY, t: now, vx: ((e.clientX - last.x) / dt) * 1000, vy: ((e.clientY - last.y) / dt) * 1000 };
      card.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px) rotate(${(e.clientX - start.x) * 0.04}deg)`;
    });
    card.addEventListener('pointerup', (e) => {
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      start = null;
      if (moved < 8) { card.style.transform = ''; run(); return; }
      const sp = Math.hypot(last.vx, last.vy);
      if (sp < 300) { card.style.transition = ''; card.style.transform = ''; return; }
      run({ velocity: { x: last.vx, y: last.vy } });
    });
  } else if (id === 'charge') {
    let h = null, t0 = 0;
    const tick = (now) => {
      if (!h) return;
      h.aux.a0 = Math.min(1, (now - t0) / 1000);
      h.aux.a1 = now - t0;
      requestAnimationFrame(tick);
    };
    card.addEventListener('pointerdown', (e) => {
      if (busy) return;
      e.preventDefault();
      busy = true;
      const base = { ...rectOf(), preset: 'charge', hold: true };
      hide();
      h = play(base);
      t0 = performance.now();
      requestAnimationFrame(tick);
    });
    const up = () => {
      if (!h) return;
      const cur = h; h = null;
      if (cur.aux.a0 >= 1) { cur.release(); cur.done.then(() => finish(400)); }
      else { cur.cancel(); show(false); busy = false; }
    };
    card.addEventListener('pointerup', up);
    card.addEventListener('pointerleave', up);
  } else if (id === 'snap') {
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

/* ---------- pile: the card pours down and heaps on the stage floor; sweep after a few ---------- */
function mountPile(host, card) {
  const heap = new Heap(host, 120);
  let busy = false, piles = 0;
  const run = async () => {
    if (busy) return;
    busy = true;
    const r = card.getBoundingClientRect();
    card.style.transition = 'none'; card.style.opacity = '0';
    await play({ source: card, x: r.left, y: r.top, w: r.width, h: r.height, preset: 'pile', heap }).done;
    piles += 1;
    setTimeout(async () => {
      card.style.transition = ''; card.style.opacity = '1';
      if (piles >= 3) { piles = 0; await new Promise((res) => setTimeout(res, 500)); await heap.sweep('dust'); }
      busy = false;
    }, 500);
  };
  card.addEventListener('click', run);
  host.querySelector('[data-replay]')?.addEventListener('click', run);
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
  let h = null, x0 = 0, y0 = 0, w = 0, ht = 0, ax = 0, ay = 0, busy = false;
  const tween = (from, to, ms, ease, onStep) => new Promise((res) => {
    const t0 = performance.now();
    const f = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      onStep(from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  card.addEventListener('pointerdown', (e) => {
    if (busy) return;
    busy = true;
    try { card.setPointerCapture(e.pointerId); } catch {}
    const r = card.getBoundingClientRect();
    w = r.width; ht = r.height; x0 = e.clientX; y0 = e.clientY;
    // Anchor: nearest corner when grabbed close to one, else the nearest point of the closest edge.
    const sx = x0 - r.left, sy = y0 - r.top, dl = sx, dr = w - sx, dt = sy, db = ht - sy;
    if (Math.min(dl, dr) < w * 0.28 && Math.min(dt, db) < ht * 0.28) { ax = dl < dr ? 0 : w; ay = dt < db ? 0 : ht; }
    else {
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { ax = 0; ay = sy; } else if (m === dr) { ax = w; ay = sy; } else if (m === dt) { ax = sx; ay = 0; } else { ax = sx; ay = ht; }
    }
    h = play({ source: card, x: r.left, y: r.top, w, h: ht, preset: 'peel', n: [1, ax, ay], hold: true, duration: 700 });
    h.aux.a0 = ax; h.aux.a1 = ay;
    card.style.transition = 'none'; card.style.opacity = '0';
  });
  card.addEventListener('pointermove', (e) => {
    if (!h) return;
    h.aux.a0 = ax + e.clientX - x0;
    h.aux.a1 = ay + e.clientY - y0;
  });
  const up = async () => {
    if (!h) return;
    const cur = h; h = null;
    const dx = cur.aux.a0 - ax, dy = cur.aux.a1 - ay, dist = Math.hypot(dx, dy), diag = Math.hypot(w, ht);
    if (dist / diag >= 0.4) {
      const ux = dx / dist, uy = dy / dist, sx = cur.aux.a0, sy = cur.aux.a1;
      cur.release();
      await tween(0, 1, 700, (k) => k * k, (k) => { cur.aux.a0 = sx + ux * diag * 2.4 * k; cur.aux.a1 = sy + uy * diag * 2.4 * k; });
      await cur.done;
      setTimeout(() => { card.style.transition = ''; card.style.opacity = '1'; busy = false; }, 500);
    } else {
      const sx = cur.aux.a0, sy = cur.aux.a1;
      await tween(0, 1, 320, (k) => 1 - (1 - k) ** 3, (k) => { cur.aux.a0 = sx + (ax - sx) * k; cur.aux.a1 = sy + (ay - sy) * k; });
      cur.cancel();
      card.style.transition = 'none'; card.style.opacity = '1';
      busy = false;
    }
  };
  card.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', up);
  return { run() {} };
}
