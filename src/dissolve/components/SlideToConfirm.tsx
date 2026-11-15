import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, LinearGradient, Path, Skia, Text as SkText, matchFont, vec } from '@shopify/react-native-skia';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const CHEVRON = Skia.Path.MakeFromSVGString('M9 6l6 6-6 6')!;
const CHECK = Skia.Path.MakeFromSVGString('M5 12.5l4.2 4.2L19 7')!;

export type SlideToConfirmProps = {
  label: string;
  /** Runs once the knob reaches the end. The knob shows a loader until the promise settles. */
  onConfirm: () => Promise<unknown> | void;
  doneLabel?: string;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  knobColor?: string;
  textColor?: string;
  doneColor?: string;
  /** Fraction of the track to reach before release confirms. Default 0.88. */
  threshold?: number;
  /** Time on the done state before the slider resets, ms. 0 stays done. Default 1600. */
  resetAfter?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Phase = 'idle' | 'loading' | 'done';

/**
 * Slide to pay or confirm, like Apple Pay or power off. A light shimmer runs across the label,
 * the track fills behind the knob, and past the threshold it locks, loads, then confirms.
 *
 * <SlideToConfirm label="Slide to pay 42 €" doneLabel="Paid" onConfirm={pay} />
 */
export function SlideToConfirm({
  label,
  onConfirm,
  doneLabel = 'Done',
  height = 60,
  trackColor = '#F2F2F7',
  fillColor = '#1C1C1E',
  knobColor = '#1C1C1E',
  textColor = '#8E8E93',
  doneColor = '#34C759',
  threshold = 0.88,
  resetAfter = 1600,
  haptics = true,
  style,
}: SlideToConfirmProps) {
  const [W, setW] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const pad = 5;
  const knob = height - pad * 2;
  const max = Math.max(1, W - knob - pad * 2);
  const x = useSharedValue(0);
  const tone = useSharedValue(0);
  const sweep = useSharedValue(0);
  const spin = useSharedValue(0);

  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }), fontSize: 16, fontWeight: '600' }), []);
  const textW = useMemo(() => font.measureText(label).width, [font, label]);
  const doneW = useMemo(() => font.measureText(doneLabel).width, [font, doneLabel]);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1);
  }, [sweep]);

  useEffect(() => {
    tone.value = withTiming(phase === 'done' ? 1 : 0, { duration: 320 });
    if (phase === 'loading') spin.value = withRepeat(withTiming(spin.value + 1, { duration: 900, easing: Easing.linear }), -1);
    if (phase === 'idle') x.value = withTiming(0, { duration: 420, easing: CALM });
  }, [phase, tone, spin, x]);

  const confirm = async () => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('loading');
    try {
      await onConfirm();
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('done');
      if (resetAfter) setTimeout(() => setPhase('idle'), resetAfter);
    } catch {
      setPhase('idle');
    }
  };

  const pan = Gesture.Pan()
    .enabled(phase === 'idle' && W > 0)
    .onChange((e) => {
      const next = x.value + e.changeX;
      x.value = next < 0 ? 0 : next > max ? max : next;
    })
    .onEnd((e) => {
      if (x.value > max * threshold || (e.velocityX > 1200 && x.value > max * 0.5)) {
        x.value = withTiming(max, { duration: 160, easing: CALM }, (done) => {
          if (done) scheduleOnRN(confirm);
        });
      } else {
        x.value = withTiming(0, { duration: 380, easing: CALM });
      }
    });

  const p = useDerivedValue(() => x.value / max);
  // Label: shimmer gradient moving across, fading out as the knob covers it.
  const textX = (W - textW) / 2;
  const baseY = height / 2 + 6;
  const g0 = useDerivedValue(() => vec(textX - 80 + (textW + 160) * sweep.value, 0));
  const g1 = useDerivedValue(() => vec(textX + (textW + 160) * sweep.value, 0));
  const labelOpacity = useDerivedValue(() => (1 - Math.min(1, p.value * 1.6)) * (1 - tone.value));
  const doneOpacity = useDerivedValue(() => tone.value);

  const fillStyle = useAnimatedStyle(() => ({
    width: x.value + knob + pad * 2,
    backgroundColor: interpolateColor(tone.value, [0, 1], [fillColor, doneColor]),
    opacity: phase === 'idle' ? Math.min(1, 0.15 + p.value) : 1,
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    backgroundColor: interpolateColor(tone.value, [0, 1], [knobColor, '#FFFFFF']),
  }));
  const chevronStyle = useAnimatedStyle(() => ({ opacity: phase === 'idle' ? 1 : 0 }));
  const spinStyle = useAnimatedStyle(() => ({ opacity: phase === 'loading' ? 1 : 0, transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: tone.value }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        style={[{ height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' }, style]}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
      >
        {W ? (
          <>
            <Animated.View style={[s.fill, { borderRadius: height / 2 }, fillStyle]} />
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              <SkText x={textX} y={baseY} text={label} font={font} opacity={labelOpacity}>
                <LinearGradient start={g0} end={g1} colors={[textColor, '#FFFFFF', textColor]} positions={[0, 0.5, 1]} mode="clamp" />
              </SkText>
              <SkText x={(W - doneW) / 2} y={baseY} text={doneLabel} font={font} color="#FFFFFF" opacity={doneOpacity} />
            </Canvas>
            <Animated.View style={[s.knob, { left: pad, top: pad, width: knob, height: knob, borderRadius: knob / 2 }, knobStyle]}>
              <Animated.View style={[s.center, chevronStyle]}>
                <Canvas style={{ width: 22, height: 22 }}>
                  <Path path={CHEVRON} color="#FFFFFF" style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" transform={[{ scale: 22 / 24 }]} />
                </Canvas>
              </Animated.View>
              <Animated.View style={[s.center, spinStyle]}>
                <View style={s.spinner} />
              </Animated.View>
              <Animated.View style={[s.center, checkStyle]}>
                <Canvas style={{ width: 22, height: 22 }}>
                  <Path path={CHECK} color={doneColor} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" transform={[{ scale: 22 / 24 }]} />
                </Canvas>
              </Animated.View>
            </Animated.View>
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  knob: { position: 'absolute', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.2, borderColor: '#FFFFFF', borderTopColor: 'transparent' },
});
