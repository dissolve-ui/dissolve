import type { ViewRef } from '../types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GestureResponderEvent, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { DEFAULT_END, frames } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import { runDissolve } from './useDissolve';
import type { BurstHandle, VariantName } from '../types';

/**
 * GROUP C. Hold to destroy (docs/VARIANTS.md section 6), built for the 'charge' variant.
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

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

export function useDissolveHold(opts: HoldOptions = {}) {
  const ctx = useDissolveContext();
  const ref = useRef<ViewRef>(null);
  /** 0..1 while held (aux0 of the burst). Usable for a progress ring. */
  const charge = useSharedValue(0);
  /** Clock in ms (aux1 of the burst). */
  const clock = useSharedValue(0);
  /** Raw burst progress, 0..end of the variant. */
  const progress = useSharedValue(0);
  /** 1 while the overlay stands in for the real view. */
  const hidden = useSharedValue(0);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const s = useRef({
    phase: 'idle' as Phase,
    down: false,
    handle: null as BurstHandle | null,
    tick: null as ReturnType<typeof setTimeout> | null,
  }).current;

  const ticker = useFrameCallback((f) => {
    clock.value = f.timeSinceFirstFrame;
  }, false);

  const stopTicks = useCallback(() => {
    if (s.tick) clearTimeout(s.tick);
    s.tick = null;
  }, [s]);

  const startTicks = useCallback(() => {
    stopTicks();
    if (optsRef.current.haptics === false) return;
    const loop = () => {
      if (s.phase !== 'charging') return;
      const c = charge.value;
      if (c > 0.7) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.selectionAsync();
      s.tick = setTimeout(loop, 120 - 90 * c);
    };
    loop();
  }, [s, charge, stopTicks]);

  const finish = useCallback(() => {
    if (s.phase !== 'committing') return;
    s.phase = 'done';
    ticker.setActive(false);
    s.handle?.remove();
    s.handle = null;
    charge.value = 0;
    optsRef.current.onCommit?.();
  }, [s, ticker, charge]);

  const commit = useCallback(() => {
    if (s.phase !== 'charging') return;
    s.phase = 'committing';
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
  }, [s, hidden, progress, stopTicks, finish]);

  const startCharge = useCallback(() => {
    s.phase = 'charging';
    hidden.value = s.handle ? 1 : 0;
    if (s.handle) ticker.setActive(true);
    const holdMs = optsRef.current.holdMs ?? 1200;
    const left = Math.max(1, holdMs * (1 - charge.value));
    charge.value = withTiming(1, { duration: left, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(commit);
    });
    startTicks();
  }, [s, hidden, ticker, charge, commit, startTicks]);

  const settle = useCallback(() => {
    if (s.phase !== 'cooling') return;
    // Real view back first, overlay dropped once it has painted.
    hidden.value = 0;
    ticker.setActive(false);
    frames(2).then(() => {
      if (s.phase !== 'cooling') return;
      s.handle?.remove();
      s.handle = null;
      s.phase = 'idle';
      optsRef.current.onCancel?.();
    });
  }, [s, hidden, ticker]);

  const begin = useCallback(
    async (x: number, y: number) => {
      if (s.phase === 'committing' || s.phase === 'done') return;
      s.down = true;
      if (s.phase === 'cooling') {
        // Pressed again while calming down: keep the same overlay and charge from here.
        cancelAnimation(charge);
        startCharge();
        return;
      }
      if (s.phase !== 'idle') return;
      s.phase = 'arming';
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
      if (!s.down) {
        s.handle?.remove();
        s.handle = null;
        s.phase = 'idle';
        return;
      }
      startCharge();
    },
    [ctx, s, charge, clock, progress, startCharge],
  );

  const release = useCallback(() => {
    s.down = false;
    if (s.phase !== 'charging') return;
    s.phase = 'cooling';
    stopTicks();
    const c = charge.value;
    charge.value = withTiming(0, { duration: 220 + 320 * c, easing: CALM }, (fin) => {
      if (fin) scheduleOnRN(settle);
    });
  }, [s, charge, stopTicks, settle]);

  const reset = useCallback(() => {
    stopTicks();
    s.handle?.remove();
    s.handle = null;
    s.phase = 'idle';
    s.down = false;
    ticker.setActive(false);
    cancelAnimation(charge);
    cancelAnimation(progress);
    charge.value = 0;
    progress.value = 0;
    hidden.value = 0;
  }, [s, ticker, charge, progress, hidden, stopTicks]);

  useEffect(
    () => () => {
      stopTicks();
      s.handle?.remove();
    },
    [s, stopTicks],
  );

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

  const style = useAnimatedStyle(() => ({ opacity: hidden.value ? 0 : 1 }));

  return { ref, gesture, pressHandlers, charge, progress, style, reset };
}
