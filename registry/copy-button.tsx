/**
 * CopyButton, from dissolve (dissolve-ui). This file is yours: change the timings, the icons, the
 * sizes, anything. Colors come from the dissolve theme tokens (global.css), so it follows light and
 * dark mode out of the box.
 *
 * An icon button that copies text. Press it and the text goes to the clipboard with a success
 * haptic; the copy icon breaks into a few grains that flow over and reform as a check, with a tiny
 * pop, while a "Copied" tooltip rises above it. After 1.5 s it settles back to the copy icon.
 * effects="none" swaps the icons with a plain crossfade. Reduced motion: a crossfade, no pop.
 *
 * Needs expo-clipboard: npx expo install expo-clipboard
 *
 * <CopyButton text="npx dissolve-ui add copy-button" />
 *
 * <CopyButton text={() => editor.getValue()} size="sm" onCopy={(t) => track('copied', t.length)} />
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View as RNView } from 'react-native';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';
import { CALM, clamp01, hash } from './motion';

const SIZES = {
  sm: { box: 32, icon: 16, radius: 9 },
  md: { box: 36, icon: 18, radius: 10 },
  lg: { box: 44, icon: 20, radius: 12 },
} as const;

export type CopyButtonSize = keyof typeof SIZES;

export type CopyButtonProps = {
  /** The text to copy, or a function that returns it at press time. */
  text: string | (() => string);
  /** Called with the copied text. */
  onCopy?: (text: string) => void;
  /** How long the check and the tooltip stay, in ms. Default 1500. */
  timeout?: number;
  /** Tooltip text, also announced to screen readers. Default 'Copied'. */
  copiedLabel?: string;
  /** Button and icon size: 32, 36 or 44 pt. Default 'md'. */
  size?: CopyButtonSize;
  /** 'accent': the copy icon breaks into grains that reform as the check. 'none': a plain crossfade. Default 'accent'. */
  effects?: 'accent' | 'none';
  /** Success haptic on copy. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Read by screen readers. Default 'Copy'. */
  accessibilityLabel?: string;
  /** Outer classes (margins, background...). */
  className?: string;
};

/** The grains: they gather off the copy icon, fly over STAGGER + RUN and land on the check. */
const GRAINS = 14;
const STAGGER = 80;
const RUN = 240;
const COPY_OUT = 80;
const CHECK_AT = 290;
const CHECK_IN = 90;
const FADE_AT = 320;
const FADE = 80;
const END = FADE_AT + FADE;
/** The pop: the icon swells by POP and settles as the grains land. */
const POP = 0.14;
const POP_AT = 240;
const POP_LEN = 240;
/** Plain swap (effects none or reduced motion) and the way back. */
const SWAP = 140;
const BACK = 160;
const TIP_IN = 160;
const TIP_OUT = 140;
/** Sideways arc of a grain mid flight, in icon units (24 a side). */
const ARC = 3;

const FLOW = Easing.bezierFn(0.42, 0, 0.12, 1);

/** Points along a polyline, evenly spaced, in icon units. */
function along(pts: number[][], n: number) {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(l);
    total += l;
  }
  const out: number[][] = [];
  for (let k = 0; k < n; k++) {
    let d = (total * k) / (n - 1);
    let i = 0;
    while (i < segs.length - 1 && d > segs[i]) d -= segs[i++];
    const u = segs[i] ? Math.min(1, d / segs[i]) : 0;
    out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]);
  }
  return out;
}

/** Copy icon: the front square, then the back corner. Check: the two strokes. Both in a 24 unit box. */
const FROM = [
  ...along([[8, 8], [22, 8], [22, 22], [8, 22], [8, 8]], 10),
  ...along([[2, 15], [2, 2], [15, 2]], 4),
].sort((a, b) => a[0] - b[0]);
const TO = along([[4, 12], [9, 17], [20, 6]], GRAINS);
/** Per grain: from x y, to x y, delay seed, arc sign. */
const GRID = FROM.map((f, i) => [f[0], f[1], TO[i][0], TO[i][1], hash(i, 4), hash(i, 5) - 0.5]);

export function CopyButton({
  text,
  onCopy,
  timeout = 1500,
  copiedLabel = 'Copied',
  size = 'md',
  effects = 'accent',
  haptics = true,
  disabled = false,
  accessibilityLabel = 'Copy',
  className,
}: CopyButtonProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size] ?? SIZES.md;
  const k = s.icon / 24;
  const fg = useToken('foreground');
  const muted = useToken('muted');
  const bg = useToken('background');
  const surface = useToken('surface');

  /** ms into the copy animation; 0 at rest. */
  const t = useSharedValue(END);
  /** 1 once it settles back to the copy icon. */
  const back = useSharedValue(1);
  /** 1 for the plain crossfade. */
  const plain = useSharedValue(effects === 'none' || reduced ? 1 : 0);
  const tip = useSharedValue(0);
  const pressed = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    plain.value = effects === 'none' || reduced ? 1 : 0;
  }, [effects, reduced, plain]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const value = typeof text === 'function' ? text() : text;
    try {
      await Clipboard.setStringAsync(value);
    } catch {
      return;
    }
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AccessibilityInfo.announceForAccessibility(copiedLabel);
    onCopy?.(value);
    // Already showing the check: keep it, only restart the countdown.
    if (back.value !== 0) {
      back.value = 0;
      t.value = 0;
      const len = plain.value ? SWAP : END;
      t.value = withTiming(len, { duration: len, easing: Easing.linear });
      tip.value = withTiming(1, { duration: TIP_IN, easing: CALM });
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      back.value = withTiming(1, { duration: BACK });
      tip.value = withTiming(0, { duration: TIP_OUT });
    }, timeout);
  };

  const iconStyle = useAnimatedStyle(() => {
    const at = plain.value ? clamp01(t.value / (SWAP * 1.7)) : clamp01((t.value - POP_AT) / POP_LEN);
    const pop = reduced || back.value > 0 ? 0 : Math.sin(Math.PI * at) * (plain.value ? POP * 0.7 : POP);
    return { transform: [{ scale: (1 + pop) * (1 - pressed.value * 0.08) }] };
  });
  const copyStyle = useAnimatedStyle(() => {
    if (back.value > 0) return { opacity: back.value };
    return { opacity: 1 - clamp01(t.value / (plain.value ? SWAP : COPY_OUT)) };
  });
  const checkStyle = useAnimatedStyle(() => {
    const a = plain.value ? clamp01(t.value / SWAP) : clamp01((t.value - CHECK_AT) / CHECK_IN);
    return { opacity: a * (1 - back.value) };
  });
  const tipStyle = useAnimatedStyle(() => ({ opacity: tip.value, transform: [{ translateY: (1 - tip.value) * 4 }, { scale: 0.96 + tip.value * 0.04 }] }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const stroke = 2 * k;
  const dot = stroke * 1.25;

  return (
    <View className={cn(className)} style={{ width: s.box, height: s.box }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={Math.max(0, (44 - s.box) / 2)}
        onPress={copy}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 160 });
        }}
        style={{ width: s.box, height: s.box, borderRadius: s.radius, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s.radius, borderCurve: 'continuous', backgroundColor: surface }, bgStyle]} />
        <Animated.View pointerEvents="none" style={[{ width: s.icon, height: s.icon }, iconStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, copyStyle]}>
            <RNView style={{ position: 'absolute', left: 8 * k - stroke / 2, top: 8 * k - stroke / 2, width: 14 * k + stroke, height: 14 * k + stroke, borderRadius: 2.5 * k, borderWidth: stroke, borderColor: muted }} />
            <RNView
              style={{ position: 'absolute', left: 2 * k - stroke / 2, top: 2 * k - stroke / 2, width: 13 * k + stroke, height: 13 * k + stroke, borderTopLeftRadius: 2.5 * k, borderLeftWidth: stroke, borderTopWidth: stroke, borderColor: muted }}
            />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}>
            <Seg x1={4} y1={12} x2={9} y2={17} k={k} w={stroke} color={fg} />
            <Seg x1={9} y1={17} x2={20} y2={6} k={k} w={stroke} color={fg} />
          </Animated.View>
          {effects === 'accent' && !reduced
            ? GRID.map((g, i) => <Grain key={i} g={g} k={k} dot={dot} t={t} back={back} muted={muted} fg={fg} />)
            : null}
        </Animated.View>
      </Pressable>
      <RNView pointerEvents="none" style={[st.tipWrap, { bottom: s.box + 6 }]}>
        <Animated.View style={[st.tip, { backgroundColor: fg }, tipStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[st.tipText, { color: bg }]}>{copiedLabel}</Text>
        </Animated.View>
      </RNView>
    </View>
  );
}

/** A round capped stroke from (x1, y1) to (x2, y2), in icon units. */
function Seg({ x1, y1, x2, y2, k, w, color }: { x1: number; y1: number; x2: number; y2: number; k: number; w: number; color: string }) {
  const len = Math.hypot(x2 - x1, y2 - y1) * k + w;
  const cx = ((x1 + x2) / 2) * k;
  const cy = ((y1 + y2) / 2) * k;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <RNView
      style={{ position: 'absolute', left: cx - len / 2, top: cy - w / 2, width: len, height: w, borderRadius: w / 2, backgroundColor: color, transform: [{ rotate: `${angle}rad` }] }}
    />
  );
}

/** One grain: leaves the copy icon, arcs over and lands on the check, taking its color on the way. */
function Grain({ g, k, dot, t, back, muted, fg }: { g: number[]; k: number; dot: number; t: SharedValue<number>; back: SharedValue<number>; muted: string; fg: string }) {
  const style = useAnimatedStyle(() => {
    const now = t.value;
    // Left grains leave first, so the cloud sweeps toward the check's long stroke.
    const delay = (g[0] / 24) * STAGGER * 0.6 + g[4] * STAGGER * 0.4;
    const e = FLOW(clamp01((now - delay) / RUN));
    const bump = Math.sin(Math.PI * e);
    const x = (g[0] + (g[2] - g[0]) * e + g[5] * ARC * 2 * bump) * k;
    const y = (g[1] + (g[3] - g[1]) * e - ARC * bump) * k;
    const a = back.value > 0 ? 0 : clamp01(now / 40) * (1 - clamp01((now - FADE_AT) / FADE));
    return {
      opacity: a,
      backgroundColor: e < 0.5 ? muted : fg,
      transform: [{ translateX: x - dot / 2 }, { translateY: y - dot / 2 }, { scale: 1 - 0.35 * bump }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: dot, height: dot, borderRadius: dot / 2, opacity: 0 }, style]} />;
}

const st = StyleSheet.create({
  tipWrap: { position: 'absolute', left: -60, right: -60, alignItems: 'center' },
  tip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderCurve: 'continuous' },
  tipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
