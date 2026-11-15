import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
/** Fling landing: cubic ease out, its start slope (3) is matched to the finger velocity. */
const GLIDE = Easing.out(Easing.cubic);

export type WheelItem = string | { label: string; value: unknown };

export type WheelPickerProps<T extends WheelItem = WheelItem> = {
  items: readonly T[];
  /** Controlled selection. The wheel glides to it when it changes. */
  selectedIndex?: number;
  /** Initial selection when uncontrolled. Default 0. */
  defaultIndex?: number;
  /** Called once the wheel settles on a new item. */
  onChange?: (index: number, item: T) => void;
  /** Row height in points. Default 36. */
  itemHeight?: number;
  /** Rows of the visible window (the cylinder fills it). Default 5. */
  visibleCount?: number;
  /** Text alignment of the rows. Default 'center'. */
  align?: 'left' | 'center' | 'right';
  /** Static unit next to the selection, like "hours" in the timer picker. */
  label?: string;
  fontSize?: number;
  color?: string;
  bandColor?: string;
  textStyle?: StyleProp<TextStyle>;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

const labelOf = (it: WheelItem) => (typeof it === 'string' ? it : it.label);

/** Inside a WheelPickerGroup the band is drawn once behind all the wheels. */
const GroupContext = createContext(false);

/**
 * Several wheels side by side with one shared selection band, like the iOS time picker.
 *
 * <WheelPickerGroup>
 *   <WheelPicker items={hours} align="right" />
 *   <WheelPicker items={minutes} align="left" />
 * </WheelPickerGroup>
 */
export function WheelPickerGroup({ children, itemHeight = 36, visibleCount = 5, bandColor = 'rgba(118,118,128,0.12)', style }: { children: ReactNode; itemHeight?: number; visibleCount?: number; bandColor?: string; style?: StyleProp<ViewStyle> }) {
  const H = itemHeight * visibleCount;
  return (
    <GroupContext.Provider value>
      <View style={[{ height: H, flexDirection: 'row' }, style]}>
        <View pointerEvents="none" style={[s.band, { top: (H - itemHeight) / 2, height: itemHeight, borderRadius: Math.min(10, itemHeight / 3.5), backgroundColor: bandColor, left: 0, right: 0 }]} />
        {children}
      </View>
    </GroupContext.Provider>
  );
}

type RowProps = {
  index: number;
  text: string;
  scroll: SharedValue<number>;
  itemHeight: number;
  radius: number;
  step: number;
  perspective: number;
  style: StyleProp<TextStyle>;
  align: 'left' | 'center' | 'right';
};

/**
 * One row on the cylinder. Its angle comes from its distance to the center; translateY puts it
 * on the circle, rotateX tilts it with the surface, the scale fakes depth (no translateZ in RN)
 * and the opacity falls off toward the rims.
 */
function Row({ index, text, scroll, itemHeight, radius, step, perspective, style, align }: RowProps) {
  const st = useAnimatedStyle(() => {
    const theta = ((index * itemHeight - scroll.value) / itemHeight) * step;
    const limit = Math.PI / 2;
    if (theta < -limit || theta > limit) return { opacity: 0, transform: [{ translateY: 0 }, { rotateX: '0rad' }, { scale: 1 }] };
    const cos = Math.cos(theta);
    const depth = radius * (1 - cos);
    return {
      opacity: Math.pow(cos, 1.6) * 0.92 + 0.08 * cos,
      transform: [{ perspective }, { translateY: radius * Math.sin(theta) }, { rotateX: `${-theta}rad` }, { scale: perspective / (perspective + depth) }],
    };
  });
  return (
    <Animated.View style={[s.row, { height: itemHeight, top: -itemHeight / 2 }, st]}>
      <Text numberOfLines={1} style={[style, { textAlign: align, lineHeight: itemHeight }]}>
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * iOS style wheel picker. Rows sit on a 3D cylinder, a band marks the selection, a fling glides
 * on and lands exactly on a row, a light tick plays every time a row crosses the center.
 *
 * <WheelPicker items={['S', 'M', 'L', 'XL']} defaultIndex={1} onChange={(i, size) => setSize(size)} />
 */
export function WheelPicker<T extends WheelItem = WheelItem>({
  items,
  selectedIndex,
  defaultIndex = 0,
  onChange,
  itemHeight = 36,
  visibleCount = 5,
  align = 'center',
  label,
  fontSize,
  color = '#1C1C1E',
  bandColor = 'rgba(118,118,128,0.12)',
  textStyle,
  haptics = true,
  style,
}: WheelPickerProps<T>) {
  const grouped = useContext(GroupContext);
  const n = items.length;
  const H = itemHeight * visibleCount;
  // The cylinder fills the window: radius is half the height, the chord between two rows at
  // the center equals one row.
  const radius = H / 2;
  const step = 2 * Math.asin(Math.min(1, itemHeight / (2 * radius)));
  const perspective = H * 2.6;
  const max = Math.max(0, (n - 1) * itemHeight);
  const clampIndex = useCallback((i: number) => Math.max(0, Math.min(n - 1, i)), [n]);

  const initial = clampIndex(selectedIndex ?? defaultIndex);
  const scroll = useSharedValue(initial * itemHeight);
  const [center, setCenter] = useState(initial);
  const settled = useRef(initial);
  const dragging = useSharedValue(false);
  const raw = useSharedValue(0);
  const lastTick = useRef(0);

  const onCross = useCallback(
    (i: number) => {
      setCenter(i);
      if (!haptics) return;
      const now = Date.now();
      if (now - lastTick.current < 28) return; // A fast fling should purr, not buzz.
      lastTick.current = now;
      Haptics.selectionAsync();
    },
    [haptics],
  );

  const onSettle = useCallback(
    (i: number) => {
      if (i === settled.current) return;
      settled.current = i;
      onChange?.(i, items[i]);
    },
    [onChange, items],
  );

  useAnimatedReaction(
    () => Math.max(0, Math.min(n - 1, Math.round(scroll.value / itemHeight))),
    (i, prev) => {
      if (prev !== null && i !== prev) scheduleOnRN(onCross, i);
    },
    [n, itemHeight, onCross],
  );

  // Controlled: glide to the new selection unless the finger is on the wheel.
  useEffect(() => {
    if (selectedIndex == null || dragging.value) return;
    const i = clampIndex(selectedIndex);
    settled.current = i;
    if (Math.abs(scroll.value - i * itemHeight) < 0.5) return;
    scroll.value = withTiming(i * itemHeight, { duration: 520, easing: CALM });
  }, [selectedIndex, clampIndex, itemHeight, scroll, dragging]);

  // Items or row height changed under us: stay on a valid row.
  useEffect(() => {
    const i = clampIndex(Math.round(scroll.value / itemHeight));
    scroll.value = i * itemHeight;
  }, [n, itemHeight, clampIndex, scroll]);

  const glideTo = (target: number, velocity: number) => {
    'worklet';
    const dist = Math.abs(target - scroll.value);
    if (dist < 0.5) {
      scroll.value = target;
      scheduleOnRN(onSettle, Math.round(target / itemHeight));
      return;
    }
    // Duration such that the curve leaves at the finger speed, bounded to stay calm.
    const v = Math.abs(velocity);
    const byVelocity = v > 50 ? (3 * dist * 1000) / v : 0;
    const duration = Math.max(280, Math.min(1500, byVelocity || 260 + dist * 1.6));
    scroll.value = withTiming(target, { duration, easing: byVelocity ? GLIDE : CALM }, (done) => {
      if (done) scheduleOnRN(onSettle, Math.round(target / itemHeight));
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onBegin(() => {
      // A touch stops a gliding wheel where it is, like UIPickerView.
      cancelAnimation(scroll);
      raw.value = scroll.value;
      dragging.value = true;
    })
    .onChange((e) => {
      raw.value -= e.changeY;
      const r = raw.value;
      if (r >= 0 && r <= max) {
        scroll.value = r;
        return;
      }
      // Rubber band past the ends, like UIScrollView: the further you pull, the less it moves.
      const over = r < 0 ? -r : r - max;
      const resisted = (over * 0.55 * H) / (over * 0.55 + H);
      scroll.value = r < 0 ? -resisted : max + resisted;
    })
    .onEnd((e) => {
      const v = -e.velocityY;
      // Project the fling a third of a second ahead, then land on the nearest row.
      const projected = scroll.value + v * 0.32;
      const i = Math.max(0, Math.min(n - 1, Math.round(projected / itemHeight)));
      const out = scroll.value < 0 || scroll.value > max;
      glideTo(i * itemHeight, out ? 0 : v);
    })
    .onFinalize((_e, success) => {
      dragging.value = false;
      // A touch that never became a drag (or a cancelled one) still has to land on a row.
      if (!success) glideTo(Math.max(0, Math.min(n - 1, Math.round(scroll.value / itemHeight))) * itemHeight, 0);
    });

  // Tap a row above or below the band to bring it to the center.
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      const dy = e.y - H / 2;
      // Invert the cylinder mapping: y = R sin(theta), rows = theta / step.
      const ratio = Math.max(-1, Math.min(1, dy / radius));
      const rows = Math.round(Math.asin(ratio) / step);
      if (rows === 0) return;
      const i = Math.max(0, Math.min(n - 1, Math.round(scroll.value / itemHeight) + rows));
      glideTo(i * itemHeight, 0);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  // Only rows near the center are mounted, long lists stay light.
  const span = visibleCount + 4;
  const from = Math.max(0, center - span);
  const to = Math.min(n - 1, center + span);
  const rowText = useMemo<StyleProp<TextStyle>>(
    () => [{ fontSize: fontSize ?? Math.round(itemHeight * 0.6), color, fontVariant: ['tabular-nums'], letterSpacing: -0.2 }, textStyle],
    [fontSize, itemHeight, color, textStyle],
  );

  const rows = [];
  for (let i = from; i <= to; i++) {
    rows.push(<Row key={i} index={i} text={labelOf(items[i])} scroll={scroll} itemHeight={itemHeight} radius={radius} step={step} perspective={perspective} style={rowText} align={align} />);
  }

  const current = items[clampIndex(center)];
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[{ height: H, flexDirection: 'row', flexGrow: 1, flexBasis: 0 }, style]}
        accessible
        accessibilityRole="adjustable"
        accessibilityValue={{ text: current ? `${labelOf(current)}${label ? ` ${label}` : ''}` : '' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const i = clampIndex(Math.round(scroll.value / itemHeight) + (e.nativeEvent.actionName === 'increment' ? 1 : -1));
          scroll.value = withTiming(i * itemHeight, { duration: 320, easing: CALM }, (done) => {
            if (done) scheduleOnRN(onSettle, i);
          });
        }}
      >
        {grouped ? null : (
          <View pointerEvents="none" style={[s.band, { top: (H - itemHeight) / 2, height: itemHeight, borderRadius: Math.min(10, itemHeight / 3.5), backgroundColor: bandColor, left: 0, right: 0 }]} />
        )}
        <View style={s.stage} pointerEvents="none">
          <View style={[s.axis, { top: H / 2 }]}>{rows}</View>
        </View>
        {label ? (
          <View style={[s.unit, { height: H }]} pointerEvents="none">
            <Text style={[rowText, s.unitText, { fontSize: Math.round((fontSize ?? itemHeight * 0.6) * 0.78) }]}>{label}</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  band: { position: 'absolute' },
  stage: { flex: 1, overflow: 'hidden' },
  axis: { position: 'absolute', left: 0, right: 0, height: 0 },
  row: { position: 'absolute', left: 0, right: 0, justifyContent: 'center', paddingHorizontal: 12 },
  unit: { justifyContent: 'center', paddingRight: 14 },
  unitText: { fontWeight: '600' },
});
