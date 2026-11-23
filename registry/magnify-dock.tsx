/**
 * MagnifyDock, from dissolve (dissolve-ui). This file is yours: change the springs, the
 * falloff, the bounce, the icons, anything.
 *
 * The macOS dock. Press and slide a finger along it and the icons swell around it, each on its
 * own spring: the one under the finger is the largest, its neighbours ease up with the distance,
 * and the frosted shelf widens with them so nothing overlaps. Icons grow from the bottom and are
 * vectors drawn by Skia at their size, so they stay crisp magnified. The name of the icon under
 * the finger floats above it, with a tick each time it changes. Lift and the icon under the
 * finger launches: it hops out of the shelf and bounces once like a ball, then a dot lights under
 * it and stays while the app runs (a running app does not bounce again). A plain tap launches too.
 * Reduced motion: no magnification and no bounce; names and dots still show.
 *
 * <MagnifyDock
 *   items={[
 *     { key: 'mail', label: 'Mail', icon: dockIcon('mail') },
 *     { key: 'calendar', label: 'Calendar', icon: dockIcon('calendar') },
 *   ]}
 *   onLaunch={(item) => open(item.key)}
 * />
 *
 * Icons are vector specs on a 100 x 100 grid: dockIcon('finder' | 'mail' | 'music' | 'photos' |
 * 'notes' | 'calendar' | 'settings') gives ready ones (no brand marks), or describe your own
 * (DockIconSpec). It takes its parent's width and reserves the height it needs above the shelf.
 */
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View as RNView, useColorScheme, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Canvas, Circle, Group, LinearGradient, Path, PathOp, Shadow, Skia, Text as SkText, matchFont, vec, type SkPath } from '@shopify/react-native-skia';
import { Text, View, cn } from './tw';

/* ---------- icons: vector specs on a 100 x 100 grid (same as the web version) ---------- */

export type DockPaint = string | { from: string; to: string; angle?: number };
export type DockLayer =
  | { d: string; fill?: DockPaint; stroke?: string; width?: number; opacity?: number }
  | { text: string; x: number; y: number; size: number; weight: number; color: string };
/** An app icon: a squircle tile in `tile`, then layers drawn over it, clipped to the tile. */
export type DockIconSpec = { tile: DockPaint; layers: DockLayer[] };

/** The continuous corner tile (a superellipse, as Apple's icon grid), on 0..100. */
export const SQUIRCLE = (() => {
  const n = 5, pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(`${(50 + 50 * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(2)} ${(50 + 50 * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  const a = (rot * Math.PI) / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${cx - dx} ${cy - dy}A${rx} ${ry} ${rot} 1 0 ${cx + dx} ${cy + dy}A${rx} ${ry} ${rot} 1 0 ${cx - dx} ${cy - dy}Z`;
};
const rrect = (x: number, y: number, w: number, h: number, r: number) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const gear = (cx: number, cy: number, teeth: number, ro: number, ri: number, hole: number) => {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const t = (i / (teeth * 4)) * Math.PI * 2, r = i % 4 < 2 ? ro : ri;
    pts.push(`${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z` + (hole ? ellipse(cx, cy, hole, hole) : '');
};

const TILE = Skia.Path.MakeFromSVGString(SQUIRCLE)!;
/** A fill layer cut to the tile ahead of time: an anti-aliased edge (a clip would be jagged). */
const cut = (d: string): SkPath => {
  const path = Skia.Path.MakeFromSVGString(d)!;
  return Skia.Path.MakeFromOp(path, TILE, PathOp.Intersect) ?? path;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Ready made icons, drawn here (no brand marks). calendar shows today's date. */
export function dockIcon(kind: 'finder' | 'mail' | 'music' | 'photos' | 'notes' | 'calendar' | 'settings', date = new Date()): DockIconSpec {
  switch (kind) {
    case 'finder': return {
      tile: { from: '#EAF3FC', to: '#C9DDF3' },
      layers: [
        { d: 'M0 0H55C47 18 58 30 49 44C44 52 52 58 49 66C47 76 54 86 51 100H0Z', fill: { from: '#6CC4FF', to: '#1F6FE5' } },
        { d: rrect(31, 30, 7, 17, 3.5), fill: '#0B2545' },
        { d: rrect(62, 30, 7, 17, 3.5), fill: '#0B2545' },
        { d: 'M27 66Q50 84 73 66', stroke: '#0B2545', width: 4.5 },
      ],
    };
    case 'mail': return {
      tile: { from: '#5FB8FF', to: '#1C6FEF' },
      layers: [
        { d: rrect(18, 30, 64, 42, 6), fill: '#FFFFFF' },
        { d: 'M21 34L50 55L79 34', stroke: '#8DC3FF', width: 3.5 },
      ],
    };
    case 'music': return {
      tile: { from: '#FF6B86', to: '#F42A47' },
      layers: [
        { d: 'M38 30L72 22V31L38 39Z', fill: '#FFFFFF' },
        { d: 'M38 33H43V67H38ZM67 24H72V60H67Z', fill: '#FFFFFF' },
        { d: ellipse(33, 67, 9.5, 7, -22), fill: '#FFFFFF' },
        { d: ellipse(62, 60, 9.5, 7, -22), fill: '#FFFFFF' },
      ],
    };
    case 'photos': {
      const colors = ['#FF9F0A', '#FFD60A', '#A6D85E', '#34C759', '#5AC8FA', '#5E5CE6', '#BF5AF2', '#FF375F'];
      return {
        tile: { from: '#FFFFFF', to: '#F1F1F4' },
        layers: colors.map((c, i) => {
          const a = (i / 8) * 360 - 90, r = (a * Math.PI) / 180;
          return { d: ellipse(50 + 15 * Math.cos(r), 50 + 15 * Math.sin(r), 17, 9.5, a), fill: c, opacity: 0.82 };
        }),
      };
    }
    case 'notes': return {
      tile: { from: '#FFFFFF', to: '#F4F3EE' },
      layers: [
        { d: 'M0 0H100V27H0Z', fill: { from: '#FFE36E', to: '#FFC900' } },
        ...[45, 57, 69, 81].map((y) => ({ d: `M16 ${y}H84`, stroke: '#D4D4D8', width: 1.8 })),
      ],
    };
    case 'calendar': return {
      tile: { from: '#FFFFFF', to: '#F2F2F5' },
      layers: [
        { text: WEEKDAYS[date.getDay()], x: 50, y: 31, size: 15, weight: 600, color: '#FF3B30' },
        { text: String(date.getDate()), x: 50, y: 80, size: 52, weight: 300, color: '#1C1C1E' },
      ],
    };
    case 'settings': return {
      tile: { from: '#A5A5AB', to: '#66666B' },
      layers: [
        { d: gear(50, 50, 12, 37, 31, 0), fill: { from: '#F2F2F5', to: '#B9B9BF' } },
        { d: ellipse(50, 50, 23, 23), fill: '#55555A' },
        { d: gear(50, 50, 8, 17, 13, 6), fill: { from: '#E8E8EC', to: '#A9A9AF' } },
      ],
    };
  }
}

/* ---------- the dock ---------- */

export type DockItem = { key: string; label: string; icon: DockIconSpec };

export type MagnifyDockProps = {
  items: readonly DockItem[];
  /** Called when an icon launches (a lift, a tap), as it starts to bounce. */
  onLaunch?: (item: DockItem, index: number) => void;
  /** Controlled: keys of the running apps (a dot under each). */
  running?: readonly string[];
  /** Uncontrolled: running at first. Launching adds to it. */
  defaultRunning?: readonly string[];
  /** Icon size at rest, points. Default 56. */
  size?: number;
  /** Size of the icon under the finger, as a multiple. Default 1.9. */
  magnification?: number;
  /** How far the swell reaches, in icons. Default 2.6. */
  reach?: number;
  /** Space between icons. Default 6. */
  gap?: number;
  /** The name above the icon under the finger. Default true. */
  labels?: boolean;
  /** Ticks while sliding, a tap on launch. Default true. */
  haptics?: boolean;
  className?: string;
};

/** Same numbers as the web version. */
const PAD = 7;
const SPRING = { k: 420, c: 36 };
const HOP = 0.62, HOP_S = 0.2, RESTITUTION = 0.36;
const FONT = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });

/** 1 at the finger, 0 from `reach` icons away: a raised cosine. */
function swell(d: number, reach: number) {
  'worklet';
  const a = Math.abs(d);
  return a >= reach ? 0 : (1 + Math.cos((Math.PI * a) / reach)) / 2;
}

const gradient = (p: DockPaint) => {
  if (typeof p === 'string') return null;
  const a = ((p.angle ?? 90) * Math.PI) / 180, x = Math.cos(a) * 50, y = Math.sin(a) * 50;
  return <LinearGradient start={vec(50 - x, 50 - y)} end={vec(50 + x, 50 + y)} colors={[p.from, p.to]} />;
};

/** One icon, drawn once on the 100 grid; its Group scales it to the live size (still vectors). Strokes and text sit inside the tile; fills are cut to it. */
function Icon({ spec, index, layout }: { spec: DockIconSpec; index: number; layout: SharedValue<number[]> }) {
  const transform = useDerivedValue(() => {
    const L = layout.value, s = L[index * 3 + 2] / 100;
    return [{ translateX: L[index * 3] }, { translateY: L[index * 3 + 1] }, { scale: s }];
  });
  const fills = useMemo(() => spec.layers.map((l) => ('d' in l && !l.stroke ? cut(l.d) : null)), [spec]);
  const fonts = useMemo(() => spec.layers.map((l) => ('text' in l ? matchFont({ fontFamily: FONT, fontSize: l.size, fontWeight: String(l.weight) as '300' }) : null)), [spec]);
  return (
    <Group transform={transform}>
      <Path path={TILE} color={typeof spec.tile === 'string' ? spec.tile : undefined}>
        {gradient(spec.tile)}
        <Shadow dx={0} dy={1} blur={1.5} color="rgba(0,0,0,0.18)" />
      </Path>
      <Group>
        {spec.layers.map((l, i) => {
          if ('text' in l) {
            const f = fonts[i]!;
            return <SkText key={i} x={l.x - f.measureText(l.text).width / 2} y={l.y} text={l.text} font={f} color={l.color} />;
          }
          return l.stroke ? (
            <Path key={i} path={l.d} style="stroke" strokeWidth={l.width ?? 2} strokeCap="round" strokeJoin="round" color={l.stroke} opacity={l.opacity ?? 1} />
          ) : (
            <Path key={i} path={fills[i]!} color={typeof l.fill === 'string' ? l.fill : undefined} opacity={l.opacity ?? 1}>
              {l.fill ? gradient(l.fill) : null}
            </Path>
          );
        })}
      </Group>
    </Group>
  );
}

function Dot({ index, layout, on, color }: { index: number; layout: SharedValue<number[]>; on: boolean; color: string }) {
  const cx = useDerivedValue(() => layout.value[index * 3] + layout.value[index * 3 + 2] / 2);
  const cy = useDerivedValue(() => layout.value[layout.value.length - 1] + 3);
  return <Circle cx={cx} cy={cy} r={2} color={color} opacity={on ? 1 : 0} />;
}

export function MagnifyDock({
  items,
  onLaunch,
  running,
  defaultRunning,
  size = 56,
  magnification = 1.9,
  reach = 2.6,
  gap = 6,
  labels = true,
  haptics = true,
  className,
}: MagnifyDockProps) {
  const reduced = useReducedMotion();
  const dark = useColorScheme() === 'dark';
  const n = items.length;
  const [W, setW] = useState(0);
  const H = Math.ceil(size * magnification + size * 0.7 + 44 + PAD);
  const [own, setOwn] = useState<string[]>([...(defaultRunning ?? [])]);
  const [landed, setLanded] = useState<Record<string, boolean>>({});
  const [hoverLabel, setHoverLabel] = useState('');
  const lit = running ?? own;

  const Wv = useSharedValue(0);
  const px = useSharedValue(-1e4);
  const want = useSharedValue(0);
  const engaged = useSharedValue(0);
  const scales = useSharedValue<number[]>(items.map(() => 1));
  const vels = useSharedValue<number[]>(items.map(() => 0));
  const ys = useSharedValue<number[]>(items.map(() => 0));
  const vys = useSharedValue<number[]>(items.map(() => 0));
  /** Per icon: x, y, size, then the shelf's left, width and baseline. */
  const layout = useSharedValue<number[]>([...items.flatMap(() => [0, 0, size]), 0, 0, 0]);
  const hover = useSharedValue(-1);

  /** The pointer-anchored layout (see the web version): the icon under the finger stays under it. */
  const place = () => {
    'worklet';
    const w = Wv.value, cell = size + gap;
    const sizes = scales.value.map((s) => s * size);
    const restLeft = (w - (n * size + (n - 1) * gap)) / 2;
    const a = Math.min(Math.max(px.value, restLeft), restLeft + n * cell - gap);
    const k = Math.min(n - 1, Math.max(0, Math.floor((a - restLeft) / cell)));
    const f = Math.min(1, Math.max(0, (a - restLeft - k * cell) / cell));
    const xs: number[] = new Array(n).fill(0);
    xs[k] = a - f * (sizes[k] + gap);
    for (let i = k - 1; i >= 0; i--) xs[i] = xs[i + 1] - gap - sizes[i];
    for (let i = k + 1; i < n; i++) xs[i] = xs[i - 1] + sizes[i - 1] + gap;
    const base = H - PAD - 6;
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(xs[i], base - sizes[i] + ys.value[i], sizes[i]);
    out.push(xs[0] - PAD, xs[n - 1] + sizes[n - 1] - xs[0] + PAD * 2, base);
    layout.value = out;
  };

  const landedOn = (i: number) => {
    const key = items[i]?.key;
    if (key) setLanded((l) => ({ ...l, [key]: true }));
  };

  useFrameCallback((f) => {
    const dt = Math.min(0.032, (f.timeSincePreviousFrame ?? 16) / 1000);
    engaged.value += (want.value - engaged.value) * Math.min(1, dt * 14);
    const cell = size + gap;
    const restLeft = (Wv.value - (n * size + (n - 1) * gap)) / 2;
    const s = scales.value.slice(), v = vels.value.slice(), y = ys.value.slice(), vy = vys.value.slice();
    let moving = Math.abs(want.value - engaged.value) > 0.001;
    for (let i = 0; i < n; i++) {
      const target = reduced ? 1 : 1 + (magnification - 1) * swell((px.value - (restLeft + i * cell + size / 2)) / cell, reach) * engaged.value;
      for (let h = dt, j = 0; h > 0 && j < 8; h -= 1 / 240, j++) {
        const e = Math.min(h, 1 / 240);
        v[i] += (SPRING.k * (target - s[i]) - SPRING.c * v[i]) * e;
        s[i] += v[i] * e;
      }
      if (Math.abs(target - s[i]) < 0.0005 && Math.abs(v[i]) < 0.005) { s[i] = target; v[i] = 0; } else moving = true;
      if (vy[i] !== 0 || y[i] !== 0) {
        const g = (2 * HOP * size) / (HOP_S * HOP_S);
        vy[i] += g * dt;
        y[i] += vy[i] * dt;
        if (y[i] >= 0) {
          y[i] = 0;
          vy[i] = -vy[i] * RESTITUTION;
          if (Math.abs(vy[i]) < Math.sqrt(2 * g * 0.04 * size)) { vy[i] = 0; scheduleOnRN(landedOn, i); }
        }
        moving = true;
      }
    }
    if (moving) {
      scales.value = s; vels.value = v; ys.value = y; vys.value = vy;
      place();
    }
  });

  const tick = (i: number) => {
    setHoverLabel(i >= 0 ? items[i]?.label ?? '' : '');
    if (haptics && i >= 0) Haptics.selectionAsync();
  };
  useAnimatedReaction(() => hover.value, (now, before) => { if (now !== before) scheduleOnRN(tick, now); });

  const launch = (i: number) => {
    const item = items[i];
    if (!item) return;
    const isRunning = lit.includes(item.key);
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isRunning && !reduced) {
      setLanded((l) => ({ ...l, [item.key]: false }));
      const g = (2 * HOP * size) / (HOP_S * HOP_S);
      const next = vys.value.slice();
      next[i] = -Math.sqrt(2 * g * HOP * size);
      vys.value = next;
      const y = ys.value.slice();
      y[i] = -0.01;
      ys.value = y;
    }
    if (!running && !own.includes(item.key)) setOwn((o) => [...o, item.key]);
    onLaunch?.(item, i);
  };

  /** The icon under the finger: its cell in the rest row (the layout keeps it under the finger). */
  const indexAt = (x: number) => {
    'worklet';
    const restLeft = (Wv.value - (n * size + (n - 1) * gap)) / 2;
    return Math.min(n - 1, Math.max(0, Math.floor((x - restLeft + gap / 2) / (size + gap))));
  };
  const onDock = (x: number, y: number) => {
    'worklet';
    const L = layout.value;
    return x >= L[L.length - 3] - 4 && x <= L[L.length - 3] + L[L.length - 2] + 4 && y >= H - size * magnification - PAD - 24;
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (!onDock(e.x, e.y)) return;
      px.value = e.x;
      want.value = 1;
      hover.value = indexAt(e.x);
    })
    .onUpdate((e) => {
      if (want.value === 0) return;
      px.value = e.x;
      hover.value = indexAt(e.x);
    })
    .onFinalize((e) => {
      if (want.value === 0) return;
      // Lifting launches the icon under the finger.
      if (onDock(e.x, e.y)) scheduleOnRN(launch, indexAt(e.x));
      want.value = 0;
      hover.value = -1;
    });

  const tipStyle = useAnimatedStyle(() => {
    const i = hover.value;
    if (i < 0 || !labels) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const L = layout.value;
    return { opacity: engaged.value > 0.3 ? 1 : 0, transform: [{ translateX: L[i * 3] + L[i * 3 + 2] / 2 - 80 }, { translateY: L[i * 3 + 1] - 34 }] };
  });
  const shelfStyle = useAnimatedStyle(() => {
    const L = layout.value;
    return { left: L[L.length - 3], width: L[L.length - 2] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setW(w);
    Wv.value = w;
    place();
  };

  return (
    <View className={cn(className)} style={{ height: H }} onLayout={onLayout} accessibilityRole="toolbar">
      <GestureDetector gesture={pan}>
        <RNView style={StyleSheet.absoluteFill}>
          {/* The shelf: a frosted material, one soft shadow, the faintest rim. */}
          <Reanimated.View pointerEvents="none" style={[st.shelf, { height: size + PAD + 6, borderRadius: Math.round(size * 0.28 + PAD), boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.14)' }, shelfStyle]}>
            <RNView style={[StyleSheet.absoluteFill, { borderRadius: Math.round(size * 0.28 + PAD), overflow: 'hidden' }]}>
              <BlurView tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} intensity={90} style={StyleSheet.absoluteFill} />
              <RNView style={[StyleSheet.absoluteFill, { borderRadius: Math.round(size * 0.28 + PAD), borderWidth: StyleSheet.hairlineWidth, borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)' }]} />
            </RNView>
          </Reanimated.View>
          {W > 0 ? (
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              {items.map((item, i) => (
                <Icon key={item.key} spec={item.icon} index={i} layout={layout} />
              ))}
              {items.map((item, i) => (
                <Dot key={item.key} index={i} layout={layout} on={lit.includes(item.key) && landed[item.key] !== false} color={dark ? 'rgba(255,255,255,0.75)' : 'rgba(28,28,30,0.7)'} />
              ))}
            </Canvas>
          ) : null}
          <Reanimated.View pointerEvents="none" style={[st.tipBox, tipStyle]}>
            <View style={[st.tip, { backgroundColor: dark ? 'rgba(58,58,62,0.92)' : 'rgba(236,236,238,0.92)' }]}>
              <Text style={[st.tipText, { color: dark ? 'rgb(242,242,247)' : 'rgb(28,28,30)' }]}>{hoverLabel}</Text>
            </View>
          </Reanimated.View>
        </RNView>
      </GestureDetector>
      {/* Screen readers: one button per app at its rest place. */}
      {W > 0
        ? items.map((item, i) => (
            <RNView
              key={item.key}
              accessible
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: lit.includes(item.key) }}
              onAccessibilityTap={() => launch(i)}
              pointerEvents="none"
              style={{ position: 'absolute', left: (W - (n * size + (n - 1) * gap)) / 2 + i * (size + gap), top: H - PAD - 6 - size, width: size, height: size }}
            />
          ))
        : null}
    </View>
  );
}

const st = StyleSheet.create({
  shelf: { position: 'absolute', bottom: 0 },
  tipBox: { position: 'absolute', left: 0, top: 0, width: 160, alignItems: 'center' },
  tip: { height: 24, paddingHorizontal: 10, borderRadius: 7, justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.14)' },
  tipText: { fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },
});
