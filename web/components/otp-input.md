# OTPInput

**OTPInput** is an animated OTP input component for React Native and React, from the dissolve library. One time code boxes, verify sweep, success tint, shake and dust on reject.

One time code input. A hidden field (SMS autofill, paste) drives the boxes, the active box blinks a calm caret and each digit lands crisply. A full code is checked: the boxes turn green, or the row shakes and the digits blow away as dust before the input clears and asks again.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add otp-input --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/otp-input.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add otp-input --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/otp-input.json
```

## Usage

OTPInput.tsx (React Native):

```tsx
import { OTPInput } from '@/components/dissolve/otp-input';

<OTPInput
  autoFocus
  onComplete={async (code) => (await api.verify(code)).ok}
/>
```

OTPInput.tsx (React):

```tsx
import { OTPInput } from '@/components/dissolve/otp-input';

<OTPInput
  autoFocus
  onComplete={async (code) => (await api.verify(code)).ok}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `length` | `number` | `6` | Number of digits. |
| `value` | `string` |  | Controlled value. Leave undefined to let the input own its state. |
| `onChange` | `(code: string) => void` |  | Called on every change. |
| `onComplete` | `(code: string) => boolean \| void \| Promise` |  | Runs once every box is filled. True shows the success state, false rejects: the row shakes, the digits turn to dust and the input clears. Nothing leaves the code in place. |
| `autoFocus` | `boolean` | `false` | Focus on mount. |
| `height` | `number` | `56` | Box height. Box width follows the available space unless boxWidth is set. |
| `boxWidth` | `number` |  | Fixed box width. |
| `gap` | `number` | `8` | Space between boxes. |
| `fontSize` | `number` | `26` | Digit size. |
| `radius` | `number` | `14` | Box corner radius. |
| `blurOnSuccess` | `boolean` | `true` | Close the keyboard once the code is accepted. |
| `haptics` | `boolean` | `true` | Success and error notifications. |
| `className` | `string` |  | Root: margins, width. |
| `boxClassName` | `string` |  | Every box: shadow, extra layout. Box colors are animated from the surface, border, foreground, success and danger tokens. |
| `digitClassName` | `string` | `'font-semibold'` | Digits: weight, family. Their color is animated from the tokens. |

## Source

- React Native: [registry/otp-input.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/otp-input.tsx)
- React: [registry/web/otp-input.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/otp-input.tsx) and [registry/web/otp-input.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/otp-input.core.ts)

Previous: [SlideToConfirm](https://dissolve.rselmi.com/components/slide-to-confirm/) · Next: [NumberTicker](https://dissolve.rselmi.com/components/number-ticker/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/otp-input/
