import { backOut, eo, ss } from '../core';
import type { AtlasVariant, BurstParams } from '../types';

/**
 * GROUP B. assemble: generic entrances gather / rain / print (docs/VARIANTS.md section 4).
 * natural 'in': a grain is at rest when t = 1. Played with direction 'out' the engine
 * reverses the timeline, so they also work as exits.
 *
 * Invariant kept by every step: at t >= 1 the step returns right away with a = 1, so the
 * pose is the one the engine reset (cx = x + lx, cy = y + ly, s = 1, rot = 0, rgb = 1).
 * The last frame is therefore an exact copy of the snapshot, then the real view is revealed.
 * Every timing keeps delay + life <= 1.15 < DEFAULT_END (1.2), so every grain reaches t = 1.
 */

/** Cloud size follows the view size: a small chip gets a small cloud, a screen a big one. */
function cloudScale(P: BurstParams) {
  const s = Math.sqrt(P.w * P.h) / 160;
  return s < 0.6 ? 0.6 : s > 1.8 ? 1.8 : s;
}

export const gather: AtlasVariant = {
  kind: 'atlas',
  name: 'gather',
  info: 'A cloud of grains converges into the view.',
  defaultGrain: 3,
  natural: 'in',
  extra: 2,
  // max 0.4 + 0.1 + 0.15 + 0.5 = 1.15
  timing: (g, P) => ({ delay: (g.ly / P.h) * 0.4 + (g.lx / P.w) * 0.1 + g.r1 * 0.15, life: 0.5 }),
  prepare: (d, stride, count, P) => {
    const sc = cloudScale(P);
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const ang = d[k + 3] * Math.PI * 2;
      const dist = (40 + d[k + 4] * 120) * sc;
      d[k + 8] = Math.cos(ang) * dist;
      d[k + 9] = Math.sin(ang) * dist;
    }
  },
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    if (t >= 1) {
      o.a = 1;
      return;
    }
    // backOut gives each grain a tiny overshoot past its spot (single grains only).
    const v = 1 - backOut(t);
    o.cx += d[k + 8] * v;
    o.cy += d[k + 9] * v;
    const m = t * 1.5 < 1 ? t * 1.5 : 1;
    o.s = 1 - 0.6 * (1 - m);
    o.rot = (d[k + 5] - 0.5) * 4 * v;
    const f = t * 2.5 < 1 ? t * 2.5 : 1;
    o.a = ss(f);
  },
};

const RAIN_LAND = 0.82;

export const rain: AtlasVariant = {
  kind: 'atlas',
  name: 'rain',
  info: 'Grains fall from above and settle into place, bottom first.',
  defaultGrain: 3,
  natural: 'in',
  extra: 2,
  // Bottom rows land first so the view fills up like a glass. max 0.45 + 0.2 + 0.5 = 1.15
  timing: (g, P) => ({ delay: (1 - g.ly / P.h) * 0.45 + g.r1 * 0.2, life: 0.5 }),
  prepare: (d, stride, count, P) => {
    const sc = cloudScale(P);
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      d[k + 8] = (d[k + 3] - 0.5) * 20; // sideways drift
      d[k + 9] = (120 + d[k + 4] * 200) * sc; // fall height
    }
  },
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    if (t >= 1) {
      o.a = 1;
      return;
    }
    if (t < RAIN_LAND) {
      // Gravity: position goes with q^2, so the grain accelerates until it lands.
      const q = t / RAIN_LAND;
      o.cx += d[k + 8] * (1 - q);
      o.cy -= d[k + 9] * (1 - q * q);
    } else {
      // One small damped hop after landing (a few points, single grain).
      const q = (t - RAIN_LAND) / (1 - RAIN_LAND);
      o.cy -= Math.sin(q * Math.PI) * (1.5 + d[k + 5] * 2.5) * (1 - q);
    }
    const f = t * 4 < 1 ? t * 4 : 1;
    o.a = ss(f);
  },
};

export const print: AtlasVariant = {
  kind: 'atlas',
  name: 'print',
  info: 'Printed line by line from the top, fresh ink starts black.',
  defaultGrain: 3,
  natural: 'in',
  // Rows are quantised so the head prints whole lines. max 0.8 + 0.03 + 0.3 = 1.13
  timing: (g, P) => ({ delay: (g.row / Math.max(1, P.rows - 1)) * 0.8 + g.r1 * 0.03, life: 0.3 }),
  step: (t, _d, _k, _P, _a0, _a1, o) => {
    'worklet';
    if (t >= 1) {
      o.a = 1;
      return;
    }
    const u = eo(t);
    const v = 1 - u;
    // Dropped by the head from a few points above, slightly bled, then settles.
    o.cy -= 8 * v;
    o.s = 1 + 0.45 * v;
        // Fresh ink is black, then fades to the real colors as it dries.
    const fresh = 1 - ss(t);
    o.r = 1 - 0.9 * fresh;
    o.g = 1 - 0.9 * fresh;
    o.b = 1 - 0.9 * fresh;
    const f = t * 2.5 < 1 ? t * 2.5 : 1;
    o.a = ss(f);
  },
};
