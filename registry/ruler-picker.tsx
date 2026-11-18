/**
 * RulerPicker, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the graduations, anything. Colors come from the dissolve theme
 * tokens (global.css), so it follows light and dark mode out of the box.
 *
 * A horizontal ruler you drag under a center needle: 1:1 pan, momentum, then a calm snap on the
 * nearest step. Graduations near the needle stretch with speed (the wake), a haptic tick lands on
 * every step, a firmer one on every major graduation and at the bounds.
 *
 * Needs ./number-ticker (dissolve registry) for the rolling value above the ruler.
 *
 * <RulerPicker value={kg} onChange={setKg} min={30} max={200} step={0.1} unit="kg" />
 * <RulerPicker value={cm} onChange={setCm} min={120} max={220} unit="cm" majorEvery={10} />
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Picture, RoundedRect, Skia, createPicture, matchFont } from '@shopify/react-native-skia';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { NumberTicker } from './number-ticker';
import { Text, View, cn, useToken } from './tw';
import { CALM } from './motion';

/** How far past a bound the ruler follows the finger. */
const RUBBER = 0.3;
/** Minimum gap between two haptic ticks, ms. */
const TICK_GAP = 25;
/** Graduation heights at rest: minor, half, major. */
const MINOR = 12;
const HALF = 18;
const MAJOR = 26;
/** Extra length given to the graduations under the needle at full speed. */
const WAKE = 4;
/** Gaussian spread of the wake, so it fades out around 60 pt from the needle. */
const WAKE_SIGMA = 24;
const TOP = 10;

export type RulerPickerProps = {
  value: number;
  /** Called once the ruler is at rest on a new value. */
  onChange?: (value: number) => void;
  /** Called on every step crossed while dragging or gliding. */
  onChanging?: (value: number) => void;
  min: number;
  max: number;
  /** Value between two graduations. Default 1. */
  step?: number;
  /** A labelled major graduation every N steps. Default 10. */
  majorEvery?: number;
  /** Unit shown next to the value, e.g. 'kg'. */
  unit?: string;
  /** Formats the graduation labels and the accessibility value. Default: the number with the step decimals. */
  format?: (value: number) => string;
  /** Distance between two graduations in points. Default 10. */
  tickSpacing?: number;
  /** Ruler height in points. Default 76. */
  height?: number;
  /** Shows the rolling value above the ruler. Default true. */
  showValue?: boolean;
  /** Value font size. Default 56. */
  fontSize?: number;
  haptics?: boolean;
  /** Root classes (margins, width...). */
  className?: string;
  /** Value classes (color, weight...), passed to NumberTicker. */
  valueClassName?: string;
};

function decimalsOf(step: number) {
  const s = String(step);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** The rolling value. Lives in its own component so a step never re-renders the ruler. */
function Readout({
  bind,
  initial,
  toValue,
  decimals,
  unit,
  fontSize,
  className,
}: {
  bind: { current: ((i: number) => void) | null };
  initial: number;
  toValue: (i: number) => number;
  decimals: number;
  unit?: string;
  fontSize: number;
  className?: string;
}) {
  const [index, setIndex] = useState(initial);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Coalesce fast flings to about 16 updates a second, the last value always lands.
    bind.current = (i: number) => {
      pending.current = i;
      if (timer.current) return;
      setIndex(i);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current != null) setIndex(pending.current);
      }, 60);
    };
    return () => {
      bind.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [bind]);

  return (
    <View className="flex-row items-end justify-center gap-[6px]">
      <NumberTicker value={toValue(index)} decimals={decimals} fontSize={fontSize} duration={420} stagger={18} textClassName={cn('font-bold tracking-[-1px]', className)} />
      {unit ? (
        <Text className="font-semibold text-dissolve-muted" style={{ fontSize: Math.round(fontSize * 0.36), marginBottom: Math.round(fontSize * 0.2) }}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export function RulerPicker({
  value,
  onChange,
  onChanging,
  min,
  max,
  step = 1,
  majorEvery = 10,
  unit,
  format,
  tickSpacing = 10,
  height = 76,
  showValue = true,
  fontSize = 56,
  haptics = true,
  className,
  valueClassName,
}: RulerPickerProps) {
  const ink = useToken('foreground');
  const muted = useToken('muted');
  const needle = useToken('primary');
  const reduced = useReducedMotion();

  const decimals = useMemo(() => decimalsOf(step), [step]);
  const count = Math.max(1, Math.round((max - min) / step));
  const maxOff = count * tickSpacing;
  const sp = tickSpacing;
  const toValue = useCallback((i: number) => Number((min + i * step).toFixed(decimals)), [min, step, decimals]);
  const toIndex = useCallback((v: number) => Math.min(count, Math.max(0, Math.round((v - min) / step))), [min, step, count]);
  const label = useCallback((v: number) => (format ? format(v) : v.toFixed(decimals)), [format, decimals]);

  const [W, setW] = useState(0);
  const initial = useRef(toIndex(value)).current;
  const offset = useSharedValue(initial * sp);
  const raw = useSharedValue(0);
  const live = useSharedValue(0);
  const wake = useSharedValue(0);
  const last = useSharedValue(initial * sp);

  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }), fontSize: 12, fontWeight: '500' }), []);
  // Major labels and their widths, computed once on the JS thread and read by the drawing worklet.
  const labels = useMemo(() => {
    const text: string[] = [];
    const width: number[] = [];
    for (let i = 0; i <= count; i += majorEvery) {
      const t = label(toValue(i));
      text.push(t);
      width.push(font.measureText(t).width);
    }
    return { text, width };
  }, [count, majorEvery, label, toValue, font]);

  const inkC = useMemo(() => Skia.Color(ink), [ink]);
  const mutedC = useMemo(() => Skia.Color(muted), [muted]);
  const pr = PixelRatio.get();

  // Speed of the ruler, whatever moves it (finger, momentum, snap), drives the wake.
  useFrameCallback((f) => {
    const dt = Math.max(1, f.timeSincePreviousFrame ?? 16);
    const o = offset.value;
    const speed = (Math.abs(o - last.value) / dt) * 1000;
    last.value = o;
    const target = reduced ? 0 : Math.min(speed / 1500, 1);
    const next = target > wake.value ? target : Math.max(target, wake.value - dt / 300);
    if (next !== wake.value) wake.value = next;
  });

  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    return p;
  }, []);
  const picture = useDerivedValue(() => {
    const o = offset.value;
    const w = wake.value;
    return createPicture(
      (c) => {
        if (!W) return;
        const cx = W / 2;
        const first = Math.max(0, Math.floor((o - cx) / sp) - 1);
        const lastI = Math.min(count, Math.ceil((o + cx) / sp) + 1);
        const halfEvery = majorEvery % 2 === 0 ? majorEvery / 2 : 0;
        for (let i = first; i <= lastI; i++) {
          const x = cx + i * sp - o;
          const d = x - cx;
          const edge = Math.min(1, Math.abs(d) / cx);
          const fade = 1 - edge * edge * edge;
          if (fade <= 0.01) continue;
          const major = i % majorEvery === 0;
          const half = !major && halfEvery > 0 && i % halfEvery === 0;
          const base = major ? MAJOR : half ? HALF : MINOR;
          const len = base + WAKE * w * Math.exp(-(d * d) / (2 * WAKE_SIGMA * WAKE_SIGMA));
          const tw = major ? 2 : 1.5;
          // Pixel aligned, so graduations stay sharp while they move.
          const px = Math.round((x - tw / 2) * pr) / pr;
          paint.setColor(major ? inkC : mutedC);
          paint.setAlphaf(fade * (major ? 1 : 0.8));
          c.drawRRect(Skia.RRectXY(Skia.XYWHRect(px, TOP, tw, len), tw / 2, tw / 2), paint);
          if (major) {
            const k = i / majorEvery;
            const lw = labels.width[k] ?? 0;
            paint.setColor(mutedC);
            paint.setAlphaf(fade);
            c.drawText(labels.text[k] ?? '', Math.round((x - lw / 2) * pr) / pr, TOP + MAJOR + WAKE + 18, paint, font);
          }
        }
      },
      { width: W, height },
    );
  });

  // Bridges to the JS thread.
  const readout = useRef<((i: number) => void) | null>(null);
  const lastTick = useRef(0);
  const emitted = useRef(value);
  const shown = useRef(initial);

  const buzz = useCallback(
    (kind: 'step' | 'major' | 'bound') => {
      if (!haptics) return;
      const now = Date.now();
      if (kind !== 'bound' && now - lastTick.current < TICK_GAP) return;
      lastTick.current = now;
      if (kind === 'bound') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      else if (kind === 'major') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.selectionAsync();
    },
    [haptics],
  );

  const onStep = (i: number, active: boolean) => {
    shown.current = i;
    readout.current?.(i);
    if (!active) return;
    onChanging?.(toValue(i));
    buzz(i % majorEvery === 0 ? 'major' : 'step');
  };
  const onBound = () => buzz('bound');
  const commit = (i: number) => {
    shown.current = i;
    readout.current?.(i);
    const v = toValue(i);
    if (v !== emitted.current) {
      emitted.current = v;
      onChange?.(v);
    }
  };

  useAnimatedReaction(
    () => {
      const i = Math.round(offset.value / sp);
      return i < 0 ? 0 : i > count ? count : i;
    },
    (i, prev) => {
      if (prev == null || i === prev) return;
      scheduleOnRN(onStep, i, live.value === 1);
    },
  );
  useAnimatedReaction(
    () => (offset.value <= 0.01 ? -1 : offset.value >= maxOff - 0.01 ? 1 : 0),
    (edge, prev) => {
      if (prev == null || edge === prev || edge === 0 || live.value !== 1) return;
      scheduleOnRN(onBound);
    },
  );

  // Controlled value: an outside change glides the ruler to it.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const i = toIndex(value);
    shown.current = i;
    live.value = 0;
    offset.value = withTiming(i * sp, { duration: reduced ? 150 : 420, easing: CALM });
  }, [value, toIndex, sp, reduced, offset, live]);

  const rubber = (x: number) => {
    'worklet';
    if (x < 0) return x * RUBBER;
    if (x > maxOff) return maxOff + (x - maxOff) * RUBBER;
    return x;
  };
  const settle = () => {
    'worklet';
    const o = offset.value;
    let i = Math.round(o / sp);
    i = i < 0 ? 0 : i > count ? count : i;
    const target = i * sp;
    if (Math.abs(target - o) < 0.01) {
      offset.value = target;
      live.value = 0;
      scheduleOnRN(commit, i);
      return;
    }
    offset.value = withTiming(target, { duration: reduced ? 150 : 300, easing: CALM }, (done) => {
      if (!done) return;
      live.value = 0;
      scheduleOnRN(commit, i);
    });
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      cancelAnimation(offset);
      live.value = 1;
    })
    .onStart(() => {
      const o = offset.value;
      raw.value = o < 0 ? o / RUBBER : o > maxOff ? maxOff + (o - maxOff) / RUBBER : o;
    })
    .onChange((e) => {
      raw.value -= e.changeX;
      offset.value = rubber(raw.value);
    })
    .onEnd((e) => {
      const o = offset.value;
      if (o < 0 || o > maxOff) {
        // Released past a bound: glide back, the bound is a step so no extra snap.
        const to = o < 0 ? 0 : maxOff;
        offset.value = withTiming(to, { duration: reduced ? 150 : 420, easing: CALM }, (done) => {
          if (!done) return;
          live.value = 0;
          scheduleOnRN(commit, o < 0 ? 0 : count);
        });
        return;
      }
      if (reduced) return settle();
      offset.value = withDecay({ velocity: -e.velocityX, deceleration: 0.997, clamp: [0, maxOff] }, (done) => {
        if (done) settle();
      });
    })
    .onFinalize((_, success) => {
      // A touch that stopped the glide without dragging still has to land on a step.
      if (!success) settle();
    });

  const moveBy = (delta: number) => {
    const i = Math.min(count, Math.max(0, shown.current + delta));
    if (i === shown.current) return;
    live.value = 0;
    offset.value = withTiming(i * sp, { duration: reduced ? 150 : 260, easing: CALM });
    commit(i);
  };
  const onA11y = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') moveBy(1);
    if (e.nativeEvent.actionName === 'decrement') moveBy(-1);
  };

  return (
    <View className={cn('w-full', className)}>
      {showValue ? (
        <Readout bind={readout} initial={initial} toValue={toValue} decimals={decimals} unit={unit} fontSize={fontSize} className={valueClassName} />
      ) : null}
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
          style={{ height, marginTop: showValue ? 12 : 0 }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={unit ? `Value in ${unit}` : 'Value'}
          accessibilityValue={{ text: `${label(toValue(shown.current))}${unit ? ` ${unit}` : ''}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onA11y}
        >
          {W ? (
            <Canvas style={{ width: W, height }} pointerEvents="none">
              <Picture picture={picture} />
              <RoundedRect x={Math.round((W / 2 - 2) * pr) / pr} y={0} width={4} height={TOP + MAJOR + WAKE + 4} r={2} color={needle} />
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}
