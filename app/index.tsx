import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PRESETS, useDissolve, type Preset } from '@/dissolve';
import { C, Caption, Code, Section, Stage, mono, s } from '@/ui';

const EXAMPLES = [
  { href: '/micro', title: 'Micro-interactions', note: 'OTP, ticker, reactions, voice, cards, receipt, signature, before/after.' },
  { href: '/components', title: 'Components', note: 'Swipe to delete, toasts, like button.' },
  { href: '/notifications', title: 'Notifications', note: 'Tap to clear. The default dust preset.' },
  { href: '/chat', title: 'Chat', note: 'Long press a message to unsend it.' },
  { href: '/photos', title: 'Photos', note: 'Delete from a grid with the pixel preset.' },
  { href: '/tasks', title: 'Tasks', note: 'Complete a task and it pours away as sand.' },
  { href: '/playground', title: 'Playground', note: 'All 15 variants with live options and code.' },
  { href: '/gallery', title: 'Gallery', note: 'Bento cards, an email, image messages.' },
  { href: '/glass', title: 'Liquid glass', note: 'An iOS lock screen in real liquid glass.' },
  { href: '/stream', title: 'Stream', note: 'Mails fly into the trash, bubbles pour out of send.' },
  { href: '/appear', title: 'Entrances', note: 'Rows assemble on insert: gather, rain, print.' },
  { href: '/fling', title: 'Fling and snap', note: 'Swipe cards away, tap tiles to burst them.' },
  { href: '/gestures', title: 'Scrub and hold', note: 'Finger driven and reversible, hold to destroy.' },
  { href: '/cascade', title: 'Cascade', note: 'Clear a whole list, dissolve a screen on back.' },
  { href: '/shatter', title: 'Shatter', note: 'A paywall breaks like glass where you tap.' },
  { href: '/pile', title: 'Pile', note: 'Checked todos pile up as sand on the floor.' },
  { href: '/morph', title: 'Morph', note: 'Follow becomes Following, grain by grain.' },
] as const;

const SWATCH: Record<Preset, string> = {
  dust: '#8B5E3C',
  sand: '#D4A256',
  ember: '#E4572E',
  pixel: '#3D7BFF',
  vortex: '#7B4DFF',
};

function HeroCard() {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  return (
    <Pressable
      disabled={dissolving}
      onPress={async () => {
        await dissolve();
        setTimeout(() => {
          reset();
          setK((n) => n + 1);
        }, 1100);
      }}
    >
      <Animated.View key={k} entering={k ? FadeIn.duration(500) : undefined}>
        <View ref={ref} collapsable={false} style={[st.card, { opacity: dissolving ? 0 : 1 }]}>
          <View style={[st.icon, { backgroundColor: '#34C759' }]}>
            <Text style={st.iconText}>M</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.app}>MESSAGES · now</Text>
            <Text style={st.title}>Lina</Text>
            <Text style={st.body} numberOfLines={1}>On se retrouve à 19h devant le ciné ?</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function PresetRow({ preset }: { preset: Preset }) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  return (
    <View style={st.presetRow}>
      <Text style={st.presetName}>{preset}</Text>
      <Pressable
        style={{ flex: 1 }}
        disabled={dissolving}
        onPress={async () => {
          await dissolve({ preset });
          setTimeout(() => {
            reset();
            setK((n) => n + 1);
          }, 1000);
        }}
      >
        <Animated.View key={k} entering={k ? FadeIn.duration(450) : undefined}>
          <View ref={ref} collapsable={false} style={[st.bar, { backgroundColor: SWATCH[preset], opacity: dissolving ? 0 : 1 }]}>
            <Text style={st.barText}>tap</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function Home() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stage>
        <HeroCard />
      </Stage>
      <Caption>tap the card</Caption>

      <Section
        title="dissolve"
        note="Turn any React Native view into dust when it leaves. A snapshot of the view is split into thousands of grains and animated on the UI thread with Skia."
      />

      <Section title="Installation">
        <Code>{'$ npx expo install react-native-dissolve \\\n    @shopify/react-native-skia'}</Code>
      </Section>

      <Section title="Quick start">
        <Code title="Card.tsx">
          {`const { ref, dissolving, dissolve } = useDissolve()

<View ref={ref} style={{ opacity: dissolving ? 0 : 1 }} />

await dissolve({ preset: 'sand' })
removeItem()`}
        </Code>
      </Section>

      <Section title="Presets" note="The five classic presets. Tap a bar to preview it. Ten more variants live in the examples below.">
        <View style={{ marginTop: 4 }}>
          {PRESETS.map((p) => (
            <PresetRow key={p} preset={p} />
          ))}
        </View>
      </Section>

      <Section title="Examples">
        <View style={{ marginTop: 2 }}>
          {EXAMPLES.map((e, i) => (
            <Link key={e.href} href={e.href} asChild>
              <Pressable style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surface }]}>
                <Text style={st.rowIndex}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.rowTitle}>{e.title}</Text>
                  <Text style={st.rowNote}>{e.note}</Text>
                </View>
                <Text style={st.chevron}>›</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </Section>

      <Text style={st.footer}>v0.0.1 · MIT licensed</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'white' },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: 'white', fontSize: 17, fontWeight: '700' },
  app: { fontSize: 11, fontWeight: '600', color: C.muted, letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 1 },
  body: { fontSize: 14, color: C.text },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  presetName: { width: 62, fontSize: 14, color: C.ink },
  bar: { height: 26, borderRadius: 999, justifyContent: 'center', paddingHorizontal: 12 },
  barText: { fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowIndex: { fontFamily: mono, fontSize: 11, color: C.muted },
  rowTitle: { fontSize: 16, fontWeight: '500', color: C.ink },
  rowNote: { fontSize: 13, color: C.text, marginTop: 2 },
  chevron: { fontSize: 22, color: C.muted },
  footer: { ...s.caption, marginTop: 36 },
});
