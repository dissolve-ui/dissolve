# Gather

**Gather** is one of the 16 effects of dissolve, an animation library for React Native. Grains converge from a loose cloud into the view. It runs with `DissolveIn` from `dissolve-ui`.

## Usage

Gather (React Native):

```tsx
import { DissolveIn } from 'dissolve-ui';

<DissolveIn
  preset="gather"
  grain={3}
  duration={1200}
>
  <Card />
</DissolveIn>
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'gather'` | Set it to `'gather'`. Any exit preset also works as an entrance. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1200` | Full effect length in ms. Entrances default to 1200. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Where the view starts to assemble. Without it the variant uses its own order. |
| `delay` | `number` | `0` | Wait before starting, in ms. Use `index * 40` to stagger a list. |
| `play` | `boolean` | `true` | `DissolveIn` only. Plays on mount; flip it from false to true to play later. |
| `onAppear` | `() => void` | `none` | `DissolveIn` only. Called once the real view is visible. |
| `haptics` | `boolean` | `false` | Entrances are quiet by default, lists can stagger many of them. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |

## Best practices

- Use it for arrivals that deserve attention: a new message, a match, an unlocked reward.
- Wrap the new view in `<DissolveIn preset="gather">`, it plays on mount and reveals the real view at the end.
- Do not gather every row of a long list, stagger at most the first five with `delay`.
- Entrances are quiet by default, turn haptics on only for important arrivals.
- With reduced motion the view simply appears.

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

Previous: [Stream](https://dissolve.rselmi.com/effects/stream/) · Next: [Rain](https://dissolve.rselmi.com/effects/rain/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/gather/
