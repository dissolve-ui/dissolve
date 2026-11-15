import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SOFT = Easing.bezier(0.45, 0, 0.2, 1);

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
  /** Space between the two halves once split. Default 28. */
  gap?: number;
  /** Split duration, ms. Default 620. */
  duration?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A button that divides in the middle like a drop of liquid metal: the two halves pull apart,
 * a neck between them thins into a waist, then snaps. Closing fuses them back. Vector edges,
 * no blur, so it stays crisp.
 *
 * <SplitButton label="Delete project" confirmLabel="Delete" onConfirm={remove} />
 */
export function SplitButton({ label, cancelLabel = 'Cancel', confirmLabel = 'Confirm', onConfirm, color = '#FF3B30', cancelColor = '#E9E9EB', cancelTextColor = '#1C1C1E', confirmColor = '#FF3B30', height = 52, gap = 28, duration = 620, haptics = true, style }: SplitButtonProps) {
  const [W, setW] = useState(0);
  const [open, setOpen] = useState(false);
  const p = useSharedValue(0);
  // Colors and labels only change once the drop has actually split.
  const tone = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, { duration, easing: SOFT });
    tone.value = open ? withDelay(duration * 0.78, withTiming(1, { duration: 220 })) : withTiming(0, { duration: 180 });
  }, [open, p, tone, duration]);

  const R = height / 2;
  const cy = R;
  // The neck holds until the halves are this far apart, then snaps.
  const snapAt = gap * 0.8;

  // Two halves that start touching: the whole animation is spent pulling them apart, so the
  // waist forms right away and stretches until it snaps.
  const g = useDerivedValue(() => gap * p.value);
  const width = useDerivedValue(() => (W - g.value) / 2);
  const rightX = useDerivedValue(() => W - width.value);

  const bridge = useDerivedValue(() => {
    const path = Skia.Path.Make();
    if (g.value >= snapAt || W === 0) return path;
    const t = g.value / snapAt; // 0 touching, 1 about to snap
    // Waist half height: full while fused, thins fast near the snap, like surface tension.
    const n = R * (1 - 0.86 * Math.pow(t, 0.8));
    const c1 = width.value - R; // center of the left pill's right cap
    const c2 = rightX.value + R; // center of the right pill's left cap
    // The neck leaves each cap from its very top while fused (no seam), lower as it stretches.
    const phi = ((90 - 35 * t) * Math.PI) / 180;
    const ax = c1 + R * Math.cos(phi);
    const bx = c2 - R * Math.cos(phi);
    const ay = R * Math.sin(phi);
    const span = bx - ax;
    const k = Math.max(4, span * 0.42);
    path.moveTo(ax, cy - ay);
    path.cubicTo(ax + k, cy - n, bx - k, cy - n, bx, cy - ay);
    path.lineTo(bx, cy + ay);
    path.cubicTo(bx - k, cy + n, ax + k, cy + n, ax, cy + ay);
    path.close();
    return path;
  });

  // Both halves stay one liquid color while joined; the left one turns into Cancel after.
  const leftColor = useDerivedValue(() => interpolateColor(tone.value, [0, 1], [color, cancelColor]));
  const rightColor = useDerivedValue(() => interpolateColor(tone.value, [0, 1], [color, confirmColor]));

  const closedLabel = useAnimatedStyle(() => {
    const t = Math.min(1, p.value * 3);
    return { opacity: 1 - t, transform: [{ scale: 1 - 0.12 * t }] };
  });
  const openLabel = useAnimatedStyle(() => {
    const t = tone.value;
    return { opacity: t, transform: [{ scale: 0.88 + 0.12 * t }] };
  });
  const halves = useAnimatedStyle(() => ({ width: width.value }));

  const tap = (fn: () => void) => () => {
    if (haptics) Haptics.selectionAsync();
    fn();
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={[{ height }, style]}>
      {W ? (
        <>
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoundedRect x={0} y={0} width={width} height={height} r={R} color={leftColor} />
            <RoundedRect x={rightX} y={0} width={width} height={height} r={R} color={rightColor} />
            <Path path={bridge} color={color} />
          </Canvas>
          {open ? (
            <>
              <Animated.View style={[s.slot, { left: 0 }, halves]}>
                <Pressable style={s.fill} onPress={tap(() => setOpen(false))}>
                  <Animated.Text style={[s.label, { color: cancelTextColor }, openLabel]}>{cancelLabel}</Animated.Text>
                </Pressable>
              </Animated.View>
              <Animated.View style={[s.slot, { right: 0 }, halves]}>
                <Pressable
                  style={s.fill}
                  onPress={() => {
                    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    onConfirm();
                    setOpen(false);
                  }}
                >
                  <Animated.Text style={[s.label, { color: 'white' }, openLabel]}>{confirmLabel}</Animated.Text>
                </Pressable>
              </Animated.View>
            </>
          ) : (
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
  slot: { position: 'absolute', top: 0, bottom: 0 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
});
