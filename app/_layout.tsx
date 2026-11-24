import '../src/global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DissolveProvider } from '@/dissolve';
import { ToastProvider } from '@registry/toast';
import { useToken } from '@registry/tw';
import { ThemeButton } from '@/theme';

// Deep links (/demo/x, /effect/x) still get home underneath, so back always returns there.
export const unstable_settings = { anchor: 'index' };

const headerRight = () => <ThemeButton />;

export default function Layout() {
  const insets = useSafeAreaInsets();
  const bg = useToken('background');
  const ink = useToken('foreground');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <ToastProvider top={insets.top + 6}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerLargeTitleShadowVisible: false,
              headerStyle: { backgroundColor: bg },
              headerTintColor: ink,
              headerTitleStyle: { color: ink },
              contentStyle: { backgroundColor: bg },
              headerBackButtonDisplayMode: 'minimal',
              headerRight,
            }}
          >
            <Stack.Screen name="index" options={{ title: 'dissolve', headerLargeTitle: true, headerTransparent: true, headerLargeStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="demo/[name]" options={{ title: '' }} />
            <Stack.Screen name="effect/[name]" options={{ title: '' }} />
            <Stack.Screen name="playground" options={{ title: 'All options' }} />
          </Stack>
        </ToastProvider>
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
