import { useMemo } from 'react';
import { Blur, ColorMatrix, Paint } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { ss } from '../core';
import { Particles } from '../Particles';
import type { AtlasVariant, CustomVariant, RendererProps } from '../types';

/**
 * melt: the view melts down like warm wax.
 *
 * One continuous mass, one global clock (delay 0, life END for every grain), so it stretches
 * instead of breaking into strands:
 * - sag: every column slumps by a smooth, low frequency amount, and lower grains move more
 *   than upper ones (v^1.5, v = ly / h), so the view stretches downward like soft wax;
 * - drips: 3 to 6 drops along the bottom edge (gaussian bumps over x) run much further
 *   (v^4, so only the lower part of the view flows into them) and narrow toward their axis,
 *   which gives each drop a rounded teardrop tip; grains grow with the local stretch so a
 *   drop stays one continuous body of liquid instead of a string of beads;
 * - end: from t = 0.72 the grains shrink away, so the puddle and the drops thin out.
 *
 * Look (Skia layer): the grains are drawn through a gooey layer, a blur followed by an alpha
 * threshold (ColorMatrix alpha * 18 - 7), so they read as one liquid with clean edges. The blur
 * grows from 0 once the wax flows, so the first frames are the exact view.
 *
 * Extras per grain (prepare, JS side, once):
 *   d[k+8] sag 0.55..1, d[k+9] drip strength 0..1, d[k+10] offset to the drip axis, points.
 */
const END = 1.2;
/** Gooey threshold: alpha * 18 - 7, colors untouched. */
const GOO = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 18, -7];
/** Blur radius at full melt, points. */
const BLUR = 2.6;

const meltAtlas: AtlasVariant = {
  kind: 'atlas',
  name: 'melt',
  info: 'Melts down like warm wax: it sags, stretches and drips.',
  defaultGrain: 3,
  end: END,
  extra: 3,
  ownsOrigin: true,
  timing: () => ({ delay: 0, life: END }),
  prepare: (d, stride, count, P) => {
    // Low frequency sag profile and a handful of drips along the width.
    const ph = Math.random() * Math.PI * 2;
    const drips = 3 + Math.floor(Math.random() * 4);
    const dx: number[] = [];
    const da: number[] = [];
    const dw: number[] = [];
    for (let j = 0; j < drips; j++) {
      dx.push(((j + 0.25 + Math.random() * 0.5) / drips) * P.w);
      da.push(0.55 + Math.random() * 0.45);
      dw.push(5 + Math.random() * 7);
    }
    for (let i = 0; i < count; i++) {
      const k = i * stride;
      const x = d[k];
      d[k + 8] = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((x / P.w) * 5.2 + ph));
      let best = 0;
      let off = 0;
      for (let j = 0; j < drips; j++) {
        const g = da[j] * Math.exp(-((x - dx[j]) * (x - dx[j])) / (2 * dw[j] * dw[j]));
        if (g > best) {
          best = g;
          off = dx[j] - x;
        }
      }
      d[k + 9] = best;
      d[k + 10] = off;
    }
  },
  step: (t, d, k, P, _a0, _a1, o) => {
    'worklet';
    const v = d[k + 1] / P.h;
    const e = t * t * (1.6 - 0.6 * t);
    const sag = d[k + 8];
    const drip = d[k + 9];
    const v15 = v * Math.sqrt(v);
    const v4 = v * v * v * v;
    const A = P.h * 0.55 * sag;
    const B = (P.h * 1.6 + 160) * drip;
    o.cy += e * (A * v15 + B * v4) + 14 * e * sag;
    // Drops narrow toward their axis as they stretch.
    o.cx += d[k + 10] * 0.45 * e * drip * v4;
    o.a = 1;
    // Grow each grain with the local stretch (d dy / d ly) so the flow stays continuous.
    const stretch = 1 + (e * (A * 1.5 * Math.sqrt(v) + B * 4 * v * v * v)) / P.h;
    o.s = (stretch < 3.2 ? stretch : 3.2) * (t < 0.72 ? 1 : 1 - ss((t - 0.72) / 0.28));
  },
};

function MeltRenderer({ burst, progress }: RendererProps) {
  const blur = useDerivedValue(() => {
    // Starts once the wax flows, so the view stays sharp at first.
    const r = (progress.value - 0.2) / 0.5;
    return (r < 0 ? 0 : r > 1 ? 1 : r) * BLUR;
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
