/**
 * GooeyMenu for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (gooey-menu.tsx) wraps it; it also runs on its own:
 *
 *   const menu = createGooeyMenu(document.querySelector('div')!, {
 *     items: [{ label: 'Camera', onPress: openCamera }, { label: 'Photo', onPress: openLibrary }],
 *   });
 *   menu.icon(0).innerHTML = cameraSvg;
 *
 * A floating button whose actions pour out of it as drops along an arc and melt back in when it
 * closes. The liquid look is an SVG filter: the shapes are blurred together, then the alpha is
 * pushed back to a hard edge (alpha * 20 - 9), so close shapes melt into one blob with a neck
 * between them. Place it absolutely: it reserves room for the arc above and to the left of the
 * button. Button and drops read --dissolve-primary, the plus and the icons
 * --dissolve-primary-foreground (draw icons in currentColor).
 */
import { clamp, el, IN_OUT_CUBIC, injectStyle, plainButton, propsOf, reducedMotion, scope, value, vibrate } from './kit';

export type GooeyMenuItem = { onPress: () => void; label?: string };

export type GooeyMenuProps = {
  /** The actions, along the arc. The menu closes after one runs. Their icons go in icon(i). */
  items?: GooeyMenuItem[];
  /** Diameter of the main button in px. Actions are 82 percent of it. Default 56. */
  size?: number;
  /** Distance from the main button to the actions. Default 92. */
  distance?: number;
  /** Arc start in degrees, 0 = right, -90 = up. Default -90. */
  startAngle?: number;
  /** Arc end in degrees, -180 = left. Default -180. */
  endAngle?: number;
  /** A short vibration on toggle, where the browser has it. Default true. */
  haptics?: boolean;
  /** Classes of the two bars of the plus icon (their color). */
  iconClassName?: string;
};

export type GooeyMenuInstance = {
  /** The icon box of action i: an svg or any node, drawn in currentColor. */
  icon: (i: number) => HTMLElement;
  update: (props: Partial<GooeyMenuProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { items: [] as GooeyMenuItem[], size: 56, distance: 92, startAngle: -90, endAngle: -180, haptics: true };

/** Reduced motion: the drops pour out and melt back in this fast. */
const REDUCED_MS = 200;
const PAD = 16;
const NS = 'http://www.w3.org/2000/svg';
let ids = 0;

const CSS = `
:where([data-dissolve="gooey-menu"]) { position: relative; flex: none; }
:where(.dissolve-goo-svg) { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
:where(.dissolve-goo-action, .dissolve-goo-main) { position: absolute; display: grid; place-items: center; border-radius: 50%; -webkit-tap-highlight-color: transparent; }
:where(.dissolve-goo-action) { left: 0; top: 0; opacity: 0; pointer-events: none; }
:where([data-dissolve="gooey-menu"][data-open] .dissolve-goo-action) { pointer-events: auto; }
:where(.dissolve-goo-icon) { display: grid; place-items: center; color: var(--dissolve-primary-foreground, rgb(255 255 255)); }
:where(.dissolve-goo-icon) svg { display: block; }
:where(.dissolve-goo-bar) { position: absolute; width: 20px; height: 2.6px; border-radius: 2px; background: var(--dissolve-primary-foreground, rgb(255 255 255)); }
`;

/** Drop i's own progress on the shared timeline: each one leaves a little after the previous. */
const local = (v: number, i: number, n: number) => {
  const step = 0.14;
  return clamp((v - i * step) / Math.max(0.0001, 1 - step * (n - 1)));
};

/** A gooey menu on host. The host gets its size from size and distance. */
export function createGooeyMenu(host: HTMLElement, initial: GooeyMenuProps = {}): GooeyMenuInstance {
  injectStyle('dissolve-gooey-menu', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const id = `dissolve-goo-${++ids}`;

  host.dataset.dissolve = 'gooey-menu';

  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('dissolve-goo-svg');
  svg.setAttribute('aria-hidden', 'true');
  const filter = document.createElementNS(NS, 'filter');
  filter.id = id;
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.innerHTML = '<feGaussianBlur in="SourceGraphic" stdDeviation="9"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/>';
  const defs = document.createElementNS(NS, 'defs');
  defs.append(filter);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('filter', `url(#${id})`);
  g.style.fill = 'var(--dissolve-primary, rgb(28 28 30))';
  const core = document.createElementNS(NS, 'circle');
  svg.append(defs, g);

  const main = plainButton('dissolve-goo-main');
  main.setAttribute('aria-label', 'Actions');
  const bars = [el('span'), el('span')];
  bars[1].style.transform = 'rotate(90deg)';
  main.append(...bars);
  host.append(svg, main);

  const icons: HTMLElement[] = [];
  const icon = (i: number) => (icons[i] ??= el('span', 'dissolve-goo-icon'));

  type Drop = { dir: { x: number; y: number }; strand: SVGCircleElement; drop: SVGCircleElement; action: HTMLButtonElement };
  let drops: Drop[] = [];
  let box = 0, c = { x: 0, y: 0 }, itemSize = 0;
  let open = false;

  const render = () => {
    const { distance } = p(), n = drops.length, r = itemSize / 2;
    drops.forEach((d, i) => {
      const t = local(pr.v, i, n);
      const x = c.x + d.dir.x * distance * t, y = c.y + d.dir.y * distance * t;
      d.drop.setAttribute('cx', x.toFixed(2));
      d.drop.setAttribute('cy', y.toFixed(2));
      d.drop.setAttribute('r', (r * (0.5 + 0.5 * Math.min(1, t * 1.6))).toFixed(2));
      // A strand from the button to the drop that thins out and breaks around two thirds.
      d.strand.setAttribute('cx', (c.x + d.dir.x * distance * t * 0.5).toFixed(2));
      d.strand.setAttribute('cy', (c.y + d.dir.y * distance * t * 0.5).toFixed(2));
      d.strand.setAttribute('r', (t > 0.7 ? 0 : r * 0.55 * (1 - t / 0.7)).toFixed(2));
      d.action.style.opacity = (t < 0.55 ? 0 : (t - 0.55) / 0.45).toFixed(3);
      d.action.style.transform = `translate(${(x - itemSize / 2).toFixed(2)}px,${(y - itemSize / 2).toFixed(2)}px)`;
    });
    main.style.transform = `rotate(${(pr.v * 45).toFixed(2)}deg)`;
  };
  const pr = value(sc, 0, render);

  function toggle(next = !open) {
    if (p().haptics) vibrate(8);
    open = next;
    host.toggleAttribute('data-open', open);
    main.setAttribute('aria-expanded', String(open));
    drops.forEach((d) => (d.action.tabIndex = open ? 0 : -1));
    return pr.to(open ? 1 : 0, reducedMotion() ? REDUCED_MS : open ? 1000 : 820, IN_OUT_CUBIC);
  }

  /** Geometry: the box, the button, the arc and one drop and one action per item. */
  function build() {
    const { items, size, distance, startAngle, endAngle, iconClassName } = p();
    box = distance + size + PAD * 2;
    c = { x: box - PAD - size / 2, y: box - PAD - size / 2 };
    itemSize = size * 0.82;
    const R = size / 2, n = items.length;
    host.style.width = host.style.height = box + 'px';
    svg.setAttribute('width', String(box));
    svg.setAttribute('height', String(box));
    for (const [k, v] of [['x', 0], ['y', 0], ['width', box], ['height', box]] as const) filter.setAttribute(k, String(v));
    core.setAttribute('cx', String(c.x));
    core.setAttribute('cy', String(c.y));
    core.setAttribute('r', String(R));
    Object.assign(main.style, { left: c.x - R + 'px', top: c.y - R + 'px', width: size + 'px', height: size + 'px' });
    for (const b of bars) b.className = 'dissolve-goo-bar' + (iconClassName ? ' ' + iconClassName : '');

    drops.forEach((d) => d.action.remove());
    g.replaceChildren(core);
    drops = items.map((item, i) => {
      const a = ((startAngle + ((endAngle - startAngle) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
      const strand = document.createElementNS(NS, 'circle'), drop = document.createElementNS(NS, 'circle');
      g.append(strand, drop);
      const action = plainButton('dissolve-goo-action');
      action.tabIndex = open ? 0 : -1;
      if (item.label) action.setAttribute('aria-label', item.label);
      action.style.width = action.style.height = itemSize + 'px';
      action.append(icon(i));
      action.addEventListener('click', () => {
        p().items[i]?.onPress();
        toggle(false);
      });
      host.insertBefore(action, main);
      return { dir: { x: Math.cos(a), y: Math.sin(a) }, strand, drop, action };
    });
    render();
  }

  const onMain = () => toggle();
  main.addEventListener('click', onMain);
  build();
  main.setAttribute('aria-expanded', 'false');

  return {
    icon,
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      const prev = drops.length;
      const items = p().items;
      // New callbacks for the same actions only need new labels.
      if (changed.size === 1 && changed.has('items') && items.length === prev) {
        drops.forEach((d, i) => {
          const label = items[i].label;
          if (label) d.action.setAttribute('aria-label', label);
          else d.action.removeAttribute('aria-label');
        });
        return;
      }
      build();
    },
    destroy() {
      sc.dispose();
      main.removeEventListener('click', onMain);
      svg.remove();
      main.remove();
      drops.forEach((d) => d.action.remove());
      host.style.removeProperty('width');
      host.style.removeProperty('height');
      host.removeAttribute('data-open');
      delete host.dataset.dissolve;
    },
  };
}
