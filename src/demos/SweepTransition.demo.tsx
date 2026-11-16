import { useRef, useState } from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SweepTransition, type SweepMode, type SweepTransitionHandle } from '@registry/sweep-transition';
import { Pressable, Text, View } from '@registry/tw';
import { mono } from '../ui';

const CARDS = [
  { src: require('../../assets/paintings/lake.jpg'), title: 'Lake', sub: 'Morning, 7:40' },
  { src: require('../../assets/paintings/temple.jpg'), title: 'Temple', sub: 'Noon, 12:10' },
  { src: require('../../assets/paintings/valley.jpg'), title: 'Valley', sub: 'Dusk, 19:55' },
  { src: require('../../assets/paintings/arch.jpg'), title: 'Arch', sub: 'Night, 22:30' },
];

const MODES: [SweepMode, string][] = [
  ['vertical', 'Vertical'],
  ['horizontal', 'Horizontal'],
  ['radial', 'Radial'],
];

/**
 * Photo card: tap it and a band sweeps the next painting in. The radial mode grows from the
 * touch point. Tap again mid sweep to send the band back.
 */
export default function SweepTransitionDemo() {
  const sweep = useRef<SweepTransitionHandle>(null);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<SweepMode>('vertical');

  const onPress = (e: GestureResponderEvent) => {
    const origin = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    const prev = idx;
    sweep.current?.run(() => setIdx((prev + 1) % CARDS.length), { origin, revert: () => setIdx(prev) });
  };

  const card = CARDS[idx];
  return (
    <View style={st.root}>
      <Pressable onPress={onPress} style={st.press} accessibilityRole="button" accessibilityLabel="Sweep to the next card">
        <SweepTransition ref={sweep} mode={mode} className="rounded-[20px] bg-dissolve-surface-2">
          <View style={st.card} pointerEvents="none">
            <Image source={card.src} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
            <View style={st.caption}>
              <Text style={st.title}>{card.title}</Text>
              <Text style={st.sub}>{card.sub}</Text>
            </View>
          </View>
        </SweepTransition>
      </Pressable>

      <View className="bg-dissolve-surface" style={st.chips}>
        {MODES.map(([m, label]) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            className={m === mode ? 'border-dissolve-border bg-dissolve-background active:opacity-70' : 'border-transparent active:opacity-70'}
            style={[st.chip, m === mode && st.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: m === mode }}
          >
            <Text className={m === mode ? 'text-dissolve-foreground' : 'text-dissolve-muted'} style={st.chipText}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-dissolve-muted" style={st.hint}>
        Tap the card to sweep, tap again mid sweep to cancel
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', gap: 16, paddingTop: 8 },
  press: { width: '100%', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' },
  card: { width: '100%', aspectRatio: 1 / 0.66 },
  caption: { position: 'absolute', left: 16, right: 16, bottom: 11 },
  title: { color: '#fff', fontSize: 20, fontWeight: '600', lineHeight: 24 },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500', lineHeight: 17 },
  chips: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 999 },
  chip: { height: 30, paddingHorizontal: 13, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  chipOn: { boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
  chipText: { fontSize: 13, fontWeight: '500' },
  hint: { fontFamily: mono, fontSize: 11, letterSpacing: 0.2, textAlign: 'center' },
});
