/**
 * MiniPlayer, from dissolve (dissolve-ui). This file is yours: restyle it with
 * classNames, change the timings, the layout, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * A now playing pill that opens into the full player as one object, Dynamic Island style: the
 * pill grows into the sheet, the artwork arcs into place, the title travels from beside the
 * artwork to centered below it, and the controls settle in. Drag it up or down 1:1, swipe the
 * closed pill sideways to skip. Large surface: calm curve, critically damped, never bounces.
 *
 * The surface is Apple liquid glass (expo-glass-effect) on iOS 26 and later: one glass layer
 * that follows the morph, clipped by the animated rounded container so its corners always match.
 * Elsewhere (older iOS, Android, web) it falls back to the surface token with a hairline border.
 *
 * In the pill the title and subtitle sit vertically centered beside the artwork, left aligned,
 * truncated before the controls. The title is one text measured off screen, so its travel to
 * the centered open position is computed from its real width, with no first frame jump.
 *
 * Render it as the last child of a full screen container: it covers that container when open.
 *
 * <MiniPlayer title="Night Swim" subtitle="Low Tide" artwork={cover} progress={0.3}
 *   playing={playing} onPlayPause={toggle} onNext={next} onPrev={prev} />
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image, type ImageProps } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';
import { CALM } from './motion';

/** Small buttons only: a light overshoot. */
const POP = { damping: 15, stiffness: 420, mass: 0.6 };
const PILL_H = 64;
const ART_C = 40;
const TITLE = 22;
const TITLE_C = 15;
const SKIP = 24;
/** Pill layout: artwork at 12, text from 64, controls (two 40 pt buttons) 8 from the right. */
const TEXT_X = 64;
const CTRL_W = 8 + 40 + 4 + 40;
const TEXT_GAP = 12;
const TITLE_LH = 28;
const SUB_LH = 17;
const SUB_GAP = 1;

const GlassLayer = Animated.createAnimatedComponent(GlassView);
const EXTRAS: [SFSymbol, string][] = [
  ['quote.bubble', 'Lyrics'],
  ['airplay.audio', 'AirPlay'],
  ['list.bullet', 'Up next'],
];

export type MiniPlayerApi = { close: () => void };

export type MiniPlayerProps = {
  title: string;
  subtitle?: string;
  artwork: ImageProps['source'];
  /** Track progress 0..1. */
  progress?: number;
  /** Track length in seconds, shows the elapsed and remaining times when set. */
  duration?: number;
  playing: boolean;
  onPlayPause: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  /** Controlled open state. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Replaces the bottom row of the open player (lyrics, AirPlay, queue). */
  renderExpanded?: (api: MiniPlayerApi) => ReactNode;
  /** Gap between the closed pill and the container bottom, and bottom padding when open. Default 24. */
  bottom?: number;
  /** Gap left above the open player. Default 60. */
  topInset?: number;
  haptics?: boolean;
  /** Player surface classes (background, border). Applies to the fallback surface; with liquid
   * glass the background stays clear so the glass shows. */
  className?: string;
  /** Use liquid glass when the system supports it. Default true. */
  glass?: boolean;
};

const fmt = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Press feedback for the small controls: shrinks a touch, springs back with a light overshoot. */
function Btn({ onPress, size, label, children }: { onPress?: () => void; size: number; label: string; children: ReactNode }) {
  const k = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (k.value = withTiming(0.86, { duration: 90, easing: CALM }))}
      onPressOut={() => (k.value = withSpring(1, POP))}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View className="items-center justify-center" style={[{ width: size, height: size }, st]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Play and pause glyphs cross-fade and scale, never cut. */
function PlayGlyph({ playing, size, color }: { playing: boolean; size: number; color: string }) {
  const p = useSharedValue(playing ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(playing ? 1 : 0, POP);
  }, [playing, p]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ scale: 0.6 + 0.4 * (1 - p.value) }] }));
  const b = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.6 + 0.4 * p.value }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View className="absolute inset-0 items-center justify-center" style={a}>
        <SymbolView name="play.fill" size={size} tintColor={color} />
      </Animated.View>
      <Animated.View className="absolute inset-0 items-center justify-center" style={b}>
        <SymbolView name="pause.fill" size={size} tintColor={color} />
      </Animated.View>
    </View>
  );
}

/** Straight progress bar: a Skia path trimmed at the progress. */
function Bar({ width, prog, track, fill }: { width: number; prog: SharedValue<number>; track: string; fill: string }) {
  const path = useMemo(() => {
    return Skia.PathBuilder.Make().moveTo(2, 7).lineTo(Math.max(3, width - 2), 7).detach();
  }, [width]);
  return (
    <Canvas style={{ width, height: 14 }}>
      <Path path={path} color={track} style="stroke" strokeWidth={4} strokeCap="round" />
      <Path path={path} color={fill} style="stroke" strokeWidth={4} strokeCap="round" end={prog} />
    </Canvas>
  );
}

/** Ring around the pill play button, same trim. */
function Ring({ size, prog, track, fill }: { size: number; prog: SharedValue<number>; track: string; fill: string }) {
  const path = useMemo(() => {
    return Skia.PathBuilder.Make().addArc({ x: 2, y: 2, width: size - 4, height: size - 4 }, -90, 359.9).detach();
  }, [size]);
  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: size, height: size }]} pointerEvents="none">
      <Path path={path} color={track} style="stroke" strokeWidth={2} />
      <Path path={path} color={fill} style="stroke" strokeWidth={2} strokeCap="round" end={prog} />
    </Canvas>
  );
}

export function MiniPlayer({
  title,
  subtitle,
  artwork,
  progress = 0,
  duration,
  playing,
  onPlayPause,
  onNext,
  onPrev,
  expanded,
  onExpandedChange,
  renderExpanded,
  bottom = 24,
  topInset = 60,
  haptics = true,
  className,
  glass = true,
}: MiniPlayerProps) {
  const liquid = useMemo(() => glass && isLiquidGlassAvailable(), [glass]);
  const ink = useToken('foreground');
  const muted = useToken('muted');
  const line = useToken('border');
  const reduced = useReducedMotion();

  const [box, setBox] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState(expanded ?? false);
  // Natural size of the title at its open size, measured off screen, tagged with the text it
  // measured so a new title never travels with the previous one's width.
  const [tm, setTm] = useState<{ text: string; w: number; h: number } | null>(null);
  const [subH, setSubH] = useState(SUB_LH);
  const target = useRef(expanded ? 1 : 0);

  const o = useSharedValue(expanded ? 1 : 0);
  const start = useSharedValue(0);
  const side = useSharedValue(0);
  const swipe = useSharedValue(0);
  const prog = useSharedValue(progress);

  useEffect(() => {
    prog.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 300, easing: Easing.linear });
  }, [progress, prog]);

  // Geometry, all in container points. Everything below is an explicit interpolation of `o`.
  const CW = box.w;
  const CH = box.h;
  const Wc = Math.round(CW * 0.92);
  const Hx = Math.max(PILL_H, CH - topInset);
  const range = Math.max(1, Hx - PILL_H - bottom);
  const A = Math.max(120, Math.min(CW - 64, Hx - 48 - 300 - bottom));
  const artX1 = (CW - A) / 2;
  const artY1 = 48;
  const scC = TITLE_C / TITLE;
  // Pill text column: from beside the artwork to TEXT_GAP before the controls.
  const availC = Math.max(40, Wc - TEXT_X - CTRL_W - TEXT_GAP);
  const fullMax = Math.max(40, CW - 64);
  const measured = tm && tm.text === title ? tm : null;
  const natW = measured ? measured.w : fullMax;
  const titleH = measured ? measured.h : TITLE_LH;
  // Width of the title box at each end, in open size points (the pill draws it scaled by scC).
  const titleW0 = Math.min(natW, availC / scC);
  const titleW1 = Math.min(natW, fullMax);
  // Title and subtitle centered as one block in the pill.
  const blockC = titleH * scC + (subtitle ? SUB_GAP + subH : 0);
  const titleY0 = (PILL_H - blockC) / 2;
  const subY0 = titleY0 + titleH * scC + SUB_GAP;
  const shown = measured ? 1 : 0;
  const titleY1 = artY1 + A + 24;
  const blockTop = titleY1 + 34;
  const blockH = Math.max(0, Hx - blockTop - bottom);

  const settle = useCallback(
    (t: number) => {
      if (!haptics) return;
      if (t === 1) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [haptics],
  );

  const intent = useCallback(
    (t: number) => {
      const was = target.current;
      target.current = t;
      setOpen(t === 1);
      if (was !== t) onExpandedChange?.(t === 1);
    },
    [onExpandedChange],
  );

  const animateTo = useCallback(
    (t: number) => {
      o.value = withTiming(t, { duration: reduced ? 220 : 500, easing: CALM }, (fin) => {
        if (fin) scheduleOnRN(settle, t);
      });
    },
    [o, reduced, settle],
  );

  const request = useCallback(
    (t: number) => {
      intent(t);
      animateTo(t);
    },
    [intent, animateTo],
  );

  // Controlled mode: follow the prop when it moves away from the current target.
  useEffect(() => {
    if (expanded === undefined) return;
    const t = expanded ? 1 : 0;
    if (t === target.current) return;
    target.current = t;
    setOpen(expanded);
    animateTo(t);
  }, [expanded, animateTo]);

  const tick = useCallback(() => {
    if (haptics) Haptics.selectionAsync();
  }, [haptics]);

  const skip = useCallback(
    (dir: number) => {
      if (haptics) Haptics.selectionAsync();
      if (dir < 0) onNext?.();
      else onPrev?.();
    },
    [haptics, onNext, onPrev],
  );

  const vPan = Gesture.Pan()
    .enabled(CW > 0)
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onStart(() => {
      cancelAnimation(o);
      start.value = o.value;
      side.value = o.value > 0.5 ? 1 : 0;
    })
    .onChange((e) => {
      const next = Math.min(1, Math.max(0, start.value - e.translationY / range));
      o.value = next;
      const s = next > 0.5 ? 1 : 0;
      if (s !== side.value) {
        side.value = s;
        scheduleOnRN(tick);
      }
    })
    .onEnd((e) => {
      const t = Math.abs(e.velocityY) > 600 ? (e.velocityY < 0 ? 1 : 0) : o.value > 0.5 ? 1 : 0;
      scheduleOnRN(intent, t);
      // Critically damped, clamped: hands the finger velocity over without any bounce.
      o.value = withSpring(t, { dampingRatio: 1, duration: reduced ? 220 : 520, velocity: -e.velocityY / range, overshootClamping: true }, (fin) => {
        if (fin) scheduleOnRN(settle, t);
      });
    });

  const hPan = Gesture.Pan()
    .enabled(!open && CW > 0)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onChange((e) => {
      swipe.value = Math.min(SKIP, Math.max(-SKIP, e.translationX * 0.5));
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 56 || Math.abs(e.velocityX) > 500) {
        const dir = (e.translationX || e.velocityX) < 0 ? -1 : 1;
        const d = reduced ? 0 : SKIP;
        swipe.value = withTiming(dir * d, { duration: 110, easing: CALM }, (fin) => {
          if (!fin) return;
          scheduleOnRN(skip, dir);
          swipe.value = withSequence(withTiming(-dir * d, { duration: 0 }), withTiming(0, { duration: 320, easing: CALM }));
        });
      } else {
        swipe.value = withTiming(0, { duration: 260, easing: CALM });
      }
    });

  const gesture = Gesture.Race(vPan, hPan);

  const p = useDerivedValue(() => Math.min(1, Math.max(0, o.value)));

  const backdrop = useAnimatedStyle(() => ({ opacity: p.value * 0.8 }));
  const player = useAnimatedStyle(() => {
    const w = interpolate(p.value, [0, 1], [Wc, CW]);
    return {
      width: w,
      height: interpolate(p.value, [0, 1], [PILL_H, Hx]),
      left: (CW - w) / 2,
      bottom: interpolate(p.value, [0, 1], [bottom, 0]),
      borderRadius: interpolate(p.value, [0, 1], [PILL_H / 2, 38]),
    };
  });
  // The glass keeps its own corner shape in step with the container that clips it.
  const glassShape = useAnimatedStyle(() => ({ borderRadius: interpolate(p.value, [0, 1], [PILL_H / 2, 38]) }));
  // Artwork: drawn at its open size and scaled, so it stays sharp. Y leads X: it arcs into place.
  const art = useAnimatedStyle(() => {
    const v = p.value;
    const vy = 1 - (1 - v) * (1 - v);
    const size = interpolate(v, [0, 1], [ART_C, A]);
    const k = size / A;
    return {
      borderRadius: interpolate(v, [0, 1], [8, 14]) / k,
      opacity: 1 - (Math.abs(swipe.value) / SKIP) * 0.75 * (1 - v),
      transform: [{ translateX: interpolate(v, [0, 1], [12, artX1]) + swipe.value * (1 - v) }, { translateY: interpolate(vy, [0, 1], [12, artY1]) }, { scale: k }],
    };
  });
  // Y leads X like the artwork (same ease out), so the title drops below the growing artwork
  // instead of crossing over it, and stays inside the growing surface.
  const titleStyle = useAnimatedStyle(() => {
    const v = p.value;
    const vt = 1 - (1 - v) * (1 - v);
    return {
      width: interpolate(v, [0, 1], [titleW0, titleW1]),
      opacity: shown * (1 - (Math.abs(swipe.value) / SKIP) * 0.75 * (1 - v)),
      transform: [
        { translateX: interpolate(v, [0, 1], [TEXT_X, (CW - titleW1) / 2]) + swipe.value * 0.5 * (1 - v) },
        { translateY: interpolate(vt, [0, 1], [titleY0, titleY1]) },
        { scale: interpolate(v, [0, 1], [scC, 1]) },
      ],
    };
  });
  // Pill content leaves on the first third of the morph, player content arrives on the last half.
  const pillOut = useAnimatedStyle(() => {
    const k = interpolate(p.value, [0, 0.35], [0, 1], 'clamp');
    return { opacity: 1 - k, transform: [{ scale: 1 - 0.04 * k }] };
  });
  const pillSub = useAnimatedStyle(() => {
    const k = interpolate(p.value, [0, 0.35], [0, 1], 'clamp');
    return { opacity: (1 - k) * (1 - (Math.abs(swipe.value) / SKIP) * 0.75), transform: [{ translateX: swipe.value * 0.5 }] };
  });
  const block = useAnimatedStyle(() => {
    const k = interpolate(p.value, [0.5, 1], [0, 1], 'clamp');
    const w = interpolate(p.value, [0, 1], [Wc, CW]);
    return { left: -(CW - w) / 2, opacity: k, transform: [{ scale: 0.96 + 0.04 * k }] };
  });
  const grab = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.5, 1], [0, 1], 'clamp') }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const close = () => request(0);
  const press = (fn?: () => void) => () => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn?.();
  };

  const elapsed = duration ? progress * duration : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {CW ? (
        <>
          <Animated.View className="absolute inset-0 bg-dissolve-background" style={backdrop} pointerEvents={open ? 'auto' : 'none'}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close player" />
          </Animated.View>

          <GestureDetector gesture={gesture}>
            <Animated.View
              className={cn('absolute overflow-hidden', liquid ? 'bg-transparent' : 'border-dissolve-border bg-dissolve-surface', className)}
              style={[{ borderWidth: liquid ? 0 : StyleSheet.hairlineWidth, borderCurve: 'continuous' }, player]}
            >
              {liquid ? <GlassLayer pointerEvents="none" glassEffectStyle="regular" style={[StyleSheet.absoluteFill, glassShape]} /> : null}

              {/* Tap anywhere on the pill to open. Buttons sit above it and win their own taps. */}
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => request(1)}
                disabled={open}
                accessibilityRole="button"
                accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
                accessibilityHint="Opens the player"
              />

              <Animated.View pointerEvents="none" className="absolute left-0 top-0 overflow-hidden bg-dissolve-surface-2" style={[{ width: A, height: A, transformOrigin: 'left top' }, art]}>
                <Image source={artwork} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
              </Animated.View>

              {/* Off screen probe: the title's natural width and height at its open size. */}
              <Text
                pointerEvents="none"
                numberOfLines={1}
                className="absolute left-0 top-0 font-semibold opacity-0"
                style={{ fontSize: TITLE, lineHeight: TITLE_LH, transform: [{ translateX: -10000 }] }}
                onLayout={(e: LayoutChangeEvent) => {
                  const { width, height } = e.nativeEvent.layout;
                  setTm((m) => (m && m.text === title && m.w === Math.ceil(width) && m.h === height ? m : { text: title, w: Math.ceil(width), h: height }));
                }}
              >
                {title}
              </Text>

              <Animated.Text
                pointerEvents="none"
                numberOfLines={1}
                className="absolute left-0 top-0 font-semibold text-dissolve-foreground"
                style={[{ fontSize: TITLE, lineHeight: TITLE_LH, transformOrigin: 'left top' }, titleStyle]}
              >
                {title}
              </Animated.Text>

              {subtitle ? (
                <Animated.Text
                  pointerEvents="none"
                  numberOfLines={1}
                  onLayout={(e: LayoutChangeEvent) => setSubH(e.nativeEvent.layout.height)}
                  className="absolute text-[13px] text-dissolve-muted"
                  style={[{ left: TEXT_X, top: subY0, width: availC, lineHeight: SUB_LH }, pillSub]}
                >
                  {subtitle}
                </Animated.Text>
              ) : null}

              <Animated.View className="absolute right-[8px] top-[12px] h-[40px] flex-row items-center gap-[4px]" style={pillOut} pointerEvents={open ? 'none' : 'box-none'}>
                <Btn onPress={press(onPlayPause)} size={40} label={playing ? 'Pause' : 'Play'}>
                  <Ring size={40} prog={prog} track={line} fill={ink} />
                  <PlayGlyph playing={playing} size={17} color={ink} />
                </Btn>
                <Btn onPress={press(onNext)} size={40} label="Next track">
                  <SymbolView name="forward.fill" size={20} tintColor={ink} />
                </Btn>
              </Animated.View>

              <Animated.View className="absolute left-0 right-0 top-0 items-center" style={grab} pointerEvents={open ? 'box-none' : 'none'}>
                <Pressable onPress={close} hitSlop={10} style={{ height: 28, width: 60, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Close player">
                  <View className="h-[5px] w-[36px] rounded-full bg-dissolve-muted opacity-40" />
                </Pressable>
              </Animated.View>

              <Animated.View
                className="absolute px-[32px]"
                style={[{ top: blockTop, width: CW, height: blockH, transformOrigin: 'center top' }, block]}
                pointerEvents={open ? 'box-none' : 'none'}
              >
                {subtitle ? (
                  <Text numberOfLines={1} className="text-center text-[17px] text-dissolve-muted">
                    {subtitle}
                  </Text>
                ) : null}
                <View className="mt-[22px]">
                  <Bar width={CW - 64} prog={prog} track={line} fill={ink} />
                  {duration ? (
                    <View className="mt-[6px] flex-row justify-between">
                      <Text className="text-[12px] font-medium text-dissolve-muted" style={{ fontVariant: ['tabular-nums'] }}>
                        {fmt(elapsed)}
                      </Text>
                      <Text className="text-[12px] font-medium text-dissolve-muted" style={{ fontVariant: ['tabular-nums'] }}>
                        -{fmt(duration - elapsed)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View className="mt-[18px] flex-row items-center justify-evenly">
                  <Btn onPress={press(onPrev)} size={64} label="Previous track">
                    <SymbolView name="backward.fill" size={30} tintColor={ink} />
                  </Btn>
                  <Btn onPress={press(onPlayPause)} size={76} label={playing ? 'Pause' : 'Play'}>
                    <PlayGlyph playing={playing} size={42} color={ink} />
                  </Btn>
                  <Btn onPress={press(onNext)} size={64} label="Next track">
                    <SymbolView name="forward.fill" size={30} tintColor={ink} />
                  </Btn>
                </View>
                <View className="flex-1" />
                {renderExpanded ? (
                  renderExpanded({ close })
                ) : (
                  <View className="flex-row items-center justify-between px-[24px]">
                    {EXTRAS.map(([n, label]) => (
                      <Btn key={n} size={44} label={label}>
                        <SymbolView name={n} size={20} tintColor={muted} />
                      </Btn>
                    ))}
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </>
      ) : null}
    </View>
  );
}
