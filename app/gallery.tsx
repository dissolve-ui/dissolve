import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Link } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { DissolveIn, useDissolve, useDissolveHold, useDissolveMorph, useDissolveScrub, VARIANTS, type VariantName } from '@/dissolve';
import { C, layout, mono } from '@/ui';

const P = {
  aqueduct: require('../assets/paintings/aqueduct.jpg'),
  arch: require('../assets/paintings/arch.jpg'),
  cypress: require('../assets/paintings/cypress.jpg'),
  lake: require('../assets/paintings/lake.jpg'),
  pines: require('../assets/paintings/pines.jpg'),
  pond: require('../assets/paintings/pond.jpg'),
  temple: require('../assets/paintings/temple.jpg'),
  tuscany: require('../assets/paintings/tuscany.jpg'),
  valley: require('../assets/paintings/valley.jpg'),
};
const PAINTINGS = [P.temple, P.lake, P.pines, P.arch, P.valley, P.pond, P.cypress, P.tuscany, P.aqueduct];

const TOUCH: VariantName[] = ['snap', 'shatter'];
const calm = Easing.bezier(0.32, 0.72, 0, 1);

/* ---------- shared bits ---------- */

/** Tap (or long press) dissolves it with `preset`, then it fades back so the demo replays. */
function Dissolvable({ preset, duration = 1500, longPress, fill, style, children, to, onArrive }: { preset: VariantName; duration?: number; longPress?: boolean; fill?: boolean; style?: object; children: ReactNode; to?: React.RefObject<View | null>; onArrive?: () => void }) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [k, setK] = useState(0);
  const run = async (e: GestureResponderEvent) => {
    if (dissolving) return;
    const origin = TOUCH.includes(preset) ? { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY } : undefined;
    await dissolve({ preset, duration, origin, to, onArrive });
    setTimeout(() => {
      reset();
      setK((n) => n + 1);
    }, duration * 0.8);
  };
  return (
    <Pressable onPress={longPress ? undefined : run} onLongPress={longPress ? run : undefined} delayLongPress={220} style={style}>
      <Animated.View key={k} entering={k ? FadeIn.duration(700) : undefined} style={fill ? { flex: 1 } : undefined}>
        <View ref={ref} collapsable={false} style={[fill && { flex: 1 }, { opacity: dissolving ? 0 : 1 }]}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function Header({ index, title, note, right }: { index: string; title: string; note: string; right?: ReactNode }) {
  return (
    <View style={st.header}>
      <View style={{ flex: 1 }}>
        <Text style={st.index}>{index}</Text>
        <Text style={st.h2}>{title}</Text>
        <Text style={st.note}>{note}</Text>
      </View>
      {right}
    </View>
  );
}

function Tag({ name, dark }: { name: string; dark?: boolean }) {
  return <Text style={[st.tag, dark ? st.tagDark : st.tagLight]}>{name}</Text>;
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.chip, active && st.chipOn, pressed && { opacity: 0.7 }]}>
      <Text style={[st.chipText, active && { color: 'white' }]}>{label}</Text>
    </Pressable>
  );
}

function PlaygroundButton() {
  return (
    <Link href="/playground" asChild>
      <Pressable style={({ pressed }) => [st.pg, pressed && { opacity: 0.8 }]}>
        <SymbolView name="slider.horizontal.3" size={16} tintColor="white" />
        <Text style={st.pgText}>Open the playground</Text>
        <SymbolView name="arrow.right" size={14} tintColor="rgba(255,255,255,0.7)" />
      </Pressable>
    </Link>
  );
}

/* ---------- 01 Bento ---------- */

function Bento({ img, icon, title, body, preset, height }: { img: number; icon: SFSymbol; title: string; body: string; preset: VariantName; height: number }) {
  return (
    <Dissolvable preset={preset} fill style={{ height }}>
      <View style={st.bento}>
        <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(28,28,28,0)', 'rgba(28,28,28,0.9)', '#1C1C1C']} locations={[0.3, 0.64, 1]} style={StyleSheet.absoluteFill} />
        <View style={st.bentoTop}>
          <SymbolView name={icon} size={28} tintColor="white" weight="light" />
          <Tag name={preset} dark />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={st.bentoTitle}>{title}</Text>
        <Text style={st.bentoBody}>{body}</Text>
      </View>
    </Dissolvable>
  );
}

/* ---------- 02 Inbox ---------- */

type Mail = { tag: string; dot: string; title: string; body: string; img: number; preset: VariantName };

const MAILS: Mail[] = [
  { tag: 'NEW MESSAGE', dot: '#E4572E', title: 'Léa wrote to you.', body: 'A message from the studio about Fieldbook landing. The whole thread is in your space.', img: P.pond, preset: 'stream' },
  { tag: 'PAID', dot: '#34C759', title: 'Your order is paid.', body: 'We received 1 240 €. The brief is locked, kickoff is on Monday.', img: P.tuscany, preset: 'pixel' },
  { tag: 'IN REVIEW', dot: '#3D7BFF', title: 'Ready for review.', body: 'Three screens and the hero are in. Leave comments right on the frames.', img: P.lake, preset: 'vortex' },
  { tag: 'DELIVERED', dot: '#8B5E3C', title: 'It is yours.', body: 'The Figma file and the pull request are attached. Thank you for trusting us.', img: P.valley, preset: 'sand' },
];

const PlusOne = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
      transform: [{ translateY: withTiming(-28, { duration: 900, easing: calm }) }],
    },
  };
};

function Bin({ binRef, count }: { binRef: React.RefObject<View | null>; count: number }) {
  return (
    <View>
      <View ref={binRef} collapsable={false} style={st.bin}>
        <SymbolView name={count ? 'trash.fill' : 'trash'} size={19} tintColor={C.ink} />
      </View>
      {count ? (
        <Animated.View key={`b${count}`} entering={ZoomIn.duration(220)} style={st.badge}>
          <Text style={st.badgeText}>{count}</Text>
        </Animated.View>
      ) : null}
      {count ? (
        <Animated.Text key={`p${count}`} entering={PlusOne} exiting={FadeOut.duration(1)} style={st.plus}>
          +1
        </Animated.Text>
      ) : null}
    </View>
  );
}

function MailCard({ mail, width, bin, onArrive }: { mail: Mail; width: number; bin: React.RefObject<View | null>; onArrive: () => void }) {
  const streaming = mail.preset === 'stream';
  return (
    <Dissolvable preset={mail.preset} duration={1400} style={{ width }} to={streaming ? bin : undefined} onArrive={streaming ? onArrive : undefined}>
      <View style={st.mail}>
        <Image source={mail.img} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={st.mailInner}>
          <View style={st.mailTagRow}>
            <View style={[st.mailDot, { backgroundColor: mail.dot }]} />
            <Text style={st.mailTag}>{mail.tag}</Text>
            <View style={{ flex: 1 }} />
            <Tag name={streaming ? 'stream → bin' : mail.preset} />
          </View>
          <Text style={st.mailTitle}>{mail.title}</Text>
          <Text style={st.mailBody} numberOfLines={3}>{mail.body}</Text>
          <View style={st.mailCta}>
            <Text style={st.mailCtaText}>Archive</Text>
          </View>
        </View>
      </View>
    </Dissolvable>
  );
}

/* ---------- 03 Thread ---------- */

type Msg = { id: number; me: boolean; text: string; preset: VariantName };
const REPLIES = ['Love it, ship it', 'Can you send the Figma link?', 'Perfect, talk tomorrow', 'The light is so good'];
const MINE = ['Sending the export now', 'Keeping the warm light', 'On it', 'Here is v2'];
const IN_PRESETS: VariantName[] = ['gather', 'rain', 'print'];

function Thread() {
  const send = useRef<View>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const n = useRef(0);

  const onSend = () => {
    const i = n.current++;
    setMsgs((l) => [...l.slice(-3), { id: i * 2, me: true, text: MINE[i % MINE.length], preset: 'stream' }]);
    setTimeout(() => {
      setMsgs((l) => [...l.slice(-3), { id: i * 2 + 1, me: false, text: REPLIES[i % REPLIES.length], preset: IN_PRESETS[i % IN_PRESETS.length] }]);
    }, 1300);
  };

  return (
    <View style={st.thread}>
      <Dissolvable preset="vortex" longPress style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
        <View style={st.them}>
          <Text style={st.themName}>Maya</Text>
          <Text style={st.themText}>Found two refs for the hero, which one?</Text>
        </View>
      </Dissolvable>
      <Dissolvable preset="pixel" longPress style={{ alignSelf: 'flex-start' }}>
        <View style={st.album}>
          <Image source={P.temple} style={st.albumImg} contentFit="cover" />
          <Image source={P.arch} style={st.albumImg} contentFit="cover" />
        </View>
      </Dissolvable>
      <Dissolvable preset="ember" longPress style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <View style={st.me}>
          <Text style={st.meText}>The temple, no question. Keep the warm light.</Text>
        </View>
      </Dissolvable>
      <Dissolvable preset="shatter" longPress style={{ alignSelf: 'flex-end' }}>
        <View style={st.photoMsg}>
          <Image source={P.cypress} style={st.photoImg} contentFit="cover" />
          <Text style={[st.meText, { paddingHorizontal: 10 }]}>And this one for the about page</Text>
          <Text style={st.meta}>20:14 · Read</Text>
        </View>
      </Dissolvable>

      {msgs.map((m) => (
        <Animated.View key={m.id} layout={layout} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
          {m.me ? (
            <DissolveIn preset="stream" from={send} duration={900} style={st.me}>
              <Text style={st.meText}>{m.text}</Text>
            </DissolveIn>
          ) : (
            <DissolveIn preset={m.preset} duration={m.preset === 'print' ? 1000 : 1100} style={st.them}>
              <Text style={st.themName}>Maya · {m.preset}</Text>
              <Text style={st.themText}>{m.text}</Text>
            </DissolveIn>
          )}
        </Animated.View>
      ))}

      <View style={st.composer}>
        <Text style={st.placeholder}>Message</Text>
        <Pressable onPress={onSend} hitSlop={8}>
          <View ref={send} collapsable={false} style={st.send}>
            <SymbolView name="arrow.up" size={15} tintColor="white" weight="bold" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- 04 Arrivals ---------- */

function Arrivals() {
  const [preset, setPreset] = useState<VariantName>('gather');
  const [cards, setCards] = useState<{ id: number; img: number; preset: VariantName }[]>([]);
  const n = useRef(0);
  const add = () => {
    const i = n.current++;
    setCards((l) => [{ id: i, img: PAINTINGS[i % PAINTINGS.length], preset }, ...l].slice(0, 4));
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={st.chips}>
        {IN_PRESETS.map((p) => (
          <Chip key={p} label={p} active={p === preset} onPress={() => setPreset(p)} />
        ))}
        <View style={{ flex: 1 }} />
        <Chip label="+ Add" active onPress={add} />
      </View>
      <View style={st.arrivals}>
        {cards.length === 0 ? <Text style={st.empty}>nothing yet, add a card</Text> : null}
        {cards.map((c) => (
          <Animated.View key={c.id} layout={layout}>
            <DissolveIn preset={c.preset} duration={c.preset === 'print' ? 1100 : 1200} style={st.arrival}>
              <Image source={c.img} style={st.arrivalImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={st.arrivalTitle}>New painting added</Text>
                <Text style={st.arrivalSub}>entered with {c.preset}</Text>
              </View>
            </DissolveIn>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/* ---------- 05 Gestures ---------- */

function ScrubCard({ onDone }: { onDone: () => void }) {
  const { ref, gesture, style } = useDissolveScrub({ preset: 'dust', axis: 'x', onCommit: onDone });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} collapsable={false} style={[st.gCard, style]}>
        <Image source={P.lake} style={st.gImg} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={st.gTitle}>Drag me sideways</Text>
          <Text style={st.gSub}>scrub · go back and the grains return</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function HoldCard({ onDone }: { onDone: () => void }) {
  const { ref, pressHandlers, style } = useDissolveHold({ holdMs: 1200, onCommit: onDone });
  return (
    <View style={{ gap: 8 }}>
      <Pressable {...pressHandlers}>
        <Animated.View ref={ref} collapsable={false} style={[st.gCard, style]}>
          <Image source={P.aqueduct} style={st.gImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={st.gTitle}>Delete this project</Text>
            <Text style={st.gSub}>charge · hold to confirm, let go to cancel</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

type GKey = 's' | 'h';

function Gestures() {
  const [keys, setKeys] = useState({ s: 0, h: 0 });
  const [gone, setGone] = useState({ s: false, h: false });
  const done = (k: GKey) => {
    setGone((g) => ({ ...g, [k]: true }));
    setTimeout(() => {
      setGone((g) => ({ ...g, [k]: false }));
      setKeys((x) => ({ ...x, [k]: x[k] + 1 }));
    }, 1500);
  };
  const slot = (k: GKey, node: ReactNode, height = 72) => (
    <View style={{ height, justifyContent: 'center' }}>
      {gone[k] ? null : (
        <Animated.View key={keys[k]} entering={keys[k] ? FadeIn.duration(500) : undefined}>
          {node}
        </Animated.View>
      )}
    </View>
  );
  return (
    <View style={{ gap: 10 }}>
      {slot('s', <ScrubCard onDone={() => done('s')} />)}
      {slot('h', <HoldCard onDone={() => done('h')} />, 90)}
    </View>
  );
}

/* ---------- 06 Morph ---------- */

function Morph() {
  const { refA, refB, styleA, styleB, phase, morphing, morph } = useDissolveMorph();
  return (
    <View style={st.profile}>
      <Image source={P.pond} style={st.avatar} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={st.gTitle}>Hannera studio</Text>
        <Text style={st.gSub}>morph · tap the button</Text>
      </View>
      <Pressable onPress={() => !morphing && morph({ duration: 1100, reverse: phase === 'b', haptics: true })} style={st.slot}>
        <View style={[StyleSheet.absoluteFill, st.slotInner, styleA]}>
          <View ref={refA} collapsable={false} style={st.follow}>
            <Text style={st.followText}>Follow</Text>
          </View>
        </View>
        <View style={[StyleSheet.absoluteFill, st.slotInner, styleB]}>
          <View ref={refB} collapsable={false} style={st.following}>
            <Text style={st.followingText}>Following</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

/* ---------- 07 Cascade ---------- */

const NOTES = [
  { app: 'Messages', text: 'Léa: the direction is up', img: P.pond },
  { app: 'Calendar', text: 'Design review in 10 minutes', img: P.lake },
  { app: 'Hannera', text: 'Your order is paid', img: P.tuscany },
  { app: 'Photos', text: 'Lisbon, 3 years ago', img: P.valley },
];

function Cascade() {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [cleared, setCleared] = useState(false);
  const [k, setK] = useState(0);
  const rows = useRef<number[]>([]);
  const clear = async () => {
    if (dissolving || cleared) return;
    await dissolve({ preset: 'dust', field: 'cascade', rows: rows.current, duration: 1800 });
    setCleared(true);
    setTimeout(() => {
      reset();
      setCleared(false);
      setK((x) => x + 1);
    }, 1800);
  };
  return (
    <View style={st.thread}>
      <View style={st.cascadeHead}>
        <Text style={st.gTitle}>Notification Center</Text>
        <Pressable onPress={clear} hitSlop={8}>
          <Text style={st.clear}>Clear all</Text>
        </Pressable>
      </View>
      <View style={{ minHeight: 4 * 64 }}>
        {cleared ? null : (
          <Animated.View key={k} entering={k ? FadeIn.duration(500) : undefined}>
            <View ref={ref} collapsable={false} style={{ gap: 6, opacity: dissolving ? 0 : 1 }}>
              {NOTES.map((n, i) => (
                <View
                  key={n.app}
                  style={st.noteRow}
                  onLayout={(e) => {
                    rows.current[i] = e.nativeEvent.layout.y;
                  }}
                >
                  <Image source={n.img} style={st.noteImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.noteApp}>{n.app.toUpperCase()}</Text>
                    <Text style={st.noteText}>{n.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/* ---------- screen ---------- */

export default function Gallery() {
  const { width } = useWindowDimensions();
  const col = (width - 32 - 10) / 2;
  const mailW = width - 56;
  const bin = useRef<View>(null);
  const [binCount, setBinCount] = useState(0);
  const bump = useSharedValue(1);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const arrive = () => {
    setBinCount((c) => c + 1);
    bump.value = withSequence(withTiming(1.2, { duration: 120 }), withTiming(1, { duration: 320, easing: calm }));
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 64 }}>
      <View style={st.pad}>
        <Text style={st.lead}>Every effect of the library on real content: {VARIANTS.length} variants, exits and entrances, tap and gestures.</Text>
        <PlaygroundButton />

        <Header index="01" title="Bento" note="Tap a card. snap and shatter start where your finger lands." />
        <View style={st.row}>
          <View style={{ width: col }}>
            <Bento height={250} img={P.aqueduct} icon="checkmark.shield" title="Full rights" body="The design, the copy and every file are yours." preset="shatter" />
          </View>
          <View style={{ width: col }}>
            <Bento height={250} img={P.lake} icon="trophy" title="On time or refunded" body="Miss the date and you get your money back." preset="snap" />
          </View>
        </View>
        <View style={[st.row, { marginTop: 10 }]}>
          <View style={{ width: col }}>
            <Bento height={250} img={P.pines} icon="arrow.uturn.backward" title="Full refund" body="Change your mind before delivery." preset="sand" />
          </View>
          <View style={{ width: col }}>
            <Bento height={250} img={P.tuscany} icon="lock.open" title="Source files" body="The Figma file, or the pull request." preset="dust" />
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Bento height={200} img={P.valley} icon="sparkles" title="One studio, every screen" body="Brand, product and code, shipped by the same hands." preset="ember" />
        </View>

        <Header
          index="02"
          title="Inbox"
          note="Swipe through, tap to archive. The first one flies into the bin."
          right={
            <Animated.View style={bumpStyle}>
              <Bin binRef={bin} count={binCount} />
            </Animated.View>
          }
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={mailW + 10} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {MAILS.map((m) => (
          <MailCard key={m.tag} mail={m} width={mailW} bin={bin} onArrive={arrive} />
        ))}
      </ScrollView>

      <View style={st.pad}>
        <Header index="03" title="Thread" note="Send to watch messages arrive. Long press to unsend." />
        <Thread />

        <Header index="04" title="Arrivals" note="New content assembling into place." />
        <Arrivals />

        <Header index="05" title="Gestures" note="Driven by your finger: scrub, and hold to destroy." />
        <Gestures />

        <Header index="06" title="Morph" note="One view rearranges into another." />
        <Morph />

        <Header index="07" title="Cascade" note="A whole list leaves in a wave." />
        <Cascade />

        <View style={{ height: 28 }} />
        <PlaygroundButton />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pad: { paddingHorizontal: 16 },
  lead: { fontSize: 15, lineHeight: 22, color: C.text, paddingTop: 12, marginBottom: 14 },
  pg: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.dark, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  pgText: { flex: 1, color: 'white', fontSize: 15, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 34, paddingBottom: 14, gap: 12 },
  index: { fontFamily: mono, fontSize: 11, color: C.muted },
  h2: { fontSize: 22, fontWeight: '600', color: C.ink, letterSpacing: -0.4, marginTop: 4 },
  note: { fontSize: 14, lineHeight: 19, color: C.text, marginTop: 3 },
  row: { flexDirection: 'row', gap: 10 },

  tag: { fontFamily: mono, fontSize: 10, overflow: 'hidden', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  tagDark: { color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.14)' },
  tagLight: { color: C.text, backgroundColor: C.surface },
  chips: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  chipOn: { backgroundColor: C.dark, borderColor: C.dark },
  chipText: { fontSize: 13, color: C.ink, fontWeight: '500' },

  bento: { flex: 1, borderRadius: 22, overflow: 'hidden', padding: 16, backgroundColor: '#1C1C1C' },
  bentoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bentoTitle: { color: 'white', fontSize: 22, lineHeight: 26, fontWeight: '400', letterSpacing: -0.5 },
  bentoBody: { color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 18, marginTop: 6 },

  bin: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E4572E', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: mono, fontSize: 10, color: 'white' },
  plus: { position: 'absolute', top: -18, alignSelf: 'center', fontFamily: mono, fontSize: 12, fontWeight: '600', color: '#E4572E' },

  mail: { borderRadius: 22, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 30 },
  mailInner: { backgroundColor: 'white', borderRadius: 16, padding: 18 },
  mailTagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mailDot: { width: 7, height: 7, borderRadius: 4 },
  mailTag: { fontFamily: mono, fontSize: 11, color: C.ink, letterSpacing: 0.6 },
  mailTitle: { fontSize: 24, fontWeight: '600', color: C.ink, letterSpacing: -0.6, marginTop: 14 },
  mailBody: { fontSize: 14, lineHeight: 20, color: C.text, marginTop: 6, minHeight: 60 },
  mailCta: { alignSelf: 'flex-start', backgroundColor: C.dark, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  mailCtaText: { color: 'white', fontSize: 14, fontWeight: '600' },

  thread: { gap: 6, backgroundColor: C.surface, borderRadius: 22, padding: 12 },
  them: { backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  themName: { fontSize: 12, fontWeight: '600', color: '#E4572E', marginBottom: 2 },
  themText: { fontSize: 16, lineHeight: 21, color: C.ink },
  album: { flexDirection: 'row', gap: 3, borderRadius: 20, overflow: 'hidden' },
  albumImg: { width: 118, height: 150 },
  me: { backgroundColor: '#3D7BFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  meText: { fontSize: 16, lineHeight: 21, color: 'white' },
  photoMsg: { width: 240, backgroundColor: '#3D7BFF', borderRadius: 20, padding: 4, paddingBottom: 0 },
  photoImg: { width: '100%', height: 170, borderRadius: 17, marginBottom: 8 },
  meta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', alignSelf: 'flex-end', paddingHorizontal: 10, paddingBottom: 8, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, backgroundColor: 'white', borderRadius: 99, paddingLeft: 16, padding: 5 },
  placeholder: { flex: 1, fontSize: 15, color: C.muted },
  send: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3D7BFF', alignItems: 'center', justifyContent: 'center' },

  arrivals: { gap: 8, backgroundColor: C.surface, borderRadius: 22, padding: 12, minHeight: 120, justifyContent: 'center' },
  empty: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center' },
  arrival: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 18, padding: 8, paddingRight: 14 },
  arrivalImg: { width: 52, height: 52, borderRadius: 12 },
  arrivalTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  arrivalSub: { fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 2 },

  gCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 18, padding: 8, paddingRight: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  gImg: { width: 54, height: 54, borderRadius: 12 },
  gTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  gSub: { fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 2 },
  track: { height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: C.dark },

  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 22, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  slot: { width: 112, height: 38 },
  slotInner: { alignItems: 'flex-end', justifyContent: 'center' },
  follow: { backgroundColor: C.dark, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 9 },
  followText: { color: 'white', fontSize: 14, fontWeight: '600' },
  following: { backgroundColor: 'white', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  followingText: { color: C.ink, fontSize: 14, fontWeight: '600' },

  cascadeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 4 },
  clear: { fontSize: 14, fontWeight: '600', color: '#3D7BFF' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', borderRadius: 16, padding: 8 },
  noteImg: { width: 42, height: 42, borderRadius: 10 },
  noteApp: { fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: 0.4 },
  noteText: { fontSize: 14, color: C.ink, marginTop: 1 },
});
