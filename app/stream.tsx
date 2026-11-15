import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useAppear, useDissolve } from '@/dissolve';
import { Button, C, Caption, Code, Section, Stage, layout, mono } from '@/ui';

const MAILS = [
  { id: 'a', from: 'Figma', subject: 'Your weekly digest is ready' },
  { id: 'b', from: 'Linear', subject: '3 issues were assigned to you' },
  { id: 'c', from: 'Stripe', subject: 'Payout of 1 240 € is on its way' },
  { id: 'd', from: 'Vercel', subject: 'Deployment succeeded' },
];

const REPLIES = ['On part à quelle heure ?', 'Je ramène le gâteau', 'Parfait, à demain', 'Envoie la photo'];

function Mail({ mail, trash, onArrive, onRemove }: { mail: (typeof MAILS)[number]; trash: React.RefObject<View | null>; onArrive: () => void; onRemove: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Animated.View layout={layout}>
      <Pressable
        disabled={dissolving}
        onPress={async () => {
          await dissolve({ preset: 'stream', to: trash, duration: 1300, onArrive });
          onRemove();
        }}
      >
        <View ref={ref} collapsable={false} style={[st.mail, { opacity: dissolving ? 0 : 1 }]}>
          <View style={st.avatar}>
            <Text style={st.avatarText}>{mail.from[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.from}>{mail.from}</Text>
            <Text style={st.subject} numberOfLines={1}>
              {mail.subject}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** A new chat bubble that pours out of the send button and assembles in place. */
function Bubble({ text, from }: { text: string; from: React.RefObject<View | null> }) {
  const { ref, appear, wrapStyle } = useAppear();
  useEffect(() => {
    appear({ preset: 'stream', from, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View layout={layout} style={[{ alignSelf: 'flex-end' }, wrapStyle]}>
      <View ref={ref} collapsable={false} style={st.bubble}>
        <Text style={st.bubbleText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

export default function Stream() {
  const [mails, setMails] = useState(MAILS);
  const [count, setCount] = useState(0);
  const trash = useRef<View>(null);
  const bump = useSharedValue(1);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const send = useRef<View>(null);
  const [msgs, setMsgs] = useState<{ id: number; text: string }[]>([]);

  const arrive = () => {
    setCount((n) => n + 1);
    // Tiny element: a small overshoot is fine here.
    bump.value = withSequence(
      withTiming(1.25, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1) }),
    );
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stage style={{ gap: 8, minHeight: 330 }}>
        <View style={st.bar}>
          <Text style={st.barTitle}>Inbox</Text>
          <Animated.View ref={trash} collapsable={false} style={[st.trash, bumpStyle]}>
            <View style={st.lid} />
            <View style={st.can} />
            {count ? (
              <View style={st.badge}>
                <Text style={st.badgeText}>{count}</Text>
              </View>
            ) : null}
          </Animated.View>
        </View>
        {mails.map((m) => (
          <Mail key={m.id} mail={m} trash={trash} onArrive={arrive} onRemove={() => setMails((l) => l.filter((x) => x.id !== m.id))} />
        ))}
      </Stage>
      <Caption>tap a mail · it streams into the trash</Caption>
      <View style={{ height: 14 }} />
      <Button
        label="Reset"
        onPress={() => {
          setMails(MAILS);
          setCount(0);
        }}
      />

      <Section title="Out of the send button" note="The new bubble pours out of the button and assembles in place.">
        <Stage style={{ minHeight: 260, justifyContent: 'flex-end', gap: 6 }}>
          {msgs.map((m) => (
            <Bubble key={m.id} text={m.text} from={send} />
          ))}
          <View style={st.composer}>
            <Text style={st.placeholder}>Message</Text>
            <Pressable
              onPress={() => setMsgs((l) => [...l.slice(-3), { id: Date.now(), text: REPLIES[l.length % REPLIES.length] }])}
            >
              <View ref={send} collapsable={false} style={st.send}>
                <Text style={st.sendIcon}>↑</Text>
              </View>
            </Pressable>
          </View>
        </Stage>
      </Section>

      <Section title="Code">
        <Code title="stream">{`await dissolve({ preset: 'stream', to: trashRef, onArrive: bump })\n\n<DissolveIn preset="stream" from={sendRef}>\n  <Bubble />\n</DissolveIn>`}</Code>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 },
  barTitle: { fontSize: 20, fontWeight: '700', color: C.ink },
  trash: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  lid: { width: 16, height: 2, borderRadius: 1, backgroundColor: C.ink, marginBottom: 2 },
  can: { width: 12, height: 13, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 1.6, borderTopWidth: 0, borderColor: C.ink },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: mono, fontSize: 10, color: 'white' },
  mail: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: 'white' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '600', color: C.ink },
  from: { fontSize: 14, fontWeight: '600', color: C.ink },
  subject: { fontSize: 13, color: C.text, marginTop: 1 },
  bubble: { backgroundColor: '#3D7BFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxWidth: 240 },
  bubbleText: { color: 'white', fontSize: 15 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: 'white', borderRadius: 999, paddingLeft: 16, padding: 5 },
  placeholder: { flex: 1, fontSize: 15, color: C.muted },
  send: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3D7BFF', alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: 'white', fontSize: 17, fontWeight: '700' },
});
