// Web ports of the message components: ReactionPicker, VoiceNote, SignaturePad.
// Native sources: src/dissolve/components/{ReactionPicker,VoiceNote,SignaturePad}.tsx.
// Same geometry, timings, springs and curves; shown raw, one instance, no chat around it.
import { CALM, QUAD, value, el, clamp, rectOf, frame, play, snapshot, FONT, rr, isLight, PKG, DIR, prop } from './kit.js';

const OUT_QUAD = (t) => 1 - (1 - t) * (1 - t);
const LINEAR = (t) => t;

/* ======================================================================================
   ReactionPicker (ReactionPicker.tsx)
   ====================================================================================== */

const LIFT = { damping: 26, stiffness: 340, mass: 0.9, eps: 0.002 };
const OPEN = { damping: 26, stiffness: 320, mass: 0.9, eps: 0.002 };
const POP = { damping: 15, stiffness: 420, mass: 0.7, eps: 0.002 };
const SLOT = 44, PAD = 6, PILL_H = 52, BADGE = 28, HOLD = 320;
const BAND_UP = 70, BAND_DOWN = 46, MAG = 0.72, RISE = 16, EDGE = 10;
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const MESSAGE = 'Maya finished the three screens, they look great';

/** Weight of emoji i under a finger at local x (dock curve). */
const weight = (i, lx, hover) => {
  const d = (lx - (PAD + i * SLOT + SLOT / 2)) / SLOT;
  return hover * Math.exp(-d * d * 1.25);
};

function reactionColors() {
  return isLight()
    ? { bubble: '#EFEFF1', text: '#1C1C1E', pill: '#FFFFFF', pillLine: 'rgba(0,0,0,0.06)', current: '#EDEDF0', badge: '#FFFFFF', back: 'transparent' }
    : { bubble: '#2C2C2E', text: '#F2F2F7', pill: '#2C2C2E', pillLine: 'rgba(255,255,255,0.08)', current: '#3A3A3C', badge: '#3A3A3C', back: 'transparent' };
}

/**
 * Ink box of an emoji, found by scanning the pixels of an offscreen render: font metrics
 * describe the em box, not where color emoji glyphs actually paint. Cached per emoji and size.
 */
const INK = new Map();
function inkBox(emoji, size) {
  const key = emoji + size;
  if (INK.has(key)) return INK.get(key);
  // Rendered at 3x for sub pixel precision, then expressed back in CSS pixels.
  const Q = 3, S = Math.ceil(size * 2.4 * Q), o = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.font = `${size * Q}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(emoji, o, o);
  const d = ctx.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (d[(y * S + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // Ink center relative to the draw origin (x at the pen, y on the baseline).
  const box = x1 < 0 ? { cx: size / 2, cy: -size / 2 } : { cx: ((x0 + x1 + 1) / 2 - o) / Q, cy: ((y0 + y1 + 1) / 2 - o) / Q };
  INK.set(key, box);
  return box;
}

/** Draws an emoji with its painted ink centered on (cx, cy). */
function drawEmoji(ctx, emoji, size, cx, cy) {
  const b = inkBox(emoji, size);
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(emoji, cx - b.cx, cy - b.cy);
}

/** An emoji as a canvas of box x box px, ink centered, so it lines up identically everywhere. */
function emojiCanvas(emoji, size, box) {
  const cv = snapshot(box, box, (ctx) => drawEmoji(ctx, emoji, size, box / 2, box / 2));
  cv.style.width = cv.style.height = box + 'px';
  cv.style.display = 'block';
  return cv;
}

function badgeCanvas(emoji, c) {
  const cv = snapshot(BADGE, BADGE, (ctx) => {
    ctx.fillStyle = c.badge;
    ctx.beginPath(); ctx.arc(BADGE / 2, BADGE / 2, BADGE / 2, 0, Math.PI * 2); ctx.fill();
    drawEmoji(ctx, emoji, 16, BADGE / 2, BADGE / 2);
  });
  cv.className = 'cp-rx-badge-img';
  cv.style.width = cv.style.height = BADGE + 'px';
  return cv;
}

function mountReaction(body, { sc, mode }) {
  const c = reactionColors();
  const wrap = el('div', 'cp-rx');
  const holder = el('div', 'cp-rx-holder');
  const bubble = el('div', 'cp-rx-bubble');
  bubble.textContent = MESSAGE;
  bubble.style.background = c.bubble;
  bubble.style.color = c.text;
  bubble.setAttribute('role', 'button');
  bubble.tabIndex = 0;
  bubble.setAttribute('aria-label', `${MESSAGE}. Long press to react.`);
  const badgeWrap = el('div', 'cp-rx-badge');
  holder.append(bubble, badgeWrap);
  wrap.append(holder);
  body.append(wrap);

  let selected = null, open = null, busy = false, quiet = false;

  /* ---- badge ---- */
  let badgeImg = null;
  const badgeScale = value(sc, 0, () => { badgeWrap.style.transform = `scale(${Math.max(0, badgeScale.v).toFixed(4)})`; });
  function setBadge(emoji) {
    if (emoji) {
      badgeImg?.remove();
      badgeImg = badgeCanvas(emoji, c);
      badgeWrap.append(badgeImg);
      if (quiet) { quiet = false; badgeScale.set(1); } else { badgeScale.set(0.3); badgeScale.spring(1, POP); }
      return;
    }
    if (!badgeImg) return;
    const img = badgeImg;
    badgeImg = null;
    const r = rectOf(img);
    img.style.opacity = '0';
    sc.track(play({ source: img, ...r, preset: 'snap', duration: 700, grain: 1.5 })).done.then(() => {
      img.remove();
      if (!badgeImg) badgeScale.set(0);
    });
  }
  const react = (emoji) => {
    selected = selected === emoji ? null : emoji;
    setBadge(selected);
  };

  /* ---- overlay (the native Modal): backdrop, lifted clone, pill, flying emoji ---- */
  const press = value(sc, 0, () => { bubble.style.transform = `scale(${(1 - 0.03 * press.v).toFixed(4)})`; });
  let ov = null;

  function build(box, pressPt) {
    const n = REACTIONS.length, pillW = n * SLOT + PAD * 2;
    // Room comes from the viewport, like the native window: above the bubble, flipped below if needed.
    const top = 8, bottom = 8, gap = 10 + BADGE * 0.55;
    const below = box.y - gap - PILL_H < top;
    let y = below ? box.y + box.height + 12 : box.y - gap - PILL_H;
    y = Math.max(top, Math.min(y, innerHeight - bottom - PILL_H));
    let x = box.x + box.width / 2 < innerWidth / 2 ? box.x : box.x + box.width - pillW;
    x = Math.max(EDGE, Math.min(x, innerWidth - EDGE - pillW));

    const root = el('div', 'cp-rx-layer');
    const back = el('div', 'cp-rx-back');
    back.style.background = c.back;
    const clone = holder.cloneNode(true);
    clone.className = 'cp-rx-clone';
    clone.querySelector('.cp-rx-badge')?.remove();
    clone.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
    const cb = clone.querySelector('.cp-rx-bubble');
    cb.style.transform = '';
    if (selected) {
      const b = el('div', 'cp-rx-badge cp-rx-clone-badge');
      b.append(badgeCanvas(selected, c));
      clone.append(b);
    }
    const pill = el('div', 'cp-rx-pill');
    pill.style.cssText = `left:${x}px;top:${y}px;width:${pillW}px;background:${c.pill};box-shadow:0 10px 22px rgba(0,0,0,${isLight() ? 0.14 : 0.4}),inset 0 0 0 0.5px ${c.pillLine}`;
    pill.setAttribute('role', 'menu');
    const emojis = REACTIONS.map((r, i) => {
      const slot = el('button', 'cp-rx-slot');
      slot.type = 'button';
      slot.setAttribute('role', 'menuitem');
      slot.setAttribute('aria-label', `React ${r}`);
      if (r === selected) { const cur = el('span', 'cp-rx-current'); cur.style.background = c.current; slot.append(cur); }
      const e = el('span', 'cp-rx-emoji');
      e.append(emojiCanvas(r, 30, 44));
      slot.append(e);
      slot.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(i); } });
      pill.append(slot);
      return e;
    });
    root.append(back, clone, pill);
    document.body.append(root);
    return { root, back, clone, cb, pill, emojis, pillW, pill0: { x, y }, box, press: pressPt };
  }

  // Overlay state, rendered in one place.
  let lx = 0, hot = -1, chosen = -1, flying = null, ready = false;
  const pops = REACTIONS.map(() => value(sc, 0, () => renderOv()));
  const lift = value(sc, 0, () => renderOv());
  const menu = value(sc, 0, () => renderOv());
  const back = value(sc, 0, () => renderOv());
  const hover = value(sc, 0, () => renderOv());
  const fly = value(sc, 0, () => renderOv());

  function renderOv() {
    if (!ov) return;
    ov.back.style.opacity = back.v.toFixed(3);
    ov.clone.style.transform = `scale(${(0.97 + 0.05 * lift.v).toFixed(4)})`;
    ov.cb.style.boxShadow = `0 8px 18px rgba(0,0,0,${(0.16 * lift.v * (isLight() ? 1 : 2)).toFixed(3)})`;
    const m = menu.v;
    const ox = ov.press.x - (ov.pill0.x + ov.pillW / 2), oy = ov.press.y - (ov.pill0.y + PILL_H / 2);
    ov.pill.style.opacity = Math.min(1, Math.max(0, m * 2.5)).toFixed(3);
    ov.pill.style.transform = `translate(${(ox * (1 - m)).toFixed(2)}px,${(oy * (1 - m)).toFixed(2)}px) scale(${(0.2 + 0.8 * m).toFixed(4)})`;
    ov.emojis.forEach((e, i) => {
      const w = weight(i, lx, hover.v), p = pops[i].v;
      e.style.opacity = chosen === i ? '0' : Math.min(1, Math.max(0, p * 2)).toFixed(3);
      e.style.transform = `translateY(${(-RISE * w + (1 - p) * 8).toFixed(2)}px) scale(${(Math.max(0, p) * (1 + MAG * w)).toFixed(4)})`;
    });
    if (flying) {
      const t = fly.v;
      const x = flying.from.x + (flying.to.x - flying.from.x) * t;
      const y = flying.from.y + (flying.to.y - flying.from.y) * t - Math.sin(Math.PI * t) * 36;
      flying.node.style.transform = `translate(${(x - BADGE / 2).toFixed(2)}px,${(y - BADGE / 2).toFixed(2)}px)`;
      const k = clamp((t - 0.4) / 0.6);
      flying.disc.style.opacity = k.toFixed(3);
      flying.disc.style.transform = `scale(${(0.4 + 0.6 * k).toFixed(4)})`;
      flying.emoji.style.transform = `scale(${(flying.s0 + (0.5 - flying.s0) * t).toFixed(4)})`;
    }
  }

  function openAt(px, py, keyboard = false) {
    if (busy || !sc.alive) return;
    busy = true;
    const box = rectOf(bubble);
    // The pressed scale is dropped before measuring, like the native onShow.
    const s = 1 - 0.03 * press.v, fw = box.w / s, fh = box.h / s;
    const full = { x: box.x + box.w / 2 - fw / 2, y: box.y + box.h / 2 - fh / 2, width: fw, height: fh };
    ov = build(full, { x: px, y: py });
    chosen = -1; hot = -1; lx = 0; flying = null;
    [lift, menu, back, hover, fly].forEach((v) => v.set(0));
    pops.forEach((p) => p.set(0));
    ready = true;
    holder.style.opacity = '0';
    press.set(0);
    lift.spring(1, LIFT);
    back.to(1, 260, CALM);
    menu.spring(1, OPEN);
    pops.forEach((p, i) => sc.wait(40 + i * 24).then(() => ov && p.spring(1, POP)));
    ov.back.addEventListener('pointerdown', (e) => { if (e.target === ov?.back) cancel(); });
    ov.pill.addEventListener('pointerdown', (e) => {
      if (!ready) return;
      e.preventDefault();
      try { ov.pill.setPointerCapture(e.pointerId); } catch {}
      pickDrag = true;
      track(e.clientX, e.clientY);
    });
    ov.pill.addEventListener('pointermove', (e) => { if (pickDrag) track(e.clientX, e.clientY); });
    const up = () => { if (!pickDrag) return; pickDrag = false; if (hot >= 0) choose(hot); };
    ov.pill.addEventListener('pointerup', up);
    ov.pill.addEventListener('pointercancel', () => { pickDrag = false; });
    if (keyboard) ov.pill.querySelector('button')?.focus({ preventScroll: true });
  }
  let pickDrag = false;

  function track(x, y) {
    if (!ready || !ov) return;
    const px = x - ov.pill0.x, py = y - ov.pill0.y;
    const inside = py > -BAND_UP && py < PILL_H + BAND_DOWN && px > -SLOT * 0.4 && px < ov.pillW + SLOT * 0.4;
    lx = Math.max(PAD + SLOT / 2, Math.min(px, ov.pillW - PAD - SLOT / 2));
    const next = inside ? Math.max(0, Math.min(REACTIONS.length - 1, Math.floor((px - PAD) / SLOT))) : -1;
    if (next !== hot) {
      hover.to(next >= 0 ? 1 : 0, 140, QUAD);
      hot = next;
    }
    renderOv();
  }

  function finish() {
    ready = false;
    const refocus = !!ov?.root.contains(document.activeElement);
    ov?.root.remove();
    ov = null;
    flying = null;
    hot = -1;
    holder.style.opacity = '';
    busy = false;
    if (refocus) bubble.focus({ preventScroll: true });
  }

  function close(after) {
    ready = false;
    hover.to(0, 160, QUAD);
    menu.to(0, 220, CALM);
    back.to(0, 260, CALM);
    lift.to(0, 280, CALM).then((ok) => ok && finish());
    if (after) sc.wait(320).then(after);
  }
  const cancel = () => close();

  function choose(i) {
    if (!ov || i < 0 || i >= REACTIONS.length || chosen >= 0) return;
    const emoji = REACTIONS[i];
    if (emoji === selected) { close(() => react(emoji)); return; }
    const w = weight(i, lx, hover.v);
    const { box } = ov;
    const from = { x: ov.pill0.x + PAD + i * SLOT + SLOT / 2, y: ov.pill0.y + PILL_H / 2 - RISE * w };
    const to = { x: box.x + box.width - BADGE * 0.15, y: box.y - BADGE * 0.1 };
    chosen = i;
    ready = false;
    quiet = true;
    const node = el('div', 'cp-rx-fly');
    const disc = el('div', 'cp-rx-fly-disc');
    disc.style.background = c.badge;
    const em = el('div', 'cp-rx-fly-emoji');
    em.append(emojiCanvas(emoji, 30, 44));
    node.append(disc, em);
    ov.root.append(node);
    flying = { node, disc, emoji: em, from, to, s0: 1 + MAG * w };
    hover.to(0, 200, QUAD);
    menu.to(0, 260, CALM, 60);
    back.to(0, 420, CALM);
    lift.to(0, 440, CALM);
    fly.to(1, 480, CALM).then((ok) => {
      if (!ok) return;
      react(emoji);
      finish();
    });
  }

  /* ---- the long press on the bubble (Pan activated after 320 ms) ---- */
  let g = null;
  bubble.addEventListener('pointerdown', (e) => {
    if (busy || e.button > 0) return;
    g = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, moved: false, id: e.pointerId };
    press.to(1, HOLD, OUT_QUAD);
    const my = g;
    g.timer = setTimeout(() => {
      if (g !== my || !sc.alive) return;
      my.active = true;
      try { bubble.setPointerCapture(my.id); } catch {}
      openAt(my.x, my.y);
    }, HOLD);
  });
  bubble.addEventListener('pointermove', (e) => {
    if (!g) return;
    g.x = e.clientX; g.y = e.clientY;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.active) {
      // Moving before the hold is a scroll, not a press.
      if (dx * dx + dy * dy > 100) { clearTimeout(g.timer); g = null; press.to(0, 220, CALM); }
      return;
    }
    if (dx * dx + dy * dy > 196) g.moved = true;
    track(e.clientX, e.clientY);
  });
  const release = () => {
    if (!g) return;
    const st = g;
    g = null;
    clearTimeout(st.timer);
    if (!st.active) { press.to(0, 220, CALM); return; }
    if (hot >= 0) choose(hot);
    else if (st.moved) cancel();
    // Released without moving: the picker stays open for a tap.
  };
  bubble.addEventListener('pointerup', release);
  bubble.addEventListener('pointercancel', release);
  bubble.addEventListener('contextmenu', (e) => e.preventDefault());
  bubble.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !busy) {
      e.preventDefault();
      const r = rectOf(bubble);
      openAt(r.x + r.w / 2, r.y + r.h / 2, true);
    }
  });
  const onKey = (e) => { if (e.key === 'Escape' && ready) cancel(); };
  const onScroll = () => { if (ready) cancel(); };
  addEventListener('keydown', onKey);
  addEventListener('scroll', onScroll, { passive: true });
  sc.onDispose(() => {
    removeEventListener('keydown', onKey);
    removeEventListener('scroll', onScroll);
    clearTimeout(g?.timer);
    ov?.root.remove();
  });

  let turn = 0;
  return {
    async run() {
      if (busy) return;
      // Hold, then slide across the pill and let go on an emoji (a different one each time).
      const target = [0, 5, 1, 4][turn++ % 4];
      const r = rectOf(bubble);
      const start = { x: r.x + r.w * 0.3, y: r.y + r.h / 2 };
      press.to(1, HOLD, OUT_QUAD);
      await sc.wait(HOLD);
      openAt(start.x, start.y);
      if (!ov) return;
      await sc.wait(380);
      const y = ov.pill0.y + PILL_H / 2 + 6;
      const x0 = ov.pill0.x + PAD + SLOT / 2, x1 = ov.pill0.x + PAD + target * SLOT + SLOT / 2;
      const from = x0;
      const ms = 420 + Math.abs(x1 - from) * 1.6;
      const t0 = performance.now();
      while (sc.alive && ov) {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        track(from + (x1 - from) * e, start.y + (y - start.y) * Math.min(1, k * 2.5));
        if (k >= 1) break;
        await frame();
      }
      await sc.wait(220);
      if (!ov) return;
      if (selected === REACTIONS[target]) { close(() => react(REACTIONS[target])); await sc.wait(1000); return; }
      choose(target);
      await sc.wait(1400);
    },
  };
}
/* ======================================================================================
   VoiceNote (VoiceNote.tsx)
   ====================================================================================== */

const BAR = 3, GAP = 2, WAVE_H = 28, BTN = 34;
const PLAY_PATH = 'M13 10.6c0-1 1.1-1.6 1.9-1.1l9.4 6.4c.7.5.7 1.6 0 2.1l-9.4 6.4c-.8.5-1.9-.1-1.9-1.1z';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) {
  if (typeof s === 'number') return Math.floor(s * 2654435761);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h;
}
/** A waveform that reads like speech: syllable bursts, short pauses, soft edges. */
function voiceLevels(seed, count = 64) {
  const r = rng(hash(seed));
  const out = [];
  let syllable = 0, amp = 0.6;
  for (let i = 0; i < count; i++) {
    if (syllable <= 0) {
      syllable = 3 + Math.floor(r() * 6);
      amp = r() < 0.16 ? 0.08 : 0.35 + r() * 0.65;
    }
    const k = 1 - Math.abs((syllable - 3) / 6);
    out.push(amp * (0.55 + 0.45 * k) * (0.7 + 0.3 * r()));
    syllable--;
  }
  return out.map((v, i) => {
    const a = out[i - 1] ?? v, b = out[i + 1] ?? v;
    const edge = Math.min(1, (i + 1) / 4, (count - i) / 4);
    return Math.max(0.06, ((a + 2 * v + b) / 4) * (0.5 + 0.5 * edge));
  });
}
function resample(levels, n) {
  const out = [];
  for (let j = 0; j < n; j++) {
    const a = Math.floor((j / n) * levels.length);
    const b = Math.max(a + 1, Math.floor(((j + 1) / n) * levels.length));
    let m = 0;
    for (let i = a; i < b && i < levels.length; i++) m = Math.max(m, levels[i]);
    out.push(clamp(m));
  }
  return out;
}
const fmt = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function voiceColors() {
  // Your own note: the native dark bubble in light; iMessage dark mode gray on the dark site.
  return isLight()
    ? { bubble: '#1C1C1E', button: '#FFFFFF', icon: '#1C1C1E', played: '#FFFFFF', unplayed: 'rgba(255,255,255,0.3)', label: 'rgba(255,255,255,0.7)' }
    : { bubble: '#2C2C2E', button: '#FFFFFF', icon: '#2C2C2E', played: '#FFFFFF', unplayed: 'rgba(255,255,255,0.28)', label: 'rgba(255,255,255,0.66)' };
}

function mountVoice(body, { sc }) {
  const DURATION = 9, SEED = 'rayan-reply';
  const c = voiceColors();
  const H = 8 + BTN + 8;
  const W = Math.round(Math.min(248, body.clientWidth || 248));
  const waveX = 8 + BTN + 10, labelW = 30;
  const waveW = Math.floor(W - waveX - 10 - labelW - 14);
  const count = Math.floor((waveW + GAP) / (BAR + GAP));
  const bars = resample(voiceLevels(SEED, 96), count);
  const dpr = Math.min(2, devicePixelRatio || 1), px = 1 / dpr, snapPx = (v) => Math.round(v / px) * px;
  const playPath = new Path2D(PLAY_PATH);

  const wrap = el('div', 'cp-vn');
  const cv = document.createElement('canvas');
  cv.className = 'cp-vn-bubble';
  cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.setAttribute('role', 'slider');
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', `Voice message, ${fmt(DURATION)}. Space to play, arrows to seek, Delete to unsend.`);
  cv.setAttribute('aria-valuemin', '0');
  cv.setAttribute('aria-valuemax', String(DURATION));
  wrap.append(cv);
  body.append(wrap);
  const ctx = cv.getContext('2d');

  let playing = false, engaged = false, gone = false;

  function draw(x = ctx) {
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);
    x.fillStyle = c.bubble;
    rr(x, 0, 0, W, H, 25); x.fill();
    // Button, pressed scale, play and pause cross-fading.
    x.save();
    x.translate(8 + BTN / 2, 8 + BTN / 2); x.scale(btn.v, btn.v); x.translate(-BTN / 2, -BTN / 2);
    x.fillStyle = c.button;
    x.beginPath(); x.arc(BTN / 2, BTN / 2, BTN / 2, 0, Math.PI * 2); x.fill();
    x.fillStyle = c.icon;
    const ic = icon.v;
    if (ic < 1) {
      x.save(); x.globalAlpha = 1 - ic;
      x.translate(BTN / 2, BTN / 2); x.scale(1 - 0.4 * ic, 1 - 0.4 * ic); x.translate(-BTN / 2, -BTN / 2);
      x.fill(playPath); x.restore();
    }
    if (ic > 0) {
      x.save(); x.globalAlpha = ic;
      const s = 0.6 + 0.4 * ic;
      x.translate(BTN / 2, BTN / 2); x.scale(s, s); x.translate(-BTN / 2, -BTN / 2);
      rr(x, 11.5, 10.5, 4, 13, 1.4); x.fill();
      rr(x, 18.5, 10.5, 4, 13, 1.4); x.fill();
      x.restore();
    }
    x.restore();
    // Waveform: unplayed bars, then the played part clipped to the progress.
    const wy = (H - WAVE_H) / 2;
    const used = count * (BAR + GAP) - GAP, x0 = snapPx((waveW - used) / 2);
    const path = new Path2D();
    bars.forEach((v, i) => {
      const h = snapPx(Math.max(BAR, v * WAVE_H));
      path.roundRect(waveX + x0 + i * (BAR + GAP), wy + snapPx((WAVE_H - h) / 2), BAR, h, BAR / 2);
    });
    x.save();
    x.translate(0, H / 2); x.scale(1, 1 + 0.14 * scrub.v); x.translate(0, -H / 2);
    x.fillStyle = c.unplayed; x.fill(path);
    x.beginPath(); x.rect(waveX, 0, progress.v * waveW, H); x.clip();
    x.fillStyle = c.played; x.fill(path);
    x.restore();
    const sec = Math.floor(progress.v * DURATION + 1e-4);
    x.font = `500 13px ${FONT}`;
    x.fillStyle = c.label;
    x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText(playing || engaged ? fmt(sec) : fmt(DURATION), W - 14, H / 2 + 0.5);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    cv.setAttribute('aria-valuenow', String(sec));
  }
  const render = () => draw();
  const progress = value(sc, 0, render);
  const icon = value(sc, 0, render);
  const scrub = value(sc, 0, render);
  const btn = value(sc, 1, render);
  const hold = value(sc, 0, () => { cv.style.transform = `scale(${(1 - 0.035 * hold.v).toFixed(4)})`; });
  render();

  const setPlaying = (v) => { playing = v; icon.to(v ? 1 : 0, 220, CALM); render(); };
  function ended() {
    setPlaying(false);
    progress.to(0, 420, CALM, 260).then((ok) => { if (ok) { engaged = false; render(); } });
  }
  function runPlayback() {
    const from = progress.v >= 0.999 ? 0 : progress.v;
    progress.set(from);
    progress.to(1, (1 - from) * DURATION * 1000, LINEAR).then((ok) => ok && ended());
  }
  const stopAt = () => progress.set(progress.v); // cancels the running timing
  function playNote() { if (gone) return; engaged = true; setPlaying(true); runPlayback(); }
  function pause() { stopAt(); setPlaying(false); }
  const toggle = () => (playing ? pause() : playNote());

  async function unsend() {
    if (gone) return;
    gone = true;
    stopAt();
    playing = false;
    icon.set(0);
    hold.to(0, 220, CALM);
    const r = rectOf(cv);
    const src = snapshot(W, H, (x) => x.drawImage(cv, 0, 0, W, H));
    cv.style.opacity = '0';
    await sc.track(play({ source: src, ...r, preset: 'dust', duration: 1300 })).done;
    if (!sc.alive) return;
    // On the web the note comes back, fresh, so the demo can be played again.
    await sc.wait(450);
    progress.set(0); engaged = false; scrub.set(0); btn.set(1); hold.set(0);
    render();
    await frame();
    await sc.track(play({ source: snapshot(W, H, (x) => x.drawImage(cv, 0, 0, W, H)), ...rectOf(cv), preset: 'gather', direction: 'in', duration: 900 })).done;
    if (!sc.alive) return;
    cv.style.opacity = '';
    gone = false;
  }

  /* ---- gestures: play button, tap or drag on the waveform, long press anywhere to unsend ---- */
  let lastBar = -1;
  function seekTo(clientX) {
    const b = cv.getBoundingClientRect(), s = b.width / W;
    const p = clamp(((clientX - b.left) / s - waveX) / waveW);
    progress.set(p);
    lastBar = Math.min(count - 1, Math.floor(p * count));
  }
  let g = null;
  cv.addEventListener('pointerdown', (e) => {
    if (gone || e.button > 0) return;
    const b = cv.getBoundingClientRect(), s = b.width / W;
    const lx = (e.clientX - b.left) / s;
    const region = lx <= 8 + BTN + 8 ? 'btn' : lx >= waveX - 4 && lx <= waveX + waveW + 4 ? 'wave' : null;
    g = { x0: e.clientX, y0: e.clientY, region, scrubbing: false, long: false, id: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch {}
    if (region === 'btn') btn.to(0.9, 120, CALM);
    hold.to(1, 480, OUT_QUAD);
    const my = g;
    g.timer = setTimeout(() => {
      if (g !== my || !sc.alive) return;
      my.long = true;
      btn.to(1, 260, CALM);
      unsend();
    }, 480);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!g || g.long) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (dx * dx + dy * dy > 100 && g.timer) { clearTimeout(g.timer); g.timer = 0; hold.to(0, 220, CALM); }
    if (g.region !== 'wave') return;
    if (!g.scrubbing) {
      if (Math.abs(dy) > 12) { g.region = null; return; }
      if (Math.abs(dx) <= 4) return;
      g.scrubbing = true;
      g.resume = playing;
      stopAt();
      lastBar = -1;
      engaged = true;
      scrub.to(1, 180, CALM);
    }
    seekTo(e.clientX);
  });
  const end = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    clearTimeout(st.timer);
    if (st.long) return;
    hold.to(0, 220, CALM);
    if (st.region === 'btn') { btn.to(1, 260, CALM); if (e.type === 'pointerup') toggle(); return; }
    if (st.scrubbing) {
      scrub.to(0, 260, CALM);
      if (st.resume) runPlayback();
      return;
    }
    if (st.region === 'wave' && e.type === 'pointerup') {
      const was = playing;
      stopAt();
      seekTo(e.clientX);
      engaged = true;
      render();
      if (was) runPlayback();
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('keydown', (e) => {
    if (gone) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const was = playing;
      stopAt();
      engaged = true;
      progress.set(clamp(progress.v + (e.key === 'ArrowRight' ? 1 : -1) / DURATION));
      if (was) runPlayback();
    } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); unsend(); }
  });

  return {
    async run() {
      if (gone) return;
      // Play, scrub ahead along the waveform, let it play on, pause, then hold to unsend.
      if (!playing) playNote();
      await sc.wait(1200);
      if (gone) return;
      const was = playing;
      stopAt(); engaged = true;
      scrub.to(1, 180, CALM);
      await progress.to(0.68, 520, QUAD);
      scrub.to(0, 260, CALM);
      if (was) runPlayback();
      await sc.wait(1000);
      if (gone) return;
      pause();
      await sc.wait(350);
      await hold.to(1, 480, OUT_QUAD);
      await unsend();
    },
  };
}

/* ======================================================================================
   SignaturePad (SignaturePad.tsx)
   ====================================================================================== */

/** Variable width outline of a stroke [x, y, w, ...] as one filled Path2D (native outline()). */
function outline(pts) {
  const path = new Path2D();
  const n = Math.floor(pts.length / 3);
  if (n === 0) return path;
  if (n === 1) { path.arc(pts[0], pts[1], pts[2] / 2, 0, Math.PI * 2); return path; }
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? n - 1 : i + 1;
    const dx = pts[b * 3] - pts[a * 3], dy = pts[b * 3 + 1] - pts[a * 3 + 1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len, hw = pts[i * 3 + 2] / 2;
    L.push(pts[i * 3] + nx * hw, pts[i * 3 + 1] + ny * hw);
    R.push(pts[i * 3] - nx * hw, pts[i * 3 + 1] - ny * hw);
  }
  const last = n - 1;
  path.moveTo(L[0], L[1]);
  for (let i = 1; i < last; i++) path.quadraticCurveTo(L[i * 2], L[i * 2 + 1], (L[i * 2] + L[i * 2 + 2]) / 2, (L[i * 2 + 1] + L[i * 2 + 3]) / 2);
  path.lineTo(L[last * 2], L[last * 2 + 1]);
  let ex = pts[last * 3] - pts[(last - 1) * 3], ey = pts[last * 3 + 1] - pts[(last - 1) * 3 + 1];
  let el2 = Math.sqrt(ex * ex + ey * ey) || 1, k = (pts[last * 3 + 2] / 2) * 1.333;
  ex = (ex / el2) * k; ey = (ey / el2) * k;
  path.bezierCurveTo(L[last * 2] + ex, L[last * 2 + 1] + ey, R[last * 2] + ex, R[last * 2 + 1] + ey, R[last * 2], R[last * 2 + 1]);
  for (let i = last - 1; i > 0; i--) path.quadraticCurveTo(R[i * 2], R[i * 2 + 1], (R[i * 2] + R[i * 2 - 2]) / 2, (R[i * 2 + 1] + R[i * 2 - 1]) / 2);
  path.lineTo(R[0], R[1]);
  ex = pts[0] - pts[3]; ey = pts[1] - pts[4];
  el2 = Math.sqrt(ex * ex + ey * ey) || 1; k = (pts[2] / 2) * 1.333;
  ex = (ex / el2) * k; ey = (ey / el2) * k;
  path.bezierCurveTo(R[0] + ex, R[1] + ey, L[0] + ex, L[1] + ey, L[0], L[1]);
  path.closePath();
  return path;
}

// A scripted signature for the demo, in a 300 x 100 box (baseline near 75): one flowing line, then a flourish.
const SIGNATURE = [
  [[20, 70], [30, 20], [60, 10], [55, 45], [50, 80], [20, 90], [40, 75], [60, 60], [80, 40], [95, 55], [105, 65], [100, 80], [115, 70], [130, 60], [135, 45], [150, 55], [160, 62], [158, 78], [172, 70], [190, 60], [200, 40], [215, 50], [228, 58], [220, 78], [240, 72], [260, 66], [270, 55], [290, 50]],
  [[60, 88], [120, 82], [200, 84], [270, 78]],
];

function sampleCubics(pts, steps = 18) {
  const out = [];
  for (let s = 0; s + 3 < pts.length; s += 3) {
    const [p0, p1, p2, p3] = [pts[s], pts[s + 1], pts[s + 2], pts[s + 3]];
    for (let j = s === 0 ? 0 : 1; j <= steps; j++) {
      const t = j / steps, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  }
  return out;
}

function padColors() {
  return isLight()
    ? { bg: '#FFFFFF', ink: '#1C1C1E', guide: '#C7C7CC', tool: '#F2F2F7', toolText: '#3A3A3C', line: 'rgba(0,0,0,0.08)' }
    : { bg: '#1E1E1E', ink: '#F2F2F7', guide: '#4A4A4E', tool: '#2C2C2E', toolText: '#E5E5EA', line: 'rgba(255,255,255,0.08)' };
}

function mountSignature(body, { sc, mode }) {
  const STROKE = 3.2;
  const c = padColors();
  const H = mode === 'tile' ? 160 : mode === 'panel' ? 180 : 200;
  const pad = el('div', 'cp-sig');
  pad.style.height = H + 'px';
  pad.style.background = c.bg;
  pad.style.boxShadow = `inset 0 0 0 1px ${c.line}`;
  pad.setAttribute('aria-label', 'Signature pad');
  const baseline = H * 0.7;
  const line = el('div', 'cp-sig-line');
  line.style.cssText = `top:${baseline}px;background:${c.guide}`;
  const cross = el('span', 'cp-sig-cross');
  cross.textContent = '×';
  cross.style.cssText = `top:${baseline - 26}px;color:${c.guide}`;
  const holder = el('span', 'cp-sig-holder');
  holder.textContent = 'Sign here';
  holder.style.cssText = `top:${baseline - 34}px;color:${c.guide}`;
  const inkBox = el('div', 'cp-sig-ink');
  const cv = document.createElement('canvas');
  inkBox.append(cv);
  const tools = el('div', 'cp-sig-tools');
  const mk = (txt, aria) => { const b = el('button', 'cp-sig-tool'); b.type = 'button'; b.textContent = txt; b.setAttribute('aria-label', aria); b.style.background = c.tool; b.style.color = c.toolText; tools.append(b); return b; };
  const undoBtn = mk('Undo', 'Undo last stroke');
  const clearBtn = mk('Clear', 'Clear signature');
  pad.append(line, cross, holder, inkBox, tools);
  body.append(pad);

  const W = Math.round(pad.clientWidth);
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');

  const strokes = [];
  let paths = [], cur = [], nib = STROKE, clearing = false;
  const draw = (x = ctx, scale = dpr) => {
    x.setTransform(scale, 0, 0, scale, 0, 0);
    x.clearRect(0, 0, W, H);
    x.fillStyle = c.ink;
    paths.forEach((p) => x.fill(p));
    if (cur.length) x.fill(outline(cur));
  };
  const ink = value(sc, 0, () => {
    holder.style.opacity = (1 - ink.v).toFixed(3);
    holder.style.transform = `translateY(${(ink.v * -4).toFixed(2)}px)`;
  });
  const tool = value(sc, 0, () => {
    tools.style.opacity = tool.v.toFixed(3);
    tools.style.transform = `translateY(${((1 - tool.v) * -4).toFixed(2)}px)`;
  });
  ink.set(0); tool.set(0);
  const sync = () => {
    const has = strokes.length > 0;
    ink.to(has || cur.length ? 1 : 0, 280, CALM);
    tool.to(has ? 1 : 0, 280, CALM);
    tools.classList.toggle('on', has);
    undoBtn.tabIndex = clearBtn.tabIndex = has ? 0 : -1;
  };
  sync();

  // Pen input: same thresholds and nib dynamics as the native pan.
  function begin(x, y) {
    nib = STROKE * 0.75;
    cur = [x, y, nib];
    ink.to(1, 220, CALM);
    draw();
  }
  function move(x, y, speed) {
    const n = cur.length;
    if (!n) return;
    const dx = x - cur[n - 3], dy = y - cur[n - 2];
    if (dx * dx + dy * dy < 2.25) return;
    const target = Math.min(STROKE * 1.45, Math.max(STROKE * 0.42, STROKE * (1.45 - speed / 1700)));
    nib += (target - nib) * 0.22;
    cur.push(x, y, nib);
    draw();
  }
  function commit() {
    if (!cur.length) return;
    const out = cur.slice();
    if (out.length >= 6) out[out.length - 1] *= 0.5; // lift the pen: taper the last point
    strokes.push(out);
    paths.push(outline(out));
    cur = [];
    draw();
    sync();
  }

  let g = null;
  const local = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * (W / b.width), (e.clientY - b.top) * (H / b.height)]; };
  cv.addEventListener('pointerdown', (e) => {
    if (clearing || g || e.button > 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch {}
    const [x, y] = local(e);
    g = { id: e.pointerId, t: e.timeStamp, x, y, v: 0 };
    begin(x, y);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const list = e.getCoalescedEvents?.() ?? [e];
    for (const ev of (list.length ? list : [e])) {
      const [x, y] = local(ev);
      const dt = Math.max(1, ev.timeStamp - g.t);
      const inst = (Math.hypot(x - g.x, y - g.y) / dt) * 1000;
      // Pointer velocity, lightly smoothed like the gesture handler's estimate.
      g.v = g.v ? g.v * 0.6 + inst * 0.4 : inst;
      g.t = ev.timeStamp; g.x = x; g.y = y;
      move(x, y, g.v);
    }
  });
  const up = (e) => { if (!g || e.pointerId !== g.id) return; g = null; commit(); };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  function undo() {
    if (clearing) return;
    cur = [];
    strokes.pop(); paths.pop();
    draw(); sync();
  }
  async function clear() {
    if (clearing || !strokes.length) return;
    clearing = true;
    // Transparent snapshot of the ink only: the line and the paper stay, the signature blows away.
    const src = snapshot(W, H, (x) => { x.fillStyle = c.ink; paths.forEach((p) => x.fill(p)); });
    const r = rectOf(cv);
    const h = sc.track(play({ source: src, ...r, preset: 'dust', origin: 'left', duration: 1200 }));
    await frame(); await frame();
    inkBox.style.opacity = '0';
    await sc.wait(1200 * 0.35);
    strokes.length = 0; paths = []; cur = [];
    draw(); sync();
    await frame(); await frame();
    inkBox.style.opacity = '';
    clearing = false;
    return h.done;
  }
  undoBtn.addEventListener('click', undo);
  clearBtn.addEventListener('click', () => clear());

  return {
    async run() {
      if (clearing || g) return;
      if (strokes.length) { await clear(); await sc.wait(500); }
      // Write the scripted signature at a hand's pace, then clear it into dust.
      const s = Math.min((W - 60) / 300, (H * 0.6) / 100);
      const ox = (W - 300 * s) / 2, oy = baseline - 75 * s;
      for (const stroke of SIGNATURE) {
        const pts = sampleCubics(stroke).map(([x, y]) => [ox + x * s, oy + y * s]);
        let i = 0, t = performance.now(), px = pts[0][0], py = pts[0][1], v = 0;
        begin(px, py);
        while (i < pts.length - 1 && sc.alive) {
          await frame();
          const now = performance.now(), dt = Math.max(1, now - t);
          t = now;
          // About 520 px/s, faster in the long runs, slower in the turns.
          const step = Math.max(2, Math.round((dt / 1000) * 520 / 6));
          for (let k = 0; k < step && i < pts.length - 1; k++) {
            i++;
            const [x, y] = pts[i];
            const inst = (Math.hypot(x - px, y - py) / (dt / step)) * 1000;
            v = v ? v * 0.6 + inst * 0.4 : inst;
            px = x; py = y;
            move(x, y, v);
          }
        }
        commit();
        await sc.wait(160);
      }
      await sc.wait(900);
      await clear();
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'reaction-picker': {
    title: 'ReactionPicker',
    note: 'Long press, slide to an emoji, it flies to the corner.',
    desc: 'iMessage style reactions. Long press a bubble: it lifts, a pill of emojis grows out of the press point. Slide across and the emoji under the finger magnifies like the Dock. Release on one to pick it, it flies to the bubble corner. Pick the same one again and the badge snaps into grains.',
    hint: 'Long press, slide to an emoji',
    tileHint: 'Hold it',
    mount: mountReaction,
    remountOnTheme: true,
    code: `// npx ${PKG} add reaction-picker
import { useState } from 'react';
import { ReactionPicker } from '${DIR}/reaction-picker';

export function Message({ text }) {
  const [reaction, setReaction] = useState(null);

  return (
    <ReactionPicker
      selected={reaction}
      onReact={(e) => setReaction(e === reaction ? null : e)}
    >
      <Bubble text={text} />
    </ReactionPicker>
  );
}`,
    props: [
      prop('children', 'ReactNode', 'required', 'The bubble. It lifts while the picker is open.'),
      prop('onReact', '(emoji: string) =&gt; void', 'required', 'Called with the chosen emoji. Picking the current one again is your cue to remove it.'),
      prop('reactions', 'string[]', `['❤️', '😂', '😮', '😢', '👍', '🔥']`, 'Emojis offered in the pill.'),
      prop('selected', 'string | null', '', 'Current reaction, shown as a badge on the bubble corner.'),
      prop('corner', `'top-left' | 'top-right'`, `'top-right'`, 'Corner the badge sits on. Use top-left for your own bubbles.'),
      prop('insets', '{ top?, bottom? }', '{ top: 60, bottom: 34 }', 'Space kept free at the top and bottom of the window (safe area).'),
      prop('disabled', 'boolean', 'false', 'Turns the long press off.'),
      prop('haptics', 'boolean', 'true', 'Medium impact on open, a tick per emoji crossed, light impact on pick.'),
      prop('className', 'string', '', 'Wrapper: margins, alignment.'),
      prop('pillClassName', 'string', '', 'Emoji pill: background, border, shadow.'),
      prop('badgeClassName', 'string', '', 'Badge disc, also used by the emoji flying to the bubble.'),
      prop('backdropClassName', 'string', 'transparent', 'Layer over the screen while the picker is open, e.g. <code>bg-black/20</code> to dim.'),
    ],
  },
  'voice-note': {
    title: 'VoiceNote',
    note: 'Scrub the waveform, long press to unsend into dust.',
    desc: 'A voice message bubble. Play and pause, the played part of the waveform takes the ink, drag along it to seek. Long press to unsend: the bubble blows away as dust. No audio dependency, playback is a timer you hook to your player.',
    hint: 'Play, scrub, hold to unsend',
    tileHint: 'Play or hold',
    mount: mountVoice,
    remountOnTheme: true,
    code: `// npx ${PKG} add voice-note
import { VoiceNote } from '${DIR}/voice-note';

<VoiceNote
  mine
  duration={9}
  seed="msg-42"
  onPlay={() => player.play()}
  onPause={() => player.pause()}
  onUnsend={() => remove(id)}
/>`,
    props: [
      prop('duration', 'number', 'required', 'Length of the note in seconds. Playback is simulated with a timer.'),
      prop('levels', 'number[]', '', 'Loudness per sample, 0 to 1. Resampled to the number of bars that fit.'),
      prop('seed', 'number | string', '1', 'Generates a deterministic, speech like waveform when levels is not given.'),
      prop('mine', 'boolean', 'false', 'Your own message: accent bubble with white content. Otherwise a surface bubble.'),
      prop('width', 'number', '248', 'Bubble width.'),
      prop('onPlay / onPause / onEnd', '() =&gt; void', '', 'Hook your audio player here.'),
      prop('onUnsend', '() =&gt; void', '', 'Called once the bubble has dissolved: remove it from your data here.'),
      prop('unsent', 'boolean', 'false', 'Flip to true to unsend from outside (a menu, a swipe).'),
      prop('unsendOnLongPress', 'boolean', 'true with onUnsend', 'Long press the bubble (480 ms) to unsend.'),
      prop('preset', 'VariantName', `'dust'`, 'Exit used when the note is unsent.'),
      prop('haptics', 'boolean', 'true', 'Light impact on play, a tick per bar while seeking.'),
      prop('className', 'string', '', 'Bubble: background, radius, padding.'),
      prop('buttonClassName', 'string', '', 'Play and pause button.'),
      prop('labelClassName', 'string', '', 'Time label.'),
    ],
  },
  'signature-pad': {
    title: 'SignaturePad',
    note: 'Sign with your finger, clear it to dust.',
    desc: 'Sign with your finger or a mouse. Ink is drawn as variable width strokes, thick when slow and thin when fast, with tapered ends, on a signing line whose placeholder fades as you start. Undo removes the last stroke, Clear turns the signature into dust and leaves the paper.',
    hint: 'Sign in the pad, then Clear',
    tileHint: 'Sign it',
    mount: mountSignature,
    remountOnTheme: true,
    code: `// npx ${PKG} add signature-pad
import { useRef } from 'react';
import { SignaturePad, type SignaturePadHandle } from '${DIR}/signature-pad';

export function Sign() {
  const pad = useRef<SignaturePadHandle>(null);

  return (
    <SignaturePad
      ref={pad}
      placeholder="Sign here"
      onChange={setSigned}
      onSave={({ base64 }) => upload(base64)}
    />
  );
}

// pad.current?.save(), pad.current?.clear() dissolves the ink`,
    props: [
      prop('strokeColor', 'string', 'foreground token', 'Ink color, also used for the exported PNG.'),
      prop('strokeWidth', 'number', '3.2', 'Base nib width. Slow strokes get thicker, fast ones thinner.'),
      prop('onChange', '(hasSignature: boolean) =&gt; void', '', 'Called when the pad goes from empty to signed and back.'),
      prop('onSave', '(signature: SignatureExport) =&gt; void', '', 'Receives the image, a base64 PNG and its size, from save().'),
      prop('placeholder', 'string', `'Sign here'`, 'Shown above the line, fades once you start.'),
      prop('height', 'number', '200', 'Pad height.'),
      prop('exportBackground', 'string', 'transparent', 'Background of the exported PNG.'),
      prop('controls', 'boolean', 'true', 'Built in Undo and Clear pills.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on undo, dust haptics on clear.'),
      prop('className', 'string', `'rounded-[20px] bg-dissolve-surface'`, 'Pad: background, radius, border.'),
      prop('guideClassName', 'string', `'bg-dissolve-border'`, 'Signing line.'),
      prop('placeholderClassName', 'string', `'text-dissolve-muted'`, 'Placeholder and x mark.'),
      prop('controlClassName', 'string', `'rounded-full bg-dissolve-surface-2'`, 'Undo and Clear pills.'),
      prop('ref', 'Ref&lt;SignaturePadHandle&gt;', '', '<code>undo()</code>, <code>clear()</code>, <code>isEmpty()</code>, <code>toImage()</code>, <code>save()</code>.'),
    ],
  },
};
