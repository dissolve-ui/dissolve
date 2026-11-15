import { DEFAULT_END } from '../core';
import type { Burst, BurstParams, FieldFn, GrainSeed, VariantName } from '../types';

/**
 * GROUP D. cascade: a delay field for lists and full screens (docs/VARIANTS.md section 7).
 *
 *   dissolve({ preset: 'dust', field: 'cascade', rows })
 *
 * The field only replaces the delay, the variant keeps its own life and motion.
 *
 * List mode (burst.rowBounds set): one snapshot of the whole container, rows leave one
 * after the other and each row sweeps left to right, which reads as a diagonal wave:
 *   delay = rowIdx * 0.06 + (lx / w) * 0.3 + r1 * 0.08
 * Screen mode (no rows): a continuous diagonal from the top left corner:
 *   delay = (ly / h) * 0.45 + (lx / w) * 0.25 + r1 * 0.08
 *
 * Budget. The engine runs progress 0..end and a grain is fully gone at delay + life.
 * For the LAST frame to be clean (out: every grain gone, in: every grain exactly at rest)
 * we need max(delay) <= end - life. For the FIRST frame we need delay >= 0, so an out
 * grain sits at t = 0 (exact copy of the view) and an in grain at t = 1 (exact rest pose
 * after the engine time reversal). Long lists would overflow the raw formula
 * (20 rows: 1.14 + 0.3 + 0.08), so the three terms are scaled down together when their
 * sum exceeds the budget. Short lists keep the exact spec numbers.
 */

/** Life of the variants whose timing we know, copied from their files (no cross imports). */
const KNOWN_LIFE: Partial<Record<VariantName, number>> = {
  dust: 0.42,
  sand: 0.5,
  ember: 0.4,
  pixel: 0.32,
  vortex: 0.55,
};
/** Life assumed for any other variant. Conservative so unknown variants still end clean. */
const FALLBACK_LIFE = 0.6;
/** Safety margin so float rounding never leaves a grain at t = 0.9999 on the last frame. */
const EPS = 0.005;

const ROW_STEP = 0.06;
const COL_SPAN_ROWS = 0.3;
const ROW_SPAN_FREE = 0.45;
const COL_SPAN_FREE = 0.25;
const JITTER = 0.08;

type Rows = {
  /** Sorted row boundaries in local Y (empty in screen mode). */
  bounds: number[];
  /** Row index of the top edge of the view, and the index span down to the bottom edge. */
  first: number;
  span: number;
};

/** Row structure, computed once per burst (the field runs once per grain). */
const cache = new WeakMap<Burst, Rows>();

/** Number of bounds <= y (binary search). Works for row tops, bottoms or full boundaries. */
function indexOf(bounds: number[], y: number) {
  let lo = 0;
  let hi = bounds.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bounds[mid] <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function rowsOf(burst: Burst, P: BurstParams): Rows {
  const hit = cache.get(burst);
  if (hit) return hit;
  const raw = burst.rowBounds;
  let out: Rows = { bounds: [], first: 0, span: 0 };
  if (raw && raw.length > 0) {
    const bounds = raw.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    // Only the index range actually covered by the view counts (bounds outside 0..h ignored).
    const first = indexOf(bounds, 0);
    const last = indexOf(bounds, Math.max(0, P.h - 0.5));
    out = { bounds, first, span: Math.max(0, last - first) };
  }
  cache.set(burst, out);
  return out;
}

/** Largest delay allowed so the last frame is clean: end - life (minus a hair). */
function budget(burst: Burst, life?: number, end?: number) {
  const l = life ?? KNOWN_LIFE[burst.variant] ?? FALLBACK_LIFE;
  return Math.max(0, (end ?? DEFAULT_END) - l - EPS);
}

/**
 * The FieldFn signature is (g, P, burst). The optional life and end let the engine pass
 * the exact budget; without them the life comes from KNOWN_LIFE or FALLBACK_LIFE.
 */
export const cascadeField: FieldFn = (g: GrainSeed, P: BurstParams, burst: Burst, life?: number, end?: number) => {
  const R = rowsOf(burst, P);
  const B = budget(burst, life, end);
  const fx = P.w > 0 ? Math.min(1, Math.max(0, g.lx / P.w)) : 0;
  if (R.bounds.length > 0) {
    const total = R.span * ROW_STEP + COL_SPAN_ROWS + JITTER;
    const k = total > B ? B / total : 1;
    const idx = Math.min(R.span, Math.max(0, indexOf(R.bounds, g.ly) - R.first));
    return (idx * ROW_STEP + fx * COL_SPAN_ROWS + g.r1 * JITTER) * k;
  }
  const total = ROW_SPAN_FREE + COL_SPAN_FREE + JITTER;
  const k = total > B ? B / total : 1;
  const fy = P.h > 0 ? Math.min(1, Math.max(0, g.ly / P.h)) : 0;
  return (fy * ROW_SPAN_FREE + fx * COL_SPAN_FREE + g.r1 * JITTER) * k;
};
