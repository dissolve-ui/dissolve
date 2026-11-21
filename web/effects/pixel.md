# Pixel

**Pixel** is one of the 16 effects of dissolve, an animation library for React Native. A blocky, stepped collapse for retro and game UIs. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Pixel (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'pixel',
  grain: 7,
  duration: 1500,
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'pixel'`. |
| `grain` | `number` | `7` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Where the collapse starts. Without it blocks fall in random order. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays it backwards as an entrance. Use `DissolveIn` or `useAppear` for that. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |
| `rows` | `number[]` | `none` | Row boundaries in local Y used by `field: 'cascade'`: rows leave one after the other. |

## Best practices

- Made for games, retro skins and playful UIs: level cleared, enemy down, coin collected.
- Use a larger grain (6 to 10 pt). The stepped motion needs visible blocks.
- Avoid it on photos in a calm interface, it reads as a rendering bug there.
- Short durations (800 to 1200 ms) suit the stepped timing.
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

Previous: [Ember](https://dissolve.rselmi.com/effects/ember/) · Next: [Vortex](https://dissolve.rselmi.com/effects/vortex/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/pixel/
