import type { BurstInput, BurstParams, Direction, Origin } from './types';

/**
 * Pure engine math: no native imports, so Node tests can load this file directly
 * (node --experimental-strip-types). core.ts re-exports everything public from here.
 */

/** Hard cap so large views stay smooth. */
export const MAX_GRAINS = 6000;
export const DEFAULT_END = 1.2;

/** Raise the grain size until the grid stays under MAX_GRAINS. */
export function capGrain(w: number, h: number, grain: number, max = MAX_GRAINS) {
  const min = Math.sqrt((w * h) / max);
  return grain < min ? Math.ceil(min * 2) / 2 : grain;
}

/** Origin as a local point (used by the generic origin delay field). */
function originPoint(o: Origin, w: number, h: number) {
  if (o === 'left') return { x: 0, y: h / 2 };
  if (o === 'right') return { x: w, y: h / 2 };
  if (o === 'top') return { x: w / 2, y: 0 };
  if (o === 'bottom') return { x: w / 2, y: h };
  if (o === 'center') return { x: w / 2, y: h / 2 };
  return o;
}

/**
 * Generic origin field in 0..1 (JS side, used for timing). Edges are line fields,
 * center and points are radial. Clamped: the last grain column or row can stick out of
 * the view (the grid is rounded up), and a negative delay would move it on the first frame.
 */
export function originField(o: Origin | undefined, lx: number, ly: number, P: BurstParams) {
  let f: number;
  if (o === 'left') f = lx / P.w;
  else if (o === 'right') f = 1 - lx / P.w;
  else if (o === 'top') f = ly / P.h;
  else if (o === 'bottom') f = 1 - ly / P.h;
  else {
    const dx = lx - P.ox;
    const dy = ly - P.oy;
    f = Math.sqrt(dx * dx + dy * dy) / (P.maxD || 1);
  }
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/**
 * Engine safety net on a grain delay: never below 0 (an 'out' grain must sit still on the
 * first frame) and never past end - life (it must finish by the last frame). Only grains of
 * the rounded up last column or row, whose center lies outside the view, ever need it.
 */
export function clampDelay(delay: number, life: number, end: number) {
  const max = end - life > 0 ? end - life : 0;
  return delay < 0 ? 0 : delay > max ? max : delay;
}

/** The geometric part of a burst input, all buildParams reads. */
export type ParamsInput = Pick<BurstInput, 'x' | 'y' | 'width' | 'height' | 'duration' | 'origin' | 'velocity' | 'target' | 'n'> & {
  direction?: Direction;
};

export function buildParams(b: ParamsInput, grain: number, pr: number): BurstParams {
  const w = b.width;
  const h = b.height;
  const o = b.origin ? originPoint(b.origin, w, h) : { x: w / 2, y: h / 2 };
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  const maxD = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - o.x, cy - o.y)));
  const t = b.target;
  const n = b.n ?? [];
  return {
    x: b.x,
    y: b.y,
    w,
    h,
    grain,
    pr,
    cols: Math.ceil(w / grain),
    rows: Math.ceil(h / grain),
    maxR: Math.sqrt((w / 2) ** 2 + (h / 2) ** 2),
    dir: b.direction === 'in' ? 1 : 0,
    sec: b.duration / 1000,
    hasOrigin: b.origin ? 1 : 0,
    ox: o.x,
    oy: o.y,
    maxD,
    vx: b.velocity?.x ?? 0,
    vy: b.velocity?.y ?? 0,
    tx: t ? t.x + t.width / 2 : 0,
    ty: t ? t.y + t.height / 2 : 0,
    tw: t?.width ?? 0,
    th: t?.height ?? 0,
    n0: n[0] ?? 0,
    n1: n[1] ?? 0,
    n2: n[2] ?? 0,
    n3: n[3] ?? 0,
  };
}

/**
 * Burst geometry from an input and its variant: capped grain, default direction and the
 * flat params (variant overrides merged last). imageWidth is the snapshot width in pixels.
 */
export function burstGeometry(
  b: ParamsInput & { grain?: number; paramsOverride?: Partial<BurstParams> },
  v: { defaultGrain: number; natural?: Direction | 'both' },
  imageWidth: number,
) {
  const grain = capGrain(b.width, b.height, b.grain ?? v.defaultGrain);
  const pr = imageWidth / b.width;
  const direction: Direction = b.direction ?? (v.natural === 'in' ? 'in' : 'out');
  const params: BurstParams = { ...buildParams({ ...b, direction }, grain, pr), ...b.paramsOverride };
  return { grain, direction, params };
}

// Easing helpers usable from any worklet.
export const ss = (t: number) => {
  'worklet';
  return t * t * (3 - 2 * t);
};
export const eo = (t: number) => {
  'worklet';
  const u = 1 - t;
  return 1 - u * u * u;
};
export const backOut = (t: number) => {
  'worklet';
  const u = t - 1;
  return 1 + 2.7 * u * u * u + 1.7 * u * u;
};
export const clamp01 = (t: number) => {
  'worklet';
  return t < 0 ? 0 : t > 1 ? 1 : t;
};
