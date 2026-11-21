# Melt

**Melt** is one of the 16 effects of dissolve, an animation library for React Native. Melts down in drips, like wax under a lamp. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Melt (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'melt',
  grain: 3,
  duration: 1500,
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'melt'`. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. Drips need time: 1500 to 2500 reads best. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` drips up and solidifies into the view. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |

## Best practices

- Use it for playful or seasonal removals: weather alerts, ice, wax, expiring offers.
- Give it room below the view and 1500 to 2500 ms, drips merge and pinch off as they fall.
- Avoid it on small chips, the gooey layer needs some height to form drips.
- Colorful, flat views melt best, fine text blurs into the liquid.
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

Previous: [Peel](https://dissolve.rselmi.com/effects/peel/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/melt/
