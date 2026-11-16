import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Text, useToken } from '@registry/tw';
import {
  DissolveIn,
  VARIANT_INFO,
  useDissolve,
  useDissolveHold,
  useDissolveMorph,
  useDissolvePeel,
  type VariantName,
  type ViewRef,
} from '@/dissolve';
import { EFFECTS, type EffectEntry } from '@/catalog';
import { Pager } from '@/pager';
import { Button, Caption, Code, Stage } from '@/ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ART = [
  require('../../assets/paintings/pond.jpg'),
  require('../../assets/paintings/tuscany.jpg'),
  require('../../assets/paintings/lake.jpg'),
  require('../../assets/paintings/valley.jpg'),
  require('../../assets/paintings/temple.jpg'),
  require('../../assets/paintings/cypress.jpg'),
  require('../../assets/paintings/pines.jpg'),
  require('../../assets/paintings/villa.jpg'),
];

const CARDS = [
  ['Summer trip', '48 photos · Lisbon'],
  ['Morning swim', '12 photos · Annecy'],
  ['Tuscany', '86 photos · Siena'],
  ['Weekend', '23 photos · Etretat'],
] as const;

/** Window point of a touch, made local to a view (locationX is relative to the deepest child). */
function localPoint(view: ViewRef | null, e?: GestureResponderEvent) {
  if (!view || !e) return Promise.resolve(undefined);
  const { pageX, pageY } = e.nativeEvent;
  return new Promise<{ x: number; y: number }>((res) => view.measureInWindow((x, y) => res({ x: pageX - x, y: pageY - y })));
}

/** The sample everything plays on: a photo album card in the page colors. */
function Card({ effect }: { effect: EffectEntry }) {
  const bg = useToken('background');
  const i = EFFECTS.findIndex((e) => e.slug === effect.slug);
  const [title, sub] = CARDS[i % CARDS.length];
  return (
    <View style={[st.card, { backgroundColor: bg }]}>
      <Image source={ART[i % ART.length]} style={st.art} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text className="text-dissolve-foreground" style={st.title}>
          {title}
        </Text>
        <Text className="text-dissolve-muted" style={st.sub}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

/** Comes back calmly after each run, so the stage is never empty for long. */
function Return({ k, children }: { k: number; children: ReactNode }) {
  return (
    <Animated.View key={k} entering={k ? FadeIn.duration(420).easing(CALM) : undefined}>
      {children}
    </Animated.View>
  );
}

type SampleProps = { effect: EffectEntry; trigger: number };

/* ---------- exits: tap, touch point, stream into a target ---------- */

function ExitSample({ effect, trigger }: SampleProps) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  const busy = useRef(false);
  const bin = useRef<View>(null);
  const bump = useSharedValue(1);
  const binStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const primary = useToken('primary');
  const onPrimary = useToken('primary-foreground');

  const play = async (e?: GestureResponderEvent) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const origin = effect.kind === 'touch' ? await localPoint(ref.current, e) : undefined;
      await dissolve({
        preset: effect.slug,
        origin,
        to: effect.kind === 'stream' ? bin : undefined,
        onArrive:
          effect.kind === 'stream'
            ? () => {
                bump.value = withSequence(withTiming(1.2, { duration: 120 }), withTiming(1, { duration: 320, easing: CALM }));
              }
            : undefined,
      });
      await wait(500);
      reset();
      setK((n) => n + 1);
    } finally {
      busy.current = false;
    }
  };

  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    if (trigger) playRef.current();
  }, [trigger]);

  return (
    <>
      {effect.kind === 'stream' ? (
        <Animated.View style={[st.bin, binStyle]}>
          <View ref={bin} collapsable={false} style={[st.binInner, { backgroundColor: primary }]}>
            <SymbolView name="trash" size={18} tintColor={onPrimary} />
          </View>
        </Animated.View>
      ) : null}
      <Return k={k}>
        <Pressable onPress={play} disabled={dissolving}>
          <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
            <Card effect={effect} />
          </View>
        </Pressable>
      </Return>
    </>
  );
}

/* ---------- entrances: gather, rain, print ---------- */

function InSample({ effect, trigger }: SampleProps) {
  const [k, setK] = useState(0);
  // Let the push transition settle first: the entrance is measured in window coordinates.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 450);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (trigger) setK((n) => n + 1);
  }, [trigger]);
  return (
    <Pressable onPress={() => setK((n) => n + 1)}>
      <DissolveIn key={k} preset={effect.slug} play={ready} style={st.cardSlot}>
        <Card effect={effect} />
      </DissolveIn>
    </Pressable>
  );
}

/* ---------- fling: swipe it away ---------- */

function FlingSample({ effect, trigger }: SampleProps) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const busy = useRef(false);

  const go = async (vx: number, vy: number) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await dissolve({ preset: 'fling', velocity: { x: vx, y: vy } });
      await wait(400);
      reset();
      tx.value = 0;
      ty.value = 0;
      setK((n) => n + 1);
    } finally {
      busy.current = false;
    }
  };

  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (trigger) goRef.current(1800, -400);
  }, [trigger]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY * 0.4;
    })
    .onEnd((e) => {
      if (Math.abs(tx.value) > 90 || Math.abs(e.velocityX) > 700) {
        scheduleOnRN(go, e.velocityX, e.velocityY);
      } else {
        tx.value = withTiming(0, { duration: 380, easing: CALM });
        ty.value = withTiming(0, { duration: 380, easing: CALM });
      }
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${tx.value / 25}deg` }],
  }));

  return (
    <Return k={k}>
      <GestureDetector gesture={pan}>
        <Animated.View style={style}>
          <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
            <Card effect={effect} />
          </View>
        </Animated.View>
      </GestureDetector>
    </Return>
  );
}

/* ---------- charge: hold to destroy ---------- */

function HoldSample({ effect, trigger }: SampleProps) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (trigger) setK((n) => n + 1);
  }, [trigger]);
  return (
    <Return k={k}>
      <HoldCard effect={effect} onDone={() => setTimeout(() => setK((n) => n + 1), 400)} />
    </Return>
  );
}

function HoldCard({ effect, onDone }: { effect: EffectEntry; onDone: () => void }) {
  const { ref, pressHandlers, style } = useDissolveHold({ holdMs: 1200, onCommit: onDone });
  return (
    <Pressable {...pressHandlers}>
      <Animated.View ref={ref} collapsable={false} style={style}>
        <Card effect={effect} />
      </Animated.View>
    </Pressable>
  );
}

/* ---------- peel: a sticker ---------- */

function PeelSample({ effect, trigger }: SampleProps) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (trigger) setK((n) => n + 1);
  }, [trigger]);
  return (
    <Return k={k}>
      <PeelCard onDone={() => setTimeout(() => setK((n) => n + 1), 400)} />
    </Return>
  );
}

function PeelCard({ onDone }: { onDone: () => void }) {
  const { ref, gesture, style } = useDissolvePeel({ onCommit: onDone });
  const bg = useToken('background');
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} collapsable={false} style={[st.sticker, { backgroundColor: bg }, style]}>
        <Image source={ART[4]} style={st.stickerImg} contentFit="cover" />
        <Text className="text-dissolve-foreground" style={st.stickerText}>
          Temple, 1820
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

/* ---------- morph: one view into another ---------- */

function MorphSample({ effect, trigger }: SampleProps) {
  const { refA, refB, styleA, styleB, phase, morphing, morph } = useDissolveMorph();
  const bg = useToken('background');
  const success = useToken('success');
  const toggle = () => {
    if (morphing) return;
    morph({ duration: 1300, reverse: phase === 'b', haptics: true });
  };
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (trigger) toggleRef.current();
  }, [trigger]);
  return (
    <Pressable onPress={toggle} style={st.morphSlot}>
      <View style={[StyleSheet.absoluteFill, styleA]}>
        <View ref={refA} collapsable={false} style={[st.morphCard, { backgroundColor: bg }]}>
          <Image source={ART[2]} style={st.cover} contentFit="cover" />
          <Text className="text-dissolve-foreground" style={st.title}>
            Ready to download
          </Text>
          <Text className="text-dissolve-muted" style={st.sub}>
            Album · 12 tracks
          </Text>
        </View>
      </View>
      <View style={[StyleSheet.absoluteFill, styleB]}>
        <View ref={refB} collapsable={false} style={[st.morphCard, st.morphDone, { backgroundColor: success }]}>
          <SymbolView name="checkmark.circle.fill" size={52} tintColor="white" style={{ flex: 1 }} />
          <Text style={[st.title, { color: 'white' }]}>Downloaded</Text>
          <Text style={[st.sub, { color: 'rgba(255,255,255,0.75)' }]}>Available offline</Text>
        </View>
      </View>
    </Pressable>
  );
}

const SAMPLES: Record<EffectEntry['kind'], (p: SampleProps) => ReactNode> = {
  tap: ExitSample,
  touch: ExitSample,
  stream: ExitSample,
  in: InSample,
  fling: FlingSample,
  hold: HoldSample,
  peel: PeelSample,
  morph: MorphSample,
};

export default function EffectScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const effect = EFFECTS.find((e) => e.slug === name);
  const [trigger, setTrigger] = useState(0);
  if (!effect) return <Stack.Screen options={{ title: 'Not found' }} />;
  const Sample = SAMPLES[effect.kind];
  const resetOnly = effect.kind === 'hold' || effect.kind === 'peel';

  return (
    <>
      <Stack.Screen options={{ title: effect.title }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={st.scroll}>
        <Stage style={st.stage}>
          <Sample key={effect.slug} effect={effect} trigger={trigger} />
        </Stage>
        <Caption>{effect.hint}</Caption>

        <View style={{ height: 18 }} />
        <Button label={resetOnly ? 'Reset' : 'Replay'} onPress={() => setTrigger((n) => n + 1)} />

        <Text className="text-dissolve-foreground" style={st.info}>
          {VARIANT_INFO[effect.slug as VariantName]}
        </Text>

        <Code title={`preset: '${effect.slug}'`}>{effect.code}</Code>

        <View style={{ height: 22 }} />
        <Pager href={`/effect/${effect.slug}`} />
      </ScrollView>
    </>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  stage: { height: 320, alignItems: 'center', justifyContent: 'center' },
  card: { width: 264, padding: 12, borderRadius: 20, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardSlot: { width: 264 },
  art: { width: 64, height: 64, borderRadius: 14 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  sub: { fontSize: 13, marginTop: 2 },
  info: { fontSize: 16, lineHeight: 23, marginTop: 26, marginBottom: 14, paddingHorizontal: 2 },
  bin: { position: 'absolute', right: 16, top: 16 },
  binInner: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sticker: {
    width: 180,
    padding: 8,
    borderRadius: 22,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  stickerImg: { width: 164, height: 164, borderRadius: 16 },
  stickerText: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingBottom: 2 },
  morphSlot: { width: 220, height: 200 },
  morphCard: { width: 220, height: 200, borderRadius: 22, padding: 16 },
  morphDone: { justifyContent: 'flex-end' },
  cover: { flex: 1, borderRadius: 14, marginBottom: 10 },
});
