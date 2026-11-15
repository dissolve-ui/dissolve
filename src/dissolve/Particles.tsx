import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Atlas, Canvas, rect, Skia, type SkImage } from '@shopify/react-native-skia';
import { Easing, makeMutable, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PRESET_ID, type Preset } from './presets';

export type Burst = {
  key: string;
  image: SkImage;
  x: number;
  y: number;
  width: number;
  height: number;
  preset: Preset;
  grain: number;
  duration: number;
};

// Timeline runs 0 to END. Each grain waits for its delay, then lives for its life span.
const END = 1.2;
const STRIDE = 6;

export function Particles({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  const { image, x, y, width: w, height: h, grain, duration } = burst;
  const preset = PRESET_ID[burst.preset];
  const pr = image.width() / w;
  const cols = Math.ceil(w / grain);
  const rows = Math.ceil(h / grain);
  const count = cols * rows;
  const half = (grain * pr) / 2;
  const maxR = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2);

  // Static per-grain data plus the two animated buffers, initialised at t = 0 so the
  // very first frame is a pixel-perfect copy of the view.
  const { sprites, data, transforms, colors } = useMemo(() => {
    const sprites = [];
    const xf = [];
    const cl = [];
    const data: number[] = new Array(count * STRIDE);
    const iw = image.width();
    const ih = image.height();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const sx = c * grain * pr;
        const sy = r * grain * pr;
        sprites.push(rect(sx, sy, Math.min(grain * pr, iw - sx), Math.min(grain * pr, ih - sy)));
        const k = i * STRIDE;
        const lx = (c + 0.5) * grain;
        const ly = (r + 0.5) * grain;
        data[k] = lx;
        data[k + 1] = ly;
        data[k + 2] = Math.random();
        data[k + 3] = Math.random();
        data[k + 4] = Math.random();
        data[k + 5] = Math.random();
        xf.push(Skia.RSXform(1 / pr, 0, x + lx - grain / 2, y + ly - grain / 2));
        cl.push(Skia.Color('white'));
      }
    }
    return { sprites, data, transforms: makeMutable(xf), colors: makeMutable(cl) };
  }, [image, grain, pr, cols, rows, count, x, y]);

  const progress = useSharedValue(0);
  const last = useSharedValue(0);

  // Local time t (0..1) of grain i at timeline position p.
  const local = (i: number, p: number) => {
    'worklet';
    const k = i * STRIDE;
    const lx = data[k];
    const ly = data[k + 1];
    const r1 = data[k + 2];
    let delay = 0;
    let life = 0.42;
    if (preset === 0) {
      delay = (lx / w) * 0.62 + (1 - ly / h) * 0.04 + r1 * 0.1;
    } else if (preset === 1) {
      delay = (lx / w) * 0.5 + r1 * 0.15;
      life = 0.5;
    } else if (preset === 2) {
      delay = (lx / w) * 0.52 + ((h - ly) / h) * 0.12 + r1 * 0.12;
      life = 0.4;
    } else if (preset === 3) {
      delay = r1 * 0.75;
      life = 0.32;
    } else {
      const dx = lx - w / 2;
      const dy = ly - h / 2;
      delay = (1 - Math.sqrt(dx * dx + dy * dy) / maxR) * 0.55 + r1 * 0.1;
      life = 0.55;
    }
    const t = (p - delay) / life;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };

  // One pass per frame updates both buffers. Grains whose local time did not change
  // since the previous frame (still waiting, or already gone) are skipped entirely,
  // which cuts the JSI calls to roughly the grains in flight.
  useAnimatedReaction(
    () => progress.value,
    (p) => {
      const lp = last.value;
      if (p === lp) return;
      const T = transforms.value;
      const K = colors.value;
      for (let i = 0; i < count; i++) {
        const t = local(i, p);
        if (t === local(i, lp)) continue;
        const k = i * STRIDE;
        const lx = data[k];
        const ly = data[k + 1];
        const r2 = data[k + 3];
        const r3 = data[k + 4];
        const r4 = data[k + 5];
        const e = t * t;
        let cx = x + lx;
        let cy = y + ly;
        let s = 1;
        let rot = 0;
        let g = 1;
        let b = 1;
        let a = 1 - t * t * (3 - 2 * t);
        if (preset === 0) {
          // dust: blown to the right and up
          cx += (50 + r2 * 150) * e;
          cy += -(15 + r3 * 110) * e + Math.sin(t * 7 + r4 * 6.28) * 5 * t;
          s = 1 - t * 0.55;
          rot = (r4 - 0.5) * 6 * e;
        } else if (preset === 1) {
          // sand: falls with gravity
          cx += (r2 - 0.3) * 30 * e;
          cy += (60 + r3 * 220) * e;
          s = 1 - t * 0.3;
        } else if (preset === 2) {
          // ember: burns and rises
          cx += (r2 - 0.5) * 40 * e + Math.sin(t * 5 + r4 * 6.28) * 8 * t;
          cy += -(40 + r3 * 140) * e;
          s = 1 - t * 0.7;
          rot = (r4 - 0.5) * 3 * e;
          const hot = t < 0.25 ? t / 0.25 : 1;
          g = 1 - 0.45 * hot;
          b = 1 - 0.85 * hot;
          const f = t < 0.25 ? 0 : (t - 0.25) / 0.75;
          a = 1 - f * f * (3 - 2 * f);
        } else if (preset === 3) {
          // pixel: stepped, blocky collapse
          const q = Math.floor(t * 5) / 5;
          cx += (r2 - 0.5) * 24 * q;
          cy += (r3 - 0.5) * 24 * q;
          s = 1 - q;
          a = 1 - q * q;
        } else {
          // vortex: spirals into the center
          const dx = lx - w / 2;
          const dy = ly - h / 2;
          const r0 = Math.sqrt(dx * dx + dy * dy);
          const a0 = Math.atan2(dy, dx);
          const an = a0 + e * (2.5 + r2 * 1.5);
          const rr = r0 * (1 - e);
          cx = x + w / 2 + Math.cos(an) * rr;
          cy = y + h / 2 + Math.sin(an) * rr;
          s = 1 - t * 0.6;
          rot = an - a0;
        }
        const sc = (s < 0 || a <= 0 ? 0 : s) / pr;
        const scos = rot === 0 ? sc : sc * Math.cos(rot);
        const ssin = rot === 0 ? 0 : sc * Math.sin(rot);
        T[i].set(scos, ssin, cx - (scos * half - ssin * half), cy - (ssin * half + scos * half));
        const col = K[i];
        col[1] = g;
        col[2] = b;
        col[3] = a;
      }
      last.value = p;
      // Same trick Skia's buffer hooks use to notify the canvas of in-place changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transforms as any)._value = T;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (colors as any)._value = K;
    },
  );

  useEffect(() => {
    progress.value = withTiming(END, { duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" />
    </Canvas>
  );
}
