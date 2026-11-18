/**
 * VoiceNote, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the waveform, anything. Colors come from the dissolve theme
 * tokens (global.css), so it follows light and dark mode out of the box.
 *
 * <VoiceNote mine duration={14} seed="msg-42" onUnsend={() => remove(id)} />
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Group, Path, Skia, rect } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useDissolve, type VariantName } from 'react-native-dissolve';
import { Animated, Pressable, Text, View, cn, useToken } from './tw';
import { CALM } from './motion';

const BAR = 3;
const GAP = 2;
const WAVE_H = 28;
const BTN = 34;

// Icons drawn in a 34 x 34 box. The triangle sits a touch right of center (optical center).
const PLAY = Skia.Path.MakeFromSVGString('M13 10.6c0-1 1.1-1.6 1.9-1.1l9.4 6.4c.7.5.7 1.6 0 2.1l-9.4 6.4c-.8.5-1.9-.1-1.9-1.1z')!;
const PAUSE = (() => {
  const p = Skia.Path.Make();
  p.addRRect(Skia.RRectXY(Skia.XYWHRect(11.5, 10.5, 4, 13), 1.4, 1.4));
  p.addRRect(Skia.RRectXY(Skia.XYWHRect(18.5, 10.5, 4, 13), 1.4, 1.4));
  return p;
})();

/** Side presets. Bubble, button and label are classes; the Skia paints read tokens below. */
const SIDE = {
  mine: { bubble: 'bg-dissolve-accent', button: 'bg-white', label: 'text-white/70' },
  theirs: { bubble: 'bg-dissolve-surface', button: 'bg-dissolve-foreground', label: 'text-dissolve-muted' },
};

export type VoiceNoteProps = {
  /** Length of the note in seconds. Playback is simulated with a timer. */
  duration: number;
  /** Loudness per sample, 0 to 1. Resampled to the number of bars that fit. */
  levels?: number[];
  /** Used to generate a deterministic waveform when `levels` is not given. */
  seed?: number | string;
  /** Your own message: accent bubble with white content. Default false (surface bubble). */
  mine?: boolean;
  /** Bubble width. Default 248. */
  width?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  /** Called once the bubble has dissolved: remove it from your data here. */
  onUnsend?: () => void;
  /** Flip to true to unsend from outside (a menu, a swipe...). */
  unsent?: boolean;
  /** Long press the bubble to unsend. Default true when onUnsend is set. */
  unsendOnLongPress?: boolean;
  /** Exit used when the note is unsent. Default 'dust'. */
  preset?: VariantName;
  haptics?: boolean;
  /** Bubble classes (background, radius, padding...). */
  className?: string;
  /** Play / pause button classes. */
  buttonClassName?: string;
  /** Time label classes. */
  labelClassName?: string;
};

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: number | string) {
  if (typeof s === 'number') return Math.floor(s * 2654435761);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h;
}

/** A waveform that reads like speech: syllable bursts, short pauses, soft edges. */
export function voiceLevels(seed: number | string, count = 64): number[] {
  const r = rng(hash(seed));
  const out: number[] = [];
  let syllable = 0;
  let amp = 0.6;
  for (let i = 0; i < count; i++) {
    if (syllable <= 0) {
      // A new syllable, sometimes a short breath first.
      syllable = 3 + Math.floor(r() * 6);
      amp = r() < 0.16 ? 0.08 : 0.35 + r() * 0.65;
    }
    const k = 1 - Math.abs((syllable - 3) / 6);
    const v = amp * (0.55 + 0.45 * k) * (0.7 + 0.3 * r());
    out.push(v);
    syllable--;
  }
  // Light smoothing, then taper the ends.
  return out.map((v, i) => {
    const a = out[i - 1] ?? v;
    const b = out[i + 1] ?? v;
    const edge = Math.min(1, (i + 1) / 4, (count - i) / 4);
    return Math.max(0.06, ((a + 2 * v + b) / 4) * (0.5 + 0.5 * edge));
  });
}

function resample(levels: number[], n: number) {
  if (!levels.length || n <= 0) return [];
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    const a = Math.floor((j / n) * levels.length);
    const b = Math.max(a + 1, Math.floor(((j + 1) / n) * levels.length));
    let m = 0;
    for (let i = a; i < b && i < levels.length; i++) m = Math.max(m, levels[i]);
    out.push(Math.max(0, Math.min(1, m)));
  }
  return out;
}

const fmt = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * A voice message bubble. Play and pause, the played part of the waveform takes the ink,
 * drag along the waveform to seek (one tick per bar crossed). Unsent, it blows away as dust.
 * No audio dependency: playback is a timer, hook your player on onPlay / onPause.
 */
export function VoiceNote({
  duration,
  levels,
  seed = 1,
  mine = false,
  width = 248,
  onPlay,
  onPause,
  onEnd,
  onUnsend,
  unsent,
  unsendOnLongPress,
  preset = 'dust',
  haptics = true,
  className,
  buttonClassName,
  labelClassName,
}: VoiceNoteProps) {
  const side = mine ? SIDE.mine : SIDE.theirs;
  const accent = useToken('accent');
  const foreground = useToken('foreground');
  const surface = useToken('surface');
  // Skia paints: icon on the button, played and unplayed bars (unplayed is the same ink, faded).
  const iconColor = mine ? accent : surface;
  const ink = mine ? '#FFFFFF' : foreground;
  const unplayedOpacity = mine ? 0.3 : 0.22;

  const { ref, dissolving, dissolve } = useDissolve();
  const [waveW, setWaveW] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [sec, setSec] = useState(0);
  const gone = useRef(false);

  const progress = useSharedValue(0);
  const isPlaying = useSharedValue(false);
  const icon = useSharedValue(0); // 0 play, 1 pause
  const scrub = useSharedValue(0);
  const btn = useSharedValue(1);
  const hold = useSharedValue(0);
  const resumeAfter = useSharedValue(false);
  const lastBar = useSharedValue(-1);

  // Bars snapped to the pixel grid so the edges stay crisp.
  const px = 1 / PixelRatio.get();
  const snap = (v: number) => Math.round(v / px) * px;
  const count = waveW ? Math.floor((waveW + GAP) / (BAR + GAP)) : 0;
  const bars = useMemo(() => resample(levels ?? voiceLevels(seed, 96), count), [levels, seed, count]);
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const used = count * (BAR + GAP) - GAP;
    const x0 = snap((waveW - used) / 2);
    bars.forEach((v, i) => {
      const h = snap(Math.max(BAR, v * WAVE_H));
      p.addRRect(Skia.RRectXY(Skia.XYWHRect(x0 + i * (BAR + GAP), snap((WAVE_H - h) / 2), BAR, h), BAR / 2, BAR / 2));
    });
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, waveW, count]);

  useEffect(() => {
    icon.value = withTiming(playing ? 1 : 0, { duration: 220, easing: CALM });
    isPlaying.value = playing;
  }, [playing, icon, isPlaying]);

  useAnimatedReaction(
    () => Math.floor(progress.value * duration + 1e-4),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setSec, v);
    },
    [duration],
  );

  const ended = useCallback(() => {
    setPlaying(false);
    onEnd?.();
    progress.value = withDelay(260, withTiming(0, { duration: 420, easing: CALM }, (done) => {
      if (done) scheduleOnRN(setEngaged, false);
    }));
  }, [onEnd, progress]);

  const run = useCallback(() => {
    const from = progress.value >= 0.999 ? 0 : progress.value;
    progress.value = from;
    progress.value = withTiming(1, { duration: (1 - from) * duration * 1000, easing: Easing.linear }, (done) => {
      if (done) scheduleOnRN(ended);
    });
  }, [duration, ended, progress]);

  const play = useCallback(() => {
    if (gone.current) return;
    setEngaged(true);
    setPlaying(true);
    run();
    onPlay?.();
  }, [onPlay, run]);

  const pause = useCallback(() => {
    cancelAnimation(progress);
    setPlaying(false);
    onPause?.();
  }, [onPause, progress]);

  const toggle = () => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing) pause();
    else play();
  };

  const tick = useCallback(() => {
    if (haptics) Haptics.selectionAsync();
  }, [haptics]);

  const engage = useCallback(() => setEngaged(true), []);

  const unsend = useCallback(async () => {
    if (gone.current) return;
    gone.current = true;
    cancelAnimation(progress);
    setPlaying(false);
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await dissolve({ preset, duration: 1300, haptics });
    onUnsend?.();
  }, [dissolve, haptics, onUnsend, preset, progress]);

  useEffect(() => {
    if (unsent) unsend();
  }, [unsent, unsend]);

  // Seeking: tap or drag along the waveform. Playback pauses under the finger, resumes after.
  const seekTo = (x: number) => {
    'worklet';
    const p = waveW ? Math.max(0, Math.min(1, x / waveW)) : 0;
    progress.value = p;
    const bar = Math.min(count - 1, Math.floor(p * count));
    if (bar !== lastBar.value) {
      if (lastBar.value >= 0) scheduleOnRN(tick);
      lastBar.value = bar;
    }
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      resumeAfter.value = isPlaying.value;
      cancelAnimation(progress);
      lastBar.value = -1;
      scrub.value = withTiming(1, { duration: 180, easing: CALM });
      seekTo(e.x);
      scheduleOnRN(engage);
    })
    .onUpdate((e) => seekTo(e.x))
    .onFinalize(() => {
      scrub.value = withTiming(0, { duration: 260, easing: CALM });
      if (resumeAfter.value) {
        resumeAfter.value = false;
        scheduleOnRN(run);
      }
    });
  const tap = Gesture.Tap().onEnd((e) => {
    const wasPlaying = isPlaying.value;
    cancelAnimation(progress);
    lastBar.value = -1;
    seekTo(e.x);
    scheduleOnRN(engage);
    scheduleOnRN(tick);
    if (wasPlaying) scheduleOnRN(run);
  });
  const wave = Gesture.Race(pan, tap);

  const longPress = Gesture.LongPress()
    .enabled(!!onUnsend && unsendOnLongPress !== false)
    .minDuration(480)
    .onBegin(() => {
      hold.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
    })
    .onStart(() => {
      scheduleOnRN(unsend);
    })
    .onFinalize(() => {
      hold.value = withTiming(0, { duration: 220, easing: CALM });
    });

  const clip = useDerivedValue(() => rect(0, 0, progress.value * waveW, WAVE_H));
  const waveTransform = useDerivedValue(() => [{ scaleY: 1 + 0.14 * scrub.value }]);
  const playOpacity = useDerivedValue(() => 1 - icon.value);
  const pauseOpacity = useDerivedValue(() => icon.value);
  const playTransform = useDerivedValue(() => [{ scale: 1 - 0.4 * icon.value }]);
  const pauseTransform = useDerivedValue(() => [{ scale: 0.6 + 0.4 * icon.value }]);

  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.035 * hold.value }] }));
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btn.value }] }));

  const label = playing || engaged ? fmt(sec) : fmt(duration);

  return (
    <GestureDetector gesture={longPress}>
      <Animated.View style={bubbleStyle}>
        {/* Plain view for the dissolve snapshot; the bubble itself is styled with classes. */}
        <RNView ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
          <View
            className={cn('flex-row items-center gap-[10px] rounded-[25px] py-[8px] pl-[8px] pr-[14px]', side.bubble, className)}
            style={{ width, borderCurve: 'continuous' }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Voice message, ${fmt(duration)}`}
            accessibilityValue={{ text: fmt(sec) }}
            accessibilityActions={[{ name: 'activate' }, ...(onUnsend ? [{ name: 'unsend', label: 'Unsend' }] : [])]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'unsend' ? unsend() : toggle())}
          >
            <Pressable
              onPress={toggle}
              onPressIn={() => (btn.value = withTiming(0.9, { duration: 120, easing: CALM }))}
              onPressOut={() => (btn.value = withTiming(1, { duration: 260, easing: CALM }))}
              hitSlop={8}
            >
              <Animated.View className={cn('items-center justify-center rounded-full', side.button, buttonClassName)} style={[{ width: BTN, height: BTN }, btnStyle]}>
                <Canvas style={{ width: BTN, height: BTN }}>
                  <Group opacity={playOpacity} transform={playTransform} origin={{ x: BTN / 2, y: BTN / 2 }}>
                    <Path path={PLAY} color={iconColor} />
                  </Group>
                  <Group opacity={pauseOpacity} transform={pauseTransform} origin={{ x: BTN / 2, y: BTN / 2 }}>
                    <Path path={PAUSE} color={iconColor} />
                  </Group>
                </Canvas>
              </Animated.View>
            </Pressable>

            <GestureDetector gesture={wave}>
              <View className="flex-1 justify-center" style={{ height: WAVE_H }} onLayout={(e: LayoutChangeEvent) => setWaveW(Math.floor(e.nativeEvent.layout.width))}>
                {waveW ? (
                  <Canvas style={{ width: waveW, height: WAVE_H }}>
                    <Group transform={waveTransform} origin={{ x: waveW / 2, y: WAVE_H / 2 }}>
                      <Path path={path} color={ink} opacity={unplayedOpacity} />
                      <Group clip={clip}>
                        <Path path={path} color={ink} />
                      </Group>
                    </Group>
                  </Canvas>
                ) : null}
              </View>
            </GestureDetector>

            <Text
              className={cn('min-w-[30px] text-right text-[13px] font-medium', side.label, labelClassName)}
              style={{ fontVariant: ['tabular-nums'] }}
              allowFontScaling={false}
            >
              {label}
            </Text>
          </View>
        </RNView>
      </Animated.View>
    </GestureDetector>
  );
}
