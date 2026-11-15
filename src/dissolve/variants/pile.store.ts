import { createElement } from 'react';
import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
import { Canvas, drawAsImageFromPicture, Image, rect, Skia, type SkImage } from '@shopify/react-native-skia';
import type { DissolveCtx } from '../types';

/**
 * GROUP F private helper. The persistent sand heap of the 'pile' variant.
 *
 * One store per provider (keyed by its stable setLayer). A heap lives per floor line
 * (window Y). Its height profile H is a 1 pt column grid across the window: bursts
 * reserve their landing spots in H on the JS side as soon as they mount, so concurrent
 * deletions stack on top of each other. When a burst settles, its kept grains are baked
 * into ONE frozen image (offscreen Skia picture) and the burst buffers are released.
 */

export const PILE_LAYER = 'pile';

export type Heap = {
  floorY: number;
  /** Window width in points, also the column count of H. */
  width: number;
  /** Height of the heap per 1 pt column, in points. */
  H: Float32Array;
  /** Frozen heap image (device pixels) and its window band [top, top + imgH]. */
  image: SkImage | null;
  top: number;
  imgH: number;
};

export type PileStore = {
  heaps: Map<number, Heap>;
  setLayer: DissolveCtx['setLayer'];
};

const stores = new WeakMap<DissolveCtx['setLayer'], PileStore>();

export function pileStore(ctx: Pick<DissolveCtx, 'setLayer'>): PileStore {
  let s = stores.get(ctx.setLayer);
  if (!s) {
    s = { heaps: new Map(), setLayer: ctx.setLayer };
    stores.set(ctx.setLayer, s);
  }
  return s;
}

export function heapFor(store: PileStore, floorY: number): Heap {
  const key = Math.round(floorY);
  let h = store.heaps.get(key);
  if (!h) {
    const width = Math.ceil(Dimensions.get('window').width);
    h = { floorY: key, width, H: new Float32Array(width), image: null, top: key, imgH: 0 };
    store.heaps.set(key, h);
  }
  return h;
}

/** Highest column under a grain of size g centered at x. Outside the window counts as a wall. */
export function spanMax(H: Float32Array, x: number, g: number) {
  const a = Math.floor(x - g / 2);
  const b = Math.ceil(x + g / 2) - 1;
  if (a < 0 || b >= H.length) return Infinity;
  let m = 0;
  for (let c = a; c <= b; c++) if (H[c] > m) m = H[c];
  return m;
}

export function spanSet(H: Float32Array, x: number, g: number, v: number) {
  const a = Math.max(0, Math.floor(x - g / 2));
  const b = Math.min(H.length - 1, Math.ceil(x + g / 2) - 1);
  for (let c = a; c <= b; c++) if (H[c] < v) H[c] = v;
}

function maxHeight(H: Float32Array) {
  let m = 0;
  for (let i = 0; i < H.length; i++) if (H[i] > m) m = H[i];
  return m;
}

/** Grains to bake: source rects in the burst image and window centers. */
export type BakeInput = {
  image: SkImage;
  pr: number;
  grain: number;
  srcs: { x: number; y: number; w: number; h: number }[];
  cx: number[];
  cy: number[];
};

/**
 * Bakes grains into the frozen heap image of a floor: previous image + new grains, drawn
 * once into an offscreen picture. Synchronous, JS thread.
 */
export function bake(store: PileStore, heap: Heap, inp: BakeInput) {
  const D = PixelRatio.get();
  const top = Math.floor(heap.floorY - maxHeight(heap.H) - inp.grain * 2 - 4);
  const imgH = Math.max(1, heap.floorY - top);
  const W = Math.round(heap.width * D);
  const Hpx = Math.round(imgH * D);
  const rec = Skia.PictureRecorder();
  const canvas = rec.beginRecording(rect(0, 0, W, Hpx));
  const paint = Skia.Paint();
  if (heap.image) {
    const prev = heap.image;
    canvas.drawImageRect(
      prev,
      rect(0, 0, prev.width(), prev.height()),
      rect(0, (heap.top - top) * D, W, heap.imgH * D),
      paint,
    );
  }
  if (inp.srcs.length) {
    const sc = D / inp.pr;
    const half = inp.grain / 2;
    const srcs = inp.srcs.map((r) => rect(r.x, r.y, r.w, r.h));
    const dsts = inp.srcs.map((_, i) => Skia.RSXform(sc, 0, (inp.cx[i] - half) * D, (inp.cy[i] - half - top) * D));
    canvas.drawAtlas(inp.image, srcs, dsts, paint);
  }
  const pic = rec.finishRecordingAsPicture();
  const img = drawAsImageFromPicture(pic, { width: W, height: Hpx });
  if (!img) return;
  heap.image = img;
  heap.top = top;
  heap.imgH = imgH;
  renderLayer(store);
}

/** (Re)publishes every frozen heap as one persistent provider layer. */
export function renderLayer(store: PileStore) {
  const list = [...store.heaps.values()].filter((h) => h.image);
  if (!list.length) {
    store.setLayer(PILE_LAYER, null);
    return;
  }
  store.setLayer(
    PILE_LAYER,
    createElement(
      Canvas,
      { style: StyleSheet.absoluteFill, pointerEvents: 'none' },
      list.map((h) =>
        createElement(Image, { key: h.floorY, image: h.image, x: 0, y: h.top, width: h.width, height: h.imgH, fit: 'fill' }),
      ),
    ),
  );
}

/** Drops every heap (image and height profile) and the layer. */
export function clearHeaps(store: PileStore) {
  store.heaps.clear();
  store.setLayer(PILE_LAYER, null);
}

/** Frozen heaps as window boxes, for sweeping. */
export function frozenHeaps(store: PileStore) {
  return [...store.heaps.values()]
    .filter((h) => h.image)
    .map((h) => ({ image: h.image as SkImage, box: { x: 0, y: h.top, width: h.width, height: h.imgH } }));
}
