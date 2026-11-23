/**
 * RangeSlider for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (range-slider.tsx) wraps it; it also runs on its own:
 *
 *   const s = createRangeSlider(el, { min: 0, max: 1000, step: 10, defaultValue: [120, 640], prefix: '$' });
 *   s.update({ value: [200, 500] });
 *
 * A dual handle range slider. Drag either handle (mouse or touch), or press the track and the
 * nearest handle jumps there. The handles never cross, the track fills between them, and while
 * you drag both values roll in bubbles above the handles (NumberTicker, from dissolve); bubbles
 * that would touch slide apart. With a step, the handles snap from step to step on a quick
 * spring, tick dots show under the track (up to 40) and each step gives a short vibration where
 * the browser has one. Keyboard on each handle: arrows by a step, Page Up and Page Down by a
 * tenth, Home and End to the ends. Reduced motion: no springs, the bubbles only fade.
 * Colors follow --dissolve-foreground, --dissolve-surface-2, --dissolve-primary(-foreground).
 */
import { createNumberTicker, type NumberTickerInstance } from './number-ticker.core';
import { el, injectStyle, propsOf, reducedMotion, scope, value, vibrate } from './kit';

export type RangeValue = [number, number];

export type RangeSliderProps = {
  /** The range, controlled: [low, high]. */
  value?: RangeValue;
  /** The range when uncontrolled. Default: [min, max]. */
  defaultValue?: RangeValue;
  /** Called with the stepped range while dragging, every time it changes. */
  onValueChange?: (value: RangeValue) => void;
  /** Called with the final range when the pointer lifts or a key moved a handle. */
  onSlidingComplete?: (value: RangeValue) => void;
  /** Bounds and step. Default 0 to 100 by 1. */
  min?: number;
  max?: number;
  step?: number;
  /** The smallest gap between the two values. Default 0 (they can meet, never cross). */
  minDistance?: number;
  /** Tick marks under the track, one per step. Default: on when there are 40 steps or fewer and step was given. */
  ticks?: boolean;
  /** The value bubbles: while dragging (default), always, or never. */
  bubbles?: 'drag' | 'always' | 'none';
  /** Bubble text: digits after the decimal point, locale separators, and static text around the number. */
  decimals?: number;
  locale?: string;
  prefix?: string;
  suffix?: string;
  /** A short vibration on every step (when ticks show) and at the ends. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Read by screen readers on the two handles. Default 'Minimum' and 'Maximum'. */
  accessibilityLabels?: [string, string];
};

export type RangeSliderInstance = {
  /** The current range. */
  get: () => RangeValue;
  update: (props: Partial<RangeSliderProps>) => void;
  destroy: () => void;
};

const DEFAULTS = {
  min: 0, max: 100, minDistance: 0, bubbles: 'drag' as 'drag' | 'always' | 'none', decimals: 0, haptics: true, disabled: false,
  accessibilityLabels: ['Minimum', 'Maximum'] as [string, string],
};

const HANDLE = 28;
const HIT = 44;
const TRACK = 4;
const BUBBLE_ROW = 40;
const TICK_ROW = 14;
const MAX_TICKS = 40;
const BUBBLE_GAP = 6;
/** iOS springs: response about 0.3 s, no bounce for the handles, a touch of give for the bubbles. */
const SNAP = { stiffness: 440, damping: 42, mass: 1, eps: 0.05 };
const POP = { stiffness: 300, damping: 30, mass: 1, eps: 0.002 };

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

const CSS = `
:where([data-dissolve="range-slider"]) { position: relative; display: block; width: 100%; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="range-slider"][data-disabled]) { opacity: 0.5; pointer-events: none; }
:where(.dissolve-rs-area) { position: absolute; left: 0; right: 0; touch-action: pan-y; cursor: pointer; }
:where(.dissolve-rs-track) { position: absolute; left: ${HANDLE / 2}px; right: ${HANDLE / 2}px; height: ${TRACK}px; border-radius: ${TRACK / 2}px; overflow: hidden; background: var(--dissolve-surface-2, rgb(229 229 234)); }
:where(.dissolve-rs-fill) { position: absolute; top: 0; bottom: 0; left: 0; border-radius: ${TRACK / 2}px; background: var(--dissolve-foreground, rgb(28 28 30)); will-change: transform, width; }
:where(.dissolve-rs-tick) { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: var(--dissolve-muted, rgb(142 142 147)); opacity: 0.4; transition: background-color 160ms cubic-bezier(0.32, 0.72, 0, 1), opacity 160ms cubic-bezier(0.32, 0.72, 0, 1); }
:where(.dissolve-rs-tick[data-in]) { background: var(--dissolve-foreground, rgb(28 28 30)); opacity: 0.9; }
:where(.dissolve-rs-handle) { position: absolute; left: 0; width: ${HANDLE}px; height: ${HANDLE}px; border-radius: 50%; background: #fff; box-shadow: 0 0.5px 4px rgba(0,0,0,0.12), 0 6px 13px rgba(0,0,0,0.12); outline: none; cursor: grab; will-change: transform; transition: box-shadow 160ms cubic-bezier(0.32, 0.72, 0, 1); }
:where(.dissolve-rs-handle)::before { content: ''; position: absolute; inset: -8px; border-radius: 50%; }
:where(.dissolve-rs-handle:focus-visible) { box-shadow: 0 0.5px 4px rgba(0,0,0,0.12), 0 6px 13px rgba(0,0,0,0.12), 0 0 0 4px color-mix(in srgb, var(--dissolve-foreground, rgb(28 28 30)) 22%, transparent); }
:where([data-dissolve="range-slider"][data-dragging]) .dissolve-rs-handle, :where([data-dissolve="range-slider"][data-dragging]) .dissolve-rs-area { cursor: grabbing; }
:where(.dissolve-rs-bubble) { position: absolute; left: 0; top: 0; height: 30px; padding: 0 11px; border-radius: 15px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: var(--dissolve-primary, rgb(28 28 30)); box-shadow: 0 6px 16px rgba(0,0,0,0.12); transform-origin: 50% 100%; pointer-events: none; will-change: transform, opacity; white-space: nowrap; }
:where(.dissolve-rs-bubble) .dissolve-ticker-text { color: var(--dissolve-primary-foreground, rgb(255 255 255)); font-weight: 600; }
`;

export function createRangeSlider(host: HTMLElement, initial: RangeSliderProps = {}): RangeSliderInstance {
  injectStyle('dissolve-range-slider', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = { signal: ac.signal };

  host.dataset.dissolve = 'range-slider';
  host.setAttribute('role', 'group');

  const stepOf = () => (p().step && p().step! > 0 ? p().step! : 1);
  const span = () => Math.max(p().max - p().min, 1e-9);
  const steps = () => Math.round(span() / stepOf());
  const showTicks = () => p().ticks ?? (p().step !== undefined && steps() <= MAX_TICKS);
  const clampRange = (r: RangeValue): RangeValue => {
    const lo = Math.min(Math.max(r[0], p().min), p().max);
    return [lo, Math.min(Math.max(r[1], lo), p().max)];
  };

  let range = clampRange(p().value ?? p().defaultValue ?? [p().min, p().max]);
  let W = 0;
  let active = -1;
  let blocked = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const area = el('div', 'dissolve-rs-area');
  const track = el('div', 'dissolve-rs-track');
  const fill = el('div', 'dissolve-rs-fill');
  const tickBox = el('div');
  track.append(fill);
  const handles = [0, 1].map(() => {
    const h = el('div', 'dissolve-rs-handle');
    h.tabIndex = 0;
    h.setAttribute('role', 'slider');
    h.setAttribute('aria-orientation', 'horizontal');
    return h;
  });
  area.append(track, tickBox, ...handles);
  const bubbles = [0, 1].map(() => el('div', 'dissolve-rs-bubble'));
  const tickerEls = bubbles.map((b) => b.appendChild(el('span')));
  host.append(area, ...bubbles);

  const draw = () => {
    const lo = loX.v, hi = hiX.v;
    fill.style.transform = `translateX(${lo.toFixed(2)}px)`;
    fill.style.width = Math.max(0, hi - lo).toFixed(2) + 'px';
    handles[0].style.transform = `translateX(${lo.toFixed(2)}px) scale(${press[0].v.toFixed(3)})`;
    handles[1].style.transform = `translateX(${hi.toFixed(2)}px) scale(${press[1].v.toFixed(3)})`;
    if (p().bubbles === 'none') return;
    // Bubbles: centered over their handles, slid apart when they would touch, kept inside the box.
    const w0 = bubbles[0].offsetWidth, w1 = bubbles[1].offsetWidth;
    const need = (w0 + w1) / 2 + BUBBLE_GAP;
    let c0 = lo, c1 = hi;
    if (c1 - c0 < need) { const mid = (c0 + c1) / 2; c0 = mid - need / 2; c1 = mid + need / 2; }
    const minC = w0 / 2 - HANDLE / 2, maxC = W + HANDLE / 2 - w1 / 2;
    if (c0 < minC) { c1 += minC - c0; c0 = minC; }
    if (c1 > maxC) { c0 -= c1 - maxC; c1 = maxC; }
    const s = shown.v, rm = reducedMotion();
    [c0, c1].forEach((c, i) => {
      const lift = active === i ? 1 : 0.96;
      const b = bubbles[i];
      b.style.opacity = String(Math.min(1, Math.max(0, s * 1.4)));
      b.style.transform = `translate(${(HANDLE / 2 + c - (i ? w1 : w0) / 2).toFixed(2)}px, ${rm ? 0 : ((1 - s) * 10).toFixed(2)}px) scale(${rm ? 1 : ((0.6 + 0.4 * s) * lift).toFixed(3)})`;
    });
  };

  const xOf = (v: number) => ((v - p().min) / span()) * W;
  const loX = value(sc, 0, draw);
  const hiX = value(sc, 0, draw);
  const shown = value(sc, p().bubbles === 'always' ? 1 : 0, draw);
  const press = [value(sc, 1, draw), value(sc, 1, draw)];

  // Tickers are made while the bubbles are attached and unscaled: they measure their glyphs once.
  const tickerProps = () => ({ decimals: p().decimals, locale: p().locale, prefix: p().prefix, suffix: p().suffix, fontSize: 15, duration: 380, stagger: 18 });
  const tickers: NumberTickerInstance[] = tickerEls.map((t, i) => createNumberTicker(t, { value: range[i], ...tickerProps() }));

  const fmt = (v: number) => {
    let s: string;
    try { s = new Intl.NumberFormat(p().locale, { minimumFractionDigits: p().decimals, maximumFractionDigits: p().decimals }).format(v); } catch { s = v.toFixed(p().decimals); }
    return `${p().prefix ?? ''}${s}${p().suffix ?? ''}`;
  };

  function layout() {
    const top = p().bubbles === 'none' ? 0 : BUBBLE_ROW;
    const t = showTicks();
    host.style.height = top + HIT + (t ? TICK_ROW : 0) + 'px';
    Object.assign(area.style, { top: top + 'px', height: HIT + (t ? TICK_ROW : 0) + 'px' });
    track.style.top = (HIT - TRACK) / 2 + 'px';
    handles.forEach((h) => (h.style.top = (HIT - HANDLE) / 2 + 'px'));
    bubbles.forEach((b) => (b.style.display = p().bubbles === 'none' ? 'none' : ''));
    W = Math.max(0, host.clientWidth - HANDLE);
    tickBox.replaceChildren();
    if (t && W > 0 && steps() <= 200) {
      for (let i = 0; i <= steps(); i++) {
        const k = el('div', 'dissolve-rs-tick');
        k.dataset.v = String(round6(p().min + i * stepOf()));
        Object.assign(k.style, { left: HANDLE / 2 + (i / steps()) * W - 2 + 'px', top: HIT - 3 + 'px' });
        tickBox.append(k);
      }
    }
    loX.set(xOf(range[0]));
    hiX.set(xOf(range[1]));
    paintValues();
  }

  function paintValues() {
    const { min, max, disabled, accessibilityLabels } = p();
    handles.forEach((h, i) => {
      h.setAttribute('aria-label', accessibilityLabels[i]);
      h.setAttribute('aria-valuemin', String(i === 0 ? min : range[0]));
      h.setAttribute('aria-valuemax', String(i === 0 ? range[1] : max));
      h.setAttribute('aria-valuenow', String(range[i]));
      h.setAttribute('aria-valuetext', fmt(range[i]));
      h.tabIndex = disabled ? -1 : 0;
      if (disabled) h.setAttribute('aria-disabled', 'true'); else h.removeAttribute('aria-disabled');
    });
    for (const k of tickBox.children as HTMLCollectionOf<HTMLElement>) {
      const v = +k.dataset.v!;
      k.toggleAttribute('data-in', v >= range[0] - 1e-9 && v <= range[1] + 1e-9);
    }
    tickers.forEach((t, i) => t.update({ value: range[i] }));
  }

  const animateTo = (which: number, v: number) => {
    const x = which === 0 ? loX : hiX;
    if (reducedMotion() || W / steps() < 8) x.set(xOf(v));
    else x.spring(xOf(v), SNAP);
  };

  /** Moves handle `which` toward the track position x (px), stepped and kept off the other handle. */
  function move(which: number, x: number, emitChange = true) {
    if (W <= 0) return;
    const { min, max, minDistance } = p();
    const st = stepOf();
    const raw = min + (Math.min(Math.max(x, 0), W) / W) * span();
    let v = Math.min(Math.max(round6(min + Math.round((raw - min) / st) * st), min), max);
    let hit = false;
    if (which === 0) { const cap = round6(range[1] - minDistance); if (v > cap) { v = Math.max(min, cap); hit = true; } }
    else { const cap = round6(range[0] + minDistance); if (v < cap) { v = Math.min(max, cap); hit = true; } }
    setValue(which, v, hit || ((v === min || v === max) && (raw <= min || raw >= max)), emitChange);
  }

  function setValue(which: number, v: number, edge: boolean, emitChange = true) {
    if (v !== range[which]) {
      range = which === 0 ? [v, range[1]] : [range[0], v];
      animateTo(which, v);
      paintValues();
      if (emitChange) p().onValueChange?.(range);
      if (p().haptics) {
        if (edge && !blocked) vibrate(10);
        else if (showTicks()) vibrate(4);
      }
    } else if (edge && !blocked && p().haptics) vibrate(10);
    blocked = edge;
  }

  const reveal = (show: boolean, delay = 250) => {
    if (p().bubbles !== 'drag') return;
    clearTimeout(hideTimer);
    if (show) { if (reducedMotion()) shown.to(1, 120); else shown.spring(1, POP); }
    else hideTimer = setTimeout(() => sc.alive && shown.to(0, 200), delay);
  };

  const pressTo = (which: number) => {
    press.forEach((s, i) => (reducedMotion() ? s.set(1) : s.spring(i === which ? 1.12 : 1, POP)));
  };

  const pick = (x: number, dx: number) => {
    const a = Math.abs(x - loX.v), b = Math.abs(x - hiX.v);
    if (Math.abs(loX.v - hiX.v) < 1) return dx !== 0 ? (dx < 0 ? 0 : 1) : x < loX.v ? 0 : 1;
    return a <= b ? 0 : 1;
  };

  // Pointer: grab a handle where it is, or press the track and the nearest handle jumps there.
  let drag: { id: number; x0: number; grab: number; decided: boolean; moved: boolean } | null = null;
  const localX = (e: PointerEvent) => e.clientX - area.getBoundingClientRect().left - HANDLE / 2;
  area.addEventListener('pointerdown', (e) => {
    if (p().disabled || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const x = localX(e);
    const overlap = Math.abs(loX.v - hiX.v) < 1 && Math.abs(x - loX.v) <= HIT / 2;
    const which = pick(x, 0);
    const hx = which === 0 ? loX.v : hiX.v;
    const near = Math.abs(x - hx) <= HIT / 2;
    drag = { id: e.pointerId, x0: x, grab: near ? hx - x : 0, decided: !overlap, moved: false };
    area.setPointerCapture(e.pointerId);
    e.preventDefault();
    handles[which].focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    host.setAttribute('data-dragging', '');
    blocked = false;
    active = which;
    pressTo(which);
    reveal(true);
    if (!near) move(which, x);
  }, on);
  area.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const x = localX(e);
    if (!drag.decided) {
      if (Math.abs(x - drag.x0) < 2) return;
      drag.decided = true;
      active = x < drag.x0 ? 0 : 1;
      pressTo(active);
      handles[active].focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    }
    drag.moved = true;
    move(active, x + drag.grab);
  }, on);
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    host.removeAttribute('data-dragging');
    active = -1;
    pressTo(-1);
    reveal(false);
    draw();
    p().onSlidingComplete?.(range);
  };
  area.addEventListener('pointerup', end, on);
  area.addEventListener('pointercancel', end, on);

  // Keyboard on each handle.
  handles.forEach((h, which) => {
    h.addEventListener('keydown', (e) => {
      const { min, max, minDistance } = p();
      const st = stepOf();
      const page = Math.max(st, round6(Math.round(span() / 10 / st) * st));
      const lowBound = which === 0 ? min : round6(range[0] + minDistance);
      const highBound = which === 0 ? round6(range[1] - minDistance) : max;
      const cur = range[which];
      let v: number;
      switch (e.key) {
        case 'ArrowLeft': case 'ArrowDown': v = cur - st; break;
        case 'ArrowRight': case 'ArrowUp': v = cur + st; break;
        case 'PageDown': v = cur - page; break;
        case 'PageUp': v = cur + page; break;
        case 'Home': v = lowBound; break;
        case 'End': v = highBound; break;
        default: return;
      }
      e.preventDefault();
      v = Math.min(Math.max(round6(v), lowBound), highBound);
      active = which;
      reveal(true);
      blocked = false;
      setValue(which, v, v === lowBound || v === highBound);
      p().onSlidingComplete?.(range);
      active = -1;
      reveal(false, 900);
    }, on);
    h.addEventListener('blur', () => { if (!drag) reveal(false, 0); }, on);
  });

  const ro = new ResizeObserver(() => {
    const w = Math.max(0, host.clientWidth - HANDLE);
    if (w !== W) layout();
  });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());

  layout();
  host.toggleAttribute('data-disabled', p().disabled);

  return {
    get: () => range,
    update(next) {
      const changed = props.update(next);
      host.toggleAttribute('data-disabled', p().disabled);
      if (['decimals', 'locale', 'prefix', 'suffix'].some((k) => changed.has(k as keyof RangeSliderProps))) tickers.forEach((t) => t.update(tickerProps()));
      if (changed.has('bubbles')) shown.set(p().bubbles === 'always' ? 1 : 0);
      if (['min', 'max', 'step', 'ticks', 'bubbles'].some((k) => changed.has(k as keyof RangeSliderProps))) {
        range = clampRange(range);
        layout();
      }
      if (changed.has('value') && p().value && !drag) {
        const r = clampRange(p().value!);
        if (r[0] !== range[0] || r[1] !== range[1]) {
          range = r;
          animateTo(0, r[0]);
          animateTo(1, r[1]);
          paintValues();
        }
      }
      paintValues();
    },
    destroy() {
      clearTimeout(hideTimer);
      ac.abort();
      sc.dispose();
      tickers.forEach((t) => t.destroy());
      area.remove();
      bubbles.forEach((b) => b.remove());
      host.removeAttribute('data-dissolve');
      host.removeAttribute('data-dragging');
      host.removeAttribute('data-disabled');
      host.removeAttribute('role');
      host.style.removeProperty('height');
    },
  };
}
