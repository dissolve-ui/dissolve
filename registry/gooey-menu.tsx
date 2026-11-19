/**
 * GooeyMenu, from dissolve (dissolve-ui). This file is yours: restyle it with
 * classNames, change the timings, the arc, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * A floating button whose actions pour out of it as drops and melt back in when it closes.
 * Place it absolutely (it reserves room for the arc above and to the left of the button).
 *
 * <GooeyMenu className="absolute bottom-2 right-2" items={[
 *   { icon: <CameraIcon />, onPress: openCamera, label: 'Camera' },
 * ]} />
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Blur, Canvas, Circle, ColorMatrix, Group, Paint } from '@shopify/react-native-skia';
import { Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, View, cn, useToken } from './tw';

const SOFT = Easing.inOut(Easing.cubic);
/** Reduced motion: the drops pour out and melt back in this fast. */
const REDUCED_MS = 200;
const PAD = 16;

/**
 * The liquid look: shapes are blurred together, then the alpha is pushed back to a hard edge
 * (alpha * 20 - 9). Close shapes melt into one blob with a neck between them, colors stay untouched.
 */
const GOO_MATRIX = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 20, -9];

function gooLayer(blur = 7) {
  return (
    <Paint>
      <Blur blur={blur} />
      <ColorMatrix matrix={GOO_MATRIX} />
    </Paint>
  );
}

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
  haptics?: boolean;
  /** Root classes (position, margins...). */
  className?: string;
  /** Classes of the two bars of the plus icon (their color). */
  iconClassName?: string;
};

const local = (p: number, i: number, n: number) => {
  'worklet';
  const step = 0.14;
  const t = (p - i * step) / Math.max(0.0001, 1 - step * (n - 1));
  return t < 0 ? 0 : t > 1 ? 1 : t;
};

type Vec = { x: number; y: number };

function Blob({ i, n, p, c, dir, distance, r, color }: { i: number; n: number; p: SharedValue<number>; c: Vec; dir: Vec; distance: number; r: number; color: string }) {
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

function Action({ item, i, n, p, c, dir, distance, size, close }: { item: GooeyMenuItem; i: number; n: number; p: SharedValue<number>; c: Vec; dir: Vec; distance: number; size: number; close: () => void }) {
  const style = useAnimatedStyle(() => {
    const t = local(p.value, i, n);
    return {
      opacity: t < 0.55 ? 0 : (t - 0.55) / 0.45,
      transform: [{ translateX: c.x + dir.x * distance * t - size / 2 }, { translateY: c.y + dir.y * distance * t - size / 2 }],
    };
  });
  return (
    <Animated.View className="absolute left-0 top-0" style={[{ width: size, height: size }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        className="flex-1 items-center justify-center"
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

export function GooeyMenu({ items, size = 56, distance = 92, startAngle = -90, endAngle = -180, haptics = true, className, iconClassName }: GooeyMenuProps) {
  const reduced = useReducedMotion();
  const color = useToken('primary');

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
    p.value = withTiming(next ? 1 : 0, { duration: reduced ? REDUCED_MS : next ? 1000 : 820, easing: SOFT });
  };

  const dirs = items.map((_, i) => {
    const a = ((startAngle + ((endAngle - startAngle) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
  });

  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 45}deg` }] }));
  const bar = cn('absolute h-[2.6px] w-5 rounded-[2px] bg-dissolve-primary-foreground', iconClassName);

  return (
    <View className={className} style={{ width: box, height: box }} pointerEvents="box-none">
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
        className="absolute"
        style={{ left: c.x - R, top: c.y - R, width: size, height: size }}
      >
        <Animated.View className="flex-1 items-center justify-center" style={plus}>
          <View className={bar} />
          <View className={bar} style={{ transform: [{ rotate: '90deg' }] }} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
