import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { RangeSlider, type RangeValue } from '@registry/range-slider';
import { Text, View } from '@registry/tw';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={st.group}>
      <Text className="text-dissolve-muted" style={st.label}>{label}</Text>
      {children}
    </View>
  );
}

/** A price range and a stepped distance, each under its value in large type. */
export default function RangeSliderDemo() {
  const [price, setPrice] = useState<RangeValue>([120, 640]);
  const [km, setKm] = useState<RangeValue>([2, 7]);
  return (
    <View style={st.root}>
      <Group label="Price per night">
        <Text className="text-dissolve-foreground" style={st.big}>${price[0]} – ${price[1]}</Text>
        <RangeSlider min={0} max={1000} step={10} value={price} onValueChange={setPrice} prefix="$" accessibilityLabels={['Minimum price', 'Maximum price']} />
      </Group>
      <Group label="Distance from the center">
        <Text className="text-dissolve-foreground" style={st.big}>
          {km[0]} – {km[1]} <Text className="text-dissolve-muted" style={st.unit}>km</Text>
        </Text>
        <RangeSlider min={0} max={10} step={1} value={km} onValueChange={setKm} suffix={' km'} minDistance={1} ticks={false} accessibilityLabels={['Minimum distance', 'Maximum distance']} />
      </Group>
    </View>
  );
}

const st = StyleSheet.create({
  root: { paddingVertical: 32, paddingHorizontal: 24, gap: 48 },
  group: { paddingHorizontal: 4 },
  label: { fontSize: 15 },
  big: { fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -0.9, fontVariant: ['tabular-nums'], marginTop: 2 },
  unit: { fontSize: 22, fontWeight: '600' },
});
