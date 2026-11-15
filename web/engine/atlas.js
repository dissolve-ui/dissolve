// Canvas 2D port of the react-native-dissolve Atlas engine (src/dissolve/Particles.tsx + core.ts).
// Variant math (timing / prepare / step) is ported from src/dissolve/variants/*.ts, almost verbatim.
// Differences with native: color modulation becomes a blend toward a pre-tinted copy of the
// snapshot (o.k = tint amount), and grains are drawn with drawImage on one fixed overlay canvas.

export const DPR = Math.min(2, window.devicePixelRatio || 1);
const MAX_GRAINS = 5000;
const DEFAULT_END = 1.2;
const BASE = 8; // lx, ly, r1, r2, r3, r4, delay, life

/* ---------- easing (core.ts) ---------- */
const ss = (t) => t * t * (3 - 2 * t);
const eo = (t) => { const u = 1 - t; return 1 - u * u * u; };
const backOut = (t) => { const u = t - 1; return 1 + 2.7 * u * u * u + 1.7 * u * u; };

/* ---------- variants ---------- */

function cloudScale(P) {
  const s = Math.sqrt(P.w * P.h) / 160;
  return s < 0.6 ? 0.6 : s > 1.8 ? 1.8 : s;
}

function burstOut(d, P, strength, extraIdx, randomDir) {
  // shared by snap and charge: outward push plus tangential swirl from (ox, oy)
  return (k) => {
    const dx = d[k] - P.ox, dy = d[k + 1] - P.oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let ux, uy;
    if (dist < 1) {
      const an = (randomDir ? Math.random() : d[k + 5]) * Math.PI * 2;
      ux = Math.cos(an); uy = Math.sin(an);
    } else { ux = dx / dist; uy = dy / dist; }
    const push = (30 + d[k + 3] * 110) * strength;
    const swirl = (d[k + 4] - 0.5) * 30;
    d[k + extraIdx] = ux * push - uy * swirl;
    d[k + extraIdx + 1] = uy * push + ux * swirl;
  };
}

function flingAxis(P) {
  let vx = P.vx, vy = P.vy, sp = Math.hypot(vx, vy);
  if (sp < 1) { vx = 1000; vy = 0; sp = 1000; }
  const ux = vx / sp, uy = vy / sp;
  return { ux, uy, nx: -uy, ny: ux, sp, k: Math.min(2, Math.max(0.4, sp / 1500)) };
}

function maxTargetDist(P) {
  let m = 0;
  for (let i = 0; i < 4; i++) {
    const dd = Math.hypot(P.x + (i & 1 ? P.w : 0) - P.tx, P.y + (i & 2 ? P.h : 0) - P.ty);
    if (dd > m) m = dd;
  }
  return m || 1;
}

export const VARIANTS = {
  dust: {
    grain: 3, spread: 0.62, jitter: 0.1,
    timing: (g, P) => ({ delay: (g.lx / P.w) * 0.62 + (1 - g.ly / P.h) * 0.04 + g.r1 * 0.1, life: 0.42 }),
    step(t, d, k, P, a0, a1, o) {
      const e = t * t;
      o.cx += (50 + d[k + 3] * 150) * e;
      o.cy += -(15 + d[k + 4] * 110) * e + Math.sin(t * 7 + d[k + 5] * 6.28) * 5 * t;
      o.s = 1 - t * 0.55;
      o.rot = (d[k + 5] - 0.5) * 6 * e;
    },
  },
  sand: {
    grain: 2.5, spread: 0.5, jitter: 0.15,
    timing: (g, P) => ({ delay: (g.lx / P.w) * 0.5 + g.r1 * 0.15, life: 0.5 }),
    step(t, d, k, P, a0, a1, o) {
      const e = t * t;
      o.cx += (d[k + 3] - 0.3) * 30 * e;
      o.cy += (60 + d[k + 4] * 220) * e;
      o.s = 1 - t * 0.3;
    },
  },
  ember: {
    grain: 3, spread: 0.6, jitter: 0.12, tint: 'dominant',
    timing: (g, P) => ({ delay: (g.lx / P.w) * 0.52 + ((P.h - g.ly) / P.h) * 0.12 + g.r1 * 0.12, life: 0.4 }),
    step(t, d, k, P, a0, a1, o) {
      const e = t * t;
      o.cx += (d[k + 3] - 0.5) * 40 * e + Math.sin(t * 5 + d[k + 5] * 6.28) * 8 * t;
      o.cy += -(40 + d[k + 4] * 140) * e;
      o.rot = (d[k + 5] - 0.5) * 3 * e;
      const heat = t < 0.12 ? t / 0.12 : t < 0.35 ? 1 - ((t - 0.12) / 0.23) * 0.6 : 0.4;
      o.k = heat * 0.8;
      o.a = 1; // tint mode: opacity kept, fade by shrinking
      const f = t < 0.2 ? 0 : (t - 0.2) / 0.8;
      o.s = 1 - f * f * (3 - 2 * f);
    },
  },
  pixel: {
    grain: 7, spread: 0.65, jitter: 0.1,
    timing: (g) => ({ delay: g.r1 * 0.75, life: 0.32 }),
    step(t, d, k, P, a0, a1, o) {
      const q = Math.floor(t * 5) / 5;
      o.cx += (d[k + 3] - 0.5) * 24 * q;
      o.cy += (d[k + 4] - 0.5) * 24 * q;
      o.s = 1 - q;
      o.a = 1 - q * q;
    },
  },
  vortex: {
    grain: 3,
    timing: (g, P) => {
      const dx = g.lx - P.w / 2, dy = g.ly - P.h / 2;
      return { delay: (1 - Math.sqrt(dx * dx + dy * dy) / P.maxR) * 0.55 + g.r1 * 0.1, life: 0.55 };
    },
    step(t, d, k, P, a0, a1, o) {
      const dx = d[k] - P.w / 2, dy = d[k + 1] - P.h / 2;
      const e = t * t, r0 = Math.sqrt(dx * dx + dy * dy), an0 = Math.atan2(dy, dx);
      const an = an0 + e * (2.5 + d[k + 3] * 1.5), rr = r0 * (1 - e);
      o.cx = P.x + P.w / 2 + Math.cos(an) * rr;
      o.cy = P.y + P.h / 2 + Math.sin(an) * rr;
      o.s = 1 - t * 0.6;
      o.rot = an - an0;
    },
  },
  snap: {
    grain: 3, ownsOrigin: true, extra: 2,
    timing: (g, P) => ({ delay: (Math.hypot(g.lx - P.ox, g.ly - P.oy) / (P.maxD || 1)) * 0.55 + g.r1 * 0.08, life: 0.45 }),
    prepare(d, stride, count, P) {
      const f = burstOut(d, P, P.n0 > 0 ? P.n0 : 1, 8, true);
      for (let i = 0; i < count; i++) f(i * stride);
    },
    step(t, d, k, P, a0, a1, o) {
      const u = 1 - t, e = 1 - u * u * u;
      o.cx += d[k + 8] * e;
      o.cy += d[k + 9] * e - 20 * t * t;
      o.s = 1 - 0.6 * t;
      o.rot = (d[k + 5] - 0.5) * 4 * e;
    },
  },
  fling: {
    grain: 3, extra: 5, spread: 0.5, jitter: 0.08,
    duration: (P) => { const sp = Math.hypot(P.vx, P.vy) || 1000; return Math.min(1500, Math.max(700, 1800 - sp * 0.4)); },
    timing: (g, P) => {
      const { ux, uy, k } = flingAxis(P);
      const pn = ((g.lx - P.w / 2) * ux + (g.ly - P.h / 2) * uy) / (P.maxR || 1);
      return { delay: (1 - (pn + 1) / 2) * 0.45 + g.r1 * 0.1, life: Math.min(0.42 / Math.sqrt(k), 0.6) };
    },
    prepare(d, stride, count, P) {
      const { ux, uy, nx, ny, sp, k } = flingAxis(P);
      const msp = Math.min(sp, 5000);
      for (let i = 0; i < count; i++) {
        const o = i * stride;
        const travel = (80 + d[o + 3] * 160) * k, side = (d[o + 4] - 0.5) * 40 * k;
        d[o + 8] = ux * travel + nx * side;
        d[o + 9] = uy * travel + ny * side;
        const mom = (msp * ((d[o + 7] * P.sec) / DEFAULT_END)) / 3;
        d[o + 10] = ux * mom;
        d[o + 11] = uy * mom;
        d[o + 12] = (d[o + 5] - 0.5) * 5 * k;
      }
    },
    step(t, d, k, P, a0, a1, o) {
      const e = t * t, u = 1 - t, m = 1 - u * u * u;
      o.cx += d[k + 8] * e + d[k + 10] * m;
      o.cy += d[k + 9] * e + d[k + 11] * m;
      o.s = 1 - 0.5 * t;
      o.rot = d[k + 12] * e;
    },
  },
  stream: {
    grain: 3.5, natural: 'both', extra: 4,
    timing: (g, P) => ({ delay: (Math.hypot(P.x + g.lx - P.tx, P.y + g.ly - P.ty) / maxTargetDist(P)) * 0.45 + g.r1 * 0.15, life: 0.5 }),
    prepare(d, stride, count, P) {
      const jx = P.tw > 0 ? Math.min(P.tw * 0.5, 14) : 6, jy = P.th > 0 ? Math.min(P.th * 0.5, 14) : 6;
      for (let i = 0; i < count; i++) {
        const k = i * stride;
        const p0x = P.x + d[k], p0y = P.y + d[k + 1], r2 = d[k + 3], r3 = d[k + 4], r4 = d[k + 5];
        const ex = P.tx + (r2 - 0.5) * jx, ey = P.ty + (r3 - 0.5) * jy;
        const dx = p0x - ex, dy = p0y - ey, D = Math.sqrt(dx * dx + dy * dy) || 1;
        const near = Math.min(1, 0.35 + D / 450);
        let c1x, c1y;
        if (P.dir === 0) {
          c1x = (p0x + ex) / 2 + (r4 - 0.5) * 120 * near;
          c1y = Math.min(p0y, ey) - (80 + r2 * 120) * near;
        } else {
          const side = (r4 - 0.5) * Math.min(D, 320) * 0.7;
          c1x = (p0x + ex) / 2 + (-dy / D) * side;
          c1y = (p0y + ey) / 2 + (dx / D) * side - (20 + r2 * 60) * near;
        }
        d[k + 8] = c1x; d[k + 9] = c1y; d[k + 10] = ex; d[k + 11] = ey;
      }
    },
    step(t, d, k, P, a0, a1, o) {
      const rx = P.x + d[k], ry = P.y + d[k + 1], c1x = d[k + 8], c1y = d[k + 9], ex = d[k + 10], ey = d[k + 11], r4 = d[k + 5];
      if (P.dir === 0) {
        const u = ss(t), v = 1 - u;
        o.cx = v * v * rx + 2 * v * u * c1x + u * u * ex;
        o.cy = v * v * ry + 2 * v * u * c1y + u * u * ey;
        o.s = 1 - 0.7 * u;
        o.rot = (r4 - 0.5) * 8 * u;
        o.a = t < 0.9 ? 1 : (1 - t) * 10;
        return;
      }
      if (t >= 1) { o.a = 1; return; }
      const u = eo(t), v = 1 - u;
      o.cx = v * v * ex + 2 * v * u * c1x + u * u * rx;
      o.cy = v * v * ey + 2 * v * u * c1y + u * u * ry;
      o.s = 0.3 + 0.7 * u;
      o.rot = (r4 - 0.5) * 8 * v;
      o.a = ss(Math.min(1, t * 4));
    },
  },
  gather: {
    grain: 3, natural: 'in', extra: 2,
    timing: (g, P) => ({ delay: (g.ly / P.h) * 0.4 + (g.lx / P.w) * 0.1 + g.r1 * 0.15, life: 0.5 }),
    prepare(d, stride, count, P) {
      const sc = cloudScale(P);
      for (let i = 0; i < count; i++) {
        const k = i * stride, ang = d[k + 3] * Math.PI * 2, dist = (40 + d[k + 4] * 120) * sc;
        d[k + 8] = Math.cos(ang) * dist; d[k + 9] = Math.sin(ang) * dist;
      }
    },
    step(t, d, k, P, a0, a1, o) {
      if (t >= 1) { o.a = 1; return; }
      const v = 1 - backOut(t);
      o.cx += d[k + 8] * v;
      o.cy += d[k + 9] * v;
      o.s = 1 - 0.6 * (1 - Math.min(1, t * 1.5));
      o.rot = (d[k + 5] - 0.5) * 4 * v;
      o.a = ss(Math.min(1, t * 2.5));
    },
  },
  rain: {
    grain: 3, natural: 'in', extra: 2,
    timing: (g, P) => ({ delay: (1 - g.ly / P.h) * 0.45 + g.r1 * 0.2, life: 0.5 }),
    prepare(d, stride, count, P) {
      const sc = cloudScale(P);
      for (let i = 0; i < count; i++) {
        const k = i * stride;
        d[k + 8] = (d[k + 3] - 0.5) * 20;
        d[k + 9] = (120 + d[k + 4] * 200) * sc;
      }
    },
    step(t, d, k, P, a0, a1, o) {
      if (t >= 1) { o.a = 1; return; }
      const LAND = 0.82;
      if (t < LAND) {
        const q = t / LAND;
        o.cx += d[k + 8] * (1 - q);
        o.cy -= d[k + 9] * (1 - q * q);
      } else {
        const q = (t - LAND) / (1 - LAND);
        o.cy -= Math.sin(q * Math.PI) * (1.5 + d[k + 5] * 2.5) * (1 - q);
      }
      o.a = ss(Math.min(1, t * 4));
    },
  },
  print: {
    grain: 3, natural: 'in', tint: [0.08, 0.08, 0.09], // fresh ink is black
    timing: (g, P) => ({ delay: (g.row / Math.max(1, P.rows - 1)) * 0.8 + g.r1 * 0.03, life: 0.3 }),
    step(t, d, k, P, a0, a1, o) {
      if (t >= 1) { o.a = 1; return; }
      const v = 1 - eo(t);
      o.cy -= 8 * v;
      o.s = 1 + 0.45 * v;
      o.k = 1 - ss(t); // fresh black ink, fades to the real colors
      o.a = ss(Math.min(1, t * 2.5));
    },
  },
  charge: {
    grain: 3, end: 1, ownsOrigin: true, extra: 5, tint: 'dominant', // heats toward the element's own color
    timing: (g, P) => ({ delay: (Math.hypot(g.lx - P.ox, g.ly - P.oy) / (P.maxD || 1)) * 0.4 + g.r1 * 0.06, life: 0.5 }),
    prepare(d, stride, count, P) {
      const f = burstOut(d, P, (P.n0 > 0 ? P.n0 : 1) * 1.4, 8, false);
      for (let i = 0; i < count; i++) {
        const k = i * stride, lx = d[k], ly = d[k + 1];
        f(k);
        let edge = lx, nx = -1, ny = 0;
        if (P.w - lx < edge) { edge = P.w - lx; nx = 1; ny = 0; }
        if (ly < edge) { edge = ly; nx = 0; ny = -1; }
        if (P.h - ly < edge) { edge = P.h - ly; nx = 0; ny = 1; }
        d[k + 10] = nx; d[k + 11] = ny; d[k + 12] = Math.max(0, edge);
      }
    },
    step(t, d, k, P, a0, a1, o) {
      const c = a0 < 0 ? 0 : a0 > 1 ? 1 : a0;
      if (c > 0) {
        const c2 = c * c, keep = 1 - t, r2 = d[k + 3], r4 = d[k + 5];
        const A = c2 * 2.5 * keep;
        o.cx += Math.sin(a1 * 0.05 + r4 * 6.28) * A;
        o.cy += Math.cos(a1 * 0.047 + r2 * 6.28) * A;
        const band = c * 12, edge = d[k + 12];
        if (edge < band) {
          const f = 1 - edge / band;
          const push = f * c * 6 * d[k + 4] * keep * (0.6 + 0.4 * Math.sin(a1 * 0.013 + r2 * 6.28));
          o.cx += d[k + 10] * push;
          o.cy += d[k + 11] * push;
          o.a *= 1 - 0.3 * f * c;
        }
        o.k = c2 * 0.85; // heat toward the element's dominant color
      }
      if (t > 0) {
        const u = 1 - t, e = 1 - u * u * u;
        o.cx += d[k + 8] * e;
        o.cy += d[k + 9] * e - 20 * t * t;
        o.s = 1 - 0.6 * t;
        o.rot = (d[k + 5] - 0.5) * 4 * e;
      }
    },
  },
};

/* ---------- peel and melt (src/dissolve/variants/peel.ts, melt.ts) ---------- */

VARIANTS.peel = {
  grain: 3, end: 1.2, ownsOrigin: true, tint: 'paper', // back of the sticker
  duration: () => 1900,
  timing: () => ({ delay: 0, life: 1.2 }),
  step(t, d, k, P, a0, a1, o) {
    // Anchor A pulled to F; the fold is the bisector of AF (see src/dissolve/variants/peel.ts).
    const hand = P.n0 === 1;
    let ax = P.w, ay = P.h, fx = a0, fy = a1;
    const L = Math.sqrt(P.w * P.w + P.h * P.h);
    if (hand) { ax = P.n1; ay = P.n2; }
    else {
      const q = t < 0.72 ? t / 0.72 : 1, f = ss(q) * L * 1.04;
      fx = ax - (P.w / L) * 2 * f;
      fy = ay - (P.h / L) * 2 * f;
    }
    o.a = 1;
    let nx = fx - ax, ny = fy - ay;
    const len = Math.sqrt(nx * nx + ny * ny);
    if (len > 0.5) {
      nx /= len; ny /= len;
      const lx = d[k], ly = d[k + 1];
      const sd = (lx - (ax + fx) / 2) * nx + (ly - (ay + fy) / 2) * ny;
      if (sd < 0) {
        const curl = -sd < 36 ? -sd / 36 : 1;
        o.cx -= 2 * sd * nx;
        o.cy -= 2 * sd * ny;
        o.k = 1;
        o.shade = 0.78 + 0.16 * curl;
        o.s = 1 + 0.06 * (1 - curl);
      } else {
        const mx = lx - 2 * sd * nx, my = ly - 2 * sd * ny;
        if (mx >= 0 && mx <= P.w && my >= 0 && my <= P.h) o.s = 0; // under the flap
      }
    }
    if (hand) { if (t > 0.6) o.s *= 1 - ss((t - 0.6) / 0.4); return; }
    if (t > 0.62) {
      const v = (t - 0.62) / 0.38, e = v * v;
      o.cx -= (P.w / L) * 160 * e;
      o.cy -= (P.h / L) * 160 * e + 40 * e;
      o.rot = -0.6 * e;
      o.s *= 1 - ss(v);
    }
  },
};

VARIANTS.melt = {
  grain: 3, extra: 2, goo: 5, // liquid look: blur + alpha threshold, like the Skia layer spread: 0.3, jitter: 0.08,
  timing: (g, P) => ({ delay: (1 - g.ly / P.h) * 0.12 + g.r1 * 0.06, life: 0.95 }),
  prepare(d, stride, count) {
    const ph = Math.random() * Math.PI * 2, ph2 = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const k = i * stride, c = d[k] / 22;
      const a = 0.5 + 0.5 * Math.sin(c * 1.3 + ph), b = 0.5 + 0.5 * Math.sin(c * 0.55 + ph2);
      d[k + 8] = 0.35 + 0.65 * a * (0.6 + 0.4 * b);
      d[k + 9] = Math.round(c) * 22 - d[k];
    }
  },
  step(t, d, k, P, a0, a1, o) {
    const depth = 0.35 + 0.65 * (d[k + 1] / P.h), e = t * t * (1.4 - 0.4 * t);
    o.cy += (30 + d[k + 8] * (P.h * 0.9 + 160)) * e * depth;
    o.cx += d[k + 9] * 0.55 * ss(t < 0.5 ? t * 2 : 1);
    // Opaque all along (the goo threshold would cut a fade): thin out by shrinking.
    o.a = 1;
    o.s = t < 0.5 ? 1 : 1 - ss((t - 0.5) / 0.5);
  },
};

/* ---------- pile (src/dissolve/variants/pile.tsx + pile.store.ts) ---------- */

const PILE_END = 1.4, GRAVITY = 2400, SETTLE = 0.12, MIN_FALL = 0.12, REPOSE = 0.5, PACK = 0.9, SLIDE_STEPS = 12;

function spanMax(H, x, g) {
  const a = Math.floor(x - g / 2), b = Math.ceil(x + g / 2) - 1;
  if (a < 0 || b >= H.length) return Infinity;
  let m = 0;
  for (let c = a; c <= b; c++) if (H[c] > m) m = H[c];
  return m;
}
function spanSet(H, x, g, v) {
  const a = Math.max(0, Math.floor(x - g / 2)), b = Math.min(H.length - 1, Math.ceil(x + g / 2) - 1);
  for (let c = a; c <= b; c++) if (H[c] < v) H[c] = v;
}

/**
 * The frozen sand heap of a floor element (the web stand-in for the provider 'pile' layer).
 * A canvas pinned to the bottom of `floorEl`; H is the height profile per 1 css px column.
 */
export class Heap {
  constructor(floorEl, height = 140) {
    this.el = floorEl;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'heap';
    this.height = height;
    floorEl.append(this.canvas);
    this.reset();
  }
  reset() {
    const w = Math.ceil(this.el.clientWidth);
    this.W = w;
    this.H = new Float32Array(w);
    this.canvas.width = w * DPR;
    this.canvas.height = this.height * DPR;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = this.height + 'px';
    this.g = this.canvas.getContext('2d');
  }
  /** Viewport geometry right now: floor line and left edge. */
  measure() {
    const r = this.el.getBoundingClientRect();
    return { floorY: r.bottom - 1, left: r.left };
  }
  get empty() { return !this.H.some((v) => v > 0); }
  /** Dissolves the heap with an exit preset, then clears it (usePile().sweepPile). */
  async sweep(preset = 'dust') {
    if (this.empty) return;
    const r = this.canvas.getBoundingClientRect();
    const snap = document.createElement('canvas');
    snap.width = this.canvas.width; snap.height = this.canvas.height;
    snap.getContext('2d').drawImage(this.canvas, 0, 0);
    this.reset();
    await play({ source: snap, x: r.left, y: r.top, w: r.width, h: r.height, preset, grain: 2.5, duration: 1300 }).done;
  }
}

VARIANTS.pile = {
  grain: 2.5, end: PILE_END, natural: 'out', extra: 3, spread: 0.45, jitter: 0.12,
  duration: () => 2000,
  timing: (g, P) => ({ delay: (g.lx / P.w) * 0.45 + g.r1 * 0.12, life: 0.6 }),
  prepare(d, stride, count, P, opts) {
    const heap = opts.heap;
    const geo = heap ? heap.measure() : { floorY: P.floorY, left: 0 };
    const committed = !!heap && opts.direction !== 'in';
    const H = heap ? (committed ? heap.H : heap.H.slice()) : new Float32Array(Math.ceil(innerWidth));
    const W = H.length;
    const keep = P.n0 > 0 ? Math.min(1, P.n0) : 0.35;
    const rate = PILE_END / Math.max(0.05, P.sec);
    const g = P.grain;
    const order = [], keys = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const k = i * stride, delay = d[k + 6];
      const dist = Math.max(0, P.floorY - (P.y + d[k + 1]));
      let fall = Math.sqrt((2 * dist) / GRAVITY) * rate;
      fall = Math.max(MIN_FALL, Math.min(fall, PILE_END - SETTLE - delay));
      d[k + 7] = fall + SETTLE;
      if (d[k + 4] < keep) { d[k + 10] = fall / (fall + SETTLE); keys[i] = delay + fall; order.push(i); }
      else { d[k + 10] = -1; d[k + 7] = Math.max(MIN_FALL, Math.min(0.55, PILE_END - delay)); }
    }
    order.sort((a, b) => keys[a] - keys[b]);
    for (const i of order) {
      const k = i * stride;
      // Columns are local to the floor element.
      let xc = P.x + d[k] + (d[k + 3] - 0.3) * 30 - geo.left;
      xc = Math.min(W - g / 2, Math.max(g / 2, xc));
      let hc = spanMax(H, xc, g);
      for (let s = 0; s < SLIDE_STEPS; s++) {
        const hl = spanMax(H, xc - g, g), hr = spanMax(H, xc + g, g), low = Math.min(hl, hr);
        if (!(hc > low + g * REPOSE)) break;
        xc += hl <= hr ? -g : g;
        hc = spanMax(H, xc, g);
      }
      if (!isFinite(hc)) hc = 0;
      d[k + 8] = xc + geo.left;
      d[k + 9] = P.floorY - hc - g / 2;
      spanSet(H, xc, g, hc + g * PACK);
    }
    opts._pile = { geo, committed };
  },
  step(t, d, k, P, a0, a1, o) {
    const tl = d[k + 10], x0 = P.x + d[k], y0 = P.y + d[k + 1];
    if (tl < 0) {
      const e = t * t, drop = P.floorY - y0;
      o.cx = x0 + (d[k + 3] - 0.3) * 30 * e;
      o.cy = y0 + (drop > 0 ? Math.min(drop, 260) : 0) * e;
      o.s = 1 - t * 0.4;
      return;
    }
    const xf = d[k + 8], yf = d[k + 9];
    o.a = 1;
    if (t < tl) {
      const q = t / tl;
      o.cx = x0 + (xf - x0) * q;
      o.cy = y0 + (yf - y0) * q * q;
      o.rot = (d[k + 5] - 0.5) * 3 * Math.sin(Math.PI * q);
    } else {
      const u = tl < 1 ? (t - tl) / (1 - tl) : 1, v = 1 - u;
      o.cx = xf;
      o.cy = yf - Math.abs(Math.sin(u * Math.PI * 2)) * 1.6 * v * v;
    }
  },
  /** Bakes the landed grains into the heap canvas (pile.store bake). */
  settle(b) {
    const heap = b.opts.heap, info = b.opts._pile;
    if (!heap || !info?.committed) return;
    const { d, stride, count, P } = b;
    const g = P.grain, sg = g * DPR, top = info.geo.floorY - heap.height;
    const x = heap.g;
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      if (d[k + 10] < 0) continue;
      x.drawImage(b.source, d[k] * DPR - sg / 2, d[k + 1] * DPR - sg / 2, sg, sg, d[k + 8] - info.geo.left - g / 2, d[k + 9] - top - g / 2, g, g);
    }
  },
};

/* ---------- morph (src/dissolve/variants/morph.tsx) ---------- */

const MORPH_END = 1.1, MORPH_LIFE = 0.6, MS = 10;

function cellLuminance(src, cols, rows) {
  const c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, cols, rows);
  const px = x.getImageData(0, 0, cols, rows).data;
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const j = i * 4;
    out[i] = ((0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255) * (px[j + 3] / 255);
  }
  return out;
}
const sortedCells = (lum) => Array.from(lum.keys()).sort((a, b) => lum[a] - lum[b]);

/**
 * Morphs view A into view B: grains are paired by brightness rank and fly along a curve,
 * A fading out while B fades in. a and b: { source, x, y, w, h } in viewport px.
 * reverse plays B back into A. Returns { done }.
 */
export function morph(a, b, { grain = 4, duration = 1100, reverse = false } = {}) {
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));
  if (reduced.matches) { resolveDone(); return { done }; }
  const g = grain;
  const colsA = Math.ceil(a.w / g), rowsA = Math.ceil(a.h / g), colsB = Math.ceil(b.w / g), rowsB = Math.ceil(b.h / g);
  const nA = colsA * rowsA, nB = colsB * rowsB, N = Math.max(nA, nB);
  const ordA = sortedCells(cellLuminance(a.source, colsA, rowsA));
  const ordB = sortedCells(cellLuminance(b.source, colsB, rowsB));
  const d = new Float32Array(N * MS);
  const ia_ = new Int32Array(N), ib_ = new Int32Array(N);
  let lastA = -1, lastB = -1;
  for (let k = 0; k < N; k++) {
    const ra = Math.floor((k * nA) / N), rb = Math.floor((k * nB) / N);
    const ia = ordA[ra], ib = ordB[rb];
    ia_[k] = ia; ib_[k] = ib;
    const ax = a.x + ((ia % colsA) + 0.5) * g, ay = a.y + (Math.floor(ia / colsA) + 0.5) * g;
    const bx = b.x + ((ib % colsB) + 0.5) * g, by = b.y + (Math.floor(ib / colsB) + 0.5) * g;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let px, py;
    if (len > 1e-3) { px = -dy / len; py = dx / len; } else { const an = Math.random() * Math.PI * 2; px = Math.cos(an); py = Math.sin(an); }
    const off = (Math.random() - 0.5) * Math.min(80, 24 + len * 0.6);
    const j = k * MS;
    d[j] = ax; d[j + 1] = ay; d[j + 2] = bx; d[j + 3] = by;
    d[j + 4] = (ax + bx) / 2 + px * off; d[j + 5] = (ay + by) / 2 + py * off;
    d[j + 6] = Math.random() * 0.3 + (k / N) * 0.2; d[j + 7] = MORPH_LIFE;
    d[j + 8] = ra !== lastA ? 1 : 0; d[j + 9] = rb !== lastB ? 1 : 0;
    lastA = ra; lastB = rb;
  }
  const sg = g * DPR;
  const burst = {
    v: {}, end: MORPH_END, rev: reverse, duration, start: performance.now(), sx0: scrollX, sy0: scrollY,
    aux: { a0: 0, a1: 0 }, manual: null, finish: resolveDone,
    draw(p, offX, offY) {
      for (let k = 0; k < N; k++) {
        const j = k * MS;
        let t = (p - d[j + 6]) / d[j + 7];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const u = ss(t), v = 1 - u;
        const cx = v * v * d[j] + 2 * v * u * d[j + 4] + u * u * d[j + 2] + offX;
        const cy = v * v * d[j + 1] + 2 * v * u * d[j + 5] + u * u * d[j + 3] + offY;
        const s = t === 0 || t === 1 ? 1 : 1 + 0.3 * Math.sin(Math.PI * t);
        const cross = ss(Math.min(1, Math.max(0, (t - 0.3) / 0.4)));
        const hw = (g * s) / 2;
        const alA = d[j + 8] * (1 - cross), alB = d[j + 9] * cross;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (alA > 0.01) {
          ctx.globalAlpha = alA;
          const ia = ia_[k];
          ctx.drawImage(a.source, (ia % colsA) * sg, Math.floor(ia / colsA) * sg, sg, sg, cx - hw, cy - hw, g * s, g * s);
        }
        if (alB > 0.01) {
          ctx.globalAlpha = alB;
          const ib = ib_[k];
          ctx.drawImage(b.source, (ib % colsB) * sg, Math.floor(ib / colsB) * sg, sg, sg, cx - hw, cy - hw, g * s, g * s);
        }
      }
    },
  };
  bursts.add(burst);
  if (!running) { running = true; requestAnimationFrame(frame); }
  return { done };
}
VARIANTS.morph = { grain: 4, custom: true };

export const PORTED = Object.keys(VARIANTS);

/* ---------- params (core.ts buildParams) ---------- */

function originPoint(o, w, h) {
  if (o === 'left') return { x: 0, y: h / 2 };
  if (o === 'right') return { x: w, y: h / 2 };
  if (o === 'top') return { x: w / 2, y: 0 };
  if (o === 'bottom') return { x: w / 2, y: h };
  if (o === 'center' || !o) return { x: w / 2, y: h / 2 };
  return o;
}

function originField(o, lx, ly, P) {
  if (o === 'left') return lx / P.w;
  if (o === 'right') return 1 - lx / P.w;
  if (o === 'top') return ly / P.h;
  if (o === 'bottom') return 1 - ly / P.h;
  return Math.hypot(lx - P.ox, ly - P.oy) / (P.maxD || 1);
}

function buildParams(b, grain, duration) {
  const { w, h } = b;
  const o = originPoint(b.origin, w, h);
  const maxD = Math.max(Math.hypot(o.x, o.y), Math.hypot(w - o.x, o.y), Math.hypot(o.x, h - o.y), Math.hypot(w - o.x, h - o.y));
  const t = b.target, n = b.n ?? [];
  return {
    x: b.x, y: b.y, w, h, grain,
    cols: Math.ceil(w / grain), rows: Math.ceil(h / grain),
    maxR: Math.hypot(w / 2, h / 2),
    dir: b.direction === 'in' ? 1 : 0,
    sec: duration / 1000,
    hasOrigin: b.origin ? 1 : 0, ox: o.x, oy: o.y, maxD,
    vx: b.velocity?.x ?? 0, vy: b.velocity?.y ?? 0,
    tx: t ? t.x + t.width / 2 : innerWidth / 2, ty: t ? t.y + t.height / 2 : innerHeight - 64,
    tw: t?.width ?? 24, th: t?.height ?? 24,
    floorY: b.floorY ?? innerHeight,
    n0: n[0] ?? 0, n1: n[1] ?? 0, n2: n[2] ?? 0, n3: n[3] ?? 0,
  };
}

/* ---------- tint layers ---------- */

function dominant(canvas) {
  const w = 48, h = Math.max(1, Math.round((48 * canvas.height) / canvas.width));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, w, h);
  const px = x.getImageData(0, 0, w, h).data;
  const count = new Float32Array(512), sum = new Float32Array(1536);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const wt = 0.15 + (mx ? (mx - mn) / mx : 0);
    const q = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    count[q] += wt; sum[q * 3] += r * wt; sum[q * 3 + 1] += g * wt; sum[q * 3 + 2] += b * wt;
  }
  let best = 0;
  for (let q = 1; q < 512; q++) if (count[q] > count[best]) best = q;
  const n = count[best] || 1;
  return [sum[best * 3] / n, sum[best * 3 + 1] / n, sum[best * 3 + 2] / n];
}

function tintLayer(source, tint) {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const t = c.getContext('2d');
  t.drawImage(source, 0, 0);
  if (tint === 'paper') {
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = 'rgb(236, 238, 243)';
    t.fillRect(0, 0, c.width, c.height);
    return c;
  }
  if (tint === 'dominant') {
    const lift = (v) => Math.round(v + (255 - v) * 0.3);
    const [r, g, b] = dominant(source);
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
  } else {
    // modulate: source x color, alpha restored afterwards
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = `rgb(${tint.map((v) => Math.round(v * 255)).join(',')})`;
    t.fillRect(0, 0, c.width, c.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(source, 0, 0);
    return c;
  }
  t.fillRect(0, 0, c.width, c.height);
  return c;
}

/* ---------- overlay + loop ---------- */

const overlay = document.createElement('canvas');
overlay.className = 'dust-overlay';
document.body.appendChild(overlay);
const ctx = overlay.getContext('2d');
const bursts = new Set();
// Liquid layer for goo variants (melt): grains are drawn offscreen, then composited through
// blur + an alpha threshold (alpha * 18 - 7), the same recipe as the Skia gooey layer.
const gooCanvas = document.createElement('canvas');
const gctx = gooCanvas.getContext('2d');
const gooSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
gooSvg.setAttribute('width', '0'); gooSvg.setAttribute('height', '0');
gooSvg.style.position = 'absolute';
gooSvg.innerHTML = '<filter id="dissolve-goo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"/></filter>';
document.body.appendChild(gooSvg);
let running = false;

function resize() {
  overlay.width = innerWidth * DPR;
  overlay.height = innerHeight * DPR;
  gooCanvas.width = overlay.width;
  gooCanvas.height = overlay.height;
}
resize();
addEventListener('resize', resize);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Starts a burst. opts: { source (DPR canvas of w x h css px), x, y, w, h (viewport css px),
 * preset, grain, duration, direction, origin, velocity, target {x,y,width,height}, n, hold }.
 * Returns { done: Promise, aux: { a0, a1 }, set(p), release(), cancel() }.
 * hold: true keeps progress at 0 (aux driven pre phase, used by charge) until release().
 * set(p) drives the raw progress by hand (scrub); release() then plays on from there.
 */
export function play(opts) {
  const v = VARIANTS[opts.preset ?? 'dust'];
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));
  const handle = { done, aux: { a0: 0, a1: 0 }, set() {}, release() {}, cancel() {} };
  if (!v || v.custom || reduced.matches) { resolveDone(); return handle; }

  let grain = opts.grain ?? v.grain;
  const min = Math.sqrt((opts.w * opts.h) / MAX_GRAINS);
  if (grain < min) grain = Math.ceil(min * 2) / 2;
  if (opts.heap) opts.floorY = opts.heap.measure().floorY;
  const P0 = buildParams(opts, grain, 1000);
  const duration = opts.duration ?? (v.duration ? v.duration(P0) : 1500);
  const P = buildParams(opts, grain, duration);
  const end = v.end ?? DEFAULT_END;
  const natural = v.natural ?? 'out';
  const dirName = opts.direction ?? (natural === 'in' ? 'in' : 'out');
  const rev = natural !== 'both' && natural !== dirName;
  const stride = BASE + (v.extra ?? 0);
  const count = P.cols * P.rows;
  const d = new Float32Array(count * stride);
  const useOrigin = P.hasOrigin && !v.ownsOrigin;
  const spread = v.spread ?? 0.55, jitter = v.jitter ?? 0.08;
  for (let r = 0; r < P.rows; r++)
    for (let c = 0; c < P.cols; c++) {
      const i = r * P.cols + c, k = i * stride;
      const g = { i, col: c, row: r, lx: (c + 0.5) * grain, ly: (r + 0.5) * grain, r1: Math.random(), r2: Math.random(), r3: Math.random(), r4: Math.random() };
      const tm = v.timing(g, P);
      d[k] = g.lx; d[k + 1] = g.ly; d[k + 2] = g.r1; d[k + 3] = g.r2; d[k + 4] = g.r3; d[k + 5] = g.r4;
      d[k + 6] = useOrigin ? originField(opts.origin, g.lx, g.ly, P) * spread + g.r1 * jitter : tm.delay;
      d[k + 7] = tm.life;
    }
  v.prepare?.(d, stride, count, P, opts);

  const b = {
    v, P, d, stride, count, end, rev, duration,
    source: opts.source, tinted: v.tint ? tintLayer(opts.source, v.tint) : null,
    sx0: scrollX, sy0: scrollY,
    start: opts.hold ? null : performance.now(),
    aux: handle.aux, finish: resolveDone, manual: null, opts,
  };
  handle.set = (p) => { b.manual = Math.max(0, Math.min(end, p)); };
  handle.release = () => {
    if (b.start) return;
    b.start = performance.now() - ((b.manual ?? 0) / end) * duration;
    b.manual = null;
  };
  handle.end = end;
  handle.cancel = () => { bursts.delete(b); resolveDone(); };
  bursts.add(b);
  if (!running) { running = true; requestAnimationFrame(frame); }
  return handle;
}

const o = { cx: 0, cy: 0, s: 1, rot: 0, a: 1, k: 0, shade: 1 };

function frame(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  for (const b of bursts) {
    const raw = b.manual != null ? b.manual : b.start ? ((now - b.start) / b.duration) * b.end : 0;
    if (raw >= b.end) { bursts.delete(b); b.v.settle?.(b); b.finish(); continue; }
    const p = b.rev ? b.end - raw : raw;
    const { P, d, stride, v } = b;
    const offX = b.sx0 - scrollX, offY = b.sy0 - scrollY;
    if (b.draw) { b.draw(p, offX, offY); continue; }
    const g = P.grain, sg = g * DPR, a0 = b.aux.a0, a1 = b.aux.a1;
    const x = v.goo ? gctx : ctx;
    if (v.goo) { gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, gooCanvas.width, gooCanvas.height); }
    for (let i = 0; i < b.count; i++) {
      const k = i * stride;
      let t = (p - d[k + 6]) / d[k + 7];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      o.cx = P.x + d[k]; o.cy = P.y + d[k + 1]; o.s = 1; o.rot = 0; o.k = 0; o.shade = 1;
      o.a = 1 - t * t * (3 - 2 * t);
      v.step(t, d, k, P, a0, a1, o);
      if (o.a <= 0.01 || o.s <= 0) continue;
      const cs = Math.cos(o.rot) * o.s * DPR, sn = Math.sin(o.rot) * o.s * DPR;
      x.setTransform(cs, sn, -sn, cs, (o.cx + offX) * DPR, (o.cy + offY) * DPR);
      x.globalAlpha = o.a > 1 ? 1 : o.a;
      const sx = d[k] * DPR - sg / 2, sy = d[k + 1] * DPR - sg / 2;
      x.drawImage(b.source, sx, sy, sg, sg, -g / 2, -g / 2, g, g);
      if (o.k > 0.01 && b.tinted) {
        x.globalAlpha = (o.a > 1 ? 1 : o.a) * (o.k > 1 ? 1 : o.k);
        x.drawImage(b.tinted, sx, sy, sg, sg, -g / 2, -g / 2, g, g);
        if (o.shade < 1) {
          x.globalAlpha = (1 - o.shade) * 0.9;
          x.fillStyle = '#1a1d24';
          x.fillRect(-g / 2, -g / 2, g, g);
        }
      }
    }
    if (v.goo) {
      // Blur grows from 0 so the first frame is the exact view.
      const r = Math.min(1, raw / 0.25) * v.goo * DPR;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = r > 0.2 ? `blur(${r.toFixed(2)}px) url(#dissolve-goo)` : 'none';
      ctx.drawImage(gooCanvas, 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  if (bursts.size) requestAnimationFrame(frame);
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, overlay.width, overlay.height); running = false; }
}

/** Draws with fn(ctx) into a DPR canvas of w x h css px. */
export function snapshot(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * DPR);
  c.height = Math.ceil(h * DPR);
  const x = c.getContext('2d');
  x.scale(DPR, DPR);
  fn(x);
  return c;
}
