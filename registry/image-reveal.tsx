/**
 * ImageReveal, from dissolve (dissolve-ui). This file is yours: restyle it with
 * classNames, change the timings, the grid, anything. Colors come from the dissolve theme
 * tokens (global.css), so it follows light and dark mode out of the box.
 *
 * Image generation loader: a quiet "thinking" mosaic while pending, then the image resolves
 * coarse to fine (8 cells, 16, 32, 64, 128) on a smoothstep over `duration`, and the finest
 * mosaic crossfades into the sharp image in 180 ms. Same pacing as the web port.
 * Everything is drawn by one shader: no view per cell.
 *
 * <ImageReveal src={result?.uri} status={generating ? 'pending' : 'ready'} className="rounded-[20px]" />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Canvas, ColorShader, Fill, ImageShader, Shader, Skia, useCanvasRef, useImage, type DataSourceParam } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { frames, measure, runDissolve, useDissolveContext, type ViewRef } from 'dissolve-ui';
import { View, cn, useToken } from './tw';
import { toRGBA } from './dots';
import { CALM } from './motion';

export type ImageRevealStatus = 'pending' | 'ready' | 'error';

export type ImageRevealProps = {
  /** Image source (require(...), uri string). Reveals once loaded and status is ready. */
  src?: DataSourceParam;
  /** Default: 'ready' when src is set, else 'pending'. */
  status?: ImageRevealStatus;
  /** Coarse to fine duration in ms (smoothstep), then a 180 ms crossfade to the sharp image. Default 1400. */
  duration?: number;
  /** Finest mosaic across the width before the sharp image. Default 160 (gives 128). */
  cells?: number;
  /** Width / height. Default 1. */
  aspectRatio?: number;
  /** Called once the sharp image is fully shown. */
  onRevealed?: () => void;
  /** Error: called once the mosaic has left as dust. */
  onDismissed?: () => void;
  /** Selection tick per resolution doubling, Success at the end. Default true. */
  haptics?: boolean;
  className?: string;
};

/** Finest mosaic to sharp image crossfade, in ms. */
const SHARPEN = 180;
/** Share of the timeline the finest level takes (the other levels take 1 each). */
const LAST = 0.3;

const SKSL = `
uniform shader image;
uniform float2 res;
uniform float lv;
uniform float lp;
uniform float sharp;
uniform float time;
uniform float hasImage;
uniform float err;
uniform float4 c0;
uniform float4 c1;
uniform float4 cd;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float4 waiting(float2 xy) {
  float cs = res.x / 12.0;
  float2 g = floor(xy / cs);
  float2 l = xy - g * cs;
  float n = hash(g + 7.0);
  float wave = 0.5 + 0.5 * sin((g.x + g.y) * 0.5 - time * 6.2831853 / 1.6);
  float pulse = 0.5 + 0.5 * sin(time * (1.3 + n * 1.7) + n * 6.2831853);
  float k = 0.1 + 0.5 * wave * wave * wave + 0.2 * pulse;
  float4 tile = mix(c0, c1, k);
  float inside = step(1.0, l.x) * step(1.0, l.y);
  return mix(c0, tile, inside);
}

float4 cell(float2 xy, float L) {
  float cs = res.x / (8.0 * exp2(L));
  float2 c = (floor(xy / cs) + 0.5) * cs;
  return image.eval(c);
}

half4 main(float2 xy) {
  float4 col = waiting(xy);
  if (hasImage > 0.5) {
    // Level lv: each cell of the finer grid switches past its own random threshold.
    float cs = res.x / (8.0 * exp2(lv));
    float th = hash(floor(xy / cs) + lv * 17.0);
    float4 prev = lv < 0.5 ? col : cell(xy, lv - 1.0);
    col = th < lp ? cell(xy, lv) : prev;
    if (sharp > 0.0) col = mix(col, image.eval(xy), sharp);
  }
  return half4(mix(col.rgb, cd.rgb, err * 0.55), col.a);
}
`;

const effect = Skia.RuntimeEffect.Make(SKSL)!;

export function ImageReveal({
  src,
  status,
  duration = 1400,
  cells = 160,
  aspectRatio = 1,
  onRevealed,
  onDismissed,
  haptics = true,
  className,
}: ImageRevealProps) {
  const ctx = useDissolveContext();
  const reduced = useReducedMotion();
  const phase: ImageRevealStatus = status ?? (src ? 'ready' : 'pending');
  const image = useImage(src ?? null);

  const s2 = useToken('surface-2');
  const muted = useToken('muted');
  const danger = useToken('danger');

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [gone, setGone] = useState(false);
  const wrapRef = useRef<ViewRef>(null);
  const canvasRef = useCanvasRef();

  const maxLv = Math.max(0, Math.floor(Math.log2(Math.max(8, cells) / 8)));
  /** Linear clock of the resolve, 0..1 over `duration`. */
  const t = useSharedValue(0);
  const sharp = useSharedValue(0);
  const err = useSharedValue(0);
  const time = useSharedValue(0);
  const frozen = useSharedValue(0);

  const cbs = useRef({ onRevealed, onDismissed });
  cbs.current = { onRevealed, onDismissed };

  // Waiting mosaic clock, frozen on error, under reduced motion and once the sharp image covers
  // it: the shader then redraws only when the reveal moves.
  useFrameCallback((info) => {
    'worklet';
    if (frozen.value || reduced || sharp.value >= 1) return;
    time.value += (info.timeSincePreviousFrame ?? 16) / 1000;
  });

  const tick = useCallback(() => {
    if (haptics) Haptics.selectionAsync();
  }, [haptics]);
  const revealed = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    cbs.current.onRevealed?.();
  }, [haptics]);

  // Web pacing: smoothstep over the duration, even steps so every doubling reads, the finest
  // level gets the last 0.3. lv is the level coming in, lp its share of switched cells.
  const level = useDerivedValue(() => {
    const k = t.value;
    const e = k * k * (3 - 2 * k);
    const L = (maxLv + LAST) * e;
    const lv = Math.min(maxLv, Math.floor(L));
    const lp = k >= 1 ? 1 : lv === maxLv ? Math.min(1, (L - maxLv) / LAST) : L - lv;
    return [lv, lp];
  });

  // One selection tick per resolution doubling (8 to 16, ..., 64 to 128).
  useAnimatedReaction(
    () => level.value[0],
    (cur, prev) => {
      if (!reduced && prev !== null && cur > prev && cur >= 1 && cur <= maxLv && sharp.value === 0) scheduleOnRN(tick);
    },
  );

  const dust = useCallback(async () => {
    const view = canvasRef.current;
    const box = await measure(wrapRef);
    if (!view || !box || ctx.reduced) {
      setGone(true);
      cbs.current.onDismissed?.();
      return;
    }
    const snap = await view.makeImageSnapshotAsync();
    // A CPU copy for the dust; the GPU snapshot is not needed past this point.
    const shot = snap.makeNonTextureImage() ?? snap;
    if (shot !== snap) snap.dispose();
    // The engine owns the copy: it frees it once the dust is gone.
    const res = await runDissolve(ctx, wrapRef, { preset: 'dust', duration: 1200, haptics }, { image: shot, box, owned: [shot] });
    await frames(2);
    setGone(true);
    if (res) await new Promise((r) => setTimeout(r, res.duration * 0.4));
    cbs.current.onDismissed?.();
  }, [canvasRef, ctx, haptics]);

  useEffect(() => {
    if (phase === 'pending') {
      cancelAnimation(t);
      cancelAnimation(sharp);
      t.value = 0;
      sharp.value = 0;
      err.value = 0;
      frozen.value = 0;
      setGone(false);
      return;
    }
    if (phase === 'error') {
      frozen.value = 1;
      cancelAnimation(t);
      err.value = withTiming(1, { duration: 200 }, (done) => {
        if (done) scheduleOnRN(dust);
      });
      return;
    }
    // ready: wait for the decoded image.
    if (!image) return;
    err.value = 0;
    frozen.value = 0;
    setGone(false);
    if (reduced) {
      t.value = 1;
      sharp.value = withTiming(1, { duration: 150 }, (done) => {
        if (done) scheduleOnRN(revealed);
      });
      return;
    }
    t.value = 0;
    sharp.value = 0;
    t.value = withTiming(1, { duration, easing: Easing.linear }, (done) => {
      if (!done) return;
      sharp.value = withTiming(1, { duration: SHARPEN, easing: CALM }, (ok) => {
        if (ok) scheduleOnRN(revealed);
      });
    });
  }, [phase, image, duration, reduced, t, sharp, err, frozen, dust, revealed]);

  const c0 = toRGBA(s2);
  const c1 = toRGBA(muted);
  const cd = toRGBA(danger);
  const hasImage = image && phase !== 'pending' ? 1 : 0;
  const uniforms = useDerivedValue(() => ({
    res: [size.w || 1, size.h || 1],
    lv: level.value[0],
    lp: level.value[1],
    sharp: sharp.value,
    time: time.value,
    hasImage,
    err: err.value,
    c0,
    c1,
    cd,
  }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
      className={cn('w-full overflow-hidden rounded-[20px]', !gone && 'bg-dissolve-surface-2', className)}
      style={{ aspectRatio }}
      accessibilityRole="image"
      accessibilityLabel={phase === 'pending' ? 'Generating image' : phase === 'error' ? 'Generation failed' : 'Generated image'}
    >
      <RNView ref={wrapRef} collapsable={false} style={StyleSheet.absoluteFill} pointerEvents="none">
        {size.w ? (
          <Canvas ref={canvasRef} style={[StyleSheet.absoluteFill, { opacity: gone ? 0 : 1 }]} pointerEvents="none">
            <Fill>
              <Shader source={effect} uniforms={uniforms}>
                {image ? <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width: size.w, height: size.h }} /> : <ColorShader color="transparent" />}
              </Shader>
            </Fill>
          </Canvas>
        ) : null}
      </RNView>
    </View>
  );
}
