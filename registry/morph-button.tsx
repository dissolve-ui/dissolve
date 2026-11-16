/**
 * MorphButton, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the spring, the copy, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box: primary at rest, success when done.
 *
 * A button that morphs like the Dynamic Island: the pill folds into a round loader, then
 * opens back up as the done state. Crisp shape, soft spring, content cross-fades and scales.
 *
 * <MorphButton label="Pay 42 €" doneLabel="Paid" onPress={pay} />
 */
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, Text, View, cn, useToken } from './tw';

/** Critically damped: smooth like the Dynamic Island, no visible bounce. */
const SPRING = { stiffness: 260, damping: 31, mass: 1 };
const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const CHECK = Skia.Path.MakeFromSVGString('M5 12.5l4.2 4.2L19 7')!;

export type MorphButtonProps = {
  label: string;
  doneLabel?: string;
  /** Runs on press. The button stays in its loading state until the promise settles. */
  onPress: () => Promise<unknown> | void;
  /** Height in points. Default 52. */
  height?: number;
  /** Time spent on the done state before going back, ms. 0 stays done. Default 1800. */
  resetAfter?: number;
  haptics?: boolean;
  /** Outer classes (width, margins...). The pill is centered inside it. */
  className?: string;
  /** Label and done label classes (size, weight, color). */
  labelClassName?: string;
};

type Phase = 'idle' | 'loading' | 'done';

export function MorphButton({ label, doneLabel = 'Done', onPress, height = 52, resetAfter = 1800, haptics = true, className, labelClassName }: MorphButtonProps) {
  const fill = useToken('primary');
  const onFill = useToken('primary-foreground');
  const success = useToken('success');

  const [W, setW] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const w = useSharedValue(0);
  const tone = useSharedValue(0);
  const show = useSharedValue(0); // 0 label, 1 spinner, 2 done
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!W) return;
    w.value = withSpring(phase === 'loading' ? height : W, SPRING);
    tone.value = withTiming(phase === 'done' ? 1 : 0, { duration: 380, easing: CALM });
    show.value = withTiming(phase === 'idle' ? 0 : phase === 'loading' ? 1 : 2, { duration: 300, easing: CALM });
    if (phase === 'loading') spin.value = withRepeat(withTiming(spin.value + 1, { duration: 900, easing: Easing.linear }), -1);
    else cancelAnimation(spin);
  }, [phase, W, height, w, tone, show, spin]);

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    if (!W) w.value = nw;
    setW(nw);
  };

  const press = async () => {
    if (phase !== 'idle') return;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('loading');
    try {
      await onPress();
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('done');
      if (resetAfter) setTimeout(() => setPhase('idle'), resetAfter);
    } catch {
      setPhase('idle');
    }
  };

  const pill = useAnimatedStyle(() => ({
    width: w.value,
    left: (W - w.value) / 2,
    backgroundColor: interpolateColor(tone.value, [0, 1], [fill, success]),
  }));
  // Each layer fades and scales on its own slot of the timeline, like island content.
  const labelStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(show.value - 0));
    return { opacity: 1 - d, transform: [{ scale: 1 - 0.18 * d }] };
  });
  const doneStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(show.value - 2));
    return { opacity: 1 - d, transform: [{ scale: 1 - 0.18 * d }] };
  });
  const spinStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(show.value - 1));
    return { opacity: 1 - d, transform: [{ scale: 1 - 0.3 * d }, { rotate: `${spin.value * 360}deg` }] };
  });

  const text = cn('text-base font-semibold text-dissolve-primary-foreground', labelClassName);

  return (
    <Pressable onPress={press} onLayout={onLayout} accessibilityRole="button" accessibilityState={{ busy: phase === 'loading' }} className={className} style={{ height }}>
      {W ? (
        <Animated.View className="absolute top-0 items-center justify-center overflow-hidden" style={[{ height, borderRadius: height / 2 }, pill]}>
          <Animated.Text className={text} style={labelStyle} numberOfLines={1}>
            {label}
          </Animated.Text>
          <Animated.View className="absolute items-center justify-center" style={spinStyle}>
            <View className="h-5 w-5 rounded-full" style={{ borderWidth: 2.2, borderColor: onFill, borderTopColor: 'transparent' }} />
          </Animated.View>
          <Animated.View className="absolute flex-row items-center justify-center gap-1.5" style={doneStyle}>
            <Canvas style={{ width: 20, height: 20 }}>
              <Path path={CHECK} color={onFill} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" transform={[{ scale: 20 / 24 }]} />
            </Canvas>
            <Text className={text} numberOfLines={1}>
              {doneLabel}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
