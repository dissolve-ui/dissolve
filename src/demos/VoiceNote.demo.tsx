import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { VoiceNote } from '@registry/voice-note';
import { Pressable, Text, View, useToken } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const layout = LinearTransition.duration(380).easing(CALM);

type Item = { id: string; me: boolean } & ({ kind: 'text'; text: string } | { kind: 'voice'; duration: number; seed: string });

const THREAD: Item[] = [
  { id: 'a', me: false, kind: 'text', text: 'Easier to explain the brief in a voice note' },
  { id: 'b', me: false, kind: 'voice', duration: 23, seed: 'lea-brief' },
  { id: 'c', me: true, kind: 'text', text: 'Great, just replied' },
  { id: 'd', me: true, kind: 'voice', duration: 9, seed: 'rayan-reply' },
];

/**
 * A chat with a voice note from each side. Tap play, drag along the waveform to seek.
 * Long press your own note to unsend it: it blows away as dust and the thread closes up.
 */
export default function VoiceNoteDemo() {
  const onPrimary = useToken('primary-foreground');
  const [items, setItems] = useState(THREAD);
  const remove = (id: string) => setItems((all) => all.filter((x) => x.id !== id));
  const restored = items.length === THREAD.length;

  return (
    <View className="bg-dissolve-background" style={st.screen}>
      <Text className="text-dissolve-muted" style={st.day}>TODAY 10:12</Text>
      {items.map((m) => (
        <Animated.View key={m.id} layout={layout} entering={FadeIn.duration(320).easing(CALM)} style={[st.row, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
          {m.kind === 'text' ? (
            <View className={m.me ? 'bg-dissolve-primary' : 'bg-dissolve-surface'} style={st.bubble}>
              <Text className={m.me ? 'text-dissolve-primary-foreground' : 'text-dissolve-foreground'} style={st.text}>
                {m.text}
              </Text>
            </View>
          ) : (
            <VoiceNote mine={m.me} duration={m.duration} seed={m.seed} onUnsend={m.me ? () => remove(m.id) : undefined} />
          )}
        </Animated.View>
      ))}

      <Animated.View layout={layout} style={st.composer}>
        <View className="border-dissolve-border bg-dissolve-surface" style={st.field}>
          <Text className="text-dissolve-muted" style={st.placeholder}>iMessage</Text>
        </View>
        <View className="bg-dissolve-primary" style={st.mic}>
          <SymbolView name="waveform" size={17} tintColor={onPrimary} weight="semibold" />
        </View>
      </Animated.View>

      <Animated.View layout={layout} style={st.footer}>
        <Text className="text-dissolve-muted" style={st.hint}>{restored ? 'long press your note to unsend' : 'unsent · preset dust'}</Text>
        {!restored ? (
          <Pressable onPress={() => setItems(THREAD)} hitSlop={8} className="border-dissolve-border bg-dissolve-surface active:opacity-60" style={st.reset}>
            <Text className="text-dissolve-foreground" style={st.resetText}>Restore</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: 14, paddingVertical: 18, gap: 6 },
  day: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginBottom: 8, letterSpacing: 0.4 },
  row: { width: '100%' },
  bubble: { maxWidth: 270, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderCurve: 'continuous' },
  text: { fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  field: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeholder: { fontSize: 16 },
  mic: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 10, marginTop: 14 },
  hint: { fontFamily: mono, fontSize: 11, letterSpacing: 0.2 },
  reset: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  resetText: { fontSize: 13, fontWeight: '500' },
});
