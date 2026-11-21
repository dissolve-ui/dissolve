# Peel

**Peel** is one of the 16 effects of dissolve, an animation library for React Native. Peels off from the corner like a sticker, then flies away. It runs with `useDissolvePeel` from `dissolve-ui`.

## Usage

Peel (React Native):

```tsx
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useDissolvePeel } from 'dissolve-ui';

const { ref, gesture, style } = useDissolvePeel({
  threshold: 0.4,
  grain: 3,
  duration: 700,
  onCommit: () => remove(sticker.id),
});

<GestureDetector gesture={gesture}>
  <Animated.View ref={ref} style={[styles.sticker, style]} />
</GestureDetector>
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `threshold` | `number` | `0.4` | useDissolvePeel: share of the view diagonal the corner must travel to commit. |
| `velocity` | `number` | `900` | useDissolvePeel: release speed in pt/s that commits regardless of distance. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `700` | Full effect length in ms. useDissolvePeel: fly off after a commit. With `dissolve()` it is the whole peel. |
| `haptics` | `boolean` | `true` | A tick when the paper lifts, a light impact on commit. |
| `onCommit` | `() => void` | `none` | Called once the sticker is gone. |
| `onCancel` | `() => void` | `none` | Called when released early and the sticker is back in place. |
| `preset` | `VariantName` | `'dust'` | Auto mode: `dissolve({ preset: 'peel' })` peels from the bottom right corner. |
| `direction` | `'out' \| 'in'` | `'out'` | Auto mode: `'in'` sticks the sticker back on. |

## Best practices

- Made for stickers, badges and coupons: anything that should feel like paper.
- Prefer `useDissolvePeel`: the fold follows the finger from any corner or edge.
- Keep the default threshold (0.4) so a short pull springs back.
- Avoid it on views with a transparent background, the back of the sticker is a plain paper color.
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

Previous: [Morph](https://dissolve.rselmi.com/effects/morph/) · Next: [Melt](https://dissolve.rselmi.com/effects/melt/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/peel/
