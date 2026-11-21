# SlideToConfirm

**SlideToConfirm** is an animated slide to confirm component for React Native and React, from the dissolve library. Slide to pay or confirm, shimmer label, loader, done state.

Slide to pay or confirm, like Apple Pay or power off. A light shimmer runs across the label, the track fills behind the knob, and past the threshold it locks, loads, then confirms.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add slide-to-confirm --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/slide-to-confirm.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add slide-to-confirm --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/slide-to-confirm.json
```

## Usage

SlideToConfirm.tsx (React Native):

```tsx
import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';

<SlideToConfirm
  label="Slide to pay 42 €"
  doneLabel="Paid"
  onConfirm={() => pay(order)} // the knob shows a loader until the promise settles
/>
```

SlideToConfirm.tsx (React):

```tsx
import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';

<SlideToConfirm
  label="Slide to pay 42 €"
  doneLabel="Paid"
  onConfirm={() => pay(order)} // the knob shows a loader until the promise settles
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | `required` | Label on the track, with a shimmer running across it. |
| `onConfirm` | `() => Promise \| void` | `required` | Runs once the knob reaches the end. The knob shows a loader until the promise settles; a rejection goes back to idle. |
| `doneLabel` | `string` | `'Done'` | Label once confirmed. |
| `height` | `number` | `60` | Track height. The knob is 10 points smaller. |
| `threshold` | `number` | `0.88` | Fraction of the track to reach before release confirms. A flick past halfway confirms too. |
| `resetAfter` | `number` | `1600` | Time on the done state before the slider resets, ms. 0 stays done. |
| `haptics` | `boolean` | `true` | Medium impact on lock, success when done. |
| `className` | `string` | `'rounded-full bg-dissolve-surface'` | Track: background, radius, margins. Fill, label and done state read the primary, muted and success tokens. |
| `knobClassName` | `string` | `'rounded-full shadow-md'` | Knob: shadow, extra layout. Its color is animated from the primary token. |

## Source

- React Native: [registry/slide-to-confirm.tsx](https://github.com/rs-4/dissolve/blob/main/registry/slide-to-confirm.tsx)
- React: [registry/web/slide-to-confirm.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/slide-to-confirm.tsx) and [registry/web/slide-to-confirm.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/slide-to-confirm.core.ts)

Previous: [GooeyMenu](https://dissolve.rselmi.com/components/gooey-menu/) · Next: [OTPInput](https://dissolve.rselmi.com/components/otp-input/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/slide-to-confirm/
