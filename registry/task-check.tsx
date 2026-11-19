/**
 * TaskCheck, from dissolve (dissolve-ui). This file is yours: restyle it with
 * classNames, change the timings, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * A to-do row. Tap it: the box fills with a crisp press, the check draws itself, then a line
 * strikes the label left to right across every wrapped line and the text greys out. After a
 * short pause the task settles: it stays, it tells you to move it to a Done section, or it
 * blows away as dust and the list closes up. Tap again before the pause to undo.
 * The dissolve mode needs the DissolveProvider at the root.
 *
 * <TaskCheck label="Oat milk" checked={item.done} onCheckedChange={(v) => toggle(item.id, v)} after="move" onSettled={() => moveToDone(item.id)} />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useDissolve } from 'dissolve-ui';
import { Animated, Pressable, View, cn, useToken } from './tw';
import { CALM } from './motion';

const CHECK = Skia.Path.MakeFromSVGString('M6 12.5l4 4L18 8')!;

export type TaskCheckProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /**
   * What happens settleDelay ms after the task is checked. 'stay' does nothing, 'move' calls
   * onSettled so you move the task (to a Done section), 'dissolve' turns it to dust, closes the
   * gap, then calls onSettled so you can drop it. Default 'stay'.
   */
  after?: 'stay' | 'move' | 'dissolve';
  /** Pause before the task settles, in ms. Default 900. */
  settleDelay?: number;
  onSettled?: () => void;
  /** Checkbox side in points. Default 24. */
  boxSize?: number;
  disabled?: boolean;
  haptics?: boolean;
  /** Outer wrapper classes (margins, separators). This is the part that closes up. */
  className?: string;
  /** Row classes (padding, gap). */
  rowClassName?: string;
  /** Label classes (size, weight). The label color is animated from the tokens. */
  labelClassName?: string;
};

type Line = { x: number; y: number; w: number };

export function TaskCheck({
  label,
  checked,
  onCheckedChange,
  after = 'stay',
  settleDelay = 900,
  onSettled,
  boxSize = 24,
  disabled,
  haptics = true,
  className,
  rowClassName,
  labelClassName,
}: TaskCheckProps) {
  const reduced = useReducedMotion();
  const fg = useToken('foreground');
  const muted = useToken('muted');
  const onPrimary = useToken('primary-foreground');

  const on = useSharedValue(checked ? 1 : 0);
  const draw = useSharedValue(checked ? 1 : 0);
  const strike = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);
  const h = useSharedValue(-1);
  const measured = useRef(0);
  const { ref, dissolving, dissolve } = useDissolve();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  const busy = useRef(false);
  const [lines, setLines] = useState<Line[]>([]);

  // Latest props for the delayed settle.
  const latest = useRef({ after, onSettled });
  latest.current = { after, onSettled };

  const settled = () => latest.current.onSettled?.();

  const settle = async () => {
    timer.current = null;
    const mode = latest.current.after;
    if (mode === 'move') return settled();
    if (mode !== 'dissolve' || busy.current) return;
    busy.current = true;
    await dissolve({ preset: 'dust', origin: 'left', duration: 1100, grain: 2, haptics: false });
    h.value = measured.current;
    h.value = withTiming(0, { duration: reduced ? 150 : 280, easing: CALM }, (done) => {
      if (done) scheduleOnRN(settled);
    });
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (checked) {
      if (reduced) {
        const fade = { duration: 150 };
        on.value = withTiming(1, fade);
        draw.value = withTiming(1, fade);
        strike.value = withTiming(1, fade);
      } else {
        on.value = withTiming(1, { duration: 180, easing: CALM });
        // Small element: a quick press, then a light spring back.
        scale.value = withSequence(withTiming(0.85, { duration: 90, easing: CALM }), withSpring(1, { damping: 13, stiffness: 340, mass: 0.8 }));
        draw.value = withTiming(1, { duration: 220, easing: CALM });
        strike.value = withDelay(60, withTiming(1, { duration: 260, easing: CALM }));
      }
      if (after !== 'stay') timer.current = setTimeout(settle, settleDelay);
    } else {
      const back = { duration: reduced ? 150 : 160, easing: CALM };
      on.value = withTiming(0, back);
      draw.value = withTiming(0, back);
      strike.value = withTiming(0, back);
      scale.value = withTiming(1, back);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const press = () => {
    if (busy.current || disabled) return;
    if (haptics) {
      if (!checked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.selectionAsync();
    }
    onCheckedChange(!checked);
  };

  // One segment per rendered line, at the middle of the lowercase letters.
  const onTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setLines(e.nativeEvent.lines.filter((l) => l.width > 0.5).map((l) => ({ x: l.x, w: l.width, y: l.xHeight ? l.y + l.ascender - l.xHeight / 2 : l.y + l.height * 0.55 })));
  };
  const strikePath = useMemo(() => {
    const p = Skia.Path.Make();
    for (const l of lines) {
      p.moveTo(l.x, l.y);
      p.lineTo(l.x + l.w, l.y);
    }
    return p;
  }, [lines]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (h.value < 0) measured.current = e.nativeEvent.layout.height;
  };

  const wrapStyle = useAnimatedStyle(() => (h.value < 0 ? {} : { height: h.value, overflow: 'hidden' }));
  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const textStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [fg, muted]) }));
  // Hide zero length trims: a round cap would otherwise leave a dot.
  const drawO = useDerivedValue(() => (draw.value > 0.01 ? 1 : 0));
  const strikeO = useDerivedValue(() => (strike.value > 0.01 ? 1 : 0));
  const icon = boxSize * 0.75;

  return (
    <Animated.View className={className} style={wrapStyle}>
      <Pressable onPress={press} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} accessibilityLabel={label}>
        {/* Plain RN view: it holds the capture ref. */}
        <RNView ref={ref} collapsable={false} onLayout={onLayout} style={{ opacity: dissolving ? 0 : 1 }}>
          <View className={cn('flex-row items-center gap-[12px] py-[12px]', rowClassName)}>
            <Animated.View
              className="items-center justify-center overflow-hidden border-[1.5px] border-dissolve-muted"
              style={[{ width: boxSize, height: boxSize, borderRadius: boxSize * 0.3, borderCurve: 'continuous' }, boxStyle]}
            >
              <Animated.View className="absolute inset-0 bg-dissolve-primary" style={fillStyle} />
              <Canvas style={{ width: icon, height: icon }}>
                <Path
                  path={CHECK}
                  color={onPrimary}
                  style="stroke"
                  strokeWidth={3}
                  strokeCap="round"
                  strokeJoin="round"
                  start={0}
                  end={draw}
                  opacity={drawO}
                  transform={[{ scale: icon / 24 }]}
                />
              </Canvas>
            </Animated.View>
            <View className="flex-1">
              <Animated.Text onTextLayout={onTextLayout} className={cn('text-[16px] tracking-[-0.2px]', labelClassName)} style={textStyle}>
                {label}
              </Animated.Text>
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                <Path path={strikePath} color={muted} style="stroke" strokeWidth={1.5} strokeCap="round" start={0} end={strike} opacity={strikeO} />
              </Canvas>
            </View>
          </View>
        </RNView>
      </Pressable>
    </Animated.View>
  );
}
