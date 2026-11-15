import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDissolve, type VariantName } from '@/dissolve';
import { layout } from '@/ui';

const BG = require('../assets/paintings/temple.jpg');

type Notif = { id: string; app: string; icon: SFSymbol; color: string; title: string; body: string; time: string; preset: VariantName };

const NOTIFS: Notif[] = [
  { id: '1', app: 'Messages', icon: 'message.fill', color: '#34C759', title: 'Léa', body: 'The direction is up in your project 🌿', time: 'now', preset: 'dust' },
  { id: '2', app: 'Calendar', icon: 'calendar', color: '#FF3B30', title: 'Design review', body: 'In 10 minutes · Studio 2', time: '5m ago', preset: 'shatter' },
  { id: '3', app: 'Wallet', icon: 'creditcard.fill', color: '#1C1C1E', title: 'Hannera', body: '1 240,00 € paid · Brief received', time: '12m ago', preset: 'ember' },
  { id: '4', app: 'Photos', icon: 'photo.on.rectangle', color: '#FF9F0A', title: 'On this day', body: 'Lisbon, 3 years ago', time: '1h ago', preset: 'pixel' },
];

/** Real Apple liquid glass: GlassView "clear" refracts what is behind it. */
function GlassNotif({ n, onGone }: { n: Notif; onGone: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  const run = async (e: GestureResponderEvent) => {
    if (dissolving) return;
    const origin = n.preset === 'shatter' ? { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY } : undefined;
    await dissolve({ preset: n.preset, origin, duration: 1400 });
    onGone();
  };
  return (
    <Animated.View layout={layout} entering={FadeIn.duration(500)}>
      <Pressable onPress={run}>
        <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
          <GlassView glassEffectStyle="clear" isInteractive style={st.notif}>
            <View style={[st.icon, { backgroundColor: n.color }]}>
              <SymbolView name={n.icon} size={19} tintColor="white" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={st.row}>
                <Text style={st.title} numberOfLines={1}>{n.title}</Text>
                <Text style={st.time}>{n.time}</Text>
              </View>
              <Text style={st.body} numberOfLines={2}>{n.body}</Text>
            </View>
          </GlassView>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function GlassCircle({ icon, preset }: { icon: SFSymbol; preset: VariantName }) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  return (
    <Pressable
      onPress={async (e) => {
        if (dissolving) return;
        await dissolve({ preset, origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }, duration: 1100 });
        setTimeout(() => { reset(); setK((x) => x + 1); }, 900);
      }}
    >
      <Animated.View key={k} entering={k ? FadeIn.duration(500) : undefined}>
        <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
          <GlassView glassEffectStyle="clear" isInteractive style={st.circle}>
            <SymbolView name={icon} size={22} tintColor="white" />
          </GlassView>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState(NOTIFS);
  const now = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

      <View style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <GlassView glassEffectStyle="clear" isInteractive style={st.back}>
            <SymbolView name="chevron.left" size={17} tintColor="white" weight="semibold" />
          </GlassView>
        </Pressable>
        <SymbolView name="lock.fill" size={18} tintColor="white" />
        <View style={{ width: 40 }} />
      </View>

      <Text style={st.date}>{date}</Text>
      <Text style={st.clock}>{time}</Text>
      {!isLiquidGlassAvailable() ? <Text style={st.warn}>Liquid glass needs iOS 26 or later</Text> : null}

      <View style={{ flex: 1 }} />

      <View style={st.stack}>
        {notifs.map((n) => (
          <GlassNotif key={n.id} n={n} onGone={() => setNotifs((l) => l.filter((x) => x.id !== n.id))} />
        ))}
        {notifs.length === 0 ? (
          <Pressable onPress={() => setNotifs(NOTIFS)} style={{ alignSelf: 'center' }}>
            <GlassView glassEffectStyle="clear" isInteractive style={st.restore}>
              <Text style={st.restoreText}>Bring them back</Text>
            </GlassView>
          </Pressable>
        ) : null}
      </View>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 10 }]}>
        <GlassCircle icon="flashlight.off.fill" preset="snap" />
        <GlassCircle icon="camera.fill" preset="vortex" />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  date: { color: 'rgba(255,255,255,0.92)', fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 22 },
  clock: { color: 'rgba(255,255,255,0.95)', fontSize: 96, fontWeight: '700', textAlign: 'center', letterSpacing: -3, marginTop: -6 },
  warn: { color: 'white', textAlign: 'center', fontSize: 12 },
  stack: { paddingHorizontal: 12, gap: 8, marginBottom: 18 },
  notif: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 24 },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  title: { flex: 1, color: 'white', fontSize: 15, fontWeight: '600' },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 20, marginTop: 1 },
  restore: { borderRadius: 99, paddingHorizontal: 20, paddingVertical: 12 },
  restoreText: { color: 'white', fontSize: 15, fontWeight: '600' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 44 },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
