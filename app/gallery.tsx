import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve, type VariantName } from '@/dissolve';
import { C, Caption, Section, mono } from '@/ui';

const P = {
  aqueduct: require('../assets/paintings/aqueduct.jpg'),
  lake: require('../assets/paintings/lake.jpg'),
  pines: require('../assets/paintings/pines.jpg'),
  tuscany: require('../assets/paintings/tuscany.jpg'),
  pond: require('../assets/paintings/pond.jpg'),
  temple: require('../assets/paintings/temple.jpg'),
};

/** Dissolves on tap (from the finger for snap and shatter), then comes back. */
function useComeBack(preset: VariantName, duration = 1500) {
  const d = useDissolve();
  const [k, setK] = useState(0);
  const run = async (e?: GestureResponderEvent) => {
    if (d.dissolving) return;
    const touch = preset === 'snap' || preset === 'shatter';
    const origin = touch && e ? { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY } : undefined;
    await d.dissolve({ preset, duration, origin });
    setTimeout(() => {
      d.reset();
      setK((n) => n + 1);
    }, duration * 0.7);
  };
  return { ...d, k, run };
}

function Tag({ label, light }: { label: string; light?: boolean }) {
  return (
    <View style={[st.tag, light && { backgroundColor: C.surface }]}>
      <Text style={[st.tagText, light && { color: C.text }]}>{label}</Text>
    </View>
  );
}

function Bento({ img, icon, title, body, preset, style }: { img: number; icon: SFSymbol; title: string; body: string; preset: VariantName; style?: object }) {
  const { ref, dissolving, k, run } = useComeBack(preset);
  return (
    <Pressable onPress={run} style={style}>
      <Animated.View key={k} entering={k ? FadeIn.duration(600) : undefined} style={{ flex: 1 }}>
        <View ref={ref} collapsable={false} style={[st.bento, { opacity: dissolving ? 0 : 1 }]}>
          <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(28,28,28,0)', 'rgba(28,28,28,0.92)', '#1C1C1C']} locations={[0.25, 0.62, 1]} style={StyleSheet.absoluteFill} />
          <View style={st.bentoTop}>
            <SymbolView name={icon} size={26} tintColor="white" weight="light" />
            <Tag label={preset} />
          </View>
          <View style={{ flex: 1 }} />
          <Text style={st.bentoTitle}>{title}</Text>
          <Text style={st.bentoBody}>{body}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function EmailCard() {
  const { ref, dissolving, k, run } = useComeBack('pixel', 1300);
  return (
    <Animated.View key={k} entering={k ? FadeIn.duration(600) : undefined}>
      <View ref={ref} collapsable={false} style={[st.email, { opacity: dissolving ? 0 : 1 }]}>
        <Image source={P.pond} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={st.emailInner}>
          <View style={st.emailTagRow}>
            <View style={st.emailDot} />
            <Text style={st.emailTag}>NEW MESSAGE</Text>
            <View style={{ flex: 1 }} />
            <Tag label="pixel" light />
          </View>
          <Text style={st.emailTitle}>Léa wrote to you.</Text>
          <Text style={st.emailBody}>A message from the studio about Fieldbook landing. Reply in your space, the whole thread is there.</Text>
          <Pressable onPress={() => run()} style={({ pressed }) => [st.reply, pressed && { opacity: 0.8 }]}>
            <Text style={st.replyText}>Archive</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function ImageMessage() {
  const { ref, dissolving, k, run } = useComeBack('ember', 1400);
  return (
    <Animated.View key={k} entering={k ? FadeIn.duration(600) : undefined} style={{ alignSelf: 'flex-end' }}>
      <Pressable onLongPress={() => run()} delayLongPress={250}>
        <View ref={ref} collapsable={false} style={[st.msg, { opacity: dissolving ? 0 : 1 }]}>
          <Image source={P.temple} style={st.msgImg} contentFit="cover" />
          <Text style={st.msgText}>Found the ref for the hero, what do you think?</Text>
          <Text style={st.msgMeta}>18:42 · Read</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Quote() {
  const { ref, dissolving, k, run } = useComeBack('vortex', 1500);
  return (
    <Animated.View key={k} entering={k ? FadeIn.duration(600) : undefined} style={{ alignSelf: 'flex-start' }}>
      <Pressable onLongPress={() => run()} delayLongPress={250}>
        <View ref={ref} collapsable={false} style={[st.quote, { opacity: dissolving ? 0 : 1 }]}>
          <View style={st.quoteHead}>
            <View style={st.avatar}><Text style={st.avatarText}>M</Text></View>
            <Text style={st.quoteName}>Maya</Text>
            <Tag label="vortex" light />
          </View>
          <Text style={st.quoteText}>Love it. Can we keep the paper ground and drop the gradient?</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Gallery() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={st.grid}>
        <Bento style={{ flex: 1.1, height: 330 }} img={P.aqueduct} icon="checkmark.shield" title="Full rights" body="The design, the copy and every file are yours." preset="shatter" />
        <View style={{ flex: 1, gap: 8 }}>
          <Bento style={{ flex: 1 }} img={P.lake} icon="trophy" title="On time" body="Or your money back." preset="snap" />
          <Bento style={{ flex: 1 }} img={P.pines} icon="arrow.uturn.backward" title="Full refund" body="Change your mind anytime." preset="sand" />
        </View>
      </View>
      <Bento style={{ height: 190, marginTop: 8 }} img={P.tuscany} icon="lock.open" title="Source files" body="The Figma file, or the pull request with the code." preset="dust" />
      <Caption>tap a card · snap and shatter start where you touch</Caption>

      <Section title="Email">
        <EmailCard />
      </Section>
      <Caption>tap archive</Caption>

      <Section title="Messages">
        <View style={st.thread}>
          <Quote />
          <ImageMessage />
        </View>
      </Section>
      <Caption>long press a message</Caption>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 8 },
  bento: { flex: 1, borderRadius: 22, overflow: 'hidden', padding: 16, backgroundColor: '#1C1C1C' },
  bentoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bentoTitle: { color: 'white', fontSize: 22, fontWeight: '500', letterSpacing: -0.4 },
  bentoBody: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 18, marginTop: 4 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.18)' },
  tagText: { fontFamily: mono, fontSize: 10, color: 'white' },
  email: { borderRadius: 18, overflow: 'hidden', padding: 18, paddingVertical: 34 },
  emailInner: { backgroundColor: 'white', borderRadius: 14, padding: 18 },
  emailTagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  emailDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E4572E' },
  emailTag: { fontFamily: mono, fontSize: 11, color: C.ink, letterSpacing: 0.6 },
  emailTitle: { fontSize: 24, fontWeight: '600', color: C.ink, letterSpacing: -0.5, marginTop: 12 },
  emailBody: { fontSize: 14, lineHeight: 20, color: C.text, marginTop: 6 },
  reply: { alignSelf: 'flex-start', backgroundColor: C.dark, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  replyText: { color: 'white', fontSize: 14, fontWeight: '600' },
  thread: { gap: 8, backgroundColor: C.surface, borderRadius: 20, padding: 12 },
  msg: { width: 250, backgroundColor: '#3D7BFF', borderRadius: 20, padding: 5 },
  msgImg: { width: '100%', height: 150, borderRadius: 16 },
  msgText: { color: 'white', fontSize: 15, lineHeight: 20, paddingHorizontal: 9, paddingTop: 8 },
  msgMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, paddingHorizontal: 9, paddingVertical: 6, alignSelf: 'flex-end' },
  quote: { width: 260, backgroundColor: 'white', borderRadius: 18, padding: 12 },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F4B860', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: 'white' },
  quoteName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.ink },
  quoteText: { fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 8 },
});
