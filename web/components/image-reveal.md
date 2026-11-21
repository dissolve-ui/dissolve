# ImageReveal

**ImageReveal** is an animated image reveal component for React Native and React, from the dissolve library. Image generation loader: a thinking mosaic that resolves coarse to fine, then settles in grains.

A loader for generated images. While pending, a 12 by 12 mosaic pulses with a slow diagonal wave. When the image arrives, it resolves from 8 to 128 cells in 1.4 s on a smoothstep, one even step per doubling, each cell switching to the real color past its own random threshold, then the finest mosaic crossfades into the sharp image in 180 ms. On error, the mosaic freezes, tints red and leaves as dust. The mosaic is one shader, no view per cell.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add image-reveal --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/image-reveal.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add image-reveal --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/image-reveal.json
```

## Usage

ImageReveal.tsx (React Native):

```tsx
import { ImageReveal } from '@/components/dissolve/image-reveal';

<ImageReveal
  src={result?.uri}
  status={failed ? 'error' : result ? 'ready' : 'pending'}
  onRevealed={() => setShowActions(true)}
  onDismissed={retry}
  className="rounded-[20px]"
/>
```

ImageReveal.tsx (React):

```tsx
import { ImageReveal } from '@/components/dissolve/image-reveal';

<ImageReveal
  src={result?.uri}
  status={failed ? 'error' : result ? 'ready' : 'pending'}
  onRevealed={() => setShowActions(true)}
  onDismissed={retry}
  className="rounded-[20px]"
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `DataSourceParam` |  | The generated image (require(...) or a uri). Reveals once loaded and status is ready. |
| `status` | `'pending' \| 'ready' \| 'error'` | `src ? 'ready' : 'pending'` | Pending shows the thinking mosaic, error sends it away as dust. |
| `duration` | `number` | `1400` | Coarse to fine resolve, in ms. A 180 ms crossfade to the sharp image follows. |
| `cells` | `number` | `160` | Finest mosaic across the width before the sharp image (8, 16, 32, 64, 128). |
| `aspectRatio` | `number` | `1` | Width / height of the frame. |
| `onRevealed` | `() => void` |  | Called once the sharp image is fully shown. |
| `onDismissed` | `() => void` |  | Error: called once the mosaic has left as dust. |
| `haptics` | `boolean` | `true` | A tick at each resolution doubling, success at the end. |
| `className` | `string` |  | Classes of the frame: size, radius. |

## Source

- React Native: [registry/image-reveal.tsx](https://github.com/rs-4/dissolve/blob/main/registry/image-reveal.tsx)
- React: [registry/web/image-reveal.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/image-reveal.tsx) and [registry/web/image-reveal.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/image-reveal.core.ts)

Previous: [ThinkingOrb](https://dissolve.rselmi.com/components/thinking-orb/) · Next: [SweepTransition](https://dissolve.rselmi.com/components/sweep-transition/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/image-reveal/
