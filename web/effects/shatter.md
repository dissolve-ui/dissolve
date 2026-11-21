# Shatter

**Shatter** is one of the 16 effects of dissolve, an animation library for React Native. Glass shards break away from the point of impact. It runs with `useDissolve` from `dissolve-ui`.

## Usage

Shatter (React Native):

```tsx
import { useDissolve } from 'dissolve-ui';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
  preset: 'shatter',
  duration: 1500,
  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
  n: [220],
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `VariantName` | `'dust'` | Set it to `'shatter'`. |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | `'center'` | Impact point. Pass the touch point (local coords) so the cracks start under the finger. |
| `n` | `[shards]` | `[220]` | Target shard count, clamped to 60..400. More shards read as tempered glass. |
| `velocity` | `{ x, y }` | `none` | Adds 30% of a swipe velocity (pt/s) to every shard launch. |
| `duration` | `number` | `1500` | Full effect length in ms. Shards fall with real gravity, so short durations keep them on screen. |
| `direction` | `'out' \| 'in'` | `'out'` | `'in'` plays the timeline backwards: the shards fly back and lock into the exact view. |
| `haptics` | `boolean` | `true` | One rigid impact on the break, then light ticks while shards fly. |

## Best practices

- Use it for hard failures and irreversible breaks: wrong passcode, declined payment, broken link.
- Pass the touch point as origin, cracks starting under the finger sell the impact.
- Keep 120 to 260 shards on cards. 400 is for full width media.
- Do not use it for frequent actions, the flash and the gravity get tiring.
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

Previous: [Vortex](https://dissolve.rselmi.com/effects/vortex/) · Next: [Stream](https://dissolve.rselmi.com/effects/stream/) · [All effects](https://dissolve.rselmi.com/effects/)

Source: https://dissolve.rselmi.com/effects/shatter/
