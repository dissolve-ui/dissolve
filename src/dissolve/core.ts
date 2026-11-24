import type { RefObject } from 'react';
import {
  AlphaType,
  ColorType,
  makeImageFromView,
  rect,
  Skia,
  type SkImage,
  type SkPaint,
  type SkRect,
  type SkSurface,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Box, ViewRef } from './types';

/** Shared helpers for variants and hooks. The pure math lives in math.ts. */
export { MAX_GRAINS, DEFAULT_END, capGrain, clampDelay, originField, buildParams, burstGeometry, ss, eo, backOut, clamp01 } from './math';

/**
 * Opacity of a view that must stay rendered (so it can be captured) while hidden to the eye.
 * Opacity 0 can capture empty on iOS.
 */
export const HIDDEN_OPACITY = 0.01;

export function measure(ref: RefObject<ViewRef | null>): Promise<Box | null> {
  return new Promise((res) => {
    const v = ref.current;
    if (!v) return res(null);
    v.measureInWindow((x, y, width, height) => res({ x, y, width, height }));
  });
}

/** Snapshot plus window rect, in parallel. Null when the view is gone or empty. */
export async function capture(ref: RefObject<ViewRef | null>): Promise<{ image: SkImage; box: Box } | null> {
  if (!ref.current) return null;
  const [image, box] = await Promise.all([makeImageFromView(ref as unknown as Parameters<typeof makeImageFromView>[0]), measure(ref)]);
  if (!image) return null;
  if (!box || box.width === 0 || box.height === 0) {
    image.dispose();
    return null;
  }
  return { image, box };
}

/** Wait n animation frames. */
export function frames(n = 2) {
  return new Promise<void>((res) => {
    const tick = (left: number) => (left <= 0 ? res() : requestAnimationFrame(() => tick(left - 1)));
    tick(n);
  });
}

/** Default haptics: soft impact, then a few ticks during the sweep. */
export function defaultHaptics(duration: number) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  [0.08, 0.18, 0.28].forEach((f) => setTimeout(() => Haptics.selectionAsync(), duration * f));
}

/**
 * Tell Skia that a mutable shared value (array of RSXforms or colors) was changed in
 * place. Same trick Skia's own buffer hooks use: reassigning the raw value notifies the
 * canvas without copying the array.
 */
export function notifyInPlace<T>(sv: SharedValue<T>, value: T) {
  'worklet';
  (sv as unknown as { _value: T })._value = value;
}

/**
 * Packs 0..1 channels into one ARGB integer, the cheapest color Skia's Atlas and Vertices
 * accept: the native side casts a number straight to SkColor, while a Float32Array color
 * costs several JSI property reads per grain per frame. Channels are clamped to 0..1 and
 * truncated to bytes, the same rounding Skia applies to float colors.
 */
export function argb(r: number, g: number, b: number, a: number): number {
  'worklet';
  const R = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255) | 0;
  const G = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255) | 0;
  const B = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255) | 0;
  const A = a <= 0 ? 0 : a >= 1 ? 255 : (a * 255) | 0;
  return ((A << 24) | (R << 16) | (G << 8) | B) >>> 0;
}

/**
 * JS side: draw the image into a small width x height surface (nearest sampling, so it is
 * a point sampled downscale) and read it back as RGBA 8888 unpremultiplied. dst defaults
 * to the whole surface. View snapshots are CPU images, so this runs on a CPU raster surface
 * with no GPU upload or readback; a texture backed image still goes through the GPU. Every
 * Skia object made here is disposed. Null on failure.
 */
export function readScaled(image: SkImage, width: number, height: number, dst?: SkRect): Uint8Array | null {
  let surface: SkSurface | null = null;
  let paint: SkPaint | null = null;
  let snap: SkImage | null = null;
  let raster: SkImage | null = null;
  try {
    // isTextureBacked exists on the native SkImage, Skia's types just do not declare it.
    const gpu = (image as SkImage & { isTextureBacked?: () => boolean }).isTextureBacked?.() === true;
    surface = gpu ? (Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height)) : Skia.Surface.Make(width, height);
    if (!surface) return null;
    paint = Skia.Paint();
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    canvas.drawImageRect(image, rect(0, 0, image.width(), image.height()), dst ?? rect(0, 0, width, height), paint);
    surface.flush();
    snap = surface.makeImageSnapshot();
    if (gpu) raster = snap.makeNonTextureImage();
    const px = (raster ?? snap).readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    if (!px || px.length < width * height * 4) return null;
    return px as Uint8Array;
  } catch {
    return null;
  } finally {
    raster?.dispose();
    snap?.dispose();
    paint?.dispose();
    surface?.dispose();
  }
}

/** About this many pixels are sampled for the dominant color. */
const PALETTE_PIXELS = 20000;

export type Palette = {
  /** RGBA bytes of the downscaled snapshot, w x h. */
  px: Uint8Array;
  w: number;
  h: number;
  /** Downscaled pixels per snapshot pixel. */
  scale: number;
  /** Dominant color, 0..1. */
  dom: [number, number, number];
};

/**
 * Dominant color of a snapshot: the image is point sampled down to about 20000 pixels,
 * colors are bucketed (3 bits per channel) and each pixel is weighted by its saturation so
 * a colored bubble wins over white text or a gray backdrop. Returns the average color of the
 * heaviest bucket, plus the small pixel buffer for per grain lookups. Null on failure.
 */
export function palette(image: SkImage): Palette | null {
  const W = image.width();
  const H = image.height();
  if (W <= 0 || H <= 0) return null;
  const scale = Math.min(1, Math.sqrt(PALETTE_PIXELS / (W * H)));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const px = readScaled(image, w, h);
  if (!px) return null;
  const count = new Float32Array(512);
  const sum = new Float32Array(512 * 3);
  for (let i = 0; i < w * h * 4; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const wt = 0.15 + (mx === 0 ? 0 : (mx - mn) / mx);
    const q = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    count[q] += wt;
    sum[q * 3] += r * wt;
    sum[q * 3 + 1] += g * wt;
    sum[q * 3 + 2] += b * wt;
  }
  let best = 0;
  for (let q = 1; q < 512; q++) if (count[q] > count[best]) best = q;
  const c = (count[best] || 1) * 255;
  return { px, w, h, scale: w / W, dom: [sum[best * 3] / c, sum[best * 3 + 1] / c, sum[best * 3 + 2] / c] };
}
