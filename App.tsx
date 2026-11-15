import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { Dust } from './src/Dust';

type Item = { id: string; app: string; title: string; body: string; color: string; time: string };

const ITEMS: Item[] = [
  { id: '1', app: 'Messages', title: 'Lina', body: 'On se retrouve à 19h devant le ciné ?', color: '#34C759', time: 'now' },
  { id: '2', app: 'Calendar', title: 'Design review', body: 'Today at 14:30 · Studio 2', color: '#FF3B30', time: '5m' },
  { id: '3', app: 'Bank', title: 'Card payment', body: '42,90 € at Boulangerie Ernest', color: '#8B5E3C', time: '12m' },
  { id: '4', app: 'Weather', title: 'Rain soon', body: 'Light rain starting in 20 minutes', color: '#0A84FF', time: '30m' },
  { id: '5', app: 'Music', title: 'New release', body: 'Your Friday mix is ready', color: '#FF2D55', time: '1h' },
];

const layout = LinearTransition.duration(420).easing(Easing.bezier(0.32, 0.72, 0, 1));

type Burst = { key: string; image: SkImage; x: number; y: number; width: number; height: number };

function Card({ item, hidden, onPress }: { item: Item; hidden: boolean; onPress: (ref: React.RefObject<View | null>) => void }) {
  const ref = useRef<View>(null);
  return (
    <Animated.View layout={layout}>
      <Pressable onPress={() => onPress(ref)} disabled={hidden}>
        {({ pressed }) => (
          <View
            ref={ref}
            collapsable={false}
            style={[styles.card, { opacity: hidden ? 0 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <View style={[styles.icon, { backgroundColor: item.color }]}>
              <Text style={styles.iconText}>{item.app[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.app}>{item.app.toUpperCase()}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={1}>{item.body}</Text>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function Screen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(ITEMS);
  const [hidden, setHidden] = useState<string[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const dissolve = async (item: Item, ref: React.RefObject<View | null>) => {
    const view = ref.current;
    if (!view) return;
    const [image, box] = await Promise.all([
      makeImageFromView(ref as React.RefObject<View>),
      new Promise<{ x: number; y: number; width: number; height: number }>((res) =>
        view.measureInWindow((x, y, width, height) => res({ x, y, width, height })),
      ),
    ]);
    if (!image) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    [120, 260, 420].forEach((d) => setTimeout(() => Haptics.selectionAsync(), d));

    setBursts((b) => [...b, { key: `${item.id}-${Date.now()}`, image, ...box }]);
    setHidden((h) => [...h, item.id]);
    setTimeout(() => {
      setItems((list) => list.filter((i) => i.id !== item.id));
      setHidden((h) => h.filter((id) => id !== item.id));
    }, 900);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />
      <Text style={styles.h1}>Dissolve</Text>
      <Text style={styles.sub}>Tap a notification to blow it away.</Text>

      <View style={styles.list}>
        {items.map((item) => (
          <Card key={item.id} item={item} hidden={hidden.includes(item.id)} onPress={(ref) => dissolve(item, ref)} />
        ))}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setItems(ITEMS);
        }}
        style={({ pressed }) => [styles.reset, { bottom: insets.bottom + 16, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.resetText}>Reset</Text>
      </Pressable>

      {bursts.map((b) => (
        <Dust
          key={b.key}
          image={b.image}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          onDone={() => setBursts((all) => all.filter((o) => o.key !== b.key))}
        />
      ))}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2EEE8', paddingHorizontal: 16 },
  h1: { fontSize: 34, fontWeight: '700', color: '#1C1A17', letterSpacing: -0.6 },
  sub: { fontSize: 15, color: '#7A7268', marginTop: 4, marginBottom: 20 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: 'white', fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  app: { fontSize: 11, fontWeight: '600', color: '#9A9188', letterSpacing: 0.4 },
  time: { fontSize: 12, color: '#9A9188' },
  title: { fontSize: 15, fontWeight: '600', color: '#1C1A17', marginTop: 2 },
  body: { fontSize: 14, color: '#4A443D', marginTop: 1 },
  reset: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#1C1A17',
  },
  resetText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
