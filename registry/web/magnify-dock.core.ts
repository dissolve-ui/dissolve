/**
 * MagnifyDock for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (magnify-dock.tsx) wraps it; it also runs on its own:
 *
 *   const dock = createMagnifyDock(el, {
 *     items: [
 *       { key: 'mail', label: 'Mail', icon: dockIcon('mail') },
 *       { key: 'music', label: 'Music', icon: dockIcon('music') },
 *     ],
 *     onLaunch: (item) => open(item.key),
 *   });
 *
 * The macOS dock. Move the pointer along it and the icons swell around it, each on its own
 * spring: the one under the pointer is the largest, its neighbours ease up with the distance, and
 * the frosted shelf widens with them so nothing overlaps. Icons grow from the bottom, as vectors
 * redrawn at their size (never a scaled bitmap). The name of the icon under the pointer floats
 * above it. Click it and it launches: it hops out of the shelf and bounces once like a ball, then a dot lights under it and stays while the app runs. On a phone, press and slide
 * along the dock to magnify under the finger; lifting launches the icon under it. Keyboard: Tab
 * in, the arrow keys, Home and End move (the focused icon swells), Enter or Space launches.
 * Reduced motion: no magnification and no bounce; names and dots still show.
 *
 * Icons are vector specs on a 100 x 100 grid: dockIcon('finder' | 'mail' | 'music' | 'photos' |
 * 'notes' | 'calendar' | 'settings') gives ready ones, or describe your own (see DockIconSpec).
 * The shelf follows the theme: light or dark from --dissolve-background, or appearance.
 */
import { clamp, el, injectStyle, propsOf, reducedMotion, rgbOf, scope, vibrate } from './kit';

/* ---------- icons: vector specs on a 100 x 100 grid ---------- */

export type DockPaint = string | { from: string; to: string; angle?: number };
export type DockLayer =
  | { d: string; fill?: DockPaint; stroke?: string; width?: number; opacity?: number }
  | { text: string; x: number; y: number; size: number; weight: number; color: string };
/** An app icon: a squircle tile in `tile`, then layers drawn over it, clipped to the tile. */
export type DockIconSpec = { tile: DockPaint; layers: DockLayer[] };

/** The continuous corner tile (a superellipse, as Apple's icon grid), on 0..100. */
export const SQUIRCLE = (() => {
  const n = 5, pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(`${(50 + 50 * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(2)} ${(50 + 50 * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  const a = (rot * Math.PI) / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${cx - dx} ${cy - dy}A${rx} ${ry} ${rot} 1 0 ${cx + dx} ${cy + dy}A${rx} ${ry} ${rot} 1 0 ${cx - dx} ${cy - dy}Z`;
};
const rrect = (x: number, y: number, w: number, h: number, r: number) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const gear = (cx: number, cy: number, teeth: number, ro: number, ri: number, hole: number) => {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const t = (i / (teeth * 4)) * Math.PI * 2, r = i % 4 < 2 ? ro : ri;
    pts.push(`${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z` + ellipse(cx, cy, hole, hole);
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Ready made icons, drawn here (no brand marks). calendar shows today's date. */
export function dockIcon(kind: 'finder' | 'mail' | 'music' | 'photos' | 'notes' | 'calendar' | 'settings', date = new Date()): DockIconSpec {
  switch (kind) {
    case 'finder': return {
      tile: { from: '#EAF3FC', to: '#C9DDF3' },
      layers: [
        { d: 'M0 0H55C47 18 58 30 49 44C44 52 52 58 49 66C47 76 54 86 51 100H0Z', fill: { from: '#6CC4FF', to: '#1F6FE5' } },
        { d: rrect(31, 30, 7, 17, 3.5), fill: '#0B2545' },
        { d: rrect(62, 30, 7, 17, 3.5), fill: '#0B2545' },
        { d: 'M27 66Q50 84 73 66', stroke: '#0B2545', width: 4.5 },
      ],
    };
    case 'mail': return {
      tile: { from: '#5FB8FF', to: '#1C6FEF' },
      layers: [
        { d: rrect(18, 30, 64, 42, 6), fill: '#FFFFFF' },
        { d: 'M21 34L50 55L79 34', stroke: '#8DC3FF', width: 3.5 },
      ],
    };
    case 'music': return {
      tile: { from: '#FF6B86', to: '#F42A47' },
      layers: [
        { d: 'M38 30L72 22V31L38 39Z', fill: '#FFFFFF' },
        { d: 'M38 33H43V67H38ZM67 24H72V60H67Z', fill: '#FFFFFF' },
        { d: ellipse(33, 67, 9.5, 7, -22), fill: '#FFFFFF' },
        { d: ellipse(62, 60, 9.5, 7, -22), fill: '#FFFFFF' },
      ],
    };
    case 'photos': {
      const colors = ['#FF9F0A', '#FFD60A', '#A6D85E', '#34C759', '#5AC8FA', '#5E5CE6', '#BF5AF2', '#FF375F'];
      return {
        tile: { from: '#FFFFFF', to: '#F1F1F4' },
        layers: colors.map((c, i) => {
          const a = (i / 8) * 360 - 90, r = (a * Math.PI) / 180;
          return { d: ellipse(50 + 15 * Math.cos(r), 50 + 15 * Math.sin(r), 17, 9.5, a), fill: c, opacity: 0.82 };
        }),
      };
    }
    case 'notes': return {
      tile: { from: '#FFFFFF', to: '#F4F3EE' },
      layers: [
        { d: 'M0 0H100V27H0Z', fill: { from: '#FFE36E', to: '#FFC900' } },
        ...[45, 57, 69, 81].map((y) => ({ d: `M16 ${y}H84`, stroke: '#D4D4D8', width: 1.8 })),
      ],
    };
    case 'calendar': return {
      tile: { from: '#FFFFFF', to: '#F2F2F5' },
      layers: [
        { text: WEEKDAYS[date.getDay()], x: 50, y: 31, size: 15, weight: 600, color: '#FF3B30' },
        { text: String(date.getDate()), x: 50, y: 80, size: 52, weight: 300, color: '#1C1C1E' },
      ],
    };
    case 'settings': return {
      tile: { from: '#A5A5AB', to: '#66666B' },
      layers: [
        { d: gear(50, 50, 12, 37, 31, 0), fill: { from: '#F2F2F5', to: '#B9B9BF' } },
        { d: ellipse(50, 50, 23, 23), fill: '#55555A' },
        { d: gear(50, 50, 8, 17, 13, 6), fill: { from: '#E8E8EC', to: '#A9A9AF' } },
      ],
    };
  }
}

/* ---------- the dock ---------- */

export type DockItem = { key: string; label: string; icon: DockIconSpec };

export type MagnifyDockProps<T extends DockItem = DockItem> = {
  items?: readonly T[];
  /** Called when an icon launches (a click, a lift on touch, Enter), as it starts to bounce. */
  onLaunch?: (item: T, index: number) => void;
  /** Controlled: keys of the running apps (a dot under each). Pair it with onLaunch. */
  running?: readonly string[];
  /** Uncontrolled: running at first. Launching adds to it. */
  defaultRunning?: readonly string[];
  /** Icon size at rest, px. Default 56. */
  size?: number;
  /** Size of the icon under the pointer, as a multiple. Default 1.9. */
  magnification?: number;
  /** How far the swell reaches, in icons. Default 2.6. */
  reach?: number;
  /** Space between icons, px. Default 6. */
  gap?: number;
  /** The name above the icon under the pointer. Default true. */
  labels?: boolean;
  /** A short vibration on launch, where the browser has it. Default true. */
  haptics?: boolean;
  /** The toolbar's accessible name. Default 'Dock'. */
  label?: string;
  /** The shelf's look: 'auto' (default) reads --dissolve-background, or force 'light' or 'dark'. */
  appearance?: 'auto' | 'light' | 'dark';
};

export type MagnifyDockInstance<T extends DockItem = DockItem> = {
  launch: (index: number) => void;
  update: (props: Partial<MagnifyDockProps<T>>) => void;
  destroy: () => void;
};

const DEFAULTS = { items: [] as readonly DockItem[], size: 56, magnification: 1.9, reach: 2.6, gap: 6, labels: true, haptics: true, label: 'Dock', appearance: 'auto' as 'auto' | 'light' | 'dark' };

/** Same numbers as the React Native version. */
const PAD = 7;
/** Icon springs: quick, a touch under critical damping, like the dock. */
const SPRING = { k: 420, c: 36 };
/** Launch: a ball thrown up a little over half an icon, losing most of its height each bounce. */
const HOP = 0.62, HOP_S = 0.2, RESTITUTION = 0.36;

/** 1 at the pointer, 0 from `reach` icons away: a raised cosine. */
const swell = (d: number, reach: number) => {
  const a = Math.abs(d);
  return a >= reach ? 0 : (1 + Math.cos((Math.PI * a) / reach)) / 2;
};

const CSS = `
:where([data-dissolve="magnify-dock"]) { position: relative; width: 100%; -webkit-user-select: none; user-select: none; touch-action: none; outline: none; }
:where(.dissolve-md-shelf) { position: absolute; bottom: 0; border-radius: 18px; background: rgba(246, 246, 248, 0.58); -webkit-backdrop-filter: saturate(180%) blur(28px); backdrop-filter: saturate(180%) blur(28px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14), inset 0 0 0 0.5px rgba(255, 255, 255, 0.55); pointer-events: none; }
:where([data-dissolve="magnify-dock"][data-dark]) .dissolve-md-shelf { background: rgba(48, 48, 52, 0.55); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), inset 0 0 0 0.5px rgba(255, 255, 255, 0.12); }
:where(.dissolve-md-tile) { position: absolute; left: 0; top: 0; padding: 0; margin: 0; border: 0; background: none; cursor: default; outline: none; -webkit-tap-highlight-color: transparent; transform-origin: 50% 100%; }
:where(.dissolve-md-tile) svg { display: block; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.16)); }
:where(.dissolve-md-tile[data-pressed]) svg { filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.16)) brightness(0.78); }
:where(.dissolve-md-tile:focus-visible)::after { content: ''; position: absolute; inset: -4px; border-radius: 28%; box-shadow: 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
:where(.dissolve-md-dot) { position: absolute; width: 4px; height: 4px; border-radius: 2px; background: rgba(28, 28, 30, 0.7); opacity: 0; transition: opacity 240ms cubic-bezier(0.25, 0.8, 0.25, 1); pointer-events: none; }
:where([data-dissolve="magnify-dock"][data-dark]) .dissolve-md-dot { background: rgba(255, 255, 255, 0.75); }
:where(.dissolve-md-dot[data-on]) { opacity: 1; }
:where(.dissolve-md-tip) { position: absolute; left: 0; top: 0; padding: 0 10px; height: 24px; display: flex; align-items: center; border-radius: 7px; background: rgba(236, 236, 238, 0.86); color: rgb(28 28 30); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14), inset 0 0 0 0.5px rgba(0, 0, 0, 0.08); font: 500 13px/1 -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; letter-spacing: -0.01em; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 120ms cubic-bezier(0.25, 0.8, 0.25, 1); }
:where(.dissolve-md-tip)::after { content: ''; position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; translate: -50% 0; rotate: 45deg; background: inherit; border-radius: 1px; }
:where([data-dissolve="magnify-dock"][data-dark]) .dissolve-md-tip { background: rgba(58, 58, 62, 0.9); color: rgb(242 242 247); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 0 0 0.5px rgba(255, 255, 255, 0.1); }
:where(.dissolve-md-tip[data-on]) { opacity: 1; }
`;

let uid = 0;

function svgOf(spec: DockIconSpec, id: string) {
  const defs: string[] = [];
  let g = 0;
  const paint = (p: DockPaint) => {
    if (typeof p === 'string') return p;
    const gid = `${id}-g${g++}`;
    const a = ((p.angle ?? 90) * Math.PI) / 180;
    const x = Math.cos(a) / 2, y = Math.sin(a) / 2;
    defs.push(`<linearGradient id="${gid}" x1="${0.5 - x}" y1="${0.5 - y}" x2="${0.5 + x}" y2="${0.5 + y}"><stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/></linearGradient>`);
    return `url(#${gid})`;
  };
  const tile = paint(spec.tile);
  const body = spec.layers.map((l) => {
    if ('text' in l) return `<text x="${l.x}" y="${l.y}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="${l.size}" font-weight="${l.weight}" fill="${l.color}" letter-spacing="${l.size > 30 ? -1.5 : 0.5}">${l.text}</text>`;
    const op = l.opacity !== undefined ? ` opacity="${l.opacity}"` : '';
    return l.stroke
      ? `<path d="${l.d}" fill="none" stroke="${l.stroke}" stroke-width="${l.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"${op}/>`
      : `<path d="${l.d}" fill="${paint(l.fill ?? '#000')}"${op}/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}-c"><path d="${SQUIRCLE}"/></clipPath>${defs.join('')}</defs><path d="${SQUIRCLE}" fill="${tile}"/><g clip-path="url(#${id}-c)">${body}</g></svg>`;
}

type Tile = { btn: HTMLButtonElement; dot: HTMLElement; s: number; v: number; y: number; vy: number; hopping: boolean };

export function createMagnifyDock<T extends DockItem>(host: HTMLElement, initial: MagnifyDockProps<T> = {}): MagnifyDockInstance<T> {
  injectStyle('dissolve-magnify-dock', CSS);
  const props = propsOf(DEFAULTS as typeof DEFAULTS & { items: readonly T[] }, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const id = `dissolve-md-${++uid}`;

  host.dataset.dissolve = 'magnify-dock';
  host.setAttribute('role', 'toolbar');
  const shelf = el('div', 'dissolve-md-shelf');
  const tip = el('div', 'dissolve-md-tip');
  tip.setAttribute('aria-hidden', 'true');
  host.append(shelf, tip);

  let tiles: Tile[] = [];
  let own: string[] = [...(p().defaultRunning ?? [])];
  /** The pointer in px from the host's left edge, and whether it is on the dock (0..1, eased). */
  let px = -1e4, engaged = 0, wantEngaged = 0;
  let hover = -1;
  let raf = 0, last = 0;

  const dark = () => {
    if (p().appearance !== 'auto') return p().appearance === 'dark';
    const [r, g, b] = rgbOf(getComputedStyle(host).getPropertyValue('--dissolve-background').trim() || '#fff');
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
  };

  function build() {
    tiles.forEach((t) => { t.btn.remove(); t.dot.remove(); });
    tiles = p().items.map((item, i) => {
      const btn = el('button', 'dissolve-md-tile') as HTMLButtonElement;
      btn.type = 'button';
      btn.setAttribute('aria-label', item.label);
      btn.tabIndex = i === 0 ? 0 : -1;
      btn.innerHTML = svgOf(item.icon, `${id}-${i}`);
      const dot = el('div', 'dissolve-md-dot');
      host.append(btn, dot);
      btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) aim(i); }, on);
      btn.addEventListener('blur', () => { if (!pointerIn) { wantEngaged = 0; kick(); } }, on);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(i); }
      }, on);
      return { btn, dot, s: 1, v: 0, y: 0, vy: 0, hopping: false };
    });
    layout();
  }

  /** Room for the biggest icon, its hop and its name above the shelf. */
  function layout() {
    const o = p();
    host.style.height = Math.ceil(o.size * o.magnification + o.size * 0.7 + 44 + PAD) + 'px';
    host.setAttribute('aria-label', o.label);
    host.toggleAttribute('data-dark', dark());
    mark();
    draw();
  }

  /** Rest geometry: where icon i's center sits with nothing magnified. */
  const restCenter = (i: number) => {
    const o = p();
    const w = tiles.length * o.size + (tiles.length - 1) * o.gap;
    return (host.clientWidth - w) / 2 + i * (o.size + o.gap) + o.size / 2;
  };
  const nearest = () => {
    const o = p();
    const first = restCenter(0) - o.size / 2 - o.gap / 2;
    return clamp(Math.floor((px - first) / (o.size + o.gap)), 0, tiles.length - 1);
  };

  function step(now: number) {
    raf = 0;
    if (!sc.alive) return;
    const o = p();
    const dt = Math.min(0.032, (now - (last || now)) / 1000) || 1 / 60;
    last = now;
    const still = reducedMotion();
    // The pointer's pull eases in and out with the springs, so arriving and leaving are soft too.
    engaged += (wantEngaged - engaged) * Math.min(1, dt * 14);
    if (Math.abs(wantEngaged - engaged) < 0.001) engaged = wantEngaged;
    let moving = engaged !== wantEngaged;
    const cell = o.size + o.gap;
    tiles.forEach((t, i) => {
      const target = still ? 1 : 1 + (o.magnification - 1) * swell((px - restCenter(i)) / cell, o.reach) * engaged;
      // Semi implicit Euler in small steps: stable at any frame rate.
      for (let h = dt, k = 0; h > 0 && k < 8; h -= 1 / 240, k++) {
        const e = Math.min(h, 1 / 240);
        t.v += (SPRING.k * (target - t.s) - SPRING.c * t.v) * e;
        t.s += t.v * e;
      }
      if (Math.abs(target - t.s) < 0.0005 && Math.abs(t.v) < 0.005) { t.s = target; t.v = 0; } else moving = true;
      if (t.hopping) {
        // A ball: gravity pulls it back to the shelf, each landing keeps a third of the speed.
        const g = (2 * HOP * o.size) / (HOP_S * HOP_S);
        t.vy += g * dt;
        t.y += t.vy * dt;
        if (t.y >= 0) {
          t.y = 0;
          t.vy = -t.vy * RESTITUTION;
          // Done once a bounce would be under 4% of the icon.
          if (Math.abs(t.vy) < Math.sqrt(2 * g * 0.04 * o.size)) { t.vy = 0; t.hopping = false; }
        }
        moving = true;
      }
    });
    draw();
    if (moving) kick();
  }
  const kick = () => { if (!raf && sc.alive) { last = performance.now(); raf = requestAnimationFrame(step); } };
  sc.onDispose(() => cancelAnimationFrame(raf));

  /**
   * Positions, anchored at the pointer as macOS does: the point under the pointer keeps its
   * place in its icon, the icons on either side are laid out outward from it with their live
   * sizes, so the icon under the pointer stays under it while the shelf widens around it. At
   * rest (all sizes equal) this is exactly the centered rest layout.
   */
  function draw() {
    const o = p();
    const W = host.clientWidth, H = host.clientHeight, n = tiles.length;
    if (!n) return;
    const cell = o.size + o.gap;
    const restLeft = (W - (n * o.size + (n - 1) * o.gap)) / 2;
    const sizes = tiles.map((t) => o.size * t.s);
    // The anchor: the pointer, held inside the rest row; k its cell, f how far across it.
    const a = clamp(px, restLeft, restLeft + n * cell - o.gap);
    const k = clamp(Math.floor((a - restLeft) / cell), 0, n - 1);
    const f = clamp((a - restLeft - k * cell) / cell);
    const xs: number[] = new Array(n);
    xs[k] = a - f * (sizes[k] + o.gap);
    for (let i = k - 1; i >= 0; i--) xs[i] = xs[i + 1] - o.gap - sizes[i];
    for (let i = k + 1; i < n; i++) xs[i] = xs[i - 1] + sizes[i - 1] + o.gap;
    const left = xs[0], right = xs[n - 1] + sizes[n - 1];
    const base = H - PAD - 6;
    shelf.style.left = (left - PAD).toFixed(2) + 'px';
    shelf.style.width = (right - left + PAD * 2).toFixed(2) + 'px';
    shelf.style.height = o.size + PAD + 6 + 'px';
    shelf.style.borderRadius = Math.round(o.size * 0.28 + PAD) + 'px';
    tiles.forEach((t, i) => {
      const s = sizes[i], x = xs[i];
      t.btn.style.width = t.btn.style.height = s.toFixed(2) + 'px';
      t.btn.style.transform = `translate(${x.toFixed(2)}px, ${(base - s + t.y).toFixed(2)}px)`;
      t.dot.style.transform = `translate(${(x + s / 2 - 2).toFixed(2)}px, ${(base + 1).toFixed(2)}px)`;
      if (i === hover) tip.style.transform = `translate(calc(${(x + s / 2).toFixed(2)}px - 50%), ${(base - s + t.y - 34).toFixed(2)}px)`;
    });
    tip.toggleAttribute('data-on', o.labels && hover >= 0 && engaged > 0.3);
  }

  function setHover(i: number) {
    if (i === hover) return;
    hover = i;
    if (i >= 0) tip.textContent = p().items[i]?.label ?? '';
    draw();
  }

  function mark() {
    const lit = p().running ?? own;
    tiles.forEach((t, i) => {
      const on = lit.includes(p().items[i]?.key);
      t.dot.toggleAttribute('data-on', on && !t.hopping);
      t.btn.setAttribute('aria-pressed', String(on));
    });
  }

  function aim(i: number) {
    px = restCenter(i);
    wantEngaged = 1;
    setHover(i);
    kick();
  }

  function launch(i: number) {
    const item = p().items[i];
    const t = tiles[i];
    if (!item || !t) return;
    const running = (p().running ?? own).includes(item.key);
    tiles.forEach((x, k) => (x.btn.tabIndex = k === i ? 0 : -1));
    if (p().haptics) vibrate(8);
    // A running app does not bounce again, as on macOS.
    if (!running && !reducedMotion()) {
      const g = (2 * HOP * p().size) / (HOP_S * HOP_S);
      t.vy = -Math.sqrt(2 * g * HOP * p().size);
      t.hopping = true;
      kick();
      // The dot lights once it has landed.
      const wait = () => { if (!sc.alive) return; if (t.hopping) requestAnimationFrame(wait); else mark(); };
      requestAnimationFrame(wait);
    }
    if (!p().running && !own.includes(item.key)) own = [...own, item.key];
    mark();
    p().onLaunch?.(item, i);
  }

  // Pointer: hover magnifies (mouse); a press and slide magnifies (touch). Lifting on an icon launches.
  let pointerIn = false;
  let down: { id: number; i: number; touch: boolean } | null = null;
  const track = (e: PointerEvent) => {
    px = e.clientX - host.getBoundingClientRect().left;
    setHover(nearest());
    kick();
  };
  const overDock = (e: PointerEvent) => {
    const r = shelf.getBoundingClientRect();
    return e.clientX >= r.left - 4 && e.clientX <= r.right + 4 && e.clientY >= host.getBoundingClientRect().top;
  };
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && !down) {
      const inside = overDock(e) && e.clientY > host.getBoundingClientRect().bottom - p().size * p().magnification - PAD - 8;
      if (inside !== pointerIn) { pointerIn = inside; wantEngaged = inside ? 1 : 0; if (!inside) setHover(-1); }
      if (!inside) { kick(); return; }
    }
    if (e.pointerType !== 'mouse' && !down) return;
    track(e);
  }, on);
  host.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || down) return;
    pointerIn = false;
    wantEngaged = 0;
    setHover(-1);
    kick();
  }, on);
  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !overDock(e)) return;
    try { host.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const touch = e.pointerType !== 'mouse';
    track(e);
    down = { id: e.pointerId, i: hover, touch };
    if (touch) { pointerIn = true; wantEngaged = 1; kick(); }
    tiles[hover]?.btn.toggleAttribute('data-pressed', true);
  }, on);
  const up = (e: PointerEvent, cancel = false) => {
    if (!down || e.pointerId !== down.id) return;
    const d = down;
    down = null;
    tiles.forEach((t) => t.btn.removeAttribute('data-pressed'));
    // Mouse: a click on the icon it pressed. Touch: whichever icon is under the finger.
    const i = d.touch ? hover : nearest();
    if (!cancel && overDock(e) && i >= 0 && (d.touch || i === d.i)) launch(i);
    if (d.touch) { pointerIn = false; wantEngaged = 0; setHover(-1); kick(); }
  };
  host.addEventListener('pointerup', (e) => up(e), on);
  host.addEventListener('pointercancel', (e) => up(e, true), on);
  host.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    tiles.forEach((t, k) => t.btn.toggleAttribute('data-pressed', !down!.touch && k === down!.i && k === hover));
  }, on);

  // Keyboard: a toolbar with a roving tab stop.
  host.addEventListener('keydown', (e) => {
    const n = tiles.length - 1;
    const at = tiles.findIndex((t) => t.btn === document.activeElement);
    if (at < 0) return;
    const to = e.key === 'ArrowRight' ? Math.min(n, at + 1) : e.key === 'ArrowLeft' ? Math.max(0, at - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? n : null;
    if (to === null) return;
    e.preventDefault();
    tiles.forEach((t, i) => (t.btn.tabIndex = i === to ? 0 : -1));
    tiles[to].btn.focus();
    aim(to);
  }, on);

  const ro = new ResizeObserver(() => draw());
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());

  build();

  return {
    launch,
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      if (changed.has('items')) build();
      else layout();
    },
    destroy() {
      sc.dispose();
      ac.abort();
      tiles.forEach((t) => { t.btn.remove(); t.dot.remove(); });
      shelf.remove();
      tip.remove();
      host.style.height = '';
      host.removeAttribute('role');
      host.removeAttribute('aria-label');
      host.removeAttribute('data-dark');
      delete host.dataset.dissolve;
    },
  };
}
