/**
 * Preview of the Paywall block, for the dissolve app (src/demos) and the recording of its video.
 * Not part of the installed item. Opens the paywall as a full screen modal on mount.
 */
import { useState } from 'react';
import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable, Text, View } from '@registry/tw';
import { Paywall } from './paywall';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function PaywallDemo() {
  const [open, setOpen] = useState(true);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Pressable onPress={() => setOpen(true)} className="bg-dissolve-primary" style={{ height: 44, paddingHorizontal: 22, borderRadius: 22, justifyContent: 'center' }}>
        <Text className="text-dissolve-primary-foreground" style={{ fontSize: 16, fontWeight: '600' }}>
          Open paywall
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Paywall
            title="Unlock dissolve Pro"
            subtitle="Every screen, every effect, and the ones we ship next."
            features={['Full screen blocks: paywall, onboarding, sign in', 'Pro components, new ones every month', 'One command install, for you and your agent', 'Cancel anytime, keep what you installed']}
            plans={[
              { id: 'pro', title: 'Pro', description: 'For one maker', price: { month: 9.99, year: 59.99 }, badge: 'Most popular' },
              { id: 'team', title: 'Team', description: 'Up to 5 seats', price: { month: 24.99, year: 199.99 } },
            ]}
            format={{ prefix: '$' }}
            note="7 days free, then billed. Cancel anytime."
            onSubscribe={async () => {
              await wait(1200);
            }}
            onRestore={() => wait(800)}
            onClose={() => setOpen(false)}
            links={[
              { label: 'Terms', onPress: () => {} },
              { label: 'Privacy', onPress: () => {} },
            ]}
          />
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
