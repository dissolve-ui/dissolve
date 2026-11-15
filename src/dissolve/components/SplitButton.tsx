import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/** Critically damped spring: smooth, no visible bounce. */
const SPRING = { stiffness: 240, damping: 30, mass: 1 };

export type SplitButtonProps = {
  label: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  color?: string;
  cancelColor?: string;
  cancelTextColor?: string;
  confirmColor?: string;
  height?: number;
  gap?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A button that slides apart into Cancel and Confirm, then closes back into one. Two crisp
 * pills on a soft spring, labels cross-fade. Good for destructive actions without a modal.
 *
 * <SplitButton label="Delete project" confirmLabel="Delete" onConfirm={remove} />
 */
export function SplitButton({ label, cancelLabel = 'Cancel', confirmLabel = 'Confirm', onConfirm, color = '#FF3B30', cancelColor = '#E9E9EB', cancelTextColor = '#1C1C1E', confirmColor = '#FF3B30', height = 52, gap = 10, haptics = true, style }: SplitButtonProps) {
  const [W, setW] = useState(0);
  const [open, setOpen] = useState(false);
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withSpring(open ? 1 : 0, SPRING);
  }, [open, p]);

  const half = (W - gap) / 2;
  const left = useAnimatedStyle(() => ({
    width: W + (half - W) * p.value,
    backgroundColor: interpolateColor(Math.min(1, p.value * 1.6), [0, 1], [color, cancelColor]),
  }));
  const right = useAnimatedStyle(() => ({
    width: W + (half - W) * p.value,
    backgroundColor: interpolateColor(p.value, [0, 1], [color, confirmColor]),
  }));
  const closedLabel = useAnimatedStyle(() => {
    const t = Math.min(1, p.value * 2);
    return { opacity: 1 - t, transform: [{ scale: 1 - 0.15 * t }] };
  });
  const openLabel = useAnimatedStyle(() => {
    const t = Math.max(0, p.value * 2 - 1);
    return { opacity: t, transform: [{ scale: 0.85 + 0.15 * t }] };
  });

  const tap = (fn: () => void) => () => {
    if (haptics) Haptics.selectionAsync();
    fn();
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={[{ height }, style]}>
      {W ? (
        <>
          <Animated.View style={[s.pill, { left: 0, height, borderRadius: height / 2 }, left]}>
            <Pressable style={s.fill} disabled={!open} onPress={tap(() => setOpen(false))}>
              <Animated.Text style={[s.label, { color: cancelTextColor }, openLabel]}>{cancelLabel}</Animated.Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[s.pill, { right: 0, height, borderRadius: height / 2 }, right]}>
            <Pressable
              style={s.fill}
              disabled={!open}
              onPress={() => {
                if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onConfirm();
                setOpen(false);
              }}
            >
              <Animated.Text style={[s.label, { color: 'white' }, openLabel]}>{confirmLabel}</Animated.Text>
            </Pressable>
          </Animated.View>
          {open ? null : (
            <Pressable style={StyleSheet.absoluteFill} onPress={tap(() => setOpen(true))} accessibilityRole="button">
              <Animated.View style={[s.fill, closedLabel]}>
                <Text style={[s.label, { color: 'white' }]}>{label}</Text>
              </Animated.View>
            </Pressable>
          )}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  pill: { position: 'absolute', top: 0, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
});
