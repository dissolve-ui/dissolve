import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Path, Skia, type SkImage, type SkPath } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useDissolveContext } from '../context';
import { frames, measure } from '../core';
import { runDissolve } from '../hooks/useDissolve';
import type { ViewRef } from '../types';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

/** Flat stroke buffer: x, y, width per point. */
type Stroke = number[];

export type SignatureExport = {
  /** Raster copy of the ink (CPU backed, safe to draw anywhere or keep around). */
  image: SkImage;
  /** PNG, base64 encoded, without the data: prefix. */
  base64: string;
  width: number;
  height: number;
};

export type SignaturePadHandle = {
  undo: () => void;
  /** Dissolves the ink into dust, then empties the pad. */
  clear: () => Promise<void>;
  isEmpty: () => boolean;
  /** Renders the ink offscreen. Null when the pad is empty. */
  toImage: () => SignatureExport | null;
  /** toImage() then onSave. */
  save: () => SignatureExport | null;
};

export type SignaturePadProps = {
  strokeColor?: string;
  /** Base nib width in points. Slow strokes get thicker, fast ones thinner. Default 3.2. */
  strokeWidth?: number;
  onChange?: (hasSignature: boolean) => void;
  onSave?: (signature: SignatureExport) => void;
  placeholder?: string;
  height?: number;
  radius?: number;
  background?: string;
  guideColor?: string;
  /** Background of the exported PNG. Default transparent. */
  exportBackground?: string;
  /** Built in Undo and Clear pills. Default true. */
  controls?: boolean;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<SignaturePadHandle>;
};

/**
 * Variable width outline of a stroke, built as one filled shape: offset both sides along the
 * normal by half the width, smooth each side with quadratic midpoints, round caps at both ends.
 * Runs on the UI thread for the live stroke and on JS for committed ones.
 */
function outline(pts: number[]): SkPath {
  'worklet';
  const path = Skia.Path.Make();
  const n = Math.floor(pts.length / 3);
  if (n === 0) return path;
  if (n === 1) {
    path.addCircle(pts[0], pts[1], pts[2] / 2);
    return path;
  }
  const L: number[] = [];
  const R: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1;
    const b = i === n - 1 ? n - 1 : i + 1;
    const dx = pts[b * 3] - pts[a * 3];
    const dy = pts[b * 3 + 1] - pts[a * 3 + 1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const hw = pts[i * 3 + 2] / 2;
    L.push(pts[i * 3] + nx * hw, pts[i * 3 + 1] + ny * hw);
    R.push(pts[i * 3] - nx * hw, pts[i * 3 + 1] - ny * hw);
  }
  const last = n - 1;
  path.moveTo(L[0], L[1]);
  for (let i = 1; i < last; i++) path.quadTo(L[i * 2], L[i * 2 + 1], (L[i * 2] + L[i * 2 + 2]) / 2, (L[i * 2 + 1] + L[i * 2 + 3]) / 2);
  path.lineTo(L[last * 2], L[last * 2 + 1]);
  // End cap: half circle as a cubic (control points 4/3 r along the tangent).
  let ex = pts[last * 3] - pts[(last - 1) * 3];
  let ey = pts[last * 3 + 1] - pts[(last - 1) * 3 + 1];
  let el = Math.sqrt(ex * ex + ey * ey) || 1;
  let k = (pts[last * 3 + 2] / 2) * 1.333;
  ex = (ex / el) * k;
  ey = (ey / el) * k;
  path.cubicTo(L[last * 2] + ex, L[last * 2 + 1] + ey, R[last * 2] + ex, R[last * 2 + 1] + ey, R[last * 2], R[last * 2 + 1]);
  for (let i = last - 1; i > 0; i--) path.quadTo(R[i * 2], R[i * 2 + 1], (R[i * 2] + R[i * 2 - 2]) / 2, (R[i * 2 + 1] + R[i * 2 - 1]) / 2);
  path.lineTo(R[0], R[1]);
  ex = pts[0] - pts[3];
  ey = pts[1] - pts[4];
  el = Math.sqrt(ex * ex + ey * ey) || 1;
  k = (pts[2] / 2) * 1.333;
  ex = (ex / el) * k;
  ey = (ey / el) * k;
  path.cubicTo(R[0] + ex, R[1] + ey, L[0] + ex, L[1] + ey, L[0], L[1]);
  path.close();
  return path;
}

/**
 * Sign with your finger. Ink is drawn with Skia as variable width strokes (slow is thick, fast
 * is thin, tapered ends), on a signing line with an x and a placeholder that fades once you
 * start. Undo removes the last stroke, Clear turns the signature into dust.
 *
 * const pad = useRef<SignaturePadHandle>(null);
 * <SignaturePad ref={pad} onChange={setSigned} onSave={({ base64 }) => upload(base64)} />
 * pad.current?.save();
 */
export function SignaturePad({
  strokeColor = '#1C1C1E',
  strokeWidth = 3.2,
  onChange,
  onSave,
  placeholder = 'Sign here',
  height = 200,
  radius = 20,
  background = '#FFFFFF',
  guideColor = '#C7C7CC',
  exportBackground,
  controls = true,
  haptics = true,
  style,
  ref,
}: SignaturePadProps) {
  const ctx = useDissolveContext();
  const inkRef = useRef<ViewRef>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [hidden, setHidden] = useState(false);
  const clearing = useRef(false);

  const cur = useSharedValue<number[]>([]);
  const id = useSharedValue(0);
  const nib = useSharedValue(strokeWidth);
  const ink = useSharedValue(0);
  const tools = useSharedValue(0);

  const paths = useMemo(() => strokes.map(outline), [strokes]);
  const live = useDerivedValue(() => outline(cur.value));
  const has = strokes.length > 0;

  // Placeholder and tools follow the ink (the live stroke flips them on touch down).
  useEffect(() => {
    ink.value = withTiming(has ? 1 : 0, { duration: 280, easing: CALM });
    tools.value = withTiming(has ? 1 : 0, { duration: 280, easing: CALM });
  }, [has, ink, tools]);

  const lastHas = useRef(false);
  useEffect(() => {
    if (lastHas.current === has) return;
    lastHas.current = has;
    onChange?.(has);
  }, [has, onChange]);

  const commit = useCallback(
    (pts: number[], strokeId: number) => {
      setStrokes((all) => [...all, pts]);
      // Drop the live copy once the committed path is on screen (unless a new stroke began).
      frames(2).then(() => {
        if (id.value === strokeId) cur.value = [];
      });
    },
    [cur, id],
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      id.value += 1;
      nib.value = strokeWidth * 0.75;
      cur.value = [e.x, e.y, nib.value];
      ink.value = withTiming(1, { duration: 220, easing: CALM });
    })
    .onUpdate((e) => {
      const a = cur.value;
      const n = a.length;
      if (!n) return;
      const dx = e.x - a[n - 3];
      const dy = e.y - a[n - 2];
      if (dx * dx + dy * dy < 2.25) return;
      // Ink feel: the nib widens when you slow down and thins out on fast flicks.
      const speed = Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY);
      const target = Math.min(strokeWidth * 1.45, Math.max(strokeWidth * 0.42, strokeWidth * (1.45 - speed / 1700)));
      nib.value = nib.value + (target - nib.value) * 0.22;
      const w = nib.value;
      cur.modify((v) => {
        'worklet';
        v.push(e.x, e.y, w);
        return v;
      });
    })
    .onFinalize(() => {
      const a = cur.value;
      if (!a.length) return;
      const out = a.slice();
      // Lift the pen: taper the last point.
      if (out.length >= 6) out[out.length - 1] *= 0.5;
      scheduleOnRN(commit, out, id.value);
    });

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const toImage = useCallback((): SignatureExport | null => {
    if (!strokes.length || !size.w) return null;
    const pr = PixelRatio.get();
    const w = Math.round(size.w * pr);
    const h = Math.round(size.h * pr);
    const surface = Skia.Surface.MakeOffscreen(w, h) ?? Skia.Surface.Make(w, h);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color(exportBackground ?? 'transparent'));
    canvas.scale(pr, pr);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(strokeColor));
    for (const p of paths) canvas.drawPath(p, paint);
    surface.flush();
    const snap = surface.makeImageSnapshot();
    const image = snap.makeNonTextureImage() ?? snap;
    return { image, base64: image.encodeToBase64(), width: size.w, height: size.h };
  }, [strokes.length, size, exportBackground, strokeColor, paths]);

  const undo = useCallback(() => {
    if (clearing.current) return;
    cur.value = [];
    setStrokes((all) => all.slice(0, -1));
    if (haptics) Haptics.selectionAsync();
  }, [cur, haptics]);

  const clear = useCallback(async () => {
    if (clearing.current || !strokes.length) return;
    clearing.current = true;
    try {
      const shot = ctx.reduced ? null : toImage();
      const box = shot ? await measure(inkRef) : null;
      if (shot && box) {
        // Transparent snapshot of the ink only: the line and the paper stay, the signature blows away.
        const res = await runDissolve(ctx, inkRef, { preset: 'dust', origin: 'left', duration: 1200, haptics }, { image: shot.image, box });
        await frames(2);
        setHidden(true);
        if (res) await new Promise((r) => setTimeout(r, res.duration * 0.35));
      }
      cur.value = [];
      setStrokes([]);
      await frames(2);
      setHidden(false);
    } finally {
      clearing.current = false;
    }
  }, [strokes.length, ctx, toImage, haptics, cur]);

  const save = useCallback(() => {
    const out = toImage();
    if (out) onSave?.(out);
    return out;
  }, [toImage, onSave]);

  useImperativeHandle(ref, () => ({ undo, clear, isEmpty: () => strokes.length === 0, toImage, save }), [undo, clear, strokes.length, toImage, save]);

  const holder = useAnimatedStyle(() => ({ opacity: 1 - ink.value, transform: [{ translateY: ink.value * -4 }] }));
  const toolStyle = useAnimatedStyle(() => ({ opacity: tools.value, transform: [{ translateY: (1 - tools.value) * -4 }] }));
  const baseline = height * 0.7;

  return (
    <View onLayout={onLayout} style={[{ height, borderRadius: radius, backgroundColor: background, overflow: 'hidden' }, style]} accessibilityLabel="Signature pad">
      {/* Signing line: x, rule and the placeholder above it. */}
      <View pointerEvents="none" style={[s.line, { top: baseline, backgroundColor: guideColor }]} />
      <Text pointerEvents="none" style={[s.cross, { top: baseline - 26, color: guideColor }]}>
        ×
      </Text>
      <Animated.Text pointerEvents="none" style={[s.placeholder, { top: baseline - 34, color: guideColor }, holder]}>
        {placeholder}
      </Animated.Text>

      <GestureDetector gesture={pan}>
        <View ref={inkRef} collapsable={false} style={[StyleSheet.absoluteFill, { opacity: hidden ? 0 : 1 }]}>
          <Canvas style={StyleSheet.absoluteFill}>
            {paths.map((p, i) => (
              <Path key={i} path={p} color={strokeColor} />
            ))}
            <Path path={live} color={strokeColor} />
          </Canvas>
        </View>
      </GestureDetector>

      {controls ? (
        <Animated.View style={[s.tools, toolStyle]} pointerEvents={has ? 'box-none' : 'none'}>
          <Pressable onPress={undo} hitSlop={6} style={({ pressed }) => [s.tool, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel="Undo last stroke">
            <Text style={s.toolText}>Undo</Text>
          </Pressable>
          <Pressable onPress={clear} hitSlop={6} style={({ pressed }) => [s.tool, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel="Clear signature">
            <Text style={s.toolText}>Clear</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  line: { position: 'absolute', left: 22, right: 22, height: StyleSheet.hairlineWidth * 2 },
  cross: { position: 'absolute', left: 24, fontSize: 22, fontWeight: '300' },
  placeholder: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 15, fontWeight: '500', letterSpacing: -0.1 },
  tools: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 6 },
  tool: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F2F2F7' },
  pressed: { opacity: 0.6 },
  toolText: { fontSize: 13, fontWeight: '600', color: '#3A3A3C' },
});
