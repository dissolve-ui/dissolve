/**
 * Accordion for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (accordion.tsx) wraps it; it also runs on its own:
 *
 *   const a = createAccordion(el, { items: [{ value: 'shipping', title: 'Shipping', content: 'Two days.' }] });
 *
 * Expandable sections on hairline dividers. Click a header and its section opens on a smooth height
 * curve while the chevron turns over, then the content fades in and slides down into place. One
 * section open at a time (type 'single', the default) or any number ('multiple'). Each header is a
 * button (aria-expanded, aria-controls) and each section a region labelled by it; Arrow Up and Down,
 * Home and End move between headers. Reduced motion: the section opens at once and the content
 * simply fades. Colors follow --dissolve-foreground, --dissolve-muted and --dissolve-border.
 */
import { injectStyle, propsOf, reducedMotion, scope, vibrate } from './kit';

export type AccordionItem = {
  /** Unique key, also what value and onValueChange hold. */
  value: string;
  /** Header text. */
  title: string;
  /** The section, standalone use: text or a node. The React wrapper portals its content into slot(value). */
  content?: string | Node;
  /** The header cannot be pressed. */
  disabled?: boolean;
};

export type AccordionProps = {
  items?: AccordionItem[];
  /** 'single': opening a section closes the other. 'multiple': each opens on its own. Default 'single'. */
  type?: 'single' | 'multiple';
  /** In single mode, the open section can be closed again. Default true. */
  collapsible?: boolean;
  /** Open sections (controlled). In single mode, at most one. */
  value?: string[];
  /** Initially open sections when uncontrolled. Default none. */
  defaultValue?: string[];
  /** Called with the open sections on every change. */
  onValueChange?: (value: string[]) => void;
  /** A short vibration on every change, where the browser has it. Default true. */
  haptics?: boolean;
};

export type AccordionInstance = {
  update: (props: Partial<AccordionProps>) => void;
  /** The element a section's content goes in. */
  slot: (value: string) => HTMLElement;
  destroy: () => void;
};

const DEFAULTS = { items: [] as AccordionItem[], type: 'single' as const, collapsible: true, haptics: true };

/** Height curve when opening and closing (the CALM curve of the native source). */
const OPEN = 320;
const CLOSE = 260;
/** The content waits a beat, fades in and slides down into place. */
const CONTENT_DELAY = 60;
const CONTENT_IN = 240;
const CONTENT_OUT = 120;
const SLIDE = 6;
/** Reduced motion: a plain fade. */
const FADE = 150;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const CHEVRON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.9 4.8 7 9.2l5.1-4.4"/></svg>';

const CSS = `
:where([data-dissolve="accordion"]) { display: block; }
:where(.dissolve-accordion-item + .dissolve-accordion-item) { border-top: 1px solid var(--dissolve-border, rgb(60 60 67 / 0.12)); }
:where(.dissolve-accordion-heading) { margin: 0; }
:where(.dissolve-accordion-trigger) { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 56px; padding: 14px 0; text-align: left; color: var(--dissolve-foreground, rgb(28 28 30)); -webkit-tap-highlight-color: transparent; transition: opacity 120ms; border-radius: 8px; }
:where(.dissolve-accordion-trigger:active:not(:disabled)) { opacity: 0.6; }
:where(.dissolve-accordion-trigger:disabled) { opacity: 0.4; cursor: default; }
:where(.dissolve-accordion-trigger:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 2px; }
:where(.dissolve-accordion-title) { flex: 1; font-size: 16px; line-height: 22px; font-weight: 500; }
:where(.dissolve-accordion-chevron) { display: flex; flex: none; color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-accordion-region) { overflow: hidden; }
:where(.dissolve-accordion-content) { padding-bottom: 18px; font-size: 15px; line-height: 22px; color: var(--dissolve-muted, rgb(142 142 147)); }
`;

let uid = 0;

type Section = {
  item: AccordionItem;
  root: HTMLElement;
  trigger: HTMLButtonElement;
  title: HTMLElement;
  chevron: HTMLElement;
  region: HTMLElement;
  content: HTMLElement;
  open: boolean;
  /** The pending end of a height transition. */
  timer: ReturnType<typeof setTimeout> | undefined;
};

export function createAccordion(host: HTMLElement, initial: AccordionProps = {}): AccordionInstance {
  injectStyle('dissolve-accordion', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const id = `dissolve-accordion-${++uid}`;
  host.dataset.dissolve = 'accordion';

  let inner = [...(p().defaultValue ?? [])];
  const openKeys = () => p().value ?? inner;
  const sections = new Map<string, Section>();
  /** Content elements by item value, made on first ask: the React wrapper portals into them while rendering. */
  const slots = new Map<string, HTMLElement>();
  const slotOf = (value: string) => {
    let c = slots.get(value);
    if (!c) {
      c = document.createElement('div');
      c.className = 'dissolve-accordion-content';
      slots.set(value, c);
    }
    return c;
  };

  /** Opens or closes one section, animated unless instant. */
  function show(s: Section, open: boolean, instant: boolean) {
    if (s.open === open) return;
    s.open = open;
    clearTimeout(s.timer);
    const reduced = reducedMotion();
    const { region, content, chevron, trigger } = s;
    trigger.setAttribute('aria-expanded', String(open));
    s.root.dataset.state = open ? 'open' : 'closed';
    if (instant) {
      region.style.transition = content.style.transition = chevron.style.transition = 'none';
      region.style.height = open ? 'auto' : '0px';
      region.style.visibility = open ? '' : 'hidden';
      content.style.opacity = open ? '1' : '0';
      content.style.transform = open ? '' : `translateY(${-SLIDE}px)`;
      chevron.style.transform = open ? 'rotate(180deg)' : '';
      return;
    }
    const ms = reduced ? 0 : open ? OPEN : CLOSE;
    // From the current pixel height (auto when open and settled) to the target one.
    region.style.transition = 'none';
    region.style.height = region.getBoundingClientRect().height + 'px';
    region.style.visibility = '';
    void region.offsetHeight;
    region.style.transition = ms ? `height ${ms}ms ${EASE}` : 'none';
    region.style.height = open ? content.offsetHeight + 'px' : '0px';
    chevron.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    chevron.style.transform = open ? 'rotate(180deg)' : '';
    if (reduced) content.style.transition = `opacity ${FADE}ms`;
    else if (open) content.style.transition = `opacity ${CONTENT_IN}ms ${EASE} ${CONTENT_DELAY}ms, transform ${CONTENT_IN + 80}ms ${EASE} ${CONTENT_DELAY}ms`;
    else content.style.transition = `opacity ${CONTENT_OUT}ms, transform ${CONTENT_OUT}ms`;
    content.style.opacity = open ? '1' : '0';
    content.style.transform = open || reduced ? '' : `translateY(${-SLIDE}px)`;
    // Settled: an open section follows its content's size, a closed one leaves the tab order.
    s.timer = setTimeout(() => {
      region.style.transition = 'none';
      if (open) region.style.height = 'auto';
      else region.style.visibility = 'hidden';
    }, Math.max(ms, reduced ? FADE : 0) + 20);
    // A closing section snaps its content to the start position for the next opening.
    if (!open && !reduced) content.addEventListener('transitionend', () => { if (!s.open) content.style.transform = `translateY(${-SLIDE}px)`; }, { once: true });
  }

  function sync(instant = false) {
    const keys = openKeys();
    for (const s of sections.values()) show(s, keys.includes(s.item.value), instant);
  }

  function toggle(key: string) {
    const keys = openKeys();
    const isOpen = keys.includes(key);
    let next: string[];
    if (p().type === 'multiple') next = isOpen ? keys.filter((k) => k !== key) : [...keys, key];
    else if (isOpen) {
      if (!p().collapsible) return;
      next = [];
    } else next = [key];
    if (p().haptics) vibrate(4);
    if (p().value === undefined) inner = next;
    p().onValueChange?.(next);
    // Controlled: the parent passes the new value back through update().
    if (p().value === undefined) sync();
  }

  function make(item: AccordionItem): Section {
    const n = ++uid;
    const root = document.createElement('div');
    root.className = 'dissolve-accordion-item';
    const heading = document.createElement('div');
    heading.className = 'dissolve-accordion-heading';
    heading.setAttribute('role', 'heading');
    heading.setAttribute('aria-level', '3');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dissolve-accordion-trigger';
    // A form control: page resets beat :where(), so its plain look is inline.
    Object.assign(trigger.style, { background: 'none', border: '0', margin: '0', font: 'inherit', cursor: 'pointer' });
    trigger.id = `${id}-t${n}`;
    const title = document.createElement('span');
    title.className = 'dissolve-accordion-title';
    const chevron = document.createElement('span');
    chevron.className = 'dissolve-accordion-chevron';
    chevron.innerHTML = CHEVRON;
    trigger.append(title, chevron);
    heading.append(trigger);
    const region = document.createElement('div');
    region.className = 'dissolve-accordion-region';
    region.id = `${id}-r${n}`;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-labelledby', trigger.id);
    trigger.setAttribute('aria-controls', region.id);
    trigger.setAttribute('aria-expanded', 'false');
    const content = slotOf(item.value);
    region.append(content);
    root.append(heading, region);
    const s: Section = { item, root, trigger, title, chevron, region, content, open: true, timer: undefined };
    trigger.addEventListener('click', () => toggle(s.item.value));
    // A new section starts where the value says, without animating.
    show(s, false, true);
    if (openKeys().includes(item.value)) show(s, true, true);
    return s;
  }

  /** Builds, updates and orders the sections from the items, keeping each one's content node. */
  function build() {
    const items = p().items;
    const seen = new Set<string>();
    items.forEach((item, i) => {
      seen.add(item.value);
      let s = sections.get(item.value);
      if (!s) {
        s = make(item);
        sections.set(item.value, s);
      }
      s.item = item;
      s.title.textContent = item.title;
      s.trigger.disabled = !!item.disabled;
      if (item.content !== undefined) s.content.replaceChildren(item.content);
      // Moved only when out of place: moving a focused header would blur it.
      if (host.children[i] !== s.root) host.insertBefore(s.root, host.children[i] ?? null);
    });
    for (const [key, s] of sections) if (!seen.has(key)) { clearTimeout(s.timer); s.root.remove(); sections.delete(key); slots.delete(key); }
  }

  // Arrow keys move between the headers.
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (!t.classList?.contains('dissolve-accordion-trigger')) return;
    const list = [...sections.values()].map((s) => s.trigger).filter((b) => !b.disabled);
    const i = list.indexOf(t as HTMLButtonElement);
    if (i === -1) return;
    const to = e.key === 'ArrowDown' ? list[(i + 1) % list.length] : e.key === 'ArrowUp' ? list[(i - 1 + list.length) % list.length] : e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    to.focus();
  };
  host.addEventListener('keydown', onKey);

  build();

  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has('items')) build();
      if (changed.has('value') || changed.has('type')) sync();
    },
    slot: slotOf,
    destroy() {
      sc.dispose();
      host.removeEventListener('keydown', onKey);
      for (const s of sections.values()) { clearTimeout(s.timer); s.root.remove(); }
      sections.clear();
      slots.clear();
      host.removeAttribute('data-dissolve');
    },
  };
}
