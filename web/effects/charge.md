# Charge

**Charge** is one of the 16 effects of dissolve, an animation library for React Native. Hold to heat the view up, it bursts at full charge. It runs with `useDissolveHold` from `dissolve-ui`.

## Usage

Charge (React Native):

```tsx
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { useDissolveHold } from 'dissolve-ui';

const { ref, pressHandlers, style, charge } = useDissolveHold({
  holdMs: 1200,
  grain: 3,
  duration: 900,
  onCommit: () => remove(item.id),
});

<Pressable {...pressHandlers}>
  <Animated.View ref={ref} style={[styles.card, style]} />
</Pressable>
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `holdMs` | `number` | `1200` | Time to reach full charge. The view shakes, frays and heats on the way. |
| `then` | `VariantName` | `'charge'` | Variant of the final burst. Other variants only get the burst, no heat. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `900` | Full effect length in ms. Length of the final burst. |
| `maxDistance` | `number` | `24` | Finger travel in pt that cancels the hold. |
| `haptics` | `boolean` | `true` | Ticks speed up from every 120 ms to every 30 ms, heavy impact at full charge. |
| `onCommit` | `() => void` | `none` | Called once the burst is over: remove the item here. |
| `onCancel` | `() => void` | `none` | Called when released early, once the view has settled back. |
| `n` | `[push]` | `[1]` | With `dissolve({ preset: 'charge' })`: push multiplier of the burst. |

## Best practices

- Use it to confirm destructive actions without a dialog: delete an account, wipe a project.
- Show the charge (the `charge` shared value) as a ring or a label so users know to keep holding.
- Keep holdMs between 800 and 1600. Shorter triggers by accident, longer feels broken.
- Do not use it for frequent actions, a hold on every delete gets tedious.
- With reduced motion the hold still works, only the burst is skipped.

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

Previous: [Fling](https://dissolve.rselmi.com/effects/fling/) · Next: [Morph](https://dissolve.rselmi.com/effects/morph/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/charge/
