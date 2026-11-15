import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve } from '@/dissolve';
import { Button, C, Caption, Stage, layout } from '@/ui';

type Item = { id: string; app: string; title: string; body: string; color: string; time: string };

const ITEMS: Item[] = [
  { id: '1', app: 'Messages', title: 'Lina', body: 'On se retrouve à 19h devant le ciné ?', color: '#34C759', time: 'now' },
  { id: '2', app: 'Calendar', title: 'Design review', body: 'Today at 14:30 · Studio 2', color: '#FF3B30', time: '5m' },
  { id: '3', app: 'Bank', title: 'Card payment', body: '42,90 € at Boulangerie Ernest', color: '#8B5E3C', time: '12m' },
  { id: '4', app: 'Weather', title: 'Rain soon', body: 'Light rain starting in 20 minutes', color: '#0A84FF', time: '30m' },
  { id: '5', app: 'Music', title: 'New release', body: 'Your Friday mix is ready', color: '#FF2D55', time: '1h' },
];



function Card({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Animated.View layout={layout} entering={FadeIn.duration(300)}>
      <Pressable disabled={dissolving} onPress={async () => { await dissolve(); onRemove(); }}>
        <View ref={ref} collapsable={false} style={[st.card, { opacity: dissolving ? 0 : 1 }]}>
          <View style={[st.icon, { backgroundColor: item.color }]}>
            <Text style={st.iconText}>{item.app[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={st.row}>
              <Text style={st.app}>{item.app.toUpperCase()}</Text>
              <Text style={st.time}>{item.time}</Text>
            </View>
            <Text style={st.title}>{item.title}</Text>
            <Text style={st.body} numberOfLines={1}>{item.body}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Notifications() {
  const [items, setItems] = useState(ITEMS);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Stage style={{ gap: 8, minHeight: 470 }}>
        {items.map((item) => (
          <Card key={item.id} item={item} onRemove={() => setItems((l) => l.filter((i) => i.id !== item.id))} />
        ))}
      </Stage>
      <Caption>tap a notification · preset dust</Caption>
      <Button label="Reset" onPress={() => setItems(ITEMS)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'white' },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: 'white', fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  app: { fontSize: 11, fontWeight: '600', color: C.muted, letterSpacing: 0.3 },
  time: { fontSize: 12, color: C.muted },
  title: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 1 },
  body: { fontSize: 14, color: C.text },
});
