# Snap

**Snap** is one of the 16 effects of dissolve, an animation library for React Native. Bursts outward from the exact point you touched. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Snap (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'snap',
  grain: 3,
  duration: 1500,
  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
  n: [1],
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'snap'`. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `'center'` | The burst point. Pass the touch point: `{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }`. |
| `n` | `[push]` | `[1]` | Push strength multiplier. 0.6 is a gentle pop, 1.6 a blast. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays it backwards as an entrance. Use `DissolveIn` or `useAppear` for that. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |

## Best practices

- Use it for tap to dismiss: tags, chips, toasts and cards the user taps directly.
- Always pass the touch point as origin, otherwise it bursts from the center.
- Tune the push with `n: [push]`: 0.6 for small chips, 1.6 for hero cards.
- Do not trigger it from a separate button, the burst point would make no sense.
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

Previous: [Print](https://dissolve.rselmi.com/effects/print/) · Next: [Fling](https://dissolve.rselmi.com/effects/fling/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/snap/
