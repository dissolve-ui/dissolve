import { StyleSheet } from 'react-native';
import { MagnifyDock, dockIcon } from '@registry/magnify-dock';
import { View } from '@registry/tw';

const APPS = (['finder', 'mail', 'music', 'photos', 'notes', 'calendar', 'settings'] as const).map((key) => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
  icon: dockIcon(key),
}));

/** A plain screen with the dock at the bottom: press and slide along it, lift to launch. */
export default function MagnifyDockDemo() {
  return (
    <View style={st.root}>
      <MagnifyDock items={APPS} size={38} magnification={1.5} gap={5} defaultRunning={['finder']} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', paddingBottom: 8 },
});
