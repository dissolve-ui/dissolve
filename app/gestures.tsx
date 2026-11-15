import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useDissolveHold, useDissolvePeel, useDissolveScrub, type VariantName } from '@/dissolve';
import { Button, C, Caption, Chip, Code, Section, Stage, mono } from '@/ui';

const SCRUB_PRESETS: VariantName[] = ['dust', 'sand', 'ember', 'pixel'];

function ScrubCard({ preset, onDone }: { preset: VariantName; onDone: () => void }) {
  const { ref, gesture, style } = useDissolveScrub({ preset, axis: 'x', onCommit: onDone });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} collapsable={false} style={[st.card, style]}>
        <View style={[st.thumb, { backgroundColor: '#3D7BFF' }]} />
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Drag me sideways</Text>
          <Text style={st.sub}>Go back and the grains come back.</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function HoldCard({ onDone }: { onDone: () => void }) {
  const { ref, pressHandlers, style } = useDissolveHold({ holdMs: 1200, onCommit: onDone });
  return (
    <View style={{ gap: 10 }}>
      <Pressable {...pressHandlers}>
        <Animated.View ref={ref} collapsable={false} style={[st.card, style]}>
          <View style={[st.thumb, { backgroundColor: '#E4572E' }]} />
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Delete account</Text>
            <Text style={st.sub}>Hold to confirm. Let go to cancel.</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function PeelCard({ onDone }: { onDone: () => void }) {
  const { ref, gesture, style } = useDissolvePeel({ onCommit: onDone });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} collapsable={false} style={[st.sticker, style]}>
        <Image source={require('../assets/paintings/temple.jpg')} style={st.stickerImg} contentFit="cover" />
        <Text style={st.stickerText}>Temple, 1820</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export default function Gestures() {
  const [preset, setPreset] = useState<VariantName>('dust');
  const [scrubKey, setScrubKey] = useState(0);
  const [scrubGone, setScrubGone] = useState(false);
  const [holdKey, setHoldKey] = useState(0);
  const [holdGone, setHoldGone] = useState(false);
  const [peelKey, setPeelKey] = useState(0);
  const [peelGone, setPeelGone] = useState(false);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Section title="Scrub" note="The finger drives the timeline. Past the threshold, or with a quick flick, it commits. Otherwise it rewinds.">
        <Stage style={{ height: 130, justifyContent: 'center' }}>
          {scrubGone ? (
            <Text style={st.gone}>gone</Text>
          ) : (
            <Animated.View key={`${preset}-${scrubKey}`} entering={scrubKey ? FadeIn.duration(400) : undefined}>
              <ScrubCard preset={preset} onDone={() => setScrubGone(true)} />
            </Animated.View>
          )}
        </Stage>
        <View style={st.chips}>
          {SCRUB_PRESETS.map((p) => (
            <Chip key={p} label={p} active={p === preset} onPress={() => setPreset(p)} />
          ))}
        </View>
        <Button
          label="Reset"
          onPress={() => {
            setScrubGone(false);
            setScrubKey((n) => n + 1);
          }}
        />
        <Code title="useDissolveScrub">{`const { ref, gesture, style } = useDissolveScrub({\n  preset: '${preset}',\n  onCommit: remove,\n})\n\n<GestureDetector gesture={gesture}>\n  <Animated.View ref={ref} style={[styles.card, style]} />\n</GestureDetector>`}</Code>
      </Section>

      <Section title="Hold to destroy" note="It shakes, frays and heats up while you hold. At full charge it blows apart from your finger.">
        <Stage style={{ height: 150, justifyContent: 'center' }}>
          {holdGone ? (
            <Text style={st.gone}>gone</Text>
          ) : (
            <Animated.View key={holdKey} entering={holdKey ? FadeIn.duration(400) : undefined}>
              <HoldCard onDone={() => setHoldGone(true)} />
            </Animated.View>
          )}
        </Stage>
        <Caption>press and hold the card</Caption>
        <Button
          label="Reset"
          onPress={() => {
            setHoldGone(false);
            setHoldKey((n) => n + 1);
          }}
        />
        <Code title="useDissolveHold">{`const { ref, gesture, style, charge } = useDissolveHold({\n  holdMs: 1200,\n  onCommit: deleteAccount,\n})\n\n<Pressable {...pressHandlers}>\n  <Animated.View ref={ref} style={style} />\n</Pressable>`}</Code>
      </Section>

      <Section title="Peel" note="Grab the sticker near any corner or edge and pull. That point follows your finger and the paper folds under it. Let go early and it sticks back.">
        <Stage style={{ height: 260, justifyContent: 'center', alignItems: 'center' }}>
          {peelGone ? (
            <Text style={st.gone}>gone</Text>
          ) : (
            <Animated.View key={peelKey} entering={peelKey ? FadeIn.duration(400) : undefined}>
              <PeelCard onDone={() => setPeelGone(true)} />
            </Animated.View>
          )}
        </Stage>
        <Caption>grab near any corner or edge and pull</Caption>
        <Button
          label="Reset"
          onPress={() => {
            setPeelGone(false);
            setPeelKey((n) => n + 1);
          }}
        />
        <Code title="useDissolvePeel">{`const { ref, gesture, style } = useDissolvePeel({\n  onCommit: remove,\n})\n\n<GestureDetector gesture={gesture}>\n  <Animated.View ref={ref} style={[styles.sticker, style]} />\n</GestureDetector>`}</Code>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'white' },
  thumb: { width: 40, height: 40, borderRadius: 12 },
  title: { fontSize: 15, fontWeight: '600', color: C.ink },
  sub: { fontSize: 13, color: C.text, marginTop: 1 },
  gone: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden', marginHorizontal: 4 },
  fill: { height: 4, borderRadius: 2, backgroundColor: C.dark },
  sticker: { width: 180, padding: 8, borderRadius: 22, backgroundColor: 'white', gap: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  stickerImg: { width: 164, height: 164, borderRadius: 16 },
  stickerText: { fontSize: 13, fontWeight: '600', color: C.ink, textAlign: 'center', paddingBottom: 2 },
});
