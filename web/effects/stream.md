# Stream

**Stream** is one of the 16 effects of dissolve, an animation library for React Native. The view flies into a target, like a file dropped in the trash. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Stream (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'stream',
  grain: 3.5,
  duration: 1500,
  to: binRef,
  onArrive: () => bumpBadge(),
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'stream'`. |
| `to` | `RefObject<View> \| Box` | `tab bar` | Target the grains fly into: a ref (measured on the fly) or a window rect. Without it, the bottom center of the window. |
| `onArrive` | `() => void` | `none` | Called when most grains reach the target. Bump a badge or a counter here. |
| `grain` | `number` | `3.5` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Overrides the default order (closest grains to the target leave first). |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` pours out of the target to form the view. With `useAppear` pass `from: sourceRef`. |
| `haptics` | `boolean` | `true` | Ticks as grains leave, one soft impact on arrival. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |

## Best practices

- Use it to show where something went: a file into a folder, an item into the cart, a mail into the archive.
- Pass a ref as `to` and bump a badge in `onArrive`, the arrival is the payoff.
- Avoid targets hidden under other views, grains fly in a straight overlay above everything.
- Pair it with `direction: 'in'` and `from` to restore an item from the same place.
- Reduced motion is handled by the provider: the effect is skipped and the promise resolves at once, so keep your state update after the `await`.

## Install

Install the package and its peers, then wrap the app once in `<DissolveProvider>`, above the navigator.

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

app/_layout.tsx:

```tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from 'dissolve-ui';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <Stack />
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
```

Previous: [Shatter](https://dissolve.rselmi.com/effects/shatter/) · Next: [Gather](https://dissolve.rselmi.com/effects/gather/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/stream/
