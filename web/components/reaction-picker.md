# ReactionPicker

**ReactionPicker** is an animated reaction picker component for React Native and React, from the dissolve library. iMessage style reactions: long press, dock magnifier, emoji flies to a badge.

iMessage style reactions. Long press a bubble: it lifts, a pill of emojis grows out of the press point. Slide across and the emoji under the finger magnifies like the Dock. Release on one to pick it, it flies to the bubble corner. Pick the same one again and the badge snaps into grains.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add reaction-picker --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/reaction-picker.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add reaction-picker --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/reaction-picker.json
```

## Usage

ReactionPicker.tsx (React Native):

```tsx
import { useState } from 'react';
import { ReactionPicker } from '@/components/dissolve/reaction-picker';

export function Message({ text }) {
  const [reaction, setReaction] = useState(null);

  return (
    <ReactionPicker
      selected={reaction}
      onReact={(e) => setReaction(e === reaction ? null : e)}
    >
      <Bubble text={text} />
    </ReactionPicker>
  );
}
```

ReactionPicker.tsx (React):

```tsx
import { useState } from 'react';
import { ReactionPicker } from '@/components/dissolve/reaction-picker';

export function Message({ text }) {
  const [reaction, setReaction] = useState(null);

  return (
    <ReactionPicker
      selected={reaction}
      onReact={(e) => setReaction(e === reaction ? null : e)}
    >
      <Bubble text={text} />
    </ReactionPicker>
  );
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | `required` | The bubble. It lifts while the picker is open. |
| `onReact` | `(emoji: string) => void` | `required` | Called with the chosen emoji. Picking the current one again is your cue to remove it. |
| `reactions` | `string[]` | `['❤️', '😂', '😮', '😢', '👍', '🔥']` | Emojis offered in the pill. |
| `selected` | `string \| null` |  | Current reaction, shown as a badge on the bubble corner. |
| `corner` | `'top-left' \| 'top-right'` | `'top-right'` | Corner the badge sits on. Use top-left for your own bubbles. |
| `insets` | `{ top?, bottom? }` | `{ top: 60, bottom: 34 }` | Space kept free at the top and bottom of the window (safe area). |
| `disabled` | `boolean` | `false` | Turns the long press off. |
| `haptics` | `boolean` | `true` | Medium impact on open, a tick per emoji crossed, light impact on pick. |
| `className` | `string` |  | Wrapper: margins, alignment. |
| `pillClassName` | `string` |  | Emoji pill: background, border, shadow. |
| `badgeClassName` | `string` |  | Badge disc, also used by the emoji flying to the bubble. |
| `backdropClassName` | `string` | `transparent` | Layer over the screen while the picker is open, e.g. `bg-black/20` to dim. |

## Source

- React Native: [registry/reaction-picker.tsx](https://github.com/rs-4/dissolve/blob/main/registry/reaction-picker.tsx)
- React: [registry/web/reaction-picker.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/reaction-picker.tsx) and [registry/web/reaction-picker.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/reaction-picker.core.ts)

Previous: [NumberTicker](https://dissolve.rselmi.com/components/number-ticker/) · Next: [VoiceNote](https://dissolve.rselmi.com/components/voice-note/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/reaction-picker/
