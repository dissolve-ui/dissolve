import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { SignaturePad, type SignaturePadHandle } from '@registry/signature-pad';
import { Animated, Pressable, Text, View, useToken } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Courier handoff sheet: the parcel, the signing pad, then the signed proof of delivery.
 */
export default function SignaturePadDemo() {
  const onPrimary = useToken('primary-foreground');
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
    <View className="bg-dissolve-surface" style={st.sheet}>
      <View className="bg-dissolve-background" style={st.parcel}>
        <View className="bg-dissolve-primary" style={st.icon}>
          <SymbolView name="shippingbox.fill" size={18} tintColor={onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-dissolve-foreground" style={st.title}>Order #4821</Text>
          <Text className="text-dissolve-muted" style={st.meta}>2 PARCELS · 3.4 KG · DOOR 2B</Text>
        </View>
        <Text className="text-dissolve-success" style={st.eta}>On time</Text>
      </View>

      {proof ? (
        <Animated.View key="proof" entering={FadeIn.duration(360).easing(CALM)} className="bg-dissolve-background" style={st.proof}>
          <Image source={{ uri: proof.uri }} style={{ width: '100%', aspectRatio: proof.ratio }} contentFit="contain" />
          <View className="border-dissolve-border" style={st.proofRow}>
            <View className="bg-dissolve-success" style={st.dot} />
            <Text className="text-dissolve-muted" style={st.meta}>DELIVERED {proof.at} · SIGNED</Text>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="pad" exiting={FadeOut.duration(200)}>
          <Text className="text-dissolve-foreground" style={st.h}>Sign to confirm delivery</Text>
          <SignaturePad ref={pad} onChange={setSigned} placeholder="Sign with your finger" height={190} className="mt-3 bg-dissolve-background" />
          <Text className="text-dissolve-muted" style={st.legal}>By signing you confirm the parcels arrived in good condition.</Text>
        </Animated.View>
      )}

      {proof ? (
        <Pressable
          onPress={() => {
            setProof(null);
            setSigned(false);
          }}
          className="border-dissolve-border bg-dissolve-background active:opacity-60"
          style={st.ghost}
        >
          <Text className="text-dissolve-foreground" style={st.ghostText}>Sign again</Text>
        </Pressable>
      ) : (
        <Pressable disabled={!signed} onPress={confirm} className={signed ? 'bg-dissolve-primary active:opacity-80' : 'bg-dissolve-primary opacity-30'} style={st.primary}>
          <Text className="text-dissolve-primary-foreground" style={st.primaryText}>Confirm delivery</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  sheet: { borderRadius: 24, padding: 16, gap: 14 },
  parcel: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  meta: { fontFamily: mono, fontSize: 11, marginTop: 3, letterSpacing: 0.3 },
  eta: { fontSize: 13, fontWeight: '600' },
  h: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  legal: { fontSize: 12, marginTop: 8, marginHorizontal: 4, lineHeight: 17 },
  proof: { borderRadius: 20, padding: 16, gap: 10 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
  primary: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600' },
  ghost: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  ghostText: { fontSize: 16, fontWeight: '600' },
});
