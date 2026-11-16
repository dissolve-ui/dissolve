import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useDissolveMorph } from '@/dissolve';
import { C, Caption, Code, Section, Stage } from '@/ui';

function FollowDemo() {
  const { refA, refB, styleA, styleB, phase, morphing, morph } = useDissolveMorph();
  const toggle = () => {
    if (morphing) return;
    morph({ duration: 1100, reverse: phase === 'b', haptics: true });
  };
  return (
    <Stage style={{ height: 150, alignItems: 'center', justifyContent: 'center' }}>
      <View style={st.profile}>
        <View style={st.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={st.name}>Rayan</Text>
          <Text style={st.handle}>@rselmi · 2 418 followers</Text>
        </View>
        <Pressable onPress={toggle} style={st.slot}>
          <View style={[st.abs, styleA]}>
            <View ref={refA} collapsable={false} style={st.follow}>
              <Text style={st.followText}>Follow</Text>
            </View>
          </View>
          <View style={[st.abs, styleB]}>
            <View ref={refB} collapsable={false} style={st.following}>
              <Text style={st.followingText}>Following</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </Stage>
  );
}

function PlayDemo() {
  const { refA, refB, styleA, styleB, phase, morphing, morph } = useDissolveMorph();
  const toggle = () => {
    if (morphing) return;
    morph({ duration: 1500, reverse: phase === 'b' });
  };
  return (
    <Stage style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable onPress={toggle} style={st.cardSlot}>
        <View style={[st.abs, styleA]}>
          <View ref={refA} collapsable={false} style={st.cardA}>
            <View style={st.cover} />
            <Text style={st.cardTitle}>Ready to download</Text>
            <Text style={st.cardSub}>Album · 12 tracks</Text>
          </View>
        </View>
        <View style={[st.abs, styleB]}>
          <View ref={refB} collapsable={false} style={st.cardB}>
            <Text style={st.big}>✓</Text>
            <Text style={[st.cardTitle, { color: 'white' }]}>Downloaded</Text>
            <Text style={[st.cardSub, { color: 'rgba(255,255,255,0.7)' }]}>Available offline</Text>
          </View>
        </View>
      </Pressable>
    </Stage>
  );
}

export default function Morph() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <FollowDemo />
      <Caption>tap the button · tap again to go back</Caption>
      <Section title="Card to card" note="Grains are paired by brightness, so dark goes to dark and light to light.">
        <PlayDemo />
        <Caption>tap the card</Caption>
      </Section>
      <Section title="Code">
        <Code title="useDissolveMorph">{`const { refA, refB, styleA, styleB, morph, phase } = useDissolveMorph()\n\n<View style={[abs, styleA]}><View ref={refA}>{follow}</View></View>\n<View style={[abs, styleB]}><View ref={refB}>{following}</View></View>\n\nawait morph({ reverse: phase === 'b' })`}</Code>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  abs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  profile: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.bg },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D4A256' },
  name: { fontSize: 16, fontWeight: '600', color: C.ink },
  handle: { fontSize: 13, color: C.text, marginTop: 1 },
  slot: { width: 104, height: 36 },
  follow: { width: 104, height: 36, borderRadius: 18, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  followText: { color: C.onDark, fontSize: 14, fontWeight: '600' },
  following: { width: 104, height: 36, borderRadius: 18, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  followingText: { color: C.ink, fontSize: 14, fontWeight: '600' },
  cardSlot: { width: 220, height: 190 },
  cardA: { width: 220, height: 190, borderRadius: 22, backgroundColor: C.bg, padding: 16 },
  cover: { flex: 1, borderRadius: 14, backgroundColor: '#7B4DFF', marginBottom: 10 },
  cardB: { width: 220, height: 190, borderRadius: 22, backgroundColor: '#34C759', padding: 16, justifyContent: 'flex-end' },
  big: { color: 'white', fontSize: 48, fontWeight: '700', flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  cardSub: { fontSize: 13, color: C.text, marginTop: 2 },
});
