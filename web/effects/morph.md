# Morph

**Morph** is one of the 16 effects of dissolve, an animation library for React Native. View A breaks down and rebuilds itself as view B. It runs with `useDissolveMorph` from `dissolve-ui`.

## Usage

Morph (React Native):

```tsx
import { useDissolveMorph } from 'dissolve-ui';

const { refA, refB, styleA, styleB, morph } = useDissolveMorph();

<View>
  <View style={styleA}><View ref={refA} collapsable={false}>{follow}</View></View>
  <View style={[StyleSheet.absoluteFill, styleB]}><View ref={refB} collapsable={false}>{following}</View></View>
</View>

await morph({ grain: 4, duration: 1100 });                // A becomes B
await morph({ grain: 4, duration: 1100, reverse: true }); // and back
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `refA, refB` | `RefObject<View>` | `none` | The two views. Both stay mounted and laid out, stacked on top of each other. |
| `styleA, styleB` | `ViewStyle` | `none` | Put them on a wrapper of each view: the hidden one sits at 0.01 opacity so it can be captured. |
| `reverse` | `boolean` | `false` | Morph B back into A. |
| `grain` | `number` | `4` | Grain size in points, capped to 3500 grains per view (two atlases per morph). |
| `duration` | `number` | `1500` | Full effect length in ms. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |
| `phase` | `'a' \| 'morphing' \| 'b'` | `'a'` | Returned by the hook. Which view is showing. |

## Best practices

- Use it for state changes of the same element: Follow to Following, Download to Open, Add to In cart.
- Keep both views the same size and stacked, the grains pair by brightness.
- Avoid morphing two very different layouts, it reads as noise rather than a change.
- Grain 3 to 4 pt on buttons, the grain cap is halved because two atlases are drawn.
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

Previous: [Charge](https://dissolve.rselmi.com/effects/charge/) · Next: [Peel](https://dissolve.rselmi.com/effects/peel/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/morph/
