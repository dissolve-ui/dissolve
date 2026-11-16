import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from '@registry/tw';
import { DEMOS } from '@/demos';
import { Pager } from '@/pager';
import { InstallCommand } from '@/ui';

/** One component: a centered stage, a one line hint, the install command, Previous / Next. */
export default function DemoScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const demo = DEMOS.find((d) => d.slug === name);
  if (!demo) return <Stack.Screen options={{ title: 'Not found' }} />;
  const Demo = demo.Component;

  const footer = (
    <View style={st.footer}>
      <Text className="text-dissolve-muted" style={st.hint}>
        {demo.note}
      </Text>
      <InstallCommand slug={demo.slug} />
      <Pager href={`/demo/${demo.slug}`} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: demo.title }} />
      {demo.scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={st.stage}>
            <Demo />
          </View>
          {footer}
        </ScrollView>
      ) : (
        <View style={st.full}>
          <View style={st.fullStage}>
            <Demo />
          </View>
          <View style={{ paddingHorizontal: 16 }}>{footer}</View>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  stage: { flexGrow: 1, minHeight: 420, justifyContent: 'center', paddingVertical: 16 },
  full: { flex: 1, paddingBottom: 34 },
  fullStage: { flex: 1, padding: 16 },
  footer: { gap: 12, paddingTop: 16 },
  hint: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 12 },
});
