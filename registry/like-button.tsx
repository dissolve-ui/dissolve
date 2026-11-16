/**
 * LikeButton, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the sparks, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box. The liked heart keeps the brand
 * pink by default (the color prop).
 *
 * Like: the heart pops and sparks burst around it. Unlike: the filled heart snaps away into
 * grains and the outline is back.
 *
 * <LikeButton liked={liked} onChange={setLiked} count={likes} />
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useDissolve } from 'react-native-dissolve';
import { Animated, Pressable, Text, View, cn, useToken } from './tw';

const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const SPARKS = 10;
const PALETTE = ['#FF2D55', '#FF9F0A', '#5E5CE6', '#34C759', '#64D2FF'];

function Heart({ size, color, filled }: { size: number; color: string; filled: boolean }) {
  const path = useMemo(() => {
    const p = Skia.Path.MakeFromSVGString(HEART)!;
    p.transform(Skia.Matrix().scale(size / 24, size / 24));
    return p;
  }, [size]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color={color} style={filled ? 'fill' : 'stroke'} strokeWidth={filled ? 0 : 1.8} />
    </Canvas>
  );
}

function Spark({ i, size, p, color }: { i: number; size: number; p: SharedValue<number>; color: string }) {
  const a = (i / SPARKS) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => {
    const r = size * 0.35 + p.value * size * 0.75;
    return {
      opacity: p.value === 0 ? 0 : 1 - p.value,
      transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r }, { scale: 1 - p.value * 0.6 }],
    };
  });
  const d = Math.max(4, size * 0.16);
  return <Animated.View className="absolute" style={[{ width: d, height: d, borderRadius: d / 2, backgroundColor: color }, style]} />;
}

export type LikeButtonProps = {
  liked: boolean;
  onChange: (liked: boolean) => void;
  /** Heart size in points. Default 26. */
  size?: number;
  /** Liked heart and count color. Default brand pink #FF2D55. */
  color?: string;
  /** Outline heart and idle count color. Default the muted token. */
  idleColor?: string;
  /** Optional counter shown next to the heart. */
  count?: number;
  haptics?: boolean;
  /** Row classes (gap, padding, margins...). */
  className?: string;
  /** Counter text classes (size, weight). */
  countClassName?: string;
};

export function LikeButton({ liked, onChange, size = 26, color = '#FF2D55', idleColor, count, haptics = true, className, countClassName }: LikeButtonProps) {
  const muted = useToken('muted');
  const idle = idleColor ?? muted;
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = async () => {
    if (busy) return;
    if (!liked) {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(true);
      // Tiny element: a short spring overshoot is fine here.
      scale.value = withSequence(withTiming(0.86, { duration: 70 }), withSpring(1, { damping: 30, stiffness: 500 }));
      burst.value = 0;
      burst.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }, () => {
        burst.value = 0;
      });
      return;
    }
    setBusy(true);
    await dissolve({ preset: 'snap', origin: { x: size / 2, y: size / 2 }, duration: 800, grain: Math.max(1.5, size / 14), haptics });
    onChange(false);
    reset();
    setBusy(false);
  };

  return (
    <Pressable
      onPress={press}
      hitSlop={10}
      className={cn('flex-row items-center gap-1.5', className)}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
    >
      <View className="items-center justify-center" style={{ width: size, height: size }}>
        {Array.from({ length: SPARKS }, (_, i) => (
          <Spark key={i} i={i} size={size} p={burst} color={PALETTE[i % PALETTE.length]} />
        ))}
        <Animated.View style={pop}>
          {liked ? (
            <RNView ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
              <Heart size={size} color={color} filled />
            </RNView>
          ) : (
            <Heart size={size} color={idle} filled={false} />
          )}
        </Animated.View>
        {liked && dissolving ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View className="flex-1 items-center justify-center">
              <Heart size={size} color={idle} filled={false} />
            </View>
          </View>
        ) : null}
      </View>
      {count !== undefined ? (
        <Text className={cn('text-[15px] font-semibold tabular-nums', countClassName)} style={{ color: liked ? color : idle }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
