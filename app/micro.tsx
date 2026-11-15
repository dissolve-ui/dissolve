import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { DEMOS } from '@/demos';
import { C, mono } from '@/ui';

export default function Micro() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={st.lead}>Eight mobile micro-interactions, each on its own screen.</Text>
      {DEMOS.map((d, i) => (
        <Link key={d.slug} href={`/demo/${d.slug}`} asChild>
          <Pressable style={st.row}>
            <Text style={st.index}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{d.title}</Text>
              <Text style={st.note}>{d.note}</Text>
            </View>
            <Text style={st.chev}>›</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: C.text, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  index: { fontFamily: mono, fontSize: 11, color: C.muted },
  title: { fontSize: 16, fontWeight: '500', color: C.ink },
  note: { fontSize: 13, color: C.text, marginTop: 2 },
  chev: { fontSize: 22, color: C.muted },
});
