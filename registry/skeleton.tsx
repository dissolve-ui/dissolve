/**
 * Skeleton, from dissolve (dissolve-ui). This file is yours: restyle the blocks with
 * classNames, change the wave, the timings, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * Loading placeholders that do not crossfade into the content: when loading turns false, every
 * placeholder block breaks into grains and those same grains recompose the real content, block
 * by block, top to bottom and left to right (the morph preset of the engine: the grains of the
 * placeholder fly over and become the grains of the content, which shows exactly where they
 * land). While loading, a calm wave of light rolls across the blocks, top left to bottom right.
 *
 * You describe the placeholders, the content stays yours: wrap each piece of content in a
 * SkeletonBlock and give it the shape it has while loading. Its children only render once
 * loading is false, so they can read data that is not there yet.
 *   - line (default): a rounded bar, about 0.6 of `height`, centered in it. Give it the line
 *     height of the text it stands for (17 pt text on a 22 pt line: height={22}). lines={3}
 *     stacks three of them, the last one shorter, for a paragraph.
 *   - circle: an avatar, `size` across.
 *   - rect: an image or a card, `width` by `height`, `radius` corners.
 * Size the placeholders like the content they stand for: the handoff starts where the
 * placeholder was and lands where the content is.
 *
 * Reduced motion: no wave, a short crossfade instead of the grains. Needs <DissolveProvider>
 * above it for the grains.
 *
 * <Skeleton loading={!user}>
 *   <View className="flex-row items-center gap-4">
 *     <SkeletonBlock shape="circle" size={64}>
 *       <Image source={user?.avatar} style={{ width: 64, height: 64, borderRadius: 32 }} />
 *     </SkeletonBlock>
 *     <View className="flex-1 gap-1">
 *       <SkeletonBlock width={160} height={25}>
 *         <Text className="text-[20px] font-semibold">{user?.name}</Text>
 *       </SkeletonBlock>
 *       <SkeletonBlock width={96}>
 *         <Text className="text-[15px] text-dissolve-muted">{user?.handle}</Text>
 *       </SkeletonBlock>
 *     </View>
 *   </View>
 * </Skeleton>
 *
 * Skeleton.Block is the same component, for those who like the dotted form:
 *
 * <Skeleton loading={loading} stagger={80} onReveal={() => track('feed_shown')}>
 *   <Skeleton.Block shape="rect" height={180} radius={20}>
 *     <Cover post={post} />
 *   </Skeleton.Block>
 *   <Skeleton.Block lines={3} height={22} className="mt-3">
 *     <Text>{post?.body}</Text>
 *   </Skeleton.Block>
 * </Skeleton>
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type ComponentRef } from 'react';
import { View as RNView, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { capGrain, capture, frames, measure, runDissolve, useDissolveContext } from 'dissolve-ui';
import { Animated, View, cn } from './tw';
import { CALM, wait } from './motion';

/** Host ref of a View: the class instance on RN <= 0.86, a ReactNativeElement on 0.88+. */
type RNViewRef = ComponentRef<typeof RNView>;

export type SkeletonShape = 'line' | 'circle' | 'rect';
export type SkeletonToken = 'surface' | 'surface-2' | 'border';

export type SkeletonProps = {
  /** True shows the placeholders, false hands each one over to its content in grains. */
  loading: boolean;
  /** Any layout, with SkeletonBlocks anywhere inside it. */
  children: ReactNode;
  /** Wave of light across the blocks while loading. Off under reduced motion. Default true. */
  shimmer?: boolean;
  /** Placeholder color as a theme token. Default 'surface'. */
  color?: SkeletonToken;
  /**
   * Delay between two blocks in ms, in reading order. Compressed when there are many blocks, so
   * the whole handoff stays under about 900 ms. Default 70.
   */
  stagger?: number;
  /** Duration of one block's handoff in ms. Default 600. */
  duration?: number;
  /** Grain size in points. Default 3. */
  grain?: number;
  /** One light impact as the first grains land. Default true. */
  haptics?: boolean;
  /** Called once every block shows its content. */
  onReveal?: () => void;
  /** Root classes (padding, gap...). */
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export type SkeletonBlockProps = {
  /** The real content. Rendered only once loading is false. */
  children?: ReactNode;
  /** Placeholder shape. Default 'line'. */
  shape?: SkeletonShape;
  /** Placeholder width: points or a percentage. Default '100%' (circle: size). */
  width?: DimensionValue;
  /** Placeholder height in points. line: the line height (default 20), rect: default 120. */
  height?: number;
  /** circle: the diameter. Default 40. */
  size?: number;
  /** Corner radius. Default: round ends for a line, 12 for a rect. */
  radius?: number;
  /** line: stacked bars, the last one at 60 %, for a paragraph. Default 1. */
  lines?: number;
  /** Placeholder classes (a different fill: bg-dissolve-surface-2...). */
  className?: string;
  /** Outer box style (margins, alignSelf, flex...). */
  style?: StyleProp<ViewStyle>;
};

/** Content shown at this opacity until its grains land: hidden to the eye, still capturable. */
const HIDDEN = 0.01;
/** One wave every 1.8 s, travelling 520 pt per cycle, dipping the blocks to 58 %. */
const WAVE_MS = 1800;
const WAVE_SPAN = 520;
const DEPTH = 0.42;
/** The wave settles before the snapshot, so the first grain frame is the block as seen. */
const SETTLE = 180;
/** The whole handoff, every block included, stays under this. */
const TOTAL = 900;
const FADE = 240;
/** Two atlases per block: keep each burst at half the engine cap. */
const MAX_GRAINS = 3500;
const FILL: Record<SkeletonToken, string> = {
  surface: 'bg-dissolve-surface',
  'surface-2': 'bg-dissolve-surface-2',
  border: 'bg-dissolve-border',
};

type Entry = {
  a: RefObject<RNViewRef | null>;
  b: RefObject<RNViewRef | null>;
  /** The overlay paints the placeholder: hide the real one. */
  hide: () => void;
  /** The grains have landed: the content shows, the placeholder goes. */
  reveal: () => void;
  /** Reduced motion or no capture: a plain crossfade. */
  fade: (ms: number) => void;
};

type SkeletonCtx = {
  loading: boolean;
  fill: string;
  clock: SharedValue<number>;
  /** 1 while the wave runs, eased to 0 before the handoff. */
  wave: SharedValue<number>;
  root: RefObject<RNViewRef | null>;
  register: (e: Entry) => () => void;
};
const Ctx = createContext<SkeletonCtx | null>(null);

export function Skeleton({
  loading,
  children,
  shimmer = true,
  color = 'surface',
  stagger = 70,
  duration = 600,
  grain = 3,
  haptics = true,
  onReveal,
  className,
  style,
}: SkeletonProps) {
  const ctx = useDissolveContext();
  const reduced = useReducedMotion();
  const root = useRef<RNViewRef>(null);
  const clock = useSharedValue(0);
  const wave = useSharedValue(0);
  const blocks = useRef(new Set<Entry>());
  const run = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;
  const was = useRef(loading);

  const register = useMemo(
    () => (e: Entry) => {
      blocks.current.add(e);
      return () => {
        blocks.current.delete(e);
      };
    },
    [],
  );

  // The wave: one clock for every block, each one reads it with its own phase.
  const waving = loading && shimmer && !reduced;
  useEffect(() => {
    if (!waving) return;
    wave.value = withTiming(1, { duration: 400, easing: CALM });
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: WAVE_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [waving, clock, wave]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => {
    run.current += 1;
    clear();
  }, []);

  async function handoff() {
    const id = ++run.current;
    const live = () => run.current === id;
    const list = [...blocks.current];
    if (!list.length) return onRevealRef.current?.();
    const finish = (() => {
      let left = list.length;
      return () => {
        left -= 1;
        if (left === 0 && live()) onRevealRef.current?.();
      };
    })();
    if (reduced || ctx.reduced) {
      wave.value = 0;
      list.forEach((e) => e.fade(FADE));
      timers.current.push(setTimeout(() => list.forEach(finish), FADE));
      return;
    }
    // Let the wave settle and the content lay out, then snapshot both sides of every block.
    wave.value = withTiming(0, { duration: SETTLE, easing: CALM });
    await wait(SETTLE);
    await frames(2);
    if (!live()) return;
    const shots = await Promise.all(list.map((e) => Promise.all([capture(e.a), capture(e.b)])));
    if (!live()) {
      shots.flat().forEach((s) => s?.image.dispose());
      return;
    }
    const jobs = list.map((entry, k) => ({ entry, from: shots[k][0], to: shots[k][1] }));
    // Reading order: rows top to bottom (a few points of tolerance), then left to right.
    const key = (j: (typeof jobs)[number]) => j.from?.box ?? j.to?.box ?? { x: 0, y: 0 };
    jobs.sort((p, q) => {
      const a = key(p);
      const b = key(q);
      return Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x;
    });
    const step = jobs.length > 1 ? Math.max(0, Math.min(stagger, (TOTAL - duration) / (jobs.length - 1))) : 0;
    if (haptics) timers.current.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), duration * 0.45));

    jobs.forEach(({ entry, from, to }, i) => {
      const go = () => {
        if (!live()) {
          from?.image.dispose();
          to?.image.dispose();
          return;
        }
        // Nothing to draw on one side (zero size, capture failed): a plain crossfade.
        if (!from || !to || !from.box.width || !to.box.width || !from.box.height || !to.box.height) {
          from?.image.dispose();
          to?.image.dispose();
          entry.fade(FADE);
          timers.current.push(setTimeout(finish, FADE));
          return;
        }
        let g = capGrain(from.box.width, from.box.height, grain, MAX_GRAINS);
        g = capGrain(to.box.width, to.box.height, g, MAX_GRAINS);
        let landed = false;
        const land = () => {
          if (landed) return;
          landed = true;
          entry.reveal();
          finish();
        };
        runDissolve(
          ctx,
          entry.a,
          { preset: 'morph', duration, grain: g, haptics: false },
          {
            image: from.image,
            box: from.box,
            data: { imageB: to.image, boxB: to.box },
            owned: [from.image, to.image],
            // The last frame is the content itself, then the real one shows under it.
            onFinish: land,
          },
        )
          .then((res) => {
            if (!res) return land();
            // The overlay paints the placeholder first, then the real one hides.
            frames(2).then(() => {
              if (!landed) entry.hide();
            });
          })
          .catch(land);
      };
      if (i === 0) go();
      else timers.current.push(setTimeout(go, i * step));
    });
  }

  useEffect(() => {
    const before = was.current;
    was.current = loading;
    if (loading) {
      run.current += 1;
      clear();
      return;
    }
    if (before) handoff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const value = useMemo<SkeletonCtx>(() => ({ loading, fill: FILL[color], clock, wave, root, register }), [loading, color, clock, wave, register]);

  return (
    <Ctx.Provider value={value}>
      <RNView ref={root} collapsable={false} style={style}>
        <View className={className}>{children}</View>
      </RNView>
    </Ctx.Provider>
  );
}

/**
 * One placeholder and the content it stands for. While loading it shows the placeholder (shape,
 * width, height); once loading is false its children render and the placeholder's grains
 * recompose them.
 */
export function SkeletonBlock({ children, shape = 'line', width, height, size, radius, lines = 1, className, style }: SkeletonBlockProps) {
  const sk = useContext(Ctx);
  const loading = sk?.loading ?? false;
  const a = useRef<RNViewRef>(null);
  const b = useRef<RNViewRef>(null);
  // done: the content shows and the placeholder is gone.
  const [done, setDone] = useState(!loading);
  const aVis = useSharedValue(1);
  const bVis = useSharedValue(loading ? HIDDEN : 1);
  const phase = useSharedValue(0);
  /** The placeholder's own size while loading, kept while the content takes over the box. */
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  const register = sk?.register;
  useEffect(() => {
    if (!register) return;
    return register({
      a,
      b,
      hide: () => {
        aVis.value = 0;
      },
      reveal: () => {
        bVis.value = 1;
        setDone(true);
      },
      fade: (ms) => {
        aVis.value = withTiming(0, { duration: ms, easing: CALM });
        bVis.value = withTiming(1, { duration: ms, easing: CALM }, (fin) => {
          'worklet';
          if (fin) aVis.value = 0;
        });
        setTimeout(() => setDone(true), ms);
      },
    });
  }, [register, aVis, bVis]);

  // Back to loading: the placeholder fades back in, the content waits for the next handoff.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!loading) return;
    bVis.value = HIDDEN;
    aVis.value = 0;
    aVis.value = withTiming(1, { duration: FADE, easing: CALM });
    setDone(false);
  }, [loading, aVis, bVis]);

  // Wave phase from the block's place in the skeleton: top left first.
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (loading) setFrame((f) => (f && f.width === w && f.height === h ? f : { width: w, height: h }));
    const rootRef = sk?.root;
    if (!rootRef) return;
    Promise.all([measure(a), measure(rootRef)]).then(([me, r]) => {
      if (me && r) phase.value = (me.y - r.y + (me.x - r.x) * 0.5) / WAVE_SPAN;
    });
  };

  const clock = sk?.clock;
  const wave = sk?.wave;
  const glow = useAnimatedStyle(() => {
    const w = wave ? wave.value : 0;
    const c = clock ? clock.value : 0;
    const dip = w > 0 ? DEPTH * w * (0.5 + 0.5 * Math.cos(2 * Math.PI * (c - phase.value))) : 0;
    return { opacity: aVis.value * (1 - dip) };
  });
  const show = useAnimatedStyle(() => ({ opacity: bVis.value }));

  // Placeholder geometry.
  const fill = sk?.fill ?? FILL.surface;
  let slot: ViewStyle;
  let bars: ReactNode;
  if (shape === 'circle') {
    const d = size ?? height ?? 40;
    slot = { width: d, height: d };
    bars = <View className={cn(fill, className)} style={{ width: d, height: d, borderRadius: radius ?? d / 2 }} />;
  } else if (shape === 'rect') {
    slot = { width: width ?? '100%', height: height ?? 120 };
    bars = <View className={cn(fill, className)} style={{ flex: 1, borderRadius: radius ?? 12 }} />;
  } else {
    const lh = height ?? 20;
    const bar = Math.max(6, Math.round(lh * 0.6));
    const n = Math.max(1, Math.round(lines));
    slot = { width: width ?? '100%', height: lh * n };
    bars = Array.from({ length: n }, (_, i) => (
      <RNView key={i} style={{ height: lh, justifyContent: 'center' }}>
        <View className={cn(fill, className)} style={{ height: bar, width: n > 1 && i === n - 1 ? '60%' : '100%', borderRadius: radius ?? bar / 2 }} />
      </RNView>
    ));
  }

  const handing = !loading && !done;
  return (
    <RNView style={style}>
      {!loading ? (
        <Animated.View style={show}>
          {/* Plain RN view at full opacity: what the handoff captures, while the outer box hides it. */}
          <RNView ref={b} collapsable={false}>
            {children}
          </RNView>
        </Animated.View>
      ) : null}
      {/* loading too: on Reload, done only flips back after this render, and the block would
          collapse to nothing for a frame (the whole layout jumps). */}
      {loading || !done ? (
        <Animated.View
          pointerEvents="none"
          style={[handing ? { position: 'absolute', left: 0, top: 0, width: frame?.width, height: frame?.height } : null, glow]}
          onLayout={handing ? undefined : onLayout}
        >
          <RNView ref={a} collapsable={false} style={handing && frame ? frame : slot}>
            {bars}
          </RNView>
        </Animated.View>
      ) : null}
    </RNView>
  );
}

/** Skeleton.Block: the same SkeletonBlock, in the dotted form. */
Skeleton.Block = SkeletonBlock;
