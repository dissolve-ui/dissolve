import { MorphButton } from '@registry/morph-button';
import { View } from '@registry/tw';

/** A pay button that folds into a loader, then opens back up as done. */
export default function MorphButtonDemo() {
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <MorphButton label="Pay $42" doneLabel="Paid" onPress={() => new Promise((r) => setTimeout(r, 1400))} />
    </View>
  );
}
