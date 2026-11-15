import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/** Critically damped: smooth like the Dynamic Island, no visible bounce. */
const SPRING = { stiffness: 260, damping: 31, mass: 1 };
const CHECK = Skia.Path.MakeFromSVGString('M5 12.5l4.2 4.2L19 7')!;

export type MorphButtonProps = {
  label: string;
  doneLabel?: string;
  /** Runs on press. The button stays in its loading state until the promise settles. */
  onPress: () => Promise<unknown> | void;
  color?: string;
  doneColor?: string;
  textColor?: string;
  height?: number;
  /** Time spent on the done state before going back, ms. 0 stays done. Default 1800. */
  resetAfter?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Phase = 'idle' | 'loading' | 'done';

/**
 * A button that morphs like the Dynamic Island: the pill folds into a round loader, then
 * opens back up as the done state. Crisp shape, soft spring, content cross-fades and scales.
 *
 * <MorphButton label="Pay 42 €" doneLabel="Paid" onPress={pay} />
 */
export function MorphButton({ label, doneLabel = 'Done', onPress, color = '#1C1C1E', doneColor = '#34C759', textColor = '#FFFFFF', height = 52, resetAfter = 1800, haptics = true, style }: MorphButtonProps) {
  const [W, setW] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const w = useSharedValue(0);
  const tone = useSharedValue(0);
  const show = useSharedValue(0); // 0 label, 1 spinner, 2 done
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!W) return;
    w.value = withSpring(phase === 'loading' ? height : W, SPRING);
    tone.value = withTiming(phase === 'done' ? 1 : 0, { duration: 380, easing: Easing.bezier(0.32, 0.72, 0, 1) });
    show.value = withTiming(phase === 'idle' ? 0 : phase === 'loading' ? 1 : 2, { duration: 300, easing: Easing.bezier(0.32, 0.72, 0, 1) });
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
    backgroundColor: interpolateColor(tone.value, [0, 1], [color, doneColor]),
  }));
  // Each layer fades and scales on its own slot of the timeline, like island content.
  const layer = (at: number) =>
    useAnimatedStyle(() => {
      const d = Math.min(1, Math.abs(show.value - at));
      return { opacity: 1 - d, transform: [{ scale: 1 - 0.18 * d }] };
    });
  const labelStyle = layer(0);
  const doneStyle = layer(2);
  const spinStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(show.value - 1));
    return { opacity: 1 - d, transform: [{ scale: 1 - 0.3 * d }, { rotate: `${spin.value * 360}deg` }] };
  });

  return (
    <Pressable onPress={press} onLayout={onLayout} accessibilityRole="button" accessibilityState={{ busy: phase === 'loading' }} style={[{ height }, style]}>
      {W ? (
        <Animated.View style={[s.pill, { height, borderRadius: height / 2 }, pill]}>
          <Animated.Text style={[s.label, { color: textColor }, labelStyle]} numberOfLines={1}>
            {label}
          </Animated.Text>
          <Animated.View style={[s.abs, spinStyle]}>
            <View style={[s.spinner, { borderColor: textColor, borderTopColor: 'transparent' }]} />
          </Animated.View>
          <Animated.View style={[s.abs, s.row, doneStyle]}>
            <Canvas style={{ width: 20, height: 20 }}>
              <Path path={CHECK} color={textColor} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" transform={[{ scale: 20 / 24 }]} />
            </Canvas>
            <Text style={[s.label, { color: textColor }]} numberOfLines={1}>
              {doneLabel}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  abs: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  label: { fontSize: 16, fontWeight: '600' },
  spinner: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.2 },
});
