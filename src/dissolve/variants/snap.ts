import * as Haptics from 'expo-haptics';
import { eo } from '../core';
import type { AtlasVariant } from '../types';

/**
 * snap: the view disintegrates from the point you touched (docs/VARIANTS.md section 1).
 *
 * The wave starts at P.ox / P.oy (the origin, in local coords, the view center when no origin
 * is given) and reaches the farthest corner at progress 0.55. Each grain is blown outward
 * along the ray from the origin, with a small tangential swirl and a slow upward drift.
 *
 * Knobs: opts.n[0] = push strength multiplier (default 1).
 *
 * Timeline (end 1.2): delay in 0..0.63, life 0.45, so every grain is fully gone at 1.08.
 * That margin keeps the last frame empty for 'out' and the first frame empty for 'in'.
 *
 * Extras per grain (filled in prepare, JS side, once):
 *   d[k+8] ex, d[k+9] ey: final push offset (outward push plus tangential swirl), in points.
 */
const DELAY_SPREAD = 0.55;
const DELAY_JITTER = 0.08;
const LIFE = 0.45;

export const snap: AtlasVariant = {
  kind: 'atlas',
  name: 'snap',
  info: 'Bursts outward from the point you touched.',
  defaultGrain: 3,
  ownsOrigin: true,
  extra: 2,
  timing: (g, P) => {
    const dx = g.lx - P.ox;
    const dy = g.ly - P.oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return { delay: (dist / (P.maxD || 1)) * DELAY_SPREAD + g.r1 * DELAY_JITTER, life: LIFE };
  },
  prepare: (d, stride, count, P) => {
    const strength = P.n0 > 0 ? P.n0 : 1;
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const dx = d[k] - P.ox;
      const dy = d[k + 1] - P.oy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let ux: number;
      let uy: number;
      if (dist < 1) {
        // Grain right under the finger: no ray, pick a random direction.
        const an = Math.random() * Math.PI * 2;
        ux = Math.cos(an);
        uy = Math.sin(an);
      } else {
        ux = dx / dist;
        uy = dy / dist;
      }
      const push = (30 + d[k + 3] * 110) * strength;
      const swirl = (d[k + 4] - 0.5) * 30;
      // Outward along (ux, uy), swirl along the tangent (-uy, ux).
      d[k + 8] = ux * push - uy * swirl;
      d[k + 9] = uy * push + ux * swirl;
    }
  },
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    // Ease out cubic: the blast is strongest right when the wave hits the grain.
    const e = eo(t);
    o.cx += d[k + 8] * e;
    o.cy += d[k + 9] * e - 20 * t * t;
    o.s = 1 - 0.6 * t;
    o.rot = (d[k + 5] - 0.5) * 4 * e;
  },
  resolve: ({ duration }) => ({
    haptics: () => {
      // A firm hit at the finger, then ticks as the wave crosses 25, 50 and 80 percent of
      // the view (the front reaches distance f * maxD at progress 0.55 * f of 1.2).
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      [0.25, 0.5, 0.8].forEach((f) =>
        setTimeout(() => Haptics.selectionAsync(), (duration * DELAY_SPREAD * f) / 1.2),
      );
    },
  }),
};
