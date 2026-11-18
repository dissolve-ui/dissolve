import { useState } from 'react';
import { GlossyButton } from '@registry/glossy-button';
import { View } from '@registry/tw';
import { Chip } from '../ui';

const COLORS = [
  { label: 'Blue', value: '#296FF0' },
  { label: 'Red', value: '#E5484D' },
  { label: 'Green', value: '#30A46C' },
  { label: 'Ink', value: '#1C1C1F' },
];
const RADII = [
  { label: 'Pill', value: 999 },
  { label: '14', value: 14 },
  { label: '8', value: 8 },
];

/** The glossy pill, centered, with a few fills and radii to try. */
export default function GlossyButtonDemo() {
  const [color, setColor] = useState(COLORS[0].value);
  const [radius, setRadius] = useState(RADII[0].value);
  return (
    <View style={{ alignItems: 'center', gap: 28, paddingVertical: 24 }}>
      <GlossyButton
        color={color}
        radius={radius}
        size="lg"
        onPress={() => {}}
      >
        Get started
      </GlossyButton>
      <View style={{ gap: 10, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {COLORS.map((c) => (
            <Chip key={c.value} label={c.label} active={color === c.value} onPress={() => setColor(c.value)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {RADII.map((r) => (
            <Chip key={r.value} label={r.label} active={radius === r.value} onPress={() => setRadius(r.value)} />
          ))}
        </View>
      </View>
    </View>
  );
}
