/**
 * QuantityStepper, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the icons, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * − / + pill for carts. The count rolls like a ticker, the pill widens and narrows with the digit
 * count. A tap steps once, on release. Hold a button and it steps at 380 ms, then repeats faster
 * and faster, down to one step every 60 ms after 1.5 s; the roll gets shorter with the pace so
 * the digits always show the real count. At the minimum the − turns into a red trash; tap it and
 * onRemove runs, so you can dissolve the row (see below). The trash only arms once its morph is
 * done, so a quick double tap on − stops at the minimum instead of removing the row. Tapping +
 * at the maximum shakes the pill.
 *
 * Depends on registry/number-ticker.tsx (installed with it): the count is a NumberTicker.
 *
 * const { ref, dissolving, dissolve } = useDissolve();
 * <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
 *   <QuantityStepper value={qty} onChange={setQty} onRemove={async () => { await dissolve({ preset: 'sand' }); drop(); }} />
 * </View>
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { NumberTicker } from './number-ticker';
import { Animated, Pressable, View, cn, useToken } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const MINUS = Skia.Path.MakeFromSVGString('M6 12h12')!;
const PLUS = Skia.Path.MakeFromSVGString('M12 6v12M6 12h12')!;
const TRASH = Skia.Path.MakeFromSVGString('M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7M10.2 10.8v5.8M13.8 10.8v5.8')!;
/** Hold to repeat: first step after this delay, then faster and faster. */
const REPEAT_FROM = 380;
const REPEAT_TO = 60;
const REPEAT_RAMP = 1500;
/** Roll length of a single step, and the shortest one while repeating fast. */
const ROLL = 360;
const ROLL_FAST = 140;
/** The trash ignores taps for this long after the count reached the minimum. */
const TRASH_ARM = 320;

const SIZES = {
  sm: { h: 30, btn: 32, icon: 14, font: 13, stroke: 2.2 },
  md: { h: 36, btn: 38, icon: 16, font: 15, stroke: 2.2 },
};

export type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  /** Default 1. */
  min?: number;
  /** Default 99. */
  max?: number;
  /** When set, the − becomes a trash at the minimum and calls this on tap. Dissolve your row here. */
  onRemove?: () => void;
  size?: 'sm' | 'md';
  haptics?: boolean;
  /** Pill classes (background, radius, margins...). */
  className?: string;
  /** Count classes (weight, color...). */
  textClassName?: string;
};

function Icon({ path, color, size, stroke }: { path: ReturnType<typeof Skia.Path.Make>; color: string; size: number; stroke: number }) {
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color={color} style="stroke" strokeWidth={stroke * (24 / size)} strokeCap="round" strokeJoin="round" transform={[{ scale: size / 24 }]} />
    </Canvas>
  );
}

function StepButton({
  width,
  dim,
  label,
  onTap,
  onHoldStart,
  onHoldEnd,
  children,
}: {
  width: number;
  dim: boolean;
  label: string;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  children: ReactNode;
}) {
  const press = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onHoldStart}
      delayLongPress={REPEAT_FROM}
      onPressIn={() => {
        press.value = withTiming(0.9, { duration: 90, easing: CALM });
      }}
      onPressOut={() => {
        // Small element: a light overshoot on release.
        press.value = withSpring(1, { damping: 15, stiffness: 380, mass: 0.7 });
        onHoldEnd();
      }}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-full items-center justify-center"
      style={{ width }}
    >
      <Animated.View className="items-center justify-center" style={[st, { opacity: dim ? 0.35 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function MinusOrTrash({ t, ink, danger, icon, stroke, reduced }: { t: SharedValue<number>; ink: string; danger: string; icon: number; stroke: number; reduced: boolean }) {
  // The − turns a quarter and fades out while the trash turns in from the other side.
  const minusStyle = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ rotate: `${reduced ? 0 : t.value * 90}deg` }] }));
  const trashStyle = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ rotate: `${reduced ? 0 : (t.value - 1) * 90}deg` }] }));
  return (
    <View style={{ width: icon, height: icon }}>
      <Animated.View style={[StyleSheet.absoluteFill, minusStyle]}>
        <Icon path={MINUS} color={ink} size={icon} stroke={stroke} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, trashStyle]}>
        <Icon path={TRASH} color={danger} size={icon} stroke={stroke * 0.85} />
      </Animated.View>
    </View>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, onRemove, size = 'md', haptics = true, className, textClassName }: QuantityStepperProps) {
  const reduced = useReducedMotion();
  const ink = useToken('foreground');
  const danger = useToken('danger');
  const m = SIZES[size];

  const atMin = value <= min;
  const atMax = value >= max;
  const trash = atMin && !!onRemove;

  const t = useSharedValue(trash ? 1 : 0);
  const shake = useSharedValue(0);
  // Latest props for the repeat loop, which outlives the render that started it.
  const live = useRef({ min, max, onChange, onRemove, haptics, reduced, trash });
  live.current = { min, max, onChange, onRemove, haptics, reduced, trash };
  /** Count as the loop sees it: one step ahead of the props until the parent re-renders. */
  const current = useRef(value);
  current.current = value;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStep = useRef(0);
  const roll = useRef(ROLL);

  useEffect(() => {
    t.value = withTiming(trash ? 1 : 0, { duration: reduced ? 150 : 160, easing: CALM });
  }, [trash, reduced, t]);

  const stopHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };

  useEffect(() => stopHold, []);

  const bump = () => {
    if (live.current.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (live.current.reduced) return;
    const swing = (x: number) => withTiming(x, { duration: 45, easing: Easing.inOut(Easing.sin) });
    shake.value = withSequence(swing(-4), swing(4), swing(-4), swing(4), swing(0));
  };

  /** One step. Returns false when blocked, which also ends a hold. */
  const step = (dir: 1 | -1, pace?: number) => {
    const { min: lo, max: hi, onChange: emit, haptics: buzz } = live.current;
    const next = current.current + dir;
    if (next > hi || next < lo) {
      // Holding − into the minimum just stops; + into the maximum (or any tap) shakes.
      if (pace === undefined || dir > 0) bump();
      return false;
    }
    current.current = next;
    lastStep.current = Date.now();
    // The roll lasts about one and a half steps of the current pace, so it never lags behind.
    roll.current = pace === undefined ? ROLL : Math.max(ROLL_FAST, Math.min(ROLL, pace * 1.5));
    emit(next);
    if (buzz) Haptics.selectionAsync();
    return true;
  };

  const startHold = (dir: 1 | -1) => {
    stopHold();
    const t0 = Date.now();
    const loop = () => {
      const k = Math.min(1, (Date.now() - t0) / REPEAT_RAMP);
      const eased = 1 - (1 - k) * (1 - k);
      const wait = REPEAT_FROM - (REPEAT_FROM - REPEAT_TO) * eased;
      if (!step(dir, wait)) return stopHold();
      hold.current = setTimeout(loop, wait);
    };
    // Pressable fires the long press at REPEAT_FROM: that is the first repeated step.
    loop();
  };

  const tapMinus = () => {
    const { trash: isTrash, onRemove: remove, haptics: buzz } = live.current;
    if (isTrash) {
      // Just reached the minimum: the second tap of a fast double tap must not remove the row.
      if (Date.now() - lastStep.current < TRASH_ARM) return;
      stopHold();
      if (buzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      remove?.();
      return;
    }
    step(-1);
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <Animated.View
      style={shakeStyle}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Quantity"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View className={cn('flex-row items-center self-start rounded-full bg-dissolve-surface', className)} style={{ height: m.h }}>
        <StepButton
          width={m.btn}
          dim={atMin && !onRemove}
          label={trash ? 'Remove' : 'Decrease'}
          onTap={tapMinus}
          onHoldStart={() => (live.current.trash ? tapMinus() : startHold(-1))}
          onHoldEnd={stopHold}
        >
          <MinusOrTrash t={t} ink={ink} danger={danger} icon={m.icon} stroke={m.stroke} reduced={reduced} />
        </StepButton>
        <View className="items-center" style={{ minWidth: m.font * 0.9 }}>
          <NumberTicker value={value} fontSize={m.font} duration={reduced ? 0 : roll.current} stagger={18} className="self-center" textClassName={cn('font-semibold', textClassName)} />
        </View>
        <StepButton width={m.btn} dim={atMax} label="Increase" onTap={() => step(1)} onHoldStart={() => startHold(1)} onHoldEnd={stopHold}>
          <Icon path={PLUS} color={ink} size={m.icon} stroke={m.stroke} />
        </StepButton>
      </View>
    </Animated.View>
  );
}
