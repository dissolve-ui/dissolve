import { useEffect } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { burstGeometry, DEFAULT_END, frames } from './core';
import { Particles } from './Particles';
import { FIELDS, getVariant } from './variants/registry';
import type { Burst, BurstInput } from './types';

/** Normalise a BurstInput: default grain, grain cap, pixel ratio and flat params. */
export function makeBurst(b: BurstInput): Burst {
  const { grain, direction, params } = burstGeometry(b, getVariant(b.variant), b.image.width());
  const { paramsOverride: _po, velocity: _v, target: _t, n: _n, ...rest } = b;
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

  // The burst is immutable for the lifetime of this component: run once on mount.
  useEffect(() => {
    if (burst.progress) return;
    internal.value = withTiming(end, { duration: burst.duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    });
  }, []);

  // Free the snapshots the engine owns once the canvas is gone (a couple of frames later,
  // so the UI thread never draws a disposed image).
  useEffect(
    () => () => {
      const owned = burst.owned;
      if (owned?.length) frames(2).then(() => owned.forEach((img) => img.dispose()));
    },
    [],
  );

  if (v.kind === 'custom') {
    const R = v.Renderer;
    return <R burst={burst} progress={progress} end={end} />;
  }
  return <Particles burst={burst} variant={v} progress={progress} field={burst.field ? FIELDS[burst.field] : undefined} />;
}
