import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DissolveIn, VARIANT_INFO } from '@/dissolve';
import { Button, C, Caption, Chip, Code, Section, Stage, layout, mono } from '@/ui';

const PRESETS = ['gather', 'rain', 'print'] as const;
type P = (typeof PRESETS)[number];

const ITEMS = [
  { title: 'Flight to Lisbon', meta: 'Fri 18:40 · TP 437', color: '#3D7BFF' },
  { title: 'Hotel Bairro Alto', meta: '3 nights · paid', color: '#E4572E' },
  { title: 'Dinner at Taberna', meta: 'Sat 20:30 · 4 people', color: '#D4A256' },
  { title: 'Tram 28 tickets', meta: '2 passes', color: '#34C759' },
  { title: 'Return flight', meta: 'Mon 09:15 · TP 438', color: '#7B4DFF' },
];

export default function Appear() {
  const [preset, setPreset] = useState<P>('gather');
  const [list, setList] = useState<{ id: number; i: number; preset: P }[]>([]);

  const add = () => setList((l) => [{ id: Date.now(), i: l.length % ITEMS.length, preset }, ...l].slice(0, 5));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stage style={{ gap: 8, minHeight: 360 }}>
        {list.length === 0 ? <Text style={st.empty}>empty trip, add something</Text> : null}
        {list.map((it) => {
          const item = ITEMS[it.i];
          return (
            <Animated.View key={it.id} layout={layout}>
              <DissolveIn preset={it.preset} duration={it.preset === 'print' ? 1100 : 1200} style={st.row}>
                <View style={[st.dot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.title}>{item.title}</Text>
                  <Text style={st.meta}>{item.meta}</Text>
                </View>
                <Text style={st.tag}>{it.preset}</Text>
              </DissolveIn>
            </Animated.View>
          );
        })}
      </Stage>
      <Caption>insert a row · it assembles in place</Caption>

      <Section title="Entrance" note={VARIANT_INFO[preset]}>
        <View style={st.chips}>
          {PRESETS.map((p) => (
            <Chip key={p} label={p} active={p === preset} onPress={() => setPreset(p)} />
          ))}
        </View>
      </Section>
      <View style={{ height: 20 }} />
      <View style={st.buttons}>
        <Button label="Add a row" onPress={add} />
        <Button label="Clear" onPress={() => setList([])} />
      </View>

      <Section title="Code">
        <Code title="DissolveIn">{`<DissolveIn preset="${preset}" style={styles.row}>\n  <Row />\n</DissolveIn>`}</Code>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  empty: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 150 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.bg },
  dot: { width: 34, height: 34, borderRadius: 10 },
  title: { fontSize: 15, fontWeight: '600', color: C.ink },
  meta: { fontSize: 13, color: C.text, marginTop: 1 },
  tag: { fontFamily: mono, fontSize: 10, color: C.muted },
});
