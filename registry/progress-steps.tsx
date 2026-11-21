/**
 * ProgressSteps, from dissolve (dissolve-ui). This file is yours: change the timings, the grain
 * grid, the sizes, anything. Colors come from the dissolve theme tokens (global.css), so it follows
 * light and dark mode out of the box.
 *
 * Steps for onboarding, checkout or any multi step form, in two looks.
 *
 * variant="numbers" (default): small numbered discs joined by a hairline. Done steps are filled with
 * a check, the current one is filled with a thin ring around it, the next ones are soft and muted.
 * Move forward and the current disc sheds a copy of itself in grains: the cloud flattens
 * onto the line and streams along it, filling the line behind its front, then gathers back into a
 * disc on the new step (about 450 ms, a little longer when it skips steps). Move back and the disc
 * breaks up and streams home the other way, emptying the line.
 *
 * variant="bars": story style segments, one per step, no numbers. Move forward and the fill runs on
 * into the next segment, its head gathering out of grains that drift in and settle; move back and the
 * head recedes, shedding its grains as dust.
 *
 * Selection tick on every change. Reduced motion: the fills slide and the discs cross fade.
 *
 * Built for scroll views: discs, line fills and every grain are plain Animated views moved by
 * transform and opacity only, so it keeps animating while a scroll view is being dragged on iOS.
 *
 * <ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />
 *
 * <ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />
 *
 * <ProgressSteps variant="bars" steps={4} current={story} />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Easing, makeMutable, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, Text, View, cn, useToken } from './tw';
import { clamp01, hash } from './motion';
import { toRGBA } from './dots';

const SIZES = {
  sm: { disc: 18, line: 1.5, font: 10, label: 12, ring: 3, bar: 3, barGap: 4 },
  md: { disc: 22, line: 2, font: 11, label: 13, ring: 3.5, bar: 4, barGap: 5 },
  lg: { disc: 28, line: 2, font: 13, label: 14, ring: 4, bar: 6, barGap: 6 },
} as const;

export type ProgressStepsSize = keyof typeof SIZES;

export type ProgressStepsVariant = 'numbers' | 'bars';

export type ProgressStepsProps = {
  /** 'numbers': numbered discs on a line. 'bars': story style segments, no numbers. Default 'numbers'. */
  variant?: ProgressStepsVariant;
  /** The steps: their labels, or how many there are (no labels then). Two or more. */
  steps: string[] | number;
  /** The current step, from 0. steps.length marks them all done. */
  current: number;
  /** Called with the index of a pressed step. Steps are not pressable without it. */
  onStepPress?: (index: number) => void;
  /** Disc, line and type size (18, 22 or 28 pt discs), or bar thickness (3, 4 or 6 pt). Default 'md'. */
  size?: ProgressStepsSize;
  /** Selection tick on every change of current. Default true. */
  haptics?: boolean;
  /** Fill of the done and current discs, the line and the grains. Default: the primary token. */
  activeColor?: string;
  /** The next steps' discs, the empty line and the empty bars. Default: the foreground token at a low alpha. */
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
const GAP = 6;
/** Width of the ring around the current disc, in points. */
const RING_W = 1.5;
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

export function ProgressSteps({ variant = 'numbers', ...props }: ProgressStepsProps) {
  return variant === 'bars' ? <BarSteps {...props} /> : <NumberSteps {...props} />;
}

function NumberSteps({
  steps,
  current,
  onStepPress,
  size = 'md',
  haptics = true,
  activeColor,
  trackColor,
  className,
  labelClassName,
}: Omit<ProgressStepsProps, 'variant'>) {
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
      track: trackColor ?? `rgba(${Math.round(fr * 255)}, ${Math.round(fgG * 255)}, ${Math.round(fb * 255)}, ${dark ? 0.14 : 0.09})`,
      ring: `rgba(${Math.round(ar * 255)}, ${Math.round(ag * 255)}, ${Math.round(ab * 255)}, 0.35)`,
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
  const rowH = s.disc + (s.ring + RING_W) * 2;
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
                  style={{ fontSize: s.label, fontWeight: i === cur ? '600' : '400', letterSpacing: -0.1 }}
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

/** One step: the soft disc and muted number under the filled disc, its number or check, and the thin ring. */
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
    return { opacity: v, transform: [{ scale: 0.85 + 0.15 * v }] };
  });
  const d = size.disc;
  const outer = d + (size.ring + RING_W) * 2;
  const center = { position: 'absolute' as const, left: x - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: d / 2, alignItems: 'center' as const, justifyContent: 'center' as const };
  const label = String(i + 1);
  const ck = { w: d * 0.2, h: d * 0.38, t: Math.max(1.5, d * 0.075) };
  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: x - outer / 2, top: cy - outer / 2, width: outer, height: outer, borderRadius: outer / 2, borderWidth: RING_W, borderColor: colors.ring }, ringStyle]} />
      <RNView style={[center, { backgroundColor: colors.track }]}>
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

/** Bars: each move runs for BAR_RUN, plus BAR_HOP per extra segment. Dust lives for LIFE. */
const BAR_RUN = 380;
const BAR_HOP = 140;
const LIFE = 360;
const MAX_DUST = 48;

/** Where the head of the fill sits for a fill of p segments (p = 2.5: half way through the third). */
function headX(p: number, seg: number, gap: number, n: number) {
  'worklet';
  if (p <= 0) return 0;
  const k = Math.min(n - 1, Math.floor(p - 1e-6));
  return k * (seg + gap) + clamp01(p - k) * seg;
}

/** Story style segments: the fill runs on through the steps, its head gathering from (or shedding) grains. */
function BarSteps({ steps, current, onStepPress, size = 'md', haptics = true, activeColor, trackColor, className }: Omit<ProgressStepsProps, 'variant'>) {
  const reduced = useReducedMotion();
  const s = SIZES[size] ?? SIZES.md;
  const labels = typeof steps === 'number' ? null : steps;
  const n = Math.max(2, typeof steps === 'number' ? Math.floor(steps) : steps.length);
  const cur = Math.max(0, Math.min(n, Math.round(current)));
  /** Segments are filled through the current step. */
  const fillOf = (c: number) => Math.min(n, c + 1);

  const fg = useToken('foreground');
  const bg = useToken('background');
  const primary = useToken('primary');
  const colors = useMemo(() => {
    const [fr, fgG, fb] = toRGBA(fg);
    const [br, bgG, bb] = toRGBA(bg);
    const dark = 0.2126 * br + 0.7152 * bgG + 0.0722 * bb < 0.5;
    return {
      active: activeColor ?? primary,
      track: trackColor ?? `rgba(${Math.round(fr * 255)}, ${Math.round(fgG * 255)}, ${Math.round(fb * 255)}, ${dark ? 0.2 : 0.12})`,
    };
  }, [fg, bg, primary, activeColor, trackColor]);

  const [width, setWidth] = useState(0);
  const seg = width > 0 ? (width - s.barGap * (n - 1)) / n : 0;
  const dot = Math.max(2, s.bar * 0.85);
  const dust = useMemo(() => makeMutable<number[]>(new Array(MAX_DUST * DF).fill(0)), []);
  const geo = useSharedValue({ seg: 0, gap: s.barGap as number, n, spread: 3 + s.bar * 1.5 });
  const pos = useSharedValue(fillOf(cur));
  const from = useSharedValue(0);
  const to = useSharedValue(fillOf(cur));
  const req = useSharedValue(0);
  const flying = useSharedValue(0);
  const startAt = useSharedValue(0);
  const painted = useSharedValue(0);

  useEffect(() => {
    geo.value = { seg, gap: s.barGap, n, spread: 3 + s.bar * 1.5 };
    flying.value = 0;
    req.value = 0;
    pos.value = to.value;
  }, [seg, s.barGap, s.bar, n, geo, flying, req, pos, to]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = Math.min(n, cur + 1);
    if (to.value === t) return;
    if (haptics) Haptics.selectionAsync();
    to.value = t;
    req.value = 1;
  }, [cur, n, haptics, to, req]);

  useFrameCallback((info) => {
    'worklet';
    if (!req.value && !flying.value) return;
    const now = info.timestamp;
    const g = geo.value;
    if (g.seg <= 0) return;
    if (req.value) {
      req.value = 0;
      from.value = pos.value;
      startAt.value = now;
      flying.value = 1;
    }
    const a = from.value;
    const b = to.value;
    const dur = reduced ? PLAIN : BAR_RUN + BAR_HOP * (Math.max(1, Math.ceil(Math.abs(b - a))) - 1);
    const since = now - startAt.value;
    pos.value = a + (b - a) * FLOW(clamp01(since / dur));
    const D = dust.value;
    const fwd = b >= a;
    // Grains are born at the head all along the move: forward they drift in from ahead and settle
    // into it, backward they come off the receding head and float away.
    for (let i = 0; i < MAX_DUST; i++) {
      const o = i * DF;
      const born = (i / MAX_DUST) * dur;
      const e = (since - born) / LIFE;
      if (reduced || e < 0 || e > 1) {
        D[o + 2] = 0;
        continue;
      }
      const hx = headX(a + (b - a) * FLOW(clamp01(born / dur)), g.seg, g.gap, g.n);
      const h1 = hash(i, 3);
      const h2 = hash(i, 5) - 0.5;
      if (fwd) {
        const k = 1 - FLOW(e);
        D[o] = hx + (3 + h1 * 16) * k;
        D[o + 1] = h2 * 2 * g.spread * k;
        D[o + 2] = Math.min(1, e * 5) * (1 - e * e);
        D[o + 3] = 0.55 + 0.45 * (1 - k);
      } else {
        D[o] = hx + (1 + h1 * 12) * e;
        D[o + 1] = h2 * 2 * g.spread * 1.4 * e - 3 * e * e;
        D[o + 2] = (1 - e) * Math.min(1, e * 8 + 0.4);
        D[o + 3] = 1 - 0.5 * e;
      }
    }
    if (since >= dur + LIFE) {
      flying.value = 0;
      pos.value = b;
      for (let i = 0; i < MAX_DUST; i++) D[i * DF + 2] = 0;
    }
    painted.value = now;
  }, true);

  const hit = Math.max(24, s.bar + 20);
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      className={cn('self-stretch', className)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: n, now: cur, text: labels?.[Math.min(cur, n - 1)] }}
      style={{ height: hit, justifyContent: 'center' }}
    >
      {seg > 0 ? (
        <RNView style={{ height: s.bar }}>
          {Array.from({ length: n }, (_, k) => (
            <Bar key={k} k={k} x={k * (seg + s.barGap)} w={seg} h={s.bar} pos={pos} track={colors.track} active={colors.active} />
          ))}
          <RNView pointerEvents="none" style={[StyleSheet.absoluteFill, { top: s.bar / 2 }]}>
            {Array.from({ length: MAX_DUST }, (_, i) => (
              <Grain key={i} i={i} dot={dot} draw={dust} painted={painted} color={colors.active} />
            ))}
          </RNView>
        </RNView>
      ) : null}
      {onStepPress ? (
        <RNView style={[StyleSheet.absoluteFill, { flexDirection: 'row', gap: s.barGap }]}>
          {Array.from({ length: n }, (_, i) => (
            <Pressable key={i} onPress={() => onStepPress(i)} accessibilityRole="button" accessibilityLabel={labels?.[i] ?? `Step ${i + 1}`} style={{ flex: 1 }} />
          ))}
        </RNView>
      ) : null}
    </View>
  );
}

/** One segment: the empty track and the fill over it, scaled from its left end. */
function Bar({ k, x, w, h, pos, track, active }: { k: number; x: number; w: number; h: number; pos: SharedValue<number>; track: string; active: string }) {
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.0001, clamp01(pos.value - k)) }] }));
  const box = { position: 'absolute' as const, left: x, top: 0, width: w, height: h, borderRadius: h / 2, overflow: 'hidden' as const };
  return (
    <RNView style={[box, { backgroundColor: track }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: active, transformOrigin: 'left' }, fill]} />
    </RNView>
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
