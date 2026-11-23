/**
 * AvatarStack, from dissolve (dissolve-ui). This file is yours: change the overlap, the springs,
 * the sizes, anything. Colors come from the dissolve theme tokens (global.css), so it follows light
 * and dark mode out of the box.
 *
 * Overlapping avatars with a "+N" chip for the rest. Press and hold the stack and it spreads apart;
 * slide your finger across and a tooltip follows it with each person's name. A tap spreads it too
 * and names the avatar under the finger; it closes up again on its own. Add or remove a person and
 * the stack makes room or closes the gap on a spring, the newcomer popping in, the leaver shrinking
 * away. Selection tick as the name changes. Reduced motion: no springs, plain fades.
 *
 * Plain motion only, no grains: the people are the content.
 *
 * <AvatarStack
 *   avatars={[
 *     { id: 'ava', name: 'Ava Chen', src: 'https://example.com/ava.jpg' },
 *     { id: 'ben', name: 'Ben Ortiz' },
 *   ]}
 * />
 *
 * <AvatarStack avatars={team} max={3} size="sm" />
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View as RNView, type ImageSourcePropType } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';

const SIZES = {
  sm: { size: 28, ring: 1.5, font: 11 },
  md: { size: 36, ring: 2, font: 13 },
  lg: { size: 44, ring: 2, font: 15 },
} as const;

export type AvatarStackSize = keyof typeof SIZES;

export type AvatarStackItem = {
  /** Unique key: an avatar keeps its place and animates by it. */
  id: string;
  /** Shown in the tooltip and read by screen readers. Its initials stand in when there is no image. */
  name: string;
  /** Image: a URL or a require(). */
  src?: string | ImageSourcePropType;
};

export type AvatarStackProps = {
  avatars: AvatarStackItem[];
  /** Avatars shown before the "+N" chip. Default 4. */
  max?: number;
  /** Avatar diameter: 28, 36 or 44 pt. Default 'md'. */
  size?: AvatarStackSize;
  /** How much each avatar slides under the previous one, as a share of its size. Default 0.3. */
  overlap?: number;
  /** Space between avatars once spread, in pt. Default 6. */
  spreadGap?: number;
  /** Selection tick as the named avatar changes. Default true. */
  haptics?: boolean;
  /** Outer classes (margins...). */
  className?: string;
};

/** The stack's springs: crisp, a hint of bounce. */
const SPRING = { damping: 20, stiffness: 260, mass: 1 };
/** A tap keeps it spread this long. */
const TAP_HOLD = 2200;
/** Hold this long before the stack spreads under the finger. */
const HOLD = 140;
const TIP_GAP = 8;

/** Initials of a name: first and last word. */
const initials = (name: string) => {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};

export function AvatarStack({ avatars, max = 4, size = 'md', overlap = 0.3, spreadGap = 6, haptics = true, className }: AvatarStackProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size] ?? SIZES.md;
  const bg = useToken('background');
  const fg = useToken('foreground');
  const line = useToken('border');

  const shown = avatars.length > max ? avatars.slice(0, max) : avatars;
  const rest = avatars.length - shown.length;
  const slots = shown.length + (rest > 0 ? 1 : 0);

  const closed = s.size * (1 - overlap);
  const open = s.size + spreadGap;
  /** 0 stacked, 1 spread. */
  const sp = useSharedValue(0);
  /** Slots, animated: the width follows. */
  const count = useSharedValue(slots);
  const [hover, setHover] = useState(-1);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const geo = useSharedValue({ closed, open, n: shown.length });

  useEffect(() => {
    geo.value = { closed, open, n: shown.length };
    count.value = reduced ? slots : withSpring(slots, SPRING);
  }, [closed, open, shown.length, slots, reduced, geo, count]);
  useEffect(() => () => clearTimeout(tapTimer.current), []);
  // An avatar that left takes its tooltip with it.
  useEffect(() => {
    if (hover >= shown.length) {
      hoverRef.current = -1;
      setHover(-1);
    }
  }, [hover, shown.length]);

  const spread = (on: boolean) => {
    'worklet';
    sp.value = reduced ? withTiming(on ? 1 : 0, { duration: 120 }) : withSpring(on ? 1 : 0, SPRING);
  };
  const hoverRef = useRef(-1);
  const name = (i: number) => {
    if (hoverRef.current === i) return;
    hoverRef.current = i;
    if (i >= 0 && haptics) Haptics.selectionAsync();
    setHover(i);
  };
  const closeLater = () => {
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      spread(false);
      name(-1);
    }, TAP_HOLD);
  };
  const hold = () => clearTimeout(tapTimer.current);

  /** The avatar under x once spread, or -1 over the chip and outside. */
  const at = (x: number) => {
    'worklet';
    const g = geo.value;
    const i = Math.floor(x / g.open);
    return i >= 0 && i < g.n ? i : -1;
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD)
    .onStart((e) => {
      scheduleOnRN(hold);
      spread(true);
      scheduleOnRN(name, at(e.x));
    })
    .onUpdate((e) => {
      scheduleOnRN(name, at(e.x));
    })
    .onFinalize((_e, ok) => {
      if (!ok) return;
      spread(false);
      scheduleOnRN(name, -1);
    });
  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd((e, ok) => {
      if (!ok) return;
      // Stacked: the finger was over the stacked layout, so map it through the closed step.
      const g = geo.value;
      const i = sp.value > 0.5 ? at(e.x) : Math.min(g.n - 1, Math.floor(e.x / g.closed));
      spread(true);
      scheduleOnRN(name, i < g.n ? i : -1);
      scheduleOnRN(closeLater);
    });
  const gesture = Gesture.Exclusive(pan, tap);

  const boxStyle = useAnimatedStyle(() => {
    const step = closed + (open - closed) * sp.value;
    return { width: Math.max(0, (count.value - 1) * step + s.size) };
  });

  const label = useMemo(() => {
    const names = shown.map((a) => a.name);
    return rest > 0 ? `${names.join(', ')} and ${rest} more` : names.join(', ');
  }, [shown, rest]);

  const enter = useMemo<EntryExitAnimationFunction>(
    () => () => {
      'worklet';
      return {
        initialValues: { opacity: 0, transform: [{ scale: 0.6 }] },
        animations: { opacity: withTiming(1, { duration: 180 }), transform: [{ scale: reduced ? withTiming(1, { duration: 1 }) : withSpring(1, SPRING) }] },
      };
    },
    [reduced],
  );
  const exit = useMemo<EntryExitAnimationFunction>(
    () => () => {
      'worklet';
      return {
        initialValues: { opacity: 1, transform: [{ scale: 1 }] },
        animations: { opacity: withTiming(0, { duration: 160 }), transform: [{ scale: withTiming(reduced ? 1 : 0.6, { duration: 160 }) }] },
      };
    },
    [reduced],
  );

  return (
    <View className={cn(className)}>
      <GestureDetector gesture={gesture}>
        <Animated.View accessible accessibilityRole="text" accessibilityLabel={label} style={[{ height: s.size }, boxStyle]}>
          {shown.map((a, i) => (
            <Slot key={a.id} index={i} z={slots - i} sp={sp} closed={closed} open={open} size={s.size} ring={s.ring} bg={bg} line={line} reduced={reduced} enter={enter} exit={exit} lifted={hover === i}>
              <Face item={a} size={s.size} font={s.font} />
            </Slot>
          ))}
          {rest > 0 ? (
            <Slot key="dissolve-avatar-more" index={shown.length} z={0} sp={sp} closed={closed} open={open} size={s.size} ring={s.ring} bg={bg} line={line} reduced={reduced} enter={enter} exit={exit} lifted={false}>
              <RNView style={[st.center, { width: s.size, height: s.size }]} className="bg-dissolve-surface-2">
                <Text className="text-dissolve-foreground" style={{ fontSize: s.font, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  +{rest}
                </Text>
              </RNView>
            </Slot>
          ) : null}
        </Animated.View>
      </GestureDetector>
      <Tip index={hover} name={hover >= 0 ? shown[hover]?.name ?? '' : ''} sp={sp} closed={closed} open={open} size={s.size} fg={fg} bg={bg} reduced={reduced} />
    </View>
  );
}

function Slot({
  index,
  z,
  sp,
  closed,
  open,
  size,
  ring,
  bg,
  line,
  reduced,
  enter,
  exit,
  lifted,
  children,
}: {
  index: number;
  z: number;
  sp: SharedValue<number>;
  closed: number;
  open: number;
  size: number;
  ring: number;
  bg: string;
  line: string;
  reduced: boolean;
  enter: EntryExitAnimationFunction;
  exit: EntryExitAnimationFunction;
  lifted: boolean;
  children: ReactNode;
}) {
  const idx = useSharedValue(index);
  const lift = useSharedValue(0);
  useEffect(() => {
    idx.value = reduced ? index : withSpring(index, SPRING);
  }, [index, reduced, idx]);
  useEffect(() => {
    lift.value = reduced ? 0 : withSpring(lifted ? 1 : 0, SPRING);
  }, [lifted, reduced, lift]);
  const style = useAnimatedStyle(() => ({
    left: idx.value * (closed + (open - closed) * sp.value) - ring,
    top: -ring - lift.value * 3,
  }));
  return (
    <Animated.View
      entering={enter}
      exiting={exit}
      style={[{ position: 'absolute', zIndex: lifted ? 100 : z, width: size + ring * 2, height: size + ring * 2, borderRadius: size, padding: ring, backgroundColor: bg }, style]}
    >
      <RNView style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {children}
        {/* A hairline over the face, so light faces keep their edge against the ring. */}
        <RNView pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: line }]} />
      </RNView>
    </Animated.View>
  );
}

function Face({ item, size, font }: { item: AvatarStackItem; size: number; font: number }) {
  const [failed, setFailed] = useState(false);
  if (item.src !== undefined && !failed) {
    return <Image source={typeof item.src === 'string' ? { uri: item.src } : item.src} style={{ width: size, height: size }} onError={() => setFailed(true)} />;
  }
  return (
    <RNView style={[st.center, { width: size, height: size }]} className="bg-dissolve-surface-2">
      <Text className="text-dissolve-foreground" style={{ fontSize: font, fontWeight: '600' }}>
        {initials(item.name)}
      </Text>
    </RNView>
  );
}

/** The name above the avatar under the finger: it slides from one avatar to the next. */
function Tip({ index, name, sp, closed, open, size, fg, bg, reduced }: { index: number; name: string; sp: SharedValue<number>; closed: number; open: number; size: number; fg: string; bg: string; reduced: boolean }) {
  const x = useSharedValue(Math.max(0, index));
  const a = useSharedValue(0);
  const [text, setText] = useState(name);
  useEffect(() => {
    if (index >= 0) {
      setText(name);
      x.value = a.value < 0.05 || reduced ? index : withSpring(index, SPRING);
    }
    a.value = withTiming(index >= 0 ? 1 : 0, { duration: index >= 0 ? 160 : 120 });
  }, [index, name, reduced, x, a]);
  const style = useAnimatedStyle(() => ({
    opacity: a.value,
    transform: [{ translateX: x.value * (closed + (open - closed) * sp.value) + size / 2 }, { translateY: (1 - a.value) * 4 }, { scale: 0.96 + a.value * 0.04 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[st.tipAnchor, { bottom: size + TIP_GAP }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <RNView style={st.tipCenter}>
        <RNView style={[st.tip, { backgroundColor: fg }]}>
          <Text numberOfLines={1} style={[st.tipText, { color: bg }]}>
            {text}
          </Text>
        </RNView>
        <RNView style={[st.arrow, { backgroundColor: fg }]} />
      </RNView>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // A zero width anchor at the avatar's center; the tooltip centers on it.
  tipAnchor: { position: 'absolute', left: 0, width: 0, alignItems: 'center' },
  tipCenter: { width: 240, alignItems: 'center' },
  tip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderCurve: 'continuous', maxWidth: 240 },
  tipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  arrow: { width: 8, height: 8, marginTop: -5, borderRadius: 1.5, transform: [{ rotate: '45deg' }] },
});
