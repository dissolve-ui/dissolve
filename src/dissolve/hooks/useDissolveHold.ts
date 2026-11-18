import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { DEFAULT_END, frames } from '../core';
import { getVariant } from '../variants/registry';
import { runDissolve } from './useDissolve';
import { CALM, useBurstOwner } from './useGestureBurst';
import type { VariantName } from '../types';

/**
 * Hold to destroy (docs/VARIANTS.md section 6), built for the 'charge' variant.
 *
 * Touch down: the view is captured and an overlay is added with an external progress,
 * aux0 = charge 0..1 and aux1 = a clock in ms (useFrameCallback, only while it matters).
 * While held the charge climbs linearly over holdMs: the overlay shakes, frays and heats,
 * and haptic ticks speed up from every 120 ms to every 30 ms.
 * At 100 percent: a heavy impact and progress runs to the end, the view bursts from the
 * finger. Released early: the charge calms down to 0 on a calm curve, the real view comes
 * back and the overlay is removed two frames later.
 *
 * const { ref, pressHandlers, style, charge } = useDissolveHold({ onCommit });
 * <Pressable {...pressHandlers}>
 *   <Animated.View ref={ref} style={[styles.card, style]} />
 * </Pressable>
 *
 * Any other variant can be passed as `then`: it only gets the burst (no shake or heat).
 */
export type HoldOptions = {
  /** Time to reach full charge, ms. Default 1200. */
  holdMs?: number;
  /** Variant used for the final burst. Default 'charge'. */
  then?: VariantName;
  grain?: number;
  /** Duration of the final burst, ms. Default 900. */
  duration?: number;
  haptics?: boolean;
  /** Finger travel (pt) that cancels the hold. Default 24. */
  maxDistance?: number;
  /** Called on the JS thread once the burst is over (the space can be reclaimed). */
  onCommit?: () => void;
  /** Called when the hold is released early and the view has settled back. */
  onCancel?: () => void;
};

type Phase = 'idle' | 'arming' | 'charging' | 'cooling' | 'committing' | 'done';

export function useDissolveHold(opts: HoldOptions = {}) {
  const { ctx, ref, hidden, optsRef, s, drop, style } = useBurstOwner(opts);
  /** 0..1 while held (aux0 of the burst). Usable for a progress ring. */
  const charge = useSharedValue(0);
  /** Clock in ms (aux1 of the burst). */
  const clock = useSharedValue(0);
  /** Raw burst progress, 0..end of the variant. */
  const progress = useSharedValue(0);

  const h = useRef({
    phase: 'idle' as Phase,
    down: false,
    tick: null as ReturnType<typeof setTimeout> | null,
  }).current;

  const ticker = useFrameCallback((f) => {
    clock.value = f.timestamp;
  }, false);

  const stopTicks = useCallback(() => {
    if (h.tick) clearTimeout(h.tick);
    h.tick = null;
  }, [h]);

  const startTicks = useCallback(() => {
    stopTicks();
    if (optsRef.current.haptics === false) return;
    const loop = () => {
      if (h.phase !== 'charging') return;
      const c = charge.value;
      if (c > 0.7) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.selectionAsync();
      h.tick = setTimeout(loop, 120 - 90 * c);
    };
    loop();
  }, [h, optsRef, charge, stopTicks]);

  const finish = useCallback(() => {
    if (h.phase !== 'committing') return;
    h.phase = 'done';
    ticker.setActive(false);
    drop();
    charge.value = 0;
    optsRef.current.onCommit?.();
  }, [h, optsRef, drop, ticker, charge]);

  const commit = useCallback(() => {
    if (h.phase !== 'charging') return;
    h.phase = 'committing';
    stopTicks();
    const o = optsRef.current;
    if (o.haptics !== false) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!s.handle) {
      // Reduced motion (or no overlay): just hide the view.
      hidden.value = 1;
      finish();
      return;
    }
    const end = getVariant(o.then ?? 'charge').end ?? DEFAULT_END;
    progress.value = withTiming(end, { duration: o.duration ?? 900, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(finish);
    });
  }, [h, s, optsRef, hidden, progress, stopTicks, finish]);

  const startCharge = useCallback(() => {
    h.phase = 'charging';
    hidden.value = s.handle ? 1 : 0;
    if (s.handle) ticker.setActive(true);
    const holdMs = optsRef.current.holdMs ?? 1200;
    const left = Math.max(1, holdMs * (1 - charge.value));
    charge.value = withTiming(1, { duration: left, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(commit);
    });
    startTicks();
  }, [h, s, optsRef, hidden, ticker, charge, commit, startTicks]);

  const settle = useCallback(() => {
    if (h.phase !== 'cooling') return;
    // Real view back first, overlay dropped once it has painted.
    hidden.value = 0;
    ticker.setActive(false);
    frames(2).then(() => {
      if (h.phase !== 'cooling') return;
      drop();
      h.phase = 'idle';
      optsRef.current.onCancel?.();
    });
  }, [h, optsRef, drop, hidden, ticker]);

  const begin = useCallback(
    async (x: number, y: number) => {
      if (h.phase === 'committing' || h.phase === 'done') return;
      h.down = true;
      if (h.phase === 'cooling') {
        // Pressed again while calming down: keep the same overlay and charge from here.
        cancelAnimation(charge);
        startCharge();
        return;
      }
      if (h.phase !== 'idle') return;
      h.phase = 'arming';
      progress.value = 0;
      charge.value = 0;
      const o = optsRef.current;
      if (!ctx.reduced) {
        const then = o.then ?? 'charge';
        const aux = then === 'charge';
        const res = await runDissolve(
          ctx,
          ref,
          { preset: then, grain: o.grain, origin: { x, y }, duration: o.duration ?? 900, haptics: false },
          { progress, aux0: aux ? charge : undefined, aux1: aux ? clock : undefined },
        );
        if (res) {
          s.handle = res.handle;
          // Let the overlay paint its identical first frame before hiding the view.
          await frames(2);
        }
      }
      if (!h.down) {
        drop();
        h.phase = 'idle';
        return;
      }
      startCharge();
    },
    [ctx, ref, h, s, optsRef, drop, charge, clock, progress, startCharge],
  );

  const release = useCallback(() => {
    h.down = false;
    if (h.phase !== 'charging') return;
    h.phase = 'cooling';
    stopTicks();
    const c = charge.value;
    charge.value = withTiming(0, { duration: 220 + 320 * c, easing: CALM }, (fin) => {
      if (fin) scheduleOnRN(settle);
    });
  }, [h, charge, stopTicks, settle]);

  const reset = useCallback(() => {
    stopTicks();
    drop();
    h.phase = 'idle';
    h.down = false;
    ticker.setActive(false);
    cancelAnimation(charge);
    cancelAnimation(progress);
    charge.value = 0;
    progress.value = 0;
    hidden.value = 0;
  }, [h, drop, ticker, charge, progress, hidden, stopTicks]);

  // The overlay itself is removed on unmount by useBurstOwner.
  useEffect(() => stopTicks, [stopTicks]);

  const maxDistance = opts.maxDistance ?? 24;
  const gesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(0)
        .maxDistance(maxDistance)
        .runOnJS(true)
        .onBegin((e) => {
          begin(e.x, e.y);
        })
        .onFinalize(() => {
          release();
        }),
    [begin, release, maxDistance],
  );

  /**
   * Plain press handlers, the most reliable way to drive a hold (works inside ScrollViews
   * and needs no GestureDetector): <Pressable {...pressHandlers}>.
   */
  const pressHandlers = useMemo(
    () => ({
      onPressIn: (e: GestureResponderEvent) => begin(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPressOut: () => release(),
    }),
    [begin, release],
  );

  return { ref, gesture, pressHandlers, charge, progress, style, reset };
}
