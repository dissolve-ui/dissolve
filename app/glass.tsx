import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDissolve, type VariantName } from '@/dissolve';
import { mono } from '@/ui';

const BG = require('../assets/paintings/cypress.jpg');

function useComeBack(preset: VariantName, duration = 1500) {
  const d = useDissolve();
  const [k, setK] = useState(0);
  const run = async (e?: GestureResponderEvent) => {
    if (d.dissolving) return;
    const touch = preset === 'snap' || preset === 'shatter';
    const origin = touch && e ? { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY } : undefined;
    await d.dissolve({ preset, duration, origin });
    setTimeout(() => {
      d.reset();
      setK((n) => n + 1);
    }, duration * 0.7);
  };
  return { ...d, k, run };
}

/** A liquid glass surface that dissolves. The grains carry the glass as it looked, blur included. */
function GlassCard({ preset, children, style }: { preset: VariantName; children: React.ReactNode; style?: object }) {
  const { ref, dissolving, k, run } = useComeBack(preset);
  return (
    <Pressable onPress={run}>
      <Animated.View key={k} entering={k ? FadeIn.duration(600) : undefined}>
        <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
          <GlassView glassEffectStyle="regular" style={[st.glass, style]}>
            {children}
          </GlassView>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function Glass() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(20,18,14,0.55)', 'rgba(20,18,14,0.15)', 'rgba(20,18,14,0)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[st.content, { paddingTop: insets.top + 60 }]}>
        <Text style={st.note}>{isLiquidGlassAvailable() ? 'liquid glass · tap a surface' : 'liquid glass unavailable on this OS, blur fallback'}</Text>

        <GlassCard preset="dust" style={st.player}>
          <Image source={require('../assets/paintings/temple.jpg')} style={st.cover} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Golden hour</Text>
            <Text style={st.sub}>Studio mix · 3:42</Text>
          </View>
          <SymbolView name="pause.fill" size={22} tintColor="white" />
          <SymbolView name="forward.fill" size={22} tintColor="white" />
        </GlassCard>

        <GlassCard preset="shatter" style={st.notif}>
          <View style={st.row}>
            <SymbolView name="calendar" size={18} tintColor="white" />
            <Text style={st.app}>CALENDAR · now</Text>
          </View>
          <Text style={st.title}>Design review in 10 minutes</Text>
          <Text style={st.sub}>Studio 2 · bring the Figma link</Text>
        </GlassCard>

        <View style={st.pills}>
          <GlassCard preset="snap" style={st.pill}>
            <SymbolView name="heart.fill" size={18} tintColor="white" />
            <Text style={st.pillText}>Like</Text>
          </GlassCard>
          <GlassCard preset="ember" style={st.pill}>
            <SymbolView name="trash" size={18} tintColor="white" />
            <Text style={st.pillText}>Delete</Text>
          </GlassCard>
          <GlassCard preset="pixel" style={st.pill}>
            <SymbolView name="square.and.arrow.up" size={18} tintColor="white" />
            <Text style={st.pillText}>Share</Text>
          </GlassCard>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  content: { flex: 1, padding: 18, gap: 14 },
  note: { fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 6 },
  glass: { borderRadius: 26, padding: 14, overflow: 'hidden' },
  player: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 54, height: 54, borderRadius: 12 },
  notif: { gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  app: { fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.4 },
  title: { color: 'white', fontSize: 17, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  pills: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 11 },
  pillText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
