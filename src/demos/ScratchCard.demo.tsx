import { useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { ScratchCard, type ScratchCardHandle } from '@registry/scratch-card';
import { Pressable, Text, View } from '@registry/tw';
import { mono } from '../ui';

/** Just the card on the screen background, a reward under the foil, and Again to start over. */
export default function ScratchCardDemo() {
  const card = useRef<ScratchCardHandle>(null);
  const { width } = useWindowDimensions();
  const w = Math.min(340, width - 32);

  return (
    <View style={st.root}>
      <ScratchCard ref={card} width={w} height={Math.round(w * 0.62)}>
        <Text className="text-dissolve-muted" style={st.kicker}>YOU WON</Text>
        <Text className="text-dissolve-foreground" style={st.amount}>$25</Text>
        <Text className="text-dissolve-muted" style={st.code}>CODE SPRING25</Text>
      </ScratchCard>
      <Pressable onPress={() => card.current?.reset()} hitSlop={10} className="active:opacity-50" accessibilityRole="button">
        <Text className="text-dissolve-muted" style={st.again}>Again</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', gap: 32, paddingVertical: 24 },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2 },
  amount: { fontSize: 56, fontWeight: '700', letterSpacing: -2, marginTop: 2 },
  code: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, marginTop: 4 },
  again: { fontSize: 15, fontWeight: '500' },
});
