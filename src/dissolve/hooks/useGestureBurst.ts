import type { ViewRef } from '../types';
import { useCallback, useEffect, useRef } from 'react';
import { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { frames } from '../core';
import { useDissolveContext } from '../context';
import type { BurstHandle } from '../types';

/** Calm settle curve shared by the gesture hooks (rewind, cool down). */
export const CALM = Easing.bezier(0.32, 0.72, 0, 1);

type Callbacks = { onCommit?: () => void; onCancel?: () => void };

/**
 * Internal: what every gesture hook (scrub, peel, hold) shares. The captured view ref, the
 * latest options, the burst handle, the `hidden` flag with its animated style (the overlay
 * stands in for the real view while it is 1) and the unmount cleanup.
 */
export function useBurstOwner<O extends Callbacks>(opts: O) {
  const ctx = useDissolveContext();
  const ref = useRef<ViewRef>(null);
  /** 1 while the overlay stands in for the real view. */
  const hidden = useSharedValue(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const s = useRef({ handle: null as BurstHandle | null }).current;

  /** Remove the overlay, if any. */
  const drop = useCallback(() => {
    s.handle?.remove();
    s.handle = null;
  }, [s]);

  useEffect(() => () => s.handle?.remove(), [s]);

  const style = useAnimatedStyle(() => ({ opacity: hidden.value ? 0 : 1 }));

  return { ctx, ref, hidden, optsRef, s, drop, style };
}

/**
 * Internal: lifecycle of a drag driven burst (scrub, peel) on top of useBurstOwner.
 *
 * - progress: raw burst progress, 0..end of the variant.
 * - phase: 0 idle, 1 dragging, 2 settling. Hooks may use more values of their own.
 * - live: 1 while the overlay stands in for the real view and the finger drives it.
 * - committed(): the effect ran to the end, drop the overlay and call onCommit.
 * - rewound(): the effect is back at rest, show the real view, drop the overlay two frames
 *   later and call onCancel.
 * - settle(sv, to, ms): worklet, animates sv back on the calm curve then calls rewound().
 * - reset(): show the real view again after a commit.
 */
export function useDragBurst<O extends Callbacks>(opts: O) {
  const base = useBurstOwner(opts);
  const { hidden, optsRef, drop } = base;
  const progress = useSharedValue(0);
  const phase = useSharedValue(0);
  const live = useSharedValue(0);

  const committed = useCallback(() => {
    drop();
    // The overlay is gone: a new drag on the hidden view must not drive a dead progress.
    live.value = 0;
    phase.value = 0;
    optsRef.current.onCommit?.();
  }, [drop, live, phase, optsRef]);

  const rewound = useCallback(() => {
    hidden.value = 0;
    frames(2).then(() => {
      drop();
      phase.value = 0;
      optsRef.current.onCancel?.();
    });
  }, [drop, hidden, phase, optsRef]);

  const settle = useCallback(
    (sv: SharedValue<number>, to: number, duration: number) => {
      'worklet';
      sv.value = withTiming(to, { duration, easing: CALM }, (fin) => {
        if (fin) {
          live.value = 0;
          scheduleOnRN(rewound);
        }
      });
    },
    [live, rewound],
  );

  const reset = useCallback(() => {
    cancelAnimation(progress);
    drop();
    progress.value = 0;
    live.value = 0;
    phase.value = 0;
    hidden.value = 0;
  }, [progress, drop, live, phase, hidden]);

  return { ...base, progress, phase, live, committed, rewound, settle, reset };
}
