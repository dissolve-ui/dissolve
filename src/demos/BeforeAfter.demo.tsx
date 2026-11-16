import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BeforeAfter } from '@registry/before-after';
import { Text, View as TwView } from '@registry/tw';
import { mono } from '../ui';

const PAINTING = require('../../assets/paintings/tuscany.jpg');

type Look = 'Vivid' | 'Warm' | 'Cool' | 'Noir';
const LOOKS: Look[] = ['Vivid', 'Warm', 'Cool', 'Noir'];

/** Each look is the same painting with a blended layer on top (mixBlendMode, no image filter needed). */
function Grade({ look }: { look: Look }) {
  const fill: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
  if (look === 'Noir')
    return (
      <>
        <View style={[fill, { backgroundColor: '#808080', mixBlendMode: 'saturation' }]} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']} style={[fill, { mixBlendMode: 'multiply' }]} />
      </>
    );
  if (look === 'Warm') return <LinearGradient colors={['rgba(255,176,92,0.75)', 'rgba(214,92,52,0.55)']} style={[fill, { mixBlendMode: 'soft-light' }]} />;
  if (look === 'Cool') return <LinearGradient colors={['rgba(90,160,255,0.7)', 'rgba(20,70,110,0.6)']} style={[fill, { mixBlendMode: 'soft-light' }]} />;
  return (
    <>
      <LinearGradient colors={['rgba(255,214,140,0.9)', 'rgba(30,120,140,0.8)']} style={[fill, { mixBlendMode: 'overlay' }]} />
      <View style={[fill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
    </>
  );
}

/**
 * Photo editor: compare the original painting with the selected look, switch looks below.
 */
export default function BeforeAfterDemo() {
  const [look, setLook] = useState<Look>('Vivid');
  return (
    <TwView className="bg-dissolve-surface" style={st.stage}>
      <View style={st.top}>
        <Text className="text-dissolve-muted" style={st.label}>EDIT · TUSCANY.JPG</Text>
        <Text className="text-dissolve-muted" style={st.label}>{look.toUpperCase()}</Text>
      </View>

      <BeforeAfter
        height={360}
        className="rounded-[20px]"
        initial={0.42}
        afterLabel={look}
        renderBefore={({ width, height }) => <Image source={PAINTING} style={{ width, height }} contentFit="cover" />}
        renderAfter={({ width, height }) => (
          <View style={{ width, height }}>
            <Image source={PAINTING} style={{ width, height }} contentFit="cover" />
            <Grade look={look} />
          </View>
        )}
      />

      <View style={st.looks}>
        {LOOKS.map((l) => {
          const active = l === look;
          return (
            <Pressable key={l} onPress={() => setLook(l)} style={({ pressed }) => [st.look, pressed && { opacity: 0.7 }]}>
              <TwView className={active ? 'border-dissolve-foreground' : 'border-transparent'} style={st.thumb}>
                <Image source={PAINTING} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Grade look={l} />
              </TwView>
              <Text className={active ? 'text-dissolve-foreground' : 'text-dissolve-muted'} style={st.lookText}>{l}</Text>
            </Pressable>
          );
        })}
      </View>
    </TwView>
  );
}

const st = StyleSheet.create({
  stage: { borderRadius: 24, padding: 14, gap: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4 },
  looks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  look: { alignItems: 'center', gap: 6 },
  thumb: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', borderWidth: 2 },
  lookText: { fontFamily: mono, fontSize: 11, letterSpacing: 0.2 },
});
