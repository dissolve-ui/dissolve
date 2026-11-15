import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gooLayer } from './goo';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const PAD = 14;
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
 * A button that pours itself into a loading drop, then flows back out as the done state.
 * The pill shrinks to a circle while two droplets lag behind and get absorbed.
 *
 * <MorphButton label="Pay 42 €" doneLabel="Paid" onPress={pay} />
 */
export function MorphButton({ label, doneLabel = 'Done', onPress, color = '#1C1C1E', doneColor = '#34C759', textColor = '#FFFFFF', height = 52, resetAfter = 1800, haptics = true, style }: MorphButtonProps) {
  const [W, setW] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const w = useSharedValue(0);
  const tail = useSharedValue(0);
  const tone = useSharedValue(0);
  const show = useSharedValue(0); // 0 label, 1 spinner, 2 done
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!W) return;
    const target = phase === 'loading' ? height : W;
    w.value = withTiming(target, { duration: 420, easing: CALM });
    tail.value = withTiming(target, { duration: 760, easing: CALM });
    tone.value = withTiming(phase === 'done' ? 1 : 0, { duration: 320 });
    show.value = withTiming(phase === 'idle' ? 0 : phase === 'loading' ? 1 : 2, { duration: 220 });
    if (phase === 'loading') spin.value = withRepeat(withTiming(spin.value + 1, { duration: 800, easing: Easing.linear }), -1);
    else cancelAnimation(spin);
  }, [phase, W, height, w, tail, tone, show, spin]);

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    if (!W) {
      w.value = nw;
      tail.value = nw;
    }
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

  const cy = PAD + height / 2;
  const x = useDerivedValue(() => PAD + (W - w.value) / 2);
  const dropR = height * 0.36;
  const rightX = useDerivedValue(() => PAD + (W + tail.value) / 2 - height / 2);
  const leftX = useDerivedValue(() => PAD + (W - tail.value) / 2 + height / 2);
  const fill = useDerivedValue(() => interpolateColor(tone.value, [0, 1], [color, doneColor]));

  const labelStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, show.value) }));
  const spinStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.abs(show.value - 1), transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const doneStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, show.value - 1) }));

  return (
    <Pressable onPress={press} onLayout={onLayout} accessibilityRole="button" accessibilityState={{ busy: phase === 'loading' }} style={[{ height }, style]}>
      {W ? (
        <Canvas style={{ position: 'absolute', left: -PAD, top: -PAD, width: W + PAD * 2, height: height + PAD * 2 }}>
          <Group layer={gooLayer(6)}>
            <RoundedRect x={x} y={PAD} width={w} height={height} r={height / 2} color={fill} />
            <Circle cx={leftX} cy={cy} r={dropR} color={fill} />
            <Circle cx={rightX} cy={cy} r={dropR} color={fill} />
          </Group>
        </Canvas>
      ) : null}
      <View style={s.center} pointerEvents="none">
        <Animated.Text style={[s.label, { color: textColor }, labelStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </View>
      <View style={s.center} pointerEvents="none">
        <Animated.View style={[s.spinner, { borderColor: textColor, borderTopColor: 'transparent' }, spinStyle]} />
      </View>
      <View style={s.center} pointerEvents="none">
        <Animated.View style={[s.row, doneStyle]}>
          <Canvas style={{ width: 20, height: 20 }}>
            <Path path={CHECK} color={textColor} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" transform={[{ scale: 20 / 24 }]} />
          </Canvas>
          <Text style={[s.label, { color: textColor }]}>{doneLabel}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
  spinner: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
