// Web version of the mobile Gallery screen (app/gallery.tsx): every effect on real content.
// Each dissolvable item is drawn into a canvas, so the snapshot handed to the engine is exact.
import { play, snapshot, Heap, morph } from './engine/atlas.js';

import { IMG, ready, FONT, cover } from './images.js';

const PAINTINGS = ['temple', 'lake', 'pines', 'arch', 'valley', 'pond', 'cypress', 'tuscany', 'aqueduct'];
const IN_PRESETS = ['gather', 'rain', 'print'];

/* ---------- drawing helpers ---------- */

export const isLight = () => document.documentElement.dataset.theme === 'light';
export const pal = () => isLight()
  ? { card: '#FFFFFF', ink: '#12151A', text: '#535A64', muted: '#8E959F', line: 'rgba(0,0,0,0.08)', them: '#EEF0F3', me: '#2F63E0', meText: '#FFFFFF' }
  : { card: '#1E2024', ink: '#F2F4F7', text: '#A9AFB8', muted: '#858B94', line: 'rgba(255,255,255,0.07)', them: '#26292E', me: '#3A6FE6', meText: '#FFFFFF' };

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

function tag(ctx, name, xr, y, dark) {
  ctx.font = `500 10.5px 'Geist Mono', monospace`;
  const w = ctx.measureText(name).width + 16;
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)';
  rr(ctx, xr - w, y, w, 20, 10); ctx.fill();
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : '#2A3038';
  ctx.fillText(name, xr - w + 8, y + 14);
}

const ICONS = {
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4',
  trophy: 'M8 4h8v4a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 12v4M9 20h6M10 16h4v4h-4z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  unlock: 'M5 11h14v9H5zM8 11V7a4 4 0 0 1 7.5-2',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
};

function icon(ctx, name, x, y, size = 28) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(ICONS[name]));
  ctx.restore();
}

/* ---------- item lifecycle ---------- */

/** A canvas element of w x h css px drawn by fn. */
export function item(w, h, fn, cls = '') {
  const c = snapshot(w, h, (ctx) => fn(ctx, w, h));
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  c.className = 'sc-item ' + cls;
  return c;
}

export const rectOf = (el) => { const r = el.getBoundingClientRect(); return { source: el, x: r.left, y: r.top, w: r.width, h: r.height }; };
export const hide = (el) => { el.style.transition = 'none'; el.style.opacity = '0'; };
export const show = (el, fade = true) => { el.style.transition = fade ? '' : 'none'; el.style.opacity = '1'; };

/** Tap to dissolve, then fade back so the demo replays (Dissolvable in the mobile app). */
export function dissolvable(el, preset, { duration = 1500, touch = false, target, onArrive, back = 0.8 } = {}) {
  el.dataset.preset = preset;
  el.addEventListener('click', async (e) => {
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    const r = rectOf(el);
    const opts = { ...r, preset, duration };
    if (touch) opts.origin = { x: e.clientX - r.x, y: e.clientY - r.y };
    if (target) { const t = target().getBoundingClientRect(); opts.target = { x: t.left, y: t.top, width: t.width, height: t.height }; }
    hide(el);
    if (onArrive) setTimeout(onArrive, duration * 0.72);
    await play(opts).done;
    setTimeout(() => { show(el); delete el.dataset.busy; }, duration * back);
  });
}

/** Plays an entrance on an element already in the layout. */
export async function appear(el, preset, extra = {}) {
  hide(el);
  await new Promise(requestAnimationFrame);
  await play({ ...rectOf(el), preset, direction: 'in', ...extra }).done;
  show(el, false);
}

/* ---------- 01 Bento ---------- */

const BENTO = [
  { img: 'aqueduct', icon: 'shield', title: 'Full rights', body: 'The design, the copy and every file are yours.', preset: 'snap', touch: true },
  { img: 'lake', icon: 'trophy', title: 'On time or refunded', body: 'Miss the date and you get your money back.', preset: 'vortex' },
  { img: 'pines', icon: 'undo', title: 'Full refund', body: 'Change your mind before delivery.', preset: 'sand' },
  { img: 'tuscany', icon: 'unlock', title: 'Source files', body: 'The Figma file, or the pull request.', preset: 'dust' },
  { img: 'valley', icon: 'sparkles', title: 'One studio, every screen', body: 'Brand, product and code, shipped by the same hands.', preset: 'ember', wide: true },
];

function drawBento(ctx, w, h, b) {
  ctx.save();
  rr(ctx, 0, 0, w, h, 22); ctx.clip();
  cover(ctx, IMG[b.img], 0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.3, 'rgba(28,28,28,0)'); g.addColorStop(0.64, 'rgba(28,28,28,0.9)'); g.addColorStop(1, '#1C1C1C');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  icon(ctx, b.icon, 18, 18);
  tag(ctx, b.preset, w - 16, 18, true);
  ctx.font = `400 13.5px ${FONT}`;
  const lines = wrap(ctx, b.body, w - 36);
  const by = h - 20 - (lines.length - 1) * 19;
  let ts = 18;
  ctx.font = `600 ${ts}px ${FONT}`;
  while (ts > 13 && ctx.measureText(b.title).width > w - 36) ctx.font = `600 ${--ts}px ${FONT}`;
  text(ctx, b.title, 18, by - 24, { size: ts, weight: 600, color: '#fff' });
  lines.forEach((l, i) => text(ctx, l, 18, by + i * 19, { size: 13.5, color: 'rgba(255,255,255,0.72)' }));
}

function mountBento(root) {
  root.querySelectorAll('[data-bento]').forEach((slot) => {
    const b = BENTO[+slot.dataset.bento];
    const el = item(slot.clientWidth, slot.clientHeight, (ctx, w, h) => drawBento(ctx, w, h, b));
    slot.replaceChildren(el);
    dissolvable(el, b.preset, { touch: b.touch });
  });
}

/* ---------- 02 Inbox ---------- */

const MAILS = [
  { tag: 'NEW MESSAGE', dot: '#E4572E', title: 'Léa wrote to you.', body: 'A message from the studio about Fieldbook landing. The whole thread is in your space.', img: 'pond', preset: 'stream' },
  { tag: 'PAID', dot: '#34C759', title: 'Your order is paid.', body: 'We received 1 240 €. The brief is locked, kickoff is on Monday.', img: 'tuscany', preset: 'pixel' },
  { tag: 'IN REVIEW', dot: '#3D7BFF', title: 'Ready for review.', body: 'Three screens and the hero are in. Leave comments right on the frames.', img: 'lake', preset: 'vortex' },
  { tag: 'DELIVERED', dot: '#7C8CA8', title: 'It is yours.', body: 'The Figma file and the pull request are attached. Thank you for trusting us.', img: 'valley', preset: 'sand' },
];

function drawMail(ctx, w, h, m) {
  const c = pal();
  ctx.save();
  rr(ctx, 0, 0, w, h, 22); ctx.clip();
  cover(ctx, IMG[m.img], 0, 0, w, h);
  ctx.restore();
  const px = 12, pw = w - 24, ph = h - 70, py = h - ph - 12;
  ctx.fillStyle = c.card;
  rr(ctx, px, py, pw, ph, 16); ctx.fill();
  ctx.fillStyle = m.dot;
  ctx.beginPath(); ctx.arc(px + 20, py + 23, 4, 0, Math.PI * 2); ctx.fill();
  text(ctx, m.tag, px + 31, py + 27, { size: 10.5, weight: 600, color: c.muted });
  tag(ctx, m.preset === 'stream' ? 'stream to bin' : m.preset, px + pw - 12, py + 12, isLight() ? false : true);
  text(ctx, m.title, px + 16, py + 58, { size: 17, weight: 600, color: c.ink });
  ctx.font = `400 13px ${FONT}`;
  wrap(ctx, m.body, pw - 32).slice(0, 3).forEach((l, i) => text(ctx, l, px + 16, py + 80 + i * 18, { size: 13, color: c.text }));
  ctx.fillStyle = isLight() ? '#12151A' : '#F2F4F7';
  rr(ctx, px + 16, py + ph - 46, 84, 32, 16); ctx.fill();
  text(ctx, 'Archive', px + 58, py + ph - 25, { size: 13, weight: 600, color: isLight() ? '#fff' : '#12151A', align: 'center' });
}

function mountInbox(root) {
  const bin = root.querySelector('#sc-bin');
  const badge = root.querySelector('#sc-bin-count');
  let count = 0;
  const arrive = () => {
    count += 1;
    badge.textContent = count;
    badge.hidden = false;
    bin.classList.remove('bump'); void bin.offsetWidth; bin.classList.add('bump');
  };
  const row = root.querySelector('#sc-mails');
  const w = Math.min(320, row.clientWidth * 0.86), h = 260;
  row.replaceChildren(...MAILS.map((m) => {
    const el = item(w, h, (ctx, W, H) => drawMail(ctx, W, H, m));
    const streaming = m.preset === 'stream';
    dissolvable(el, m.preset, { duration: 1400, target: streaming ? () => bin : undefined, onArrive: streaming ? arrive : undefined });
    return el;
  }));
}

/* ---------- 03 Thread ---------- */

function bubble(me, txt, maxW, name) {
  const c = pal();
  const ctx0 = document.createElement('canvas').getContext('2d');
  ctx0.font = `400 14.5px ${FONT}`;
  const lines = wrap(ctx0, txt, maxW - 28);
  const tw = Math.max(...lines.map((l) => ctx0.measureText(l).width), name ? 60 : 0);
  const w = Math.ceil(tw + 28), h = 18 + lines.length * 20 + (name ? 17 : 0);
  return item(w, h, (ctx) => {
    ctx.fillStyle = me ? c.me : c.them;
    rr(ctx, 0, 0, w, h, 18); ctx.fill();
    let y = 14;
    if (name) { text(ctx, name, 14, y + 9, { size: 11.5, weight: 600, color: c.muted }); y += 17; }
    lines.forEach((l, i) => text(ctx, l, 14, y + 11 + i * 20, { size: 14.5, color: me ? c.meText : c.ink }));
  });
}

function album(w) {
  const iw = (w - 6) / 2, h = iw * 1.25;
  return item(w, h, (ctx) => {
    ['temple', 'arch'].forEach((n, i) => {
      ctx.save(); rr(ctx, i * (iw + 6), 0, iw, h, 16); ctx.clip();
      cover(ctx, IMG[n], i * (iw + 6), 0, iw, h); ctx.restore();
    });
  });
}

function photoMsg(w) {
  const c = pal(), ih = w * 0.7, h = ih + 58;
  return item(w, h, (ctx) => {
    ctx.fillStyle = c.me; rr(ctx, 0, 0, w, h, 18); ctx.fill();
    ctx.save(); rr(ctx, 4, 4, w - 8, ih, 15); ctx.clip(); cover(ctx, IMG.cypress, 4, 4, w - 8, ih); ctx.restore();
    text(ctx, 'And this one for the about page', 14, ih + 26, { size: 14, color: c.meText });
    text(ctx, '20:14 · Read', w - 12, ih + 46, { size: 11, color: 'rgba(255,255,255,0.65)', align: 'right' });
  });
}

const REPLIES = ['Love it, ship it', 'Can you send the Figma link?', 'Perfect, talk tomorrow', 'The light is so good'];
const MINE = ['Sending the export now', 'Keeping the warm light', 'On it', 'Here is v2'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function mountThread(root) {
  // A real chat: fixed height, anchored to the bottom, old messages scroll out of view.
  const box = root.querySelector('#sc-thread');
  const list = document.createElement('div');
  list.className = 'sc-thread-inner';
  box.replaceChildren(list);
  const send = root.querySelector('#sc-send');
  const maxW = Math.min(300, box.clientWidth * 0.78);

  const row = (el, me) => { const r = document.createElement('div'); r.className = 'sc-row' + (me ? ' me' : ''); r.append(el); return r; };
  // Tap to unsend: the bubble dissolves, then its row closes and the thread settles.
  const unsendable = (el, preset, touch = false) => el.addEventListener('click', async (e) => {
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    const r = rectOf(el);
    const opts = { ...r, preset, duration: 1100 };
    if (touch) opts.origin = { x: e.clientX - r.x, y: e.clientY - r.y };
    hide(el);
    await play(opts).done;
    const rw = el.parentElement;
    rw.style.height = rw.offsetHeight + 'px';
    requestAnimationFrame(() => rw.classList.add('gone'));
    setTimeout(() => rw.remove(), 320);
  });
  const trim = () => { while (list.offsetHeight > box.clientHeight * 1.6 && list.children.length > 2) list.firstElementChild.remove(); };
  // New row: make room with a short slide, then let the grains arrive.
  const add = async (el, me) => {
    hide(el);
    const r = row(el, me);
    list.append(r);
    const h = r.offsetHeight + 6;
    list.style.transition = 'none';
    list.style.transform = `translateY(${h}px)`;
    void list.offsetHeight;
    list.style.transition = 'transform .28s cubic-bezier(0.22, 1, 0.36, 1)';
    list.style.transform = '';
    await wait(300);
    trim();
  };

  const seed = [
    [bubble(false, 'Found two refs for the hero, which one?', maxW, 'Maya'), false, 'vortex'],
    [album(Math.min(240, maxW)), false, 'pixel'],
    [bubble(true, 'The temple, no question. Keep the warm light.', maxW), true, 'ember'],
    [photoMsg(Math.min(230, maxW)), true, 'snap'],
  ];
  list.replaceChildren(...seed.map(([el, me, p]) => { unsendable(el, p, p === 'snap'); return row(el, me); }));

  let n = 0, busy = false;
  send.onclick = async () => {
    if (busy) return;
    busy = true;
    send.classList.add('busy');
    const i = n++;
    const mine = bubble(true, MINE[i % MINE.length], maxW);
    unsendable(mine, 'dust');
    await add(mine, true);
    const s = send.getBoundingClientRect();
    await appear(mine, 'stream', { duration: 900, target: { x: s.left, y: s.top, width: s.width, height: s.height } });
    await wait(450);
    const p = IN_PRESETS[i % IN_PRESETS.length];
    const reply = bubble(false, REPLIES[i % REPLIES.length], maxW, `Maya · ${p}`);
    unsendable(reply, 'vortex');
    await add(reply, false);
    await appear(reply, p, { duration: p === 'print' ? 1000 : 1100 });
    busy = false;
    send.classList.remove('busy');
  };
}

/* ---------- 04 Arrivals ---------- */

function arrivalRow(w, img, preset) {
  const c = pal();
  return item(w, 68, (ctx) => {
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 68, 16); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 67, 15.5); ctx.stroke();
    ctx.save(); rr(ctx, 10, 10, 48, 48, 11); ctx.clip(); cover(ctx, IMG[img], 10, 10, 48, 48); ctx.restore();
    text(ctx, 'New painting added', 72, 31, { size: 14.5, weight: 600, color: c.ink });
    text(ctx, `entered with ${preset}`, 72, 50, { size: 12.5, color: c.text, mono: true });
  });
}

function mountArrivals(root) {
  const list = root.querySelector('#sc-arrivals');
  let preset = 'gather', n = 0;
  root.querySelectorAll('[data-arrive]').forEach((b) => b.addEventListener('click', () => {
    preset = b.dataset.arrive;
    root.querySelectorAll('[data-arrive]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  root.querySelector('#sc-add').onclick = () => {
    list.querySelector('.sc-empty')?.remove();
    const el = arrivalRow(list.clientWidth, PAINTINGS[n++ % PAINTINGS.length], preset);
    list.prepend(el);
    while (list.children.length > 4) list.lastElementChild.remove();
    appear(el, preset, { duration: preset === 'print' ? 1500 : 1900, grain: 2.5 });
  };
}

/* ---------- 05 Gestures ---------- */

function gCard(w, img, title, sub) {
  const c = pal();
  return item(w, 76, (ctx) => {
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 76, 18); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 75, 17.5); ctx.stroke();
    ctx.save(); rr(ctx, 12, 12, 52, 52, 12); ctx.clip(); cover(ctx, IMG[img], 12, 12, 52, 52); ctx.restore();
    text(ctx, title, 78, 34, { size: 15, weight: 600, color: c.ink });
    text(ctx, sub, 78, 54, { size: 12.5, color: c.text, mono: true });
  });
}

function respawn(el, ms = 1500) { setTimeout(() => { show(el); delete el.dataset.busy; }, ms); }

function mountGestures(root) {
  const slotS = root.querySelector('#sc-scrub'), slotH = root.querySelector('#sc-hold');
  const w = slotS.clientWidth;

  // Scrub: dust driven by the finger, reversible until you let go past half.
  const sc = gCard(w, 'lake', 'Drag me sideways', 'scrub · go back and the grains return');
  sc.classList.add('grab');
  slotS.replaceChildren(sc);
  let h = null, x0 = 0, p = 0;
  sc.addEventListener('pointerdown', (e) => {
    if (sc.dataset.busy) return;
    sc.dataset.busy = '1';
    try { sc.setPointerCapture(e.pointerId); } catch {}
    x0 = e.clientX; p = 0;
    h = play({ ...rectOf(sc), preset: 'dust', hold: true, duration: 1300 });
    hide(sc);
  });
  sc.addEventListener('pointermove', (e) => {
    if (!h) return;
    p = Math.max(0, Math.min(1, (e.clientX - x0) / (w * 0.85)));
    h.set(p * h.end);
  });
  sc.addEventListener('pointerup', () => {
    if (!h) return;
    const cur = h; h = null;
    if (p > 0.45) { cur.release(); cur.done.then(() => respawn(sc)); return; }
    const from = p, t0 = performance.now();
    const back = (now) => {
      const k = Math.min(1, (now - t0) / 260);
      cur.set(from * (1 - k * (2 - k)) * cur.end);
      if (k < 1) requestAnimationFrame(back); else { cur.cancel(); show(sc, false); delete sc.dataset.busy; }
    };
    requestAnimationFrame(back);
  });

  // Hold: charge heats the card, bursts at full charge, let go early to cancel.
  const hc = gCard(w, 'aqueduct', 'Delete this project', 'charge · hold to confirm, let go to cancel');
  slotH.replaceChildren(hc);
  let hh = null, t0 = 0;
  const tick = (now) => {
    if (!hh) return;
    const c = Math.min(1, (now - t0) / 1200);
    hh.aux.a0 = c; hh.aux.a1 = now - t0;
    if (c >= 1) { const cur = hh; hh = null; cur.release(); cur.done.then(() => respawn(hc)); return; }
    requestAnimationFrame(tick);
  };
  hc.addEventListener('pointerdown', (e) => {
    if (hc.dataset.busy) return;
    e.preventDefault();
    hc.dataset.busy = '1';
    hh = play({ ...rectOf(hc), preset: 'charge', hold: true });
    hide(hc);
    t0 = performance.now();
    requestAnimationFrame(tick);
  });
  const cancel = () => {
    if (!hh) return;
    hh.cancel(); hh = null;
    show(hc, false); delete hc.dataset.busy;
  };
  hc.addEventListener('pointerup', cancel);
  hc.addEventListener('pointerleave', cancel);
}

/* ---------- 06 Cascade ---------- */

const NOTES = [
  { app: 'Messages', text: 'Léa: the direction is up', img: 'pond' },
  { app: 'Calendar', text: 'Design review in 10 minutes', img: 'lake' },
  { app: 'Hannera', text: 'Your order is paid', img: 'tuscany' },
  { app: 'Photos', text: 'Lisbon, 3 years ago', img: 'valley' },
];

function mountCascade(root) {
  const list = root.querySelector('#sc-notes');
  const w = list.clientWidth, c = pal();
  const rows = NOTES.map((n) => item(w, 58, (ctx) => {
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 58, 16); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 57, 15.5); ctx.stroke();
    ctx.save(); rr(ctx, 10, 10, 38, 38, 10); ctx.clip(); cover(ctx, IMG[n.img], 10, 10, 38, 38); ctx.restore();
    text(ctx, n.app.toUpperCase(), 60, 25, { size: 10.5, weight: 600, color: c.muted });
    text(ctx, n.text, 60, 43, { size: 14, color: c.ink });
  }));
  list.replaceChildren(...rows);
  let busy = false;
  root.querySelector('#sc-clear').onclick = async () => {
    if (busy) return;
    busy = true;
    // Rows leave in a diagonal wave: each one starts a beat after the one above.
    await Promise.all(rows.map((el, i) => new Promise((res) => setTimeout(async () => {
      const r = rectOf(el);
      hide(el);
      await play({ ...r, preset: 'dust', duration: 1400 }).done;
      res();
    }, i * 110))));
    setTimeout(() => { rows.forEach((el) => show(el)); busy = false; }, 1200);
  };
}

/* ---------- 07 Morph ---------- */

function pill(label, filled) {
  const c = pal();
  const ctx0 = document.createElement('canvas').getContext('2d');
  ctx0.font = `600 14px ${FONT}`;
  const w = Math.ceil(ctx0.measureText(label).width + 36), h = 38;
  return item(w, h, (ctx) => {
    if (filled) { ctx.fillStyle = isLight() ? '#12151A' : '#F2F4F7'; rr(ctx, 0, 0, w, h, 19); ctx.fill(); }
    else { ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; rr(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 18.25); ctx.stroke(); }
    text(ctx, label, w / 2, 24, { size: 14, weight: 600, color: filled ? (isLight() ? '#fff' : '#12151A') : c.ink, align: 'center' });
  }, 'sc-pill');
}

function mountMorph(root) {
  const host = root.querySelector('#sc-morph');
  const c = pal();
  const avatar = item(52, 52, (ctx) => { ctx.save(); rr(ctx, 0, 0, 52, 52, 26); ctx.clip(); cover(ctx, IMG.pond, 0, 0, 52, 52); ctx.restore(); }, 'sc-static');
  const info = document.createElement('div');
  info.className = 'sc-profile-info';
  info.innerHTML = '<strong>Hannera studio</strong><span>morph · tap the button</span>';
  const a = pill('Follow', true), b = pill('Following', false);
  const slot = document.createElement('div');
  slot.className = 'sc-pill-slot';
  b.style.opacity = '0';
  slot.append(a, b);
  host.replaceChildren(avatar, info, slot);
  let onB = false, busy = false;
  slot.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const ra = rectOf(a), rb = rectOf(b);
    hide(a); hide(b);
    await morph(ra, rb, { grain: 2, duration: 1100, reverse: onB }).done;
    show(onB ? a : b, false);
    onB = !onB;
    busy = false;
  });
}

/* ---------- 08 Pile ---------- */

const TODOS = ['Send the invoice to Léa', 'Export the hero in 2x', 'Book the studio for Friday', 'Reply to the Hannera brief'];

function todoRow(w, label) {
  const c = pal();
  return item(w, 44, (ctx) => {
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 44, 12); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 43, 11.5); ctx.stroke();
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(22, 22, 8, 0, Math.PI * 2); ctx.stroke();
    text(ctx, label, 42, 27, { size: 14, color: c.ink });
  });
}

function mountPile(root) {
  const list = root.querySelector('#sc-todos');
  const floor = root.querySelector('#sc-floor');
  const heap = new Heap(floor, 90);
  const w = list.clientWidth;
  const rows = TODOS.map((t) => todoRow(w, t));
  list.replaceChildren(...rows);
  rows.forEach((el) => el.addEventListener('click', async () => {
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    const r = rectOf(el);
    hide(el);
    await play({ ...r, preset: 'pile', heap }).done;
  }));
  root.querySelector('#sc-sweep').onclick = async () => {
    await heap.sweep('dust');
    rows.forEach((el) => { if (el.dataset.busy) { show(el); delete el.dataset.busy; } });
  };
}

/* ---------- page ---------- */

const head = (i, title, note, right = '') => `
  <header class="sc-head">
    <div><p class="sc-index">${i}</p><h2>${title}</h2><p class="sc-note">${note}</p></div>${right}
  </header>`;

export function showcaseHTML() {
  return `


  <header class="sc-hero2">
    <h1>dissolve</h1>
    <p>Animation library built for React Native</p>
  </header>
  <div class="sc-start">
    <div class="cmd sc-cmd"><span class="sc-cmd-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="#D97757" aria-label="Claude"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg></span><code>curl -fsSL dissolve.rselmi.com/mcp.sh | sh</code><button class="icon-btn" aria-label="Copy command" data-copy><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg></button></div>
    <div class="cmd sc-cmd"><span class="sc-cmd-icon"><svg width="18" height="18" viewBox="0 0 24 24" aria-label="npm"><rect width="24" height="24" rx="4" fill="#CB3837"/><path d="M5 7h14v10h-7v-8.2h-2.6V17H5z" fill="#fff"/></svg></span><code>npm install react-native-dissolve</code><button class="icon-btn" aria-label="Copy command" data-copy><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg></button></div>
  </div>
  ${head('01', 'Bento', 'Tap a card. snap starts where your cursor lands.')}
  <div class="sc-bento">
    ${BENTO.map((b, i) => `<div class="sc-slot${b.wide ? ' wide' : ''}" data-bento="${i}"></div>`).join('')}
  </div>

  ${head('02', 'Inbox', 'Scroll through, tap to archive. The first one flies into the bin.', `
    <div class="sc-bin" id="sc-bin"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 5.5l-.62 10.03c-.16 2.56-.24 3.84-.88 4.76a4 4 0 0 1-1.2 1.13C15.84 22 14.56 22 12 22c-2.57 0-3.86 0-4.82-.59a4 4 0 0 1-1.2-1.13c-.64-.92-.72-2.2-.87-4.77L4.5 5.5"/><path d="M3 5.5h18M16.06 5.5l-.69-1.41c-.45-.94-.68-1.4-1.07-1.7a2 2 0 0 0-.27-.17C13.59 2 13.07 2 12.03 2c-1.06 0-1.6 0-2.04.23a2 2 0 0 0-.28.18c-.4.3-.62.79-1.06 1.76L8.05 5.5M9.5 16.5v-6M14.5 16.5v-6"/></svg><span class="sc-badge" id="sc-bin-count" hidden>0</span></div>`)}
  <div class="sc-mails-wrap"><div class="sc-mails" id="sc-mails"></div></div>

  <div class="sc-split">
    <div>
      ${head('03', 'Thread', 'Send to watch messages arrive. Tap a message to unsend it.')}
      <div class="sc-panel">
        <div class="sc-thread" id="sc-thread"></div>
        <div class="sc-composer"><span>Message</span><button class="sc-send" id="sc-send" aria-label="Send"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg></button></div>
      </div>
    </div>
    <div>
      ${head('04', 'Arrivals', 'New content assembling into place.')}
      <div class="sc-panel">
        <div class="chips sc-chips">${IN_PRESETS.map((p, i) => `<button class="chip${i ? '' : ' on'}" data-arrive="${p}">${p}</button>`).join('')}<button class="chip sc-add" id="sc-add">Add a card</button></div>
        <div class="sc-arrivals" id="sc-arrivals"><p class="sc-empty">Nothing yet. Pick an entrance and add a card.</p></div>
      </div>
    </div>
  </div>

  <div class="sc-split">
    <div>
      ${head('05', 'Gestures', 'Driven by your cursor: scrub it away, or hold until it gives.')}
      <div class="sc-panel sc-gest">
        <div id="sc-scrub" class="sc-gslot"></div>
        <div id="sc-hold" class="sc-gslot"></div>
      </div>
    </div>
    <div>
      ${head('06', 'Cascade', 'A whole list leaves in a wave.')}
      <div class="sc-panel">
        <div class="sc-cascade-head"><span>Notification Center</span><button class="sc-clear" id="sc-clear">Clear all</button></div>
        <div class="sc-notes" id="sc-notes"></div>
      </div>
    </div>
  </div>

  <div class="sc-split">
    <div>
      ${head('07', 'Morph', 'One view rearranges its grains into another.')}
      <div class="sc-panel sc-morph" id="sc-morph"></div>
    </div>
    <div>
      ${head('08', 'Pile', 'Done tasks pour down and heap up until you sweep.')}
      <div class="sc-panel sc-pile">
        <div class="sc-cascade-head"><span>Today</span><button class="sc-clear" id="sc-sweep">Sweep</button></div>
        <div class="sc-todos" id="sc-todos"></div>
        <div class="sc-floor" id="sc-floor"></div>
      </div>
    </div>
  </div>

${head('09', 'Every variant', 'One card per variant. Shatter is the last one coming to the web port.')}
  <div class="filters chips">${['All', 'Exits', 'Entrances', 'Gestures', 'Special', 'Casual'].map((l, i) => `<button class="chip${i ? '' : ' on'}" data-filter="${l}">${l}</button>`).join('')}</div>
  <div class="gallery" id="sc-all"></div>`;
}

export const head2 = (i, title, note, right = '') => head(i, title, note, right);

export async function mountShowcase(root) {
  await ready;
  mountBento(root);
  mountInbox(root);
  mountThread(root);
  mountArrivals(root);
  mountGestures(root);
  mountCascade(root);
  mountMorph(root);
  mountPile(root);
}
