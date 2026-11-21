import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Toggle } from '@registry/toggle';
import { Text, View } from '@registry/tw';

const ROWS = [
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'bluetooth', label: 'Bluetooth' },
  { key: 'airplane', label: 'Airplane mode' },
] as const;

/** A settings group of switches, then the three sizes side by side. */
export default function ToggleDemo() {
  const [on, setOn] = useState<Record<string, boolean>>({ wifi: true, bluetooth: false, airplane: false });
  return (
    <View style={st.root}>
      <View className="bg-dissolve-surface" style={st.group}>
        {ROWS.map((r, i) => (
          <View key={r.key} style={[st.row, i > 0 && st.divider]} className="border-dissolve-border">
            <Text className="text-dissolve-foreground" style={st.label}>
              {r.label}
            </Text>
            <Toggle value={on[r.key]} onValueChange={(v) => setOn((s) => ({ ...s, [r.key]: v }))} accessibilityLabel={r.label} />
          </View>
        ))}
      </View>
      <View style={st.sizes}>
        <Toggle size="sm" defaultValue />
        <Toggle size="md" />
        <Toggle size="lg" defaultValue />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 36, paddingVertical: 40, paddingHorizontal: 4 },
  group: { borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 16, fontWeight: '500' },
  sizes: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
});
