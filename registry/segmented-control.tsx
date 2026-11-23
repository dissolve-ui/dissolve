/**
 * SegmentedControl, from dissolve (dissolve-ui). This file is yours: change the timings,
 * the grain grid, the sizes, anything. Colors come from the dissolve theme tokens (global.css), so
 * it follows light and dark mode out of the box.
 *
 * An iOS style segmented control whose selection pill is made of grains. At rest it is a clean
 * solid capsule with the soft iOS shadow. Pick another segment and the pill breaks into grains,
 * leading edge first: they flow to the new segment on a slight arc, shrinking mid flight, and
 * reassemble into the pill there (about 400 ms). The labels cross fade, selected to unselected,
 * along the way. Drag the finger across the control and the selection follows it, the grains
 * re-aiming from wherever they are. Selection tick on every change. Reduced motion: the pill
 * simply slides.
 *
 * Built for scroll views: the pill and every grain are plain Animated views moved by transform and
 * opacity only, so it keeps animating while a scroll view is being dragged on iOS (Skia and
 * animated layout props hold still then).
 *
 * <SegmentedControl segments={['Day', 'Week', 'Month', 'Year']} value={period} onChange={setPeriod} />
 *
 * <SegmentedControl segments={['Inbox', 'Archive']} defaultValue="Inbox" size="sm" className="w-56 self-center" />
 *
 * <SegmentedControl
 *   segments={[
 *     { value: 'list', label: 'List', icon: ({ color, size }) => <ListIcon color={color} size={size} /> },
 *     { value: 'grid', label: 'Grid', icon: ({ color, size }) => <GridIcon color={color} size={size} /> },
 *   ]}
 *   value={layout}
 *   onChange={(v) => setLayout(v)}
 * />
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View as RNView, type BoxShadowValue, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, makeMutable, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';
import { CALM_FN, clamp01, hash } from './motion';
import { toRGBA } from './dots';

export type SegmentItem = {
  /** Value passed to onChange and matched against value / defaultValue. */
  value: string;
  /** Shown text. Default: the value. */
  label?: string;
  /** Leading icon: a node, or a function that gets the label color and the icon size. */
  icon?: ReactNode | ((p: { color: string; size: number; selected: boolean }) => ReactNode);
};

const SIZES = {
  sm: { height: 30, inset: 2, font: 13, icon: 13, gap: 5 },
  md: { height: 36, inset: 3, font: 14, icon: 15, gap: 6 },
  lg: { height: 44, inset: 4, font: 15, icon: 17, gap: 7 },
} as const;

export type SegmentedControlSize = keyof typeof SIZES;

export type SegmentedControlProps = {
  /** The segments: plain strings, or items with a value, a label and an icon. Two or more. */
  segments: (string | SegmentItem)[];
  /** Selected value (controlled). */
  value?: string;
  /** Initial value when uncontrolled. Default: the first segment. */
  defaultValue?: string;
  /** Called on every selection change, also while dragging across the segments. */
  onChange?: (value: string, index: number) => void;
  /** Height, inset and type size: 30, 36 or 44 pt. Default 'md'. */
  size?: SegmentedControlSize;
  /** Selection tick on every change. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Track fill. Default: the foreground token at a low alpha, so it sits on any background. */
  trackColor?: string;
  /** Pill and grain color. Default: the background token in light mode, a lifted gray in dark mode. */
  indicatorColor?: string;
  /** Track classes (width, margins, self alignment...). It stretches to its parent by default. */
  className?: string;
  /** Label classes (tracking, font...). The colors come from the theme tokens. */
  labelClassName?: string;
};

/** Grains leave over STAGGER (leading edge first), each flies for RUN. */
const STAGGER = 110;
const RUN = 290;
/** The old pill fades under the grains as they break off. */
const GHOST_OUT = 90;
/** The new pill fades in under the grains as they land, then the grains fade off it. */
const PILL_AT = 280;
const PILL_IN = 100;
const FADE_AT = 340;
const FADE = 80;
const LABELS = 360;
const END = FADE_AT + FADE;
/** Reduced motion: a plain slide. */
const SLIDE = 260;
/** Mid flight, grains shrink to this share of their size. */
const SHRINK = 0.55;
/** Sideways scatter of a grain mid flight, in points. */
const SCATTER = 8;
/** Grain pool, and the grid pitch as a share of the pill height. */
const MAX_GRAINS = 180;
const PITCH = 0.14;
/** Grains overlap their neighbours at rest, so the cloud reads as one solid pill. */
const OVERLAP = 1.22;
/** Per grain grid: x y (from the pill's left top), arc, delay seed. */
const GF = 4;
/** Per grain live draw: x y alpha scale. */
const DF = 4;

/** Leaves fast, lands soft: grains break off with a little intent instead of jumping. */
const FLOW = Easing.bezierFn(0.42, 0, 0.12, 1);

const norm = (s: string | SegmentItem): SegmentItem => (typeof s === 'string' ? { value: s } : s);

/** Grid points inside the pill capsule, row by row. */
function grainGrid(w: number, h: number) {
  let pitch = Math.max(4, h * PITCH);
  for (;;) {
    const cols = Math.max(2, Math.round(w / pitch));
    const rows = Math.max(2, Math.round(h / pitch));
    const px = w / cols;
    const py = h / rows;
    const r = h / 2;
    const out: number[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * px;
        const y = (j + 0.5) * py;
        // Inside the capsule, a little in from its rounded ends.
        const dx = Math.max(0, Math.abs(x - w / 2) - (w / 2 - r));
        const dy = y - r;
        if (dx * dx + dy * dy > (r - Math.min(px, py) * 0.3) ** 2) continue;
        const k = out.length / GF;
        // Top rows arc up, bottom rows down: the cloud breathes open in flight, then closes.
        const arc = ((y - r) / r) * 0.8 + (hash(k, 3) - 0.5) * 0.7;
        out.push(x, y, arc, hash(k, 4));
      }
    }
    if (out.length / GF <= MAX_GRAINS) return { grid: out, dot: Math.max(px, py) * OVERLAP };
    pitch *= 1.15;
  }
}

export function SegmentedControl({
  segments,
  value,
  defaultValue,
  onChange,
  size = 'md',
  haptics = true,
  disabled = false,
  trackColor,
  indicatorColor,
  className,
  labelClassName,
}: SegmentedControlProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size];
  const items = useMemo(() => segments.map(norm), [segments]);
  const n = Math.max(1, items.length);
  const indexOf = (v: string | undefined) => {
    const i = items.findIndex((it) => it.value === v);
    return i < 0 ? 0 : i;
  };

  const [inner, setInner] = useState(() => indexOf(defaultValue));
  const controlled = value !== undefined;
  const selected = controlled ? indexOf(value) : Math.min(inner, n - 1);

  // Colors: a translucent track that sits on any background, a solid pill lifted off it.
  const fg = useToken('foreground');
  const bg = useToken('background');
  const colors = useMemo(() => {
    const [fr, fgG, fb] = toRGBA(fg);
    const [br, bgG, bb] = toRGBA(bg);
    const dark = 0.2126 * br + 0.7152 * bgG + 0.0722 * bb < 0.5;
    const mix = (k: number) => `rgb(${[br + (fr - br) * k, bgG + (fgG - bgG) * k, bb + (fb - bb) * k].map((c) => Math.round(c * 255)).join(', ')})`;
    return {
      dark,
      track: trackColor ?? `rgba(${Math.round(fr * 255)}, ${Math.round(fgG * 255)}, ${Math.round(fb * 255)}, ${dark ? 0.14 : 0.075})`,
      pill: indicatorColor ?? (dark ? mix(0.3) : mix(0)),
    };
  }, [fg, bg, trackColor, indicatorColor]);

  const { grid, draw, from, labels, labelFrom } = useMemo(
    () => ({
      grid: makeMutable<number[]>([]),
      draw: makeMutable<number[]>(new Array(MAX_GRAINS * DF).fill(0)),
      /** Per grain at the start of the flight: x y alpha scale. */
      from: makeMutable<number[]>(new Array(MAX_GRAINS * DF).fill(0)),
      labels: makeMutable<number[]>([]),
      labelFrom: makeMutable<number[]>([]),
    }),
    [],
  );
  const [geo, setGeo] = useState({ seg: 0, pillH: 0, dot: 0, count: 0 });
  /**
   * The resting pill of the first frames: a plain view placed by flex slots, so it is right on
   * the very first frame, before onLayout has measured anything and before the animated pill's
   * values have reached the UI thread. It hands over to the animated pill when the first flight
   * starts (on the UI thread, in the same frame), and never animates itself.
   */
  const [restAt] = useState(selected);
  const restA = useSharedValue(1);

  /** Pill geometry on the UI thread. */
  const segW = useSharedValue(0);
  const inset = useSharedValue<number>(s.inset);
  const count = useSharedValue(0);
  /** Selection: where the pill is going. */
  const target = useSharedValue(selected);
  const req = useSharedValue(0);
  const flying = useSharedValue(0);
  const startAt = useSharedValue(0);
  const pillX = useSharedValue(0);
  const pillA = useSharedValue(0);
  const ghostX = useSharedValue(0);
  const ghostA = useSharedValue(0);
  const ghostA0 = useSharedValue(0);
  const slideFrom = useSharedValue(0);
  /** Bumped once per drawn frame: the grain and label styles re-read their buffers when it changes. */
  const painted = useSharedValue(0);

  useEffect(() => {
    inset.value = s.inset;
  }, [inset, s.inset]);

  // A new value from the parent (or the first one): fly there.
  useEffect(() => {
    if (target.value === selected) return;
    target.value = selected;
    req.value = 1;
  }, [selected, target, req]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const seg = (width - s.inset * 2) / n;
    const pillH = height - s.inset * 2;
    if (seg <= 0 || pillH <= 0) return;
    const { grid: g, dot } = grainGrid(seg, pillH);
    grid.value = g;
    const L = new Array(n).fill(0);
    L[target.value] = 1;
    labels.value = L;
    labelFrom.value = L.slice();
    segW.value = seg;
    count.value = g.length / GF;
    // Snap: no flight on first layout or a resize. A selection made before the first layout lands
    // here too: the resting pill only knows the first index, so the animated pill takes over.
    if (target.value !== restAt) restA.value = 0;
    flying.value = 0;
    req.value = 0;
    pillX.value = s.inset + target.value * seg;
    // While the resting pill shows, the animated one stays clear, so the shadow is not doubled.
    pillA.value = restA.value > 0 ? 0 : 1;
    ghostA.value = 0;
    painted.value += 1;
    setGeo({ seg, pillH, dot, count: g.length / GF });
  };

  useFrameCallback((info) => {
    'worklet';
    // Idle: the loop stays registered but does nothing, so a selection starts on the next frame.
    if (!req.value && !flying.value) return;
    const now = info.timestamp;
    const W = segW.value;
    if (W <= 0) return;
    const G = grid.value;
    const N = count.value;
    const D = draw.value;
    const F = from.value;
    const L = labels.value;
    const LF = labelFrom.value;
    const inv = inset.value;
    const b = target.value;
    const toX = inv + b * W;

    if (req.value) {
      req.value = 0;
      // Start (or re-aim) the flight from wherever everything is right now.
      for (let i = 0; i < L.length; i++) LF[i] = L[i];
      // The resting pill hands over: the ghost (same place, same look) takes its opacity.
      const rest = restA.value;
      restA.value = 0;
      if (flying.value && !reduced) {
        for (let i = 0; i < N * DF; i++) F[i] = D[i];
        ghostX.value = pillX.value;
        ghostA0.value = pillA.value;
      } else {
        const ox = pillX.value;
        for (let i = 0; i < N; i++) {
          F[i * DF] = ox + G[i * GF];
          F[i * DF + 1] = inv + G[i * GF + 1];
          F[i * DF + 2] = 1;
          F[i * DF + 3] = 1;
        }
        ghostX.value = ox;
        ghostA0.value = Math.max(pillA.value, rest);
      }
      slideFrom.value = pillX.value;
      startAt.value = now;
      flying.value = 1;
      if (!reduced) {
        pillX.value = toX;
        pillA.value = 0;
      }
    }

    const since = now - startAt.value;
    const lk = FLOW(clamp01(since / (reduced ? SLIDE : LABELS)));
    for (let i = 0; i < L.length; i++) L[i] = LF[i] + ((i === b ? 1 : 0) - LF[i]) * lk;

    if (reduced) {
      const k = CALM_FN(clamp01(since / SLIDE));
      pillX.value = slideFrom.value + (toX - slideFrom.value) * k;
      pillA.value = 1;
      ghostA.value = 0;
      if (since >= SLIDE) flying.value = 0;
      painted.value = now;
      return;
    }

    // Leading edge first: the grains at the front of the pill (in the travel direction) leave first.
    const dir = toX >= ghostX.value ? 1 : -1;
    const dist = Math.abs(toX - ghostX.value);
    const reach = Math.min(1, dist / W);
    const arcAmp = arcOf(W) * (0.55 + 0.45 * reach);
    const out = clamp01((since - FADE_AT) / FADE);
    for (let i = 0; i < N; i++) {
      const g = i * GF;
      const d = i * DF;
      const u = G[g] / W;
      const lead = dir > 0 ? u : 1 - u;
      const delay = (1 - lead) * STAGGER * 0.6 + G[g + 3] * STAGGER * 0.4;
      const run = RUN * (0.85 + 0.3 * hash(i, 9));
      const t = clamp01((since - delay) / run);
      const e = FLOW(t);
      const bump = Math.sin(Math.PI * e);
      const tx = toX + G[g];
      const ty = inv + G[g + 1];
      // A little sideways scatter mid flight, so the grains never read as a moving lattice.
      D[d] = F[d] + (tx - F[d]) * e + (hash(i, 5) - 0.5) * SCATTER * bump;
      D[d + 1] = F[d + 1] + (ty - F[d + 1]) * e + G[g + 2] * arcAmp * bump;
      const a0 = F[d + 2];
      D[d + 2] = (a0 + (1 - a0) * clamp01(since / 60)) * (1 - out);
      D[d + 3] = (F[d + 3] + (1 - F[d + 3]) * e) * (1 - SHRINK * bump);
    }
    ghostA.value = ghostA0.value * (1 - clamp01(since / GHOST_OUT));
    pillA.value = clamp01((since - PILL_AT) / PILL_IN);
    if (since >= END) {
      flying.value = 0;
      for (let i = 0; i < N; i++) D[i * DF + 2] = 0;
      pillA.value = 1;
      ghostA.value = 0;
    }
    painted.value = now;
  }, true);

  // UI thread selection (tap or drag): fly right away, tell React after.
  const commit = (i: number) => {
    if (haptics) Haptics.selectionAsync();
    if (!controlled) setInner(i);
    const it = items[i];
    if (it) onChange?.(it.value, i);
  };
  const pick = (x: number) => {
    'worklet';
    const W = segW.value;
    if (W <= 0) return;
    const i = Math.max(0, Math.min(n - 1, Math.floor((x - inset.value) / W)));
    if (i === target.value) return;
    target.value = i;
    req.value = 1;
    scheduleOnRN(commit, i);
  };

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(12)
    .onEnd((e, ok) => {
      if (ok) pick(e.x);
    });
  // Horizontal drags only, so a vertical swipe still scrolls the page.
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      pick(e.x);
    });
  const gesture = Gesture.Race(pan, tap);

  const pillStyle = useAnimatedStyle(() => ({ opacity: pillA.value, transform: [{ translateX: pillX.value }] }));
  const ghostStyle = useAnimatedStyle(() => ({ opacity: ghostA.value, transform: [{ translateX: ghostX.value }] }));
  const restStyle = useAnimatedStyle(() => ({ opacity: restA.value }));

  const restH = s.height - s.inset * 2;
  const radius = geo.pillH / 2;
  const shadow: BoxShadowValue[] = colors.dark
    ? []
    : [
        { offsetX: 0, offsetY: 3, blurRadius: 8, color: 'rgba(0, 0, 0, 0.12)' },
        { offsetX: 0, offsetY: 1, blurRadius: 1, color: 'rgba(0, 0, 0, 0.04)' },
        { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 0.5, color: 'rgba(0, 0, 0, 0.04)' },
      ];
  const pillBox = { position: 'absolute' as const, left: 0, top: s.inset, width: geo.seg, height: geo.pillH, borderRadius: radius, borderCurve: 'continuous' as const, backgroundColor: colors.pill, boxShadow: shadow };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={onLayout}
        accessibilityRole="tablist"
        className={cn('self-stretch', className)}
        style={{ height: s.height, borderRadius: s.height / 2, borderCurve: 'continuous', backgroundColor: colors.track, opacity: disabled ? 0.5 : 1 }}
      >
        {/* First frame: the pill from flex slots, one per segment, no measure, no animation. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row', padding: s.inset }, restStyle]}>
          {items.map((it, i) => (
            <RNView
              key={it.value}
              style={
                i === Math.min(restAt, n - 1)
                  ? { flex: 1, height: restH, borderRadius: restH / 2, borderCurve: 'continuous', backgroundColor: colors.pill, boxShadow: shadow }
                  : { flex: 1 }
              }
            />
          ))}
        </Animated.View>
        {geo.seg > 0 ? (
          <RNView pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View style={[pillBox, ghostStyle]} />
            <Animated.View style={[pillBox, pillStyle]} />
            {Array.from({ length: geo.count }, (_, i) => (
              <Grain key={i} i={i} dot={geo.dot} draw={draw} painted={painted} color={colors.pill} />
            ))}
          </RNView>
        ) : null}
        <View pointerEvents="box-none" style={{ flexDirection: 'row', flex: 1, paddingHorizontal: s.inset }}>
          {items.map((it, i) => (
            <Segment
              key={it.value}
              item={it}
              i={i}
              selected={i === selected}
              labels={labels}
              painted={painted}
              size={s}
              labelClassName={labelClassName}
              onPress={() => {
                if (disabled || i === target.value) return;
                target.value = i;
                req.value = 1;
                commit(i);
              }}
            />
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Arc height in points for a pill segment of width w: grains bow out a little more on longer trips. */
function arcOf(w: number) {
  'worklet';
  return Math.min(7, 3 + w * 0.03);
}

type SizeSpec = (typeof SIZES)[SegmentedControlSize];

/** One segment: the unselected label under the selected one, cross faded by the labels buffer. */
function Segment({
  item,
  i,
  selected,
  labels,
  painted,
  size,
  labelClassName,
  onPress,
}: {
  item: SegmentItem;
  i: number;
  selected: boolean;
  labels: SharedValue<number[]>;
  painted: SharedValue<number>;
  size: SizeSpec;
  labelClassName?: string;
  onPress: () => void;
}) {
  const on = useAnimatedStyle(() => {
    painted.value;
    const v = labels.value[i];
    return { opacity: v === undefined ? (selected ? 1 : 0) : v };
  });
  const off = useAnimatedStyle(() => {
    painted.value;
    const v = labels.value[i];
    return { opacity: 1 - (v === undefined ? (selected ? 1 : 0) : v) };
  });
  const fg = useToken('foreground');
  const muted = useToken('muted');
  const label = item.label ?? item.value;
  const layer = (color: string, weight: '500' | '600', textClass: string, isOn: boolean) => {
    const glyph = typeof item.icon === 'function' ? item.icon({ color, size: size.icon, selected: isOn }) : item.icon;
    return (
      <>
        {glyph}
        {label ? (
          <Text className={cn(textClass, labelClassName)} style={{ fontSize: size.font, fontWeight: weight, letterSpacing: -0.15 }} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </>
    );
  };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: size.gap, paddingHorizontal: 8 };
  return (
    <View
      accessible
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onAccessibilityTap={onPress}
      style={{ flex: 1, justifyContent: 'center' }}
    >
      <Animated.View style={[row, off]}>{layer(muted, '500', 'text-dissolve-muted', false)}</Animated.View>
      <Animated.View style={[row, StyleSheet.absoluteFill, on]}>{layer(fg, '600', 'text-dissolve-foreground', true)}</Animated.View>
    </View>
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
