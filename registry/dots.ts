/**
 * Dot drawing helpers shared by the dissolve components (dissolve-ui): theme colors as
 * channels, the round sprite of the Skia Atlas, and the in place buffer update.
 * `npx dissolve-ui add` copies it next to the components that use it.
 */
import { Skia } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

/** Parses a token string (rgb(28 28 30), rgb(1, 2, 3 / 0.5), #rgb, #rrggbb) into 0..1 channels, alpha last. */
export function toRGBA(c: string): [number, number, number, number] {
  const s = c.trim();
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).replace(/./g, (x) => x + x) : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1];
  }
  const m = s.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0.5, 0.5, 0.5, 1];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255, m[3] != null ? Number(m[3]) : 1];
}

/** Same as toRGBA, without the alpha. */
export function toRGB(c: string): [number, number, number] {
  const [r, g, b] = toRGBA(c);
  return [r, g, b];
}

/** White antialiased disc of `d` pixels on a (d + 2) square, tinted per dot by the Atlas colors (modulate). */
export function makeSprite(d: number) {
  const size = d + 2;
  const surface = Skia.Surface.MakeOffscreen(size, size) ?? Skia.Surface.Make(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color('white'));
  canvas.drawCircle(size / 2, size / 2, d / 2, paint);
  surface.flush();
  const snap = surface.makeImageSnapshot();
  return snap.makeNonTextureImage() ?? snap;
}

/**
 * Tells the canvas that a buffer it draws (Atlas transforms or colors) was changed in place.
 * Same trick as Skia's own buffer hooks: it writes Reanimated's private `_value`, kept here so
 * that private API lives in one place.
 */
export function notify<T>(buffer: SharedValue<T>) {
  'worklet';
  (buffer as unknown as { _value: T })._value = buffer.value;
}
