import { useState } from 'react';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RulerPicker } from '@registry/ruler-picker';
import { Pressable, Text, View } from '@registry/tw';
import { mono } from '../ui';

const STEPS = 5;
const CURRENT = 2;

/** Fitness onboarding step: pick your weight on the ruler, then continue. */
export default function RulerPickerDemo() {
  const [kg, setKg] = useState(72.5);
  const [saved, setSaved] = useState(false);

  return (
    <View className="bg-dissolve-surface" style={st.card}>
      <View style={st.progress}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} className={i <= CURRENT ? 'bg-dissolve-primary' : 'bg-dissolve-surface-2'} style={st.dash} />
        ))}
      </View>
      <Text className="text-dissolve-muted" style={st.kicker}>
        STEP {CURRENT + 1} OF {STEPS}
      </Text>
      <Text className="text-dissolve-foreground" style={st.title}>
        What’s your weight?
      </Text>
      <Text className="text-dissolve-muted" style={st.body}>
        We use it to tune your daily calorie and training targets.
      </Text>

      <RulerPicker
        value={kg}
        onChange={(v) => {
          setKg(v);
          setSaved(false);
        }}
        min={30}
        max={200}
        step={0.1}
        unit="kg"
        className="mt-[28px]"
      />

      <Text className="text-dissolve-muted" style={st.hint}>
        You can change this later in Settings.
      </Text>

      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSaved(true);
        }}
        className="mt-[18px] items-center rounded-full bg-dissolve-primary py-[15px] active:opacity-75"
      >
        <Text className="text-dissolve-primary-foreground" style={st.cta}>
          {saved ? `Saved ${kg.toFixed(1)} kg` : 'Continue'}
        </Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, paddingVertical: 20, paddingHorizontal: 18 },
  progress: { flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 4, borderRadius: 2 },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4, marginTop: 18 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 6 },
  body: { fontSize: 15, lineHeight: 21, marginTop: 6 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 14 },
  cta: { fontSize: 16, fontWeight: '600' },
});
