/**
 * BarChart, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the colors, anything. Colors come from the dissolve theme
 * tokens (global.css), so it follows light and dark mode out of the box.
 *
 * A bar chart made of small dots. Each bar is a slightly jittered grid of round dots with a
 * rounded top, stacked segments use the chart tokens (pink, violet, yellow). On mount the dots fly in from below and
 * assemble the bars with a short stagger. Drag across the chart (or press and hold): the bar under
 * the finger stays lit while the others step back, a bubble with the value slides along, a light
 * tick lands on every bar, and the dots near the finger scatter away, then spring back when it
 * moves on or lifts. New data sends the dots of the old bars falling and gathers them into the new
 * ones, so switching Day / Week / Month reads as one motion.
 *
 * Everything moves on the UI thread: one Skia Atlas of a round sprite, its transforms and colors
 * written in place by a frame callback, and the frame loop sleeps once the dots have settled.
 *
 * Pass a stable `data` (memoized or a constant): a new dataset replays the gather.
 *
 * <BarChart data={[{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }]} />
 * <BarChart stacked data={[{ label: 'Mon', values: [42, 18, 6] }]} formatValue={(v) => `${v} €`} />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Atlas, Canvas, FilterMode, MipmapMode, Picture, Skia, createPicture, matchFont, rect, type SkFont } from '@shopify/react-native-skia';
import {
  Easing,
  makeMutable,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
/** Same curve as a plain function, so each dot can be eased inside the frame worklet. */
const EASE = Easing.bezierFn(0.32, 0.72, 0, 1);
/** Enter: dots fly in and assemble the bars. */
const ENTER_MS = 640;
/** Data change: dots fall from the old bars and gather into the new ones. */
const CHANGE_MS = 820;
const REDUCED_MS = 150;
const SPRING = { damping: 22, stiffness: 260, mass: 1 };
/** Room for the bubble above the plot. */
const BUBBLE_LANE = 46;
/** Room for the axis labels on the right of the plot. */
const AXIS = 34;
/** Room above the tallest bar. */
const HEAD = 8;
const DIM = 0.65;
const TICK_GAP = 25;
/** Smallest distance between two dot centers, in points. */
const MIN_PITCH = 4.4;
/** Dot diameter as a share of the pitch. */
const DOT_FILL = 0.7;
/** Largest dot diameter in points (sets the sprite resolution). */
const MAX_DOT = 5;
/** Default dot budget for the whole chart, and the hard capacity of the Atlas. */
const DOTS = 1400;
const CAPACITY = 1600;
/** Finger repulsion: radius, push and the spring that brings the dots back. */
const FLEE = 44;
const PUSH = 20;
const K_SPRING = 260;
const D_SPRING = 24;
/** Per dot plan: x, y, segment, bar, delay. */
const TO = 5;
/** Per dot randoms: depth, spread x, spread y, push, angle, leave delay. */
const RND = 6;

export type BarToken = 'primary' | 'foreground' | 'foreground-2' | 'foreground-3' | 'chart-1' | 'chart-2' | 'chart-3' | 'accent' | 'success' | 'muted' | 'danger';

export type BarDatum = {
  label: string;
  /** Single value. */
  value?: number;
  /** Segments, bottom to top, for `stacked` charts. Summed when not stacked. */
  values?: number[];
};

export type BarChartProps = {
  data: BarDatum[];
  /** Plot height in points (the bubble lane and labels come on top). Default 180. */
  height?: number;
  /** Formats the value shown in the bubble. Default: grouped integer. */
  formatValue?: (value: number) => string;
  /** Formats the axis labels. Default: compact (1.2k, 3M). */
  formatAxis?: (value: number) => string;
  /** Called with the bar under the finger, then with null on release. */
  onSelect?: (index: number | null, datum?: BarDatum) => void;
  /** Draws `values` as stacked segments. */
  stacked?: boolean;
  /** Segment colors as theme tokens, bottom to top. Default ['chart-1', 'chart-2', 'chart-3'] when stacked (pink, violet, yellow), ['primary'] otherwise. */
  colors?: BarToken[];
  /** Rounding of the top of each dot column. Default 6. */
  barRadius?: number;
  /** Space between two bars in points (shrinks on dense charts). Default 6. */
  gap?: number;
  /** Dot budget for the whole chart (the grid gets coarser past it). Default 1400, at most 1600. */
  maxDots?: number;
  /** Shows one label every N bars. Default: all up to 12 bars, then about 6 labels. */
  labelEvery?: number;
  /** Shows the value axis on the right. Default true. */
  axis?: boolean;
  haptics?: boolean;
  /** Root classes (margins, padding...). */
  className?: string;
  /** Bubble classes (background, radius...). */
  bubbleClassName?: string;
};

type Shown = { vals: number[][]; top: number; ticks: number[]; tickText: string[] };
type Plan = { id: number; enter: number; count: number; to: number[] };

const compact = (v: number) => {
  const a = Math.abs(v);
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (a >= 1e6) return `${trim(v / 1e6)}M`;
  if (a >= 1e3) return `${trim(v / 1e3)}k`;
  return trim(v);
};
const grouped = (v: number) => Math.round(v).toLocaleString();

const segmentsOf = (d: BarDatum, stacked: boolean) => {
  const raw = d.values ?? [d.value ?? 0];
  const clean = raw.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  return stacked ? clean : [clean.reduce((a, b) => a + b, 0)];
};
const totalOf = (d: BarDatum) => (d.values ?? [d.value ?? 0]).reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);

function build(data: BarDatum[], stacked: boolean, fmt: (v: number) => string): Shown {
  const vals = data.map((d) => segmentsOf(d, stacked));
  const max = Math.max(0, ...vals.map((s) => s.reduce((a, b) => a + b, 0)));
  if (!max) return { vals, top: 1, ticks: [0], tickText: [fmt(0)] };
  // Three or four round gridlines.
  const raw = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { vals, top, ticks, tickText: ticks.map(fmt) };
}

/** Deterministic 0..1 noise, the same on every run and on the web port. */
const hash = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The dots of every bar: a grid sized to the dot budget, rows stretched to land exactly on the
 * value, a little jitter, the top corners rounded off. Ordered bar by bar, bottom to top, so dot i
 * of one dataset flies to a nearby dot i of the next.
 */
function layoutDots(s: Shown, plotW: number, height: number, gap: number, barRadius: number, budget: number, enter: boolean) {
  const n = s.vals.length;
  const to: number[] = [];
  if (!n || plotW <= 0) return { to, count: 0, dot: 3 };
  const base = height - 1;
  const scale = (height - 1 - HEAD) / s.top;
  const slot = plotW / n;
  const bw = Math.max(1.5, slot - Math.min(gap, slot * 0.4));
  const sums = s.vals.map((seg) => seg.reduce((a, b) => a + b, 0));
  const area = sums.reduce((a, v) => a + v * scale * bw, 0);
  let pitch = Math.max(MIN_PITCH, Math.sqrt(area / budget));
  for (let tries = 0; tries < 12; tries++) {
    to.length = 0;
    const cols = Math.max(bw >= 5.5 ? 2 : 1, Math.round(bw / pitch));
    const cp = bw / cols;
    const dot = Math.min(MAX_DOT, Math.max(1.8, Math.min(cp, pitch) * DOT_FILL));
    const r = Math.min(barRadius, bw / 2);
    let maxRows = 1;
    for (let i = 0; i < n; i++) maxRows = Math.max(maxRows, Math.round((sums[i] * scale) / pitch));
    for (let i = 0; i < n; i++) {
      const h = sums[i] * scale;
      if (h < 1) continue;
      const rows = Math.max(1, Math.round(h / pitch));
      const rp = h / rows;
      const x0 = i * slot + (slot - bw) / 2;
      const yt = base - h;
      const rr = Math.min(r, h / 2);
      const seg = s.vals[i];
      for (let k = 0; k < rows; k++) {
        const y = base - rp * (k + 0.5);
        // Segment of this row, by value from the bottom.
        const v = ((k + 0.5) / rows) * sums[i];
        let acc = 0;
        let sg = 0;
        for (let q = 0; q < seg.length; q++) {
          acc += seg[q];
          sg = q;
          if (v <= acc) break;
        }
        for (let c = 0; c < cols; c++) {
          const x = x0 + cp * (c + 0.5);
          if (y - yt < rr) {
            const ccx = x < x0 + rr ? x0 + rr : x > x0 + bw - rr ? x0 + bw - rr : x;
            const d = Math.hypot(x - ccx, y - (yt + rr));
            if (d + dot / 2 > rr + 0.25) continue;
          }
          const j = to.length / TO;
          const jx = (hash(j, 1) - 0.5) * cp * 0.22;
          const jy = (hash(j, 2) - 0.5) * rp * 0.22;
          const delay = enter ? (i / n) * 300 + (k / maxRows) * 220 + hash(j, 3) * 80 : (i / n) * 260 + hash(j, 3) * 140;
          to.push(x + jx, y + jy, sg, i, delay);
        }
      }
    }
    if (to.length / TO <= budget) return { to, count: to.length / TO, dot };
    pitch *= 1.06;
  }
  to.length = Math.min(to.length, budget * TO);
  return { to, count: to.length / TO, dot: Math.max(1.8, pitch * DOT_FILL) };
}

/** Parses the token strings (rgb(28 28 30), rgb(1, 2, 3), #rrggbb) into 0..1 channels. */
/** Mixes color a toward b by t (0 keeps a), as #rrggbb. */
function mixHex(a: string, b: string, t: number) {
  const x = toRGB(a);
  const y = toRGB(b);
  return '#' + x.map((v, i) => Math.round((v + (y[i] - v) * t) * 255).toString(16).padStart(2, '0')).join('');
}

function toRGB(c: string): [number, number, number] {
  const s = c.trim();
  if (s[0] === '#') {
    const h =
      s.length === 4
        ? s
            .slice(1)
            .split('')
            .map((x) => x + x)
            .join('')
        : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  const m = s.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0.5, 0.5, 0.5];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

/** White antialiased disc of `d` pixels, tinted per dot by the Atlas colors (modulate). */
function makeSprite(d: number) {
  const size = d + 2;
  const surface = Skia.Surface.MakeOffscreen(size, size) ?? Skia.Surface.Make(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color('white'));
  canvas.drawCircle(size / 2, size / 2, d / 2, paint);
  surface.flush();
  const snap = surface.makeImageSnapshot();
  return snap.makeNonTextureImage() ?? snap;
}

function Label({ text, index, pos, scrub }: { text: string; index: number; pos: SharedValue<number>; scrub: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(index - pos.value));
    return { opacity: 1 - scrub.value * 0.5 * (1 - near) };
  });
  return (
    <Animated.View className="flex-1 items-center" style={style}>
      <Text numberOfLines={1} className="text-center text-[11px] font-medium text-dissolve-muted" style={{ width: 48, fontVariant: ['tabular-nums'] }}>
        {text}
      </Text>
    </Animated.View>
  );
}

export function BarChart({
  data,
  height = 180,
  formatValue = grouped,
  formatAxis = compact,
  onSelect,
  stacked = false,
  colors,
  barRadius = 6,
  gap = 6,
  maxDots = DOTS,
  labelEvery,
  axis = true,
  haptics = true,
  className,
  bubbleClassName,
}: BarChartProps) {
  const reduce = useReducedMotion();
  const palette: Record<BarToken, string> = {
    primary: useToken('primary'),
    foreground: useToken('foreground'),
    accent: useToken('accent'),
    success: useToken('success'),
    muted: useToken('muted'),
    danger: useToken('danger'),
    'chart-1': useToken('chart-1'),
    'chart-2': useToken('chart-2'),
    'chart-3': useToken('chart-3'),
    'foreground-2': '',
    'foreground-3': '',
  };
  // Lighter steps of the ink, mixed toward the surface the chart sits on: calm, monochrome stacks.
  const surface = useToken('surface');
  palette['foreground-2'] = mixHex(palette.foreground, surface, 0.5);
  palette['foreground-3'] = mixHex(palette.foreground, surface, 0.74);
  const mutedTone = palette.muted;
  const border = useToken('border');
  const tokens = colors ?? (stacked ? (['chart-1', 'chart-2', 'chart-3'] as BarToken[]) : (['primary'] as BarToken[]));
  const key = tokens.map((t) => palette[t]).join('|');
  const mutedC = useMemo(() => Skia.Color(mutedTone), [mutedTone]);
  const borderC = useMemo(() => Skia.Color(border), [border]);
  const font = useMemo<SkFont>(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }), fontSize: 10, fontWeight: '500' }), []);
  const pr = PixelRatio.get();
  const budget = Math.max(50, Math.min(CAPACITY, Math.round(maxDots)));

  const [W, setW] = useState(0);
  const plotW = Math.max(0, W - (axis ? AXIS : 0));
  const dataKey = JSON.stringify(data);
  const [labels, setLabels] = useState(() => data.map((d) => d.label));

  // Series colors as flat 0..1 channels, read by the frame loop (a theme flip repaints at once).
  const pal = useSharedValue<number[]>([]);
  const palVer = useSharedValue(0);
  useEffect(() => {
    pal.value = key.split('|').flatMap(toRGB);
    palVer.value += 1;
  }, [key, pal, palVer]);

  const [initialShown] = useState(() => build(data, stacked, formatAxis));
  const shown = useSharedValue<Shown>(initialShown);
  const prevShown = useSharedValue<Shown>(initialShown);
  const gridMix = useSharedValue(1);
  const gridIn = useSharedValue(reduce ? 0 : 1);
  const scrub = useSharedValue(0);
  const pos = useSharedValue(0);
  const active = useSharedValue(-1);
  const owner = useSharedValue(0);
  const bubbleX = useSharedValue(0);
  const bubbleW = useSharedValue(0);
  const finger = useSharedValue({ x: 0, y: 0, on: 0 });
  const plan = useSharedValue<Plan>({ id: 0, enter: 1, count: 0, to: [] });

  // Dots: one sprite sized for the pixel ratio, the Atlas buffers and the live state per dot.
  const spritePx = Math.ceil(MAX_DOT * 1.2 * pr);
  const { sprite, sprites, rnd, transforms, tints, pose, from, ctrl, off } = useMemo(
    () => ({
      sprite: makeSprite(spritePx),
      sprites: new Array(CAPACITY).fill(0).map(() => rect(0, 0, spritePx + 2, spritePx + 2)),
      rnd: new Array(CAPACITY * RND).fill(0).map((_, j) => hash(Math.floor(j / RND), 10 + (j % RND))),
      transforms: makeMutable(new Array(CAPACITY).fill(0).map(() => Skia.RSXform(0, 0, -100, -100))),
      tints: makeMutable(new Array(CAPACITY).fill(0).map(() => new Float32Array([1, 1, 1, 0]))),
      // x, y, alpha, diameter, r, g, b
      pose: makeMutable<number[]>(new Array(CAPACITY * 7).fill(0)),
      from: makeMutable<number[]>(new Array(CAPACITY * 7).fill(0)),
      ctrl: makeMutable<number[]>(new Array(CAPACITY * 2).fill(0)),
      // offset x, y and velocity x, y of the finger repulsion
      off: makeMutable<number[]>(new Array(CAPACITY * 4).fill(0)),
    }),
    [spritePx],
  );

  // Layout of the dots: on mount (fly in) and on every new dataset or width (fall and gather).
  const planned = useRef(0);
  const firstData = useRef(true);
  const lastKey = useRef('');
  useEffect(() => {
    if (!plotW) return;
    const k = `${dataKey}|${stacked}|${plotW}|${height}|${gap}|${barRadius}|${budget}`;
    if (k === lastKey.current) return;
    lastKey.current = k;
    const next = build(data, stacked, formatAxis);
    const enter = planned.current === 0;
    const { to, count, dot } = layoutDots(next, plotW, height, gap, barRadius, budget, enter);
    planned.current += 1;
    plan.value = { id: planned.current, enter: enter ? 1 : 0, count, to: [...to, dot] };
    if (firstData.current) {
      firstData.current = false;
      shown.value = next;
      prevShown.value = next;
      if (reduce) gridIn.value = withTiming(1, { duration: REDUCED_MS });
      return;
    }
    prevShown.value = shown.value;
    shown.value = next;
    gridMix.value = 0;
    gridMix.value = withTiming(1, { duration: reduce ? REDUCED_MS : 420, easing: CALM });
    setLabels(data.map((d) => d.label));
    // formatAxis is read with the data, a change of data drives the motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, stacked, plotW, height, gap, barRadius, budget]);

  // Frame loop state (UI thread only).
  const applied = useSharedValue(0);
  const t0 = useSharedValue(0);
  const tEnd = useSharedValue(0);
  const live = useSharedValue(0);
  const sig = useSharedValue({ sc: -1, ps: -1, ver: -1, moving: 1 });

  useFrameCallback((info) => {
    'worklet';
    // Absolute frame time: timeSinceFirstFrame restarts whenever React re-renders the callback.
    const now = info.timestamp;
    const dt = Math.min(1 / 30, (info.timeSincePreviousFrame ?? 16) / 1000);
    const pl = plan.value;
    const P = pose.value;
    const F = from.value;
    const Q = ctrl.value;
    const O = off.value;
    const pc = pal.value;
    const nc = Math.max(1, Math.floor(pc.length / 3));
    const base = height - 1;
    const fresh = applied.value !== pl.id;
    const dur = reduce ? REDUCED_MS : pl.enter ? ENTER_MS : CHANGE_MS;

    if (fresh) {
      if (!pl.id) return;
      const was = live.value;
      const dot = pl.to[pl.count * TO];
      for (let i = 0; i < CAPACITY; i++) {
        const p = i * 7;
        const t = i * TO;
        const q = i * RND;
        for (let c = 0; c < 7; c++) F[p + c] = P[p + c];
        if (i < pl.count) {
          const tx = pl.to[t];
          const ty = pl.to[t + 1];
          const ci = (pl.to[t + 2] % nc) * 3;
          if (pl.enter || i >= was) {
            // Born under the bar, scattered, transparent and small.
            F[p] = tx + (rnd[q + 1] - 0.5) * 44;
            F[p + 1] = base - rnd[q + 2] * 26;
            F[p + 2] = 0;
            F[p + 3] = dot * 0.3;
            F[p + 4] = pc[ci];
            F[p + 5] = pc[ci + 1];
            F[p + 6] = pc[ci + 2];
            Q[i * 2] = (F[p] + tx) / 2 + (rnd[q + 4] - 0.5) * 24;
            Q[i * 2 + 1] = (F[p + 1] + ty) / 2;
          } else {
            // Falls toward the floor on the way to its new bar.
            Q[i * 2] = (F[p] + tx) / 2 + (rnd[q + 1] - 0.5) * 64;
            Q[i * 2 + 1] = Math.min(base - 2, Math.max(F[p + 1], ty) + 30 + rnd[q + 2] * 60);
          }
        } else if (i < was) {
          // Leaves: falls to the floor and fades.
          Q[i * 2] = F[p] + (rnd[q + 1] - 0.5) * 50;
          Q[i * 2 + 1] = Math.min(base - 2, F[p + 1] + 40);
        } else {
          transforms.value[i].set(0, 0, -100, -100);
          tints.value[i][3] = 0;
          P[p + 2] = 0;
        }
        if (reduce) {
          Q[i * 2] = F[p];
          Q[i * 2 + 1] = F[p + 1];
        }
      }
      live.value = Math.max(pl.count, was);
      t0.value = now;
      tEnd.value = now + dur + 600;
      applied.value = pl.id;
    }

    const fx = finger.value.x;
    const fy = finger.value.y;
    const fon = finger.value.on && !reduce ? 1 : 0;
    const sc = scrub.value;
    const ps = pos.value;
    const ver = palVer.value;
    const sg = sig.value;
    if (!fresh && !fon && now > tEnd.value && !sg.moving && sg.sc === sc && sg.ps === ps && sg.ver === ver) {
      if (live.value > pl.count) live.value = pl.count;
      return;
    }

    const T_ = transforms.value;
    const K_ = tints.value;
    const n = live.value;
    const dot = pl.to[pl.count * TO];
    const since = now - t0.value;
    let moving = 0;
    for (let i = 0; i < n; i++) {
      const p = i * 7;
      const t = i * TO;
      const q = i * RND;
      const z = rnd[q];
      const inPlan = i < pl.count;
      // Target pose.
      let tx = 0;
      let ty = 0;
      let ta = 0;
      let ts = dot * 0.3;
      let tr = F[p + 4];
      let tg = F[p + 5];
      let tb = F[p + 6];
      let bar = -9;
      let delay = rnd[q + 5] * 140;
      if (inPlan) {
        tx = pl.to[t];
        ty = pl.to[t + 1];
        const ci = (pl.to[t + 2] % nc) * 3;
        tr = pc[ci];
        tg = pc[ci + 1];
        tb = pc[ci + 2];
        bar = pl.to[t + 3];
        delay = reduce ? 0 : pl.to[t + 4];
        ta = 0.8 + 0.2 * z;
        ts = dot * (0.86 + 0.28 * z);
      } else {
        tx = Q[i * 2];
        ty = base - 2;
      }
      let k = (since - delay) / dur;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const e = k === 1 ? 1 : EASE(k);
      const u = 1 - e;
      const x = u * u * F[p] + 2 * u * e * Q[i * 2] + e * e * tx;
      const y = u * u * F[p + 1] + 2 * u * e * Q[i * 2 + 1] + e * e * ty;
      let a = F[p + 2] + (ta - F[p + 2]) * e;
      if (!pl.enter && e > 0 && e < 1) a *= 1 - 0.35 * Math.sin(Math.PI * e);
      const s = F[p + 3] + (ts - F[p + 3]) * e;
      const r = F[p + 4] + (tr - F[p + 4]) * e;
      const g = F[p + 5] + (tg - F[p + 5]) * e;
      const b = F[p + 6] + (tb - F[p + 6]) * e;
      P[p] = x;
      P[p + 1] = y;
      P[p + 2] = a;
      P[p + 3] = s;
      P[p + 4] = r;
      P[p + 5] = g;
      P[p + 6] = b;

      // Finger repulsion with a little random spread, a spring brings the dot back.
      const o = i * 4;
      let gx = 0;
      let gy = 0;
      if (fon) {
        const dx = x - fx;
        const dy = y - fy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < FLEE) {
          const push = (1 - d / FLEE) * PUSH * (0.6 + 0.8 * rnd[q + 3]);
          const ang = (d > 0.01 ? Math.atan2(dy, dx) : rnd[q + 4] * 6.283) + (rnd[q + 4] - 0.5) * 0.9;
          gx = Math.cos(ang) * push;
          gy = Math.sin(ang) * push;
        }
      }
      O[o + 2] += (K_SPRING * (gx - O[o]) - D_SPRING * O[o + 2]) * dt;
      O[o + 3] += (K_SPRING * (gy - O[o + 1]) - D_SPRING * O[o + 3]) * dt;
      O[o] += O[o + 2] * dt;
      O[o + 1] += O[o + 3] * dt;
      if (Math.abs(O[o]) + Math.abs(O[o + 1]) + Math.abs(O[o + 2]) + Math.abs(O[o + 3]) > 0.05) moving = 1;
      else if (!fon) {
        O[o] = 0;
        O[o + 1] = 0;
        O[o + 2] = 0;
        O[o + 3] = 0;
      }

      // The bars away from the finger step back.
      const near = bar < 0 ? 1 : Math.max(0, 1 - Math.abs(bar - ps));
      const alpha = a * (1 - sc * DIM * (1 - near));
      const m = s / spritePx;
      const half = (m * (spritePx + 2)) / 2;
      T_[i].set(m, 0, x + O[o] - half, y + O[o + 1] - half);
      const cl = K_[i];
      cl[0] = r;
      cl[1] = g;
      cl[2] = b;
      cl[3] = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    }
    sig.value = { sc, ps, ver, moving };
    // Notify the canvas of the in place changes (same trick as Skia's buffer hooks).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (transforms as any)._value = T_;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tints as any)._value = K_;
  });

  // Gridlines, axis labels and the guide above the active bar.
  const picture = useDerivedValue(() => {
    const s = shown.value;
    const s0 = prevShown.value;
    const mix = gridMix.value;
    const sc = scrub.value;
    const ps = pos.value;
    const gi = gridIn.value;
    return createPicture(
      (c) => {
        if (!W || !plotW) return;
        const base = height - 1;
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        const hair = 1 / pr;
        const grid = (g: Shown, alpha: number) => {
          if (alpha <= 0.01) return;
          const scale = (height - 1 - HEAD) / g.top;
          for (let k = 1; k < g.ticks.length; k++) {
            const y = Math.round((base - g.ticks[k] * scale) * pr) / pr;
            paint.setColor(borderC);
            paint.setAlphaf(alpha);
            c.drawRect(Skia.XYWHRect(0, y, plotW, hair), paint);
            if (axis) {
              paint.setColor(mutedC);
              paint.setAlphaf(alpha);
              c.drawText(g.tickText[k], plotW + 6, Math.min(base, Math.max(9, y + 3.5)), paint, font);
            }
          }
          if (axis) {
            paint.setColor(mutedC);
            paint.setAlphaf(alpha);
            c.drawText(g.tickText[0], plotW + 6, base, paint, font);
          }
        };
        grid(s0, (1 - mix) * gi);
        grid(s, mix * gi);
        paint.setColor(borderC);
        paint.setAlphaf(gi);
        c.drawRect(Skia.XYWHRect(0, base, plotW, 1), paint);

        const n = s.vals.length;
        if (sc > 0.01 && n) {
          const scale = (height - 1 - HEAD) / s.top;
          const slot = plotW / n;
          const i0 = Math.max(0, Math.min(n - 1, Math.floor(ps)));
          const i1 = Math.min(n - 1, i0 + 1);
          const f = Math.max(0, Math.min(1, ps - i0));
          let h0 = 0;
          let h1 = 0;
          for (let k = 0; k < s.vals[i0].length; k++) h0 += s.vals[i0][k];
          for (let k = 0; k < s.vals[i1].length; k++) h1 += s.vals[i1][k];
          const h = (h0 * (1 - f) + h1 * f) * scale;
          const cx = ps * slot + slot / 2;
          paint.setColor(mutedC);
          paint.setAlphaf(sc * 0.5);
          c.drawRect(Skia.XYWHRect(Math.round(cx * pr) / pr - 0.5, 0, 1, Math.max(0, base - h - 6)), paint);
        }
      },
      { width: W, height },
    );
  });

  // JS side: bubble content, haptics, callback.
  const [bubble, setBubble] = useState<{ value: string; label: string }>({ value: '', label: '' });
  const lastTick = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onBar = (i: number) => {
    const d = dataRef.current[i];
    if (!d) return;
    setBubble({ value: formatValue(totalOf(d)), label: d.label });
    onSelect?.(i, d);
    if (!haptics) return;
    const now = Date.now();
    if (now - lastTick.current < TICK_GAP) return;
    lastTick.current = now;
    Haptics.selectionAsync();
  };
  const onRelease = () => onSelect?.(null);

  const select = (x: number) => {
    'worklet';
    const n = shown.value.vals.length;
    if (!n || !plotW) return;
    const slot = plotW / n;
    let i = Math.floor(x / slot);
    i = i < 0 ? 0 : i > n - 1 ? n - 1 : i;
    if (i === active.value) return;
    const jump = active.value < 0 && scrub.value < 0.05;
    active.value = i;
    const cx = i * slot + slot / 2;
    if (jump || reduce) {
      pos.value = i;
      bubbleX.value = cx;
    } else {
      pos.value = withSpring(i, SPRING);
      bubbleX.value = withSpring(cx, SPRING);
    }
    scheduleOnRN(onBar, i);
  };
  const scrubbing = (id: number, g: ReturnType<typeof Gesture.Pan>) =>
    g
      .onStart((e) => {
        owner.value = id;
        active.value = -1;
        finger.value = { x: e.x, y: e.y, on: 1 };
        select(e.x);
        scrub.value = withTiming(1, { duration: reduce ? 150 : 160, easing: CALM });
      })
      .onUpdate((e) => {
        if (owner.value !== id) return;
        finger.value = { x: e.x, y: e.y, on: 1 };
        select(e.x);
      })
      .onFinalize(() => {
        if (owner.value !== id) return;
        owner.value = 0;
        active.value = -1;
        finger.value = { x: finger.value.x, y: finger.value.y, on: 0 };
        scrub.value = withTiming(0, { duration: reduce ? 150 : 250, easing: CALM });
        scheduleOnRN(onRelease);
      });
  // Horizontal drag scrubs right away, a press and hold works too (vertical scroll stays free).
  const gesture = Gesture.Race(
    scrubbing(1, Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-10, 10])),
    scrubbing(2, Gesture.Pan().activateAfterLongPress(120)),
  );

  const bubbleStyle = useAnimatedStyle(() => {
    const w = bubbleW.value;
    const x = Math.min(Math.max(0, bubbleX.value - w / 2), Math.max(0, W - w));
    return {
      opacity: scrub.value,
      transform: [{ translateX: x }, { translateY: (1 - scrub.value) * 4 }, { scale: 0.92 + 0.08 * scrub.value }],
    };
  });

  const every = labelEvery ?? (labels.length <= 12 ? 1 : Math.ceil(labels.length / 6));
  const summary = data.map((d) => `${d.label} ${formatValue(totalOf(d))}`).join(', ');

  return (
    <View className={cn('w-full', className)} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <View style={{ height: BUBBLE_LANE }} pointerEvents="none">
        <Animated.View
          onLayout={(e: LayoutChangeEvent) => {
            bubbleW.value = e.nativeEvent.layout.width;
          }}
          className={cn('absolute left-0 top-0 items-center rounded-[12px] bg-dissolve-primary px-[10px] py-[5px]', bubbleClassName)}
          style={bubbleStyle}
        >
          <Text className="text-[15px] font-semibold text-dissolve-primary-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {bubble.value}
          </Text>
          <Text className="text-[11px] font-medium text-dissolve-primary-foreground opacity-70">{bubble.label}</Text>
        </Animated.View>
      </View>
      <GestureDetector gesture={gesture}>
        <View style={{ height }} accessible accessibilityRole="image" accessibilityLabel={summary}>
          {W ? (
            <Canvas style={{ width: W, height }} pointerEvents="none">
              <Picture picture={picture} />
              {sprite ? (
                <Atlas image={sprite} sprites={sprites} transforms={transforms} colors={tints} colorBlendMode="modulate" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} />
              ) : null}
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      <View className="mt-[8px] flex-row" style={{ width: plotW || undefined }}>
        {labels.map((l, i) => (
          <Label key={`${labels.length}-${i}`} text={i % every === 0 ? l : ''} index={i} pos={pos} scrub={scrub} />
        ))}
      </View>
    </View>
  );
}
