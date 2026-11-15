import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve, type VariantName } from '@/dissolve';
import { C, mono } from '@/ui';

const P = {
  aqueduct: require('../assets/paintings/aqueduct.jpg'),
  arch: require('../assets/paintings/arch.jpg'),
  cypress: require('../assets/paintings/cypress.jpg'),
  lake: require('../assets/paintings/lake.jpg'),
  pines: require('../assets/paintings/pines.jpg'),
  pond: require('../assets/paintings/pond.jpg'),
  temple: require('../assets/paintings/temple.jpg'),
  tuscany: require('../assets/paintings/tuscany.jpg'),
  valley: require('../assets/paintings/valley.jpg'),
};

const TOUCH: VariantName[] = ['snap', 'shatter'];

/**
 * Wraps any view: tap (or long press) dissolves it with `preset`, then it fades back so the
 * demo can be replayed. snap and shatter start where the finger is.
 */
function Dissolvable({ preset, duration = 1500, longPress, fill, style, children }: { preset: VariantName; duration?: number; longPress?: boolean; fill?: boolean; style?: object; children: ReactNode }) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  const run = async (e: GestureResponderEvent) => {
    if (dissolving) return;
    const origin = TOUCH.includes(preset) ? { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY } : undefined;
    await dissolve({ preset, duration, origin });
    setTimeout(() => {
      reset();
      setK((n) => n + 1);
    }, duration * 0.8);
  };
  return (
    <Pressable onPress={longPress ? undefined : run} onLongPress={longPress ? run : undefined} delayLongPress={220} style={style}>
      <Animated.View key={k} entering={k ? FadeIn.duration(700) : undefined} style={fill ? { flex: 1 } : undefined}>
        <View ref={ref} collapsable={false} style={[fill && { flex: 1 }, { opacity: dissolving ? 0 : 1 }]}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function Header({ index, title, note }: { index: string; title: string; note: string }) {
  return (
    <View style={st.header}>
      <Text style={st.index}>{index}</Text>
      <Text style={st.h2}>{title}</Text>
      <Text style={st.note}>{note}</Text>
    </View>
  );
}

function Preset({ name, dark }: { name: string; dark?: boolean }) {
  return <Text style={[st.preset, dark ? st.presetDark : st.presetLight]}>{name}</Text>;
}

/* ---------- Bento ---------- */

function Bento({ img, icon, title, body, preset, height }: { img: number; icon: SFSymbol; title: string; body: string; preset: VariantName; height: number }) {
  return (
    <Dissolvable preset={preset} fill style={{ height }}>
      <View style={st.bento}>
        <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(28,28,28,0)', 'rgba(28,28,28,0.9)', '#1C1C1C']} locations={[0.3, 0.64, 1]} style={StyleSheet.absoluteFill} />
        <View style={st.bentoTop}>
          <SymbolView name={icon} size={28} tintColor="white" weight="light" />
          <Preset name={preset} dark />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={st.bentoTitle}>{title}</Text>
        <Text style={st.bentoBody}>{body}</Text>
      </View>
    </Dissolvable>
  );
}

/* ---------- Inbox ---------- */

type Mail = { tag: string; dot: string; title: string; body: string; cta: string; img: number; preset: VariantName };

const MAILS: Mail[] = [
  { tag: 'NEW MESSAGE', dot: '#E4572E', title: 'Léa wrote to you.', body: 'A message from the studio about Fieldbook landing. The whole thread is in your space.', cta: 'Archive', img: P.pond, preset: 'pixel' },
  { tag: 'PAID', dot: '#34C759', title: 'Your order is paid.', body: 'We received 1 240 €. The brief is locked, kickoff is on Monday.', cta: 'Archive', img: P.tuscany, preset: 'sand' },
  { tag: 'IN REVIEW', dot: '#3D7BFF', title: 'Ready for review.', body: 'Three screens and the hero are in. Leave comments right on the frames.', cta: 'Archive', img: P.lake, preset: 'vortex' },
  { tag: 'DELIVERED', dot: '#8B5E3C', title: 'It is yours.', body: 'The Figma file and the pull request are attached. Thank you for trusting us.', cta: 'Archive', img: P.valley, preset: 'ember' },
];

function MailCard({ mail, width }: { mail: Mail; width: number }) {
  return (
    <Dissolvable preset={mail.preset} duration={1400} style={{ width }}>
      <View style={st.mail}>
        <Image source={mail.img} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={st.mailInner}>
          <View style={st.mailTagRow}>
            <View style={[st.mailDot, { backgroundColor: mail.dot }]} />
            <Text style={st.mailTag}>{mail.tag}</Text>
            <View style={{ flex: 1 }} />
            <Preset name={mail.preset} />
          </View>
          <Text style={st.mailTitle}>{mail.title}</Text>
          <Text style={st.mailBody} numberOfLines={3}>{mail.body}</Text>
          <View style={st.mailCta}>
            <Text style={st.mailCtaText}>{mail.cta}</Text>
          </View>
        </View>
      </View>
    </Dissolvable>
  );
}

/* ---------- Thread ---------- */

function Them({ children, preset }: { children: ReactNode; preset: VariantName }) {
  return (
    <Dissolvable preset={preset} longPress style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
      {children}
    </Dissolvable>
  );
}

function Me({ children, preset }: { children: ReactNode; preset: VariantName }) {
  return (
    <Dissolvable preset={preset} longPress style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
      {children}
    </Dissolvable>
  );
}

export default function Gallery() {
  const { width } = useWindowDimensions();
  const inner = width - 32;
  const col = (inner - 10) / 2;
  const mailW = width - 56;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 64 }}>
      <View style={st.pad}>
        <Header index="01" title="Bento" note="Tap a card. snap and shatter start where your finger lands." />
        <View style={st.row}>
          <View style={{ width: col }}>
            <Bento height={250} img={P.aqueduct} icon="checkmark.shield" title="Full rights" body="The design, the copy and every file are yours." preset="shatter" />
          </View>
          <View style={{ width: col }}>
            <Bento height={250} img={P.lake} icon="trophy" title="On time or refunded" body="Miss the date and you get your money back." preset="snap" />
          </View>
        </View>
        <View style={[st.row, { marginTop: 10 }]}>
          <View style={{ width: col }}>
            <Bento height={250} img={P.pines} icon="arrow.uturn.backward" title="Full refund" body="Change your mind before delivery." preset="sand" />
          </View>
          <View style={{ width: col }}>
            <Bento height={250} img={P.tuscany} icon="lock.open" title="Source files" body="The Figma file, or the pull request." preset="dust" />
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Bento height={200} img={P.valley} icon="sparkles" title="One studio, every screen" body="Brand, product and code, shipped by the same hands." preset="vortex" />
        </View>
      </View>

      <View style={st.pad}>
        <Header index="02" title="Inbox" note="Swipe through, tap a mail to archive it." />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={mailW + 10}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {MAILS.map((m) => (
          <MailCard key={m.tag} mail={m} width={mailW} />
        ))}
      </ScrollView>

      <View style={st.pad}>
        <Header index="03" title="Thread" note="Long press a message to unsend it." />
        <View style={st.thread}>
          <Them preset="vortex">
            <View style={st.them}>
              <Text style={st.themName}>Maya</Text>
              <Text style={st.themText}>Found two refs for the hero, which one?</Text>
            </View>
          </Them>
          <Them preset="pixel">
            <View style={st.album}>
              <Image source={P.temple} style={st.albumImg} contentFit="cover" />
              <Image source={P.arch} style={st.albumImg} contentFit="cover" />
            </View>
          </Them>
          <Me preset="ember">
            <View style={st.me}>
              <Text style={st.meText}>The temple, no question. Keep the warm light.</Text>
            </View>
          </Me>
          <Me preset="shatter">
            <View style={st.photoMsg}>
              <Image source={P.cypress} style={st.photoImg} contentFit="cover" />
              <Text style={[st.meText, { paddingHorizontal: 10 }]}>And this one for the about page</Text>
              <Text style={st.meta}>20:14 · Read</Text>
            </View>
          </Me>
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pad: { paddingHorizontal: 16 },
  header: { paddingTop: 30, paddingBottom: 14 },
  index: { fontFamily: mono, fontSize: 11, color: C.muted },
  h2: { fontSize: 22, fontWeight: '600', color: C.ink, letterSpacing: -0.4, marginTop: 4 },
  note: { fontSize: 14, color: C.text, marginTop: 3 },
  row: { flexDirection: 'row', gap: 10 },

  preset: { fontFamily: mono, fontSize: 10, overflow: 'hidden', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  presetDark: { color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.14)' },
  presetLight: { color: C.text, backgroundColor: C.surface },

  bento: { flex: 1, borderRadius: 22, overflow: 'hidden', padding: 16, backgroundColor: '#1C1C1C' },
  bentoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bentoTitle: { color: 'white', fontSize: 22, lineHeight: 26, fontWeight: '400', letterSpacing: -0.5 },
  bentoBody: { color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 18, marginTop: 6 },

  mail: { borderRadius: 22, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 30 },
  mailInner: { backgroundColor: 'white', borderRadius: 16, padding: 18 },
  mailTagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mailDot: { width: 7, height: 7, borderRadius: 4 },
  mailTag: { fontFamily: mono, fontSize: 11, color: C.ink, letterSpacing: 0.6 },
  mailTitle: { fontSize: 24, fontWeight: '600', color: C.ink, letterSpacing: -0.6, marginTop: 14 },
  mailBody: { fontSize: 14, lineHeight: 20, color: C.text, marginTop: 6, minHeight: 60 },
  mailCta: { alignSelf: 'flex-start', backgroundColor: C.dark, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  mailCtaText: { color: 'white', fontSize: 14, fontWeight: '600' },

  thread: { gap: 6, backgroundColor: C.surface, borderRadius: 22, padding: 12 },
  them: { backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  themName: { fontSize: 12, fontWeight: '600', color: '#E4572E', marginBottom: 2 },
  themText: { fontSize: 16, lineHeight: 21, color: C.ink },
  album: { flexDirection: 'row', gap: 3, borderRadius: 20, overflow: 'hidden' },
  albumImg: { width: 118, height: 150 },
  me: { backgroundColor: '#3D7BFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  meText: { fontSize: 16, lineHeight: 21, color: 'white' },
  photoMsg: { width: 240, backgroundColor: '#3D7BFF', borderRadius: 20, padding: 4, paddingBottom: 0 },
  photoImg: { width: '100%', height: 170, borderRadius: 17, marginBottom: 8 },
  meta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', alignSelf: 'flex-end', paddingHorizontal: 10, paddingBottom: 8, marginTop: 2 },
});
