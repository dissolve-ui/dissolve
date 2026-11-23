# Tooltip

**Tooltip** is an animated tooltip component for React Native and React, from the dissolve library. A label with an arrow on hover, focus or long press: it grows in, flips and slides to stay on screen.

A small label with an arrow for the element it wraps. On the web, hover or focus it and after the delay the tooltip grows in from it with a soft scale and fade; moving from one tooltip to the next skips the delay. On touch, press and hold: it shows after the delay and stays a moment after the finger lifts. It sits on the side you ask for (top, bottom, left or right), flips to the other side when the edge is too close, and slides along that edge to stay on screen, the arrow still pointing at the element. On the web it lives in document.body, so no overflow clips it, and follows the element on scroll and resize; the bubble has role tooltip, the element gets aria-describedby and Escape hides it. On iOS it renders next to the view and raises itself over its siblings, and the label joins the view's accessibility hint. A selection tick as it shows on iOS. Reduced motion: a plain fade.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add tooltip --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/tooltip.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add tooltip --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/tooltip.json
```

## Usage

Tooltip.tsx (React Native):

```tsx
import { Tooltip } from '@/components/dissolve/tooltip';

<Tooltip content="Share">
  <IconButton icon="share" accessibilityLabel="Share" onPress={share} />
</Tooltip>

// Below, quicker, a longer label.
<Tooltip content="Archived items are kept 30 days" placement="bottom" delay={250}>
  <InfoIcon />
</Tooltip>
```

Tooltip.tsx (React):

```tsx
import { Tooltip } from '@/components/dissolve/tooltip';

<Tooltip content="Share">
  <IconButton icon="share" accessibilityLabel="Share" onPress={share} />
</Tooltip>

// Below, quicker, a longer label.
<Tooltip content="Archived items are kept 30 days" placement="bottom" delay={250}>
  <InfoIcon />
</Tooltip>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | `ReactNode` |  | The label. A string, or any node. |
| `children` | `ReactElement` |  | The element it describes. On the web, make it focusable for keyboard users. |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Preferred side. It flips to the other side when the edge is too close. |
| `delay` | `number` | `400` | How long to hover, focus or hold before it shows, in ms. |
| `offset` | `number` | `8` | Gap between the element and the arrow tip, in pt. |
| `open` | `boolean` |  | Shown or hidden (controlled). |
| `onOpenChange` | `(open: boolean) => void` |  | Called when it wants to show or hide. |
| `disabled` | `boolean` | `false` | Never shows. |
| `haptics` | `boolean` | `true` | Selection tick as it shows (iOS). |
| `className` | `string` |  | Classes of the wrapper around the element (margins...). |

## Source

- React Native: [registry/tooltip.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/tooltip.tsx)
- React: [registry/web/tooltip.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/tooltip.tsx) and [registry/web/tooltip.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/tooltip.core.ts)

Previous: [AvatarStack](https://dissolve.rselmi.com/components/avatar-stack/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/tooltip/
