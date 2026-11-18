/**
 * ThinkingOrb, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the shapes, anything. Colors come from the dissolve theme
 * tokens (global.css), so it follows light and dark mode out of the box.
 *
 * A sphere of dots whose motion shows what an AI agent is doing. Every state change morphs the
 * dots from where they are to the new shape (600 ms, staggered), never an instant swap.
 *
 * <ThinkingOrb state={busy ? 'thinking' : 'idle'} size={96} />
 * <ThinkingOrb state="listening" level={micLevel} interactive />
 */
import { useEffect, useMemo, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Atlas, Canvas, FilterMode, MipmapMode, Skia, rect } from '@shopify/react-native-skia';
import { makeMutable, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { View, cn, useToken } from './tw';
import { makeSprite, notify, toRGB } from './dots';
import { CALM_FN } from './motion';

export type OrbState = 'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error';

export type ThinkingOrbProps = {
  state?: OrbState;
  /** Width and height of the orb in points. Default 64. */
  size?: number;
  /** Number of dots. Default 180. */
  dots?: number;
  /** Dot diameter in points at full depth. Default 2.1% of size, at least 2.5. */
  dotSize?: number;
  /** Optional 0..1 input level (microphone) that drives the listening pulse. */
  level?: SharedValue<number>;
  /** Dots flee the finger within 40 pt and settle back on release. Default false. */
  interactive?: boolean;
  /** Dot color. Default: the foreground token. Done uses success, error uses danger. */
  color?: string;
  /** Light on done, Warning on error. Default true. */
  haptics?: boolean;
  className?: string;
};

const STATE_ID: Record<OrbState, number> = {
  idle: 0,
  thinking: 1,
  searching: 2,
  listening: 3,
  done: 4,
  error: 5,
};
const MORPH = 600;
/** Error: the dots fall, rest, then reform (last delay 0.18 s + rest 1.25 s + reform 0.6 s), in ms. */
const ERROR_MS = 2100;
const STAGGER = 1.5;
const FLEE = 40;
/** Sprite resolution in pixels: drawn once, scaled down to the dot size by the Atlas. */
const SPR = 32;
/** Per dot seed: sphere x y z, disc x y angle, check x y, random, check z. */
const SEED = 10;
/** Per dot live pose: x y z (unit space), alpha, scale. */
const POSE = 5;
const TAU = Math.PI * 2;

/** Checkmark polyline in unit space (y down), sampled along its length on three lanes. */
const CHECK = [
  [-0.52, 0.02],
  [-0.16, 0.38],
  [0.56, -0.36],
];
/** Thinking rings: angular speed (rad/s) and the turn of each ring around the view axis. */
const RING_SPEED = [2.1, -1.6, 1.2];
const RING_TURN = [0, 1.05, -1.05];
const RING_TILT = 0.45;

function seeds(n: number) {
  const out: number[] = new Array(n * SEED).fill(0);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const l1 = Math.hypot(CHECK[1][0] - CHECK[0][0], CHECK[1][1] - CHECK[0][1]);
  const l2 = Math.hypot(CHECK[2][0] - CHECK[1][0], CHECK[2][1] - CHECK[1][1]);
  for (let i = 0; i < n; i++) {
    const k = i * SEED;
    // Fibonacci sphere.
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    out[k] = Math.cos(a) * r;
    out[k + 1] = y;
    out[k + 2] = Math.sin(a) * r;
    // Sunflower disc.
    const dr = Math.sqrt((i + 0.5) / n);
    out[k + 3] = Math.cos(a) * dr;
    out[k + 4] = Math.sin(a) * dr;
    out[k + 5] = ((a % TAU) + TAU) % TAU;
    // Checkmark: evenly spread along its length, a random offset across the stroke and a random
    // depth, so the dots keep varied sizes and opacities instead of three straight lanes.
    const L = l1 + l2;
    let u = ((i + 0.5) / n) * L;
    const seg = u < l1 ? 0 : 1;
    if (seg === 1) u -= l1;
    const p0 = CHECK[seg];
    const p1 = CHECK[seg + 1];
    const len = seg === 0 ? l1 : l2;
    const f = u / len;
    const nx = -(p1[1] - p0[1]) / len;
    const ny = (p1[0] - p0[0]) / len;
    const w = (Math.random() - 0.5) * 0.11;
    out[k + 6] = p0[0] + (p1[0] - p0[0]) * f + nx * w;
    out[k + 7] = p0[1] + (p1[1] - p0[1]) * f + ny * w;
    out[k + 9] = (Math.random() - 0.5) * 0.5;
    out[k + 8] = Math.random();
  }
  return out;
}

export function ThinkingOrb({ state = 'idle', size = 64, dots = 180, dotSize, level, interactive = false, color, haptics = true, className }: ThinkingOrbProps) {
  const reduced = useReducedMotion();
  const fg = useToken('foreground');
  const ink = toRGB(color ?? fg);
  const ok = useToken('success');
  const bad = useToken('danger');
  // Ink, done and error colors as 9 flat channels.
  const paletteKey = [...ink, ...toRGB(ok), ...toRGB(bad)].join();
  const palette = useSharedValue(paletteKey.split(',').map(Number));
  /** Bumped by anything that changes the drawing without moving a dot: wakes a resting orb. */
  const wake = useSharedValue(0);
  useEffect(() => {
    palette.value = paletteKey.split(',').map(Number);
    wake.value += 1;
  }, [palette, wake, paletteKey]);

  const n = Math.max(1, Math.round(dots));
  const { sprite, sprites, seed, transforms, colors, pose, from, off } = useMemo(
    () => ({
      sprite: makeSprite(SPR - 2),
      sprites: new Array(n).fill(0).map(() => rect(0, 0, SPR, SPR)),
      seed: seeds(n),
      transforms: makeMutable(new Array(n).fill(0).map(() => Skia.RSXform(0, 0, -100, -100))),
      colors: makeMutable(new Array(n).fill(0).map(() => new Float32Array([1, 1, 1, 0]))),
      pose: makeMutable<number[]>(new Array(n * POSE).fill(0)),
      from: makeMutable<number[]>(new Array(n * POSE).fill(0)),
      off: makeMutable<number[]>(new Array(n * 2).fill(0)),
    }),
    [n],
  );

  const target = useSharedValue(STATE_ID[state]);
  const applied = useSharedValue(-1);
  const changedAt = useSharedValue(0);
  const col = useSharedValue([ink[0], ink[1], ink[2]]);
  const colFrom = useSharedValue([ink[0], ink[1], ink[2]]);
  const finger = useSharedValue({ x: 0, y: 0, on: 0 });
  const fallback = useSharedValue(-1);
  const lvl = level ?? fallback;

  // Haptics on entering done / error (never on mount).
  const first = useRef(true);
  useEffect(() => {
    target.value = STATE_ID[state];
    if (first.current) {
      first.current = false;
      return;
    }
    if (!haptics) return;
    if (state === 'done') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (state === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [state, haptics, target]);

  const R = size * 0.4;
  const dot = dotSize ?? Math.max(2.5, size * 0.021);
  const cx = size / 2;
  const cy = size / 2;
  useEffect(() => {
    wake.value += 1;
  }, [wake, size, dot, n]);
  /** Last drawn frame: wake counter, input level, and whether anything was still moving. */
  const drawn = useSharedValue({ wake: -1, lvl: -2, moving: 1 });

  useFrameCallback((info) => {
    'worklet';
    // Absolute frame time: timeSinceFirstFrame restarts whenever React re-renders the callback.
    const now = info.timestamp;
    const dt = info.timeSincePreviousFrame ?? 16;
    const T = reduced ? 0 : now / 1000;
    const P = pose.value;
    const F = from.value;
    const O = off.value;
    const C = col.value;
    const pal = palette.value;
    const st = target.value;

    if (applied.value !== st) {
      if (applied.value === -1) {
        changedAt.value = -100000; // first frame: no morph, start on the shape.
      } else {
        for (let j = 0; j < n * POSE; j++) F[j] = P[j];
        colFrom.value = [C[0], C[1], C[2]];
        changedAt.value = now;
      }
      applied.value = st;
    }
    const since = now - changedAt.value;
    const dur = reduced ? 150 : MORPH;
    const stag = reduced ? 0 : STAGGER;
    const fon = finger.value.on;
    const lv0 = lvl.value;
    const last = drawn.value;

    // Rest: the loop stays registered but skips the work once the pose can no longer change (the
    // check, or any state under reduced motion where the clock is frozen) and the last frame drew it.
    const morphed = since > dur + n * stag;
    const still = morphed && (st === 4 || (reduced && (st !== 5 || since > ERROR_MS) && (st !== 3 || lv0 === last.lvl)));
    if (still && !fon && !last.moving && last.wake === wake.value) return;

    // Color: whole orb, same calm curve.
    const tc = since / dur < 0 ? 0 : since / dur > 1 ? 1 : since / dur;
    const ec = CALM_FN(tc);
    const ci = st === 4 ? 3 : st === 5 ? 6 : 0;
    const CF = colFrom.value;
    const r = CF[0] + (pal[ci] - CF[0]) * ec;
    const g = CF[1] + (pal[ci + 1] - CF[1]) * ec;
    const b = CF[2] + (pal[ci + 2] - CF[2]) * ec;
    C[0] = r;
    C[1] = g;
    C[2] = b;

    // Shared per frame terms.
    const spin = T * 0.45;
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const tilt = 0.38;
    const ct = Math.cos(tilt);
    const stl = Math.sin(tilt);
    const breathe = 0.98 + 0.02 * Math.sin((T * TAU) / 2.4);
    const lv = lv0 >= 0 ? lv0 : 0.35 + 0.25 * Math.sin(T * 2.3) + 0.1 * Math.sin(T * 5.1);
    const sweep = (T * TAU) % TAU;
    const perRing = Math.ceil(n / 3);
    const errT = since / 1000;
    const fx = finger.value.x;
    const fy = finger.value.y;
    const k = 1 - Math.exp(-dt / (fon ? 60 : 140));
    const T_ = transforms.value;
    const K_ = colors.value;
    let offset = 0;

    for (let i = 0; i < n; i++) {
      const s = i * SEED;
      let x = 0;
      let y = 0;
      let z = 0;
      let a = 1;
      let sc = 1;
      // Sphere rotated around Y, then tilted around X (shared by idle, listening, error).
      const ox = seed[s];
      const oy = seed[s + 1];
      const oz = seed[s + 2];
      const rx = ox * cs + oz * sn;
      const rz = -ox * sn + oz * cs;
      const sy = oy * ct - rz * stl;
      const sz = oy * stl + rz * ct;
      if (st === 0) {
        x = rx * breathe;
        y = sy * breathe;
        z = sz * breathe;
      } else if (st === 1) {
        const ring = i % 3;
        const j = Math.floor(i / 3);
        const th = (j / perRing) * TAU + T * RING_SPEED[ring];
        const x0 = Math.cos(th) * 0.95;
        const z0 = Math.sin(th) * 0.95;
        const y1 = -z0 * Math.sin(RING_TILT);
        const c2 = Math.cos(RING_TURN[ring]);
        const s2 = Math.sin(RING_TURN[ring]);
        x = x0 * c2 - y1 * s2;
        y = x0 * s2 + y1 * c2;
        z = z0 * Math.cos(RING_TILT);
      } else if (st === 2) {
        x = seed[s + 3] * 0.95;
        y = seed[s + 4] * 0.95;
        let d = sweep - seed[s + 5];
        d = ((d % TAU) + TAU) % TAU;
        a = 0.3 + 0.7 * Math.exp(-d * 1.4);
        z = a * 0.6 - 0.3;
      } else if (st === 3) {
        const wave = 0.5 + 0.5 * Math.sin(T * 9 - (oy + 1) * 3.2);
        const rr = 1 + lv * 0.3 * (0.35 + 0.65 * wave);
        x = rx * rr;
        y = sy * rr;
        z = sz * rr;
      } else if (st === 4) {
        x = seed[s + 6];
        y = seed[s + 7];
        z = seed[s + 9];
      } else {
        // Error: fall under gravity onto a floor, rest, then reform into the sphere.
        const delay = seed[s + 8] * 0.18;
        const tt = errT - delay < 0 ? 0 : errT - delay;
        const fall = Math.min(1.15, sy + 3.2 * tt * tt);
        const gx = rx * (1 + Math.min(tt, 0.9) * 0.35);
        let back = (errT - 1.25 - delay) / 0.6;
        back = back < 0 ? 0 : back > 1 ? 1 : CALM_FN(back);
        x = gx + (rx - gx) * back;
        y = fall + (sy - fall) * back;
        z = sz;
      }
      // Depth: nearer dots are bigger and more opaque, in every state.
      const dz = (z + 1) / 2 < 0 ? 0 : (z + 1) / 2 > 1 ? 1 : (z + 1) / 2;
      sc = 0.8 + 0.4 * dz;
      a = (0.38 + 0.62 * dz) * a;

      // Morph from the frozen pose at the state change.
      let tm = (since - i * stag) / dur;
      tm = tm < 0 ? 0 : tm > 1 ? 1 : tm;
      const e = tm === 1 ? 1 : CALM_FN(tm);
      const p = i * POSE;
      if (e < 1) {
        x = F[p] + (x - F[p]) * e;
        y = F[p + 1] + (y - F[p + 1]) * e;
        z = F[p + 2] + (z - F[p + 2]) * e;
        a = F[p + 3] + (a - F[p + 3]) * e;
        sc = F[p + 4] + (sc - F[p + 4]) * e;
      }
      P[p] = x;
      P[p + 1] = y;
      P[p + 2] = z;
      P[p + 3] = a;
      P[p + 4] = sc;

      // Orthographic projection, like the web version: depth only drives size and opacity.
      let px = cx + x * R;
      let py = cy + y * R;

      // Finger repulsion, eased back when released.
      let tox = 0;
      let toy = 0;
      if (fon) {
        const dx = px - fx;
        const dy = py - fy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < FLEE) {
          const push = ((FLEE - d) / FLEE) * 16;
          tox = d > 0.001 ? (dx / d) * push : push;
          toy = d > 0.001 ? (dy / d) * push : 0;
        }
      }
      const o = i * 2;
      O[o] += (tox - O[o]) * k;
      O[o + 1] += (toy - O[o + 1]) * k;
      if (fon || Math.abs(O[o]) + Math.abs(O[o + 1]) > 0.01) offset = 1;
      else {
        O[o] = 0;
        O[o + 1] = 0;
      }
      px += O[o];
      py += O[o + 1];

      const m = (dot * sc) / SPR;
      T_[i].set(m, 0, px - (m * SPR) / 2, py - (m * SPR) / 2);
      const cl = K_[i];
      cl[0] = r;
      cl[1] = g;
      cl[2] = b;
      cl[3] = a < 0 ? 0 : a > 1 ? 1 : a;
    }
    last.wake = wake.value;
    last.lvl = lv0;
    last.moving = still && !offset ? 0 : 1;
    notify(transforms);
    notify(colors);
  });

  const pan = Gesture.Pan()
    .enabled(interactive)
    .minDistance(0)
    .onBegin((e) => {
      finger.value = { x: e.x, y: e.y, on: 1 };
    })
    .onUpdate((e) => {
      finger.value = { x: e.x, y: e.y, on: 1 };
    })
    .onFinalize(() => {
      finger.value = { x: finger.value.x, y: finger.value.y, on: 0 };
    });

  return (
    <GestureDetector gesture={pan}>
      <View className={cn('items-center justify-center', className)} style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`Assistant ${state}`}>
        <Canvas style={{ width: size, height: size }} pointerEvents="none">
          {sprite ? <Atlas image={sprite} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} /> : null}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
