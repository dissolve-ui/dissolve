/**
 * Toggle, from dissolve (dissolve-ui). This file is yours: change the timings, the grain grid, the
 * sizes, anything. Colors come from the dissolve theme tokens (global.css), so it follows light and
 * dark mode out of the box.
 *
 * An iOS style switch whose thumb is made of grains. At rest it is the familiar white thumb on a
 * capsule track. Flip it and the thumb breaks into grains, leading edge first: they flow to the
 * other end of the track on a slight arc, shrinking mid flight, and reassemble into the thumb there
 * (about 380 ms), while the track fills with the on color behind them. Tap it, or swipe the thumb
 * toward the other side. Selection tick on every change. Reduced motion: the thumb simply slides.
 *
 * Built for scroll views: the thumb, the track layers and every grain are plain Animated views moved
 * by transform and opacity only, so it keeps animating while a scroll view is being dragged on iOS.
 *
 * <Toggle value={wifi} onValueChange={setWifi} />
 *
 * <Toggle defaultValue size="sm" onColor="#0A84FF" accessibilityLabel="Notifications" />
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View as RNView, type BoxShadowValue } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, makeMutable, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, cn, useToken } from './tw';
import { CALM_FN, clamp01, hash } from './motion';
import { toRGBA } from './dots';

const SIZES = {
  sm: { width: 42, height: 26, inset: 2 },
  md: { width: 51, height: 31, inset: 2 },
  lg: { width: 60, height: 36, inset: 2.5 },
} as const;

export type ToggleSize = keyof typeof SIZES;

export type ToggleProps = {
  /** On or off (controlled). */
  value?: boolean;
  /** Initial state when uncontrolled. Default false. */
  defaultValue?: boolean;
  /** Called with the new state on every flip. */
  onValueChange?: (value: boolean) => void;
  /** Track size: 42 x 26, 51 x 31 (the iOS switch) or 60 x 36 pt. Default 'md'. */
  size?: ToggleSize;
  /** Selection tick on every flip. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Track fill when on. Default: the success token (iOS green). */
  onColor?: string;
  /** Track fill when off. Default: the foreground token at a low alpha, so it sits on any background. */
  offColor?: string;
  /** Thumb and grain color. Default white. */
  thumbColor?: string;
  /** Read by screen readers. */
  accessibilityLabel?: string;
  /** Outer classes (margins, self alignment...). The size comes from the size prop. */
  className?: string;
};

/** Grains leave over STAGGER (leading edge first), each flies for RUN. */
const STAGGER = 90;
const RUN = 260;
/** The old thumb fades under the grains as they break off. */
const GHOST_OUT = 80;
/** The new thumb fades in under the grains as they land, then the grains fade off it. */
const THUMB_AT = 250;
const THUMB_IN = 90;
const FADE_AT = 300;
const FADE = 80;
const END = FADE_AT + FADE;
/** The track crosses over to its new color over this long. */
const TRACK = 300;
/** Reduced motion: a plain slide. */
const SLIDE = 240;
/** Mid flight, grains shrink to this share of their size. */
const SHRINK = 0.5;
/** Sideways scatter and arc of a grain mid flight, in points. */
const SCATTER = 4;
const ARC = 5;
/** Grain pool, and the grid pitch as a share of the thumb size. */
const MAX_GRAINS = 80;
const PITCH = 0.15;
/** Grains overlap their neighbours at rest, so the cloud reads as one solid thumb. */
const OVERLAP = 1.25;
/** Per grain grid: x y (from the thumb's left top), arc, delay seed. */
const GF = 4;
/** Per grain live draw: x y alpha scale. */
const DF = 4;
/** A swipe this long toward the other side flips it. */
const SWIPE = 8;

/** Leaves fast, lands soft: grains break off with a little intent instead of jumping. */
const FLOW = Easing.bezierFn(0.42, 0, 0.12, 1);

/** Grid points inside the round thumb, row by row. */
function grainGrid(d: number) {
  let pitch = Math.max(3, d * PITCH);
  for (;;) {
    const cols = Math.max(3, Math.round(d / pitch));
    const p = d / cols;
    const r = d / 2;
    const out: number[] = [];
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * p;
        const y = (j + 0.5) * p;
        if ((x - r) ** 2 + (y - r) ** 2 > (r - p * 0.3) ** 2) continue;
        const k = out.length / GF;
        // Top rows arc up, bottom rows down: the cloud breathes open in flight, then closes.
        out.push(x, y, ((y - r) / r) * 0.8 + (hash(k, 3) - 0.5) * 0.7, hash(k, 4));
      }
    }
    if (out.length / GF <= MAX_GRAINS) return { grid: out, dot: p * OVERLAP };
    pitch *= 1.15;
  }
}

export function Toggle({
  value,
  defaultValue = false,
  onValueChange,
  size = 'md',
  haptics = true,
  disabled = false,
  onColor,
  offColor,
  thumbColor,
  accessibilityLabel,
  className,
}: ToggleProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size] ?? SIZES.md;
  const d = s.height - s.inset * 2;
  const offX = s.inset;
  const onX = s.width - s.inset - d;

  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const on = controlled ? value : inner;

  const fg = useToken('foreground');
  const bg = useToken('background');
  const success = useToken('success');
  const colors = useMemo(() => {
    const [fr, fgG, fb] = toRGBA(fg);
    const [br, bgG, bb] = toRGBA(bg);
    const dark = 0.2126 * br + 0.7152 * bgG + 0.0722 * bb < 0.5;
    return {
      off: offColor ?? `rgba(${Math.round(fr * 255)}, ${Math.round(fgG * 255)}, ${Math.round(fb * 255)}, ${dark ? 0.2 : 0.1})`,
      on: onColor ?? success,
      thumb: thumbColor ?? 'rgb(255, 255, 255)',
    };
  }, [fg, bg, success, onColor, offColor, thumbColor]);

  const { grid, dot } = useMemo(() => grainGrid(d), [d]);
  const count = grid.length / GF;
  const buf = useMemo(
    () => ({
      grid: makeMutable<number[]>([]),
      draw: makeMutable<number[]>(new Array(MAX_GRAINS * DF).fill(0)),
      /** Per grain at the start of the flight: x y alpha scale. */
      from: makeMutable<number[]>(new Array(MAX_GRAINS * DF).fill(0)),
    }),
    [],
  );

  /** Geometry on the UI thread. */
  const geo = useSharedValue({ offX, onX, d, inset: s.inset, n: count });
  /** 1 on, 0 off: where the thumb is going. */
  const target = useSharedValue(on ? 1 : 0);
  const req = useSharedValue(0);
  const flying = useSharedValue(0);
  const startAt = useSharedValue(0);
  const thumbX = useSharedValue(on ? onX : offX);
  const thumbA = useSharedValue(1);
  const ghostX = useSharedValue(0);
  const ghostA = useSharedValue(0);
  const ghostA0 = useSharedValue(0);
  const slideFrom = useSharedValue(0);
  /** Opacity of the on color over the off track. */
  const onA = useSharedValue(on ? 1 : 0);
  const onFrom = useSharedValue(0);
  /** Bumped once per drawn frame: the grain styles re-read the draw buffer when it changes. */
  const painted = useSharedValue(0);

  // New size: new grain grid, snap the thumb to its end.
  useEffect(() => {
    buf.grid.value = grid;
    geo.value = { offX, onX, d, inset: s.inset, n: count };
    flying.value = 0;
    req.value = 0;
    thumbX.value = target.value ? onX : offX;
    thumbA.value = 1;
    ghostA.value = 0;
    onA.value = target.value;
    painted.value += 1;
  }, [buf, grid, count, offX, onX, d, s.inset, geo, flying, req, thumbX, thumbA, ghostA, onA, target, painted]);

  // A new value from the parent: fly there.
  useEffect(() => {
    const t = on ? 1 : 0;
    if (target.value === t) return;
    target.value = t;
    req.value = 1;
  }, [on, target, req]);

  useFrameCallback((info) => {
    'worklet';
    // Idle: the loop stays registered but does nothing, so a flip starts on the next frame.
    if (!req.value && !flying.value) return;
    const now = info.timestamp;
    const g = geo.value;
    const G = buf.grid.value;
    const N = g.n;
    const D = buf.draw.value;
    const F = buf.from.value;
    const toX = target.value ? g.onX : g.offX;

    if (req.value) {
      req.value = 0;
      // Start (or re-aim) the flight from wherever everything is right now.
      onFrom.value = onA.value;
      if (flying.value && !reduced) {
        for (let i = 0; i < N * DF; i++) F[i] = D[i];
      } else {
        const ox = thumbX.value;
        for (let i = 0; i < N; i++) {
          F[i * DF] = ox + G[i * GF];
          F[i * DF + 1] = g.inset + G[i * GF + 1];
          F[i * DF + 2] = 1;
          F[i * DF + 3] = 1;
        }
      }
      ghostX.value = thumbX.value;
      ghostA0.value = thumbA.value;
      slideFrom.value = thumbX.value;
      startAt.value = now;
      flying.value = 1;
      if (!reduced) {
        thumbX.value = toX;
        thumbA.value = 0;
      }
    }

    const since = now - startAt.value;
    onA.value = onFrom.value + (target.value - onFrom.value) * FLOW(clamp01(since / (reduced ? SLIDE : TRACK)));

    if (reduced) {
      thumbX.value = slideFrom.value + (toX - slideFrom.value) * CALM_FN(clamp01(since / SLIDE));
      thumbA.value = 1;
      ghostA.value = 0;
      if (since >= SLIDE) flying.value = 0;
      painted.value = now;
      return;
    }

    // Leading edge first: the grains at the front of the thumb (in the travel direction) leave first.
    const dir = toX >= ghostX.value ? 1 : -1;
    const out = clamp01((since - FADE_AT) / FADE);
    for (let i = 0; i < N; i++) {
      const k = i * GF;
      const o = i * DF;
      const u = G[k] / g.d;
      const lead = dir > 0 ? u : 1 - u;
      const delay = (1 - lead) * STAGGER * 0.6 + G[k + 3] * STAGGER * 0.4;
      const run = RUN * (0.85 + 0.3 * hash(i, 9));
      const e = FLOW(clamp01((since - delay) / run));
      const bump = Math.sin(Math.PI * e);
      const tx = toX + G[k];
      const ty = g.inset + G[k + 1];
      D[o] = F[o] + (tx - F[o]) * e + (hash(i, 5) - 0.5) * SCATTER * bump;
      D[o + 1] = F[o + 1] + (ty - F[o + 1]) * e + G[k + 2] * ARC * bump;
      const a0 = F[o + 2];
      D[o + 2] = (a0 + (1 - a0) * clamp01(since / 50)) * (1 - out);
      D[o + 3] = (F[o + 3] + (1 - F[o + 3]) * e) * (1 - SHRINK * bump);
    }
    ghostA.value = ghostA0.value * (1 - clamp01(since / GHOST_OUT));
    thumbA.value = clamp01((since - THUMB_AT) / THUMB_IN);
    if (since >= END) {
      flying.value = 0;
      for (let i = 0; i < N; i++) D[i * DF + 2] = 0;
      thumbA.value = 1;
      ghostA.value = 0;
    }
    painted.value = now;
  }, true);

  const commit = (next: boolean) => {
    if (haptics) Haptics.selectionAsync();
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };
  /** Flips on the UI thread right away, tells React after. */
  const flip = (want?: number) => {
    'worklet';
    const t = want ?? 1 - target.value;
    if (t === target.value) return;
    target.value = t;
    req.value = 1;
    scheduleOnRN(commit, t === 1);
  };

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(12)
    .onEnd((_e, ok) => {
      if (ok) flip();
    });
  // Horizontal swipes only, so a vertical swipe still scrolls the page.
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX > SWIPE) flip(1);
      else if (e.translationX < -SWIPE) flip(0);
    });
  const gesture = Gesture.Race(pan, tap);

  const onStyle = useAnimatedStyle(() => ({ opacity: onA.value }));
  const thumbStyle = useAnimatedStyle(() => ({ opacity: thumbA.value, transform: [{ translateX: thumbX.value }] }));
  const ghostStyle = useAnimatedStyle(() => ({ opacity: ghostA.value, transform: [{ translateX: ghostX.value }] }));

  const shadow: BoxShadowValue[] = [
    { offsetX: 0, offsetY: 3, blurRadius: 8, color: 'rgba(0, 0, 0, 0.15)' },
    { offsetX: 0, offsetY: 1, blurRadius: 1, color: 'rgba(0, 0, 0, 0.06)' },
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 0.5, color: 'rgba(0, 0, 0, 0.04)' },
  ];
  const thumbBox = { position: 'absolute' as const, left: 0, top: s.inset, width: d, height: d, borderRadius: d / 2, backgroundColor: colors.thumb, boxShadow: shadow };
  const radius = s.height / 2;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: on, disabled }}
        onAccessibilityTap={() => {
          if (!disabled) flip();
        }}
        className={cn('self-start', className)}
        style={{ width: s.width, height: s.height, borderRadius: radius, borderCurve: 'continuous', backgroundColor: colors.off, opacity: disabled ? 0.5 : 1 }}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: colors.on }, onStyle]} />
        <RNView pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[thumbBox, ghostStyle]} />
          <Animated.View style={[thumbBox, thumbStyle]} />
          {Array.from({ length: count }, (_, i) => (
            <Grain key={i} i={i} dot={dot} draw={buf.draw} painted={painted} color={colors.thumb} />
          ))}
        </RNView>
      </Animated.View>
    </GestureDetector>
  );
}

/** One grain: a dot positioned from the shared draw buffer, re-read on every painted frame. */
function Grain({ i, dot, draw, painted, color }: { i: number; dot: number; draw: SharedValue<number[]>; painted: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    // Read to subscribe: the style re-runs on every painted frame.
    painted.value;
    const D = draw.value;
    const k = i * DF;
    return {
      opacity: D[k + 2],
      transform: [{ translateX: D[k] - dot / 2 }, { translateY: D[k + 1] - dot / 2 }, { scale: D[k + 3] }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color, opacity: 0 }, style]} />;
}
