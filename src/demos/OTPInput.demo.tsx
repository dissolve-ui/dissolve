import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { OTPInput } from '@registry/otp-input';
import { Animated, Pressable, Text, View, useToken } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const CORRECT = '123456';
const RESEND_AFTER = 30;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Phone verification step: six boxes, a resend timer, the right code is 123456. */
export default function OTPInputDemo({ autoFocus = false }: { autoFocus?: boolean }) {
  const ink = useToken('foreground');
  const success = useToken('success');
  const [round, setRound] = useState(0);
  const [verified, setVerified] = useState(false);
  const [left, setLeft] = useState(RESEND_AFTER);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const verify = async (code: string) => {
    await wait(900);
    const ok = code === CORRECT;
    if (ok) setTimeout(() => setVerified(true), 500);
    return ok;
  };

  const restart = () => {
    setVerified(false);
    setLeft(RESEND_AFTER);
    setRound((r) => r + 1);
  };

  return (
    <View className="bg-dissolve-surface" style={st.card}>
      <View className="bg-dissolve-background" style={st.icon}>
        <SymbolView name="message.fill" size={20} tintColor={ink} />
      </View>
      <Text className="text-dissolve-foreground" style={st.title}>Enter the code</Text>
      <Text className="text-dissolve-muted" style={st.body}>
        We sent it to <Text className="text-dissolve-foreground" style={st.phone}>+33 6 •• •• •• 42</Text>
      </Text>

      <OTPInput key={round} autoFocus={autoFocus} onComplete={verify} boxClassName="bg-dissolve-background" className="mt-5" />

      <View style={st.footer}>
        {verified ? (
          <Animated.View key="ok" entering={FadeIn.duration(260).easing(CALM)} exiting={FadeOut.duration(160)} style={st.row}>
            <SymbolView name="checkmark.seal.fill" size={16} tintColor={success} />
            <Text className="text-dissolve-success" style={st.ok}>Number verified</Text>
            <Pressable onPress={restart} hitSlop={10}>
              <Text className="text-dissolve-foreground" style={st.link}>Start over</Text>
            </Pressable>
          </Animated.View>
        ) : left > 0 ? (
          <Animated.Text key="wait" entering={FadeIn.duration(200)} className="text-dissolve-muted" style={st.muted}>
            Resend code in 0:{String(left).padStart(2, '0')}
          </Animated.Text>
        ) : (
          <Animated.View key="resend" entering={FadeIn.duration(200)} style={st.row}>
            <Text className="text-dissolve-muted" style={st.muted}>Didn’t get it?</Text>
            <Pressable onPress={restart} hitSlop={10} className="active:opacity-60">
              <Text className="text-dissolve-foreground" style={st.link}>Resend code</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
      <Text className="text-dissolve-muted" style={st.hint}>hint: {CORRECT}, anything else fails</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, padding: 20, paddingTop: 22 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  phone: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  otp: { marginTop: 22 },
  footer: { height: 22, marginTop: 18, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { fontSize: 14, fontVariant: ['tabular-nums'] },
  link: { fontSize: 14, fontWeight: '600' },
  ok: { fontSize: 14, fontWeight: '600', marginRight: 'auto' },
  hint: { fontFamily: mono, fontSize: 11, marginTop: 14, letterSpacing: 0.2 },
});
