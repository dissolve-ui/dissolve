/**
 * ReorderList, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the grains, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * A list you reorder by drag, like Reminders or Things. Long press a row (or grab its handle): it
 * lifts with a medium tick, grows a shadow, leans a little with the finger's sideways speed and
 * follows it 1:1. The other rows slide out of the way on the calm curve, with a selection tick
 * each time the target slot changes, and the list scrolls by itself near the top and bottom edges.
 * Release: the row settles into its slot (critically damped), a light tick, then onReorder runs.
 * A faint trail of grains stays at the slot it left, and a small puff marks the edges of the one
 * it lands in. With onDelete, drag a row far to the side and release: it turns to dust.
 *
 * Everything moves on the UI thread: rows are absolutely positioned from measured heights, so
 * React never re-renders per frame, and the new order is already on screen when your data
 * catches up. Rows can have different heights. Space them with `gap`, not vertical margins.
 *
 * <ReorderList
 *   data={tasks}
 *   keyExtractor={(t) => t.id}
 *   renderItem={({ item }) => <TaskRow task={item} />}
 *   onReorder={(next) => setTasks(next)}
 *   itemClassName="rounded-2xl bg-dissolve-surface"
 *   gap={8}
 * />
 */
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PixelRatio, StyleSheet, View as RNView, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Atlas, Canvas, FilterMode, MipmapMode, Skia, makeImageFromView, rect } from '@shopify/react-native-skia';
import Reanimated, {
  Easing,
  makeMutable,
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { frames, runDissolve, useDissolveContext, type DissolveCtx, type VariantName } from 'react-native-dissolve';
import { View, cn, useToken } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
/** Rows making room. */
const SLIDE_MS = 300;
/** Critically damped (damping = 2 * sqrt(stiffness * mass)): lands without overshoot. */
const SETTLE = { stiffness: 420, damping: 41, mass: 1 };
const LIFT_SCALE = 0.03;
/** Lean of the lifted row, in degrees, at full sideways speed. */
const MAX_TILT = 3;
/** Auto scroll: band at the top and bottom of the list, and top speed in pt/s. */
const EDGE = 72;
const MAX_SPEED = 900;
/** With onDelete: fraction of the width to drag sideways before a release deletes. */
const DELETE_AT = 0.42;
/** Grain pool. Per grain: x, y, vx, vy, born, life, size, alpha, delay. */
const GRAINS = 72;
const GF = 9;
/** Largest grain diameter in points (sets the sprite resolution). */
const GRAIN_MAX = 3;

const IDLE = 0;
const DRAG = 1;
const DROP = 2;
const DELETE = 3;
const GONE = 4;
const COMMIT = 5;

export type ReorderListRenderInfo<T> = { item: T; index: number; dragging: boolean };

export type ReorderListProps<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (info: ReorderListRenderInfo<T>) => ReactNode;
  /** Called once the dropped row has settled, with the reordered copy of `data`. */
  onReorder: (data: T[], from: number, to: number) => void;
  /** Enables drag far to the side to delete: the row turns to dust, then this runs. Needs DissolveProvider. */
  onDelete?: (item: T, index: number) => void;
  /** Exit used by onDelete. Default 'dust'. */
  preset?: VariantName;
  /** Hold before a row lifts, ms. Default 250. */
  longPressDelay?: number;
  /** Drag only from a <ReorderHandle> inside the row, which lifts at once. Default false: long press anywhere. */
  handle?: boolean;
  /** Space between rows, pt. Default 0. */
  gap?: number;
  haptics?: boolean;
  /** Trail and puff of grains. Off with reduced motion. Default true. */
  grains?: boolean;
  /** Scrolls above and below the rows. */
  header?: ReactNode;
  footer?: ReactNode;
  /** Root classes (flex-1 by default: give the list a height). */
  className?: string;
  /** Scroll content padding and the like. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Row surface classes (background, radius...). Default bg-dissolve-background. */
  itemClassName?: string;
};

type Layout = { base: Record<string, number>; tops: Record<string, number>; total: number };

type ListCtx = {
  order: SharedValue<string[]>;
  heights: SharedValue<Record<string, number>>;
  layout: SharedValue<Layout>;
  active: SharedValue<string>;
  phase: SharedValue<number>;
  dragTop: SharedValue<number>;
  dragX: SharedValue<number>;
  lift: SharedValue<number>;
  tilt: SharedValue<number>;
  width: SharedValue<number>;
  canDelete: SharedValue<number>;
  onLift: (k: string, x: number, y: number) => void;
  onMove: (k: string, x: number, y: number) => void;
  onDrop: (k: string) => void;
  refs: Map<string, RefObject<RNView | null>>;
  move: (k: string, by: number) => void;
  handle: boolean;
  delay: number;
};

const ListContext = createContext<ListCtx | null>(null);
const RowContext = createContext<{ grab: ReturnType<typeof Gesture.Pan> | null; k: string } | null>(null);

function toRGB(c: string): [number, number, number] {
  const s = c.trim();
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).replace(/./g, (x) => x + x) : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  const m = s.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0.5, 0.5, 0.5];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

/** White antialiased disc of `d` pixels, tinted per grain by the Atlas colors (modulate). */
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

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Drag handle: three bars. Inside a `handle` list it starts the drag at once. */
export function ReorderHandle({ children, className }: { children?: ReactNode; className?: string }) {
  const row = useContext(RowContext);
  const L = useContext(ListContext);
  const content = (
    <View
      className={cn('items-center justify-center gap-[3px] px-[8px] py-[12px]', className)}
      accessible={!!L?.handle}
      accessibilityRole="adjustable"
      accessibilityLabel="Reorder"
      accessibilityActions={[{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]}
      onAccessibilityAction={(e) => row && L?.move(row.k, e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {children ?? (
        <>
          <View className="h-[2px] w-[18px] rounded-full bg-dissolve-muted" />
          <View className="h-[2px] w-[18px] rounded-full bg-dissolve-muted" />
          <View className="h-[2px] w-[18px] rounded-full bg-dissolve-muted" />
        </>
      )}
    </View>
  );
  if (!row?.grab || !L?.handle) return content;
  return <GestureDetector gesture={row.grab}>{content}</GestureDetector>;
}

type RowProps = {
  k: string;
  item: unknown;
  index: number;
  dragging: boolean;
  render: (info: ReorderListRenderInfo<any>) => ReactNode;
  itemClassName?: string;
};

const Row = memo(function Row({ k, item, index, dragging, render, itemClassName }: RowProps) {
  const L = useContext(ListContext)!;
  const { layout, active, phase, dragTop, dragX, lift, tilt, width, canDelete, heights } = L;
  const y = useSharedValue(-1);
  const ref = useRef<RNView>(null);

  useEffect(() => {
    L.refs.set(k, ref);
    return () => {
      if (L.refs.get(k) === ref) L.refs.delete(k);
    };
  }, [L, k]);

  // Slot changes slide on the calm curve; the dragged row is driven by dragTop instead.
  useAnimatedReaction(
    () => [layout.value.tops[k] ?? -1, active.value === k ? 1 : 0, phase.value],
    (cur, prev) => {
      const t = cur[0];
      if (cur[1]) {
        // Landed: take over the final top, then hand the list back. Same frame, no jump.
        if (cur[2] === COMMIT) {
          if (t >= 0) y.value = t;
          active.value = '';
          phase.value = IDLE;
        }
        return;
      }
      if (t < 0) return;
      if (y.value < 0 || !prev || prev[0] < 0 || prev[1]) y.value = t;
      else if (t !== prev[0]) y.value = withTiming(t, { duration: SLIDE_MS, easing: CALM });
    },
  );

  const style = useAnimatedStyle(() => {
    const ph = phase.value;
    if (active.value !== k || ph === IDLE) {
      const shown = layout.value.tops[k] !== undefined && y.value >= 0;
      return {
        opacity: shown ? 1 : 0,
        transform: [{ translateY: Math.max(0, y.value) }, { translateX: 0 }, { scale: 1 }, { rotateZ: '0deg' }],
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      };
    }
    const l = lift.value;
    const x = dragX.value;
    const fade = canDelete.value ? Math.min(1, Math.abs(x) / Math.max(1, width.value * DELETE_AT)) : 0;
    return {
      opacity: ph === GONE ? 0 : 1 - 0.4 * fade,
      transform: [{ translateY: dragTop.value }, { translateX: x }, { scale: 1 + LIFT_SCALE * l }, { rotateZ: `${tilt.value}deg` }],
      shadowOpacity: 0.18 * l,
      shadowRadius: 2 + 14 * l,
      shadowOffset: { width: 0, height: 2 + 8 * l },
      elevation: 12 * l,
    };
  });

  // Long press anywhere (scrolling stays free until the hold completes), or the handle at once.
  const { onLift, onMove, onDrop, handle, delay } = L;
  const press = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!handle)
        .activateAfterLongPress(delay)
        .maxPointers(1)
        .onStart((e) => onLift(k, e.absoluteX, e.absoluteY))
        .onUpdate((e) => onMove(k, e.absoluteX, e.absoluteY))
        .onFinalize(() => onDrop(k)),
    [k, handle, delay, onLift, onMove, onDrop],
  );
  const grab = useMemo(
    () =>
      handle
        ? Gesture.Pan()
            .minDistance(0)
            .maxPointers(1)
            .onBegin((e) => onLift(k, e.absoluteX, e.absoluteY))
            .onUpdate((e) => onMove(k, e.absoluteX, e.absoluteY))
            .onFinalize(() => onDrop(k))
        : null,
    [k, handle, onLift, onMove, onDrop],
  );
  const rowCtx = useMemo(() => ({ grab, k }), [grab, k]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height * 2) / 2;
    heights.modify((all) => {
      'worklet';
      if (all[k] !== h) all[k] = h;
      return all;
    });
  };

  return (
    <GestureDetector gesture={press}>
      <Reanimated.View style={[st.row, { zIndex: dragging ? 10 : 0 }, style]}>
        {/* Plain RN view: it holds the capture ref for the dust. */}
        <RNView
          ref={ref}
          collapsable={false}
          onLayout={onLayout}
          accessible={!handle}
          accessibilityActions={handle ? undefined : [{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]}
          onAccessibilityAction={(e) => L.move(k, e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          <View className={cn('bg-dissolve-background', itemClassName)}>
            <RowContext.Provider value={rowCtx}>{render({ item, index, dragging })}</RowContext.Provider>
          </View>
        </RNView>
      </Reanimated.View>
    </GestureDetector>
  );
});

export function ReorderList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  onDelete,
  preset = 'dust',
  longPressDelay = 250,
  handle = false,
  gap = 0,
  haptics = true,
  grains = true,
  header,
  footer,
  className,
  contentContainerStyle,
  itemClassName,
}: ReorderListProps<T>) {
  const reduce = useReducedMotion();
  let ctx: DissolveCtx | null = null;
  try {
    ctx = useDissolveContext();
  } catch {
    ctx = null; // no provider: delete still works, without the dust
  }
  const keys = data.map(keyExtractor);
  const keysSig = keys.join('\u0001');
  const [dragKey, setDragKey] = useState<string | null>(null);

  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const listProbe = useRef<RNView>(null);

  const order = useSharedValue<string[]>(keys);
  const heights = useSharedValue<Record<string, number>>({});
  const active = useSharedValue('');
  const phase = useSharedValue(IDLE);
  const from = useSharedValue(0);
  const target = useSharedValue(0);
  const dragTop = useSharedValue(0);
  const dragX = useSharedValue(0);
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const width = useSharedValue(0);
  const canDelete = useSharedValue(onDelete ? 1 : 0);
  const gapSV = useSharedValue(gap);
  const fx = useSharedValue({ x: 0, y: 0, x0: 0, y0: 0, top0: 0, s0: 0, lastX: 0, vx: 0 });
  const dragScroll = useSharedValue(0);
  const vp = useSharedValue({ top: 0, h: 0 });
  const contentH = useSharedValue(0);
  const listPos = useSharedValue({ x: 0, y: 0 });
  const armed = useSharedValue(0);
  const running = useSharedValue(0);
  const alive = useSharedValue(0);
  const cursor = useSharedValue(0);
  const fxOn = useSharedValue(!reduce && grains ? 1 : 0);

  useEffect(() => {
    canDelete.value = onDelete ? 1 : 0;
    gapSV.value = gap;
    fxOn.value = !reduce && grains ? 1 : 0;
  }, [onDelete, gap, reduce, grains, canDelete, gapSV, fxOn]);

  const layout = useDerivedValue<Layout>(() => {
    const o = order.value;
    const H = heights.value;
    const g = gapSV.value;
    const base: Record<string, number> = {};
    let y = 0;
    let n = 0;
    for (let i = 0; i < o.length; i++) {
      const h = H[o[i]];
      if (h === undefined) continue;
      base[o[i]] = y;
      y += h + g;
      n++;
    }
    const total = n ? y - g : 0;
    const a = active.value;
    if (!a || phase.value === IDLE || base[a] === undefined) return { base, tops: base, total };
    // Virtual order: the lifted row moved to its target slot.
    const rest = o.filter((k) => k !== a);
    rest.splice(Math.max(0, Math.min(rest.length, target.value)), 0, a);
    const tops: Record<string, number> = {};
    y = 0;
    for (let i = 0; i < rest.length; i++) {
      const h = H[rest[i]];
      if (h === undefined) continue;
      tops[rest[i]] = y;
      y += h + g;
    }
    return { base, tops, total };
  });

  // Data from the parent: a reorder we already show is a no-op, inserts and removals slide.
  useEffect(() => {
    const next = keysSig ? keysSig.split('\u0001') : [];
    scheduleOnUI((ks: string[]) => {
      'worklet';
      if (phase.value !== IDLE) {
        const i = ks.indexOf(active.value);
        if (i < 0) {
          active.value = '';
          phase.value = IDLE;
        } else {
          from.value = i;
          target.value = Math.min(target.value, ks.length - 1);
        }
      }
      order.value = ks;
    }, next);
  }, [keysSig, order, phase, active, from, target]);

  // Grains: one Atlas of a round sprite over the viewport.
  const ink = useToken('foreground');
  const inkRGB = useSharedValue<number[]>(toRGB(ink));
  useEffect(() => {
    inkRGB.value = toRGB(ink);
  }, [ink, inkRGB]);
  const spritePx = Math.ceil(GRAIN_MAX * PixelRatio.get());
  const atlas = useMemo(
    () => ({
      sprite: makeSprite(spritePx),
      sprites: new Array(GRAINS).fill(0).map(() => rect(0, 0, spritePx + 2, spritePx + 2)),
      transforms: makeMutable(new Array(GRAINS).fill(0).map(() => Skia.RSXform(0, 0, -100, -100))),
      tints: makeMutable(new Array(GRAINS).fill(0).map(() => new Float32Array([1, 1, 1, 0]))),
      pool: makeMutable<number[]>(new Array(GRAINS * GF).fill(0)),
    }),
    [spritePx],
  );
  // Worklets only capture the buffers, never the sprite itself.
  const { transforms, tints, pool } = atlas;
  const [box, setBox] = useState({ w: 0, h: 0 });

  // JS side: haptics, state, callbacks. Stable functions reading the latest props.
  const latest = useRef({ data, keyExtractor, onReorder, onDelete, haptics, preset, ctx });
  latest.current = { data, keyExtractor, onReorder, onDelete, haptics, preset, ctx };
  const refs = useRef(new Map<string, RefObject<RNView | null>>()).current;

  const js = useMemo(() => {
    const buzz = (kind: 'lift' | 'tick' | 'drop' | 'arm') => {
      if (!latest.current.haptics) return;
      if (kind === 'lift') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (kind === 'drop') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (kind === 'arm') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      else Haptics.selectionAsync();
    };
    const indexOf = (k: string) => {
      const { data: d, keyExtractor: ke } = latest.current;
      return d.findIndex((x, i) => ke(x, i) === k);
    };
    const reorder = (k: string, to: number) => {
      const { data: d, onReorder: cb } = latest.current;
      const f = indexOf(k);
      const t = Math.max(0, Math.min(d.length - 1, to));
      if (f < 0 || f === t) return;
      const next = d.slice();
      const [it] = next.splice(f, 1);
      next.splice(t, 0, it);
      cb(next, f, t);
    };
    return {
      lifted: (k: string) => {
        setDragKey(k);
        buzz('lift');
      },
      tick: () => buzz('tick'),
      arm: (on: number) => buzz(on ? 'arm' : 'tick'),
      dropped: () => setTimeout(() => buzz('drop'), 110),
      settled: (k: string, f: number, t: number) => {
        setDragKey(null);
        if (f !== t) reorder(k, t);
      },
      remove: async (k: string, top: number, x: number) => {
        const { ctx: c, preset: p, data: d } = latest.current;
        const idx = indexOf(k);
        const item = d[idx];
        let dur = 0;
        // Let the lift settle back to scale 1 so the dust starts from the row as it rests.
        await wait(150);
        const ref = refs.get(k);
        const probe = listProbe.current;
        if (c && !c.reduced && ref?.current && probe) {
          const [image, origin] = await Promise.all([
            makeImageFromView(ref as RefObject<any>),
            new Promise<{ x: number; y: number } | null>((res) => probe.measureInWindow((px, py) => res({ x: px, y: py }))),
          ]);
          if (image && origin) {
            const w = width.value;
            const h = heights.value[k] ?? 0;
            const res = await runDissolve(c, ref, { preset: p }, { image, box: { x: origin.x + x, y: origin.y + top, width: w, height: h } });
            if (res) {
              await frames(2);
              dur = res.duration;
            }
          }
        }
        phase.value = GONE;
        if (dur) await wait(dur * 0.3);
        scheduleOnUI((key: string) => {
          'worklet';
          order.value = order.value.filter((o) => o !== key);
          phase.value = COMMIT;
        }, k);
        await wait(SLIDE_MS);
        setDragKey(null);
        if (item !== undefined) latest.current.onDelete?.(item, idx);
      },
      move: (k: string, by: number) => {
        const i = indexOf(k);
        const t = i + by;
        if (i < 0 || t < 0 || t >= latest.current.data.length) return;
        const ks = latest.current.data.map(latest.current.keyExtractor);
        ks.splice(i, 1);
        ks.splice(t, 0, k);
        order.value = ks;
        buzz('tick');
        reorder(k, t);
      },
    };
  }, [refs, order, phase, width, heights]);

  // Grain emitters (UI thread). kind 0: trail left at a slot, 1: puff at the edges of a slot.
  const emit = (kind: number, top: number, h: number) => {
    'worklet';
    if (!fxOn.value) return;
    const G = pool.value;
    const w = width.value;
    const n = kind === 0 ? 26 : 22;
    let s = cursor.value;
    for (let j = 0; j < n; j++) {
      const o = s * GF;
      s = (s + 1) % GRAINS;
      const r = Math.random;
      if (kind === 0) {
        const e = r();
        G[o] = r() * w;
        G[o + 1] = top + (r() < 0.5 ? e * e * h * 0.45 : h - e * e * h * 0.45);
        G[o + 2] = (r() - 0.5) * 14;
        G[o + 3] = (r() - 0.5) * 8 - 3;
        G[o + 5] = 650 + r() * 450;
        G[o + 6] = 1.3 + r() * 1.1;
        G[o + 7] = 0.22 + r() * 0.22;
        G[o + 8] = r() * 200;
      } else {
        const up = j % 2 === 0;
        G[o] = r() * w;
        G[o + 1] = up ? top : top + h;
        G[o + 2] = (r() - 0.5) * 36;
        G[o + 3] = (up ? -1 : 1) * (22 + r() * 48);
        G[o + 5] = 420 + r() * 280;
        G[o + 6] = 1.3 + r() * 1.3;
        G[o + 7] = 0.32 + r() * 0.25;
        G[o + 8] = 90 + r() * 60;
      }
      G[o + 4] = -1; // stamped with the frame time on the next frame
    }
    cursor.value = s;
    alive.value = 1;
  };

  const wakeLoop = () => {
    'worklet';
    running.value = 1;
  };

  // Where the lifted row is, from the finger and the scroll since the lift, and which slot it targets.
  const follow = () => {
    'worklet';
    const k = active.value;
    const H = heights.value;
    const h = H[k] ?? 0;
    const L = layout.value;
    const f = fx.value;
    let top = f.top0 + (f.y - f.y0) + (dragScroll.value - f.s0);
    top = Math.max(-h / 2, Math.min(L.total - h / 2, top));
    dragTop.value = top;
    const dx = f.x - f.x0;
    // Sideways: free with onDelete, a short leash otherwise.
    dragX.value = canDelete.value ? dx : 14 * Math.tanh(dx / 80);
    const center = top + h / 2;
    const o = order.value;
    const fi = from.value;
    let t = fi;
    for (let i = fi + 1; i < o.length; i++) {
      const b = L.base[o[i]];
      if (b === undefined) continue;
      if (center > b + (H[o[i]] ?? 0) / 2) t = i;
      else break;
    }
    if (t === fi) {
      for (let i = fi - 1; i >= 0; i--) {
        const b = L.base[o[i]];
        if (b === undefined) continue;
        if (center < b + (H[o[i]] ?? 0) / 2) t = i;
        else break;
      }
    }
    if (t !== target.value) {
      target.value = t;
      scheduleOnRN(js.tick);
    }
    if (canDelete.value) {
      const arm = Math.abs(dx) > width.value * DELETE_AT ? 1 : 0;
      if (arm !== armed.value) {
        armed.value = arm;
        scheduleOnRN(js.arm, arm);
      }
    }
  };

  const onLift = (k: string, x: number, y: number) => {
    'worklet';
    if (phase.value !== IDLE) return;
    const idx = order.value.indexOf(k);
    const L = layout.value;
    const top = L.base[k];
    if (idx < 0 || top === undefined) return;
    const m = measure(scrollRef);
    if (m) vp.value = { top: m.pageY, h: m.height };
    dragScroll.value = scrollY.value;
    fx.value = { x, y, x0: x, y0: y, top0: top, s0: scrollY.value, lastX: x, vx: 0 };
    from.value = idx;
    target.value = idx;
    dragTop.value = top;
    dragX.value = 0;
    armed.value = 0;
    active.value = k;
    phase.value = DRAG;
    lift.value = withSpring(1, SETTLE);
    emit(0, top, heights.value[k] ?? 0);
    wakeLoop();
    scheduleOnRN(js.lifted, k);
  };

  const onMove = (k: string, x: number, y: number) => {
    'worklet';
    if (active.value !== k || phase.value !== DRAG) return;
    const f = fx.value;
    fx.value = { ...f, x, y };
    follow();
  };

  const onDrop = (k: string) => {
    'worklet';
    if (active.value !== k || phase.value !== DRAG) return;
    follow();
    if (canDelete.value && armed.value) {
      phase.value = DELETE;
      lift.value = withTiming(0, { duration: 140, easing: CALM });
      scheduleOnRN(js.remove, k, dragTop.value, dragX.value);
      return;
    }
    phase.value = DROP;
    const final = layout.value.tops[k] ?? fx.value.top0;
    const h = heights.value[k] ?? 0;
    lift.value = withTiming(0, { duration: 260, easing: CALM });
    dragX.value = withSpring(0, SETTLE);
    emit(1, final, h);
    wakeLoop();
    scheduleOnRN(js.dropped);
    dragTop.value = withSpring(final, SETTLE, () => {
      'worklet';
      if (phase.value !== DROP) return;
      const f = from.value;
      const t = target.value;
      if (t !== f) {
        const o = order.value.slice();
        const [key] = o.splice(f, 1);
        o.splice(t, 0, key);
        order.value = o;
      }
      phase.value = COMMIT;
      scheduleOnRN(js.settled, k, f, t);
    });
  };

  // Frame loop, awake only while dragging or while grains are alive: auto scroll, lean, grains.
  useFrameCallback((info) => {
    'worklet';
    // Absolute frame time: timeSinceFirstFrame restarts whenever React re-renders the callback.
    // Resting: registered but idle, so a lift draws on the next frame without a JS round trip.
    if (!running.value) return;
    const now = info.timestamp;
    const dt = Math.min(1 / 30, (info.timeSincePreviousFrame ?? 16) / 1000);
    const ph = phase.value;

    if (ph === DRAG) {
      const f = fx.value;
      const v = vp.value;
      const fy = f.y - v.top;
      const band = Math.min(EDGE, v.h / 4);
      let speed = 0;
      if (band > 0 && fy < band) speed = -MAX_SPEED * Math.min(1, (band - fy) / band) ** 2;
      else if (band > 0 && fy > v.h - band) speed = MAX_SPEED * Math.min(1, (fy - (v.h - band)) / band) ** 2;
      const maxS = Math.max(0, contentH.value - v.h);
      if (speed) {
        const next = Math.max(0, Math.min(maxS, dragScroll.value + speed * dt));
        if (next !== dragScroll.value) {
          dragScroll.value = next;
          scrollTo(scrollRef, 0, next, false);
        }
      }
      // Sideways speed, smoothed, leans the row.
      const inst = (f.x - f.lastX) / dt;
      const vx = f.vx + (inst - f.vx) * (1 - Math.exp(-dt * 14));
      fx.value = { ...f, lastX: f.x, vx };
      follow();
      const want = fxOn.value ? Math.max(-1, Math.min(1, vx / 700)) * MAX_TILT : 0;
      tilt.value += (want - tilt.value) * (1 - Math.exp(-dt * 12));
    } else if (tilt.value !== 0) {
      tilt.value *= Math.exp(-dt * 14);
      if (Math.abs(tilt.value) < 0.01) tilt.value = 0;
    }

    if (alive.value) {
      const G = pool.value;
      const T = transforms.value;
      const K = tints.value;
      const c = inkRGB.value;
      const lp = listPos.value;
      const ox = lp.x;
      const oy = lp.y - scrollY.value;
      const damp = Math.exp(-dt * 3.2);
      let any = 0;
      for (let i = 0; i < GRAINS; i++) {
        const o = i * GF;
        const life = G[o + 5];
        if (life <= 0) continue;
        any = 1;
        if (G[o + 4] < 0) G[o + 4] = now + G[o + 8];
        const age = now - G[o + 4];
        if (age >= life) {
          G[o + 5] = 0;
          T[i].set(0, 0, -100, -100);
          K[i][3] = 0;
          continue;
        }
        if (age < 0) {
          K[i][3] = 0;
          continue;
        }
        G[o] += G[o + 2] * dt;
        G[o + 1] += G[o + 3] * dt;
        G[o + 2] *= damp;
        G[o + 3] *= damp;
        const k = age / life;
        const a = G[o + 7] * (1 - k) * (1 - k) * Math.min(1, age / 60);
        const m = G[o + 6] / spritePx;
        const half = (m * (spritePx + 2)) / 2;
        T[i].set(m, 0, ox + G[o] - half, oy + G[o + 1] - half);
        const cl = K[i];
        cl[0] = c[0];
        cl[1] = c[1];
        cl[2] = c[2];
        cl[3] = a;
      }
      if (!any) alive.value = 0;
      // Notify the canvas of the in place changes (same trick as Skia's buffer hooks).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transforms as any)._value = T;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tints as any)._value = K;
    }

    if (ph !== DRAG && !alive.value && tilt.value === 0 && running.value) running.value = 0;
  }, true);

  const L = useMemo<ListCtx>(
    () => ({
      order,
      heights,
      layout,
      active,
      phase,
      dragTop,
      dragX,
      lift,
      tilt,
      width,
      canDelete,
      onLift,
      onMove,
      onDrop,
      refs,
      move: js.move,
      handle,
      delay: longPressDelay,
    }),
    // The worklets only close over shared values and stable functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handle, longPressDelay, js, refs],
  );

  const listStyle = useAnimatedStyle(() => ({ height: layout.value.total }));

  return (
    <ListContext.Provider value={L}>
      <View className={cn('flex-1', className)} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Reanimated.ScrollView
          ref={scrollRef}
          style={st.fill}
          contentContainerStyle={contentContainerStyle}
          scrollEnabled={!dragKey}
          scrollEventThrottle={16}
          onLayout={(e) => {
            vp.value = { ...vp.value, h: e.nativeEvent.layout.height };
          }}
          onContentSizeChange={(_, h) => {
            contentH.value = h;
          }}
        >
          {header}
          <Reanimated.View
            style={listStyle}
            onLayout={(e) => {
              const l = e.nativeEvent.layout;
              listPos.value = { x: l.x, y: l.y };
              width.value = l.width;
            }}
          >
            <RNView ref={listProbe} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
            {data.map((item, index) => {
              const k = keys[index];
              return <Row key={k} k={k} item={item} index={index} dragging={dragKey === k} render={renderItem as RowProps['render']} itemClassName={itemClassName} />;
            })}
          </Reanimated.View>
          {footer}
        </Reanimated.ScrollView>
        {box.w && atlas.sprite && grains && !reduce ? (
          <Canvas style={[StyleSheet.absoluteFill, { width: box.w, height: box.h }]} pointerEvents="none">
            <Atlas
              image={atlas.sprite}
              sprites={atlas.sprites}
              transforms={transforms}
              colors={tints}
              colorBlendMode="modulate"
              sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
            />
          </Canvas>
        ) : null}
      </View>
    </ListContext.Provider>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  row: { position: 'absolute', left: 0, right: 0, top: 0, shadowColor: '#000' },
});
