import type { RefObject } from 'react';
import { Dimensions, type View } from 'react-native';
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import type { Box, BurstInput, BurstParams, Origin } from './types';

/**
 * Shared helpers for builders. Owned by the master agent.
 */

/** Hard cap so large views stay smooth. */
export const MAX_GRAINS = 6000;
export const DEFAULT_END = 1.2;

/** Raise the grain size until the grid stays under MAX_GRAINS. */
export function capGrain(w: number, h: number, grain: number, max = MAX_GRAINS) {
  const min = Math.sqrt((w * h) / max);
  return grain < min ? Math.ceil(min * 2) / 2 : grain;
}

export function measure(ref: RefObject<View | null>): Promise<Box | null> {
  return new Promise((res) => {
    const v = ref.current;
    if (!v) return res(null);
    v.measureInWindow((x, y, width, height) => res({ x, y, width, height }));
  });
}

/** Snapshot plus window rect, in parallel. Null when the view is gone or empty. */
export async function capture(ref: RefObject<View | null>): Promise<{ image: SkImage; box: Box } | null> {
  if (!ref.current) return null;
  const [image, box] = await Promise.all([makeImageFromView(ref as RefObject<View>), measure(ref)]);
  if (!image || !box || box.width === 0 || box.height === 0) return null;
  return { image, box };
}

/** Wait n animation frames. */
export function frames(n = 2) {
  return new Promise<void>((res) => {
    const tick = (left: number) => (left <= 0 ? res() : requestAnimationFrame(() => tick(left - 1)));
    tick(n);
  });
}

/** Default haptics: soft impact, then a few ticks during the sweep. */
export function defaultHaptics(duration: number) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  [0.08, 0.18, 0.28].forEach((f) => setTimeout(() => Haptics.selectionAsync(), duration * f));
}

/** Origin as a local point plus its kind (used by the generic origin delay field). */
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
 * center and points are radial.
 */
export function originField(o: Origin | undefined, lx: number, ly: number, P: BurstParams) {
  if (o === 'left') return lx / P.w;
  if (o === 'right') return 1 - lx / P.w;
  if (o === 'top') return ly / P.h;
  if (o === 'bottom') return 1 - ly / P.h;
  const dx = lx - P.ox;
  const dy = ly - P.oy;
  return Math.sqrt(dx * dx + dy * dy) / (P.maxD || 1);
}

export function buildParams(b: BurstInput, grain: number, pr: number): BurstParams {
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
    floorY: b.floorY ?? Dimensions.get('window').height,
    n0: n[0] ?? 0,
    n1: n[1] ?? 0,
    n2: n[2] ?? 0,
    n3: n[3] ?? 0,
  };
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
