import { ss } from '../core';
import type { AtlasVariant } from '../types';

/**
 * peel: the view peels off like a sticker.
 *
 * Paper folding: an anchor point A on the border of the view is pulled to a point F. The fold
 * line is the perpendicular bisector of AF and every grain on A's side is mirrored across it,
 * so A lands exactly on F. The flap shows the back of the sticker (tint mode: plain paper,
 * darker near the curl) instead of a mirrored copy of the view.
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
/** Width of the curl shading band, points. */
const CURL = 36;

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
        const curl = -sd < CURL ? -sd / CURL : 1;
        const shade = 0.78 + 0.16 * curl;
        o.r = shade;
        o.g = shade;
        o.b = shade + 0.03;
        o.a = 1;
        o.s = 1 + 0.06 * (1 - curl);
      } else {
        // Still stuck: hidden when the flap lies on top of it.
        const mx = lx - 2 * sd * nx;
        const my = ly - 2 * sd * ny;
        if (mx >= 0 && mx <= P.w && my >= 0 && my <= P.h) o.s = 0;
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
