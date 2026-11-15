import { useEffect } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { buildParams, capGrain, DEFAULT_END } from './core';
import { Particles } from './Particles';
import { FIELDS, getVariant } from './variants/registry';
import type { Burst, BurstInput } from './types';

/** Normalise a BurstInput: default grain, grain cap, pixel ratio and flat params. */
export function makeBurst(b: BurstInput): Burst {
  const v = getVariant(b.variant);
  const grain = capGrain(b.width, b.height, b.grain ?? v.defaultGrain);
  const pr = b.image.width() / b.width;
  const direction = b.direction ?? (v.natural === 'in' ? 'in' : 'out');
  const params = { ...buildParams({ ...b, direction }, grain, pr), ...b.paramsOverride };
  const { paramsOverride: _po, velocity: _v, target: _t, floorY: _f, n: _n, ...rest } = b;
  // Sampled here (inside ctx.add, never during render) so renderers can build their first
  // frame without reading shared values while rendering.
  const start = { p: b.progress?.value ?? 0, a0: b.aux0?.value ?? 0, a1: b.aux1?.value ?? 0 };
  return { ...rest, key: `${Date.now()}-${Math.random()}`, grain, direction, params, start };
}

/**
 * Renders one burst: picks the variant on the JS side, owns the internal timing unless
 * an external progress is supplied, and calls onDone at the end.
 */
export function BurstHost({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  const v = getVariant(burst.variant);
  const end = v.end ?? DEFAULT_END;
  const internal = useSharedValue(0);
  const progress = burst.progress ?? internal;

  useEffect(() => {
    if (burst.progress) return;
    internal.value = withTiming(end, { duration: burst.duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (v.kind === 'custom') {
    const R = v.Renderer;
    return <R burst={burst} progress={progress} end={end} />;
  }
  return <Particles burst={burst} variant={v} progress={progress} field={burst.field ? FIELDS[burst.field] : undefined} />;
}
