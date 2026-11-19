/**
 * ReactionPicker for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (reaction-picker.tsx) wraps it; it also runs on its own:
 *
 *   const picker = createReactionPicker(el, { onReact: (e) => picker.update({ selected: e }) });
 *   picker.slot.append(bubble);
 *
 * While open, the picker lays a layer over the page: a copy of the bubble lifted from where it
 * sits, the emoji pill, the emoji flying to the corner. Emojis are painted on canvases with their
 * ink centered, so they line up the same in every font. Same springs, timings and geometry as the
 * React Native version; the pill, the badge and the backdrop follow the --dissolve-* tokens.
 */
import { play, snapshot } from './engine';
import { CALM, QUAD, clamp, el, fontOf, injectStyle, propsOf, rectOf, reducedMotion, scope, value, vibrate, type Ease, type Value } from './kit';

export type ReactionCorner = 'top-left' | 'top-right';

export type ReactionPickerProps = {
  /** Called with the chosen emoji. Picking the current one again is your cue to remove it. */
  onReact?: (emoji: string) => void;
  /** Emojis offered in the pill. Default ❤️ 😂 😮 😢 👍 🔥. */
  reactions?: string[];
  /** Current reaction, shown as a badge on the bubble corner. */
  selected?: string | null;
  /** Corner the badge sits on. Default 'top-right' (use 'top-left' for your own bubbles). */
  corner?: ReactionCorner;
  /** Space kept free at the top and bottom of the window. Default { top: 60, bottom: 34 }. */
  insets?: { top?: number; bottom?: number };
  /** Turns the long press off. Default false. */
  disabled?: boolean;
  /** A buzz on open, a tick per emoji crossed and on pick, where the browser has it. Default true. */
  haptics?: boolean;
  /** Emoji pill classes (background, border, shadow...). */
  pillClassName?: string;
  /** Badge disc classes, also used by the emoji flying to the bubble. */
  badgeClassName?: string;
  /** Layer over the page while the picker is open. Transparent by default, e.g. a dim. */
  backdropClassName?: string;
};

export type ReactionPickerInstance = {
  /** The bubble goes here. It lifts while the picker is open. */
  slot: HTMLElement;
  update: (props: Partial<ReactionPickerProps>) => void;
  destroy: () => void;
};

export const DEFAULT_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

const DEFAULTS = { reactions: DEFAULT_REACTIONS, selected: null as string | null, corner: 'top-right' as ReactionCorner, disabled: false, haptics: true };

/** Critically damped lift, a hair of give so the bubble feels picked up. */
const LIFT = { damping: 26, stiffness: 340, mass: 0.9, eps: 0.002 };
/** The pill opens almost without overshoot, the emojis inside pop (tiny elements). */
const OPEN = { damping: 26, stiffness: 320, mass: 0.9, eps: 0.002 };
const POP = { damping: 15, stiffness: 420, mass: 0.7, eps: 0.002 };
const SLOT = 44, PAD = 6, PILL_H = 52, EMOJI = 30, BADGE = 28, HOLD = 320;
/** How far above and below the pill the pointer still drives the magnifier. */
const BAND_UP = 70, BAND_DOWN = 46;
const MAG = 0.72, RISE = 16, EDGE = 10;
const OUT_QUAD: Ease = (t) => 1 - (1 - t) * (1 - t);

const CSS = `
:where([data-dissolve="reaction-picker"]) { position: relative; }
:where(.dissolve-reaction-target) {
  cursor: pointer; will-change: transform; touch-action: pan-y;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}
:where(.dissolve-reaction-badge) { position: absolute; width: ${BADGE}px; height: ${BADGE}px; pointer-events: none; }
:where(.dissolve-reaction-disc) {
  box-sizing: border-box; width: ${BADGE}px; height: ${BADGE}px; border-radius: 50%;
  background: var(--dissolve-background, rgb(255 255 255)); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}
:where(.dissolve-reaction-badge) canvas { position: absolute; left: 0; top: 0; }
:where(.dissolve-reaction-layer) { position: fixed; inset: 0; z-index: var(--dissolve-modal-z, 1000); }
:where(.dissolve-reaction-backdrop) { position: absolute; inset: 0; opacity: 0; }
:where(.dissolve-reaction-clone) { position: fixed; pointer-events: none; transform-origin: 50% 50%; will-change: transform; }
:where(.dissolve-reaction-clone > :first-child) { box-shadow: 0 8px 18px rgba(0, 0, 0, calc(0.16 * var(--dissolve-lift, 0))); }
:where(.dissolve-reaction-pill) {
  position: fixed; box-sizing: border-box; height: ${PILL_H}px; border-radius: ${PILL_H / 2}px; padding: 0 ${PAD}px;
  display: flex; align-items: center; transform-origin: 50% 50%; opacity: 0;
  background: var(--dissolve-background, rgb(255 255 255));
  box-shadow: 0 10px 44px rgba(0, 0, 0, 0.14), inset 0 0 0 0.5px var(--dissolve-border, rgb(60 60 67 / 0.12));
  touch-action: none; user-select: none; -webkit-user-select: none; will-change: transform, opacity;
}
button:where(.dissolve-reaction-option) {
  position: relative; width: ${SLOT}px; height: ${PILL_H}px; display: grid; place-items: center;
  margin: 0; padding: 0; border: 0; background: none; -webkit-tap-highlight-color: transparent;
}
button:where(.dissolve-reaction-option):focus-visible { outline-offset: -4px; border-radius: 14px; }
:where(.dissolve-reaction-current) { position: absolute; width: 38px; height: 38px; border-radius: 50%; background: var(--dissolve-surface, rgb(242 242 247)); }
:where(.dissolve-reaction-emoji) { position: relative; display: block; width: ${SLOT}px; height: ${SLOT}px; pointer-events: none; will-change: transform, opacity; }
:where(.dissolve-reaction-fly) { position: fixed; left: 0; top: 0; width: ${BADGE}px; height: ${BADGE}px; pointer-events: none; }
:where(.dissolve-reaction-fly) > :where(.dissolve-reaction-disc) { position: absolute; inset: 0; opacity: 0; }
:where(.dissolve-reaction-fly-emoji) { position: absolute; left: ${(BADGE - SLOT) / 2}px; top: ${(BADGE - SLOT) / 2}px; width: ${SLOT}px; height: ${SLOT}px; }
`;

/** Weight of emoji i under a pointer at local x (dock curve). */
const weight = (i: number, lx: number, hover: number) => {
  const d = (lx - (PAD + i * SLOT + SLOT / 2)) / SLOT;
  return hover * Math.exp(-d * d * 1.25);
};

/**
 * Ink box of an emoji, found by scanning the pixels of an offscreen render: font metrics describe
 * the em box, not where color emoji glyphs actually paint. Cached per emoji, size and font.
 */
const INK = new Map<string, { cx: number; cy: number }>();
function inkBox(emoji: string, size: number, font: string) {
  const key = `${emoji} ${size} ${font}`;
  const hit = INK.get(key);
  if (hit) return hit;
  // Rendered at 3x for sub pixel precision, then expressed back in CSS pixels.
  const Q = 3, S = Math.ceil(size * 2.4 * Q), o = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `${size * Q}px ${font}`;
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

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, size: number, cx: number, cy: number, font: string) {
  const b = inkBox(emoji, size, font);
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(emoji, cx - b.cx, cy - b.cy);
}

/** An emoji as a canvas of box x box px, ink centered, so it lines up identically everywhere. */
function emojiCanvas(emoji: string, size: number, box: number, font: string) {
  const cv = snapshot(box, box, (ctx) => drawEmoji(ctx, emoji, size, box / 2, box / 2, font));
  cv.style.width = cv.style.height = box + 'px';
  cv.style.display = 'block';
  return cv;
}

type Overlay = {
  root: HTMLElement;
  back: HTMLElement;
  clone: HTMLElement;
  pill: HTMLElement;
  emojis: HTMLElement[];
  reactions: string[];
  pillW: number;
  pill0: { x: number; y: number };
  box: { x: number; y: number; width: number; height: number };
  press: { x: number; y: number };
};

/**
 * iMessage style reactions on the bubble put in slot. Long press it: it lifts, a pill of emojis
 * grows out of the press point. Keep the pointer down and slide across: the emoji under it
 * magnifies like the Dock. Release on one to pick it, it flies to the bubble corner. Release
 * elsewhere to cancel, or release without moving and tap an emoji.
 */
export function createReactionPicker(host: HTMLElement, initial: ReactionPickerProps = {}): ReactionPickerInstance {
  injectStyle('dissolve-reaction-picker', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const font = fontOf(host);

  host.dataset.dissolve = 'reaction-picker';
  const slot = el('div', 'dissolve-reaction-target');
  slot.setAttribute('role', 'button');
  slot.setAttribute('aria-haspopup', 'menu');
  slot.setAttribute('aria-description', 'Long press to react');
  slot.tabIndex = 0;
  const badgeBox = el('div', 'dissolve-reaction-badge');
  host.append(slot, badgeBox);

  let open: Overlay | null = null, busy = false, quiet = false;

  const discClass = () => 'dissolve-reaction-disc' + (p().badgeClassName ? ' ' + p().badgeClassName : '');
  const corner = (node: HTMLElement) => {
    const right = p().corner === 'top-right';
    node.style.left = right ? '' : -BADGE * 0.35 + 'px';
    node.style.right = right ? -BADGE * 0.35 + 'px' : '';
    node.style.top = -BADGE * 0.6 + 'px';
  };
  /** A badge disc with the emoji on it. */
  const disc = (emoji: string) => {
    const d = el('div', discClass());
    d.append(emojiCanvas(emoji, 16, BADGE, font));
    return d;
  };

  /* ---- badge ---- */
  let badge: HTMLElement | null = null;
  const badgeScale = value(sc, 0, () => { badgeBox.style.transform = `scale(${Math.max(0, badgeScale.v).toFixed(4)})`; });
  function setBadge(emoji: string | null) {
    if (emoji) {
      badge?.remove();
      badge = disc(emoji);
      badgeBox.append(badge);
      if (quiet) { quiet = false; badgeScale.set(1); } else { badgeScale.set(0.3); badgeScale.spring(1, POP); }
      return;
    }
    if (!badge) return;
    const gone = badge;
    badge = null;
    const done = () => { gone.remove(); if (!badge) badgeScale.set(0); };
    if (reducedMotion()) { done(); return; }
    const r = rectOf(gone), bg = getComputedStyle(gone).backgroundColor, glyph = gone.firstElementChild as HTMLCanvasElement;
    const src = snapshot(r.w, r.h, (x) => {
      x.fillStyle = bg;
      x.beginPath(); x.arc(r.w / 2, r.h / 2, r.w / 2, 0, Math.PI * 2); x.fill();
      x.drawImage(glyph, 0, 0, r.w, r.h);
    });
    gone.style.opacity = '0';
    sc.track(play({ source: src, ...r, preset: 'snap', duration: 700, grain: 1.5 })).done.then(done);
  }

  /* ---- overlay: backdrop, lifted copy, pill, flying emoji ---- */
  const press = value(sc, 0, () => { slot.style.transform = press.v ? `scale(${(1 - 0.03 * press.v).toFixed(4)})` : ''; });

  function build(box: Overlay['box'], at: Overlay['press']): Overlay {
    const { reactions, selected, insets, pillClassName, backdropClassName } = p();
    const pillW = reactions.length * SLOT + PAD * 2;
    // Room comes from the window: above the bubble, flipped below when there is none, clamped.
    const top = insets?.top ?? 60, bottom = insets?.bottom ?? 34, gap = 10 + BADGE * 0.55;
    const below = box.y - gap - PILL_H < top;
    let y = below ? box.y + box.height + 12 : box.y - gap - PILL_H;
    y = Math.max(top, Math.min(y, innerHeight - bottom - PILL_H));
    let x = box.x + box.width / 2 < innerWidth / 2 ? box.x : box.x + box.width - pillW;
    x = Math.max(EDGE, Math.min(x, innerWidth - EDGE - pillW));

    const root = el('div', 'dissolve-reaction-layer');
    const back = el('div', 'dissolve-reaction-backdrop' + (backdropClassName ? ' ' + backdropClassName : ''));
    const clone = slot.cloneNode(true) as HTMLElement;
    clone.className = 'dissolve-reaction-clone';
    for (const a of ['role', 'tabindex', 'aria-haspopup', 'aria-description']) clone.removeAttribute(a);
    clone.setAttribute('aria-hidden', 'true');
    clone.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
    if (selected) {
      const b = el('div', 'dissolve-reaction-badge');
      corner(b);
      b.append(disc(selected));
      clone.append(b);
    }
    const pill = el('div', 'dissolve-reaction-pill' + (pillClassName ? ' ' + pillClassName : ''));
    Object.assign(pill.style, { left: x + 'px', top: y + 'px', width: pillW + 'px' });
    pill.setAttribute('role', 'menu');
    const emojis = reactions.map((r, i) => {
      const option = el('button', 'dissolve-reaction-option');
      option.type = 'button';
      option.setAttribute('role', 'menuitem');
      option.setAttribute('aria-label', `React ${r}`);
      if (r === selected) option.append(el('span', 'dissolve-reaction-current'));
      const e = el('span', 'dissolve-reaction-emoji');
      e.append(emojiCanvas(r, EMOJI, SLOT, font));
      option.append(e);
      option.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(i); } });
      pill.append(option);
      return e;
    });
    root.append(back, clone, pill);
    document.body.append(root);
    return { root, back, clone, pill, emojis, reactions: reactions.slice(), pillW, pill0: { x, y }, box, press: at };
  }

  // Overlay state, rendered in one place.
  let lx = 0, hot = -1, chosen = -1, ready = false, picking = false;
  let flying: { node: HTMLElement; disc: HTMLElement; emoji: HTMLElement; from: { x: number; y: number }; to: { x: number; y: number }; s0: number } | null = null;
  const pops: Value[] = [];
  const lift = value(sc, 0, render);
  const menu = value(sc, 0, render);
  const back = value(sc, 0, render);
  const hover = value(sc, 0, render);
  const fly = value(sc, 0, render);
  const popOf = (i: number) => {
    while (pops.length <= i) pops.push(value(sc, 0, render));
    return pops[i];
  };

  function render() {
    if (!open) return;
    open.back.style.opacity = back.v.toFixed(3);
    open.clone.style.transform = `scale(${(0.97 + 0.05 * lift.v).toFixed(4)})`;
    open.clone.style.setProperty('--dissolve-lift', lift.v.toFixed(3));
    const m = menu.v;
    const ox = open.press.x - (open.pill0.x + open.pillW / 2), oy = open.press.y - (open.pill0.y + PILL_H / 2);
    open.pill.style.opacity = clamp(m * 2.5).toFixed(3);
    open.pill.style.transform = `translate(${(ox * (1 - m)).toFixed(2)}px,${(oy * (1 - m)).toFixed(2)}px) scale(${(0.2 + 0.8 * m).toFixed(4)})`;
    open.emojis.forEach((e, i) => {
      const w = weight(i, lx, hover.v), k = popOf(i).v;
      e.style.opacity = chosen === i ? '0' : clamp(k * 2).toFixed(3);
      e.style.transform = `translateY(${(-RISE * w + (1 - k) * 8).toFixed(2)}px) scale(${(Math.max(0, k) * (1 + MAG * w)).toFixed(4)})`;
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

  function openAt(px: number, py: number, keyboard = false) {
    if (busy || !sc.alive) return;
    busy = true;
    if (p().haptics) vibrate(10);
    const r = rectOf(slot);
    // The pressed scale is dropped before measuring.
    const s = 1 - 0.03 * press.v, fw = r.w / s, fh = r.h / s;
    const o = build({ x: r.x + r.w / 2 - fw / 2, y: r.y + r.h / 2 - fh / 2, width: fw, height: fh }, { x: px, y: py });
    open = o;
    chosen = -1; hot = -1; lx = 0; flying = null;
    [lift, menu, back, hover, fly, ...pops].forEach((v) => v.set(0));
    ready = true;
    slot.style.opacity = badgeBox.style.opacity = '0';
    press.set(0);
    lift.spring(1, LIFT);
    back.to(1, 260, CALM);
    menu.spring(1, OPEN);
    o.emojis.forEach((_, i) => sc.wait(40 + i * 24).then(() => open === o && popOf(i).spring(1, POP)));
    o.back.addEventListener('pointerdown', (e) => { if (e.target === o.back) cancel(); });
    o.pill.addEventListener('pointerdown', (e) => {
      if (!ready) return;
      e.preventDefault();
      try { o.pill.setPointerCapture(e.pointerId); } catch { /* synthetic pointers cannot be captured */ }
      picking = true;
      track(e.clientX, e.clientY);
    });
    o.pill.addEventListener('pointermove', (e) => { if (picking) track(e.clientX, e.clientY); });
    o.pill.addEventListener('pointerup', () => { if (!picking) return; picking = false; if (hot >= 0) choose(hot); });
    o.pill.addEventListener('pointercancel', () => { picking = false; });
    if (keyboard) o.pill.querySelector('button')?.focus({ preventScroll: true });
  }

  /** Pointer position (window coords) to magnifier state, with a tick per change. */
  function track(x: number, y: number) {
    if (!ready || !open) return;
    const px = x - open.pill0.x, py = y - open.pill0.y;
    const inside = py > -BAND_UP && py < PILL_H + BAND_DOWN && px > -SLOT * 0.4 && px < open.pillW + SLOT * 0.4;
    lx = Math.max(PAD + SLOT / 2, Math.min(px, open.pillW - PAD - SLOT / 2));
    const next = inside ? Math.max(0, Math.min(open.reactions.length - 1, Math.floor((px - PAD) / SLOT))) : -1;
    if (next !== hot) {
      if (next >= 0 && p().haptics) vibrate(4);
      hover.to(next >= 0 ? 1 : 0, 140, QUAD);
      hot = next;
    }
    render();
  }

  function finish() {
    ready = false;
    const refocus = !!open?.root.contains(document.activeElement);
    open?.root.remove();
    open = null;
    flying = null;
    hot = -1;
    slot.style.opacity = badgeBox.style.opacity = '';
    busy = false;
    if (refocus) slot.focus({ preventScroll: true });
  }

  function close(after?: () => void) {
    ready = false;
    hover.to(0, 160, QUAD);
    menu.to(0, 220, CALM);
    back.to(0, 260, CALM);
    lift.to(0, 280, CALM).then((ok) => ok && finish());
    if (after) sc.wait(320).then(after);
  }
  const cancel = () => close();

  function choose(i: number) {
    const o = open;
    if (!o || i < 0 || i >= o.reactions.length || chosen >= 0) return;
    const emoji = o.reactions[i];
    if (p().haptics) vibrate(6);
    // Same emoji again: no flight, the badge leaves as dust once the overlay is gone.
    if (emoji === p().selected) { close(() => p().onReact?.(emoji)); return; }
    const w = weight(i, lx, hover.v);
    const { box } = o;
    const from = { x: o.pill0.x + PAD + i * SLOT + SLOT / 2, y: o.pill0.y + PILL_H / 2 - RISE * w };
    const to = { x: p().corner === 'top-right' ? box.x + box.width - BADGE * 0.15 : box.x + BADGE * 0.15, y: box.y - BADGE * 0.1 };
    chosen = i;
    ready = false;
    quiet = true;
    const node = el('div', 'dissolve-reaction-fly');
    const d = el('div', discClass());
    const em = el('div', 'dissolve-reaction-fly-emoji');
    em.append(emojiCanvas(emoji, EMOJI, SLOT, font));
    node.append(d, em);
    o.root.append(node);
    flying = { node, disc: d, emoji: em, from, to, s0: 1 + MAG * w };
    p().onReact?.(emoji);
    hover.to(0, 200, QUAD);
    menu.to(0, 260, CALM, 60);
    back.to(0, 420, CALM);
    lift.to(0, 440, CALM);
    fly.to(1, 480, CALM).then((ok) => ok && finish());
  }

  /* ---- the long press on the bubble ---- */
  type Hold = { x0: number; y0: number; x: number; y: number; id: number; active: boolean; moved: boolean; timer: ReturnType<typeof setTimeout> | 0 };
  let g: Hold | null = null;
  const onDown = (e: PointerEvent) => {
    if (busy || e.button > 0 || p().disabled) return;
    const my: Hold = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, active: false, moved: false, timer: 0 };
    g = my;
    press.to(1, HOLD, OUT_QUAD);
    my.timer = setTimeout(() => {
      if (g !== my || !sc.alive) return;
      my.active = true;
      try { slot.setPointerCapture(my.id); } catch { /* synthetic pointers cannot be captured */ }
      openAt(my.x, my.y);
    }, HOLD);
  };
  const onMove = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    g.x = e.clientX; g.y = e.clientY;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.active) {
      // Moving before the hold is a scroll, not a press.
      if (dx * dx + dy * dy > 100) { clearTimeout(g.timer); g = null; press.to(0, 220, CALM); }
      return;
    }
    if (dx * dx + dy * dy > 196) g.moved = true;
    track(e.clientX, e.clientY);
  };
  const onRelease = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    const st = g;
    g = null;
    clearTimeout(st.timer);
    if (!st.active) { press.to(0, 220, CALM); return; }
    if (hot >= 0) choose(hot);
    else if (st.moved) cancel();
    // Released without moving: the picker stays open for a tap.
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !busy && !p().disabled) {
      e.preventDefault();
      const r = rectOf(slot);
      openAt(r.x + r.w / 2, r.y + r.h / 2, true);
    }
  };
  const noMenu = (e: Event) => e.preventDefault();
  slot.addEventListener('pointerdown', onDown);
  slot.addEventListener('pointermove', onMove);
  slot.addEventListener('pointerup', onRelease);
  slot.addEventListener('pointercancel', onRelease);
  slot.addEventListener('contextmenu', noMenu);
  slot.addEventListener('keydown', onKeyDown);
  const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && ready) cancel(); };
  const onScroll = () => { if (ready) cancel(); };
  addEventListener('keydown', onEscape);
  addEventListener('scroll', onScroll, { passive: true });
  sc.onDispose(() => {
    removeEventListener('keydown', onEscape);
    removeEventListener('scroll', onScroll);
    clearTimeout(g?.timer);
    open?.root.remove();
  });

  corner(badgeBox);
  if (p().selected) { quiet = true; setBadge(p().selected); } else badgeScale.set(0);

  return {
    slot,
    update(next) {
      const changed = props.update(next);
      if (changed.has('corner')) corner(badgeBox);
      if (changed.has('badgeClassName') && badge) badge.className = discClass();
      if (changed.has('selected')) setBadge(p().selected);
    },
    destroy() {
      sc.dispose();
      slot.remove();
      badgeBox.remove();
      delete host.dataset.dissolve;
    },
  };
}
