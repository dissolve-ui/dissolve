import { palette } from '../core';
import type { AtlasVariant } from '../types';

/**
 * The five original presets. The engine resets the output to the rest pose
 * (a = 1 - smoothstep(t)) before each step, so steps only override what they move.
 */

export const dust: AtlasVariant = {
  kind: 'atlas',
  name: 'dust',
  info: 'Blown away to the right, like a breath of wind.',
  defaultGrain: 3,
  spread: 0.62,
  jitter: 0.1,
  timing: (g, P) => ({ delay: (g.lx / P.w) * 0.62 + (1 - g.ly / P.h) * 0.04 + g.r1 * 0.1, life: 0.42 }),
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    const r2 = d[k + 3];
    const r3 = d[k + 4];
    const r4 = d[k + 5];
    const e = t * t;
    o.cx += (50 + r2 * 150) * e;
    o.cy += -(15 + r3 * 110) * e + Math.sin(t * 7 + r4 * 6.28) * 5 * t;
    o.s = 1 - t * 0.55;
    o.rot = (r4 - 0.5) * 6 * e;
  },
};

export const sand: AtlasVariant = {
  kind: 'atlas',
  name: 'sand',
  info: 'Grains pour down with gravity.',
  defaultGrain: 2.5,
  spread: 0.5,
  jitter: 0.15,
  timing: (g, P) => ({ delay: (g.lx / P.w) * 0.5 + g.r1 * 0.15, life: 0.5 }),
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    const e = t * t;
    o.cx += (d[k + 3] - 0.3) * 30 * e;
    o.cy += (60 + d[k + 4] * 220) * e;
    o.s = 1 - t * 0.3;
  },
};

export const ember: AtlasVariant = {
  kind: 'atlas',
  name: 'ember',
  colorMode: 'tint',
  // Per grain glow color: its own color mixed with the view's dominant color, lifted a bit.
  extra: 3,
  prepare: (d, stride, count, P, burst) => {
    const pal = palette(burst.image);
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      let r = 1, g = 1, b = 1;
      if (pal) {
        // Grain center in the downscaled snapshot.
        const x = Math.min(pal.w - 1, Math.floor(d[k] * P.pr * pal.scale));
        const y = Math.min(pal.h - 1, Math.floor(d[k + 1] * P.pr * pal.scale));
        const j = (y * pal.w + x) * 4;
        const own = pal.px[j + 3] < 128 ? pal.dom : [pal.px[j] / 255, pal.px[j + 1] / 255, pal.px[j + 2] / 255];
        r = own[0] * 0.4 + pal.dom[0] * 0.6;
        g = own[1] * 0.4 + pal.dom[1] * 0.6;
        b = own[2] * 0.4 + pal.dom[2] * 0.6;
        // lift toward a glow without washing out the hue
        r = r + (1 - r) * 0.3;
        g = g + (1 - g) * 0.3;
        b = b + (1 - b) * 0.3;
      }
      d[k + 8] = r;
      d[k + 9] = g;
      d[k + 10] = b;
    }
  },
  info: 'Burns from the edge and rises as sparks.',
  defaultGrain: 3,
  spread: 0.6,
  jitter: 0.12,
  timing: (g, P) => ({ delay: (g.lx / P.w) * 0.52 + ((P.h - g.ly) / P.h) * 0.12 + g.r1 * 0.12, life: 0.4 }),
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    const r2 = d[k + 3];
    const r3 = d[k + 4];
    const r4 = d[k + 5];
    const e = t * t;
    o.cx += (r2 - 0.5) * 40 * e + Math.sin(t * 5 + r4 * 6.28) * 8 * t;
    o.cy += -(40 + r3 * 140) * e;
    o.rot = (r4 - 0.5) * 3 * e;
    // Burning front: the grain flares toward the view's dominant color, then keeps a soft glow.
    const heat = t < 0.12 ? t / 0.12 : t < 0.35 ? 1 - ((t - 0.12) / 0.23) * 0.6 : 0.4;
    o.r = d[k + 8];
    o.g = d[k + 9];
    o.b = d[k + 10];
    o.a = heat * 0.8;
    // Fade by shrinking (tint mode keeps the grain's own opacity).
    const f = t < 0.2 ? 0 : (t - 0.2) / 0.8;
    o.s = 1 - f * f * (3 - 2 * f);
  },
};

export const pixel: AtlasVariant = {
  kind: 'atlas',
  name: 'pixel',
  info: 'Blocky, stepped collapse. Very digital.',
  defaultGrain: 7,
  spread: 0.65,
  jitter: 0.1,
  timing: (g) => ({ delay: g.r1 * 0.75, life: 0.32 }),
  step: (t, d, k, _P, _a0, _a1, o) => {
    'worklet';
    const q = Math.floor(t * 5) / 5;
    o.cx += (d[k + 3] - 0.5) * 24 * q;
    o.cy += (d[k + 4] - 0.5) * 24 * q;
    o.s = 1 - q;
    o.a = 1 - q * q;
  },
};

export const vortex: AtlasVariant = {
  kind: 'atlas',
  name: 'vortex',
  info: 'Spirals into the center and vanishes.',
  defaultGrain: 3,
  timing: (g, P) => {
    const dx = g.lx - P.w / 2;
    const dy = g.ly - P.h / 2;
    return { delay: (1 - Math.sqrt(dx * dx + dy * dy) / P.maxR) * 0.55 + g.r1 * 0.1, life: 0.55 };
  },
  step: (t, d, k, P, _a0, _a1, o) => {
    'worklet';
    const dx = d[k] - P.w / 2;
    const dy = d[k + 1] - P.h / 2;
    const e = t * t;
    const r0 = Math.sqrt(dx * dx + dy * dy);
    const a0 = Math.atan2(dy, dx);
    const an = a0 + e * (2.5 + d[k + 3] * 1.5);
    const rr = r0 * (1 - e);
    o.cx = P.x + P.w / 2 + Math.cos(an) * rr;
    o.cy = P.y + P.h / 2 + Math.sin(an) * rr;
    o.s = 1 - t * 0.6;
    o.rot = an - a0;
  },
};
