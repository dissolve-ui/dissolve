import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactionPicker } from '@registry/reaction-picker';
import { Text, View as TwView } from '@registry/tw';
import { mono } from '../ui';

type Msg = { id: string; me: boolean; text: string; reaction?: string | null };

const THREAD: Msg[] = [
  { id: '1', me: false, text: 'Coming by the studio tonight?' },
  { id: '2', me: false, text: 'Maya finished the three screens, they look great', reaction: '🔥' },
  { id: '3', me: true, text: 'Yes, around 7' },
  { id: '4', me: true, text: 'Bringing the prototype on my phone, the dust is wild' },
  { id: '5', me: false, text: 'Perfect, saving you a seat 🙌' },
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
    <TwView className="bg-dissolve-background" style={st.screen}>
      <Text className="text-dissolve-muted" style={st.day}>TODAY 18:42</Text>
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
              <TwView className={m.me ? 'bg-dissolve-primary' : 'bg-dissolve-surface'} style={[st.bubble, last && (m.me ? st.meTail : st.themTail)]}>
                <Text className={m.me ? 'text-dissolve-primary-foreground' : 'text-dissolve-foreground'} style={st.text}>
                  {m.text}
                </Text>
              </TwView>
            </ReactionPicker>
          </View>
        );
      })}
      <Text className="text-dissolve-muted" style={st.read}>Read 18:44</Text>
      <Text className="text-dissolve-muted" style={st.hint}>long press · slide · release on an emoji</Text>
    </TwView>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: 14, paddingVertical: 18 },
  day: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginBottom: 14, letterSpacing: 0.4 },
  row: { width: '100%' },
  bubble: { maxWidth: 270, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderCurve: 'continuous' },
  meTail: { borderBottomRightRadius: 6 },
  themTail: { borderBottomLeftRadius: 6 },
  text: { fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  read: { fontSize: 11, textAlign: 'right', marginTop: -4, marginRight: 4 },
  hint: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 22, letterSpacing: 0.2 },
});
