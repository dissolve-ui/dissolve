import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useAppear, useDissolve } from '@/dissolve';
import { Button, C, Caption, Code, Section, Stage, layout, mono } from '@/ui';

const MAILS = [
  { id: 'a', from: 'Léa, studio', subject: 'Léa wrote to you', body: 'The direction is up in your project.', img: require('../assets/paintings/pond.jpg'), tag: 'NEW MESSAGE', dot: '#E4572E' },
  { id: 'b', from: 'Hannera', subject: 'Your order is paid', body: 'Brief received, we start Monday.', img: require('../assets/paintings/tuscany.jpg'), tag: 'PAID', dot: '#34C759' },
  { id: 'c', from: 'Maya, design', subject: 'Ready for review', body: 'Three screens and the hero are in.', img: require('../assets/paintings/lake.jpg'), tag: 'IN REVIEW', dot: '#3D7BFF' },
  { id: 'd', from: 'Hannera', subject: 'Delivered', body: 'Figma file and pull request attached.', img: require('../assets/paintings/valley.jpg'), tag: 'DELIVERED', dot: '#8B5E3C' },
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
          <Image source={mail.img} style={st.thumb} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <View style={st.tagRow}>
              <View style={[st.dot, { backgroundColor: mail.dot }]} />
              <Text style={st.tag}>{mail.tag}</Text>
            </View>
            <Text style={st.from} numberOfLines={1}>{mail.subject}</Text>
            <Text style={st.subject} numberOfLines={1}>
              {mail.from} · {mail.body}
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

/** "+1" rises out of the bin and fades. */
const PlusOne = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
      transform: [{ translateY: withTiming(-30, { duration: 900, easing: Easing.bezier(0.32, 0.72, 0, 1) }) }],
    },
  };
};

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
          <View>
            <Animated.View ref={trash} collapsable={false} style={[st.trash, bumpStyle]}>
              <SymbolView name={count ? 'trash.fill' : 'trash'} size={20} tintColor={C.ink} weight="medium" />
            </Animated.View>
            {count ? (
              <Animated.View key={`b${count}`} entering={ZoomIn.duration(220)} style={st.badge}>
                <Text style={st.badgeText}>{count}</Text>
              </Animated.View>
            ) : null}
            {count ? (
              <Animated.Text key={`p${count}`} entering={PlusOne} exiting={FadeOut.duration(1)} style={st.plus}>
                +1
              </Animated.Text>
            ) : null}
          </View>
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
  trash: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E4572E', borderWidth: 2, borderColor: C.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  plus: { position: 'absolute', top: -18, alignSelf: 'center', fontFamily: mono, fontSize: 12, fontWeight: '600', color: '#E4572E' },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tag: { fontFamily: mono, fontSize: 10, color: C.text, letterSpacing: 0.4 },
  badgeText: { fontFamily: mono, fontSize: 10, color: 'white' },
  mail: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: 18, backgroundColor: 'white' },
  from: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 3 },
  subject: { fontSize: 13, color: C.text, marginTop: 1 },
  bubble: { backgroundColor: '#3D7BFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxWidth: 240 },
  bubbleText: { color: 'white', fontSize: 15 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: 'white', borderRadius: 999, paddingLeft: 16, padding: 5 },
  placeholder: { flex: 1, fontSize: 15, color: C.muted },
  send: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3D7BFF', alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: 'white', fontSize: 17, fontWeight: '700' },
});
