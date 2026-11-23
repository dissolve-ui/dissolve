# BeforeAfter

**BeforeAfter** is an animated before after component for React Native and React, from the dissolve library. Before / after image comparison with a draggable divider and haptic ticks.

Compare two versions of an image. Drag the round handle, or anywhere on the frame, or tap to send the divider there. The before layer is clipped to the left of the divider without relayout, and the pills fade as the divider reaches them.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add before-after --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/before-after.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add before-after --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/before-after.json
```

## Usage

BeforeAfter.tsx (React Native):

```tsx
import { Image } from 'expo-image';
import { BeforeAfter } from '@/components/dissolve/before-after';

<BeforeAfter
  height={320}
  initial={0.42}
  afterLabel="Vivid"
  renderBefore={({ width, height }) => <Image source={raw} style={{ width, height }} />}
  renderAfter={({ width, height }) => <Image source={edited} style={{ width, height }} />}
/>
```

BeforeAfter.tsx (React):

```tsx
import { BeforeAfter } from '@/components/dissolve/before-after';

<BeforeAfter
  height={320}
  initial={0.42}
  afterLabel="Vivid"
  renderBefore={({ width, height }) => <img src={raw} style={{ width, height }} />}
  renderAfter={({ width, height }) => <img src={edited} style={{ width, height }} />}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `before / after` | `ReactNode` |  | The two versions, left and right of the divider. |
| `renderBefore / renderAfter` | `(size) => ReactNode` |  | Render props given the frame size, for images that need explicit dimensions. |
| `initial` | `number` | `0.5` | Initial divider position, 0 (all after) to 1 (all before). |
| `height` | `number` | `320` | Frame height. |
| `beforeLabel` | `string` | `'Before'` | Left pill. |
| `afterLabel` | `string` | `'After'` | Right pill. |
| `labels` | `boolean` | `true` | Shows the two pills. |
| `onChange` | `(value: number) => void` |  | Divider position (0..1) when a drag or a tap settles. |
| `haptics` | `boolean` | `true` | A tick at the middle, a light impact at both edges. |
| `className` | `string` | `'rounded-[20px] bg-dissolve-surface-2'` | Frame: radius, placeholder background, margins. |
| `handleClassName` | `string` |  | Round handle. |
| `dividerClassName` | `string` |  | Divider line. |
| `pillClassName` | `string` |  | Before and After pills. |
| `pillTextClassName` | `string` | `'text-[12px] font-semibold text-white'` | Pill labels. |

## Source

- React Native: [registry/before-after.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/before-after.tsx)
- React: [registry/web/before-after.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/before-after.tsx) and [registry/web/before-after.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/before-after.core.ts)

Previous: [CardStack](https://dissolve.rselmi.com/components/card-stack/) · Next: [ThinkingOrb](https://dissolve.rselmi.com/components/thinking-orb/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/before-after/
