/**
 * PasswordStrength, from dissolve (dissolve-ui). This file is yours: change the rules, the
 * scoring, the copy, anything. Colors come from the dissolve theme tokens (global.css), so it
 * follows light and dark mode out of the box.
 *
 * A password field with Show and Hide, a quiet strength meter and the rules ticking live. The meter
 * is four short segments of dots, not a bar: they fill from the left, dot by dot, as the password
 * gets stronger, and the word beside them (Weak, Fair, Good, Strong) rolls to the next one. Each
 * rule's circle turns into a check as soon as it is met. Common passwords and long runs of one
 * character score as weak whatever they contain. A selection tick when the strength changes.
 * Reduced motion: dots and words change in place.
 *
 * <PasswordStrength onChange={(pw, s) => { setPassword(pw); setOk(s.passed); }} />
 *
 * <PasswordStrength rules={[{ label: 'At least 8 characters', test: (p) => p.length >= 8 }]} />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable as RNPressable, TextInput as RNTextInput } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';

export type PasswordRule = { label: string; test: (password: string) => boolean };

export type Strength = {
  /** 0 (empty) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  /** '', 'Weak', 'Fair', 'Good' or 'Strong'. */
  label: string;
  /** Each rule, met or not. */
  rules: { label: string; met: boolean }[];
  /** Every rule met and a score of at least minScore. */
  passed: boolean;
};

export type PasswordStrengthProps = {
  /** The password, controlled. */
  value?: string;
  defaultValue?: string;
  /** Called on every keystroke with the password and its strength. */
  onChange?: (password: string, strength: Strength) => void;
  /** Return on the keyboard. */
  onSubmit?: (password: string, strength: Strength) => void;
  /** The checklist. Default: 12 characters, upper and lower case, a number, a symbol. */
  rules?: PasswordRule[];
  /** The score `passed` needs. Default 3 (Good). */
  minScore?: number;
  /** Placeholder. Default 'Password'. */
  placeholder?: string;
  /** A selection tick when the strength changes. Default true. */
  haptics?: boolean;
  disabled?: boolean;
  /** Field surface. Default 'bg-dissolve-surface'. */
  surfaceClassName?: string;
  /** Outer classes (margins, width...). */
  className?: string;
};

export const DEFAULT_RULES: PasswordRule[] = [
  { label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { label: 'Upper and lower case letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const COMMON = ['password', '123456', '12345678', '123456789', 'qwerty', 'azerty', 'letmein', 'welcome', 'iloveyou', 'admin', 'abc123', 'monkey', 'dragon', 'football', 'sunshine', 'princess', 'passw0rd', 'trustno1'];
const WORDS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const SEGMENTS = 4;
const DOTS = 6;
const DOT = 6;
const SPRING = { damping: 34, stiffness: 300, mass: 1 };

/** The score of a password, 0 to 4: length and variety, common passwords and repeats knocked down. */
export function scorePassword(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  const lower = p.toLowerCase();
  if (COMMON.some((c) => lower.includes(c)) && p.length < 16) return 1;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (p.length >= 16) s++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  s += classes - 1;
  if (/(.)\1{2,}/.test(p)) s--;
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/i.test(p)) s--;
  return s <= 1 ? 1 : s <= 3 ? 2 : s <= 5 ? 3 : 4;
}

export function strengthOf(p: string, rules: PasswordRule[], minScore: number): Strength {
  const score = scorePassword(p);
  const r = rules.map((x) => ({ label: x.label, met: x.test(p) }));
  return { score, label: WORDS[score], rules: r, passed: score >= minScore && r.every((x) => x.met) };
}

export function PasswordStrength({
  value,
  defaultValue = '',
  onChange,
  onSubmit,
  rules = DEFAULT_RULES,
  minScore = 3,
  placeholder = 'Password',
  haptics = true,
  disabled = false,
  surfaceClassName = 'bg-dissolve-surface',
  className,
}: PasswordStrengthProps) {
  const reduced = useReducedMotion();
  const [pw, setPw] = useState(value ?? defaultValue);
  const [shown, setShown] = useState(false);
  const ink = useToken('foreground');
  const muted = useToken('muted');
  useEffect(() => {
    if (value !== undefined && value !== pw) setPw(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = useMemo(() => strengthOf(pw, rules, minScore), [pw, rules, minScore]);
  const lastScore = useRef(s.score);
  useEffect(() => {
    if (s.score !== lastScore.current && s.score > 0 && haptics) Haptics.selectionAsync();
    lastScore.current = s.score;
  }, [s.score, haptics]);

  return (
    <View className={cn('self-stretch', disabled && 'opacity-50', className)} pointerEvents={disabled ? 'none' : 'auto'}>
      <View className={cn('flex-row items-center', surfaceClassName)} style={{ height: 52, borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 4 }}>
        <RNTextInput
          accessibilityLabel="Password"
          accessibilityHint={s.label ? `Strength ${s.label}` : undefined}
          value={pw}
          onChangeText={(t) => {
            setPw(t);
            onChange?.(t, strengthOf(t, rules, minScore));
          }}
          onSubmitEditing={() => onSubmit?.(pw, s)}
          secureTextEntry={!shown}
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={muted}
          editable={!disabled}
          style={{ flex: 1, height: 52, paddingLeft: 12, color: ink, fontSize: 17 }}
        />
        <RNPressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          onPress={() => setShown((v) => !v)}
          style={({ pressed }) => ({ height: 44, minWidth: 56, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <Text className="text-dissolve-muted" style={{ fontSize: 15, fontWeight: '600' }}>{shown ? 'Hide' : 'Show'}</Text>
        </RNPressable>
      </View>

      {/* The meter: four segments of dots and the word. */}
      <View
        className="flex-row items-center"
        style={{ paddingHorizontal: 16, paddingTop: 14, height: 34 }}
        accessible
        accessibilityRole="text"
        accessibilityLabel={s.score ? `Strength ${s.label}` : 'Strength, nothing typed yet'}
        accessibilityLiveRegion="polite"
      >
        <View className="flex-row flex-1" style={{ gap: 10 }}>
          {Array.from({ length: SEGMENTS }, (_, g) => (
            <View key={g} className="flex-row" style={{ gap: 4 }}>
              {Array.from({ length: DOTS }, (_, k) => (
                <Dot key={k} on={g < s.score} delay={(k + (g - Math.min(g, lastScore.current)) * DOTS) * 18} reduced={reduced} />
              ))}
            </View>
          ))}
        </View>
        <View style={{ width: 72, height: 20, overflow: 'hidden', alignItems: 'flex-end' }}>
          <Animated.Text
            key={s.label}
            entering={reduced ? undefined : wordIn}
            exiting={reduced ? undefined : wordOut}
            className={s.score === 4 ? 'text-dissolve-success' : s.score === 1 ? 'text-dissolve-danger' : 'text-dissolve-muted'}
            style={{ position: 'absolute', right: 0, fontSize: 15, fontWeight: '600', lineHeight: 20 }}
          >
            {s.label}
          </Animated.Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
        {s.rules.map((r) => (
          <Rule key={r.label} label={r.label} met={r.met} reduced={reduced} />
        ))}
      </View>
    </View>
  );
}

const wordIn = () => {
  'worklet';
  return { initialValues: { opacity: 0, transform: [{ translateY: 10 }] }, animations: { opacity: withTiming(1, { duration: 200 }), transform: [{ translateY: withSpring(0, SPRING) }] } };
};
const wordOut = () => {
  'worklet';
  return { initialValues: { opacity: 1, transform: [{ translateY: 0 }] }, animations: { opacity: withTiming(0, { duration: 140 }), transform: [{ translateY: withTiming(-10, { duration: 200 }) }] } };
};

function Dot({ on, delay, reduced }: { on: boolean; delay: number; reduced: boolean }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = reduced ? (on ? 1 : 0) : withDelay(on ? Math.max(0, delay) : 0, withTiming(on ? 1 : 0, { duration: 180 }));
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  const fill = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.4 + 0.6 * v.value }] }));
  return (
    <View className="bg-dissolve-surface-2" style={{ width: DOT, height: DOT, borderRadius: DOT / 2 }}>
      <Animated.View className="bg-dissolve-foreground" style={[{ position: 'absolute', inset: 0, borderRadius: DOT / 2 }, fill]} />
    </View>
  );
}

function Rule({ label, met, reduced }: { label: string; met: boolean; reduced: boolean }) {
  const v = useSharedValue(met ? 1 : 0);
  useEffect(() => {
    v.value = reduced ? (met ? 1 : 0) : met ? withSpring(1, { damping: 18, stiffness: 320 }) : withTiming(0, { duration: 140 });
  }, [met]); // eslint-disable-line react-hooks/exhaustive-deps
  const disc = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.5 + 0.5 * v.value }] }));
  return (
    <View className="flex-row items-center" style={{ gap: 10 }} accessible accessibilityLabel={`${label}, ${met ? 'done' : 'not yet'}`}>
      <View style={{ width: 18, height: 18 }}>
        <View className="border-dissolve-muted" style={{ position: 'absolute', inset: 0, borderRadius: 9, borderWidth: 1.5, opacity: 0.5 }} />
        <Animated.View className="bg-dissolve-success" style={[{ position: 'absolute', inset: 0, borderRadius: 9 }, disc]}>
          <View className="bg-dissolve-background" style={{ position: 'absolute', width: 1.8, height: 5, borderRadius: 1, left: 5.6, top: 8, transform: [{ rotate: '-45deg' }] }} />
          <View className="bg-dissolve-background" style={{ position: 'absolute', width: 1.8, height: 8.5, borderRadius: 1, left: 9.6, top: 4.6, transform: [{ rotate: '40deg' }] }} />
        </Animated.View>
      </View>
      <Text className={met ? 'text-dissolve-foreground' : 'text-dissolve-muted'} style={{ fontSize: 15 }}>{label}</Text>
    </View>
  );
}
