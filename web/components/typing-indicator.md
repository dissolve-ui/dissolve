# TypingIndicator

**TypingIndicator** is an animated typing indicator component for React Native and React, from the dissolve library. Chat typing indicator: avatars of who is typing pop into a stack beside three waving dots, with a +N past the limit.

The chat typing indicator: the avatars of who is typing, overlapping in a stack, a bubble of three dots in a wave, and "Ana and Ben are typing" under them, in the column of the message text (past the first avatar). Pass the people typing right now and the indicator works out the rest. A newcomer pops into the stack on a spring and the stack makes room; someone who stops shrinks away and the others slide over to close the gap. Past maxAvatars, a +N disc stands for the rest. The line changes with a short crossfade. With nobody typing everything fades out, and the indicator keeps its height so a chat does not jump. Monochrome: avatars without a picture show their initials on the second surface, the bubble is the surface color, the dots and the line muted. Announced politely to screen readers. Reduced motion: plain fades, the dots pulse in place.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add typing-indicator --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/typing-indicator.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add typing-indicator --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/typing-indicator.json
```

## Usage

TypingIndicator.tsx (React Native):

```tsx
import { TypingIndicator } from '@/components/dissolve/typing-indicator';

<TypingIndicator
  typers={typing.map((u) => ({ id: u.id, name: u.firstName, avatar: u.photo }))}
/>

// Two faces before the +N, smaller, your own line.
<TypingIndicator
  typers={typers}
  maxAvatars={2}
  size={24}
  formatLabel={(names) => `${names.length} people are typing`}
/>
```

TypingIndicator.tsx (React):

```tsx
import { TypingIndicator } from '@/components/dissolve/typing-indicator';

<TypingIndicator
  typers={typing.map((u) => ({ id: u.id, name: u.firstName, avatar: u.photo }))}
/>

// Two faces before the +N, smaller, your own line.
<TypingIndicator
  typers={typers}
  maxAvatars={2}
  size={24}
  formatLabel={(names) => `${names.length} people are typing`}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `typers` | `{ id, name, avatar? }[]` |  | Who is typing right now, in stack order (first on top). ids keep each avatar stable; avatar is a picture URL (or a require() on React Native), else the initials. |
| `maxAvatars` | `number` | `3` | Avatars shown; past it the last slot becomes a +N disc. |
| `size` | `number` | `28` | Avatar diameter, pt. The dot bubble scales with it. |
| `showLabel` | `boolean` | `true` | The "Ana and Ben are typing" line under the avatars. Screen readers hear it either way. |
| `formatLabel` | `(names: string[]) => string` |  | Your own line from the names. Default: "Ana, Ben and 2 others are typing". |
| `className` | `string` |  | Outer classes (margins...). |

## Source

- React Native: [registry/typing-indicator.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/typing-indicator.tsx)
- React: [registry/web/typing-indicator.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/typing-indicator.tsx) and [registry/web/typing-indicator.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/typing-indicator.core.ts)

Previous: [Tooltip](https://dissolve.rselmi.com/components/tooltip/) · Next: [Marquee](https://dissolve.rselmi.com/components/marquee/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/typing-indicator/
