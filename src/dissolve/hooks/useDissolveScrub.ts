import type { ViewRef } from '../types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { rect, Skia, type SkImage } from '@shopify/react-native-skia';
import { capture, DEFAULT_END, frames } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import { runDissolve } from './useDissolve';
import type { Box, BurstHandle, Origin, VariantName } from '../types';

/**
 * GROUP C. scrub: the view disintegrates under the finger and it is reversible
 * (docs/VARIANTS.md section 5).
 *
 * Touch down pre-captures the view. Once the pan activates (8 pt along the axis) the
 * direction is known: the burst is added with an external progress and the wave starts
 * from the edge the finger leaves (dragging right starts from the left edge). Variants
 * that own their origin (snap, charge) start from the touch point instead.
 *
 * Mapping: frac = finger travel / distance to the far edge (at least 40 percent of the
 * view), progress = frac * reach, where reach is where the wave front has swept the whole
 * view (spread + jitter of the variant). Dragging back rewinds, it is a pure function of
 * progress. Release: commit when frac >= threshold or the fling is faster than 800 pt/s
 * (progress runs to the end at the burst speed), otherwise rewind to 0 on a calm curve.
 *
 * Haptics follow the content density: the snapshot is reduced once to a strip of bins
 * along the axis, ink = distance of each bin to the median luminance (the background).
 * Ticks fire as the front crosses inked bins (30 ms minimum gap), a light impact on dense
 * bins, rigid ticks when rewinding. Blank areas stay silent.
 *
 * const { ref, gesture, style } = useDissolveScrub({ preset: 'dust', onCommit });
 * <GestureDetector gesture={gesture}>
 *   <Animated.View ref={ref} style={[styles.card, style]} />
 * </GestureDetector>
 */
export type ScrubOptions = {
  preset?: VariantName;
  axis?: 'x' | 'y';
  /** Fraction of the drag range past which release commits. Default 0.55. */
  threshold?: number;
  /** Release velocity along the drag (pt/s) that commits regardless. Default 800. */
  velocity?: number;
  grain?: number;
  /** Duration of a full run of the effect, ms. The commit plays the rest of it. Default 1500. */
  duration?: number;
  haptics?: boolean;
  onCommit?: () => void;
  /** Called after a rewind, once the real view is back. */
  onCancel?: () => void;
};

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const BINS = 48;
const ACROSS = 12;

/**
 * JS side, once per gesture: reduce the snapshot to BINS x ACROSS cells and measure how far
 * each bin along the axis is from the background luminance. Normalised to 0..1.
 */
function inkProfile(image: SkImage, axis: 'x' | 'y', fromEnd: boolean): number[] {
  const flat = new Array(BINS).fill(0);
  try {
    const bw = axis === 'x' ? BINS : ACROSS;
    const bh = axis === 'x' ? ACROSS : BINS;
    // GPU surface when available (the snapshot may be texture backed), CPU otherwise.
    const surface = Skia.Surface.MakeOffscreen(bw, bh) ?? Skia.Surface.Make(bw, bh);
    if (!surface) return flat;
    const paint = Skia.Paint();
    surface.getCanvas().drawImageRect(image, rect(0, 0, image.width(), image.height()), rect(0, 0, bw, bh), paint);
    surface.flush();
    const px = surface.makeImageSnapshot().readPixels();
    if (!px) return flat;
    const scale = px instanceof Float32Array ? 1 : 1 / 255;
    const lum: number[] = [];
    for (let i = 0; i < bw * bh; i++) {
      const a = px[i * 4 + 3] * scale;
      // Channel order (RGBA or BGRA) does not matter for a plain average.
      lum.push(((px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3) * scale * a + (1 - a));
    }
    const sorted = [...lum].sort((p, q) => p - q);
    const median = sorted[Math.floor(sorted.length / 2)];
    const ink: number[] = [];
    for (let b = 0; b < BINS; b++) {
      let sum = 0;
      for (let j = 0; j < ACROSS; j++) {
        const i = axis === 'x' ? j * bw + b : b * bw + j;
        sum += Math.abs(lum[i] - median);
      }
      ink.push(sum / ACROSS);
    }
    if (fromEnd) ink.reverse();
    // Floor the normaliser so a blank card does not turn its noise into ticks.
    const max = Math.max(0.08, ...ink);
    return ink.map((v) => v / max);
  } catch {
    return flat;
  }
}

export function useDissolveScrub(opts: ScrubOptions = {}) {
  const ctx = useDissolveContext();
  const ref = useRef<ViewRef>(null);
  const axis = opts.axis ?? 'x';
  const preset = opts.preset ?? 'dust';
  const v = getVariant(preset);
  const end = v.end ?? DEFAULT_END;

  /** Raw progress 0..end of the variant. */
  const progress = useSharedValue(0);
  /** 1 while the overlay stands in for the real view (and the finger drives progress). */
  const live = useSharedValue(0);
  /**
   * 0 idle, 1 dragging, 2 settling (commit or rewind running), 3 released before the
   * overlay was up, 4 dragging without overlay (capture failed).
   */
  const phase = useSharedValue(0);
  /** Release decision waiting for the overlay (phase 3): 1 commit, 0 rewind. */
  const pending = useSharedValue(0);
  const hidden = useSharedValue(0);
  /** Per gesture constants, set from JS once the burst exists. */
  const sign = useSharedValue(1);
  const range = useSharedValue(1);
  const reach = useSharedValue(1);
  const ink = useSharedValue<number[]>([]);
  const lastBin = useSharedValue(0);
  const acc = useSharedValue(0);
  const lastTick = useSharedValue(0);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const s = useRef({
    shot: null as Promise<{ image: SkImage; box: Box } | null> | null,
    handle: null as BurstHandle | null,
  }).current;

  const tick = useCallback((kind: number) => {
    if (kind === 2) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    else Haptics.selectionAsync();
  }, []);

  const prime = useCallback(() => {
    if (ctx.reduced) return;
    s.shot = capture(ref);
  }, [ctx, s]);

  const committed = useCallback(() => {
    s.handle?.remove();
    s.handle = null;
    s.shot = null;
    // The overlay is gone: a new drag on the hidden view must not drive a dead progress.
    live.value = 0;
    phase.value = 0;
    optsRef.current.onCommit?.();
  }, [s, phase, live]);

  /** No overlay (capture failed): settle a pending release without the effect. */
  const fallback = useCallback(() => {
    if (phase.value === 3 && pending.value === 1) {
      hidden.value = 1;
      optsRef.current.onCommit?.();
    }
    // Still dragging: mark the drag as dead, onEnd settles it without the effect.
    phase.value = phase.value === 1 ? 4 : 0;
  }, [phase, pending, hidden]);

  const start = useCallback(
    async (dirSign: number, sx: number, sy: number) => {
      const o = optsRef.current;
      sign.value = dirSign;
      const shot = s.shot ? await s.shot : null;
      if (!shot) {
        fallback();
        return;
      }
      const { width: w, height: h } = shot.box;
      const size = axis === 'x' ? w : h;
      const startPos = axis === 'x' ? sx : sy;
      // Travel left before the far edge, never less than 40 percent of the view.
      const toEdge = dirSign > 0 ? size - startPos : startPos;
      range.value = Math.max(toEdge, size * 0.4);

      let origin: Origin;
      let r: number;
      if (v.kind === 'atlas' && !v.ownsOrigin) {
        origin = axis === 'x' ? (dirSign > 0 ? 'left' : 'right') : dirSign > 0 ? 'top' : 'bottom';
        r = (v.spread ?? 0.55) + (v.jitter ?? 0.08);
      } else if (v.kind === 'atlas') {
        origin = { x: sx, y: sy };
        r = end * 0.55;
      } else {
        origin = axis === 'x' ? (dirSign > 0 ? 'left' : 'right') : dirSign > 0 ? 'top' : 'bottom';
        r = end * 0.6;
      }
      reach.value = Math.min(r, end);
      const profile = o.haptics === false ? [] : inkProfile(shot.image, axis, dirSign < 0);
      ink.value = profile;
      lastBin.value = 0;
      acc.value = 0;

      const res = await runDissolve(
        ctx,
        ref,
        { preset, grain: o.grain, origin, duration: o.duration ?? 1500, haptics: false },
        { progress, image: shot.image, box: shot.box },
      );
      if (!res) {
        fallback();
        return;
      }
      s.handle = res.handle;
      await frames(2);
      if (phase.value === 1) {
        hidden.value = 1;
        live.value = 1;
        return;
      }
      if (phase.value === 3 && pending.value === 1) {
        // Flicked away before the overlay was up: commit from the first frame.
        hidden.value = 1;
        live.value = 1;
        phase.value = 2;
        progress.value = withTiming(end, { duration: o.duration ?? 1500, easing: Easing.linear }, (fin) => {
          if (fin) scheduleOnRN(committed);
        });
        return;
      }
      // Released short while the overlay was coming up: nothing was shown, drop it.
      res.handle.remove();
      s.handle = null;
      phase.value = 0;
    },
    [ctx, s, axis, preset, v, end, progress, sign, range, reach, ink, lastBin, acc, phase, pending, hidden, live, committed, fallback],
  );

  const rewound = useCallback(() => {
    hidden.value = 0;
    frames(2).then(() => {
      s.handle?.remove();
      s.handle = null;
      s.shot = null;
      phase.value = 0;
      optsRef.current.onCancel?.();
    });
  }, [s, hidden, phase]);

  const finishReduced = useCallback(
    (commit: boolean) => {
      phase.value = 0;
      if (commit) {
        hidden.value = 1;
        optsRef.current.onCommit?.();
      }
    },
    [phase, hidden],
  );

  // Density haptics: read every shared value here, in the reaction itself.
  useAnimatedReaction(
    () => progress.value,
    (p, prev) => {
      if (live.value !== 1 || phase.value !== 1 || prev === null) return;
      const profile = ink.value;
      const n = profile.length;
      if (n === 0) return;
      let b = Math.floor((p / reach.value) * n);
      b = b < 0 ? 0 : b > n ? n : b;
      const lb = lastBin.value;
      if (b === lb) return;
      const fwd = b > lb;
      const lo = fwd ? lb : b;
      const hi = fwd ? b : lb;
      let sum = 0;
      let peak = 0;
      for (let i = lo; i < hi && i < n; i++) {
        sum += profile[i];
        if (profile[i] > peak) peak = profile[i];
      }
      lastBin.value = b;
      const a = acc.value + sum;
      const now = Date.now();
      if (a > 0.35 && now - lastTick.value > 30) {
        acc.value = 0;
        lastTick.value = now;
        scheduleOnRN(tick, fwd ? (peak > 0.6 ? 2 : 1) : 3);
      } else {
        acc.value = a > 2 ? 2 : a;
      }
    },
  );

  useEffect(
    () => () => {
      s.handle?.remove();
    },
    [s],
  );

  const threshold = opts.threshold ?? 0.55;
  const flingV = opts.velocity ?? 800;
  const duration = opts.duration ?? 1500;
  const reduced = ctx.reduced;
  const hapticsOn = opts.haptics !== false;

  const gesture = useMemo(() => {
    const g = Gesture.Pan();
    if (axis === 'x') g.activeOffsetX([-8, 8]).failOffsetY([-14, 14]);
    else g.activeOffsetY([-8, 8]).failOffsetX([-14, 14]);
    return g
      .onBegin(() => {
        'worklet';
        if (phase.value !== 0) return;
        scheduleOnRN(prime);
      })
      .onStart((e) => {
        'worklet';
        if (phase.value !== 0) return;
        phase.value = 1;
        const t = axis === 'x' ? e.translationX : e.translationY;
        const dirSign = t < 0 ? -1 : 1;
        sign.value = dirSign;
        // Touch down point, in local coords.
        const sx = e.x - e.translationX;
        const sy = e.y - e.translationY;
        if (!reduced) scheduleOnRN(start, dirSign, sx, sy);
      })
      .onUpdate((e) => {
        'worklet';
        if (phase.value !== 1 || live.value !== 1) return;
        const t = (axis === 'x' ? e.translationX : e.translationY) * sign.value;
        let f = t / range.value;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        progress.value = f * reach.value;
      })
      .onEnd((e) => {
        'worklet';
        if (phase.value !== 1 && phase.value !== 4) return;
        const t = (axis === 'x' ? e.translationX : e.translationY) * sign.value;
        const vel = (axis === 'x' ? e.velocityX : e.velocityY) * sign.value;
        const f = t / range.value;
        const commit = f >= threshold || vel > flingV;
        if (reduced || phase.value === 4) {
          phase.value = 2;
          scheduleOnRN(finishReduced, commit);
          return;
        }
        if (live.value !== 1) {
          // Very fast gesture: the overlay is still coming up, start() settles it.
          pending.value = commit ? 1 : 0;
          phase.value = 3;
          return;
        }
        phase.value = 2;
        const p = progress.value;
        if (commit) {
          if (hapticsOn) scheduleOnRN(tick, 2);
          progress.value = withTiming(
            end,
            { duration: Math.max(120, ((end - p) / end) * duration), easing: Easing.linear },
            (fin) => {
              if (fin) scheduleOnRN(committed);
            },
          );
        } else {
          progress.value = withTiming(0, { duration: 260 + 260 * (p / end), easing: CALM }, (fin) => {
            if (fin) {
              live.value = 0;
              scheduleOnRN(rewound);
            }
          });
        }
      })
      .onFinalize(() => {
        'worklet';
        if (phase.value === 4) phase.value = 0;
        // Cancelled (no onEnd) while dragging: rewind like a short release.
        if (phase.value === 1) {
          if (live.value !== 1) {
            pending.value = 0;
            phase.value = 3;
            return;
          }
          phase.value = 2;
          progress.value = withTiming(0, { duration: 320, easing: CALM }, (fin) => {
            if (fin) {
              live.value = 0;
              scheduleOnRN(rewound);
            }
          });
        }
      });
  }, [axis, threshold, flingV, duration, end, reduced, phase, sign, range, reach, progress, live, prime, start, tick, committed, rewound, finishReduced, pending, hapticsOn]);

  /** Show the real view again after a commit (e.g. when the item is restored). */
  const reset = useCallback(() => {
    cancelAnimation(progress);
    s.handle?.remove();
    s.handle = null;
    s.shot = null;
    progress.value = 0;
    live.value = 0;
    phase.value = 0;
    hidden.value = 0;
  }, [s, progress, live, phase, hidden]);

  const style = useAnimatedStyle(() => ({ opacity: hidden.value ? 0 : 1 }));

  return { ref, gesture, progress, style, reset };
}
