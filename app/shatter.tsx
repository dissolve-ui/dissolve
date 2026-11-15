import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve } from '@/dissolve';
import { Button, C, Caption, Code, Section, Stage, mono } from '@/ui';

export default function Shatter() {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [gone, setGone] = useState(false);
  const [k, setK] = useState(0);

  /** Break the card at the touch point (window coords minus the card rect). */
  const smash = async (e?: GestureResponderEvent) => {
    if (dissolving) return;
    let origin: { x: number; y: number } | undefined;
    const v = ref.current;
    if (e && v) {
      const { pageX, pageY } = e.nativeEvent;
      origin = await new Promise((res) => v.measureInWindow((x, y) => res({ x: pageX - x, y: pageY - y })));
    }
    await dissolve({ preset: 'shatter', origin, duration: 1300 });
    setGone(true);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stage style={{ minHeight: 470, justifyContent: 'center' }}>
        {gone ? (
          <Text style={st.gone}>paywall dismissed</Text>
        ) : (
          <Animated.View key={k} entering={k ? FadeIn.duration(400) : undefined}>
            <Pressable onPress={smash}>
              <View ref={ref} collapsable={false} style={[st.paywall, { opacity: dissolving ? 0 : 1 }]}>
                <Text style={st.kicker}>PRO</Text>
                <Text style={st.h1}>Unlock everything</Text>
                <Text style={st.p}>Unlimited projects, cloud sync and every preset.</Text>
                {['Unlimited projects', 'Sync across devices', 'All 15 effects'].map((f) => (
                  <View key={f} style={st.feature}>
                    <View style={st.check} />
                    <Text style={st.featureText}>{f}</Text>
                  </View>
                ))}
                <View style={st.cta}>
                  <Text style={st.ctaText}>Start free trial</Text>
                </View>
                <Text style={st.notNow}>Not now</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
      </Stage>
      <Caption>tap anywhere on the card · it breaks where you hit</Caption>
      <View style={{ height: 14 }} />
      <Button
        label="Reset"
        onPress={() => {
          reset();
          setGone(false);
          setK((n) => n + 1);
        }}
      />
      <Section title="Code">
        <Code title="shatter">{`await dissolve({\n  preset: 'shatter',\n  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },\n  n: [220], // shard count\n})`}</Code>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  gone: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center' },
  paywall: { backgroundColor: C.dark, borderRadius: 26, padding: 22, gap: 10 },
  kicker: { fontFamily: mono, fontSize: 11, color: '#F4B860', letterSpacing: 1 },
  h1: { fontSize: 26, fontWeight: '700', color: 'white' },
  p: { fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.65)', marginBottom: 6 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#34C759' },
  featureText: { fontSize: 15, color: 'white' },
  cta: { marginTop: 14, backgroundColor: 'white', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '600', color: C.dark },
  notNow: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 4 },
});
