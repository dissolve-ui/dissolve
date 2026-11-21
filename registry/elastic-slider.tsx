/**
 * ElasticSlider, from dissolve (dissolve-ui). This file is yours: change the springs, the stretch,
 * the sizes, anything. Colors come from the dissolve theme tokens (global.css), so it follows light
 * and dark mode out of the box.
 *
 * A thick, rounded slider in the spirit of the iOS Control Center: the fill grows from the left,
 * a label sits on the left and the value on the right, both inverting their color where the fill
 * passes under them. Drag anywhere to move it by the finger's distance, or tap to jump. Pull past
 * either end and the whole track stretches like a rubber band toward the finger, thinning a little,
 * then snaps back with a bounce on release. The value rolls digit by digit. A tick when it reaches
 * the minimum or the maximum, and on every step when there are few of them.
 *
 * Built for scroll views: everything moves by transform only, so it keeps animating while a scroll
 * view is being dragged on iOS.
 *
 * <ElasticSlider label="Volume" value={volume} onValueChange={setVolume} formatValue={(v) => `${v}%`} />
 *
 * <ElasticSlider label="Brightness" icon={({ color, size }) => <SunIcon color={color} size={size} />} defaultValue={70} />
 *
 * <ElasticSlider min={0} max={10} step={1} defaultValue={4} size="sm" showValue={false} />
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';
import { toRGBA } from './dots';

const SIZES = {
  sm: { height: 32, font: 13, pad: 14 },
  md: { height: 44, font: 15, pad: 16 },
  lg: { height: 56, font: 17, pad: 20 },
} as const;

export type ElasticSliderSize = keyof typeof SIZES;

export type ElasticSliderProps = {
  /** Current value (controlled). */
  value?: number;
  /** Initial value when uncontrolled. Default: min. */
  defaultValue?: number;
  /** Called with the stepped value while sliding, every time it changes. */
  onValueChange?: (value: number) => void;
  /** Called with the final value when the finger lifts. */
  onSlidingComplete?: (value: number) => void;
  /** Range and step. Default 0 to 100 by 1. */
  min?: number;
  max?: number;
  step?: number;
  /** Text on the left of the track. */
  label?: string;
  /** Icon before the label: a node, or a function of { color, size } (color follows the fill's inversion). */
  icon?: ReactNode | ((p: { color: string; size: number }) => ReactNode);
  /** Shows the value on the right of the track. Default true. */
  showValue?: boolean;
  /** Turns the value into the shown text. Default: the number. */
  formatValue?: (value: number) => string;
  /** Track height and type size: 32, 44 or 56 pt. Default 'md'. */
  size?: ElasticSliderSize;
  /** Ticks at the ends, and on every step when there are 20 steps or fewer. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Fill color. Default: the foreground token. */
  fillColor?: string;
  /** Empty track color. Default: the foreground token at a low alpha. */
  trackColor?: string;
  /** Outer classes (width, margins...). It stretches to its parent by default. */
  className?: string;
};

/** How far the track can stretch past an end, in points, and how fast it gets there. */
const REACH = 46;
/** Thinning at full stretch, as a share of the height. */
const THIN = 0.16;
/** The springs: the snap back bounces, the press is calm. */
const BOUNCE = { damping: 9, stiffness: 240, mass: 0.7 };
const SETTLE = { damping: 22, stiffness: 260 };
/** Press: the track grows this much in height. */
const PRESS = 0.08;
/** A finger that moves less than this is a tap. */
const TAP = 6;

/** Rubber band: grows like the pull at first, never past REACH. */
function rubber(x: number) {
  'worklet';
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  return s * REACH * (1 - 1 / (a / REACH + 1));
}

export function ElasticSlider({
  value,
  defaultValue,
  onValueChange,
  onSlidingComplete,
  min = 0,
  max = 100,
  step = 1,
  label,
  icon,
  showValue = true,
  formatValue,
  size = 'md',
  haptics = true,
  disabled = false,
  fillColor,
  trackColor,
  className,
}: ElasticSliderProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size] ?? SIZES.md;
  const span = Math.max(1e-9, max - min);
  const snap = (v: number) => Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  const [inner, setInner] = useState(() => snap(defaultValue ?? min));
  const controlled = value !== undefined;
  const shown = snap(controlled ? value : inner);

  const fg = useToken('foreground');
  const bg = useToken('background');
  const colors = useMemo(() => {
    const [fr, fgG, fb] = toRGBA(fg);
    const [br, bgG, bb] = toRGBA(bg);
    const dark = 0.2126 * br + 0.7152 * bgG + 0.0722 * bb < 0.5;
    return {
      fill: fillColor ?? fg,
      onFill: bg,
      track: trackColor ?? `rgba(${Math.round(fr * 255)}, ${Math.round(fgG * 255)}, ${Math.round(fb * 255)}, ${dark ? 0.14 : 0.08})`,
    };
  }, [fg, bg, fillColor, trackColor]);

  const [width, setWidth] = useState(0);
  const W = useSharedValue(0);
  /** Fill, 0..1: follows the finger smoothly, settles on the step after. */
  const p = useSharedValue((shown - min) / span);
  /** Stretch past an end, in points (negative: past the left end). */
  const over = useSharedValue(0);
  const pressed = useSharedValue(0);
  const start = useSharedValue(0);
  const last = useSharedValue(shown);
  const dragging = useSharedValue(0);

  useEffect(() => {
    W.value = width;
  }, [width, W]);

  // A new value from the parent, while the finger is off: glide there.
  useEffect(() => {
    if (dragging.value) return;
    last.value = shown;
    const to = (shown - min) / span;
    p.value = reduced ? to : withSpring(to, SETTLE);
  }, [shown, min, span, reduced, p, last, dragging]);

  const steps = span / step;
  const emit = (v: number, end: boolean) => {
    if (!end) {
      if (haptics && (v === min || v === max || steps <= 20)) Haptics.selectionAsync();
      if (!controlled) setInner(v);
      onValueChange?.(v);
    } else onSlidingComplete?.(v);
  };

  const valueAt = (q: number) => {
    'worklet';
    const raw = min + q * span;
    return Math.min(max, Math.max(min, min + Math.round((raw - min) / step) * step));
  };
  const move = (q: number) => {
    'worklet';
    const v = valueAt(q);
    if (v !== last.value) {
      last.value = v;
      scheduleOnRN(emit, v, false);
    }
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      start.value = p.value;
      dragging.value = 1;
      pressed.value = reduced ? 1 : withSpring(1, SETTLE);
    })
    .onUpdate((e) => {
      const w = W.value;
      if (w <= 0) return;
      const raw = start.value + e.translationX / w;
      const q = Math.min(1, Math.max(0, raw));
      p.value = q;
      over.value = reduced ? 0 : rubber((raw - q) * w);
      move(q);
    })
    .onFinalize((e) => {
      const w = W.value;
      // A tap: jump to the finger.
      if (w > 0 && Math.abs(e.translationX) < TAP && Math.abs(e.translationY) < TAP) move(Math.min(1, Math.max(0, e.x / w)));
      dragging.value = 0;
      const to = (last.value - min) / span;
      p.value = reduced ? to : withSpring(to, SETTLE);
      over.value = reduced ? 0 : withSpring(0, BOUNCE);
      pressed.value = reduced ? 0 : withSpring(0, SETTLE);
      scheduleOnRN(emit, last.value, true);
    });

  // The track stretches toward the pull, anchored at the other end, and thins as it does.
  const trackStyle = useAnimatedStyle(() => {
    const w = Math.max(1, W.value);
    const o = over.value;
    const k = Math.abs(o) / REACH;
    return {
      transform: [
        { translateX: o / 2 },
        { scaleX: 1 + Math.abs(o) / w + 0.012 * pressed.value },
        { scaleY: (1 - THIN * k) * (1 + PRESS * pressed.value) },
      ],
    };
  });
  // The fill is a full width layer slid in from the left.
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -(1 - p.value) * W.value }] }));
  // The texts in the fill's ink are clipped to where the fill ends on screen: at full, the stretched
  // right end; empty, the stretched left end (so nothing shows). The clip slides, its content slides
  // back so it stays put.
  const clipShift = () => {
    'worklet';
    const o = over.value;
    return p.value * W.value + (p.value > 0.5 ? Math.max(0, o) : Math.min(0, o)) - W.value - REACH;
  };
  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateX: clipShift() }] }));
  const clipInner = useAnimatedStyle(() => ({ transform: [{ translateX: -clipShift() }] }));
  // The texts ride with the end that stretches, without being stretched.
  const leftText = useAnimatedStyle(() => ({ transform: [{ translateX: Math.min(0, over.value) }] }));
  const rightText = useAnimatedStyle(() => ({ transform: [{ translateX: Math.max(0, over.value) }] }));

  const text = formatValue ? formatValue(shown) : String(shown);
  const radius = s.height * 0.42;
  const content = (color: string) => (
    <RNView style={[StyleSheet.absoluteFill, st.row, { paddingHorizontal: s.pad }]}>
      <Animated.View style={[st.left, { gap: Math.round(s.font * 0.55) }, leftText]}>
        {typeof icon === 'function' ? icon({ color, size: Math.round(s.font * 1.2) }) : icon}
        {label ? (
          <Text numberOfLines={1} style={{ color, fontSize: s.font, fontWeight: '600', letterSpacing: -0.2 }}>
            {label}
          </Text>
        ) : null}
      </Animated.View>
      <Animated.View style={rightText}>{showValue ? <Rolling text={text} color={color} font={s.font} /> : null}</Animated.View>
    </RNView>
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        className={cn('self-stretch', className)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: shown, text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const v = snap(shown + (e.nativeEvent.actionName === 'increment' ? step : -step));
          if (v === shown) return;
          last.value = v;
          emit(v, false);
          emit(v, true);
        }}
        style={{ height: s.height, opacity: disabled ? 0.5 : 1 }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.track }, trackStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.fill }, fillStyle]} />
        </Animated.View>
        {width > 0 ? (
          <>
            {content(fg)}
            {/* The same texts in the fill's ink, clipped to the fill. */}
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: -REACH, width: width + REACH * 2, overflow: 'hidden' }, clipStyle]}>
              <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: REACH, width }, clipInner]}>{content(colors.onFill)}</Animated.View>
            </Animated.View>
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/** The value, its digits rolling to their new place; other characters swap in place. */
function Rolling({ text, color, font }: { text: string; color: string; font: number }) {
  const line = Math.round(font * 1.25);
  const chars = text.split('');
  return (
    <RNView style={{ flexDirection: 'row', height: line, overflow: 'hidden' }}>
      {chars.map((c, i) =>
        /\d/.test(c) ? (
          <Digit key={chars.length - i} d={Number(c)} color={color} font={font} line={line} />
        ) : (
          <Text key={`c${chars.length - i}`} style={{ color, fontSize: font, lineHeight: line, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {c}
          </Text>
        ),
      )}
    </RNView>
  );
}

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));

/** One digit: a column of 0 to 9 sliding to the digit. */
function Digit({ d, color, font, line }: { d: number; color: string; font: number; line: number }) {
  const y = useSharedValue(-d * line);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    y.value = withTiming(-d * line, { duration: 260 });
  }, [d, line, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <RNView style={{ height: line, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {DIGITS.map((t) => (
          <Text key={t} style={{ color, fontSize: font, lineHeight: line, height: line, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {t}
          </Text>
        ))}
      </Animated.View>
    </RNView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
});
