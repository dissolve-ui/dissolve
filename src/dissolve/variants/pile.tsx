import { useEffect, useMemo, useRef } from 'react';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDissolveContext } from '../context';
import { Particles } from '../Particles';
import type { AtlasVariant, Burst, BurstParams, CustomVariant, RendererProps } from '../types';
import { bake, heapFor, pileStore, spanMax, spanSet, type PileStore } from './pile.store';

/**
 * GROUP F. pile: sand falls and heaps on the floor (docs/VARIANTS.md section 9).
 *
 * Deterministic stacking precomputed once on the JS side, no physics per frame:
 * 1. every grain gets a drift x, a fall time from real gravity and a landing key
 *    delay + fall;
 * 2. kept grains (n0, default 0.35, the rest falls as dust and fades) are sorted
 *    by that key and dropped one by one on the shared height profile of the floor,
 *    sliding toward the lower neighbour while the slope is above the angle of repose;
 * 3. the step only interpolates from the view to the landing spot (quadratic fall),
 *    then plays a tiny settle hop. Grains never fade once they land.
 * When the burst settles, its kept grains are baked into the frozen heap image (one image
 * per floor, kept in the provider layer 'pile'), so a thousand deletions cost one image.
 */

const END = 1.4;
/** Gravity in pt/s^2, in real time (P.sec), so the fall reads the same at any size. */
const GRAVITY = 2400;
/** Progress units spent settling after landing. */
const SETTLE = 0.12;
const MIN_FALL = 0.12;
/** Slope limit: a column may stand at most this many grains above its lower neighbour (about 27 deg). */
const REPOSE = 0.5;
/** Height added per grain, slightly packed. */
const PACK = 0.9;
const SLIDE_STEPS = 12;

/** Extras: d[k+8] xf, d[k+9] yf (window), d[k+10] tl (local t of landing, -1 for dust). */
const EXTRA = 3;

type Stash = { d: number[]; stride: number; count: number; P: BurstParams; committed: boolean };

function makeAtlas(store: PileStore, stash: { current: Stash | null }): AtlasVariant {
  return {
    kind: 'atlas',
    name: 'pile',
    info: pile.info,
    defaultGrain: pile.defaultGrain,
    end: END,
    natural: 'out',
    extra: EXTRA,
    spread: 0.45,
    jitter: 0.12,
    // Life is rewritten in prepare once the fall distance is known.
    timing: (g, P) => ({ delay: (g.lx / P.w) * 0.45 + g.r1 * 0.12, life: 0.6 }),
    prepare: (d, stride, count, P, burst) => {
      const heap = heapFor(store, P.floorY);
      // Direction 'in' replays the fall backwards: compute on a copy, never commit.
      const committed = burst.direction === 'out';
      const H = committed ? heap.H : heap.H.slice();
      const keep = P.n0 > 0 ? Math.min(1, P.n0) : 0.35;
      const rate = END / Math.max(0.05, P.sec);
      const g = P.grain;
      const order: number[] = [];
      const keys = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        const k = i * stride;
        const delay = d[k + 6];
        const y0 = P.y + d[k + 1];
        const dist = Math.max(0, P.floorY - y0);
        let fall = Math.sqrt((2 * dist) / GRAVITY) * rate;
        // Keep everything inside the timeline even for short durations.
        fall = Math.max(MIN_FALL, Math.min(fall, END - SETTLE - delay));
        d[k + 7] = fall + SETTLE;
        if (d[k + 4] < keep) {
          d[k + 10] = fall / (fall + SETTLE);
          keys[i] = delay + fall;
          order.push(i);
        } else {
          d[k + 10] = -1;
          d[k + 7] = Math.max(MIN_FALL, Math.min(0.55, END - delay));
        }
      }
      order.sort((a, b) => keys[a] - keys[b]);
      const W = heap.width;
      for (const i of order) {
        const k = i * stride;
        let xc = P.x + d[k] + (d[k + 3] - 0.3) * 30;
        xc = Math.min(W - g / 2, Math.max(g / 2, xc));
        let hc = spanMax(H, xc, g);
        for (let s = 0; s < SLIDE_STEPS; s++) {
          const hl = spanMax(H, xc - g, g);
          const hr = spanMax(H, xc + g, g);
          const low = Math.min(hl, hr);
          if (!(hc > low + g * REPOSE)) break;
          xc += hl <= hr ? -g : g;
          hc = spanMax(H, xc, g);
        }
        if (!isFinite(hc)) hc = 0;
        d[k + 8] = xc;
        d[k + 9] = P.floorY - hc - g / 2;
        spanSet(H, xc, g, hc + g * PACK);
      }
      stash.current = { d, stride, count, P, committed };
    },
    step: (t, d, k, P, _a0, _a1, o) => {
      'worklet';
      const tl = d[k + 10];
      const x0 = P.x + d[k];
      const y0 = P.y + d[k + 1];
      if (tl < 0) {
        // Dust: pours down like sand and fades before reaching the floor.
        const e = t * t;
        const drop = P.floorY - y0;
        o.cx = x0 + (d[k + 3] - 0.3) * 30 * e;
        o.cy = y0 + (drop > 0 ? Math.min(drop, 260) : 0) * e;
        o.s = 1 - t * 0.4;
        return;
      }
      const xf = d[k + 8];
      const yf = d[k + 9];
      o.a = 1;
      if (t < tl) {
        const q = t / tl;
        o.cx = x0 + (xf - x0) * q;
        o.cy = y0 + (yf - y0) * q * q;
        o.rot = (d[k + 5] - 0.5) * 3 * Math.sin(Math.PI * q);
      } else {
        // Micro settle: one small hop that dies out, exactly at rest when t = 1.
        const u = tl < 1 ? (t - tl) / (1 - tl) : 1;
        const v = 1 - u;
        o.cx = xf;
        o.cy = yf - Math.abs(Math.sin(u * Math.PI * 2)) * 1.6 * v * v;
      }
    },
  };
}

/** Bakes the landed grains of a settled burst into the frozen heap. */
function freeze(store: PileStore, burst: Burst, s: Stash) {
  const { d, stride, count, P } = s;
  const g = P.grain;
  const pr = P.pr;
  const iw = burst.image.width();
  const ih = burst.image.height();
  const cols = P.cols;
  const srcs: { x: number; y: number; w: number; h: number }[] = [];
  const cx: number[] = [];
  const cy: number[] = [];
  for (let i = 0; i < count; i++) {
    const k = i * stride;
    if (d[k + 10] < 0) continue;
    const sx = (i % cols) * g * pr;
    const sy = Math.floor(i / cols) * g * pr;
    srcs.push({ x: sx, y: sy, w: Math.min(g * pr, iw - sx), h: Math.min(g * pr, ih - sy) });
    cx.push(d[k + 8]);
    cy.push(d[k + 9]);
  }
  bake(store, heapFor(store, P.floorY), { image: burst.image, pr, grain: g, srcs, cx, cy });
}

function PileRenderer({ burst, progress, end }: RendererProps) {
  const ctx = useDissolveContext();
  const store = pileStore(ctx);
  const stash = useRef<Stash | null>(null);
  const frozen = useRef(false);
  const variant = useMemo(() => makeAtlas(store, stash), [store]);

  const onSettled = () => {
    const s = stash.current;
    if (frozen.current || !s || !s.committed) return;
    frozen.current = true;
    freeze(store, burst, s);
  };

  useAnimatedReaction(
    () => progress.value >= end - 1e-4,
    (done, prev) => {
      if (done && !prev) scheduleOnRN(onSettled);
    },
  );

  // Release the buffers with the burst.
  useEffect(() => () => void (stash.current = null), []);

  return <Particles burst={burst} variant={variant} progress={progress} />;
}

export const pile: CustomVariant = {
  kind: 'custom',
  name: 'pile',
  info: 'Pours down and piles up on the floor. The heap stays until you sweep it.',
  defaultGrain: 2.5,
  end: END,
  natural: 'out',
  resolve: ({ opts }) => ({ duration: opts.duration ?? 2000 }),
  Renderer: PileRenderer,
};
