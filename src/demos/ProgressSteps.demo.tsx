import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { ProgressSteps } from '@registry/progress-steps';
import { Pressable, Text, View } from '@registry/tw';

const STEPS = ['Account', 'Profile', 'Payment', 'Done'];

/** A checkout flow: Back and Next move the current step, a done step can be pressed to go back. */
export default function ProgressStepsDemo() {
  const [step, setStep] = useState(1);
  const [small, setSmall] = useState(2);
  return (
    <View style={st.root}>
      <ProgressSteps steps={STEPS} current={step} onStepPress={(i) => i < step && setStep(i)} />
      <View style={st.buttons}>
        <Pressable onPress={() => setStep((s) => Math.max(0, s - 1))} className="bg-dissolve-surface" style={st.button}>
          <Text className="text-dissolve-foreground" style={st.text}>
            Back
          </Text>
        </Pressable>
        <Pressable onPress={() => setStep((s) => Math.min(STEPS.length, s + 1))} className="bg-dissolve-primary" style={st.button}>
          <Text className="text-dissolve-primary-foreground" style={st.text}>
            {step >= STEPS.length - 1 ? 'Finish' : 'Next'}
          </Text>
        </Pressable>
      </View>
      <ProgressSteps steps={6} current={small} size="sm" onStepPress={setSmall} className="w-[260px] self-center" />
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 32, paddingVertical: 48, paddingHorizontal: 4 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  button: { height: 44, minWidth: 110, paddingHorizontal: 20, borderRadius: 22, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '600' },
});
