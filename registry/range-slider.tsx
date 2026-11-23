/**
 * RangeSlider, from dissolve (dissolve-ui). This file is yours: change the springs, the sizes,
 * the bubbles, anything. Colors come from the dissolve theme tokens (global.css), so it follows
 * light and dark mode out of the box.
 *
 * A dual handle range slider. Drag either handle (or tap the track: the nearest handle jumps
 * there); the handles never cross, the track fills between them, and while you drag both values
 * roll in bubbles above the handles (NumberTicker, from dissolve). When the bubbles would touch
 * they slide apart. With a step, the handles snap from step to step on a quick spring, tick dots
 * show under the track (up to 40 of them) and every step gives a selection tick. A light bump when
 * a handle reaches an end or the other handle. Reduced motion: no springs, the bubbles only fade.
 *
 * Screen readers get two adjustable handles, Minimum and Maximum, that step up and down.
 *
 * <RangeSlider min={0} max={1000} step={10} defaultValue={[120, 640]} prefix="$" onValueChange={setPrice} />
 *
 * <RangeSlider min={0} max={10} step={1} value={km} onValueChange={setKm} suffix=" km" bubbles="always" />
 *
 * Give it a width (it stretches by default). Its height is its own: bubbles, track, ticks.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, View, cn } from './tw';
import { NumberTicker } from './number-ticker';

export type RangeValue = [number, number];

export type RangeSliderProps = {
  /** The range, controlled: [low, high]. */
  value?: RangeValue;
  /** The range when uncontrolled. Default: [min, max]. */
  defaultValue?: RangeValue;
  /** Called with the stepped range while dragging, every time it changes. */
  onValueChange?: (value: RangeValue) => void;
  /** Called with the final range when the finger lifts or a tap lands. */
  onSlidingComplete?: (value: RangeValue) => void;
  /** Bounds and step. Default 0 to 100 by 1. */
  min?: number;
  max?: number;
  step?: number;
  /** The smallest gap between the two values. Default 0 (they can meet, never cross). */
  minDistance?: number;
  /** Tick marks under the track, one per step. Default: on when there are 40 steps or fewer and step was given. */
  ticks?: boolean;
  /** The value bubbles: while dragging (default), always, or never. */
  bubbles?: 'drag' | 'always' | 'none';
  /** Bubble text: digits after the decimal point, locale separators, and static text around the number. */
  decimals?: number;
  locale?: string;
  prefix?: string;
  suffix?: string;
  /** A selection tick on every step (when ticks show), a light bump at the ends. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Read by screen readers on the two handles. Default 'Minimum' and 'Maximum'. */
  accessibilityLabels?: [string, string];
  /** Outer classes (margins, width...). */
  className?: string;
};

const HANDLE = 28;
const HIT = 44;
const TRACK = 4;
const BUBBLE_H = 30;
const BUBBLE_ROW = 40;
const TICK_ROW = 14;
const MAX_TICKS = 40;
/** Room kept between two bubbles that would touch. */
const BUBBLE_GAP = 6;
/** iOS springs: response about 0.3 s, no bounce for the handles, a touch of give for the bubbles. */
const SNAP = { damping: 42, stiffness: 440, mass: 1 };
const POP = { damping: 30, stiffness: 300, mass: 1 };

const round6 = (v: number) => {
  'worklet';
  return Math.round(v * 1e6) / 1e6;
};

export function RangeSlider({
  value,
  defaultValue,
  onValueChange,
  onSlidingComplete,
  min = 0,
  max = 100,
  step,
  minDistance = 0,
  ticks,
  bubbles = 'drag',
  decimals = 0,
  locale,
  prefix,
  suffix,
  haptics = true,
  disabled = false,
  accessibilityLabels = ['Minimum', 'Maximum'],
  className,
}: RangeSliderProps) {
  const reduced = useReducedMotion();
  const st = step && step > 0 ? step : 1;
  const span = Math.max(max - min, 1e-9);
  const steps = Math.round(span / st);
  const showTicks = ticks ?? (step !== undefined && steps <= MAX_TICKS);

  const clampRange = useCallback(
    (r: RangeValue): RangeValue => {
      const lo = Math.min(Math.max(r[0], min), max);
      const hi = Math.min(Math.max(r[1], lo), max);
      return [lo, hi];
    },
    [min, max],
  );
  const [range, setRange] = useState<RangeValue>(() => clampRange(value ?? defaultValue ?? [min, max]));
  const rangeRef = useRef(range);

  // Values (stepped) and handle centers (px, animated), the track width, the dragged handle.
  const lo = useSharedValue(range[0]);
  const hi = useSharedValue(range[1]);
  const loX = useSharedValue(0);
  const hiX = useSharedValue(0);
  const width = useSharedValue(0);
  const active = useSharedValue(-1);
  const pressed = useSharedValue(-1);
  const grab = useSharedValue(0);
  const blocked = useSharedValue(0);
  const shown = useSharedValue(bubbles === 'always' ? 1 : 0);
  const bw0 = useSharedValue(0);
  const bw1 = useSharedValue(0);
  const [trackW, setTrackW] = useState(0);

  const xOf = useCallback(
    (v: number, w: number) => {
      'worklet';
      return ((v - min) / span) * w;
    },
    [min, span],
  );

  // Controlled value from outside: follow it when not dragging.
  useEffect(() => {
    if (!value || active.value !== -1) return;
    const r = clampRange(value);
    if (r[0] === rangeRef.current[0] && r[1] === rangeRef.current[1]) return;
    rangeRef.current = r;
    setRange(r);
    lo.value = r[0];
    hi.value = r[1];
    const w = width.value;
    loX.value = reduced ? xOf(r[0], w) : withSpring(xOf(r[0], w), SNAP);
    hiX.value = reduced ? xOf(r[1], w) : withSpring(xOf(r[1], w), SNAP);
  }, [value?.[0], value?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    shown.value = withTiming(bubbles === 'always' ? 1 : 0, { duration: 160 });
  }, [bubbles, shown]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(0, e.nativeEvent.layout.width - HANDLE);
    width.value = w;
    loX.value = xOf(lo.value, w);
    hiX.value = xOf(hi.value, w);
    setTrackW(w);
  };

  // JS side of a step: state for the bubbles and ticks, the callback, the haptic.
  const emit = useCallback(
    (which: number, v: number, bump: boolean) => {
      const next: RangeValue = which === 0 ? [v, rangeRef.current[1]] : [rangeRef.current[0], v];
      rangeRef.current = next;
      setRange(next);
      onValueChange?.(next);
      if (!haptics) return;
      if (bump) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (showTicks) Haptics.selectionAsync();
    },
    [haptics, onValueChange, showTicks],
  );
  const bumpOnly = useCallback(() => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [haptics]);
  const complete = useCallback(() => onSlidingComplete?.(rangeRef.current), [onSlidingComplete]);

  /** Moves handle `which` toward the track position x (px), stepped and kept off the other handle. */
  const move = (which: number, x: number) => {
    'worklet';
    const w = width.value;
    if (w <= 0) return;
    const raw = min + (Math.min(Math.max(x, 0), w) / w) * span;
    let v = round6(min + Math.round((raw - min) / st) * st);
    v = Math.min(Math.max(v, min), max);
    let hit = false;
    if (which === 0) {
      const cap = round6(hi.value - minDistance);
      if (v > cap) { v = Math.max(min, cap); hit = true; }
    } else {
      const cap = round6(lo.value + minDistance);
      if (v < cap) { v = Math.min(max, cap); hit = true; }
    }
    const cur = which === 0 ? lo : hi;
    const pos = which === 0 ? loX : hiX;
    const edge = hit || ((v === min || v === max) && (raw <= min || raw >= max));
    if (v !== cur.value) {
      cur.value = v;
      const px = xOf(v, w);
      pos.value = reduced || (w / steps) < 8 ? px : withSpring(px, SNAP);
      const bump = edge && blocked.value === 0;
      blocked.value = edge ? 1 : 0;
      scheduleOnRN(emit, which, v, bump);
    } else if (edge && blocked.value === 0) {
      blocked.value = 1;
      scheduleOnRN(bumpOnly);
    } else if (!edge) {
      blocked.value = 0;
    }
  };

  /** The handle a touch at x belongs to: the nearest, or by direction when both sit together. */
  const pick = (x: number, dx: number) => {
    'worklet';
    const a = Math.abs(x - loX.value);
    const b = Math.abs(x - hiX.value);
    if (Math.abs(loX.value - hiX.value) < 1) {
      if (dx !== 0) return dx < 0 ? 0 : 1;
      return x < loX.value ? 0 : 1;
    }
    return a <= b ? 0 : 1;
  };

  const reveal = (on: boolean) => {
    'worklet';
    if (bubbles !== 'drag') return;
    shown.value = on ? (reduced ? withTiming(1, { duration: 120 }) : withSpring(1, POP)) : withDelay(250, withTiming(0, { duration: 200 }));
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-3, 3])
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      const x = e.x - HANDLE / 2;
      const near = Math.min(Math.abs(x - loX.value), Math.abs(x - hiX.value)) <= HIT / 2;
      pressed.value = near ? pick(x, 0) : -1;
    })
    .onStart((e) => {
      const x0 = e.x - e.translationX - HANDLE / 2;
      const which = pick(x0, e.translationX);
      const hx = which === 0 ? loX.value : hiX.value;
      active.value = which;
      pressed.value = which;
      grab.value = Math.abs(x0 - hx) <= HIT / 2 ? hx - x0 : 0;
      blocked.value = 0;
      reveal(true);
      move(which, e.x - HANDLE / 2 + grab.value);
    })
    .onUpdate((e) => {
      if (active.value === -1) return;
      move(active.value, e.x - HANDLE / 2 + grab.value);
    })
    .onEnd(() => {
      if (active.value !== -1) scheduleOnRN(complete);
    })
    .onFinalize(() => {
      if (active.value !== -1) reveal(false);
      active.value = -1;
      pressed.value = -1;
    });

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(10)
    .onEnd((e) => {
      const x = e.x - HANDLE / 2;
      const which = pick(x, 0);
      blocked.value = 0;
      move(which, x);
      reveal(true);
      reveal(false);
      scheduleOnRN(complete);
    });

  const gesture = Gesture.Race(pan, tap);

  // Screen readers: one step per swipe, ten percent if there are no steps.
  const a11yStep = step ? st : span / 10;
  const adjust = (which: number, dir: number) => {
    const r = rangeRef.current;
    const v0 = which === 0 ? r[0] : r[1];
    let v = round6(v0 + dir * a11yStep);
    v = which === 0 ? Math.min(Math.max(v, min), r[1] - minDistance) : Math.max(Math.min(v, max), r[0] + minDistance);
    if (v === v0) return;
    (which === 0 ? lo : hi).value = v;
    const w = width.value;
    (which === 0 ? loX : hiX).value = reduced ? xOf(v, w) : withSpring(xOf(v, w), SNAP);
    emit(which, v, false);
    onSlidingComplete?.(rangeRef.current);
  };

  const fmt = useMemo(() => {
    let nf: Intl.NumberFormat | null = null;
    try {
      nf = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch {}
    return (v: number) => `${prefix ?? ''}${nf ? nf.format(v) : v.toFixed(decimals)}${suffix ?? ''}`;
  }, [locale, decimals, prefix, suffix]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: loX.value }],
    width: Math.max(0, hiX.value - loX.value),
  }));

  const tickList = useMemo(() => {
    if (!showTicks || trackW <= 0 || steps > 200) return [];
    return Array.from({ length: steps + 1 }, (_, i) => round6(min + i * st));
  }, [showTicks, trackW, steps, min, st]);

  const top = bubbles === 'none' ? 0 : BUBBLE_ROW;

  return (
    <View
      className={cn('self-stretch', disabled && 'opacity-50', className)}
      style={{ height: top + HIT + (showTicks ? TICK_ROW : 0) }}
      onLayout={onLayout}
    >
      <GestureDetector gesture={gesture}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: top - 6, height: HIT + 12 + (showTicks ? TICK_ROW : 0) }}>
          {/* Track and the fill between the handles. */}
          <View
            className="bg-dissolve-surface-2"
            style={{ position: 'absolute', left: HANDLE / 2, right: HANDLE / 2, top: 6 + (HIT - TRACK) / 2, height: TRACK, borderRadius: TRACK / 2, overflow: 'hidden' }}
          >
            <Animated.View className="bg-dissolve-foreground" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK / 2 }, fillStyle]} />
          </View>
          {tickList.map((t) => {
            const inside = t >= range[0] - 1e-9 && t <= range[1] + 1e-9;
            return (
              <View
                key={t}
                className={inside ? 'bg-dissolve-foreground' : 'bg-dissolve-muted'}
                style={{ position: 'absolute', top: 6 + HIT - 3, left: HANDLE / 2 + xOf(t, trackW) - 2, width: 4, height: 4, borderRadius: 2, opacity: inside ? 0.9 : 0.4 }}
              />
            );
          })}
          <Handle which={0} x={loX} pressed={pressed} reduced={reduced} label={accessibilityLabels[0]} valueText={fmt(range[0])} value={range[0]} min={min} max={max} onAdjust={adjust} />
          <Handle which={1} x={hiX} pressed={pressed} reduced={reduced} label={accessibilityLabels[1]} valueText={fmt(range[1])} value={range[1]} min={min} max={max} onAdjust={adjust} />
        </View>
      </GestureDetector>
      {bubbles !== 'none' && (
        <>
          <Bubble which={0} self={loX} other={hiX} selfW={bw0} otherW={bw1} width={width} shown={shown} active={active} reduced={reduced}>
            <NumberTicker value={range[0]} decimals={decimals} locale={locale} prefix={prefix} suffix={suffix} fontSize={15} duration={380} stagger={18} textClassName="text-dissolve-primary-foreground font-semibold" />
          </Bubble>
          <Bubble which={1} self={hiX} other={loX} selfW={bw1} otherW={bw0} width={width} shown={shown} active={active} reduced={reduced}>
            <NumberTicker value={range[1]} decimals={decimals} locale={locale} prefix={prefix} suffix={suffix} fontSize={15} duration={380} stagger={18} textClassName="text-dissolve-primary-foreground font-semibold" />
          </Bubble>
        </>
      )}
    </View>
  );
}

type HandleProps = {
  which: number;
  x: SharedValue<number>;
  pressed: SharedValue<number>;
  reduced: boolean;
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  onAdjust: (which: number, dir: number) => void;
};

function Handle({ which, x, pressed, reduced, label, valueText, value, min, max, onAdjust }: HandleProps) {
  const style = useAnimatedStyle(() => {
    const s = pressed.value === which && !reduced ? 1.08 : 1;
    return { transform: [{ translateX: x.value }, { scale: withSpring(s, POP) }] };
  });
  const onAction = (e: AccessibilityActionEvent) => onAdjust(which, e.nativeEvent.actionName === 'increment' ? 1 : -1);
  return (
    <Animated.View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 6 + (HIT - HANDLE) / 2,
          width: HANDLE,
          height: HANDLE,
          borderRadius: HANDLE / 2,
          backgroundColor: '#fff',
          boxShadow: '0px 0.5px 4px rgba(0,0,0,0.12), 0px 6px 13px rgba(0,0,0,0.12)',
          zIndex: which === 1 ? 2 : 1,
        },
        style,
      ]}
    />
  );
}

type BubbleProps = {
  which: number;
  self: SharedValue<number>;
  other: SharedValue<number>;
  selfW: SharedValue<number>;
  otherW: SharedValue<number>;
  width: SharedValue<number>;
  shown: SharedValue<number>;
  active: SharedValue<number>;
  reduced: boolean;
  children: ReactNode;
};

/** A value pill above a handle. Two pills that would touch slide apart around their middle. */
function Bubble({ which, self, other, selfW, otherW, width, shown, active, reduced, children }: BubbleProps) {
  const style = useAnimatedStyle(() => {
    const w = selfW.value;
    const lo = which === 0 ? self.value : other.value;
    const hi = which === 0 ? other.value : self.value;
    const wLo = which === 0 ? w : otherW.value;
    const wHi = which === 0 ? otherW.value : w;
    const need = (wLo + wHi) / 2 + BUBBLE_GAP;
    let cLo = lo;
    let cHi = hi;
    if (hi - lo < need) {
      const mid = (lo + hi) / 2;
      cLo = mid - need / 2;
      cHi = mid + need / 2;
    }
    // Keep both inside the slider box (the track is inset by half a handle).
    const total = width.value + HANDLE;
    const minC = wLo / 2 - HANDLE / 2;
    const maxC = total - wHi / 2 - HANDLE / 2;
    if (cLo < minC) { cHi += minC - cLo; cLo = minC; }
    if (cHi > maxC) { cLo -= cHi - maxC; cHi = maxC; }
    const c = which === 0 ? cLo : cHi;
    const s = shown.value;
    const lift = active.value === which ? 1 : 0.96;
    return {
      opacity: Math.min(1, s * 1.4),
      transform: [
        { translateX: HANDLE / 2 + c - w / 2 },
        { translateY: reduced ? 0 : (1 - s) * 10 },
        { scale: reduced ? 1 : (0.6 + 0.4 * s) * lift },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => {
        selfW.value = e.nativeEvent.layout.width;
      }}
      className="bg-dissolve-primary"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          height: BUBBLE_H,
          paddingHorizontal: 11,
          borderRadius: BUBBLE_H / 2,
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: 'bottom',
          boxShadow: '0px 6px 16px rgba(0,0,0,0.12)',
          zIndex: 3,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
