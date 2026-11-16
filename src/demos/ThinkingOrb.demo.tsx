import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Easing, FadeIn, FadeOut, cancelAnimation, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ThinkingOrb, type OrbState } from '@registry/thinking-orb';
import { Animated, Pressable, Text, View, useToken } from '@registry/tw';
import { Chip, mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const STATES: OrbState[] = ['idle', 'thinking', 'searching', 'listening', 'done', 'error'];
const LINES: Record<OrbState, string> = {
  idle: 'How can I help?',
  thinking: 'Thinking it through',
  searching: 'Searching 14 sources',
  listening: 'Listening',
  done: 'Itinerary ready',
  error: 'Lost the connection, retrying',
};

/**
 * AI assistant composer: send a prompt and the orb thinks, searches, then lands on a check.
 * The mic makes it listen to a fake input level. Touch the orb, the dots move away.
 */
export default function ThinkingOrbDemo() {
  const onPrimary = useToken('primary-foreground');
  const muted = useToken('muted');
  const [state, setState] = useState<OrbState>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const level = useSharedValue(0);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  useEffect(() => {
    if (state === 'listening') {
      level.value = withRepeat(
        withSequence(withTiming(0.9, { duration: 180 }), withTiming(0.25, { duration: 260 }), withTiming(0.65, { duration: 200 }), withTiming(0.1, { duration: 340 })),
        -1,
      );
    } else {
      cancelAnimation(level);
      level.value = withTiming(0, { duration: 200 });
    }
  }, [state, level]);

  const send = () => {
    clear();
    setState('thinking');
    timers.current.push(setTimeout(() => setState('searching'), 1900));
    timers.current.push(setTimeout(() => setState('done'), 3900));
    timers.current.push(setTimeout(() => setState('idle'), 6400));
  };

  return (
    <View className="bg-dissolve-surface" style={st.card}>
      <Text className="text-dissolve-muted" style={st.kicker}>
        ASSISTANT · TRIP PLANNER
      </Text>

      <View style={st.stage}>
        <ThinkingOrb state={state} size={150} interactive level={level} />
        <Animated.View key={state} entering={FadeIn.duration(260).easing(CALM)} exiting={FadeOut.duration(140)} style={st.lineWrap}>
          <Text className={state === 'error' ? 'text-dissolve-danger' : 'text-dissolve-foreground'} style={st.line}>
            {LINES[state]}
          </Text>
        </Animated.View>
      </View>

      <View style={st.chips}>
        {STATES.map((s) => (
          <Chip
            key={s}
            label={s}
            active={state === s}
            onPress={() => {
              clear();
              setState(s);
            }}
          />
        ))}
      </View>

      <View className="border-dissolve-border bg-dissolve-background" style={st.composer}>
        <Text className="text-dissolve-foreground" style={st.prompt} numberOfLines={1}>
          Plan 3 days in Lisbon under 600 €
        </Text>
        <Pressable
          onPress={() => {
            clear();
            setState((s) => (s === 'listening' ? 'idle' : 'listening'));
          }}
          className="active:opacity-60"
          style={st.mic}
          accessibilityLabel="Voice"
        >
          <SymbolView name={state === 'listening' ? 'waveform' : 'mic.fill'} size={18} tintColor={muted} />
        </Pressable>
        <Pressable onPress={send} className="bg-dissolve-primary active:opacity-70" style={st.send} accessibilityLabel="Send">
          <SymbolView name="arrow.up" size={16} weight="bold" tintColor={onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 24, padding: 18 },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4 },
  stage: { alignItems: 'center', paddingTop: 18, paddingBottom: 8 },
  lineWrap: { height: 24, justifyContent: 'center', marginTop: 6 },
  line: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 14 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 5,
    height: 48,
    marginTop: 18,
    gap: 4,
  },
  prompt: { flex: 1, fontSize: 15 },
  mic: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
