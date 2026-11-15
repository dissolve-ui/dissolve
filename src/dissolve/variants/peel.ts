import { ss } from '../core';
import type { AtlasVariant } from '../types';

/**
 * peel: the view peels off like a sticker.
 *
 * Paper folding: an anchor point A on the border of the view is pulled to a point F. The fold
 * line is the perpendicular bisector of AF and every grain on A's side is mirrored across it,
 * so A lands exactly on F. The flap shows the back of the sticker (tint mode: plain paper
 * with a crease at the fold and a highlight on the curl) instead of a mirrored copy of the
 * view, and it casts a soft shadow on the part still stuck.
 *
 * Draw order does not matter: a grain still stuck that sits under the flap (its mirror falls
 * inside the view, so a flap grain covers it) is hidden. Any corner or edge can be peeled.
 *
 * Auto mode (dissolve({ preset: 'peel' })): A is the bottom right corner and F travels along
 * the diagonal until the sheet is fully turned over, then it lifts off toward the top left and
 * shrinks away. One global clock: delay 0 and life END for every grain, so t is the progress.
 *
 * Hand mode (n: [1, ax, ay], driven by useDissolvePeel): A = (ax, ay), picked from the touch
 * point, and F = (a0, a1) follows the finger, in local coords. Progress only shrinks the
 * sheet away at the end of a commit.
 *
 * At t = 0 (or F = A) nothing moves and colors are untouched: the first frame is the exact
 * view, and direction 'in' sticks the sticker back on.
 */
const END = 1.2;
/** Fold covers the whole diagonal at this local time (auto mode). */
const FOLD_END = 0.72;
/** Lift off starts here (auto mode). */
const LIFT = 0.62;
/** Width of the shadow the flap casts on the part still stuck, points. */
const SHADOW = 26;

export const peel: AtlasVariant = {
  kind: 'atlas',
  name: 'peel',
  info: 'Peels off like a sticker, from any corner or edge. Drive it by hand with useDissolvePeel.',
  defaultGrain: 3,
  end: END,
  ownsOrigin: true,
  colorMode: 'tint',
  timing: () => ({ delay: 0, life: END }),
  step: (t, d, k, P, a0, a1, o) => {
    'worklet';
    const hand = P.n0 === 1;
    // Anchor A and pulled point F, local coords.
    let ax = P.w;
    let ay = P.h;
    let fx = a0;
    let fy = a1;
    if (hand) {
      ax = P.n1;
      ay = P.n2;
    } else {
      const L = Math.sqrt(P.w * P.w + P.h * P.h);
      const q = t < FOLD_END ? t / FOLD_END : 1;
      const f = ss(q) * L * 1.04;
      fx = ax - (P.w / L) * 2 * f;
      fy = ay - (P.h / L) * 2 * f;
    }
    // Tint amount: 0 keeps the grain as is (still stuck), 1 shows the paper back.
    o.a = 0;
    let nx = fx - ax;
    let ny = fy - ay;
    const len = Math.sqrt(nx * nx + ny * ny);
    if (len > 0.5) {
      nx /= len;
      ny /= len;
      const lx = d[k];
      const ly = d[k + 1];
      // Signed distance to the fold, negative on the anchor side (peeled).
      const sd = (lx - (ax + fx) / 2) * nx + (ly - (ay + fy) / 2) * ny;
      if (sd < 0) {
        o.cx -= 2 * sd * nx;
        o.cy -= 2 * sd * ny;
        // Paper back: a thin crease right at the fold, a bright highlight where the sheet
        // curls toward the light, then a soft matte grey toward the free edge.
        const dd = -sd;
        let shade: number;
        if (dd < 6) shade = 0.82 + 0.15 * (dd / 6);
        else if (dd < 40) shade = 0.97 - 0.09 * ((dd - 6) / 34);
        else shade = 0.88;
        o.r = shade;
        o.g = shade;
        o.b = shade + 0.02 > 1 ? 1 : shade + 0.02;
        o.a = 1;
        // Slight overlap so neighbouring grains never show a seam.
        o.s = 1.12;
      } else {
        // Still stuck: hidden when the flap lies on top of it, shadowed just ahead of the fold.
        const mx = lx - 2 * sd * nx;
        const my = ly - 2 * sd * ny;
        if (mx >= 0 && mx <= P.w && my >= 0 && my <= P.h) o.s = 0;
        else if (sd < SHADOW) {
          const k = 1 - sd / SHADOW;
          o.r = 0;
          o.g = 0;
          o.b = 0;
          o.a = 0.32 * k * k;
        }
      }
    }
    if (hand) {
      if (t > 0.6) o.s *= 1 - ss((t - 0.6) / 0.4);
      return;
    }
    if (t > LIFT) {
      const v = (t - LIFT) / (1 - LIFT);
      const e = v * v;
      const L = Math.sqrt(P.w * P.w + P.h * P.h);
      o.cx -= (P.w / L) * 160 * e;
      o.cy -= (P.h / L) * 160 * e + 40 * e;
      o.rot = -0.6 * e;
      o.s *= 1 - ss(v);
    }
  },
};
