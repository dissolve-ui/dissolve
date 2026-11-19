/**
 * Motion helpers shared by the dissolve components (dissolve-ui). This file is yours:
 * change the curve here and every component that imports it follows.
 * `npx dissolve-ui add` copies it next to the components that use it.
 */
import { Easing } from 'react-native-reanimated';

/** The calm iOS curve, no bounce: for withTiming and layout transitions. */
export const CALM = Easing.bezier(0.32, 0.72, 0, 1);

/** The same curve as a plain function of t (0..1), callable per element inside a frame worklet. */
export const CALM_FN = Easing.bezierFn(0.32, 0.72, 0, 1);

/** Resolves after `ms` milliseconds (JS thread). */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Clamps to 0..1. */
export function clamp01(v: number) {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Deterministic 0..1 noise from two integers: the same on every run and on the web ports. */
export function hash(i: number, k: number) {
  'worklet';
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
