import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DEFAULT_GRAIN, PRESET_INFO, PRESETS, useDissolve, type Preset } from '@/dissolve';
import { Button, C, Caption, Chip, Code, Section, Stage } from '@/ui';

const GRAINS = [2, 3, 5, 8];
const DURATIONS = [800, 1500, 2500];

export default function Playground() {
  const [preset, setPreset] = useState<Preset>('dust');
  const [grain, setGrain] = useState<number | null>(null);
  const [duration, setDuration] = useState(1500);
  const [k, setK] = useState(0);
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const g = grain ?? DEFAULT_GRAIN[preset];

  const play = async () => {
    if (dissolving) return;
    await dissolve({ preset, grain: g, duration });
    setTimeout(() => { reset(); setK((n) => n + 1); }, duration * 0.6);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stage style={{ height: 210, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={play}>
          <Animated.View key={k} entering={k ? FadeIn.duration(400) : undefined} style={{ width: 240 }}>
            <View ref={ref} collapsable={false} style={[st.card, { opacity: dissolving ? 0 : 1 }]}>
              <View style={st.art} />
              <View>
                <Text style={st.title}>Summer trip</Text>
                <Text style={st.sub}>48 photos · Lisbon</Text>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Stage>
      <Caption>tap the card or press play</Caption>

      <Section title="Preset" note={PRESET_INFO[preset]}>
        <View style={st.chips}>
          {PRESETS.map((p) => <Chip key={p} label={p} active={p === preset} onPress={() => { setPreset(p); setGrain(null); }} />)}
        </View>
      </Section>
      <Section title="Grain">
        <View style={st.chips}>
          {GRAINS.map((v) => <Chip key={v} label={`${v} pt`} active={v === g} onPress={() => setGrain(v)} />)}
        </View>
      </Section>
      <Section title="Duration">
        <View style={st.chips}>
          {DURATIONS.map((v) => <Chip key={v} label={`${v / 1000}s`} active={v === duration} onPress={() => setDuration(v)} />)}
        </View>
      </Section>
      <Section title="Code">
        <Code title="dissolve()">{`await dissolve({\n  preset: '${preset}',\n  grain: ${g},\n  duration: ${duration},\n})`}</Code>
      </Section>
      <View style={{ height: 24 }} />
      <Button label="Play" onPress={play} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: 240, padding: 12, borderRadius: 20, backgroundColor: 'white', flexDirection: 'row', gap: 12, alignItems: 'center' },
  art: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#E4572E', borderWidth: 10, borderColor: '#F4B860' },
  title: { fontSize: 16, fontWeight: '600', color: C.ink },
  sub: { fontSize: 13, color: C.text, marginTop: 2 },
});
