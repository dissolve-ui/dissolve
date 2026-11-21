# Ember

**Ember** is one of the 16 effects of dissolve, an animation library for React Native. Burns from the edge and rises as sparks tinted by the view itself. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Ember (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'ember',
  grain: 3,
  duration: 1500,
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'ember'`. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Where the burn starts. Without it it burns from the left, bottom first. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays it backwards as an entrance. Use `DissolveIn` or `useAppear` for that. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |
| `rows` | `number[]` | `none` | Row boundaries in local Y used by `field: 'cascade'`: rows leave one after the other. |

## Best practices

- Use it for permanent removals with a bit of drama: burn after reading, discard a draft, revoke a key.
- Sparks are tinted by the dominant color of the view, colorful views glow best.
- Do not use it for routine actions like marking as read, it reads as destructive.
- Keep haptics on: the sweep ticks match the burn front.
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

Previous: [Sand](https://dissolve.rselmi.com/effects/sand/) · Next: [Pixel](https://dissolve.rselmi.com/effects/pixel/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/ember/
