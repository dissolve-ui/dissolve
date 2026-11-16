/**
 * UploadTile, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the icons, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * An attachment that assembles from grains as it uploads: the upload progress (0 to 1) is the
 * share of grains that have landed, a front running left to right. At 1 the tile is whole and
 * only then the remove × fades in. No ring, no badge. A file over maxSize (or an upload that
 * rejects) completes its assembly, shakes, turns red and leaves as dust, and the row closes up
 * behind it. Tap the tile while it uploads to cancel: the request is aborted and the grains
 * that have landed snap away from your finger.
 * No picker dependency: bring your own (expo-image-picker, expo-document-picker...).
 * Needs the DissolveProvider at the root.
 *
 * <UploadTray
 *   files={files}
 *   upload={(file, onProgress, signal) => api.upload(file, { onProgress, signal })}
 *   maxSize={25 * 1024 * 1024}
 *   onAdd={pick}
 *   onRemove={(file) => setFiles((all) => all.filter((f) => f.id !== file.id))}
 * />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View as RNView, type GestureResponderEvent, type ImageSourcePropType } from 'react-native';
import { Atlas, Canvas, Path, Skia, rect, useCanvasRef, type SkImage } from '@shopify/react-native-skia';
import {
  Easing,
  makeMutable,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { capture, frames, measure, runDissolve, useDissolve, useDissolveContext, type Origin, type VariantName } from 'react-native-dissolve';
import { Animated, Pressable, Text, View, cn, useToken } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
/** Room kept around the tile for the × and the grains flying in, in points. */
const PAD = 6;
const RADIUS = 16;
/** Assembly: grain side, how much of the timeline one grain takes to land, how far it starts. */
const GRAIN = 2;
const WINDOW = 0.18;
const DRIFT = 10;
/** Progress chase per report, a rejected file's assembly, the × fade in. */
const CHASE = 240;
const INTRO = 420;
const CROSS_IN = 220;
const CROSS = Skia.Path.MakeFromSVGString('M8 8l8 8M16 8l-8 8')!;
const DOC = Skia.Path.MakeFromSVGString('M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h5')!;
const PLUS = Skia.Path.MakeFromSVGString('M12 5v14M5 12h14')!;

export type UploadFile = {
  /** Stable key, needed by UploadTray. */
  id?: string;
  name: string;
  /** Size in bytes. */
  size: number;
  /** Image thumbnail (remote or file uri). */
  uri?: string;
  /** Image thumbnail from a require() or any RN image source. */
  source?: ImageSourcePropType;
};

/** Report progress from 0 to 1, stop when the signal aborts, reject to show the error state. */
export type UploadFn = (file: UploadFile, onProgress: (progress: number) => void, signal: AbortSignal) => Promise<void>;

export type RemoveReason = 'rejected' | 'cancelled' | 'removed';

export type UploadTileProps = {
  file: UploadFile;
  upload: UploadFn;
  /** Bytes. A bigger file is rejected without starting the upload. */
  maxSize?: number;
  /** Tile side in points (6 pt of room are kept around it for the ×). Default 72. */
  size?: number;
  /** Space after the tile in a row, in points. It closes up with the tile. Default 0. */
  spacing?: number;
  onDone?: (file: UploadFile) => void;
  /** Called once the tile has gone and its space has closed: drop the file from your list here. */
  onRemove?: (file: UploadFile, reason: RemoveReason) => void;
  haptics?: boolean;
  /** Outer wrapper classes (margins). */
  className?: string;
  /** Tile classes (background, radius...). */
  tileClassName?: string;
};

type Phase = 'entering' | 'uploading' | 'done' | 'rejected' | 'leaving';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Deterministic noise, same values as the web port. */
const hash = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Per grain: home center x, y, the progress where it starts landing, its start offset dx, dy.
 * The front runs left to right with some noise, so the tile fills like a progress bar.
 */
function grainField(size: number) {
  const n = Math.floor(size / GRAIN);
  const data: number[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const lx = (c + 0.5) * GRAIN;
      const ly = (r + 0.5) * GRAIN;
      const start = (0.78 * (lx / size) + 0.22 * hash(i, 1)) * (1 - WINDOW);
      data.push(lx, ly, start, (hash(i, 2) - 0.5) * 2 * DRIFT, (hash(i, 3) - 0.5) * 2 * DRIFT);
    }
  }
  return { n, data };
}

/** The tile drawn as grains of its own snapshot, placed by the assembly progress. */
function Assembly({ image, size, progress }: { image: SkImage; size: number; progress: { value: number } }) {
  const { sprites, data, count, transforms } = useMemo(() => {
    const { n, data } = grainField(size);
    const pr = image.width() / size;
    const g = GRAIN * pr;
    const sprites = [];
    const xf = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        sprites.push(rect(c * g, r * g, g, g));
        xf.push(Skia.RSXform(0, 0, 0, 0));
      }
    }
    return { sprites, data, count: n * n, transforms: makeMutable(xf) };
  }, [image, size]);
  const pr = image.width() / size;

  useAnimatedReaction(
    () => progress.value,
    (p) => {
      const T = transforms.value;
      for (let i = 0; i < count; i++) {
        const k = i * 5;
        let t = (p - data[k + 2]) / WINDOW;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const e = 1 - (1 - t) * (1 - t) * (1 - t);
        const sc = e / pr;
        const cx = PAD + data[k] + data[k + 3] * (1 - e);
        const cy = PAD + data[k + 1] + data[k + 4] * (1 - e);
        T[i].set(sc, 0, cx - (e * GRAIN) / 2, cy - (e * GRAIN) / 2);
      }
      // Same trick Skia's buffer hooks use to notify the canvas of in-place changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transforms as any)._value = T;
    },
  );

  return <Atlas image={image} sprites={sprites} transforms={transforms} />;
}

export function UploadTile({ file, upload, maxSize, size = 72, spacing = 0, onDone, onRemove, haptics = true, className, tileClassName }: UploadTileProps) {
  const ctx = useDissolveContext();
  const reduced = useReducedMotion();
  const muted = useToken('muted');
  const onPrimary = useToken('primary-foreground');

  const outer = size + PAD * 2;
  const tooBig = maxSize != null && file.size > maxSize;
  const image = file.source ?? (file.uri ? { uri: file.uri } : undefined);
  const ext = (file.name.split('.').pop() ?? '').slice(0, 4).toUpperCase();

  const [phase, setPhase] = useState<Phase>('entering');
  /** Snapshot of the finished tile, drawn as grains while it assembles. */
  const [face, setFace] = useState<SkImage | null>(null);
  /** The real tile is shown (assembly over). */
  const [whole, setWhole] = useState(false);
  const [gone, setGone] = useState(false);
  /** No grains (reduced motion, or the snapshot failed): the tile fades in with the progress. */
  const [plain, setPlain] = useState(false);
  const { ref, dissolving, dissolve } = useDissolve();
  const faceRef = useRef<RNView>(null);
  const canvasRef = useCanvasRef();
  const loaded = useRef(!image);
  const onLoaded = useRef<(() => void) | null>(null);

  const progress = useSharedValue(0);
  const crossIn = useSharedValue(0);
  const tint = useSharedValue(0);
  const shake = useSharedValue(0);
  const width = useSharedValue(outer + spacing);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);

  // `whole` is read inside async flows: mirror it in a ref.
  const wholeRef = useRef(false);
  const whole_ = (on: boolean) => {
    wholeRef.current = on;
    setWhole(on);
  };

  const removed = (reason: RemoveReason) => onRemove?.(file, reason);

  const collapse = (reason: RemoveReason) => {
    width.value = withTiming(0, { duration: reduced ? 150 : 300, easing: CALM }, (done) => {
      if (done) scheduleOnRN(removed, reason);
    });
  };

  const leave = async (reason: RemoveReason, preset: VariantName, origin?: Origin) => {
    if (busy.current) return;
    busy.current = true;
    setPhase('leaving');
    const opts = {
      preset,
      origin,
      duration: preset === 'snap' ? 900 : 1100,
      grain: 2,
      haptics: false,
    };
    if (wholeRef.current) {
      await dissolve(opts);
    } else {
      // Mid assembly: what leaves is the grains that have landed, read off the canvas.
      const view = canvasRef.current;
      const box = await measure(ref);
      const snap = view && box && !ctx.reduced ? await view.makeImageSnapshotAsync() : null;
      const res =
        snap && box
          ? await runDissolve(ctx, ref, opts, {
              image: snap.makeNonTextureImage() ?? snap,
              box,
            })
          : null;
      await frames(2);
      setGone(true);
      if (res) await wait(res.duration * 0.6);
    }
    if (alive.current) collapse(reason);
  };

  /** Runs the assembly to 1 in `ms`, then shows the real tile. */
  const complete = (ms: number) =>
    new Promise<void>((res) => {
      const end = () => {
        whole_(true);
        res();
      };
      progress.value = withTiming(1, { duration: reduced ? 150 : ms, easing: CALM }, (done) => {
        if (done) scheduleOnRN(end);
      });
    });

  const reject = async () => {
    await complete(tooBig ? INTRO : CHASE);
    if (!alive.current) return;
    setPhase('rejected');
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    tint.value = withTiming(1, { duration: reduced ? 150 : 180, easing: CALM });
    if (!reduced) {
      // Three crisp shakes, ±6 pt, 240 ms in all.
      const swing = (x: number) => withTiming(x, { duration: 40, easing: Easing.inOut(Easing.sin) });
      shake.value = withSequence(swing(-6), swing(6), swing(-6), swing(6), swing(-6), swing(0));
    }
    await wait(760);
    if (alive.current) leave('rejected', 'dust', 'right');
  };

  const start = async () => {
    if (!alive.current || busy.current) return;
    if (tooBig) return reject();
    setPhase('uploading');
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await upload(
        file,
        (p) => {
          if (ctrl.signal.aborted) return;
          // The share of grains that have landed follows the upload.
          progress.value = withTiming(Math.max(progress.value, Math.min(1, p)), { duration: CHASE, easing: CALM });
        },
        ctrl.signal,
      );
    } catch {
      if (ctrl.signal.aborted || !alive.current) return;
      return reject();
    }
    if (ctrl.signal.aborted || !alive.current) return;
    await complete(CHASE);
    if (!alive.current || busy.current) return;
    setPhase('done');
    crossIn.value = withTiming(1, {
      duration: reduced ? 150 : CROSS_IN,
      easing: CALM,
    });
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone?.(file);
  };

  // Mount: wait for the thumbnail and a laid out frame, snapshot the tile, then upload.
  useEffect(() => {
    let off = false;
    (async () => {
      if (!loaded.current) await Promise.race([new Promise<void>((r) => (onLoaded.current = r)), wait(1500)]);
      await frames(2);
      if (off || !alive.current) return;
      const shot = reduced ? null : await capture(faceRef).catch(() => null);
      if (off || !alive.current) return;
      if (shot) setFace(shot.image);
      else setPlain(true);
      start();
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTile = (e: GestureResponderEvent) => {
    if (phase !== 'uploading') return;
    abort.current?.abort();
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    leave('cancelled', 'snap', {
      x: e.nativeEvent.locationX,
      y: e.nativeEvent.locationY,
    });
  };

  const onCross = () => {
    if (phase !== 'done') return;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Snap away from the × itself (local coordinates of the captured view).
    leave('removed', 'snap', { x: outer - 10, y: 10 });
  };

  const wrapStyle = useAnimatedStyle(() => ({ width: width.value }));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + 0.85 * progress.value,
  }));
  // 0.01, not 0: the hidden tile must still render for the snapshot.
  const hideFace = !whole && !plain;
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: tint.value * 0.14 }));
  const crossStyle = useAnimatedStyle(() => ({
    opacity: crossIn.value,
    transform: [{ scale: reduced ? 1 : 0.6 + 0.4 * crossIn.value }],
  }));
  const busyLabel = phase === 'uploading' ? `Uploading ${file.name}, tap to cancel` : phase === 'rejected' ? `${file.name} is too large` : file.name;

  return (
    <Animated.View className={className} style={[s.clip, { height: outer }, wrapStyle]}>
      <View className="flex-row">
        <Animated.View style={shakeStyle}>
          {/* Plain RN view: it holds the capture ref. */}
          <RNView
            ref={ref}
            collapsable={false}
            style={{
              width: outer,
              height: outer,
              padding: PAD,
              opacity: dissolving || gone ? 0 : 1,
            }}
          >
            {/* Where the tile lands, until it is whole. */}
            {!whole ? (
              <View
                pointerEvents="none"
                className="absolute rounded-[16px] border border-dissolve-border"
                style={{
                  left: PAD,
                  top: PAD,
                  width: size,
                  height: size,
                  borderCurve: 'continuous',
                }}
              />
            ) : null}

            <RNView style={hideFace ? s.hidden : null}>
              <Animated.View style={plain && !whole ? fadeStyle : null}>
                <RNView ref={faceRef} collapsable={false}>
                  <View
                    className={cn('overflow-hidden rounded-[16px] bg-dissolve-surface', tileClassName)}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: RADIUS,
                      borderCurve: 'continuous',
                    }}
                  >
                    {image ? (
                      <Image
                        source={image}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: size,
                          height: size,
                        }}
                        resizeMode="cover"
                        onLoadEnd={() => {
                          loaded.current = true;
                          onLoaded.current?.();
                        }}
                      />
                    ) : (
                      <View className="flex-1 justify-between p-[8px]">
                        <View className="flex-row items-center gap-[3px]">
                          <Canvas style={{ width: 20, height: 20 }}>
                            <Path path={DOC} color={muted} style="stroke" strokeWidth={1.7} strokeJoin="round" transform={[{ scale: 20 / 24 }]} />
                          </Canvas>
                          <Text className="text-[9px] font-bold tracking-[0.4px] text-dissolve-muted">{ext}</Text>
                        </View>
                        <View>
                          <Text numberOfLines={1} className="text-[11px] font-semibold text-dissolve-foreground">
                            {file.name}
                          </Text>
                          <Text numberOfLines={1} className="text-[10px] text-dissolve-muted" style={s.tabular}>
                            {formatBytes(file.size)}
                          </Text>
                        </View>
                      </View>
                    )}
                    {/* Danger tint: a light wash plus a crisp border. */}
                    <Animated.View pointerEvents="none" className="absolute inset-0 bg-dissolve-danger" style={fillStyle} />
                    <Animated.View pointerEvents="none" className="absolute inset-0 rounded-[16px] border-[1.5px] border-dissolve-danger" style={tintStyle} />
                    {phase === 'rejected' ? (
                      <View className="absolute bottom-[6px] self-center rounded-full bg-dissolve-danger px-[6px] py-[2px]">
                        <Text className="text-[9px] font-bold text-dissolve-danger-foreground">Too large</Text>
                      </View>
                    ) : null}
                  </View>
                </RNView>
              </Animated.View>
            </RNView>

            {face && !whole ? (
              <Canvas ref={canvasRef} pointerEvents="none" style={[StyleSheet.absoluteFill, { width: outer, height: outer }]}>
                <Assembly image={face} size={size} progress={progress} />
              </Canvas>
            ) : null}

            {/* While it uploads, the whole tile is the cancel button. */}
            <Pressable
              onPress={onTile}
              disabled={phase !== 'uploading'}
              accessibilityRole={phase === 'uploading' ? 'button' : 'image'}
              accessibilityLabel={busyLabel}
              style={StyleSheet.absoluteFill}
            />

            {phase === 'done' || (phase === 'leaving' && whole) ? (
              <Animated.View className="absolute right-0 top-0" style={crossStyle}>
                <Pressable
                  onPress={onCross}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${file.name}`}
                  className="h-[20px] w-[20px] items-center justify-center rounded-full bg-dissolve-primary active:opacity-70"
                >
                  <Canvas style={{ width: 12, height: 12 }}>
                    <Path path={CROSS} color={onPrimary} style="stroke" strokeWidth={3} strokeCap="round" transform={[{ scale: 12 / 24 }]} />
                  </Canvas>
                </Pressable>
              </Animated.View>
            ) : null}
          </RNView>
        </Animated.View>
        <View style={{ width: spacing }} />
      </View>
    </Animated.View>
  );
}

export type UploadTrayProps = {
  /** Files to show, each with a stable id. Remove them in onRemove. */
  files: (UploadFile & { id: string })[];
  upload: UploadFn;
  maxSize?: number;
  /** Shows an add tile first in the row. Open your picker here. */
  onAdd?: () => void;
  onDone?: (file: UploadFile) => void;
  onRemove?: (file: UploadFile, reason: RemoveReason) => void;
  size?: number;
  /** Space between tiles in points. Default 6 (the room kept for the × already adds 12). */
  gap?: number;
  haptics?: boolean;
  /** Root classes (margins...). */
  className?: string;
  /** Tile classes, forwarded to every tile. */
  tileClassName?: string;
};

/** Horizontal row of upload tiles with an optional add tile, scrolls to a newly added file. */
export function UploadTray({ files, upload, maxSize, onAdd, onDone, onRemove, size = 72, gap = 6, haptics = true, className, tileClassName }: UploadTrayProps) {
  const muted = useToken('muted');
  const scroll = useRef<ScrollView>(null);
  const count = useRef(files.length);
  const outer = size + PAD * 2;

  return (
    <View className={className}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          if (files.length > count.current) scroll.current?.scrollToEnd({ animated: true });
          count.current = files.length;
        }}
      >
        {onAdd ? (
          <View className="flex-row">
            <Pressable
              onPress={() => {
                if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAdd();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add attachment"
              className="active:opacity-60"
              style={{ width: outer, height: outer, padding: PAD }}
            >
              <View
                className="flex-1 items-center justify-center rounded-[16px] border-[1.5px] border-dashed border-dissolve-border"
                style={{ borderCurve: 'continuous' }}
              >
                <Canvas style={{ width: 22, height: 22 }}>
                  <Path path={PLUS} color={muted} style="stroke" strokeWidth={2} strokeCap="round" transform={[{ scale: 22 / 24 }]} />
                </Canvas>
              </View>
            </Pressable>
            <View style={{ width: gap }} />
          </View>
        ) : null}
        {files.map((f) => (
          <UploadTile
            key={f.id}
            file={f}
            upload={upload}
            maxSize={maxSize}
            size={size}
            spacing={gap}
            onDone={onDone}
            onRemove={onRemove}
            haptics={haptics}
            tileClassName={tileClassName}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  clip: { overflow: 'hidden' },
  hidden: { opacity: 0.01 },
  tabular: { fontVariant: ['tabular-nums'] },
});
