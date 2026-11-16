/**
 * SweepTransition, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the band, anything. The rim color comes from the dissolve theme
 * tokens (global.css), so it follows light and dark mode out of the box.
 *
 * Wrap any view and call run() with your state change. The current view is captured, the new
 * state mounts under the capture, and a band sweeps across it, bending what it passes with a
 * light refraction, a hint of RGB split and a 1 pt accent rim. No blur.
 *
 * const sweep = useRef<SweepTransitionHandle>(null);
 * <SweepTransition ref={sweep} mode="vertical" className="rounded-3xl">
 *   <PlanCard plan={plan} />
 * </SweepTransition>
 * sweep.current?.run(() => setPlan('pro'), { revert: () => setPlan('free') });
 */
import { useCallback, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Canvas, Fill, Group, ImageShader, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { Easing, useAnimatedReaction, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { capture, frames, type ViewRef } from 'react-native-dissolve';
import { View, cn, useToken } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

export type SweepMode = 'vertical' | 'horizontal' | 'radial';

export type SweepRunOptions = {
  /** Radial center in local points. Default: the center of the view. */
  origin?: { x: number; y: number };
  /** Overrides the mode prop for this run. */
  mode?: SweepMode;
  /** Puts the old state back when the sweep is cancelled. */
  revert?: () => void;
};

export type SweepTransitionHandle = {
  /** Captures the view, runs apply under the capture, then sweeps it away. */
  run: (apply: () => void, options?: SweepRunOptions) => Promise<void>;
  /** Sends the front back in 300 ms, then calls the run revert. */
  cancel: () => void;
  /** True while a sweep is on screen. */
  running: () => boolean;
};

export type SweepTransitionProps = {
  ref?: Ref<SweepTransitionHandle>;
  /** Bottom to top, left to right, or a circle from the origin. Default 'vertical'. */
  mode?: SweepMode;
  /** Sweep length in ms, calm curve. Default 720. */
  duration?: number;
  /** Width of the refractive band in points. Default 28. */
  bandWidth?: number;
  /** Light at start, soft when the front passes half. Default true. */
  haptics?: boolean;
  /** Classes of the wrapper (size, radius, background). */
  className?: string;
  children: ReactNode;
};

/** Line for line port of the web fragment shader. Coordinates are local points, top left origin. */
const SKSL = `
uniform shader old;
uniform float2 size;
uniform float2 origin;
uniform float p;
uniform float band;
uniform float mode;
uniform float3 rim;

half4 S(float2 px) { return old.eval(clamp(px, float2(0.0), size)); }

half4 main(float2 px) {
  float d;
  float2 n;
  if (mode < 0.5) { float fy = size.y - p * (size.y + band); d = fy - px.y; n = float2(0.0, -1.0); }
  else if (mode < 1.5) { float fx = p * (size.x + band); d = px.x - fx; n = float2(1.0, 0.0); }
  else {
    float m = max(max(length(origin), length(origin - float2(size.x, 0.0))), max(length(origin - float2(0.0, size.y)), length(origin - size)));
    float2 v = px - origin;
    float L = length(v);
    d = L - p * (m + band);
    n = L > 0.001 ? v / L : float2(0.0, -1.0);
  }
  if (d < 0.0) { return half4(0.0); }
  if (d < band) {
    float k = d / band;
    float2 q = px - n * sin(3.14159 * k) * 6.0;
    half4 c = S(q);
    c.r = S(q + n * 1.5).r;
    c.b = S(q - n * 1.5).b;
    float rimA = (1.0 - smoothstep(0.5, 1.5, d)) * 0.6;
    return mix(c, half4(half3(rim), 1.0), rimA);
  }
  return S(px);
}
`;

const effect = Skia.RuntimeEffect.Make(SKSL)!;

/** Token string (rgb(10 132 255), rgb(1, 2, 3 / 0.5), #rrggbb) to 0..1 channels for the shader. */
function rgb(c: string): number[] {
  const s = c.trim();
  if (s[0] === '#') {
    const h = s.length === 4 ? [...s.slice(1)].map((x) => x + x).join('') : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  const m = s.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0.04, 0.52, 1];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

const CAPTURE_TIMEOUT = 500;
const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const MODE_INDEX: Record<SweepMode, number> = { vertical: 0, horizontal: 1, radial: 2 };

export function SweepTransition({ ref, mode = 'vertical', duration = 720, bandWidth = 28, haptics = true, className, children }: SweepTransitionProps) {
  const reduced = useReducedMotion();
  const accent = useToken('accent');

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [snap, setSnap] = useState<SkImage | null>(null);
  const viewRef = useRef<ViewRef>(null);

  const p = useSharedValue(0);
  const fade = useSharedValue(1);
  const modeSV = useSharedValue(0);
  const originSV = useSharedValue([0, 0]);
  const forward = useSharedValue(0);

  const busy = useRef(false);
  const settle = useRef<(() => void) | null>(null);
  const revertRef = useRef<(() => void) | undefined>(undefined);

  const softTick = useCallback(() => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  }, [haptics]);

  // Soft tick once the front passes half, going forward only.
  useAnimatedReaction(
    () => p.value >= 0.5,
    (half, was) => {
      if (half && was === false && forward.value === 1) scheduleOnRN(softTick);
    },
  );

  const finish = useCallback(async (restore: boolean) => {
    if (restore) {
      revertRef.current?.();
      await frames(2);
    }
    setSnap(null);
    fade.value = 1;
    busy.current = false;
    const done = settle.current;
    settle.current = null;
    done?.();
  }, [fade]);

  const cancel = useCallback(() => {
    if (!busy.current || reduced) return;
    forward.value = 0;
    p.value = withTiming(0, { duration: 300, easing: CALM }, (ok) => {
      if (ok) scheduleOnRN(finish, true);
    });
  }, [finish, forward, p, reduced]);

  const run = useCallback(
    async (apply: () => void, options: SweepRunOptions = {}) => {
      if (busy.current) return cancel();
      // A capture that never resolves (view leaving the screen) falls back to a plain swap.
      const shot = size.w ? await Promise.race([capture(viewRef), wait(CAPTURE_TIMEOUT).then(() => null)]) : null;
      if (!shot) {
        apply();
        return;
      }
      busy.current = true;
      revertRef.current = options.revert;
      const m = options.mode ?? mode;
      const o = options.origin ?? { x: size.w / 2, y: size.h / 2 };
      modeSV.value = MODE_INDEX[m];
      originSV.value = [o.x, o.y];
      forward.value = 0;
      fade.value = 1;
      // Under reduced motion the capture is shown plain (no band) and fades out.
      p.value = reduced ? -1 : 0;
      const ended = new Promise<void>((res) => (settle.current = res));
      setSnap(shot.image);
      await frames(2); // two frames before the state change, no flash
      apply();
      if (reduced) {
        await frames(2);
        fade.value = withTiming(0, { duration: 150 }, (ok) => {
          if (ok) scheduleOnRN(finish, false);
        });
        return ended;
      }
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      forward.value = 1;
      p.value = withTiming(1, { duration, easing: CALM }, (ok) => {
        if (ok) scheduleOnRN(finish, false);
      });
      return ended;
    },
    [cancel, duration, fade, finish, forward, haptics, mode, modeSV, originSV, p, reduced, size.h, size.w],
  );

  useImperativeHandle(ref, () => ({ run, cancel, running: () => busy.current }), [run, cancel]);

  const rim = rgb(accent);
  const band = bandWidth;
  const uniforms = useDerivedValue(() => ({
    size: [size.w || 1, size.h || 1],
    origin: originSV.value,
    p: p.value,
    band,
    mode: modeSV.value,
    rim,
  }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      className={cn('overflow-hidden', className)}
    >
      <RNView ref={viewRef} collapsable={false}>
        {children}
      </RNView>
      {size.w ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {snap ? (
            <Group opacity={fade}>
              <Fill>
                <Shader source={effect} uniforms={uniforms}>
                  <ImageShader image={snap} fit="fill" tx="clamp" ty="clamp" rect={{ x: 0, y: 0, width: size.w, height: size.h }} />
                </Shader>
              </Fill>
            </Group>
          ) : null}
        </Canvas>
      ) : null}
    </View>
  );
}
