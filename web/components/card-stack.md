# CardStack

**CardStack** is an animated card stack component for React Native and React, from the dissolve library. Wallet style card stack: tap to focus, drag down to put back, swipe to cycle.

A Wallet style stack. Cards overlap and show their top strip; tap one and it comes forward while the others slide down and compress under it. Drag the focused card down to put it back, swipe it sideways to go to the next one. One calm curve, no bounce, and a fixed height so nothing around it relayouts.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add card-stack --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/card-stack.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add card-stack --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/card-stack.json
```

## Usage

CardStack.tsx (React Native):

```tsx
import { CardStack } from '@/components/dissolve/card-stack';

<CardStack
  items={cards}
  keyExtractor={(c) => c.id}
  renderCard={(c) => <PaymentCard card={c} />}
  onFocus={setActive}
/>
```

CardStack.tsx (React):

```tsx
import { CardStack } from '@/components/dissolve/card-stack';

<CardStack
  items={cards}
  keyExtractor={(c) => c.id}
  renderCard={(c) => <PaymentCard card={c} />}
  onFocus={setActive}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `T[]` | `required` | The cards, top of the stack first. |
| `renderCard` | `(item: T, index: number) => ReactNode` | `required` | Renders one card face. It is clipped to the card radius. |
| `cardHeight` | `number` | `width / 1.586` | Card height. The default is the ISO payment card ratio. |
| `peek` | `number` | `60` | Visible strip of each card in the stack. |
| `onFocus` | `(index: number \| null) => void` |  | Called with the focused index, or null when back to the stack. |
| `keyExtractor` | `(item: T, index: number) => string` |  | Stable keys for the cards. |
| `haptics` | `boolean` | `true` | Light impact on focus, soft on restack, a tick when cycling. |
| `className` | `string` |  | Container: margins, padding. |
| `cardClassName` | `string` | `'rounded-[20px]' + shadow` | Card chrome: corner radius and shadow. Replaces the default, a soft shadow cast upward on the card behind. |

## Source

- React Native: [registry/card-stack.tsx](https://github.com/rs-4/dissolve/blob/main/registry/card-stack.tsx)
- React: [registry/web/card-stack.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/card-stack.tsx) and [registry/web/card-stack.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/card-stack.core.ts)

Previous: [SignaturePad](https://dissolve.rselmi.com/components/signature-pad/) · Next: [BeforeAfter](https://dissolve.rselmi.com/components/before-after/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/card-stack/
