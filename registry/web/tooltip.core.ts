/**
 * Tooltip for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (tooltip.tsx) wraps it; it also runs on its own, on the element to describe:
 *
 *   const t = createTooltip(button, { content: 'Share' });
 *
 * A small label with an arrow. Hover or focus the element and, after the delay, the tooltip grows in
 * from it with a soft scale and fade; on touch, press and hold. Moving from one tooltip to the next
 * skips the delay. It sits on the side you ask for (top, bottom, left or right), flips to the other
 * side when the viewport edge is too close and slides along that edge to stay on screen, the arrow
 * still pointing at the element. It lives in document.body (position fixed), so no overflow clips it,
 * and follows the element on scroll and resize. Accessible: role="tooltip", the element gets
 * aria-describedby, Escape hides it. Reduced motion: a plain fade. Colors follow
 * --dissolve-foreground and --dissolve-background.
 */
import { injectStyle, propsOf, reducedMotion, scope } from './kit';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export type TooltipProps = {
  /** The label, standalone use. The React wrapper portals its content into slot(). */
  content?: string | Node;
  /** Preferred side. It flips to the other side when the viewport edge is too close. Default 'top'. */
  placement?: TooltipPlacement;
  /** How long to hover, focus or hold before it shows, in ms. Default 400. */
  delay?: number;
  /** Gap between the element and the arrow tip, in px. Default 8. */
  offset?: number;
  /** Shown or hidden (controlled). */
  open?: boolean;
  /** Called when it wants to show or hide. */
  onOpenChange?: (open: boolean) => void;
  /** Never shows. */
  disabled?: boolean;
  /** Selection tick as it shows. Not on the web: kept for the shared props. */
  haptics?: boolean;
};

export type TooltipInstance = {
  update: (props: Partial<TooltipProps>) => void;
  /** The element the label goes in. */
  slot: () => HTMLElement;
  /** Shows or hides it now, without the delay. Uncontrolled only. */
  show: () => void;
  hide: () => void;
  destroy: () => void;
};

const DEFAULTS = { placement: 'top' as TooltipPlacement, delay: 400, offset: 8, disabled: false, haptics: true };

const IN = 150;
const OUT = 100;
/** On touch, how long it stays after the finger lifts. */
const LINGER = 1200;
/** Keep this far from the viewport edges. */
const EDGE = 8;
const ARROW = 8;
/** Distance it travels toward its place as it shows. */
const RISE = 4;
/** Another tooltip closed less than this ago: show at once. */
const SKIP = 300;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

const CSS = `
:where(.dissolve-tooltip) { position: fixed; left: 0; top: 0; z-index: 2147483000; max-width: 240px; padding: 6px 10px; border-radius: 8px; box-sizing: border-box; pointer-events: none; font: 500 13px/18px system-ui, -apple-system, sans-serif; background: var(--dissolve-foreground, rgb(28 28 30)); color: var(--dissolve-background, rgb(255 255 255)); opacity: 0; visibility: hidden; overflow-wrap: break-word; }
:where(.dissolve-tooltip-arrow) { position: absolute; width: ${ARROW}px; height: ${ARROW}px; border-radius: 1.5px; background: inherit; transform: rotate(45deg); }
`;

let uid = 0;
/** When the last tooltip closed, for the skip delay. */
let lastClosed = -Infinity;

type Box = { x: number; y: number; w: number; h: number };

/** Where the bubble goes, relative to the trigger's top left. Same as the native placeTooltip. */
export function placeTooltip(t: Box, b: { w: number; h: number }, want: TooltipPlacement, gap: number, win: { w: number; h: number; top: number; edge: number }) {
  const room = { top: t.y - win.top, bottom: win.h - win.edge - (t.y + t.h), left: t.x - win.edge, right: win.w - win.edge - (t.x + t.w) };
  const need = (s: TooltipPlacement) => (s === 'top' || s === 'bottom' ? b.h : b.w) + gap;
  const side = room[want] >= need(want) || room[OPPOSITE[want]] < need(OPPOSITE[want]) ? want : OPPOSITE[want];
  const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let x: number, y: number, arrow: number;
  if (side === 'top' || side === 'bottom') {
    x = clampTo(t.w / 2 - b.w / 2, win.edge - t.x, win.w - win.edge - t.x - b.w);
    y = side === 'top' ? -gap - b.h : t.h + gap;
    arrow = clampTo(t.w / 2 - x, 10, b.w - 10);
  } else {
    y = clampTo(t.h / 2 - b.h / 2, win.top - t.y, win.h - win.edge - t.y - b.h);
    x = side === 'left' ? -gap - b.w : t.w + gap;
    arrow = clampTo(t.h / 2 - y, 10, b.h - 10);
  }
  return { side, x, y, arrow };
}

export function createTooltip(host: HTMLElement, initial: TooltipProps = {}): TooltipInstance {
  injectStyle('dissolve-tooltip', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const id = `dissolve-tooltip-${++uid}`;

  const bubble = document.createElement('div');
  bubble.className = 'dissolve-tooltip';
  bubble.id = id;
  bubble.setAttribute('role', 'tooltip');
  const body = document.createElement('div');
  const arrow = document.createElement('div');
  arrow.className = 'dissolve-tooltip-arrow';
  bubble.append(body, arrow);
  document.body.append(bubble);

  /** The element described: the host, or its first focusable child when the host is a plain wrapper. */
  const target = () =>
    (host.matches('a[href], button, input, select, textarea, [tabindex]') ? host : host.querySelector<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')) ?? host;
  let described: HTMLElement | null = null;
  const describe = () => {
    const t = target();
    if (described === t) return;
    undescribe();
    described = t;
    const ids = (t.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    if (!ids.includes(id)) t.setAttribute('aria-describedby', [...ids, id].join(' '));
  };
  const undescribe = () => {
    if (!described) return;
    const rest = (described.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id);
    if (rest.length) described.setAttribute('aria-describedby', rest.join(' '));
    else described.removeAttribute('aria-describedby');
    described = null;
  };

  let inner = false;
  let visible = false;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const isOpen = () => !p().disabled && (p().open ?? inner);

  function place() {
    const r = host.getBoundingClientRect();
    const b = { w: bubble.offsetWidth, h: bubble.offsetHeight };
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const s = placeTooltip({ x: r.left, y: r.top, w: r.width, h: r.height }, b, p().placement, p().offset + ARROW / 2, { w: vw, h: vh, top: EDGE, edge: EDGE });
    bubble.dataset.side = s.side;
    bubble.style.left = `${Math.round(r.left + s.x)}px`;
    bubble.style.top = `${Math.round(r.top + s.y)}px`;
    const vertical = s.side === 'top' || s.side === 'bottom';
    Object.assign(arrow.style, { left: '', top: '', right: '', bottom: '' });
    if (vertical) {
      arrow.style.left = `${s.arrow - ARROW / 2}px`;
      arrow.style[s.side === 'top' ? 'bottom' : 'top'] = `${-ARROW / 2 + 1}px`;
    } else {
      arrow.style.top = `${s.arrow - ARROW / 2}px`;
      arrow.style[s.side === 'left' ? 'right' : 'left'] = `${-ARROW / 2 + 1}px`;
    }
    bubble.style.transformOrigin = vertical ? `${s.arrow}px ${s.side === 'top' ? '100%' : '0'}` : `${s.side === 'left' ? '100%' : '0'} ${s.arrow}px`;
    return s.side;
  }
  const away = (side: string) => {
    if (reducedMotion()) return 'none';
    const d = RISE;
    const t = side === 'top' ? `0, ${d}px` : side === 'bottom' ? `0, ${-d}px` : side === 'left' ? `${d}px, 0` : `${-d}px, 0`;
    return `translate(${t}) scale(0.96)`;
  };

  let follow: AbortController | null = null;
  function render() {
    const want = isOpen();
    if (want === visible) return;
    visible = want;
    if (want) {
      describe();
      bubble.style.transition = 'none';
      bubble.style.visibility = 'visible';
      const side = place();
      bubble.style.opacity = '0';
      bubble.style.transform = away(side);
      void bubble.offsetWidth;
      bubble.style.transition = `opacity ${IN}ms ${EASE}, transform ${IN}ms ${EASE}`;
      bubble.style.opacity = '1';
      bubble.style.transform = 'none';
      // Follows the element while shown.
      follow = new AbortController();
      const again = () => place();
      addEventListener('scroll', again, { capture: true, passive: true, signal: follow.signal });
      addEventListener('resize', again, { signal: follow.signal });
      addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); }, { signal: follow.signal });
    } else {
      follow?.abort();
      follow = null;
      lastClosed = performance.now();
      bubble.style.transition = `opacity ${OUT}ms, transform ${OUT}ms`;
      bubble.style.opacity = '0';
      bubble.style.transform = away(bubble.dataset.side ?? 'top');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (!visible) bubble.style.visibility = 'hidden'; }, OUT + 20);
    }
  }

  function set(next: boolean) {
    clearTimeout(showTimer);
    if (next === (p().open ?? inner)) return;
    if (p().open === undefined) inner = next;
    p().onOpenChange?.(next);
    render();
  }
  const later = (ms: number) => {
    clearTimeout(showTimer);
    if (p().disabled) return;
    const wait = performance.now() - lastClosed < SKIP ? 0 : ms;
    showTimer = setTimeout(() => set(true), wait);
  };

  // Mouse: hover. Touch and pen: press and hold, it lingers after the finger lifts.
  let touchTimer: ReturnType<typeof setTimeout> | undefined;
  const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') later(p().delay); };
  const onLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse') set(false); };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') { set(false); return; }
    clearTimeout(touchTimer);
    later(p().delay);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(showTimer);
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => set(false), LINGER);
  };
  // A press held for the tooltip is not a long press menu.
  const onMenu = (e: Event) => { if (visible) e.preventDefault(); };
  const onFocusIn = () => { if (target().matches(':focus-visible')) later(p().delay); };
  const onFocusOut = () => set(false);
  const on: [string, EventListener][] = [
    ['pointerenter', onEnter as EventListener], ['pointerleave', onLeave as EventListener], ['pointerdown', onDown as EventListener],
    ['pointerup', onUp as EventListener], ['pointercancel', onUp as EventListener], ['contextmenu', onMenu], ['focusin', onFocusIn], ['focusout', onFocusOut],
  ];
  for (const [t, f] of on) host.addEventListener(t, f);

  const fill = () => { if (p().content !== undefined) body.replaceChildren(p().content!); };
  fill();
  describe();

  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has('content')) { fill(); if (visible) place(); }
      if (changed.has('placement') || changed.has('offset')) { if (visible) place(); }
      if (changed.has('open') || changed.has('disabled')) render();
      describe();
    },
    slot: () => body,
    show: () => set(true),
    hide: () => set(false),
    destroy() {
      sc.dispose();
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(touchTimer);
      follow?.abort();
      for (const [t, f] of on) host.removeEventListener(t, f);
      undescribe();
      bubble.remove();
    },
  };
}
