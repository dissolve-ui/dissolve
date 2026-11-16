import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { CardStack } from '@registry/card-stack';
import { Animated as Tw, Text as TwText, View as TwView, useToken } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

type Card = {
  id: string;
  kind: 'metal' | 'painting' | 'gradient' | 'transit';
  title: string;
  activity: { label: string; sub: string; amount: string }[];
};

const CARDS: Card[] = [
  {
    id: 'metal',
    kind: 'metal',
    title: 'Black',
    activity: [
      { label: 'Septime', sub: 'Paris · Yesterday', amount: '−$148.00' },
      { label: 'Air France', sub: 'CDG → LIS · Mon', amount: '−$312.40' },
      { label: 'Cashback', sub: 'October', amount: '+$21.60' },
    ],
  },
  {
    id: 'painting',
    kind: 'painting',
    title: 'Atelier',
    activity: [
      { label: 'Musée d’Orsay', sub: 'Membership · Today', amount: '−$65.00' },
      { label: 'Shakespeare & Co', sub: 'Books · Sat', amount: '−$32.90' },
      { label: 'Café Kitsuné', sub: 'Coffee · Sat', amount: '−$4.80' },
    ],
  },
  {
    id: 'gradient',
    kind: 'gradient',
    title: 'Savings',
    activity: [
      { label: 'Round ups', sub: 'This week', amount: '+$6.42' },
      { label: 'Monthly transfer', sub: 'Nov 1', amount: '+$400.00' },
      { label: 'Interest', sub: '3.1% · October', amount: '+$18.07' },
    ],
  },
  {
    id: 'transit',
    kind: 'transit',
    title: 'Metro Pass',
    activity: [
      { label: 'Bastille', sub: 'Line 1 · 08:47', amount: 'Tap in' },
      { label: 'Châtelet', sub: 'Line 4 · Yesterday', amount: 'Tap in' },
      { label: 'Weekly renewal', sub: 'Mon', amount: '−$30.75' },
    ],
  },
];

function Chip() {
  return (
    <LinearGradient colors={['#E9D9A6', '#B99A55', '#E3CF94']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.chip}>
      <View style={[cs.chipLine, { top: 10 }]} />
      <View style={[cs.chipLine, { top: 19 }]} />
      <View style={cs.chipMid} />
    </LinearGradient>
  );
}

function Network({ light = true }: { light?: boolean }) {
  const a = light ? 'rgba(255,255,255,0.85)' : 'rgba(28,28,30,0.85)';
  const b = light ? 'rgba(255,255,255,0.45)' : 'rgba(28,28,30,0.45)';
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={[cs.ring, { backgroundColor: a }]} />
      <View style={[cs.ring, { backgroundColor: b, marginLeft: -9 }]} />
    </View>
  );
}

function Strip({ title, tag, color, right }: { title: string; tag: string; color: string; right?: ReactNode }) {
  return (
    <View style={cs.strip}>
      <View>
        <Text style={[cs.tag, { color, opacity: 0.6 }]}>{tag}</Text>
        <Text style={[cs.title, { color }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

function CardFace({ card }: { card: Card }) {
  if (card.kind === 'metal') {
    return (
      <LinearGradient colors={['#3A3A3E', '#18181A', '#2C2C2F', '#121214']} locations={[0, 0.38, 0.62, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.face}>
        {/* Brushed sheen */}
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.09)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
        <Strip title="Black" tag="METAL · DEBIT" color="#F2F2F2" right={<Network />} />
        <View style={cs.bottom}>
          <Chip />
          <View style={cs.row}>
            <Text style={[cs.number, { color: '#E6E6E6' }]}>••••  4021</Text>
            <Text style={[cs.small, { color: 'rgba(255,255,255,0.55)' }]}>A. MARTIN</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }
  if (card.kind === 'painting') {
    return (
      <View style={cs.face}>
        <Image source={require('../../assets/paintings/lake.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" transition={0} />
        <LinearGradient colors={['rgba(255,250,240,0.55)', 'rgba(255,250,240,0)']} locations={[0, 0.4]} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
        <Strip title="Atelier" tag="MEMBERS · CREDIT" color="#1C1C1E" right={<Network light={false} />} />
        <View style={cs.bottom}>
          <Chip />
          <View style={cs.row}>
            <Text style={[cs.number, { color: '#FFFFFF' }]}>••••  7730</Text>
            <Text style={[cs.small, { color: 'rgba(255,255,255,0.8)' }]}>LAKE, 1802</Text>
          </View>
        </View>
      </View>
    );
  }
  if (card.kind === 'gradient') {
    return (
      <LinearGradient colors={['#FF8A5B', '#FF3D7F', '#6A5CFF']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.face}>
        <Strip title="Savings" tag="POCKET" color="#FFFFFF" right={<SymbolView name="sparkles" size={20} tintColor="#FFFFFF" weight="semibold" />} />
        <View style={cs.bottom}>
          <Text style={cs.small2}>BALANCE</Text>
          <Text style={cs.balance}>$12,480.36</Text>
          <View style={cs.track}>
            <View style={[cs.fill, { width: '62%' }]} />
          </View>
          <Text style={[cs.small, { color: 'rgba(255,255,255,0.8)', marginTop: 6 }]}>62 % OF LISBON 2027</Text>
        </View>
      </LinearGradient>
    );
  }
  return (
    <View style={[cs.face, { backgroundColor: '#F7F4EC' }]}>
      <View style={cs.transitBand} />
      <Strip title="Metro Pass" tag="TRANSIT · ZONES 1-3" color="#FFFFFF" right={<SymbolView name="tram.fill" size={20} tintColor="#FFFFFF" />} />
      <View style={cs.bottom}>
        <View style={cs.row}>
          <View>
            <Text style={[cs.small2, { color: '#8E8E93' }]}>WEEKLY</Text>
            <Text style={[cs.balance, { color: '#1C1C1E', fontSize: 22 }]}>Nov 10 → 16</Text>
          </View>
          <View style={cs.lines}>
            {[
              ['1', '#F2C230'],
              ['4', '#B03C8D'],
              ['14', '#62259D'],
            ].map(([l, c]) => (
              <View key={l} style={[cs.line, { backgroundColor: c }]}>
                <Text style={cs.lineText}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={cs.dash} />
        <View style={cs.row}>
          <Text style={[cs.small, { color: '#8E8E93' }]}>HOLD NEAR READER</Text>
          <Text style={[cs.small, { color: '#1C1C1E' }]}>Nº 0042 1187</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * A Wallet with four cards. Tap one to bring it forward, swipe it sideways to flip through,
 * drag it down to put it back.
 */
export default function CardStackDemo() {
  const [focus, setFocus] = useState<number | null>(null);
  const card = focus === null ? null : CARDS[focus];
  const ink = useToken('foreground');

  return (
    <TwView className="bg-dissolve-background" style={st.screen}>
      <View style={st.header}>
        <TwText className="text-dissolve-foreground" style={st.h1}>Wallet</TwText>
        <TwView className="bg-dissolve-surface" style={st.plus}>
          <SymbolView name="plus" size={16} tintColor={ink} weight="semibold" />
        </TwView>
      </View>

      <CardStack items={CARDS} keyExtractor={(c) => c.id} renderCard={(c) => <CardFace card={c} />} peek={58} onFocus={setFocus} />

      <View style={st.below}>
        {card ? (
          <Tw.View key={card.id} entering={FadeIn.duration(360).delay(160).easing(CALM)} exiting={FadeOut.duration(160)} className="bg-dissolve-surface" style={st.panel}>
            <TwText className="text-dissolve-muted" style={st.label}>LATEST · {card.title.toUpperCase()}</TwText>
            {card.activity.map((a, i) => (
              <TwView key={a.label} className={i > 0 ? 'border-dissolve-border' : undefined} style={[st.tx, i > 0 && st.txLine]}>
                <View style={{ flex: 1 }}>
                  <TwText className="text-dissolve-foreground" style={st.txTitle}>{a.label}</TwText>
                  <TwText className="text-dissolve-muted" style={st.txSub}>{a.sub}</TwText>
                </View>
                <TwText className={a.amount.startsWith('+') ? 'text-dissolve-success' : 'text-dissolve-foreground'} style={st.amount}>
                  {a.amount}
                </TwText>
              </TwView>
            ))}
          </Tw.View>
        ) : null}
      </View>
    </TwView>
  );
}

const cs = StyleSheet.create({
  face: { flex: 1, overflow: 'hidden' },
  strip: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { fontFamily: mono, fontSize: 9.5, letterSpacing: 0.8 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, marginTop: 1 },
  bottom: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  number: { fontFamily: mono, fontSize: 15, letterSpacing: 1, marginTop: 14 },
  small: { fontFamily: mono, fontSize: 10, letterSpacing: 0.8 },
  small2: { fontFamily: mono, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.75)' },
  balance: { fontSize: 28, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.6, fontVariant: ['tabular-nums'], marginTop: 2 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginTop: 12, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  chip: { width: 40, height: 30, borderRadius: 6, overflow: 'hidden' },
  chipLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(90,70,30,0.35)' },
  chipMid: { position: 'absolute', left: 14, top: 0, bottom: 0, width: 12, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(90,70,30,0.35)' },
  ring: { width: 22, height: 22, borderRadius: 11 },
  transitBand: { position: 'absolute', left: 0, right: 0, top: 0, height: 58, backgroundColor: '#1F5F4A' },
  lines: { flexDirection: 'row', gap: 6 },
  line: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  lineText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dash: { height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,28,30,0.18)', marginVertical: 12 },
});

const st = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  h1: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  plus: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  below: { minHeight: 200, marginTop: 14 },
  panel: { borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4, marginBottom: 6 },
  tx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  txLine: { borderTopWidth: StyleSheet.hairlineWidth },
  txTitle: { fontSize: 15, fontWeight: '500' },
  txSub: { fontSize: 13, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  hint: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 8, letterSpacing: 0.2 },
});
