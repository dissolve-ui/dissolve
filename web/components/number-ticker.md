# NumberTicker

**NumberTicker** is an animated number ticker component for React Native and React, from the dissolve library. Rolling digit columns for prices and counters, locale aware.

Animated number for prices, balances and counters. Every digit is a clipped 0 to 9 column that rolls to its new value on a calm iOS curve, right to left with a slight stagger. Added digits open in, removed ones fold out, so the layout never jumps.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add number-ticker --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/number-ticker.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add number-ticker --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/number-ticker.json
```

## Usage

NumberTicker.tsx (React Native):

```tsx
import { NumberTicker } from '@/components/dissolve/number-ticker';

<NumberTicker
  value={balance}
  decimals={2}
  locale="fr-FR"
  suffix={'\u00A0€'}
  fontSize={44}
/>
```

NumberTicker.tsx (React):

```tsx
import { NumberTicker } from '@/components/dissolve/number-ticker';

<NumberTicker
  value={balance}
  decimals={2}
  locale="fr-FR"
  suffix={'\u00A0€'}
  fontSize={44}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | `required` | The number to show. Digits roll whenever it changes. |
| `decimals` | `number` | `0` | Digits after the decimal separator. |
| `locale` | `string` |  | Picks the separators, e.g. 'fr-FR' gives "1 240,50", 'en-US' "1,240.50". |
| `separator` | `string` |  | Overrides the locale thousands separator. '' turns grouping off. |
| `decimalSeparator` | `string` |  | Overrides the locale decimal separator. |
| `prefix` | `string` |  | Static text before the number, e.g. '$'. |
| `suffix` | `string` |  | Static text after the number, e.g. a no break space and €. |
| `fontSize` | `number` | `34` | Text size. |
| `duration` | `number` | `700` | Roll duration, ms. |
| `stagger` | `number` | `28` | Delay between two columns, right to left, ms. |
| `tabular` | `boolean` | `true` | Tabular figures, so digits never change width. |
| `className` | `string` | `'flex-row items-center self-start'` | Root: margins, alignment. |
| `textClassName` | `string` | `'font-semibold text-dissolve-foreground'` | Number: color, weight, family. |
| `affixClassName` | `string` |  | Prefix and suffix, added on top of the number classes. |

## Source

- React Native: [registry/number-ticker.tsx](https://github.com/rs-4/dissolve/blob/main/registry/number-ticker.tsx)
- React: [registry/web/number-ticker.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/number-ticker.tsx) and [registry/web/number-ticker.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/number-ticker.core.ts)

Previous: [OTPInput](https://dissolve.rselmi.com/components/otp-input/) · Next: [ReactionPicker](https://dissolve.rselmi.com/components/reaction-picker/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/number-ticker/
