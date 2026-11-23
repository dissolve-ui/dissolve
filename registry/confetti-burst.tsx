/**
 * ConfettiBurst, from dissolve (dissolve-ui). This file is yours: change the count, the
 * physics, the shapes, anything. The default colors are the foreground and muted theme tokens
 * (global.css), so it stays monochrome and follows light and dark mode.
 *
 * A short, quiet celebration: a few small pieces of paper thrown up from a point (or from the top
 * of a view), that flutter as they turn, slow down in the air and fall, fading out before they
 * land. Real paper physics, kept small: about forty pieces, under two seconds, one shot per
 * fire(). Pieces are rectangles, strips or dots (shapes), in the colors you pass. Simulated and
 * drawn with Skia on the UI thread, in one canvas that never takes a touch. A success haptic with
 * each burst. Reduced motion: no burst at all (fire() resolves at once).
 *
 * Put it over the area the pieces may cover, as the last child of a screen:
 *
 * const confetti = useRef<ConfettiBurstHandle>(null);
 * const button = useRef<View>(null);
 * <View style={{ flex: 1 }}>
 *   <View ref={button}><GlossyButton label="Place order" onPress={() => confetti.current?.fire({ from: button })} /></View>
 *   <ConfettiBurst ref={confetti} />
 * </View>
 */
import { useImperativeHandle, useRef, type Ref, type RefObject } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useToken } from './tw';

export type ConfettiShape = 'rect' | 'strip' | 'dot';

export type FireOptions = {
  /** Where, in the coordinates of the ConfettiBurst view. Default: its center. */
  x?: number;
  y?: number;
  /** Throws from the top center of this view instead. */
  from?: RefObject<RNView | null>;
};

export type ConfettiBurstHandle = {
  /** Throws one burst. Resolves when it has been thrown. */
  fire: (at?: FireOptions) => Promise<void>;
};

export type ConfettiBurstProps = {
  ref?: Ref<ConfettiBurstHandle>;
  /** Pieces per burst. Default 40. */
  count?: number;
  /** Piece colors. Default: the foreground and muted tokens. */
  colors?: string[];
  /** Piece shapes, picked at random. Default ['rect', 'strip']. */
  shapes?: ConfettiShape[];
  /** Size of a piece, pt. Default 8. */
  size?: number;
  /** Width of the throw, degrees around straight up. Default 70. */
  spread?: number;
  /** How hard the pieces are thrown, 1 is a button's worth. Default 1. */
  power?: number;
  /** A success haptic with each burst. Default true. */
  haptics?: boolean;
};

/** The physics, per second. Same numbers as web. */
const GRAVITY = 1500;
const DRAG = 2.4;
const LIFE = 1.7;
const FADE = 0.35;
/** Floats per piece: x, y, vx, vy, rot, vr, flip, vf, wob, vw, w, h, dot, color, age, life. */
const F = 16;

const empty = (() => {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
})();

export function ConfettiBurst({ ref, count = 40, colors, shapes = ['rect', 'strip'], size = 8, spread = 70, power = 1, haptics = true }: ConfettiBurstProps) {
  const fg = useToken('foreground');
  const muted = useToken('muted');
  const ink = colors?.length ? colors : [fg, muted];
  const reduced = useReducedMotion();
  const box = useRef<RNView>(null);
  const pieces = useSharedValue<number[]>([]);
  const picture = useSharedValue<SkPicture>(empty);
  const dims = useSharedValue({ w: 1, h: 1 });

  const stop = () => cb.setActive(false);
  const cb = useFrameCallback((info) => {
    const dt = Math.min(0.04, (info.timeSincePreviousFrame ?? 16) / 1000);
    const src = pieces.value;
    const out: number[] = [];
    const { w, h } = dims.value;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, w, h));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const k = Math.exp(-dt * DRAG);
    for (let i = 0; i < src.length; i += F) {
      const q = src.slice(i, i + F);
      q[14] += dt;
      q[2] *= k;
      q[3] = q[3] * k + GRAVITY * dt * 0.55;
      q[6] += q[7] * dt;
      q[8] += q[9] * dt;
      q[4] += q[5] * dt;
      // Paper side on catches the air: it falls slower and sways.
      const face = Math.abs(Math.cos(q[6]));
      q[0] += (q[2] + Math.sin(q[8]) * 40 * face) * dt;
      q[1] += q[3] * dt * (1 - 0.35 * face);
      if (q[14] >= q[15] || q[1] > h + 40) continue;
      for (let j = 0; j < F; j++) out.push(q[j]);
      const left = q[15] - q[14];
      paint.setColor(Skia.Color(ink[q[13] % ink.length]));
      paint.setAlphaf(left < FADE ? Math.max(0, left / FADE) : 1);
      c.save();
      c.translate(q[0], q[1]);
      c.rotate((q[4] * 180) / Math.PI, 0, 0);
      // The flip: the piece turns over, so its height shrinks to an edge and back.
      c.scale(1, Math.max(0.08, face));
      if (q[12]) c.drawCircle(0, 0, q[10] / 2, paint);
      else c.drawRect(Skia.XYWHRect(-q[10] / 2, -q[11] / 2, q[10], q[11]), paint);
      c.restore();
    }
    picture.value = rec.finishRecordingAsPicture();
    pieces.value = out;
    if (!out.length) scheduleOnRN(stop);
  }, false);

  const throwAt = (x: number, y: number) => {
    const fresh: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (-90 + (Math.random() - 0.5) * spread) * (Math.PI / 180);
      const sp = (540 + Math.random() * 420) * power;
      const shape = shapes[Math.floor(Math.random() * shapes.length)] ?? 'rect';
      const s = size * (0.8 + Math.random() * 0.4);
      fresh.push(
        x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        Math.random() * Math.PI * 2, (Math.random() - 0.5) * 10,
        Math.random() * Math.PI * 2, 7 + Math.random() * 7,
        Math.random() * Math.PI * 2, 3 + Math.random() * 3,
        shape === 'strip' ? s * 0.45 : shape === 'dot' ? s * 0.7 : s,
        shape === 'strip' ? s * 1.6 : shape === 'dot' ? s * 0.7 : s * 0.62,
        shape === 'dot' ? 1 : 0, i, 0, LIFE * (0.75 + Math.random() * 0.25),
      );
    }
    scheduleOnUI(() => {
      'worklet';
      pieces.value = pieces.value.concat(fresh);
    });
    cb.setActive(true);
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  useImperativeHandle(ref, () => ({
    fire: (at = {}) => new Promise<void>((resolve) => {
      if (reduced || !box.current) return resolve();
      box.current.measureInWindow((bx, by, bw, bh) => {
        dims.value = { w: bw, h: bh };
        const from = at.from?.current;
        if (!from) {
          throwAt(at.x ?? bw / 2, at.y ?? bh / 2);
          return resolve();
        }
        from.measureInWindow((fx, fy, fw, fh) => {
          throwAt(fx - bx + fw / 2, fy - by + Math.min(8, fh / 2));
          resolve();
        });
      });
    }),
  }));

  return (
    <RNView ref={box} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </RNView>
  );
}
