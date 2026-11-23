# Toggle

**Toggle** is an animated toggle component for React Native and React, from the dissolve library. iOS switch whose thumb breaks into grains, flows to the other end of the track and reassembles while the track fills.

An iOS style switch whose thumb is made of grains. At rest it is the familiar white thumb on a capsule track. Flip it and the thumb breaks into grains, leading edge first: they flow to the other end of the track on a slight arc, shrinking mid flight, and reassemble into the thumb there in about 380 ms, while the track fills with the on color behind them. Tap it, or swipe the thumb toward the other side, with a selection tick on every flip. On iOS the thumb, the track layers and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the thumb simply slides.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add toggle --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/toggle.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add toggle --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/toggle.json
```

## Usage

Toggle.tsx (React Native):

```tsx
import { Toggle } from '@/components/dissolve/toggle';

const [wifi, setWifi] = useState(true);
<Toggle value={wifi} onValueChange={setWifi} accessibilityLabel="Wi-Fi" />

// Uncontrolled, smaller, another on color.
<Toggle defaultValue size="sm" onColor="#0A84FF" />
```

Toggle.tsx (React):

```tsx
import { Toggle } from '@/components/dissolve/toggle';

const [wifi, setWifi] = useState(true);
<Toggle value={wifi} onValueChange={setWifi} accessibilityLabel="Wi-Fi" />

// Uncontrolled, smaller, another on color.
<Toggle defaultValue size="sm" onColor="#0A84FF" />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `boolean` |  | On or off (controlled). |
| `defaultValue` | `boolean` | `false` | Initial state when uncontrolled. |
| `onValueChange` | `(value: boolean) => void` |  | Called with the new state on every flip. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Track size: 42 x 26, 51 x 31 (the iOS switch) or 60 x 36 pt. |
| `haptics` | `boolean` | `true` | Selection tick on every flip. |
| `disabled` | `boolean` | `false` | No flip, the switch shows at half opacity. |
| `onColor` | `string` | `success token` | Track fill when on. |
| `offColor` | `string` | `foreground at low alpha` | Track fill when off. |
| `thumbColor` | `string` | `white` | Thumb and grain color. |
| `accessibilityLabel` | `string` |  | Read by screen readers. |
| `className` | `string` |  | Outer classes (margins, self alignment...). The size comes from the size prop. |

## Source

- React Native: [registry/toggle.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/toggle.tsx)
- React: [registry/web/toggle.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/toggle.tsx) and [registry/web/toggle.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/toggle.core.ts)

Previous: [SegmentedControl](https://dissolve.rselmi.com/components/segmented-control/) · Next: [ProgressSteps](https://dissolve.rselmi.com/components/progress-steps/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/toggle/
