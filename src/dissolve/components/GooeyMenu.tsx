import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gooLayer } from './goo';

const SOFT = Easing.inOut(Easing.cubic);
const PAD = 16;

export type GooeyMenuItem = { icon: ReactNode; onPress: () => void; label?: string };

export type GooeyMenuProps = {
  items: GooeyMenuItem[];
  /** Diameter of the main button. Default 56. */
  size?: number;
  /** Distance from the main button to the actions. Default 92. */
  distance?: number;
  /** Arc in degrees, 0 = right, -90 = up. Default from -90 (up) to -180 (left). */
  startAngle?: number;
  endAngle?: number;
  color?: string;
  iconColor?: string;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

const local = (p: number, i: number, n: number) => {
  'worklet';
  const step = 0.14;
  const t = (p - i * step) / Math.max(0.0001, 1 - step * (n - 1));
  return t < 0 ? 0 : t > 1 ? 1 : t;
};

function Blob({ i, n, p, c, dir, distance, r, color }: { i: number; n: number; p: SharedValue<number>; c: { x: number; y: number }; dir: { x: number; y: number }; distance: number; r: number; color: string }) {
  const t = useDerivedValue(() => local(p.value, i, n));
  const cx = useDerivedValue(() => c.x + dir.x * distance * t.value);
  const cy = useDerivedValue(() => c.y + dir.y * distance * t.value);
  const rr = useDerivedValue(() => r * (0.5 + 0.5 * Math.min(1, t.value * 1.6)));
  // A strand from the button to the drop that thins out and breaks around two thirds.
  const sx = useDerivedValue(() => c.x + dir.x * distance * t.value * 0.5);
  const sy = useDerivedValue(() => c.y + dir.y * distance * t.value * 0.5);
  const sr = useDerivedValue(() => (t.value > 0.7 ? 0 : r * 0.55 * (1 - t.value / 0.7)));
  return (
    <>
      <Circle cx={sx} cy={sy} r={sr} color={color} />
      <Circle cx={cx} cy={cy} r={rr} color={color} />
    </>
  );
}

function Action({ item, i, n, p, c, dir, distance, size, close }: { item: GooeyMenuItem; i: number; n: number; p: SharedValue<number>; c: { x: number; y: number }; dir: { x: number; y: number }; distance: number; size: number; close: () => void }) {
  const style = useAnimatedStyle(() => {
    const t = local(p.value, i, n);
    return {
      opacity: t < 0.55 ? 0 : (t - 0.55) / 0.45,
      transform: [{ translateX: c.x + dir.x * distance * t - size / 2 }, { translateY: c.y + dir.y * distance * t - size / 2 }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={s.fill}
        onPress={() => {
          item.onPress();
          close();
        }}
      >
        {item.icon}
      </Pressable>
    </Animated.View>
  );
}

/**
 * A floating button whose actions pour out of it as drops and melt back in when it closes.
 * Place it absolutely (it reserves room for the arc above and to the left of the button).
 *
 * <GooeyMenu style={{ position: 'absolute', right: 8, bottom: 8 }} items={[
 *   { icon: <Icon name="camera" />, onPress: openCamera, label: 'Camera' },
 * ]} />
 */
export function GooeyMenu({ items, size = 56, distance = 92, startAngle = -90, endAngle = -180, color = '#1C1C1E', iconColor = '#FFFFFF', haptics = true, style }: GooeyMenuProps) {
  const [open, setOpen] = useState(false);
  const p = useSharedValue(0);
  const n = items.length;
  const box = distance + size + PAD * 2;
  const c = { x: box - PAD - size / 2, y: box - PAD - size / 2 };
  const R = size / 2;
  const itemSize = size * 0.82;

  const toggle = (next = !open) => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(next);
    p.value = withTiming(next ? 1 : 0, { duration: next ? 1000 : 820, easing: SOFT });
  };

  const dirs = items.map((_, i) => {
    const a = ((startAngle + ((endAngle - startAngle) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
  });

  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 45}deg` }] }));

  return (
    <View style={[{ width: box, height: box }, style]} pointerEvents="box-none">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group layer={gooLayer(9)}>
          <Circle cx={c.x} cy={c.y} r={R} color={color} />
          {items.map((_, i) => (
            <Blob key={i} i={i} n={n} p={p} c={c} dir={dirs[i]} distance={distance} r={itemSize / 2} color={color} />
          ))}
        </Group>
      </Canvas>
      {open
        ? items.map((it, i) => <Action key={i} item={it} i={i} n={n} p={p} c={c} dir={dirs[i]} distance={distance} size={itemSize} close={() => toggle(false)} />)
        : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => toggle()}
        style={{ position: 'absolute', left: c.x - R, top: c.y - R, width: size, height: size }}
      >
        <Animated.View style={[s.fill, plus]}>
          <View style={[s.bar, { backgroundColor: iconColor }]} />
          <View style={[s.bar, s.vbar, { backgroundColor: iconColor }]} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', width: 20, height: 2.6, borderRadius: 2 },
  vbar: { transform: [{ rotate: '90deg' }] },
});
