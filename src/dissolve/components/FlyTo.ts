import { useCallback, type RefObject } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useDissolve } from '../hooks/useDissolve';
import type { Box, VariantName, ViewRef } from '../types';

export type FlyToOptions = {
  /** Where the grains land: a ref to the cart icon, a tab, a badge, or a window rect. */
  target: RefObject<ViewRef | null> | Box;
  /** Called when most grains have landed: bump a badge, increment a counter. */
  onArrive?: () => void;
  /** Default 'stream'. */
  preset?: VariantName;
  duration?: number;
  grain?: number;
  haptics?: boolean;
};

/**
 * Add to cart: a copy of the view flies into the target as grains, the view itself stays.
 *
 * const cart = useRef(null);
 * const { ref, fly } = useFlyTo({ target: cart, onArrive: () => setCount((c) => c + 1) });
 * <View ref={ref} collapsable={false}><ProductImage /></View>
 * <Button onPress={fly} title="Add to bag" />
 */
export function useFlyTo({ target, onArrive, preset = 'stream', duration = 1100, grain, haptics }: FlyToOptions) {
  const { ref, dissolve, reset } = useDissolve();
  const fly = useCallback(async () => {
    await dissolve({ preset, to: target, onArrive, duration, grain, haptics });
    reset();
  }, [dissolve, reset, preset, target, onArrive, duration, grain, haptics]);
  return { ref, fly };
}

/** A small scale bump for the element that receives the grains (cart icon, badge). */
export function useBump(scale = 1.18) {
  const v = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  const bump = useCallback(() => {
    v.value = withSequence(withTiming(scale, { duration: 110, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1) }));
  }, [v, scale]);
  return { style, bump };
}
