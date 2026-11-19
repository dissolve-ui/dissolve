/**
 * Skeleton for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (skeleton.tsx) wraps it; it also runs on its own:
 *
 *   const sk = createSkeleton(root, { loading: true });
 *   const name = sk.block(nameBox, { width: 160, height: 25 });
 *   name.slot.textContent = user.name;
 *   sk.update({ loading: false });
 *
 * Loading placeholders that do not crossfade into the content: when loading turns false, every
 * placeholder block breaks into grains and those same grains recompose the real content, block by
 * block in reading order (the engine's morph). While loading, a calm wave of light rolls across
 * the blocks, top left to bottom right. Same wave, stagger compression and timings as the React
 * Native version. The placeholders follow --dissolve-surface (or the color token you pick).
 */
import { morph } from './engine';
import { CALM, capture, clamp, el, frame, injectStyle, loop, propsOf, reducedMotion, scope, vibrate } from './kit';

export type SkeletonShape = 'line' | 'circle' | 'rect';
export type SkeletonToken = 'surface' | 'surface-2' | 'border';

export type SkeletonProps = {
  /** True shows the placeholders, false hands each one over to its content in grains. */
  loading: boolean;
  /** Wave of light across the blocks while loading. Off under reduced motion. Default true. */
  shimmer?: boolean;
  /** Placeholder fill as a theme token. Default 'surface'. */
  color?: SkeletonToken;
  /** Delay between two blocks in ms, in reading order, compressed so the handoff stays under about 900 ms. Default 70. */
  stagger?: number;
  /** Duration of one block's handoff in ms. Default 600. */
  duration?: number;
  /** Grain size in px. Default 3. */
  grain?: number;
  /** A short vibration as the first grains land, where the browser has it. Default true. */
  haptics?: boolean;
  /** Called once every block shows its content. */
  onReveal?: () => void;
};

export type SkeletonBlockProps = {
  /** Placeholder shape. Default 'line'. */
  shape?: SkeletonShape;
  /** Placeholder width: px or any CSS length. Default '100%' (circle: size). */
  width?: number | string;
  /** Placeholder height in px. line: the line height (default 20), rect: default 120. */
  height?: number;
  /** circle: the diameter. Default 40. */
  size?: number;
  /** Corner radius. Default: round ends for a line, 12 for a rect. */
  radius?: number;
  /** line: stacked bars, the last one at 60 %, for a paragraph. Default 1. */
  lines?: number;
  /** Placeholder classes (a different fill...). */
  className?: string;
};

export type SkeletonBlockInstance = {
  /** The real content. Hidden while loading, built from the placeholder's grains after. */
  slot: HTMLElement;
  update: (props: Partial<SkeletonBlockProps>) => void;
  destroy: () => void;
};

export type SkeletonInstance = {
  /** Turns host (anywhere inside the skeleton) into a placeholder block for the content of its slot. */
  block: (host: HTMLElement, props?: SkeletonBlockProps) => SkeletonBlockInstance;
  update: (props: Partial<SkeletonProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { shimmer: true, color: 'surface' as SkeletonToken, stagger: 70, duration: 600, grain: 3, haptics: true };
const BLOCK_DEFAULTS = { shape: 'line' as SkeletonShape, lines: 1 };

/** One wave every 1.8 s, travelling 520 px per cycle, dipping the blocks to 58 %. */
const WAVE_MS = 1800;
const WAVE_SPAN = 520;
const DEPTH = 0.42;
/** The wave settles before the snapshot, so the first grain frame is the block as seen. */
const SETTLE = 180;
/** The whole handoff, every block included, stays under this. */
const TOTAL = 900;
const FADE = 240;
/** Two snapshots per block: keep each side at half the engine cap. */
const MAX_GRAINS = 2500;
const CALM_CSS = 'cubic-bezier(0.32, 0.72, 0, 1)';

const CSS = `
:where([data-dissolve="skeleton-block"]) { position: relative; }
:where(.dissolve-skeleton-ph) { display: flex; flex-direction: column; justify-content: center; pointer-events: none; }
:where(.dissolve-skeleton-line) { display: flex; align-items: center; flex: none; }
:where(.dissolve-skeleton-bar) { display: block; flex: none; background: var(--dissolve-surface, rgb(242 242 247)); }
:where([data-dissolve="skeleton"][data-fill="surface-2"] .dissolve-skeleton-bar) { background: var(--dissolve-surface-2, rgb(229 229 234)); }
:where([data-dissolve="skeleton"][data-fill="border"] .dissolve-skeleton-bar) { background: var(--dissolve-border, rgb(60 60 67 / 0.12)); }
`;

const px = (v: number | string) => (typeof v === 'number' ? v + 'px' : v);

type Block = {
  ph: HTMLElement;
  slot: HTMLElement;
  /** Placeholder opacity before the wave: 1 shown, 0 handed over. */
  vis: number;
  phase: number;
  state: 'loading' | 'handing' | 'done';
  /** Draws the placeholder bars and sizes the placeholder from the block props. */
  shape: () => void;
};

export function createSkeleton(host: HTMLElement, initial: SkeletonProps): SkeletonInstance {
  injectStyle('dissolve-skeleton', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const blocks = new Set<Block>();
  host.dataset.dissolve = 'skeleton';
  host.dataset.fill = p().color;

  // The wave: one clock for every block, each one reads it with its own phase.
  let wave = 0, waveFrom = 0, waveTo = 0, waveAt = 0, waveMs = 0, dirty = true, run = 0;
  const waving = () => p().loading && p().shimmer;
  const setWave = (to: number, ms: number) => {
    waveFrom = wave;
    waveTo = to;
    waveAt = performance.now();
    waveMs = ms;
    lp.kick();
  };

  /** Wave phase per block from its place in the skeleton, top left first. */
  function phases() {
    const r = host.getBoundingClientRect(), s = r.width / host.offsetWidth || 1;
    for (const b of blocks) {
      if (b.state !== 'loading') continue;
      const q = b.ph.getBoundingClientRect();
      b.phase = ((q.top - r.top) / s + ((q.left - r.left) / s) * 0.5) / WAVE_SPAN;
    }
    dirty = false;
  }

  const lp = loop(sc, host, (now) => {
    if (dirty) phases();
    const k = waveMs > 0 ? clamp((now - waveAt) / waveMs) : 1;
    wave = waveFrom + (waveTo - waveFrom) * CALM(k);
    const c = (now % WAVE_MS) / WAVE_MS;
    const w = reducedMotion() ? 0 : wave;
    for (const b of blocks) {
      const dip = w > 0 ? DEPTH * w * (0.5 + 0.5 * Math.cos(2 * Math.PI * (c - b.phase))) : 0;
      b.ph.style.opacity = String(b.vis * (1 - dip));
    }
  }, () => waving() || wave > 0.001 || waveTo > 0);

  const ro = new ResizeObserver(() => { dirty = true; lp.kick(); });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());

  /** Placeholder out of the flow at its loading size, content in the flow (hidden, still capturable). */
  function handing(b: Block) {
    const w = b.ph.offsetWidth, h = b.ph.offsetHeight;
    Object.assign(b.ph.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px' });
    b.slot.style.transition = 'none';
    b.slot.style.opacity = '0';
    b.slot.style.display = '';
    b.state = 'handing';
  }

  function land(b: Block, fade: number) {
    if (fade) void b.slot.offsetHeight;
    b.slot.style.transition = fade ? `opacity ${fade}ms ${CALM_CSS}` : 'none';
    b.slot.style.opacity = '';
    b.vis = 0;
    b.state = 'done';
    lp.kick();
  }

  function layoutDone(b: Block) {
    b.ph.style.display = 'none';
    b.vis = 0;
    b.slot.style.display = '';
    b.state = 'done';
  }

  async function handoff() {
    const id = ++run;
    const live = () => sc.alive && run === id;
    const list = [...blocks].filter((b) => b.state === 'loading');
    if (!list.length) return p().onReveal?.();
    list.forEach(handing);
    if (reducedMotion()) {
      wave = waveTo = 0;
      list.forEach((b) => land(b, FADE));
      await sc.wait(FADE);
      if (!live()) return;
      list.forEach(layoutDone);
      return p().onReveal?.();
    }
    setWave(0, SETTLE);
    await sc.wait(SETTLE);
    await frame();
    await frame();
    if (!live()) return;
    const shots = await Promise.all(list.map((b) => Promise.all([capture(b.ph), capture(b.slot)])));
    if (!live()) return;
    // Reading order: rows top to bottom (a few px of tolerance), then left to right.
    const jobs = list.map((b, k) => ({ b, from: shots[k][0], to: shots[k][1] }));
    jobs.sort((x, y) => (Math.abs(x.from.y - y.from.y) > 6 ? x.from.y - y.from.y : x.from.x - y.from.x));
    const { stagger, duration, grain, haptics } = p();
    const step = jobs.length > 1 ? Math.max(0, Math.min(stagger, (TOTAL - duration) / (jobs.length - 1))) : 0;
    if (haptics) sc.wait(duration * 0.45).then(() => { if (live()) vibrate(10); });
    await Promise.all(jobs.map(async ({ b, from, to }, i) => {
      if (i) await sc.wait(i * step);
      if (!live()) return;
      // Nothing to draw on one side: a plain crossfade.
      if (!from.w || !from.h || !to.w || !to.h) {
        land(b, FADE);
        return sc.wait(FADE);
      }
      const g = Math.max(grain, Math.sqrt((from.w * from.h) / MAX_GRAINS), Math.sqrt((to.w * to.h) / MAX_GRAINS));
      const h = morph(from, to, { grain: g, duration });
      // The overlay paints the placeholder first, then the real one hides.
      frame().then(frame).then(() => { if (live()) { b.vis = 0; lp.kick(); } });
      await h.done;
      if (live()) land(b, 0);
    }));
    if (!live()) return;
    list.forEach(layoutDone);
    p().onReveal?.();
  }

  /** Back to the placeholders: they fade in over the content fading out, then the wave starts again. */
  async function toLoading() {
    const id = ++run;
    const list = [...blocks].filter((b) => b.state !== 'loading');
    for (const b of list) {
      b.ph.style.display = '';
      for (const k of ['position', 'left', 'top'] as const) b.ph.style[k] = '';
      b.shape();
      b.vis = 0;
      b.state = 'loading';
      Object.assign(b.slot.style, { position: 'absolute', left: '0', top: '0', transition: `opacity ${FADE}ms ${CALM_CSS}`, opacity: '0' });
    }
    dirty = true;
    if (waving()) setWave(1, 400);
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const f = (now: number) => {
        if (!sc.alive || run !== id) return done();
        const e = CALM(clamp((now - t0) / FADE));
        list.forEach((b) => { b.vis = e; });
        lp.kick();
        if (e < 1) requestAnimationFrame(f);
        else done();
      };
      requestAnimationFrame(f);
    });
    if (run !== id) return;
    for (const b of list) {
      b.slot.style.display = 'none';
      for (const k of ['position', 'left', 'top', 'transition', 'opacity'] as const) b.slot.style[k] = '';
    }
  }

  function block(bhost: HTMLElement, init: SkeletonBlockProps = {}): SkeletonBlockInstance {
    const bp = propsOf(BLOCK_DEFAULTS, init);
    bhost.dataset.dissolve = 'skeleton-block';
    const ph = el('div', 'dissolve-skeleton-ph');
    ph.setAttribute('aria-hidden', 'true');
    const slot = el('div');
    bhost.append(slot, ph);
    const b: Block = { ph, slot, vis: 1, phase: 0, state: 'loading', shape };
    if (p().loading) slot.style.display = 'none';
    else layoutDone(b);
    blocks.add(b);
    lp.kick();

    function shape() {
      const { shape: kind, width, height, size, radius, lines, className } = bp.current;
      const bar = (w: string, h: number, r: number) => {
        const i = el('i', 'dissolve-skeleton-bar' + (className ? ' ' + className : ''));
        Object.assign(i.style, { width: w, height: h + 'px', borderRadius: r + 'px' });
        return i;
      };
      ph.replaceChildren();
      if (kind === 'circle') {
        const d = size ?? height ?? 40;
        Object.assign(ph.style, { width: d + 'px', height: d + 'px' });
        ph.append(bar(d + 'px', d, radius ?? d / 2));
      } else if (kind === 'rect') {
        const h = height ?? 120;
        Object.assign(ph.style, { width: px(width ?? '100%'), height: h + 'px' });
        ph.append(bar('100%', h, radius ?? 12));
      } else {
        const lh = height ?? 20, h = Math.max(6, Math.round(lh * 0.6)), n = Math.max(1, Math.round(lines));
        Object.assign(ph.style, { width: px(width ?? '100%'), height: lh * n + 'px' });
        for (let i = 0; i < n; i++) {
          const line = el('div', 'dissolve-skeleton-line');
          line.style.height = lh + 'px';
          line.append(bar(n > 1 && i === n - 1 ? '60%' : '100%', h, radius ?? h / 2));
          ph.append(line);
        }
      }
      dirty = true;
    }
    shape();

    return {
      slot,
      update(next) {
        if (bp.update(next).size && b.state === 'loading') shape();
      },
      destroy() {
        blocks.delete(b);
        ph.remove();
        slot.remove();
        delete bhost.dataset.dissolve;
      },
    };
  }

  if (waving()) setWave(1, 400);

  return {
    block,
    update(next) {
      const was = p().loading;
      const changed = props.update(next);
      if (changed.has('color')) host.dataset.fill = p().color;
      if (changed.has('loading')) {
        if (p().loading) toLoading();
        else if (was) handoff();
      } else if (changed.has('shimmer') && p().loading) setWave(p().shimmer ? 1 : 0, 400);
    },
    destroy() {
      run++;
      sc.dispose();
      for (const b of blocks) { b.ph.remove(); b.slot.remove(); }
      blocks.clear();
      delete host.dataset.dissolve;
      delete host.dataset.fill;
    },
  };
}
