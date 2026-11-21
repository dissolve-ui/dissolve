# SweepTransition

**SweepTransition** is an animated sweep transition component for React Native and React, from the dissolve library. A crisp liquid band sweeps across a view and leaves the new state behind it.

Wrap any view and call run() with your state change. The current view is captured, the new state mounts under it, and a 28 pt band sweeps across the capture, bending what it passes with a light refraction, a hint of RGB split and a 1 pt accent rim. Vertical, horizontal, or a circle growing from a touch point. cancel() sends the band back and restores the old state. No blur.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add sweep-transition --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/sweep-transition.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add sweep-transition --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/sweep-transition.json
```

## Usage

SweepTransition.tsx (React Native):

```tsx
import { useRef } from 'react';
import { SweepTransition, type SweepTransitionHandle } from '@/components/dissolve/sweep-transition';

const sweep = useRef<SweepTransitionHandle>(null);

<SweepTransition ref={sweep} mode="vertical" className="rounded-3xl">
  <PlanCard plan={plan} />
</SweepTransition>

sweep.current?.run(() => setPlan('pro'), { revert: () => setPlan('free') });
```

SweepTransition.tsx (React):

```tsx
import { useRef } from 'react';
import { SweepTransition, type SweepTransitionHandle } from '@/components/dissolve/sweep-transition';

const sweep = useRef<SweepTransitionHandle>(null);

<SweepTransition ref={sweep} mode="vertical" className="rounded-3xl">
  <PlanCard plan={plan} />
</SweepTransition>

sweep.current?.run(() => setPlan('pro'), { revert: () => setPlan('free') });
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'vertical' \| 'horizontal' \| 'radial'` | `'vertical'` | Bottom to top, left to right, or a circle from the origin. |
| `duration` | `number` | `720` | Sweep length in ms, calm curve. |
| `bandWidth` | `number` | `28` | Width of the refractive band. |
| `ref.run` | `(apply, { origin?, mode?, revert? }) => Promise<void>` |  | Captures the view, runs apply under the capture, then sweeps it away. origin is the radial center in local points. |
| `ref.cancel` | `() => void` |  | Sends the front back in 300 ms, then calls the run revert to put the old state back. |
| `ref.running` | `() => boolean` |  | True while a sweep is on screen. |
| `haptics` | `boolean` | `true` | Light at start, soft when the front passes half. |
| `className` | `string` |  | Classes of the wrapper. |
| `children` | `ReactNode` | `required` | The view that changes. |

## Source

- React Native: [registry/sweep-transition.tsx](https://github.com/rs-4/dissolve/blob/main/registry/sweep-transition.tsx)
- React: [registry/web/sweep-transition.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/sweep-transition.tsx) and [registry/web/sweep-transition.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/sweep-transition.core.ts)

Previous: [ImageReveal](https://dissolve.rselmi.com/components/image-reveal/) · Next: [UploadTile](https://dissolve.rselmi.com/components/upload-tile/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/sweep-transition/
