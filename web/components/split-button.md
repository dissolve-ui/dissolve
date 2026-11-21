# SplitButton

**SplitButton** is an animated split button component for React Native and React, from the dissolve library. Splits in two like a drop of liquid metal, Cancel and Confirm halves.

A button that divides in the middle like a drop of liquid metal: the two halves pull apart, a neck between them thins into a waist, then snaps. Cancel fuses them back. Vector edges, no blur, so it stays crisp.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add split-button --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/split-button.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add split-button --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/split-button.json
```

## Usage

SplitButton.tsx (React Native):

```tsx
import { SplitButton } from '@/components/dissolve/split-button';
import { useToast } from '@/components/dissolve/toast';

const toast = useToast();

<SplitButton
  label="Delete project"
  confirmLabel="Delete"
  onConfirm={() => toast.show({ title: 'Project deleted', tone: 'error' })}
/>
```

SplitButton.tsx (React):

```tsx
import { SplitButton } from '@/components/dissolve/split-button';
import { useToast } from '@/components/dissolve/toast';

const toast = useToast();

<SplitButton
  label="Delete project"
  confirmLabel="Delete"
  onConfirm={() => toast.show({ title: 'Project deleted', tone: 'error' })}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | `required` | Label of the whole button. |
| `cancelLabel` | `string` | `'Cancel'` | Left half once split. |
| `confirmLabel` | `string` | `'Confirm'` | Right half once split. |
| `onConfirm` | `() => void` | `required` | Runs on the right half, then the halves fuse back. |
| `height` | `number` | `52` | Button height. |
| `gap` | `number` | `28` | Space between the two halves once split. The neck snaps at 80 percent of it. |
| `duration` | `number` | `620` | Split duration, ms. |
| `haptics` | `boolean` | `true` | Selection tick on taps, warning on confirm. |
| `className` | `string` |  | Root: margins, width. The drop reads the danger tokens, the Cancel half surface-2. |
| `labelClassName` | `string` | `'text-base font-semibold'` | Every label: size, weight. |
| `cancelLabelClassName` | `string` | `'text-dissolve-foreground'` | Cancel label, its color. |

## Source

- React Native: [registry/split-button.tsx](https://github.com/rs-4/dissolve/blob/main/registry/split-button.tsx)
- React: [registry/web/split-button.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/split-button.tsx) and [registry/web/split-button.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/split-button.core.ts)

Previous: [MorphButton](https://dissolve.rselmi.com/components/morph-button/) · Next: [GooeyMenu](https://dissolve.rselmi.com/components/gooey-menu/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/split-button/
