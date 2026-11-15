import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { VoiceNote } from '../dissolve/components/VoiceNote';
import { C, mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const layout = LinearTransition.duration(380).easing(CALM);

type Item = { id: string; me: boolean } & ({ kind: 'text'; text: string } | { kind: 'voice'; duration: number; seed: string });

const THREAD: Item[] = [
  { id: 'a', me: false, kind: 'text', text: 'Je t’explique le brief en vocal, c’est plus simple' },
  { id: 'b', me: false, kind: 'voice', duration: 23, seed: 'lea-brief' },
  { id: 'c', me: true, kind: 'text', text: 'Top, je t’ai répondu' },
  { id: 'd', me: true, kind: 'voice', duration: 9, seed: 'rayan-reply' },
];

/**
 * A chat with a voice note from each side. Tap play, drag along the waveform to seek.
 * Long press your own note to unsend it: it blows away as dust and the thread closes up.
 */
export default function VoiceNoteDemo() {
  const [items, setItems] = useState(THREAD);
  const remove = (id: string) => setItems((all) => all.filter((x) => x.id !== id));
  const restored = items.length === THREAD.length;

  return (
    <View style={st.screen}>
      <Text style={st.day}>TODAY 10:12</Text>
      {items.map((m) => (
        <Animated.View key={m.id} layout={layout} entering={FadeIn.duration(320).easing(CALM)} style={[st.row, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
          {m.kind === 'text' ? (
            <View style={[st.bubble, m.me ? st.me : st.them]}>
              <Text style={[st.text, m.me && { color: '#FFFFFF' }]}>{m.text}</Text>
            </View>
          ) : (
            <VoiceNote mine={m.me} duration={m.duration} seed={m.seed} onUnsend={m.me ? () => remove(m.id) : undefined} />
          )}
        </Animated.View>
      ))}

      <Animated.View layout={layout} style={st.composer}>
        <View style={st.field}>
          <Text style={st.placeholder}>iMessage</Text>
        </View>
        <View style={st.mic}>
          <SymbolView name="waveform" size={17} tintColor="#FFFFFF" weight="semibold" />
        </View>
      </Animated.View>

      <Animated.View layout={layout} style={st.footer}>
        <Text style={st.hint}>{restored ? 'long press your note to unsend' : 'unsent · preset dust'}</Text>
        {!restored ? (
          <Pressable onPress={() => setItems(THREAD)} hitSlop={8} style={({ pressed }) => [st.reset, pressed && { opacity: 0.6 }]}>
            <Text style={st.resetText}>Restore</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { backgroundColor: C.bg, paddingHorizontal: 14, paddingVertical: 18, gap: 6 },
  day: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 8, letterSpacing: 0.4 },
  row: { width: '100%' },
  bubble: { maxWidth: 270, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderCurve: 'continuous' },
  me: { backgroundColor: '#1C1C1E' },
  them: { backgroundColor: '#EFEFF1' },
  text: { fontSize: 16, lineHeight: 21, color: '#1C1C1E', letterSpacing: -0.2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  field: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  placeholder: { fontSize: 16, color: C.muted },
  mic: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 10, marginTop: 14 },
  hint: { fontFamily: mono, fontSize: 11, color: C.muted, letterSpacing: 0.2 },
  reset: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  resetText: { fontSize: 13, fontWeight: '500', color: C.ink },
});
