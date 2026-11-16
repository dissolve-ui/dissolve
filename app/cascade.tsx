import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve, type VariantName } from '@/dissolve';
import { Button, C, Caption, Chip, Code, Section, Stage, mono } from '@/ui';

const NOTES = [
  { app: 'Calendar', text: 'Standup in 10 minutes', color: '#E4572E' },
  { app: 'Messages', text: 'Lina: on arrive !', color: '#34C759' },
  { app: 'Mail', text: 'Invoice #2041 from Figma', color: '#3D7BFF' },
  { app: 'Photos', text: 'A new memory: Lisbon 2025', color: '#F4B860' },
  { app: 'Bank', text: 'Card payment of 12,40 €', color: '#7B4DFF' },
  { app: 'Weather', text: 'Rain starting around 17:00', color: '#5AC8FA' },
];

const PRESETS: VariantName[] = ['dust', 'sand', 'ember', 'pixel'];

export default function Cascade() {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [preset, setPreset] = useState<VariantName>('dust');
  const [cleared, setCleared] = useState(false);
  const [k, setK] = useState(0);
  const rows = useRef<number[]>([]);

  const clear = async () => {
    if (dissolving || cleared) return;
    await dissolve({ preset, field: 'cascade', rows: rows.current, duration: 1800, haptics: true });
    setCleared(true);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Section title="Clear all" note="One snapshot of the whole list. Rows leave one after the other and each one sweeps left to right.">
        <Stage style={{ minHeight: 440 }}>
          <View style={st.head}>
            <Text style={st.headTitle}>Notification Center</Text>
            <Pressable onPress={clear} hitSlop={8}>
              <Text style={st.clear}>Clear all</Text>
            </Pressable>
          </View>
          {cleared ? (
            <Text style={st.empty}>no notifications</Text>
          ) : (
            <Animated.View key={k} entering={k ? FadeIn.duration(400) : undefined}>
              <View ref={ref} collapsable={false} style={{ gap: 8, opacity: dissolving ? 0 : 1 }}>
                {NOTES.map((n, i) => (
                  <View
                    key={n.app}
                    style={st.note}
                    onLayout={(e) => {
                      rows.current[i] = e.nativeEvent.layout.y;
                    }}
                  >
                    <View style={[st.icon, { backgroundColor: n.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.app}>{n.app.toUpperCase()}</Text>
                      <Text style={st.text}>{n.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </Stage>
        <View style={st.chips}>
          {PRESETS.map((p) => (
            <Chip key={p} label={p} active={p === preset} onPress={() => setPreset(p)} />
          ))}
        </View>
        <Button
          label="Reset"
          onPress={() => {
            reset();
            setCleared(false);
            setK((n) => n + 1);
          }}
        />
        <Code title="cascade">{`<View ref={ref}>\n  {rows.map((r, i) => <Row onLayout={(e) => (ys[i] = e.nativeEvent.layout.y)} />)}\n</View>\n\nawait dissolve({ preset: '${preset}', field: 'cascade', rows: ys })`}</Code>
      </Section>

      <Section title="Full screen" note="The whole screen turns to sand when you go back, and the previous screen shows through.">
        <Link href="/screen" asChild>
          <Pressable style={({ pressed }) => [st.open, pressed && { opacity: 0.7 }]}>
            <Text style={st.openText}>Open the screen</Text>
            <Text style={st.chev}>›</Text>
          </Pressable>
        </Link>
        <Caption>then tap Back</Caption>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  clear: { fontSize: 13, fontWeight: '600', color: C.ink, backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  empty: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 160 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.bg },
  icon: { width: 32, height: 32, borderRadius: 9 },
  app: { fontSize: 10, fontWeight: '600', color: C.muted, letterSpacing: 0.3 },
  text: { fontSize: 14, color: C.ink, marginTop: 1 },
  open: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  openText: { flex: 1, fontSize: 15, fontWeight: '500', color: C.ink },
  chev: { fontSize: 22, color: C.muted },
});
