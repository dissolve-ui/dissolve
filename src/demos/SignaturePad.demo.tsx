import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { SignaturePad, type SignaturePadHandle } from '../dissolve/components/SignaturePad';
import { C, mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Courier handoff sheet: the parcel, the signing pad, then the signed proof of delivery.
 */
export default function SignaturePadDemo() {
  const pad = useRef<SignaturePadHandle>(null);
  const [signed, setSigned] = useState(false);
  const [proof, setProof] = useState<{ uri: string; ratio: number; at: string } | null>(null);

  const confirm = () => {
    const out = pad.current?.save();
    if (!out) return;
    const now = new Date();
    const at = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setProof({ uri: `data:image/png;base64,${out.base64}`, ratio: out.width / out.height, at });
  };

  return (
    <View style={st.sheet}>
      <View style={st.parcel}>
        <View style={st.icon}>
          <SymbolView name="shippingbox.fill" size={18} tintColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Order #4821</Text>
          <Text style={st.meta}>2 PARCELS · 3.4 KG · DOOR 2B</Text>
        </View>
        <Text style={st.eta}>On time</Text>
      </View>

      {proof ? (
        <Animated.View key="proof" entering={FadeIn.duration(360).easing(CALM)} style={st.proof}>
          <Image source={{ uri: proof.uri }} style={{ width: '100%', aspectRatio: proof.ratio }} contentFit="contain" />
          <View style={st.proofRow}>
            <View style={st.dot} />
            <Text style={st.meta}>DELIVERED {proof.at} · SIGNED</Text>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="pad" exiting={FadeOut.duration(200)}>
          <Text style={st.h}>Sign to confirm delivery</Text>
          <SignaturePad ref={pad} onChange={setSigned} placeholder="Sign with your finger" height={190} style={st.pad} />
          <Text style={st.legal}>By signing you confirm the parcels arrived in good condition.</Text>
        </Animated.View>
      )}

      {proof ? (
        <Pressable
          onPress={() => {
            setProof(null);
            setSigned(false);
          }}
          style={({ pressed }) => [st.ghost, pressed && { opacity: 0.6 }]}
        >
          <Text style={st.ghostText}>Sign again</Text>
        </Pressable>
      ) : (
        <Pressable disabled={!signed} onPress={confirm} style={({ pressed }) => [st.primary, !signed && { opacity: 0.3 }, pressed && { opacity: 0.8 }]}>
          <Text style={st.primaryText}>Confirm delivery</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  sheet: { backgroundColor: C.surface, borderRadius: 24, padding: 16, gap: 14 },
  parcel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  meta: { fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 3, letterSpacing: 0.3 },
  eta: { fontSize: 13, fontWeight: '600', color: '#34C759' },
  h: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 8, marginLeft: 4 },
  pad: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  legal: { fontSize: 12, color: C.muted, marginTop: 8, marginHorizontal: 4, lineHeight: 17 },
  proof: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 10 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34C759', marginTop: 3 },
  primary: { height: 52, borderRadius: 26, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  ghost: { height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  ghostText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
});
