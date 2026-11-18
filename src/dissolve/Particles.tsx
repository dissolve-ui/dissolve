import { useMemo, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { Atlas, Canvas, Group, rect, Skia } from '@shopify/react-native-skia';
import { makeMutable, useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { clampDelay, DEFAULT_END, notifyInPlace, originField } from './core';
import type { AtlasVariant, Burst, FieldFn, GrainData, GrainOut } from './types';

/** Base floats per grain: lx, ly, r1, r2, r3, r4, delay, life. Variant extras follow. */
export const BASE_STRIDE = 8;

export type ParticlesProps = {
  burst: Burst;
  variant: AtlasVariant;
  /** Raw progress 0..end (the engine applies the time reversal itself). */
  progress: SharedValue<number>;
  /** Optional delay field override (cascade). */
  field?: FieldFn;
  /** Optional layer paint the grains are drawn through (e.g. a gooey Blur + ColorMatrix). */
  layer?: ReactElement;
};

/**
 * The Atlas engine. Every grain is computed in ONE useAnimatedReaction pass per frame,
 * and grains whose local t did not change since the last frame are skipped (unless an
 * aux value changed). Variant math is a worklet captured in the closure, so dispatch
 * is a direct call: the variant is chosen on the JS side when the component mounts.
 */
export function Particles({ burst, variant, progress, field, layer }: ParticlesProps) {
  const { image, params: P, origin } = burst;
  const { grain, pr, cols, rows, x, y } = P;
  const count = cols * rows;
  const half = (grain * pr) / 2;
  const end = variant.end ?? DEFAULT_END;
  const natural = variant.natural ?? 'out';
  const rev = natural !== 'both' && natural !== burst.direction;
  const stride = BASE_STRIDE + (variant.extra ?? 0);
  const step = variant.step;
  const tint = variant.colorMode === 'tint' ? 1 : 0;

  const { sprites, data, transforms, colors } = useMemo(() => {
    const sprites = [];
    // Typed buffer: captured by the reaction worklet below, it reaches the UI thread as one
    // bulk copy (a plain array would be serialised element by element).
    const data: GrainData = new Float64Array(count * stride);
    const iw = image.width();
    const ih = image.height();
    const spread = variant.spread ?? 0.55;
    const jitter = variant.jitter ?? 0.08;
    const useOrigin = P.hasOrigin === 1 && !variant.ownsOrigin;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const sx = c * grain * pr;
        const sy = r * grain * pr;
        sprites.push(rect(sx, sy, Math.min(grain * pr, iw - sx), Math.min(grain * pr, ih - sy)));
        const k = i * stride;
        const seed = {
          i,
          col: c,
          row: r,
          lx: (c + 0.5) * grain,
          ly: (r + 0.5) * grain,
          r1: Math.random(),
          r2: Math.random(),
          r3: Math.random(),
          r4: Math.random(),
        };
        const tm = variant.timing(seed, P);
        let delay = tm.delay;
        if (field) delay = field(seed, P, burst, tm.life, end);
        else if (useOrigin) delay = originField(origin, seed.lx, seed.ly, P) * spread + seed.r1 * jitter;
        delay = clampDelay(delay, tm.life, end);
        data[k] = seed.lx;
        data[k + 1] = seed.ly;
        data[k + 2] = seed.r1;
        data[k + 3] = seed.r2;
        data[k + 4] = seed.r3;
        data[k + 5] = seed.r4;
        data[k + 6] = delay;
        data[k + 7] = tm.life;
      }
    }
    variant.prepare?.(data, stride, count, P, burst);

    // Initial pose. An 'out' grain at t = 0 is an exact copy of the view, so the first
    // frame is pixel perfect without calling the step. Otherwise run the step once here.
    const { p: p0, a0, a1 } = burst.start;
    const pe0 = rev ? end - p0 : p0;
    const o: GrainOut = { cx: 0, cy: 0, s: 1, rot: 0, r: 1, g: 1, b: 1, a: 1 };
    const xf = [];
    const cl = [];
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const lx = data[k];
      const ly = data[k + 1];
      let t = (pe0 - data[k + 6]) / data[k + 7];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const restOut = t === 0 && natural !== 'in' && !burst.aux0 && !burst.aux1 && !(natural === 'both' && P.dir === 1);
      if (restOut) {
        xf.push(Skia.RSXform(1 / pr, 0, x + lx - grain / 2, y + ly - grain / 2));
        // At rest the grain must look untouched: white x grain (modulate) or no tint (tint mode).
        cl.push(tint ? new Float32Array([1, 1, 1, 0]) : Skia.Color('white'));
        continue;
      }
      o.cx = x + lx;
      o.cy = y + ly;
      o.s = 1;
      o.rot = 0;
      o.r = 1;
      o.g = 1;
      o.b = 1;
      o.a = 1 - t * t * (3 - 2 * t);
      step(t, data, k, P, a0, a1, o);
      const sc = (o.s < 0 || (tint === 0 && o.a <= 0) ? 0 : o.s) / pr;
      const scos = o.rot === 0 ? sc : sc * Math.cos(o.rot);
      const ssin = o.rot === 0 ? 0 : sc * Math.sin(o.rot);
      xf.push(Skia.RSXform(scos, ssin, o.cx - (scos * half - ssin * half), o.cy - (ssin * half + scos * half)));
      cl.push(new Float32Array([o.r, o.g, o.b, o.a < 0 ? 0 : o.a]));
    }
    return { sprites, data, transforms: makeMutable(xf), colors: makeMutable(cl) };
    // The burst is immutable for the lifetime of this component.
  }, []);

  const fallback = useSharedValue(0);
  const aux0 = burst.aux0 ?? fallback;
  const aux1 = burst.aux1 ?? fallback;
  // Seeded with the same values as the initial pose, so the first reaction run only
  // recomputes the grains that moved since the burst was added.
  const last = useSharedValue(rev ? end - burst.start.p : burst.start.p);
  const lastA0 = useSharedValue(burst.start.a0);
  const lastA1 = useSharedValue(burst.start.a1);

  useAnimatedReaction(
    // Every shared value is read HERE, directly, so the mapper tracks all of them.
    () => [progress.value, aux0.value, aux1.value],
    (v) => {
      const p = rev ? end - v[0] : v[0];
      const a0 = v[1];
      const a1 = v[2];
      const lp = last.value;
      const auxChanged = a0 !== lastA0.value || a1 !== lastA1.value;
      if (p === lp && !auxChanged) return;
      const T = transforms.value;
      const K = colors.value;
      const o = { cx: 0, cy: 0, s: 1, rot: 0, r: 1, g: 1, b: 1, a: 1 };
      for (let i = 0; i < count; i++) {
        const k = i * stride;
        const delay = data[k + 6];
        const life = data[k + 7];
        let t = (p - delay) / life;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (!auxChanged) {
          let tp = (lp - delay) / life;
          tp = tp < 0 ? 0 : tp > 1 ? 1 : tp;
          if (t === tp) continue;
        }
        o.cx = x + data[k];
        o.cy = y + data[k + 1];
        o.s = 1;
        o.rot = 0;
        o.r = 1;
        o.g = 1;
        o.b = 1;
        o.a = 1 - t * t * (3 - 2 * t);
        step(t, data, k, P, a0, a1, o);
        const sc = (o.s < 0 || (tint === 0 && o.a <= 0) ? 0 : o.s) / pr;
        const scos = o.rot === 0 ? sc : sc * Math.cos(o.rot);
        const ssin = o.rot === 0 ? 0 : sc * Math.sin(o.rot);
        T[i].set(scos, ssin, o.cx - (scos * half - ssin * half), o.cy - (ssin * half + scos * half));
        const col = K[i];
        col[0] = o.r;
        col[1] = o.g;
        col[2] = o.b;
        col[3] = o.a;
      }
      last.value = p;
      lastA0.value = a0;
      lastA1.value = a1;
      notifyInPlace(transforms, T);
      notifyInPlace(colors, K);
    },
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {layer ? (
        <Group layer={layer}>
          <Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode={tint ? 'dstATop' : 'modulate'} />
        </Group>
      ) : (
        <Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode={tint ? 'dstATop' : 'modulate'} />
      )}
    </Canvas>
  );
}
