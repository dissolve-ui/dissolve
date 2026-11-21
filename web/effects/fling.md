# Fling

**Fling** is one of the 16 effects of dissolve, an animation library for React Native. Follows the velocity of the swipe that threw it away. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Fling (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'fling',
  grain: 3,
  duration: 1500,
  velocity: { x: 2600, y: -200 },
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'fling'`. |
| `velocity` | `{ x, y }` | `none` | Release velocity of the pan gesture in pt/s (`e.velocityX`, `e.velocityY`). Sets direction and strength. |
| `duration` | `number` | `auto` | Full effect length in ms. Without it, it follows the speed: clamp(1800 - speed * 0.4, 700, 1500). |
| `grain` | `number` | `3` | Grain size in points. Raised automatically past about 6000 grains per burst. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `none` | Overrides the default order (the leading edge of the swipe leaves first). |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays it backwards as an entrance. Use `DissolveIn` or `useAppear` for that. |
| `haptics` | `boolean` | `true` | Soft impact, then a few ticks while the wave sweeps the view. |
| `field` | `'cascade'` | `none` | Replaces the native delay with a diagonal wave, for lists and full screens. |

## Best practices

- Use it at the end of a swipe gesture: dismiss a card, triage a mail, reject a match.
- Pass the release velocity of the pan gesture, slow swipes drift, fast ones tear apart.
- Leave duration out so it follows the speed (700 to 1500 ms).
- Do not fling below about 300 pt/s, spring the card back instead.
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

Previous: [Snap](https://dissolve.rselmi.com/effects/snap/) · Next: [Charge](https://dissolve.rselmi.com/effects/charge/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/fling/
