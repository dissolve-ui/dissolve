/**
 * TypingIndicator, from dissolve (dissolve-ui). This file is yours: change the sizes, the
 * springs, the line, anything. Colors come from the dissolve theme tokens (global.css), so it
 * follows light and dark mode out of the box.
 *
 * The chat typing indicator: the avatars of who is typing, overlapping in a stack, a bubble of
 * three dots in a wave, and "Ana and Ben are typing" under them, in the column of the message
 * text (past the first avatar). Pass the people typing right now; the indicator works out the
 * rest. A newcomer pops into the stack on a spring and the stack makes room, someone who stops
 * shrinks away and the others slide over to close the gap. Past maxAvatars, a +N disc stands for
 * the rest. The line changes with a short crossfade. With nobody typing, everything fades out
 * (the indicator keeps its height, so a chat does not jump). Monochrome: avatars without a
 * picture show initials on surface-2, the bubble is surface, the dots and the line muted.
 * Announced politely to screen readers. Reduced motion: plain fades, the dots pulse in place.
 *
 * <TypingIndicator typers={typing.map((u) => ({ id: u.id, name: u.firstName, avatar: u.photo }))} />
 */
import { useEffect } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { Animated, Text, View, cn } from './tw';

export type Typer = {
  /** Stable id: an avatar keeps its view (and its animation) across updates. */
  id: string;
  name: string;
  /** Picture: a URL or a require(). Without one, the initials of the name. */
  avatar?: string | ImageSourcePropType;
};

export type TypingIndicatorProps = {
  /** Who is typing right now, in the order the avatars stack (first on top). */
  typers: Typer[];
  /** Avatars shown before a +N disc. Default 3. */
  maxAvatars?: number;
  /** Avatar diameter, pt. Default 28. */
  size?: number;
  /** The line under the avatars. Default true. */
  showLabel?: boolean;
  /** Your own line, from the names. Default: "Ana, Ben and 2 others are typing". */
  formatLabel?: (names: string[]) => string;
  className?: string;
};

/** Pop and slide: quick, with a little overshoot. Same as web. */
const POP = { stiffness: 320, damping: 22 };
const SLIDE = { stiffness: 280, damping: 28 };
const OUT_MS = 180;
/** How much of an avatar the next one covers. */
const OVERLAP = 0.36;

/** "Ana is typing", "Ana and Ben are typing", "Ana, Ben and Chloe are typing", "Ana, Ben and 2 others are typing". */
export function typingLabel(names: string[]) {
  const n = names.length;
  if (!n) return '';
  if (n === 1) return `${names[0]} is typing`;
  if (n === 2) return `${names[0]} and ${names[1]} are typing`;
  if (n === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing`;
  return `${names[0]}, ${names[1]} and ${n - 2} others are typing`;
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const popIn: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.5 }] },
    animations: { opacity: withSpring(1, POP), transform: [{ scale: withSpring(1, POP) }] },
  };
};
const shrinkOut: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: { opacity: withTiming(0, { duration: OUT_MS }), transform: [{ scale: withTiming(0.5, { duration: OUT_MS }) }] },
  };
};

function Avatar({ typer, more, x, z, size }: { typer: Typer | null; more: number; x: number; z: number; size: number }) {
  const left = useSharedValue(x);
  useEffect(() => { left.value = withSpring(x, SLIDE); }, [x, left]);
  const style = useAnimatedStyle(() => ({ left: left.value }));
  const src = typeof typer?.avatar === 'string' ? { uri: typer.avatar } : typer?.avatar;
  return (
    <Animated.View
      entering={popIn}
      exiting={shrinkOut}
      className={typer ? 'bg-dissolve-surface-2 border-dissolve-background' : 'bg-dissolve-surface border-dissolve-background'}
      style={[{ position: 'absolute', top: -2, width: size + 4, height: size + 4, marginLeft: -2, borderRadius: (size + 4) / 2, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', zIndex: z }, style]}
    >
      {src ? (
        <Image source={src} style={{ width: size, height: size }} />
      ) : (
        <Text className={typer ? 'text-dissolve-foreground' : 'text-dissolve-muted'} style={{ fontSize: Math.round(size * 0.38), fontWeight: '600', letterSpacing: -0.1 }}>
          {typer ? initials(typer.name) : `+${more}`}
        </Text>
      )}
    </Animated.View>
  );
}

function Dot({ i, size, still }: { i: number; size: number; still: boolean }) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0, { duration: 360 }), withTiming(0, { duration: 480 })), -1));
  }, [i, k]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * k.value, transform: [{ translateY: still ? 0 : -3 * k.value }] }));
  return <Animated.View className="bg-dissolve-muted" style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}

export function TypingIndicator({ typers, maxAvatars = 3, size = 28, showLabel = true, formatLabel, className }: TypingIndicatorProps) {
  const still = useReducedMotion();
  const over = typers.length > maxAvatars;
  const visible = typers.slice(0, over ? maxAvatars - 1 : maxAvatars);
  const more = typers.length - visible.length;
  const slots: { key: string; typer: Typer | null }[] = visible.map((t) => ({ key: `u:${t.id}`, typer: t }));
  if (over) slots.push({ key: 'more', typer: null });
  const step = size * (1 - OVERLAP);
  const label = typers.length ? (formatLabel ?? typingLabel)(typers.map((t) => t.name)) : '';

  const width = useSharedValue(slots.length ? (slots.length - 1) * step + size : 0);
  const shown = useSharedValue(typers.length ? 1 : 0);
  useEffect(() => {
    const w = slots.length ? (slots.length - 1) * step + size : 0;
    width.value = still ? w : withSpring(w, SLIDE);
    shown.value = still ? withTiming(typers.length ? 1 : 0, { duration: 200 }) : withSpring(typers.length ? 1 : 0, POP);
  }, [slots.length, typers.length, step, size, still, width, shown]);

  const stackStyle = useAnimatedStyle(() => ({ width: Math.max(0, width.value), marginRight: width.value > 1 ? 8 : 0 }));
  const rowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value),
    transform: [{ scale: 0.85 + 0.15 * shown.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value) }));

  // The bubble scales with the avatars: 34 pt high for 28 pt avatars.
  const bh = Math.round(size * 1.1 + 3);
  return (
    <View className={cn('self-stretch items-start', className)} accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', transformOrigin: 'left center' }, rowStyle]}>
        <Animated.View style={[{ height: size }, stackStyle]}>
          {slots.map((s, i) => (
            <Avatar key={s.key} typer={s.typer} more={more} x={i * step} z={slots.length - i} size={size} />
          ))}
        </Animated.View>
        <View className="bg-dissolve-surface" style={{ height: bh, paddingHorizontal: Math.round(bh * 0.38), borderRadius: bh / 2, flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.15) }}>
          {[0, 1, 2].map((i) => <Dot key={i} i={i} size={Math.round(size * 0.25)} still={still} />)}
        </View>
      </Animated.View>
      {showLabel ? (
        <Animated.View style={[{ height: 18, marginTop: 6, marginLeft: size + 8, alignSelf: 'stretch' }, labelStyle]}>
          {label ? (
            <Animated.Text key={label} entering={FadeIn.delay(90).duration(160)} exiting={FadeOut.duration(160)} className="text-dissolve-muted" style={{ position: 'absolute', left: 0, top: 0, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
              {label}
            </Animated.Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
