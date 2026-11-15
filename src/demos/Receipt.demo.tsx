import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { Receipt, type ReceiptHandle, type ReceiptItem } from '../dissolve/components/Receipt';
import { C, mono } from '../ui';

const ITEMS: ReceiptItem[] = [
  { label: 'Flat white', qty: 2, price: 4.6, note: 'Oat milk' },
  { label: 'Pain au chocolat', price: 2.9 },
  { label: 'Cardamom bun', price: 3.8 },
  { label: 'Filter, Ethiopia Guji', price: 5.2 },
];

/**
 * After paying at a coffee counter: the confirmation lands, then the receipt unfolds under it.
 * Tap the receipt to fold it, Done blows it away.
 */
export default function ReceiptDemo() {
  const [run, setRun] = useState(0);
  const [gone, setGone] = useState(false);
  return (
    <View style={st.stage}>
      {gone ? (
        <Animated.View entering={FadeIn.duration(320).easing(Easing.bezier(0.32, 0.72, 0, 1))} style={st.empty}>
          <Text style={st.emptyText}>Receipt saved to Wallet</Text>
          <Pressable
            onPress={() => {
              setGone(false);
              setRun((r) => r + 1);
            }}
            style={({ pressed }) => [st.ghost, pressed && { opacity: 0.6 }]}
          >
            <Text style={st.ghostText}>Pay again</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Checkout key={run} onGone={() => setGone(true)} />
      )}
    </View>
  );
}

function Checkout({ onGone }: { onGone: () => void }) {
  const receipt = useRef<ReceiptHandle>(null);
  const [open, setOpen] = useState(false);

  // Let the confirmation breathe, then unfold the receipt on its own.
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 650);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={{ gap: 16 }}>
      <View style={st.paid}>
        <View style={st.check}>
          <SymbolView name="checkmark" size={15} weight="bold" tintColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.paidTitle}>Payment complete</Text>
          <Text style={st.paidMeta}>APPLE PAY · TABLE 4</Text>
        </View>
      </View>

      <Receipt
        ref={receipt}
        merchant="Atelier Café"
        subtitle="12 rue Oberkampf · Paris"
        items={ITEMS}
        taxes={[{ label: 'VAT 10%', amount: 2.01 }]}
        total={22.11}
        currency="EUR"
        locale="fr-FR"
        payment="Apple Pay · Visa 4242"
        footer="Merci, à demain"
        open={open}
        onOpenChange={setOpen}
        onDismiss={onGone}
      />

      <View style={st.actions}>
        <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => [st.ghost, pressed && { opacity: 0.6 }]}>
          <Text style={st.ghostText}>{open ? 'Fold' : 'Unfold'}</Text>
        </Pressable>
        <Pressable onPress={() => receipt.current?.dismiss()} style={({ pressed }) => [st.primary, pressed && { opacity: 0.8 }]}>
          <Text style={st.primaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  stage: { backgroundColor: C.surface, borderRadius: 24, padding: 16, minHeight: 200 },
  paid: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  check: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  paidTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.3 },
  paidMeta: { fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 2, letterSpacing: 0.4 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  ghost: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  ghostText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  primary: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: '#1C1C1E' },
  primaryText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  empty: { flex: 1, minHeight: 168, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { fontFamily: mono, fontSize: 12, color: C.muted, letterSpacing: 0.2 },
});
