import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { PullItem, PullToRefresh } from '@registry/pull-to-refresh';
import { Text, View } from '@registry/tw';

/** A bare list on the screen background: pull it down, release, the rows make room and the ring builds the new one. */

type Item = { id: string; title: string; value: string };

const ITEMS: Item[] = [
  { id: 'a', title: 'Maya Chen', value: '+$46.50' },
  { id: 'b', title: 'Blue Bottle', value: '−$6.25' },
  { id: 'c', title: 'Jonah Reyes', value: '−$120.00' },
  { id: 'd', title: 'Payroll', value: '+$3,240.00' },
  { id: 'e', title: 'Whole Foods', value: '−$82.17' },
  { id: 'f', title: 'Lena Park', value: '+$975.00' },
  { id: 'g', title: 'Lyft', value: '−$38.90' },
  { id: 'h', title: 'Spotify', value: '−$16.99' },
];

const INCOMING: Omit<Item, 'id'>[] = [
  { title: 'Priya Natarajan', value: '+$50.00' },
  { title: 'Sweetgreen', value: '−$14.75' },
  { title: 'Diego Alvarez', value: '+$220.00' },
  { title: 'Apple', value: '−$2.99' },
];

export default function PullToRefreshDemo() {
  const [items, setItems] = useState(ITEMS);
  const next = useRef(0);

  const refresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 1200));
    const item = INCOMING[next.current % INCOMING.length];
    next.current += 1;
    setItems((list) => [{ ...item, id: `n${next.current}` }, ...list]);
  }, []);

  return (
    <PullToRefresh onRefresh={refresh}>
      {items.map((item, i) => (
        <PullItem key={item.id} id={item.id}>
          {i > 0 ? <View className="bg-dissolve-border" style={st.separator} /> : null}
          <View style={st.row}>
            <Text numberOfLines={1} className="text-dissolve-foreground" style={st.title}>
              {item.title}
            </Text>
            <Text className="text-dissolve-muted" style={st.value}>
              {item.value}
            </Text>
          </View>
        </PullItem>
      ))}
    </PullToRefresh>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 56 },
  title: { flex: 1, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  value: { fontSize: 17, lineHeight: 22, letterSpacing: -0.43, fontVariant: ['tabular-nums'] },
  separator: { height: StyleSheet.hairlineWidth },
});
