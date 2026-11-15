import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve } from '@/dissolve';
import { Button, Caption } from '@/ui';
import { layout } from '@/ui';

type Msg = { id: string; me: boolean; text: string };
const MSGS: Msg[] = [
  { id: '1', me: false, text: 'Tu as vu le nouveau proto ?' },
  { id: '2', me: true, text: 'Oui, la poussière est folle' },
  { id: '3', me: false, text: 'Montre-moi sur ton téléphone demain' },
  { id: '4', me: true, text: 'Je t’envoie la vidéo ce soir' },
  { id: '5', me: true, text: 'Oups, mauvais message, je supprime' },
  { id: '6', me: false, text: 'Trop tard, j’ai vu 👀' },
];

function Bubble({ msg, onRemove }: { msg: Msg; onRemove: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Animated.View layout={layout} entering={FadeIn.duration(300)} style={{ alignItems: msg.me ? 'flex-end' : 'flex-start' }}>
      <Pressable
        delayLongPress={250}
        disabled={dissolving}
        onLongPress={async () => { await dissolve({ preset: 'ember', duration: 1300 }); onRemove(); }}
      >
        {({ pressed }) => (
          <View
            ref={ref}
            collapsable={false}
            style={[st.bubble, msg.me ? st.me : st.them, { opacity: dissolving ? 0 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <Text style={[st.text, msg.me && { color: 'white' }]}>{msg.text}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function Chat() {
  const [msgs, setMsgs] = useState(MSGS);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 6 }}>
      {msgs.map((m) => (
        <Bubble key={m.id} msg={m} onRemove={() => setMsgs((l) => l.filter((x) => x.id !== m.id))} />
      ))}
      <Caption>long press a message · preset ember</Caption>
      <View style={{ height: 12 }} />
      <Button label="Reset" onPress={() => setMsgs(MSGS)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  bubble: { maxWidth: 280, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  me: { backgroundColor: '#0A84FF' },
  them: { backgroundColor: '#E9E9EB' },
  text: { fontSize: 16, color: '#111', lineHeight: 21 },
});
