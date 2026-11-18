import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { SegmentedControl } from '@registry/segmented-control';
import { View } from '@registry/tw';

const PERIODS = ['Day', 'Week', 'Month', 'Year'];

const glyph = (name: SFSymbol) => ({ color, size }: { color: string; size: number }) => <SymbolView name={name} size={size} tintColor={color} />;

const VIEWS = [
  { value: 'list', label: 'List', icon: glyph('list.bullet') },
  { value: 'grid', label: 'Grid', icon: glyph('square.grid.2x2') },
  { value: 'map', label: 'Map', icon: glyph('map') },
];

/** A period picker at full width, and a smaller one with icons under it. */
export default function SegmentedControlDemo() {
  const [period, setPeriod] = useState('Week');
  const [view, setView] = useState('list');
  return (
    <View style={st.root}>
      <SegmentedControl segments={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl segments={VIEWS} value={view} onChange={setView} size="sm" className="w-[248px] self-center" />
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 40, paddingVertical: 48, paddingHorizontal: 4 },
});
