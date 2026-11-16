import { ScrollView, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Pressable, Text, View } from '@registry/tw';
import { DEMOS } from '@/demos';
import { mono } from '@/ui';

export default function Micro() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text className="text-dissolve-muted" style={st.lead}>
        Seven mobile micro-interactions, each on its own screen.
      </Text>
      {DEMOS.map((d, i) => (
        <Link key={d.slug} href={`/demo/${d.slug}`} asChild>
          <Pressable className="border-dissolve-border active:opacity-60" style={st.row}>
            <Text className="text-dissolve-muted" style={st.index}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <View style={{ flex: 1 }}>
              <Text className="text-dissolve-foreground" style={st.title}>
                {d.title}
              </Text>
              <Text className="text-dissolve-muted" style={st.note}>
                {d.note}
              </Text>
            </View>
            <Text className="text-dissolve-muted" style={st.chev}>
              ›
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  index: { fontFamily: mono, fontSize: 11 },
  title: { fontSize: 16, fontWeight: '500' },
  note: { fontSize: 13, marginTop: 2 },
  chev: { fontSize: 22 },
});
