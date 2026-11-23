/**
 * Marquee, from dissolve (dissolve-ui). This file is yours: change the speed, the easing,
 * the fades, anything. The fades follow the background theme token (global.css), so they follow
 * light and dark mode out of the box.
 *
 * An endless row (logos, words, cards) that scrolls on its own, seamless at any width: the row
 * is repeated as many times as the box needs and wraps without a seam, recomputed when the box
 * or the content resizes. Press it and it eases to a stop; let go and it eases back to speed.
 * Drag it to scrub, with inertia: let go with a flick and it coasts on, then settles back to its
 * cruise. A vertical swipe still scrolls the screen. The motion runs on the UI thread. The edges
 * fade into fadeColor (the background token by default): pass the color of the surface the row
 * sits on. Copies are hidden from screen readers. Reduced motion: it does not scroll by itself;
 * dragging still works.
 *
 * <Marquee speed={40} accessibilityLabel="What people say">
 *   {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
 * </Marquee>
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, View, cn, useToken } from './tw';
import { toRGBA } from './dots';

export type MarqueeProps = {
  /** The items of the row, once. */
  children: ReactNode;
  /** Cruise speed, pt per second. Default 40. */
  speed?: number;
  /** Which way the row travels. Default 'left'. */
  direction?: 'left' | 'right';
  /** Eases to a stop while pressed. Default true. */
  pauseOnPress?: boolean;
  /** Drag to scrub, with inertia. Default true. */
  draggable?: boolean;
  /** Width of the faded edges, pt. 0 for none. Default 48. */
  fade?: number;
  /** The color the edges fade into. Default: the background token. */
  fadeColor?: string;
  /** Space between items and between the end of the row and its next copy, pt. Default 12. */
  gap?: number;
  /** Read by screen readers for the whole row. */
  accessibilityLabel?: string;
  className?: string;
};

/** How fast the speed eases to its target, per second: a stop or a restart takes about 400 ms. */
const EASE = 5;
/** After a flick: a slower ease, so the row coasts for about a second. Same as web. */
const COAST = 2.6;
const MAX_FLING = 3000;

export function Marquee({
  children,
  speed = 40,
  direction = 'left',
  pauseOnPress = true,
  draggable = true,
  fade = 48,
  fadeColor,
  gap = 12,
  accessibilityLabel,
  className,
}: MarqueeProps) {
  const bg = useToken('background');
  const reduced = useReducedMotion();
  const [boxW, setBoxW] = useState(0);
  const [rowW, setRowW] = useState(0);
  const copies = rowW ? Math.ceil(boxW / rowW) + 1 : 0;

  const W = useSharedValue(0);
  const x = useSharedValue(0);
  const v = useSharedValue(0);
  const held = useSharedValue(false);
  const dragging = useSharedValue(false);
  const coasting = useSharedValue(false);
  const x0 = useSharedValue(0);
  const cruiseV = reduced ? 0 : direction === 'right' ? -speed : speed;

  useFrameCallback((info) => {
    if (dragging.value || !W.value) return;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const c = held.value && pauseOnPress ? 0 : cruiseV;
    if (coasting.value && Math.abs(v.value - c) < Math.max(4, Math.abs(c) * 0.2)) coasting.value = false;
    v.value += (c - v.value) * (1 - Math.exp(-dt * (coasting.value ? COAST : EASE)));
    if (Math.abs(v.value) < 0.5 && c === 0) v.value = 0;
    x.value += v.value * dt;
  });

  const pan = Gesture.Pan()
    .enabled(draggable)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin(() => { held.value = true; })
    .onStart(() => {
      dragging.value = true;
      v.value = 0;
      x0.value = x.value;
    })
    .onUpdate((e) => { x.value = x0.value - e.translationX; })
    .onEnd((e) => {
      v.value = Math.max(-MAX_FLING, Math.min(MAX_FLING, -e.velocityX));
      coasting.value = true;
    })
    .onFinalize(() => {
      held.value = false;
      dragging.value = false;
    });
  // A press without a drag pauses too (a Pan only begins on movement for some inputs).
  const press = Gesture.LongPress()
    .minDuration(0)
    .maxDistance(10000)
    .shouldCancelWhenOutside(false)
    .onBegin(() => { held.value = true; })
    .onFinalize(() => { held.value = false; });

  const track = useAnimatedStyle(() => {
    const w = W.value;
    const off = w ? ((x.value % w) + w) % w : 0;
    return { transform: [{ translateX: -off }] };
  });

  const onRow = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    W.value = w;
    setRowW(w);
  };

  const row = (key: number) => (
    <View
      key={key}
      onLayout={key === 0 ? onRow : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap, paddingRight: gap }}
      accessibilityElementsHidden={key > 0}
      importantForAccessibility={key > 0 ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </View>
  );

  const [r, g, b] = toRGBA(fadeColor ?? bg);
  const solid = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},1)`;
  const clear = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},0)`;

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, press)}>
      <View
        className={cn('overflow-hidden', className)}
        onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="none"
      >
        <Animated.View style={[{ flexDirection: 'row', alignSelf: 'flex-start' }, track]}>
          {row(0)}
          {Array.from({ length: copies }, (_, i) => row(i + 1))}
        </Animated.View>
        {fade > 0 ? (
          <>
            <LinearGradient pointerEvents="none" colors={[solid, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { right: undefined, width: fade }]} />
            <LinearGradient pointerEvents="none" colors={[clear, solid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { left: undefined, width: fade }]} />
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}
