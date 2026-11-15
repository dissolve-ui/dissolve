import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { capture, DEFAULT_END, frames } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import { runDissolve } from './useDissolve';
import type { Box, BurstHandle } from '../types';
import type { SkImage } from '@shopify/react-native-skia';

/**
 * peel by hand: grab the view anywhere near its border and pull, it peels like a sticker.
 *
 * The anchor is picked from the touch point: the nearest corner when you grab close to one
 * (within 28 percent of both sides), otherwise the nearest point of the closest edge.
 * Touch down pre-captures the view. When the pan activates, a 'peel' burst is added in hand
 * mode (n: [1, ax, ay]) with aux0 / aux1 = where the anchor is now (local coords) and an
 * external progress. The anchor tracks the finger, so the paper folds exactly under it.
 *
 * Release: commit when the corner travelled at least `threshold` of the view diagonal, or the
 * drag is faster than `velocity` pt/s. A commit keeps pulling the corner along the same
 * direction until the whole sheet is off, while progress shrinks it away. Otherwise the
 * corner springs back home and the real view is shown again.
 *
 * const { ref, gesture, style } = useDissolvePeel({ onCommit: remove });
 * <GestureDetector gesture={gesture}>
 *   <Animated.View ref={ref} style={[styles.sticker, style]} />
 * </GestureDetector>
 */
export type PeelOptions = {
  /** Fraction of the view diagonal the corner must travel to commit. Default 0.4. */
  threshold?: number;
  /** Release speed (pt/s) that commits regardless. Default 900. */
  velocity?: number;
  grain?: number;
  /** Duration of the fly off after a commit, ms. Default 700. */
  duration?: number;
  haptics?: boolean;
  onCommit?: () => void;
  onCancel?: () => void;
};

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

export function useDissolvePeel(opts: PeelOptions = {}) {
  const ctx = useDissolveContext();
  const ref = useRef<View>(null);
  const end = getVariant('peel').end ?? DEFAULT_END;

  const progress = useSharedValue(0);
  /** Corner position in local coords (aux0, aux1 of the burst). */
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const W = useSharedValue(1);
  const H = useSharedValue(1);
  /** Anchor point on the border, local coords. */
  const AX = useSharedValue(0);
  const AY = useSharedValue(0);
  /** 0 idle, 1 dragging, 2 settling. */
  const phase = useSharedValue(0);
  const live = useSharedValue(0);
  const hidden = useSharedValue(0);

  const optsRef = useRef(opts);
  optsRef.current = opts;
  const s = useRef({
    shot: null as Promise<{ image: SkImage; box: Box } | null> | null,
    handle: null as BurstHandle | null,
  }).current;

  const prime = useCallback(() => {
    if (ctx.reduced) return;
    s.shot = capture(ref);
  }, [ctx, s]);

  const start = useCallback(async (sx: number, sy: number) => {
    const o = optsRef.current;
    const shot = s.shot ? await s.shot : null;
    if (!shot) {
      phase.value = 0;
      return;
    }
    const w = shot.box.width;
    const h = shot.box.height;
    const dl = sx, dr = w - sx, dt = sy, db = h - sy;
    let ax: number;
    let ay: number;
    if (Math.min(dl, dr) < w * 0.28 && Math.min(dt, db) < h * 0.28) {
      ax = dl < dr ? 0 : w;
      ay = dt < db ? 0 : h;
    } else {
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { ax = 0; ay = sy; }
      else if (m === dr) { ax = w; ay = sy; }
      else if (m === dt) { ax = sx; ay = 0; }
      else { ax = sx; ay = h; }
    }
    W.value = w;
    H.value = h;
    AX.value = ax;
    AY.value = ay;
    fx.value = ax;
    fy.value = ay;
    progress.value = 0;
    const res = await runDissolve(
      ctx,
      ref,
      { preset: 'peel', grain: o.grain, n: [1, ax, ay], duration: o.duration ?? 700, haptics: false },
      { progress, aux0: fx, aux1: fy, image: shot.image, box: shot.box },
    );
    if (!res) {
      phase.value = 0;
      return;
    }
    s.handle = res.handle;
    await frames(2);
    hidden.value = 1;
    live.value = 1;
    if (o.haptics !== false) Haptics.selectionAsync();
  }, [ctx, s, W, H, AX, AY, fx, fy, progress, hidden, live, phase]);

  const committed = useCallback(() => {
    s.handle?.remove();
    s.handle = null;
    s.shot = null;
    live.value = 0;
    phase.value = 0;
    optsRef.current.onCommit?.();
  }, [s, live, phase]);

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

  const thump = useCallback(() => {
    if (optsRef.current.haptics !== false) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => () => s.handle?.remove(), [s]);

  const threshold = opts.threshold ?? 0.4;
  const flingV = opts.velocity ?? 900;
  const duration = opts.duration ?? 700;
  const reduced = ctx.reduced;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onBegin(() => {
          'worklet';
          if (phase.value !== 0) return;
          scheduleOnRN(prime);
        })
        .onStart((e) => {
          'worklet';
          if (phase.value !== 0 || reduced) return;
          phase.value = 1;
          // Touch down point, local coords.
          scheduleOnRN(start, e.x - e.translationX, e.y - e.translationY);
        })
        .onUpdate((e) => {
          'worklet';
          if (phase.value !== 1 || live.value !== 1) return;
          fx.value = AX.value + e.translationX;
          fy.value = AY.value + e.translationY;
        })
        .onEnd((e) => {
          'worklet';
          if (phase.value !== 1) return;
          if (live.value !== 1) {
            phase.value = 0;
            return;
          }
          phase.value = 2;
          const dx = fx.value - AX.value;
          const dy = fy.value - AY.value;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const diag = Math.sqrt(W.value * W.value + H.value * H.value);
          const speed = Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY);
          if (dist / diag >= threshold || (speed > flingV && dist > 12)) {
            scheduleOnRN(thump);
            // Keep pulling the corner the same way until the sheet is fully off.
            // Default pull: from the anchor toward the middle of the view.
            const cx = W.value / 2 - AX.value;
            const cy = H.value / 2 - AY.value;
            const cl = Math.sqrt(cx * cx + cy * cy) || 1;
            const ux = dist > 0.5 ? dx / dist : cx / cl;
            const uy = dist > 0.5 ? dy / dist : cy / cl;
            fx.value = withTiming(AX.value + ux * diag * 2.4, { duration, easing: Easing.in(Easing.quad) });
            fy.value = withTiming(AY.value + uy * diag * 2.4, { duration, easing: Easing.in(Easing.quad) });
            progress.value = withTiming(end, { duration, easing: Easing.linear }, (fin) => {
              if (fin) scheduleOnRN(committed);
            });
          } else {
            fx.value = withTiming(AX.value, { duration: 320, easing: CALM });
            fy.value = withTiming(AY.value, { duration: 320, easing: CALM }, (fin) => {
              if (fin) {
                live.value = 0;
                scheduleOnRN(rewound);
              }
            });
          }
        })
        .onFinalize(() => {
          'worklet';
          if (phase.value === 1 && live.value === 1) {
            phase.value = 2;
            fx.value = withTiming(AX.value, { duration: 320, easing: CALM });
            fy.value = withTiming(AY.value, { duration: 320, easing: CALM }, (fin) => {
              if (fin) {
                live.value = 0;
                scheduleOnRN(rewound);
              }
            });
          }
        }),
    [phase, live, fx, fy, W, H, AX, AY, progress, end, threshold, flingV, duration, reduced, prime, start, thump, committed, rewound],
  );

  /** Show the real view again after a commit. */
  const reset = useCallback(() => {
    cancelAnimation(progress);
    cancelAnimation(fx);
    cancelAnimation(fy);
    s.handle?.remove();
    s.handle = null;
    s.shot = null;
    progress.value = 0;
    live.value = 0;
    phase.value = 0;
    hidden.value = 0;
  }, [s, progress, fx, fy, live, phase, hidden]);

  const style = useAnimatedStyle(() => ({ opacity: hidden.value ? 0 : 1 }));

  return { ref, gesture, style, progress, reset };
}
