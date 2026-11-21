# Dust

**Dust** is one of the 16 effects of dissolve, an animation library for React Native. Any view snapshots into grains that drift away on the wind, left edge first. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Dust (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'dust',
  grain: 3,
  duration: 1500,
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'dust'`. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Where the wind starts. Without it grains leave left to right with a slight lift. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays it backwards as an entrance. Use `DissolveIn` or `useAppear` for that. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |
| `rows` | `number[]` | `none` | Row boundaries in local Y used by `field: 'cascade'`: rows leave one after the other. |

## Best practices

- Use it for light, reversible removals: clearing a notification, archiving a row, dismissing a toast.
- Keep grain at 2 to 4 pt on cards and rows. Below 2 pt a large view hits the 6000 grain cap and the grain is raised for you.
- Hide the original with `opacity: dissolving ? 0 : 1` and remove it from state after the `await`.
- Do not chain several dust exits on screen at once, a cascade on one snapshot reads better and costs one burst.
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

Next: [Sand](https://dissolve.rselmi.com/effects/sand/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/dust/
