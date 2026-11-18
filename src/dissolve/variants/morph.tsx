import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Atlas, Canvas, rect, Skia, type SkImage, type SkRect } from '@shopify/react-native-skia';
import { makeMutable, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { notifyInPlace, readScaled, ss } from '../core';
import type { Box, CustomVariant, RendererProps } from '../types';

/**
 * morph: the grains of view A fly over and recompose view B (docs/VARIANTS.md section 9).
 *
 * Pairing: both snapshots are reduced to one luminance value per grain cell, sorted, and
 * matched rank by rank. N = max(nA, nB) particles, particle k takes A cell
 * sortedA[k * nA / N] and B cell sortedB[k * nB / N], so every cell of A and of B is
 * covered. When a cell is shared by several particles only the first one shows that
 * image (the others keep alpha 0 on that side), so the first frame is exactly A and the
 * last frame is exactly B, with no double blended edges.
 *
 * Two Atlases (sprites of A, sprites of B) driven by ONE reaction: same path, A fades out
 * while B fades in. Grains whose local t did not change are skipped.
 */

/** Payload attached by useDissolveMorph. */
export type MorphData = { imageB: SkImage; boxB: Box };

const END = 1.1;
const LIFE = 0.6;
/** Floats per particle. */
const S = 10;
// 0 ax, 1 ay, 2 bx, 3 by (window centers), 4 mx, 5 my (bezier control), 6 delay, 7 life, 8 showA, 9 showB

/** Luminance per grain cell (alpha weighted), via a cols x rows downscale. Null on failure. */
function cellLuminance(image: SkImage, w: number, h: number, g: number, cols: number, rows: number) {
  // Cell c spans [c * g, (c + 1) * g] in points, so the view maps to w / g by h / g pixels.
  const px = readScaled(image, cols, rows, rect(0, 0, w / g, h / g));
  if (!px) return null;
  const out = new Float32Array(cols * rows);
  const f = 1 / 255;
  for (let i = 0; i < cols * rows; i++) {
    const j = i * 4;
    out[i] = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) * f * (px[j + 3] * f);
  }
  return out;
}

function sortedCells(lum: Float32Array | null, n: number) {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (!lum) {
    // No pixel access: random order still gives a full, exact morph.
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }
  return idx.sort((a, b) => lum[a] - lum[b]);
}

function cellRect(i: number, cols: number, g: number, pr: number, iw: number, ih: number): SkRect {
  const sx = (i % cols) * g * pr;
  const sy = Math.floor(i / cols) * g * pr;
  return rect(sx, sy, Math.min(g * pr, iw - sx), Math.min(g * pr, ih - sy));
}

function MorphRenderer({ burst, progress }: RendererProps) {
  const P = burst.params;
  const g = P.grain;
  const data = burst.data as MorphData | undefined;
  const imageA = burst.image;
  // Without a second view (plain dissolve({ preset: 'morph' })) the view sorts into itself.
  const imageB = data?.imageB ?? imageA;
  const boxB = data?.boxB ?? { x: P.x, y: P.y, width: P.w, height: P.h };
  const prA = P.pr;
  const prB = imageB.width() / boxB.width;
  const halfA = (g * prA) / 2;
  const halfB = (g * prB) / 2;

  const m = useMemo(() => {
    const colsA = P.cols;
    const rowsA = P.rows;
    const colsB = Math.ceil(boxB.width / g);
    const rowsB = Math.ceil(boxB.height / g);
    const nA = colsA * rowsA;
    const nB = colsB * rowsB;
    const N = Math.max(nA, nB);
    const ordA = sortedCells(cellLuminance(imageA, P.w, P.h, g, colsA, rowsA), nA);
    const ordB = sortedCells(cellLuminance(imageB, boxB.width, boxB.height, g, colsB, rowsB), nB);
    const iwA = imageA.width();
    const ihA = imageA.height();
    const iwB = imageB.width();
    const ihB = imageB.height();

    // Typed buffer: one bulk copy to the UI thread (see Particles).
    const d = new Float64Array(N * S);
    const spritesA: SkRect[] = [];
    const spritesB: SkRect[] = [];
    let lastA = -1;
    let lastB = -1;
    for (let k = 0; k < N; k++) {
      const ra = Math.floor((k * nA) / N);
      const rb = Math.floor((k * nB) / N);
      const ia = ordA[ra];
      const ib = ordB[rb];
      const ax = P.x + ((ia % colsA) + 0.5) * g;
      const ay = P.y + (Math.floor(ia / colsA) + 0.5) * g;
      const bx = boxB.x + ((ib % colsB) + 0.5) * g;
      const by = boxB.y + (Math.floor(ib / colsB) + 0.5) * g;
      // Control point: midpoint pushed sideways, a little less for short hops.
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      let px: number;
      let py: number;
      if (len > 1e-3) {
        px = -dy / len;
        py = dx / len;
      } else {
        const an = Math.random() * Math.PI * 2;
        px = Math.cos(an);
        py = Math.sin(an);
      }
      // Gentle arcs: short hops barely bend, long ones curve a little.
      const off = (Math.random() - 0.5) * Math.min(48, 10 + len * 0.3);
      const j = k * S;
      d[j] = ax;
      d[j + 1] = ay;
      d[j + 2] = bx;
      d[j + 3] = by;
      d[j + 4] = (ax + bx) / 2 + px * off;
      d[j + 5] = (ay + by) / 2 + py * off;
      // Coherent sweep: grains leave A from left to right, with a little jitter.
      d[j + 6] = ((ia % colsA) / Math.max(1, colsA - 1)) * 0.3 + Math.random() * 0.08;
      d[j + 7] = LIFE;
      d[j + 8] = ra !== lastA ? 1 : 0;
      d[j + 9] = rb !== lastB ? 1 : 0;
      lastA = ra;
      lastB = rb;
      spritesA.push(cellRect(ia, colsA, g, prA, iwA, ihA));
      spritesB.push(cellRect(ib, colsB, g, prB, iwB, ihB));
    }

    // Initial pose with the same math as the frame loop.
    const p0 = burst.start.p;
    const TA = [];
    const TB = [];
    const CA = [];
    const CB = [];
    for (let k = 0; k < N; k++) {
      const j = k * S;
      let t = (p0 - d[j + 6]) / d[j + 7];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const u = ss(t);
      const v = 1 - u;
      const cx = v * v * d[j] + 2 * v * u * d[j + 4] + u * u * d[j + 2];
      const cy = v * v * d[j + 1] + 2 * v * u * d[j + 5] + u * u * d[j + 3];
      const s = t === 0 || t === 1 ? 1 : 1 + 0.18 * Math.sin(Math.PI * t);
      let c = (t - 0.3) / 0.4;
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      const cross = ss(c);
      const sa = s / prA;
      const sb = s / prB;
      TA.push(Skia.RSXform(sa, 0, cx - sa * halfA, cy - sa * halfA));
      TB.push(Skia.RSXform(sb, 0, cx - sb * halfB, cy - sb * halfB));
      CA.push(new Float32Array([1, 1, 1, d[j + 8] * (1 - cross)]));
      CB.push(new Float32Array([1, 1, 1, d[j + 9] * cross]));
    }
    return {
      N,
      d,
      spritesA,
      spritesB,
      TA: makeMutable(TA),
      TB: makeMutable(TB),
      CA: makeMutable(CA),
      CB: makeMutable(CB),
    };
    // The burst is immutable for the lifetime of this component.
  }, []);

  const { N, d, TA, TB, CA, CB } = m;
  const last = useSharedValue(burst.start.p);

  useAnimatedReaction(
    // progress is read HERE so the mapper tracks it.
    () => progress.value,
    (p) => {
      const lp = last.value;
      if (p === lp) return;
      const ta = TA.value;
      const tb = TB.value;
      const ca = CA.value;
      const cb = CB.value;
      for (let k = 0; k < N; k++) {
        const j = k * S;
        const delay = d[j + 6];
        const life = d[j + 7];
        let t = (p - delay) / life;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        let tp = (lp - delay) / life;
        tp = tp < 0 ? 0 : tp > 1 ? 1 : tp;
        if (t === tp) continue;
        const u = ss(t);
        const v = 1 - u;
        const cx = v * v * d[j] + 2 * v * u * d[j + 4] + u * u * d[j + 2];
        const cy = v * v * d[j + 1] + 2 * v * u * d[j + 5] + u * u * d[j + 3];
        const s = t === 0 || t === 1 ? 1 : 1 + 0.18 * Math.sin(Math.PI * t);
        let c = (t - 0.3) / 0.4;
        c = c < 0 ? 0 : c > 1 ? 1 : c;
        const cross = ss(c);
        const sa = s / prA;
        const sb = s / prB;
        ta[k].set(sa, 0, cx - sa * halfA, cy - sa * halfA);
        tb[k].set(sb, 0, cx - sb * halfB, cy - sb * halfB);
        ca[k][3] = d[j + 8] * (1 - cross);
        cb[k][3] = d[j + 9] * cross;
      }
      last.value = p;
      notifyInPlace(TA, ta);
      notifyInPlace(TB, tb);
      notifyInPlace(CA, ca);
      notifyInPlace(CB, cb);
    },
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Atlas image={imageA} sprites={m.spritesA} transforms={TA} colors={CA} colorBlendMode="modulate" />
      <Atlas image={imageB} sprites={m.spritesB} transforms={TB} colors={CB} colorBlendMode="modulate" />
    </Canvas>
  );
}

export const morph: CustomVariant = {
  kind: 'custom',
  name: 'morph',
  info: 'One view rearranges its grains into another, sorted by brightness.',
  defaultGrain: 4,
  end: END,
  natural: 'both',
  Renderer: MorphRenderer,
};
