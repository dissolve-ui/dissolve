import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useDissolve } from '../hooks/useDissolve';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const SOFT = Easing.bezier(0.45, 0, 0.2, 1);

export type OTPInputProps = {
  /** Number of digits. Default 6. */
  length?: number;
  /** Controlled value. Leave undefined to let the input own its state. */
  value?: string;
  onChange?: (code: string) => void;
  /**
   * Runs once every box is filled. Return true (or a promise of true) to show the success
   * state, false to reject: the row shakes, the digits turn to dust and the input clears.
   * Returning nothing leaves the code in place.
   */
  onComplete?: (code: string) => boolean | void | Promise<boolean | void>;
  autoFocus?: boolean;
  /** Box height in points. Box width follows the available space unless boxWidth is set. */
  height?: number;
  boxWidth?: number;
  gap?: number;
  fontSize?: number;
  radius?: number;
  color?: string;
  boxColor?: string;
  borderColor?: string;
  activeColor?: string;
  successColor?: string;
  successFill?: string;
  errorColor?: string;
  errorFill?: string;
  /** Close the keyboard once the code is accepted. Default true. */
  blurOnSuccess?: boolean;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Phase = 'idle' | 'pending' | 'success' | 'error';

/** One caret, remounted on every keystroke so its blink restarts fully lit, like UIKit. */
function Caret({ color, height }: { color: string; height: number }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withSequence(withDelay(480, withTiming(0, { duration: 160, easing: SOFT })), withDelay(320, withTiming(1, { duration: 160, easing: SOFT }))),
      -1,
    );
    return () => cancelAnimation(o);
  }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 2, height, borderRadius: 1, backgroundColor: color }, st]} />;
}

/** A digit that lands with a short, crisp scale and fade. No bounce. */
function Glyph({ char, size, tone, color, success, error }: { char: string; size: number; tone: SharedValue<number>; color: string; success: string; error: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 220, easing: CALM });
  }, [p]);
  const st = useAnimatedStyle(() => ({
    opacity: p.value,
    color: interpolateColor(tone.value, [-1, 0, 1], [error, color, success]),
    transform: [{ translateY: (1 - p.value) * 5 }, { scale: 0.72 + 0.28 * p.value }],
  }));
  return <Animated.Text style={[s.glyph, { fontSize: size }, st]}>{char}</Animated.Text>;
}

/**
 * Tone (-1 error, 0 neutral, 1 success) and lift of one slot. Boxes and digits run the same
 * timeline from the same phase, so they stay in step without sharing values.
 */
function useSlotMotion(phase: Phase, i: number) {
  const tone = useSharedValue(0);
  const pop = useSharedValue(0);
  useEffect(() => {
    if (phase === 'success') {
      tone.value = withDelay(i * 40, withTiming(1, { duration: 260, easing: CALM }));
      // Tiny element: a short lift, staggered with the color.
      pop.value = withDelay(i * 40, withSequence(withTiming(1, { duration: 130, easing: CALM }), withTiming(0, { duration: 260, easing: CALM })));
    } else if (phase === 'error') {
      tone.value = withTiming(-1, { duration: 200, easing: CALM });
    } else {
      tone.value = withTiming(0, { duration: 260, easing: CALM });
    }
  }, [phase, i, tone, pop]);
  return { tone, pop };
}

type Colors = { box: string; border: string; active: string; success: string; successFill: string; error: string; errorFill: string };

type BoxProps = {
  i: number;
  length: number;
  phase: Phase;
  active: boolean;
  focused: boolean;
  caretHeight: number;
  sweep: SharedValue<number>;
  style: ViewStyle;
  colors: Colors;
};

function Box({ i, length, phase, active, focused, caretHeight, sweep, style, colors }: BoxProps) {
  const { tone, pop } = useSlotMotion(phase, i);
  const a = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    a.value = withTiming(active ? 1 : 0, { duration: 180, easing: CALM });
  }, [active, a]);

  const st = useAnimatedStyle(() => {
    // Loading sweep: a soft highlight travels left to right across the row.
    const x = sweep.value * (length + 2) - 1 - i;
    const glow = sweep.value === 0 ? 0 : Math.max(0, 1 - Math.abs(x) / 1.4);
    const base = interpolateColor(a.value, [0, 1], [colors.border, colors.active]);
    const t = tone.value;
    const border = t < 0 ? interpolateColor(-t, [0, 1], [base, colors.error]) : interpolateColor(t, [0, 1], [base, colors.success]);
    const fillBase = interpolateColor(glow, [0, 1], [colors.box, '#E6E6EA']);
    const fill = t < 0 ? interpolateColor(-t, [0, 1], [fillBase, colors.errorFill]) : interpolateColor(t, [0, 1], [fillBase, colors.successFill]);
    return {
      borderColor: border,
      backgroundColor: fill,
      borderWidth: interpolate(Math.max(a.value, Math.abs(t)), [0, 1], [StyleSheet.hairlineWidth * 2, 1.5]),
      transform: [{ scale: 1 + pop.value * 0.05 }],
    };
  });

  return (
    <Animated.View style={[s.box, style, st]}>
      {active && focused ? <Caret color={colors.active} height={caretHeight} /> : null}
    </Animated.View>
  );
}

/** Digit slot on the capturable layer: same footprint as its box, follows its lift. */
function Digit({ i, char, phase, size, style, color, success, error }: { i: number; char?: string; phase: Phase; size: number; style: ViewStyle; color: string; success: string; error: string }) {
  const { tone, pop } = useSlotMotion(phase, i);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.05 }] }));
  return (
    <Animated.View style={[style, s.center, st]}>
      {char ? <Glyph key={char} char={char} size={size} tone={tone} color={color} success={success} error={error} /> : null}
    </Animated.View>
  );
}

/**
 * One time code input. A hidden native field (SMS autofill, paste) drives the boxes; the active
 * box blinks a calm caret, each digit lands crisply. A full code calls onComplete: a light sweep
 * runs while it verifies, then the boxes turn green, or the row shakes and the digits blow away
 * as dust before the input clears and asks again.
 *
 * <OTPInput autoFocus onComplete={async (code) => (await api.verify(code)).ok} />
 */
export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  autoFocus = false,
  height = 56,
  boxWidth,
  gap = 8,
  fontSize = 26,
  radius = 14,
  color = '#1C1C1E',
  boxColor = '#F5F5F5',
  borderColor = '#E5E5EA',
  activeColor = '#1C1C1E',
  successColor = '#34C759',
  successFill = '#EAF9EE',
  errorColor = '#FF3B30',
  errorFill = '#FFEFEE',
  blurOnSuccess = true,
  haptics = true,
  style,
}: OTPInputProps) {
  const [inner, setInner] = useState('');
  const code = (value ?? inner).replace(/\D/g, '').slice(0, length);
  const [phase, setPhase] = useState<Phase>('idle');
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const sweep = useSharedValue(0);
  const shake = useSharedValue(0);
  const alive = useRef(true);
  const run = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setCode = useCallback(
    (next: string) => {
      if (value === undefined) setInner(next);
      onChange?.(next);
    },
    [value, onChange],
  );

  const verify = useCallback(
    async (full: string) => {
      if (!onComplete) return;
      const id = ++run.current;
      let res: boolean | void;
      const out = onComplete(full);
      const isAsync = !!out && typeof (out as Promise<unknown>).then === 'function';
      if (isAsync) {
        setPhase('pending');
        sweep.value = 0;
        sweep.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1);
      }
      try {
        res = await out;
      } catch {
        res = false;
      }
      cancelAnimation(sweep);
      sweep.value = withTiming(0, { duration: 160 });
      if (!alive.current || id !== run.current) return;

      if (res === true) {
        setPhase('success');
        if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (blurOnSuccess) setTimeout(() => input.current?.blur(), 280);
        return;
      }
      if (res !== false) {
        setPhase('idle');
        return;
      }

      // Rejected: tint, shake (three damped swings), dust, clear, ask again.
      setPhase('error');
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const swing = (x: number, d: number) => withTiming(x, { duration: d, easing: Easing.inOut(Easing.sin) });
      shake.value = withSequence(swing(-11, 55), swing(9, 85), swing(-6, 80), swing(4, 75), swing(-2, 70), swing(0, 65));
      await new Promise((r) => setTimeout(r, 520));
      if (!alive.current || id !== run.current) return;
      await dissolve({ preset: 'dust', duration: 900, grain: 2, origin: 'left', haptics: false });
      if (!alive.current || id !== run.current) return;
      setCode('');
      reset();
      setPhase('idle');
      input.current?.focus();
    },
    [onComplete, sweep, haptics, blurOnSuccess, shake, dissolve, setCode, reset],
  );

  const onChangeText = (text: string) => {
    if (phase !== 'idle') return; // Keep the keyboard up while verifying, ignore keys.
    const next = text.replace(/\D/g, '').slice(0, length);
    if (next === code) return;
    setCode(next);
    if (next.length === length) verify(next);
  };

  const slots = Array.from({ length }, (_, i) => i);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const active = Math.min(code.length, length - 1);
  const cell: ViewStyle = boxWidth ? { width: boxWidth, height, borderRadius: radius } : { flex: 1, height, borderRadius: radius };
  const colors = { box: boxColor, border: borderColor, active: activeColor, success: successColor, successFill, error: errorColor, errorFill };

  return (
    <View style={[{ alignSelf: boxWidth ? 'center' : 'stretch' }, style]}>
      <Animated.View style={rowStyle}>
        <View style={[s.row, { gap }]}>
          {slots.map((i) => (
            <Box
              key={i}
              i={i}
              length={length}
              phase={phase}
              active={phase === 'idle' && i === active && code.length < length}
              focused={focused}
              caretHeight={Math.round(fontSize * 1.05)}
              sweep={sweep}
              style={cell}
              colors={colors}
            />
          ))}
        </View>
        {/* Digits live on their own transparent layer: only they turn to dust, the boxes stay. */}
        <View ref={ref} collapsable={false} pointerEvents="none" style={[StyleSheet.absoluteFill, s.row, { gap, opacity: dissolving ? 0 : 1 }]}>
          {slots.map((i) => (
            <Digit key={i} i={i} char={code[i]} phase={phase} size={fontSize} style={cell} color={color} success={successColor} error={errorColor} />
          ))}
        </View>
      </Animated.View>
      <TextInput
        ref={input}
        value={code}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        maxLength={length}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoCorrect={false}
        caretHidden
        selectionColor="transparent"
        style={s.hidden}
        accessibilityLabel={`${length} digit code`}
        accessibilityHint={code.length ? `${code.length} of ${length} digits entered` : undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  box: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontWeight: '600', fontVariant: ['tabular-nums'], includeFontPadding: false },
  // Covers the row so a tap focuses it and a long press offers Paste. Nearly invisible
  // rather than opacity 0, so iOS keeps offering the SMS code above the keyboard.
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1 },
});
