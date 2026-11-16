import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Easing, FadeIn } from 'react-native-reanimated';
import { ImageReveal, type ImageRevealStatus } from '@registry/image-reveal';
import { Animated, Pressable, Text, View, useToken } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

const RESULTS = [
  { prompt: 'Cypress alley at golden hour, oil on canvas', src: require('../../assets/paintings/cypress.jpg') },
  { prompt: 'Quiet alpine lake, morning mist, impressionist', src: require('../../assets/paintings/lake.jpg') },
  { prompt: 'Roman aqueduct over a green valley, warm light', src: require('../../assets/paintings/aqueduct.jpg') },
  { prompt: 'Tuscan hills with a lone villa, late summer', src: require('../../assets/paintings/tuscany.jpg') },
];

/**
 * Image generation card: Generate shows the thinking mosaic, then the painting resolves coarse
 * to fine. "Fail" makes the next run error out, the mosaic leaves as dust.
 */
export default function ImageRevealDemo() {
  const onPrimary = useToken('primary-foreground');
  const muted = useToken('muted');
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<ImageRevealStatus>('pending');
  const [failNext, setFailNext] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const generate = (next = (index + 1) % RESULTS.length) => {
    if (timer.current) clearTimeout(timer.current);
    setIndex(next);
    setFailed(false);
    setStatus('pending');
    setBusy(true);
    timer.current = setTimeout(() => {
      if (failNext) {
        setFailNext(false);
        setStatus('error');
      } else setStatus('ready');
    }, 2200);
  };

  // First run on mount.
  useEffect(() => {
    generate(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = RESULTS[index];
  return (
    <View className="bg-dissolve-surface" style={st.card}>
      <View style={st.head}>
        <Text className="text-dissolve-muted" style={st.kicker}>
          IMAGE · 1024 × 1024
        </Text>
        <Text className={status === 'error' ? 'text-dissolve-danger' : 'text-dissolve-muted'} style={st.kicker}>
          {status === 'pending' ? 'GENERATING' : status === 'error' ? 'FAILED' : busy ? 'RENDERING' : 'DONE'}
        </Text>
      </View>

      <View style={st.frame}>
        <ImageReveal
          src={status === 'ready' ? item.src : undefined}
          status={status}
          onRevealed={() => setBusy(false)}
          onDismissed={() => {
            setBusy(false);
            setFailed(true);
          }}
        />
        {failed ? (
          <Animated.View entering={FadeIn.duration(320).easing(CALM)} style={st.failed}>
            <SymbolView name="exclamationmark.triangle" size={22} tintColor={muted} />
            <Text className="text-dissolve-muted" style={st.failedText}>
              The model timed out. Nothing was charged.
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <Text className="text-dissolve-foreground" style={st.prompt} numberOfLines={2}>
        {item.prompt}
      </Text>

      <View style={st.row}>
        <Pressable
          onPress={() => setFailNext((f) => !f)}
          className={failNext ? 'border-dissolve-danger bg-dissolve-background active:opacity-70' : 'border-dissolve-border bg-dissolve-background active:opacity-70'}
          style={st.toggle}
        >
          <Text className={failNext ? 'text-dissolve-danger' : 'text-dissolve-muted'} style={st.toggleText}>
            {failNext ? 'Next run fails' : 'Fail next'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => generate()}
          disabled={status === 'pending'}
          className="bg-dissolve-primary active:opacity-70"
          style={[st.generate, status === 'pending' && { opacity: 0.5 }]}
        >
          <SymbolView name="sparkles" size={15} tintColor={onPrimary} />
          <Text className="text-dissolve-primary-foreground" style={st.generateText}>
            {status === 'pending' ? 'Generating' : 'Generate'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 24, padding: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4 },
  frame: { width: '100%' },
  failed: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  failedText: { fontSize: 14, textAlign: 'center' },
  prompt: { fontSize: 16, fontWeight: '500', lineHeight: 22, marginTop: 14, paddingHorizontal: 4, letterSpacing: -0.2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  toggle: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9 },
  toggleText: { fontSize: 13, fontWeight: '500' },
  generate: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  generateText: { fontSize: 15, fontWeight: '600' },
});
