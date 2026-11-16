import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDissolve, type DissolveOptions } from '@/dissolve';
import { Button, C, Caption, Code, Section, Stage, layout } from '@/ui';

const CARDS = [
  { id: '1', name: 'Inès, 27', line: 'Climbing, film photos, bad puns', color: '#E4572E' },
  { id: '2', name: 'Malo, 30', line: 'Cooks ramen from scratch', color: '#3D7BFF' },
  { id: '3', name: 'Sacha, 25', line: 'Always on a night train', color: '#7B4DFF' },
];

const TILES = ['#F4B860', '#E4572E', '#3D7BFF', '#34C759', '#7B4DFF', '#D4A256'];

/** Swipe card: follows the finger, then the release velocity flings the grains. */
function SwipeCard({ card, onGone }: { card: (typeof CARDS)[number]; onGone: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const go = async (vx: number, vy: number) => {
    await dissolve({ preset: 'fling', velocity: { x: vx, y: vy } });
    onGone();
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY * 0.4;
    })
    .onEnd((e) => {
      if (Math.abs(tx.value) > 90 || Math.abs(e.velocityX) > 700) {
        // Grains are captured where the card was dropped, so freeze it there.
        const opts: DissolveOptions['velocity'] = { x: e.velocityX, y: e.velocityY };
        scheduleOnRN(go, opts.x, opts.y);
      } else {
        tx.value = 0;
        ty.value = 0;
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${tx.value / 25}deg` }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <View ref={ref} collapsable={false} style={[st.profile, { opacity: dissolving ? 0 : 1 }]}>
          <View style={[st.photo, { backgroundColor: card.color }]} />
          <Text style={st.name}>{card.name}</Text>
          <Text style={st.line}>{card.line}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function Tile({ color, onGone }: { color: string; onGone: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  const tap = async (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const v = ref.current;
    if (!v) return;
    const origin = await new Promise<{ x: number; y: number }>((res) => v.measureInWindow((x, y) => res({ x: pageX - x, y: pageY - y })));
    await dissolve({ preset: 'snap', origin });
    onGone();
  };
  return (
    <Animated.View layout={layout} style={st.tileWrap}>
      <Pressable onPress={tap} disabled={dissolving}>
        <View ref={ref} collapsable={false} style={[st.tile, { backgroundColor: color, opacity: dissolving ? 0 : 1 }]}>
          <View style={st.tileInner} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Fling() {
  const [cards, setCards] = useState(CARDS);
  const [tiles, setTiles] = useState(TILES.map((c, i) => ({ id: i, c })));
  const [k, setK] = useState(0);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Section title="Fling" note="Swipe a card away. Grains leave in the direction and at the speed of your swipe.">
        <Stage style={{ height: 330, padding: 24 }}>
          <View style={{ flex: 1 }}>
            {cards.length === 0 ? <Caption>no one left</Caption> : null}
            {cards.map((c) => (
              <Animated.View key={`${c.id}-${k}`} entering={k ? FadeIn.duration(400) : undefined} style={StyleSheet.absoluteFill}>
                <SwipeCard card={c} onGone={() => setCards((l) => l.filter((x) => x.id !== c.id))} />
              </Animated.View>
            ))}
          </View>
        </Stage>
        <Button
          label="Reset"
          onPress={() => {
            setCards(CARDS);
            setK((n) => n + 1);
          }}
        />
        <Code title="fling">{`Gesture.Pan().onEnd((e) => {\n  scheduleOnRN(dissolve, {\n    preset: 'fling',\n    velocity: { x: e.velocityX, y: e.velocityY },\n  })\n})`}</Code>
      </Section>

      <Section title="Snap" note="Tap anywhere on a tile. It bursts outward from your finger.">
        <Stage style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, minHeight: 200 }}>
          {tiles.map((t) => (
            <Tile key={t.id} color={t.c} onGone={() => setTiles((l) => l.filter((x) => x.id !== t.id))} />
          ))}
        </Stage>
        <Button label="Reset" onPress={() => setTiles(TILES.map((c, i) => ({ id: Date.now() + i, c })))} />
        <Code title="snap">{`onPress={(e) => dissolve({\n  preset: 'snap',\n  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },\n})}`}</Code>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  profile: { flex: 1, backgroundColor: C.bg, borderRadius: 24, padding: 14 },
  photo: { flex: 1, borderRadius: 16 },
  name: { fontSize: 20, fontWeight: '700', color: C.ink, marginTop: 12 },
  line: { fontSize: 14, color: C.text, marginTop: 2 },
  tileWrap: { width: '30.5%' },
  tile: { aspectRatio: 1, borderRadius: 16, padding: 14 },
  tileInner: { flex: 1, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)' },
});
