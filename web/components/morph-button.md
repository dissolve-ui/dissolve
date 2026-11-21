# MorphButton

**MorphButton** is an animated morph button component for React Native and React, from the dissolve library. Dynamic Island style pill that folds into a loader, then opens as the done state.

A button that morphs like the Dynamic Island: the pill folds into a round loader, then opens back up as the done state. Crisp shape, a critically damped spring, content that cross-fades and scales.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add morph-button --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/morph-button.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add morph-button --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/morph-button.json
```

## Usage

MorphButton.tsx (React Native):

```tsx
import { MorphButton } from '@/components/dissolve/morph-button';

<MorphButton
  label="Pay 42 €"
  doneLabel="Paid"
  onPress={() => pay(order)} // stays loading until the promise settles
/>
```

MorphButton.tsx (React):

```tsx
import { MorphButton } from '@/components/dissolve/morph-button';

<MorphButton
  label="Pay 42 €"
  doneLabel="Paid"
  onPress={() => pay(order)} // stays loading until the promise settles
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | `required` | Idle label. |
| `doneLabel` | `string` | `'Done'` | Label next to the check once the promise resolves. |
| `onPress` | `() => Promise \| void` | `required` | Runs on press. The button stays in its loading state until the promise settles; a rejection goes back to idle. |
| `height` | `number` | `52` | Pill height, also the loader diameter. |
| `resetAfter` | `number` | `1800` | Time spent on the done state before going back, ms. 0 stays done. |
| `haptics` | `boolean` | `true` | Light impact on press, success when done. |
| `className` | `string` |  | Outer box (width, margins). The pill is centered inside it. |
| `labelClassName` | `string` | `'text-base font-semibold text-dissolve-primary-foreground'` | Label and done label: size, weight, color. The pill reads the primary and success tokens. |

## Source

- React Native: [registry/morph-button.tsx](https://github.com/rs-4/dissolve/blob/main/registry/morph-button.tsx)
- React: [registry/web/morph-button.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/morph-button.tsx) and [registry/web/morph-button.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/morph-button.core.ts)

Previous: [LikeButton](https://dissolve.rselmi.com/components/like-button/) · Next: [SplitButton](https://dissolve.rselmi.com/components/split-button/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/morph-button/
