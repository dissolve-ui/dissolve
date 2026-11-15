import { useMemo } from 'react';
import { Blur, ColorMatrix, Paint } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { ss } from '../core';
import { Particles } from '../Particles';
import type { AtlasVariant, CustomVariant, RendererProps } from '../types';

/**
 * melt: the view melts down like a liquid.
 *
 * Motion (atlas step): columns get a smooth random speed (two sine waves with a random phase
 * per burst), so neighbouring columns sag together and a few run ahead as drips. Lower
 * grains fall further than the top ones, which stretches each column into a drop, and grains
 * are pulled toward the nearest drip axis (every DRIP points) so the drops narrow as they
 * fall. Grains never fade: they shrink at the end, so the liquid thins out and pinches off.
 *
 * Look (Skia layer): the grains are drawn through a gooey layer, a blur followed by an alpha
 * threshold (ColorMatrix alpha * 18 - 7). Nearby grains merge into one continuous liquid
 * with sharp edges, drops stretch and snap like syrup. The blur grows from 0 with progress,
 * so the first frame is the exact view.
 *
 * Extras per grain (prepare, JS side, once):
 *   d[k+8] column speed 0.35..1, d[k+9] offset to the nearest drip axis, points.
 */
const DRIP = 22;
const END = 1.2;
/** Gooey threshold: alpha * 18 - 7, colors untouched. */
const GOO = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 18, -7];
/** Blur radius at full melt, points. */
const BLUR = 5;

const meltAtlas: AtlasVariant = {
  kind: 'atlas',
  name: 'melt',
  info: 'Melts down like a liquid, in drips that merge and pinch off.',
  defaultGrain: 3,
  end: END,
  extra: 2,
  spread: 0.3,
  jitter: 0.08,
  // Top rows let go a little later. max 0.12 + 0.06 + 0.95 = 1.13 < 1.2
  timing: (g, P) => ({ delay: (1 - g.ly / P.h) * 0.12 + g.r1 * 0.06, life: 0.95 }),
  prepare: (d, stride, count) => {
    const ph = Math.random() * Math.PI * 2;
    const ph2 = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const c = d[k] / DRIP;
      const a = 0.5 + 0.5 * Math.sin(c * 1.3 + ph);
      const b = 0.5 + 0.5 * Math.sin(c * 0.55 + ph2);
      d[k + 8] = 0.35 + 0.65 * a * (0.6 + 0.4 * b);
      d[k + 9] = Math.round(c) * DRIP - d[k];
    }
  },
  step: (t, d, k, P, _a0, _a1, o) => {
    'worklet';
    const speed = d[k + 8];
    const depth = 0.35 + 0.65 * (d[k + 1] / P.h);
    // Slow start, then it really lets go.
    const e = t * t * (1.4 - 0.4 * t);
    o.cy += (30 + speed * (P.h * 0.9 + 160)) * e * depth;
    o.cx += d[k + 9] * 0.55 * ss(t < 0.5 ? t * 2 : 1);
    // Opaque all along (the goo threshold would cut a fade): thin out by shrinking.
    o.a = 1;
    o.s = t < 0.5 ? 1 : 1 - ss((t - 0.5) / 0.5);
  },
};

function MeltRenderer({ burst, progress }: RendererProps) {
  const blur = useDerivedValue(() => {
    const r = progress.value / 0.25;
    return (r > 1 ? 1 : r) * BLUR;
  });
  const layer = useMemo(
    () => (
      <Paint>
        <Blur blur={blur} />
        <ColorMatrix matrix={GOO} />
      </Paint>
    ),
    [blur],
  );
  return <Particles burst={burst} variant={meltAtlas} progress={progress} layer={layer} />;
}

export const melt: CustomVariant = {
  kind: 'custom',
  name: 'melt',
  info: meltAtlas.info,
  defaultGrain: meltAtlas.defaultGrain,
  end: END,
  natural: 'out',
  Renderer: MeltRenderer,
};
