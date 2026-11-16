/**
 * BeforeAfter, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the labels, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * <BeforeAfter
 *   renderBefore={({ width, height }) => <Image source={raw} style={{ width, height }} />}
 *   renderAfter={({ width, height }) => <Image source={edited} style={{ width, height }} />}
 * />
 */
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Easing, interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, Extrapolation } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const ARROWS = Skia.Path.MakeFromSVGString('M9.5 7.5L5 12l4.5 4.5M14.5 7.5L19 12l-4.5 4.5')!;
const KNOB = 40;

export type BeforeAfterSize = { width: number; height: number };

export type BeforeAfterProps = {
  /** Shown on the left of the divider. An element, or a render prop given the frame size. */
  before?: ReactNode;
  after?: ReactNode;
  renderBefore?: (size: BeforeAfterSize) => ReactNode;
  renderAfter?: (size: BeforeAfterSize) => ReactNode;
  /** Initial divider position, 0 (all after) to 1 (all before). Default 0.5. */
  initial?: number;
  /** Frame height in points. Default 320. */
  height?: number;
  beforeLabel?: string;
  afterLabel?: string;
  /** Hide the Before / After pills. */
  labels?: boolean;
  /** Called with the divider position (0..1) when a drag or a tap settles. */
  onChange?: (value: number) => void;
  haptics?: boolean;
  /** Frame classes (radius, placeholder background, margins...). */
  className?: string;
  /** Round handle classes. */
  handleClassName?: string;
  /** Divider line classes. */
  dividerClassName?: string;
  /** Before / After pill classes. */
  pillClassName?: string;
  /** Before / After label text classes. */
  pillTextClassName?: string;
};

/**
 * Compare two versions of an image. Drag the round handle (or anywhere on the frame), or tap to
 * send the divider there. The before layer is clipped to the left of the divider, the pills fade
 * as the divider reaches them, and a light tick marks the middle and both edges.
 */
export function BeforeAfter({
  before,
  after,
  renderBefore,
  renderAfter,
  initial = 0.5,
  height = 320,
  beforeLabel = 'Before',
  afterLabel = 'After',
  labels = true,
  onChange,
  haptics = true,
  className,
  handleClassName,
  dividerClassName,
  pillClassName,
  pillTextClassName,
}: BeforeAfterProps) {
  const arrows = useToken('foreground');
  const [W, setW] = useState(0);
  const [pillB, setPillB] = useState(64);
  const [pillA, setPillA] = useState(56);
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const grab = useSharedValue(0);
  const armed = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Keep the ratio when the frame resizes (rotation, split view).
    const ratio = width.value ? x.value / width.value : Math.min(1, Math.max(0, initial));
    width.value = w;
    x.value = ratio * w;
    setW(w);
  };

  useEffect(() => {
    if (W) armed.value = 1;
  }, [W, armed]);

  const tick = (heavy: boolean) => {
    if (!haptics) return;
    if (heavy) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.selectionAsync();
  };
  const settle = (v: number) => onChange?.(v);

  // Haptics live on the position itself, so drags and tap animations both tick.
  useAnimatedReaction(
    () => x.value,
    (now, prev) => {
      if (!armed.value || prev == null || !width.value) return;
      const mid = width.value / 2;
      if ((prev - mid) * (now - mid) < 0 || (now === mid && prev !== mid)) scheduleOnRN(tick, false);
      const edge = (v: number) => v <= 0.5 || v >= width.value - 0.5;
      if (edge(now) && !edge(prev)) scheduleOnRN(tick, true);
    },
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      grab.value = withTiming(1, { duration: 180, easing: CALM });
    })
    .onChange((e) => {
      const next = x.value + e.changeX;
      x.value = next < 0 ? 0 : next > width.value ? width.value : next;
    })
    .onFinalize(() => {
      grab.value = withTiming(0, { duration: 320, easing: CALM });
      if (width.value) scheduleOnRN(settle, x.value / width.value);
    });

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onEnd((e) => {
      const to = Math.min(width.value, Math.max(0, e.x));
      x.value = withTiming(to, { duration: 560, easing: CALM }, (done) => {
        if (done && width.value) scheduleOnRN(settle, to / width.value);
      });
    });

  const gesture = Gesture.Race(pan, tap);

  // Clip without relayout: the window slides right by x, its content slides back left by x.
  const clip = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - width.value }] }));
  const unclip = useAnimatedStyle(() => ({ transform: [{ translateX: width.value - x.value }] }));
  const divider = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 1 }] }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - KNOB / 2 }, { scale: 1 + grab.value * 0.08 }] }));
  // Pills sit in the top corners and fade as the divider closes in on them.
  const beforePill = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [14 + pillB, 14 + pillB + 44], [0, 1], Extrapolation.CLAMP) }));
  const afterPill = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [width.value - 14 - pillA - 44, width.value - 14 - pillA], [1, 0], Extrapolation.CLAMP) }));

  const size = { width: W, height };
  const beforeNode = renderBefore ? renderBefore(size) : before;
  const afterNode = renderAfter ? renderAfter(size) : after;

  const pill = cn('absolute top-[14px] rounded-full bg-[rgba(0,0,0,0.38)] px-[10px] py-[5px]', pillClassName);
  const pillText = cn('text-[12px] font-semibold tracking-[0.1px] text-white', pillTextClassName);

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={onLayout}
        className={cn('overflow-hidden rounded-[20px] bg-dissolve-surface-2', className)}
        style={{ height }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${beforeLabel} and ${afterLabel} comparison`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (!W) return;
          const step = W * 0.1 * (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          x.value = withTiming(Math.min(W, Math.max(0, x.value + step)), { duration: 360, easing: CALM });
        }}
      >
        {W ? (
          <>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {afterNode}
            </View>
            <Animated.View className="absolute bottom-0 left-0 top-0 overflow-hidden" style={[{ width: W }, clip]} pointerEvents="none">
              <Animated.View style={[{ width: W, height }, unclip]}>{beforeNode}</Animated.View>
            </Animated.View>

            {labels ? (
              <>
                <Animated.View className={pill} style={[{ left: 14 }, beforePill]} onLayout={(e: LayoutChangeEvent) => setPillB(e.nativeEvent.layout.width)} pointerEvents="none">
                  <Text className={pillText}>{beforeLabel}</Text>
                </Animated.View>
                <Animated.View className={pill} style={[{ right: 14 }, afterPill]} onLayout={(e: LayoutChangeEvent) => setPillA(e.nativeEvent.layout.width)} pointerEvents="none">
                  <Text className={pillText}>{afterLabel}</Text>
                </Animated.View>
              </>
            ) : null}

            <Animated.View
              className={cn('absolute bottom-0 left-0 top-0 w-[2px] bg-dissolve-background shadow-[0_0_8px_rgba(0,0,0,0.25)]', dividerClassName)}
              style={divider}
              pointerEvents="none"
            />
            <Animated.View
              className={cn('absolute left-0 items-center justify-center rounded-full bg-dissolve-background shadow-[0_3px_20px_rgba(0,0,0,0.22)]', handleClassName)}
              style={[{ top: height / 2 - KNOB / 2, width: KNOB, height: KNOB }, knob]}
              pointerEvents="none"
            >
              <Canvas style={{ width: 22, height: 22 }}>
                <Path path={ARROWS} color={arrows} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" transform={[{ scale: 22 / 24 }]} />
              </Canvas>
            </Animated.View>
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}
