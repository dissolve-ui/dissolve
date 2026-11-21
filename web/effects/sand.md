# Sand

**Sand** is one of the 16 effects of dissolve, an animation library for React Native. Grains pour straight down with gravity and slide out of frame. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Sand (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'sand',
  grain: 2.5,
  duration: 1500,
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'sand'`. |
| `grain` | `number` | `2.5` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Where the pour starts. Without it columns fall left to right. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays it backwards as an entrance. Use `DissolveIn` or `useAppear` for that. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |
| `rows` | `number[]` | `none` | Row boundaries in local Y used by `field: 'cascade'`: rows leave one after the other. |

## Best practices

- Fits deletes with weight: photos, files, anything that should fall rather than blow away.
- Keep 2 to 3 pt grain on photos so the image still reads as it pours.
- Avoid it near the bottom edge of the screen, the pour needs room below the view.
- Use 1200 to 1800 ms. Shorter feels like a glitch, longer blocks the next action.
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

Previous: [Dust](https://dissolve.rselmi.com/effects/dust/) · Next: [Ember](https://dissolve.rselmi.com/effects/ember/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/sand/
