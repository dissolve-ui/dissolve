# QuantityStepper

**QuantityStepper** is an animated quantity stepper component for React Native and React, from the dissolve library. Minus and plus with rolling digits and an accelerating long press; at 1 it turns into a trash.

A minus and plus stepper with rolling digits. A tap steps once; hold a button and it repeats from 380 ms down to 60 ms over 1.5 s, the digits rolling like an odometer and always in sync. At the minimum the minus turns into a trash, armed once its morph is done so a fast double tap never removes the row; tap it and the whole row falls away as sand. At the maximum the pill shakes.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add quantity-stepper --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/quantity-stepper.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add quantity-stepper --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/quantity-stepper.json
```

## Usage

QuantityStepper.tsx (React Native):

```tsx
import { QuantityStepper } from '@/components/dissolve/quantity-stepper';

const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <QuantityStepper
    value={qty}
    onChange={setQty}
    onRemove={async () => {
      await dissolve({ preset: 'sand' });
      removeFromCart(item.id);
    }}
  />
</View>
```

QuantityStepper.tsx (React):

```tsx
import { QuantityStepper } from '@/components/dissolve/quantity-stepper';

<QuantityStepper
  value={qty}
  onChange={setQty}
  onRemove={() => removeFromCart(item.id)}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | `required` | The quantity. Digits roll whenever it changes. |
| `onChange` | `(value: number) => void` | `required` | Called on every step: once per tap (on release), then at 380 ms on hold, accelerating to 60 ms. |
| `min` | `number` | `1` | Lowest value. With onRemove the minus turns into a trash there. |
| `max` | `number` | `99` | Highest value. Going past it shakes the pill. |
| `onRemove` | `() => void` |  | When set, the minus becomes a trash at the minimum and calls this on tap (ignored for 320 ms after reaching it). Dissolve your row here. |
| `size` | `'sm' \| 'md'` | `'md'` | Pill height, 30 or 36. |
| `haptics` | `boolean` | `true` | A tick per step, medium on remove, warning at max. |
| `className` | `string` |  | Pill classes (background, radius, margins...). |
| `textClassName` | `string` |  | Count classes (weight, color...). |

## Source

- React Native: [registry/quantity-stepper.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/quantity-stepper.tsx)
- React: [registry/web/quantity-stepper.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/quantity-stepper.tsx) and [registry/web/quantity-stepper.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/quantity-stepper.core.ts)

Previous: [TaskCheck](https://dissolve.rselmi.com/components/task-check/) · Next: [RulerPicker](https://dissolve.rselmi.com/components/ruler-picker/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/quantity-stepper/
