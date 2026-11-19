// Web version of the mobile Gallery screen (app/gallery.tsx): every effect on real content.
// Each dissolvable item is drawn into a canvas, so the snapshot handed to the engine is exact.
import { morph } from './lib/engine.js';
import { ready } from './images.js';
import { play, snapshot, IMG, FONT, cover, pal, rr, wrap, text, isLight, boxOf, hide, show, onTheme, redraw, scope } from './cp/kit.js';
import { CLAUDE_PATH, OPENAI_PATH } from './docs.js';

const PAINTINGS = ['temple', 'lake', 'pines', 'arch', 'valley', 'pond', 'cypress', 'tuscany', 'aqueduct'];
const IN_PRESETS = ['gather', 'rain', 'print'];

/* ---------- drawing helpers ---------- */

/** Draws one line that never runs past maxW: shrinks down to minSize, then ends with an ellipsis. */
function fitText(ctx, str, x, y, maxW, { size = 14, minSize = size - 2, weight = 400, color, mono = false } = {}) {
  const font = (s) => `${weight} ${s}px ${mono ? "'Geist Mono', monospace" : FONT}`;
  let s = size;
  ctx.font = font(s);
  while (s > minSize && ctx.measureText(str).width > maxW) ctx.font = font(s -= 0.5);
  let out = str;
  if (ctx.measureText(out).width > maxW) {
    while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
    out = out.trimEnd() + '…';
  }
  text(ctx, out, x, y, { size: s, weight, color, mono });
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

/** A canvas element of w x h css px drawn by fn. redrawItems() draws it again (theme switch). */
const DRAW = new WeakMap();
export function item(w, h, fn, cls = '') {
  const c = snapshot(w, h, (ctx) => fn(ctx, w, h));
  DRAW.set(c, (ctx) => fn(ctx, w, h));
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  c.className = 'sc-item ' + cls;
  return c;
}

/** Redraws every item() canvas under root, in the current theme. */
export function redrawItems(root) {
  root.querySelectorAll('canvas.sc-item').forEach((c) => { const fn = DRAW.get(c); if (fn) redraw(c, fn); });
}

/** Tap to dissolve, then fade back so the demo replays (Dissolvable in the mobile app). */
function dissolvable(sc, el, preset, { duration = 1500, touch = false, target, onArrive, back = 0.8 } = {}) {
  el.dataset.preset = preset;
  el.addEventListener('click', async (e) => {
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    const r = boxOf(el);
    const opts = { ...r, preset, duration };
    if (touch) opts.origin = { x: e.clientX - r.x, y: e.clientY - r.y };
    if (target) { const t = target().getBoundingClientRect(); opts.target = { x: t.left, y: t.top, width: t.width, height: t.height }; }
    hide(el);
    if (onArrive) sc.wait(duration * 0.72).then(onArrive);
    await play(opts).done;
    await sc.wait(duration * back);
    show(el);
    delete el.dataset.busy;
  });
}

/** Plays an entrance on an element already in the layout. */
async function appear(el, preset, extra = {}) {
  hide(el);
  await new Promise(requestAnimationFrame);
  await play({ ...boxOf(el), preset, direction: 'in', ...extra }).done;
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

function mountBento(root, sc) {
  root.querySelectorAll('[data-bento]').forEach((slot) => {
    const b = BENTO[+slot.dataset.bento];
    const el = item(slot.clientWidth, slot.clientHeight, (ctx, w, h) => drawBento(ctx, w, h, b));
    slot.replaceChildren(el);
    dissolvable(sc, el, b.preset, { touch: b.touch });
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

function mountInbox(root, sc) {
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
    dissolvable(sc, el, m.preset, { duration: 1400, target: streaming ? () => bin : undefined, onArrive: streaming ? arrive : undefined });
    return el;
  }));
}

/* ---------- 03 Thread ---------- */

function bubble(me, txt, maxW, name) {
  const ctx0 = document.createElement('canvas').getContext('2d');
  ctx0.font = `400 14.5px ${FONT}`;
  const lines = wrap(ctx0, txt, maxW - 28);
  const tw = Math.max(...lines.map((l) => ctx0.measureText(l).width), name ? 60 : 0);
  const w = Math.ceil(tw + 28), h = 18 + lines.length * 20 + (name ? 17 : 0);
  return item(w, h, (ctx) => {
    const c = pal();
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
  const ih = w * 0.7, h = ih + 58;
  return item(w, h, (ctx) => {
    const c = pal();
    ctx.fillStyle = c.me; rr(ctx, 0, 0, w, h, 18); ctx.fill();
    ctx.save(); rr(ctx, 4, 4, w - 8, ih, 15); ctx.clip(); cover(ctx, IMG.cypress, 4, 4, w - 8, ih); ctx.restore();
    text(ctx, 'And this one for the about page', 14, ih + 26, { size: 14, color: c.meText });
    text(ctx, '20:14 · Read', w - 12, ih + 46, { size: 11, color: 'rgba(255,255,255,0.65)', align: 'right' });
  });
}

const REPLIES = ['Love it, ship it', 'Can you send the Figma link?', 'Perfect, talk tomorrow', 'The light is so good'];
const MINE = ['Sending the export now', 'Keeping the warm light', 'On it', 'Here is v2'];

function mountThread(root, sc) {
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
    const r = boxOf(el);
    const opts = { ...r, preset, duration: 1100 };
    if (touch) opts.origin = { x: e.clientX - r.x, y: e.clientY - r.y };
    hide(el);
    await play(opts).done;
    const rw = el.parentElement;
    rw.style.height = rw.offsetHeight + 'px';
    requestAnimationFrame(() => rw.classList.add('gone'));
    sc.wait(320).then(() => rw.remove());
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
    await sc.wait(300);
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
    await sc.wait(450);
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
  return item(w, 68, (ctx) => {
    const c = pal();
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 68, 16); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 67, 15.5); ctx.stroke();
    ctx.save(); rr(ctx, 10, 10, 48, 48, 11); ctx.clip(); cover(ctx, IMG[img], 10, 10, 48, 48); ctx.restore();
    fitText(ctx, 'New painting added', 72, 31, w - 86, { size: 14.5, weight: 600, color: c.ink });
    fitText(ctx, `entered with ${preset}`, 72, 50, w - 86, { size: 12.5, minSize: 11, color: c.text, mono: true });
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
  return item(w, 76, (ctx) => {
    const c = pal();
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 76, 18); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 75, 17.5); ctx.stroke();
    ctx.save(); rr(ctx, 12, 12, 52, 52, 12); ctx.clip(); cover(ctx, IMG[img], 12, 12, 52, 52); ctx.restore();
    fitText(ctx, title, 78, 34, w - 92, { size: 15, weight: 600, color: c.ink });
    fitText(ctx, sub, 78, 54, w - 92, { size: 12.5, minSize: 10.5, color: c.text, mono: true });
  });
}

function respawn(sc, el, ms = 1500) { sc.wait(ms).then(() => { show(el); delete el.dataset.busy; }); }

function mountGestures(root, sc) {
  const slotS = root.querySelector('#sc-scrub'), slotH = root.querySelector('#sc-hold');
  const w = slotS.clientWidth;
  mountScrub(slotS, sc);
  mountHold(slotH, w, sc);
}

/**
 * Scrub card: dust driven by the finger or cursor, reversible until you let go past half.
 * On its own (the gallery panel) it follows the theme itself. Returns a dispose function.
 */
export function mountScrub(slotS, sc) {
  const own = !sc;
  sc ??= scope();
  const w = slotS.clientWidth;
  // Scrub: dust driven by the finger, reversible until you let go past half.
  const card = gCard(w, 'lake', 'Drag me sideways', 'scrub · go back and the grains return');
  card.classList.add('grab');
  slotS.replaceChildren(card);
  // Touch: the card is touch-action: pan-y, a vertical swipe scrolls the page. The scrub starts
  // once the finger leaves the press sideways, then the page holds still.
  let h = null, x0 = 0, p = 0, pend = null;
  const begin = (e, x) => {
    card.dataset.busy = '1';
    try { card.setPointerCapture(e.pointerId); } catch {}
    x0 = x; p = 0;
    h = play({ ...boxOf(card), preset: 'dust', hold: true, duration: 1300 });
    hide(card);
  };
  card.addEventListener('pointerdown', (e) => {
    if (card.dataset.busy) return;
    if (e.pointerType === 'touch') pend = { x: e.clientX, y: e.clientY };
    else begin(e, e.clientX);
  });
  card.addEventListener('touchmove', (e) => { if (h && e.cancelable) e.preventDefault(); }, { passive: false });
  card.addEventListener('pointermove', (e) => {
    if (pend) {
      const dx = Math.abs(e.clientX - pend.x);
      if (dx <= 6 || dx <= Math.abs(e.clientY - pend.y)) return;
      const x = pend.x; pend = null;
      begin(e, x);
    }
    if (!h) return;
    p = Math.max(0, Math.min(1, (e.clientX - x0) / (w * 0.85)));
    h.set(p * h.end);
  });
  const scrubEnd = () => {
    pend = null;
    if (!h) return;
    const cur = h; h = null;
    if (p > 0.45) { cur.release(); cur.done.then(() => respawn(sc, card)); return; }
    const from = p, t0 = performance.now();
    const back = (now) => {
      const k = Math.min(1, (now - t0) / 260);
      cur.set(from * (1 - k * (2 - k)) * cur.end);
      if (k < 1) requestAnimationFrame(back); else { cur.cancel(); show(card, false); delete card.dataset.busy; }
    };
    requestAnimationFrame(back);
  };
  card.addEventListener('pointerup', scrubEnd);
  card.addEventListener('pointercancel', scrubEnd);
  if (own) onTheme(sc, () => redrawItems(slotS));
  return sc.dispose;
}

function mountHold(slotH, w, sc) {
  // Hold: charge heats the card, bursts at full charge, let go early to cancel.
  const hc = gCard(w, 'aqueduct', 'Delete this project', 'charge · hold to confirm, let go to cancel');
  slotH.replaceChildren(hc);
  let hh = null, t0 = 0;
  const tick = (now) => {
    if (!hh) return;
    const c = Math.min(1, (now - t0) / 1200);
    hh.aux.a0 = c; hh.aux.a1 = now - t0;
    if (c >= 1) { const cur = hh; hh = null; cur.release(); cur.done.then(() => respawn(sc, hc)); return; }
    requestAnimationFrame(tick);
  };
  // Touch: wait a beat before charging, a swipe that scrolls the page cancels the pointer first.
  let wait = 0;
  sc.onDispose(() => clearTimeout(wait));
  const charge = () => {
    hc.dataset.busy = '1';
    hh = play({ ...boxOf(hc), preset: 'charge', hold: true });
    hide(hc);
    t0 = performance.now();
    requestAnimationFrame(tick);
  };
  hc.addEventListener('pointerdown', (e) => {
    if (hc.dataset.busy) return;
    e.preventDefault();
    clearTimeout(wait);
    if (e.pointerType === 'touch') wait = setTimeout(() => { wait = 0; if (!hc.dataset.busy) charge(); }, 120);
    else charge();
  });
  const cancel = () => {
    clearTimeout(wait); wait = 0;
    if (!hh) return;
    hh.cancel(); hh = null;
    show(hc, false); delete hc.dataset.busy;
  };
  hc.addEventListener('pointerup', cancel);
  hc.addEventListener('pointerleave', cancel);
  hc.addEventListener('pointercancel', cancel);
}

/* ---------- 06 Cascade ---------- */

const NOTES = [
  { app: 'Messages', text: 'Léa: the direction is up', img: 'pond' },
  { app: 'Calendar', text: 'Design review in 10 minutes', img: 'lake' },
  { app: 'Hannera', text: 'Your order is paid', img: 'tuscany' },
  { app: 'Photos', text: 'Lisbon, 3 years ago', img: 'valley' },
];

function mountCascade(root, sc) {
  const list = root.querySelector('#sc-notes');
  const w = list.clientWidth;
  const rows = NOTES.map((n) => item(w, 58, (ctx) => {
    const c = pal();
    ctx.fillStyle = c.card; rr(ctx, 0, 0, w, 58, 16); ctx.fill();
    ctx.strokeStyle = c.line; rr(ctx, 0.5, 0.5, w - 1, 57, 15.5); ctx.stroke();
    ctx.save(); rr(ctx, 10, 10, 38, 38, 10); ctx.clip(); cover(ctx, IMG[n.img], 10, 10, 38, 38); ctx.restore();
    text(ctx, n.app.toUpperCase(), 60, 25, { size: 10.5, weight: 600, color: c.muted });
    fitText(ctx, n.text, 60, 43, w - 74, { size: 14, color: c.ink });
  }));
  list.replaceChildren(...rows);
  let busy = false;
  root.querySelector('#sc-clear').onclick = async () => {
    if (busy) return;
    busy = true;
    // Rows leave in a diagonal wave: each one starts a beat after the one above.
    await Promise.all(rows.map(async (el, i) => {
      await sc.wait(i * 110);
      const r = boxOf(el);
      hide(el);
      await play({ ...r, preset: 'dust', duration: 1400 }).done;
    }));
    await sc.wait(1200);
    rows.forEach((el) => show(el));
    busy = false;
  };
}

/* ---------- 07 Morph ---------- */

function pill(label, filled) {
  const ctx0 = document.createElement('canvas').getContext('2d');
  ctx0.font = `600 14px ${FONT}`;
  const w = Math.ceil(ctx0.measureText(label).width + 36), h = 38;
  return item(w, h, (ctx) => {
    const c = pal();
    if (filled) { ctx.fillStyle = isLight() ? '#12151A' : '#F2F4F7'; rr(ctx, 0, 0, w, h, 19); ctx.fill(); }
    else { ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; rr(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 18.25); ctx.stroke(); }
    text(ctx, label, w / 2, 24, { size: 14, weight: 600, color: filled ? (isLight() ? '#fff' : '#12151A') : c.ink, align: 'center' });
  }, 'sc-pill');
}

function mountMorph(root) {
  const host = root.querySelector('#sc-morph');
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
    const ra = boxOf(a), rb = boxOf(b);
    hide(a); hide(b);
    await morph(ra, rb, { grain: 2, duration: 1100, reverse: onB }).done;
    show(onB ? a : b, false);
    onB = !onB;
    busy = false;
  });
}

/* ---------- page ---------- */

const head = (i, title, note, right = '') => `
  <header class="sc-head">
    <div><p class="sc-index">${i}</p><h2>${title}</h2><p class="sc-note">${note}</p></div>${right}
  </header>`;

/** Hero install sources: Claude Code, Codex, npm. */
const HX = [
  { label: 'Claude Code', cmd: 'curl -fsSL dissolve.rselmi.com/mcp.sh | sh', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#D97757" aria-hidden="true"><path d="${CLAUDE_PATH}"/></svg>` },
  { label: 'Codex', cmd: 'codex mcp add dissolve -- npx -y dissolve-ui-mcp', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${OPENAI_PATH}"/></svg>` },
  { label: 'npm', cmd: 'npx expo install dissolve-ui', icon: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#CB3837"/><path d="M5 7h14v10h-7v-8.2h-2.6V17H5z" fill="#fff"/></svg>' },
];

/** Gallery: the hero, then only the components. */
export function showcaseHTML({ components } = {}) {
  return `${heroHTML()}
  ${components ? components(head) : ''}`;
}

function heroHTML() {
  return `
  <header class="sc-hero2">
    <h1 class="hx-title"><canvas class="hx-title-cv" aria-hidden="true"></canvas><span class="hx-sr">dissolve</span></h1>
    <p>Animation library built for <strong>React Native</strong> and <strong>React</strong></p>
  </header>
  <div class="hx" data-hx>
    <div class="hx-src" role="tablist" aria-label="Install with">
      <span class="hx-glide" aria-hidden="true"></span>
      ${HX.map((h, i) => `<button class="hx-src-btn${i ? '' : ' on'}" role="tab" aria-label="${h.label}" title="${h.label}" data-hx-i="${i}">${h.icon}</button>`).join('')}
    </div>
    <code class="hx-cmd" data-hx-cmd>${HX[0].cmd}</code>
    <button class="hx-copy" aria-label="Copy command" data-hx-copy><svg class="i-copy" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg><svg class="i-ok" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
  </div>
  <a class="hx-more" href="#/agent-prompt">Or paste one prompt into your agent <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a>`;
}

/** Effects page: the engine on its own, scene by scene, then every variant. */
export function effectsHTML() {
  return `
  <header class="head">
    <h1>Effects</h1>
    <p class="sub">The engine on its own: any view can leave, arrive or morph in grains.</p>
  </header>
  ${head('01', 'Bento', 'Tap a card. snap starts where your cursor lands.')}
  <div class="sc-bento">
    ${BENTO.map((b, i) => `<div class="sc-slot${b.wide ? ' wide' : ''}" data-bento="${i}"></div>`).join('')}
  </div>


  ${head('02', 'Inbox', 'Scroll through, tap to archive. The first one flies into the bin.', `
    <div class="sc-bin" id="sc-bin"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 5.5l-.62 10.03c-.16 2.56-.24 3.84-.88 4.76a4 4 0 0 1-1.2 1.13C15.84 22 14.56 22 12 22c-2.57 0-3.86 0-4.82-.59a4 4 0 0 1-1.2-1.13c-.64-.92-.72-2.2-.87-4.77L4.5 5.5"/><path d="M3 5.5h18M16.06 5.5l-.69-1.41c-.45-.94-.68-1.4-1.07-1.7a2 2 0 0 0-.27-.17C13.59 2 13.07 2 12.03 2c-1.06 0-1.6 0-2.04.23a2 2 0 0 0-.28.18c-.4.3-.62.79-1.06 1.76L8.05 5.5M9.5 16.5v-6M14.5 16.5v-6"/></svg><span class="sc-badge" id="sc-bin-count" hidden>0</span></div>`)}
  <div class="sc-mails-wrap"><div class="sc-mails" id="sc-mails"></div></div>

  <div class="sc-split">
    <div>
      ${head('03', 'Cascade', 'A whole list leaves in a wave.')}
      <div class="sc-panel">
        <div class="sc-cascade-head"><span>Notification Center</span><button class="sc-clear" id="sc-clear">Clear all</button></div>
        <div class="sc-notes" id="sc-notes"></div>
      </div>
    </div>
    <div>
      ${head('04', 'Thread', 'Send to watch messages arrive. Tap a message to unsend it.')}
      <div class="sc-panel">
        <div class="sc-thread" id="sc-thread"></div>
        <div class="sc-composer"><span>Message</span><button class="sc-send" id="sc-send" aria-label="Send"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg></button></div>
      </div>
    </div>
  </div>

  <div class="sc-split">
    <div>
      ${head('05', 'Arrivals', 'New content assembling into place.')}
      <div class="sc-panel">
        <div class="chips sc-chips">${IN_PRESETS.map((p, i) => `<button class="chip${i ? '' : ' on'}" data-arrive="${p}">${p}</button>`).join('')}<button class="chip sc-add" id="sc-add">Add a card</button></div>
        <div class="sc-arrivals" id="sc-arrivals"><p class="sc-empty">Nothing yet. Pick an entrance and add a card.</p></div>
      </div>
    </div>
    <div>
      ${head('06', 'Gestures', 'Driven by your cursor: scrub it away, or hold until it gives.')}
      <div class="sc-panel sc-gest">
        <div id="sc-scrub" class="sc-gslot"></div>
        <div id="sc-hold" class="sc-gslot"></div>
      </div>
    </div>
  </div>

  <div class="sc-solo">
    <div>
      ${head('07', 'Morph', 'One view rearranges its grains into another.')}
      <div class="sc-panel sc-morph" id="sc-morph"></div>
    </div>
  </div>

${head('08', 'Every variant', 'The principal exits and entrances. Every other variant has its own page in the sidebar.')}
  <div class="filters chips">${['All', 'Exits', 'Entrances'].map((l, i) => `<button class="chip${i ? '' : ' on'}" data-filter="${l}">${l}</button>`).join('')}</div>
  <div class="gallery" id="sc-all"></div>`;
}

/** Hero command bar: the source buttons swap the command, one click copy with a check. */
function mountInstall(root) {
  const box = root.querySelector('[data-hx]');
  if (!box) return;
  const glide = box.querySelector('.hx-glide');
  const cmd = box.querySelector('[data-hx-cmd]');
  const btns = [...box.querySelectorAll('.hx-src-btn')];
  const place = (b) => { glide.style.transform = `translateX(${b.offsetLeft - 3}px)`; };
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.classList.toggle('on', x === b));
    place(b);
    cmd.classList.remove('swap'); void cmd.offsetWidth; cmd.classList.add('swap');
    cmd.textContent = HX[+b.dataset.hxI].cmd;
  }));
  const copy = box.querySelector('[data-hx-copy]');
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(cmd.textContent).catch(() => {});
    copy.classList.add('ok');
    setTimeout(() => copy.classList.remove('ok'), 1400);
  });
}

/**
 * Hero title in grains: the real Allo letters (round axis at 100) sampled on a 3 px grid.
 * Grains gather in from below on load, flee the pointer and spring back, and a click bursts them.
 */
const TITLE_FACE = new FontFace('Allo Display', 'url(fonts/allo/AlloVariable.woff2)', { weight: '100 900', variationSettings: "'ROND' 100" });

/** Title ink from the theme token: the computed color lags behind while the theme cross-fades. */
const readInk = () => getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';

/** Returns a dispose function. */
function mountTitle(root, sc) {
  const h1 = root.querySelector('.hx-title');
  const cv = h1?.querySelector('canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CELL = 3, DOT = 2.6, R = 70, PAD = 48;
  let g = [], W = 0, H = 0, dpr = 1, ink = '#fff', raf = 0, t0 = 0, ptr = null, alive = true, started = false;

  function build() {
    const cs = getComputedStyle(h1);
    const size = parseFloat(cs.fontSize);
    ink = readInk();
    dpr = Math.min(2, devicePixelRatio || 1);
    const font = `820 ${size}px 'Allo Display'`;
    const m = document.createElement('canvas').getContext('2d');
    m.font = font;
    const tw = Math.ceil(m.measureText('dissolve').width + size * 0.02);
    W = tw + 8; H = Math.ceil(size * 1.02);
    cv.width = (W + PAD * 2) * dpr; cv.height = (H + PAD * 2) * dpr;
    cv.style.width = W + PAD * 2 + 'px'; cv.style.height = H + PAD * 2 + 'px';
    cv.style.margin = `${-PAD}px`;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d');
    o.font = font; o.fillStyle = '#000'; o.textBaseline = 'alphabetic';
    o.fillText('dissolve', 2, Math.round(size * 0.8));
    const data = o.getImageData(0, 0, W, H).data;
    const prev = g;
    g = [];
    for (let y = CELL / 2; y < H; y += CELL) for (let x = CELL / 2; x < W; x += CELL) {
      if (data[((y | 0) * W + (x | 0)) * 4 + 3] < 128) continue;
      const r = Math.random();
      // Start close to home: a short random offset with a slight lift, so the word condenses in place.
      const ang = Math.random() * Math.PI * 2, dist = 10 + Math.random() * 26;
      const sx = x + Math.cos(ang) * dist, sy = y + Math.sin(ang) * dist * 0.6 + 14;
      g.push({ hx: x, hy: y, sx, sy, x: sx, y: sy, vx: 0, vy: 0, d: (x / W) * 560 + r * 180 });
    }
    if (prev.length && !reduced) for (const p of g) { p.x = p.hx; p.y = p.hy; p.d = 0; }
    if (reduced) for (const p of g) { p.x = p.hx; p.y = p.hy; }
    t0 = 0;
    if (started) kick();
  }

  function kick() { if (started && !raf && alive && sc.alive) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    if (!h1.isConnected) { alive = false; return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
    ctx.translate(PAD, PAD);
    ctx.fillStyle = ink;
    let moving = false;
    if (!t0) t0 = now;
    const since = now - t0;
    for (const p of g) {
      // Arrival: each grain eases from its start to home, staggered left to right, fading in.
      const e = reduced ? 1 : Math.min(1, Math.max(0, (since - p.d) / 1000));
      let tx = p.hx, ty = p.hy;
      if (e < 1) { moving = true; const k = 1 - Math.pow(1 - e, 4); tx = p.sx + (p.hx - p.sx) * k; ty = p.sy + (p.hy - p.sy) * k; }
      // Pointer: grains inside the radius flee, then a damped spring brings them home.
      let fx = 0, fy = 0;
      if (ptr && e === 1) {
        const dx = p.x - ptr.x, dy = p.y - ptr.y, d = Math.hypot(dx, dy);
        if (d < R && d > 0.01) { const f = (1 - d / R) * 1.1; fx = (dx / d) * f; fy = (dy / d) * f; }
      }
      if (e === 1) {
        p.vx = (p.vx + fx + (p.hx - p.x) * 0.06) * 0.86;
        p.vy = (p.vy + fy + (p.hy - p.y) * 0.06) * 0.86;
        p.x += p.vx; p.y += p.vy;
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.02 || Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) > 0.05) moving = true;
        else { p.x = p.hx; p.y = p.hy; }
      } else { p.x = tx; p.y = ty; }
      const a = e < 1 ? Math.min(1, e * 1.6) * Math.min(1, e * 1.6) : 1;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, DOT / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (moving || ptr) kick();
  }

  const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left - PAD, y: e.clientY - r.top - PAD }; };
  cv.addEventListener('pointermove', (e) => { ptr = local(e); kick(); });
  cv.addEventListener('pointerleave', () => { ptr = null; kick(); });
  cv.addEventListener('pointerdown', (e) => {
    // Burst: every grain near the click is thrown outward with a random kick.
    const c = local(e);
    for (const p of g) {
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d > R * 1.6) continue;
      const f = (1 - d / (R * 1.6)) * (9 + Math.random() * 9);
      p.vx += (dx / d) * f + (Math.random() - 0.5) * 3;
      p.vy += (dy / d) * f + (Math.random() - 0.5) * 3 - 2;
    }
    kick();
  });
  onTheme(sc, () => { ink = readInk(); kick(); });
  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => h1.isConnected && build(), 150); };
  addEventListener('resize', onResize);
  sc.onDispose(() => { removeEventListener('resize', onResize); clearTimeout(rt); cancelAnimationFrame(raf); raf = 0; alive = false; });
  const go = () => { started = true; t0 = 0; kick(); };
  Promise.all([TITLE_FACE.load().then((f) => document.fonts.add(f)).catch(() => {}), ready])
    .then(() => { if (!sc.alive) return; build(); requestAnimationFrame(() => requestAnimationFrame(go)); });
}

/** Mounts the hero (gallery) or the scenes (effects page). Returns a dispose function. */
export function mountShowcase(root) {
  const sc = scope();
  if (root.querySelector('.hx-title')) {
    mountTitle(root, sc);
    mountInstall(root);
  }
  if (!root.querySelector('.sc-bento')) return sc.dispose;
  ready.then(() => {
    if (!sc.alive) return;
    mountBento(root, sc);
    mountInbox(root, sc);
    mountThread(root, sc);
    mountArrivals(root);
    mountGestures(root, sc);
    mountCascade(root, sc);
    mountMorph(root);
    // Every scene is a canvas: draw them again in the new theme, in place.
    onTheme(sc, () => redrawItems(root));
  });
  return sc.dispose;
}
