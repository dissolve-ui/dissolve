import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from '@/dissolve';
import { C } from '@/ui';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerLargeTitleEnabled: false,
            headerShadowVisible: false,
            headerLargeTitleShadowVisible: false,
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.ink,
            contentStyle: { backgroundColor: C.bg },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'dissolve' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="chat" options={{ title: 'Chat' }} />
          <Stack.Screen name="photos" options={{ title: 'Photos' }} />
          <Stack.Screen name="tasks" options={{ title: 'Tasks' }} />
          <Stack.Screen name="playground" options={{ title: 'Playground' }} />
        </Stack>
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
