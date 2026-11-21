# RulerPicker

**RulerPicker** is an animated ruler picker component for React Native and React, from the dissolve library. Horizontal ruler with momentum, rolling value and a haptic tick per graduation.

A horizontal ruler you drag under a center needle: 1:1 pan, momentum, then a calm snap on the nearest step. The value rolls above it. Graduations near the needle stretch with speed, and a haptic tick lands on every step.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add ruler-picker --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/ruler-picker.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add ruler-picker --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/ruler-picker.json
```

## Usage

RulerPicker.tsx (React Native):

```tsx
import { RulerPicker } from '@/components/dissolve/ruler-picker';

<RulerPicker
  value={kg}
  onChange={setKg}
  min={30}
  max={200}
  step={0.1}
  unit="kg"
/>
```

RulerPicker.tsx (React):

```tsx
import { RulerPicker } from '@/components/dissolve/ruler-picker';

<RulerPicker
  value={kg}
  onChange={setKg}
  min={30}
  max={200}
  step={0.1}
  unit="kg"
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | `required` | Current value. An outside change glides the ruler to it. |
| `onChange` | `(value: number) => void` |  | Called once the ruler is at rest on a new value. |
| `onChanging` | `(value: number) => void` |  | Called on every step crossed while dragging or gliding. |
| `min / max` | `number` | `required` | Bounds. Past them the ruler follows with a 0.3 rubber band. |
| `step` | `number` | `1` | Value between two graduations. |
| `majorEvery` | `number` | `10` | A labelled major graduation every N steps. |
| `unit` | `string` |  | Unit next to the value, e.g. 'kg'. |
| `format` | `(value: number) => string` |  | Formats the labels and the accessibility value. |
| `tickSpacing` | `number` | `10` | Distance between two graduations, pt. |
| `height` | `number` | `76` | Ruler height. |
| `showValue` | `boolean` | `true` | Shows the rolling value above the ruler. |
| `fontSize` | `number` | `56` | Value size. |
| `haptics` | `boolean` | `true` | A tick per step, light on majors, rigid at the bounds. |
| `className` | `string` |  | Root classes (margins, width...). |
| `valueClassName` | `string` |  | Value classes, passed to NumberTicker. |

## Source

- React Native: [registry/ruler-picker.tsx](https://github.com/rs-4/dissolve/blob/main/registry/ruler-picker.tsx)
- React: [registry/web/ruler-picker.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/ruler-picker.tsx) and [registry/web/ruler-picker.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/ruler-picker.core.ts)

Previous: [QuantityStepper](https://dissolve.rselmi.com/components/quantity-stepper/) · Next: [BarChart](https://dissolve.rselmi.com/components/bar-chart/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/ruler-picker/
