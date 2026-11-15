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
          <Stack.Screen name="stream" options={{ title: 'Stream' }} />
          <Stack.Screen name="appear" options={{ title: 'Entrances' }} />
          <Stack.Screen name="fling" options={{ title: 'Fling and snap' }} />
          <Stack.Screen name="gestures" options={{ title: 'Scrub and hold' }} />
          <Stack.Screen name="cascade" options={{ title: 'Cascade' }} />
          <Stack.Screen name="screen" options={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
          <Stack.Screen name="shatter" options={{ title: 'Shatter' }} />
          <Stack.Screen name="pile" options={{ title: 'Pile' }} />
          <Stack.Screen name="morph" options={{ title: 'Morph' }} />
          <Stack.Screen name="gallery" options={{ title: 'Gallery' }} />
          <Stack.Screen name="glass" options={{ headerShown: false }} />
        </Stack>
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
