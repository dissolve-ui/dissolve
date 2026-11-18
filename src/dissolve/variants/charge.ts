import { eo, palette } from '../core';
import type { AtlasVariant, Burst } from '../types';

/** Dominant color of the snapshot lifted a little toward white, orange when unreadable. */
function heatColor(burst: Burst): [number, number, number] {
  const pal = palette(burst.image);
  if (!pal) return [1, 0.65, 0.2];
  const lift = (v: number) => v + (1 - v) * 0.3;
  return [lift(pal.dom[0]), lift(pal.dom[1]), lift(pal.dom[2])];
}

/**
 * charge: hold to destroy (docs/VARIANTS.md section 6).
 *
 * Two phases share one step:
 * - Pre-phase (every grain while progress is 0, driven by aux): a0 = charge level 0..1,
 *   a1 = clock in ms. The view shakes (amplitude c * c * 2.5 pt), its edges fray outward
 *   in a band of c * 12 pt, and it heats toward its own dominant color (modulate blend).
 * - Burst (once progress runs): grains blow outward from P.ox / P.oy like snap, with a
 *   push 1.4 times stronger. The shake and fray fade out with (1 - t) so a grain leaves
 *   from exactly where it was shaking, and the heat stays on while it flies.
 *
 * With no aux (plain dissolve({ preset: 'charge' })) a0 = a1 = 0, so this is a hot snap.
 * At t = 0 and c = 0 nothing is touched: the rest pose is exact (pixel perfect first frame,
 * and the last frame of a reversed entrance lands exactly on the view).
 *
 * Timeline (end 1): delay in 0..0.46, life 0.5, so every grain is gone at 0.96.
 *
 * Extras per grain (prepare, JS side, once):
 *   d[k+8] ex, d[k+9] ey: final burst offset (outward push plus tangential swirl), points.
 *   d[k+10] nx, d[k+11] ny: outward normal of the nearest edge.
 *   d[k+12] edge: distance to the nearest edge, points.
 */
const DELAY_SPREAD = 0.4;
const DELAY_JITTER = 0.06;
const LIFE = 0.5;
const PUSH = 1.4;

export const charge: AtlasVariant = {
  kind: 'atlas',
  name: 'charge',
  info: 'Hold to heat it up, release at full charge and it blows apart.',
  defaultGrain: 3,
  end: 1,
  ownsOrigin: true,
  extra: 8,
  timing: (g, P) => {
    const dx = g.lx - P.ox;
    const dy = g.ly - P.oy;
    return { delay: (Math.sqrt(dx * dx + dy * dy) / (P.maxD || 1)) * DELAY_SPREAD + g.r1 * DELAY_JITTER, life: LIFE };
  },
  prepare: (d, stride, count, P, burst) => {
    const [hr, hg, hb] = heatColor(burst);
    const strength = (P.n0 > 0 ? P.n0 : 1) * PUSH;
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const lx = d[k];
      const ly = d[k + 1];
      const dx = lx - P.ox;
      const dy = ly - P.oy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let ux: number;
      let uy: number;
      if (dist < 1) {
        const an = d[k + 5] * Math.PI * 2;
        ux = Math.cos(an);
        uy = Math.sin(an);
      } else {
        ux = dx / dist;
        uy = dy / dist;
      }
      const push = (30 + d[k + 3] * 110) * strength;
      const swirl = (d[k + 4] - 0.5) * 30;
      d[k + 8] = ux * push - uy * swirl;
      d[k + 9] = uy * push + ux * swirl;

      // Nearest edge and its outward normal, for the fray band.
      let edge = lx;
      let nx = -1;
      let ny = 0;
      if (P.w - lx < edge) {
        edge = P.w - lx;
        nx = 1;
        ny = 0;
      }
      if (ly < edge) {
        edge = ly;
        nx = 0;
        ny = -1;
      }
      if (P.h - ly < edge) {
        edge = P.h - ly;
        nx = 0;
        ny = 1;
      }
      d[k + 10] = nx;
      d[k + 11] = ny;
      d[k + 12] = edge < 0 ? 0 : edge;
      d[k + 13] = hr;
      d[k + 14] = hg;
      d[k + 15] = hb;
    }
  },
  step: (t, d, k, _P, a0, a1, o) => {
    'worklet';
    const c = a0 < 0 ? 0 : a0 > 1 ? 1 : a0;
    if (c > 0) {
      const c2 = c * c;
      const keep = 1 - t;
      const r2 = d[k + 3];
      const r4 = d[k + 5];
      // Shake: each grain on its own phase, so the view trembles and grains jostle.
      const A = c2 * 2.5 * keep;
      o.cx += Math.sin(a1 * 0.05 + r4 * 6.28) * A;
      o.cy += Math.cos(a1 * 0.047 + r2 * 6.28) * A;
      // Fray: a band along the edges that widens with the charge and flickers outward.
      const band = c * 12;
      const edge = d[k + 12];
      if (edge < band) {
        const f = 1 - edge / band;
        const flick = 0.6 + 0.4 * Math.sin(a1 * 0.013 + r2 * 6.28);
        const push = f * c * 6 * d[k + 4] * keep * flick;
        o.cx += d[k + 10] * push;
        o.cy += d[k + 11] * push;
        o.a *= 1 - 0.3 * f * c;
      }
      // Heat, through the modulate blend: white toward the view's own dominant color.
      o.r = 1 - (1 - d[k + 13]) * c2;
      o.g = 1 - (1 - d[k + 14]) * c2;
      o.b = 1 - (1 - d[k + 15]) * c2;
    }
    if (t > 0) {
      // Ease out cubic: the blast is strongest when the wave reaches the grain.
      const e = eo(t);
      o.cx += d[k + 8] * e;
      o.cy += d[k + 9] * e - 20 * t * t;
      o.s = 1 - 0.6 * t;
      o.rot = (d[k + 5] - 0.5) * 4 * e;
    }
  },
};
