/**
 * ProgressSteps, from dissolve (dissolve-ui). This file is yours: change the timings, the grain
 * grid, the sizes, anything. Colors come from the dissolve theme tokens (global.css), so it follows
 * light and dark mode out of the box.
 *
 * A row of numbered steps joined by a line, for onboarding, checkout or any multi step form. Done
 * steps are filled with a check, the current one is filled with a soft ring around it, the next ones
 * are hollow. Move forward and the current disc sheds a copy of itself in grains: the cloud flattens
 * onto the line and streams along it, filling the line behind its front, then gathers back into a
 * disc on the new step (about 450 ms, a little longer when it skips steps). Move back and the disc
 * breaks up and streams home the other way, emptying the line. Selection tick on every change.
 * Reduced motion: the line fills and the discs cross fade.
 *
 * Built for scroll views: discs, line fills and every grain are plain Animated views moved by
 * transform and opacity only, so it keeps animating while a scroll view is being dragged on iOS.
 *
 * <ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />
 *
 * <ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Easing, makeMutable, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, Text, View, cn, useToken } from './tw';
import { clamp01, hash } from './motion';
import { toRGBA } from './dots';

const SIZES = {
  sm: { disc: 20, line: 2, font: 11, label: 12, ring: 3 },
  md: { disc: 26, line: 3, font: 12, label: 13, ring: 4 },
  lg: { disc: 32, line: 3, font: 14, label: 14, ring: 5 },
} as const;

export type ProgressStepsSize = keyof typeof SIZES;

export type ProgressStepsProps = {
  /** The steps: their labels, or how many there are (no labels then). Two or more. */
  steps: string[] | number;
  /** The current step, from 0. steps.length marks them all done. */
  current: number;
  /** Called with the index of a pressed step. Steps are not pressable without it. */
  onStepPress?: (index: number) => void;
  /** Disc, line and type size: 20, 26 or 32 pt discs. Default 'md'. */
  size?: ProgressStepsSize;
  /** Selection tick on every change of current. Default true. */
  haptics?: boolean;
  /** Fill of the done and current discs, the line and the grains. Default: the primary token. */
  activeColor?: string;
  /** Hollow discs and the empty line. Default: the foreground token at a low alpha. */
  trackColor?: string;
  /** Outer classes (width, margins...). It stretches to its parent by default. */
  className?: string;
  /** Label classes (font, tracking...). The colors come from the theme tokens. */
  labelClassName?: string;
};

/** Grains leave over STAGGER (leading edge first), each flies for RUN, plus HOP per skipped step. */
const STAGGER = 120;
const RUN = 300;
const HOP = 110;
/** The new disc fades in under the grains as they land, then the grains fade off it. */
const LAND = 110;
const FADE = 90;
/** Share of the trip over which a step it crosses changes state. */
const WINDOW = 0.18;
/** Reduced motion: the line fills and the discs cross fade over this long. */
const PLAIN = 280;
/** Mid flight the cloud flattens to this share of its height and its grains shrink to this share. */
const FLATTEN = 0.85;
const SHRINK = 0.45;
/** Grain pool, and the grid pitch as a share of the disc size. */
const MAX_GRAINS = 90;
const PITCH = 0.14;
const OVERLAP = 1.25;
/** Gap between a disc and the line, in points. */
const GAP = 4;
/** Per grain grid: x y (from the disc's center), seed, seed. Live draw: x y alpha scale. */
const GF = 4;
const DF = 4;
/** Per step levels: fill, check, ring. */
const SF = 3;

/** Leaves fast, lands soft. */
const FLOW = Easing.bezierFn(0.42, 0, 0.12, 1);

/** Grid points inside the disc, centered on it. */
function grainGrid(d: number) {
  let pitch = Math.max(3, d * PITCH);
  for (;;) {
    const cols = Math.max(3, Math.round(d / pitch));
    const p = d / cols;
    const r = d / 2;
    const out: number[] = [];
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * p - r;
        const y = (j + 0.5) * p - r;
        if (x * x + y * y > (r - p * 0.3) ** 2) continue;
        const k = out.length / GF;
        out.push(x, y, hash(k, 4), hash(k, 6));
      }
    }
    if (out.length / GF <= MAX_GRAINS) return { grid: out, dot: p * OVERLAP };
    pitch *= 1.15;
  }
}

/** Levels of every step and line for a current step: fill, check, ring per step, then one per line. */
function levelsFor(n: number, cur: number) {
  'worklet';
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i <= cur ? 1 : 0, i < cur ? 1 : 0, i === cur ? 1 : 0);
  for (let k = 0; k < n - 1; k++) out.push(k < cur ? 1 : 0);
  return out;
}

export function ProgressSteps({
  steps,
  current,
  onStepPress,
  size = 'md',
  haptics = true,
  activeColor,
  trackColor,
  className,
  labelClassName,
}: ProgressStepsProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size] ?? SIZES.md;
  const labels = typeof steps === 'number' ? null : steps;
  const n = Math.max(2, typeof steps === 'number' ? Math.floor(steps) : steps.length);
  const cur = Math.max(0, Math.min(n, Math.round(current)));

  const fg = useToken('foreground');
  const bg = useToken('background');
  const primary = useToken('primary');
  const ink = useToken('primary-foreground');
  const colors = useMemo(() => {
    const [fr, fgG, fb] = toRGBA(fg);
    const [br, bgG, bb] = toRGBA(bg);
    const dark = 0.2126 * br + 0.7152 * bgG + 0.0722 * bb < 0.5;
    const a = activeColor ?? primary;
    const [ar, ag, ab] = toRGBA(a);
    return {
      active: a,
      ink,
      track: trackColor ?? `rgba(${Math.round(fr * 255)}, ${Math.round(fgG * 255)}, ${Math.round(fb * 255)}, ${dark ? 0.22 : 0.13})`,
      ring: `rgba(${Math.round(ar * 255)}, ${Math.round(ag * 255)}, ${Math.round(ab * 255)}, 0.2)`,
    };
  }, [fg, bg, primary, ink, activeColor, trackColor]);

  const { grid, dot } = useMemo(() => grainGrid(s.disc), [s.disc]);
  const count = grid.length / GF;
  const buf = useMemo(
    () => ({
      grid: makeMutable<number[]>([]),
      draw: makeMutable<number[]>(new Array(MAX_GRAINS * DF).fill(0)),
      from: makeMutable<number[]>(new Array(MAX_GRAINS * DF).fill(0)),
      levels: makeMutable<number[]>([]),
      levelsFrom: makeMutable<number[]>([]),
      xs: makeMutable<number[]>([]),
    }),
    [],
  );
  const [width, setWidth] = useState(0);

  const target = useSharedValue(cur);
  const origin = useSharedValue(cur);
  const req = useSharedValue(0);
  const flying = useSharedValue(0);
  const startAt = useSharedValue(0);
  const nShared = useSharedValue(n);
  /** Bumped once per drawn frame: every style re-reads the buffers when it changes. */
  const painted = useSharedValue(0);

  // Snap to the current step on layout, size or count changes.
  useEffect(() => {
    if (width <= 0) return;
    const col = width / n;
    buf.xs.value = Array.from({ length: n }, (_, i) => (i + 0.5) * col);
    buf.grid.value = grid;
    buf.levels.value = levelsFor(n, target.value);
    buf.levelsFrom.value = buf.levels.value.slice();
    nShared.value = n;
    flying.value = 0;
    req.value = 0;
    painted.value += 1;
  }, [width, n, grid, buf, target, nShared, flying, req, painted]);

  // A new current step from the parent: stream there.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (target.value === cur) return;
    if (haptics) Haptics.selectionAsync();
    target.value = cur;
    req.value = 1;
  }, [cur, haptics, target, req]);

  useFrameCallback((info) => {
    'worklet';
    if (!req.value && !flying.value) return;
    const now = info.timestamp;
    const N = nShared.value;
    const X = buf.xs.value;
    if (X.length !== N) return;
    const G = buf.grid.value;
    const M = G.length / GF;
    const D = buf.draw.value;
    const F = buf.from.value;
    const L = buf.levels.value;
    const LF = buf.levelsFrom.value;
    const b = target.value;

    if (req.value) {
      req.value = 0;
      // Start (or re-aim) from wherever everything is right now.
      for (let i = 0; i < L.length; i++) LF[i] = L[i];
      if (flying.value && !reduced) {
        // Re-aim mid flight: the stream now leaves from the step nearest its cloud.
        for (let i = 0; i < M * DF; i++) F[i] = D[i];
        let cx = 0;
        for (let i = 0; i < M; i++) cx += D[i * DF];
        cx /= Math.max(1, M);
        let near = 0;
        for (let i = 1; i < N; i++) if (Math.abs(X[i] - cx) < Math.abs(X[near] - cx)) near = i;
        origin.value = near;
      } else {
        // The cloud starts on the disc the stream leaves.
        const a0 = origin.value;
        const ax0 = X[Math.min(N - 1, a0)];
        for (let i = 0; i < M; i++) {
          F[i * DF] = ax0 + G[i * GF];
          F[i * DF + 1] = G[i * GF + 1];
          F[i * DF + 2] = a0 < N ? 1 : 0;
          F[i * DF + 3] = 1;
        }
      }
      startAt.value = now;
      flying.value = 1;
    }

    const a = origin.value;
    const ax = X[Math.min(N - 1, a)];
    const bx = X[Math.min(N - 1, b)];
    const hops = Math.max(1, Math.abs(b - a));
    const run = RUN + HOP * (hops - 1);
    const total = STAGGER + run * 1.15 + FADE;
    const since = now - startAt.value;
    const goal = levelsFor(N, b);

    if (reduced || b >= N || a >= N) {
      // Plain: no grains, everything cross fades; all done (b = N) has no disc to stream to.
      const k = FLOW(clamp01(since / PLAIN));
      for (let i = 0; i < L.length; i++) L[i] = LF[i] + (goal[i] - LF[i]) * k;
      for (let i = 0; i < M; i++) D[i * DF + 2] = 0;
      if (since >= PLAIN) {
        flying.value = 0;
        origin.value = b;
      }
      painted.value = now;
      return;
    }

    // The front of the stream, from the old disc to the new one.
    const pk = FLOW(clamp01(since / (STAGGER * 0.5 + run)));
    const front = ax + (bx - ax) * pk;
    const dir = bx >= ax ? 1 : -1;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    // Steps on the way change state as the front crosses them.
    for (let i = 0; i < N; i++) {
      const o = i * SF;
      let k = 1;
      if (i >= lo && i <= hi) {
        const at = Math.abs(X[i] - ax) / (Math.abs(bx - ax) + 1e-3);
        k = clamp01((pk - at * (1 - WINDOW)) / WINDOW);
        // The new disc fills as its grains land.
        if (i === b) k = clamp01((since - (STAGGER * 0.5 + run - LAND)) / LAND);
      }
      for (let f = 0; f < SF; f++) L[o + f] = LF[o + f] + (goal[o + f] - LF[o + f]) * k;
    }
    // Lines between the two discs fill (or empty) right behind the front.
    for (let k = 0; k < N - 1; k++) {
      const o = N * SF + k;
      if (k < lo || k >= hi) {
        L[o] = goal[o];
        continue;
      }
      const x0 = X[k] + s.disc / 2 + GAP;
      const x1 = X[k + 1] - s.disc / 2 - GAP;
      L[o] = clamp01((front - x0) / (x1 - x0 + 1e-3));
    }

    // The grains: the cloud flattens onto the line and streams, leading edge first.
    const out = clamp01((since - (total - FADE)) / FADE);
    for (let i = 0; i < M; i++) {
      const g = i * GF;
      const d = i * DF;
      const u = (G[g] / s.disc + 0.5) * dir;
      const delay = (0.5 - u * 0.5) * STAGGER * 0.6 + G[g + 2] * STAGGER * 0.4;
      const e = FLOW(clamp01((since - delay) / (run * (0.85 + 0.3 * hash(i, 9)))));
      const bump = Math.sin(Math.PI * e);
      const tx = bx + G[g];
      const ty = G[g + 1];
      D[d] = F[d] + (tx - F[d]) * e;
      D[d + 1] = (F[d + 1] + (ty - F[d + 1]) * e) * (1 - FLATTEN * bump) + (G[g + 3] - 0.5) * s.line * bump;
      const a0 = F[d + 2];
      D[d + 2] = (a0 + (1 - a0) * clamp01(since / 60)) * (1 - out);
      D[d + 3] = (F[d + 3] + (1 - F[d + 3]) * e) * (1 - SHRINK * bump);
    }
    if (since >= total) {
      flying.value = 0;
      origin.value = b;
      for (let i = 0; i < M; i++) D[i * DF + 2] = 0;
      for (let i = 0; i < L.length; i++) L[i] = goal[i];
    }
    painted.value = now;
  }, true);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const rowH = s.disc + s.ring * 2;
  const col = width / n;

  return (
    <View onLayout={onLayout} className={cn('self-stretch', className)} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: n, now: cur }}>
      <RNView style={{ height: rowH }}>
        {width > 0 ? (
          <>
            {Array.from({ length: n - 1 }, (_, k) => (
              <Line
                key={`l${k}`}
                k={k}
                n={n}
                x={(k + 0.5) * col + s.disc / 2 + GAP}
                w={col - s.disc - GAP * 2}
                top={rowH / 2 - s.line / 2}
                h={s.line}
                levels={buf.levels}
                painted={painted}
                track={colors.track}
                active={colors.active}
              />
            ))}
            {Array.from({ length: n }, (_, i) => (
              <Step
                key={`s${i}`}
                i={i}
                x={(i + 0.5) * col}
                cy={rowH / 2}
                size={s}
                levels={buf.levels}
                painted={painted}
                colors={colors}
                done={i < cur}
                now={i === cur}
              />
            ))}
            <RNView pointerEvents="none" style={[StyleSheet.absoluteFill, { top: rowH / 2 }]}>
              {Array.from({ length: count }, (_, i) => (
                <Grain key={i} i={i} dot={dot} draw={buf.draw} painted={painted} color={colors.active} />
              ))}
            </RNView>
          </>
        ) : null}
      </RNView>
      {labels || onStepPress ? (
        <RNView style={[{ flexDirection: 'row', marginTop: labels ? 8 : 0 }, labels ? null : StyleSheet.absoluteFill]}>
          {Array.from({ length: n }, (_, i) => (
            <Pressable
              key={i}
              disabled={!onStepPress}
              onPress={() => onStepPress?.(i)}
              accessibilityRole={onStepPress ? 'button' : undefined}
              accessibilityLabel={labels?.[i] ?? `Step ${i + 1}`}
              style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}
            >
              {labels ? (
                <Text
                  numberOfLines={1}
                  className={cn(i <= cur ? 'text-dissolve-foreground' : 'text-dissolve-muted', labelClassName)}
                  style={{ fontSize: s.label, fontWeight: i === cur ? '600' : '500', letterSpacing: -0.1 }}
                >
                  {labels[i]}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </RNView>
      ) : null}
    </View>
  );
}

type SizeSpec = (typeof SIZES)[ProgressStepsSize];
type Colors = { active: string; ink: string; track: string; ring: string };

/** One line between two discs: the empty track and the fill over it, scaled from its left end. */
function Line({ k, n, x, w, top, h, levels, painted, track, active }: { k: number; n: number; x: number; w: number; top: number; h: number; levels: SharedValue<number[]>; painted: SharedValue<number>; track: string; active: string }) {
  const fill = useAnimatedStyle(() => {
    painted.value;
    const v = levels.value[n * SF + k] ?? 0;
    return { transform: [{ scaleX: Math.max(0.0001, v) }] };
  });
  const box = { position: 'absolute' as const, left: x, top, width: Math.max(0, w), height: h, borderRadius: h / 2 };
  return (
    <>
      <RNView style={[box, { backgroundColor: track }]} />
      <Animated.View style={[box, { backgroundColor: active, transformOrigin: 'left' }, fill]} />
    </>
  );
}

/** One step: hollow ring and number under the filled disc, its number or check, and the soft ring. */
function Step({ i, x, cy, size, levels, painted, colors, done, now }: { i: number; x: number; cy: number; size: SizeSpec; levels: SharedValue<number[]>; painted: SharedValue<number>; colors: Colors; done: boolean; now: boolean }) {
  const read = (f: number) => {
    'worklet';
    const v = levels.value[i * SF + f];
    return v === undefined ? (f === 0 ? (done || now ? 1 : 0) : f === 1 ? (done ? 1 : 0) : now ? 1 : 0) : v;
  };
  const fillStyle = useAnimatedStyle(() => {
    painted.value;
    const v = read(0);
    return { opacity: v, transform: [{ scale: 0.6 + 0.4 * v }] };
  });
  const numStyle = useAnimatedStyle(() => {
    painted.value;
    return { opacity: 1 - read(1) };
  });
  const checkStyle = useAnimatedStyle(() => {
    painted.value;
    const v = read(1);
    return { opacity: v, transform: [{ scale: 0.5 + 0.5 * v }, { rotate: '45deg' }] };
  });
  const ringStyle = useAnimatedStyle(() => {
    painted.value;
    const v = read(2);
    return { opacity: v, transform: [{ scale: 0.7 + 0.3 * v }] };
  });
  const d = size.disc;
  const outer = d + size.ring * 2;
  const center = { position: 'absolute' as const, left: x - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: d / 2, alignItems: 'center' as const, justifyContent: 'center' as const };
  const label = String(i + 1);
  const ck = { w: d * 0.2, h: d * 0.38, t: Math.max(1.5, d * 0.08) };
  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: x - outer / 2, top: cy - outer / 2, width: outer, height: outer, borderRadius: outer / 2, backgroundColor: colors.ring }, ringStyle]} />
      <RNView style={[center, { borderWidth: Math.max(1.5, d * 0.07), borderColor: colors.track }]}>
        <Text className="text-dissolve-muted" style={{ fontSize: size.font, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {label}
        </Text>
      </RNView>
      <Animated.View style={[center, { backgroundColor: colors.active }, fillStyle]}>
        <Animated.Text style={[{ position: 'absolute', color: colors.ink, fontSize: size.font, fontWeight: '700', fontVariant: ['tabular-nums'] }, numStyle]}>{label}</Animated.Text>
        <Animated.View
          style={[{ position: 'absolute', top: d * 0.24, width: ck.w, height: ck.h, borderRightWidth: ck.t, borderBottomWidth: ck.t, borderColor: colors.ink }, checkStyle]}
        />
      </Animated.View>
    </>
  );
}

/** One grain: a dot positioned from the shared draw buffer, re-read on every painted frame. */
function Grain({ i, dot, draw, painted, color }: { i: number; dot: number; draw: SharedValue<number[]>; painted: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
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
