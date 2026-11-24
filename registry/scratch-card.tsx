/**
 * ScratchCard, from dissolve (dissolve-ui). This file is yours: change the foil, the
 * brush, the tilt, the copy, anything. The foil is an explicit color (the color prop), not a theme
 * token, so it looks the same in light and dark mode, like a printed ticket. The card under it
 * follows the dissolve theme tokens (global.css).
 *
 * A lottery style card with a glossy metal foil over your content. The foil is one shader: a
 * brushed silver gradient with a fine grain, a faint holographic tint, a bevel lit along the edge
 * and a specular band. The whole card tilts in 3D under the finger (perspective, up to `tilt`
 * degrees) and the light moves with it, then it springs back flat on release.
 * Scratching erases the foil along a ragged stroke, like a coin or a nail (chipped stamps, width
 * following the speed, rough ends), and sheds it as grains that flick off and fall. Past
 * `threshold` of the surface, the rest of the foil turns to dust, Success haptic, onReveal.
 *
 * Needs <DissolveProvider> above it for the final dust.
 *
 * <ScratchCard onReveal={claim}>
 *   <Text className="text-[40px] font-bold text-dissolve-foreground">$25</Text>
 * </ScratchCard>
 *
 * const card = useRef<ScratchCardHandle>(null);
 * <ScratchCard ref={card} color="#D9B26F" label="Scratch for your code" brush={44} threshold={0.6}>
 *   <PromoCode code="SPRING25" />
 * </ScratchCard>
 * card.current?.reset();
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, View as RNView, type BoxShadowValue } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Atlas,
  Canvas,
  Fill,
  FilterMode,
  Group,
  MipmapMode,
  Path,
  Shader,
  Skia,
  Text as SkText,
  matchFont,
  rect,
  useCanvasRef,
  type SkPath,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import {
  makeMutable,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { frames, measure, runDissolve, useDissolveContext, type ViewRef } from 'dissolve-ui';
import { Animated, View, cn } from './tw';
import { argb, atlasColors, makeColors, makeSprite, notify, toRGB } from './dots';
import { CALM, hash, wait } from './motion';

export type ScratchCardHandle = {
  /** Puts the foil back, untouched. */
  reset: () => void;
  /** Dissolves the remaining foil now, as if the threshold was reached. */
  reveal: () => Promise<void>;
  /** Share of the foil scratched so far, 0..1. */
  progress: () => number;
};

export type ScratchCardProps = {
  /** What the foil hides: a reward, a promo code, any node. Centered on the card. */
  children?: ReactNode;
  /** Card width in points. Default 320. */
  width?: number;
  /** Card height in points. Default 200. */
  height?: number;
  /** Corner radius. Default 24. */
  radius?: number;
  /** Foil base color. Default '#C3C8D0' (silver). A warm tone like '#D9B26F' gives gold. */
  color?: string;
  /** Text printed on the foil, erased with it. Empty hides it. Default 'Scratch to reveal'. */
  label?: string;
  /** Scratch stroke width in points. Default 38. */
  brush?: number;
  /** Share of the foil to scratch before the rest dissolves, 0..1. Default 0.55. */
  threshold?: number;
  /** Max tilt in degrees under the finger. 0 keeps the card flat. Default 9. Off under reduced motion. */
  tilt?: number;
  /** Selection ticks while scratching, Success on reveal. Default true. */
  haptics?: boolean;
  /** No scratching (the card still shows). Default false. */
  disabled?: boolean;
  /** Called once the foil is gone. */
  onReveal?: () => void;
  /** Called on the first stroke after mount or reset. */
  onScratchStart?: () => void;
  /** Card classes (background, border...). The content sits on bg-dissolve-surface by default. */
  className?: string;
  /** Classes of the box that centers the children. */
  contentClassName?: string;
  ref?: Ref<ScratchCardHandle>;
};

/** Coverage grid: columns across the card, rows follow the aspect ratio. */
const COLS = 24;
/** Grain pool, recycled in a ring. */
const N = 160;
/** Per grain: x y vx vy born life size shade. */
const G = 8;
/** Sprite resolution in pixels, scaled down to the grain size by the Atlas. */
const SPR = 16;
/** Room the falling grains get around the card. */
const PAD = 40;
const FALL = 160;
const GRAVITY = 1100;
/** Points of fresh foil scratched between two haptic ticks. */
const TICK = 22;
/** Tilt springs: soft while following the finger, a little bounce on the way back. */
const FOLLOW = { damping: 20, stiffness: 220, mass: 1 };
const BACK = { damping: 11, stiffness: 150, mass: 1 };

const FOIL = `
uniform float2 res;
uniform float2 tilt;
uniform float3 base;
uniform float radius;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float box(float2 p) {
  float2 q = abs(p - res * 0.5) - res * 0.5 + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

half4 main(float2 xy) {
  float2 uv = xy / res;
  // Brushed metal: soft diagonal bands that slide with the tilt.
  float w = (uv.x * 1.1 + uv.y * 0.7) * 3.2 + tilt.x * 1.4 + tilt.y * 0.9;
  float band = 0.5 + 0.5 * sin(w) * 0.6 + 0.5 * sin(w * 2.3 + 1.7) * 0.25;
  float3 col = base * (0.80 + 0.30 * band);
  // Holographic hint: a pastel spectrum that drifts as the card turns.
  float h = fract(uv.x * 0.55 + uv.y * 0.35 + tilt.x * 0.3 - tilt.y * 0.2);
  float3 rainbow = 0.5 + 0.5 * cos(6.2831853 * (h + float3(0.0, 0.33, 0.67)));
  col = mix(col, col * (0.75 + 0.5 * rainbow), 0.10);
  // Specular band, lit from where the card leans.
  float2 dir = normalize(float2(1.0, 0.55));
  float p = dot(uv - 0.5, dir);
  float c = -0.18 - tilt.x * 0.42 - tilt.y * 0.24;
  float spec = exp(-pow((p - c) / 0.09, 2.0));
  float sheen = exp(-pow((p - c) / 0.32, 2.0));
  col += spec * 0.30 + sheen * 0.08;
  // Fine grain and brushed streaks.
  float n = hash(floor(xy * 1.4)) - 0.5;
  float s = hash(float2(floor(xy.y * 0.8), floor(xy.x / 36.0))) - 0.5;
  col += n * 0.07 + s * 0.035;
  // Bevel: light on the edges facing the light, shade on the others.
  float d = box(xy);
  float e = 1.0 - clamp(-d / 3.0, 0.0, 1.0);
  float2 g = float2(box(xy + float2(1.0, 0.0)) - box(xy - float2(1.0, 0.0)), box(xy + float2(0.0, 1.0)) - box(xy - float2(0.0, 1.0)));
  float2 nrm = length(g) > 0.0001 ? normalize(g) : float2(0.0, -1.0);
  float2 L = normalize(float2(-0.45 - tilt.x * 0.4, -0.9 - tilt.y * 0.4));
  col += e * dot(nrm, L) * 0.22;
  // A touch darker toward the bottom, like a lit surface.
  col *= 1.0 - 0.10 * smoothstep(0.45, 1.0, uv.y);
  return half4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const effect = Skia.RuntimeEffect.Make(FOIL)!;
const TAU = Math.PI * 2;

/**
 * One scratch stamp: a polygon of `verts` points at radius r, each pulled in by up to 20 percent,
 * sometimes one deep chip. Seeded by id. Points go round the same way for every stamp, so the
 * overlapping stamps of a path union cleanly.
 */
function chip(p: SkPathBuilder, x: number, y: number, r: number, id: number, verts: number) {
  'worklet';
  const a0 = hash(id, 11) * TAU;
  const deep = hash(id, 12) < 0.18 ? Math.floor(hash(id, 13) * verts) : -1;
  for (let v = 0; v < verts; v++) {
    const k = v === deep ? 0.55 : 0.8 + 0.2 * hash(id, 20 + v);
    const a = a0 + (v / verts) * TAU;
    const px = x + Math.cos(a) * r * k;
    const py = y + Math.sin(a) * r * k;
    if (v === 0) p.moveTo(px, py);
    else p.lineTo(px, py);
  }
  p.close();
}

/**
 * A scratch card. Drag a finger over the foil to erase it; past the threshold the rest of the
 * foil dissolves and the content is yours. The card tilts with the finger and its light follows.
 */
export function ScratchCard({
  children,
  width = 320,
  height = 200,
  radius = 24,
  color = '#C3C8D0',
  label = 'Scratch to reveal',
  brush = 38,
  threshold = 0.55,
  tilt = 9,
  haptics = true,
  disabled = false,
  onReveal,
  onScratchStart,
  className,
  contentClassName,
  ref,
}: ScratchCardProps) {
  const ctx = useDissolveContext();
  const reduced = useReducedMotion();
  const W = width;
  const H = height;
  const rows = Math.max(4, Math.round((COLS * H) / W));
  const maxTilt = reduced ? 0 : tilt;

  const foilRef = useRef<ViewRef>(null);
  const canvasRef = useCanvasRef();
  const [gone, setGone] = useState(false);
  const revealing = useRef(false);

  const cbs = useRef({ onReveal, onScratchStart });
  cbs.current = { onReveal, onScratchStart };

  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }), fontSize: 15, fontWeight: '600' }), []);
  const labelW = useMemo(() => (label ? font.measureText(label).width : 0), [font, label]);

  const rgb = useMemo(() => toRGB(color), [color]);
  const ink = `rgba(${Math.round(rgb[0] * 255 * 0.42)}, ${Math.round(rgb[1] * 255 * 0.42)}, ${Math.round(rgb[2] * 255 * 0.45)}, 0.78)`;

  /**
   * Everything scratched so far. SkPath is immutable since Skia 2.14, so each move copies it into
   * a PathBuilder, adds that move's stamps and swaps the shared value (see lay).
   */
  const path = useSharedValue<SkPath>(Skia.Path.Make());
  /** Live stroke: last point (NaN between strokes), distance to the next stamp, stamps laid, width, stamp id. */
  const sx = useSharedValue(NaN);
  const sy = useSharedValue(NaN);
  const carry = useSharedValue(0);
  const laid = useSharedValue(0);
  const nib = useSharedValue(1);
  const sid = useSharedValue(0);
  const ldx = useSharedValue(0);
  const ldy = useSharedValue(0);
  const { cells, grains, sprite, sprites, transforms, colors } = useMemo(
    () => ({
      cells: makeMutable<number[]>(new Array(COLS * rows).fill(0)),
      grains: makeMutable<number[]>(new Array(N * G).fill(0)),
      sprite: makeSprite(SPR - 2),
      sprites: new Array(N).fill(0).map(() => rect(0, 0, SPR, SPR)),
      transforms: makeMutable(new Array(N).fill(0).map(() => Skia.RSXform(0, 0, -100, -100))),
      colors: makeColors(N),
    }),
    [rows],
  );
  const covered = useSharedValue(0);
  const done = useSharedValue(0);
  const started = useSharedValue(0);
  const head = useSharedValue(0);
  const live = useSharedValue(0);
  const seq = useSharedValue(0);
  const fresh = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const press = useSharedValue(0);
  const foil = useSharedValue(1);
  const base = useSharedValue(rgb);
  useEffect(() => {
    base.value = rgb;
  }, [base, rgb]);

  const uniforms = useDerivedValue(() => ({ res: [W, H], tilt: [tx.value, ty.value], base: base.value, radius }));

  const tick = useCallback(() => {
    if (haptics) Haptics.selectionAsync();
  }, [haptics]);

  const begin = useCallback(() => cbs.current.onScratchStart?.(), []);

  const finish = useCallback(
    async (ox: number, oy: number) => {
      if (revealing.current) return;
      revealing.current = true;
      done.value = 1;
      started.value = 1;
      tx.value = withTiming(0, { duration: 160, easing: CALM });
      ty.value = withTiming(0, { duration: 160, easing: CALM });
      press.value = withTiming(0, { duration: 160, easing: CALM });
      const success = () => {
        if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cbs.current.onReveal?.();
      };
      if (ctx.reduced || reduced) {
        foil.value = withTiming(0, { duration: 220 });
        await wait(220);
        setGone(true);
        success();
        return;
      }
      // Flat again before the snapshot, so the dust starts exactly where the foil sits.
      await wait(170);
      const view = canvasRef.current;
      const box = await measure(foilRef);
      if (!view || !box) {
        setGone(true);
        success();
        return;
      }
      const snap = await view.makeImageSnapshotAsync();
      // A CPU copy for the dust; the GPU snapshot is not needed past this point.
      const shot = snap.makeNonTextureImage() ?? snap;
      if (shot !== snap) snap.dispose();
      // The engine owns the copy: it frees it once the dust is gone.
      const res = await runDissolve(ctx, foilRef, { preset: 'dust', origin: { x: ox, y: oy }, duration: 1100, haptics: false }, { image: shot, box, owned: [shot] });
      await frames(2);
      setGone(true);
      success();
      if (res) await wait(res.duration * 0.4);
    },
    [ctx, reduced, haptics, canvasRef, done, tx, ty, press, foil],
  );

  const reset = useCallback(() => {
    revealing.current = false;
    path.value = Skia.Path.Make();
    sx.value = NaN;
    sy.value = NaN;
    cells.value = new Array(COLS * rows).fill(0);
    covered.value = 0;
    done.value = 0;
    started.value = 0;
    fresh.value = 0;
    setGone(false);
    foil.value = 0;
    foil.value = withTiming(1, { duration: 320, easing: CALM });
  }, [path, sx, sy, cells, rows, covered, done, started, fresh, foil]);

  const reveal = useCallback(() => finish(W / 2, H / 2), [finish, W, H]);

  useImperativeHandle(ref, () => ({ reset, reveal, progress: () => covered.value / (COLS * rows) }), [reset, reveal, covered, rows]);

  /** Marks the grid cells the segment (x0 y0) to (x1 y1) uncovers. Returns how many were new. */
  const mark = (x0: number, y0: number, x1: number, y1: number) => {
    'worklet';
    const r = brush / 2;
    const cw = W / COLS;
    const ch = H / rows;
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - r) / cw));
    const c1 = Math.min(COLS - 1, Math.floor((Math.max(x0, x1) + r) / cw));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - r) / ch));
    const r1 = Math.min(rows - 1, Math.floor((Math.max(y0, y1) + r) / ch));
    const C = cells.value;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let added = 0;
    for (let j = r0; j <= r1; j++) {
      for (let i = c0; i <= c1; i++) {
        const k = j * COLS + i;
        if (C[k]) continue;
        const cx = (i + 0.5) * cw;
        const cy = (j + 0.5) * ch;
        let t = len2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x0 + dx * t - cx;
        const ey = y0 + dy * t - cy;
        if (ex * ex + ey * ey <= r * r) {
          C[k] = 1;
          added++;
        }
      }
    }
    if (added) covered.value += added;
    return added;
  };

  /** Sheds `n` foil grains around (x, y), flicked against the stroke direction. */
  const shed = (x: number, y: number, ux: number, uy: number, n: number) => {
    'worklet';
    const A = grains.value;
    const r = brush / 2;
    for (let q = 0; q < n; q++) {
      const s = seq.value++;
      const i = head.value;
      head.value = (i + 1) % N;
      const k = i * G;
      const a = hash(s, 1) * Math.PI * 2;
      const d = r * (0.35 + 0.6 * hash(s, 2));
      A[k] = x + Math.cos(a) * d;
      A[k + 1] = y + Math.sin(a) * d;
      const flick = 60 + hash(s, 3) * 140;
      A[k + 2] = -ux * flick * 0.6 + (hash(s, 4) - 0.5) * 160;
      A[k + 3] = -uy * flick * 0.4 - 90 - hash(s, 5) * 120;
      A[k + 4] = -1;
      A[k + 5] = 520 + hash(s, 6) * 420;
      A[k + 6] = 1.6 + hash(s, 7) * 2.2;
      A[k + 7] = 0.7 + hash(s, 8) * 0.5;
    }
    live.value = 1;
  };

  /**
   * Lays the stroke from the last point to (x, y) as stamps a third of their radius apart. Each
   * stamp is a chipped polygon (seeded by its id, so it never flickers), its width follows the
   * speed (thinner when fast) with some noise, the first stamps of a stroke are smaller, and some
   * leave a small chip past the edge: a ragged nail or coin scratch, not a clean round brush.
   */
  const lay = (x: number, y: number, speed: number) => {
    'worklet';
    const P = Skia.PathBuilder.MakeFromPath(path.value);
    const px = sx.value === sx.value ? sx.value : x;
    const py = sy.value === sy.value ? sy.value : y;
    const dx = x - px;
    const dy = y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.5) {
      ldx.value = dx / d;
      ldy.value = dy / d;
    }
    const target = 1.08 - Math.min(0.4, speed / 2600);
    let t = carry.value;
    while (t <= d) {
      const k = d > 0 ? t / d : 0;
      nib.value += (target - nib.value) * 0.2;
      const id = sid.value++;
      const n = laid.value++;
      const taper = n < 3 ? 0.55 + n * 0.15 : 1;
      const r = (brush / 2) * nib.value * (0.86 + 0.18 * hash(id, 31)) * taper;
      const cx = px + dx * k;
      const cy = py + dy * k;
      chip(P, cx, cy, r, id, 11);
      if (hash(id, 32) < 0.4) {
        const side = hash(id, 33) < 0.5 ? -1 : 1;
        const off = r * (0.82 + 0.2 * hash(id, 34));
        chip(P, cx - ldy.value * side * off, cy + ldx.value * side * off, r * (0.12 + 0.14 * hash(id, 35)), id + 7919, 6);
      }
      t += Math.max(2, r * 0.38);
      if (d === 0) break;
    }
    carry.value = t - d;
    sx.value = x;
    sy.value = y;
    path.value = P.detach();
  };

  /** Rough end of a stroke: a couple of small chips just past the last point. */
  const lift = () => {
    'worklet';
    if (sx.value !== sx.value) return;
    const id = sid.value++;
    const r = (brush / 2) * nib.value;
    const P = Skia.PathBuilder.MakeFromPath(path.value);
    chip(P, sx.value + ldx.value * r * 0.45, sy.value + ldy.value * r * 0.45, r * (0.3 + 0.15 * hash(id, 36)), id, 8);
    chip(P, sx.value + ldx.value * r * 0.7 - ldy.value * r * 0.25, sy.value + ldy.value * r * 0.7 + ldx.value * r * 0.25, r * 0.14, id + 7919, 6);
    sx.value = NaN;
    sy.value = NaN;
    path.value = P.detach();
  };

  const tiltTo = (x: number, y: number) => {
    'worklet';
    if (!maxTilt) return;
    const nx = Math.max(-1, Math.min(1, (x / W) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, (y / H) * 2 - 1));
    tx.value = withSpring(nx, FOLLOW);
    ty.value = withSpring(ny, FOLLOW);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      tiltTo(e.x, e.y);
      if (maxTilt) press.value = withSpring(1, FOLLOW);
      if (done.value) return;
      sx.value = NaN;
      sy.value = NaN;
      carry.value = 0;
      laid.value = 0;
      nib.value = 1;
      lay(e.x, e.y, 0);
      const added = mark(e.x, e.y, e.x, e.y);
      if (added) shed(e.x, e.y, 0, 0, Math.min(6, 2 + added));
      if (!started.value) {
        started.value = 1;
        scheduleOnRN(begin);
      }
    })
    .onUpdate((e) => {
      tiltTo(e.x, e.y);
      if (done.value) return;
      const lx = sx.value;
      const ly = sy.value;
      if (lx !== lx) return;
      const dx = e.x - lx;
      const dy = e.y - ly;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 2.5) return;
      lay(e.x, e.y, Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY));
      const added = mark(lx, ly, e.x, e.y);
      if (added) {
        shed(e.x, e.y, dx / (d || 1), dy / (d || 1), Math.min(7, 1 + Math.ceil(added * 0.8) + Math.floor(d / 14)));
        fresh.value += d;
        if (fresh.value >= TICK) {
          fresh.value = 0;
          scheduleOnRN(tick);
        }
      } else if (hash(seq.value++, 9) < 0.25) shed(e.x, e.y, dx / (d || 1), dy / (d || 1), 1);
      if (covered.value >= threshold * COLS * rows) {
        done.value = 1;
        scheduleOnRN(finish, e.x, e.y);
      }
    })
    .onFinalize(() => {
      if (!done.value) lift();
      sx.value = NaN;
      sy.value = NaN;
      tx.value = withSpring(0, BACK);
      ty.value = withSpring(0, BACK);
      press.value = withSpring(0, BACK);
    });

  // Grains: always registered, idle frames return at once (no wake round trip to the JS thread).
  useFrameCallback((info) => {
    'worklet';
    if (!live.value) return;
    const now = info.timestamp;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const A = grains.value;
    const T_ = transforms.value;
    const K_ = colors.value;
    const b = base.value;
    let alive = 0;
    for (let i = 0; i < N; i++) {
      const k = i * G;
      if (A[k + 5] <= 0) continue;
      if (A[k + 4] < 0) A[k + 4] = now;
      const age = (now - A[k + 4]) / A[k + 5];
      if (age >= 1) {
        A[k + 5] = 0;
        T_[i].set(0, 0, -100, -100);
        K_[i] = 0;
        continue;
      }
      alive++;
      A[k + 2] *= 1 - 1.2 * dt;
      A[k + 3] += GRAVITY * dt;
      A[k] += A[k + 2] * dt;
      A[k + 1] += A[k + 3] * dt;
      const m = (A[k + 6] * (1 - 0.4 * age)) / SPR;
      T_[i].set(m, 0, A[k] + PAD - (m * SPR) / 2, A[k + 1] + PAD - (m * SPR) / 2);
      const sh = A[k + 7];
      const fade = age < 0.55 ? 1 : 1 - (age - 0.55) / 0.45;
      K_[i] = argb(b[0] * sh, b[1] * sh, b[2] * sh, fade * fade);
    }
    live.value = alive;
    notify(transforms);
    notify(colors);
  });

  const card = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${-ty.value * maxTilt}deg` },
      { rotateY: `${tx.value * maxTilt}deg` },
      { scale: 1 - press.value * 0.012 },
    ],
  }));
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: -tx.value * W * 0.28 }, { translateY: -ty.value * H * 0.2 }] }));
  const foilStyle = useAnimatedStyle(() => ({ opacity: foil.value }));

  const shadow: BoxShadowValue[] = [
    { offsetX: 0, offsetY: 18, blurRadius: 34, spreadDistance: -14, color: 'rgba(0, 0, 0, 0.32)' },
    { offsetX: 0, offsetY: 2, blurRadius: 6, color: 'rgba(0, 0, 0, 0.10)' },
  ];

  return (
    <View style={{ width: W, height: H }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ width: W, height: H, borderRadius: radius, boxShadow: shadow }, card]} accessibilityRole="image" accessibilityLabel={gone ? 'Revealed' : label || 'Scratch card'}>
          <View className={cn('flex-1 overflow-hidden bg-dissolve-surface', className)} style={{ borderRadius: radius }}>
            <View className={cn('flex-1 items-center justify-center', contentClassName)}>{children}</View>

            {!gone ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, foilStyle]}>
                <RNView ref={foilRef} collapsable={false} style={StyleSheet.absoluteFill}>
                  <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Group layer>
                      <Fill>
                        <Shader source={effect} uniforms={uniforms} />
                      </Fill>
                      {label ? (
                        <Group>
                          <SkText x={(W - labelW) / 2} y={H / 2 + 6} text={label} font={font} color="rgba(255, 255, 255, 0.55)" />
                          <SkText x={(W - labelW) / 2} y={H / 2 + 5} text={label} font={font} color={ink} />
                        </Group>
                      ) : null}
                      <Path path={path} color="black" blendMode="clear" />
                    </Group>
                  </Canvas>
                </RNView>
              </Animated.View>
            ) : null}

            {/* Glass over everything: a soft diagonal sheen that slides with the tilt, and a lit rim. */}
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', top: -H * 0.25, bottom: -H * 0.25, left: -W * 0.5, right: -W * 0.5 },
                { experimental_backgroundImage: 'linear-gradient(115deg, rgba(255, 255, 255, 0) 38%, rgba(255, 255, 255, 0.16) 50%, rgba(255, 255, 255, 0) 62%)' },
                sheen,
              ]}
            />
            <RNView
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 0, color: 'rgba(255, 255, 255, 0.35)', inset: true }, { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 0.5, color: 'rgba(0, 0, 0, 0.08)', inset: true }] }]}
            />
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Foil grains: outside the clip, so they fall past the card edge. */}
      <Canvas pointerEvents="none" style={{ position: 'absolute', left: -PAD, top: -PAD, width: W + PAD * 2, height: H + PAD + FALL }}>
        {sprite ? <Atlas image={sprite} sprites={sprites} transforms={transforms} colors={atlasColors(colors)} colorBlendMode="modulate" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} /> : null}
      </Canvas>
    </View>
  );
}
