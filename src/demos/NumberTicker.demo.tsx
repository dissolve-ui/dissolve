import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { NumberTicker } from '../dissolve/components/NumberTicker';
import { C, mono } from '../ui';

const USD_PER_EUR = 1.08;

function Action({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [st.action, pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] }]}
    >
      <View style={st.actionIcon}>
        <SymbolView name={icon} size={18} tintColor="#FFFFFF" weight="semibold" />
      </View>
      <Text style={st.actionLabel}>{label}</Text>
    </Pressable>
  );
}

/** Wallet card: the balance rolls on every move, the dollar line follows in another locale. */
export default function NumberTickerDemo() {
  const [balance, setBalance] = useState(1240.5);
  const [last, setLast] = useState(0);

  const move = (amount: number) => {
    setBalance((b) => Math.max(0, Math.round((b + amount) * 100) / 100));
    setLast(amount);
  };

  return (
    <View style={st.card}>
      <Text style={st.kicker}>MAIN ACCOUNT · EUR</Text>
      <NumberTicker value={balance} decimals={2} locale="fr-FR" suffix={'\u00A0€'} fontSize={44} textStyle={st.balance} style={st.ticker} />
      <View style={st.sub}>
        <NumberTicker value={balance * USD_PER_EUR} decimals={2} locale="en-US" prefix="≈ $" fontSize={15} color={C.muted} textStyle={st.usd} duration={600} />
        {last ? (
          <View style={[st.delta, { backgroundColor: last > 0 ? '#EAF9EE' : '#FFEFEE' }]}>
            <Text style={[st.deltaText, { color: last > 0 ? '#248A3D' : '#D70015' }]}>
              {last > 0 ? '+' : '−'}
              {Math.abs(last).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </Text>
          </View>
        ) : null}
      </View>

      <View style={st.actions}>
        <Action icon="plus" label="Add" onPress={() => move(250)} />
        <Action icon="arrow.up.right" label="Send" onPress={() => move(-42.9)} />
        <Action icon="cup.and.saucer.fill" label="Coffee" onPress={() => move(-3.6)} />
        <Action icon="dice.fill" label="Random" onPress={() => move(Math.round((Math.random() * 20000 - 6000)) / 100 * (Math.random() > 0.7 ? 10 : 1))} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 20 },
  kicker: { fontFamily: mono, fontSize: 11, color: C.muted, letterSpacing: 0.4 },
  ticker: { marginTop: 10 },
  balance: { fontWeight: '700', letterSpacing: -1.2 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 24 },
  usd: { fontWeight: '500' },
  delta: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  deltaText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  action: { alignItems: 'center', gap: 7, width: 64 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '500', color: C.ink },
});
