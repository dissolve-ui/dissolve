import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { DEMOS } from '@/demos';

export default function DemoScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const demo = DEMOS.find((d) => d.slug === name);
  if (!demo) return null;
  const Demo = demo.Component;
  return (
    <>
      <Stack.Screen options={{ title: demo.title }} />
      {demo.scroll ? (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Demo />
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <Demo />
        </View>
      )}
    </>
  );
}
