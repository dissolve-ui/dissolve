import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ReorderHandle, ReorderList, type ReorderListRenderInfo } from '@registry/reorder-list';
import { Text, View } from '@registry/tw';

/** A bare list on the screen background: touch and hold a line, drag it to a new place. */

type Item = { id: string; title: string };

const ITEMS: Item[] = [
  { id: 'a', title: 'Ship the onboarding' },
  { id: 'b', title: 'Call the landlord' },
  { id: 'c', title: 'Book the flights' },
  { id: 'd', title: 'Review the pull request' },
  { id: 'e', title: 'Renew the passport' },
  { id: 'f', title: 'Plan the long run' },
  { id: 'g', title: 'Read two chapters' },
];

export default function ReorderListDemo() {
  const [items, setItems] = useState(ITEMS);

  const renderItem = useCallback(
    ({ item, index, dragging }: ReorderListRenderInfo<Item>) => (
      <View>
        {index > 0 && !dragging ? <View className="bg-dissolve-border" style={st.separator} /> : null}
        <View style={st.row}>
          <Text className="text-dissolve-muted" style={st.rank}>
            {index + 1}
          </Text>
          <Text numberOfLines={1} className="text-dissolve-foreground" style={st.title}>
            {item.title}
          </Text>
          <ReorderHandle className="pr-0" />
        </View>
      </View>
    ),
    [],
  );

  return (
    <ReorderList
      data={items}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      onReorder={setItems}
      itemClassName="bg-dissolve-background"
    />
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rank: { width: 20, fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] },
  title: { flex: 1, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  separator: { height: StyleSheet.hairlineWidth },
});
