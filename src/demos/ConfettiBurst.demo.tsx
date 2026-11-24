import { useRef, useState, type ComponentRef } from 'react';
import { View as RNView } from 'react-native';
import RA, { FadeIn, FadeOut, SlideInDown, SlideOutUp } from 'react-native-reanimated';
import { Text, View, useToken } from '@registry/tw';
import { GlossyButton } from '@registry/glossy-button';
import { ConfettiBurst, type ConfettiBurstHandle } from '@registry/confetti-burst';

const GOAL = 5;

/** A weekly running goal, one run short: log today's run and a small burst of paper leaves the button. */
export default function ConfettiBurstDemo() {
  const [runs, setRuns] = useState(4);
  const confetti = useRef<ConfettiBurstHandle>(null);
  const button = useRef<ComponentRef<typeof RNView>>(null);
  const primary = useToken('primary');
  const onPrimary = useToken('primary-foreground');
  const fg = useToken('foreground');
  const off = useToken('surface-2');
  const done = runs >= GOAL;
  const press = () => {
    if (done) { setRuns(4); return; }
    setRuns(GOAL);
    confetti.current?.fire({ from: button });
  };
  return (
    <View className="flex-1 items-center bg-dissolve-background" style={{ paddingBottom: 28, paddingHorizontal: 24 }}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-dissolve-muted" style={{ fontSize: 15, lineHeight: 20 }}>This week</Text>
        <View style={{ flexDirection: 'row', marginTop: 6, height: 41, overflow: 'hidden' }} accessible accessibilityLabel={`${runs} of 5 runs`}>
          <RA.View key={runs} entering={SlideInDown.duration(420)} exiting={SlideOutUp.duration(420)}>
            <Text className="text-dissolve-foreground" style={{ fontSize: 34, lineHeight: 41, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{runs}</Text>
          </RA.View>
          <Text className="text-dissolve-foreground" style={{ fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -0.4 }}> of 5 runs</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          {Array.from({ length: GOAL }, (_, i) => (
            <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < runs ? fg : off }} />
          ))}
        </View>
        <RA.View key={done ? 'done' : 'todo'} entering={FadeIn.delay(120).duration(200)} exiting={FadeOut.duration(150)} style={{ marginTop: 18, height: 22 }}>
          <Text className="text-dissolve-muted" style={{ fontSize: 17, lineHeight: 22 }}>{done ? 'Goal reached. See you next week.' : 'One more to reach your goal'}</Text>
        </RA.View>
      </View>
      <RNView ref={button} collapsable={false} style={{ width: 200 }}>
        <GlossyButton label={done ? 'Start a new week' : "Log today's run"} size="lg" color={primary} labelColor={onPrimary} onPress={press} fullWidth />
      </RNView>
      <ConfettiBurst ref={confetti} />
    </View>
  );
}
