import { SplitButton } from '@registry/split-button';
import { useToast } from '@registry/toast';
import { View } from '@registry/tw';

/** A destructive button that divides into Cancel and Confirm like a drop of liquid metal. */
export default function SplitButtonDemo() {
  const toast = useToast();
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <SplitButton label="Delete project" confirmLabel="Delete" onConfirm={() => toast.show({ title: 'Project deleted', tone: 'error' })} />
    </View>
  );
}
