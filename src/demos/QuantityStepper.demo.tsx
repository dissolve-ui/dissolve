import { useRef, useState } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDissolve } from 'react-native-dissolve';
import { NumberTicker } from '@registry/number-ticker';
import { QuantityStepper } from '@registry/quantity-stepper';
import { Pressable, Text, View, useToken } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

type Line = { id: string; name: string; detail: string; icon: SFSymbol; price: number; qty: number };

const CART: Line[] = [
  { id: 'mug', name: 'Stoneware mug', detail: 'Sand · 350 ml', icon: 'cup.and.saucer.fill', price: 18, qty: 2 },
  { id: 'tee', name: 'Heavy cotton tee', detail: 'Off white · M', icon: 'tshirt.fill', price: 32, qty: 1 },
  { id: 'cap', name: 'Wool cap', detail: 'Charcoal', icon: 'graduationcap.fill', price: 24, qty: 1 },
];

/** One cart row: the stepper turns into a trash at 1, the row leaves as sand and the list closes up. */
function CartRow({ line, onQty, onGone }: { line: Line; onQty: (qty: number) => void; onGone: () => void }) {
  const ink = useToken('foreground');
  const { ref, dissolving, dissolve } = useDissolve();
  const h = useSharedValue(-1);
  const measured = useRef(0);
  const leaving = useRef(false);

  const remove = async () => {
    // One removal per row, even if the trash is tapped again while the sand falls.
    if (leaving.current) return;
    leaving.current = true;
    await dissolve({ preset: 'sand', origin: 'right', duration: 1200, haptics: false });
    h.value = measured.current;
    h.value = withTiming(0, { duration: 300, easing: CALM }, (done) => {
      if (done) scheduleOnRN(onGone);
    });
  };

  const wrap = useAnimatedStyle(() => (h.value < 0 ? {} : { height: h.value, overflow: 'hidden' }));
  return (
    <Animated.View style={wrap}>
      <RNView
        ref={ref}
        collapsable={false}
        onLayout={(e: LayoutChangeEvent) => {
          if (h.value < 0) measured.current = e.nativeEvent.layout.height;
        }}
        style={{ opacity: dissolving ? 0 : 1 }}
      >
        <View className="border-b border-dissolve-border" style={st.row}>
          <View className="bg-dissolve-surface" style={st.thumb}>
            <SymbolView name={line.icon} size={24} tintColor={ink} />
          </View>
          <View style={st.info}>
            <Text className="text-dissolve-foreground" style={st.name} numberOfLines={1}>
              {line.name}
            </Text>
            <Text className="text-dissolve-muted" style={st.detail}>
              {line.detail}
            </Text>
            <NumberTicker value={line.price * line.qty} decimals={2} locale="en-US" prefix="$" fontSize={15} duration={420} textClassName="font-semibold" className="mt-[4px]" />
          </View>
          <QuantityStepper value={line.qty} onChange={onQty} max={9} onRemove={remove} />
        </View>
      </RNView>
    </Animated.View>
  );
}

/**
 * A shopping cart. Tap or hold + and −, the line and the total roll. At 1 the − becomes a
 * trash: tap it and the row leaves as sand. The mug stops at 9 (shake).
 */
export default function QuantityStepperDemo() {
  const [lines, setLines] = useState(CART);
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const shipping = total >= 60 || total === 0 ? 0 : 4.9;

  return (
    <View className="bg-dissolve-background" style={st.screen}>
      <View style={st.head}>
        <Text className="text-dissolve-foreground" style={st.title}>
          Bag
        </Text>
        <Text className="text-dissolve-muted" style={st.kicker}>
          {count} ITEM{count === 1 ? '' : 'S'}
        </Text>
      </View>

      {lines.map((l) => (
        <CartRow
          key={l.id}
          line={l}
          onQty={(qty) => setLines((all) => all.map((x) => (x.id === l.id ? { ...x, qty } : x)))}
          onGone={() => setLines((all) => all.filter((x) => x.id !== l.id))}
        />
      ))}

      {lines.length === 0 ? (
        <Text className="text-dissolve-muted" style={st.empty}>
          Your bag is empty.
        </Text>
      ) : null}

      <View style={st.sum}>
        <View style={st.sumRow}>
          <Text className="text-dissolve-muted" style={st.sumLabel}>
            Shipping
          </Text>
          <Text className="text-dissolve-muted" style={st.sumLabel}>
            {shipping ? '$4.90' : 'Free'}
          </Text>
        </View>
        <View style={st.sumRow}>
          <Text className="text-dissolve-foreground" style={st.totalLabel}>
            Total
          </Text>
          <NumberTicker value={total + shipping} decimals={2} locale="en-US" prefix="$" fontSize={22} textClassName="font-bold tracking-[-0.4px]" />
        </View>
      </View>

      <Pressable onPress={() => (lines.length ? undefined : setLines(CART))} className="bg-dissolve-primary active:opacity-75" style={st.cta}>
        <Text className="text-dissolve-primary-foreground" style={st.ctaText}>
          {lines.length ? 'Checkout' : 'Restore bag'}
        </Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: 18, paddingVertical: 18 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  thumb: { width: 56, height: 56, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  detail: { fontSize: 13, marginTop: 1 },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 28 },
  sum: { marginTop: 16, gap: 6 },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLabel: { fontSize: 14 },
  totalLabel: { fontSize: 17, fontWeight: '600' },
  cta: { marginTop: 18, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '600' },
});
