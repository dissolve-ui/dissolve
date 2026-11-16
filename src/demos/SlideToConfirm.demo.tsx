import { SlideToConfirm } from '@registry/slide-to-confirm';
import { View } from '@registry/tw';

/** Slide the knob to the end to pay. */
export default function SlideToConfirmDemo() {
  return (
    <View>
      <SlideToConfirm label="Slide to pay 42 €" doneLabel="Paid" onConfirm={() => new Promise((r) => setTimeout(r, 1200))} />
    </View>
  );
}
