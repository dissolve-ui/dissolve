/**
 * PagerTabs for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (pager-tabs.tsx) wraps it; it also runs on its own:
 *
 *   const pager = createPagerTabs(el, { tabs: ['For you', 'Following', 'Design'] });
 *   pager.pages.forEach((page, i) => page.append(feeds[i]));
 *
 * Tabs above swipeable pages. Swipe the pages (touch, a trackpad, or drag them with the mouse)
 * and a soft pill slides behind the tabs the whole way, stretching between two tabs of different
 * widths; the label on it turns from muted to full ink as it arrives. No underline, no rule. Click a tab and the pages glide to
 * it. With more tabs than fit, the row scrolls on its own to keep the active tab in view. The
 * arrow keys, Home and End move between tabs once the row has focus (ARIA tabs).
 * Reduced motion: a click jumps straight to its page.
 * Colors follow --dissolve-background, --dissolve-surface, --dissolve-foreground and
 * --dissolve-muted. Give the host a height: the pages fill it under the tabs, each scrolls on its
 * own.
 */
import { clamp, el, injectStyle, plainButton, propsOf, reducedMotion, scope, vibrate } from './kit';

export type PagerTabsProps = {
  /** The tab labels, one page each. */
  tabs?: readonly string[];
  /** The page shown first. Default 0. */
  initialIndex?: number;
  /** Called when the pages settle on a new tab. */
  onIndexChange?: (index: number) => void;
  /** The tab row scrolls when the tabs do not fit (else they share the width). Default true. */
  scrollable?: boolean;
  /** A short vibration when the page changes, where the browser has it. Default true. */
  haptics?: boolean;
};

export type PagerTabsInstance = {
  /** One element per tab: put each page's content in it. Rebuilt when tabs change. */
  readonly pages: HTMLElement[];
  readonly index: number;
  /** Goes to page i, as a click on its tab. */
  select: (index: number, animated?: boolean) => void;
  update: (props: Partial<PagerTabsProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { tabs: [] as readonly string[], initialIndex: 0, scrollable: true, haptics: true };

/** Same numbers as the React Native version. */
const ROW = 44;
const INSET = 14;
const PILL = 34;
/** A mouse drag: release speed (px/ms) that turns the page whatever the distance. */
const FLICK = 0.35;

const CSS = `
:where([data-dissolve="pager-tabs"]) { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--dissolve-background, rgb(255 255 255)); color: var(--dissolve-foreground, rgb(28 28 30)); }
:where(.dissolve-pt-row) { flex: none; padding: 7px 0 8px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
:where(.dissolve-pt-row)::-webkit-scrollbar { display: none; }
:where(.dissolve-pt-track) { position: relative; display: flex; gap: 4px; width: max-content; min-width: 100%; box-sizing: border-box; padding: 0 12px; height: ${ROW}px; }
:where(.dissolve-pt-tab) { position: relative; flex: 1 0 auto; min-width: 44px; height: ${ROW}px; padding: 0 ${INSET}px !important; font-size: 15px !important; font-weight: 600 !important; letter-spacing: -0.016em; white-space: nowrap; color: var(--dissolve-muted, rgb(142 142 147)) !important; border-radius: ${PILL / 2}px !important; outline: none; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
:where(.dissolve-pt-tab:focus-visible) { box-shadow: 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
:where(.dissolve-pt-ind) { position: absolute; left: 0; top: ${(ROW - PILL) / 2}px; height: ${PILL}px; width: 0; border-radius: ${PILL / 2}px; background: var(--dissolve-surface, rgb(242 242 247)); pointer-events: none; will-change: transform, width; }
:where(.dissolve-pt-pages) { flex: 1; min-height: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; outline: none; }
:where(.dissolve-pt-pages)::-webkit-scrollbar { display: none; }
:where(.dissolve-pt-pages[data-drag]) { scroll-snap-type: none; cursor: grabbing; user-select: none; -webkit-user-select: none; }
:where(.dissolve-pt-page) { flex: 0 0 100%; min-width: 0; height: 100%; overflow-y: auto; scroll-snap-align: start; scroll-snap-stop: always; overscroll-behavior-y: contain; outline: none; }
:where(.dissolve-pt-page:focus-visible) { box-shadow: inset 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
`;

let uid = 0;

export function createPagerTabs(host: HTMLElement, initial: PagerTabsProps = {}): PagerTabsInstance {
  injectStyle('dissolve-pager-tabs', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const id = `dissolve-pt-${++uid}`;

  host.dataset.dissolve = 'pager-tabs';
  const row = el('div', 'dissolve-pt-row');
  const track = el('div', 'dissolve-pt-track');
  track.setAttribute('role', 'tablist');
  const ind = el('div', 'dissolve-pt-ind');
  row.append(track);
  const pagesEl = el('div', 'dissolve-pt-pages');
  host.append(row, pagesEl);

  let tabEls: HTMLButtonElement[] = [];
  let pages: HTMLElement[] = [];
  let index = clamp(p().initialIndex, 0, Math.max(0, p().tabs.length - 1));
  let boxes: { x: number; w: number }[] = [];

  const width = () => pagesEl.clientWidth || 1;
  const progress = () => pagesEl.scrollLeft / width();

  function build() {
    const tabs = p().tabs;
    track.replaceChildren();
    pagesEl.replaceChildren();
    tabEls = tabs.map((label, i) => {
      const b = plainButton('dissolve-pt-tab');
      b.textContent = label;
      b.id = `${id}-tab-${i}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', `${id}-page-${i}`);
      b.addEventListener('click', () => select(i), on);
      track.append(b);
      return b;
    });
    track.prepend(ind);
    pages = tabs.map((_, i) => {
      const pg = el('div', 'dissolve-pt-page');
      pg.id = `${id}-page-${i}`;
      pg.setAttribute('role', 'tabpanel');
      pg.setAttribute('aria-labelledby', `${id}-tab-${i}`);
      pg.tabIndex = 0;
      pagesEl.append(pg);
      return pg;
    });
    index = clamp(index, 0, Math.max(0, tabs.length - 1));
    measure();
    pagesEl.scrollLeft = index * width();
    mark();
    render();
  }

  function measure() {
    boxes = tabEls.map((t) => ({ x: t.offsetLeft, w: t.offsetWidth }));
  }

  /** The pill at a fractional page, between the two tabs around it. */
  function at(pr: number) {
    const n = boxes.length;
    if (!n) return { x: 0, w: 0 };
    const i = clamp(Math.floor(pr), 0, n - 1), j = Math.min(n - 1, i + 1), t = clamp(pr - i);
    return { x: boxes[i].x + (boxes[j].x - boxes[i].x) * t, w: boxes[i].w + (boxes[j].w - boxes[i].w) * t };
  }

  function render() {
    const pr = progress();
    const b = at(pr);
    ind.style.width = b.w + 'px';
    ind.style.transform = `translateX(${b.x.toFixed(2)}px)`;
    tabEls.forEach((t, i) => {
      const d = clamp(Math.abs(pr - i));
      t.style.setProperty('color', d >= 1 ? '' : `color-mix(in srgb, var(--dissolve-muted, rgb(142 142 147)) ${(d * 100).toFixed(1)}%, var(--dissolve-foreground, rgb(28 28 30)))`, 'important');
    });
    // The row follows the pill, keeping it centered when the tabs overflow.
    if (p().scrollable && !rowTouched) row.scrollLeft = b.x + b.w / 2 - row.clientWidth / 2;
    const now = clamp(Math.round(pr), 0, Math.max(0, tabEls.length - 1));
    if (now !== index) {
      index = now;
      mark();
      if (p().haptics) vibrate(4);
      p().onIndexChange?.(now);
    }
  }

  /** ARIA state: the selected tab, a roving tabindex, hidden pages out of the tab order. */
  function mark() {
    tabEls.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === index));
      t.tabIndex = i === index ? 0 : -1;
    });
    pages.forEach((pg, i) => {
      pg.inert = i !== index && !dragging;
    });
  }

  function select(i: number, animated = !reducedMotion()) {
    const to = clamp(i, 0, Math.max(0, tabEls.length - 1));
    rowTouched = false;
    pages.forEach((pg) => (pg.inert = false));
    pagesEl.scrollTo({ left: to * width(), behavior: animated ? 'smooth' : 'auto' });
    if (!animated) render();
  }

  pagesEl.addEventListener('scroll', () => render(), { passive: true, ...on });
  pagesEl.addEventListener('scrollend', () => mark(), on);
  // Pages stay reachable while they slide in: inert again once settled.
  pagesEl.addEventListener('touchstart', () => pages.forEach((pg) => (pg.inert = false)), { passive: true, ...on });

  // The row scrolled by hand: stop following until the next page change.
  let rowTouched = false;
  row.addEventListener('wheel', () => (rowTouched = true), { passive: true, ...on });
  row.addEventListener('touchstart', () => (rowTouched = true), { passive: true, ...on });
  pagesEl.addEventListener('wheel', () => (rowTouched = false), { passive: true, ...on });
  pagesEl.addEventListener('touchstart', () => (rowTouched = false), { passive: true, ...on });

  track.addEventListener('keydown', (e) => {
    const k = e.key;
    const to = k === 'ArrowRight' ? index + 1 : k === 'ArrowLeft' ? index - 1 : k === 'Home' ? 0 : k === 'End' ? tabEls.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const i = clamp(to, 0, tabEls.length - 1);
    select(i);
    tabEls[i]?.focus({ preventScroll: true });
  }, on);

  // A mouse drag on the pages: they follow the pointer, then glide to the nearest page.
  let dragging = false;
  let drag: { x: number; left: number; vx: number; lastX: number; lastT: number } | null = null;
  pagesEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: pagesEl.scrollLeft, vx: 0, lastX: e.clientX, lastT: performance.now() };
  }, on);
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      dragging = true;
      rowTouched = false;
      pagesEl.dataset.drag = '';
      pages.forEach((pg) => (pg.inert = false));
    }
    const now = performance.now(), dt = now - drag.lastT;
    if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = now;
    pagesEl.scrollLeft = drag.left - dx;
  }, on);
  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!dragging) return;
    dragging = false;
    // A pause before letting go is not a flick.
    if (performance.now() - d.lastT > 80) d.vx = 0;
    const pr = progress(), from = d.left / width();
    let to = Math.round(pr);
    if (Math.abs(d.vx) > FLICK) to = d.vx < 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
    to = clamp(to, Math.floor(from) - 1, Math.ceil(from) + 1);
    // Back to snapping once the glide is over, or a snap would cut it short.
    const target = clamp(to, 0, tabEls.length - 1) * width();
    pagesEl.scrollTo({ left: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
    const restore = () => {
      if (!dragging) delete pagesEl.dataset.drag;
      mark();
    };
    if ('onscrollend' in window && Math.abs(pagesEl.scrollLeft - target) > 1) pagesEl.addEventListener('scrollend', restore, { once: true, signal: ac.signal });
    else restore();
  };
  addEventListener('pointerup', endDrag, on);
  addEventListener('pointercancel', endDrag, on);
  // A drag is not a click on what is under it.
  pagesEl.addEventListener('click', (e) => { if (pagesEl.dataset.drag !== undefined) e.stopPropagation(); }, { capture: true, ...on });

  // Resize: keep the current page in place, re-measure the tabs.
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const w = width();
    measure();
    if (w !== lastW) {
      lastW = w;
      pagesEl.scrollLeft = index * w;
    }
    render();
  });
  ro.observe(pagesEl);
  ro.observe(track);
  sc.onDispose(() => ro.disconnect());
  document.fonts?.ready.then(() => { if (sc.alive) { measure(); render(); } });

  function apply(changed?: Set<keyof PagerTabsProps>) {
    if (!changed || changed.has('tabs')) build();
    row.style.overflowX = p().scrollable ? 'auto' : 'hidden';
  }
  apply();

  return {
    get pages() { return pages; },
    get index() { return index; },
    select,
    update(next) {
      const changed = props.update(next);
      if (changed.size) apply(changed);
    },
    destroy() {
      sc.dispose();
      ac.abort();
      row.remove(); pagesEl.remove();
      delete host.dataset.dissolve;
    },
  };
}
