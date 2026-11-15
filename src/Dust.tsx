import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Atlas,
  Canvas,
  rect,
  useColorBuffer,
  useRSXformBuffer,
  type SkImage,
} from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Props = {
  image: SkImage;
  x: number;
  y: number;
  width: number;
  height: number;
  onDone: () => void;
};

// Size of one dust grain, in points.
const GRAIN = 3;
// How long a single grain takes to blow away, as a fraction of the timeline.
const LIFE = 0.42;
// Timeline end: last grains start around 0.7, so 0.7 + LIFE.
const END = 1.15;
const DURATION = 1500;

export function Dust({ image, x, y, width, height, onDone }: Props) {
  const pr = image.width() / width;
  const cols = Math.ceil(width / GRAIN);
  const rows = Math.ceil(height / GRAIN);
  const count = cols * rows;

  const { sprites, data } = useMemo(() => {
    const sprites = [];
    // Flat per-grain data: cx, cy, delay, vx, vy, rot, phase
    const data: number[] = new Array(count * 7);
    const imgW = image.width();
    const imgH = image.height();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const sx = c * GRAIN * pr;
        const sy = r * GRAIN * pr;
        const sw = Math.min(GRAIN * pr, imgW - sx);
        const sh = Math.min(GRAIN * pr, imgH - sy);
        sprites.push(rect(sx, sy, sw, sh));

        const lx = (c + 0.5) * GRAIN;
        const ly = (r + 0.5) * GRAIN;
        const k = i * 7;
        data[k] = x + lx;
        data[k + 1] = y + ly;
        // Sweep from left to right with a ragged edge.
        data[k + 2] = (lx / width) * 0.62 + (1 - ly / height) * 0.04 + Math.random() * 0.1;
        data[k + 3] = 50 + Math.random() * 150;
        data[k + 4] = -(15 + Math.random() * 110);
        data[k + 5] = (Math.random() - 0.5) * 6;
        data[k + 6] = Math.random() * Math.PI * 2;
      }
    }
    return { sprites, data };
  }, [image, x, y, width, height, pr, cols, rows, count]);

  const progress = useSharedValue(0);
  const half = (GRAIN * pr) / 2;

  const transforms = useRSXformBuffer(count, (val, i) => {
    'worklet';
    const k = i * 7;
    let t = (progress.value - data[k + 2]) / LIFE;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const e = t * t;
    const wobble = Math.sin(t * 7 + data[k + 6]) * 5 * t;
    const cx = data[k] + data[k + 3] * e;
    const cy = data[k + 1] + data[k + 4] * e + wobble;
    const s = (1 - t * 0.55) / pr;
    const r = data[k + 5] * e;
    const scos = s * Math.cos(r);
    const ssin = s * Math.sin(r);
    val.set(scos, ssin, cx - (scos * half - ssin * half), cy - (ssin * half + scos * half));
  });

  const colors = useColorBuffer(count, (val, i) => {
    'worklet';
    let t = (progress.value - data[i * 7 + 2]) / LIFE;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    val[0] = 1;
    val[1] = 1;
    val[2] = 1;
    val[3] = 1 - t * t * (3 - 2 * t);
  });

  useEffect(() => {
    progress.value = withTiming(END, { duration: DURATION, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Atlas
        image={image}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
      />
    </Canvas>
  );
}
