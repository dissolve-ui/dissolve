import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDissolveScreen } from '@/dissolve';
import { C, Code, mono } from '@/ui';

/**
 * Full screen dissolve on back. The Stack options for this route use animation 'none',
 * no native header and no swipe back, so the only way out is the dissolve.
 */
export default function Screen() {
  const { ref, dissolveScreen } = useDissolveScreen();
  const insets = useSafeAreaInsets();
  const back = () => dissolveScreen({ preset: 'sand', haptics: true, then: () => router.back() });

  return (
    <View ref={ref} collapsable={false} style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.bar}>
        <Pressable onPress={back} hitSlop={10} style={({ pressed }) => [st.back, pressed && { opacity: 0.6 }]}>
          <Text style={st.backText}>‹ Back</Text>
        </Pressable>
        <Text style={st.barTitle}>Receipt</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={st.hero}>
          <Text style={st.amount}>48,90 €</Text>
          <Text style={st.merchant}>Café Lisboa · 14 Nov</Text>
        </View>
        {[
          ['2 × Pastel de nata', '6,40 €'],
          ['Galão', '3,50 €'],
          ['Bifana', '7,00 €'],
          ['Sardinhas', '18,00 €'],
          ['Vinho verde', '14,00 €'],
        ].map(([a, b]) => (
          <View key={a} style={st.line}>
            <Text style={st.item}>{a}</Text>
            <Text style={st.price}>{b}</Text>
          </View>
        ))}
        <Code title="useDissolveScreen">{`const { ref, dissolveScreen } = useDissolveScreen()\n\ndissolveScreen({\n  preset: 'sand',\n  then: () => router.back(),\n})`}</Code>
        <Text style={st.note}>tap Back · the whole screen pours away</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  back: { width: 60 },
  backText: { fontSize: 17, color: C.ink },
  barTitle: { fontSize: 17, fontWeight: '600', color: C.ink },
  hero: { backgroundColor: C.dark, borderRadius: 22, padding: 22 },
  amount: { fontSize: 38, fontWeight: '700', color: 'white' },
  merchant: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  item: { fontSize: 15, color: C.ink },
  price: { fontFamily: mono, fontSize: 14, color: C.text },
  note: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 },
});
