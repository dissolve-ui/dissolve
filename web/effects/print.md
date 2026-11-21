# Print

**Print** is one of the 16 effects of dissolve, an animation library for React Native. The view is printed in, line by line. It runs with `useAppear` from `dissolve-ui`.

## Usage

Print (React Native):

```tsx
import { DissolveIn } from 'dissolve-ui';

<DissolveIn
  preset="print"
  grain={3}
  duration={1200}
>
  <Card />
</DissolveIn>
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'gather'` | Set it to `'print'`. Any exit preset also works as an entrance. |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `duration` | `number` | `1200` | Full effect length in ms. Entrances default to 1200. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Where the view starts to assemble. Without it the variant uses its own order. |
| `delay` | `number` | `0` | Wait before starting, in ms. Use `index * 40` to stagger a list. |
| `play` | `boolean` | `true` | `DissolveIn` only. Plays on mount; flip it from false to true to play later. |
| `onAppear` | `() => void` | `none` | `DissolveIn` only. Called once the real view is visible. |
| `haptics` | `boolean` | `false` | Entrances are quiet by default, lists can stagger many of them. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |

## Best practices

- Made for documents that are produced: receipts, tickets, invoices, generated reports.
- Tall views read best, the head prints line by line from the top.
- Avoid it on short pills or chips, there are too few lines to see the print.
- Fresh ink starts with a cool tint and settles to the real colors, so it works on light and dark themes.
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

Previous: [Rain](https://dissolve.rselmi.com/effects/rain/) · Next: [Snap](https://dissolve.rselmi.com/effects/snap/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/print/
