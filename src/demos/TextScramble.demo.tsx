import { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GlossyButton } from '@registry/glossy-button';
import { TextScramble, type TextScrambleHandle } from '@registry/text-scramble';
import { Text, View, useToken } from '@registry/tw';

const FLIGHT = 'AF 1148, Paris to Oslo';
const UPDATES = [
  ['On time', 'GATE B32 / BOARDS 14:05'],
  ['Gate change', 'GATE C14 / BOARDS 14:05'],
  ['Boarding', 'GATE C14 / ZONE 2 NOW'],
  ['Delayed 20 min', 'GATE C14 / BOARDS 14:25'],
];

/** A flight status: Refresh decodes the status and the gate line into the next update, a tap on the status replays it. */
export default function TextScrambleDemo() {
  const [i, setI] = useState(0);
  const heading = useRef<TextScrambleHandle>(null);
  const label = useRef<TextScrambleHandle>(null);
  const primary = useToken('primary');
  const onPrimary = useToken('primary-foreground');
  const replay = () => { heading.current?.scramble(); label.current?.scramble(); };
  return (
    <View style={st.root}>
      <Text className="text-dissolve-muted" style={st.eyebrow}>{FLIGHT}</Text>
      <Pressable onPress={replay} accessibilityRole="button" accessibilityHint="Replays the scramble">
        <TextScramble ref={heading} text={UPDATES[i][0]} duration={800} className="text-dissolve-foreground" style={st.heading} />
      </Pressable>
      <View style={st.gap}>
        <TextScramble ref={label} text={UPDATES[i][1]} monospace duration={1000} className="text-dissolve-muted" style={st.label} />
      </View>
      <View style={st.button}>
        <GlossyButton label="Refresh" size="lg" color={primary} labelColor={onPrimary} onPress={() => setI((n) => (n + 1) % UPDATES.length)} fullWidth />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  eyebrow: { fontSize: 15, lineHeight: 20, marginBottom: 6 },
  heading: { fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -0.4, textAlign: 'center' },
  gap: { marginTop: 12 },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0.8, textAlign: 'center' },
  button: { width: 168, marginTop: 40 },
});
