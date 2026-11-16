/**
 * CardStack, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the curve, anything. The cards are yours too: renderCard draws
 * them, this file only adds the stack chrome (corner radius, clip and shadow).
 *
 * <CardStack items={cards} renderCard={(c) => <PaymentCard card={c} />} onFocus={setActive} />
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, View, cn } from './tw';

/** Calm iOS curve, no bounce: everything in the stack moves on it. */
const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const FOCUS_MS = 560;
const CYCLE_MS = 420;
/** Visible strip of each card in the compressed stack under the focused card. */
const MINI = 9;
/** Space between the focused card and the compressed stack. */
const MINI_GAP = 22;
/** Visible part of the frontmost compressed card. */
const MINI_TAIL = 30;

export type CardStackProps<T> = {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  /** Card height. Default: container width / 1.586 (ISO payment card ratio). */
  cardHeight?: number;
  /** Visible strip of each card in the stack. Default 60. */
  peek?: number;
  /** Called with the focused index, or null when back to the stack. */
  onFocus?: (index: number | null) => void;
  keyExtractor?: (item: T, index: number) => string;
  haptics?: boolean;
  /** Container classes (margins, padding...). */
  className?: string;
  /** Card chrome: corner radius and shadow. Replaces the default (rounded-[20px] plus a soft shadow cast upward on the card behind). */
  cardClassName?: string;
};

/** Upward shadow: each card shades the strip of the card it overlaps. */
const CARD = 'rounded-[20px] shadow-[0_-2px_20px_rgba(0,0,0,0.12)]';

type Motion = 'move' | 'enter' | 'reappear';

type CardProps = {
  index: number;
  y: number;
  scale: number;
  delay: number;
  seq: number;
  motion: Motion;
  dir: number;
  focused: boolean;
  canCycle: boolean;
  z: number;
  width: number;
  height: number;
  className?: string;
  onTap: (i: number) => void;
  onDismiss: () => void;
  onCycle: (dir: number) => void;
  children: ReactNode;
};

function Card({ index, y, scale, delay, seq, motion, dir, focused, canCycle, z, width, height, className, onTap, onDismiss, onCycle, children }: CardProps) {
  const ty = useSharedValue(y);
  const tx = useSharedValue(0);
  const sc = useSharedValue(scale);
  const op = useSharedValue(1);
  const press = useSharedValue(0);
  const axis = useSharedValue(0); // 0 undecided, 1 horizontal, 2 vertical
  const off = width + 24;

  useEffect(() => {
    if (motion === 'enter') {
      // The next card slides in from the side it was swiped toward.
      ty.value = y;
      sc.value = scale;
      op.value = 1;
      tx.value = dir * off;
      tx.value = withTiming(0, { duration: CYCLE_MS, easing: CALM });
      return;
    }
    if (motion === 'reappear') {
      // The card that just left settles quietly into the compressed stack.
      tx.value = 0;
      ty.value = y;
      sc.value = scale;
      op.value = 0;
      op.value = withDelay(80, withTiming(1, { duration: 320, easing: CALM }));
      return;
    }
    const t = { duration: FOCUS_MS, easing: CALM };
    ty.value = withDelay(delay, withTiming(y, t));
    sc.value = withDelay(delay, withTiming(scale, t));
    tx.value = withTiming(0, t);
    op.value = withTiming(1, { duration: 200 });
    // seq replays the move even when the target did not change (snap back after a drag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, scale, seq]);

  const pan = Gesture.Pan()
    .enabled(focused)
    .activeOffsetX(canCycle ? [-10, 10] : [-9999, 9999])
    .activeOffsetY([-10, 10])
    .onStart((e) => {
      axis.value = canCycle && Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2;
    })
    .onUpdate((e) => {
      if (axis.value === 1) {
        tx.value = e.translationX;
        return;
      }
      const d = e.translationY;
      // Down follows the finger, up resists.
      ty.value = d > 0 ? d * 0.9 : -Math.sqrt(-d) * 3;
      sc.value = 1 - Math.min(1, Math.max(0, d) / 400) * 0.05;
    })
    .onEnd((e) => {
      if (axis.value === 1) {
        if (Math.abs(e.translationX) > width * 0.28 || Math.abs(e.velocityX) > 700) {
          const next = e.translationX < 0 ? 1 : -1;
          tx.value = withTiming(-next * off, { duration: 260, easing: Easing.bezier(0.4, 0, 1, 1) }, (done) => {
            if (done) scheduleOnRN(onCycle, next);
          });
        } else {
          tx.value = withTiming(0, { duration: 380, easing: CALM });
        }
        return;
      }
      if (e.translationY > 90 || e.velocityY > 800) {
        scheduleOnRN(onDismiss);
      } else {
        ty.value = withTiming(0, { duration: 380, easing: CALM });
        sc.value = withTiming(1, { duration: 380, easing: CALM });
      }
    });

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onBegin(() => {
      press.value = withTiming(1, { duration: 120 });
    })
    .onEnd(() => {
      scheduleOnRN(onTap, index);
    })
    .onFinalize(() => {
      press.value = withTiming(0, { duration: 260, easing: CALM });
    });

  const style = useAnimatedStyle(() => {
    const away = Math.min(1, Math.abs(tx.value) / width);
    return {
      opacity: op.value * (1 - away * 0.6),
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value * (1 - 0.015 * press.value) }],
    };
  });

  return (
    // boxShadow (the shadow-* classes) is drawn outside the clip, so one view does radius, clip and shadow.
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        className={cn('absolute left-0 right-0 top-0 overflow-hidden', className)}
        style={[s.card, { height, zIndex: z }, style]}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * A Wallet style stack. Cards overlap and show their top strip; tap one and it comes forward
 * while the others slide down and compress under it. Drag the focused card down to put it
 * back, swipe it sideways to go to the next one. Everything runs on the UI thread on one
 * calm curve, with a fixed container height so nothing around it relayouts.
 */
export function CardStack<T>({ items, renderCard, cardHeight, peek = 60, onFocus, keyExtractor, haptics = true, className, cardClassName = CARD }: CardStackProps<T>) {
  const [W, setW] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [seq, setSeq] = useState(0);
  const [cycle, setCycle] = useState<{ from: number; to: number; dir: number } | null>(null);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  const n = items.length;
  const H = cardHeight ?? Math.round(W / 1.586);
  const stackH = Math.max(0, n - 1) * peek + H;
  const focusH = H + MINI_GAP + Math.max(0, n - 2) * MINI + MINI_TAIL;
  const total = Math.max(stackH, focusH);

  const go = useCallback(
    (next: number | null) => {
      setCycle(null);
      setFocus(next);
      setSeq((v) => v + 1);
      onFocusRef.current?.(next);
    },
    [],
  );

  const onTap = useCallback(
    (i: number) => {
      if (focus === null) {
        if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        go(i);
      } else if (i !== focus) {
        // Tapping the compressed stack puts everything back, like Wallet.
        if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        go(null);
      }
    },
    [focus, go, haptics],
  );

  const onDismiss = useCallback(() => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    go(null);
  }, [go, haptics]);

  const onCycle = useCallback(
    (dir: number) => {
      if (focus === null || n < 2) return;
      const to = (focus + dir + n) % n;
      if (haptics) Haptics.selectionAsync();
      setCycle({ from: focus, to, dir });
      setFocus(to);
      setSeq((v) => v + 1);
      onFocusRef.current?.(to);
    },
    [focus, haptics, n],
  );

  // Back to the stack if the focused item disappears.
  useEffect(() => {
    if (focus !== null && focus >= n) go(null);
  }, [focus, n, go]);

  const target = (i: number) => {
    if (focus === null) return { y: i * peek, scale: 1, delay: i * 18 };
    if (i === focus) return { y: 0, scale: 1, delay: 0 };
    const k = i < focus ? i : i - 1;
    const m = Math.max(1, n - 2);
    const sc = 0.92 + 0.04 * (k / m);
    // Scale is around the center: shift so the top edge lands on its strip.
    return { y: H + MINI_GAP + k * MINI - (H * (1 - sc)) / 2, scale: sc, delay: 40 + k * 22 };
  };

  return (
    <View className={className} style={{ height: W ? total : undefined }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {W ? (
        // Clips the compressed stack and the sideways exits to the component bounds.
        <View className="overflow-hidden" style={StyleSheet.absoluteFill}>
          {items.map((item, i) => {
            const t = target(i);
            const motion: Motion = cycle && cycle.to === i ? 'enter' : cycle && cycle.from === i ? 'reappear' : 'move';
            return (
              <Card
                key={keyExtractor ? keyExtractor(item, i) : String(i)}
                index={i}
                y={t.y}
                scale={t.scale}
                delay={t.delay}
                seq={seq}
                motion={motion}
                dir={cycle?.dir ?? 1}
                focused={focus === i}
                canCycle={n > 1}
                z={focus === i ? n + 10 : i}
                width={W}
                height={H}
                className={cardClassName}
                onTap={onTap}
                onDismiss={onDismiss}
                onCycle={onCycle}
              >
                {renderCard(item, i)}
              </Card>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderCurve: 'continuous' },
});
