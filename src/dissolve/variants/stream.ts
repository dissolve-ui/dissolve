import { Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DEFAULT_END, eo, measure, originField, ss } from '../core';
import type { AtlasVariant, Box, BurstParams, DissolveOptions, ResolveCtx, ResolveResult } from '../types';

/**
 * GROUP B. stream (docs/VARIANTS.md section 3). natural 'both', reads P.dir.
 *
 * out (dir 0): every grain leaves its rest spot and flies along a quadratic Bezier
 *   P0 (rest) -> P1 (lifted control point) -> P2 (target center plus a small jitter),
 *   shrinking on the way, and only fades on arrival. Grains closest to the target
 *   leave first, so the view looks sucked in.
 * in (dir 1): the reverse entrance. Grains spring out of the source (P.tx/P.ty, from
 *   opts.to or useAppear's `from`) and land on their rest spot. At t = 1 the pose is
 *   exactly the rest pose, so the last frame matches the real view.
 *
 * Extras per grain (filled once in prepare): d[k+8] c1x, d[k+9] c1y (control point),
 * d[k+10] ex, d[k+11] ey (jittered target or source point), all in WINDOW coords.
 */

const LIFE = 0.5;
const DELAY_SPAN = 0.45;
const DELAY_JITTER = 0.15;

const isBox = (t: unknown): t is Box => !!t && typeof (t as Box).width === 'number';

/** Farthest distance between a corner of the view and the target center (JS side). */
function maxTargetDist(P: BurstParams) {
  let m = 0;
  for (let i = 0; i < 4; i++) {
    const cx = P.x + (i & 1 ? P.w : 0);
    const cy = P.y + (i & 2 ? P.h : 0);
    const dd = Math.hypot(cx - P.tx, cy - P.ty);
    if (dd > m) m = dd;
  }
  return m || 1;
}

/** Target (out) or source (in) used when the caller gives none. */
function fallbackTarget(box: Box, dir: 0 | 1): Box {
  const win = Dimensions.get('window');
  if (dir === 1) return { x: box.x + box.width / 2 - 12, y: box.y + box.height + 80, width: 24, height: 24 };
  // Bottom center of the window, where a tab bar usually lives.
  return { x: win.width / 2 - 12, y: win.height - 64, width: 24, height: 24 };
}

async function resolveTarget(opts: DissolveOptions): Promise<Box | null> {
  if (!opts.to) return null;
  const b = isBox(opts.to) ? opts.to : await measure(opts.to);
  if (!b || (b.width === 0 && b.height === 0 && b.x === 0 && b.y === 0)) return null;
  return b;
}

/**
 * Arrival times in ms at the 10 / 30 / 50 / 70 / 90 % quantiles. Grain randoms are drawn
 * by the engine, so this is a statistical estimate over a sample grid with the same
 * delay formula (and the generic origin delay when an origin is given).
 */
function arrivalQuantiles(box: Box, target: Box, opts: DissolveOptions, duration: number, dir: 0 | 1) {
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  const w = box.width;
  const h = box.height;
  const P = {
    x: box.x,
    y: box.y,
    w,
    h,
    tx,
    ty,
  } as BurstParams;
  const maxDT = maxTargetDist(P);
  let originP: BurstParams | null = null;
  if (opts.origin && !opts.field) {
    const o = opts.origin;
    const ox = typeof o === 'object' ? o.x : w / 2;
    const oy = typeof o === 'object' ? o.y : h / 2;
    const maxD = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy));
    originP = { ...P, ox, oy, maxD } as BurstParams;
  }
  // Visual arrival: out grains reach the target around t = 0.92 (ss), in grains land
  // around t = 0.7 (eo already at 0.97 there).
  const arriveT = dir === 0 ? 0.92 : 0.7;
  const N = 20;
  const samples: number[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const lx = ((c + 0.5) / N) * w;
      const ly = ((r + 0.5) / N) * h;
      const r1 = Math.random();
      const delay = originP
        ? originField(opts.origin, lx, ly, originP) * 0.55 + r1 * 0.08
        : (Math.hypot(box.x + lx - tx, box.y + ly - ty) / maxDT) * DELAY_SPAN + r1 * DELAY_JITTER;
      samples.push(((delay + LIFE * arriveT) / DEFAULT_END) * duration);
    }
  }
  samples.sort((a, b) => a - b);
  return [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))]);
}

/** Time between ctx.add() and the first animated frame (mount plus useEffect). */
const START_LAG = 32;

async function resolve({ opts, box, duration }: ResolveCtx): Promise<ResolveResult> {
  const dir: 0 | 1 = opts.direction === 'in' ? 1 : 0;
  const measured = await resolveTarget(opts);
  const target = measured ?? fallbackTarget(box, dir);
  const params: Partial<BurstParams> = {};
  if (!measured) {
    params.tx = target.x + target.width / 2;
    params.ty = target.y + target.height / 2;
    params.tw = target.width;
    params.th = target.height;
  }
  const q = arrivalQuantiles(box, target, opts, duration, dir);
  const onArrive = opts.onArrive;
  const arriveAt = q[2] + START_LAG;

  // With haptics off the engine never calls our haptics function, so onArrive is
  // scheduled here (resolve returns right before ctx.add).
  if (opts.haptics === false) {
    if (onArrive) setTimeout(onArrive, arriveAt);
    return { params };
  }
  const haptics = () => {
    Haptics.selectionAsync();
    q.forEach((ms, i) =>
      setTimeout(() => {
        if (i === 2) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else Haptics.selectionAsync();
      }, ms + START_LAG),
    );
    if (onArrive) setTimeout(onArrive, arriveAt);
  };
  return { params, haptics };
}

export const stream: AtlasVariant = {
  kind: 'atlas',
  name: 'stream',
  info: 'Grains fly into a target, or pour out of a source to form the view.',
  defaultGrain: 3.5,
  natural: 'both',
  extra: 4,
  resolve,
  timing: (g, P) => {
    const dd = Math.hypot(P.x + g.lx - P.tx, P.y + g.ly - P.ty);
    return { delay: (dd / maxTargetDist(P)) * DELAY_SPAN + g.r1 * DELAY_JITTER, life: LIFE };
  },
  prepare: (d, stride, count, P) => {
    // Land inside the target, a bit tighter than its box so the stream reads as one.
    const jx = P.tw > 0 ? Math.min(P.tw * 0.5, 14) : 6;
    const jy = P.th > 0 ? Math.min(P.th * 0.5, 14) : 6;
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const p0x = P.x + d[k];
      const p0y = P.y + d[k + 1];
      const r2 = d[k + 3];
      const r3 = d[k + 4];
      const r4 = d[k + 5];
      const ex = P.tx + (r2 - 0.5) * jx;
      const ey = P.ty + (r3 - 0.5) * jy;
      const dx = p0x - ex;
      const dy = p0y - ey;
      const D = Math.sqrt(dx * dx + dy * dy) || 1;
      const near = Math.min(1, 0.35 + D / 450);
      let c1x: number;
      let c1y: number;
      if (P.dir === 0) {
        // Lifted arc: tossed up, then dives into the target.
        c1x = (p0x + ex) / 2 + (r4 - 0.5) * 120 * near;
        c1y = Math.min(p0y, ey) - (80 + r2 * 120) * near;
      } else {
        // Spray: fan out sideways from the source, with a light lift.
        const side = (r4 - 0.5) * Math.min(D, 320) * 0.7;
        c1x = (p0x + ex) / 2 + (-dy / D) * side;
        c1y = (p0y + ey) / 2 + (dx / D) * side - (20 + r2 * 60) * near;
      }
      d[k + 8] = c1x;
      d[k + 9] = c1y;
      d[k + 10] = ex;
      d[k + 11] = ey;
    }
  },
  step: (t, d, k, P, _a0, _a1, o) => {
    'worklet';
    const rx = P.x + d[k];
    const ry = P.y + d[k + 1];
    const c1x = d[k + 8];
    const c1y = d[k + 9];
    const ex = d[k + 10];
    const ey = d[k + 11];
    const r4 = d[k + 5];
    if (P.dir === 0) {
      // t = 0 gives u = 0, so cx = rx, cy = ry, s = 1, rot = 0: exact rest pose.
      const u = ss(t);
      const v = 1 - u;
      o.cx = v * v * rx + 2 * v * u * c1x + u * u * ex;
      o.cy = v * v * ry + 2 * v * u * c1y + u * u * ey;
      o.s = 1 - 0.7 * u;
      o.rot = (r4 - 0.5) * 8 * u;
      o.a = t < 0.9 ? 1 : (1 - t) * 10;
      return;
    }
    // Entrance. The engine already reset o to the rest pose; keep it exact at the end.
    if (t >= 1) {
      o.a = 1;
      return;
    }
    const u = eo(t);
    const v = 1 - u;
    o.cx = v * v * ex + 2 * v * u * c1x + u * u * rx;
    o.cy = v * v * ey + 2 * v * u * c1y + u * u * ry;
    o.s = 0.3 + 0.7 * u;
    o.rot = (r4 - 0.5) * 8 * v;
    const f = t * 4 < 1 ? t * 4 : 1;
    o.a = ss(f);
  },
};
