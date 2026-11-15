import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gooLayer } from './goo';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const PAD = 14;

export type SplitButtonProps = {
  label: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  color?: string;
  cancelColor?: string;
  confirmColor?: string;
  height?: number;
  gap?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A button that splits like a drop into Cancel and Confirm, and melts back into one.
 * Good for destructive actions without a modal.
 *
 * <SplitButton label="Delete project" confirmLabel="Delete" onConfirm={remove} />
 */
export function SplitButton({ label, cancelLabel = 'Cancel', confirmLabel = 'Confirm', onConfirm, color = '#FF3B30', cancelColor = '#E5E5EA', confirmColor = '#FF3B30', height = 52, gap = 10, haptics = true, style }: SplitButtonProps) {
  const [W, setW] = useState(0);
  const [open, setOpen] = useState(false);
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, { duration: 560, easing: CALM });
  }, [open, p]);

  const half = (W - gap) / 2;
  const width = useDerivedValue(() => W + (half - W) * p.value);
  const rightX = useDerivedValue(() => PAD + W - width.value);
  const leftColor = useDerivedValue(() => interpolateColor(p.value, [0, 0.6, 1], [color, color, cancelColor]));
  const rightColor = useDerivedValue(() => interpolateColor(p.value, [0, 1], [color, confirmColor]));

  const closedStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, p.value * 2.5) }));
  const openStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, p.value * 2 - 1) }));

  const tap = (fn: () => void) => () => {
    if (haptics) Haptics.selectionAsync();
    fn();
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={[{ height }, style]}>
      {W ? (
        <Canvas style={{ position: 'absolute', left: -PAD, top: -PAD, width: W + PAD * 2, height: height + PAD * 2 }} pointerEvents="none">
          <Group layer={gooLayer(6)}>
            <RoundedRect x={PAD} y={PAD} width={width} height={height} r={height / 2} color={leftColor} />
            <RoundedRect x={rightX} y={PAD} width={width} height={height} r={height / 2} color={rightColor} />
          </Group>
        </Canvas>
      ) : null}
      {open ? (
        <Animated.View style={[StyleSheet.absoluteFill, s.row, { gap }, openStyle]}>
          <Pressable style={s.half} onPress={tap(() => setOpen(false))}>
            <Text style={[s.label, { color: '#1C1C1E' }]}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            style={s.half}
            onPress={() => {
              if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onConfirm();
              setOpen(false);
            }}
          >
            <Text style={[s.label, { color: 'white' }]}>{confirmLabel}</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPress={tap(() => setOpen(true))} accessibilityRole="button">
          <Animated.View style={[s.center, closedStyle]}>
            <Text style={[s.label, { color: 'white' }]}>{label}</Text>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
});
