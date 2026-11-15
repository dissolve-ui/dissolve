import type { AtlasVariant } from '../types';

/**
 * The five original presets, moved verbatim into the variant structure.
 * Owned by the master agent. The engine resets the output to the rest pose
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
  step: (t, d, k, P, _a0, _a1, o) => {
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
    o.s = 1 - t * 0.7;
    o.rot = (r4 - 0.5) * 3 * e;
    const hot = t < 0.25 ? t / 0.25 : 1;
    o.g = 1 - 0.45 * hot;
    o.b = 1 - 0.85 * hot;
    const f = t < 0.25 ? 0 : (t - 0.25) / 0.75;
    o.a = 1 - f * f * (3 - 2 * f);
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
