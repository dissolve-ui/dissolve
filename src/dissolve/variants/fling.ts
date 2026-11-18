import * as Haptics from 'expo-haptics';
import { DEFAULT_END, eo } from '../core';
import type { AtlasVariant, BurstParams } from '../types';

/**
 * fling: carried away in the direction and speed of the swipe (docs/VARIANTS.md section 2).
 *
 * Input: P.vx / P.vy in pt/s (opts.velocity, e.g. velocityX / velocityY of a RNGH pan onEnd).
 * Without a velocity it flings to the right at 1000 pt/s.
 *
 * - The leading edge (along the swipe) leaves first, the trailing edge last.
 * - Each grain keeps the swipe momentum: an ease out term whose initial speed equals the swipe
 *   speed in real time, so the motion continues the gesture without a hitch.
 * - On top of it, an accelerating travel term scaled by k = clamp(speed / 1500, 0.4, 2), plus a
 *   small spread across the swipe axis.
 * - When no duration is given, it follows the speed: clamp(1800 - speed * 0.4, 700, 1500) ms.
 *
 * Timeline (end 1.2): delay in 0..0.55, life = min(0.42 / sqrt(k), 0.6), so every grain is gone
 * by 1.15 at the latest.
 *
 * Extras per grain (prepare, JS side, once):
 *   d[k+8] tx, d[k+9] ty: travel offset reached at t = 1 (multiplied by t^2)
 *   d[k+10] mx, d[k+11] my: momentum offset reached at t = 1 (multiplied by ease out cubic)
 *   d[k+12] rot coefficient
 */
const DEFAULT_SPEED = 1000;
const MAX_MOMENTUM_SPEED = 5000;

/** Unit direction, normal, speed and k. Falls back to a rightward fling when there is no speed. */
function axis(P: BurstParams) {
  let vx = P.vx;
  let vy = P.vy;
  let sp = Math.sqrt(vx * vx + vy * vy);
  if (sp < 1) {
    vx = DEFAULT_SPEED;
    vy = 0;
    sp = DEFAULT_SPEED;
  }
  const ux = vx / sp;
  const uy = vy / sp;
  const k = Math.min(2, Math.max(0.4, sp / 1500));
  return { ux, uy, nx: -uy, ny: ux, sp, k };
}

export const fling: AtlasVariant = {
  kind: 'atlas',
  name: 'fling',
  info: 'Carried away in the direction and speed of the swipe.',
  defaultGrain: 3,
  extra: 5,
  // With a generic origin the delay becomes field * 0.5 + r1 * 0.08 (max 0.58), which still
  // ends by 1.18 with the longest life.
  spread: 0.5,
  jitter: 0.08,
  timing: (g, P) => {
    const { ux, uy, k } = axis(P);
    // Position along the swipe axis, -1 (trailing) .. 1 (leading).
    const pn = ((g.lx - P.w / 2) * ux + (g.ly - P.h / 2) * uy) / (P.maxR || 1);
    return { delay: (1 - (pn + 1) / 2) * 0.45 + g.r1 * 0.1, life: Math.min(0.42 / Math.sqrt(k), 0.6) };
  },
  prepare: (d, stride, count, P) => {
    const { ux, uy, nx, ny, sp, k } = axis(P);
    const msp = Math.min(sp, MAX_MOMENTUM_SPEED);
    for (let i = 0; i < count; i++) {
      const o = i * stride;
      const travel = (80 + d[o + 3] * 160) * k;
      const side = (d[o + 4] - 0.5) * 40 * k;
      d[o + 8] = ux * travel + nx * side;
      d[o + 9] = uy * travel + ny * side;
      // Real life of the grain in seconds. Ease out cubic has slope 3 at t = 0, so a
      // distance of speed * life / 3 starts exactly at the swipe speed.
      const lifeSec = (d[o + 7] * P.sec) / DEFAULT_END;
      const mom = (msp * lifeSec) / 3;
      d[o + 10] = ux * mom;
      d[o + 11] = uy * mom;
      d[o + 12] = (d[o + 5] - 0.5) * 5 * k;
    }
  },
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    const e = t * t;
    const m = eo(t);
    o.cx += d[k + 8] * e + d[k + 10] * m;
    o.cy += d[k + 9] * e + d[k + 11] * m;
    o.s = 1 - 0.5 * t;
    o.rot = d[k + 12] * e;
  },
  resolve: ({ opts }) => {
    const vx = opts.velocity?.x ?? 0;
    const vy = opts.velocity?.y ?? 0;
    let sp = Math.sqrt(vx * vx + vy * vy);
    const params = sp < 1 ? { vx: DEFAULT_SPEED, vy: 0 } : undefined;
    if (sp < 1) sp = DEFAULT_SPEED;
    const dur = opts.duration ?? Math.min(1500, Math.max(700, 1800 - sp * 0.4));
    return {
      params,
      duration: dur,
      haptics: () => {
        Haptics.impactAsync(sp > 1500 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        [0.1, 0.22].forEach((f) => setTimeout(() => Haptics.selectionAsync(), dur * f));
      },
    };
  },
};
