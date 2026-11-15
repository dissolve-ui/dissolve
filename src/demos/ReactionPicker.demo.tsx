import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactionPicker } from '../dissolve/components/ReactionPicker';
import { C, mono } from '../ui';

type Msg = { id: string; me: boolean; text: string; reaction?: string | null };

const THREAD: Msg[] = [
  { id: '1', me: false, text: 'Tu passes à l’atelier ce soir ?' },
  { id: '2', me: false, text: 'Maya a fini les trois écrans, ils sont superbes', reaction: '🔥' },
  { id: '3', me: true, text: 'Oui, vers 19 h' },
  { id: '4', me: true, text: 'Je ramène le proto sur le téléphone, la poussière rend fou' },
  { id: '5', me: false, text: 'Parfait, je garde une place 🙌' },
];

/**
 * A short iMessage thread. Long press any bubble, slide across the pill and let go on an emoji.
 * Pick the same one again to remove it: the badge snaps into grains.
 */
export default function ReactionPickerDemo() {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState(THREAD);

  const react = (id: string, emoji: string) =>
    setMsgs((all) => all.map((m) => (m.id === id ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m)));

  return (
    <View style={st.screen}>
      <Text style={st.day}>TODAY 18:42</Text>
      {msgs.map((m, i) => {
        const next = msgs[i + 1];
        const last = !next || next.me !== m.me;
        return (
          <View key={m.id} style={[st.row, { alignItems: m.me ? 'flex-end' : 'flex-start', marginBottom: last ? 10 : 2, paddingTop: m.reaction ? 14 : 0 }]}>
            <ReactionPicker
              selected={m.reaction}
              onReact={(e) => react(m.id, e)}
              corner={m.me ? 'top-left' : 'top-right'}
              insets={{ top: insets.top + 8, bottom: insets.bottom + 8 }}
            >
              <View style={[st.bubble, m.me ? st.me : st.them, last && (m.me ? st.meTail : st.themTail)]}>
                <Text style={[st.text, m.me && { color: '#FFFFFF' }]}>{m.text}</Text>
              </View>
            </ReactionPicker>
          </View>
        );
      })}
      <Text style={st.read}>Read 18:44</Text>
      <Text style={st.hint}>long press · slide · release on an emoji</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { backgroundColor: C.bg, paddingHorizontal: 14, paddingVertical: 18 },
  day: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 14, letterSpacing: 0.4 },
  row: { width: '100%' },
  bubble: { maxWidth: 270, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderCurve: 'continuous' },
  me: { backgroundColor: '#1C1C1E' },
  them: { backgroundColor: '#EFEFF1' },
  meTail: { borderBottomRightRadius: 6 },
  themTail: { borderBottomLeftRadius: 6 },
  text: { fontSize: 16, lineHeight: 21, color: '#1C1C1E', letterSpacing: -0.2 },
  read: { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: -4, marginRight: 4 },
  hint: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 22, letterSpacing: 0.2 },
});
