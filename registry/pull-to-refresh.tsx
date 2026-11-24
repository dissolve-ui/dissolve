/**
 * PullToRefresh, from dissolve (dissolve-ui). This file is yours: restyle it with
 * classNames, change the timings, the ring, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * Pull a list down past its top: grains drift in from scattered positions and gather into a ring,
 * 1:1 with the pull. At the threshold the ring closes with a rigid tick. Release past it and the
 * ring spins while onRefresh runs, the list held under it. When the promise settles, the items
 * already there glide to their new place while the list eases back to the top, and the ring
 * grains fly to the new items and build them in grains. Nothing new (or onRefresh threw): the
 * grains fall away as dust. Released early, the grains scatter back out with the list.
 *
 * New items are found with PullItem: wrap each item of your content in it, with a stable id.
 * The ids present when the refresh starts are remembered; a PullItem that shows up with any
 * other id is new. It works for any layout (rows, a bento grid, wrapped cards of any size): the
 * items that stay move with a layout transition, so whatever your layout does, they follow it.
 *
 * iOS uses the native overscroll of the scroll view (real rubber band, no second gesture on the
 * list). Android and web, which have no overscroll past the top, use a pan that only takes over
 * when the list is at the top and the finger moves down.
 *
 * Needs <DissolveProvider> above it for the new items.
 *
 * <PullToRefresh onRefresh={reload}>
 *   {items.map((item) => (
 *     <PullItem key={item.id} id={item.id}>
 *       <Row item={item} />
 *     </PullItem>
 *   ))}
 * </PullToRefresh>
 *
 * A bento grid: className and style draw the card itself (it is what gets captured), size and
 * position keys of style (width, flex, margin...) go to the outer box so it sits in your grid.
 *
 * <PullToRefresh onRefresh={reload} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 }}>
 *   {cards.map((card) => (
 *     <PullItem key={card.id} id={card.id} style={{ width: card.wide ? '100%' : '47%' }} className="h-36 rounded-3xl bg-dissolve-surface p-4">
 *       <Card card={card} />
 *     </PullItem>
 *   ))}
 * </PullToRefresh>
 *
 * <PullToRefresh onRefresh={reload}>
 *   {(scroll) => <Animated.FlatList {...scroll} data={items} renderItem={({ item }) => <PullItem id={item.id}><Row item={item} /></PullItem>} />}
 * </PullToRefresh>
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type ComponentRef } from 'react';
import { Platform, StyleSheet, View as RNView, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  LinearTransition,
  makeMutable,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { capture, frames, measure, runDissolve, useDissolveContext } from 'dissolve-ui';
import { Animated, View, cn, useToken } from './tw';
import { CALM, CALM_FN, clamp01, hash, wait } from './motion';

/** Host ref of a View: the class instance on RN <= 0.86, a ReactNativeElement on 0.88+. */
type RNViewRef = ComponentRef<typeof RNView>;

export type PullToken = 'foreground' | 'muted' | 'primary' | 'accent' | 'success' | 'chart-1' | 'chart-2';

/** Props to spread on your own Animated.ScrollView / Animated.FlatList (render prop children). */
export type PullScrollProps = {
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  scrollEventThrottle: number;
  bounces: boolean;
  alwaysBounceVertical: boolean;
  overScrollMode: 'never';
};

export type PullToRefreshProps = {
  /** List content (wrapped in an Animated.ScrollView), or a render prop for your own Animated list. */
  children: ReactNode | ((scroll: PullScrollProps) => ReactNode);
  /** Runs while the ring spins. Update your data before it resolves: new PullItems are built right after. */
  onRefresh: () => Promise<void>;
  /** Pull distance in points that arms the refresh, also the height held while it runs. Default 80. */
  threshold?: number;
  /** Rigid when the ring closes, Success when done, Warning if onRefresh throws. Default true. */
  haptics?: boolean;
  /** Grain color as a theme token. Default 'foreground'. */
  color?: PullToken;
  /** Build the new PullItems in grains when the refresh lands. Default true. */
  rebuild?: boolean;
  /** Content container style of the built in ScrollView (plain children only). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Root classes (background, radius, margins...). */
  className?: string;
};

export type PullItemProps = {
  /** Stable id of the item (your data key). An id not there when the refresh started is new. */
  id: string | number;
  children?: ReactNode;
  /** Classes of the item itself (background, radius, padding...). Captured with it. */
  className?: string;
  /** Item style. Size and position keys (width, flex, margin...) go to the outer box. */
  style?: StyleProp<ViewStyle>;
};

/** Items that stay glide to their new place on the calm curve, no spring. */
const MOVE = LinearTransition.duration(420).easing(CALM);
const IOS = Platform.OS === 'ios';
/** Grains in the ring. */
const N = 52;
const RADIUS = 13;
const DOT = 2.7;
/** One turn per second while refreshing. */
const SPEED = Math.PI * 2;
/** The ring reads as a spinner for at least this long, even on an instant refresh. */
const MIN_SPIN = 700;
const DUST = 820;
const SETTLE = 520;
/** The ring pinching into its center (stagger included), then handing over to the stream. */
const FLY = 240;
const FLY_STAGGER = 50;
const LAND = 90;
/** The new items forming from grains that spring out of the ring center. */
const GATHER = 820;
/** A new item waiting for its entrance: hidden to the eye, still rendered so it can be captured. */
const HIDDEN = 0.01;
const TAU = Math.PI * 2;
/** Per grain seed: ring angle, ring radius, scatter x y, arrival delay, random. */
const SEED = 6;
/** Per grain live pose: x y alpha size, then dust velocity x y. */
const POSE = 6;
/** Pull phases. */
const IDLE = 0;
const SPIN = 1;
const DONE = 2;
/** How the ring leaves once the refresh lands. */
const DUSTING = 0;
const FLYING = 1;

function seeds() {
  const out: number[] = new Array(N * SEED).fill(0);
  for (let i = 0; i < N; i++) {
    const k = i * SEED;
    out[k] = (i / N) * TAU;
    out[k + 1] = RADIUS + (hash(i, 1) - 0.5) * 3.2;
    // Scatter: a wide, shallow cloud around the ring, more of it to the sides.
    const side = hash(i, 2) < 0.5 ? -1 : 1;
    out[k + 2] = side * (24 + hash(i, 3) * 120);
    out[k + 3] = (hash(i, 4) - 0.5) * 70;
    // Arrival order follows the ring clockwise from the top, so it closes like an arc drawing itself.
    out[k + 4] = 0.72 * (i / N) + 0.28 * hash(i, 5);
    out[k + 5] = hash(i, 6);
  }
  return out;
}

type Box = { x: number; y: number; width: number; height: number };
type Entry = { ref: RefObject<RNViewRef | null>; reveal: () => void };
type PullCtx = {
  register: (id: string | number, entry: Entry) => () => void;
  /** Read once when a PullItem mounts: true if it is new and waits for its entrance. */
  isNew: (id: string | number) => boolean;
  /** Layout transitions on (around a refresh only, so normal list updates are untouched). */
  moving: boolean;
};
const PullContext = createContext<PullCtx | null>(null);

export function PullToRefresh({ children, onRefresh, threshold = 80, haptics = true, color = 'foreground', rebuild = true, contentContainerStyle, className }: PullToRefreshProps) {
  const ctx = useDissolveContext();
  const reduced = useReducedMotion();
  const ink = useToken(color);

  const { seed, draw, pose, aim } = useMemo(
    () => ({
      seed: seeds(),
      /** Per grain as drawn this frame: x y alpha size. */
      draw: makeMutable<number[]>(new Array(N * 4).fill(0)),
      pose: makeMutable<number[]>(new Array(N * POSE).fill(0)),
      /** Per grain landing point on a new item: x y, root coordinates. */
      aim: makeMutable<number[]>(new Array(N * 2).fill(0)),
    }),
    [],
  );
  /** Bumped once per drawn frame: the grain styles re-read draw when it changes. */
  const painted = useSharedValue(0);

  const T = Math.max(40, threshold);
  const H = Math.round(T * 2.6);
  const thr = useSharedValue(T);
  useEffect(() => {
    thr.value = T;
  }, [thr, T]);

  /** Scroll offset from the resting top (inset included). Negative while overscrolled on iOS. */
  const scrollY = useSharedValue(0);
  /** Finger on the list (iOS drag or the pan). */
  const dragging = useSharedValue(0);
  /** Rubber banded pull of the pan (Android, web). */
  const drag = useSharedValue(0);
  /** Offset held under the loader while refreshing, then eased back to 0. */
  const hold = useSharedValue(0);
  /** iOS: the native bounce after release is over, hold now adds to the scroll instead of filling in for it. */
  const latched = useSharedValue(0);
  const phase = useSharedValue(IDLE);
  const leave = useSharedValue(DUSTING);
  /** The ring closed during this drag (threshold haptic already played). */
  const armed = useSharedValue(0);
  const closeReq = useSharedValue(0);
  const width = useSharedValue(0);
  const startY = useSharedValue(0);
  // Frame callback state.
  const seen = useSharedValue(IDLE);
  const phaseAt = useSharedValue(0);
  const closeAt = useSharedValue(-100000);
  const rot = useSharedValue(-Math.PI / 2);
  const dustCy = useSharedValue(0);
  const quiet = useSharedValue(0);

  /** Translation of the list, and how far its top edge sits below the container top. */
  const shiftOf = () => {
    'worklet';
    const over = scrollY.value < 0 ? -scrollY.value : 0;
    const fill = latched.value ? hold.value : hold.value - over > 0 ? hold.value - over : 0;
    return drag.value > fill ? drag.value : fill;
  };
  const visualOf = () => {
    'worklet';
    const over = scrollY.value < 0 ? -scrollY.value : 0;
    return over + shiftOf();
  };

  // Haptics and the refresh flow live on the JS thread.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const tick = () => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  };

  const rootRef = useRef<RNViewRef>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const busy = useRef(false);

  // PullItems: who is mounted, and which ids were there when the refresh started.
  const items = useRef(new Map<string | number, Entry>());
  const before = useRef<Set<string | number> | null>(null);
  const hideNew = useRef(false);
  const [moving, setMoving] = useState(false);
  const api = useMemo<Omit<PullCtx, 'moving'>>(
    () => ({
      register: (id, entry) => {
        items.current.set(id, entry);
        return () => {
          if (items.current.get(id) === entry) items.current.delete(id);
        };
      },
      isNew: (id) => hideNew.current && before.current !== null && !before.current.has(id),
    }),
    [],
  );
  const pull = useMemo<PullCtx>(() => ({ ...api, moving }), [api, moving]);

  useFrameCallback((info) => {
    'worklet';
    // Absolute frame time: timeSinceFirstFrame restarts whenever React re-renders the callback.
    const now = info.timestamp;
    // Resting: nothing shows, nothing pending. The loop stays registered but does no work, so a
    // pull starts drawing on the very next frame without a round trip to the JS thread.
    if (quiet.value >= 2 && phase.value === IDLE && !dragging.value && visualOf() < 0.01) return;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const Tv = thr.value;
    const W = width.value;
    const ph = phase.value;
    const P = pose.value;
    const S = seed;
    const flying = ph === DONE && leave.value === FLYING && !reduced;

    if (seen.value !== ph) {
      seen.value = ph;
      phaseAt.value = now;
      if (ph === DONE && !flying) {
        // Freeze where the ring is and send every grain off: outward, a little up, then gravity.
        const cxv = W / 2;
        const cyv = dustCy.value;
        for (let i = 0; i < N; i++) {
          const p = i * POSE;
          const dx = P[p] - cxv;
          const dy = P[p + 1] - cyv;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const s = i * SEED;
          const push = 30 + S[s + 5] * 90;
          P[p + 4] = (dx / d) * push + (hash(i, 7) - 0.5) * 40;
          P[p + 5] = (dy / d) * push - 50 - hash(i, 8) * 60;
        }
      }
    }
    if (closeReq.value) {
      closeReq.value = 0;
      closeAt.value = now;
    }
    const since = now - phaseAt.value;

    const vis = visualOf();
    const g = Tv > 0 ? clamp01(vis / Tv) : 0;
    // The loader sits in the middle of the gap, then rides T/2 above the list once the ring is closed.
    const cy = vis < Tv ? vis / 2 : vis - Tv / 2;
    const cx = W / 2;
    if (ph !== DONE) dustCy.value = cy;

    // Ring rotation: follows the pull a little, spins up while refreshing.
    if (ph === IDLE) rot.value = -Math.PI / 2 + (vis / Tv) * 0.9;
    else if (ph === SPIN && !reduced) {
      const ramp = clamp01(since / 400);
      rot.value += SPEED * ramp * dt;
    }
    const r0 = rot.value;
    // Closing pulse at the threshold.
    let pulse = 1;
    const sc = now - closeAt.value;
    if (!reduced && sc < 300) pulse = 1 + 0.16 * Math.sin((Math.PI * sc) / 300);
    const spinMix = ph === SPIN && !reduced ? clamp01(since / 300) : 0;
    const fadeIn = clamp01(vis / 14);
    const tSec = now / 1000;
    const A = aim.value;

    const D = draw.value;
    let visible = false;
    for (let i = 0; i < N; i++) {
      const s = i * SEED;
      const p = i * POSE;
      let x = 0;
      let y = 0;
      let a = 0;
      let size = DOT;
      if (ph === DONE) {
        let clip = 1;
        if (reduced) {
          const k = clamp01(since / 220);
          x = P[p];
          y = P[p + 1];
          a = P[p + 2] * (1 - k);
        } else if (flying) {
          // Fly to the landing point on a new item, on a slight arc, then fade where it lands.
          const delay = S[s + 5] * FLY_STAGGER;
          const run = FLY - FLY_STAGGER;
          const t = (since - delay) / run;
          const e = CALM_FN(clamp01(t));
          x = P[p] + (A[i * 2] - P[p]) * e;
          y = P[p + 1] + (A[i * 2 + 1] - P[p + 1]) * e;
          const l = (since - delay - run) / LAND;
          const f = clamp01(l);
          a = (P[p + 2] + (0.95 - P[p + 2]) * e) * (1 - f);
          size = P[p + 3] * (1 - 0.4 * f);
        } else {
          const delay = S[s + 5] * 110;
          const t = since - delay < 0 ? 0 : (since - delay) / 1000;
          // Integrate in closed form so the path does not depend on the frame rate.
          x = P[p] + P[p + 4] * t;
          y = P[p + 1] + P[p + 5] * t + 0.5 * 980 * t * t;
          const k = clamp01((since - delay) / (DUST - 110));
          a = P[p + 2] * (1 - k) * (1 - k);
          size = P[p + 3] * (1 - 0.45 * k);
          // Dust stays in the band above the rows, soft edged.
          clip = clamp01((H - y) / 8);
        }
        a *= clip;
        if (a > 0.003) visible = true;
        D[i * 4] = x;
        D[i * 4 + 1] = y;
        D[i * 4 + 2] = clamp01(a);
        D[i * 4 + 3] = size;
        continue;
      }
      const ang = S[s] + r0;
      const rr = S[s + 1] * pulse + (ph === SPIN && !reduced ? Math.sin(tSec * 3.1 + i * 1.7) * 0.7 : 0);
      const rx = cx + Math.cos(ang) * rr;
      const ry = cy + Math.sin(ang) * rr;
      if (reduced) {
        x = rx;
        y = ry;
        a = g * 0.9;
      } else {
        const gi = clamp01((g - S[s + 4] * 0.55) / 0.45);
        const e = 1 - (1 - gi) * (1 - gi) * (1 - gi);
        // A slow drift on the grains still on their way, so the cloud feels loose, not pinned.
        const wob = (1 - e) * 3;
        const fx = cx + S[s + 2] + Math.sin(tSec * 1.3 + i) * wob;
        const fy = cy + S[s + 3] + Math.cos(tSec * 1.1 + i * 0.7) * wob;
        x = fx + (rx - fx) * e;
        y = fy + (ry - fy) * e;
        a = (0.12 + 0.83 * e) * fadeIn;
        size = DOT * (0.55 + 0.45 * e);
        if (spinMix > 0) {
          // Comet: the brightness is tied to the grains, so it turns with them. Head bright, tail fading.
          const comet = 0.22 + 0.78 * Math.pow(S[s] / TAU, 1.6);
          a = a * (1 - spinMix) + comet * spinMix;
        }
      }
      if (a > 0.003) visible = true;
      P[p] = x;
      P[p + 1] = y;
      P[p + 2] = a;
      P[p + 3] = size;
      D[i * 4] = x;
      D[i * 4 + 1] = y;
      // Soft clip at the top edge of the list: grains below it would sit over the rows.
      D[i * 4 + 2] = clamp01(a * clamp01((vis - y) / 2));
      D[i * 4 + 3] = size;
    }
    painted.value = now;

    // Sleep once nothing shows and nothing is pending: two quiet frames in a row.
    if (!visible && ph === IDLE && !dragging.value && vis < 0.01) {
      quiet.value += 1;
    } else quiet.value = 0;
  }, true);

  function wake() {
    quiet.value = 0;
  }

  /**
   * The new PullItems on screen: their final box (list back at the top) in window and root
   * coordinates, and a snapshot taken while they are still hidden. Null when there is none.
   */
  async function findNew() {
    const known = before.current;
    if (!known) return null;
    const fresh = [...items.current].filter(([id]) => !known.has(id)).map(([, e]) => e);
    if (!fresh.length) return null;
    const [root, boxes] = await Promise.all([measure(rootRef), Promise.all(fresh.map((e) => measure(e.ref)))]);
    if (!root) {
      fresh.forEach((e) => e.reveal());
      return null;
    }
    // The list is held under the ring: where each item sits once it is back at the top.
    const lift = visualOf();
    const out: { entry: Entry; box: Box; local: Box; area: number; shot: ReturnType<typeof capture> }[] = [];
    fresh.forEach((entry, k) => {
      const b = boxes[k];
      if (!b || b.width <= 0 || b.height <= 0) return entry.reveal();
      const box = { x: b.x, y: b.y - lift, width: b.width, height: b.height };
      const local = { x: box.x - root.x, y: box.y - root.y, width: box.width, height: box.height };
      const vw = Math.min(local.x + local.width, root.width) - Math.max(local.x, 0);
      const vh = Math.min(local.y + local.height, root.height) - Math.max(local.y, 0);
      // Below the fold: nothing to watch, it just shows.
      if (vw <= 0 || vh <= 0) return entry.reveal();
      out.push({ entry, box, local, area: vw * vh, shot: capture(entry.ref) });
    });
    return out.length ? out : null;
  }

  /**
   * The ring pinches into a small knot at its center. The new items then stream out of that same
   * knot (stream preset, direction in), so the grains that leave the ring are the ones that land.
   */
  function aimCenter() {
    const A = new Array(N * 2).fill(0);
    const cx = width.value / 2;
    const cy = dustCy.value;
    for (let i = 0; i < N; i++) {
      const r = 1.5 + hash(i, 11) * 3;
      const t = hash(i, 12) * TAU;
      A[i * 2] = cx + Math.cos(t) * r;
      A[i * 2 + 1] = cy + Math.sin(t) * r;
    }
    aim.value = A;
  }

  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    wake();
    const animate = rebuild && !reduced && !ctx.reduced;
    before.current = new Set(items.current.keys());
    hideNew.current = animate;
    if (!reduced) setMoving(true);
    const t0 = Date.now();
    let ok = true;
    try {
      await onRefreshRef.current();
    } catch {
      ok = false;
    }
    const left = MIN_SPIN - (Date.now() - t0);
    if (left > 0) await wait(left);
    if (!alive.current) return;
    if (haptics) Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    wake();

    // Give the new data a frame to land, then look for the new items.
    let landing = null;
    if (animate && ok) {
      await frames(2);
      if (!alive.current) return;
      landing = await findNew();
      if (!alive.current) return;
    }

    if (landing) {
      const targets = landing;
      const root = await measure(rootRef);
      if (!alive.current) return;
      aimCenter();
      // Source of the stream: the knot the ring pinches into, in window coords.
      const knot = root ? { x: root.x + width.value / 2 - 5, y: root.y + dustCy.value - 5, width: 10, height: 10 } : null;
      leave.value = FLYING;
      phase.value = DONE;
      // One gesture: the list eases back while the items that stay reflow and the ring pinches.
      hold.value = withTiming(0, { duration: SETTLE, easing: CALM });
      await wait(FLY - LAND);
      if (!alive.current) return;
      await Promise.all(
        targets.map(
          ({ entry, box, shot }) =>
            new Promise<void>((done) => {
              let shown = false;
              const reveal = () => {
                if (shown) return;
                shown = true;
                entry.reveal();
                done();
              };
              shot
                .then((s) => (s ? runDissolve(ctx, entry.ref, knot ? { preset: 'stream', direction: 'in', to: knot, duration: GATHER, haptics: false } : { preset: 'gather', direction: 'in', duration: GATHER, haptics: false }, { image: s.image, box, onFinish: reveal }) : null))
                .then((res) => {
                  if (!res) reveal();
                })
                .catch(reveal);
            }),
        ),
      );
      if (!alive.current) return;
      phase.value = IDLE;
      latched.value = 0;
    } else {
      // Nothing new, or it failed: the ring falls away as dust and the list glides back.
      [...items.current].forEach(([id, e]) => {
        if (before.current && !before.current.has(id)) e.reveal();
      });
      leave.value = DUSTING;
      phase.value = DONE;
      if (!reduced) await wait(DUST * 0.5);
      if (!alive.current) return;
      hold.value = withTiming(0, { duration: reduced ? 200 : SETTLE, easing: CALM }, (fin) => {
        if (fin) {
          phase.value = IDLE;
          latched.value = 0;
        }
      });
      await wait(reduced ? 200 : SETTLE);
      if (!alive.current) return;
    }
    before.current = null;
    hideNew.current = false;
    setMoving(false);
    busy.current = false;
  }

  const begin = () => {
    'worklet';
    dragging.value = 1;
    armed.value = 0;
    quiet.value = 0;
  };
  /** Threshold crossing while the finger is down: close the ring once per drag. */
  const track = () => {
    'worklet';
    if (!dragging.value || phase.value !== IDLE || armed.value) return;
    if (visualOf() >= thr.value) {
      armed.value = 1;
      closeReq.value = 1;
      scheduleOnRN(tick);
    }
  };
  const start = () => {
    'worklet';
    phase.value = SPIN;
    scheduleOnRN(refresh);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y + (e.contentInset?.top ?? 0);
      if (scrollY.value < 0) quiet.value = 0;
      // The bounce after release has brought the list back to its held spot.
      if (phase.value !== IDLE && !latched.value && scrollY.value > -0.5) latched.value = 1;
      track();
    },
    onBeginDrag: (e) => {
      scrollY.value = e.contentOffset.y + (e.contentInset?.top ?? 0);
      begin();
    },
    onEndDrag: (e) => {
      scrollY.value = e.contentOffset.y + (e.contentInset?.top ?? 0);
      dragging.value = 0;
      if (!IOS) return;
      if (phase.value === IDLE && visualOf() >= thr.value) {
        // Hold the threshold: the native bounce runs on, the list stops under the ring.
        hold.value = thr.value;
        latched.value = 0;
        start();
      }
    },
  });

  // Android and web: no overscroll past the top, a pan takes over at the top instead.
  const pan = Gesture.Pan()
    .enabled(!IOS)
    .manualActivation(true)
    .onTouchesDown((e) => {
      startY.value = e.allTouches[0]?.absoluteY ?? 0;
    })
    .onTouchesMove((e, m) => {
      const dy = (e.allTouches[0]?.absoluteY ?? 0) - startY.value;
      if (phase.value === DONE || scrollY.value > 1 || dy < -6) m.fail();
      else if (dy > 6) m.activate();
    })
    .onStart(() => {
      begin();
    })
    .onUpdate((e) => {
      const d = e.translationY > 0 ? e.translationY : 0;
      const Tv = thr.value;
      drag.value = d < Tv ? d : Tv + (d - Tv) * 0.5;
      track();
    })
    .onEnd(() => {
      if (phase.value === IDLE && drag.value >= thr.value) {
        hold.value = drag.value;
        hold.value = withTiming(thr.value, { duration: 320, easing: CALM });
        latched.value = 1;
        drag.value = 0;
        start();
      } else drag.value = withTiming(0, { duration: reduced ? 200 : 380, easing: CALM });
    })
    .onFinalize(() => {
      dragging.value = 0;
    });

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shiftOf() }],
  }));
  // The grains are plain Animated views driven by transform and opacity only. While a scroll view
  // is being dragged, iOS holds back Skia redraws and layout commits (a clip height would stay
  // stuck at 0), but Reanimated transform and opacity updates still land every frame.

  const scroll: PullScrollProps = {
    onScroll,
    scrollEventThrottle: 16,
    bounces: true,
    alwaysBounceVertical: true,
    overScrollMode: 'never',
  };

  return (
    <PullContext.Provider value={pull}>
      <View
        className={cn('flex-1 overflow-hidden', className)}
        onLayout={(e: LayoutChangeEvent) => {
          width.value = e.nativeEvent.layout.width;
        }}
      >
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, listStyle]}>
            {typeof children === 'function' ? (
              children(scroll)
            ) : (
              <Animated.ScrollView {...scroll} contentContainerStyle={contentContainerStyle}>
                {children}
              </Animated.ScrollView>
            )}
          </Animated.View>
        </GestureDetector>
        {/* Plain RN view, never transformed: the grains' frame, and the origin for the landing points. */}
        <RNView ref={rootRef} collapsable={false} pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          {GRAINS.map((i) => (
            <Grain key={i} i={i} draw={draw} painted={painted} color={ink} />
          ))}
        </RNView>
      </View>
    </PullContext.Provider>
  );
}

/** Layout keys that live on the outer box, so the item sizes and sits in your layout like one view. */
const OUTER_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'position', 'top', 'left', 'right', 'bottom', 'start', 'end', 'zIndex',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginStart', 'marginEnd', 'marginHorizontal', 'marginVertical',
]);
const FILL_KEYS = ['flex', 'flexGrow', 'flexBasis', 'height', 'minHeight', 'aspectRatio'];

/**
 * One item of the refreshed content. Wrap each row, card or tile, any layout. Items that stay
 * glide to their new place around a refresh; a new one is built from the ring grains.
 */
export function PullItem({ id, children, className, style }: PullItemProps) {
  const pull = useContext(PullContext);
  const ref = useRef<RNViewRef>(null);
  // New when it mounts during a refresh with an id the refresh did not start with.
  const [fresh] = useState(() => pull?.isNew(id) ?? false);
  const shown = useSharedValue(fresh ? HIDDEN : 1);
  const register = pull?.register;
  useEffect(() => {
    if (!register) return;
    return register(id, {
      ref,
      reveal: () => {
        shown.value = 1;
      },
    });
  }, [register, id, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) (OUTER_KEYS.has(key) ? outer : inner)[key] = flat[key];
  // Only stretch the item when the outer box has a size of its own to fill.
  const sized = FILL_KEYS.some((k) => outer[k] != null);
  const fill = sized ? { flexGrow: 1 } : null;

  return (
    <Reanimated.View layout={pull?.moving ? MOVE : undefined} style={[outer as ViewStyle, fade]}>
      {/* Plain RN view at full opacity: what the entrance captures, while the outer box hides it. */}
      <RNView ref={ref} collapsable={false} style={fill}>
        <View className={className} style={[fill, inner as ViewStyle]}>
          {children}
        </View>
      </RNView>
    </Reanimated.View>
  );
}

const GRAINS = Array.from({ length: N }, (_, i) => i);

/** One grain: a dot positioned from the shared draw buffer, re-read on every painted frame. */
function Grain({ i, draw, painted, color }: { i: number; draw: SharedValue<number[]>; painted: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    // Read to subscribe: the style re-runs on every painted frame.
    painted.value;
    const D = draw.value;
    const k = i * 4;
    const size = D[k + 3];
    return {
      opacity: D[k + 2],
      transform: [{ translateX: D[k] - DOT / 2 }, { translateY: D[k + 1] - DOT / 2 }, { scale: size > 0 ? size / DOT : 0 }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: color }, style]} />;
}
